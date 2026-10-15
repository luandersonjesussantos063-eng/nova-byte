alter table public.novaplay_magnet_imports add column if not exists archived_at timestamptz;
create or replace function public.novaplay_archive_import(p_job_id uuid,p_archived boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports j set archived_at=case when p_archived then now() else null end
 where j.id=p_job_id and j.status in ('failed','needs_review','duplicate') and j.r2_object_key is null
 and not exists(select 1 from public.novaplay_library l where l.import_job_id=j.id)
 and (j.archived_at is not null) is distinct from p_archived;
 return found;
end $$;
revoke all on function public.novaplay_archive_import(uuid,boolean) from public,anon;
grant execute on function public.novaplay_archive_import(uuid,boolean) to authenticated;
create or replace function public.novaplay_retry_import(p_job_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports set status='queued',stage='queued',attempts=0,next_retry_at=null,error_message=null,error_code=null
 where id=p_job_id and archived_at is null
 and (status='failed' or (status='needs_review' and stage in ('capacity','source_unavailable')))
 and approved_for_processing and rights_confirmed and duplicate_of is null;
 return found;
end $$;
revoke all on function public.novaplay_retry_import(uuid) from public,anon;
grant execute on function public.novaplay_retry_import(uuid) to authenticated;
