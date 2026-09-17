-- ═══════════════════════════════════════════════════════════════════════════
-- AUTOMATIONS: a trigger, a condition, an action, and a saved result.
--
-- APPLIED 2026-09-17 as remote version `20260917003304`, and this file is named for
-- it. It was written under a placeholder name and renamed the moment the apply
-- reported that version back, which is this folder's rule: lining the two up by name
-- is the only thing that works later. Recorded in `agent-builder/CLAUDE.md`.
--
-- **WHAT IS LIVE WAS PROVED EQUAL TO THIS FILE RATHER THAN ASSUMED.** The connector
-- is the only way in from a session, so the SQL had to be authored in a tool call —
-- so a narrowed census of everything this migration creates (10 function definitions
-- by md5, every column of both tables and the view plus `run_work.executor`, every
-- index, both policies, every check constraint, the RLS flags, the trigger, and the
-- view's own `reloptions`, where `security_invoker` lives) was taken from the live
-- database and from a throwaway local PostgreSQL that had executed THIS file:
-- **82 objects, md5 `976acfa04457bc8242958900e51d8284`, identical.** A census over the
-- whole `agent` schema is the WRONG instrument for that and was tried first — it
-- counts roles and grants the two environments legitimately differ on (342 rows live
-- against 357 locally), so it cannot tell a transcription slip from Supabase having
-- more roles than a fresh cluster.
--
-- **AN AUTOMATION EXECUTION IS A RUN, AND THAT IS THE WHOLE REUSE ARGUMENT.** The
-- durable execution system in this schema is four generic pieces plus one specific
-- executor: the queue's doorbell carries a run id, `agent.run_work` is the claim and
-- the lease, `agent.append_entry` is the fence, `agent.sweep_run_work` is the
-- recovery — and `runAgent` is the only thing about any of it that knows what a model
-- is. So an automation gets a real `agent.runs` row, a real `agent.run_work` row and a
-- real journal, and every one of those four pieces is reused UNCHANGED. What is new
-- here is the definition, the execution record, the scheduling, and one column saying
-- which executor a row wants.
--
-- **WHY NOT `run_work.kind`, WHICH LOOKS LIKE THE DISCRIMINATOR AND IS NOT.**
-- `agent.requeue_run` sets `kind = 'resume'` unconditionally, because `kind` records
-- WHY a row is outstanding rather than WHAT it is. An automation marked
-- `kind = 'automation'` would become an agent run on its first resume and answer
-- `no-agent` — a discriminator another function overwrites, which is this
-- repository's recorded "a lookup keyed at a different granularity than the thing
-- you ask it". `executor` is its own column and `requeue_run` names the columns it
-- sets, so nothing can quietly rewrite it.
--
-- **AND THE STATUS IS THE RUN'S, NOT A SECOND COPY OF IT.** `agent.runs.status` and
-- `agent.runs.stop` are projected off the journal by a trigger that already exists,
-- so `agent.automation_runs` deliberately carries NO status, result or error column:
-- those would be a second version of a fact the log already states, and two copies of
-- one fact eventually disagree. What this table carries is what the log cannot say —
-- which automation, which occurrence, the configuration this execution is running,
-- and each step's own outcome.
--
-- **THE WHOLE EXECUTION IS ONE TRANSACTION, WHICH IS WHY THERE IS NO STEP-LEVEL
-- FENCE HERE.** This milestone's steps are a weekday condition and a note: no model
-- call, no network call, no wait, so the outcomes and the `stopped` entry are written
-- together by `agent.finish_automation_run`, and `agent.append_entry` — the existing
-- fence, one copy — is what makes that exclusive. **THE STEP TYPE THAT CHANGES THIS
-- IS A WAIT OR AN APPROVAL**: the day an execution has to span transactions it needs
-- per-step entries and a resumable position, and that is a migration, not a tweak.
-- Said here because the next reader will be the one adding it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── which executor a work row wants ─────────────────────────────────────────
--
-- ANSWERED BY `claim_run`, in the same statement that takes the work and says whose
-- it is. That is the existing design's own argument for the tenant, applied to the
-- one other thing a consumer has to know before it does anything: a second question
-- asked after the claim could be raced by a retention delete, and a field on the
-- queue MESSAGE would be a consumer trusting a doorbell for authority.
--
-- DEFAULT `'agent'`, so every row written before this — and every row `accept_run`
-- writes without being told otherwise — means exactly what it meant.
alter table agent.run_work
  add column if not exists executor text not null default 'agent';

alter table agent.run_work
  drop constraint if exists run_work_executor_known;
alter table agent.run_work
  add constraint run_work_executor_known check (executor in ('agent', 'automation'));

comment on column agent.run_work.executor is
  'Which executor this row wants: agent (runAgent) or automation (the workflow). Answered by claim_run; never written by requeue_run, which owns `kind` and only `kind`.';

-- ── the definition ──────────────────────────────────────────────────────────
--
-- **IT BELONGS TO AN AGENT AND TO AN ACCOUNT, and only one of those is a column.**
-- `tenant_id` is here because every read filters on it and RLS keys on it;
-- `agent_id` is the owner, and its `on delete cascade` is what makes deleting an
-- agent take its automations with it rather than leaving orphans nothing can reach.
--
-- **THE STEPS ARE BOUNDED IN SHAPE HERE AND IN MEANING IN CODE.** A CHECK cannot
-- read the engine's step registry, exactly as it cannot read the tool catalog, so
-- this bounds the array and the route validates each type against `AUTOMATION_STEPS`.
-- Two different walls for two different questions, and saying which is which is what
-- stops either being mistaken for the other.
create table if not exists agent.automations (
  id           uuid primary key,
  tenant_id    text        not null check (length(tenant_id) between 1 and 200),
  agent_id     uuid        not null references agent.agents(id) on delete cascade,
  name         text        not null check (length(btrim(name)) between 1 and 200),

  -- **DISABLING PREVENTS NEW EXECUTIONS AND NOTHING ELSE.** It is not a delete and
  -- not a pause of work already accepted: an execution that has been accepted keeps
  -- its own recorded configuration and finishes.
  enabled      boolean     not null default true,

  -- ── the trigger ───────────────────────────────────────────────────────────
  -- `manual` is "Run now only"; `daily` also fires once a day at a local time.
  -- **BOTH START THE SAME WORKFLOW THROUGH THE SAME QUEUE** — the difference is who
  -- presses, and nothing below this line knows which it was except the one column
  -- that records it.
  schedule     text        not null default 'manual',
  -- THE LOCAL TIME OF DAY, and `zone` is the IANA zone it is local to. A `timestamptz`
  -- here would be an instant, and "every day at nine" is not an instant — it is a
  -- local time whose instant moves twice a year.
  at_local     time,
  zone         text,

  -- ── the workflow ──────────────────────────────────────────────────────────
  steps        jsonb       not null default '[]'::jsonb,

  -- **THE NEXT INSTANT THIS IS DUE, STORED RATHER THAN DERIVED ON EVERY READ.** It is
  -- what the screen shows and what the scheduler selects on, and computing it in two
  -- places is two answers to "when does this run next". Recomputed whenever the
  -- schedule changes and advanced by the scheduler itself.
  next_run_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint automations_schedule_known check (schedule in ('manual', 'daily')),

  -- A SCHEDULE IS WHOLE OR IT IS NOT A SCHEDULE. A daily automation with no time, or
  -- a time with no zone, is a row nothing can compute an instant from — and a manual
  -- one carrying a time is a control somebody set that nothing reads.
  -- ⚠ **THE ZONE BELONGS TO THE AUTOMATION, NOT ONLY TO ITS SCHEDULE**, and that is a
  -- correction made while writing the executor rather than a guess. A weekday condition
  -- has to know which day it is somewhere, and a manual automation has no schedule to
  -- carry a zone — so leaving it to the schedule would have made "only on Mondays" mean
  -- Monday in UTC for every Run-now automation, silently. What a daily schedule needs
  -- is the TIME; the zone is the automation's own and is optional.
  constraint automations_schedule_is_whole check (
    (schedule = 'manual' and at_local is null and next_run_at is null)
    or (schedule = 'daily' and at_local is not null and zone is not null and next_run_at is not null)
  ),
  -- WHOLE MINUTES. The screen offers a time, not a stopwatch, and a stored 09:00:30
  -- would be a schedule nobody asked for that no screen can show.
  constraint automations_at_is_whole_minutes check (
    at_local is null or (date_part('second', at_local) = 0 and date_part('microsecond', at_local) = 0)
  ),
  constraint automations_zone_shaped check (
    zone is null or length(btrim(zone)) between 1 and 200
  ),
  constraint automations_steps_shaped check (
    jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20
  )
);

-- The list is read for one agent, newest-changed first, and that is the only way it
-- is read. The tenant leads because every read filters on it first.
create index if not exists automations_by_agent
  on agent.automations (tenant_id, agent_id, updated_at desc);

-- WHAT THE SCHEDULER ASKS FOR: enabled, daily, due. Partial, because a manual
-- automation has no `next_run_at` at all and a disabled one is never due.
create index if not exists automations_due
  on agent.automations (next_run_at)
  where enabled and schedule = 'daily';

comment on table agent.automations is
  'One automation: whose it is, which agent it belongs to, whether it is enabled, how it starts, and the ordered steps it runs. The step TYPES are validated against the engine''s registry by the route; this table bounds their shape.';

-- ── `updated_at` is the database's ──────────────────────────────────────────
create or replace function agent.automations_touch() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists automations_touched on agent.automations;
create trigger automations_touched
  before update on agent.automations
  for each row execute function agent.automations_touch();

-- ── one execution ───────────────────────────────────────────────────────────
--
-- **`id` IS THE RUN'S ID.** One row per execution and one execution per run, so the
-- queue's doorbell — which carries a run id and nothing else — addresses this record
-- without a lookup, and `claim_run` takes its work row directly. A separate key with
-- a `run_id` beside it would be two identities for one thing.
--
-- **NO STATUS, NO RESULT, NO ERROR — see the header.** `agent.runs.status` and
-- `agent.runs.stop` are those facts, projected off this run's own journal.
create table if not exists agent.automation_runs (
  -- ⚠ `deferrable initially deferred`, AND THE REASON IS THE ORDER OF THE ACCEPTING
  -- TRANSACTION RATHER THAN A PREFERENCE. The occurrence gate below is an `on conflict
  -- do nothing` insert into THIS table, and it has to run before anything durable
  -- exists — otherwise a duplicate delivery creates a run and a work row before it
  -- discovers it lost, and a work row nothing points at is a run the queue executes.
  -- So the execution row is written first and its run a statement later, in the same
  -- transaction, and the reference is checked at commit. **FOUND BY DRIVING IT**: with
  -- the reference checked per statement, every accept failed
  -- `violates foreign key constraint`.
  --
  -- THE COST, STATED: a genuinely dangling reference would raise at COMMIT with less
  -- context than a per-statement violation. Only `service_role` can insert here and
  -- only two functions do, so the trade buys the ordering and risks a worse message on
  -- a path no caller can reach.
  id            uuid        primary key
                            references agent.runs(id) on delete cascade
                            deferrable initially deferred,
  automation_id uuid        not null references agent.automations(id) on delete cascade,

  -- COPIED, like `run_work.tenant_id` and for the same reason: every read of this
  -- table filters on the tenant, and reaching it through the automation would put a
  -- join in front of the one question asked most. Written only by the accepting
  -- function, from the automation row it has just checked, so the two cannot start
  -- out disagreeing.
  tenant_id     text        not null,

  -- ── why it started ────────────────────────────────────────────────────────
  trigger       text        not null,

  -- **WHICH SCHEDULED OCCURRENCE THIS IS, AS THE LOCAL DATE IN THE AUTOMATION'S OWN
  -- ZONE — and it is the whole of the duplicate-delivery guarantee.** A date rather
  -- than the computed instant, because the instant is what daylight saving moves and
  -- the date is what "once a day" means to a person. NULL for a manual run, which is
  -- what lets an account press Run now as often as it likes.
  occurrence    date,

  -- ⚠ THE CONFIGURATION THIS EXECUTION RUNS, FROZEN AT ACCEPTANCE. Editing the
  -- automation afterwards changes what the NEXT execution does and can never reach
  -- this one — which is the same rule the run's instruction snapshot follows, for the
  -- same reason: work already accepted must not change under whoever is running it.
  steps         jsonb       not null,

  -- **AND THE ZONE IS PART OF THAT CONFIGURATION.** A weekday condition asks which day
  -- it is somewhere, so an execution whose zone were read live would answer a different
  -- question the moment somebody moved the automation to another city — including for an
  -- execution already accepted. NULL when the automation has no zone, which the executor
  -- reads as UTC and says so rather than guessing a locality.
  zone          text,

  -- EACH STEP'S OWN OUTCOME, in order, written once with the `stopped` entry. Empty
  -- until then, and empty for ever on an occurrence that was missed.
  outcomes      jsonb       not null default '[]'::jsonb,

  -- HOW MANY OCCURRENCES WENT BY UNRUN, on a row recorded as missed. NULL on every
  -- row that really ran, so "none were missed" and "this is not a missed row" stay
  -- two different answers.
  missed        integer,

  created_at    timestamptz not null default now(),
  finished_at   timestamptz,

  constraint automation_runs_trigger_known check (trigger in ('manual', 'schedule')),
  -- AN OCCURRENCE IS WHAT A SCHEDULE HAS. A manual run carrying one would be counted
  -- against the once-a-day guarantee it has nothing to do with; a scheduled one
  -- without is a row the guarantee cannot see.
  constraint automation_runs_occurrence_matches_trigger check (
    (trigger = 'manual'   and occurrence is null)
    or (trigger = 'schedule' and occurrence is not null)
  ),
  constraint automation_runs_outcomes_shaped check (jsonb_typeof(outcomes) = 'array'),
  constraint automation_runs_missed_sane check (missed is null or missed >= 0)
);

-- ⚠ **THE ONCE-PER-OCCURRENCE GUARANTEE, IN THE DATABASE.** Two scheduler ticks that
-- both think an occurrence is due, a tick redelivered, a tick racing a hand-run of
-- the same minute: every one of them loses the same way, on one unique index, with
-- the loser's insert a no-op. A check in the scheduler would be a race wearing a
-- wall's clothes — the recorded shape this schema already refuses twice.
create unique index if not exists automation_runs_one_per_occurrence
  on agent.automation_runs (automation_id, occurrence)
  where occurrence is not null;

-- The history of one automation, newest first, and of one account's automations.
create index if not exists automation_runs_by_automation
  on agent.automation_runs (automation_id, created_at desc);

comment on table agent.automation_runs is
  'One execution of one automation: which occurrence it is, the configuration it was accepted with, and each step''s outcome. Its status and final result are agent.runs.status and agent.runs.stop, projected off its own journal.';

-- ═══════════════════════════════════════════════════════════════════════════
-- WHEN IS IT DUE — the arithmetic, in one place
--
-- **"EVERY DAY AT NINE" IS NOT AN INSTANT, AND THAT IS THE WHOLE OF THIS.** It is a
-- local time in a named zone, and the instant it means moves twice a year. So the
-- schedule stores a `time` and a zone, and this is the only thing that turns them
-- into an instant. The alternative — the browser or the route computing it — would be
-- a second copy of the arithmetic, in a language with no time zone database, and the
-- copy that drifts would be the one deciding when somebody's work runs.
--
-- **THE TWO DAYLIGHT-SAVING CASES, EACH STATED AND EACH MEASURED** (see
-- `test/integration/pg-automations.mjs`, which asserts both against a real
-- PostgreSQL rather than against this comment):
--
--   SPRING FORWARD — the local time may not exist at all. MEASURED on
--   `America/New_York`, where 02:30 on 2026-03-08 does not exist: PostgreSQL resolves
--   it rather than raising, and answers `2026-03-08 07:30:00+00`, which is **03:30
--   local** — shifted forward by the hour the clock skipped. So the occurrence gets a
--   real instant, it keeps the local DATE it belongs to, and **the run happens**, once,
--   an hour later in the day than usual. Better than silently skipping a day.
--
--   FALL BACK — the local time happens twice, and **the occurrence for a local date is
--   whichever instant this arithmetic gives, which is the only definition anything here
--   uses.** MEASURED on the same zone, where 01:30 on 2026-11-01 happens at both -04
--   and -05: PostgreSQL answers `2026-11-01 06:30:00+00`, the **standard-time** one —
--   the second of the two. So the earlier 01:30 is simply not that date's occurrence,
--   and asking from between them correctly answers the same date's instant rather than
--   tomorrow's (measured, because that is the reading that looks like a double fire and
--   is not). The automation runs once, at 01:30 EST.
--
--   **AND THE OCCURRENCE KEY IS THE LOCAL DATE, which makes the guarantee independent
--   of all of the above.** Even a change of zone, a re-read, or two ticks disagreeing
--   about the instant cannot file a second execution for one day: the unique index on
--   (automation, occurrence) is what holds, and this arithmetic only decides when.
create or replace function agent.automation_next_at(
  p_at_local time,
  p_zone     text,
  p_from     timestamptz
) returns timestamptz
  language plpgsql stable set search_path = '' as $$
