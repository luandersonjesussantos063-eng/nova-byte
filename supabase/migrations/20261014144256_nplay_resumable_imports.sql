-- Additive, resumable import pipeline. Existing processing jobs are allowed to finish.
alter table public.novaplay_magnet_imports
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists stage text not null default 'legacy',
 add column if not exists progress_percent real not null default 0 check(progress_percent between 0 and 100),
 add column if not exists heartbeat_at timestamptz,
 add column if not exists locked_until timestamptz,
 add column if not exists lock_token uuid,
 add column if not exists worker_id text,
 add column if not exists attempts integer not null default 0,
 add column if not exists next_retry_at timestamptz,
 add column if not exists error_code text,
 add column if not exists duplicate_of uuid references public.novaplay_magnet_imports(id),
 add column if not exists selected_file_index integer,
 add column if not exists file_candidates jsonb not null default '[]',
 add column if not exists media_metadata jsonb not null default '{}',
 add column if not exists info_hash text;
alter table public.novaplay_magnet_imports drop constraint novaplay_magnet_imports_status_check;
alter table public.novaplay_magnet_imports add constraint novaplay_magnet_imports_status_check check(status in ('pending_processor','queued','processing','failed','ready','needs_review','duplicate'));
alter table public.novaplay_magnet_imports alter column status set default 'queued';

-- Canonicalise both base32 and hex BTIH representations to the same 40-character key.
create or replace function novaplay_internal.magnet_hash(uri text) returns text
language plpgsql immutable strict set search_path='' as $$
declare h text; bits bit varying := B''; n integer; i integer; alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
begin
 h := substring(uri from '(?i)(?:xt=urn:btih:|xt=urn%3Abtih%3A)([A-Z2-7a-f0-9]+)');
 if length(h)=40 and h ~* '^[0-9a-f]+$' then return lower(h); end if;
 if length(h)=32 and h ~* '^[a-z2-7]+$' then
  for i in 1..32 loop n:=strpos(alphabet,upper(substr(h,i,1)))-1;bits:=bits || n::bit(5);end loop;
  h:='';for i in 0..19 loop h:=h||lpad(to_hex(substring(bits from i*8+1 for 8)::integer),2,'0');end loop;return h;
 end if;
 raise exception 'Magnet inválido: informe um hash BTIH válido';
end $$;
update public.novaplay_magnet_imports set info_hash=novaplay_internal.magnet_hash(magnet_uri);
with ranked as (
 select id,first_value(id) over(partition by created_by,info_hash order by (status='ready') desc,(status='processing') desc,created_at,id) canonical,
 row_number() over(partition by created_by,info_hash order by (status='ready') desc,(status='processing') desc,created_at,id) pos
 from public.novaplay_magnet_imports
)
update public.novaplay_magnet_imports j set duplicate_of=r.canonical,
 status=case when j.status='pending_processor' then 'duplicate' else j.status end
from ranked r where j.id=r.id and r.pos>1;
create unique index novaplay_import_unique_origin on public.novaplay_magnet_imports(created_by,info_hash) where duplicate_of is null;
create index novaplay_import_queue on public.novaplay_magnet_imports(status,next_retry_at,created_at) where duplicate_of is null;

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
 return new;
end $$;
create trigger nplay_prepare_import before insert or update on public.novaplay_magnet_imports for each row execute function novaplay_internal.prepare_import();
update public.novaplay_magnet_imports set status='queued',stage='queued' where status='pending_processor';

