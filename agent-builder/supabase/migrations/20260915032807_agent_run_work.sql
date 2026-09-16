-- ════════════════════════════════════════════════════════════════════════════
-- THE DURABLE QUEUE.
--
-- `ctx.waitUntil` keeps work alive after the response goes out, which is the
-- right shape and the wrong durability: the work exists only as a closure in one
-- isolate, so an eviction, a deploy or a crash loses it with nothing anywhere
-- saying a run was ever meant to progress. This table is that missing sentence.
--
-- **THE ROW IS THE WORK; THE MESSAGE IS ONLY A DOORBELL.** A queue delivery
-- carries a run id and nothing else. Everything needed to execute the run —
-- whose it is, what it was asked, which agent, under what bounds — is already in
-- the log, because `agent.accept_run` writes the run, its `started` entry and
-- this row in ONE transaction before anything is acknowledged. So a lost
-- delivery costs latency and never work: the row is still there to be swept.
--
-- **ONE ROW PER RUN, AND THAT IS THE CONCURRENCY ARGUMENT.** The primary key is
-- the run id, so "this run has work outstanding" is a single fact that cannot be
-- held twice. Two duplicate deliveries, or two customers pressing resume at the
-- same moment, all converge on this one row and exactly one of them wins the
-- claim below.
--
-- **THE LEASE IS A LIVENESS CHECK, NOT A DURATION CAP.** Reclaim is decided by
-- `lease_expires_at`, never by how long a run has been going, so a job that
-- keeps beating is never taken away from however long its work honestly takes.
-- A job that dies is reclaimable one TTL later.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists agent.run_work (
  run_id            uuid primary key references agent.runs(id) on delete cascade,

  -- THE TENANT IS COPIED HERE ON PURPOSE, and it is the one copy in this schema.
  -- `agent.claim_run` answers it, so claiming the work and learning whose it is
  -- are ONE statement — a consumer never has to trust a queue message for the
  -- identity it is about to act as. It is written only by `accept_run` from the
  -- run it inserts, so the two cannot start out disagreeing.
  tenant_id         text        not null,

  -- 'start' or 'resume'. Records why the row is outstanding; it does NOT change
  -- how the work runs, because every execution continues from the stored log.
  kind              text        not null default 'start',

  enqueued_at       timestamptz not null default now(),
  attempts          integer     not null default 0,

  claimed_by        text,
  claimed_at        timestamptz,
  lease_expires_at  timestamptz,

  -- Set once the run needs no more attention. NOT the same as the run having
  -- succeeded: a run that answered, that ran out of steps, and one that cannot be
  -- resumed safely are all "nothing more to deliver".
  done_at           timestamptz,
  last_error        text,

  constraint run_work_kind_known check (kind in ('start', 'resume')),
  -- A claim is three facts that must arrive together, or "claimed" is a state
  -- that cannot be reasoned about.
  constraint run_work_claim_whole check (
    (claimed_by is null and claimed_at is null and lease_expires_at is null)
    or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null)
  )
);

-- What the sweeper asks for: outstanding work whose lease is not live. Partial,
-- because finished work is the overwhelming majority and is never swept.
create index if not exists run_work_reclaimable on agent.run_work (lease_expires_at nulls first)
  where done_at is null;

-- ── accepting work ──────────────────────────────────────────────────────────
-- ONE TRANSACTION, OR NOTHING. Three separate PostgREST calls could leave a run
-- with a log and no work row (running for ever, nothing to run it) or a work row
-- for a run with no log (claimable, unexecutable). A function body is a
-- transaction, so neither half-state can exist.
create or replace function agent.accept_run(
  p_run_id  uuid,
  p_tenant  text,
  p_entry   jsonb,
  p_kind    text default 'start'
) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare v_existing agent.run_work;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'accept_run: tenant must be a non-empty string';
  end if;
  if p_entry is null or p_entry ->> 'kind' is distinct from 'started' then
    raise exception 'accept_run: the first entry must be a "started" entry';
  end if;

  -- A REPEATED ACCEPT IS NOT AN ERROR. The caller cannot know which side of a
  -- commit its connection died on, so the same run id arriving twice must be
  -- absorbed — but only ever for the SAME tenant. The primary key is the id
  -- alone, so without the tenant predicate a retry could quietly attach to
  -- somebody else's run.
  insert into agent.runs (id, tenant_id) values (p_run_id, p_tenant)
  on conflict (id) do nothing;

  if not exists (select 1 from agent.runs where id = p_run_id and tenant_id = p_tenant) then
    raise exception 'accept_run: run % is not this tenant''s', p_run_id
      using errcode = 'insufficient_privilege';
  end if;

  -- The log's first entry. `entries_one_started` makes a second one impossible,
  -- so a retry lands here harmlessly.
  insert into agent.run_entries (run_id, seq, body) values (p_run_id, 0, p_entry)
  on conflict do nothing;

  insert into agent.run_work (run_id, tenant_id, kind)
  values (p_run_id, p_tenant, p_kind)
  on conflict (run_id) do nothing
  returning * into v_existing;

  if v_existing.run_id is null then
    select * into v_existing from agent.run_work where run_id = p_run_id;
  end if;

  return jsonb_build_object(
    'run_id', p_run_id,
    'tenant_id', p_tenant,
    'state', case
      when v_existing.done_at is not null then 'finished'
      when v_existing.claimed_by is not null and v_existing.lease_expires_at > now() then 'running'
      else 'queued' end,
    'attempts', v_existing.attempts
  );
