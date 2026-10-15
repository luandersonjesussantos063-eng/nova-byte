alter table public.novaplay_live_embeds
 add column if not exists logo_url text,
 add column if not exists category text not null default '',
 add column if not exists stream_type text not null default 'iframe',
 add column if not exists last_tested_at timestamptz;
alter table public.novaplay_live_embeds add constraint nplay_live_stream_type check(stream_type in ('iframe','hls'));
alter table public.novaplay_live_embeds add constraint nplay_live_logo_https check(logo_url is null or logo_url ~ '^https://');
create unique index if not exists nplay_live_embed_url_unique on public.novaplay_live_embeds(embed_url);
update public.novaplay_live_embeds set stream_type='hls' where embed_url ~* '\.m3u8?(\?|$)';

