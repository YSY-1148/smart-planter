/* The local server and Pages share the same UI contract. No user data leaves Pages. */
(() => {
 'use strict';
 let ready;
 async function browserAPI(){
  if(!ready)ready=Promise.all([fetch(new URL('browser-data.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('课程资源加载失败');return r.json();}),fetch(new URL('planter.wasm',document.baseURI)).then(r=>{if(!r.ok)throw Error('控制核心加载失败');return r.arrayBuffer();})]).then(async([data,bytes])=>new window.BrowserLabAPI(data,await WebAssembly.compile(bytes)));
  return ready;
 }
 window.LabAPI={
  browser:!!window.QINGHE_STATIC,
  async request(path,options={}){
   if(!window.QINGHE_STATIC)return fetch(new URL(path.replace(/^\//,''),document.baseURI),options);
   try{const api=await browserAPI(),result=await api.request(path,options.body?JSON.parse(options.body):null);return {ok:true,status:200,json:async()=>result};}
   catch(error){return {ok:false,status:400,json:async()=>({error:error.message})};}
  }
 };
})();
