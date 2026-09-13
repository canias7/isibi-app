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
  // The one thing that WOULD settle it cheaply is a case in
  // `test/integration/neon-e2e.mjs`: sign in as a member, PATCH a managed
  // column over the Data API, and read what comes back. Not added here, because
  // that file runs against a real project and adding a case to it is a change
  // to a paid harness rather than to this check.
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
