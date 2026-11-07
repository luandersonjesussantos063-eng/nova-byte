-- Coupon campaign history must not prevent existing admin coupon deletion.
alter table public.kaia_target_coupon_deliveries
 drop constraint if exists kaia_target_coupon_deliveries_coupon_code_fkey;
create or replace function public.kaia_cancel_mail_on_coupon_delete()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.kaia_target_coupon_deliveries set status='cancelled'
 where coupon_code=old.code and status in ('queued','sending');
 return old;
end $$;
drop trigger if exists kaia_cancel_target_mail_before_coupon_delete on public.kaia_admin_coupons;
create trigger kaia_cancel_target_mail_before_coupon_delete
before delete on public.kaia_admin_coupons
for each row execute function public.kaia_cancel_mail_on_coupon_delete();
revoke all on function public.kaia_cancel_mail_on_coupon_delete() from public,anon,authenticated;
