-- ════════════════════════════════════════════════════════════════════════════
-- PARALLEL DELEGATION — a parent hands bounded tasks to specialist agents of the
-- SAME account, and they run concurrently through the queue that already exists.
--
-- ── WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT TOUCH ─────────────────
--
-- `agent.runs`, `agent.run_work`, `agent.run_entries` and `agent.automation_runs`
-- are UNCHANGED. A child is an ordinary agent run: `agent.accept_run` files it,
-- an ordinary consumer claims it, `agent.append_entry` fences its journal, and
-- `agent.sweep_run_work` reclaims it if its worker dies. Delegation is therefore
-- not a second execution engine — it is a LINK between runs, plus the bounds on
-- how many such links a task tree may make.
--
-- ⚠ **THE PARENT DOES NOT HOLD AN OPEN REQUEST, AND THAT NEEDS NO NEW COLUMN.**
-- The parent's work row is RELEASED the moment its children are filed
-- (`agent.release_run`, the function that already means "nothing more to
-- deliver"). "This parent is waiting" is then DERIVED — it has delegations that
-- are not settled — rather than stored, so there is no flag that can disagree
-- with the rows it is about. The parent is woken by `agent.requeue_run`, which
-- already refuses to disturb a run somebody is holding.
--
-- ⚠ **AND A STUCK CHILD CANNOT STRAND A PARENT.** Every delegation carries its
-- own deadline. `agent.sweep_delegations` is the cron's third statement: past the
-- deadline a child reads `unresolved` and the parent is put back on the queue to
-- decide what that adds up to. Which is the whole point — MISSING WORK IS NEVER
-- SUCCESS, and a parent that waits for ever is one nobody can tell from a parent
-- that is working.
-- ════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- 1. THE TASK TREE — the counters a whole tree shares
--
-- **ONE ROW PER ROOT RUN, and the root is whichever run nobody delegated to.**
-- A tree-wide bound cannot live on a parent, because a parent two levels down
-- knows nothing about its siblings' spending; and it cannot be computed by
-- walking the links on every check, because that is a recursive query per
-- delegation and it races with the delegation being written.
--
-- ⚠ **`children_made` ONLY EVER GOES UP.** It counts children CREATED, not
-- children outstanding, which is what makes it a budget rather than a gauge: a
-- tree that made thirty children and finished them has still spent thirty, and a
-- counter that came back down would let a loop delegate for ever.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agent.task_trees (
  root_run_id   uuid primary key references agent.runs(id) on delete cascade,
  tenant_id     text        not null check (length(tenant_id) between 1 and 200),

  children_made integer     not null default 0 check (children_made >= 0),
  spent_micros  bigint      not null default 0 check (spent_micros >= 0),

  -- The bounds this tree runs under, recorded at the root so every later check
  -- reads the SAME numbers. Taking them from each caller would let a child widen
  -- what its own parent was bounded by.
  bounds        jsonb       not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint task_trees_bounds_shaped check (jsonb_typeof(bounds) = 'object')
);

comment on table agent.task_trees is
  'The counters one task tree shares: how many children it has created and what it has spent, against the bounds recorded at its root. children_made only ever rises, so it is a budget rather than a gauge.';

-- ══════════════════════════════════════════════════════════════════════════
-- 2. THE DELEGATIONS — one row per child, and the link is the row
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agent.delegations (
  id            uuid primary key,
  tenant_id     text        not null check (length(tenant_id) between 1 and 200),

  -- WHO ASKED, WHO ROOTED THE TREE, AND HOW DEEP THIS IS.
  parent_run_id uuid        not null references agent.runs(id) on delete cascade,
  root_run_id   uuid        not null references agent.runs(id) on delete cascade,
  depth         integer     not null check (depth >= 0 and depth <= 16),

  -- WHICH SPECIALIST, and it must be one of this account's own agents. The
  -- foreign key is the wall; the tenant in the filter is the other half.
  agent_id      uuid        not null references agent.agents(id) on delete cascade,

  -- WHERE IN THE PARENT THIS CAME FROM, and the child's position in the batch.
  -- ⚠ **THE POSITION IS THE IDENTITY A RESULT IS COMBINED BY**, never completion
  -- order, so it is stored rather than inferred from insertion.
  step          text        not null check (length(btrim(step)) between 1 and 64),
  idx           integer     not null check (idx >= 0),

  -- ⚠ THE RECORDED CONFIGURATION — what this child was told and allowed, as it
  -- was at the moment it was asked. A snapshot rather than a join, for the reason
  -- every snapshot in this schema exists: editing the specialist afterwards must
  -- not change what a child that already ran was permitted to do.
  task          text        not null check (length(btrim(task)) between 1 and 4000),
  context       jsonb       not null default '[]'::jsonb,
  tools         text[]      not null default '{}',
  limits        jsonb       not null default '{}'::jsonb,

  -- THE CHILD'S OWN RUN. Nullable for exactly as long as one statement: the row
  -- and the run are created in the same transaction, and a delegation whose run
  -- could not be filed is refused whole rather than left half-written.
  child_run_id  uuid        unique references agent.runs(id) on delete set null,

  -- ⚠ WHEN IT STOPS BEING WORTH WAITING FOR. Past this a child reads
  -- `unresolved`, which no policy counts as delivered.
  deadline_at   timestamptz not null,

  created_at    timestamptz not null default now(),

  -- ⚠ WHEN THIS CHILD WAS LET START, which is what makes `concurrency` a bound
  -- rather than a number in a comment. A batch wider than the bound files every
  -- child here and lets only the first few go; the rest wait their turn with
  -- `admitted_at` null, and `settle_delegation` admits the next as one finishes.
  --
  -- **A CHILD WAITING ITS TURN READS `queued`**, which is honest — it has not
  -- started — and is why no new child state was invented for it. A screen that
  -- wants to say "waiting its turn" has this column to say it from.
  admitted_at   timestamptz,

  claimed_at    timestamptz,
  settled_at    timestamptz,
  cancelled_at  timestamptz,

  -- ⚠ **A WAKE WE TRIED TO SEND AND COULD NOT.** The last child to settle rings
  -- the parent through `agent.requeue_run`, which refuses to disturb a run
  -- somebody is HOLDING — and the parent is held for as long as it takes its own
  -- delivery to finish writing the rest of its batch and let go. So a fast child
  -- can answer into that window and the wake is lost, with nothing else ever
  -- waking the parent: the sweep's overdue arm cannot see it, because every one
  -- of its children has settled.
  --
  -- Recorded as a FACT rather than inferred later — "we rang and it was held" —
  -- and cleared by the sweep once the ring lands, so it fires once per lost wake
  -- rather than once a minute for ever.
  wake_lost     boolean     not null default false,

  -- `{ok: true, result} | {ok: false, error}`. Written ONCE.
  outcome       jsonb,

  constraint delegations_context_shaped check (jsonb_typeof(context) = 'array'),
  constraint delegations_limits_shaped  check (jsonb_typeof(limits) = 'object'),
  -- A settled delegation has an outcome and an outcome belongs to a settled one:
  -- either half alone is a row no reader can classify.
  constraint delegations_settled_is_whole check (
    (settled_at is null and outcome is null)
    or (settled_at is not null and outcome is not null and jsonb_typeof(outcome) = 'object')
  )
);

-- ⚠ **THE RETRY IDENTITY, AND IT IS THE WHOLE OF "duplicate deliveries must not
-- create duplicate children".** A parent asking again for the same step and the
-- same position is the same request, whatever id the caller minted — so the
-- second insert meets this index and is absorbed rather than making a twin.
create unique index if not exists delegations_one_per_slot
  on agent.delegations (parent_run_id, step, idx);

-- What the parent's own wait reads: its outstanding children.
create index if not exists delegations_by_parent
  on agent.delegations (parent_run_id, idx asc);

-- What the sweep reads: a child past its deadline that nothing has settled.
create index if not exists delegations_overdue
  on agent.delegations (deadline_at)
  where settled_at is null and cancelled_at is null;

-- What a tree-wide count reads.
create index if not exists delegations_by_root
  on agent.delegations (root_run_id);

-- What the sweep's SECOND arm reads: a wake that was rung and refused.
create index if not exists delegations_wake_lost
  on agent.delegations (parent_run_id)
  where wake_lost;

comment on table agent.delegations is
  'One delegated child: which specialist, what it was told, what it was allowed, which run carries it, and what became of it. Unique per (parent, step, position), so a redelivered request is absorbed rather than making a second child.';
comment on column agent.delegations.tools is
  'The tools this child was allowed, as narrowed when it was asked: the specialist''s own, intersected with what this delegation granted, minus anything revoked. A snapshot, so a later grant cannot widen a child already running.';

-- ══════════════════════════════════════════════════════════════════════════
-- 3. ASKING — one transaction: the bounds, the rows, the child runs, the release
--
-- ⚠ **THE NARROWING IS DONE HERE, AND THAT IS WHY IT IS A WALL.** The engine's
-- `narrowDelegatedTools` computes the same intersection, and the two are NOT a
-- duplicated rule: the engine's answer is what the parent is TOLD it may grant
-- and what was withheld, and this one is what a child can actually hold. A check
-- outside the write can be raced — a revocation landing between the check and the
-- insert — and this repository already says exactly that about agent ownership.
-- So the caller's `tools` is a REQUEST, and what is stored is
--
--     the specialist's own  ∩  what was asked  −  anything revoked
--
-- computed against rows this statement's own transaction can see. There is no
-- branch that adds a name, which is what makes "delegation cannot bypass
-- revocations" a property of the schema rather than a promise about a caller.
--
-- ⚠ **THE CHILD RUN IDS ARE THE CALLER'S, AND THEY MUST BE DERIVED RATHER THAN
-- RANDOM.** `run_automation` already does this: a redelivery that mints a fresh
-- id asks for a second child, and one that derives its id from (parent, step,
-- position) asks for the child it already made. The unique index below is what
-- absorbs the second ask either way, but a derived id is what makes the ANSWER
-- the same both times.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.delegate_children(
  p_tenant    text,
  p_parent    uuid,
  p_step      text,
  p_children  jsonb,
  p_bounds    jsonb default '{}'::jsonb,
  p_wait_ms   integer default 900000,
  -- ⚠ **THE PARENT'S OWN CLAIM, SO THE RELEASE IS IN THIS TRANSACTION.** Filing the
  -- children and letting go of the parent must not be two statements: between them
  -- the children exist and the parent is still holding its work, and if the last
  -- child settled in that window `agent.requeue_run` would find the parent HELD,
  -- refuse to disturb it, and the wake would be lost — the parent would wait for
  -- ever on children that had all answered. MEASURED by driving this function
  -- before the release existed: the wake answered `running` and did nothing.
  --
  -- Optional, because a caller that means to keep the claim (it has more to do
  -- before it waits) passes neither — and a release is FENCED, so a token that
  -- does not match releases nothing rather than releasing somebody else's work.
  p_worker    text default null,
  p_token     uuid default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_parent   agent.runs%rowtype;
  v_root     uuid;
  v_depth    integer;
  v_tree     agent.task_trees%rowtype;
  v_bounds   jsonb;
  v_asked    integer;
  v_made     integer := 0;
  v_absorbed integer := 0;
  v_c        jsonb;
  v_i        integer;
  v_agent    agent.agents%rowtype;
  v_allowed  text[];
  v_entry    jsonb;
  v_child    uuid;
  v_deleg    uuid;
  v_out      jsonb := jsonb_build_array();
  v_dead     timestamptz;
  v_freed    boolean := null;
  v_conc     integer;
  v_admit    boolean;
  v_running  integer := 0;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'delegate_children: tenant must be a non-empty string';
  end if;
  if p_step is null or btrim(p_step) = '' then
    raise exception 'delegate_children: say which step is delegating';
  end if;
  if p_children is null or jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) = 0 then
    -- NOTHING ASKED IS NOT AN EMPTY SUCCESS. A step that delegated to nobody has
    -- not delegated, and answering ok here would let it read as every child having
    -- delivered — the one reading this whole feature exists to prevent.
    return jsonb_build_object('ok', false, 'error', 'nothing-asked');
  end if;
  v_asked := jsonb_array_length(p_children);

  -- ── whose parent is this, and is it still going ───────────────────────────
  -- LOCKED, so a cancellation cannot land between this read and the inserts below
  -- and leave children filed under a parent that has already stopped.
  select * into v_parent from agent.runs
   where id = p_parent and tenant_id = p_tenant
     for update;
  if v_parent.id is null then
    -- Another account's run and one that does not exist are ONE answer, which is
    -- the rule every other lookup in this schema follows: the difference between
    -- them is information.
    return jsonb_build_object('ok', false, 'error', 'no-parent');
  end if;
  if v_parent.status = 'stopped' then
    return jsonb_build_object('ok', false, 'error', 'parent-stopped');
  end if;

  -- ── where in the tree this is ─────────────────────────────────────────────
  -- ONE HOP, NOT A RECURSIVE WALK. A parent that is itself a child carries its own
  -- root and depth, so the root is reached in one read however deep the tree is.
  select d.root_run_id, d.depth + 1 into v_root, v_depth
    from agent.delegations d where d.child_run_id = p_parent;
  if v_root is null then
    v_root := p_parent;
    v_depth := 0;
  end if;

  -- ── the tree's own counters, and the bounds recorded at its root ──────────
  -- ⚠ FIRST WRITER WINS ON THE BOUNDS. They are recorded once, at the root, so a
  -- child cannot hand in wider bounds than the tree it belongs to was started
  -- with — which is the whole reason they live here rather than in each call.
  insert into agent.task_trees (root_run_id, tenant_id, bounds)
  values (v_root, p_tenant, coalesce(p_bounds, '{}'::jsonb))
  on conflict (root_run_id) do nothing;

  select * into v_tree from agent.task_trees
   where root_run_id = v_root and tenant_id = p_tenant
     for update;
  if v_tree.root_run_id is null then
    return jsonb_build_object('ok', false, 'error', 'no-tree');
  end if;
  v_bounds := v_tree.bounds;

  -- ── the bounds, each refusal naming itself ────────────────────────────────
  -- Defaults live in ONE place — the engine's `DELEGATION_DEFAULTS` — and arrive
  -- in `bounds`. A bound this cannot read falls back to a conservative number
  -- rather than to no bound at all: an unreadable ceiling must never read as
  -- permission.
  if v_depth >= coalesce((v_bounds ->> 'depth')::integer, 2) then
    return jsonb_build_object('ok', false, 'error', 'too-deep',
      'depth', v_depth, 'limit', coalesce((v_bounds ->> 'depth')::integer, 2));
  end if;
  if v_asked > coalesce((v_bounds ->> 'children')::integer, 8) then
    return jsonb_build_object('ok', false, 'error', 'too-many-children',
      'asked', v_asked, 'limit', coalesce((v_bounds ->> 'children')::integer, 8));
  end if;
  if v_tree.children_made + v_asked > coalesce((v_bounds ->> 'treeChildren')::integer, 32) then
    return jsonb_build_object('ok', false, 'error', 'tree-full',
      'held', v_tree.children_made, 'asked', v_asked,
      'limit', coalesce((v_bounds ->> 'treeChildren')::integer, 32));
  end if;

  -- ⚠ **HOW MANY MAY BE MOVING AT ONCE, AND IT IS A STAGGER RATHER THAN A
  -- REFUSAL.** Asking for eight with a bound of four is a legitimate ask — the
  -- whole point of the bound is that they run four at a time — so a batch wider
  -- than it is filed WHOLE and let go of a few at a time. Refusing here would
  -- make the two defaults (`children` 8, `concurrency` 4) contradict each other.
  --
  -- At or above the batch every child is admitted at once, so a delegation that
  -- fits behaves byte for byte as one filed before this bound existed.
  v_conc := greatest(1, coalesce((v_bounds ->> 'concurrency')::integer, 4));

  -- ⚠ **ONE DEADLINE, AND IT IS THE PARENT'S PATIENCE RATHER THAN EACH CHILD'S
  -- TURN.** It does NOT move when a deferred child is admitted, which is a
  -- stated trade: asking for more children than the concurrency bound can finish
  -- inside `wait_ms` means some read `unresolved`, and that is TRUE — nobody
  -- knows what they would have produced — and it is said rather than the wait
  -- being silently extended a wave at a time.
  v_dead := now() + make_interval(secs => greatest(1, coalesce(p_wait_ms, 900000)) / 1000.0);

  -- ── one child at a time ──────────────────────────────────────────────────
  for v_i in 0 .. v_asked - 1 loop
    v_c := p_children -> v_i;
    if v_c is null or jsonb_typeof(v_c) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'bad-child', 'at', v_i);
    end if;
    if (v_c ->> 'run_id') is null or (v_c ->> 'id') is null then
      -- The ids are the caller's and must be DERIVED from the slot, or a
      -- redelivery makes a twin. Refused rather than minted here, because a
      -- server-minted id is a fresh one on every delivery by construction.
      return jsonb_build_object('ok', false, 'error', 'no-ids', 'at', v_i);
    end if;

    -- WHICH SPECIALIST, and it must be this account's own and taking work.
    select * into v_agent from agent.agents
     where id = (v_c ->> 'agent_id')::uuid and tenant_id = p_tenant;
    if v_agent.id is null then
      return jsonb_build_object('ok', false, 'error', 'no-specialist', 'at', v_i);
    end if;
    if v_agent.status is distinct from 'active' then
      -- A PAUSED SPECIALIST IS "not now", not a fault — the same answer
      -- `accept_automation_run` gives, and for the same reason.
      return jsonb_build_object('ok', false, 'error', 'specialist-paused',
        'at', v_i, 'status', v_agent.status);
    end if;

    -- ⚠ THE NARROWING, IN THE TRANSACTION. Nothing a caller sends can widen this.
    select coalesce(array_agg(t.name order by t.ord), '{}')
      into v_allowed
      from (
        select a.name, a.ord from unnest(v_agent.tools) with ordinality as a(name, ord)
      ) t
     where t.name = any (
             select jsonb_array_elements_text(coalesce(v_c -> 'tools', '[]'::jsonb))
           )
       and not exists (
             select 1 from agent.tool_revocations r
              where r.tenant_id = p_tenant and r.agent_id = v_agent.id and r.tool = t.name
           );

    -- ⚠ **THE LINK IS WRITTEN AFTER THE RUN EXISTS, BECAUSE THE FOREIGN KEY SAYS
    -- SO** — the same order `send_to_agent` takes, and found here by driving this
    -- function rather than by reading it: inserting the row with its
    -- `child_run_id` already set refuses, because `agent.runs` has no such row yet.
    --
    -- **THE SLOT IS CLAIMED FIRST ALL THE SAME.** The unique index is on
    -- (parent, step, position) and not on the child run, so this insert is still
    -- the atomic claim — and only its WINNER goes on to file a run. A loser that
    -- had already created one would leave an orphan run in the queue, which is
    -- the whole reason the column is nullable for exactly these two statements.
    -- ⚠ **THE POSITION DECIDES WHO STARTS, NOT THE ORDER THEY WERE WRITTEN IN.**
    -- A redelivery re-runs this loop over the same positions, so admission has to
    -- be a function of `idx` and the bound alone — anything counted as the loop
    -- goes would admit a different set on a second delivery.
    v_admit := v_i < v_conc;

    insert into agent.delegations (
      id, tenant_id, parent_run_id, root_run_id, depth, agent_id,
      step, idx, task, context, tools, limits, child_run_id, deadline_at,
      admitted_at)
    values (
      (v_c ->> 'id')::uuid, p_tenant, p_parent, v_root, v_depth, v_agent.id,
      btrim(p_step), v_i, v_c ->> 'task',
      coalesce(v_c -> 'context', '[]'::jsonb), v_allowed,
      coalesce(v_c -> 'limits', '{}'::jsonb), null, v_dead,
      case when v_admit then now() else null end)
    on conflict (parent_run_id, step, idx) do nothing
    returning id into v_deleg;

    if v_deleg is null then
      -- ABSORBED: this slot already has a child. Read it back, so the answer is
      -- the same on the second delivery as on the first.
      v_absorbed := v_absorbed + 1;
      select id, child_run_id, admitted_at is not null
        into v_deleg, v_child, v_admit
        from agent.delegations
       where parent_run_id = p_parent and step = btrim(p_step) and idx = v_i;
    else
      v_made := v_made + 1;
      v_child := (v_c ->> 'run_id')::uuid;
      -- ⚠ THE CHILD'S RECORDED CONFIGURATION RIDES IN ITS OWN FIRST JOURNAL
      -- ENTRY, which is append-only and fenced. So what a child was told and
      -- allowed is readable from the child's own log rather than only from a row
      -- somebody could later update.
      v_entry := jsonb_build_object(
        'kind',   'started',
        'at',     (extract(epoch from clock_timestamp()) * 1000)::bigint,
        'tenant', p_tenant,
        'prompt', v_c ->> 'task',
        'instructions', v_agent.instructions,
        'tools',  to_jsonb(v_allowed),
        'authoredAgent', v_agent.id,
        'delegatedBy', p_parent,
        'delegation', v_deleg,
        'depth',  v_depth,
        'context', coalesce(v_c -> 'context', '[]'::jsonb));
      perform agent.accept_run(v_child, p_tenant, v_entry, 'start');
      -- NOW the run exists, so the link may be written.
      update agent.delegations set child_run_id = v_child where id = v_deleg;

      if not v_admit then
        -- ⚠ **HELD BACK THROUGH `done_at`, THE COLUMN THAT ALREADY MEANS THIS.**
        -- Its own note reads "nothing more to deliver" rather than "the run
        -- succeeded", which is exactly a child that has been filed and has not
        -- been let start; `agent.requeue_run` clears it, so admitting one later
        -- is the same statement a person pressing "try again" makes. The RUN and
        -- its recorded configuration exist either way, so a deferred child is
        -- readable from its own log the moment it is filed.
        update agent.run_work set done_at = now() where run_id = v_child;
      end if;
    end if;

    if v_admit then v_running := v_running + 1; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'idx', v_i, 'delegation', v_deleg, 'run_id', v_child,
      'agent_id', v_agent.id, 'tools', to_jsonb(v_allowed),
      'admitted', v_admit));
    v_deleg := null; v_child := null; v_admit := null;
  end loop;

  update agent.task_trees
     set children_made = children_made + v_made, updated_at = now()
   where root_run_id = v_root;

  -- ── the parent lets go ────────────────────────────────────────────────────
  -- `done_at` IS THE HONEST COLUMN, and its own note says why: it means "nothing
  -- more to deliver" rather than "the run succeeded", and a parent whose children
  -- are working has nothing to deliver until they answer. The same reading a
  -- workflow pause already takes.
  if p_worker is not null and p_token is not null then
    v_freed := agent.release_run(p_parent, p_worker, p_token, true, null);
  end if;

  return jsonb_build_object(
    'ok', true, 'root', v_root, 'depth', v_depth, 'step', btrim(p_step),
    'made', v_made, 'absorbed', v_absorbed, 'deadline_at', v_dead,
    -- SAID, because a caller that asked for eight and sees four moving must be
    -- able to tell a bound holding the rest back from four children that failed.
    'concurrency', v_conc, 'running', v_running,
    -- ⚠ SAID RATHER THAN ASSUMED. `null` is "no claim was handed in", `false` is
    -- "the claim did not match" — and a caller that meant to let go and did not is
    -- one whose parent will never be woken, so it must be able to tell.
    'parent_released', v_freed,
    'children', v_out);
