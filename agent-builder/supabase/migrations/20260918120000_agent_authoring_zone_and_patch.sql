-- ════════════════════════════════════════════════════════════════════════════
-- THE TWO THINGS AN AGENT'S AUTHORING TOOLS COULD NOT DO
--
-- Both were found by review and REPRODUCED through the real tools against a real
-- PostgreSQL before a line of this was written.
--
--   1. **A DAILY SCHEDULE HAD NOWHERE TO GET A TIME ZONE FROM.** `make_automation`
--      offers `schedule: "daily"` and `atLocal: "09:00"` and sends no zone, because a
--      zone is the one thing a MODEL must not choose — "every day at nine" somewhere
--      nobody lives is worse than no schedule at all. So `automation_next_at` raised,
--      the store turned that into HTTP 400, and the tool THREW. Measured: zero rows
--      written, the model told nothing it could act on, and every daily automation
--      authored through a tool failed the same way. A dead control that throws.
--
--      **THE ZONE IS A SETTING A PERSON OWNS, so this migration gives it a home.**
--      `agent.agents.zone`, nullable, set by the person's own settings form and read —
--      never written — by the authoring path. Absent is a real answer and the tool asks
--      for it rather than guessing.
--
--   2. **AN UNRELATED EDIT RESET EVERYTHING IT DID NOT MENTION.** `update_automation`
--      is a WHOLE REPLACE and is right to be: the screen's form shows every field and
--      sends every field, so what it saves is what it shows. A TOOL is the opposite —
--      a model names the one thing it was asked to change. Measured, renaming one
--      automation through `change_automation`:
--
--        before: enabled=false | daily | 23:00 | Europe/London | 1 input  | v1
--        after:  enabled=true  | manual| -     | -             | 0 inputs | v2
--
--      A disabled automation was reactivated, its schedule and zone erased and its
--      input declarations deleted, by a call that asked for a new name. And the
--      APPROVAL a person gave was for "rename it", which makes the gate itself
--      misleading: what was approved is not what happened.
--
-- ⚠ **`agent.patch_automation` DELEGATES TO `agent.update_automation` RATHER THAN
-- WRITING THE ROW.** Two writers to one table is two copies of the schedule
-- arithmetic, the version rule and the workflow check — and the copy that drifts is
-- the one nobody is reading. What is here is only the part that is genuinely new:
-- what an ABSENT key means.
--
-- ⚠ **AND IT TAKES THE ROW LOCK BEFORE IT RESOLVES ANYTHING.** Reading the row to
-- fill in the gaps and then calling a function that locks it would be exactly the
-- stale read this exists to prevent: another transaction could commit between the two
-- and have its change written over by values resolved before it landed. `for update`
-- first, then resolve, then delegate — and the callee's own `for update` re-locks a
-- row this transaction already holds, which costs nothing.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. THE ACCOUNT'S OWN TIME ZONE ──────────────────────────────────────────
--
-- ⚠ **ON THE AGENT AND NOT ON A TENANT-LEVEL SETTINGS TABLE, and the reason is
-- reachability rather than tidiness.** Every authoring call is already scoped to one
-- agent, so the read needs no new plumbing and no new RLS surface; and the existing
-- settings form is per-agent, so a person can really set it. Two agents in two zones
-- is also a real thing — a team here and a team there.
--
-- **NULLABLE, AND ABSENT MEANS ABSENT.** There is no default and there must not be: a
-- default is a guess, and a guessed zone is a schedule that fires at the wrong hour
-- while every reader agrees it is correct. What a caller does with `null` is ASK.
alter table agent.agents
  add column if not exists zone text;

alter table agent.agents drop constraint if exists agents_zone_shaped;
alter table agent.agents add constraint agents_zone_shaped check (
  zone is null or length(btrim(zone)) between 1 and 200
);

comment on column agent.agents.zone is
  'The time zone this agent''s schedules are written in, as an IANA name. Set by the person on the settings form; read and never written by the authoring path. NULL means nobody has said, and a caller must ask rather than guess.';

