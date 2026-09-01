// The lane sweep harness — guarded, because the canary harness was not and its
// bug reached a paid run.
//
// ── THE TWO-LISTS RULE, POINTED AT A TEST HARNESS ─────────────────────────
//
// The sweep carries a case per lane. The lanes live in `site-lanes.mjs`. Two
// lists of the same thing drift silently, and here the drift has a shape: a
// lane added to the product with no case is a lane the sweep silently skips
// and reports as "all lanes passed"; a case for a lane the product no longer
// has spends a credit asking for something that cannot be named. Both
// directions are asserted, derived from the real `LANE_FIELDS`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CASES, chooseLanes, confirmed } from "../scripts/lane-sweep.mjs";
import { LANE_FIELDS, OWN_LANES, DISPATCHED_LANES, VERB_LANES, ESCALATE_LANES } from "../builder/site-lanes.mjs";

test("importing the harness runs nothing", () => {
  // The guard at the bottom of the script keys on argv[1]. This test IS the
  // proof: it imported the module and got here without signing in or spending.
  assert.ok(Array.isArray(CASES) && CASES.length > 0);
});

test("every lane has a case and every case names a lane", () => {
  const cases = CASES.map((c) => c.lane);
  for (const f of LANE_FIELDS) assert.ok(cases.includes(f), "`" + f + "` is a lane the sweep never exercises");
  for (const c of cases) assert.ok(LANE_FIELDS.includes(c), "`" + c + "` is a case for a lane the product does not have");
  assert.equal(new Set(cases).size, cases.length, "a lane has two cases — which one is the verdict?");
  // THE OBSERVER IS ALIVE: the loops above pass vacuously over an empty list.
  assert.ok(LANE_FIELDS.length >= 20, `only ${LANE_FIELDS.length} lanes — this test may be scanning almost nothing`);
});

test("every case can be judged, and judges the site rather than the reply", () => {
  for (const c of CASES) {
    assert.equal(typeof c.ask, "string", "`" + c.lane + "` has no ask");
    assert.ok(c.ask.trim().length > 10, "`" + c.lane + "` has an ask too short to route");
    assert.equal(typeof c.check, "function", "`" + c.lane + "` has no check");
    // Driven with a before and an after that differ in nothing: a check that
    // passes here is a check that would pass on a site that did not change,
    // which is the exact lie the sweep exists to catch. Three stated
    // exceptions: `behavior` renders nothing yet, so its evidence is the
    // reply's `moved`; the held lanes are not judged by this harness; and a
    // lane whose CORRECT answer on this site is a refusal (`mayEscalate`) has
    // "the build did not move" as its pass — the first draft of this guard
    // flagged `backend` for exactly that, which was the guard being wrong.
    if (c.held || c.lane === "behavior" || Array.isArray(c.mayEscalate)) continue;
    const same = { build: "b1", html: "<html lang=\"en\"><title>T</title></html>", lang: "en", dir: "ltr", title: "T", ogTitle: "T",
      description: "d", locales: ["en"], root: ":root{--a:1}", sheetLen: 10, headerHtml: "<header>T</header>", headerText: "T",
      headerLink: "<a data-slot=\"site-link\">Go</a>", heroAlt: "x", slots: ["steps", "price-list"], canvas: false, icon: "<svg/>", qr: "", routes: ["/"] };
    const v = c.check(same, { ...same }, { ok: true, moved: [] });
    assert.equal(v.ok, false, "`" + c.lane + "` passes against a site that did not change");
    assert.equal(typeof v.note, "string", "`" + c.lane + "` gives no note");
  }
});

test("the honest-refusal lanes are only the ones this site cannot serve", () => {
  // `backend` needs a database and the sweep's site has none, so an escalate
  // is the CORRECT answer there. Anything else claiming the same licence would
  // let a broken lane pass as a principled one.
  const may = CASES.filter((c) => Array.isArray(c.mayEscalate)).map((c) => c.lane);
  assert.deepEqual(may, ["backend"], "a lane other than backend is allowed to pass by escalating: " + JSON.stringify(may));
});

