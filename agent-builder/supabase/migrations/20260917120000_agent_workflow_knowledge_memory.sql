-- ════════════════════════════════════════════════════════════════════════════
-- RICHER WORKFLOWS, REFERENCE MATERIAL AND MEMORY.
--
-- Three things a customer can now do, and one of them changes how an execution is
-- stored. Written as ONE migration because the order inside it is load-bearing:
-- `accept_automation_run` snapshots an agent's memories, so the memory table has to
-- exist before it is redefined, and splitting that across two files would make the
-- apply order a thing somebody has to remember.
--
-- ── WHAT CHANGES, AND WHY IT IS A MIGRATION RATHER THAN A TWEAK ──────────────
--
-- `20260917003304_agent_automations.sql`'s own header predicted this, in as many words:
--
--   "**THE STEP TYPE THAT CHANGES THIS IS A WAIT OR AN APPROVAL**: the day an execution
--    has to span transactions it needs per-step entries and a resumable position, and
--    that is a migration, not a tweak. Said here because the next reader will be the
--    one adding it."
--
-- That is this file. An execution used to be ONE transaction: `finish_automation_run`
-- wrote every outcome and the stop together and released the work. A workflow that can
-- pause cannot do that, because the pause and the resume are different transactions in
-- different processes, possibly days apart and with a Worker deploy in between. So:
--
--   1. the journal gains ONE kind, `step`, so each completed step is an append-only
--      entry written through the EXISTING fence — `agent.append_entry`, untouched;
--   2. `agent.automation_runs` gains a resumable POSITION and the values bound so far;
--   3. a pause RELEASES the work row, so nothing is held open while it waits, and the
--      cron or an approval puts it back on the queue.
--
-- **THE FENCE IS NOT COPIED, AND THAT IS THE WHOLE REASON THE JOURNAL GAINED A KIND.**
-- The alternative was a second function doing `select … for update` and the same five
-- holder/token/lease checks `append_entry` already does — two copies of the one wall
-- that keeps two workers off one run. Instead `agent.advance_automation_run` APPENDS
-- first and updates the row only if the append was accepted, which is exactly the shape
-- `finish_automation_run` has been using since the day it was written.
--
-- **THE COST IS STATED: an execution is now N+1 transactions where it was one.** That is
-- the price of being able to pause at all, and it buys the property the requirement
-- actually asks for — progress recorded per step, so a resume cannot repeat a completed
-- action.
-- ════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- 1. THE JOURNAL LEARNS ONE MORE KIND
--
-- `step` — one workflow step, with what became of it. **The agent loop never writes
-- one and an agent run can never hold one**, so nothing about `runAgent`, its replay or
-- its bill changes; what changes is that an automation's progress lives where this
-- product says records belong, behind the same fence and the same append-only trigger.
--
-- **BOTH CHANGES ARE STRICTLY MORE PERMISSIVE**, so no existing row can fail them and
-- the validation `add constraint` performs is a scan that cannot refuse.
--
-- ⚠ **AND THERE IS DELIBERATELY NO `entries_one_step_per_position` INDEX.** One would be
-- tempting — it would make a duplicate advance answer `already` for free — and it would
-- be WRONG, because a pause writes an entry for its step and the resume writes another
-- for the SAME step. Two entries for one position is the honest record of a step that
-- waited and then ran. What stops a duplicate advance double-counting is the forward-only
-- guard on the execution row, below, which is a rule about progress rather than about
-- entries.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.run_entries drop constraint if exists entry_kind_known;
alter table agent.run_entries add constraint entry_kind_known
  check (body ->> 'kind' in ('started', 'model', 'tool', 'stopped', 'step'));

alter table agent.run_entries drop constraint if exists entry_position_matches_kind;
alter table agent.run_entries add constraint entry_position_matches_kind check (
  case body ->> 'kind'
    when 'started' then body ->> 'step' is null and body ->> 'index' is null
    when 'stopped' then body ->> 'step' is null and body ->> 'index' is null
    when 'model'   then body ->> 'step' is not null and body ->> 'index' is null
    when 'tool'    then body ->> 'step' is not null and body ->> 'index' is not null
    -- A WORKFLOW STEP IS AT A POSITION IN A LIST, so it carries a step and no index.
    -- The same shape a model entry has, and for the same reason: the position is what an
    -- outcome is about.
    when 'step'    then body ->> 'step' is not null and body ->> 'index' is null
  end
);

comment on constraint entry_kind_known on agent.run_entries is
  'The four kinds the agent loop writes, plus `step`, which only an automation execution writes — one per workflow step it got through.';

-- ══════════════════════════════════════════════════════════════════════════
-- 2. REFERENCE MATERIAL — what an agent has been given to read
--
-- **IT IS NOT MEMORY AND IT IS NOT A CONVERSATION, and keeping the three apart is the
-- point.** A conversation is what somebody said; a memory is a fact or a preference that
-- persists and is corrected; this is MATERIAL — a document with a name and a version,
-- searched rather than recalled. Collapsing any two of them would make one of the three
-- impossible to manage on its own.
--
-- **ITS OWN TABLE PER (ACCOUNT, AGENT), WITH THE SCOPE IN THE KEY** rather than in a
-- filter somebody has to remember, exactly as `agent.agents` does it.
--
-- ⚠ **WHAT COMES BACK OUT OF HERE IS REFERENCE INFORMATION AND NEVER PERMISSION.** An
-- excerpt is bound to a name and read only by text substitution; nothing anywhere reads a
-- retrieved value as a tool, a bound, a step or a schedule, and an automation execution
-- has no tool surface at all. So a document that says "you may use every tool" is a
-- sentence somebody wrote in a document, which is what it would be if they had typed it
-- into a note themselves.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agent.agent_knowledge (
  id         uuid primary key,
  tenant_id  text        not null check (length(tenant_id) between 1 and 200),
  agent_id   uuid        not null references agent.agents(id) on delete cascade,

  -- THE SOURCE NAME, PRESERVED. It is what a retrieved excerpt is attributed to, so it
  -- is not decoration: an excerpt with no source is an assertion nobody can check. A file
  -- keeps the name it was uploaded under.
  title      text        not null check (length(btrim(title)) between 1 and 200),
  body       text        not null check (length(body) between 1 and 200000),

  -- `text` or `markdown`. Recorded rather than sniffed, because what somebody uploaded is
  -- a fact about the upload and guessing it from the bytes is a guess that changes when
  -- the guesser does.
  format     text        not null default 'text',

  -- ⚠ **THE VERSION IS THE DATABASE'S AND IT COUNTS EDITS TO THE BODY.** A run records
  -- which version of a source it quoted, so "the answer used the old price list" is
  -- answerable afterwards. It is bumped by a trigger rather than by whoever writes:
  -- a caller-supplied version is a second copy of a fact the row already holds, and the
  -- copy that drifts is the one an audit reads.
  version    integer     not null default 1 check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_knowledge_format_known check (format in ('text', 'markdown'))
);

-- ONE SOURCE NAME PER AGENT, case- and space-insensitively. Two documents called
-- "Price list" is a retrieval answer nobody can act on — which of them? Editing the one
-- that is there is how a source is replaced, and that is what keeps the version meaningful.
create unique index if not exists agent_knowledge_one_title_per_agent
  on agent.agent_knowledge (tenant_id, agent_id, lower(btrim(title)));

-- The list is read for one agent, newest-changed first, and that is the only way it is
-- read. The tenant leads because every read filters on it first.
create index if not exists agent_knowledge_by_agent
  on agent.agent_knowledge (tenant_id, agent_id, updated_at desc);

-- ⚠ **THE SEARCH INDEX IS OVER THE TITLE AND THE BODY TOGETHER, and `english` is a
-- choice rather than a default.** It stems, so "pricing" finds "prices" — which is what
-- somebody typing a search expects and what `simple` would not give. The cost is stated:
-- it is one language, and a document in another will be matched word for word rather than
-- by stem. That is a real limit and it is better than no stemming at all.
create index if not exists agent_knowledge_search
  on agent.agent_knowledge
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')));

comment on table agent.agent_knowledge is
  'Reference material one agent has been given to read: a source name, its text, and a version the database bumps on every edit. Searched by agent.search_knowledge; never a source of permissions.';

