-- Kaia Glow: preserve a gift-wrapping request through real paid/free checkout.
-- Optional, subject to merchant availability; no extra price is implied.
alter table public.kaia_commercial_payments
 add column if not exists gift_packaging text not null default 'none'
 check(gift_packaging in ('none','box','bag'));
alter table public.kaia_orders
 add column if not exists gift_packaging text not null default 'none'
 check(gift_packaging in ('none','box','bag'));

-- New versioned wrappers keep the existing checkout RPC signatures intact
-- until a compatible store client is deployed. The entire operation commits
-- atomically, including the gift request and the order notification outbox.
create or replace function public.kaia_checkout_reserve_with_gift(
 p_user_id uuid,p_request_key uuid,p_items jsonb,p_shipping_cents integer,
 p_shipping_service text,p_postal_code text,p_coupon_code text,
 p_delivery_days integer,p_seller_code text,p_gift_packaging text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;v_code text;v_existing text;
begin
 v_code:=coalesce(p_gift_packaging,'none');
 if v_code not in ('none','box','bag') then
  raise exception 'EMBALAGEM_INVALIDA' using errcode='22023';end if;
 v:=public.kaia_checkout_reserve_attributed(
  p_user_id,p_request_key,p_items,p_shipping_cents,p_shipping_service,
  p_postal_code,p_coupon_code,p_delivery_days,p_seller_code);
 if (v->>'existing')::boolean then
  select gift_packaging into v_existing from public.kaia_commercial_payments
   where id=(v->>'id')::uuid and user_id=p_user_id;
  if v_existing is distinct from v_code then
   raise exception 'EMBALAGEM_PEDIDO_JA_CRIADO' using errcode='23514';end if;
 else
  update public.kaia_commercial_payments
  set gift_packaging=v_code
  where id=(v->>'id')::uuid and user_id=p_user_id and request_key=p_request_key;
 end if;
 return v;
end $$;
revoke all on function public.kaia_checkout_reserve_with_gift(
 uuid,uuid,jsonb,integer,text,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.kaia_checkout_reserve_with_gift(
 uuid,uuid,jsonb,integer,text,text,text,integer,text,text) to service_role;

create or replace function public.kaia_checkout_free_with_gift(
 p_user_id uuid,p_request_key uuid,p_items jsonb,p_coupon_code text,
 p_shipping_service text,p_list_shipping_cents integer,p_postal_code text,
 p_shipping_estimated_days integer,p_seller_code text,p_gift_packaging text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;v_code text;v_old text;
begin
 v_code:=coalesce(p_gift_packaging,'none');
 if v_code not in ('none','box','bag') then
  raise exception 'EMBALAGEM_INVALIDA' using errcode='22023';end if;
 v:=public.kaia_checkout_free_attributed(p_user_id,p_request_key,p_items,
  p_coupon_code,p_shipping_service,p_list_shipping_cents,p_postal_code,
  p_shipping_estimated_days,p_seller_code);
 if (v->>'existing')::boolean then
  select gift_packaging into v_old from public.kaia_commercial_payments
   where id=(v->>'id')::uuid and user_id=p_user_id;
  if v_old is distinct from v_code then
   raise exception 'EMBALAGEM_PEDIDO_JA_CRIADO' using errcode='23514';end if;
 else
  update public.kaia_commercial_payments set gift_packaging=v_code
   where id=(v->>'id')::uuid and user_id=p_user_id and request_key=p_request_key;
  update public.kaia_orders set gift_packaging=v_code
   where order_number='KG-'||replace((v->>'id')::text,'-','') and user_id=p_user_id;
 end if;
 return v;
end $$;
revoke all on function public.kaia_checkout_free_with_gift(
 uuid,uuid,jsonb,text,text,integer,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.kaia_checkout_free_with_gift(
 uuid,uuid,jsonb,text,text,integer,text,integer,text,text) to service_role;

-- Paid orders are inserted after provider confirmation. Copy the previously
-- locked-in gift request from the payment before each order row is created.
create or replace function public.kaia_order_attach_gift_choice()
returns trigger language plpgsql security definer set search_path='' as $$
declare v text;
begin
 select gift_packaging into v from public.kaia_commercial_payments p
 where 'KG-'||replace(p.id::text,'-','')=new.order_number
   and p.user_id=new.user_id;
 if v is not null then new.gift_packaging:=v;end if;
 return new;
end $$;
revoke all on function public.kaia_order_attach_gift_choice()
 from public,anon,authenticated;
drop trigger if exists kaia_order_gift_choice on public.kaia_orders;
create trigger kaia_order_gift_choice before insert on public.kaia_orders
 for each row execute function public.kaia_order_attach_gift_choice();

-- Existing mail worker continues to claim approved orders; details now include
-- the non-sensitive packaging request in both buyer and merchant receipts.
create or replace function public.kaia_mail_order_details(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 select jsonb_build_object(
 'id',p.id,'created_at',p.created_at,'user_id',p.user_id,
 'items',p.items,'products_cents',p.products_cents,'shipping_cents',p.shipping_cents,
 'list_products_cents',p.list_products_cents,'list_shipping_cents',p.list_shipping_cents,
 'discount_cents',p.discount_cents,'provider_order_id',p.provider_order_id,
 'total_cents',p.total_cents,
 'payment_method',case when p.provider_order_id is null then 'Cortesia (cupom 100%)' else 'Mercado Pago' end,
 'provider_status',p.provider_status,'shipping_service',p.shipping_service,
 'shipping_days',p.shipping_estimated_days,
 'destination',p.destination,'coupon_code',p.coupon_code,
 'gift_packaging',p.gift_packaging,
 'buyer_email',a.email,'buyer_name',c.full_name,
 'buyer_phone',d.phone,'buyer_cpf',d.cpf
 ) into r
 from public.kaia_commercial_payments p
 join public.kaia_customers c on c.user_id=p.user_id
 join public.kaia_customer_details d on d.user_id=p.user_id
 join auth.users a on a.id=p.user_id
 where p.id=p_payment_id and p.status='approved';
 return r;
end $$;
