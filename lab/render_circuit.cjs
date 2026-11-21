// Static SVG review, not a browser screenshot or browser layout test.
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('./.qa/node_modules/jsdom');
const {Resvg}=require('./.qa/node_modules/@resvg/resvg-js');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'web/index.html'),'utf8'),{url:'http://127.0.0.1:8766',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
w.BoardLab={stop(){},open(){}};
for(const f of ['planter-view.js','board-models.js','circuit-hardware.js','circuit-model.js','circuit-guides.js','circuit-extra.js','circuit-bench.js'])w.eval(fs.readFileSync(path.join(__dirname,'web',f),'utf8'));
const sources={};for(const f of ['stm32/src/board.c','stm32/src/app.c','esp32/src/main.cpp','common/planter.c','common/protocol.c'])sources[f]=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
w.CircuitBench.init({sources,getState:()=>({}),pause(){}});
const css=fs.readFileSync(path.join(__dirname,'web/circuit-bench.css'),'utf8');
function render(svg,id){
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  let s=svg.outerHTML.replace('>','><style>text{font-family:"Microsoft YaHei"}'+css+'</style>');
  const r=new Resvg(s,{font:{loadSystemFonts:true,defaultFontFamily:'Microsoft YaHei'},fitTo:{mode:'width',value:1470}});
  fs.writeFileSync(path.join(__dirname,'.qa','bench-'+id+'.png'),r.render().asPng());
}
for(const id of ['gpio','pwm','dht','i2c','uart','fan','pump','adc','spi','exti']){
  w.CircuitBench.open(id);$('bench-example').click();$('bench-next').click();$('bench-next').click();render($('bench-svg'),id);
}
$('bench-lessons').value='pwm';$('bench-lessons').dispatchEvent(new w.Event('change'));$('bench-example').click();
const combined=d.createElementNS('http://www.w3.org/2000/svg','svg');combined.setAttribute('viewBox','0 0 1310 790');
combined.innerHTML='<rect width="1310" height="790" fill="#f4f6eb"/>'+$('bench-svg').outerHTML.replace('<svg ','<svg x="0" y="0" width="980" height="790" ')+$('bench-grow-view').querySelector('svg').outerHTML.replace('<svg ','<svg x="985" y="140" width="310" height="400" ');render(combined,'planter-linked');
$('bench-package-open').click();render($('bench-package-drawing').querySelector('svg'),'package');
dom.window.close();console.log('Rendered 5 connected circuit SVGs and 100-pin package for visual review.');
