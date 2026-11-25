import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyCreditDue,creditDueTotals,storeToday} from "../public/credit-status.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("fiado due today shows Vence hoje, never A vencer or Atrasado",()=>{
 assert.equal(classifyCreditDue("2026-11-24","2026-11-24"),"Vence hoje");
 assert.equal(classifyCreditDue("2026-11-24","2026-11-25"),"Atrasado");
 assert.equal(classifyCreditDue("2026-11-23","2026-11-24"),"Atrasado");
 assert.equal(classifyCreditDue("2026-11-25","2026-11-24"),"A vencer");
 assert.equal(classifyCreditDue("2026-12-01","2026-11-24"),"A vencer");
 assert.equal(classifyCreditDue("2026-12-02","2026-11-24"),"Em dia");
});
test("totals use mutually exclusive buckets and exclude paid receivables",()=>{
 const credits=[
  {balance_cents:2500,due_date:"2026-11-23"},
  {balance_cents:6500,due_date:"2026-11-24"},
  {balance_cents:500,due_date:"2026-11-25"},
  {balance_cents:1000,due_date:"2026-12-02"},
  {balance_cents:0,due_date:"2026-11-22"}
 ];
 assert.deepEqual(creditDueTotals(credits,"2026-11-24"),{overdue:2500,todayCents:6500,soon:500,soonIncludingToday:7000});
 assert.deepEqual(creditDueTotals(credits,"2026-11-25"),{overdue:9000,todayCents:500,soon:1000,soonIncludingToday:1500});
});
test("store date uses São Paulo's local date, regardless of browser time zone",()=>{
 assert.equal(storeToday(new Date("2026-11-25T01:00:00Z")),"2026-11-24");
 assert.equal(storeToday(new Date("2026-11-25T03:00:00Z")),"2026-11-25");
});
test("admin UI renders explicit due today status, card and styling",()=>{
 const js=read("../public/pacifica-management.js");
 const html=read("../public/admin.html");
 const css=read("../public/pacifica-management.css");
 assert.match(js,/classifyCreditDue\(c\.due_date,now\)/);
 assert.match(js,/creditDueTotals\(data\.credits,now\)/);
 assert.match(js,/notify\("#creditToday"/);
 assert.match(html,/id="creditToday"/);
 assert.match(html,/Próximos 7 dias/);
 assert.match(css,/\.ph-status\.due-today/);
});
