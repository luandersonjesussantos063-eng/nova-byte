begin;
create table if not exists public.nb_security_rate_limits (
 bucket text primary key, used integer not null check(used>=0), resets_at timestamptz not null
);
alter table public.nb_security_rate_limits enable row level security;
revoke all on public.nb_security_rate_limits from public, anon, authenticated;
grant select,insert,update,delete on public.nb_security_rate_limits to service_role;
create or replace function public.nb_security_reserve(p_identity text,p_scope text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare slot text; ip_bucket text; global_bucket text; n integer; maximum integer;
begin
 if p_identity !~ '^[a-f0-9]{64}$' or p_scope not in ('site-audit','contact') then return false;end if;
 slot:=to_char(now() at time zone 'UTC','YYYYMMDDHH24');
 ip_bucket:=p_scope||':ip:'||p_identity||':'||slot;
 global_bucket:=p_scope||':global:'||slot;
 perform pg_advisory_xact_lock(87231049);
 delete from public.nb_security_rate_limits where resets_at<now();
 maximum:=case when p_scope='site-audit' then 10 else 5 end;
 insert into public.nb_security_rate_limits values(ip_bucket,1,now()+interval '2 hours')
 on conflict(bucket) do update set used=nb_security_rate_limits.used+1 where nb_security_rate_limits.used<maximum
 returning used into n;
 if n is null then return false;end if;
 n:=null;
 insert into public.nb_security_rate_limits values(global_bucket,1,now()+interval '2 hours')
 on conflict(bucket) do update set used=nb_security_rate_limits.used+1 where nb_security_rate_limits.used<200
 returning used into n;
 return n is not null;
end $$;
revoke all on function public.nb_security_reserve(text,text) from public,anon,authenticated;
grant execute on function public.nb_security_reserve(text,text) to service_role;
commit;
