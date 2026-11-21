/* Pure teaching models: no HAL, MCU instruction execution, or external I/O. */
(() => {
  'use strict';
  const board='stm32/src/board.c', app='stm32/src/app.c';
  const hex=(n,width=2)=>'0x'+n.toString(16).toUpperCase().padStart(width,'0');
  const frame=(anchor,caption,values,active,extra={})=>({file:board,anchor,caption,values,active,...extra});
  const number=(key,label,min,max,value)=>({key,label,type:'number',min,max,value});
  const select=(key,label,options,value)=>({key,label,type:'select',options,value});
  const check=(key,label,value=false)=>({key,label,type:'checkbox',value});
  const bitWave=bits=>bits.map(level=>({level,duration:1}));
  const refs={
    st:['STM32F407 参考手册 RM0090','https://www.st.com/resource/en/reference_manual/dm00031020-stm32f405-415-stm32f407-417-stm32f427-437-and-stm32f429-439-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf'],
    rohm:['ROHM BH1750 数据手册（厂商文档镜像）','https://www.wemos.cc/en/latest/_static/files/bh1750fvi-tr.pdf'],
    freertos:['FreeRTOS Cortex-M 中断与临界区','https://www.freertos.org/Documentation/02-Kernel/03-Supported-devices/04-Demos/ARM-Cortex/RTOS-Cortex-M3-M4'],
    queue:['FreeRTOS 队列参考手册','https://freertos.org/media/2025/FreeRTOS_Reference_Manual_V8.2.1.pdf']
  };
  const modules={
    structure:{title:'01 芯片结构与时钟',tags:'内核 / 总线 / 存储 / RCC',
      principle:'CPU 负责取指、计算并访问寄存器；外设拥有自己的状态和时钟。总线把内核、存储器与外设连接起来。先给模块提供时钟，再配置寄存器，最后使能功能，是本工程多处初始化的共同顺序。',
      nodes:[['cpu','Cortex-M4 内核','执行 C 编译后的指令'],['memory','Flash / SRAM','程序与运行数据'],['bus','AHB / APB 总线','访问存储和外设寄存器'],['rcc','RCC / PLL','产生和分配时钟'],['peripheral','TIM / USART / I²C','独立外设状态机'],['pins','GPIO / 引脚复用','把外设信号接到封装引脚']],
      controls:[],refs:['st'],qs:[['芯片与开发板有什么区别？','STM32 芯片包含内核、存储、总线与外设。开发板还提供电源、连接器、调试器及外围器件；本图是功能结构，并非芯片版图。'],['CPU 主频等于所有外设的时钟吗？','不等于。此工程 SYSCLK/HCLK 为 168 MHz，APB1 为 42 MHz；TIM4 的输入时钟按本系列时钟树为 84 MHz。应逐条检查时钟路径。'],['为什么先开外设时钟？','RCC 的时钟门控决定模块能否工作。仅把 GPIO 配成复用功能，不能替代给对应 TIM、UART 或 I²C 模块开时钟。']],
      make:()=>[
        frame('static void clock_init','从芯片结构看程序入口：CPU 通过总线配置 RCC。',{阶段:'初始化',执行者:'Cortex-M4'},['cpu','bus','rcc']),
        frame('o.HSIState=','开启内部 HSI 振荡器。工程使用 HSI 作为 PLL 的输入。',{HSI:'16 MHz',时钟来源:'内部振荡器'},['rcc']),
        frame('o.PLL.PLLM=16','PLL 分频与倍频：16 MHz ÷ 16 × 336 ÷ 2 = 168 MHz。',{PLLM:16,PLLN:336,PLLP:2,SYSCLK:'168 MHz'},['rcc','cpu']),
        frame('c.APB1CLKDivider=','总线分频：AHB 168 MHz，APB1 42 MHz，APB2 84 MHz。',{AHB:'168 MHz',APB1:'42 MHz',APB2:'84 MHz'},['rcc','bus']),
        frame('__HAL_RCC_TIM4_CLK_ENABLE','使能 TIM4 时钟。APB1 分频不为 1 时，此处 TIM4 获得 2 × 42 MHz。',{TIM4输入:'84 MHz',门控:'已使能'},['rcc','peripheral']),
        frame('gpio(GPIOB,GPIO_PIN_6','PB6 选择 AF2，把 TIM4_CH1 的内部输出连接到引脚。',{引脚:'PB6',复用:'AF2',信号:'TIM4_CH1'},['peripheral','pins']),
        frame('void board_outputs','运行时 CPU 写比较值；定时器在自己的时钟下继续输出 PWM。',{CPU职责:'更新参数',TIM4职责:'计数与比较',结果:'PB6 波形'},['cpu','bus','peripheral','pins'])
      ]},
    gpio:{title:'02 GPIO 输入与输出',tags:'输入缓冲 / 输出驱动 / 上拉 / 复用',
      principle:'引脚不是一个普通变量。输入路径读取引脚电平，输出路径控制驱动管；推挽可以主动拉高或拉低，开漏只主动拉低。开漏释放后，电平还取决于上拉和外部电路。',
      nodes:[['cpu','CPU / 总线写入','访问 GPIO 寄存器'],['mode','模式与复用选择','输入 / 推挽 / 开漏 / AF'],['driver','输出驱动级','高侧与低侧开关'],['pin','封装引脚','连接外部电路'],['input','输入缓冲 / IDR','采集引脚状态'],['pull','上拉 / 下拉','释放时的默认电平']],
      controls:[select('mode','工作模式',[['pp','推挽输出'],['od','开漏输出'],['input','输入模式']],'od'),select('level','写入值 / 外部输入',[[0,'0 / LOW'],[1,'1 / HIGH']],1),check('pull','启用上拉',true)],refs:['st'],
      qs:[['写 1 一定输出高电平吗？','推挽通常由高侧驱动拉高；开漏写 1 是释放输出，需上拉和外部电路共同决定实际电平。本模型在无上拉且释放时显示 Z / 不确定。'],['IDR 与 ODR 有什么区别？','IDR 反映输入路径看到的引脚电平；ODR 是输出锁存值。它们不能在所有模式下相互替代。HAL 的置位复位写入可利用 BSRR 避免软件读改写。'],['项目中哪些引脚使用这些模式？','PD12–PD15 为推挽输出；PB0 为 DHT11 开漏；PB1 为上拉输入；PB8/PB9 是 I²C 复用开漏，PB6 是定时器复用推挽。']],
      make:o=>{
        const mode=o.mode||'od',level=Number(o.level),pull=!!o.pull;
        const pin=mode==='input'?level:mode==='od'&&level?(pull?1:'Z / 不确定'):level;
        const anchor=mode==='pp'?'gpio(GPIOD,GPIO_PIN_12':mode==='od'?'gpio(GPIOB,GPIO_PIN_0':'gpio(GPIOB,GPIO_PIN_1';
        return [frame('__HAL_RCC_GPIOA_CLK_ENABLE','先给 GPIO 端口提供时钟。',{GPIO时钟:'使能'},['cpu','mode']),
          frame(anchor,'选择模式。这里演示模式的工作原理；上方控件的改动只作用于本模型。',{模式:mode,上拉:pull?'启用':'关闭'},['mode','pull']),
          frame(mode==='input'?'bool board_water_low':'HAL_GPIO_WritePin(GPIOB,GPIO_PIN_0,GPIO_PIN_SET)',mode==='input'?'外部液位开关决定输入电平。':'输出锁存值进入驱动逻辑。开漏写 1 会关闭下拉管。',{写入或外部输入:level,高侧管:mode==='pp'&&level?'导通':'关闭',低侧管:mode!=='input'&&!level?'导通':'关闭'},['driver','pin']),
          frame(mode==='input'?'bool board_water_low':anchor,'观察引脚实际状态。当前模型忽略电容、负载和上升时间。',{模式:mode,引脚电平:pin,读回解释:typeof pin==='number'?pin:'没有保证的逻辑值'},['pin','input','pull'],{wave:typeof pin==='number'?[{name:'PIN',segments:[{level:pin,duration:1}]}]:[],marker:.5})];
      }},
    pwm:{title:'03 定时器与 PWM',tags:'PSC → CNT → ARR / CCR → PB6',
      principle:'预分频器降低计数时钟，CNT 从 0 数到 ARR 后回到 0。向上计数的 PWM1 模式中，CNT < CCR 时有效，否则无效。频率由 PSC 和 ARR 决定，占空比由 CCR 相对于 ARR+1 的比例决定。',
      nodes:[['clock','TIM4 输入时钟','本工程 84 MHz'],['psc','预分频器 PSC','每 PSC+1 个时钟计数一次'],['cnt','计数器 CNT / ARR','0 → ARR → 0'],['compare','比较器 CCR1','比较 CNT < CCR1'],['af','输出通道 / AF2','TIM4_CH1'],['pin','PB6 / 灯驱动','高低电平形成占空比']],
      controls:[number('psc','PSC 预分频值',0,65535,83),number('arr','ARR 自动重装值',1,65535,999),number('duty','占空比 %',0,100,50)],refs:['st'],
      qs:[['为什么计算公式里有 +1？','PSC=83 表示每 84 个时钟产生一次计数；CNT 从 0 到 999 一共经过 1000 个计数位置。频率为 84 MHz / (PSC+1) / (ARR+1)。'],['占空比 100% 会怎样？','当 CCR=ARR+1 时，本模型的所有合法 CNT 都满足 CNT<CCR，输出持续有效。当前工程 led=100 时设置 CCR1=1000，ARR=999。'],['PWM 是模拟输出吗？','引脚本身仍在高低电平之间切换。负载、驱动和滤波决定等效效果；本实验不把占空比直接当成已测得的电流或电压。']],
      make:o=>{
        const psc=Number(o.psc),arr=Number(o.arr),ccr=Math.round((arr+1)*Number(o.duty)/100),frequency=84000000/(psc+1)/(arr+1);
        const high=ccr/(arr+1),segments=[];for(let i=0;i<2;i++){if(high)segments.push({level:1,duration:high});if(high<1)segments.push({level:0,duration:1-high});}
        const common={PSC:psc,ARR:arr,CCR1:ccr,频率:frequency.toFixed(2)+' Hz',周期:(1e6/frequency).toFixed(2)+' μs',实际占空比:(100*high).toFixed(2)+'%'};
        const out=[frame('pwm.Instance=TIM4','项目默认 PSC=83、ARR=999。你可以修改教学值，比较周期变化。',common,['clock','psc','cnt']),frame('__HAL_TIM_SET_COMPARE','把占空比映射为比较值。当前工程用 led*10；这里允许独立改变 ARR，因此用 (ARR+1)*占空比。',common,['compare','af'])];
        for(const cnt of [...new Set([0,Math.max(0,ccr-1),Math.min(arr,ccr),arr])])out.push(frame('oc.OCMode=TIM_OCMODE_PWM1',`CNT=${cnt}，比较 ${cnt} < ${ccr}，输出为 ${cnt<ccr?'HIGH':'LOW'}。计数和比较由硬件完成，不需要 CPU 每次翻转引脚。`,{...common,CNT:cnt,PB6:cnt<ccr?'HIGH':'LOW'},['psc','cnt','compare','af','pin'],{wave:[{name:'PB6',segments}],marker:cnt/(arr+1)/2}));
        out.push(frame('pwm.Init.CounterMode','CNT 到达 ARR 后回到 0，新周期开始。',{...common,CNT:0,PB6:ccr>0?'HIGH':'LOW'},['cnt','compare','pin'],{wave:[{name:'PB6',segments}],marker:.5}));return out;
      }},
    i2c:{title:'04 I²C 与 BH1750',tags:'地址 / ACK / 数据 / 换算',
      principle:'SCL 给出同步节拍，SDA 承载地址、读写方向与数据。数据按高位先传，每 8 位后有应答位。BH1750 的两个测量字节组合成 16 位值，工程再用整数运算换算 lux。',
      nodes:[['cpu','bh_read / HAL','发起收发请求'],['i2c','I2C1 状态机','地址 / 数据 / ACK'],['pins','PB8 SCL / PB9 SDA','复用开漏与上拉'],['sensor','BH1750','转换后输出高低字节'],['buffer','raw[2]','接收两个字节'],['sample','SensorSample.lux','整数换算与有效位']],
      controls:[number('raw','传感器原始计数',0,65535,12000),check('nack','注入地址无应答')],refs:['st','rohm'],
      qs:[['0x23 与 0x46 是两个地址吗？','不是。本工程的 7 位设备地址是 0x23，HAL 参数使用左移一位的 0x46；总线读地址字节的最低位是 1，因此读地址字节为 0x47。'],['高低字节怎么拼接？','先转为足够宽的无符号类型，再用 (raw[0]<<8)|raw[1] 组合。工程用 raw*10/12 转换，整数除法会舍去小数。'],['通信失败后发生什么？','bh_read 返回 false，board_sensor_read 不设置 SENSOR_LIGHT 位。控制层之后根据有效位处理，而不是把旧数值当成新测量。']],
      make:o=>{
        const raw=Number(o.raw),hi=raw>>8,lo=raw&255,lux=Math.floor(raw*10/12),common={七位地址:'0x23',HAL地址参数:'0x46',I2C时钟:'100 kHz'};
        const stages=[frame('uint8_t on=1, mode=0x10','第一次读取前准备上电命令 0x01 与连续高分辨率命令 0x10。',common,['cpu','i2c']),frame('HAL_I2C_Master_Transmit(&i2c,0x23<<1,&on','写事务：START → 0x46 → ACK → 0x01 → ACK → STOP。',common,['i2c','pins','sensor'],{wave:i2cWave([0x46,1],[0,0]),marker:.45})];
        if(o.nack){stages[1].caption='注入地址 NACK：本模型让 HAL 收发失败，bh_read 返回 false，不继续使用测量结果。';stages[1].values={...common,地址应答:'NACK',SENSOR_LIGHT:0};stages[1].wave=i2cWave([0x46],[1]);return stages;}
        stages.push(frame('HAL_I2C_Master_Transmit(&i2c,0x23<<1,&mode','写入 0x10 配置测量模式。每条命令使用一个独立写事务。',common,['i2c','pins','sensor'],{wave:i2cWave([0x46,0x10],[0,0]),marker:.8}),frame('vTaskDelay(pdMS_TO_TICKS(180))','第一次配置后等待 180 ms。任务阻塞等待，不要求 CPU 忙等 180 ms。',{...common,等待:'180 ms',bh_ready:true},['sensor','cpu']));
        const wave=i2cWave([0x47,hi,lo],[0,0,1]);
        stages.push(frame('HAL_I2C_Master_Receive','读事务先发送 0x47。地址后由传感器应答。',common,['i2c','pins','sensor'],{wave,marker:.16}),frame('HAL_I2C_Master_Receive','接收高字节后，主机给 ACK，表示继续接收。',{...common,'raw[0]':hex(hi)},['sensor','pins','buffer'],{wave,marker:.52}),frame('HAL_I2C_Master_Receive','接收最后一个低字节后，主机结束接收并产生 STOP。此图用 NACK 表示末字节结束。',{...common,'raw[0]':hex(hi),'raw[1]':hex(lo)},['sensor','buffer'],{wave,marker:.9}),frame('*lux=','两个字节组合后整数换算；实际精度和校准还取决于传感器与光学条件。',{raw,公式:`${raw} × 10 / 12`,lux,SENSOR_LIGHT:2},['buffer','sample']));return stages;
      }},
    dht:{title:'05 DHT11 脉宽解码',tags:'GPIO / DWT / 移位 / 校验',
      principle:'DHT11 使用脉冲宽度区分位值。本工程测量每个高电平持续时间，以 width>45 μs 判为 1，然后通过左移与按位或逐位拼成 5 个字节。下面用合成脉冲演示该解码规则。',
      nodes:[['sensor','DHT11','响应与脉冲序列'],['pin','PB0 开漏 / 输入','拉低启动，释放后读回'],['dwt','DWT 周期计数器','计算两次边沿之间的时间'],['decode','移位与位或','b[i/8] << 1 | bit'],['check','求和校验','前四字节之和的低 8 位'],['sample','温湿度结构体','校验成功后提交数值']],
      controls:[number('bit','修改第几位（0–39）',0,39,0),number('width','该位高脉宽 μs',1,150,28)],refs:[],
      qs:[['45 μs 为什么会判为 0？','代码使用严格大于：width>45u。45 判为 0，46 判为 1。合成波形帮助你检查边界；它不是传感器容差的测量。'],['为什么这里不能直接用普通延时读一位？','这个驱动通过 DWT 测量边沿间隔，并为等待设置超时。若读取时机被长时间抢占，可能错过边沿；工程在时序段进入临界区，但这也会增加部分中断延迟。'],['校验正确是否等于测量准确？','校验只提供有限的传输差错检测。它不证明环境测量准确，且不能发现所有位错误；之后还要检查量程和采样新鲜度。']],
      make:o=>{
        const original=[60,0,25,0,85],decoded=[0,0,0,0,0],stages=[frame('HAL_GPIO_WritePin(GPIOB,GPIO_PIN_0,GPIO_PIN_RESET); vTaskDelay','MCU 拉低 PB0 并等待 20 ms，启动一次读取。',{阶段:'启动',低电平:'20 ms'},['pin','sensor']),frame('taskENTER_CRITICAL','释放开漏引脚并等待响应；进入时序敏感区。这里演示成功响应，不模拟真实电气边沿。',{阶段:'响应',临界区:'进入'},['sensor','pin','dwt'])];
        for(let i=0;i<40;i++){
          const originalBit=(original[i>>3]>>(7-i%8))&1,width=i===Number(o.bit)?Number(o.width):(originalBit?70:28);
          if(width>100){stages.push(frame('if (ok) ok=wait_dht(GPIO_PIN_RESET,100)','注入过长高电平，等待下降沿超过限制。原函数会退出临界区并返回失败。',{位序号:i,width,ok:false,SENSOR_DHT:0},['pin','dwt','check'],{bytes:decoded}));return stages;}
          const bit=Number(width>45);decoded[i>>3]=((decoded[i>>3]<<1)|bit)&255;
          stages.push(frame('b[i/8]=(uint8_t)','测量高脉宽 → 比较阈值 → 左移并追加当前位。输入按字节内高位到低位到达。',{i,'i / 8':Math.floor(i/8),width:width+' μs',DWT差值:width*168,bit,'当前字节':hex(decoded[i>>3])},['sensor','pin','dwt','decode'],{bytes:[...decoded],activeByte:i>>3,wave:[{name:'PB0',segments:[{level:0,duration:50},{level:1,duration:width},{level:0,duration:50}]}],marker:(50+width/2)/(100+width)}));
        }
        const checksum=(decoded[0]+decoded[1]+decoded[2]+decoded[3])&255,ok=checksum===decoded[4];
        stages.push(frame('if (!ok || (uint8_t)','退出临界区后检查求和校验。成功才继续换算温湿度；错误返回 false。',{计算校验:hex(checksum),收到校验:hex(decoded[4]),校验:ok?'通过':'失败',SENSOR_DHT:ok?1:0},['check','sample'],{bytes:decoded}));
        if(ok)stages.push(frame('*rh=b[0]*10+b[1]','示例有效帧转换为 0.1 单位。该帧表达湿度 60%、温度 25°C。',{humidity10:decoded[0]*10+decoded[1],temp10:decoded[2]*10+(decoded[3]&127)},['decode','sample'],{bytes:decoded}));return stages;
      }},
    uart:{title:'06 USART 串行移位',tags:'起始位 / LSB / 停止位 / 波特率',
      principle:'UART 不发送额外时钟线。双方约定波特率和帧格式，接收器依据起始位同步并在各位内采样。项目设置 115200、8 数据位、无奇偶校验、1 停止位，单字节共占 10 个位时间。',
      nodes:[['memory','内存中的字节','例如 0xA5'],['data','USART 数据寄存器','等待发送 / 接收的数据'],['shift','移位寄存器','最低有效位先发送'],['baud','波特率发生器','115200 bit/s'],['pin','PA2 TX / PA3 RX','引脚电平'],['peer','ESP32 UART','按相同格式还原字节']],
      controls:[number('byte','发送字节（十进制）',0,255,165)],refs:['st'],
      qs:[['0xA5 的位从哪端开始发？','8N1 UART 按 D0 到 D7 发送。多字节整数在协议中采用什么字节序，是另一层问题，不能由 UART 的位顺序推出。'],['115200 每秒能发多少字节？','8N1 无间隙时理论上为 115200/10=11520 字节/秒。74 字节约需 6.42 ms；实际吞吐还受间隙、缓冲和任务调度影响。'],['帧格式错与 CRC 错是一回事吗？','不是。USART 硬件检查帧相关条件；应用层协议还会检查帧头、版本、长度和 CRC。本模型不模拟过采样、抖动或模拟电气噪声。']],
      make:o=>{
        const byte=Number(o.byte),bits=[1,0,...Array.from({length:8},(_,i)=>(byte>>i)&1),1,1],labels=['空闲','起始位',...Array.from({length:8},(_,i)=>'D'+i),'停止位','空闲'];
        const wave=[{name:'PA2 TX',segments:bitWave(bits)}];
        return bits.map((level,i)=>frame(i===0?'uart.Instance=USART2':'return HAL_UART_Transmit',`${labels[i]}：TX=${level}。${i>=2&&i<=9?'硬件移位发送当前数据位；CPU 不逐位调用此函数。':'这里展开 HAL 调用背后的硬件过程。'}`,{字节:hex(byte),阶段:labels[i],TX:level,位时间:(1e6/115200).toFixed(3)+' μs',格式:'115200 / 8N1'},['data','shift','baud','pin','peer'],{wave,marker:(i+.5)/bits.length,bytes:[byte]}));
      }},
    dma:{title:'07 DMA 与循环缓冲',tags:'USART → DMA → SRAM / 读写指针',
      principle:'DMA 根据外设请求搬运数据，CPU 不需要为每个字节执行复制指令。循环模式写到缓冲区末尾后回到开头。CPU 仍负责及时消费；只比较两个模 512 的位置，无法识别已经绕过的整圈。',
      nodes:[['uart','USART2 接收寄存器','产生 DMA 请求'],['dma','DMA1 Stream5 / CH4','外设地址固定、内存地址递增'],['memory','SRAM rx_data[512]','循环写入'],['ndtr','NDTR 剩余计数','写入后递减，循环重载'],['cpu','CommTask / rx_pos','轮询并读取未处理字节'],['parser','proto_feed','拼帧、CRC 与命令校验']],
      controls:[number('count','CPU 暂停读取期间收到字节数',1,520,12)],refs:['st'],
      qs:[['DMA 是不需要 CPU 吗？','CPU 仍需配置、管理缓冲并消费结果。DMA 只承担选定的数据搬运。此工程关闭 HT/TC/TE 等 DMA 中断，CommTask 轮询 NDTR，而不是采用 UART IDLE 中断方案。'],['写指针等于读指针为什么不一定为空？','循环位置只保留余数。CPU 没有读走数据而 DMA 正好写满一圈时，两个位置再次相等；当前代码会直接返回 false。要识别整圈需要额外计数、事件或有约束的消费期限。'],['缓冲覆盖一定触发 UART ORE 吗？','不一定。DMA 及时取走 USART 数据后仍可能覆盖 SRAM 中未读的数据；这是软件消费不及时，与 USART 接收寄存器溢出不同。当前 ORE 恢复逻辑不能替代环形缓冲覆盖检测。']],
      make:o=>{
        const count=Number(o.count),start=506,memory=Array(512).fill(null),generations=Array(512).fill(null),out=[];
        const chosen=new Set([0,1,5,6,7,12,511,512,count].filter(i=>i<=count));
        for(let n=0;n<=count;n++){
          if(n){memory[(start+n-1)%512]=(n-1)&255;generations[(start+n-1)%512]=n;}
          if(!chosen.has(n))continue;
          const written=(start+n)%512,available=(written-start+512)%512,base=(written-8+512)%512;
          const cells=Array.from({length:16},(_,i)=>{const index=(base+i)%512;return {index,value:memory[index],sequence:generations[index],write:index===written,read:index===start};});
          out.push(frame(n===0?'rx_dma.Init.Direction=DMA_PERIPH_TO_MEMORY':'uint16_t written=',n===0?'为方便观察跨越末尾，教学初态设为读写位置都在 506。接收期间暂不消费。':n===512?'恰好接收一整圈：written 再次等于 rx_pos。现有代码会误判无新数据；模型通过额外历史计数才知道这一点。':n>512?'DMA 已覆盖一部分未读字节。当前代码只有位置差，看不到之前丢失了多少数据。':'一个字节经 DMA 写入 SRAM；地址向前移动，越过 511 后回到 0。',{已接收:n,rx_pos:start,written,NDTR:written===0?512:512-written,位置差:available,已覆盖未读字节:Math.max(0,n-512)},['uart','dma','memory','ndtr'],{cells}));
        }
        const written=(start+count)%512,available=(written-start+512)%512;
        out.push(frame(available?'*b=rx_data[rx_pos]':'if (rx_pos==written)',available?'CPU 读取 rx_data[rx_pos]，再把 rx_pos 加一。若曾发生覆盖，读到的已经不是最早那个未读字节。序号由模型额外追踪，原代码没有这项信息。':'CPU 看到相等的位置，直接返回 false。回绕本身正常，缺少整圈信息才是这个边界问题。',{返回:!!available,读到字节:available?hex(memory[start]):'无',模型追踪序号:available?generations[start]:'无',rx_pos:available?(start+1)%512:start,written},['memory','cpu','parser']));return out;
      }},
    queue:{title:'08 任务与队列复制',tags:'所有权 / 覆盖 / 容量 / 返回值',
      principle:'任务之间用队列传递对象的副本。长度为 1 的采样队列只保留最新数据；长度为 8 的命令队列保存有限个待处理命令。控制任务独占 Planter，避免多个任务直接同时修改控制状态。',
      nodes:[['sensor','SensorTask / 优先级 3','读取传感器并提交副本'],['sample','samples[1]','覆盖为最新样本'],['control','ControlTask / 优先级 4','唯一修改 Planter 的任务'],['comm','CommTask / 优先级 2','解析命令并提交副本'],['command','commands[8]','有界 FIFO'],['ack','ACK / 返回值','明确拒绝或处理结果']],
      controls:[],refs:['queue'],qs:[['传了 &s，为什么说是复制？','&s 指定复制源地址。创建队列时确定每个条目的大小，发送时复制这么多字节。队列若保存的是指针，则复制的只是指针；本项目保存的是结构体本身。'],['xQueueOverwrite 可以用于任意长度吗？','这里用于长度为 1 的 samples 和 statuses。它表示最新值覆盖；不能把这个用法直接套到长度为 8 的命令 FIFO。'],['优先级高就一直运行吗？','只有就绪任务参与选择。vTaskDelayUntil、等待队列等可以让任务阻塞；本图只演示数据流，没有运行 FreeRTOS 内核或计算真实抢占延迟。']],
      make:()=>{
        const f=(anchor,caption,values,active,extra={})=>frame(anchor,caption,values,active,{file:app,...extra});
        const out=[f('samples=xQueueCreateStatic','创建长度 1 的采样队列和长度 8 的命令队列。',{采样队列容量:1,命令队列容量:8},['sample','command']),f('xQueueOverwrite(samples,&s)','生产者提交 temp10=250 的结构体副本。',{生产者temp10:250,队列temp10:250},['sensor','sample'],{slots:['250']}),f('board_sensor_read(&s)','生产者下次把自己的对象改为 310，不会反向改动已复制的队列条目。',{生产者temp10:310,队列temp10:250},['sensor'],{slots:['250']}),f('xQueueOverwrite(samples,&s)','再次提交，长度 1 队列被最新样本替换。',{生产者temp10:310,队列temp10:310},['sensor','sample'],{slots:['310']}),f('if (xQueueReceive(samples,&s,0)','ControlTask 取出样本，交给 planter_sample。',{取出temp10:310,采样队列:'空'},['sample','control'],{slots:['空']})];
        for(let i=1;i<=8;i++)out.push(f('if (xQueueSend(commands,&c,0)','命令按到达顺序进入 FIFO，使用结构体副本。',{已占用:i,剩余:8-i},['comm','command'],{slots:Array.from({length:8},(_,j)=>j<i?'#'+(j+1):'空')}));
        out.push(f('Message ack={.type=MSG_ACK,.seq=m.seq}; ack.v[0]=9','第 9 条命令无法入队，发送 ACK=9。入队失败不应默默当成执行成功。',{已占用:8,返回:'入队失败',ACK:9},['comm','command','ack'],{slots:Array.from({length:8},(_,j)=>'#'+(j+1))}),f('for (int i=0;i<8 && xQueueReceive(commands','控制任务每轮最多消费 8 条命令，并用接收时间进行 TTL 校验。',{消费上限:8,控制周期:'100 ms'},['command','control','ack']));return out;
      }},
    irq:{title:'09 NVIC 与临界区',tags:'优先级 / BASEPRI / pending',
      principle:'Cortex-M 的中断优先级数值越小，紧迫程度越高。当前 FreeRTOS 配置的系统调用边界为逻辑优先级 5。进入这种临界区会屏蔽边界及更低紧迫程度的中断，不等于停止所有外设。',
      nodes:[['event','外设中断请求','满足条件后请求服务'],['nvic','NVIC / pending','记录等待处理的中断'],['mask','BASEPRI / 屏蔽判断','本工程边界 5 / 0x50'],['cpu','Cortex-M4 内核','接受异常并保存上下文'],['isr','ISR 服务程序','处理与清除相应事件'],['dma','DMA / 外设硬件','不因 CPU 临界区自动停止']],
      controls:[number('priority','假设中断的逻辑优先级',0,15,7)],refs:['freertos'],qs:[['数值 3 与 7，哪个更紧迫？','在这里使用的 Cortex-M 中断优先级编码中，3 更紧迫。FreeRTOS 任务优先级的数值方向不同，不要混用这两套规则。'],['临界区里的高紧迫性中断能调用 RTOS API 吗？','优先级数值小于 5 的中断不能调用需要该边界保护的 FreeRTOS API。可调用的中断也必须使用适当的 FromISR 版本；普通任务 API 不能随意搬进 ISR。'],['本项目 DHT11 临界区有什么影响？','时序敏感区可推迟受屏蔽的中断，增加延迟。USART 的 DMA 搬运仍可继续；这不保证缓冲永远不溢出。模型未执行异常压栈、尾链或实际 ISR 指令。']],
      make:o=>{
        const p=Number(o.priority),masked=p>=5;
        return [frame('taskENTER_CRITICAL','进入 DHT11 时序临界区。以下展开本端口 BASEPRI 屏蔽规则，而非读取真实寄存器。',{BASEPRI:'0x50',逻辑边界:5,中断优先级:p},['mask','cpu','dma']),frame('taskENTER_CRITICAL',masked?'请求到来后保持 pending，暂不被 CPU 服务。':'该中断比边界更紧迫，BASEPRI 不屏蔽它；它可能打断时序敏感区。',{BASEPRI:'0x50',pending:masked?'等待':'可被接受',被屏蔽:masked},masked?['event','nvic','mask','dma']:['event','nvic','cpu','isr']),frame('taskEXIT_CRITICAL','退出最外层临界区后解除这里的 BASEPRI 限制，符合条件的 pending 中断可以得到服务。',{BASEPRI:'0x00',中断优先级:p,结果:'可被接受'},['nvic','mask','cpu','isr'])];
      }},
    watchdog:{title:'10 IWDG 独立看门狗',tags:'独立时钟 / 分频 / 递减 / 喂狗 / 复位',
      principle:'独立看门狗使用 LSI 时钟驱动递减计数。软件及时重装计数可避免超时；若控制任务卡住、不再喂狗，计数耗尽会请求复位。能否代表整个系统健康，取决于喂狗条件的设计。',
      nodes:[['lsi','独立 LSI 振荡器','与 CPU 主时钟不同'],['divider','IWDG 预分频','工程配置 /64'],['counter','内部递减计数器','RLR=2000；不直接读回计数'],['reload','重装载 / 喂狗','HAL_IWDG_Refresh'],['control','ControlTask','本工程每轮控制后喂狗'],['reset','复位请求','超时后重新启动系统']],
      controls:[number('lsi','假定 LSI 频率 Hz',10000,60000,32000),number('stall','停止喂狗时长 ms',100,10000,5000)],refs:['st'],
      qs:[['为什么称为独立看门狗？','它由独立低速时钟驱动，不能把 CPU 主频直接代入超时公式。这里的 LSI 频率是模型参数；真实 RC 频率会随器件和环境变化。'],['定时喂狗能证明所有任务正常吗？','不能。当前代码由 ControlTask 喂狗，其他任务异常但控制任务仍正常运行时，未必触发看门狗。更全面的方案需要明确各任务的存活条件。'],['本项目的超时时间是多少？','按模型 LSI=32 kHz、分频64、RLR=2000 估算为 (2000+1)*64/32000=4.002 s。真实硬件还需考虑时钟误差、更新同步和配置，不能把估算当作测量。']],
      make:o=>{
        const lsi=Number(o.lsi),stall=Number(o.stall),timeout=2001*64/lsi*1000;
        const common={LSI假定值:lsi+' Hz',分频:64,RLR:2000,理想超时:timeout.toFixed(3)+' ms'};
        const out=[frame('watchdog.Instance=IWDG','配置独立看门狗。此处的内部计数与时间均为理想化模型。',common,['lsi','divider','counter']),frame('void board_watchdog_feed','控制任务完成一轮后调用喂狗函数，重装内部计数。',{...common,距上次喂狗:'0 ms',内部计数模型:2000},['control','reload','counter'])];
        for(const elapsed of [...new Set([Math.min(100,stall),Math.min(1000,stall),Math.min(stall,timeout)])].sort((a,b)=>a-b)){
          const expired=elapsed>=timeout,counter=Math.max(0,2000-Math.floor(elapsed*lsi/64000));
          out.push(frame('void board_watchdog_feed',expired?'软件没有再次调用本行，硬件看门狗请求复位。高亮的是“缺失的喂狗位置”，不是说软件执行了复位语句。':'模拟控制任务卡住：软件未再次执行喂狗调用，LSI 驱动计数继续递减。',{...common,距上次喂狗:elapsed.toFixed(3)+' ms',内部计数模型:counter,复位请求:expired},expired?['lsi','divider','counter','reset']:['lsi','divider','counter']));
        }
        return out;
      }}
  };
  function i2cWave(bytes,acks){
    const scl=[1,1],sda=[1,0];
    bytes.forEach((byte,i)=>{for(const bit of [...Array.from({length:8},(_,b)=>(byte>>(7-b))&1),acks[i]]){scl.push(0,1);sda.push(bit,bit);}});
    scl.push(0,1,1);sda.push(0,0,1);
    return [{name:'SCL PB8',segments:bitWave(scl)},{name:'SDA PB9',segments:bitWave(sda)}];
  }
  window.BoardModels={modules,refs,hex};
})();