-- ── the version is the database's ───────────────────────────────────────────
--
-- **ONLY A CHANGE TO THE MATERIAL COUNTS AS A NEW VERSION.** Renaming a source, or saving
-- the same body twice, is not a new version — a version exists so a run can say which TEXT
-- it quoted, and bumping it on a no-op save would make that claim meaningless. `updated_at`
-- moves either way, because something really did change.
create or replace function agent.agent_knowledge_touch() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.body is distinct from old.body then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end; $$;

drop trigger if exists agent_knowledge_touched on agent.agent_knowledge;
create trigger agent_knowledge_touched
  before update on agent.agent_knowledge
  for each row execute function agent.agent_knowledge_touch();

-- ══════════════════════════════════════════════════════════════════════════
-- SEARCHING IT — real keyword search, no embedding and no model call
--
-- **`ts_headline` IS THE EXCERPT and it is PostgreSQL's own**, so the passage that comes
-- back is the part of the document that matched rather than its first N characters. The
-- alternative — sending whole documents and letting something upstream trim them — is
-- how a 200KB source becomes 200KB on the wire.
--
-- ⚠ **A QUERY WITH NO LEXEMES ANSWERS NOTHING, NEVER EVERYTHING.** `plainto_tsquery` on
-- "the and of" is an EMPTY query, and an empty tsquery matches no row — but a caller that
-- read the emptiness as "no filter" would hand back every document an agent has. It is
-- refused here by name, so the emptiness is an answer rather than a fall-through.
--
-- ⚠ **AND IT ANSWERS ONE OBJECT RATHER THAN A SET, BECAUSE THREE DIFFERENT NOTHINGS USED TO
-- ARRIVE AS THE SAME EMPTY LIST.** This returned `setof jsonb`, so "there was nothing to
-- search for", "this agent has no reference material at all" and "it has some and none of it
-- matched" were one answer: zero rows. MEASURED through the real step before this changed —
-- a stopword-only query and a genuine miss produced BYTE-IDENTICAL outcomes, and the note on
-- both said *searched for X and found nothing*, which is a claim about the customer's own
-- documents in the one case where nothing was searched at all.
--
-- **The comment above this one claimed the two were distinct and they were not**: `numnode = 0`
-- took a different branch and answered the same thing. So the two facts a reader cannot
-- reconstruct now travel with the excerpts — `searched` (was there anything to look for) and
-- `sources` (how many documents this agent HAS, which is what separates "you have none" from
-- "none of yours matched"). Both are the DATABASE's, because both are questions about rows.
--
-- **`ok` IS ON IT for the same reason every other answer here carries one**: a reader that
-- has to infer success from the shape of what came back is one that reads an outage as an
-- empty library.
--
-- **`stable`, not `volatile`**, and `security definer` with the search path pinned empty:
-- it is a read the server does on a tenant's behalf, and the tenant is an ARGUMENT, which
-- is only safe because no client role can execute it.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.search_knowledge(
  p_tenant   text,
  p_agent_id uuid,
  p_query    text,
  p_limit    integer default 5
) returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_q       tsquery;
  v_limit   integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_sources integer;
  v_rows    jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'search_knowledge: tenant must be a non-empty string';
  end if;

  /**
   * HOW MUCH THERE IS TO SEARCH, counted whatever the query turns out to be — because it is
   * the fact that separates an agent with no reference material from one whose material does
   * not match, and a caller cannot ask for it afterwards without a second round trip.
   */
  select count(*) into v_sources
    from agent.agent_knowledge k
   where k.tenant_id = p_tenant and k.agent_id = p_agent_id;

  if p_query is null or btrim(p_query) = '' then
    -- NOTHING SEARCHED FOR IS NOTHING FOUND, and it is not every document.
    return jsonb_build_object('ok', true, 'searched', false, 'sources', v_sources,
                              'excerpts', jsonb_build_array());
  end if;

  v_q := plainto_tsquery('english', p_query);
  -- A QUERY MADE ENTIRELY OF STOPWORDS. `numnode` counts the nodes in the parsed query, so
  -- zero is "there was nothing to look for" — and it now SAYS so, where before it took its
  -- own branch to produce the same empty list a genuine miss produces.
  if v_q is null or numnode(v_q) = 0 then
    return jsonb_build_object('ok', true, 'searched', false, 'sources', v_sources,
                              'excerpts', jsonb_build_array());
  end if;

  select coalesce(jsonb_agg(e.row order by e.rank desc, e.name asc), jsonb_build_array())
    into v_rows
  from (
    select jsonb_build_object(
             'id',      k.id,
             'title',   k.title,
             'version', k.version,
             'format',  k.format,
             -- THE MATCHED PASSAGE, not the start of the document.
             'text',    ts_headline('english', k.body, v_q,
                          'MaxFragments=2, MinWords=8, MaxWords=40, StartSel="", StopSel="", FragmentDelimiter=" … "'),
             'rank',    round(ts_rank(to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.body, '')), v_q)::numeric, 6)) as row,
           ts_rank(to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.body, '')), v_q) as rank,
           lower(k.title) as name
      from agent.agent_knowledge k
     where k.tenant_id = p_tenant
       and k.agent_id = p_agent_id
       and to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.body, '')) @@ v_q
     -- BEST FIRST, THEN BY NAME, so two equally good matches come back in a stable order
     -- rather than in whatever order the scan happened to produce. The ORDER is applied in
     -- the aggregate as well, because `jsonb_agg` over a subquery is not obliged to keep it.
     order by ts_rank(to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.body, '')), v_q) desc,
              lower(k.title) asc
     limit v_limit
  ) e;

  return jsonb_build_object('ok', true, 'searched', true, 'sources', v_sources,
                            'excerpts', v_rows);
end; $$;

comment on function agent.search_knowledge(text, uuid, text, integer) is
  'Keyword search over one agent''s reference material, answering the matched passages with their source name and version, whether there was anything searchable to look for, and how many sources the agent has. A query with no searchable words answers nothing rather than everything, and says which of the two it was.';

-- ══════════════════════════════════════════════════════════════════════════
-- 3. MEMORY — facts and preferences that persist between conversations
--
-- **DISTINCT FROM BOTH OF THE OTHER TWO, and the difference is what each is FOR.** A
-- conversation is a record of what was said and is never edited. Reference material is a
-- document, searched. A memory is a small, named, CORRECTABLE fact — "the tone is formal",
-- "invoices go to accounts@" — and correcting one is the ordinary thing to do with it,
-- which is precisely why it cannot live in an append-only log.
--
-- **THE SCOPE IS (ACCOUNT, AGENT) AND IT IS IN THE KEY**, not in a filter: one unique
-- index is what makes "this account's own agent's memories" a thing the database
-- enforces rather than a thing every reader has to remember. Two agents of one account
-- do not share memories, and two accounts cannot see each other's at all.
--
-- **EXPLICIT AND USER-MANAGED ONLY, DELIBERATELY.** Nothing here extracts a memory from a
-- conversation: `source` records where each one came from and the only value it can hold
-- today is `person`. Automatic extraction is a model call and a decision about somebody's
-- own words, and it is deferred — but the COLUMN exists now, so the day it happens a
-- memory written by a run is distinguishable from one somebody typed, rather than being
-- indistinguishable for ever.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agent.agent_memory (
  id         uuid primary key,
  tenant_id  text        not null check (length(tenant_id) between 1 and 200),
  agent_id   uuid        not null references agent.agents(id) on delete cascade,

  -- THE NAME A WORKFLOW ASKS FOR. The same identifier rule references use, mirrored from
  -- the engine's `REF_NAME`, because a memory key IS what a step names.
  key        text        not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  value      text        not null check (length(value) <= 4000),

  -- WHERE IT CAME FROM, and it is a column rather than an inference.
  source     text        not null default 'person',

  -- HOW MANY TIMES IT HAS BEEN CORRECTED, so "which versions a run used" is a recorded
  -- fact. Bumped by the trigger below, on a change to the VALUE only.
  version    integer     not null default 1 check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_memory_source_known check (source in ('person', 'run'))
);

