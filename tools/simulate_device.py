import argparse
import ctypes
import json
import queue
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import paho.mqtt.client as mqtt
from wire import SIZE, decode, encode, telemetry

ROOT = Path(__file__).resolve().parents[1]


def env_file(path):
    return dict(line.strip().split("=", 1) for line in path.read_text().splitlines() if line.strip() and not line.startswith("#"))


def main():
    parser = argparse.ArgumentParser(description="Synthetic device using the real C control core; does not operate hardware")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8883)
    parser.add_argument("--env", type=Path, default=ROOT / "cloud/.env")
    parser.add_argument("--ca", type=Path, default=ROOT / "cloud/mosquitto/certs/ca.crt")
    parser.add_argument("--humidity", type=float, default=45)
    parser.add_argument("--temp", type=float, default=27)
    parser.add_argument("--water-low", action="store_true")
    args = parser.parse_args()
    env = env_file(args.env)
    device = env["DEVICE_ID"]
    base = f"planter/{device}"
    compiler = shutil.which("gcc") or shutil.which("cc")
    if not compiler:
        raise SystemExit("Install GCC or Clang first")
    commands = queue.Queue(maxsize=8)
    boot = secrets.randbits(32) or 1
    with tempfile.TemporaryDirectory() as temp:
        library = Path(temp) / ("control.dll" if sys.platform == "win32" else "control.so")
        subprocess.run([compiler, "-std=c11", "-shared", "-fPIC", "-O2", "-I"+str(ROOT / "common"),
                        str(ROOT / "common/protocol.c"), str(ROOT / "common/planter.c"), str(ROOT / "tests/native_sim.c"), "-o", str(library)], check=True)
        core = ctypes.CDLL(str(library))
        buffer_type = ctypes.c_uint8 * SIZE
        core.sim_init.argtypes = [ctypes.c_uint32]
        core.sim_init.restype = None
        core.sim_step.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_uint8)]
        core.sim_step.restype = None
        core.sim_command.argtypes = [ctypes.POINTER(ctypes.c_uint8), ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint8)]
        core.sim_command.restype = None
        core.sim_init(boot)
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=device+"-simulator")
        client.username_pw_set(device, env["DEVICE_MQTT_PASSWORD"])
        client.tls_set(ca_certs=str(args.ca))
        client.will_set(base+"/status", '{"gateway_online":false}', qos=1, retain=True)

        def on_connect(c, u, flags, reason, properties):
            if reason == 0:
                c.subscribe(base+"/command", qos=1)
                c.publish(base+"/status", '{"gateway_online":true}', qos=1, retain=True)

        def on_message(c, u, m):
            try:
                commands.put_nowait(json.loads(m.payload))
            except (ValueError, queue.Full):
                pass

        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(args.host, args.port, 20)
        client.loop_start()
        start, report, led = time.monotonic(), 0, 0
        frame, ack = buffer_type(), buffer_type()
        print(f"SIMULATION ONLY: device={device}, boot={boot}; stop the real ESP32 while simulating this ID.")
        try:
            while True:
                now = int((time.monotonic()-start)*1000) & 0xFFFFFFFF
                while not commands.empty():
                    msg = commands.get_nowait()
                    try:
                        epoch = time.time_ns()//1_000_000
                        remaining = msg["expires_ms"]-epoch
                        if not 0 < remaining <= 30000 or msg["issued_ms"] > epoch+5000:
                            client.publish(base+"/ack", json.dumps({"id": msg["id"], "code": 3, "stage": "gateway"}))
                            continue
                        values = [0]*16
                        values[0], values[1:7], values[7], values[8] = msg["op"], msg["args"], msg["boot"], remaining
                        core.sim_command(buffer_type.from_buffer_copy(encode(2, msg["id"], values)), now, ack)
                        _, seq, v = decode(bytes(ack))
                        client.publish(base+"/ack", json.dumps({"id": seq, "code": v[0], "stage": "stm32", "at_ms": epoch}))
                    except (ValueError, KeyError, TypeError):
                        continue
                core.sim_step(now, round(args.temp*10), round(args.humidity*10), 2000+led*200, int(args.water_low), frame)
                _, seq, v = decode(bytes(frame))
                led = v[8]
                if now-report >= 1000:
                    body = telemetry(seq, v, device)
                    body["at_ms"] = time.time_ns()//1_000_000
                    body["simulation"] = True
                    client.publish(base+"/telemetry", json.dumps(body), qos=1, retain=False)
                    report = now
                time.sleep(0.1)
        except KeyboardInterrupt:
            pass
        finally:
            client.publish(base+"/status", '{"gateway_online":false}', qos=1, retain=True).wait_for_publish(timeout=2)
            client.disconnect()
            client.loop_stop()


if __name__ == "__main__":
    main()
