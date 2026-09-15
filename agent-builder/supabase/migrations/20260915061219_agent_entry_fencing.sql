-- ════════════════════════════════════════════════════════════════════════════
-- FENCING THE JOURNAL: a write must present the claim it is writing under.
--
-- **WHAT THIS CLOSES, MEASURED LIVE RATHER THAN IMAGINED.** On 2026-09-15 the
-- deployed stand-in was verified end to end, and one run's log said more than the
-- checks had asked: its lease was revoked at 2 entries and the run reached 4 model
-- answers and 3 tool results before its consumer stopped. A worker learns its
-- lease is gone at its NEXT BEAT — up to `BEAT_EVERY_MS` (30 s) later — and until
-- then every write it makes lands, because the database had no idea the lease had
-- lapsed. The entries were that run's own next steps, so nothing was corrupted;
-- what was wrong is that nothing STOPPED them.
--
-- **THE GAP WAS NEVER THE GRACE PERIOD, AND WIDENING THE GRACE IS NOT THE FIX.**
-- `agent.claim_run` takes a lapsed lease with NO grace at all — the grace belongs
-- to the sweeper, which is only one of the ways a run is offered again. A
-- duplicate delivery arriving one second after a lease lapses claims it
-- immediately. So the window a grace could cover is not the window that exists,
-- and a bigger number would only make the demonstration harder to reproduce.
--
-- **THE FIX IS THAT THE DATABASE DECIDES AT WRITE TIME.** `agent.claim_run` now
-- mints a `claim_token` — a fresh uuid per claim — and `agent.append_entry` is the
-- only door into the log: it LOCKS the work row, checks the holder, the token,
-- that the work is unfinished and that the lease is still live, and inserts, all
-- in one statement's transaction. A reclaim mints a new token, so the old one is
-- dead the instant the new claim commits, and the two orderings are both safe:
-- whoever takes the row lock first wins, and the loser reads what the winner left.
--
-- **AND THE DIRECT DOOR IS CLOSED, not merely unused.** `service_role` — the role
-- the Worker runs as — loses INSERT on `agent.run_entries` altogether. A runner
-- that asked PostgREST to insert a row would be refused by a privilege rather than
-- by our own good intentions, which is the difference between a wall and a habit.
-- `agent.accept_run` and `agent.append_entry` become SECURITY DEFINER because they
-- are now the only writers; both pin `search_path` empty, qualify every name, do
-- their own authorisation, and are revoked from `public`.
--
-- **WHAT FENCING CANNOT DO, said here because it is the thing most easily
-- believed.** A tool call that has already been SENT cannot be recalled by a
-- database. The fence stops the RECORD of its result, never the action — so a
-- stale worker that fired a payment and was then refused its write leaves the run
-- with a model answer and no result, which is exactly a pending call. If that tool
-- is not `repeatable`, `replay` reports it pending and the run refuses to resume
-- (`cannot-resume`) instead of firing it again. That refusal is the guarantee;
-- fencing narrows the window in which the send can happen and closes the one in
-- which the log can be written behind the holder's back.
--
-- **THE COST, STATED.** A result that a stale worker really did obtain is now
-- thrown away rather than recorded, so a run that would have completed can end up
-- waiting for a person. That is the safe direction — exclusivity over completion —
-- and it is the trade this migration makes on purpose.
-- ════════════════════════════════════════════════════════════════════════════

-- ── the token ───────────────────────────────────────────────────────────────
-- WHY A TOKEN AND NOT JUST THE WORKER NAME. A name says *who*; a token says
-- *which claim*. They differ in the case that matters: a run reclaimed and then
-- reclaimed back, or any future path that reuses a worker identity, would let a
-- writer holding an old claim look like the current holder. The token is minted
-- per claim, so "the claim I was given" is a fact the database can check rather
-- than one the caller asserts.
alter table agent.run_work add column if not exists claim_token uuid;

-- Existing claims get one, so the constraint below can be stated without
-- exceptions. Backfilled rather than left null because a claimed row with no
-- token would be a holder that can never write again.
update agent.run_work set claim_token = gen_random_uuid()
 where claimed_by is not null and claim_token is null;

-- A claim is now FOUR facts that arrive together. Same argument as before: a
-- partially-claimed row is a state nothing can reason about.
alter table agent.run_work drop constraint if exists run_work_claim_whole;
alter table agent.run_work add constraint run_work_claim_whole check (
  (claimed_by is null and claimed_at is null and lease_expires_at is null and claim_token is null)
  or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null and claim_token is not null)
);

