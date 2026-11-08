-- Safe Olist ERP -> Kaia Glow stock reconciliation (decreases only).
-- Full snapshots, never per-TikTok-order double decrement. No writes until
-- the existing kaia_olist_sync_control.enabled flag is deliberately activated.
create or replace function public.kaia_olist_apply_live_stock(
 p_snapshot jsonb,
 p_source_rows integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_n int;v_local int;v_unique int;v_covered int;v_invalid int;
 v_changed int:=0;v_delta int:=0;v_row record;
begin
 -- Only the server-side service role may call; it is not callable from browsers.
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'array'
  or jsonb_array_length(p_snapshot)>1000 or p_source_rows is null
  or p_source_rows<1 or p_source_rows>1000000
 then raise exception 'INVALID_OLIST_SNAPSHOT' using errcode='22023';end if;
 if not exists(select 1 from public.kaia_olist_sync_control where slot=1 and enabled)
 then raise exception 'OLIST_AUTOMATIC_SYNC_NOT_ENABLED' using errcode='42501';end if;
 -- Serialize full snapshot reconciliations and other routines sharing these
 -- stock rows. Abort stale/incomplete/duplicate imports before any update.
 perform pg_catalog.pg_advisory_xact_lock(741018215);
 select count(*) into v_local from public.kaia_sale_inventory;
 v_n:=jsonb_array_length(p_snapshot);
 if v_local<30 or v_n<>v_local then
  raise exception 'OLIST_INCOMPLETE_SITE_SNAPSHOT' using errcode='22023';end if;
 select count(*),count(distinct x.sku),
  count(i.sku),
  count(*) filter(where x.sku is null or x.units is null
     or x.units<0 or x.units>100000)
 into v_n,v_unique,v_covered,v_invalid
 from jsonb_to_recordset(p_snapshot) as x(sku text,units integer)
 left join public.kaia_sale_inventory i on i.sku=x.sku;
 if v_n<>v_local or v_unique<>v_n or v_covered<>v_n or v_invalid>0
 then raise exception 'OLIST_INVALID_PRODUCT_MAPPING' using errcode='22023';end if;
 -- Never apply a relative -1 per order: the Olist available balance is the
 -- source. A repeated snapshot produces zero further stock movements.
 perform pg_catalog.set_config('kaia.stock_source','olist_auto',true);
 perform pg_catalog.set_config('kaia.stock_reason',
  'Olist ERP authoritative available balance (automatic downward reconciliation)',true);
 for v_row in
  select i.sku,i.available_units as local_units,
   x.units as source_units
  from public.kaia_sale_inventory i
  join jsonb_to_recordset(p_snapshot) as x(sku text,units integer)
   on x.sku=i.sku
  order by i.sku
  for update of i
 loop
  if v_row.local_units is null or v_row.local_units<0 then
   raise exception 'LOCAL_STOCK_UNVERIFIED' using errcode='23514';end if;
  if v_row.source_units<v_row.local_units then
    update public.kaia_sale_inventory
     set available_units=v_row.source_units,stock_verified_at=now(),
      updated_at=now()
     where sku=v_row.sku;
    -- Preserve deleted/hidden products: do not republish automatically.
    update public.kaia_catalog_overrides
     set available=false,updated_at=now()
     where product_key=v_row.sku and v_row.source_units=0
       and available=true;
    v_changed:=v_changed+1;
    v_delta:=v_delta+v_row.source_units-v_row.local_units;
  end if;
 end loop;
 insert into public.kaia_olist_sync_runs
 (source_rows,changed_skus,net_available_units,note)
 values(p_source_rows,v_changed,v_delta,
  'Olist automated decrease-only full stock snapshot; no stock increase or external order writes');
 update public.kaia_olist_sync_control set
  last_run_at=now(),last_success_at=now(),
  last_changed=v_changed,last_source_count=p_source_rows,
  last_error=null,updated_at=now() where slot=1;
 return jsonb_build_object('mode','decrease_only','changedSkus',v_changed,
  'netDelta',v_delta,'sourceRows',p_source_rows,'siteSkus',v_local);
end $$;
revoke all on function public.kaia_olist_apply_live_stock(jsonb,integer) from public,anon,authenticated;
grant execute on function public.kaia_olist_apply_live_stock(jsonb,integer) to service_role;

create or replace function public.kaia_olist_sync_record_error(p_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_code is null or p_code !~ '^[A-Z_]{3,75}$'
 then raise exception 'INVALID_ERROR_CODE' using errcode='22023';end if;
 update public.kaia_olist_sync_control set
  last_run_at=now(),last_error=p_code,updated_at=now()
 where slot=1 and enabled=true;
end $$;
revoke all on function public.kaia_olist_sync_record_error(text) from public,anon,authenticated;
grant execute on function public.kaia_olist_sync_record_error(text) to service_role;
