-- ══════════════════════════════════════════════════════════════════════════
-- THE OPERATIONS BOTH SIDES RUN — one definition each, in the database
--
-- ⚠ THE PROBLEM THIS SOLVES IS A SECOND COPY, NOT A MISSING FEATURE. A customer can
-- already search their reference material, correct a memory and start an automation from
-- the screen; the milestone is that their AGENT can do those things too, "using the same
-- underlying operations as the frontend". The two live in different Workers and neither
-- may import the other — `worker.js`'s module graph is a container image input — so a
-- shared JavaScript module is not available. **What both CAN share is the database**, and
-- a function here is one definition rather than two that drift.
--
-- **EVERY FUNCTION TAKES THE TENANT AS AN ARGUMENT AND PUTS IT IN THE LOOKUP.** That is
-- the wall, and `security definer` is why it has to be: these run as the owner, so RLS is
-- bypassed and the filter is the only thing between one account and another's. It is the
-- same posture `send_to_agent` and `create_automation` already have, and it is why the
-- CALLER's obligation — that the tenant came from a verified token and never from a
-- request body or a model's arguments — is stated in both products' notes.
--
-- **AN AGENT'S ID IS CHECKED AGAINST THE TENANT EVERY TIME, never trusted from the
-- caller.** `agent.owns_agent` is asked inside each function rather than by the caller,
-- so there is no door that reaches a row without it.
--
-- **NOT FOUND, NEVER FORBIDDEN.** Another account's agent and one that does not exist
-- answer the same `no-agent`, because the difference between them is information: a
-- refusal that says "forbidden" tells a stranger the id they guessed is real.
--
-- **COUNT CAPS ARRIVE AS ARGUMENTS, exactly as `create_automation`'s `p_max` does.** A
-- cap is a product decision and lives with the product; what lives here is the SHAPE
-- (the column checks, already in force) and the refusal. Both callers pass their own
-- constant and a census compares them, which is the arrangement this pair already has.
--
-- ⚠ AND A NEW DEFAULTED PARAMETER GOES AFTER THE EXISTING ONES, ALWAYS. Writing one
-- above another silently re-binds every positional caller — measured once on
-- `create_automation`, where it turned 30 checks red, none of them about the new field.
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 0. WHOSE AGENT IT IS — asked by every function below, and by nothing else
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.owns_agent(p_tenant text, p_agent_id uuid)
  returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from agent.agents a
     where a.id = p_agent_id and a.tenant_id = p_tenant);
$$;

comment on function agent.owns_agent(text, uuid) is
  'Whether this account owns that agent. Answered as a boolean so a caller cannot tell "not yours" from "not there".';

-- ──────────────────────────────────────────────────────────────────────────
-- 1. REFERENCE MATERIAL — listing it, and reading one source whole
--
-- ⚠ THE LIST NEVER CARRIES THE MATERIAL. Twenty sources at 200,000 characters is four
-- megabytes to draw a list of names, so opening one is its own read. That is the screen's
-- own rule and it is now the database's, which is what stops a tool being the cheap way
-- to pull every document an account holds in one call.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.list_knowledge(p_tenant text, p_agent_id uuid)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return;
  end if;
  return query
    select jsonb_build_object(
             'id', k.id, 'title', k.title, 'version', k.version,
             'format', k.format, 'characters', length(k.body),
             'updatedAt', k.updated_at)
      from agent.agent_knowledge k
     where k.tenant_id = p_tenant and k.agent_id = p_agent_id
     order by lower(k.title) asc;
end; $$;

comment on function agent.list_knowledge(text, uuid) is
  'One agent''s reference sources by name, with no material in them. An agent that is not this account''s answers nothing.';

create or replace function agent.read_knowledge(p_tenant text, p_source_id uuid)
  returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', k.id, 'agent', k.agent_id, 'title', k.title, 'body', k.body,
           'version', k.version, 'format', k.format, 'updatedAt', k.updated_at)
    from agent.agent_knowledge k
   where k.id = p_source_id and k.tenant_id = p_tenant;
$$;

comment on function agent.read_knowledge(text, uuid) is
  'One source whole, by id, scoped to the account. Answers nothing for a source that is not theirs.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. MEMORY — reading, correcting and forgetting a named fact