-- ── claiming mints the token ────────────────────────────────────────────────
-- Unchanged in every other respect: still ONE conditional UPDATE, still the only
-- gate on execution, still answers the tenant so a consumer never trusts a
-- message for an identity. The token rides out on the same answer, because a
-- claimer that had to ask for it separately could act between the two.
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
         -- A NEW TOKEN EVERY TIME, including when the same worker name claims a
         -- run it held before. The token identifies the CLAIM, not the claimer.
         claim_token = gen_random_uuid(),
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
    'claim_token', v_row.claim_token,
    'lease_expires_at', v_row.lease_expires_at
  );
end; $$;

-- ── holding it, with the token ──────────────────────────────────────────────
-- **THE OLD SIGNATURE IS DROPPED, not left beside this one.** An unfenced
-- `beat_run(uuid, text, integer)` would be exactly the bypass door this migration
-- exists to close: a holder could keep a lease alive without proving which claim
-- it holds. Two overloads would also make a named-argument call ambiguous.
--
-- This is ALSO the ownership check the runner asks before it starts anything new,
-- which is why it renews as well as answers: the question "may I still work on
-- this" and the act of saying "I am still here" are the same fact.
drop function if exists agent.beat_run(uuid, text, integer);

create or replace function agent.beat_run(
  p_run_id uuid,
  p_worker text,
  p_token  uuid,
  p_ttl_s  integer default 90
) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare v_ok boolean;
begin
  if p_token is null then
    raise exception 'beat_run: the claim token is required';
  end if;
  update agent.run_work
     set lease_expires_at = now() + make_interval(secs => p_ttl_s)
   where run_id = p_run_id
     and claimed_by = p_worker
     and claim_token = p_token
     and done_at is null
     and lease_expires_at > now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

-- ── letting it go, with the token ───────────────────────────────────────────
-- **A LAPSED HOLDER MAY NOT END A RUN.** The old version was gated on
-- `claimed_by` alone, so a worker whose lease had expired — but whose row nobody
-- had reclaimed yet — could still mark the work done. That is the stale-writer
-- problem one key over: the run's log would be left mid-flight with the queue
-- saying there was nothing more to do.
--
-- THE COST, NAMED: a run that finishes at the exact moment its lease lapses is
-- redelivered once and then closed as `already-finished`. One extra delivery that
-- reads the log and does nothing, which is the cheap side of the trade.
drop function if exists agent.release_run(uuid, text, boolean, text);

create or replace function agent.release_run(
  p_run_id uuid,
  p_worker text,
  p_token  uuid,
  p_done   boolean default true,
  p_error  text default null
) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare v_ok boolean;
begin
  if p_token is null then
    raise exception 'release_run: the claim token is required';
  end if;
  update agent.run_work
     set claimed_by = null,
         claimed_at = null,
         lease_expires_at = null,
         claim_token = null,
         done_at = case when p_done then now() else null end,
         last_error = p_error
   where run_id = p_run_id
     and claimed_by = p_worker
     and claim_token = p_token
     and lease_expires_at > now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

