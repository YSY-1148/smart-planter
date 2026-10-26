import argparse
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud"))
from app import Service, handler
from storage import Store


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for(predicate, seconds=12):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError("Timed out waiting for integration condition")


def main():
    parser = argparse.ArgumentParser(description="Optional integration test with a real local Mosquitto and OpenSSL")
    parser.add_argument("--broker", default="mosquitto")
    parser.add_argument("--passwd", default="mosquitto_passwd")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        def run(*cmd):
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ca, key = work / "ca.crt", work / "ca.key"
        cert, server_key, csr, ext = (work / n for n in ("server.crt", "server.key", "server.csr", "server.ext"))
        run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-sha256", "-subj", "/CN=Integration CA", "-keyout", str(key), "-out", str(ca))
        run("openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost", "-keyout", str(server_key), "-out", str(csr))
        ext.write_text("subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n")
        run("openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca), "-CAkey", str(key), "-CAcreateserial", "-days", "1", "-sha256", "-extfile", str(ext), "-out", str(cert))
        password = secrets.token_hex(16)
        passwords = work / "passwords"
        run(args.passwd, "-b", "-c", str(passwords), "planter-001", password)
        run(args.passwd, "-b", str(passwords), "cloud", password)
        acl = work / "acl"
        acl.write_text((ROOT / "cloud/mosquitto/acl").read_text())
        mqtt_port = port()
        conf = work / "mosquitto.conf"
        conf.write_text(f"listener {mqtt_port} 127.0.0.1\nallow_anonymous false\npassword_file {passwords}\nacl_file {acl}\ncafile {ca}\ncertfile {cert}\nkeyfile {server_key}\nlog_dest stdout\n" + ("user root\n" if hasattr(os, "getuid") and os.getuid() == 0 else ""))
        log = (work / "broker.log").open("w")
        broker = subprocess.Popen([args.broker, "-c", str(conf)], stdout=log, stderr=log)
        simulator = None
        service = None
        server = None
        try:
            os.environ.update(MQTT_HOST="localhost", MQTT_PORT=str(mqtt_port), MQTT_CA=str(ca), MQTT_USER="cloud", MQTT_PASSWORD=password)
            store = Store(work / "data.db")
            api_key = secrets.token_hex(24)
            service = Service(store, "planter-001", api_key)
            service.start_mqtt()
            wait_for(service.connected.is_set)
            print("PASS real broker: TLS verification and authenticated cloud connection")
            env = work / "device.env"
            env.write_text(f"DEVICE_ID=planter-001\nDEVICE_MQTT_PASSWORD={password}\n")
            sim_log = (work / "simulator.log").open("w")
            simulator = subprocess.Popen([sys.executable, str(ROOT / "tools/simulate_device.py"), "--host", "localhost", "--port", str(mqtt_port), "--env", str(env), "--ca", str(ca)], stdout=sim_log, stderr=sim_log)
            wait_for(lambda: service.state()["device_online"])
            print("PASS native C simulator -> TLS MQTT -> Python -> SQLite telemetry")
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler(service))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            url = "http://127.0.0.1:" + str(server.server_port)
            headers = {"Authorization": "Bearer " + api_key, "Content-Type": "application/json"}
            def post(route, body):
                req = urllib.request.Request(url+route, data=json.dumps(body).encode(), headers=headers)
                with urllib.request.urlopen(req, timeout=3) as response:
                    return json.load(response)
            result = post("/api/command", {"op": "manual", "args": [35, 1, 0, 0, 0, 3000]})
            wait_for(lambda: any(c["id"] == result["id"] and c["state"] == "accepted" for c in store.commands("planter-001")))
            wait_for(lambda: store.latest("planter-001")["outputs"]["led_pct"] == 35)
            print("PASS HTTP -> MQTT -> native controller -> ACK and changed output telemetry")
            wait_for(lambda: store.latest("planter-001")["mode"] == "auto")
            print("PASS manual lease expiry restores automatic control")
            result = post("/api/germination", {"germinated": 18, "total": 20})
            wait_for(lambda: store.latest("planter-001")["germination_pct"] == 90)
            print("PASS germination count -> rate -> controller -> telemetry roundtrip")
            simulator.send_signal(signal.SIGINT)
            simulator.wait(timeout=5)
            wait_for(lambda: not service.state()["device_online"])
            print("PASS offline status propagation")
            assert Store(store.path).latest("planter-001") is not None
            print("PASS stored data survives reopening SQLite")
            print("All MQTT integration checks passed")
        except Exception:
            log.flush()
            print((work / "broker.log").read_text()[-3000:], file=sys.stderr)
            if (work / "simulator.log").exists():
                print((work / "simulator.log").read_text()[-3000:], file=sys.stderr)
            raise
        finally:
            if simulator and simulator.poll() is None:
                simulator.terminate()
                simulator.wait(timeout=5)
            if server:
                server.shutdown()
                server.server_close()
            if service:
                service.mqtt.disconnect()
                service.mqtt.loop_stop()
            broker.terminate()
            broker.wait(timeout=5)
            log.close()


if __name__ == "__main__":
    main()
