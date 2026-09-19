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
/**
 * ⚠ **WHICH CONSTRAINT BODY A POSITION SITS INSIDE, or null — and asking it POSITIONALLY is what
 * the first version of this got wrong.** That one asked whether the anchor TEXT names a
 * constraint, which catches a mutant on the `constraint … check (` header and misses one aimed at
 * a CLAUSE a few lines inside it. A third survivor is what said so, and the function version's
 * own comment already records the same lesson in the same words: *a preceding landmark is not an
 * enclosing one.*
 *
 * Comments and single-quoted literals are BLANKED length-preservingly before the paren walk,
 * because a body here really does contain both — one of these constraints carries a comment
 * holding `array_length('{}', 1)`, whose parens would otherwise unbalance the scan.
 */
const blankedSql = (t) => {
  const out = [...t];
  for (let i = 0; i < t.length;) {
    if (t[i] === "-" && t[i + 1] === "-") {
      const j = t.indexOf("\n", i) < 0 ? t.length : t.indexOf("\n", i);
      for (let k = i; k < j; k++) out[k] = " ";
      i = j;
    } else if (t[i] === "'") {
      let j = i + 1;
      while (j < t.length) {
        if (t[j] === "'") { if (t[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      for (let k = i; k <= Math.min(j, t.length - 1); k++) out[k] = " ";
      i = j + 1;
    } else i++;
  }
  return out.join("");
};
const constraintsIn = (text) => {
  const b = blankedSql(text);
  const found = [];
  for (const m of b.matchAll(/constraint\s+([a-z0-9_]+)\s+check\s*\(/gi)) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < b.length; i++) {
      if (b[i] === "(") d++;
      else if (b[i] === ")") { d--; if (d === 0) break; }
    }
    found.push({ name: m[1], start: m.index, end: i });
  }
  return found;
};
const enclosingConstraint = (text, at) =>
  at < 0 ? null : (constraintsIn(text).find((c) => c.start <= at && at <= c.end) ?? null);

/**
 * ⚠ **THE FILE WHOSE DEFINITION OF A NAMED CONSTRAINT IS IN FORCE — and `lastDefining` cannot
 * answer this, which is why the trap arrived a FIFTH time.** `create or replace` is how a
 * function or a view is silently superseded, and the check below is narrowed to those two for
 * that reason; a CONSTRAINT is superseded by `drop constraint … add constraint` in a later
 * migration, which is a different mechanism the narrow check does not model at all.
 *
 * **MEASURED: 18 constraints and indexes in this directory are dropped and re-added by a later
 * migration**, and two mutants were aimed at superseded copies of two of them. One SURVIVED,
 * which is the honest signal. **The other was KILLED — and for a reason that has nothing to do
 * with its property**: `check (…) and not (` is invalid inside a `create table` column list, so
 * the mutated MIGRATION does not parse, the "the migration applies" check goes red, and the
 * tally records a kill. *A kill for the wrong reason is worse than a survivor, because a
 * survivor gets investigated and a kill does not.*
 */
const lastConstraining = (name) => {
  const dropped = files.filter((f) =>
    new RegExp(String.raw`drop\s+constraint\s+(?:if\s+exists\s+)?${name}\b`, "i").test(fs.readFileSync(path.join(DIR, f), "utf8")));
  const defined = files.filter((f) =>
    new RegExp(String.raw`constraint\s+${name}\s+check`, "i").test(fs.readFileSync(path.join(DIR, f), "utf8")));
  if (!defined.length) { console.error(`no migration defines constraint ${name}`); process.exit(1); }
  // The last file that DEFINES it, which is the last that re-adds it after any drop.
  return path.join(DIR, defined[defined.length - 1]);
};
/** A mutant on the definition of `name` that is really in force, wherever that lives. */
const mConstraint = (name) => (label, from, to, control = false) =>
  ({ label, files: [lastConstraining(name)], from, to, control });

/**
 * WHICH FUNCTION BODY A POSITION SITS INSIDE, or null.
 *
 * Between a `create or replace function agent.X(` header at the start of a line and the
 * `$$;` that closes its body. **INSIDE, not merely after** — the first draft of this only
 * took the nearest preceding header, so every index and constraint mutant that happened to
 * come after the last function in a file was attributed to it, and eight correct entries
 * were reported as superseded. *A preceding landmark is not an enclosing one.*
 *
 * It is not a SQL parser and does not pretend to be: `$$` is the only dollar tag these
 * migrations use (measured while the automations migration was applied), and the headers
 * are written at the start of a line by this file's own convention.
 *
 * **VIEWS ARE DELIBERATELY NOT COVERED**, and that is stated rather than glossed: a view's
 * body has no delimiter as unambiguous as `$$;`, and inventing one is the "flat scans where
 * depth matters" trap. There are four views; `agent.automation_history` was the one
 * instance of this class among them and was re-pointed by hand.
 */
const enclosing = (src, at) => {
  if (at < 0) return null;
  const re = /^create or replace function (agent\.[a-z_]+)\(/gm;
  let found = null, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > at) break;
    found = { name: m[1], from: m.index };
  }
  if (!found) return null;
  // ⚠ **THE TERMINATOR IS `$$;` WHEREVER IT SITS ON THE LINE, which is measured rather
  // than assumed.** The first draft looked for `\n$$;` — the tag at the start of a line —
  // and MEASURED over these migrations that is the minority form: 40 bodies end `end; $$;`,
  // 22 end `$$;` alone, 2 end `end $$;`. So every function whose body closes on the same
  // line as its `end` answered "no close", `enclosing` returned null, and the census was a
  // DEAD OBSERVER — it passed with all eight known-bad entries put back. Found by proving
  // it alive rather than by trusting a green run.
  const ends = /^.*\$\$;/m.exec(src.slice(found.from));
  // A header with no close is a file this reader does not understand; say nothing rather
  // than guessing, because a wrong claim here reports a correct mutant as broken.
  //
  // ⚠ AND EVERY WAY THIS CAN BE WRONG FAILS SILENT, which is the direction to be wrong in.
  // A `$$;` inside a body's own string would shorten that body, so a position past it
  // answers `null` and no claim is made — a MISSED detection, never a false alarm. The one
  // odd form in these files is a whole function on one line (`as $$ select 20 $$;`), which
  // this reads correctly.
  if (!ends) return null;
  if (at > found.from + ends.index + ends[0].length) return null;
  return found;
};

/**
 * The VIEW a position sits inside, for the same reason `enclosing` exists one function up.
 *
 * ⚠ **AND THE CENSUS BELOW CLAIMED VIEWS WERE COVERED WHILE READING ONLY FUNCTIONS —
 * measured 2026-09-19, and a sweep survivor is what found it.** Its own comment says
 * "FUNCTIONS AND VIEWS ONLY, and the narrowness is measured", which describes the INTENT;
 * the code asked `enclosing` (a `create or replace function` reader) and `lastDefining`
 * for a function name, so a mutant whose anchor sat inside a view was never asked the
 * question at all. `agent_overview`'s `a.status` line is written by TWO migrations —
 * `20260916085453` and `20260918120000` — and the mutant was aimed by
 * `mSettings` at the first, which the second replaces: it landed on dead code and
 * SURVIVED, reading as a gap in the database check. **The check was alive all along**:
 * with the mutation in the migration really in force, `pg-schema.mjs` answers
 * `1074 passed, 2 failed` and names `the overview carries the status`.
 * *A promise nothing ever compiled*, in the census written for exactly this class.
 *
 * MEASURED: **9 of the spec's anchors sit inside a view**, across `agent_thread` (5),
 * `automation_history` (2), `agent_overview` (1) and `connection_list` (1) — so this arm
 * has live subjects, which is what the function arm's own dead-observer history says to
 * state as a number rather than assume.
 *
 * A VIEW ENDS AT ITS FIRST `;` and that is enough here: these definitions carry no
 * statement-terminating semicolon inside them (no function bodies, no dollar quoting), so
 * the first one after the header is the end of the view. A header with no `;` answers
 * `null` and no claim is made — the same fail-silent direction `enclosing` takes, because
 * a wrong claim reports a correct mutant as broken.
 */
const enclosingView = (src, at) => {
  if (at < 0) return null;
  const re = /^create or replace view (agent\.[a-z_]+)/gm;
  let found = null, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > at) break;
    found = { name: m[1], from: m.index };
  }
  if (!found) return null;
  const end = src.indexOf(";", found.from);
  if (end < 0) return null;
  return at <= end ? found : null;
};

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

/**
 * A mutant aimed at whichever migration LAST defines a function.
 *
 * **THIS IS THE RECORDED TRAP ARRIVING A SECOND TIME, and it is why `lastDefining`
 * exists.** The fence migration redefines `claim_run`, `accept_run`, `beat_run` and
 * `release_run`, so every mutant that was aimed at the queue migration's copies of
 * them became INERT BY CONSTRUCTION the moment it landed — mutating dead code,
 * arriving through migration order. Asking the files which one is in force cannot go
 * stale, and a `-- no such function` would fail the pre-check rather than survive the
 * run.
 */
const FN = (name) => lastDefining(`function agent.${name}(`);
const mFn = (name) => (label, from, to, control = false) => ({ label, files: [FN(name)], from, to, control });
const mClaim = mFn("claim_run");
const mBeat = mFn("beat_run");
const mRelease = mFn("release_run");
const mAccept = mFn("accept_run");
const mAppend = mFn("append_entry");
const mSend = mFn("send_to_agent");
/**
 * The migration that adds the settings — the status, the selection and the shape
 * constraint. Found by a thing only IT defines, so it cannot be named by position.
 */
const SETTINGS = lastDefining("add column if not exists status text");
const mSettings = (label, from, to, control = false) => ({ label, files: [SETTINGS], from, to, control });
const mAuthored = mFn("authored_run");
const mForget = mFn("delete_memory");
const mSnap = mFn("agent_memory_snapshot");
const mThread = (label, from, to, control = false) =>
  ({ label, files: [lastDefining("create or replace view agent.agent_thread")], from, to, control });
/**
 * THE AGENTS-LIST VIEW, aimed the way `mThread` already aims at the other one. It rode on
 * `mSettings` — the FILE that adds the status column — which is the right file for the
 * column and the wrong one for the view: `20260918120000` re-creates `agent_overview`, so
 * the mutation landed on a definition nothing applies. It survived a full sweep for that
 * reason alone, and the census above now refuses the shape rather than leaving it to a run.
 */
const mOverview = (label, from, to, control = false) =>
  ({ label, files: [lastDefining("create or replace view agent.agent_overview")], from, to, control });
/**
 * ⚠ **THE MESSAGE TABLE'S OWN DDL IS NOT THE VIEW'S, and conflating them cost an anchor.**
 * `run_id` and `messages_one_send_per_agent` are `agent.agent_messages`' column and index,
 * added once and never re-emitted — so they belong to the migration that really defines
 * them and not to whichever file last redefines the thread view. They rode on `mThread`
 * until a later migration redefined that view for a different reason, at which point both
 * anchors moved to a file that has never contained them: *a position is not an identity*,
 * the recorded trap, arriving through a sibling change rather than through a sweep.
 *
 * Caught by the generator's own anchor census (`ANCHOR NOT FOUND`) rather than by a
 * survivor, which is what that pre-check is for — a spec entry pointing at a file without
 * its anchor reads as a test gap after the run and as nothing at all before it.
 */
const mLink = (label, from, to, control = false) =>
  ({ label, files: [lastDefining("add column if not exists run_id uuid")], from, to, control });
/**
 * THE AUTOMATIONS MIGRATION, found by what it defines rather than by its position —
 * the same rule `lastDefining` exists for. `claim_run` is redefined THERE, so
 * `mClaim` above already points at this file for anything it touches; these are the
 * things only this migration has.
 */
const AUTOS = lastDefining("create table if not exists agent.automations");
/**
 * THE OPERATION RECORD — the table, the one rule, and the six wrappers. Found by what it
 * defines rather than by position, as everything here is.
 */
const OPS = lastDefining("create table if not exists agent.operations");
const mOps = (label, from, to, control = false) => ({ label, files: [OPS], from, to, control });
const mAuto = (label, from, to, control = false) => ({ label, files: [AUTOS], from, to, control });
/**
 * ⚠ **AND THE TRAP ARRIVED A THIRD TIME, THROUGH `mAuto` — found 2026-09-17 by a census
 * rather than by a survivor, because the SQL sweep had not run since.**
 *
 * `AUTOS`' own comment above says "these are the things only this migration has", and the
 * workflow migration made that false: it REDEFINES `accept_automation_run`,
 * `finish_automation_run` and `agent.automation_history`. So eight mutants were still
 * aimed at this file's superseded copies of them — **inert by construction**, and the
 * pre-check could not see it, because each anchor really does occur exactly once in the
 * file it was pointed at.
 *
 * The answer is the one already here: ask the files which definition is IN FORCE, per
 * object. `mAuto` keeps the table's own indexes, constraints and columns, which nothing
 * else redefines.
 */
