-- Resend marketing queue: individual opt-in customers only, no bulk sends.
create table if not exists public.kaia_target_coupon_deliveries(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 coupon_code text not null references public.kaia_admin_coupons(code),
 requested_by uuid not null references auth.users(id),
 status text not null default 'queued'
   check(status in ('queued','sending','sent','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 lease_id uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 provider_message_id text,
 last_error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
create index if not exists kaia_target_coupon_queue_status
on public.kaia_target_coupon_deliveries(status,next_attempt_at,created_at);
alter table public.kaia_target_coupon_deliveries enable row level security;
revoke all on public.kaia_target_coupon_deliveries from public,anon,authenticated;
grant select,insert,update on public.kaia_target_coupon_deliveries to service_role;

create or replace function public.kaia_admin_queue_customer_coupon(
 p_user_id uuid,p_coupon_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_code text:=upper(btrim(coalesce(p_coupon_code,'')));
 v_c public.kaia_admin_coupons%rowtype;v_id uuid;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_user_id is null or v_code !~ '^[A-Z0-9_-]{3,24}$'
 then raise exception 'SOLICITACAO_INVALIDA' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,432));
 if not exists(select 1 from public.kaia_customer_marketing_preferences p
  join auth.users u on u.id=p.user_id
  where p.user_id=p_user_id and p.offers_email=true and u.email_confirmed_at is not null
   and u.deleted_at is null)
 then raise exception 'CLIENTE_NAO_AUTORIZOU_OFERTAS' using errcode='23514';end if;
 select * into v_c from public.kaia_admin_coupons
  where code=v_code and active=true
  and (starts_at is null or starts_at<=((now() at time zone 'America/Cuiaba')::date))
  and (ends_at is null or ends_at>=((now() at time zone 'America/Cuiaba')::date));
 if not found or v_c.discount_type<>'percent' or v_c.discount_value<>100
 then raise exception 'USE_UM_CUPOM_ATIVO_DE_100_POR_CENTO' using errcode='23514';end if;
 if exists(select 1 from public.kaia_commercial_payments
   where user_id=p_user_id and coupon_code=v_code and status='approved')
 then raise exception 'CUPOM_JA_UTILIZADO_POR_CLIENTE' using errcode='23514';end if;
 if exists(select 1 from public.kaia_target_coupon_deliveries
   where user_id=p_user_id and coupon_code=v_code and
   status in ('queued','sending','sent') and created_at>now()-interval '14 days')
 then raise exception 'OFERTA_JA_ENVIADA_RECENTEMENTE' using errcode='23514';end if;
 if (select count(*) from public.kaia_target_coupon_deliveries
   where user_id=p_user_id and created_at>now()-interval '30 days'
   and status<>'cancelled')>=4
 then raise exception 'LIMITE_MENSAL_DE_OFERTAS' using errcode='23514';end if;
 insert into public.kaia_target_coupon_deliveries(user_id,coupon_code,requested_by)
 values(p_user_id,v_code,v_uid) returning id into v_id;
 return jsonb_build_object('queued',true,'id',v_id,'code',v_code);
end $$;
revoke all on function public.kaia_admin_queue_customer_coupon(uuid,text) from public,anon;
grant execute on function public.kaia_admin_queue_customer_coupon(uuid,text) to authenticated;

create or replace function public.kaia_coupon_mail_claim_batch()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 with ready as (
  select m.id from public.kaia_target_coupon_deliveries m
  join public.kaia_customer_marketing_preferences p on p.user_id=m.user_id
  join public.kaia_admin_coupons c on c.code=m.coupon_code
  where p.offers_email and c.active and
   m.status in ('queued','sending') and
   m.next_attempt_at<=now() and
   (m.status='queued' or m.lease_until<now())
   and m.attempts<5
  order by m.created_at,m.id for update of m skip locked limit 4
 ),claimed as (
  update public.kaia_target_coupon_deliveries m
   set status='sending',attempts=m.attempts+1,
   lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  from ready where m.id=ready.id
  returning m.id,m.lease_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'lease_id',c.lease_id)),'[]'::jsonb)
 into v_result from claimed c;
 return v_result;
end $$;
revoke all on function public.kaia_coupon_mail_claim_batch() from public,anon,authenticated;
grant execute on function public.kaia_coupon_mail_claim_batch() to service_role;

create or replace function public.kaia_coupon_mail_details(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 select jsonb_build_object(
  'id',m.id,'code',m.coupon_code,'name',c.full_name,
  'email',u.email,'value',a.discount_value,'expires',a.ends_at
 ) into v_result
 from public.kaia_target_coupon_deliveries m
 join public.kaia_customer_marketing_preferences p on p.user_id=m.user_id and p.offers_email=true
 join public.kaia_customers c on c.user_id=m.user_id
 join auth.users u on u.id=m.user_id and u.email_confirmed_at is not null and u.deleted_at is null
 join public.kaia_admin_coupons a on a.code=m.coupon_code and a.active=true
 where m.id=p_id and m.status='sending' and a.discount_type='percent' and a.discount_value=100
 and (a.ends_at is null or a.ends_at >= ((now() at time zone 'America/Cuiaba')::date));
 return v_result;
end $$;
revoke all on function public.kaia_coupon_mail_details(uuid) from public,anon,authenticated;
grant execute on function public.kaia_coupon_mail_details(uuid) to service_role;

create or replace function public.kaia_coupon_mail_mark(
 p_id uuid,p_lease uuid,p_success boolean,p_message_id text,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count int;
begin
 if p_error is not null and p_error !~ '^[A-Z_]{3,64}$'
 then raise exception 'ERROR_CODE_INVALID' using errcode='22023';end if;
 update public.kaia_target_coupon_deliveries
 set status=case when p_success then 'sent' when attempts>=5 then 'failed' else 'queued' end,
  sent_at=case when p_success then now() else null end,
  provider_message_id=case when p_success then left(coalesce(p_message_id,''),120) else null end,
  last_error=case when p_success then null else coalesce(p_error,'SEND_ERROR') end,
  next_attempt_at=case when p_success then now()
    else now()+make_interval(mins=>least(120,power(3,least(attempts,4))::int)) end,
  lease_id=null,lease_until=null
 where id=p_id and lease_id=p_lease and status='sending';
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;
revoke all on function public.kaia_coupon_mail_mark(uuid,uuid,boolean,text,text)
 from public,anon,authenticated;
grant execute on function public.kaia_coupon_mail_mark(uuid,uuid,boolean,text,text) to service_role;

create or replace function public.kaia_set_customer_marketing(p_offers boolean,p_named boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null or not (select kaia_private.has_verified_email()) then
  raise exception 'EMAIL_NAO_CONFIRMADO' using errcode='42501';end if;
 if p_offers is null or p_named is null then
  raise exception 'PREFERENCIA_INVALIDA' using errcode='22023';end if;
 insert into public.kaia_customer_marketing_preferences(user_id,offers_email,named_analytics)
 values(v_user,p_offers,p_named)
 on conflict(user_id) do update set offers_email=excluded.offers_email,
 named_analytics=excluded.named_analytics,consent_updated_at=now();
 if not p_named then
  delete from kaia_private.kaia_customer_interest_events where user_id=v_user;
 end if;
 if not p_offers then
  update public.kaia_target_coupon_deliveries set status='cancelled'
   where user_id=v_user and status='queued';
 end if;
 return jsonb_build_object('offersEmail',p_offers,'namedAnalytics',p_named);
end $$;
revoke all on function public.kaia_set_customer_marketing(boolean,boolean) from public,anon;
grant execute on function public.kaia_set_customer_marketing(boolean,boolean) to authenticated;
