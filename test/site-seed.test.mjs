// The top-up that fills starter rows the designer left out.
//
// `seed` is a REQUIRED field on `design_schema` and the model omits it anyway —
// twice in a row on 2026-08-12, on real builds, with nothing noticing. The site
// publishes with an empty price list and a booking form whose Service select has
// no options, permanently, because nothing can write to a `display` table after
// the build. So the edges that matter here are: does it fire ONLY when there is
// a gap (a build the designer got right must cost nothing), can it ever put rows
// somewhere they do not belong, and can it fail a build.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  seedGaps, seedRequest, readSeedRows, topUpSeed, mergeSeed,
  SEED_MODEL, MAX_GAP_TABLES, MAX_GAP_ROWS,
} from "../builder/site-seed.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name" }, { name: "price" }] },
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }] },
  ],
};
const reply = (rows, usage) => ({
  content: [{ type: "tool_use", name: "write_rows", input: { rows } }],
  usage: usage || { input_tokens: 900, output_tokens: 300 },
});
/** Records every request so a test can assert a call was NOT made. */
const sender = (out) => {
  const sent = [];
  return { sent, deps: { send: async (req) => { sent.push(req); return out; } } };
};

// ── when it fires, and when it must not ──────────────────────────────────────

test("a display table with no rows is a gap", () => {
  assert.deepEqual(seedGaps(SPEC, null), [{ name: "services", columns: ["name", "price"] }]);
  assert.deepEqual(seedGaps(SPEC, {}), [{ name: "services", columns: ["name", "price"] }]);
});

test("a table the designer already filled is not a gap", () => {
  assert.deepEqual(seedGaps(SPEC, { services: [{ name: "Skin fade" }] }), []);
  // Case-insensitively, because the seeder matches that way too.
  assert.deepEqual(seedGaps(SPEC, { Services: [{ name: "Skin fade" }] }), []);
});

test("a key present with nothing usable in it IS a gap", () => {
  // ONE OF THE THREE SILENT PATHS that produced the live failure. `seedSiteRows`
  // `continue`s on an empty array without recording a skip, so from outside it
  // is indistinguishable from a table nobody mentioned — and if this read it as
  // "already filled", the very shape that caused the bug would go unfilled.
  for (const empty of [[], [null], ["a string"], [[]], "rows", 7]) {
    assert.equal(seedGaps(SPEC, { services: empty }).length, 1, JSON.stringify(empty));
  }
});

test("only a display table is ever a gap, however it was declared", () => {
  // Through `resolveAccess`, exactly like the seeder — one question, or the
  // top-up fills a table the seeder then refuses and the call was wasted.
  const pair = { tables: [{ name: "menu", read: "public", write: "none", columns: [{ name: "dish" }] }] };
  assert.deepEqual(seedGaps(pair, null), [{ name: "menu", columns: ["dish"] }]);
  for (const access of ["collect", "user", "feed", "admin"]) {
    assert.deepEqual(seedGaps({ tables: [{ name: "t", access, columns: [{ name: "x" }] }] }, null), [], access);
  }
  // The marketplace cell — anyone reads, members write. Fabricating rows there
  // invents listings attributed to nobody.
  assert.deepEqual(seedGaps({ tables: [{ name: "l", read: "public", write: "own", columns: [{ name: "t" }] }] }, null), []);
});

test("engine-managed columns are never offered, and a table with none is skipped", () => {
  const spec = { tables: [{ name: "t", access: "display", columns: [{ name: "id" }, { name: "created_at" }, { name: "title" }] }] };
  assert.deepEqual(seedGaps(spec, null), [{ name: "t", columns: ["title"] }]);
  const managedOnly = { tables: [{ name: "t", access: "display", columns: [{ name: "id" }, { name: "owner_id" }] }] };
  assert.deepEqual(seedGaps(managedOnly, null), [], "nothing writable means nothing to write — and nothing to pay for");
});

test("the number of tables is bounded", () => {
  const many = { tables: Array.from({ length: MAX_GAP_TABLES + 4 }, (_, i) => ({ name: "t" + i, access: "display", columns: [{ name: "x" }] })) };
  assert.equal(seedGaps(many, null).length, MAX_GAP_TABLES);
});

