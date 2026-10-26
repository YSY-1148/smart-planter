import argparse
import json
import os
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description="Submit germination counts from your inference program")
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--germinated", type=int, required=True)
    parser.add_argument("--total", type=int, required=True)
    args = parser.parse_args()
    key = os.environ.get("PLANTER_API_KEY", "")
    if not key:
        raise SystemExit("Set PLANTER_API_KEY first")
    body = json.dumps({"germinated": args.germinated, "total": args.total}).encode()
    request = urllib.request.Request(args.url.rstrip("/")+"/api/germination", data=body,
                                    headers={"Authorization": "Bearer "+key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            print(response.read().decode())
    except urllib.error.HTTPError as exc:
        raise SystemExit(exc.read().decode()) from None


if __name__ == "__main__":
    main()
