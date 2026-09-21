-- ═══════════════════════════════════════════════════════════════════════════════
-- AN OPERATION HAPPENS ONCE, HOWEVER MANY TIMES IT IS DELIVERED (2026-09-17)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ⚠ THE DEFECT THIS CLOSES WAS REPRODUCED FIRST, against these migrations on a real
-- PostgreSQL, through the real capability store:
--
--     1. the agent remembers  tone = formal   -> created,   v1, by run
--     2. the answer is LOST   (the process dies between the commit and the journal
--                              write, which is exactly a PENDING TOOL CALL)
--     3. the person corrects  tone = casual   -> corrected, v2, by person
--     4. the run is delivered again and the pending call is re-run
--                              tone = formal   -> corrected, v3, by run
--
--   The person's correction is gone, and the retry ANSWERED `saved: "corrected"` —
--   it knew it was changing something and nothing was looking.
--
-- **REPEATING AN UPSERT IS NOT HARMLESS WHEN SOMETHING ELSE HAPPENED IN BETWEEN.**
-- `remember` is declared `repeatable` on the reasoning that "an upsert by the fact's own
-- name leaves the state running it once does" — true of a world where nothing else wrote,
-- which is not the world a durable queue lives in. *A rule true because of a layer below it
-- expires when that layer moves*, and the layer here is "who else may write to this row".
--
-- ── THE IDENTITY IS THE POSITION; THE ARGUMENTS ARE STORED BESIDE IT ──────────
--
-- `ctx.operation` is `<run>:<step>:<index>:<the arguments' own hash>`. The KEY is the first
-- three — one tool call in one run at one position — and the HASH is a column. **Folding
-- the hash into the key would make this table unable to state its own rule**: two different
-- argument sets would produce two different keys and therefore two separate operations,
-- silently, which is the one outcome the requirement names. Kept apart, a slot re-filled
-- with a different call meets the same key with a different hash and is REFUSED.
--
-- ── AND THE RECORD COMMITS WITH THE MUTATION, WHICH IS THE WHOLE POINT ───────
--
-- One PostgREST call is one transaction, so the claim, the mutation and the outcome are one
-- commit or none. There is no window in which the work happened and nothing knows.

create table if not exists agent.operations (
  tenant_id   text        not null,
  -- `<run>:<step>:<index>` — the POSITION, never the arguments. See above.
  op_key      text        not null,
  -- WHICH action, so a record can be read by a person and so a key cannot be reused for a
  -- different kind of work even with a matching hash.
  action      text        not null,
  -- The arguments' own fingerprint, computed by the engine (`argsHash`) and compared here.
  args_hash   text        not null,
  -- The originating run, for scope and for audit. NULL for a caller with no run (nothing
  -- does that today; the column does not refuse it, because a person's own press is the
  -- obvious next caller and its identity is not a run).
  run_id      uuid,
  -- WHAT TO ANSWER ON A RETRY.
  --
  -- ⚠ **NULLABLE SINCE 2026-09-18, AND THE NULL IS A STATE RATHER THAN A GAP.** It was `not
  -- null` on the reasoning that "a row exists only once its outcome is known, because claim
  -- and outcome are one transaction" — true of every caller then, and false of the one item 8
  -- adds. **AN OUTBOUND CALL CANNOT BE IN THE CALLER'S TRANSACTION**: you claim, you send, and
  -- you may never learn what happened. So the in-flight moment is real, and `outcome is null`
  -- IS that moment — which `operation_check` has read as `unfinished` since it was written,
  -- with its own comment calling the state unreachable. It is reachable now.
  --
  -- **ONE FACT, ONE COLUMN.** A `state` column beside this would be a second copy of the same
  -- thing, and the copy that drifts is the one deciding whether a payment may be sent again.
  -- `operation_record` still REFUSES a null outcome, so the one-transaction callers cannot
  -- reach the new state by forgetting; `operation_begin` is the only door into it.
  outcome     jsonb,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, op_key),
  constraint operations_key_shaped    check (op_key ~ '^[^\s]{1,200}$'),
  constraint operations_action_shaped check (action ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint operations_hash_shaped   check (args_hash ~ '^[0-9a-zA-Z+/=_-]{1,200}$')
);

