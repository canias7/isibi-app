-- ═══════════════════════════════════════════════════════════════════════════════
-- EXPIRY, REVOCATION AND CANCELLATION (2026-09-17)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Owner: *"Approval must identify the exact action and arguments. Changed actions require
-- fresh approval. Expired, rejected, or revoked approvals cannot execute. Keep accepted runs'
-- recorded configuration stable, but define explicit permission revocation separately and
-- enforce it before subsequent actions. Cancellation must stop pending work and future steps,
-- release waits, and record what already completed. Don't claim completed effects were
-- undone."*
--
-- ⚠ **THREE THINGS, AND COLLAPSING ANY TWO LOSES A REAL DISTINCTION.**
--
--   * **EXPIRY** is nobody having answered in time. Nothing was decided.
--   * **REVOCATION OF ONE APPROVAL** is somebody taking back a decision, or withdrawing a
--     request before it was answered. A person acted.
--   * **REVOCATION OF A PERMISSION** is somebody taking a TOOL away from an agent — which is
--     about every future call rather than about one, and is deliberately NOT the same as
--     unticking it in the settings form. Unticking changes what the NEXT run is accepted
--     with; revoking reaches a run already going.
--   * **CANCELLATION** is stopping the work. It is about the RUN, not about a permission.
--
-- And a fifth thing that is NOT any of them: **an effect that already happened stays
-- happened.** None of these undoes anything, and every answer below says what had already
-- completed rather than implying it was rolled back.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. AN APPROVAL REQUEST HAS A WINDOW
-- ──────────────────────────────────────────────────────────────────────────

alter table agent.tool_approvals
  add column if not exists expires_at timestamptz;

-- ⚠ **THE VERDICT SET GAINS `revoked`, AND `expired` IS DELIBERATELY NOT A VERDICT.** A
-- verdict is something a person DID; expiry is something that happened to a request nobody
-- answered, and writing it into the same column would mean a background job had to go round
-- stamping rows — a second writer, on a fact the clock already states. So expiry is DERIVED
-- from `expires_at` and a pending row is pending until it is read.
alter table agent.tool_approvals drop constraint if exists tool_approvals_verdict_check;
alter table agent.tool_approvals
  add constraint tool_approvals_verdict_known
  check (verdict is null or verdict in ('approved', 'rejected', 'revoked'));

-- ⚠ THE DEFAULT WINDOW IS THE SERVER'S AND IS NOT A CALLER'S ARGUMENT. A window a caller
-- chooses is a window a model can widen, and this is the wall that closes a request nobody
-- answered. One day: long enough that a person who was away overnight can still answer, short
-- enough that a forgotten request does not sit open for a month.
create or replace function agent.approval_window() returns interval
  language sql immutable set search_path = '' as $$ select interval '24 hours' $$;

comment on function agent.approval_window() is
  'How long a person has to answer one tool-call request. The server''s, not a caller''s.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. A PERMISSION CAN BE TAKEN BACK, SEPARATELY FROM THE SETTINGS FORM
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⚠ **WHY THIS IS NOT THE TOOL TICK.** The tick is the agent's CONFIGURATION: a run records
-- what it was accepted with, and that snapshot is deliberately stable — a customer unticking a
-- tool changes what the next run may call and must not change what a run already going may
-- call, because a run that loses a tool half way through is a run whose plan no longer works.
--
-- A REVOCATION is the opposite act, and it is the one the requirement asks for separately: it
-- says *stop doing this now*, and it is enforced before the next action of a run ALREADY under
-- way. So it is its own table, its own verb, and its own reader — and the snapshot is left
-- exactly as it is, which means the two facts can be told apart afterwards.
create table if not exists agent.tool_revocations (
  tenant_id  text        not null,
  agent_id   uuid        not null references agent.agents(id) on delete cascade,
  tool       text        not null check (tool ~ '^[a-zA-Z0-9_-]{1,64}$'),
  revoked_at timestamptz not null default now(),
  revoked_by text        not null check (length(revoked_by) between 1 and 200),
  note       text        check (note is null or length(note) <= 2000),
  primary key (tenant_id, agent_id, tool)
);

