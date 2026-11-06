-- Isolated QA project only; no commercial tables or customer data.
begin;
alter table kaia_mp_test.checkout_orders
 add column provider_payload jsonb check(provider_payload is null or jsonb_typeof(provider_payload)='object'),
 add column cancel_key uuid not null default gen_random_uuid();
create function public.kaia_qa_owned(p_id uuid,p_owner text) returns jsonb
language sql security invoker set search_path='' as $$
 select to_jsonb(o) from kaia_mp_test.checkout_orders o
 where o.id=p_id and o.request_owner=p_owner
$$;
create function public.kaia_qa_freeze_payload(p_id uuid,p_owner text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o kaia_mp_test.checkout_orders;
begin
 select * into strict o from kaia_mp_test.checkout_orders
 where id=p_id and request_owner=p_owner for update;
 if o.provider_payload is null then
  if p_payload->>'external_reference' is distinct from o.id::text or
    (p_payload->>'total_amount')::numeric*100 is distinct from o.total_cents::numeric or
    p_payload->>'processing_mode' is distinct from 'manual' or p_payload->>'type' is distinct from 'online'
  then raise exception 'Invalid frozen provider payload';end if;
  update kaia_mp_test.checkout_orders set provider_payload=p_payload
   where id=p_id returning * into o;
 end if;
 return o.provider_payload;
end $$;
revoke all on function public.kaia_qa_owned(uuid,text),
 public.kaia_qa_freeze_payload(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.kaia_qa_owned(uuid,text),
 public.kaia_qa_freeze_payload(uuid,text,jsonb) to service_role;
commit;
