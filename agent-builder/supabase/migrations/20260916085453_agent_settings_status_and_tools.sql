-- ============================================================================
-- AGENT SETTINGS: A STATUS, AND A SELECTION OF TOOLS.
--
-- Two columns, one view widened, one bound corrected and one function rewritten.
-- What they add is the half of an agent a PERSON configures beyond its writing:
-- whether it is taking work at all, and which of the platform's tools it may use.
--
-- **THE CATALOG IS NOT HERE, AND THAT IS THE DESIGN.** Which tools exist is CODE
-- — `OFFERED` in `agent-builder/src/agents.mjs`, a frozen list of `defineTool`
-- results — so SQL cannot hold it and must not pretend to. What this file does is
-- bound the SHAPE of a selection (how many names, what a name may look like); what
-- decides whether a name is a tool is a positive lookup in that array, three
-- layers up and again at execution. A name nobody put in the catalog reaches this
-- column happily and resolves to nothing, which is the fail-closed direction.
--
-- **PAUSING BLOCKS NEW WORK AND CANCELS NOTHING.** A paused agent keeps every
-- message it has, answers every run already accepted, and refuses to start
-- another. Nothing here touches `agent.runs`, `agent.run_work` or the runner: a
-- run that is going is work somebody already asked for, and stopping it would be
-- cancellation wearing a pause's clothes.
-- ============================================================================

-- ── is it taking work ───────────────────────────────────────────────────────
--
-- TWO VALUES AND A DEFAULT THAT KEEPS EVERY EXISTING AGENT WORKING. `active` is
-- not a guess: an agent somebody wrote before this column existed is one they
-- expect to answer, and defaulting to `paused` would silently stop every
-- conversation on the platform.
--
-- A CHECK RATHER THAN AN ENUM, for the reason this schema uses one for `role`: a
-- check is one `alter` to widen and reads in the same place as the column, where
-- an enum's values live in a type nobody looks at.
alter table agent.agents
  add column if not exists status text not null default 'active'
    check (status in ('active', 'paused'));

comment on column agent.agents.status is
  'active or paused. A paused agent keeps its conversation and refuses new runs; nothing in flight is cancelled.';

-- ── which tools it may use ──────────────────────────────────────────────────
--
-- **A LIST OF NAMES, NEVER A LIST OF TOOLS.** A tool is code: a description, an
-- input schema and a function. Storing any of that here would make a row able to
-- describe a capability, which is exactly what "an agent is named, never
-- described" forbids. The column holds the customer's SELECTION and nothing else.
--
-- `text[]` RATHER THAN `jsonb`, because this is a set of short identifiers and
-- Postgres has a type for that: `= any(tools)` and `array_length` are the
-- questions it gets asked, and a jsonb array would answer them through casts.
--
-- EMPTY IS THE DEFAULT AND IT IS A REAL ANSWER — "this agent may call nothing",
-- which is what every agent written before today was and is what a new one is
-- until somebody ticks a box. There is no null state: a selection nobody has made
-- is empty, not unknown.
alter table agent.agents
  add column if not exists tools text[] not null default '{}'::text[];

comment on column agent.agents.tools is
  'The tool names this agent may call, chosen from the catalog in agent-builder/src/agents.mjs. The catalog is code; this is only the selection.';

