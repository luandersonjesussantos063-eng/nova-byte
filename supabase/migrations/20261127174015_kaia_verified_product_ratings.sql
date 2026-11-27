create table if not exists public.kaia_verified_product_ratings (
 user_id uuid not null references auth.users(id) on delete cascade,
 sku text not null check (sku ~ '^KG-[A-Z0-9-]{4,90}$'),
 rating smallint not null check (rating between 1 and 5),
 created_at timestamptz not null default now(),
 primary key(user_id,sku)
);
alter table public.kaia_verified_product_ratings enable row level security;
revoke all on public.kaia_verified_product_ratings from public,anon,authenticated;
grant select,insert,update on public.kaia_verified_product_ratings to service_role;
create index if not exists kaia_verified_rating_sku_idx on public.kaia_verified_product_ratings(sku);
create or replace function public.kaia_verified_rating_summary(p_sku text)
returns table(review_count bigint,average_rating numeric)
language sql stable security invoker set search_path='' as $$
 select count(*),round(avg(r.rating),1)
 from public.kaia_verified_product_ratings r
 where r.sku=p_sku and exists (
 select 1 from public.kaia_commercial_payments p join public.kaia_orders o
 on o.user_id=p.user_id and o.order_number='KG-'||replace(p.id::text,'-','')
 where p.user_id=r.user_id and p.status='approved' and o.status='delivered'
 and p.items @> jsonb_build_array(jsonb_build_object('sku',r.sku))
 )
$$;
revoke all on function public.kaia_verified_rating_summary(text) from public,anon,authenticated;
grant execute on function public.kaia_verified_rating_summary(text) to service_role;
create or replace function public.kaia_submit_verified_rating(p_user_id uuid,p_sku text,p_rating smallint)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_rating not between 1 and 5 or p_sku !~ '^KG-[A-Z0-9-]{4,90}$' or not exists (
 select 1 from public.kaia_commercial_payments p join public.kaia_orders o
 on o.user_id=p.user_id and o.order_number='KG-'||replace(p.id::text,'-','')
 where p.user_id=p_user_id and p.status='approved' and o.status='delivered'
 and p.items @> jsonb_build_array(jsonb_build_object('sku',p_sku))
 ) then return false; end if;
 insert into public.kaia_verified_product_ratings(user_id,sku,rating)
 values(p_user_id,p_sku,p_rating) on conflict(user_id,sku) do update set rating=excluded.rating;
 return true;
end $$;
revoke all on function public.kaia_submit_verified_rating(uuid,text,smallint) from public,anon,authenticated;
grant execute on function public.kaia_submit_verified_rating(uuid,text,smallint) to service_role;
