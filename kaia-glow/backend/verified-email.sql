-- Verification is checked against Auth's server-owned record, never user metadata.
create or replace function kaia_private.has_verified_email() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null
 and (auth.jwt()->>'is_anonymous') is distinct from 'true'
 and exists(select 1 from auth.users u where u.id=auth.uid()
  and u.email is not null and u.email_confirmed_at is not null
  and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now()));
$$;
revoke all on function kaia_private.has_verified_email() from public,anon;
grant execute on function kaia_private.has_verified_email() to authenticated;
alter policy kaia_customer_read on public.kaia_customers using
 ((select auth.uid())=user_id and (select kaia_private.has_verified_email()));
alter policy kaia_customer_create on public.kaia_customers with check
 ((select auth.uid())=user_id and (select kaia_private.has_verified_email()));
alter policy kaia_customer_update on public.kaia_customers using
 ((select auth.uid())=user_id and (select kaia_private.has_verified_email())) with check
 ((select auth.uid())=user_id and (select kaia_private.has_verified_email()));
alter policy kaia_referrals_read on public.kaia_referrals using
 ((select auth.uid())=inviter_id and (select kaia_private.has_verified_email()));
alter policy kaia_orders_read on public.kaia_orders using
 ((select auth.uid())=user_id and (select kaia_private.has_verified_email()));

create or replace function kaia_private.claim_referral(code text) returns text language plpgsql security definer
set search_path = '' as $$
declare caller uuid := auth.uid(); inviter uuid;
begin
 if caller is null or (auth.jwt()->>'is_anonymous')='true' then
  raise exception 'Entre na sua conta para registrar a indicação.' using errcode='42501';
 end if;
 if not kaia_private.has_verified_email() then
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