-- **THE CONSTRAINT BOUNDS THE SHAPE AND THE CATALOG DECIDES THE MEANING**, and
-- saying which is which is the point of this comment.
--
-- What it enforces: at most `32` names; no NULL among them; and each name matching
-- the provider's own tool grammar, which is `TOOL_NAME` in
-- `agent-builder/src/define.mjs` (`[a-zA-Z0-9_-]{1,64}`) — pinned there as an
-- external constraint rather than a house style, and mirrored here so a name that
-- could never be sent to a model cannot be stored either.
--
-- What it deliberately does NOT enforce: that a name is a real tool (the catalog
-- is code and a CHECK cannot read it), and that the names are distinct (a CHECK
-- cannot hold a subquery, and a duplicate is harmless — every reader of this
-- column builds a Set). The server de-duplicates on the way in; this is the wall
-- against a shape, not against a wrong name.
--
-- ⚠ ONE STATED LIMIT: the charset is checked over the names JOINED BY COMMAS, so a
-- single element containing a comma reads here as two elements and passes. That is
-- fine and is not a hole — such a name matches no catalog tool, so it resolves to
-- nothing — and it is written down because the alternative is a reader concluding
-- the regex is exact.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'agents_tools_shape' and conrelid = 'agent.agents'::regclass
  ) then
    alter table agent.agents add constraint agents_tools_shape check (
      coalesce(array_length(tools, 1), 0) <= 32
      and array_position(tools, null) is null
      and array_to_string(tools, ',') ~ '^([a-zA-Z0-9_-]{1,64}(,[a-zA-Z0-9_-]{1,64})*)?$'
    );
  end if;
end
$$;

-- ── the list screen reads both ──────────────────────────────────────────────
--
-- ⚠ THE NEW COLUMNS GO AT THE END, AND POSTGRES REQUIRES IT RATHER THAN PREFERRING
-- IT. `create or replace view` may only APPEND columns: it keeps every existing
-- one's name, type and position, and reordering them makes the replace fail
-- outright. So `status` and `tools` sit after `last_message` even though they
-- belong to the agent and it does not. Tidying that order is a broken deploy.
create or replace view agent.agent_overview
  with (security_invoker = true) as
select
  a.id,
  a.tenant_id,
  a.name,
  a.instructions,
  a.created_at,
  a.updated_at,
  -- NULL when nothing has been said, which is a different answer from the empty
  -- string: a message cannot be blank (the body check refuses it), so NULL here
  -- can only mean "no messages" and the caller never has to guess which it is.
  last.body as last_message,
  a.status,
  a.tools
from agent.agents a
left join lateral (
  select m.body
    from agent.agent_messages m
   where m.agent_id = a.id
   -- `seq` RATHER THAN `created_at`: two messages can share a millisecond and a
   -- tie is not an order. The identity is assigned by the database and total.
   order by m.seq desc
   limit 1
) last on true;

comment on view agent.agent_overview is
  'One row per agent with its last message, its status and its tool selection. security_invoker, so RLS on agent.agents and agent.agent_messages applies to whoever reads it.';

grant select on agent.agent_overview to authenticated, service_role;
revoke all on agent.agent_overview from anon;

-- ── what an authored run is allowed to be ───────────────────────────────────
--
-- ⚠ `toolCalls` MOVES FROM 1 TO 2, AND THE REASON IS A MEASUREMENT RATHER THAN A
-- PREFERENCE. It was one, chosen as "the smallest number that lets the run start"
-- on the day the authored agent's tool list was empty and nothing could be called.
-- A selection makes a tool reachable, and `toolCalls` is a RUN TOTAL against which
-- the engine's `stoppedBy` asks `used >= limit`: a budget of one is a budget
-- already spent the instant one call is made. **Measured by driving the real
-- agent: it stopped `{reason: "spent", bound: "toolCalls", limit: 1, used: 1}`
-- after its tool call and never reached the step that answers.** Zero let the run
-- not start; one let it not finish. A tool selection under that bound would have
-- been a control that always fails.
--
-- `steps` moves to 3 for the rule already written beside the registry entry: the
-- one-tool shape really takes two steps — call, then answer — and a bound that is
-- exactly the happy path cannot tell the ordinary path from something having
-- changed.
--
-- **STILL A COPY OF `AUTHORED` IN `agent-builder/src/agents.mjs`, STILL CENSUSED
-- BOTH WAYS** by `agent-builder/test/authored-run.test.mjs`. That census is what
-- turned this change from a number somebody might have forgotten into a red run.
create or replace function agent.authored_run() returns jsonb
  language sql immutable
  set search_path = ''
