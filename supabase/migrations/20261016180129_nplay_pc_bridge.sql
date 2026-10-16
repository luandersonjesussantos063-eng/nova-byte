alter table public.novaplay_featured add column if not exists pc_bridge_config text check (pc_bridge_config is null or length(pc_bridge_config) < 10000);
comment on column public.novaplay_featured.pc_bridge_config is 'AES-GCM encrypted PC bridge config. Only the live gateway holds the decryption key.';
