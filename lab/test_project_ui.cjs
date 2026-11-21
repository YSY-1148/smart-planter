// New teaching experience integration. Uses an isolated server, never the user's live 8765 state.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./.qa/node_modules/jsdom');
const base=process.env.LAB_TEST_URL||'http://127.0.0.1:8766',errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'web/index.html'),'utf8'),{url:base,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.fetch=(u,o)=>fetch(new URL(u,base),o);
const until=async test=>{const t=Date.now();while(!test()){if(Date.now()-t>18000)throw Error('Timeout '+$('bench-project-note').textContent);await new Promise(r=>setTimeout(r,30));}};
(async()=>{
 for(const f of ['planter-view.js','question-bank.js','board-models.js','board-ui.js','circuit-hardware.js','circuit-model.js','circuit-guides.js','circuit-extra.js','circuit-bench.js','learning-models.js','curriculum-foundations.js','curriculum-systems.js','curriculum-ui.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'web',f),'utf8'));
 await until(()=>$('connection').textContent.includes('已连接'));
 await w.fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lesson',id:'fan'})});
 w.CircuitBench.open('fan');$('bench-clear').click();
 for(let i=0;i<8;i++){$('bench-start-wire').click();assert.ok($('bench-wire-from').value);assert.ok($('bench-wire-to').value);$('bench-connect-wire').click();}
 assert.ok($('bench-status').textContent.includes('8/8'));
 $('bench-env-temp').value=29;$('bench-project-run').click();await until(()=>$('bench-project-note').textContent.includes('原 C 输出已更新'));
 assert.ok($('bench-grow-fan').classList.contains('spinning'),'C high temperature + correct driver = fan turns');
 assert.ok($('bench-code-file').textContent.includes('stm32/src/app.c'),'native GPIO commit is visible');
 const gate=d.querySelector('#bench-wire-list [data-delete-wire="0"]');gate.click();
 assert.equal($('bench-grow-fan').classList.contains('spinning'),false,'disconnect driver stops physical actuator despite C demand');
 $('bench-start-wire').click();$('bench-connect-wire').click();assert.ok($('bench-grow-fan').classList.contains('spinning'));
 $('bench-env-temp').value=25;$('bench-project-run').click();await until(()=>$('bench-project-note').textContent.includes('原 C 输出已更新')&&!$('bench-project-run').disabled);
 assert.equal($('bench-grow-fan').classList.contains('spinning'),false);
 $('bench-close').click();console.log('PASS guided endpoint wiring + native C hysteresis + physical driver gating + source replay');
 $('curriculum-open').click();assert.equal(d.querySelectorAll('[data-topic]').length,150);assert.ok($('curriculum-lab').open);
 for(const c of w.CurriculumLab.courses){
   w.CurriculumLab.open(c.id);assert.ok($('learn-title').textContent.includes(c.title));assert.ok($('learn-code').querySelector('.active'),c.id+' initial model code');
   assert.equal(d.querySelectorAll('#learn-principles>p').length,c.principles.length);
   for(let i=0;i<60;i++){const before=$('learn-position').textContent;$('learn-next-step').click();assert.ok($('learn-code').querySelector('.active'),c.id+' model step');if(before===$('learn-position').textContent)break;}
 }
 w.CurriculumLab.open(3);$('learn-done').checked=true;$('learn-done').dispatchEvent(new w.Event('change'));assert.equal(JSON.parse(w.localStorage.getItem('planter-course-progress'))[3],true);
 const wireCourse=w.CurriculumLab.courses.find(c=>c.bench==='adc');w.CurriculumLab.open(wireCourse.id);$('learn-wire').click();assert.equal($('bench-lessons').value,'adc');assert.ok($('circuit-bench').open);$('bench-example').click();$('bench-next').click();assert.ok($('bench-values').textContent.includes('2048'));
 assert.deepEqual(errors,[]);console.log('PASS 150 course contents + every model step/code pointer + progress persistence + course-to-ADC circuit');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>dom.window.close());
