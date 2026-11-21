// DOM + live API integration tests. This is not a browser screenshot/layout test.
const {JSDOM,VirtualConsole}=require('./.qa/node_modules/jsdom');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=__dirname;
const base=process.env.LAB_TEST_URL||'http://127.0.0.1:8765';
const errors=[];const consoleBridge=new VirtualConsole();
consoleBridge.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'),{
  url:base,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:consoleBridge
});
const w=dom.window,d=w.document;
w.fetch=(url,options)=>fetch(new URL(url,base),options);
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const $=id=>d.getElementById(id);
async function until(test,label){
  const start=Date.now();
  while(!test()){
    if(Date.now()-start>6000)throw new Error('Timed out: '+label+'; visible error: '+$('error').textContent);
    await new Promise(resolve=>setTimeout(resolve,15));
  }
}
async function lesson(id){
  d.querySelector(`[data-lesson="${id}"]`).click();
  await until(()=>d.querySelector(`[data-lesson="${id}"]`).classList.contains('active')&&$('experiment-next').textContent.includes('第 1 步'),'lesson '+id);
}
function finishReplay(){
  for(let i=0;i<500;i++){
    const match=$('trace-position').textContent.match(/^(\d+) \/ (\d+)$/);
    if(match&&match[1]===match[2])return;
    $('next-line').click();
  }
  throw Error('replay never reaches final point');
}
async function experiment(){
  const before=$('experiment-next').textContent;
  $('experiment-next').click();
  await until(()=>$('experiment-next').textContent!==before,'experiment');
  finishReplay();
  assert.equal($('error').hidden,true,$('error').textContent);
}

