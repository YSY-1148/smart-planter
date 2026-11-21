/* Simulation clock / UI adapter. All control decisions, CRC and frames run in C Wasm. */
(() => {
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const roundEven=x=>{const n=Math.floor(x),f=x-n;return f===.5?(n%2?n+1:n):Math.round(x);};
 class Native {
  constructor(module,data){this.data=data;this.e=new WebAssembly.Instance(module,{}).exports;this.ptr=this.e.lab_buffer();}
  view(){return new DataView(this.e.memory.buffer);}
  readState(){const v=this.view();return Object.fromEntries(this.data.fields.map((key,i)=>[key,Number(v.getBigInt64(this.ptr+i*8,true))]));}
  state(){if(this.e.lab_state(this.ptr)!==this.data.fields.length)throw Error('控制核心字段版本不匹配');return this.readState();}
  traces(){const a=[];for(let i=0;i<this.e.lab_trace_size();i++){const line=this.e.lab_trace_at(i,this.ptr);a.push({file:'common/planter.c',line,state:this.readState()});}return a;}
  frame(command=false){this.e.lab_frame(this.ptr,Number(command));return Array.from(new Uint8Array(this.e.memory.buffer,this.ptr,74));}
  layout(){this.e.lab_layout(this.ptr);const v=this.view();return Array.from({length:6},(_,i)=>v.getInt32(this.ptr+i*4,true));}
  command(op,args,seq,boot,ttl,received,now,corrupt){const v=this.view();args.forEach((a,i)=>v.setInt32(this.ptr+i*4,a,true));return this.e.lab_command(op,this.ptr,seq,boot,ttl,received,now,Number(corrupt));}
 }
 class Simulation {
  constructor(module,data){this.module=module;this.data=data;this.native=new Native(module,data);this.lesson=data.lessons[0];this.reset();}
  reset(start=0){this.now=start>>>0;this.elapsed=0;this.sequence=0;this.sample_number=0;this.inputs={temp:25,rh:60,lux:10000,low:false,dht:true,light:true,water_valid:true,sampling:true,network:true,physics:false};this.last_sample_elapsed=-2000;this.step_index=0;this.events=[];this.trace=[];this.last_command=null;this.native.e.lab_reset(20261114,this.now);this.tick(0);this.addEvent('实验复位；控制核心已初始化');}
  addEvent(text){this.events.push({at:this.elapsed,now:this.now,text});this.events=this.events.slice(-100);}
  alarms(state){return this.data.alarms.filter(([bit])=>state.alarms&bit).map(([,name])=>name);}
  pins(state){return Object.fromEntries(['out_led','out_fan','out_drip','out_mist','out_refill'].map(k=>[k,state[k]]));}
  tick(dt){
   const before=this.native.state();this.elapsed+=dt;this.now=(this.now+dt)>>>0;
   if(this.inputs.physics&&dt){const sec=dt/1000;this.inputs.temp=Math.max(0,Math.min(50,this.inputs.temp+(.02-.1*before.out_fan)*sec));this.inputs.rh=Math.max(0,Math.min(100,this.inputs.rh+(-.03+.2*before.out_drip+.6*before.out_mist)*sec));}
   this.native.e.lab_trace_clear();
   if(this.inputs.sampling&&this.elapsed-this.last_sample_elapsed>=2000){this.sample_number++;this.last_sample_elapsed=this.elapsed;const valid=Number(this.inputs.dht)|(Number(this.inputs.light)<<1);this.native.e.lab_sample(this.now,this.sample_number,roundEven(this.inputs.temp*10),roundEven(this.inputs.rh*10),roundEven(this.inputs.lux),valid);}
   this.native.e.lab_step(this.now,Number(this.inputs.low),Number(this.inputs.water_valid));
   const after=this.native.state(),pins=this.pins(before),inputs={...this.inputs};
   this.trace=this.native.traces().map(p=>({...p,pins,kind:'native',elapsed:this.elapsed,inputs}));
   this.trace.push({file:'stm32/src/app.c',line:this.data.commit_line,state:after,pins:this.pins(after),kind:'gpio_model',elapsed:this.elapsed,inputs});
   for(const [key,name] of Object.entries({out_fan:'风扇',out_drip:'滴灌泵',out_mist:'喷雾泵',out_refill:'补液泵',out_led:'补光 PWM',manual:'手动模式',refill_fault:'补液故障锁存'}))if(before[key]!==after[key])this.addEvent(`${name}: ${before[key]} → ${after[key]}`);
   if(before.alarms!==after.alarms)this.addEvent('告警: '+(this.alarms(after).join('、')||'无'));
  }
  advance(ms){
   ms=Number(ms);if(!Number.isInteger(ms)||ms<0||ms>120000||ms%100)throw Error('推进时间必须是 0–120000 范围内的 100 ms 整数倍');
   const keys=['out_led','out_fan','out_drip','out_mist','out_refill','manual','alarms','refill_fault','water_raw','water_stable','fan_demand','humidity_demand','sample_temp10','sample_humidity10','sample_lux','sample_valid'];
   const recorded=[];let previous=this.native.state();
   for(let i=0;i<ms/100;i++){this.tick(100);const state=this.native.state();if(i===ms/100-1||keys.some(k=>previous[k]!==state[k]))recorded.push(...this.trace);previous=state;}
   if(recorded.length)this.trace=recorded;
  }
  setInputs(values){for(const [key,raw] of Object.entries(values)){
   if(!(key in this.inputs))throw Error('未知输入 '+key);let v=raw;
   if(['temp','rh','lux'].includes(key)){v=Number(v);const [lo,hi]={temp:[-20,60],rh:[0,100],lux:[0,60000]}[key];if(!Number.isFinite(v)||v<lo||v>hi)throw Error('输入越界 '+key);}
   else if(typeof v!=='boolean')throw Error('开关参数必须为布尔值');this.inputs[key]=v;
  }}
  command(data){
   const before=this.native.state(),op=Number(data.op??3),raw=data.args??[];
   if(!Array.isArray(raw)||raw.length>6)throw Error('最多 6 个参数');
   const args=[...raw.map(Number),...Array(6-raw.length).fill(0)];if(args.some(v=>!Number.isInteger(v)||v<-(2**31)||v>=2**31))throw Error('参数超出 int32_t');
   if(!data.duplicate)this.sequence++;
   const ttl=Number(data.ttl??10000),age=Number(data.age??0),boot=Number(data.boot??20261114);
   if(![op,ttl,age,boot].every(Number.isInteger)||ttl<-(2**31)||ttl>2**31-1||age<0||age>120000||boot<0||boot>0xffffffff)throw Error('时间或启动编号越界');
   this.native.e.lab_trace_clear();const code=this.native.command(op,args,this.sequence,boot,ttl,(this.now-age)>>>0,this.now,!!data.corrupt);
   this.trace=this.native.traces().map(p=>({...p,pins:this.pins(before),kind:'native',elapsed:this.elapsed,inputs:{...this.inputs}}));
   this.last_command={op,args,seq:this.sequence,code,text:this.data.acks[code]??String(code),frame:this.native.frame(true)};
   this.addEvent(`指令 #${this.sequence} / 操作 ${op}: ${this.last_command.text}`);return code;
  }
  nextExperiment(){if(this.step_index>=this.lesson.steps.length)return;const [label,a]=this.lesson.steps[this.step_index];this.addEvent('实验步骤: '+label);if(a.inputs)this.setInputs(a.inputs);if('ms_before' in a)this.advance(a.ms_before);let trace=[];if(a.command){this.command(a.command);trace=[...this.trace];}this.advance(a.ms??100);if(trace.length)this.trace=[...trace,...this.trace];this.step_index++;}
  snapshot(){const state=this.native.state();return copy({state,inputs:this.inputs,elapsed:this.elapsed,events:this.events,trace:this.trace,lesson:this.lesson.id,step_index:this.step_index,command:this.last_command,frame:this.native.frame(),layout:this.native.layout(),alarms:this.alarms(state)});}
  action(data){switch(data.action){
   case 'reset':this.reset(this.lesson.start??0);break;
   case 'lesson':{const found=this.data.lessons.find(l=>l.id===data.id);if(!found)throw Error('未知课程');this.lesson=found;this.reset(found.start??0);break;}
   case 'inputs':this.setInputs(data.values??{});break;
   case 'advance':this.advance(data.ms??100);break;
   case 'command':{this.command(data);const trace=[...this.trace];this.advance(100);this.trace=[...trace,...this.trace];break;}
   case 'experiment':this.nextExperiment();break;
   default:throw Error('未知操作');
  }return this.snapshot();}
 }
 class BrowserLabAPI {
  constructor(data,module){this.data=data;this.module=module;this.sim=new Simulation(module,data);}
  request(path,payload){
   if(path==='/api/init')return {...this.sim.snapshot(),lessons:this.data.lessons,sources:this.data.sources};
   if(path==='/api/state')return this.sim.snapshot();
   if(path==='/api/action')return this.sim.action(payload);
   if(path==='/api/study-run'){
    const lesson=this.data.lessons.find(l=>l.id===payload.id);if(!lesson)throw Error('未知实验');
    const topic=payload.topic??0;if(!Number.isInteger(topic)||topic<0||topic>150)throw Error('专题编号无效');
    const sim=new Simulation(this.module,this.data);sim.action({action:'lesson',id:lesson.id});const observations=[],custom=this.data.topic_steps[topic];
    for(const [label,a] of custom??lesson.steps){
     if(custom){if(a.reset)sim.reset(0);if(a.inputs)sim.setInputs(a.inputs);sim.advance(a.ms??100);}else sim.nextExperiment();
     const snap=sim.snapshot();observations.push({label,elapsed:snap.elapsed,state:snap.state,inputs:snap.inputs,alarms:snap.alarms,command:snap.command});
    }
    return {id:lesson.id,title:custom?`专题 ${topic} 边界验证`:lesson.title,observations,evidence:'原项目 C 控制代码 / WebAssembly / 独立实例 / 模拟输入与时间；不是硬件实测'};
   }
   throw Error('未知实验接口');
  }
 }
 window.BrowserLabAPI=BrowserLabAPI;window.BrowserSimulation=Simulation;
})();
