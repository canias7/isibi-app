// ── TWO UNCERTAINTIES THE 2026-09-13 AUDIT LEFT, RESOLVED ───────────────────
//
// Owner: "Before exposing additional capabilities, resolve two concrete
// uncertainties with targeted tests: enforceRefs enforcement, given the
// conflicting FK findings; and direct PostgREST access to managed columns using
// ordinary member permissions. Report actual behavior separately from
// inference."
//
// WHAT THIS FILE CAN AND CANNOT SETTLE, said once and meant:
//
//   PROVABLE HERE — what the engine EMITS. These are pure functions over a
//   spec, so what they return is the actual, observable behaviour of the code
//   that writes the SQL.
//
//   NOT PROVABLE HERE — what Postgres and PostgREST then DO with it. That needs
//   a live Neon project, which no unit test reaches. Where a claim depends on
//   it, this file says so in as many words rather than asserting it, and names
//   the integration test that does prove it.
//
// A ZERO FROM A BLIND INSTRUMENT IS NOT EVIDENCE OF ABSENCE — this repository's
// own rule, recorded against a headless browser twice in two days. Both checks
// below carry a live observer for exactly that reason.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { grantsFor } from "../site-rls.mjs";
import { READ_LEVELS, WRITE_LEVELS, MANAGED_COLUMNS, isManagedColumn, ACCESS_PRESETS } from "../site-access.mjs";
import { normalizeSchema } from "../site-schema.mjs";

const SCHEMA = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
const RLS = fs.readFileSync(new URL("../site-rls.mjs", import.meta.url), "utf8");

/** Length-preserving, LINE COMMENTS FIRST — the recorded blanker-order trap. */
function blank(src) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      let j = i; while (j < src.length && src[j] !== "\n") j++;
      out += " ".repeat(j - i); i = j; continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2); j = j < 0 ? src.length : j + 2;
      out += src.slice(i, j).replace(/[^\n]/g, " "); i = j; continue;
    }
    out += src[i]; i++;
  }
  return out;
}
const S = blank(SCHEMA);
// THE BLANKER'S OWN OBSERVER. Both checks below are partly ABSENCE checks over
// this text, and a blanker that ate the file satisfies an absence perfectly.
assert.ok(S.includes("export async function applySiteSchema"), "the blanker ate site-schema.mjs");
assert.ok(S.includes("if (t.enforceRefs) {"), "the blanker ate the enforceRefs block");

// ─────────────────────────────────────────────────────────────────────────────
// UNCERTAINTY 1 — `enforceRefs`, and the two findings that looked contradictory
// ─────────────────────────────────────────────────────────────────────────────

