-- Kaia Glow: explicit per-product commercial release.
-- A product visible in the storefront is not automatically authorized for real payments.
-- Only a verified store admin can approve actual packaging and enable the existing launch cohort.
create or replace function public.kaia_admin_set_product_commerce(
  p_product_key text,
  p_enable boolean,
  p_package_confirmed boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid;
  v_item public.kaia_sale_inventory%rowtype;
  v_product public.kaia_catalog_overrides%rowtype;
begin
  v_user := (select auth.uid());
  if v_user is null or not (select public.kaia_is_store_admin()) then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;
  if p_product_key is null or p_product_key !~ '^KG-NEW-[0-9]{5,20}$'
     or p_enable is null
     or not exists (select 1 from public.kaia_new_products n where n.sku = p_product_key) then
    raise exception 'Produto novo não encontrado' using errcode = '22023';
  end if;

  select * into v_item from public.kaia_sale_inventory
  where sku = p_product_key for update;
  if not found then
    raise exception 'Estoque comercial não encontrado' using errcode = '22023';
  end if;
  select * into v_product from public.kaia_catalog_overrides
  where product_key = p_product_key for update;
  if not found then
    raise exception 'Produto não publicado no catálogo' using errcode = '22023';
  end if;

  if p_enable then
    if p_package_confirmed is distinct from true then
      raise exception 'Confirme as medidas reais da embalagem antes de liberar vendas'
        using errcode = '22023';
    end if;
    if v_product.visible is distinct from true
       or v_product.available is distinct from true
       or coalesce(array_length(v_product.images, 1), 0) < 1 then
      raise exception 'Exiba o produto com foto e estoque antes de liberar vendas'
        using errcode = '22023';
    end if;
    if v_item.available_units < 1
       or v_item.sale_price_cents < 100
       or v_item.sale_price_cents <> v_product.price_cents
       or v_item.price_verified_at is null
       or v_item.stock_verified_at is null
       or v_item.weight_grams is null or v_item.weight_grams < 1
       or v_item.length_cm is null or v_item.length_cm <= 0
       or v_item.width_cm is null or v_item.width_cm <= 0
       or v_item.height_cm is null or v_item.height_cm <= 0 then
      raise exception 'Confira preço, estoque, peso e dimensões salvos antes de liberar vendas'
        using errcode = '22023';
    end if;
    update public.kaia_sale_inventory
       set package_verified_at = now(), updated_at = now()
     where sku = p_product_key;
    insert into public.kaia_sales_launch_cohort(sku, wave, is_enabled)
      values (p_product_key, 1, true)
      on conflict (sku) do update set is_enabled = true;
  else
    update public.kaia_sales_launch_cohort
       set is_enabled = false
     where sku = p_product_key;
  end if;

  insert into kaia_private.kaia_admin_change_log(editor, action, product_key)
    values (v_user, case when p_enable then 'online_sale_enabled' else 'online_sale_paused' end, p_product_key);
  return jsonb_build_object('sku', p_product_key, 'enabled', p_enable);
end;
$function$;

revoke all on function public.kaia_admin_set_product_commerce(text, boolean, boolean) from public, anon;
grant execute on function public.kaia_admin_set_product_commerce(text, boolean, boolean) to authenticated;