-- ⚠ THE SCOPE, IN THE DATABASE. Without this, "one value per name" would be something
-- every writer had to check, and two writers racing would both pass their own check.
create unique index if not exists agent_memory_one_per_key
  on agent.agent_memory (tenant_id, agent_id, key);

create index if not exists agent_memory_by_agent
  on agent.agent_memory (tenant_id, agent_id, key asc);

comment on table agent.agent_memory is
  'One agent''s saved facts and preferences, scoped to (account, agent) by a unique index. Explicit and user-managed; `source` and `version` say where each came from and how often it has been corrected.';

create or replace function agent.agent_memory_touch() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  -- ONLY A CHANGE TO THE VALUE IS A NEW VERSION. Re-saving the same words is not a
  -- correction, and a run that says it used version 3 must mean the third distinct value.
  if new.value is distinct from old.value then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end; $$;

drop trigger if exists agent_memory_touched on agent.agent_memory;
create trigger agent_memory_touched
  before update on agent.agent_memory
  for each row execute function agent.agent_memory_touch();

-- ── what an execution is given ──────────────────────────────────────────────
--
-- **EVERY MEMORY THIS AGENT HAS, WITH ITS VERSION, as one object.** A workflow names the
-- ones it wants; this is what it names them out of. The snapshot is taken INSIDE the
-- accepting transaction, which is what makes a correction reach the NEXT execution and
-- never one already under way — the same rule the workflow itself and the instruction
-- snapshot follow, for the same reason.
--
-- **`{}` FOR AN AGENT WITH NONE**, which is a real answer and not an absence: a step that
-- asks for a key finds nothing remembered and says so.
/**
 * ⚠ **`source` IS IN THE SNAPSHOT, AND WITHOUT IT THE DISTINCTION DIES AT THIS LINE.**
 *
 * `agent.agent_memory.source` separates a fact a PERSON confirmed from one an agent's own run
 * wrote — which is the whole reason that column exists and is never inferred. The snapshot is
 * what a run actually reads, so a snapshot carrying only the value and the version makes the
 * two indistinguishable everywhere it matters: in the step's own outcome, in the history
 * somebody audits afterwards, and in whatever a note quotes. **A column that is recorded and
 * never carried is this repository's most-recorded defect**, and it was one hop from here.
 *
 * **THE VALUE IS STILL JUST THE VALUE.** Where it came from rides BESIDE it and never inside
 * it: a note that quoted "formal (remembered by the agent)" would be putting our bookkeeping
 * into somebody's own words.
 */
create or replace function agent.agent_memory_snapshot(
  p_tenant   text,
  p_agent_id uuid
) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select coalesce(
           jsonb_object_agg(m.key, jsonb_build_object(
             'value', m.value, 'version', m.version, 'source', m.source)),
           '{}'::jsonb)
    from agent.agent_memory m
   where m.tenant_id = p_tenant and m.agent_id = p_agent_id;
$$;

comment on function agent.agent_memory_snapshot(text, uuid) is
  'Every memory one agent holds, keyed by name, each with the version it was at and who it came from. Taken inside the accepting transaction so a later correction cannot change an execution already under way.';

-- ══════════════════════════════════════════════════════════════════════════
-- 4. AN AUTOMATION MAY DECLARE ITS INPUTS
--
-- **NAMED, SO A LATER STEP CAN REFER TO ONE.** Without a declaration there is nothing for
-- the form to ask for and nothing for `readWorkflow` to check a `{{reference}}` against —
-- which is the half that turns a typo into a sentence on somebody's screen rather than
-- into a failed run days later.
--
-- **THE SHAPE IS BOUNDED HERE AND THE MEANING IS THE ROUTE'S**, exactly as `steps` is: a
-- CHECK can say "a list of at most eight objects" and cannot say "every name matches the
-- engine's identifier rule", because that rule is code.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.automations
  add column if not exists inputs jsonb not null default '[]'::jsonb;

alter table agent.automations drop constraint if exists automations_inputs_shaped;
alter table agent.automations add constraint automations_inputs_shaped check (
  jsonb_typeof(inputs) = 'array' and jsonb_array_length(inputs) <= 8
);

comment on column agent.automations.inputs is
  'What this automation asks for when it is started: up to eight {name, label, required, default} declarations. The names are what a step''s {{reference}} may use.';

-- ══════════════════════════════════════════════════════════════════════════
-- 5. AN EXECUTION HAS A POSITION, VALUES, AND SOMETIMES SOMETHING IT IS WAITING FOR
--
-- Everything added here is the STATE OF ONE EXECUTION, and every one of them is
-- snapshotted or derived rather than read live, so an edit reaches the next execution and
-- never this one.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.automation_runs
  -- ⚠ HOW FAR IT HAS GOT: the index of the next step to run, 0-based. The one number a
  -- resume needs, and the one that makes "resuming cannot repeat completed actions" a
  -- property — it is written in the same transaction as the step's own journal entry, so
  -- it is always at or ahead of the work really done and never behind it.
  add column if not exists position integer not null default 0,

  -- THE NAMED VALUES: the inputs it was started with, and every step's answer bound under
  -- the name that step declared. Flat on purpose — the reference syntax is a name and
  -- nothing else, so a nested shape would be a shape nothing can address.
  add column if not exists vars jsonb not null default '{}'::jsonb,

  -- WHAT IT WAS STARTED WITH, kept apart from `vars` although `vars` is seeded from it.
  -- `vars` is rewritten by every step; this is the record of what somebody asked for, and
  -- reading it out of `vars` afterwards would be reading it out of something that has been
  -- overwritten.
  add column if not exists input jsonb not null default '{}'::jsonb,

  -- THE MEMORIES IT MAY USE, WITH THEIR VERSIONS. This is the answer to "which versions
  -- did this run use" and it is a stored fact rather than a join against rows that have
  -- since been corrected.
  add column if not exists memory jsonb not null default '{}'::jsonb,

  -- ── suspended, or not ─────────────────────────────────────────────────────
  -- WHAT IT IS WAITING FOR, as the step itself described it: `{kind, step, …}`. NULL for
  -- an execution that is running or finished, so "is this waiting" is one column rather
  -- than an inference from a status that says `running` either way.
  add column if not exists waiting jsonb,

  -- ⚠ AND WHEN THE WAIT IS UP, RESOLVED BY THE DATABASE. The engine answers what it is
  -- waiting FOR — thirty minutes, or 09:00 in a named zone — and this is the instant,
  -- computed through `agent.automation_next_at` for a time of day because that is the only
  -- thing in this product with a time zone database behind it. A JavaScript copy of that
  -- arithmetic would be the copy that drifts, about when somebody's work runs.
  --
  -- It is a COLUMN rather than a key inside `waiting` because the scheduler selects on it,
  -- and a partial index over a jsonb path is a worse instrument than one over a timestamp.
  add column if not exists wait_until timestamptz,

  -- ⚠ WHOSE MATERIAL THIS EXECUTION SEARCHES, snapshotted like everything else here. A
  -- knowledge step searches one agent's reference material, and reaching the agent through
  -- the automation at run time would mean an execution's retrieval changing under it if the
  -- automation were ever moved. **NULLABLE, because every execution accepted before this
  -- migration has no value for it** — and those cannot hold a knowledge step, since the step
  -- type did not exist; the executor reads a null one as "no material to search" and says
  -- so rather than searching somebody else's.
  add column if not exists agent_id uuid references agent.agents(id) on delete cascade,

  -- APPROVALS ANSWERED, keyed by the step's own id: `{"s8": {verdict, note, by, at}}`.
  -- Keyed, because one workflow may hold more than one approval and a single column would
  -- make the second indistinguishable from the first.
  add column if not exists decisions jsonb not null default '{}'::jsonb;

alter table agent.automation_runs drop constraint if exists automation_runs_progress_sane;
alter table agent.automation_runs add constraint automation_runs_progress_sane check (
  position >= 0
  and jsonb_typeof(vars) = 'object'
  and jsonb_typeof(input) = 'object'
  and jsonb_typeof(memory) = 'object'
  and jsonb_typeof(decisions) = 'object'
);

