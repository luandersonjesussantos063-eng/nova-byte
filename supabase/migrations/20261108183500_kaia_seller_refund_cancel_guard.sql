-- Sales awaiting cancellation review are held; refund approval reverses
-- commission even though payment.status is an immutable approved record.
CREATE OR REPLACE FUNCTION public.kaia_refresh_seller_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_state text;v_base integer;v_fee integer;
begin
 if new.seller_user_id is null then return new;end if;
 v_base:=greatest(0,new.products_cents);
 v_fee:=round(v_base::numeric*1000/10000)::integer;
 v_state:=case
  when exists(select 1 from public.kaia_cancellation_requests c
   where c.payment_id=new.id and c.status in ('approved','approved_refund_pending')) then 'reversed'
  when exists(select 1 from public.kaia_cancellation_requests c
   where c.payment_id=new.id and c.status='requested') then 'pending'
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
end $function$;
create or replace function public.kaia_refresh_seller_commission_on_cancellation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.payment_id is not null and (tg_op='INSERT' or new.status is distinct from old.status) then
  update public.kaia_commercial_payments
   set paid_amount_cents=paid_amount_cents,updated_at=now()
   where id=new.payment_id and seller_user_id is not null;
 end if;
 return new;
end $$;
revoke all on function public.kaia_refresh_seller_commission_on_cancellation() from public,anon,authenticated;
drop trigger if exists kaia_seller_on_cancellation_change on public.kaia_cancellation_requests;
create trigger kaia_seller_on_cancellation_change
 after insert or update of status on public.kaia_cancellation_requests
 for each row execute function public.kaia_refresh_seller_commission_on_cancellation();