declare
  v_today date;
  v_cand  timestamptz;
begin
  if p_at_local is null or p_zone is null or btrim(p_zone) = '' then
    raise exception 'automation_next_at: a daily schedule needs a local time and a zone';
  end if;
  -- A ZONE POSTGRES CANNOT USE RAISES HERE, which is what makes every writer below
  -- validate it by construction rather than by remembering to. The route asks `Intl`
  -- as well; two walls at two layers, and this is the one no caller can skip.
  v_today := (p_from at time zone p_zone)::date;
  v_cand  := (v_today + p_at_local) at time zone p_zone;
  -- STRICTLY AFTER. An occurrence exactly at `p_from` has already come due, and
  -- answering it as the NEXT one is how a scheduler files the same occurrence for ever.
  if v_cand > p_from then return v_cand; end if;
  return ((v_today + 1) + p_at_local) at time zone p_zone;
end; $$;

comment on function agent.automation_next_at(time, text, timestamptz) is
  'The next instant a daily local time in a named zone falls, strictly after a given instant. The one place the schedule arithmetic lives.';

-- ── the run's first journal entry ───────────────────────────────────────────
--
-- ONE PRODUCER OF THIS SHAPE, for the same reason the engine has one `startedEntry`:
-- two producers of one entry shape is how a log ends up subtly different from the log
-- a reader expects.
--
-- **IT NAMES NO LIMITS, AND THAT IS HONEST RATHER THAN AN OMISSION.** The bounds in
-- this schema bound a model: steps, tool calls, tokens, cost. An automation calls no
-- model, so writing them would be recording a budget nothing spends. The projection
-- trigger coalesces, so the run's `limits` column stays null — which reads as "this
-- run has no model bounds", which is true.
--
-- `prompt` IS THE AUTOMATION'S NAME, so a generic reader of the log — one that knows
-- nothing about automations — shows something true rather than an empty string.
create or replace function agent.automation_started_entry(
  p_tenant        text,
  p_automation_id uuid,
  p_name          text
) returns jsonb
  language sql volatile set search_path = '' as $$
  select jsonb_build_object(
    'kind',       'started',
    'at',         (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'tenant',     p_tenant,
    'agent',      'automation',
    -- NOT `stand-in`. Nothing is simulated because nothing is generated: every reader
    -- that decides whether an answer came from a model reads this field, and saying
    -- `stand-in` here would put a "simulated" label on a real internal action.
    'model',      'none',
    'prompt',     p_name,
    'automation', p_automation_id
  )
$$;

comment on function agent.automation_started_entry(text, uuid, text) is
  'The first journal entry of an automation execution. One producer of the shape; names no limits, because an automation calls no model.';

-- ═══════════════════════════════════════════════════════════════════════════
-- THE DEFINITION'S TWO WRITERS
--
-- **THE OWNERSHIP CHECK IS IN THE SAME TRANSACTION AS THE WRITE, AND THE TENANT IS AN
-- ARGUMENT ONLY BECAUSE NO CLIENT ROLE MAY EXECUTE THESE.** That is the posture
-- `send_to_agent` and `import_agent` already have: EXECUTE is revoked from `public`
-- and granted to `service_role` alone, and the caller is a server that verified the
-- token itself.
create or replace function agent.create_automation(
  p_tenant     text,
  p_agent_id   uuid,
  p_id         uuid,
  p_name       text,
  p_enabled    boolean,
  p_schedule   text,
  p_at_local   time,
  p_zone       text,
  p_steps      jsonb,
  p_max        integer default 20
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agent agent.agents;
  v_next  timestamptz := null;
  v_row   agent.automations;
  v_held  integer;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'create_automation: tenant must be a non-empty string';
  end if;

  -- WHOSE AGENT IS THIS. Answered as a VALUE rather than raised: another account's
  -- agent and an agent that is not there are the same answer, because the difference
  -- between them is information.
  select * into v_agent from agent.agents
   where id = p_agent_id and tenant_id = p_tenant;
  if v_agent.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;

  select count(*) into v_held from agent.automations
   where agent_id = p_agent_id and tenant_id = p_tenant;
  if v_held >= greatest(1, coalesce(p_max, 20)) then
    return jsonb_build_object('ok', false, 'error', 'too-many', 'held', v_held);
  end if;

  -- THE ARITHMETIC, ONCE. A daily schedule gets its instant here; a manual one has
  -- none, and the constraint refuses a row that says otherwise.
  if p_schedule = 'daily' then
    v_next := agent.automation_next_at(p_at_local, p_zone, now());
  end if;

  insert into agent.automations
    (id, tenant_id, agent_id, name, enabled, schedule, at_local, zone, steps, next_run_at)
  values
    (p_id, p_tenant, p_agent_id, p_name, coalesce(p_enabled, true),
     coalesce(p_schedule, 'manual'), p_at_local, p_zone,
     coalesce(p_steps, '[]'::jsonb), v_next)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'next_run_at', v_row.next_run_at);
end; $$;

-- ── editing it ──────────────────────────────────────────────────────────────
--
-- **A REPLACE OF THE SETTINGS, NOT A PATCH, AND THE FORM ALWAYS SENDS ALL OF THEM.**
-- A per-field PATCH would need a way to say "leave this alone" that is distinct from
-- "set it to nothing", and for a schedule — three columns that must agree — that is
-- three absent/empty ambiguities at once. The enable toggle is its own narrow write
-- for exactly that reason: it is the one change that must not carry a whole
-- configuration with it.
--
-- ⚠ **EDITING REACHES THE NEXT EXECUTION AND CAN NEVER REACH AN ACCEPTED ONE.** The
-- steps an execution runs are copied into `agent.automation_runs.steps` when it is
-- accepted, so this statement cannot change what is already running or already run.
create or replace function agent.update_automation(
  p_tenant   text,
  p_id       uuid,
  p_name     text,
  p_enabled  boolean,
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_steps    jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row  agent.automations;
  v_next timestamptz := null;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'update_automation: tenant must be a non-empty string';
  end if;

  -- LOCKED, so the scheduler cannot advance `next_run_at` between this read and the
  -- write below and have its advance thrown away.
  select * into v_row from agent.automations
   where id = p_id and tenant_id = p_tenant
     for update;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  if p_schedule = 'daily' then
    -- **RECOMPUTED FROM NOW, NOT CARRIED OVER, and that is deliberate.** A person who
    -- changes the time means the new time, and keeping the stored instant would leave
    -- the automation firing at the old one once more. The cost is stated: moving the
    -- time forward past today's occurrence skips today, which is what changing a
    -- schedule means.
    v_next := agent.automation_next_at(p_at_local, p_zone, now());
  end if;

  update agent.automations
     set name        = p_name,
         enabled     = coalesce(p_enabled, true),
         schedule    = coalesce(p_schedule, 'manual'),
         at_local    = p_at_local,
         zone        = p_zone,
         steps       = coalesce(p_steps, '[]'::jsonb),
         next_run_at = v_next
   where id = p_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'next_run_at', v_row.next_run_at);
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ACCEPTING AN EXECUTION — one transaction, and the same queue either way
--
-- **"RUN NOW" AND THE SCHEDULE COME THROUGH HERE, and that is requirement 2 met as
-- one code path rather than as two that agree.** The only difference between them is
-- `p_trigger` and whether there is an occurrence; everything after that line is
-- identical, so a manual run and a scheduled one cannot come to be executed
-- differently.
--
-- **THE ORDER IS THE WHOLE OF THE CORRECTNESS, and it is `send_to_agent`'s order:**
--
--   1. is this automation this tenant's?      → no  : `no-automation`
--   2. has this occurrence already been filed? → yes : the repeat, whatever the
--                                                      configuration says now
--   3. is the automation disabled?             → yes : `disabled`, nothing written
--   4. is its agent paused?                    → yes : `paused`,   nothing written
--   5. insert the execution, on conflict do nothing
--   6. absorbed by a racing tick?              → yes : the repeat
--   7. the run, its log and its work row — and the executor
--
-- **STEP 2 IS A PROBE AND STEP 5 IS STILL THE AUTHORITY.** A read cannot see a twin
-- in another transaction, so reading the probe as the gate would put a check-then-act
-- where a unique index belongs. The probe's job is only to answer a duplicate
-- delivery without refusing it for a state that arrived afterwards.
create or replace function agent.accept_automation_run(
  p_tenant        text,
  p_automation_id uuid,
  p_run_id        uuid,
  p_trigger       text,
  p_occurrence    date default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  -- ⚠ SCALARS RATHER THAN A ROW VARIABLE, and PL/pgSQL is why: a record or row-type
  -- variable MAY NOT SHARE AN `into` LIST, so reading the automation and its agent's
  -- status in one statement means naming the fields. That is no loss — the list says
  -- exactly which of an automation's columns this decision rests on.
  v_id      uuid;
  v_name    text;
  v_enabled boolean;
  v_steps   jsonb;
  v_zone    text;
  v_status  text;
  v_exec    agent.automation_runs;
  v_new     boolean := false;
  v_entry   jsonb;
  v_accept  jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'accept_automation_run: tenant must be a non-empty string';
  end if;
  if p_run_id is null then
    raise exception 'accept_automation_run: the execution needs a run id';
  end if;
  if p_trigger is null or p_trigger not in ('manual', 'schedule') then
    raise exception 'accept_automation_run: a run is triggered manually or by a schedule';
  end if;

  -- ── whose automation is this, and is its agent taking work ────────────────
  -- ONE READ FOR BOTH FACTS. Asking the agent's status separately would be a second
  -- statement a pause could land between, and the answer that matters — "may this
  -- start" — is about the two of them together.
  select a.id, a.name, a.enabled, a.steps, a.zone, g.status
    into v_id, v_name, v_enabled, v_steps, v_zone, v_status
    from agent.automations a
    join agent.agents g on g.id = a.agent_id
   where a.id = p_automation_id and a.tenant_id = p_tenant;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  -- ── has this occurrence already been filed ───────────────────────────────
  if p_occurrence is not null then
    select * into v_exec from agent.automation_runs
     where automation_id = p_automation_id and occurrence = p_occurrence;
  end if;

  if v_exec.id is null then
    -- ⚠ NOTHING IS WRITTEN ON EITHER REFUSAL — not the execution, not a run, not a
    -- work row. A disabled automation and a paused agent are the two ways an account
    -- says "not now", and both have to leave the world exactly as it was, or turning
    -- something back on would find work nobody asked for waiting in the queue.
    if not v_enabled then
      return jsonb_build_object('ok', false, 'error', 'disabled');
    end if;
    -- A PAUSE ON THE AGENT STOPS ITS AUTOMATIONS TOO. The agent is what an automation
    -- belongs to, so "this agent isn't starting anything new" has to mean all of it;
    -- reading a pause as being only about conversations would make the pause control a
    -- promise it does not keep.
    if v_status is distinct from 'active' then
      return jsonb_build_object('ok', false, 'error', 'paused', 'status', v_status);
    end if;

    insert into agent.automation_runs
      (id, automation_id, tenant_id, trigger, occurrence, steps, zone)
    values
      (p_run_id, p_automation_id, p_tenant, p_trigger, p_occurrence, v_steps, v_zone)
    on conflict (automation_id, occurrence) where occurrence is not null
    do nothing
    returning * into v_exec;
    v_new := v_exec.id is not null;

    if not v_new then
      -- A SECOND TICK RACING THIS ONE, in another transaction. Read what it filed.
      select * into v_exec from agent.automation_runs
       where automation_id = p_automation_id and occurrence = p_occurrence;
      if v_exec.id is null then
        raise exception 'accept_automation_run: the occurrence conflicted with a row that is not there';
      end if;
    end if;
  end if;

  -- ── an occurrence already filed starts NOTHING ───────────────────────────
  -- ONE COPY OF THIS ANSWER. The probe and the race arrive at the same fact, and two
  -- objects saying it is two that can disagree the moment either is edited.
  if not v_new then
    return jsonb_build_object(
      'ok', true, 'repeat', true,
      'run_id', v_exec.id, 'occurrence', v_exec.occurrence, 'trigger', v_exec.trigger);
  end if;

  v_entry := agent.automation_started_entry(p_tenant, p_automation_id, v_name);

  -- THE RUN, ITS FIRST ENTRY AND ITS WORK ROW, through the function that already owns
  -- that transaction rather than through three inserts of our own.
  v_accept := agent.accept_run(p_run_id, p_tenant, v_entry, 'start');

  -- ⚠ **AND WHICH EXECUTOR WANTS IT, IN THE SAME TRANSACTION.** `accept_run` writes
  -- the row with the column's default, `'agent'`, and nothing outside this transaction
  -- can see it before this line has run — so there is no instant at which a consumer
  -- could claim this row and route it to the agent loop. The alternative was a fifth
  -- parameter on `accept_run`, which would have meant either an overload (and a live
  -- named-argument call made ambiguous) or dropping and recreating a function on the
  -- money path for a column with a default.
  update agent.run_work set executor = 'automation' where run_id = p_run_id;

  return jsonb_build_object(
    'ok', true, 'repeat', false,
    'run_id', p_run_id, 'occurrence', v_exec.occurrence, 'trigger', v_exec.trigger,
    'state', v_accept -> 'state');
end; $$;

comment on function agent.accept_automation_run(text, uuid, uuid, text, date) is
  'One transaction: accept an execution of an owned, enabled automation whose agent is active, snapshotting its steps, and queue it for the automation executor. Idempotent per (automation, occurrence); refuses a disabled automation or a paused agent without writing anything.';

-- ── an occurrence that was due and did not run ──────────────────────────────
--
-- **IT IS RECORDED AS A RUN THAT ENDED INSTANTLY, and that is the honest shape.** A
-- missed occurrence is not an absence to be inferred from a gap in the history: the
-- gap reads exactly like an automation nobody ever enabled, and this is the one thing
-- that can tell somebody why nothing happened. So it gets a run, a `started` entry and
-- a `stopped` entry whose reason names what happened — and NO work row, because there
-- is nothing to deliver and a queue row nothing will claim is a row the sweeper offers
-- for ever.
--
-- ONE ROW PER OCCURRENCE, so a week of downtime cannot become a week of rows: the
-- scheduler advances past the occurrences it is not running and records the oldest one
-- with a COUNT of how many went by.
create or replace function agent.record_automation_occurrence(
  p_tenant        text,
  p_automation_id uuid,
  p_run_id        uuid,
  p_occurrence    date,
  p_stop          jsonb,
  p_missed        integer default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_auto agent.automations;
  v_exec agent.automation_runs;
begin
  if p_occurrence is null then
    raise exception 'record_automation_occurrence: only a scheduled occurrence can be recorded unrun';
  end if;
  if p_stop is null or p_stop ->> 'reason' is null then
    raise exception 'record_automation_occurrence: an unrun occurrence must say why';
  end if;

  select * into v_auto from agent.automations
   where id = p_automation_id and tenant_id = p_tenant;
  if v_auto.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  insert into agent.automation_runs
    (id, automation_id, tenant_id, trigger, occurrence, steps, zone, missed, finished_at)
  values
    (p_run_id, p_automation_id, p_tenant, 'schedule', p_occurrence, v_auto.steps, v_auto.zone,
     p_missed, now())
  on conflict (automation_id, occurrence) where occurrence is not null
  do nothing
  returning * into v_exec;

  if v_exec.id is null then
    -- ALREADY FILED — by a racing tick, or by a real execution. Either way this
    -- occurrence is accounted for and nothing more is written.
    return jsonb_build_object('ok', true, 'repeat', true, 'occurrence', p_occurrence);
  end if;

  insert into agent.runs (id, tenant_id) values (p_run_id, p_tenant)
  on conflict (id) do nothing;

  insert into agent.run_entries (run_id, seq, body) values
    (p_run_id, 0, agent.automation_started_entry(p_tenant, p_automation_id, v_auto.name)),
    (p_run_id, 1, jsonb_build_object(
      'kind', 'stopped',
      'at',   (extract(epoch from clock_timestamp()) * 1000)::bigint,
      'stop', p_stop))
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true, 'repeat', false, 'run_id', p_run_id,
    'occurrence', p_occurrence, 'reason', p_stop ->> 'reason', 'missed', p_missed);
end; $$;

comment on function agent.record_automation_occurrence(text, uuid, uuid, date, jsonb, integer) is
  'Record a scheduled occurrence that was due and did not run — missed after downtime, or refused because the agent was paused. A run with no work row, so nothing will ever deliver it.';

-- ═══════════════════════════════════════════════════════════════════════════
-- FINISHING ONE — the outcomes and the stop, together
--
-- **ONE TRANSACTION, AND `agent.append_entry` IS WHAT MAKES IT EXCLUSIVE.** The fence
-- already validates the holder, the token, the work being unfinished and the lease
-- being live, in the same transaction as its insert — so an automation execution needs
-- no fence of its own, and there is not a second copy of one anywhere. If the entry is
-- refused, NOTHING else is written: no outcomes, no release. That is what leaves a
-- displaced worker unable to record a thing about a run somebody else now holds.
--
-- **AND IT IS WHY THE OUTCOMES ARE SAFE IN A COLUMN RATHER THAN IN THE LOG.** They are
-- written in the same statement group as the `stopped` entry the fence just admitted,
-- so there is no window in which a run reads finished with its steps missing. The day a
-- step can pause — a wait, an approval — that stops being true and the outcomes have to
-- become entries; the header says so, and this is the other half of that note.
create or replace function agent.finish_automation_run(
  p_run_id   uuid,
  p_worker   text,
  p_token    uuid,
  p_outcomes jsonb,
  p_stop     jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_seq    integer;
  v_answer jsonb;
begin
  if p_stop is null or p_stop ->> 'reason' is null then
    raise exception 'finish_automation_run: an execution must say why it ended';
  end if;
  if p_outcomes is null or jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'finish_automation_run: the outcomes must be a list, one per step attempted';
  end if;

  -- THE POSITION IS READ RATHER THAN ASSUMED. "The started entry is at seq 0" is
  -- `accept_run`'s fact, and hardcoding a 1 here would be a second copy of it that a
  -- change there could not move.
  select coalesce(max(seq) + 1, 0) into v_seq
    from agent.run_entries where run_id = p_run_id;

  v_answer := agent.append_entry(
    p_run_id, v_seq,
    jsonb_build_object(
      'kind', 'stopped',
      'at',   (extract(epoch from clock_timestamp()) * 1000)::bigint,
      'stop', p_stop),
    p_worker, p_token);

  -- REFUSED MEANS NOTHING ELSE HAPPENS, and the refusal is handed back under its own
  -- name so the caller can tell "the claim is gone" from "the journal is broken".
  if coalesce((v_answer -> 'ok')::boolean, false) is not true then
    return v_answer;
  end if;

  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES.
  -- `append_entry` answers `already` for the same entry re-sent, and on that path the
  -- outcomes are already recorded; overwriting them would replace what really happened
  -- with a second computation of it.
  update agent.automation_runs
     set outcomes = p_outcomes, finished_at = now()
   where id = p_run_id and finished_at is null;

  perform agent.release_run(p_run_id, p_worker, p_token, true, null);

  return v_answer || jsonb_build_object('finished', true);
end; $$;

comment on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb) is
  'One transaction: record an automation execution''s step outcomes and its stop, through the same fence every journal write goes through, and release the work. Writes nothing at all if the fence refuses.';

-- ═══════════════════════════════════════════════════════════════════════════
-- THE SCHEDULER'S ONE STATEMENT
--
-- Called once a minute by the engine's cron, which already runs at that cadence to
-- offer dropped work again. It files what is due and advances what it has handled;
-- the caller's only job afterwards is to ring the doorbell for each run id it answers.
--
-- **IT TAKES NO `now`, DELIBERATELY.** A caller-supplied clock is a way to file
-- occurrences for a time that is not now, and nothing needs it: the daylight-saving
-- arithmetic lives in `agent.automation_next_at`, which DOES take an instant and is
-- where both transitions are measured. An instrument belongs at the arithmetic, not at
-- the writer.
--
-- **`for update skip locked` IS WHY TWO TICKS ARE SAFE, and the unique index is why
-- that is not the only reason.** Two ticks overlapping take different rows; a tick that
-- somehow reached the same row files the same occurrence and the index makes the second
-- insert a no-op. Two walls for the one guarantee somebody depends on.
--
-- **NO CATCH-UP BURST, AND THE MECHANISM IS THE ADVANCE.** `next_run_at` names the
-- OLDEST occurrence that has not been handled, and this advances it to the first
-- occurrence strictly after NOW — not to the one after the occurrence it just handled.
-- So a week of downtime costs one tick, one recorded row and one jump to tomorrow,
-- rather than seven executions arriving at once.
create or replace function agent.tick_automations(
  p_catchup_s integer default 3600,
  p_limit     integer default 25
) returns setof jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  r        record;
  v_occ    date;
  v_next   timestamptz;
  v_run    uuid;
  v_total  integer;
  v_answer jsonb;
  v_out    jsonb;
begin
  for r in
    select a.* from agent.automations a
     where a.enabled
       and a.schedule = 'daily'
       and a.next_run_at is not null
       and a.next_run_at <= now()
     order by a.next_run_at asc
     limit greatest(1, coalesce(p_limit, 25))
     for update skip locked
  loop
    -- ⚠ ONE BAD ROW MUST NOT STOP THE SCHEDULER. A zone the time zone database no
    -- longer carries makes the arithmetic raise, and without this block that raise
    -- would take every other automation's tick with it. **THE COST IS STATED: such a
    -- row is retried every minute until somebody fixes its zone**, because the advance
    -- needs the arithmetic that just failed and guessing one would be filing an
    -- occurrence nobody asked for. It is loud rather than silent, which is the right
    -- direction.
    begin
      v_occ  := (r.next_run_at at time zone r.zone)::date;
      v_next := agent.automation_next_at(r.at_local, r.zone, now());
      v_run  := gen_random_uuid();

      if now() - r.next_run_at
           <= make_interval(secs => greatest(0, coalesce(p_catchup_s, 3600))) then
        -- ── fresh enough to run ───────────────────────────────────────────
        v_answer := agent.accept_automation_run(r.tenant_id, r.id, v_run, 'schedule', v_occ);
        if coalesce((v_answer -> 'ok')::boolean, false) then
          v_out := jsonb_build_object(
            'automation_id', r.id, 'occurrence', v_occ,
            'run_id', v_answer ->> 'run_id',
            'action', case when coalesce((v_answer -> 'repeat')::boolean, false)
                           then 'already' else 'filed' end);
        else
          -- DISABLED BETWEEN THE SELECT AND HERE, OR THE AGENT IS PAUSED. Recorded
          -- rather than skipped: an account that paused an agent and then sees nothing
          -- at all in the history cannot tell that from an automation that never
          -- worked.
          perform agent.record_automation_occurrence(
            r.tenant_id, r.id, v_run, v_occ,
            jsonb_build_object('reason', v_answer ->> 'error'), null);
          v_out := jsonb_build_object(
            'automation_id', r.id, 'occurrence', v_occ,
            'action', v_answer ->> 'error');
        end if;
      else
        -- ── too old to run: recorded, counted, and jumped over ────────────
        -- HOW MANY OCCURRENCES WENT BY, THIS ONE INCLUDED, counted in LOCAL DATES
        -- rather than by dividing an interval — a local day is 23 or 25 hours long
        -- twice a year, so an interval division is wrong exactly where it matters.
        v_total := greatest(1, (v_next at time zone r.zone)::date - v_occ);
        perform agent.record_automation_occurrence(
          r.tenant_id, r.id, v_run, v_occ,
          jsonb_build_object('reason', 'missed', 'occurrences', v_total), v_total);
        v_out := jsonb_build_object(
          'automation_id', r.id, 'occurrence', v_occ,
          'action', 'missed', 'occurrences', v_total);
      end if;

      update agent.automations set next_run_at = v_next where id = r.id;
      return next v_out;
    exception when others then
      return next jsonb_build_object(
        'automation_id', r.id, 'action', 'error', 'error', sqlerrm);
    end;
  end loop;
  return;
end; $$;

comment on function agent.tick_automations(integer, integer) is
  'File every daily automation that is due: run it if it is fresh, record it unrun if it is stale or its agent is paused, and advance it past what was handled so downtime cannot become a burst. Answers one row per automation touched; the caller rings the queue for each run id.';

-- ═══════════════════════════════════════════════════════════════════════════
-- THE CLAIM ANSWERS WHICH EXECUTOR WANTS THE ROW
--
-- **SAME SIGNATURE, ONE FIELD MORE, so nothing that calls it has to change and
-- `create or replace` keeps its privileges.** The body is otherwise character for
-- character the fencing migration's, which is deliberate: this is the gate that makes
-- execution exclusive and it is not the place for an unrelated edit.
--
-- The answer is where it is because of the argument the existing design already makes
-- about the tenant: claiming the work and learning what it is are ONE statement, so a
-- stale or replayed doorbell can never make a consumer run the wrong executor any more
-- than it can make it act as the wrong account.
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
    -- WHICH EXECUTOR. `kind` is why the row is outstanding (start or resume) and
    -- `requeue_run` rewrites it on every resume; this is what the row IS, and nothing
    -- rewrites it.
    'executor', v_row.executor,
    'attempts', v_row.attempts,
    'claim_token', v_row.claim_token,
    'lease_expires_at', v_row.lease_expires_at
  );
end; $$;

grant execute on function agent.claim_run(uuid, text, integer) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT A CUSTOMER READS
--
-- **`security_invoker = true` IS THE WHOLE SAFETY ARGUMENT, exactly as it is for
-- `agent.agent_thread`.** Without it this view runs as its OWNER and is a hole through
-- the row-level security on both base tables, for every account at once.
--
-- **A VIEW RATHER THAN A POSTGREST EMBED.** `automation_runs.id` has a foreign key to
-- `agent.runs`, so `select=…,runs(status,stop)` would work with no migration — and
-- could only ever be asserted from documentation, because nothing in this repository
-- can run PostgREST. A view is plain SQL and the schema check drives it on a real
-- PostgreSQL.
--
-- **AN INNER JOIN, AND IT IS CORRECT BY CONSTRUCTION.** The foreign key guarantees the
-- run exists, and retention on `agent.runs` cascades to this table, so there is no
-- execution whose run is gone. A left join would be defending against a state the
-- schema does not permit, and would quietly start answering nulls if it ever did.
create or replace view agent.automation_history
  with (security_invoker = true)
as
  select ar.id,
         ar.automation_id,
         ar.tenant_id,
         ar.trigger,
         ar.occurrence,
         ar.steps,
         ar.zone,
         ar.outcomes,
         ar.missed,
         ar.created_at,
         ar.finished_at,
         -- THE STATUS AND THE FINAL ANSWER, PROJECTED OFF THE RUN'S OWN LOG. This is
         -- the only place they exist: `automation_runs` deliberately carries no copy.
         r.status     as run_status,
         r.stop       as run_stop,
         r.started_at as run_started_at,
         r.stopped_at as run_stopped_at
    from agent.automation_runs ar
    join agent.runs r on r.id = ar.id;

comment on view agent.automation_history is
  'One execution with its run''s projected status and stop. security_invoker, so a reader sees only their own account''s — the same posture agent.agent_thread has.';

-- ═══════════════════════════════════════════════════════════════════════════
-- TENANT ISOLATION
--
-- RLS on both tables, FORCED, keyed on `agent.tenant_id()` — the tenant out of the
-- request's own JWT. It fails closed three ways through SQL's null semantics: no
-- claims, claims that will not parse, and claims with no tenant all answer NULL, and
-- `tenant_id = NULL` is NULL rather than true, so the policy matches no rows.
--
-- **THE LIMIT, STATED AS IT IS EVERYWHERE ELSE IN THIS SCHEMA: `service_role` CARRIES
-- `BYPASSRLS`.** So these policies protect the READ path a signed-in customer uses,
-- and what protects one account from another on the SERVER'S path is the tenant in the
-- query filter and in every function's own check. Both walls exist; only one of them
-- is in the database.
alter table agent.automations enable row level security;
alter table agent.automations force row level security;
alter table agent.automation_runs enable row level security;
alter table agent.automation_runs force row level security;

drop policy if exists automations_own_tenant on agent.automations;
create policy automations_own_tenant on agent.automations
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

drop policy if exists automation_runs_own_tenant on agent.automation_runs;
create policy automation_runs_own_tenant on agent.automation_runs
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

-- ── who may touch any of it ─────────────────────────────────────────────────
--
-- A CUSTOMER READS AND WRITES NOTHING DIRECTLY. Every change goes through a route that
-- verified their token, so `authenticated` gets SELECT and nothing else — and `anon`
-- gets nothing at all, revoked explicitly rather than left to the default.
grant usage on schema agent to authenticated, service_role;
grant select on agent.automations, agent.automation_runs, agent.automation_history
  to authenticated, service_role;
grant insert, update, delete on agent.automations to service_role;
grant insert, update on agent.automation_runs to service_role;
-- DELETE ON THE EXECUTIONS IS NOBODY'S. A history somebody can quietly remove is not a
-- history; they go with their automation, or with their run under retention, and both of
-- those are cascades rather than a grant.

revoke all on agent.automations from anon;
revoke all on agent.automation_runs from anon;
revoke all on agent.automation_history from anon;

-- ── the functions are the server's alone ────────────────────────────────────
--
-- EVERY ONE OF THEM TAKES THE TENANT AS AN ARGUMENT, and that is only safe because no
-- client role can execute them. The same posture `send_to_agent` and `import_agent`
-- have, and the grant is the whole of what makes a tenant argument acceptable.
revoke all on function agent.automation_next_at(time, text, timestamptz) from public;
revoke all on function agent.automation_started_entry(text, uuid, text) from public;
revoke all on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer) from public;
revoke all on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb) from public;
revoke all on function agent.accept_automation_run(text, uuid, uuid, text, date) from public;
revoke all on function agent.record_automation_occurrence(text, uuid, uuid, date, jsonb, integer) from public;
revoke all on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb) from public;
revoke all on function agent.tick_automations(integer, integer) from public;

grant execute on function agent.automation_next_at(time, text, timestamptz) to service_role;
grant execute on function agent.automation_started_entry(text, uuid, text) to service_role;
grant execute on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer) to service_role;
grant execute on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb) to service_role;
grant execute on function agent.accept_automation_run(text, uuid, uuid, text, date) to service_role;
grant execute on function agent.record_automation_occurrence(text, uuid, uuid, date, jsonb, integer) to service_role;
grant execute on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb) to service_role;
grant execute on function agent.tick_automations(integer, integer) to service_role;
