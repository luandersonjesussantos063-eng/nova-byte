alter table public.novaplay_magnet_imports add column if not exists diagnostics jsonb not null default '{}'::jsonb;