create or replace function public.novaplay_claim_import(p_worker_id text,p_job_id uuid default null)
returns setof public.novaplay_magnet_imports language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Processador obrigatório';end if;
 if length(p_worker_id) not between 1 and 120 then raise exception 'Processador inválido';end if;
 update public.novaplay_magnet_imports set status=case when attempts>=3 then 'failed' else 'queued' end,
 stage='retry_wait',worker_id=null,lock_token=null,locked_until=null,next_retry_at=now()+interval '1 minute',error_message='Processador sem comunicação; etapa será retomada',error_code='lease_expired'
 where status='processing' and worker_id is not null and locked_until<now();
 return query
 update public.novaplay_magnet_imports j set status='processing',stage='inspecting',worker_id=p_worker_id,
 lock_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',heartbeat_at=now(),attempts=attempts+1,error_message=null,next_retry_at=null
 where j.id=(select q.id from public.novaplay_magnet_imports q
 where q.status='queued' and q.approved_for_processing and q.rights_confirmed and length(trim(q.license_reference))>=5
 and q.duplicate_of is null and q.attempts<3 and (q.next_retry_at is null or q.next_retry_at<=now())
 and (p_job_id is null or q.id=p_job_id)
 and not exists(select 1 from public.novaplay_magnet_imports a where a.info_hash=q.info_hash and a.id<>q.id and a.status='processing')
 order by q.created_at for update skip locked limit 1) returning j.*;
end $$;
revoke all on function public.novaplay_claim_import(text,uuid) from public,anon,authenticated;
grant execute on function public.novaplay_claim_import(text,uuid) to service_role;

