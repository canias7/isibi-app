# The rollout: ten migrations, then two Workers, in that order

**Nothing in this file has been applied, deployed or merged.** It is the checklist and the
evidence for one, and every number in it was measured by `npm run verify:rollout` on
2026-09-20 rather than read off a note. That command touches no hosted project: it builds two
throwaway local PostgreSQL databases from this tree's own migration files.

Run it before the first press:

```
cd agent-builder && npm run verify:rollout      # 44 checks, 0 failed
```

---

## 1. What is pending — eleven files

**The last version the live project records is `20260917003304` (`agent_automations`)**, read
from `ujrqdmmtcptvimazlhom`'s own migration list. Eleven of the twenty-TWO files in
`supabase/migrations/` are behind it; **eleven are ahead of it and must be applied, in this
order** — ten at M15, and M16's `20260921000000_agent_stop_and_event_log.sql` last:

| # | file | what it carries |
|---|---|---|
| 1 | `20260917120000_agent_workflow_knowledge_memory.sql` | per-step progress, waits, approvals, knowledge, memory, loops, retries, subworkflows |
| 2 | `20260918000000_agent_capability_operations.sql` | the eleven operations both halves share |
| 3 | `20260918010000_agent_tool_approvals.sql` | a tool call bound to its arguments |
| 4 | `20260918020000_agent_operation_records.sql` | operation identities, and the `_once` wrappers |
| 5 | `20260918030000_agent_approval_controls.sql` | expiry, revocation, cancellation |
| 6 | `20260918040000_agent_run_states_are_truthful.sql` | `run_open_calls` and `run_awaiting` on the thread view |
| 7 | `20260918050000_agent_triggers.sql` | one-off and weekly schedules, webhooks, events |
| 8 | `20260918060000_agent_connections.sql` | connections, scopes, the leased credential |
| 9 | `20260918120000_agent_authoring_zone_and_patch.sql` | the zone, and `patch_automation` |
| 10 | `20260920000000_agent_config_version_fences_edits.sql` | the version fence on an edit |
| 11 | `20260921000000_agent_stop_and_event_log.sql` | `heldByWorker` on a cancellation, and the arrivals `list_events` answers |

**THE PENDING SET IS DERIVED TWO WAYS AND THE CHECK REQUIRES THEM TO AGREE**: the live
version above, and this folder's own naming convention (an applied file is renamed to its
remote version; an unapplied one keeps a round number). Either alone is a claim. The two
together catch both ways this can go stale — a migration applied and renamed without the
constant moving, and one applied without being renamed at all.

**There is also a remote-only `20260916031852` with no file here.** It re-applied three
function bodies VERBATIM after a tool trimmed their comments; a second file would have been a
second copy of the same DDL. It is recorded in `CLAUDE.md` and changes nothing about this.

---

## 2. A fresh database — checked

All twenty-TWO onto an empty cluster: **580 objects in the `agent` schema** — at M15 it was
twenty-one and 576 (229 columns, 110 constraints, 49 indexes, 89 functions, 4 views, 9 triggers,
13 policies), and M16's migration is the twenty-second. Plus every RLS flag, relation ACL,
column ACL and schema grant.

**⚠ THE COUNT IS THE RUN'S OWN AND THIS LINE IS ITS TRANSCRIPTION**, so read it off
`npm run verify:rollout` rather than from here: the check asserts the fresh schema HAS something
in it and prints the number, and the number moves with every migration added.

## 3. An upgrade from the last deployed schema — checked, and SEEDED

The eleven applied ones, then **rows written through the real functions** — an agent, a
message and its run through `agent.send_to_agent`, an automation through
`agent.create_automation`, an execution through `agent.accept_automation_run` — and then the
**pending set, one at a time** (ten at M15, ELEVEN since M16).

**⚠ THE SEED IS THE POINT.** A migration that adds a `not null` column with no default is
fine on an empty database and refuses on one holding a customer's rows. An empty upgrade
check would pass and say nothing.

| | |
|---|---|
| all of them applied over rows | ok, each named on its own line so a refusal names its own file |
| every row survived | 1 agent · 1 message · 2 runs · 2 journal entries · 2 work rows · 1 automation · 1 execution |
| the journal | **byte for byte identical** (md5 of every body, ordered) |
| every new defaulted column | each holds **its own column default** on every pre-existing row |
| every new column | none is `not null` with no default on a table with rows |