end; $$;

comment on function agent.delegate_children(text, uuid, text, jsonb, jsonb, integer, text, uuid) is
  'One transaction: bound a task tree, file one child run per delegated task with its tools narrowed against the specialist''s own and the account''s revocations, and record what each child was told. Absorbs a redelivered ask per (parent, step, position) rather than making a second child.';

-- ══════════════════════════════════════════════════════════════════════════
-- 4. ANSWERING — recorded once, and the last one wakes the parent
--
-- ⚠ **FENCED BY THE CHILD'S OWN CLAIM**, the same five checks every write in this
-- schema presents. A displaced worker whose lease has gone may not record an
-- outcome for a child somebody else is now running.
--
-- ⚠ **`where settled_at is null` IS THE WHOLE OF "a duplicate must not count a
-- result twice".** The first answer stands; a redelivery answers `repeat` and
-- writes nothing, so a child cannot be counted as two deliveries.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.settle_delegation(
  p_child   uuid,
  p_worker  text,
  p_token   uuid,
  p_outcome jsonb
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_work  agent.run_work%rowtype;
  v_del   agent.delegations%rowtype;
  v_live  integer;
  v_state jsonb;
  v_first boolean := false;
  v_next  agent.delegations%rowtype;
  v_woke  jsonb;
begin
  if p_outcome is null or jsonb_typeof(p_outcome) <> 'object'
     or (p_outcome -> 'ok') is null or jsonb_typeof(p_outcome -> 'ok') <> 'boolean' then
    -- ⚠ `ok` MUST BE THE BOOLEAN. `"false"` is truthy, so a coercing reader would
    -- record a failed specialist as having delivered — the one direction that
    -- breaks "missing work is never success".
    raise exception 'settle_delegation: an outcome must carry ok as true or false';
  end if;

  select * into v_del from agent.delegations where child_run_id = p_child for update;
  if v_del.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-delegation');
  end if;

  select * into v_work from agent.run_work where run_id = p_child for update;
  if v_work.run_id is null then return jsonb_build_object('ok', false, 'error', 'no-work'); end if;
  if v_work.claimed_by is distinct from p_worker then
    return jsonb_build_object('ok', false, 'error', 'not-holder');
  end if;
  if v_work.claim_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'error', 'bad-token');
  end if;
  if v_work.lease_expires_at is null or v_work.lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'lease-expired');
  end if;

  if v_del.settled_at is null and v_del.cancelled_at is null then
    update agent.delegations
       set settled_at = now(), outcome = p_outcome
     where id = v_del.id and settled_at is null and cancelled_at is null;
    v_first := found;
  end if;

  -- ── one finishes, so the next one waiting its turn may start ──────────────
  -- ⚠ **BY POSITION, AND ONLY EVER ONE.** This is what keeps `concurrency` a
  -- bound over time rather than only at the moment of delegation: a wave of four
  -- becomes four again as each answers. Admitting every waiting child here would
  -- make the bound hold once and then not at all.
  --
  -- `agent.requeue_run` clears the `done_at` that held it, which is the same
  -- statement a person pressing "try again" makes — so a deferred child starts
  -- through the door every other queued run starts through, and a duplicate ring
  -- is harmless by `claim_run`'s own property.
  if v_first then
    select * into v_next from agent.delegations d
     where d.parent_run_id = v_del.parent_run_id
       and d.step = v_del.step
       and d.admitted_at is null
       and d.settled_at is null and d.cancelled_at is null
     order by d.idx asc
     limit 1
     for update;
    if v_next.id is not null then
      update agent.delegations set admitted_at = now() where id = v_next.id;
      if v_next.child_run_id is not null then
        v_woke := agent.requeue_run(v_next.child_run_id, v_del.tenant_id);
      end if;
    end if;
  end if;

  -- ── is anything of this parent's still outstanding ────────────────────────
  -- Counted rather than decremented, because a counter and the rows it is about
  -- are two things that can disagree, and the rows are the ones that matter.
  -- ⚠ AN OVERDUE CHILD IS NOT LIVE. Past its deadline it reads `unresolved`, and
  -- keeping it "live" here is exactly how a parent waits for ever.
  -- ⚠ A CHILD WAITING ITS TURN IS OUTSTANDING, which this counts because it is
  -- unsettled and inside its deadline — so a parent is not woken part way through
  -- a staggered batch.
  select count(*) into v_live from agent.delegations d
   where d.parent_run_id = v_del.parent_run_id
     and d.step = v_del.step
     and d.settled_at is null and d.cancelled_at is null
     and d.deadline_at > now();

  if v_live = 0 then
    -- ⚠ **A DUPLICATE RING IS HARMLESS BY `claim_run`'S OWN PROPERTY**, not by care
    -- here — which is why two siblings settling at once may both reach this line.
    v_state := agent.requeue_run(v_del.parent_run_id, v_del.tenant_id);
    -- ⚠ **AND A RING THAT WAS REFUSED IS RECORDED RATHER THAN LOST.** The parent
    -- is HELD until its own delivery finishes writing the rest of its batch and
    -- lets go, so a fast child can answer inside that window and `requeue_run`
    -- correctly declines to disturb a run somebody is working on. Nothing else
    -- would ever wake it: the sweep's overdue arm cannot see a parent all of
    -- whose children have settled. The flag is what the sweep's second arm reads.
    if v_state ->> 'state' = 'running' then
      update agent.delegations set wake_lost = true where id = v_del.id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'repeat', not v_first, 'delegation', v_del.id,
    'parent', v_del.parent_run_id, 'step', v_del.step, 'idx', v_del.idx,
    'outstanding', v_live, 'parent_queued', v_state ->> 'state',
    -- SAID, so the caller can ring the child it just let start rather than
    -- leaving it to the next cron tick.
    'admitted', v_next.child_run_id, 'admitted_idx', v_next.idx,
    'admitted_queued', v_woke ->> 'state');
