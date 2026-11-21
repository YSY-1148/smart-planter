(() => {
 'use strict';
 const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const topics=window.Day2Topics||[],blocks=window.Day2Blocks||[],courses=window.CurriculumFoundations||[];
 const companies=[...(window.InterviewInovance?[window.InterviewInovance]:[]),...(window.InterviewCompaniesA||[]),...(window.InterviewCompaniesB||[])];
 const KEY='qinghe-day2-v1';let records={},sources={},current=17,blockId=null,modelFrames=[],modelStep=0,modelOptions={},reviewId=17;
 let runBusy=false,sourceAvailable=false;
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))records=saved;}catch{}
 const record=id=>records[id]&&typeof records[id]==='object'?records[id]:(records[id]={checks:[],prediction:'',notes:''});
 const complete=id=>{const r=record(id);return !!(r.prediction?.trim()&&r.notes?.trim()&&Array.isArray(r.checks)&&[0,1,2].every(i=>r.checks[i]===true));};
 function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(records));}catch{notice('浏览器未能保存记录，请使用“导出学习记录”下载备份。');}progress();}
 function progress(){const n=topics.filter(t=>complete(t.id)).length;$('progress').value=n;$('progress-text').textContent=`${n} / 48 个专题完成自评`;}
 function list(items,ordered=false){const tag=ordered?'ol':'ul';return `<${tag}>${(items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</${tag}>`;}
 function links(refs){return (refs||[]).map(r=>{const url=typeof r==='string'?r:r.url;const title=typeof r==='string'?r:r.title;return /^https:\/\//.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`:'';}).join(' · ');}
 function tab(name){
  ['beginner','study','interview','review'].forEach(key=>{$('tab-'+key).setAttribute('aria-selected',String(name===key));$(key+'-pane').hidden=name!==key;});
  const beginner=name==='beginner';document.body.dataset.view=name;
  $('beginner-rail').hidden=!beginner;$('deep-rail').hidden=beginner;$('day-pace').hidden=beginner;$('deep-resources').hidden=beginner;
  $('study-eyebrow').textContent=beginner?'青禾实验室 / 入门引导':'青禾实验室 / 项目 · 实验 · 复盘';
  $('study-heading').textContent=beginner?'先弄懂一件小事。':'把概念接回真实项目。';
  $('study-subtitle').textContent=beginner?'从“风扇为什么转”开始，逐步认识引脚、时间和采样，最后再读项目。':'沿着做法、理由、实验结果和追问，逐步深入专题 17–64。';
  $('study-badge').textContent=beginner?'12 节小课':'48 个专题';$('study-badge-note').textContent=beginner?'概念 · 小实验 · 一句代码':'按需要选择深读';
  window.BeginnerStudy?.setActive(beginner);
  if(!beginner)history.replaceState(null,'',name==='study'?`?mode=deep&topic=${current}`:`?mode=${name}`);
  if(name==='interview')renderBank();if(name==='review')renderReview();
 }
 function renderBlocks(){
  $('blocks').innerHTML=blocks.map(b=>`<button data-block="${esc(b.id)}" class="${b.id===blockId?'active':''}">${esc(b.title)}<small>${b.minutes} 分钟 · ${b.topics.filter(complete).length}/${b.topics.length} 已自评</small></button>`).join('');
 }
 function selectTopic(id,scroll=false){
  const t=topics.find(t=>t.id===Number(id));if(!t)return;current=t.id;blockId=blocks.find(b=>b.topics.includes(current))?.id;
  records.lastTopic=current;save();tab('study');renderBlocks();const b=blocks.find(b=>b.id===blockId);
  $('block-time').textContent=`建议 ${b.minutes} 分钟 · 核心深入，拓展对照`;$('block-title').textContent=b.title;$('block-deliverable').textContent=b.deliverable;
  $('topic-list').innerHTML=b.topics.map(id=>`<button data-select-topic="${id}" class="${id===current?'active':''}">${id} · ${esc(courses.find(c=>c.id===id)?.title||'专题')}${complete(id)?' ✓':''}</button>`).join('');
  renderTopic();history.replaceState(null,'',`?mode=deep&topic=${current}`);if(scroll)$('study-pane').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function sourceSnippet(file,anchor){
  if(!file)return '<p class="source-empty">这是扩展教学；当前固件没有此实现。用原理模型验证，再说明如何接入项目。</p>';
  const text=sources[file];if(!text)return '<p class="source-empty">连接本地服务后显示源码；也可打开对应原专题查看。</p>';
  const lines=text.split('\n'),match=lines.findIndex(l=>anchor&&l.includes(anchor)),start=Math.max(0,match-3),end=Math.min(lines.length,start+20);
  return `<p class="source">${esc(file)}${match>=0?' : '+(match+1):''}</p><pre class="source-code">${lines.slice(start,end).map((l,i)=>`<${i+start===match?'mark':'span'}><i>${i+start+1}</i>${esc(l)}</${i+start===match?'mark':'span'}>`).join('')}</pre>`;
 }
 function renderTopic(){
  const t=topics.find(x=>x.id===current),c=courses.find(x=>x.id===current),r=record(current);
  const lesson=({17:'tasks',28:'stale'}[current])||c.nativeLesson;
  const alts=t.alternatives.map(a=>`<div class="decision"><strong>${esc(a.name)}</strong><p>${esc(a.tradeoff)}</p><p class="label">适用条件：${esc(a.when)}</p></div>`).join('');
  $('topic-content').innerHTML=`
   <div class="topic-title"><div><span class="tag ${t.level==='extension'?'extension':''}">${esc(t.project.status)}</span><span class="tag">${t.minutes} 分钟建议</span><h2>${t.id} · ${esc(c.title)}</h2><p class="topic-goal">${esc(t.goal)}</p></div></div>
   <div class="study-grid"><div>
    <section class="card"><h3>项目究竟怎么做</h3><p>${esc(t.project.implementation)}</p><div id="topic-source">${sourceSnippet(t.project.file,t.project.anchor)}</div><p class="label">为什么采用这个方案</p><p>${esc(t.project.reason)}</p></section>
    <section class="card"><h3>还有哪些做法，怎样取舍</h3>${alts}</section>
    <section class="card"><h3>先预测，再做实验</h3>${list(t.experiment.setup,true)}<label for="prediction">${esc(t.experiment.predict)}</label><textarea id="prediction" class="prediction" placeholder="先写你的预测，例如：到哪一个时间点，哪个变量或引脚会变化？">${esc(r.prediction)}</textarea>
     <div class="action-row"><a href="index.html?topic=${current}" target="_blank" rel="noopener">打开原专题与完整模型</a>${c.bench?`<a href="index.html?bench=${esc(c.bench)}" target="_blank" rel="noopener">进入对应接线实验</a>`:''}${lesson?`<button id="run-native" class="primary" data-lesson="${esc(lesson)}">运行原 C 对照实验</button>`:''}</div>
     ${lesson?`<p class="boundary">运行关联预设对照实验；17、18、20、21、22使用本页边界步骤。其余完整实验按上方步骤在原实验台完成。${window.LabAPI?.browser?'C 代码在浏览器的独立 WebAssembly 实例中运行':'C 代码在独立进程中运行'}，输入与时间仍为模拟值。</p><div id="native-result" aria-live="polite"></div>`:''}
     <details id="expected"><summary>核对预期结果</summary>${list(t.experiment.observe)}</details>
     <details><summary>故障注入与解释</summary>${t.experiment.faults.map(f=>`<div class="fault"><b>${esc(f.change)}</b><p>结果：${esc(f.result)}</p><p>解释：${esc(f.explanation)}</p></div>`).join('')}</details>
    </section>
    <section class="card"><h3>${esc(window.LearningModels.models[c.model].title)} <span class="tag">共享原理模型</span></h3><p class="boundary">可改参数、逐步观察。模型与原 C 对照实验分别运行；不同专题可能共用模型，课程中的纸上推导不会自动变成模型功能。</p><form id="model-form"><div class="model-controls" id="model-controls"></div><button>应用参数</button></form><div id="model-view"></div><div class="action-row"><button id="model-prev">上一步</button><button id="model-next">下一步</button><span id="model-position"></span></div></section>
   </div><aside>
    <section class="card"><h3>把结果变成你的解释</h3><p class="label">可观察的完成标准</p>${list(t.acceptance)}<label for="topic-notes">实验记录与方案复盘</label><textarea id="topic-notes" class="notes" placeholder="我观察到…\n原因是…\n另一种做法是…\n本项目选择…是因为…\n尚未证明的是…">${esc(r.notes)}</textarea><p class="progress-caption">自动保存；写出预测、复盘并完成下方三项自评后计入进度。</p><div class="completion">${['我能不看答案解释原理与项目做法','我已运行或手工推演，并记录结果','我能比较替代方案，并说明一个边界'].map((label,i)=>`<label><input type="checkbox" data-check="${i}" ${r.checks?.[i]?'checked':''}>${label}</label>`).join('')}</div></section>
    <section class="card"><h3>口述与连续追问</h3><p><strong>${esc(t.oral.question)}</strong></p><details><summary>展开参考回答结构</summary>${list(t.oral.answer)}</details><p class="label">继续追问</p>${list(t.oral.followups)}<button id="topic-interview">查看本专题关联公司题</button></section>
    <section class="card"><h3>证据与阅读</h3><p class="boundary">项目代码证明当前实现；设计理由中的取舍分析不代表当时的历史决策记录。</p>${links(c.sources)}<p class="boundary">先完成今天的核心实验，再按岗位需要阅读延伸材料。</p></section>
   </aside></div><div class="topic-footer"><button id="prev-topic" ${current===17?'disabled':''}>上一专题</button><button id="next-topic" class="primary" ${current===64?'disabled':''}>下一专题</button></div>`;
  $('prediction').oninput=e=>{record(current).prediction=e.target.value;save();};$('topic-notes').oninput=e=>{record(current).notes=e.target.value;save();};
  document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{const r=record(current);if(!Array.isArray(r.checks))r.checks=[];r.checks[Number(el.dataset.check)]=el.checked;save();renderBlocks();});
  $('prev-topic').onclick=()=>selectTopic(current-1,true);$('next-topic').onclick=()=>selectTopic(current+1,true);
  $('topic-interview').onclick=()=>{$('company-filter').value='all';$('question-search').value='';$('scope-filter').value='today';$('evidence-filter').value='all';bankTopic=current;tab('interview');};
  if($('run-native')){$('run-native').disabled=runBusy;$('run-native').onclick=()=>runNative(lesson,current);}
  setupModel(c);$('model-form').onsubmit=e=>{e.preventDefault();if(!$('model-form').reportValidity())return;readModel(c);};
  $('model-prev').onclick=()=>{modelStep=Math.max(0,modelStep-1);renderModel(c);};$('model-next').onclick=()=>{modelStep=Math.min(modelFrames.length-1,modelStep+1);renderModel(c);};
 }
 function setupModel(c){const m=window.LearningModels.models[c.model];modelOptions=Object.fromEntries(m.controls.map(x=>[x.key,x.value]));Object.assign(modelOptions,c.preset||{});
  $('model-controls').innerHTML=m.controls.map(x=>x.type==='checkbox'?`<label><input type="checkbox" data-model="${esc(x.key)}" ${modelOptions[x.key]?'checked':''}>${esc(x.label)}</label>`:x.type==='select'?`<label>${esc(x.label)}<select data-model="${esc(x.key)}">${x.options.map(([v,t])=>`<option value="${esc(v)}" ${String(modelOptions[x.key])===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:`<label>${esc(x.label)}<input data-model="${esc(x.key)}" type="number" min="${x.min}" max="${x.max}" step="${x.step||1}" value="${modelOptions[x.key]}" required></label>`).join('');readModel(c);
 }
 function readModel(c){const m=window.LearningModels.models[c.model];m.controls.forEach(x=>{const el=document.querySelector(`[data-model="${x.key}"]`);modelOptions[x.key]=x.type==='checkbox'?el.checked:x.type==='select'?el.value:Number(el.value);});modelFrames=m.run(modelOptions);modelStep=0;renderModel(c);}
 function renderModel(c){const m=window.LearningModels.models[c.model],f=modelFrames[modelStep];if(!f)return;
  const code=f.file?sources[f.file]:m.code;let snippet='';if(code){const lines=code.split('\n'),pos=f.anchor?lines.findIndex(l=>l.includes(f.anchor)):((f.line||1)-1);snippet=`<pre class="source-code">${lines.slice(Math.max(0,pos-2),Math.max(0,pos-2)+12).map((line,i)=>`<${i+Math.max(0,pos-2)===pos?'mark':'span'}>${esc(line)}</${i+Math.max(0,pos-2)===pos?'mark':'span'}>`).join('')}</pre>`;}
  $('model-view').innerHTML=`<p class="model-caption">${esc(f.caption)}</p><div class="model-values">${Object.entries(f.values||{}).map(([k,v])=>`<span>${esc(k)}<b>${esc(typeof v==='number'&&!Number.isInteger(v)?Number(v.toPrecision(6)):v)}</b></span>`).join('')}</div><p class="source">${esc(f.file||'教学伪代码 / '+c.model)}</p>${snippet}`;
  $('model-position').textContent=`${modelStep+1} / ${modelFrames.length}`;$('model-prev').disabled=modelStep===0;$('model-next').disabled=modelStep===modelFrames.length-1;
 }
 async function runNative(id,topicId){
  const output=$('native-result');if(runBusy)return;if(!record(topicId).prediction?.trim()){output.innerHTML='<p class="native-status">先写下预测，再运行并比较结果。</p>';$('prediction').focus();return;}
  runBusy=true;$('run-native').disabled=true;output.innerHTML='<p class="native-status">正在执行原 C 代码…</p>';
  try{const response=await (window.LabAPI?.request||fetch)('/api/study-run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,topic:topicId})});const data=await response.json();if(!response.ok)throw Error(data.error||'控制核心未就绪，请刷新页面重试');
   record(topicId).lastRun={id,at:new Date().toISOString(),observations:data.observations};save();
   if(current===topicId&&output.isConnected)output.innerHTML=`<p class="native-status">${esc(data.evidence)}</p><div class="native-table-wrap"><table><thead><tr><th>步骤 / 模拟时间</th><th>温度 °C</th><th>风扇</th><th>灯 %</th><th>滴灌 / 喷雾 / 补液</th><th>保护状态</th></tr></thead><tbody>${data.observations.map(o=>`<tr><td>${esc(o.label)}<br>${o.elapsed/1000} s</td><td>${o.state.sample_temp10/10}</td><td>${o.state.out_fan?'开':'关'}</td><td>${o.state.out_led}</td><td>${o.state.out_drip} / ${o.state.out_mist} / ${o.state.out_refill}</td><td>${esc(o.alarms.join('、')||'无告警')}${o.state.refill_fault?' · 故障锁存':''}</td></tr>`).join('')}</tbody></table></div>`;
   if(current===topicId&&output.isConnected){output.insertAdjacentHTML('afterbegin',`<h3>${esc(data.title)}</h3>`);output.insertAdjacentHTML('beforeend',`<details><summary>查看样本与保护关键变量</summary><div class="native-table-wrap"><table><thead><tr><th>模拟时刻</th><th>样本编号 / 采样时刻</th><th>光照 lx</th><th>液位稳定 / 改变时刻</th><th>需求：风扇 / 湿度</th><th>滴灌启动 / 停止</th></tr></thead><tbody>${data.observations.map(o=>`<tr><td>${o.elapsed} ms</td><td>${o.state.sample_counter} / ${o.state.sample_at} ms</td><td>${o.state.sample_lux}</td><td>${o.state.water_stable} / ${o.state.water_changed} ms</td><td>${o.state.fan_demand} / ${o.state.humidity_demand}</td><td>${o.state.drip_started} / ${o.state.drip_stopped} ms</td></tr>`).join('')}</tbody></table></div></details>`);}
  }catch(e){if(output.isConnected)output.innerHTML=`<p class="notice">${esc(e.message)}</p>`;}finally{runBusy=false;if($('run-native'))$('run-native').disabled=false;}
 }
 let bankTopic=null;
 function filteredQuestions(){const company=$('company-filter').value,evidence=$('evidence-filter').value,scope=$('scope-filter').value,query=$('question-search').value.trim().toLowerCase();return companies.filter(c=>company==='all'||c.id===company).flatMap(c=>c.questions.map((q,i)=>({...q,key:c.id+'-'+i,company:c.name,companyId:c.id}))).filter(q=>(evidence==='all'||q.evidence===evidence)&&(scope!=='today'||q.topics?.some(t=>t>=17&&t<=64))&&(!bankTopic||q.topics?.includes(bankTopic))&&(!query||[q.q,q.company,...(q.answer||[]),...(q.followups||[])].join(' ').toLowerCase().includes(query)));}
 function renderBank(){
  const id=$('company-filter').value,company=companies.find(c=>c.id===id),questions=filteredQuestions();
  $('bank-stats').textContent=`${companies.length} 家企业 · ${companies.reduce((n,c)=>n+c.questions.length,0)} 道整理与迁移练习 · 汇川 ${window.InterviewInovance?.questions.length||0} 道`;
  $('company-summary').innerHTML=company?`<div class="card"><h3>${esc(company.name)} <span class="tag">${esc(company.sector)}</span></h3>${company.note?`<p>${esc(company.note)}</p>`:''}<details><summary>查看 ${company.sources.length} 条来源与核验范围</summary><ul class="sources-list">${company.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><br>${esc(s.published)} · ${esc(s.access)}<br>${esc((s.reported||[]).join('；'))}${s.note?`<br>${esc(s.note)}`:''}</li>`).join('')}</ul></details></div>`:`<div class="company-chips">${companies.map(c=>`<button data-company="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>`;
  $('question-count').textContent=`当前 ${questions.length} 题${bankTopic?' · 专题 '+bankTopic+' 关联（修改筛选可解除）':''}`;
  $('interview-questions').innerHTML=questions.length?questions.map(q=>`<article class="question-card"><div class="metadata"><span class="tag">${esc(q.company)}</span><span class="tag ${q.evidence==='practice'?'extension':''}">${q.evidence==='reported'?'面经主题改写':'项目迁移练习'}</span>${q.category?`<span>${esc(q.category)}</span>`:''}${!q.topics?.some(t=>t>=17&&t<=64)?'<span>今日范围外 · 按岗位选学</span>':''}</div><h3>${esc(q.q)}</h3><details><summary>回答要点与连续追问</summary>${list(q.answer)}${q.followups?.length?'<p class="label">自主设计的追问</p>'+list(q.followups):''}${q.answerRefs?.length?'<p class="boundary">技术依据：'+links(q.answerRefs)+'</p>':''}</details><div class="question-links">${(q.topics||[]).filter(t=>t>=17&&t<=64).map(t=>`<button data-bank-topic="${t}">专题 ${t}</button>`).join('')}${q.sourceUrl?`<a href="${esc(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${q.evidence==='reported'?'面经来源':'方向参考来源'}</a>`:''}</div></article>`).join(''):'<div class="empty">当前没有匹配题目。清空关键词或放宽筛选。</div>';
 }
 function renderReview(){const t=topics.find(t=>t.id===reviewId),r=record(reviewId);$('review-card').innerHTML=`<span class="tag">专题 ${t.id}</span><h3>${esc(t.oral.question)}</h3><p>用 90 秒解释，然后接着回答下面的追问。可在手机计时，或先写关键句。</p>${list(t.oral.followups)}<label for="review-answer">你的闭卷回答<textarea id="review-answer" class="notes">${esc(r.reviewAnswer||'')}</textarea></label><details><summary>回答后展开参考</summary>${list(t.oral.answer)}<p>验收时应包含：</p>${list(t.acceptance)}</details><div class="review-score">${[[0,'还讲不清'],[1,'提示后能讲'],[2,'能独立解释与追问']].map(([n,label])=>`<button data-score="${n}" class="${r.score===n?'primary':''}">${label}</button>`).join('')}<button data-bank-topic="${t.id}">回本课补练</button></div>`;
  $('review-answer').oninput=e=>{record(reviewId).reviewAnswer=e.target.value;save();};
  $('deliverables').innerHTML=blocks.map(b=>`<label class="check-deliverable"><input type="checkbox" data-deliverable="${esc(b.id)}" ${records.deliverables?.[b.id]?'checked':''}>${esc(b.deliverable)}</label>`).join('');
  const assessed=topics.filter(t=>Number.isInteger(record(t.id).score));$('review-summary').textContent=`已自评 ${assessed.length} 题，其中 ${assessed.filter(t=>record(t.id).score===2).length} 题自评为独立回答。`;
 }
 function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportBank(){const qs=filteredQuestions(),used=new Set(qs.map(q=>q.companyId)),parts=['青禾实验室 · 公司面经与项目迁移练习','检索整理：2026-11-20','面经为候选人自述，非官方或穷尽题库；追问和答案为教学整理。',''];for(const c of companies.filter(c=>used.has(c.id))){parts.push(c.name+' / '+c.sector);for(const q of qs.filter(q=>q.companyId===c.id)){parts.push('\n['+(q.evidence==='reported'?'面经主题改写':'项目迁移练习')+'] '+q.q,...q.answer.map(a=>'  · '+a),'  追问：'+(q.followups||[]).join('；'),'  关联专题：'+(q.topics||[]).join(', '),'  来源：'+(q.sourceUrl||'项目自主练习'));}parts.push('\n来源核验：',...c.sources.map(s=>`${s.title} | ${s.published} | ${s.access}\n${s.url}\n${s.note||''}`),'\n');}download('青禾-当前筛选面试题库.txt',parts.join('\n'));}
 async function init(){
  const initialParams=new URLSearchParams(location.search);
  if(topics.length!==48||!blocks.length){notice('今日课程资源未完整加载，请刷新页面或检查服务目录。');return;}
  $('day-pace').textContent=window.Day2StudyNotes?.pace||'';
  $('company-filter').innerHTML='<option value="all">全部公司</option>'+companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('company-filter').value=companies[0]?.id||'all';
  window.BeginnerStudy.init({deep:id=>selectTopic(id,true)});
  for(const name of ['beginner','study','interview','review'])$('tab-'+name).onclick=()=>tab(name);
  $('deep-to-beginner').onclick=()=>{const index=window.BeginnerLessons.findIndex(l=>l.topics.includes(current));tab('beginner');window.BeginnerStudy.select(Math.max(0,index),0,true);};
  $('blocks').onclick=e=>{const b=e.target.closest('[data-block]');if(b){const block=blocks.find(x=>String(x.id)===b.dataset.block);selectTopic(block.topics.find(id=>!complete(id))||block.topics[0],true);}};
  $('topic-list').onclick=e=>{const b=e.target.closest('[data-select-topic]');if(b)selectTopic(Number(b.dataset.selectTopic));};
  $('continue-topic').onclick=()=>{const b=blocks.find(b=>b.id===blockId);selectTopic(b.topics.find(id=>!complete(id))||b.topics[0]);};
  document.addEventListener('click',e=>{const topic=e.target.closest('[data-bank-topic]');if(topic)selectTopic(Number(topic.dataset.bankTopic),true);const company=e.target.closest('[data-company]');if(company){$('company-filter').value=company.dataset.company;bankTopic=null;renderBank();}const score=e.target.closest('[data-score]');if(score){record(reviewId).score=Number(score.dataset.score);save();renderReview();}});
  document.addEventListener('change',e=>{if(e.target.dataset.deliverable){records.deliverables||={};records.deliverables[e.target.dataset.deliverable]=e.target.checked;save();}});
  for(const id of ['company-filter','evidence-filter','scope-filter'])$(id).onchange=()=>{bankTopic=null;renderBank();};$('question-search').oninput=()=>{bankTopic=null;renderBank();};
  $('inovance-only').onclick=()=>{$('company-filter').value=window.InterviewInovance.id;$('question-search').value='';$('evidence-filter').value='all';$('scope-filter').value='all';bankTopic=null;renderBank();};
  $('review-next').onclick=()=>{const weak=topics.filter(t=>record(t.id).score!==2&&t.id!==reviewId);const pool=weak.length?weak:topics;reviewId=pool[Math.floor(Math.random()*pool.length)].id;renderReview();};
  $('export-notes').onclick=()=>download('青禾-今日学习记录.json',JSON.stringify({version:1,exported:new Date().toISOString(),records,beginner:window.BeginnerStudy.records},null,2),'application/json');$('export-bank').onclick=exportBank;
  const requested=Number(initialParams.get('topic'));selectTopic(topics.some(t=>t.id===requested)?requested:(topics.some(t=>t.id===records.lastTopic)?records.lastTopic:17));
  const requestedMode=initialParams.get('mode');tab(requestedMode==='deep'?'study':['interview','review'].includes(requestedMode)?requestedMode:'beginner');
  try{const response=await (window.LabAPI?.request||fetch)('/api/init');if(!response.ok)throw Error('连接失败');const data=await response.json();sources=data.sources;sourceAvailable=true;const t=topics.find(t=>t.id===current);$('topic-source').innerHTML=sourceSnippet(t.project.file,t.project.anchor);renderModel(courses.find(c=>c.id===current));}catch{notice(window.LabAPI?.browser?'控制核心资源尚未加载成功，请刷新重试。课程和题库仍可阅读。':'当前未连接本地控制服务。课程、题库和原理模型可阅读；源码与原 C 实验请通过 lab/start_lab.cmd 启动后访问。');}
 }
 window.Day2Study={topics,companies,blocks,selectTopic,filteredQuestions,showTab:tab,get records(){return records;},get sourceAvailable(){return sourceAvailable;}};
 init();
})();
