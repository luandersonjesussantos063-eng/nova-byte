-- Kaia Glow: an enquiry to order unavailable products. This is NOT a paid order,
-- inventory reservation or shipment promise. Seven calendar days = availability estimate.
create table if not exists public.kaia_preorder_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 sku text not null references public.kaia_sale_inventory(sku) on delete restrict,
 product_name text not null,
 quantity integer not null check(quantity between 1 and 5),
 indicative_price_cents integer check(indicative_price_cents is null or indicative_price_cents>0),
 status text not null default 'requested'
  check(status in ('requested','confirmed','ready','declined','cancelled','closed')),
 estimated_available_at timestamptz not null default (now()+interval '7 days'),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 admin_note text check(length(admin_note)<=1000)
);
create unique index if not exists kaia_preorder_active_per_customer_sku
 on public.kaia_preorder_requests(user_id,sku)
 where status in ('requested','confirmed','ready');
create index if not exists kaia_preorder_status_time
 on public.kaia_preorder_requests(status,requested_at desc);
create index if not exists kaia_preorder_customer_time
 on public.kaia_preorder_requests(user_id,requested_at desc);
alter table public.kaia_preorder_requests enable row level security;
revoke all on public.kaia_preorder_requests from public,anon,authenticated;
grant select on public.kaia_preorder_requests to authenticated;
create policy kaia_preorder_owner_read on public.kaia_preorder_requests
 for select to authenticated using((select auth.uid())=user_id);
create policy kaia_preorder_admin_read on public.kaia_preorder_requests
 for select to authenticated using((select public.kaia_is_store_admin()));

create table if not exists public.kaia_preorder_mail_outbox(
 id uuid primary key default gen_random_uuid(),
 preorder_id uuid not null references public.kaia_preorder_requests(id) on delete restrict,
 kind text not null check(kind in
 ('requested_buyer','requested_merchant','confirmed_buyer','ready_buyer',
  'declined_buyer','cancelled_buyer','cancelled_merchant')),
 status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 lease_id uuid,lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 provider_message_id text,last_error text,
 created_at timestamptz not null default now(),sent_at timestamptz,
 unique(preorder_id,kind)
);
create index if not exists kaia_preorder_mail_queue on public.kaia_preorder_mail_outbox
(status,next_attempt_at,created_at);
alter table public.kaia_preorder_mail_outbox enable row level security;
revoke all on public.kaia_preorder_mail_outbox from public,anon,authenticated;
grant select,insert,update on public.kaia_preorder_mail_outbox to service_role;

create or replace function public.kaia_submit_preorder(p_sku text,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
 v_product public.kaia_sale_inventory%rowtype;
 v_override public.kaia_catalog_overrides%rowtype;
 v_found_override boolean;
 v_req public.kaia_preorder_requests%rowtype;
 v_available boolean;
begin
 if v_uid is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
 or not exists(select 1 from auth.users u where u.id=v_uid
  and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()))
 then raise exception 'CONFIRME_SEU_EMAIL' using errcode='42501';end if;
 if p_sku is null or p_sku !~ '^KG-[A-Z0-9-]{4,90}$'
  or p_quantity is null or p_quantity not between 1 and 5
 then raise exception 'PRODUTO_OU_QUANTIDADE_INVALIDA' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,1024));
 select * into v_req from public.kaia_preorder_requests
  where user_id=v_uid and sku=p_sku and status in ('requested','confirmed','ready')
  order by requested_at desc limit 1;
 if found then return jsonb_build_object('id',v_req.id,'status',v_req.status,
  'estimatedAvailableAt',v_req.estimated_available_at,'existing',true);end if;
 if (select count(*) from public.kaia_preorder_requests
     where user_id=v_uid and requested_at>now()-interval '1 day')>=5
  or (select count(*) from public.kaia_preorder_requests
     where user_id=v_uid and status in ('requested','confirmed','ready'))>=5
 then raise exception 'LIMITE_DE_ENCOMENDAS' using errcode='23514';end if;
 select * into v_product from public.kaia_sale_inventory where sku=p_sku;
 if not found then raise exception 'PRODUTO_NAO_CADASTRADO' using errcode='22023';end if;
 select * into v_override from public.kaia_catalog_overrides where product_key=p_sku;
 v_found_override:=found;
 if (v_found_override and (v_override.archived or not v_override.visible))
  or (p_sku like 'KG-NEW-%' and (not v_found_override or not v_override.visible))
 then raise exception 'PRODUTO_FORA_DA_LOJA' using errcode='23514';end if;
 v_available:=coalesce(v_product.available_units,0)>=p_quantity
  and v_product.price_verified_at is not null
  and v_product.stock_verified_at is not null
  and v_product.package_verified_at is not null
  and exists(select 1 from public.kaia_sales_launch_cohort c
   where c.sku=p_sku and c.is_enabled=true);
 if v_available then raise exception 'PRODUTO_JA_DISPONIVEL_PARA_COMPRA'
  using errcode='23514';end if;
 insert into public.kaia_preorder_requests(
  user_id,sku,product_name,quantity,indicative_price_cents
 ) values(
  v_uid,p_sku,coalesce(nullif(v_override.name,''),nullif(v_product.display_name,''),p_sku),
  p_quantity,case when v_product.price_verified_at is not null
   then v_product.sale_price_cents else null end
 ) returning * into v_req;
 insert into public.kaia_preorder_mail_outbox(preorder_id,kind)
 values(v_req.id,'requested_buyer'),(v_req.id,'requested_merchant')
 on conflict(preorder_id,kind) do nothing;
 return jsonb_build_object('id',v_req.id,'status',v_req.status,
  'estimatedAvailableAt',v_req.estimated_available_at,'existing',false,
  'paymentRequiredNow',false);
