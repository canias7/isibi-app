-- ============================================================================
-- SENDING A MESSAGE TO AN AUTHORED AGENT STARTS A RUN — IN ONE TRANSACTION.
--
-- ⚠ NOT APPLIED. Every other file in this directory is named for the remote
-- version the apply recorded, because that is the one way the two can be lined
-- up later. This one has never been applied to any project, so its name is a
-- placeholder: **rename it to the remote version on the day it is applied**, and
-- read what is live out of the database rather than out of this file.
--
-- WHAT THIS CONNECTS. Two halves already existed and had nothing between them:
-- `agent.agents` / `agent.agent_messages` (what a person wrote, mutable, theirs)
-- and `agent.runs` / `agent.run_entries` / `agent.run_work` (work that ran:
-- append-only, claimed, fenced, replayable). This adds the ONE link and the ONE
-- transaction that turns a typed message into queued work.
--
-- **THE HALVES STAY SEPARATE AND THIS IS NOT A RETREAT FROM THAT.** Nothing
-- mutable moves into the journal and nothing append-only moves out of it. What
-- is added is a pointer and a snapshot: the message says which run it started,
-- and the run's own first entry carries a COPY of the instructions and the
-- conversation it was started with. A copy in an append-only log is not a second
-- source of truth — it is the record of what was sent, which is the one fact a
-- later edit of the agent must not be able to change.
--
-- **THE MESSAGE ROLE CONSTRAINT IS INSPECTED AND DELIBERATELY UNCHANGED, and
-- that is this file's most load-bearing decision.** `agent_messages.role` admits
-- `'user'` and nothing else. The obvious way to show an answer is to widen it to
-- `('user','agent')` and insert a row when a run finishes — and that would be a
-- mistake twice over:
--
--   * IT WOULD BE A SECOND COPY OF A FACT THE JOURNAL ALREADY HOLDS. The run's
--     stop IS the result. A message row repeating it can disagree with it, and
--     the disagreeing case is the one where the screen shows an answer the run
--     never produced.
--   * IT WOULD MAKE A FORGED ANSWER A ROW THAT EXISTS. Today no client role has
--     INSERT here at all, but the SERVER does, and the only thing stopping the
--     server writing `role: 'agent'` from a request body would be our own care.
--     Left at `'user'`, a forged agent reply is not a bug to be prevented — it
--     is a row the database refuses, whatever any client or route asks for.
--
-- So an answer is DISPLAYED FROM THE RUN, through the link below, and the
-- browser cannot forge one because there is nowhere to put it. Widening this
-- stays what its original comment said it was: a deliberate migration, on the
-- day something needs a shape this one cannot express.
-- ============================================================================

-- ── the idempotency key ─────────────────────────────────────────────────────
--
-- A DOUBLE CLICK AND A LOST RESPONSE ARE THE SAME EVENT FROM THE BROWSER, and
-- both must produce one message and one run. The key is minted by the browser
-- per SEND (not per message row, and not per agent), so a retry of the same
-- press carries the same key and a genuinely new message carries a new one.
--
-- SCOPED TO THE AGENT rather than to the tenant: a conversation is the unit a
-- send belongs to, and two of one account's agents may not collide. The index is
-- what decides, never a read-then-insert — two presses in flight at once both
-- find nothing and both would insert.
alter table agent.agent_messages add column if not exists send_key text;

comment on column agent.agent_messages.send_key is
  'The browser''s own key for one send. Unique per agent, so a retried press is absorbed rather than duplicated.';

create unique index if not exists messages_one_send_per_agent
  on agent.agent_messages (agent_id, send_key)
  where send_key is not null;

