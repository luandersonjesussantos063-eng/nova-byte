-- NPlay Oct 18 2026: preserve password check, gateway secret, authorization,
-- and connection-slot serialization for START only. READ-ONLY queries must not
-- lock or rewrite the account row on every Xtream category request.
-- PostgreSQL object grants remain unchanged by CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.nplay_iptv_backend(p_key text, p_action text, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a nplay_iptv_private.accounts;s nplay_iptv_private.sessions;v nplay_iptv_private.available;result jsonb;limit_count integer;replaced jsonb;
begin
 if not exists(select 1 from nplay_iptv_private.settings where gateway_hash=encode(extensions.digest(p_key,'sha256'),'hex')) then raise exception 'GATEWAY_REQUIRED';end if;
 if p_action='authenticate' then
  select * into a from nplay_iptv_private.accounts where username=lower(p_input->>'username');
  if not found then return jsonb_build_object('ok',false,'code','AUTH');end if;
  if a.locked_until>now() then return jsonb_build_object('ok',false,'code','AUTH');end if;
  if octet_length(coalesce(p_input->>'password',''))>72 or extensions.crypt(coalesce(p_input->>'password',''),a.password_hash)<>a.password_hash then
   update nplay_iptv_private.accounts set failed_attempts=case when a.locked_until<now() then 1 else failed_attempts+1 end,locked_until=case when a.failed_attempts>=9 then now()+interval '5 minutes' else locked_until end where id=a.id;
   return jsonb_build_object('ok',false,'code','AUTH');
  end if;
  update nplay_iptv_private.accounts set failed_attempts=0,locked_until=null where id=a.id and (a.failed_attempts>0 or a.locked_until is not null);
 elsif p_action='bridge' then
  return jsonb_build_object('cipher',(select pc_bridge_config from public.novaplay_featured where id=1));
 else
  if p_action='start' then
   select * into a from nplay_iptv_private.accounts where id=(p_input->>'account_id')::uuid for update;
  else
   select * into a from nplay_iptv_private.accounts where id=(p_input->>'account_id')::uuid;
  end if;
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
end;$function$

