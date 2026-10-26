import argparse
import ipaddress
import json
import os
import re
import secrets
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "eclipse-mosquitto:2.0.21"


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description="Generate MQTT TLS certificates and local configuration")
    parser.add_argument("--host", required=True, help="Public DNS name or IP used by ESP32")
    parser.add_argument("--device", default="planter-001")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", args.host) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", args.device):
        raise SystemExit("Invalid host or device ID")
    if not shutil.which("openssl") or not shutil.which("docker"):
        raise SystemExit("Install OpenSSL and Docker first")
    cloud = ROOT / "cloud"
    env = cloud / ".env"
    esp = ROOT / "esp32/include/secrets.h"
    ca_key = cloud / "private/ca.key"
    if env.exists() or esp.exists() or ca_key.exists():
        raise SystemExit("Existing configuration found; reuse it. Provisioning will not overwrite certificates or credentials.")
    certs = cloud / "mosquitto/certs"
    private = cloud / "private"
    certs.mkdir(parents=True, exist_ok=True)
    private.mkdir(mode=0o700, exist_ok=True)
    old_umask = os.umask(0o077)
    try:
        ca = certs / "ca.crt"
        run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "3650",
             "-keyout", str(ca_key), "-out", str(ca), "-subj", "/CN=Planter Private CA",
             "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign"])
        try:
            ipaddress.ip_address(args.host)
            san = f"DNS:broker,DNS:localhost,IP:{args.host},IP:127.0.0.1"
        except ValueError:
            san = f"DNS:broker,DNS:localhost,DNS:{args.host},IP:127.0.0.1"
        extensions = private / "server.ext"
        extensions.write_text(f"subjectAltName={san}\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n")
        csr = private / "server.csr"
        run(["openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", str(certs / "server.key"),
             "-out", str(csr), "-subj", "/CN="+args.host])
        run(["openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca), "-CAkey", str(ca_key),
             "-CAcreateserial", "-out", str(certs / "server.crt"), "-days", "825", "-sha256", "-extfile", str(extensions)])
        device_password, cloud_password, api_key = (secrets.token_hex(24) for _ in range(3))
        broker = cloud / "mosquitto"
        broker.chmod(0o755)
        certs.chmod(0o755)
        ca.chmod(0o644)
        (certs / "server.crt").chmod(0o644)
        script = ('mosquitto_passwd -c -b /work/passwords "$1" "$2" && '
                  'mosquitto_passwd -b /work/passwords cloud "$3" && '
                  'chown 1883:1883 /work/passwords /work/certs/server.key && '
                  'chmod 600 /work/passwords /work/certs/server.key')
        run(["docker", "run", "--rm", "--user", "0:0", "--entrypoint", "/bin/sh", "-v", str(broker)+":/work",
             IMAGE, "-c", script, "provision", args.device, device_password, cloud_password])
        (broker / "acl").write_text(
            f"user {args.device}\ntopic write planter/{args.device}/telemetry\ntopic write planter/{args.device}/ack\n"
            f"topic write planter/{args.device}/status\ntopic read planter/{args.device}/command\n\n"
            f"user cloud\ntopic read planter/{args.device}/telemetry\ntopic read planter/{args.device}/ack\n"
            f"topic read planter/{args.device}/status\ntopic write planter/{args.device}/command\n")
        (broker / "acl").chmod(0o644)
        env.write_text(f"DEVICE_ID={args.device}\nDEVICE_MQTT_PASSWORD={device_password}\nCLOUD_MQTT_PASSWORD={cloud_password}\nAPI_KEY={api_key}\n")
        config = {"WIFI_SSID": "CHANGE_ME", "WIFI_PASSWORD": "CHANGE_ME", "MQTT_HOST": args.host,
                  "MQTT_USER": args.device, "MQTT_PASSWORD": device_password, "DEVICE_ID": args.device}
        esp.write_text("#pragma once\n" + "".join(f"#define {k} {json.dumps(v)}\n" for k, v in config.items()) +
                       '#define MQTT_PORT 8883\nstatic const char MQTT_CA[] = R"CERT(\n' + ca.read_text() + ')CERT";\n')
    finally:
        os.umask(old_umask)
    print("Configuration generated. Edit Wi-Fi settings in esp32/include/secrets.h.")
    print("Start cloud: docker compose -f cloud/compose.yaml --env-file cloud/.env up -d --build")
    print("Read the API_KEY value from cloud/.env for dashboard login.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError:
        raise SystemExit("OpenSSL or Docker failed. Check Docker availability and local permissions.") from None