comment on table agent.tool_revocations is
  'A tool taken away from one agent, now, reaching runs already under way. Separate from the settings tick, which decides what the NEXT run is accepted with.';

alter table agent.tool_revocations enable row level security;
alter table agent.tool_revocations force row level security;
create policy tool_revocations_own_tenant on agent.tool_revocations
  for select to authenticated using (tenant_id = agent.tenant_id());
grant select on agent.tool_revocations to authenticated;
grant select, insert, delete on agent.tool_revocations to service_role;
-- ⚠ NO UPDATE. A revocation is added or lifted, never edited: an edited one is a different
-- revocation wearing the first one's timestamp.
revoke update on agent.tool_revocations from service_role;

create or replace function agent.revoke_agent_tool(
  p_tenant   text,
  p_agent_id uuid,
  p_tool     text,
  p_by       text,
  p_note     text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_run      record;
  v_back     jsonb;
  v_withdrew integer := 0;
  v_queued   uuid[] := '{}';
begin
  -- WHO SAID SO IS COMPELLED, as with every decision here: a revocation nobody can be tied
  -- to is one nobody can be asked about afterwards.
  if p_by is null or btrim(p_by) = '' then
    return jsonb_build_object('ok', false, 'error', 'no-decider');
  end if;
  if p_tool is null or p_tool !~ '^[a-zA-Z0-9_-]{1,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad-tool');
  end if;
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;
  insert into agent.tool_revocations (tenant_id, agent_id, tool, revoked_by, note)
  values (p_tenant, p_agent_id, p_tool, p_by, p_note)
  on conflict (tenant_id, agent_id, tool) do nothing;
  -- ⚠ **AND EVERY REQUEST STILL WAITING FOR THAT TOOL IS REVOKED WITH IT.** Leaving them
  -- pending would let somebody approve a call the permission for which has just been taken
  -- away — the approval and the permission disagreeing, with the approval winning.
  --
  -- WHICH RUNS THOSE WERE IS REMEMBERED, because of the next paragraph.
  --
  -- ⚠ **AND ONLY WHILE ITS RUN IS STILL GOING — MEASURED, AND WITHOUT IT A FINISHED RUN WENT
  -- BACK ON THE QUEUE FOR EVER.** `verdict is null` matches an EXPIRED request too, because an
  -- expiry is derived from the clock and is deliberately never written as a verdict — so a run
  -- the expiry sweep had already run to a stop still had an undecided request here, was
  -- withdrawn, and was REQUEUED by the loop below. It was then delivered, re-ran from its
  -- recorded position, met its own `stopped` entry at the fence, was released UNFINISHED as
  -- `conflict`, and the sweeper offered it again every minute: read off the demonstration,
  -- `attempts: 4` on a run that had ended.
  --
  -- The test is the same one `requeue_expired_approvals` above already makes, and reusing its
  -- expression rather than inventing one is deliberate. **AND IT SKIPS THE WITHDRAWAL, not
  -- merely the requeue**: `decide_tool_approval` refuses a finished run, so such a request is
  -- unanswerable by construction — writing `verdict = 'revoked', decided_by = p_by` over it
  -- would record a person deciding a call that had already been dealt with, and `withdrew`
  -- would count history rather than the live work this function exists to stop.
  for v_run in
    update agent.tool_approvals a
       set verdict = 'revoked', decided_at = now(), decided_by = p_by,
           note = coalesce(p_note, 'the permission for this tool was withdrawn')
     where a.tenant_id = p_tenant and a.agent_id = p_agent_id
       and a.tool = p_tool and a.verdict is null
       and not exists (select 1 from agent.run_entries e
                        where e.run_id = a.run_id and e.body ->> 'kind' = 'stopped')
    returning a.run_id
  loop
    v_withdrew := v_withdrew + 1;
    /**
     * ⚠ **AND THE RUN IS PUT BACK, WHICH IS NOT OPTIONAL — MEASURED.** A run waiting for a
     * person has its work row marked DONE; `decide_tool_approval` is what puts it back, and
     * this function has just answered the request INSTEAD of a person. Without this the run
     * sits for ever reading as `running`, waiting for a decision that can never be made and
     * with nothing left on anybody's screen to make it. It is the same defect the expiry
     * sweep above exists for, reached by somebody pressing a button rather than by time.
     *
     * A run somebody is actively working on answers `running` and is left alone;
     * `requeue_run` decides that, under the row lock, rather than this loop guessing.
     */
    v_back := agent.requeue_run(v_run.run_id, p_tenant);
    if v_back ->> 'state' = 'queued' then
      v_queued := array_append(v_queued, v_run.run_id);
    end if;
  end loop;
  -- ⚠ THE RUN IDS COME BACK so the CALLER can ring them. A SQL function cannot ring a
  -- Cloudflare queue, and without the doorbell nothing visibly happens until the next tick.
  return jsonb_build_object('ok', true, 'tool', p_tool,
    'withdrew', v_withdrew, 'runs', to_jsonb(v_queued));
