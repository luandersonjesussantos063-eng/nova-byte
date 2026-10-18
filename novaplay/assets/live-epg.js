(()=>{
 'use strict';
 const root='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
 const cache=new Map(),cards=new Map(),queue=new Map();let running=false,timer;
 const clock=value=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 function paint(card,item,data){
  const host=card.querySelector('.nplay-epg');if(!host)return;host.replaceChildren();
  const now=Date.now(),current=data?.current?.start<=now&&data.current.end>now?data.current:null;
  const add=(cls,text)=>{const el=document.createElement('span');el.className=cls;el.textContent=text;host.append(el);};
  if(!current){add('nplay-epg-empty','Programação indisponível');if(data?.next?.start>now)add('nplay-epg-next','A seguir, '+clock(data.next.start)+': '+data.next.title);return;}
  add('nplay-epg-now','Agora: '+current.title);
  add('nplay-epg-time',clock(current.start)+' – '+clock(current.end));
  const bar=document.createElement('progress');bar.max=100;bar.value=Math.max(0,Math.min(100,(now-current.start)/(current.end-current.start)*100));bar.setAttribute('aria-label','Progresso de '+current.title);host.append(bar);
  if(data.next?.start>now)add('nplay-epg-next','A seguir: '+data.next.title);
 }
 const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const item=cards.get(e.target);if(item)enqueue(e.target,item);}},{rootMargin:'100px'}):null;
 function enqueue(card,item){
  const saved=cache.get(item.id);paint(card,item,saved?.data);
  if(saved?.until>Date.now())return;
  queue.set(item.id,{card,item});clearTimeout(timer);timer=setTimeout(()=>void drain(),100);
 }
 async function drain(){
  if(running||!queue.size||document.hidden)return;running=true;
  try{while(queue.size&&!document.hidden){
   const batch=[...queue.values()].filter(x=>x.card.isConnected).slice(0,6);for(const x of [...queue.values()])if(!x.card.isConnected)queue.delete(x.item.id);
   if(!batch.length)break;for(const x of batch)queue.delete(x.item.id);
   try{
    const authorized=await window.NPlayLiveAuth.authorize(batch[0].item.embed_url),token=new URL(authorized).searchParams.get('access_token');
    if(!token)throw Error('Session unavailable');
    const r=await fetch(root+'/epg',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({ids:batch.map(x=>x.item.id)}),signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error('Guide unavailable');const payload=await r.json();
    for(const {card,item} of batch){const data=payload.channels?.[item.id]||null;cache.set(item.id,{data,until:Math.min(Date.now()+120000,data?.expires_at||Date.now()+60000)});paint(card,item,data);}
   }catch{for(const {card,item} of batch){cache.set(item.id,{data:null,until:Date.now()+60000});paint(card,item,null);}}
  }}finally{running=false;}
 }
 function observe(card,item){
  const host=document.createElement('div');host.className='nplay-epg';card.append(host);paint(card,item,cache.get(item.id)?.data);
  if(!window.NPlayLiveAuth?.protectedUrl(item.embed_url))return;
  cards.set(card,item);if(observer)observer.observe(card);else enqueue(card,item);
 }
 function reset(){observer?.disconnect();cards.clear();queue.clear();}
 setInterval(()=>{if(document.hidden)return;for(const [card,item] of cards){if(!card.isConnected){cards.delete(card);continue;}const rect=card.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight+100)enqueue(card,item);}},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void drain();});
 window.NPlayEpg=Object.freeze({observe,reset});
})();