/**
 * ⚠ **AND A FOURTH TIME, THROUGH THE SAME COMMENT — found 2026-09-18 by the same census.**
 * The triggers migration widens `tick_automations` (a weekly and a one-off schedule are due
 * on different days from a daily one), so the three mutants aimed at this file's copy were
 * inert by construction the moment it landed. The rule is already written above and it is
 * PER OBJECT: anything a later file redefines goes through `mFn`, and `mAuto` keeps only
 * the table's own indexes, constraints and columns. *The comment saying "these are the
 * things only this migration has" is the thing that keeps becoming false* — so the census
 * is what enforces it, not the comment.
 */
const mTick = mFn("tick_automations");
const mAcceptAuto = mFn("accept_automation_run");
const mFinishAuto = mFn("finish_automation_run");
const mHistory = (label, from, to, control = false) =>
  ({ label, files: [lastDefining("create or replace view agent.automation_history")], from, to, control });

/**
 * THE WORKFLOW / KNOWLEDGE / MEMORY MIGRATION, found by what only IT defines. Its
 * guarantees are of three different kinds and they are grouped that way below: what a
 * SUSPENDED execution may do, what a SEARCH may return, and who a MEMORY belongs to.
 */
const WKM = lastDefining("create table if not exists agent.agent_knowledge");
const mWkm = (label, from, to, control = false) => ({ label, files: [WKM], from, to, control });

/**
 * THE APPROVAL CONTROLS — a window, a permission taken back, a run stopped. Found by what
 * only IT defines, as everything here is; and the FUNCTIONS it redefines go through `mFn`,
 * because `request_tool_approval` and `decide_tool_approval` are older than this migration.
 */
const CTRLS = lastDefining("create table if not exists agent.tool_revocations");
const mCtrl = (label, from, to, control = false) => ({ label, files: [CTRLS], from, to, control });
const mRevoke = mFn("revoke_agent_tool");
const mRestore = mFn("restore_agent_tool");
const mRevokedList = mFn("revoked_tools");
const mWithdraw = mFn("revoke_tool_approval");
const mCancel = mFn("cancel_run");
const mExpiredSweep = mFn("requeue_expired_approvals");
const mRequest = mFn("request_tool_approval");
const mDecide = mFn("decide_tool_approval");
const mPending = mFn("pending_approvals");
const mRunApprovals = mFn("run_approvals");

/**
 * ⚠ **THE CONNECTIONS MIGRATION, AND IT SHIPPED WITH NO SQL MUTANTS AT ALL — found
 * 2026-09-18 by counting the spec per file rather than by a survivor.** Every other
 * migration here had between 2 and 40; the newest one, the one carrying the credential,
 * had none. So the whole of M8's storage argument — that the secret has exactly one door,
 * that neither grant is a table grant, that the view names neither secret, that a
 * revocation destroys the credential — rested on `pg-schema.mjs` alone, with nothing
 * checking that those checks can FAIL. *A count per file is the census that sees this; a
 * sweep tally cannot, because a migration with no mutants contributes no survivors.*
 *
 * Found by what only it defines, as everything here is.
 */
