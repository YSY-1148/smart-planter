// Curriculum evidence, learning-state persistence, native isolation and interview filtering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./.qa/node_modules/jsdom');
const base=process.env.LAB_TEST_URL;
assert.ok(base,'Use an isolated lab server with LAB_TEST_URL');
const root=path.join(__dirname,'web'),files=['board-models.js','learning-models.js','curriculum-foundations.js','day2-topics.js','interview-inovance.js','interview-companies-a.js','interview-companies-b.js','beginner-lessons.js'];
const env={window:{}};vm.createContext(env);for(const name of files)vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),env);
const W=env.window,topics=W.Day2Topics,blocks=W.Day2Blocks,companies=[W.InterviewInovance,...W.InterviewCompaniesA,...W.InterviewCompaniesB];
assert.equal(topics.length,48);assert.deepEqual(Array.from(topics,t=>t.id).sort((a,b)=>a-b),Array.from({length:48},(_,i)=>17+i));
assert.equal(blocks.length,8);assert.equal(blocks.reduce((n,b)=>n+b.minutes,0),480);
assert.deepEqual(Array.from(blocks.flatMap(b=>b.topics)).sort((a,b)=>a-b),Array.from({length:48},(_,i)=>17+i));
for(const t of topics){
 assert.ok(t.project.implementation.length>20&&t.project.reason.length>20,'depth '+t.id);
 assert.ok(t.alternatives.length>=2,'alternatives '+t.id);assert.ok(t.experiment.faults.length&&t.acceptance.length>=2&&t.oral.followups.length>=2);
 if(t.project.file&&t.project.anchor)assert.ok(fs.readFileSync(path.join(__dirname,'..',t.project.file),'utf8').includes(t.project.anchor),'source '+t.id);
}
assert.ok(companies.length>40);assert.equal(new Set(companies.map(c=>c.id)).size,companies.length);assert.equal(new Set(companies.map(c=>c.name)).size,companies.length);
let reported=0;
for(const c of companies){
 assert.ok(c.sources.length>0&&c.questions.length>=3,c.name);
 assert.ok(c.questions.some(q=>q.evidence==='reported'),c.name+' reported evidence');
 for(const s of c.sources){assert.match(s.url,/^https:\/\//);assert.ok(s.title&&s.access&&s.published);}
 for(const q of c.questions){assert.ok(q.q&&q.answer.length>=2&&q.followups.length);assert.ok(['practice','reported'].includes(q.evidence));
  if(q.evidence==='reported'){reported++;assert.ok(c.sources.some(s=>s.url===q.sourceUrl),c.name+' source '+q.q);}
  assert.ok(q.topics.every(id=>Number.isInteger(id)&&id>=1&&id<=150));
 }
}
assert.ok(W.InterviewInovance.questions.length>=60);
console.log(`PASS 48 deep lessons, 480-minute route, ${companies.length} companies, ${reported} source-linked questions`);
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'study.html'),'utf8'),{url:base+'/study.html?topic=18',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);w.fetch=(u,o)=>fetch(new URL(u,base),o);w.HTMLElement.prototype.scrollIntoView=function(){};
let downloads=0;w.URL.createObjectURL=()=>{downloads++;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
d.addEventListener('click',e=>{if(e.target.closest('a[download]'))e.preventDefault();});
const until=async fn=>{const end=Date.now()+20000;while(!fn()){if(Date.now()>end)throw Error('Timeout: '+$('notice').textContent);await new Promise(r=>setTimeout(r,25));}};
(async()=>{
 for(const f of [...files,'beginner.js','study.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
 await until(()=>w.Day2Study?.sourceAvailable);
 assert.ok($('topic-content').textContent.includes('28'));assert.ok($('topic-source').textContent.includes('planter.c'));
 $('prediction').value='25/29/27/25时预测风扇关开开关';$('prediction').dispatchEvent(new w.Event('input'));
 $('topic-notes').value='中间温度保持上次需求，记录模型与原代码的边界';$('topic-notes').dispatchEvent(new w.Event('input'));
 const checks=d.querySelectorAll('[data-check]');checks[2].checked=true;checks[2].dispatchEvent(new w.Event('change'));
 assert.equal($('progress').value,0,'A sparse check array must not pass completion');
 for(const check of checks){check.checked=true;check.dispatchEvent(new w.Event('change'));}assert.equal($('progress').value,1);
 const before=await (await fetch(base+'/api/state')).json();$('run-native').click();await until(()=>$('native-result').querySelector('table tbody')?.children.length===5);
 assert.deepEqual(Array.from($('native-result').querySelector('table tbody').children,row=>row.children[2].textContent),['关','开','开','关','关']);
 const after=await (await fetch(base+'/api/state')).json();assert.deepEqual(after.state,before.state);assert.equal(after.elapsed,before.elapsed);
 assert.ok(JSON.parse(w.localStorage.getItem('qinghe-day2-v1'))[18].lastRun);
 for(const t of topics){w.Day2Study.selectTopic(t.id);assert.ok($('topic-content').textContent.includes(t.goal));assert.ok($('model-view').textContent.trim());$('model-next').click();}
 $('tab-interview').click();assert.equal(d.querySelectorAll('.question-card').length,W.InterviewInovance.questions.length);
 $('company-filter').value='all';$('company-filter').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('[data-company]').length,companies.length);
 $('question-search').value='不可能匹配的字符串';$('question-search').dispatchEvent(new w.Event('input'));assert.ok(d.querySelector('.empty'));
 $('inovance-only').click();$('evidence-filter').value='reported';$('evidence-filter').dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelectorAll('.question-card').length,W.InterviewInovance.questions.filter(q=>q.evidence==='reported').length);
 $('export-bank').click();$('export-notes').click();assert.equal(downloads,2);
 $('tab-review').click();assert.ok($('review-card').textContent);$('review-answer').value='输入经过采样和队列，控制统一决定输出';$('review-answer').dispatchEvent(new w.Event('input'));d.querySelector('[data-score="2"]').click();assert.ok($('review-summary').textContent.includes('1 题'));
 $('review-next').click();assert.ok($('review-card').querySelector('h3').textContent);
 assert.deepEqual(errors,[]);console.log('PASS all lessons render, prediction/notes/self-assessment, original C isolation, interview filters, exports and recall');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>dom.window.close());
