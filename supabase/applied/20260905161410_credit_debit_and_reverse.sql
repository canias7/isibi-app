-- EXEMPTION AND DEBIT ARE EXPLICIT RESULTS (stage 1c of the architecture plan,
-- owner 2026-09-05: "ok go 1c").
--
-- The build route paid with use_credits, whose answer is a balance or -1: a
-- founder's call answered the 1000000 sentinel with nothing taken and the route
-- read it as a debit, a short balance answered -1 and collectCredits took what
-- it could, and every refund was a NUMBER the route remembered (the deposit
-- plus whatever it believed it collected) handed to credit_back, which credited
-- it whether or not it had ever been taken. Stage 1b put the founder guard on
-- the two refund functions; this is the other half: the ledger says what it
-- did, and a reversal is bounded by the ledger's own record of the debit.
--
-- credit_debit(p_amount, p_ref, p_reason, p_partial) — caller-scoped, keyed on
-- auth.uid() like use_credits — answers {ok, exempt, taken, repeat, balance,
-- short}: a founder answers exempt with nothing taken and NO row (decided by
-- the founders table, never the balance); an account that cannot cover the
-- amount answers ok:false and takes nothing, unless p_partial, when it takes
-- what is there and says `short`; a real debit writes a credit_events row of
-- kind `build` under the caller's ref — the build's own id plus a step name —
-- and a retried debit under the same ref and reason answers repeat with
-- nothing taken and `prior`, what the first one took, decided by the row
-- rather than by the caller's memory. The row lock on the account is what
-- makes a duplicate delivery safe: the second caller waits, then sees the row.
--
-- credit_reverse(p_target, p_ref, p_reason, p_amount) — service_role only —
-- finds the debit row by ref AND account, refunds least(p_amount, debited −
-- already refunded), and writes the matching refund row under the reversal's
-- own reason, so the same reversal retried answers repeat and two reversals
-- of one debit (a settle, then a refusal) never exceed it. Account status is
-- read from the row, never from the account: a founder at debit time wrote no
-- row and gets 0 back; a customer who became a founder after a real debit
-- still has the row and gets the money back. It never reads the founders
-- table.
--
-- Both are laid out the way pg_get_functiondef prints them, so the read-back
-- in the live snapshot beside this file matches this text. Nothing existing is
-- changed: use_credits, use_credits_for, credit_back and refund_charge stay
-- for the media side and for every caller not yet moved.
--
-- ROLLBACK: drop the two functions; nothing else references them until the
-- Worker carrying stage 1c deploys.
--
-- Driven by scripts/edit-rpc-check.sql: section 14c (as a founder: exempt, no
-- row, a reversal of that ref answers 0) and section 17 (as a customer: the
-- debit and its row, a repeat with `prior`, a refusal that takes nothing, a
-- partial that says `short`, two reversals bounded by the debit, a repeat
-- reversal, a stranger's reversal answering 0). Rolled back with everything.

CREATE OR REPLACE FUNCTION public.credit_debit(p_amount numeric, p_ref text, p_reason text, p_partial boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); have numeric; took numeric; bal numeric; prior numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'bad amount'; end if;
  if p_ref is null or length(p_ref) < 8 or length(p_ref) > 200 then raise exception 'bad ref'; end if;
  if p_reason is null or p_reason !~ '^[a-z][a-z0-9_-]{0,31}$' then raise exception 'bad reason'; end if;
  -- A FOUNDER IS EXEMPT, AND SAYS SO: no debit and no row, decided by the
  -- founders table and never by the balance. Before the grant insert below,
  -- so a founder never acquires a credits row through this door either.
  if exists (select 1 from private.founders f where f.user_id = uid) then
    return jsonb_build_object('ok', true, 'exempt', true, 'taken', 0, 'repeat', false);
  end if;
  insert into public.credits (user_id, balance) values (uid, 20) on conflict (user_id) do nothing;
  -- THE ACCOUNT ROW IS LOCKED BEFORE THE REPEAT CHECK, which is what makes a
  -- duplicate delivery safe: the second caller waits here, then finds the
  -- first one's row and takes nothing.
  select balance into have from public.credits where user_id = uid for update;
  have := coalesce(have, 0);
  select -e.delta into prior from public.credit_events e where e.ref = p_ref and e.reason = p_reason;
  if prior is not null then
    return jsonb_build_object('ok', true, 'repeat', true, 'taken', 0, 'prior', prior, 'exempt', false, 'balance', have);
  end if;
  took := case when have >= p_amount then p_amount
               when p_partial then floor(greatest(have, 0) * 1000000) / 1000000
               else 0 end;
  if took <= 0 then
    -- REFUSED, NOT PARTIALLY TAKEN: the gate use_credits always was.
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'taken', 0, 'balance', have, 'exempt', false, 'repeat', false);
  end if;
  update public.credits set balance = balance - took, updated_at = now()
    where user_id = uid returning balance into bal;
  insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
    values (uid, 'build', p_ref, p_reason, -took, bal);
  return jsonb_build_object('ok', true, 'taken', took, 'balance', bal, 'exempt', false, 'repeat', false, 'short', took < p_amount);
