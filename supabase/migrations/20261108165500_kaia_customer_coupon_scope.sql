-- Kaia Glow: targeted coupons have an immutable customer binding.
-- Public coupons remain visible. A private coupon is not visible to anon
-- and cannot be redeemed by another user even if its code leaks.
alter table public.kaia_admin_coupons
 add column if not exists customer_user_id uuid references auth.users(id) on delete restrict;
create index if not exists kaia_customer_private_coupons
 on public.kaia_admin_coupons(customer_user_id)
 where customer_user_id is not null;
drop policy if exists kaia_coupons_active_public_read on public.kaia_admin_coupons;
create policy kaia_coupons_active_public_read on public.kaia_admin_coupons
 for select to anon,authenticated
 using(active=true and customer_user_id is null
  and (starts_at is null or starts_at<=current_date)
  and (ends_at is null or ends_at>=current_date));

-- Existing admin-read policy is preserved.
-- Authenticated customers can retrieve only a single valid code belonging to
-- themselves; this private RPC never reveals other customers or their codes.
create or replace function public.kaia_customer_coupon_lookup(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text:=upper(btrim(coalesce(p_code,'')));
 v_user uuid:=(select auth.uid());v public.kaia_admin_coupons%rowtype;
begin
 if v_user is null or coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
 then raise exception 'ENTRE_NA_CONTA' using errcode='42501';end if;
 if v_code !~ '^[A-Z0-9_-]{3,24}$' then
  raise exception 'CUPOM_INVALIDO' using errcode='22023';end if;
 select * into v from public.kaia_admin_coupons
 where code=v_code and active=true
  and (customer_user_id is null or customer_user_id=v_user)
  and (starts_at is null or starts_at<=(now() at time zone 'America/Cuiaba')::date)
  and (ends_at is null or ends_at>=(now() at time zone 'America/Cuiaba')::date);
 if not found then return null;end if;
 if v.customer_user_id is not null and exists(
  select 1 from public.kaia_commercial_payments
   where user_id=v_user and coupon_code=v_code and status='approved'
 ) then return null;end if;
 return jsonb_build_object(
  'code',v.code,'discount_type',v.discount_type,'discount_value',v.discount_value,
  'min_order_cents',v.min_order_cents,'starts_at',v.starts_at,'ends_at',v.ends_at,
  'active',true,'personal',v.customer_user_id is not null);
end $$;
revoke all on function public.kaia_customer_coupon_lookup(text) from public,anon;
grant execute on function public.kaia_customer_coupon_lookup(text) to authenticated;

-- Existing public or personally addressed coupon can be sent to the buyer
-- ONLY when there is recorded marketing opt-in and a confirmed email.
create or replace function public.kaia_admin_queue_customer_coupon(
 p_user_id uuid,p_coupon_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
 v_code text:=upper(btrim(coalesce(p_coupon_code,'')));
 v_c public.kaia_admin_coupons%rowtype;v_id uuid;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_user_id is null or v_code !~ '^[A-Z0-9_-]{3,24}$'
 then raise exception 'SOLICITACAO_INVALIDA' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,432));
 if not exists(select 1 from public.kaia_customer_marketing_preferences p
  join auth.users u on u.id=p.user_id
  where p.user_id=p_user_id and p.offers_email=true
   and u.email_confirmed_at is not null and u.deleted_at is null)
 then raise exception 'CLIENTE_NAO_AUTORIZOU_OFERTAS' using errcode='23514';end if;
 select * into v_c from public.kaia_admin_coupons
 where code=v_code and active=true
  and (customer_user_id is null or customer_user_id=p_user_id)
  and (starts_at is null or starts_at<=(now() at time zone 'America/Cuiaba')::date)
  and (ends_at is null or ends_at>=(now() at time zone 'America/Cuiaba')::date);
 if not found then raise exception 'CUPOM_INATIVO_OU_DE_OUTRA_CLIENTE'
  using errcode='23514';end if;
 if exists(select 1 from public.kaia_commercial_payments
  where user_id=p_user_id and coupon_code=v_code and status='approved')
 then raise exception 'CUPOM_JA_UTILIZADO_POR_CLIENTE' using errcode='23514';end if;
 if exists(select 1 from public.kaia_target_coupon_deliveries
  where user_id=p_user_id and coupon_code=v_code
   and status in ('queued','sending','sent')
   and created_at>now()-interval '14 days')
 then raise exception 'OFERTA_JA_ENVIADA_RECENTEMENTE' using errcode='23514';end if;
 if (select count(*) from public.kaia_target_coupon_deliveries
  where user_id=p_user_id and created_at>now()-interval '30 days'
   and status<>'cancelled')>=4
 then raise exception 'LIMITE_MENSAL_DE_OFERTAS' using errcode='23514';end if;
 insert into public.kaia_target_coupon_deliveries(user_id,coupon_code,requested_by)
 values(p_user_id,v_code,v_uid) returning id into v_id;
 return jsonb_build_object('queued',true,'id',v_id,'code',v_code);
