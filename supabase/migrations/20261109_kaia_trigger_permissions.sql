-- Trigger execution remains automatic; these functions are not public RPCs.
revoke execute on function public.kaia_stock_change_audit() from public,anon,authenticated;
revoke execute on function public.kaia_archived_product_visibility_guard() from public,anon,authenticated;
revoke execute on function public.kaia_commercial_guard_terminal_state() from public,anon,authenticated;
