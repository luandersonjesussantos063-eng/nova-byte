-- Kaia tables are independent of the other applications in this shared project.
create schema if not exists kaia_private;
revoke all on schema kaia_private from public, anon;
grant usage on schema kaia_private to authenticated;

create table public.kaia_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (char_length(full_name) between 2 and 100),
 referral_code text not null unique default encode(extensions.gen_random_bytes(10),'hex'),
 created_at timestamptz not null default now()
);
create table public.kaia_referrals (
 id uuid primary key default gen_random_uuid(),
 inviter_id uuid not null references public.kaia_customers(user_id) on delete cascade,
 referred_id uuid not null unique references public.kaia_customers(user_id) on delete cascade,
 status text not null default 'registered' check (status in ('registered','validated','reward_ready','reward_sent')),
 created_at timestamptz not null default now(),
 check (inviter_id <> referred_id)
);
create index kaia_referrals_inviter_created_idx on public.kaia_referrals(inviter_id,created_at desc);
create table public.kaia_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.kaia_customers(user_id) on delete cascade,
 order_number text not null unique,
 status text not null default 'received' check (status in ('received','confirmed','preparing','shipped','delivered','cancelled')),
 total_cents integer not null check(total_cents >= 0),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
 created_at timestamptz not null default now()
);
create index kaia_orders_user_created_idx on public.kaia_orders(user_id,created_at desc);
alter table public.kaia_customers enable row level security;
alter table public.kaia_referrals enable row level security;
alter table public.kaia_orders enable row level security;
revoke all on public.kaia_customers,public.kaia_referrals,public.kaia_orders from anon,authenticated;
grant select on public.kaia_customers to authenticated;
grant insert(user_id,full_name),update(full_name) on public.kaia_customers to authenticated;
grant select(id,status,created_at) on public.kaia_referrals to authenticated;
grant select on public.kaia_orders to authenticated;
grant all on public.kaia_customers,public.kaia_referrals,public.kaia_orders to service_role;
create policy kaia_customer_read on public.kaia_customers for select to authenticated
 using ((select auth.uid())=user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_customer_create on public.kaia_customers for insert to authenticated
 with check ((select auth.uid())=user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_customer_update on public.kaia_customers for update to authenticated
 using ((select auth.uid())=user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true')
 with check ((select auth.uid())=user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_referrals_read on public.kaia_referrals for select to authenticated
 using ((select auth.uid())=inviter_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_orders_read on public.kaia_orders for select to authenticated
 using ((select auth.uid())=user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');

-- This private definer only performs the cross-customer code lookup/claim.
-- It needs elevated access because customers cannot browse other profiles or insert referral statuses.
create function kaia_private.claim_referral(code text) returns text language plpgsql security definer
set search_path = '' as $$
declare caller uuid := auth.uid(); inviter uuid;
begin
 if caller is null or (auth.jwt()->>'is_anonymous')='true' then
  raise exception 'Entre na sua conta para registrar a indicação.' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) then
  raise exception 'Confirme seu e-mail antes de registrar a indicação.' using errcode='42501';
 end if;
 if not exists(select 1 from public.kaia_customers where user_id=caller) then
  raise exception 'Complete seu cadastro primeiro.';
 end if;
 if code is null or code !~ '^[a-f0-9]{20}$' then return 'invalid'; end if;
 select user_id into inviter from public.kaia_customers where referral_code=code;
 if inviter is null then return 'invalid'; end if;
 if inviter=caller then return 'self'; end if;
 if exists(select 1 from public.kaia_referrals where referred_id=caller) then return 'already'; end if;
 insert into public.kaia_referrals(inviter_id,referred_id) values(inviter,caller) on conflict(referred_id) do nothing;
 return 'registered';
end $$;
revoke all on function kaia_private.claim_referral(text) from public,anon;
grant execute on function kaia_private.claim_referral(text) to authenticated;
create function public.kaia_claim_referral(code text) returns text language sql security invoker
set search_path = '' as $$ select kaia_private.claim_referral(code); $$;
revoke all on function public.kaia_claim_referral(text) from public,anon;
grant execute on function public.kaia_claim_referral(text) to authenticated;
