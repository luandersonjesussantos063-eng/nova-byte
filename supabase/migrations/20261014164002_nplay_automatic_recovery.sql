create or replace function public.novaplay_claim_import(p_worker_id text,p_job_id uuid default null)
returns setof public.novaplay_magnet_imports language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Processador obrigatório';end if;
 if length(p_worker_id) not between 1 and 120 then raise exception 'Processador inválido';end if;
 update public.novaplay_magnet_imports set status='queued',
 stage='retry_wait',worker_id=null,lock_token=null,locked_until=null,next_retry_at=now()+interval '1 minute',error_message='Processador sem comunicação; etapa será retomada',error_code='lease_expired'
 where status='processing' and worker_id is not null and locked_until<now();
 return query
 update public.novaplay_magnet_imports j set status='processing',stage='inspecting',worker_id=p_worker_id,
 lock_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',heartbeat_at=now(),attempts=attempts+1,error_message=null,next_retry_at=null
 where j.id=(select q.id from public.novaplay_magnet_imports q
 where q.status='queued' and q.approved_for_processing and q.rights_confirmed and length(trim(q.license_reference))>=5
 and q.duplicate_of is null and (q.next_retry_at is null or q.next_retry_at<=now())
 and (p_job_id is null or q.id=p_job_id)
 and not exists(select 1 from public.novaplay_magnet_imports a where a.info_hash=q.info_hash and a.id<>q.id and a.status='processing')
 order by coalesce(q.next_retry_at,q.created_at),q.created_at for update skip locked limit 1) returning j.*;
end $$;
revoke all on function public.novaplay_claim_import(text,uuid) from public,anon,authenticated;
grant execute on function public.novaplay_claim_import(text,uuid) to service_role;

create or replace function novaplay_internal.prepare_import() returns trigger
language plpgsql set search_path='' as $$
begin
 new.updated_at:=now();
 if tg_op='INSERT' then
  new.info_hash:=novaplay_internal.magnet_hash(new.magnet_uri);
  if coalesce(auth.jwt()->>'role','')='authenticated' then
   new.status:='queued';new.approved_for_processing:=false;new.approved_at:=null;
   new.r2_object_key:=null;new.media_metadata:='{}';new.file_candidates:='[]';new.selected_file_index:=null;
   new.lock_token:=null;new.worker_id:=null;new.locked_until:=null;new.duplicate_of:=null;
   new.attempts:=0;new.progress_percent:=0;new.heartbeat_at:=null;new.next_retry_at:=null;
  end if;
  new.stage:='queued';
 elsif new.magnet_uri is distinct from old.magnet_uri then raise exception 'Crie uma nova importação para alterar a origem';
 end if;
 if new.status='pending_processor' then new.status:='queued';new.stage:='queued';end if;
 -- Lease time must not depend on the processor clock (observed skew exceeded 5 minutes).
 if new.status='processing' and new.worker_id is not null and new.lock_token is not null then
  new.heartbeat_at:=now();new.locked_until:=now()+interval '5 minutes';
 end if;
 if tg_op='UPDATE' and old.status='processing' and new.status='queued' and new.worker_id is not null then
  new.next_retry_at:=now()+make_interval(secs=>least(900,60*power(2,least(new.attempts,4))::integer));
 end if;
 return new;
end $$;