end; $$;

comment on function agent.settle_delegation(uuid, text, uuid, jsonb) is
  'Record one child''s outcome, fenced by its own claim, and put the parent back on the queue once nothing of that step is outstanding. The first answer stands; a redelivery says repeat and writes nothing.';

-- ══════════════════════════════════════════════════════════════════════════
-- 5. CANCELLING — stop new work, propagate, and say what had already run
--
-- ⚠ **NOTHING ALREADY DONE IS UNDONE, AND THE COUNTS ARE HOW THAT IS SAID.**
-- `agent.cancel_run` answers how far each child got; those answers are carried
-- out of here rather than summarised away, because "we stopped it" and "here is
-- what it had already done" are different facts and a customer needs both.
--
-- **NEW CHILD WORK STOPS BY CONSTRUCTION**: `delegate_children` refuses under a
-- stopped parent, so cancelling the parent closes the door before this runs.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.cancel_delegations(
  p_tenant text,
  p_parent uuid,
  p_by     text,
  p_reason text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row     record;
  v_one     jsonb;
  v_stopped jsonb := jsonb_build_array();
  v_kept    jsonb := jsonb_build_array();
  v_n       integer := 0;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'cancel_delegations: tenant must be a non-empty string';
  end if;

  for v_row in
    select d.* from agent.delegations d
     where d.parent_run_id = p_parent and d.tenant_id = p_tenant
     order by d.idx asc
     for update
  loop
    if v_row.settled_at is not null then
      -- ALREADY ANSWERED. Left exactly as it is: a cancellation must not rewrite
      -- an outcome that really happened.
      v_kept := v_kept || jsonb_build_array(jsonb_build_object(
        'idx', v_row.idx, 'delegation', v_row.id, 'was', v_row.outcome -> 'ok'));
      continue;
    end if;
    if v_row.cancelled_at is not null then continue; end if;

    update agent.delegations set cancelled_at = now() where id = v_row.id;
    v_n := v_n + 1;

    -- PROPAGATE. The child's own run is stopped through the ONE function that
    -- means it, so a cancelled child gets the same treatment — and the same
    -- honest counts — as one somebody stopped by hand.
    if v_row.child_run_id is not null then
      v_one := agent.cancel_run(p_tenant, v_row.child_run_id, p_by, p_reason);
      v_stopped := v_stopped || jsonb_build_array(jsonb_build_object(
        'idx', v_row.idx, 'run_id', v_row.child_run_id,
        'completedSteps', v_one -> 'completedSteps',
        'completedCalls', v_one -> 'completedCalls',
        'heldByWorker',   v_one -> 'heldByWorker'));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'cancelled', v_n,
    'stopped', v_stopped, 'alreadyAnswered', v_kept);
