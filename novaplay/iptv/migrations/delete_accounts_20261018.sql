-- Add administrator-only account deletion. Account sessions cascade with the existing FK.
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
 elsif p_action='delete' then
  target:=(p_input->>'id')::uuid;
  delete from nplay_iptv_private.accounts where id=target returning * into a;
  if not found then raise exception 'ACCOUNT_NOT_FOUND';end if;
  return jsonb_build_object('ok',true,'id',a.id);
 end if;
 raise exception 'INVALID_ACTION';
end;$$;
revoke all on function public.nplay_iptv_admin(text,jsonb) from public,anon,authenticated;
grant execute on function public.nplay_iptv_admin(text,jsonb) to authenticated;