create or replace function public.novaplay_acknowledge_magnet_import(p_job_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports set approved_for_processing=true,approved_at=now()
 where id=p_job_id and created_by=auth.uid() and status in ('queued','pending_processor') and rights_confirmed and length(trim(license_reference))>=5 and not approved_for_processing and duplicate_of is null;
 return found;
end $$;
revoke all on function public.novaplay_acknowledge_magnet_import(uuid) from public,anon;
grant execute on function public.novaplay_acknowledge_magnet_import(uuid) to authenticated;

create or replace function public.novaplay_retry_import(p_job_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports set status='queued',stage='queued',attempts=0,next_retry_at=null,error_message=null,error_code=null
 where id=p_job_id and status='failed' and approved_for_processing and rights_confirmed and duplicate_of is null;
 return found;
end $$;
revoke all on function public.novaplay_retry_import(uuid) from public,anon;
grant execute on function public.novaplay_retry_import(uuid) to authenticated;

create or replace function public.novaplay_select_import_file(p_job_id uuid,p_index integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not novaplay_internal.is_admin() then raise exception 'Acesso administrativo obrigatório';end if;
 update public.novaplay_magnet_imports set selected_file_index=p_index,status='queued',stage='queued',attempts=0,error_message=null,error_code=null
 where id=p_job_id and status='needs_review' and duplicate_of is null
 and exists(select 1 from jsonb_array_elements(file_candidates) f where (f->>'index')::integer=p_index);
 return found;
end $$;
revoke all on function public.novaplay_select_import_file(uuid,integer) from public,anon;
grant execute on function public.novaplay_select_import_file(uuid,integer) to authenticated;

alter table public.novaplay_library
 add column if not exists import_job_id uuid unique references public.novaplay_magnet_imports(id),
 add column if not exists media_validated_at timestamptz,
 add column if not exists auto_publish boolean not null default false,
 add column if not exists season_number integer not null default 1 check(season_number between 1 and 999);
alter table public.novaplay_library drop constraint novaplay_library_file_size_bytes_check;
alter table public.novaplay_library add constraint novaplay_library_file_size_bytes_check check(file_size_bytes is null or (file_size_bytes>0 and file_size_bytes<=case when r2_object_key is not null then 549755813888 else 52428800 end));
-- Keep the existing source and rights checks, only allow R2 technical metadata.
do $$ declare definition text;begin
 select pg_get_constraintdef(oid) into definition from pg_constraint where conname='novaplay_video_source_exactly_one';
 definition:=replace(definition,'((video_path IS NULL) AND (file_size_bytes IS NULL) AND (mime_type IS NULL))','((video_path IS NULL) AND ((r2_object_key IS NOT NULL) OR ((file_size_bytes IS NULL) AND (mime_type IS NULL))))');
 alter table public.novaplay_library drop constraint novaplay_video_source_exactly_one;
 execute 'alter table public.novaplay_library add constraint novaplay_video_source_exactly_one '||definition;
end $$;

create or replace function novaplay_internal.guard_publication() returns trigger language plpgsql set search_path='' as $$
declare changed boolean;
begin
 changed:=tg_op='INSERT';
 if tg_op='UPDATE' then changed:=new.r2_object_key is distinct from old.r2_object_key;end if;
 if coalesce(auth.jwt()->>'role','')='authenticated' then
  if tg_op='INSERT' or changed then new.media_validated_at:=null;else new.media_validated_at:=old.media_validated_at;end if;
 end if;
 if new.auto_publish and not (tg_op='UPDATE' and old.is_published and not new.is_published) and new.r2_object_key is not null and new.media_validated_at is not null
 and new.rights_reviewed and new.licensed_rights_confirmed and length(trim(new.description))>0
 and new.genre not in ('Autoral','') and new.poster_path is not null then new.is_published:=true;end if;
 if new.is_published and not new.catalog_only and (tg_op='INSERT' or changed or not old.is_published) then
  if not new.rights_reviewed then raise exception 'Confira os direitos antes de publicar';end if;
  if new.r2_object_key is not null and new.media_validated_at is null then raise exception 'Aguarde a validação técnica do vídeo antes de publicar';end if;
 end if;
 return new;
end $$;
create trigger nplay_guard_publication before insert or update on public.novaplay_library for each row execute function novaplay_internal.guard_publication();

-- Private trigger is the only bridge from importer to library: no broad library grant.
create or replace function novaplay_internal.catalog_import() returns trigger
language plpgsql security definer set search_path='' as $$
declare m jsonb; existing uuid; year_value integer; validated timestamptz;
begin
 if new.status<>'ready' or new.r2_object_key is null or new.duplicate_of is not null then return new;end if;
 if auth.uid() is not null and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Somente o processador registra mídia validada';end if;
 m:=new.media_metadata;
 if (m->>'validated')::boolean is true and (m->>'duration_seconds')::numeric>0 and (m->>'size_bytes')::bigint>0 then validated:=now();end if;
 year_value:=substring(new.title from '\((19[0-9]{2}|20[0-9]{2})\)')::integer;
 select id into existing from public.novaplay_library where r2_object_key=new.r2_object_key or import_job_id=new.id limit 1;
 if existing is not null then
  update public.novaplay_library set import_job_id=coalesce(import_job_id,new.id),
   file_size_bytes=coalesce((m->>'size_bytes')::bigint,file_size_bytes),duration_seconds=coalesce(ceil((m->>'duration_seconds')::numeric)::integer,duration_seconds),
   mime_type=coalesce(m->>'mime_type',mime_type),media_validated_at=coalesce(validated,media_validated_at),
   production_year=coalesce(production_year,year_value),poster_path=coalesce(poster_path,m->>'poster_path') where id=existing;
 else
  insert into public.novaplay_library(title,kind,series_title,episode_number,season_number,production_year,r2_object_key,created_by,licensed_rights_confirmed,rights_reviewed,is_published,import_job_id,file_size_bytes,duration_seconds,mime_type,media_validated_at,auto_publish,poster_path)
  values(new.title,coalesce(m->>'kind','movie'),m->>'series_title',(m->>'episode_number')::integer,coalesce((m->>'season_number')::integer,1),year_value,new.r2_object_key,new.created_by,new.rights_confirmed,false,false,new.id,(m->>'size_bytes')::bigint,ceil((m->>'duration_seconds')::numeric)::integer,m->>'mime_type',validated,true,m->>'poster_path');
 end if;
 return new;
end $$;
revoke all on function novaplay_internal.catalog_import() from public,anon,authenticated;
create trigger nplay_catalog_ready after update of status,media_metadata on public.novaplay_magnet_imports for each row execute function novaplay_internal.catalog_import();
-- Preserve all existing rows and publications; associate the already registered imports.
update public.novaplay_library l set import_job_id=j.id
from public.novaplay_magnet_imports j where j.r2_object_key=l.r2_object_key and j.status='ready' and j.duplicate_of is null and l.import_job_id is null;
revoke truncate, references, trigger on public.novaplay_magnet_imports from anon,authenticated;
notify pgrst,'reload schema';
