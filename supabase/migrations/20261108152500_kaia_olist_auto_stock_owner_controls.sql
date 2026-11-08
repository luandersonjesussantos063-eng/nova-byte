-- Never enable automatic stock reconciliation based solely on a web checkbox:
-- require a recent authenticated Olist full-snapshot validation, explicit
-- confirmation that TikTok order imports/balances are configured at Olist,
-- and authorization from the original store owner.
alter table public.kaia_olist_sync_control
 add column if not exists last_verified_snapshot_at timestamptz,
 add column if not exists last_verified_snapshot_rows integer;

create or replace function public.kaia_olist_record_valid_preview(
 p_site_rows integer,p_source_rows integer
) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_site_rows not between 30 and 1000
  or p_source_rows not between p_site_rows and 1000000
 then raise exception 'OLIST_VALIDATION_INVALID' using errcode='22023';end if;
 update public.kaia_olist_sync_control set
  last_verified_snapshot_at=now(),last_verified_snapshot_rows=p_site_rows,
  updated_at=now() where slot=1;
end $$;
revoke all on function public.kaia_olist_record_valid_preview(integer,integer)
 from public,anon,authenticated;
grant execute on function public.kaia_olist_record_valid_preview(integer,integer)
 to service_role;

create or replace function public.kaia_owner_set_olist_auto_stock(
 p_enabled boolean,
 p_tiktok_imports_confirmed boolean default false,
 p_olist_stock_rule_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not (select public.kaia_is_store_owner()) then
  raise exception 'ONLY_STORE_OWNER_CAN_ENABLE_STOCK_SYNC'
   using errcode='42501';end if;
 if p_enabled is null then raise exception 'INVALID_ACTION' using errcode='22023';end if;
 if p_enabled then
  if p_tiktok_imports_confirmed is distinct from true
    or p_olist_stock_rule_confirmed is distinct from true
  then raise exception 'OLIST_PRECONDITIONS_NOT_CONFIRMED'
    using errcode='23514';end if;
  if not exists(
   select 1 from public.kaia_olist_connection
   where slot=1 and token_ciphertext is not null
  ) then raise exception 'OLIST_ACCOUNT_NOT_AUTHORIZED' using errcode='23514';end if;
  if not exists(
   select 1 from public.kaia_olist_sync_control
    where slot=1 and last_verified_snapshot_at>now()-interval '30 minutes'
    and last_verified_snapshot_rows=(select count(*) from public.kaia_sale_inventory)
  ) then raise exception 'VERIFY_FULL_OLIST_SNAPSHOT_FIRST' using errcode='23514';end if;
 end if;
 update public.kaia_olist_sync_control
 set enabled=p_enabled,updated_at=now(),last_error=null
 where slot=1;
 return jsonb_build_object('enabled',p_enabled,'intervalMinutes',5,
  'mode','decrease_only','source','Olist ERP');
end $$;
revoke all on function public.kaia_owner_set_olist_auto_stock(boolean,boolean,boolean)
 from public,anon;
grant execute on function public.kaia_owner_set_olist_auto_stock(boolean,boolean,boolean)
 to authenticated;
