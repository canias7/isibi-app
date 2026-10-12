// THE FINAL ACCEPTANCE BATCH, REHEARSED OFFLINE (2026-10-11, prepared, not
// pressed). The owner: *"make its verdicts consume per-job prepUse evidence,
// require known and valid counts, distinguish exact reuse from fresh calls,
// and reject missing evidence rather than treating it as zero. Preserve
// interval-based proof of substantive concurrency and final-state checks …
// Rehearse the harness offline with supplied responses, including negative
// controls where concurrency, reuse evidence or a requested result is
// missing. Enforce the image-spending restriction in the execution path."*
//
// What is here:
//   - each scenario as written: site, messages word for word, walls, budget
//     and the batch's balance cap, no image, the table record each starts
//     from (chained);
//   - `reuseVerdict` on every shape of evidence, `needsObservation` (direct
//     evidence only) and `routingShape` (batched, parts in turn, parts
//     concurrent);
//   - the image refusal and the over-estimate verdict, pure;
//   - acc-page-table through the REAL canary driver (`runUi`) against the
//     stand-in app: the positive press, then one negative control at a time —
//     no concurrency, evidence missing, a count missing, fresh where exact was
//     required, a run job with no evidence at all, the requested change never
//     made — the image guard stopping the press, and the verdicts unchanged
//     when the polls are late, lost, or see several jobs finish at once.
//
// THE POLLING THRESHOLD IS GONE (2026-10-11, round 3, Codex on 542a6c34): it
// reacted only after a charge appeared and could not see jobs finishing
// between reads. The enforced bound is the account's balance, set to the
// batch cap and refused above it (test/acceptance-spend-bound.test.mjs).
//
// ⚠ SUPPLIED ANSWERS ONLY. Nothing here shows what the live router, a real
// model or the live Worker does.
import test from "node:test";
import assert from "node:assert/strict";
import { UI_SCENARIOS, readUiScenario, imageRefusal, overBudgetVerdict, capRefusal, ACCEPTANCE_CAP } from "../scripts/canary-ui.mjs";
import { reuseVerdict, needsObservation, overlapVerdict, requestBatchVerdict, routingShape } from "../scripts/canary-requests.mjs";
import { rqApp, drive, view, part, RQ_KEY, SITE } from "./fixtures/canary-rq-app.mjs";

