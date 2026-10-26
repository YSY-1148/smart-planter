import argparse
import os
import subprocess
import sys
from pathlib import Path

import yaml
from bootstrap import HERE, setup


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, required=True)
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--device", default="cpu")
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--weights", default="")
    p.add_argument("--name", default="simplify")
    p.add_argument("--project", type=Path, default=HERE / "runs")
    args = p.parse_args()
    if not args.data.is_file() or args.epochs < 1 or args.batch < 1 or args.imgsz < 64 or args.imgsz % 32:
        p.error("Provide data YAML, positive epochs/batch and an image size divisible by 32")
    config = yaml.safe_load(args.data.read_text())
    names = config.get("names")
    if names not in ({0: "alive", 1: "dormant"}, ["alive", "dormant"]):
        p.error("Class mapping must be 0=alive, 1=dormant")
    repo = setup()
    runs = args.project.resolve()
    runs.mkdir(parents=True, exist_ok=True)
    hyp = yaml.safe_load((repo / "data/hyps/hyp.scratch-low.yaml").read_text())
    hyp.update(mosaic=1.0, mixup=0.0)
    hyp_path = runs / "hyp.mosaic9.yaml"
    hyp_path.write_text(yaml.safe_dump(hyp))
    env = dict(os.environ, YOLOv5_AUTOINSTALL="false", WANDB_MODE="disabled")
    command = [sys.executable, str(repo / "train.py"), "--cfg", str(HERE / "models/simplify_yolov5s.yaml"),
               "--data", str(args.data.resolve()), "--hyp", str(hyp_path), "--epochs", str(args.epochs),
               "--imgsz", str(args.imgsz), "--batch-size", str(args.batch), "--device", args.device,
               "--workers", str(args.workers), "--weights", args.weights, "--project", str(runs),
               "--name", args.name, "--noplots"]
    subprocess.run(command, env=env, check=True)


if __name__ == "__main__":
    main()
