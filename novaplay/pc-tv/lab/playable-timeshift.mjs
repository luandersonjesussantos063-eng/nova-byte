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
const channels=['a','b'];let active='a',stop=false,child=null;
const folders=Object.fromEntries(channels.map(c=>[c,join(root,c)]));
await Promise.all(Object.values(folders).map(async p=>{const {mkdir}=await import('node:fs/promises');await mkdir(p);}));
async function segmentList(c){return (await readdir(folders[c])).filter(x=>/^seg\d+\.ts$/.test(x)).sort((a,b)=>Number(a.slice(3,-3))-Number(b.slice(3,-3)));}
async function record(c){
 active=c;
 const start=Date.now(),next=await segmentList(c),offset=next.length?Number(next.at(-1).slice(3,-3))+1:0;
 const ff=['-hide_banner','-loglevel','error','-nostdin','-re','-f','lavfi','-i',c==='a'?'testsrc2=size=640x360:rate=15':'smptebars=size=640x360:rate=15','-t',String(ROTATE),'-an','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-pix_fmt','yuv420p','-g','30','-sc_threshold','0','-f','segment','-segment_time','2','-segment_start_number',String(offset),'-segment_format','mpegts',join(folders[c],'seg%d.ts')];
 child=spawn('ffmpeg',ff,{stdio:['ignore','ignore','pipe']});
 let err='';child.stderr.on('data',d=>{err=(err+d.toString()).slice(-1000);});
 const exit=await new Promise(resolve=>{child.on('error',e=>resolve({error:e.code}));child.on('close',code=>resolve({code}));});
 child=null;
 const list=await segmentList(c);
 for(const name of list.slice(0,Math.max(0,list.length-LIMIT)))await rm(join(folders[c],name),{force:true});
 console.log(JSON.stringify({event:'lab_rotation',channel:c,seconds:Math.round((Date.now()-start)/1000),segments:(await segmentList(c)).length,exit,error:err||undefined}));
}
void(async()=>{while(!stop){for(const c of channels){if(stop)break;await record(c);}}})().catch(e=>console.error('lab_error',e.message));
const html=`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPlay — Teste de gravações</title><style>*{box-sizing:border-box}body{margin:0;font:15px system-ui;background:#0a1020;color:#f8fafc}main{max-width:780px;margin:auto;padding:22px 16px}h1{font-size:23px;margin:4px 0 8px}.sub{color:#aebbd1;line-height:1.5;margin-bottom:24px}.channels{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 20px}button{border:1px solid #334155;background:#172338;color:#f8fafc;border-radius:12px;padding:15px 10px;text-align:left;font:inherit;cursor:pointer}button.selected{border-color:#4c96ff;background:#19365b}button small{display:block;color:#b8c5d8;margin-top:7px}video{width:100%;aspect-ratio:16/9;background:#030712;border-radius:12px}#state{margin:12px 0;color:#b9c9dd}.pill{display:inline-block;background:#203c63;color:#d5e9ff;padding:5px 9px;border-radius:20px;font-size:12px}footer{color:#9aabc1;font-size:13px;line-height:1.5;margin-top:20px}</style><main><div class="pill">LABORATÓRIO · SEM IPTV</div><h1>TV com atraso</h1><p class="sub">Escolha um canal gravado. Cada aparelho pode assistir a uma gravação diferente.</p><div class="channels"><button id="btn-a" onclick="play('a')">📺 Canal A<small id="count-a">Carregando...</small></button><button id="btn-b" onclick="play('b')">📺 Canal B<small id="count-b">Carregando...</small></button></div><video id="video" controls autoplay muted playsinline></video><div id="state">Preparando reprodução...</div><footer>Imagens coloridas são vídeos de teste. O gravador alterna entre os canais a cada 30 segundos. Este ambiente é separado da NPlay oficial.</footer></main><script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script><script>let h,current='a';const v=document.querySelector('#video');function play(c){current=c;document.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.id==='btn-'+c));if(h){h.destroy();h=null;}v.pause();v.removeAttribute('src');v.load();let url='/channels/'+c+'/index.m3u8';document.querySelector('#state').textContent='Abrindo gravação do canal '+c.toUpperCase()+'...';if(window.Hls&&Hls.isSupported()){h=new Hls({liveSyncDurationCount:3,maxBufferLength:20});h.loadSource(url);h.attachMedia(v);h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));h.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)document.querySelector('#state').textContent='Reprodução interrompida: '+d.details;});}else if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=url;v.play().catch(()=>{});}else{document.querySelector('#state').textContent='Este navegador não oferece suporte a HLS.';}}async function refresh(){try{const x=await(await fetch('/status',{cache:'no-store'})).json();for(let c of ['a','b'])document.querySelector('#count-'+c).textContent=x.channels[c]+' trechos gravados'+(x.active===c?' · gravando agora':' · em espera');}catch{}}v.addEventListener('playing',()=>document.querySelector('#state').textContent='Reproduzindo canal '+current.toUpperCase()+' com atraso');v.addEventListener('waiting',()=>document.querySelector('#state').textContent='Aguardando trechos gravados...');setInterval(refresh,3000);refresh();play('a');</script></html>`;
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(url.pathname==='/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({active,channels:Object.fromEntries(await Promise.all(channels.map(async c=>[c,(await segmentList(c)).length])))}));return;}
 const m=/^\/channels\/(a|b)\/(index\.m3u8|seg\d+\.ts)$/.exec(url.pathname);
 if(!m){res.writeHead(404);res.end();return;}
 const [,c,name]=m;
 if(name==='index.m3u8'){
 const all=await segmentList(c),list=all.slice(-18),first=list.length?Number(list[0].slice(3,-3)):0;
 res.setHeader('Content-Type','application/vnd.apple.mpegurl');res.setHeader('Cache-Control','no-store');
 res.end(['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:2','#EXT-X-MEDIA-SEQUENCE:'+first,...list.flatMap(n=>['#EXTINF:2.0,',n])].join('\n')+'\n');return;
 }
 const p=join(folders[c],name);const st=await stat(p).catch(()=>null);
 if(!st){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','video/mp2t');res.setHeader('Content-Length',st.size);res.end(await readFile(p));
 }catch{res.writeHead(500);res.end();}
});
server.listen(PORT,'0.0.0.0',()=>console.log('NPlay time-shift lab on http://127.0.0.1:'+PORT));
async function shutdown(){stop=true;child?.kill('SIGTERM');server.close();await rm(root,{recursive:true,force:true});}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
