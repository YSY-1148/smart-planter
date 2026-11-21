// Verify that the beginner path teaches observable distinctions and preserves prior work.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./.qa/node_modules/jsdom');
const base=process.env.LAB_TEST_URL;assert.ok(base,'Use the isolated verify_study.py runner');
const root=path.join(__dirname,'web'),html=fs.readFileSync(path.join(root,'study.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
const errors=[],windows=[];
const prior={18:{prediction:'原来的预测',notes:'原来的复盘',checks:[true,true,true]},lastTopic:18};
function create(query='?topic=17',saved){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:base+'/study.html'+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});windows.push(dom);
 const w=dom.window;w.fetch=(u,o)=>fetch(new URL(u,base),o);w.HTMLElement.prototype.scrollIntoView=function(){};
 w.localStorage.setItem('qinghe-day2-v1',JSON.stringify(prior));if(saved)w.localStorage.setItem('qinghe-beginner-v1',saved);
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.document.addEventListener('click',e=>{if(e.target.closest('a[download]'))e.preventDefault();});
 for(const script of scripts)w.eval(fs.readFileSync(path.join(root,script),'utf8'));
 return w;
}
const until=async f=>{const end=Date.now()+10000;while(!f()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,20));}};
(async()=>{
 const w=create(),d=w.document,$=id=>d.getElementById(id),B=w.BeginnerStudy;
 await until(()=>w.Day2Study.sourceAvailable);
 assert.equal(B.lessons.length,12);assert.equal(new Set(B.lessons.map(l=>l.id)).size,12);
 assert.equal($('beginner-pane').hidden,false,'Old topic links must no longer confront a beginner with the whole project');
 assert.equal($('study-pane').hidden,true);assert.equal($('guide-content').querySelector('pre'),null,'No source listing on the first concept screen');
 assert.equal($('guide-title').textContent,'风扇为什么会转？');
 assert.deepEqual(JSON.parse(w.localStorage.getItem('qinghe-day2-v1'))[18],prior[18]);
 assert.equal($('progress').value,1,'Previous deep-study completion survives');

 const run=(action='run')=>d.querySelector(`[data-demo-action="${action}"]`).click();
 const input=(key,value)=>{const el=d.querySelector(`[data-param="${key}"]`);assert.ok(el);if(el.type==='checkbox')el.checked=value;else el.value=value;};
 const choose=(i)=>{const el=d.querySelector(`input[name="guide-answer"][value="${i}"]`);el.checked=true;el.dispatchEvent(new w.Event('change'));$('guide-quiz').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 B.select(0,3);choose(1);$('guide-reflection').value='输入到规则再到输出';$('guide-reflection').dispatchEvent(new w.Event('input'));assert.equal($('guide-complete').disabled,true,'A quiz alone cannot count as a completed experiment');
 B.select(0,1);input('temp',30);run();assert.equal(B.records.lessons.cause.demo.fan,1);
 input('temp',25);assert.equal(B.records.lessons.cause.demo.fan,1,'Editing an input does not execute the rule');run();assert.equal(B.records.lessons.cause.demo.fan,0);
 B.select(0,2);assert.equal(d.querySelectorAll('.guide-code .current').length,1);$('guide-code-next').click();assert.ok(d.querySelector('.guide-code .current').textContent.includes('fan = 1'));
 B.select(0,3);choose(0);assert.equal($('guide-complete').disabled,true);assert.ok($('guide-feedback').textContent.includes('两件事'));choose(1);assert.equal($('guide-complete').disabled,false);$('guide-complete').click();assert.equal(B.records.lessons.cause.done,true);assert.equal($('guide-progress').value,1);assert.ok($('guide-title').textContent.includes('C'));

 // The physical-path lesson must not interpret the select's string "0" as a true signal.
 B.select(2,1);input('signal',0);run();assert.equal(B.records.lessons['gpio-out'].demo.fan,0);
 input('signal',1);run();assert.equal(B.records.lessons['gpio-out'].demo.fan,1);input('wire',false);run();assert.equal(B.records.lessons['gpio-out'].demo.fan,0);assert.ok($('guide-demo-output').textContent.includes('高电平'));
 B.select(3,1);input('level','normal');input('wire',false);run();assert.equal(B.records.lessons['gpio-in'].demo.high,true,'Pull-up/disconnected can look like low water');

 // Semantic boundary checks: timing, PWM, quantization, pending IRQs and queue ownership.
 let s=B.initial('clock');B.act('clock',s);assert.equal(s.hz,1000000);s.params.psc=167;B.act('clock',s);assert.equal(s.hz,500000);
 s=B.initial('pwm');for(const duty of [0,25,100]){s.params.duty=duty;B.act('pwm',s);assert.equal(s.ccr,duty*10);}
 s=B.initial('adc');for(const [mv,code] of [[0,0],[1650,2048],[3300,4095]]){s.params.mv=mv;B.act('adc',s);assert.equal(s.adc,code);}
 s=B.initial('pulse');B.act('pulse',s);assert.equal(s.bit,0);s.params.width=46;B.act('pulse',s);assert.equal(s.bit,1);s.params.checksum=false;B.act('pulse',s);assert.ok(s.result['测量接受'].includes('拒绝'));
 s=B.initial('irq');s.params.enabled=false;B.act('irq',s,'event');B.act('irq',s);assert.equal(s.pending,true);assert.equal(s.handled,0);s.params.enabled=true;B.act('irq',s);assert.equal(s.handled,1);assert.equal(s.pending,false);
 s=B.initial('tasks');B.act('tasks',s);assert.equal(s.sample,25);assert.equal(s.fan,0);assert.equal(s.time,100);B.act('tasks',s,'sample');assert.equal(s.sample,30);assert.equal(s.fan,1);assert.equal(s.time,2000);
 s=B.initial('queue');B.act('queue',s);s.params.command=0;B.act('queue',s);B.act('queue',s);assert.equal(s.queue.length,2);assert.equal(s.fan,0);B.act('queue',s,'take');assert.equal(s.fan,1);B.act('queue',s,'take');assert.equal(s.fan,0);
 s=B.initial('chain');s.params.low=true;B.act('chain',s);assert.equal(s.demand,true);assert.equal(s.pin,null);B.act('chain',s);assert.equal(s.out,false);assert.equal(s.pin,null);B.act('chain',s);assert.equal(s.pin,false);

 for(let i=0;i<B.lessons.length;i++){
  const l=B.lessons[i];assert.ok(l.terms.length<=3&&l.terms.length>0);assert.ok(l.topics.every(t=>t>=17&&t<=64));
  B.select(i,0);assert.equal($('guide-content').querySelector('pre'),null);
  B.select(i,1);run();assert.ok($('guide-demo-output').querySelector('dl'));
  B.select(i,2);for(let n=1;n<l.code.length;n++)$('guide-code-next').click();assert.equal($('guide-code-next').disabled,true);
  B.select(i,3);choose(l.quiz.correct);$('guide-reflection').value='输入、处理与结果分别验证，我还要结合原项目继续练习。';$('guide-reflection').dispatchEvent(new w.Event('input'));assert.equal($('guide-complete').disabled,false);$('guide-complete').click();
 }
 assert.equal($('guide-progress').value,12);assert.equal($('study-pane').hidden,false);assert.match(w.location.search,/mode=deep&topic=17/);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('qinghe-day2-v1'))[18],prior[18]);
 const exported=w.localStorage.getItem('qinghe-beginner-v1');const w2=create('?mode=beginner',exported);await until(()=>w2.Day2Study.sourceAvailable);assert.equal(w2.document.getElementById('guide-progress').value,12);assert.match(w2.document.getElementById('guide-title').textContent,/你贴的代码/);
 $('deep-to-beginner').click();assert.equal($('beginner-pane').hidden,false);assert.equal($('guide-title').textContent,'风扇为什么会转？');$('tab-study').click();assert.equal($('study-pane').hidden,false);$('tab-interview').click();assert.ok(d.querySelectorAll('.question-card').length>=60);
 const w3=create('?mode=deep&topic=18');await until(()=>w3.Day2Study.sourceAvailable);assert.equal(w3.document.getElementById('study-pane').hidden,false);
 assert.deepEqual(errors,[]);console.log('PASS beginner-first entry, all 12 guided lessons, model boundaries, feedback, persistence, old records and deep-study handoff');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>windows.forEach(dom=>dom.window.close()));
