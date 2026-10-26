# 视觉模块使用说明

识别与控制逻辑见 [视觉模块说明](README.md)。本文保留模型细节、安装、数据准备、训练、推理与验证步骤；命令均在项目根目录执行。

## 1 网络版本与深度缩放

为使代码可以实际构建，本工程固定使用官方 YOLOv5 v7.0，以其标准 YOLOv5s 配置为基线，保留 `depth_multiple=0.33`、`width_multiple=0.50`、三尺度检测头和其他默认结构，只修改专利列出的四处 C3 名义重复次数，并设置两类输出。

YOLOv5 的 YAML 次数还会经过 `max(round(n × depth_multiple), 1)` 缩放。因此：

| 主干层 | 标准 YAML 次数 | 本工程 YAML 次数 | 标准实际次数 | 本工程实际次数 |
|---|---:|---:|---:|---:|
| 2 | 3 | 2 | 1 | 1 |
| 4 | 6 | 3 | 2 | 1 |
| 6 | 9 | 4 | 3 | 1 |
| 8 | 3 | 2 | 1 | 1 |

本工程按“修改标准 YAML 中的次数”解释资料，不将 YAML 名义次数直接说成实例化后的实际层数。资料没有给出原始 YAML、框架版本和完整训练超参数，所以这是一份可运行的方法实现，不能保证与历史工程逐参数相同。原文有一处“第 8 层……第 7 层 C3”表述，这里依据其余说明及标准网络中 C3 的位置使用第 8 层。

## 2 安装与初始化

推荐 Python 3.10–3.12，在工程根目录创建单独环境：

```bash
python -m venv .venv-yolo
source .venv-yolo/bin/activate
python -m pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r vision/requirements.txt
python vision/bootstrap.py
```

Windows PowerShell 的激活命令是 `.venv-yolo\Scripts\Activate.ps1`。上面的 PyTorch 命令用于 CPU；使用 GPU 时先安装适合本机驱动的 PyTorch 2.5.1 与 torchvision 0.20.1，然后安装本工程其余依赖。

`bootstrap.py` 从官方 v7.0 标签下载源码，核对固定 SHA256，将该工程依赖内的两处 Mosaic 调用切换到官方 `load_mosaic9`，并适配新版 Pillow 的文字边界 API。它不下载训练权重或数据集，不修改你电脑上其他 YOLO 工程。首次使用原框架绘图功能可能下载其默认字体。

## 3 数据准备

类别必须为 `0=alive`、`1=dormant`。原始图片和 LabelImg 导出的标注使用如下布局：

| 示例路径 | 内容 |
|---|---|
| `dataset/images/0001.jpg` | 原始种植图像 |
| `dataset/labels/0001.txt` | 对应标注 |
| `dataset/images/0002.jpg` | 下一张原始图像 |
| `dataset/labels/0002.txt` | 对应标注 |

每行标注是 `class x_center y_center width height`，后四列相对图像尺寸归一化到 0–1。真正的无目标图片使用空标注文件。

```bash
python vision/prepare_data.py --source dataset --output vision/data
```

脚本默认按原始图片划分 70% 训练、10% 验证、20% 测试，随机种子为 42。这是工程默认划分，未冒充论文的 800/300 划分；可用 `--val-fraction`、`--test-fraction` 调整。生成的是文件列表和 `vision/data/seedlings.yaml`，原图与标注不移动。

如果已有正确划分的 train/val/test，直接参照 `data.example.yaml` 填写数据绝对路径。保留独立测试集，用验证集选择模型。先划分原图，再只在训练加载过程中增强；这里不对独立测试集使用 Mosaic。连续视频帧、同一场景的近重复图片需按采集组划分，避免训练和测试重复。

## 4 训练与测试

```bash
python vision/train_model.py --data vision/data/seedlings.yaml --epochs 100 --batch 16 --device cpu
```

