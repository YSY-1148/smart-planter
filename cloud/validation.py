import math


def integer(value, low, high):
    return type(value) is int and low <= value <= high


def measurement(value, low, high):
    return value is None or (type(value) in (int, float) and math.isfinite(value) and low <= value <= high)


def valid_telemetry(b, device):
    if not isinstance(b, dict) or b.get("device") != device:
        return False
    return (integer(b.get("boot"), 1, 0xFFFFFFFF) and integer(b.get("seq"), 1, 0xFFFFFFFF)
            and integer(b.get("sample_age_ms"), 0, 5000) and integer(b.get("uptime_s"), 0, 0x7FFFFFFF)
            and measurement(b.get("temp_c"), -20, 60) and measurement(b.get("humidity_pct"), 0, 100)
            and measurement(b.get("lux"), 0, 60000) and measurement(b.get("germination_pct"), 0, 100)
            and b.get("mode") in ("auto", "manual") and type(b.get("water_low")) is bool
            and integer(b.get("alarms"), 0, 127) and integer(b.get("sensor_mask"), 0, 3)
            and integer(b.get("last_command"), 0, 0x7FFFFFFF) and valid_outputs(b.get("outputs")))


def valid_outputs(o):
    return (isinstance(o, dict) and integer(o.get("led_pct"), 0, 100)
            and all(type(o.get(k)) is bool for k in ("fan", "drip", "mist", "refill")))


OPS = {"config": 1, "manual": 2, "auto": 3, "germination": 4, "clear_fault": 5}


def command(b):
    if not isinstance(b, dict) or b.get("op") not in OPS:
        raise ValueError("未知操作")
    op = OPS[b["op"]]
    args = b.get("args", [0] * 6)
    if not isinstance(args, list) or len(args) != 6 or not all(integer(x, -0x80000000, 0x7FFFFFFF) for x in args):
        raise ValueError("args 必须包含六个整数")
    a, c, d, e, f, g = args
    if op == 1 and not (100 <= a <= 450 and 50 <= c <= a-10 and 200 <= d <= 800
                        and d+50 <= e <= 900 and 100 <= f <= 50000 and 0 <= g <= 1000):
        raise ValueError("阈值范围或迟滞间隔错误")
    if op == 2 and not (0 <= a <= 100 and all(x in (0, 1) for x in (c, d, e, f))
                        and 1000 <= g <= 30000 and not (d and e) and not (f and (d or e))):
        raise ValueError("手动参数错误，滴灌与喷雾不能同时开启，补液与灌溉互斥")
    if op == 4 and not 0 <= a <= 1000:
        raise ValueError("发芽率必须在 0 到 1000 之间，单位为 0.1%")
    return op, args