-- A PAUSE IS WHOLE OR IT IS NOT A PAUSE. A `waiting` with no instant is a row the
-- scheduler can never select, and an instant with no `waiting` is a deadline for nothing —
-- both are executions that would sit for ever looking as though they were about to move.
alter table agent.automation_runs drop constraint if exists automation_runs_wait_is_whole;
alter table agent.automation_runs add constraint automation_runs_wait_is_whole check (
  (waiting is null and wait_until is null)
  or (waiting is not null and wait_until is not null and jsonb_typeof(waiting) = 'object')
);

-- ⚠ AND A FINISHED EXECUTION IS NOT WAITING FOR ANYTHING. Without this, a bug that
-- finished a run without clearing the pause would leave the scheduler re-queueing it for
-- ever — work nothing will ever claim, offered once a minute.
alter table agent.automation_runs drop constraint if exists automation_runs_finished_is_not_waiting;
alter table agent.automation_runs add constraint automation_runs_finished_is_not_waiting check (
  finished_at is null or waiting is null
);

-- WHAT THE SCHEDULER ASKS FOR: a suspended, unfinished execution whose time has come.
-- Partial, because every other row in this table is the overwhelming majority.
create index if not exists automation_runs_waiting
  on agent.automation_runs (wait_until)
  where waiting is not null and finished_at is null;

-- ══════════════════════════════════════════════════════════════════════════
-- 6. CREATING AND EDITING ONE NOW CARRIES ITS INPUT DECLARATION
--
-- ⚠ **THE OLD SIGNATURES ARE DROPPED RATHER THAN LEFT BESIDE THE NEW ONES.** An
-- overload that does not take `inputs` is a door a caller can go through by forgetting a
-- field, and two overloads make a named-argument call ambiguous as well — which is the
-- reason the fencing migration dropped the token-less `beat_run` instead of keeping it.
-- The window during a deploy is loud either way: a Worker built before this answers
-- `PGRST202` for a function that is not there, rather than quietly saving no inputs.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer);
drop function if exists agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb);

-- ══════════════════════════════════════════════════════════════════════════
-- 6b. WHAT A `workflow` STEP MAY NAME — checked where the workflow is WRITTEN
--
-- ⚠ **THIS IS THE WALL AT SAVE TIME, AND IT IS NOT THE SAME WALL AS THE EXPANSION'S.**
-- `expandWorkflow` refuses an unknown child when a run starts, which is correct and is too
-- late to be useful: the customer is gone and the answer is an execution that failed. This
-- one refuses while it is still somebody's form, where it can be fixed.
--
-- **IT IS IN THE TRANSACTION RATHER THAN IN THE ROUTE, and that is the reason it is SQL.**
-- A check outside the write can be raced — the child deleted between the check and the
-- insert — and this repository already says exactly that about agent ownership two
-- functions down. Here it is asked against rows this statement's own transaction can see.
--
-- **NOT FOUND AND NOT THIS AGENT'S ARE ONE ANSWER**, which is the same rule the run-time
-- lookup follows and for the same reason: naming the difference would tell a caller that
-- another account's automation exists.
--
-- **ONE STATED LIMIT: A DIRECT LOOP IS REFUSED AND AN INDIRECT ONE IS NOT.** `A runs A` is
-- visible from this row alone; `A runs B` and `B runs A` is a walk of the graph, and the
-- honest place for it is the expansion, which does it and refuses by name with the chain.
-- So a cycle longer than one is a failed EXECUTION rather than a refused save, and saying
-- so beats a half-check nobody can read the scope of.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.automation_calls(
  p_tenant   text,
  p_agent_id uuid,
  p_self     uuid,
  p_steps    jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid;
  v_step jsonb;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    return jsonb_build_object('ok', true);
  end if;
  for v_step in select * from jsonb_array_elements(p_steps) loop
    if v_step ->> 'type' is distinct from 'workflow' then continue; end if;
    -- A `runs` THAT IS NOT AN ID IS THE READER'S REFUSAL, NOT THIS ONE'S. The step's own
    -- field says an automation must be named; answering `no-child` here would send somebody
    -- looking for a missing automation when what is missing is the answer.
    begin
      v_id := (v_step ->> 'runs')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'no-child');
    end;
    if v_id = p_self then
      return jsonb_build_object('ok', false, 'error', 'runs-itself');
    end if;
    if not exists (
      select 1 from agent.automations
       where id = v_id and tenant_id = p_tenant and agent_id = p_agent_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'no-child');
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end; $$;

comment on function agent.automation_calls(text, uuid, uuid, jsonb) is
  'Every automation a workflow says it runs must be one of the SAME agent''s, and must not be itself. Asked in the transaction that writes the workflow, because a check outside it can be raced. A cycle longer than one is the expansion''s to find.';

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
  -- ⚠ **A NEW DEFAULTED PARAMETER GOES AFTER THE EXISTING ONES, and this cost a run to
  -- learn.** `p_inputs` was first written above `p_max`, which is where it belongs by
  -- meaning — and a positional call with ten arguments then bound its tenth, the CEILING,
  -- to `p_inputs`, so every such call passed an integer where a list of declarations goes
  -- and the row was refused by `automations_inputs_shaped`. Measured: thirty checks in the
  -- real-PostgreSQL suite went red, none of them about inputs. PostgREST always sends
  -- NAMED arguments, so the only callers that can be re-bound this way are psql and a
  -- test — which is exactly the set that would have been broken silently.
  p_max        integer default 20,
  p_inputs     jsonb default '[]'::jsonb
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

  -- ⚠ WHAT IT SAYS IT RUNS, before anything is written. A new automation cannot name
  -- ITSELF — it has no rows yet, so `p_id` names nothing — and passing it anyway is what
  -- makes the two call sites one shape rather than two.
  v_calls := agent.automation_calls(p_tenant, p_agent_id, p_id, p_steps);
  if (v_calls ->> 'ok')::boolean is not true then return v_calls; end if;

  -- THE ARITHMETIC, ONCE. A daily schedule gets its instant here; a manual one has
  -- none, and the constraint refuses a row that says otherwise.
  if p_schedule = 'daily' then
    v_next := agent.automation_next_at(p_at_local, p_zone, now());
  end if;

  insert into agent.automations
    (id, tenant_id, agent_id, name, enabled, schedule, at_local, zone, steps, inputs, next_run_at)
  values
    (p_id, p_tenant, p_agent_id, p_name, coalesce(p_enabled, true),
     coalesce(p_schedule, 'manual'), p_at_local, p_zone,
     coalesce(p_steps, '[]'::jsonb), coalesce(p_inputs, '[]'::jsonb), v_next)
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
  p_inputs   jsonb default '[]'::jsonb
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

  -- LOCKED, so the scheduler cannot advance `next_run_at` between this read and the
  -- write below and have its advance thrown away.
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
  -- `agent.save_memory` already follows one table over: a version says which WORKFLOW a
  -- parent copied in, so renaming an automation or moving its time must not move it. A
  -- parent's snapshot then stays honest across every edit that is not an edit of the work.
  v_ver := case when v_row.steps is distinct from coalesce(p_steps, '[]'::jsonb)
                then v_row.version + 1 else v_row.version end;

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
         inputs      = coalesce(p_inputs, '[]'::jsonb),
         version     = v_ver,
         next_run_at = v_next
   where id = p_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version,
                            'next_run_at', v_row.next_run_at);
end; $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 7. ACCEPTING AN EXECUTION — now with its input and its memories
--
-- The order is unchanged and is still the whole of the correctness; two steps are added
-- and both are between "may this start" and anything being written:
--
--   1. is this automation this tenant's?      → no  : `no-automation`
--   2. has this execution already been filed? → yes : the repeat, whatever the
--      (by its occurrence, or by its run id)         configuration says now
--   3. is the automation disabled?             → yes : `disabled`, nothing written
--   4. is its agent paused?                    → yes : `paused`,   nothing written
--   5. ⚠ is the input what this automation asks for? → no : named, nothing written
--   6. ⚠ what does this agent remember right now?    → the snapshot
--   7. insert the execution, on conflict do nothing
--   8. absorbed by a racing tick?              → yes : the repeat
--   9. the run, its log and its work row — and the executor
--
-- **THE INPUT IS CHECKED AFTER THE TWO "NOT NOW" ANSWERS, deliberately.** A paused agent
-- is the state a customer most needs to hear about, and it is true of the whole agent
-- rather than of this request; complaining about a field first would send them to fix the
-- wrong thing. Both refusals still write nothing at all, so the order costs nothing.
--
-- **AND IT IS CHECKED HERE RATHER THAN ONLY IN THE ROUTE.** The declaration is in the row
-- this function has already read, so the check is free — and "the route validates it" is
-- an argument about a caller, which is the kind this schema does not rest on.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists agent.accept_automation_run(text, uuid, uuid, text, date);

