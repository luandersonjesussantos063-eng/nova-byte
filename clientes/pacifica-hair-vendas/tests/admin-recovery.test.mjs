import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const worker=read("../public/_worker.js"),admin=read("../public/admin.html"),recovery=read("../public/admin-recovery.mjs"),account=read("../public/conta.mjs"),schema=read("../backend/admin-recovery.sql");
test("admin login shows recovery entry without exposing admin on storefront",()=>{
 assert.match(admin,/id="adminForgot"/);
 assert.match(admin,/id="adminRecoveryEmailForm"/);
 assert.match(admin,/id="adminRecoveryPasswordForm"/);
 assert.match(admin,/id="adminRecoveryConfigForm"/);
 assert.match(admin,/src="\/admin-recovery\.mjs"/);
});
test("recovery requires verified dedicated Supabase account and enrolled email",()=>{
 assert.match(worker,/\/auth\/v1\/user/);
 assert.match(worker,/user\?\.email_confirmed_at/);
 assert.match(worker,/user\.email\.toLowerCase\(\)!==expected/);
 assert.match(worker,/ph_admin_recovery_config/);
 assert.match(worker,/adminPasswordValid\(db,env,b\.password\)/);
 assert.match(recovery,/shouldCreateUser:false/);
 assert.match(recovery,/admin\/recover/);
});
test("password rotation uses salted PBKDF2, replay protection and revokes sessions",()=>{
 assert.match(worker,/PBKDF2/);
 assert.match(worker,/iterations=210000/);
 assert.match(worker,/INSERT INTO ph_admin_recovery_used/);
 assert.match(worker,/DELETE FROM sessions/);
 assert.match(worker,/SELECT salt,password_hash,iterations FROM ph_admin_credentials/);
 for(const t of ["ph_admin_recovery_used","ph_admin_credentials","ph_admin_recovery_config"])assert.ok(schema.includes(t));
});
test("magic link uses already-approved account URL and returns to admin recovery",()=>{
 assert.match(recovery,/emailRedirectTo:location\.origin\+"\/conta\.html"/);
 assert.match(account,/pacifica-admin-recovery-pending/);
 assert.match(account,/localStorage\.getItem\("pacifica-admin-recovery-pending"\)/);
 assert.match(account,/location\.replace\("\/admin\.html\?recuperar=1"\)/);
 assert.match(recovery,/client\.auth\.signOut\(\{scope:"local"\}\)/);
 assert.match(recovery,/PENDING_MAX_AGE=20\*60\*1000/);
 assert.match(recovery,/localStorage\.setItem\(PENDING_KEY/);
});
test("server validates ordinary email addresses and passwords with digits",()=>{
 const validMail=String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`;
 assert.ok(worker.includes(validMail),"normal email validation must use regex escapes exactly once");
 assert.ok(worker.includes(String.raw`/\d/`),"password must require a numeric digit");
 assert.ok(!worker.includes(String.raw`/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`));
});
test("server code parses as plain JavaScript",()=>{
 assert.doesNotThrow(()=>new Function(worker.replace("export default {async fetch(","const worker = {async fetch(")));
 assert.doesNotThrow(()=>new Function(recovery.replace(/^import .*?;\s*$/gm,"")));
});
