-- Separate IPTV credentials. These tables are never exposed through PostgREST.
create schema if not exists nplay_iptv_private;
revoke all on schema nplay_iptv_private from public,anon,authenticated;
create table if not exists nplay_iptv_private.settings(id boolean primary key default true check(id), gateway_hash text not null);
create table if not exists nplay_iptv_private.accounts(
 id uuid primary key default gen_random_uuid(), username text not null unique check(username ~ '^[a-z0-9_]{4,40}$'),
 label text not null check(length(label) between 1 and 120), password_hash text not null,
 enabled boolean not null default true, expires_at timestamptz not null,
 max_connections integer not null default 1 check(max_connections between 1 and 3),
 allow_live boolean not null default true,allow_vod boolean not null default true,
 failed_attempts integer not null default 0,locked_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists nplay_iptv_private.registry(id integer generated always as identity primary key,kind text not null,ref text not null,unique(kind,ref));
create table if not exists nplay_iptv_private.sessions(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references nplay_iptv_private.accounts(id) on delete cascade,
 stream_id integer not null,fingerprint text not null,expires_at timestamptz not null,created_at timestamptz not null default now(),unique(account_id,stream_id,fingerprint));
create index if not exists iptv_sessions_account_expiry on nplay_iptv_private.sessions(account_id,expires_at);
alter table nplay_iptv_private.settings enable row level security;
alter table nplay_iptv_private.accounts enable row level security;
alter table nplay_iptv_private.registry enable row level security;
alter table nplay_iptv_private.sessions enable row level security;
revoke all on all tables in schema nplay_iptv_private from public,anon,authenticated;
create or replace function nplay_iptv_private.sync_catalog() returns void language sql set search_path='' as $$
 insert into nplay_iptv_private.registry(kind,ref)
 select candidates.kind,candidates.ref from (
 select 'live'::text kind,id::text ref from public.novaplay_live_embeds where is_published and rights_confirmed and stream_type in ('hls','mpegts')
 union select case when kind='episode' then 'episode' else 'vod' end,id::text from public.novaplay_library where is_published and not coalesce(catalog_only,false) and (rights_reviewed or licensed_rights_confirmed) and coalesce(youtube_id,google_drive_id,'')='' and (r2_object_key is not null or licensed_stream_url is not null)
 union select 'series',series_title from public.novaplay_library where kind='episode' and series_title is not null and is_published and (rights_reviewed or licensed_rights_confirmed) and not coalesce(catalog_only,false) and (r2_object_key is not null or licensed_stream_url is not null)
 ) candidates where not exists(select 1 from nplay_iptv_private.registry r where r.kind=candidates.kind and r.ref=candidates.ref)
 on conflict(kind,ref) do nothing;
$$;
create or replace view nplay_iptv_private.available as
 select r.id,r.kind,r.ref,l.title,coalesce(l.category,'TV ao vivo') category,l.logo_url logo,l.embed_url source_url,null::text r2_key,null::text series_title,null::integer season_number,null::integer episode_number,null::text description,null::integer production_year,null::integer duration_seconds
 from nplay_iptv_private.registry r join public.novaplay_live_embeds l on r.ref=l.id::text and r.kind='live'
 where l.is_published and l.rights_confirmed and l.stream_type in ('hls','mpegts') and l.embed_url ~ '^https://nplay-live-gateway[.]luandersonjesussantos063[.]workers[.]dev/live/[0-9a-f-]{36}/(index[.]m3u8|stream[.]ts)$'
 union all
 select r.id,r.kind,r.ref,l.title,coalesce(l.genre,'Filmes'),l.poster_path,l.licensed_stream_url,l.r2_object_key,l.series_title,l.season_number,l.episode_number,l.description,l.production_year,l.duration_seconds
 from nplay_iptv_private.registry r join public.novaplay_library l on r.ref=l.id::text and r.kind in ('vod','episode')
 where l.is_published and not coalesce(l.catalog_only,false) and (l.rights_reviewed or l.licensed_rights_confirmed) and coalesce(l.youtube_id,l.google_drive_id,'')='' and (l.r2_object_key is not null or l.licensed_stream_url ~ '^https://');
revoke all on nplay_iptv_private.available from public,anon,authenticated;

create or replace function public.nplay_iptv_admin(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a nplay_iptv_private.accounts; result jsonb; target uuid; password text;
begin
 if auth.uid() is null or not exists(select 1 from public.novaplay_admins where user_id=auth.uid()) then raise exception 'ADMIN_REQUIRED';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'username',x.username,'label',x.label,'enabled',x.enabled,'expires_at',x.expires_at,'max_connections',x.max_connections,'allow_live',x.allow_live,'allow_vod',x.allow_vod,'created_at',x.created_at,'active_connections',(select count(*) from nplay_iptv_private.sessions s where s.account_id=x.id and s.expires_at>now())) order by x.created_at desc),'[]'::jsonb) into result from nplay_iptv_private.accounts x;return result;
 elsif p_action='create' then
  password:=p_input->>'password';
  if length(password)<12 or length(password)>64 or octet_length(password)>72 then raise exception 'PASSWORD_MIN_12';end if;
  insert into nplay_iptv_private.accounts(username,label,password_hash,expires_at,max_connections,allow_live,allow_vod)
  values(lower(trim(p_input->>'username')),trim(p_input->>'label'),extensions.crypt(password,extensions.gen_salt('bf',10)),(p_input->>'expires_at')::timestamptz,coalesce((p_input->>'max_connections')::int,1),coalesce((p_input->>'allow_live')::boolean,true),coalesce((p_input->>'allow_vod')::boolean,true)) returning * into a;
  return jsonb_build_object('id',a.id,'username',a.username);
 elsif p_action='update' then
  target:=(p_input->>'id')::uuid;password:=p_input->>'password';
  if password is not null and (length(password)<12 or length(password)>64 or octet_length(password)>72) then raise exception 'PASSWORD_MIN_12';end if;
  update nplay_iptv_private.accounts set enabled=coalesce((p_input->>'enabled')::boolean,enabled),expires_at=coalesce((p_input->>'expires_at')::timestamptz,expires_at),max_connections=coalesce((p_input->>'max_connections')::int,max_connections),allow_live=coalesce((p_input->>'allow_live')::boolean,allow_live),allow_vod=coalesce((p_input->>'allow_vod')::boolean,allow_vod),password_hash=case when password is not null then extensions.crypt(password,extensions.gen_salt('bf',10)) else password_hash end,failed_attempts=0,locked_until=null,updated_at=now() where id=target returning * into a;
  if not found then raise exception 'ACCOUNT_NOT_FOUND';end if;
  -- Invalidate current playback immediately after a block, password reset or scope change.
  delete from nplay_iptv_private.sessions where account_id=target;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end;$$;