-- READ BY OP_KEY WITHIN A TENANT is the primary key, so no second index is needed. THIS
-- one is for retention and for reading an audit by run, which the primary key cannot serve.
create index if not exists operations_by_run on agent.operations (tenant_id, run_id);

alter table agent.operations enable row level security;
alter table agent.operations force row level security;

-- ⚠ A TENANT MAY READ ITS OWN RECORDS AND WRITE NOTHING, exactly as with the journal.
-- These rows say what an agent did on somebody's behalf, so they are theirs to see; the
-- writing is `service_role`'s, through the functions below and nowhere else.
create policy operations_are_the_tenants on agent.operations
  for select to authenticated using (tenant_id = agent.tenant_id());

grant usage on schema agent to service_role;
grant select on agent.operations to authenticated;
grant select, insert on agent.operations to service_role;
-- NO UPDATE AND NO DELETE FOR ANYBODY. An outcome that can be rewritten is an outcome a
-- retry cannot be answered from, and the record's whole value is that it does not move.
revoke update, delete on agent.operations from service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- THE ONE RULE, ASKED BY EVERY WRAPPER BELOW
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- `state` is one of:
--   `fresh`    — this key is ours; do the work, then record the outcome.
--   `repeat`   — the same call already happened; ANSWER `outcome` and do nothing.
--   `mismatch` — the same key with DIFFERENT arguments. Refused: a slot re-filled with
--                another call is another operation, and letting it through silently is
--                the requirement's own counterexample.
--   `unfinished` — a committed claim with no outcome. Unreachable while every caller keeps
--                claim and outcome in one transaction, and named rather than read as a
--                repeat with a null answer, because cannot-tell must never read as a value.
create or replace function agent.operation_check(
  p_tenant    text,
  p_op_key    text,
  p_action    text,
  p_args_hash text
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row agent.operations%rowtype;
begin
  select * into v_row from agent.operations o
   where o.tenant_id = p_tenant and o.op_key = p_op_key;
  if not found then
    return jsonb_build_object('state', 'fresh');
  end if;
  -- THE ACTION IS PART OF THE IDENTITY. A key belonging to a different kind of work is a
  -- mismatch even if its hash happens to agree, because the answer would be another
  -- operation's answer.
  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then
    return jsonb_build_object('state', 'mismatch', 'action', v_row.action, 'recordedAt', v_row.recorded_at);
  end if;
  if v_row.outcome is null then
    return jsonb_build_object('state', 'unfinished');
  end if;
  return jsonb_build_object('state', 'repeat', 'outcome', v_row.outcome, 'recordedAt', v_row.recorded_at);
end $$;

-- Record what happened, in the caller's own transaction.
--
-- ⚠ `on conflict do nothing` IS THE RACE, AND IT IS THE DATABASE'S TO DECIDE. Two
-- deliveries of one call can both read `fresh` — their reads take different snapshots — and
-- both do the work. One of them wins the primary key; the loser's insert is skipped, AND ITS
-- WHOLE TRANSACTION IS ROLLED BACK by the caller raising `agent_operation_lost`, so the
-- mutation it performed goes with it. **Exactly one of the two changes anything**, and the
-- loser then answers the winner's recorded outcome. A check in the caller would be a race
-- wearing a wall's clothes.
create or replace function agent.operation_record(
  p_tenant    text,
  p_op_key    text,
  p_action    text,
  p_args_hash text,
  p_run_id    uuid,
  p_outcome   jsonb
) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  -- `row_count` IS AN INTEGER, so the variable it lands in is one. Declared `boolean` at
  -- first, which Postgres refused outright (`operator does not exist: boolean = integer`) —
  -- loud, immediately, and the right way round for a type mistake.
  v_rows integer;
begin
  if p_outcome is null then
    raise exception 'operation_record: an outcome is required' using errcode = 'check_violation';
  end if;
  insert into agent.operations (tenant_id, op_key, action, args_hash, run_id, outcome)
  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, p_outcome)
  on conflict (tenant_id, op_key) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

