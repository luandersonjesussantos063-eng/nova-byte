-- Kaia Glow: seller/affiliate accounts, immutable order attribution and 10%
-- net-product commissions. No buyer PII is exposed to sellers.
create table if not exists public.kaia_sales_representatives(
 user_id uuid primary key references auth.users(id) on delete restrict,
 code text not null unique check(code ~ '^KGV[A-F0-9]{12}$'),
 active boolean not null default true,
 commission_bps integer not null default 1000 check(commission_bps=1000),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.kaia_seller_commissions(
 payment_id uuid primary key references public.kaia_commercial_payments(id) on delete restrict,
 seller_user_id uuid not null references public.kaia_sales_representatives(user_id) on delete restrict,
 base_cents integer not null check(base_cents>=0),
 commission_cents integer not null check(commission_cents>=0),
 status text not null check(status in ('pending','earned','reversed')),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists kaia_seller_commissions_by_seller
 on public.kaia_seller_commissions(seller_user_id,status,created_at desc);
create table if not exists public.kaia_seller_payout_records(
 id uuid primary key default gen_random_uuid(),
 seller_user_id uuid not null references public.kaia_sales_representatives(user_id) on delete restrict,
 amount_cents integer not null check(amount_cents>0 and amount_cents<=100000000),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 note text,
 paid_at timestamptz not null default now()
);
create index if not exists kaia_seller_payout_by_seller
 on public.kaia_seller_payout_records(seller_user_id,paid_at desc);
alter table public.kaia_commercial_payments
 add column if not exists seller_user_id uuid references public.kaia_sales_representatives(user_id) on delete restrict;
create index if not exists kaia_payments_by_seller
 on public.kaia_commercial_payments(seller_user_id,created_at desc)
 where seller_user_id is not null;

alter table public.kaia_sales_representatives enable row level security;
alter table public.kaia_seller_commissions enable row level security;
alter table public.kaia_seller_payout_records enable row level security;
revoke all on public.kaia_sales_representatives,public.kaia_seller_commissions,
 public.kaia_seller_payout_records from public,anon,authenticated;
grant select,insert,update on public.kaia_sales_representatives to service_role;
grant select,insert,update on public.kaia_seller_commissions to service_role;
grant select,insert on public.kaia_seller_payout_records to service_role;

-- Payment lifecycle drives commission state. A repeated webhook cannot
-- double-credit because payment_id is the primary key. Reversals are reflected.
create or replace function public.kaia_refresh_seller_commission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_state text;v_base integer;v_fee integer;
begin
 if new.seller_user_id is null then return new;end if;
 v_base:=greatest(0,new.products_cents);
 v_fee:=round(v_base::numeric*1000/10000)::integer;
 v_state:=case
  when new.status='approved' and new.total_cents>0
   and new.paid_amount_cents>=new.total_cents then 'earned'
  when new.status in ('cancelled','rejected','refunded') then 'reversed'
  else 'pending' end;
 insert into public.kaia_seller_commissions(
  payment_id,seller_user_id,base_cents,commission_cents,status,approved_at
 ) values(new.id,new.seller_user_id,v_base,v_fee,v_state,
  case when v_state='earned' then now() else null end)
 on conflict(payment_id) do update set
  base_cents=excluded.base_cents,
  commission_cents=excluded.commission_cents,
  status=excluded.status,
  approved_at=case when excluded.status='earned'
    then coalesce(public.kaia_seller_commissions.approved_at,now()) else null end,
  updated_at=now();
 return new;
end $$;
revoke all on function public.kaia_refresh_seller_commission() from public,anon,authenticated;
drop trigger if exists kaia_payment_seller_commission_sync on public.kaia_commercial_payments;
create trigger kaia_payment_seller_commission_sync
 after insert or update of seller_user_id,status,products_cents,paid_amount_cents
 on public.kaia_commercial_payments
 for each row execute function public.kaia_refresh_seller_commission();

create or replace function public.kaia_public_seller_code_valid(p_code text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.kaia_sales_representatives s
  join auth.users u on u.id=s.user_id
  where s.code=upper(btrim(coalesce(p_code,''))) and s.active
   and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<now())
 );
$$;
revoke all on function public.kaia_public_seller_code_valid(text) from public;
grant execute on function public.kaia_public_seller_code_valid(text)
 to anon,authenticated,service_role;

-- Only verified existing accounts can become sellers. Roles are
-- independent from admin permissions; seller login cannot open admin data.
create or replace function public.kaia_admin_set_seller(
 p_email text,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_user uuid;v_code text;v_enabled boolean;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ADMINISTRADOR_NAO_AUTORIZADO' using errcode='42501';end if;
 if p_email is null or length(p_email)>200 or
   p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or p_active is null then
  raise exception 'DADOS_DO_VENDEDOR_INVALIDOS' using errcode='22023';end if;
 select id into v_user from auth.users
 where lower(email)=lower(btrim(p_email))
 and email_confirmed_at is not null and deleted_at is null
 and (banned_until is null or banned_until<now()) limit 1;
 if v_user is null then
  raise exception 'CADASTRE_E_CONFIRME_O_EMAIL' using errcode='23514';end if;
 select code into v_code from public.kaia_sales_representatives where user_id=v_user for update;
 if v_code is null then
  if not p_active then raise exception 'VENDEDOR_NAO_CADASTRADO' using errcode='23514';end if;
  v_code:='KGV'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.kaia_sales_representatives(user_id,code,created_by)
   values(v_user,v_code,v_actor);
 else
  update public.kaia_sales_representatives
   set active=p_active,updated_at=now() where user_id=v_user;
 end if;
 return jsonb_build_object('email',lower(btrim(p_email)),
  'userId',v_user,'code',v_code,'active',p_active,
  'link','https://usekaiaglow.com.br/?vendedor='||v_code);
end $$;
revoke all on function public.kaia_admin_set_seller(text,boolean) from public,anon;
grant execute on function public.kaia_admin_set_seller(text,boolean) to authenticated;

-- This wrapper runs reservation + seller assignment atomically. Existing
-- request_key retries cannot change seller attribution retroactively.
create or replace function public.kaia_checkout_reserve_attributed(
 p_user_id uuid,p_request_key uuid,p_items jsonb,p_shipping_cents integer,
 p_shipping_service text,p_postal_code text,p_coupon_code text default null,
 p_delivery_days integer default null,p_seller_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_seller uuid;v_code text;
begin
 if p_user_id is null or p_request_key is null then
  raise exception 'PEDIDO_INVALIDO' using errcode='22023';end if;
 v_code:=upper(btrim(coalesce(p_seller_code,'')));
 if v_code~'^KGV[A-F0-9]{12}$' then
  select s.user_id into v_seller
  from public.kaia_sales_representatives s join auth.users u on u.id=s.user_id
  where s.code=v_code and s.active and s.user_id<>p_user_id
   and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<now());
 end if;
 if nullif(btrim(coalesce(p_coupon_code,'')),'') is null then
  v_result:=public.kaia_commercial_reserve(
    p_user_id,p_request_key,p_items,p_shipping_cents,p_shipping_service,p_postal_code);
 else
  v_result:=public.kaia_commercial_reserve_discounted(
    p_user_id,p_request_key,p_items,p_shipping_cents,p_shipping_service,
    p_postal_code,p_coupon_code,p_delivery_days);
 end if;
 if v_seller is not null and (v_result->>'existing')::boolean is false then
  update public.kaia_commercial_payments set seller_user_id=v_seller
   where id=(v_result->>'id')::uuid and user_id=p_user_id
     and request_key=p_request_key and seller_user_id is null;
 end if;
 return v_result;
end $$;
revoke all on function public.kaia_checkout_reserve_attributed(uuid,uuid,jsonb,integer,text,text,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.kaia_checkout_reserve_attributed(uuid,uuid,jsonb,integer,text,text,text,integer,text)
 to service_role;

create or replace function public.kaia_checkout_free_attributed(
 p_user_id uuid,p_request_key uuid,p_items jsonb,p_coupon_code text,
 p_shipping_service text,p_list_shipping_cents integer,p_postal_code text,
 p_shipping_estimated_days integer default null,p_seller_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_seller uuid;v_code text;
begin
 v_code:=upper(btrim(coalesce(p_seller_code,'')));
 if v_code~'^KGV[A-F0-9]{12}$' then
  select s.user_id into v_seller
  from public.kaia_sales_representatives s join auth.users u on u.id=s.user_id
  where s.code=v_code and s.active and s.user_id<>p_user_id
   and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<now());
 end if;
 v_result:=public.kaia_commercial_redeem_free_coupon(
  p_user_id,p_request_key,p_items,p_coupon_code,p_shipping_service,
  p_list_shipping_cents,p_postal_code,p_shipping_estimated_days);
 if v_seller is not null and (v_result->>'existing')::boolean is false then
  update public.kaia_commercial_payments set seller_user_id=v_seller
  where id=(v_result->>'id')::uuid and user_id=p_user_id and request_key=p_request_key
   and seller_user_id is null;
 end if;
 return v_result;
end $$;
revoke all on function public.kaia_checkout_free_attributed(uuid,uuid,jsonb,text,text,integer,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.kaia_checkout_free_attributed(uuid,uuid,jsonb,text,text,integer,text,integer,text)
 to service_role;
