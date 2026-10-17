#!/bin/sh
# Temporary Railway trial entrypoint for the official node:24-alpine image.
# All provider URLs remain private, supplied by the authenticated NPlay gateway.
set -eu
node -e "if(!/^[a-f0-9]{64}$/.test(process.env.NPLAY_BRIDGE_KEY||'')){console.error('Configure NPLAY_BRIDGE_KEY com 64 caracteres hexadecimais.');process.exit(1)}"
apk add --no-cache ffmpeg su-exec
runtime_dir=/app/nplay-cloud-tv
mkdir -p "$runtime_dir"
# Pin the previously tested receiver version. Never download account secrets.
source_ref=4962030aa32bac11ac4676d0b61f819cb1b2064d
source_url="https://raw.githubusercontent.com/luandersonjesussantos063-eng/nova-byte/$source_ref/novaplay/pc-tv"
for module in bridge transport xtream-client media-engine provider-tls; do
    wget -q -O "$runtime_dir/$module.mjs" "$source_url/$module.mjs"
done
chown -R node:node "$runtime_dir"
export NPLAY_MEDIA_MODE="${NPLAY_MEDIA_MODE:-compatible}"
echo 'Iniciando receptor NPlay de teste na porta 8788.'
exec su-exec node node "$runtime_dir/bridge.mjs"
