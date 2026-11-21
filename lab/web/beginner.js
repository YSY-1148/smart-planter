/* Progressive beginner UI; these small models never mutate the native workbench. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lessons=window.BeginnerLessons,KEY='qinghe-beginner-v1';
 const phases=['看懂意思','动手试试','读几行代码','自己说一遍'];
 let saved={lessons:{}},current=0,phase=0,active=false,openDeep=null;
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.lessons&&typeof raw.lessons==='object'&&!Array.isArray(raw.lessons))saved=raw;}catch{}
 const entry=()=>saved.lessons[lessons[current].id]||(saved.lessons[lessons[current].id]={});
 const defaults={cause:{temp:25},c:{temp:25},output:{signal:1,wire:true,power:true},input:{level:'normal',wire:true},clock:{psc:83},pwm:{duty:25},adc:{mv:1650},pulse:{width:45,checksum:true},irq:{enabled:true},tasks:{temp:30},queue:{command:1},chain:{low:false}};
 function initial(kind){return {params:{...defaults[kind]},step:0,fan:0,temp:null,queue:[],pending:false,handled:0,time:0,sample:25,demand:null,out:null,pin:null,message:'还没有运行。先设置条件，再点击下方操作。',result:null};}
 function act(kind,s,action='run'){
  const p=s.params;
  if(kind==='cause'){s.fan=Number(p.temp>=28);s.result={输入温度:p.temp+' °C',比较:'温度 ≥ 28',输出意图:s.fan?'开':'关'};}
  if(kind==='c'){
   if(s.step>=3){s.step=0;s.temp=null;s.fan=0;}
   s.step++;
   if(s.step===1)s.temp=Number(p.temp);
   if(s.step===2)s.fan=0;
   if(s.step===3)s.fan=Number(s.temp>=28);
   s.result={已执行:s.step+' / 3 句',temperature:s.temp,fan:s.step<2?'尚未声明':s.fan};
   s.message=['','已把输入值存进 temperature。','已初始化 fan=0，还没有比较。','已比较保存的 temperature，并把结果存进 fan。'][s.step];
  }
  if(kind==='output'){s.fan=Number(p.signal&&p.wire&&p.power);s.result={PD12:p.signal?'高电平':'低电平',信号线:p.wire?'连接':'断开',负载电源:p.power?'有电':'断开',风扇:s.fan?'转动':'停止'};}
  if(kind==='input'){s.high=!p.wire||p.level==='low';s.result={物理条件:!p.wire?'信号线断开':p.level==='low'?'开关释放':'开关拉低',PB1:s.high?'高电平':'低电平',board_water_low:s.high?'true：解释为低液位':'false：解释为正常',原因诊断:'单个电平不能区分所有原因'};}
  if(kind==='clock'){s.hz=84000000/(Number(p.psc)+1);s.result={输入频率:'84 MHz',实际除数:Number(p.psc)+1,计数频率:s.hz/1000000+' MHz',每次计数:(1e6/s.hz).toFixed(3)+' μs'};}
  if(kind==='pwm'){s.duty=Number(p.duty);s.ccr=s.duty*10;s.result={PSC:83,ARR:999,CCR:s.ccr,定时器周期:'1000 μs（1 kHz 配置）',高电平持续:s.ccr+' μs',占空比:s.duty+'%'};}
  if(kind==='adc'){s.adc=Math.min(4095,Math.max(0,Math.floor(Number(p.mv)/3300*4096)));s.result={输入电压:(p.mv/1000).toFixed(2)+' V',数字编码:s.adc,编码范围:'0–4095',湿度:'尚不能由编码直接得出'};}
  if(kind==='pulse'){s.bit=Number(p.width>45);s.result={高脉宽:p.width+' μs',这一位:s.bit,整帧校验:p.checksum?'通过（假设其他检查也通过）':'失败',测量接受:p.checksum?'可以接受此示例帧':'拒绝此示例帧'};}
  if(kind==='irq'){
   if(action==='event'){s.pending=true;s.message='事件已发生，待处理标志置位。多次事件在本模型中会合并。';}
   else if(!s.pending)s.message='当前没有待处理请求。';
   else if(!p.enabled)s.message='响应被暂停，保留待处理标志，处理函数尚未执行。';
   else{s.pending=false;s.handled++;s.message='处理函数执行了一次，待处理标志清除。';}
   s.result={允许响应:p.enabled?'是':'否',待处理:s.pending?'有':'无',处理函数执行次数:s.handled};
  }
  if(kind==='tasks'){
   const end=action==='sample'?(Math.floor(s.time/2000)+1)*2000:s.time+100;
   while(s.time<end){s.time+=100;if(s.time%2000===0)s.sample=Number(p.temp);if(s.sample>=28)s.fan=1;else if(s.sample<=26)s.fan=0;}
   s.result={模拟时间:s.time+' ms',环境温度:p.temp+' °C',已取得的样本:s.sample+' °C',风扇意图:s.fan?'开':'关'};
  }
  if(kind==='queue'){
   if(action==='take'){if(s.queue.length){s.fan=s.queue.shift();s.message='已取出一条命令，更新了输出意图。这里不测量物理风扇。';}else s.message='队列为空，没有命令可处理。';}
   else if(s.queue.length===2)s.message='入队失败：两个位置已满。未覆盖旧命令，也没有等待。';
   else{s.queue.push(Number(p.command));s.message='入队成功，复制了一份命令。控制任务还没有处理它。';}
   s.result={等待处理:s.queue.map(x=>x?'开':'关').join('、')||'无',队列占用:s.queue.length+' / 2',风扇输出意图:s.fan?'开':'关'};
  }
  if(kind==='chain'){
   if(s.step>=3){s.step=0;s.demand=null;s.out=null;s.pin=null;}
   s.step++;
   if(s.step===1)s.demand=true;
   if(s.step===2)s.out=s.demand&&!p.low;
   if(s.step===3)s.pin=s.out;
   const show=v=>v===null?'尚未执行':v?'开':'关';
   s.result={已执行:['','计算滴灌需求','检查低液位保护','提交输出信号'][s.step],需求:show(s.demand),保护后输出:show(s.out),已提交信号:show(s.pin)};
  }
  return s;
 }
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{if($('guide-save-status'))$('guide-save-status').textContent='浏览器无法保存，请点击“导出入门记录”备份。';}renderNav();}
 function renderNav(){
  $('beginner-nav').innerHTML=lessons.map((l,i)=>`<button data-guide-lesson="${i}" class="${i===current?'active':''}" ${i===current?'aria-current="step"':''}>${i+1}. ${esc(l.title)}<small>${saved.lessons[l.id]?.done?'已完成练习':i===current?'正在学习':'入门小课'}</small></button>`).join('');
  const count=lessons.filter(l=>saved.lessons[l.id]?.done).length;
  $('guide-progress-text').textContent=`${count} / ${lessons.length} 小课完成练习`;
  $('guide-progress').value=count;
 }
 function route(){if(active)history.replaceState(null,'',`?mode=beginner&lesson=${encodeURIComponent(lessons[current].id)}&step=${phase+1}`);}
 function select(index,stage=0,scroll=false){current=Math.min(lessons.length-1,Math.max(0,Number(index)||0));phase=Math.min(3,Math.max(0,Number(stage)||0));saved.current=current;saved.phase=phase;persist();render();route();if(scroll)$('beginner-pane').scrollIntoView({behavior:'smooth',block:'start'});}
 const values=result=>`<dl class="guide-values">${Object.entries(result||{}).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
 function render(){
  const l=lessons[current],e=entry();
  $('guide-lesson-position').textContent=`入门 ${current+1} / ${lessons.length}`;
  $('guide-title').textContent=l.title;$('guide-goal').textContent=l.goal;
  $('guide-phases').innerHTML=phases.map((p,i)=>`<button data-guide-phase="${i}" aria-pressed="${phase===i}" class="${phase===i?'active':''}">${i+1} · ${p}</button>`).join('');
  if(phase===0)$('guide-content').innerHTML=`<p class="guide-lead">${esc(l.lead)}</p><div class="guide-flow" aria-label="本课的三个环节">${l.flow.map((t,i)=>`<div><span>环节 ${i+1}</span><strong>${esc(t)}</strong></div>`).join('')}</div><h3>先认识这几个词</h3><dl class="guide-terms">${l.terms.map(([t,d])=>`<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl><details class="guide-project-note"><summary>它与我的项目有什么关系？</summary><p>${esc(l.bridge)}</p></details>`;
  if(phase===1)renderPractice(l,e);
  if(phase===2)renderCode(l,e);
  if(phase===3)renderCheck(l,e);
  $('guide-prev').disabled=current===0&&phase===0;
  $('guide-next').hidden=phase===3;
  $('guide-next').textContent=['开始小实验','再读几行代码','试着自己解释',''][phase];
  $('guide-skip').hidden=phase!==3||current===lessons.length-1;
  $('guide-return-hint').textContent=phase===0?'这页先看概念，下一步才出现实验和代码。':phase===1?'改变一个条件，观察一个结果。':phase===2?'点击“下一句”，每次只解释当前这一行。':'选择答案并写下自己的解释；需要时可以返回小实验。';
 }
 function control(key,label,type='number',extra={}){const s=entry().demo,p=s.params,value=p[key];
  if(type==='checkbox')return `<label class="guide-toggle"><input data-param="${key}" type="checkbox" ${value?'checked':''}>${esc(label)}</label>`;
  if(type==='select')return `<label>${esc(label)}<select data-param="${key}">${extra.options.map(([v,t])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  return `<label>${esc(label)}<input data-param="${key}" type="number" value="${value}" min="${extra.min??0}" max="${extra.max??100}" step="${extra.step??1}" required></label>`;
 }
 function renderPractice(l,e){
  const kind=l.practice.kind;if(!e.demo?.params)e.demo=initial(kind);
  let controls='',buttons='';
  const button=(action,label)=>`<button type="submit" data-demo-action="${action}">${label}</button>`;
  if(kind==='cause'||kind==='c')controls=control('temp','设置温度（°C）','number',{min:0,max:50});
  if(kind==='output')controls=control('signal','输出信号','select',{options:[[1,'高电平'],[0,'低电平']]})+control('wire','驱动信号线接通','checkbox')+control('power','负载电源接通','checkbox');
  if(kind==='input')controls=control('level','液位开关','select',{options:[['normal','拉低（正常液位）'],['low','释放（低液位）']]})+control('wire','信号线接通','checkbox');
  if(kind==='clock')controls=control('psc','PSC 预分频值','number',{max:65535});
  if(kind==='pwm')controls=control('duty','占空比（%）');
  if(kind==='adc')controls=control('mv','输入电压（mV，1650 = 1.65 V）','number',{max:3300,step:1});
  if(kind==='pulse')controls=control('width','单个位高脉宽（μs）','number',{min:20,max:80})+control('checksum','整帧校验通过','checkbox');
  if(kind==='irq'){controls=control('enabled','允许响应','checkbox');buttons=button('event','产生一个事件')+button('run','尝试处理请求');}
  if(kind==='tasks'){controls=control('temp','环境温度（°C）','number',{min:0,max:50});buttons=button('run','推进 100 ms')+button('sample','推进到下个采样点');}
  if(kind==='queue'){controls=control('command','准备交接的命令','select',{options:[[1,'开风扇'],[0,'关风扇']]});buttons=button('run','命令入队')+button('take','控制任务处理一条');}
  if(kind==='chain')controls=control('low','当前为低液位','checkbox');
  if(!buttons)buttons=button('run',kind==='c'||kind==='chain'?'执行下一步':kind==='cause'?'执行判断':'应用并观察');
  $('guide-content').innerHTML=`<p class="guide-lead">${esc(l.practice.instruction)}</p><p class="guide-evidence">本页为简化教学模型；不会改变主实验台或实际硬件。</p><form id="guide-demo-form"><div class="guide-controls">${controls}</div><div class="action-row">${buttons}<button type="button" id="guide-demo-reset">重置本小实验</button></div></form><div id="guide-demo-output" aria-live="polite"></div><p class="guide-hint">${esc(l.practice.hint)}</p>`;
  $('guide-demo-form').onsubmit=event=>{
   event.preventDefault();if(!$('guide-demo-form').reportValidity())return;
   document.querySelectorAll('[data-param]').forEach(el=>{e.demo.params[el.dataset.param]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value);});
   // Convert the signal selection before boolean logic; the string "0" is truthy.
   if(kind==='output')e.demo.params.signal=Number(e.demo.params.signal);
   act(kind,e.demo,event.submitter?.dataset.demoAction||'run');e.tried=true;persist();renderDemoResult(l,e);
  };
  $('guide-demo-reset').onclick=()=>{e.demo=initial(kind);persist();renderPractice(l,e);};renderDemoResult(l,e);
 }
 function renderDemoResult(l,e){const s=e.demo;let diagram='';
  if(s.result&&['cause','output','tasks'].includes(l.practice.kind))diagram=`<div class="guide-device ${s.fan?'is-on':''}"><svg viewBox="0 0 100 100" role="img" aria-label="风扇示意：${s.fan?'开启':'关闭'}"><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="3"/><g class="guide-blades">${[0,120,240].map(a=>`<path d="M50 50 C25 42 23 16 45 14 C65 12 61 35 50 50" transform="rotate(${a} 50 50)" fill="currentColor"/>`).join('')}</g><circle cx="50" cy="50" r="7" fill="#fff" stroke="currentColor" stroke-width="3"/></svg><span>${l.practice.kind==='output'?(s.fan?'通路完整：风扇转动':'通路未导通：风扇停止'):(s.fan?'风扇开启意图':'风扇关闭意图')}</span></div>`;
  if(s.result&&l.practice.kind==='pwm'){
   const high=Number(s.duty)*3,points=s.duty===0?'0,65 300,65':s.duty===100?'0,15 300,15':`0,65 0,15 ${high},15 ${high},65 300,65`;
   diagram=`<figure class="guide-wave"><svg viewBox="-25 0 345 100" role="img" aria-label="一个周期的 PWM 波形，占空比 ${s.duty}%"><path d="M0 80H300" stroke="#a4b9aa"/><polyline points="${points}" fill="none" stroke="#255c45" stroke-width="4"/><text x="0" y="98">0</text><text x="235" y="98">1000 μs</text></svg><figcaption>一个定时器周期；高电平占 ${s.duty}%。</figcaption></figure>`;
  }
  $('guide-demo-output').innerHTML=s.result?diagram+values(s.result)+(['c','irq','queue'].includes(l.practice.kind)?`<p class="guide-result-note">${esc(s.message)}</p>`:''):`<p class="guide-empty">${esc(s.message)}</p>`;
 }
 function renderCode(l,e){
  const n=Math.max(0,Math.min(l.code.length-1,e.line||0));e.line=n;const start=Math.max(0,n-1),end=Math.min(l.code.length,n+2);
  $('guide-content').innerHTML=`<p class="guide-evidence">${esc(l.codeLabel)}</p><p>只读高亮这一句。上下各保留一句，方便找到位置。</p><pre class="guide-code">${l.code.slice(start,end).map((c,i)=>`<span class="${start+i===n?'current':''}"><i>${start+i+1}</i>${esc(c.text)}</span>`).join('')}</pre><div class="guide-code-meaning" aria-live="polite"><span class="label">这句话在做什么</span><p>${esc(l.code[n].meaning)}</p></div><div class="action-row"><button id="guide-code-prev" ${n===0?'disabled':''}>上一句</button><span>第 ${n+1} / ${l.code.length} 句</span><button id="guide-code-next" ${n===l.code.length-1?'disabled':''}>下一句</button></div><details><summary>连起来看本课代码</summary><pre class="guide-code">${esc(l.code.map(c=>c.text).join('\n'))}</pre></details>`;
  $('guide-code-prev').onclick=()=>{e.line--;persist();renderCode(l,e);};$('guide-code-next').onclick=()=>{e.line++;persist();renderCode(l,e);};
 }
 function renderCheck(l,e){
  $('guide-content').innerHTML=`<form id="guide-quiz"><fieldset><legend>${esc(l.quiz.q)}</legend>${l.quiz.options.map((o,i)=>`<label class="guide-option"><input type="radio" name="guide-answer" value="${i}" ${e.answer===i?'checked':''} required>${esc(o)}</label>`).join('')}</fieldset><button class="primary">检查我的理解</button></form><p id="guide-feedback" class="guide-feedback" aria-live="polite">${e.checked?esc(l.quiz.feedback[e.answer]):''}</p><label for="guide-reflection">${esc(l.reflection)}</label><textarea id="guide-reflection" class="notes" placeholder="用自己的话写一两句就好。">${esc(e.reflection||'')}</textarea><p id="guide-complete-hint" class="boundary"></p><div class="action-row"><button id="guide-complete" class="primary">${current===lessons.length-1?'完成入门，进入项目实验':'记下这课，继续学习'}</button><button id="guide-retry">回到小实验</button></div><details><summary>已经理解，进入相关专题深读</summary><p>这些专题包含更完整的源码、取舍与面试追问，可以学完入门后再读。</p><div class="action-row">${l.topics.map(t=>`<button data-guide-deep="${t}">专题 ${t}</button>`).join('')}</div></details>`;
  $('guide-quiz').onsubmit=ev=>{ev.preventDefault();const chosen=$('guide-quiz').querySelector('input:checked');if(!chosen)return;e.answer=Number(chosen.value);e.checked=true;e.correct=e.answer===l.quiz.correct;$('guide-feedback').textContent=l.quiz.feedback[e.answer];persist();checkReady(e);};
  document.querySelectorAll('input[name="guide-answer"]').forEach(el=>el.onchange=()=>{e.answer=Number(el.value);e.checked=false;e.correct=false;$('guide-feedback').textContent='已更改选择，请再检查一次。';persist();checkReady(e);});
  $('guide-reflection').oninput=ev=>{e.reflection=ev.target.value;persist();checkReady(e);};
  $('guide-retry').onclick=()=>select(current,1,true);
  $('guide-complete').onclick=()=>{if(!ready(e))return;e.done=true;persist();if(current===lessons.length-1)openDeep(17);else select(current+1,0,true);};checkReady(e);
 }
 const ready=e=>!!(e.tried&&e.checked&&e.correct&&e.reflection?.trim());
 function checkReady(e){$('guide-complete').disabled=!ready(e);$('guide-complete-hint').textContent=!e.tried?'先运行一次本课小实验，再回来记录理解。':!e.checked||!e.correct?'先检查选择题；答错时看解释，再试一次。':!e.reflection?.trim()?'再写一两句自己的解释，就可以记下这课。':e.done?'这课已完成练习，可以继续或重新复习。':'可以继续了。记录表示完成了练习，之后还可以用项目实验检验。';}
 function showGuide(index,stage){window.Day2Study?.showTab('beginner');if(index!==undefined)select(index,stage||0,true);}
 function init({deep}){
  openDeep=deep;const p=new URLSearchParams(location.search),id=p.get('lesson');
  current=id&&lessons.some(l=>l.id===id)?lessons.findIndex(l=>l.id===id):Math.min(lessons.length-1,Math.max(0,Number(saved.current)||0));
  phase=id?Math.min(3,Math.max(0,(Number(p.get('step'))||1)-1)):Math.min(3,Math.max(0,Number(saved.phase)||0));
  $('beginner-nav').onclick=ev=>{const b=ev.target.closest('[data-guide-lesson]');if(b)showGuide(Number(b.dataset.guideLesson));};
  $('guide-phases').onclick=ev=>{const b=ev.target.closest('[data-guide-phase]');if(b)select(current,Number(b.dataset.guidePhase));};
  $('guide-prev').onclick=()=>select(phase===0?current-1:current,phase===0?3:phase-1,true);
  $('guide-next').onclick=()=>select(current,phase+1,true);
  $('guide-skip').onclick=()=>select(current+1,0,true);
  $('guide-first').onclick=()=>select(0,0,true);
  $('beginner-pane').addEventListener('click',ev=>{const b=ev.target.closest('[data-guide-deep]');if(b)openDeep(Number(b.dataset.guideDeep));});
  $('guide-export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),...saved},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='青禾-入门学习记录.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  renderNav();render();
 }
 function setActive(value){active=value;route();}
 window.BeginnerStudy={init,setActive,select,show:showGuide,lessons,initial,act,get records(){return saved;}};
})();
