// Declared database functions, asserted as a CHAIN.
//
// Four client hooks — useRpc, useRpcAction, useClaimedRow, useCancelClaim — take
// a function NAME, and until 2026-08-04 nothing could declare one: the designer's
// tool offered no such field and the engine emitted CREATE FUNCTION only for its
// own triggers. So the whole RPC tier, the claim flow and manage.tsx were
// unreachable on every site the builder ever made.
//
// This feature class has died at five separate layers before, each time with the
// other four links intact, so every link is asserted separately.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSchema } from "../site-schema.mjs";
import { functionSql } from "../site-rls.mjs";
import { schemaDigest, lintPages, PAGE_RULES } from "../builder/page-gen.mjs";

const page = (src) => [{ path: "index.tsx", source: 'import { useRpc } from "@/lib/rows";\n' + src }];
const SPEC = {
  tables: [{ name: "bookings", access: "collect", columns: [{ name: "claim_token", type: "uuid" }] }],
  functions: [{ name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "setof bookings", body: "SELECT * FROM bookings WHERE claim_token = tok" }],
};

test("1. the DESIGNER can declare one", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = w.indexOf("const SITE_SCHEMA_TOOL = {");
  const tool = w.slice(i, w.indexOf("\n};", i));
  assert.ok(tool.includes("functions: {"), "the tool offers no way to declare a function");
  assert.ok(/claim_token/.test(tool), "the tool never names the case functions exist for");
});

test("2. the NORMALISER keeps it — the layer that silently drops things", () => {
  // coerceTable builds its output field by field, so anything nobody added to
  // that literal is dropped on every build with no error. teamScope died here.
  const n = normalizeSchema(SPEC);
  assert.equal(n.functions.length, 1);
  assert.deepEqual(n.functions[0].args, [{ name: "tok", type: "uuid" }]);
  assert.equal(n.functions[0].returns, "setof bookings");
  assert.equal(n.functions[0].definer, true, "a claim read must reach past RLS or it returns nothing");
});

test("2b. and it REFUSES what would break the apply or the site", () => {
  const bad = normalizeSchema({
    tables: SPEC.tables,
    functions: [
      { name: "app_user_id", returns: "uuid", body: "SELECT null::uuid" },     // shadows the RLS helper
      { name: "_secret", returns: "void", body: "SELECT 1" },                   // reserved prefix
      { name: "ok_one", returns: "setof nosuchtable", body: "SELECT 1" },       // undeclared table
      { name: "ok_two", returns: "text", body: "" },                            // no body
      { name: "BAD NAME", returns: "text", body: "SELECT 1" },                  // not an identifier
    ],
  });
  assert.equal(bad.functions, undefined, JSON.stringify(bad.functions));
  // Redefining app_user_id would rewrite the access rules of every table on the
  // site from inside a page's data model — the single most dangerous name here.
});

test("3. the ENGINE creates it and grants EXECUTE", () => {
  // ASSERTED ON THE EMITTED SQL, not on whether this repo's source mentions a
  // phrase. The first version was four regexes over site-schema.mjs and FOUR
  // MUTANTS SURVIVED IT: commenting the GRANT out still matched, so did changing
  // the opening $isibi$ to $$, so did deleting SECURITY DEFINER — that last one
  // matched the words inside a COMMENT explaining why it is needed.
  const [create, revoke, g1, g2] = functionSql({
    name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }],
    returns: "setof appointments", body: "SELECT * FROM appointments WHERE claim_token = tok",
    language: "sql", definer: true,
  });
  assert.match(create, /^CREATE OR REPLACE FUNCTION "booking_by_claim"\("tok" uuid\) RETURNS SETOF "appointments"/);
  // Without this a claim read returns NOTHING: collect has no read policy, so a
  // function running as the caller sees exactly what the caller sees.
  assert.ok(create.includes(" SECURITY DEFINER "), create);
  // BOTH delimiters, or a half-renamed pair passes while the body breaks.
  assert.equal((create.match(/\$isibi\$/g) || []).length, 2, create);
  assert.ok(!create.includes("$" + "$"), "a model-written body containing a dollar-quote would end the literal early");
  // Postgres grants EXECUTE to PUBLIC on every new function, so this REVOKE is
  // what makes the two grants below the ACTUAL reach of the function rather than
  // decoration on top of a default that already admitted everybody. Its absence
  // is invisible here — a public function behaves identically either way — and
  // fatal for `internal`, which has nothing else protecting it.
  assert.equal(revoke, 'REVOKE ALL ON FUNCTION "booking_by_claim"(uuid) FROM PUBLIC');
  // A function nobody may EXECUTE exists and answers 404 — publicView, one object over.
  assert.equal(g1, 'GRANT EXECUTE ON FUNCTION "booking_by_claim"(uuid) TO anonymous');
  assert.equal(g2, 'GRANT EXECUTE ON FUNCTION "booking_by_claim"(uuid) TO authenticated');

  // …and the engine RUNS them rather than merely building them.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(src, /for \(const stmt of functionSql\(f\)\) await sqlQuery\(uuid, stmt\)/,
    "the DDL is built and never executed");
});

