-- Applied 2026-09-01 as remote version 20260901110952.
--
-- The transactional boundary for an async edit. Every one of these is ONE
-- database transaction -- a plpgsql body is -- so a Worker dying anywhere inside
-- one leaves none of it. That is the whole point: a conditional job-row update
-- followed by a separate ledger call is not atomic, and the Worker can die
-- between them.
--
-- ALL SERVICE-ROLE ONLY, mint-key gated, search_path pinned. The consumer
-- replays the customer's JWT, but the cron that refunds a lost job hours later
-- holds none and a queued job can outlive one -- so all three billing
-- transitions share one identity, or they cannot share a transaction.

-- ONE PLACE FOR THE MINT CHECK. Inlining it at thirteen call sites is thirteen
-- chances to forget it, and the direction of that mistake is an unauthenticated
-- caller moving money.
create or replace function private.mint_ok(k text) returns boolean
language sql security definer set search_path to 'private', 'extensions' as $$
  select k is not null and exists (
    select 1 from private.mint where key_hash = encode(extensions.digest(k, 'sha256'), 'hex'));
$$;

-- ── CREATE ────────────────────────────────────────────────────────────────
-- Request-level idempotency. A lost POST response followed by a client retry
-- must return the SAME job, not start a second one that charges again.
create or replace function public.edit_create(
  p_id text, p_uid uuid, p_slug text, p_op text, p_idem text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
  insert into public.edit_jobs (id, uid, slug, op, idem_key)
    values (p_id, p_uid, p_slug, p_op, p_idem)
    on conflict do nothing;
  select * into r from public.edit_jobs
   where uid = p_uid and slug = p_slug and op = p_op and idem_key = p_idem;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'job', r.id, 'state', r.state,
                            'duplicate', r.id is distinct from p_id);
end; $$;

-- ── RESERVE ───────────────────────────────────────────────────────────────
create or replace function public.edit_reserve(p_id text, p_cost numeric, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype; bal numeric; founder boolean;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_cost is null or p_cost <= 0 or p_cost > 100000 then raise exception 'bad cost'; end if;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.state in ('done','failed','cancelled','lost') then
    return jsonb_build_object('ok', false, 'error', 'terminal', 'state', j.state);
  end if;
  -- IDEMPOTENT ON THE JOB ID, and the row lock above is what makes it safe under
  -- a duplicate delivery: the second caller waits, then sees the reservation.
  if j.billing <> 'none' then
    return jsonb_build_object('ok', true, 'cost', j.cost, 'billing', j.billing, 'repeat', true);
  end if;
  select exists(select 1 from private.founders where user_id = j.uid) into founder;
  if founder then
    -- NO DEBIT AND NO LEDGER ROW, and `exempt` is a state of its own so the
    -- refund path can refuse it. use_credits does not debit a founder while
    -- credit_back has no founder check, so a reserve/refund round trip on one
    -- MINTS credits out of nothing.
    update public.edit_jobs set billing='exempt', cost=0, state='routing', updated_at=now() where id=p_id;
    return jsonb_build_object('ok', true, 'cost', 0, 'billing', 'exempt');
  end if;
  insert into public.credits (user_id, balance) values (j.uid, 20) on conflict (user_id) do nothing;
  update public.credits set balance = balance - p_cost, updated_at = now()
    where user_id = j.uid and balance >= p_cost returning balance into bal;
  if bal is null then
    update public.edit_jobs set state='failed',
      error = jsonb_build_object('kind','Insufficient','phase','reserve'), updated_at=now()
     where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;
  insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
    values (j.uid, 'edit', p_id, 'reserve', -p_cost, bal)
    on conflict on constraint credit_events_once do nothing;
  update public.edit_jobs set billing='reserved', cost=p_cost, state='routing', updated_at=now() where id=p_id;
  return jsonb_build_object('ok', true, 'cost', p_cost, 'balance', bal, 'billing', 'reserved');
end; $$;

-- ── LEASE: CLAIM ──────────────────────────────────────────────────────────
create or replace function public.edit_claim(p_id text, p_owner text, p_ttl int, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
     and (lease_owner is null or lease_expires_at < now())
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'claimed', true, 'state', j.state, 'billing', j.billing);
  end if;
  -- A SECOND DELIVERY FINDS NOTHING TO CLAIM, and it is told WHY rather than
  -- being handed a bare false: an already-leased job and a terminal one need
  -- opposite reactions from the consumer.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'claimed', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'claimed', false, 'state', j.state,
    'error', case when j.needs_review then 'needs-review'
                  when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  else 'leased' end);