-- ⚠ **THE SHAPE CHECK IS NOT THE VALIDITY CHECK, and both are needed.** This one keeps
-- a 10,000-character string out of the column; whether Postgres can USE the name is
-- decided by the `at time zone` cast in `agent.automation_next_at`, which raises. The
-- writing paths ask `Intl` as well, so a bad name is a sentence before it is an
-- exception — but this function is the one no caller can skip.
create or replace function agent.zone_is_usable(p_zone text)
returns boolean
  -- ⚠ **`immutable`, AND THAT IS WHY THE INSTANT IS A LITERAL RATHER THAN `now()`.** The
  -- first draft asked `now() at time zone p_zone`, which makes a function marked immutable
  -- depend on the clock — a claim the planner is entitled to believe and fold on. Whether
  -- the server KNOWS a zone name does not depend on the time, so a fixed instant is both
  -- honest and a better question.
  language plpgsql immutable set search_path = '' as $$
begin
  if p_zone is null or btrim(p_zone) = '' then return false; end if;
  -- THE SAME CAST EVERY SCHEDULE'S ARITHMETIC USES. A name Postgres does not know
  -- raises `invalid_parameter_value`, which is what this catches and answers as false.
  perform ('2000-01-01 12:00:00+00'::timestamptz at time zone p_zone);
  return true;
exception when others then
  return false;
end; $$;

comment on function agent.zone_is_usable(text) is
  'Whether Postgres can compute a local time in this zone, asked by the same cast the schedule arithmetic uses. False for null, blank and any name the server does not know.';

-- ⚠ **THE SETTINGS READ IS DELIBERATELY NARROW: the zone and nothing else.** An
-- authoring tool needs to know which zone a schedule is written in; it has no business
-- reading the instructions (which are SNAPSHOTTED into a run, so a live read here would
-- be a second, disagreeing source) or the tool selection (which is the run's own, narrowed
-- before any of this). A reader that hands back the whole row is one an edit is a line
-- away from widening.
create or replace function agent.read_agent_settings(
  p_tenant   text,
  p_agent_id uuid
) returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_row agent.agents;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'read_agent_settings: tenant must be a non-empty string';
  end if;
  select * into v_row from agent.agents
   where id = p_agent_id and tenant_id = p_tenant;
  -- ANOTHER ACCOUNT'S AGENT AND AN AGENT THAT IS NOT THERE ARE ONE ANSWER, because the
  -- difference between them is information about somebody else's account.
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;
  -- ⚠ **A ZONE THE SERVER CANNOT USE IS ANSWERED AS ABSENT, not handed on.** The column's
  -- check keeps the length sane and cannot ask Postgres whether the name means anything;
  -- a name that survived a rename of the tz database would otherwise come back here, reach
  -- a schedule, and raise several layers away from the setting that is really wrong.
  return jsonb_build_object('ok', true,
    'zone', case when agent.zone_is_usable(v_row.zone) then btrim(v_row.zone) else null end);
end; $$;

comment on function agent.read_agent_settings(text, uuid) is
  'One agent''s authoring settings: its time zone, or null where nobody has set a usable one. The zone and nothing else — an authoring tool has no business reading the instructions or the tool selection.';

