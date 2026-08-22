// The designer eval's judgement, driven without a model call.
//
// WHY THIS EXISTS. The harness itself cannot be run while the model account is
// empty, and a harness nobody has exercised is the thing this repo keeps
// recording: `message-scroller` compiled, bundled and hard-crashed the page;
// three separate screenshot harnesses reported clean runs on error pages. A
// check that cannot see the failure it was written for reports a clean run on a
// broken schema and is strictly worse than not measuring.
//
// So every check is driven here against fabricated answers — the ones it must
// catch AND the ones it must not — at zero cost. This is the only part of the
// designer eval that can be verified today.
import test from "node:test";
import assert from "node:assert/strict";
import { CHECKS, SCENARIOS, ALWAYS, emptyReason, styleReport, styleLine } from "./integration/schema-checks.mjs";
import { ASKABLE } from "../builder/site-style.mjs";
import { normalizeSchema } from "../site-schema.mjs";

/** An answer, scored the way the harness scores one: through the normaliser. */
const score = (name, answer) => CHECKS[name](answer, normalizeSchema(answer));
const col = (...n) => n.map((name) => ({ name, type: "text" }));

test("seeded — catches the failure it was written for", () => {
  const menu = {
    tables: [{ name: "dishes", access: "display", columns: col("name", "price") }],
    seed: { dishes: [{ name: "Soup", price: "6" }, { name: "Pie", price: "9" }] },
  };
  assert.equal(score("seeded", menu).ok, true, "a properly seeded menu must pass");

  // THE MEASURED FAILURE, twice this week. All three shapes are silent: the key
  // absent, an empty object, and an empty array. Only the first is even a
  // schema violation, because `required` means the key is PRESENT — `seed: {}`
  // satisfies the tool perfectly.
  for (const bad of [undefined, {}, { dishes: [] }]) {
    const r = score("seeded", { ...menu, seed: bad });
    assert.equal(r.ok, false, "an unseeded display table passed with seed = " + JSON.stringify(bad));
    assert.match(r.why, /dishes/, "the failure does not name the table");
  }
});

test("seeded — the report names WHICH silent shape it was", () => {
  // "unseeded: a,b" is true of five different answers that need different
  // fixes, and the report could not tell them apart. Measured 2026-08-15: the
  // café brief failed on 3 of 5 samples, every failure had TWO display tables
  // and seeded NEITHER, and whether that is a prompt problem or a key mismatch
  // could not be established from the report at any price.
  //
  // The rule this enforces is the one the harness already applies to
  // `whyNoTables` one function up: a failure that cannot name itself sends the
  // next reader looking in the wrong file.
  const two = {
    tables: [
      { name: "dishes", access: "display", columns: col("name", "price") },
      { name: "opening_hours", access: "display", columns: col("day", "hours") },
    ],
  };
  const shapes = [
    [undefined, /no `seed` key at all/],
    [null, /`seed` was null/],
    [[], /came back as a LIST/],
    ["dishes", /came back as string/],
    [{}, /`seed: \{\}`/],
    [{ dishes: [{ name: "Soup" }] }, /opening_hours=missing/],
    [{ dishes: [], opening_hours: [] }, /dishes=\[\] empty/],
  ];
  for (const [seed, want] of shapes) {
    const r = score("seeded", { ...two, seed });
    assert.equal(r.ok, false, "shape passed that should not: " + JSON.stringify(seed));
    assert.match(r.why, want, "the report cannot name the shape " + JSON.stringify(seed));
  }

  // THE SHAPE THE TOOL DESCRIPTION DOES NOT NAME, and the one that would change
  // the diagnosis completely: rows really were written, under keys that are not
  // table names. Indistinguishable from "did not answer" before this, and a
  // completely different bug — so the keys it DID use are printed.
  const wrongKeys = score("seeded", { ...two, seed: { menu: [{ name: "Soup" }], hours: [{ day: "Mon" }] } });
  assert.equal(wrongKeys.ok, false);
  assert.match(wrongKeys.why, /seed keys present: menu,hours/,
    "a seed full of rows under the wrong keys reads as an empty answer");
});

