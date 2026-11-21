/* Connectivity and ideal signal models for the virtual wiring bench. */
(() => {
  const H=window.CircuitHardware;
  const jx='https://www.jiangxiekeji.com/tutorial/32.html';
  const parts={
    resistor:{label:'330 Ω 限流电阻',kind:'resistor',x:580,y:135,ports:[['A',-45,0],['B',45,0]]},
    led:{label:'红色 LED',kind:'led',x:760,y:135,ports:[['A',-20,70],['K',20,70]]},
    water:{label:'数字液位开关',kind:'water',x:650,y:150,ports:[['SIG',-35,85],['GND',35,85]]},
    driver:{label:'低侧 MOS 驱动（模型）',kind:'driver',x:620,y:275,ports:[['G',-60,15],['S',20,65],['D',70,-15]]},
    lamp:{label:'12 V 补光灯条（内置限流）',kind:'lamp',x:780,y:95,ports:[['+',-65,60],['-',65,60]]},
    supply:{label:'隔离 12 V 电源（模型）',kind:'supply',x:800,y:310,ports:[['+',-38,50],['-',38,50]]},
    dht:{label:'DHT11 · 正面朝向',kind:'dht',x:650,y:100,ports:[['VCC',-45,105],['DATA',-15,105],['NC',15,105],['GND',45,105]]},
    pullup:{label:'4.7 kΩ 数据线上拉',kind:'resistor',x:800,y:265,ports:[['A',-45,0],['B',45,0]]},
    bh:{label:'BH1750 / GY-302 模块',kind:'bh',x:700,y:130,ports:[['VCC',-80,90],['GND',-40,90],['SCL',0,90],['SDA',40,90],['ADDR',80,90]]},
    esp:{label:'ESP32 UART 网关',kind:'esp',x:730,y:145,ports:[['3V3',-85,100],['GND',-40,100],['RX16',25,100],['TX17',80,100]]},
    pot:{label:'10 kΩ 电位器（拓展）',kind:'pot',x:700,y:135,ports:[['VCC',-55,90],['WIPER',0,90],['GND',55,90]]},
    spi:{label:'SPI Flash（拓展模型）',kind:'spi',x:700,y:150,ports:[['VCC',-105,-40],['GND',-105,0],['CS',-105,40],['CLK',105,-40],['DI',105,0],['DO',105,40]]},
    scope:{label:'虚拟示波器',kind:'scope',x:705,y:570,ports:[['GND',-132,153],['CH1',-55,153],['CH2',55,153]]}
  };
  const net=(label,a,b)=>({label,a,b});
  const ground=net('示波器地夹接到开发板 GND','scope.GND','GND');
  const recipes={
    gpio:{title:'01 GPIO：亲手点亮 LED',topic:'江协 GPIO 输出 → F407 GPIO 推挽',module:'gpio',parts:['resistor','led'],pin:'PD12',time:100000,volts:1,
      goal:'把 PD12 的输出变成看得见的灯光。理解限流电阻、LED 极性、公共地和高低电平。',
      nets:[net('PD12 连接限流电阻 A 端','PD12','resistor.A'),net('电阻 B 端连接 LED 阳极 A','resistor.B','led.A'),net('LED 阴极 K 连接 GND','led.K','GND'),ground,net('CH1 探头接 PD12','scope.CH1','PD12')],
      stages:[['gpio(GPIOD,GPIO_PIN_12','配置推挽输出：GPIO 驱动级准备连接电源或地。',0],['HAL_GPIO_WritePin(GPIOD,GPIO_PIN_12,o->fan','输出 HIGH：电流经限流电阻与 LED 回到 GND，LED 发光。',1],['HAL_GPIO_WritePin(GPIOD,GPIO_PIN_12,o->fan','输出 LOW：LED 两端不再有足够的正向电压，LED 熄灭。',0]],
      question:'把 LED 的 A、K 两根线交换，再运行，现象有什么变化？',answer:'本模型中的 LED 反接后不发光。PD12 的高低电平仍可被示波器测到：输出正常不等于接线和负载正常。'},
    input:{title:'02 GPIO：开关输入与液位',topic:'江协 GPIO 输入 → 种菜机 PB1',module:'gpio',parts:['water'],pin:'PB1',time:100000,volts:1,
      goal:'连接一个开关量输入，观察上拉和开关对引脚电平的共同作用。点击水箱可切换液位状态。',
      nets:[net('液位 SIG 接 PB1','water.SIG','PB1'),net('液位 GND 接开发板地','water.GND','GND'),ground,net('CH1 接 PB1','scope.CH1','PB1')],
      stages:[['gpio(GPIOB,GPIO_PIN_1','PB1 配置为输入上拉。开关断开时，内部上拉使输入倾向 HIGH。',0],['bool board_water_low','读取 IDR：当前程序将 HIGH 解释为低液位。点击液位开关改变条件。',1]],
      question:'拔掉开关的 SIG 线后，高电平能证明水箱一定缺水吗？',answer:'不能。上拉输入开路时也可能读到 HIGH。当前数字开关方案不能可靠地区分缺水和断线。'},
    pwm:{title:'03 PWM：接出补光电路',topic:'江协 TIM 输出比较 / PWM → TIM4_CH1',module:'pwm',parts:['driver','lamp','supply'],pin:'PB6',time:100,volts:2,
      goal:'观察 GPIO 信号如何控制功率路径。示波器 CH1 测栅极驱动信号，CH2 测漏极节点；灯条亮度对应平均占空比。',
      nets:[net('PB6 接驱动模块 G 输入','PB6','driver.G'),net('驱动模块 S 接开发板 GND','driver.S','GND'),net('12 V 负端接公共地','supply.-','GND'),net('12 V 正端接灯条正端','supply.+','lamp.+'),net('灯条负端接驱动模块 D','lamp.-','driver.D'),ground,net('CH1 接 PB6','scope.CH1','PB6'),net('CH2 接 D，观察相反的通断电平','scope.CH2','driver.D')],
      question:'为什么 PB6 变高时，D 点反而变低？',answer:'模型使用低侧 N-MOS：导通时 D 被拉向 S / GND，电流沿电源→灯条→D→S→地流动。关断后 D 经灯条一侧回到高电位。本模型不计算开关损耗、栅极充放电或灯条瞬态。'},
    dht:{title:'04 DHT11：接线与脉宽',topic:'GPIO / 定时测量 → 项目 DHT11 拓展',module:'dht',parts:['dht','pullup'],pin:'PB0',time:20,volts:1,
      goal:'自己连接 DHT11 的供电、数据和上拉，用示波器观察主机启动及传感器高脉宽，再对照代码判断 0 / 1。NC 引脚保持不接。',
      nets:[net('DHT11 VCC 接 3.3 V','dht.VCC','3V'),net('DHT11 GND 接公共地','dht.GND','GND'),net('DHT11 DATA 接 PB0','dht.DATA','PB0'),net('上拉电阻 A 接 3.3 V','pullup.A','3V'),net('上拉电阻 B 接 DATA','pullup.B','dht.DATA'),ground,net('CH1 接 DATA','scope.CH1','dht.DATA')],
      question:'启动阶段持续约 20 ms，却在 20 μs/div 档看不到完整低脉冲，是什么原因？',answer:'横向时间窗口太短。10 格 × 20 μs 只有 200 μs；需要把时基调大才能观察完整启动过程，再切回微秒档观察数据位。'},
    i2c:{title:'05 I²C：接入 BH1750',topic:'江协 I²C 通信 → BH1750 光照模块',module:'i2c',parts:['bh'],pin:'PB8',time:50,volts:1,
      goal:'把时钟和数据两根线分别接好。CH1 测 SCL，CH2 测 SDA，观察地址、数据和第九个时钟的应答。模块上拉已纳入模型。',
      nets:[net('模块 VCC 接 3.3 V','bh.VCC','3V'),net('模块 GND 接公共地','bh.GND','GND'),net('SCL 接 PB8','bh.SCL','PB8'),net('SDA 接 PB9','bh.SDA','PB9'),net('ADDR 接地，选择 0x23','bh.ADDR','GND'),ground,net('CH1 接 SCL','scope.CH1','bh.SCL'),net('CH2 接 SDA','scope.CH2','bh.SDA')],
      question:'把 ADDR 接到 3.3 V，而程序仍访问 0x23，会发生什么？',answer:'地址选择与代码不一致，预期读不到该地址的应答。先核对地址和供电，再判断是否是程序解析错误。这里保留这种接线错误供你分析。'},
    uart:{title:'06 UART：两块板互相通信',topic:'江协 USART → STM32 / ESP32 互联',module:'uart',parts:['esp'],pin:'PA2',time:20,volts:1,
      goal:'两端共地，TX 接对方 RX。观察 115200 / 8N1 的起始位、最低位先传和停止位。ESP32 模块供电以教学端口表示，不验证板载电源设计。',
      nets:[net('ESP32 逻辑供电接 3.3 V','esp.3V3','3V'),net('两块板共地','esp.GND','GND'),net('STM32 PA2 TX → ESP32 RX16','PA2','esp.RX16'),net('ESP32 TX17 → STM32 PA3 RX','esp.TX17','PA3'),ground,net('CH1 测 PA2 TX','scope.CH1','PA2'),net('CH2 测 PA3 RX','scope.CH2','PA3')],
      question:'TX 接 TX 为什么不是正确的收发连接？',answer:'两端 TX 都是输出，无法形成预期的发送端→接收端路径。UART 需要 TX→RX、RX←TX，还要共享参考地和匹配电平、波特率及帧格式。'},
    dma:{title:'07 DMA：数据进入内存',topic:'江协 DMA → USART 循环接收',module:'dma',parts:['esp'],pin:'PA3',time:20,volts:1,
      goal:'沿用串口电路，跟踪一个字节经过 RX 引脚、USART 数据寄存器和 DMA，再写入 SRAM。收发电路接好，不代表软件能及时消费。',
      question:'CPU 停止读取时，示波器仍能看到数据，为什么软件却可能丢包？',answer:'线路上传输可以正常，而循环 DMA 已覆盖未消费的内存。硬件 UART ORE 与 SRAM 环形缓冲覆盖属于不同问题。'},
    rtos:{title:'08 FreeRTOS：谁来处理数据',topic:'项目进阶 · 不属于江协 STM32 入门目录',module:'queue',parts:['esp'],pin:'PA3',time:20,volts:1,
      goal:'保留串口电路，把视角移到接收任务、命令队列和控制任务。此处的任务调度是教学模型，不运行真实 FreeRTOS 内核。',
      question:'接收任务里直接改 Planter，和通过队列发消息，有什么区别？',answer:'前者引入共享写入和同步问题；当前项目让 ControlTask 独占控制状态，其他任务传副本，所有权更清楚。'},
    mqtt:{title:'09 ESP32 / MQTT：断网仍控制',topic:'项目进阶 · 网关与应用协议',module:'uart',parts:['esp'],pin:'PA2',time:20,volts:1,
      goal:'在已有串口电路上观察 ESP32 网关。点击 Wi-Fi 开关切换模拟网络；串口物理链路与云端状态分别显示，不连接真实 MQTT 服务。',
      question:'MQTT 发布成功，能不能当成泵已经出水？',answer:'不能。网络传输、控制器接受、GPIO 输出和物理执行是不同阶段；当前项目没有流量传感器证明实际出水。'},
    debug:{title:'10 故障定位：沿线路查原因',topic:'项目进阶 · 电源、信号与程序逐层排查',module:'i2c',parts:['bh'],pin:'PB9',time:50,volts:1,
      goal:'从已接好电路开始，断开地线、交换 SCL/SDA 或改变 ADDR，比较波形、通信结果和程序返回位置，建立排查顺序。',
      question:'没有响应时应该立刻修改上层控制算法吗？',answer:'先确认供电、参考地、连接、引脚复用、时钟和地址，再检查传输与解析。把观察记录与证据对应起来，避免同时改动多个层次。'}
  };
  for(const id of ['dma','rtos','mqtt'])recipes[id].nets=recipes.uart.nets;
  recipes.debug.nets=recipes.i2c.nets;
  const signalName=id=>H.headers.find(h=>h.id===id)?.name||id;
  function canonical(id){const name=signalName(id);return ['GND','VSS','VSSA'].includes(name)?'GND':['VDD','3V'].includes(name)?'3V':name;}
  class Circuit {
    constructor(lesson='gpio'){this.lesson=lesson;this.wires=[];this.low=false;this.network=true;this.power=true;this.revision=0;this.netRevision=-1;}
    validPort(id){return H.headers.some(h=>h.id===id&&h.name!=='NC')||[...recipes[this.lesson].parts,'scope'].some(p=>parts[p].ports.some(([port])=>id===p+'.'+port&&port!=='NC'));}
    add(a,b){if(a===b||!this.validPort(a)||!this.validPort(b))return false;if(this.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))return false;this.wires.push({id:Date.now()+'-'+this.wires.length,a,b});this.revision++;return true;}
    remove(index){this.wires.splice(index,1);this.revision++;}
    clear(){this.wires=[];this.revision++;}
    same(a,b){
      if(this.netRevision!==this.revision){
        this.roots=new Map();const root=n=>{while(this.roots.has(n)){n=this.roots.get(n);}return n;};
        for(const w of this.wires){const x=root(canonical(w.a)),y=root(canonical(w.b));if(x!==y)this.roots.set(x,y);}
        this.root=root;this.netRevision=this.revision;
      }
      return this.root(canonical(a))===this.root(canonical(b));
    }
    status(){
      if(this.statusRevision===this.revision)return this.cachedStatus;
      const r=recipes[this.lesson],progress=r.nets.map(n=>this.same(n.a,n.b));
      if(this.lesson==='gpio'&&this.same('PD12','resistor.B')&&this.same('resistor.A','led.A'))progress[0]=progress[1]=true;
      if(this.lesson==='dht'&&this.same('pullup.B','3V')&&this.same('pullup.A','dht.DATA'))progress[3]=progress[4]=true;
      const powerShort=this.same('3V','GND')||this.same('5V','GND')||this.same('3V','5V')||this.same('supply.+','GND')||this.same('supply.+','3V');
      const outputs=({gpio:['PD12'],pwm:['PB6'],fan:['PD12'],pump:['PD13'],uart:['PA2','esp.TX17'],dma:['PA2','esp.TX17'],rtos:['PA2','esp.TX17'],mqtt:['PA2','esp.TX17'],spi:['PB12','PB13','PB15']})[this.lesson]||[];
      const drivenConflict=outputs.some(pin=>this.same(pin,'GND')||this.same(pin,'3V')||this.same(pin,'supply.+'))||(['uart','dma','rtos','mqtt'].includes(this.lesson)&&this.same('PA2','esp.TX17'));
      const busConflict=['i2c','debug'].includes(this.lesson)&&(this.same('PB8','PB9')||this.same('PB8','GND')||this.same('PB9','GND'));
      const short=powerShort||drivenConflict||busConflict,reason=powerShort?'电源短接':drivenConflict?'输出端与电源或另一输出端冲突':busConflict?'I²C 信号短接或被拉死':'';
      this.statusRevision=this.revision;return this.cachedStatus={progress,complete:progress.every(Boolean)&&!short,short,reason,connected:progress.filter(Boolean).length,total:progress.length};
    }
    load(){this.clear();for(const n of recipes[this.lesson].nets){const choose=id=>H.headers.find(h=>h.name===id&&h.header==='P2')?.id||H.headers.find(h=>h.name===id)?.id||id;this.add(choose(n.a),choose(n.b));}}
    powered(part){return this.power&&!this.status().short&&this.same(part+'.GND','GND')&&this.same(part+'.VCC','3V');}
    signal(node,timeUs,frame,options={}){
      if(!this.power||this.status().short)return null;
      const eq=name=>this.same(node,name),r=recipes[this.lesson],v=frame?.values||{};
      if(eq('GND'))return 0;if(eq('3V'))return 3.3;if(eq('5V'))return 5;if(eq('supply.+'))return 12;
      if(['fan','pump'].includes(this.lesson)){
        const pin=this.lesson==='fan'?'PD12':'PD13',high=!!this.control?.[this.lesson==='fan'?'out_fan':'out_drip'];
        if(eq(pin))return high?3.3:0;
        if(eq('driver.D')&&this.same('driver.S','GND')&&this.same('supply.-','GND')&&this.same(this.lesson+'.+','supply.+')&&this.same(this.lesson+'.-','driver.D'))return this.same('driver.G',pin)&&high?0:12;
      }
      if(this.lesson==='adc'&&(eq('PC1')||eq('pot.WIPER'))&&this.powered('pot')&&this.same('pot.WIPER','PC1'))return Number(options.voltage??1.65);
      if(this.lesson==='spi'){
        if(eq('PB12'))return frame?.values?.CS===1?3.3:0;
        if(eq('PB13'))return (frame?.values?.CS===1?(Number(options.b)>>1):((Number(options.b)>>1)^(Math.floor(timeUs*2)%2)))*3.3;
        if(eq('PB15'))return ((Number(options.a??159)>>(7-Math.floor(timeUs)%8))&1)*3.3;
        if(eq('PB14')&&this.powered('spi')&&this.same('spi.DO','PB14')&&this.same('spi.CS','PB12')&&this.same('spi.CLK','PB13'))return 0;
      }
      if(eq('PC13')&&this.lesson==='exti')return this.same('water.SIG','PC13')&&this.same('water.GND','GND')&&!this.low?0:3.3;
      if(eq('PD12')&&r===recipes.gpio)return this.projectMode?(this.control?.out_fan?3.3:0):frame?.output===0&&frame?.setup?0:timeUs%1e6<5e5?3.3:0;
      if(eq('PB1')&&this.lesson==='input')return this.same('water.SIG','PB1')&&this.same('water.GND','GND')&&!this.low?0:3.3;
      if(this.lesson==='pwm'){
        const psc=Number(options.psc??83),arr=Number(options.arr??999),duty=Number(options.duty??50),f=84000000/(psc+1)/(arr+1),high=((timeUs*f/1e6)%1)<duty/100;
        if(eq('PB6')||eq('driver.G')&&this.same('PB6','driver.G'))return high?3.3:0;
        if(eq('driver.D')&&this.same('driver.S','GND')&&this.same('supply.-','GND')&&this.same('lamp.+','supply.+')&&this.same('lamp.-','driver.D'))return this.same('driver.G','PB6')&&high?0:12;
      }
      if(['uart','dma','rtos','mqtt'].includes(this.lesson)){
        const tx=eq('PA2'),rx=eq('esp.TX17')&&this.same('esp.GND','GND')&&this.same('esp.3V3','3V');
        if(tx||rx){const byte=Number(options.byte??165),bits=[1,0,...Array.from({length:8},(_,i)=>(byte>>i)&1),1,1];return bits[Math.floor(timeUs*115200/1e6)%bits.length]*3.3;}
      }
      if(['i2c','debug'].includes(this.lesson)&&(eq('PB8')||eq('PB9'))){
        const valid=this.powered('bh')&&this.same('bh.SCL','PB8')&&this.same('bh.SDA','PB9');
        const key=JSON.stringify(options)+':'+this.revision;
        if(this.i2cKey!==key){this.i2cKey=key;this.i2cFrames=window.BoardModels.modules.i2c.make({...options,nack:!valid||!this.same('bh.ADDR','GND')||!!options.nack});}
        const chosen=frame?.wave&&valid&&this.same('bh.ADDR','GND')?frame:this.i2cFrames.findLast(f=>f.wave);
        return waveAt(chosen.wave[eq('PB8')?0:1].segments,timeUs,5)*3.3;
      }
      if(this.lesson==='dht'&&eq('PB0')){
        if(v.阶段==='启动')return timeUs%22000<20000?0:3.3;
        if(!this.powered('dht')||!this.same('PB0','dht.DATA')||!((this.same('pullup.A','3V')&&this.same('pullup.B','dht.DATA'))||(this.same('pullup.B','3V')&&this.same('pullup.A','dht.DATA'))))return null;
        const segments=frame?.wave?.[0]?.segments||[{level:0,duration:50},{level:1,duration:Number(options.width??28)},{level:0,duration:50}];return waveAt(segments,timeUs,1)*3.3;
      }
      return null;
    }
    probe(channel,timeUs,frame,options){if(!this.same('scope.GND','GND'))return null;return this.signal('scope.'+channel,timeUs,frame,options);}
  }
  function waveAt(segments,time,scale){const total=segments.reduce((n,s)=>n+s.duration*scale,0);let t=((time%total)+total)%total;for(const s of segments){if(t<s.duration*scale)return s.level;t-=s.duration*scale;}return segments.at(-1).level;}
  window.CircuitModels={parts,recipes,Circuit,canonical,signalName,jx};
})();
