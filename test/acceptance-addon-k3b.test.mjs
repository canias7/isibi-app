// K3B — TWO DESIGNERS INSIDE ONE ADD-ON, JUDGED IN THE PRESS (2026-10-13,
// prepared, not pressed).
//
// The owner, after run 147: *"prepare the exact K3B image-free scenario for
// testing two designers inside one Add-on. Use the current deployment if its
// existing tracing supports this; keep verification of unreleased reporting
// changes separate. Require evidence that the picker selected at least two
// independent kinds and their actual designer calls overlapped—one Add-on
// routing answer alone proves neither. Include outcome, preservation and
// charging checks, an honest not-exercised result for different routing or
// picking, and no automatic repeat."*
//
// What is checked here:
//   - `acc-addon-k3b` carries K3B's words exactly, buys nothing, is bound by
//     the acceptance cap and asks for the in-press reading;
//   - `innerDesignVerdict` over job records whose traces are written by the
//     real tracer (`newTrace`/`traceRow`), with the marks the deployed Worker
//     writes (pinned to its source below): pass only on two picked kinds that
//     waited for nothing and whose designer calls overlapped; not exercised on
//     another route or pick; fail on no overlap; unverified on what cannot be
//     tied to the job;
//   - the outcome checks on /order: both facts pass; a missing or wrong fact,
//     a contradiction, or a lost word fails;
//   - the wiring: the press reads it from the job records it already holds,
//     after the money check, and never as a pass on anything else.
// Nothing here routes, edits or buys anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, ACCEPTANCE_CAP, BALANCE_OPT_IN, readBalanceOptIn } from "../scripts/canary-ui.mjs";
import { innerDesignVerdict, requestBatchVerdict, outcomeChecks, routeOfPage } from "../scripts/canary-requests.mjs";
import { newTrace, traceRow } from "../builder/edit-trace.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const SC = UI_SCENARIOS["acc-addon-k3b"];

// ── THE SCENARIO ────────────────────────────────────────────────────────────

test("K3B 1 — the scenario: K3B's exact words from addon-kinds-3, one message, no image, the acceptance cap, funds first, the Add-on step, the in-press reading, the facts on /order; the balance box stays closed to it", () => {
  assert.ok(SC, "no acc-addon-k3b");
  const probes = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/addon-kinds-3.json", "utf8")).probes;
  const k3b = probes.find((p) => p.id === "K3B");
  assert.equal(SC.steps.length, 1);
  assert.equal(SC.steps[0].say, k3b.message, "the press would send other words than run 147 routed");
  assert.equal(SC.site, k3b.site);
  assert.equal(SC.images, "none");
  assert.equal(SC.cap, ACCEPTANCE_CAP);
  assert.equal(SC.fundsFirst, true);
  assert.equal(SC.addon, true);
  assert.equal(SC.request, true);
  assert.equal(SC.budget, 27);
  assert.equal(SC.expect.inner, "in-run");
  assert.equal(SC.expect.shape, true);
  assert.equal(SC.expect.overlap, undefined, "a request-level overlap demanded of what is one job");
  assert.deepEqual(SC.expect.sections.map((x) => x.route), ["/order", "/order"]);
  for (const x of SC.expect.sections) assert.ok(Array.isArray(x.facts) && x.facts.length >= 3, x.says.join(" "));
  assert.ok(SC.covers.includes("addon-inner"));
  assert.doesNotMatch(SC.steps[0].say, /\b(a|an|some) (photo|photograph|picture|image)s?\b|\bform\b|\btable\b/i);
  // THE OPT-IN IS NOT OPENED HERE: the owner names the press first.
  assert.ok(!BALANCE_OPT_IN.includes("acc-addon-k3b"), "the balance box was opened without the owner's word");
  assert.equal(readBalanceOptIn("828", { ui: "acc-addon-k3b" }).ok, false);
});

test("K3B 2 — requestBatchVerdict does not send this press to the read-job box: the in-press reading replaces that note; acc-addon-kinds keeps it", () => {
  const v = requestBatchVerdict({ spec: SC, steps: [], before: null, after: null, served: {}, tables: {}, slug: SLUG });
  assert.ok(!v.unverified.some((u) => /read-job box/.test(u)), JSON.stringify(v.unverified));
  const k = requestBatchVerdict({ spec: UI_SCENARIOS["acc-addon-kinds"], steps: [], before: null, after: null, served: {}, tables: {}, slug: SLUG });
  assert.ok(k.unverified.some((u) => /read-job box/.test(u)), "the observer is alive: acc-addon-kinds still names it");
});