test("seeded — skips rather than failing when there is nothing to seed", () => {
  // A site with no display table cannot fail this, and reporting it as a failure
  // would make every contact-form-only brief look broken. `null` is the harness's
  // n/a, distinct from false.
  const r = score("seeded", { tables: [{ name: "enquiries", access: "collect", columns: col("name") }] });
  assert.equal(r.ok, null, "a site with no display table should be n/a, not a failure");
});

test("slotGuarded — a booking table with nothing holding the slot", () => {
  const base = { tables: [{ name: "bookings", access: "collect", columns: col("name", "slot_date", "slot_time") }] };
  assert.equal(score("slotGuarded", base).ok, false, "the double-booking shape passed");
  const guarded = { tables: [{ ...base.tables[0], unique: [{ columns: ["slot_date", "slot_time"] }] }] };
  assert.equal(score("slotGuarded", guarded).ok, true, "a real slot constraint must pass");
});

test("browsable — the marketplace failure", () => {
  // Measured live 2026-08-10: every table private per member, so not one
  // visitor could see a single event and the site published as the placeholder.
  const priv = { tables: [{ name: "events", access: "user", columns: col("title") }] };
  assert.equal(score("browsable", priv).ok, false, "a site nobody signed-out can read passed");

  assert.equal(score("browsable", { tables: [{ name: "events", access: "display", columns: col("title") }] }).ok,
    true, "a public table must pass");
  // publicView is the OTHER honest route to a page a stranger can open, and
  // missing it would fail a correctly-built booking site.
  assert.equal(score("browsable", {
    tables: [{ name: "bookings", access: "collect", columns: col("slot"), publicView: { columns: ["slot"] } }],
  }).ok, true, "a publicView is a browsable surface and was not counted");
});

test("capacityFn — accepts only the pattern that actually works", () => {
  const table = (write) => ({ name: "bookings", read: "none", write, columns: col("name", "class", "slot") });
  const fn = (body) => ({ name: "book_place", args: [{ name: "n", type: "text" }], returns: "json", body });

  // The whole pattern: writes closed, and a function that takes the lock.
  assert.equal(score("capacityFn", {
    tables: [table("none")],
    functions: [fn("PERFORM pg_advisory_xact_lock(hashtext(slot)); INSERT INTO bookings ...")],
  }).ok, true, "the correct capacity pattern was rejected");

  // NO LOCK is the failure that matters. A bare count-then-insert lets two
  // people both see the last place and both take it — the exact double booking
  // this pattern exists to prevent. Accepting it would report a clean run on a
  // schema that races on precisely the class that fills up.
  const noLock = score("capacityFn", {
    tables: [table("none")],
    functions: [fn("IF (SELECT count(*) FROM bookings) < 12 THEN INSERT INTO bookings ...")],
  });
  assert.equal(noLock.ok, false, "a capacity function with no lock was accepted");
  assert.match(noLock.why, /lock|race/i, "the reason does not name the lock");

  // A locking function beside a table anyone can still insert into is walked
  // around by a direct POST, so the check is worthless without this half.
  const open = score("capacityFn", {
    tables: [table("anyone")],
    functions: [fn("PERFORM pg_advisory_xact_lock(hashtext(slot)); INSERT INTO bookings ...")],
  });
  assert.equal(open.ok, false, "a locking function beside an open table was accepted");

  assert.equal(score("capacityFn", { tables: [table("none")], functions: [] }).ok, false,
    "a closed table with no function cannot be booked at all and must not pass");
});

