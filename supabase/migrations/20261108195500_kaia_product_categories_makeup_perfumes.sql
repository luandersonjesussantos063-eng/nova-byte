-- Kaia Glow: allow merchandise categories Makeup and Perfumery in existing admin RPCs.
-- Retains role authorization and all other validation exactly as before.
-- kaia_admin_create_product: add product taxonomy without changing the existing price, availability or auth checks.
CREATE OR REPLACE FUNCTION public.kaia_admin_create_product(p_name text, p_brand text, p_category text, p_description text, p_price_cents integer, p_old_price_cents integer, p_stock_units integer, p_images text[], p_visible boolean, p_weight_grams integer DEFAULT NULL::integer, p_length_cm numeric DEFAULT NULL::numeric, p_width_cm numeric DEFAULT NULL::numeric, p_height_cm numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 n bigint; id_text text; sku_text text; owner_id uuid;
 image_url text; items text[];
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'Acesso administrativo negado' using errcode='42501';
 end if;
 if p_name is null or char_length(btrim(p_name)) not between 3 and 200
  or p_brand is null or char_length(btrim(p_brand)) not between 2 and 100
  or p_category is null or p_category not in ('Skincare','Maquiagem','Perfumaria','Cabelos','Corpo e spa')
  or p_description is null or char_length(p_description)>12000
  or p_price_cents is null or p_price_cents not between 100 and 100000000
  or p_old_price_cents is null or p_old_price_cents not between 0 and 100000000
  or p_stock_units is null or p_stock_units not between 0 and 100000
  or p_visible is null
  or (p_weight_grams is not null and p_weight_grams not between 1 and 100000)
  or (p_length_cm is not null and p_length_cm not between 0.1 and 150)
  or (p_width_cm is not null and p_width_cm not between 0.1 and 150)
  or (p_height_cm is not null and p_height_cm not between 0.1 and 150)
 then
  raise exception 'Dados do produto inválidos' using errcode='22023';
 end if;
 items:=coalesce(p_images,array[]::text[]);
 if coalesce(array_length(items,1),0)>10 then
  raise exception 'Limite de 10 fotos' using errcode='22023';
 end if;
 foreach image_url in array items loop
  if image_url is null or char_length(image_url)>350 or
   image_url !~ '^https://vajlhodqxskozuxxlujv[.]supabase[.]co/storage/v1/object/public/kaia-product-media/products/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$'
  then raise exception 'Fotos fora do armazenamento permitido' using errcode='22023'; end if;
 end loop;
 -- A newly published product needs a real uploaded photo; draft products can omit it.
 if p_visible and coalesce(array_length(items,1),0)=0 then
  raise exception 'Adicione pelo menos uma foto antes de publicar' using errcode='22023';
 end if;
 owner_id := (select auth.uid());
 n:=nextval('kaia_private.kaia_new_product_sequence'::regclass);
 id_text:=n::text;
 sku_text:='KG-NEW-'||id_text;
 insert into public.kaia_new_products(id,sku,brand,category,created_by)
 values(id_text,sku_text,btrim(p_brand),p_category,owner_id);
 insert into public.kaia_sale_inventory
  (sku,display_name,sale_price_cents,available_units,weight_grams,length_cm,width_cm,height_cm,
   price_verified_at,stock_verified_at,package_verified_at)
 values
  (sku_text,btrim(p_name),p_price_cents,p_stock_units,p_weight_grams,p_length_cm,p_width_cm,p_height_cm,
   now(),now(),null);
 insert into public.kaia_catalog_overrides
  (product_key,name,description,price_cents,old_price_cents,images,
   brand,category,available,visible,updated_at,updated_by)
 values
  (sku_text,btrim(p_name),p_description,p_price_cents,p_old_price_cents,items,
   btrim(p_brand),p_category,(p_stock_units>0),p_visible,now(),owner_id);
 insert into kaia_private.kaia_admin_change_log(editor,action,product_key)
 values(owner_id,'product_create',sku_text);
 return jsonb_build_object('created',true,'sku',sku_text,'id',id_text,
   'url','/produtos/novo/'||id_text);
end;
$function$;

-- kaia_admin_save_product_v2: add product taxonomy without changing the existing price, availability or auth checks.
CREATE OR REPLACE FUNCTION public.kaia_admin_save_product_v2(p_product_key text, p_name text, p_brand text, p_category text, p_description text, p_price_cents integer, p_old_price_cents integer, p_images text[], p_visible boolean, p_stock_units integer DEFAULT NULL::integer, p_weight_grams integer DEFAULT NULL::integer, p_length_cm numeric DEFAULT NULL::numeric, p_width_cm numeric DEFAULT NULL::numeric, p_height_cm numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved jsonb; is_new boolean; owner_id uuid;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'Acesso administrativo negado' using errcode='42501';
 end if;
 if p_brand is null or char_length(btrim(p_brand)) not between 2 and 100
   or p_category is null or p_category not in ('Skincare','Maquiagem','Perfumaria','Cabelos','Corpo e spa')
   or (p_weight_grams is not null and p_weight_grams not between 1 and 100000)
   or (p_length_cm is not null and p_length_cm not between 0.1 and 150)
   or (p_width_cm is not null and p_width_cm not between 0.1 and 150)
   or (p_height_cm is not null and p_height_cm not between 0.1 and 150)
 then raise exception 'Marca, categoria ou embalagem inválida' using errcode='22023'; end if;
 select exists(select 1 from public.kaia_new_products where sku=p_product_key)
  into is_new;
 if is_new and p_visible and coalesce(array_length(p_images,1),0)=0 then
  raise exception 'Adicione pelo menos uma foto antes de publicar' using errcode='22023';
 end if;
 saved:=public.kaia_admin_save_product(p_product_key,p_name,p_description,
  p_price_cents,p_old_price_cents,p_images,p_visible,p_stock_units);
 update public.kaia_catalog_overrides
  set brand=btrim(p_brand),category=p_category where product_key=p_product_key;
 if is_new then
  update public.kaia_new_products
   set brand=btrim(p_brand),category=p_category,updated_at=now()
   where sku=p_product_key;
  update public.kaia_sale_inventory
   set display_name=btrim(p_name),weight_grams=p_weight_grams,
       length_cm=p_length_cm,width_cm=p_width_cm,height_cm=p_height_cm,
       package_verified_at=null,updated_at=now()
   where sku=p_product_key;
 end if;
 return saved;
end;
$function$;

-- kaia_admin_set_product_archived: add product taxonomy without changing the existing price, availability or auth checks.
CREATE OR REPLACE FUNCTION public.kaia_admin_set_product_archived(p_product_key text, p_archive boolean, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price_cents integer DEFAULT NULL::integer, p_old_price_cents integer DEFAULT NULL::integer, p_images text[] DEFAULT NULL::text[], p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=(select auth.uid());
 v_current public.kaia_catalog_overrides%rowtype;
 v_photo text;
 v_legacy boolean;
 v_images text[];
begin
 if v_user is null or not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_ADMINISTRATIVO_NEGADO' using errcode='42501';
 end if;
 if p_product_key is null or p_product_key !~ '^(KG-[A-Z0-9-]{4,90}|legacy:[0-9]{1,15})$'
   or p_archive is null then
  raise exception 'PRODUTO_INVALIDO' using errcode='22023';
 end if;
 v_legacy:=left(p_product_key,7)='legacy:';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_product_key,19));
 select * into v_current from public.kaia_catalog_overrides
  where product_key=p_product_key for update;

 if p_archive then
  -- A payment reservation must be settled/cancelled by the existing payment
  -- flow before this product can be removed from further selling.
  if exists(
    select 1 from public.kaia_commercial_payments p
    where p.status in ('created','pending','review_required')
    and p.items @> jsonb_build_array(jsonb_build_object('sku',p_product_key))
  ) then
   raise exception 'EXISTE_PEDIDO_PENDENTE_PARA_ESTE_PRODUTO'
    using errcode='23514';
  end if;
  if not found then
   -- Legacy products ship as immutable catalog.js entries and may not yet have
   -- an override row. Store a validated tombstone to suppress that static item.
   if not v_legacy or p_name is null or char_length(btrim(p_name)) not between 3 and 200
    or p_description is null or length(p_description)>12000
    or p_price_cents is null or p_price_cents not between 100 and 100000000
    or p_old_price_cents is null or p_old_price_cents not between 0 and 100000000
    or p_brand is null or length(btrim(p_brand)) not between 2 and 100
    or p_category not in ('Skincare','Maquiagem','Perfumaria','Cabelos','Corpo e spa')
   then raise exception 'PRODUTO_NAO_ENCONTRADO_OU_DADOS_INVALIDOS'
    using errcode='22023';end if;
   v_images:=coalesce(p_images,'{}'::text[]);
   if cardinality(v_images)>10 then
    raise exception 'FOTOS_INVALIDAS' using errcode='22023';end if;
   foreach v_photo in array v_images loop
    if v_photo is null or
      v_photo !~ '^assets/catalog/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|avif)$'
    then raise exception 'FOTO_INVALIDA' using errcode='22023';end if;
   end loop;
   insert into public.kaia_catalog_overrides(
    product_key,name,description,price_cents,old_price_cents,
    images,brand,category,visible,available,archived,archived_at,archived_by,
    updated_at,updated_by
   ) values(
    p_product_key,btrim(p_name),p_description,p_price_cents,p_old_price_cents,
    v_images,btrim(p_brand),p_category,false,false,true,now(),v_user,now(),v_user
   );
  else
   update public.kaia_catalog_overrides
    set archived=true,visible=false,available=false,archived_at=now(),
      archived_by=v_user,updated_at=now(),updated_by=v_user
    where product_key=p_product_key;
  end if;
  if not v_legacy then
   update public.kaia_sales_launch_cohort set is_enabled=false
    where sku=p_product_key;
  end if;
 else
  if not found or v_current.archived is distinct from true then
   raise exception 'PRODUTO_EXCLUIDO_NAO_ENCONTRADO'
     using errcode='22023';
  end if;
  -- Restore to the ADMIN catalog only. Publishing and checkout release
  -- must be deliberate, separately approved actions.
  update public.kaia_catalog_overrides
   set archived=false,archived_at=null,archived_by=null,
      visible=false,available=false,updated_at=now(),updated_by=v_user
   where product_key=p_product_key;
 end if;

 insert into kaia_private.kaia_admin_change_log(editor,action,product_key)
 values(v_user,case when p_archive then 'product_archived' else 'product_restored' end,
  p_product_key);
 return jsonb_build_object('product_key',p_product_key,
   'archived',p_archive,'visible',false,'sales_enabled',false);
end $function$;
