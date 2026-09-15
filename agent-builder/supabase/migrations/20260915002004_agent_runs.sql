-- ============================================================================
-- AGENT RUNS: the append-only store a run is resumed from.
--
-- ITS OWN SCHEMA, `agent`. Dropping this product is dropping one schema, and
-- nothing it creates can collide with a table belonging to anything else.
--
-- THE DESIGN IN ONE SENTENCE: the entry log is the only thing written, and
-- everything else about a run is DERIVED BY THE ENGINE from it. A `status`
-- column the application maintained would be a second copy of a fact the log
-- already states, and two copies of one fact eventually disagree — so the
-- triggers below own every summary column and the application owns none of them.
--
-- WHAT THE DATABASE MAKES IMPOSSIBLE, rather than merely detectable:
--   * a second `started` or `stopped` entry for a run;
--   * a second model answer for one step;
--   * a second result for one tool slot;
--   * a model entry with no step, or a tool entry with no step and index;
--   * an entry being EDITED after it was written.
-- The replay in `src/journal.mjs` reports each of those as a `problem`, because
-- a log can arrive from anywhere. Here they cannot be written in the first place.
-- ============================================================================

create schema if not exists agent;

-- ── who is asking ───────────────────────────────────────────────────────────
--
-- FAILS CLOSED, THREE WAYS: no claims at all, claims that are not valid JSON,
-- and a claims object with no tenant. Every one answers NULL — and because
-- `tenant_id = NULL` is NULL rather than true, a policy built on it matches no
-- rows. The fail-closed behaviour is SQL's own null semantics rather than
-- something this function has to remember to do.
--
-- `search_path` is pinned empty and every name is qualified, so nothing can be
-- resolved out of a caller-controlled schema.
create or replace function agent.tenant_id() returns text
  language plpgsql stable
  set search_path = ''
as $$
begin
  return nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'tenant_id',
    ''
  );
exception when others then
  -- Claims that will not parse are not a tenant. Anything we cannot read as an
  -- identity is not an identity.
  return null;
end;
$$;

comment on function agent.tenant_id() is
  'The calling tenant, from the request JWT. NULL when it cannot be read, which matches no rows.';

-- ── a run ───────────────────────────────────────────────────────────────────
--
-- The application writes `id` and `tenant_id` AND NOTHING ELSE. Every other
-- column is a projection of the log, maintained by the triggers below.
create table agent.runs (
  id          uuid primary key,
  tenant_id   text not null check (length(tenant_id) between 1 and 200),

  -- 'new' until a started entry lands, 'running' after it, 'stopped' once a
  -- stopped entry does. Derived, never asserted by a caller.
  status      text not null default 'new' check (status in ('new', 'running', 'stopped')),

  agent_name  text,
  model       text,

  -- The limits AS THE LOG RECORDED THEM. An unbounded limit is the string
  -- "Infinity" here, because `to_json(...)` of a JS Infinity is `null` and a
  -- null would read as "no limit recorded" — cannot-tell wearing a value's
  -- clothes. The encoding is `plainLimits` in src/run.mjs and the decoding is
  -- `limitsFromStore` in src/store.mjs; this column keeps whatever they agree on.
  limits      jsonb,

  -- The stop reason, verbatim: which bound ran out, or that it answered.
  stop        jsonb,

  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  stopped_at  timestamptz
);

comment on column agent.runs.status is 'Derived from the entry log by trigger. Never written by the application.';

create index runs_tenant_status on agent.runs (tenant_id, status);
create index runs_resumable on agent.runs (tenant_id, created_at) where status = 'running';

-- ── the log ─────────────────────────────────────────────────────────────────
create table agent.run_entries (
  run_id      uuid not null references agent.runs (id) on delete cascade,

  -- The caller's own ordering. The primary key makes a redelivered entry at the
  -- same position a refusal rather than a duplicate, and the unique indexes
  -- below catch the harder case: the SAME logical entry arriving twice at two
  -- different positions.
  seq         integer not null check (seq >= 0),

  -- THE ENTRY EXACTLY AS THE JOURNAL WROTE IT. This is the artifact: the model's
  -- own answer, the tool's own result, the usage as reported. Nothing is
  -- normalised out of it, and in particular a `usage` of JSON null stays JSON
  -- null and never becomes 0 or absent.
  body        jsonb not null,

  -- GENERATED FROM THE BODY, never supplied. These exist so the constraints and
  -- indexes below can be about the body's own content; a caller-supplied copy
  -- would be a second version of the same fact and the unique indexes would then
  -- be guarding the copy rather than the entry.
  kind        text    generated always as (body ->> 'kind') stored,
  step        integer generated always as (nullif(body ->> 'step', '')::integer) stored,
  idx         integer generated always as (nullif(body ->> 'index', '')::integer) stored,

  written_at  timestamptz not null default now(),

  primary key (run_id, seq),

  constraint entry_kind_known
    check (body ->> 'kind' in ('started', 'model', 'tool', 'stopped')),

  -- EVERY KIND CARRIES EXACTLY THE POSITION IT NEEDS. "A model entry with no
  -- usable step" is something the replay has to detect; here it cannot be
  -- stored. Written against the body rather than the generated columns, because
  -- a check on a generated column is evaluated before it is computed.
  constraint entry_position_matches_kind check (
    case body ->> 'kind'
      when 'started' then body ->> 'step' is null and body ->> 'index' is null
      when 'stopped' then body ->> 'step' is null and body ->> 'index' is null
      when 'model'   then body ->> 'step' is not null and body ->> 'index' is null
      when 'tool'    then body ->> 'step' is not null and body ->> 'index' is not null
    end
  )
);