test("validPlan — a plan the page generator can actually be handed", () => {
  // WAS `validFamily`, which asked whether the designer had named one of a fixed
  // 100 trades. It answers a PLAN now, and the equivalent structural question is
  // whether `normalizePlan` keeps it — because a plan it drops means
  // `directiveFromPlan` returns null and the generator gets the bare brief with
  // no page list, no shape and no component manifest, silently.
  const good = { tables: [], purpose: "A barber shop taking bookings",
                 shape: ["the chair, then the time"],
                 pages: [{ path: "/", role: "the shop and its chairs" }, { path: "/book", role: "pick a slot" }],
                 action: ["Book a chair"], components: ["site-chrome", "booking-form"] };
  assert.equal(score("validPlan", good).ok, true);

  // Each refusal separately, or one shared cause could be satisfying all three.
  assert.equal(score("validPlan", { ...good, purpose: "  " }).ok, false, "a plan with no purpose passed");
  assert.equal(score("validPlan", { ...good, pages: [{ path: "NOT A PATH", role: "x" }] }).ok, false,
    "a plan with no usable page passed");
  assert.equal(score("validPlan", { ...good, components: [] }).ok, false, "a plan naming no components passed");
  assert.equal(score("validPlan", { tables: [] }).ok, false, "an answer with no plan at all passed");

  // The REASON discriminates, or the report says "no purpose" about a plan whose
  // purpose is fine — which is the whole failure `emptyReason` exists to prevent
  // one function up.
  assert.match(score("validPlan", { ...good, purpose: "" }).why, /purpose/);
  assert.match(score("validPlan", { ...good, pages: [] }).why, /page/);
  assert.match(score("validPlan", { ...good, components: [] }).why, /component/);
});

test("tablesSurvive — catches a table the normaliser silently drops", () => {
  assert.equal(score("tablesSurvive", { tables: [{ name: "a", access: "display", columns: col("x") }] }).ok, true);
  assert.equal(score("tablesSurvive", { tables: [] }).ok, false, "an answer with no tables passed");
});

test("every check answers rather than throwing, on junk", () => {
  // This runs against model output. An answer that throws takes the whole
  // sample down and reports as an infrastructure error rather than a bad schema.
  for (const [name, fn] of Object.entries(CHECKS))
    for (const junk of [{}, { tables: null }, { tables: [null] }, { tables: [], functions: "x" }])
      assert.doesNotThrow(() => fn(junk, normalizeSchema(junk)), name + " threw on " + JSON.stringify(junk));
});

test("every scenario names checks that exist, and every check is reachable", () => {
  // Derived both ways. A scenario naming a check that does not exist is a
  // TypeError mid-run; a check nothing names is dead weight that reads as
  // coverage — the shape this repo has recorded six times.
  const named = new Set([...SCENARIOS.flatMap((s) => s.expect), ...ALWAYS]);
  for (const s of SCENARIOS)
    for (const e of s.expect)
      assert.ok(CHECKS[e], "scenario `" + s.key + "` expects `" + e + "`, which is not a check");
  for (const k of Object.keys(CHECKS))
    assert.ok(named.has(k), "check `" + k + "` is run by no scenario — it would never fire");
  assert.ok(SCENARIOS.length >= 3, "too few scenarios to tell a mismatch from variance");
});

test("the scenarios cover the failures that have actually shipped", () => {
  // Anchored on the property, not the wording: each of the three live failures
  // must have a scenario whose expectations include the check for it. Dropping
  // one would leave the eval green while the failure it was built for returns.
  const has = (check) => SCENARIOS.some((s) => s.expect.includes(check));
  assert.ok(has("seeded"), "no scenario checks seeding — the failure measured twice this week");
  assert.ok(has("slotGuarded"), "no scenario checks the slot — two customers took the same 14:00");
  assert.ok(has("browsable"), "no scenario checks a browsable table — the marketplace shipped as a placeholder");
  assert.ok(has("capacityFn"), "no scenario checks capacity — the change made 2026-08-12 would go unmeasured");
});

// ─────────────────────────────────────────────────────────────────────────────
// WHY an answer was empty. Added 2026-08-13 after a real failure could not be
// diagnosed: the yoga sample reported "no tables" and that one sentence covered
// four different causes with four different fixes.

