-- ══════════════════════════════════════════════════════════════════════════
-- A TOOL CALL THAT NEEDS A PERSON'S SAY-SO — bound to the arguments it was made with
--
-- **THE WAIT IS THE ONE THAT ALREADY EXISTS, and that is the whole design.** A run
-- whose model has answered but whose tools have not is a run with PENDING CALLS: its
-- model entry is in the log (written the moment it arrived, before any tool runs) and
-- there are no results beside it. `replay` already reports that state, `runAgent`
-- already refuses to resume past a call it cannot safely repeat, and the runner already
-- takes such a run OFF the queue while leaving its log OPEN so a person can act. Nothing
-- new waits, nothing new is journalled, and there is no second queue.
--
-- So an approval is a ROW beside that state, and a decision puts the run back through
-- `agent.requeue_run` — the same function a person pressing "try again" uses.
--
-- ── ⚠ WHAT "BOUND TO THE ARGUMENTS" MEANS HERE ───────────────────────────────
--
-- **THE REQUEST ROW HOLDS THE ARGUMENTS, so approving it authorises exactly the call it
-- records and nothing else.** There is no approval for "this tool" or "this agent" that
-- a later call could be read against: the row names one run, one step, one position in
-- that step's batch, and the exact arguments. A model that answers again with different
-- arguments produces a different fingerprint, which no existing approval matches.
--
-- `args_hash` is stored beside the arguments deliberately and is NOT a second copy of
-- them: it is what the ENGINE compares against the log without having to re-canonicalise
-- a jsonb value in two languages, and a row whose hash and arguments disagree is one
-- nobody wrote through this function.
--
-- ── ⚠ ONLY A PERSON DECIDES, AND AN AGENT CANNOT REACH THIS ──────────────────
--
-- `decide_tool_approval` takes the acting identity as an argument and is granted to
-- `service_role` alone, so the only caller is a backend — and the site's route takes
-- that identity from the VERIFIED session, never from a request body. **The engine's own
-- capability layer does not name this function at all**, which is asserted as a census
-- rather than left as a fact about today's catalog: a tool that could approve is an agent
-- approving itself, whatever the sentence in front of it says.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agent.tool_approvals (
  id           uuid primary key,
  tenant_id    text        not null check (length(tenant_id) between 1 and 200),
  run_id       uuid        not null references agent.runs(id) on delete cascade,
  -- THE AUTHORED AGENT, so a person can be shown what is waiting without joining
  -- through the journal. Nullable because a run started through `POST /runs` has none.
  agent_id     uuid        references agent.agents(id) on delete cascade,
  -- WHERE IN THE CONVERSATION. One step's batch can hold several calls, so the position
  -- within it is part of the identity: two calls of the same tool in one answer are two
  -- requests and need two decisions.
  step         integer     not null check (step >= 0),
  idx          integer     not null check (idx >= 0),
  tool         text        not null check (tool ~ '^[a-zA-Z0-9_-]{1,64}$'),
  args         jsonb       not null default '{}'::jsonb check (jsonb_typeof(args) = 'object'),
  args_hash    text        not null check (length(args_hash) between 1 and 200),
  -- NULL IS PENDING. Three states, and none of them is a guess: nobody has answered,
  -- somebody approved, somebody rejected.
  verdict      text        check (verdict in ('approved', 'rejected')),
  note         text        check (note is null or length(note) <= 2000),
  decided_by   text        check (decided_by is null or length(decided_by) between 1 and 200),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  -- ⚠ A DECISION IS WHOLE OR IT IS ABSENT. A verdict with no time, or a time with no
  -- verdict, is a half-answered request that every reader would have to guess about.
  constraint tool_approvals_decision_is_whole check (
    (verdict is null and decided_at is null and decided_by is null)
    or (verdict is not null and decided_at is not null and decided_by is not null)),
  -- ONE REQUEST PER CALL. A redelivery re-requests the same thing and must find the
  -- request already there rather than making a second one somebody has to answer twice.
  constraint tool_approvals_one_per_call unique (run_id, step, idx)
);

comment on table agent.tool_approvals is
  'One tool call a person has to say yes to, with the arguments it was made with. Approving a row authorises exactly that call.';

create index if not exists tool_approvals_waiting
  on agent.tool_approvals (tenant_id, agent_id, requested_at desc)
  where verdict is null;

alter table agent.tool_approvals enable row level security;
alter table agent.tool_approvals force row level security;

-- A CUSTOMER READS THEIR OWN AND WRITES NONE OF IT. The write path is the two functions
-- below, so a request cannot be invented and a verdict cannot be set by a client.
drop policy if exists tool_approvals_own_tenant on agent.tool_approvals;
create policy tool_approvals_own_tenant on agent.tool_approvals
  for select to authenticated using (tenant_id = agent.tenant_id());

