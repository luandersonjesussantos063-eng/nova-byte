alter table public.novaplay_live_embeds drop constraint nplay_live_stream_type;
alter table public.novaplay_live_embeds add constraint nplay_live_stream_type check (stream_type in ('iframe','hls','mpegts'));
alter table public.novaplay_featured add column if not exists youtube_featured_id uuid references public.novaplay_library(id) on delete set null;