-- ── the only door into the log ──────────────────────────────────────────────
-- **THE VALIDATION AND THE INSERT ARE ONE TRANSACTION, and the lock is the work
-- row every claim and reclaim already takes.** Checking the lease over PostgREST
-- and then inserting would be two statements with a reclaim fitting between them
-- — the race this is built to remove, moved up a layer.
--
-- **THE ANSWER IS A SHAPE, NEVER A BOOLEAN.** Nine outcomes, each needing
-- something different done about it, and four of them are refusals that a caller
-- must not confuse:
--
--   stored        the entry is in the log at this seq
--   already       THIS EXACT entry was already recorded — a retry, and safe
--   conflict      the same logical slot holds a DIFFERENT entry: somebody else wrote it
--   position      that seq is taken by something else; the caller's counter is behind
--   no-work       no work row (retention took it, or it never existed)
--   finished      the work is done; nothing more may be written under it
--   not-holder    this worker does not hold the claim
--   bad-token     right worker, wrong claim — a reclaim happened
--   lease-expired the claim lapsed; somebody else may already have it
--
-- **WHY `already` IS A SUCCESS AND `conflict` IS NOT.** A network drop after
-- Postgres committed leaves the caller unable to tell which side of the commit it
-- died on, and killing a run over that would throw away a model answer already
-- paid for. So an IDENTICAL body is "already recorded" and the caller carries on.
-- A DIFFERENT body at the same logical position is the opposite signal: two
-- writers produced two answers for one step, which no retry can explain. Reading
-- the second as the first is how a double execution disappears from the record,
-- so the bodies are COMPARED (`jsonb` equality, so key order and whitespace do not
-- matter) and the answers are kept apart.
--
-- The comparison is exact by construction rather than by luck: a retry replays the
-- same entry object and its JSON is byte-identical, while a second worker's redo
-- carries its own `at` and `ms` and cannot be.
--
-- SECURITY DEFINER, and this is the one place in the schema that needs it: after
-- the revoke below, no caller can insert into `agent.run_entries` at all, so the
-- privilege has to come from the function. What makes that safe is that the body
-- is fixed, `search_path` is pinned empty with every name qualified, EXECUTE is
-- revoked from `public`, and the function authorises every call itself.
create or replace function agent.append_entry(
  p_run_id uuid,
  p_seq    integer,
  p_body   jsonb,
  p_worker text,
  p_token  uuid
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_work agent.run_work;
  v_kind text;
  v_step integer;
  v_idx  integer;
  v_seq  integer;
  v_body jsonb;
begin
  -- The arguments are REFUSED rather than coerced. A null token read as "no token
  -- required" is the whole gate gone.
  if p_worker is null or btrim(p_worker) = '' then
    raise exception 'append_entry: worker must be a non-empty string';
  end if;
  if p_token is null then
    raise exception 'append_entry: the claim token is required';
  end if;
  if p_seq is null or p_seq < 0 then
    raise exception 'append_entry: seq must be a non-negative integer';
  end if;
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    raise exception 'append_entry: the entry must be a JSON object';
  end if;

  -- **THE LOCK.** `for update` on the work row, which is the same row
  -- `claim_run`'s conditional UPDATE takes — so a reclaim either commits before
  -- this lock is granted (and the checks below read the new token) or waits behind
  -- it (and reads a log this write is already in). There is no third ordering.
  select * into v_work from agent.run_work where run_id = p_run_id for update;

  if v_work.run_id is null then
    return jsonb_build_object('ok', false, 'why', 'no-work');
  end if;
  if v_work.done_at is not null then
    return jsonb_build_object('ok', false, 'why', 'finished');
  end if;
  if v_work.claimed_by is null or v_work.claimed_by is distinct from p_worker then
    return jsonb_build_object('ok', false, 'why', 'not-holder');
  end if;
  if v_work.claim_token is null or v_work.claim_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'why', 'bad-token');
  end if;
  if v_work.lease_expires_at is null or v_work.lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'why', 'lease-expired');
  end if;

  v_kind := p_body ->> 'kind';
  v_step := nullif(p_body ->> 'step', '')::integer;
  v_idx  := nullif(p_body ->> 'index', '')::integer;

  -- THE LOGICAL SLOT IS LOOKED FOR, NOT CAUGHT. A unique violation says only
  -- "something is there"; to tell a retry from a second writer the stored body has
  -- to be read and compared, and the four indexes below are the same four the
  -- table enforces — asked here so the ANSWER can be precise.
  if v_kind in ('started', 'stopped') then
    select e.seq, e.body into v_seq, v_body from agent.run_entries e
     where e.run_id = p_run_id and e.kind = v_kind limit 1;
  elsif v_kind = 'model' then
    select e.seq, e.body into v_seq, v_body from agent.run_entries e
     where e.run_id = p_run_id and e.kind = 'model' and e.step = v_step limit 1;
  elsif v_kind = 'tool' then
    select e.seq, e.body into v_seq, v_body from agent.run_entries e
     where e.run_id = p_run_id and e.kind = 'tool' and e.step = v_step and e.idx = v_idx limit 1;
  end if;
  -- An entry of an unknown kind matches no branch and falls through to the insert,
  -- where `entry_kind_known` refuses it BY NAME. A malformed entry is a bug in the
  -- caller and must raise, never become one of the nine answers above.

  if v_seq is not null then
    if v_body = p_body then
      return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);
    end if;
    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);
  end if;

  -- The POSITIONAL key, which is a different question: this slot is taken by
  -- something that is not this entry, so the caller's counter is behind and it can
  -- simply move up. Answered apart from `conflict` because the two need opposite
  -- things done about them.
  if exists (select 1 from agent.run_entries e where e.run_id = p_run_id and e.seq = p_seq) then
    return jsonb_build_object('ok', false, 'why', 'position', 'seq', p_seq);
  end if;

  begin
    insert into agent.run_entries (run_id, seq, body) values (p_run_id, p_seq, p_body);
    return jsonb_build_object('ok', true, 'stored', true, 'seq', p_seq);
  exception when unique_violation then
    -- REACHABLE, AND NAMED RATHER THAN ASSUMED AWAY. The work-row lock serialises
    -- every FENCED write for this run, but `accept_run` writes seq 0 without it, so
    -- two callers can still collide there. Ask the same two questions of whatever
    -- landed instead of guessing which index complained.
    select e.seq, e.body into v_seq, v_body from agent.run_entries e
     where e.run_id = p_run_id and e.seq = p_seq;
    if v_seq is not null and v_body = p_body then
      return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);
    end if;
    if v_seq is not null then
      return jsonb_build_object('ok', false, 'why', 'position', 'seq', p_seq);
    end if;
    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', null);
  end;
