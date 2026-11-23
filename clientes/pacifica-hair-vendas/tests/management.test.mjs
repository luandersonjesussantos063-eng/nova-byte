import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("../public/admin.html"),worker=read("../public/_worker.js"),management=read("../public/pacifica-management.js"),schema=read("../backend/management.sql"),script=read("../public/admin-pacifica.js");
test("navigation and all four client reference panels exist",()=>{
 for(const tab of ["overview","products","stock","customers","orders","finance","reports","suppliers","settings"])
  assert.match(html,new RegExp('id="'+tab+'"'));
 for(const id of ["movementForm","stockTable","customerForm","creditForm","receiptForm","productTotal","productActive","productInactive","creditOverdue","creditSoon","creditTotal"])
  assert.match(html,new RegExp('id="'+id+'"'));
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(all).size,all.length,"IDs HTML devem ser únicos");
});
test("administrative operations live after session validation",()=>{
 const guard=worker.indexOf("if(!session||!"),manage=worker.indexOf('if(p==="/api/admin/manage")');
 assert.ok(guard>=0 && manage>guard);
 assert.match(worker,/const audit=await db\.prepare/);
 assert.match(worker,/Ative o histórico de estoque/);
 assert.match(worker,/fiado|ph_credit/i);
});
test("monetary registers have checks and audit trail",()=>{
 for(const tbl of ["ph_customers","ph_credit","ph_credit_receipts","ph_stock_movements","ph_suppliers","ph_expenses"])
  assert.match(schema,new RegExp("CREATE TABLE IF NOT EXISTS "+tbl));
 assert.match(schema,/CREATE TRIGGER IF NOT EXISTS ph_log_stock_changes/);
 assert.ok(worker.includes("FROM ph_credit_receipts WHERE credit_id=c.id)+?<=c.original_cents"));
 assert.match(worker,/credit\.receipt/);
 assert.match(worker,/validId\(b\.requestId\)/);
});
test("real data required for inventory and financial totals",()=>{
 assert.match(script,/api\("sales-summary"\)/);
 assert.match(management,/api\("manage"\)/);
 assert.match(management,/Number\.isSafeInteger\(revenue\)/);
 assert.match(management,/reloadProducts\(\)/);
});