// ── THE TRACE, AS THE DEPLOYED WORKER WRITES IT ─────────────────────────────

test("K3B 3 — the marks read here are the ones the Worker writes: pick_adds with its kinds, and each designer's start with `after` only when it waits", () => {
  const W = fs.readFileSync(ROOT + "worker.js", "utf8");
  assert.ok(W.includes('aMark("pick_adds", aPicked.failed ? "fail" : "ok", { kinds: aPicked.kinds });'), "the picker's mark changed");
  assert.ok(W.includes('aMark("add:" + j, "start", (aWaits[j] || []).length ? { after: aWaits[j] } : undefined);'), "the designer's start mark changed");
  // The tracer keeps an array of kinds (up to four) and a waiting list.
  const t = newTrace({ slug: SLUG, now: () => 0 });
  t.mark("pick_adds", "ok", { kinds: ["component", "words"] });
  t.mark("add:words", "start", { after: ["component"] });
  assert.deepEqual(t.events().map((e) => e.d), [{ kinds: ["component", "words"] }, { after: ["component"] }]);
});

const JOB = "0b3b0b3b-1111-2222-3333-444444444444";
const ROUTE_JOB = "0b3b0b3b-9999-8888-7777-666666666666";
const C0 = Date.parse("2026-10-14T10:00:00Z");
const ROW = { id: JOB, slug: SLUG, op: "addon", state: "done", created_at: "2026-10-14T10:00:00Z", updated_at: "2026-10-14T10:05:00Z" };

/** A trace written by the real tracer: `marks` are [phase, status, ms, detail]. */
function traceOf(marks, { start = C0 + 5_000, end = C0 + 280_000, cid } = {}) {
  let clock = start;
  const t = newTrace({ slug: SLUG, now: () => clock });
  for (const [p, s, ms, d] of marks) { clock = start + ms; t.mark(p, s, d); }
  clock = end;
  const row = traceRow(t, { now: () => end });
  return cid ? { ...row, cid } : row;
}
const recOf = (traces, { row = ROW, jobs = [{ id: JOB, state: "done", created_at: ROW.created_at, updated_at: ROW.updated_at }], complete = true } = {}) =>
  ({ job: JOB, row, traces, siblings: { ok: true, complete, ids: jobs.map((j) => j.id), jobs }, ledger: [], ledgerRead: { ok: true }, notes: [] });
const stepOf = ({ parts = [{ n: 0, route: "addon", status: "done", ids: [JOB] }], alsoAsked = "none" } = {}) => ({
  n: 1, sent: true,
  network: [{ method: "POST", path: "/api/site/route", status: 200, res: { op: "request", intent: "addon", layer: "none", alsoAsked, request: { key: "k3b", parts: parts.map((p) => ({ n: p.n, words: "w" })) } } }],
  request: { key: "k3b", final: { key: "k3b", ended: true, parts } },
  jobs: parts.flatMap((p) => p.ids || []),
});

const PICK2 = ["pick_adds", "ok", 10_000, { kinds: ["component", "words"] }];
const CROSS = [
  ["pick_adds", "start", 1_000], PICK2,
  ["add:component", "start", 12_000], ["add:words", "start", 12_500],
  ["add:words", "ok", 40_000], ["add:component", "ok", 70_000],
];
const APART = [
  ["pick_adds", "start", 1_000], PICK2,
  ["add:component", "start", 12_000], ["add:component", "ok", 40_000],
  ["add:words", "start", 41_000], ["add:words", "ok", 60_000],
];

test("K3B 4 — PASS: one Add-on part, nothing held back, the job's own trace, two picked kinds that waited for nothing, their designer calls crossing", () => {
  const v = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(CROSS)])] });
  assert.equal(v.state, "pass", JSON.stringify(v));
  assert.equal(v.ok, true);
  assert.deepEqual(v.kinds, ["component", "words"]);
  assert.deepEqual(v.independent, ["component", "words"]);
  assert.deepEqual(v.pairs, ["component and words"]);
  assert.equal(v.job, JOB);
  // A routing job filed beside it (op route) is not the add-on's job.
  const withRoute = { ...stepOf(), request: { key: "k3b", final: { key: "k3b", parts: [{ n: 0, route: "addon", status: "done", ids: [ROUTE_JOB, JOB] }] } } };
  const routeRec = { job: ROUTE_JOB, row: { ...ROW, id: ROUTE_JOB, op: "route" }, traces: [], siblings: { ok: true, complete: true, jobs: [] } };
  assert.equal(innerDesignVerdict({ steps: [withRoute], jobs: [routeRec, recOf([traceOf(CROSS)])] }).state, "pass");
});

