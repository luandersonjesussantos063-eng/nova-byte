-- Existing Vault cron key is already used by the secure Kaia payment
-- sweep; reuse it for this privileged scheduled endpoint. The endpoint
-- returns "paused" unless public.kaia_olist_sync_control.enabled=true.
-- Never embed a secret in cron.job text.
select cron.schedule(
 'kaia-olist-auto-stock-decrease-only',
 '*/5 * * * *',
 $cron$
 select net.http_post(
  url:='https://usekaiaglow.com.br/api/kaia/olist/auto-stock',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'X-Kaia-Cron-Key',(
     select decrypted_secret from vault.decrypted_secrets
      where name='kaia_payment_expiry_cron_key'
   )
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=90000
 );
 $cron$
);