end; $$;

-- ── LEASE: HEARTBEAT ──────────────────────────────────────────────────────
-- It renews the lease AND delivers the cancel signal, in one round trip. The
-- consumer is already talking to Postgres every 30s; a separate cancel poll
-- would be a second trip asking a question this answer already contains.
create or replace function public.edit_beat(
  p_id text, p_owner text, p_ttl int, p_phase text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

-- ── THE PUBLISH GATE ──────────────────────────────────────────────────────
-- The last check before anything is written. A consumer whose lease was stolen,
-- whose job was cancelled, or whose job went terminal loses here and stops.
--
-- IT EXTENDS THE LEASE AND THAT IS NOT EXTRA EXECUTION TIME. The lease says who
-- may act; the consumer's own budget says how long it may run, is shorter, and
-- is enforced separately. Extending one has never granted the other.
create or replace function public.edit_may_publish(p_id text, p_owner text, p_ttl int, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

-- ── DEPLOYMENT IDENTITY ───────────────────────────────────────────────────
-- Recorded as each publish operation lands, so a job that dies mid-publish can
-- be reconciled by COMPARISON rather than by guessing. Every argument is
-- optional and merges, so one call site can report one fact.
create or replace function public.edit_publish_mark(
  p_id text, p_owner text, p_artifact_build text, p_dist_etag text,
  p_sidecar_etag text, p_source_etag text, p_worker_status int, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

-- ── THE COMMIT POINT ──────────────────────────────────────────────────────
-- Called once the site Worker upload is confirmed. Under TanStack Start the
-- dist holds no HTML and the script is what renders every document, so this is
-- the single moment the live site becomes the new build.
create or replace function public.edit_committed(p_id text, p_owner text, p_build text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  update public.edit_jobs
     set published_at = coalesce(published_at, now()),
         artifact_build = coalesce(p_build, artifact_build),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and state not in ('done','failed','cancelled','lost');
  return jsonb_build_object('ok', found);
end; $$;

-- ── FINALIZE ──────────────────────────────────────────────────────────────
-- INTERLOCKED AGAINST PUBLICATION: billing cannot finalize a publication that
-- did not commit. The mirror clause is in edit_refund.
create or replace function public.edit_finalize(p_id text, p_result jsonb, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  update public.edit_jobs
     set state = 'done',
         billing = case when billing = 'reserved' then 'finalized' else billing end,
         result = coalesce(p_result, result),
         updated_at = now()
   where id = p_id
     and published_at is not null
     and state not in ('cancelled','lost','failed')
   returning * into j;
  if found then return jsonb_build_object('ok', true, 'billing', j.billing, 'cost', j.cost); end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.published_at is null then 'not-published' else 'terminal' end);
end; $$;

-- ── REFUND ────────────────────────────────────────────────────────────────
-- Balance, ledger and job row in one transaction, and TWO refusals that are the
-- whole point:
--   published_at is not null       -> never refund a shipped edit
--   publish_started_at is not null -> needs_review, and NO refund, because
--     nobody outside can tell whether the Worker commit occurred
create or replace function public.edit_refund(p_id text, p_state text, p_note text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype; bal numeric;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_state not in ('failed','cancelled','lost') then raise exception 'bad state'; end if;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.published_at is not null then
    return jsonb_build_object('ok', false, 'error', 'published', 'state', j.state);
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
end; $$;

-- ── CANCEL ────────────────────────────────────────────────────────────────
create or replace function public.edit_cancel(p_id text, p_uid uuid, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

-- ── THE POLL READ ─────────────────────────────────────────────────────────
-- The allow-list is enforced HERE rather than in the Worker, so a route that
-- forgets to strip something has nothing to forget.
create or replace function public.edit_get(p_id text, p_uid uuid, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

-- ── THE STALE SWEEP ───────────────────────────────────────────────────────
-- A PUBLISHING JOB IS NOT AN ORDINARY LOST JOB. It goes to needs_review with the
-- money untouched; every other stale job refunds. That distinction is the whole
-- reason this is a function rather than one UPDATE.
create or replace function public.edit_sweep_lost(p_limit int, p_grace int, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare r record; n_lost int := 0; n_review int := 0; refunded numeric := 0; res jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'bad limit'; end if;
  if p_grace is null or p_grace < 30 or p_grace > 3600 then raise exception 'bad grace'; end if;
  for r in
    select id from public.edit_jobs
     where state not in ('done','failed','cancelled','lost')
       and needs_review = false
       and lease_expires_at is not null
       and lease_expires_at < now() - make_interval(secs => p_grace)
     order by lease_expires_at
     limit p_limit
  loop
    res := public.edit_refund(r.id, 'lost', 'lease expired', p_mint);
    if (res->>'error') = 'needs-review' then n_review := n_review + 1;
    else n_lost := n_lost + 1; refunded := refunded + coalesce((res->>'refunded')::numeric, 0);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'lost', n_lost, 'review', n_review, 'refunded', refunded);
end; $$;

-- ── RECONCILIATION ────────────────────────────────────────────────────────
-- The only way out of needs_review, and it takes a VERDICT rather than deciding
-- one: the caller has asked the live site for its x-site-build header and
-- compared it against artifact_build. Committed means the customer got their
-- edit and keeps the charge; not committed means they did not and are refunded.
create or replace function public.edit_reconcile(p_id text, p_committed boolean, p_note text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
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
end; $$;

revoke all on function public.edit_create(text, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.edit_reserve(text, numeric, text) from public, anon, authenticated;
revoke all on function public.edit_claim(text, text, int, text) from public, anon, authenticated;
revoke all on function public.edit_beat(text, text, int, text, text) from public, anon, authenticated;
revoke all on function public.edit_may_publish(text, text, int, text) from public, anon, authenticated;
revoke all on function public.edit_publish_mark(text, text, text, text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.edit_committed(text, text, text, text) from public, anon, authenticated;
revoke all on function public.edit_finalize(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.edit_refund(text, text, text, text) from public, anon, authenticated;
revoke all on function public.edit_cancel(text, uuid, text) from public, anon, authenticated;
revoke all on function public.edit_get(text, uuid, text) from public, anon, authenticated;
revoke all on function public.edit_sweep_lost(int, int, text) from public, anon, authenticated;
revoke all on function public.edit_reconcile(text, boolean, text, text) from public, anon, authenticated;
revoke all on function private.mint_ok(text) from public, anon, authenticated;

grant execute on function public.edit_create(text, uuid, text, text, text, text) to service_role;
grant execute on function public.edit_reserve(text, numeric, text) to service_role;
grant execute on function public.edit_claim(text, text, int, text) to service_role;
grant execute on function public.edit_beat(text, text, int, text, text) to service_role;
grant execute on function public.edit_may_publish(text, text, int, text) to service_role;
grant execute on function public.edit_publish_mark(text, text, text, text, text, text, int, text) to service_role;
grant execute on function public.edit_committed(text, text, text, text) to service_role;
grant execute on function public.edit_finalize(text, jsonb, text) to service_role;
grant execute on function public.edit_refund(text, text, text, text) to service_role;
grant execute on function public.edit_cancel(text, uuid, text) to service_role;
grant execute on function public.edit_get(text, uuid, text) to service_role;
grant execute on function public.edit_sweep_lost(int, int, text) to service_role;
grant execute on function public.edit_reconcile(text, boolean, text, text) to service_role;
