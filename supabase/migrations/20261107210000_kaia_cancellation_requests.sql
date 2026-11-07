-- Kaia Glow customer-requested cancellation workflow and durable notification queue.
create table if not exists public.kaia_cancellation_requests(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.kaia_orders(id) on delete restrict,
 payment_id uuid not null unique references public.kaia_commercial_payments(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 order_number text not null,
 buyer_email text not null,
 buyer_name text not null,
 total_cents integer not null check(total_cents>=0),
 items jsonb not null,
 reason text not null check(char_length(reason) between 5 and 1000),
 status text not null default 'requested'
   check(status in ('requested','approved','approved_refund_pending','denied')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 decision_note text,
 refund_reference text,
 stock_returned boolean not null default false
);
create index if not exists kaia_cancel_requests_status_time on public.kaia_cancellation_requests(status,requested_at desc);
alter table public.kaia_cancellation_requests enable row level security;
revoke all on public.kaia_cancellation_requests from public,anon,authenticated;
grant select on public.kaia_cancellation_requests to authenticated;
create policy kaia_cancel_buyer_read on public.kaia_cancellation_requests
 for select to authenticated using ((select auth.uid())=user_id);
create policy kaia_cancel_admin_read on public.kaia_cancellation_requests
 for select to authenticated using ((select public.kaia_is_store_admin()));
-- New notifications reuse the same verified-domain Resend dispatcher and retry queue.
alter table public.kaia_order_mail_outbox drop constraint if exists kaia_order_mail_outbox_kind_check;
alter table public.kaia_order_mail_outbox add constraint kaia_order_mail_outbox_kind_check
 check(kind in ('buyer','merchant','cancel_requested_buyer','cancel_requested_merchant',
  'cancel_approved_buyer','cancel_approved_merchant',
  'cancel_denied_buyer','cancel_denied_merchant',
  'cancel_refund_pending_buyer','cancel_refund_pending_merchant'));
create or replace function public.kaia_customer_request_cancellation(p_order_number text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_order public.kaia_orders%rowtype;
v_payment public.kaia_commercial_payments%rowtype;v_request public.kaia_cancellation_requests%rowtype;
v_name text;v_email text;
begin
 if v_uid is null or not (select kaia_private.has_verified_email())
 then raise exception 'CONFIRME_SEU_EMAIL' using errcode='42501';end if;
 if p_order_number is null or char_length(p_order_number)>90 or
    p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000
 then raise exception 'DADOS_INVALIDOS' using errcode='22023';end if;
 select * into v_order from public.kaia_orders
  where user_id=v_uid and order_number=p_order_number for update;
 if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='22023';end if;
 if v_order.status='cancelled' then raise exception 'PEDIDO_JA_CANCELADO' using errcode='23514';end if;
 select * into v_payment from public.kaia_commercial_payments
  where user_id=v_uid and status='approved'
    and 'KG-'||replace(id::text,'-','')=v_order.order_number;
 if not found then raise exception 'PEDIDO_SEM_CONFIRMACAO' using errcode='23514';end if;
 select * into v_request from public.kaia_cancellation_requests where order_id=v_order.id;
 if found then return jsonb_build_object('id',v_request.id,'status',v_request.status,'existing',true);end if;
 select c.full_name,a.email into v_name,v_email
  from public.kaia_customers c join auth.users a on a.id=c.user_id
  where c.user_id=v_uid;
 insert into public.kaia_cancellation_requests(order_id,payment_id,user_id,order_number,
  buyer_email,buyer_name,total_cents,items,reason)
 values(v_order.id,v_payment.id,v_uid,v_order.order_number,v_email,v_name,
  v_order.total_cents,v_order.items,btrim(p_reason))
 returning * into v_request;
 insert into public.kaia_order_mail_outbox(payment_id,kind) values
  (v_payment.id,'cancel_requested_buyer'),(v_payment.id,'cancel_requested_merchant')
 on conflict(payment_id,kind) do nothing;
 return jsonb_build_object('id',v_request.id,'status','requested','existing',false);
end $$;
revoke all on function public.kaia_customer_request_cancellation(text,text) from public,anon;
grant execute on function public.kaia_customer_request_cancellation(text,text) to authenticated;

create or replace function public.kaia_admin_review_cancellation(p_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_req public.kaia_cancellation_requests%rowtype;
v_order public.kaia_orders%rowtype;v_line jsonb;v_state text;v_restock boolean:=false;v_kind text;
begin
 if v_uid is null or not (select public.kaia_is_store_admin())
 then raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 if p_action not in ('approve','deny','finish_refund') or p_id is null
 then raise exception 'ACAO_INVALIDA' using errcode='22023';end if;
 select * into v_req from public.kaia_cancellation_requests where id=p_id for update;
 if not found then raise exception 'SOLICITACAO_NAO_ENCONTRADA' using errcode='22023';end if;
 select * into v_order from public.kaia_orders where id=v_req.order_id for update;
 if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='22023';end if;
 if p_action='finish_refund' then
  if v_req.status<>'approved_refund_pending'
   or v_req.total_cents=0 or char_length(btrim(coalesce(p_note,'')))<6
  then raise exception 'COMPROVANTE_REEMBOLSO_NECESSARIO' using errcode='22023';end if;
  v_state:='approved';v_kind:='cancel_approved';
 else
  if v_req.status<>'requested' then
   raise exception 'SOLICITACAO_JA_ANALISADA' using errcode='23514';end if;
  if p_action='deny' then
   if v_req.requested_at<=v_order.created_at+interval '7 days'
   then raise exception 'DIREITO_DE_ARREPENDIMENTO_NAO_PODE_SER_RECUSADO' using errcode='23514';end if;
   if char_length(btrim(coalesce(p_note,'')))<10
   then raise exception 'JUSTIFICATIVA_OBRIGATORIA' using errcode='22023';end if;
   v_state:='denied';v_kind:='cancel_denied';
  elsif v_req.total_cents=0 then
   v_state:='approved';v_kind:='cancel_approved';
  else
   v_state:='approved_refund_pending';v_kind:='cancel_refund_pending';
  end if;
 end if;
 if v_state='approved' then
  -- Restock only before dispatch. Returned goods must be physically received before restocking.
  if v_order.status in ('received','confirmed','preparing') then
   for v_line in select value from jsonb_array_elements(v_order.items) loop
    update public.kaia_sale_inventory set available_units=available_units+
       (v_line->>'quantity')::int,updated_at=now() where sku=v_line->>'sku';
    if not found then raise exception 'SKU_NAO_ENCONTRADO' using errcode='23514';end if;
   end loop;
   v_restock:=true;
  end if;
  update public.kaia_orders set status='cancelled' where id=v_order.id;
 end if;
 update public.kaia_cancellation_requests
 set status=v_state,reviewed_by=v_uid,reviewed_at=now(),
  decision_note=case when p_action='finish_refund'
    then coalesce(decision_note,'')||' Reembolso confirmado pela loja.'
    else nullif(left(btrim(coalesce(p_note,'')),1000),'') end,
  refund_reference=case when p_action='finish_refund'
    then left(btrim(p_note),120) else refund_reference end,
  stock_returned=case when v_state='approved' then v_restock else stock_returned end
 where id=p_id;
 insert into public.kaia_order_mail_outbox(payment_id,kind) values
  (v_req.payment_id,v_kind||'_buyer'),(v_req.payment_id,v_kind||'_merchant')
 on conflict(payment_id,kind) do nothing;
 return jsonb_build_object('id',p_id,'status',v_state,'stockReturned',v_restock);
end $$;
revoke all on function public.kaia_admin_review_cancellation(uuid,text,text) from public,anon;
grant execute on function public.kaia_admin_review_cancellation(uuid,text,text) to authenticated;

create or replace function public.kaia_mail_cancellation_details(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object(
  'id',r.id,'order_number',r.order_number,'buyer_email',r.buyer_email,'buyer_name',r.buyer_name,
  'total_cents',r.total_cents,'items',r.items,
  'reason',r.reason,'status',r.status,'requested_at',r.requested_at,
  'reviewed_at',r.reviewed_at,'decision_note',r.decision_note,
  'refund_reference',r.refund_reference,
  'paid',r.total_cents>0)
 into v from public.kaia_cancellation_requests r where r.payment_id=p_payment_id;
 return v;
end $$;
revoke all on function public.kaia_mail_cancellation_details(uuid) from public,anon,authenticated;
grant execute on function public.kaia_mail_cancellation_details(uuid) to service_role;
