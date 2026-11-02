create function kaia_private.valid_cpf(value text) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare total integer; digit integer; j integer; step integer;
begin
 if value is null or value !~ '^[0-9]{11}$' or value ~ '^([0-9])\1{10}$' then return false;end if;
 for step in 10..11 loop
  total:=0;for j in 1..step-1 loop total:=total+substr(value,j,1)::integer*(step+1-j);end loop;
  digit:=(total*10)%11;if digit=10 then digit:=0;end if;
  if digit<>substr(value,step,1)::integer then return false;end if;
 end loop;return true;
end $$;
revoke all on function kaia_private.valid_cpf(text) from public,anon;
grant execute on function kaia_private.valid_cpf(text) to authenticated,service_role;
create table public.kaia_customer_details (
 user_id uuid primary key references public.kaia_customers(user_id) on delete cascade,
 cpf text not null check(kaia_private.valid_cpf(cpf)),
 birth_date date not null check(birth_date >= date '1900-01-01' and birth_date <= current_date),
 phone text not null check(phone ~ '^[1-9][0-9]{9,10}$'),
 postal_code text not null check(postal_code ~ '^[0-9]{8}$'),
 street text not null check(char_length(btrim(street)) between 2 and 200),
 street_number text not null check(char_length(btrim(street_number)) between 1 and 20),
 complement text not null default '' check(char_length(complement)<=100),
 neighborhood text not null check(char_length(btrim(neighborhood)) between 2 and 100),
 city text not null check(char_length(btrim(city)) between 2 and 100),
 state text not null check(state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 updated_at timestamptz not null default now()
);
alter table public.kaia_customer_details enable row level security;
revoke all on public.kaia_customer_details from anon,authenticated;
grant select on public.kaia_customer_details to authenticated;
grant insert(user_id,cpf,birth_date,phone,postal_code,street,street_number,complement,neighborhood,city,state),update(cpf,birth_date,phone,postal_code,street,street_number,complement,neighborhood,city,state,updated_at) on public.kaia_customer_details to authenticated;
grant all on public.kaia_customer_details to service_role;
create policy kaia_details_read on public.kaia_customer_details for select to authenticated using((select auth.uid())=user_id and (select kaia_private.has_verified_email()) and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_details_create on public.kaia_customer_details for insert to authenticated with check((select auth.uid())=user_id and (select kaia_private.has_verified_email()) and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy kaia_details_update on public.kaia_customer_details for update to authenticated using((select auth.uid())=user_id and (select kaia_private.has_verified_email()) and (select auth.jwt()->>'is_anonymous') is distinct from 'true') with check((select auth.uid())=user_id and (select kaia_private.has_verified_email()) and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create function public.kaia_save_customer_details(details jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not kaia_private.has_verified_email() then raise exception 'Confirme seu e-mail.' using errcode='42501';end if;
 if btrim(details->>'full_name') !~ '\S+\s+\S+' or char_length(details->>'full_name')>100 or details->>'full_name' is null then raise exception 'Informe seu nome completo.' using errcode='22023';end if;
 update public.kaia_customers set full_name=btrim(details->>'full_name') where user_id=auth.uid();
 insert into public.kaia_customer_details(user_id,cpf,birth_date,phone,postal_code,street,street_number,complement,neighborhood,city,state)
 values(auth.uid(),details->>'cpf',(details->>'birth_date')::date,details->>'phone',details->>'postal_code',btrim(details->>'street'),btrim(details->>'street_number'),coalesce(btrim(details->>'complement'),''),btrim(details->>'neighborhood'),btrim(details->>'city'),details->>'state')
 on conflict(user_id) do update set cpf=excluded.cpf,birth_date=excluded.birth_date,phone=excluded.phone,postal_code=excluded.postal_code,street=excluded.street,street_number=excluded.street_number,complement=excluded.complement,neighborhood=excluded.neighborhood,city=excluded.city,state=excluded.state,updated_at=now();
end $$;
revoke all on function public.kaia_save_customer_details(jsonb) from public,anon;
grant execute on function public.kaia_save_customer_details(jsonb) to authenticated;
