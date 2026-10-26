import argparse
import hashlib
import io
import json
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE / ".deps/yolov5-7.0"
URL = "https://codeload.github.com/ultralytics/yolov5/zip/refs/tags/v7.0"
SHA256 = "a40568a7979c4b27195d198987e49610de86b038b044f2521f5515455571f852"


def patch_pillow(root):
    plots = root / "utils/plots.py"
    source = plots.read_text()
    if "def _planter_text_size(" in source:
        return
    if source.count("self.font.getsize(") != 2:
        raise RuntimeError("Unexpected upstream Pillow font implementation")
    helper = "def _planter_text_size(font, text):\n    left, top, right, bottom = font.getbbox(text)\n    return right - left, bottom - top\n\n\n"
    source = source.replace("class Annotator:", helper+"class Annotator:")
    source = source.replace("self.font.getsize(label)", "_planter_text_size(self.font, label)")
    source = source.replace("self.font.getsize(text)", "_planter_text_size(self.font, text)")
    plots.write_text(source)


def setup(archive=None):
    marker = REPO / ".planter_setup.json"
    if marker.exists():
        info = json.loads(marker.read_text())
        if info.get("archive_sha256") != SHA256 or info.get("mosaic") != 9:
            raise RuntimeError("YOLOv5 dependency marker does not match this project")
        patch_pillow(REPO)
        return REPO
    if REPO.exists():
        raise RuntimeError(f"Unverified dependency directory already exists: {REPO}")
    data = Path(archive).read_bytes() if archive else urllib.request.urlopen(URL, timeout=60).read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError("YOLOv5 archive checksum mismatch")
    REPO.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=REPO.parent) as temp:
        extracted = Path(temp) / "source"
        extracted.mkdir()
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for member in z.namelist():
                parts = Path(member).parts
                if not parts or parts[0] != "yolov5-7.0" or ".." in parts:
                    raise RuntimeError("Invalid archive path")
                if len(parts) == 1 or member.endswith("/"):
                    continue
                target = extracted.joinpath(*parts[1:])
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(member))
        loader = extracted / "utils/dataloaders.py"
        source = loader.read_text()
        if source.count("self.load_mosaic(") != 2 or "def load_mosaic9(" not in source:
            raise RuntimeError("Unexpected upstream Mosaic implementation")
        loader.write_text(source.replace("self.load_mosaic(", "self.load_mosaic9("))
        patch_pillow(extracted)
        (extracted / ".planter_setup.json").write_text(json.dumps({"upstream": "YOLOv5 v7.0", "archive_sha256": SHA256, "mosaic": 9}))
        shutil.move(str(extracted), REPO)
    return REPO


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--archive", type=Path)
    args = p.parse_args()
    print(setup(args.archive))
