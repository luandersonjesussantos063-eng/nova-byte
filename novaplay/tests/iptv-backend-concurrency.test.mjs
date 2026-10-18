import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../iptv/migrations/read_catalog_without_account_row_lock_20261018.sql',import.meta.url),'utf8');

test('Xtream authentication checks passwords without locking all reads on one account',()=>{
 assert.match(sql,/where username=lower\(p_input->>'username'\);/);
 assert.doesNotMatch(sql,/where username=lower\(p_input->>'username'\) for update;/);
 assert.match(sql,/failed_attempts=0,locked_until=null where id=a\.id and \(a\.failed_attempts>0 or a\.locked_until is not null\)/);
 assert.match(sql,/extensions\.crypt\(/);
});
test('only session reservations lock an account and enforce the connection limit',()=>{
 assert.match(sql,/if p_action='start' then\s+select \* into a from nplay_iptv_private\.accounts where id=\(p_input->>'account_id'\)::uuid for update;\s+else\s+select \* into a from nplay_iptv_private\.accounts where id=\(p_input->>'account_id'\)::uuid;/);
 assert.match(sql,/if limit_count>=a\.max_connections then return jsonb_build_object\('ok',false,'code','CONNECTION_LIMIT'\)/);
 assert.match(sql,/insert into nplay_iptv_private\.sessions/);
});
test('privileged backend still enforces gateway key, account status and expiry',()=>{
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path TO ''/);
 assert.match(sql,/GATEWAY_REQUIRED/);
 assert.match(sql,/a\.locked_until>now\(\)/);
 assert.match(sql,/not a\.enabled or a\.expires_at<=now\(\)/);
});
