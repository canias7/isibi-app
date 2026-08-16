// The four features that were parsed, stored in `_meta`, and enforced by
// nothing — until 2026-08-16.
//
// WHY THIS TIER EXISTS AND SEVEN SIBLINGS DO NOT. Everything here is a fact the
// DATABASE can keep by itself: a CHECK, a generated column, a weighted tsvector,
// a trigger. Nothing needs the Worker on the read or write path, which is
// exactly what killed `mask` (and would kill `fieldRoles` identically) once
// reads moved to Neon's Data API — those name OUR application roles, and
// Postgres knows only `anonymous` and `authenticated`.
//
// These are pure emitters, so the SQL a customer's database really receives is
// asserted here with no database, no network and no clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkSql, computedSql, ftsDoc, transitionSql } from "../site-schema.mjs";
import { schemaDigest } from "../builder/page-gen.mjs";

const cols = (...names) => new Set(names);

// ── checks ───────────────────────────────────────────────────────────────────

test("a check compares two columns, and the operator is real SQL", () => {
  const out = checkSql({ name: "bookings", checks: [["end_time", "gt", "start_time"]] },
    cols("start_time", "end_time"));
  assert.equal(out.length, 1);
  assert.equal(out[0].sql, '"end_time" > "start_time"');
  assert.match(out[0].name, /^ck_bookings_/, "named after the table, so two tables' rules cannot collide");

  const ops = { gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "=", ne: "<>" };
  for (const [word, sym] of Object.entries(ops)) {
    const r = checkSql({ name: "t", checks: [["a", word, "b"]] }, cols("a", "b"));
    assert.equal(r[0].sql, '"a" ' + sym + ' "b"', word);
  }
});

test("AN ALL-DIGITS RIGHT-HAND SIDE IS A NUMBER, not a column", () => {
  // THE ONE AMBIGUITY THE PARSER CANNOT RESOLVE. It validates the right-hand
  // side against `[a-z0-9_]{1,40}` — a column name — and "1" passes that too.
  // Read as an identifier, `["quantity","gte","1"]` emits `"quantity" >= "1"`,
  // which fails to create because no column named `1` exists, and the whole
  // constraint is silently lost. That is the failure mode this tier exists to
  // stop being: a guarantee that was asked for and is not there.
  const n = checkSql({ name: "orders", checks: [["quantity", "gte", "1"]] }, cols("quantity"));
  assert.equal(n[0].sql, '"quantity" >= 1', "a number must be a literal, not a quoted identifier");
  assert.ok(!n[0].sql.includes('"1"'));

  // …and a non-numeric right-hand side that is NOT a column is dropped rather
  // than emitted, or the same statement fails to create for the same reason.
  assert.deepEqual(checkSql({ name: "t", checks: [["a", "gt", "nosuchcol"]] }, cols("a")), []);
});

test("a check naming a column the table does not have is dropped", () => {
  assert.deepEqual(checkSql({ name: "t", checks: [["ghost", "gt", "a"]] }, cols("a")), []);
  assert.deepEqual(checkSql({ name: "t", checks: [["a", "nonsense", "b"]] }, cols("a", "b")), []);
  // …and a table declaring none emits none, so no existing site changes.
  assert.deepEqual(checkSql({ name: "t" }, cols("a")), []);
  assert.deepEqual(checkSql({ name: "t", checks: null }, cols("a")), []);
});

test("checks are bounded", () => {
  const many = Array.from({ length: 40 }, (_, i) => ["a", "gt", String(i)]);
  assert.ok(checkSql({ name: "t", checks: many }, cols("a")).length <= 12);
});

// ── computed ─────────────────────────────────────────────────────────────────

test("a computed column concatenates columns and literals", () => {
  const out = computedSql({ name: "people", computed: { full_name: ["first_name", " ", "last_name"] } },
    cols("first_name", "last_name"));
  assert.equal(out.length, 1);
  assert.equal(out[0].col, "full_name");
  // COALESCE, or one NULL part nulls the whole value — the same trap the FTS
  // document already avoids one block up.
  assert.equal(out[0].expr, `COALESCE("first_name"::text,'') || ' ' || COALESCE("last_name"::text,'')`);
});

