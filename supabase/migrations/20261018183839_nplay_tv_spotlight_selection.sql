alter table public.novaplay_featured add column if not exists tv_spotlight_ids uuid[] not null default '{}'::uuid[];
alter table public.novaplay_featured add constraint nplay_tv_spotlight_max_24 check (cardinality(tv_spotlight_ids)<=24 and array_position(tv_spotlight_ids,null) is null);
comment on column public.novaplay_featured.tv_spotlight_ids is 'Admin-selected published channels for TV previews; newly selected channels require moving-video confirmation in the admin UI. Empty disables the spotlight.';