end; $$;

-- ── accept_run writes the log's first entry, so it needs the privilege too ──
-- IDENTICAL BODY, one word changed: `security invoker` → `security definer`. It is
-- reprinted whole rather than patched because a function is replaced whole, and a
-- reader comparing this against the previous migration should see every line it is
-- being asked to trust.
--
-- The comment it replaces said a definer here "would hand every caller the owner's
-- rights over the whole schema". That is true of a definer function that executes
-- caller-supplied SQL, and false of this one: the body is fixed, every name is
-- schema-qualified under an empty `search_path`, EXECUTE is revoked from `public`
-- and granted only to `service_role`, and the tenant check inside it is unchanged.
-- What made the old wording moot is the revoke below — with no INSERT on the log
-- for anybody, a function is the only way an entry can be written at all.
create or replace function agent.accept_run(
  p_run_id  uuid,
  p_tenant  text,
  p_entry   jsonb,
  p_kind    text default 'start'
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_existing agent.run_work;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'accept_run: tenant must be a non-empty string';
  end if;
  if p_entry is null or p_entry ->> 'kind' is distinct from 'started' then
    raise exception 'accept_run: the first entry must be a "started" entry';
  end if;

  insert into agent.runs (id, tenant_id) values (p_run_id, p_tenant)
  on conflict (id) do nothing;

  if not exists (select 1 from agent.runs where id = p_run_id and tenant_id = p_tenant) then
    raise exception 'accept_run: run % is not this tenant''s', p_run_id
      using errcode = 'insufficient_privilege';
  end if;

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

-- ── the direct door, closed ─────────────────────────────────────────────────
-- **THIS IS THE LINE THAT MAKES THE FENCE UNBYPASSABLE FROM THE RUNTIME.** The
-- Worker holds the service key and therefore acts as `service_role`; with INSERT
-- revoked, `POST /rest/v1/run_entries` answers `permission denied` however the
-- code is written. Before this, the fence would have been a function the runner
-- was merely expected to prefer.
--
-- SELECT STAYS. Reading the log is how a run is resumed and how a customer is
-- shown its progress, and reading was never the exposure.
--
-- THE LIMIT, STATED PLAINLY: this is a GRANT, so the table's owner and any
-- superuser can still insert directly. That is the same posture the append-only
-- rule already has, where the triggers exist to stop the owner doing by hand what
-- the grant stops everybody else doing at all. Nothing that runs in production is
-- the owner.
revoke insert on agent.run_entries from service_role;

-- ── who may open the new door ───────────────────────────────────────────────
revoke all on function agent.append_entry(uuid, integer, jsonb, text, uuid) from public;
revoke all on function agent.beat_run(uuid, text, uuid, integer) from public;
revoke all on function agent.release_run(uuid, text, uuid, boolean, text) from public;
revoke all on function agent.accept_run(uuid, text, jsonb, text) from public;
revoke all on function agent.claim_run(uuid, text, integer) from public;

grant execute on function agent.append_entry(uuid, integer, jsonb, text, uuid) to service_role;
grant execute on function agent.beat_run(uuid, text, uuid, integer) to service_role;
grant execute on function agent.release_run(uuid, text, uuid, boolean, text) to service_role;
grant execute on function agent.accept_run(uuid, text, jsonb, text) to service_role;
grant execute on function agent.claim_run(uuid, text, integer) to service_role;

comment on function agent.append_entry(uuid, integer, jsonb, text, uuid) is
  'The only door into agent.run_entries. Locks the work row and checks holder, token, unfinished and lease before inserting.';
comment on column agent.run_work.claim_token is
  'Minted fresh by claim_run. A journal write must present it, so a reclaim kills the previous holder''s writes at once.';