const CONNS = lastDefining("create table if not exists agent.connections");
const mConn = (label, from, to, control = false) => ({ label, files: [CONNS], from, to, control });
const mLease = mFn("lease_connection");
const mConnect = mFn("connect_provider");
const mRefreshConn = mFn("refresh_connection");
const mRevokeConn = mFn("revoke_connection");
const mDisconnect = mFn("disconnect_connection");

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
  // ⚠ RE-AIMED, AND THIS ONE WAS "KILLED" FOR THE WRONG REASON — which is the worse half of the
  // finding. It was aimed at the `create table` copy, which the workflow migration drops and
  // re-adds, so the semantic change was inert; what went red was the MIGRATION FAILING TO PARSE,
  // because `check (…) and not (` is not valid in a column list. A kill for a reason unrelated to
  // the property reads as coverage and is not, and unlike a survivor nobody investigates it.
  // Aimed at the definition in force, as an `alter table` statement where the disjunction is
  // valid SQL, so what it tests is the CONSTRAINT rather than the parser.
  mConstraint("entry_position_matches_kind")("SQL/duplicates: a malformed entry can be stored",
    "add constraint entry_position_matches_kind check (\n  case body ->> 'kind'",
    "add constraint entry_position_matches_kind check (\n  true or case body ->> 'kind'"),

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
  mClaim("SQL/queue: the claim stops being exclusive, so a duplicate delivery runs the same run",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and (claimed_by is null or true)"),
  mClaim("SQL/queue: a lapsed lease is never reclaimable, so a dropped run is stranded for ever",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and claimed_by is null"),
  mClaim("SQL/queue: finished work is claimable again",
    "   where run_id = p_run_id\n     and done_at is null\n     and (claimed_by is null",
    "   where run_id = p_run_id\n     and (claimed_by is null"),
  mClaim("SQL/queue: the claim no longer answers whose run it is, so a consumer must trust the message",
    "    'tenant_id', v_row.tenant_id,", "    'tenant_id', null,"),
  mClaim("SQL/queue: the claim stops counting attempts, so a run that keeps failing never gives up",
    "         attempts = attempts + 1", "         attempts = attempts"),
  mClaim("SQL/queue: THE CLAIM DOES NOT ANSWER ITS TOKEN, so no holder can ever write",
    "    'claim_token', v_row.claim_token,", "    'claim_token', null,"),
  mClaim("SQL/queue: A RECLAIM REUSES THE PREVIOUS CLAIM'S TOKEN, so a displaced worker keeps writing",
    "         claim_token = gen_random_uuid(),", "         claim_token = coalesce(claim_token, gen_random_uuid()),"),

  // ── THE LEASE ─────────────────────────────────────────────────────────────
  mBeat("SQL/queue: A LAPSED LEASE CAN BE REVIVED, so two workers run one run",
    "     and done_at is null\n     and lease_expires_at > now()\n  returning true into v_ok;",
    "     and done_at is null\n  returning true into v_ok;"),
  mBeat("SQL/queue: anybody may extend anybody's lease",
    "     and claimed_by = p_worker\n     and claim_token = p_token\n     and done_at is null",
    "     and done_at is null"),
  mBeat("SQL/queue: THE BEAT IGNORES THE TOKEN, so a replaced claim keeps its lease alive",
    "     and claim_token = p_token\n     and done_at is null", "     and done_at is null"),
  mBeat("SQL/queue: a beat with no token at all is accepted",
    "  if p_token is null then\n    raise exception 'beat_run: the claim token is required';\n  end if;",
    "  -- no token needed"),
  mRelease("SQL/queue: a worker that lost its lease may still release somebody else's claim",
    "   where run_id = p_run_id\n     and claimed_by = p_worker\n     and claim_token = p_token\n     and lease_expires_at > now()",
    "   where run_id = p_run_id"),
  mRelease("SQL/queue: A LAPSED HOLDER MAY STILL END THE RUN, mid-flight",
    "     and claim_token = p_token\n     and lease_expires_at > now()\n  returning true into v_ok;",
    "     and claim_token = p_token\n  returning true into v_ok;"),
  mRelease("SQL/queue: a released row keeps its token, so the dead holder can write again",
    "         claim_token = null,\n         done_at = case when p_done then now()",
    "         done_at = case when p_done then now()"),
  mRelease("SQL/queue: releasing always marks the work done, so a retryable failure is never retried",
    "         done_at = case when p_done then now() else null end,", "         done_at = now(),"),
  mWork("SQL/queue: the sweeper selects on ELAPSED TIME, so a long healthy run is taken away",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now() - make_interval(secs => p_grace_s))",
    "   where done_at is null\n     and enqueued_at <= now() - make_interval(secs => p_grace_s)"),
  mWork("SQL/queue: the sweeper offers finished work too",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now()",
    "   where true\n     and (claimed_by is null or lease_expires_at <= now()"),

  // ── ACCEPTING WORK ────────────────────────────────────────────────────────
  mAccept("SQL/queue: A RETRY CAN ATTACH TO ANOTHER TENANT'S RUN ID",
    "  if not exists (select 1 from agent.runs where id = p_run_id and tenant_id = p_tenant) then",
    "  if not exists (select 1 from agent.runs where id = p_run_id) then"),
  mAccept("SQL/queue: accept stops writing the first entry, so the prompt is not durable",
    "  insert into agent.run_entries (run_id, seq, body) values (p_run_id, 0, p_entry)\n  on conflict do nothing;",
    "  -- no entry written"),
  mAccept("SQL/queue: accept stops writing the work row, so nothing will ever run it",
    "  insert into agent.run_work (run_id, tenant_id, kind)\n  values (p_run_id, p_tenant, p_kind)\n  on conflict (run_id) do nothing\n  returning * into v_existing;",
    "  select * into v_existing from agent.run_work where run_id = p_run_id;"),
  mAccept("SQL/queue: any entry may be the first one, so a run can start mid-log",
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

  // ── THE FENCE: a write must present the claim it is writing under ─────────
  // **EVERY ONE OF THESE IS THE MEASURED GAP COMING BACK.** The hole was that
  // ownership was answered from a flag in the consumer's own process; each mutant
  // below removes one of the four things the database now checks at write time, or
  // one of the two readings that keep a retry apart from a second writer.
  mAppend("SQL/fence: THE WORK ROW IS NOT LOCKED, so a reclaim fits between the check and the write",
    "  select * into v_work from agent.run_work where run_id = p_run_id for update;",
    "  select * into v_work from agent.run_work where run_id = p_run_id;"),
  mAppend("SQL/fence: THE HOLDER IS NOT CHECKED — anybody may write to anybody's run",
    "  if v_work.claimed_by is null or v_work.claimed_by is distinct from p_worker then\n    return jsonb_build_object('ok', false, 'why', 'not-holder');\n  end if;",
    "  -- no holder check"),
  mAppend("SQL/fence: THE TOKEN IS NOT CHECKED, so a displaced worker sharing a name writes on",
    "  if v_work.claim_token is null or v_work.claim_token is distinct from p_token then\n    return jsonb_build_object('ok', false, 'why', 'bad-token');\n  end if;",
    "  -- no token check"),
  mAppend("SQL/fence: THE LEASE IS NOT CHECKED, so a paused holder writes for as long as it likes",
    "  if v_work.lease_expires_at is null or v_work.lease_expires_at <= now() then\n    return jsonb_build_object('ok', false, 'why', 'lease-expired');\n  end if;",
    "  -- no lease check"),
  mAppend("SQL/fence: FINISHED WORK STILL TAKES WRITES",
    "  if v_work.done_at is not null then\n    return jsonb_build_object('ok', false, 'why', 'finished');\n  end if;",
    "  -- finished work is writable"),
  mAppend("SQL/fence: a run with no work row is written to anyway",
    "  if v_work.run_id is null then\n    return jsonb_build_object('ok', false, 'why', 'no-work');\n  end if;",
    "  -- no work row needed"),
  mAppend("SQL/fence: A DIFFERENT ENTRY IN THE SAME SLOT IS READ AS A DUPLICATE",
    "    if v_body = p_body then\n      return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);",
    "    return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);"),
  mAppend("SQL/fence: AN IDENTICAL RETRY IS READ AS A CONFLICT, so a lost answer kills a paid-for run",
    "    if v_body = p_body then", "    if false then"),
  // **THE ANCHOR CARRIES THE `conflict` LINE AFTER IT, and that is not tidiness.**
  // The `already` answer occurs TWICE — once in the main path and once in the
  // unique-violation handler, which is a deliberate redundancy — so the shorter
  // anchor was AMBIGUOUS and the pre-check refused it. Naming the neighbour is what
  // makes it the main path's.
  mAppend("SQL/fence: the `already` answer does not say where the entry really is",
    "return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);",
    "return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', null);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);"),
  // **THE LEADING NEWLINE PINS THE INDENT, and without it this anchor is a SUBSTRING
  // of the handler's own copy** (six spaces contains four) — the recorded "a mutant
  // whose anchor is a substring of another's", arriving through indentation.
  mAppend("SQL/fence: a taken position is reported as a conflict, so the caller stops instead of moving up",
    "\n    return jsonb_build_object('ok', false, 'why', 'position', 'seq', p_seq);",
    "\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', p_seq);"),
  mAppend("SQL/fence: an empty or blank worker is accepted",
    "  if p_worker is null or btrim(p_worker) = '' then\n    raise exception 'append_entry: worker must be a non-empty string';\n  end if;",
    "  -- any worker will do"),
  mAppend("SQL/fence: A NULL TOKEN IS READ AS NOT NEEDING ONE",
    "  if p_token is null then\n    raise exception 'append_entry: the claim token is required';\n  end if;",
    "  -- no token needed"),
  mAppend("SQL/fence: THE SERVICE ROLE KEEPS ITS DIRECT INSERT, so the fence can be walked around",
    "revoke insert on agent.run_entries from service_role;", "-- the direct door stays open"),
  mAppend("SQL/fence: the fence is granted to signed-in customers",
    "grant execute on function agent.append_entry(uuid, integer, jsonb, text, uuid) to service_role;",
    "grant execute on function agent.append_entry(uuid, integer, jsonb, text, uuid) to service_role, authenticated;"),
  mAppend("SQL/fence: a claimed row may exist with no token",
    "  or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null and claim_token is not null)",
    "  or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null)"),
  mAppend("SQL/fence/CONTROL (comment only)", "-- FENCING THE JOURNAL:", "-- FENCING THE JOURNAL (control):", true),

  // ── SENDING A MESSAGE STARTS A RUN ────────────────────────────────────────
  //
  // The guarantees the notes make loudest about it: one press is one message and one
  // run, the run's shape is the server's, the snapshot is read in the transaction, and
  // the answer is read from the run because a message row cannot hold one.
  mSend("SQL/send: THE KEY IS NOT REQUIRED, so an unkeyed send inserts every time",
    "  if v_key is null then\n    raise exception 'send_to_agent: a send needs its own key, or a retry cannot be told from a new message';\n  end if;",
    "  -- an unkeyed send is fine"),
  // ⚠ NOT `on conflict do nothing` (bare) — MEASURED INERT, on two throwaway
  // databases built from these same migrations. A bare clause still absorbs the
  // send-key conflict, so a duplicate press answers `repeat: true` with one
  // message and one run either way; the ONLY observable difference is which
  // refusal a REUSED MESSAGE ID gets (`agent_messages_pkey` as written, the
  // function's own "conflicted with a row that is not there" bare) and both
  // refuse having written nothing. So the clause is DELETED instead, which
  // attacks the guarantee itself: a retry then RAISES where it must answer.
  //
  // (That "row that is not there" branch is reachable rather than paranoid —
  // under READ COMMITTED a racing press can have its insert skipped by a row
  // that is not committed yet and is therefore invisible to the select below.)
  mSend("SQL/send: the duplicate is not absorbed, so a retry is refused instead of answered",
    "    on conflict (agent_id, send_key) where send_key is not null\n    do nothing\n    returning * into v_msg;",
    "    returning * into v_msg;"),
  mSend("SQL/send: AN ABSORBED PRESS STARTS A SECOND RUN ANYWAY",
    "    return jsonb_build_object(\n      'ok', true, 'repeat', true,",
    "    v_msg.id := v_msg.id; return jsonb_build_object(\n      'ok', true, 'repeat', false,"),
  mSend("SQL/send: the ownership check is dropped, so any tenant may write to any agent",
    "  select * into v_agent from agent.agents\n   where id = p_agent_id and tenant_id = p_tenant;",
    "  select * into v_agent from agent.agents\n   where id = p_agent_id;"),
  mSend("SQL/send: a missing agent is a raise rather than a named answer",
    "    return jsonb_build_object('ok', false, 'error', 'no-agent');",
    "    raise exception 'send_to_agent: no such agent';"),
  mSend("SQL/send: the instructions come from nowhere, so a run is started without them",
    "    'instructions', v_agent.instructions,", "    'instructions', null,"),
  mSend("SQL/send: THE HISTORY IS OLDEST-FIRST, so a long conversation is pinned to its first screen",
    "       order by m.seq desc\n       limit agent.history_turns()", "       order by m.seq asc\n       limit agent.history_turns()"),
  mSend("SQL/send: the new message is given to the run as history as well as a prompt",
    "         and m.id <> v_msg.id", "         and true"),
  mSend("SQL/send: a turn whose run never answered is dropped along with its question",
    "        left join agent.runs r on r.id = m.run_id", "        join agent.runs r on r.id = m.run_id"),
  mSend("SQL/send: an unfinished run's text is handed over as though it were an answer",
    "             case when r.stop ->> 'reason' = 'answered' then r.stop ->> 'text' end as answer",
    "             r.stop ->> 'text' as answer"),
  // The two lines the 2026-09-16 review added, each attacked where it decides something.
  mSend("SQL/send: AN ABSORBED PRESS NEVER SAYS ITS WORDS DIFFER, so an edited retry is lost silently",
    "      'mismatch', (v_msg.body is distinct from p_body),",
    "      'mismatch', false,"),
  mSend("SQL/send: the mismatch is answered for every retry, so an ordinary one reads as an edit",
    "      'mismatch', (v_msg.body is distinct from p_body),",
    "      'mismatch', true,"),
  mSend("SQL/send: the message is not linked to the run it started",
    "  update agent.agent_messages set run_id = p_run_id where id = v_msg.id;", "  -- no link"),
  // ⚠ THIS WAS A NO-OP STATEMENT APPENDED AFTER THE ACCEPT — a mutant whose
  // label named a reorder and whose text added `perform 1;`, which changes
  // nothing and SURVIVED the sweep saying exactly that. The property is what the
  // absorb branch buys: skip it and a duplicate press runs straight past, mints a
  // second run under the new id and links it to nothing — the orphan the queue
  // would then execute. Expressible as one line, and observable.
  // RE-ANCHORED: the absorbed answer has ONE producer now, reached by `not v_new`,
  // so the branch to skip is that one rather than a second copy of it.
  mSend("SQL/send: THE ABSORB BRANCH IS SKIPPED, so a duplicate press mints a second run linked to nothing",
    "  if not v_new then\n    return jsonb_build_object(", "  if false then\n    return jsonb_build_object("),
  mSend("SQL/send: it is granted to signed-in customers, who could then start work as anybody",
    "grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role;",
    "grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role, authenticated;"),
  // RE-ANCHORED, NOT APPEASED. This spanned the next line to be unambiguous, and the
  // `mismatch` line landed between them — caught by the generator's census before the
  // run, which is the whole reason that census exists. It reaches BACKWARD now, to the
  // comment above the field, so a line added below it cannot break it again.
  mSend("SQL/send: the answer echoes what was sent rather than what is stored",
    "      -- for and absorbed.\n      'body', v_msg.body,", "      -- for and absorbed.\n      'body', p_body,"),
  // RE-ANCHORED ONTO THE BOUNDS AS THEY ARE: `toolCalls` moved from 1 to 2 the day a
  // tool became reachable, measured — a budget of one is one already spent.
  mAuthored("SQL/send: the run's bounds are widened",
    "      'steps', 3,\n      'toolCalls', 2,", "      'steps', 16,\n      'toolCalls', 64,"),
  mAuthored("SQL/send: THE TOOL BUDGET IS ZERO, which stops every authored run before its first call",
    "      'toolCalls', 2,\n      'parallelTools', 8,", "      'toolCalls', 0,\n      'parallelTools', 8,"),
  mThread("SQL/thread: the view is NOT security_invoker, so it is a hole through RLS on three tables",
    "create or replace view agent.agent_thread\n  with (security_invoker = true) as",
    "create or replace view agent.agent_thread as"),
  mThread("SQL/thread: a message with no run is dropped from the conversation",
    "from agent.agent_messages m\nleft join agent.runs r on r.id = m.run_id",
    "from agent.agent_messages m\njoin agent.runs r on r.id = m.run_id"),
  mThread("SQL/thread: the progress is a count of entries rather than the log's highest step",
    "  select max(e.step) as step from agent.run_entries e where e.run_id = m.run_id",
    "  select count(*)::int as step from agent.run_entries e where e.run_id = m.run_id"),
  mThread("SQL/thread: anon can read the conversation",
    "revoke all on agent.agent_thread from anon;", "grant select on agent.agent_thread to anon;"),
  mLink("SQL/link: a retained run takes the customer's writing with it",
    "alter table agent.agent_messages add column if not exists run_id uuid\n  references agent.runs (id) on delete set null;",
    "alter table agent.agent_messages add column if not exists run_id uuid\n  references agent.runs (id) on delete cascade;"),
  mLink("SQL/link: the send key is unique per TENANT rather than per conversation",
    "create unique index if not exists messages_one_send_per_agent\n  on agent.agent_messages (agent_id, send_key)\n  where send_key is not null;",
    "create unique index if not exists messages_one_send_per_agent\n  on agent.agent_messages (send_key)\n  where send_key is not null;"),
  // RE-ANCHORED: `send_to_agent` now lives in the settings migration, whose header is
  // its own. A control has to be a comment in the file the mutants really target.
  mSend("SQL/send/CONTROL (comment only)",
    "-- ── the one transaction, now with a status and a selection ───────────────────",
    "-- ── the one transaction, with a status and a selection ──────────────────────", true),


  // ── the settings: a status, a selection, and what a run may call ──────────
  //
  // The two columns are the first thing on this side a PERSON configures, and the
  // pause is the first refusal that is not about ownership. Every mutant here is an
  // edit somebody could really make: a default flipped, a check widened, a gate
  // moved, a key dropped out of the entry.
  mSettings("SQL/settings: a new agent defaults to PAUSED, stopping every conversation there is",
    "add column if not exists status text not null default 'active'",
    "add column if not exists status text not null default 'paused'"),
  mSettings("SQL/settings: the status column admits anything at all",
    "check (status in ('active', 'paused'));", "check (status is not null);"),
  mSettings("SQL/settings: the cap on a stored selection is lifted",
    "coalesce(array_length(tools, 1), 0) <= 32", "coalesce(array_length(tools, 1), 0) <= 3200"),
  mSettings("SQL/settings: a name outside the provider's grammar can be stored",
    "and array_to_string(tools, ',') ~ '^([a-zA-Z0-9_-]{1,64}(,[a-zA-Z0-9_-]{1,64})*)?$'",
    "and array_to_string(tools, ',') ~ '^(.{1,64}(,.{1,64})*)?$'"),
  mSettings("SQL/settings: a NULL among the tool names is stored rather than refused",
    "and array_position(tools, null) is null", "and true"),
  mOverview("SQL/settings: the list screen stops reading the status",
    "  last.body as last_message,\n  a.status,\n  a.tools",
    "  last.body as last_message,\n  null::text as status,\n  a.tools"),
  mSettings("⚠ SQL/send: a paused agent starts work anyway",
    "    if v_agent.status <> 'active' then", "    if false then"),
  mSettings("⚠ SQL/send: the pause is asked BEFORE the key, so a lost answer cannot be retried",
    "  select * into v_msg from agent.agent_messages\n   where agent_id = p_agent_id and send_key = v_key;\n\n  if v_msg.id is null then",
    "  select * into v_msg from agent.agent_messages\n   where agent_id = p_agent_id and send_key = v_key;\n\n  if true then"),
  mSettings("⚠ SQL/send: a racing twin's press is treated as a new message",
    "    v_new := v_msg.id is not null;", "    v_new := true;"),
  mSettings("SQL/send: the run is started with no selection whatever the agent holds",
    "    'tools',        to_jsonb(v_agent.tools),", "    'tools',        '[]'::jsonb,"),
  mSettings("SQL/send: the selection never reaches the run's own record",
    "    'tools',        to_jsonb(v_agent.tools),\n", ""),
  mSettings("SQL/settings: the tool budget goes back to one, which lets a run start and not finish",
    "      'steps', 3,\n      'toolCalls', 2,", "      'steps', 3,\n      'toolCalls', 1,"),
  mSettings("SQL/settings/CONTROL (comment only)",
    "-- AGENT SETTINGS: A STATUS, AND A SELECTION OF TOOLS.",
    "-- Agent settings: a status, and a selection of tools.", true),

  // ── automations: once per occurrence, and what a refusal leaves behind ────
  //
  // Every one of these is an edit somebody could really make while tidying: a
  // `unique` dropped, a deferral removed, a gate turned off, a window widened, an
  // advance forgotten. Not one is a syntax error — a migration that will not apply
  // proves nothing.
  mAuto("⚠ SQL/automations: the once-per-occurrence index stops being unique",
    "create unique index if not exists automation_runs_one_per_occurrence",
    "create index if not exists automation_runs_one_per_occurrence"),
  mAuto("⚠ SQL/automations: the execution's FK stops being DEFERRED, so no accept can probe first",
    "                            deferrable initially deferred,", "                            ,"),
  // ⚠ RE-AIMED, NOT APPEASED: this was pointed at the AUTOMATIONS migration's copy, which the
  // triggers migration drops and re-adds — so it landed on dead SQL and SURVIVED, and the
  // survival read as a test gap. `mConstraint` asks which definition is in force.
  mConstraint("automations_schedule_is_whole")("SQL/automations: a schedule need not be whole",
    "add constraint automations_schedule_is_whole check (\n  case schedule",
    "add constraint automations_schedule_is_whole check (\n  true or case schedule"),
  mAuto("SQL/automations: a stored time need not be whole minutes",
    "    at_local is null or (date_part('second', at_local) = 0", "    true or (date_part('second', at_local) = 0"),
  mAuto("SQL/automations: the workflow cap on the column is lifted",
    "jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20",
    "jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 2000"),
  // ⚠ RE-AIMED: it sat inside the AUTOMATIONS migration's copy, which the triggers migration
  // drops and re-adds — and its anchor NAMES NO CONSTRAINT, which is exactly why the first
  // version of the supersession check could not see it. Asked positionally now.
  mConstraint("automation_runs_occurrence_matches_trigger")(
    "SQL/automations: an execution's occurrence need not match its trigger",
    "check (\n  (trigger = 'manual'   and occurrence is null)",
    "check (\n  true or (trigger = 'manual'   and occurrence is null)"),
  mAuto("SQL/automations: the executor column admits an executor nothing can run",
    "add constraint run_work_executor_known check (executor in ('agent', 'automation'));",
    "add constraint run_work_executor_known check (executor is not null);"),

  mAcceptAuto("⚠ SQL/accept: a DISABLED automation starts work anyway",
    "    if not v_enabled then", "    if false then"),
  mAcceptAuto("⚠ SQL/accept: a PAUSED agent's automations start work anyway",
    "    if v_status is distinct from 'active' then", "    if false then"),
  mAcceptAuto("⚠ SQL/accept: the tenant leaves the lookup, so a stranger can start it",
    "   where a.id = p_automation_id and a.tenant_id = p_tenant;",
    "   where a.id = p_automation_id;"),
  mAcceptAuto("⚠ SQL/accept: the work row is never told which executor wants it",
    "  update agent.run_work set executor = 'automation' where run_id = p_run_id;",
    "  perform 1;"),
  mAcceptAuto("⚠ SQL/accept: a duplicate occurrence is treated as a new execution",
    "    v_new := v_exec.id is not null;", "    v_new := true;"),
  mAcceptAuto("⚠ SQL/accept: the execution is filed with no configuration, so an edit reaches it",
    "      (p_run_id, p_automation_id, v_agent, p_tenant, p_trigger, p_occurrence, v_steps, v_zone,",
    "      (p_run_id, p_automation_id, v_agent, p_tenant, p_trigger, p_occurrence, '[]'::jsonb, v_zone,"),

  // ── M5: a derived identity is only an identity if the database absorbs it ──
  // ⚠ **THE DUPLICATE-RUN-ID PAIR, AND NEITHER HALF CAN BE SWEPT ALONE — MEASURED, and the two
  // mutants that used to sit here are why.** The probe before the insert and the re-read inside
  // the exception handler both turn a duplicate run id into `repeat`; three variants on throwaway
  // databases (as it stands, probe cut, handler cut) answered BYTE-IDENTICALLY and left one row.
  // So both mutants SURVIVED a 976-check suite for the honest reason, and closing that with a new
  // test is impossible: there is no observable difference to assert.
  //
  // The pair cannot be mutated as one either — the two halves are a hundred lines apart and this
  // runner applies ONE replacement per mutant — so it is recorded the way this directory already
  // records that case: a comment-only control over the very paragraph that declares it. If
  // somebody deletes the declaration, this control is killed and says so.
  mAcceptAuto("SQL/accept/CONTROL (comment only): the note declaring the duplicate-id pair",
    "  -- ⚠ **THIS PROBE AND THE RE-READ INSIDE THE EXCEPTION HANDLER BELOW ARE A DECLARED PAIR, AND",
    "  -- The probe and the handler's re-read are a declared pair, measured inert apart (control).", true),
  mAcceptAuto("⚠ SQL/accept: the insert absorbs only the occurrence, so a redelivery raises",
    "    on conflict do nothing\n    returning * into v_exec;",
    "    on conflict (automation_id, occurrence) where occurrence is not null\n    do nothing\n    returning * into v_exec;"),
  mAcceptAuto("⚠ SQL/accept: a run id belonging to ANOTHER automation reads as this one's repeat",
    "     where automation_id = p_automation_id and id = p_run_id;\n  end if;\n",
    "     where id = p_run_id;\n  end if;\n"),

  // ── ⚠ AN ANSWER IS READ AS ITS DECLARED KIND, and a declared list could not be supplied ──
  //
  // This read demanded a STRING of every answer, so a real list came back `bad-input` while the
  // site's own route had already read it as a list and sent it — and the only value a declared
  // list could hold was text, which `repeat … each` then refuses at run time as "not a list".
  // Each mutant below fails in a different direction, and two of them are silent.
  mAcceptAuto("⚠ SQL/accept: every answer must be a string, so a declared LIST cannot be supplied",
    "      if coalesce(v_want, 'text') = 'list' then",
    "      if false then"),
  mAcceptAuto("⚠ SQL/accept: a list may hold anything, so a nested one reaches a step as itself",
    "        if exists (select 1 from jsonb_array_elements(v_given -> v_key) e where jsonb_typeof(e) <> 'string') then",
    "        if false then"),
  mAcceptAuto("⚠ SQL/accept: a declared NUMBER takes its own text, so a comparison reads wrong",
    "      elsif coalesce(v_want, 'text') = 'number' then",
    "      elsif false then"),
  mAcceptAuto("⚠ SQL/accept: a declared TEXT takes a list, which `String(['a'])` collapses",
    "      elsif jsonb_typeof(v_given -> v_key) <> 'string' then",
    "      elsif false then"),
  // ⚠ THE KIND IS READ FROM THE DECLARATION RATHER THAN GUESSED, and the fail-closed direction
  // is text: a declaration with no type is every automation stored before types existed.
  mAcceptAuto("⚠ SQL/accept: the declared kind is ignored and everything is read as a list",
    "      select d ->> 'type' into v_want\n        from jsonb_array_elements(v_decl) d where d ->> 'name' = v_key limit 1;",
    "      select 'list' into v_want\n        from jsonb_array_elements(v_decl) d where d ->> 'name' = v_key limit 1;"),
  // ⚠ AND A REFUSAL THAT DOES NOT SAY WHAT IT WANTED is one nobody can act on — the tool
  // composes its sentence from this field.
  mAcceptAuto("SQL/accept: a kind refusal does not say which kind it wanted",
    "          return jsonb_build_object('ok', false, 'error', 'bad-input', 'name', v_key, 'wanted', 'list');",
    "          return jsonb_build_object('ok', false, 'error', 'bad-input', 'name', v_key);"),
  // ── AN UNANSWERED NAME, AND ITS OWN KIND'S EMPTY VALUE ────────────────────
  mAcceptAuto("⚠ SQL/accept: an unanswered LIST is a blank string, so a loop over it fails",
    "      elsif v_want = 'list' then\n        v_json := '[]'::jsonb;",
    "      elsif false then\n        v_json := '[]'::jsonb;"),
  // ⚠ **THE MUTANT THAT USED TO SIT HERE WAS INERT, MEASURED RATHER THAN ARGUED.** It read
  // the declaration's default as raw JSON (`v_d -> 'default'`) instead of as text
  // (`->>`), which its label called "a coercion the form cannot produce" — an argument.
  // The measurement, on a real PostgreSQL 16 over every shape a default can take: the two
  // expressions are IDENTICAL for a string default (`"a,b"` both ways) and for an absent
  // one (`""` both ways), and differ only for an array (`"[\"a\", \"b\"]"` against
  // `["a","b"]`), a number (`"7"` against `7`) and a JSON `null` (`""` against `null`).
  // Neither door can store any of those three: `typeof d.default === "string" ? d.default
  // : ""` is the coercion in the site's `cleanWorkflow` AND in the engine's `readInputs`.
  // So it could not change an answer for any declaration the platform can hold, and its
  // survival said nothing about the database check.
  //
  // REPLACED BY THE OBSERVABLE HALF OF THE SAME LINE — the default being read at all —
  // which had no case anywhere: both driven declarations set `"default":""`, so ignoring
  // the default entirely was invisible. `''::text` and not `''`, because the untyped
  // literal makes the function ERROR and a mutant that breaks a function is killed for
  // the wrong reason (measured: 6 assertions red, three of them pre-existing, against
  // exactly 3 for the typed one).
  mAcceptAuto("⚠ SQL/accept: the declaration's DEFAULT is ignored, so an unanswered input is blank",
    "        v_json := to_jsonb(coalesce(v_d ->> 'default', ''));",
    "        v_json := to_jsonb(''::text);"),
  mAcceptAuto("⚠ SQL/accept: an EMPTY list counts as an answer, so a required one is never asked for",
    "        when jsonb_typeof(v_json) = 'array'  then jsonb_array_length(v_json) = 0",
    "        when jsonb_typeof(v_json) = 'array'  then false"),
  mAcceptAuto("SQL/accept: a number that arrived is read as unanswered, so `0` is refused",
    "        when jsonb_typeof(v_json) = 'number' then false",
    "        when jsonb_typeof(v_json) = 'number' then (v_json #>> '{}') = '0'"),
  mAcceptAuto("⚠ SQL/accept: the value is stored as text whatever it is, so nothing is a list",
    "      v_vars := v_vars || jsonb_build_object(v_key, v_json);",
    "      v_vars := v_vars || jsonb_build_object(v_key, coalesce(v_json #>> '{}', ''));"),
  mAcceptAuto("SQL/accept/CONTROL (comment only): the note declaring the kind-by-kind read",
    "      -- ⚠ **EACH ANSWER IS READ AS ITS DECLARED KIND, AND REFUSED RATHER THAN COERCED.**",
    "      -- Each answer is read as its declared kind and refused rather than coerced (control).", true),

  mTick("⚠ SQL/tick: the catch-up window becomes unbounded, so downtime IS a burst",
    "           <= make_interval(secs => greatest(0, coalesce(p_catchup_s, 3600))) then",
    "           <= make_interval(secs => 3650 * 86400) then"),
  mTick("⚠ SQL/tick: the schedule is never advanced, so the same day is filed for ever",
    "      update agent.automations set next_run_at = v_next where id = r.id;",
    "      perform 1;"),
  /**
   * ⚠ **RE-ANCHORED, NOT APPEASED: the arithmetic moved into a `case` when the triggers
   * migration widened this function.** It was unconditional and right for `daily`, where
   * every local day IS an occurrence; a weekly schedule would have had days counted as
   * occurrences and a one-off has only ever one. So the mutant keeps its property — a week
   * of missed occurrences must not read as one — and names the arm that still carries it.
   */
  mTick("SQL/tick: a week of missed occurrences is counted as one",
    "            then greatest(1, (v_next at time zone r.zone)::date - v_occ)",
    "            then 1"),
  mAuto("SQL/record: an occurrence recorded unrun is left unfinished, so no history shows it",
    "     p_missed, now())", "     p_missed, null)"),

  mFinishAuto("⚠ SQL/finish: the outcomes are written even when the fence refused",
    "  if coalesce((v_answer -> 'ok')::boolean, false) is not true then\n    return v_answer;\n  end if;\n\n  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES.",
    "  if false then\n    return v_answer;\n  end if;\n\n  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES."),
  mFinishAuto("⚠ SQL/finish: the work is never released, so it is claimed again for ever",
    "  perform agent.release_run(p_run_id, p_worker, p_token, true, null);", "  perform 1;"),

  mHistory("⚠ SQL/automations: the history view runs as its OWNER, past both policies",
    "  with (security_invoker = true)", "  with (security_invoker = false)"),
  mAuto("⚠ SQL/automations: an account reads every account's automations",
    "create policy automations_own_tenant on agent.automations\n  for all\n  using (tenant_id = agent.tenant_id())",
    "create policy automations_own_tenant on agent.automations\n  for all\n  using (true)"),
  mAuto("⚠ SQL/automations: an account may write its own execution history",
    "grant select on agent.automations, agent.automation_runs, agent.automation_history\n  to authenticated, service_role;",
    "grant select, insert, update, delete on agent.automations, agent.automation_runs, agent.automation_history\n  to authenticated, service_role;"),

  mAuto("⚠ SQL/schedule: the local time is read in UTC, so daylight saving moves it",
    "  v_cand  := (v_today + p_at_local) at time zone p_zone;",
    "  v_cand  := (v_today + p_at_local) at time zone 'UTC';"),
  mAuto("SQL/automations/CONTROL (comment only)",
    "-- ⚠ **THE ONCE-PER-OCCURRENCE GUARANTEE, IN THE DATABASE.**",
    "-- The once-per-occurrence guarantee, in the database.", true),

  // ── THE CONTROL: comment-only, and it MUST survive ────────────────────────
  m("SQL/CONTROL (comment only)", "-- ============================================================================\n-- AGENT RUNS:",
    "-- ============================================================================\n-- AGENT RUNS (control):", true),
  mWork("SQL/queue/CONTROL (comment only)", "-- THE DURABLE QUEUE.", "-- THE DURABLE QUEUE (control).", true),

  // ── WAITING, APPROVING AND RESUMING ───────────────────────────────────────
  //
  // A suspended execution is the one state in this schema where a row is meant to sit
  // still, off the queue, holding nothing — so every guarantee here is about what may
  // and may not happen to it while nobody is running it.
  // ⚠ RE-ANCHORED, NOT APPEASED, AND THE PROPERTY MOVED WITH THE CODE. This named
  // `position <= p_position` as half the guard — and that half ASSERTED THE DEFECT: a
  // `repeat` moves the position backwards by design, so it made every checkpoint inside
  // round two a silent no-op. What is monotonic is the OUTCOME COUNT, and that is what the
  // mutant removes now.
  mWkm("⚠ SQL/wait: the outcome count may go BACKWARDS, so a stale worker rewinds a resumed run",
    "     and jsonb_array_length(outcomes) <= jsonb_array_length(p_outcomes);",
    "     and true;"),
  // ⚠ AND THE DEFECT PUT BACK, which is the mutant that only a loop can kill: a second round
  // re-enters the body BELOW the high-water mark the first reached, so a position guard turns
  // every one of its checkpoints into a no-op and strands the execution.
  mWkm("⚠ SQL/wait: the POSITION must only move forward, so a loop's second round records nothing",
    "     and jsonb_array_length(outcomes) <= jsonb_array_length(p_outcomes);",
    "     and position <= p_position\n     and jsonb_array_length(outcomes) <= jsonb_array_length(p_outcomes);"),
  mWkm("⚠ SQL/wait: a RE-PAUSE resolves its deadline again, so a duplicate extends the wait for ever",
    "    if v_exec.wait_until is not null and v_exec.waiting ->> 'step' = p_waiting ->> 'step' then\n      v_until := v_exec.wait_until;",
    "    if false then\n      v_until := v_exec.wait_until;"),
  mWkm("⚠ SQL/wait: the worker is NOT released on a pause, so a suspended run holds its claim",
    "  if p_waiting is not null then\n    v_rel := agent.release_run(p_run_id, p_worker, p_token, true, null);",
    "  if false then\n    v_rel := agent.release_run(p_run_id, p_worker, p_token, true, null);"),
  mWkm("SQL/wait: the journal entry is written AFTER the row moves, so a refused write still advances it",
    "  v_answer := agent.append_entry(p_run_id, v_seq, p_entry, p_worker, p_token);",
    "  v_answer := jsonb_build_object('ok', true, 'stored', true, 'seq', v_seq);"),
  mWkm("SQL/wait: a finished execution can be left WAITING, which is a state nothing resumes",
    "alter table agent.automation_runs add constraint automation_runs_finished_is_not_waiting check (",
    "alter table agent.automation_runs add constraint automation_runs_finished_is_not_waiting check ( true or"),
  // ⚠ **THE WRITE-ONCE ON A DECISION IS A PAIR, AND THE `for update` IS THE HALF THAT DOES THE
  // WORK — measured, after the single mutant survived a test written specifically to kill it.**
  // The predicate alone was mutated here and SURVIVED, so a racing-press test was added; it
  // survived that too. Reproduced by hand on throwaway databases, printing both callers'
  // answers and the stored row: with the predicate and without it, the loser answers
  // `repeat: true, verdict: approved` and the winner's decision stands — BYTE-IDENTICAL.
  //
  // The reason is at the top of the function: its opening read is `select … for update`, so a
  // second press BLOCKS there and then reads the committed row, finds the decision, and never
  // reaches the write block at all. **The two presses cannot interleave, so the predicate is a
  // belt behind a row lock** — which is worth keeping and is not a wall on its own.
  //
  // So the mutant is the PAIR, expressible because both halves sit in one contiguous region of
  // this function, and DERIVED FROM THE FILE rather than pasted: 31 lines of literal in a spec
  // is 31 lines that can drift from the migration silently.
  (() => {
    const t = fs.readFileSync(WKM, "utf8");
    const at = t.indexOf("function agent.decide_automation_approval");
    const a = t.indexOf("     for update;", at);
    const tail = "     where id = p_run_id and not (decisions ? p_step);";
    const b = t.indexOf(tail, a);
    if (a < 0 || b < 0) { console.error("the decision pair's landmarks moved"); process.exit(1); }
    const from = t.slice(a, b + tail.length);
    return mWkm("⚠ SQL/approve: BOTH WALLS DOWN — a racing press overwrites a decision already made",
      from,
      from.replace("     for update;", "     ;").replace(" and not (decisions ? p_step)", ""));
  })(),
  mWkm("⚠ SQL/approve: a decision is recorded for a step the execution is NOT waiting at",
    "  if v_exec.waiting is null\n     or v_exec.waiting ->> 'kind' is distinct from 'approval'\n     or v_exec.waiting ->> 'step' is distinct from p_step then",
    "  if false then"),
  mWkm("⚠ SQL/approve: the decision names whoever ASKED rather than the account that answered",
    "      'by',      coalesce(p_by, p_tenant),", "      'by',      coalesce(p_by, 'someone'),"),
  mWkm("⚠ SQL/resume: two ticks take the SAME rows, so one execution is rung twice at once",
    "     for update skip locked", "     for update"),
  mWkm("SQL/resume: a run that is not yet due is woken anyway", "       and ar.wait_until <= now()", "       and true"),
  /**
   * ⚠ **REPLACED, NOT RE-ANCHORED: the old mutant here was INERT BY CONSTRUCTION and SURVIVED.**
   * It removed `and ar.finished_at is null` from `resume_due_automations` — and
   * `automation_runs_finished_is_not_waiting` forbids a row from being finished AND waiting, so
   * `waiting is not null` already excludes every finished execution. **MEASURED on a real
   * database: zero rows can ever be both**, so no answer moves either way. The clause is a
   * declared second wall (the migration says so where the next reader meets it) and carries no
   * mutant of its own.
   *
   * What IS observable is the CONSTRAINT, which is the wall that really does the work — and
   * closing this found two faults in the check that was supposed to cover it: its fixture's
   * UPDATE was refused by that constraint (so it had never reached the state it described) and
   * its query had ALWAYS errored, which `jget` answers as the empty string.
   */
  mWkm("⚠ SQL/resume: A FINISHED EXECUTION MAY ALSO BE WAITING, so the scheduler re-offers it for ever",
    "alter table agent.automation_runs add constraint automation_runs_finished_is_not_waiting check (\n  finished_at is null or waiting is null\n);",
    "alter table agent.automation_runs add constraint automation_runs_finished_is_not_waiting check (\n  true\n);"),
  mWkm("SQL/resume: the batch is unbounded, so one tick can wake everything at once",
    "     limit greatest(1, coalesce(p_limit, 25))", "     limit 1000000"),

  // ── REFERENCE MATERIAL ────────────────────────────────────────────────────
  mWkm("⚠ SQL/knowledge: a SEARCH crosses accounts, so one account reads another's documents",
    "     where k.tenant_id = p_tenant\n       and k.agent_id = p_agent_id",
    "     where k.agent_id = p_agent_id"),
  mWkm("⚠ SQL/knowledge: a search crosses AGENTS within one account",
    "       and k.agent_id = p_agent_id\n       and to_tsvector('english'", "       and to_tsvector('english'"),
  // ⚠ **THE WALL IS THE `@@` FILTER, AND THE TWO EARLY RETURNS THAT USED TO BE MUTATED HERE ARE
  // NOT WALLS AT ALL — measured, after both survived and both labels turned out to be false.**
  // They read `a query of nothing but stopwords answers EVERY document` and `an empty search
  // answers every document rather than none`, and Postgres does neither: MEASURED with the very
  // `plainto_tsquery` this function uses, an empty query AND a stopword-only query both give a
  // tsquery of **0 nodes**, and `to_tsvector(…) @@` a 0-node tsquery is **false** — so with
  // either guard cut the filter answers NO rows, which is the same answer the guard gives.
  //
  // **THE CODE ALREADY SAID SO and the labels contradicted it**: the first guard's own comment
  // reads "NOTHING SEARCHED FOR IS NOTHING FOUND, and it is not every document." *A mutant's
  // label is a claim about a consequence, and these two asserted one the database refuses to
  // produce* — which is worse than a survivor, because the label is what a reader believes.
  //
  // What the guards really buy is an explicit early return: no pointless scan, and no Postgres
  // NOTICE about a query with no lexemes. Worth keeping, not a wall, and not mutable.
  // So the mutant is aimed at the thing that IS the wall, with the label those two wanted.
  mWkm("⚠ SQL/knowledge: the match filter is gone, so a search answers EVERY document of that agent",
    "       and to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.body, '')) @@ v_q",
    "       and true"),
  mWkm("SQL/knowledge: the answer is the START of the document rather than the matched passage",
    "             'text',    ts_headline('english', k.body, v_q,", "             'text',    left(k.body, 400), 'unused', (("),
  mWkm("SQL/knowledge: two sources of one name per agent, so a retrieval answer names nothing",
    "create unique index if not exists agent_knowledge_one_title_per_agent",
    "create index if not exists agent_knowledge_one_title_per_agent"),
  mWkm("SQL/knowledge: the title match is case-sensitive, so \"Price List\" is a second \"Price list\"",
    "  on agent.agent_knowledge (tenant_id, agent_id, lower(btrim(title)));",
    "  on agent.agent_knowledge (tenant_id, agent_id, title);"),
  mWkm("⚠ SQL/knowledge: an account reads every account's reference material",
    "create policy agent_knowledge_own_tenant on agent.agent_knowledge\n  for all\n  using (tenant_id = agent.tenant_id())",
    "create policy agent_knowledge_own_tenant on agent.agent_knowledge\n  for all\n  using (true)"),
  mWkm("⚠ SQL/knowledge: a client may WRITE reference material directly",
    "grant insert, update, delete on agent.agent_knowledge to service_role;",
    "grant insert, update, delete on agent.agent_knowledge to authenticated, service_role;"),

  // ── MEMORY ────────────────────────────────────────────────────────────────
  mWkm("⚠ SQL/memory: the scope stops being (account, agent), so two accounts share a name",
    "create unique index if not exists agent_memory_one_per_key\n  on agent.agent_memory (tenant_id, agent_id, key);",
    "create unique index if not exists agent_memory_one_per_key\n  on agent.agent_memory (agent_id, key);"),
  mWkm("SQL/memory: one agent's memories are shared with every agent of the account",
    "  on agent.agent_memory (tenant_id, agent_id, key);", "  on agent.agent_memory (tenant_id, key);"),
  mWkm("⚠ SQL/memory: the version does not move on a correction, so a run cannot say which value it used",
    "  if new.value is distinct from old.value then\n    new.version := old.version + 1;",
    "  if false then\n    new.version := old.version + 1;"),
  // ANCHORED WITH ITS OWN NEIGHBOUR: the knowledge touch has the identical line, and a
  // mutant of THAT one is a different property in a different function.
  mWkm("SQL/memory: the version moves on any touch, so renaming nothing counts as a correction",
    "  if new.value is distinct from old.value then\n    new.version := old.version + 1;\n  else\n    new.version := old.version;\n  end if;\n  return new;\nend; $$;\n\ndrop trigger if exists agent_memory_touched",
    "  new.version := old.version + 1;\n  return new;\nend; $$;\n\ndrop trigger if exists agent_memory_touched"),
  mWkm("⚠ SQL/memory: the SNAPSHOT crosses accounts, so an execution is given another's facts",
    "    from agent.agent_memory m\n   where m.tenant_id = p_tenant", "    from agent.agent_memory m\n   where true"),
  mWkm("SQL/memory: a name need not be an identifier, so {{a name}} can never resolve to it",
    "  key        text        not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),",
    "  key        text        not null check (key is not null),"),
  mWkm("⚠ SQL/memory: an account reads every account's saved facts",
    "create policy agent_memory_own_tenant on agent.agent_memory\n  for all\n  using (tenant_id = agent.tenant_id())",
    "create policy agent_memory_own_tenant on agent.agent_memory\n  for all\n  using (true)"),
  mWkm("⚠ SQL/memory: a client may WRITE memories directly, past the route that scopes them",
    "grant insert, update, delete on agent.agent_memory to service_role;",
    "grant insert, update, delete on agent.agent_memory to authenticated, service_role;"),
  mWkm("SQL/memory: a source nothing writes is admitted, so provenance can say anything",
    "  constraint agent_memory_source_known check (source in ('person', 'run'))",
    "  constraint agent_memory_source_known check (source is not null)"),

  // ── WHAT AN EXECUTION IS GIVEN ────────────────────────────────────────────
  mWkm("⚠ SQL/inputs: an answer nothing asked for is accepted and silently ignored",
    "alter table agent.automations add constraint automations_inputs_shaped check (",
    "alter table agent.automations add constraint automations_inputs_shaped check ( true or"),
  mWkm("⚠ SQL/history: the execution view runs as its OWNER, past both policies",
    "  with (security_invoker = true)\nas\n  select ar.id,", "  with (security_invoker = false)\nas\n  select ar.id,"),
  mWkm("SQL/journal: a `step` entry may name no step, so progress says nothing about where it got to",
    "    when 'step'    then body ->> 'step' is not null and body ->> 'index' is null",
    "    when 'step'    then true"),
  mWkm("SQL/journal: the widened kind list admits a kind nothing writes or reads",
    "  check (body ->> 'kind' in ('started', 'model', 'tool', 'stopped', 'step'));",
    "  check (body ->> 'kind' is not null);"),
  mWkm("SQL/wkm/CONTROL (comment only)",
    "-- ⚠ THE SCOPE, IN THE DATABASE. Without this,",
    "-- The scope, in the database. Without this,", true),

  // ── AN OPERATION HAPPENS ONCE ─────────────────────────────────────────────
  // ⚠ THE DEFECT THESE GUARD WAS REPRODUCED FIRST: a retry of `remember` overwrote a
  // person's correction, `corrected` v3 over their v2, and ANSWERED that it had changed
  // something while nothing was looking.
  mOps("⚠ SQL/ops: the key is not scoped to the account, so one tenant answers another's retry",
    "  primary key (tenant_id, op_key),", "  primary key (op_key),"),
  // ⚠ **REPLACED 2026-09-18, NOT APPEASED: this mutant REMOVED `outcome … not null` and the
  // column is nullable now, on purpose.** It was the column-level half of "a repeat is
  // answered with nothing", which two mutants below already carry at the reader
  // (`operation_check` answering `unfinished`) and at the writer (`operation_record` refusing
  // a null) — so putting the constraint back is no longer available and asserting it would be
  // a guard demanding the defect. What the `not null` also half-carried is *an answer that
  // cannot move*, and that now lives in `operation_settle`'s WHERE, which is where the
  // replacement points.
  mOps("⚠ SQL/ops: a settled operation can be RE-SETTLED, so its answer moves",
    "     and outcome is null\n  returning * into v_row;", "\n  returning * into v_row;"),
  mOps("⚠ SQL/ops: a record can be REWRITTEN, so a retry cannot be answered from it",
    "revoke update, delete on agent.operations from service_role;",
    "grant update, delete on agent.operations to service_role;"),
  mOps("SQL/ops: a tenant may write its own records",
    "grant select on agent.operations to authenticated;",
    "grant select, insert on agent.operations to authenticated;"),
  mOps("SQL/ops: the records are readable by every account",
    "  for select to authenticated using (tenant_id = agent.tenant_id());",
    "  for select to authenticated using (true);"),
  mOps("SQL/ops: row level security is not forced, so the owner is exempt",
    "alter table agent.operations force row level security;",
    "-- not forced"),
  mOps("SQL/ops: the helpers are callable by a signed-in customer, who could name any account",
    "grant execute on function agent.operation_check(text, text, text, text) to service_role;",
    "grant execute on function agent.operation_check(text, text, text, text) to service_role, authenticated;"),

  // ⚠ THE RULE ITSELF. Each of these is one reading of the record going wrong, and the
  // three answers need three different things done about them.
  // ⚠ **RE-ANCHORED 2026-09-18: `operation_begin` and `operation_settle` joined this file and
  // each makes the same comparison, so the bare line now occurs THREE times.** The generator
  // refused rather than pointing these at whichever came first — the pre-check working, and
  // the recorded "an anchor can be a substring of its own neighbour" one file over. They are
  // pinned to `operation_check`'s own answer below the test, which no other function writes.
  mOps("⚠ SQL/ops: the ARGUMENTS are not compared, so a re-filled slot is answered as a repeat",
    "  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then\n    return jsonb_build_object('state', 'mismatch'",
    "  if v_row.action <> p_action then\n    return jsonb_build_object('state', 'mismatch'"),
  mOps("⚠ SQL/ops: the ACTION is not compared, so one key answers another kind of work",
    "  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then\n    return jsonb_build_object('state', 'mismatch'",
    "  if v_row.args_hash <> p_args_hash then\n    return jsonb_build_object('state', 'mismatch'"),
  mOps("SQL/ops: a claim with no outcome is read as a repeat with nothing in it",
    "  if v_row.outcome is null then\n    return jsonb_build_object('state', 'unfinished');\n  end if;",
    "  if false then\n    return jsonb_build_object('state', 'unfinished');\n  end if;"),
  // ⚠ RE-ANCHORED for the same reason: `operation_begin` claims its slot with the same clause.
  // Pinned by the line above it, which is `operation_record`'s own outcome parameter.
  mOps("⚠ SQL/ops: a second record overwrites the first, so the answer moves",
    "  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, p_outcome)\n  on conflict (tenant_id, op_key) do nothing;",
    "  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, p_outcome)\n  on conflict (tenant_id, op_key) do update set outcome = excluded.outcome;"),

  // ── ⚠ THE IN-FLIGHT DOOR, which is this round's own product code ──────────────
  //
  // `operation_begin` claims a slot BEFORE an outbound call and `operation_settle` fills it
  // in afterwards. Neither existed when the mutants above were written, and between them they
  // are what makes "sent, outcome unknown" a state rather than a gap.
  mOps("⚠ SQL/ops: beginning an operation records its outcome, so nothing is ever in flight",
    "  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, null)",
    "  values (p_tenant, p_op_key, p_action, p_args_hash, p_run_id, '{}'::jsonb)"),
  mOps("⚠ SQL/ops: a slot somebody else holds is claimed anyway, so two callers both send",
    "  on conflict (tenant_id, op_key) do nothing;\n  get diagnostics v_rows = row_count;\n  if v_rows = 1 then\n    return jsonb_build_object('ok', true, 'began', true);",
    "  on conflict (tenant_id, op_key) do nothing;\n  get diagnostics v_rows = row_count;\n  if true then\n    return jsonb_build_object('ok', true, 'began', true);"),
  mOps("⚠ SQL/ops: an in-flight slot is read as a plain repeat, so a caller answers nothing",
    "  if v_row.outcome is null then\n    return jsonb_build_object('ok', true, 'began', false, 'state', 'unfinished');",
    "  if false then\n    return jsonb_build_object('ok', true, 'began', false, 'state', 'unfinished');"),
  mOps("⚠ SQL/ops: beginning does not compare the identity, so one slot serves other work",
    "  if v_row.action <> p_action or v_row.args_hash <> p_args_hash then\n    return jsonb_build_object('ok', false, 'error', 'mismatch', 'action', v_row.action);\n  end if;\n  if v_row.outcome is null then\n    return jsonb_build_object('ok', true, 'began', false, 'state', 'unfinished');",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'mismatch', 'action', v_row.action);\n  end if;\n  if v_row.outcome is null then\n    return jsonb_build_object('ok', true, 'began', false, 'state', 'unfinished');"),
  mOps("⚠ SQL/ops: settling does not compare the identity, so another call's answer lands",
    "   where tenant_id = p_tenant and op_key = p_op_key\n     and action = p_action and args_hash = p_args_hash",
    "   where tenant_id = p_tenant and op_key = p_op_key\n     and action = p_action"),
  mOps("SQL/ops: settling with no outcome is accepted, so an answer of nothing is stored",
    "    raise exception 'operation_settle: an outcome is required' using errcode = 'check_violation';",
    "    p_outcome := '{}'::jsonb;"),
  mOps("SQL/ops: an already-settled operation reads as a FAILURE rather than as what stands",
    "  return jsonb_build_object('ok', true, 'settled', false, 'outcome', v_row.outcome);",
    "  return jsonb_build_object('ok', false, 'error', 'already');"),
  mOps("SQL/ops: recording always claims to have won, so a lost race is read as a win",
    "  get diagnostics v_rows = row_count;\n  return v_rows = 1;",
    "  get diagnostics v_rows = row_count;\n  return true;"),
  mOps("SQL/ops: an outcome-less record is written rather than refused",
    "    raise exception 'operation_record: an outcome is required' using errcode = 'check_violation';",
    "    p_outcome := '{}'::jsonb;"),

  // ⚠ THE WRAPPERS. All six share one body, so these are aimed at `save_memory_once` by
  // naming the action beside the line — the one the reproduction is about.
  mOps("⚠ SQL/ops: a repeat is not answered, so the work is done again",
    "  v_check := agent.operation_check(p_tenant, p_op_key, 'save_memory', p_args_hash);\n  if v_check ->> 'state' = 'repeat' then",
    "  v_check := agent.operation_check(p_tenant, p_op_key, 'save_memory', p_args_hash);\n  if false then"),
  mOps("⚠ SQL/ops: a mismatch is run rather than refused, so a re-filled slot writes",
    "    v_out := agent.save_memory(p_tenant := p_tenant, p_agent_id := p_agent_id, p_key := p_key, p_value := p_value, p_id := p_id, p_source := p_source, p_max := p_max);\n    if not agent.operation_record(p_tenant, p_op_key, 'save_memory', p_args_hash, p_op_run, v_out) then",
    "    v_out := agent.save_memory(p_tenant := p_tenant, p_agent_id := p_agent_id, p_key := p_key, p_value := p_value, p_id := p_id, p_source := p_source, p_max := p_max);\n    if false then"),
  mOps("SQL/ops: the repeat is not marked, so a caller cannot tell it from new work",
    "'save_memory', p_args_hash);\n  if v_check ->> 'state' = 'repeat' then\n    -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT.",
    "'save_memory', p_args_hash);\n  if v_check ->> 'state' = 'repeat' then\n    return (v_check -> 'outcome');\n  -- ANSWER WHAT HAPPENED, MARKED AS A REPEAT."),
  // Aimed at ONE wrapper by its own residue line, which names its action — six wrappers share
  // the body, so anything above that line occurs six times.
  mOps("⚠ SQL/ops: a genuine refusal is swallowed as a lost race",
    "      raise exception '%', v_msg using errcode = v_state;\n    end if;\n    -- `AG001` with no twin to read is the one residue: the record was taken and is gone\n    -- again, which means the twin rolled back after winning the key. Named rather than\n    -- retried here, because a retry belongs to whoever can decide to make one.\n    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'save_memory');",
    "    end if;\n    return jsonb_build_object('ok', false, 'error', 'operation-lost', 'action', 'save_memory');"),
  mOps("SQL/ops/CONTROL (comment only)",
    "-- ⚠ THE DEFECT THIS CLOSES WAS REPRODUCED FIRST, against these migrations on a real",
    "-- The defect this closes was reproduced first, against these migrations on a real", true),

  // ── EXPIRY, REVOCATION AND CANCELLATION ───────────────────────────────────
  //
  // ⚠ TWO OF THESE GUARD DEFECTS THAT WERE REPRODUCED FIRST. A run waiting for a person has
  // its work row marked DONE, so anything that answers a request INSTEAD of a person has to
  // put the run back — and neither the expiry nor the revocation did.
  mRequest("⚠ SQL/window: a request is stamped with no window, so nothing can ever expire",
    "          p_step, p_idx, p_tool, coalesce(p_args, '{}'::jsonb), p_hash, now() + agent.approval_window())",
    "          p_step, p_idx, p_tool, coalesce(p_args, '{}'::jsonb), p_hash, null)"),
  mRequest("⚠ SQL/window: expiry is not derived, so a request nobody answered reads as still pending",
    "    when v_row.expires_at is not null and v_row.expires_at <= now() then 'expired'\n    else null end;",
    "    else null end;"),
  mRequest("⚠ SQL/window: `expired` answers null rather than false — cannot-tell as a value",
    "    'expired', coalesce(v_state = 'expired', false),", "    'expired', v_state = 'expired',"),
  mRequest("⚠ SQL/revocation: a person is asked about a call whose permission was withdrawn",
    "  if p_agent_id is not null and exists (\n        select 1 from agent.tool_revocations r\n         where r.tenant_id = p_tenant and r.agent_id = p_agent_id and r.tool = p_tool) then",
    "  if false then"),
  mDecide("⚠ SQL/window: an EXPIRED request can still be approved",
    "  if v_row.expires_at is not null and v_row.expires_at <= now() then\n    return jsonb_build_object('ok', false, 'error', 'expired', 'id', v_row.id,\n                              'run', v_row.run_id, 'expiresAt', v_row.expires_at);\n  end if;",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'expired');\n  end if;"),
  mDecide("SQL/window: `revoked` can be set through the approve/reject door",
    "  if p_verdict is null or p_verdict not in ('approved', 'rejected') then",
    "  if p_verdict is null or p_verdict not in ('approved', 'rejected', 'revoked') then"),
  mDecide("⚠ SQL/revocation: a request whose permission was withdrawn can still be decided",
    "  if v_row.agent_id is not null and exists (\n        select 1 from agent.tool_revocations r\n         where r.tenant_id = p_tenant and r.agent_id = v_row.agent_id and r.tool = v_row.tool) then",
    "  if false then"),
  mCtrl("SQL/revocation: a revocation can be EDITED, so one wears another's timestamp",
    "revoke update on agent.tool_revocations from service_role;",
    "grant update on agent.tool_revocations to service_role;"),
  mCtrl("SQL/revocation: a customer may write its own revocations",
    "grant select on agent.tool_revocations to authenticated;",
    "grant select, insert, delete on agent.tool_revocations to authenticated;"),
  mCtrl("SQL/revocation: every account can read every revocation",
    "  for select to authenticated using (tenant_id = agent.tenant_id());",
    "  for select to authenticated using (true);"),
  mCtrl("SQL/revocation: row level security is not forced, so the owner is exempt",
    "alter table agent.tool_revocations force row level security;",
    "-- force row level security removed"),
  // RE-ANCHORED, NOT APPEASED: the WHERE gained the "and its run has not ended" clause below,
  // so this mutant's old anchor ran to `returning` through text that no longer sits there. The
  // property is unchanged — nothing is withdrawn at all — and the anchor is the two lines it is
  // really about rather than the whole clause.
  mRevoke("⚠ SQL/revocation: the requests still waiting for that tool are left pending",
    "     where a.tenant_id = p_tenant and a.agent_id = p_agent_id\n       and a.tool = p_tool and a.verdict is null",
    "     where false"),
  /**
   * ⚠ **AND THE OTHER DIRECTION: a request whose run has ALREADY ENDED must be left alone.**
   * Without the clause, an EXPIRED-but-undecided request (an expiry is derived from the clock
   * and never written as a verdict) was withdrawn and its FINISHED run requeued — delivered,
   * re-run, conflicting at the fence, released unfinished, and offered again every minute.
   * MEASURED on `verify:send`: `attempts: 4` and climbing. Guarded in `pg-schema.mjs`, which
   * asserts BOTH the undecided request and the run staying off the queue, with the live run
   * beside it as its control.
   */
  // ⚠ **ANCHORED BY ITS FOLLOWING LINE, because the expression is the expiry sweep's own.**
  // Reusing it rather than inventing one is deliberate, and it makes the two anchors identical:
  // the generator's own pre-check refused both as AMBIGUOUS rather than letting a mutant land in
  // whichever function came first. `returning a.run_id` is the revocation's, `-- ...AND NOTHING`
  // is the sweep's.
  mRevoke("⚠ SQL/revocation: A FINISHED RUN IS WITHDRAWN AND PUT BACK ON THE QUEUE FOR EVER",
    "                        where e.run_id = a.run_id and e.body ->> 'kind' = 'stopped')\n    returning a.run_id",
    "                        where true)\n    returning a.run_id"),
  mRevoke("⚠ SQL/revocation: the run it just answered is NOT put back, so it is stranded for ever",
    "    v_back := agent.requeue_run(v_run.run_id, p_tenant);\n    if v_back ->> 'state' = 'queued' then",
    "    v_back := jsonb_build_object('state', 'skipped');\n    if v_back ->> 'state' = 'queued' then"),
  mRevoke("SQL/revocation: a withdrawal nobody can be tied to is accepted",
    "  if p_by is null or btrim(p_by) = '' then\n    return jsonb_build_object('ok', false, 'error', 'no-decider');\n  end if;\n  if p_tool is null or p_tool !~ '^[a-zA-Z0-9_-]{1,64}$' then",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'no-decider');\n  end if;\n  if p_tool is null or p_tool !~ '^[a-zA-Z0-9_-]{1,64}$' then"),
  mRevoke("SQL/revocation: any text at all is stored as a tool name",
    "  if p_tool is null or p_tool !~ '^[a-zA-Z0-9_-]{1,64}$' then\n    return jsonb_build_object('ok', false, 'error', 'bad-tool');\n  end if;",
    "  if p_tool is null then\n    return jsonb_build_object('ok', false, 'error', 'bad-tool');\n  end if;"),
  mRevoke("⚠ SQL/revocation: another account can take a tool away from this agent",
    "  if not agent.owns_agent(p_tenant, p_agent_id) then\n    return jsonb_build_object('ok', false, 'error', 'no-agent');\n  end if;\n  insert into agent.tool_revocations",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'no-agent');\n  end if;\n  insert into agent.tool_revocations"),
  mRevokedList("⚠ SQL/revocation: what is revoked is not scoped to the AGENT, so a sibling loses the tool",
    "   where r.tenant_id = p_tenant and r.agent_id = p_agent_id\n   order by r.tool;",
    "   where r.tenant_id = p_tenant\n   order by r.tool;"),
  mRevokedList("⚠ SQL/revocation: ...nor to the ACCOUNT",
    "  select r.tool from agent.tool_revocations r", "  select r.tool from agent.tool_revocations r where true or"),
  mRestore("⚠ SQL/revocation: lifting a revocation re-opens the requests it withdrew",
    "  delete from agent.tool_revocations r\n   where r.tenant_id = p_tenant and r.agent_id = p_agent_id and r.tool = p_tool;",
    "  delete from agent.tool_revocations r\n   where r.tenant_id = p_tenant and r.agent_id = p_agent_id and r.tool = p_tool;\n  update agent.tool_approvals a set verdict = null, decided_at = null, decided_by = null\n   where a.tenant_id = p_tenant and a.agent_id = p_agent_id and a.tool = p_tool and a.verdict = 'revoked';"),
  // ⚠ ANCHORED WITH ITS NEIGHBOUR, because `revoke_tool_approval` reads the row and then
  // updates it and both carry the same filter — the pre-check caught it as ambiguous.
  mWithdraw("SQL/withdraw: another account's request can be taken back",
    "  end if;\n  select * into v_row from agent.tool_approvals a\n   where a.id = p_id and a.tenant_id = p_tenant",
    "  end if;\n  select * into v_row from agent.tool_approvals a\n   where a.id = p_id"),
  mCancel("⚠ SQL/cancel: the stop is written at the top level, so the run ends with nothing saying how",
    "    'stop', jsonb_build_object(\n      'reason', 'cancelled',", "    'reason', 'cancelled',\n    'unread', jsonb_build_object("),
  mCancel("⚠ SQL/cancel: pending work is left claimable, so the run is delivered again",
    "  update agent.run_work w\n     set claimed_by = null, claimed_at = null, lease_expires_at = null, claim_token = null,\n         done_at = now(), last_error = 'cancelled'\n   where w.run_id = p_run_id and w.done_at is null;",
    "  -- the work row is left exactly as it was"),
  mCancel("⚠ SQL/cancel: the wait is left, so the resume tick wakes something that has stopped",
    "  update agent.automation_runs ar\n     set waiting = null, wait_until = null, finished_at = coalesce(ar.finished_at, now())\n   where ar.id = p_run_id and (ar.waiting is not null or ar.wait_until is not null);",
    "  perform 1 from agent.automation_runs ar where ar.id = p_run_id;"),
  mCancel("⚠ SQL/cancel: a request is left on somebody's screen for a run that has stopped",
    "  update agent.tool_approvals a\n     set verdict = 'revoked', decided_at = now(), decided_by = p_by,\n         note = coalesce(p_reason, 'the run was cancelled')\n   where a.run_id = p_run_id and a.verdict is null;",
    "  -- anything waiting is left waiting"),
  mCancel("⚠ SQL/cancel: cancelling twice writes a SECOND ending over the first",
    "  if exists (select 1 from agent.run_entries e where e.run_id = p_run_id and e.kind = 'stopped') then",
    "  if false then"),
  mCancel("SQL/cancel: a cancellation nobody can be tied to is accepted",
    "  if p_by is null or btrim(p_by) = '' then\n    return jsonb_build_object('ok', false, 'error', 'no-decider');\n  end if;\n  select * into v_run from agent.runs r",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'no-decider');\n  end if;\n  select * into v_run from agent.runs r"),
  mCancel("⚠ SQL/cancel: another account can stop this run",
    "   where r.id = p_run_id and r.tenant_id = p_tenant\n     for update;", "   where r.id = p_run_id\n     for update;"),
  mCancel("⚠ SQL/cancel: what had already completed is reported as nothing",
    "    into v_steps, v_tools, v_seq\n    from agent.run_entries e where e.run_id = p_run_id;",
    "    into v_steps, v_tools, v_seq\n    from agent.run_entries e where e.run_id = p_run_id and false;"),
  mCancel("⚠ SQL/cancel: the answer claims the work was undone",
    "    'say', 'stopped — what had already run has already run and was not undone');",
    "    'say', 'stopped — everything it had done was rolled back');"),
  mExpiredSweep("⚠ SQL/expiry: a run somebody can still answer is woken, so it is requeued for ever",
    "       and not exists (select 1 from agent.tool_approvals b\n                        where b.run_id = a.run_id and b.verdict is null\n                          and (b.expires_at is null or b.expires_at > now()))",
    "       and true"),
  // RE-ANCHORED, NOT APPEASED: the revocation now carries the identical expression, so this
  // anchor stopped being unique the day that landed. Pinned by its own following line.
  mExpiredSweep("⚠ SQL/expiry: a run that has already ended is offered again, once a minute for ever",
    "                        where e.run_id = a.run_id and e.body ->> 'kind' = 'stopped')\n       -- ...AND NOTHING IT IS WAITING FOR MAY STILL BE ANSWERED",
    "                        where true)\n       -- ...AND NOTHING IT IS WAITING FOR MAY STILL BE ANSWERED"),
  mExpiredSweep("⚠ SQL/expiry: nothing is put back at all, so the run is stranded",
    "    v_back := agent.requeue_run(v_run.run_id, v_run.tenant_id);",
    "    v_back := jsonb_build_object('state', 'skipped');"),
  // ⚠ **RE-ANCHORED, NOT APPEASED, when the sweep proved the CALLER's own filter undrivable.**
  // This used to read `if v_back ->> 'state' = 'queued' then return next …` — a row somebody
  // holds was skipped silently, so nothing anywhere ever handed `worker.scheduled` a row it
  // had to refuse to ring, and its `action === "requeued"` test SURVIVED the JS sweep. The
  // function reports both outcomes now and names which, so the property here moved from
  // *is a held row reported at all* to *does its action say which it was* — strictly
  // stronger, because the old spelling could not tell a wrong action from a missing row.
  mExpiredSweep("⚠ SQL/expiry: a run somebody is holding is reported as requeued, so the caller rings it",
    "      'action', case when v_back ->> 'state' = 'queued' then 'requeued' else 'held' end,",
    "      'action', 'requeued',"),
  mExpiredSweep("SQL/expiry: a held row is dropped instead of reported, so nobody can see it was looked at",
    "    return next jsonb_build_object('run', v_run.run_id, 'tenant', v_run.tenant_id,\n      'action', case",
    "    if v_back ->> 'state' <> 'queued' then continue; end if;\n    return next jsonb_build_object('run', v_run.run_id, 'tenant', v_run.tenant_id,\n      'action', case"),
  // ── WHAT A RUN IS REALLY DOING ───────────────────────────────────────────
  //
  // ⚠ THE TWO COLUMNS THAT TELL A WAITING RUN FROM A STRANDED ONE FROM A WORKING ONE. Without
  // them the store's reader answers `working` for all three, for ever — which is the defect
  // the milestone names. `mThread` is right for these: they really are the thread view's.
  mThread("⚠ SQL/states: the open-call count is the number of ENTRIES rather than calls with no result",
    "           coalesce(sum(jsonb_array_length(coalesce(e.body -> 'toolCalls', '[]'::jsonb)))\n                      filter (where e.kind = 'model'), 0)\n           - count(*) filter (where e.kind = 'tool'), 0) as calls",
    "           count(*) filter (where e.kind = 'model'), 0) as calls"),
  mThread("SQL/states: an impossible log answers a NEGATIVE count, which reads as a value to `> 0`",
    "  select greatest(\n           coalesce(sum(", "  select (\n           coalesce(sum("),
  mThread("⚠ SQL/states: a DECIDED request still reads as waiting, so the run never leaves that state",
    "            where a.run_id = m.run_id and a.verdict is null\n              and (a.expires_at is null or a.expires_at > now())) as waiting",
    "            where a.run_id = m.run_id) as waiting"),
  mThread("⚠ SQL/states: a request whose window has CLOSED reads as waiting for somebody who cannot answer",
    "              and (a.expires_at is null or a.expires_at > now())) as waiting",
    "              and true) as waiting"),
  mThread("⚠ SQL/states: any request of this account's makes every one of its runs read as waiting",
    "            where a.run_id = m.run_id and a.verdict is null", "            where a.verdict is null"),
  mThread("SQL/states: the waiting flag answers NULL rather than false, so cannot-tell wears a value's clothes",
    "  coalesce(ask.waiting, false) as run_awaiting", "  ask.waiting as run_awaiting"),
  mThread("SQL/states: the open-call count answers NULL for a run with no log at all",
    "  coalesce(open.calls, 0) as run_open_calls", "  open.calls as run_open_calls"),
  mThread("⚠ SQL/states: the server cannot read the approvals the view reaches, so every conversation fails",
    "grant select on agent.tool_approvals to service_role;", "-- no grant"),
  mPending("⚠ SQL/lists: an expired request is offered as something to answer, and then refused",
    "       and (a.expires_at is null or a.expires_at > now())", "       and true"),
  mRunApprovals("⚠ SQL/lists: a run's own list cannot say a window closed",
    "               when a.expires_at is not null and a.expires_at <= now() then 'expired'\n               else null end,",
    "               else null end,"),
  /**
   * ⚠ WHAT FORGETTING REACHES. A memory lives in three relations and a delete reaches ONE;
   * both doors report the reach from THIS function's own answer, so a note about it cannot
   * drift from what a delete does — and a reach this function composes wrongly is a claim
   * two products then repeat.
   */
  mForget("⚠ SQL/memory: a delete claims it reaches an execution already accepted",
    "      'acceptedRuns',    false,    -- each holds the snapshot it was accepted with",
    "      'acceptedRuns',    true,"),
  mForget("⚠ SQL/memory: a delete claims the history is erased too",
    "      'runHistory',      false));  -- the journal is append-only and keeps what was quoted",
    "      'runHistory',      true));"),
  mForget("SQL/memory: a delete says it does not reach a later run, which is the one place it does",
    "      'futureRuns',      true,     -- no later snapshot carries it",
    "      'futureRuns',      false,"),
  mForget("SQL/memory: the reach is not answered at all, so nothing can report it",
    "    'affects', jsonb_build_object(", "    'unused', jsonb_build_object("),
  mForget("⚠ SQL/memory: forgetting nothing is reported as having removed something",
    "    'ok', true, 'forgot', v_gone > 0, 'key', lower(btrim(coalesce(p_key, ''))),",
    "    'ok', true, 'forgot', true, 'key', lower(btrim(coalesce(p_key, ''))),"),
  // ⚠ AND WHOSE FACT IT WAS, in the snapshot an execution is given: without the source an
  // agent's own note and a fact a person confirmed arrive as one thing, and the engine's
  // fail-closed reader would call both of them `unknown`.
  mSnap("⚠ SQL/memory: the snapshot drops who confirmed a fact, so provenance cannot travel",
    "'source', m.source", "'source', null"),
  mCtrl("SQL/controls/CONTROL (comment only)",
    "-- ⚠ **THREE THINGS, AND COLLAPSING ANY TWO LOSES A REAL DISTINCTION.**",
    "-- Three things, and collapsing any two loses a real distinction (control).", true),
  /**
   * ⚠ **THE CREDENTIAL'S PRIVILEGES, BOTH ROLES AND BOTH DIRECTIONS — the fourth defect of
   * this milestone, in the one shape a source read cannot settle.** A positive column list
   * and a table grant read identically in a diff; what tells them apart is Postgres, which
   * checks the columns a query NAMES. So each grant is mutated TWICE: widened to the table
   * (the credential becomes readable with one query) and removed altogether (the
   * `security_invoker` view becomes unreadable and the screen shows nothing). The two
   * failures need opposite fixes, and a single mutant would leave one of them unguarded.
   */
  mConn("⚠ SQL/connections: `service_role`'s grant is the whole TABLE, so the Worker can read every credential",
    "grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,\n              refreshable, expires_at, stopped_why, created_at, updated_at)\n  on table agent.connections to service_role;",
    "grant select on table agent.connections to service_role;"),
  mConn("⚠ SQL/connections: `service_role` gets nothing, so the Worker's own list is unreadable",
    "grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,\n              refreshable, expires_at, stopped_why, created_at, updated_at)\n  on table agent.connections to service_role;",
    "-- no grant for service_role"),
  mConn("⚠ SQL/connections: `authenticated`'s grant is the whole TABLE, so a customer can read a credential",
    "grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,\n              refreshable, expires_at, stopped_why, created_at, updated_at)\n  on table agent.connections to authenticated;",
    "grant select on table agent.connections to authenticated;"),
  mConn("⚠ SQL/connections: `authenticated` gets nothing, so the view it must read is refused",
    "grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,\n              refreshable, expires_at, stopped_why, created_at, updated_at)\n  on table agent.connections to authenticated;",
    "-- no grant for authenticated"),
  mConn("⚠ SQL/connections: the view selects the credential, so every reader of the list has it",
    "  select c.id, c.tenant_id, c.agent_id, c.provider, c.label, c.account, c.scopes,",
    "  select c.id, c.tenant_id, c.agent_id, c.provider, c.label, c.account, c.scopes, c.secret,"),
  /**
   * ⚠ WHETHER THERE IS A WAY TO REFRESH, AS A GENERATED COLUMN. The point of generating it
   * is that a screen can learn the fact WITHOUT a grant on `refresh_secret` — so a mutant
   * that makes it an ordinary default is not a cosmetic change: it makes the column lie for
   * every row written before the refresh credential arrives.
   */
  mConn("⚠ SQL/connections: `refreshable` is no longer derived, so it can disagree with the credential",
    "  refreshable     boolean     not null generated always as (refresh_secret is not null) stored,",
    "  refreshable     boolean     not null default false,"),
  mConn("SQL/connections: row level security is enabled but not FORCED, so the owner's own reads bypass it",
    "alter table agent.connections force row level security;", "-- not forced"),
  mConn("⚠ SQL/connections: the policy keys on nothing, so every account reads every connection",
    "  using (tenant_id = agent.tenant_id());", "  using (true);"),
  mConn("SQL/connections: a status nothing recognises may be stored",
    "  constraint connections_status_known check (status in ('active', 'expired', 'revoked', 'disconnected')),",
    "  constraint connections_status_known check (status is not null),"),
  /**
   * THE FOUR REFUSALS OF THE ONE DOOR, one mutant each, because each is a different sentence
   * to whoever has to act on it — and the last of them is the branch where being wrong hands
   * out a credential.
   */
  mLease("⚠ SQL/connections: a DISCONNECTED connection is leased, handing out what a person took away",
    "  if v_row.status = 'disconnected' then\n    return jsonb_build_object('ok', false, 'error', 'disconnected', 'why', v_row.stopped_why);\n  end if;",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'disconnected', 'why', v_row.stopped_why);\n  end if;"),
  mLease("⚠ SQL/connections: a REVOKED connection is leased, so the engine keeps using a withdrawn grant",
    "  if v_row.status = 'revoked' then\n    return jsonb_build_object('ok', false, 'error', 'revoked', 'why', v_row.stopped_why);\n  end if;",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', 'revoked', 'why', v_row.stopped_why);\n  end if;"),
  mLease("⚠ SQL/connections: an EXPIRED credential is leased, and the clock is what decides that",
    "  if v_row.expires_at is not null and v_row.expires_at <= now() then",
    "  if false then"),
  mLease("⚠ SQL/connections: a status the door does not know is leased rather than refused",
    "  if v_row.status <> 'active' then\n    -- A status this function does not know: refused rather than leased. Cannot-tell must",
    "  if false then\n    -- A status this function does not know: refused rather than leased. Cannot-tell must"),
  mLease("⚠ SQL/connections: a scope that was never granted is sent anyway, silently",
    "  if coalesce(array_length(v_missing, 1), 0) > 0 then",
    "  if false then"),
  mLease("SQL/connections: the missing scopes are filtered rather than named, so the drop is silent",
    "   where not (s = any (v_row.scopes));", "   where false;"),
  mLease("SQL/connections: the one door answers no credential at all, so nothing can act",
    "    'secret', v_row.secret);", "    'secret', null);"),
  /**
   * ⚠ WHAT A STOP DOES TO THE CREDENTIAL. A row kept as the record of what happened is the
   * point of not deleting it — and a row that keeps its secret is a credential still
   * readable through the one door, past the moment somebody took it away.
   */
  mRevokeConn("⚠ SQL/connections: a revocation leaves the credential in the row",
    "     set status = 'revoked', secret = '-', refresh_secret = null,",
    "     set status = 'revoked',"),
  mDisconnect("⚠ SQL/connections: a disconnect leaves the credential in the row",
    "     set status = 'disconnected', secret = '-', refresh_secret = null,",
    "     set status = 'disconnected',"),
  mRefreshConn("⚠ SQL/connections: a refresh REVIVES what a person stopped, putting back what they took away",
    "  if v_row.status <> 'active' then\n    return jsonb_build_object('ok', false, 'error', v_row.status, 'why', v_row.stopped_why);\n  end if;",
    "  if false then\n    return jsonb_build_object('ok', false, 'error', v_row.status, 'why', v_row.stopped_why);\n  end if;"),
  mRefreshConn("SQL/connections: a provider with no refresh credential is answered `ok`, a control that does nothing",
    "  if v_row.refresh_secret is null then", "  if false then"),
  mConnect("⚠ SQL/connections: connecting answers the credential back, so it reaches a caller that never needed it",
    "  return jsonb_build_object('ok', true, 'connection', v_row.id, 'scopes', to_jsonb(v_row.scopes));",
    "  return jsonb_build_object('ok', true, 'connection', v_row.id, 'scopes', to_jsonb(v_row.scopes), 'secret', v_row.secret);"),
  mConnect("SQL/connections: reconnecting leaves the old row live, so a reader has two to choose between",
    "     set status = 'disconnected', stopped_why = 'replaced by a new connection', updated_at = now()",
    "     set stopped_why = 'replaced by a new connection', updated_at = now()"),
  mConn("SQL/connections/CONTROL (comment only)",
    "-- ⚠ FOUR STATES, AND THEY ARE FOUR BECAUSE EACH NEEDS A DIFFERENT SENTENCE.",
    "-- Four states, and they are four because each needs a different sentence (control).", true),
];

// THE PRE-CHECK. Every anchor exactly once IN ITS OWN FILE, and a replacement that
// differs. Reading one file for every mutant is how two correct anchors were
// reported as missing: the tenant and queue mutants target their own migrations,
// not the first.
let bad = 0;
let viewHosted = 0;
const text = new Map();
for (const s of spec) {
  const f = s.files[0];
  if (!text.has(f)) text.set(f, fs.readFileSync(f, "utf8"));
  const n = text.get(f).split(s.from).length - 1;
  if (n !== 1) { console.error(`ANCHOR ${n === 0 ? "NOT FOUND" : `AMBIGUOUS (${n})`}: ${s.label}`); bad++; }
  if (s.from === s.to) { console.error(`REPLACEMENT IS THE ANCHOR: ${s.label}`); bad++; }
  // ⚠ **AND THE OBJECT THE ANCHOR SITS INSIDE MUST BE DEFINED FOR THE LAST TIME IN THIS
  // FILE, which is the only thing that catches a mutant aimed at a SUPERSEDED
  // definition.** The check above is satisfied by such a mutant — the anchor really does
  // occur exactly once in the file it was pointed at — so it lands on dead code and
  // survives, and its survival reads as a test gap rather than as a spec fault.
  //
  // This trap has arrived THREE TIMES here: the fence's four queue functions, `tenant_id()`,
  // and the workflow migration's eight (found 2026-09-17 by a census, not by a survivor,
  // because no sweep had run in between). `lastDefining` is the fix per object; this is
  // what notices when a FILE-level maker is used for something a later file replaces.
  //
  // **FUNCTIONS AND VIEWS ONLY, and the narrowness is measured rather than cautious.**
  // `create or replace` is what silently supersedes, and it applies to exactly those two.
  // The first draft of this check asked only whether the ANCHOR TEXT occurs later, and it
  // reported SIX correct entries as broken: `using (tenant_id = agent.tenant_id())` is
  // ordinary policy text that a later file writes for a DIFFERENT table, and
  // `return jsonb_build_object('ok', false, 'error', 'no-agent');` is a sentence four
  // functions share. *The anchor's text cannot say which object it belongs to; its
  // POSITION can.*
  // ⚠ **AND A CONSTRAINT IS SUPERSEDED BY `drop constraint … add constraint`, WHICH THE CHECK
  // BELOW CANNOT SEE — the trap's fifth arrival, and the first through this door.** That check is
  // deliberately narrowed to functions and views because `create or replace` is what silently
  // supersedes those; a constraint takes a different route and needs its own question. Asked of
  // the FILES, per name, exactly as `lastDefining` is: if any migration drops this constraint and
  // a later one re-adds it, a mutant on an earlier copy is inert by construction.
  const cEncl = enclosingConstraint(text.get(f), text.get(f).indexOf(s.from));
  if (cEncl && !s.control) {
    const owner = lastConstraining(cEncl.name);
    if (owner !== f) {
      console.error(`SUPERSEDED CONSTRAINT: ${s.label}\n    its anchor is inside ${cEncl.name}, which ${path.basename(owner)} defines last`);
      bad++;
    }
  }
  const encl = enclosing(text.get(f), text.get(f).indexOf(s.from));
  if (encl && !s.control) {
    const owner = lastDefining(`function ${encl.name}(`);
    if (owner !== f) {
      console.error(`SUPERSEDED: ${s.label}\n    its anchor is inside ${encl.name}, which ${path.basename(owner)} defines last`);
      bad++;
    }
  }
  // ⚠ **AND THE SAME QUESTION FOR A VIEW, which the comment above promised and the code
  // did not ask.** `enclosingView`'s own note has the measurement; what matters here is
  // that this arm and the function arm are the SAME check over two kinds of replaceable
  // object, so neither can be the one that was forgotten.
  const vEncl = enclosingView(text.get(f), text.get(f).indexOf(s.from));
  if (vEncl && !s.control) {
    const owner = lastDefining(`create or replace view ${vEncl.name}`);
    if (owner !== f) {
      console.error(`SUPERSEDED VIEW: ${s.label}\n    its anchor is inside ${vEncl.name}, which ${path.basename(owner)} defines last`);
      bad++;
    }
  }
  if (vEncl && !s.control) viewHosted++;
}
// A NEGATIVE ASSERTION NEEDS ITS OBSERVER PROVED ALIVE, and this one has a history: the
// function arm shipped DEAD (its terminator read the minority form) and passed with all
// eight known-bad entries put back. So the view arm states its floor rather than trusting
// a green run — 9 anchors sit inside a view today, and a reader that stops finding them is
// a check that has stopped asking.
if (viewHosted < 9) {
  console.error(`THE VIEW CENSUS IS BLIND: only ${viewHosted} anchors read as inside a view; 9 really are`);
  bad++;
}
if (bad) { console.error(`\n${bad} anchor problems — spec NOT written.`); process.exit(1); }
fs.writeFileSync(process.argv[2], JSON.stringify(spec, null, 1));
console.log(`${spec.length} SQL mutants (${spec.filter((s) => s.control).length} control), every anchor unique.`);