revoke all on function public.nplay_iptv_admin(text,jsonb) from public,anon,authenticated;
grant execute on function public.nplay_iptv_admin(text,jsonb) to authenticated;

create or replace function public.nplay_iptv_backend(p_key text,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a nplay_iptv_private.accounts;s nplay_iptv_private.sessions;v nplay_iptv_private.available;result jsonb;limit_count integer;replaced jsonb;
begin
 if not exists(select 1 from nplay_iptv_private.settings where gateway_hash=encode(extensions.digest(p_key,'sha256'),'hex')) then raise exception 'GATEWAY_REQUIRED';end if;
 if p_action='authenticate' then
  select * into a from nplay_iptv_private.accounts where username=lower(p_input->>'username') for update;
  if not found then return jsonb_build_object('ok',false,'code','AUTH');end if;
  if a.locked_until>now() then return jsonb_build_object('ok',false,'code','AUTH');end if;
  if octet_length(coalesce(p_input->>'password',''))>72 or extensions.crypt(coalesce(p_input->>'password',''),a.password_hash)<>a.password_hash then
   update nplay_iptv_private.accounts set failed_attempts=case when a.locked_until<now() then 1 else failed_attempts+1 end,locked_until=case when a.failed_attempts>=9 then now()+interval '5 minutes' else locked_until end where id=a.id;
   return jsonb_build_object('ok',false,'code','AUTH');
  end if;
  update nplay_iptv_private.accounts set failed_attempts=0,locked_until=null where id=a.id;
 elsif p_action='bridge' then
  return jsonb_build_object('cipher',(select pc_bridge_config from public.novaplay_featured where id=1));
 else
  select * into a from nplay_iptv_private.accounts where id=(p_input->>'account_id')::uuid for update;
  if not found then return jsonb_build_object('ok',false,'code','AUTH');end if;
 end if;
 if not a.enabled or a.expires_at<=now() then return jsonb_build_object('ok',false,'code',case when a.enabled then 'EXPIRED' else 'BLOCKED' end);end if;
 if p_action in ('authenticate','account') then
  return jsonb_build_object('ok',true,'id',a.id,'username',a.username,'expires_at',a.expires_at,'max_connections',a.max_connections,'allow_live',a.allow_live,'allow_vod',a.allow_vod,'active_connections',(select count(*) from nplay_iptv_private.sessions where account_id=a.id and expires_at>now()));
 elsif p_action='catalog' then
  perform nplay_iptv_private.sync_catalog();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into result from nplay_iptv_private.available x where (x.kind='live' and a.allow_live) or (x.kind in ('vod','episode') and a.allow_vod);
  return jsonb_build_object('ok',true,'items',result,'series',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.ref)),'[]'::jsonb) from nplay_iptv_private.registry r where r.kind='series' and a.allow_vod and exists(select 1 from nplay_iptv_private.available x where x.kind='episode' and x.series_title=r.ref)));
 elsif p_action='start' then
  select * into v from nplay_iptv_private.available where id=(p_input->>'stream_id')::int and ((kind='live' and a.allow_live) or (kind in ('vod','episode') and a.allow_vod));
  if not found then return jsonb_build_object('ok',false,'code','CONTENT');end if;
  if coalesce(p_input->>'fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SESSION';end if;
  delete from nplay_iptv_private.sessions where account_id=a.id and expires_at<=now();
  with gone as (delete from nplay_iptv_private.sessions where account_id=a.id and fingerprint=p_input->>'fingerprint' and stream_id<>v.id returning *)
  select coalesce(jsonb_agg(jsonb_build_object('session_id',g.id,'kind',r.kind,'ref',r.ref)),'[]'::jsonb) into replaced from gone g join nplay_iptv_private.registry r on r.id=g.stream_id;
  select * into s from nplay_iptv_private.sessions where account_id=a.id and stream_id=v.id and fingerprint=p_input->>'fingerprint';
  if not found then
   select count(*) into limit_count from nplay_iptv_private.sessions where account_id=a.id;
   if limit_count>=a.max_connections then return jsonb_build_object('ok',false,'code','CONNECTION_LIMIT');end if;
   insert into nplay_iptv_private.sessions(account_id,stream_id,fingerprint,expires_at) values(a.id,v.id,p_input->>'fingerprint',now()+interval '90 seconds') returning * into s;
  else update nplay_iptv_private.sessions set expires_at=now()+interval '90 seconds' where id=s.id returning * into s;end if;
  return jsonb_build_object('ok',true,'session_id',s.id,'item',to_jsonb(v),'replaced',replaced);
 elsif p_action='touch' then
  update nplay_iptv_private.sessions set expires_at=now()+interval '90 seconds' where id=(p_input->>'session_id')::uuid and account_id=a.id and expires_at>now() returning * into s;
  if not found then return jsonb_build_object('ok',false,'code','SESSION');end if;
  if not exists(select 1 from nplay_iptv_private.available where id=s.stream_id and ((kind='live' and a.allow_live) or (kind in ('vod','episode') and a.allow_vod))) then return jsonb_build_object('ok',false,'code','CONTENT');end if;
  return jsonb_build_object('ok',true);
 elsif p_action='release' then
  delete from nplay_iptv_private.sessions where id=(p_input->>'session_id')::uuid and account_id=a.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end;$$;
revoke all on function public.nplay_iptv_backend(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nplay_iptv_backend(text,text,jsonb) to anon;
revoke all on all functions in schema nplay_iptv_private from public,anon,authenticated;
