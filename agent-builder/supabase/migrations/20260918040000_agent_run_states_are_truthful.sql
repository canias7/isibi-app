-- ═══════════════════════════════════════════════════════════════════════════════
-- WHAT A RUN IS REALLY DOING (2026-09-17)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Owner: *"Make operational states truthful: backend status and history sufficient to
-- distinguish queued, running, waiting, awaiting approval, unresolved, failed, cancelled,
-- completed. A stranded run must not appear to be actively working forever. Reuse the
-- current interface where a small status correction is needed; no redesign."*
--
-- ⚠ **ONE WORD WAS DOING FIVE JOBS.** `agent.runs.status` is `new | running | stopped` —
-- projected off the log, and right about what it says — and the CONVERSATION reader turned
-- `running` into `working`. So a run really thinking, a run waiting for a person, and a run
-- that is never going to move again all read as *working*, for ever, with nothing telling
-- them apart. The last of those is the one the requirement names.
--
-- **NOTHING IS REDESIGNED AND NO STATUS COLUMN MOVES.** `status` stays exactly what it is:
-- a projection of the log, with three values. What this adds is the two FACTS a reader needs
-- to tell the five apart, appended to the view the screen already reads — and both come out
-- of relations the customer can already see, so `security_invoker = true` is untouched.
--
--   * `run_open_calls` — how many tool calls have no result. A healthy run has 0 between
--     steps; a run stopped part way has one per call it never recorded, and that IS the
--     `cannot-resume` / unresolved shape. **The LOG says this**, which is the whole point:
--     the log is the record, so the record can answer it.
--   * `run_awaiting` — whether a request is waiting for a person AND can still be answered.
--     Not merely "a row exists": a withdrawn, decided or EXPIRED request is not waiting for
--     anybody, and reading one as waiting would put a run in the state whose only exit is a
--     decision nobody can make.
--
-- ⚠ **AND `agent.run_work` IS STILL DELIBERATELY NOT JOINED.** It would say "is there
-- anything on the queue" directly and it is the obvious thing to reach for — but
-- `authenticated` holds NOTHING on that table, so under `security_invoker` it answers NULL
-- for every customer and a run would read as stranded the moment somebody looked at it. The
-- log and the approvals answer the same question from relations the reader can see.

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
  r.model      as run_model,
  r.started_at as run_started_at,
  r.stopped_at as run_stopped_at,
  prog.step    as run_step,
  -- ⚠ APPENDED, AND POSTGRES REQUIRES IT RATHER THAN PREFERRING IT: `create or replace view`
  -- may only ADD columns at the end. Tidying this into the order a reader would like is a
  -- broken deploy.
  -- ⚠ **BOTH COALESCES ARE DELIBERATE BELTS THAT CANNOT FIRE TODAY, and saying so is the
  -- point: a sweep reports an inert line as a test gap, and the next reader deletes what
  -- nothing appears to need.** MEASURED over every row shape that exists — a message with no
  -- run at all, a run with no log, and a run with an unanswered batch — the view's answers are
  -- byte-identical with them and without them. The reason is the laterals' own SHAPE: `ask` is
  -- a scalar `select exists (…)` with no FROM and `open` is an aggregate with no GROUP BY, so
  -- under `left join lateral … on true` each always returns exactly one row and neither column
  -- is ever NULL.
  --
  -- **WHAT WOULD MAKE THEM LOAD-BEARING is one line away**: a `group by` or a `having` in either
  -- lateral, or turning one into a plain row select with a WHERE that can eliminate its row.
  -- Then the column answers NULL, and in SQL `where run_awaiting = false` matches NOTHING for a
  -- NULL — so a reader filtering on it would silently drop every such run. The site's own reader
  -- already refuses a non-boolean and a non-integer, which is a SECOND wall at a different
  -- layer, for a different reader; this one states the view's contract, that it answers a value.
  coalesce(open.calls, 0) as run_open_calls,
  coalesce(ask.waiting, false) as run_awaiting