-- ── the link ────────────────────────────────────────────────────────────────
--
-- WHICH RUN THIS MESSAGE STARTED. Null for every message written before this
-- existed, and for an imported conversation, which never ran.
--
-- **`on delete set null`, AND THE DIRECTION IS THE WHOLE REASON THIS IS SAFE.**
-- Runs are retained and then deleted; messages are the customer's writing and
-- are not. A cascade would mean a retention sweep quietly eating conversations,
-- so the pointer goes and the message stays. The reverse direction is not a
-- column at all: a run's own first entry names the agent and the message, where
-- it cannot be edited afterwards.
--
-- The earlier migration said "there is no foreign key between the two halves".
-- **That sentence is superseded and is corrected here rather than contradicted
-- in silence**: its reason was to keep mutable prose out of an append-only
-- store, which still holds — nothing about a run is written here. A pointer that
-- the database checks beats a bare uuid that can name a run nobody has.
alter table agent.agent_messages add column if not exists run_id uuid
  references agent.runs (id) on delete set null;

comment on column agent.agent_messages.run_id is
  'The run this message started, or null. The result is read from the run; it is never copied here.';

create index if not exists messages_by_run on agent.agent_messages (run_id)
  where run_id is not null;

-- ── reading a conversation and the work each message started ────────────────
--
-- ONE VIEW, BECAUSE THE ANSWER IS READ FROM THE RUN AND NEVER COPIED INTO THE
-- MESSAGE. That is the decision the role constraint above rests on: with no
-- `role: 'agent'` row to write, a result has to be JOINED at read time, and a
-- reader that had to make two requests and line them up in JavaScript would be
-- two places where a message could end up wearing another run's outcome.
--
-- **A VIEW RATHER THAN A POSTGREST EMBED, DELIBERATELY.** `agent_messages` has a
-- foreign key to `agent.runs` now, so `select=...,runs(status,stop)` would work
-- with no migration at all — and it could only ever be asserted from
-- documentation, because nothing in this repository can run PostgREST. A view is
-- plain SQL and `test/integration/pg-schema.mjs` drives it on a real
-- PostgreSQL. The same reasoning produced `agent.agent_overview`.
--
-- **`security_invoker = true` IS THE WHOLE SAFETY ARGUMENT, and here it spans
-- two tables.** Without it the view would run as its OWNER and be a hole through
-- the RLS on `agent_messages` AND on `agent.runs`. With it, a reader sees a
-- message only if the message's policy admits it and the run's outcome only if
-- the run's policy admits it — so a pointer at a run that is not the reader's
-- answers NULL rather than leaking a status. Fail-closed, in the one direction
-- that matters.
--
-- `run_step` IS THE PROGRESS, and it is the log's own highest step rather than a
-- counter anybody maintains — the same rule the run's `status` column follows.
-- NULL until the first model answer, which is honest: a queued run has not taken
-- a step.
--
-- ⚠ AND IT IS THE STEP, NOT THE STATUS, THAT SEPARATES QUEUED FROM WORKING —
-- measured, after an expectation written the other way round. `agent.runs.status`
-- is projected off the LOG, and `accept_run` writes the `started` entry in the
-- same transaction as the work row, so a run reads **`running` from the instant
-- it is accepted**; `new` belongs to a run row with no log at all. So a reader
-- should take `running` with no step as accepted-and-untouched and `running` with
-- a step as going through it.
--
-- **`agent.run_work` WOULD SAY IT MORE DIRECTLY AND IS DELIBERATELY NOT JOINED.**
-- `authenticated` holds nothing on that table, not even SELECT, by its own
-- design — so under `security_invoker` it would answer NULL for every customer,
-- and a NULL there reads exactly like a run that never started. A column that
-- lies to the reader it is for is worse than a column that is not there.
create or replace view agent.agent_thread
  with (security_invoker = true) as
select
  m.id,
  m.agent_id,
  m.seq,
  m.body,
  m.created_at,
  m.run_id,
  r.status     as run_status,
  r.stop       as run_stop,
  -- WHICH MODEL REALLY ANSWERED, and it is here so that "is this a simulation" is a
  -- fact about THIS RUN rather than about the product today. Connect a real provider
  -- and the runs that used it are not labelled, with no change to any reader.
  --
  -- ⚠ IT WAS MISSING FROM THE FIRST CUT, and the app read it anyway — `simulated` came
  -- back false for every answer while every unit guard passed, because the fixture
  -- answered a column the database did not have. Found by driving the whole flow
  -- against a real PostgreSQL, which is the only place that gap is visible.
  r.model      as run_model,
  r.started_at as run_started_at,
  r.stopped_at as run_stopped_at,
  prog.step    as run_step