end; $$;

-- ── asking for it again ─────────────────────────────────────────────────────
-- **A RESUME OF A RUN THAT IS ALREADY RUNNING MUST NOT TOUCH THE LEASE.** That
-- is the whole of "simultaneous resume requests must not execute the same run
-- concurrently" on the producer side: the second press is told `running` and
-- never becomes a second delivery.
create or replace function agent.requeue_run(
  p_run_id uuid,
  p_tenant text
) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare v_row agent.run_work;
begin
  -- OWNERSHIP IN THE SAME STATEMENT THAT LOCKS THE ROW. Reading the row and then
  -- comparing the tenant in the caller is the same question asked somewhere that
  -- forgetting to ask it still compiles.
  select * into v_row from agent.run_work
   where run_id = p_run_id and tenant_id = p_tenant
     for update;

  if v_row.run_id is null then
    -- NOT FOUND, NEVER FORBIDDEN: another tenant's run and a run that does not
    -- exist are the same answer, because the difference is information.
    return jsonb_build_object('state', 'not-found');
  end if;

  if v_row.claimed_by is not null and v_row.lease_expires_at > now() then
    return jsonb_build_object('state', 'running', 'attempts', v_row.attempts);
  end if;

  update agent.run_work
     set kind = 'resume', done_at = null, enqueued_at = now(), last_error = null,
         -- The attempt count starts again, because a person asking is new
         -- information and not a retry of the same failure.
         attempts = 0
   where run_id = p_run_id;

  return jsonb_build_object('state', 'queued', 'attempts', 0);
end; $$;

-- ── claiming it ─────────────────────────────────────────────────────────────
-- **THE ONE GATE THAT MAKES EXECUTION EXCLUSIVE.** Every path to running a run
-- comes through here, and it is a single conditional UPDATE: the row is taken
-- only if nobody holds a live lease on it. A duplicate delivery, a sweeper
-- racing the original worker, and two resumes all lose the same way — zero rows
-- back, and the loser does nothing.
--
-- It answers the tenant, so the caller never needs the queue message for that.
create or replace function agent.claim_run(
  p_run_id uuid,
  p_worker text,
  p_ttl_s  integer default 90
) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare v_row agent.run_work;
begin
  if p_worker is null or btrim(p_worker) = '' then
    raise exception 'claim_run: worker must be a non-empty string';
  end if;
  if p_ttl_s is null or p_ttl_s <= 0 then
    raise exception 'claim_run: ttl must be a positive number of seconds';
  end if;

  update agent.run_work
     set claimed_by = p_worker,
         claimed_at = now(),
         lease_expires_at = now() + make_interval(secs => p_ttl_s),
         attempts = attempts + 1
   where run_id = p_run_id
     and done_at is null
     and (claimed_by is null or lease_expires_at <= now())
  returning * into v_row;

  if v_row.run_id is null then return jsonb_build_object('claimed', false); end if;

  return jsonb_build_object(
    'claimed', true,
    'run_id', v_row.run_id,
    'tenant_id', v_row.tenant_id,
    'kind', v_row.kind,
    'attempts', v_row.attempts,
    'lease_expires_at', v_row.lease_expires_at
  );
end; $$;

-- ── holding it ──────────────────────────────────────────────────────────────
-- **A LOST LEASE CANNOT BE REVIVED, and that is deliberate.** Once the lease has
-- lapsed, the sweeper may already have handed this run to somebody else, and
-- there is no way from here to tell whether it has. Extending it would be a
-- guess in the one direction that produces two workers on one run — so the beat
-- refuses, the holder stops, and the run is redelivered cleanly.
--
-- The cost, stated: a worker paused longer than the TTL loses its run even if
-- nobody else wanted it. It resumes from the log, so nothing is lost but time.
create or replace function agent.beat_run(
  p_run_id uuid,
  p_worker text,
  p_ttl_s  integer default 90
) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare v_ok boolean;
begin
  update agent.run_work
     set lease_expires_at = now() + make_interval(secs => p_ttl_s)
   where run_id = p_run_id
     and claimed_by = p_worker
     and done_at is null
     and lease_expires_at > now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

