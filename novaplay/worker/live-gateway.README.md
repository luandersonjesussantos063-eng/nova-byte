# Protected live delivery

`live-gateway.mjs` serves purchased live MPEG-TS streams over HTTPS. Provider URLs, including account paths, are stored only in the private `LIVE_SOURCES` KV binding. Never commit playlists, KV exports or provider credentials.

Viewer requests must carry a Supabase session. The Worker reads the corresponding channel through the viewer's existing RLS policies and requires the stored playback URL to exactly match this gateway and channel ID. Approved viewers can read published channels; administrators can test their drafts. It forwards no viewer authorization to the provider, follows only validated public HTTP(S) redirects, streams the response body and returns generic upstream errors.

Bind `LIVE_SOURCES` to the `nplay-live-sources` KV namespace. Keep `PROBE_KEY` as a Worker secret for scoped diagnostics; the probe never returns provider bodies or URLs. Enable `observability.redact_query_string`, disable invocation logging and tracing, and preserve secret bindings on upload. The gateway does not transcode or turn arbitrary HLS manifests into MPEG-TS.

The ADM signal test uses the current session only on the owned gateway origin. Tokens are never persisted in channel metadata or sent to casting receivers. A channel is published through the existing ADM test after image and at least two seconds of moving video are confirmed. Imports remain drafts; importing metadata does not confirm playback.

On 2026-10-16, 2,807 live records were imported from the supplied playlist as drafts, including 90 music/radio records. VOD entries were excluded. Gateway requests from the execution environment returned an external Cloudflare 1010 block, so provider playback is still unverified. Do not mark these records as tested or publish them merely because metadata import succeeded.
