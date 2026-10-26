import hmac
import json
import logging
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from storage import Store, now_ms
from validation import command, integer, valid_telemetry

LOG = logging.getLogger("planter")
WEB = Path(__file__).parent / "web" / "index.html"


class Service:
    def __init__(self, store, device, key):
        self.store, self.device, self.key = store, device, key
        self.mqtt = None
        self.connected = threading.Event()

    def ingest(self, topic, payload):
        if len(payload) > 4096:
            return
        try:
            body = json.loads(payload)
            kind = topic.removeprefix(f"planter/{self.device}/")
            if kind == "telemetry" and valid_telemetry(body, self.device):
                self.store.telemetry(self.device, body)
            elif kind == "status" and isinstance(body, dict) and type(body.get("gateway_online")) is bool:
                self.store.gateway(self.device, body["gateway_online"])
            elif kind == "ack" and isinstance(body, dict) and integer(body.get("id"), 1, 0x7FFFFFFF) and integer(body.get("code"), 0, 9) and body.get("stage") in ("stm32", "gateway"):
                self.store.ack(self.device, body)
        except (ValueError, UnicodeDecodeError, TypeError):
            LOG.warning("Ignored invalid MQTT payload on %s", topic)

    def start_mqtt(self):
        import paho.mqtt.client as mqtt
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="planter-cloud", protocol=mqtt.MQTTv311)
        client.username_pw_set(os.environ["MQTT_USER"], os.environ["MQTT_PASSWORD"])
        client.tls_set(ca_certs=os.environ.get("MQTT_CA", "/certs/ca.crt"))
        client.reconnect_delay_set(1, 30)

        def connected(c, userdata, flags, reason_code, properties):
            if reason_code == 0:
                c.subscribe([(f"planter/{self.device}/{k}", 1) for k in ("telemetry", "ack", "status")])
                self.connected.set()
            else:
                LOG.error("MQTT rejected connection: %s", reason_code)

        def disconnected(c, userdata, flags, reason_code, properties):
            self.connected.clear()

        client.on_connect = connected
        client.on_disconnect = disconnected
        client.on_message = lambda c, u, m: self.ingest(m.topic, m.payload)
        self.mqtt = client
        client.connect_async(os.environ.get("MQTT_HOST", "broker"), int(os.environ.get("MQTT_PORT", 8883)), 20)
        client.loop_start()

    def state(self):
        latest = self.store.latest(self.device)
        gateway = self.store.gateway_online(self.device)
        online = bool(self.connected.is_set() and gateway and latest and now_ms()-latest["received_ms"] < 10000)
        return {"device": self.device, "mqtt_online": self.connected.is_set(), "gateway_online": gateway,
                "device_online": online, "telemetry": latest, "commands": self.store.commands(self.device)}

    def issue(self, body):
        op, args = command(body)
        state = self.state()
        if not state["device_online"]:
            raise RuntimeError("设备离线或数据已过期，未下发指令")
        msg = self.store.issue(self.device, state["telemetry"]["boot"], op, args)
        info = self.mqtt.publish(f"planter/{self.device}/command", json.dumps(msg), qos=1, retain=False)
        if info.rc != 0:
            self.store.fail(self.device, msg["id"])
            raise RuntimeError("MQTT 发布失败")
        return {"id": msg["id"], "state": "sent"}


def handler(service):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            LOG.info("HTTP %s", fmt % args)

        def reply(self, status, body, content_type="application/json; charset=utf-8"):
            data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def authorized(self):
            provided = self.headers.get("Authorization", "")
            if hmac.compare_digest(provided.encode(), ("Bearer " + service.key).encode()):
                return True
            self.reply(401, {"error": "请输入正确的 API 密钥"})
            return False

        def do_GET(self):
            route = urlparse(self.path)
            if route.path == "/":
                self.reply(200, WEB.read_bytes(), "text/html; charset=utf-8")
                return
            if route.path == "/health":
                self.reply(200, {"http": True, "mqtt": service.connected.is_set()})
                return
            if not self.authorized():
                return
            if route.path == "/api/state":
                self.reply(200, service.state())
            elif route.path == "/api/history":
                try:
                    limit = min(1000, max(1, int(parse_qs(route.query).get("limit", ["120"])[0])))
                except ValueError:
                    self.reply(400, {"error": "limit 应为整数"})
                    return
                self.reply(200, service.store.history(service.device, limit))
            else:
                self.reply(404, {"error": "接口不存在"})

        def do_POST(self):
            if not self.authorized():
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 4096:
                    raise ValueError("请求长度不正确")
                body = json.loads(self.rfile.read(length))
                route = urlparse(self.path).path
                if route == "/api/germination":
                    if not isinstance(body, dict) or not integer(body.get("total"), 1, 100000) or not integer(body.get("germinated"), 0, body["total"]):
                        raise ValueError("发芽数或总数不正确")
                    rate = (body["germinated"] * 1000 + body["total"]//2) // body["total"]
                    body = {"op": "germination", "args": [rate, 0, 0, 0, 0, 0]}
                elif route != "/api/command":
                    self.reply(404, {"error": "接口不存在"})
                    return
                self.reply(202, service.issue(body))
            except (ValueError, UnicodeDecodeError, TypeError) as exc:
                self.reply(400, {"error": str(exc)})
            except RuntimeError as exc:
                self.reply(409, {"error": str(exc)})

    return Handler


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    key = os.environ.get("API_KEY", "")
    if len(key) < 24:
        raise SystemExit("Set API_KEY to a random string of at least 24 characters")
    service = Service(Store(os.environ.get("DB_PATH", "/data/planter.db")), os.environ.get("DEVICE_ID", "planter-001"), key)
    service.start_mqtt()
    server = ThreadingHTTPServer((os.environ.get("HTTP_HOST", "0.0.0.0"), int(os.environ.get("HTTP_PORT", "8000"))), handler(service))
    server.daemon_threads = True
    def stop(signum, frame):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        service.mqtt.disconnect()
        service.mqtt.loop_stop()


if __name__ == "__main__":
    main()