-- ── letting it go ───────────────────────────────────────────────────────────
-- Two endings, and they are not the same. `p_done` means nothing more should be
-- delivered for this run; without it the row goes back to outstanding and the
-- sweeper will offer it again.
--
-- ONLY THE HOLDER MAY RELEASE. A release that ignored `claimed_by` would let a
-- worker whose lease had already been reassigned clear somebody else's claim.
create or replace function agent.release_run(
  p_run_id uuid,
  p_worker text,
  p_done   boolean default true,
  p_error  text default null
) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare v_ok boolean;
begin
  update agent.run_work
     set claimed_by = null,
         claimed_at = null,
         lease_expires_at = null,
         done_at = case when p_done then now() else null end,
         last_error = p_error
   where run_id = p_run_id
     and claimed_by = p_worker
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

-- ── finding what was dropped ────────────────────────────────────────────────
-- **SELECTED ON THE LEASE AND NEVER ON ELAPSED TIME.** A run that has been going
-- for an hour and is still beating is working; a run whose lease lapsed ten
-- seconds ago is not. Only the second is anybody's to take.
create or replace function agent.sweep_run_work(
  p_grace_s integer default 30,
  p_limit   integer default 50
) returns setof jsonb
  language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
           'run_id', run_id, 'tenant_id', tenant_id, 'kind', kind,
           'attempts', attempts, 'last_error', last_error)
    from agent.run_work
   where done_at is null
     and (claimed_by is null or lease_expires_at <= now() - make_interval(secs => p_grace_s))
   order by enqueued_at asc
   limit greatest(1, coalesce(p_limit, 50));
$$;

-- ── who may touch the queue ─────────────────────────────────────────────────
-- **THE QUEUE IS THE BACKEND'S ALONE.** A customer never needs it: everything
-- they are shown about a run is derived from the log, which they can already
-- read. So `authenticated` gets nothing here — not even SELECT — and `anon` is
-- revoked explicitly rather than left to the default.
--
-- RLS is enabled and FORCED with no policies at all, which is the strongest
-- statement available: even if a grant were added by mistake, no row matches.
--
-- **THREE WALLS, AND THE REDUNDANCY IS DELIBERATE — said out loud because a
-- mutation sweep cannot see it and the next reader deletes what nothing appears to
-- need.** MEASURED in this order, by taking them away one at a time:
--   1. the FUNCTION grant refuses first — `permission denied for function claim_run`;
--   2. with EXECUTE granted, the TABLE grant refuses — `for table run_work`;
--   3. with both granted, RLS with no policies matches no rows, so a claim comes
--      back `claimed: false` having taken nothing.
-- Only with all three gone does a customer claim work. So no single one of them is
-- load-bearing today, and that is the point: the innermost wall is the one that
-- holds when somebody widens a grant by mistake.
alter table agent.run_work enable row level security;
alter table agent.run_work force row level security;

revoke all on agent.run_work from anon, authenticated;
grant select, insert, update, delete on agent.run_work to service_role;

-- The functions are the only intended door, and they are SECURITY INVOKER: they
-- carry no privilege of their own, so granting EXECUTE to `service_role` gives
-- exactly `service_role`'s own reach and nothing more. A SECURITY DEFINER here
-- would hand every caller the owner's rights over the whole schema.
revoke all on function agent.accept_run(uuid, text, jsonb, text) from public;
revoke all on function agent.requeue_run(uuid, text) from public;
revoke all on function agent.claim_run(uuid, text, integer) from public;
revoke all on function agent.beat_run(uuid, text, integer) from public;
revoke all on function agent.release_run(uuid, text, boolean, text) from public;
revoke all on function agent.sweep_run_work(integer, integer) from public;

grant execute on function agent.accept_run(uuid, text, jsonb, text) to service_role;
grant execute on function agent.requeue_run(uuid, text) to service_role;
grant execute on function agent.claim_run(uuid, text, integer) to service_role;
grant execute on function agent.beat_run(uuid, text, integer) to service_role;
grant execute on function agent.release_run(uuid, text, boolean, text) to service_role;
grant execute on function agent.sweep_run_work(integer, integer) to service_role;