revoke all on function agent.operation_check(text, text, text, text) from public;
revoke all on function agent.operation_record(text, text, text, text, uuid, jsonb) from public;
grant execute on function agent.operation_check(text, text, text, text) to service_role;
grant execute on function agent.operation_record(text, text, text, text, uuid, jsonb) to service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- AN OUTBOUND ACTION THAT MAY OR MAY NOT HAVE LANDED
--
-- ⚠ **`agent.operations` ALREADY HAD THE STATE THIS NEEDS, AND ITS OWN COMMENT CALLED IT
-- UNREACHABLE.** `operation_check` answers `unfinished` when `outcome is null`, which was
-- impossible while every caller wrote claim and outcome in one transaction. An OUTBOUND
-- call cannot: you claim, you send, and you may never learn. So the column is nullable now
-- (see its own note) and these two functions are the door into and out of the in-flight
-- state.
--
-- **WHAT THIS BUYS IS THE MILESTONE'S OWN SENTENCE**: a provider with no idempotency needs
-- RECONCILIATION rather than a blind retry. A redelivery that finds `unfinished` asks the
-- provider what it sees and settles the record from the answer. It never re-sends.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function agent.operation_begin(
  p_tenant    text,
  p_op_key    text,
  p_action    text,
  p_args_hash text,
  p_run_id    uuid default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_rows integer;
  v_row  agent.operations%rowtype;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'operation_begin: tenant must be a non-empty string';
  end if;
  -- CLAIM THE SLOT WITH NO OUTCOME. The primary key is the race, exactly as
  -- `operation_record`'s is: two deliveries both reading `fresh` cannot both claim.
  insert into agent.operations (tenant_id, op_key, action, args_hash, run_id, outcome)
  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, null)
  on conflict (tenant_id, op_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    return jsonb_build_object('ok', true, 'began', true);
  end if;
  -- SOMEBODY ELSE HAS IT. Answer what they left, so the caller reconciles or repeats rather
  -- than sending. The three readings are the same three `operation_check` gives.
  select * into v_row from agent.operations
   where tenant_id = p_tenant and op_key = p_op_key;
  if v_row.op_key is null then
    -- A row that was there and is not: nothing here deletes one, so this is a state this
    -- function cannot explain and must not guess about.
    return jsonb_build_object('ok', false, 'error', 'lost', 'action', p_action);
  end if;
  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then
    return jsonb_build_object('ok', false, 'error', 'mismatch', 'action', v_row.action);
  end if;
  if v_row.outcome is null then
    return jsonb_build_object('ok', true, 'began', false, 'state', 'unfinished');
  end if;
  return jsonb_build_object('ok', true, 'began', false, 'state', 'repeat', 'outcome', v_row.outcome);
end $$;

comment on function agent.operation_begin(text, text, text, text, uuid) is
  'Claim an operation BEFORE the outbound call, with no outcome. The primary key is the race. A caller that does not win is told what is there — unfinished, so reconcile; or a recorded outcome, so answer it — and in neither case does it send.';

create or replace function agent.operation_settle(
  p_tenant    text,
  p_op_key    text,
  p_action    text,
  p_args_hash text,
  p_outcome   jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row agent.operations%rowtype;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'operation_settle: tenant must be a non-empty string';
  end if;
  if p_outcome is null then
    raise exception 'operation_settle: an outcome is required' using errcode = 'check_violation';
  end if;
  -- ⚠ **ONLY AN IN-FLIGHT ROW MAY BE SETTLED, AND ONLY WITH ITS OWN IDENTITY.**
  -- `outcome is null` in the WHERE is what makes this write-once: a settled operation can
  -- never be rewritten, which is the same property `agent.operations` has no UPDATE grant
  -- for. The action and the hash are there because a key belonging to different work must
  -- not be settled by this call's answer.
  update agent.operations
     set outcome = p_outcome, recorded_at = now()
   where tenant_id = p_tenant and op_key = p_op_key
     and action = p_action and args_hash = p_args_hash
     and outcome is null
  returning * into v_row;
  if v_row.op_key is not null then
    return jsonb_build_object('ok', true, 'settled', true);
  end if;
  -- NOT SETTLED, AND WHY IS THREE DIFFERENT THINGS.
  select * into v_row from agent.operations
   where tenant_id = p_tenant and op_key = p_op_key;
  if v_row.op_key is null then
    return jsonb_build_object('ok', false, 'error', 'no-operation');
  end if;
  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then
    return jsonb_build_object('ok', false, 'error', 'mismatch', 'action', v_row.action);
  end if;
  -- ALREADY SETTLED IS NOT A FAILURE: a retry that reconciled to the same answer is the
  -- ordinary case, and the answer that STANDS is the one that was written first.
  return jsonb_build_object('ok', true, 'settled', false, 'outcome', v_row.outcome);
end $$;

comment on function agent.operation_settle(text, text, text, text, jsonb) is
  'Fill in an in-flight operation''s outcome. Write-once by `outcome is null` in the WHERE, so a settled operation can never be rewritten; already-settled answers what stands rather than failing.';

revoke all on function agent.operation_begin(text, text, text, text, uuid) from public;
revoke all on function agent.operation_settle(text, text, text, text, jsonb) from public;
grant execute on function agent.operation_begin(text, text, text, text, uuid) to service_role;
grant execute on function agent.operation_settle(text, text, text, text, jsonb) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SIX WRAPPERS, ONE SHAPE — the mutating operations, performed once
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ⚠ **WRAPPERS RATHER THAN NEW PARAMETERS ON THE SIX FUNCTIONS THEMSELVES, and the reason
-- is this repository's own two recorded traps.** Adding `p_operation` to each would mean
-- re-emitting six whole bodies into a fifth file — a second copy of ~700 lines, and the copy
-- that drifts is the one deciding what a customer's data becomes; and a new DEFAULTED
-- parameter creates an OVERLOAD rather than replacing anything, so the old signature would
-- stay reachable beside the new one, which is the bypass door `beat_run` had to have dropped.
-- A wrapper leaves all six exactly as they are, so every existing caller — the site's own
-- routes, `tick_automations`, the scheduler — is byte-identical.
--
-- **EACH IS THE SAME FIVE MOVES, so a census can read them**: ask the rule, answer a repeat,
-- refuse anything that is not `fresh`, do the work through the UNCHANGED function with NAMED
-- arguments, record the outcome — and if the record was lost to a concurrent twin, roll the
-- work back with it and answer the twin's.
--
-- ⚠ **THE INNER CALL IS BY NAME, NEVER BY POSITION.** Two of these six already carry a
-- defaulted parameter that had to be moved once because a positional call bound the wrong
-- one; naming them here means a parameter added to any of the six can never silently re-bind
-- through this layer.

create or replace function agent.save_memory_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_agent_id uuid,
  p_key      text,
  p_value    text,
  p_id       uuid,
  p_source   text,
  p_max      integer
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'save_memory', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.save_memory(p_tenant := p_tenant, p_agent_id := p_agent_id, p_key := p_key, p_value := p_value, p_id := p_id, p_source := p_source, p_max := p_max);
    if not agent.operation_record(p_tenant, p_op_key, 'save_memory', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'save_memory', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'save_memory');
  end if;
  return v_out;
end $$;

revoke all on function agent.save_memory_once(text, text, text, uuid, uuid, text, text, uuid, text, integer) from public;
grant execute on function agent.save_memory_once(text, text, text, uuid, uuid, text, text, uuid, text, integer) to service_role;

create or replace function agent.delete_memory_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_agent_id uuid,
  p_key      text
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'delete_memory', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.delete_memory(p_tenant := p_tenant, p_agent_id := p_agent_id, p_key := p_key);
    if not agent.operation_record(p_tenant, p_op_key, 'delete_memory', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'delete_memory', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'delete_memory');
  end if;
  return v_out;
end $$;

revoke all on function agent.delete_memory_once(text, text, text, uuid, uuid, text) from public;
grant execute on function agent.delete_memory_once(text, text, text, uuid, uuid, text) to service_role;

create or replace function agent.set_automation_enabled_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_id      uuid,
  p_enabled boolean
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'set_automation_enabled', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.set_automation_enabled(p_tenant := p_tenant, p_id := p_id, p_enabled := p_enabled);
    if not agent.operation_record(p_tenant, p_op_key, 'set_automation_enabled', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'set_automation_enabled', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'set_automation_enabled');
  end if;
  return v_out;
end $$;

revoke all on function agent.set_automation_enabled_once(text, text, text, uuid, uuid, boolean) from public;
grant execute on function agent.set_automation_enabled_once(text, text, text, uuid, uuid, boolean) to service_role;

-- ── SWITCHING AN INBOUND ENDPOINT IS A WRITE, SO IT NEEDS ITS OPERATION RECORD ─────────────
--
-- ⚠ **WITHOUT THIS THE TOOL COULD NEVER HAVE WORKED, and the demonstration is what said so.**
-- `set_event_endpoint` is `writes: true`, so `makeCapabilities`' `mutate` composes
-- `<rpc>_once` — `agent.set_webhook_enabled_once` — and there was no such function: PostgREST
-- answers `PGRST202`, the capability refuses, and the agent is told **its own endpoint does not
-- exist**. A dead control that ANSWERS, which is this repository's worst recorded shape of that
-- finding, and no unit guard could see it: every one of them drives a FAKE `fetch`, so the
-- composed name is never resolved against anything. `verify:tools` section 7e found it on its
-- first run, in one check, by reading the ROW rather than the sentence.
--
-- **IT IS THE SAME SHAPE AS ITS SIBLINGS AND DELIBERATELY NOT A NEW ONE** — the record is the
-- arbiter of every failure, a committed twin's answer is authoritative, and anything else is
-- re-raised as itself. A second design for one contract is how two of them come to disagree
-- about what a retry means. The only per-operation parts are the action's NAME and the inner
-- call, which is why this is that shape rather than a call into a shared one: PL/pgSQL cannot
-- invoke a named function with a caller-shaped argument list without dynamic SQL, and dynamic
-- SQL here would take a function name from a string.
--
-- ⚠ **AND IT LIVES IN THIS FILE RATHER THAN IN THE NEW ONE**, because the operations table's
-- doors belong in one place — the reason `operation_begin` and `operation_settle` were put here
-- rather than beside the connections they were written for.

create or replace function agent.set_webhook_enabled_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_id      uuid,
  p_enabled boolean
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'set_webhook_enabled', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.set_webhook_enabled(p_tenant := p_tenant, p_id := p_id, p_enabled := p_enabled);
    if not agent.operation_record(p_tenant, p_op_key, 'set_webhook_enabled', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'set_webhook_enabled', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'set_webhook_enabled');
  end if;
  return v_out;
end $$;

revoke all on function agent.set_webhook_enabled_once(text, text, text, uuid, uuid, boolean) from public;
grant execute on function agent.set_webhook_enabled_once(text, text, text, uuid, uuid, boolean) to service_role;

create or replace function agent.accept_automation_run_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_automation_id uuid,
  p_run_id        uuid,
  p_trigger       text,
  p_occurrence    date,
  p_input         jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'accept_automation_run', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.accept_automation_run(p_tenant := p_tenant, p_automation_id := p_automation_id, p_run_id := p_run_id, p_trigger := p_trigger, p_occurrence := p_occurrence, p_input := p_input);
    if not agent.operation_record(p_tenant, p_op_key, 'accept_automation_run', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'accept_automation_run', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'accept_automation_run');
  end if;
  return v_out;
end $$;

revoke all on function agent.accept_automation_run_once(text, text, text, uuid, uuid, uuid, text, date, jsonb) from public;
grant execute on function agent.accept_automation_run_once(text, text, text, uuid, uuid, uuid, text, date, jsonb) to service_role;

create or replace function agent.create_automation_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_agent_id uuid,
  p_id       uuid,
  p_name     text,
  p_enabled  boolean,
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_steps    jsonb,
  p_max      integer,
  p_inputs   jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'create_automation', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.create_automation(p_tenant := p_tenant, p_agent_id := p_agent_id, p_id := p_id, p_name := p_name, p_enabled := p_enabled, p_schedule := p_schedule, p_at_local := p_at_local, p_zone := p_zone, p_steps := p_steps, p_max := p_max, p_inputs := p_inputs);
    if not agent.operation_record(p_tenant, p_op_key, 'create_automation', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'create_automation', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'create_automation');
  end if;
  return v_out;
end $$;

revoke all on function agent.create_automation_once(text, text, text, uuid, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb) from public;
grant execute on function agent.create_automation_once(text, text, text, uuid, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb) to service_role;

create or replace function agent.update_automation_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_id       uuid,
  p_name     text,
  p_enabled  boolean,
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_steps    jsonb,
  p_inputs   jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'update_automation', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT. The mark is additive so every field the
    -- first attempt answered comes back unchanged, and a caller that ignores it is correct.
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  -- ⚠ A SUBTRANSACTION, AND IT CATCHES EVERYTHING — because the race can be lost in two
  -- different places and only one of them was obvious.
  --
  -- The obvious one is the operation record's own primary key. The other was MEASURED, by a
  -- concurrency check bought for exactly that purpose: two first attempts both read `fresh`,
  -- both call the inner function, and **the INNER function's own unique key refuses one of
  -- them** — `duplicate key value violates unique constraint "agent_memory_one_per_key"`,
  -- HTTP 409, where the caller wanted the twin's answer. The inner functions are not
  -- concurrency-safe on their own and were never asked to be.
  --
  -- **SO THE RECORD IS THE ARBITER OF EVERY FAILURE, not of its own.** Anything that goes
  -- wrong rolls the work back, and then the record decides what it was: a committed twin
  -- means we lost a race and its answer is the authoritative one; no twin means the failure
  -- is genuinely ours and is RE-RAISED with its own code and message. Swallowing it would
  -- turn a real refusal into a silent `ok: false`, which is the direction that loses work.
  begin
    v_out := agent.update_automation(p_tenant := p_tenant, p_id := p_id, p_name := p_name, p_enabled := p_enabled, p_schedule := p_schedule, p_at_local := p_at_local, p_zone := p_zone, p_steps := p_steps, p_inputs := p_inputs);
    if not agent.operation_record(p_tenant, p_op_key, 'update_automation', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    -- `on conflict do nothing` waits for a conflicting twin, and every statement takes a
    -- fresh snapshot under READ COMMITTED — so by the time we are here the twin has
    -- finished, and if it committed, this read sees it.
    v_check := agent.operation_check(p_tenant, p_op_key, 'update_automation', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    -- NOT THE RACE. Our own failure, and it goes out as itself. The message carries
    -- Postgres's own words (the constraint name included); DETAIL and HINT are lost to the
    -- re-raise, which is stated rather than glossed.
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    -- `AG001` with no twin to read is the one residue: the record was taken and is gone
    -- again, which means the twin rolled back after winning the key. Named rather than
    -- retried here, because a retry belongs to whoever can decide to make one.
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'update_automation');
  end if;
  return v_out;
end $$;

revoke all on function agent.update_automation_once(text, text, text, uuid, uuid, text, boolean, text, time, text, jsonb, jsonb) from public;
grant execute on function agent.update_automation_once(text, text, text, uuid, uuid, text, boolean, text, time, text, jsonb, jsonb) to service_role;
