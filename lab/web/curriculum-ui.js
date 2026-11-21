(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let ctx,current,frames=[],step=0,timer=0,options={},completed={};
 const courses=[...(window.CurriculumFoundations||[]),...(window.CurriculumSystems||[])].sort((a,b)=>a.id-b.id);
 const model=()=>window.LearningModels.models[current.model];
 function stop(){clearTimeout(timer);timer=0;$('learn-play').textContent='▶ 运行模型';}
 function menu(){
   const query=$('learn-search').value.trim().toLowerCase(),chapter=$('learn-chapter').value;
   const visible=courses.filter(c=>(!chapter||c.chapter===chapter)&&(!query||[c.title,c.summary,c.model,'#'+c.id,...c.questions.map(q=>'题'+q)].join(' ').toLowerCase().includes(query)||String(c.id)===query));
   $('learn-list').innerHTML=visible.map(c=>`<button data-topic="${c.id}" class="${current?.id===c.id?'active':''}"><span>${String(c.id).padStart(3,'0')}</span><div>${esc(c.title)}<small>${c.bench?'接线 + ':''}${c.nativeLesson?'原 C 实验':c.model+' · 共享原理模型'}</small></div><i>${completed[c.id]?'✓':''}</i></button>`).join('');
   $('learn-count').textContent=`${courses.length} 个专题 · 已练习 ${Object.keys(completed).filter(k=>completed[k]).length} · 当前 ${visible.length} 项`;
 }
 function readControls(){for(const c of model().controls){const n=document.querySelector(`[data-learn-option="${c.key}"]`);options[c.key]=c.type==='checkbox'?n.checked:c.type==='select'?n.value:Number(n.value);}}
 function controls(){
   options=Object.fromEntries(model().controls.map(c=>[c.key,c.value]));
   for(const [key,value] of Object.entries(current.preset||{}))if(key in options){const c=model().controls.find(c=>c.key===key);if(c.type==='checkbox'||c.type==='select')options[key]=value;else options[key]=Math.max(c.min,Math.min(c.max,Number(value)));}
   $('learn-controls').innerHTML=model().controls.map(c=>c.type==='checkbox'?`<label><input data-learn-option="${c.key}" type="checkbox" ${options[c.key]?'checked':''}>${esc(c.label)}</label>`:c.type==='select'?`<label>${esc(c.label)}<select data-learn-option="${c.key}">${c.options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(options[c.key])?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:`<label>${esc(c.label)}<input data-learn-option="${c.key}" type="number" value="${options[c.key]}" min="${c.min}" max="${c.max}" step="${c.step||1}" required></label>`).join('');
 }
 function select(id){
   const found=courses.find(c=>c.id===Number(id));if(!found)return;stop();current=found;step=0;
   $('learn-title').textContent=`${String(current.id).padStart(3,'0')} · ${current.title}`;$('learn-course').textContent=current.course;$('learn-summary').textContent=current.summary;
   $('learn-principles').innerHTML=current.principles.map((p,i)=>`<p><span>${i+1}</span>${esc(p)}</p>`).join('');
   $('learn-exercises').innerHTML=current.steps.map((s,i)=>`<div><b>${i+1}. ${esc(s.action)}</b><details><summary>预测后展开，核对现象</summary><p>${esc(s.expect)}</p></details></div>`).join('');
   $('learn-quiz').innerHTML=`<summary>${esc(current.quiz.q)}</summary><p>${esc(current.quiz.a)}</p>`;$('learn-quiz').open=false;
   $('learn-questions').innerHTML=current.questions.map(id=>{const q=window.LAB_QUESTIONS.find(q=>q.id===id);return q?`<span>#${id} ${esc(q.title)} ${q.source?`<a href="${q.source}" target="_blank" rel="noopener">面经原帖 ↗</a>`:'· 延伸题'}</span>`:'';}).join('');
   $('learn-references').innerHTML=current.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join('');
   $('learn-wire').hidden=!current.bench;$('learn-native').hidden=!current.nativeLesson;$('learn-done').checked=!!completed[current.id];
   if($('learn-deep')){$('learn-deep').hidden=current.id<17||current.id>64;$('learn-deep').href='study.html?mode=deep&topic='+current.id;}
   $('learn-model-title').textContent=model().title;$('learn-model-boundary').textContent='共享原理模型 · JavaScript 执行计算 / 状态推演，右侧为对应代码说明。每个专题另有自己的原理、练习和源码；岗位拓展的完整硬件系统不在此模型中运行。';
   const code=current.code.text||ctx.sources[current.code.file]||'',lines=code.split('\n'),line=current.code.anchor?lines.findIndex(l=>l.includes(current.code.anchor)):-1;
   $('learn-topic-file').textContent=current.code.file;
   $('learn-topic-code').innerHTML=lines.map((l,i)=>`<div class="code-row ${i===line?'active':''}"><span class="line-number">${i+1}</span><code class="code-text">${esc(l)}</code></div>`).join('');
   $('learn-topic-code').scrollTop=Math.max(0,line*19-90);
   controls();rebuild();menu();
 }
 function rebuild(){if(!$('learn-form').reportValidity())return;stop();readControls();frames=model().run(options);step=0;render();}
 function render(){
   const f=frames[step];if(!f)return;
   $('learn-position').textContent=`步骤 ${step+1} / ${frames.length}`;$('learn-caption').textContent=f.caption;
   $('learn-values').innerHTML=Object.entries(f.values||{}).map(([k,v])=>`<span>${esc(k)}<b>${esc(typeof v==='number'&&!Number.isInteger(v)?Number(v.toPrecision(6)):v)}</b></span>`).join('');
   let code=model().sourceModel?ctx.sources[f.file]:model().code;const lines=(code||'').split('\n'),line=f.anchor?lines.findIndex(l=>l.includes(f.anchor)):(f.line||1)-1;
   $('learn-code-file').textContent=model().sourceModel?f.file:'教学模型 / '+current.model+'.c（对应伪代码）';
   $('learn-code').innerHTML=lines.map((l,i)=>`<div class="code-row ${i===line?'active':''}"><span class="line-number">${i+1}</span><code class="code-text">${esc(l)}</code></div>`).join('');
   const row=$('learn-code').querySelector('.active');if(row)$('learn-code').scrollTop=Math.max(0,row.offsetTop-$('learn-code').offsetTop-70);
   const cells=f.cells?.map(c=>({label:c.label??c.index,value:c.value===null?'—':c.value}))||f.slots?.map((v,i)=>({label:i,value:v}))||f.bytes?.map((v,i)=>({label:i,value:window.BoardModels.hex(v)}))||[];
   $('learn-cells').innerHTML=cells.map(c=>`<span><small>${esc(c.label)}</small><b>${esc(c.value)}</b></span>`).join('');
   chart(f);window.PlanterView.update('learn-grow',f.effect||{},Object.keys(f.effect||{}).length?'本模型的关联效果 · 非原 C 输出':'本专题分析内部机制；不伪造执行器动作');
   $('learn-prev-step').disabled=step===0;$('learn-next-step').disabled=step===frames.length-1;
 }
 function chart(f){
   if(f.wave?.length){
    const svg=f.wave.map((row,i)=>{let x=65,d='',total=row.segments.reduce((a,s)=>a+s.duration,0);for(const s of row.segments){const y=30+i*65+(s.level?0:30);d+=d?`V${y}H${x+s.duration/total*500}`:`M${x} ${y}H${x+s.duration/total*500}`;x+=s.duration/total*500;}return `<text x="5" y="${45+i*65}">${esc(row.name)}</text><path d="${d}" fill="none" stroke="${i?'#50a3b5':'#b49c37'}" stroke-width="2"/>`;}).join('');
    $('learn-chart').innerHTML=`<svg viewBox="0 0 580 ${f.wave.length*65+15}" aria-label="当前步骤的数字波形">${svg}</svg>`;return;
   }
   if(f.series?.length){const p=f.series,min=Math.min(0,...p.map(n=>n.y)),max=Math.max(1,...p.map(n=>n.y)),xmax=Math.max(1,...p.map(n=>n.x)),points=p.map(n=>`${50+n.x/xmax*505},${170-(n.y-min)/(max-min)*145}`);$('learn-chart').innerHTML=`<svg viewBox="0 0 590 205" aria-label="模型数值随步骤的变化"><path d="M50 20V170H560" stroke="#bacbb1" fill="none"/><text x="5" y="28">${max.toFixed(2)}</text><text x="5" y="175">${min.toFixed(2)}</text><text x="455" y="198">步骤 / 样本序号</text><polyline points="${points.join(' ')}" stroke="#668f53" stroke-width="3" fill="none"/><circle cx="${points.at(-1).split(',')[0]}" cy="${points.at(-1).split(',')[1]}" r="5" fill="#cba851"/></svg>`;return;}
   $('learn-chart').innerHTML=`<div class="learn-process">${frames.map((_,i)=>`<span class="${i===step?'active':i<step?'past':''}">${i+1}</span>`).join('')}</div><p class="learn-stage-note">执行标记随单步前进；上方数值和存储格由当前模型计算。</p>`;
 }
 function play(){if(timer){stop();return;}if(step===frames.length-1)step=0;$('learn-play').textContent='Ⅱ 暂停';render();const tick=()=>{if(step>=frames.length-1){stop();return;}step++;render();timer=setTimeout(tick,850);};timer=setTimeout(tick,850);}
 function open(id=1){ctx.pause();window.CircuitBench.stop();select(id);if(!$('curriculum-lab').open)$('curriculum-lab').showModal();}
 function init(context){
   ctx=context;try{completed=JSON.parse(localStorage.getItem('planter-course-progress')||'{}');}catch{}
   $('learn-chapter').innerHTML='<option value="">全部章节 · 按学习顺序</option>'+[...new Set(courses.map(c=>c.chapter))].map(c=>`<option>${esc(c)}</option>`).join('');
   $('learn-list').onclick=e=>{const b=e.target.closest('[data-topic]');if(b)select(b.dataset.topic);};$('learn-search').oninput=menu;$('learn-chapter').onchange=menu;
   $('learn-close').onclick=()=>{stop();$('curriculum-lab').close();};$('curriculum-lab').addEventListener('close',stop);
   $('learn-previous').onclick=()=>select(Math.max(1,current.id-1));$('learn-next').onclick=()=>select(Math.min(150,current.id+1));
   $('learn-play').onclick=play;$('learn-prev-step').onclick=()=>{stop();step=Math.max(0,step-1);render();};$('learn-next-step').onclick=()=>{stop();step=Math.min(frames.length-1,step+1);render();};
   $('learn-form').onsubmit=e=>{e.preventDefault();rebuild();};
   $('learn-wire').onclick=()=>{stop();$('curriculum-lab').close();window.CircuitBench.open(current.bench);};
   $('learn-native').onclick=()=>{stop();$('curriculum-lab').close();ctx.selectLesson(current.nativeLesson);};
   $('learn-done').onchange=e=>{completed[current.id]=e.target.checked;try{localStorage.setItem('planter-course-progress',JSON.stringify(completed));}catch{}menu();};
   $('curriculum-open').onclick=()=>open(1);$('bench-curriculum').onclick=()=>{window.CircuitBench.stop();$('circuit-bench').close();open(courses.find(c=>c.bench===$('bench-lessons').value)?.id||1);};
   window.PlanterView.mount($('learn-grow-view'),'learn-grow');menu();
   const requested=Number(new URLSearchParams(location.search).get('topic'));if(requested>0&&requested<=150)setTimeout(()=>open(requested),0);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 }
 window.CurriculumLab={init,open,stop,courses};
})();
