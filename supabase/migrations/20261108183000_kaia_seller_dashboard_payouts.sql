-- Seller-only summary without exposing buyers, emails, addresses or card data.
create or replace function public.kaia_seller_dashboard()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_seller public.kaia_sales_representatives%rowtype;
 v_summary jsonb;v_sales jsonb;v_paid bigint;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from auth.users u where u.id=v_user and
   u.email_confirmed_at is not null and u.deleted_at is null and
   (u.banned_until is null or u.banned_until<now()))
 then raise exception 'LOGIN_CONFIRMADO_NECESSARIO' using errcode='42501';end if;
 select * into v_seller from public.kaia_sales_representatives where user_id=v_user;
 if not found then raise exception 'ACESSO_DE_VENDEDOR_NAO_LIBERADO' using errcode='42501';end if;
 select coalesce(sum(amount_cents),0)::bigint into v_paid
 from public.kaia_seller_payout_records where seller_user_id=v_user;
 select jsonb_build_object(
  'approvedSales',count(*) filter(where status='earned' and commission_cents>0),
  'pendingSales',count(*) filter(where status='pending' and commission_cents>0),
  'reversedSales',count(*) filter(where status='reversed' and commission_cents>0),
  'netSalesCents',coalesce(sum(base_cents) filter(where status='earned'),0),
  'commissionEarnedCents',coalesce(sum(commission_cents) filter(where status='earned'),0),
  'commissionPendingCents',coalesce(sum(commission_cents) filter(where status='pending'),0)
 ) into v_summary
 from public.kaia_seller_commissions where seller_user_id=v_user;
 select coalesce(jsonb_agg(jsonb_build_object(
  'reference','KG-'||upper(substr(replace(p.id::text,'-',''),1,12)),
  'date',p.created_at,'paidDate',c.approved_at,
  'saleCents',p.total_cents,'productCents',c.base_cents,
  'commissionCents',c.commission_cents,'status',c.status
 ) order by p.created_at desc),'[]'::jsonb) into v_sales
 from (select * from public.kaia_seller_commissions
  where seller_user_id=v_user order by created_at desc limit 60) c
 join public.kaia_commercial_payments p on p.id=c.payment_id;
 return jsonb_build_object(
  'active',v_seller.active,'code',v_seller.code,'commissionPercent',10,
  'link','https://usekaiaglow.com.br/?vendedor='||v_seller.code,
  'approvedSales',v_summary->'approvedSales',
  'pendingSales',v_summary->'pendingSales',
  'reversedSales',v_summary->'reversedSales',
  'netSalesCents',v_summary->'netSalesCents',
  'commissionEarnedCents',v_summary->'commissionEarnedCents',
  'commissionPendingCents',v_summary->'commissionPendingCents',
  'paidCents',v_paid,
  'dueCents',greatest(0,(v_summary->>'commissionEarnedCents')::bigint-v_paid),
  'adjustmentCents',greatest(0,v_paid-(v_summary->>'commissionEarnedCents')::bigint),
  'sales',v_sales,
  'notice','Comissão de 10% sobre o valor pago em produtos, sem frete e após descontos. Só é liberada depois de pagamento aprovado. Cancelamentos/reembolsos anulam ganhos; repasses são feitos fora do sistema.'
 );
end $$;
revoke all on function public.kaia_seller_dashboard() from public,anon;
grant execute on function public.kaia_seller_dashboard() to authenticated;

create or replace function public.kaia_admin_seller_list()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when (select public.kaia_is_store_admin()) then
 coalesce(jsonb_agg(jsonb_build_object(
  'userId',s.user_id,'email',u.email,'code',s.code,'active',s.active,
  'since',s.created_at,'link','https://usekaiaglow.com.br/?vendedor='||s.code,
  'approvedSales',coalesce(t.approved,0),'pendingSales',coalesce(t.pending,0),
  'earnedCents',coalesce(t.earned,0),'pendingCents',coalesce(t.estimated,0),
  'paidCents',coalesce(p.paid,0),
  'dueCents',greatest(0,coalesce(t.earned,0)-coalesce(p.paid,0))
 ) order by s.created_at desc),'[]'::jsonb)
 else null end
 from public.kaia_sales_representatives s
 join auth.users u on u.id=s.user_id
 left join lateral (
  select count(*) filter(where status='earned' and commission_cents>0) approved,
   count(*) filter(where status='pending' and commission_cents>0) pending,
   coalesce(sum(commission_cents) filter(where status='earned'),0) earned,
   coalesce(sum(commission_cents) filter(where status='pending'),0) estimated
  from public.kaia_seller_commissions c where c.seller_user_id=s.user_id
 ) t on true
 left join lateral(
  select coalesce(sum(amount_cents),0) paid
  from public.kaia_seller_payout_records r where r.seller_user_id=s.user_id
 ) p on true;
$$;
revoke all on function public.kaia_admin_seller_list() from public,anon;
grant execute on function public.kaia_admin_seller_list() to authenticated;

-- Manual bookkeeping ONLY: it never transfers money or calls a bank.
-- The admin must actually pay the seller outside the system before recording.
create or replace function public.kaia_admin_record_seller_payout(
 p_seller uuid,p_amount_cents integer,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_earned bigint;v_paid bigint;v_id uuid;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_seller is null or p_amount_cents is null or p_amount_cents<=0
  or p_amount_cents>100000000 or length(coalesce(p_note,''))>300
 then raise exception 'REPASSE_INVALIDO' using errcode='22023';end if;
 perform 1 from public.kaia_sales_representatives where user_id=p_seller for update;
 if not found then raise exception 'VENDEDOR_NAO_ENCONTRADO' using errcode='23514';end if;
 select coalesce(sum(commission_cents),0) into v_earned
  from public.kaia_seller_commissions
  where seller_user_id=p_seller and status='earned';
 select coalesce(sum(amount_cents),0) into v_paid
  from public.kaia_seller_payout_records where seller_user_id=p_seller;
 if p_amount_cents>v_earned-v_paid then
  raise exception 'REPASSE_SUPERIOR_AO_SALDO' using errcode='23514';end if;
 insert into public.kaia_seller_payout_records(seller_user_id,amount_cents,recorded_by,note)
 values(p_seller,p_amount_cents,v_actor,nullif(btrim(coalesce(p_note,'')),''))
 returning id into v_id;
 return jsonb_build_object('recorded',true,'id',v_id,
  'remainingCents',v_earned-v_paid-p_amount_cents);
end $$;
revoke all on function public.kaia_admin_record_seller_payout(uuid,integer,text) from public,anon;
grant execute on function public.kaia_admin_record_seller_payout(uuid,integer,text) to authenticated;