test("K3B 5 — NOT EXERCISED, routing: two parts (as K was), a part held back, an edit answer, or nothing sent — never a pass, and the stage is named", () => {
  const jobs = [recOf([traceOf(CROSS)])];
  const two = innerDesignVerdict({ steps: [stepOf({ parts: [{ n: 0, route: "addon", status: "done", ids: [JOB] }, { n: 1, route: "addon", status: "done", ids: ["x"] }] })], jobs });
  assert.equal(two.state, "not-exercised");
  assert.equal(two.stage, "routing");
  assert.match(two.why, /2 part\(s\)/);
  const held = innerDesignVerdict({ steps: [stepOf({ alsoAsked: ["one line under the collection times"] })], jobs });
  assert.equal(held.state, "not-exercised");
  assert.match(held.why, /holding back/);
  const edit = innerDesignVerdict({ steps: [stepOf({ parts: [{ n: 0, route: "text", status: "done", ids: [JOB] }] })], jobs });
  assert.equal(edit.state, "not-exercised");
  assert.equal(innerDesignVerdict({ steps: [{ sent: false }], jobs }).state, "not-exercised");
  assert.equal(innerDesignVerdict({ steps: [], jobs }).state, "not-exercised");
  for (const v of [two, held, edit]) assert.equal(v.ok, false);
});

test("K3B 6 — NOT EXERCISED, picking: one kind, one kind beside the row step, or a failed pick", () => {
  const one = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf([["pick_adds", "ok", 10_000, { kinds: ["component"] }], ["add:component", "start", 12_000], ["add:component", "ok", 40_000]])])] });
  assert.equal(one.state, "not-exercised");
  assert.equal(one.stage, "picking");
  // Through the overlap reader alone this was only "unknown": the stage says why.
  assert.match(one.why, /chose 1 designer kind/);
  const row = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf([["pick_adds", "ok", 10_000, { kinds: ["component", "row"] }], ["add:component", "start", 12_000], ["add:row", "start", 12_100], ["add:row", "ok", 20_000], ["add:component", "ok", 40_000]])])] });
  assert.equal(row.state, "not-exercised");
  assert.equal(row.stage, "picking");
  const failed = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf([["pick_adds", "start", 1_000], ["pick_adds", "fail", 10_000], ["add:component", "start", 12_000], ["add:words", "start", 12_500], ["add:words", "ok", 40_000], ["add:component", "ok", 70_000]])])] });
  assert.equal(failed.state, "not-exercised");
  assert.match(failed.why, /picker failed/);
});

test("K3B 7 — NOT EXERCISED, independence: two kinds picked, but one designer waited for the other — even though their marks then cross", () => {
  const marks = [PICK2, ["add:component", "start", 12_000], ["add:words", "start", 12_500, { after: ["component"] }], ["add:words", "ok", 40_000], ["add:component", "ok", 70_000]];
  const v = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(marks)])] });
  assert.equal(v.state, "not-exercised");
  assert.equal(v.stage, "independence");
  assert.match(v.why, /words waited for component/);
  const missing = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf([PICK2, ["add:component", "start", 12_000], ["add:component", "ok", 70_000]])])] });
  assert.equal(missing.state, "not-exercised");
  assert.match(missing.why, /no designer start for words/);
});

test("K3B 8 — FAIL: two independent designers that ran one after the other; or an overlap only between kinds that are not both independent", () => {
  const apart = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(APART)])] });
  assert.equal(apart.state, "fail");
  assert.equal(apart.overlap, "not-overlapped");
  assert.match(apart.why, /one after another/);
  const marks = [
    ["pick_adds", "ok", 10_000, { kinds: ["component", "words", "table"] }],
    ["add:table", "start", 11_000], ["add:words", "start", 11_500],
    ["add:words", "ok", 20_000], ["add:table", "ok", 30_000],
    ["add:component", "start", 31_000, { after: ["table"] }], ["add:component", "ok", 60_000],
  ];
  // words and table are independent and crossed: a pass.
  assert.equal(innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(marks)])] }).state, "pass");
  const elsewhere = [
    ["pick_adds", "ok", 10_000, { kinds: ["component", "words", "table"] }],
    ["add:table", "start", 11_000], ["add:table", "ok", 15_000],
    ["add:words", "start", 16_000],
    ["add:component", "start", 17_000, { after: ["table"] }],
    ["add:words", "ok", 40_000], ["add:component", "ok", 60_000],
  ];
  const v = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(elsewhere)])] });
  assert.equal(v.state, "fail", JSON.stringify(v));
  assert.match(v.why, /not two of the independent kinds/);
});

