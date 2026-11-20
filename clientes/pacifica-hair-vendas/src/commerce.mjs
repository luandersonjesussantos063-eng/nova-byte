export function brl(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function safeCents(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
export function cartTotals(cart, products, config = {}) {
  const discountPixPercent = Math.min(100, Math.max(0, Number(config.pixPercent || 0)));
  const cardFeePercent = Math.min(100, Math.max(0, Number(config.cardPercent || 0)));
  const entries = cart.map(row => {
    const product = products.find(p => p.id === row.id);
    const qty = Number(row.qty);
    if (!product || !Number.isSafeInteger(qty) || qty < 1 || qty > 99 || product.stock < qty) return null;
    return { id: row.id, name: product.name, qty, unitCents: safeCents(product.priceCents), lineCents: safeCents(product.priceCents) * qty };
  }).filter(Boolean);
  const subtotalCents = entries.reduce((s, r) => s + r.lineCents, 0);
  return {
    entries,
    subtotalCents,
    pixTotalCents: Math.max(0, subtotalCents - Math.round(subtotalCents * discountPixPercent / 100)),
    cardTotalCents: subtotalCents + Math.round(subtotalCents * cardFeePercent / 100)
  };
}
export function normalizeCart(cart) {
  if (!Array.isArray(cart)) return [];
  return cart.filter(x => x && typeof x.id === "string" && Number.isSafeInteger(x.qty) && x.qty >= 1 && x.qty <= 99).slice(0, 100);
}
