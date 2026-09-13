// ── A CLIENT MAY WRITE THE DECLARED COLUMNS AND NOTHING ELSE (2026-09-13) ────
//
// Owner: "fix the managed-column permission gap, covering INSERT and UPDATE
// while preserving legitimate operations."
//
// THE GAP. `MANAGED_COLUMNS` says "Set by the engine, not the app. Never
// writable through the API, at any level", and `pickWritable` in site-owner.mjs
// enforced exactly that — on the OWNER's door. The Data API is PostgREST
// talking to Postgres directly, so the only thing that can say it there is the
// GRANT, and every write grant named the TABLE.
//
// Two reachable shapes, measured across all sixteen read x write cells, and the
// INSERT one is the wider: `write: anyone` — the `collect` preset, a booking or
// contact form, the commonest table this platform builds — granted table-wide
// INSERT to ANONYMOUS.
//
// WHAT THIS FILE CAN AND CANNOT SETTLE, said once: it proves what the engine
// EMITS, which is a pure function over a spec. That Postgres then enforces the
// grant is Postgres's own documented behaviour and is not re-proved here;
// `test/integration/neon-e2e.mjs` is the probe that drives it live.
import test from "node:test";
import assert from "node:assert/strict";

import { grantsFor, writableColumns } from "../site-rls.mjs";
import { applySiteSchema } from "../site-schema.mjs";
import { MANAGED_COLUMNS, isManagedColumn, READ_LEVELS, WRITE_LEVELS, ACCESS_PRESETS } from "../site-access.mjs";

/** A table shaped like the ones the builder really produces. */
const FORM = { name: "requests", access: "collect", columns: [{ name: "name" }, { name: "email" }, { name: "detail" }] };
const OWN = { name: "requests", access: "user", columns: [{ name: "title" }, { name: "detail" }], timestamps: true, trash: true };
const FEED = { name: "posts", access: "feed", columns: [{ name: "body" }], ordered: true, pinnable: true };


/**
 * Run the real `applySiteSchema` and collect every statement it SENT.
 *
 * `neon()` is HTTP, so `fetch` is the seam — the module takes no injectable
 * query. An earlier probe tried passing a fake `sqlQuery` as a second argument,
 * which the function does not accept: it answered ZERO statements, and zero
 * reads exactly like "no grant anywhere", which was the answer being looked
 * for. The recorded "a zero from a blind instrument is not evidence of
 * absence"; the floor below is what would catch it now.
 */