end; $$;

comment on function agent.cancel_delegations(text, uuid, text, text) is
  'Stop every outstanding child of one parent and propagate the stop to its run, carrying out how far each had got. A child that had already answered is left exactly as it is.';

-- ══════════════════════════════════════════════════════════════════════════
-- 6. READING — what the parent's conversation shows
--
-- `security definer` with the tenant as an ARGUMENT, which is only safe because
-- no client role may execute it. The ordering is the POSITION, so the screen and
-- the combination agree about which child is which.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.delegation_progress(
  p_tenant text,
  p_parent uuid
) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'delegation', d.id, 'step', d.step, 'idx', d.idx, 'depth', d.depth,
           'agent_id', d.agent_id, 'agent_name', g.name,
           'task', d.task, 'tools', to_jsonb(d.tools), 'context', d.context,
           'run_id', d.child_run_id,
           'run_status', r.status, 'run_stop', r.stop,
           'created_at', d.created_at, 'admitted_at', d.admitted_at,
           'claimed_at', w.claimed_at,
           'settled_at', d.settled_at, 'cancelled_at', d.cancelled_at,
           'deadline_at', d.deadline_at, 'outcome', d.outcome
         ) order by d.idx), '[]'::jsonb)
    from agent.delegations d
    left join agent.agents   g on g.id = d.agent_id
    left join agent.runs     r on r.id = d.child_run_id
    left join agent.run_work w on w.run_id = d.child_run_id
   where d.tenant_id = p_tenant and d.parent_run_id = p_parent;
