-- THE LEDGER REFUSES TO CREDIT A FOUNDER (stage 1b of the architecture plan,
-- owner 2026-09-05: "ok go 1b").
--
-- Read live with pg_get_functiondef before this was written: use_credits,
-- use_credits_for and get_credits answer the founder sentinel (1000000) before
-- any debit, while credit_back added up to 10 to an existing credits row with
-- no founder check and refund_charge credited a gen_charges row's cost the
-- same way. On the build route every refund after a failure, and on the media
-- side every refund of a failed generation, would therefore have credited a
-- founder for money never taken. Unreachable on the day it was fixed — one
-- founder, no credits row, no charge rows — and a founder's first purchase or
-- grant would have made it live.
--
-- The fix is the mirror of the check use_credits already makes: both refund
-- functions are decided by the founders table — never by the balance, which
-- stage 1c of the plan says out loud — and answer without writing when the
-- target is a founder. Nothing else in either body moved; the grants are
-- restated (both were already service_role only, read from pg_proc's acl).
-- The bodies are laid out the way pg_get_functiondef prints them, so the
-- read-back in the live snapshot beside this file matches this text.
--
-- ROLLBACK is the two bodies as they were, read live the same day:
--   credit_back: the same UPDATE without its `and not exists (...)` clause;
--   refund_charge: the same body without the leading `if exists ... return 0`.
--
-- Driven by scripts/edit-rpc-check.sql: section 14b (as a founder, use_credits
-- answers the sentinel and moves nothing, credit_back moves nothing,
-- refund_charge answers 0 and leaves the charge row) and section 16b (the same
-- two still pay a customer back, once). Run red against the old bodies, then
-- green against these, the same hour, inside its rolling-back transaction.

CREATE OR REPLACE FUNCTION public.credit_back(target uuid, amount numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A FOUNDER IS NEVER CREDITED BACK (2026-09-05, stage 1b). use_credits and
  -- use_credits_for answer the founder sentinel before any debit, so there is
  -- nothing to give back, and a credit here would be credits created from
  -- nothing. Decided by the founders table, never by the balance: the mirror
  -- of the check those two functions make.
  update public.credits
     set balance = balance + least(greatest(amount, 0), 10),
         updated_at = now()
   where user_id = target
     and not exists (select 1 from private.founders f where f.user_id = target);
$function$;

CREATE OR REPLACE FUNCTION public.refund_charge(p_request_id text, p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.gen_charges%rowtype;
begin
  -- A FOUNDER WAS NEVER DEBITED (2026-09-05, stage 1b): use_credits answers
  -- the sentinel before any debit, so a founder's charge row records money
  -- that never moved. Refused before the row is touched — it stays as it is,
  -- unrefunded, because nothing was paid — and decided by the founders table,
  -- never by the balance: the mirror of the check use_credits makes.
  if exists (select 1 from private.founders f where f.user_id = p_user) then return 0; end if;
  select * into c from public.gen_charges
    where request_id = p_request_id and user_id = p_user and refunded = false
    for update;
  if not found then return 0; end if;
  update public.gen_charges set refunded = true where request_id = p_request_id;
  update public.credits set balance = balance + c.cost, updated_at = now() where user_id = p_user;
  return c.cost;
end;
$function$;

revoke all on function public.credit_back(uuid, numeric) from public, anon, authenticated;
grant execute on function public.credit_back(uuid, numeric) to service_role;
revoke all on function public.refund_charge(text, uuid) from public, anon, authenticated;
grant execute on function public.refund_charge(text, uuid) to service_role;
