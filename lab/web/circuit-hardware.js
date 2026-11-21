/* Pin identity: ST UM1472 Rev 7, Fig.9; DS8626 Rev 12, Fig.13 (top view). */
(() => {
  const packageNames=(
    'PE2 PE3 PE4 PE5 PE6 VBAT PC13 PC14 PC15 VSS VDD PH0 PH1 NRST PC0 PC1 PC2 PC3 VDD VSSA VREF+ VDDA PA0 PA1 PA2 '+
    'PA3 VSS VDD PA4 PA5 PA6 PA7 PC4 PC5 PB0 PB1 PB2 PE7 PE8 PE9 PE10 PE11 PE12 PE13 PE14 PE15 PB10 PB11 VCAP_1 VDD '+
    'PB12 PB13 PB14 PB15 PD8 PD9 PD10 PD11 PD12 PD13 PD14 PD15 PC6 PC7 PC8 PC9 PA8 PA9 PA10 PA11 PA12 PA13 VCAP_2 VSS VDD '+
    'PA14 PA15 PC10 PC11 PC12 PD0 PD1 PD2 PD3 PD4 PD5 PD6 PD7 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9 PE0 PE1 VSS VDD'
  ).split(' ');
  const rows={
    P1:[['GND','GND'],['VDD','VDD'],['GND','NRST'],['PC1','PC0'],['PC3','PC2'],['PA1','PA0'],['PA3','PA2'],['PA5','PA4'],['PA7','PA6'],['PC5','PC4'],['PB1','PB0'],['GND','PB2'],['PE7','PE8'],['PE9','PE10'],['PE11','PE12'],['PE13','PE14'],['PE15','PB10'],['PB11','PB12'],['PB13','PB14'],['PB15','PD8'],['PD9','PD10'],['PD11','PD12'],['PD13','PD14'],['PD15','NC'],['GND','GND']],
    P2:[['GND','GND'],['5V','5V'],['3V','3V'],['PH0','PH1'],['PC14','PC15'],['PE6','PC13'],['PE4','PE5'],['PE2','PE3'],['PE0','PE1'],['PB8','PB9'],['BOOT0','VDD'],['PB6','PB7'],['PB4','PB5'],['PD7','PB3'],['PD5','PD6'],['PD3','PD4'],['PD1','PD2'],['PC12','PD0'],['PC10','PC11'],['PA14','PA15'],['PA10','PA13'],['PA8','PA9'],['PC8','PC9'],['PC6','PC7'],['GND','GND']]
  };
  const uses={
    PB6:{title:'补光 PWM',mode:'复用推挽 · AF2',function:'TIM4_CH1',file:'stm32/src/board.c',anchor:'__HAL_TIM_SET_COMPARE',manual:'PB6 是端口名，LQFP100 封装脚号为 92。当前项目选择 AF2 / TIM4_CH1；PSC=83、ARR=999，比较值由 led*10 写入。',board:'板载音频器件也连接 PB6。图中外部驱动为教学电路，实际改接时需要结合板载电路检查。'},
    PB8:{title:'光照传感器时钟',mode:'复用开漏 · AF4',function:'I2C1_SCL',file:'stm32/src/board.c',anchor:'gpio(GPIOB,GPIO_PIN_8|GPIO_PIN_9',manual:'SCL 由 I2C 控制器产生时钟。开漏信号释放时依靠上拉回到高电平；本项目配置 100 kHz。'},
    PB9:{title:'光照传感器数据',mode:'复用开漏 · AF4',function:'I2C1_SDA',file:'stm32/src/board.c',anchor:'static bool bh_read',manual:'SDA 在主机和传感器之间双向传递地址、数据和应答。BH1750 使用 7 位地址 0x23。',board:'本开发板的音频控制数据线也连接 PB9。'},
    PB0:{title:'DHT11 单线数据',mode:'开漏输出，可读取 IDR',function:'GPIOB.0',file:'stm32/src/board.c',anchor:'static bool dht_read',manual:'主机先拉低，再释放数据线。输入缓冲读取传感器响应，DWT 用于测量脉宽；并非 I2C 或 UART。'},
    PB1:{title:'数字液位输入',mode:'输入，上拉',function:'GPIOB.1',file:'stm32/src/board.c',anchor:'bool board_water_low',manual:'当前代码把 PB1 的高电平解释为低液位。它是开关量输入，无法直接给出液量百分比。'},
    PA2:{title:'STM32 串口发送',mode:'复用推挽 · AF7',function:'USART2_TX',file:'stm32/src/board.c',anchor:'uart.Instance=USART2',manual:'连接对方的 RX。项目设置 115200、8 数据位、无奇偶校验、1 停止位。',board:'使用 3.3 V 逻辑电平；它不是 RS-232 电气接口。'},
    PA3:{title:'STM32 串口接收',mode:'复用 · AF7',function:'USART2_RX',file:'stm32/src/board.c',anchor:'rx_dma.Instance=DMA1_Stream5',manual:'连接对方的 TX。USART2 接收数据由 DMA1 Stream5 / Channel4 写入 512 字节循环缓冲。'},
    PD12:{title:'风扇控制',mode:'推挽输出',function:'GPIOD.12',file:'stm32/src/board.c',anchor:'HAL_GPIO_WritePin(GPIOD,GPIO_PIN_12,o->fan',manual:'该引脚输出风扇开关指令。功率负载需要驱动级；GPIO 本身不直接带动风扇。',board:'开发板上同时连接绿色用户 LED（LD4）。'},
    PD13:{title:'滴灌控制',mode:'推挽输出',function:'GPIOD.13',file:'stm32/src/board.c',anchor:'HAL_GPIO_WritePin(GPIOD,GPIO_PIN_13,o->drip',manual:'该引脚输出滴灌泵开关指令。实际通断还受液位、最长运行和冷却状态约束。',board:'开发板上同时连接橙色用户 LED（LD3）。'},
    PD14:{title:'喷雾控制',mode:'推挽输出',function:'GPIOD.14',file:'stm32/src/board.c',anchor:'HAL_GPIO_WritePin(GPIOD,GPIO_PIN_14,o->mist',manual:'该引脚输出喷雾泵开关指令，与滴灌、补液输出进行互斥和时长检查。',board:'开发板上同时连接红色用户 LED（LD5）。'},
    PD15:{title:'补液控制',mode:'推挽输出',function:'GPIOD.15',file:'stm32/src/board.c',anchor:'HAL_GPIO_WritePin(GPIOD,GPIO_PIN_15,o->refill',manual:'该引脚输出补液泵开关指令。持续补液而液位不恢复时，控制器锁存超时故障。',board:'开发板上同时连接蓝色用户 LED（LD6）。'},
    PA13:{title:'SWD 调试数据',mode:'调试复用',function:'SWDIO',manual:'默认用于 ST-LINK 调试连接。本项目没有把它重新配置为普通 GPIO。'},
    PA14:{title:'SWD 调试时钟',mode:'调试复用',function:'SWCLK',manual:'与 SWDIO 配合进行下载和调试。不要把调试引脚与普通串口 RX/TX 混淆。'},
    PA0:{title:'板载用户按键',mode:'本项目未配置',function:'GPIO / WKUP',manual:'本板连接蓝色用户按键。当前种菜机没有使用该按键；按键和 EXTI 可作为独立学习实验。'}
  };
  const rails={GND:['地参考','电源回流与信号参考'],VSS:['数字地','芯片数字电源地'],VSSA:['模拟地','模拟部分电源地'],VDD:['数字电源','当前模型为 3.3 V；与板上默认跳线相连'],VDDA:['模拟电源','模拟部分供电，不是普通 GPIO'],VBAT:['备份域电源','RTC / 备份域供电'], 'VREF+':['模拟参考','ADC 正参考电压'], '3V':['板载 3.3 V','当前模型按默认跳线与 VDD 相连'],'5V':['板载 5 V','不能把它当作 3.3 V 信号输出'],NRST:['复位输入','低电平复位控制'],BOOT0:['启动配置','复位时参与启动模式选择'],NC:['未连接','此排针位置未接到 MCU 信号'],'VCAP_1':['内部稳压输出','用于内部稳压器稳定电容，不作为外部负载电源'],'VCAP_2':['内部稳压输出','用于内部稳压器稳定电容，不作为外部负载电源']};
  const headers=Object.entries(rows).flatMap(([header,pairs])=>pairs.flatMap((pair,row)=>pair.map((name,col)=>({id:`${header}.${row*2+col+1}`,header,number:row*2+col+1,name,row,col,x:header==='P1'?68+col*27:390+col*27,y:160+row*22}))));
  const packagePins=packageNames.map((name,index)=>({number:index+1,name}));
  function describe(name){
    const role=uses[name],rail=rails[name];
    return {name,package:packagePins.filter(p=>p.name===name).map(p=>p.number),headers:headers.filter(p=>p.name===name).map(p=>p.id),title:role?.title||rail?.[0]||'通用 I/O / 复用引脚',mode:role?.mode||(/^[PA-Z]{2}\d+$/.test(name)?'当前项目未配置':'专用引脚'),function:role?.function||name,manual:role?.manual||rail?.[1]||'本项目暂未使用。可以作为输入/输出或选择手册列出的复用功能；具体电气限制及 AF 表请查数据手册，不能仅凭端口名推断。',board:role?.board||'',file:role?.file||null,anchor:role?.anchor||null};
  }
  window.CircuitHardware={headers,packagePins,describe,uses,manual:'https://pack-asset-service.keil.arm.com/Keil/STM32F4xx_DFP/2.17.0/MDK/Boards/ST/STM32F4-Discovery/Documentation/DM00039084.pdf#page=28',datasheet:'https://www.st.com/resource/en/datasheet/stm32f407vg.pdf#page=44'};
})();
