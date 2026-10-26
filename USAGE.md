# 部署与联调说明

系统逻辑见 [项目说明](README.md)。本文保留接线、编译、部署、接口及验证步骤；命令均在项目根目录执行。视觉模块的安装、训练与推理见 [视觉模块使用说明](vision/USAGE.md)。

## 1 接线

| STM32F407 引脚 | 连接对象 | 配置 |
|---|---|---|
| PB0 | DHT11 DATA | 开漏，外接约 4.7 kΩ 上拉到 3.3 V |
| PB8 | BH1750 SCL | I²C1，100 kHz |
| PB9 | BH1750 SDA | I²C1，地址 `0x23`，ADDR 接低 |
| PB1 | 液位检测信号 | 经电平转换后的 3.3 V 数字输入；1 为缺液，0 为足液 |
| PB6 | 补光灯驱动输入 | TIM4_CH1，1 kHz PWM，高电平有效 |
| PD12 | 风扇驱动输入 | GPIO，高电平开启 |
| PD13 | 滴灌水泵驱动输入 | GPIO，高电平开启 |
| PD14 | 喷雾水泵驱动输入 | GPIO，高电平开启 |
| PD15 | 补液水泵驱动输入 | GPIO，高电平开启 |
| PA2 / USART2_TX | ESP32 GPIO16 / UART2_RX | 115200，8N1 |
| PA3 / USART2_RX | ESP32 GPIO17 / UART2_TX | 115200，8N1 |
| GND | ESP32、传感器和驱动器 GND | 共地 |

BH1750 通过 I²C 读取照度，单位为 lux。SCL、SDA 上拉到 3.3 V；模块已有上拉时按其电路确认。这里不把 BH1750 当作 ADC 模拟传感器。

液位采用与论文思路一致的数字阈值信号，可连接经过适配的 XKC-Y25。先确认具体输出型号、极性及电压，再接入 PB1。一个开关量只能表示检测点是否有液体，不能得到“剩余液量百分比”，也不能可靠区分缺液与信号断线。

灯、风扇和水泵接驱动板与独立负载电源；STM32 GPIO 连接驱动板逻辑输入。按本工程的有效电平使用 MOSFET 驱动或相应继电器模块，设置输入下拉，直流感性负载配续流保护。补液泵从独立储备容器向营养液箱补液。Discovery 板上的 PD12–PD15 同时连接板载 LED，可用来观察逻辑状态。

## 2 首次部署云端

以下命令均在工程根目录执行。云服务器或联调电脑需要 Python 3.10+、OpenSSL、Docker 以及 Docker Compose。正式联网时，`--host` 填 ESP32 能访问的服务器域名或 IP；局域网联调时可填服务端内网 IP。

```bash
python3 tools/provision.py --host YOUR_SERVER_HOST
docker compose -f cloud/compose.yaml --env-file cloud/.env up -d --build
docker compose -f cloud/compose.yaml --env-file cloud/.env logs -f
```

初始化会生成：

- `cloud/.env`：设备账号密码、云端账号密码和网页 API 密钥。
- `cloud/mosquitto/certs/`：MQTT 服务端证书和 CA 公钥证书。
- `cloud/private/`：CA 私钥和签发所需文件。
- `esp32/include/secrets.h`：设备连接参数及 CA 公钥证书。

已有配置时脚本会停止，避免覆盖正在使用的证书和账号。Docker 需要能够拉取镜像。证书由本工程的私有 CA 签发，ESP32 和云端校验服务器证书，未使用 `setInsecure()`。

服务器开放 MQTT TCP 8883。网页服务默认只映射服务器本机 `127.0.0.1:8000`，在自己的电脑通过 SSH 转发访问：

```bash
ssh -N -L 8000:127.0.0.1:8000 YOUR_USER@YOUR_SERVER_HOST
```

随后打开 `http://127.0.0.1:8000`，输入 `cloud/.env` 中的 `API_KEY`。同一台电脑部署时直接打开即可。查看网页状态和历史、修改参数或下发指令都需要该密钥。

云端保存到 Compose 命名卷 `app_data`，MQTT 持久化数据保存到 `mqtt_data`。`docker compose down` 不删除这些卷；备份时保留 SQLite 文件或整个卷。

## 3 编译与烧录 STM32

在安装了 Python 的开发电脑上安装 PlatformIO，或者使用 VS Code 的 PlatformIO 扩展：

```bash
python -m pip install platformio==6.1.18
python -m platformio run -d stm32
python -m platformio run -d stm32 -t upload
```

连接 Discovery 的 ST-Link USB 口。首次构建会下载 STM32Cube HAL、ARM 工具链和 FreeRTOS Kernel V11.1.0，FreeRTOS ZIP 使用固定 SHA256 校验。

固件入口为 `stm32/src/main.c`。时钟使用 HSI + PLL 配置为 168 MHz，因此这里没有依赖你板上晶振的具体频率。换到其他 STM32 型号时要修改板卡配置、时钟、外设和 DMA 映射；不能把本工程直接当成 F103 的固件烧录。

## 4 配置并烧录 ESP32

将云端生成的 `esp32/include/secrets.h` 复制到开发电脑的相同位置，填写其中的 `WIFI_SSID` 与 `WIFI_PASSWORD`。ESP32-WROOM 使用 2.4 GHz Wi-Fi，`MQTT_HOST` 必须与证书中的服务器域名或 IP 一致。

```bash
python -m platformio run -d esp32
python -m platformio run -d esp32 -t upload
python -m platformio device monitor -d esp32
```

