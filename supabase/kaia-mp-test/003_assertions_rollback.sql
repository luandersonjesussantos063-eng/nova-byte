-- Test-only SQL assertions. Intentionally rolls every step back.
-- Successful execution produces NOTICE; failure aborts.
-- Do not run on production: requires kaia_mp_test.test_catalog.
do $tests$
declare
 original_units integer;
 original_reserved integer;
 k uuid := gen_random_uuid();
 o uuid;
 x jsonb;
begin
 select total_units,reserved_units into original_units,original_reserved
 from kaia_mp_test.test_catalog where sku='TEST-KAIA-SINGLE';
 if not found then raise exception 'Missing synthetic fixture'; end if;
 begin
  x:=kaia_mp_test.reserve_test_order(
   k,'[{"sku":"TEST-KAIA-SINGLE","qty":2}]'::jsonb);
  if x->>'result'<>'reserved' then raise exception 'Reservation failed: %',x;end if;
  o:=(x->>'order_id')::uuid;
  x:=kaia_mp_test.reserve_test_order(
   k,'[{"sku":"TEST-KAIA-SINGLE","qty":2}]'::jsonb);
  if x->>'result'<>'duplicate' then raise exception 'Duplicate checkout did not dedupe';end if;
  begin
   perform kaia_mp_test.reserve_test_order(k,'[{"sku":"TEST-KAIA-SINGLE","qty":1}]'::jsonb);
   raise exception 'Changed idempotent cart was accepted';
  exception when sqlstate '22023' then null;end;
  x:=kaia_mp_test.apply_verified_order(
   'TEST-MP-PROVIDER-001',o,'approved','TEST-EVENT-APPROVED-001');
  if x->>'result'<>'approved' then raise exception 'Approval failed: %',x;end if;
  x:=kaia_mp_test.apply_verified_order(
   'TEST-MP-PROVIDER-001',o,'approved','TEST-EVENT-APPROVED-001');
  if x->>'result'<>'duplicate_event' then raise exception 'Duplicate webhook not deduped: %',x;end if;
  if not exists(select 1 from kaia_mp_test.test_catalog
     where sku='TEST-KAIA-SINGLE'
       and total_units=original_units-2
       and reserved_units=original_reserved)
  then raise exception 'Approved order decremented wrong stock';end if;
  raise exception '__ROLLBACK_ASSERTIONS_PASSED__';
 exception when raise_exception then
   if sqlerrm <> '__ROLLBACK_ASSERTIONS_PASSED__' then raise;end if;
 end;
 if exists(select 1 from kaia_mp_test.checkout_orders
     where idempotency_key=k)
 then raise exception 'Fixture test left persistent order'; end if;
 if not exists(select 1 from kaia_mp_test.test_catalog
   where sku='TEST-KAIA-SINGLE'
     and total_units=original_units
     and reserved_units=original_reserved)
 then raise exception 'Fixture test altered stock';end if;

 -- Pending until verification; cancelled/declined must release once.
 k:=gen_random_uuid();
 begin
   x:=kaia_mp_test.reserve_test_order(
    k,'[{"sku":"TEST-KAIA-SINGLE","qty":1}]'::jsonb);
   o:=(x->>'order_id')::uuid;
   x:=kaia_mp_test.apply_verified_order(
    'TEST-MP-PROVIDER-002',o,'pending','TEST-EVENT-PENDING-002');
   if x->>'result'<>'pending' then raise exception 'Pending flow broken';end if;
   begin
    perform kaia_mp_test.apply_verified_order('TEST-OTHER-PROVIDER',o,'pending','TEST-EVENT-WRONG-PROVIDER');
    raise exception 'Pending provider binding was not enforced';
   exception when sqlstate '22023' then null;end;
   x:=kaia_mp_test.apply_verified_order(
    'TEST-MP-PROVIDER-002',o,'rejected','TEST-EVENT-REJECTED-002');
   if x->>'result'<>'rejected' then raise exception 'Rejected flow broken';end if;
   begin
    perform kaia_mp_test.apply_verified_order('TEST-MP-PROVIDER-002',o,'approved','TEST-EVENT-LATE-APPROVAL');
    raise exception 'Approval after release was silently accepted';
   exception when sqlstate '22023' then null;end;
   if not exists(select 1 from kaia_mp_test.test_catalog
    where sku='TEST-KAIA-SINGLE' and reserved_units=original_reserved)
   then raise exception 'Rejected order did not release inventory';end if;
   raise exception '__ROLLBACK_ASSERTIONS_PASSED__';
 exception when raise_exception then
   if sqlerrm <> '__ROLLBACK_ASSERTIONS_PASSED__' then raise;end if;
 end;

 -- Never sell a product with unverified price and packaging.
 begin
  perform kaia_mp_test.reserve_test_order(gen_random_uuid(),
   '[{"sku":"TEST-KAIA-BLOCKED","qty":1}]'::jsonb);
  raise exception 'Unverified item was accepted';
 exception when sqlstate '22023' then null;
 end;
 raise notice 'KAIA_MP_TEST: all sequential assertions passed, zero persistent stock or orders changed';
end $tests$;
