import argparse
import os
import subprocess
import sys
from pathlib import Path

from bootstrap import HERE, setup


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, required=True)
    p.add_argument("--weights", type=Path, required=True)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="cpu")
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--project", type=Path, default=HERE / "runs/evaluation")
    p.add_argument("--task", choices=["val", "test"], default="test")
    args = p.parse_args()
    if not args.data.is_file() or not args.weights.is_file():
        p.error("Data YAML and trained checkpoint are required")
    repo = setup()
    subprocess.run([sys.executable, str(repo / "val.py"), "--data", str(args.data.resolve()),
                    "--weights", str(args.weights.resolve()), "--imgsz", str(args.imgsz), "--device", args.device,
                    "--task", args.task, "--workers", str(args.workers), "--project", str(args.project.resolve())],
                   env=dict(os.environ, YOLOv5_AUTOINSTALL="false"), check=True)