test("3b. definer:false is invoker-rights, and nothing else changes", () => {
  const [create] = functionSql({ name: "f", args: [], returns: "void", body: "SELECT 1", language: "sql", definer: false });
  assert.ok(!create.includes("SECURITY DEFINER"), create);
  assert.match(create, /LANGUAGE sql/);
});

test("4. the MODEL is told which exist", () => {
  const d = schemaDigest(SPEC);
  assert.match(d, /FUNCTIONS this schema declares/);
  assert.match(d, /booking_by_claim\(tok: uuid\) -> setof bookings/, "a name alone does not say what to pass");
  assert.ok(!/FUNCTIONS this schema declares/.test(schemaDigest({ tables: SPEC.tables })),
    "a site with none must not be told it has some");
});

test("5. the LINT refuses a function that does not exist", () => {
  assert.equal(lintPages(page('useClaimedRow("booking_by_claim", t);'), SPEC).length, 0);
  const bad = lintPages(page('useClaimedRow("nope", t);'), SPEC);
  assert.ok(bad.some((x) => /"nope".*does not declare/.test(x)), JSON.stringify(bad));
  for (const hook of ["useRpc", "useRpcAction", "useCancelClaim"]) {
    const p = lintPages(page(`${hook}("ghost");`), SPEC);
    assert.ok(p.some((x) => /ghost/.test(x)), `${hook} is not checked`);
  }
});

test("6. only functions that REALLY got created are advertised", () => {
  // A body the model wrote can fail to compile. Recording it anyway would point
  // the generator at a 404 on the next revise.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  // THE GUARD'S CONDITION IS PART OF THE ASSERTION. Without it, putting
  // `if (false)` in front of this line left the statement present and the check
  // green — a mutant that survived the first version of this test.
  // THE INVARIANT, not the spelling. This pinned the whole statement, so adding
  // the cross-revise merge broke it while the rule it names stayed exactly true.
  // A guard that fires on a rewrite of the line it watches gets relaxed rather
  // than read — the same lesson as the team_id DDL guard earlier today.
  assert.match(src, /fnsMade\.includes\(f\.name\)/,
    "a function that failed to create must not be advertised to the generator");
  assert.match(src, /if \(byName\.size\) metaOut\.functions = /,
    "and the recorded list must actually be written");
  assert.match(src, /fnErrors\.push/, "a failed function is swallowed with no way to see it");
  // ANCHORED TO A WHOLE LINE. `/made\.functions = fnsMade/` matched happily when
  // the statement sat behind `if (!Array.isArray(made))` — and `made` always IS
  // an array, so the assignment could never run while this check stayed green.
  // That is the dead-code shape this whole file exists to prevent, and it got
  // past the first version of this very test.
  assert.match(src, /^\s*made\.functions = fnsMade;$/m,
    "the assignment is conditional again, so the caller may never be told");
  // The route has to read them BEFORE serialising: JSON.stringify drops
  // properties hung off an array, so they would vanish from `tables`.
  //
  // AND `made` CAN BE NULL SINCE 2026-08-24, so both reads are guarded. A first
  // build provisions no database, `applySiteSchema` never runs, and reading
  // through the result is a TypeError composing the RESPONSE — after the work
  // and after the ledger, so the site exists and the build answers 500. The
  // property is unchanged; the null guard is asserted with it, or a well-meant
  // tidy-up removes it and every frontend build 500s.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /functions: \(made && made\.functions && made\.functions\.length\)/,
    "the build response never says which functions were created, or reads through a null `made`");
  assert.match(w, /functionErrors: \(made && made\.functionErrors\)/,
    "a function that failed to create is invisible to the caller, or reads through a null `made`");
});

