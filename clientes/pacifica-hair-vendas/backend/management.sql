-- Pacífica Hair | Execute exclusivamente no D1 PACIFICA_DB após o schema de produtos.
-- Dados de vendas por Mercado Pago permanecem no schema orders.sql.
CREATE TABLE IF NOT EXISTS ph_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
  phone TEXT NOT NULL DEFAULT '' CHECK(length(phone)<=20),
  email TEXT NOT NULL DEFAULT '' CHECK(length(email)<=180),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ph_customers_name ON ph_customers(name);

CREATE TABLE IF NOT EXISTS ph_credit (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES ph_customers(id),
  original_cents INTEGER NOT NULL CHECK(original_cents BETWEEN 1 AND 100000000),
  due_date TEXT NOT NULL CHECK(due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ph_credit_customer ON ph_credit(customer_id);
CREATE TABLE IF NOT EXISTS ph_credit_receipts (
  id TEXT PRIMARY KEY,
  credit_id TEXT NOT NULL REFERENCES ph_credit(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ph_credit_receipts_credit ON ph_credit_receipts(credit_id);
CREATE TABLE IF NOT EXISTS ph_stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  delta INTEGER NOT NULL CHECK(delta<>0),
  before_units INTEGER NOT NULL CHECK(before_units>=0),
  after_units INTEGER NOT NULL CHECK(after_units>=0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ph_stock_moves_recent ON ph_stock_movements(created_at DESC);
-- Captura alterações feitas pelo editor de produto e pelas entradas/saídas manuais.
CREATE TRIGGER IF NOT EXISTS ph_log_stock_changes
AFTER UPDATE OF payload ON products
WHEN CAST(json_extract(OLD.payload,'$.stock') AS INTEGER)
     <> CAST(json_extract(NEW.payload,'$.stock') AS INTEGER)
BEGIN
  INSERT INTO ph_stock_movements(id,product_id,product_name,delta,before_units,after_units)
  VALUES (
    lower(hex(randomblob(16))),NEW.id,
    coalesce(json_extract(NEW.payload,'$.name'),''),
    CAST(json_extract(NEW.payload,'$.stock') AS INTEGER)-CAST(json_extract(OLD.payload,'$.stock') AS INTEGER),
    CAST(json_extract(OLD.payload,'$.stock') AS INTEGER),
    CAST(json_extract(NEW.payload,'$.stock') AS INTEGER)
  );
END;

CREATE TABLE IF NOT EXISTS ph_suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
  contact TEXT NOT NULL DEFAULT '' CHECK(length(contact)<=180),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS ph_expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(length(category) BETWEEN 2 AND 80),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 2 AND 200),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
  spent_on TEXT NOT NULL CHECK(spent_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ph_expenses_date ON ph_expenses(spent_on DESC);
