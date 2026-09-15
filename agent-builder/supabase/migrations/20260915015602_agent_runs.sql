-- ============================================================================
-- AGENT RUNS: the append-only store a run is resumed from.
--
-- APPLIED LIVE 2026-09-15 to the Supabase project `ujrqdmmtcptvimazlhom`, which
-- is the one the site builder already uses (owner: "it can be in the same
-- supabase project"). **THE FILE IS NAMED FOR THE REMOTE VERSION**
-- (`20260915015602`) rather than for when it was written, because that is the one
-- way the two can be lined up later — and this file is NOT the record of what is
-- live. Read that out of the database.
--
-- ONE PROJECT, TWO PRODUCTS, ONE SCHEMA EACH. Nothing here is in `public`, so a
-- name in this file cannot collide with anything the site builder owns, and
-- dropping this product is dropping one schema. The cost is that the project's
-- migration history now comes from two directories in this repository.
--
-- VERIFIED ON THE LIVE DATABASE, on Postgres 17 where the local checks run on
-- 16.13: the generated columns, the projection, the unbounded limit surviving as
-- a string, an unreported usage staying JSON null and not zero, all four duplicate
-- refusals, the malformed-entry refusal, the append-only refusal, the lone-delete
-- refusal, tenant isolation as a real `authenticated` client, failing closed with
-- no claims and with junk claims, and retention cascading. The probe rolled itself
-- back and both tables are empty.
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
  -- "Infinity" here, because `JSON.stringify(Infinity)` is `"null"` and a null
  -- would read as "no limit recorded" — cannot-tell wearing a value's clothes.
  -- The codec PAIR is `limitsToJson` / `limitsFromJson` in src/journal.mjs, kept
  -- together there because an encoder in one file and a decoder in another is how
  -- a round trip quietly stops being one. This column keeps whatever they agree on.
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
-- AND A SINGLE ENTRY CANNOT BE DELETED WHILE ITS RUN REMAINS, which is a
-- separate hole and a worse one. Losing one entry does not corrupt the log in any
-- way a reader can SEE: a model entry whose tool result was deleted replays as a
-- call that is still PENDING, with no problem reported, because a deleted entry
-- is indistinguishable from one that was never written. Measured — a completed
-- `charge` came back pending and `problems` was empty. On resume that is a
-- payment taken twice, or a run stranded, depending on which way the tool is
-- declared.
--
-- RETENTION STILL WORKS, AND IS THE ONLY WAY THROUGH: delete the RUN and its log
-- goes with it. The pair of triggers below say exactly that — an entry may be
-- deleted only while its own run is being deleted in the same transaction.
--
-- WHY A TRANSACTION MARKER RATHER THAN ASKING WHETHER THE PARENT IS STILL THERE.
-- The obvious test is `exists (select 1 from agent.runs where id = old.run_id)`,
-- since a cascade removes the parent first. It would work here and it depends on
-- the parent being VISIBLE to the check — and `agent.runs` has FORCE row level
-- security, so whether a given role can see that row varies with the role and
-- with the platform. A wall whose answer depends on who is looking is the wrong
-- shape for a wall: when it fails it fails OPEN, allowing the delete. The marker
-- has no such dependency.
--
-- THE PRIMARY WALL IS STILL THE GRANT — no role is given DELETE on the entries at
-- all, so the only caller that can try this is the table's owner. The triggers are
-- what stop the owner doing it by hand, and are declared redundant deliberately.
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

-- Deleting a run marks the transaction, so its cascade is recognised. A BEFORE
-- ROW trigger fires before the row goes and before the referential action that
-- deletes the children, so the marker is always set first.
create or replace function agent.run_delete_begins() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- THE MARKER NAMES THE RUN, and that is the correction a SQL mutation sweep
  -- forced. It used to be the word 'on', which said only "some run is being
  -- deleted in this transaction" — so within one transaction, deleting ANY run
  -- authorised deleting the entries of ANY OTHER. Measured: two deletes in one
  -- `psql -c` share a transaction, and the second was allowed. The exposure was
  -- narrow (no role holds DELETE on the entries) but the claim was "an entry may
  -- go only with ITS OWN run", and that claim was false.
  --
  -- Ids are APPENDED, comma-terminated, because a multi-row delete fires this
  -- BEFORE trigger once per row and the referential cascades all run afterwards,
  -- at the end of the statement — so replacing the value would leave every run but
  -- the last unauthorised.
  --
  -- Transaction-local, so it is gone at commit or rollback and cannot leak into
  -- the next statement on a pooled connection.
  --
  -- THE `true` IS INTENT, NOT THE THING THAT MAKES IT SAFE — measured. A SQL
  -- mutation sweep flipped it to `false` (session scope) and NOTHING changed: the
  -- marker still did not survive the transaction, checked three ways, including
  -- re-creating a run under the same id in a later transaction of the same session
  -- and trying to delete its entry. A plain function doing the same `set_config`
  -- DOES leak, so the difference is something about being called from a trigger,
  -- and the mechanism is NOT established here. What is established is the
  -- behaviour. The flag stays because it says what is meant and costs nothing.
  perform set_config(
    'agent.deleting_run',
    coalesce(nullif(current_setting('agent.deleting_run', true), ''), '') || old.id::text || ',',
    true);
  return old;
end;
$$;

create trigger runs_delete_marks
  before delete on agent.runs
  for each row execute function agent.run_delete_begins();

create or replace function agent.entries_go_with_their_run() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- THIS run must be named, not merely some run. Anything we cannot read as "this
  -- entry's own run is being deleted" refuses: an unset marker, an empty one, or a
  -- list that does not contain this run. Fails closed.
  --
  -- The comma is part of the needle, so one id cannot match another's prefix.
  if position(old.run_id::text || ',' in
              coalesce(nullif(current_setting('agent.deleting_run', true), ''), '')) = 0 then
    raise exception 'agent.run_entries: entry (run %, seq %) cannot be deleted on its own — delete the run and its log goes with it',
      old.run_id, old.seq
      using errcode = 'restrict_violation',
            hint = 'A missing entry replays as a tool call that is still pending, with no problem reported.';
  end if;
  return old;
end;
$$;

create trigger entries_only_with_their_run
  before delete on agent.run_entries
  for each row execute function agent.entries_go_with_their_run();

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

-- FORCED, which is meant to stop the table owner being quietly exempt from its own
-- policies — AND THAT EFFECT IS UNVERIFIED. It is only observable to an owner who
-- is not a superuser, and a superuser bypasses row level security whatever FORCE
-- says, so no check here can see it and the SQL sweep deliberately does not mutate
-- it (the mutant would survive for a reason that has nothing to do with the schema
-- being right). Kept as correct hardening; recorded as an untested claim.
alter table agent.runs force row level security;
alter table agent.run_entries force row level security;

create policy runs_own_tenant on agent.runs
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

-- AN ENTRY'S TENANT IS ITS RUN'S TENANT, never a column of its own. A copy here
-- could disagree with the run it points at, and the disagreeing case is the one
-- where somebody reads another tenant's log.
--
-- THE TENANT COMPARISON INSIDE THIS POLICY IS A SECOND WALL, AND IS DELIBERATE.
-- A SQL mutation sweep removed it and every check still passed — measured, not
-- assumed — because `agent.runs` is itself under row level security, so the
-- subquery below is ALREADY filtered to this tenant's runs by the runs policy.
-- That makes the comparison redundant today and worth keeping anyway: it is what
-- holds if the runs policy is ever loosened, and the two walls fail independently.
-- Written down because a sweep cannot see a deliberate redundancy and the next
-- reader deletes what nothing appears to need.
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