$$;

comment on function agent.delegation_progress(text, uuid) is
  'Every child of one parent in position order, with what it was told, what it was allowed, its run''s status and its outcome. Ordered by position so the screen and the combination agree about which child is which.';

-- ══════════════════════════════════════════════════════════════════════════
-- 7. THE SWEEP — a stuck child must not strand a parent
--
-- ⚠ **IT REQUEUES AND DELIBERATELY DOES NOT SETTLE.** `unresolved` is DERIVED from
-- the deadline, so writing an outcome here would put a second source of truth
-- beside it — and it would be OUR outcome for work somebody else's specialist may
-- yet answer. The parent is put back on the queue and decides what silence adds
-- up to, which under every policy is not success.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function agent.sweep_delegations(
  p_limit integer default 25
) returns setof jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row record; v_state jsonb;
begin
  for v_row in
    -- ⚠ **NOTHING IS LOCKED HERE, AND THAT IS CORRECT RATHER THAN A SHORTCUT.** This
    -- statement writes nothing to `agent.delegations` — it settles no child and
    -- invents no outcome — so there is no row to hold. The first draft carried
    -- `for update ... skip locked` copied from `resume_due_automations`, which
    -- DOES update rows, and PostgreSQL refused it outright: `FOR UPDATE is not
    -- allowed with DISTINCT clause`. Found by driving the sweep rather than by
    -- reading it.
    --
    -- **TWO TICKS OVERLAPPING IS THEREFORE HARMLESS**, by `claim_run`'s own
    -- property rather than by care here: a requeue of a run somebody is holding
    -- answers `running` and disturbs nothing, and one already queued stays queued.
    -- ONE ROW PER PARENT, so a parent with eight overdue children is woken once.
    select d.parent_run_id, d.tenant_id,
           min(d.step) as step, min(d.deadline_at) as deadline_at
      from agent.delegations d
      join agent.runs p on p.id = d.parent_run_id
     where d.settled_at is null and d.cancelled_at is null
       and d.deadline_at <= now()
       -- A PARENT THAT HAS ALREADY STOPPED WANTS NOTHING. Requeueing it would be
       -- work nothing will ever claim, offered once a minute for ever.
       and p.status <> 'stopped'
     group by d.parent_run_id, d.tenant_id
     order by min(d.deadline_at) asc
     limit greatest(1, coalesce(p_limit, 25))
  loop
    v_state := agent.requeue_run(v_row.parent_run_id, v_row.tenant_id);
    return next jsonb_build_object(
      'parent', v_row.parent_run_id, 'step', v_row.step, 'why', 'overdue',
      'overdue_since', v_row.deadline_at, 'action', v_state ->> 'state');
  end loop;

  -- ── the second arm: a wake that was rung and refused ──────────────────────
  -- ⚠ **THIS IS THE COMPENSATING HALF OF NOT HANDING THE PARENT'S CLAIM OVER.**
  -- `delegate_children` can release the parent in its own transaction and
  -- deliberately is not asked to, because every journal write presents the claim
  -- and the rest of the parent's batch is written after the delegating tool
  -- returns — so a release there would refuse those writes and fail the whole
  -- delivery. The runner lets go afterwards instead, and the window that leaves
  -- is a lost wake rather than a lost batch. This closes it.
  --
  -- **IT FIRES ONCE PER LOST WAKE, NOT ONCE A MINUTE.** The flag is set by the
  -- settle that was refused and cleared here the moment a ring lands; a parent
  -- that is genuinely running again keeps it and is tried on the next tick,
  -- which terminates because a stopped parent is excluded.
  for v_row in
    select d.parent_run_id, d.tenant_id, min(d.step) as step,
           min(d.deadline_at) as deadline_at
      from agent.delegations d
      join agent.runs p on p.id = d.parent_run_id
     where d.wake_lost
       and p.status <> 'stopped'
       -- NOTHING OF THAT PARENT'S MAY STILL BE WORKING. Waking one whose next
       -- wave is under way would deliver a step whose children have not answered
       -- — the reading `settle_delegation` counts `outstanding` to prevent.
       and not exists (
             select 1 from agent.delegations o
              where o.parent_run_id = d.parent_run_id
                and o.settled_at is null and o.cancelled_at is null
                and o.deadline_at > now()
           )
     group by d.parent_run_id, d.tenant_id
     order by min(d.deadline_at) asc
     limit greatest(1, coalesce(p_limit, 25))
  loop
    v_state := agent.requeue_run(v_row.parent_run_id, v_row.tenant_id);
    if v_state ->> 'state' is distinct from 'running' then
      update agent.delegations set wake_lost = false
       where parent_run_id = v_row.parent_run_id and wake_lost;
    end if;
    return next jsonb_build_object(
      'parent', v_row.parent_run_id, 'step', v_row.step, 'why', 'wake-lost',
      'action', v_state ->> 'state');
  end loop;
