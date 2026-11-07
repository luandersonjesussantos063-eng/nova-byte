-- Explicit, independent permissions for promotional e-mail and identifiable browsing.
-- Existing anonymous metrics remain anonymous and are never retroactively linked.
create table if not exists public.kaia_customer_marketing_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 offers_email boolean not null default false,
 named_analytics boolean not null default false,
 consent_updated_at timestamptz not null default now()
);
alter table public.kaia_customer_marketing_preferences enable row level security;
revoke all on public.kaia_customer_marketing_preferences from public,anon,authenticated;
grant select on public.kaia_customer_marketing_preferences to authenticated;
create policy kaia_marketing_pref_owner_read on public.kaia_customer_marketing_preferences
 for select to authenticated using ((select auth.uid())=user_id);

create table if not exists kaia_private.kaia_customer_interest_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('page_view','product_view','cart_add')),
 product_key text,
 visible_seconds integer not null default 0 check(visible_seconds between 0 and 1800),
 occurred_at timestamptz not null default now()
);
create index if not exists kaia_named_interest_user_time on kaia_private.kaia_customer_interest_events(user_id,occurred_at desc);
revoke all on kaia_private.kaia_customer_interest_events from public,anon,authenticated;

create or replace function public.kaia_set_customer_marketing(p_offers boolean,p_named boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null or not (select kaia_private.has_verified_email()) then
  raise exception 'EMAIL_NAO_CONFIRMADO' using errcode='42501';end if;
 if p_offers is null or p_named is null then raise exception 'PREFERENCIA_INVALIDA' using errcode='22023';end if;
 insert into public.kaia_customer_marketing_preferences(user_id,offers_email,named_analytics)
 values(v_user,p_offers,p_named)
 on conflict(user_id) do update set offers_email=excluded.offers_email,
  named_analytics=excluded.named_analytics,consent_updated_at=now();
 if not p_named then
  delete from kaia_private.kaia_customer_interest_events where user_id=v_user;
 end if;
 return jsonb_build_object('offersEmail',p_offers,'namedAnalytics',p_named);
end $$;
-- NOTE: target coupon deliveries table is created before this function is applied.
revoke all on function public.kaia_set_customer_marketing(boolean,boolean) from public,anon;
grant execute on function public.kaia_set_customer_marketing(boolean,boolean) to authenticated;

create or replace function public.kaia_record_customer_interest(
 p_kind text,p_product_key text default null,p_visible_seconds integer default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null or not (select kaia_private.has_verified_email())
  or not exists(select 1 from public.kaia_customer_marketing_preferences
   where user_id=v_user and named_analytics=true)
 then return false;end if;
 if p_kind not in ('page_view','product_view','cart_add') or
   p_visible_seconds is null or p_visible_seconds not between 0 and 1800 or
   (p_kind='page_view' and p_product_key is not null) or
   (p_kind<>'page_view' and (p_product_key is null or
     p_product_key !~ '^(KG-[A-Z0-9-]{4,90}|legacy:[0-9]{1,15})$'))
 then raise exception 'EVENTO_INVALIDO' using errcode='22023';end if;
 if (select count(*) from kaia_private.kaia_customer_interest_events
     where user_id=v_user and occurred_at>now()-interval '24 hours')>=200
 then return false;end if;
 insert into kaia_private.kaia_customer_interest_events
  (user_id,kind,product_key,visible_seconds)
 values(v_user,p_kind,p_product_key,p_visible_seconds);
 if random()<0.02 then
  delete from kaia_private.kaia_customer_interest_events
  where occurred_at<now()-interval '90 days';
 end if;
 return true;
end $$;
revoke all on function public.kaia_record_customer_interest(text,text,integer) from public,anon;
grant execute on function public.kaia_record_customer_interest(text,text,integer) to authenticated;

create or replace function public.kaia_admin_customer_insights(p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_search text:=left(btrim(coalesce(p_search,'')),80);v_result jsonb;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 with customers as (
  select c.user_id,c.full_name,u.email,c.created_at,
   coalesce(p.offers_email,false) as offers_email,
   coalesce(p.named_analytics,false) as named_analytics
  from public.kaia_customers c
  join auth.users u on u.id=c.user_id
  left join public.kaia_customer_marketing_preferences p on p.user_id=c.user_id
  where v_search='' or c.full_name ilike '%'||v_search||'%'
    or u.email ilike '%'||v_search||'%'
  order by c.created_at desc limit 100
 ), rows as (
  select c.*,
   (select count(*) from public.kaia_orders o where o.user_id=c.user_id) as order_count,
   (select coalesce(sum(o.total_cents),0) from public.kaia_orders o
    where o.user_id=c.user_id and o.status<>'cancelled') as paid_total_cents,
   case when c.named_analytics then
    (select count(*) from kaia_private.kaia_customer_interest_events e
     where e.user_id=c.user_id and e.kind='page_view' and e.occurred_at>now()-interval '90 days')
    else 0 end as page_views,
   case when c.named_analytics then
    (select count(*) from kaia_private.kaia_customer_interest_events e
     where e.user_id=c.user_id and e.kind='product_view' and e.occurred_at>now()-interval '90 days')
    else 0 end as product_views,
   case when c.named_analytics then
    (select coalesce(sum(e.visible_seconds),0) from kaia_private.kaia_customer_interest_events e
     where e.user_id=c.user_id and e.kind='product_view' and e.occurred_at>now()-interval '90 days')
    else 0 end as attention_seconds,
   case when c.named_analytics then
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.seconds desc),'[]'::jsonb)
     from (select e.product_key,count(*) as views,sum(e.visible_seconds) as seconds
      from kaia_private.kaia_customer_interest_events e
      where e.user_id=c.user_id and e.kind='product_view'
       and e.occurred_at>now()-interval '90 days'
      group by e.product_key order by seconds desc limit 8)t)
    else '[]'::jsonb end as products
  from customers c
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'userId',user_id,'name',full_name,'email',email,'createdAt',created_at,
  'offersEmail',offers_email,'namedAnalytics',named_analytics,
  'orders',order_count,'totalCents',paid_total_cents,
  'visits',page_views,'productViews',product_views,
  'attentionSeconds',attention_seconds,'products',products
 ) order by created_at desc),'[]'::jsonb) into v_result from rows;
 return v_result;
end $$;
revoke all on function public.kaia_admin_customer_insights(text) from public,anon;
grant execute on function public.kaia_admin_customer_insights(text) to authenticated;