const ACC = ["acc-page-table", "acc-table-page", "acc-needs", "acc-mixed"];
// acc-pages-real changes no row (two headings); it is checked on its own below.
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.why}`);

// ── THE SCENARIOS AS WRITTEN ─────────────────────────────────────────────────

test("THE BATCH AS WRITTEN: four scenarios on the bakery, in request mode, each buying no image, each with a budget its funds check needs and the batch's balance cap — no ceiling claimed; their messages word for word", () => {
  const says = {
    "acc-page-table": ["Change the Wholesale page heading 'Daily bread for Bristol cafés' to 'Daily bread for Bristol cafés and delis', and change the Country White's price to £4.90."],
    "acc-table-page": ["Change the Walnut Levain's price to £6.30, and change the home page heading 'Fed every morning since 2019' to 'Fed by hand every morning since 2019'."],
    "acc-needs": ["Change the Seeded Wholemeal's price to £5.50, and change the Order page heading 'Pick a loaf and a time to collect it' so it says exactly the same as the main heading on our Visit page."],
    "acc-mixed": ["Add a Bulk Orders page explaining how cafés can order bread in bulk: a minimum order of ten loaves, and orders in by 2pm for delivery the next morning. Put a link to it in the menu, and change the Olive & Rosemary's price to £5.90."],
  };
  for (const k of ACC) {
    const sc = UI_SCENARIOS[k];
    assert.ok(sc, `no ${k}`);
    assert.equal(readUiScenario(k, "fold-lane-bakery").ok, true);
    assert.equal(readUiScenario(k, "fretwork-1").ok, false);
    assert.equal(sc.request, true);
    assert.equal(sc.images, "none", `${k} may buy an image`);
    assert.equal(sc.fundsFirst, true);
    assert.equal(sc.cap, ACCEPTANCE_CAP, `${k}: not bound by the balance cap`);
    assert.equal(sc.ceiling, undefined, `${k}: a ceiling nothing enforces`);
    assert.deepEqual(sc.steps.map((s) => s.say), says[k]);
    for (const s of sc.steps) assert.doesNotMatch(s.say, /photo|picture|image/i, `${k} asks for a picture`);
    assert.ok(sc.expect.reuse && typeof sc.expect.reuse === "object", `${k} does not read the per-job evidence`);
  }
  // CONCURRENCY AND EXACT REUSE WHERE TWO INDEPENDENT PARTS RUN.
  for (const k of ["acc-page-table", "acc-table-page", "acc-mixed"]) {
    assert.equal(UI_SCENARIOS[k].expect.overlap, true);
    assert.deepEqual({ ...UI_SCENARIOS[k].expect.reuse }, { exact: 1, overlapped: true });
  }
  // THE REAL-MODEL CASE: no reuse demanded, the observation recorded.
  assert.deepEqual({ ...UI_SCENARIOS["acc-needs"].expect.reuse }, {});
  assert.deepEqual({ ...UI_SCENARIOS["acc-needs"].expect.needs }, { part: "order page heading" });
  assert.deepEqual(UI_SCENARIOS["acc-needs"].expect.headings, [{ route: "/order", from: "Pick a loaf and a time to collect it", to: "Come and see us" }]);
  // BROWSER-CLOSED RECOVERY AND THE DEPENDENT PART.
  assert.equal(UI_SCENARIOS["acc-table-page"].steps[0].away, "fresh");
  assert.equal(UI_SCENARIOS["acc-table-page"].expect.progress, true);
  assert.ok(UI_SCENARIOS["acc-mixed"].covers.includes("waits-for-prerequisite"));
  assert.equal(UI_SCENARIOS["acc-mixed"].addon, true);
  assert.deepEqual({ ...UI_SCENARIOS["acc-mixed"].expect.menu }, { page: 0 });
});

test("THE TABLES CHAIN: each press starts from the table the one before leaves — one price changed each time, every other row and field as it was, and each row's change named exactly once", () => {
  const rows = ACC.map((k) => UI_SCENARIOS[k].row);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    assert.equal(r.table, "loaves");
    assert.equal(r.field, "price");
    assert.equal(r.restore, false, "the demo-site rule: kept");
    const at = r.record.find((x) => x.id === r.id);
    assert.equal(at.name, r.match.name);
    assert.equal(String(at.price), r.from);
    if (i + 1 < rows.length) {
      const after = r.record.map((x) => (x.id === r.id ? { ...x, price: Number(r.to) } : { ...x }));
      assert.deepEqual(rows[i + 1].record.map((x) => ({ ...x })), after, `${ACC[i + 1]} does not start from what ${ACC[i]} leaves`);
    }
  }
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "two presses change the same row");
  assert.equal(rows[0].record.length, 7);
  assert.equal(rows[0].record.find((x) => x.id === 6).price, 4.7, "the first record is not the table as lv-parallel left it");
});

// ── THE EVIDENCE VERDICT ─────────────────────────────────────────────────────

const K = RQ_KEY(7);
const use = (job, over = {}) => ({ job, known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 0, ...over });
const stepOf = (parts) => [{ sent: true, request: { key: K, final: view(K, parts, { ended: true }) } }];
const P0 = (over = {}) => part(0, "change the Wholesale page heading", "done", { runs: [{ job: "h1", from: 1000, to: 6000 }], prepUse: [use("h1", { staged: "no", replayed: 0, fresh: 1 })], ...over });
const P1 = (over = {}) => part(1, "change the Country White's price", "done", { prepRun: { seq: 1, from: 1200, to: 4100, outcome: "ready", step: { from: 2000, to: 4000, calls: 1 } }, runs: [{ job: "p1", from: 6100, to: 7000 }], prepUse: [use("p1")], ...over });

test("reuseVerdict: every run job's evidence known and counted; exact reuse told apart from a fresh call; the exact reuse by a part whose prepared step overlapped other work", () => {
  const ok = reuseVerdict(stepOf([P0(), P1()]), { exact: 1, overlapped: true });
  assert.equal(ok.ok, true, ok.why);
  assert.deepEqual(ok.exact, [1]);
  assert.deepEqual(ok.fresh, []);
  // FRESH AS WELL AS REPLAYED: the shape a `needs` answer leaves.
  const again = reuseVerdict(stepOf([P0(), P1({ prepUse: [use("p1", { fresh: 1 })] })]), { fresh: 1 });
  assert.equal(again.ok, true, again.why);
  assert.deepEqual(again.fresh, [1]);
  assert.deepEqual(again.exact, []);
});

test("NEGATIVE — reuseVerdict refuses missing or unreadable evidence, never reading it as zero: not known, a missing count, an odd staged value, a run job with no entry, a re-base, no view, nothing served", () => {
  const cases = [
    [[P0(), P1({ prepUse: [{ job: "p1", known: false }] })], /no evidence of its calls \(not known\)/],
    [[P0(), P1({ prepUse: [use("p1", { replayed: null })] })], /replayed is not a count/],
    [[P0(), P1({ prepUse: [use("p1", { fresh: "0" })] })], /fresh is not a count/],
    [[P0(), P1({ prepUse: [use("p1", { staged: "maybe" })] })], /what was staged does not read/],
    [[P0(), P1({ prepUse: [] })], /job p1: ran with no evidence of its calls/],
    [[P0(), P1({ prepUse: [use("p1", { rebased: 1 })] })], /nothing may re-base/],
    [[P0({ prepUse: undefined, runs: [] }), P1({ prepUse: undefined, runs: [] })], /no job's use of its preparation was served/],
  ];
  for (const [parts, re] of cases) {
    const v = reuseVerdict(stepOf(parts), {});
    assert.equal(v.ok, false, `passed: ${JSON.stringify(parts.map((p) => p.prepUse))}`);
    assert.match(v.why, re);
  }
  assert.match(reuseVerdict([], {}).why, /not sent/);
  assert.match(reuseVerdict([{ sent: true, request: { key: K } }], {}).why, /never read/);
});

test("NEGATIVE — reuseVerdict refuses what the scenario asks for and did not happen: fresh where exact reuse was required, too few prepared jobs asked again, exact reuse by a part that did not run beside other work", () => {
  const fresh = reuseVerdict(stepOf([P0(), P1({ prepUse: [use("p1", { replayed: 0, fresh: 1 })] })]), { exact: 1 });
  assert.equal(fresh.ok, false);
  assert.match(fresh.why, /0 job\(s\) answered exactly from a preparation; 1 required/);
  const unstaged = reuseVerdict(stepOf([P0(), P1({ prepUse: [use("p1", { staged: "no" })] })]), { exact: 1 });
  assert.equal(unstaged.ok, false, "a job with nothing staged was counted as exact reuse");
  assert.equal(reuseVerdict(stepOf([P0(), P1()]), { fresh: 1 }).ok, false);
  // THE PREPARED STEP RAN ONLY AFTER THE OTHER JOB ENDED.
  const late = P1({ prepRun: { seq: 1, from: 6050, to: 6090, outcome: "ready", step: { from: 6060, to: 6090, calls: 1 } } });
  const seq = reuseVerdict(stepOf([P0(), late]), { exact: 1, overlapped: true });
  assert.equal(seq.ok, false);
  assert.match(seq.why, /no job answered exactly was a part whose prepared step overlapped/);
  assert.equal(reuseVerdict(stepOf([P0(), late]), { exact: 1 }).ok, true, "CONTROL: without `overlapped`, the same evidence passes");
});

test("needsObservation: direct evidence only — the step's own answer said needs, a scoped answer did not, the step was never scoped, or the counts are missing; an extra model call alone is never read as asking; the press lists it as unverified", () => {
  const PN = (u) => part(1, "change the Order page heading so it says the same as the Visit heading", "done", { runs: [{ job: "t1", from: 7000, to: 9000 }], prepUse: [u] });
  const seen = (u) => needsObservation(stepOf([P0(), PN(u)]), "order page heading").seen;
  assert.equal(seen(use("t1", { replayed: 1, fresh: 1, scoped: 2, needs: 1 })), "asked");
  assert.equal(seen(use("t1", { scoped: 1, needs: 0 })), "did-not-ask");
  assert.equal(seen(use("t1", { staged: "no", replayed: 0, fresh: 1, scoped: 0, needs: 0 })), "not-scoped");
  // AN EXTRA CALL ALONE (fresh 1 beside a replay) WITH NO COUNT OF needs: not "asked".
  assert.equal(seen(use("t1", { fresh: 1 })), "unknown", "an extra model call was read as the model asking");
  assert.equal(seen(use("t1", { fresh: 1, scoped: 1, needs: null })), "unknown");
  assert.equal(seen({ job: "t1", known: false }), "unknown");
  assert.equal(needsObservation(stepOf([P0()]), "order page heading").seen, "unknown");
  const spec = { steps: [{ say: "x" }], expect: { reuse: {}, needs: { part: "order page heading" } } };
  const v = requestBatchVerdict({ spec, steps: stepOf([P0(), PN(use("t1", { fresh: 1, scoped: 2, needs: 1 }))]) });
  assert.equal(v.needs.seen, "asked");
  assert.ok(v.unverified.some((u) => /asks for context it was not shown instead of guessing: observed "asked" for part 1 \(its own answer said needs\) — ONE SAMPLE/.test(u)), JSON.stringify(v.unverified));
  assert.ok(!v.checks.some((c) => /context it was not shown/.test(c.name)), "the observation was made a check");
  const named = v.checks.find((c) => /every job's use of its preparation is recorded and reads/.test(c.name));
  assert.ok(named && named.ok, JSON.stringify(named));
});

test("routingShape: one part is BATCHED (never parallel work); several parts are concurrent only by recorded intervals, otherwise in turn; no view or no send is unknown — recorded, never a check", () => {
  const ROUTED = (held) => ({ method: "POST", path: "/api/site/route", res: { intent: "edit", layer: "text", alsoAsked: held } });
  const st = (parts, held = "none") => [{ sent: true, network: [ROUTED(held)], request: { key: K, final: view(K, parts, { ended: true }) } }];
  const one = routingShape(st([P0()]));
  assert.equal(one.shape, "batched");
  assert.deepEqual(one.held, []);
  const two = routingShape(st([P0(), P1()], "change the Country White's price"));
  assert.equal(two.shape, "parts-concurrent", JSON.stringify(two));
  assert.deepEqual(two.held, ["change the Country White's price"]);
  const late = P1({ prepRun: { seq: 1, from: 6050, to: 6090, outcome: "ready", step: { from: 6060, to: 6090, calls: 1 } } });
  assert.equal(routingShape(st([P0(), late])).shape, "parts-in-turn");
  assert.equal(routingShape([{ sent: false }]).shape, "unknown");
  assert.equal(routingShape([{ sent: true, request: { key: K } }]).shape, "unknown");
  // THE VERDICT RECORDS IT AS UNVERIFIED AND MAKES NO CHECK OF IT.
  const spec = { steps: [{ say: "x" }], expect: { reuse: {}, shape: true } };
  const v = requestBatchVerdict({ spec, steps: st([P0()]) });
  assert.equal(v.shape.shape, "batched");
  assert.ok(v.unverified.some((u) => /what the real router made of the message: batched \(1 part\(s\)\) — recorded, not judged/.test(u)), JSON.stringify(v.unverified));
  assert.ok(!v.checks.some((c) => /real router made/.test(c.name)));
  // acc-pages-real: the real router's page/page answer, recorded, nothing demanded of it.
  const pr = UI_SCENARIOS["acc-pages-real"];
  assert.equal(pr.expect.shape, true);
  assert.equal(pr.expect.overlap, undefined, "acc-pages-real demands concurrency the router may not make");
  assert.deepEqual({ ...pr.expect.reuse }, {});
  assert.equal(pr.images, "none");
  assert.equal(pr.cap, ACCEPTANCE_CAP);
});

// ── THE BALANCE CAP, THE OVER-ESTIMATE VERDICT AND THE IMAGE REFUSAL ─────────

test("overBudgetVerdict: a press's own spend above its estimate FAILS and says only the balance bounded it; within it passes; an unreadable spend fails; no estimate is skipped", () => {
  assert.equal(overBudgetVerdict({ own: 8, budget: 9 }).ok, true);
  assert.equal(overBudgetVerdict({ own: 9, budget: 9 }).ok, true);
  const over = overBudgetVerdict({ own: 41, budget: 9 });
  assert.equal(over.ok, false);
  assert.match(over.why, /spent 41, more than its estimate of 9 — only the balance bounded it/);
  assert.equal(overBudgetVerdict({ own: null, budget: 9 }).ok, false);
  assert.equal(overBudgetVerdict({ own: NaN, budget: 9 }).ok, false);
  assert.equal(overBudgetVerdict({ own: 3, budget: undefined }).skipped, true);
  // THE CAP IS THE BALANCE: refused above it, before anything is sent.
  assert.match(capRefusal({ now: 101, cap: ACCEPTANCE_CAP }), /hard cap of 100/);
  assert.equal(capRefusal({ now: 100, cap: ACCEPTANCE_CAP }), "");
});

test("imageRefusal: only the live Worker's own `imagePurchases: false` lets a no-image press send", () => {
  assert.equal(imageRefusal({ status: 200, json: { imagePurchases: false } }), "");
  assert.match(imageRefusal({ status: 200, json: { imagePurchases: true } }), /still buys photographs/);
  assert.match(imageRefusal({ status: 200, json: { async: true } }), /does not report/);
  assert.match(imageRefusal({ status: 401, json: { error: "x" } }), /could not be read/);
  assert.match(imageRefusal(null), /not read/);
});

// ── acc-page-table THROUGH THE REAL CANARY DRIVER ────────────────────────────

const AP = UI_SCENARIOS["acc-page-table"];
const W0 = "change the Wholesale page heading 'Daily bread for Bristol cafés' to 'Daily bread for Bristol cafés and delis'";
const W1 = "change the Country White's price to £4.90";
const REPLIES = {
  h1: { ok: true, msg: "✅ Changed.", reply: "Your Wholesale page heading now reads “Daily bread for Bristol cafés and delis”.", replySource: "model" },
  p1: { ok: true, msg: "✅ Updated.", reply: "The Country White is now £4.90 on your Order page.", replySource: "model" },
};
const PREP = { seq: 1, from: 1200, to: 4100, outcome: "ready", step: { from: 2000, to: 4000, calls: 1 } };
const RAN = { h1: [1000, 6000], p1: [6100, 7000] };
const runsOf = (...jobs) => jobs.map((j) => ({ job: j, from: RAN[j][0], to: RAN[j][1] }));
const E0 = [use("h1", { staged: "no", replayed: 0, fresh: 1 })];
const E1 = [use("p1")];
function views({ prep = PREP, e0 = E0, e1 = E1, charged = [2, 1] } = {}) {
  const A = (st, over = {}) => part(0, W0, st, over);
  const B = (st, over = {}) => part(1, W1, st, over);
  return [
    view(K, [A("started", { route: "text", ids: ["h1"] }), B("ready", { prep: "preparing" })]),
    view(K, [A("started", { route: "text", ids: ["h1"], runs: [{ job: "h1", from: 1000, to: null }] }), B("ready", { prep: "prepared", prepRun: prep })]),
    view(K, [A("done", { route: "text", ids: ["h1"], jobs: ["h1"], runs: runsOf("h1"), prepUse: e0, charged: charged[0] }), B("started", { route: "data", ids: ["p1"], prepRun: prep, runs: [{ job: "p1", from: 6100, to: null }] })]),
    view(K, [A("done", { route: "text", ids: ["h1"], jobs: ["h1"], runs: runsOf("h1"), prepUse: e0, charged: charged[0] }), B("done", { route: "data", ids: ["p1"], jobs: ["p1"], prepRun: prep, runs: runsOf("p1"), prepUse: e1, charged: charged[1] })], { ended: true }),
  ];
}
function loaves(h, changes = true) {
  const rows = () => AP.row.record.map((r) => ({ ...r, price: changes && r.id === AP.row.id && h.server.key ? Number(AP.row.to) : r.price }));
  return {
    owner: async () => ({ status: 200, json: { rows: rows().map((r) => ({ ...r, price: String(r.price) })) } }),
    pub: async () => ({ status: 200, text: JSON.stringify(rows()) }),
    patch: async () => { throw new Error("the owner route's write was reached"); },
    lines: () => [...rows()].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `${r.name} £${Number(r.price).toFixed(2)} · ${r.description}`),
  };
}
const RT_OFF = async () => ({ status: 200, json: { ok: true, imagePurchases: false } });
function press({ v = {}, changes = true, runtimeNow = RT_OFF, balance = 30 } = {}) {
  let io = null;
  const h = rqApp({ replies: REPLIES, send: () => ({ request: { key: K, views: views(v) }, route: { intent: "edit", layer: "text" } }), shown: () => io.lines() });
  io = loaves(h, changes);
  const run = () => drive(h, AP, {
    balanceNow: async () => balance, rows: { owner: io.owner, pub: io.pub, patch: io.patch }, siteOrigin: SITE, shownMs: 50,
    stepMs: 4_000, stepCapMs: 4_000, runtimeNow,
  });
  return { h, run };
}
const verdictOf = (rec) => requestBatchVerdict({ spec: AP, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
const named = (v, re) => v.checks.filter((c) => re.test(c.name));
const REUSE = /every job's use of its preparation is recorded and reads/;
const OVERLAP = /recorded intervals/;

test("END TO END, OFFLINE: acc-page-table through the real canary driver — the image switch read first, the price prepared beside the heading's job and replayed exactly, by recorded intervals and per-job evidence, the row changed exactly once, nothing written by the press", async () => {
  const { h, run } = press();
  const rec = await run();
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 1);
  assert.deepEqual(rec.imagesOff, { status: 200, imagePurchases: false, ok: true });
  const v = verdictOf(rec);
  assert.deepEqual(failed(named(v, REUSE)), []);
  assert.deepEqual(failed(named(v, OVERLAP)), []);
  assert.equal(named(v, REUSE).length, 1);
  assert.deepEqual(v.reuse.exact, [1]);
  assert.deepEqual(overlapVerdict(rec.steps).overlaps.map((o) => [o.prepPart, o.runPart, o.job]), [[1, 0, "h1"]]);
  assert.equal(rec.row.change.exact, true, JSON.stringify(rec.row.change));
  assert.equal(rec.row.writes, undefined, "the press wrote the row");
  assert.deepEqual(failed(v.replies), []);
  assert.ok(!h.calls.some((c) => /stop/.test(c)), "the request was stopped: " + JSON.stringify(h.calls));
});

test("END TO END, OFFLINE, NEGATIVE CONTROLS — each missing thing fails its own check and nothing else: no concurrency, evidence not known, a count missing, fresh where exact was required, the requested change never made", async () => {
  const late = { ...PREP, from: 6020, to: 6090, step: { from: 6030, to: 6090, calls: 1 } };
  const controls = [
    { name: "no concurrency", v: { prep: late }, fail: [OVERLAP, REUSE] },
    { name: "evidence not known", v: { e1: [{ job: "p1", known: false }] }, fail: [REUSE] },
    { name: "a count missing", v: { e1: [use("p1", { replayed: null })] }, fail: [REUSE] },
    { name: "fresh where exact was required", v: { e1: [use("p1", { replayed: 0, fresh: 1 })] }, fail: [REUSE] },
    { name: "a run job with no evidence", v: { e0: [] }, fail: [REUSE] },
  ];
  for (const c of controls) {
    const { run } = press({ v: c.v });
    const rec = await run();
    assert.equal(rec.stopped, null, `${c.name}: ${JSON.stringify(rec.stopped)}`);
    const v = verdictOf(rec);
    for (const re of [REUSE, OVERLAP]) {
      const f = failed(named(v, re));
      if (c.fail.includes(re)) assert.equal(f.length, 1, `${c.name}: ${re} did not fail`);
      else assert.deepEqual(f, [], `${c.name}: ${re} failed too`);
    }
    assert.equal(v.ok, false, `${c.name}: the press passed`);
    assert.equal(rec.row.change.exact, true, `${c.name}: the row check moved`);
  }
  // THE REQUESTED CHANGE NEVER MADE: the evidence and the intervals pass, the row check does not.
  const { run } = press({ changes: false });
  const rec = await run();
  const v = verdictOf(rec);
  assert.deepEqual(failed(named(v, REUSE)), []);
  assert.deepEqual(failed(named(v, OVERLAP)), []);
  assert.notEqual(rec.row.change.exact, true, "a price that never changed passed as changed");
});

test("END TO END, OFFLINE — THE IMAGE GUARD: a Worker that still buys photographs, one that cannot be read, and a driver with no runtime reader each stop the press before its message is sent", async () => {
  for (const rt of [async () => ({ status: 200, json: { imagePurchases: true } }), async () => ({ status: 503, json: null }), async () => { throw new Error("down"); }, null]) {
    const { h, run } = press({ runtimeNow: rt });
    const rec = await run();
    assert.equal(rec.sent, 0, "a message was sent");
    assert.ok(rec.stopped && /nothing is sent/.test(rec.stopped.msg), JSON.stringify(rec.stopped));
    assert.equal(h.server.key, "", "the server took a request");
  }
});

test("END TO END, OFFLINE — LATE, LOST AND COARSE POLLING: every job finished before the first read, a read that answers nothing, both parts ending between two reads — the same verdict, from the recorded intervals and per-job evidence, never from when the press looked; and no Stop is ever pressed by a polling threshold", async () => {
  const base = verdictOf(await press().run());
  const sig = (v) => JSON.stringify({ ok: v.ok, reuse: failed(named(v, REUSE)), overlap: failed(named(v, OVERLAP)), exact: v.reuse && v.reuse.exact });
  const vs = views();
  const variants = {
    "nothing seen until all ended": [vs[3]],
    "both parts end between two reads": [vs[0], vs[3]],
    "a read that answers nothing, then the end": [vs[0], null, vs[3]],
  };
  for (const [name, seq] of Object.entries(variants)) {
    let io = null;
    const h = rqApp({ replies: REPLIES, send: () => ({ request: { key: K, views: seq.map((x) => x || vs[0]) }, route: { intent: "edit", layer: "text" } }), shown: () => io.lines() });
    io = loaves(h, true);
    const rec = await drive(h, AP, { balanceNow: async () => 30, rows: { owner: io.owner, pub: io.pub, patch: io.patch }, siteOrigin: SITE, shownMs: 50, stepMs: 4_000, stepCapMs: 4_000, runtimeNow: RT_OFF });
    assert.equal(rec.stopped, null, `${name}: ${JSON.stringify(rec.stopped)}`);
    assert.equal(sig(verdictOf(rec)), sig(base), `${name}: the verdict moved with the polling`);
    assert.ok(!h.calls.some((c) => /stop/.test(c)), `${name}: a Stop was pressed`);
  }
  // CHARGES FAR ABOVE THE ESTIMATE, SEVERAL AT ONCE: the press does not stop
  // the request on a polled sum (nothing there to enforce); its own spend is
  // judged after the end by overBudgetVerdict, and the balance cap is what
  // bounded it.
  const big = press({ v: { charged: [60, 40] } });
  await big.run();
  assert.ok(!big.h.calls.some((c) => /stop/.test(c)), "a polling threshold pressed Stop");
  assert.equal(overBudgetVerdict({ own: 2 + 60 + 40, budget: AP.budget }).ok, false);
});

test("THE PRESS REFUSES ABOVE THE CAP: a balance of 971 sends nothing; 100 sends", async () => {
  const hi = press({ balance: 971 });
  const r = await hi.run();
  assert.equal(r.sent, 0);
  assert.match(r.stopped && r.stopped.msg, /hard cap of 100/);
  assert.equal(hi.h.server.key, "");
  const ok = press({ balance: 100 });
  assert.equal((await ok.run()).sent, 1);
});

test("THE WIRING: the press hands the driver the runtime reader on the site it presses, and the free runtime line prints whether photographs are bought", async () => {
  const fs = await import("node:fs");
  const press = fs.readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");
  assert.ok(press.includes('freshSession: signIn, runtimeNow: () => call("GET", `/api/site/runtime?slug=${encodeURIComponent(CANARY)}`) });'), "the driver is not handed the runtime reader");
  assert.ok(press.includes("imagePurchases=${(runtime.json || {}).imagePurchases}"), "the free runtime line does not print the image switch");
  // A PRESS THAT SPENT PAST ITS ESTIMATE FAILS ITS OWN CHECK, read from its own charges.
  const own = press.indexOf("const money = ownMoneyVerdict(");
  const ob = press.indexOf("const ob = overBudgetVerdict({ own: money.own, budget: UI_ASK.scenario.budget });");
  assert.ok(own > 0 && ob > own, "the over-estimate check is gone or reads no spend");
  assert.ok(press.includes("      if (Number.isFinite(UI_ASK.scenario.budget)) {\n        const ob = overBudgetVerdict("), "the over-estimate check is not asked for every scenario with an estimate");
  assert.ok(press.slice(ob, ob + 300).includes("ob.ok, ob.why);"), "the over-estimate verdict is not made a check");
});

test("THE ROUTING PROBE FIRST: acceptance-split-1 reads, records every acceptance message's real routing unjudged (intended null), and its report tells one answer for every change (batched) from an answer that holds a change back (parts); a question back is neither", async () => {
  const fs = await import("node:fs");
  const { readProbeBatch, shapeSaid } = await import("../scripts/canary-probes.mjs");
  const r = readProbeBatch(fs.readFileSync(new URL("../scripts/router-probes/acceptance-split-1.json", import.meta.url), "utf8"), "acceptance-split-1");
  assert.equal(r.ok, true, r.msg);
  assert.ok(r.batch.probes.every((p) => p.intended === null && p.site === "fold-lane-bakery"));
  const says = r.batch.probes.map((p) => p.message);
  for (const k of ["acc-pages-real", "acc-page-table", "acc-table-page", "acc-needs", "acc-mixed", "acc-addon-inner", "acc-addon-edit", "acc-addon-pair"]) assert.ok(says.includes(UI_SCENARIOS[k].steps[0].say), `${k}'s message is not probed first`);
  assert.match(shapeSaid({ intent: "edit", layer: "text", alsoAsked: "none" }), /^batched/);
  assert.match(shapeSaid({ intent: "edit", layer: "text", alsoAsked: "change the price" }), /^parts/);
  assert.match(shapeSaid({ intent: "edit", layer: "text", alsoAsked: ["change the price"] }), /^parts/);
  assert.match(shapeSaid({ intent: "clarify" }), /neither batched nor split/);
  assert.equal(shapeSaid(null), "unreadable");
});