end; $$;

comment on function agent.revoke_agent_tool(text, uuid, text, text, text) is
  'Take one tool away from one agent now. Enforced before the next action of a run already under way, and it withdraws anything waiting for that tool.';

create or replace function agent.restore_agent_tool(
  p_tenant text, p_agent_id uuid, p_tool text)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;
  delete from agent.tool_revocations r
   where r.tenant_id = p_tenant and r.agent_id = p_agent_id and r.tool = p_tool;
  get diagnostics v_rows = row_count;
  -- ⚠ LIFTING A REVOCATION DOES NOT BRING BACK THE REQUESTS IT WITHDREW. Those were answered
  -- — by the revocation — and re-opening them would put a decision back in front of somebody
  -- who has already made one. The agent asks again if it still wants the call.
  return jsonb_build_object('ok', true, 'tool', p_tool, 'lifted', v_rows = 1);
end; $$;

comment on function agent.restore_agent_tool(text, uuid, text) is
  'Lift a revocation. It does not re-open the requests the revocation withdrew.';

-- WHAT IS REVOKED FOR ONE AGENT, for the runner to subtract from the snapshot.
create or replace function agent.revoked_tools(p_tenant text, p_agent_id uuid)
  returns setof text
  language sql stable security definer set search_path = '' as $$
  select r.tool from agent.tool_revocations r
   where r.tenant_id = p_tenant and r.agent_id = p_agent_id
   order by r.tool;
$$;

comment on function agent.revoked_tools(text, uuid) is
  'The tools this agent may no longer use, whatever its runs were accepted with.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. REQUESTING, DECIDING AND READING — all three now know about a window
-- ──────────────────────────────────────────────────────────────────────────