test("every way an answer can be empty gets its OWN sentence", () => {
  const out = 1411;
  const said = [
    emptyReason(null, false, "end_turn", out),                   // never called
    emptyReason({}, true, "tool_use", out),                      // no tables key
    emptyReason({ tables: [] }, true, "tool_use", out),          // deliberate none
    emptyReason({ tables: "nope" }, true, "tool_use", out),      // wrong type
    emptyReason({}, true, "max_tokens", out),                    // cut off
  ];
  for (const s of said) assert.ok(s, "an empty answer must always say something");
  assert.equal(new Set(said).size, said.length,
    "two different causes share a sentence — which is the bug this replaces:\n" + said.join("\n"));
});

test("a truncated reply is named as OURS, ahead of the symptoms it causes", () => {
  // A cut-off reply is ALSO missing its tool call and its `tables` key, so the
  // order decides whether the report names the cause or a symptom. Getting this
  // backwards sends somebody hunting the model for a budget bug of ours.
  const cut = emptyReason(null, false, "max_tokens", 8000);
  assert.match(cut, /CUT OFF at max_tokens/, "truncation must be reported ahead of the missing tool call");
  assert.doesNotMatch(cut, /never called the tool/, "it named the symptom instead of the cause");
});

test("the output-token count is on every sentence", () => {
  // The one number that separates "the model said almost nothing" from "it
  // wrote a whole schema and we dropped it". Asserted on each branch, because
  // it is exactly the branch somebody adds later that forgets it.
  for (const [input, called, stop] of [
    [null, false, "end_turn"], [{}, true, "tool_use"], [{ tables: [] }, true, "tool_use"],
    [{ tables: 3 }, true, "tool_use"], [null, false, "max_tokens"],
  ]) {
    const s = emptyReason(input, called, stop, 42);
    assert.match(s, /out=42 tok/, "no token count on: " + s);
    assert.match(s, /stop=/, "no stop reason on: " + s);
  }
});

