/* NPlay: administrator-only now-watching status, internal build 2026.10.17.
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
 let online=0,background=0,playing=0;
 rendered.forEach(({row,status,time,seen,watch},index)=>{
  const state=presenceState(row,now);
  status.className='presence-state'+(state.state==='online'?' online':'');
  status.textContent=state.state==='online'?'● Online':state.state==='background'?'Em segundo plano':'Offline';
  if(state.state==='online')online++;
  if(state.state==='background')background++;
  time.textContent='Sessão '+(state.state==='online'?'atual':'anterior')+': '+duration(Number(row.session_seconds)+state.seconds)+' · Hoje: '+duration(Number(row.today_seconds)+state.seconds);
  seen.textContent='Último sinal há '+duration(state.age/1000);
  const watchAge=now-new Date(row.watch_updated_at).getTime();
  const freshWatch=state.state==='online'&&row.watch_title&&
   Number.isFinite(watchAge)&&watchAge>=-5000&&watchAge<45000;
  const playback=freshWatch?row.watch_state:null;
  const title=freshWatch?String(row.watch_title).slice(0,160):'';
  watch.className='presence-watching'+(playback==='playing'?' is-playing':'');
  if(playback==='playing'){watch.textContent='▶ Assistindo: '+title;playing++;}
  else if(playback==='paused')watch.textContent='❚❚ Pausado: '+title;
  else if(playback==='buffering')watch.textContent='◌ Carregando: '+title;
  else if(playback==='open')watch.textContent='▣ Player aberto (reprodução não confirmada): '+title;
  else watch.textContent=state.state==='online'?'Nenhum conteúdo em reprodução confirmado':'Sem reprodução ativa';
  // Keep all devices registered, but show currently active profiles first.
  const card=status.parentElement;
  if(card)card.style.order=state.state==='online'?'-2':state.state==='background'?'-1':String(index);
 });
 message.textContent=online+' perfil(is) online · '+playing+' reproduzindo · '+background+' em segundo plano · '+snapshot.length+' registrado(s)'+(snapshot.length===500?' (500 mais recentes)':'')+' · Sinal atualizado às '+new Date(lastUpdated).toLocaleTimeString('pt-BR')+' · Consulta automática a cada 10s';
 if(errorText)message.textContent+=' · '+errorText;
}
async function registeredProfiles(client,rows){
 const ids=[...new Set(rows.map(row=>row.user_id).filter(Boolean))],names=new Map();
 for(let offset=0;offset<ids.length;offset+=100){
  const {data,error}=await client.from('novaplay_access_requests').select('user_id,display_name').in('user_id',ids.slice(offset,offset+100));
  if(error)throw error;
  for(const item of data||[])names.set(item.user_id,String(item.display_name||'').trim());
 }
 return rows.map(row=>({...row,registration_name:names.get(row.user_id)||'Cadastro sem nome'}));
}
function filterProfiles(rows,query='',state='all',now=serverNow()){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),search=normalize(query).trim();
 return rows.filter(row=>(state==='all'||presenceState(row,now).state===state)&&(!search||normalize([row.registration_name,row.profile_name,row.user_id].join(' ')).includes(search)));
}
function draw(rows){
 list.replaceChildren();rendered=[];
 snapshot=rows;
 list.style.display='flex';list.style.flexDirection='column';list.style.gap='10px';
 const filtered=filterProfiles(rows,document.getElementById('presence-search')?.value||'',document.getElementById('presence-filter')?.value||'all');
 for(const row of filtered){
  const card=document.createElement('article');card.className='presence-card';
  const name=document.createElement('strong');name.textContent=row.registration_name||'Cadastro sem nome';
  const status=document.createElement('span');status.className='presence-state';
  const device=document.createElement('small');
  device.textContent='Perfil: '+(row.profile_name||'Sem nome')+' · Aparelho '+String(row.user_id||'').slice(0,8).toUpperCase();
  const time=document.createElement('p');
  const watch=document.createElement('p');watch.className='presence-watching';
  const seen=document.createElement('small');
  const absolute=new Date(row.last_seen);
  seen.title=Number.isFinite(absolute.getTime())?'Último sinal: '+absolute.toLocaleString('pt-BR',{timeZone:'America/Cuiaba'}):'Horário desconhecido';
  card.append(name,status,device,time,watch,seen);
  list.append(card);
  rendered.push({row,status,time,watch,seen});
 }
 if(!filtered.length){
  const empty=document.createElement('p');empty.className='muted';
  empty.textContent=rows.length?'Nenhum cliente corresponde a este filtro.':'Nenhum perfil registrado. Abra a NPlay e selecione um perfil em um aparelho autorizado.';
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
  const {data,error}=await db.rpc('novaplay_profiles_watching');
  if(error)throw error;
  const rows=Array.isArray(data)?data:[];
  const at=Date.parse(rows[0]?.server_now);
  serverTime=Number.isFinite(at)?at:Date.now();
  clientTick=clock();
  lastUpdated=Date.now();
  errorText='';
  draw(await registeredProfiles(db,rows));
 }catch(e){
  errorText='Falha na atualização; exibindo a última leitura.';
  if(!snapshot.length)message.textContent='Não foi possível consultar os perfis. Confira sua sessão administrativa e tente atualizar.';
  else repaintTime();
  console.warn('NPlay presença: consulta indisponível',e?.code||e?.message||'erro');
 }finally{busy=false}
}
for(const [id,event] of [['presence-search','input'],['presence-filter','change']])document.getElementById(id)?.addEventListener(event,()=>draw(snapshot));
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