test("K3B 9 — UNVERIFIED: the job's record not read, two traces in its run, another job beside it, the window not read whole, no pick mark", () => {
  assert.equal(innerDesignVerdict({ steps: [stepOf()], jobs: [] }).state, "unverified");
  assert.equal(innerDesignVerdict({ steps: [stepOf()], jobs: [{ job: JOB, row: null, traces: [] }] }).state, "unverified");
  const twin = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(CROSS), traceOf(APART, { cid: "twin" })])] });
  assert.equal(twin.state, "unverified");
  assert.equal(twin.stage, "attribution");
  assert.match(twin.why, /candidate-only/);
  const beside = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(CROSS)], { jobs: [{ id: JOB, state: "done", created_at: ROW.created_at, updated_at: ROW.updated_at }, { id: "other", state: "done", created_at: "2026-10-14T10:01:00Z", updated_at: "2026-10-14T10:02:00Z" }] })] });
  assert.equal(beside.state, "unverified");
  assert.equal(innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(CROSS)], { complete: false })] }).state, "unverified");
  const nopick = innerDesignVerdict({ steps: [stepOf()], jobs: [recOf([traceOf(CROSS.filter((m) => m[0] !== "pick_adds"))])] });
  assert.equal(nopick.state, "unverified");
  assert.equal(nopick.stage, "picking");
  for (const v of [twin, beside, nopick]) assert.equal(v.ok, false);
});

// ── THE OUTCOME ON /order ───────────────────────────────────────────────────

