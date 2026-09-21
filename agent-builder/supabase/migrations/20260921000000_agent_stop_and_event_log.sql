-- ══════════════════════════════════════════════════════════════════════════
-- STOPPING WORK, AND READING WHAT CAME IN
--
-- Three things, and every one of them was found by asking what a SCREEN would need to
-- draw rather than by reading the code that already exists. The cancellation and the
-- inbound endpoints have been complete on the backend for days; what was missing is the
-- part a person can see, and these are the gaps that opens up.
--
--   1. WHAT AN EVENT DID IS NOT RECORDED. `agent.dispatch_events` already counts what it
--      filed and what it woke, in the transaction that stamps `handled_at` — and it
--      returns them to the cron and writes neither. So "this event arrived and started
--      nothing" is not derivable from the row, and *ignored* and *received* are one state.
--   2. NOTHING CAN LIST EVENTS. There is no function and no view, and `agent.events` has
--      no `select` for `service_role` at all — every service_role grant in
--      `20260918050000` is `grant execute on function`. So the site could not read the
--      table even if it asked.
--   3. A CANCELLATION LEAVES A MID-STEP EXECUTION OPEN FOR EVER. `agent.cancel_run` sets
--      `finished_at` only where the execution was WAITING, and `runner.mjs`'s
--      `already-finished` wall — written precisely to stop a finished execution being
--      re-delivered for ever — is keyed on that field. So the one shape it cannot see is
--      a run somebody stopped while it was working.
--
-- ⚠ **WHAT IS DELIBERATELY NOT HERE: a record of a REFUSED delivery.** `/deliver/<id>` is
-- unauthenticated by construction — that is the whole point of the signature — so a table
-- anybody can write to by POSTing rubbish at an invented id is storage amplification with
-- a customer's name on it. A refused delivery is turned away before anything is written
-- and the reason goes to the log, which is where an operator wants it. The screen says so
-- in as many words rather than showing an empty list that implies nothing arrived.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. WHAT AN EVENT DID, ON THE EVENT ─────────────────────────────────────
--
-- ⚠ **COUNTS AND NOT A WORD.** A `status` column would be a second thing that can
-- disagree with the rows it is about: *ignored* is `handled_at is not null and filed = 0
-- and woke = 0`, which is derivable and cannot drift. And they are NOT NULL DEFAULT 0
-- with `handled_at` as the discriminator, so an event still in the queue reads as
-- unhandled rather than as one that started nothing.

alter table agent.events
  add column if not exists filed integer not null default 0,
  add column if not exists woke  integer not null default 0;

comment on column agent.events.filed is
  'How many executions this event filed. Meaningless until handled_at is set — before that it is the default, not an answer.';
comment on column agent.events.woke is
  'How many suspended executions heard this event. Same rule: handled_at is what makes it an answer.';

-- ── 2. THE DISPATCHER WRITES THEM ──────────────────────────────────────────
--
-- The body is `20260918050000`'s, with the counts written in the same statement that
-- stamps `handled_at` — so an event is handled and accounted for in one commit, and
-- there is no window in which it reads as handled and having done nothing.

create or replace function agent.dispatch_events(p_limit integer default 25)
returns setof jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  e        record;
  a        record;
  w        record;
  v_run    uuid;
  v_answer jsonb;
  v_filed  integer;
  v_woke   integer;
  v_rung   jsonb;
