-- Official historical store products without a stock SKU can request an
-- authenticated, non-paying 7-day preorder using a validated legacy key.
-- Do not insert fake rows in sale_inventory or change Olist synchronization.
create table if not exists public.kaia_legacy_preorder_catalog (
 product_key text primary key check(product_key ~ '^legacy:[0-9]{1,15}$'),
 product_name text not null check(length(product_name) between 3 and 250),
 indicative_price_cents integer not null check(indicative_price_cents between 100 and 100000000),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.kaia_legacy_preorder_catalog enable row level security;
revoke all on public.kaia_legacy_preorder_catalog from public,anon,authenticated;
grant select on public.kaia_legacy_preorder_catalog to service_role;
insert into public.kaia_legacy_preorder_catalog(product_key,product_name,indicative_price_cents)
values ('legacy:373646022','Máscara Facial Medicube Kojic Acid Turmeric Brightening Gel Mask – Ácido Kójico, Cúrcuma e Niacinamida 2% | 28g',5990),
 ('legacy:351484546','Escova Corporal Spa Premium',4990),
 ('legacy:351486569','Massageador Capilar Spa',5990),
 ('legacy:351518277','Maishaishai Repair Milky Bubble Serum',22990),
 ('legacy:351524913','Ongredients Pocket Moisturizer',14990),
 ('legacy:372237134','Fino Premium Touch Máscara Capilar Barbie Edição Limitada – Reparação, Brilho e Maciez',21990),
 ('legacy:372237674','Fino Premium Touch Barbie — edição limitada (cadastro sem título na origem)',27990),
 ('legacy:373649121','Máscara Hidratante para Pescoço e Colo – Neck Mask | Cuidado Antirressecamento e Linhas Finas',1299),
 ('legacy:373650258','Celimax Retinal Shot Tightening Dual Cream – Creme Facial Antissinais com Retinal 0,05%, Pantenol 5% e Matrixyl 3000 | 30ml',32990),
 ('legacy:351513794','Medicube PDRN Pink Collagen Glow Jelly Mist',25990),
 ('legacy:351520134','Medicube TXA Niacinamide Capsule Cream 5%',24900),
 ('legacy:351528512','Medicube Collagen Jelly Cream',22990),
 ('legacy:351532700','Medicube PDRN Pink Caffeine Night Wrapping Mask',29990),
 ('legacy:358414277','Medicube Red Acne Succinic Acid Peel',34990),
 ('legacy:351493694','ILSO Melting Sebum Softener',29990),
 ('legacy:351506097','Abib Collagen Eye Patch Jericho Rose',24990),
 ('legacy:351513294','Kérastase Gloss Absolu Glaze Drops produto vendido sob encomenda',34990),
 ('legacy:351517055','d’Alba Aromatic Spray Serum',29990)
on conflict(product_key) do update
 set product_name=excluded.product_name,
     indicative_price_cents=excluded.indicative_price_cents,
     updated_at=now();

alter table public.kaia_preorder_requests
 add column if not exists legacy_key text references public.kaia_legacy_preorder_catalog(product_key) on delete restrict;
alter table public.kaia_preorder_requests alter column sku drop not null;
alter table public.kaia_preorder_requests
 add constraint kaia_preorders_one_product_key
 check ((sku is not null and legacy_key is null) or
        (sku is null and legacy_key is not null));
create unique index if not exists kaia_preorder_active_per_customer_legacy
 on public.kaia_preorder_requests(user_id,legacy_key)
 where legacy_key is not null and status in ('requested','confirmed','ready');

create or replace function public.kaia_submit_preorder(p_sku text,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
 v_product public.kaia_sale_inventory%rowtype;
 v_override public.kaia_catalog_overrides%rowtype;
 v_legacy public.kaia_legacy_preorder_catalog%rowtype;
 v_req public.kaia_preorder_requests%rowtype;
 v_found_override boolean;v_is_legacy boolean;v_available boolean;
 v_name text;v_price integer;
begin
 if v_uid is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
 or not exists(select 1 from auth.users u where u.id=v_uid
  and u.email_confirmed_at is not null
  and (u.banned_until is null or u.banned_until<now()))
 then raise exception 'CONFIRME_SEU_EMAIL' using errcode='42501';end if;
 if p_sku is null
  or (p_sku !~ '^KG-[A-Z0-9-]{4,90}$' and p_sku !~ '^legacy:[0-9]{1,15}$')
  or p_quantity is null or p_quantity not between 1 and 5
 then raise exception 'PRODUTO_OU_QUANTIDADE_INVALIDA' using errcode='22023';end if;
 v_is_legacy:=left(p_sku,7)='legacy:';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,1024));
 select * into v_req from public.kaia_preorder_requests
  where user_id=v_uid and (sku=p_sku or legacy_key=p_sku)
   and status in ('requested','confirmed','ready')
  order by requested_at desc limit 1;
 if found then
  return jsonb_build_object('id',v_req.id,'status',v_req.status,
   'estimatedAvailableAt',v_req.estimated_available_at,'existing',true,
   'paymentRequiredNow',false);
 end if;
 if (select count(*) from public.kaia_preorder_requests
     where user_id=v_uid and requested_at>now()-interval '1 day')>=5
  or (select count(*) from public.kaia_preorder_requests
     where user_id=v_uid and status in ('requested','confirmed','ready'))>=5
 then raise exception 'LIMITE_DE_ENCOMENDAS' using errcode='23514';end if;

 select * into v_override from public.kaia_catalog_overrides
  where product_key=p_sku;
 v_found_override:=found;
 if v_found_override and (v_override.archived or not v_override.visible)
 then raise exception 'PRODUTO_FORA_DA_LOJA' using errcode='23514';end if;

 if v_is_legacy then
  select * into v_legacy from public.kaia_legacy_preorder_catalog
   where product_key=p_sku and active=true;
  if not found then
   raise exception 'PRODUTO_NAO_CADASTRADO' using errcode='22023';end if;
  -- Legacy items have no inventory SKU and cannot be purchased through the
  -- commercial checkout. A requested preorder is manually reviewed.
  v_name:=coalesce(nullif(v_override.name,''),v_legacy.product_name);
  v_price:=coalesce(v_override.price_cents,v_legacy.indicative_price_cents);
 else
  select * into v_product from public.kaia_sale_inventory where sku=p_sku;
  if not found then raise exception 'PRODUTO_NAO_CADASTRADO' using errcode='22023';end if;
  if p_sku like 'KG-NEW-%' and (not v_found_override or not v_override.visible)
  then raise exception 'PRODUTO_FORA_DA_LOJA' using errcode='23514';end if;
  v_available:=coalesce(v_product.available_units,0)>=p_quantity
    and v_product.price_verified_at is not null
    and v_product.stock_verified_at is not null
    and v_product.package_verified_at is not null
    and exists(select 1 from public.kaia_sales_launch_cohort c
      where c.sku=p_sku and c.is_enabled=true);
  if v_available then
   raise exception 'PRODUTO_JA_DISPONIVEL_PARA_COMPRA' using errcode='23514';
  end if;
  v_name:=coalesce(nullif(v_override.name,''),nullif(v_product.display_name,''),p_sku);
  v_price:=case when v_product.price_verified_at is not null
    then v_product.sale_price_cents else null end;
 end if;
 insert into public.kaia_preorder_requests
  (user_id,sku,legacy_key,product_name,quantity,indicative_price_cents)
 values(v_uid,case when v_is_legacy then null else p_sku end,
  case when v_is_legacy then p_sku else null end,
  v_name,p_quantity,v_price)
 returning * into v_req;
 insert into public.kaia_preorder_mail_outbox(preorder_id,kind)
 values(v_req.id,'requested_buyer'),(v_req.id,'requested_merchant')
 on conflict(preorder_id,kind) do nothing;
 return jsonb_build_object('id',v_req.id,'status',v_req.status,
  'estimatedAvailableAt',v_req.estimated_available_at,'existing',false,
  'paymentRequiredNow',false);