未生成 `secrets.h` 时，工程使用 `secrets.example.h` 以便编译检查；示例中的占位凭证不能连接真实服务。ESP32 先同步网络时间，再建立 TLS 连接。串口监视器出现 `MQTT connected` 后，在网页检查数据。

ESP32 的串口收发使用独立 FreeRTOS 任务，MQTT 的连接尝试在 Arduino `loop()` 中执行，不阻塞串口接收任务。上报数据暂存最新一条；断网后旧采样会被覆盖，重连后恢复最新数据上报，不补传完整断网历史。当前 PubSubClient 上报与 ACK 使用 QoS 0，云端下行使用 QoS 1；不能将其描述为每条数据必达。

## 5 MQTT 主题和 HTTP 接口

默认设备编号为 `planter-001`，初始化脚本支持修改。设备与云端使用独立账号，ACL 限制到该设备的主题。

| 主题 | 方向 | 用途 |
|---|---|---|
| `planter/planter-001/telemetry` | ESP32 → 云端 | 温湿度、照度、液位、输出、告警 |
| `planter/planter-001/command` | 云端 → ESP32 | 参数、手动模式、自动模式、发芽率 |
| `planter/planter-001/ack` | STM32 经 ESP32 → 云端 | 控制器确认或网关错误 |
| `planter/planter-001/status` | ESP32 → 云端 | 网关在线状态与遗嘱 |

网页 API 通过 `Authorization: Bearer YOUR_API_KEY` 验证。

| 接口 | 用途 |
|---|---|
| `GET /api/state` | 最新状态、连接情况、最近指令 |
| `GET /api/history?limit=120` | 最近采样，最多 1000 条 |
| `POST /api/command` | 参数设置或手动控制 |
| `POST /api/germination` | 提交识别计数 |
| `GET /health` | HTTP 存活与 MQTT 连接状态 |

下发参数，温度和湿度使用十分之一单位，照度使用 lux：

```json
{"op":"config","args":[280,260,500,700,10000,800]}
```

顺序为：开风扇温度、关风扇温度、补水开启湿度、补水停止湿度、目标光照、喷雾切换发芽率。

手动设置灯光 30%、风扇开，水泵全关，持续 10 秒：

```json
{"op":"manual","args":[30,1,0,0,0,10000]}
```

顺序为：灯光百分比、风扇、滴灌、喷雾、补液、持续毫秒。返回自动模式：`{"op":"auto"}`。清除补液超时：`{"op":"clear_fault"}`。

## 6 没有硬件时先验证云端

先启动云端，再在能访问 MQTT 的电脑上安装依赖并运行模拟器。模拟器使用与 STM32 相同的 `common/planter.c`，传感器输入是合成数据，不驱动真实外设。

```bash
python3 -m pip install -r cloud/requirements.txt
python3 tools/simulate_device.py --host YOUR_SERVER_HOST
```

模拟器需要 GCC 或 Clang、本设备的 `cloud/.env` 及 CA 公钥证书。若这些文件在别处，用 `--env` 和 `--ca` 指定路径。模拟同一编号时先停止真实设备的 ESP32，避免两份状态混入同一设备。

可通过 `--humidity 45 --temp 30` 模拟低湿高温，通过 `--water-low` 观察补液超时。网页会标识模拟数据。按 Ctrl+C 退出。

## 7 验证与实机联调

执行无需硬件或 MQTT 服务的测试：

```bash
python3 tools/test.py
```

测试包括 CRC、损坏帧与丢字节恢复、湿度联动、泵时长与冷却、缺液、补液超时锁定、重复指令、过期指令、启动编号匹配、手动租期、计时器回绕，以及云端校验、鉴权、落库、指令确认和 HTTP 接口。

测试使用真实 C 控制代码；云端单元测试中的 MQTT 发布器为测试替身。测试通过不等于硬件已完成联调，实际接线、电平、泵流量、DHT11 波形和云服务器网络仍需在实机确认。具体构建与验证结果见 `VALIDATION.md`。

本机装有 Mosquitto、`mosquitto_passwd` 和 OpenSSL 时，还可以运行真实 TLS MQTT 集成测试：

```bash
python3 -m pip install -r cloud/requirements.txt
python3 tests/integration_mqtt.py
```

该测试启动临时 Broker 与原生 C 模拟器，验证云端存储、HTTP 下发、控制确认、手动到期、发芽率回传和离线状态，不操作真实硬件。

实机建议按以下顺序：

1. 先观察温湿度、lux 和液位输入，暂不连接负载电源。
2. 用板载 LED 与示波器检查各路 GPIO 和 PB6 PWM。
3. 接 ESP32，在网页确认数据及手动指令返回。
4. 分别接入风扇、补光和各路泵，校准单次流量。
5. 验证缺液、补液超时、断网运行、重复指令和重启。
6. 接入真实发芽识别结果，验证滴灌和喷雾切换。

## 8 官方参考

- [PlatformIO STM32F4 Discovery 板卡](https://docs.platformio.org/en/stable/boards/ststm32/disco_f407vg.html)
- [ST STM32Cube 与 RTOS 开发手册](https://www.st.com/resource/en/user_manual/dm00105262-developing-applications-on-stm32cube-with-rtos-stmicroelectronics.pdf)
- [FreeRTOS Kernel V11.1.0](https://github.com/FreeRTOS/FreeRTOS-Kernel/releases/tag/V11.1.0)
- [PubSubClient API](https://pubsubclient.knolleary.net/api)
- [Paho MQTT Python API](https://eclipse.dev/paho/files/paho.mqtt.python/html/client.html)
- [Mosquitto 配置](https://mosquitto.org/man/mosquitto-conf-5.html)

各第三方依赖遵循其原有许可证；本工程不包含你的原始训练权重。
