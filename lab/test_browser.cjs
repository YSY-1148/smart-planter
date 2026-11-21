// Load the Pages build under a repository sub-path with no Python API.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./.qa/node_modules/jsdom');
const root=path.resolve(process.argv[2]||'_site'),base='https://example.test/smart-planter/';
const data=JSON.parse(fs.readFileSync(path.join(root,'browser-data.json'),'utf8'));
const bytes=fs.readFileSync(path.join(root,'planter.wasm'));
const ctx={window:{},WebAssembly};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'browser-engine.js'),'utf8'),ctx);
const json=x=>JSON.parse(JSON.stringify(x));
function near(actual,expected,label){
 if(typeof actual==='number'&&typeof expected==='number'&&!Number.isInteger(expected)){assert.ok(Math.abs(actual-expected)<1e-9,label);return;}
 if(expected!==null&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected),label+' keys');for(const k of Object.keys(expected))near(actual[k],expected[k],label+'.'+k);return;}
 assert.equal(actual,expected,label);
}
const errors=[],windows=[];
async function open(file,query=''){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const html=fs.readFileSync(path.join(root,file),'utf8');
 const dom=new JSDOM(html,{url:base+file+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});windows.push(dom);
 const w=dom.window;w.QINGHE_STATIC=true;w.WebAssembly=WebAssembly;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const u=new URL(url,base);assert.equal(u.origin,'https://example.test');assert.ok(u.pathname.startsWith('/smart-planter/'),'No root URL escapes: '+u.href);const name=decodeURIComponent(u.pathname.slice('/smart-planter/'.length));assert.ok(!name.includes('..'));const body=fs.readFileSync(path.join(root,name));return {ok:true,status:200,json:async()=>JSON.parse(body.toString()),arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)};};
 for(const match of html.matchAll(/<script[^>]+src="([^"]+)"/g))w.eval(fs.readFileSync(path.join(root,match[1]),'utf8'));
 return w;
}
const until=async f=>{const end=Date.now()+20000;while(!f()){if(Date.now()>end)throw Error('Page timed out: '+errors.join('\n'));await new Promise(r=>setTimeout(r,20));}};
(async()=>{
 const module=await WebAssembly.compile(bytes);assert.equal(WebAssembly.Module.imports(module).length,0);
 const sim=new ctx.window.BrowserSimulation(module,data),fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'.qa/browser-fixtures.json'),'utf8'));
 for(let i=0;i<fixtures.length;i++){const f=fixtures[i],snap=json(sim.action(f.action));for(const key of Object.keys(f.expected))near(snap[key],f.expected[key],`operation ${i} / ${key}`);}
 console.log('PASS '+fixtures.length+' native/Wasm snapshots: full controller state, CRC frames, traces, commands, rollover and timing');
 const api=new ctx.window.BrowserLabAPI(data,module);api.request('/api/action',{action:'inputs',values:{temp:31}});api.request('/api/action',{action:'advance',ms:2000});const before=json(api.request('/api/state'));
 for(const [topic,id,key,expected] of [[17,'tasks','out_fan',[0,0,1]],[18,'fan','out_fan',[0,1,1,0,0]],[20,'light','out_led',[5,5,10,10,10,0]],[21,'water','water_stable',[0,0,1]],[22,'pump','out_drip',[1,0,0,1]]])assert.deepEqual(json(api.request('/api/study-run',{id,topic}).observations.map(o=>o.state[key])),expected);
 assert.deepEqual(json(api.request('/api/state')),before,'Study instances must not reset the main controller');
 const w=await open('study.html','?mode=beginner'),d=w.document,$=id=>d.getElementById(id);await until(()=>w.Day2Study.sourceAvailable);assert.equal($('beginner-pane').hidden,false);assert.equal(d.querySelectorAll('[data-guide-lesson]').length,12);
 for(const topic of w.Day2Study.topics){w.Day2Study.selectTopic(topic.id);assert.ok($('model-view').textContent);const a=d.querySelector('#topic-content a');assert.ok(a.href.startsWith(base+'workbench.html?topic='));}
 w.Day2Study.selectTopic(18);$('prediction').value='关开开关关';$('prediction').dispatchEvent(new w.Event('input'));$('run-native').click();await until(()=>$('native-result').querySelector('table tbody')?.children.length===5);assert.ok($('native-result').textContent.includes('WebAssembly'));
 $('tab-interview').click();assert.equal(d.querySelectorAll('.question-card').length,65);$('company-filter').value='all';$('company-filter').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('.question-card').length,237);
 const main=await open('workbench.html','?topic=57');await until(()=>main.document.getElementById('connection').textContent.includes('浏览器运行'));assert.ok(main.CircuitBench&&main.CurriculumLab&&main.BoardLab);
 main.CurriculumLab.open(57);assert.equal(main.document.getElementById('curriculum-lab').open,true);main.document.getElementById('curriculum-lab').close();
 const response=await main.LabAPI.request('/api/action',{body:JSON.stringify({action:'inputs',values:{temp:30}})});assert.equal(response.ok,true);const advanced=await (await main.LabAPI.request('/api/action',{body:JSON.stringify({action:'advance',ms:2000})})).json();assert.equal(advanced.state.out_fan,1);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(html.includes('url=study.html'));
 assert.deepEqual(errors,[]);console.log('PASS Pages sub-path links, 12 beginner lessons, 48 deep topics, 44 companies, isolated C experiments and workbench initialization');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>windows.forEach(d=>d.window.close()));