test("no gap means NO MODEL CALL AT ALL", async () => {
  // THE PROPERTY THAT DECIDES WHETHER THIS IS AFFORDABLE. A build the designer
  // got right must cost nothing extra, or a fix for an occasional failure
  // becomes a tax on every build.
  const { sent, deps } = sender(reply({}));
  const out = await topUpSeed(deps, { brief: "A barber shop", spec: SPEC, seed: { services: [{ name: "Skin fade" }] } });
  assert.equal(sent.length, 0);
  assert.deepEqual(out, { rows: {}, usage: null, gaps: [] });
});

// ── what comes back ──────────────────────────────────────────────────────────

test("the request is a forced tool call on the cheap model", () => {
  const req = seedRequest({ brief: "A barber shop in Sheffield", tables: seedGaps(SPEC, null) });
  assert.equal(req.model, SEED_MODEL);
  assert.deepEqual(req.tool_choice, { type: "tool", name: "write_rows" });
  const text = req.messages[0].content;
  assert.match(text, /A barber shop in Sheffield/, "the brief is what makes the rows real for this business");
  assert.match(text, /services \(name, price\)/, "the table and its only columns must be stated");
  assert.doesNotMatch(text, /bookings/, "a collect table is not described to a model asked to invent rows");
});

test("rows come back for the asked table only", async () => {
  const { deps } = sender(reply({
    services: [{ name: "Skin fade", price: 28 }],
    bookings: [{ customer_name: "Invented Person" }],
  }));
  const out = await topUpSeed(deps, { brief: "b", spec: SPEC, seed: null });
  assert.deepEqual(Object.keys(out.rows), ["services"],
    "a table nobody asked about must never be written — those would be fabricated customer submissions");
});

test("an undeclared column and a non-scalar value are dropped", () => {
  const tables = seedGaps(SPEC, null);
  const got = readSeedRows(reply({ services: [{ name: "Skin fade", price: { amount: 28 }, nope: "x" }] }), tables);
  assert.deepEqual(got, { services: [{ name: "Skin fade" }] },
    "an object in a text column renders to a visitor as [object Object]");
});

test("a row with nothing usable left is not kept, and neither is an empty table", () => {
  const tables = seedGaps(SPEC, null);
  assert.deepEqual(readSeedRows(reply({ services: [{ nope: 1 }] }), tables), {},
    "an entry with no usable rows must not mark the table as filled and hide the real gap");
  assert.deepEqual(readSeedRows(reply({ services: [] }), tables), {});
});

test("rows are capped", () => {
  const tables = seedGaps(SPEC, null);
  const many = Array.from({ length: MAX_GAP_ROWS + 6 }, (_, i) => ({ name: "Cut " + i }));
  assert.equal(readSeedRows(reply({ services: many }), tables).services.length, MAX_GAP_ROWS);
});

test("an unreadable answer is no rows, never a throw", () => {
  for (const bad of [null, {}, { content: [] }, { content: [{ type: "text", text: "here you go" }] },
    reply(null), reply("rows"), reply([]), reply({ services: "rows" })]) {
    assert.deepEqual(readSeedRows(bad, seedGaps(SPEC, null)), {}, JSON.stringify(bad));
  }
});

// ── it can never fail a build ────────────────────────────────────────────────

test("a throwing send degrades to exactly today's behaviour", async () => {
  const out = await topUpSeed({ send: async () => { throw new Error("upstream down"); } },
    { brief: "b", spec: SPEC, seed: null });
  assert.deepEqual(out.rows, {});
  assert.equal(out.usage, null, "nothing was spent, so nothing is billed");
  assert.deepEqual(out.gaps, ["services"], "the gap is still reported, so the empty menu can be explained");
  assert.equal(out.failed, true);
});

test("usage is reported even when the answer was unusable", async () => {
  // The tokens were spent either way, and the rule here is charge for what is
  // used. A call that answered nonsense still cost money.
  const { deps } = sender(reply({ nothing: [] }, { input_tokens: 800, output_tokens: 40 }));
  const out = await topUpSeed(deps, { brief: "b", spec: SPEC, seed: null });
  assert.deepEqual(out.rows, {});
  assert.equal(out.usage.in, 800);
  assert.equal(out.usage.out, 40);
});

