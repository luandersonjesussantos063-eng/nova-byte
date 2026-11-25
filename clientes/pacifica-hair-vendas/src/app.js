import {discountLabel} from "./promotions.mjs";
import "./styles.css";
import "./kaia-pink.css";
import { HERO_SLIDES, HERO_INTERVAL_MS, nextHeroIndex } from "./hero.mjs";
import { SAMPLE_PRODUCTS, CATEGORIES } from "./catalog.js";
import {BRANDS,parseCatalog,mergeCatalog} from "./catalog-import.mjs";
import {REVISTA_LINKS,REVISTA_REFERENCES} from "./revista-references.mjs";
import { brl, normalizeCart, cartTotals } from "./commerce.mjs";
import {mountVisitorOffers,readWelcome,welcomeTotals,WELCOME_CODE} from "./visitor-offers.mjs";
let visitorTools=null;
let welcomeClaimed=false;
try{welcomeClaimed=readWelcome(window.localStorage).claimed}catch{}

import {mountFreight,validSelection,cepDigits as shippingCepDigits,formatCep as shippingFormatCep} from "./shipping.mjs";
let freightUI=null,deliveryCep="",checkoutCep="";
let freightSelection=null;
try{freightSelection=JSON.parse(sessionStorage.getItem("pacifica-freight-preview")||"null");deliveryCep=freightSelection?.cep||"";}catch{}
const KEY = "pacifica-demo-v2";
const initial = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const state = {
  products: [],
  cart: normalizeCart(initial.cart),
  favorites: Array.isArray(initial.favorites) ? initial.favorites : [],
  // Public store terms and contact are not editable by visitor localStorage.
  config: { pixPercent: 5, cardPercent: 0, motoboyCents: 1290, ownCents: 990, whatsapp: "553180482304", instagram: "pacificahair_vendas" },
  filter: "Todos", brandFilter: "Todas", cycleFilter: "18/2026", query: "", showAll: false, showAbout: false, favoritesView: false, heroSlide: 0, cartOpen: false, adminOpen: false, adminTab: "produtos", adminEdit: null,
  addedProductId: null, checkoutOpen: false, payment: "pix", shipping: "motoboy", menuOpen: false, detailId: null, sortBy: "featured", priceRange: "all", filterOpen: false, toast: ""
};
const icons = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16l-1 13H5L4 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 2h3l3 14h13l2-10H5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20.7 11.5A8.7 8.7 0 0 1 7.8 19L3 20l1.1-4.6A8.7 8.7 0 1 1 20.7 11.5Z"/><path d="M8.5 7.5c0 4 3 7.1 7.4 8.4.8.2 1.9-1.3 1.4-1.7l-2-1-1.3 1c-1.9-.8-3.5-2.4-4.1-4.2l.9-1.1-1.2-2c-.3-.4-1.1 0-1.1.6Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 3 6v6c0 5 3.5 8 9 10 5.5-2 9-5 9-10V6L12 2Z"/><path d="m8 12 3 3 5-6"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 5h13v12H1zM14 9h5l4 4v4h-9z"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m5 5 14 14M19 5 5 19"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M4 22c0-5 3-8 8-8s8 3 8 8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>'
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
function persist() {
  localStorage.setItem(KEY, JSON.stringify({ cart: state.cart, favorites: state.favorites }));
}
function count() { return state.cart.reduce((n, p) => n + p.qty, 0); }
function cartQuoteItems(){return cartTotals(state.cart,state.products,state.config).entries.map(x=>({id:x.id,qty:x.qty}));}
function activeFreight(){const cep=state.checkoutOpen?checkoutCep:deliveryCep;return validSelection(freightSelection,cartQuoteItems(),cep)?freightSelection:null;}
function shippingCents() { if(state.shipping==="superfrete")return activeFreight()?.cents??null;return state.shipping === "retirada" ? 0 : (state.shipping === "propria" ? Number(state.config.ownCents) : Number(state.config.motoboyCents)); }
function totals() {
  const t = welcomeTotals(cartTotals(state.cart, state.products, state.config),state.config,welcomeClaimed);
  return { ...t, totalCents: shippingCents()===null?null:(state.payment === "pix" ? t.pixTotalCents : t.cardTotalCents) + shippingCents() };
}
function productArt(p) {
  if (p.image && /^https?:\/\/|^\//i.test(p.image))
    return '<img class="p-catalog-real-image" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" />';
  if(p.catalog)return '<div class="product-art p-catalog-no-photo"><span>'+esc(p.brand)+'</span><small>Foto a confirmar</small></div>';
  // Product shots cropped from the design reference for visual approval only.
  const referenceIndex = ["demo-1", "demo-2", "demo-3", "demo-4"].indexOf(p.id);
  if (p.demo && referenceIndex >= 0)
    return '<div class="product-art reference-product reference-product-' + referenceIndex + '" role="img" aria-label="Imagem ilustrativa de ' + esc(p.name) + '"></div>';
  const id = String(p.artKind || "");
  if (id === "pink-perfume" || id === "natura-perfume") {
    const round = id === "natura-perfume";
    return '<div class="product-art art-photo art-' + esc(p.accent || "rose") + '"><div class="product-bottle ' + (round ? "bottle-round" : "") + '">' +
      '<div class="bottle-spray"></div><div class="bottle-neck"></div><div class="bottle-glass"><span>' + (round ? "natura<br/><small>tododia</small>" : "EGEO") + '</span></div></div></div>';
  }
  if (id === "lingerie") {
    return '<div class="product-art art-photo art-lingerie"><svg viewBox="0 0 240 225" class="lingerie-illustration" aria-label="Conjunto de lingerie bordô"><defs><linearGradient id="burg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7d1239"/><stop offset=".5" stop-color="#a3164e"/><stop offset="1" stop-color="#4e092f"/></linearGradient><pattern id="lace" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6Q6 0 12 6Q6 12 0 6" fill="none" stroke="#f4a1b7" stroke-width=".7" opacity=".75"/></pattern></defs><path d="M34 59q7-9 12 0l9 42q37 21 53-3l10-20 12 20q16 24 53 3l9-42q4-9 12 0l-6 59q-57 29-70 3-15 26-77-3Z" fill="url(#burg)" stroke="#5b1030" stroke-width="2"/><path d="M34 59q7-9 12 0l9 42q37 21 53-3l10-20 12 20q16 24 53 3l9-42q4-9 12 0l-6 59q-57 29-70 3-15 26-77-3Z" fill="url(#lace)"/><path d="M35 59l-8-31M203 59l10-31M46 122h149l-14 60-64 28-65-28Z" fill="url(#burg)" stroke="#5b1030" stroke-width="2"/><path d="M46 122h149l-14 60-64 28-65-28Z" fill="url(#lace)"/><path d="M53 126q65 37 133 0" fill="none" stroke="#fab3c2" stroke-width="3"/></svg></div>';
  }
  if (id === "cream") return '<div class="product-art art-photo art-cream"><div class="cream-pot"><div class="cream-lid"></div><div class="cream-body"><span>natura<em>tododia</em><small>creme hidratante</small></span></div></div></div>';
  return '<div class="product-art art-' + esc(p.accent || "rose") + '"><div class="art-glow"></div><span>' + esc(p.symbol || "✿") + '</span><i>Pacífica</i></div>';
}
function displayPrice(p){const n=discountLabel(p);return '<div class="price-line n-promo-price">'+(n?'<del>'+brl(p.compareCents)+'</del>':"")+'<div class="n-current-price"><strong>'+brl(p.priceCents)+'</strong>'+(n?'<span class="n-discount-badge">-'+n+'%</span>':"")+'</div></div>';}
function productCard(p) {
 const fav=state.favorites.includes(p.id);
  return '<article class="product-card n-product-card"><div class="product-media"><button type="button" class="n-product-image" data-action="detail" data-id="'+esc(p.id)+'" aria-label="Ver detalhes de '+esc(p.name)+'">'+productArt(p)+'</button>'+'<button class="fav '+(fav?"selected":"")+'" data-action="fav" data-id="'+esc(p.id)+'" aria-label="'+(fav?"Remover dos favoritos":"Favoritar")+'" aria-pressed="'+fav+'">'+icons.heart+'</button></div>'+
 '<div class="product-info"><small class="n-product-brand">'+esc(p.brand||"Pacífica Hair")+'</small><button class="n-product-name" data-action="detail" data-id="'+esc(p.id)+'">'+esc(p.name)+'</button>'+displayPrice(p)+
 '<button class="primary product-buy" data-action="'+(p.stock>0?"add":"detail")+'" data-id="'+esc(p.id)+'">'+(p.stock>0?"adicionar à sacola":"consultar disponibilidade")+'</button></div></article>';
}
function logo() {
  return '<a href="#inicio" data-action="home" class="brand" aria-label="Pacífica Hair, início"><span class="brand-mark"><span class="brand-bottle" aria-hidden="true"><svg viewBox="0 0 56 72" fill="none" stroke="#74505b" stroke-width="1.5"><path d="M26 9V4h8v5M25 9h10l3 6-2 3 6 13 3 26c.3 4-2 7-7 7H15c-5 0-7-3-7-7l3-26 7-13-2-3 3-6h6Z"/><path d="M17 35q6-8 13-7m-15 14q6-6 14-6m-15 15q8-5 17-5M6 26l9-9M4 33l8-8" stroke-width="1.1"/><path d="M30 4V0M24 6l-4-3M36 6l4-3"/></svg></span><span class="brand-inside">Pacífica <em>Hair</em><small>Cosméticos, Perfumaria,<br/>cabelos e cia</small></span></span><span class="brand-mobile-name">Pacífica Hair</span></a>';
}
const NAV_CATEGORIES=[["Todos","para você"],["Promoções","promoções"],["Presentes","presentes"],["Perfumes","perfumaria"],["Cuidados Pessoais","corpo e banho"],["Cabelos","cabelos"],["Maquiagem","maquiagem"],["Cosméticos","cosméticos"],["Roupas íntimas","roupas íntimas"],["Avon","avon"],["Natura","natura"]];
function navButtons(){
 return NAV_CATEGORIES.map(([key,label])=>'<button type="button" data-category="'+esc(key)+'" class="'+(key==="Promoções"?'nav-offer ':"")+((BRANDS.includes(key)?state.brandFilter===key:state.filter===key&&state.brandFilter==="Todas")?'selected':"")+'">'+esc(label)+'</button>').join("");
}
let customer=null, accountChecked=false, accountGeneration=0, signingOut=false;
let authPromise;
function storeAuth(){const moduleUrl=new URL("/pacifica-auth.mjs",location.origin).href;return authPromise??=import(/* @vite-ignore */ moduleUrl);}
function accountLinks(){
 if(!accountChecked)return '<a href="/conta.html">Minha conta</a>';
 if(!customer)return '<a href="/conta.html">Entrar</a><a href="/conta.html?modo=cadastro">Criar conta</a>';
 const name=String(customer.user_metadata?.pacifica_name||"").trim().split(/\s+/)[0].slice(0,40);
 return (name?'<p class="p-customer-greeting">Olá, '+esc(name)+'!</p>':'<p class="p-customer-greeting">Olá! Você está conectado.</p>')+'<a href="/conta.html">Minha conta</a><a href="/conta.html?aba=pedidos">Meus pedidos</a><button type="button" data-action="customer-logout">Sair da conta</button>';
}
function updateAccountMenu(){
 const links=document.querySelector('[data-customer-links]');if(links)links.innerHTML=accountLinks();
 const icon=document.querySelector('.p-account');if(icon){icon.classList.toggle('is-signed-in',!!customer);icon.setAttribute('aria-label',customer?'Minha conta, conectado':'Minha conta');}
}
async function refreshCustomer(){
 const generation=++accountGeneration;
 try{const a=await storeAuth();if(!a.authClient())return;const user=await a.verifiedUser();if(generation!==accountGeneration)return;customer=user;accountChecked=true;updateAccountMenu();}
 catch{if(generation===accountGeneration){customer=null;accountChecked=false;updateAccountMenu();}}
}
async function startCustomerSession(){
 try{const a=await storeAuth(),sb=a.authClient();if(!sb)return;sb.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT"){++accountGeneration;customer=null;accountChecked=true;updateAccountMenu();}else if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="INITIAL_SESSION"||event==="USER_UPDATED")setTimeout(refreshCustomer,0);});await refreshCustomer();}
 catch{}
}
async function logoutCustomer(){
 if(signingOut)return;signingOut=true;
 try{const a=await storeAuth(),sb=a.authClient();if(!sb)throw Error();const {error}=await sb.auth.signOut({scope:"local"});if(error)throw error;++accountGeneration;customer=null;accountChecked=true;updateAccountMenu();notify("Você saiu da sua conta.");}
 catch{notify("Não foi possível sair. Tente novamente.");}finally{signingOut=false;}
}
function header() {
 return '<header class="p-header n-header"><div class="n-top-links"><a href="#inicio" data-action="home">pacífica hair</a><a href="#sobre" data-action="about">sobre a loja</a><a href="#produtos" data-category="Avon">avon</a><a href="#produtos" data-category="Natura">natura</a><a href="#contato">atendimento</a><span>Entrega na Grande BH</span></div>'+
 '<div class="p-header-main n-pill"><button class="p-header-icon p-hamburger" data-action="menu" aria-label="Abrir menu" aria-expanded="'+state.menuOpen+'"><span></span><span></span><span></span></button>'+
 '<button class="p-header-icon p-favorites '+(state.favoritesView?"selected":"")+'" data-action="favorites" aria-label="Favoritos" aria-pressed="'+state.favoritesView+'">'+icons.heart+(state.favorites.length?'<span class="p-count">'+state.favorites.length+'</span>':"")+'</button>'+
 '<div class="p-brand-wrap">'+logo()+'</div>'+
 '<div class="p-search-row"><form class="p-search" id="n-search-form" role="search"><input id="search" type="search" placeholder="o que está buscando hoje?" aria-label="Pesquisar produtos" autocomplete="off" value="'+esc(state.query)+'"><button type="submit" aria-label="Buscar">'+icons.search+'</button></form><div id="n-suggestions" class="n-suggestions" hidden></div></div>'+
 '<a class="p-header-icon p-account '+(customer?'is-signed-in':'')+'" href="/conta.html" aria-label="'+(customer?'Minha conta, conectado':'Minha conta')+'">'+icons.user+'<span>minha conta</span></a>'+
 '<button class="p-header-icon p-bag" data-action="cart" aria-label="Abrir sacola">'+icons.bag+(count()?'<span class="p-bag-count">'+count()+'</span>':"")+'</button></div>'+
 '<nav class="p-categories n-nav" aria-label="Categorias"><div class="p-category-scroller">'+navButtons()+'</div><div class="n-nav-arrows"><button data-action="nav-prev" aria-label="Categorias anteriores">‹</button><button data-action="nav-next" aria-label="Próximas categorias">›</button></div></nav>'+
 (state.menuOpen?'<div class="p-menu-backdrop" data-action="menu-close"></div><nav class="p-menu-panel" aria-label="Menu principal"><div class="p-menu-head">Pacífica Hair <button data-action="menu-close" aria-label="Fechar menu">'+icons.close+'</button></div><div class="p-customer-links" data-customer-links>'+accountLinks()+'</div><button data-action="favorites">Meus favoritos</button><button data-action="home">Início</button><span class="n-menu-caption">Compre por categoria</span>'+navButtons()+'<a href="#sobre" data-action="about">Nossa história</a><a href="#contato" data-action="menu-close">Atendimento</a></nav>':"")+'</header>';
}
function hero() {
  const current=HERO_SLIDES[state.heroSlide];
  return '<section class="p-hero" id="inicio" aria-label="Destaques da Pacífica Hair" aria-roledescription="carrossel">' +
    '<div class="p-hero-visual">' +
      HERO_SLIDES.map((slide,i)=>'<img class="p-slide-image '+(i===state.heroSlide?'is-active':'')+'" src="'+slide.src+'" alt="'+slide.alt+'" '+(i===0?'fetchpriority="high"':'loading="eager"')+' decoding="async" aria-hidden="'+(i!==state.heroSlide)+'" />').join("") +
    '</div><div class="p-hero-overlay"></div><button class="p-hero-next-tap" type="button" data-action="hero-next" aria-label="Ver próxima foto do destaque"></button><div class="p-hero-body">' +
    '<div class="p-hero-copy" aria-live="off" aria-atomic="true"><span class="p-hero-eyebrow">'+current.tag+'</span><h1 class="p-hero-heading">'+current.title+'</h1><p class="p-hero-description">'+current.description+'</p><a href="#produtos" class="p-hero-cta"><span class="p-hero-cta-label">'+current.cta+'</span> <span aria-hidden="true">↗</span></a></div>' +
    '<div class="p-hero-carousel">' +
    '<div class="p-hero-dots" aria-label="Escolher imagem">' +
    HERO_SLIDES.map((slide,i)=>'<button class="'+(state.heroSlide===i?'active':'')+'" data-action="hero-dot" data-slide="'+i+'" aria-label="Imagem '+(i+1)+' de '+HERO_SLIDES.length+'" aria-current="'+(state.heroSlide===i)+'"></button>').join("") +
    '</div><span class="p-hero-index">0'+(state.heroSlide+1)+' / 0'+HERO_SLIDES.length+'</span></div></div>' +
    '</section>';
}
function setHeroSlide(nextIndex) {
  state.heroSlide = nextHeroIndex(nextIndex,0);
  const hero=document.getElementById("inicio");
  if(!hero)return;
  const current=HERO_SLIDES[state.heroSlide];
  hero.querySelectorAll(".p-slide-image").forEach((img,i)=>{
    img.classList.toggle("is-active",i===state.heroSlide);
    img.setAttribute("aria-hidden",String(i!==state.heroSlide));
  });
  hero.querySelector(".p-hero-eyebrow").textContent=current.tag;
  hero.querySelector(".p-hero-heading").innerHTML=current.title;
  hero.querySelector(".p-hero-description").textContent=current.description;
  hero.querySelector(".p-hero-cta-label").textContent=current.cta;
  hero.querySelectorAll(".p-hero-dots button").forEach((dot,i)=>{
    dot.classList.toggle("active",i===state.heroSlide);
    dot.setAttribute("aria-current",String(i===state.heroSlide));
  });
  hero.querySelector(".p-hero-index").textContent="0"+(state.heroSlide+1)+" / 0"+HERO_SLIDES.length;
}
let heroPointerPaused=false;
let heroManuallyPaused=false;
let heroTouchX=null;
function activateHeroAutoplay() {
  if(typeof window==="undefined"||typeof window.setInterval!=="function")return;
  window.setInterval(()=>{
    if(document.hidden || heroPointerPaused || heroManuallyPaused || state.detailId || state.cartOpen || state.checkoutOpen || state.adminOpen || state.menuOpen)return;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
    setHeroSlide(nextHeroIndex(state.heroSlide));
  },HERO_INTERVAL_MS);
}
document.addEventListener("pointerover",e=>{
  if(e.pointerType==="mouse" && e.target.closest?.("#inicio"))heroPointerPaused=true;
});
document.addEventListener("pointerout",e=>{
  if(e.pointerType==="mouse" && e.target.closest?.("#inicio") && !e.relatedTarget?.closest?.("#inicio"))heroPointerPaused=false;
});
document.addEventListener("touchstart",e=>{
  if(e.target.closest?.("#inicio")) {
    heroTouchX=e.changedTouches[0]?.clientX ?? null;
    heroPointerPaused=true;
  }
},{passive:true});
document.addEventListener("touchend",e=>{
  if(heroTouchX!==null) {
    const dx=(e.changedTouches[0]?.clientX ?? heroTouchX)-heroTouchX;
    heroTouchX=null;
    heroPointerPaused=false;
    if(Math.abs(dx)>55)setHeroSlide(nextHeroIndex(state.heroSlide,dx<0?1:-1));
  }
},{passive:true});
document.addEventListener("touchcancel",()=>{heroTouchX=null;heroPointerPaused=false;},{passive:true});

function whatsappLink(message="Olá! Gostaria de saber mais sobre os produtos da Pacífica Hair.") {
 const digits=String(state.config.whatsapp||"").replace(/\D/g,"");
 const phone=digits.length===10||digits.length===11?"55"+digits:digits;
 return /^55\d{10,11}$/.test(phone)?"https://wa.me/"+phone+(message?"?text="+encodeURIComponent(message):""):"";
}
function instagramLink(){
 const user=String(state.config.instagram||"").trim().replace(/^@/,"");
 return /^[\w.]{1,30}$/.test(user)?"https://www.instagram.com/"+user+"/":"";
}
function floatingContact(){
 const url=whatsappLink();
 return url?'<a class="n-whatsapp-float" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" aria-label="Fale com a Pacífica Hair pelo WhatsApp">'+icons.whatsapp+'</a>':"";
}
function pinkBenefits() {
  return '<section class="p-benefits" aria-label="Diferenciais da Pacífica">' +
    '<a href="'+esc(whatsappLink()||"#contato")+'" '+(whatsappLink()?'target="_blank" rel="noopener noreferrer"':"")+'><span aria-hidden="true">↗</span>Atendimento pelo<br>WhatsApp</a>' +
    '<a href="#produtos"><span aria-hidden="true">♡</span>Uma seleção<br>para você</a>' +
    '<a href="#produtos" data-category="Promoções"><span aria-hidden="true">☰</span>Ofertas e<br>novidades</a>' +
    '</section>';
}
function pinkFooter(){
 const waUrl=whatsappLink();
 const igUrl=instagramLink();
 return '<footer class="p-footer p-footer-compact" id="contato"><div class="p-footer-inner">'+
 '<div class="p-footer-trust" aria-label="Atendimento e proteção">'+
 '<span>'+icons.shield+' Navegação protegida</span>'+
 '<span>'+icons.whatsapp+' Atendimento direto</span>'+
 '<a href="/privacidade.html">'+icons.user+' Privacidade</a>'+
 '</div>'+
 '<div class="p-footer-core"><div class="p-footer-identity"><a class="p-footer-brand" href="#inicio" data-action="home" aria-label="Pacífica Hair, início">Pacífica <small>HAIR</small></a>'+
 '<div class="p-footer-social">'+
 (waUrl?'<a href="'+esc(waUrl)+'" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp da Pacífica Hair">'+icons.whatsapp+'</a>':'')+
 (igUrl?'<a href="'+esc(igUrl)+'" target="_blank" rel="noopener noreferrer" aria-label="Instagram da Pacífica Hair">'+icons.instagram+'</a>':'')+
 '</div></div>'+
 '<nav class="p-footer-column" aria-label="Atendimento"><strong>Atendimento</strong>'+
 (waUrl?'<a href="'+esc(waUrl)+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':'<span>WhatsApp em configuração</span>')+
 (igUrl?'<a href="'+esc(igUrl)+'" target="_blank" rel="noopener noreferrer">Instagram</a>':'')+
 '</nav>'+
 '<nav class="p-footer-column" aria-label="Minha conta"><strong>Minha conta</strong><a href="/conta.html">Entrar / cadastrar</a><a href="/conta.html?aba=pedidos">Meus pedidos</a></nav>'+
 '<nav class="p-footer-column" aria-label="Informações"><strong>Informações</strong><a href="/entregas-e-trocas.html">Entregas e trocas</a><a href="/privacidade.html">Privacidade</a></nav>'+
 '</div><div class="p-footer-bottom"><span>© 2026 Pacífica Hair</span>'+
 '<div class="p-footer-legal"><button type="button" class="p-footer-pref" data-action="cookie-settings">Cookies</button><span aria-hidden="true">·</span><span>Desenvolvido por <a href="https://novabytesolucoes.com.br/" target="_blank" rel="noopener noreferrer">NovaByte</a></span></div></div>'+
 '</div></footer>';
}

let sharedCatalog=null,catalogLoadError=false;
function catalogItems(){
 // Display only confirmed server data; never substitute demo catalog when API is unavailable.
 return Array.isArray(sharedCatalog)?sharedCatalog:[];
}
function categories(){
 const rows=catalogItems();
 const keys=NAV_CATEGORIES.filter(([key])=>!["Todos"].includes(key));
 return '<section class="wrap n-category-section" aria-label="Compre por categoria"><h2>encontre a categoria perfeita para você</h2><div class="n-category-tiles">'+keys.map(([key,label])=>{
 const p=rows.find(x=>x.image&&(BRANDS.includes(key)?x.brand===key:key==="Promoções"?x.compareCents>x.priceCents:x.category===key));
 return '<button data-category="'+esc(key)+'"><span class="n-category-circle">'+(p?'<img src="'+esc(p.image)+'" alt="" loading="lazy">':(key==="Promoções"?"%":key==="Cabelos"?"✦":key==="Roupas íntimas"?"♡":"✿"))+'</span><strong>'+esc(label)+'</strong></button>';
 }).join("")+'</div></section>';
}
function featuredShelves(){
 if(state.query||state.filter!=="Todos"||state.brandFilter!=="Todas"||state.favoritesView)return "";
 const rows=catalogItems();
 return '<section class="wrap n-shelves"><h2>aproveite o melhor da Pacífica</h2><div class="n-shelf-links">'+[["Avon","seleção Avon"],["Natura","seleção Natura"],["Presentes","presentes especiais"],["Perfumes","perfumaria"]].map(([key,label])=>'<button data-category="'+key+'">'+label+' <span>›</span></button>').join("")+'</div>'+["Avon","Natura"].map(brand=>{
 const p=rows.filter(x=>x.brand===brand).slice(0,6);
 return p.length?'<section class="n-shelf"><div class="n-shelf-head"><h3>destaques '+brand+'</h3><button data-category="'+brand+'">ver todos ›</button></div><div class="n-shelf-track">'+p.map(productCard).join("")+'</div></section>':"";
 }).join("")+'</section>';
}
function searchSuggestions(){
 const el=document.getElementById("n-suggestions");if(!el)return;
 const q=state.query.trim().toLowerCase();const hits=q?catalogItems().filter(p=>(p.name+" "+(p.brand||"")+" "+(p.code||"")).toLowerCase().includes(q)).slice(0,5):[];
 el.hidden=!hits.length;
 el.innerHTML=hits.map(p=>'<button data-action="detail" data-id="'+esc(p.id)+'">'+(p.image?'<img src="'+esc(p.image)+'" alt="">':"")+'<span>'+esc(p.name)+'<small>'+brl(p.priceCents)+'</small></span></button>').join("");
}
function detailModal(){
 const p=catalogItems().find(x=>x.id===state.detailId);if(!p)return "";
 const href=whatsappLink("Olá! Gostaria de consultar a disponibilidade de "+p.name+(p.code?" (código "+p.code+")":"")+".");
 return '<div class="n-detail-backdrop" data-action="close-detail"><section class="n-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhes do produto"><button class="n-detail-close" data-action="close-detail" aria-label="Fechar">'+icons.close+'</button><div class="n-detail-visual">'+productArt(p)+(Array.isArray(p.images)&&p.images.length>1?'<div style="display:flex;gap:6px;overflow:auto">'+p.images.map(src=>'<a href="'+esc(src)+'" target="_blank" rel="noopener noreferrer"><img style="width:54px;height:54px;object-fit:contain" src="'+esc(src)+'" alt="Foto adicional"></a>').join("")+'</div>':"")+'</div><div class="n-detail-info"><span class="n-product-brand">'+esc(p.brand||"Pacífica Hair")+'</span><h2>'+esc(p.name)+'</h2>'+(p.code?'<small>Código '+esc(p.code)+'</small>':"")+displayPrice(p)+'<p>'+esc(p.reference?"Disponibilidade a confirmar com a consultora.":p.description||"Consulte as condições de entrega.")+'</p>'+(p.catalog?'<p>Preço de referência do catálogo vigente da loja.</p>':"")+(p.stock>0?'<button class="p-freight-trigger" type="button" data-action="freight-product" data-id="'+esc(p.id)+'">'+icons.truck+' Calcular frete pelo CEP</button>':'')+
 (p.stock>0?'<button class="primary" data-action="add" data-id="'+esc(p.id)+'">adicionar à sacola</button>':href?'<a class="primary" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp</a>':'<a class="primary" href="#contato" data-action="contact-detail">Consultar atendimento</a>')+'<button class="n-detail-favorite" data-action="fav" data-id="'+esc(p.id)+'">'+icons.heart+(state.favorites.includes(p.id)?"Remover dos favoritos":"Salvar nos favoritos")+'</button></div></section></div>';
}
function revistaSelectors(){
 return '<div class="p-revista"><h3>Avon e Natura — Ciclo 18/2026</h3><p>Seleção da revista 18 com fotos e preços de referência. Disponibilidade e condições sujeitas à confirmação da consultora.</p><div class="p-revista-links">'+REVISTA_LINKS.map(r=>'<a href="'+r[2]+'" target="_blank" rel="noopener noreferrer">Consultar revista '+r[0]+' ↗</a>').join("")+'</div></div>';
}
function shop(){
 let selected=catalogItems().filter(p=>(state.brandFilter==="Todas"||p.brand===state.brandFilter)&&(!state.query||(p.name+" "+p.category+" "+(p.brand||"")+" "+(p.code||"")).toLowerCase().includes(state.query.toLowerCase()))&&(state.filter==="Todos"||(state.filter==="Promoções"?p.compareCents>p.priceCents:p.category===state.filter))&&(!state.favoritesView||state.favorites.includes(p.id))&&(state.priceRange==="all"||(state.priceRange==="low"?p.priceCents<=5000:state.priceRange==="mid"?p.priceCents>5000&&p.priceCents<=10000:p.priceCents>10000)));
 if(state.sortBy==="low")selected.sort((a,b)=>a.priceCents-b.priceCents);
 if(state.sortBy==="high")selected.sort((a,b)=>b.priceCents-a.priceCents);
 if(state.sortBy==="name")selected.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 const visible=state.showAll||state.filter!=="Todos"||state.brandFilter!=="Todas"||state.query||state.favoritesView||state.priceRange!=="all"?selected:selected.slice(0,12);
 const title=state.favoritesView?"Seus favoritos":state.query?"Resultados da busca":state.filter!=="Todos"?state.filter:state.brandFilter!=="Todas"?state.brandFilter:"Nossos produtos";
 const opts=(list,current)=>list.map(([v,l])=>'<option value="'+v+'" '+(current===v?"selected":"")+'>'+l+'</option>').join("");
 return '<section class="wrap shop n-shop" id="produtos"><div class="n-breadcrumb"><button data-action="home">início</button> › '+esc(title)+'</div><h2 class="n-shop-title">'+esc(title)+'</h2><div class="n-shop-toolbar"><span>'+selected.length+' produtos encontrados</span><button class="n-filter-toggle" data-action="filters" aria-expanded="'+state.filterOpen+'">☷ filtros</button><label>ordenar por <select name="catalog-sort">'+opts([["featured","Destaques"],["low","Menor preço"],["high","Maior preço"],["name","Nome A–Z"]],state.sortBy)+'</select></label></div>'+
 (state.filterOpen?'<div class="n-filter-panel"><label>Preço <select name="catalog-price">'+opts([["all","Todos"],["low","Até R$ 50"],["mid","R$ 50 a R$ 100"],["high","Acima de R$ 100"]],state.priceRange)+'</select></label><button data-action="clear-filters">Limpar filtros</button></div>':"")+
 '<div class="p-brand-filters" aria-label="Filtrar por marca">'+["Todas",...BRANDS].map(b=>'<button data-action="brand-filter" data-brand="'+esc(b)+'" class="'+(state.brandFilter===b?"active":"")+'" aria-pressed="'+(state.brandFilter===b)+'">'+esc(b)+'</button>').join("")+'</div><div class="product-grid">'+(visible.length?visible.map(productCard).join(""):(catalogLoadError?'<div class="empty-results" role="status">Não foi possível carregar o catálogo. Nenhum produto de exemplo será exibido. <button type="button" data-action="reload-catalog">Tentar novamente</button></div>':sharedCatalog===null?'<div class="empty-results" role="status">Carregando produtos da loja...</div>':'<div class="empty-results">Nenhum produto encontrado. <button data-action="clear-filters">Ver todos os produtos</button></div>'))+'</div>'+
 (selected.length>visible.length?'<div class="n-more"><button class="outline-btn" data-action="toggle-all">ver todos os produtos ›</button></div>':"")+'</section>';
}
function about() {
  return '<section class="about-section" id="sobre"><div class="wrap about-grid"><div class="about-image"><div class="about-frame"><img src="/assets/gleizelle.webp" alt="Gleizelle, curadoria de beleza e autocuidado" /><div class="about-overlay"><span>Nossa história</span><h3>Gleizelle</h3><p>Beleza, cuidado e atendimento de perto.</p></div></div></div>' +
    '<div class="about-copy"><span class="eyebrow">Conheça quem está por trás da Pacífica</span><h2>Mais que produtos,<br /><em>um carinho com você.</em></h2><p>A Pacífica Hair nasceu da paixão por beleza, autoestima e autocuidado. Aqui, cada escolha é feita pensando no que faz você se sentir bem.</p><p>Sou Gleizelle e quero que sua experiência seja acolhedora, simples e especial — da escolha até a entrega.</p><a class="outline-btn" href="#contato">Fale com a gente ' + icons.arrow + '</a></div></div></section>';
}
function cartProductPhoto(id) {
  const product=state.products.find(p=>p.id===id);
  const image=product&&[product.image,...(Array.isArray(product.images)?product.images:[])].find(src=>typeof src==="string"&&(/^(https:\/\/|\/(?!\/))/i.test(src)));
  return '<span class="cart-icon'+(image?' cart-photo':'')+'"><span class="cart-photo-fallback" aria-hidden="true">✿</span>'+(image?'<img src="'+esc(image)+'" alt="" width="55" height="55" decoding="async" />':'')+'</span>';
}
function addedProductModal() {
 const p=state.products.find(item=>item.id===state.addedProductId);
 if(!p)return "";
 const inCart=new Set(state.cart.map(row=>String(row.id)));
 const suggestions=state.products.filter(item=>item.id!==p.id&&item.stock>0&&item.priceCents>0&&!inCart.has(String(item.id))&&item.image).sort((a,b)=>Number(b.category===p.category)-Number(a.category===p.category)).slice(0,6);
 const cards=suggestions.map(item=>'<article class="p-added-offer">'+
 '<button class="p-added-offer-image" type="button" data-action="added-view" data-id="'+esc(item.id)+'" aria-label="Ver '+esc(item.name)+'"><img src="'+esc(item.image)+'" alt="" loading="lazy" /></button>'+
 '<div class="p-added-offer-body"><small>'+esc(item.brand||"Pacífica Hair")+'</small><strong>'+esc(item.name)+'</strong><b>'+brl(item.priceCents)+'</b>'+
 '<button type="button" data-action="added-recommend" data-id="'+esc(item.id)+'" aria-label="Adicionar '+esc(item.name)+' à sacola">+ Adicionar</button></div></article>').join("");
 return '<div class="p-added-backdrop" data-action="added-close"><section class="p-added-dialog" role="dialog" aria-modal="true" aria-labelledby="p-added-title">'+
 '<header class="p-added-header"><h2 id="p-added-title">✓ Adicionado à sacola!</h2><button type="button" data-action="added-close" aria-label="Fechar">'+icons.close+'</button></header>'+
 '<div class="p-added-product">'+cartProductPhoto(p.id)+'<div><strong>'+esc(p.name)+'</strong><small>'+esc(p.brand||"Pacífica Hair")+'</small><b>'+brl(p.priceCents)+'</b></div></div>'+
 (cards?'<div class="p-added-more"><h3>Aproveite e adicione à sua sacola</h3><p>Outros produtos selecionados para você.</p><div class="p-added-track">'+cards+'</div></div>':'')+
 '<footer class="p-added-actions"><small>'+count()+' '+(count()===1?'item':'itens')+' na sua sacola</small><button type="button" class="p-added-go" data-action="added-bag">Ir para a sacola →</button><button type="button" class="p-added-keep" data-action="added-close">Continuar comprando</button></footer></section></div>';
}
function cartDrawer() {
  if (!state.cartOpen) return "";
  const t = totals();
  const consultation=whatsappLink("Olá! Gostaria de consultar a disponibilidade destes itens na Pacífica Hair:\n"+t.entries.map(p=>p.qty+"x "+p.name+" — "+brl(p.lineCents)).join("\n")+"\nFavor confirmar preço, estoque e entrega antes do pedido.");
  return '<div class="overlay" data-action="close-cart"><aside class="drawer" role="dialog" aria-label="Sua sacola">' +
    '<div class="drawer-head"><div><span class="eyebrow">Seu carinho em forma de escolha</span><h2>Sua sacola (' + count() + ')</h2></div><button class="icon-btn" data-action="close-cart">' + icons.close + '</button></div>' +
    '<div class="drawer-items">' + (t.entries.length ? t.entries.map(p => '<div class="cart-row">'+cartProductPhoto(p.id)+'<div><strong>' + esc(p.name) + '</strong><small>' + brl(p.unitCents) + '</small><div class="qty"><button data-action="qty-minus" data-id="' + esc(p.id) + '">−</button><span>' + p.qty + '</span><button data-action="qty-plus" data-id="' + esc(p.id) + '">+</button></div></div><strong>' + brl(p.lineCents) + '</strong></div>').join("") : '<div class="empty-cart">Sua sacola está vazia. Que tal escolher algo especial?</div>') + '</div>' +
    '<div class="drawer-bottom"><div class="subtotal"><span>Subtotal</span><strong>' + brl(t.subtotalCents) + '</strong></div>'+(t.welcomeCents?'<div class="p-mimo-summary"><span>Mimo 5% · '+WELCOME_CODE+'</span><strong>− '+brl(t.welcomeCents)+'</strong></div><div class="subtotal p-mimo-net"><span>Subtotal com mimo</span><strong>'+brl(t.discountedSubtotalCents)+'</strong></div>':'')+''+(t.entries.length?'<button class="p-freight-trigger" type="button" data-action="freight-cart">'+icons.truck+' '+(activeFreight()?'Alterar frete':'Calcular frete pelo CEP')+'</button>'+(activeFreight()?'<div class="p-mimo-summary"><span>'+esc(activeFreight().name)+' · '+esc(shippingFormatCep(activeFreight().cep))+'</span><strong>'+brl(activeFreight().cents)+'</strong></div><p>Prazo estimado: '+activeFreight().days+' dias úteis.</p>':'<p>Consulte o frete antes de continuar.</p>'):'')+(t.entries.length?'<button class="primary wide" type="button" data-action="delivery-checkout">Continuar para entrega '+icons.arrow+'</button>'+(consultation?'<a class="p-cart-whatsapp" href="'+esc(consultation)+'" target="_blank" rel="noopener noreferrer">Consultar sacola pelo WhatsApp</a>':''):'<button class="primary wide" type="button" disabled>Adicione um produto para continuar</button>')+'<p>Consulte o frete e confirme a disponibilidade antes da compra. O pagamento online não está habilitado.</p>'+'<button class="ghost wide" data-action="close-cart">Continuar comprando</button></div></aside></div>';
}
function checkoutModal() {
  if (!state.checkoutOpen) return "";
  const t = totals();
  const discount = Number(state.config.pixPercent || 0);
  return '<div class="overlay modal-layer" data-action="close-checkout"><section class="modal checkout-modal" role="dialog" aria-label="Resumo do pedido">' +
    '<button class="modal-close icon-btn" data-action="close-checkout">' + icons.close + '</button><span class="eyebrow">Resumo do pedido</span><h2>Quase lá!</h2><p>Confira o resumo. O pagamento online está temporariamente indisponível.</p>' +
    '<h3>Forma de pagamento</h3><div class="radio-grid"><label><input type="radio" name="payment" value="pix" ' + (state.payment === "pix" ? "checked" : "") + '/>Pix' + (discount ? " · " + discount + "% de desconto" : "") + '</label><label><input type="radio" name="payment" value="card" ' + (state.payment === "card" ? "checked" : "") + '/>Cartão</label></div>' +
    '<h3>Forma de entrega</h3><div class="radio-grid"><label><input type="radio" name="shipping" value="superfrete" '+(state.shipping==="superfrete"?"checked":"")+'/>Correios · SuperFrete</label><label><input type="radio" name="shipping" value="motoboy" ' + (state.shipping === "motoboy" ? "checked" : "") + '/>Motoboy</label><label><input type="radio" name="shipping" value="propria" ' + (state.shipping === "propria" ? "checked" : "") + '/>Entrega própria</label><label><input type="radio" name="shipping" value="retirada" ' + (state.shipping === "retirada" ? "checked" : "") + '/>Retirada</label></div>' +
    (state.shipping==="superfrete"?'<button type="button" class="p-freight-trigger" data-action="freight-cart">'+icons.truck+' '+(activeFreight()?'Alterar modalidade':'Calcular frete para o endereço cadastrado')+'</button>'+(activeFreight()?'<p>'+esc(activeFreight().name)+' · '+activeFreight().days+' dias úteis</p>':'<p>Selecione uma opção de entrega.</p>'):'')+
    '<div class="summary-lines"><div><span>Produtos</span><strong>' + brl(t.subtotalCents) + '</strong></div>'+(t.welcomeCents?'<div><span>Mimo 5% · '+WELCOME_CODE+'</span><strong>− '+brl(t.welcomeCents)+'</strong></div>':'')+'<div><span>'+(state.shipping==="superfrete"?"Frete estimado":"Frete local ilustrativo")+'</span><strong>' + (shippingCents()===null?"A calcular":brl(shippingCents())) + '</strong></div><div><span>' + (state.payment === "pix" ? "Desconto Pix" : "Valor no cartão") + '</span><strong>' + brl(state.payment === "pix" ? t.pixTotalCents - t.discountedSubtotalCents : t.cardTotalCents - t.discountedSubtotalCents) + '</strong></div><div class="summary-final"><span>Total estimado</span><strong>' + (t.totalCents===null?"A calcular":brl(t.totalCents)) + '</strong></div></div>' +
    '<div class="locked-pay">Pagamento online temporariamente indisponível. Nenhuma cobrança será realizada.</div><button class="primary wide" disabled>Finalizar pagamento (em breve)</button></section></div>';
}
function catalogImportPanel(){
 return '<form id="catalog-import-form" class="admin-form"><h3>Importar catálogo por ciclo</h3><p>Use a revista fornecida pela consultora. Preços preservados em centavos; estoque novo começa em zero.</p><label>Marca<select name="brand"><option>Avon</option><option>Natura</option></select></label><label>Ciclo<input name="cycle" required placeholder="18/2026"></label><label>Fonte da revista<input name="source" required placeholder="Nome do PDF ou endereço oficial"></label><label>Dados CSV<textarea name="csv" rows="10" required placeholder="codigo;nome;categoria;preco;foto"></textarea></label><p>Separador ponto e vírgula. Preço: 39,90. Foto HTTPS autorizada ou vazia. A importação fica somente neste navegador de teste.</p><button class="primary">Importar e atualizar produtos</button></form>';
}
function adminPanel() {
  if (!state.adminOpen) return "";
  const p = state.products.find(x => x.id === state.adminEdit);
  return '<div class="overlay modal-layer" data-action="close-admin"><section class="modal admin-modal" role="dialog" aria-label="Painel de gestão">' +
    '<button class="modal-close icon-btn" data-action="close-admin">' + icons.close + '</button><span class="eyebrow">NovaByte · Gestão da loja</span><h2>Painel administrativo</h2>' +
    '<p class="admin-warning">Esta área é de uso interno. Os pagamentos online permanecem indisponíveis.</p>' +
    '<div class="admin-tabs"><button data-admin-tab="produtos" class="' + (state.adminTab === "produtos" ? "active" : "") + '">Produtos</button><button data-admin-tab="config" class="' + (state.adminTab === "catalogos" ? catalogImportPanel() : state.adminTab === "config" ? "active" : "") + '">Condições</button><button data-admin-tab="catalogos" class="' + (state.adminTab === "catalogos" ? "active" : "") + '">Catálogos</button></div>' +
    (state.adminTab === "config" ? '<form id="config-form" class="admin-form"><label>Desconto Pix (%)<input type="number" name="pixPercent" min="0" max="100" step="0.01" value="' + Number(state.config.pixPercent) + '" required /></label><label>Adicional cartão (%)<input type="number" name="cardPercent" min="0" max="100" step="0.01" value="' + Number(state.config.cardPercent) + '" required /></label><label>Motoboy (R$)<input name="motoboy" type="number" min="0" step="0.01" value="' + (state.config.motoboyCents / 100).toFixed(2) + '" required /></label><label>Entrega própria (R$)<input name="own" type="number" min="0" step="0.01" value="' + (state.config.ownCents / 100).toFixed(2) + '" required /></label><label>WhatsApp com DDD (opcional)<input name="whatsapp" type="tel" value="' + esc(state.config.whatsapp || "") + '" placeholder="31999999999" /></label><label>Instagram (usuário, opcional)<input name="instagram" value="' + esc(state.config.instagram || "") + '" placeholder="@pacifica" /></label><button class="primary">Salvar condições</button></form>' :
    '<div class="admin-list">' + state.products.map(item => '<div><span><strong>' + esc(item.name) + '</strong><small>' + esc(item.category) + ' · ' + brl(item.priceCents) + ' · Estoque: ' + item.stock + '</small></span><button class="edit-btn" data-action="edit" data-id="' + esc(item.id) + '">Editar</button></div>').join("") + '</div>' +
    '<button class="outline-btn" data-action="new-product">+ Novo produto</button>' +
    (state.adminEdit !== null ? '<form id="product-form" class="admin-form"><h3>' + (p ? "Editar produto" : "Adicionar produto") + '</h3><label>Nome<input required name="name" maxlength="100" value="' + esc(p?.name || "") + '" /></label><label>Categoria<select name="category">' + [...CATEGORIES,{name:"Maquiagem"}].filter(c => c.name !== "Promoções").map(c => '<option value="' + esc(c.name) + '" ' + (p?.category === c.name ? "selected" : "") + '>' + esc(c.name) + '</option>').join("") + '</select></label><label>Preço (R$)<input required type="number" min="0.01" step="0.01" name="price" value="' + (p ? (p.priceCents / 100).toFixed(2) : "") + '" /></label><label>Estoque<input required type="number" min="0" step="1" name="stock" value="' + (p?.stock ?? 0) + '" /></label><label>Foto do produto (URL, opcional)<input type="url" name="image" placeholder="https://..." value="' + esc(p?.image || "") + '" /></label><label>Descrição<textarea name="description" rows="3">' + esc(p?.description || "") + '</textarea></label><div class="form-actions"><button class="primary">Salvar produto</button>' + (p ? '<button type="button" class="danger" data-action="delete" data-id="' + esc(p.id) + '">Excluir</button>' : "") + '</div></form>' : "") ) +
    '</section></div>';
}
function notify(msg) {
  state.toast = msg;
  let n = document.querySelector(".toast");
  if (n) n.remove();
  n = document.createElement("div");
  n.className = "toast";
  n.textContent = msg;
  document.body.append(n);
  setTimeout(() => n.remove(), 2900);
}
function render({ retainSearch = false } = {}) {
  const active = retainSearch && document.activeElement?.id === "search";
  const pos = active ? document.getElementById("search")?.selectionStart : null;
  document.getElementById("app").innerHTML =
    header() + '<div class="p-prelaunch-notice" role="status">Pagamento online indisponível no momento. Para comprar, fale com nossa equipe pelo WhatsApp.</div><main class="p-site-main">' + hero() + categories() + featuredShelves() + shop() + pinkBenefits() + (state.showAbout ? about() : '') + pinkFooter() + floatingContact() + '</main>' +
    cartDrawer() + checkoutModal() + detailModal() + addedProductModal();

  document.body.classList.toggle("no-scroll", state.cartOpen || !!state.addedProductId || state.checkoutOpen || state.adminOpen || !!state.detailId || state.menuOpen);
  if (active) { const field = document.getElementById("search"); field?.focus(); field?.setSelectionRange(pos, pos); }
}
document.addEventListener("error",e=>{if(e.target instanceof HTMLImageElement&&e.target.closest(".cart-photo"))e.target.remove();},true);
document.addEventListener("click", e => {
  const a = e.target.closest("[data-action]");
  const cat = e.target.closest("[data-category]");
  const tab = e.target.closest("[data-admin-tab]");
  if (cat) {
    e.preventDefault();state.query="";state.detailId=null;state.priceRange="all";
    if(BRANDS.includes(cat.dataset.category)){state.brandFilter=cat.dataset.category;state.filter="Todos";}else{state.filter=cat.dataset.category;state.brandFilter="Todas";}
    state.favoritesView = false;
    state.showAll = true;
    state.menuOpen = false;
    render();
    document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});
    return;
  }
  if (tab) { state.adminTab = tab.dataset.adminTab; state.adminEdit = null; render(); return; }
  if (!a) return;
  const action = a.dataset.action, id = a.dataset.id;
  if(action==="freight-product"){freightUI?.open("product",[{id,qty:1}]);return;}
  if(action==="freight-cart"){freightUI?.open("cart",cartQuoteItems(),state.checkoutOpen?checkoutCep:"");return;}
  if(action==="cookie-settings"){visitorTools?.showSettings();return;}
  if(action==="reload-catalog"){void loadCatalog();return;}
  if(action==="welcome-offer"){visitorTools?.showOffer();return;}
  if (a.classList?.contains("overlay") && e.target!==a) return;
  if(action==="added-close" && a.classList?.contains("p-added-backdrop") && e.target!==a)return;
  if(action==="added-close"){state.addedProductId=null;render();return;}
  if(action==="added-bag"){state.addedProductId=null;state.detailId=null;state.cartOpen=true;render();return;}
  if(action==="added-view"){state.addedProductId=null;state.detailId=id;render();return;}
  if(action==="added-recommend"){const product=state.products.find(p=>p.id===id),row=state.cart.find(x=>x.id===id);if(!product||product.stock<=(row?.qty||0)){notify("Quantidade indisponível no estoque.");return;}if(row)row.qty++;else state.cart.push({id,qty:1});persist();state.addedProductId=id;render();return;}
  if(action==="close-detail" && a.classList?.contains("n-detail-backdrop") && e.target!==a)return;
  if(action==="home"){e.preventDefault();state.filter="Todos";state.brandFilter="Todas";state.query="";state.showAll=false;state.favoritesView=false;state.priceRange="all";state.menuOpen=false;render();window.scrollTo({top:0,behavior:"smooth"});return;}
  if(action==="nav-prev"||action==="nav-next"){document.querySelector(".p-category-scroller")?.scrollBy({left:action==="nav-prev"?-260:260,behavior:"smooth"});return;}
  if(action==="hero-pause"){heroManuallyPaused=!heroManuallyPaused;a.textContent=heroManuallyPaused?"▶":"Ⅱ";a.setAttribute("aria-label",heroManuallyPaused?"Reproduzir carrossel":"Pausar carrossel");return;}
  if(action==="detail"){state.detailId=id;render();document.querySelector(".n-detail-close")?.focus();return;}
  if(action==="close-detail"||action==="contact-detail"){state.detailId=null;render();if(action==="contact-detail")document.getElementById("contato")?.scrollIntoView({behavior:"smooth"});return;}
  if(action==="filters"){state.filterOpen=!state.filterOpen;render();return;}
  if(action==="clear-filters"){state.query="";state.filter="Todos";state.brandFilter="Todas";state.priceRange="all";state.favoritesView=false;state.showAll=true;render();document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});return;}
  if(action==="brand-filter"){state.brandFilter=["Todas",...BRANDS].includes(a.dataset.brand)?a.dataset.brand:"Todas";state.filter="Todos";state.favoritesView=false;state.showAll=true;render();return;}
  if(action==="admin"){location.assign("/admin.html");return;}
  if(action==="customer-logout"){void logoutCustomer();return;}
  if (action === "menu") {state.menuOpen = !state.menuOpen;if(state.menuOpen)void refreshCustomer();}
  if (action === "menu-close") { state.menuOpen = false; render(); return; }
  if (action === "hero-prev") { setHeroSlide(nextHeroIndex(state.heroSlide,-1)); return; }
  if (action === "hero-next") { setHeroSlide(nextHeroIndex(state.heroSlide)); return; }
  if (action === "hero-dot") { setHeroSlide(Number(a.dataset.slide || 0)); return; }
  if (action === "account") { location.assign("/conta.html"); return; }
  if (action === "signup") { location.assign("/conta.html?modo=cadastro"); return; }
  if (action === "favorites") { state.favoritesView = !state.favoritesView; state.menuOpen=false;state.query="";state.filter="Todos";state.brandFilter="Todas";state.priceRange="all";state.showAll = true; render(); document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"}); return; }
  if (action === "toggle-all") { state.showAll = !state.showAll; render(); document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"}); return; }
  if (action === "about") { e.preventDefault(); state.showAbout = true; state.menuOpen = false; render(); document.getElementById("sobre")?.scrollIntoView({behavior:"smooth"}); return; }
  if (action === "search") document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});
  if (action === "add") {
    const product = state.products.find(p => p.id === id), row = state.cart.find(x => x.id === id);
    if (!product || product.stock <= (row?.qty || 0)) { notify("Quantidade indisponível no estoque."); return; }
    if (row) row.qty += 1; else state.cart.push({id,qty:1});
    persist(); state.addedProductId=id;state.detailId=null;state.cartOpen=false;
  }
  if (action === "fav") { state.favorites = state.favorites.includes(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id]; persist(); }
  if (action === "cart") state.cartOpen = true;
  if (action === "close-cart") state.cartOpen = false;
  if(action==="delivery-checkout"){
   const items=cartQuoteItems(),subtotalCents=totals().discountedSubtotalCents,selectedFreight=activeFreight();
   const savedScrollY=window.scrollY;
   void import(/* @vite-ignore */new URL("/pacifica-checkout-delivery.mjs",location.origin).href)
    .then(async module=>{const opened=await module.openDelivery({items,subtotalCents,selectedFreight,onClose:()=>{window.scrollTo({top:savedScrollY})}});if(!opened)return;})
    .catch(error=>notify(error.message||"Não foi possível abrir a entrega. Tente novamente."));
   return;
  }
  if (action === "checkout") { (async()=>{try{const authModuleUrl=new URL("/pacifica-auth.mjs",window.location.origin).href;const a=await import(/* @vite-ignore */ authModuleUrl);const user=await a.verifiedUser();if(user&&await a.hasDeliveryDetails(user)){const sb=a.authClient();const {data,error}=await sb.from("pacifica_customer_details").select("postal_code").eq("user_id",user.id).maybeSingle();if(error||!/^\d{8}$/.test(data?.postal_code||""))throw Error();checkoutCep=data.postal_code;state.cartOpen=false;state.checkoutOpen=true;if(activeFreight()){state.shipping="superfrete";}render();return;}}catch{}location.assign("/conta.html?voltar=sacola");})();return; }
  if (action === "close-checkout") state.checkoutOpen = false;
  if (action === "qty-plus" || action === "qty-minus") {
    const r = state.cart.find(x=>x.id===id), product = state.products.find(x=>x.id===id);
    if (r) { r.qty += action === "qty-plus" ? 1 : -1; if (r.qty < 1) state.cart = state.cart.filter(x=>x.id!==id); if (r.qty > Number(product?.stock || 0)) { r.qty -= 1; notify("Limite de estoque atingido."); } persist(); }
  }
  if (action === "admin") { location.assign("/admin.html"); return; }
  if (action === "close-admin") { state.adminOpen = false; state.adminEdit = null; }
  if (action === "new-product") { state.adminEdit = "__new__"; state.adminTab = "produtos"; }
  if (action === "edit") state.adminEdit = id;
  if (action === "delete") {
    if (!window.confirm("Remover este produto?")) return;
    state.products = state.products.filter(p=>p.id!==id);
    state.cart = state.cart.filter(r=>r.id!==id);
    state.adminEdit = null; persist();
  }
  render();
});
document.addEventListener("input", e => {
 if (e.target?.id === "search") {
   state.query = e.target.value;
   state.filter="Todos";state.brandFilter="Todas";state.favoritesView=false;state.priceRange="all";state.showAll = true;searchSuggestions();
   const section = document.getElementById("produtos");
   if (section) section.outerHTML = shop();
 }
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(state.detailId||state.menuOpen||state.addedProductId){state.detailId=null;state.menuOpen=false;state.addedProductId=null;render();}const suggestions=document.getElementById("n-suggestions");if(suggestions)suggestions.hidden=true;}});
document.addEventListener("change", e => {
 if(e.target.name==="catalog-sort"){state.sortBy=e.target.value;document.getElementById("produtos").outerHTML=shop();return;}
 if(e.target.name==="catalog-price"){state.priceRange=e.target.value;document.getElementById("produtos").outerHTML=shop();return;}
 if (e.target.name === "payment") { state.payment = e.target.value; render(); }
 if (e.target.name === "shipping") { state.shipping = e.target.value; render(); }
});
document.addEventListener("submit", e => {
  if(e.target.id==="n-search-form"){e.preventDefault();const el=document.getElementById("n-suggestions");if(el)el.hidden=true;render();document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});return;}
  if(e.target.id==="catalog-import-form"){e.preventDefault();try{const f=new FormData(e.target);const rows=parseCatalog(f.get("csv"),{brand:String(f.get("brand")),cycle:String(f.get("cycle")).trim(),source:String(f.get("source"))});state.products=mergeCatalog(state.products,rows);persist();render();notify(rows.length+" itens importados/atualizados nesta sessão.");}catch(error){notify(error.message);}return;}
  if (e.target.id === "config-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    state.config.pixPercent = Math.max(0, Math.min(100, Number(f.get("pixPercent"))));
    state.config.cardPercent = Math.max(0, Math.min(100, Number(f.get("cardPercent"))));
    state.config.motoboyCents = Math.round(Math.max(0, Number(f.get("motoboy"))) * 100);
    state.config.ownCents = Math.round(Math.max(0, Number(f.get("own"))) * 100);
    state.config.whatsapp = String(f.get("whatsapp") || "").replace(/[^\d+]/g, "").slice(0,17);
    state.config.instagram = String(f.get("instagram") || "").trim().replace(/^@/, "").slice(0,30);
    persist(); render(); notify("Condições atualizadas nesta sessão.");
  }
  if (e.target.id === "product-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    const previous = state.products.find(p=>p.id===state.adminEdit);
    const p = {...previous, id: previous?.id || "local-" + crypto.randomUUID(), name: String(f.get("name")).trim(),
      category: String(f.get("category")), priceCents: Math.round(Number(f.get("price")) * 100),
      compareCents: previous?.compareCents || 0, stock: Number(f.get("stock")), description: String(f.get("description")).trim(),
      image: String(f.get("image")).trim(), accent: previous?.accent || "rose", symbol: previous?.symbol || "✿", demo: false };
    if (!p.name || !Number.isSafeInteger(p.priceCents) || p.priceCents < 1 || !Number.isSafeInteger(p.stock) || p.stock < 0) return notify("Confira os dados do produto.");
    state.products = previous ? state.products.map(x=>x.id===previous.id?p:x) : [...state.products,p];
    state.adminEdit = null; persist(); render(); notify("Alteração realizada apenas nesta sessão.");
  }
});
render();
try{freightUI=mountFreight({money:brl,getItems:cartQuoteItems,getCep:()=>deliveryCep,onSelect:choice=>{freightSelection=choice;deliveryCep=choice.cep;state.shipping="superfrete";try{sessionStorage.setItem("pacifica-freight-preview",JSON.stringify(choice))}catch{}render();notify("Frete selecionado.");}});}catch{}
const isCartReturn=new URLSearchParams(location.search).get("sacola")==="1";
try{visitorTools=mountVisitorOffers({storage:window.localStorage,skipWelcome:isCartReturn,onClaim:()=>{welcomeClaimed=true;render();notify("Seu mimo de 5% foi aplicado à sacola!");}});}catch(e){console.warn("Preferências da visita indisponíveis");}
void startCustomerSession();
window.addEventListener("pageshow",e=>{if(e.persisted)void refreshCustomer();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void refreshCustomer();});
// Os destaques mudam apenas quando a pessoa toca na foto ou escolhe um indicador.
if(typeof window.fetch==="function"&&new URLSearchParams(location.search).get("sacola")==="1"){state.cartOpen=true;render();history.replaceState(null,"",location.pathname);}

async function loadCatalog(){
 try{const r=await window.fetch("/api/catalog",{cache:"no-store"});if(!r.ok)throw Error("Catálogo indisponível");const data=await r.json();if(!Array.isArray(data.products))throw Error("Catálogo inválido");sharedCatalog=data.products.slice().sort((a,b)=>Number(b.stock>0)-Number(a.stock>0));state.products=sharedCatalog;catalogLoadError=false;render({retainSearch:true});}
 catch{sharedCatalog=null;state.products=[];catalogLoadError=true;render({retainSearch:true});}
}
if(typeof window.fetch==="function")void loadCatalog();