end $$;
revoke all on function public.kaia_submit_preorder(text,integer) from public,anon;
grant execute on function public.kaia_submit_preorder(text,integer) to authenticated;

create or replace function public.kaia_admin_manage_preorder(
 p_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.kaia_preorder_requests%rowtype;v_actor uuid:=(select auth.uid());v_count int;
begin
 if v_actor is null or not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_id is null or p_status not in ('confirmed','ready','declined','closed')
  or length(coalesce(p_note,''))>1000
 then raise exception 'ACAO_INVALIDA' using errcode='22023';end if;
 select * into v from public.kaia_preorder_requests where id=p_id for update;
 if not found then raise exception 'ENCOMENDA_NAO_ENCONTRADA' using errcode='22023';end if;
 if not (
  v.status='requested' and p_status in ('confirmed','declined')
  or v.status='confirmed' and p_status in ('ready','declined')
  or v.status='ready' and p_status='closed'
 ) then raise exception 'TRANSICAO_DE_ENCOMENDA_INVALIDA' using errcode='23514';end if;
 if p_status='declined' and length(btrim(coalesce(p_note,'')))<8 then
  raise exception 'EXPLIQUE_A_RECUSA' using errcode='22023';end if;
 if p_status='ready' then
  if v.legacy_key is not null then
   if length(btrim(coalesce(p_note,'')))<8 then
    raise exception 'CONFIRME_RECEBIMENTO_DO_PRODUTO' using errcode='23514';
   end if;
  else
   select available_units into v_count from public.kaia_sale_inventory where sku=v.sku;
   if coalesce(v_count,0)<v.quantity then
    raise exception 'ESTOQUE_AINDA_NAO_DISPONIVEL' using errcode='23514';end if;
  end if;
 end if;
 update public.kaia_preorder_requests set status=p_status,updated_at=now(),
  reviewed_by=v_actor,admin_note=nullif(btrim(coalesce(p_note,'')),'')
 where id=p_id;
 if p_status in ('confirmed','ready','declined') then
  insert into public.kaia_preorder_mail_outbox(preorder_id,kind)
   values(p_id,p_status||'_buyer') on conflict(preorder_id,kind) do nothing;
 end if;
 return jsonb_build_object('id',p_id,'status',p_status);
end $$;
revoke all on function public.kaia_admin_manage_preorder(uuid,text,text) from public,anon;
grant execute on function public.kaia_admin_manage_preorder(uuid,text,text) to authenticated;

create or replace function public.kaia_admin_preorder_list()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'sku',coalesce(r.sku,r.legacy_key),
  'product',r.product_name,'quantity',r.quantity,
  'status',r.status,'estimatedAvailableAt',r.estimated_available_at,
  'requestedAt',r.requested_at,'updatedAt',r.updated_at,
  'adminNote',r.admin_note,
  'customer',coalesce(c.full_name,u.email),'email',u.email
 ) order by
  case r.status when 'requested' then 0 when 'confirmed' then 1
    when 'ready' then 2 else 3 end,r.requested_at desc
 ),'[]'::jsonb) into v_result
 from (select * from public.kaia_preorder_requests
  order by requested_at desc limit 150) r
 join auth.users u on u.id=r.user_id
 left join public.kaia_customers c on c.user_id=r.user_id;
 return v_result;
end $$;
revoke all on function public.kaia_admin_preorder_list() from public,anon;
grant execute on function public.kaia_admin_preorder_list() to authenticated;

create or replace function public.kaia_preorder_mail_details(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object(
  'id',m.id,'kind',m.kind,'name',coalesce(c.full_name,u.email),
  'email',u.email,'sku',coalesce(r.sku,r.legacy_key),
  'product',r.product_name,'quantity',r.quantity,
  'status',r.status,'estimatedAvailableAt',r.estimated_available_at,
  'note',r.admin_note,'reference',r.id
 ) into v
 from public.kaia_preorder_mail_outbox m
 join public.kaia_preorder_requests r on r.id=m.preorder_id
 join auth.users u on u.id=r.user_id
 left join public.kaia_customers c on c.user_id=r.user_id
 where m.id=p_id and m.status='sending';
 return v;
end $$;
revoke all on function public.kaia_preorder_mail_details(uuid) from public,anon,authenticated;
grant execute on function public.kaia_preorder_mail_details(uuid) to service_role;