from agent.agent_messages m
left join agent.runs r on r.id = m.run_id
left join lateral (
  select max(e.step) as step from agent.run_entries e where e.run_id = m.run_id
) prog on true;

comment on view agent.agent_thread is
  'One row per message with the state of the run it started. security_invoker, so RLS on agent_messages, agent.runs and agent.run_entries all apply to whoever reads it.';

-- The same grants the tables carry: `authenticated` may READ its own rows (RLS
-- decides which), the server reads through `service_role`, `anon` is refused.
grant select on agent.agent_thread to authenticated, service_role;
revoke all on agent.agent_thread from anon;

-- ── how much conversation one run is given ──────────────────────────────────
--
-- A BOUND IN THE DATABASE BECAUSE THIS IS WHERE THE HISTORY IS ASSEMBLED. The
-- engine's rule is that a cap the model is only told about is not a cap; this is
-- the same rule one layer down. The NEWEST turns, because a conversation is read
-- at its live end — ordering ascending with a limit would pin a long
-- conversation to its oldest screen for ever.
create or replace function agent.history_turns() returns integer
  language sql immutable
  set search_path = ''
as $$ select 20 $$;

comment on function agent.history_turns() is
  'How many previous turns a run is started with. A function so the number has one home.';

-- ── what an authored run is allowed to be ───────────────────────────────────
--
-- **THE APP CANNOT SUPPLY ANY OF THIS, AND THAT IS THE REQUIREMENT RATHER THAN A
-- STYLE.** Tool permissions and execution limits are the server's. The first cut
-- of `send_to_agent` took the whole first entry as an argument and merged the
-- snapshot over it — so a caller still decided the model and the bounds, and the
-- only thing between a bug in the app and a run with sixteen steps and sixty-four
-- tool calls was the app's own care. There is nothing to decide now: the entry is
-- built HERE, from this.
--
-- **IT IS A COPY OF `AUTHORED` IN `agent-builder/src/agents.mjs`, DECLARED AS ONE.**
-- The registry is code and is loaded at import, so it cannot be read from SQL, and
-- the transaction that has to be atomic is here — there is no arrangement in which
-- one of the two does not hold a copy. What keeps them equal is a CENSUS that
-- reads both (`agent-builder/test/authored-run.test.mjs`), comparing this
-- function's own answer against `limitsToJson(AUTHORED.authored.limits)` and its
-- name and model, in both directions. A copy with a census both ways is this
-- repository's standard remedy; a copy without one is how a bound gets tightened
-- in one place for a year.
--
-- ⚠ `toolCalls` IS ONE AND MUST NOT BE ZERO. `toolCalls` is a RUN TOTAL and the
-- engine's `stoppedBy` asks `used >= limit`, so a zero budget is a total already
-- spent and the run stops BEFORE its first model call. Measured; it is recorded
-- beside the registry entry too. The wall is the agent's EMPTY TOOL LIST, which
-- lives in code and cannot be reached from here at all.
create or replace function agent.authored_run() returns jsonb
  language sql immutable
  set search_path = ''