const PAGES = ["index", "visit", "order", "gallery", "starter"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(ROOT + "test/fixtures/run47/" + n + ".before.tsx", "utf8") }));
const TABLES = { ok: true, names: [], tables: {} };
function read(pages, mainOf = {}) {
  const served = {}, render = {};
  for (const p of pages) {
    const r = routeOfPage(p.source);
    served[r] = `<!doctype html><html><body><header><a href="/"><img src="/u/${SLUG}/logo.png" alt="logo"/></a></header><main><h1>page</h1>${mainOf[r] || ""}</main></body></html>`;
    render[r] = { status: 200, headings: ["page"] };
  }
  return { inv: { complete: true, source: { pages, parts: [] }, render, stored: { ok: true, description: "" } }, served };
}
const onOrder = (jsx) => PAGES.map((p) => (p.path === "order.tsx" ? { ...p, source: p.source.replace("</SiteChrome>", jsx + "\n      </SiteChrome>") } : p));
const judge = (jsx, html = jsx) => {
  const b = read(PAGES), a = read(onOrder(jsx), { "/order": html });
  return outcomeChecks({ spec: SC, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
};
const bad = (c) => c.filter((x) => !x.ok).map((x) => `${x.name}: ${x.why}`);
const BOTH = "<section><h2>Questions</h2><h3>Can I change my order?</h3><p>Yes, until 6pm the day before.</p></section>\n<p>Orders open every Sunday at noon.</p>";

test("K3B 10 — OUTCOME: both asked additions on /order, stored and served, the rest of the site byte for byte — every check passes; other wording too", () => {
  assert.ok(PAGES.find((p) => p.path === "order.tsx").source.includes("</SiteChrome>"), "the fixture's landmark is gone");
  const c = judge(BOTH);
  assert.ok(c.some((x) => /the section stored on \/order states "until 6pm"/.test(x.name)), "the observer is alive: the question's facts were judged");
  assert.ok(c.some((x) => /states "every Sunday"/.test(x.name)), "the observer is alive: the line's facts were judged");
  assert.deepEqual(bad(c), []);
  assert.deepEqual(bad(judge("<section><h2>Questions</h2><h3>Can I change my order?</h3><p>Yes — up to 6pm on the previous day.</p></section>\n<p>Ordering opens each Sunday at midday.</p>")), []);
});

test("K3B 11 — OUTCOME, NEGATIVE: the line missing, the wrong time, a contradiction, another day, a word the page lost, another page changed — each fails by name", () => {
  assert.ok(bad(judge("<section><h2>Questions</h2><h3>Can I change my order?</h3><p>Yes, until 6pm the day before.</p></section>")).some((n) => /states "every Sunday"|exactly one section the press added states what was asked/.test(n)), "a missing line passed");
  assert.ok(bad(judge(BOTH.replace("6pm", "8pm"))).some((n) => /states "until 6pm"/.test(n)), "the wrong time passed");
  assert.ok(bad(judge(BOTH.replace("Yes, until 6pm the day before.", "Yes, until 6pm the day before. Orders cannot change once placed."))).some((n) => /does not claim "cannot change"/.test(n)), "a contradiction passed");
  assert.ok(bad(judge(BOTH.replace("every Sunday", "every Sunday and Monday"))).some((n) => /states no day but sunday/.test(n)), "another day passed");
  const b = read(PAGES);
  const lost = onOrder(BOTH).map((p) => (p.path === "order.tsx" ? { ...p, source: p.source.replace("Collection only", "Pickup only") } : p));
  const a = read(lost, { "/order": BOTH });
  const c = outcomeChecks({ spec: SC, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
  assert.ok(bad(c).some((n) => /^\/order still says everything it said/.test(n)), "a lost word passed");
  const other = onOrder(BOTH).map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source + "\n// changed\n" } : p));
  const o = read(other, { "/order": BOTH });
  const co = outcomeChecks({ spec: SC, before: b.inv, after: o.inv, served: o.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
  assert.ok(bad(co).some((n) => /every stored page is byte for byte as it was/.test(n)), "another page changed and passed");
});

// ── THE WIRING ──────────────────────────────────────────────────────────────

test("K3B 12 — the press reads it from the job records it already holds, after the money check, before the evidence file is written; a not-exercised or unverified reading is a failed check and a NOT VERIFIED line, never repeated", () => {
  const E = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
  const jobsAt = E.indexOf("const jobRecords = [];");
  const moneyAt = E.indexOf("const money = ownMoneyVerdict({ start: bal.start, end: bal.end, calls, routeRows, jobs: jobRecords, window, prior });");
  const innerAt = E.indexOf('if (UI_ASK.scenario.expect && UI_ASK.scenario.expect.inner === "in-run") {');
  const callAt = E.indexOf("const iv = innerDesignVerdict({ steps: ui.steps, jobs: jobRecords });");
  const keptAt = E.indexOf("requests.inner = iv;");
  const writeAt = E.indexOf("writeFileSync(`${EVID}/ui.json`");
  for (const [k, v] of Object.entries({ jobsAt, moneyAt, innerAt, callAt, keptAt, writeAt })) assert.ok(v > 0, `${k} is gone`);
  assert.ok(jobsAt < moneyAt && moneyAt < innerAt && innerAt < callAt && callAt < keptAt && keptAt < writeAt, "out of order");
  const block = E.slice(innerAt, E.indexOf("\n      }\n", callAt));
  assert.match(block, /iv\.state === "not-exercised"[\s\S]*check\([^)]*false, `NOT EXERCISED/);
  assert.match(block, /NOT VERIFIED {2}two designers inside one Add-on: not exercised/);
  assert.match(block, /iv\.state === "unverified"[\s\S]*check\([^)]*false, `UNVERIFIED/);
  assert.match(block, /check\(`inside one Add-on: the picker chose[\s\S]*iv\.ok, iv\.why\)/);
  // NO AUTOMATIC REPEAT: nothing in the block sends, routes or presses again.
  assert.doesNotMatch(block, /press\(|click\(|fill\(|sendMessage|\/api\/site\/route|for \(|while \(/);
});

test("K3B 13 — the unreleased reporting changes are not a pass condition: the verdict reads the trace and the request view only, never a reply's facts", () => {
  const R = fs.readFileSync(ROOT + "scripts/canary-requests.mjs", "utf8");
  const at = R.indexOf("export function innerDesignVerdict(");
  const body = R.slice(at, R.indexOf("\n}\n", at));
  assert.ok(at > 0 && body.includes("addonDesignOverlap(rec)"), "the verdict is gone");
  assert.doesNotMatch(body, /reply|facts|additions|UNMATCHED|requirement/i);
});