end $$;
revoke all on function public.kaia_submit_preorder(text,integer) from public,anon;
grant execute on function public.kaia_submit_preorder(text,integer) to authenticated;

create or replace function public.kaia_cancel_my_preorder(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v public.kaia_preorder_requests%rowtype;
begin
 if v_uid is null then raise exception 'ENTRE_NA_CONTA' using errcode='42501';end if;
 select * into v from public.kaia_preorder_requests where id=p_id and user_id=v_uid for update;
 if not found then raise exception 'ENCOMENDA_NAO_ENCONTRADA' using errcode='22023';end if;
 if v.status not in ('requested','confirmed','ready') then
  raise exception 'ENCOMENDA_NAO_PODE_SER_CANCELADA' using errcode='23514';end if;
 update public.kaia_preorder_requests set status='cancelled',updated_at=now() where id=p_id;
 insert into public.kaia_preorder_mail_outbox(preorder_id,kind)
 values(p_id,'cancelled_buyer'),(p_id,'cancelled_merchant')
 on conflict(preorder_id,kind) do nothing;
 return jsonb_build_object('id',p_id,'status','cancelled');
end $$;
revoke all on function public.kaia_cancel_my_preorder(uuid) from public,anon;
grant execute on function public.kaia_cancel_my_preorder(uuid) to authenticated;

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
  select available_units into v_count from public.kaia_sale_inventory where sku=v.sku;
  if coalesce(v_count,0)<v.quantity then
   raise exception 'ESTOQUE_AINDA_NAO_DISPONIVEL' using errcode='23514';end if;
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

create or replace function public.kaia_preorder_mail_claim_batch()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 with jobs as(
  select id from public.kaia_preorder_mail_outbox
  where status in ('queued','sending') and next_attempt_at<=now()
   and (status='queued' or lease_until<now()) and attempts<5
  order by created_at,id for update skip locked limit 4
 ),claimed as(
  update public.kaia_preorder_mail_outbox m
  set status='sending',attempts=m.attempts+1,
   lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  from jobs where m.id=jobs.id
  returning m.id,m.lease_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'lease_id',lease_id)),'[]'::jsonb)
 into v from claimed;
 return v;
end $$;
revoke all on function public.kaia_preorder_mail_claim_batch() from public,anon,authenticated;
grant execute on function public.kaia_preorder_mail_claim_batch() to service_role;

create or replace function public.kaia_preorder_mail_details(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object(
  'id',m.id,'kind',m.kind,'name',coalesce(c.full_name,u.email),
  'email',u.email,'sku',r.sku,'product',r.product_name,'quantity',r.quantity,
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

create or replace function public.kaia_preorder_mail_mark(
 p_id uuid,p_lease uuid,p_success boolean,p_message_id text,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count int;
begin
 update public.kaia_preorder_mail_outbox set
 status=case when p_success then 'sent' when attempts>=5 then 'failed' else 'queued' end,
 sent_at=case when p_success then now() else null end,
 provider_message_id=case when p_success then left(p_message_id,120) else null end,
 last_error=case when p_success then null else left(coalesce(p_code,'EMAIL_SEND_FAILED'),64) end,
 next_attempt_at=case when p_success then now() else now()+make_interval(mins=>least(120,power(3,least(attempts,4))::int)) end,
 lease_id=null,lease_until=null
 where id=p_id and lease_id=p_lease and status='sending';
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;
revoke all on function public.kaia_preorder_mail_mark(uuid,uuid,boolean,text,text)
 from public,anon,authenticated;
grant execute on function public.kaia_preorder_mail_mark(uuid,uuid,boolean,text,text) to service_role;
