-- These tables already allow access only to their owner. RLS adds defense in depth.
-- SECURITY DEFINER functions owned by postgres retain the existing internal access.
alter table kaia_private.kaia_customer_interest_events enable row level security;
alter table kaia_private.kaia_store_owners enable row level security;
