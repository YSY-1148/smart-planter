/* Original teaching assets, 76–150. Shared models illustrate principles; paper/code exercises are marked explicitly. */
window.CurriculumSystems = [
  {
    "id": 76,
    "title": "I²C 开漏、上拉与公共地",
    "chapter": "06 · 传感器与工业通信",
    "model": "i2c",
    "bench": "i2c",
    "summary": "先把 BH1750 接成一条能被双方控制的总线，再讨论读到了什么。",
    "principles": [
      "开漏输出只能主动拉低，释放后的高电平来自上拉；这样主机释放 SDA 后，传感器可以在应答拍把线拉低。",
      "两根线都有时序职责：SCL 提供时钟，SDA 承载地址、数据和应答；接错两根线不是简单地交换两个变量名。",
      "项目把 PB8、PB9 配成 AF4 复用开漏。板载模块、电源地与探头参考地都要接通，程序有效位才有实际意义。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "gpio(GPIOB,GPIO_PIN_8|GPIO_PIN_9"
    },
    "steps": [
      {
        "action": "连接模块 VCC、GND、PB8→SCL、PB9→SDA，最后连接两支探头。",
        "expect": "SCL 与 SDA 分别出现在两个通道；接好示波器地夹才有参考电位。"
      },
      {
        "action": "拆开 SDA 连接，保持供电和 SCL。",
        "expect": "主机仍可尝试发时钟，但不会获得正常数据；先修复连接，不改控制阈值。"
      }
    ],
    "quiz": {
      "q": "开漏写 1 是直接推到 3.3 V 吗？",
      "a": "不是，它释放下拉管，实际电压还由上拉、负载和其他器件决定。"
    },
    "questions": [
      10,
      24,
      113
    ],
    "course": "江协 I²C 基础 → 项目 BH1750",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "ROHM · BH1750 数据手册（厂商文档镜像）",
        "url": "https://www.wemos.cc/en/latest/_static/files/bh1750fvi-tr.pdf"
      }
    ],
    "preset": {
      "raw": 12000,
      "nack": false
    }
  },
  {
    "id": 77,
    "title": "七位地址、读写位与第九拍 ACK",
    "chapter": "06 · 传感器与工业通信",
    "model": "i2c",
    "bench": "i2c",
    "summary": "沿着示波器波形拆开 0x23、0x46 和 0x47，避免地址左移两次。",
    "principles": [
      "设备地址 0x23 是七位值；在总线地址字节中左移一位，最低位填读写方向，所以写字节为 0x46，读字节为 0x47。",
      "每发送八位后要释放 SDA 给接收方应答。ACK 表示这一字节被应答，不代表上层测量一定准确或执行器一定动作。",
      "BH1750 的 ADDR 电平改变地址选择；软件仍访问旧地址时，应先检查地址拍，而不是继续解释后续数据字节。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "HAL_I2C_Master_Transmit(&i2c,0x23<<1,&on"
    },
    "steps": [
      {
        "action": "ADDR 接地运行，数地址字节后的第九个时钟。",
        "expect": "地址 0x23 对应的器件应答，随后才能继续命令或数据阶段。"
      },
      {
        "action": "把 ADDR 从地改接 3.3 V，保持程序地址不变。",
        "expect": "本地址没有预期应答；恢复 ADDR 或统一软件地址后再重试。"
      }
    ],
    "quiz": {
      "q": "HAL 参数 0x46 与线上读地址 0x47 冲突吗？",
      "a": "不冲突；HAL 接口的地址表示与总线读写位组合需要按该库约定理解。"
    },
    "questions": [
      10,
      113
    ],
    "course": "江协 I²C 地址与应答 → HAL 参数",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "ROHM · BH1750 数据手册（厂商文档镜像）",
        "url": "https://www.wemos.cc/en/latest/_static/files/bh1750fvi-tr.pdf"
      }
    ],
    "preset": {
      "raw": 12000,
      "nack": false
    }
  },
  {
    "id": 78,
    "title": "BH1750 初始化、转换等待与整数换算",
    "chapter": "06 · 传感器与工业通信",
    "model": "i2c",
    "bench": "i2c",
    "summary": "把一次函数调用展开为上电、设模式、等待、收字节和提交样本。",
    "principles": [
      "项目首次读数先发送上电命令和连续高分辨率模式，再等待 180 ms；器件接好线不意味着刚上电就已有新测量结果。",
      "两个接收字节先拼成无符号 16 位原始数，再用 raw×10÷12 换算 lux；整数除法舍去小数，不是传感器精度突然变高。",
      "读取失败时 bh_ready 被清除，后续会重新初始化；采样层用 SENSOR_LIGHT 区分失败与真正读到零光照。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "*lux=(((uint32_t)raw[0]<<8)|raw[1])*10u/12u;"
    },
    "steps": [
      {
        "action": "把原始计数设为 12000，逐步走到高低字节拼接。",
        "expect": "0x2EE0 组合为 12000，换算得到 10000 lx。"
      },
      {
        "action": "改成 12001，再开启地址无应答注入。",
        "expect": "整数换算仍为 10000；无应答则走失败路径，而不是提交一个新的零值。"
      }
    ],
    "quiz": {
      "q": "为什么不能在每轮控制中直接增加补光？",
      "a": "采样和控制周期不同；种菜机只在新的光照样本到来时调整一次 PWM。"
    },
    "questions": [
      10,
      28,
      86
    ],
    "course": "江协 I²C 读寄存器思路 → 项目传感器驱动",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ROHM · BH1750 数据手册（厂商文档镜像）",
        "url": "https://www.wemos.cc/en/latest/_static/files/bh1750fvi-tr.pdf"
      }
    ],
    "preset": {
      "raw": 12000,
      "nack": false
    }
  },
  {
    "id": 79,
    "title": "DHT11 脉宽、超时与校验",
    "chapter": "06 · 传感器与工业通信",
    "model": "dht",
    "bench": "dht",
    "summary": "从 PB0 波形推导一个字节，确认测量失败不会被当作有效温湿度。",
    "principles": [
      "主机先拉低约 20 ms，再释放开漏输出等待传感器响应。数据不是 UART 字节流，而是由高脉宽表达的逐位序列。",
      "代码以 width>45 μs 判 1，先左移再或入位值；45 与 46 正好跨过软件判决边界，应该专门验证。",
      "每个等待都有超时，五字节还要进行求和校验。临界区保护时序但会推迟部分中断，不能把它无限延长来解决所有问题。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "b[i/8]=(uint8_t)((b[i/8]<<1)|(width>45u));"
    },
    "steps": [
      {
        "action": "完成供电、PB0 数据及外部上拉连接，选择第 0 位，依次设宽度 45 和 46 μs。",
        "expect": "解码位从 0 变 1，原示例帧校验可能失败；位边界与校验结果是两层判断。"
      },
      {
        "action": "把该位高脉宽设为 120 μs，再把时基切到 5 ms/div 看启动阶段。",
        "expect": "数据阶段进入超时分支；启动低脉冲需要毫秒级窗口才能看完整。"
      }
    ],
    "quiz": {
      "q": "校验通过是否证明温度真实准确？",
      "a": "不能；它只提供有限的传输差错检测，还要考虑量程、测量误差和样本年龄。"
    },
    "questions": [
      10,
      33,
      43,
      86,
      94
    ],
    "course": "GPIO 与定时基础 → 项目 DHT11 拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "bit": 0,
      "width": 28
    }
  },
  {
    "id": 80,
    "title": "SPI 的 CPOL、CPHA 与采样沿",
    "chapter": "06 · 传感器与工业通信",
    "model": "spi",
    "bench": "spi",
    "summary": "明确时钟空闲电平和采样时刻，先还原一字节再读设备命令。",
    "principles": [
      "CPOL 定义 SCK 空闲电平，CPHA 决定在每位的第一个还是第二个有效边沿采样；只记“上升沿采样”会漏掉不同空闲极性。",
      "发送端通常在另一边沿改变数据，为接收端留下建立和保持时间；示波器先看片选有效窗口，再把采样沿叠加到数据上。",
      "本种菜机使用 UART 连接双 MCU，未使用 SPI 网关；本课是江协 SPI 和面试通信选型的独立拓展，不改现有协议。"
    ],
    "code": {
      "file": "教学/spi_edges.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned cpol=0, cpha=0;\nunsigned leading_is_rising=(cpol==0);\nunsigned sample_on_leading=(cpha==0);\nunsigned sample_is_rising=sample_on_leading?leading_is_rising:!leading_is_rising;"
    },
    "steps": [
      {
        "action": "把发送字节设为 165（0xA5）、模式设为 0，单步按采样沿记录八位。",
        "expect": "从高位到低位还原为 0xA5；模型显示该模式的空闲电平和采样边沿。"
      },
      {
        "action": "把统一工作模式依次改为 1、2、3，比较 CPOL/CPHA；再纸上推导主从模式不一致的情况。",
        "expect": "四种模式的边沿含义可直接比较；模型没有独立收发相位或模拟建立保持时间，失配错误率属于纸上分析。"
      }
    ],
    "quiz": {
      "q": "SPI 全双工意味着读操作不用发数据吗？",
      "a": "通常仍需主机发出时钟，常用无意义发送字节换取从机数据。"
    },
    "questions": [
      11,
      24,
      39,
      112
    ],
    "course": "江协 SPI 基本时序 / 岗位拓展",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "a": 165,
      "b": 0
    }
  },
  {
    "id": 81,
    "title": "SPI Flash：片选、命令、地址与忙状态",
    "chapter": "06 · 传感器与工业通信",
    "model": "spi",
    "bench": "spi",
    "summary": "把 Flash 访问看成有状态的事务，而不是往一个内存地址直接赋值。",
    "principles": [
      "常见串行 Flash 事务由片选包围命令、地址和数据，具体命令码、地址长度及模式必须按所选器件手册确认。",
      "写入可能需要写使能，并受页边界、擦除粒度和忙状态约束；SPI 已发完与 Flash 已完成内部编程不是同一个时刻。",
      "项目尚未使用外部 SPI Flash。本课用于理解通信事务与存储状态机，不能把示例假设当成所有 Flash 芯片的统一接口。"
    ],
    "code": {
      "file": "教学/flash_transaction.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum State { IDLE, WRITE_ENABLE, PROGRAM, WAIT_BUSY, VERIFY };\nenum State state=WRITE_ENABLE;\nint busy=1, verified=0;\nif (state==WRITE_ENABLE) state=PROGRAM;\nif (state==PROGRAM) state=WAIT_BUSY;\nif (state==WAIT_BUSY && !busy) state=VERIFY;\nif (state==VERIFY && verified) state=IDLE;"
    },
    "steps": [
      {
        "action": "纸上画出写使能→写入→查忙→读回的片选窗口，按教学片段执行状态转移。",
        "expect": "WAIT_BUSY 不会因 SPI 发送完成直接跳过；本页可运行 SPI 模型只展示字节移位，不实现 Flash 忙状态。"
      },
      {
        "action": "在纸上让 busy 永不清除，为状态机增加超时退出，再用 SPI 模型核对单字节时钟。",
        "expect": "设计应报告失败并保留旧有效配置；这项练习审查状态机，不宣称写入了真实或完整仿真的 Flash。"
      }
    ],
    "quiz": {
      "q": "为什么写完后还需要读回或校验？",
      "a": "总线发送成功不能证明存储内容正确，也不能覆盖地址、边界与供电中断等错误。"
    },
    "questions": [
      11,
      112,
      142,
      143
    ],
    "course": "江协 SPI / Flash 思路 → 存储拓展",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 82,
    "title": "Modbus RTU：字符时间与帧边界",
    "chapter": "06 · 传感器与工业通信",
    "model": "modbus",
    "bench": null,
    "summary": "把空闲间隔、CRC 和功能码长度同时用起来，避免把 UART IDLE 当成完整协议。",
    "principles": [
      "RTU 以串行字符间隔识别帧边界，帧内异常停顿与帧间间隔承担不同职责；仍需检查地址、功能码、长度和 CRC。",
      "按规范常用的十一位字符计算，9600 bit/s 时一字符约 1.146 ms，3.5 字符约 4.01 ms；不能直接套用本项目的 8N1 十位格式。",
      "高波特率时规范给出固定定时建议。当前种菜机是自定义 A5 5A 固定长度帧，不是 Modbus，移植时必须另建协议层。"
    ],
    "code": {
      "file": "教学/modbus_gap.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\ndouble baud=9600.0;\ndouble character_us=11e6/baud;\ndouble t15_us=1.5*character_us;\ndouble t35_us=3.5*character_us;\n/* 高于19200时按规范建议另选固定定时，不能盲目缩短。 */"
    },
    "steps": [
      {
        "action": "将波特率设为 9600，静默间隔先设 4000 μs，再改为 4100 μs，单步比较帧间隔判定。",
        "expect": "十一位字符下 t3.5 约 4010.4 μs，4000 未达到，4100 达到；边界判定本身不证明 CRC 或帧内容合法。"
      },
      {
        "action": "纸上计算 t1.5，并把一帧分成两批 DMA 输入；再把模型波特率改为 38400、间隔改为 1750 μs。",
        "expect": "高波特率采用规范建议的固定 t3.5；DMA 分批与协议边界分开，帧内异常间隔仍需接收状态机处理。"
      }
    ],
    "quiz": {
      "q": "收到一次串口空闲事件就能确认 Modbus 帧正确吗？",
      "a": "不能；事件只是时序线索，仍需字符间隔规则、结构校验和 CRC。"
    },
    "questions": [
      79,
      95,
      114
    ],
    "course": "UART 基础之后的工业通信拓展",
    "sources": [
      {
        "title": "Modbus Organization · Serial Line V1.02",
        "url": "https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf"
      }
    ],
    "preset": {
      "a": 9600,
      "b": 4000
    }
  },
  {
    "id": 83,
    "title": "RS-485：DE 方向控制与最后停止位",
    "chapter": "06 · 传感器与工业通信",
    "model": "modbus",
    "bench": null,
    "summary": "区分数据进入发送寄存器、DMA 搬完与总线真正发送完成。",
    "principles": [
      "半双工收发器用 DE 控制是否驱动总线。两个节点同时驱动会形成冲突，应用协议必须安排谁何时发送。",
      "DMA 传输完成通常只表示最后数据已送往外设，不保证串行移位寄存器发完最后停止位；过早撤销 DE 会截断帧尾。",
      "项目当前使用 3.3 V UART 直连 ESP32，未接 RS-485 收发器；真实增加收发器还需核对终端、偏置、参考地和器件延迟。"
    ],
    "code": {
      "file": "教学/rs485_de.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nint de=1;\nint dma_done=1, uart_tc=0;\n/* DMA完成后继续等待串口TC，时间线模型不操作真实引脚。 */\nif (dma_done && uart_tc) de=0;"
    },
    "steps": [
      {
        "action": "纸上画 DMA 完成、UART TC 和 DE 三条时间线，先假设在 DMA 完成时撤销 DE。",
        "expect": "最后一个字节可能尚未完全离开发送端；下方模型仅计算 RTU 静默间隔，不显示 DE 引脚。"
      },
      {
        "action": "按教学片段把撤销条件改为 UART TC，再在纸上加入收发器关闭延迟。",
        "expect": "帧尾发完后才允许对端响应；真实引脚时序需选定收发器与示波器测量验证。"
      }
    ],
    "quiz": {
      "q": "TXE 与 TC 能互换使用吗？",
      "a": "不能；TXE 是发送数据寄存器可接收新数据，TC 才对应发送链路完成条件。"
    },
    "questions": [
      24,
      99,
      115
    ],
    "course": "USART 发送原理 → RS-485 拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "Modbus Organization · Serial Line V1.02",
        "url": "https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 84,
    "title": "CAN：显性位、仲裁与消息优先级",
    "chapter": "06 · 传感器与工业通信",
    "model": "can",
    "bench": null,
    "summary": "两个节点一起开始发送时，观察谁在仲裁阶段退出。",
    "principles": [
      "CAN 总线以显性与隐性状态实现无破坏仲裁；发送隐性却读到显性的节点退出竞争，随后等待下一次机会。",
      "在同格式数据帧之间比较时，仲裁字段较小的标识符通常更高优先级；不能把所有标准帧、扩展帧和远程帧混成简单整数比较。",
      "仲裁失败是正常竞争结果，不应直接当作发送错误累计；高优先级流量过密则会延迟低优先级消息，需要预算最坏等待。"
    ],
    "code": {
      "file": "教学/can_arbitration.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned id_a=0x100, id_b=0x200;\nint active_a=1, active_b=1;\nfor (int bit=10; bit>=0 && active_a && active_b; --bit) {\n    unsigned a=(id_a>>bit)&1, b=(id_b>>bit)&1;\n    unsigned bus=a&b; /* 0为显性，双方同格式数据帧 */\n    if (a!=bus) active_a=0;\n    if (b!=bus) active_b=0;\n}"
    },
    "steps": [
      {
        "action": "令两个标准数据帧 ID 为 0x100 与 0x200，逐位比较第一个不同位。",
        "expect": "0x100 对应的帧保留发送权，另一个节点停止本次发送。"
      },
      {
        "action": "纸上持续加入高优先级帧，画出低优先级帧等待时间；下方模型分别输入两组 ID 验证每次仲裁。",
        "expect": "同格式两节点仲裁能直接观察；连续总线负载与截止时间是扩展分析，模型没有流量发生器。"
      }
    ],
    "quiz": {
      "q": "仲裁失败需要立即复位控制器吗？",
      "a": "不需要；它通常是协议正常行为，应与错误帧、无 ACK 和 Bus-Off 分开统计。"
    },
    "questions": [
      116,
      119,
      158
    ],
    "course": "江协 CAN 专题思路 / 本项目未使用",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "ST · CAN FD 协议与 FDCAN 概述",
        "url": "https://www.st.com/content/st_com/en/technical-documents/an5348-introduction-to-fdcan-peripherals-for-stm32-mcus-stmicroelectronics_asset/chunk-001-topic-an5348-can-fd-protocol-overview.html"
      }
    ],
    "preset": {
      "a": 256,
      "b": 512
    }
  },
  {
    "id": 85,
    "title": "CAN 错误计数、Bus-Off 与恢复条件",
    "chapter": "06 · 传感器与工业通信",
    "model": "can",
    "bench": null,
    "summary": "沿着“线路故障→错误状态→恢复策略”分析，避免反复重启掩盖根因。",
    "principles": [
      "错误计数与错误主动、错误被动及 Bus-Off 状态有关；无 ACK、位时序不匹配、布线和干扰都可能影响错误演化。",
      "Bus-Off 是节点退出总线参与的保护状态，恢复要满足控制器和协议条件；程序重试策略还要考虑是否会再次冲击系统。",
      "应记录错误类型、计数变化和当时负载。单纯看“发不出去”无法区分仲裁等待、接收过滤、物理线路和协议错误。"
    ],
    "code": {
      "file": "教学/can_recovery.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum Mode { NORMAL, BUS_OFF, WAIT_RECOVERY };\nenum Mode mode=BUS_OFF;\nint physical_fault_fixed=0, recovery_condition=0;\nif (mode==BUS_OFF) mode=WAIT_RECOVERY;\nif (mode==WAIT_RECOVERY && physical_fault_fixed && recovery_condition)\n    mode=NORMAL;"
    },
    "steps": [
      {
        "action": "纸上按教学片段把 mode 设为 BUS_OFF，保持物理故障条件未修复，分析反复恢复请求。",
        "expect": "可能恢复后再次退出，需消除故障并限制重试；本页 CAN 模型只演示标准数据帧 ID 仲裁。"
      },
      {
        "action": "列出恢复前后应采集的错误计数、最后错误、供电与负载，再用两个 ID 运行仲裁对照。",
        "expect": "能区分正常仲裁退出与错误保护状态；当前模型没有 TEC/REC 演化或 Bus-Off 注入功能。"
      }
    ],
    "quiz": {
      "q": "没有其他节点 ACK 一定是接收过滤器设置错吗？",
      "a": "不能这样推断；先核对是否有正常节点、位速率、布线、供电和控制器模式。"
    },
    "questions": [
      116,
      117,
      149
    ],
    "course": "CAN 工业通信故障分析拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "ST · CAN FD 协议与 FDCAN 概述",
        "url": "https://www.st.com/content/st_com/en/technical-documents/an5348-introduction-to-fdcan-peripherals-for-stm32-mcus-stmicroelectronics_asset/chunk-001-topic-an5348-can-fd-protocol-overview.html"
      }
    ],
    "preset": {}
  },
  {
    "id": 86,
    "title": "CAN 位时序、CAN FD 与分包重组",
    "chapter": "06 · 传感器与工业通信",
    "model": "can",
    "bench": null,
    "summary": "从时间量子推导采样点，再区分物理帧能力与应用层长消息。",
    "principles": [
      "位时间由同步段与 BS1、BS2 构成：bitrate=fCAN/[BRP·(1+BS1+BS2)]，采样点=(1+BS1)/(1+BS1+BS2)。42 MHz、BRP=6、BS1=10、BS2=3 得到 500 kbit/s、78.6%；同步跳转宽度还需独立设置并满足手册约束。",
      "STM32F407 的 bxCAN 属于经典 CAN，不能仅修改数据长度就变成 CAN FD。混合网络须核对控制器能力及对 FD 帧的行为。",
      "本课自定义三片协议每片恰好八字节、序号为 0/1/2；片 0 建立接收状态和消息标识，后续必须同标识且序号连续，满 24 字节才交付。丢片、错序或超时回到空闲，不能拼接不同消息；这不是 ISO-TP 或 CAN FD 的标准实现。"
    ],
    "code": {
      "file": "教学/can_three_fragments.c",
      "text": "/* 独立教学：自定义3片×8字节，入口已完成帧校验，辅助函数另定义。 */\nenum { IDLE, RECEIVING } state=IDLE;\nunsigned msg_id,next,start; unsigned char data[24];\nvoid timeout_tick(unsigned now) { if(state==RECEIVING && now-start>=100u) state=IDLE; }\nvoid fragment(unsigned id,unsigned seq,const unsigned char *p,unsigned len,unsigned now) {\n    timeout_tick(now);\n    if(seq==0) { state=RECEIVING; msg_id=id; next=0; start=now; }\n    if(state!=RECEIVING || id!=msg_id || seq!=next || len!=8) { state=IDLE; return; }\n    copy_bytes(data+next*8,p,8); ++next;\n    if(next==3) { deliver(data,24); state=IDLE; }\n}\n/* now单位ms；即使没有新帧也必须周期调用timeout_tick。 */"
    },
    "steps": [
      {
        "action": "纸上计算 42 MHz、分频 6、BS1=10、BS2=3 的位速率和采样点，再保持总 tq 不变移动分段。",
        "expect": "得到 500 kbit/s、采样点约 78.6%；下方模型仅用 0x123 与 0x120 展示仲裁，不计算控制器位时序。"
      },
      {
        "action": "纸上按教学片段送入 id=7、seq=0/1/2，再分别改为 0/2、混入 id=8、最后在片 0 后静默 100 ms。",
        "expect": "正常序列仅在第三片交付 24 字节；错序/换标识清空接收状态，定期超时检查回到 IDLE。下方 CAN 模型仍只演示仲裁。"
      }
    ],
    "quiz": {
      "q": "CAN FD 控制器能收经典 CAN，就表示经典控制器也能处理 FD 帧吗？",
      "a": "不表示对称兼容；必须按控制器与网络模式验证，F407 不具备 FDCAN 外设。"
    },
    "questions": [
      118,
      119,
      120,
      158
    ],
    "course": "CAN 位时序与应用协议拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "ST · CAN FD 协议与 FDCAN 概述",
        "url": "https://www.st.com/content/st_com/en/technical-documents/an5348-introduction-to-fdcan-peripherals-for-stm32-mcus-stmicroelectronics_asset/chunk-001-topic-an5348-can-fd-protocol-overview.html"
      }
    ],
    "preset": {
      "a": 291,
      "b": 288
    }
  },
  {
    "id": 87,
    "title": "DMA 源、目的、宽度与通道映射",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "dma",
    "bench": "dma",
    "summary": "从 USART2 接收请求一路追到 SRAM 地址，明确是谁搬、搬多大、地址是否递增。",
    "principles": [
      "DMA 不理解温湿度或命令，它按配置响应外设请求搬运数据；源地址、目的地址、传输方向和数据宽度必须相互匹配。",
      "本项目 USART2 RX 使用 DMA1 Stream5 / Channel4，外设地址固定，内存地址递增，单位为字节，容量 512。",
      "DMA 的硬件优先级、NVIC 中断优先级和 FreeRTOS 任务优先级属于不同机制，不能把 HIGH 当成统一调度等级。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "rx_dma.Init.Direction=DMA_PERIPH_TO_MEMORY"
    },
    "steps": [
      {
        "action": "接通 ESP32 TX17→PA3、供电与共地，再单步看一个字节进入内存。",
        "expect": "外设地址保持不变，内存写位置向前移动，CPU 不需要逐字节执行 memcpy。"
      },
      {
        "action": "把接收数量设为 12，观察起点 506 跨过 511。",
        "expect": "循环模式回到下标 0，数据宽度仍是一字节，不能把 NDTR 当成剩余字节以外的任意单位。"
      }
    ],
    "quiz": {
      "q": "DMA 配好以后 CPU 就不需要管接收了吗？",
      "a": "仍需及时消费、维护所有权、解析协议并处理错误；DMA 只承担搬运。"
    },
    "questions": [
      95,
      106
    ],
    "course": "江协 DMA 基础 → USART 循环接收",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "count": 12
    }
  },
  {
    "id": 88,
    "title": "NDTR、写指针与环形回绕",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "dma",
    "bench": "dma",
    "summary": "用一次跨越数组末尾的接收，推导 written 与 rx_pos 的含义。",
    "principles": [
      "NDTR 描述当前配置传输单位的剩余数量，项目用缓冲容量减去它获得写入位置；循环重载时还要把末尾位置归一到零。",
      "写指针指向下一次写入位置，读指针指向下一次消费位置；环形可读数量需要按容量取模，不能直接做有符号差。",
      "读取指针是瞬间快照，DMA 仍在运行。边界设计必须结合快照一致性和消费速度，不能只凭一次调试窗口截图判断全部历史。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "uint16_t written=(uint16_t)(sizeof(rx_data)-__HAL_DMA_GET_COUNTER(&rx_dma));"
    },
    "steps": [
      {
        "action": "从读写位置 506 开始接收 6 个字节，记下回绕后的 written。",
        "expect": "位置归一为 0，模 512 的差仍表示已接收 6 个未读字节。"
      },
      {
        "action": "接收 12 个字节后单步读取一个字节。",
        "expect": "written 为 6，rx_pos 从 506 前进到 507，读写各自表示不同的下一位置。"
      }
    ],
    "quiz": {
      "q": "NDTR 变大是否一定意味着数据被清空？",
      "a": "循环重载本来就会增大 NDTR；缓冲内容和未消费历史要另外跟踪。"
    },
    "questions": [
      87,
      95,
      151
    ],
    "course": "江协 DMA 循环模式 → 项目读指针",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "count": 12
    }
  },
  {
    "id": 89,
    "title": "DMA 满一圈：相等不总是空",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "dma",
    "bench": "dma",
    "summary": "复现当前代码真正存在的边界：写满 512 字节后位置相等，未读历史消失。",
    "principles": [
      "仅记录模容量的位置会丢失完整圈数。读写指针相等既可能是空，也可能是未消费时恰好写满一圈，必须另有区分条件。",
      "当前 board_uart_read 在 rx_pos==written 时返回 false；教学模型额外保存历史才能指出发生过覆盖，原固件没有这个历史计数。",
      "修复方案可采用可信的生产计数、半满/全满事件配合约束、双缓冲或严格消费期限；事件丢失和快照竞态仍需验证。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "if (rx_pos==written) return false;"
    },
    "steps": [
      {
        "action": "把 CPU 暂停读取期间收到字节数设成 512。",
        "expect": "written 再次等于 rx_pos，原判断返回无新数据，实际已有整圈数据。"
      },
      {
        "action": "改成 520，比较最早字节与当前读出字节的序号。",
        "expect": "部分未读数据已被覆盖；增加八字节并不代表只发生过八字节输入。"
      }
    ],
    "quiz": {
      "q": "把缓冲区扩大十倍能根治吗？",
      "a": "只能延长可承受的阻塞时间；若没有消费期限或丢失检测，结构性问题仍在。"
    },
    "questions": [
      48,
      87,
      95,
      106,
      151
    ],
    "course": "DMA 接收边界专项",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "count": 512
    }
  },
  {
    "id": 90,
    "title": "IDLE、HT、TC 与协议分帧的分工",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "dma",
    "bench": "dma",
    "summary": "先列清工程实际启用了什么，再讨论另一种接收架构。",
    "principles": [
      "UART IDLE 是空闲事件，DMA HT/TC 是搬运进度事件，协议帧头、长度、CRC 则定义消息合法性，三者不在同一层。",
      "当前项目关闭 DMA HT、TC、TE 中断，并未实现 UART IDLE ISR；CommTask 通过 NDTR 轮询，讲解时不能替项目补造中断流程。",
      "改成事件通知后仍要防止重复区间、漏区间和边界并发。一次事件可以包含半帧或多帧，解析器应接收持续的字节流。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "__HAL_DMA_DISABLE_IT(&rx_dma,DMA_IT_HT|DMA_IT_TC|DMA_IT_TE);"
    },
    "steps": [
      {
        "action": "在源码里找到关中断、读 NDTR 和 CommTask 调用三个位置，画出实际路径。",
        "expect": "得到“硬件搬运→任务轮询→逐字节解析”，而非 IDLE ISR 直接交付整帧。"
      },
      {
        "action": "把 74 字节消息拆成 20、54 两批，再把两帧连成 148 字节输入。",
        "expect": "协议层都应按完整校验结果交付，与底层分批方式无关。"
      }
    ],
    "quiz": {
      "q": "IDLE 触发时缓冲里的数据能直接当成一个 Message 吗？",
      "a": "不能；必须处理长度、对齐、字节序、残帧和校验。"
    },
    "questions": [
      95,
      114,
      152
    ],
    "course": "DMA / USART 中断方案比较",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 91,
    "title": "D-cache 与 DMA 的可见性和所有权",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "cache",
    "bench": null,
    "summary": "用 CPU 缓存副本与 SRAM 副本区分读写可见性；明确这是 M7 等平台拓展。",
    "principles": [
      "写回缓存中的新值可能尚未写到 SRAM，DMA 读内存便可能看到旧数据；DMA 写完内存后，CPU 也可能仍读到缓存旧行。",
      "发送与接收方向对应不同维护动作，且应配合对齐、覆盖范围、内存屏障及所有权交接。随手全局 clean 或 invalidate 可能影响邻近数据。",
      "本项目 STM32F407 Cortex-M4 没有 Cortex-M7 那类通用 L1 D-cache。本课用于移植到 F7/H7 等芯片时建立边界，不是当前问题的虚构根因。"
    ],
    "code": {
      "file": "教学/cache_visibility.c",
      "text": "/* 独立教学片段：含 D-cache 平台的简化接收场景。 */\nint cpu_cache=10, sram_value=10;\nsram_value=20; /* DMA 写入 SRAM */\nint before=cpu_cache;\n/* 假定无待处理脏数据、所有权和行边界均正确。 */\ncpu_cache=sram_value; /* 模型表示 invalidate 后重新读取 */\nint after=cpu_cache;"
    },
    "steps": [
      {
        "action": "把 CPU 缓存值设为 10、SRAM 新值设为 20，单步经过 DMA 写入和 CPU 读取。",
        "expect": "失效前 CPU 仍看到 10，在模型假设满足后重新读取才得到 20；volatile 不能替代这个动作。"
      },
      {
        "action": "纸上反过来让 CPU 写脏缓存、DMA 读 SRAM，推导何时需要 clean，并标出缓存行边界。",
        "expect": "发送和接收维护方向不同；当前可运行模型只实现接收后重新读取，实际 API 必须按目标芯片文档选择。"
      }
    ],
    "quiz": {
      "q": "给 DMA 缓冲加 volatile 能替代缓存维护吗？",
      "a": "不能；编译器访问规则与硬件缓存一致性不是同一层。"
    },
    "questions": [
      96,
      125
    ],
    "course": "Cortex-M7 / Linux DMA 移植拓展",
    "sources": [
      {
        "title": "ST · AN4839 Cortex-M7 Cache 与 DMA",
        "url": "https://www.st.com/resource/en/application_note/dm00272913-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf"
      },
      {
        "title": "Linux Kernel · DMA 地址与所有权",
        "url": "https://www.kernel.org/doc/html/latest/core-api/dma-api-howto.html"
      }
    ],
    "preset": {
      "a": 10,
      "b": 20
    }
  },
  {
    "id": 92,
    "title": "NVIC：抢占优先级、分组与 pending",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "irq",
    "bench": "exti",
    "summary": "在同一条事件时间线上比较数值大小、屏蔽边界和真正执行时刻。",
    "principles": [
      "Cortex-M 逻辑中断优先级数值越小通常越紧迫，FreeRTOS 任务优先级方向不同；先说明比较的是哪一种优先级。",
      "优先级分组决定实现位如何划分抢占级与子优先级。子优先级用于合适场景下的先后选择，不等于额外的嵌套抢占等级。",
      "请求到来可以先进入 pending，只有满足使能、优先级和屏蔽条件才执行；观察中断标志不能直接推断 ISR 已经运行。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_4)"
    },
    "steps": [
      {
        "action": "比较逻辑优先级 3 与 7，并进入本工程边界为 5 的临界区模型。",
        "expect": "3 的紧迫性更高，可不被该 BASEPRI 边界屏蔽；7 会等待。"
      },
      {
        "action": "退出最外层临界区，再观察等待中的请求。",
        "expect": "符合条件的 pending 请求才有机会被服务，外设本身可能早已继续工作。"
      }
    ],
    "quiz": {
      "q": "任务优先级 4 与中断优先级 4 可以直接比较吗？",
      "a": "不可以；它们由不同调度与异常机制解释。"
    },
    "questions": [
      33,
      74,
      92,
      93
    ],
    "course": "江协 NVIC 基础 → FreeRTOS 优先级边界",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      }
    ],
    "preset": {
      "priority": 7
    }
  },
  {
    "id": 93,
    "title": "Cortex-M 异常入栈与返回现场",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "irq",
    "bench": null,
    "summary": "把硬件自动保存的基本帧与编译器保存的寄存器分开看。",
    "principles": [
      "基本异常帧包括 r0–r3、r12、LR、PC 和 xPSR；浮点扩展、对齐与惰性压栈会影响具体布局，不能永远只预留八个字。",
      "异常返回使用特殊返回信息选择返回模式、栈与帧形式。读取故障 PC 前需要确认所用 MSP/PSP 和实际帧类型。",
      "ISR 内部调用函数还可能增加软件栈开销；任务栈估计应考虑最深调用链与可能的中断嵌套，而不是只看局部变量。"
    ],
    "code": {
      "file": "教学/exception_frame.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nstruct BasicFrame {\n    unsigned r0,r1,r2,r3,r12,lr,pc,xpsr;\n};\n/* 仅基本帧示意；先确认EXC_RETURN与浮点/对齐情况。 */\nunsigned saved_words=sizeof(struct BasicFrame)/sizeof(unsigned);"
    },
    "steps": [
      {
        "action": "画出八个基本槽位，把异常前下一执行地址标在 PC 槽。",
        "expect": "能解释保存现场为什么支持异常返回，而不是把栈内任意数都当作返回地址。"
      },
      {
        "action": "再加入浮点使用与更深 ISR 调用，重新估算峰值栈。",
        "expect": "原先只按基本帧计算的预算不足，需要架构与编译结果共同验证。"
      }
    ],
    "quiz": {
      "q": "HardFault 中直接打印任意栈指针为什么可能再次出错？",
      "a": "栈本身可能已损坏、地址不可读或帧形式不同，故障处理也必须限制访问。"
    },
    "questions": [
      70,
      71,
      73,
      74,
      91,
      147
    ],
    "course": "Cortex-M 异常机制拓展",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      }
    ],
    "preset": {}
  },
  {
    "id": 94,
    "title": "FromISR 与最高系统调用优先级",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "irq",
    "bench": "exti",
    "summary": "区分“能打断临界区”与“能安全调用 RTOS API”这两个条件。",
    "principles": [
      "本工程 configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY 为 5，使用四个优先级实现位；编码后的屏蔽值与逻辑数值需分别理解。",
      "比该边界更紧迫的中断不能调用受此机制保护的内核 API；允许调用内核的 ISR 也要使用对应 FromISR 版本。",
      "ISR 唤醒更高优先级任务后，通常还需按端口约定请求切换。把任务 API 改个名字并不能自动解决缓冲寿命和实时性问题。"
    ],
    "code": {
      "file": "stm32/include/FreeRTOSConfig.h",
      "anchor": "#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY 5"
    },
    "steps": [
      {
        "action": "在模型中把逻辑中断优先级从 7 改到 3，保持边界 5。",
        "expect": "屏蔽结果改变；3 可更早执行，但不能因此获得调用 RTOS API 的资格。"
      },
      {
        "action": "设计 ISR 只记录事件并通知任务，写下需要的 FromISR 接口和切换请求。",
        "expect": "耗时解析转移到任务，ISR 保留短而有界的工作。"
      }
    ],
    "quiz": {
      "q": "为什么优先级设得“越高越好”可能引出难复现错误？",
      "a": "它可能越过系统调用边界，破坏内核临界区的保护假设。"
    },
    "questions": [
      93,
      94
    ],
    "course": "NVIC 与 FreeRTOS 交界专题",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "priority": 3
    }
  },
  {
    "id": 95,
    "title": "临界区、volatile 与读改写竞争",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "race",
    "bench": null,
    "summary": "交错执行两次加一，看见丢失更新，再选择匹配上下文的保护。",
    "principles": [
      "一次 counter++ 可能包含读取、计算、写回多个动作；两段代码读到同一个旧值后分别写回，最终只增加一次。",
      "volatile 限制编译器对可观察访问的处理，不把复合操作变成原子事务，也不自动建立线程之间的完整同步关系。",
      "临界区必须短、有明确共享对象与上下文范围。关中断不能阻止独立 DMA 写内存，在多核平台也不能自动保护另一个核。"
    ],
    "code": {
      "file": "教学/lost_update.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned counter=0;\nunsigned task_read=counter;\nunsigned isr_read=counter;\ncounter=isr_read+1;\ncounter=task_read+1; /* 结果1，预期两次加一为2 */"
    },
    "steps": [
      {
        "action": "将串行保护开关设为 0，按任务读→中断读→中断写→任务写单步执行。",
        "expect": "最终值为 1，两个执行者都读取旧值导致丢失一次更新。"
      },
      {
        "action": "把串行保护开关设为 1 再运行，并纸上说明临界区或原子操作保护哪些执行者。",
        "expect": "模型最终值为 2；真实实现仍需单独处理 DMA、多核与对象生命周期。"
      }
    ],
    "quiz": {
      "q": "一个对齐的 32 位读写可原子，为什么加一仍会出问题？",
      "a": "原子的单次读写并不把读、加、写三个动作合并成原子操作。"
    },
    "questions": [
      29,
      30,
      35,
      81
    ],
    "course": "C 共享变量 → 中断与任务同步",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 0,
      "b": 0
    }
  },
  {
    "id": 96,
    "title": "ISR 最坏时间、频率与任务下放",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "irq",
    "bench": null,
    "summary": "从一次中断耗时推导 CPU 占用，再检查最长连续阻塞。",
    "principles": [
      "平均 CPU 占用可粗估为频率乘单次执行时间，但实时任务关心最坏延迟，不能用平均值代替最长 ISR 或临界区。",
      "在 ISR 中打印、等待锁、阻塞收发或解析长消息，会放大尾部时延；将数据快照和事件留给任务处理更容易形成执行上限。",
      "优化应先测量并找瓶颈，明确编译选项、输入规模和缓存状态；只说主频高或代码行数少不能证明截止时间可满足。"
    ],
    "code": {
      "file": "教学/isr_budget.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\ndouble frequency_hz=10000.0;\ndouble wcet_us=8.0;\ndouble cpu_fraction=frequency_hz*wcet_us/1e6;\ndouble blocked_us=wcet_us;\n/* 还要叠加更高优先级中断与临界区的最坏干扰。 */"
    },
    "steps": [
      {
        "action": "纸上用 10 kHz 与 8 μs 计算占用，再改为 40 μs；下方模型将中断优先级分别设成 7 与 3。",
        "expect": "占用计算从 8% 变成 40%；可运行部分只显示临界区是否屏蔽该优先级，不测量真实 ISR 耗时。"
      },
      {
        "action": "纸上把解析循环移到任务，仅在 ISR 保存计数与通知，再列出队列容量和消费期限。",
        "expect": "ISR 可形成更短的工作上限，但任务积压和延迟仍必须预算。"
      }
    ],
    "quiz": {
      "q": "CPU 利用率 20% 能证明控制延迟很小吗？",
      "a": "不能；短时间的高优先级阻塞或锁等待仍可能超过控制截止时间。"
    },
    "questions": [
      33,
      57,
      94,
      109
    ],
    "course": "中断测量与实时性拓展",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "priority": 7
    }
  },
  {
    "id": 97,
    "title": "SPSC 环形队列的发布顺序",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "ring",
    "bench": null,
    "summary": "明确谁写 head、谁写 tail，并把数据写入放在发布索引之前。",
    "principles": [
      "单生产者单消费者结构可让双方分别拥有不同索引，但“单生产者”是约束；多个 ISR 或多个任务同时入队会改变问题。",
      "生产者先写数据，再发布 head；消费者先确认可读，再取数据并推进 tail。多核或弱内存序平台还需要合适的原子与内存序。",
      "空满区分可以留一个槽或使用额外计数，各有容量与同步代价。不能既声称容量为 N，又在没有额外状态时无条件使用 N 个槽。"
    ],
    "code": {
      "file": "教学/spsc_publish.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned head=0, tail=0, capacity=8;\nunsigned next=(head+1)%capacity;\nunsigned buffer[8]={0};\nif (next!=tail) {\n    buffer[head]=42; /* 先完成数据 */\n    head=next;       /* 再发布；实际并发需相应内存序 */\n}"
    },
    "steps": [
      {
        "action": "将模型容量设为 8、写入次数设为 9，单步看每次占用数量。",
        "expect": "本模型使用显式 used 计数，可接受八个，第九个拒绝；它不是留一槽的 SPSC 实现。"
      },
      {
        "action": "纸上执行本课留一槽教学片段，对比八槽只能保存七个；再故意先发布 head 后写数据。",
        "expect": "两种空满策略容量不同；发布过早可能让消费者读到旧值，实际跨核同步还需合适原子与内存序。"
      }
    ],
    "quiz": {
      "q": "把 head 和 tail 加 volatile 就能跨核安全了吗？",
      "a": "不能；仍需依据语言内存模型、平台和实现使用原子及适当的发布/获取语义。"
    },
    "questions": [
      87,
      151
    ],
    "course": "并发环形缓冲区编码专题",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 8,
      "b": 9
    }
  },
  {
    "id": 98,
    "title": "DMA 缓冲、队列指针与生命周期",
    "chapter": "07 · 中断、DMA 与共享数据",
    "model": "dma",
    "bench": "dma",
    "summary": "消息里放地址时，跟踪这个地址指向的内容何时会被覆盖。",
    "principles": [
      "队列传指针只复制地址，不冻结底层内容；生产者复用 DMA 缓冲后，消费者仍持有同一个地址却可能读到下一帧。",
      "可选方案包括复制有效数据、双缓冲、固定块池与所有权状态机；零拷贝节省搬运，但把生命周期约束变得更重要。",
      "本项目 STM32 的 commands 保存 Command 副本，samples 保存 SensorSample 副本；不能把其安全性错误推广到任意指针队列。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "commands=xQueueCreateStatic(8,sizeof(Command),command_data,&command_cb);"
    },
    "steps": [
      {
        "action": "画两个时间点：消费者获得 DMA 地址，生产者随后覆盖该地址。",
        "expect": "地址没有变，但内容改变；“队列里有一个消息”不保证消息内容仍属于那一帧。"
      },
      {
        "action": "把设计改为复制小结构体，或给缓冲增加 FREE/FILLING/READY/READING 状态。",
        "expect": "只有消费者归还之后生产者才可重用；需要处理满池与超时。"
      }
    ],
    "quiz": {
      "q": "为什么指针队列比副本队列难验证？",
      "a": "必须同时验证内容寿命、所有权、复用时机和并发可见性，而不仅是队列顺序。"
    },
    "questions": [
      40,
      85,
      95,
      106,
      159
    ],
    "course": "DMA 到任务的数据所有权",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "count": 520
    }
  },
  {
    "id": 99,
    "title": "任务状态：运行、就绪与阻塞",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "schedule",
    "bench": "rtos",
    "summary": "把种菜机的三个任务放到一条时间线上，看谁有资格运行。",
    "principles": [
      "调度器从就绪任务中选择运行者；等待时间或等待队列的任务可能处于阻塞态，即使优先级高，也不会持续占用处理器。",
      "项目采样任务、控制任务与通信任务具有不同周期和职责。阻塞等待让它们交错运行，逻辑上并行不等于单核 CPU 同时执行多条指令。",
      "任务状态和外设状态要分开：CPU 切换了任务，TIM 或 DMA 可以继续工作，外围硬件不需要等待原任务重新获得时间片。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "vTaskDelayUntil(&next,pdMS_TO_TICKS(2000));"
    },
    "steps": [
      {
        "action": "把每轮执行设为 10 ms、计划周期设为 100 ms，运行周期模型并观察每轮执行和等待。",
        "expect": "0→10 ms 完成第一轮，然后等待到 100 ms；该模型展示周期阻塞，不运行真实 FreeRTOS 调度器。"
      },
      {
        "action": "对照源码，纸上标出采样 2 s、控制 100 ms 与通信轮询延时，并加入一次 DMA 收数。",
        "expect": "任务阻塞与外设活动分属不同机制，当前通信任务通过轮询发现数据。"
      }
    ],
    "quiz": {
      "q": "高优先级任务每 100 ms 运行一次，剩余时间在做什么？",
      "a": "若已阻塞到下一周期，就不参与就绪选择；不能理解成它一直空转。"
    },
    "questions": [
      80,
      101,
      160
    ],
    "course": "STM32 外设之后 · FreeRTOS 入门拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 10,
      "b": 100
    }
  },
  {
    "id": 100,
    "title": "任务优先级与控制截止时间",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "priority",
    "bench": "rtos",
    "summary": "解释为什么 ControlTask 优先级更高，也检查它为什么仍可能延迟。",
    "principles": [
      "本工程任务优先级为控制 4、采样 3、通信 2，较高数值表示较高任务优先级；这一方向与 Cortex-M 中断优先级不同。",
      "优先级反映调度政策，不是正确性的证明。长中断、临界区、共享锁和总线阻塞仍可能推迟控制任务，必须定义可接受的最坏响应时间。",
      "控制任务应该有界地处理输入，再提交输出和喂狗。代码每轮最多取八条命令，是限制单轮工作量的一种明确约束。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "xTaskCreateStatic(ControlTask,\"control\",768,0,4,control_stack,&control_cb)"
    },
    "steps": [
      {
        "action": "对照源码，纸上按控制 4、采样 3、通信 2 排列同时就绪的任务，并列出可能阻塞控制的共享资源。",
        "expect": "较高任务优先级优先参与调度，但中断和资源等待仍影响截止时间。"
      },
      {
        "action": "在下方独立锁模型中设中优先级干扰 3 段，对比继承开关 0 和 1。",
        "expect": "观察锁等待怎样推迟高优先级任务；这是资源机制扩展，项目当前未启用互斥锁，模型没有运行三项实际任务。"
      }
    ],
    "quiz": {
      "q": "把所有任务都提高到最高优先级可解决卡顿吗？",
      "a": "不能；会丢失业务层级，还可能扩大竞争与时间片依赖。"
    },
    "questions": [
      29,
      101,
      109,
      160
    ],
    "course": "FreeRTOS 调度与项目任务划分",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 3,
      "b": 1
    }
  },
  {
    "id": 101,
    "title": "同优先级时间片与主动让出",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "schedule",
    "bench": null,
    "summary": "在相同就绪条件下比较抢占、时间片和阻塞行为，避免一条绝对规则套所有配置。",
    "principles": [
      "同优先级任务是否轮流运行取决于调度配置和就绪状态；开启时间片时，tick 可以促成同级任务轮换，但阻塞和让出也会影响顺序。",
      "时间片不是严格均分业务执行量。一个任务可能很快阻塞，另一个可能长期计算，外设等待也会改变可运行集合。",
      "本项目三个主要任务使用不同优先级，因此同级实验是独立拓展。分析时应先检查 configUSE_PREEMPTION 和 configUSE_TIME_SLICING 的实际值。"
    ],
    "code": {
      "file": "教学/equal_priority.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned ready_a=1, ready_b=1, time_slicing=1;\nunsigned running=0;\nif (ready_a && ready_b && time_slicing) running^=1;\n/* 仅tick选择示意，不是FreeRTOS内核实现。 */"
    },
    "steps": [
      {
        "action": "纸上画两个同优先级且始终就绪的任务，分别考虑时间片开启与关闭。",
        "expect": "开启时可在 tick 轮换；关闭时仍会因阻塞、让出或更高优先级任务改变运行者。"
      },
      {
        "action": "纸上让一个任务等待队列；下方另用执行 20 ms、周期 100 ms 展示阻塞空档。",
        "expect": "周期模型帮助理解释放 CPU 的时间窗口；它没有实现同优先级时间片或任务抢占。"
      }
    ],
    "quiz": {
      "q": "vTaskDelay(0) 与等待一个 tick 一样吗？",
      "a": "不能等同；应按版本和 API 语义理解让出与定时阻塞。"
    },
    "questions": [
      101,
      108
    ],
    "course": "FreeRTOS 同优先级调度拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      },
      {
        "title": "FreeRTOS · 内核实现",
        "url": "https://github.com/FreeRTOS/FreeRTOS-Kernel"
      }
    ],
    "preset": {}
  },
  {
    "id": 102,
    "title": "固定周期与相对延时漂移",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "schedule",
    "bench": "rtos",
    "summary": "把执行时间加入时间线，理解 delay 与 delay-until 的不同基准。",
    "principles": [
      "相对延时从调用时刻开始计算，循环实际间隔包含本轮执行时间；周期性延时使用上一次计划唤醒时刻作为下一次基准。",
      "项目 ControlTask 与 SensorTask 使用 vTaskDelayUntil，CommTask 则使用 vTaskDelay(5 ms)，后者不能被描述为严格每 5 ms 执行。",
      "周期性 API 不会让超时执行自动消失。如果本轮工作超过预算，可能已经错过计划时刻，需要统计超时并决定补跑、跳过或降载。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "vTaskDelayUntil(&next,pdMS_TO_TICKS(100));"
    },
    "steps": [
      {
        "action": "纸上按执行 7 ms 后相对延时 100 ms 列出起点，再运行执行 7 ms、计划周期 100 ms 的模型。",
        "expect": "相对延时起点约为 0、107、214 ms；模型按绝对计划起点运行，正常时为 0、100、200 ms。"
      },
      {
        "action": "把模型执行时间改为 140 ms，计划周期仍为 100 ms，再逐轮观察截止时间。",
        "expect": "执行超时会错过目标，delayUntil 不能把已经耗掉的时间追回；模型每轮都使用当前固定执行时长。"
      }
    ],
    "quiz": {
      "q": "用了 vTaskDelayUntil 是否保证绝不丢周期？",
      "a": "不保证；它提供计划时间基准，实际运行仍受执行时间和调度干扰。"
    },
    "questions": [
      108,
      109
    ],
    "course": "FreeRTOS 周期任务与实时预算",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 7,
      "b": 100
    }
  },
  {
    "id": 103,
    "title": "队列传结构体：复制的究竟是什么",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": "rtos",
    "summary": "把 &s、队列元素大小和对象副本三者连起来，而不是看到地址符号就认为传了指针。",
    "principles": [
      "队列创建时指定每个条目的字节数。发送参数 &s 指向复制源，内核按该大小复制内容；队列元素定义为指针时才只复制地址。",
      "项目 samples 的条目是 SensorSample，commands 的条目是 Command；生产者以后修改自己的局部对象，不会倒过来修改已经入队的副本。",
      "副本避免一部分生命周期问题，但复制大对象有时间和内存开销。选择副本或指针应根据大小、所有权和实时预算说明理由。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "samples=xQueueCreateStatic(1,sizeof(SensorSample),sample_data,&sample_cb);"
    },
    "steps": [
      {
        "action": "提交 temp10=250 的样本，然后只把生产者局部变量改成 310。",
        "expect": "队列中的旧副本仍为 250，直到再次发送或覆盖。"
      },
      {
        "action": "把队列元素大小设想为 sizeof(SensorSample*)，重新分析同样操作。",
        "expect": "这次复制的是地址；对象能否继续被修改取决于所有权协议。"
      }
    ],
    "quiz": {
      "q": "xQueueSend(q,&s,0) 中的 &s 足以判断队列存的是指针吗？",
      "a": "不足，必须看创建队列时的元素大小和元素类型。"
    },
    "questions": [
      40,
      103,
      106
    ],
    "course": "FreeRTOS 队列与 C 结构体",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 104,
    "title": "最新值邮箱：长度一队列与覆盖",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": "rtos",
    "summary": "区分“只要最新状态”与“每条命令必须有结果”两种信息需求。",
    "principles": [
      "最新采样和最新遥测具有状态语义，过时的中间值可能可以舍弃；长度为一的覆盖队列让积压始终有界。",
      "命令具有事件语义，覆盖会让之前的请求无声消失。项目 commands 与 acks 使用长度八的普通队列，而非全部使用 Overwrite。",
      "覆盖减少积压不等于数据永远新鲜。消费者仍需检查样本时间和有效位，不能把队列里存在一个对象当作传感器仍在线。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "xQueueOverwrite(samples,&s);"
    },
    "steps": [
      {
        "action": "先覆盖样本 250，再覆盖 310，最后只接收一次。",
        "expect": "接收到最新样本 310，旧样本 250 不再排队等待。"
      },
      {
        "action": "将同样策略应用于“开泵”和“停泵”两条命令，讨论丢掉第一条的后果。",
        "expect": "事件需要明确接受、拒绝或处理结果，不能沿用状态邮箱语义。"
      }
    ],
    "quiz": {
      "q": "队列长度一是否等于任务之间没有同步问题？",
      "a": "不是；它只定义容量与复制行为，时效、对象含义和失败路径仍要设计。"
    },
    "questions": [
      103,
      128,
      160
    ],
    "course": "FreeRTOS 生产消费语义",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 105,
    "title": "有界 FIFO、满队列与拒绝应答",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": "rtos",
    "summary": "把第九条命令放到容量为八的队列，检查拒绝是否可被发送方观察。",
    "principles": [
      "有限内存系统必须对积压设置上限。队列满不是偶然的“不应该发生”，而是需要设计返回值、退避和告警的正常边界。",
      "本项目 xQueueSend(commands,&c,0) 不等待空间，失败时发送 ACK=9；如果忽略返回值，云端会误以为命令仍在执行途中。",
      "扩大队列可以吸收短暂突发，但无法解决长期生产快于消费。还需比较输入速率、消费上限和允许的排队延迟。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "Message ack={.type=MSG_ACK,.seq=m.seq}; ack.v[0]=9;"
    },
    "steps": [
      {
        "action": "连续入队九条命令而不消费，观察容量八的槽位。",
        "expect": "前八条占满，第九条必须得到明确失败结果。"
      },
      {
        "action": "把消费速度降低到输入速度的一半，预测更大队列能维持多久。",
        "expect": "容量只推迟满队列时间；长期必须限流、拒绝或提高可持续消费能力。"
      }
    ],
    "quiz": {
      "q": "发送方收不到 ACK，能直接无间隔重复发吗？",
      "a": "不能；应带相同请求标识、受限重试和超时，避免把暂时拥塞放大。"
    },
    "questions": [
      103,
      128,
      160
    ],
    "course": "队列容量与反压",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 106,
    "title": "通知、信号量、互斥锁和队列如何选",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": null,
    "summary": "先说清传的是数据、事件计数还是资源所有权，再选择机制。",
    "principles": [
      "队列适合传送有类型大小的数据副本；任务通知常用于面向某个任务的轻量事件或计数，具体语义要按所用通知 API 选择。",
      "信号量可表达资源计数或事件，互斥锁还表达持有者与优先级继承等所有权语义；二者不是仅靠名字区分的同一种工具。",
      "项目当前启用队列，关闭互斥锁、计数信号量和软件定时器相关配置。本课比较选择原则，不假装这些机制已经在固件中启用。"
    ],
    "code": {
      "file": "教学/sync_choice.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum Need { SAMPLE_VALUE, WAKE_TASK, COUNT_RESOURCES, OWN_RESOURCE };\nenum Mechanism { QUEUE, NOTIFICATION, SEMAPHORE, MUTEX };\nenum Need need=SAMPLE_VALUE;\nenum Mechanism choice=need==SAMPLE_VALUE?QUEUE:\n    need==WAKE_TASK?NOTIFICATION:need==COUNT_RESOURCES?SEMAPHORE:MUTEX;"
    },
    "steps": [
      {
        "action": "分别给“新采样结构体”“DMA 完成通知”“三个空缓冲”“共享 SPI 总线”选择机制。",
        "expect": "数据、事件、计数和所有权不同；同一个机制未必最适合全部场景。"
      },
      {
        "action": "把事件改成来自 ISR，检查接口名称、优先级边界与允许的等待时间。",
        "expect": "ISR 不能随意调用普通阻塞 API，也不能按任务上下文使用互斥锁。"
      }
    ],
    "quiz": {
      "q": "二值信号量是否天然拥有互斥锁的优先级继承？",
      "a": "不是；需要区分 FreeRTOS 对不同对象的明确语义。"
    },
    "questions": [
      93,
      103,
      160
    ],
    "course": "FreeRTOS 同步机制选型",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 107,
    "title": "优先级反转与继承的边界",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "priority",
    "bench": null,
    "summary": "让低优先级任务持有资源，高优先级任务等待，再插入中优先级计算任务。",
    "principles": [
      "高优先级任务等待低优先级持有的锁时，中优先级任务可能阻止持有者完成并释放资源，间接扩大高优先级等待。",
      "互斥锁的优先级继承可以暂时提高持有者的调度优先级，但不消除长临界区、死锁、设备等待或复杂嵌套锁问题。",
      "本工程 STM32 配置关闭互斥锁，优先级继承实验是独立拓展；项目主要通过控制状态单一所有者和消息副本减少共享写。"
    ],
    "code": {
      "file": "教学/priority_inversion.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned low=1, medium=2, high=3;\nunsigned owner_effective=low;\nint high_waits_for_owner=1;\nif (high_waits_for_owner) owner_effective=high;\n/* 模型继承：先让持有者完成短临界区，再归还原优先级。 */"
    },
    "steps": [
      {
        "action": "把中优先级干扰设为 3 段、继承设为 0，按 L 持锁→H 等锁→M 干扰观察。",
        "expect": "模型显示 H 阻塞且多出三段干扰，低优先级持锁者迟迟不能完成。"
      },
      {
        "action": "把继承设为 1 后重跑，再纸上把 L 的锁内工作改成长设备等待。",
        "expect": "模型去掉这类中优先级干扰；继承不能缩短设备本身等待，也不解决死锁。"
      }
    ],
    "quiz": {
      "q": "优先级继承能防止两个任务互相等锁吗？",
      "a": "不能；死锁依赖等待环，需要锁顺序或其他结构性设计。"
    },
    "questions": [
      29,
      102,
      109
    ],
    "course": "FreeRTOS 互斥锁岗位拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      },
      {
        "title": "FreeRTOS · 内核实现",
        "url": "https://github.com/FreeRTOS/FreeRTOS-Kernel"
      }
    ],
    "preset": {
      "a": 3,
      "b": 0
    }
  },
  {
    "id": 108,
    "title": "锁顺序、死锁与单一所有者",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "priority",
    "bench": "rtos",
    "summary": "通过一张等待关系图比较加锁与消息驱动两种设计。",
    "principles": [
      "任务 A 持有资源一等待资源二，任务 B 持有资源二等待资源一，会形成等待环；超时仅提供退出机会，不自动恢复一致状态。",
      "统一获取顺序、减少嵌套、缩短锁范围与单一资源所有者能降低风险。选择方案时还要考虑吞吐、时延和故障恢复。",
      "种菜机让 ControlTask 独占 Planter，其余任务传命令和样本副本。这样控制状态不需要每个字段各自加锁，设计逻辑也更容易追踪。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "Planter p; planter_init(&p,board_boot_id());"
    },
    "steps": [
      {
        "action": "画出 A→锁二→B→锁一→A 的等待环，再规定全系统按锁一后锁二获取。",
        "expect": "统一顺序消除这类环，但必须覆盖所有代码路径。"
      },
      {
        "action": "把直接改 Planter 的多个任务改为向 commands 队列发送请求。",
        "expect": "状态修改集中在控制任务，队列满和命令超时成为必须明确处理的边界。"
      }
    ],
    "quiz": {
      "q": "给每个全局变量加锁就一定更安全吗？",
      "a": "不一定；可能增加锁顺序组合、阻塞时间和状态更新不一致的问题。"
    },
    "questions": [
      29,
      35,
      102,
      160
    ],
    "course": "并发架构与项目控制所有权",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 109,
    "title": "任务栈：单位、调用深度与水位",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "heap",
    "bench": "rtos",
    "summary": "用具体字节数解释栈容量，同时说明高水位不是所有输入下的证明。",
    "principles": [
      "STM32 FreeRTOS 任务创建的栈深度按 StackType_t 元素数传入；本项目控制栈 768 个元素，在此端口通常对应 3072 字节。",
      "ESP-IDF 的任务 API 对栈大小单位有自己的约定，不能把 STM32 的参数原样套到 ESP32。跨平台先读端口文档，再做字节预算。",
      "局部数组、库函数、调用深度与中断上下文都会影响峰值。水位检查只覆盖已运行路径，应结合最坏输入、溢出钩子和余量。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "static StackType_t sensor_stack[512], control_stack[768], comm_stack[768], idle_stack[128];"
    },
    "steps": [
      {
        "action": "对照源码把控制栈 768 乘以 sizeof(StackType_t)，再纸上列出最深调用链与异常帧预算。",
        "expect": "本目标常见四字节栈元素对应 3072 字节，不能把 768 当成字节数。"
      },
      {
        "action": "把下方容量模型设为八块、每块 16 字节，再改成九块；另列出将来真机栈水位压力场景。",
        "expect": "128 字节示意容量在第九块失败；它不是控制任务栈模型，页面不会生成实测栈水位。"
      }
    ],
    "quiz": {
      "q": "运行一小时没栈溢出就能把剩余空间全部裁掉吗？",
      "a": "不能；罕见分支、输入规模与中断嵌套可能还没有被覆盖。"
    },
    "questions": [
      70,
      71,
      73,
      104,
      105
    ],
    "course": "FreeRTOS 栈分析与跨端口差异",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      },
      {
        "title": "Espressif · ESP-IDF FreeRTOS",
        "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html"
      }
    ],
    "preset": {
      "a": 8,
      "b": 16
    }
  },
  {
    "id": 110,
    "title": "静态创建任务与失败路径",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "heap",
    "bench": "rtos",
    "summary": "把 TCB、任务栈、队列控制块和队列存储逐一找出来。",
    "principles": [
      "静态分配让调用方提供任务栈与控制块，动态分配则从运行时分配器申请；前者更容易固定内存预算，但不是“永远不会失败”。",
      "本项目 STM32 开启静态分配、关闭动态分配，任务和队列返回值用 configASSERT 检查；ESP32 侧则使用自己的动态创建接口。",
      "创建失败应核对对象大小、数量、参数、堆或静态存储、对齐和配置。只盯着一个“空闲内存总量”无法解释所有失败。"
    ],
    "code": {
      "file": "stm32/include/FreeRTOSConfig.h",
      "anchor": "#define configSUPPORT_DYNAMIC_ALLOCATION 0"
    },
    "steps": [
      {
        "action": "在 app.c 找到每个任务栈、StaticTask_t、队列控制块和数据数组。",
        "expect": "能把 API 参数与具体存储一一对应，形成启动内存预算。"
      },
      {
        "action": "在独立设计中故意让队列数据区小于条目数乘条目大小，审查创建条件。",
        "expect": "应在构建或初始化阶段发现不匹配，不能等到运行时内存被破坏才判断。"
      }
    ],
    "quiz": {
      "q": "静态分配是否就不需要检查返回值和断言？",
      "a": "仍然需要；配置、参数和资源布局错误不会因为静态分配而自动消失。"
    },
    "questions": [
      105,
      110,
      159
    ],
    "course": "FreeRTOS 静态内存配置",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 111,
    "title": "软件定时器回调为什么不能随意阻塞",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "schedule",
    "bench": null,
    "summary": "把多个回调放到同一个定时器服务任务中，观察一个长回调的连带影响。",
    "principles": [
      "FreeRTOS 软件定时器回调通常由定时器服务任务执行，它们共享该任务上下文；一个回调长时间等待会影响其他回调与定时器命令处理。",
      "回调宜进行短动作或通知业务任务，不应等待由同一个服务任务推进的条件，否则可能造成更严重的时序问题。",
      "本工程 configUSE_TIMERS 为 0，周期工作通过任务实现。本课说明以后启用软件定时器时要增加的服务任务优先级、栈和队列预算。"
    ],
    "code": {
      "file": "教学/timer_callback.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nvoid timer_callback_example(void) {\n    /* 教学伪接口：非阻塞投递事件，由业务任务处理耗时工作。 */\n    post_event_nonblocking(1);\n    return;\n}"
    },
    "steps": [
      {
        "action": "纸上画 100 ms、110 ms 两个到期回调，令第一个耗时 50 ms；下方模型只运行普通周期任务。",
        "expect": "共享定时器服务任务可能推迟第二个回调；当前项目未启用软件定时器，页面没有回调调度仿真。"
      },
      {
        "action": "在纸上把第一个回调改为通知后立即返回，再列出业务任务消费条件。",
        "expect": "回调占用变短，但业务优先级与事件积压还需分析，不能把移交工作理解成零延迟。"
      }
    ],
    "quiz": {
      "q": "软件定时器回调可以按硬件 ISR 的上下文来写吗？",
      "a": "不可以；它在任务上下文执行，但共享服务任务仍要求避免长期阻塞。"
    },
    "questions": [
      107,
      108
    ],
    "course": "FreeRTOS 软件定时器拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 112,
    "title": "事件位：多个条件的 AND / OR 等待",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": null,
    "summary": "让“网络就绪”和“时钟可信”共同控制云连接入口。",
    "principles": [
      "事件位适合表达一组布尔条件，可以等待任意一个或全部条件；位被置位不天然记录事件发生次数或发生顺序。",
      "如果连续发生十次采样完成却只保留一个事件位，消费者看到的仍可能只有“发生过”；每次都要处理时应考虑计数或数据队列。",
      "项目直接判断 Wi-Fi、时间和 MQTT 状态，没有使用事件组。本课用同样业务条件理解事件组选择，不把新机制说成既有实现。"
    ],
    "code": {
      "file": "教学/event_bits.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum { WIFI_READY=1u, TIME_VALID=2u };\nunsigned bits=WIFI_READY;\nunsigned required=WIFI_READY|TIME_VALID;\nint all_ready=(bits&required)==required;\nbits|=TIME_VALID;\nall_ready=(bits&required)==required;"
    },
    "steps": [
      {
        "action": "纸上执行教学位图，先只置 WIFI_READY，再加入 TIME_VALID，计算等待全部条件的布尔表达式。",
        "expect": "两位同时满足才通过 AND 条件；下方共享队列模型并非事件组内核仿真。"
      },
      {
        "action": "纸上连续两次置同一个事件位，再让消费者清除它，并与队列中两个独立条目比较。",
        "expect": "位图没有保留两次事件的计数；事件次数和状态条件需要不同的数据表示。"
      }
    ],
    "quiz": {
      "q": "事件组适合直接存放温度数值吗？",
      "a": "不适合；条件位与带载荷的数据传递是不同需求。"
    },
    "questions": [
      103,
      128,
      160
    ],
    "course": "任务协作条件与事件组拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 113,
    "title": "固定块内存池与缓冲归还",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "heap",
    "bench": null,
    "summary": "把四块缓冲作为可追踪资源，练习申请、移交、释放与耗尽。",
    "principles": [
      "固定块池把内存分成大小相同的块，申请释放的时间和容量较易约束，但不同大小对象可能浪费空间，不能替代所有分配需求。",
      "每块需要明确所有者与状态：空闲、生产中、已就绪、消费中。重复归还、归还错误地址和未归还都会破坏池的正确性。",
      "池耗尽必须有策略，例如拒绝输入、丢弃可丢的旧遥测或报告忙；不能无界等待而阻塞种菜机的安全控制周期。"
    ],
    "code": {
      "file": "教学/fixed_pool.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned free_mask=0x0Fu; /* 四块，单线程示意 */\nint block=-1;\nfor (int i=0;i<4;i++) if (free_mask&(1u<<i)) {\n    free_mask&=~(1u<<i); block=i; break;\n}\n/* 归还前验证所有权；并发访问需额外同步。 */"
    },
    "steps": [
      {
        "action": "将容量模型设为申请五块、每块 32 字节，单步查看 128 字节总空间。",
        "expect": "前四块成功，第五块失败；满池必须明确返回失败，不能复用仍在使用的块。"
      },
      {
        "action": "纸上给四块编号并追踪 FREE/OWNED，归还第二块后再申请，最后尝试重复归还。",
        "expect": "正常归还恢复容量，重复归还应被拒绝；页面模型只做容量累计，不实现释放或双重归还检测。"
      }
    ],
    "quiz": {
      "q": "固定块池没有外部碎片就等于没有内存问题吗？",
      "a": "不等于；泄漏、重复释放、越界、对齐、池耗尽和内部浪费仍需处理。"
    },
    "questions": [
      110,
      159
    ],
    "course": "嵌入式确定性内存管理拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 5,
      "b": 32
    }
  },
  {
    "id": 114,
    "title": "泄漏、碎片与峰值需求的区别",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "heap",
    "bench": null,
    "summary": "用总空闲量和最大连续块两个指标解释“还有内存却申请失败”。",
    "principles": [
      "泄漏是失去继续释放已分配对象的能力，碎片是空闲空间布局不满足请求，峰值不足则是有效并存对象本来就超过预算。",
      "总空闲字节很多时，最大连续可分配块仍可能很小；分配器实现、对齐和管理开销也会影响可用大小。",
      "项目 STM32 主路径使用静态存储，而 ESP32 网络栈和库仍可能动态分配。应分别记录各平台的失败点与生命周期，不用一个结论覆盖两端。"
    ],
    "code": {
      "file": "教学/heap_fragmentation.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned gaps[3]={128,64,128};\nunsigned total=gaps[0]+gaps[1]+gaps[2];\nunsigned largest=128, request=200;\nint fits=(request<=largest);\n/* total=320仍不能满足连续200字节，忽略分配器额外开销。 */"
    },
    "steps": [
      {
        "action": "纸上画 128、64、128 字节三段空闲块，判断能否分配连续 200 字节；再运行九块、每块 16 字节的容量模型。",
        "expect": "碎片算例总空闲 320 仍无法满足连续 200；实际运行模型容量仅 128，第九块失败，只显示峰值容量而非碎片。"
      },
      {
        "action": "纸上改为固定块池或启动时集中申请，分别计算最大对象、内部浪费与峰值。",
        "expect": "固定布局提高可预测性仍需足够容量；本课不声称共享模型实现了通用堆分配器。"
      }
    ],
    "quiz": {
      "q": "空闲内存持续下降能直接证明泄漏吗？",
      "a": "还要排除缓存增长、连接状态和合法峰值；通过释放后是否恢复与对象追踪找证据。"
    },
    "questions": [
      105,
      110,
      130
    ],
    "course": "动态内存诊断与设计权衡",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 9,
      "b": 16
    }
  },
  {
    "id": 115,
    "title": "多任务种菜机：单一状态所有者",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "queue",
    "bench": "rtos",
    "summary": "从采样副本到控制决策再到 GPIO 提交，完整走一轮项目数据流。",
    "principles": [
      "SensorTask 负责采样，CommTask 负责串口与协议，ControlTask 负责唯一的 Planter 状态修改；任务边界按职责而不是按每个变量划分。",
      "控制任务先消费可用样本和有界命令，再运行 planter_step，之后调用 board_outputs。计算中的临时 desired 不等于物理引脚已经改变。",
      "消息队列也形成系统时延：采样时间、排队时间、控制周期与输出提交共同决定从外界变化到执行器变化的延迟。"
    ],
    "code": {
      "file": "stm32/src/app.c",
      "anchor": "planter_step(&p,board_water_low(),true,now);"
    },
    "steps": [
      {
        "action": "先单步运行队列模型，观察温度副本 250→310；再回到原 C 控制实验改变温度，追踪 samples 到 board_outputs。",
        "expect": "队列模型展示副本与所有权；主实验中的风扇效果由实际控制逻辑计算，二者要分层理解。"
      },
      {
        "action": "在主实验发送一条手动命令，再对照源码检查通信任务是否直接改 GPIO。",
        "expect": "命令先入队，由控制任务校验并应用，保护逻辑仍参与最终输出。"
      }
    ],
    "quiz": {
      "q": "为什么不让通信回调直接改全部输出？",
      "a": "那会绕开单一所有者和保护顺序，还引入并发写与状态不一致。"
    },
    "questions": [
      9,
      35,
      80,
      103,
      160
    ],
    "course": "项目综合：采样、控制、通信任务",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {}
  },
  {
    "id": 116,
    "title": "低 CPU 占用下的高延迟排查",
    "chapter": "08 · FreeRTOS 与系统协作",
    "model": "schedule",
    "bench": null,
    "summary": "沿完整事件路径测时间，找出 CPU 利用率图上看不见的等待。",
    "principles": [
      "任务可能等锁、等队列、等设备或在低优先级下排队，CPU 此时不一定很忙；平均占用小不代表端到端延迟小。",
      "应分别记录外部事件、ISR/轮询发现、入队、出队、控制完成与引脚提交的时间，最大间隔揭示阻塞发生在哪一层。",
      "对比同一输入下的正常与异常时间线，比单纯提高优先级更有解释力；必要时给日志也设置容量和输出预算。"
    ],
    "code": {
      "file": "教学/latency_chain.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned event_us=1000, detected_us=1500;\nunsigned dequeued_us=8000, output_us=8300;\nunsigned detect_delay=detected_us-event_us;\nunsigned queue_delay=dequeued_us-detected_us;\nunsigned total=output_us-event_us;"
    },
    "steps": [
      {
        "action": "纸上计算事件 1000 μs、发现 1500 μs、出队 8000 μs、输出 8300 μs 的分段延迟，再把计算段缩短一半。",
        "expect": "最大等待在发现到出队之间，优化最后 300 μs 的收益有限；这些时间是算例，非页面测量。"
      },
      {
        "action": "将模型执行时间设为 140 ms、周期 100 ms，逐轮记录迟到；再将执行时间降到 20 ms。",
        "expect": "可运行模型展示周期超限与阻塞恢复；真实排队、锁等待和中断延迟需另做分段测量。"
      }
    ],
    "quiz": {
      "q": "把代码优化到 O2 就一定解决迟响应吗？",
      "a": "不能；等待和资源调度问题可能与计算速度关系很小。"
    },
    "questions": [
      57,
      94,
      108,
      109,
      148
    ],
    "course": "实时系统测量与故障定位",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 140,
      "b": 100
    }
  },
  {
    "id": 117,
    "title": "ESP32 网关：UART 与网络分开运行",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "先分清两颗 MCU 的职责，再让断网只影响云通道。",
    "principles": [
      "STM32 保存控制状态并运行本地保护，ESP32 负责把串口消息与网络消息互相转换；控制回路不应依赖每一次云响应才能继续运行。",
      "ESP32 的 UartTask 持续收发并通过队列移交数据，网络 loop 维护连接和发布。代码任务并行与物理串口持续传输需要分别观察。",
      "网关掉线、串口断开、采样过期和执行器故障属于不同状态。上位机应保留这些区别，不能只显示一个笼统的在线灯。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "static void UartTask(void *arg)"
    },
    "steps": [
      {
        "action": "接好 STM32 PA2/PA3 与 ESP32 RX16/TX17 的交叉连线，并运行到遥测入队。",
        "expect": "有效串口帧进入遥测队列，网络步骤尚未发生也能收到本地数据。"
      },
      {
        "action": "在接线台切换 Wi-Fi 断开，随后回主控制实验提高温度。",
        "expect": "云发布停止，但本地温度控制仍可让风扇启动；这是两条独立链路。"
      }
    ],
    "quiz": {
      "q": "网关在线是否证明 STM32 的最新采样仍有效？",
      "a": "不能，还需要串口状态、样本有效位、年龄和启动标识等信息。"
    },
    "questions": [
      12,
      27,
      48,
      128,
      160
    ],
    "course": "项目 ESP32 网关拓展",
    "sources": [
      {
        "title": "Espressif · ESP-IDF FreeRTOS",
        "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html"
      },
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 4,
      "b": 0
    }
  },
  {
    "id": 118,
    "title": "MQTT 主题、订阅与回调入口",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "从 topic 名称一路追到 commandReceived 的校验代码。",
    "principles": [
      "发布者把载荷发布到主题，订阅者按订阅过滤条件接收。主题组织路由，载荷格式与业务含义仍由应用协议定义。",
      "项目把 telemetry、command、ack、status 分成四类主题，便于区分设备状态、请求和处理结果；不能把收到任意消息都当成控制命令。",
      "commandReceived 首先核对主题、长度、JSON 类型和必要字段，再检查时间、启动标识和队列容量，路由正确不代表参数合法。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "static void commandReceived(char *topic, byte *payload, unsigned length)"
    },
    "steps": [
      {
        "action": "在源码中找出四类 snprintf 主题，再画一条遥测与一条命令的方向。",
        "expect": "遥测从 STM32 到云，命令从订阅回调到 commandQueue，两者不共用同一个入口假设。"
      },
      {
        "action": "纸上构造主题正确但 args 长度错误的 JSON，追踪第一个拒绝分支。",
        "expect": "回调在入队之前拒绝非法结构，不让控制任务猜测缺失参数。"
      }
    ],
    "quiz": {
      "q": "MQTT 会替我们验证温度阈值是否合法吗？",
      "a": "不会；它传输消息，应用层负责字段类型、范围、时效和业务约束。"
    },
    "questions": [
      12,
      27,
      127
    ],
    "course": "MQTT 发布订阅与项目应用协议",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 4,
      "b": 4
    }
  },
  {
    "id": 119,
    "title": "QoS 与应用幂等：重复消息如何处理",
    "chapter": "09 · ESP32 与网络",
    "model": "protocol",
    "bench": "mqtt",
    "summary": "把消息传递保证和水泵只执行一次分成两个问题。",
    "principles": [
      "MQTT 的 QoS 描述协议参与者之间的消息交付语义，不能直接推出外部执行器动作只发生一次或物理效果已经实现。",
      "网络重试、网关重发与应用恢复都可能导致同一请求再次到达。种菜机使用 seq 和 boot 识别命令，重复请求不会重新延长手动动作。",
      "本项目使用的发布接口调用方式与订阅 QoS 要分别检查，不能因为 subscribe(...,1) 就宣称所有发布都是 QoS 1。"
    ],
    "code": {
      "file": "common/planter.c",
      "anchor": "if (m->seq==p->last_command) return ACK_DUPLICATE;"
    },
    "steps": [
      {
        "action": "在原 C 命令实验中发送一次手动请求，再用相同 seq 重发。",
        "expect": "第二次返回重复结果，不重新启动同一限时动作。"
      },
      {
        "action": "纸上比较“协议确认已送达”“STM32 接受”“泵实际出水”三个时刻。",
        "expect": "三者需要不同证据，当前项目没有流量反馈证明实际出水。"
      }
    ],
    "quiz": {
      "q": "使用 QoS 2 是否就可以删掉应用命令编号？",
      "a": "不应这样推断；跨应用重试、状态恢复与物理动作的幂等仍需业务设计。"
    },
    "questions": [
      27,
      28,
      128
    ],
    "course": "MQTT QoS 与业务幂等",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 3,
      "b": 8
    }
  },
  {
    "id": 120,
    "title": "Retain、遗嘱与设备状态的新鲜度",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "理解新订阅者立即看见的状态可能来自过去。",
    "principles": [
      "Retain 保存主题的最后保留消息，方便后来订阅者获取状态；它不是实时测量保证，也不应该被直接当作新的动作命令。",
      "遗嘱用于在特定异常连接结束条件下发布预先约定消息，正常断开、检测延迟和代理策略会影响何时可见。",
      "项目发布保留的在线状态并设置离线遗嘱，但界面还应结合时间戳与最新遥测判断业务存活，不能只看保留的 online=true。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "mqtt.publish(statusTopic,"
    },
    "steps": [
      {
        "action": "在源码中分别找到连接时设置的遗嘱和连接成功后的保留在线状态。",
        "expect": "两条路径具有不同触发条件，保留与遗嘱不是同一个开关。"
      },
      {
        "action": "纸上让设备失联后新客户端订阅，列出仍需要检查的遥测时间和连接信息。",
        "expect": "旧保留值可能短时间仍存在，业务界面需显示状态年龄或未知状态。"
      }
    ],
    "quiz": {
      "q": "适合把“打开水泵”发布成长期保留命令吗？",
      "a": "通常应避免让新会话无意重放旧动作；必须有明确的命令时效与启动域约束。"
    },
    "questions": [
      27,
      48,
      128
    ],
    "course": "MQTT 会话状态与业务新鲜度",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 1,
      "b": 0
    }
  },
  {
    "id": 121,
    "title": "Wi-Fi、校时、TLS 与 MQTT 的分层条件",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "一次连接失败先确定卡在哪一层，再判断是否应重试。",
    "principles": [
      "Wi-Fi 关联成功只证明局部网络连接条件的一部分，DNS、TCP、证书验证、身份认证和 MQTT 会话建立还各有失败路径。",
      "TLS 证书验证通常依赖可信时间与正确的信任根。项目先配置校时和 CA，再设置服务器，不应通过关闭校验来掩盖时间错误。",
      "连接和重试需要有超时、频率限制与错误记录，避免网络故障占满 CPU 或阻塞本地串口处理。本页面模型不使用真实凭据联网。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "transport.setCACert(MQTT_CA); transport.setHandshakeTimeout(5);"
    },
    "steps": [
      {
        "action": "按 Wi-Fi→时间→TLS→MQTT 顺序列出成功条件，追踪源码的连接 if 条件。",
        "expect": "可以区分没有网络与时钟未可信，避免把所有错误都归为 MQTT 主题问题。"
      },
      {
        "action": "纸上让时钟停在错误年代，说明应检查的日志和状态，而不是删除 CA 验证。",
        "expect": "先修复校时和信任配置，再评估握手超时与网络可达性。"
      }
    ],
    "quiz": {
      "q": "连上 Wi-Fi 后为什么仍不能立即信任云端会话？",
      "a": "后续网络、时间、身份验证与协议协商还未必成功。"
    },
    "questions": [
      27,
      28,
      48
    ],
    "course": "网络分层与 ESP32 安全连接拓展",
    "sources": [
      {
        "title": "Espressif · ESP-IDF FreeRTOS",
        "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html"
      },
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 1,
      "b": 0
    }
  },
  {
    "id": 122,
    "title": "TCP 半包、多帧与非法长度",
    "chapter": "09 · ESP32 与网络",
    "model": "protocol",
    "bench": null,
    "summary": "把 read 的返回批次与应用消息边界分开建模。",
    "principles": [
      "TCP 提供有序字节流，应用一次发送不保证对方一次读取正好得到同样大小。读取结果可能含半帧、一帧或多帧的组合。",
      "长度字段必须先验证范围和溢出，再申请空间或拷贝；解析状态需要保留未完成部分，并在消费一帧后继续处理余下字节。",
      "固定长度的种菜机串口解析器同样不能依赖“每次读到一整帧”，但其帧规则与这里的变长 TCP 教学协议不同。"
    ],
    "code": {
      "file": "教学/tcp_length.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned capacity=64, declared=8, available=3;\nif (declared>capacity) return INVALID;\nif (available<declared) return NEED_MORE;\n/* 完整校验后仅消费当前帧，保留后面的字节。 */\nreturn FRAME_READY;"
    },
    "steps": [
      {
        "action": "把模型每批接收设为 3 字节、声明长度设为 8。",
        "expect": "分三批才满足完整长度，前两批不能提前交付。"
      },
      {
        "action": "把声明长度改为 80，保持容量 64。",
        "expect": "在写入或申请前拒绝非法长度，而不是先填满缓冲再检查。"
      }
    ],
    "quiz": {
      "q": "网络读一次返回了 100 字节，就代表一条 100 字节消息吗？",
      "a": "不代表；边界由应用协议规定，必须解析。"
    },
    "questions": [
      28,
      127,
      152
    ],
    "course": "网络协议解析拓展",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 3,
      "b": 8
    }
  },
  {
    "id": 123,
    "title": "断网积压、反压与最新值策略",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "用生产速率与发送能力预测什么时候必须拒绝或舍弃。",
    "principles": [
      "队列增长取决于生产与消费速率差，容量只能吸收有限突发；长期输入大于处理能力时，总要触发拒绝、丢弃、限流或降级。",
      "遥测通常关心最新状态，可以覆盖旧值；命令需要单独的接受结果、截止时间和幂等逻辑，不能一概选择“丢最旧”。",
      "项目 telemetryQueue 长度一，commands 与 ACK 有界。断网时还应观察 pending 状态和重试上限，避免积压扩散到控制任务。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "telemetryQueue=xQueueCreate(1,sizeof(Received)); ackQueue=xQueueCreate(8,sizeof(Received));"
    },
    "steps": [
      {
        "action": "把生产速率设为每秒 4 条，发送能力设为每秒 2 条。",
        "expect": "容量 16 的教学队列逐渐达到上限，继续生产就出现丢弃。"
      },
      {
        "action": "把发送能力改为 0，再为遥测设计最新值邮箱；命令另列拒绝策略。",
        "expect": "断网不意味着可以无限缓存，状态与事件必须采用不同积压策略。"
      }
    ],
    "quiz": {
      "q": "增加队列容量能解决长期带宽不足吗？",
      "a": "只能推迟满队列；持续速率失衡需要改变输入、输出或服务策略。"
    },
    "questions": [
      27,
      103,
      128
    ],
    "course": "生产消费与联网系统反压",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      },
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 4,
      "b": 2
    }
  },
  {
    "id": 124,
    "title": "命令 TTL、启动标识与去重顺序",
    "chapter": "09 · ESP32 与网络",
    "model": "protocol",
    "bench": "mqtt",
    "summary": "沿网关校验和 STM32 再校验，解释为什么需要两次把关。",
    "principles": [
      "云端时间戳适合表达跨设备时效，但 MCU 运行时间计数适合本地持续时间判断；网关把剩余有效期转换给 STM32 再检查。",
      "boot 区分设备重启前后的命令作用域，seq 区分同一启动域内的新、重复和旧请求；时间合法不能替代这两个身份条件。",
      "校验顺序影响返回原因与副作用。项目先验证基本字段、启动标识和时效，再去重，只有有效命令才更新 last_command。"
    ],
    "code": {
      "file": "common/planter.c",
      "anchor": "if (m->v[8]<=0 || m->v[8]>30000 || elapsed(now,received)>=(uint32_t)m->v[8]) return ACK_EXPIRED;"
    },
    "steps": [
      {
        "action": "在原 C 命令实验分别测试过期、重复 seq 和错误 boot，记录返回码。",
        "expect": "三个错误有不同原因，均不应执行新的水泵动作。"
      },
      {
        "action": "纸上让命令在网关合法，但在 STM32 队列中等待到有效期耗尽。",
        "expect": "控制器必须再次检查，不能仅凭网关曾经接受就执行。"
      }
    ],
    "quiz": {
      "q": "为什么收到重复请求不应重新延长手动时长？",
      "a": "重试只是为获取可靠结果，不应悄悄变成一次新的业务动作。"
    },
    "questions": [
      28,
      48,
      128,
      154
    ],
    "course": "项目命令可靠性专题",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      }
    ],
    "preset": {
      "a": 3,
      "b": 8
    }
  },
  {
    "id": 125,
    "title": "重连、重试、ACK 与状态机收尾",
    "chapter": "09 · ESP32 与网络",
    "model": "network",
    "bench": "mqtt",
    "summary": "给每次尝试一个边界，同时检查最终失败时资源是否能回到可用状态。",
    "principles": [
      "重试要保留同一业务标识，限制次数、间隔和总有效期；否则网络抖动可能被放大成重复执行与资源耗尽。",
      "项目命令每隔约 800 ms 最多尝试三次，并检查 expiry。ACK 上报成功后才清除某些 pending 状态，断网边界应专门分析。",
      "设计评审还要问永久失败之后如何结束、旧请求如何隔离、重连后是否重放。重试机制本身不是可恢复性的完整证明。"
    ],
    "code": {
      "file": "esp32/src/main.cpp",
      "anchor": "if (epoch>=expiresAt || (attempts>=3 && millis()-sentAt>=800u))"
    },
    "steps": [
      {
        "action": "在源码中追踪 attempts 从 1 到 3 的路径，并标出到期和 ACK 成功的位置。",
        "expect": "每次重发使用同一命令标识，剩余 TTL 缩短，不无限延长有效期。"
      },
      {
        "action": "纸上令最终失败时网络仍断开，检查 publishAck 返回 false 后 pending 是否清除。",
        "expect": "能发现该状态仍可能保持，提出可审查的本地收尾策略，而不是假设网络必然恢复。"
      }
    ],
    "quiz": {
      "q": "所有失败都应该马上重试吗？",
      "a": "不应；非法参数、过期和身份不符等错误不会因立即重试同样内容而变正确。"
    },
    "questions": [
      28,
      48,
      128,
      150
    ],
    "course": "项目网络恢复与失败状态机",
    "sources": [
      {
        "title": "OASIS · MQTT 3.1.1 规范",
        "url": "https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html"
      },
      {
        "title": "Espressif · ESP-IDF FreeRTOS",
        "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html"
      }
    ],
    "preset": {
      "a": 4,
      "b": 0
    }
  },
  {
    "id": 126,
    "title": "C++ 对象寿命、回调与循环引用",
    "chapter": "09 · ESP32 与网络",
    "model": "heap",
    "bench": null,
    "summary": "把网络异步回调持有的对象画成关系图，检查释放与线程安全是两个问题。",
    "principles": [
      "智能指针帮助表达所有权并在引用条件满足时释放对象，但不能自动保证被指对象的读写线程安全或业务状态一致。",
      "两个 shared_ptr 相互持有会形成引用环，外部所有者消失后对象仍可能无法释放；观察者关系可考虑 weak_ptr 并处理锁定失败。",
      "异步回调捕获局部对象引用或裸 this 时，要证明回调执行前对象不会销毁。项目全局网关对象与临时 JSON 文档也有不同寿命。"
    ],
    "code": {
      "file": "教学/callback_lifetime.cpp",
      "text": "/* 独立 C++ 教学片段；弱引用只处理寿命，不自动同步对象内容。 */\n#include <memory>\nstruct Node { std::shared_ptr<Node> child; std::weak_ptr<Node> parent; };\nvoid example() {\n    auto a=std::make_shared<Node>();\n    auto b=std::make_shared<Node>();\n    a->child=b;\n    b->parent=a;\n    if (auto owner=b->parent.lock()) { /* 此作用域持有有效所有者 */ }\n}"
    },
    "steps": [
      {
        "action": "纸上画 A、B 双向 shared 所有权，再移除外部引用。",
        "expect": "引用环仍可能让对象存活，问题不是“智能指针失灵”，而是所有权图没有出口。"
      },
      {
        "action": "把反向关系改为观察者，并让回调晚于对象销毁到达。",
        "expect": "回调需要检测对象是否仍有效；内存寿命与线程竞争都需分别验证。"
      }
    ],
    "quiz": {
      "q": "shared_ptr 的引用计数安全是否证明对象成员可以并发修改？",
      "a": "不能；引用计数操作与对象内容同步不是同一保证。"
    },
    "questions": [
      85,
      110,
      130
    ],
    "course": "嵌入式 C++ 与异步网关岗位拓展",
    "sources": [
      {
        "title": "Espressif · ESP-IDF FreeRTOS",
        "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html"
      }
    ],
    "preset": {
      "a": 9,
      "b": 16
    }
  },
  {
    "id": 127,
    "title": "从源文件到程序：预处理、编译、汇编、链接",
    "chapter": "10 · 调试、存储与升级",
    "model": "linker",
    "bench": null,
    "summary": "把每一步的输入输出说清，再定位错误属于哪个阶段。",
    "principles": [
      "预处理展开包含和宏，编译将语言语义变成目标代码表示，汇编形成目标文件，链接解析符号与重定位并安排最终地址。",
      "目标文件通常仍保留待解决的符号和地址关系；链接成功不等于镜像已经被正确装载，更不等于复位入口和初始化流程正确。",
      "裸机工程还需启动代码建立栈、初始化数据段及必要运行库状态，再进入应用入口；本机编译出的程序不能直接替代 ARM 固件。"
    ],
    "code": {
      "file": "教学/startup_sections.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nextern unsigned data_image[], data_ram[], bss_ram[];\nfor (unsigned i=0;i<data_words;i++) data_ram[i]=data_image[i];\nfor (unsigned i=0;i<bss_words;i++) bss_ram[i]=0;\n/* 按目标启动文件完成其他初始化后进入应用。 */\napplication_entry();"
    },
    "steps": [
      {
        "action": "把模型 data 和 BSS 都设为 16 字节，逐步观察复制与清零。",
        "expect": "有初值的可写数据从镜像获得初值，BSS 运行空间初始化为零。"
      },
      {
        "action": "纸上分别放入“语法错误”“未定义符号”“错误入口地址”三种故障。",
        "expect": "能把它们归到不同构建或启动阶段，而不是都称为编译器错误。"
      }
    ],
    "quiz": {
      "q": "为什么编译器已经生成 .o 文件，链接仍可能失败？",
      "a": "每个目标文件未必独立包含所有被引用符号，最终地址和定义还需链接阶段解决。"
    },
    "questions": [
      36,
      37,
      67,
      88
    ],
    "course": "工程构建与启动流程拓展",
    "sources": [
      {
        "title": "GNU GCC · 编译选项与过程",
        "url": "https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html"
      },
      {
        "title": "GNU ld · 链接脚本",
        "url": "https://sourceware.org/binutils/docs/ld/Scripts.html"
      }
    ],
    "preset": {
      "a": 16,
      "b": 16
    }
  },
  {
    "id": 128,
    "title": "链接脚本、LMA/VMA、静态链接与 PLT",
    "chapter": "10 · 调试、存储与升级",
    "model": "linker",
    "bench": null,
    "summary": "区分文件中的镜像位置、运行位置和动态符号解析机制。",
    "principles": [
      "LMA 描述镜像装载位置，VMA 描述运行时地址；例如 .data 的初值放在 Flash，运行时复制到 RAM，二者可以不同。",
      "静态链接在构建时纳入所需代码，动态链接依赖运行时装载与符号解析。PLT/GOT 是特定 ABI 下常见的动态调用机制，不是所有 MCU 调用都经过 PLT。",
      "函数参数传递、返回值和被调用者保存寄存器由目标 ABI 规定，还会受类型与优化影响；不能把 x86 宿主栈布局当成 ARM 的证明。"
    ],
    "code": {
      "file": "教学/load_run_address.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned flash_lma=0x08010000u;\nunsigned ram_vma=0x20000000u;\nunsigned initialized_bytes=16;\n/* 启动代码按链接器给出的边界复制，而非猜固定偏移。 */\nunsigned static_ram_need=initialized_bytes+16u;"
    },
    "steps": [
      {
        "action": "把 data 镜像和 RAM 目的地画成两段不同地址，运行复制/清零模型。",
        "expect": "同一变量的初值存储位置和运行访问地址可以不同。"
      },
      {
        "action": "纸上比较普通静态函数调用、动态库经 PLT/GOT 调用和内联后的无调用情形。",
        "expect": "知道先确认平台 ABI 与构建方式，再解释跳转和栈现场。"
      }
    ],
    "quiz": {
      "q": "const 关键字是否足以证明对象一定放在 Flash？",
      "a": "不足；存储位置还取决于对象性质、链接布局、使用方式和工具链。"
    },
    "questions": [
      67,
      68,
      69,
      70,
      71,
      82,
      88
    ],
    "course": "链接、ABI 与 Linux 动态装载拓展",
    "sources": [
      {
        "title": "GNU ld · 链接脚本",
        "url": "https://sourceware.org/binutils/docs/ld/Scripts.html"
      },
      {
        "title": "GNU GCC · 编译选项与过程",
        "url": "https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html"
      }
    ],
    "preset": {
      "a": 24,
      "b": 32
    }
  },
  {
    "id": 129,
    "title": "O0 正常、O2 异常：先查未定义行为",
    "chapter": "10 · 调试、存储与升级",
    "model": "fault",
    "bench": null,
    "summary": "把优化当作暴露问题的条件，沿最小复现找真实原因。",
    "principles": [
      "优化会改变寄存器分配、内联、访问顺序和时间关系，使越界、悬空指针、未初始化变量、别名违规或数据竞争更容易显现。",
      "volatile 适用于特定可观察访问需求，不能作为修复所有优化问题的通用贴纸；它不修复越界、寿命错误或复合操作竞态。",
      "应保留符号、优化级别、编译选项和触发输入，比较最小代码与反汇编。性能优化还需测量时限、数值误差和程序大小。"
    ],
    "code": {
      "file": "教学/optimization_evidence.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned index=8;\nunsigned data[8]={0};\nif (index>=sizeof(data)/sizeof(data[0])) {\n    report_invalid_index(index);\n    return;\n}\nuse(data[index]);"
    },
    "steps": [
      {
        "action": "选择故障模型的栈损坏或非法指令示例，先确认可保存哪些证据。",
        "expect": "不会把一个地址直接当作根因；需要关联构建和输入。"
      },
      {
        "action": "纸上把未检查下标的访问改成先验证范围，再比较 O0/O2 的行为假设。",
        "expect": "修复的是程序前置条件；如果靠降低优化掩盖故障，缺陷仍可能存在。"
      }
    ],
    "quiz": {
      "q": "只在 O2 出错能证明编译器有 bug 吗？",
      "a": "不能；先排除语言未定义行为、数据竞争、ABI 与时序依赖，再构造工具链最小复现。"
    },
    "questions": [
      76,
      81,
      89
    ],
    "course": "编译优化与故障证据拓展",
    "sources": [
      {
        "title": "GNU GCC · 编译选项与过程",
        "url": "https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html"
      }
    ],
    "preset": {
      "a": 2,
      "b": 1
    }
  },
  {
    "id": 130,
    "title": "HardFault：状态寄存器与异常帧",
    "chapter": "10 · 调试、存储与升级",
    "model": "fault",
    "bench": null,
    "summary": "先确认故障类型和地址有效性，再看 PC 附近的指令。",
    "principles": [
      "CFSR、HFSR 及相关地址寄存器可以说明故障类别，但地址寄存器只有在对应有效标志满足时才可信，不能无条件解释其数值。",
      "异常入栈自身失败或栈已损坏时，保存的 PC/LR 可能不可读或不完整；先验证 MSP/PSP、EXC_RETURN 和帧类型再取现场。",
      "项目目前的 HardFault_Handler 直接进入 board_panic 停止输出，没有完整现场记录。本课的记录流程是改进设计，不是已实现功能。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "void HardFault_Handler(void) { board_panic(); }"
    },
    "steps": [
      {
        "action": "在模型里依次选择精确总线访问、异常入栈失败和未定义指令。",
        "expect": "不同类型提供的证据不同；入栈失败不能继续假设完整栈帧存在。"
      },
      {
        "action": "纸上使用同一版本 ELF，把可信的 PC/LR 映射到函数与反汇编，再向上追错误来源。",
        "expect": "崩溃指令可能只是最终受害者，前面的越界写或悬空指针才可能是根因。"
      }
    ],
    "quiz": {
      "q": "HardFault 里调用复杂 printf 有什么问题？",
      "a": "可能再次访问坏栈、锁或堆，破坏原始证据或造成二次故障。"
    },
    "questions": [
      77,
      78,
      91,
      129,
      147
    ],
    "course": "Cortex-M 故障分析专题",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      }
    ],
    "preset": {
      "a": 0,
      "b": 1
    }
  },
  {
    "id": 131,
    "title": "最小故障记录与无调试器追踪",
    "chapter": "10 · 调试、存储与升级",
    "model": "fault",
    "bench": null,
    "summary": "设计一条即使设备复位，也能保留下次诊断线索的证据链。",
    "principles": [
      "最小记录应包含版本、复位或故障类别、可信的 PC/LR、关键状态与校验，优先保存解释问题所必需的少量信息。",
      "写入介质要考虑掉电、写耗时、擦写粒度和故障上下文限制；常规日志接口能工作，不等于它适合异常路径。",
      "没有调试器时可结合阶段标记、计数器、LED/串口、上次启动记录和可重复输入逐层缩小范围，但不能把猜测写成已定位原因。"
    ],
    "code": {
      "file": "教学/fault_record.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nstruct FaultRecord { unsigned version,reason,pc,lr,check; };\nstruct FaultRecord record={1,0,0,0,0};\nif (stack_frame_valid) { record.pc=saved_pc; record.lr=saved_lr; }\nrecord.reason=fault_status;\n/* 使用经过验证的最小持久化路径，不能在此任意擦写或申请内存。 */"
    },
    "steps": [
      {
        "action": "切换模型“能否安全保存最小记录”，比较故障栈可读与不可读两种情况。",
        "expect": "只保存有依据且可安全读取的字段，不为了填满记录再次触发故障。"
      },
      {
        "action": "纸上删除 PC 字段或版本字段，说明之后定位会失去哪些能力。",
        "expect": "版本错配会让地址映射失真，字段选择应围绕实际诊断问题。"
      }
    ],
    "quiz": {
      "q": "只保存最后一条字符串日志够不够？",
      "a": "通常不够；它可能尚未输出或来自另一版本，最好有结构化最小记录与校验。"
    },
    "questions": [
      48,
      77,
      78,
      129,
      147,
      149
    ],
    "course": "现场证据与可诊断性拓展",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      }
    ],
    "preset": {
      "a": 1,
      "b": 1
    }
  },
  {
    "id": 132,
    "title": "日志预算：不让打印拖慢控制",
    "chapter": "10 · 调试、存储与升级",
    "model": "network",
    "bench": null,
    "summary": "把日志也当作有界生产消费链路，观察慢串口的积压。",
    "principles": [
      "格式化、锁等待和阻塞发送都会消耗时间，日志本身可能改变故障时序；控制任务和 ISR 中尤其要限制最坏开销。",
      "可用有界缓冲、等级过滤、采样打印、事件编号和异步消费控制成本；缓冲满时应明确丢弃策略并记录丢失计数。",
      "日志时间戳要能关联采样、命令和输出，但不能假装时间完全无扰动。关键业务状态应有专用证据，不依赖每条文本都成功输出。"
    ],
    "code": {
      "file": "教学/bounded_log.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned queued=0, capacity=16, dropped=0;\nif (queued<capacity) queued++;\nelse dropped++;\n/* 后台任务限速输出；控制路径不等待日志空间。 */"
    },
    "steps": [
      {
        "action": "把产生速率设为每秒 20 条、发送能力设为每秒 2 条。",
        "expect": "队列达到容量后出现丢弃，不能认为把打印改成队列就能无限可靠。"
      },
      {
        "action": "纸上为“普通采样日志”和“补液超时故障”设计不同记录策略。",
        "expect": "高频可采样或覆盖，关键故障需可追踪记录，同时保持控制路径有界。"
      }
    ],
    "quiz": {
      "q": "加日志后故障消失，说明问题已经修好吗？",
      "a": "不是；日志可能改变调度和竞争窗口，应继续检查根因并保留无日志验证。"
    },
    "questions": [
      48,
      78,
      94,
      148,
      149
    ],
    "course": "调试测量与实时日志拓展",
    "sources": [
      {
        "title": "FreeRTOS · 内核参考手册",
        "url": "https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf"
      }
    ],
    "preset": {
      "a": 20,
      "b": 2
    }
  },
  {
    "id": 133,
    "title": "IWDG：超时计算与业务存活",
    "chapter": "10 · 调试、存储与升级",
    "model": "watchdog",
    "bench": null,
    "summary": "看计数器继续走，再问喂狗条件是否覆盖真正重要的任务。",
    "principles": [
      "IWDG 使用独立低速时钟，超时近似由分频和重装值决定；本项目按 32 kHz、64 分频、RLR=2000 估算为 4.002 s。",
      "独立 RC 时钟存在误差，估算不能当成实测常数。设计应把最慢可能工作时间与最短可能超时一起考虑。",
      "项目由 ControlTask 每轮输出后喂狗，其他任务卡住而控制任务仍运行时未必复位；更完整的健康监督需要定义各业务的进度证据。"
    ],
    "code": {
      "file": "stm32/src/board.c",
      "anchor": "watchdog.Instance=IWDG; watchdog.Init.Prescaler=IWDG_PRESCALER_64; watchdog.Init.Reload=2000;"
    },
    "steps": [
      {
        "action": "保持 LSI=32000 Hz，停止喂狗 1000 ms，再改成 5000 ms。",
        "expect": "短停顿未达估算超时，长停顿触发复位请求模型。"
      },
      {
        "action": "把假定 LSI 改为 40000 Hz，重算相同配置。",
        "expect": "估算超时变为 3.2016 s，说明不能用 CPU 主频或一个固定经验值代替。"
      }
    ],
    "quiz": {
      "q": "在高频中断里无条件喂狗能证明应用健康吗？",
      "a": "不能；中断仍运行时，控制任务可能早已失去业务进度。"
    },
    "questions": [
      48,
      100,
      146,
      149
    ],
    "course": "江协 IWDG 基础 → 项目健康监督",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "lsi": 32000,
      "stall": 5000
    }
  },
  {
    "id": 134,
    "title": "复位原因、掉电与偶发重启实验",
    "chapter": "10 · 调试、存储与升级",
    "model": "fault",
    "bench": null,
    "summary": "先保存上次启动的证据，再建立可重复的故障注入记录。",
    "principles": [
      "上电、低电压、软件复位、外部复位和看门狗复位可能留下不同标志；启动早期应按芯片规则读取并保存，再按设计清除。",
      "某些复位标志可同时存在，供电与复位线路也可能互相影响。不能仅凭“重启发生在开泵时”就断定唯一原因。",
      "项目有 boot 标识用于隔离旧命令，但尚未保存完整复位原因。测试应记录输入、输出负载、版本、运行时间与恢复后的状态。"
    ],
    "code": {
      "file": "教学/reset_evidence.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned reset_flags=read_reset_flags();\nunsigned previous_boot=load_boot_counter();\nstore_minimal_boot_record(previous_boot+1,reset_flags);\nclear_reset_flags_after_recording();\n/* 上述介质与清除顺序需按目标器件设计；项目尚未实现。 */"
    },
    "steps": [
      {
        "action": "纸上建立测试表：开泵、断网、传感器断线、低电压等一次只注入一种条件。",
        "expect": "每条记录有可比较输入与复位证据，避免只凭印象归因。"
      },
      {
        "action": "观察原 C 实验的补液超时与断网自治，再区分业务告警和 MCU 真复位。",
        "expect": "保护停止、网络掉线与 CPU 重启不是同一种事件，应用显示应分开。"
      }
    ],
    "quiz": {
      "q": "重新生成 boot id 能代替复位原因记录吗？",
      "a": "不能；它证明启动域变化，不解释为什么发生变化。"
    },
    "questions": [
      48,
      78,
      146,
      149,
      150
    ],
    "course": "系统可靠性与故障注入拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      }
    ],
    "preset": {
      "a": 0,
      "b": 1
    }
  },
  {
    "id": 135,
    "title": "RTC、备份域与运行时间计数",
    "chapter": "10 · 调试、存储与升级",
    "model": "rtc",
    "bench": null,
    "summary": "把日历时刻、单调持续时间和时钟误差分清。",
    "principles": [
      "RTC 适合保持日历与低速计时，HAL tick 常用于运行中的相对时间；网络校时的日历可能跳变，不应随意用于本地泵运行时限。",
      "备份域、时钟来源和供电决定复位或掉电后能保留什么。工程是否装有晶体与备用电源，需要结合板图，不能只看 RTC 外设存在。",
      "当前种菜机 STM32 未实现 RTC 日历；ESP32 用网络校时获得 epoch 时间。本课分频误差模型不包含温漂、校准或实际电池状态。"
    ],
    "code": {
      "file": "教学/rtc_drift.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\ndouble expected_hz=32768.0, actual_hz=32770.0;\ndouble elapsed_s=3600.0;\ndouble divider=(127.0+1)*(255.0+1);\ndouble error_s=elapsed_s*(actual_hz/expected_hz-1.0);"
    },
    "steps": [
      {
        "action": "把实际频率设为 32768 Hz、观察时间设为 3600 s。",
        "expect": "理想模型无累计频偏误差，总分频为 32768。"
      },
      {
        "action": "改为 32770 Hz，计算一小时累计误差；再纸上分析日历被网络校时回拨。",
        "expect": "误差约 0.220 s；本地运行时限应继续用合适的持续时间基准。"
      }
    ],
    "quiz": {
      "q": "有 RTC 就一定在掉电后继续走吗？",
      "a": "不一定，取决于备份供电、时钟源、配置和硬件连接。"
    },
    "questions": [
      25,
      48,
      154
    ],
    "course": "江协 RTC 基础 → 时钟域拓展",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "a": 32768,
      "b": 3600
    }
  },
  {
    "id": 136,
    "title": "Flash 擦写、粒度与配置存储",
    "chapter": "10 · 调试、存储与升级",
    "model": "flash",
    "bench": null,
    "summary": "先观察位只能向一个方向编程，再设计能恢复的参数记录。",
    "principles": [
      "典型 Flash 编程把位从 1 变 0，恢复为 1 需要擦除；擦除通常按页或扇区进行，不能把单字节修改当成普通 RAM 写入。",
      "真实器件还限制编程单位、对齐、电压、忙状态和寿命。教学按位与模型只展示位方向，不计算擦写电气条件。",
      "保存配置需要版本、长度、校验、有效标记和掉电恢复策略；不能每轮控制都擦写同一区域，也不能在控制时限内随意阻塞等待。"
    ],
    "code": {
      "file": "教学/flash_bits.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nunsigned old_byte=0x00, requested=0x5A;\nunsigned without_erase=old_byte&requested;\nunsigned erased=0xFF;\nunsigned after_erase=erased&requested;\nint verify_ok=(after_erase==requested);"
    },
    "steps": [
      {
        "action": "设置写入 0x5A，关闭“先擦除”，观察已有 0x00 的结果。",
        "expect": "仍得到 0x00，不能把需要变成 1 的位直接编程出来。"
      },
      {
        "action": "打开“先擦除”，再纸上给配置记录加入双副本和校验。",
        "expect": "位模型可得到 0x5A；恢复策略还必须处理整块擦除与中途断电。"
      }
    ],
    "quiz": {
      "q": "CRC 正确就证明这条配置是最新的吗？",
      "a": "不能；还要比较版本、代次和提交状态，校验不提供时间顺序。"
    },
    "questions": [
      48,
      142,
      143,
      144
    ],
    "course": "江协 Flash 基础 → 持久化配置拓展",
    "sources": [
      {
        "title": "江协科技 · STM32 入门官方课程",
        "url": "https://www.jiangxiekeji.com/tutorial/32.html"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "a": 90,
      "b": 1
    }
  },
  {
    "id": 137,
    "title": "Bootloader 跳转 APP 的前置条件",
    "chapter": "10 · 调试、存储与升级",
    "model": "boot",
    "bench": null,
    "summary": "把跳转当作受控启动交接，而不是调用任意地址的普通函数。",
    "principles": [
      "先验证镜像边界、初始栈指针、复位入口与目标芯片约束；入口需要符合指令状态和映射规则，不能只检查不是全 0xFF。",
      "交接前要处理已启用外设、DMA、中断、SysTick 和向量表等状态，应用也必须知道自己的链接地址与初始化责任。",
      "修改 MSP 后继续执行普通 C 代码可能受编译器栈使用影响，实际实现需要经过验证的跳转尾部。当前项目没有 Bootloader，以下仅为设计流程。"
    ],
    "code": {
      "file": "教学/boot_handoff.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nif (!validate_image_header_and_vectors()) return;\nstop_owned_dma_and_peripherals();\ndisable_and_clear_pending_interrupts();\nset_application_vector_table();\njump_with_verified_assembly_trampoline();\n/* 各辅助步骤不是现成函数；须按芯片与ABI实现并验证。 */"
    },
    "steps": [
      {
        "action": "在双槽模型中保持新槽不完整，检查启动选择。",
        "expect": "继续启动旧有效槽；不能为了“试一下”跳入部分写入镜像。"
      },
      {
        "action": "纸上漏掉向量表重定位，让 APP 运行后第一次中断发生。",
        "expect": "主程序可能已跳转但中断仍指向错误表，说明交接远不止设置 PC。"
      }
    ],
    "quiz": {
      "q": "为什么不能直接从 RTOS 任务里随便改 MSP 再调用 APP？",
      "a": "当前模式、PSP/MSP、编译器栈访问、外设和异常状态都需要明确交接。"
    },
    "questions": [
      67,
      88,
      141,
      142
    ],
    "course": "Bootloader 设计拓展 / 项目未实现",
    "sources": [
      {
        "title": "Arm · Cortex-M4 通用用户指南",
        "url": "https://documentation-service.arm.com/static/5f2ac4ab60a93e65927bbdbf"
      },
      {
        "title": "SEGGER · Cortex-M Bootloader 与应用跳转",
        "url": "https://kb.segger.com/Using_embOS_for_Cortex-M_with_a_bootloader"
      }
    ],
    "preset": {
      "a": 2,
      "b": 1
    }
  },
  {
    "id": 138,
    "title": "固件头、CRC、哈希与数字签名",
    "chapter": "10 · 调试、存储与升级",
    "model": "boot",
    "bench": null,
    "summary": "区分随机损坏检测、内容摘要和来源认证，再决定是否允许执行镜像。",
    "principles": [
      "固件头可以声明目标、版本、大小、入口和校验信息，但所有字段本身都是待验证输入；先检查长度、边界和整数溢出再访问内容。",
      "CRC 适合发现一定范围的传输或存储差错，哈希提供内容摘要；未经认证的哈希仍可能被攻击者连同镜像一起替换。",
      "数字签名在受信公钥与正确验证流程下认证镜像来源，还要考虑密钥管理和防回滚。校验通过不能自动证明镜像适合当前硬件。"
    ],
    "code": {
      "file": "教学/image_validation.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nint target_ok=check_target();\nint range_ok=check_image_bounds();\nint digest_ok=range_ok && verify_digest();\nint signature_ok=digest_ok && verify_trusted_signature();\nint bootable=target_ok && signature_ok && check_version_policy();"
    },
    "steps": [
      {
        "action": "在双槽模型中写满四块，但把完整校验通过设为 0。",
        "expect": "新槽不能成为启动镜像；完整写入与合法性检查是两个条件。"
      },
      {
        "action": "纸上构造“CRC 重算正确但来自不可信来源”的镜像，比较各检查能力。",
        "expect": "CRC 不能提供来源认证，需要信任根和签名验证，而不是再换一种校验和。"
      }
    ],
    "quiz": {
      "q": "把 SHA 摘要与镜像一起下载，足以证明来源可信吗？",
      "a": "不够；摘要本身的真实性也要由可信通道或签名等机制保证。"
    },
    "questions": [
      142,
      144
    ],
    "course": "固件完整性与认证拓展",
    "sources": [
      {
        "title": "SEGGER · Cortex-M Bootloader 与应用跳转",
        "url": "https://kb.segger.com/Using_embOS_for_Cortex-M_with_a_bootloader"
      },
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      }
    ],
    "preset": {
      "a": 4,
      "b": 0
    }
  },
  {
    "id": 139,
    "title": "断电升级：双槽、最后提交与回退",
    "chapter": "10 · 调试、存储与升级",
    "model": "boot",
    "bench": null,
    "summary": "在每个写入边界断一次电，检查仍然有哪个镜像可启动。",
    "principles": [
      "先写非活动槽，完整验证后再切换启动记录，可避免在升级过程中直接破坏唯一可运行镜像；存储容量和擦写布局要支持这一设计。",
      "“最后提交”不是一句注释就能原子化。启动元数据本身也需冗余、代次、校验和断电一致性，否则镜像完整却找不到可信选择。",
      "新版本首次启动后还可设置健康确认与回退条件；必须明确哪些失败允许回退、怎样避免无限重启，以及版本安全策略。"
    ],
    "code": {
      "file": "教学/two_slot_commit.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nwrite_inactive_slot();\nif (!verify_complete_image()) return;\nwrite_redundant_boot_record_with_generation();\n/* 仅当记录可验证地提交，才改变下次启动选择。 */\nreboot_to_last_valid_committed_image();"
    },
    "steps": [
      {
        "action": "把模型写入块数依次设为 0、1、2、3，模拟中途断电。",
        "expect": "始终保留活动槽 A，部分新镜像不能被选中。"
      },
      {
        "action": "改为四块且校验通过，再把校验关闭。",
        "expect": "只有完整且验证通过时才选 B；这还不替代真实元数据断电测试。"
      }
    ],
    "quiz": {
      "q": "两个镜像槽就一定具备可靠升级吗？",
      "a": "不一定；启动记录、确认流程、擦写粒度和所有断电点仍需验证。"
    },
    "questions": [
      48,
      143,
      150
    ],
    "course": "Bootloader 断电恢复专题",
    "sources": [
      {
        "title": "SEGGER · Cortex-M Bootloader 与应用跳转",
        "url": "https://kb.segger.com/Using_embOS_for_Cortex-M_with_a_bootloader"
      }
    ],
    "preset": {
      "a": 2,
      "b": 1
    }
  },
  {
    "id": 140,
    "title": "诊断刷写状态机与故障注入覆盖",
    "chapter": "10 · 调试、存储与升级",
    "model": "boot",
    "bench": null,
    "summary": "把 UDS 等刷写协议看成受约束的阶段序列，明确等待不等于成功。",
    "principles": [
      "诊断刷写通常涉及会话、权限、下载请求、块传输、传输结束、校验与复位等阶段；服务参数和状态条件必须按采用的规范实现。",
      "响应等待、最终成功和最终失败属于不同结果，超时、重复块、错误顺序和取消都要有明确定义。当前项目没有 UDS 栈，本课是岗位拓展。",
      "测试应覆盖状态转换、边界长度、重复与乱序、校验失败、通信中断和每个写入点断电，并检查系统是否保持可恢复状态。"
    ],
    "code": {
      "file": "教学/update_states.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum UpdateState { IDLE, AUTHORIZED, RECEIVING, VERIFYING, COMMITTED };\nenum UpdateState state=RECEIVING;\nint all_blocks=0, verified=0;\nif (all_blocks) state=VERIFYING;\nif (state==VERIFYING && verified) state=COMMITTED;\n/* 还需规范中的会话、超时、错误响应与断电策略。 */"
    },
    "steps": [
      {
        "action": "先用双槽模型观察完整性和提交，再纸上给接收阶段加入重复块与错误序号。",
        "expect": "重复处理不能破坏镜像，错误顺序应有定义的拒绝或恢复路径。"
      },
      {
        "action": "列出每条状态转换的正常、超时、断电和校验失败测试，记录可启动版本。",
        "expect": "测试覆盖状态和恢复条件，而不仅是成功刷写一次。"
      }
    ],
    "quiz": {
      "q": "收到“处理尚未完成”的响应，是否可以立即把升级显示成成功？",
      "a": "不能；必须等待最终状态并核验镜像或版本，超时也要结束本次事务。"
    },
    "questions": [
      48,
      145,
      149,
      150
    ],
    "course": "汽车诊断 / UDS 岗位拓展",
    "sources": [
      {
        "title": "AUTOSAR · Diagnostic Communication Manager",
        "url": "https://www.autosar.org/fileadmin/standards/R21-11/CP/AUTOSAR_SWS_DiagnosticCommunicationManager.pdf"
      },
      {
        "title": "SEGGER · Cortex-M Bootloader 与应用跳转",
        "url": "https://kb.segger.com/Using_embOS_for_Cortex-M_with_a_bootloader"
      }
    ],
    "preset": {
      "a": 3,
      "b": 1
    }
  },
  {
    "id": 141,
    "title": "采样滤波：滑动平均、一阶低通与有效值",
    "chapter": "11 · 控制与岗位拓展",
    "model": "filter",
    "bench": null,
    "summary": "先观察平滑与延迟的取舍，再把截止频率、采样率和计算量连起来。",
    "principles": [
      "滑动平均可维护窗口和，更新时减去最旧样本、加上新样本，避免每次重新求和；累加类型必须容纳窗口内最大总量。",
      "一阶递推 y+=α(x-y) 的 α 越小，阶跃越慢但变化更平滑。α 本身不是赫兹，只有给出采样率和离散设计方法才能解释截止频率。",
      "要实现 1 kHz 低通，应先确定高于两倍截止频率并留有设计余量的采样率，再设计并验证离散频响。下方模型只演示阶跃，不输出伯德图。",
      "RC 低通的理想截止频率为 1/(2πRC)，但接入 ADC 后还涉及源阻抗和采样保持。数字滤波不能恢复采样前已经混叠的信息。",
      "含谐波电流的有效值是平方均值再开方，平均值可能为零却仍有发热；平均电流、RMS 和峰值对应不同设计指标。"
    ],
    "code": {
      "file": "教学/moving_average.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nenum { N=4 };\nint samples[N]={0}; long sum=0; unsigned pos=0;\nsum-=samples[pos];\nsamples[pos]=new_sample; sum+=new_sample;\npos=(pos+1)%N;\nlong average=sum/N; /* 启动未填满时需另定归一策略。 */"
    },
    "steps": [
      {
        "action": "把输入阶跃设为 50，比较 α=0.2 与 α=0.8 的二十个样本。",
        "expect": "较小 α 响应更慢；单看输出平滑不能证明测量误差更小。"
      },
      {
        "action": "纸上对序列 0、4、0、4 计算均值和 RMS，再推导四点滑动和更新。",
        "expect": "均值为 2、RMS 约 2.828，二者不应混用；递推和减少重复计算。"
      }
    ],
    "quiz": {
      "q": "把滤波器调得越平滑就一定越适合控制吗？",
      "a": "不一定，额外延迟会降低扰动响应甚至影响闭环稳定性，需要连同采样周期评估。"
    },
    "questions": [
      15,
      41,
      56,
      60,
      61,
      62,
      156
    ],
    "course": "采样基础之后 · 数字信号处理岗位拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      }
    ],
    "preset": {
      "a": 50,
      "b": 0.2
    }
  },
  {
    "id": 142,
    "title": "离散 PI：采样周期、整定与定点缩放",
    "chapter": "11 · 控制与岗位拓展",
    "model": "pid",
    "bench": null,
    "summary": "把连续控制意图落实为每次采样的一次状态更新，不把调参当成试几个数字。",
    "principles": [
      "离散积分每次累加 Ki×Ts×误差，改变采样周期却不改相应系数会改变积分作用；先说明参数单位和离散化形式。",
      "整定需要对象模型或实验依据、目标带宽和延迟预算。比较超调、调节时间、稳态误差、噪声与负载变化，不以一次好看曲线证明所有工况稳定。",
      "定点化要选择量程、缩放和累加宽度，明确乘法中间结果、移位、舍入与饱和；不能只把 float 换成 int。",
      "本种菜机原控制器采用滞回、步进补光与时限保护，没有 PI/PID。下方固定系数 PI 与一阶对象仅用于理解闭环，不作为植物或电机参数。"
    ],
    "code": {
      "file": "教学/discrete_pi.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nfloat Ts=0.01f, Kp=2.0f, Ki=1.0f;\nfloat error=reference-measurement;\nfloat candidate=integral+Ki*Ts*error;\nfloat raw=Kp*error+candidate;\nfloat output=clamp(raw,0.0f,100.0f);\n/* 限幅后的积分策略另见抗饱和课。 */"
    },
    "steps": [
      {
        "action": "在模型中把目标设为 80，逐步观察误差、积分、输出和对象响应。",
        "expect": "输出不是直接等于目标，积分是跨样本保留的内部状态。"
      },
      {
        "action": "纸上把 Ts 从 10 ms 改为 5 ms，保持连续 Ki 不变；再设计 Q 格式范围。",
        "expect": "每步积分增量随 Ts 减半，定点乘积要有足够中间位宽，避免溢出。"
      }
    ],
    "quiz": {
      "q": "新算法比 PID 好，面试时应怎样证明？",
      "a": "给出相同采样、约束、扰动和评价指标下的对比；没有实际做过则说明推导与验证计划，不编造经历。"
    },
    "questions": [
      5,
      8,
      9,
      31,
      47,
      52,
      66,
      90,
      134
    ],
    "course": "江协 PID 思路与控制岗位拓展",
    "sources": [
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      }
    ],
    "preset": {
      "a": 80,
      "b": 1
    }
  },
  {
    "id": 143,
    "title": "积分抗饱和、离散 D 项与微分滤波",
    "chapter": "11 · 控制与岗位拓展",
    "model": "pid",
    "bench": null,
    "summary": "让控制需求超过执行器能力，观察积分是否还在无意义增长。",
    "principles": [
      "输出达到上限后，真实执行器已无法继续增大，但积分若继续沿同方向增长，会积累隐藏状态，使条件改变后仍迟迟不能恢复。",
      "条件积分在饱和且误差继续推向饱和方向时暂停累加；反算方法则用限幅前后差值反馈修正积分，参数和离散实现需验证。",
      "抗饱和不能替代正确的执行器模型、量程和保护。种菜机补光的 0–100% 截断与 PI 积分状态不是同一概念，不应混称。",
      "完整 PID 还含微分：原始 D[k]=Kd·(e[k]−e[k−1])/Ts 容易放大高频噪声。为减少设定值阶跃冲击，可改对测量微分并取负号；一阶滤波用时间常数 τf 限制高频增益，τf 增大会增加滞后。",
      "对 −Kd·s/(1+τf·s) 用后向欧拉离散，得到 d[k]=(τf·d[k−1]−Kd·(y[k]−y[k−1]))/(τf+Ts)。这段 PID 教学代码与下方固定增益 PI 模型不同，页面没有 D 项或微分滤波参数，算例需要纸上推导。"
    ],
    "code": {
      "file": "教学/pid_filtered_derivative.c",
      "text": "/* 独立 PID 教学片段；页面共享模型仅计算 PI 抗饱和。 */\nfloat error=target-y;\nfloat d=(tau_f*d_previous-Kd*(y-y_previous))/(tau_f+Ts);\nfloat candidate=integral+Ki*Ts*error;\nfloat raw=Kp*error+candidate+d;\nfloat output=clamp(raw,0.0f,100.0f);\nif (raw==output || error*(raw-output)<0) integral=candidate;\nd_previous=d;\ny_previous=y;\n/* 要求Ts>0、tau_f>=0，首次运行应以当前测量初始化y_previous。 */"
    },
    "steps": [
      {
        "action": "保持目标 80，把条件积分从关闭改为开启，比较前期输出饱和时的积分量。",
        "expect": "开启后不再沿加重饱和的方向累积，内部状态和输出限幅一起变化。"
      },
      {
        "action": "纸上让目标突然减小，比较有巨大积分储存和已受控积分的恢复过程。",
        "expect": "仅看饱和期间同为 100% 的输出，无法判断恢复时是否出现长拖尾。"
      },
      {
        "action": "纸上取 Ts=0.01 s、τf=0.04 s、Kd=0.1，旧 d=0、测量从 10 跳到 11，再计算新 d；保持测量不变只改变目标。",
        "expect": "滤波微分第一次为 −2；无滤波时为 −10，显示噪声增益差异。只改变目标时测量微分不直接跳变，P 项仍会响应；这些不是共享 PI 动画输出。"
      }
    ],
    "quiz": {
      "q": "把最终输出 clamp 到范围内，能自动防止积分饱和吗？",
      "a": "不能，输出截断与内部积分更新必须分别设计。"
    },
    "questions": [
      5,
      47,
      135,
      157
    ],
    "course": "PID 抗饱和专项",
    "sources": [
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      },
      {
        "title": "MathWorks · 离散 PID 与一阶微分滤波",
        "url": "https://www.mathworks.com/help/simulink/slref/discretepidcontroller.html"
      }
    ],
    "preset": {
      "a": 80,
      "b": 0
    }
  },
  {
    "id": 144,
    "title": "从电机等效方程到 FOC 数据流",
    "chapter": "11 · 控制与岗位拓展",
    "model": "motor",
    "bench": null,
    "summary": "先观察电流和转速是两个状态，再在纸上展开三相电机的完整控制链。",
    "principles": [
      "直流等效式 v=Ri+L·di/dt+Keω 与 J·dω/dt=Kt i−负载−Bω，说明电感和惯量使电流、速度不能瞬间跳变。下方仅运行这一简化模型。",
      "PMSM 的 FOC 通常包含电流采样、Clarke/Park 变换、d/q 电流调节、反变换与 PWM 调制；角度方向和极对数错误会破坏坐标对应。",
      "ADC 采样需避开不可靠开关区间并与 PWM 同步；死区用于避免桥臂直通，却会引入与电流方向等因素有关的电压误差，补偿必须有测量依据。",
      "启动前检查母线、电流零偏、相序、位置反馈和保护路径；三相电流不平衡要区分传感器偏置、接线、功率级和控制坐标问题。",
      "六步与 FOC 的选择取决于性能、位置获取、噪声与成本要求。若没有亲自实现过 FOC，应展示已验证的实验和未完成部分，不能把直流模型称作实际调通经历。"
    ],
    "code": {
      "file": "教学/motor_equivalent.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nfloat di=(voltage-R*current-Ke*omega)/L;\nfloat domega=(Kt*current-load-B*omega)/J;\ncurrent+=dt*di;\nomega+=dt*domega;\n/* 直流等效模型，不含PMSM坐标变换、逆变桥和完整FOC。 */"
    },
    "steps": [
      {
        "action": "外加 12 V、负载 0.1 Nm，逐步观察电流先变化、转速随后变化。",
        "expect": "电气与机械状态具有不同动态，不能用占空比直接替代测得的转速。"
      },
      {
        "action": "纸上画 FOC 数据流并标记采样、角度、控制输出与 PWM 更新时刻。",
        "expect": "能说明每一步的输入输出与延迟；下方模型不产生三相波形或死区效果。"
      }
    ],
    "quiz": {
      "q": "三相电流看起来不平衡，是否应该立即增加 PI 增益？",
      "a": "不应；先验证采样偏置、相序、角度、功率级和时序，再讨论控制参数。"
    },
    "questions": [
      1,
      4,
      45,
      49,
      131,
      132,
      133,
      138
    ],
    "course": "电机岗位拓展 / 项目未使用 FOC",
    "sources": [
      {
        "title": "Imperix · 永磁同步电机矢量控制",
        "url": "https://imperix.com/doc/implementation/field-oriented-control-of-pmsm"
      }
    ],
    "preset": {
      "a": 12,
      "b": 0.1
    }
  },
  {
    "id": 145,
    "title": "电流、速度、位置环与姿态估计",
    "chapter": "11 · 控制与岗位拓展",
    "model": "motor",
    "bench": null,
    "summary": "让每一层控制对应一个物理状态，避免把内环 PD 当作所有系统的固定答案。",
    "principles": [
      "级联环通常先保证内层较快且稳定，再设计外层，使外层看见可用的近似响应；带宽关系要结合采样和延迟，而不是机械套一个固定比例。",
      "负载惯量、摩擦、转矩常数和执行器能力影响速度环。下方直流模型可看负载变化，但没有闭合电流环或速度环，整定结论需另行验证。",
      "编码器计数先对应机械角，再乘极对数得到电角；方向、零点与索引标定各有职责，不应把一次计数回零当作完整电角对齐。",
      "无人机等系统需先区分角度环、角速度环和状态估计。陀螺积分易漂移，加速度信息受运动扰动，互补或卡尔曼等融合方法依赖模型与噪声假设。",
      "P、I、D 的选择取决于对象和目标：D 可增加阻尼但放大噪声，I 可消除某些稳态偏差却引入饱和问题，不能先假定所有内环都必须使用 PD。"
    ],
    "code": {
      "file": "教学/angle_domains.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nfloat counts_per_turn=400.0f;\nfloat mechanical_angle=count*360.0f/counts_per_turn;\nunsigned pole_pairs=4;\nfloat electrical_angle=mechanical_angle*pole_pairs+offset;\n/* 方向、极对数和零偏需校准，计数单位需含实际倍频规则。 */"
    },
    "steps": [
      {
        "action": "在直流模型中保持 12 V，把负载从 0.1 Nm 改为 0.3 Nm。",
        "expect": "相同电压下机械加速过程改变，负载参数是控制器面对的真实约束。"
      },
      {
        "action": "纸上为电流、速度、位置或姿态各画一个测量与参考信号，再列出采样和总延迟。",
        "expect": "能说明内外环的物理含义，角度估计与闭环控制不再混成一个框。"
      }
    ],
    "quiz": {
      "q": "为什么不能只靠阶跃超调小就证明整定合适？",
      "a": "还要检查负载变化、稳态误差、噪声、饱和、稳定裕度和最坏延迟等指标。"
    },
    "questions": [
      7,
      46,
      47,
      50,
      51,
      53,
      57,
      136,
      137
    ],
    "course": "级联控制与运动控制岗位拓展",
    "sources": [
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      },
      {
        "title": "Imperix · 永磁同步电机矢量控制",
        "url": "https://imperix.com/doc/implementation/field-oriented-control-of-pmsm"
      }
    ],
    "preset": {
      "a": 12,
      "b": 0.1
    }
  },
  {
    "id": 146,
    "title": "弱磁约束、无感启动与切换条件",
    "chapter": "11 · 控制与岗位拓展",
    "model": "motor",
    "bench": null,
    "summary": "把“更高速”放回电压、电流和可观测性约束内解释。",
    "principles": [
      "高速时反电动势占用电压裕量。PMSM 弱磁常通过适当负 d 轴电流降低等效磁链，但受到电流、母线电压、退磁与温升等约束。",
      "在简化电流圆约束中 id²+iq²≤Imax²，分给弱磁的电流会减少可用 q 轴电流；不能声称弱磁能在任何速度保持同样转矩。",
      "基于反电动势的无感估计在低速和静止时信息较弱，启动可能需要对齐、开环加速或其他观测方式；切换应验证估计可信度与连续性。",
      "下方只展示直流等效电机的反电动势和负载关系，不计算 PMSM 弱磁轨迹、观测器或无感启动；本课相关约束使用纸上算例分析。"
    ],
    "code": {
      "file": "教学/current_circle.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nfloat current_limit=10.0f, id=-6.0f;\nfloat remaining=current_limit*current_limit-id*id;\nfloat iq_limit=remaining>0?sqrtf(remaining):0;\n/* 还需电压椭圆、机器参数、温度与退磁等约束。 */"
    },
    "steps": [
      {
        "action": "先在直流模型中比较外加 6 V 与 12 V 的电流、转速演变，识别反电动势项。",
        "expect": "能看到电压和速度耦合，但不能由此推出真实 PMSM 弱磁曲线。"
      },
      {
        "action": "纸上令 Imax=10 A、id=-6 A，计算剩余 iq 上限，并列出无感切换条件。",
        "expect": "电流圆给出 iq 最大 8 A；实际电压与机器限制可能进一步缩小可行范围。"
      }
    ],
    "quiz": {
      "q": "转速高了就可以直接从开环切到估计角度吗？",
      "a": "不够；还要验证估计方向、相位、幅值或可信指标，以及切换前后控制量连续性。"
    },
    "questions": [
      2,
      3,
      139,
      140
    ],
    "course": "弱磁与无位置传感器控制岗位拓展",
    "sources": [
      {
        "title": "Imperix · 永磁同步电机矢量控制",
        "url": "https://imperix.com/doc/implementation/field-oriented-control-of-pmsm"
      }
    ],
    "preset": {
      "a": 12,
      "b": 0.1
    }
  },
  {
    "id": 147,
    "title": "Buck/Boost、电源纹波与器件约束",
    "chapter": "11 · 控制与岗位拓展",
    "model": "power",
    "bench": null,
    "summary": "先推导理想稳态关系，再列出为什么真实电源不能按一个公式选器件。",
    "principles": [
      "理想连续导通稳态下，Buck 近似 Vout=D·Vin，Boost 近似 Vout=Vin/(1−D)；断续导通、损耗和限流会改变关系，D 接近一不意味着真实电压无限大。",
      "理想 CCM Buck 的电感峰峰纹波 ΔIL=(Vin−Vo)·D/(L·fs)，三角电容电流产生 ΔVC≈ΔIL/(8fsC)，电阻项 ΔVESR≈ΔIL·ESR。两项峰值并不必然同相；简单相加是粗略保守估算，还忽略寄生尖峰、偏压降容和控制动态。",
      "定量算例取 Vin=12 V、Vo=6 V、D=0.5、L=100 μH、fs=100 kHz、C=100 μF、ESR=50 mΩ：ΔIL=0.3 A，电容项约 3.75 mV、ESR 项约 15 mV，近似和为 18.75 mV。CCM 假设还要求负载电流足以保持电感电流不断流。",
      "器件预算还要覆盖最大负载加半个纹波形成的峰值电流、电感饱和、MOS 损耗、温升和电容额定值。测量时缩短探头地回路并明确带宽；ADC 调理同时检查量程、偏置、滤波与源阻抗，平均电压正确并不足够。",
      "RMS、THD 与 PF 衡量不同性质：PF=P/(Vrms·Irms)，有畸变时不等于单纯 cosφ。PFC 需使输入电流按目标跟随电压，前馈只补偿可测扰动且受模型和延迟影响。"
    ],
    "code": {
      "file": "教学/buck_ripple_budget.c",
      "text": "/* 独立纸上算例：理想CCM，三角纹波；模型仅显示稳态变比。 */\ndouble vin=12, vo=6, duty=0.5;\ndouble L=100e-6, fs=100e3, C=100e-6, esr=0.05;\ndouble delta_i=(vin-vo)*duty/(L*fs);\ndouble ripple_c=delta_i/(8*fs*C);\ndouble ripple_esr=delta_i*esr;\ndouble rough_sum=ripple_c+ripple_esr;\n/* 0.3 A，0.00375 V，0.015 V，近似和0.01875 V；不是开关尖峰模型。 */"
    },
    "steps": [
      {
        "action": "输入 12 V，占空比 0.5，观察 Buck 与 Boost 的理想输出，再改成 0.8。",
        "expect": "理想结果分别从 6/24 V 变为 9.6/60 V，实际器件约束必须另外验证。"
      },
      {
        "action": "纸上逐行计算 100 μH、100 kHz、100 μF、50 mΩ 的纹波；再把 C 加倍与 ESR 减半分别计算。",
        "expect": "原电容项 3.75 mV、ESR 项 15 mV；C 加倍只使电容项减半，ESR 减半只使电阻项减半。页面稳态变比模型不会自动出现这些纹波。"
      },
      {
        "action": "纸上令输出负载 1 A，估计电感峰值和低谷，再把负载减到 0.1 A，检查 CCM 假设。",
        "expect": "原纹波估计下 1 A 负载约为 0.85–1.15 A；0.1 A 时理想三角低谷将为负，非同步 Buck 会进入断续导通，需换模型。"
      }
    ],
    "quiz": {
      "q": "平均电压正确就能证明电源适合 MCU 和传感器吗？",
      "a": "不能；纹波、瞬态、启动、限流、热与噪声都可能影响系统。"
    },
    "questions": [
      13,
      14,
      15,
      18,
      19,
      20,
      21,
      22,
      23,
      56,
      60,
      63,
      64,
      65
    ],
    "course": "电源与信号调理岗位拓展",
    "sources": [
      {
        "title": "ST · STM32F407 参考手册 RM0090",
        "url": "https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf"
      },
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      },
      {
        "title": "Texas Instruments · Buck 功率级计算 SLVA477",
        "url": "https://www.ti.com/lit/an/slva477c/slva477c.pdf"
      }
    ],
    "preset": {
      "a": 12,
      "b": 0.5
    }
  },
  {
    "id": 148,
    "title": "PLL、SOGI、PR 与并网控制的边界",
    "chapter": "11 · 控制与岗位拓展",
    "model": "pll",
    "bench": null,
    "summary": "先看相位误差负反馈收敛，再把完整算法拆成可单独验证的模块。",
    "principles": [
      "PLL 一般包含鉴相、环路滤波和频率/相位更新，目标是追踪输入相位与频率；下方仅计算包裹到 ±π 的相位误差收敛，不是完整 PLL。",
      "SOGI 以估计角频率 ω′ 为中心：D(s)=kω′s/(s²+kω′s+ω′²)，Q(s)=kω′²/(s²+kω′s+ω′²)。令 s=jω′ 可得 D=1、Q=−j，即等幅正交；k 影响带宽，较小 k 提高选频性但响应更慢。ω′ 的单位是 rad/s，50 Hz 对应约 314.16 rad/s。",
      "带限 PR 可写为 GPR(s)=Kp+2Kr·ωc·s/(s²+2ωc·s+ω0²)，本课把共振增益记作 Kr。目标频率处共振项为 Kr，ωc 控制峰宽；这是有限增益形式，不能与理想 PR 的无穷峰混用，离散化还要考虑采样和延迟。",
      "理想刚性电网、忽略电阻时，LCL 谐振 fr=[1/(2π)]√[(L1+L2)/(L1L2C)]。取 L1=1 mH、L2=0.5 mH、C=10 μF 得约 2.757 kHz；网侧额外电感会改变谐振，阻尼和数字延迟必须加入完整稳定性分析。",
      "先规定 i 从逆变器流向电网、vL=vinv−vgrid−Ri，便有 L·di/dt=vinv−vgrid−Ri，可取 vinv*=vgrid+Ri+L·di*/dt+反馈校正。若电流或电压正方向改变，前馈符号必须随方程重推；这不是直接套在任意 dq 坐标里的符号口诀。"
    ],
    "code": {
      "file": "教学/sogi_pr_lcl_paper.c",
      "text": "/* 独立 C99 频域算例；辅助打印另定义，不是页面PLL模型。 */\n#include <complex.h>\n#include <math.h>\ndouble pi=3.141592653589793,w0=2*pi*50,k=sqrt(2);\ndouble complex s=I*w0,den=s*s+k*w0*s+w0*w0;\ndouble complex D=k*w0*s/den,Q=k*w0*w0/den;\ndouble Kp=1,Kr=20,wc=2*pi*5;\ndouble complex PR=Kp+2*Kr*wc*s/(s*s+2*wc*s+w0*w0);\ndouble L1=1e-3,L2=0.5e-3,C=10e-6;\ndouble fr=sqrt((L1+L2)/(L1*L2*C))/(2*pi);\n/* 目标频率处D=1、Q=-j、PR=21；fr约2757 Hz。 */"
    },
    "steps": [
      {
        "action": "相位阶跃设为 1 rad，比较比例系数 0.1 与 0.5 的收敛过程。",
        "expect": "较大系数在此简化模型中更快，但不能据此宣布真实 PLL 带宽可任意提高。"
      },
      {
        "action": "纸上代入 s=jω0、ω0=2π·50，求 SOGI 的 D/Q 与 Kp=1、Kr=20 的 PR 目标频率增益。",
        "expect": "D=1、Q=−j，PR=21；Q 相对 D 滞后 90°。当前相位误差模型不会生成 SOGI 正交波形或 PR 伯德图。"
      },
      {
        "action": "纸上计算 1 mH、0.5 mH、10 μF 的 fr，再给网侧增加 0.5 mH；按定义的电流方向推导电压前馈。",
        "expect": "fr 从约 2.757 kHz 降到约 2.251 kHz；电网电压项以正号加入给定逆变电压。谐振、频偏、延迟与符号都要在完整模型另行验证。"
      }
    ],
    "quiz": {
      "q": "PLL 相位曲线平滑就能证明并网控制稳定吗？",
      "a": "不能；还需看频率跟踪、谐波、扰动、延迟、对象谐振与完整闭环裕度。"
    },
    "questions": [
      31,
      32,
      54,
      55,
      58,
      59,
      64,
      65
    ],
    "course": "电力电子控制岗位拓展",
    "sources": [
      {
        "title": "Imperix · SOGI PLL",
        "url": "https://imperix.com/doc/implementation/sogi-pll"
      },
      {
        "title": "Imperix · PR 控制器",
        "url": "https://imperix.com/doc/implementation/proportional-resonant-controller"
      },
      {
        "title": "Imperix · 离散 PI 控制器",
        "url": "https://imperix.com/doc/implementation/pi-controller"
      },
      {
        "title": "Imperix · LCL 滤波器与主动阻尼",
        "url": "https://imperix.com/doc/implementation/active-damping-of-lcl-filters"
      }
    ],
    "preset": {
      "a": 1,
      "b": 0.2
    }
  },
  {
    "id": 149,
    "title": "Linux 启动链、设备树与 DMA 地址",
    "chapter": "11 · 控制与岗位拓展",
    "model": "linux",
    "bench": null,
    "summary": "从裸机思维跨到操作系统，先定位启动阶段和资源映射关系。",
    "principles": [
      "常见嵌入式启动链可能包括 ROM、早期装载器、引导程序、内核、根文件系统和用户空间初始化；具体链路按平台确认，错误阶段决定能使用的诊断工具。",
      "设备树描述硬件，compatible、status、资源和依赖影响设备创建与驱动绑定。probe 未成功可能是匹配、资源、时钟、电源或延迟探测，不能只盯驱动函数。",
      "CPU 虚拟地址经页表和 TLB 等机制转换，DMA 使用设备可见地址；IOMMU 或总线桥可能使其不同于 CPU 物理地址，应使用平台 DMA API。",
      "本种菜机 F407/FreeRTOS 不运行 Linux。下方共享模型仅展示用户态非阻塞读取，启动链、设备树与地址映射属于代码和图示分析。"
    ],
    "code": {
      "file": "教学/dma_address_spaces.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nvoid *cpu_pointer=allocate_dma_suitable_buffer();\ndma_addr_t device_address=map_for_device(cpu_pointer,length);\nif (mapping_failed(device_address)) return;\nstart_device_dma(device_address);\n/* 生命周期、方向和同步按Linux DMA API完成，不直接强转指针。 */"
    },
    "steps": [
      {
        "action": "纸上把“内核没有启动”“根文件系统挂载失败”“驱动 probe 失败”放到不同阶段。",
        "expect": "可选择不同日志与检查点，不把三种故障都称为设备树有问题。"
      },
      {
        "action": "画 CPU 虚拟地址、CPU 物理地址、设备 DMA 地址三栏，再追踪一次映射。",
        "expect": "设备地址不能一般性地由用户指针强转得到；当前 F407 模型也不是 Linux MMU 模型。"
      }
    ],
    "quiz": {
      "q": "设备树节点存在，是否证明设备驱动已经正常工作？",
      "a": "不能；还需要匹配、资源获取、probe 成功及实际通信等证据。"
    },
    "questions": [
      72,
      75,
      121,
      124,
      125
    ],
    "course": "Linux 驱动岗位拓展 / 项目未使用",
    "sources": [
      {
        "title": "Linux Kernel · Device Tree 使用模型",
        "url": "https://docs.kernel.org/devicetree/usage-model.html"
      },
      {
        "title": "Linux Kernel · DMA 地址与所有权",
        "url": "https://www.kernel.org/doc/html/latest/core-api/dma-api-howto.html"
      }
    ],
    "preset": {
      "a": 8,
      "b": 3
    }
  },
  {
    "id": 150,
    "title": "Linux 阻塞 I/O、poll/epoll 与根因分析",
    "chapter": "11 · 控制与岗位拓展",
    "model": "linux",
    "bench": null,
    "summary": "读到 EAGAIN 后回到等待，把事件通知、可读条件和数据消费分开。",
    "principles": [
      "阻塞读取在条件不满足时等待，非阻塞读取通常报告当前不可完成。驱动需围绕共享条件注册等待并在条件变化后唤醒，防止丢失唤醒竞态。",
      "poll/epoll 报告就绪并不承诺未来读取永远成功。ET 模式常配合非阻塞读取直到 EAGAIN，另行处理 EINTR、EOF 和真实错误。",
      "可睡眠上下文与原子上下文决定同步机制选择；持有自旋锁或处于硬中断中不能随意调用可能睡眠的接口，PREEMPT_RT 等配置还需按其规则分析。",
      "core dump 与调用栈描述出错现场，不必然直接指出越界写、对象寿命或并发竞争的源头。必须使用匹配二进制、复现输入和对象所有权继续追踪。",
      "系统调用是用户态请求内核服务的一条路径，中断来自不同事件机制；不要把“都切换到内核”理解为相同调用约定与阻塞条件。"
    ],
    "code": {
      "file": "教学/read_until_eagain.c",
      "text": "/* 独立教学片段；解释原理，不是项目已实现功能。 */\nfor (;;) {\n    int n=read(fd,buffer,sizeof(buffer));\n    if (n>0) { consume(buffer,n); continue; }\n    if (n<0 && errno==EINTR) continue;\n    if (n<0 && errno==EAGAIN) break;\n    handle_eof_or_error(n); break;\n}"
    },
    "steps": [
      {
        "action": "设置到达 8 字节、每次最多读 3 字节，逐步运行。",
        "expect": "依次消费 3、3、2 字节，最后遇到 EAGAIN 后回到事件等待。"
      },
      {
        "action": "把到达字节数改为 0，再纸上构造读取后对象被另一线程释放的故障。",
        "expect": "空缓冲不应忙等；内存寿命错误需要对象关系与同步证据，不能靠重试 read 修复。"
      }
    ],
    "quiz": {
      "q": "ET 模式只读一次就返回事件等待，可能留下什么问题？",
      "a": "缓冲中可能仍有数据而没有新的边沿通知，应用应按非阻塞语义消费到 EAGAIN。"
    },
    "questions": [
      72,
      122,
      123,
      126,
      129,
      130
    ],
    "course": "Linux 并发与驱动接口岗位拓展",
    "sources": [
      {
        "title": "Linux Kernel · Driver Basics",
        "url": "https://www.kernel.org/doc/html/latest/driver-api/basics.html"
      },
      {
        "title": "Linux man-pages · epoll",
        "url": "https://man7.org/linux/man-pages/man7/epoll.7.html"
      }
    ],
    "preset": {
      "a": 8,
      "b": 3
    }
  }
];