-- ⚠ THE WINDOW IS STAMPED AT REQUEST TIME, and a row written before this migration keeps
-- `expires_at` NULL — which reads as NO WINDOW rather than as expired. That is the only safe
-- direction: reading an absent window as a closed one would refuse every request in flight
-- when this ships.
create or replace function agent.request_tool_approval(
  p_tenant   text,
  p_run_id   uuid,
  p_agent_id uuid,
  p_step     integer,
  p_idx      integer,
  p_tool     text,
  p_args     jsonb,
  p_hash     text,
  p_id       uuid default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row agent.tool_approvals%rowtype;
  v_state text;
begin
  if not exists (select 1 from agent.runs r where r.id = p_run_id and r.tenant_id = p_tenant) then
    return jsonb_build_object('ok', false, 'error', 'no-run');
  end if;
  -- ⚠ **A TOOL WHOSE PERMISSION HAS BEEN REVOKED IS NOT REQUESTED AT ALL.** Asking would put
  -- a decision in front of somebody about a call that may not happen whatever they answer, and
  -- it is the cheapest place to enforce a revocation on a gated tool.
  if p_agent_id is not null and exists (
        select 1 from agent.tool_revocations r
         where r.tenant_id = p_tenant and r.agent_id = p_agent_id and r.tool = p_tool) then
    return jsonb_build_object('ok', true, 'verdict', 'revoked', 'revokedPermission', true,
                              'matches', true, 'tool', p_tool,
                              'note', 'the permission for this tool was withdrawn');
  end if;

  insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash, expires_at)
  values (coalesce(p_id, gen_random_uuid()), p_tenant, p_run_id, p_agent_id,
          p_step, p_idx, p_tool, coalesce(p_args, '{}'::jsonb), p_hash, now() + agent.approval_window())
  on conflict (run_id, step, idx) do nothing;

  select * into v_row from agent.tool_approvals a
   where a.run_id = p_run_id and a.step = p_step and a.idx = p_idx;

  -- ⚠ **EXPIRY IS DERIVED, AND IT IS A THIRD ANSWER RATHER THAN A VERDICT.** A decided row is
  -- whatever it was decided; an undecided one whose window has closed reads `expired`, and the
  -- clock is the only writer of that fact. Nothing goes round stamping rows.
  v_state := case
    when v_row.verdict is not null then v_row.verdict
    when v_row.expires_at is not null and v_row.expires_at <= now() then 'expired'
    else null end;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'tool', v_row.tool,
    'verdict', v_state,
    -- ⚠ `false`, NEVER `null`. `v_state = 'expired'` is NULL for an undecided request inside
    -- its window, and a boolean that reads `null` is cannot-tell wearing a value's clothes —
    -- in the one field a caller asks to find out whether the window closed. MEASURED: every
    -- pending request answered `"expired": null` before this `coalesce`.
    'expired', coalesce(v_state = 'expired', false),
    'expiresAt', v_row.expires_at,
    'note', v_row.note,
    'args_hash', v_row.args_hash,
    'matches', v_row.args_hash = p_hash,
    'requested_at', v_row.requested_at);
end; $$;

comment on function agent.request_tool_approval(text, uuid, uuid, integer, integer, text, jsonb, text, uuid) is
  'Record that one tool call is waiting for a person, with a window to answer in. Asking twice finds the first request; a revoked permission is not requested at all.';

-- ⚠ AN EXPIRED REQUEST CANNOT BE DECIDED, which is the requirement in as many words. The
-- window closed; approving it afterwards would be an approval nobody gave inside the time
-- they were given, and it is exactly the case a person coming back the next morning produces.
create or replace function agent.decide_tool_approval(
  p_tenant  text,
  p_id      uuid,
  p_verdict text,
  p_note    text,
  p_by      text
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row agent.tool_approvals%rowtype;
  v_back jsonb;
begin
  -- ⚠ `revoked` IS NOT A VERDICT A DECISION MAY SET. Withdrawing is its own verb below, so a
  -- caller cannot reach it through the approve/reject door and skip that function's own rules.
  if p_verdict is null or p_verdict not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'bad-verdict');
  end if;
  if p_by is null or btrim(p_by) = '' then
    return jsonb_build_object('ok', false, 'error', 'no-decider');
  end if;

  select * into v_row from agent.tool_approvals a
   where a.id = p_id and a.tenant_id = p_tenant
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-request');
  end if;

  if v_row.verdict is not null then
    return jsonb_build_object('ok', true, 'repeat', true, 'id', v_row.id,
                              'run', v_row.run_id,
                              'verdict', v_row.verdict, 'note', v_row.note,
                              'decided_by', v_row.decided_by);
  end if;

  -- THE WINDOW, asked AFTER the repeat check: a decision already made stands whether or not
  -- the window has since closed, because it was made in time.
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired', 'id', v_row.id,
                              'run', v_row.run_id, 'expiresAt', v_row.expires_at);
  end if;
  -- AND THE PERMISSION, asked here too — a revocation that landed between the request and the
  -- press must not be approvable. `revoke_agent_tool` withdraws what is pending, so this is a
  -- DECLARED second wall for the row it raced.
  if v_row.agent_id is not null and exists (
        select 1 from agent.tool_revocations r
         where r.tenant_id = p_tenant and r.agent_id = v_row.agent_id and r.tool = v_row.tool) then
    return jsonb_build_object('ok', false, 'error', 'revoked-permission', 'id', v_row.id,
                              'run', v_row.run_id, 'tool', v_row.tool);
  end if;

  update agent.tool_approvals a
     set verdict = p_verdict, note = p_note, decided_by = p_by, decided_at = now()
   where a.id = p_id and a.verdict is null
  returning * into v_row;

  v_back := agent.requeue_run(v_row.run_id, p_tenant);

  return jsonb_build_object('ok', true, 'repeat', false, 'id', v_row.id,
                            'run', v_row.run_id,
                            'verdict', v_row.verdict, 'note', v_row.note,
                            'decided_by', v_row.decided_by, 'requeued', v_back);