from agent.agent_messages m
left join agent.runs r on r.id = m.run_id
left join lateral (
  select max(e.step) as step from agent.run_entries e where e.run_id = m.run_id
) prog on true
left join lateral (
  -- ⚠ **HOW MANY CALLS WERE ASKED FOR AND NEVER ANSWERED, out of the log itself.**
  --
  -- A model entry carries its `toolCalls`; a tool entry carries the `(step, index)` slot it
  -- answers. So the count is asked-for minus answered, and it is ZERO for every run that has
  -- ever finished a batch — which is what makes a non-zero one meaningful rather than noisy.
  --
  -- **IT IS NOT A SECOND COPY OF `replay`'s `pending`.** `replay` rebuilds the whole
  -- conversation and says WHICH calls are pending, with their names and arguments, because
  -- the loop needs that. This says HOW MANY, because a screen needs to know only whether the
  -- run can move. The engine's reader stays the authority on what to do about it.
  select greatest(
           coalesce(sum(jsonb_array_length(coalesce(e.body -> 'toolCalls', '[]'::jsonb)))
                      filter (where e.kind = 'model'), 0)
           - count(*) filter (where e.kind = 'tool'), 0) as calls
    from agent.run_entries e where e.run_id = m.run_id
) open on true
left join lateral (
  -- ⚠ **WAITING FOR A PERSON, AND ANSWERABLE.** A decided request is answered; a withdrawn
  -- one was answered by the withdrawal; an EXPIRED one cannot be answered at all. Reading
  -- any of the three as "waiting" would leave a run in a state whose only exit is a decision
  -- nobody can make — which is the stranding this whole column exists to expose.
  select exists (
           select 1 from agent.tool_approvals a
            where a.run_id = m.run_id and a.verdict is null
              and (a.expires_at is null or a.expires_at > now())) as waiting
) ask on true;

comment on view agent.agent_thread is
  'One row per message with the state of the run it started, including how many tool calls have no result and whether a person can still answer one. security_invoker, so RLS on every relation it reads applies to whoever reads it.';

-- The grants on the view do not move: `authenticated` may READ its own rows (RLS decides
-- which), the server reads through `service_role`, `anon` is refused.
grant select on agent.agent_thread to authenticated, service_role;
revoke all on agent.agent_thread from anon;

-- ⚠ **AND THE SERVER NEEDED ONE GRANT IT DID NOT HAVE, WHICH ONLY A REAL DATABASE COULD
-- SAY.** `security_invoker` means every relation the view reads is read AS THE CALLER, so
-- the new `tool_approvals` lateral needs the caller's own SELECT. MEASURED before this
-- line: `has_table_privilege('authenticated', 'agent.tool_approvals', 'select')` is TRUE
-- and the same question for `service_role` is FALSE — the table was reached only through
-- `security definer` functions until now. So the CUSTOMER could read the conversation and
-- the SERVER could not, and the server is the reader every route uses: the site's thread
-- read would have failed `permission denied for table tool_approvals` on every
-- conversation that has a message in it.
--
-- **AND THE PROBE THAT MISSED IT IS WORTH RECORDING**: read against an EMPTY
-- `agent_messages` the view answers `0` happily, because a lateral is never evaluated for
-- a row that does not exist — so the permission is not checked and nothing looks wrong.
-- *A negative assertion needs its observer alive*, and here the observer is a row.
--
-- **IT GRANTS NO CAPABILITY THE SERVER LACKED.** `service_role` already reads any run's
-- requests through `agent.run_approvals`, which is definer and granted to it; this only
-- lets it read them without naming a run. The alternative — a definer function inside the
-- view — would put a privilege-elevating call inside a `security_invoker` view, which is
-- the one thing that option exists to avoid.
grant select on agent.tool_approvals to service_role;
