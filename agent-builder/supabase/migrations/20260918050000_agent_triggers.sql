-- ══════════════════════════════════════════════════════════════════════════
-- TRIGGERS: one-time and weekly schedules, and events — inbound and internal
--
-- **EVERYTHING HERE IS AN EXTENSION OF THE MACHINERY THAT ALREADY EXISTS.** An event does
-- not get a queue, a journal or a scheduler of its own: it becomes an `agent.automations`
-- row's reason to run, filed by `agent.accept_automation_run` exactly as a schedule is, so
-- claiming, leasing, fencing, sweeping and the doorbell are UNCHANGED.
--
-- Four things, and each has one reason to be SQL rather than JavaScript:
--
--   1. TWO MORE SCHEDULES (`once`, `weekly`). The arithmetic has to be where
--      `automation_next_at` is, or a schedule's next instant is computed in two places and
--      the copy that drifts decides when somebody's work runs.
--   2. A DURABLE EVENT (`agent.events`). Dedup is a unique index, which is the only wall a
--      duplicate delivery cannot race.
--   3. AN INBOUND ENDPOINT'S CREDENTIAL (`agent.webhooks`). The owning account is derived
--      from the endpoint row, never from the payload — which means the row is the
--      authority and the lookup has to be here.
--   4. AN EVENT WAIT (`heard`). The arrival race is resolved by a ROW LOCK and not by
--      timing: both the pause and the arrival take the same lock, so whichever is second
--      reads what the first committed.
--
-- ⚠ **WHAT IS DELIBERATELY NOT HERE: a second executor.** An event-triggered execution is
-- an `automation` execution, so `run_work.executor` is unchanged and `runner.mjs` needs no
-- new branch. That is the whole reason this is small.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. TWO MORE SCHEDULES ──────────────────────────────────────────────────
--
-- `once` is an instant: a local date and a local time in a zone, and when it has fired its
-- `next_run_at` is null and nothing more is due. **NO SECOND FLAG SAYS IT HAS FIRED** — a
-- `once` row with no next instant has, which is derivable and cannot disagree with itself.
--
-- `weekly` is `daily` narrowed to named days, which is why it needs no new arithmetic: the
-- next instant is the next day IN THE LIST at that local time. The day names are the
-- `weekday` step's own three-letter set, so a customer meets one vocabulary.
--
-- ⚠ **`days` IS A LIST AND NOT A SINGLE DAY.** "Every Monday and Thursday" is one
-- automation with one history; two rows would be two things to watch and two schedules to
-- keep in step.

alter table agent.automations
  add column if not exists days text[] not null default '{}',
  add column if not exists on_date date,
  -- WHICH EVENT MAKES IT RUN, if any. **NOT a schedule**: a row may be started by hand AND
  -- by an event, and folding the two into one column would make that unsayable.
  add column if not exists on_event text;

alter table agent.automations drop constraint if exists automations_schedule_known;
alter table agent.automations add constraint automations_schedule_known
  check (schedule in ('manual', 'daily', 'weekly', 'once'));

-- ⚠ **EVERY SCHEDULE'S OWN SHAPE, IN ONE CONSTRAINT — and it REPLACES the old one rather
-- than sitting beside it**, because two constraints about one thing is two copies of it.
--
-- ⚠ **THE ZONE IS THE AUTOMATION'S AND IS OPTIONAL, which this schema already records as a
-- correction and which I made again.** The first draft of this constraint said `manual ⇒
-- zone is null`, and that is exactly the mistake the original comment two hundred lines up
-- warns about: a `weekday` condition has to know which day it is SOMEWHERE, and a manual
-- automation has no schedule to carry a zone — so requiring it to be null would make "only
-- on Mondays" mean Monday in UTC for every Run-now automation, silently. **Measured**: it
-- failed nine existing checks, six of them about things that have nothing to do with zones.
--
-- What each schedule really needs: `manual` no time and no next instant; `daily` a time and
-- a zone and a next instant; `weekly` those plus at least one day; `once` those plus a date
-- — **and its next instant UNCONSTRAINED, because a `once` row that has fired has none, and
-- that absence IS how it says so.**
alter table agent.automations drop constraint if exists automations_schedule_is_whole;
alter table agent.automations drop constraint if exists automations_schedule_whole;
alter table agent.automations add constraint automations_schedule_is_whole check (
  case schedule
    when 'manual' then at_local is null and next_run_at is null and days = '{}' and on_date is null
    when 'daily'  then at_local is not null and zone is not null and next_run_at is not null
                       and days = '{}' and on_date is null
    when 'weekly' then at_local is not null and zone is not null and next_run_at is not null
                       -- ⚠ **`cardinality`, NEVER `array_length(days, 1)` — and a real PostgreSQL
                       -- is what said so.** `array_length('{}', 1)` is NULL, `NULL between 1 and 7`
                       -- is NULL, and **a CHECK constraint is SATISFIED by NULL** — so a weekly
                       -- schedule with no days at all was ALLOWED, which is a schedule that can
                       -- never come due wearing a validated row's clothes. `cardinality` answers 0
                       -- for an empty array, which is a value the comparison can refuse.
                       and cardinality(days) between 1 and 7 and on_date is null
    when 'once'   then at_local is not null and zone is not null and days = '{}'
                       and on_date is not null
    else false
  end
);

/**
 * ⚠ **AN EVENT-TRIGGERED EXECUTION HAS NO OCCURRENCE, and the constraint that says which
 * triggers may have one predates events entirely.** It listed `manual` and `schedule` and
 * nothing else, so `else false` refused every event execution — MEASURED: the insert was
 * refused by `automation_runs_occurrence_matches_trigger`, several checks away from anything
 * about occurrences. An event's identity is the EVENT, held by
 * `automation_runs_one_per_event`, which is a different index for a different fact.
 */
/**
 * ⚠ **AND THE TRIGGER VOCABULARY ITSELF — the THIRD constraint of this class, and finding
 * them one at a time is what said to census them instead.** `automation_runs_trigger_known`,
 * `automation_runs_occurrence_matches_trigger` and `automation_runs_wait_is_whole` were all
 * written before an event could start anything, and each refused an event execution from a
 * different direction with a message about something else. A grep for every constraint naming
 * the vocabulary is the check that finds the set; the function's own `p_trigger not in (...)`
 * is a fourth place and is widened where it lives.
 */
alter table agent.automation_runs drop constraint if exists automation_runs_trigger_known;
alter table agent.automation_runs add constraint automation_runs_trigger_known check (
  trigger in ('manual', 'schedule', 'event')
);

alter table agent.automation_runs drop constraint if exists automation_runs_occurrence_matches_trigger;
alter table agent.automation_runs add constraint automation_runs_occurrence_matches_trigger check (
  (trigger = 'manual'   and occurrence is null)
  or (trigger = 'schedule' and occurrence is not null)
  or (trigger = 'event'    and occurrence is null)
);

/**
 * ⚠ **AN EVENT WAIT HAS NO DEADLINE, AND THAT IS THE POINT OF IT.** The pause constraint was
 * written when every wait had one — a timed wait has its instant and an approval has its
 * window — so it demanded `wait_until is not null` for any pause at all and refused every
 * event wait outright. An event wait that timed out would need a second configured outcome
 * and a second reader; what a customer wants instead is a `wait` beside it, which this
 * product already has. So the pair is: a pause of any other kind still needs its deadline,
 * and an event pause is the one that may have none.
 *
 * **IT IS STILL A PAIR RATHER THAN A RELAXATION** — a `wait_until` with no `waiting` is as
 * broken as it ever was, and a pause that is not an event and has no deadline is a wait
 * nothing will ever wake.
 */
