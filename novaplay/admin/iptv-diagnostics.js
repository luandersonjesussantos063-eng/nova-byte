(()=>{'use strict';
const GATEWAY='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
function safeId(url){try{const u=new URL(url);if(u.origin!==GATEWAY)return null;return /^\/live\/([0-9a-f-]{36})\/(?:index\.m3u8|stream\.ts)$/i.exec(u.pathname)?.[1]||null;}catch{return null;}}
async function inspect(url){
 const id=safeId(url);if(!id)throw Error('Selecione um canal publicado pelo gateway NPlay.');
 if(!globalThis.NPlayLiveAuth?.authorize)throw Error('Entre novamente no ADM para autorizar o diagnóstico.');
 const results=[];
 for(const [format,path] of [['HLS','index.m3u8'],['MPEG-TS','stream.ts']]){
  try{
   const authorized=await globalThis.NPlayLiveAuth.authorize(GATEWAY+'/live/'+id+'/'+path);
   const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
   try{
    const res=await fetch(authorized,{method:'HEAD',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl.signal});
    results.push({format,http:res.status,type:res.headers.get('content-type')||'não informado',error:res.headers.get('x-nplay-error')||null});
   }finally{clearTimeout(timer);}
  }catch(e){results.push({format,error:e.name==='AbortError'?'Tempo limite':'Falha de autorização ou conexão'});}
 }
 return results;
}
function attach(){
 const tab=document.querySelector('[data-admin-tab="canais"]');if(!tab)return;
 const root=document.createElement('section');root.style.cssText='border:1px solid #365075;border-radius:12px;padding:14px;margin:14px 0';
 const h=document.createElement('h3');h.textContent='Diagnóstico de reprodução IPTV';
 const p=document.createElement('p');p.textContent='Verifique HLS e MPEG-TS de um canal NPlay sem alterar o catálogo. Não cole URLs do fornecedor nem credenciais.';
 const input=document.createElement('input');input.type='url';input.placeholder='Cole o endereço NPlay /live/.../index.m3u8';input.style.width='100%';input.autocomplete='off';
 const btn=document.createElement('button');btn.type='button';btn.textContent='Testar formatos HLS e MPEG-TS';
 const out=document.createElement('pre');out.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
 btn.onclick=async()=>{btn.disabled=true;out.textContent='Consultando gateway…';try{const results=await inspect(input.value.trim());out.textContent=results.map(r=>r.format+': '+(r.http?'HTTP '+r.http:'sem resposta')+(r.type?' · '+r.type:'')+(r.error?' · '+r.error:'')).join('\n');}catch(e){out.textContent=e.message;}finally{btn.disabled=false;}};
 root.append(h,p,input,btn,out);
 const target=document.querySelector('#live-embed-url')?.closest('section')||document.querySelector('[data-admin-panel="canais"]')||tab.parentElement;
 target?.append(root);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();