grant select on agent.tool_approvals to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- ASKING — idempotent, because a redelivery asks again
-- ──────────────────────────────────────────────────────────────────────────

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
begin
  -- THE RUN MUST BE THIS ACCOUNT'S. The caller is a consumer that took the tenant from
  -- its own claim, so this is the second wall rather than the first — and it costs
  -- nothing to make a run id that named somebody else's work read as absent.
  if not exists (select 1 from agent.runs r where r.id = p_run_id and r.tenant_id = p_tenant) then
    return jsonb_build_object('ok', false, 'error', 'no-run');
  end if;

  insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash)
  values (coalesce(p_id, gen_random_uuid()), p_tenant, p_run_id, p_agent_id,
          p_step, p_idx, p_tool, coalesce(p_args, '{}'::jsonb), p_hash)
  on conflict (run_id, step, idx) do nothing;

  -- ⚠ READ BACK WHATEVER IS REALLY THERE, which is what makes the retry safe: a second
  -- ask finds the FIRST request, decision and all, rather than a fresh one. A request
  -- whose arguments differ from the stored ones is reported rather than overwritten —
  -- the stored row is what somebody was shown and may already have answered.
  select * into v_row from agent.tool_approvals a
   where a.run_id = p_run_id and a.step = p_step and a.idx = p_idx;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'tool', v_row.tool,
    'verdict', v_row.verdict,
    -- ⚠ A PERSON'S OWN WORDS COME BACK WITH THE VERDICT, because a refusal the model is
    -- told nothing about is one it will simply ask for again. It is data reaching a
    -- model's context, which grants nothing: the engine reads the VERDICT, never the note.
    'note', v_row.note,
    'args_hash', v_row.args_hash,
    'matches', v_row.args_hash = p_hash,
    'requested_at', v_row.requested_at);
end; $$;

comment on function agent.request_tool_approval(text, uuid, uuid, integer, integer, text, jsonb, text, uuid) is
  'Record that one tool call is waiting for a person. Asking twice finds the first request rather than making a second.';

-- ──────────────────────────────────────────────────────────────────────────
-- DECIDING — the first answer stands, and it puts the run back on the queue
-- ──────────────────────────────────────────────────────────────────────────

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
  if p_verdict is null or p_verdict not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'bad-verdict');
  end if;
  -- ⚠ WHO SAID SO IS COMPELLED. A decision nobody can be tied to is one nobody can be
  -- asked about afterwards, and this is the field the whole "only an authorized user"
  -- rule rests on — so it is refused rather than defaulted.
  if p_by is null or btrim(p_by) = '' then
    return jsonb_build_object('ok', false, 'error', 'no-decider');
  end if;

  -- THE ROW IS LOCKED BEFORE ANYTHING IS READ FROM IT, so two people pressing at once
  -- are one decision and a loser rather than a race.
  select * into v_row from agent.tool_approvals a
   where a.id = p_id and a.tenant_id = p_tenant
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-request');
  end if;

  -- ⚠ THE FIRST DECISION STANDS. The read above is only a probe; THIS is the authority,
  -- so a second press re-reads what the winner wrote rather than replacing it.
  if v_row.verdict is not null then
    return jsonb_build_object('ok', true, 'repeat', true, 'id', v_row.id,
                              'run', v_row.run_id,
                              'verdict', v_row.verdict, 'note', v_row.note,
                              'decided_by', v_row.decided_by);
  end if;

  update agent.tool_approvals a
     set verdict = p_verdict, note = p_note, decided_by = p_by, decided_at = now()
   where a.id = p_id and a.verdict is null
  returning * into v_row;

  -- THE RUN GOES BACK ON THE QUEUE, through the function a person pressing "try again"
  -- already uses. **Its answer is carried rather than raised**: a run somebody is
  -- already working on answers `running`, which is not a failure of the decision — the
  -- decision is recorded either way, and the work will read it.
  v_back := agent.requeue_run(v_row.run_id, p_tenant);

  return jsonb_build_object('ok', true, 'repeat', false, 'id', v_row.id,
                            -- WHICH RUN, so the caller can ring the doorbell. `requeue_run`
                            -- has already put the work back INSIDE this transaction; a SQL
                            -- function cannot ring a Cloudflare queue, so the prompt half
                            -- is the caller's and the durable half is already done.
                            'run', v_row.run_id,
                            'verdict', v_row.verdict, 'note', v_row.note,
                            'decided_by', v_row.decided_by, 'requeued', v_back);
end; $$;

comment on function agent.decide_tool_approval(text, uuid, text, text, text) is
  'A person approves or rejects one waiting tool call, and the run goes back on the queue. The first decision stands.';

-- ──────────────────────────────────────────────────────────────────────────
-- READING — what is waiting, and what one run is waiting on
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
             'args', a.args, 'step', a.step, 'index', a.idx, 'requestedAt', a.requested_at)
      from agent.tool_approvals a
     where a.tenant_id = p_tenant
       and a.verdict is null
       and (p_agent_id is null or a.agent_id = p_agent_id)
     order by a.requested_at asc
     limit v_limit;
end; $$;

comment on function agent.pending_approvals(text, uuid, integer) is
  'Every tool call this account has waiting for an answer, oldest first, with the arguments it was made with.';

create or replace function agent.run_approvals(p_tenant text, p_run_id uuid)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select jsonb_build_object(
             'id', a.id, 'step', a.step, 'index', a.idx, 'tool', a.tool,
             'args_hash', a.args_hash, 'verdict', a.verdict, 'note', a.note)
      from agent.tool_approvals a
     where a.tenant_id = p_tenant and a.run_id = p_run_id
     order by a.step asc, a.idx asc;
end; $$;

comment on function agent.run_approvals(text, uuid) is
  'What one run has asked for and what has been answered — the list the engine reads before it resumes.';

-- ──────────────────────────────────────────────────────────────────────────
-- THE GRANTS — the backend alone, and `authenticated` may only READ the table
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'agent.request_tool_approval(text, uuid, uuid, integer, integer, text, jsonb, text, uuid)',
    'agent.decide_tool_approval(text, uuid, text, text, text)',
    'agent.pending_approvals(text, uuid, integer)',
    'agent.run_approvals(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end $$;
