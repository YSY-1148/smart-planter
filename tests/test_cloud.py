import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cloud"))
from app import Service, handler
from storage import Store, now_ms
from validation import command


def telemetry():
    return {"device": "planter-001", "boot": 42, "seq": 1, "uptime_s": 12, "sample_age_ms": 0,
            "temp_c": 25.5, "humidity_pct": 55, "lux": 9200, "water_low": False, "sensor_mask": 3,
            "mode": "auto", "outputs": {"led_pct": 40, "fan": False, "drip": False, "mist": False, "refill": False},
            "alarms": 0, "germination_pct": 90, "last_command": 0, "at_ms": now_ms()}


class Publisher:
    def __init__(self):
        self.messages = []
        self.rc = 0

    def publish(self, topic, body, qos, retain):
        self.messages.append((topic, json.loads(body), qos, retain))
        return self


class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "test.db")
        self.service = Service(self.store, "planter-001", "a" * 32)
        self.service.mqtt = Publisher()

    def tearDown(self):
        self.temp.cleanup()

    def online(self):
        self.service.connected.set()
        self.service.ingest("planter/planter-001/status", b'{"gateway_online":true}')
        self.service.ingest("planter/planter-001/telemetry", json.dumps(telemetry()).encode())

    def test_telemetry_validation_dedup_and_persistence(self):
        self.online()
        self.service.ingest("planter/planter-001/telemetry", json.dumps(telemetry()).encode())
        self.assertEqual(len(self.store.history("planter-001")), 1)
        bad = telemetry()
        bad["seq"] = 2
        bad["outputs"]["led_pct"] = 101
        self.service.ingest("planter/planter-001/telemetry", json.dumps(bad).encode())
        self.assertEqual(len(self.store.history("planter-001")), 1)
        self.assertEqual(Store(self.store.path).latest("planter-001")["boot"], 42)
        self.service.ingest("planter/planter-001/telemetry", b"{")
        self.service.ingest("planter/planter-001/ack", b"[]")

    def test_command_ack_and_concurrency_guard(self):
        self.online()
        result = self.service.issue({"op": "auto"})
        topic, msg, qos, retained = self.service.mqtt.messages[-1]
        self.assertEqual((topic, qos, retained), ("planter/planter-001/command", 1, False))
        self.assertEqual(msg["boot"], 42)
        self.assertEqual(msg["expires_ms"]-msg["issued_ms"], 10000)
        with self.assertRaises(ValueError):
            self.service.issue({"op": "auto"})
        ack = {"id": result["id"], "code": 0, "stage": "stm32"}
        self.service.ingest("planter/planter-001/ack", json.dumps(ack).encode())
        self.assertEqual(self.store.commands("planter-001")[0]["state"], "accepted")
        self.service.issue({"op": "auto"})

    def test_offline_publish_failure_and_argument_validation(self):
        with self.assertRaises(RuntimeError):
            self.service.issue({"op": "auto"})
        with self.assertRaises(ValueError):
            command({"op": "manual", "args": [10, 0, 1, 1, 0, 10000]})
        with self.assertRaises(ValueError):
            command({"op": "manual", "args": [True, 0, 0, 0, 0, 10000]})
        self.online()
        self.service.mqtt.rc = 4
        with self.assertRaises(RuntimeError):
            self.service.issue({"op": "auto"})
        self.assertEqual(self.store.commands("planter-001")[0]["state"], "publish_failed")

    def test_http_auth_history_and_germination(self):
        self.online()
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler(self.service))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(server.server_port)
        try:
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen(base + "/api/state")
            self.assertEqual(cm.exception.code, 401)
            headers = {"Authorization": "Bearer " + "a" * 32, "Content-Type": "application/json"}
            with urllib.request.urlopen(urllib.request.Request(base + "/api/state", headers=headers)) as r:
                self.assertTrue(json.load(r)["device_online"])
            with urllib.request.urlopen(base + "/") as r:
                self.assertIn("智能家用蔬菜种植机", r.read().decode())
            request = urllib.request.Request(base + "/api/germination", data=b'{"germinated":18,"total":20}', headers=headers)
            with urllib.request.urlopen(request) as r:
                self.assertEqual(r.status, 202)
            self.assertEqual(self.service.mqtt.messages[-1][1]["args"][0], 900)
            request = urllib.request.Request(base + "/api/germination", data=b'{"germinated":21,"total":20}', headers=headers)
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen(request)
            self.assertEqual(cm.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main(verbosity=2)
