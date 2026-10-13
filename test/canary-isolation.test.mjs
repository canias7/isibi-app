// TASK ISOLATION, FROM WHAT EACH JOB WAS SHOWN AND WHAT EACH JOB CHANGED
// (2026-10-12, after run 141; corrected 2026-10-13 after the owner's review).
// Duplicate detection alone proves nothing — a model shown an
// already-appended phrase may leave it alone — so `isolationVerdict` reads:
//   * every model call's marks (both jobs, and a preparation): the other
//     part's words only marked, the rule present, nothing unmarked;
//   * the page as served at each job's own version (`between`), so each job's
//     own change is the difference between consecutive versions;
//   * the edit job's own answer and the final page.
// And it says what that proves by the order: Add-on first discriminates; edit
// first is consistent only, never counted as proof. Evidence shaped as the
// press saves it.
import test from "node:test";
import assert from "node:assert/strict";
import { isolationVerdict, requestBatchVerdict } from "../scripts/canary-requests.mjs";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";

const SC = UI_SCENARIOS["acc-isolation-page"];
const WANT = SC.expect.isolation;
const HEAD = "Join the weekly bake list";
const WITH = HEAD + " — sent every Friday";
const FAQ = `<section><h3><button aria-expanded="true">Can I leave the list?</button></h3><div><p>Yes, reply STOP to any note.</p></div></section>`;
const page = (heading, faq = false) => `<main><section><h2 class="[&>svg]:x">${heading}</h2><p>A short note each week.</p></section>${faq ? FAQ : ""}</main>`;
const clean = (what, replayed = false) => ({ what, others: 1, rule: true, unmarked: 0, done: 0, replayed });
const MARKS = { text: [clean("write_text_edits")], addon: [clean("pick_adds"), clean("add_to_site"), clean("write_pages")] };
const poll = (job, ms, res) => ({ ms, method: "GET", path: "/api/site/edit/" + job, status: 200, final: true, res });
const EDIT_RES = { ok: true, applied: 1, changed: [WITH] };

/**
 * One press's evidence. `order` "addon" or "text" says which job finished
 * first; `mid` is the heading the page showed between the two jobs, `end` the
 * final one; `faqAt` where the section appeared.
 */
function evidence({ order = "addon", mid, end = WITH, marks = MARKS, editRes = EDIT_RES, between = true, midVersion = "v-mid", routes = ["text", "addon"], prepMarks = undefined } = {}) {
  const addonFirst = order === "addon";
  const m = mid !== undefined ? mid : addonFirst ? HEAD : WITH;
  const msE = addonFirst ? 300 : 100, msA = addonFirst ? 100 : 300;
  const parts = routes.map((route, n) => ({
    n, route, runs: [{ job: "J" + n }],
    prepUse: [{ job: "J" + n, known: true, staged: "no", replayed: 0, rebased: 0, fresh: 1, scoped: 0, needs: 0, marks: route === "addon" ? marks.addon : marks.text }],
    ...(route === "addon" && prepMarks !== undefined ? { prepRun: { seq: 1, step: { from: 1, to: 2, calls: 3, marks: prepMarks } } } : {}),
  }));
  const network = [poll("J0", msE, editRes), ...(routes.length > 1 ? [poll("J1", msA, { ok: true, kinds: ["component"], changed: ["bake-list.tsx"] })] : [])];
  const firstJob = addonFirst ? "J1" : "J0";
  return {
    steps: [{ sent: true, request: { key: "rq1", final: { parts } }, network }],
    served: { "/bake-list": page(end, true) },
    ctx: {
      between: between ? [{ job: firstJob, ms: 400, status: 200, version: midVersion, html: page(m, addonFirst) }] : [],
      before: { render: { "/bake-list": { version: "v-before" } } },
      after: { render: { "/bake-list": { version: "v-after" } } },
      beforeServed: { "/bake-list": page(HEAD) },
    },
  };
}
const judge = (e) => isolationVerdict(e.steps, e.served, WANT, e.ctx);
const failed = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);

test("ISO 1 — ADD-ON FIRST, ALL EVIDENCE CLEAN: the Add-on's own version left the heading as it found it while the change was still to be made, its calls carried the change only marked, the edit made it: passes, and DISCRIMINATES", () => {
  const v = judge(evidence({ order: "addon" }));
  assert.deepEqual(failed(v), []);
  assert.equal(v.ok, true);
  assert.equal(v.order, "addon first");
  assert.equal(v.strength, "discriminating");
});

