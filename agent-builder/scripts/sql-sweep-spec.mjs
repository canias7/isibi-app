/**
 * THE SQL MUTATION SPEC — the schema's guarantees, broken on purpose.
 *
 * WHY THIS EXISTS SEPARATELY. The JavaScript sweep runs the unit suite, which
 * cannot see a schema, so until now no database guarantee had been proved by
 * BREAKING the schema and watching a check go red. Sixty hand-written checks are
 * adversarial but they are not mechanical: nothing showed they would catch a
 * schema edited in a way nobody thought of. This closes that for the four
 * guarantees that matter most.
 *
 * FOCUSED, on the four claims the notes make loudest:
 *   tenant isolation · duplicate prevention · journal immutability ·
 *   whole-run deletion.
 *
 * Each mutant is a change that a careless edit could really make — a policy
 * loosened, a `unique` dropped, a raise turned into a return, a marker widened —
 * not a syntax error. A migration that will not apply proves nothing.
 *
 * NOT MUTATED, AND SAID OUT LOUD: `force row level security`. Removing it would
 * only be observable to a table OWNER who is not a superuser, and the harness's
 * owner IS one — superusers bypass row level security whatever FORCE says. So that
 * one line's effect is unverifiable here and a mutant of it would survive for a
 * reason that has nothing to do with the schema being right.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
if (files.length !== 1) {
  console.error(`expected exactly one migration, found ${files.length} — re-anchor this spec before trusting it`);
  process.exit(1);
}
const SQL = path.join(DIR, files[0]);
const m = (label, from, to, control = false) => ({ label, files: [SQL], from, to, control });

const spec = [
  // ── TENANT ISOLATION ──────────────────────────────────────────────────────
  m("SQL/isolation: the runs policy stops comparing the tenant",
    "  using (tenant_id = agent.tenant_id())\n  with check (tenant_id = agent.tenant_id());",
    "  using (true)\n  with check (true);"),
  m("SQL/isolation: the runs policy reads any tenant it is asked about",
    "  using (tenant_id = agent.tenant_id())", "  using (tenant_id = tenant_id)"),
  // NOT "remove the tenant comparison from the entries policy": that mutant
  // SURVIVED and was proved INERT by measurement. `agent.runs` is itself under row
  // level security, so the policy's subquery is already filtered to this tenant —
  // the comparison is a deliberate second wall, declared as such in the migration.
  // What IS testable is whether the entries policy restricts anything at all.
  m("SQL/isolation: the entries policy stops restricting anything",
    "  using (exists (\n    select 1 from agent.runs r\n     where r.id = run_entries.run_id and r.tenant_id = agent.tenant_id()))",
    "  using (true)"),
  m("SQL/isolation: the tenant is a constant instead of the verified claim",
    "  return nullif(\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'tenant_id',\n    ''\n  );",
    "  return 't1';"),
  m("SQL/isolation: unreadable claims FAIL OPEN instead of closed",
    "exception when others then\n  -- Claims that will not parse are not a tenant. Anything we cannot read as an\n  -- identity is not an identity.\n  return null;",
    "exception when others then\n  return 't1';"),
  m("SQL/isolation: a client is granted the writer's privileges",
    "grant select on agent.runs, agent.run_entries to authenticated;",
    "grant select, insert, update, delete on agent.runs, agent.run_entries to authenticated;"),

  // ── DUPLICATE PREVENTION ──────────────────────────────────────────────────
  m("SQL/duplicates: a run may be started twice",
    "create unique index entries_one_started", "create index entries_one_started"),
  m("SQL/duplicates: a run may be finished twice",
    "create unique index entries_one_stopped", "create index entries_one_stopped"),
  m("SQL/duplicates: two model answers for one step",
    "create unique index entries_one_model_per_step", "create index entries_one_model_per_step"),
  m("SQL/duplicates: two results for one tool slot",
    "create unique index entries_one_tool_per_slot", "create index entries_one_tool_per_slot"),
  m("SQL/duplicates: the model-answer rule keys on the run and not the step",
    "on agent.run_entries (run_id, step) where kind = 'model';",
    "on agent.run_entries (run_id, step, seq) where kind = 'model';"),
  m("SQL/duplicates: a malformed entry can be stored",
    "  constraint entry_position_matches_kind check (", "  constraint entry_position_matches_kind check (true) and not ("),

  // ── JOURNAL IMMUTABILITY ──────────────────────────────────────────────────
  m("SQL/immutability: an entry can be edited after it was written",
    "  raise exception 'agent.run_entries is append-only: entry (run %, seq %) cannot be updated',\n    old.run_id, old.seq\n    using errcode = 'restrict_violation';",
    "  return new;"),
  m("SQL/immutability: the append-only trigger is never attached",
    "create trigger entries_append_only\n  before update on agent.run_entries",
    "create trigger entries_append_only\n  before truncate on agent.run_entries"),

  // ── WHOLE-RUN DELETION ────────────────────────────────────────────────────
  m("SQL/deletion: a lone entry can be deleted while its run remains",
    // `position` answers 0 or a positive index, never -1, so this guard can never
    // fire and every lone delete is allowed. `>= 0` would be the opposite mistake:
    // always refusing, which breaks retention and would die for the wrong reason.
    "              coalesce(nullif(current_setting('agent.deleting_run', true), ''), '')) = 0 then",
    "              coalesce(nullif(current_setting('agent.deleting_run', true), ''), '')) = -1 then"),
  m("SQL/deletion: the delete wall is never attached",
    "create trigger entries_only_with_their_run\n  before delete on agent.run_entries",
    "create trigger entries_only_with_their_run\n  before truncate on agent.run_entries"),
  // NO MUTANT FOR `set_config`'s is_local FLAG. Flipping it to session scope was
  // tried and SURVIVED, and was then proved INERT by measurement rather than
  // hunted: the marker still did not outlive the transaction, checked three ways
  // including re-creating a run under the same id in a later transaction of the
  // same session. The security of the wall rests on the marker NAMING THE RUN —
  // which has its own mutant below — not on the flag. See the migration's own note.
  m("SQL/deletion: the marker stops naming WHICH run, so one delete authorises another's entries",
    "  if position(old.run_id::text || ',' in", "  if position('' in"),
  m("SQL/deletion: the marker REPLACES instead of appending, breaking a multi-row delete",
    "    coalesce(nullif(current_setting('agent.deleting_run', true), ''), '') || old.id::text || ',',",
    "    old.id::text || ',',"),
  m("SQL/deletion: deleting a run leaves its log behind",
    "references agent.runs (id) on delete cascade", "references agent.runs (id) on delete no action"),
  m("SQL/deletion: the marker is set by nothing, so retention cannot work either",
    "create trigger runs_delete_marks\n  before delete on agent.runs",
    "create trigger runs_delete_marks\n  before truncate on agent.runs"),

  // ── THE CONTROL: comment-only, and it MUST survive ────────────────────────
  m("SQL/CONTROL (comment only)", "-- ============================================================================\n-- AGENT RUNS:",
    "-- ============================================================================\n-- AGENT RUNS (control):", true),
];

// THE PRE-CHECK. Every anchor exactly once, and a replacement that differs.
const body = fs.readFileSync(SQL, "utf8");
let bad = 0;
for (const s of spec) {
  const n = body.split(s.from).length - 1;
  if (n !== 1) { console.error(`ANCHOR ${n === 0 ? "NOT FOUND" : `AMBIGUOUS (${n})`}: ${s.label}`); bad++; }
  if (s.from === s.to) { console.error(`REPLACEMENT IS THE ANCHOR: ${s.label}`); bad++; }
}
if (bad) { console.error(`\n${bad} anchor problems — spec NOT written.`); process.exit(1); }
fs.writeFileSync(process.argv[2], JSON.stringify(spec, null, 1));
console.log(`${spec.length} SQL mutants (${spec.filter((s) => s.control).length} control), every anchor unique.`);
