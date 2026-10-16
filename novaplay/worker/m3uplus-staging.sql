-- NPlay private staging for authorized M3U Plus imports.
create table if not exists public.novaplay_import_staging (
 id bigint generated always as identity primary key,
 source_key text not null,
 source_index integer not null,
 title text not null,
 category text not null default '',
 logo_url text,
 source_url text not null,
 status text not null default 'pending' check (status in ('pending','passed','failed','approved')),
 updated_at timestamptz not null default now(),
 unique (source_key,source_index)
);
alter table public.novaplay_import_staging enable row level security;
revoke all on public.novaplay_import_staging from anon,authenticated;
-- Service role bypasses RLS; grant no public read access.
