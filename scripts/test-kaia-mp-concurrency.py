#!/usr/bin/env python3
"""Concurrency + idempotency checks against a separate Supabase test database only.

Requirements: pip install "psycopg[binary]"
Never prints DATABASE_URL, tokens, PII or credentials.
KAIA_TEST_DATABASE_URL must point to an isolated NEW Supabase project.
KAIA_TEST_PROJECT_REF must be set to its own ref, not the production refs.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import json
import os
import uuid
from urllib.parse import urlparse

PRODUCTION_REFS = {"vajlhodqxskozuxxlujv", "fermfbmhwlafwopwndoj"}
REF = os.getenv("KAIA_TEST_PROJECT_REF", "").strip()
DSN = os.getenv("KAIA_TEST_DATABASE_URL", "").strip()
if not REF or len(REF) < 12 or REF in PRODUCTION_REFS or not DSN:
    raise SystemExit("Ref and DSN of a NEW isolated test project are required.")
parsed = urlparse(DSN)
host = parsed.hostname or ""
if not (
    host == f"db.{REF}.supabase.co"
    or (host.startswith(("aws-", "db.")) and ".pooler.supabase.com" in host)
):
    raise SystemExit("Database hostname does not match the expected Supabase test project.")
if any(ref in DSN for ref in PRODUCTION_REFS):
    raise SystemExit("Production project string found in test DSN; refusing.")
import psycopg  # noqa: E402

SKU = "TEST-KAIA-SINGLE"

def run_reserve(k):
    try:
        with psycopg.connect(DSN, autocommit=True, connect_timeout=8) as c:
            with c.cursor() as q:
                q.execute("select kaia_mp_test.reserve_test_order(%s,%s::jsonb)",
                    (str(k), json.dumps([{"sku": SKU, "qty": 1}])))
                return q.fetchone()[0]
    except psycopg.Error:
        return {"result": "rejected_insufficient_stock"}

def apply_event(provider_id, order_id, status, event_key):
    with psycopg.connect(DSN, autocommit=True, connect_timeout=8) as c:
        with c.cursor() as q:
            q.execute(
                "select kaia_mp_test.apply_verified_order(%s,%s,%s,%s)",
                (provider_id, order_id, status, event_key))
            return q.fetchone()[0]

def row():
    with psycopg.connect(DSN, connect_timeout=8) as c:
        with c.cursor() as q:
            q.execute(
                "select total_units,reserved_units from kaia_mp_test.test_catalog where sku=%s",
                (SKU,))
            return q.fetchone()

def assert_ready():
    with psycopg.connect(DSN, connect_timeout=8) as c:
        with c.cursor() as q:
            q.execute("select count(*) from kaia_mp_test.checkout_orders")
            count = q.fetchone()[0]
            q.execute("select total_units,reserved_units from kaia_mp_test.test_catalog where sku=%s", (SKU,))
            stock = q.fetchone()
            if count != 0 or stock != (5,0):
                raise RuntimeError(
                    "Isolated test database must start with 0 orders and exactly 5 unreserved synthetic units.")

assert_ready()
keys = [uuid.uuid4() for _ in range(10)]
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(run_reserve,keys))

reserved = [r for r in results if r.get("result")=="reserved"]
other = [r for r in results if r.get("result")!="reserved"]
if len(reserved) != 5 or len(other) != 5:
    raise RuntimeError(f"Concurrent run failed: {Counter(r.get('result') for r in results)}")
if row() != (5,5):
    raise RuntimeError("Overselling or incorrect reservation count.")

# Retries with same idempotency key must not create another order.
retry=run_reserve(keys[results.index(reserved[0])])
assert retry.get("result") == "duplicate", retry

# Test approved, rejected, cancelled, pending and duplicate webhook notifications.
for idx, test_order in enumerate(reserved):
    oid = str(test_order["order_id"])
    provider=f"MP-TEST-ONLY-{idx}-{uuid.uuid4()}"
    if idx == 0:
        ok=apply_event(provider,oid,"approved",f"approved-{oid}")
        again=apply_event(provider,oid,"approved",f"approved-{oid}")
        assert ok["result"]=="approved" and again["result"]=="duplicate_event"
    elif idx == 1:
        state=apply_event(provider,oid,"pending",f"pending-{oid}")
        result=apply_event(provider,oid,"rejected",f"rejected-{oid}")
        assert state["result"]=="pending" and result["result"]=="rejected"
    elif idx == 2:
        result=apply_event(provider,oid,"cancelled",f"cancelled-{oid}")
        assert result["result"]=="cancelled"
    elif idx == 3:
        result=apply_event(provider,oid,"approved",f"approved-{oid}")
        assert result["result"]=="approved"
    else:
        result=apply_event(provider,oid,"rejected",f"rejected-{oid}")
        assert result["result"]=="rejected"

# Exactly 2 approved units sold, 3 released, no outstanding reservations.
assert row() == (3,0), f"Unexpected final stock: {row()}"
print(json.dumps({
    "test": "Kaia Glow isolated concurrency",
    "concurrent_orders": 10,
    "reserved": 5,
    "rejected_due_to_stock": 5,
    "idempotency": "passed",
    "approved": 2,
    "pending_then_rejected": 1,
    "cancelled": 1,
    "duplicate_webhook": "ignored",
    "final_test_stock": 3,
    "final_reserved": 0,
    "result": "PASS"
}, ensure_ascii=False))
