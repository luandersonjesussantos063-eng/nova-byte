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
  new.next_retry_at:=now()+make_interval(secs=>case when new.error_code='MetadataUnavailable' then 3600 else least(900,60*power(2,least(new.attempts,4))::integer) end);
 end if;
 return new;
end $$;