--
-- **A CORRECTION IS AN UPSERT AND IT BUMPS THE VERSION ONLY WHEN THE TEXT MOVED.** A
-- version says which words a run quoted, so renaming nothing must not move it — and
-- saving the same value twice has to be the same row, or a retry becomes a second
-- version of a fact nobody changed.
--
-- **THE CEILING IS ASKED ONLY FOR A NAME THIS AGENT DOES NOT ALREADY HOLD**, or
-- correcting the last one would be refused by the cap it is already inside.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.list_memory(p_tenant text, p_agent_id uuid)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return;
  end if;
  return query
    select jsonb_build_object(
             'id', m.id, 'name', m.key, 'value', m.value, 'version', m.version,
             'source', m.source, 'updatedAt', m.updated_at)
      from agent.agent_memory m
     where m.tenant_id = p_tenant and m.agent_id = p_agent_id
     order by m.key asc;
end; $$;

comment on function agent.list_memory(text, uuid) is 'One agent''s remembered facts, by name.';

create or replace function agent.save_memory(
  p_tenant   text,
  p_agent_id uuid,
  p_key      text,
  p_value    text,
  p_id       uuid,
  p_source   text default 'person',
  p_max      integer default 100
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_key   text := lower(btrim(coalesce(p_key, '')));
  v_value text := btrim(coalesce(p_value, ''));
  v_held  integer;
  v_row   agent.agent_memory%rowtype;
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;
  -- ⚠ THE NAME'S GRAMMAR IS THE COLUMN'S OWN, asked here so the answer is a sentence
  -- rather than a constraint violation a caller has to parse.
  if v_key !~ '^[a-z][a-z0-9_]{0,39}$' then
    return jsonb_build_object('ok', false, 'error', 'bad-name');
  end if;
  if v_value = '' then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  -- THE LENGTH IS THE COLUMN'S TOO, and is asked for the same reason.
  if length(v_value) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'too-long');
  end if;
  -- WHO SAID SO IS A CLOSED SET. `person` is somebody typing; `run` is work that learned
  -- it. Anything else is refused rather than stored, because a value nobody can account
  -- for is one nobody can correct.
  if p_source is null or p_source not in ('person', 'run') then
    return jsonb_build_object('ok', false, 'error', 'bad-source');
  end if;

  select * into v_row from agent.agent_memory m
   where m.tenant_id = p_tenant and m.agent_id = p_agent_id and m.key = v_key;

  if not found then
    select count(*) into v_held from agent.agent_memory m
     where m.tenant_id = p_tenant and m.agent_id = p_agent_id;
    if v_held >= coalesce(p_max, 100) then
      return jsonb_build_object('ok', false, 'error', 'too-many', 'held', v_held);
    end if;
    insert into agent.agent_memory (id, tenant_id, agent_id, key, value, source)
    values (coalesce(p_id, gen_random_uuid()), p_tenant, p_agent_id, v_key, v_value, p_source)
    returning * into v_row;
    return jsonb_build_object('ok', true, 'saved', 'created', 'memory',
      jsonb_build_object('id', v_row.id, 'name', v_row.key, 'value', v_row.value,
                         'version', v_row.version, 'source', v_row.source));
  end if;

  -- ⚠ THE VERSION MOVES ON A CHANGE OF VALUE AND ON NOTHING ELSE. Saving the same words
  -- again is the same fact, so a retry is absorbed rather than counted.
  if v_row.value = v_value and v_row.source = p_source then
    return jsonb_build_object('ok', true, 'saved', 'unchanged', 'memory',
      jsonb_build_object('id', v_row.id, 'name', v_row.key, 'value', v_row.value,
                         'version', v_row.version, 'source', v_row.source));
  end if;

  update agent.agent_memory m
     set value = v_value, source = p_source,
         version = m.version + case when m.value is distinct from v_value then 1 else 0 end
   where m.id = v_row.id
  returning * into v_row;
  return jsonb_build_object('ok', true, 'saved', 'corrected', 'memory',
    jsonb_build_object('id', v_row.id, 'name', v_row.key, 'value', v_row.value,
                       'version', v_row.version, 'source', v_row.source));
end; $$;

comment on function agent.save_memory(text, uuid, text, text, uuid, text, integer) is
  'Remember or correct one named fact. The version moves only when the words move, so saving the same value twice is one fact at one version.';