test("an answer that really has tables says NOTHING", () => {
  // Or every clean run grows a diagnosis line about a failure that did not
  // happen — the `salvage: { reason: … }` mistake, which reads in a report as a
  // build that nearly broke.
  assert.equal(emptyReason({ tables: [{ name: "classes" }] }, true, "tool_use", 900), "");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE STYLE HALF. Nothing measured it until 2026-08-22 — the eval judged
// tables, seeds, access and the plan, and had no opinion about the other thing
// every `design_schema` call answers.

test("styleClean — an answer the engine threw away is a failure", () => {
  // Each of these is a slot spent producing nothing, on a site that then
  // renders the default while the customer is told the axis was refused.
  const bad = CHECKS.styleClean({ style: { corner: "round", nonsense: "x" } });
  assert.equal(bad.ok, false, "an axis the engine does not know must be reported");
  assert.match(bad.why, /nonsense/);

  const opt = CHECKS.styleClean({ style: { icon: "purple" } });
  assert.equal(opt.ok, false, "an option outside its own enum must be reported");
  assert.match(opt.why, /icon/);

  // `String(["pill"])` is `"pill"` — the coercion this repo has shipped as a
  // real bug three times. A one-element array must not read as a named option.
  const arr = CHECKS.styleClean({ style: { buttons: ["pill"] } });
  assert.equal(arr.ok, false, "a non-string must not set an axis");
});

test("styleClean — a REFUSED authored value names its reason", () => {
  // "dropped: backdrop" is true of a misspelt enum option AND of a gradient
  // carrying a url(), and those want opposite fixes: one is a prompt problem,
  // the other is the authored hint not naming its own refusals.
  const r = CHECKS.styleClean({ style: { backdropCss: { light: ["url(https://x/y.png)"], dark: ["#000"] } } });
  assert.equal(r.ok, false);
  assert.match(r.why, /REFUSED/, "a refusal must be named apart from an unknown option");
  assert.match(r.why, /url\(\)/, "the reason must travel, or the report cannot say which fix");
  // ONE fault, not two. `dropped` and `refused` both carry the axis name after
  // the `backdropCss` fold, so a single refusal reported twice reads as two.
  assert.equal((r.why.match(/backdrop/g) || []).length, 1, "the same refusal was counted twice");
});

test("styleClean — setting FEW axes is not a failure", () => {
  // How much of a look to author is the designer's call. This file's own rule
  // is that a check is a property and never a judgement — `styleLine` carries
  // the count so the series accumulates, and only the count is not a verdict.
  assert.equal(CHECKS.styleClean({ style: { corner: "round" } }).ok, true, "one clean axis must pass");
  const none = CHECKS.styleClean({ style: {} });
  assert.equal(none.ok, null, "naming no axis must SKIP, not fail");
  assert.equal(CHECKS.styleClean({}).ok, null, "no style block at all must skip");
});

test("styleClean — an authored value that only the CONTAINER can judge is deferred", () => {
  // With no palette a layer naming `var(--accent)` fails for a reason about US
  // and not about the value: `normalizeSeeds` runs in the container, so the
  // Worker holds three hex seeds and none of the 31 derived tokens. Reported as
  // refused, the eval would tell us the model wrote a bad backdrop on every
  // sample that names a theme colour — the false alarm this repo rates worse
  // than the miss.
  const r = CHECKS.styleClean({ style: { backdropCss: { light: ["radial-gradient(40rem at 24% 28%, var(--primary), transparent 65%)"], dark: ["#000"] } } });
  assert.notEqual(r.ok, false, "a deferred value must not be reported as refused: " + r.why);
});

test("styleReport — counts what SURVIVES, not what was named", () => {
  const s = styleReport({ style: { corner: "round", icon: "fine", nonsense: "x" } });
  assert.equal(s.asked, 3, "asked counts the raw keys");
  assert.deepEqual(s.kept.sort(), ["corner", "icon"]);
  assert.deepEqual(s.dropped, ["nonsense"]);
  assert.equal(s.total, ASKABLE.length, "the denominator is the engine's own list, never a number here");
});

test("styleReport — an authored axis is counted apart from a named one", () => {
  // The distinction the whole 2026-08-22 change exists for: `backdrop: "wash"`
  // and a hand-written gradient are both one axis and are not the same answer,
  // and a report that merges them cannot say whether option (b) is ever used.
  const named = styleReport({ style: { backdrop: "wash" } });
  assert.deepEqual(named.kept, ["backdrop"]);
  assert.deepEqual(named.authored, []);

  const own = styleReport({ style: { backdropCss: { light: ["#f0a"], dark: ["#204"] } } });
  assert.deepEqual(own.kept, [], "an authored value must NOT land in the enum map");
  assert.deepEqual(own.authored, ["backdrop"], "and must be reported under the axis, not the wire name");
});

test("styleLine — says how much of the look was set, and flags authored CSS", () => {
  assert.match(styleLine({ style: {} }), /none of \d+/);
  const l = styleLine({ style: { corner: "round", backdropCss: { light: ["#f0a"], dark: ["#204"] } } });
  assert.match(l, /2\/\d+/, "the count is what makes a series out of one build");
  assert.match(l, /authored: backdrop/, "option \\(b\\) being used at all has to be visible");
  assert.match(l, /corner/, "and the axes themselves, or a run cannot be compared to the next");
});

test("styleClean is in ALWAYS — the style block is answered on every scenario", () => {
  // Not per-scenario: every `design_schema` call answers it, so a refusal on
  // the café brief is the same fault as one on the marketplace brief.
  assert.ok(ALWAYS.includes("styleClean"));
});

test("every check still answers rather than throwing, with the style ones", () => {
  // The report is driven from model output, so it meets every shape the wire
  // can carry. A throw here reports as an infrastructure error and hides a
  // thin answer behind it.
  for (const junk of [null, undefined, {}, { style: null }, { style: [] }, { style: "round" },
                      { style: { backdropCss: null } }, { style: { backdropCss: "x" } },
                      { style: { corner: null } }]) {
    assert.doesNotThrow(() => CHECKS.styleClean(junk), "styleClean threw on " + JSON.stringify(junk));
    assert.doesNotThrow(() => styleLine(junk), "styleLine threw on " + JSON.stringify(junk));
  }
});
