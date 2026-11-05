// Kaia Glow first-party insights. Pseudonymous, only after affirmative analytics consent.
// No tracking before consent, no fingerprinting, no IP/phone/email collection.
(function(){
 'use strict';
 const PREF='kaia-metrics-consent-v1',VISITOR='kaia-visitor-v1',SESSION='kaia-session-v1';
 const url=window.KAIA_PUBLIC_API?.projectUrl,key=window.KAIA_PUBLIC_API?.publicKey;
 const banner=document.getElementById('kaiaCookieBanner'),
  manage=document.getElementById('kaiaCookieManage'),
  accept=document.getElementById('kaiaCookieAccept'),
  reject=document.getElementById('kaiaCookieReject');
 let permission=null,visitor=null,session=null,active=null,pageLogged=false;
 try{const saved=localStorage.getItem(PREF);if(saved==='yes'||saved==='no')permission=saved==='yes';}catch{}
 function uuid(){return crypto.randomUUID();}
 function loadIds(){
  if(permission!==true)return;
  try{
   visitor=localStorage.getItem(VISITOR);
   if(!visitor||!/^[0-9a-f-]{36}$/i.test(visitor)){visitor=uuid();localStorage.setItem(VISITOR,visitor);}
   session=sessionStorage.getItem(SESSION);
   if(!session||!/^[0-9a-f-]{36}$/i.test(session)){session=uuid();sessionStorage.setItem(SESSION,session);}
  }catch{visitor=null;session=null;}
 }
 function event(kind,productKey=null,seconds=0){
  if(permission!==true||!url||!key||!visitor||!session)return;
  const payload={p_visitor_id:visitor,p_session_id:session,p_kind:kind,p_product_key:productKey,
   p_visible_seconds:Math.min(1800,Math.max(0,Math.round(seconds))),p_analytics_consent:true};
  fetch(url+'/rest/v1/rpc/kaia_record_interest',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(payload),mode:'cors',cache:'no-store',keepalive:true
  }).catch(()=>{});
 }
 function pageVisit(){
  if(permission!==true||pageLogged)return;
  pageLogged=true;event('page_view');
 }
 function productKey(product){return product?.sku||(product?.id?'legacy:'+String(product.id):null);}
 function pause(){
  if(active?.started!=null){active.visible+=(performance.now()-active.started)/1000;active.started=null;}
 }
 function resume(){if(active&&active.started==null&&document.visibilityState==='visible')active.started=performance.now();}
 function closeProduct(){
  if(!active)return;pause();
  const ended=active;active=null;
  if(ended.visible>=1)event('product_view',ended.key,ended.visible);
 }
 function openProduct(product){
  if(permission!==true)return;
  const id=productKey(product);if(!id)return;
  if(active)closeProduct();
  active={key:id,visible:0,started:document.visibilityState==='visible'?performance.now():null};
 }
 function addToCart(product){const id=productKey(product);if(id)event('cart_add',id,0);}
 function showBanner(){
  if(!banner)return;
  banner.hidden=false;
 }
 function hideBanner(){if(banner)banner.hidden=true;}
 function setPreference(allow){
  closeProduct();
  permission=allow;
  try{
   localStorage.setItem(PREF,allow?'yes':'no');
   document.cookie='kaia_metrics='+ (allow?'yes':'no')+'; Path=/; Max-Age=15552000; SameSite=Lax; Secure';
   if(!allow){localStorage.removeItem(VISITOR);sessionStorage.removeItem(SESSION);}
  }catch{}
  if(allow){loadIds();pageLogged=false;pageVisit();}
  else{visitor=null;session=null;pageLogged=false;}
  hideBanner();
 }
 accept?.addEventListener('click',()=>setPreference(true));
 reject?.addEventListener('click',()=>setPreference(false));
 manage?.addEventListener('click',showBanner);
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')pause();
  else resume();
 });
 window.addEventListener('pagehide',closeProduct,{capture:true});
 if(permission===true){loadIds();pageVisit();}
 else if(permission===null)showBanner();
 window.kaiaMarketing={productOpened:openProduct,productClosed:closeProduct,cartAdded:addToCart,
  hasAnalyticsConsent:()=>permission===true};
})();
