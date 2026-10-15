create or replace function public.novaplay_retry_import(p_job_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports set status='queued',stage='queued',attempts=0,next_retry_at=null,error_message=null,error_code=null
 where id=p_job_id and (status='failed' or (status='needs_review' and stage='capacity'))
 and approved_for_processing and rights_confirmed and duplicate_of is null;
 return found;
end $$;
revoke all on function public.novaplay_retry_import(uuid) from public,anon;
grant execute on function public.novaplay_retry_import(uuid) to authenticated;