test("ISO 2 — EDIT FIRST: the same clean evidence passes but is only CONSISTENT — the phrase was already there when the Add-on ran, so leaving it alone may be the model noticing it (the owner's point); the press says so and never counts it as proof", () => {
  const e = evidence({ order: "text" });
  const v = judge(e);
  assert.equal(v.ok, true, v.why);
  assert.equal(v.order, "text first");
  assert.equal(v.strength, "consistent");
  const r = requestBatchVerdict({ spec: SC, steps: e.steps, served: e.served, beforeServed: e.ctx.beforeServed, before: e.ctx.before, after: e.ctx.after, between: e.ctx.between, tables: null, slug: "fold-lane-bakery" });
  assert.ok(r.unverified.some((u) => /not proven; only an Add-on-first run discriminates/.test(u)), JSON.stringify(r.unverified));
});

test("ISO 3 — THE ADD-ON MADE THE OTHER PART'S CHANGE: Add-on first, its own version already shows the phrase (whether or not the edit then found nothing to do, or appended again) — fails on the Add-on's own change", () => {
  for (const [editRes, end] of [[{ ok: true, applied: 0, changed: [] }, WITH], [EDIT_RES, WITH + " — sent every Friday"]]) {
    const v = judge(evidence({ order: "addon", mid: WITH, editRes, end }));
    assert.equal(v.ok, false);
    assert.ok(failed(v).includes("the Add-on job's own published change left the heading exactly as it found it"), JSON.stringify(failed(v)));
  }
});

test("ISO 4 — EDIT FIRST, THE ADD-ON TOUCHED THE HEADING: reworded or appended again in its own version — fails; left alone — passes as consistent only", () => {
  for (const end of [HEAD + " — every Friday", WITH + " — sent every Friday", "Join our weekly bake list — sent every Friday"]) {
    const v = judge(evidence({ order: "text", end }));
    assert.equal(v.ok, false, end);
  }
  assert.equal(judge(evidence({ order: "text" })).strength, "consistent");
});