-- ── 2. AN EDIT THAT CHANGES ONLY WHAT IT NAMES ──────────────────────────────
--
-- ⚠ **PRESENCE IN THE PATCH IS THE WHOLE INTERFACE.** `p_patch ? 'zone'` says "this call
-- is about the zone"; the value — including `null` — says what to make it. That is why
-- the patch is `jsonb` rather than a parameter per field with a `p_fields text[]` beside
-- it: a list and the values it describes are a two-field invariant, and a caller that
-- forgets to name a field it passed would have that value silently dropped. Here there is
-- one place to look and nothing to keep in step.
--
-- **AN UNKNOWN KEY IS REFUSED BY NAME.** A filter on somebody's input is a silent drop
-- and a check is a sentence — and the somebody here is a model, which cannot see the row
-- and would be told its edit had landed.
--
-- **EVERY TYPE IS REFUSED RATHER THAN COERCED.** `jsonb_typeof` is the question, so a
-- string `"false"` for `enabled` is a refusal and not an automation turned on.
create or replace function agent.patch_automation(
  p_tenant         text,
  p_id             uuid,
  p_patch          jsonb,
  p_expect_version integer default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row      agent.automations;
  v_key      text;
  v_name     text;
  v_enabled  boolean;
  v_schedule text;
  v_at       time;
  v_zone     text;
  v_steps    jsonb;
  v_inputs   jsonb;
  v_days     text[];
  v_on_date  date;
  v_on_event text;
  v_at_txt   text;
  v_day      jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'patch_automation: tenant must be a non-empty string';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad-patch');
  end if;

  -- ⚠ THE LOCK COMES FIRST, BEFORE ANY VALUE IS RESOLVED. See the header: resolving
  -- against an unlocked read and then delegating to a function that locks is the stale
  -- overwrite this exists to prevent.
  select * into v_row from agent.automations
   where id = p_id and tenant_id = p_tenant
     for update;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  -- ⚠ **WHAT `version` REALLY COVERS, SAID RATHER THAN IMPLIED.** It moves on a change of
  -- STEPS and on nothing else — that is `update_automation`'s own rule, so a parent's
  -- workflow snapshot stays honest across a rename. So this check is a fence on the WORK
  -- and not a general one: a concurrent rename does not move it and will not be caught
  -- here. What protects every other field is that this patch only writes what it names,
  -- which is atomic under the lock above and needs no version at all.
  if p_expect_version is not null and p_expect_version <> v_row.version then
    return jsonb_build_object('ok', false, 'error', 'stale',
                              'version', v_row.version, 'expected', p_expect_version);
  end if;

  -- AN UNKNOWN KEY, NAMED. Asked before anything is resolved, so a call with one typo
  -- changes nothing at all rather than changing most of what it asked for.
  for v_key in select k from jsonb_object_keys(p_patch) k loop
    if v_key not in ('name', 'enabled', 'schedule', 'atLocal', 'zone',
                     'steps', 'inputs', 'days', 'onDate', 'onEvent') then
      return jsonb_build_object('ok', false, 'error', 'bad-field', 'field', v_key);
    end if;
  end loop;

  -- ── NAME ──
  if p_patch ? 'name' then
    if jsonb_typeof(p_patch -> 'name') <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad-name');
    end if;
    v_name := p_patch ->> 'name';
    if length(btrim(v_name)) not between 1 and 200 then
      return jsonb_build_object('ok', false, 'error', 'bad-name');
    end if;
  else
    v_name := v_row.name;
  end if;

  -- ── ENABLED ──
  if p_patch ? 'enabled' then
    if jsonb_typeof(p_patch -> 'enabled') <> 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'bad-enabled');
    end if;
    v_enabled := (p_patch -> 'enabled')::boolean;
  else
    v_enabled := v_row.enabled;
  end if;

  -- ── SCHEDULE ──
  --
  -- ⚠ THE KNOWN SET IS ASKED HERE RATHER THAN LEFT TO THE COLUMN'S CHECK, because a check
  -- constraint raises and a caller wanted a sentence. The set is the column's own; keeping
  -- them in step is what `test/integration/pg-schema.mjs` asserts.
  if p_patch ? 'schedule' then
    if jsonb_typeof(p_patch -> 'schedule') <> 'string'
       or (p_patch ->> 'schedule') not in ('manual', 'daily', 'weekly', 'once') then
      return jsonb_build_object('ok', false, 'error', 'bad-schedule');
    end if;
    v_schedule := p_patch ->> 'schedule';
  else
    v_schedule := v_row.schedule;
  end if;

  -- ── THE LOCAL TIME ──
  --
  -- `null` CLEARS IT, which is what a move to `manual` needs — and the wholeness check on
  -- the table is what refuses the halfway states, so this does not have to.
  if p_patch ? 'atLocal' then
    if jsonb_typeof(p_patch -> 'atLocal') = 'null' then
      v_at := null;
    elsif jsonb_typeof(p_patch -> 'atLocal') <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad-time');
    else
      v_at_txt := btrim(p_patch ->> 'atLocal');
      -- ⚠ SHAPED FIRST, THEN CAST. `'09:00:30'::time` is a valid time and an invalid
      -- schedule (the column refuses a non-whole minute), and `'nonsense'::time` raises
      -- where a sentence was wanted.
      if v_at_txt !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        return jsonb_build_object('ok', false, 'error', 'bad-time');
      end if;
      v_at := v_at_txt::time;
    end if;
  else
    v_at := v_row.at_local;
  end if;

  -- ── THE ZONE ──
  --
  -- ⚠ **A ZONE THE SERVER CANNOT USE IS REFUSED HERE AND NOT LEFT TO THE ARITHMETIC.**
  -- `automation_next_at` raises on an unknown name; a raise out of this function is an
  -- HTTP 400 with a PL/pgSQL context line, which is what the daily-schedule defect looked
  -- like from outside. Refused by name, so a caller gets something to act on.
  if p_patch ? 'zone' then
    if jsonb_typeof(p_patch -> 'zone') = 'null' then
      v_zone := null;
    elsif jsonb_typeof(p_patch -> 'zone') <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad-zone');
    elsif not agent.zone_is_usable(p_patch ->> 'zone') then
      return jsonb_build_object('ok', false, 'error', 'bad-zone');
    else
      v_zone := btrim(p_patch ->> 'zone');
    end if;
  else
    v_zone := v_row.zone;
  end if;

  -- ── THE STEPS ──
  if p_patch ? 'steps' then
    if jsonb_typeof(p_patch -> 'steps') <> 'array' then
      return jsonb_build_object('ok', false, 'error', 'bad-steps');
    end if;
    v_steps := p_patch -> 'steps';
  else
    v_steps := v_row.steps;
  end if;

  -- ── WHAT IT ASKS FOR ──
  if p_patch ? 'inputs' then
    if jsonb_typeof(p_patch -> 'inputs') <> 'array' then
      return jsonb_build_object('ok', false, 'error', 'bad-inputs');
    end if;
    v_inputs := p_patch -> 'inputs';
  else
    v_inputs := v_row.inputs;
  end if;

  -- ── THE WEEKDAYS ──
  --
  -- A `text[]` in the column, so each entry is checked as a string here; which STRINGS are
  -- days is the column's own check and stays there.
  if p_patch ? 'days' then
    if jsonb_typeof(p_patch -> 'days') <> 'array' then
      return jsonb_build_object('ok', false, 'error', 'bad-days');
    end if;
    for v_day in select value from jsonb_array_elements(p_patch -> 'days') loop
      if jsonb_typeof(v_day) <> 'string' then
        return jsonb_build_object('ok', false, 'error', 'bad-days');
      end if;
    end loop;
    select coalesce(array_agg(value #>> '{}'), '{}'::text[]) into v_days
      from jsonb_array_elements(p_patch -> 'days');
  else
    v_days := v_row.days;
  end if;

  -- ── THE ONE DATE ──
  if p_patch ? 'onDate' then
    if jsonb_typeof(p_patch -> 'onDate') = 'null' then
      v_on_date := null;
    elsif jsonb_typeof(p_patch -> 'onDate') <> 'string'
          or (p_patch ->> 'onDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return jsonb_build_object('ok', false, 'error', 'bad-date');
    else
      -- SHAPED FIRST, THEN CAST, for the same reason the time is: `'2026-13-45'` matches
      -- the shape and is not a date, and the cast's own raise is not a sentence.
      begin
        v_on_date := (p_patch ->> 'onDate')::date;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'bad-date');
      end;
    end if;
  else
    v_on_date := v_row.on_date;
  end if;

  -- ── THE EVENT IT LISTENS FOR ──
  if p_patch ? 'onEvent' then
    if jsonb_typeof(p_patch -> 'onEvent') = 'null' then
      v_on_event := null;
    elsif jsonb_typeof(p_patch -> 'onEvent') <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad-event');
    else
      v_on_event := btrim(p_patch ->> 'onEvent');
      if v_on_event = '' then v_on_event := null; end if;
    end if;
  else
    v_on_event := v_row.on_event;
  end if;

  -- ⚠ **THE RESOLVED COMBINATION IS CHECKED FOR WHOLENESS BEFORE IT IS WRITTEN, and this is a
  -- REFUSAL where the layers below RAISE.**
  --
  -- MEASURED: a patch of `{"days": []}` on a weekly automation reached
  -- `agent.automation_next_run`, which raises *a weekly schedule needs at least one day* — an
  -- HTTP 400 carrying three PL/pgSQL context lines, which is exactly the shape this whole round
  -- exists to remove. The column's own `automations_schedule_is_whole` would refuse the row too,
  -- and a CHECK constraint raises as well. So a patch that produces a half-whole schedule is
  -- answered here, by name, while it is still somebody's edit.
  --
  -- **THE RULES ARE THE COLUMN'S, and the point of repeating them is the ANSWER rather than the
  -- decision**: the constraint is still what makes them true, and is what catches a caller that
  -- does not come through here. `test/integration/pg-schema.mjs` drives both.
  if v_schedule <> 'manual' and v_at is null then
    return jsonb_build_object('ok', false, 'error', 'bad-time', 'schedule', v_schedule);
  end if;
  if v_schedule <> 'manual' and (v_zone is null or btrim(v_zone) = '') then
    return jsonb_build_object('ok', false, 'error', 'bad-zone', 'schedule', v_schedule);
  end if;
  if v_schedule = 'weekly' and coalesce(cardinality(v_days), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad-days', 'schedule', v_schedule);
  end if;
  if v_schedule = 'once' and v_on_date is null then
    return jsonb_build_object('ok', false, 'error', 'bad-date', 'schedule', v_schedule);
  end if;
  -- ⚠ AND THE OTHER DIRECTION, which is the one a reader forgets: `manual` carrying a time or a
  -- day list is a control somebody set that nothing reads, and the column refuses that too.
  if v_schedule = 'manual' and (v_at is not null or coalesce(cardinality(v_days), 0) > 0
                                or v_on_date is not null) then
    return jsonb_build_object('ok', false, 'error', 'bad-schedule', 'schedule', v_schedule);
  end if;
  -- `daily` AND `once` HOLD NO DAYS, and `daily`/`weekly` hold no date — the same rule.
  if v_schedule in ('daily', 'once') and coalesce(cardinality(v_days), 0) > 0 then
    return jsonb_build_object('ok', false, 'error', 'bad-days', 'schedule', v_schedule);
  end if;
  if v_schedule in ('daily', 'weekly') and v_on_date is not null then
    return jsonb_build_object('ok', false, 'error', 'bad-date', 'schedule', v_schedule);
  end if;

  -- ⚠ **ONE WRITER.** The schedule arithmetic, the version rule and the workflow check are
  -- `update_automation`'s, unchanged — this function decides what an absent key means and
  -- whether what it resolved can be a row at all.
  return agent.update_automation(
    p_tenant   := p_tenant,
    p_id       := p_id,
    p_name     := v_name,
    p_enabled  := v_enabled,
    p_schedule := v_schedule,
    p_at_local := v_at,
    p_zone     := v_zone,
    p_steps    := v_steps,
    p_inputs   := v_inputs,
    p_days     := v_days,
    p_on_date  := v_on_date,
    p_on_event := v_on_event
  );
end; $$;

comment on function agent.patch_automation(text, uuid, jsonb, integer) is
  'Change only the fields a call names. Presence in the patch is the interface; an absent key preserves what is stored, an unknown key is refused by name, and every type is refused rather than coerced. Takes the row lock before resolving anything, then delegates the write to agent.update_automation so the schedule arithmetic and the version rule live in one place.';

-- ⚠ **THE `_once` WRAPPER, AND IT IS WHAT MAKES A RETRY SAFE RATHER THAN DESTRUCTIVE.**
-- The shape is `create_automation_once`'s exactly: check the record, do the work in a
-- subtransaction that catches everything, and let the RECORD arbitrate — a committed twin
-- means we lost a race and its answer is authoritative, no twin means the failure is ours
-- and is re-raised with its own code. Swallowing it would turn a real refusal into a silent
-- `ok: false`, which is the direction that loses work.
--
-- **AND IT IS THE LAST CLAUSE OF THE REQUIREMENT: a retry of a completed edit cannot
-- overwrite a newer change.** The record answers the first attempt's outcome and the row is
-- never touched, which is a stronger guarantee than a version check because it holds even
-- when the newer change moved a field this patch never named.
create or replace function agent.patch_automation_once(
  p_tenant         text,
  p_op_key         text,
  p_args_hash      text,
  p_op_run         uuid,
  p_id             uuid,
  p_patch          jsonb,
  p_expect_version integer
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'patch_automation', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  begin
    v_out := agent.patch_automation(p_tenant := p_tenant, p_id := p_id,
                                    p_patch := p_patch, p_expect_version := p_expect_version);
    if not agent.operation_record(p_tenant, p_op_key, 'patch_automation', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    v_check := agent.operation_check(p_tenant, p_op_key, 'patch_automation', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'patch_automation');
  end if;
  return v_out;
end $$;

comment on function agent.patch_automation_once(text, text, text, uuid, uuid, jsonb, integer) is
  'agent.patch_automation under an operation identity, so a redelivery answers the first attempt rather than editing again. A retry of a completed edit therefore cannot overwrite a newer change, whatever fields that change touched.';

-- ── 3. THE ZONE REACHES THE SCREEN'S OWN READER ─────────────────────────────
--
-- ⚠ **A SETTING NO SCREEN CAN SHOW IS A SETTING NOBODY SETS, which would make the tool's
-- "ask the person to set it" a dead end.** The list view is what the settings form is drawn
-- from, so the column goes on it. `security_invoker` is unchanged and is the whole safety
-- argument: without it the view runs as its owner and is a hole through the RLS on both
-- base tables.
create or replace view agent.agent_overview
  with (security_invoker = true) as
select
  a.id,
  a.tenant_id,
  a.name,
  a.instructions,
  a.created_at,
  a.updated_at,
  last.body as last_message,
  a.status,
  a.tools,
  a.zone
from agent.agents a
left join lateral (
  select m.body
    from agent.agent_messages m
   where m.agent_id = a.id
   order by m.seq desc
   limit 1
) last on true;

comment on view agent.agent_overview is
  'One row per agent with its last message, its status, its tool selection and its time zone. security_invoker, so RLS on agent.agents and agent.agent_messages applies to whoever reads it.';

grant select on agent.agent_overview to authenticated, service_role;
revoke all on agent.agent_overview from anon;

-- ── 4. WHO MAY CALL WHAT ────────────────────────────────────────────────────
--
-- The same posture every function in this schema has: nothing to `public`, execute to
-- `service_role` alone. The tenant is an argument, and that grant is the only reason a
-- tenant argument is safe.
revoke all on function agent.zone_is_usable(text) from public;
revoke all on function agent.read_agent_settings(text, uuid) from public;
revoke all on function agent.patch_automation(text, uuid, jsonb, integer) from public;
revoke all on function agent.patch_automation_once(text, text, text, uuid, uuid, jsonb, integer) from public;

grant execute on function agent.zone_is_usable(text) to service_role;
grant execute on function agent.read_agent_settings(text, uuid) to service_role;
grant execute on function agent.patch_automation(text, uuid, jsonb, integer) to service_role;
grant execute on function agent.patch_automation_once(text, text, text, uuid, uuid, jsonb, integer) to service_role;

-- ── 5. THE READERS SAY WHEN SOMETHING RUNS, AND ALL OF WHEN ─────────────────
--
-- ⚠ **`list_automations` AND `read_automation` OMITTED EVERY FIELD ADDED SINCE THEY WERE
-- WRITTEN, which makes them dead instruments about exactly the thing they exist to
-- describe.** `20260918050000_agent_triggers.sql` gave an automation `days`, `on_date` and
-- `on_event`; both readers still answered `schedule` and `atLocal` alone — so a WEEKLY
-- automation reads as "weekly" with no days, a ONE-TIME one as "once" with no date, and an
-- event-triggered one as `manual`, which is false. A reader that quietly drops the fields
-- deciding when work happens is worse than one that refuses: it answers, and plausibly.
--
-- **AND `version` IS WHAT MAKES THE PATCH'S FENCE USABLE AT ALL.** `patch_automation` takes
-- `p_expect_version`, and a caller that cannot READ a version cannot pass one — a parameter
-- nobody can supply is a wall nobody is guarding. It is the automation's own column, so
-- there is nothing to derive and nothing that can disagree with it.
--
-- ⚠ THE LIST STILL ANSWERS A COUNT OF STEPS RATHER THAN THE STEPS. Reading one whole is
-- its own call, and that is unchanged: these two additions are fields, not the workflow.
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
             'inputs', a.inputs, 'nextRunAt', a.next_run_at,
             'version', a.version,
             -- `days` IS A `text[]` AND COMES BACK AS A JSON ARRAY, so a reader gets the
             -- same shape a writer sends. `to_jsonb` rather than a hand-built array, which
             -- would be a second answer to "what is a day list".
             'days', to_jsonb(a.days), 'onDate', a.on_date, 'onEvent', a.on_event)
      from agent.automations a
     where a.tenant_id = p_tenant and a.agent_id = p_agent_id
     order by lower(a.name) asc;
end; $$;

comment on function agent.list_automations(text, uuid) is
  'One agent''s automations, with a COUNT of steps rather than the steps — reading one whole is its own call. Carries every field that decides when it runs, and its version, which is what a guarded edit needs.';

create or replace function agent.read_automation(p_tenant text, p_id uuid)
  returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', a.id, 'agent', a.agent_id, 'name', a.name, 'enabled', a.enabled,
           'schedule', a.schedule, 'atLocal', a.at_local, 'zone', a.zone,
           'steps', a.steps, 'inputs', a.inputs, 'nextRunAt', a.next_run_at,
           'version', a.version,
           'days', to_jsonb(a.days), 'onDate', a.on_date, 'onEvent', a.on_event)
    from agent.automations a
   where a.id = p_id and a.tenant_id = p_tenant;
$$;

comment on function agent.read_automation(text, uuid) is
  'One automation whole: its steps, what it asks for, every field that decides when it runs, and its version. Answers nothing for one that is not this account''s.';

-- ── 6. ENABLING A WEEKLY OR ONE-TIME AUTOMATION RE-ARMS IT TOO ──────────────
--
-- ⚠ **`set_automation_enabled` RE-ARMED ONLY A `daily` SCHEDULE, and the two later ones
-- shipped without it.** Its own comment says why re-arming matters: an automation disabled
-- for a week has an instant a week behind, and enabling it without recomputing hands the
-- next tick an occurrence days old — the backlog burst this scheduler exists to avoid. That
-- reasoning is about every schedule and the code named one, because `daily` was the only one
-- there was when it was written. *A rule true because of a layer below it expires when that
-- layer moves*, and the layer moved when `weekly` and `once` arrived.
--
-- `agent.automation_next_run` is the ONE function for all four schedules — the same one
-- `update_automation` uses — so this is a narrowing removed rather than arithmetic added.
-- `manual` still gets no instant, which the wholeness check requires.
create or replace function agent.set_automation_enabled(p_tenant text, p_id uuid, p_enabled boolean)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row agent.automations%rowtype;
begin
  if p_enabled is null then
    return jsonb_build_object('ok', false, 'error', 'bad-enabled');
  end if;
  /**
   * ⚠ **RE-ARMED ONLY WHERE THE FLAG REALLY MOVED FROM OFF TO ON — and the version without
   * `a.enabled is not true` silently deleted a due occurrence, reproduced before this was
   * touched.**
   *
   * The condition was `p_enabled and a.schedule <> 'manual'`, which is true of a NO-OP enable:
   * `enabled: true` on an automation that is already on. MEASURED on a real PostgreSQL, a daily
   * automation with an occurrence due three minutes ago: `next_run_at` went
   * `01:06:18` → `08:00:00` — 6h54m forward — `still_due` t → f, and **0 executions and 0
   * history rows**, so the occurrence was neither filed nor recorded missed. It simply never
   * happened, and nothing anywhere says so.
   *
   * Reachable from the agent's own `pause_automation` tool and from `/api/agent/automation-enable`,
   * both of which take the flag from their caller rather than from what the row holds.
   *
   * **THE BACKLOG ARGUMENT IS UNCHANGED AND IS WHY THIS IS A TRANSITION TEST RATHER THAN A
   * REMOVAL.** An automation disabled for a week has an instant a week behind, and enabling it
   * without recomputing would hand the next tick an occurrence days old. That is exactly the
   * off→on case, which still recomputes; what stops is recomputing when nothing was off.
   *
   * `is not true` rather than `not a.enabled`, so a NULL flag counts as off — cannot-tell must
   * not read as "it was already on", which is the reading that skips the re-arm and leaves the
   * backlog this exists to prevent.
   *
   * **THIS IS `update_automation`'S OWN DEFECT IN ITS SIBLING**, one function over: there an
   * unrelated edit recomputed the instant, here an unrelated toggle does.
   */
  update agent.automations a
     set enabled = p_enabled,
         next_run_at = case
           when p_enabled and a.enabled is not true and a.schedule <> 'manual'
             then agent.automation_next_run(a.schedule, a.at_local, a.zone, a.days, a.on_date, now())
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
  'Turn one on or off. Turning it ON from OFF re-arms its next instant forward through agent.automation_next_run — for every schedule, not only a daily one — so a long-disabled automation does not come back with a backlog. A no-op enable of an automation that is already on changes nothing, because recomputing there deletes a due occurrence without filing it or recording it missed. Turning it off leaves the instant alone, because a scheduled row is whole only with one and the enabled flag is the gate.';

-- ── 7. STOPPING ONE EXECUTION, UNDER AN OPERATION IDENTITY ──────────────────
--
-- ⚠ **`agent.cancel_run` HAD NO `_once` WRAPPER because only a PERSON could reach it**, and a
-- person's press goes through the site's own route. An agent may stop its own automation's
-- execution now — which is strictly less than `run_automation`, since it stops work and can
-- never start any — and every write on the tool surface goes through its operation record.
-- `test/capabilities.test.mjs` censuses that both ways, so this is not optional politeness.
--
-- **AND IT IS NOT REDUNDANT WITH `cancel_run`'S OWN IDEMPOTENCE**, which is worth saying
-- because it looks it: `cancel_run` already answers `repeat: true, alreadyStopped: true` for a
-- run that has stopped. What the record adds is the OTHER half — a DIFFERENT call landing in
-- the same slot is refused `operation-mismatch` rather than cancelling something the caller
-- did not mean, and the answer is byte-identical across retries rather than merely equivalent.
--
-- The shape is `create_automation_once`'s exactly: check, work in a subtransaction that catches
-- everything, and let the RECORD arbitrate — a committed twin is authoritative, no twin means
-- the failure is ours and is re-raised with its own code.
create or replace function agent.cancel_run_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_run_id    uuid,
  p_by        text,
  p_reason    text
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
  v_out   jsonb;
  v_lost  boolean := false;
  v_state text;
  v_msg   text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'cancel_run', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;

  begin
    v_out := agent.cancel_run(p_tenant := p_tenant, p_run_id := p_run_id,
                              p_by := p_by, p_reason := p_reason);
    if not agent.operation_record(p_tenant, p_op_key, 'cancel_run', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first'
        using errcode = 'AG001';
    end if;
  exception when others then
    v_lost  := true;
    v_state := sqlstate;
    v_msg   := sqlerrm;
  end;

  if v_lost then
    v_check := agent.operation_check(p_tenant, p_op_key, 'cancel_run', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    if v_state <> 'AG001' then
      raise exception '%', v_msg using errcode = v_state;
    end if;
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'cancel_run');
  end if;
  return v_out;
end $$;

comment on function agent.cancel_run_once(text, text, text, uuid, uuid, text, text) is
  'agent.cancel_run under an operation identity, so a redelivery answers the first attempt and a different call in the same slot is refused rather than stopping something nobody meant.';

revoke all on function agent.cancel_run_once(text, text, text, uuid, uuid, text, text) from public;
grant execute on function agent.cancel_run_once(text, text, text, uuid, uuid, text, text) to service_role;