end; $function$;

CREATE OR REPLACE FUNCTION public.credit_reverse(p_target uuid, p_ref text, p_reason text, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare debited numeric; already numeric; give numeric; bal numeric;
begin
  if p_target is null then raise exception 'bad target'; end if;
  if p_ref is null or length(p_ref) < 8 or length(p_ref) > 200 then raise exception 'bad ref'; end if;
  if p_reason is null or p_reason = 'debit' or p_reason !~ '^[a-z][a-z0-9_-]{0,31}$' then raise exception 'bad reason'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'bad amount'; end if;
  -- THE DEBIT ROW DECIDES, NEVER THE ACCOUNT. A founder at debit time wrote no
  -- row and gets 0 back; a customer who became a founder after a real debit
  -- still has the row and gets the money back. Matched on the account too, so
  -- one account's ref can never be reversed onto another.
  select coalesce(-sum(e.delta), 0) into debited
    from public.credit_events e where e.ref = p_ref and e.uid = p_target and e.delta < 0;
  if debited <= 0 then
    return jsonb_build_object('ok', true, 'refunded', 0, 'debited', 0, 'repeat', false);
  end if;
  -- ONE ACCOUNT'S REVERSALS RUN ONE AT A TIME: the lock is what keeps two
  -- concurrent reversals of one debit from both reading "nothing refunded yet".
  perform 1 from public.credits where user_id = p_target for update;
  -- WHAT EARLIER REVERSALS ALREADY GAVE BACK rides on every answer, the repeat
  -- included, so a caller re-running a build can tell "returned before" from
  -- "kept": what stays on the ledger is debited less already less refunded.
  select coalesce(sum(e.delta), 0) into already
    from public.credit_events e where e.ref = p_ref and e.uid = p_target and e.delta > 0;
  if exists (select 1 from public.credit_events e where e.ref = p_ref and e.reason = p_reason) then
    return jsonb_build_object('ok', true, 'refunded', 0, 'debited', debited, 'already', already, 'repeat', true);
  end if;
  give := least(p_amount, debited - already);
  if give <= 0 then
    return jsonb_build_object('ok', true, 'refunded', 0, 'debited', debited, 'already', already, 'repeat', false);
  end if;
  update public.credits set balance = balance + give, updated_at = now()
    where user_id = p_target returning balance into bal;
  if bal is null then
    -- A debited account always has a row; a refund must never vanish anyway.
    insert into public.credits (user_id, balance) values (p_target, give) returning balance into bal;
  end if;
  insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
    values (p_target, 'build', p_ref, p_reason, give, bal);
  return jsonb_build_object('ok', true, 'refunded', give, 'debited', debited, 'already', already, 'balance', bal, 'repeat', false);
end; $function$;

revoke all on function public.credit_debit(numeric, text, text, boolean) from public, anon;
grant execute on function public.credit_debit(numeric, text, text, boolean) to authenticated, service_role;
revoke all on function public.credit_reverse(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.credit_reverse(uuid, text, text, numeric) to service_role;