end $$;
revoke all on function public.kaia_admin_queue_customer_coupon(uuid,text)
 from public,anon;
grant execute on function public.kaia_admin_queue_customer_coupon(uuid,text)
 to authenticated;

-- All-or-nothing private code creation and queueing for that same customer.
create or replace function public.kaia_admin_create_personal_coupon(
 p_user_id uuid,p_discount_type text,p_discount_value integer,
 p_min_order_cents integer default 0,p_ends_at date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_code text;v_end date;
 v_queued jsonb;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_user_id is null or p_discount_type not in ('percent','fixed')
  or p_discount_value is null or p_discount_value not between 1 and 10000000
  or (p_discount_type='percent' and p_discount_value>100)
  or p_min_order_cents is null or p_min_order_cents not between 0 and 100000000
 then raise exception 'DESCONTO_INVALIDO' using errcode='22023';end if;
 v_end:=coalesce(p_ends_at,((now() at time zone 'America/Cuiaba')::date+30));
 if v_end<(now() at time zone 'America/Cuiaba')::date
  or v_end>(now() at time zone 'America/Cuiaba')::date+365
 then raise exception 'VENCIMENTO_INVALIDO' using errcode='22023';end if;
 -- Unpredictable per-customer code; not a public campaign.
 v_code:='KGEX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 insert into public.kaia_admin_coupons(
  code,discount_type,discount_value,min_order_cents,
  starts_at,ends_at,active,updated_at,updated_by,customer_user_id
 ) values(
  v_code,p_discount_type,p_discount_value,p_min_order_cents,
  (now() at time zone 'America/Cuiaba')::date,v_end,
  true,now(),v_actor,p_user_id
 );
 v_queued:=public.kaia_admin_queue_customer_coupon(p_user_id,v_code);
 insert into kaia_private.kaia_admin_change_log(editor,action,product_key)
 values(v_actor,'coupon_private_create',v_code);
 return jsonb_build_object('code',v_code,'recipient',p_user_id,
  'queued',true,'mail_id',v_queued->>'id','expires',v_end);
end $$;
revoke all on function public.kaia_admin_create_personal_coupon(
 uuid,text,integer,integer,date) from public,anon;
grant execute on function public.kaia_admin_create_personal_coupon(
 uuid,text,integer,integer,date) to authenticated;

-- Email worker can access coupon details only while the same customer's
-- consent is present and the coupon is either public or belongs to them.
create or replace function public.kaia_coupon_mail_details(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 select jsonb_build_object(
  'id',m.id,'code',m.coupon_code,'name',c.full_name,
  'email',u.email,'value',a.discount_value,'kind',a.discount_type,
  'minCents',a.min_order_cents,'expires',a.ends_at,
  'personal',a.customer_user_id is not null
 ) into v_result
 from public.kaia_target_coupon_deliveries m
 join public.kaia_customer_marketing_preferences p
  on p.user_id=m.user_id and p.offers_email=true
 join public.kaia_customers c on c.user_id=m.user_id
 join auth.users u on u.id=m.user_id
  and u.email_confirmed_at is not null and u.deleted_at is null
 join public.kaia_admin_coupons a on a.code=m.coupon_code and a.active=true
  and (a.customer_user_id is null or a.customer_user_id=m.user_id)
 where m.id=p_id and m.status='sending'
  and (a.starts_at is null or a.starts_at<=(now() at time zone 'America/Cuiaba')::date)
  and (a.ends_at is null or a.ends_at>=(now() at time zone 'America/Cuiaba')::date);
 return v_result;
end $$;
revoke all on function public.kaia_coupon_mail_details(uuid)
 from public,anon,authenticated;
grant execute on function public.kaia_coupon_mail_details(uuid) to service_role;
