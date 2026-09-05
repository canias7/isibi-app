-- LIVE SNAPSHOT of every public.edit_* function, read out of the database with
-- pg_get_functiondef on 2026-09-01 after the finalize/refund fixes — AND,
-- since 2026-09-05, the two refund functions credit_back and refund_charge,
-- read the same way after stage 1b's founder guard (migration
-- 20260905154557_founder_guard_on_refunds); they are at the end of this file,
-- and test/refund-founder-guard.test.mjs holds them equal to that migration.
-- AND, the same day, the two explicit-ledger functions credit_debit and
-- credit_reverse (stage 1c, migration 20260905161410_credit_debit_and_reverse),
-- read the same way after their apply — after those, at the very end;
-- test/credit-debit.test.mjs holds them equal to that migration.
-- AND, later the same day, edit_sweep_lost REPLACED IN PLACE (stage 2a,
-- migration 20260905175752_sweep_finalizes_committed: a committed job is
-- finalized rather than re-picked, tries are counted in edit_jobs.sweep_tries,
-- a row five ticks could not settle is parked in review), read back the same
-- way; test/sweep-recovery.test.mjs holds that block equal to its migration.
-- AND, that evening, edit_create REPLACED IN PLACE and edit_handoff ADDED
-- (stage 2c, migration 20260905190147_build_rows_lease_chain: a build's row is
-- billed external from its op, and one lease moves along the build's chain -
-- consumer, container, collector), both read back the same way;
-- test/build-jobs.test.mjs holds both equal to that migration.
--
-- WHY THIS FILE EXISTS: the folder had drifted from what was live. Four
-- migrations applied earlier that day were never written here and one was
-- edited into an older file in place, so rewriting edit_finalize from the
-- folder's text silently dropped its always-store-result behaviour - caught by
-- scripts/edit-rpc-check.sql (FAIL 9b) minutes later. A migration folder is a
-- claim about the database; this is the database's own answer.
--
-- RE-APPLYING IT IS A NO-OP, which is what makes it safe to keep here. Before
-- redefining any of these, read the live definition again rather than trusting
-- this or any other file - the next drift starts the day this one is stale.
--
-- Grants are not part of pg_get_functiondef. Every function here is
-- SECURITY DEFINER with EXECUTE granted to service_role only (revoked from
-- public, anon, authenticated), verified the same day from
-- information_schema.routine_privileges.

