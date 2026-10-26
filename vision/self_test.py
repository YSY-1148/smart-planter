import os
import sys

from bootstrap import HERE, setup


def main():
    os.environ["YOLOv5_AUTOINSTALL"] = "false"
    repo = setup()
    sys.path.insert(0, str(repo))
    import torch
    import yaml
    from models.yolo import Model
    from utils.loss import ComputeLoss

    torch.set_num_threads(1)
    model = Model(str(HERE / "models/simplify_yolov5s.yaml"), ch=3, nc=2)
    baseline = Model(str(repo / "models/yolov5s.yaml"), ch=3, nc=2)
    sizes = [len(model.model[i].m) for i in (2, 4, 6, 8)]
    original = [len(baseline.model[i].m) for i in (2, 4, 6, 8)]
    assert sizes == [1, 1, 1, 1] and original == [1, 2, 3, 1]
    actual, previous = (sum(p.numel() for p in m.parameters()) for m in (model, baseline))
    assert actual < previous
    model.eval()
    with torch.inference_mode():
        decoded, raw = model(torch.zeros(1, 3, 160, 160))
    assert tuple(decoded.shape) == (1, 1575, 7) and len(raw) == 3
    model.hyp = yaml.safe_load((repo / "data/hyps/hyp.scratch-low.yaml").read_text())
    model.train()
    predictions = model(torch.rand(2, 3, 64, 64))
    targets = torch.tensor([[0, 0, 0.5, 0.5, 0.2, 0.2], [1, 1, 0.5, 0.5, 0.3, 0.3]])
    loss, _ = ComputeLoss(model)(predictions, targets)
    assert torch.isfinite(loss)
    loss.backward()
    assert any(p.grad is not None and torch.count_nonzero(p.grad) for p in model.parameters())
    print(f"PASS model: scaled C3 {original} -> {sizes}; parameters {previous} -> {actual}")
    print("PASS real YOLO forward, detection tensor, finite detection loss and backpropagation")
    print("Synthetic inputs validate code only; no recognition accuracy was measured")


if __name__ == "__main__":
    main()
