-- Kaia Glow: one-off BRL 5.00 checkout ledger. REVIEW BEFORE APPLYING.
-- Deploy only after server-side implementation and production database credentials are prepared.
-- This migration does not create a payment, public checkout, or customer-facing inventory SKU.
begin;
create table if not exists public.kaia_mp_live_pilot_orders (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  provider_order_id text unique,
  amount_cents integer not null default 500 check (amount_cents = 500),
  currency text not null default 'BRL' check (currency='BRL'),
  status text not null default 'created' check (status in ('created','pending','approved','rejected','cancelled','review_required','refunded')),
  provider_status text,
  provider_status_detail text,
  checkout_url text,
  paid_amount_cents integer not null default 0 check(paid_amount_cents>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kaia_mp_live_pilot_orders enable row level security;
revoke all on public.kaia_mp_live_pilot_orders from anon,authenticated;
create unique index if not exists kaia_mp_live_pilot_only_one_approved
on public.kaia_mp_live_pilot_orders ((true))
where status='approved';
create table if not exists public.kaia_mp_live_pilot_webhook_events (
  id bigint generated always as identity primary key,
  provider_event_key text not null unique,
  provider_order_id text not null,
  processed_at timestamptz not null default now(),
  outcome text not null check (outcome in ('processed','ignored','review_required')),
  order_id uuid references public.kaia_mp_live_pilot_orders(id)
);
alter table public.kaia_mp_live_pilot_webhook_events enable row level security;
revoke all on public.kaia_mp_live_pilot_webhook_events from anon,authenticated;
commit;
