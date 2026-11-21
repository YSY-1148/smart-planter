const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{}};vm.createContext(env);
for(const f of ['question-bank.js','board-models.js','learning-models.js','circuit-hardware.js','circuit-model.js','circuit-guides.js','circuit-extra.js','curriculum-foundations.js','curriculum-systems.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'web',f),'utf8'),env);
const W=env.window,all=[...W.CurriculumFoundations,...W.CurriculumSystems],models=W.LearningModels.models;
assert.equal(all.length,150);assert.equal(new Set(all.map(c=>c.id)).size,150);
const covered=new Set();let anchors=0,steps=0;
for(const c of all){
 assert.ok(c.id>=1&&c.id<=150);assert.ok(c.principles.length>=3,c.id);assert.ok(c.steps.length>=2,c.id);assert.ok(c.quiz.q&&c.quiz.a);assert.ok(models[c.model],c.id+' model '+c.model);
 assert.ok(c.sources.every(s=>s&&/^https:\/\//.test(s.url)),c.id+' source links');
 assert.ok(!c.bench||W.CircuitModels.recipes[c.bench],c.id+' bench');
 if(!c.code.text){const src=fs.readFileSync(path.join(__dirname,'..',c.code.file),'utf8');assert.ok(src.includes(c.code.anchor),c.id+' source '+c.code.anchor);anchors++;}
 c.questions.forEach(q=>{assert.ok(q>=1&&q<=160);covered.add(q);});
 const m=models[c.model],options=Object.fromEntries(m.controls.map(x=>[x.key,x.value]));
 for(const [k,v] of Object.entries(c.preset||{})){assert.ok(k in options,c.id+' unknown preset '+k);const control=m.controls.find(x=>x.key===k);if(!control.type||control.type==='number')assert.ok(Number(v)>=control.min&&Number(v)<=control.max,c.id+' preset out of range '+k+'='+v);options[k]=control.type==='checkbox'||control.type==='select'?v:Number(v);}
 const frames=m.run(options);assert.ok(frames.length>0,c.id);
 for(const f of frames){assert.ok(f.caption?.length>0,c.id);for(const [k,v] of Object.entries(f.values||{}))if(typeof v==='number')assert.ok(Number.isFinite(v),c.id+' '+k);if(f.anchor){assert.ok(fs.readFileSync(path.join(__dirname,'..',f.file),'utf8').includes(f.anchor),c.id+' model anchor');}else assert.ok(f.line>=1&&f.line<=m.code.split('\n').length,c.id+' model line');steps++;}
}
for(const [id,m] of Object.entries(models))for(const side of ['min','max']){
 const options=Object.fromEntries(m.controls.map(c=>[c.key,c.type==='checkbox'?side==='max':c.type==='select'?c.options[side==='min'?0:c.options.length-1][0]:c[side]]));
 for(const f of m.run(options))for(const [key,v] of Object.entries(f.values||{}))if(typeof v==='number')assert.ok(Number.isFinite(v),id+' '+side+' '+key);
}
assert.equal(W.LearningModels.crc(Array.from('123456789',c=>c.charCodeAt(0))),0x29b1);
assert.equal(models.race.run({a:0,b:0}).at(-1).values.count,1);assert.equal(models.race.run({a:0,b:1}).at(-1).values.count,2);
assert.equal(models.adc.run({voltage:3.3,vref:3.3,bits:12})[1].values.ADC码,4095);
assert.equal(models.boot.run({a:2,b:1}).at(-1).values.启动,'A');assert.equal(models.boot.run({a:4,b:1}).at(-1).values.启动,'B');
console.log(JSON.stringify({topics:all.length,models:Object.keys(models).length,sourceAnchors:anchors,modelSteps:steps,interviewCoverage:covered.size,missingQuestions:Array.from({length:160},(_,i)=>i+1).filter(q=>!covered.has(q))}));