(async()=>{
  await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lesson',id:'fan'})});
  w.eval(fs.readFileSync(path.join(root,'web/question-bank.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'web/planter-view.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'web/board-models.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'web/board-ui.js'),'utf8'));
  for(const file of ['circuit-hardware.js','circuit-model.js','circuit-guides.js','circuit-extra.js','circuit-bench.js'])w.eval(fs.readFileSync(path.join(root,'web',file),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'web/app.js'),'utf8'));
  await until(()=>$('connection').textContent.includes('已连接'),'initialization');
  assert.equal(d.querySelectorAll('[data-lesson]').length,12);
  assert.equal(d.querySelectorAll('.variable').length,52);
  assert.equal(w.LAB_QUESTIONS.length,160);
  assert.equal(new Set(w.LAB_QUESTIONS.map(q=>q.id)).size,160);
  assert.equal(w.LAB_QUESTIONS.filter(q=>q.source).length,80);

  for(const expected of ['关闭 · LOW','运行中 · HIGH','运行中 · HIGH','关闭 · LOW']){
    await experiment();assert.equal($('svg-fan').textContent,expected);
    assert.equal($('trace-kind').textContent,'引脚提交模型');
    assert.equal($('source-file').value,'stm32/src/app.c');
  }
  assert.equal($('experiment-next').disabled,true);
  console.log('PASS fan scenario + real trace + deferred GPIO commit');

  d.querySelector('[data-component="dht"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  assert.equal($('source-file').value,'stm32/src/board.c');
  assert.ok(d.querySelector('.code-row.active').textContent.includes('dht_read'));
  console.log('PASS component-to-source jump');

  await lesson('crc');
  await experiment();assert.ok($('ack').textContent.includes('ACK -1'));
  await experiment();assert.ok($('ack').textContent.includes('ACK 0'));assert.equal($('mode').textContent,'限时手动');
  await experiment();assert.ok($('ack').textContent.includes('ACK 1'));
  await experiment();assert.ok($('ack').textContent.includes('ACK 3'));
  d.querySelector('[data-tab="packet"]').click();
  assert.equal($('packet').hidden,false);assert.equal($('variables').hidden,true);
  assert.equal(d.querySelectorAll('#hex>span').length,74);
  $('command-frame').checked=true;$('command-frame').dispatchEvent(new w.Event('change'));
  console.log('PASS protocol CRC + duplicate + expiration + packet tab');

  await lesson('water');
  for(let step=0;step<3;step++)await experiment();
  $('experiment-next').click();
  await until(()=>$('experiment-next').textContent.includes('第 5 步'),'water timeout');
  let sawTimeout=false;
  for(let i=0;i<500;i++){
    if($('clock').textContent.startsWith('00:22.4')&&$('trace-kind').textContent==='引脚提交模型'){
      assert.equal(d.querySelectorAll('.output b')[4].textContent,'OFF');sawTimeout=true;
    }
    const position=$('trace-position').textContent.match(/^(\d+) \/ (\d+)$/);
    if(position&&position[1]===position[2])break;
    $('next-line').click();
  }
  assert.ok(sawTimeout,'intermediate timeout must be visible at its own timestamp');
  assert.ok($('clock').textContent.startsWith('00:23.4'));
  console.log('PASS long jump preserves timeout animation and its actual timestamp');

  await lesson('light');
  $('lux-number').value='500';$('lux-number').dispatchEvent(new w.Event('change'));
  await until(()=>$('svg-lux').textContent==='500 lx','input update');
  assert.equal($('mode').textContent,'自动控制');
  $('two-seconds').click();
  await until(()=>/^\d+ \/ \d+$/.test($('trace-position').textContent),'advance');finishReplay();
  assert.equal(d.querySelector('.output b').textContent,'5%');
  console.log('PASS manual sensor input + sample gating + PWM output');

  $('bank-open').click();assert.ok($('question-bank').hasAttribute('open'));
  $('bank-filter').value='DMA';$('bank-filter').dispatchEvent(new w.Event('input'));
  assert.ok(d.querySelectorAll('.bank-row').length>=3);
  $('bank-filter').value='154';$('bank-filter').dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.bank-row').length,1);
  d.querySelector('[data-reviewed="154"]').checked=true;
  d.querySelector('[data-reviewed="154"]').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(JSON.parse(w.localStorage.getItem('planter-reviewed'))['154'],true);
  d.querySelector('[data-related]').click();
  await until(()=>$('lesson-title').textContent.includes('水泵'),'related lesson navigation');
  assert.equal($('question-bank').hasAttribute('open'),false);
  console.log('PASS 160-question search + local progress + related course');

  $('board-open').click();assert.ok($('circuit-bench').hasAttribute('open'));
  assert.equal(d.querySelectorAll('#bench-ports [data-port^="P"]').length,100);
  assert.equal(d.querySelectorAll('[data-mini-pin]').length,100);
  assert.equal($('bench-wave1').getAttribute('d'),'');
  const pin=name=>w.CircuitHardware.headers.find(h=>h.name===name).id;
  function connect(a,b){for(const p of [a,b])d.querySelector(`[data-port="${p}"]`).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));}
  connect(pin('PD12'),'resistor.A');connect('resistor.B','led.A');connect('led.K',pin('GND'));
  connect('scope.CH1',pin('PD12'));
  assert.equal($('bench-wave1').getAttribute('d'),'','no ground reference = no trace');
  connect('scope.GND',pin('GND'));
  assert.ok($('bench-status').textContent.includes('5/5'));
  $('bench-next').click();assert.equal($('bench-led-body').getAttribute('fill'),'#ff4b51');
  assert.ok($('bench-code').querySelector('.active').textContent.includes('GPIO_PIN_SET'));
  assert.ok($('bench-wave1').getAttribute('d').length>100);
  $('bench-next').click();$('bench-next').click();assert.equal($('bench-led-body').getAttribute('fill'),'#6b2935');
  $('bench-package-open').click();assert.equal(d.querySelectorAll('[data-package-pin]').length,100);
  d.querySelector('[data-package-pin="PB6"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  assert.ok($('bench-pin-info').textContent.includes('P2.23'));assert.ok($('bench-pin-info').textContent.includes('92'));
  $('bench-package-close').click();
  for(const benchID of Object.keys(w.CircuitModels.recipes)){
    $('bench-lessons').value=benchID;$('bench-lessons').dispatchEvent(new w.Event('change'));
    $('bench-example').click();assert.ok($('bench-status').textContent.includes('可以运行'),benchID+' reference wiring');
    for(let i=0;i<60;i++){
      assert.ok($('bench-code').querySelector('.active'),benchID+' code anchor '+i);
      const before=$('bench-step-count').textContent;$('bench-next').click();if(before===$('bench-step-count').textContent)break;
    }
  }
  // Short a supply, confirm the physical signal stops, then undo the wrong wire.
  connect(pin('3V'),pin('GND'));assert.ok($('bench-status').classList.contains('fault'));
  assert.equal($('bench-wave1').getAttribute('d'),'');$('bench-undo').click();assert.equal($('bench-status').classList.contains('fault'),false);
  fs.writeFileSync(path.join(root,'.qa/circuit-preview.svg'),$('bench-svg').outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
  $('bench-lessons').value='gpio';$('bench-lessons').dispatchEvent(new w.Event('change'));
  $('bench-example').click();$('bench-play').click();
  await until(()=>$('bench-step-count').textContent!=='程序步骤 1 / 5','bench code follows');
  $('bench-play').click();const benchStopped=$('bench-step-count').textContent;
  await new Promise(resolve=>setTimeout(resolve,180));assert.equal($('bench-step-count').textContent,benchStopped);
  $('bench-theory').click();assert.ok($('chip-lab').hasAttribute('open'));$('bench-close').click();
  console.log('PASS manual wiring, scope reference, LED polarity, all 100 headers + package pins, 10 circuits, source steps, short and pause');
  assert.equal(d.querySelectorAll('[data-chip-module]').length,10);
  for(const id of Object.keys(w.BoardModels.modules)){
    d.querySelector(`[data-chip-module="${id}"]`).click();
    const max=Number($('chip-scrub').max);
    for(let i=0;i<=max;i++){
      $('chip-scrub').value=i;$('chip-scrub').dispatchEvent(new w.Event('input'));
      assert.ok($('chip-code').querySelector('.active'),'source follows '+id+' step '+i);
      assert.ok($('chip-code').querySelector('.current-block'),'function block '+id);
      assert.ok($('chip-explanation').textContent.length>10);
    }
  }
  d.querySelector('[data-chip-module="pwm"]').click();
  $('chip-option-duty').value='100';$('chip-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  $('chip-next').click();$('chip-next').click();
  assert.ok($('chip-values').textContent.includes('HIGH'));
  assert.ok($('chip-function').textContent.includes('board_init'));
  d.querySelector('[data-chip-module="dma"]').click();
  $('chip-option-count').value='512';$('chip-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  $('chip-scrub').value=$('chip-scrub').max;$('chip-scrub').dispatchEvent(new w.Event('input'));
  assert.ok($('chip-explanation').textContent.includes('返回 false'));
  assert.ok($('chip-function').textContent.includes('board_uart_read'));
  $('chip-close').click();assert.equal($('chip-lab').hasAttribute('open'),false);
  console.log('PASS 10 chip modules + all source steps + parameter changes + code following');
  $('bank-open').click();$('bank-filter').value='95';$('bank-filter').dispatchEvent(new w.Event('input'));
  d.querySelector('[data-chip-related="dma"]').click();
  assert.ok($('circuit-bench').hasAttribute('open'));assert.equal($('question-bank').hasAttribute('open'),false);
  assert.ok($('bench-title').textContent.includes('DMA'));$('bench-close').click();
  console.log('PASS interview question to peripheral model navigation');

  await lesson('fan');
  $('speed').value='1';$('run').click();
  await until(()=>$('run-state').textContent.includes('同步慢放'),'continuous code following');
  const startPosition=$('trace-position').textContent;
  await until(()=>$('trace-position').textContent!==startPosition,'continuous source pointer moves');
  assert.ok(d.querySelector('#code .active'));
  $('run').click();const stopped=$('trace-position').textContent;
  await new Promise(resolve=>setTimeout(resolve,240));
  assert.equal($('trace-position').textContent,stopped,'pause stops source pointer');
  console.log('PASS continuous execution follows source, and pause stops playback');
  assert.deepEqual(errors,[]);
  console.log('PASS no DOM runtime errors');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  dom.window.close();
  await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lesson',id:'fan'})});
});
