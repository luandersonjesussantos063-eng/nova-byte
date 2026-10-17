// Playable, isolated two-channel time-shift proof of concept.
// Requires ffmpeg installed. No external IPTV access or credentials.
// Start: node novaplay/pc-tv/lab/playable-timeshift.mjs
// Open: http://127.0.0.1:8800/ and on a second device via a local tunnel.
// This is a lab server only: never expose publicly without authentication.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readdir,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const PORT=Number(process.env.PORT||process.env.TIMESHIFT_PORT||8800);
const ROTATE=Math.max(6,Number(process.env.TIMESHIFT_ROTATE_SECONDS||30));
const LIMIT=Math.max(10,Number(process.env.TIMESHIFT_MAX_SEGMENTS||150));
const root=await mkdtemp(join(tmpdir(),'nplay-playable-'));
const startedAt=Date.now();const stats={rotations:0,errors:0,lastRotation:null};
const channels=['a','b'];const completed=Object.fromEntries(channels.map(c=>[c,[]]));const boundaries=Object.fromEntries(channels.map(c=>[c,new Set()]));let active='a',stop=false,child=null;
const folders=Object.fromEntries(channels.map(c=>[c,join(root,c)]));
await Promise.all(Object.values(folders).map(async p=>{const {mkdir}=await import('node:fs/promises');await mkdir(p);}));
async function segmentList(c){return (await readdir(folders[c])).filter(x=>/^seg\d+\.ts$/.test(x)).sort((a,b)=>Number(a.slice(3,-3))-Number(b.slice(3,-3)));}
async function record(c){
 active=c;
 const start=Date.now(),next=await segmentList(c),offset=next.length?Number(next.at(-1).slice(3,-3))+1:0;
 if(offset>0)boundaries[c].add(offset);
 const ff=['-hide_banner','-loglevel','error','-nostdin','-re','-f','lavfi','-i',c==='a'?'testsrc2=size=640x360:rate=15':'smptebars=size=640x360:rate=15','-t',String(ROTATE),'-an','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-pix_fmt','yuv420p','-g','30','-sc_threshold','0','-f','segment','-segment_time','2','-segment_start_number',String(offset),'-segment_format','mpegts',join(folders[c],'seg%d.ts')];
 child=spawn('ffmpeg',ff,{stdio:['ignore','ignore','pipe']});
 let err='';child.stderr.on('data',d=>{err=(err+d.toString()).slice(-1000);});
 const exit=await new Promise(resolve=>{child.on('error',e=>resolve({error:e.code}));child.on('close',code=>resolve({code}));});
 child=null;
 const list=await segmentList(c);
 const block=list.filter(n=>Number(n.slice(3,-3))>=offset);
 if(block.length>=3){completed[c].push({id:offset,files:block});while(completed[c].length>8)completed[c].shift();}
 for(const name of list.slice(0,Math.max(0,list.length-LIMIT)))await rm(join(folders[c],name),{force:true});
 stats.rotations++;if(exit.code!==0||exit.error)stats.errors++;stats.lastRotation={channel:c,at:new Date().toISOString(),durationSeconds:Math.round((Date.now()-start)/1000),exitCode:exit.code??null};
 console.log(JSON.stringify({event:'lab_rotation',channel:c,seconds:Math.round((Date.now()-start)/1000),segments:(await segmentList(c)).length,exit,error:err||undefined}));
}
void(async()=>{while(!stop){for(const c of channels){if(stop)break;await record(c);}}})().catch(e=>console.error('lab_error',e.message));
const html=`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPlay — TV de Gravações</title><style>*{box-sizing:border-box}body{margin:0;background:#0c1324;color:#f6f9ff;font:16px system-ui}main{max-width:760px;margin:auto;padding:22px 16px}h1{font-size:25px}p{color:#adbed4;line-height:1.5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}button{border:1px solid #37516e;background:#1b2d48;color:white;padding:15px 12px;border-radius:12px;font:inherit;text-align:left}button.active{background:#234a7b;border-color:#75b4ff}small{display:block;color:#bbd1eb;margin-top:6px}video{width:100%;aspect-ratio:16/9;background:#02050c;border-radius:12px}#message{margin:14px 0;color:#c9d7e9}.tag{font-size:12px;color:#92c5ff}footer{font-size:13px;color:#9aaec7;margin-top:22px}</style><main><div class="tag">LABORATÓRIO • CANAIS SINTÉTICOS</div><h1>TV de Gravações</h1><p>Escolha um canal. A reprodução automática começa quando houver 2 minutos gravados, criando uma reserva inicial para reduzir as pausas.</p><div class="grid"><button id="a" onclick="select('a')">📺 Canal A<small id="ca">Aguardando gravações</small></button><button id="b" onclick="select('b')">📺 Canal B<small id="cb">Aguardando gravações</small></button></div><h3>Blocos disponíveis</h3><p id="metrics">Monitoramento: carregando...</p><div id="blocks">Carregando...</div><p id="message">Escolha um bloco completo para assistir.</p><video id="video" controls playsinline></video><footer>O gravador alterna entre os canais a cada 30 segundos. Um bloco só aparece quando termina de gravar. O laboratório não acessa a conta IPTV.</footer></main><script defer src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script><script>
let selected='a',h=null,currentId=null,waiting=false,requestVersion=0,known={a:[],b:[]};const START_BUFFER_SECONDS=120;
const video=document.querySelector('#video'),message=document.querySelector('#message');
function select(c){
 selected=c;currentId=null;waiting=false;requestVersion++;
 if(h){h.destroy();h=null;}video.pause();video.removeAttribute('src');video.load();
 document.querySelectorAll('.grid button').forEach(b=>b.classList.toggle('active',b.id===c));
 message.textContent='Canal '+c.toUpperCase()+' selecionado. Preparando primeira gravação...';
 refresh();
}
function playBlock(c,id){
 if(c!==selected)return;
 requestVersion++;const version=requestVersion;
 currentId=id;waiting=false;
 if(h){h.destroy();h=null;}video.pause();video.removeAttribute('src');video.load();
 const url='/channels/'+c+'/archive/'+id+'.m3u8';
 message.textContent='Carregando bloco '+id+' do Canal '+c.toUpperCase()+'...';
 if(window.Hls&&Hls.isSupported()){
  h=new Hls({maxBufferLength:45,fragLoadingTimeOut:30000,fragLoadingMaxRetry:5,fragLoadingRetryDelay:1000});h.loadSource(url);h.attachMedia(video);
  h.on(Hls.Events.MANIFEST_PARSED,()=>{if(version===requestVersion)video.play().catch(()=>{message.textContent='Reprodução pronta. Toque em ▶ para iniciar (o navegador bloqueou o início automático).';});});
  h.on(Hls.Events.ERROR,(_,d)=>{if(version===requestVersion&&d.fatal)message.textContent='Falha ao reproduzir: '+d.details;});
 }else if(video.canPlayType('application/vnd.apple.mpegurl')){
  video.src=url;video.play().catch(()=>{message.textContent='Toque no vídeo para iniciar a reprodução.';});
 }else message.textContent='Navegador sem suporte HLS.';
}
function nextBlock(){
 const blocks=known[selected]||[];
 const next=blocks.find(b=>currentId===null||b.id>currentId);
 if(next){playBlock(selected,next.id);return true;}
 waiting=true;message.textContent='Bloco concluído. Aguardando a próxima gravação do Canal '+selected.toUpperCase()+'...';
 return false;
}
video.addEventListener('playing',()=>{message.textContent='▶ Reproduzindo bloco '+currentId+' do Canal '+selected.toUpperCase();});
video.addEventListener('pause',()=>{if(!video.ended&&!waiting&&currentId!==null)message.textContent='⏸ Vídeo pausado. Toque em ▶ para continuar.';});
video.addEventListener('waiting',()=>{if(!waiting&&currentId!==null)message.textContent='Carregando vídeo do bloco '+currentId+'...';});

video.addEventListener('ended',()=>{const blocks=known[selected]||[];const last=blocks.at(-1);if(last&&last.id>currentId)currentId=last.id;nextBlock();});
async function refresh(){
 try{
 const x=await(await fetch('/status',{cache:'no-store'})).json();const m=await(await fetch('/metrics',{cache:'no-store'})).json();document.querySelector('#metrics').textContent='Gravações: '+m.rotations+' ciclos · Erros: '+m.recordingErrors+' · Armazenamento: '+((m.channels.a.bytes+m.channels.b.bytes)/1048576).toFixed(1)+' MB';
 known=x.blocks;
 for(const c of ['a','b'])document.querySelector('#c'+c).textContent=x.blocks[c].length+' blocos prontos'+(x.active===c?' · gravando':'');
 const el=document.querySelector('#blocks');el.replaceChildren();const blocks=x.blocks[selected];
 if(!blocks.length){el.textContent='Aguardando o primeiro bloco completo.';return;}
 for(const b of blocks.slice().reverse()){
  const btn=document.createElement('button');btn.textContent='▶ Bloco '+b.id+' · '+b.seconds+' segundos';
  btn.style.display='block';btn.style.width='100%';btn.style.marginBottom='8px';
  const c=selected;btn.onclick=()=>playBlock(c,b.id);el.append(btn);
 }
 if(currentId===null){const buffered=blocks.reduce((sum,b)=>sum+b.seconds,0);if(buffered<START_BUFFER_SECONDS){message.textContent='Preparando buffer do Canal '+selected.toUpperCase()+': '+buffered+' de '+START_BUFFER_SECONDS+' segundos gravados. Início automático ao completar.';}else nextBlock();}else if(waiting)nextBlock();
 }catch{message.textContent='Não foi possível consultar as gravações.';}
}
setInterval(refresh,3000);select('a');
</script></html>`
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(url.pathname==='/metrics'){const disk=Object.fromEntries(await Promise.all(channels.map(async c=>{const names=await segmentList(c);let bytes=0;for(const n of names){const info=await stat(join(folders[c],n)).catch(()=>null);bytes+=info?.size||0;}return [c,{segments:names.length,bytes,completedBlocks:completed[c].length,recordedSeconds:completed[c].reduce((sum,b)=>sum+b.files.length*2,0)}];})));res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({service:'nplay-timeshift-lab',source:'synthetic',uptimeSeconds:Math.floor((Date.now()-startedAt)/1000),activeRecorder:active,rotations:stats.rotations,recordingErrors:stats.errors,lastRotation:stats.lastRotation,channels:disk}));return;}
 if(url.pathname==='/status'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({active,blocks:Object.fromEntries(channels.map(c=>[c,completed[c].map((b,order)=>({id:b.id,order,seconds:b.files.length*2}))]))}));return;}
 const m=/^\/channels\/(a|b)\/(index\.m3u8|seg\d+\.ts|blocks\/\d+\.m3u8|archive\/\d+\.m3u8)$/.exec(url.pathname);
 if(!m){res.writeHead(404);res.end();return;}
 const [,c,name]=m;
 if(name.startsWith('archive/')){
 const id=Number(name.slice(8,-5)),blocks=completed[c].filter(b=>b.id>=id);
 const available=new Set(await segmentList(c));
 if(!blocks.length||blocks.some(b=>b.files.some(n=>!available.has(n)))){res.writeHead(410);res.end();return;}
 const lines=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-PLAYLIST-TYPE:VOD','#EXT-X-TARGETDURATION:2','#EXT-X-MEDIA-SEQUENCE:0'];
 blocks.forEach((b,i)=>{if(i)lines.push('#EXT-X-DISCONTINUITY');for(const n of b.files)lines.push('#EXTINF:2.0,','../'+n);});
 lines.push('#EXT-X-ENDLIST');
 res.setHeader('Content-Type','application/vnd.apple.mpegurl');res.setHeader('Cache-Control','no-store');res.end(lines.join('\\n')+'\\n');return;
 }
 if(name.startsWith('blocks/')){
 const id=Number(name.slice(7,-5)),block=completed[c].find(b=>b.id===id);
 if(!block){res.writeHead(404);res.end();return;}
 const files=(await segmentList(c));if(!block.files.every(n=>files.includes(n))){res.writeHead(410);res.end();return;}
 res.setHeader('Content-Type','application/vnd.apple.mpegurl');res.setHeader('Cache-Control','no-store');
 res.end(['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-PLAYLIST-TYPE:VOD','#EXT-X-TARGETDURATION:2','#EXT-X-MEDIA-SEQUENCE:0',...block.files.flatMap(n=>['#EXTINF:2.0,','../'+n]),'#EXT-X-ENDLIST'].join('\n')+'\n');return;
 }
 if(name==='index.m3u8'){
 const all=await segmentList(c),list=all.slice(-18),first=list.length?Number(list[0].slice(3,-3)):0;
 const discontinuities=[...boundaries[c]].filter(n=>n<=first).length;
 res.setHeader('Content-Type','application/vnd.apple.mpegurl');res.setHeader('Cache-Control','no-store');
 res.end(['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:2','#EXT-X-MEDIA-SEQUENCE:'+first,'#EXT-X-DISCONTINUITY-SEQUENCE:'+discontinuities,...list.flatMap(n=>[...(boundaries[c].has(Number(n.slice(3,-3)))?['#EXT-X-DISCONTINUITY']:[]),'#EXTINF:2.0,',n])].join('\n')+'\n');return;
 }
 const p=join(folders[c],name);const st=await stat(p).catch(()=>null);
 if(!st){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','video/mp2t');res.setHeader('Cache-Control','public, max-age=300, immutable');res.setHeader('Content-Length',st.size);const {createReadStream}=await import('node:fs');createReadStream(p).pipe(res);
 }catch{res.writeHead(500);res.end();}
});
server.listen(PORT,'0.0.0.0',()=>console.log('NPlay time-shift lab on http://127.0.0.1:'+PORT));
async function shutdown(){stop=true;child?.kill('SIGTERM');server.close();await rm(root,{recursive:true,force:true});}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
