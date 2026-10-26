import json
import urllib.request


def summarize(classes):
    classes = [int(c) for c in classes]
    if any(c not in (0, 1) for c in classes):
        raise ValueError("Unexpected detection class")
    alive, dormant = classes.count(0), classes.count(1)
    total = alive+dormant
    return {"alive": alive, "dormant": dormant, "total": total,
            "germination_pct": alive*100.0/total if total else None}


def can_publish(counts, expected_total=None):
    return counts["total"] > 0 and (expected_total is None or counts["total"] == expected_total)


def send_counts(counts, base_url, key):
    if not key or not can_publish(counts):
        raise ValueError("API key and at least one detected target are required")
    body = json.dumps({"germinated": counts["alive"], "total": counts["total"]}).encode()
    req = urllib.request.Request(base_url.rstrip("/")+"/api/germination", data=body,
                                 headers={"Authorization": "Bearer "+key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)
