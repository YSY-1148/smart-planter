import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def run_checked(command, env, timeout):
    result = subprocess.run(command, env=env, check=True, timeout=timeout, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout, flush=True)
    if "Traceback" in result.stdout or "Exception in thread" in result.stdout:
        raise RuntimeError("A worker thread failed despite the command's exit status")


def main():
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        for split, count in [("train", 6), ("val", 2), ("test", 2)]:
            (work / "images" / split).mkdir(parents=True)
            (work / "labels" / split).mkdir(parents=True)
            for i in range(count):
                image = Image.new("RGB", (128, 128), (80+i*5, 80, 80))
                draw = ImageDraw.Draw(image)
                draw.rectangle((20, 30, 44, 70), fill=(20, 180, 50))
                draw.rectangle((76, 76, 100, 100), fill=(120, 95, 60))
                image.save(work / "images" / split / f"{i}.jpg")
                (work / "labels" / split / f"{i}.txt").write_text("0 0.25 0.390625 0.1875 0.3125\n1 0.6875 0.6875 0.1875 0.1875\n")
        data = work / "seedlings.yaml"
        data.write_text(json.dumps({"path": str(work), "train": "images/train", "val": "images/val", "test": "images/test", "names": ["alive", "dormant"]}))
        font_dir = work / "fonts"
        font_dir.mkdir()
        font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        if font.exists():
            shutil.copyfile(font, font_dir / "Arial.ttf")
        env = dict(os.environ, OMP_NUM_THREADS="1", MKL_NUM_THREADS="1", YOLOV5_CONFIG_DIR=str(font_dir), WANDB_MODE="disabled")
        run_checked([sys.executable, str(ROOT / "vision/train_model.py"), "--data", str(data), "--epochs", "1", "--imgsz", "64", "--batch", "2", "--project", str(work / "runs"), "--name", "smoke"], env, 120)
        checkpoint = work / "runs/smoke/weights/best.pt"
        assert checkpoint.is_file()
        print("PASS actual one-epoch trainer, Mosaic-9 loader and checkpoint", flush=True)
        run_checked([sys.executable, str(ROOT / "vision/evaluate.py"), "--data", str(data), "--weights", str(checkpoint), "--imgsz", "64", "--project", str(work / "evaluation")], env, 60)
        print("PASS independent test entry point", flush=True)
        output = work / "inference"
        run_checked([sys.executable, str(ROOT / "vision/infer.py"), "--weights", str(checkpoint), "--source", str(work / "images/test/0.jpg"), "--imgsz", "64", "--output", str(output), "--expected-total", "2", "--max-frames", "1"], env, 60)
        result = json.loads((output / "results.jsonl").read_text().splitlines()[0])
        assert result["total"] == result["alive"] + result["dormant"]
        assert (output / "latest.jpg").is_file()
        print("PASS checkpoint -> image inference -> counts, JSON log and annotated image", flush=True)
        print("Synthetic shapes test software execution only; no plant recognition metrics claimed", flush=True)


if __name__ == "__main__":
    main()
