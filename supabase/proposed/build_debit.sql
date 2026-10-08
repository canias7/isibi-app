-- A BUILD'S DEBITS WITHOUT THE CUSTOMER'S TOKEN (2026-10-08, the first-Build
-- audit's H2). NOT APPLIED: see README.md beside this file.
--
-- The build route stores the customer's Supabase access token in the job and
-- presents it for every later ledger call: the design's settle debit minutes
-- after the request, the pages debit after generation, and the collector's
-- balance read in a later invocation. An access token lasts an hour and can
-- arrive with about a minute left, so a long build met an expired token: the
-- settle debit failed silently, the balance read threw and read as 0 (a
-- funded build refused as "not enough credits" after its paid generation),
-- and the pages debit failed and the site published free.
--
-- build_debit(p_id, p_uid, p_ref, p_amount, p_reason, p_partial, p_mint) is
-- credit_debit with the payer taken from the BUILD'S OWN ROW instead of from
-- a JWT, through the same trust boundary the edit queue's RPCs use:
--   * service_role only, and the mint key (private.mint_ok) as the second
--     factor, so no customer can reach it;
--   * the payer is edit_jobs.uid of the row p_id, which the build route filed
--     through edit_create with the authenticated user's id; p_uid must equal
--     it, so a caller cannot point one build's id at another account;
--   * the row must be a build (op = 'build');
--   * the ref must be that build's own: 'build:' || p_id || ':' || step, the
--     step one of deposit, settle, pages (BUILD_DEBIT_STEPS in worker.js), so
--     it cannot write a row under another job's ref;
--   * a row that is lost, failed or cancelled takes no new debit: work the
--     sweep has given up on, or a refusal, is never charged after the fact.
-- Everything else is credit_debit's rule, word for word: a founder is exempt
-- with no row; a short balance is refused unless p_partial, when it takes what
-- is there and says `short`; a retried debit under the same ref and reason
-- answers `repeat` with `prior`; the account row lock makes a duplicate
-- delivery safe.
--
-- THE TRANSACTIONAL PROTOCOL (2026-10-08, Codex's review of `3308d51d`: the
-- job-row read had no lock, and a valid bearer never reached this function).
--   * Every debit of a queued build goes through this function, whatever its
--     token (worker.js `buildLedger`); credit_debit is used for such a build
--     only while this function is absent (404) or the build has no row.
--   * The job row is read FOR UPDATE before its state is checked, and the
--     debit happens in the same transaction. The sweep marks a row lost with
--     an UPDATE, which takes the same row lock; the states lost, failed and
--     cancelled are terminal in every applied function (no transition leaves
--     them). So either the debit commits first — and recovery, which acts only
--     on a row already lost, finds it on the ledger when it reverses by ref —
--     or the terminal write commits first and the debit is refused.
--   * A duplicate delivery of the same ref and reason answers `repeat`, as
--     before; a lost answer is reconciled by ref by the caller.
-- Applying this file alone is not the whole change: it closes the race only
-- with the Worker code that routes every queued-build debit here.
--
-- ROLLBACK: drop the function; the Worker falls back to credit_debit with the
-- stored token when this answers 404.

CREATE OR REPLACE FUNCTION public.build_debit(p_id text, p_uid uuid, p_ref text, p_amount numeric, p_reason text, p_partial boolean, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; uid uuid; have numeric; took numeric; bal numeric; prior numeric;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_id is null or length(p_id) < 8 then raise exception 'bad id'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'bad amount'; end if;
  if p_reason is null or p_reason !~ '^[a-z][a-z0-9_-]{0,31}$' then raise exception 'bad reason'; end if;
  if p_ref is null or p_ref not in ('build:' || p_id || ':deposit', 'build:' || p_id || ':settle', 'build:' || p_id || ':pages') then
    raise exception 'bad ref';
  end if;
  -- THE ROW LOCK, before the state is read: the sweep's terminal write and
  -- this debit serialize on it (see the protocol note above).
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.op is distinct from 'build' then return jsonb_build_object('ok', false, 'error', 'not-a-build'); end if;
  if p_uid is null or j.uid is distinct from p_uid then return jsonb_build_object('ok', false, 'error', 'not-owner'); end if;
  if j.state in ('lost','failed','cancelled') then
    return jsonb_build_object('ok', false, 'error', 'terminal', 'state', j.state, 'taken', 0);
  end if;
  uid := j.uid;
  if exists (select 1 from private.founders f where f.user_id = uid) then
    return jsonb_build_object('ok', true, 'exempt', true, 'taken', 0, 'repeat', false);
  end if;
  insert into public.credits (user_id, balance) values (uid, 20) on conflict (user_id) do nothing;
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
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'taken', 0, 'balance', have, 'exempt', false, 'repeat', false);
  end if;
  update public.credits set balance = balance - took, updated_at = now()
    where user_id = uid returning balance into bal;
  insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
    values (uid, 'build', p_ref, p_reason, -took, bal);
  return jsonb_build_object('ok', true, 'taken', took, 'balance', bal, 'exempt', false, 'repeat', false, 'short', took < p_amount);
end; $function$;

revoke all on function public.build_debit(text, uuid, text, numeric, text, boolean, text) from public, anon, authenticated;
grant execute on function public.build_debit(text, uuid, text, numeric, text, boolean, text) to service_role;