begin
  for e in
    select * from agent.events
     where handled_at is null
     order by at asc
     limit greatest(1, coalesce(p_limit, 25))
     -- ⚠ TWO TICKS NEVER TAKE THE SAME EVENT. The `handled_at` stamp is what makes an
     -- event handled once; this is what stops two ticks racing to set it.
     for update skip locked
  loop
    v_filed := 0; v_woke := 0; v_rung := '[]'::jsonb;

    -- ── what it triggers ───────────────────────────────────────────────────
    for a in
      select * from agent.automations
       where tenant_id = e.tenant_id and agent_id = e.agent_id
         and on_event = e.name and enabled
       order by created_at asc
    loop
      v_run := gen_random_uuid();
      v_answer := agent.accept_automation_run(
        e.tenant_id, a.id, v_run, 'event', null, '{}'::jsonb, e.id, e.depth);
      if coalesce((v_answer -> 'ok')::boolean, false) then
        v_filed := v_filed + 1;
        v_rung := v_rung || to_jsonb((v_answer ->> 'run_id')::text);
      end if;
    end loop;

    -- ── what was waiting for it ────────────────────────────────────────────
    -- ⚠ **AN EVENT IS HEARD BY A SUSPENDED EXECUTION OF THE SAME AGENT, waiting on this
    -- NAME, that has not heard one at that step already.** The `heard ? step` test is what
    -- makes it exactly once: a second event of the same name leaves a suspended execution
    -- that has already heard one alone, because that execution's next delivery is what
    -- consumes it.
    for w in
      select ar.* from agent.automation_runs ar
       where ar.tenant_id = e.tenant_id
         and ar.agent_id = e.agent_id
         and ar.finished_at is null
         and ar.waiting ->> 'kind' = 'event'
         and ar.waiting ->> 'name' = e.name
         and not (ar.heard ? (ar.waiting ->> 'step'))
       order by ar.created_at asc
       for update skip locked
    loop
      update agent.automation_runs
         set heard = heard || jsonb_build_object(
               w.waiting ->> 'step',
               jsonb_build_object('event_id', e.id, 'name', e.name,
                                  'payload', e.payload, 'at', e.at))
       where id = w.id;
      -- THE SAME DOOR A PERSON'S APPROVAL USES, which is what makes an event wait need no
      -- second recovery path: `requeue_run` puts the work back and the cron is the belt.
      perform agent.requeue_run(w.id, e.tenant_id);
      v_woke := v_woke + 1;
      v_rung := v_rung || to_jsonb(w.id::text);
    end loop;

    -- ⚠ **THE COUNTS GO IN WITH THE STAMP, IN ONE STATEMENT.** `handled_at` is what makes
    -- them an answer rather than a default, so writing them separately would leave a
    -- window in which an event reads as handled and as having done nothing.
    update agent.events
       set handled_at = now(), filed = v_filed, woke = v_woke
     where id = e.id;
    if e.source = 'webhook' then
      update agent.webhooks set last_at = now()
       where tenant_id = e.tenant_id and agent_id = e.agent_id and event_name = e.name;
    end if;

    return next jsonb_build_object(
      'event_id', e.id, 'name', e.name, 'filed', v_filed, 'woke', v_woke, 'ring', v_rung);
  end loop;
end; $$;

comment on function agent.dispatch_events(integer) is
  'File an execution for every automation an event triggers, wake every suspended execution waiting for it, and stamp it handled with what it did — all in one transaction per event, because the stamp is what makes both happen exactly once.';

-- ── 3. READING WHAT CAME IN ────────────────────────────────────────────────
--
-- ⚠ **THE RUNS IT STARTED RIDE ON EACH ROW, and that is the difference between a log and
-- a log somebody can act on.** "An event arrived" is not a thing anybody can do anything
-- about; "this event started that run" is one click from the execution's own history.
-- `agent.automation_runs.event_id` has carried it since `20260918050000` and nothing has
-- ever read it.
--
-- **THE PAYLOAD IS NOT SELECTED, DELIBERATELY.** A list is a list; a body is somebody
-- else's text, bounded at 64 KiB per delivery, and twenty-five of them is a megabyte to
-- draw a table of names. An event-triggered execution gets its own payload through its
-- own run, which is where it is useful.
--
-- The tenant AND the agent are both in the filter, so this cannot answer across accounts
-- however it is called — the same posture every other function here has.

create or replace function agent.list_events(
  p_tenant   text,
  p_agent_id uuid,
  p_limit    integer default 25
) returns jsonb
  language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'name', x.name, 'source', x.source,
           'at', x.at, 'handled_at', x.handled_at,
           'filed', x.filed, 'woke', x.woke,
           'runs', x.runs
         ) order by x.at desc), '[]'::jsonb)
    from (
      select e.id, e.name, e.source, e.at, e.handled_at, e.filed, e.woke,
             -- ⚠ **EACH RUN NAMES ITS AUTOMATION, because the id alone cannot be opened.**
             -- An execution is read through its AUTOMATION's history, so a list of bare run
             -- ids would put *"it started two runs"* on a screen with no way to reach either —
             -- which is the requirement's *show the relevant execution* satisfied in words and
             -- not in a control. Both, and the screen goes from an arrival to the run.
             coalesce((
               select jsonb_agg(jsonb_build_object('id', ar.id, 'automation', ar.automation_id)
                                order by ar.created_at asc)
                 from agent.automation_runs ar
                where ar.event_id = e.id and ar.tenant_id = e.tenant_id
             ), '[]'::jsonb) as runs
        from agent.events e
       where e.tenant_id = p_tenant and e.agent_id = p_agent_id
       order by e.at desc
       limit greatest(1, least(200, coalesce(p_limit, 25)))
    ) x;
