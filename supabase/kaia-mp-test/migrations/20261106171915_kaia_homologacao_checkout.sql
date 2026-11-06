-- Only after 001/002, in a NEW isolated test database. No production migration.
begin;
create table kaia_mp_test.environment (
 singleton boolean primary key default true check(singleton),
 database_id uuid not null default gen_random_uuid(),
 purpose text not null default 'kaia-homologacao-only' check(purpose='kaia-homologacao-only')
);
insert into kaia_mp_test.environment(singleton) values(true);
alter table kaia_mp_test.environment enable row level security;
revoke all on kaia_mp_test.environment from public,anon,authenticated;
grant select on kaia_mp_test.environment to service_role;
alter table kaia_mp_test.checkout_orders add column request_owner text,
 add column request_hash text,add column checkout_url text,add column payer_email text,
 add column subtotal_cents integer,add column shipping_cents integer,add column discount_cents integer;
create table kaia_mp_test.test_coupons (
 code text primary key check(code ~ '^TEST-[A-Z0-9-]+$'),
 percent integer not null check(percent between 1 and 90),
 active boolean not null default false
);
alter table kaia_mp_test.test_coupons enable row level security;
revoke all on kaia_mp_test.test_coupons from public,anon,authenticated;
grant select on kaia_mp_test.test_coupons to service_role;
-- Synthetic QA coupon, unrelated to commercial offers.
insert into kaia_mp_test.test_coupons values('TEST-TEN',10,true);

-- Public RPC wrappers avoid exposing the private schema through PostgREST.
-- Caller is service_role; browser roles never get EXECUTE.
create function public.kaia_qa_environment() returns jsonb language sql security invoker
 set search_path='' as $$select to_jsonb(e) from kaia_mp_test.environment e$$;
create function public.kaia_qa_catalog(p_skus text[]) returns jsonb language sql security invoker
 set search_path='' as $$select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
 from kaia_mp_test.test_catalog t where t.sku=any(p_skus)$$;
create function public.kaia_qa_find(p_key uuid,p_owner text,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders;
begin
 select * into o from kaia_mp_test.checkout_orders where idempotency_key=p_key;
 if not found then return null;end if;
 if o.request_owner is distinct from p_owner or o.request_hash is distinct from p_hash then
 raise exception 'Idempotency owner or payload conflict';end if;
 return to_jsonb(o);
end $$;
create function public.kaia_qa_prepare(p_key uuid,p_owner text,p_hash text,p_items jsonb,
 p_snapshot jsonb,p_shipping integer,p_coupon text,p_email text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders; r jsonb; c kaia_mp_test.test_coupons; line record;
 discount integer:=0;
begin
 if p_owner is null or length(p_owner)<1 or p_email !~ '@testuser\.com$'
 or p_shipping is null or p_shipping<=0 then raise exception 'Invalid QA checkout';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 r:=public.kaia_qa_find(p_key,p_owner,p_hash);
 if r is not null then return r;end if;
 -- Freeze the quoted parcel/price by locking and rechecking before reservation.
 for line in select * from kaia_mp_test.test_catalog where sku in
  (select x->>'sku' from jsonb_array_elements(p_items) x) order by sku for update loop
  if not exists(select 1 from jsonb_array_elements(p_snapshot) s where s->>'sku'=line.sku
   and (s->>'price_cents')::integer=line.price_cents
   and (s->>'weight_grams')::integer=line.weight_grams
   and (s->>'length_cm')::numeric=line.length_cm
   and (s->>'width_cm')::numeric=line.width_cm
   and (s->>'height_cm')::numeric=line.height_cm) then raise exception 'Quote snapshot changed';end if;
 end loop;
 r:=kaia_mp_test.reserve_test_order(p_key,p_items);
 select * into strict o from kaia_mp_test.checkout_orders where id=(r->>'order_id')::uuid;
 if coalesce(p_coupon,'')<>'' then
  select * into c from kaia_mp_test.test_coupons where code=p_coupon and active;
  if not found then raise exception 'Invalid test coupon';end if;
  discount:=floor(o.total_cents::numeric*c.percent/100);
 end if;
 update kaia_mp_test.checkout_orders set request_owner=p_owner,request_hash=p_hash,
  payer_email=p_email,subtotal_cents=o.total_cents,discount_cents=discount,shipping_cents=p_shipping,
  total_cents=o.total_cents-discount+p_shipping where id=o.id returning * into o;
 return to_jsonb(o);
end $$;
create function public.kaia_qa_bind(p_id uuid,p_provider text,p_url text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders;
begin
 select * into strict o from kaia_mp_test.checkout_orders where id=p_id for update;
 if p_provider !~ '^ORDTST[A-Z0-9]+$' or (o.provider_order_id is not null and o.provider_order_id<>p_provider)
 then raise exception 'Provider identity mismatch';end if;
 update kaia_mp_test.checkout_orders set provider_order_id=p_provider,checkout_url=p_url,
 updated_at=now() where id=p_id returning * into o;return to_jsonb(o);
end $$;
create function public.kaia_qa_reconcile(p_id uuid,p_provider text,p_total integer,p_state text,p_event text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders;
begin
 select * into strict o from kaia_mp_test.checkout_orders where id=p_id for update;
 if o.request_owner is null or p_total is distinct from o.total_cents or p_provider !~ '^ORDTST[A-Z0-9]+$'
 then raise exception 'Authenticated provider order mismatch';end if;
 return kaia_mp_test.apply_verified_order(p_provider,p_id,p_state,p_event);
end $$;
revoke all on function public.kaia_qa_environment(),public.kaia_qa_catalog(text[]),
 public.kaia_qa_find(uuid,text,text),public.kaia_qa_prepare(uuid,text,text,jsonb,jsonb,integer,text,text),
 public.kaia_qa_bind(uuid,text,text),public.kaia_qa_reconcile(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.kaia_qa_environment(),public.kaia_qa_catalog(text[]),
 public.kaia_qa_find(uuid,text,text),public.kaia_qa_prepare(uuid,text,text,jsonb,jsonb,integer,text,text),
 public.kaia_qa_bind(uuid,text,text),public.kaia_qa_reconcile(uuid,text,integer,text,text) to service_role;
commit;