alter table agent.automation_runs drop constraint if exists automation_runs_wait_is_whole;
alter table agent.automation_runs add constraint automation_runs_wait_is_whole check (
  (waiting is null and wait_until is null)
  or (waiting is not null and jsonb_typeof(waiting) = 'object'
      and (wait_until is not null or waiting ->> 'kind' = 'event'))
);

-- THE DAY NAMES ARE A CLOSED SET, and it is the `weekday` step's own. A day nothing
-- recognises is a schedule that never comes due, which from outside is an automation that
-- does not work.
alter table agent.automations drop constraint if exists automations_days_known;
alter table agent.automations add constraint automations_days_known check (
  days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]
);

-- AN EVENT NAME IS AN IDENTIFIER, not prose: it is compared for equality by the
-- dispatcher, so whitespace and case would make two names that read the same behave
-- differently.
alter table agent.automations drop constraint if exists automations_on_event_shaped;
alter table agent.automations add constraint automations_on_event_shaped check (
  on_event is null or on_event ~ '^[a-z][a-z0-9_.-]{0,63}$'
);

create index if not exists automations_by_event
  on agent.automations (tenant_id, agent_id, on_event) where on_event is not null;

/**
 * The next instant a schedule falls, or NULL when nothing more is due.
 *
 * ⚠ **IT IS ONE FUNCTION FOR ALL FOUR SCHEDULES AND IT USES `automation_next_at` RATHER
 * THAN REPEATING IT.** That function is this product's only time-zone arithmetic and both
 * daylight-saving transitions are measured against it; a second copy for `weekly` would be
 * a second answer to the one question that has to be right twice a year.
 *
 * **`weekly` WALKS FORWARD A DAY AT A TIME, UP TO SEVEN.** Eight would be a day that is
 * already in the list, so seven is the whole space — and walking is what keeps the zone
 * arithmetic inside `automation_next_at` instead of being redone with date maths here.
 *
 * **`once` ANSWERS NULL ONCE ITS INSTANT HAS PASSED**, which is what makes "it has fired"
 * a fact about the row rather than a flag beside it.
 */
create or replace function agent.automation_next_run(
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_days     text[],
  p_on_date  date,
  p_from     timestamptz
) returns timestamptz
  language plpgsql stable set search_path = '' as $$
declare
  v_cand timestamptz;
  v_day  text;
  v_i    integer;
begin
  if p_schedule = 'manual' then return null; end if;

  if p_schedule = 'once' then
    if p_on_date is null then
      raise exception 'automation_next_run: a one-time schedule needs a date';
    end if;
    -- THE ZONE IS VALIDATED BY THE SAME CAST `automation_next_at` USES, so a zone Postgres
    -- cannot take raises here too rather than being silently read as UTC.
    v_cand := (p_on_date + p_at_local) at time zone p_zone;
    if v_cand > p_from then return v_cand; end if;
    return null;
  end if;

  if p_schedule = 'daily' then
    return agent.automation_next_at(p_at_local, p_zone, p_from);
  end if;

  if p_schedule = 'weekly' then
    if p_days is null or array_length(p_days, 1) is null then
      raise exception 'automation_next_run: a weekly schedule needs at least one day';
    end if;
    v_cand := agent.automation_next_at(p_at_local, p_zone, p_from);
    for v_i in 1..7 loop
      -- THE DAY IS READ IN THE AUTOMATION'S OWN ZONE, never in UTC: "every Monday at 00:30
      -- in Sydney" is a Sunday in UTC, and asking UTC would run it on the wrong day.
      v_day := lower(to_char(v_cand at time zone p_zone, 'dy'));
      if v_day = any (p_days) then return v_cand; end if;
      v_cand := agent.automation_next_at(p_at_local, p_zone, v_cand);
    end loop;
    -- UNREACHABLE WHILE THE CONSTRAINT HOLDS (a non-empty subset of seven days must match
    -- within seven), and it is a raise rather than a null because a null here would read as
    -- "nothing more is due" about a weekly schedule, which is never true.
    raise exception 'automation_next_run: no day in % matched within a week', p_days;
  end if;

  raise exception 'automation_next_run: unknown schedule %', p_schedule;
end; $$;

comment on function agent.automation_next_run(text, time, text, text[], date, timestamptz) is
  'The next instant any schedule falls, strictly after a given instant, or NULL when nothing more is due. One function for all four, over the single time-zone arithmetic in automation_next_at.';

-- ── 2. A DURABLE EVENT ─────────────────────────────────────────────────────
--
-- ⚠ **AN EVENT IS A ROW BEFORE IT IS ANYTHING ELSE**, exactly as a run's work is. The
-- doorbell that tells the dispatcher is allowed to fail; the row is what makes the event
-- happen eventually.