test("A COMPUTED COLUMN MAY NEVER TAKE AN EXISTING COLUMN'S NAME", () => {
  // THE DANGEROUS ONE. Postgres has no "replace column", so the statement is
  // DROP-then-ADD — and a `computed` named after a real column would drop the
  // customer's data and replace it with a derived value, on EVERY revise,
  // silently. Refused here rather than trusted to the model.
  assert.deepEqual(computedSql({ name: "t", computed: { title: ["a"] } }, cols("title", "a")), []);
  for (const managed of ["id", "created_at", "owner_id", "team_id", "_fts", "deleted_at"]) {
    assert.deepEqual(computedSql({ name: "t", computed: { [managed]: ["a"] } }, cols("a")), [],
      managed + " is ours and a site is built on it");
  }
  // …while a genuinely new name still works, or the refusals above would be
  // satisfied by a function that emits nothing at all.
  assert.equal(computedSql({ name: "t", computed: { fresh: ["a"] } }, cols("a")).length, 1);
});

test("a literal in a computed column cannot close the expression", () => {
  // The parts are model-written and go into DDL, so a quote has to be escaped
  // rather than trusted. `'` doubles, which is Postgres's own escape.
  const out = computedSql({ name: "t", computed: { x: ["it's", "') STORED, y AS ('"] } }, cols());
  assert.ok(out[0].expr.includes("'it''s'"), out[0].expr);

  // THE STRUCTURAL PROPERTY, not a spelling. Strip every doubled quote — those
  // are escaped content — and what remains must be exactly the DELIMITERS: two
  // per literal, and an even number, or one of them has closed the expression
  // early and whatever followed is now SQL. My first attempt matched a regex
  // against the escaped text and failed on output that was perfectly correct.
  const delims = (out[0].expr.replace(/''/g, "").match(/'/g) || []).length;
  assert.equal(delims % 2, 0, "an odd delimiter count means a literal is still open: " + out[0].expr);
  assert.equal(delims, 4, "two literals, two delimiters each: " + out[0].expr);
});

// ── searchWeights ────────────────────────────────────────────────────────────

test("with no weights the FTS document is byte-identical to what it always was", () => {
  // THE PROPERTY THAT MAKES THIS SAFE TO APPLY TO EVERY EXISTING SITE. A table
  // that declares nothing must produce exactly the SQL it produced before this
  // existed — otherwise a revise silently rebuilds every search column on the
  // platform for no reason.
  const before = "to_tsvector('english', COALESCE(\"title\",'') || ' ' || COALESCE(\"body\",''))";
  assert.equal(ftsDoc(["title", "body"], null), before);
  assert.equal(ftsDoc(["title", "body"], {}), before);
  assert.equal(ftsDoc(["title", "body"], { nosuchcol: 5 }), before,
    "weights naming no indexed column are not weights");
});

test("declared weights become Postgres's four tiers, biggest first", () => {
  const doc = ftsDoc(["title", "body"], { title: 10, body: 1 });
  assert.match(doc, /setweight\(to_tsvector\('english', COALESCE\("title",''\)\), 'A'\)/);
  assert.match(doc, /setweight\(to_tsvector\('english', COALESCE\("body",''\)\), 'B'\)/);
  // The NUMBERS ARE AN ORDERING, not a scale — Postgres has exactly A..D, so
  // what matters is which column outranks which, not the gap between them.
  const same = ftsDoc(["title", "body"], { title: 2, body: 1 });
  assert.equal(same.replace(/\d/g, ""), doc.replace(/\d/g, ""), "10/1 and 2/1 are the same ordering");
  // An undeclared column sits below everything declared.
  assert.match(ftsDoc(["title", "body"], { title: 5 }), /COALESCE\("body",''\)\), 'D'\)/);
});

// ── transitions ──────────────────────────────────────────────────────────────

test("a transition trigger only judges a CHANGE", () => {
  const sql = transitionSql({ name: "bookings", transitions: { status: { pending: ["confirmed", "cancelled"] } } },
    cols("status"));
  assert.match(sql, /IS DISTINCT FROM/,
    "an update that leaves the column alone must pass whatever it holds — otherwise a new rule locks every legacy row out of every edit");
  assert.match(sql, /RAISE EXCEPTION/);
  assert.match(sql, /'confirmed', 'cancelled'/);
});

test("a state the map never mentions is UNCONSTRAINED, not forbidden", () => {
  // Silence is not a denial. Treating it as one makes every partial declaration
  // a trap — a table that names only the interesting states would refuse every
  // move out of the others.
  const sql = transitionSql({ name: "t", transitions: { status: { pending: ["done"] } } }, cols("status"));
  assert.match(sql, /ELSE FALSE END/, "an unlisted `from` must fall through to allowed");
});

test("a transition on a column the table does not have is dropped", () => {
  assert.equal(transitionSql({ name: "t", transitions: { ghost: { a: ["b"] } } }, cols("status")), null);
  assert.equal(transitionSql({ name: "t", transitions: { status: {} } }, cols("status")), null);
  assert.equal(transitionSql({ name: "t" }, cols("status")), null);
});