**⚠ THOSE TWO ROWS CARRIED COUNTS (13 and 124) AND THE COUNTS ARE GONE FROM THEM ON PURPOSE.**
The check derives both sets by subtracting two databases, so a number here is a transcription
that goes stale the next time a migration adds a column — M16 took them to 126 — and a stale
number in a table reads as a measurement. The run prints them.

**THE DEFAULTS ARE COMPARED AGAINST THE COLUMN'S OWN DEFAULT, never against values typed
into the check.** The first version of that check transcribed nine of them and was wrong
about two — `days` is an empty ARRAY, which prints `{}` and not `NULL`, and `loops` is an
empty OBJECT and not a list. A default is a decision a migration makes; a copied string is
a spelling.

### And the two converge — which is the check with the most in it

**The upgraded schema is IDENTICAL to a fresh one, object for object: 0 only fresh, 0 only
upgraded, the same count each** (576 at M15, 580 since — read it off the run). A fresh apply and an upgrade landing on the same schema is what says
the pending set is correctly ordered and that nothing in it depends on a state only an empty
database has.

## 4. The order within the set is load-bearing, not a convention

Applied **backwards** onto the same deployed schema the set REFUSES — and **WHERE it refuses
moves with the set, because in reverse the newest file goes first**:

| | refuses at | with |
|---|---|---|
| M15 | `20260918120000_agent_authoring_zone_and_patch.sql` | `column a.inputs does not exist` — migration 1's column |
| M16 | `20260921000000_agent_stop_and_event_log.sql` | `relation "agent.events" does not exist` — `20260918050000`'s table |

Both stopped for the ORDERING's own reason rather than at the last file for some other one,
which is what the check reads the refusal's own file for. If they could go in any order, "in
this order" would be advice rather than a requirement.

---

## 5. Then the two Workers: **migration → engine → site**

Each link's own failure, derived from the schema diff plus each side's own source rather than
asserted. The ten add **62 functions and 124 columns**; a name that came out of the DATABASE
is then looked for in each half, so a function added next month is covered by existing.

### 1. THE MIGRATION, and neither Worker may go first

**The engine names 47 of the 62 new functions and the site names 28.** Against the deployed
schema PostgREST answers `PGRST202` for every one of those calls — and the site's list route
reads new columns BY NAME, where the answer is a **400**. Not degraded: refused.

Apply them in the order above. Read each back rather than trusting the success flag — the
recorded practice is `pg_get_functiondef` compared by md5 against a local apply of the same
files, over a NARROW object list (a whole-schema census counts roles and grants the two
environments legitimately differ on, and cannot tell a transcription slip from Supabase
holding more roles than a fresh cluster).

### 2. THE ENGINE (`agent-builder`, its own Worker) — the half that ACTS

It goes second because **a control the live engine cannot honour is a control that ANSWERS,
wrongly** — a tool tick, a workflow step, a Check button's verdict. This product's notes
record that defect twice, and both times the fix was to ship the acting half first.

`.github/workflows/agent-deploy.yml`, armed with the marker its own `docs/deploy.md` names.
The run must END holding one version id printed by the last step that changes the Worker, and
`/health` must be asked **until it answers that id** — `ok: true` is no substitute, because
the previous deployment answers it just as truthfully.

### 3. THE SITE (the root Worker) — the only half a person touches

Last, because a screen must not offer what the engine cannot yet run. A push to `main` fires
`deploy.yml`; the site's own `CLAUDE.md` has the image-id arithmetic, the pre-push baseline
and the **15–20 minute container hold**.

---

## What this checklist does NOT establish

- **Nothing is applied and nothing is deployed.** Every reading above is local.
- **No real model provider and no real message.** Every conversation answers on the stand-in
  and every send goes to `fakemail`, which has no network.
- **`agent.run_approvals` has no product caller at all** — found by this check rather than by
  reading. It is defined, granted, driven by `pg-schema.mjs` and mutated by the SQL sweep,
  and neither Worker nor any other SQL function calls it: the M9 round put `run_open_calls`
  and `run_awaiting` on the thread view, which is what the site really reads. Shipping it is
  not wrong and the rollout is not the place to decide what to do about it, so it is
  **recorded rather than removed**.
