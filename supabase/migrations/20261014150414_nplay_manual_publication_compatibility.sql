-- Preserve the separate manual-upload review workflow. Imported jobs require technical validation.
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
  if new.import_job_id is not null and new.r2_object_key is not null and new.media_validated_at is null then raise exception 'Aguarde a validação técnica do vídeo antes de publicar';end if;
 end if;
 return new;
end $$;