create table if not exists agent.events (
  id          uuid primary key,
  tenant_id   text        not null,
  agent_id    uuid        not null references agent.agents(id) on delete cascade,
  name        text        not null,
  payload     jsonb       not null default '{}',
  -- WHERE IT CAME FROM, as a closed set: a webhook, a customer's own screen, or a run.
  -- Never free text — it decides what the recursion bound is applied to.
  source      text        not null,
  -- ⚠ **THE DEDUP KEY IS THE CALLER'S, AND IT IS OPTIONAL.** A webhook delivery carries an
  -- id; a person pressing a button has none, and two presses are two events. The partial
  -- index is what makes the difference rather than a rule anybody has to remember.
  event_key   text,
  -- HOW MANY EVENTS DEEP THIS ONE IS. An event emitted from inside a run that an event
  -- started is one deeper, and past the bound it is refused BY NAME.
  depth       integer     not null default 0,
  -- WHETHER THE DISPATCHER HAS FILED WHAT IT TRIGGERS. Not a boolean: the instant is what
  -- lets an operator see a backlog, and NULL is the queue.
  handled_at  timestamptz,
  at          timestamptz not null default now(),
  constraint events_source_known check (source in ('webhook', 'person', 'run')),
  constraint events_name_shaped check (name ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint events_depth_bounded check (depth between 0 and 8),
  constraint events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint events_key_shaped check (event_key is null or length(event_key) between 1 and 200)
);

-- ⚠ **DEDUP IS PER ACCOUNT AND PER NAME.** Two different webhooks of one account can both
-- be delivered `evt_1` by two providers that know nothing about each other, and collapsing
-- those into one event would drop somebody's work. Scoped by name, they cannot collide.
create unique index if not exists events_one_per_key
  on agent.events (tenant_id, name, event_key) where event_key is not null;

create index if not exists events_unhandled
  on agent.events (at asc) where handled_at is null;
create index if not exists events_by_agent
  on agent.events (tenant_id, agent_id, name, at desc);

alter table agent.events enable row level security;
alter table agent.events force row level security;
drop policy if exists events_read_own on agent.events;
create policy events_read_own on agent.events
  for select to authenticated using (tenant_id = agent.tenant_id());
revoke all on agent.events from anon, authenticated;
grant select on agent.events to authenticated;

-- ── an execution knows which event started it, and how deep that event was ──
alter table agent.automation_runs
  add column if not exists event_id uuid references agent.events(id) on delete set null,
  add column if not exists event_depth integer not null default 0,
  -- ⚠ WHAT AN EVENT WAIT HEARD, keyed by the step's own id — the same shape `decisions`
  -- has, and for the same reason: a resume must be matched to the step that asked.
  add column if not exists heard jsonb not null default '{}';

alter table agent.automation_runs drop constraint if exists automation_runs_heard_shaped;
alter table agent.automation_runs add constraint automation_runs_heard_shaped
  check (jsonb_typeof(heard) = 'object');

-- ⚠ **ONE EXECUTION PER (AUTOMATION, EVENT), which is what makes a redelivered webhook
-- harmless.** The occurrence index does the same job for a schedule and cannot serve here:
-- an occurrence is a DATE and two events of one day are two events.
create unique index if not exists automation_runs_one_per_event
  on agent.automation_runs (automation_id, event_id) where event_id is not null;

-- ── 3. AN INBOUND ENDPOINT ─────────────────────────────────────────────────
--
-- ⚠ **THE OWNING ACCOUNT IS THE ROW'S, NEVER THE PAYLOAD'S.** That is the whole security
-- argument for this table: a delivery names an endpoint id and presents a signature, and
-- everything else about who it belongs to is read from here. A `tenant` field in a body is
-- not consulted anywhere, and there is nowhere for one to be.
--
-- **THE SECRET IS STORED RECOVERABLE, AND THAT IS STATED RATHER THAN GLOSSED.** An HMAC
-- cannot be verified from a hash, so a shared-secret endpoint has to keep the secret. What
-- follows from that is enforced instead: no reader ever answers it after creation, no tool
-- can reach this table at all, and `authenticated` is granted nothing on it.

create table if not exists agent.webhooks (
  id         uuid primary key,
  tenant_id  text        not null,
  agent_id   uuid        not null references agent.agents(id) on delete cascade,
  name       text        not null,
  -- THE EVENT IT EMITS. Fixed at creation, so a delivery cannot choose what it triggers —
  -- which is the difference between an endpoint and a way to run any automation.
  event_name text        not null,
  secret     text        not null,
  enabled    boolean     not null default true,
  last_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint webhooks_name_len check (length(btrim(name)) between 1 and 80),
  constraint webhooks_event_shaped check (event_name ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint webhooks_secret_len check (length(secret) between 32 and 200)
);

create index if not exists webhooks_by_agent on agent.webhooks (tenant_id, agent_id);

alter table agent.webhooks enable row level security;
alter table agent.webhooks force row level security;
-- ⚠ **NO POLICY AND NO GRANT FOR `authenticated`.** A customer reads their endpoints
-- through a function that answers everything BUT the secret; giving them the table would
-- be giving them the secret, and a policy is not what stops that — the absent grant is.
revoke all on agent.webhooks from anon, authenticated;

/**
 * One endpoint's verified identity, by id.
 *
 * ⚠ **IT ANSWERS THE SECRET, AND IT IS `service_role`-ONLY BECAUSE OF THAT.** The Worker
 * needs it to check a signature and nothing else does; every customer-facing reader below
 * answers the same row WITHOUT it.
 *
 * A disabled endpoint answers nothing, so turning one off really stops it rather than
 * leaving the check to a caller.
 */
create or replace function agent.webhook_for_delivery(p_id uuid)
returns jsonb
  language sql security definer set search_path = '' as $$
  select case when w.id is null then null else jsonb_build_object(
           'id', w.id, 'tenant_id', w.tenant_id, 'agent_id', w.agent_id,
           'event_name', w.event_name, 'secret', w.secret) end
    from (select * from agent.webhooks where id = p_id and enabled) w;
$$;

comment on function agent.webhook_for_delivery(uuid) is
  'One enabled endpoint and its secret, for verifying a delivery. service_role only: it is the only reader that answers a secret, and the account a delivery belongs to is this row''s rather than its payload''s.';

/**
 * A customer's own endpoints — everything but the secret.
 *
 * **THE SECRET IS ANSWERED ONCE, BY THE CREATE, AND NEVER AGAIN.** So this is not a
 * redaction to be remembered: the column is simply not in the projection, and a reader
 * that started answering it would be a change to this function rather than a forgotten
 * filter somewhere else.
 */
create or replace function agent.list_webhooks(p_tenant text, p_agent_id uuid)
returns jsonb
  language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'name', w.name, 'event_name', w.event_name,
           'enabled', w.enabled, 'last_at', w.last_at, 'created_at', w.created_at
         ) order by w.created_at desc), '[]'::jsonb)
    from agent.webhooks w
   where w.tenant_id = p_tenant and w.agent_id = p_agent_id;
$$;

/**
 * Make an endpoint. The secret is the CALLER'S, because only the caller can hand it to
 * whoever will sign with it — and it is answered here and nowhere else, ever.
 */
create or replace function agent.create_webhook(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_name     text,
  p_event    text,
  p_secret   text,
  p_max      integer default 10
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agent agent.agents;
  v_held  integer;
begin
  select * into v_agent from agent.agents where id = p_agent_id and tenant_id = p_tenant;
  if v_agent.id is null then return jsonb_build_object('ok', false, 'error', 'no-agent'); end if;
  select count(*) into v_held from agent.webhooks
   where tenant_id = p_tenant and agent_id = p_agent_id;
  if v_held >= greatest(1, coalesce(p_max, 10)) then
    return jsonb_build_object('ok', false, 'error', 'too-many', 'held', v_held);
  end if;
  insert into agent.webhooks (id, tenant_id, agent_id, name, event_name, secret)
  values (p_id, p_tenant, p_agent_id, btrim(p_name), p_event, p_secret);
  return jsonb_build_object('ok', true, 'id', p_id, 'event_name', p_event);
end; $$;

create or replace function agent.set_webhook_enabled(
  p_tenant text, p_id uuid, p_enabled boolean
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row agent.webhooks;
begin
  if p_enabled is null then
    raise exception 'set_webhook_enabled: say whether it is on or off';
  end if;
  update agent.webhooks set enabled = p_enabled
   where id = p_id and tenant_id = p_tenant
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'no-webhook'); end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'enabled', v_row.enabled);
end; $$;

create or replace function agent.delete_webhook(p_tenant text, p_id uuid)
returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  delete from agent.webhooks where id = p_id and tenant_id = p_tenant returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'no-webhook'); end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;

-- ── 4. EMITTING ONE ────────────────────────────────────────────────────────
--
-- ⚠ **THE RECURSION BOUND IS HERE AND IT IS NOT ADVISORY.** An event emitted from inside a
-- run carries that run's own depth plus one, and past the ceiling it is REFUSED BY NAME
-- with nothing written. A chain that stops silently is a chain nobody can debug; a chain
-- that does not stop is a platform a single workflow can occupy.

