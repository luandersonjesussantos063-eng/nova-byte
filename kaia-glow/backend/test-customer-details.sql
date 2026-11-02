begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('c41a8da1-0be8-4daf-9960-b10100000001','authenticated','authenticated','kaia-rls-a@example.invalid',now(),'{}','{}',now(),now()),
('c41a8da1-0be8-4daf-9960-b10100000002','authenticated','authenticated','kaia-rls-b@example.invalid',now(),'{}','{}',now(),now());
insert into public.kaia_customers(user_id,full_name,referral_code) values
('c41a8da1-0be8-4daf-9960-b10100000001','Teste Kaia A','aabbccddeeff00112233'),
('c41a8da1-0be8-4daf-9960-b10100000002','Teste Kaia B','aabbccddeeff00112244');
insert into public.kaia_orders(user_id,order_number,total_cents) values
('c41a8da1-0be8-4daf-9960-b10100000001','KAIA-RLS-TEST-A',100),
('c41a8da1-0be8-4daf-9960-b10100000002','KAIA-RLS-TEST-B',200);
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $test$
declare result text;
begin
 if (select count(*) from public.kaia_customers)<>1 then raise exception 'FAIL profile isolation';end if;
 if (select count(*) from public.kaia_orders)<>1 then raise exception 'FAIL order isolation';end if;
 if (select order_number from public.kaia_orders)<>'KAIA-RLS-TEST-B' then raise exception 'FAIL wrong order';end if;
 result:=public.kaia_claim_referral('aabbccddeeff00112233');
 if result<>'registered' then raise exception 'FAIL claim: %',result;end if;
 if public.kaia_claim_referral('aabbccddeeff00112233')<>'already' then raise exception 'FAIL duplicate';end if;
 if public.kaia_claim_referral('aabbccddeeff00112244')<>'self' then raise exception 'FAIL self referral';end if;
 if (select count(*) from public.kaia_referrals)<>0 then raise exception 'FAIL referral ownership';end if;
 begin update public.kaia_orders set total_cents=0;raise exception 'FAIL customer edited order';exception when insufficient_privilege then null;end;
 begin update public.kaia_referrals set status='reward_ready';raise exception 'FAIL customer released gift';exception when insufficient_privilege then null;end;
 begin update public.kaia_customers set referral_code='ffffffffffffffffffff';raise exception 'FAIL code edited';exception when insufficient_privilege then null;end;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.kaia_referrals)<>1 then raise exception 'FAIL inviter cannot see referral';end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000001","role":"authenticated","is_anonymous":true}',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.kaia_customers)<>0 then raise exception 'FAIL anonymous profile access';end if;
 begin perform public.kaia_claim_referral('aabbccddeeff00112244');raise exception 'FAIL anonymous claim';exception when insufficient_privilege then null;end;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $test$ begin
 if kaia_private.valid_cpf('11111111111') then raise exception 'FAIL repeated CPF';end if;
 perform public.kaia_save_customer_details('{"full_name":"Cliente de Teste","cpf":"52998224725","birth_date":"1990-01-01","phone":"11999999999","postal_code":"01001000","street":"Rua de Teste","street_number":"123","complement":"","neighborhood":"Centro","city":"Cidade de Teste","state":"SP"}'::jsonb);
 if (select count(*) from public.kaia_customer_details)<>1 then raise exception 'FAIL own details';end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.kaia_customer_details)<>0 then raise exception 'FAIL CPF/address exposed across accounts';end if;
end $test$;
reset role;
update auth.users set email_confirmed_at=null where id='c41a8da1-0be8-4daf-9960-b10100000001';
select set_config('request.jwt.claims','{"sub":"c41a8da1-0be8-4daf-9960-b10100000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.kaia_customer_details)<>0 then raise exception 'FAIL unverified details access';end if;
 if kaia_private.has_verified_email() then raise exception 'FAIL unverified email accepted';end if;
 if (select count(*) from public.kaia_customers)<>0 then raise exception 'FAIL unverified profile access';end if;
 if (select count(*) from public.kaia_orders)<>0 then raise exception 'FAIL unverified order access';end if;
 if (select count(*) from public.kaia_referrals)<>0 then raise exception 'FAIL unverified referrals access';end if;
 begin perform public.kaia_claim_referral('aabbccddeeff00112244');raise exception 'FAIL unverified claim';exception when insufficient_privilege then null;end;
end $test$;
reset role;
rollback;
select 'PASS: account isolation, orders, claims, duplicates, self-referrals, privilege restrictions and anonymous denial; unverified email denied; all test data rolled back' as result;
