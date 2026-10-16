-- One original request per magnet; one independently resumable child per selected video.
alter table public.novaplay_magnet_imports
 add column if not exists batch_parent_id uuid references public.novaplay_magnet_imports(id);
drop index public.novaplay_import_unique_origin;
create unique index novaplay_import_unique_origin
 on public.novaplay_magnet_imports(created_by,info_hash)
 where duplicate_of is null and batch_parent_id is null;
create unique index novaplay_import_unique_pack_file
 on public.novaplay_magnet_imports(batch_parent_id,selected_file_index)
 where batch_parent_id is not null;
alter table public.novaplay_magnet_imports add constraint novaplay_import_pack_file_required
 check(batch_parent_id is null or (selected_file_index is not null and selected_file_index>=0 and batch_parent_id<>id));
create or replace function novaplay_internal.prepare_import() returns trigger
language plpgsql set search_path='' as $$
begin
 new.updated_at:=now();
 if tg_op='INSERT' then
  new.info_hash:=novaplay_internal.magnet_hash(new.magnet_uri);
  if coalesce(auth.jwt()->>'role','')='authenticated' and current_user='authenticated' then
   new.batch_parent_id:=null;
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
  new.next_retry_at:=now()+make_interval(secs=>case when new.error_code='MetadataUnavailable' then 3600 when new.error_code='SlowSource' then 900 else least(900,60*power(2,least(new.attempts,4))::integer) end);
 end if;
 return new;
end $$;

-- Protected implementation; the public RPC is an invoker-only facade.
create or replace function novaplay_internal.queue_import_files(p_job_id uuid,p_indexes integer[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 parent public.novaplay_magnet_imports;
 f jsonb; idx integer; filename text; file_title text;
 added integer:=0; reused integer:=0; ids integer[];
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then
  raise exception 'Acesso administrativo obrigatório';
 end if;
 select * into parent from public.novaplay_magnet_imports where id=p_job_id for update;
 if not found or parent.created_by<>auth.uid() or parent.batch_parent_id is not null
 or parent.duplicate_of is not null or parent.archived_at is not null then
  raise exception 'Importação original não encontrada';
 end if;
 if parent.status='processing' then raise exception 'Aguarde a tarefa atual terminar antes de selecionar o pacote';end if;
 if not parent.approved_for_processing or not parent.rights_confirmed
 or length(trim(parent.license_reference))<5 then raise exception 'Autorize o processamento do pacote primeiro';end if;
 if parent.selected_file_index is null and not (parent.status='needs_review' and parent.stage='selection') then
  raise exception 'Não foi possível identificar o arquivo já importado. Revise a tarefa antes de importar o pacote';end if;
 select array_agg(distinct i order by i) into ids from unnest(p_indexes) i;
 if coalesce(cardinality(ids),0) not between 1 and 500 or array_position(ids,null) is not null then
  raise exception 'Selecione entre 1 e 500 vídeos';end if;
 -- Validate the entire request before changing the queue.
 foreach idx in array ids loop
  select value into f from jsonb_array_elements(parent.file_candidates) where (value->>'index')::integer=idx;
  if f is null or idx<0 or coalesce((f->>'bytes')::bigint,0)<=0
  or (f->>'name') !~* '\.(mp4|mkv|webm|mov|avi|m4v|ts|ogv)$' then raise exception 'Arquivo de vídeo inválido: %',idx;end if;
 end loop;
 foreach idx in array ids loop
  if parent.selected_file_index=idx or exists(select 1 from public.novaplay_magnet_imports
    where batch_parent_id=parent.id and selected_file_index=idx) then reused:=reused+1;continue;end if;
  select value into f from jsonb_array_elements(parent.file_candidates) where (value->>'index')::integer=idx;
  filename:=regexp_replace(replace(f->>'name',chr(92),'/'),'^.*/','');
  file_title:=regexp_replace(filename,'\.[^.]+$','');
  file_title:=regexp_replace(file_title,'(?i)[ ._-]+(2160p|1080p|720p|480p|bluray|brrip|webrip|web-dl|hdtv|x264|x265|h264|h265|dual|dublado|legendado)([ ._-].*|$)','');
  file_title:=left(trim(regexp_replace(file_title,'[._]+',' ','g')),140);
  if length(file_title)<2 then file_title:=left(parent.title||' · arquivo '||idx,140);end if;
  if parent.selected_file_index is null then
   update public.novaplay_magnet_imports set selected_file_index=idx,title=file_title,status='queued',stage='queued',
    attempts=0,error_message=null,error_code=null,next_retry_at=null where id=parent.id;
   parent.selected_file_index:=idx;
  else
   insert into public.novaplay_magnet_imports(created_by,title,magnet_uri,license_reference,rights_confirmed,
     approved_for_processing,approved_at,batch_parent_id,selected_file_index,file_candidates,status)
   values(parent.created_by,file_title,parent.magnet_uri,parent.license_reference,true,true,parent.approved_at,
     parent.id,idx,parent.file_candidates,'queued');
  end if;
  added:=added+1;
 end loop;
 return jsonb_build_object('created',added,'existing',reused,'selected',cardinality(ids),'parent_id',parent.id);
end $$;
revoke all on function novaplay_internal.queue_import_files(uuid,integer[]) from public,anon;
grant execute on function novaplay_internal.queue_import_files(uuid,integer[]) to authenticated;
create or replace function public.novaplay_select_import_files(p_job_id uuid,p_indexes integer[])
returns jsonb language sql security invoker set search_path='' as $$
 select novaplay_internal.queue_import_files(p_job_id,p_indexes);
$$;
revoke all on function public.novaplay_select_import_files(uuid,integer[]) from public,anon;
grant execute on function public.novaplay_select_import_files(uuid,integer[]) to authenticated;
notify pgrst,'reload schema';
