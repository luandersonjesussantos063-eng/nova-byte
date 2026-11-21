export const WELCOME_CODE="MIMO5", WELCOME_PERCENT=5;
export const COOKIE_KEY="pacifica-cookie-consent-v1", MIMO_KEY="pacifica-welcome-v1";
export function readLocal(storage,key,fallback=null){try{return JSON.parse(storage.getItem(key))??fallback}catch{return fallback}}
export function writeLocal(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch{return false}}
export function welcomeTotals(totals,config={},claimed=false){
 const gross=totals.subtotalCents;
 const welcomeCents=claimed?Math.round(gross*WELCOME_PERCENT/100):0;
 const net=gross-welcomeCents;
 const pct=v=>Number.isFinite(Number(v))?Math.min(100,Math.max(0,Number(v))):0;
 return {...totals,welcomeCents,discountedSubtotalCents:net,
  pixTotalCents:Math.max(0,net-Math.round(net*pct(config.pixPercent)/100)),
  cardTotalCents:net+Math.round(net*pct(config.cardPercent)/100)};
}
export function readConsent(storage){
 const c=readLocal(storage,COOKIE_KEY);
 return c?.version===1&&typeof c.analytics==="boolean"&&typeof c.marketing==="boolean"?c:null;
}
export function createConsent(analytics=false,marketing=false){return {version:1,necessary:true,analytics:analytics===true,marketing:marketing===true}}
export function readWelcome(storage){
 const s=readLocal(storage,MIMO_KEY);return {seen:s?.seen===true,claimed:s?.claimed===true};
}
export function mountVisitorOffers({storage,onClaim,skipWelcome=false}){
 let consent=readConsent(storage),welcome=readWelcome(storage);
 const host=document.createElement("div");host.id="pacifica-visitor-tools";document.body.append(host);
 host.innerHTML=`<dialog class="p-welcome-dialog" id="p-welcome" aria-labelledby="p-welcome-title">
  <button type="button" class="p-visitor-close" data-visitor="dismiss" aria-label="Fechar oferta">×</button>
  <div class="p-gift-icon" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><rect x="8" y="26" width="48" height="10" rx="2"/><path d="M12 36h40v20H12zM32 26v30M32 26C14 26 13 8 22 8c7 0 10 12 10 18ZM32 26C50 26 51 8 42 8c-7 0-10 12-10 18Z"/></svg></div>
  <span class="p-welcome-eyebrow">UM CARINHO DA PACÍFICA HAIR</span><h2 id="p-welcome-title">Você acaba de ganhar um mimo!</h2>
  <div class="p-welcome-percent">5%<small>DE DESCONTO</small></div>
  <p>Realce a sua beleza e aproveite 5% de desconto nos produtos da sua sacola.</p>
  <button type="button" class="p-visitor-primary" data-visitor="claim">Aproveitar meu mimo</button><button type="button" class="p-visitor-secondary" data-visitor="dismiss">Agora não</button>
  <small>Desconto nos produtos, sem incluir o frete. Não é necessário aceitar cookies opcionais.</small>
 </dialog>
 <section class="p-cookie-banner" aria-label="Preferências de cookies" hidden>
  <div class="p-cookie-copy"><strong>Seu conforto e sua privacidade</strong><p>Usamos armazenamento necessário para a sacola, login e preferências. Você escolhe se permite cookies opcionais.</p><button type="button" class="p-cookie-link" data-visitor="settings">Personalizar cookies</button></div>
  <div class="p-cookie-actions"><button type="button" data-visitor="reject">Recusar opcionais</button><button type="button" data-visitor="accept">Aceitar todos</button></div>
 </section>
 <dialog class="p-cookies-dialog" aria-labelledby="p-cookies-title" id="p-cookies">
  <button type="button" class="p-visitor-close" data-visitor="close-settings" aria-label="Fechar preferências">×</button>
  <h2 id="p-cookies-title">Preferências de cookies</h2><p>Você pode alterar suas escolhas a qualquer momento no rodapé. A recusa não impede compras, login ou o mimo.</p>
  <div class="p-cookie-choice"><span><strong>Necessários</strong><small>Login, sacola, favoritos, segurança e suas preferências.</small></span><span class="p-cookie-always">Sempre ativos</span></div>
  <label class="p-cookie-choice"><span><strong>Análise</strong><small>Medir o uso da loja, caso essa tecnologia seja ativada.</small></span><input type="checkbox" id="p-cookie-analytics"></label>
  <label class="p-cookie-choice"><span><strong>Marketing</strong><small>Publicidade e personalização, se forem ativadas no futuro.</small></span><input type="checkbox" id="p-cookie-marketing"></label>
  <p class="p-cookie-note">Atualmente não há rastreadores opcionais ativos na loja. A autorização registra apenas sua preferência.</p>
  <button type="button" class="p-visitor-primary" data-visitor="save-settings">Salvar minhas preferências</button>
  <div class="p-cookie-actions"><button type="button" data-visitor="reject">Recusar opcionais</button><button type="button" data-visitor="accept">Aceitar todos</button></div>
 </dialog>`;
 const offer=host.querySelector("#p-welcome"),settings=host.querySelector("#p-cookies"),banner=host.querySelector(".p-cookie-banner");
 const syncBanner=()=>{banner.hidden=!!consent||offer.open||settings.open};
 const markSeen=()=>{welcome={...welcome,seen:true};writeLocal(storage,MIMO_KEY,welcome)};
 const showOffer=()=>{if(welcome.claimed||!offer.showModal||offer.open||settings.open)return;offer.showModal();syncBanner()};
 const saveConsent=(analytics,marketing)=>{consent=createConsent(analytics,marketing);writeLocal(storage,COOKIE_KEY,consent);if(settings.open)settings.close();syncBanner()};
 const showSettings=()=>{if(!settings.showModal||settings.open||offer.open)return;host.querySelector("#p-cookie-analytics").checked=consent?.analytics===true;host.querySelector("#p-cookie-marketing").checked=consent?.marketing===true;settings.showModal();syncBanner()};
 offer.addEventListener("close",()=>{markSeen();syncBanner()});
 settings.addEventListener("close",syncBanner);
 host.addEventListener("click",e=>{
  const key=e.target.closest("[data-visitor]")?.dataset.visitor;
  if(key==="claim"){welcome={seen:true,claimed:true};writeLocal(storage,MIMO_KEY,welcome);offer.close();onClaim();syncBanner()}
  else if(key==="dismiss")offer.close();
  else if(key==="settings")showSettings();
  else if(key==="close-settings")settings.close();
  else if(key==="accept")saveConsent(true,true);
  else if(key==="reject")saveConsent(false,false);
  else if(key==="save-settings")saveConsent(host.querySelector("#p-cookie-analytics").checked,host.querySelector("#p-cookie-marketing").checked);
 });
 if(!welcome.seen&&!skipWelcome)showOffer();
 syncBanner();
 return {showOffer,showSettings};
}
