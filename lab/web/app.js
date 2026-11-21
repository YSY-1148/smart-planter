'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model=null, lessons=[], sources={}, running=false, busy=false, loopTimer=null, replayTimer=null;
let replayIndex=-1, renderedState=null, activeFile='', activeLine=0, lastDisplayed={}, localEdit=false;
let actionQueue=Promise.resolve();
let renderedLessonId='';
let runEpoch=0;
const pins=['out_led','out_fan','out_drip','out_mist','out_refill'];
const outputNames=['补光灯','风扇','滴灌泵','喷雾泵','补液泵'];
const units={temp:'°C',rh:'%',lux:'lx'};
const configFields=[['temp_on10','风扇开启 °C',10,45,10],['temp_off10','风扇关闭 °C',5,44,10],['rh_on10','补水开启 %',20,80,10],['rh_off10','补水停止 %',25,90,10],['lux_target','目标光照 lx',100,50000,1],['germ_threshold10','喷雾发芽率 %',0,100,10]];

function formatTime(ms){const total=ms/1000;return `${String(Math.floor(total/60)).padStart(2,'0')}:${(total%60).toFixed(1).padStart(4,'0')}`;}
function showError(error){$('error').textContent=String(error.message||error);$('error').hidden=false;}
function pause(){running=false;runEpoch++;clearTimeout(loopTimer);$('run').textContent='▶ 连续运行';$('run-state').textContent='已暂停 · 输入可修改';}
function stopReplay(){clearInterval(replayTimer);replayTimer=null;$('replay').textContent='▶ 回放执行';}