-- edit_beat(p_id text, p_owner text, p_ttl integer, p_phase text, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_beat(p_id text, p_owner text, p_ttl integer, p_phase text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_ttl is null or p_ttl < 10 or p_ttl > 600 then raise exception 'bad ttl'; end if;
  update public.edit_jobs
     set lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         phase = coalesce(p_phase, phase),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and state not in ('done','failed','cancelled','lost')
   returning * into j;
  if not found then return jsonb_build_object('ok', false, 'alive', false); end if;
  return jsonb_build_object('ok', true, 'alive', true, 'state', j.state,
                            'cancel', j.cancel_requested_at is not null);
end; $function$;

-- edit_cancel(p_id text, p_uid uuid, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_cancel(p_id text, p_uid uuid, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  select * into j from public.edit_jobs where id = p_id and uid = p_uid;
  -- NOT FOUND AND NOT YOURS ARE ONE ANSWER, so a job id cannot be probed.
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.published_at is not null then
    return jsonb_build_object('ok', false, 'error', 'too-late', 'state', j.state);
  end if;
  if j.state in ('done','failed','cancelled','lost') then
    return jsonb_build_object('ok', true, 'state', j.state, 'cancel', j.cancel_requested_at is not null);
  end if;
  update public.edit_jobs
     set cancel_requested_at = coalesce(cancel_requested_at, now()), updated_at = now()
   where id = p_id returning * into j;
  return jsonb_build_object('ok', true, 'state', j.state, 'cancel', true);
end; $function$;

-- edit_claim(p_id text, p_owner text, p_ttl integer, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_claim(p_id text, p_owner text, p_ttl integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  if p_ttl is null or p_ttl < 10 or p_ttl > 600 then raise exception 'bad ttl'; end if;
  update public.edit_jobs
     set lease_owner = p_owner,
         lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         state = case when state = 'queued' then 'claimed' else state end,
         updated_at = now()
   where id = p_id
     and state not in ('done','failed','cancelled','lost')
     and needs_review = false
     -- NOT ALREADY PAID FOR OR PAID BACK. Belt as well as braces: both of those
     -- states also move `state`, but a claim is the door and a door should test
     -- what it is protecting rather than trusting a neighbour to have done it.
     and billing not in ('finalized','refunded')
     and (lease_owner is null or lease_expires_at < now())
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'claimed', true, 'state', j.state,
      'billing', j.billing, 'uid', j.uid, 'slug', j.slug, 'needs_review', j.needs_review);
  end if;
  -- A SECOND DELIVERY FINDS NOTHING TO CLAIM, and it is told WHY rather than
  -- being handed a bare false: an already-leased job and a terminal one need
  -- opposite reactions from the consumer.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'claimed', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'claimed', false, 'state', j.state,
    'error', case when j.needs_review then 'needs-review'
                  when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  when j.billing in ('finalized','refunded') then 'settled'
                  else 'leased' end);
end; $function$;

-- edit_committed(p_id text, p_owner text, p_build text, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_committed(p_id text, p_owner text, p_build text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  update public.edit_jobs
     set published_at = coalesce(published_at, now()),
         artifact_build = coalesce(p_build, artifact_build),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and state not in ('done','failed','cancelled','lost');
  return jsonb_build_object('ok', found);
end; $function$;

-- edit_create(p_id text, p_uid uuid, p_slug text, p_op text, p_idem text, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_create(p_id text, p_uid uuid, p_slug text, p_op text, p_idem text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare r public.edit_jobs%rowtype; blocked text;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_id is null or length(p_id) < 8 then raise exception 'bad id'; end if;
  if p_uid is null or p_slug is null or p_op is null then raise exception 'bad args'; end if;
  -- A SITE UNDER REVIEW TAKES NO NEW EDITS. A job that died mid-publish may or
  -- may not have shipped, so the stored source and the live site cannot be
  -- assumed equal -- and an edit built on the wrong one overwrites a published
  -- version nobody knew was live.
  select id into blocked from public.edit_jobs where slug = p_slug and needs_review limit 1;
  if blocked is not null then
    return jsonb_build_object('ok', false, 'error', 'needs-review', 'job', blocked);
  end if;
  -- REFUSED, NEVER GENERATED. A server-minted key makes every retry a distinct
  -- job, which is exactly the double charge this exists to prevent.
  if p_idem is null or p_idem !~ '^[A-Za-z0-9_-]{16,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad-idem');
  end if;
  -- THE OP DECIDES THE BILLING (stage 2c). A build's money moves through its
  -- own ledger and never through a reserve on this row, so it is filed
  -- `external` -- here, from the op, so no caller can file one under a reserve.
  insert into public.edit_jobs (id, uid, slug, op, idem_key, billing)
    values (p_id, p_uid, p_slug, p_op, p_idem, case when p_op = 'build' then 'external' else 'none' end)
    on conflict do nothing;
  select * into r from public.edit_jobs
   where uid = p_uid and slug = p_slug and op = p_op and idem_key = p_idem;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'job', r.id, 'state', r.state,
                            'duplicate', r.id is distinct from p_id);
end; $function$;

-- edit_finalize(p_id text, p_result jsonb, p_mint text)  -- the wrapper: p_ok := false
CREATE OR REPLACE FUNCTION public.edit_finalize(p_id text, p_result jsonb, p_mint text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
  select public.edit_finalize(p_id, p_result, false, p_mint);
$function$;

-- edit_finalize(p_id text, p_result jsonb, p_ok boolean, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_finalize(p_id text, p_result jsonb, p_ok boolean, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  -- THE REPLY FIRST, UNCONDITIONALLY. A refused finalize still leaves the
  -- customer something to read when they poll.
  update public.edit_jobs
     set result = coalesce(p_result, result), updated_at = now()
   where id = p_id and p_result is not null;
  update public.edit_jobs
     set state = 'done',
         billing = case when billing = 'reserved' then 'finalized' else billing end,
         updated_at = now()
   where id = p_id
     and (published_at is not null
          or (publish_started_at is null and coalesce(p_ok, false)))
     and state not in ('cancelled','lost','failed')
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'billing', j.billing, 'cost', j.cost, 'published', j.published_at is not null);
  end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.published_at is null then 'not-published' else 'terminal' end);
end; $function$;

-- edit_get(p_id text, p_uid uuid, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_get(p_id text, p_uid uuid, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  select * into j from public.edit_jobs where id = p_id and uid = p_uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object(
    'ok', true, 'job', j.id, 'slug', j.slug, 'state', j.state, 'phase', j.phase,
    'cost', j.cost, 'billing', j.billing, 'needs_review', j.needs_review,
    'cancel', j.cancel_requested_at is not null,
    'ms', (extract(epoch from (coalesce(j.updated_at, now()) - j.created_at)) * 1000)::bigint,
    'result', j.result, 'error', j.error);
end; $function$;

-- edit_may_publish(p_id text, p_owner text, p_ttl integer, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_may_publish(p_id text, p_owner text, p_ttl integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_ttl is null or p_ttl < 10 or p_ttl > 600 then raise exception 'bad ttl'; end if;
  update public.edit_jobs
     set state = 'publishing',
         publish_started_at = coalesce(publish_started_at, now()),
         lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_id
     and lease_owner = p_owner
     and lease_expires_at > now()
     and cancel_requested_at is null
     and needs_review = false
     and state not in ('done','failed','cancelled','lost')
     and billing in ('reserved','exempt')
   returning * into j;
  if found then return jsonb_build_object('ok', true, 'granted', true); end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'granted', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'granted', false, 'state', j.state,
    'error', case when j.cancel_requested_at is not null then 'cancelled'
                  when j.needs_review then 'needs-review'
                  when j.lease_owner is distinct from p_owner then 'lease-lost'
                  when j.lease_expires_at <= now() then 'lease-expired'
                  when j.billing = 'none' then 'unbilled'
                  else 'terminal' end);
end; $function$;

-- edit_phase_stats(p_days integer, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_phase_stats(p_days integer, p_mint text)
 RETURNS TABLE(phase text, n bigint, p50 numeric, p90 numeric, p95 numeric, worst numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'bad window'; end if;
  return query
    select k::text,
           count(*)::bigint,
           percentile_cont(0.50) within group (order by v)::numeric,
           percentile_cont(0.90) within group (order by v)::numeric,
           percentile_cont(0.95) within group (order by v)::numeric,
           max(v)::numeric
      from public.edit_jobs j,
           lateral jsonb_each_text(coalesce(j.phase_ms, '{}'::jsonb)) as e(k, raw),
           lateral (select (e.raw)::numeric as v) as t
     where j.created_at > now() - make_interval(days => p_days)
       and j.phase_ms is not null
     group by k
     order by k;
end; $function$;

-- edit_phase_write(p_id text, p_phase_ms jsonb, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_phase_write(p_id text, p_phase_ms jsonb, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_phase_ms is null or jsonb_typeof(p_phase_ms) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad-shape');
  end if;
  update public.edit_jobs set phase_ms = p_phase_ms, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end; $function$;

-- edit_publish_mark(p_id text, p_owner text, p_artifact_build text, p_dist_etag text, p_sidecar_etag text, p_source_etag text, p_worker_status integer, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_publish_mark(p_id text, p_owner text, p_artifact_build text, p_dist_etag text, p_sidecar_etag text, p_source_etag text, p_worker_status integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  update public.edit_jobs
     set artifact_build = coalesce(p_artifact_build, artifact_build),
         dist_etag      = coalesce(p_dist_etag, dist_etag),
         sidecar_etag   = coalesce(p_sidecar_etag, sidecar_etag),
         source_etag    = coalesce(p_source_etag, source_etag),
         worker_status  = coalesce(p_worker_status, worker_status),
         publish_started_at = coalesce(publish_started_at, now()),
         updated_at = now()
   where id = p_id and lease_owner = p_owner;
  return jsonb_build_object('ok', found);
end; $function$;

-- edit_reconcile(p_id text, p_committed boolean, p_note text, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_reconcile(p_id text, p_committed boolean, p_note text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; bal numeric;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_committed is null then raise exception 'bad verdict'; end if;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if not j.needs_review then return jsonb_build_object('ok', false, 'error', 'not-in-review', 'state', j.state); end if;
  if p_committed then
    update public.edit_jobs
       set needs_review = false, published_at = coalesce(published_at, now()),
           state = 'done', billing = case when billing = 'reserved' then 'finalized' else billing end,
           review_note = coalesce(p_note, review_note), updated_at = now()
     where id = p_id;
    return jsonb_build_object('ok', true, 'outcome', 'kept', 'cost', j.cost);
  end if;
  if j.billing = 'reserved' then
    update public.credits set balance = balance + j.cost, updated_at = now()
      where user_id = j.uid returning balance into bal;
    insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
      values (j.uid, 'edit', p_id, 'refund', j.cost, coalesce(bal, 0))
      on conflict on constraint credit_events_once do nothing;
  end if;
  update public.edit_jobs
     set needs_review = false, state = 'failed',
         billing = case when billing = 'reserved' then 'refunded' else billing end,
         review_note = coalesce(p_note, review_note), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'outcome', 'refunded', 'refunded', case when j.billing = 'reserved' then j.cost else 0 end);
end; $function$;

-- edit_refund(p_id text, p_state text, p_note text, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_refund(p_id text, p_state text, p_note text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; bal numeric;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_state not in ('failed','cancelled','lost') then raise exception 'bad state'; end if;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.published_at is not null then
    return jsonb_build_object('ok', false, 'error', 'published', 'state', j.state);
  end if;
  if j.state = 'done' then
    return jsonb_build_object('ok', false, 'error', 'terminal', 'state', j.state);
  end if;
  if j.publish_started_at is not null then
    update public.edit_jobs
       set state = p_state, needs_review = true,
           review_note = coalesce(p_note, 'died during publish'), updated_at = now()
     where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'needs-review', 'refunded', 0);
  end if;
  if j.billing = 'reserved' then
    update public.credits set balance = balance + j.cost, updated_at = now()
      where user_id = j.uid returning balance into bal;
    -- unique (ref, reason) IS THE SECOND GUARD. The conditional billing update
    -- below is the first; either alone would do, and a refund is the one
    -- operation worth being unable to repeat by two independent means.
    insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
      values (j.uid, 'edit', p_id, 'refund', j.cost, coalesce(bal, 0))
      on conflict on constraint credit_events_once do nothing;
    update public.edit_jobs set billing = 'refunded', state = p_state, updated_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'refunded', j.cost, 'balance', bal);
  end if;
  -- exempt, none, finalized or already refunded: the state moves, the money
  -- does not. A founder refunded here would be credits created from nothing.
  update public.edit_jobs set state = p_state, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'refunded', 0, 'billing', j.billing);
end; $function$;

-- edit_reserve(p_id text, p_seq integer, p_cost numeric, p_mint text)
CREATE OR REPLACE FUNCTION public.edit_reserve(p_id text, p_seq integer, p_cost numeric, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; bal numeric; founder boolean; evref text;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_cost is null or p_cost <= 0 or p_cost > 100000 then raise exception 'bad cost'; end if;
  if p_seq is null or p_seq < 1 or p_seq > 64 then raise exception 'bad seq'; end if;
  evref := p_id || '#' || p_seq::text;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.state in ('done','failed','cancelled','lost') then
    return jsonb_build_object('ok', false, 'error', 'terminal', 'state', j.state);
  end if;
  -- IDEMPOTENT PER CHARGE, decided by the ledger rather than by us. The row lock
  -- above is what makes it safe under a duplicate delivery: the second caller
  -- waits, then finds the ledger row already there.
  if exists (select 1 from public.credit_events ce where ce.ref = evref and ce.reason = 'reserve') then
    return jsonb_build_object('ok', true, 'charged', 0, 'cost', j.cost, 'billing', j.billing, 'repeat', true);
  end if;
  select exists(select 1 from private.founders where user_id = j.uid) into founder;
  if founder then
    -- NO DEBIT AND NO LEDGER ROW, and `exempt` is a state of its own so the
    -- refund path can refuse it. use_credits does not debit a founder while
    -- credit_back has no founder check, so a reserve/refund round trip on one
    -- MINTS credits out of nothing.
    update public.edit_jobs set billing='exempt', cost=0,
      state = case when state in ('queued','claimed') then 'routing' else state end,
      updated_at=now() where id=p_id;
    return jsonb_build_object('ok', true, 'charged', 0, 'cost', 0, 'billing', 'exempt');
  end if;
  insert into public.credits (user_id, balance) values (j.uid, 20) on conflict (user_id) do nothing;
  update public.credits set balance = balance - p_cost, updated_at = now()
    where user_id = j.uid and balance >= p_cost returning balance into bal;
  if bal is null then
    -- REFUSED, NOT PARTIALLY TAKEN. use_credits is a gate rather than a till and
    -- this keeps that property: a bill larger than the balance moves nothing.
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'cost', j.cost);
  end if;
  insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
    values (j.uid, 'edit', evref, 'reserve', -p_cost, bal);
  update public.edit_jobs
     set billing = 'reserved', cost = coalesce(cost, 0) + p_cost,
         state = case when state in ('queued','claimed') then 'routing' else state end,
         updated_at = now()
   where id = p_id returning * into j;
  return jsonb_build_object('ok', true, 'charged', p_cost, 'cost', j.cost, 'balance', bal, 'billing', 'reserved');
end; $function$;

-- edit_sweep_lost(p_limit integer, p_grace integer, p_mint text)
-- Replaced 2026-09-05 (stage 2a, 20260905175752_sweep_finalizes_committed.sql)
-- and read back with pg_get_functiondef after the apply, as the rule above
-- says; test/sweep-recovery.test.mjs holds this block equal to that migration.
CREATE OR REPLACE FUNCTION public.edit_sweep_lost(p_limit integer, p_grace integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare r record; n_lost int := 0; n_review int := 0; n_recovered int := 0; n_exhausted int := 0; n_stuck int := 0; refunded numeric := 0; res jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'bad limit'; end if;
  if p_grace is null or p_grace < 30 or p_grace > 3600 then raise exception 'bad grace'; end if;
  for r in
    select id, cost, artifact_build, sweep_tries from public.edit_jobs
     where state not in ('done','failed','cancelled','lost')
       and needs_review = false
       and lease_expires_at is not null
       and lease_expires_at < now() - make_interval(secs => p_grace)
     order by lease_expires_at
     limit p_limit
  loop
    -- A ROW FIVE TICKS COULD NOT SETTLE IS PARKED, before a sixth try: out of
    -- the batch (needs_review is excluded above, and closes its site to new
    -- edits as every review row does), the money where it is, and a person
    -- settles it through edit_reconcile. Held, it would keep one of the
    -- batch's slots and a browser polling a 202 for ever. The sweep's own
    -- conditions are asked again at the write, so a row another caller moved
    -- since the select is left alone.
    if r.sweep_tries >= 5 then
      update public.edit_jobs
         set needs_review = true, review_note = 'sweep exhausted', updated_at = now()
       where id = r.id and needs_review = false
         and state not in ('done','failed','cancelled','lost')
         and lease_expires_at < now() - make_interval(secs => p_grace);
      if found then n_exhausted := n_exhausted + 1; end if;
      continue;
    end if;
    -- EVERY ATTEMPT IS COUNTED, and counted first, so a refusal below that
    -- names no branch still moves the row toward the ceiling.
    update public.edit_jobs set sweep_tries = sweep_tries + 1, updated_at = now() where id = r.id;
    res := public.edit_refund(r.id, 'lost', 'lease expired', p_mint);
    if (res->>'error') = 'published' then
      -- THE JOB SHIPPED AND DIED BEFORE ITS FINALIZE: edit_committed set
      -- published_at, the refund refuses it (rightly), and until stage 2a
      -- this branch counted that as lost, changed nothing, and picked the
      -- row again every tick. Finalized here with a reply the poll route
      -- can serve - the consumer's own {status, type, body}, the body as
      -- text - saying the change went live and the details of what it did
      -- were lost. The reserve stands: nothing is refunded for work that is
      -- live. A finalize that still refuses leaves the row for the ceiling.
      res := public.edit_finalize(r.id, jsonb_build_object(
               'status', 200, 'type', 'application/json',
               'body', jsonb_build_object('ok', true, 'recovered', true, 'job', r.id,
                                          'cost', r.cost, 'build', r.artifact_build)::text),
             true, p_mint);
      if (res->>'ok') = 'true' then n_recovered := n_recovered + 1;
      else n_stuck := n_stuck + 1;
      end if;
    elsif (res->>'error') = 'needs-review' then n_review := n_review + 1;
    elsif (res->>'ok') = 'true' then
      n_lost := n_lost + 1; refunded := refunded + coalesce((res->>'refunded')::numeric, 0);
    else
      -- A REFUSAL WITH NO BRANCH (no-job, terminal: a race this tick lost).
      -- The row stays, counted, and the ceiling above ends it.
      n_stuck := n_stuck + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'lost', n_lost, 'review', n_review, 'recovered', n_recovered,
    'exhausted', n_exhausted, 'stuck', n_stuck, 'refunded', refunded);
end; $function$;

-- edit_exempt(p_id text, p_owner text, p_mint text)
-- Added 2026-09-02 (20260902034000_edit_exempt_free_rung.sql); read back with
-- pg_get_functiondef after applying, as the rule above says.
CREATE OR REPLACE FUNCTION public.edit_exempt(p_id text, p_owner text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  update public.edit_jobs
     set billing = 'exempt', cost = 0, updated_at = now()
   where id = p_id
     and lease_owner = p_owner
     and lease_expires_at > now()
     and cancel_requested_at is null
     and needs_review = false
     and state not in ('done','failed','cancelled','lost')
     and billing = 'none'
   returning * into j;
  if found then return jsonb_build_object('ok', true, 'billing', 'exempt', 'state', j.state); end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state, 'billing', j.billing,
    'error', case when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  when j.cancel_requested_at is not null then 'cancelled'
                  when j.needs_review then 'needs-review'
                  when j.lease_owner is distinct from p_owner then 'lease-lost'
                  when j.lease_expires_at <= now() then 'lease-expired'
                  when j.billing <> 'none' then 'billed'
                  else 'refused' end);
end; $function$;

-- edit_handoff(p_id text, p_owner text, p_next text, p_ttl integer, p_state text, p_slug text, p_mint text)
-- ADDED 2026-09-05 (stage 2c, migration 20260905190147_build_rows_lease_chain),
-- read back the same way after its apply; test/build-jobs.test.mjs holds it
-- equal to that migration.
CREATE OR REPLACE FUNCTION public.edit_handoff(p_id text, p_owner text, p_next text, p_ttl integer, p_state text, p_slug text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  if p_next is not null and length(p_next) < 4 then raise exception 'bad owner'; end if;
  -- UP TO AN HOUR, where edit_claim and edit_beat stop at ten minutes: the
  -- handoff to the container is for the generation bound (thirty minutes),
  -- which no heartbeat of the Worker's can renew. A release or a takeover
  -- asks for far less.
  if p_ttl is null or p_ttl < 10 or p_ttl > 3600 then raise exception 'bad ttl'; end if;
  -- THE HOLDER MOVES IT, NOBODY ELSE. A null next holder is a RELEASE: the
  -- owner stays and only the expiry moves, so the collector can still take it
  -- over by that name, and the sweep ends it if no collector comes. The state
  -- and the slug are set only when the caller knows them; the row's own CHECK
  -- refuses a state that is not one of its own.
  update public.edit_jobs
     set lease_owner = coalesce(p_next, lease_owner),
         lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         state = coalesce(p_state, state),
         slug = coalesce(nullif(p_slug, ''), slug),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and state not in ('done','failed','cancelled','lost')
     and needs_review = false
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'state', j.state, 'owner', j.lease_owner, 'slug', j.slug,
                              'expires', j.lease_expires_at);
  end if;
  -- TOLD WHY, as edit_claim tells a second delivery: a stranger, a terminal
  -- row and a row under review need different reactions from the caller.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.needs_review then 'needs-review'
                  when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  else 'not-holder' end);
end; $function$;

-- ── THE TWO REFUND FUNCTIONS, read with pg_get_functiondef on 2026-09-05 ──
-- immediately after migration 20260905154557_founder_guard_on_refunds was
-- applied (stage 1b: a founder is never credited back). EXECUTE is held by
-- postgres and service_role only, read from pg_proc.proacl the same minute.
-- scripts/edit-rpc-check.sql sections 14b and 16b drive them.

-- credit_back(target uuid, amount numeric)
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

-- refund_charge(p_request_id text, p_user uuid)
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

-- ── THE EXPLICIT LEDGER, read with pg_get_functiondef on 2026-09-05 ─────────
-- immediately after migration 20260905161410_credit_debit_and_reverse was
-- applied (stage 1c). credit_debit: EXECUTE held by postgres, authenticated
-- and service_role (it is keyed on auth.uid(), like use_credits);
-- credit_reverse: postgres and service_role only. Both read from
-- pg_proc.proacl the same minute. scripts/edit-rpc-check.sql sections 14c and
-- 17 drive them.

-- credit_debit(p_amount numeric, p_ref text, p_reason text, p_partial boolean)
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

-- credit_reverse(p_target uuid, p_ref text, p_reason text, p_amount numeric)
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
