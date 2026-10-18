/* NPlay: presence admin v0.51.8.
   Server timestamps are authoritative; local perf clock only animates the
   elapsed display between reads. This is foreground app usage, not playback. */
(()=>{
'use strict';
const panel=document.getElementById('nplay-presence-admin');if(!panel)return;
const list=document.getElementById('presence-list'),message=document.getElementById('presence-status');
const STALE_MS=45000;
const POLL_MS=10000;
let db=null,busy=false,snapshot=[],rendered=[],serverTime=0,clientTick=0,lastUpdated=0,errorText='';
function duration(seconds){
 const n=Math.max(0,Math.floor(Number(seconds)||0));
 return n>=3600?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'min':n>=60?Math.floor(n/60)+'min '+n%60+'s':n+'s';
}
function clock(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now()}
function serverNow(){return serverTime+(clock()-clientTick)}
function presenceState(row,now){
 const seen=new Date(row.last_seen).getTime(),age=Math.max(0,now-seen);
 const recent=Number.isFinite(seen)&&age<STALE_MS;
 return {state:recent?(row.is_visible?'online':'background'):'offline',age,seconds:recent&&row.is_visible?age/1000:0};
}
function visiblePanel(){
 return !panel.hidden&&!document.getElementById('dashboard')?.hidden&&!document.hidden;
}
function repaintTime(){
 if(!visiblePanel()||!snapshot.length||!lastUpdated)return;
 const now=serverNow();
 let online=0,background=0;
 rendered.forEach(({row,status,time,seen},index)=>{
  const state=presenceState(row,now);
  status.className='presence-state'+(state.state==='online'?' online':'');
  status.textContent=state.state==='online'?'● Online':state.state==='background'?'Em segundo plano':'Offline';
  if(state.state==='online')online++;
  if(state.state==='background')background++;
  time.textContent='Sessão '+(state.state==='online'?'atual':'anterior')+': '+duration(Number(row.session_seconds)+state.seconds)+' · Hoje: '+duration(Number(row.today_seconds)+state.seconds);
  seen.textContent='Último sinal há '+duration(state.age/1000);
  // Keep all devices registered, but show currently active profiles first.
  const card=status.parentElement;
  if(card)card.style.order=state.state==='online'?'-2':state.state==='background'?'-1':String(index);
 });
 message.textContent=online+' perfil(is) online · '+background+' em segundo plano · '+snapshot.length+' registrado(s)'+(snapshot.length===500?' (500 mais recentes)':'')+' · Sinal atualizado às '+new Date(lastUpdated).toLocaleTimeString('pt-BR')+' · Consulta automática a cada 10s';
 if(errorText)message.textContent+=' · '+errorText;
}
function draw(rows){
 list.replaceChildren();rendered=[];
 snapshot=rows;
 list.style.display='flex';list.style.flexDirection='column';list.style.gap='10px';
 for(const row of rows){
  const card=document.createElement('article');card.className='presence-card';
  const name=document.createElement('strong');name.textContent=row.profile_name||'Perfil';
  const status=document.createElement('span');status.className='presence-state';
  const device=document.createElement('small');
  device.textContent='Aparelho '+String(row.user_id||'').slice(0,8).toUpperCase();
  const time=document.createElement('p');
  const seen=document.createElement('small');
  const absolute=new Date(row.last_seen);
  seen.title=Number.isFinite(absolute.getTime())?'Último sinal: '+absolute.toLocaleString('pt-BR',{timeZone:'America/Cuiaba'}):'Horário desconhecido';
  card.append(name,status,device,time,seen);
  list.append(card);
  rendered.push({row,status,time,seen});
 }
 if(!rows.length){
  const empty=document.createElement('p');empty.className='muted';
  empty.textContent='Nenhum perfil registrado. Abra a NPlay e selecione um perfil em um aparelho autorizado.';
  list.append(empty);
  message.textContent='0 perfis online · Nenhum perfil registrado · Consulta automática a cada 10s';
 }
 repaintTime();
}
async function refresh(){
 if(busy||!visiblePanel())return;
 if(!window.supabase?.createClient){message.textContent='Aguardando conexão com o painel...';return}
 busy=true;
 try{
  // Supabase JS clients use the same persisted auth session as the main ADM.
  db??=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');
  const {data,error}=await db.rpc('novaplay_profiles_online');
  if(error)throw error;
  const rows=Array.isArray(data)?data:[];
  const at=Date.parse(rows[0]?.server_now);
  serverTime=Number.isFinite(at)?at:Date.now();
  clientTick=clock();
  lastUpdated=Date.now();
  errorText='';
  draw(rows);
 }catch(e){
  errorText='Falha na atualização; exibindo a última leitura.';
  if(!snapshot.length)message.textContent='Não foi possível consultar os perfis. Confira sua sessão administrativa e tente atualizar.';
  else repaintTime();
  console.warn('NPlay presença: consulta indisponível',e?.code||e?.message||'erro');
 }finally{busy=false}
}
document.getElementById('presence-refresh')?.addEventListener('click',refresh);
new MutationObserver(refresh).observe(panel,{attributes:true,attributeFilter:['hidden']});
const dashboard=document.getElementById('dashboard');
if(dashboard)new MutationObserver(refresh).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('focus',refresh);
window.addEventListener('pageshow',refresh);
setInterval(refresh,POLL_MS);
setInterval(repaintTime,1000);
refresh();
})();
