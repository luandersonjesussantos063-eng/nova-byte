-- INSTALL ONLY IN AN ISOLATED SUPABASE TEST DATABASE containing the Kaia schema.
-- Never run on the shared production database. Operator must SET kaia.test_database='true'.
begin;
do $$ begin
 if current_setting('kaia.test_database',true) is distinct from 'true' then
  raise exception 'Explicit isolated test database acknowledgement required';
 end if;
end $$;
create table public.kaia_mp_test_config (
 singleton boolean primary key default true check(singleton),
 database_id uuid not null default gen_random_uuid()
);
insert into public.kaia_mp_test_config(singleton) values(true);
create table public.kaia_mp_test_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 idempotency_key uuid not null unique,
 request_hash text not null check(length(request_hash)=64),
 intent jsonb not null,
 payer_email text not null,
 status text not null default 'pendente' check(status in ('pendente','aprovado','recusado','cancelado')),
 subtotal_cents integer not null check(subtotal_cents>0),
 discount_cents integer not null check(discount_cents>=0 and discount_cents<subtotal_cents),
 shipping_cents integer not null check(shipping_cents>0),
 total_cents integer not null check(total_cents=subtotal_cents-discount_cents+shipping_cents and total_cents<=100000000),
 provider_id text unique check(provider_id ~ '^ORDTST[A-Z0-9]+$'),
 checkout_url text,
 stock_applied_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.kaia_mp_test_items (
 order_id uuid not null references public.kaia_mp_test_orders(id),
 sku text not null references public.kaia_sale_inventory(sku),
 quantity integer not null check(quantity between 1 and 24),
 unit_price_cents integer not null check(unit_price_cents>0),
 primary key(order_id,sku)
);
create index kaia_mp_test_items_sku_idx on public.kaia_mp_test_items(sku);
alter table public.kaia_mp_test_config enable row level security;
alter table public.kaia_mp_test_orders enable row level security;
alter table public.kaia_mp_test_items enable row level security;
revoke all on public.kaia_mp_test_config, public.kaia_mp_test_orders, public.kaia_mp_test_items from public,anon,authenticated;
grant select on public.kaia_mp_test_config to service_role;
grant select,insert,update on public.kaia_mp_test_orders,public.kaia_mp_test_items to service_role;
grant select,update on public.kaia_sale_inventory to service_role;
grant select on public.kaia_admin_coupons to service_role;

