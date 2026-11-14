-- Isolated PMMG sync store. Capability hashes only; never store connection codes.
create table public.mf_profile_sync (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 profile text not null check (profile in ('luanderson','jackeline')),
 revision bigint not null default 1 check (revision > 0),
 state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 2097152),
 updated_at timestamptz not null default now()
);
alter table public.mf_profile_sync enable row level security;
revoke all on public.mf_profile_sync from public, anon, authenticated;
grant select,insert,update,delete on public.mf_profile_sync to service_role;
comment on table public.mf_profile_sync is 'Private PMMG learning states. Access only through capability-authenticated missao-farda-sync function; no direct client access.';