create or replace function agent.delete_memory(p_tenant text, p_agent_id uuid, p_key text)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_gone integer;
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;
  delete from agent.agent_memory m
   where m.tenant_id = p_tenant and m.agent_id = p_agent_id
     and m.key = lower(btrim(coalesce(p_key, '')));
  get diagnostics v_gone = row_count;
  /**
   * ⚠ **WHAT FORGETTING DOES AND WHAT IT DOES NOT, ANSWERED RATHER THAN LEFT TO BE ASSUMED.**
   *
   * The row is gone, so no LATER snapshot will carry it. Two things are deliberately
   * untouched, and both are guarantees rather than oversights:
   *
   *   * an execution ALREADY ACCEPTED holds its own snapshot, taken in the transaction that
   *     accepted it — so a run under way keeps resolving the name it was started with. That
   *     is the same rule the instructions and the step list follow, and reaching back into it
   *     would mean a correction changing what a run in flight is doing.
   *   * the JOURNAL keeps whatever was quoted. An entry is append-only by trigger, and a
   *     history that could be edited by forgetting a fact would be a history nobody can audit.
   *
   * **SO `deleted` IS NOT `erased`, AND THE ANSWER SAYS SO IN ITS OWN FIELDS AND IN ITS OWN
   * WORDS.** The booleans are what a reader acts on; `note` is the sentence, and it is HERE
   * rather than in each caller.
   *
   * ⚠ **IT USED TO SAY "a sentence is the caller's", AND THAT COST TWO DIFFERENT ACCOUNTS OF
   * ONE FACT.** The agent's `forget` tool composed its own constant and the site's route read a
   * `note` this function never set — MEASURED: `note` was `null` on every delete that has ever
   * gone through it, so a person pressing Forget was shown three booleans and no explanation at
   * all, while a model was shown a sentence written somewhere else. **Both products' notes then
   * claimed the reach was read from this function's own answer and could not drift**, which is
   * what a claim looks like when only half of it was built. One sentence, one place, and a
   * caller that composes another is a caller with a copy of it.
   *
   * FORGETTING SOMETHING THAT IS NOT THERE IS NOT A FAILURE, and saying which happened is
   * what lets a caller tell a name it got wrong from one it had already forgotten.
   */
  return jsonb_build_object(
    'ok', true, 'forgot', v_gone > 0, 'key', lower(btrim(coalesce(p_key, ''))),
    'affects', jsonb_build_object(
      'futureRuns',      true,     -- no later snapshot carries it
      'acceptedRuns',    false,    -- each holds the snapshot it was accepted with
      'runHistory',      false),   -- the journal is append-only and keeps what was quoted
    -- ⚠ THE SENTENCE THE BOOLEANS ABOVE ARE ABOUT, and it claims nothing they do not: it says
    -- what will not happen again, and names the two places that keep what they already have.
    -- ⚠ TWO ADJACENT LITERALS SEPARATED BY A NEWLINE ARE ONE STRING — SQL's own rule, which
    -- is how a sentence this long fits a line. Whitespace alone will NOT do it.
    'note', 'later runs will not see it; a run already under way keeps what it started with, '
            'and the history keeps whatever it quoted');
end; $$;

comment on function agent.delete_memory(text, uuid, text) is
  'Forget one named fact. Answers whether there was one rather than failing when there was not, and says what forgetting reaches: later runs only. An execution already accepted keeps the snapshot it started with, and the journal keeps whatever it quoted.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. AUTOMATIONS — listing them, reading one, and turning one on or off
--
-- Creating and updating one already have their functions (`create_automation`,
-- `update_automation`); what was missing is everything a READER needs, which is most of
-- what an agent asking "what do I already run?" wants.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.list_automations(p_tenant text, p_agent_id uuid)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not agent.owns_agent(p_tenant, p_agent_id) then
    return;
  end if;
  return query
    select jsonb_build_object(
             'id', a.id, 'name', a.name, 'enabled', a.enabled,
             'schedule', a.schedule, 'atLocal', a.at_local,
             'zone', a.zone, 'steps', jsonb_array_length(a.steps),
             'inputs', a.inputs, 'nextRunAt', a.next_run_at)
      from agent.automations a
     where a.tenant_id = p_tenant and a.agent_id = p_agent_id
     order by lower(a.name) asc;
end; $$;

comment on function agent.list_automations(text, uuid) is
  'One agent''s automations, with a COUNT of steps rather than the steps — reading one whole is its own call.';

create or replace function agent.read_automation(p_tenant text, p_id uuid)
  returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', a.id, 'agent', a.agent_id, 'name', a.name, 'enabled', a.enabled,
           'schedule', a.schedule, 'atLocal', a.at_local, 'zone', a.zone,
           'steps', a.steps, 'inputs', a.inputs, 'nextRunAt', a.next_run_at)
    from agent.automations a
   where a.id = p_id and a.tenant_id = p_tenant;
$$;

comment on function agent.read_automation(text, uuid) is
  'One automation whole, including its steps. Answers nothing for one that is not this account''s.';

