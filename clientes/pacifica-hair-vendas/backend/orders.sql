-- Pacífica Hair — D1 order ledger. Apply to PACIFICA_DB before deploying the orders panel.
-- Orders are created only by a trusted server-side checkout (not by the admin dashboard).
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','preparing','shipped','delivered','cancelled','refunded')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','approved','rejected','refunded','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'unknown' CHECK (payment_method IN ('unknown','pix','card')),
  payment_provider TEXT NOT NULL DEFAULT 'mercado_pago',
  payment_id TEXT UNIQUE,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency='BRL'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents>=0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents>=0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents>=0),
  total_cents INTEGER NOT NULL CHECK (total_cents>=0),
  items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pacifica_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pacifica_orders_payment_created ON orders(payment_status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pacifica_orders_customer ON orders(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider_event_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
