import binascii
import struct

SIZE = 74


def encode(kind, seq, values):
    data = struct.pack("<BBBBI16I", 0xA5, 0x5A, 1, kind, seq, *(int(v) & 0xFFFFFFFF for v in values))
    return data + struct.pack("<H", binascii.crc_hqx(data, 0xFFFF))


def decode(data):
    if len(data) != SIZE or data[:3] != b"\xa5\x5a\x01" or struct.unpack("<H", data[-2:])[0] != binascii.crc_hqx(data[:-2], 0xFFFF):
        raise ValueError("Invalid frame")
    fields = struct.unpack("<BBBBI16i", data[:-2])
    return fields[3], fields[4], fields[5:]


def telemetry(seq, v, device):
    return {"device": device, "boot": v[0] & 0xFFFFFFFF, "seq": seq, "uptime_s": v[1], "sample_age_ms": 0,
            "temp_c": v[2]/10 if v[6] & 1 else None, "humidity_pct": v[3]/10 if v[6] & 1 else None,
            "lux": v[4] if v[6] & 2 else None, "water_low": bool(v[5]), "sensor_mask": v[6],
            "mode": "manual" if v[7] else "auto", "outputs": {"led_pct": v[8], "fan": bool(v[9]),
            "drip": bool(v[10]), "mist": bool(v[11]), "refill": bool(v[12])}, "alarms": v[13],
            "germination_pct": v[14]/10 if v[14] >= 0 else None, "last_command": v[15]}
