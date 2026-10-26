import argparse
import json
import os
import sys
import time
import urllib.error
from pathlib import Path

from bootstrap import HERE, setup
from logic import can_publish, send_counts, summarize


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--weights", type=Path, required=True)
    p.add_argument("--source", required=True, help="Image, folder, video, webcam index or network stream URL")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="cpu")
    p.add_argument("--conf", type=float, default=0.25)
    p.add_argument("--iou", type=float, default=0.45)
    p.add_argument("--interval", type=float, default=2.0)
    p.add_argument("--cloud-url", default="")
    p.add_argument("--publish-every", type=float, default=30)
    p.add_argument("--expected-total", type=int)
    p.add_argument("--output", type=Path, default=HERE / "runs/detection")
    p.add_argument("--max-frames", type=int, default=0)
    p.add_argument("--display", action="store_true")
    args = p.parse_args()
    if not args.weights.is_file() or not (0 < args.conf < 1 and 0 < args.iou < 1):
        p.error("Supply a trained checkpoint and thresholds in (0,1)")
    if args.interval < 0 or args.publish_every < 1 or args.max_frames < 0 or (args.expected_total is not None and args.expected_total < 1):
        p.error("Invalid interval, frame count or expected target count")
    key = os.environ.get("PLANTER_API_KEY", "")
    if args.cloud_url and not key:
        p.error("Set PLANTER_API_KEY to publish results")
    os.environ["YOLOv5_AUTOINSTALL"] = "false"
    repo = setup()
    sys.path.insert(0, str(repo))
    import cv2
    import torch
    from models.common import DetectMultiBackend
    from utils.dataloaders import IMG_FORMATS, VID_FORMATS, LoadImages, LoadStreams
    from utils.general import check_file, check_img_size, non_max_suppression, scale_boxes
    from utils.plots import Annotator, colors
    from utils.torch_utils import select_device

    model = DetectMultiBackend(str(args.weights.resolve()), device=select_device(args.device), fp16=False)
    names = model.names
    if (len(names) != 2 or names[0] != "alive" or names[1] != "dormant"):
        raise SystemExit("Checkpoint must use classes 0=alive and 1=dormant")
    size = check_img_size([args.imgsz, args.imgsz], s=model.stride)
    source = args.source
    is_file = source.split("?", 1)[0].rsplit(".", 1)[-1].lower() in IMG_FORMATS+VID_FORMATS
    if is_file and source.lower().startswith(("http://", "https://")):
        source = check_file(source)
    stream = source.isnumeric() or (source.lower().startswith(("rtsp://", "rtmp://", "http://", "https://")) and not is_file)
    dataset = LoadStreams(source, img_size=size, stride=model.stride, auto=model.pt) if stream else LoadImages(source, img_size=size, stride=model.stride, auto=model.pt)
    args.output.mkdir(parents=True, exist_ok=True)
    last_infer, last_publish, processed = float("-inf"), float("-inf"), 0
    try:
        with (args.output / "results.jsonl").open("a") as log, torch.inference_mode():
            for paths, image, originals, capture, message in dataset:
                now = time.monotonic()
                if stream and now-last_infer < args.interval:
                    time.sleep(min(0.05, args.interval))
                    continue
                last_infer = now
                tensor = torch.from_numpy(image).to(model.device).float()/255
                if tensor.ndim == 3:
                    tensor = tensor[None]
                detections = non_max_suppression(model(tensor), args.conf, args.iou, classes=[0, 1], agnostic=True)
                for index, detection in enumerate(detections):
                    processed += 1
                    frame = originals[index].copy() if stream else originals.copy()
                    annotator = Annotator(frame, line_width=2, example="alive dormant")
                    if len(detection):
                        detection[:, :4] = scale_boxes(tensor.shape[2:], detection[:, :4], frame.shape).round()
                        for *box, confidence, cls in detection:
                            annotator.box_label(box, f"{names[int(cls)]} {float(confidence):.2f}", color=colors(int(cls), True))
                    counts = summarize(detection[:, 5].tolist())
                    result = {"frame": processed, "source": str(paths[index] if stream else paths), "at_ms": time.time_ns()//1_000_000, **counts}
                    eligible = can_publish(counts, args.expected_total)
                    result["eligible_for_publish"] = eligible
                    if args.cloud_url and eligible and now-last_publish >= args.publish_every:
                        last_publish = now
                        try:
                            result["cloud"] = send_counts(counts, args.cloud_url, key)
                        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                            result["cloud_error"] = str(exc)
                    if not eligible:
                        result["skip_reason"] = "No detections or target count does not match expected total"
                    text = json.dumps(result, ensure_ascii=False)
                    print(text, flush=True)
                    log.write(text+"\n")
                    log.flush()
                    annotated = annotator.result()
                    cv2.imwrite(str(args.output / "latest.jpg"), annotated)
                    if args.display:
                        cv2.imshow("Seed germination", annotated)
                        if cv2.waitKey(1) & 0xFF == ord("q"):
                            return
                    if args.max_frames and processed >= args.max_frames:
                        return
    finally:
        if not stream and getattr(dataset, "cap", None):
            dataset.cap.release()
        if args.display:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