$$;

comment on function agent.list_events(text, uuid, integer) is
  'One agent''s recent events, newest first, each with how many executions it filed, how many suspended executions it woke, and the ids of the runs it started. No payloads: a list is a list.';

-- ── 4. A CANCELLATION CLOSES THE EXECUTION ─────────────────────────────────
--
-- The body is `20260918030000`'s. **The one change is the `where` on the execution
-- update**, and the reasoning is in the comment beside it.

create or replace function agent.cancel_run(
  p_tenant text,
  p_run_id uuid,
  p_by     text,
  p_reason text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_run     agent.runs%rowtype;
  v_seq     integer;
  v_steps   integer;
  v_tools   integer;
  v_pending integer;
  v_waited  boolean := false;
  v_held    boolean := false;
begin
  if p_by is null or btrim(p_by) = '' then
    return jsonb_build_object('ok', false, 'error', 'no-decider');
  end if;
  select * into v_run from agent.runs r
   where r.id = p_run_id and r.tenant_id = p_tenant
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-run');
  end if;

  -- ⚠ **WHAT ALREADY COMPLETED IS COUNTED BEFORE ANYTHING IS WRITTEN, and it is reported
  -- whatever happens next.** *Don't claim completed effects were undone*: a cancellation is
  -- the work stopping, not the work coming back, and the one honest thing to say about a
  -- cancelled run is how far it got. An automation execution's steps are counted off its
  -- own outcomes, with a PAUSED one left out — a step holding for a person has not
  -- completed, and over-claiming is the wrong direction for the one field built to be
  -- honest about what happened.
  select count(*) filter (where e.kind = 'model'), count(*) filter (where e.kind = 'tool'),
         coalesce(max(e.seq), -1) + 1
    into v_steps, v_tools, v_seq
    from agent.run_entries e where e.run_id = p_run_id;
  v_steps := v_steps + coalesce((
    select count(*) from agent.automation_runs ar,
           lateral jsonb_array_elements(ar.outcomes) o
     where ar.id = p_run_id and jsonb_typeof(ar.outcomes) = 'array'
       and (o ->> 'outcome') is distinct from 'waiting'), 0);

  -- A RUN THAT HAS ALREADY STOPPED IS NOT CANCELLED AGAIN. Its stop is what it ended as, and
  -- overwriting it would lose that — so this answers what really happened.
  if exists (select 1 from agent.run_entries e where e.run_id = p_run_id and e.kind = 'stopped') then
    return jsonb_build_object('ok', true, 'repeat', true, 'run', p_run_id,
                              'alreadyStopped', true, 'stop', v_run.stop,
                              'completedSteps', v_steps, 'completedCalls', v_tools);
  end if;

  -- ⚠ **THE ENTRY'S SHAPE IS `stoppedEntry`'S AND IS NOT INVENTED HERE.** `{kind, at, stop}`,
  -- with everything about the stop INSIDE the nested object — because `agent.project_entry`
  -- reads `new.body -> 'stop'` and nothing else.
  insert into agent.run_entries (run_id, seq, body)
  values (p_run_id, v_seq, jsonb_build_object(
    'kind', 'stopped', 'at', extract(epoch from now()) * 1000,
    'stop', jsonb_build_object(
      'reason', 'cancelled',
      'cancelledBy', p_by,
      'note', p_reason,
      'completedSteps', v_steps, 'completedCalls', v_tools)));

  /*
   * ⚠ **WAS A WORKER REALLY ON IT — which is what separates *the cancellation is recorded*
   * from *the execution has actually stopped*, and they are not the same moment.**
   *
   * The entry above is written synchronously, so the run reads `stopped` the instant this
   * returns. What can lag is a process that was already inside a model call or a tool batch:
   * the fence stops it at its NEXT checkpoint, so whatever step it had started may finish
   * before it learns it no longer holds the run. That window is one model call plus one tool
   * batch and is this engine's own recorded limit.
   *
   * So the fact a caller needs is whether a claim was LIVE, and `row_count` on the release
   * below cannot say it: that update also matches a queued row nobody has picked up, where
   * nothing is in flight at all. Read first, the same way `v_waited` is, and for the same
   * reason — the update answers a different question from the one asked.
   */
  select (w.claimed_by is not null and w.lease_expires_at > now()) into v_held
    from agent.run_work w where w.run_id = p_run_id;

  -- PENDING WORK STOPS: the work row is released and marked done, so nothing is delivered
  -- again and whoever holds it fails its next checkpoint.
  update agent.run_work w
     set claimed_by = null, claimed_at = null, lease_expires_at = null, claim_token = null,
         done_at = now(), last_error = 'cancelled'
   where w.run_id = p_run_id and w.done_at is null;

  /**
   * ⚠ **THE EXECUTION IS CLOSED WHETHER OR NOT IT WAS WAITING, and the `where` used to say
   * `waiting is not null or wait_until is not null`.**
   *
   * That was right about waits and wrong about everything else. An execution cancelled
   * mid-step kept `finished_at = NULL` for ever — nothing else could ever set it, because
   * `finish_automation_run` is fenced on the claim token this function has just cleared, so
   * the holder's own finish is refused at its next checkpoint. And `runner.mjs`'s
   * `already-finished` wall, written precisely to stop a finished execution being delivered
   * and re-run for ever, is keyed on `finished_at` — so the one shape that wall could not see
   * was a run somebody had stopped while it was working.
   *
   * `releasedWait` still answers whether there was a WAIT to release, which is a different
   * question and the one a caller asked: it is the difference between stopping something
   * that was holding for a person and stopping something that was working.
   */
  -- ⚠ **`releasedWait` IS READ BEFORE THE UPDATE, because the update no longer answers it.**
  -- It used to be the `found` of an update whose `where` WAS the question; with the `where`
  -- widened, `found` would mean "this run has an execution row" — a different fact, and one
  -- every automation execution satisfies. A row that does not exist leaves this NULL (an
  -- agent-loop run has no execution), which the `coalesce` in the answer reads as false.
  select (ar.waiting is not null or ar.wait_until is not null) into v_waited
    from agent.automation_runs ar where ar.id = p_run_id;
  update agent.automation_runs ar
     set waiting = null, wait_until = null, finished_at = coalesce(ar.finished_at, now())
   where ar.id = p_run_id;

  -- AND EVERY REQUEST STILL WAITING IS WITHDRAWN, so nobody is asked to answer for a run that
  -- has stopped. This is a revocation rather than a rejection: nobody refused the call.
  update agent.tool_approvals a
     set verdict = 'revoked', decided_at = now(), decided_by = p_by,
         note = coalesce(p_reason, 'the run was cancelled')
   where a.run_id = p_run_id and a.verdict is null;
  get diagnostics v_pending = row_count;

  return jsonb_build_object('ok', true, 'repeat', false, 'run', p_run_id,
    'completedSteps', v_steps, 'completedCalls', v_tools,
    'withdrewApprovals', v_pending, 'releasedWait', coalesce(v_waited, false),
    -- ⚠ **A ROW THAT DOES NOT EXIST LEAVES THIS NULL AND THE `coalesce` READS IT AS FALSE**,
    -- which is right: no work row means nothing was working on it. The same reading covers a
    -- lease that has lapsed — the holder is already walled off by the fence, so there is
    -- nothing in flight to warn about.
    'heldByWorker', coalesce(v_held, false),
    -- ⚠ SAID IN THE ANSWER AS WELL AS IN THE STOP, because a caller that reads only the
    -- answer would otherwise have nothing saying the work that finished stays finished.
    'say', 'stopped — what had already run has already run and was not undone');
end; $$;

comment on function agent.cancel_run(text, uuid, text, text) is
  'Stop one run: release its work, close its execution, clear any wait, withdraw anything waiting for a person, and record how far it got. Nothing already done is undone.';

-- ── 5. WHO MAY RUN ANY OF IT ───────────────────────────────────────────────
--
-- ⚠ **`agent.events` HAD NO `select` FOR `service_role` AT ALL**, which is why the reader
-- above is a `security definer` FUNCTION rather than a table read: every grant in
-- `20260918050000` is `grant execute on function`, so the site's own role cannot see the
-- table. The function is the narrower answer anyway — it takes the tenant and the agent as
-- arguments and cannot be asked for anything else.

revoke all on function agent.list_events(text, uuid, integer) from public;
grant execute on function agent.list_events(text, uuid, integer) to service_role;
