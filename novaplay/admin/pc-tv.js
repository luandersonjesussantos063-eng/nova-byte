(()=>{
 function parseConnection(text){
  if(typeof text!=='string'||text.length>4096)throw Error('Escolha o arquivo CONEXAO-ADM.txt gerado pela TV-PC.');
  text=text.replace(/^\uFEFF/,'');
  const url=text.match(/^ENDERECO DO PC:[ \t]*(https:\/\/[-a-z0-9]+\.trycloudflare\.com\/?)[ \t]*\r?$/m)?.[1];
  const secret=text.match(/^CHAVE DO PC:[ \t]*([a-f0-9]{64})[ \t]*\r?$/m)?.[1];
  if(!url||!secret)throw Error('O arquivo não contém o endereço e a chave da TV-PC. Escolha CONEXAO-ADM.txt.');
  return {url,secret};
 }
 window.NPlayPCConnection=Object.freeze({parse:parseConnection});
 const gateway='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
 let pending=false,importedConnection=null;
 async function setup(){
  const host=document.getElementById('live-pc-tv');if(!host)return;
  host.innerHTML=`<h3>TV pelo PC</h3><p>Inicie a TV-PC no computador com Docker. Cole os dois campos do arquivo CONEXAO-ADM.txt. A lista inteira usa essa conexão; o PC recebe apenas os canais que estiverem sendo assistidos.</p><label>Endereço do PC<input id="pc-tv-url" type="url" placeholder="https://seu-endereco.trycloudflare.com" autocomplete="off"></label><label>Chave do PC<input id="pc-tv-key" type="password" maxlength="64" autocomplete="off"></label><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button id="pc-tv-connect" class="outline" type="button">Conectar PC</button><button id="pc-tv-publish" class="primary" type="button">Conectar e liberar toda a lista HLS</button><button id="pc-tv-disconnect" class="outline" type="button">Desconectar PC</button></div><p class="muted">Liberar toda a lista coloca também os canais ainda sem teste na grade. Mantenha PC e Docker ligados. Se o endereço mudar após reiniciar, conecte novamente.</p><p id="pc-tv-status" role="status" aria-live="polite"></p>`;
  const $=id=>document.getElementById(id);
  const picker=document.createElement('label');picker.className='outline';picker.style.cssText='display:block;margin:12px 0;padding:12px;border:1px solid #365075;border-radius:8px';picker.textContent='Carregar CONEXAO-ADM.txt do PC';
  const file=document.createElement('input');file.type='file';file.accept='.txt,text/plain';file.style.cssText='display:block;margin-top:8px';picker.append(file);host.insertBefore(picker,$('pc-tv-url').closest('label'));
  $('pc-tv-key').autocomplete='new-password';$('pc-tv-key').setAttribute('data-lpignore','true');$('pc-tv-key').setAttribute('data-1p-ignore','true');
  file.onchange=async()=>{
   const selected=file.files?.[0];if(!selected)return;
   try{
    if(pending)throw Error('Aguarde a conexão atual terminar.');
    if(selected.size>4096)throw Error('Escolha o arquivo CONEXAO-ADM.txt gerado pela TV-PC.');
    importedConnection=parseConnection(await selected.text());
    $('pc-tv-url').value=importedConnection.url;$('pc-tv-key').value=importedConnection.secret;
    $('pc-tv-status').textContent='Arquivo carregado. Clique em Conectar e liberar toda a lista HLS.';
   }catch(error){importedConnection=null;$('pc-tv-status').textContent=error.message;}
   finally{file.value='';}
  };
  for(const id of ['pc-tv-url','pc-tv-key'])$(id).addEventListener('input',()=>{importedConnection=null;});
  async function connect({publish=false,disconnect=false}={}){
   if(pending)return;pending=true;for(const id of ['pc-tv-connect','pc-tv-publish','pc-tv-disconnect'])$(id).disabled=true;
   const status=$('pc-tv-status');status.textContent=disconnect?'Desconectando PC…':'Conferindo a conexão do PC…';
   try{
    const db=window.NPlayLiveAdminClient;if(!db)throw Error('Reabra o ADM para carregar sua sessão.');
    let session=(await db.auth.getSession())?.data?.session;
    if(session?.expires_at*1000<Date.now()+60000)session=(await db.auth.refreshSession())?.data?.session;
    if(!session?.access_token)throw Error('Entre novamente no ADM.');
    const connection=importedConnection||{url:$('pc-tv-url').value.trim(),secret:$('pc-tv-key').value.trim()};
    const response=await fetch(gateway+'/admin/pc-bridge',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(disconnect?{enabled:false}:connection),signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível conectar o PC.');
    $('pc-tv-key').value='';importedConnection=null;
    if(disconnect){status.textContent='PC desconectado. Os canais e o histórico foram preservados.';return;}
    if(!publish){status.textContent='PC conectado. Teste um canal ou conecte novamente para liberar a lista inteira.';return;}
    const prefix=gateway+'/live/';let channels=[];
    for(let offset=0;;offset+=500){const {data,error}=await db.from('novaplay_live_embeds').select('id,embed_url').like('embed_url',prefix+'%/index.m3u8').order('id').range(offset,offset+499);if(error)throw error;channels.push(...(data||[]));if(!data||data.length<500)break;}
    let done=0;
    for(let offset=0;offset<channels.length;offset+=200){
     const {data,error}=await db.from('novaplay_live_embeds').update({is_published:true,rights_confirmed:true}).in('id',channels.slice(offset,offset+200).map(x=>x.id)).select('id');
     if(error)throw Error('PC conectado; '+done+' canais liberados. '+error.message);
     done+=(data||[]).length;status.textContent='PC conectado · '+done+' de '+channels.length+' canais liberados…';
    }
    status.textContent='PC conectado · '+done+' canais na grade TV ao vivo. A reprodução depende da fonte e da conexão do PC.';
    document.getElementById('live-embed-refresh')?.click();
   }catch(error){status.textContent=error.name==='TimeoutError'?'Tempo de conexão excedido. Confira Docker e internet do PC.':error.message;}
   finally{pending=false;for(const id of ['pc-tv-connect','pc-tv-publish','pc-tv-disconnect'])$(id).disabled=false;}
  }
  $('pc-tv-connect').onclick=()=>connect();$('pc-tv-publish').onclick=()=>connect({publish:true});$('pc-tv-disconnect').onclick=()=>connect({disconnect:true});
 }
 // The channels panel is created after admin access is confirmed.
 const observer=new MutationObserver(()=>{if(document.getElementById('live-pc-tv')){observer.disconnect();setup();}});
 if(document.getElementById('live-pc-tv'))setup();else observer.observe(document.documentElement,{childList:true,subtree:true});
})();