end; $$;

comment on function agent.decide_tool_approval(text, uuid, text, text, text) is
  'A person approves or rejects one waiting tool call, inside its window. The first decision stands; an expired or revoked one cannot be decided at all.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. WITHDRAWING ONE APPROVAL, AND SAYING WHETHER IT WAS TOO LATE
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.revoke_tool_approval(
  p_tenant text,
  p_id     uuid,
  p_by     text,
  p_note   text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row  agent.tool_approvals%rowtype;
  v_ran  boolean;
  v_back jsonb;
begin
  if p_by is null or btrim(p_by) = '' then
    return jsonb_build_object('ok', false, 'error', 'no-decider');
  end if;
  select * into v_row from agent.tool_approvals a
   where a.id = p_id and a.tenant_id = p_tenant
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-request');
  end if;

  -- ⚠ **WHETHER THE CALL ALREADY RAN IS READ FROM THE JOURNAL, AND IT IS THE ONE THING THIS
  -- FUNCTION MUST NOT GET WRONG.** *Don't claim completed effects were undone* — so a
  -- revocation of a call that already happened says so plainly, and revokes nothing: the
  -- record of what was approved is what makes the effect accountable afterwards.
  v_ran := exists (
    select 1 from agent.run_entries e
     where e.run_id = v_row.run_id and e.kind = 'tool'
       and e.step = v_row.step and e.idx = v_row.idx);
  if v_ran then
    return jsonb_build_object('ok', false, 'error', 'already-ran', 'id', v_row.id,
                              'run', v_row.run_id, 'tool', v_row.tool, 'alreadyRan', true,
                              'verdict', v_row.verdict,
                              'say', 'that call has already happened, so there is nothing to withdraw');
  end if;

  -- A REJECTION CANNOT BE REVOKED. It already refuses the call, and "revoking" it would read
  -- as un-refusing rather than as withdrawing.
  if v_row.verdict = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'already-rejected', 'id', v_row.id);
  end if;
  if v_row.verdict = 'revoked' then
    return jsonb_build_object('ok', true, 'repeat', true, 'id', v_row.id, 'run', v_row.run_id,
                              'verdict', 'revoked', 'note', v_row.note, 'decided_by', v_row.decided_by);
  end if;

  update agent.tool_approvals a
     set verdict = 'revoked', decided_at = now(), decided_by = p_by,
         note = coalesce(p_note, 'withdrawn')
   where a.id = p_id
  returning * into v_row;

  -- ⚠ THE RUN GOES BACK ON THE QUEUE, because a withdrawal is an ANSWER: the call will not
  -- happen and the model is told so, which is a run that continues rather than one stranded
  -- waiting for a decision that has already been made.
  v_back := agent.requeue_run(v_row.run_id, p_tenant);
  return jsonb_build_object('ok', true, 'repeat', false, 'id', v_row.id, 'run', v_row.run_id,
                            'verdict', 'revoked', 'alreadyRan', false,
                            'note', v_row.note, 'decided_by', v_row.decided_by, 'requeued', v_back);
end; $$;

