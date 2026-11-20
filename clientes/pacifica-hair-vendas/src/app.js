import "./styles.css";
import { SAMPLE_PRODUCTS, CATEGORIES } from "./catalog.js";
import { brl, normalizeCart, cartTotals } from "./commerce.mjs";

const KEY = "pacifica-demo-v2";
const initial = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const state = {
  products: Array.isArray(initial.products) ? initial.products : structuredClone(SAMPLE_PRODUCTS),
  cart: normalizeCart(initial.cart),
  favorites: Array.isArray(initial.favorites) ? initial.favorites : [],
  config: { pixPercent: 5, cardPercent: 0, motoboyCents: 1290, ownCents: 990, whatsapp: "", instagram: "", ...(initial.config || {}) },
  filter: "Todos", query: "", showAll: false, showAbout: false, cartOpen: false, adminOpen: false, adminTab: "produtos", adminEdit: null,
  checkoutOpen: false, payment: "pix", shipping: "motoboy", menuOpen: false, toast: ""
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
  localStorage.setItem(KEY, JSON.stringify({ products: state.products, cart: state.cart, favorites: state.favorites, config: state.config }));
}
function count() { return state.cart.reduce((n, p) => n + p.qty, 0); }
function shippingCents() { return state.shipping === "retirada" ? 0 : (state.shipping === "propria" ? Number(state.config.ownCents) : Number(state.config.motoboyCents)); }
function totals() {
  const t = cartTotals(state.cart, state.products, state.config);
  return { ...t, totalCents: (state.payment === "pix" ? t.pixTotalCents : t.cardTotalCents) + shippingCents() };
}
function productArt(p) {
  if (p.image && /^https?:\/\/|^\//i.test(p.image))
    return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" />';
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
function productCard(p) {
  const fav = state.favorites.includes(p.id);
  return '<article class="product-card">' +
    '<div class="product-media">' + (p.compareCents > p.priceCents ? '<div class="sale-tag">Promoção</div>' : '') +
    '<button class="fav ' + (fav ? "selected" : "") + '" data-action="fav" data-id="' + esc(p.id) + '" aria-label="Favoritar">' + icons.heart + '</button>' +
    productArt(p) + '</div>' +
    '<div class="product-info"><h3>' + esc(p.name) + '</h3>' +
    '<div class="price-line">' + (p.compareCents > p.priceCents ? '<del>' + brl(p.compareCents) + '</del>' : '') +
    '<strong>' + brl(p.priceCents) + '</strong></div>' +
    '<button class="primary product-buy" data-action="add" data-id="' + esc(p.id) + '" ' + (p.stock <= 0 ? "disabled" : "") + '>' +
    icons.cart + (p.stock <= 0 ? "Esgotado" : "Comprar Agora") + '</button></div></article>';
}
function logo() {
  return '<a href="#inicio" class="brand" aria-label="Pacífica Hair Vendas, início"><span class="brand-mark"><span class="brand-bottle" aria-hidden="true"><svg viewBox="0 0 56 72" fill="none" stroke="#74505b" stroke-width="1.5"><path d="M26 9V4h8v5M25 9h10l3 6-2 3 6 13 3 26c.3 4-2 7-7 7H15c-5 0-7-3-7-7l3-26 7-13-2-3 3-6h6Z"/><path d="M17 35q6-8 13-7m-15 14q6-6 14-6m-15 15q8-5 17-5M6 26l9-9M4 33l8-8" stroke-width="1.1"/><path d="M30 4V0M24 6l-4-3M36 6l4-3"/></svg></span><span class="brand-inside">Pacífica <em>Hair</em> Vendas<small>Cosméticos, Perfumaria,<br/>cabelos e cia</small></span></span><span class="brand-mobile-name">Pacífica Hair Vendas</span></a>';
}
function header() {
  return '<div class="announcement"><div class="wrap mini-row"><span>' + icons.truck + 'Entrega na Grande BH</span><b></b><span>' + icons.shield + 'Compra Segura</span><b></b><span>' + icons.card + 'Pagamento Facilitado</span><div class="announce-social"><a href="#contato" aria-label="Instagram">' + icons.instagram + '</a><a href="#contato" aria-label="WhatsApp">' + icons.whatsapp + '</a></div></div></div>' +
    '<header class="site-header"><div class="wrap header-row">' + logo() +
    '<nav id="navigation" class="' + (state.menuOpen ? "shown" : "") + '"><a class="nav-home" href="#inicio">Início</a><a class="nav-products" href="#produtos">Produtos <span>⌄</span></a><a data-action="about" href="#sobre">Sobre Nós</a><a href="#produtos" data-category="Promoções">Promoções</a><a href="#contato">Contato</a></nav>' +
    '<label class="search-box"><input id="search" type="search" placeholder="O que você procura?" value="' + esc(state.query) + '" aria-label="Buscar produtos" /><button data-action="search" aria-label="Buscar">' + icons.search + '</button></label>' +
    '<button class="header-cart" data-action="cart" aria-label="Abrir sacola">' + icons.cart + '<span>' + count() + '</span></button>' +
    '<button class="mobile-menu" data-action="menu" aria-label="Abrir menu"><span></span><span></span><span></span></button></div></header>';
}
function hero() {
  const perfume = '<svg class="hero-perfume" viewBox="0 0 220 270" aria-hidden="true"><defs><linearGradient id="bottlePink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffefee"/><stop offset=".31" stop-color="#ff6b9e"/><stop offset=".72" stop-color="#eb377d"/><stop offset="1" stop-color="#ffbbd4"/></linearGradient><linearGradient id="goldTop" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="#81521e"/><stop offset=".25" stop-color="#ffe4a1"/><stop offset=".55" stop-color="#b56f2d"/><stop offset=".84" stop-color="#fff2c3"/><stop offset="1" stop-color="#995527"/></linearGradient><radialGradient id="flowerPetal"><stop stop-color="#ffeaf8"/><stop offset="1" stop-color="#f270b2"/></radialGradient></defs><ellipse cx="92" cy="250" rx="86" ry="11" fill="#7b165b" opacity=".14"/><path d="M59 87h75v22c27 14 36 50 37 103q0 20-24 22H44q-24-1-23-22c1-58 9-90 38-103Z" fill="url(#bottlePink)" stroke="#bf3b7e" stroke-width="3"/><path d="M49 119c-18 26-18 76-17 92M132 117q25 23 25 92" fill="none" stroke="#fff9" stroke-width="9" opacity=".57"/><path d="M59 86h75v20H59z" fill="#fbb9d0"/><path d="M66 49h61v38H66z" fill="url(#goldTop)" stroke="#a46629"/><path d="M61 42h70v9H61z" fill="url(#goldTop)"/><path d="M75 29h40v13H75z" fill="url(#goldTop)"/><path d="M57 151q39-12 84 0" fill="none" stroke="#fff4" stroke-width="3"/><text x="95" y="190" text-anchor="middle" font-size="21" font-family="Georgia" fill="#91385d">Pacífica</text><g transform="translate(-9 188)"><path d="M12 42Q0 10 32 14Q36-4 53 13Q84 7 70 31Q100 46 67 56Q62 76 44 60Q19 77 12 42" fill="url(#flowerPetal)" stroke="#df469b" stroke-width="2"/><circle cx="43" cy="38" r="13" fill="#ffcc64"/><g fill="none" stroke="#f7a7d3" stroke-width="3"><path d="M43 37 19 22M43 37 59 19M43 37 69 45M43 37 26 59"/></g></g></svg>';
  return '<section class="hero" id="inicio"><div class="hero-surface"><span class="hero-heart heart-one">♡</span><span class="hero-heart heart-two">♡</span><span class="hero-heart heart-three">♡</span>' + perfume +
   '<div class="hero-content wrap"><div class="hero-copy"><div class="hero-left-logo"><span class="hero-line-bottle">♧</span><h1>Pacífica<br/>Hair<br/>Vendas</h1></div><p class="hero-subtitle">Cosméticos, Perfumaria,<br/>cabelos e cia</p><p class="hero-script">Beleza, autoestima e bem-estar<br/>em um só lugar! <span>♡</span></p></div>' +
   '<div class="hero-photo"><img src="/assets/gleizelle.webp" alt="Gleizelle, da Pacífica Hair Vendas" /><span class="neon-ring neon-ring-a"></span><span class="neon-ring neon-ring-b"></span></div>' +
   '<div class="hero-side"><h2>Cuide de você<br/>com o melhor!</h2><ul><li>Perfumes das melhores marcas</li><li>Roupas íntimas</li><li>Cosméticos e cuidados pessoais</li><li>Tudo em um só lugar!</li></ul><a class="primary hero-cta" href="#produtos">' + icons.cart + ' Comprar Agora ' + icons.arrow + '</a></div></div></div></section>';
}
function categories() {
  const glyphs = {
    "Perfumes":'<svg viewBox="0 0 64 64"><rect x="21" y="21" width="22" height="32" rx="5"/><path d="M27 13h10v8H27zM25 8h14v5H25z"/><path d="M26 33q6-6 12 0v12H26z"/></svg>',
    "Cosméticos":'<svg viewBox="0 0 64 64"><path d="M32 35C9 36 10 14 24 16c8 1 9 19 8 19Zm0 0c23 1 22-21 8-19-8 1-9 19-8 19Zm-1 1c-18-18-32-3-18 8 8 5 16-1 18-8Zm2 0c18-18 32-3 18 8-8 5-16-1-18-8Z"/><path d="M26 40c-11 21 5 30 7 6 2 24 18 15 7-6Z"/></svg>',
    "Cabelos":'<svg viewBox="0 0 64 64"><rect x="10" y="19" width="19" height="36" rx="3"/><rect x="35" y="25" width="17" height="30" rx="3"/><path d="M15 14h9v5h-9zM19 6v8M19 6h8M41 17h7v8h-7z"/></svg>',
    "Roupas íntimas":'<svg viewBox="0 0 64 64"><path d="M7 21q12 2 23 0v8q-1 23-16 18L7 41Zm50 0q-12 2-23 0v8q1 23 16 18l7-6ZM30 19h4v21h-4zM7 21 4 13M57 21l3-8M15 43q17 5 34 0"/></svg>',
    "Cuidados Pessoais":'<svg viewBox="0 0 64 64"><rect x="13" y="24" width="38" height="31" rx="10"/><path d="M8 22h48v5H8zM19 14h26v8H19zM32 9l5 5-5 5-5-5z"/></svg>',
    "Presentes":'<svg viewBox="0 0 64 64"><rect x="11" y="29" width="42" height="26" rx="2"/><rect x="8" y="23" width="48" height="8" rx="1"/><path d="M32 23V55M32 24C0 21 16 5 28 15l4 9Zm0 0c32-3 16-19 4-9l-4 9Z"/></svg>',
    "Promoções":'<svg viewBox="0 0 64 64"><path d="m13 8 18-3 20 8 3 20-19 25L7 34z"/><path d="m22 43 18-24M22 20a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM40 36a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>'
  };
  return '<section class="wrap categories" aria-label="Categorias"><div class="categories-grid">' +
    CATEGORIES.map(c => '<button class="category-tile ' + (state.filter === c.name ? "active" : "") + '" data-category="' + esc(c.name) + '"><span class="category-symbol">' + (glyphs[c.name] || '<span>✿</span>') + '</span><strong>' + esc(c.name) + '</strong></button>').join("") +
    '</div></section>';
}
function shop() {
  const selected = state.products.filter(p => Number(p.stock) >= 0 && (!state.query || (p.name + " " + p.category).toLowerCase().includes(state.query.toLowerCase())) &&
    (state.filter === "Todos" || (state.filter === "Promoções" ? p.compareCents > p.priceCents : p.category === state.filter)));
  const visible = state.showAll || state.filter !== "Todos" || state.query ? selected : selected.slice(0, 4);
  return '<section class="wrap shop" id="produtos"><div class="section-title"><div class="title-lines"></div><div class="title-center"><h2><span>' + icons.bag + '</span>Nossos Produtos</h2><p>Qualidade, beleza e as melhores marcas!</p></div><div class="title-lines"></div></div>' +
    '<div class="product-grid">' + (visible.length ? visible.map(productCard).join("") : '<div class="empty-results">Não encontramos produtos nessa busca. Tente outra categoria.</div>') + '</div>' +
    '<div class="catalog-actions"><span>Produtos ilustrativos para aprovação visual — não disponíveis para compra real.</span>' +
    (selected.length > 4 && state.filter === "Todos" && !state.query ? '<button class="outline-btn" data-action="toggle-all">' + (state.showAll ? "Mostrar menos" : "Ver mais produtos") + ' ' + icons.arrow + '</button>' : "") +
    '</div></section>';
}
function about() {
  return '<section class="about-section" id="sobre"><div class="wrap about-grid"><div class="about-image"><div class="about-frame"><img src="/assets/gleizelle.webp" alt="Gleizelle, curadoria de beleza e autocuidado" /><div class="about-overlay"><span>Nossa história</span><h3>Gleizelle</h3><p>Beleza, cuidado e atendimento de perto.</p></div></div></div>' +
    '<div class="about-copy"><span class="eyebrow">Conheça quem está por trás da Pacífica</span><h2>Mais que produtos,<br /><em>um carinho com você.</em></h2><p>A Pacífica Hair Vendas nasceu da paixão por beleza, autoestima e autocuidado. Aqui, cada escolha é feita pensando no que faz você se sentir bem.</p><p>Sou Gleizelle e quero que sua experiência seja acolhedora, simples e especial — da escolha até a entrega.</p><a class="outline-btn" href="#contato">Fale com a gente ' + icons.arrow + '</a></div></div></section>';
}
function footer() {
  const waDigits = String(state.config.whatsapp || "").replace(/\D/g, "");
  const whatsappHref = waDigits.length >= 10 && waDigits.length <= 13 ? "https://wa.me/" + (waDigits.startsWith("55") ? waDigits : "55" + waDigits) : "";
  const instaUser = String(state.config.instagram || "").trim().replace(/^@/, "");
  const instaHref = /^[\w.]{1,30}$/.test(instaUser) ? "https://instagram.com/" + instaUser : "";
  const waButton = whatsappHref ? '<a class="social-btn" target="_blank" rel="noopener noreferrer" href="' + whatsappHref + '">Ir para o WhatsApp ➜</a>' : '<span class="social-btn disabled">WhatsApp em configuração</span>';
  const igButton = instaHref ? '<a class="social-btn secondary" target="_blank" rel="noopener noreferrer" href="' + instaHref + '">Acessar o Instagram ➜</a>' : '<span class="social-btn secondary disabled">Instagram em configuração</span>';
  return '<section class="wrap reassurance"><div>' + icons.shield + '<span><strong>Compra Segura</strong><small>Seus dados protegidos</small></span></div><div>' + icons.card + '<span><strong>Pagamento Facilitado</strong><small>Pix, Cartão e Débito*</small></span></div><div>' + icons.truck + '<span><strong>Entrega na Grande BH</strong><small>Com agilidade</small></span></div><div>' + icons.user + '<span><strong>Atendimento Especializado</strong><small>Tire suas dúvidas</small></span></div></section>' +
    '<section class="wrap social-banner" id="contato"><div><span class="social-icon green">' + icons.whatsapp + '</span><span><h3>Fale Conosco Agora!</h3><p>Tire dúvidas, faça seu pedido pelo WhatsApp!</p>' + waButton + '</span></div><div><span class="social-icon instagram">' + icons.instagram + '</span><span><h3>Siga nosso Instagram</h3><p>Fique por dentro das novidades,<br/>promoções e muito mais!</p>' + igButton + '</span></div></section>' +
    '<footer class="footer"><div class="wrap footer-main">' + logo() + '<div class="footer-connect"><p>Conecte-se conosco:</p><div><a href="#contato" aria-label="Instagram">' + icons.instagram + '</a><a href="#contato" aria-label="WhatsApp">' + icons.whatsapp + '</a></div></div><div class="footer-message">Obrigada por fazer parte<br/> da nossa história! <span>♥</span></div></div><div class="footer-neon">♡─────────────────♡─────────────────♡</div><div class="wrap footer-bottom"><span>© 2026 Pacífica Hair Vendas. Todos os direitos reservados.</span><span class="payment-logos"><strong>pix</strong><b>VISA</b><b>●●</b><b>elo</b></span></div><p class="footer-preview">* Pagamentos e vendas desativados nesta prévia. Desenvolvido por NovaByte.</p></footer>';
}
function cartDrawer() {
  if (!state.cartOpen) return "";
  const t = totals();
  return '<div class="overlay" data-action="close-cart"><aside class="drawer" role="dialog" aria-label="Sua sacola" onclick="event.stopPropagation()">' +
    '<div class="drawer-head"><div><span class="eyebrow">Seu carinho em forma de escolha</span><h2>Sua sacola (' + count() + ')</h2></div><button class="icon-btn" data-action="close-cart">' + icons.close + '</button></div>' +
    '<div class="drawer-items">' + (t.entries.length ? t.entries.map(p => '<div class="cart-row"><span class="cart-icon">✿</span><div><strong>' + esc(p.name) + '</strong><small>' + brl(p.unitCents) + '</small><div class="qty"><button data-action="qty-minus" data-id="' + esc(p.id) + '">−</button><span>' + p.qty + '</span><button data-action="qty-plus" data-id="' + esc(p.id) + '">+</button></div></div><strong>' + brl(p.lineCents) + '</strong></div>').join("") : '<div class="empty-cart">Sua sacola está vazia. Que tal escolher algo especial?</div>') + '</div>' +
    '<div class="drawer-bottom"><div class="subtotal"><span>Subtotal</span><strong>' + brl(t.subtotalCents) + '</strong></div><p>Frete e desconto serão apresentados na próxima etapa.</p><button class="primary wide" data-action="checkout" ' + (t.entries.length ? "" : "disabled") + '>Continuar pedido ' + icons.arrow + '</button><button class="ghost wide" data-action="close-cart">Continuar comprando</button></div></aside></div>';
}
function checkoutModal() {
  if (!state.checkoutOpen) return "";
  const t = totals();
  const discount = Number(state.config.pixPercent || 0);
  return '<div class="overlay modal-layer" data-action="close-checkout"><section class="modal checkout-modal" role="dialog" aria-label="Resumo do pedido" onclick="event.stopPropagation()">' +
    '<button class="modal-close icon-btn" data-action="close-checkout">' + icons.close + '</button><span class="eyebrow">Prévia do pedido</span><h2>Quase lá!</h2><p>Confira o resumo. O pagamento real será habilitado somente após a configuração segura do Mercado Pago.</p>' +
    '<h3>Forma de pagamento</h3><div class="radio-grid"><label><input type="radio" name="payment" value="pix" ' + (state.payment === "pix" ? "checked" : "") + '/>Pix' + (discount ? " · " + discount + "% de desconto" : "") + '</label><label><input type="radio" name="payment" value="card" ' + (state.payment === "card" ? "checked" : "") + '/>Cartão</label></div>' +
    '<h3>Entrega na Grande BH</h3><div class="radio-grid"><label><input type="radio" name="shipping" value="motoboy" ' + (state.shipping === "motoboy" ? "checked" : "") + '/>Motoboy</label><label><input type="radio" name="shipping" value="propria" ' + (state.shipping === "propria" ? "checked" : "") + '/>Entrega própria</label><label><input type="radio" name="shipping" value="retirada" ' + (state.shipping === "retirada" ? "checked" : "") + '/>Retirada</label></div>' +
    '<div class="summary-lines"><div><span>Produtos</span><strong>' + brl(t.subtotalCents) + '</strong></div><div><span>Frete ilustrativo</span><strong>' + brl(shippingCents()) + '</strong></div><div><span>' + (state.payment === "pix" ? "Desconto Pix" : "Valor no cartão") + '</span><strong>' + brl(state.payment === "pix" ? t.pixTotalCents - t.subtotalCents : t.cardTotalCents - t.subtotalCents) + '</strong></div><div class="summary-final"><span>Total estimado</span><strong>' + brl(t.totalCents) + '</strong></div></div>' +
    '<div class="locked-pay">Pagamento desabilitado durante o desenvolvimento. Nenhuma cobrança será realizada.</div><button class="primary wide" disabled>Finalizar pagamento (em breve)</button></section></div>';
}
function adminPanel() {
  if (!state.adminOpen) return "";
  const p = state.products.find(x => x.id === state.adminEdit);
  return '<div class="overlay modal-layer" data-action="close-admin"><section class="modal admin-modal" role="dialog" aria-label="Painel de demonstração" onclick="event.stopPropagation()">' +
    '<button class="modal-close icon-btn" data-action="close-admin">' + icons.close + '</button><span class="eyebrow">NovaByte · Ambiente de prévia</span><h2>Painel administrativo</h2>' +
    '<p class="admin-warning">Modo de demonstração: alterações ficam apenas neste navegador. Login, banco de dados e Mercado Pago ainda não estão ativos.</p>' +
    '<div class="admin-tabs"><button data-admin-tab="produtos" class="' + (state.adminTab === "produtos" ? "active" : "") + '">Produtos</button><button data-admin-tab="config" class="' + (state.adminTab === "config" ? "active" : "") + '">Condições</button></div>' +
    (state.adminTab === "config" ? '<form id="config-form" class="admin-form"><label>Desconto Pix (%)<input type="number" name="pixPercent" min="0" max="100" step="0.01" value="' + Number(state.config.pixPercent) + '" required /></label><label>Adicional cartão (%)<input type="number" name="cardPercent" min="0" max="100" step="0.01" value="' + Number(state.config.cardPercent) + '" required /></label><label>Motoboy (R$)<input name="motoboy" type="number" min="0" step="0.01" value="' + (state.config.motoboyCents / 100).toFixed(2) + '" required /></label><label>Entrega própria (R$)<input name="own" type="number" min="0" step="0.01" value="' + (state.config.ownCents / 100).toFixed(2) + '" required /></label><label>WhatsApp com DDD (opcional)<input name="whatsapp" type="tel" value="' + esc(state.config.whatsapp || "") + '" placeholder="31999999999" /></label><label>Instagram (usuário, opcional)<input name="instagram" value="' + esc(state.config.instagram || "") + '" placeholder="@pacifica" /></label><button class="primary">Salvar condições de demonstração</button></form>' :
    '<div class="admin-list">' + state.products.map(item => '<div><span><strong>' + esc(item.name) + '</strong><small>' + esc(item.category) + ' · ' + brl(item.priceCents) + ' · Estoque: ' + item.stock + '</small></span><button class="edit-btn" data-action="edit" data-id="' + esc(item.id) + '">Editar</button></div>').join("") + '</div>' +
    '<button class="outline-btn" data-action="new-product">+ Novo produto</button>' +
    (state.adminEdit !== null ? '<form id="product-form" class="admin-form"><h3>' + (p ? "Editar produto" : "Adicionar produto") + '</h3><label>Nome<input required name="name" maxlength="100" value="' + esc(p?.name || "") + '" /></label><label>Categoria<select name="category">' + CATEGORIES.filter(c => c.name !== "Promoções").map(c => '<option value="' + esc(c.name) + '" ' + (p?.category === c.name ? "selected" : "") + '>' + esc(c.name) + '</option>').join("") + '</select></label><label>Preço (R$)<input required type="number" min="0.01" step="0.01" name="price" value="' + (p ? (p.priceCents / 100).toFixed(2) : "") + '" /></label><label>Estoque<input required type="number" min="0" step="1" name="stock" value="' + (p?.stock ?? 0) + '" /></label><label>Foto do produto (URL, opcional)<input type="url" name="image" placeholder="https://..." value="' + esc(p?.image || "") + '" /></label><label>Descrição<textarea name="description" rows="3">' + esc(p?.description || "") + '</textarea></label><div class="form-actions"><button class="primary">Salvar produto</button>' + (p ? '<button type="button" class="danger" data-action="delete" data-id="' + esc(p.id) + '">Excluir</button>' : "") + '</div></form>' : "") ) +
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
    header() + '<main>' + hero() + categories() + shop() + (state.showAbout ? about() : '') + footer() + '</main>' +
    cartDrawer() + checkoutModal() + adminPanel() + '<button class="dev-admin" data-action="admin">' + icons.user + '<span>Prévia do painel</span></button>';
  document.body.classList.toggle("no-scroll", state.cartOpen || state.checkoutOpen || state.adminOpen);
  if (active) { const field = document.getElementById("search"); field?.focus(); field?.setSelectionRange(pos, pos); }
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-action]");
  const cat = e.target.closest("[data-category]");
  const tab = e.target.closest("[data-admin-tab]");
  if (cat) {
    state.filter = cat.dataset.category;
    state.showAll = true;
    state.menuOpen = false;
    render();
    document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});
    return;
  }
  if (tab) { state.adminTab = tab.dataset.adminTab; state.adminEdit = null; render(); return; }
  if (!a) return;
  const action = a.dataset.action, id = a.dataset.id;
  if (action === "menu") state.menuOpen = !state.menuOpen;
  if (action === "toggle-all") { state.showAll = !state.showAll; render(); document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"}); return; }
  if (action === "about") { e.preventDefault(); state.showAbout = true; state.menuOpen = false; render(); document.getElementById("sobre")?.scrollIntoView({behavior:"smooth"}); return; }
  if (action === "search") document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});
  if (action === "add") {
    const product = state.products.find(p => p.id === id), row = state.cart.find(x => x.id === id);
    if (!product || product.stock <= (row?.qty || 0)) { notify("Quantidade indisponível no estoque."); return; }
    if (row) row.qty += 1; else state.cart.push({id,qty:1});
    persist(); notify("Produto adicionado à sacola! ♡");
  }
  if (action === "fav") { state.favorites = state.favorites.includes(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id]; persist(); }
  if (action === "cart") state.cartOpen = true;
  if (action === "close-cart") state.cartOpen = false;
  if (action === "checkout") { state.cartOpen = false; state.checkoutOpen = true; }
  if (action === "close-checkout") state.checkoutOpen = false;
  if (action === "qty-plus" || action === "qty-minus") {
    const r = state.cart.find(x=>x.id===id), product = state.products.find(x=>x.id===id);
    if (r) { r.qty += action === "qty-plus" ? 1 : -1; if (r.qty < 1) state.cart = state.cart.filter(x=>x.id!==id); if (r.qty > Number(product?.stock || 0)) { r.qty -= 1; notify("Limite de estoque atingido."); } persist(); }
  }
  if (action === "admin") state.adminOpen = true;
  if (action === "close-admin") { state.adminOpen = false; state.adminEdit = null; }
  if (action === "new-product") { state.adminEdit = "__new__"; state.adminTab = "produtos"; }
  if (action === "edit") state.adminEdit = id;
  if (action === "delete") {
    if (!window.confirm("Remover este produto da prévia?")) return;
    state.products = state.products.filter(p=>p.id!==id);
    state.cart = state.cart.filter(r=>r.id!==id);
    state.adminEdit = null; persist();
  }
  render();
});
document.addEventListener("input", e => {
 if (e.target?.id === "search") {
   state.query = e.target.value;
   state.showAll = true;
   const section = document.getElementById("produtos");
   if (section) section.outerHTML = shop();
 }
});
document.addEventListener("change", e => {
 if (e.target.name === "payment") { state.payment = e.target.value; render(); }
 if (e.target.name === "shipping") { state.shipping = e.target.value; render(); }
});
document.addEventListener("submit", e => {
  if (e.target.id === "config-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    state.config.pixPercent = Math.max(0, Math.min(100, Number(f.get("pixPercent"))));
    state.config.cardPercent = Math.max(0, Math.min(100, Number(f.get("cardPercent"))));
    state.config.motoboyCents = Math.round(Math.max(0, Number(f.get("motoboy"))) * 100);
    state.config.ownCents = Math.round(Math.max(0, Number(f.get("own"))) * 100);
    state.config.whatsapp = String(f.get("whatsapp") || "").replace(/[^\d+]/g, "").slice(0,17);
    state.config.instagram = String(f.get("instagram") || "").trim().replace(/^@/, "").slice(0,30);
    persist(); render(); notify("Condições salvas no modo de demonstração.");
  }
  if (e.target.id === "product-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    const previous = state.products.find(p=>p.id===state.adminEdit);
    const p = { id: previous?.id || "local-" + crypto.randomUUID(), name: String(f.get("name")).trim(),
      category: String(f.get("category")), priceCents: Math.round(Number(f.get("price")) * 100),
      compareCents: previous?.compareCents || 0, stock: Number(f.get("stock")), description: String(f.get("description")).trim(),
      image: String(f.get("image")).trim(), accent: previous?.accent || "rose", symbol: previous?.symbol || "✿", demo: false };
    if (!p.name || !Number.isSafeInteger(p.priceCents) || p.priceCents < 1 || !Number.isSafeInteger(p.stock) || p.stock < 0) return notify("Confira os dados do produto.");
    state.products = previous ? state.products.map(x=>x.id===previous.id?p:x) : [...state.products,p];
    state.adminEdit = null; persist(); render(); notify("Produto salvo somente nesta prévia.");
  }
});
render();