GPU 可将设备改为 `--device 0`。默认输入 640、SGD、学习率及其余常规超参数取固定版本的 `hyp.scratch-low.yaml`，Mosaic 概率为 1，MixUp 为 0。图像尺寸、batch 和这些数值是工程选型，资料未给出原训练的全部具体设置。

模型默认从随机初始化训练；用 `--weights /path/to/compatible.pt` 可以采用已有权重。结果写入 `vision/runs/simplify/`；重名时由框架递增目录，使用该次训练输出的实际路径。模型、日志和使用的超参数保存在运行目录。

训练后，使用独立测试集评估：

```bash
python vision/evaluate.py --data vision/data/seedlings.yaml --weights vision/runs/simplify/weights/best.pt --task test
```

代码会产生该数据和设备上的实际评估结果。资料中的 FPS、精度与召回率不作为本次实现的验收数值。

## 5 图像或摄像头推理

先对一张图片验证：

```bash
python vision/infer.py --weights vision/runs/simplify/weights/best.pt --source test.jpg
```

检测框图像保存为 `vision/runs/detection/latest.jpg`，逐帧统计追加到 `results.jsonl`。输出包含 alive 数、dormant 数、总数和发芽率。也支持图像目录、视频文件、本机摄像头编号或网络视频流。

读取摄像头并把结果送进之前的控制工程：

```bash
export PLANTER_API_KEY=YOUR_API_KEY
python vision/infer.py --weights vision/runs/simplify/weights/best.pt --source 0 --expected-total 20 --cloud-url http://127.0.0.1:8000
```

Windows PowerShell 使用 `$env:PLANTER_API_KEY="YOUR_API_KEY"`。保持[部署与联调说明](../USAGE.md)所述的云端与 SSH 转发可用。

摄像头默认每 2 秒检测一次，每 30 秒最多提交一次。`--expected-total 20` 表示画面应含 20 个目标：检测数量不符时仍显示结果，但跳过控制更新。它用于限制明显的漏检或重复计数，不保证每个框正确。若总目标为零，不提交“0%”或“100%”，保留未知状态。不同帧的检测数不会累加。

默认置信度 0.25、NMS IoU 0.45，并对两类使用类别无关 NMS，以减少同一位置同时保留 alive 和 dormant 框的情况；这是工程后处理设置，可通过阈值参数调整。上报接口使用实际检测的两类总数作为分母，预期总数只用于校验。

云端 HTTP 返回 `sent` 仅表示已发出更新，最终是否被 STM32 接受仍在控制网页的指令记录中查看。网络失败时本地识别继续，日志记录错误，不伪造上报成功。

## 6 软件验证

```bash
python tools/test.py
python vision/self_test.py
python tests/vision_pipeline_smoke.py
```

第一条包含类别计数、分母、空检测、总数校验、标注检查、数据集不交叉和云端请求测试。第二条在实际 PyTorch 与 YOLOv5 上构建基线及精简网络，检查真实 C3 次数、参数量、输出形状、检测损失和反向传播。第三条创建临时合成图片，训练一轮并验证保存、独立测试、加载与图像推理流程，结束后删除临时权重。

测试输入为合成数据，只用于验证程序。不把随机初始化权重的输出或小规模流程测试说成有效的蔬菜发芽识别模型。识别性能需要你的真实数据训练与独立测试。

## 7 源码与许可

- 网络与训练框架：[Ultralytics YOLOv5 v7.0](https://github.com/ultralytics/yolov5/tree/v7.0)。
- C3 解析：[models/yolo.py](https://github.com/ultralytics/yolov5/blob/v7.0/models/yolo.py)。
- Mosaic-9：[utils/dataloaders.py](https://github.com/ultralytics/yolov5/blob/v7.0/utils/dataloaders.py)。
- 原 YOLOv5 v7.0 源码遵循其 GPL-3.0 许可证；初始化时保留上游的 LICENSE 文件。