test("the usage carries the model it was priced at", async () => {
  // IT IS NOT THE DESIGNER'S MODEL. The schema call may be Sonnet or Opus and
  // this one is Haiku, so the two usages can never be added into one object —
  // that is the `sumUsage` bug this repo already paid for. They are summed as
  // dollars, which needs each to know its own rate.
  const { deps } = sender(reply({ services: [{ name: "x" }] }));
  const out = await topUpSeed(deps, { brief: "b", spec: SPEC, seed: null });
  assert.equal(out.usage.model, SEED_MODEL);
});

// ── merging ─────────────────────────────────────────────────────────────────

test("the designer's own rows survive the merge", () => {
  const merged = mergeSeed({ offers: [{ title: "Two for one" }] }, { services: [{ name: "Skin fade" }] });
  assert.deepEqual(Object.keys(merged).sort(), ["offers", "services"]);
  assert.deepEqual(merged.offers, [{ title: "Two for one" }]);
});

test("a key the designer left EMPTY is filled, not preserved", () => {
  // The case this whole path is for: `{services: []}` is present and useless.
  assert.deepEqual(mergeSeed({ services: [] }, { services: [{ name: "Skin fade" }] }).services,
    [{ name: "Skin fade" }]);
});

test("a table the designer really filled is never overwritten", () => {
  const merged = mergeSeed({ services: [{ name: "Theirs" }] }, { services: [{ name: "Ours" }] });
  assert.deepEqual(merged.services, [{ name: "Theirs" }],
    "the designer read the whole brief; this call only saw a summary of it");
});

test("a junk seed does not destroy the top-up", () => {
  for (const bad of [null, undefined, "rows", 7, []]) {
    assert.deepEqual(mergeSeed(bad, { services: [{ name: "x" }] }), { services: [{ name: "x" }] }, JSON.stringify(bad));
  }
});

// ── the wiring, which no unit test of this module can see ───────────────────

test("the build route runs the top-up and settles ONE deposit against both calls", () => {
  // worker.js cannot be imported, and this repo has recorded a feature correct
  // in its module and unreachable from the route ten times.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{ topUpSeed, mergeSeed \} from "\.\/builder\/site-seed\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the build path");
  const call = worker.match(/const top = await topUpSeed\(([\s\S]{0,400}?)\);/);
  assert.ok(call, "nothing calls the top-up, so the designer's omission is still nobody's problem");
  assert.match(call[1], /designed\.seed/, "it must be told what the designer already wrote, or it re-fills filled tables");
  assert.match(worker, /designed = \{ \.\.\.designed, seed: mergeSeed\(designed\.seed, top\.rows\) \}/,
    "the rows are computed and thrown away — the exact shape of a dead feature");

  // ORDERING IS THE WHOLE BILLING ARGUMENT. It must run BEFORE the settlement,
  // or its tokens are a second charge with its own rounding rather than part of
  // the one deposit that was already taken.
  const topAt = worker.indexOf("const top = await topUpSeed(");
  const settleAt = worker.indexOf("const settle = schemaSettlement(");
  assert.ok(topAt > 0 && settleAt > topAt, "the top-up runs after the deposit is settled, so it is billed twice over");
  const settle = worker.match(/const settle = schemaSettlement\(([^)]*)\)/);
  assert.match(settle[1], /seedUsage/, "the settlement does not include what the top-up cost");
});

test("the response says whether the designer had to be covered for", () => {
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /seedTopUp: seedTopUp \|\| undefined/,
    "a build cannot report that its rows were written by the fallback rather than the designer");
});

