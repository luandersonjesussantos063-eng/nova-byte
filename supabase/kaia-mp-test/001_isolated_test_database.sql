-- KAIA GLOW · MERCADO PAGO HOMOLOGAÇÃO
-- EXCLUSIVELY for a newly created, isolated Supabase test project.
-- DO NOT execute this SQL on vajlhodqxskozuxxlujv (Kaia Glow production)
-- or fermfbmhwlafwopwndoj (PP-MT).
-- The test environment MUST be verified before running this script.
begin;
create schema if not exists kaia_mp_test;
revoke all on schema kaia_mp_test from public, anon, authenticated;

create table if not exists kaia_mp_test.test_catalog (
 sku text primary key check (sku ~ '^TEST-KAIA-[A-Z0-9-]{2,45}$'),
 title text not null check (char_length(title) between 3 and 150),
 price_cents integer not null check (price_cents between 100 and 100000000),
 weight_grams integer not null check (weight_grams between 1 and 100000),
 length_cm numeric(8,2) not null check (length_cm between 0.1 and 150),
 width_cm numeric(8,2) not null check (width_cm between 0.1 and 150),
 height_cm numeric(8,2) not null check (height_cm between 0.1 and 150),
 price_verified boolean not null default false,
 package_verified boolean not null default false,
 total_units integer not null check (total_units between 0 and 100000),
 reserved_units integer not null default 0
  check (reserved_units between 0 and 100000),
 constraint stock_invariant check (reserved_units <= total_units)
);