end; $$;

comment on function agent.sweep_delegations(integer) is
  'Two arms, both requeue-only: a parent with a child past its deadline, so silence becomes an answer rather than a wait with no end; and a parent whose last child rang while it was still held, so a lost wake is retried once rather than stranding it. Settles nothing: unresolved is derived from the deadline, never stored.';

-- ══════════════════════════════════════════════════════════════════════════
-- 8. TENANT ISOLATION AND WHO MAY RUN ANY OF IT
--
-- The same posture as the rest of the schema, and the same stated limit: RLS
-- keyed on `agent.tenant_id()` protects the READ path a signed-in customer uses,
-- and `service_role` carries BYPASSRLS, so what protects one account from another
-- on the SERVER's path is the tenant in every function's own filter. Both walls
-- exist; only one of them is in the database.
-- ══════════════════════════════════════════════════════════════════════════

alter table agent.task_trees  enable row level security;
alter table agent.task_trees  force  row level security;
alter table agent.delegations enable row level security;
alter table agent.delegations force  row level security;

drop policy if exists task_trees_own_tenant on agent.task_trees;
create policy task_trees_own_tenant on agent.task_trees
  for all using (tenant_id = agent.tenant_id()) with check (tenant_id = agent.tenant_id());

drop policy if exists delegations_own_tenant on agent.delegations;
create policy delegations_own_tenant on agent.delegations
  for all using (tenant_id = agent.tenant_id()) with check (tenant_id = agent.tenant_id());

