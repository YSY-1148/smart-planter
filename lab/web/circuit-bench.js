/* Interactive circuit bench. Original teaching illustrations; ideal digital signals. */
(() => {
  'use strict';
  const H=window.CircuitHardware,M=window.CircuitModels,B=window.BoardModels;
  const $=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const boardFile='stm32/src/board.c';
  const gpioSource=`/* 独立教学示例：1 Hz 闪灯，不是种菜机的风扇算法。
 * 示意程序由 JavaScript 模型解释；没有在浏览器编译 HAL。
 * 已完成系统时钟与 HAL 初始化。 */
void led_lesson(void) {
    __HAL_RCC_GPIOD_CLK_ENABLE();
    GPIO_InitTypeDef io = {0};
    io.Pin = GPIO_PIN_12;
    io.Mode = GPIO_MODE_OUTPUT_PP;
    io.Pull = GPIO_NOPULL;
    io.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOD, &io);
    while (1) {
        HAL_GPIO_WritePin(GPIOD, GPIO_PIN_12, GPIO_PIN_SET);
        HAL_Delay(500); // 亮：保持 500 ms
        HAL_GPIO_WritePin(GPIOD, GPIO_PIN_12, GPIO_PIN_RESET);
        HAL_Delay(500); // 灭：保持 500 ms
    }
}`;
  let ctx,id='gpio',circuit,frames=[],index=0,opts={},pending=null,selected='PD12',playing=false,raf=0,last=0,simUs=0,stepMs=0,drawMs=0;
  let projectState={},projectTimer=0,projectEpoch=0,projectRunning=false,projectHasRun=false;
  const recipe=()=>M.recipes[id],frame=()=>frames[index];
  const sourceMap=()=>({...ctx.sources,...window.CircuitExtras?.sources,'教学/led_lesson.c':gpioSource});
  const portLabel=p=>H.headers.find(h=>h.id===p)?`${p} · ${M.signalName(p)}`:p;
  function positions(){return [...H.headers.map(h=>({...h,id:h.id})),...[...recipe().parts,'scope'].flatMap(key=>M.parts[key].ports.map(([port,x,y])=>({id:key+'.'+port,x:M.parts[key].x+x,y:M.parts[key].y+y,name:port})))];}
  function save(){try{localStorage.setItem('planter-circuit-v1-'+id,JSON.stringify({wires:circuit.wires,low:circuit.low,network:circuit.network}));}catch{}}
  function restore(){try{const v=JSON.parse(localStorage.getItem('planter-circuit-v1-'+id)||'null');if(v){for(const w of v.wires||[])circuit.add(w.a,w.b);circuit.low=!!v.low;circuit.network=v.network!==false;}}catch{}}
  function controls(){
    const list=window.CircuitExtras?.examples[id]?.controls||(['gpio','input','mqtt'].includes(id)?[]:B.modules[recipe().module].controls);
    opts=Object.fromEntries(list.map(c=>[c.key,c.value]));
    $('bench-options').innerHTML=list.map(c=>c.type==='checkbox'?`<label><input type="checkbox" data-bench-option="${c.key}" ${c.value?'checked':''}>${esc(c.label)}</label>`:c.type==='select'?`<label>${esc(c.label)}<select data-bench-option="${c.key}">${c.options.map(([v,t])=>`<option value="${v}" ${v===c.value?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:`<label>${esc(c.label)}<input type="number" data-bench-option="${c.key}" value="${c.value}" min="${c.min}" max="${c.max}" step="${c.step||1}" required></label>`).join('');
  }
  function buildFrames(){
    if(window.CircuitExtras?.examples[id])frames=window.CircuitExtras.examples[id].make(opts);
    else if(id==='gpio')frames=[
      {file:'教学/led_lesson.c',anchor:'HAL_GPIO_Init',caption:'打开端口时钟并配置 PD12 为推挽输出。先检查电流是否能沿电阻、LED、地返回。',setup:true,output:0,values:{模式:'推挽',初始输出:'LOW'}},
      {file:'教学/led_lesson.c',anchor:'GPIO_PIN_SET);',caption:'写入 HIGH，高侧输出管导通。只有电阻和 LED 极性正确并构成闭合回路，外接 LED 才亮。',output:1,values:{PD12:'HIGH',保持:'500 ms'}},
      {file:'教学/led_lesson.c',anchor:'// 亮：',caption:'CPU 在 HAL_Delay 中等待，GPIO 输出锁存保持 HIGH。等待不意味着引脚停止输出。',output:1,values:{PD12:'HIGH',程序:'等待'}},
      {file:'教学/led_lesson.c',anchor:'GPIO_PIN_RESET);',caption:'写入 LOW，低侧输出管把引脚拉向地，外接 LED 熄灭。',output:0,values:{PD12:'LOW',保持:'500 ms'}},
      {file:'教学/led_lesson.c',anchor:'// 灭：',caption:'保持 LOW，再进入下一次循环。500 ms 亮 + 500 ms 灭：周期 1 s，频率 1 Hz。',output:0,values:{频率:'1 Hz',占空比:'50%'}}
    ];
    else if(id==='input')frames=recipe().stages.map(([anchor,caption])=>({file:boardFile,anchor,caption,values:{PB1:circuit.low?'HIGH / 低液位':'开关闭合时 LOW'}}));
    else frames=B.modules[recipe().module].make({...opts,...(['i2c','debug'].includes(id)?{nack:opts.nack||!circuit.same('bh.ADDR','GND')||!circuit.powered('bh')||!circuit.same('bh.SCL','PB8')||!circuit.same('bh.SDA','PB9')}:{} )});
    if(id==='dht'&&!circuit.status().progress.slice(0,5).every(Boolean))frames=[frames[0],{file:boardFile,anchor:'ok=wait_dht(GPIO_PIN_RESET,100)',caption:'接线尚未形成规定的供电、数据和上拉路径。模型不生成有效响应；程序在等待边沿后超时。先检查电路，再看解码。',values:{响应:'未建立',SENSOR_DHT:0}},{file:boardFile,anchor:'if (!ok || (uint8_t)',caption:'时序或校验失败，dht_read 返回 false；不能把无响应解释成温度 0°C。',values:{ok:false,SENSOR_DHT:0}}];
    if(id==='dma'&&!circuit.status().progress.slice(0,4).every(Boolean))frames=[frames[0],{file:boardFile,anchor:'if (rx_pos==written)',caption:'网关供电或串口路径尚未接好，本实验不注入接收数据。DMA 没有新请求，CPU 读到空缓冲。',values:{已接收:0,written:506,rx_pos:506,返回:false}}];
    if(id==='mqtt'){
      const link=circuit.status().progress.slice(0,4).every(Boolean),online=link&&circuit.network;
      const f=(anchor,caption,values,stage)=>({file:'esp32/src/main.cpp',anchor,caption,values,stage});
      frames=[f('stm32.setRxBufferSize','先配置 ESP32 的 UART2：RX16、TX17，115200 / 8N1。串口接线必须交叉且共地。',{串口:link?'路径已接好':'路径未接好'},'uart'),
        f('while (stm32.available())','模型注入一帧遥测，逐字节交给 proto_feed；只有完整且校验正确的帧才能进入队列。',{示例遥测:link?'可接收':'没有输入'},'receive'),
        f('xQueueOverwrite(telemetryQueue,&received)',link?'最新遥测被复制到长度为 1 的队列。覆盖旧值可以限制断网时的积压。':'串口路径未接好，没有有效遥测可入队。',{遥测队列:link?'最新帧副本':'空'},'queue'),
        f(online?'if (mqtt.connect':'if (WiFi.status()!=WL_CONNECTED',online?'模型假定联网、校时和 TLS 校验成功，建立 MQTT 会话；不访问实际服务器。':'网络断开时尝试重连。STM32 本地控制与 ESP32 的联网逻辑分开运行。',{WiFi:online?'连接':'未连接',会话:online?'教学假定成功':'未建立'},'connect'),
        f('if (mqtt.connected()) mqtt.loop()',online?'调用 mqtt.loop 维护会话并分发到达的订阅消息。网络连接不代表命令已经执行。':'跳过 MQTT 会话处理；已连接的 UART 物理链路仍可传输。',{MQTT:online?'处理会话':'断开'},'loop'),
        f('if (publishTelemetry(latest))',online?'检查遥测新鲜度及序号后发布。只有 publishTelemetry 返回成功才更新上报记录。':'发布条件不成立：没有 MQTT 会话或没有有效遥测。不能显示成“云端已收到”。',{发布:online?'模型发布成功':'未发布',STM32控制:'独立运行'},'publish'),
        f('if (publishAck(ack.message.seq',online?'STM32 返回的 ACK 经队列上报，stage 标记为 stm32。此路径与网关阶段的拒绝应答不同。':'断网时无法完成云端 ACK 上报；这不等于撤销 STM32 已经执行的输出。',{应答阶段:'stm32',物理出水:'项目没有流量检测'},'ack')];
    }
    index=Math.min(index,frames.length-1);
  }
  function pick(next){
    if(!M.recipes[next])return;stop();id=next;circuit=new M.Circuit(id);restore();window.CircuitExtras?.setCircuit(circuit);pending=null;index=0;simUs=0;stepMs=0;
    $('bench-title').textContent=recipe().title;$('bench-topic').textContent=recipe().topic;$('bench-goal').textContent=recipe().goal;
    $('bench-lessons').value=id;$('bench-time').value=recipe().time;$('bench-volts').value=recipe().volts;$('bench-zoom').value=100;
    $('bench-switch').hidden=!['input','exti'].includes(id);$('bench-network').hidden=id!=='mqtt';
    $('bench-practice').innerHTML=`<summary>动手验证：${esc(recipe().question)}</summary><p>${esc(recipe().answer)}</p>`;
    $('bench-practice').open=false;controls();buildFrames();scene();inspect(recipe().pin);refresh();
    projectState={};projectHasRun=false;window.PlanterView.mount($('bench-grow-view'));plantVisual();
    const choices=positions().filter(p=>circuit.validPort(p.id)).map(p=>`<option value="${p.id}">${esc(portLabel(p.id))}</option>`).join('');
    $('bench-wire-from').innerHTML='<option value="">选择起点</option>'+choices;$('bench-wire-to').innerHTML='<option value="">选择终点</option>'+choices;
    const guide=window.CircuitGuides[id];
    $('bench-guide').innerHTML=`<p>${esc(guide.before)}</p><details open><summary>先弄懂基本原理</summary>${guide.principles.map((p,i)=>`<p><b>${i+1}.</b> ${esc(p)}</p>`).join('')}</details><details><summary>为什么这样写程序</summary><p>${esc(guide.design)}</p></details><details><summary>跟着示波器分析</summary><p>${esc(guide.measure)}</p></details><p>关联面试知识点：${guide.questions.map(q=>{const item=window.LAB_QUESTIONS?.find(item=>item.id===q);return item?`#${q} ${esc(item.title)}`:'#'+q;}).join('；')}。这是关联索引，不表示这些题已全部完成独立实验。</p>`;
  }
  function terminal(p,isHeader=false){
    const disabled=p.name==='NC',side=isHeader?(p.col===0?-1:1):0;
    return `<g data-port="${p.id}" class="bench-port ${disabled?'nc':''}" role="button" tabindex="0" aria-label="${esc(portLabel(p.id))}" transform="translate(${p.x} ${p.y})"><title>${esc(portLabel(p.id))}${disabled?' · 不接线':''}</title><circle class="port-hit" r="11"/><circle class="port-ring" r="5.2"/><circle class="port-hole" r="2.7"/>${isHeader?`<text x="${side*12}" y="3.5" text-anchor="${side<0?'end':'start'}">${p.number} ${p.name}</text>`:`<text x="0" y="22" text-anchor="middle">${esc(p.name)}</text>`}</g>`;
  }
  function pcb(){
    const pkg=H.packagePins.map((p,i)=>{const n=i%25,side=Math.floor(i/25);const x=side===0?172:side===1?181+n*5.1:side===2?317:303-n*5.1,y=side===0?313+n*5.1:side===1?454:side===2?440-n*5.1:302;return `<rect data-mini-pin="${p.name}" x="${x}" y="${y}" width="${side%2?3:10}" height="${side%2?10:3}" fill="#b8c3cc"/>`;}).join('');
    return `<g class="bench-pcb"><rect x="25" y="25" width="440" height="730" rx="16" fill="#216a95" stroke="#184969" stroke-width="3"/><g fill="#172d36" stroke="#aab6c0" stroke-width="4">${[[42,42],[447,42],[42,738],[447,738]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="7"/>`).join('')}</g>
    <path d="M45 135H445M45 139H445" stroke="#76aac0" stroke-dasharray="3 5"/><text x="243" y="64" text-anchor="middle" fill="white" font-size="20" font-weight="700">STM32F4 DISCOVERY</text><text x="243" y="84" text-anchor="middle" fill="#b9e2ee" font-size="11">ST-LINK / V2 · 板载调试器</text>
    <rect x="213" y="25" width="62" height="28" rx="3" fill="#c5cbd1" stroke="#616c77"/><rect x="224" y="26" width="40" height="11" fill="#222d38"/>
    <rect x="202" y="96" width="80" height="26" rx="2" fill="#16272d"/><text x="242" y="113" text-anchor="middle" fill="#95b2bd" font-size="9">STM32F103</text>
    <text x="80" y="148" fill="white" text-anchor="middle" font-size="12">P1</text><text x="403" y="148" fill="white" text-anchor="middle" font-size="12">P2</text>
    <g stroke="#58a1b2" opacity=".32" fill="none">${Array.from({length:13},(_,i)=>`<path d="M110 ${245+i*20} H${142+i*2} V${326+i*8} H174"/><path d="M375 ${245+i*20} H${345-i*2} V${326+i*8} H327"/>`).join('')}</g>
    <rect x="60" y="151" width="44" height="548" rx="4" fill="#173e53"/><rect x="382" y="151" width="44" height="548" rx="4" fill="#173e53"/>
    <g data-action="package" tabindex="0" role="button" aria-label="放大芯片全部100个封装引脚" class="package-button">${pkg}<rect x="183" y="312" width="134" height="141" rx="3" fill="#17272c" stroke="#061a23" stroke-width="3"/><circle cx="194" cy="325" r="4" fill="#7a919b"/><text x="249" y="368" fill="#c5d3d4" text-anchor="middle" font-size="24" font-style="italic">ST</text><text x="249" y="393" fill="#d6e0df" text-anchor="middle" font-size="13">STM32F407VGT6</text><text x="249" y="415" fill="#93afba" text-anchor="middle" font-size="10">Cortex-M4 · 100 pins</text><text x="249" y="436" fill="#8fd7ed" text-anchor="middle" font-size="10">点击放大 / 查看内部</text></g>
    <rect x="208" y="255" width="72" height="27" rx="12" fill="#c6c6bb" stroke="#657c86"/><text x="244" y="273" text-anchor="middle" font-size="9" fill="#4b5e68">8 MHz XTAL</text>
    <g>${[[193,515,'#66bf56','PD12'],[245,493,'#dc923b','PD13'],[245,539,'#df565e','PD14'],[297,515,'#55a7db','PD15']].map(([x,y,col,p])=>`<rect x="${x-9}" y="${y-7}" width="18" height="14" rx="3" fill="#273c47"/><circle id="bench-${p}" cx="${x}" cy="${y}" r="5" fill="${col}" opacity=".35"/><text x="${x}" y="${y+20}" fill="#b8d4df" text-anchor="middle" font-size="9">${p}</text>`).join('')}</g>
    <circle cx="195" cy="600" r="20" fill="#123d4f"/><circle cx="195" cy="600" r="14" fill="#199fce"/><circle cx="294" cy="600" r="20" fill="#123d4f"/><circle cx="294" cy="600" r="14" fill="#272b30"/><text x="195" y="634" fill="white" text-anchor="middle" font-size="10">USER · PA0</text><text x="294" y="634" fill="white" text-anchor="middle" font-size="10">RESET · NRST</text>
    <rect x="215" y="663" width="60" height="40" rx="4" fill="#b1b9bf"/><rect x="223" y="679" width="44" height="19" fill="#1d313e"/><text x="245" y="726" fill="#bad7df" text-anchor="middle" font-size="10">顶视图 · 排针编号与芯片脚号分别标注</text></g>`;
  }
  function part(key){
    const p=M.parts[key];let body='';
    if(p.kind==='fan')body=`<rect x="-53" y="-42" width="106" height="100" rx="9" fill="#566c66"/><circle r="40" cy="7" fill="#c5d6cc"/><g id="bench-actuator-rotor" transform="translate(0 7)">${[0,120,240].map(a=>`<path d="M0 0Q-20-10-9-29Q14-34 23-17L2 3Z" transform="rotate(${a})" fill="#5d8973"/>`).join('')}</g><path d="M-65 65V40H-53M65 65V40H53" fill="none" stroke="#8a9f94" stroke-width="4"/>`;
    if(p.kind==='pump')body=`<rect x="-54" y="-28" width="108" height="70" rx="20" fill="#5e9aa3"/><circle cx="35" cy="8" r="21" fill="#dae4df"/><path d="M-65 65V30H-54M65 65V30H54M-74-5H-50M54-5H82" fill="none" stroke="#879e94" stroke-width="8"/><path id="bench-pump-flow" d="M-74-5H82" stroke="#81dcf1" stroke-width="3" stroke-dasharray="4 7" opacity="0"/>`;
    if(p.kind==='pot')body=`<rect x="-75" y="-48" width="150" height="130" rx="9" fill="#5b87aa"/><circle r="43" fill="#283e49"/><circle r="31" fill="#526d79"/><path d="M0 0L-10-27" stroke="#e4e6d8" stroke-width="5"/><path d="M-55 60V90M0 60V90M55 60V90" stroke="#bdc5b7" stroke-width="5"/>`;
    if(p.kind==='spi')body=`<rect x="-105" y="-62" width="210" height="120" rx="6" fill="#366e78"/><rect x="-44" y="-33" width="88" height="62" rx="4" fill="#263943"/><circle cx="-31" cy="-20" r="4" fill="#b6c6c0"/><text x="0" y="5" text-anchor="middle" fill="#d4ddd5" font-size="12">SPI Flash</text>${[-1,1].map(s=>[-24,-8,8,24].map(y=>`<path d="M${44*s} ${y}H${59*s}" stroke="#b7b9a9" stroke-width="7"/>`).join('')).join('')}`;
    if(p.kind==='resistor')body=`<path d="M-45 0H45" stroke="#adb6b8" stroke-width="5"/><rect x="-29" y="-10" width="58" height="20" rx="7" fill="#d8ba87"/>${(key==='pullup'?['#d5ba39','#8f47b9','#bd3433','#bda73c']:['#e68c32','#e68c32','#a55a32','#bda73c']).map((col,i)=>`<rect x="${-20+i*12}" y="-10" width="5" height="20" fill="${col}"/>`).join('')}`;
    if(p.kind==='led')body=`<path d="M-20 70V15M20 70V15" stroke="#aab3b7" stroke-width="6"/><ellipse cx="0" cy="-4" rx="42" ry="45" id="bench-led-halo" fill="#ff5052" opacity="0"/><path id="bench-led-body" d="M-29 25V-11A29 29 0 0 1 29-11V25Z" fill="#6b2935" stroke="#be5b67" stroke-width="2"/><path d="M-17-12Q-17-24-4-28" stroke="#eea6a9" stroke-width="5" fill="none" opacity=".5"/><rect x="-34" y="23" width="68" height="8" rx="3" fill="#a75460"/><text x="-20" y="56" font-size="10" text-anchor="middle">+</text><text x="20" y="56" font-size="10" text-anchor="middle">−</text>`;
    if(p.kind==='water')body=`<rect x="-94" y="-43" width="188" height="111" rx="14" fill="#dbeced" stroke="#8daeb0"/><path id="bench-water-level" d="M-89 4Q-44-8 0 4T89 4V60H-89Z" fill="#67bbd3"/><path d="M-35 85V10H35V85" fill="none" stroke="#647d87" stroke-width="4"/><path id="bench-switch-arm" d="M-35 10L35 10" stroke="#e7a928" stroke-width="5"/><g data-action="water" role="button" tabindex="0"><rect x="-52" y="-25" width="104" height="30" rx="14" fill="#fff"/><text x="0" y="-5" font-size="12" text-anchor="middle">点击切换液位</text></g>`;
    if(p.kind==='dht')body=`<path d="M-45 74V105M-15 74V105M15 74V105M45 74V105" stroke="#a1aeb5" stroke-width="6"/><rect x="-62" y="-40" width="124" height="120" rx="9" fill="#237dc3" stroke="#2361a0" stroke-width="3"/>${Array.from({length:6},(_,i)=>`<rect x="-47" y="${-24+i*14}" width="94" height="7" rx="2" fill="#173f76"/><path d="M-25 ${-24+i*14}V${-17+i*14}M0 ${-24+i*14}V${-17+i*14}M25 ${-24+i*14}V${-17+i*14}" stroke="#3988cb" stroke-width="4"/>`).join('')}<text x="0" y="70" text-anchor="middle" fill="#c6e5ff" font-size="12">DHT11</text>`;
    if(p.kind==='bh')body=`<rect x="-109" y="-48" width="218" height="137" rx="6" fill="#235ba4" stroke="#17447c" stroke-width="3"/><circle cx="-91" cy="-30" r="8" fill="#c3b77e"/><circle cx="91" cy="-30" r="8" fill="#c3b77e"/><rect x="-22" y="-12" width="44" height="41" fill="#18262c"/><rect x="-11" y="-4" width="22" height="21" fill="#858d93"/><circle id="bench-sensor-glow" cx="0" cy="5" r="33" fill="#ffe5a0" opacity="0"/><path d="M-50 25V50M-65 25V50M50 25V50M65 25V50" stroke="#d3c6a3" stroke-width="9"/><text x="0" y="-27" text-anchor="middle" fill="white" font-size="13">GY-302 · BH1750</text><text x="0" y="70" text-anchor="middle" fill="#b0ceea" font-size="10">SCL / SDA · 板载上拉模型</text>`;
    if(p.kind==='esp')body=`<rect x="-117" y="-74" width="234" height="176" rx="6" fill="#243947" stroke="#14232d" stroke-width="3"/><rect x="-72" y="-31" width="144" height="90" rx="5" fill="#b3bec4" stroke="#73858d"/><path d="M-55-55H-35V-38H-15V-55H5V-38H25V-55H55" stroke="#baa94d" stroke-width="4" fill="none"/><text x="0" y="2" text-anchor="middle" font-size="17" fill="#4f6570">ESP32</text><text x="0" y="23" text-anchor="middle" font-size="10" fill="#61747e">UART2 ↔ Wi-Fi</text><circle id="bench-esp-power" cx="91" cy="70" r="5" fill="#52765e"/><g id="bench-wifi" stroke="#4acb9b" stroke-width="4" fill="none"><path d="M-18-98Q0-115 18-98M-10-89Q0-100 10-89"/><circle cx="0" cy="-81" r="2"/></g>`;
    if(p.kind==='driver')body=`<rect x="-62" y="-36" width="134" height="103" rx="7" fill="#25634a" stroke="#19462f"/><rect x="-13" y="-23" width="56" height="66" rx="3" fill="#26333c"/><rect x="-13" y="-23" width="56" height="17" fill="#afb9ba"/><circle cx="15" cy="-15" r="4" fill="#4e6069"/><path d="M-60 15H1M20 65V30H32V-15H70M7 0V30" stroke="#ccd3d1" stroke-width="3" fill="none"/><path id="bench-mos-channel" d="M20 0V30" stroke="#e1c853" stroke-width="5"/>`;
    if(p.kind==='lamp')body=`<path d="M-65 60V13M65 60V13" stroke="#889999" stroke-width="4"/><rect x="-104" y="-19" width="208" height="45" rx="7" fill="#e8e5d9" stroke="#b9c0b6"/>${[-80,-40,0,40,80].map(x=>`<rect x="${x-9}" y="-7" width="18" height="19" rx="2" fill="#d0c89a"/><circle class="bench-lamp-glow" cx="${x}" cy="2" r="22" fill="#ffdc65" opacity=".08"/>`).join('')}`;
    if(p.kind==='supply')body=`<rect x="-89" y="-35" width="178" height="84" rx="10" fill="#374955"/><rect x="-65" y="-21" width="130" height="34" rx="3" fill="#102e35"/><text x="0" y="3" text-anchor="middle" fill="#86e3a2" font-size="25" font-family="monospace">12.00 V</text><path d="M-38 30V50M38 30V50" stroke="#c6b88d" stroke-width="5"/>`;
    return `<g transform="translate(${p.x} ${p.y})" class="bench-component" data-part="${key}"><text x="0" y="${p.kind==='esp'?-123:p.kind==='bh'?-66:p.kind==='dht'?-57:-58}" text-anchor="middle" class="component-title">${esc(p.label)}</text>${body}</g>`;
  }
  function scope(){
    return `<g transform="translate(705 570)"><rect x="-225" y="-145" width="450" height="318" rx="18" fill="#d9ded9" stroke="#adb9b3" stroke-width="3"/><text x="-205" y="-119" fill="#344b47" font-size="14" font-weight="700">青禾 / 双通道虚拟示波器</text><circle cx="193" cy="-124" r="5" fill="#78ad78"/><rect x="-207" y="-104" width="414" height="226" rx="7" fill="#142b31"/><g transform="translate(-195 -90)">${Array.from({length:11},(_,i)=>`<path d="M${i*39} 0V192" stroke="#2b4247"/>`).join('')}${Array.from({length:9},(_,i)=>`<path d="M0 ${i*24}H390" stroke="#2b4247"/>`).join('')}<path id="bench-wave1" fill="none" stroke="#f3cc54" stroke-width="2"/><path id="bench-wave2" fill="none" stroke="#68d2e1" stroke-width="2"/><path id="bench-cursor" d="M0 0V192" stroke="#d8ece3" stroke-width="1" stroke-dasharray="3 4"/><text id="bench-scope-note" x="195" y="82" text-anchor="middle" fill="#c7d5cf" font-size="12">先连接地夹与探头</text><text id="bench-scope-readout" x="5" y="187" fill="#90a99e" font-size="10"/></g><text x="92" y="155" fill="#506360" font-size="11">CH1 黄 / CH2 青</text></g>`;
  }
  function scene(){
    $('bench-scene').innerHTML=`<svg id="bench-svg" viewBox="0 0 980 790" aria-label="可接线的 STM32F4 开发板、传感器与示波器"><defs><pattern id="bench-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c5d3cb"/></pattern></defs><rect width="980" height="790" fill="#edf0e8"/><rect width="980" height="790" fill="url(#bench-dots)"/>${pcb()}${recipe().parts.map(part).join('')}${id==='mqtt'?'<g id="bench-cloud" transform="translate(730 355)"><path d="M-76 18C-110-4-86-38-57-29C-58-73 13-79 24-39C61-58 93-30 79-3C111 30 53 42 24 34H-57Z" fill="#dce9de" stroke="#92b89a" stroke-width="2"/><text x="0" y="1" text-anchor="middle" fill="#4d7055" font-size="14">MQTT 云端（模型）</text><circle id="bench-cloud-packet" cx="0" cy="-88" r="5" fill="#e3b64b"/><text id="bench-cloud-status" x="0" y="23" text-anchor="middle" fill="#6f8c73" font-size="11">等待发布</text></g>':''}${scope()}<g id="bench-wires"></g><g id="bench-ports">${positions().map(p=>terminal(p,!!p.header)).join('')}</g><g id="bench-packets" pointer-events="none"></g></svg>`;
  }
  function wirePath(a,b){
    if(a.id.startsWith('scope.')||b.id.startsWith('scope.')){
      const probe=a.id.startsWith('scope.')?a:b,source=probe===a?b:a,channel=probe.id==='scope.GND'?0:probe.id==='scope.CH1'?1:2,lane=936+channel*12,bottom=757+channel*10;
      return `M${source.x} ${source.y}C${source.x+45} ${source.y} ${lane} ${source.y+35} ${lane} ${source.y+65}V${bottom-12}Q${lane} ${bottom} ${lane-12} ${bottom}H${probe.x+12}Q${probe.x} ${bottom} ${probe.x} ${bottom-12}V${probe.y}`;
    }
    const bend=Math.min(120,Math.max(35,Math.abs(b.x-a.x)*.35));return `M${a.x} ${a.y}C${a.x+bend} ${a.y} ${b.x-bend} ${b.y} ${b.x} ${b.y}`;
  }
  function wires(){
    const ports=positions();$('bench-wires').innerHTML=circuit.wires.map((w,i)=>{const a=ports.find(p=>p.id===w.a),b=ports.find(p=>p.id===w.b);if(!a||!b)return '';const ground=circuit.same(w.a,'GND'),power=circuit.same(w.a,'3V')||circuit.same(w.a,'supply.+'),ch2=circuit.same(w.a,'scope.CH2');const color=ground?'#3e4e54':power?'#cb5d57':ch2?'#239cac':'#cc9b22';return `<g data-wire="${i}" role="button" tabindex="0" aria-label="删除导线 ${esc(portLabel(w.a)+' → '+portLabel(w.b))}"><path d="${wirePath(a,b)}" class="wire-hit"/><path d="${wirePath(a,b)}" class="bench-wire" stroke="${color}"/><path d="${wirePath(a,b)}" class="wire-flow" stroke="${color}" data-wire-flow="${i}"/></g>`;}).join('');
    $('bench-wire-list').innerHTML=circuit.wires.map((w,i)=>`<button data-delete-wire="${i}" title="点击拆除">${esc(portLabel(w.a))} ↔ ${esc(portLabel(w.b))} <b>×</b></button>`).join('')||'<span>还没有导线。依次点两个金色端子连接。</span>';
  }
  function inspect(name){
    selected=M.signalName(name);const h=H.describe(selected);
    $('bench-pin-info').innerHTML=`<div class="pin-info-title"><b>${esc(h.name)}</b><span>${esc(h.title)}</span></div><dl><dt>排针位置</dt><dd>${h.headers.join(' / ')||'未引出到 P1/P2'}</dd><dt>芯片封装脚号</dt><dd>${h.package.join(' / ')||'板级电源 / 连接点'}</dd><dt>项目配置</dt><dd>${esc(h.mode)} · ${esc(h.function)}</dd></dl><p>${esc(h.manual)}</p>${h.board?`<p class="pin-board-note">${esc(h.board)}</p>`:''}<div class="pin-links"><a href="${H.manual}" target="_blank" rel="noopener">开发板排针图 ↗</a><a href="${H.datasheet}" target="_blank" rel="noopener">芯片数据手册 ↗</a>${h.file?'<button id="bench-pin-source">定位项目代码</button>':''}</div>`;
    if($('bench-pin-source'))$('bench-pin-source').onclick=()=>{stop();renderCode({file:h.file,anchor:h.anchor});$('bench-caption').textContent='手动查看引脚配置。点击单步或运行可回到实验过程。';};
    document.querySelectorAll('[data-mini-pin]').forEach(n=>n.classList.toggle('pin-selected',n.dataset.miniPin===selected));
    document.querySelectorAll('[data-package-pin]').forEach(n=>n.classList.toggle('selected',n.dataset.packagePin===selected));
  }
  function packageView(){
    const body=H.packagePins.map((p,i)=>{const n=i%25,s=Math.floor(i/25),v=137+n*17;let x,y,tx,ty,anchor,rot='';if(s===0){x=122;y=v;tx=112;ty=v+4;anchor='end';}if(s===1){x=v;y=572;tx=v+4;ty=599;anchor='start';rot=` transform="rotate(90 ${tx} ${ty})"`;}if(s===2){x=572;y=545-n*17;tx=594;ty=y+4;anchor='start';}if(s===3){x=545-n*17;y=122;tx=x+4;ty=110;anchor='end';rot=` transform="rotate(90 ${tx} ${ty})"`;}
      return `<g data-package-pin="${p.name}" role="button" tabindex="0" class="package-pin ${p.name===selected?'selected':''}" aria-label="封装第${p.number}脚 ${p.name}"><rect x="${x-4}" y="${y-4}" width="${s%2?8:22}" height="${s%2?22:8}" fill="#a3b2b7"/><text x="${tx}" y="${ty}" text-anchor="${anchor}"${rot}>${p.number} ${p.name}</text></g>`;}).join('');
    $('bench-package-drawing').innerHTML=`<svg viewBox="0 0 720 720" aria-label="STM32F407VG LQFP100顶视图，全部封装引脚"><rect x="148" y="148" width="420" height="420" rx="9" fill="#1e333a"/><circle cx="167" cy="168" r="7" fill="#a9c1c8"/>${body}<text x="358" y="194" text-anchor="middle" fill="#b8d0d4" font-size="18">STM32F407VG · LQFP100</text><text x="358" y="219" text-anchor="middle" fill="#8ca9b4" font-size="12">顶视图 · 1 脚从左上向下 · 逆时针编号</text><path d="M235 320H483M358 295V471M235 320V470H483V320" fill="none" stroke="#739491" stroke-width="4"/><rect x="281" y="248" width="154" height="48" rx="5" fill="#47645c"/><text x="358" y="277" fill="#edf4df" text-anchor="middle" font-size="16">Cortex-M4 内核</text><rect x="182" y="353" width="107" height="55" rx="5" fill="#3f586b"/><text x="235" y="376" fill="#d6e2e7" text-anchor="middle">Flash / SRAM</text><text x="235" y="396" fill="#a2bbc5" text-anchor="middle" font-size="11">存储程序与数据</text><rect x="421" y="353" width="112" height="55" rx="5" fill="#4b644f"/><text x="477" y="376" fill="#e1ead8" text-anchor="middle">TIM / USART</text><text x="477" y="396" fill="#b8c9b0" text-anchor="middle" font-size="11">外设状态机</text><rect x="288" y="446" width="140" height="48" rx="5" fill="#6d5e47"/><text x="358" y="475" fill="#eee1c4" text-anchor="middle">GPIO / 引脚复用</text><text x="358" y="532" fill="#96b0b5" text-anchor="middle" font-size="12">内部为功能结构示意，不是芯片版图</text></svg>`;
    if(!$('bench-package').open)$('bench-package').showModal();
  }
  function renderCode(f){
    const source=sourceMap()[f.file];if(!source)return;
    const lines=source.split('\n'),line=f.line!==undefined?f.line-1:lines.findIndex(l=>l.includes(f.anchor));
    $('bench-code-file').textContent=f.file+(f.file.startsWith('教学/')?' · 独立例程':' · 项目原文件');
    $('bench-code').innerHTML=lines.map((l,i)=>`<div class="code-row ${i===line?'active':''}" data-bench-line="${i}"><span class="line-number">${i+1}</span><code class="code-text">${esc(l)}</code></div>`).join('');
    const row=$('bench-code').querySelector('.active');if(row)$('bench-code').scrollTop=Math.max(0,row.offsetTop-$('bench-code').offsetTop-90);
  }
  function refresh(){
    const s=circuit.status(),todo=s.progress.indexOf(false);wires();
    $('bench-status').textContent=s.short?`${s.reason}：模型停止输出，请拆除错误线`:`${s.connected}/${s.total} 项连接完成${s.complete?' · 可以运行与测量':''}`;
    $('bench-status').classList.toggle('fault',s.short);
    $('bench-steps').innerHTML=recipe().nets.map((n,i)=>`<li class="${s.progress[i]?'done':i===todo?'next':''}"><span>${s.progress[i]?'✓':i+1}</span>${esc(n.label)}</li>`).join('');
    $('bench-hint').textContent=pending?`已选 ${portLabel(pending)}，再点另一个端子接线；Esc 取消。`:todo>=0?'下一步：'+recipe().nets[todo].label:'连接完成。运行后改变参数，或拆掉一根线观察故障。';
    const next=recipe().nets[todo];document.querySelectorAll('#bench-ports [data-port]').forEach(n=>{const p=n.dataset.port;n.classList.toggle('pending',p===pending);n.classList.toggle('suggested',!!next&&[next.a,next.b].some(v=>M.canonical(p)===M.canonical(v)));});
    $('bench-switch').textContent=id==='exti'?(circuit.low?'开关：松开 / HIGH':'开关：闭合 / LOW'):(circuit.low?'液位：低 / 开关断开':'液位：正常 / 开关闭合');$('bench-network').textContent=circuit.network?'Wi-Fi：已连接（模型）':'Wi-Fi：断开（模型）';
    renderFrame();save();
  }
  function renderFrame(){
    const f=frame();renderCode(f);$('bench-caption').textContent=f.caption;$('bench-step-count').textContent=`程序步骤 ${index+1} / ${frames.length}`;
    $('bench-values').innerHTML=Object.entries(f.values||{}).map(([k,v])=>`<span>${esc(k)} <b>${esc(v)}</b></span>`).join('');
    $('bench-memory').innerHTML=f.cells?`<p>DMA / SRAM · 写指针附近的 16 格</p><div>${f.cells.map(c=>`<span class="${c.write?'write':''} ${c.read?'read':''}"><small>${c.index} ${c.write?'W':''}${c.read?'R':''}</small>${c.value===null?'—':B.hex(c.value)}</span>`).join('')}</div>`:f.slots?`<p>FreeRTOS 队列 · 数据副本</p><div>${f.slots.map((v,i)=>`<span><small>槽 ${i}</small>${esc(v)}</span>`).join('')}</div>`:f.bytes?`<p>数据寄存器 / 帧字节</p><div>${f.bytes.map((v,i)=>`<span class="${i===f.activeByte?'write':''}">${B.hex(v)}</span>`).join('')}</div>`:'';
    visuals();
  }
  function scopeTrace(){
    const width=390,height=192,time=Number($('bench-time').value),scale=24/Number($('bench-volts').value),start=Math.floor(simUs/(time*10))*time*10;let count=0,clipped=false;
    for(let ch=1;ch<=2;ch++){
      let d='',previous=null;const on=$('bench-ch'+ch).checked;
      if(on)for(let n=0;n<=390;n++){const v=circuit.probe('CH'+ch,start+n*time*10/390,frame(),opts);if(v===null){previous=null;continue;}const rawY=(ch===1?139:175)-v*scale;if(rawY<3||rawY>height-13)clipped=true;const y=Math.max(3,Math.min(height-13,rawY));d+=previous===null?`M${n} ${y}`:`H${n}V${y}`;previous=v;}
      $('bench-wave'+ch).setAttribute('d',d);if(d)count++;
    }
    $('bench-scope-note').textContent=circuit.status().short?'电源短接 / 输出停止':!circuit.same('scope.GND','GND')?'地夹未连接：没有参考电位':clipped?'波形超出屏幕，请增大 V/div':count?'':'探头未接到可测量信号';
    $('bench-scope-readout').textContent=`${time>=1000?time/1000+' ms':time+' μs'}/div · ${$('bench-volts').value} V/div · 理想信号 · ${playing?'RUN':'STOP'}`;
    const x=(simUs%(time*10))/(time*10)*width;$('bench-cursor').setAttribute('d',`M${x} 0V${height}`);
  }
  function visuals(){
    if(!$('bench-svg'))return;scopeTrace();const good=circuit.power&&!circuit.status().short;
    if(id==='gpio'){
      const high=circuit.signal('PD12',simUs,frame(),opts)>1,connected=circuit.status().progress.slice(0,3).every(Boolean),on=high&&good;
      $('bench-PD12').setAttribute('opacity',on?'1':'.25');$('bench-led-body').setAttribute('fill',on&&connected?'#ff4b51':'#6b2935');$('bench-led-halo').setAttribute('opacity',on&&connected?'.25':'0');
    }
    if(['input','exti'].includes(id)){$('bench-water-level').setAttribute('transform',circuit.low?'translate(0 35) scale(1 .4)':'');$('bench-switch-arm').setAttribute('d',circuit.low?'M-35 10L23-16':'M-35 10L35 10');}
    if(id==='fan')$('bench-actuator-rotor').classList.toggle('spinning',circuit.signal('driver.D',simUs,frame(),opts)===0);
    if(id==='pump')$('bench-pump-flow').setAttribute('opacity',circuit.signal('driver.D',simUs,frame(),opts)===0?'1':'0');
    if(id==='pwm'){
      const on=circuit.signal('driver.D',simUs,frame(),opts)===0,complete=circuit.status().progress.slice(0,5).every(Boolean)&&good;
      $('bench-mos-channel').setAttribute('stroke',on?'#ffe259':'#64736b');document.querySelectorAll('.bench-lamp-glow').forEach(n=>n.setAttribute('opacity',complete?String(.08+Number(opts.duty)/100*.78):'.04'));
    }
    if($('bench-sensor-glow'))$('bench-sensor-glow').setAttribute('opacity',circuit.powered('bh')?'.25':'0');
    if($('bench-esp-power')){$('bench-esp-power').setAttribute('fill',good&&circuit.same('esp.3V3','3V')&&circuit.same('esp.GND','GND')?'#5bd189':'#52765e');$('bench-wifi').setAttribute('opacity',good&&circuit.network&&circuit.same('esp.3V3','3V')&&circuit.same('esp.GND','GND')?'1':'.1');}
    if($('bench-cloud')){const online=good&&circuit.network&&circuit.status().progress.slice(0,4).every(Boolean),sent=online&&frame().stage==='publish';$('bench-cloud').setAttribute('opacity',online?'1':'.45');$('bench-cloud-status').textContent=sent?'本步：发布成功（模型）':online?'会话可用 · 等待当前步骤':'未建立云连接';$('bench-cloud-packet').setAttribute('opacity',sent?'1':'0');$('bench-cloud-packet').setAttribute('cy',String(-88+(stepMs%1800)/1800*40));}
    document.querySelectorAll('[data-wire-flow]').forEach(n=>{const w=circuit.wires[Number(n.dataset.wireFlow)],v=circuit.signal(w.a,simUs,frame(),opts);n.style.opacity=playing&&v!==null&&v>0?'.8':'0';n.style.strokeDashoffset=String(-simUs/Math.max(1,Number($('bench-time').value))*3);});
    plantVisual();
  }
  function plantVisual(){
    const s={...projectState,low:$('bench-env-low')?.checked},ready=!circuit.status().short&&recipe().nets.every((n,i)=>n.a.startsWith('scope.')||n.b.startsWith('scope.')||circuit.status().progress[i]);
    let note=projectHasRun?'原 C 输出 → 本课线路 → 执行器':'完成接线后运行种菜机';
    if(!projectHasRun&&id==='pwm'){s.out_led=ready?Number(opts.duty):0;note=ready?'PWM 教学输出 → 补光灯':'驱动路径未接通，灯条不亮';}
    if(id==='gpio'){s.indicator=ready&&circuit.signal('PD12',simUs,frame(),opts)>1;note=projectHasRun?'项目 PD12 风扇输出 → 外接指示 LED':'闪灯例程 → 面板指示灯（非风扇算法）';}
    if(['pwm','fan','pump'].includes(id)&&!ready){s['out_'+({pwm:'led',fan:'fan',pump:'drip'}[id])]=0;note='GPIO 需求与负载分开：本课电路未接通';}
    if(circuit.status().short){for(const k of ['out_led','out_fan','out_drip','out_mist','out_refill'])s[k]=0;note='电源短接，教学模型停止负载';}
    window.PlanterView?.update('bench-grow',s,note);
  }
  async function runProject(){
    if(projectRunning||!ctx.control)return;stop();const epoch=projectEpoch;let replayStarted=false;projectRunning=true;$('bench-project-run').disabled=true;
    try{
      if(['temp','rh','lux'].some(k=>!$('bench-env-'+k).reportValidity()))return;
      const progress=circuit.status().progress,valid=recipe().nets.every((n,i)=>n.a.startsWith('scope.')||n.b.startsWith('scope.')||progress[i])&&!circuit.status().short;
      const values={temp:Number($('bench-env-temp').value),rh:Number($('bench-env-rh').value),lux:Number($('bench-env-lux').value),low:$('bench-env-low').checked,dht:id==='dht'?valid:true,light:['i2c','debug'].includes(id)?valid:true,network:circuit.network,physics:false,sampling:true,water_valid:true};
      if(id==='input')values.low=circuit.signal('PB1',simUs,frame(),opts)>1;
      await ctx.control({action:'inputs',values});if(epoch!==projectEpoch)return;
      const snapshot=await ctx.control({action:'advance',ms:2000});if(epoch!==projectEpoch)return;
      projectHasRun=true;circuit.projectMode=true;const trace=snapshot.trace||[];let p=0;
      $('bench-project-note').textContent='正在按原 C 观察点回放：采样 → 控制判断 → board_outputs 提交。接线不会把“输出命令”伪装成已经通电。';
      const show=()=>{if(epoch!==projectEpoch)return;const point=trace[p++];if(point){projectState={...point.state,...point.pins};circuit.control=projectState;renderCode(point);$('bench-caption').textContent=`原 C 执行回放 · ${point.file}:${point.line} · ${point.kind==='gpio_model'?'输出提交到引脚模型':'控制判断，输出尚未提交'}`;plantVisual();projectTimer=setTimeout(show,70);}else{projectState=snapshot.state;circuit.control=projectState;projectRunning=false;$('bench-project-run').disabled=false;if(id==='pwm'){opts.duty=projectState.out_led;const n=document.querySelector('[data-bench-option="duty"]');if(n)n.value=opts.duty;}visuals();$('bench-project-note').textContent=`模拟时间 ${(snapshot.elapsed/1000).toFixed(1)} s · 原 C 输出已更新。继续推进可观察 5 秒泵限时、冷却、滞回和补光变化。`;}};replayStarted=true;show();
    }catch(e){$('bench-project-note').textContent=e.message;}finally{if(!replayStarted||epoch!==projectEpoch){projectRunning=false;$('bench-project-run').disabled=false;}}
  }
  function stop(){playing=false;cancelAnimationFrame(raf);raf=0;clearTimeout(projectTimer);projectEpoch++;projectRunning=false;if($('bench-project-run'))$('bench-project-run').disabled=false;if($('bench-play'))$('bench-play').textContent='▶ 运行并跟随代码';}
  function tick(now){
    if(!playing)return;const delta=Math.min(80,now-last);last=now;stepMs+=delta;drawMs+=delta;
    // Scope time advances at a visible teaching speed. The readout remains in signal units.
    simUs+=delta*(id==='gpio'?1000:id==='uart'?(1e6/115200)/1800:Number($('bench-time').value)*10/1800);
    if(id==='gpio'){
      const phase=simUs%1e6,next=phase<30000?1:phase<500000?2:phase<530000?3:4;
      if(index!==next){index=next;renderFrame();}
    }else if(id==='uart'){
      const next=Math.floor(simUs*115200/1e6)%12;if(index!==next){index=next;renderFrame();}
    }else if(id==='pwm'){
      const period=(Number(opts.psc)+1)*(Number(opts.arr)+1)/84,cnt=Math.floor((simUs%period)/period*(Number(opts.arr)+1));
      let next=2;for(let i=2;i<frames.length-1;i++)if(Number(frames[i].values.CNT)<=cnt)next=i;
      if(index!==next){index=next;renderFrame();}
    }else if(stepMs>=1800){stepMs=0;index=(index+1)%frames.length;simUs=0;renderFrame();}
    if(drawMs>=45){drawMs=0;visuals();}raf=requestAnimationFrame(tick);
  }
  function play(){if(playing){stop();visuals();return;}if(circuit.status().short){$('bench-hint').textContent='先拆除电源短接线，再运行。';return;}if(id==='gpio'){projectHasRun=false;circuit.projectMode=false;projectState={};}playing=true;last=performance.now();if(id==='gpio'&&index===0)index=1;$('bench-play').textContent='Ⅱ 暂停代码和信号';renderFrame();raf=requestAnimationFrame(tick);}
  function step(direction){stop();if(id==='gpio'){projectHasRun=false;circuit.projectMode=false;projectState={};}index=Math.max(0,Math.min(frames.length-1,index+direction));if(id==='gpio')simUs=frame().output?0:500000;else if(id==='uart')simUs=(index+.5)*1e6/115200;else if(id==='pwm')simUs=(Number(frame().values.CNT)||0)*(Number(opts.psc)+1)/84;else simUs=0;renderFrame();}
  function connect(port){
    const header=H.headers.find(h=>h.id===port);if(header)inspect(header.name);
    if($('bench-mode').value==='inspect')return;
    if(!circuit.validPort(port)){$('bench-hint').textContent='这个端子标记为 NC，保持不连接。';return;}
    if(pending===port)pending=null;
    else if(!pending)pending=port;
    else {circuit.add(pending,port);pending=null;buildFrames();}
    refresh();
  }
  function open(next='gpio'){if(!ctx)return;ctx.pause();window.BoardLab.stop();pick(next);if(!$('circuit-bench').open)$('circuit-bench').showModal();}
  function fromModule(module){const target={gpio:'gpio',pwm:'pwm',i2c:'i2c',dht:'dht',uart:'uart',dma:'dma',queue:'rtos'}[module];if(target)open(target);else window.BoardLab.open(module);}
  function init(context){
    ctx=context;$('bench-lessons').innerHTML=Object.entries(M.recipes).map(([k,v])=>`<option value="${k}">${esc(v.title)}</option>`).join('');
    $('bench-lessons').onchange=e=>pick(e.target.value);
    $('bench-close').onclick=()=>{stop();$('circuit-bench').close();};$('circuit-bench').addEventListener('close',stop);
    $('bench-play').onclick=play;$('bench-next').onclick=()=>step(1);$('bench-prev').onclick=()=>step(-1);
    $('bench-project-run').onclick=runProject;
    $('bench-connect-wire').onclick=()=>{const a=$('bench-wire-from').value,b=$('bench-wire-to').value;if(!a||!b||a===b){$('bench-hint').textContent='请选择两个不同端子。';return;}circuit.add(a,b);pending=null;buildFrames();refresh();};
    $('bench-start-wire').onclick=()=>{const i=circuit.status().progress.indexOf(false);if(i<0){$('bench-hint').textContent='接线已完成，可以接探头并运行。';return;}const n=recipe().nets[i],pick=v=>H.headers.find(h=>h.name===v&&h.header==='P2')?.id||H.headers.find(h=>h.name===v)?.id||v;const a=pick(n.a),b=pick(n.b);$('bench-wire-from').value=a;$('bench-wire-to').value=b;pending=a;if(H.headers.some(h=>h.id===a))inspect(a);refresh();$('bench-hint').textContent=`本根线：${portLabel(a)} → ${portLabel(b)}。起点已选中，请点终点；也可以按“连接这两个端子”。`;};
    $('bench-example').onclick=()=>{stop();circuit.load();pending=null;buildFrames();refresh();};
    $('bench-clear').onclick=()=>{stop();circuit.clear();pending=null;buildFrames();refresh();};
    $('bench-undo').onclick=()=>{circuit.remove(circuit.wires.length-1);pending=null;buildFrames();refresh();};
    $('bench-mode').onchange=()=>{pending=null;refresh();};
    $('bench-options').onchange=e=>{const n=e.target;if(!n.dataset.benchOption||!n.reportValidity())return;opts[n.dataset.benchOption]=n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value;stop();index=0;buildFrames();renderFrame();};
    $('bench-time').onchange=visuals;$('bench-volts').onchange=visuals;$('bench-ch1').onchange=visuals;$('bench-ch2').onchange=visuals;
    $('bench-switch').onclick=()=>{circuit.low=!circuit.low;buildFrames();refresh();};$('bench-network').onclick=()=>{circuit.network=!circuit.network;buildFrames();refresh();};
    $('bench-zoom').min=65;$('bench-zoom').oninput=e=>{$('bench-svg').style.minWidth='0';$('bench-svg').style.width=Number(e.target.value)+'%';};
    $('bench-package-open').onclick=packageView;$('bench-package-close').onclick=()=>$('bench-package').close();
    $('bench-package-drawing').onclick=e=>{const n=e.target.closest('[data-package-pin]');if(n){inspect(n.dataset.packagePin);$('bench-package-selected').textContent=n.getAttribute('aria-label')+' · '+H.describe(n.dataset.packagePin).title;}};
    $('bench-package-drawing').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-package-pin]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
    $('bench-scene').onclick=e=>{const p=e.target.closest('[data-port]'),w=e.target.closest('[data-wire]'),a=e.target.closest('[data-action]');if(p)connect(p.dataset.port);else if(w){circuit.remove(Number(w.dataset.wire));buildFrames();refresh();}else if(a?.dataset.action==='package')packageView();else if(a?.dataset.action==='water')$('bench-switch').click();};
    $('bench-scene').onkeydown=e=>{if(e.key==='Escape'&&pending){e.preventDefault();e.stopPropagation();pending=null;refresh();}if(e.key==='Enter'||e.key===' '){const target=e.target.closest('[data-port],[data-wire],[data-action]');if(target){e.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}}};
    $('bench-wire-list').onclick=e=>{const n=e.target.closest('[data-delete-wire]');if(n){circuit.remove(Number(n.dataset.deleteWire));buildFrames();refresh();}};
    $('bench-theory').onclick=()=>{stop();window.BoardLab.open(recipe().module);};
    $('board-open').onclick=()=>open();
    $('component-lab').onclick=()=>fromModule($('component-lab').dataset.chip);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    const requested=new URLSearchParams(location.search).get('bench');if(M.recipes[requested])setTimeout(()=>open(requested),0);
  }
  window.CircuitBench={init,open,stop,fromModule};
})();
