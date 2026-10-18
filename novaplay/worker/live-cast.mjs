import {seal,unseal} from './hls-relay.mjs';
const viewerPattern=/^[a-f0-9]{32}$/;
export async function mintLiveCast({id,jwt,viewer,secret,now=Date.now()}){
 const payload=JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
 const exp=Math.min(Math.floor(now/1000)+3600,Number(payload.exp)||0);
 if(exp<=now/1000+60)throw Error('Session expires soon');
 if(!viewerPattern.test(viewer||''))viewer=crypto.randomUUID().replaceAll('-','');
 return {ticket:await seal(JSON.stringify({jwt,viewer,exp}), 'live-cast:'+id,secret),expires_at:exp};
}
export async function readLiveCast(ticket,id,secret,now=Date.now()){
 if(typeof ticket!=='string'||ticket.length>5000)throw Error('Invalid ticket');
 const payload=JSON.parse(await unseal(ticket,'live-cast:'+id,secret));
 if(typeof payload.jwt!=='string'||!viewerPattern.test(payload.viewer)||!Number.isFinite(payload.exp)||payload.exp<=now/1000||payload.exp>now/1000+3600)throw Error('Expired ticket');
 return payload;
}