create table if not exists kaia_mp_test.checkout_orders (
 id uuid primary key default gen_random_uuid(),
 idempotency_key uuid not null unique,
 provider_order_id text unique,
 payment_status text not null default 'pending'
  check (payment_status in ('pending','approved','rejected','cancelled')),
 stock_status text not null default 'reserved'
  check (stock_status in ('reserved','committed','released')),
 total_cents integer not null check (total_cents between 100 and 100000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists kaia_mp_test.checkout_items (
 order_id uuid not null references kaia_mp_test.checkout_orders(id) on delete cascade,
 sku text not null references kaia_mp_test.test_catalog(sku),
 qty integer not null check(qty between 1 and 500),
 unit_price_cents integer not null check(unit_price_cents between 100 and 100000000),
 primary key(order_id,sku)
);
create table if not exists kaia_mp_test.webhook_events (
 provider_event_id text primary key check (char_length(provider_event_id) between 5 and 150),
 provider_order_id text not null,
 event_type text not null,
 received_at timestamptz not null default now(),
 status text not null default 'received'
  check (status in ('received','verified','ignored','processed'))
);
create table if not exists kaia_mp_test.stock_audit (
 id bigint generated always as identity primary key,
 sku text not null,
 order_id uuid,
 event_type text not null,
 before_available integer not null,
 after_available integer not null,
 happened_at timestamptz not null default now()
);

alter table kaia_mp_test.test_catalog enable row level security;
alter table kaia_mp_test.checkout_orders enable row level security;
alter table kaia_mp_test.checkout_items enable row level security;
alter table kaia_mp_test.webhook_events enable row level security;
alter table kaia_mp_test.stock_audit enable row level security;
revoke all on all tables in schema kaia_mp_test from public,anon,authenticated;
grant usage on schema kaia_mp_test to service_role;
grant all on all tables in schema kaia_mp_test to service_role;
grant usage,select on all sequences in schema kaia_mp_test to service_role;

-- Atomic reservation. Entire test cart must be valid. Uses ordered row locking.
create or replace function kaia_mp_test.reserve_test_order(
 p_key uuid,
 p_items jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
 old_order kaia_mp_test.checkout_orders%rowtype;
 line record;
 total_cost bigint:=0;
 available integer;
 units integer;
 oid uuid;
begin
 if p_key is null or p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Invalid test order' using errcode='22023';end if;

 -- Idempotency is also enforced by UNIQUE; transaction-safe advisory lock
 -- prevents the same checkout from racing before order insertion.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into old_order from kaia_mp_test.checkout_orders where idempotency_key=p_key;
 if found then return jsonb_build_object('result','duplicate',
   'order_id',old_order.id,'total_cents',old_order.total_cents);end if;

 if exists(select 1 from jsonb_to_recordset(p_items) as l(sku text, qty integer)
   where sku is null or sku !~ '^TEST-KAIA-[A-Z0-9-]{2,45}$'
      or qty is null or qty not between 1 and 500)
  or exists(select 1 from jsonb_to_recordset(p_items) as l(sku text,qty integer)
   group by sku having count(*)>1)
 then raise exception 'Invalid or duplicate test SKU' using errcode='22023';end if;

 for line in select sku,qty from jsonb_to_recordset(p_items)
   as l(sku text,qty integer) order by sku
 loop
   select total_units-reserved_units, price_cents into available,units
   from kaia_mp_test.test_catalog
   where sku=line.sku and price_verified and package_verified
   for update;
   if not found or available<line.qty then
    raise exception 'Unverified item or insufficient test stock: %',line.sku
      using errcode='22023';
   end if;
   total_cost:=total_cost+units::bigint*line.qty::bigint;
   if total_cost>100000000 then raise exception 'Test order exceeds limit';end if;
 end loop;
 insert into kaia_mp_test.checkout_orders(idempotency_key,total_cents)
 values(p_key,total_cost::integer) returning id into oid;
 for line in select sku,qty from jsonb_to_recordset(p_items)
   as l(sku text,qty integer) order by sku
 loop
   select total_units-reserved_units,price_cents into available,units
   from kaia_mp_test.test_catalog where sku=line.sku for update;
   insert into kaia_mp_test.checkout_items(order_id,sku,qty,unit_price_cents)
    values(oid,line.sku,line.qty,units);
   update kaia_mp_test.test_catalog
    set reserved_units=reserved_units+line.qty where sku=line.sku;
   insert into kaia_mp_test.stock_audit
    (sku,order_id,event_type,before_available,after_available)
    values(line.sku,oid,'reserve',available,available-line.qty);
 end loop;
 return jsonb_build_object('result','reserved','order_id',oid,
   'total_cents',total_cost);
end;
$function$;

-- Apply status after authenticated GET /v1/orders/{id}; never trust a redirect
-- query string or unsigned webhook body. No second stock decrement on duplicates.
create or replace function kaia_mp_test.apply_verified_order(
 p_provider_order_id text,p_local_order_id uuid,
 p_status text,p_event_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
 rec kaia_mp_test.checkout_orders%rowtype;
 line record;
 before_av integer;
begin
 if p_provider_order_id is null or length(p_provider_order_id) not between 1 and 150
   or p_event_id is null or length(p_event_id) not between 5 and 150
   or p_local_order_id is null
   or p_status not in ('approved','rejected','cancelled','pending')
 then raise exception 'Invalid verified event' using errcode='22023';end if;
 select * into rec from kaia_mp_test.checkout_orders
  where id=p_local_order_id for update;
 if not found then raise exception 'Unknown test order' using errcode='22023';end if;
 if rec.provider_order_id is not null and rec.provider_order_id<>p_provider_order_id
 then raise exception 'Provider order mismatch' using errcode='22023';end if;
 insert into kaia_mp_test.webhook_events(provider_event_id,provider_order_id,event_type)
 values(p_event_id,p_provider_order_id,p_status)
 on conflict(provider_event_id) do nothing;
 if not found then return jsonb_build_object('result','duplicate_event','stock_changed',false);end if;
 if rec.stock_status<>'reserved' then
  return jsonb_build_object('result','already_finalized','stock_changed',false);
 end if;
 if p_status='pending' then
  return jsonb_build_object('result','pending','stock_changed',false);
 end if;
 if p_status='approved' then
  for line in select sku,qty from kaia_mp_test.checkout_items
   where order_id=rec.id order by sku
  loop
   select total_units-reserved_units into before_av
   from kaia_mp_test.test_catalog where sku=line.sku for update;
   update kaia_mp_test.test_catalog
   set total_units=total_units-line.qty,
       reserved_units=reserved_units-line.qty where sku=line.sku;
   insert into kaia_mp_test.stock_audit
   (sku,order_id,event_type,before_available,after_available)
   values(line.sku,rec.id,'approved',before_av,before_av);
  end loop;
  update kaia_mp_test.checkout_orders
   set payment_status='approved',stock_status='committed',
    provider_order_id=p_provider_order_id,updated_at=now()
    where id=rec.id;
  return jsonb_build_object('result','approved','stock_changed',true);
 end if;
 for line in select sku,qty from kaia_mp_test.checkout_items
   where order_id=rec.id order by sku
 loop
  select total_units-reserved_units into before_av
  from kaia_mp_test.test_catalog where sku=line.sku for update;
  update kaia_mp_test.test_catalog
   set reserved_units=reserved_units-line.qty where sku=line.sku;
  insert into kaia_mp_test.stock_audit
   (sku,order_id,event_type,before_available,after_available)
   values(line.sku,rec.id,'release',before_av,before_av+line.qty);
 end loop;
 update kaia_mp_test.checkout_orders
  set payment_status=p_status,stock_status='released',
      provider_order_id=p_provider_order_id,updated_at=now() where id=rec.id;
 return jsonb_build_object('result',p_status,'stock_changed',true);
end;
$function$;

revoke all on function kaia_mp_test.reserve_test_order(uuid,jsonb)
 from public,anon,authenticated;
revoke all on function kaia_mp_test.apply_verified_order(text,uuid,text,text)
 from public,anon,authenticated;
grant execute on function kaia_mp_test.reserve_test_order(uuid,jsonb) to service_role;
grant execute on function kaia_mp_test.apply_verified_order(text,uuid,text,text) to service_role;
commit;