as $$
  select jsonb_build_object(
    'agent', 'authored',
    'model', 'stand-in',
    -- ALL EIGHT, NOT THE FOUR THIS AGENT OVERRIDES — see the census. Writing only
    -- the overrides would leave the other four to be filled in from whatever the
    -- defaults are on the day a run is REPLAYED.
    'limits', jsonb_build_object(
      'steps', 3,
      'toolCalls', 2,
      'parallelTools', 8,
      'wallMs', 60000,
      'callMs', 30000,
      'toolMs', 30000,
      'tokens', 1000000,
      'costMicros', 2000000
    )
  )
$$;

comment on function agent.authored_run() is
  'The agent name, model and bounds every customer-authored run executes under. A copy of AUTHORED in agent-builder/src/agents.mjs, censused both ways by that product''s suite.';

revoke all on function agent.authored_run() from public;
grant execute on function agent.authored_run() to service_role;

-- ── the one transaction, now with a status and a selection ───────────────────
--
-- Everything the previous version of this function argued still holds: it is
-- `security definer` because `insert on agent.run_entries` is revoked from
-- `service_role`; it calls `agent.accept_run` rather than repeating its three
-- inserts; the MESSAGE goes in before any run exists, so a retry is absorbed
-- before a second run can be minted; and the snapshot is READ HERE rather than
-- passed in, so neither a request body nor the server's own earlier read can
-- decide what a run was told.
--
-- **WHAT IS NEW IS AN ORDER, AND IT IS THE WHOLE OF THE PAUSE'S CORRECTNESS.**
-- A paused agent must refuse to start work, and a retry of a send that ALREADY
-- LANDED must still be absorbed — including a retry that arrives after the pause.
-- Those two pull opposite ways, so the key is asked FIRST as a read:
--
--   1. is this agent this tenant's?        → no  : `no-agent`
--   2. has this key already been sent?     → yes : the repeat, whatever the status
--   3. is the agent paused?                → yes : `paused`, and NOTHING is written
--   4. insert the message, on conflict do nothing
--   5. absorbed by a racing twin?          → yes : the repeat
--   6. history, entry, accept_run, link
--
-- **STEP 2 IS A PROBE AND STEP 4 IS STILL THE AUTHORITY.** The read decides only
-- whether to refuse; what decides whether a message is written is the unique index
-- and the `on conflict` clause, which is the only thing that holds against a
-- concurrent twin in another transaction. Reading the probe as the gate would be
-- putting a check-then-act where a constraint belongs.
--
-- **AND A PAUSED REFUSAL WRITES NOTHING AT ALL.** Not the message, not a run.
-- Saving the words would put a question in the conversation that nothing will ever
-- answer and would spend the browser's retry key on it; refusing leaves the typed
-- text in the box, where the person can resume the agent and press send again with
-- the same key.
create or replace function agent.send_to_agent(
  p_tenant     text,
  p_agent_id   uuid,
  p_message_id uuid,
  p_body       text,
  p_send_key   text,
  p_run_id     uuid
) returns jsonb
  language plpgsql security definer
  set search_path = ''
