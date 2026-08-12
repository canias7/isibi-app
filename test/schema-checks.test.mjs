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
import { CHECKS, SCENARIOS, ALWAYS } from "./integration/schema-checks.mjs";
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

test("validFamily — only a family that really exists", () => {
  assert.equal(score("validFamily", { tables: [], family: "salon" }).ok, true);
  assert.equal(score("validFamily", { tables: [], family: "barbershop" }).ok, false, "an invented family passed");
  assert.equal(score("validFamily", { tables: [] }).ok, false, "a missing family passed");
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