-- ── no duplicates, stated as the four ways one could happen ─────────────────
create unique index entries_one_started on agent.run_entries (run_id) where kind = 'started';
create unique index entries_one_stopped on agent.run_entries (run_id) where kind = 'stopped';
create unique index entries_one_model_per_step on agent.run_entries (run_id, step) where kind = 'model';
create unique index entries_one_tool_per_slot on agent.run_entries (run_id, step, idx) where kind = 'tool';

-- Reading a run back is always "every entry in order".
create index entries_in_order on agent.run_entries (run_id, seq);

-- ── append-only, enforced rather than described ─────────────────────────────
--
-- UPDATE is refused for everyone, superusers included: editing history is the
-- one operation that makes the whole design worthless, and a grant would not
-- stop the role that writes the log in the first place.
--
-- DELETE IS DELIBERATELY NOT REFUSED. Deleting a run has to cascade to its
-- entries, and a retention policy has to be able to drop old runs; refusing
-- deletes here would make both impossible. The wall for deletes is the grants
-- below, which give no client the privilege.
create or replace function agent.entries_are_append_only() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  raise exception 'agent.run_entries is append-only: entry (run %, seq %) cannot be updated',
    old.run_id, old.seq
    using errcode = 'restrict_violation';
end;
$$;

create trigger entries_append_only
  before update on agent.run_entries
  for each row execute function agent.entries_are_append_only();

-- ── the projection the log owns ─────────────────────────────────────────────
--
-- SECURITY DEFINER so the projection is maintained no matter who appended the
-- entry, with `search_path` pinned empty. It touches exactly one row, chosen by
-- the new entry's own `run_id`, and reads nothing from the caller.
create or replace function agent.project_entry() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
begin
  if new.kind = 'started' then
    update agent.runs
       set status     = case when status = 'new' then 'running' else status end,
           agent_name = coalesce(new.body ->> 'agent', agent_name),
           model      = coalesce(new.body ->> 'model', model),
           -- `->` not `->>`: the limits are an object and must stay one.
           limits     = coalesce(new.body -> 'limits', limits),
           started_at = coalesce(started_at, new.written_at)
     where id = new.run_id;

  elsif new.kind = 'stopped' then
    update agent.runs
       set status     = 'stopped',
           stop       = new.body -> 'stop',
           stopped_at = new.written_at
     where id = new.run_id;
  end if;

  return null; -- AFTER trigger: the return value is ignored either way.
end;
$$;

create trigger entries_project
  after insert on agent.run_entries
  for each row execute function agent.project_entry();

-- ── tenant isolation ────────────────────────────────────────────────────────
alter table agent.runs enable row level security;
alter table agent.run_entries enable row level security;

-- Forced on, so the table owner is not quietly exempt from its own policies.
alter table agent.runs force row level security;
alter table agent.run_entries force row level security;

create policy runs_own_tenant on agent.runs
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

-- AN ENTRY'S TENANT IS ITS RUN'S TENANT, never a column of its own. A copy here
-- could disagree with the run it points at, and the disagreeing case is the one
-- where somebody reads another tenant's log.
create policy entries_own_tenant on agent.run_entries
  for all
  using (exists (
    select 1 from agent.runs r
     where r.id = run_entries.run_id and r.tenant_id = agent.tenant_id()))
  with check (exists (
    select 1 from agent.runs r
     where r.id = run_entries.run_id and r.tenant_id = agent.tenant_id()));

-- ── grants ──────────────────────────────────────────────────────────────────
--
-- A TENANT READS ITS OWN RUNS AND WRITES NOTHING. The runner writes, and the
-- runner is server-side. No client needs INSERT here, so no client has it — and
-- UPDATE and DELETE are granted to nobody at all, which is the second half of
-- "append-only" (the trigger stops the edit, the missing grant stops the try).
grant usage on schema agent to authenticated, service_role;
grant select on agent.runs, agent.run_entries to authenticated;
grant select, insert on agent.runs, agent.run_entries to service_role;
grant delete on agent.runs to service_role;   -- retention; cascades to entries

revoke all on agent.runs from anon;
revoke all on agent.run_entries from anon;
