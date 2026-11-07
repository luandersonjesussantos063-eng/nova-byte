-- No secret is stored in this migration. The key is held in Supabase Vault.
-- Run only after the authenticated /api/kaia/comercial/expirar endpoint is live.
select cron.schedule(
 'kaia-unpaid-payment-expiry',
 '* * * * *',
 $job$
  select net.http_post(
   url:='https://usekaiaglow.com.br/api/kaia/comercial/expirar',
   headers:=jsonb_build_object(
    'Content-Type','application/json',
    'X-Kaia-Cron-Key',(select decrypted_secret from vault.decrypted_secrets
                       where name='kaia_payment_expiry_cron_key')
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=90000
  );
 $job$
);
