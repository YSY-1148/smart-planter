/* Executable numerical/algorithm teaching models; no claim of MCU/OS execution. */
(() => {
  const N=(key,label,min,max,value,step=1)=>({key,label,min,max,value,step});
  const f=(line,caption,values,cells=[],series=[],effect={})=>({line,caption,values,cells,series,effect});
  const bits=v=>Array.from({length:8},(_,i)=>({label:'b'+(7-i),value:(v>>>(7-i))&1}));
  const models={};
  function add(id,title,controls,code,run){models[id]={title,controls,code,run};}
  add('bits','位运算与有效掩码',[N('value','原值 / 掩码',0,255,5),N('bit','目标位',0,7,1)],`uint32_t mask = 1u << bit;
uint32_t set = value | mask;
uint32_t clear = value & ~mask;
bool valid = (value & mask) != 0;`,o=>{const mask=1<<o.bit;return[f(1,'先构造只含一个 1 的掩码。',{mask},bits(mask)),f(2,'按位或可以设置指定的一位。',{结果:o.value|mask},bits(o.value|mask)),f(3,'与取反的掩码清除目标位，其余位保留。',{结果:o.value&~mask},bits(o.value&~mask)),f(4,'读取位的存在性，与数值是否为零是不同问题。',{有效:!!(o.value&mask)},bits(o.value))];});
  add('types','整数宽度与无符号回绕',[N('value','输入整数',-2147483648,4294967295,255),N('bits','演示宽度',8,32,8,8)],`uint64_t modulus = UINT64_C(1) << width;
uint32_t u = ((value % modulus) + modulus) % modulus;
int32_t signed_value = u >= modulus/2 ? u-modulus : u;`,o=>{const m=2**o.bits,u=((o.value%m)+m)%m;return[f(1,'本模型显式指定宽度；真实 C 类型大小以目标 ABI 为准。',{模数:m}),f(2,'无符号转换按模数取余。',{无符号:u},bits(u)),f(3,'仅用于观察二进制补码解释，不把它当成所有 C 实现转换规则。',{补码解释:u>=m/2?u-m:u,CHAR_BIT:'目标相关'})];});
  add('memory','对齐、字节与结构体布局',[N('a','字段一字节数',1,8,1),N('b','字段二对齐和大小',1,8,4)],`size_t offset = first_size;
size_t aligned = (offset + alignment-1) / alignment * alignment;
size_t end = aligned + second_size;
size_t total = (end + alignment-1) / alignment * alignment;`,o=>{const align=o.b,off=Math.ceil(o.a/align)*align,total=Math.ceil((off+o.b)/align)*align;return[f(1,'示例是两个字段的抽象布局；真实结构体用 sizeof / offsetof 验证。',{首字段:o.a},Array.from({length:o.a},(_,i)=>({label:i,value:'A'}))),f(2,'为第二字段满足对齐要求插入填充。',{第二字段偏移:off,填充:off-o.a}),f(4,'数组中的每个元素也需要满足结构体整体对齐。',{总字节:total},Array.from({length:total},(_,i)=>({label:i,value:i<o.a?'A':i<off?'pad':i<off+o.b?'B':'pad'})))];});
  add('pointer','指针、数组与对象寿命',[N('a','数组元素大小 / 字节',1,8,4),N('b','元素下标',0,7,2)],`uintptr_t base = 0x20000000;
uintptr_t address = base + index * sizeof(element);
/* address arithmetic does not extend object lifetime */
/* a callback must not retain a pointer to a dead local object */`,o=>[f(1,'地址示例独立于本机实际内存。',{基址:'0x20000000'}),f(2,'p+index 按所指元素大小移动，不是总加一个字节。',{地址:'0x'+(0x20000000+o.a*o.b).toString(16)},Array.from({length:8},(_,i)=>({label:'+'+i*o.a,value:i===o.b?'p →':'元素'}))),f(4,'保存地址并不延长局部对象的寿命。队列复制结构体与复制指针要区分。',{生命周期:'需由设计保证'})]);
  add('copy','重叠拷贝的方向',[N('a','目标起点',0,5,2),N('b','复制长度',1,5,4)],`if (dst > src && dst < src+n) {
    for (size_t i=n; i>0; --i) dst[i-1]=src[i-1];
} else {
    for (size_t i=0; i<n; ++i) dst[i]=src[i];
}`,o=>{const arr=Array.from({length:10},(_,i)=>i),out=[f(1,'初始化源区域 [0,n)，目标从指定位置开始。',{源:0,目标:o.a},arr.map((v,i)=>({label:i,value:v})))],reverse=o.a>0&&o.a<o.b;for(let k=0;k<o.b;k++){const i=reverse?o.b-k-1:k;arr[o.a+i]=arr[i];out.push(f(reverse?2:4,'按不会覆盖后续源数据的方向复制。',{方向:reverse?'从后向前':'从前向后',复制下标:i},arr.map((v,i)=>({label:i,value:v}))));}return out;});
  add('race','读改写交错与丢失更新',[N('a','初值',0,1000,0),N('b','使用串行临界区 0/1',0,1,0)],`tmp_A = count;
tmp_B = count; // may run before A stores
count = tmp_A + 1;
count = tmp_B + 1; // stale read can overwrite A
// serialize the whole read-modify-write, not only the store`,o=>o.b?[f(1,'整个读改写受到同步保护，A 完成后 B 才读取。',{count:o.a}),f(3,'A 提交。',{count:o.a+1}),f(5,'B 读到新值，再提交。',{count:o.a+2,丢失:0})]:[f(1,'A 读取旧值。',{A:o.a,count:o.a}),f(2,'B 也读取同一个旧值。',{A:o.a,B:o.a,count:o.a}),f(3,'A 加一并写回。',{count:o.a+1}),f(4,'B 用旧副本写回，覆盖了 A 的更新。volatile 不会修复此交错。',{count:o.a+1,期望:o.a+2,丢失:1})]);
  add('ring','有界环形缓冲',[N('a','容量',2,16,8),N('b','连续写入数',0,24,10)],`for (unsigned n=0; n<input_count; ++n) {
    if (used == capacity) { dropped++; continue; }
    data[write] = n;
    write = (write+1) % capacity; used++;
}`,o=>{let w=0,used=0,drop=0,mem=Array(o.a).fill('—'),out=[];for(let n=0;n<=o.b;n++){if(n){if(used===o.a)drop++;else{mem[w]=n-1;w=(w+1)%o.a;used++;}}out.push(f(drop?2:4,'本模型采用显式 used 计数与满时拒绝，不把它与项目循环 DMA 的覆盖策略混淆。',{written:w,used,dropped:drop},mem.map((v,i)=>({label:i+(i===w?' W':''),value:v}))));}return out;});
  add('time','无符号时间差与非阻塞超时',[N('a','起始 tick',0,4294967295,4294967200),N('b','经过毫秒',0,10000,300)],`uint32_t now = start + elapsed; // modulo 2^32
uint32_t delta = now - start;
bool stable = delta >= 300u;
// require the real interval to be less than one full counter period`,o=>{const now=(o.a+o.b)>>>0,d=(now-o.a)>>>0;return[f(1,'计数器可以跨越最大值回到零。',{start:o.a,now}),f(2,'同一无符号宽度的差值保留经过时间。',{delta:d}),f(3,'例如液位稳定 300 ms 的判断不会因为一次回绕直接失效。',{稳定:d>=300})];});
  add('control','滞回控制与有效性',[N('temp','温度 °C',-20,60,29,.1),N('rh','湿度 %',0,100,45),N('lux','光照 lx',0,60000,500),N('low','低液位 0/1',0,1,0)],`if (temp >= 28) fan = true;
else if (temp <= 26) fan = false;
bool irrigation = humidity <= 50 && !low;
// full project also checks freshness, timers and interlocks`,o=>{let fan=false;return [25,o.temp,27,25].map((temp,i)=>{if(temp>=28)fan=true;else if(temp<=26)fan=false;return f(i===2?2:1,'简化教学状态序列；完整泵时限、采样新鲜度与互斥请使用原 C 控制实验。',{阶段温度:temp,风扇:fan,低液位:!!o.low},[],[],{out_fan:+fan,out_drip:+(o.rh<=50&&!o.low),out_led:o.lux<9000?5:0,low:!!o.low});});});
  add('timer','定时器的分频与回绕',[N('psc','PSC',0,65535,83),N('arr','ARR',1,65535,999)],`double counter_hz = 84000000.0/(psc+1);
double period_s = (arr+1)/counter_hz;
counter = (counter+1) % (arr+1);`,o=>[f(1,'这里使用项目 TIM4 的 84 MHz 输入；其他定时器需重新查时钟树。',{计数频率:84000000/(o.psc+1)}),f(2,'计数 0 到 ARR，共 ARR+1 个计数。',{周期_us:(o.arr+1)*(o.psc+1)/84,频率_Hz:84000000/(o.psc+1)/(o.arr+1)}),...Array.from({length:9},(_,i)=>f(3,'观察计数走到末端再回到 0。',{CNT:i===8?0:Math.floor(i*o.arr/7)},[],[{x:i,y:i===8?0:Math.floor(i*o.arr/7)}]))]);
  add('capture','输入捕获测量周期',[N('a','第一次捕获值',0,65535,65000),N('b','两边沿间隔 tick',1,65535,1000)],`uint16_t capture2 = capture1 + period_ticks;
uint16_t delta = capture2 - capture1;
float frequency = 1000000.0f / delta; // 1 MHz counter`,o=>{const c2=(o.a+o.b)&65535,d=(c2-o.a)&65535;return[f(1,'用 16 位、1 MHz 的示例计数器捕获两个同类边沿。',{CCR1:o.a,CCR2:c2}),f(2,'这里假定两边沿间不超过一个完整周期。',{周期_us:d}),f(3,'频率是计数频率除以间隔计数，不是用 PWM 输出频率代替测量。',{频率_Hz:1e6/d})];});
  add('encoder','正交编码器与方向',[N('a','四倍频后每机械圈计数',4,4096,400),N('b','位移计数（正反）',-1000,1000,25)],`float mechanical_deg = count * 360.0f/counts_per_turn;
float electrical_deg = pole_pairs * mechanical_deg;
// direction comes from A/B transition order; index marks a reference`,o=>[f(1,'示例输入已经是译码后的计数；AB 相位次序决定计数方向。',{机械角_deg:o.b*360/o.a},['00','01','11','10'].map((v,i)=>({label:i,value:v}))),f(2,'设 4 极对用于教学，电角等于机械角乘极对数。零位还需标定。',{电角_deg:o.b*360/o.a*4,极对数:4})]);
  add('adc','采样保持与量化',[N('voltage','输入电压 V',0,3.3,1.65,.01),N('vref','参考电压 V',1,3.6,3.3,.1),N('bits','分辨率 bit',8,16,12)],`double scaled = vin/vref * (1u << bits);
unsigned code = clamp(floor(scaled), 0, (1u<<bits)-1);
double reconstructed = code*vref/(1u<<bits);`,o=>{const n=2**o.bits,code=Math.max(0,Math.min(n-1,Math.floor(o.voltage/o.vref*n)));return[f(1,'理想量化模型；未模拟输入阻抗、采样电容和噪声。',{电压:o.voltage,LSB_V:o.vref/n}),f(2,'输入范围之外饱和；满量程不是产生第 4096 个编码。',{ADC码:code},bits(code&255)),f(3,'重建值与输入的差来自量化，ADC 拓展未用于原种菜机传感器。',{重建_V:code*o.vref/n,误差_V:o.voltage-code*o.vref/n},[],[],{out_led:Math.round(code/(n-1)*100)})];});
  add('filter','一阶低通的逐样本更新',[N('a','输入阶跃幅度',0,100,50),N('b','系数 α（0–1）',.01,1,.2,.01)],`float y = 0;
for (unsigned k=0; k<20; ++k) {
    y += alpha * (input - y);
}`,o=>{let y=0,points=[],out=[];for(let k=0;k<20;k++){y+=o.b*(o.a-y);points.push({x:k,y});out.push(f(3,'系数越小，平滑更强但响应更慢。固定采样率后才能把系数映射到截止频率。',{k,input:o.a,y:+y.toFixed(4)},[],[...points]));}return out;});
  add('spi','SPI 模式与移位',[N('a','发送字节',0,255,165),N('b','模式 0–3',0,3,0)],`CS = 0;
for (int bit=7; bit>=0; --bit) {
    MOSI = (byte >> bit) & 1;
    // CPOL sets idle level; CPHA selects first/second sampling edge
}
CS = 1;`,o=>{const out=[f(1,'先选择从机，接收端才把随后时钟解释为本次事务。',{CS:0,CPOL:o.b>>1,CPHA:o.b&1})];for(let i=7;i>=0;i--)out.push(f(3,'此例 MSB 先传；必须核对实际器件对模式、位序和片选的要求。',{位:i,MOSI:(o.a>>i)&1,采样沿:(o.b&1)?'第二沿':'第一沿'},bits(o.a)));out.push(f(6,'释放片选结束这次事务。',{CS:1}));return out;});
  add('protocol','按流接收与长度检查',[N('a','每次收到字节数',1,16,3),N('b','声明长度',0,80,8)],`if (declared > capacity) return INVALID;
while (available < declared) append(new_bytes);
if (crc_ok) deliver_one_frame();
keep_remaining_bytes_for_next_frame();`,o=>{const out=[f(1,'边界检查先于缓存写入；接收调用的边界不是协议帧边界。',{声明长度:o.b,缓存容量:64})];if(o.b>64)return[...out,f(1,'非法长度被拒绝，不分配或复制越界数据。',{结果:'拒绝'})];for(let n=0;n<Math.max(1,o.b);n+=o.a)out.push(f(2,'分批到达的字节累积，直到协议定义的完整边界。',{累计:Math.min(o.b,n+o.a),尚缺:Math.max(0,o.b-n-o.a)},Array.from({length:Math.min(o.b,n+o.a)},(_,i)=>({label:i,value:'byte'}))));out.push(f(3,'此模型假定 CRC 已通过；具体 CRC 用下一模型或原 C 验证。',{结果:'完整帧'}));return out;});
  function crc(bytes){let c=0xffff;for(const byte of bytes){c^=byte<<8;for(let i=0;i<8;i++)c=(c&0x8000)?((c<<1)^0x1021)&65535:(c<<1)&65535;}return c;}
  add('crc','CRC-16/CCITT-FALSE',[N('a','末尾追加字节（0表示不追加）',0,255,0),N('b','翻转首字节一位 0/1',0,1,0)],`uint16_t crc = 0xffff;
for each byte { crc ^= (uint16_t)byte << 8;
    repeat 8 times: crc = (crc & 0x8000) ? (crc<<1)^0x1021 : crc<<1;
}
// mask every intermediate result to 16 bits`,o=>{const bytes=Array.from('123456789',c=>c.charCodeAt(0));if(o.b)bytes[0]^=1;if(o.a)bytes.push(o.a);return bytes.map((byte,i)=>f(3,'逐字节计算。标准向量 123456789、无改动时结果应为 0x29B1。',{byte,CRC:'0x'+crc(bytes.slice(0,i+1)).toString(16).toUpperCase().padStart(4,'0')},bytes.map((v,j)=>({label:j,value:j<=i?v:'—'}))));});
  add('modbus','RTU 静默间隔',[N('a','波特率',1200,115200,9600),N('b','观察到的间隔 μs',0,10000,4000)],`double char_us = 11.0e6/baud;
double t35 = baud > 19200 ? 1750 : 3.5*char_us;
bool boundary = silence_us >= t35;`,o=>[f(1,'本例按 11 位字符计算。实际串口帧格式必须与协议配置一致。',{字符_us:11e6/o.a}),f(2,'较高波特率采用协议建议的固定计时值；单个 UART IDLE 不自动等同于 RTU 帧界限。',{t35_us:o.a>19200?1750:3.5*11e6/o.a}),f(3,'定时器与字节接收共同维护帧状态。',{满足间隔:o.b>=(o.a>19200?1750:3.5*11e6/o.a)})]);
  add('can','标准 CAN 仲裁',[N('a','节点 A 的11位ID',0,2047,0x123),N('b','节点 B 的11位ID',0,2047,0x120)],`for (int bit=10; bit>=0; --bit) {
    bus = tx_A & tx_B; // dominant 0
    if (tx == 1 && bus == 0) stop_arbitrating();
}`,o=>{let aliveA=true,aliveB=true,out=[];for(let bit=10;bit>=0;bit--){const a=(o.a>>bit)&1,b=(o.b>>bit)&1,bus=(aliveA?a:1)&(aliveB?b:1);if(aliveA&&a&&!bus)aliveA=false;if(aliveB&&b&&!bus)aliveB=false;out.push(f(3,'限定为同时起始的标准数据帧，只展开标识符仲裁；丢仲裁不是发送错误。',{bit,A:a,B:b,bus,继续:aliveA&&aliveB?'两者':aliveA?'A':'B'}));}return out;});
  add('cache','CPU 缓存与 DMA 观察',[N('a','CPU 缓存值',0,255,10),N('b','SRAM 新值',0,255,20)],`cpu_cache = old_value;
DMA_writes(sram, new_value);
read_without_invalidate = cpu_cache;
invalidate_cache_line();
read_after_invalidate = sram;`,o=>[f(1,'此为含 D-cache 平台的简化读场景，当前 F407 不具备 Cortex-M7 那类 D-cache。',{cache:o.a,SRAM:o.a}),f(2,'DMA 更新 SRAM，CPU 的旧缓存副本不会因此自动更新。',{cache:o.a,SRAM:o.b}),f(3,'未做必要维护可能读到旧值。',{CPU读到:o.a}),f(5,'假定缓存行没有未处理脏数据且所有权正确，失效后重新读取。',{CPU读到:o.b})]);
  add('schedule','周期任务与阻塞',[N('a','每轮执行时间 ms',1,200,20),N('b','计划周期 ms',1,500,100)],`Tick next = 0;
for each iteration {
    execute(work_ms);
    next += period_ms;
    wait_until(next); // late task cannot sleep into the past
}`,o=>{let now=0,out=[],series=[];for(let k=1;k<=6;k++){const start=now;now+=o.a;const deadline=k*o.b,late=now>deadline;series.push({x:k,y:now});out.push(f(3,'执行时间、阻塞和唤醒都影响响应；这里不模拟真实内核抢占。',{轮:k,开始:start,结束:now,目标:deadline,超时:late},[],[...series]));now=Math.max(now,deadline);out.push(f(5,'绝对时刻保持相位；执行超时无法被 delayUntil 自动修复。',{下轮开始:now}));}return out;});
  add('priority','优先级反转与继承',[N('a','中优先级任务工作片段数',0,10,3),N('b','启用互斥锁继承 0/1',0,1,1)],`L_lock(mutex);
H_wait(mutex);
if (inheritance) boost(L, priority_H);
L_finish_and_unlock();
H_acquire();`,o=>[f(1,'低优先级任务 L 先持有资源，高优先级 H 随后需要它。',{持锁:'L'}),f(2,'H 阻塞；没有继承时，中优先级 M 可继续推迟 L。',{H:'阻塞',额外干扰片段:o.b?0:o.a}),f(3,'继承只帮助持锁者及时释放，不减少临界区本身执行时间，也不解决死锁。',{L有效优先级:o.b?'继承 H':'原优先级'}),f(5,'释放资源后 H 获得锁，L 恢复相应有效优先级。',{持锁:'H'})]);
  add('heap','峰值、碎片与固定块',[N('a','申请块数',1,12,6),N('b','每块字节数',4,64,16)],`for each request {
    if (used + block_size > capacity) return NULL;
    used += block_size;
}
// free and ownership must match the allocator`,o=>{const out=[],cap=128;let used=0;for(let i=0;i<o.a;i++){const ok=used+o.b<=cap;if(ok)used+=o.b;out.push(f(ok?3:2,'此例只计算固定容量与峰值，不伪装成通用堆碎片分配器。',{请求:i+1,used,剩余:cap-used,结果:ok?'成功':'失败'},Array.from({length:16},(_,i)=>({label:i*8,value:i*8<used?'占用':'空闲'}))));}return out;});
  add('network','生产消费与断网积压',[N('a','每秒产生消息数',1,20,4),N('b','每秒发送能力',0,20,2)],`produced += rate_in;
sent = min(queue + rate_in, rate_out);
queue = min(capacity, queue + rate_in - sent);
// a latest-value slot overwrites old telemetry instead of queuing it`,o=>{let q=0,out=[],points=[];for(let t=1;t<=10;t++){const n=q+o.a,sent=Math.min(n,o.b),drop=Math.max(0,n-sent-16);q=Math.min(16,n-sent);points.push({x:t,y:q});out.push(f(3,'队列容量 16。遥测可以采用最新值覆盖，命令需单独的拒绝、重试和幂等策略。',{秒:t,待发:q,本轮丢弃:drop,发送:sent},[],[...points]));}return out;});
  add('boot','断电升级与提交标记',[N('a','写完第几个块断电（4=写完）',0,4,2),N('b','完整校验通过 0/1',0,1,1)],`write_inactive_slot(blocks);
verify_image();
if (verified) atomic_commit_boot_record();
boot_last_committed_image();`,o=>[f(1,'示例采用双槽和最后提交的元数据；原项目未实现此 Bootloader。',{已写块:o.a,活动槽:'A'},Array.from({length:4},(_,i)=>({label:'B'+i,value:i<o.a?'已写':'空'}))),f(2,'不完整镜像或验证失败均不得切换。',{完整:o.a===4,校验:!!o.b}),f(4,'选择最后一个有效提交记录，元数据本身也需断电一致性设计。',{启动:o.a===4&&o.b?'B':'A'})]);
  add('fault','故障证据与定位',[N('a','故障类型：0精确总线/1栈/2未定义指令',0,2,0),N('b','能否安全保存最小记录 0/1',0,1,1)],`snapshot_minimal_fault_registers();
validate_exception_stack_pointer();
if (stack_is_valid) record_stacked_PC_LR_xPSR();
// use minimal nonblocking persistence; avoid printf/heap in fault path`,o=>[f(1,'先保存 CFSR/HFSR 等证据；不是所有故障的地址寄存器都有效。',{示例类型:['精确总线访问','异常入栈失败','未定义指令'][o.a]}),f(2,'异常栈帧可能不完整或指向无效内存，读取前必须验证。',{栈可读:o.a!==1}),f(4,'只保留可安全保存的最小现场。当前 board_panic 只停止输出，没有完整现场记录。',{最小记录:o.b?'保存':'不可安全保存'},[],[],{out_fan:0,out_led:0})]);
  add('rtc','RTC 分频与时钟误差',[N('a','LSE 实际频率 Hz',32000,33500,32768),N('b','观察秒数',1,86400,3600)],`double divider = (127+1) * (255+1);
double measured_seconds = ticks / divider;
double error_s = elapsed * (actual_hz/32768.0 - 1);`,o=>[f(1,'教学默认异步分频 127、同步分频 255，总分频 32768。',{分频:32768}),f(3,'按理想恒定时钟偏差估算累计误差，不模拟温漂、校准与备份域失电。',{运行秒:o.b,误差秒:o.b*(o.a/32768-1)})]);
  add('flash','擦除与编程方向',[N('a','待写字节',0,255,0x5a),N('b','先擦除 0/1',0,1,1)],`uint8_t old = erase ? 0xff : 0x00;
uint8_t stored = old & requested; // ideal 1 -> 0 programming
bool ok = stored == requested;
// real device erase granularity, alignment, voltage and endurance differ`,o=>{const old=o.b?255:0,stored=old&o.a;return[f(1,'Flash 编程通常只能把 1 写成 0，擦除才能把存储单元恢复到 1。',{原值:old}),f(2,'按位与只是位方向的理想模型，不等于真实编程命令。',{写入:stored},bits(stored)),f(3,'先校验结果；不能只看写 API 调用是否返回。',{校验:stored===o.a})];});
  add('pid','限幅 PI 与抗饱和',[N('a','目标值',0,100,80),N('b','启用条件积分 0/1',0,1,1)],`error = target - plant;
candidate = integral + 0.1f*error;
raw = 2.0f*error + candidate;
output = clamp(raw, 0, 100);
if (!antiwindup || raw == output || error*(raw-output)<0) integral=candidate;
plant += 0.08f*(output-plant);`,o=>{let y=0,integ=0,out=[],series=[];for(let k=0;k<40;k++){const e=o.a-y,c=integ+.1*e,raw=2*e+c,u=Math.max(0,Math.min(100,raw));if(!o.b||raw===u||e*(raw-u)<0)integ=c;y+=.08*(u-y);series.push({x:k,y});out.push(f(5,'离散 PI 和一阶对象均为教学模型；本种菜机原控制器使用滞回与限时，不是 PID。',{k,输出:+u.toFixed(2),积分:+integ.toFixed(2),对象:+y.toFixed(2)},[],[...series],{out_led:u}));}return out;});
  add('motor','电机电气与机械状态',[N('a','外加电压 V',0,24,12),N('b','负载转矩 Nm',0,1,.1,.01)],`di = (voltage - R*i - Ke*omega)/L;
domega = (Kt*i - load - B*omega)/J;
i += dt*di; omega += dt*domega;
// DC equivalent; not a full PMSM/FOC inverter model`,o=>{let i=0,w=0,out=[],series=[];for(let k=0;k<40;k++){const di=(o.a-2*i-.1*w)/.02,dw=(.1*i-o.b-.01*w)/.02;i+=.001*di;w+=.001*dw;series.push({x:k,y:w});out.push(f(3,'直流等效模型展示电阻、电感、反电动势、惯量和负载之间的关系；FOC 各坐标变换见本专题笔记。',{t_ms:k+1,电流_A:+i.toFixed(3),角速度:+w.toFixed(3)},[],[...series]));}return out;});
  add('power','理想 Buck / Boost 与占空比',[N('a','输入电压 V',1,48,12),N('b','占空比 D',0,.9,.5,.01)],`double buck = input * duty;
double boost = input / (1-duty);
// ideal steady CCM; not switching transient or a component sizing result`,o=>[f(1,'理想连续导通稳态下，Buck 由电感伏秒平衡得到此比例。',{Buck输出_V:o.a*o.b}),f(2,'Boost 的关系在 D 接近 1 时不能理解为真实输出可无限增大。',{Boost输出_V:o.a/(1-o.b)}),f(3,'损耗、纹波、负载、磁饱和和器件额定值需要额外模型与实测。',{假设:'理想稳态 CCM'})]);
  add('pll','相位误差与锁定过程',[N('a','输入相位阶跃 rad',-3.14,3.14,1,.01),N('b','示例比例系数',.01,1,.2,.01)],`error = wrap_to_pi(input_phase - estimate);
estimate += gain * error;
// conceptual phase-error convergence, not a complete SOGI-PLL`,o=>{let p=0,series=[],out=[];for(let k=0;k<20;k++){let e=o.a-p;e=Math.atan2(Math.sin(e),Math.cos(e));p+=o.b*e;series.push({x:k,y:p});out.push(f(2,'本算例只展示负反馈减小相位差。完整 PLL 还包含鉴相、滤波、频率积分及动态约束。',{k,相位:+p.toFixed(4),误差:+e.toFixed(4)},[],[...series]));}return out;});
  add('linux','阻塞、就绪与读取循环',[N('a','到达字节数',0,32,8),N('b','每次读取上限',1,16,3)],`while ((n = read(fd, buf, limit)) > 0) consume(buf,n);
if (n < 0 && errno == EAGAIN) return_to_epoll();
// handle EINTR, EOF and errors separately`,o=>{let left=o.a,out=[];while(left>0){const read=Math.min(o.b,left);left-=read;out.push(f(1,'ET 模式需要按非阻塞语义读到 EAGAIN；本模型不运行 Linux 内核。',{读取:read,剩余:left}));}out.push(f(2,'目前没有更多数据，回到事件等待；不能在空缓冲上忙等。',{结果:'EAGAIN'}));return out;});
  add('linker','装载地址与运行地址',[N('a','初始化数据字节数',4,64,16),N('b','BSS 字节数',4,64,16)],`copy(FLASH_data_image, RAM_data, data_size);
zero(RAM_bss, bss_size);
call_static_initializers_if_required();
main();`,o=>[f(1,'典型裸机启动：有初值的可写数据保存镜像于 Flash，运行时搬到 RAM。',{data拷贝字节:o.a}),f(2,'BSS 通常只记录所需大小，启动代码清零。实际规则由链接脚本与启动文件确定。',{bss清零字节:o.b}),f(4,'之后进入应用入口；自动变量、静态对象和动态对象的生命周期不能只按地址猜测。',{RAM静态占用:o.a+o.b})]);
  // Reuse explicit peripheral models. They provide actual project source anchors.
  add('clock','PLL 与总线分频',[N('input','输入时钟 MHz',4,26,16),N('m','PLLM',2,63,16),N('n','PLLN',50,432,336),N('p','PLLP',2,8,2,2)],`double vco_in = input_mhz / m;
double vco = vco_in * n;
double sysclk = vco / p;
double apb1 = sysclk / 4;
double tim4 = apb1 * 2;`,o=>[f(1,'先计算 PLL 输入；合法频率范围仍需查目标芯片手册。',{VCO输入_MHz:o.input/o.m}),f(2,'倍频形成 VCO，超出手册限制的组合不能用于真实配置。',{VCO_MHz:o.input/o.m*o.n}),f(3,'本项目默认 16/16×336/2 = 168 MHz。',{SYSCLK_MHz:o.input/o.m*o.n/o.p,超出168:o.input/o.m*o.n/o.p>168}),f(5,'本例固定 APB1 四分频，定时器输入再乘二。',{APB1_MHz:o.input/o.m*o.n/o.p/4,TIM4_MHz:o.input/o.m*o.n/o.p/2})]);
  const aliases={gpio:'gpio',input:'gpio',irq:'irq',pwm:'pwm',uart:'uart',i2c:'i2c',dht:'dht',dma:'dma',queue:'queue',watchdog:'watchdog'};
  for(const [key,target] of Object.entries(aliases)){const module=window.BoardModels.modules[target];models[key]={title:module.title,controls:module.controls,sourceModel:true,run:o=>module.make(o)};}
  models.input.controls=models.input.controls.map(c=>c.key==='mode'?{...c,value:'input'}:c);
  models.uart.controls=[...models.uart.controls,N('baud','教学波特率',1200,921600,115200),N('bytes','整帧字节数',1,512,74)];
  const uartRun=models.uart.run;models.uart.run=o=>uartRun(o).map(f=>({...f,values:{...f.values,位时间:(1e6/o.baud).toFixed(3)+' μs',整帧理论时间:(o.bytes*10/o.baud*1000).toFixed(3)+' ms',格式:o.baud+' / 8N1'},caption:f.caption+' 原项目固定 115200；这里的波特率参数只改变教学时间计算。'}));
  window.LearningModels={models,crc};
})();