create or replace function agent.accept_automation_run(
  p_tenant        text,
  p_automation_id uuid,
  p_run_id        uuid,
  p_trigger       text,
  p_occurrence    date default null,
  p_input         jsonb default '{}'::jsonb
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
  if p_trigger is null or p_trigger not in ('manual', 'schedule') then
    raise exception 'accept_automation_run: a run is triggered manually or by a schedule';
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
      (id, automation_id, agent_id, tenant_id, trigger, occurrence, steps, zone, input, vars, memory)
    values
      (p_run_id, p_automation_id, v_agent, p_tenant, p_trigger, p_occurrence, v_steps, v_zone,
       v_given, v_vars, v_mem)
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

comment on function agent.accept_automation_run(text, uuid, uuid, text, date, jsonb) is
  'One transaction: accept an execution of an owned, enabled automation whose agent is active, snapshotting its steps, its input and its agent''s memories, and queue it for the automation executor. Idempotent per (automation, occurrence) AND per run id, so a derived identity makes a redelivery a repeat rather than an exception; every refusal writes nothing.';

-- ══════════════════════════════════════════════════════════════════════════
-- 8. ONE STEP DONE — the append and the progress, in one transaction
--
-- **THE FENCE IS `agent.append_entry`'S, UNCHANGED, and that is the whole design of this
-- function.** It appends first and touches the execution row only if the append was
-- accepted, so the five holder/token/lease checks exist exactly once in this schema. A
-- second function doing its own `select … for update` and its own five checks would be
-- the one wall that keeps two workers off one run, written twice.
--
-- ⚠ **PROGRESS MAY ONLY MOVE FORWARD, MEASURED TWO WAYS.** A stale advance — the same
-- worker's older call arriving late, or a retry replaying an entry `append_entry` answers
-- `already` for — would otherwise pull the position back and overwrite the outcome list
-- with a shorter one. So the update is guarded on the position AND on the number of
-- outcomes, both of which are monotone: a step's completion adds one outcome and moves the
-- position on, and a re-pause replaces one outcome in place. Equality is the retry and the
-- re-pause; less is stale and is refused.
--
-- **A PAUSE RELEASES THE WORK, and `done_at` is the honest column for it.** Its own note
-- says `done_at` is "nothing more to deliver" rather than "the run succeeded", and an
-- execution waiting until Tuesday has nothing to deliver until Tuesday. The alternative —
-- a new `not_before` column on the shared queue — would teach the sweeper about one
-- executor's business, and `agent.requeue_run` already means "ask for it again".
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.advance_automation_run(
  p_run_id   uuid,
  p_worker   text,
  p_token    uuid,
  p_entry    jsonb,
  p_position integer,
  p_vars     jsonb,
  p_outcomes jsonb,
  p_waiting  jsonb default null,
  -- ⚠ **THE TWO LOOP/RETRY PARAMETERS GO LAST, and this file already records why** (see
  -- `create_automation`'s own note): a defaulted parameter placed BEFORE an existing one
  -- silently re-binds every positional caller. They default to the empty object, so a
  -- caller written before loops existed behaves exactly as it did, and a workflow with no
  -- loop and no retry writes the same two empty objects it already holds.
  p_loops    jsonb default '{}'::jsonb,
  p_tries    jsonb default '{}'::jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_seq    integer;
  v_answer jsonb;
  v_exec   agent.automation_runs;
  v_until  timestamptz := null;
  v_moved  boolean := false;
  v_rel    boolean := null;
begin
  if p_entry is null or p_entry ->> 'kind' is distinct from 'step' then
    raise exception 'advance_automation_run: a step''s progress is recorded as a "step" entry';
  end if;
  if p_outcomes is null or jsonb_typeof(p_outcomes) <> 'array' then
    raise exception 'advance_automation_run: the outcomes must be a list, one per step attempted';
  end if;
  if p_vars is null or jsonb_typeof(p_vars) <> 'object' then
    raise exception 'advance_automation_run: the values must be an object of name to value';
  end if;
  if p_position is null or p_position < 0 then
    raise exception 'advance_automation_run: the position must be a whole number of steps';
  end if;
  if p_waiting is not null and (jsonb_typeof(p_waiting) <> 'object' or p_waiting ->> 'step' is null) then
    raise exception 'advance_automation_run: a pause has to say which step it is waiting at';
  end if;
  -- ⚠ CANNOT-TELL MUST NEVER READ AS A VALUE. A null loop state is not "no loops": it is a
  -- caller that did not say, and writing `{}` for it would tell the next delivery that a
  -- loop half way through its rounds is at its beginning.
  if p_loops is null or jsonb_typeof(p_loops) <> 'object' then
    raise exception 'advance_automation_run: the loop state must be an object of step id to progress';
  end if;
  if p_tries is null or jsonb_typeof(p_tries) <> 'object' then
    raise exception 'advance_automation_run: the attempt counts must be an object of step key to count';
  end if;

  -- THE POSITION IS READ RATHER THAN ASSUMED. "The started entry is at seq 0" is
  -- `accept_run`'s fact, and hardcoding a 1 here would be a second copy of it.
  select coalesce(max(seq) + 1, 0) into v_seq
    from agent.run_entries where run_id = p_run_id;

  v_answer := agent.append_entry(p_run_id, v_seq, p_entry, p_worker, p_token);

  -- REFUSED MEANS NOTHING ELSE HAPPENS, and the refusal is handed back under its own
  -- name so the caller can tell "the claim is gone" from "the journal is broken".
  if coalesce((v_answer -> 'ok')::boolean, false) is not true then
    return v_answer;
  end if;

  select * into v_exec from agent.automation_runs where id = p_run_id;
  if v_exec.id is null then
    -- AN ENTRY WITH NO EXECUTION RECORD. The append is already committed and honest —
    -- something appended to this run's log — but there is nothing here to advance, and
    -- saying so beats writing nothing and answering ok.
    return v_answer || jsonb_build_object('advanced', false, 'why', 'no-execution');
  end if;

  if p_waiting is not null then
    -- ⚠ **A RE-PAUSE KEEPS THE DEADLINE IT ALREADY HAS.** A spurious delivery before the
    -- time resolves `for 30 minutes` again from now, which would let a duplicate event
    -- extend a wait indefinitely — a duplicate doing harm, which is the one thing it must
    -- not do. So the instant is computed only when this execution is not already waiting
    -- at this very step.
    if v_exec.wait_until is not null and v_exec.waiting ->> 'step' = p_waiting ->> 'step' then
      v_until := v_exec.wait_until;
    elsif p_waiting ->> 'kind' = 'approval' then
      v_until := now() + make_interval(hours => greatest(1, (p_waiting ->> 'hours')::integer));
    elsif p_waiting ->> 'mode' = 'until' then
      -- THE ONLY TIME-ZONE ARITHMETIC IN THIS PRODUCT, reused rather than repeated. It
      -- raises for a zone PostgreSQL cannot use, which is what makes a bad zone a loud
      -- refusal instead of a wait that never ends.
      v_until := agent.automation_next_at(
        (p_waiting ->> 'at')::time, coalesce(v_exec.zone, 'UTC'), now());
    else
      v_until := now() + make_interval(mins => greatest(1, (p_waiting ->> 'minutes')::integer));
    end if;
  end if;

  update agent.automation_runs
     set position   = p_position,
         vars       = p_vars,
         outcomes   = p_outcomes,
         waiting    = p_waiting,
         wait_until = v_until,
         loops      = p_loops,
         tries      = p_tries
   where id = p_run_id
     and finished_at is null
     -- ⚠ **WHAT IS MONOTONIC IS THE NUMBER OF OUTCOMES, NOT THE POSITION — AND A LOOP IS
     -- WHAT PROVED IT.** This carried `position <= p_position` as well, on the reading that
     -- progress only ever moves forward. A `repeat` moves it BACKWARDS by design: round two
     -- re-enters the body below the high-water mark round one reached, so every checkpoint
     -- inside it failed this condition and was a silent no-op. MEASURED end to end, through
     -- this function: a two-round loop holding a wait recorded round one, advanced past the
     -- wait, jumped back, paused again — and the pause was never written, leaving the
     -- execution at the position after the wait with nothing waiting and nothing finished. A
     -- STRANDED RUN, and the answer was `ok: true, advanced: false`, which every caller read
     -- as "already recorded, a retry, and safe".
     --
     -- The outcome count IS monotonic and stays so with loops and retries both: a new round
     -- appends its own keys, and a retry overwrites the key it already has. So a stale call
     -- carrying fewer outcomes than the row holds is still refused, which is what this guard
     -- was ever for. **The position is no longer a progress measure at all** — it is where in
     -- the list the next step is — and the wall against a displaced worker is the FENCE, which
     -- `append_entry` above has already applied by the time this runs.
     and jsonb_array_length(outcomes) <= jsonb_array_length(p_outcomes);
  v_moved := found;

  -- THE RELEASE IS ASKED WHENEVER A PAUSE WAS ASKED FOR, including on a retry whose row
  -- update was a no-op: `release_run` is itself fenced and answers false when the claim is
  -- already gone, which is exactly what a retry of a pause that already landed should read.
  if p_waiting is not null then
    v_rel := agent.release_run(p_run_id, p_worker, p_token, true, null);
  end if;

  return v_answer || jsonb_build_object(
    'advanced', v_moved, 'position', p_position,
    'waiting', p_waiting is not null, 'wait_until', v_until, 'released', v_rel);
end; $$;

comment on function agent.advance_automation_run(uuid, text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'One transaction: record one workflow step''s outcome as a journal entry through the same fence every write goes through, move the execution''s position, values, loop state and attempt counts forward, and — for a pause — resolve its deadline and release the work. Progress may only move forward; a stale or retried call is a no-op.';

-- ══════════════════════════════════════════════════════════════════════════
-- 9. THE STOP — unchanged in shape, and now recording the final state too
--
-- ⚠ **THE FIVE-ARGUMENT SIGNATURE IS DROPPED.** The final position and values have to be
-- written with the stop, or an execution that finished would keep the position it had at
-- its last pause — and an overload that does not take them is a caller silently leaving
-- them behind.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb);

create or replace function agent.finish_automation_run(
  p_run_id   uuid,
  p_worker   text,
  p_token    uuid,
  p_outcomes jsonb,
  p_stop     jsonb,
  p_position integer default 0,
  p_vars     jsonb default '{}'::jsonb
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

  select coalesce(max(seq) + 1, 0) into v_seq
    from agent.run_entries where run_id = p_run_id;

  v_answer := agent.append_entry(
    p_run_id, v_seq,
    jsonb_build_object(
      'kind', 'stopped',
      'at',   (extract(epoch from clock_timestamp()) * 1000)::bigint,
      'stop', p_stop),
    p_worker, p_token);

  if coalesce((v_answer -> 'ok')::boolean, false) is not true then
    return v_answer;
  end if;

  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES.
  -- `append_entry` answers `already` for the same entry re-sent, and on that path the
  -- outcomes are already recorded; overwriting them would replace what really happened
  -- with a second computation of it.
  --
  -- ⚠ AND THE PAUSE IS CLEARED HERE, which is not tidying: a finished execution still
  -- carrying a `wait_until` is one the scheduler would re-queue every minute for ever, and
  -- `automation_runs_finished_is_not_waiting` refuses the row that would say so.
  update agent.automation_runs
     set outcomes    = p_outcomes,
         finished_at = now(),
         position    = greatest(position, coalesce(p_position, 0)),
         vars        = coalesce(p_vars, vars),
         waiting     = null,
         wait_until  = null
   where id = p_run_id and finished_at is null;

  perform agent.release_run(p_run_id, p_worker, p_token, true, null);

  return v_answer || jsonb_build_object('finished', true);
end; $$;

comment on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb, integer, jsonb) is
  'One transaction: record an automation execution''s step outcomes, its final values and its stop, through the same fence every journal write goes through, clear any pause, and release the work. Writes nothing at all if the fence refuses.';

-- ══════════════════════════════════════════════════════════════════════════
-- 10. AN APPROVAL IS ANSWERED — ownership enforced where the decision is WRITTEN
--
-- **THE TENANT IS IN THE FILTER, so another account's execution and one that does not
-- exist are the same answer.** That is the whole of approval ownership: the decision is a
-- row this account wrote about its own execution, and by the time the executor reads it
-- there is nothing left to check. Enforcing it in the executor instead would be checking a
-- fact after storing it.
--
-- ⚠ **A SECOND PRESS IS ABSORBED, NOT RE-DECIDED.** Two people pressing Approve, a double
-- click, a retried request: the FIRST decision stands and the answer says `repeat`. A
-- second write would let a rejection overwrite an approval the execution has already acted
-- on — and the execution may already have carried on, so there is nothing to change.
--
-- **AND AN ABSORBED PRESS STILL ASKS FOR THE RUN AGAIN.** A first press whose re-queue
-- failed left a decision nobody had been told about; the second press is the recovery, and
-- a duplicate re-queue is harmless by `claim_run`'s own property rather than by care here.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.decide_automation_approval(
  p_tenant  text,
  p_run_id  uuid,
  p_step    text,
  p_verdict text,
  p_note    text default null,
  p_by      text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_exec  agent.automation_runs;
  v_had   jsonb;
  v_state jsonb;
  v_one   jsonb;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'decide_automation_approval: tenant must be a non-empty string';
  end if;
  if p_verdict is null or p_verdict not in ('approved', 'rejected') then
    raise exception 'decide_automation_approval: a decision is "approved" or "rejected"';
  end if;
  if p_step is null or btrim(p_step) = '' then
    raise exception 'decide_automation_approval: say which step is being answered';
  end if;
  if p_note is not null and length(p_note) > 1000 then
    raise exception 'decide_automation_approval: that note is longer than a note can be';
  end if;

  -- LOCKED AND FILTERED IN ONE STATEMENT. Reading the row and then comparing the tenant in
  -- the caller is the same question asked somewhere that forgetting it still compiles.
  select * into v_exec from agent.automation_runs
   where id = p_run_id and tenant_id = p_tenant
     for update;
  if v_exec.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-execution');
  end if;
  if v_exec.finished_at is not null then
    return jsonb_build_object('ok', false, 'error', 'finished');
  end if;

  -- ⚠ IT MUST BE WAITING FOR AN APPROVAL, AT THIS STEP. A decision recorded against a
  -- step the execution is not at is a decision nothing will ever read — and a run that is
  -- working rather than waiting has nobody to answer.
  if v_exec.waiting is null
     or v_exec.waiting ->> 'kind' is distinct from 'approval'
     or v_exec.waiting ->> 'step' is distinct from p_step then
    return jsonb_build_object('ok', false, 'error', 'not-waiting',
      'waiting_for', v_exec.waiting -> 'step', 'kind', v_exec.waiting -> 'kind');
  end if;

  v_had := v_exec.decisions -> p_step;

  if v_had is null then
    v_one := jsonb_strip_nulls(jsonb_build_object(
      'verdict', p_verdict,
      'note',    nullif(btrim(coalesce(p_note, '')), ''),
      -- WHO ANSWERED. The account is the identity this schema has, so that is what is
      -- recorded; a name the caller supplied would be a claim rather than a fact.
      'by',      coalesce(p_by, p_tenant),
      'at',      to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    update agent.automation_runs
       set decisions = decisions || jsonb_build_object(p_step, v_one)
     where id = p_run_id and not (decisions ? p_step);
    -- A RACING SECOND PRESS. The `not (decisions ? p_step)` predicate is the authority and
    -- the read above is only the probe, so a loser re-reads what the winner wrote.
    if not found then
      select decisions -> p_step into v_had from agent.automation_runs where id = p_run_id;
    end if;
  end if;

  v_state := agent.requeue_run(p_run_id, p_tenant);

  return jsonb_build_object(
    'ok', true,
    'repeat', v_had is not null,
    'verdict', coalesce(v_had ->> 'verdict', p_verdict),
    'step', p_step,
    'queued', v_state ->> 'state');
end; $$;

comment on function agent.decide_automation_approval(text, uuid, text, text, text, text) is
  'Answer one waiting approval on this account''s own execution and put the work back on the queue. The first decision stands; a second press is absorbed and says so.';

-- ══════════════════════════════════════════════════════════════════════════
-- 11. WAITS WHOSE TIME HAS COME — the cron's second statement
--
-- **ONE STATEMENT FOR BOTH KINDS OF PAUSE, and that is not a shortcut.** A timed wait
-- whose deadline has passed and an approval nobody answered in time are the same fact
-- about this table — a suspended execution whose `wait_until` is behind now — and the
-- difference between them is what the STEP does when it resumes, which is the engine's
-- business. Two selectors here would be two chances to leave one kind behind.
--
-- **IT RE-QUEUES AND NEVER EXECUTES.** A cron tick is short and a resumed execution is
-- not, so the work goes back through the queue and is claimed by a consumer with a whole
-- invocation of its own — the rule `sweep_run_work` already follows.
--
-- **`agent.requeue_run` IS REUSED RATHER THAN REPEATED**, so "put this back on the queue"
-- has one definition — including its refusal to disturb a run somebody is already holding,
-- which answers `running` and is not rung.
--
-- ⚠ **AND THE PAUSE IS DELIBERATELY NOT CLEARED HERE.** The resumed worker reads it to
-- know what it was waiting for and whether the deadline really passed; clearing it would
-- leave the execution unable to tell a resume from a first arrival, and a spurious
-- delivery would then run the step again. It is cleared when the step completes.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.resume_due_automations(
  p_limit integer default 25
) returns setof jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row   record;
  v_state jsonb;
begin
  for v_row in
    select ar.id, ar.tenant_id,
           ar.waiting ->> 'kind' as kind,
           ar.waiting ->> 'step' as step,
           ar.wait_until
      from agent.automation_runs ar
     where ar.waiting is not null
       -- ⚠ **A DECLARED SECOND WALL, AND ITS MUTANT IS INERT BY CONSTRUCTION — measured, not
       -- reasoned about.** `automation_runs_finished_is_not_waiting` above forbids a row from
       -- being finished AND waiting, so `waiting is not null` already excludes every finished
       -- execution: on a real database, ZERO rows can ever satisfy both, and removing this line
       -- changes no answer. A SQL sweep survivor is what said so, and the check that should have
       -- caught it had never been in the state it described — the UPDATE that set `finished_at`
       -- on a waiting row was refused by that very constraint, and its query had always errored
       -- besides. So the SWEEP mutates the CONSTRAINT (observable: a refusal check goes red) and
       -- this line carries no mutant of its own, deliberately.
       --
       -- It stays because the two say different things: the constraint says the state cannot
       -- exist, this says the tick does not want it even if a future migration relaxes that.
       and ar.finished_at is null
       and ar.wait_until <= now()
     -- OLDEST FIRST, so a backlog is worked through in the order it built up rather than
     -- in whatever order the scan produced.
     order by ar.wait_until asc
     limit greatest(1, coalesce(p_limit, 25))
     -- TWO TICKS OVERLAPPING TAKE DIFFERENT ROWS. And a tick that somehow reached the same
     -- row re-queues a row that is already queued, which `claim_run` makes harmless.
     for update skip locked
  loop
    v_state := agent.requeue_run(v_row.id, v_row.tenant_id);
    return next jsonb_build_object(
      'run_id', v_row.id, 'kind', v_row.kind, 'step', v_row.step,
      'due_at', v_row.wait_until, 'action', v_state ->> 'state');
  end loop;
end; $$;

comment on function agent.resume_due_automations(integer) is
  'Put every suspended execution whose time has come back on the queue, answering one row per execution touched. The caller''s only job afterwards is to ring the doorbell for each one it says is queued.';

-- ══════════════════════════════════════════════════════════════════════════
-- 12. THE HISTORY VIEW CARRIES THE NEW STATE
--
-- ⚠ **THE NEW COLUMNS GO AT THE END, and Postgres requires it rather than preferring it:**
-- `create or replace view` may only APPEND columns. Tidying that order into something
-- prettier is a broken deploy.
--
-- **`vars` IS ON IT, and that is deliberate.** It holds the account's own inputs and its
-- own steps' answers — including retrieved excerpts of its own reference material — and
-- showing what a run actually used is the difference between a history and a list of
-- timestamps. `security_invoker` is what keeps it theirs.
-- ══════════════════════════════════════════════════════════════════════════

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
         r.stopped_at as run_stopped_at,
         -- ── appended by the workflow-progress migration ────────────────────
         ar.position,
         ar.vars,
         ar.input,
         ar.memory,
         ar.waiting,
         ar.wait_until,
         ar.decisions,
         ar.agent_id
    from agent.automation_runs ar
    join agent.runs r on r.id = ar.id;

comment on view agent.automation_history is
  'One execution with its run''s projected status and stop, how far it got, what it was given, what it has bound, and what it is waiting for. security_invoker, so a reader sees only their own account''s.';

-- ══════════════════════════════════════════════════════════════════════════
-- 13. TENANT ISOLATION FOR THE TWO NEW TABLES
--
-- The same posture as everything else in this schema, and the same stated limit: RLS
-- keyed on `agent.tenant_id()` protects the READ path a signed-in customer uses, and
-- `service_role` carries `BYPASSRLS`, so what protects one account from another on the
-- SERVER'S path is the tenant in the query filter and in every function's own check. Both
-- walls exist; only one of them is in the database.
--
-- **FAILS CLOSED THROUGH SQL'S OWN NULL SEMANTICS**: no claims, claims that will not
-- parse, and claims with no tenant all answer NULL, and `tenant_id = NULL` is NULL rather
-- than true, so the policy matches no rows.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.agent_knowledge enable row level security;
alter table agent.agent_knowledge force row level security;
alter table agent.agent_memory enable row level security;
alter table agent.agent_memory force row level security;

drop policy if exists agent_knowledge_own_tenant on agent.agent_knowledge;
create policy agent_knowledge_own_tenant on agent.agent_knowledge
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

drop policy if exists agent_memory_own_tenant on agent.agent_memory;
create policy agent_memory_own_tenant on agent.agent_memory
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

-- ── who may touch any of it ─────────────────────────────────────────────────
--
-- A CUSTOMER READS AND WRITES NOTHING DIRECTLY. Every change goes through a route that
-- verified their token, so `authenticated` gets SELECT and nothing else — and `anon` gets
-- nothing at all, revoked explicitly rather than left to the default.
grant select on agent.agent_knowledge, agent.agent_memory to authenticated, service_role;
grant insert, update, delete on agent.agent_knowledge to service_role;
grant insert, update, delete on agent.agent_memory to service_role;

revoke all on agent.agent_knowledge from anon;
revoke all on agent.agent_memory from anon;

-- ── the functions are the server's alone ────────────────────────────────────
--
-- EVERY ONE OF THEM TAKES THE TENANT AS AN ARGUMENT, and that is only safe because no
-- client role can execute them. The grant is the whole of what makes a tenant argument
-- acceptable, which is why the revoke comes first and names `public`.
--
-- ⚠ THE FOUR REDEFINED SIGNATURES NEED THEIR GRANTS AGAIN: dropping a function drops its
-- privileges with it, so a `create or replace` under a new signature starts with none. A
-- missing line here is a route answering `permission denied` for a function that exists.
revoke all on function agent.search_knowledge(text, uuid, text, integer) from public;
revoke all on function agent.agent_memory_snapshot(text, uuid) from public;
revoke all on function agent.agent_knowledge_touch() from public;
revoke all on function agent.agent_memory_touch() from public;
revoke all on function agent.automation_calls(text, uuid, uuid, jsonb) from public;
revoke all on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb) from public;
revoke all on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb) from public;
revoke all on function agent.accept_automation_run(text, uuid, uuid, text, date, jsonb) from public;
revoke all on function agent.advance_automation_run(uuid, text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb, integer, jsonb) from public;
revoke all on function agent.decide_automation_approval(text, uuid, text, text, text, text) from public;
revoke all on function agent.resume_due_automations(integer) from public;

grant execute on function agent.search_knowledge(text, uuid, text, integer) to service_role;
grant execute on function agent.agent_memory_snapshot(text, uuid) to service_role;
grant execute on function agent.automation_calls(text, uuid, uuid, jsonb) to service_role;
grant execute on function agent.create_automation(text, uuid, uuid, text, boolean, text, time, text, jsonb, integer, jsonb) to service_role;
grant execute on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb) to service_role;
grant execute on function agent.accept_automation_run(text, uuid, uuid, text, date, jsonb) to service_role;
grant execute on function agent.advance_automation_run(uuid, text, uuid, jsonb, integer, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function agent.finish_automation_run(uuid, text, uuid, jsonb, jsonb, integer, jsonb) to service_role;
grant execute on function agent.decide_automation_approval(text, uuid, text, text, text, text) to service_role;
grant execute on function agent.resume_due_automations(integer) to service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- 14. LOOPS, RETRIES AND SUBWORKFLOWS — the state the executor cannot hold
--
-- Every column here exists because the executor is SEVERAL DELIVERIES and the thing that
-- must survive between them cannot live in a process. Which time round a loop is on, how
-- many attempts a failing step has already had, and which automations were copied in: a
-- counter kept in memory gives every restart a fresh budget, and a loop that forgets its
-- iteration repeats work already done.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.automation_runs
  -- ⚠ WHICH TIME ROUND EVERY OPEN LOOP IS ON, and the list it is going through. Written on
  -- the SAME call as the position, because a position saved without its loop state is a
  -- restart that re-enters the body at an iteration it has already done.
  --
  -- `{"<the repeat's step id>": {"at": 2, "of": 5, "list": [...], "as": "who"}}`. The list is
  -- snapshotted when the loop opens — the same rule the steps follow at acceptance — because
  -- a loop re-reading its source each round would iterate something that changed under it.
  add column if not exists loops jsonb not null default '{}'::jsonb,

  -- ⚠ HOW MANY TIMES EACH STEP HAS ALREADY FAILED AND ARMED A RETRY, keyed exactly as an
  -- outcome is — so a step inside a loop has its own count PER ROUND. Round three failing is
  -- not evidence about round one and must not inherit its exhausted budget.
  --
  -- **THIS IS WHAT MAKES "bounded retries" TRUE UNDER INTERRUPTION.** A counter in the
  -- process would give every delivery a whole fresh budget: three tries would quietly
  -- become three tries a minute, for as long as the step kept failing.
  add column if not exists tries jsonb not null default '{}'::jsonb,

  -- ⚠ WHICH OTHER AUTOMATIONS WERE COPIED INTO THIS ONE, AND AT WHICH VERSION.
  -- `[{"id": "…", "version": 4}]` — the version snapshot, as a recorded fact rather than
  -- something to infer from timestamps. Empty for every execution that runs no subworkflow,
  -- which is every execution written before this column.
  add column if not exists uses jsonb not null default '[]'::jsonb;

alter table agent.automation_runs drop constraint if exists automation_runs_loops_shaped;
alter table agent.automation_runs add constraint automation_runs_loops_shaped check (
  jsonb_typeof(loops) = 'object' and jsonb_typeof(tries) = 'object' and jsonb_typeof(uses) = 'array'
);

-- ⚠ **AN AUTOMATION HAS A VERSION, AND IT MOVES ON A CHANGE OF STEPS AND NOTHING ELSE.**
--
-- A version says WHICH STEPS a run copied in. Renaming an automation, turning it off, or
-- moving its schedule changes nothing a parent execution would have run — so bumping on
-- those would make the recorded version say a run used something it did not, which is the
-- same defect the knowledge version already avoids by moving on the BODY and not the title.
alter table agent.automations
  add column if not exists version integer not null default 1;

-- ══════════════════════════════════════════════════════════════════════════
-- 15. WHICH AUTOMATIONS A PARENT MAY COPY IN
--
-- ⚠ **THE WALL IS THE AGENT, NOT ONLY THE ACCOUNT, and only saying so keeps them apart.**
-- A person is entitled to their whole account; an AGENT is entitled to its own. Both
-- automations of one owner share a tenant, so the tenant filter cannot tell them apart and
-- the agent id is the whole of that wall.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.automation_children(
  p_tenant   text,
  p_agent_id uuid
) returns jsonb
  language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'name', a.name, 'version', a.version,
           'steps', a.steps, 'inputs', a.inputs
         ) order by a.name), '[]'::jsonb)
    from agent.automations a
   where a.tenant_id = p_tenant and a.agent_id = p_agent_id;
