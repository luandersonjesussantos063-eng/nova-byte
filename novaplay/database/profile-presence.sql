-- Presence is distinct from movie playback: visible app time, server clock.
-- Keep the 45s server expiry aligned with the 15s browser heartbeat and the 45s ADM status.
create table public.novaplay_profile_presence (
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null, profile_name text not null check(length(profile_name) between 1 and 20),
 tab_id uuid not null, is_visible boolean not null default false,
 last_seen timestamptz not null default now(), session_started timestamptz not null default now(),
 session_seconds double precision not null default 0 check(session_seconds>=0),
 primary key(user_id,profile_id)
);
create table public.novaplay_profile_daily (
 user_id uuid not null references auth.users(id) on delete cascade, profile_id uuid not null,
 day date not null, seconds double precision not null default 0 check(seconds>=0),
 primary key(user_id,profile_id,day)
);
alter table public.novaplay_profile_presence enable row level security;
alter table public.novaplay_profile_daily enable row level security;
revoke all on public.novaplay_profile_presence,public.novaplay_profile_daily from anon,authenticated;
grant select on public.novaplay_profile_presence,public.novaplay_profile_daily to authenticated;
create policy presence_admin_read on public.novaplay_profile_presence for select to authenticated using ((select novaplay_internal.is_admin()));
create policy presence_daily_admin_read on public.novaplay_profile_daily for select to authenticated using ((select novaplay_internal.is_admin()));
create index presence_recent on public.novaplay_profile_presence(last_seen desc);

create function novaplay_internal.profile_heartbeat(p_profile uuid,p_name text,p_tab uuid,p_visible boolean)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t timestamptz:=clock_timestamp(); r public.novaplay_profile_presence%rowtype;
 elapsed double precision:=0; boundary timestamptz; day_start date; part double precision;
begin
 if u is null or not (novaplay_internal.is_admin() or exists(select 1 from public.novaplay_access_requests where user_id=u and status='approved')) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_profile is null or p_tab is null or p_visible is null or p_name is null or length(trim(p_name)) not between 1 and 20 then raise exception 'Perfil inválido'; end if;
 -- Serialize all tabs for this device/profile. Never count overlapping tabs twice.
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_profile::text,0));
 select * into r from public.novaplay_profile_presence where user_id=u and profile_id=p_profile for update;
 if not found then
  if not p_visible then return;end if;
  if (select count(*) from public.novaplay_profile_presence where user_id=u)>=50 then raise exception 'Limite de perfis atingido';end if;
  insert into public.novaplay_profile_presence(user_id,profile_id,profile_name,tab_id,is_visible,last_seen,session_started) values(u,p_profile,trim(p_name),p_tab,true,t,t);return;
 end if;
 -- A hidden older tab cannot stop the currently visible tab's session.
 if not p_visible and r.tab_id<>p_tab then return;end if;
 if r.is_visible and t-r.last_seen<=interval '45 seconds' then
  elapsed:=greatest(0,extract(epoch from t-r.last_seen));
 end if;
 if elapsed>0 then
  day_start:=(r.last_seen at time zone 'America/Campo_Grande')::date;
  boundary:=((day_start+1)::timestamp at time zone 'America/Campo_Grande');
  part:=least(elapsed,greatest(0,extract(epoch from boundary-r.last_seen)));
  insert into public.novaplay_profile_daily values(u,p_profile,day_start,part)
   on conflict(user_id,profile_id,day) do update set seconds=novaplay_profile_daily.seconds+excluded.seconds;
  if elapsed>part then
   insert into public.novaplay_profile_daily values(u,p_profile,day_start+1,elapsed-part)
    on conflict(user_id,profile_id,day) do update set seconds=novaplay_profile_daily.seconds+excluded.seconds;
  end if;
 end if;
 update public.novaplay_profile_presence set profile_name=trim(p_name),tab_id=p_tab,is_visible=p_visible,last_seen=t,
  session_started=case when p_visible and (not r.is_visible or t-r.last_seen>interval '45 seconds') then t else r.session_started end,
  session_seconds=case when p_visible and (not r.is_visible or t-r.last_seen>interval '45 seconds') then 0 else r.session_seconds+elapsed end
 where user_id=u and profile_id=p_profile;
end $$;
revoke all on function novaplay_internal.profile_heartbeat(uuid,text,uuid,boolean) from public,anon;
grant usage on schema novaplay_internal to authenticated;
grant execute on function novaplay_internal.profile_heartbeat(uuid,text,uuid,boolean) to authenticated;
create function public.novaplay_profile_heartbeat(p_profile uuid,p_name text,p_tab uuid,p_visible boolean)
returns void language sql security invoker set search_path='' as $$select novaplay_internal.profile_heartbeat(p_profile,p_name,p_tab,p_visible)$$;
revoke all on function public.novaplay_profile_heartbeat(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.novaplay_profile_heartbeat(uuid,text,uuid,boolean) to authenticated;
create function public.novaplay_profiles_online()
returns table(user_id uuid,profile_id uuid,profile_name text,is_visible boolean,last_seen timestamptz,session_seconds double precision,today_seconds double precision,server_now timestamptz)
language sql stable security invoker set search_path='' as $$
 select p.user_id,p.profile_id,p.profile_name,p.is_visible,p.last_seen,p.session_seconds,coalesce(d.seconds,0),now()
 from public.novaplay_profile_presence p left join public.novaplay_profile_daily d
 on d.user_id=p.user_id and d.profile_id=p.profile_id and d.day=(now() at time zone 'America/Campo_Grande')::date
 where (select novaplay_internal.is_admin()) order by p.last_seen desc limit 500
$$;
revoke all on function public.novaplay_profiles_online() from public,anon;
grant execute on function public.novaplay_profiles_online() to authenticated;
