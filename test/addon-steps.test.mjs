// ── EACH ADDON STEP DESIGNS ITS PART, GETS WHAT THE OTHERS DESIGNED, AND SAYS
//    WHAT IT COULD NOT DELIVER (2026-09-14) ─────────────────────────────────
//
// Owner: "We're extending the Tables review to function, api, job, page, and
// component. Our goal is that each step designs its part completely, receives
// the information it needs, and clearly reports anything it cannot deliver."
//
// Three corrections came with it and each has its own section below:
//
//   1. VALIDATE EACH ITEM WITH ITS DEPENDENCIES PRESENT. A job needs its
//      function; a function returning booking rows needs the bookings table.
//      Use the accumulated proposed schema as context while checking the
//      individual model declaration — and prove that valid dependent items
//      SURVIVE while unsupported properties are STILL reported.
//   2. SOMETHING EXISTING DOES NOT PROVE THE REQUIREMENT WORKS. Tie completion
//      to evidence for that specific claim; otherwise keep it unverified.
//      Finding a call to a failed function proves a problem; finding no such
//      call does not prove success.
//   3. FINISH THE API BODY CHECK. `normalizeApi` slices POST bodies at 4,000
//      characters. Test with an ACTUAL POST — a GET produces an empty body
//      whatever it declared, so a GET fixture can see none of this.
//
// WHY THESE ARE MODULE-LEVEL DRIVES AND NOT SOURCE READS. The route's own
// wiring is asserted in `requirement-coverage.test.mjs`; what is here is the
// BEHAVIOUR, driven. Every one of the three corrections is a case where reading
// the code said the right thing and running it said another — the API cap was
// read as absent off a GET's empty body, and a job "normalises fine" until you
// normalise one alone and watch it vanish.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  auditTier, refusedFields, droppedFields, unbuiltItems, declaredItems,
  normalizeSchema, SPEC_TIERS, TIER_LIST, TOOL_FIELDS, MAX_FN_BODY,
} from "../site-schema.mjs";
import { MAX_API_BODY, normalizeApi } from "../site-apis.mjs";
import { cleanAdd, addRefusal, proposedSpec, appliedFacts, SPEC_OF_KIND, siteNote, REQUIREMENT_ADDS, ADD_KINDS, addTool, auditFrontend, frontendItem, missingPages, missingPagesNote } from "../builder/site-add.mjs";
import { claimEvidence, requirementOutcomes, requirementNote } from "../builder/site-requirements.mjs";
import { TABLE_ITEM, FUNCTION_ITEM, API_ITEM, JOB_ITEM } from "../builder/site-table.mjs";
import { siteHasTables, siteHasBackend, schemaDigest, pageRulesFor } from "../builder/page-gen.mjs";