comment on function agent.revoke_tool_approval(text, uuid, text, text) is
  'Withdraw one tool-call request or the approval of one, before it runs. A call that has already happened is refused and said so — nothing here undoes anything.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. THE READERS, so `expired` and `revoked` are visible rather than inferred
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.pending_approvals(
  p_tenant text, p_agent_id uuid, p_limit integer default 20)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  return query
    select jsonb_build_object(
             'id', a.id, 'run', a.run_id, 'agent', a.agent_id, 'tool', a.tool,
             'args', a.args, 'step', a.step, 'index', a.idx, 'requestedAt', a.requested_at,
             'expiresAt', a.expires_at)
      from agent.tool_approvals a
     where a.tenant_id = p_tenant
       and a.verdict is null
       -- ⚠ AN EXPIRED REQUEST IS NOT WAITING FOR ANYBODY, so it is not offered as something
       -- to answer. Drawing it would be drawing a control that answers and is then refused —
       -- and `decide_tool_approval` really does refuse it, so the screen and the wall agree.
       and (a.expires_at is null or a.expires_at > now())
       and (p_agent_id is null or a.agent_id = p_agent_id)
     order by a.requested_at asc
     limit v_limit;
end; $$;

comment on function agent.pending_approvals(text, uuid, integer) is
  'Every tool call this account can still answer, oldest first. An expired request is not one of them.';

create or replace function agent.run_approvals(p_tenant text, p_run_id uuid)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select jsonb_build_object(
             'id', a.id, 'step', a.step, 'index', a.idx, 'tool', a.tool,
             'args_hash', a.args_hash, 'note', a.note,
             -- THE ENGINE'S OWN READER, so expiry arrives as a state rather than as a
             -- timestamp every caller has to compare for itself.
             'verdict', case
               when a.verdict is not null then a.verdict
               when a.expires_at is not null and a.expires_at <= now() then 'expired'
               else null end,
             'expiresAt', a.expires_at)
      from agent.tool_approvals a
     where a.tenant_id = p_tenant and a.run_id = p_run_id
     order by a.step asc, a.idx asc;
end; $$;

comment on function agent.run_approvals(text, uuid) is
  'What one run has asked for and what became of it — approved, rejected, revoked, expired, or still waiting.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5b. A RUN WHOSE WINDOW CLOSED HAS TO BE PUT BACK, OR IT IS STRANDED
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⚠ **FOUND BY DRIVING IT, AND IT IS THE HALF THE EXPIRY RULE WAS MISSING.** A run waiting
-- for a person has its work row marked DONE — there is nothing to redeliver until somebody
-- answers — and `agent.decide_tool_approval` is what puts it back, through `requeue_run`. So
-- when NOBODY answers, nothing puts it back: the window closes, the refusal is correct and
-- unreachable, and the run sits for ever with `status = 'running'` and no work row to claim.
-- MEASURED: a redelivery answered `not-claimable` and the run never ended.
--
-- The cron is the one thing that runs without anybody pressing anything, so this is its job —
-- exactly as `resume_due_automations` is for a wait that has come round.
--
-- ⚠ **AND IT ONLY PUTS BACK A RUN NOTHING CAN STILL ANSWER.** A run holding two requests, one
-- expired and one still inside its window, would be requeued every minute for ever: the loop
-- would hold again on the live one and the expired one would still be undecided. So the
-- condition is that EVERY undecided request of that run has expired — then the delivery
-- resolves all of them and the run really ends. A run somebody can still answer is left for
-- them to answer.
create or replace function agent.requeue_expired_approvals(p_limit integer default 25)
  returns setof jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_lim  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_run  record;
  v_back jsonb;
