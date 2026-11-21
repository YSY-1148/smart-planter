/* Additional wiring exercises. ADC/SPI/EXTI are explicitly independent extensions. */
(() => {
 const M=window.CircuitModels,G=window.CircuitGuides,net=(label,a,b)=>({label,a,b}),scope=net('示波器地夹接公共地','scope.GND','GND');
 M.parts.fan={label:'12 V 风扇 / 驱动级抽象',kind:'fan',x:780,y:105,ports:[['+',-65,65],['-',65,65]]};
 M.parts.pump={label:'12 V 滴灌泵 / 驱动级抽象',kind:'pump',x:780,y:105,ports:[['+',-65,65],['-',65,65]]};
 const sources={
  '教学/adc_extension.c':`/* 拓展：原项目未使用 ADC；省略时钟和句柄初始化。 */
gpio(GPIOC, GPIO_PIN_1, GPIO_MODE_ANALOG, GPIO_NOPULL, 0);
/* ADC1_IN11, 12-bit, Vref assumed 3.3 V */
HAL_ADC_Start(&adc);
if (HAL_ADC_PollForConversion(&adc, 10) == HAL_OK) {
    uint32_t raw = HAL_ADC_GetValue(&adc);
    float voltage = raw * 3.3f / 4096.0f;
    /* sensor voltage is not automatically soil moisture percent */
}`,
  '教学/spi_extension.c':`/* 拓展：原项目未使用 SPI Flash；模式和时序由器件手册确定。 */
HAL_GPIO_WritePin(GPIOB, GPIO_PIN_12, GPIO_PIN_RESET);
for (int bit = 7; bit >= 0; --bit) {
    /* hardware shifts MOSI and samples MISO on selected edges */
    sampled = transfer_bit((byte >> bit) & 1);
}
HAL_GPIO_WritePin(GPIOB, GPIO_PIN_12, GPIO_PIN_SET);`,
  '教学/exti_extension.c':`/* 拓展：原项目 PB1 使用轮询；这里另外演示 PC13 EXTI。 */
gpio(GPIOC, GPIO_PIN_13, GPIO_MODE_IT_FALLING, GPIO_PULLUP, 0);
HAL_NVIC_SetPriority(EXTI15_10_IRQn, 7, 0);
HAL_NVIC_EnableIRQ(EXTI15_10_IRQn);
void EXTI15_10_IRQHandler(void) {
    HAL_GPIO_EXTI_IRQHandler(GPIO_PIN_13);
    /* clear pending and notify task; debounce in task context */
}`
 };
 const examples={};
 for(const [id,pin,output] of [['fan','PD12','fan'],['pump','PD13','drip']]){
  M.recipes[id]={title:id==='fan'?'11 温度 → GPIO → 风扇':'12 湿度 → 驱动 → 滴灌泵',topic:'种菜机原 C 控制与实际输出路径',module:'gpio',parts:['driver',id,'supply'],pin,time:100000,volts:2,goal:'自己接好逻辑输入、功率回路和探头，再改旁边的环境参数运行原 C 控制。没有接通的驱动不会让负载凭空动作。',
   nets:[net(pin+' 接驱动 G',pin,'driver.G'),net('驱动 S 接公共地','driver.S','GND'),net('12 V 负端接公共地','supply.-','GND'),net('12 V 正端接负载正端','supply.+',id+'.+'),net('负载负端接驱动 D',id+'.-','driver.D'),scope,net('CH1 接控制引脚','scope.CH1',pin),net('CH2 接 D 点','scope.CH2','driver.D')],question:id==='fan'?'温度从 29°C 降到 27°C，风扇为什么还转？':'湿度仍低，滴灌为什么运行一段时间后停止？',answer:id==='fan'?'28°C 开、26°C 关；中间保留原需求状态。':'原控制器限制连续运行 5 秒，并有 60 秒冷却；低液位等条件也能停止滴灌。'};
  examples[id]={controls:[],make:()=>[{file:'stm32/src/board.c',anchor:'gpio(GPIOD,GPIO_PIN_12',caption:'把 GPIO 配为推挽输出。外部驱动和功率回路需要另外连通。',values:{引脚:pin}},{file:'common/planter.c',anchor:id==='fan'?'if (p->sample.temp10>=':'static bool pump_step',caption:'点击“运行种菜机 2 秒”执行原 C 逻辑；本步说明需求和保护条件。',values:{控制:id==='fan'?'28°C 开 / 26°C 关':'5 s 限时 / 60 s 冷却'}},{file:'stm32/src/board.c',anchor:`HAL_GPIO_WritePin(GPIOD,GPIO_PIN_${id==='fan'?12:13},o->${output}`,caption:'board_outputs 提交输出命令；驱动路径未连通时，种菜机对应负载不动作。',values:{负载:output}}]};
  G[id]={before:'先完成江协 GPIO 输出与基本驱动概念，再回到本项目的控制任务。图中功率驱动为含必要保护的抽象模块，不是经验证的元件选型电路。',principles:['逻辑控制路径与负载供电路径不同；控制引脚变化不证明驱动级和负载已经接通，必须沿闭合回路核对。','传感器采样、控制判断和输出提交发生在不同步骤；本实验将原 C 的观察点回放与负载动画一起显示。','虚拟信号不计算电机启动电流、感性反冲或器件发热；实际电路还需验证驱动、续流保护、额定值和布线。'],design:M.recipes[id].answer,measure:'先接功率公共地，再接控制线、负载两端和探头。把 CH2 的垂直档设为 2 V/div，比较 G 与 D 节点。',questions:id==='fan'?[8,9,81]:[48,154,155]};
 }
 M.recipes.adc={title:'13 ADC：接入模拟电位器',topic:'江协 ADC → 独立采样拓展（原项目未使用）',module:'gpio',parts:['pot'],pin:'PC1',time:1000,volts:1,goal:'用电位器提供 0–3.3 V 模拟输入，观察 PC1 / ADC1_IN11 的量化；不要把电压直接当成湿度百分比。',nets:[net('电位器 VCC 接 3.3 V','pot.VCC','3V'),net('电位器 GND 接地','pot.GND','GND'),net('滑动端接 PC1','pot.WIPER','PC1'),scope,net('CH1 测滑动端','scope.CH1','pot.WIPER')],question:'12 位 ADC 为什么满量程编码是 4095？',answer:'12 位有 4096 种编码，从 0 到 4095。输入饱和后不会产生第 4096 号编码。'};
 examples.adc={controls:[{key:'voltage',label:'滑动端电压 V',type:'number',min:0,max:3.3,step:.01,value:1.65}],make:o=>{const ready=lastCircuit?.status().progress.slice(0,3).every(Boolean),raw=Math.min(4095,Math.floor(Number(o.voltage)/3.3*4096));return [{file:'教学/adc_extension.c',anchor:'GPIO_MODE_ANALOG',caption:'配置模拟输入，关闭数字驱动路径。电位器必须在合法电压范围且有参考地。',values:{通道:'ADC1_IN11'}},{file:'教学/adc_extension.c',anchor:'HAL_ADC_GetValue',caption:ready?'采样保持后逐次逼近量化，得到 12 位数字编码。':'模拟输入路径未接好，模型不提供有效测量。',values:{电压:ready?o.voltage:'未连接',ADC:ready?raw:'无效'}},{file:'教学/adc_extension.c',anchor:'float voltage',caption:'按参考电压换算；原项目实际使用 DHT11 和 BH1750 数字传感器。',values:{重建电压:ready?raw*3.3/4096:'无效'}}];}};
 M.recipes.spi={title:'14 SPI：连接外部存储',topic:'江协 SPI → 独立 Flash 拓展（原项目未使用）',module:'uart',parts:['spi'],pin:'PB13',time:5,volts:1,goal:'连接 SPI2 的 SCK、MOSI、MISO 和独立片选。供电、CS 与模式共同决定事务是否有意义。',nets:[net('Flash VCC 接 3.3 V','spi.VCC','3V'),net('Flash GND 接地','spi.GND','GND'),net('PB12 接 CS','PB12','spi.CS'),net('PB13 接 SCK','PB13','spi.CLK'),net('PB15 接 DI / MOSI','PB15','spi.DI'),net('PB14 接 DO / MISO','PB14','spi.DO'),scope,net('CH1 测 SCK','scope.CH1','PB13'),net('CH2 测 MOSI','scope.CH2','PB15')],question:'SPI 有时钟线，为什么仍然会读错？',answer:'还要检查 CS、CPOL/CPHA、位序、数据长度与器件命令；有时钟不等于采样边沿或协议正确。'};
 examples.spi={controls:[{key:'a',label:'发送字节',type:'number',min:0,max:255,value:159},{key:'b',label:'SPI 模式',type:'number',min:0,max:3,value:0}],make:o=>[{file:'教学/spi_extension.c',anchor:'GPIO_PIN_RESET',caption:'拉低 CS，开始一次事务；这里演示位移过程，不冒充完整 Flash 驱动。',values:{CS:0}},...Array.from({length:8},(_,i)=>({file:'教学/spi_extension.c',anchor:'sampled =',caption:`发送第 ${7-i} 位，按 CPOL/CPHA 选择采样沿。`,values:{位:7-i,MOSI:(o.a>>(7-i))&1,CPOL:o.b>>1,CPHA:o.b&1}})),{file:'教学/spi_extension.c',anchor:'GPIO_PIN_SET',caption:'释放 CS。某些器件的写操作还需要 WREN、地址、数据与忙状态轮询。',values:{CS:1}}]};
 M.recipes.exti={title:'15 EXTI：开关触发中断',topic:'江协 EXTI / NVIC → 独立 PC13 拓展',module:'irq',parts:['water'],pin:'PC13',time:100000,volts:1,goal:'用开关生成下降沿，沿 GPIO 输入、EXTI pending、NVIC 和服务程序分析。种菜机原 PB1 采用轮询，本课是独立扩展。',nets:[net('开关 SIG 接 PC13','water.SIG','PC13'),net('开关 GND 接公共地','water.GND','GND'),scope,net('CH1 测 PC13','scope.CH1','PC13')],question:'进入 ISR 后只读取引脚，不清 pending，会怎样？',answer:'未处理的请求可能使中断重复进入。还应避免在 ISR 里阻塞等待消抖，把耗时工作交给任务。'};
 examples.exti={controls:[],make:()=>[{file:'教学/exti_extension.c',anchor:'GPIO_MODE_IT_FALLING',caption:'开关断开时上拉为高，闭合产生下降沿。先配置输入路由和边沿。',values:{触发:'下降沿'}},{file:'教学/exti_extension.c',anchor:'HAL_NVIC_SetPriority',caption:'NVIC 负责优先级与屏蔽；外部引脚边沿不是自动执行 C 函数的魔法。',values:{逻辑优先级:7}},{file:'教学/exti_extension.c',anchor:'HAL_GPIO_EXTI_IRQHandler',caption:'服务函数处理并清理外部中断请求。本模型展开过程，不执行真实异常入栈。',values:{按键:'用液位开关按钮切换'}}]};
 for(const id of ['adc','spi','exti'])G[id]={before:M.recipes[id].topic+'。本实验代码是独立教学片段，原种菜机未使用这条外设路径。',principles:['先建立供电、参考地和信号路径，再配置时钟、引脚模式与外设；连线正确与软件配置正确需要分别验证。',M.recipes[id].answer,'示波器测量的是端点信号，软件读数还受到采样、时序、有效性与解析影响；不能只看一个数值就判断整个链路。'],design:M.recipes[id].goal,measure:'按步骤连接每根线，将探头接到标注端点，然后运行并改变参数。未接地的示波器不显示可信波形。',questions:id==='adc'?[6,97]:id==='spi'?[11,39,112]:[33,91,92,94]};
 let lastCircuit;
 window.CircuitExtras={examples,sources,setCircuit(c){lastCircuit=c;}};
})();