test("ISO 5 — WHAT THE MODEL WAS SHOWN: another part's words unmarked in any call, the rule missing, no marking at all, marks missing or unreadable, or a bad preparation call — each fails", () => {
  const bad = (m) => ({ ...MARKS, addon: [MARKS.addon[0], { ...MARKS.addon[1], ...m }, MARKS.addon[2]] });
  for (const marks of [bad({ unmarked: 1 }), bad({ rule: false }), bad({ others: 0 }), { ...MARKS, addon: null }, { ...MARKS, addon: [] }, { ...MARKS, text: [{ ...MARKS.text[0], unmarked: 2 }] }]) {
    const v = judge(evidence({ order: "addon", marks }));
    assert.equal(v.ok, false, JSON.stringify(marks));
    assert.ok(failed(v).some((n) => /what each model call was shown is recorded|carried the other part's words only marked/.test(n)), JSON.stringify(failed(v)));
  }
  const prep = judge(evidence({ order: "addon", prepMarks: [clean("pick_adds"), { ...clean("add_to_site"), unmarked: 1 }] }));
  assert.equal(prep.ok, false);
  assert.ok(failed(prep).some((n) => n.startsWith("the Add-on's preparation")));
  assert.equal(judge(evidence({ order: "addon", prepMarks: [clean("pick_adds")] })).ok, true);
});

test("ISO 6 — EACH JOB'S OWN VERSION IS REQUIRED: no read between the jobs, a read that caught the final version (the second job had already published) or the first (nothing yet) — missing evidence, never a pass", () => {
  for (const o of [{ between: false }, { midVersion: "v-after" }, { midVersion: "v-before" }, { midVersion: "" }]) {
    const v = judge(evidence({ order: "addon", ...o }));
    assert.equal(v.ok, false, JSON.stringify(o));
    assert.ok(failed(v).some((n) => n.startsWith("each job's own change is read from its own published version")), JSON.stringify(failed(v)));
  }
});

test("ISO 7 — NOT EXERCISED: one Add-on part, two Add-on parts, or no text part — recorded with the routes, never ok", () => {
  for (const routes of [["addon"], ["addon", "addon"], ["look", "addon"]]) {
    const v = judge(evidence({ routes }));
    assert.equal(v.exercised, false, JSON.stringify(routes));
    assert.equal(v.ok, false);
    assert.match(v.why, /^not exercised: the router made/);
  }
});

test("ISO 8 — THE EDIT JOB'S OWN ANSWER: applied nothing, or changed something else, fails; the final page must carry the phrase once, straight after the heading", () => {
  for (const editRes of [{ ok: true, applied: 0, changed: [] }, { ok: true, applied: 1, changed: ["Join the bake list"] }, { ok: true, applied: 0, changed: [WITH] }]) {
    assert.match(judge(evidence({ order: "addon", editRes })).why, /own job applied the change/, JSON.stringify(editRes));
  }
  const near = judge(evidence({ order: "addon", end: HEAD + " today, sent every Friday" }));
  assert.equal(near.ok, false);
  assert.ok(failed(near).includes(`it stands straight after "${WANT.after}"`));
});

test("ISO 9 — WIRED INTO THE PRESS'S VERDICT, and the scenario agrees with itself: image-free, on the Bake List, the heading's from/to and the phrase agree, no overlap or reuse asked; in the balance opt-in alone, for its one approved run (2026-10-13)", async () => {
  const { BALANCE_OPT_IN } = await import("../scripts/canary-ui.mjs");
  const e = evidence({ order: "addon" });
  const base = { spec: SC, steps: e.steps, served: e.served, beforeServed: e.ctx.beforeServed, before: e.ctx.before, after: e.ctx.after, between: e.ctx.between, tables: null, slug: "fold-lane-bakery" };
  const good = requestBatchVerdict(base);
  assert.ok(good.isolation && good.isolation.ok && good.isolation.strength === "discriminating", JSON.stringify(good.isolation));
  const batched = requestBatchVerdict({ ...base, steps: evidence({ routes: ["addon"] }).steps });
  assert.ok(batched.checks.some((c) => c.name === "isolation: the request was split into the edit part and the Add-on part it needs" && !c.ok));
  assert.ok(batched.unverified.some((u) => /^task isolation: not exercised/.test(u)));
  assert.equal(SC.images, "none");
  const h = SC.expect.headings[0];
  assert.equal(h.route, WANT.route);
  assert.ok(h.to.startsWith(WANT.after) && h.to.toLowerCase().endsWith(WANT.phrase.toLowerCase()));
  assert.ok(SC.steps[0].say.includes(WANT.phrase) && SC.steps[0].say.includes(WANT.after));
  assert.ok(!/friday/i.test(SC.expect.sections[0].facts.map((f) => f.any.join(" ")).join(" ")));
  assert.equal(SC.expect.overlap, undefined);
  assert.equal(SC.expect.reuse, undefined);
  // THE OWNER APPROVED ONE RUN (2026-10-13): the box admits this press and
  // nothing else; it is closed again after the run.
  assert.deepEqual([...BALANCE_OPT_IN], ["acc-isolation-page"]);
});

// ── THE READ BETWEEN JOBS, THROUGH THE DRIVER AND A STAND-IN APP ─────────────
import { rqApp, drive, view, part, RQ_KEY, SITE } from "./fixtures/canary-rq-app.mjs";

const TWO = [
  view(RQ_KEY(7), [part(0, "the heading", "started", { route: "text", ids: ["j1"] }), part(1, "the questions", "ready", { route: "addon" })]),
  view(RQ_KEY(7), [part(0, "the heading", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "the questions", "started", { route: "addon", ids: ["j2"] })]),
  view(RQ_KEY(7), [part(0, "the heading", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "the questions", "done", { route: "addon", ids: ["j2"], jobs: ["j2"] })], { ended: true }),
];

test("ISO 10 — THE DRIVER READS THE PAGE AS SERVED WHEN EACH JOB'S FINAL ANSWER IS SEEN, once per job, with the version that served it — for a scenario that judges isolation, and never otherwise", { timeout: 30000 }, async () => {
  const fetched = [];
  let n = 0;
  const fetchSite = async (url) => {
    fetched.push(url);
    const v = "v" + (++n);
    return { status: 200, headers: { get: (k) => (k === "x-site-version" ? v : "") }, text: async () => `<main><h2>${v}</h2></main>` };
  };
  const spec = { ...UI_SCENARIOS["rq-canary"], addon: true, layers: ["text", "look", "page"], expect: { ...(UI_SCENARIOS["rq-canary"].expect || {}), isolation: WANT } };
  const rec = await drive(rqApp({ send: () => ({ request: { key: RQ_KEY(7), views: TWO }, route: { intent: "edit", layer: "text" } }) }), spec, { siteOrigin: SITE, fetchSite });
  assert.deepEqual(rec.between.map((b) => [b.job, b.status, b.version]), [["j1", 200, "v1"], ["j2", 200, "v2"]], JSON.stringify(rec.between));
  assert.ok(fetched.every((u) => u === SITE + WANT.route), JSON.stringify(fetched));
  assert.match(rec.between[0].html, /v1/);
  // NOT ASKED FOR: no read at all.
  const quiet = [];
  const plain = await drive(rqApp({ send: () => ({ request: { key: RQ_KEY(7), views: TWO }, route: { intent: "edit", layer: "text" } }) }), UI_SCENARIOS["rq-canary"], { siteOrigin: SITE, fetchSite: async (u) => { quiet.push(u); throw new Error("not to be read"); } });
  assert.deepEqual(quiet, []);
  assert.deepEqual(plain.between, []);
});