as $$
declare
  v_agent   agent.agents;
  v_msg     agent.agent_messages;
  v_key     text := nullif(btrim(coalesce(p_send_key, '')), '');
  -- WAS THIS PRESS THE ONE THAT WROTE THE MESSAGE? `v_msg.id is not null` cannot
  -- answer it on its own: the probe, the insert and the race all leave a row in
  -- `v_msg`, and only the insert's own RETURNING means "this call made it".
  v_new     boolean := false;
  v_history jsonb;
  v_entry   jsonb;
  v_accept  jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'send_to_agent: tenant must be a non-empty string';
  end if;
  -- A SEND WITH NO KEY IS REFUSED, NOT ACCEPTED UNKEYED. The partial index only
  -- covers non-null keys, so an unkeyed send would insert every time — retry
  -- safety failing OPEN, which is the direction that duplicates a conversation.
  if v_key is null then
    raise exception 'send_to_agent: a send needs its own key, or a retry cannot be told from a new message';
  end if;
  if p_message_id is null or p_run_id is null then
    raise exception 'send_to_agent: the message and the run both need an id';
  end if;

  -- ── whose agent is this ───────────────────────────────────────────────────
  -- ASKED IN THE SAME TRANSACTION AS EVERY WRITE BELOW, so an agent deleted
  -- between a check and an insert cannot leave a message behind. Answered as a
  -- VALUE rather than raised: "this agent isn't here any more" is a sentence the
  -- caller turns into a 404, and another tenant's agent answers identically —
  -- not found, never forbidden.
  select * into v_agent from agent.agents
   where id = p_agent_id and tenant_id = p_tenant;
  if v_agent.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;

  -- ── has this press already landed ────────────────────────────────────────
  -- THE PROBE, AND IT IS ABOVE THE PAUSE DELIBERATELY. A press whose answer was
  -- lost is answered with what it produced however the agent is configured now:
  -- the message and the run really exist, and refusing the retry would tell
  -- somebody their message failed while it was being worked on, and would leave
  -- the conversation showing it twice.
  --
  -- **THE PROBE DECIDES ONLY WHETHER TO REFUSE; the `on conflict` clause below is
  -- still what decides whether a message is written.** A read cannot see a twin in
  -- another transaction, so reading this as the gate would be a check-then-act
  -- where a constraint belongs.
  select * into v_msg from agent.agent_messages
   where agent_id = p_agent_id and send_key = v_key;

  if v_msg.id is null then
    -- ── is it taking work ──────────────────────────────────────────────────
    -- A VALUE, NOT A RAISE, for the same reason `no-agent` is one: the caller turns
    -- it into a sentence, and a raise would roll back a transaction that has written
    -- nothing anyway while costing the caller the ability to tell this refusal from
    -- a broken database. **NOTHING IS WRITTEN ON THIS PATH** — not the message, not
    -- a run — so the words stay in the box and the browser's own retry key is still
    -- this press's key.
    if v_agent.status <> 'active' then
      return jsonb_build_object('ok', false, 'error', 'paused', 'status', v_agent.status);
    end if;

    -- ── the message, and the key is still the gate ─────────────────────────
    -- No `role` is supplied: the column's default and its check decide. The
    -- `on conflict` clause is what holds against a twin in ANOTHER transaction,
    -- which the probe above cannot see.
    insert into agent.agent_messages (id, agent_id, body, send_key)
    values (p_message_id, p_agent_id, p_body, v_key)
    on conflict (agent_id, send_key) where send_key is not null
    do nothing
    returning * into v_msg;
    v_new := v_msg.id is not null;

    if not v_new then
      -- A SECOND PRESS RACING THIS ONE, in another transaction. Read what it wrote.
      select * into v_msg from agent.agent_messages
       where agent_id = p_agent_id and send_key = v_key;
      if v_msg.id is null then
        raise exception 'send_to_agent: the send conflicted with a row that is not there';
      end if;
    end if;
  end if;

  -- ── an absorbed press answers what it produced and starts NOTHING ────────
  --
  -- **ONE COPY OF THIS ANSWER, and it was two.** The probe and the race arrive at
  -- exactly the same fact — this key has already been sent — and answering it twice
  -- meant two `jsonb_build_object`s that could disagree the moment either was
  -- edited. It is also what made two of this file's own mutants ambiguous, which is
  -- the same defect wearing a sweep's clothes.
  --
  -- A second run here would be two executions of one message, which is the defect
  -- this key exists to close.
  if not v_new then
    return jsonb_build_object(
      'ok', true, 'repeat', true,
      'message_id', v_msg.id, 'run_id', v_msg.run_id,
      -- THE STORED BODY, NEVER THE ONE THIS CALL SENT. They differ exactly when a
      -- retry carries different text under the same key — a client bug — and the
      -- honest answer is what the conversation really holds, not what was asked
      -- for and absorbed.
      'body', v_msg.body,
      -- ⚠ AND IT SAYS WHEN THE TWO DISAGREE. A caller that reuses a key under EDITED
      -- text would otherwise read `ok` and be handed the original message, which from
      -- a browser is indistinguishable from its edit having been saved — so the edit
      -- is thrown away silently. This is the one fact that tells the two apart, and it
      -- is answered rather than raised: the earlier message really is stored, nothing
      -- is wrong with it, and refusing would strand a retry that is behaving correctly.
      'mismatch', (v_msg.body is distinct from p_body),
      'seq', v_msg.seq, 'created_at', v_msg.created_at,
      'state', case when v_msg.run_id is null then 'no-run' else 'accepted' end
    );
  end if;

  -- ── the conversation this run is started with ─────────────────────────────
  -- THE NEWEST TURNS, IN ORDER, each one a message and the answer its own run
  -- produced. A turn whose run never finished, failed, or was retained away
  -- carries a null answer rather than being dropped: a conversation with a gap
  -- in it is still the conversation that happened, and dropping the question
  -- because the answer is missing would send the model a history it never had.
  --
  -- The message just inserted is EXCLUDED — it is the prompt, not history.
  select coalesce(jsonb_agg(jsonb_build_object('user', h.body, 'agent', h.answer)
                            order by h.seq), '[]'::jsonb)
    into v_history
    from (
      select m.seq, m.body,
             case when r.stop ->> 'reason' = 'answered' then r.stop ->> 'text' end as answer
        from agent.agent_messages m
        left join agent.runs r on r.id = m.run_id
       where m.agent_id = p_agent_id
         and m.id <> v_msg.id
       order by m.seq desc
       limit agent.history_turns()
    ) h;

  -- ── the run's first entry, built here and nowhere else ───────────────────
  -- NOTHING IN IT CAME FROM A CALLER except the words somebody typed, which is
  -- the `prompt`. The agent, the model and the bounds are `agent.authored_run()`;
  -- the instructions, the conversation and the TOOL SELECTION are read from rows
  -- in THIS transaction, so a later edit of the agent cannot reach a run that has
  -- already been accepted; and the two pointers are the ids this function was
  -- given, after the ownership check above proved whose they are.
  --
  -- ⚠ `tools` IS THE RUN CONFIGURATION AND IT IS RECORDED RATHER THAN CONSULTED
  -- LATER. The runner narrows the catalog against THIS list on every delivery, so
  -- a customer who unticks a tool while a run is going changes what the next run
  -- may call and never what this one may call. `to_jsonb` of an empty `text[]` is
  -- `[]`, which the engine reads as "an authored run allowed nothing" — a
  -- different fact from an absent key, which means "not an authored run at all".
  --
  -- ITS SHAPE IS THE ENGINE'S `startedEntry`, and the census in
  -- `agent-builder/test/authored-run.test.mjs` compares the two key sets both
  -- ways — a field added to one and not the other is a red run rather than a run
  -- missing something nobody notices.
  v_entry := jsonb_build_object(
    'kind',   'started',
    'at',     (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'tenant', p_tenant,
    'prompt', p_body
  ) || agent.authored_run() || jsonb_build_object(
    'instructions', v_agent.instructions,
    'history',      v_history,
    'tools',        to_jsonb(v_agent.tools),
    'authoredAgent', p_agent_id,
    'message',      v_msg.id
  );

  -- ── the run, its log and its work row ────────────────────────────────────
  v_accept := agent.accept_run(p_run_id, p_tenant, v_entry, 'start');

  -- The link, written after the run exists because the foreign key says so.
  update agent.agent_messages set run_id = p_run_id where id = v_msg.id;

  return jsonb_build_object(
    'ok', true, 'repeat', false,
    'message_id', v_msg.id, 'run_id', p_run_id,
    'body', v_msg.body,
    'seq', v_msg.seq, 'created_at', v_msg.created_at,
    'state', v_accept -> 'state'
  );
end
$$;

comment on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) is
  'One transaction: save a message to an owned, active agent and accept a run for it, with the agent''s instructions and tool selection snapshotted into the run. Idempotent per (agent, send_key); refuses a paused agent without writing anything.';

-- ── who may call it ─────────────────────────────────────────────────────────
--
-- THE SERVER, AND NOBODY ELSE. It takes the tenant as an argument, which is only
-- safe because no client role can execute it — the same posture `import_agent`
-- and `accept_run` have. A customer reaching this could start work as anybody.
revoke all on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) from public;
grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role;
