-- TEST FIXTURES ONLY: invented TEST-KAIA SKUs, deliberately unrelated to
-- real Kaia Glow products, prices or packaging measurements.
-- Run ONLY on a separate Supabase project after 001_isolated_test_database.sql.
begin;
insert into kaia_mp_test.test_catalog
 (sku,title,price_cents,weight_grams,length_cm,width_cm,height_cm,
  price_verified,package_verified,total_units,reserved_units)
values
 ('TEST-KAIA-SINGLE','Produto fictício de teste - unidade',1200,200,16,11,6,true,true,5,0),
 ('TEST-KAIA-BUNDLE','Produto fictício de teste - kit',2499,330,20,15,8,true,true,9,0),
 ('TEST-KAIA-BLOCKED','Produto fictício SEM aprovação',9999,220,19,12,5,false,false,10,0)
on conflict (sku) do nothing;
commit;
