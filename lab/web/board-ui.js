(() => {
  'use strict';
  const $=id=>document.getElementById(id),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {modules,refs,hex}=window.BoardModels;
  let context=null,current='structure',frames=[],index=0,timer=null;
  const edges={structure:[[0,1],[0,2],[3,2],[3,4],[2,4],[4,5]],gpio:[[0,1],[1,2],[2,3],[5,3],[3,4],[4,0]],pwm:[[0,1],[1,2],[2,3],[3,4],[4,5]],i2c:[[0,1],[1,2],[2,3],[3,4],[4,5]],dht:[[0,1],[1,2],[2,3],[3,4],[4,5]],uart:[[0,1],[1,2],[3,2],[2,4],[4,5]],dma:[[0,1],[1,2],[1,3],[2,4],[3,4],[4,5]],queue:[[0,1],[1,2],[3,4],[4,2],[2,5],[3,5]],irq:[[0,1],[1,2],[2,3],[3,4]]};
  edges.watchdog=[[0,1],[1,2],[4,3],[3,2],[2,5]];
  function stop(){clearTimeout(timer);timer=null;$('chip-play').textContent='▶ 演示芯片步骤';}
  function options(){
    const o={};for(const control of modules[current].controls){const input=$('chip-option-'+control.key);o[control.key]=control.type==='checkbox'?input.checked:control.type==='number'?Number(input.value):input.value;}return o;
  }
  function buildOptions(){
    $('chip-options').innerHTML=modules[current].controls.map(c=>c.type==='checkbox'?`<label class="chip-check"><input id="chip-option-${c.key}" type="checkbox" ${c.value?'checked':''}>${esc(c.label)}</label>`:c.type==='select'?`<label>${esc(c.label)}<select id="chip-option-${c.key}">${c.options.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(c.value)?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:`<label>${esc(c.label)}<input id="chip-option-${c.key}" type="number" min="${c.min}" max="${c.max}" step="1" required value="${c.value}"></label>`).join('');
    $('chip-rebuild').hidden=!modules[current].controls.length;
    $('chip-use-led').hidden=current!=='pwm';
  }
  function rebuild(){
    if(!$('chip-form').reportValidity())return;
    stop();frames=modules[current].make(options());index=0;$('chip-scrub').max=frames.length-1;render();
  }
  function select(id){
    if(!modules[id])return;stop();current=id;
    $('chip-title').textContent=modules[id].title;$('chip-principle').textContent=modules[id].principle;
    document.querySelectorAll('[data-chip-module]').forEach(b=>b.classList.toggle('active',b.dataset.chipModule===id));
    buildOptions();
    $('chip-questions').innerHTML=modules[id].qs.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
    $('chip-references').innerHTML='程序依据：本项目原始源码。'+modules[id].refs.map(key=>`<a href="${refs[key][1]}" target="_blank" rel="noopener noreferrer">${esc(refs[key][0])} ↗</a>`).join('');
    rebuild();
  }
  function diagram(frame){
    const nodes=modules[current].nodes,positions=nodes.map((_,i)=>({x:36+(i%3)*252,y:49+Math.floor(i/3)*107}));
    const paths=(edges[current]||[]).map(([a,b])=>{
      const p=positions[a],q=positions[b],active=frame.active.includes(nodes[a][0])&&frame.active.includes(nodes[b][0]);
      return `<path class="chip-link ${active?'active':''}" d="M${p.x+105} ${p.y+35} L${q.x+105} ${q.y+35}"/>`;
    }).join('');
    const blocks=nodes.map(([id,name,description],i)=>{const p=positions[i];return `<g class="chip-node ${frame.active.includes(id)?'active':''}" tabindex="0" role="button" aria-label="查看${esc(name)}参与的步骤" data-chip-node="${id}"><rect x="${p.x}" y="${p.y}" width="210" height="70" rx="8"/><text x="${p.x+12}" y="${p.y+27}" class="chip-node-title">${esc(name)}</text><text x="${p.x+12}" y="${p.y+49}" class="chip-node-caption">${esc(description)}</text></g>`;}).join('');
    $('chip-diagram').innerHTML=`<svg viewBox="0 0 790 260" role="img" aria-label="${esc(modules[current].title)}的功能结构"><rect x="8" y="8" width="774" height="244" rx="15" class="chip-package"/><text x="29" y="31" class="chip-package-title">STM32F407 · ${esc(modules[current].tags)} · 功能结构示意</text>${paths}${blocks}</svg>`;
  }
  function wave(frame){
    if(!frame.wave?.length){$('chip-wave').innerHTML='<div class="chip-wave-empty">当前步骤观察内部状态与数据流。出现引脚信号的步骤会在这里展开波形。</div>';return;}
    const tracks=frame.wave.map((row,r)=>{
      const total=row.segments.reduce((sum,s)=>sum+s.duration,0),top=25+r*80,low=top+33;let x=106,path='';
      row.segments.forEach((s,i)=>{const y=s.level?top:low,width=s.duration/total*650;path+=`${i?'V':'M'}${i?y:x+' '+y} H${x+width} `;x+=width;});
      return `<text x="10" y="${top+18}">${esc(row.name)}</text><text x="84" y="${top+4}">1</text><text x="84" y="${low+4}">0</text><line x1="106" y1="${low}" x2="756" y2="${low}" class="wave-guide"/><path d="${path}" class="wave-trace"/>`;
    }).join('');
    const height=frame.wave.length*80+5,x=106+(frame.marker||0)*650;
    $('chip-wave').innerHTML=`<svg viewBox="0 0 790 ${height}" role="img" aria-label="数字波形示意"><path d="M${x} 9V${height-8}" class="wave-cursor"/>${tracks}</svg><small>数字信号教学模型 · 不模拟上升时间、噪声、抖动或真实 MCU 时序</small>`;
  }
  function renderCode(frame){
    const source=context.sources[frame.file],lines=source.split('\n'),line=lines.findIndex(s=>s.includes(frame.anchor));
    if(line<0)throw Error('Missing source anchor: '+frame.anchor);
    let functionLine=0,name='初始化 / 配置';
    for(let n=0;n<=line;n++){const match=lines[n].match(/^(?:static\s+)?(?:void|bool|int|uint32_t)\s+(\w+)\s*\([^;]*\)\s*\{/);if(match){functionLine=n;name=match[1]+'()';}}
    let balance=0,blockEnd=functionLine;
    for(let n=functionLine;n<lines.length;n++){balance+=(lines[n].match(/\{/g)||[]).length-(lines[n].match(/\}/g)||[]).length;blockEnd=n;if(balance===0)break;}
    $('chip-source').textContent=frame.file;$('chip-function').textContent=name+' · L'+(line+1);
    $('chip-code').innerHTML=lines.map((text,n)=>`<div class="code-row ${n>=functionLine&&n<=blockEnd?'current-block':''} ${n===line?'active':''}" data-chip-line="${n}"><span class="line-number">${n+1}</span><code class="code-text">${esc(text)}</code></div>`).join('');
    if($('chip-follow').checked){const container=$('chip-code'),row=container.querySelector('.active');container.scrollTop=Math.max(0,row.offsetTop-container.offsetTop-container.clientHeight*.4);}
  }
  function render(){
    const f=frames[index];if(!f)return;
    diagram(f);wave(f);renderCode(f);
    $('chip-explanation').textContent=f.caption;
    $('chip-values').innerHTML=Object.entries(f.values).map(([key,value])=>`<div><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
    $('chip-memory').innerHTML=f.cells?`<p>只显示写指针附近 16 格；真实模型容量 512 字节。W 是下一个写入位置，R 是下一个读取位置。</p><div class="chip-cells">${f.cells.map(c=>`<div class="${c.write?'write':''} ${c.read?'read':''}"><small>[${c.index}] ${c.write?'W':''}${c.read?'R':''}</small><b>${c.value===null?'—':hex(c.value)}</b></div>`).join('')}</div>`:f.slots?`<div class="chip-cells">${f.slots.map((v,i)=>`<div><small>槽 ${i}</small><b>${esc(v)}</b></div>`).join('')}</div>`:f.bytes?`<div class="chip-bytes">${f.bytes.map((v,i)=>`<span class="${i===f.activeByte?'active':''}"><small>byte ${i}</small>${hex(v)}</span>`).join('')}</div>`:'';
    $('chip-step-label').textContent=`${index+1} / ${frames.length}`;$('chip-scrub').value=index;
    $('chip-back').disabled=index===0;$('chip-next').disabled=index===frames.length-1;
  }
  function play(){
    if(timer){stop();return;}
    if(index===frames.length-1)index=0;
    $('chip-play').textContent='Ⅱ 暂停芯片演示';render();
    const tick=()=>{if(index>=frames.length-1){stop();return;}index++;render();if(index===frames.length-1)stop();else timer=setTimeout(tick,800/Number($('chip-speed').value));};
    timer=setTimeout(tick,800/Number($('chip-speed').value));
  }
  function open(id='structure'){
    if(!context)return;context.pause();select(id);if(!$('chip-lab').open)$('chip-lab').showModal();
  }
  function init(value){
    context=value;
    $('chip-tabs').innerHTML=Object.entries(modules).map(([id,m])=>`<button data-chip-module="${id}">${esc(m.title)}</button>`).join('');
    $('chip-tabs').onclick=e=>{const b=e.target.closest('[data-chip-module]');if(b)select(b.dataset.chipModule);};
    $('chip-form').onsubmit=e=>{e.preventDefault();rebuild();};
    $('chip-close').onclick=()=>{stop();$('chip-lab').close();};$('chip-lab').addEventListener('close',stop);
    $('chip-play').onclick=play;$('chip-back').onclick=()=>{stop();index=Math.max(0,index-1);render();};$('chip-next').onclick=()=>{stop();index=Math.min(frames.length-1,index+1);render();};
    $('chip-reset').onclick=()=>{stop();index=0;render();};
    $('chip-scrub').oninput=()=>{stop();index=Number($('chip-scrub').value);render();};
    $('chip-use-led').onclick=()=>{$('chip-option-duty').value=context.getState().state.out_led;rebuild();};
    const jump=e=>{const node=e.target.closest('[data-chip-node]');if(node){stop();const found=frames.findIndex(f=>f.active.includes(node.dataset.chipNode));index=Math.max(0,found);render();}};
    $('chip-diagram').onclick=jump;$('chip-diagram').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(e);}};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    $('board-open').onclick=()=>open();
    $('component-lab').onclick=()=>open($('component-lab').dataset.chip);
  }
  window.BoardLab={init,open,stop};
})();