create or replace function agent.emit_event(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_name     text,
  p_payload  jsonb   default '{}',
  p_source   text    default 'person',
  p_key      text    default null,
  p_from_run uuid    default null,
  p_max_depth integer default 4
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agent agent.agents;
  v_depth integer := 0;
  v_row   agent.events;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'emit_event: tenant must be a non-empty string';
  end if;
  -- WHOSE AGENT IS THIS, answered as a VALUE: another account's agent and one that is not
  -- there are the same answer, because the difference between them is information.
  select * into v_agent from agent.agents where id = p_agent_id and tenant_id = p_tenant;
  if v_agent.id is null then return jsonb_build_object('ok', false, 'error', 'no-agent'); end if;

  -- ⚠ **HOW DEEP, TAKEN FROM THE RUN AND NEVER FROM THE CALLER.** A caller-supplied depth
  -- is a bound a caller can reset, which is no bound at all.
  if p_from_run is not null then
    select coalesce(ar.event_depth, 0) + 1 into v_depth
      from agent.automation_runs ar
     where ar.id = p_from_run and ar.tenant_id = p_tenant;
    if v_depth is null then
      return jsonb_build_object('ok', false, 'error', 'no-execution');
    end if;
    if v_depth > greatest(1, coalesce(p_max_depth, 4)) then
      -- NAMED, WITH BOTH NUMBERS, and nothing written. An operator needs to know which
      -- chain ran away, and a customer needs to know their event did not happen.
      return jsonb_build_object('ok', false, 'error', 'too-deep',
        'depth', v_depth, 'max', greatest(1, coalesce(p_max_depth, 4)));
    end if;
  end if;

  insert into agent.events (id, tenant_id, agent_id, name, payload, source, event_key, depth)
  values (p_id, p_tenant, p_agent_id, p_name,
          coalesce(p_payload, '{}'::jsonb), p_source, p_key, v_depth)
  -- ⚠ A BARE TARGET, so BOTH identities are absorbed: the dedup key and the id. This table
  -- has exactly two unique things and both of them mean "already emitted".
  on conflict do nothing
  returning * into v_row;

  if v_row.id is null then
    -- ABSORBED. The row that is really there is the answer, so a redelivery is told the
    -- truth about the event that exists rather than about the one it re-sent.
    if p_key is not null then
      select * into v_row from agent.events
       where tenant_id = p_tenant and name = p_name and event_key = p_key;
    end if;
    if v_row.id is null then
      select * into v_row from agent.events where id = p_id and tenant_id = p_tenant;
    end if;
    if v_row.id is null then
      raise exception 'emit_event: the event conflicted with a row that is not there';
    end if;
    return jsonb_build_object('ok', true, 'repeat', true, 'event_id', v_row.id,
                              'name', v_row.name, 'depth', v_row.depth);
  end if;

  return jsonb_build_object('ok', true, 'repeat', false, 'event_id', v_row.id,
                            'name', v_row.name, 'depth', v_row.depth);
end; $$;

comment on function agent.emit_event(text, uuid, uuid, text, jsonb, text, text, uuid, integer) is
  'Record one event, once. The dedup key and the id are both absorbed, the depth comes from the emitting run rather than from the caller, and a chain past the ceiling is refused by name with nothing written.';

-- ── 5. WHAT AN EVENT TRIGGERS, AND WHAT IT WAKES ───────────────────────────
--
-- ⚠ **TWO JOBS IN ONE FUNCTION, DELIBERATELY, because they are one decision about one
-- event.** Filing what it triggers and waking what was waiting for it both have to happen
-- exactly once per event, and the flag that says so is `handled_at` — so doing them in two
-- transactions would leave a window in which one had happened and the other had not.

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

    update agent.events set handled_at = now() where id = e.id;
    if e.source = 'webhook' then
      update agent.webhooks set last_at = now()
       where tenant_id = e.tenant_id and agent_id = e.agent_id and event_name = e.name;
    end if;

    return next jsonb_build_object(
      'event_id', e.id, 'name', e.name, 'filed', v_filed, 'woke', v_woke, 'ring', v_rung);
  end loop;
end; $$;

comment on function agent.dispatch_events(integer) is
  'File an execution for every automation an event triggers, wake every suspended execution waiting for it, and stamp it handled — all in one transaction per event, because the stamp is what makes both happen exactly once.';

-- ── 6. THE PAUSE'S OWN SIDE OF THE RACE ────────────────────────────────────
--
-- ⚠ **AN EVENT THAT ARRIVED BEFORE THE PAUSE WAS RECORDED MUST NOT BE LOST.** The
-- dispatcher looks for suspended executions; an execution that was not suspended yet is
-- invisible to it. So the pause's own transaction asks the other way round, and the ROW
-- LOCK is what makes the pair exhaustive: whichever of the two takes this execution's row
-- first, the second reads what it committed.
--
-- **AND NEVER TWICE**: the same `heard ? step` test, and one event id per step.

create or replace function agent.hear_pending_event(
  p_run_id uuid,
  p_tenant text
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_exec agent.automation_runs;
  v_ev   agent.events;
  v_put  jsonb;
begin
  select * into v_exec from agent.automation_runs
   where id = p_run_id and tenant_id = p_tenant
     for update;
  if v_exec.id is null then return jsonb_build_object('ok', false, 'error', 'no-execution'); end if;
  if v_exec.finished_at is not null then return jsonb_build_object('ok', true, 'heard', false, 'why', 'finished'); end if;
  if v_exec.waiting ->> 'kind' is distinct from 'event' then
    return jsonb_build_object('ok', true, 'heard', false, 'why', 'not-waiting-for-an-event');
  end if;
  if v_exec.heard ? (v_exec.waiting ->> 'step') then
    return jsonb_build_object('ok', true, 'heard', false, 'why', 'already');
  end if;

  -- ⚠ **AT OR AFTER THE INSTANT THIS EXECUTION REACHED THE STEP**, which the pause wrote.
  -- Without that bound an event from last week would satisfy a wait somebody set up today —
  -- a workflow resuming on news it was never waiting for.
  select * into v_ev from agent.events
   where tenant_id = p_tenant
     and agent_id = v_exec.agent_id
     and name = v_exec.waiting ->> 'name'
     and at >= coalesce((v_exec.waiting ->> 'since')::timestamptz, v_exec.created_at)
   order by at asc
   limit 1;
  if v_ev.id is null then return jsonb_build_object('ok', true, 'heard', false, 'why', 'nothing-yet'); end if;

  update agent.automation_runs
     set heard = heard || jsonb_build_object(
           v_exec.waiting ->> 'step',
           jsonb_build_object('event_id', v_ev.id, 'name', v_ev.name,
                              'payload', v_ev.payload, 'at', v_ev.at))
   where id = p_run_id;

  -- ⚠ **AND THE WORK GOES BACK, IN THIS SAME TRANSACTION — the first draft wrote `heard`
  -- and stopped.** A pause releases its worker and marks the work row done, so NOTHING would
  -- have delivered what this heard: the run would sit with the event recorded against it and
  -- no reason for anyone to look, which is the stranding milestone 9 exists to stop. The
  -- dispatcher's own waking half calls `requeue_run` for exactly this reason; the race's half
  -- had been left without it. *Anything that answers a wait INSTEAD of the thing it was
  -- waiting for has to put the work back too* — recorded twice already in this schema, for an
  -- expired approval and for a withdrawn permission, and this is the third.
  --
  -- ONE TRANSACTION OR NEITHER: a crash between the `heard` write and the re-queue would
  -- leave the event applied and undeliverable, which is the same stranding by a narrower door.
  v_put := agent.requeue_run(p_run_id, p_tenant);

  return jsonb_build_object('ok', true, 'heard', true, 'event_id', v_ev.id,
                            'name', v_ev.name, 'queued', coalesce(v_put ->> 'action', 'unknown'));
end; $$;

comment on function agent.hear_pending_event(uuid, text) is
  'Does an event this execution is waiting for already exist? The other half of the arrival race: the dispatcher finds suspended executions, and this finds events that arrived before the pause was recorded. Both take this row''s lock, so neither can lose one and neither can apply one twice.';

-- ── 7. ACCEPTING AN EVENT-TRIGGERED EXECUTION ─────────────────────────────
--
-- ⚠ **TWO NEW ARGUMENTS, BOTH LAST, and this file records why elsewhere**: a defaulted
-- parameter placed before an existing one silently re-binds every positional caller. The
-- 6-argument overload is DROPPED rather than left beside this one, because a caller that
-- forgot the event would file an execution with no event id and the once-per-event index
-- would stop holding.

create or replace function agent.accept_automation_run(
  p_tenant        text,
  p_automation_id uuid,
  p_run_id        uuid,
  p_trigger       text,
  p_occurrence    date default null,
  p_input         jsonb default '{}'::jsonb,
  -- ⚠ **BOTH NEW ARGUMENTS GO LAST, and this schema records why twice already**: a
  -- defaulted parameter placed before an existing one silently re-binds every positional
  -- caller. And the 6-argument overload is DROPPED below rather than left beside this one,
  -- because a caller that forgot the event would file an execution with no event id — and
  -- `automation_runs_one_per_event` is a PARTIAL index, so it would stop holding.
  p_event_id      uuid    default null,
  -- HOW DEEP THE CHAIN IS, carried from the event rather than decided here: the bound lives
  -- in `emit_event`, which is the only thing that can see where an event came from.
  p_event_depth   integer default 0
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
  v_decl    jsonb;
  v_agent   uuid;
  v_status  text;
  v_exec    agent.automation_runs;
  v_new     boolean := false;
  v_entry   jsonb;
  v_accept  jsonb;
  v_given   jsonb := coalesce(p_input, '{}'::jsonb);
  v_vars    jsonb := '{}'::jsonb;
  v_mem     jsonb := '{}'::jsonb;
  v_d       jsonb;
  v_key     text;
  v_val     text;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'accept_automation_run: tenant must be a non-empty string';
  end if;
  if p_run_id is null then
    raise exception 'accept_automation_run: the execution needs a run id';
  end if;
  if p_trigger is null or p_trigger not in ('manual', 'schedule', 'event') then
    raise exception 'accept_automation_run: a run is triggered manually, by a schedule or by an event';
  end if;
  if jsonb_typeof(v_given) <> 'object' then
    raise exception 'accept_automation_run: the input must be an object of name to value';
  end if;

  -- ── whose automation is this, and is its agent taking work ────────────────
  -- ONE READ FOR BOTH FACTS. Asking the agent's status separately would be a second
  -- statement a pause could land between, and the answer that matters — "may this
  -- start" — is about the two of them together.
  select a.id, a.name, a.enabled, a.steps, a.zone, a.inputs, a.agent_id, g.status
    into v_id, v_name, v_enabled, v_steps, v_zone, v_decl, v_agent, v_status
    from agent.automations a
    join agent.agents g on g.id = a.agent_id
   where a.id = p_automation_id and a.tenant_id = p_tenant;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  -- ── has this execution already been filed ────────────────────────────────
  -- Asked TWO WAYS, because an execution has two identities and which one applies
  -- depends on who asked for it.
  if p_occurrence is not null then
    select * into v_exec from agent.automation_runs
     where automation_id = p_automation_id and occurrence = p_occurrence;
  end if;
  -- ⚠ **AND BY THE RUN ID, WHICH IS THE IDENTITY A MANUAL EXECUTION HAS (2026-09-17).**
  -- A manual run has no occurrence, so the partial index above does not cover it — and
  -- `run_automation`, the agent's own tool, DERIVES its run id from the call it belongs to
  -- precisely so that a redelivery asks for the execution it already made. MEASURED before
  -- this existed: the second ask raised `duplicate key value violates unique constraint
  -- "automation_runs_pkey"`. Nothing extra was written, so the guarantee held — there was
  -- never a second execution — but the ANSWER was an exception, so a redelivered tool call
  -- came back a failure about work that really is queued and will run. The tool's own note
  -- claimed this function answered `repeat`; it did not.
  --
  -- **A RUN ID BELONGING TO ANOTHER AUTOMATION IS DELIBERATELY NOT FOUND HERE.** The probe
  -- is scoped to this automation, so such a call still meets the primary key and raises —
  -- which is right: that is a caller pointing one execution's record at another, and
  -- answering `repeat` would hand it somebody else's execution.
  -- ⚠ **AND BY ITS EVENT, which is the identity a WEBHOOK redelivery carries.** An
  -- occurrence is a DATE and two events of one day are two events, so the occurrence index
  -- cannot serve here — `automation_runs_one_per_event` is its own partial index, and this is
  -- the probe that turns meeting it into an answer rather than an exception.
  if v_exec.id is null and p_event_id is not null then
    select * into v_exec from agent.automation_runs
     where automation_id = p_automation_id and event_id = p_event_id;
  end if;
  -- ⚠ **THIS PROBE AND THE RE-READ INSIDE THE EXCEPTION HANDLER BELOW ARE A DECLARED PAIR, AND
  -- EACH IS INERT ON ITS OWN — measured, not reasoned.** Both turn a duplicate run id into
  -- `repeat`: this one before the insert is attempted, that one after the unique violation. Three
  -- variants were applied to throwaway databases and asked the same manual run id twice — as it
  -- stands, with this probe cut, and with the handler's re-read cut — and **all three answered
  -- byte-identically (`ok, repeat: true`, the same run id) and left exactly one row**. So a sweep
  -- cannot kill either one alone, and two mutants aimed at them SURVIVED a 976-check suite for
  -- exactly that reason rather than because anything is unguarded.
  --
  -- **THEY ARE NOT INTERCHANGEABLE, WHICH IS WHY BOTH STAY.** The handler is the only thing that
  -- can see a row another transaction committed BETWEEN this probe and our insert — a probe
  -- cannot read an uncommitted row, so the race has no other answer. This probe is what keeps an
  -- ordinary redelivery off the exception path altogether, which is where the `conflicted with a
  -- row that is not there` raise lives. *Deleting either because "nothing appears to need it"
  -- is the reading this paragraph exists to prevent.*
  if v_exec.id is null then
    select * into v_exec from agent.automation_runs
     where automation_id = p_automation_id and id = p_run_id;
  end if;

  if v_exec.id is null then
    -- ⚠ NOTHING IS WRITTEN ON ANY REFUSAL — not the execution, not a run, not a work
    -- row. A disabled automation and a paused agent are the two ways an account says
    -- "not now", and both have to leave the world exactly as it was, or turning
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

    -- ── the input, against what this automation says it asks for ───────────
    v_decl := coalesce(v_decl, '[]'::jsonb);

    -- A VALUE FOR A NAME NOTHING ASKS FOR IS NAMED, NEVER IGNORED. A filter on somebody's
    -- input is a silent drop; a check is a sentence — and the sentence is the only thing
    -- that tells them the field they filled in went nowhere.
    for v_key in select k from jsonb_object_keys(v_given) k loop
      if not exists (select 1 from jsonb_array_elements(v_decl) d where d ->> 'name' = v_key) then
        return jsonb_build_object('ok', false, 'error', 'unknown-input', 'name', v_key);
      end if;
      -- REFUSED RATHER THAN COERCED. `p_input ->> 'n'` turns the number 5 into "5" and a
      -- list into its JSON text, so a coercing reader would accept a shape the form cannot
      -- produce and store something nobody typed.
      if jsonb_typeof(v_given -> v_key) <> 'string' then
        return jsonb_build_object('ok', false, 'error', 'bad-input', 'name', v_key);
      end if;
    end loop;

    -- EVERY DECLARED NAME GETS A VALUE, so `{{name}}` can never be a reference to
    -- something absent and "is empty" is a question a workflow can ask. A declaration's
    -- own default fills a name nobody answered; the empty string fills one with no
    -- default, which is a real answer rather than a missing key.
    for v_d in select value from jsonb_array_elements(v_decl) loop
      if jsonb_typeof(v_d) <> 'object' or v_d ->> 'name' is null then
        return jsonb_build_object('ok', false, 'error', 'bad-inputs');
      end if;
      v_key := v_d ->> 'name';
      v_val := coalesce(
        case when v_given ? v_key then v_given ->> v_key else null end,
        v_d ->> 'default',
        '');
      if coalesce((v_d ->> 'required')::boolean, false) and btrim(v_val) = '' then
        return jsonb_build_object('ok', false, 'error', 'missing-input', 'name', v_key);
      end if;
      v_vars := v_vars || jsonb_build_object(v_key, v_val);
    end loop;

    -- ⚠ THE MEMORIES, WITH THEIR VERSIONS, READ IN THIS TRANSACTION. That is what makes a
    -- correction reach the NEXT execution and never this one, and it is what makes "which
    -- versions did this run use" a stored fact rather than a join against rows that have
    -- since been corrected.
    v_mem := agent.agent_memory_snapshot(p_tenant, v_agent);

    insert into agent.automation_runs
      (id, automation_id, agent_id, tenant_id, trigger, occurrence, steps, zone, input, vars, memory,
       event_id, event_depth)
    values
      (p_run_id, p_automation_id, v_agent, p_tenant, p_trigger, p_occurrence, v_steps, v_zone,
       v_given, v_vars, v_mem,
       -- WHICH EVENT STARTED IT AND HOW DEEP THAT EVENT WAS. Recorded on the execution so an
       -- event this run emits can be one deeper WITHOUT the caller saying how deep it is.
       p_event_id, greatest(0, coalesce(p_event_depth, 0)))
    -- ⚠ **NO TARGET, SO IT ABSORBS EITHER IDENTITY.** This table has exactly two unique
    -- things — the primary key on `id` and the partial index on `(automation_id,
    -- occurrence)` — and both of them mean the same fact: this execution is already
    -- filed. Naming only the occurrence left a duplicate RUN ID raising instead, which is
    -- the defect the probe above records. A bare clause absorbs no check constraint and no
    -- foreign key, so nothing that means something else is swallowed with them.
    on conflict do nothing
    returning * into v_exec;
    v_new := v_exec.id is not null;

    if not v_new then
      -- A SECOND TICK RACING THIS ONE, in another transaction. Read what it filed — by
      -- whichever of the two identities conflicted, in the same order the probe asks.
      if p_occurrence is not null then
        select * into v_exec from agent.automation_runs
         where automation_id = p_automation_id and occurrence = p_occurrence;
      end if;
      if v_exec.id is null and p_event_id is not null then
        select * into v_exec from agent.automation_runs
         where automation_id = p_automation_id and event_id = p_event_id;
      end if;
      if v_exec.id is null then
        select * into v_exec from agent.automation_runs
         where automation_id = p_automation_id and id = p_run_id;
      end if;
      if v_exec.id is null then
        raise exception 'accept_automation_run: the execution conflicted with a row that is not there';
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
  -- could claim this row and route it to the agent loop.
  update agent.run_work set executor = 'automation' where run_id = p_run_id;

  return jsonb_build_object(
    'ok', true, 'repeat', false,
    'run_id', p_run_id, 'occurrence', v_exec.occurrence, 'trigger', v_exec.trigger,
    'state', v_accept -> 'state');
end; $$;
drop function if exists agent.accept_automation_run(text, uuid, uuid, text, date, jsonb);

-- ── 8. THE TICK, FOR EVERY SCHEDULE ───────────────────────────────────────
--
-- ⚠ **ONE SELECT FOR ALL THREE TIMED SCHEDULES.** It was `schedule = 'daily'`, and the
-- narrowest possible change would have been three ORs — but the arithmetic it calls is now
-- one function for all of them, so what this really needed was to stop naming a schedule at
-- all. A row is due when it has a `next_run_at` in the past, whatever put one there.
--
-- **AND `once` LEAVES NO NEXT INSTANT**, which is how it fires once: `automation_next_run`
-- answers NULL, the advance writes NULL, and nothing is ever due again.

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
       and a.schedule <> 'manual'
       and a.next_run_at is not null
       and a.next_run_at <= now()
     order by a.next_run_at asc
     limit greatest(1, coalesce(p_limit, 25))
     for update skip locked
  loop
    begin
      v_occ  := (r.next_run_at at time zone r.zone)::date;
      v_next := agent.automation_next_run(r.schedule, r.at_local, r.zone, r.days, r.on_date, now());
      v_run  := gen_random_uuid();

      if now() - r.next_run_at
           <= make_interval(secs => greatest(0, coalesce(p_catchup_s, 3600))) then
        v_answer := agent.accept_automation_run(r.tenant_id, r.id, v_run, 'schedule', v_occ);
        if coalesce((v_answer -> 'ok')::boolean, false) then
          v_out := jsonb_build_object(
            'automation_id', r.id, 'occurrence', v_occ,
            'run_id', v_answer ->> 'run_id',
            'action', case when coalesce((v_answer -> 'repeat')::boolean, false)
                           then 'already' else 'filed' end);
        else
          perform agent.record_automation_occurrence(
            r.tenant_id, r.id, v_run, v_occ,
            jsonb_build_object('reason', v_answer ->> 'error'), null);
          v_out := jsonb_build_object(
            'automation_id', r.id, 'occurrence', v_occ,
            'action', v_answer ->> 'error');
        end if;
      else
        -- ⚠ **HOW MANY WENT BY, AND IT CANNOT BE COUNTED IN LOCAL DAYS ANY MORE.** That was
        -- right for `daily`, where every local day is an occurrence; for `weekly` it counts
        -- days rather than occurrences and for `once` there is only ever one. So it is 1
        -- unless the schedule really is daily, where the old arithmetic still holds.
        v_total := case
          when r.schedule = 'daily' and v_next is not null
            then greatest(1, (v_next at time zone r.zone)::date - v_occ)
          else 1 end;
        perform agent.record_automation_occurrence(
          r.tenant_id, r.id, v_run, v_occ,
          jsonb_build_object('reason', 'missed', 'occurrences', v_total), v_total);
        v_out := jsonb_build_object(
          'automation_id', r.id, 'occurrence', v_occ, 'action', 'missed', 'occurrences', v_total);
      end if;

      update agent.automations set next_run_at = v_next where id = r.id;
      return next v_out;
    exception when others then
      return next jsonb_build_object('automation_id', r.id, 'action', 'error', 'why', sqlerrm);
    end;
  end loop;
end; $$;

comment on function agent.tick_automations(integer, integer) is
  'File what is due, for every timed schedule. A row is due when it has a next instant in the past, whatever schedule put one there; the advance is one function for all of them, and a one-time schedule leaves no next instant.';

-- ── 9. THE GRANTS ─────────────────────────────────────────────────────────

revoke all on function agent.automation_next_run(text, time, text, text[], date, timestamptz) from public;
revoke all on function agent.webhook_for_delivery(uuid) from public;
revoke all on function agent.list_webhooks(text, uuid) from public;
revoke all on function agent.create_webhook(text, uuid, uuid, text, text, text, integer) from public;
revoke all on function agent.set_webhook_enabled(text, uuid, boolean) from public;
revoke all on function agent.delete_webhook(text, uuid) from public;
revoke all on function agent.emit_event(text, uuid, uuid, text, jsonb, text, text, uuid, integer) from public;
revoke all on function agent.dispatch_events(integer) from public;
revoke all on function agent.hear_pending_event(uuid, text) from public;
revoke all on function agent.accept_automation_run(text, uuid, uuid, text, date, jsonb, uuid, integer) from public;

grant execute on function agent.automation_next_run(text, time, text, text[], date, timestamptz) to service_role;
grant execute on function agent.webhook_for_delivery(uuid) to service_role;
grant execute on function agent.list_webhooks(text, uuid) to service_role;
grant execute on function agent.create_webhook(text, uuid, uuid, text, text, text, integer) to service_role;
grant execute on function agent.set_webhook_enabled(text, uuid, boolean) to service_role;
grant execute on function agent.delete_webhook(text, uuid) to service_role;
grant execute on function agent.emit_event(text, uuid, uuid, text, jsonb, text, text, uuid, integer) to service_role;
grant execute on function agent.dispatch_events(integer) to service_role;
grant execute on function agent.hear_pending_event(uuid, text) to service_role;
grant execute on function agent.accept_automation_run(text, uuid, uuid, text, date, jsonb, uuid, integer) to service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. SAVING A TRIGGER — the two writers, widened
--
-- ⚠ **REDEFINED HERE RATHER THAN EDITED WHERE THEY WERE, and the reason is that this is
-- where the three columns are added.** A reader asking "how does a weekly schedule get
-- saved" finds the columns and their writers in one place, and `lastDefining` in the sweep
-- spec asks the files which definition is in force, so nothing goes stale by position.
--
-- **THE THREE NEW PARAMETERS GO LAST AND DEFAULT, which is this schema's own recorded rule
-- paid for with a run**: `p_inputs` was once written above `p_max` and a positional
-- ten-argument call bound the CEILING to it, failing thirty checks about nothing to do with
-- inputs. Defaulting them is also what keeps the `_once` wrappers in
-- `20260918020000_agent_operation_records.sql` calling these unchanged — an agent authoring a
-- workflow cannot ask for a weekly schedule (its tool has no day list), which is enforced in
-- `capability-tools.mjs` rather than left to a constraint violation several layers down.
--
-- **AND THE ARITHMETIC IS `automation_next_run`'S, not `automation_next_at`'S.** That one
-- answers the next occurrence of a DAILY time; a weekly schedule has to walk forward to the
-- next chosen day and a one-off has exactly one instant and then none. Calling the old one
-- for a weekly schedule would file it every single day, which is the defect this whole
-- section exists to make impossible rather than merely unlikely.

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
  p_max        integer default 20,
  p_inputs     jsonb default '[]'::jsonb,
  -- ⚠ **AN OMITTED DAY LIST AND AN EXPLICIT `null` ARE ONE ANSWER — "no days" — and the
  -- INSERT coalesces rather than the default doing it.** `automations.days` is `not null
  -- default '{}'` and `automations_schedule_is_whole` compares it with `'{}'` for every
  -- schedule that is not weekly, so empty is what "not applicable" means here; passing the
  -- null straight through violated the column and MEASURED 49 failing checks, whose first
  -- readable symptom was `no-automation` about a row whose CREATE had been refused two checks
  -- earlier. One rule, at the write, so a caller that omits it and one that says `null`
  -- cannot differ — which is exactly what the `_once` wrappers do.
  p_days       text[] default null,
  p_on_date    date default null,
  p_on_event   text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agent agent.agents;
  v_next  timestamptz := null;
  v_row   agent.automations;
  v_held  integer;
  v_calls jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'create_automation: tenant must be a non-empty string';
  end if;

  -- WHOSE AGENT IS THIS. Answered as a VALUE rather than raised: another account's agent and
  -- an agent that is not there are the same answer, because the difference is information.
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

  -- ⚠ WHAT IT SAYS IT RUNS, before anything is written. A new automation cannot name ITSELF —
  -- it has no rows yet, so `p_id` names nothing — and passing it anyway is what makes the two
  -- call sites one shape rather than two.
  v_calls := agent.automation_calls(p_tenant, p_agent_id, p_id, p_steps);
  if (v_calls ->> 'ok')::boolean is not true then return v_calls; end if;

  -- THE ARITHMETIC, ONCE, FOR EVERY TIMED SCHEDULE. A manual one has no instant, and the
  -- constraint refuses a row that says otherwise.
  if coalesce(p_schedule, 'manual') <> 'manual' then
    v_next := agent.automation_next_run(p_schedule, p_at_local, p_zone, p_days, p_on_date, now());
  end if;

  insert into agent.automations
    (id, tenant_id, agent_id, name, enabled, schedule, at_local, zone, steps, inputs,
     days, on_date, on_event, next_run_at)
  values
    (p_id, p_tenant, p_agent_id, p_name, coalesce(p_enabled, true),
     coalesce(p_schedule, 'manual'), p_at_local, p_zone,
     coalesce(p_steps, '[]'::jsonb), coalesce(p_inputs, '[]'::jsonb),
     coalesce(p_days, '{}'::text[]), p_on_date, p_on_event, v_next)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version,
                            'next_run_at', v_row.next_run_at);
end; $$;

create or replace function agent.update_automation(
  p_tenant   text,
  p_id       uuid,
  p_name     text,
  p_enabled  boolean,
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_steps    jsonb,
  p_inputs   jsonb default '[]'::jsonb,
  p_days     text[] default null,
  p_on_date  date default null,
  p_on_event text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row   agent.automations;
  v_next  timestamptz := null;
  v_calls jsonb;
  v_ver   integer;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'update_automation: tenant must be a non-empty string';
  end if;

  -- LOCKED, so the scheduler cannot advance `next_run_at` between this read and the write
  -- below and have its advance thrown away.
  select * into v_row from agent.automations
   where id = p_id and tenant_id = p_tenant
     for update;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  -- ⚠ WHAT IT SAYS IT RUNS, asked against the agent this row really belongs to — never an
  -- agent id from the call, which this function is not given and must not be.
  v_calls := agent.automation_calls(p_tenant, v_row.agent_id, p_id, p_steps);
  if (v_calls ->> 'ok')::boolean is not true then return v_calls; end if;

  -- ⚠ **THE VERSION MOVES ON A CHANGE OF STEPS AND ON NOTHING ELSE**, which is the rule
  -- `agent.save_memory` already follows one table over: a version says which WORKFLOW a parent
  -- copied in, so renaming an automation, moving its time or adding a day must not move it.
  v_ver := case when v_row.steps is distinct from coalesce(p_steps, '[]'::jsonb)
                then v_row.version + 1 else v_row.version end;

  if coalesce(p_schedule, 'manual') <> 'manual' then
    -- **RECOMPUTED FROM NOW, NOT CARRIED OVER, and that is deliberate.** A person who changes
    -- the time means the new time, and keeping the stored instant would leave the automation
    -- firing at the old one once more. The cost is stated: moving the time forward past
    -- today's occurrence skips today, which is what changing a schedule means.
    v_next := agent.automation_next_run(p_schedule, p_at_local, p_zone, p_days, p_on_date, now());
  end if;

  update agent.automations
     set name        = p_name,
         enabled     = coalesce(p_enabled, true),
         schedule    = coalesce(p_schedule, 'manual'),
         at_local    = p_at_local,
         zone        = p_zone,
         steps       = coalesce(p_steps, '[]'::jsonb),
         inputs      = coalesce(p_inputs, '[]'::jsonb),
         days        = coalesce(p_days, '{}'::text[]),
         on_date     = p_on_date,
         on_event    = p_on_event,
         version     = v_ver,
         next_run_at = v_next
   where id = p_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version,
                            'next_run_at', v_row.next_run_at);
end; $$;

/**
 * ⚠ **THE NARROWER ONES ARE DROPPED, AND LEAVING THEM COST A WHOLE `test:pg` RUN.**
 *
 * `create or replace function` matches on the argument TYPE LIST, so a wider signature is a
 * SECOND function rather than a replacement — and then a call with the old arity matches both
 * and Postgres refuses it `is not unique`. MEASURED: 49 checks failed, and the first one to
 * look at said `no-automation` about an automation whose CREATE had been refused two checks
 * earlier, which is the misleading half — the cause reads as a missing row.
 *
 * So they go, for the same reason the 6-argument `accept_automation_run` goes below: an
 * overload that cannot express the new thing is a door somebody reaches by accident. The
 * `_once` wrappers in `20260918020000_agent_operation_records.sql` call these by NAME and
 * resolve at run time, so their inner calls reach the wide ones with the new parameters
 * defaulting — which is what makes an agent-authored automation still work while being unable
 * to ask for a weekly schedule it has no day list for.
 *
 * ⚠ **BUT THEIR OWN SIGNATURES HAD TO BE WIDENED TOO, and the first cut of this migration
 * widened only the inner three.** A wrapper takes `p_tenant`, its own four, and the inner
 * function's remaining parameters — that is the rule the local PostgREST shim DERIVES each
 * wrapper's argument list from, rather than writing eleven lists out twice. So an inner
 * function that grows a parameter and a wrapper that does not is a shim sending more
 * arguments than the database will accept: MEASURED, `run_automation` answered
 * `HTTP 400 … accept_automation_run_once(...) does not exist` and THREE demonstrations went
 * red at once, on a wrapper, an inner function and a shim that were each correct alone.
 *
 * **AND A DOOR NARROWER THAN THE THING BEHIND IT HAS TO BE WIDENED EVENTUALLY ANYWAY** — the
 * day an event-triggered accept needs to be idempotent, or an agent is allowed a weekly
 * schedule, that wrapper cannot express it. The census in `test/integration/pg-schema.mjs`
 * asks the rule of all six now, so the next parameter fails by existing.
 */
drop function if exists agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb);
drop function if exists agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb);
-- ...and the ones from before `p_inputs`, which the workflow migration left behind for the
-- same reason and which are equally reachable by a shorter call.
drop function if exists agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer);
drop function if exists agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb);