-- Functions are SECURITY INVOKER: only service_role has table access and EXECUTE.
create function public.kaia_mp_test_find(p_key uuid,p_user uuid,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kaia_mp_test_orders;
begin
 select * into o from public.kaia_mp_test_orders where idempotency_key=p_key;
 if not found then return null;end if;
 if o.user_id is distinct from p_user or o.request_hash is distinct from p_hash then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return to_jsonb(o);
end $$;

create function public.kaia_mp_test_prepare(p_key uuid,p_user uuid,p_hash text,p_intent jsonb,
 p_snapshot jsonb,p_shipping integer,p_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kaia_mp_test_orders; item jsonb; inv public.kaia_sale_inventory;
 c public.kaia_admin_coupons; subtotal bigint:=0; discount bigint:=0; reserved bigint;
 today date:=(now() at time zone 'America/Cuiaba')::date; n integer:=0; units integer:=0;
begin
 -- Serialize retries before locking SKUs. All inventory locks are ordered to avoid deadlocks.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into o from public.kaia_mp_test_orders where idempotency_key=p_key;
 if found then
  if o.user_id is distinct from p_user or o.request_hash is distinct from p_hash then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return to_jsonb(o);
 end if;
 if p_shipping is null or p_shipping<=0 or p_shipping>10000000 or p_email is null or
 jsonb_typeof(p_intent->'items') is distinct from 'array' or
 jsonb_array_length(p_intent->'items') not between 1 and 24 then raise exception 'INVALID_ORDER';end if;
 if (select count(distinct x->>'sku') from jsonb_array_elements(p_intent->'items') x)<>jsonb_array_length(p_intent->'items') then raise exception 'DUPLICATE_SKU';end if;
 for item in select value from jsonb_array_elements(p_intent->'items') order by value->>'sku' loop
  if (item->>'quantity') !~ '^[0-9]+$' or (item->>'quantity')::integer not between 1 and 24 then raise exception 'INVALID_QUANTITY';end if;
  select * into inv from public.kaia_sale_inventory where sku=item->>'sku' for update;
  if not found or inv.sale_price_cents is null or inv.sale_price_cents<=0 or inv.price_verified_at is null or
    inv.available_units is null or inv.stock_verified_at is null or inv.package_verified_at is null or
    inv.weight_grams is null or inv.weight_grams<=0 or inv.length_cm is null or inv.length_cm<=0 or
    inv.width_cm is null or inv.width_cm<=0 or inv.height_cm is null or inv.height_cm<=0
    then raise exception 'UNVERIFIED_INVENTORY';end if;
  -- A quote taken before an admin edit cannot authorize a different parcel/price.
  if not exists(select 1 from jsonb_array_elements(p_snapshot) s where s->>'sku'=inv.sku and
    (s->>'sale_price_cents')::integer=inv.sale_price_cents and
    (s->>'weight_grams')::integer=inv.weight_grams and (s->>'length_cm')::numeric=inv.length_cm and
    (s->>'width_cm')::numeric=inv.width_cm and (s->>'height_cm')::numeric=inv.height_cm)
    then raise exception 'QUOTE_SNAPSHOT_CHANGED';end if;
  select coalesce(sum(i.quantity),0) into reserved from public.kaia_mp_test_items i
   join public.kaia_mp_test_orders r on r.id=i.order_id where i.sku=inv.sku and r.status='pendente';
  if inv.available_units-reserved<(item->>'quantity')::integer then raise exception 'OUT_OF_STOCK';end if;
  subtotal:=subtotal+inv.sale_price_cents::bigint*(item->>'quantity')::integer;
  n:=n+1;units:=units+(item->>'quantity')::integer;
 end loop;
 if units>24 or subtotal>90000000 then raise exception 'ORDER_LIMIT';end if;
 if coalesce(p_intent->>'coupon','')<>'' then
  select * into c from public.kaia_admin_coupons where code=p_intent->>'coupon';
  if not found or not c.active or c.starts_at>today or c.ends_at<today or subtotal<c.min_order_cents then raise exception 'INVALID_COUPON';end if;
  if c.discount_type='percent' and c.discount_value between 1 and 90 then
   discount:=floor(subtotal*c.discount_value/100.0);
  elsif c.discount_type='fixed' and c.discount_value>0 then discount:=c.discount_value;
  else raise exception 'UNSUPPORTED_COUPON';end if;
  if discount>=subtotal then raise exception 'INVALID_DISCOUNT';end if;
 end if;
 insert into public.kaia_mp_test_orders(user_id,idempotency_key,request_hash,intent,payer_email,
  subtotal_cents,discount_cents,shipping_cents,total_cents)
 values(p_user,p_key,p_hash,p_intent,p_email,subtotal,discount,p_shipping,subtotal-discount+p_shipping) returning * into o;
 insert into public.kaia_mp_test_items(order_id,sku,quantity,unit_price_cents)
 select o.id,i->>'sku',(i->>'quantity')::integer,v.sale_price_cents
 from jsonb_array_elements(p_intent->'items') i join public.kaia_sale_inventory v on v.sku=i->>'sku';
 return to_jsonb(o);
end $$;

create function public.kaia_mp_test_bind(p_id uuid,p_provider_id text,p_url text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kaia_mp_test_orders;
begin
 select * into strict o from public.kaia_mp_test_orders where id=p_id for update;
 if o.provider_id is not null and o.provider_id<>p_provider_id then raise exception 'PROVIDER_CONFLICT';end if;
 update public.kaia_mp_test_orders set provider_id=p_provider_id,checkout_url=p_url,updated_at=now()
 where id=p_id returning * into o;return to_jsonb(o);
end $$;

create function public.kaia_mp_test_reconcile(p_id uuid,p_provider_id text,p_total integer,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kaia_mp_test_orders; i record; v public.kaia_sale_inventory;
begin
 select * into strict o from public.kaia_mp_test_orders where id=p_id for update;
 if p_total is distinct from o.total_cents or p_provider_id !~ '^ORDTST[A-Z0-9]+$' or
  (o.provider_id is not null and o.provider_id<>p_provider_id) then raise exception 'ORDER_MISMATCH';end if;
 if p_status not in ('pendente','aprovado','recusado','cancelado') then raise exception 'INVALID_STATE';end if;
 -- Read-after-provider-GET may race with another webhook. Never regress a terminal state.
 if o.status='aprovado' then return to_jsonb(o);end if;
 if o.status in ('recusado','cancelado') and p_status='pendente' then return to_jsonb(o);end if;
 if o.status in ('recusado','cancelado') and p_status<>o.status then raise exception 'TERMINAL_STATE_CONFLICT';end if;
 -- Lock the same central inventory rows used by prepare/admin; stock movement and state commit together.
 for i in select * from public.kaia_mp_test_items where order_id=p_id order by sku loop
  select * into strict v from public.kaia_sale_inventory where sku=i.sku for update;
  if p_status='aprovado' and o.stock_applied_at is null then
   if v.available_units is null or v.available_units<i.quantity then raise exception 'STOCK_RECONCILIATION_REQUIRED';end if;
   update public.kaia_sale_inventory set available_units=available_units-i.quantity,updated_at=now() where sku=i.sku;
  end if;
 end loop;
 update public.kaia_mp_test_orders set status=p_status,provider_id=p_provider_id,
  stock_applied_at=case when p_status='aprovado' then coalesce(stock_applied_at,now()) else stock_applied_at end,
  updated_at=now() where id=p_id returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.kaia_mp_test_find(uuid,uuid,text),
 public.kaia_mp_test_prepare(uuid,uuid,text,jsonb,jsonb,integer,text),
 public.kaia_mp_test_bind(uuid,text,text),public.kaia_mp_test_reconcile(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.kaia_mp_test_find(uuid,uuid,text),
 public.kaia_mp_test_prepare(uuid,uuid,text,jsonb,jsonb,integer,text),
 public.kaia_mp_test_bind(uuid,text,text),public.kaia_mp_test_reconcile(uuid,text,integer,text) to service_role;
commit;
