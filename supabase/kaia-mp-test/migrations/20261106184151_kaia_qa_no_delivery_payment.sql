-- Synthetic QA payment without physical delivery. Never a commercial freight quote.
begin;
alter table kaia_mp_test.checkout_orders add column shipping_mode text not null default 'sandbox'
 check(shipping_mode in ('sandbox','no_delivery'));
create or replace function public.kaia_qa_prepare(p_key uuid,p_owner text,p_hash text,p_items jsonb,
 p_snapshot jsonb,p_shipping integer,p_coupon text,p_email text,p_shipping_mode text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders; r jsonb; c kaia_mp_test.test_coupons; line record;
 discount integer:=0;
begin
 if p_owner is null or length(p_owner)<1 or (p_email is not null and p_email !~ '@testuser\.com$')
 or p_shipping is null or p_shipping<0 or p_shipping_mode is null or
 p_shipping_mode not in ('sandbox','no_delivery') or
 (p_shipping_mode='sandbox' and p_shipping<=0) or
 (p_shipping_mode='no_delivery' and p_shipping<>0) then raise exception 'Invalid QA checkout';end if;
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
  payer_email=p_email,shipping_mode=p_shipping_mode,subtotal_cents=o.total_cents,discount_cents=discount,shipping_cents=p_shipping,
  total_cents=o.total_cents-discount+p_shipping where id=o.id returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.kaia_qa_prepare(uuid,text,text,jsonb,jsonb,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.kaia_qa_prepare(uuid,text,text,jsonb,jsonb,integer,text,text,text) to service_role;
commit;
