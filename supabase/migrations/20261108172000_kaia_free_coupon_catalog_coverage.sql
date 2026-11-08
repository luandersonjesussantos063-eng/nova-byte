-- Free coupons must work on the normal 51-SKU catalog, not just on products with admin overrides.
CREATE OR REPLACE FUNCTION public.kaia_commercial_redeem_free_coupon(p_user_id uuid, p_request_key uuid, p_items jsonb, p_coupon_code text, p_shipping_service text, p_list_shipping_cents integer, p_postal_code text, p_shipping_estimated_days integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_existing public.kaia_commercial_payments%rowtype;
 v_destination jsonb;
 v_coupon public.kaia_admin_coupons%rowtype;
 v_product record;
 v_item jsonb;
 v_qty integer;
 v_count integer:=0;
 v_quantity integer:=0;
 v_list_subtotal bigint:=0;
 v_lines jsonb:='[]'::jsonb;
 v_id uuid;
begin
 if p_user_id is null or p_request_key is null or p_items is null
  or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 12
  or p_coupon_code is null or p_coupon_code !~ '^[A-Z0-9_-]{3,24}$'
  or p_list_shipping_cents not between 1 and 1000000
  or p_shipping_service !~ '^[0-9]{1,4}$'
  or p_postal_code !~ '^[0-9]{8}$'
  or (p_shipping_estimated_days is not null and p_shipping_estimated_days not between 1 and 90)
 then raise exception 'SOLICITACAO_INVALIDA' using errcode='22023'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into v_existing from public.kaia_commercial_payments
 where user_id=p_user_id and request_key=p_request_key;
 if found then
  if v_existing.coupon_code=p_coupon_code and v_existing.status='approved'
    and v_existing.total_cents=0 and v_existing.provider_order_id is null
  then return jsonb_build_object('id',v_existing.id,'status','approved','existing',true);
  end if;
  raise exception 'CHAVE_PEDIDO_JA_USADA' using errcode='23505';
 end if;
 select * into v_coupon from public.kaia_admin_coupons where code=p_coupon_code;
 if not found or v_coupon.active is distinct from true
  or v_coupon.discount_type<>'percent' or v_coupon.discount_value<>100
  or (v_coupon.customer_user_id is not null and v_coupon.customer_user_id<>p_user_id)
  or (v_coupon.starts_at is not null and v_coupon.starts_at>(now() at time zone 'America/Campo_Grande')::date)
  or (v_coupon.ends_at is not null and v_coupon.ends_at<(now() at time zone 'America/Campo_Grande')::date)
 then raise exception 'CUPOM_INVALIDO' using errcode='23514'; end if;
 if exists (select 1 from public.kaia_commercial_payments
   where user_id=p_user_id and coupon_code=p_coupon_code and status='approved')
 then raise exception 'CUPOM_JA_UTILIZADO' using errcode='23514'; end if;

 if not exists(select 1 from public.kaia_customers where user_id=p_user_id)
 then raise exception 'CLIENTE_INCOMPLETO' using errcode='23503'; end if;
 select pg_catalog.to_jsonb(d) into v_destination
   from public.kaia_customer_details d where d.user_id=p_user_id;
 if v_destination is null or v_destination->>'postal_code'<>p_postal_code
 then raise exception 'ENDERECO_INCOMPLETO' using errcode='22023'; end if;
 if (select count(*) from
  (select x->>'sku' sku from jsonb_array_elements(p_items) x group by 1) t)
  <>jsonb_array_length(p_items)
 then raise exception 'PRODUTO_REPETIDO' using errcode='22023'; end if;

 for v_product in
  select i.sku,i.display_name,i.sale_price_cents,i.available_units,
         i.price_verified_at,i.stock_verified_at,i.package_verified_at,
         i.weight_grams,i.length_cm,i.width_cm,i.height_cm,
         cohort.is_enabled,coalesce(cat.visible,true) as visible,
         coalesce(cat.archived,false) as archived
    from public.kaia_sale_inventory i
    join public.kaia_sales_launch_cohort cohort on cohort.sku=i.sku
    left join public.kaia_catalog_overrides cat on cat.product_key=i.sku
   where i.sku in (select x->>'sku' from jsonb_array_elements(p_items) x)
   order by i.sku for update of i
 loop
  v_count:=v_count+1;
  select x into v_item from jsonb_array_elements(p_items) x where x->>'sku'=v_product.sku;
  if v_item is null or (v_item->>'quantity') !~ '^[0-9]{1,2}$'
  then raise exception 'QUANTIDADE_INVALIDA' using errcode='22023'; end if;
  v_qty:=(v_item->>'quantity')::integer;
  v_quantity:=v_quantity+v_qty;
  if v_qty not between 1 and 10 or v_quantity>24
   or v_product.is_enabled is distinct from true or v_product.visible is distinct from true
   or v_product.archived=true
   or v_product.price_verified_at is null or v_product.stock_verified_at is null
   or v_product.package_verified_at is null or v_product.sale_price_cents<100
   or v_product.available_units<v_qty
   or v_product.weight_grams<=0 or v_product.length_cm<=0
   or v_product.width_cm<=0 or v_product.height_cm<=0
  then raise exception 'ITEM_NAO_APTO_OU_ESTOQUE' using errcode='23514'; end if;
  v_list_subtotal:=v_list_subtotal+v_qty*v_product.sale_price_cents;
  v_lines:=v_lines || jsonb_build_array(jsonb_build_object(
    'sku',v_product.sku,'name',v_product.display_name,
    'quantity',v_qty,'unit_cents',v_product.sale_price_cents
  ));
  update public.kaia_sale_inventory
    set available_units=available_units-v_qty,updated_at=now()
    where sku=v_product.sku;
 end loop;
 if v_count<>jsonb_array_length(p_items) or v_list_subtotal<=0 or
  v_list_subtotal>100000000 or v_list_subtotal<v_coupon.min_order_cents
 then raise exception 'PRODUTO_NAO_ELEGIVEL' using errcode='23514'; end if;

 insert into public.kaia_commercial_payments(
   user_id,request_key,status,items,products_cents,shipping_cents,total_cents,
   list_products_cents,list_shipping_cents,discount_cents,coupon_code,
   shipping_service,postal_code,destination,paid_amount_cents,
   provider_status,provider_status_detail,shipping_estimated_days
 ) values (
   p_user_id,p_request_key,'approved',v_lines,0,0,0,
   v_list_subtotal,p_list_shipping_cents,v_list_subtotal,p_coupon_code,
   p_shipping_service,p_postal_code,v_destination,0,
   'coupon_full_discount','Integral de produtos + frete',p_shipping_estimated_days
 ) returning id into v_id;
 insert into public.kaia_orders(user_id,order_number,status,total_cents,items)
 values (p_user_id,'KG-'||replace(v_id::text,'-',''),'confirmed',0,v_lines)
 on conflict(order_number) do nothing;
 return jsonb_build_object('id',v_id,'status','approved','total_cents',0,'existing',false);
end;
$function$;