/** A stored site with one table and one internal function — real dependencies. */
const BASE = () => normalizeSchema({
  tables: [{ name: "bookings", access: "user", columns: [{ name: "who", type: "text" }, { name: "start_at", type: "timestamptz" }] }],
  functions: [{ name: "cancel_booking", args: [{ name: "id", type: "uuid" }], returns: "void", body: "delete from bookings where id = id", internal: true }],
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVERY TIER IS AUDITED, AND THE OLD READER COULD NOT SEE THREE OF THEM
// ─────────────────────────────────────────────────────────────────────────────

test("the four tiers and their lists agree with the tools, in BOTH directions", () => {
  assert.deepEqual(SPEC_TIERS, ["table", "function", "api", "job"]);
  assert.deepEqual(TIER_LIST, { table: "tables", function: "functions", api: "apis", job: "jobs" });
  // A COPY PLUS A CENSUS, which is the existing `TOOL_TABLE_FIELDS` bargain:
  // the shapes live in `builder/site-table.mjs` and `site-schema.mjs` does not
  // import them, so the census is what keeps the copy honest. A field added to
  // a tool and forgotten here is reported as a MISSING CAPABILITY on every site
  // that uses it — the failure mode this runs in both directions to stop.
  const items = { table: TABLE_ITEM, function: FUNCTION_ITEM, api: API_ITEM, job: JOB_ITEM };
  for (const tier of SPEC_TIERS) {
    const real = Object.keys(items[tier].properties || {});
    assert.ok(real.length > 0, tier + "'s item shape is empty — the census read nothing");
    assert.deepEqual([...TOOL_FIELDS[tier]].sort(), real.sort(),
      "TOOL_FIELDS." + tier + " and the real tool disagree — one of them changed alone");
  }
  // …AND THE ADD PATH'S OWN MAP IS THE SAME FOUR, so a kind that touches the
  // database can never be audited under the wrong list.
  assert.deepEqual(Object.keys(SPEC_OF_KIND).sort(), [...SPEC_TIERS].sort());
  for (const k of SPEC_TIERS) assert.equal(SPEC_OF_KIND[k], TIER_LIST[k]);
});

test("a non-table tier really is audited — the old readers answered [] whatever they were handed", () => {
  const ctx = BASE();
  // THE DEFECT, REPRODUCED. `droppedFields`/`refusedFields` iterated
  // `declaredTables(spec)` alone, so a spec with no `tables` key answered `[]`
  // for every question — a clean sweep over nothing, indistinguishable from a
  // designer that stayed inside the tool. Measured before the change:
  // `droppedFields({functions: [{name, encryptAtRest: true}]})` → [].
  const fn = { name: "peek", args: [], returns: "void", body: "select 1", encryptAtRest: true };
  assert.deepEqual(droppedFields({ functions: [fn] }, "function", ctx), ["encryptAtRest"]);
  const api = { name: "weather", url: "https://x.example/w", retryPolicy: "exponential" };
  assert.deepEqual(droppedFields({ apis: [api] }, "api", ctx), ["retryPolicy"]);
  const job = { name: "remind", fn: "cancel_booking", everyMinutes: 1440, encryptAtRest: true };
  assert.deepEqual(droppedFields({ jobs: [job] }, "job", ctx), ["encryptAtRest"]);
  // …AND THE DEFAULT TIER IS STILL `table`, so every existing call site means
  // exactly what it meant.
  assert.deepEqual(droppedFields({ tables: [{ name: "t", columns: [{ name: "c", type: "text" }], encryptAtRest: true }] }), ["encryptAtRest"]);
});

test("`scanned` is the observer, and every other field is a negative assertion", () => {
  // `[].every(...)` IS `true`. An empty `refused` means "nothing was refused"
  // only if something was looked at, and a caller that reports "no problems"
  // off a scan that read nothing is reporting silence. That is the class this
  // whole change is about, so the count rides beside the three lists.
  const ctx = BASE();
  // RE-ANCHORED 2026-09-14 for `unexpressed`, the fourth report — a key the
  // ENGINE would have used and this step could not carry. The list is stated
  // here rather than spread from a real answer, because the point of this case
  // is that the empty answer says every bucket is empty: deriving it from the
  // reader would make the assertion agree with whatever the reader does.
  const EMPTY = { scanned: 0, reached: [], refused: [], changed: [], unexpressed: [], unbuilt: [] };
  assert.deepEqual(auditTier({}, "job", ctx), EMPTY);
  assert.deepEqual(auditTier(null, "table"), EMPTY);
  // …AND A REAL ANSWER CARRIES EXACTLY THOSE KEYS, so a bucket added next month
  // cannot be reported by the route and silently missing from the empty shape,
  // which is how a caller ends up reading an absent field as "nothing found".
  assert.deepEqual(
    Object.keys(auditTier({ jobs: [{ name: "r", fn: "cancel_booking", everyMinutes: 1440 }] }, "job", ctx)).sort(),
    Object.keys(EMPTY).sort(),
    "the reader answers a field the empty shape does not name",
  );
  assert.deepEqual(auditTier({ jobs: [{}] }, "nonsense", ctx).scanned, 0, "an unknown tier scanned something");
  const real = auditTier({ jobs: [{ name: "remind", fn: "cancel_booking", everyMinutes: 1440 }] }, "job", ctx);
  assert.equal(real.scanned, 1, "a real declaration was not scanned");
  // ONE READING OF THE LIST, whatever shape it arrived in — including the
  // STRINGIFIED one measured at about 1 sample in 20 in `schema gen eval`.
  assert.equal(declaredItems({ jobs: JSON.stringify([{ name: "a" }]) }, "job").length, 1);
  assert.equal(declaredItems({ jobs: { a: { name: "a" } } }, "job").length, 1);
  assert.equal(declaredItems({ jobs: [null, 5, [], "x", { name: "a" }] }, "job").length, 1, "junk was read as a declaration");
  assert.equal(declaredItems({ jobs: "not json" }, "job").length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORRECTION 1 — VALIDATED WITH ITS DEPENDENCIES PRESENT
// ─────────────────────────────────────────────────────────────────────────────

test("a dependent item normalised ALONE vanishes, and that is the wrong question", () => {
  // THE MEASUREMENT THE CORRECTION RESTS ON, driven rather than asserted in
  // prose. Both of these are CORRECT normalisation and both are the wrong
  // reading of the model's answer, because the item is not being declared
  // alone — it is going into a spec that also carries what it needs.
  const job = { name: "remind", fn: "cancel_booking", everyMinutes: 1440 };
  assert.equal(normalizeSchema({ jobs: [job] }).jobs, undefined, "a job alone survived — this case no longer proves anything");
  const fn = { name: "list_open", args: [], returns: "setof bookings", body: "select * from bookings" };
  assert.equal(normalizeSchema({ functions: [fn] }).functions, undefined, "a function naming an absent table survived");
  // WITH the dependency, both survive.
  const ctx = BASE();
  assert.equal(normalizeSchema({ ...ctx, jobs: [job] }).jobs.length, 1);
  assert.equal(normalizeSchema({ ...ctx, functions: [fn] }).functions.length, 1);
});

test("VALID DEPENDENT ITEMS SURVIVE AND UNSUPPORTED PROPERTIES ARE STILL REPORTED", () => {
  // The owner's correction, in one case: both halves at once, because either
  // one alone is satisfiable by a broken reading — an auditor that reports
  // nothing has no false `unbuilt`, and one that reports everything as unbuilt
  // certainly names the bad property.
  const ctx = BASE();
  const job = { name: "remind", fn: "cancel_booking", everyMinutes: 1440, encryptAtRest: true, slaMinutes: 30 };
  const withoutCtx = auditTier({ jobs: [job] }, "job");
  assert.deepEqual(withoutCtx.unbuilt, ["remind"], "without its function the job is dropped whole — the control for the line below");
  assert.deepEqual(withoutCtx.reached, [], "a dropped item cannot report its fields");

  const withCtx = auditTier({ jobs: [job] }, "job", ctx);
  assert.deepEqual(withCtx.unbuilt, [], "a valid dependent item did NOT survive with its dependency present");
  assert.deepEqual(withCtx.reached, ["encryptAtRest", "slaMinutes"], "the unsupported properties stopped being reported");
  assert.equal(withCtx.scanned, 1);

  // THE SAME BOTH WAYS FOR A FUNCTION whose return type names a table.
  const fn = { name: "list_open", args: [], returns: "setof bookings", body: "select * from bookings", sandboxed: true };
  assert.deepEqual(auditTier({ functions: [fn] }, "function").unbuilt, ["list_open"]);
  const okFn = auditTier({ functions: [fn] }, "function", ctx);
  assert.deepEqual(okFn.unbuilt, []);
  assert.deepEqual(okFn.reached, ["sandboxed"]);
});

test("a sibling designed earlier in the same message counts as present", () => {
  // Each kind is its own model call, and the proposal is what carries one
  // designer's answer to the next. A job whose function was designed one call
  // earlier must validate against THAT, not against the stored site.
  const stored = normalizeSchema({ tables: [{ name: "slots", columns: [{ name: "at", type: "timestamptz" }] }] });
  let proposed = proposedSpec(stored, "function", [{ name: "sweep_old", args: [], returns: "void", body: "delete from slots", internal: true }]);
  const job = { name: "nightly", fn: "sweep_old", everyMinutes: 1440, retries: 3 };
  assert.deepEqual(auditTier({ jobs: [job] }, "job", stored).unbuilt, ["nightly"], "the stored site has no such function — the control");
  assert.deepEqual(auditTier({ jobs: [job] }, "job", proposed).unbuilt, [], "a function designed one call earlier did not count");
  assert.deepEqual(auditTier({ jobs: [job] }, "job", proposed).reached, ["retries"]);
});

test("an item the engine drops WHOLE is named — the report that did not exist above the table tier", () => {
  const ctx = BASE();
  // A body naming an internal table is refused OUTRIGHT by the engine: the
  // function is created SECURITY DEFINER and granted to `anonymous`, and
  // `_secrets` holds the owner's Stripe key. Correct, and until now silent.
  const peek = { name: "peek", args: [], returns: "void", body: "select * from _secrets" };
  assert.deepEqual(unbuiltItems({ functions: [peek] }, "function", ctx), ["peek"]);
  // A JOB WHOSE FUNCTION IS PUBLIC is dropped too — only an internal one may
  // be run on a timer.
  const pub = proposedSpec(ctx, "function", [{ name: "lookup", args: [], returns: "void", body: "select 1", internal: false }]);
  assert.deepEqual(unbuiltItems({ jobs: [{ name: "j", fn: "lookup", everyMinutes: 1440 }] }, "job", pub), ["j"]);
  // AN UNNAMED ITEM STILL GETS A ROW: silence is the thing being fixed.
  assert.deepEqual(unbuiltItems({ functions: [{ returns: "void", body: "x" }] }, "function", ctx), ["(unnamed)"]);
});

test("a RENAMED field is not a refusal, and a refused numeric guarantee is", () => {
  // THE TWO MEASURED WAYS THE NAIVE READING IS WRONG, and they pull opposite
  // ways — which is why `refused` asks whether the field's EFFECT was live
  // rather than whether its key survived.
  const ctx = BASE();
  // `cacheSeconds` is kept as `ttl`. The key vanishes; the guarantee did not.
  const api = { name: "weather", url: "https://x.example/w", cacheSeconds: 300 };
  assert.equal(normalizeSchema({ ...ctx, apis: [api] }).apis[0].ttl, 300, "the rename stopped happening — this case tests nothing");
  assert.equal(normalizeSchema({ ...ctx, apis: [api] }).apis[0].cacheSeconds, undefined);
  assert.deepEqual(refusedFields({ apis: [api] }, "api", ctx), [], "a field that worked perfectly is reported as refused");
  // `maxRows: -5` is kept as `maxRows: 0`, and zero means NO CAP. The key
  // survives; the guarantee did not.
  const t = { name: "t", columns: [{ name: "c", type: "text" }], maxRows: -5 };
  assert.equal(normalizeSchema({ tables: [t] }).tables[0].maxRows, 0);
  assert.deepEqual(refusedFields({ tables: [t] }), ["maxRows"], "a refused cap is reported as honoured");
  // …AND A REAL CAP IS NOT REPORTED.
  assert.deepEqual(refusedFields({ tables: [{ ...t, maxRows: 100 }] }), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORRECTION 3 — THE API BODY, DRIVEN THROUGH A REAL POST
// ─────────────────────────────────────────────────────────────────────────────

test("a GET's body normalises to empty whatever it declared — why a GET fixture proves nothing", () => {
  // THE READING ERROR THIS CASE EXISTS TO STOP. An earlier pass read
  // `normalizeApi`'s output for a GET, saw `body: ""`, and concluded there was
  // no cap at all. The cap is real and only a POST can see it.
  const huge = "x".repeat(5000);
  assert.equal(normalizeApi({ name: "a", url: "https://x.example/y", method: "GET", body: huge }).body, "");
  assert.equal(normalizeApi({ name: "a", url: "https://x.example/y", body: huge }).body, "", "an unstated method is a GET");
});

test("the engine SLICES a POST body and the cleaner REFUSES it, at one number", () => {
  const huge = "x".repeat(5000);
  // THE ENGINE'S BEHAVIOUR, MEASURED: 5,000 in, 4,000 out, silently. The slice
  // stays as a belt for a payload that never met the cleaner, so this is the
  // wall rather than a bug.
  const kept = normalizeApi({ name: "a", url: "https://x.example/y", method: "POST", body: huge });
  assert.equal(kept.body.length, MAX_API_BODY);
  assert.equal(MAX_API_BODY, 4000);
  // THE CLEANER REFUSES RATHER THAN CUTTING, at the same number, because a
  // connection that POSTs half a request to somebody else's server for ever is
  // a failure the customer can neither see nor act on.
  const site = { tables: [], functions: [], apis: [], jobs: [], jobFns: [], url: "https://x.gofarther.app/", pages: ["/"] };
  const over = cleanAdd("api", [{ name: "a", url: "https://x.example/y", method: "POST", body: huge }], site);
  assert.equal(over.ok, false);
  assert.equal(over.why, "body-too-long");
  assert.deepEqual(over.skipped, [{ why: "body-too-long", name: "a" }]);
  // AT the wall is fine; one over is not — the boundary, not a round number.
  const atCap = cleanAdd("api", [{ name: "a", url: "https://x.example/y", method: "POST", body: "x".repeat(MAX_API_BODY) }], site);
  assert.equal(atCap.ok, true);
  assert.equal(atCap.value[0].body.length, MAX_API_BODY, "a body at the wall was cut anyway");
  const one = cleanAdd("api", [{ name: "a", url: "https://x.example/y", method: "POST", body: "x".repeat(MAX_API_BODY + 1) }], site);
  assert.equal(one.why, "body-too-long");
  // AND THE CUSTOMER GETS A SENTENCE, not a silently different request.
  assert.match(addRefusal("body-too-long"), /smaller pieces/);
  assert.match(addRefusal("body-too-long"), /Nothing was changed/);
});

test("the function body had TWO walls a factor of two apart, and now has one", () => {
  // `site-add.mjs` sliced at 8,000 and the engine at 4,000, so a body in
  // between passed the cleaner WHOLE, was reported to the customer as added,
  // and reached Postgres as 4,000 characters of a statement.
  assert.equal(MAX_FN_BODY, 4000);
  const mid = "select 1; " + "x".repeat(5000);
  assert.equal(normalizeSchema({
    tables: [{ name: "t", columns: [{ name: "a", type: "text" }] }],
    functions: [{ name: "f", args: [], returns: "void", body: mid }],
  }).functions[0].body.length, MAX_FN_BODY, "the engine stopped slicing — this case tests nothing");
  const site = { tables: [], functions: [], apis: [], jobs: [], jobFns: [], url: "https://x.gofarther.app/", pages: ["/"] };
  const over = cleanAdd("function", [{ name: "f", returns: "void", body: mid }], site);
  assert.equal(over.why, "body-too-long", "the cleaner cut a body the engine would cut again");
  const ok = cleanAdd("function", [{ name: "f", returns: "void", body: "select 1" }], site);
  assert.equal(ok.ok, true);
  assert.equal(ok.value[0].body, "select 1");
});

test("an answer longer than the cap is NAMED, not silently shortened", () => {
  // `.slice(0, cap)` ran BEFORE the loop that names refusals, so an answer with
  // seven connections against a cap of four lost three with nothing on
  // `skipped`, nothing in the reply, and the customer told it was done. Every
  // other refusal in that file is a sentence; this one is too now.
  const site = { tables: [], functions: [], apis: [], jobs: [], jobFns: [], url: "https://x.gofarther.app/", pages: ["/"] };
  const many = Array.from({ length: 7 }, (_, i) => ({ name: "a" + i, url: "https://x.example/" + i }));
  const r = cleanAdd("api", many, site);
  assert.equal(r.ok, true);
  assert.equal(r.value.length, 4, "the cap moved — re-derive this case");
  assert.deepEqual(r.skipped.map((s) => s.why), ["over-cap", "over-cap", "over-cap"]);
  assert.deepEqual(r.skipped.map((s) => s.name), ["a4", "a5", "a6"], "a dropped entry is not named");
  assert.match(addRefusal("over-cap"), /another message/);
  // …AND THE QR CAP KEEPS ITS OWN SENTENCE: `too-many` is about a site that
  // already carries as many codes as it can, which is a different thing to say.
  assert.notEqual(addRefusal("over-cap"), addRefusal("too-many"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE PROPOSAL, AND WHAT EACH STEP IS TOLD
// ─────────────────────────────────────────────────────────────────────────────

test("the proposal accumulates and the baseline is never written to", () => {
  const base = normalizeSchema({ tables: [{ name: "slots", columns: [{ name: "at", type: "timestamptz" }] }] });
  const before = JSON.stringify(base);
  let spec = proposedSpec(base, "table", [{ table: { name: "bookings", columns: [{ name: "who", type: "text" }] } }]);
  spec = proposedSpec(spec, "function", [{ name: "cancel", args: [], returns: "void", body: "x", internal: true }]);
  spec = proposedSpec(spec, "api", [{ name: "weather", url: "https://x.example/w" }]);
  spec = proposedSpec(spec, "job", [{ name: "remind", fn: "cancel", everyMinutes: 1440 }]);
  assert.deepEqual(spec.tables.map((t) => t.name), ["slots", "bookings"]);
  assert.deepEqual(spec.functions.map((f) => f.name), ["cancel"]);
  assert.deepEqual(spec.apis.map((a) => a.name), ["weather"]);
  assert.deepEqual(spec.jobs.map((j) => j.name), ["remind"]);
  // THE BASELINE IS WHAT `added` VERSUS `altered` IS DECIDED AGAINST, what the
  // reply reports, and what a refused addition leaves the site as. A proposal
  // written over it is a change nothing can roll back.
  assert.equal(JSON.stringify(base), before, "the stored baseline was mutated");
  // REPLACE BY NAME, NEVER APPEND BLINDLY: the engine's `CREATE OR REPLACE`
  // means a named function is replaced, and two entries of one name would make
  // the validator find whichever came first.
  const twice = proposedSpec(spec, "function", [{ name: "cancel", args: [], returns: "int", body: "y", internal: true }]);
  assert.equal(twice.functions.length, 1);
  assert.equal(twice.functions[0].returns, "int");
  // A KIND THAT TOUCHES NO TIER CHANGES NOTHING.
  assert.equal(proposedSpec(spec, "component", [{ name: "x" }]), spec);
  assert.equal(proposedSpec(spec, "table", []), spec, "an empty answer rewrote the spec");
});

test("the note marks what is being added by this same change", () => {
  // Telling a designer only "the site stores bookings" is how it designs around
  // a table that does not exist yet — or designs a second one. Each proposed
  // name is marked so it can be relied on AND known to be new.
  const note = siteNote({
    name: "Fretwork", kind: "shopfront", url: "https://fretwork-1.gofarther.app/", pages: ["/"], hasDatabase: true,
    tables: ["slots", "bookings"], columns: { slots: ["at timestamptz"], bookings: ["who text"] },
    functions: ["cancel"], jobFns: ["cancel"], jobs: ["remind"], apis: [],
    proposed: { tables: ["bookings"], functions: ["cancel"], jobFns: ["cancel"], jobs: ["remind"] },
  });
  assert.match(note, /bookings \(who text\) — being added by this same change/);
  assert.match(note, /cancel \(being added by this same change\)/);
  assert.match(note, /remind \(being added by this same change\)/);
  assert.doesNotMatch(note, /slots \(at timestamptz\) — being added/, "a stored table is presented as new");
  // A CALLER THAT PASSES NO `proposed` GETS THE NOTE IT ALWAYS GOT, byte for
  // byte — the same rule the columns and the table facts already follow.
  const plain = siteNote({
    name: "Fretwork", kind: "shopfront", url: "https://fretwork-1.gofarther.app/", pages: ["/"], hasDatabase: true,
    tables: ["slots", "bookings"], columns: { slots: ["at timestamptz"], bookings: ["who text"] },
    functions: ["cancel"], jobFns: ["cancel"], jobs: ["remind"], apis: [],
  });
  assert.doesNotMatch(plain, /being added by this same change/);
});

test("all six designing kinds answer coverage, and the dispatched one cannot", () => {
  assert.deepEqual(REQUIREMENT_ADDS, ["table", "function", "api", "job", "page", "component"]);
  for (const k of REQUIREMENT_ADDS) {
    assert.ok(addTool(k).input_schema.properties.requirements, k + " designs something and cannot say what it could not cover");
  }
  // ── RE-ANCHORED 2026-09-17: `photo` HAS A TOOL NOW AND STILL NO COVERAGE ──
  //
  // This asserted that asking for its tool THROWS, which was true while it
  // dispatched always. It is designed here when this change writes the page it
  // lands on, so the tool exists — and the property under test never was "it
  // has no tool", it is that a kind answering no coverage does not carry the
  // list. `qr`, `three` and `photo` all have tools and deliberately answer
  // none, and the census above is what keeps the six that do.
  for (const k of ADD_KINDS.filter((x) => !REQUIREMENT_ADDS.includes(x))) {
    let tool = null;
    try { tool = addTool(k); } catch { tool = null; }
    if (tool) assert.equal(tool.input_schema.properties.requirements, undefined, k + " answers coverage and is not on the list");
  }
  assert.equal(addTool("qr").input_schema.properties.requirements, undefined);
  assert.equal(addTool("photo").input_schema.properties.requirements, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE API-ONLY SITE — a backend no page could reach
// ─────────────────────────────────────────────────────────────────────────────

test("a connection or a callable function IS a backend, and the page step is told so", () => {
  // FOUR PLACES AGREED AND ALL FOUR WERE WRONG about a site with one connection
  // and no tables: the rules said "THIS SITE HAS NO DATABASE… there is no API
  // to call", rule 11 (call a declared function) was stripped by NUMBER, the
  // request said "THIS SITE'S DATA / There is none", and the digest returned
  // before composing the connection section. The connection was designed,
  // applied and served by the platform — and unreachable from every page.
  const apiOnly = { tables: [], functions: [], apis: [{ name: "weather", params: ["city"] }] };
  const fnOnly = { tables: [], functions: [{ name: "lookup", args: [], returns: "void", body: "x", internal: false }], apis: [] };
  const internalOnly = { tables: [], functions: [{ name: "send", args: [], returns: "void", body: "x", internal: true }], apis: [] };
  const nothing = { tables: [], functions: [], apis: [] };

  assert.equal(siteHasTables(apiOnly), false, "`siteHasTables` is still the narrower fact and stays");
  assert.equal(siteHasBackend(apiOnly), true);
  assert.equal(siteHasBackend(fnOnly), true);
  // AN INTERNAL FUNCTION IS NOT A BACKEND A PAGE CAN REACH: it is REVOKEd from
  // PUBLIC and never granted to the Data API roles, and the digest already
  // filters it out for that reason.
  assert.equal(siteHasBackend(internalOnly), false);
  assert.equal(siteHasBackend(nothing), false);
  assert.equal(siteHasBackend(null), false);

  const NO_DB = /THIS SITE HAS NO DATABASE/;
  assert.doesNotMatch(pageRulesFor(apiOnly), NO_DB, "a site with a connection is told it has no API to call");
  assert.doesNotMatch(pageRulesFor(fnOnly), NO_DB);
  assert.match(pageRulesFor(internalOnly), NO_DB, "a site whose only function is internal got the data rules");
  assert.match(pageRulesFor(nothing), NO_DB);
});

test("the digest names the connections and functions even with no tables", () => {
  // THE EARLY RETURN SAT ABOVE `fnLines` AND `apiLines`, so the catalogue that
  // names what a page may call was never composed for a table-less site — the
  // same shape as the `useApi` gap this function's own comment records, one
  // return statement earlier.
  const apiOnly = { tables: [], functions: [], apis: [{ name: "weather", params: ["city"] }] };
  const d = schemaDigest(apiOnly);
  assert.match(d, /the schema declares no tables/, "the table half stopped being said plainly");
  assert.match(d, /OUTSIDE DATA this site can read/);
  assert.match(d, /weather\(city\)/);
  const fnOnly = { tables: [], functions: [{ name: "lookup", args: [{ name: "id", type: "uuid" }], returns: "void", body: "x", internal: false }], apis: [] };
  assert.match(schemaDigest(fnOnly), /lookup\(id: uuid\) -> void/);
  // AN INTERNAL FUNCTION IS STILL NOT ADVERTISED — it answers 403 to every
  // visitor, and listing it told the model it could call it.
  assert.doesNotMatch(schemaDigest({ tables: [], functions: [{ name: "send", args: [], returns: "void", body: "x", internal: true }], apis: [] }), /send\(/);
  // A SITE WITH NOTHING READS EXACTLY AS IT ALWAYS DID.
  assert.equal(schemaDigest({ tables: [], functions: [], apis: [] }), "(the schema declares no tables)");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. A JOB THAT WOULD NOT REGISTER IS SAID — on both sides of the wire
// ─────────────────────────────────────────────────────────────────────────────

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
const W = blank(fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8"));
const C = blank(fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8"));
// THE BLANKER'S OWN OBSERVER: a blanker that ate the file satisfies every
// absence check below perfectly.
assert.ok(W.includes("await persistSiteJobs(env, ou.id, ownerSlug, merged.jobs)"), "the blanker ate the addon's job registration");
assert.ok(C.includes("function addonReplyText"), "the blanker ate the browser's addon reader");

test("a failed job registration clears the jobs and names itself, like a failed function", () => {
  // THE CATCH LOGGED TO A CONSOLE NOBODY READS and left `aJobs` exactly as it
  // was, so the reply said "scheduled a reminder every day at 09:00" about
  // something nothing would ever run. The old comment said "a job that did not
  // register is a job the next publish registers" — `persistSiteJobs` has two
  // call sites and the other is the BUILD route, so on this path that is a full
  // rebuild, not the next publish. A rule true because of a layer below it.
  assert.equal((W.match(/await persistSiteJobs\(/g) || []).length, 2, "the job registration's call sites moved — re-read the claim above");
  const at = W.indexOf("await persistSiteJobs(env, ou.id, ownerSlug, merged.jobs)");
  const end = W.indexOf("try { aSeeded = await seedSiteRows(", at);
  assert.ok(end > at, "the registration window could not be closed");
  const block = W.slice(at, end);
  assert.ok(block.length > 200 && block.length < 2000, "the registration window is the wrong size: " + block.length);
  assert.match(block, /aJobErrors = aJobs\.map\(\(j\) => \(\{ name: j\.name, error: why \}\)\)/, "a failed registration does not name the jobs it lost");
  assert.match(block, /aJobs = \[\];/, "a failed registration leaves the jobs on the reply, so the customer is told they are scheduled");
  assert.match(block, /aFailedKinds\.add\("job"\)/, "a failed registration does not make the job step a failure for the coverage");
  assert.match(block, /aMark\("jobs", "fail"/, "a failed registration leaves no trace mark");
  // A FUNCTION THAT FAILED TO CREATE IS THE SAME KIND OF FACT, and was already
  // reported — it just never reached the coverage, so a requirement handed to
  // the `function` step still read as delivered on a change where it does not
  // exist.
  assert.match(block, /if \(aFnErrors\.length\) aFailedKinds\.add\("function"\)/, "a function the database refused does not fail its step");
  // …AND THE ERROR IS BOUNDED AND NOT THE RAW THROW: a driver message can
  // quote what it was handed.
  assert.match(block, /\.slice\(0, 200\)/, "a registration failure's message is unbounded");
});

test("`jobErrors` reaches the wire and the browser prints it", () => {
  // TWO HALVES BUILT TO MEET. `functionErrors` is the precedent and is asserted
  // beside it in both places, so a reader cannot be added for one and forgotten
  // for the other — which is exactly how this shipped with a reporter on one
  // tier and none on the next.
  assert.ok((W.match(/jobErrors: aJobErrors\.length \? aJobErrors : undefined/g) || []).length >= 2,
    "the failed jobs do not reach both the queued reply and the synchronous one");
  assert.ok((W.match(/functionErrors: aFnErrors\.length \? aFnErrors : undefined/g) || []).length >= 2,
    "the observer is dead: the function half is not on both replies either");
  assert.match(C, /for \(const je of \(Array\.isArray\(a\.jobErrors\) \? a\.jobErrors : \[\]\)\.slice\(0, 3\)\)/,
    "the browser never reads the failed jobs");
  assert.match(C, /couldn’t be set up/, "the browser has no sentence for a job that would not register");
  assert.match(C, /so it won’t run yet/, "the sentence does not say what it means for the customer");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE AUDIT READS THE DECLARATION, AND THE PROPOSAL MERGES AN EXTENSION
// (2026-09-14, the four corrections)
// ─────────────────────────────────────────────────────────────────────────────

test("`sent` is what really goes into the engine, and the keys are the model's own", () => {
  // THE DEFECT, AT MODULE LEVEL. `cleanAdd` rebuilds a function out of the six
  // keys it knows, so an un-offered property is gone before the audit — the
  // measurement that found it, driven here rather than quoted.
  const declared = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;", encryptAtRest: true, retries: 3 };
  const clean = cleanAdd("function", [declared], { functions: [], jobFns: [] });
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.skipped, [], "the cleaner reported the un-offered properties — this case tests nothing");
  const sentItem = clean.value[0];
  assert.ok(!("encryptAtRest" in sentItem) && !("retries" in sentItem), "the cleaner kept them — this case tests nothing");
  const ctx = { tables: [], functions: [], apis: [], jobs: [] };
  // AUDITING THE CLEANED ITEM SEES NOTHING, which is what shipped.
  assert.deepEqual(auditTier({ functions: [sentItem] }, "function", ctx).reached, []);
  // AUDITING THE DECLARATION, with `sent` naming what really goes in, sees both.
  const sent = new Map([[sentItem.name, sentItem]]);
  assert.deepEqual(auditTier({ functions: [declared] }, "function", ctx, { sent }).reached, ["encryptAtRest", "retries"]);
});

test("the cleaned items are paired by NAME, so a refused sibling shifts nothing", () => {
  // NEVER BY POSITION: a cleaner that refuses one item shifts every index
  // behind it, and the audit would then report one item's keys against
  // another's normalisation.
  const ctx = { tables: [], functions: [], apis: [], jobs: [] };
  const a = { name: "aa", internal: true, returns: "void", body: "BEGIN END;", encryptAtRest: true };
  const b = { name: "bb", internal: true, returns: "void", body: "BEGIN END;" };
  const cleanB = cleanAdd("function", [b], { functions: [], jobFns: [] }).value[0];
  // `aa` never reached the engine (the cleaner refused it); only `bb` did.
  const out = auditTier({ functions: [a, b] }, "function", ctx, { sent: new Map([["bb", cleanB]]) });
  assert.equal(out.scanned, 2, "an item the cleaner refused was not even counted");
  assert.deepEqual(out.reached, [], "a refused item's keys were reported against its sibling's normalisation");
  assert.deepEqual(out.unbuilt, [], "the cleaner's own refusal was reported as the ENGINE dropping an item");
});

test("a declared scalar the pipeline keeps under another value is `changed`", () => {
  // The third report, and the class it closes is the recorded open one: "a
  // declared value replaced by a different VALID value", which neither
  // `reached` (the key did reach something) nor `refused` (the effect is live)
  // covers. Driven through the real cleaner, so the clamp is the product's.
  const site = { functions: ["send_reminder"], jobFns: ["send_reminder"], jobs: [] };
  const declared = { name: "daily", fn: "send_reminder", everyMinutes: 5 };
  const sentItem = cleanAdd("job", [declared], site).value[0];
  assert.ok(sentItem.everyMinutes > 5, "the floor did not apply — this case tests nothing");
  const ctx = { tables: [], functions: [{ name: "send_reminder", internal: true, returns: "void", body: "BEGIN END;" }], apis: [], jobs: [] };
  const out = auditTier({ jobs: [declared] }, "job", ctx, { sent: new Map([["daily", sentItem]]) });
  assert.deepEqual(out.changed, ["everyMinutes"], "a clamped declaration is not reported as changed");
  assert.deepEqual(out.refused, [], "a live value was reported as refused");
  // OBJECTS AND ARRAYS ARE NEVER COMPARED: normalisation legitimately ENRICHES
  // them — a column gains its type on every table there is — so comparing them
  // would report every declaration on the platform as changed.
  const t = { name: "t", columns: [{ name: "c" }] };
  assert.deepEqual(auditTier({ tables: [t] }, "table", { tables: [] }).changed, [],
    "a normalised column list was reported as a changed declaration");
});

test("proposedSpec merges a table extension the way the apply does, and replaces the other three tiers", () => {
  // THE APPLY'S OWN MERGE, not a second idea of one. A replaced table is the
  // commonest addition there is — "add a notes field" — described to every
  // later designer as a table with one column and no permissions.
  const stored = {
    tables: [{ name: "bookings", access: "user", unique: ["slot"], columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }] }],
    functions: [{ name: "f", internal: true, returns: "void", body: "BEGIN END;" }],
  };
  const out = proposedSpec(stored, "table", [{ table: { name: "bookings", columns: [{ name: "notes", type: "text" }] } }]);
  const t = out.tables.find((x) => x.name === "bookings");
  assert.equal(out.tables.length, 1, "the extension appended a second table of the same name");
  assert.deepEqual(t.columns.map((c) => c.name), ["who", "slot", "notes"], "the extension lost the stored columns");
  assert.equal(t.access, "user", "the extension lost the stored permissions");
  assert.deepEqual(t.unique, ["slot"], "the extension lost a stored guarantee");
  // THE BASELINE IS NEVER MUTATED — it is what a refused addition leaves the
  // site as, and a proposal written over it is a change nothing can roll back.
  assert.deepEqual(stored.tables[0].columns.map((c) => c.name), ["who", "slot"], "the baseline was written to");
  // A TABLE THE SITE DOES NOT HAVE IS APPENDED WHOLE, exactly as before.
  const added = proposedSpec(stored, "table", [{ table: { name: "waitlist", columns: [{ name: "who", type: "text" }] } }]);
  assert.deepEqual(added.tables.map((x) => x.name), ["bookings", "waitlist"]);
  // …AND THE THREE SPEC-LEVEL TIERS STILL REPLACE BY NAME: `CREATE OR REPLACE`
  // means a function named again IS the new body, whole.
  const fn = proposedSpec(stored, "function", [{ name: "f", internal: false, returns: "int", body: "BEGIN RETURN 2; END;" }]);
  assert.equal(fn.functions.length, 1);
  assert.equal(fn.functions[0].returns, "int", "a re-declared function was merged instead of replaced");
});

test("normalising WHAT WAS SENT is not the same as normalising the declaration", () => {
  // THE MEASUREMENT THAT MADE `sent`'s normalisation load-bearing, and it is a
  // privacy guarantee rather than a cosmetic one. `internal: "yes"` is truthy
  // and is not `true`, so the cleaner writes `internal: false` — the function
  // is created PUBLIC, callable by every visitor — while normalising the
  // DECLARATION keeps the truthy string and reads the guarantee as merely
  // stored differently.
  //
  //   from what was SENT        → refused: ["internal"]   (the guarantee is gone)
  //   from the DECLARATION      → changed: ["internal"]   (it is there, differently)
  //
  // Found by a mutation survivor, measured over ten shapes: this is the ONE of
  // them where the two readings diverge, and `refused` is the true one.
  //
  // ── RE-ANCHORED 2026-09-14, AND THE PRODUCT MOVED UNDER IT ────────────────
  //
  // This measurement is what bought the fix: `cleanAdd` now REFUSES a privacy
  // value it cannot read instead of writing `false`, so the shape below is one
  // the cleaner no longer produces. The refusal is asserted first, because it
  // is the thing the measurement was for — and `sentItem` is then built by
  // hand, which is honest for a MODULE case about `auditTier`: `sent` is that
  // function's input contract and it must be right about any item handed to
  // it, including one from a caller that is not this cleaner.
  const declared = { name: "f2", internal: "yes", returns: "void", body: "BEGIN END;" };
  const cleaned = cleanAdd("function", [declared], { functions: [], jobFns: [] });
  assert.equal(cleaned.ok, false, "an unreadable privacy value is cleaned instead of refused");
  assert.equal(cleaned.why, "bad-internal");
  // WHAT THE CLEANER USED TO SEND: `internal` binned to `false`, the function
  // created PUBLIC and callable by every visitor.
  const sentItem = { name: "f2", args: [], returns: "void", body: "BEGIN END;", internal: false, exists: false };
  const ctx = { tables: [], functions: [], apis: [], jobs: [] };
  const fromSent = auditTier({ functions: [declared] }, "function", ctx, { sent: new Map([["f2", sentItem]]) });
  const fromDecl = auditTier({ functions: [declared] }, "function", ctx, { sent: new Map([["f2", declared]]) });
  assert.deepEqual(fromSent.refused, ["internal"], "a binned privacy guarantee is not reported as refused");
  assert.deepEqual(fromSent.changed, [], "a binned guarantee is reported as merely changed");
  assert.deepEqual(fromDecl.refused, [], "the two readings agree — this case no longer divides them");
});

test("a list is never reported as changed, however much of it the cleaner dropped", () => {
  // THE CONTROL THAT PROVES `scalar` LOAD-BEARING, and the first one written
  // could not: a list of OBJECTS stringifies to "[object Object]" whichever
  // objects it holds, so `columns` can never look changed with or without the
  // guard. A list of STRINGS can — `params` declared `["ok","not ok!"]` reaches
  // the engine as `["ok"]`, and `String()` tells those apart.
  const declared = { name: "a4", url: "https://x.test/y", params: ["ok", "not ok!"] };
  const sentItem = cleanAdd("api", [declared], { apis: [] }).value[0];
  assert.deepEqual(sentItem.params, ["ok"], "the cleaner kept the malformed param — this case tests nothing");
  assert.notEqual(String(declared.params), String(sentItem.params), "the two lists stringify the same — this case tests nothing");
  const out = auditTier({ apis: [declared] }, "api", { tables: [], functions: [], apis: [], jobs: [] },
    { sent: new Map([["a4", sentItem]]) });
  assert.deepEqual(out.changed, [], "a shortened list was reported as a changed declaration");
});

test("appliedFacts checks a claim against what Postgres really enforces", () => {
  // LIFTED OUT OF THE ROUTE because a mutant that emptied `fails` survived a
  // sweep: the only route path that applies a table wants a container, so the
  // wall could not be driven where it lived.
  const spec = { tables: [{ name: "bookings", access: "user", unique: ["slot"], columns: [{ name: "slot", type: "text" }] }] };
  const [t] = appliedFacts({ spec, tables: ["bookings"] });
  assert.equal(t.name, "bookings");
  assert.ok(t.holds.includes("user") && t.holds.includes("own"), "the applied level is not evidence: " + JSON.stringify(t.holds));
  assert.ok(t.holds.includes("slot") && t.holds.includes("unique"), "the applied columns and guarantee are not evidence");
  // EVERY OTHER LEVEL IS A CONTRADICTION, and the vocabulary is the engine's.
  for (const l of ["anyone", "members", "public", "none", "collect", "display", "admin"]) {
    assert.ok(t.fails.includes(l), "`" + l + "` is not read as contradicting an applied `user` table");
  }
  assert.ok(!t.fails.includes("user") && !t.fails.includes("own"), "a level the table really has reads as a contradiction");
  // AND THE PAIR IS WHAT DECIDES A CLAIM, both ways.
  // RE-ANCHORED 2026-09-15 onto what each answer BUYS rather than onto the
  // shape of the refusal. A contradicted claim used to answer `null`, which
  // became indistinguishable from "nothing here could see either way" once a
  // `covered` claim started reading its implementation — and that reading is
  // false here: the table was named and really applied, so what is denied is
  // the guarantee and not the thing. The property is unchanged — a claim the
  // applied permissions contradict may not read as configuration that holds.
  assert.equal(claimEvidence("bookings access user, so a member sees only their own rows", [t]).kind, "config");
  assert.equal(claimEvidence("bookings, readable by anyone", [t]).kind, "contradicted");
  // A TABLE THE SPEC DOES NOT DESCRIBE CARRIES NO GUARANTEES — never invented
  // ones, which would make a name match evidence again through the back door.
  // RE-ANCHORED 2026-09-14 for `checked`, the list that separates a
  // configuration fact from a behaviour something really exercised. Every
  // entry carries it and every entry's is EMPTY, because nothing on this path
  // runs a function, calls a connection or fires a job to see what it does.
  // RE-ANCHORED 2026-09-15 off the whole-object shape and onto the PROPERTY:
  // every entry now carries an explicit `kind`, which is the structural
  // reference the requirement reconciliation matches on, so a `deepEqual`
  // against a four-key literal reported an honest new field as the feature
  // being gone — this file's own "assert the property, not the spelling".
  const unknown = appliedFacts({ spec, tables: ["waitlist"] })[0];
  assert.equal(unknown.name, "waitlist");
  assert.equal(unknown.kind, "table", "an applied entry does not say what KIND of thing it is");
  assert.deepEqual([unknown.holds, unknown.fails, unknown.checked], [[], [], []],
    "a table the spec does not describe was given guarantees it never declared");
  // A JOB'S SCHEDULE IS ITS GUARANTEE, and a job whose function the database
  // refused is not a result at all.
  const jobs = [{ name: "daily", fn: "send_reminder", everyMinutes: 1440, at: "09:00" }];
  assert.deepEqual(appliedFacts({ jobs })[0].holds, ["1440", "09:00"]);
  assert.deepEqual(appliedFacts({ jobs, fnErrors: [{ name: "send_reminder", error: "syntax error" }] }), [],
    "a job over a function the database refused counts as a result");
  assert.deepEqual(appliedFacts({}), [], "an empty change claims something was applied");
  // A SWEEP SURVIVOR, CLOSED HERE RATHER THAN IN THE ROUTE, for the reason the
  // comment at the top of this case already gives: `checked: holds` on the
  // table branch survived a whole sweep, because the only route path that
  // applies a table wants a container and a compile. **NOTHING ON THIS PATH
  // EXERCISES BEHAVIOUR**, so every applied kind's `checked` is empty — which
  // is the property fix 1 rests on, and the one thing a mutant filling it in
  // would silently undo: with `checked` full, every configuration word becomes
  // a delivery again and the split is decorative.
  const everyKind = [
    ...appliedFacts({ spec, tables: ["bookings"] }),
    ...appliedFacts({ spec, tables: ["waitlist"] }),
    ...appliedFacts({ spec: { functions: [{ name: "f", internal: true, returns: "void" }] }, functions: ["f"] }),
    ...appliedFacts({ spec: { apis: [{ name: "w", url: "https://api.test/x", method: "GET" }] }, apis: ["w"] }),
    ...appliedFacts({ jobs }),
  ];
  assert.ok(everyKind.length >= 5, "the observer is not alive: " + everyKind.length);
  for (const e of everyKind) {
    assert.ok(Array.isArray(e.checked), e.name + " carries no `checked` list at all");
    assert.deepEqual(e.checked, [], e.name + " claims a behaviour was exercised — nothing here runs one");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FRONTEND KINDS' OWN VALIDATOR, AND THE DELIVERY READERS (2026-09-14)
// ─────────────────────────────────────────────────────────────────────────────

test("the frontend audit reads the tool's own item, so it cannot drift from what was offered", () => {
  // TWO LISTS OF ONE THING IS THIS REPOSITORY'S MOST-REPEATED DRIFT, so the
  // offered set is read off `addTool` rather than typed here — a property added
  // to the `page` item is audited the day it is added.
  const pageItem = frontendItem("page");
  const compItem = frontendItem("component");
  assert.ok(pageItem && compItem, "the frontend items are not readable off the tools");
  assert.deepEqual(Object.keys(pageItem.properties).sort(),
    ["components", "link", "name", "path", "purpose", "sections", "tsx"],
    "the page item's properties moved — re-anchor this and the audit together");
  assert.deepEqual(Object.keys(compItem.properties).sort(), ["components", "does", "page", "tsx", "where"]);
  // A KIND WITH NO FRONTEND ITEM ANSWERS NULL, never an empty shape: an audit
  // that ran over `{}` would report every declared property as unsupported.
  assert.equal(frontendItem("table"), null);
  assert.equal(frontendItem("nonsense"), null);
});

test("the frontend audit tells an unsupported property from a cut one from a clean declaration", () => {
  const ctx = { pages: ["/"], components: [], tsx: [] };
  const declared = [{ path: "/gallery", name: "Gallery", purpose: "the work", sections: ["a grid"], components: ["gallery"], seoTitle: "x", cacheForever: true }];
  const a = auditFrontend("page", declared, cleanAdd("page", declared, ctx).value);
  assert.equal(a.scanned, 1, "the observer was never alive — every list below is vacuously empty");
  assert.deepEqual(a.reached, ["cacheForever", "seoTitle"]);
  // A DECLARATION THE TOOL OFFERS AND THE CLEANER CUT is `changed`, never
  // `reached`: the property arrived, and it arrived as something else.
  const cd = [{ page: "/", does: "a band", components: ["testimonial"], where: "x".repeat(400) }];
  const c = auditFrontend("component", cd, cleanAdd("component", cd, ctx).value);
  assert.deepEqual(c.changed, ["where"]);
  assert.deepEqual(c.reached, []);
  // THE CONTROL: a declaration inside the tool that survives whole reports
  // nothing at all, which is what keeps this from crying wolf.
  const ok = [{ path: "/prices", name: "Prices", purpose: "p", sections: ["a list"], components: ["price-list"] }];
  assert.deepEqual(auditFrontend("page", ok, cleanAdd("page", ok, ctx).value),
    { scanned: 1, reached: [], changed: [], unexpressed: [] });
  // …AND THE THIRD READING, WHICH THE FIRST SWEEP FOUND UNGUARDED: an OFFERED
  // property declared truthy and kept EMPTY. `tsx: [{nope:1}]` is a part with
  // no name, so `parts()` bins it and the page arrives with `tsx: []` — the
  // model asked for something this step could not carry through, which is the
  // `unexpressed` sentence and not the unsupported one. Measured by hand
  // against the real cleaner rather than composed here.
  const cut = [{ path: "/tide", name: "Tide", purpose: "p", sections: ["a chart"], components: ["gallery"], tsx: [{ nope: 1 }] }];
  const u = auditFrontend("page", cut, cleanAdd("page", cut, ctx).value);
  assert.deepEqual(u.unexpressed, ["tsx"], "a declaration the cleaner emptied is not reported: " + JSON.stringify(u));
  assert.deepEqual(u.reached, [], "an offered property was reported as one the tool never had");
});

test("the frontend audit's offered set is the KIND'S OWN, and a list is never reported as changed", () => {
  // TWO SWEEP SURVIVORS, and they are one subject: what makes the audit
  // per-kind and what stops it crying wolf on every page there is.
  const ctx = { pages: ["/"], components: [], tsx: [] };
  // (1) THE SETS ARE NOT INTERCHANGEABLE. `where` is a COMPONENT property and
  // is not offered to a page — so a mutant collapsing the two items into one
  // union set reports a page declaring `where` as clean, where the real reader
  // says the tool never offered it. Driven both ways round, because the union
  // is only wrong in one direction and a one-sided case cannot see it.
  const p = [{ path: "/tide", name: "Tide", purpose: "p", sections: ["a chart"], where: "after the hero" }];
  assert.deepEqual(auditFrontend("page", p, cleanAdd("page", p, ctx).value).reached, ["where"],
    "a component's property was accepted as a page's");
  const c = [{ page: "/", does: "a band", components: ["testimonial"], where: "after the hero" }];
  assert.deepEqual(auditFrontend("component", c, cleanAdd("component", c, ctx).value).reached, [],
    "`where` is refused on the kind whose tool really offers it");
  // (2) A SHORTENED LIST IS NOT A CHANGED ONE. `MAX_SECTIONS` cuts a long list,
  // and without the scalar guard `String(["a","b","c"]) !== String(["a"])` reads
  // as a changed declaration — so a customer would be told the layout they
  // asked for was stored as something else, on every page that ran past the
  // cap. A shortened list is a refusal of the entries, which is a different
  // sentence; this is the recorded `params` finding, one tier over.
  const long = [{ path: "/long", name: "L", purpose: "p", sections: Array.from({ length: 40 }, (_, i) => "band " + i), components: ["gallery"] }];
  const kept = cleanAdd("page", long, ctx).value;
  assert.ok(kept[0].sections.length < 40, "the cap no longer cuts — this case cannot divide the two readings");
  assert.deepEqual(auditFrontend("page", long, kept).changed, [], "a list the cap shortened was reported as changed");
  // (3) `scanned` IS A REAL COUNT, not a flag. Every list this audit answers is
  // a NEGATIVE assertion and `[].every(...)` is true, so the floor on what was
  // scanned is the only thing that proves the observer was alive — and it has
  // to move with the number of items or it proves it for one of them.
  const two = [long[0], { path: "/short", name: "S", purpose: "p", sections: ["one"], components: ["faq"] }];
  assert.equal(auditFrontend("page", two, cleanAdd("page", two, ctx).value).scanned, 2,
    "the scan count does not follow the list, so a negative report cannot prove its own coverage");
});

test("the frontend audit refuses to pair two lists of different lengths", () => {
  // A CLEANER THAT REFUSES ONE ITEM SHIFTS EVERY INDEX BEHIND IT, and a page
  // has no name to pair on — so the audit answers `scanned: 0` rather than
  // reporting one declaration's properties against another's answer. The
  // recorded "pair by name, never by position" trap, met where there is no
  // name: the honest move is to say nothing.
  const two = [{ path: "/a", name: "A", purpose: "p", sections: ["x"], components: ["faq"], seoTitle: "t" }, { path: "/", name: "B", purpose: "p", sections: ["x"], components: ["faq"] }];
  const one = cleanAdd("page", two, { pages: ["/"], components: [], tsx: [] }).value;
  assert.equal(one.length, 1, "both items cleaned — this case no longer divides them");
  assert.deepEqual(auditFrontend("page", two, one), { scanned: 0, reached: [], changed: [], unexpressed: [] });
});

test("a requested page is missing only when nothing that survived carries its file", () => {
  const asked = [{ path: "/gallery", file: "gallery.tsx" }, { path: "/prices", file: "prices.tsx" }];
  // COMPARED BY FILE NAME, because the two sides really carry different
  // spellings of the same thing: the merge answers `gallery.tsx` on one path
  // and `src/routes/gallery.tsx` on another, and a route can be written two
  // ways. Both readings must give the same answer.
  assert.deepEqual(missingPages(asked, ["gallery.tsx"]), ["/prices"]);
  assert.deepEqual(missingPages(asked, ["src/routes/gallery.tsx"]), ["/prices"]);
  assert.deepEqual(missingPages(asked, ["gallery.tsx", "prices.tsx"]), []);
  assert.deepEqual(missingPages(asked, []), ["/gallery", "/prices"]);
  // ORDER IS THE REQUEST'S OWN, so a customer meets their pages in the order
  // they asked for them.
  assert.deepEqual(missingPages([...asked].reverse(), []), ["/prices", "/gallery"]);
  // NOTHING ASKED FOR IS NOTHING MISSING — the ordinary addon, which must not
  // grow a sentence.
  assert.deepEqual(missingPages([], ["index.tsx"]), []);
  assert.equal(missingPagesNote([]), "");
  assert.match(missingPagesNote(["/prices"]), /One page I set out to add isn't there — \/prices/);
  assert.match(missingPagesNote(["/a", "/b", "/c", "/d"]), /4 pages .* \/a, \/b, \/c and 1 more/);
});

test("configuration is recorded and never promoted, and only a checked behaviour is delivered", () => {
  // THE COMPLETION CORRECTION, at the module: `appliedFacts` produces
  // CONFIGURATION and nothing else, so a claim that matches one is recorded
  // and the requirement stays unverified. The producer says which list a fact
  // belongs in; nothing here reads the claim for behavioural-sounding words.
  const spec = { tables: [], functions: [{ name: "send_reminder", internal: false, returns: "void" }], apis: [], jobs: [] };
  const made = appliedFacts({ spec, functions: ["send_reminder"] });
  assert.deepEqual(made.map((m) => m.checked), [[]], "`appliedFacts` claims to have checked a behaviour");
  assert.ok(made[0].holds.includes("public"), "the configuration it really did read is not there");
  const ask = (by, m) => requirementOutcomes([{ need: "customers only see their own booking", status: "covered", from: "function", by }],
    { told: [], failed: [], made: m })[0];
  const cfg = ask("send_reminder is public and only sends to the person who booked", made);
  // RE-ANCHORED 2026-09-15, an expectation that MOVED rather than broke. The
  // state a matched configuration answers is now named `configured` rather than
  // folded into `unverified` — the owner's own distinction, "applied
  // implementation, behavior unchecked". **The property this case is about is
  // unchanged and is asserted twice**: it is not a delivery, and the customer
  // hears the same can't-confirm sentence either way, so nothing was promoted
  // by giving the record a word for it.
  assert.notEqual(cfg.state, "delivered", "a configuration word settled a behavioural requirement");
  assert.equal(cfg.state, "configured", "a claim resting on a real setting is not recorded as one");
  assert.equal(cfg.configuredBy, "send_reminder: public", "the configuration that was checked is not recorded");
  assert.match(
    requirementNote([{ need: "customers only see their own booking", status: "covered", from: "function", by: "send_reminder is public and only sends to the person who booked" }],
      { told: [], failed: [], made }),
    /can't confirm from here that customers only see their own booking/,
    "a configured claim stopped being said to the customer as unconfirmed");
  // AND THE DOOR IS REAL: a producer that really exercised a behaviour says so,
  // and that — and only that — answers delivered.
  // RE-ANCHORED 2026-09-16, and DERIVED rather than re-typed. The evidence
  // lookup is scoped by `{kind, name}` since the bypass fix, so this hand-typed
  // item — the door's only driver — was in no haystack and the door read shut.
  // It is built from the real producer's own answer now, with nothing but
  // `checked` filled in: a second hand-written copy of `appliedFacts`' shape is
  // exactly the drift that hid the gap, and the recorded rule is to derive a
  // fixture from its producer.
  const checked = made.map((m) => ({ ...m, holds: [], fails: [], checked: ["ownership"] }));
  assert.equal(checked[0].kind, "function", "the producer's own kind did not survive into the door's fixture");
  assert.equal(ask("send_reminder ownership was exercised", checked).state, "delivered");
});