test("the settlement prices EVERY call in the step, not just the first", async () => {
  // A mutant that settled `parts[0]` alone survived the whole suite: the
  // designer's cost was priced and the top-up's was free. Both calls are real
  // spend on two different models, which is why `pageCredits` is variadic —
  // it prices each at its own rate and sums the dollars.
  const { schemaSettlement } = await import("../builder/publish-pages.mjs");
  const big = { in: 400000, out: 40000, cacheRead: 0, cacheWrite: 0, model: SEED_MODEL };
  const one = schemaSettlement([big], 0);
  const two = schemaSettlement([big, big], 0);
  assert.ok(one > 0, "the fixture is too small to tell the two apart");
  assert.ok(two > one, "a second call in the step costs nothing, so its tokens are never billed");
  // And the single-usage form still behaves exactly as it did before the list.
  assert.equal(schemaSettlement(big, 0), one);
  assert.equal(schemaSettlement(null, 5), 0, "an unreadable meter must KEEP the deposit, never refund it");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE INSTRUCTION, not just the machinery.
//
// The engine seeds correctly and is tested above; the failure measured twice
// this week is upstream of all of it — the designer did not WRITE any seed rows.
// `required` cannot stop that, because a required field means the key is
// present and `seed: {}` satisfies the schema. So the only thing standing
// between a customer and a price list with nothing in it is what the tool says,
// which makes the wording load-bearing and worth pinning.
test("the seed field states the consequence, not just the requirement", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("\n      seed: {");
  assert.ok(at > 0, "the seed field is gone from design_schema");
  // To the NEXT field, never a byte count — a window sized in bytes stops
  // covering what it was written for, which has bitten this repo five times.
  //
  // AND IT IS BELT-AND-BRACES, said out loud rather than left looking like
  // protection. A mutation widening this to the whole file changes NO result,
  // because the uniqueness assertion below already guarantees each phrase
  // occurs once — so the slice cannot be satisfied from outside it either way.
  // What the window still earns is the assertion on the next line: `seed`
  // being renamed or moved fails here rather than silently reading nothing.
  const end = w.indexOf("\n      fonts: {", at);
  assert.ok(end > at, "the field after `seed` moved — retarget this window");
  const field = w.slice(at, end);

  // 1. THE DEAD FORM. An unseeded table whose rows a Select reads renders with
  //    zero options, so nobody can submit — the part that makes this a broken
  //    site rather than a bare one, and the part a model is least likely to
  //    infer from "required".
  // 2. THE THREE SILENT SHAPES. Absent, `{}` and `[]` are the same outcome and
  //    only the first is a schema violation.
  // 3. NO LATER ROUTE. Why it cannot be left for the owner: no importer, and no
  //    page that writes to a display table.
  const MUST = [
    [/ZERO options/, "the dead-form consequence is not stated — the model is told it is required and not what breaks"],
    [/An empty object, an empty array, or a missing key/, "the empty shapes are not named, and they are what the failure actually looked like"],
    [/no route by which/, "nothing says a display table can never be filled in later"],
  ];
  for (const [re, why] of MUST) {
    assert.match(field, re, why);
    // AND UNIQUE TO THIS FIELD, which is what makes the window above mean
    // anything. Without it a mutation widening the slice to the whole file
    // changes no result — the assertions would be satisfied by a neighbour, the
    // failure this repo records under "the neighbour satisfies the assertion".
    // Found by exactly that mutation surviving.
    const hits = w.split(re.source.replace(/\\/g, "")).length - 1;
    assert.equal(hits, 1, "`" + re.source + "` appears " + hits + " times in worker.js — "
      + "this assertion can be satisfied from outside the seed field, so the window is decoration");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IS THE NET OBSERVABLE? Both ends, because either alone passes while the wire
// is cut — which is exactly the state this was in until 2026-08-13: the Worker
// put `seedTopUp` on the response the day the net was built, and nothing ever
// printed it, so the one thing standing between a skipped `seed` and a café
// with a permanently empty menu had never been seen doing its job.

test("the build response carries whether the seed net fired", () => {
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // The COMPUTATION and the RESPONSE are asserted apart. The first existed with
  // the second missing once already, one field over, and a check that only sees
  // the assignment reads as coverage while the caller learns nothing.
  assert.match(worker, /seedTopUp\s*=\s*\{\s*gaps:/,
    "nothing computes which tables the designer missed");
  assert.match(worker, /seedTopUp:\s*seedTopUp\s*\|\|\s*undefined/,
    "the build response does not carry seedTopUp — the net fires invisibly");
});

test("build smoke reads it, and separates the two ways a site gets seeded", () => {
  const smoke = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /d\.seedTopUp/, "the smoke run never looks at seedTopUp");
  // Both branches, not just the interesting one. Reporting only when the net
  // fires leaves "the designer got it right" and "nobody looked" identical in
  // the log — the same absence-reads-as-success shape as the render check
  // reporting clean while its browser was missing.
  assert.match(smoke, /top-up FIRED/, "a fired net is not called out");
  assert.match(smoke, /not needed/, "a run where the designer seeded correctly says nothing at all");
});