as $$
  select jsonb_build_object(
    'agent', 'authored',
    'model', 'stand-in',
    -- **ALL EIGHT, NOT THE FOUR THIS AGENT OVERRIDES**, and the census is what
    -- found that. The engine's API path writes `limitsToJson(agent.limits)` and
    -- `defineAgent` has already planned them, so the entry there carries the whole
    -- set. Writing only the overrides here would leave the other four to be filled
    -- in from whatever the DEFAULTS are on the day a run is REPLAYED — which is
    -- exactly the drift recording the bounds in the log exists to prevent. The
    -- effective bounds would be identical today and would differ the day a default
    -- moves.
    'limits', jsonb_build_object(
      'steps', 2,
      'toolCalls', 1,
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

-- ── the one transaction ─────────────────────────────────────────────────────
--
-- **`SECURITY DEFINER`, AND IT HAS TO BE.** `insert on agent.run_entries` is
-- revoked from `service_role` — the role the server runs as — so the only things
-- that can write the log are `append_entry` and `accept_run`. This function
-- reaches the second, so it runs as the owner, with `search_path` pinned empty
-- and every name qualified.
--
-- **IT CALLS `agent.accept_run` RATHER THAN REPEATING ITS THREE INSERTS.** That
-- function is the queue's own door: the run row, the log's first entry and the
-- work row, together or not at all. A second copy of those inserts here would be
-- a second definition of what "accepted" means, and the copy that drifts is the
-- one that leaves a run with a log and nothing to run it.
--
-- **THE ORDER IS THE RETRY-SAFETY ARGUMENT, and it is the one thing here that
-- cannot be reordered.** The MESSAGE goes in first, because its key is the gate:
-- if a repeat is going to be absorbed, it must be absorbed BEFORE any run
-- exists. Minting the run first would leave a second press having created a run
-- and a work row that no message points at — and the queue would execute it,
-- which is the duplicate this function exists to prevent, wearing the clothes of
-- an orphan.
--
-- **AND THE SNAPSHOT IS READ HERE, NOT PASSED IN.** The caller hands over the
-- entry it built (one producer of that shape, as the engine requires), and the
-- three snapshot fields are MERGED OVER it from rows read in this transaction.
-- So the instructions a run uses cannot come from a request body, cannot come
-- from the server's own earlier read, and cannot change afterwards: they are
-- whatever this agent's row said at the instant the work was accepted.
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

  -- ── the message, and the key is the gate ──────────────────────────────────
  -- No `role` is supplied: the column's default and its check decide, exactly as
  -- every other writer here does.
  insert into agent.agent_messages (id, agent_id, body, send_key)
  values (p_message_id, p_agent_id, p_body, v_key)
  on conflict (agent_id, send_key) where send_key is not null
  do nothing
  returning * into v_msg;

  if v_msg.id is null then
    -- THIS SEND ALREADY LANDED — an earlier press whose answer was lost, or a
    -- second press racing this one. Answer what it produced and start NOTHING:
    -- a second run here would be two executions of one message, which is the
    -- defect this key exists to close.
    select * into v_msg from agent.agent_messages
     where agent_id = p_agent_id and send_key = v_key;
    if v_msg.id is null then
      raise exception 'send_to_agent: the send conflicted with a row that is not there';
    end if;
    return jsonb_build_object(
      'ok', true, 'repeat', true,
      'message_id', v_msg.id, 'run_id', v_msg.run_id,
      -- THE STORED BODY, NEVER THE ONE THIS CALL SENT. They differ exactly when a
      -- retry carries different text under the same key — a client bug — and the
      -- honest answer is what the conversation really holds, not what was asked
      -- for and absorbed.
      'body', v_msg.body,
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
  -- the instructions and the conversation are read from rows in THIS transaction,
  -- so a later edit of the agent cannot reach a run that has already been
  -- accepted; and the two pointers are the ids this function was given, after the
  -- ownership check above proved whose they are.
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
  'One transaction: save a message to an owned agent and accept a run for it. Idempotent per (agent, send_key).';

-- ── who may call it ─────────────────────────────────────────────────────────
--
-- THE SERVER, AND NOBODY ELSE. It takes the tenant as an argument, which is only
-- safe because no client role can execute it — the same posture `import_agent`
-- and `accept_run` have. A customer reaching this could start work as anybody.
revoke all on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) from public;
grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role;

-- `history_turns` is read inside the function above and is harmless to call, but
-- it is not part of anybody's API.
revoke all on function agent.history_turns() from public;
grant execute on function agent.history_turns() to service_role;