test("slug and kind never run under `all`", () => {
  const all = chooseLanes("all", CASES);
  assert.ok(!all.includes("slug"), "`all` would rename the site");
  assert.ok(!all.includes("kind"), "`all` would rebuild the site");
  // AND THEY DO RUN WHEN NAMED — held is not disabled.
  assert.deepEqual(chooseLanes("slug,kind", CASES), ["slug", "kind"]);
  // `all` covers everything else, derived rather than counted by hand.
  const expected = LANE_FIELDS.filter((f) => f !== "slug" && f !== "kind");
  assert.deepEqual([...all].sort(), [...expected].sort());
  // A name the product does not have is dropped, not guessed at.
  assert.deepEqual(chooseLanes("css,nonsense,theme", CASES), ["css", "theme"]);
  assert.deepEqual(chooseLanes("", CASES), all, "an empty selection is `all`, which is the documented default");
});

test("the held lanes say why, and the partition still covers them", () => {
  for (const c of CASES.filter((x) => x.held)) {
    assert.ok(typeof c.held === "string" && c.held.length > 20, "`" + c.lane + "` is held with no reason");
    const inGroup = [OWN_LANES, DISPATCHED_LANES, VERB_LANES, ESCALATE_LANES].some((g) => g.includes(c.lane));
    assert.ok(inGroup, "`" + c.lane + "` is held but is not a real lane any more");
  }
});

test("the confirm word is read as a word, not as bytes", () => {
  // THE FIRST DISPATCH DIED ON THIS. The workflow's text box came through as
  // `spend ` with a trailing space and the raw comparison refused it — eleven
  // seconds, nothing spent, nothing learned. A gate that exists to prove a
  // person meant it must not refuse the person who meant it and typed a space.
  for (const yes of ["spend", "spend ", " spend", "SPEND", " Spend\n"]) {
    assert.equal(confirmed(yes), true, JSON.stringify(yes) + " should open the gate");
  }
  // AND STILL A GATE: any other word, nothing, and anything that is not a
  // string — `String(["spend"])` is "spend", the coercion this repo has shipped
  // as a bug four times.
  for (const no of ["", "yes", "spent", "spend now", "s p e n d", null, undefined, true, 1, ["spend"]]) {
    assert.equal(confirmed(no), false, JSON.stringify(no) + " should not open the gate");
  }
});

test("the harness refuses without the confirm word, and the workflow has no free trigger", () => {
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  // CONSULTED BEFORE ANYTHING THAT COSTS OR SIGNS IN. Both landmarks proved, so
  // a deleted gate cannot pass this as -1 < n.
  const gate = src.indexOf("if (!confirmed(process.env.SWEEP_CONFIRM))");
  const signIn = src.indexOf("generate_link");
  assert.ok(gate > 0, "the harness no longer consults the confirm word");
  assert.ok(signIn > 0, "the sign-in landmark moved");
  assert.ok(gate < signIn, "the confirm word is checked after signing in, so a refused run still mints a session");
  const wf = readFileSync(new URL("../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");
  assert.doesNotMatch(wf, /^\s*push:/m, "the sweep can run on a push — the expensive thing would be the default");
  assert.doesNotMatch(wf, /^\s*schedule:/m, "the sweep can run on a schedule");
  assert.match(wf, /workflow_dispatch:/, "the sweep cannot be dispatched by hand");
  assert.match(wf, /SWEEP_CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/, "the confirm input never reaches the harness");
  // BUDGETED. A sweep that could not stop itself would be bounded only by the
  // owner's balance.
  assert.match(src, /spent > BUDGET/, "the budget is never checked between lanes");
});

test("a claimed success with an unmoved build is a lie, and an escalate that moved it is too", () => {
  // The two halves of "judge the site, not the reply", read off the verdict
  // logic. Property, not spelling: each is the presence of the check.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  assert.match(src, /reply says ok but the build did not move/, "a success that published nothing is not called a lie");
  assert.match(src, /AND THE BUILD MOVED, which an escalate must never do/, "an escalate that published is not called a lie");
  assert.match(src, /verdict === "LIE" \|\| verdict === "NEEDS REVIEW" \|\| verdict === "NO ANSWER"\) \{ console\.log\(`STOPPING/,
    "the sweep does not stop on a lie");
});
