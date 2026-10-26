import argparse
import json
import math
import random
from pathlib import Path


EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def check_label(path):
    if not path.is_file():
        raise ValueError(f"Missing label: {path}; background images need an empty txt file")
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) != 5 or parts[0] not in {"0", "1"}:
            raise ValueError(f"Expected YOLO 0/1 class + xywh: {path}:{number}")
        x, y, w, h = map(float, parts[1:])
        if not all(math.isfinite(v) for v in (x, y, w, h)) or not (0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
            raise ValueError(f"Invalid normalized box: {path}:{number}")
        if min(x-w/2, y-h/2) < -1e-5 or max(x+w/2, y+h/2) > 1+1e-5:
            raise ValueError(f"Box crosses image boundary: {path}:{number}")


def prepare(source, output, val_fraction=0.1, test_fraction=0.2, seed=42):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not (0 < val_fraction < 1 and 0 < test_fraction < 1 and val_fraction+test_fraction < 1):
        raise ValueError("Invalid split fractions")
    images = sorted(p for p in (source / "images").rglob("*") if p.suffix.lower() in EXTENSIONS and p.is_file())
    if len(images) < 3:
        raise ValueError("Need at least three original images for train/val/test")
    stems = set()
    for image in images:
        relative = image.relative_to(source / "images")
        stem = relative.with_suffix("").as_posix()
        if stem in stems:
            raise ValueError(f"Ambiguous same-stem image: {image}")
        stems.add(stem)
        check_label(source / "labels" / relative.with_suffix(".txt"))
    random.Random(seed).shuffle(images)
    n_val, n_test = max(1, round(len(images)*val_fraction)), max(1, round(len(images)*test_fraction))
    if n_val+n_test >= len(images):
        raise ValueError("Split leaves no training images")
    splits = {"val": images[:n_val], "test": images[n_val:n_val+n_test], "train": images[n_val+n_test:]}
    output.mkdir(parents=True, exist_ok=True)
    for name, paths in splits.items():
        (output / f"{name}.txt").write_text("\n".join(p.as_posix() for p in paths)+"\n")
    config = {"path": output.as_posix(), **{name: f"{name}.txt" for name in splits}, "names": ["alive", "dormant"]}
    (output / "seedlings.yaml").write_text(json.dumps(config, indent=2))
    return {name: len(paths) for name, paths in splits.items()}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--output", type=Path, default=Path(__file__).parent / "data")
    p.add_argument("--val-fraction", type=float, default=0.1)
    p.add_argument("--test-fraction", type=float, default=0.2)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    print(prepare(args.source, args.output, args.val_fraction, args.test_fraction, args.seed))
