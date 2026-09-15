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
// THE LAST MIGRATION WINS for anything it redefines, so a mutant must be aimed at
// the file that is actually in force. `agent.tenant_id()` is defined twice — once
// in the first migration and again in the second — and mutating the FIRST one would
// change nothing, because the second replaces it. That is an inert mutant waiting
// to happen, so the tenant mutants below name the LATEST file explicitly.
if (files.length < 1) { console.error(`no migrations in ${DIR}`); process.exit(1); }

/**
 * The LAST migration that defines a thing, found by asking the files rather than by
 * counting them.
 *
 * **A POSITION IS NOT AN IDENTITY.** This was `files[files.length - 1]`, which was
 * right for exactly as long as the tenant function lived in the newest migration —
 * and the moment a third migration arrived, every mutant aimed at "the latest" was
 * pointing at a file that does not contain them. Derived, it cannot go stale.
 */
const lastDefining = (needle) => {
  const hit = [...files].reverse().find((f) => fs.readFileSync(path.join(DIR, f), "utf8").includes(needle));
  if (!hit) { console.error(`no migration defines ${needle}`); process.exit(1); }
  return path.join(DIR, hit);
};

const SQL = path.join(DIR, files[0]);
const TENANT_FN = lastDefining("function agent.tenant_id()");
const WORK = lastDefining("create table if not exists agent.run_work");
const m = (label, from, to, control = false) => ({ label, files: [SQL], from, to, control });
const mTenant = (label, from, to) => ({ label, files: [TENANT_FN], from, to, control: false });
const mWork = (label, from, to, control = false) => ({ label, files: [WORK], from, to, control });

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
  // NO MUTANTS ON THE FIRST MIGRATION'S `agent.tenant_id()`. Two were tried and
  // both SURVIVED, and both were INERT BY CONSTRUCTION: the second migration
  // replaces that function, so editing the first one changes nothing that runs.
  // This is the same trap as mutating dead code, arriving through migration order.
  // Their replacements below target the definition actually in force.
  m("SQL/isolation: a client is granted the writer's privileges",
    "grant select on agent.runs, agent.run_entries to authenticated;",
    "grant select, insert, update, delete on agent.runs, agent.run_entries to authenticated;"),

  // The tenant fallback, aimed at the migration that actually defines it.
  mTenant("SQL/isolation: the subject fallback is gone, so no real Supabase token matches anything",
    "    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject",
    "    null"),
  mTenant("SQL/isolation: the SUBJECT wins over an explicit tenant_id",
    "    nullif(claims ->> 'tenant_id', ''),   -- explicit, and it wins\n    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject",
    "    nullif(claims ->> 'sub', ''),\n    nullif(claims ->> 'tenant_id', '')"),
  // THE SENTINEL MUST OWN A ROW AT THE MOMENT THE CHECK LOOKS, or the mutant is
  // inert: `subject-99` was tried and survived, because the run owned by that
  // subject is created and deleted in a later section than the fail-closed checks.
  // `t1` owns a run for the whole file.
  mTenant("SQL/isolation: unreadable claims FAIL OPEN",
    "exception when others then\n  -- Claims that will not parse are not a tenant. Anything we cannot read as an\n  -- identity is not an identity.\n  return null;",
    "exception when others then\n  return 't1';"),
  mTenant("SQL/isolation: the tenant is a constant instead of the verified claim",
    "  return coalesce(\n    nullif(claims ->> 'tenant_id', ''),   -- explicit, and it wins\n    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject\n  );",
    "  return 't1';"),

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

  // ── THE DURABLE QUEUE: EXACTLY ONE EXECUTION ──────────────────────────────
  // The claim is a single conditional UPDATE and every one of these breaks one of
  // its conditions. They are the difference between "one run executes once" and
  // "a duplicate delivery pays for the same model calls twice".
  mWork("SQL/queue: the claim stops being exclusive, so a duplicate delivery runs the same run",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and (claimed_by is null or true)"),
  mWork("SQL/queue: a lapsed lease is never reclaimable, so a dropped run is stranded for ever",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and claimed_by is null"),
  mWork("SQL/queue: finished work is claimable again",
    "   where run_id = p_run_id\n     and done_at is null\n     and (claimed_by is null",
    "   where run_id = p_run_id\n     and (claimed_by is null"),
  mWork("SQL/queue: the claim no longer answers whose run it is, so a consumer must trust the message",
    "    'tenant_id', v_row.tenant_id,", "    'tenant_id', null,"),
  mWork("SQL/queue: the claim stops counting attempts, so a run that keeps failing never gives up",
    "         attempts = attempts + 1", "         attempts = attempts"),

  // ── THE LEASE ─────────────────────────────────────────────────────────────
  mWork("SQL/queue: A LAPSED LEASE CAN BE REVIVED, so two workers run one run",
    "     and done_at is null\n     and lease_expires_at > now()\n  returning true into v_ok;",
    "     and done_at is null\n  returning true into v_ok;"),
  mWork("SQL/queue: anybody may extend anybody's lease",
    "   where run_id = p_run_id\n     and claimed_by = p_worker\n     and done_at is null\n     and lease_expires_at > now()",
    "   where run_id = p_run_id\n     and done_at is null\n     and lease_expires_at > now()"),
  mWork("SQL/queue: a worker that lost its lease may still release somebody else's claim",
    "   where run_id = p_run_id\n     and claimed_by = p_worker\n  returning true into v_ok;",
    "   where run_id = p_run_id\n  returning true into v_ok;"),
  mWork("SQL/queue: releasing always marks the work done, so a retryable failure is never retried",
    "         done_at = case when p_done then now() else null end,", "         done_at = now(),"),
  mWork("SQL/queue: the sweeper selects on ELAPSED TIME, so a long healthy run is taken away",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now() - make_interval(secs => p_grace_s))",
    "   where done_at is null\n     and enqueued_at <= now() - make_interval(secs => p_grace_s)"),
  mWork("SQL/queue: the sweeper offers finished work too",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now()",
    "   where true\n     and (claimed_by is null or lease_expires_at <= now()"),

  // ── ACCEPTING WORK ────────────────────────────────────────────────────────
  mWork("SQL/queue: A RETRY CAN ATTACH TO ANOTHER TENANT'S RUN ID",
    "  if not exists (select 1 from agent.runs where id = p_run_id and tenant_id = p_tenant) then",
    "  if not exists (select 1 from agent.runs where id = p_run_id) then"),
  mWork("SQL/queue: accept stops writing the first entry, so the prompt is not durable",
    "  insert into agent.run_entries (run_id, seq, body) values (p_run_id, 0, p_entry)\n  on conflict do nothing;",
    "  -- no entry written"),
  mWork("SQL/queue: accept stops writing the work row, so nothing will ever run it",
    "  insert into agent.run_work (run_id, tenant_id, kind)\n  values (p_run_id, p_tenant, p_kind)\n  on conflict (run_id) do nothing\n  returning * into v_existing;",
    "  select * into v_existing from agent.run_work where run_id = p_run_id;"),
  mWork("SQL/queue: any entry may be the first one, so a run can start mid-log",
    "  if p_entry is null or p_entry ->> 'kind' is distinct from 'started' then",
    "  if false then"),

  // ── ASKING AGAIN ──────────────────────────────────────────────────────────
  mWork("SQL/queue: A RESUME MID-RUN BECOMES A SECOND DELIVERY",
    "  if v_row.claimed_by is not null and v_row.lease_expires_at > now() then\n    return jsonb_build_object('state', 'running', 'attempts', v_row.attempts);\n  end if;",
    "  if false then\n    return jsonb_build_object('state', 'running', 'attempts', v_row.attempts);\n  end if;"),
  mWork("SQL/queue: a resume can reach another tenant's run",
    "   where run_id = p_run_id and tenant_id = p_tenant\n     for update;",
    "   where run_id = p_run_id\n     for update;"),
  mWork("SQL/queue: a resume does not put the work back",
    "     set kind = 'resume', done_at = null, enqueued_at = now(), last_error = null,",
    "     set kind = 'resume', enqueued_at = now(), last_error = null,"),

  // ── WHO MAY TOUCH THE QUEUE ───────────────────────────────────────────────
  mWork("SQL/queue: a signed-in customer is granted the queue",
    "grant select, insert, update, delete on agent.run_work to service_role;",
    "grant select, insert, update, delete on agent.run_work to service_role, authenticated;"),
  // NOT "a customer may call the claim function" ON ITS OWN: that mutant SURVIVED
  // and was proved INERT by measurement rather than hunted. Widening the EXECUTE
  // grant alone changes nothing a customer can do, because the function is SECURITY
  // INVOKER and the UPDATE inside it then meets the TABLE grant — and with that
  // widened too it meets forced RLS with no policies, which matches no rows. Three
  // walls, so no single one of them can be killed, which is exactly the recorded
  // "two redundant defences cannot be killed one at a time".
  //
  // What IS testable is the pair coming down together. MEASURED: with the function
  // grant widened, the table granted and RLS off, a customer's claim comes back
  // `claimed: true` — it really takes the work.
  mWork("SQL/queue: ALL THREE WALLS DOWN — a customer really can claim another tenant's work",
    "alter table agent.run_work enable row level security;\nalter table agent.run_work force row level security;\n\nrevoke all on agent.run_work from anon, authenticated;\ngrant select, insert, update, delete on agent.run_work to service_role;",
    "revoke all on agent.run_work from anon;\ngrant select, insert, update, delete on agent.run_work to service_role, authenticated;\ngrant execute on function agent.claim_run(uuid, text, integer) to authenticated;"),
  mWork("SQL/queue: the work row outlives its run",
    "  run_id            uuid primary key references agent.runs(id) on delete cascade,",
    "  run_id            uuid primary key references agent.runs(id) on delete no action,"),

  // ── THE CONTROL: comment-only, and it MUST survive ────────────────────────
  m("SQL/CONTROL (comment only)", "-- ============================================================================\n-- AGENT RUNS:",
    "-- ============================================================================\n-- AGENT RUNS (control):", true),
  mWork("SQL/queue/CONTROL (comment only)", "-- THE DURABLE QUEUE.", "-- THE DURABLE QUEUE (control).", true),
];

// THE PRE-CHECK. Every anchor exactly once IN ITS OWN FILE, and a replacement that
// differs. Reading one file for every mutant is how two correct anchors were
// reported as missing: the tenant and queue mutants target their own migrations,
// not the first.
let bad = 0;
const text = new Map();
for (const s of spec) {
  const f = s.files[0];
  if (!text.has(f)) text.set(f, fs.readFileSync(f, "utf8"));
  const n = text.get(f).split(s.from).length - 1;
  if (n !== 1) { console.error(`ANCHOR ${n === 0 ? "NOT FOUND" : `AMBIGUOUS (${n})`}: ${s.label}`); bad++; }
  if (s.from === s.to) { console.error(`REPLACEMENT IS THE ANCHOR: ${s.label}`); bad++; }
}
if (bad) { console.error(`\n${bad} anchor problems — spec NOT written.`); process.exit(1); }
fs.writeFileSync(process.argv[2], JSON.stringify(spec, null, 1));
console.log(`${spec.length} SQL mutants (${spec.filter((s) => s.control).length} control), every anchor unique.`);