$$;

comment on function agent.automation_children(text, uuid) is
  'Every automation of ONE agent, with the steps and version a parent would copy in. Scoped to the tenant AND the agent, because both automations of one owner share a tenant and only the agent id tells them apart.';

-- ══════════════════════════════════════════════════════════════════════════
-- 16. THE FLATTENED PLAN, WRITTEN ONCE, BY THE WORKER THAT HOLDS THE RUN
--
-- The expansion itself is the ENGINE's — a recursive walk with a depth bound and a cycle
-- refusal, written in one language and tested there rather than in two. This is where its
-- answer is persisted, and the FENCE is what makes it safe: the claim and its token, the
-- same pair every journal write presents.
--
-- ⚠ **IT MAY ONLY BE WRITTEN BEFORE THE FIRST STEP.** `position = 0` is the whole of that
-- guard: past it, replacing the step list would renumber outcomes that already exist and a
-- resume would re-enter somewhere else entirely. A later call is a no-op and says so.
--
-- **NO FLAG SAYS WHETHER IT HAS BEEN EXPANDED, and none is needed**: a flattened list holds
-- no `workflow` step, so the absence of one IS the flag, in the only place that can see it.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.set_automation_plan(
  p_run_id uuid,
  p_worker text,
  p_token  uuid,
  p_steps  jsonb,
  p_uses   jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_work agent.run_work;
  v_ok   boolean;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'set_automation_plan: the flattened steps must be a list';
  end if;
  if p_uses is null or jsonb_typeof(p_uses) <> 'array' then
    raise exception 'set_automation_plan: what was copied in must be a list';
  end if;

  -- THE SAME FENCE EVERY WRITE PRESENTS, and it is asked with the row LOCKED so a reclaim
  -- cannot land between the check and the update.
  select * into v_work from agent.run_work where run_id = p_run_id for update;
  if v_work.run_id is null then return jsonb_build_object('ok', false, 'error', 'no-work'); end if;
  if v_work.done_at is not null then return jsonb_build_object('ok', false, 'error', 'finished'); end if;
  if v_work.claimed_by is distinct from p_worker then
    return jsonb_build_object('ok', false, 'error', 'not-holder');
  end if;
  if v_work.claim_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'error', 'bad-token');
  end if;
  if v_work.lease_expires_at is null or v_work.lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'lease-expired');
  end if;

  update agent.automation_runs
     set steps = p_steps, uses = p_uses
   where id = p_run_id and finished_at is null and position = 0;
  v_ok := found;

  -- ⚠ NOT AN ERROR. A redelivery whose first attempt already expanded finds the plan
  -- written and the position moved, and carries on from the log — which is the ordinary
  -- case, not a fault. It is SAID rather than silent, because "the plan is mine" and "the
  -- plan was already set" are different things for an operator reading a log.
  return jsonb_build_object('ok', true, 'set', v_ok, 'steps', jsonb_array_length(p_steps));
end; $$;

comment on function agent.set_automation_plan(uuid, text, uuid, jsonb, jsonb) is
  'Persist a flattened workflow — its subworkflows copied in — and the versions that were copied, fenced by the caller''s own claim. Only before the first step: past that, replacing the list would renumber outcomes that already exist.';


revoke all on function agent.automation_children(text, uuid) from public;
revoke all on function agent.set_automation_plan(uuid, text, uuid, jsonb, jsonb) from public;

grant execute on function agent.automation_children(text, uuid) to service_role;
grant execute on function agent.set_automation_plan(uuid, text, uuid, jsonb, jsonb) to service_role;