test("7. the RULES point at something that now exists", () => {
  // Written for the booking fix an hour before functions were declarable, so it
  // pointed the model at an impossible thing — the very bug being fixed.
  assert.match(PAGE_RULES, /useRpcAction/, "the claim route is no longer described");
});

test("8. a duplicate table name cannot silently destroy the first one", () => {
  // applySiteSchema DROPS a table's policy shapes and its public view before
  // recreating them, so a second declaration of the same name re-ran that
  // teardown and left the emptier version standing — the first's publicView,
  // noOverlap and access rules gone, with no error anywhere.
  //
  // Found by causing it: a second `bookings` in the e2e fixture failed that run
  // on `relation "bookings_public" does not exist`, six checks away from
  // anything to do with the change under test. A model can emit a duplicate just
  // as easily, on a real site.
  const n = normalizeSchema({
    tables: [
      { name: "bookings", access: "collect", publicView: { columns: ["slot"] }, columns: [{ name: "slot" }] },
      { name: "Bookings", access: "collect", columns: [{ name: "note" }] },
    ],
  });
  assert.equal(n.tables.length, 1, "both declarations reached the DDL");
  // The first declaration's guarantees survive…
  assert.ok(n.tables[0].publicView, "a repeat deleted a guarantee the first one declared");
  // …and a column only the duplicate had is not thrown away either.
  assert.deepEqual(n.tables[0].columns.map((c) => c.name), ["slot", "note"]);
  // Case-insensitively, because Postgres folds an unquoted identifier and the
  // engine quotes them — "Bookings" and "bookings" are the same object here.
});

test("9. the tool describes a column the ENGINE can actually create", () => {
  // The tool description said to declare `claim_token` as type uuid with default
  // gen_random_uuid(). PG_TYPES HAS NO uuid — an unknown type falls back to TEXT,
  // silently — and `gen_random_uuid()` is not a reserved default token either, so
  // it would have been stored as the literal STRING "gen_random_uuid()".
  //
  // Measured against a real database: the function body then failed with
  // `operator does not exist: text = uuid`, and the site got a claim flow whose
  // lookup could never match. Advertised at the tool layer, impossible at the
  // engine layer — the same shape as everything else fixed today, written by me
  // an hour after writing the fix for it.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = w.indexOf("const SITE_SCHEMA_TOOL = {");
  const tool = w.slice(i, w.indexOf("\n};", i));
  assert.ok(!/type of uuid|type:'uuid'|type: 'uuid'/.test(tool),
    "the tool tells the model to declare a uuid column, which becomes TEXT");
  assert.match(tool, /default:'uuid'/, "the tool no longer names the reserved token that actually works");

  // And the engine really does have that token, and really does not have uuid.
  const eng = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const types = eng.slice(eng.indexOf("const PG_TYPES = {"), eng.indexOf("};", eng.indexOf("const PG_TYPES = {")));
  assert.ok(!/\buuid:/.test(types), "PG_TYPES gained uuid — the tool text can be simplified");
  assert.match(eng, /uuid: "\(gen_random_uuid\(\)::text\)"/, "the reserved default token is gone");
});

test("11. a later edit does not erase the functions an earlier one declared", () => {
  // FOUND BY ASKING A PRODUCT QUESTION: can a "manage my booking" page be added
  // by a later EDIT rather than built up front? It can — and it would not have
  // survived the edit after that.
  //
  // `metaOut.tables` is merged with what was stored before, so a revise naming
  // one table does not strip the rest. `metaOut.functions` was written from THIS
  // run's spec alone, so a revise declaring no functions recorded none and wiped
  // the list. The functions themselves survive in Postgres — CREATE OR REPLACE
  // persisted them and nothing drops them — but `schemaDigest` reads this list to
  // tell the generator what it may call, and the lint refuses a `useRpc` on a
  // name the list does not carry. So the manage page gets built by one edit and
  // silently dropped by the next.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(prev && Array\.isArray\(prev\.functions\)\) mergedFns = prev\.functions/,
    "the previously recorded functions must be read back");
  // Carried into the written list, keyed by name so this run overrides.
  assert.match(src, /const byName = new Map\(mergedFns\.map/);
  // AND THE TABLE MERGE IT MIRRORS IS STILL THERE. Asserting one without the
  // other lets the pair drift apart, which is how they got out of step.
  assert.match(src, /for \(const t of prev\.tables\)/, "the table merge this mirrors has gone");
});
