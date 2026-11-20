import "./styles.css";
import { SAMPLE_PRODUCTS, CATEGORIES } from "./catalog.js";
import { brl, normalizeCart, cartTotals } from "./commerce.mjs";

const KEY = "pacifica-demo-v1";
const initial = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const state = {
  products: Array.isArray(initial.products) ? initial.products : structuredClone(SAMPLE_PRODUCTS),
  cart: normalizeCart(initial.cart),
  favorites: Array.isArray(initial.favorites) ? initial.favorites : [],
  config: { pixPercent: 5, cardPercent: 0, motoboyCents: 1290, ownCents: 990, whatsapp: "", instagram: "", ...(initial.config || {}) },
  filter: "Todos", query: "", cartOpen: false, adminOpen: false, adminTab: "produtos", adminEdit: null,
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
  return p.image && /^https?:\/\/|^\//i.test(p.image) ?
    '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" />' :
    '<div class="product-art art-' + esc(p.accent || "rose") + '"><div class="art-glow"></div><span>' + esc(p.symbol || "✿") + '</span><i>Pacífica</i></div>';
}
function productCard(p) {
  const fav = state.favorites.includes(p.id);
  return '<article class="product-card">' +
    '<div class="product-media">' + (p.compareCents > p.priceCents ? '<div class="sale-tag">Promoção</div>' : '') +
    (p.demo ? '<div class="demo-tag">Exemplo</div>' : '') +
    '<button class="fav ' + (fav ? "selected" : "") + '" data-action="fav" data-id="' + esc(p.id) + '" aria-label="Favoritar">' + icons.heart + '</button>' +
    productArt(p) + '</div>' +
    '<div class="product-info"><span class="product-category">' + esc(p.category) + '</span><h3>' + esc(p.name) + '</h3>' +
    '<div class="price-line">' + (p.compareCents > p.priceCents ? '<del>' + brl(p.compareCents) + '</del>' : '') +
    '<strong>' + brl(p.priceCents) + '</strong></div>' +
    '<button class="primary product-buy" data-action="add" data-id="' + esc(p.id) + '" ' + (p.stock <= 0 ? "disabled" : "") + '>' +
    icons.bag + (p.stock <= 0 ? "Esgotado" : "Adicionar à sacola") + '</button></div></article>';
}
function logo() {
  return '<a href="#inicio" class="brand" aria-label="Pacífica Hair Vendas início"><span class="brand-mark"><span>✿</span></span><span class="brand-name">Pacífica <em>Hair Vendas</em></span></a>';
}
function header() {
  return '<div class="announcement"><div class="wrap mini-row"><span>' + icons.truck + 'Entregas na Grande BH</span><b></b><span>' + icons.shield + 'Compra segura</span><b></b><span>' + icons.card + 'Pix e cartão</span><div class="announce-social">' + icons.instagram + icons.whatsapp + '</div></div></div>' +
    '<header class="site-header"><div class="wrap header-row">' + logo() +
    '<nav id="navigation" class="' + (state.menuOpen ? "shown" : "") + '"><a href="#inicio">Início</a><a href="#produtos">Produtos</a><a href="#sobre">Sobre nós</a><a href="#produtos" data-category="Promoções">Promoções</a><a href="#contato">Contato</a></nav>' +
    '<label class="search-box"><input id="search" type="search" placeholder="O que você procura?" value="' + esc(state.query) + '" aria-label="Buscar produtos" /><button data-action="search" aria-label="Buscar">' + icons.search + '</button></label>' +
    '<button class="header-cart" data-action="cart" aria-label="Abrir sacola">' + icons.bag + '<span>' + count() + '</span></button>' +
    '<button class="mobile-menu" data-action="menu" aria-label="Abrir menu"><span></span><span></span><span></span></button></div></header>';
}
function hero() {
  return '<section class="hero" id="inicio"><div class="hero-orbit hero-orbit-a"></div><div class="hero-orbit hero-orbit-b"></div><span class="hero-spark spark-a">♡</span><span class="hero-spark spark-b">✧</span>' +
    '<div class="wrap hero-content"><div class="hero-copy"><span class="eyebrow">O seu universo de beleza</span><h1>Beleza, autoestima <em>e bem-estar</em> em um só lugar.</h1><p>Perfumes, cosméticos, cuidados com os cabelos e moda íntima escolhidos para você se sentir ainda mais especial.</p><a class="primary hero-cta" href="#produtos">Conheça os produtos ' + icons.arrow + '</a></div>' +
    '<div class="hero-photo"><div class="hero-photo-halo"></div><img src="/assets/gleizelle.webp" alt="Gleizelle, responsável pela Pacífica Hair Vendas" /><span class="photo-sticker">Seu brilho é único ♡</span></div>' +
    '<div class="hero-side"><span class="hero-mini">Pacífica Hair Vendas</span><h2>Cuide de você<br />com o melhor!</h2><ul><li>Perfumes e fragrâncias</li><li>Moda íntima e pijamas</li><li>Cosméticos e cabelos</li><li>Carinho em cada pedido</li></ul><a href="#sobre">Conheça nossa história ' + icons.arrow + '</a></div></div></section>';
}
function categories() {
  return '<section class="wrap categories" aria-label="Categorias"><div class="categories-grid">' +
    CATEGORIES.map(c => '<button class="category-tile ' + (state.filter === c.name ? "active" : "") + '" data-category="' + esc(c.name) + '"><span>' + esc(c.icon) + '</span><strong>' + esc(c.name) + '</strong></button>').join("") +
    '</div></section>';
}
function shop() {
  const selected = state.products.filter(p => Number(p.stock) >= 0 && (!state.query || (p.name + " " + p.category).toLowerCase().includes(state.query.toLowerCase())) &&
    (state.filter === "Todos" || (state.filter === "Promoções" ? p.compareCents > p.priceCents : p.category === state.filter)));
  return '<section class="wrap shop" id="produtos"><div class="section-title"><div><span class="eyebrow">Escolhas especiais</span><h2>Nossos <em>produtos</em></h2><p>Um mundo de beleza para você descobrir</p></div><button class="link-reset" data-category="Todos">Ver todos ' + icons.arrow + '</button></div>' +
    '<div class="preview-notice">Catálogo demonstrativo: produtos e valores ilustrativos, sujeitos à substituição antes do lançamento.</div>' +
    '<div class="product-grid">' + (selected.length ? selected.map(productCard).join("") : '<div class="empty-results">Não encontramos produtos nessa busca. Tente outra categoria.</div>') + '</div></section>';
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
  const waButton = whatsappHref ? '<a class="social-btn" target="_blank" rel="noopener noreferrer" href="' + whatsappHref + '">Falar no WhatsApp</a>' : '<span class="social-btn disabled">WhatsApp será informado em breve</span>';
  const igButton = instaHref ? '<a class="social-btn secondary" target="_blank" rel="noopener noreferrer" href="' + instaHref + '">Seguir no Instagram</a>' : '<span class="social-btn secondary disabled">Instagram em configuração</span>';
  return '<section class="wrap reassurance"><div>' + icons.shield + '<span><strong>Compra segura</strong><small>Processo protegido</small></span></div><div>' + icons.card + '<span><strong>Pagamento facilitado</strong><small>Pix e cartão</small></span></div><div>' + icons.truck + '<span><strong>Entrega na Grande BH</strong><small>Motoboy, entrega ou retirada</small></span></div><div>' + icons.heart + '<span><strong>Atendimento especial</strong><small>Todo cuidado importa</small></span></div></section>' +
    '<section class="wrap social-banner" id="contato"><div><span class="social-icon green">' + icons.whatsapp + '</span><span><h3>Vamos conversar?</h3><p>Tire suas dúvidas e receba um atendimento cheio de carinho.</p>' + waButton + '</span></div><div><span class="social-icon instagram">' + icons.instagram + '</span><span><h3>Siga nossas novidades</h3><p>Ofertas, lançamentos e dicas de beleza.</p>' + igButton + '</span></div></section>' +
    '<footer class="footer"><div class="wrap footer-main">' + logo() + '<div class="footer-message">Beleza que abraça. <span>Obrigada por fazer parte da nossa história! ♡</span></div></div><div class="wrap footer-bottom">© 2026 Pacífica Hair Vendas · Site em preparação <span>Desenvolvimento: NovaByte</span></div></footer>';
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
    header() + '<main>' + hero() + categories() + shop() + about() + footer() + '</main>' +
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
    state.menuOpen = false;
    render();
    document.getElementById("produtos")?.scrollIntoView({behavior:"smooth"});
    return;
  }
  if (tab) { state.adminTab = tab.dataset.adminTab; state.adminEdit = null; render(); return; }
  if (!a) return;
  const action = a.dataset.action, id = a.dataset.id;
  if (action === "menu") state.menuOpen = !state.menuOpen;
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