-- THE WIDENED SIGNATURES ARE THEIR OWN OBJECTS, so they need their own revokes and grants.
revoke all on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb, text[], date, text) from public;
revoke all on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb, text[], date, text) from public;
grant execute on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb, text[], date, text) to service_role;
grant execute on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb, text[], date, text) to service_role;


-- ── 12. THE `_once` WRAPPERS FOLLOW THEIR INNER FUNCTIONS ───────────────────
--
-- Three of the six wrap a function this migration widened, so three are re-created here
-- with the inner function's new parameters on the end and the inner call passing them
-- through. The bodies are otherwise the ones `20260918020000` wrote and are not repeated:
-- `create or replace` replaces a body whole, and only the SIGNATURE and the inner call
-- differ, so what follows is the same text with those two lines changed.

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
  p_inputs   jsonb,
  p_days     text[] default null,
  p_on_date  date   default null,
  p_on_event text   default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb; v_out jsonb; v_lost boolean := false; v_state text; v_msg text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'create_automation', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;
  begin
    v_out := agent.create_automation(p_tenant := p_tenant, p_agent_id := p_agent_id,
      p_id := p_id, p_name := p_name, p_enabled := p_enabled, p_schedule := p_schedule,
      p_at_local := p_at_local, p_zone := p_zone, p_steps := p_steps, p_max := p_max,
      p_inputs := p_inputs, p_days := p_days, p_on_date := p_on_date, p_on_event := p_on_event);
    if not agent.operation_record(p_tenant, p_op_key, 'create_automation', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first' using errcode = 'AG001';
    end if;
  exception when others then
    v_lost := true; v_state := sqlstate; v_msg := sqlerrm;
  end;
  if v_lost then
    v_check := agent.operation_check(p_tenant, p_op_key, 'create_automation', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    if v_state <> 'AG001' then raise exception '%', v_msg using errcode = v_state; end if;
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'create_automation');
  end if;
  return v_out;
end $$;

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
  p_inputs   jsonb,
  p_days     text[] default null,
  p_on_date  date   default null,
  p_on_event text   default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb; v_out jsonb; v_lost boolean := false; v_state text; v_msg text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'update_automation', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;
  begin
    v_out := agent.update_automation(p_tenant := p_tenant, p_id := p_id, p_name := p_name,
      p_enabled := p_enabled, p_schedule := p_schedule, p_at_local := p_at_local,
      p_zone := p_zone, p_steps := p_steps, p_inputs := p_inputs, p_days := p_days,
      p_on_date := p_on_date, p_on_event := p_on_event);
    if not agent.operation_record(p_tenant, p_op_key, 'update_automation', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first' using errcode = 'AG001';
    end if;
  exception when others then
    v_lost := true; v_state := sqlstate; v_msg := sqlerrm;
  end;
  if v_lost then
    v_check := agent.operation_check(p_tenant, p_op_key, 'update_automation', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    if v_state <> 'AG001' then raise exception '%', v_msg using errcode = v_state; end if;
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'update_automation');
  end if;
  return v_out;
end $$;

create or replace function agent.accept_automation_run_once(
  p_tenant    text,
  p_op_key    text,
  p_args_hash text,
  p_op_run    uuid,
  p_automation_id uuid,
  p_run_id        uuid,
  p_trigger       text,
  p_occurrence    date,
  p_input         jsonb,
  p_event_id      uuid    default null,
  p_event_depth   integer default 0
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb; v_out jsonb; v_lost boolean := false; v_state text; v_msg text;
begin
  v_check := agent.operation_check(p_tenant, p_op_key, 'accept_automation_run', p_args_hash);
  if v_check ->> 'state' = 'repeat' then
    return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
  end if;
  if v_check ->> 'state' <> 'fresh' then
    return jsonb_build_object('ok', false, 'error', 'operation-' || (v_check ->> 'state'),
                              'was', v_check ->> 'action');
  end if;
  begin
    v_out := agent.accept_automation_run(p_tenant := p_tenant, p_automation_id := p_automation_id,
      p_run_id := p_run_id, p_trigger := p_trigger, p_occurrence := p_occurrence,
      p_input := p_input, p_event_id := p_event_id, p_event_depth := p_event_depth);
    if not agent.operation_record(p_tenant, p_op_key, 'accept_automation_run', p_args_hash, p_op_run, v_out) then
      raise exception 'another delivery recorded this operation first' using errcode = 'AG001';
    end if;
  exception when others then
    v_lost := true; v_state := sqlstate; v_msg := sqlerrm;
  end;
  if v_lost then
    v_check := agent.operation_check(p_tenant, p_op_key, 'accept_automation_run', p_args_hash);
    if v_check ->> 'state' = 'repeat' then
      return (v_check -> 'outcome') || jsonb_build_object('repeat', true);
    end if;
    if v_state <> 'AG001' then raise exception '%', v_msg using errcode = v_state; end if;
    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'accept_automation_run');
  end if;
  return v_out;
end $$;

-- THE NARROW WRAPPERS GO, for the reason stated above their inner functions: a wider
-- signature is a SECOND function, and a call with the old arity would then match both and be
-- refused `is not unique` — which reads as a missing row two checks later.
drop function if exists agent.create_automation_once(text, text, text, uuid, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb);
drop function if exists agent.update_automation_once(text, text, text, uuid, uuid, text, boolean, text, time, text, jsonb, jsonb);
drop function if exists agent.accept_automation_run_once(text, text, text, uuid, uuid, uuid, text, date, jsonb);

-- THE WIDENED WRAPPERS ARE THEIR OWN OBJECTS, so they need their own revokes and grants.
revoke all on function agent.create_automation_once(text, text, text, uuid, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb, text[], date, text) from public;
revoke all on function agent.update_automation_once(text, text, text, uuid, uuid, text, boolean, text, time, text, jsonb, jsonb, text[], date, text) from public;
revoke all on function agent.accept_automation_run_once(text, text, text, uuid, uuid, uuid, text, date, jsonb, uuid, integer) from public;
grant execute on function agent.create_automation_once(text, text, text, uuid, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb, text[], date, text) to service_role;
grant execute on function agent.update_automation_once(text, text, text, uuid, uuid, text, boolean, text, time, text, jsonb, jsonb, text[], date, text) to service_role;
grant execute on function agent.accept_automation_run_once(text, text, text, uuid, uuid, uuid, text, date, jsonb, uuid, integer) to service_role;