test("a state value cannot close the trigger body — on BOTH sides of the move", () => {
  // The `from` is a key and the `to` is a list, escaped by two different
  // expressions — so asserting one leaves the other open. A mutation removing
  // the `to` escaping survived the first sweep on exactly that.
  const from = transitionSql({ name: "t", transitions: { status: { "a'; DROP TABLE x; --": ["b"] } } }, cols("status"));
  assert.match(from, /'a''; DROP TABLE x; --'/, "the FROM quote must be doubled, not passed through");
  const to = transitionSql({ name: "t", transitions: { status: { a: ["b'; DROP TABLE x; --"] } } }, cols("status"));
  assert.match(to, /'b''; DROP TABLE x; --'/, "the TO quote must be doubled too");
  for (const sql of [from, to]) {
    const delims = (sql.replace(/''/g, "").match(/'/g) || []).length;
    assert.equal(delims % 2, 0, "an odd delimiter count means a literal is still open: " + sql);
  }
});

// ── the wiring, which the emitters cannot see ────────────────────────────────

test("the constraint tier is APPLIED, and a failure is reported rather than logged", () => {
  // COMMENTS BLANKED, AND THE ANCHOR IS THE CALL RATHER THAN THE NAME. The
  // first draft asserted `src.includes("checkSql(t, colSet)")` and a mutation
  // unwiring the loop SURVIVED — because `export function checkSql(t, colSet) {`
  // contains that text too. An assertion satisfied by the function's own
  // DECLARATION is one that passes while nothing calls it, which is precisely
  // the state this whole tier was in. Recorded here for the third time.
  const raw = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

  assert.match(src, /for \(const ck of checkSql\(/, "checkSql is written and never called");
  assert.match(src, /for \(const gc of computedSql\(/, "computedSql is written and never called");
  assert.match(src, /const trans = transitionSql\(/, "transitionSql is written and never called");
  assert.match(src, /await pgTrigger\([^)]*"trg_" \+ t\.name \+ "_trans"/,
    "…and the trigger it returns must actually be created");
  assert.match(src, /ftsDoc\(want, t\.searchWeights\)/, "the weighted document must reach the FTS column");

  // DROP-then-ADD for the constraint, because Postgres has no
  // ADD CONSTRAINT IF NOT EXISTS and a revise re-applies the whole schema.
  //
  // SCOPED TO THIS BLOCK. Asserted against the whole file it was satisfied by a
  // pre-existing DROP CONSTRAINT belonging to another feature a hundred lines
  // up — the neighbouring-branch failure, and a mutation removing the real one
  // survived on it.
  const at = src.indexOf("for (const ck of checkSql(");
  const block = src.slice(at, src.indexOf("for (const gc of computedSql(", at));
  assert.ok(block.length > 100 && block.length < 2000, "the checks block moved — retarget this guard");
  assert.match(block, /DROP CONSTRAINT IF EXISTS/, "a re-applied schema would fail on the second run");
  assert.match(block, /ADD CONSTRAINT/);

  // REPORTED. A `checks` rule usually fails because the ROWS ALREADY BREAK IT,
  // and swallowing that leaves the site claiming a guarantee it does not have.
  assert.match(src, /refused\.push\(\{ table: t\.name, feature: "checks"/);
  assert.match(src, /made\.refusedRules = refused/, "…and it has to reach the caller");
});

test("the digest really states the default order", () => {
  // A SOURCE-READ CANNOT HOLD THIS. `defaultSort` is the one field in the tier
  // the database cannot keep, so its whole enforcement is a line in the prompt —
  // and mutating the branch to `if (false)` leaves the property still mentioned
  // in the dead body below it, so every scan that looks for `.defaultSort`
  // passes. Only running the digest can tell.
  const t = { name: "posts", access: "display", columns: ["title", "created_at"], defaultSort: "-created_at" };
  const out = schemaDigest({ tables: [t] });
  assert.match(out, /DEFAULT ORDER: created_at descending/);
  assert.match(schemaDigest({ tables: [{ ...t, defaultSort: "name" }] }), /DEFAULT ORDER: name ascending/);
  // A table declaring none says nothing, so no existing prompt changes.
  assert.ok(!/DEFAULT ORDER/.test(schemaDigest({ tables: [{ ...t, defaultSort: null }] })));
});

test("a clean apply's shape is unchanged", () => {
  // `refusedRules` rides only when there is something to say, so the field's
  // PRESENCE is the signal and every existing caller reading `made` as an array
  // of names is untouched.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(refused\.length\) made\.refusedRules/);
});
