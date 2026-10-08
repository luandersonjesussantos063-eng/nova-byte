-- Service-only storage. No visitor can list previews or call quota RPCs directly.
create table if not exists public.nb_preview_quota (
 bucket text primary key, used integer not null default 0, expires_at timestamptz not null
);
create table if not exists public.nb_previews (
 id uuid primary key default gen_random_uuid(), owner_hash text not null,
 spec jsonb not null, brief jsonb not null, mode text not null check(mode in ('ai','template')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days'
);
alter table public.nb_preview_quota enable row level security;
alter table public.nb_previews enable row level security;
revoke all on public.nb_preview_quota, public.nb_previews from public, anon, authenticated;
grant all on public.nb_preview_quota, public.nb_previews to service_role;
create or replace function public.nb_preview_reserve(p_session text,p_ip text,p_mode text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_day text := to_char(now() at time zone 'UTC','YYYY-MM-DD'); v_global text; v_session text; v_ip text;
begin
 if p_mode not in ('ai','template') or length(p_session)<>64 or length(p_ip)<>64 then return false; end if;
 v_global:='global:'||p_mode||':'||v_day; v_session:='session:'||p_session; v_ip:='ip:'||p_mode||':'||p_ip||':'||v_day;
 -- One short transactional lock prevents concurrent requests exceeding any limit.
 perform pg_advisory_xact_lock(87231048);
 delete from public.nb_preview_quota where expires_at<now();
 delete from public.nb_previews where expires_at<now();
 insert into public.nb_preview_quota(bucket,expires_at) values
 (v_global,now()+interval '2 days'),(v_ip,now()+interval '2 days'),(v_session,now()+interval '2 days') on conflict do nothing;
 if (select used from public.nb_preview_quota where bucket=v_global)>=(case when p_mode='ai' then 30 else 300 end)
 or (select used from public.nb_preview_quota where bucket=v_session)>=3
 or (select used from public.nb_preview_quota where bucket=v_ip)>=(case when p_mode='ai' then 6 else 20 end) then return false; end if;
 update public.nb_preview_quota set used=used+1 where bucket in (v_global,v_session,v_ip);
 return true;
end $$;
revoke all on function public.nb_preview_reserve(text,text,text) from public,anon,authenticated;
grant execute on function public.nb_preview_reserve(text,text,text) to service_role;
