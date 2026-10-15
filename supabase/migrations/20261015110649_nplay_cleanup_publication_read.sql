-- Minimal read access for the existing importer to verify publication before local cleanup.
grant select (import_job_id, is_published, r2_object_key, media_validated_at)
on table public.novaplay_library to service_role;