function action(payload,options={}){
  const pending=actionQueue.then(()=>performAction(payload,options));
  actionQueue=pending.catch(()=>{});return pending;
}
async function performAction(payload,{replay=false}={}){
  busy=true;$('error').hidden=true;
  try{
    const response=await (window.LabAPI?.request||fetch)('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'控制核心响应异常');
    model=data;stopReplay();replayIndex=-1;render();
    if(replay)startReplay();
    return true;
  }catch(error){pause();stopReplay();showError(error);return false;}
  finally{busy=false;}
}

function lesson(){return lessons.find(x=>x.id===model.lesson);}
function anchorLine(file,needle){const lines=sources[file].split('\n');const found=lines.findIndex(x=>x.includes(needle));return found<0?1:found+1;}
function showSource(file,line=1,scroll=true){
  if(!sources[file])return;
  if(activeFile!==file){
    activeFile=file;$('source-file').value=file;
    $('code').innerHTML=sources[file].split('\n').map((text,i)=>`<div class="code-row" data-line="${i+1}"><span class="line-number">${i+1}</span><code class="code-text">${escapeHTML(text)}</code></div>`).join('');
  }
  $('code').querySelector('.active')?.classList.remove('active');
  $('code').querySelectorAll('.current-block').forEach(x=>x.classList.remove('current-block'));
  const sourceLines=sources[file].split('\n');let functionStart=0,functionName='';
  for(let i=0;i<line;i++){const match=sourceLines[i]?.match(/^(?:static\s+)?(?:void|bool|int|uint32_t)\s+(\w+)\s*\([^;]*\)\s*\{/);if(match){functionStart=i;functionName=match[1];}}
  let balance=0;
  if(functionName)for(let i=functionStart;i<sourceLines.length;i++){
    balance+=(sourceLines[i].match(/\{/g)||[]).length-(sourceLines[i].match(/\}/g)||[]).length;
    $('code').querySelector(`[data-line="${i+1}"]`)?.classList.add('current-block');if(balance===0)break;
  }
  const row=$('code').querySelector(`[data-line="${line}"]`);if(row)row.classList.add('active');
  $('source-position').textContent=`L${line}${functionName?' · '+functionName+'()':''}`;activeLine=line;
  if(scroll&&row){const container=$('code');container.scrollTop=Math.max(0,row.offsetTop-container.offsetTop-container.clientHeight*.36);}
}

function explainLine(point,previous){
  $('component-lab').hidden=true;
  const raw=(sources[point.file]||'').split('\n')[point.line-1]||''; const s=point.state;
  let text='这一行已经由 C 程序执行。比较变量快照，观察状态如何变化。';
  let phase='真实 C 观察点 · 语句执行后';
  if(point.kind==='gpio_model'){phase='外设教学模型 · 提交输出';text='planter_step 已完成。原固件接下来调用 board_outputs，把计算结果写入 GPIO / PWM；现在动画才更新引脚与执行器。';}
  else if(raw.includes('sample=*s'))text='把新传感器样本复制进 Planter。这里是结构体值复制，不是保存局部变量的地址。';
  else if(raw.includes('bool fresh='))text=`检查样本是否存在且足够新。本次样本年龄为 ${((s.now-s.sample_at)>>>0)} ms；原程序允许最多 6500 ms。`;
  else if(raw.includes('bool dht='))text='同时检查采样新鲜度与 SENSOR_DHT 有效位；有一个温度数字不代表它可以参与控制。';
  else if(raw.includes('bool light='))text='检查光照采样的新鲜度和有效位。光照失效时，自动补光输出会关闭。';
  else if(raw.includes('bool germ='))text='检查发芽率是否已知且未超过 30 分钟。未知结果会参与后面的保守模式选择。';
  else if(raw.includes('temp10>=p->temp_on10'))text=`温度 ${(s.sample_temp10/10).toFixed(1)}°C 达到开启阈值 ${(s.temp_on10/10).toFixed(1)}°C，fan_demand 被置为 true。此刻还没有写引脚。`;
  else if(raw.includes('temp10<=p->temp_off10'))text=`温度低于或等于关闭阈值 ${(s.temp_off10/10).toFixed(1)}°C，fan_demand 被清为 false。`;
  else if(raw.includes('humidity10<=p->rh_on10'))text='湿度达到补水开启条件，保存 humidity_demand=true；稍后才选择滴灌或喷雾。';
  else if(raw.includes('humidity10>=p->rh_off10'))text='湿度达到停止条件，清除补水需求。';
  else if(raw.includes('else { p->fan_demand=false'))text='温湿度样本不可靠，自动控制清除风扇和补水需求。';
  else if(raw.includes('Outputs desired=')){text='建立本轮期望输出。若温度落在两个阈值之间，前面的两个赋值分支都不会执行，fan_demand 保持上轮值。';}
  else if(raw.includes('desired.fan='))text=`把保存的风扇需求 ${Boolean(s.fan_demand)} 放入本轮期望输出。保持状态也是控制行为。`;
  else if(raw.includes('desired.led=(uint8_t)'))text='只对新样本调整亮度，并把占空比限制在 0–100%。局部变量计算完后才写入最终输出。';
  else if(raw.includes('desired.drip=p->humidity_demand'))text='组合“需要补水”和“发芽率未知或较低”，生成滴灌请求。';
  else if(raw.includes('desired.mist=p->humidity_demand'))text='组合“需要补水”和“发芽率有效且达到阈值”，生成喷雾请求。';
  else if(raw.includes('p->water_seen=true'))text='记录液位原始值改变的时刻，重新开始 300 ms 稳定性检查。';
  else if(raw.includes('p->water_stable=true'))text='液位信号持续稳定达到 300 ms，允许后续保护逻辑使用它。';
  else if(raw.includes('bool can_water='))text='灌溉必须同时满足：液位输入有效、信号稳定、并且没有缺液。';
  else if(raw.includes('bool can_refill='))text='补液必须同时满足：输入有效、信号稳定、缺液、并且没有锁存补液故障。';
  else if(raw.includes('p->refill_fault=true'))text='补液超时且液位仍未恢复，锁存故障。本轮后续保护会关闭补液输出。';
  else if(raw.includes('desired.refill=desired.refill'))text='用补液许可和故障状态约束期望输出。';
  else if(raw.includes('desired.drip=desired.drip'))text='加入液位保护，并确保补液与滴灌互斥。';
  else if(raw.includes('desired.mist=desired.mist'))text='继续施加互斥：喷雾不能与补液、滴灌同时运行。';
  else if(raw.includes('p->out=desired'))text='先保存经过条件约束的输出；接下来泵状态机还要检查最长运行与冷却时间，因此此刻仍不更新引脚。';
  else if(raw.includes('p->on=false'))text='泵请求撤销或已到最长运行时间，记录停止时刻并进入休息状态。';
  else if(raw.includes('p->on=true'))text='请求有效且冷却条件满足，泵状态进入运行，并记录 started。';
  else if(raw.includes('pump_step(&p->'))text='把泵状态机的返回值写回最终输出；请求为真不一定意味着泵允许启动。';
  else if(raw.includes('return ACK_'))text='命令在这里返回一个结果码。错误、过期或重复命令不应重新执行控制动作。';
  else if(raw.includes('p->manual=true'))text='进入限时手动模式，记录开始时间与租期；保护条件仍会在 planter_step 中执行。';
  else if(raw.includes('p->manual=false'))text='手动租期结束或收到自动模式命令，恢复自动规则。';
  else if(raw.includes('p->last_command='))text='命令校验和处理成功后，记录最后接受的序号，为后续去重提供依据。';
  $('trace-phase').textContent=phase;$('line-explanation').textContent=text;
  $('trace-kind').textContent=point.kind==='gpio_model'?'引脚提交模型':'原 C 语句观察';
  const changed=previous?Object.keys(s).filter(k=>s[k]!==previous[k]&&k!=='now'):[];
  $('changed-values').innerHTML=changed.slice(0,7).map(k=>`<span>${escapeHTML(k)}: ${previous[k]} → ${s[k]}</span>`).join('');
}

function displayTrace(index){
  if(!model.trace.length)return;
  replayIndex=Math.min(index,model.trace.length-1);
  const point=model.trace[replayIndex];const previous=replayIndex>0?model.trace[replayIndex-1].state:null;
  renderState(point.state,point.pins||model.state,point.elapsed??model.elapsed,point.inputs||model.inputs);showSource(point.file,point.line);explainLine(point,previous);
  $('trace-position').textContent=`${replayIndex+1} / ${model.trace.length}`;
  $('run-state').textContent=`回放 t=${formatTime(point.elapsed??model.elapsed)} 的关键语句`;
  if(replayIndex===model.trace.length-1){stopReplay();$('run-state').textContent='本轮执行结束 · 引脚输出已提交';}
}
function startReplay(){pause();stopReplay();if(!model?.trace.length)return;displayTrace(0);if(model.trace.length>1){replayTimer=setInterval(()=>displayTrace(replayIndex+1),850);$('replay').textContent='Ⅱ 暂停回放';}}

function renderState(s,physical=s,elapsed=model.elapsed,inputs=model.inputs){
  renderedState=s;
  $('mode').textContent=s.manual?'限时手动':'自动控制';$('mode').className='badge '+(s.manual?'amber':'green');
  $('clock').innerHTML=`${formatTime(elapsed)} <small>模拟时间</small>`;
  $('svg-temp').textContent=`${inputs.temp.toFixed(1)}°C / ${inputs.rh.toFixed(0)}%`;
  $('svg-lux').textContent=`${Math.round(inputs.lux)} lx`;
  $('svg-fan').textContent=physical.out_fan?'运行中 · HIGH':'关闭 · LOW';
  $('svg-water').textContent=`${s.water_stable?'稳定':'等待稳定'} · ${s.water_raw?'缺液':'有液'}`;
  $('svg-pwm').textContent=`补光 / TIM4_CH1 · PWM ${physical.out_led}%`;
  $('lamp-glow').setAttribute('opacity',String(physical.out_led/100));
  $('lamp-strip').setAttribute('fill',physical.out_led?'#efd16c':'#b8c5b9');
  $('fan-blades').classList.toggle('on',!!physical.out_fan);
  for(const name of ['drip','mist','refill']){
    document.querySelector(`.${name}-flow`).classList.toggle('on',!!physical[`out_${name}`]);
    $(`${name}-pump`).setAttribute('fill',physical[`out_${name}`]?'#60a76c':'#9eafa5');
  }
  $('drips').classList.toggle('on',!!physical.out_drip);$('mist').classList.toggle('on',!!physical.out_mist);
  $('tank-label').textContent=s.water_raw?'液位低':'液位足';
  $('tank-water').setAttribute('d',s.water_raw?'M279 346Q310 342 341 346T397 346V350Q397 355 391 355H285Q279 355 279 350Z':'M279 322Q310 317 341 322T397 322V350Q397 355 391 355H285Q279 355 279 350Z');
  for(const name of ['fan','drip','mist','refill','led'])document.querySelector(`[data-pin="${name}"]`).classList.toggle('on',!!physical[`out_${name}`]);
  $('outputs').innerHTML=pins.map((key,i)=>`<div class="output ${physical[key]?'on':''}">${outputNames[i]}<b>${i===0?physical[key]+'%':physical[key]?'ON':'OFF'}</b></div>`).join('');
  $('sample-value').textContent=`${(s.sample_temp10/10).toFixed(1)}°C · #${s.sample_counter}`;
  $('demand-value').textContent=s.fan_demand?'true':'false';$('pin-value').textContent=physical.out_fan?'PD12 HIGH':'PD12 LOW';
  $('wifi-state').textContent=inputs.network?'Wi-Fi 模型在线':'Wi-Fi 模型离线';$('cloud-state').textContent=inputs.network?'链路示意':'本地控制继续';
  $('timeline').innerHTML=`控制周期 100 ms · 环境采样 2000 ms <div class="timeline-track"><i style="left:${(elapsed%2000)/2000*95}%"></i></div><span>now = ${s.now} ms / 0x${s.now.toString(16).toUpperCase().padStart(8,'0')} · 任务时间关系模型</span>`;
  renderVariables(s);
}

function renderVariables(s){
  const filter=$('variable-filter').value.toLowerCase();
  $('variable-table').innerHTML=Object.entries(s).filter(([key])=>key.includes(filter)).map(([key,value])=>`<div class="variable ${lastDisplayed[key]!==undefined&&lastDisplayed[key]!==value?'flash':''}"><span>${key}</span><b>${value}</b></div>`).join('');
  lastDisplayed={...s};
}

function render(){
  const l=lesson();renderState(model.state);
  $('lesson-title').textContent=l.title;$('lesson-subtitle').textContent=l.subtitle;
  document.querySelectorAll('#lesson-nav button').forEach(x=>x.classList.toggle('active',x.dataset.lesson===l.id));
  $('concept').textContent=l.concept;
  if(renderedLessonId!==l.id){
    $('questions').innerHTML=l.questions.map((q,i)=>`<details ${i===0?'open':''}><summary><span class="question-tag">${escapeHTML(q[0])}</span>${escapeHTML(q[1])}</summary><p>${escapeHTML(q[2])}</p></details>`).join('');
    renderedLessonId=l.id;
  }
  $('steps').innerHTML=l.steps.map((step,i)=>`<div class="step ${i<model.step_index?'done':i===model.step_index?'current':''}"><i>${i<model.step_index?'✓':i+1}</i><span>${escapeHTML(step[0])}</span></div>`).join('');
  const complete=model.step_index>=l.steps.length;
  $('experiment-next').textContent=complete?'本课场景已完成 ✓':`运行第 ${model.step_index+1} 步 →`;
  $('experiment-next').disabled=complete;
  $('step-help').textContent=complete?'可以重置本课再做预测，或选择下一课。':l.steps[model.step_index][0];
  $('trace-position').textContent=`${model.trace.length} 个观察点`;
  $('events').innerHTML=[...model.events].reverse().map(x=>`<div class="event"><time>${formatTime(x.at)}</time><span>${escapeHTML(x.text)}</span></div>`).join('');
  $('event-count').textContent=model.events.length;
  for(const key of ['temp','rh','lux']){
    if(document.activeElement!==$(`${key}-range`))$(`${key}-range`).value=model.inputs[key];
    if(document.activeElement!==$(`${key}-number`))$(`${key}-number`).value=key==='lux'?Math.round(model.inputs[key]):Number(model.inputs[key].toFixed(1));
  }
  document.querySelectorAll('[data-input]').forEach(x=>x.checked=!!model.inputs[x.dataset.input]);
  if(!localEdit)for(const [key,,,,scale] of configFields)$(`cfg-${key}`).value=model.state[key]/scale;
  if(model.command)$('ack').textContent=`指令 #${model.command.seq} · ACK ${model.command.code} · ${model.command.text}`;
  else $('ack').textContent='尚未发送命令';
  renderPacket();
}

function renderPacket(){
  if(!model)return;
  const data=$('command-frame').checked&&model.command?model.command.frame:model.frame;
  $('hex').innerHTML=data.map((byte,i)=>`<span class="${i<4?'header':i<8?'seq':i>=72?'crc':''}"><small>${i}</small>${byte.toString(16).toUpperCase().padStart(2,'0')}</span>`).join('');
  const [planter,sample,message,type,seq,values]=model.layout;
  $('layout').textContent=`当前宿主编译结果：sizeof(Planter)=${planter}，sizeof(SensorSample)=${sample}，sizeof(Message)=${message}；Message 字段偏移 type=${type} / seq=${seq} / v=${values}。线上帧是显式编码的 74 字节，不等于结构体内存布局。CRC-16/CCITT-FALSE。`;
}

async function selectLesson(id){
  pause();stopReplay();localEdit=false;
  if(await action({action:'lesson',id})){
    const l=lesson();showSource(l.file,anchorLine(l.file,l.anchor));
    $('trace-phase').textContent='本课入口 · 先读条件，再预测结果';$('line-explanation').textContent=l.concept;$('changed-values').innerHTML='';
    $('trace-kind').textContent='源代码定位';
  }
}

async function runLoop(epoch){
  if(!running||epoch!==runEpoch)return;
  const follow=$('follow-running-code').checked;
  // Slow playback condenses unchanged cycles, preserving native state changes.
  await action({action:'advance',ms:follow?2000:200*Number($('speed').value)});
  if(!running||epoch!==runEpoch)return;
  if(follow){
    for(let i=0;i<model.trace.length;i++){
      if(!running||epoch!==runEpoch)return;
      displayTrace(i);
      $('run-state').textContent='代码与动画同步慢放 · '+$('trace-position').textContent;
      await new Promise(resolve=>setTimeout(resolve,Math.max(12,120/Number($('speed').value))));
    }
  }
  if(running&&epoch===runEpoch)loopTimer=setTimeout(()=>runLoop(epoch),follow?40:200);
}

function componentJump(name){
  pause();stopReplay();
  const map={lamp:['stm32/src/board.c','void board_outputs','PWM 的 CCR 写入位于 board_outputs。当前模型展示计算的占空比，不生成真实引脚电压波形。'],
    dht:['stm32/src/board.c','static bool dht_read','实际硬件读取 DHT11 的脉冲时序；实验中用输入参数代替电气采样，再交给相同控制逻辑。'],
    light:['stm32/src/board.c','static bool bh_read','BH1750 通过 I²C 获取光照。这里是 I²C 数字传感器，不是 ADC 模拟输入。'],
    fan:['common/planter.c','if (p->sample.temp10>=p->temp_on10)','风扇需求通过两个温度阈值更新，最后由 board_outputs 提交到 PD12。'],
    water:['common/planter.c','bool can_water=','液位保护先于水泵输出。PB1 当前只有高低输入，断线诊断需要额外硬件。'],
    pump:['common/planter.c','static bool pump_step','每次调用检查请求、运行时长与冷却时间，不使用阻塞延时。'],
    vision:['common/planter.c','case OP_GERMINATION','上位机识别结果经命令输入。此实验不运行视觉推理，可在参数面板注入发芽率。'],
    mcu:['stm32/src/app.c','void app_start','原工程创建 3 个任务：control 优先级 4、sensor 优先级 3、comm 优先级 2。这里只模拟周期关系，不运行真实 RTOS 调度器。'],
    esp:['esp32/src/main.cpp','static void UartTask','ESP32 的串口任务与网络连接分开处理。网络图标仅为教学状态，本实验不连接外部设备。'],
    cloud:['esp32/src/main.cpp','void loop','网络服务负责上报与命令转发。STM32 本地控制独立工作；当前工程不会补传完整离线历史。']};
  const [file,needle,text]=map[name];showSource(file,anchorLine(file,needle));$('trace-phase').textContent='器件 → 对应程序';$('line-explanation').textContent=text;$('trace-kind').textContent='代码阅读';$('changed-values').innerHTML='';
  const chip={lamp:'pwm',dht:'dht',light:'i2c',mcu:'structure',esp:'uart',water:'gpio'}[name];
  $('component-lab').hidden=!chip;if(chip)$('component-lab').dataset.chip=chip;
}

function renderBank(){
  const query=$('bank-filter').value.trim().toLowerCase();
  const questions=window.LAB_QUESTIONS.filter(q=>!query||q.title.toLowerCase().includes(query)||String(q.id)===query);
  const groups=[...new Set(questions.map(q=>q.group))];
  let reviewed={};try{reviewed=JSON.parse(localStorage.getItem('planter-reviewed')||'{}');}catch{}
  $('bank-results').innerHTML=groups.map((group,i)=>`<details class="bank-group" ${query||i<2?'open':''}><summary>${escapeHTML(group)} · ${questions.filter(q=>q.group===group).length} 题</summary>${questions.filter(q=>q.group===group).map(q=>`<div class="bank-row"><span class="q-id">${q.id}</span><div><label><input class="reviewed" type="checkbox" data-reviewed="${q.id}" ${reviewed[q.id]?'checked':''} aria-label="标记第 ${q.id} 题已复习">${escapeHTML(q.title)}</label><small>${q.kind}</small>${q.source?`<a href="${q.source}" target="_blank" rel="noopener noreferrer">原帖</a>`:''}</div><div class="bank-links">${q.lesson?`<button data-related="${q.lesson}">关联课程 →</button>`:''}${q.chip?`<button data-chip-related="${q.chip}">相关原理 →</button>`:''}${!q.lesson&&!q.chip?'<span class="next-topic">后续专题</span>':''}</div></div>`).join('')}</details>`).join('');
  if(!questions.length)$('bank-results').textContent='没有匹配的题目。';
  if(window.CurriculumLab)for(const row of $('bank-results').querySelectorAll('.bank-row')){const q=Number(row.querySelector('.q-id').textContent),topic=window.CurriculumLab.courses.find(c=>c.questions.includes(q));if(topic){const b=document.createElement('button');b.dataset.topicRelated=topic.id;b.textContent='专题详解 →';row.querySelector('.bank-links').prepend(b);}}
}

function setupControls(){
  $('lesson-nav').innerHTML=lessons.map(x=>`<button data-lesson="${x.id}">${escapeHTML(x.title)}<small>${escapeHTML(x.subtitle)}</small></button>`).join('');
  $('lesson-nav').addEventListener('click',event=>{const button=event.target.closest('[data-lesson]');if(button)selectLesson(button.dataset.lesson);});
  $('source-file').innerHTML=Object.keys(sources).map(file=>`<option>${file}</option>`).join('');
  $('source-file').onchange=()=>{pause();stopReplay();showSource($('source-file').value,1);};
  $('sliders').innerHTML=[['temp','环境温度',-20,60,.1],['rh','空气湿度',0,100,1],['lux','环境光照',0,60000,100]].map(([key,name,min,max,step])=>`<label><span class="slider-label">${name}<span><input id="${key}-number" aria-label="${name}数值" type="number" min="${min}" max="${max}" step="${step}"><b> ${units[key]}</b></span></span><input id="${key}-range" aria-label="${name}滑杆" type="range" min="${min}" max="${max}" step="${step}"><span class="range-ends"><span>${min}</span><span>${max} ${units[key]}</span></span></label>`).join('');
  for(const key of ['temp','rh','lux']){
    $(`${key}-range`).oninput=()=>{$(`${key}-number`).value=$(`${key}-range`).value;};
    const update=async element=>{pause();stopReplay();await action({action:'inputs',values:{[key]:Number(element.value)}});};
    $(`${key}-range`).onchange=()=>update($(`${key}-range`));$(`${key}-number`).onchange=()=>update($(`${key}-number`));
  }
  $('toggles').innerHTML=[['low','液位低'],['dht','DHT11 有效'],['light','BH1750 有效'],['water_valid','液位有效（注入）'],['sampling','持续采样'],['network','网络在线（模型）'],['physics','环境联动（模型）']].map(([key,label])=>`<label><input type="checkbox" data-input="${key}">${label}</label>`).join('');
  $('toggles').onchange=event=>{pause();stopReplay();action({action:'inputs',values:{[event.target.dataset.input]:event.target.checked}});};
  $('config-fields').innerHTML=configFields.map(([key,label,min,max,scale])=>`<label>${label}<input id="cfg-${key}" type="number" required min="${min}" max="${max}" step="${scale===10?.1:1}"></label>`).join('');
  $('config-form').oninput=()=>localEdit=true;
  $('config-form').onsubmit=async event=>{event.preventDefault();pause();const args=configFields.map(([key,,,,scale])=>Math.round(Number($(`cfg-${key}`).value)*scale));localEdit=false;await action({action:'command',op:1,args},{replay:true});};
  $('manual-form').onsubmit=event=>{event.preventDefault();pause();const f=new FormData(event.target);action({action:'command',op:2,args:[Number(f.get('led')),...['fan','drip','mist','refill'].map(x=>f.has(x)?1:0),Number(f.get('seconds'))*1000]},{replay:true});};
  $('germ-form').onsubmit=event=>{event.preventDefault();pause();action({action:'command',op:4,args:[Math.round(Number(new FormData(event.target).get('germ'))*10)]},{replay:true});};
  $('auto-mode').onclick=()=>{pause();action({action:'command',op:3},{replay:true});};
  $('clear-fault').onclick=()=>{pause();action({action:'command',op:5},{replay:true});};
  $('experiment-next').onclick=()=>{pause();action({action:'experiment'},{replay:true});};
  $('reset').onclick=async()=>{pause();stopReplay();localEdit=false;await action({action:'reset'});const l=lesson();showSource(l.file,anchorLine(l.file,l.anchor));$('line-explanation').textContent=l.concept;$('changed-values').innerHTML='';};
  $('tick').onclick=()=>{pause();action({action:'advance',ms:100},{replay:true});};
  $('two-seconds').onclick=()=>{pause();action({action:'advance',ms:2000},{replay:true});};
  $('run').onclick=()=>{if(running)pause();else{stopReplay();replayIndex=-1;running=true;const epoch=++runEpoch;$('run').textContent='Ⅱ 暂停运行';$('run-state').textContent='连续运行 · 原 C 控制核心';runLoop(epoch);}};
  $('follow-running-code').onchange=()=>{pause();stopReplay();};
  $('replay').onclick=()=>replayTimer?stopReplay():startReplay();
  $('next-line').onclick=()=>{pause();stopReplay();displayTrace(replayIndex>=model.trace.length-1?0:replayIndex+1);};
  $('variable-filter').oninput=()=>renderVariables(renderedState||model.state);
  $('command-frame').onchange=renderPacket;
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(other=>{other.setAttribute('aria-selected',String(other===button));$(other.dataset.tab).hidden=other!==button;});});
  document.querySelectorAll('[data-component]').forEach(element=>{element.onclick=()=>componentJump(element.dataset.component);element.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();componentJump(element.dataset.component);}};});
  $('scope-btn').onclick=()=>$('scope').showModal();$('close-scope').onclick=()=>$('scope').close();
  const openBank=()=>{pause();stopReplay();renderBank();$('question-bank').showModal();};
  $('bank-btn').onclick=openBank;$('bank-open').onclick=openBank;$('close-bank').onclick=()=>$('question-bank').close();
  $('bank-filter').oninput=renderBank;
  $('bank-results').onclick=event=>{const button=event.target.closest('[data-related]'),chip=event.target.closest('[data-chip-related]'),topic=event.target.closest('[data-topic-related]');if(topic){$('question-bank').close();window.CurriculumLab.open(Number(topic.dataset.topicRelated));}else if(button){$('question-bank').close();selectLesson(button.dataset.related);}else if(chip){$('question-bank').close();window.CircuitBench.fromModule(chip.dataset.chipRelated);}};
  $('bank-results').onchange=event=>{const id=event.target.dataset.reviewed;if(!id)return;try{const value=JSON.parse(localStorage.getItem('planter-reviewed')||'{}');value[id]=event.target.checked;localStorage.setItem('planter-reviewed',JSON.stringify(value));}catch{showError('浏览器不允许保存复习标记；仿真仍可正常使用。');}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();stopReplay();}});
}

async function init(){
  try{
    const response=await (window.LabAPI?.request||fetch)('/api/init');if(!response.ok)throw new Error('无法加载 C 控制核心，请刷新页面重试');
    const data=await response.json();lessons=data.lessons;sources=data.sources;model=data;
    setupControls();const labContext={sources,getState:()=>model,pause:()=>{pause();stopReplay();},control:async payload=>{const ok=await action(payload);if(!ok)throw Error('原 C 控制核心未响应');return model;},selectLesson};window.BoardLab.init(labContext);window.CircuitBench.init(labContext);window.CurriculumLab?.init(labContext);render();const l=lesson();showSource(l.file,anchorLine(l.file,l.anchor));
    $('connection').textContent=window.LabAPI?.browser?'● 原 C 控制核心 · 浏览器运行':'● 原 C 控制核心已连接';$('connection').className='badge green';
  }catch(error){showError(error);$('connection').textContent='控制核心未连接';}
}
init();