create or replace function agent.set_automation_enabled(p_tenant text, p_id uuid, p_enabled boolean)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row agent.automations%rowtype;
begin
  -- REFUSED, NEVER COERCED. A null here would be a caller that meant something and could
  -- not say it, and reading that as `false` turns "I could not tell" into "turn it off".
  if p_enabled is null then
    return jsonb_build_object('ok', false, 'error', 'bad-enabled');
  end if;
  -- ⚠ TURNING ONE ON RE-ARMS IT FORWARD; TURNING ONE OFF LEAVES ITS INSTANT ALONE, and
  -- the second half is the SCHEMA's decision rather than a preference. A first draft
  -- cleared `next_run_at` on disable and `automations_schedule_is_whole` refused the row:
  -- a daily schedule is whole only WITH an instant. Nothing fires meanwhile, because
  -- `tick_automations` selects on `a.enabled` — so the flag is the gate and the instant
  -- is only a time.
  --
  -- **RE-ARMING FORWARD IS WHAT STOPS A BACKLOG.** An automation disabled for a week has
  -- an instant a week behind; enabling it without recomputing would hand the next tick an
  -- occurrence that is days old, which is the burst this product's scheduler exists to
  -- avoid.
  update agent.automations a
     set enabled = p_enabled,
         next_run_at = case
           when p_enabled and a.schedule = 'daily'
             then agent.automation_next_at(a.at_local, a.zone, now())
           else a.next_run_at end
   where a.id = p_id and a.tenant_id = p_tenant
  returning * into v_row;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'enabled', v_row.enabled,
                            'next_run_at', v_row.next_run_at);
end; $$;

comment on function agent.set_automation_enabled(text, uuid, boolean) is
  'Turn one automation on or off, re-arming or clearing its next run in the same statement.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. WHAT AN EXECUTION DID — the progress a person or an agent can inspect
--
-- Reads `agent.automation_history`, which already joins the execution to its run and its
-- stop. A function rather than a direct select because the view is `security_invoker` and
-- these run for the BACKEND, whose role bypasses RLS — so the tenant filter has to be
-- written here, once, rather than in each caller.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function agent.list_executions(
  p_tenant text, p_automation_id uuid, p_limit integer default 10)
  returns setof jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  return query
    select jsonb_build_object(
             'id', h.id, 'startedAt', h.created_at, 'finishedAt', h.finished_at,
             'trigger', h.trigger, 'occurrence', h.occurrence,
             'state', case
               when h.run_stop ->> 'reason' is not null then h.run_stop ->> 'reason'
               when h.waiting is not null then 'waiting'
               else 'running' end,
             'waitingFor', h.waiting -> 'kind',
             'result', h.run_stop ->> 'result')
      from agent.automation_history h
     where h.tenant_id = p_tenant and h.automation_id = p_automation_id
     order by h.created_at desc
     limit v_limit;
end; $$;

comment on function agent.list_executions(text, uuid, integer) is
  'What one automation''s recent executions did, newest first: the state, what any pause is waiting for, and the result.';

create or replace function agent.read_execution(p_tenant text, p_id uuid)
  returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', h.id, 'automation', h.automation_id, 'startedAt', h.created_at,
           'finishedAt', h.finished_at, 'trigger', h.trigger, 'occurrence', h.occurrence,
           'position', h.position, 'outcomes', h.outcomes, 'waiting', h.waiting,
           'waitUntil', h.wait_until, 'decisions', h.decisions,
           'state', case
             when h.run_stop ->> 'reason' is not null then h.run_stop ->> 'reason'
             when h.waiting is not null then 'waiting'
             else 'running' end,
           'result', h.run_stop ->> 'result')
    from agent.automation_history h
   where h.id = p_id and h.tenant_id = p_tenant;
$$;

comment on function agent.read_execution(text, uuid) is
  'One execution in full — every step''s outcome, what it is waiting for, and how it ended.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. THE GRANTS — the backend alone, exactly as every other operation here
--
-- ⚠ `authenticated` GETS NOTHING. These take the tenant as an ARGUMENT, so a customer
-- who could call one could name somebody else's account. The whole design rests on the
-- caller being a backend that took the tenant from a verified token, so the grant is what
-- says only a backend may call them — not a comment asking nicely.
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'agent.owns_agent(text, uuid)',
    'agent.list_knowledge(text, uuid)',
    'agent.read_knowledge(text, uuid)',
    'agent.list_memory(text, uuid)',
    'agent.save_memory(text, uuid, text, text, uuid, text, integer)',
    'agent.delete_memory(text, uuid, text)',
    'agent.list_automations(text, uuid)',
    'agent.read_automation(text, uuid)',
    'agent.set_automation_enabled(text, uuid, boolean)',
    'agent.list_executions(text, uuid, integer)',
    'agent.read_execution(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end $$;
