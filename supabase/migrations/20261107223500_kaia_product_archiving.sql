-- Preserve product/order/payment history while removing archived items from the storefront.
alter table public.kaia_catalog_overrides
 add column if not exists archived boolean not null default false,
 add column if not exists archived_at timestamptz,
 add column if not exists archived_by uuid references auth.users(id);

-- No archived row may be offered publicly, even if an older save RPC is invoked.
create or replace function public.kaia_archived_product_visibility_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.archived=true and (new.visible=true or new.available=true) then
   raise exception 'PRODUTO_EXCLUIDO_NAO_PODE_SER_PUBLICADO'
    using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists kaia_archived_product_visibility_guard
 on public.kaia_catalog_overrides;
create trigger kaia_archived_product_visibility_guard
before insert or update on public.kaia_catalog_overrides
for each row execute function public.kaia_archived_product_visibility_guard();

-- Admin-only reversible removal. Unlike DELETE, never destroys stock or
-- historic customer order/payment items, mail receipts, images or audit records.
create or replace function public.kaia_admin_set_product_archived(
 p_product_key text,
 p_archive boolean,
 p_name text default null,
 p_description text default null,
 p_price_cents integer default null,
 p_old_price_cents integer default null,
 p_images text[] default null,
 p_brand text default null,
 p_category text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
    or p_category not in ('Skincare','Cabelos','Corpo e spa')
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
end $$;

revoke all on function public.kaia_admin_set_product_archived(
 text,boolean,text,text,integer,integer,text[],text,text
) from public,anon;
grant execute on function public.kaia_admin_set_product_archived(
 text,boolean,text,text,integer,integer,text[],text,text
) to authenticated;