test("UNCERTAINTY 1: there is no foreign key anywhere, and enforceRefs is a trigger — both findings are true", () => {
  // THE APPARENT CONTRADICTION. The audit reported (a) `site-schema.mjs:1044`
  // says "No FOREIGN KEY, deliberately, even though the reference is accepted"
  // and (b) `enforceRefs` is offered by the tool as referential integrity. Read
  // together those look like a promise with nothing behind it. They are not:
  // the engine enforces the reference with a TRIGGER instead of a constraint,
  // and the two statements are about different mechanisms.
  //
  // (a) ACTUAL: no FK DDL is emitted, anywhere in the engine or the RLS layer.
  assert.doesNotMatch(S, /FOREIGN KEY/, "a FOREIGN KEY is emitted after all");
  assert.doesNotMatch(blank(RLS), /REFERENCES\s+"/, "the RLS layer emits a REFERENCES clause");
  // …AND THE OBSERVER IS ALIVE: the scan can find a DDL keyword when one is
  // there. Without this, a reader that matched nothing at all would pass.
  assert.match(S, /CREATE TABLE IF NOT EXISTS/, "the DDL scan cannot see a statement that is definitely emitted");
  assert.match(S, /ALTER TABLE/, "the DDL scan cannot see an ALTER that is definitely emitted");

  // (b) ACTUAL: the guard is a pair of triggers per ref column, and it RAISES.
  const at = S.indexOf("if (t.enforceRefs) {");
  const block = S.slice(at, S.indexOf("\n    }", at));
  assert.match(block, /RAISE EXCEPTION 'missing parent'/, "the guard no longer refuses a write");
  assert.match(block, /IS NOT NULL AND NOT EXISTS \(SELECT 1 FROM/, "the guard no longer checks the parent exists");
  // BOTH VERBS, and that is the half a reader skips: an INSERT-only guard lets
  // an UPDATE point a row at a parent that is not there.
  assert.match(block, /timing: "BEFORE", event: "INSERT"/, "the insert guard is gone");
  assert.match(block, /event: "UPDATE OF " \+ cn/, "the update guard is gone");
  // ── AND NEITHER TRIGGER IS BEHIND A DEAD CONDITION ───────────────────────
  //
  // A SWEEP SURVIVOR, and the recorded "a positional guard cannot see a dead
  // branch" in a guard written the same hour as the one above. `if (false) try
  // { await pgTrigger(…"_u"…) }` leaves every string the four matches look for
  // exactly where they look for it, so all four pass over a site whose UPDATE
  // guard never runs — and a row re-pointed at a missing parent is precisely
  // the half of referential integrity a reader skips. Each call is read by
  // WHAT PRECEDES IT on its own line: a `try {` at the start of the statement,
  // with nothing before it but whitespace.
  const calls = [...block.matchAll(/^([^\n]*?)try \{ await pgTrigger\(uuid, "trg_" \+ t\.name \+ "_ref_"/gm)];
  assert.equal(calls.length, 2, "there are no longer exactly two ref triggers: " + calls.length);
  for (const c of calls) {
    assert.match(c[1], /^\s*$/, "a ref trigger sits behind a condition and never fires: " + c[1].trim());
  }
  // A NULL REFERENCE IS ALLOWED — an optional link is not an orphan, and a
  // guard that refused one would break every nullable ref column.
  assert.match(block, /IS NOT NULL AND/, "a null reference is refused, so an optional link is impossible");
  // ONE PAIR PER REF COLUMN, not one for the table.
  assert.match(block, /for \(const col of Object\.keys\(refs\)\)/, "the guard is no longer per ref column");

  // INFERENCE, NOT MEASUREMENT, and marked as such: that Postgres then refuses
  // the write. `test/integration/neon-e2e.mjs:252` PROVES it against a real
  // Neon database — it inserts a comment against a missing parent and requires
  // the failure to say "missing parent" — and that test was NOT RUN in this
  // session, because it needs a live project. Named here so the next reader
  // knows where the live proof is rather than re-deriving it.
  const e2e = fs.readFileSync(new URL("./integration/neon-e2e.mjs", import.meta.url), "utf8");
  assert.match(e2e, /enforceRefs: true/, "the integration fixture no longer declares enforceRefs");
  assert.match(e2e, /missing parent/i, "the integration test no longer checks the refusal");
});

// ─────────────────────────────────────────────────────────────────────────────
// UNCERTAINTY 2 — managed columns, and what the emitted grants actually say
// ─────────────────────────────────────────────────────────────────────────────

test("UNCERTAINTY 2: no emitted grant is column-scoped, over every access cell", () => {
  // THE QUESTION. `MANAGED_COLUMNS` says "Set by the engine, not the app. Never
  // writable through the API, at any level." `isManagedColumn` enforces that in
  // `site-owner.mjs` and the seeder — OUR routes. The Data API is PostgREST
  // talking to Postgres directly, so the only thing that could stop a member
  // writing `pinned` there is a COLUMN-SCOPED grant.
  //
  // ACTUAL, DRIVEN over all sixteen read/write cells plus the five presets:
  // every statement the engine emits names a TABLE and never a column list.
  const cells = [];
  for (const read of READ_LEVELS) for (const write of WRITE_LEVELS) cells.push({ name: "t", read, write });
  for (const preset of Object.keys(ACCESS_PRESETS)) cells.push({ name: "t", access: preset });
  cells.push({ name: "t", access: "admin", writeRoles: ["editor"] });
  cells.push({ name: "t", access: "display", retired: true });

  let statements = 0;
  for (const t of cells) {
    const sql = grantsFor(t);
    for (const s of sql) {
      statements++;
      // A column-scoped grant is `GRANT UPDATE (col) ON …`. The parenthesis
      // before `ON` is the whole tell.
      assert.doesNotMatch(s, /\b(GRANT|REVOKE)\b[^(]*\([^)]*\)\s*ON\b/i,
        "a column-scoped grant appeared, which changes the answer: " + s);
    }
  }
  // THE OBSERVER IS ALIVE. Sixteen cells plus seven produce real statements —
  // without this floor, a `grantsFor` that returned nothing would satisfy every
  // assertion above perfectly. This repository's most-recorded trap.
  assert.ok(statements >= 40, "the grant scan produced almost nothing: " + statements + " statements");
  assert.match(grantsFor({ name: "t", access: "display" }).join("\n"), /GRANT SELECT ON "t" TO/,
    "the scan cannot see a grant that is definitely emitted");

  // AND THE MANAGED COLUMNS ARE REAL COLUMNS ON REAL TABLES, so the question is
  // not hypothetical: a `pinnable` table gets `pinned`, and `pinned` is managed.
  assert.ok(isManagedColumn("pinned") && isManagedColumn("position") && isManagedColumn("archived_at"),
    "the columns this is about stopped being managed");
  assert.ok(MANAGED_COLUMNS.length >= 10, "the managed-column list shrank below what this check assumes");

  // ── WHAT FOLLOWS, AND WHAT DOES NOT ──────────────────────────────────────
  //
  // ACTUAL (asserted above): the engine emits no column-scoped privilege, so
  // nothing in the SQL distinguishes a managed column from any other one. The
  // managed-column rule is enforced by our own routes, not by the database.
  //
  // INFERENCE (NOT asserted, and deliberately not): that a signed-in member on
  // a table with a write grant can therefore set `pinned` or `position`
  // directly through PostgREST. That is the likely reading of the grants above,
  // but RLS policies are a second gate and a `WITH CHECK` could refuse such a
  // write for another reason. Settling it needs a live Neon project and a real
  // member token — neither of which exists in a unit test — so it is reported
  // as inference and left open rather than written down as fact.
  //
  // ── AND THE THING THAT SETTLES IT NOW EXISTS (owner, 2026-09-13: "Resolve
  // the managed-column question on the test project … Report actual allowed and
  // denied behavior") ──
  //
  // `test/integration/neon-e2e.mjs` carries a `notes` table — member-writable,
  // with the managed columns really on it — and probes each one as the role a
  // Data API request runs under, with an ordinary column as the control. It
  // needs NEON_API_KEY and a real project, so it does not run here; named
  // rather than re-derived, and its landmarks asserted so a rename cannot leave
  // this paragraph describing a check that is gone.
  const e2e2 = fs.readFileSync(new URL("./integration/neon-e2e.mjs", import.meta.url), "utf8");
  assert.match(e2e2, /name: "notes"/, "the managed-column fixture table is gone from the integration harness");
  assert.match(e2e2, /SET LOCAL ROLE authenticated/, "the harness no longer assumes the Data API's own role");
  assert.match(e2e2, /a member can write an ORDINARY column on their own row \(the control\)/,
    "the probe lost its control, so every 'denied' it reports would be unfalsifiable");
  assert.match(e2e2, /MANAGED COLUMNS A MEMBER COULD WRITE/, "the probe no longer reports what it found");
});

test("UNCERTAINTY 2b: a managed column is refused on OUR routes, which is the half that is real today", () => {
  // The other side of the same fact, driven rather than read: the guarantee
  // that exists is the one `isManagedColumn` makes, and it is worth pinning
  // because the audit's whole point is separating what is enforced from what is
  // merely documented.
  for (const c of MANAGED_COLUMNS) assert.equal(isManagedColumn(c), true, c + " is on the list and reads as unmanaged");
  for (const c of MANAGED_COLUMNS) assert.equal(isManagedColumn(c.toUpperCase()), true, c + " is case-sensitive, so a capital slips past");
  // AND A COLUMN THAT IS NOT MANAGED IS NOT REFUSED — the control, without
  // which a function returning `true` for everything would pass.
  assert.equal(isManagedColumn("email"), false);
  assert.equal(isManagedColumn(""), false);
  assert.equal(isManagedColumn(null), false);
  // `X["constructor"]` IS TRUTHY — shipped here once in the Stripe plan lookup.
  assert.equal(isManagedColumn("constructor"), false, "a prototype key reads as a managed column");

  // AND THE ENGINE REALLY CREATES THEM, so this is about live columns: a
  // `pinnable` table gets `pinned`, driven through the normaliser so the
  // property is read the way the DDL loop reads it.
  const t = normalizeSchema({ tables: [{ name: "posts", pinnable: true, ordered: true, archivable: true, columns: [{ name: "title", type: "text" }] }] }).tables[0];
  assert.equal(t.pinnable, true);
  assert.equal(t.ordered, true);
  assert.equal(t.archivable, true);
  assert.match(S, /if \(t\.pinnable\) cols\.push\('"pinned" INTEGER DEFAULT 0'\)/, "the pinned column is no longer created");
});

test("UNCERTAINTY 2c: which access cells put a managed column within a member's reach at all", () => {
  // THE PRECONDITION THE FIRST TWO CASES SKIPPED, and it turns the inference
  // above into a bounded pass/fail without a live project (owner, 2026-09-13:
  // "Turn the observed behavior into a clear pass/fail result for the intended
  // permissions").
  //
  // INTENDED: a member may not write a platform-managed column.
  //
  // Case 2 establishes that no grant is column-scoped, so nothing in the SQL
  // distinguishes a managed column from any other. What it did not ask is the
  // question that comes FIRST: on which tables can a member issue an UPDATE at
  // all? Where there is no member UPDATE grant, every managed column on that
  // table is out of reach whatever the policies say — and that is not a corner
  // case, it is half the matrix and it is where the money lives.
  //
  // A PROBE THAT SKIPPED THIS REPORTED EIGHT FALSE ALARMS, which is why the
  // precondition is the first thing here: run over a `collect` table carrying
  // the five payment columns, "is this column constrained" answered FAIL for
  // every one of them — on a table no member can update at all.
  const memberUpdate = (t) => grantsFor(t).some((s) =>
    /^\s*GRANT\b/i.test(s) && /TO\s+authenticated/i.test(s) && /\bUPDATE\b/i.test(s.split(/\bON\b/i)[0]));

  // THE VERB IS READ BEFORE THE `ON`, AND A TABLE CALLED `update` IS WHY —
  // measured, not guessed. `GRANT SELECT ON "update" TO authenticated` contains
  // the word UPDATE, so a reader that scans the whole statement calls it a
  // member-UPDATE grant: the readings diverge on 7 of the 16 cells for that
  // name, and on 0 of 16 for any name that does not contain the verb (`updates`
  // included — `\b` after UPDATE refuses the trailing `s`). A customer can name
  // a table `update`, so the census runs over BOTH names and the split is
  // load-bearing rather than decorative.
  // THE FIXTURE CARRIES COLUMNS, and since 2026-09-13 that is load-bearing
  // rather than cosmetic: the write grants are column-scoped, so a table with
  // no declarable column gets no write grant and every cell would read `false`
  // — an answer about the fixture, not about the matrix.
  const COLS = [{ name: "title", type: "text" }];
  const reach = [];
  for (const name of ["t", "update"]) {
    for (const read of READ_LEVELS) for (const write of WRITE_LEVELS) {
      reach.push({ name, read, write, member: memberUpdate({ name, read, write, columns: COLS }) });
    }
  }
  assert.equal(reach.length, 32, "the access matrix changed shape and this census is stale");

  // MEASURED, and the answer depends only on WRITE — the read level and the
  // table's NAME change nothing, which is itself worth pinning: a future read
  // level that quietly granted UPDATE would be a silent widening.
  //
  // THIS LOOP IS THE ALIVE OBSERVER. It asserts all 32 cells exactly, both
  // true and false, so a reader that answered one way for everything fails
  // here — which is why no separate count or floor sits beside it. Both were
  // written, MEASURED redundant against this loop (it pins the count at 8 per
  // name by construction) and deleted rather than left as checks a sweep can
  // weaken with nothing to notice.
  for (const r of reach) {
    const expected = r.write === "own" || r.write === "members";
    assert.equal(r.member, expected,
      `${r.name} read:${r.read} write:${r.write} — member UPDATE is ${r.member}, expected ${expected}`);
  }

  // THE PRESETS, which is what a spec actually names most of the time.
  const byPreset = Object.fromEntries(Object.keys(ACCESS_PRESETS).map((p) => [p, memberUpdate({ name: "t", access: p, columns: COLS })]));
  assert.deepEqual(byPreset, { display: false, collect: false, user: true, feed: true, admin: false },
    "a preset changed which side of the line it is on");

  // ── THE PASS/FAIL, stated as the intended permission ──────────────────────
  //
  // PASS — `write: none` and `write: anyone`, which is `display`, `collect` and
  // `admin`: no member UPDATE grant exists, so no managed column on such a
  // table is writable by a member through the Data API. **Every payment column
  // is in this class**, because payment rides on `collect`; that is the half
  // that matters most and it holds.
  //
  // FAIL — `write: own` and `write: members`, which is `user` and `feed`: a
  // member UPDATE grant exists, no grant is column-scoped (case 2), and the
  // UPDATE policy names only `owner_id`. So on such a table `id`,
  // `created_at`, `updated_at`, and — where the flags create them — `pinned`,
  // `position` and `deleted_at` have NOTHING in the emitted SQL that stops a
  // member writing them. On `write: own` the blast radius is the member's own
  // row; on `write: members` the policy is `app_user_id() IS NOT NULL` for both
  // USING and WITH CHECK, so it is ANY row.
  //
  // WHAT IS STILL INFERENCE, unchanged and still named: that Postgres and
  // PostgREST then behave as the SQL says. Nothing here is in doubt about it —
  // but this file proves what the engine EMITS, not what the database does, and
  // `test/integration/neon-e2e.mjs` is the probe that closes it. It needs
  // NEON_API_KEY and a real project.
  const own = grantsFor({ name: "t", read: "own", write: "own", columns: COLS }).join("\n");
  const members = grantsFor({ name: "t", read: "public", write: "members", columns: COLS }).join("\n");
  assert.match(own, /GRANT[^;]*\bUPDATE\b[^;]*ON "t" TO authenticated/i, "the write:own grant this reads is gone");
  assert.match(members, /GRANT[^;]*\bUPDATE\b[^;]*ON "t" TO authenticated/i, "the write:members grant this reads is gone");
  const collect = grantsFor({ name: "t", access: "collect", columns: COLS }).join("\n");
  assert.doesNotMatch(collect, /\bUPDATE\b[^;]*TO authenticated/i,
    "a collect table now grants a member UPDATE — every payment column just came within reach");
  assert.ok(collect.length > 0, "the collect reader produced nothing, so its absence check says nothing");
});
