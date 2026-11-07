-- Kaia Glow: the shop owner alone can delegate administrative access.
create table if not exists kaia_private.kaia_store_owners(
 user_id uuid primary key references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
revoke all on kaia_private.kaia_store_owners from public,anon,authenticated;
insert into kaia_private.kaia_store_owners(user_id)
select id from auth.users where lower(email)='luandersonjesussantos063@gmail.com'
 and email_confirmed_at is not null on conflict do nothing;

create or replace function public.kaia_is_store_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select (select kaia_private.has_verified_email()) and exists(
  select 1 from kaia_private.kaia_store_owners o where o.user_id=(select auth.uid())
 );
$$;
revoke all on function public.kaia_is_store_owner() from public,anon;
grant execute on function public.kaia_is_store_owner() to authenticated;

create or replace function public.kaia_owner_list_admins()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not (select public.kaia_is_store_owner()) then
  raise exception 'ACESSO_RESERVADO_AO_PROPRIETARIO' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'email',a.email,'addedAt',a.added_at,
  'owner',o.user_id is not null,
  'registered',u.id is not null,
  'verified',u.email_confirmed_at is not null
 ) order by a.added_at),'[]'::jsonb) into v_result
 from kaia_private.kaia_admin_allowlist a
 left join auth.users u on lower(u.email)=a.email
 left join kaia_private.kaia_store_owners o on o.user_id=u.id;
 return v_result;
end $$;
revoke all on function public.kaia_owner_list_admins() from public,anon;
grant execute on function public.kaia_owner_list_admins() to authenticated;

create or replace function public.kaia_owner_set_admin(p_email text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(coalesce(p_email,'')));
 v_target uuid;v_verified boolean;
begin
 if not (select public.kaia_is_store_owner()) then
  raise exception 'ACESSO_RESERVADO_AO_PROPRIETARIO' using errcode='42501';
 end if;
 if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  or char_length(v_email)>240 or p_enabled is null
 then raise exception 'EMAIL_INVALIDO' using errcode='22023';end if;
 select u.id,(u.email_confirmed_at is not null) into v_target,v_verified
 from auth.users u where lower(u.email)=v_email;
 if exists(select 1 from kaia_private.kaia_store_owners where user_id=v_target) then
  raise exception 'PROPRIETARIO_NAO_PODE_SER_ALTERADO' using errcode='42501';
 end if;
 if p_enabled then
  if v_target is null or v_verified is not true then
   raise exception 'CADASTRE_E_CONFIRME_EMAIL_ANTES_DE_AUTORIZAR' using errcode='22023';
  end if;
  insert into kaia_private.kaia_admin_allowlist(email) values(v_email)
   on conflict(email) do nothing;
 else
  delete from kaia_private.kaia_admin_allowlist where email=v_email;
 end if;
 insert into kaia_private.kaia_admin_change_log(editor,action,product_key)
 values ((select auth.uid()),case when p_enabled then 'admin_granted' else 'admin_revoked' end,v_email);
 return jsonb_build_object('email',v_email,'enabled',p_enabled);
end $$;
revoke all on function public.kaia_owner_set_admin(text,boolean) from public,anon;
grant execute on function public.kaia_owner_set_admin(text,boolean) to authenticated;