begin
  for v_run in
    select distinct a.run_id, a.tenant_id
      from agent.tool_approvals a
      join agent.run_work w on w.run_id = a.run_id
     where a.verdict is null
       and a.expires_at is not null and a.expires_at <= now()
       -- A RUN THAT HAS ALREADY ENDED NEEDS NOTHING. Its log is closed, and putting it back
       -- would deliver a finished run once a minute for the rest of time.
       and not exists (select 1 from agent.run_entries e
                        where e.run_id = a.run_id and e.body ->> 'kind' = 'stopped')
       -- ...AND NOTHING IT IS WAITING FOR MAY STILL BE ANSWERED, per the note above.
       and not exists (select 1 from agent.tool_approvals b
                        where b.run_id = a.run_id and b.verdict is null
                          and (b.expires_at is null or b.expires_at > now()))
     order by a.run_id
     limit v_lim
  loop
    -- ⚠ `requeue_run` IS THE ONE DOOR, not a second UPDATE of its own. It locks the row,
    -- answers `running` for a live lease — so a worker still on the run is never disturbed —
    -- and clears `done_at` and the attempt count for anything else.
    v_back := agent.requeue_run(v_run.run_id, v_run.tenant_id);
    -- ⚠ **BOTH OUTCOMES ARE REPORTED, AND THE ACTION IS WHAT TELLS THEM APART.** A row
    -- somebody is holding was looked at and deliberately left alone, and reporting only the
    -- re-queued ones makes that silent: an operator reading the log cannot tell a tick that
    -- found one run from a tick that found four and could act on one. It also left the
    -- CALLER's own filter — `action === 'requeued'` before it rings — unable to be driven at
    -- all, because nothing anywhere produced a row it had to skip: *a wall nobody can drive
    -- is a wall nobody is guarding*, and a sweep survivor is what said so.
    --
    -- **A `held` ROW MUST NEVER BE RUNG.** The doorbell would be a delivery `claim_run`
    -- refuses — latency spent to learn what this function already knows — so the action is
    -- the whole of what the caller reads, and it is a NAME rather than a boolean because a
    -- third outcome is a word rather than a migration.
    return next jsonb_build_object('run', v_run.run_id, 'tenant', v_run.tenant_id,
      'action', case when v_back ->> 'state' = 'queued' then 'requeued' else 'held' end,
      'state', v_back ->> 'state');
  end loop;
end; $$;