-- A customer READS and writes nothing directly; `anon` gets nothing at all,
-- revoked explicitly rather than left to the default.
grant select on agent.task_trees, agent.delegations to authenticated, service_role;
grant insert, update, delete on agent.task_trees  to service_role;
grant insert, update, delete on agent.delegations to service_role;
revoke all on agent.task_trees  from anon;
revoke all on agent.delegations from anon;

-- EVERY FUNCTION TAKES THE TENANT AS AN ARGUMENT, and that is only safe because
-- no client role can execute one. The grant is the whole of what makes a tenant
-- argument acceptable, which is why the revoke comes first and names `public`.
revoke all on function agent.delegate_children(text, uuid, text, jsonb, jsonb, integer, text, uuid) from public;
revoke all on function agent.settle_delegation(uuid, text, uuid, jsonb) from public;
revoke all on function agent.cancel_delegations(text, uuid, text, text) from public;
revoke all on function agent.delegation_progress(text, uuid) from public;
revoke all on function agent.sweep_delegations(integer) from public;

grant execute on function agent.delegate_children(text, uuid, text, jsonb, jsonb, integer, text, uuid) to service_role;
grant execute on function agent.settle_delegation(uuid, text, uuid, jsonb) to service_role;
grant execute on function agent.cancel_delegations(text, uuid, text, text) to service_role;
grant execute on function agent.delegation_progress(text, uuid) to service_role;
grant execute on function agent.sweep_delegations(integer) to service_role;
