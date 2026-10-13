// TASK ISOLATION, WHICHEVER PART RUNS FIRST (2026-10-12, after run 141).
// `isolationVerdict` judges an edit part's APPEND on the page an Add-on part
// writes: the phrase must be on the served page once, straight after the words
// it was asked to follow, and the edit part's own job must have applied it
// (its final answer, as polled). A request not split into those two parts is
// not exercised — never a pass, never a breach. The evidence here is shaped as
// run 141's saved press evidence is (`docs/history/evidence/2026-10-12-run141/`):
// the request's final view with each part's run jobs, and the job polls.
import test from "node:test";
import assert from "node:assert/strict";
import { isolationVerdict, requestBatchVerdict } from "../scripts/canary-requests.mjs";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";

const SC = UI_SCENARIOS["acc-isolation-page"];
const WANT = SC.expect.isolation;
const HEAD = "Join the weekly bake list";
const page = (heading) => `<main><section><h2 class="[&>svg]:x">${heading}</h2><p>A short note each week.</p></section>`
  + `<section><h3><button aria-expanded="true">Can I leave the list?</button></h3><div><p>Yes, reply STOP to any note.</p></div></section></main>`;
const poll = (job, ms, res) => ({ ms, method: "GET", path: "/api/site/edit/" + job, status: 200, final: true, res });
function steps({ routes = ["text", "addon"], editRes = { ok: true, applied: 1, changed: [HEAD + " — sent every Friday"] }, editMs = 100, addMs = 200, polls = true } = {}) {
  const parts = routes.map((route, n) => ({ n, route, runs: [{ job: "J" + n }] }));
  const network = polls ? [poll("J0", editMs, editRes), ...(routes.length > 1 ? [poll("J1", addMs, { ok: true, kinds: ["component"] })] : [])] : [];
  return [{ sent: true, request: { key: "rq1", final: { parts } }, network }];
}
const served = (heading) => ({ "/bake-list": page(heading) });
const failed = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);

test("ISO 1 — EDIT FIRST: the edit part applied the append, the page carries it once, straight after the heading: passes; the order is recorded", () => {
  const v = isolationVerdict(steps(), served(HEAD + " — sent every Friday"), WANT);
  assert.equal(v.exercised, true);
  assert.deepEqual(failed(v), []);
  assert.equal(v.ok, true);
  assert.equal(v.order, "text first");
});

test("ISO 2 — ADD-ON FIRST: the same final state passes in the other order (the verdict does not depend on it), and the order says so; another dash passes", () => {
  const v = isolationVerdict(steps({ editMs: 300, addMs: 100 }), served(HEAD + " – sent every Friday"), WANT);
  assert.equal(v.ok, true, v.why);
  assert.equal(v.order, "addon first");
});

test("ISO 3 — A STRAY APPLICATION AFTER THE EDIT: the phrase is on the page twice — fails, named as made twice", () => {
  const v = isolationVerdict(steps(), served(HEAD + " — sent every Friday — sent every Friday"), WANT);
  assert.equal(v.exercised, true);
  assert.equal(v.ok, false);
  assert.match(v.why, /2 time\(s\)/);
});

test("ISO 4 — A STRAY APPLICATION BEFORE THE EDIT: the page is right, but the edit part's job applied nothing (it found its change made) — fails; and a job that changed something else fails too", () => {
  for (const editRes of [{ ok: true, applied: 0, changed: [] }, { ok: true, applied: 1, changed: ["Join the bake list"] }, { ok: true, applied: 0, changed: [HEAD + " — sent every Friday"] }]) {
    const v = isolationVerdict(steps({ editRes }), served(HEAD + " — sent every Friday"), WANT);
    assert.equal(v.ok, false, JSON.stringify(editRes));
    assert.match(v.why, /own job applied the change/);
  }
});

test("ISO 5 — NOT EXERCISED: one Add-on part, or two Add-on parts, or no text part, is recorded as not exercised with the routes — never ok", () => {
  for (const routes of [["addon"], ["addon", "addon"], ["look", "addon"]]) {
    const v = isolationVerdict(steps({ routes }), served(HEAD + " — sent every Friday"), WANT);
    assert.equal(v.exercised, false, JSON.stringify(routes));
    assert.equal(v.ok, false);
    assert.match(v.why, /^not exercised: the router made/);
  }
});

test("ISO 6 — MISSING EVIDENCE IS NEVER A PASS: no final poll of the edit part's job, no served page, or the phrase not after the heading", () => {
  assert.match(isolationVerdict(steps({ polls: false }), served(HEAD + " — sent every Friday"), WANT).why, /missing evidence/);
  assert.equal(isolationVerdict(steps(), {}, WANT).ok, false);
  const moved = isolationVerdict(steps(), { "/bake-list": page(HEAD) + "<main><p>Notes are sent every Friday.</p></main>" }, WANT);
  assert.equal(moved.ok, false);
  assert.match(moved.why, /straight after/);
  const near = isolationVerdict(steps(), served(HEAD + " today, sent every Friday"), WANT);
  assert.equal(near.ok, false, "words between the heading and the phrase passed as straight after");
  assert.match(near.why, /straight after/);
});

test("ISO 7 — WIRED INTO THE PRESS'S VERDICT: acc-isolation-page judges isolation; a split it cannot judge is a failed, named check and an unverified line, never a pass", () => {
  const base = { spec: SC, before: {}, after: {}, served: served(HEAD + " — sent every Friday"), beforeServed: {}, tables: null, slug: "fold-lane-bakery" };
  const good = requestBatchVerdict({ ...base, steps: steps() });
  assert.ok(good.isolation && good.isolation.ok, JSON.stringify(good.isolation));
  assert.ok(good.checks.some((c) => c.name.startsWith("isolation: ") && c.ok));
  const batched = requestBatchVerdict({ ...base, steps: steps({ routes: ["addon"] }) });
  assert.equal(batched.ok, false);
  assert.ok(batched.checks.some((c) => c.name === "isolation: the request was split into the edit part and the Add-on part it needs" && !c.ok));
  assert.ok(batched.unverified.some((u) => /^task isolation: not exercised/.test(u)), JSON.stringify(batched.unverified));
});

test("ISO 8 — THE SCENARIO: prepared after run 141, image-free, on the Bake List; the heading's from/to and the phrase agree; no overlap or reuse asked (shared page); not in the balance opt-in", async () => {
  const { BALANCE_OPT_IN } = await import("../scripts/canary-ui.mjs");
  assert.equal(SC.images, "none");
  assert.equal(SC.site, "fold-lane-bakery");
  const h = SC.expect.headings[0];
  assert.equal(h.route, WANT.route);
  assert.ok(h.to.startsWith(WANT.after) && h.to.toLowerCase().endsWith(WANT.phrase.toLowerCase()));
  assert.ok(SC.steps[0].say.includes(WANT.phrase) && SC.steps[0].say.includes(WANT.after));
  assert.ok(!/friday/i.test(SC.expect.sections[0].facts.map((f) => f.any.join(" ")).join(" ")), "the section must not name the edit's day");
  assert.equal(SC.expect.overlap, undefined);
  assert.equal(SC.expect.reuse, undefined);
  assert.ok(!BALANCE_OPT_IN.includes("acc-isolation-page"));
});