comment on function agent.requeue_expired_approvals(integer) is
  'Put back every run whose approval windows have all closed, so the refusal reaches the model instead of the run being stranded. A run somebody can still answer is left alone, and one somebody is holding is reported as held rather than silently skipped.';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. CANCELLING A RUN
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⚠ **THIS IS THE SECOND DOOR INTO THE JOURNAL, AND THE FIRST ONE'S RULE IS NOT BEING
-- RETIRED.** `agent.append_entry` is a WORKER's door and is fenced on the claim token,
-- because the hazard it exists for is two workers writing one run's history. A cancellation is
-- a PERSON's act and has no claim: it cannot present a token, and inventing one for it would
-- hand every caller a way past the fence.
--
-- So this function writes the log directly, and the narrowness is the whole safety argument:
-- it writes EXACTLY ONE kind of entry — a `stopped` with `reason: 'cancelled'` — only for a
-- run that has none, and it is `service_role`-only. Everything else still goes through the
-- fence, and `test/integration/pg-schema.mjs` censuses that there are exactly these two
-- writers.
--
-- **AND IT TAKES THE WORK AWAY FROM WHOEVER HOLDS IT.** Writing a stop while a worker holds a
-- live lease would leave that worker free to append after it; releasing the row makes its next
-- checkpoint fail, which is the fence doing the stopping rather than this function trying to.
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
  -- cancelled run is how far it got.
  --
  -- ⚠ **AND AN AUTOMATION EXECUTION'S STEPS ARE NOT MODEL CALLS — this counted only the agent
  -- loop's vocabulary and reported ZERO for every automation, however far it had really got.**
  -- An automation execution's journal holds `started`, `step` entries and `stopped` and NO
  -- `model` entry at all (`agent.runs.model` reads `none` for every one of them), so the answer
  -- said `completedSteps: 0` about a run that had recorded outcomes — a false statement about
  -- what had completed, in the one answer built to be honest about exactly that. Measured in a
  -- browser: an execution whose first note had run and whose approval was waiting.
  --
  -- ⚠ **IT IS COUNTED OFF THE EXECUTION'S OWN OUTCOMES, AND A PAUSED STEP IS NOT ONE THAT
  -- COMPLETED.** The journal's newest `step` entry carries `done` — how many outcomes had been
  -- recorded at that checkpoint — which is one MORE than finished whenever the execution is
  -- holding for a person, because the `approval` step's own outcome is recorded as `waiting`.
  -- MEASURED: a two-note workflow paused at its approval reads `done: 2` with one note really
  -- finished. Over-claiming is the wrong direction for the one field built to be honest about
  -- what happened, so the outcomes are counted with the paused one left out.
  --
  -- **THE TWO ARE ADDED because they are disjoint BY CONSTRUCTION**: a run is either an agent
  -- loop, which writes `model` entries and has no execution row, or an automation execution,
  -- which writes the reverse. So one word means one thing — how many steps finished — whichever
  -- kind of run it is, and no run can double count.
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
  -- reads `new.body -> 'stop'` and nothing else. The first draft wrote the reason and the
  -- counts at the top level: `status` went to `stopped` (that arm only looks at `kind`) and
  -- `agent.runs.stop` stayed NULL, so the run read as ended with nothing saying how.
  -- MEASURED before this was fixed. *This function is a SECOND producer of one entry shape,
  -- so it has to match the first rather than resemble it.*
  insert into agent.run_entries (run_id, seq, body)
  values (p_run_id, v_seq, jsonb_build_object(
    'kind', 'stopped', 'at', extract(epoch from now()) * 1000,
    'stop', jsonb_build_object(
      'reason', 'cancelled',
      -- ⚠ THE WORDS AND WHO SAID THEM RIDE ON THE STOP, because "why did this stop" is the one
      -- question a cancelled run leaves and the journal is where the answer has to live.
      'cancelledBy', p_by,
      'note', p_reason,
      -- WHAT HAD ALREADY HAPPENED, in the stop itself, so no reader has to count it again or
      -- guess that nothing did.
      'completedSteps', v_steps, 'completedCalls', v_tools)));

  -- PENDING WORK STOPS: the work row is released and marked done, so nothing is delivered
  -- again and whoever holds it fails its next checkpoint.
  update agent.run_work w
     set claimed_by = null, claimed_at = null, lease_expires_at = null, claim_token = null,
         done_at = now(), last_error = 'cancelled'
   where w.run_id = p_run_id and w.done_at is null;

  -- FUTURE STEPS STOP AND WAITS ARE RELEASED. An automation execution suspended on a wait or
  -- an approval is cleared, or the resume tick would wake something that has been stopped.
  update agent.automation_runs ar
     set waiting = null, wait_until = null, finished_at = coalesce(ar.finished_at, now())
   where ar.id = p_run_id and (ar.waiting is not null or ar.wait_until is not null);
  v_waited := found;

  -- AND EVERY REQUEST STILL WAITING IS WITHDRAWN, so nobody is asked to answer for a run that
  -- has stopped. This is a revocation rather than a rejection: nobody refused the call.
  update agent.tool_approvals a
     set verdict = 'revoked', decided_at = now(), decided_by = p_by,
         note = coalesce(p_reason, 'the run was cancelled')
   where a.run_id = p_run_id and a.verdict is null;
  get diagnostics v_pending = row_count;

  return jsonb_build_object('ok', true, 'repeat', false, 'run', p_run_id,
    'completedSteps', v_steps, 'completedCalls', v_tools,
    'withdrewApprovals', v_pending, 'releasedWait', v_waited,
    -- ⚠ SAID IN THE ANSWER AS WELL AS IN THE STOP, because a caller that reads only the
    -- answer would otherwise have nothing saying the work that finished stays finished.
    'say', 'stopped — what had already run has already run and was not undone');
end; $$;

comment on function agent.cancel_run(text, uuid, text, text) is
  'Stop one run: release its work, clear any wait, withdraw anything waiting for a person, and record how far it got. Nothing already done is undone.';

-- ──────────────────────────────────────────────────────────────────────────
-- 7. THE GRANTS — the backend alone, as with every operation here
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_fn text;
begin
  for v_fn in
    select 'agent.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'agent'
       and p.proname in ('approval_window', 'revoke_agent_tool', 'restore_agent_tool',
                         'revoked_tools', 'revoke_tool_approval', 'cancel_run',
                         'requeue_expired_approvals')
  loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end $$;