async function applied(spec) {
  const statements = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  let made = null;
  try { made = await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  assert.ok(statements.length > 20, "the engine sent almost nothing — the fetch seam moved: " + statements.length);
  return { statements, made };
}

const grants = (t) => grantsFor(t).filter((s) => /^GRANT /.test(s));
/** Every statement that lets the named role write, whatever its shape. */
const writeGrants = (t, role) => grants(t).filter((s) => new RegExp("TO " + role + ";$").test(s) && /\b(INSERT|UPDATE)\b/.test(s));

test("no write grant is table-wide — the defect itself, on every cell that has one", () => {
  const cells = [];
  for (const read of READ_LEVELS) for (const write of WRITE_LEVELS) cells.push({ read, write });
  for (const access of Object.keys(ACCESS_PRESETS)) cells.push({ access });
  let checked = 0;
  for (const cell of cells) {
    const t = { name: "t", ...cell, columns: [{ name: "a" }, { name: "b" }] };
    for (const role of ["anonymous", "authenticated"]) {
      for (const s of writeGrants(t, role)) {
        checked++;
        // A TABLE-WIDE WRITE IS ONE WHOSE VERB CARRIES NO COLUMN LIST. Read
        // before the `ON`, because a table CALLED `update` puts the verb's own
        // word on the other side of it — measured at 7 of 16 cells diverging
        // for that name.
        const verbs = s.split(/\bON\b/)[0];
        for (const verb of ["INSERT", "UPDATE"]) {
          if (!new RegExp("\\b" + verb + "\\b").test(verbs)) continue;
          assert.match(verbs, new RegExp(verb + "\\s*\\([^)]*\\)"),
            `${JSON.stringify(cell)} grants ${role} a table-wide ${verb}: ${s}`);
        }
      }
    }
  }
  // THE OBSERVER IS ALIVE. Eight of the sixteen cells write, plus two presets;
  // a reader that found no write grant at all would satisfy every assertion
  // above perfectly.
  assert.ok(checked >= 8, "the scan found almost no write grants: " + checked);
});

test("the columns granted are exactly the declared, unmanaged ones", () => {
  for (const t of [FORM, OWN, FEED]) {
    const want = t.columns.map((c) => c.name);
    for (const s of writeGrants(t, "authenticated").concat(writeGrants(t, "anonymous"))) {
      const lists = [...s.split(/\bON\b/)[0].matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
      assert.ok(lists.length, t.name + ": a write grant with no column list: " + s);
      for (const list of lists) {
        const got = list.split(",").map((c) => c.trim().replace(/"/g, ""));
        assert.deepEqual(got, want, t.name + ": the column list is not the declared set: " + s);
        // AND NOT ONE OF THEM IS MANAGED — asserted over the real list rather
        // than trusting the equality above, since a declared column could be
        // NAMED like a managed one.
        for (const c of got) assert.equal(isManagedColumn(c), false, t.name + ": " + c + " is managed and grantable");
      }
    }
  }
});

test("every managed column is unreachable, named one at a time", () => {
  // THE PROPERTY STATED AS THE INTENT rather than as a shape: for each managed
  // column the engine can create, no role may be granted a write that names it.
  const t = { name: "everything", read: "own", write: "own",
    columns: [{ name: "title" }], timestamps: true, trash: true, ordered: true, pinnable: true,
    expires: true, scheduled: true, archivable: true, version: true, teamScope: true };
  const all = grants(t).join("\n");
  for (const col of MANAGED_COLUMNS) {
    assert.doesNotMatch(all, new RegExp('\\b(INSERT|UPDATE)[^)]*"' + col + '"'),
      col + " is inside a write grant's column list");
  }
  // THE CONTROL, without which a builder that granted nothing would pass: the
  // one declared column IS there.
  assert.match(all, /\bINSERT \("title"\)/, "the declared column lost its grant too");
});

test("nothing legitimate loses a write — read and delete stay whole", () => {
  // SELECT is table-wide because a member must read `id` and `created_at` to
  // render a row at all, and reading a managed column was never the exposure.
  // DELETE takes no column list in Postgres; the policy scopes which rows.
  const g = grants(OWN).join("\n");
  assert.match(g, /GRANT SELECT, DELETE ON "requests" TO authenticated;/,
    "the member lost their read or their delete");
  // A read-less member-write cell keeps DELETE and gains no SELECT.
  const noRead = grants({ name: "t", read: "none", write: "own", columns: [{ name: "a" }] }).join("\n");
  assert.match(noRead, /GRANT DELETE ON "t" TO authenticated;/);
  assert.doesNotMatch(noRead, /GRANT[^;]*SELECT[^;]*TO authenticated;/, "a read-less cell was granted SELECT");
  // AND THE PUBLIC READ IS UNTOUCHED on the cell it was once dropped from.
  assert.match(grants({ name: "l", read: "public", write: "own", columns: [{ name: "a" }] }).join("\n"),
    /GRANT SELECT ON "l" TO anonymous;/, "the public lost its read");
});

test("a payable table still gets no write grant at all", () => {
  // Unchanged, and asserted here because this change rewrote the branch above
  // it: the money columns are protected by the ABSENCE of a grant, not by a
  // column list, and that is the stronger wall of the two.
  for (const access of ["collect", "user", "feed"]) {
    const t = { name: "orders", access, columns: [{ name: "qty" }], payment: { from: "items" } };
    assert.deepEqual(writeGrants(t, "authenticated"), [], access + ": a payable table is member-writable");
    assert.deepEqual(writeGrants(t, "anonymous"), [], access + ": a payable table is visitor-writable");
  }
  // The control: the same table without payment IS writable.
  assert.ok(writeGrants({ name: "orders", access: "collect", columns: [{ name: "qty" }] }, "anonymous").length);
});

test("writableColumns is one rule, and refuses what it should", () => {
  assert.deepEqual(writableColumns({ columns: [{ name: "title" }, { name: "id" }, { name: "pinned" }, { name: "owner_id" }] }), ["title"]);
  // `String(["title"])` is `"title"` — shipped here three times as a real
  // defect, and here it would put a caller-chosen name into DDL.
  assert.deepEqual(writableColumns({ columns: [{ name: ["title"] }, { name: "ok" }] }), ["ok"]);
  assert.deepEqual(writableColumns({ columns: [{ name: 'a"; DROP TABLE x --' }, { name: "fine" }] }), ["fine"]);
  assert.deepEqual(writableColumns({ columns: [{ name: "Dup" }, { name: "dup" }] }), ["dup"], "a repeat is emitted twice");
  assert.deepEqual(writableColumns({}), []);
  assert.deepEqual(writableColumns(null), []);
  // THE CREATED LIST WINS OVER THE DECLARED ONE, which is what makes a column
  // grant safe to emit: a GRANT naming a column the table has not got fails
  // WHOLE, and the apply loop logs a failed statement and carries on — so one
  // absent name would leave a site silently refusing every form submission.
  assert.deepEqual(writableColumns({ columns: [{ name: "asked_for" }] }, ["really_made", "id"]), ["really_made"]);
  assert.deepEqual(writableColumns({ columns: [{ name: "asked_for" }] }, []), ["asked_for"], "an empty created list must fall back, not blank the grant");
});

test("an EXISTING table's old table-wide grant is revoked before the narrow one lands", async () => {
  // THE HALF THAT DECIDES WHETHER THIS FIX IS WORTH ANYTHING ON A LIVE SITE.
  // `GRANT INSERT (a, b) ON t TO r` does NOT replace `GRANT INSERT ON t TO r` —
  // Postgres keeps both, and the table-level privilege still covers every
  // column. So a narrower grant ADDED beside the old one changes nothing at
  // all: every site built before today would keep its table-wide write.
  //
  // What makes it real is the `REVOKE ALL ON <table> FROM <role>` pair that
  // heads `grantsFor`, which was written for a different reason (a retired
  // table keeping its INSERT) and does this job too. `site-rls.test.mjs` pins
  // the ORDER inside one list; this pins the REACH — that the apply loop
  // re-issues the pair for EVERY table in the spec, including ones that
  // already exist, because the loop walks `spec.tables` rather than a delta.
  //
  // DRIVEN THROUGH THE REAL LOOP, because the property is about what the loop
  // does per table and not about what one call to `grantsFor` returns.
  const { statements } = await applied({ tables: [
    { name: "old_form", read: "none", write: "anyone", columns: [{ name: "name", type: "text" }] },
    { name: "old_saved", read: "own", write: "own", columns: [{ name: "title", type: "text" }] },
  ] });
  for (const t of ["old_form", "old_saved"]) {
    const mine = statements.filter((q) => new RegExp(`(GRANT|REVOKE)[^;]*ON "${t}"`).test(q));
    const lastRevoke = mine.findLastIndex((q) => /^REVOKE /.test(q));
    const firstGrant = mine.findIndex((q) => /^GRANT /.test(q));
    assert.ok(mine.some((q) => new RegExp(`^REVOKE ALL ON "${t}" FROM anonymous;`).test(q)),
      t + ": the anonymous revoke never reached the database");
    assert.ok(mine.some((q) => new RegExp(`^REVOKE ALL ON "${t}" FROM authenticated;`).test(q)),
      t + ": the authenticated revoke never reached the database");
    assert.ok(firstGrant > lastRevoke,
      t + ": a GRANT was issued before the REVOKE, which takes it straight back off");
    // AND THE OBSERVER IS ALIVE: this table really did get a narrow grant, so
    // the ordering above is about statements that exist.
    assert.ok(mine.some((q) => /^GRANT [^;]*\([^)]*\)/.test(q)), t + ": no column-scoped grant was emitted at all");
  }
});

test("the grant names the columns the table REALLY HAS, not the ones it declared", async () => {
  // A SWEEP SURVIVOR IS WHAT BOUGHT THIS CASE, and it is the recorded "a fixture
  // too shallow to separate the two readings": cutting `colNames` off the apply
  // loop changed no answer in this file, because every fixture above declares
  // exactly what the engine creates. The real loop diverges in BOTH directions
  // and each is driven below.
  //
  // WHY IT MATTERS: a GRANT naming a column the table has not got fails WHOLE,
  // and `applySiteSchema` logs a failed statement and carries on — so one absent
  // name leaves a site that silently refuses every form submission.
  const declared = [];
  for (let i = 1; i <= 50; i++) declared.push({ name: "c" + i, type: "text" });
  const { statements } = await applied({ tables: [
    { name: "wide", read: "own", write: "own", slug: "c1", columns: declared },
  ] });
  const ins = statements.filter((q) => /GRANT INSERT \(/.test(q) && /ON "wide"/.test(q));
  assert.equal(ins.length, 1, "expected exactly one column INSERT grant on the table: " + JSON.stringify(ins));
  const named = new Set([...ins[0].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]).filter((n) => n !== "wide"));

  // DIRECTION 1 — CREATED BUT NEVER DECLARED. `slug: "c1"` makes the engine add
  // its own `slug` column; the declared list has no such entry, so a grant built
  // from `t.columns` cannot name it and a member could never write it.
  assert.ok(named.has("slug"), "the auto-slug column is created and was left out of the grant");

  // DIRECTION 2 — DECLARED BUT NEVER CREATED. The column loop takes
  // `t.columns.slice(0, 48)`, so a table declaring fifty gets forty-eight, and a
  // grant built from the declared list names two columns Postgres has never
  // heard of.
  assert.ok(!named.has("c49") && !named.has("c50"),
    "the grant names columns the table does not have: " + [...named].join(", "));

  // THE OBSERVER IS ALIVE. A reader that matched nothing at all would satisfy
  // direction 2 perfectly.
  assert.ok(named.has("c1") && named.has("c48"), "the grant lost the real columns too: " + [...named].join(", "));
});

test("a table with nothing declarable gets no write grant, and says so", async () => {
  const bare = { name: "bare", access: "user", columns: [] };
  assert.deepEqual(writeGrants(bare, "authenticated"), []);
  // IT IS THE SAME RULE, NOT A SPECIAL CASE — there is nothing it could
  // legitimately write, and `GRANT INSERT ()` is not a statement. It is
  // REACHABLE (the design tool requires `columns` and sets no minimum length),
  // so the engine REPORTS it rather than quietly becoming read-only.
  //
  // DRIVEN, NOT READ. The first draft asserted the `refused.push` line was in
  // the source, and `if (false) refused.push(...)` leaves it exactly where a
  // text read looks for it — the recorded "a positional guard cannot see a dead
  // branch", and the sweep is what found it. `applySiteSchema` hangs its
  // refusals off the returned array as `refusedRules`, so the honest check runs
  // the engine and reads them.
  const { statements, made } = await applied({ tables: [
    { name: "bare", read: "own", write: "own", columns: [] },
    { name: "real", read: "own", write: "own", columns: [{ name: "title", type: "text" }] },
  ] });
  const refused = (made && made.refusedRules) || [];
  const mine = refused.filter((r) => r && r.feature === "write");
  assert.equal(mine.length, 1, "the column-less table was not reported: " + JSON.stringify(refused));
  assert.equal(mine[0].table, "bare");
  assert.match(String(mine[0].why), /no declared columns/i, "the refusal does not say why");
  // AND THE TABLE BESIDE IT IS UNAFFECTED — the control, without which an
  // engine that refused every table would satisfy the count above by accident.
  assert.ok(statements.some((q) => /GRANT INSERT \("title"\)/.test(q)), "the ordinary table lost its write grant too");
  assert.ok(!statements.some((q) => /GRANT[^;]*\bINSERT\b[^;]*ON "bare"/.test(q)), "the column-less table was granted INSERT anyway");
});
