-- Pharmacy POS: helpers that only the database itself should call.
-- The Supabase security advisor showed these were callable through the API.
-- write_audit would have let a signed-in account write fake audit rows, and
-- supplier_balance would have shown staff what the pharmacy owes suppliers.
-- The functions that use them are security definer and run as the owner, so
-- revoking the API grant does not affect them.

revoke execute on function public.write_audit(text, text, text, jsonb) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.supplier_balance(bigint) from authenticated;
revoke execute on function public.customer_balance(bigint) from authenticated;
