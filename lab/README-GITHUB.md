# 青禾实验室：Mac 与 GitHub Pages

在线入口：<https://ysy-1148.github.io/smart-planter/>

使用 Mac 的 Safari 或 Chrome 打开在线入口，不需要在 Mac 安装 Python、C 编译器或启动本地服务。首页进入“从零开始”，再按需进入项目深读、接线实验和公司题库。

## 在线版包含什么

- 12 节入门引导、150 个专题、48 个项目深读专题。
- 45 个原理模型、15 个接线场景、12 个控制实验。
- 44 家公司、237 道题，汇川专项 65 道；保留来源和练习类型。
- 两份可下载、离线阅读和打印的完整手册。
- 原项目 C 控制核心被编译为 WebAssembly，在浏览器执行。控制规则、CRC 和协议帧沿用原 C；浏览器代码只负责模拟时间、输入、课程步骤与展示。

每个网页实例独立运行；专项对照实验另建独立 Wasm 实例，不重置主实验台。时间、传感器和接线仍为教学模拟，不执行 STM32 指令、HAL 或 FreeRTOS 内核，不能代替真实开发板测试。结构布局显示的是当前宿主/Wasm ABI，不是 ARM ABI 测量。

学习记录保存在当前浏览器，不会随 GitHub 登录同步到另一台电脑。可用页面的“导出入门记录”“导出学习记录”下载备份；当前没有自动跨设备同步或记录导入功能。

## Mac 本地完整运行（可选）

在线使用无需这些步骤。只有需要离线运行服务、修改源码时才使用：

1. 下载仓库 ZIP 并解压，或 `git clone https://github.com/YSY-1148/smart-planter.git`。
2. 准备 Python 3.10+。本机编译 C 时需要 Apple Command Line Tools，可在终端运行 `xcode-select --install` 安装。
3. 终端进入仓库目录，运行：

```sh
python3 lab/launch.py --study
```

也提供 `lab/start_today.command`。通过 Git clone 取得的脚本保留执行权限；ZIP 解压后如需要，可先用终端执行 `chmod +x lab/start_today.command`，再双击运行。

## 发布与验证

`.github/workflows/lab-pages.yml` 在 `qinghe-pages` 分支构建测试，在 `main` 分支通过测试后部署。仓库 Settings → Pages 的 Source 应设为 GitHub Actions。

构建过程使用 Clang/wasm-ld 编译同一份控制源码。`build_pages.py` 只导出网站资源及白名单源码，不复制 `.env`、`secrets.h`、日志、编译缓存和用户记录。`_site` 是生成目录，不提交到 Git。

在已安装 Clang、LLD、Python 和 Node 的开发机上：

```sh
npm install --prefix lab/.qa --no-audit --no-fund jsdom@26.1.0
python3 lab/build_pages.py --output _site
python3 lab/browser_fixtures.py
node lab/test_browser.cjs _site
```

验证包括：宿主原 C 与浏览器 Wasm 的状态、协议帧、观察点、回绕、CRC 错误、重复命令及全部课程步骤；同时检查 GitHub 仓库子路径下的页面资源、学习页与实验台初始化。DOM 测试不是浏览器截图或硬件实测。
