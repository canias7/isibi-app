// THE READINESS PRESS (2026-10-09, `lv-parallel`; prepared after the owner
// approved the release and this preparation).
//
// What it must be: one message on fold-lane-bakery whose three parts the
// preparation rules make concurrent — a footer link with no address (it asks),
// a price (a data step) and a heading (a text step) — then the answer, inside
// its budget, its hard cap, its walls and its time, the answer sent with its
// tab closed and followed in a fresh browser session; the changes kept. And
// what it reads (corrected on Codex's review of ac24aece): RECORDED INTERVALS
// on the request's own view — a part's prepared step (`prepRun.step`) and
// another part's job execution (`runs`) — judged by `overlapVerdict`; a
// status seen beside another (preparing beside queued) is never overlap.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, readUiScenario, pathNeedMs, pressLimitMs, UI_PRESS_MAX_MS, UI_REPLY_FLOOR_MS } from "../scripts/canary-ui.mjs";
import { overlapVerdict, requestBatchVerdict, progressChecks, replyChecks, requestTimeline } from "../scripts/canary-requests.mjs";
import { ownMoneyVerdict, routeCallsOf } from "../scripts/canary-ui.mjs";
import { rqApp, drive, view, part, RQ_KEY, SITE } from "./fixtures/canary-rq-app.mjs";

const LP = UI_SCENARIOS["lv-parallel"];
const M1 = "Change the Order page heading 'Choose a loaf and a time to collect it' to 'Pick a loaf and a time to collect it', change the Sea Salt Focaccia's price to £4.70, and add a link to our X account in the footer.";
const M2 = "It's x.com/harbourloaf";

test("lv-parallel: on the bakery, in request mode, two messages word for word — the heading first, the price beside it, the X footer link last (it asks) — then the answer, sent with its tab closed and followed in a fresh session; inside its budget, cap, walls and time; the focaccia kept", () => {
  assert.ok(LP, "no lv-parallel scenario");
  assert.equal(readUiScenario("lv-parallel", "fold-lane-bakery").ok, true);
  assert.equal(readUiScenario("lv-parallel", "fretwork-1").ok, false);
  assert.equal(LP.request, true);
  assert.deepEqual(LP.steps.map((s) => s.say), [M1, M2]);
  assert.equal(LP.steps[0].until, "question", "the first message must end on the footer link's question");
  // THE ORDER (run 117's diagnosis): the footer link last in the message, so
  // in apply order it holds back no earlier part's step.
  assert.ok(M1.indexOf("heading") < M1.indexOf("price") && M1.indexOf("price") < M1.indexOf("footer"));
  assert.equal(LP.steps[1].until, undefined);
  // THE BROWSER-CLOSED PATH: the answer is sent with its tab closed and
  // followed in a fresh browser session, where the progress checks read.
  assert.equal(LP.steps[0].away, undefined);
  assert.equal(LP.steps[1].away, "fresh");
  // MONEY: about 11-17; nothing is sent unless the balance covers the budget
  // and is no more than the cap.
  assert.equal(LP.budget, 20);
  assert.equal(LP.fundsFirst, true);
  // THE HARD CAP: 1018, the owner's choice once the account held 1018 (2026-10-09).
  assert.equal(LP.cap, 1018);
  // WALLS: the footer link's add-on hand-over to the menu step, the price's
  // data step and the heading's text step — nothing that rewrites a page.
  assert.equal(LP.addon, true);
  assert.deepEqual([...LP.layers].sort(), ["data", "nav", "text"]);
  // WHAT IT CHECKS.
  assert.equal(LP.expect.overlap, true);
  // THE MODEL'S PROGRESS LINES, CHECKED (restored after Codex's review of ac24aece).
  assert.equal(LP.expect.progress, true);
  // FRESH TARGETS: runs 113 and 117 kept YouTube, LinkedIn and their headings.
  assert.deepEqual(LP.expect.social, { network: "x", host: "x.com", path: "/harbourloaf" });
  assert.deepEqual(LP.expect.headings, [{ route: "/order", from: "Choose a loaf and a time to collect it", to: "Pick a loaf and a time to collect it" }]);
  assert.deepEqual([...LP.covers], ["several-parts", "step-question", "answer-resumes"]);
  // THE ROW: the focaccia, 4.6 -> 4.7, KEPT (`restore: false`, the demo-site
  // rule), against the table run 117 left: seven rows, the Walnut Levain at
  // 6.2, the focaccia at 4.6.
  assert.equal(LP.row.table, "loaves");
  assert.equal(LP.row.id, 6);
  assert.deepEqual(LP.row.match, { name: "Sea Salt Focaccia" });
  assert.equal(LP.row.from, "4.6");
  assert.equal(LP.row.to, "4.7");
  assert.deepEqual([LP.row.shown.before, LP.row.shown.after], ["£4.60", "£4.70"]);
  assert.equal(LP.row.restore, false, "the run must keep the focaccia's new price and write nothing");
  assert.equal(LP.row.record.length, 7);
  assert.equal(LP.row.record.find((r) => r.id === 5).price, 6.2);
  assert.equal(LP.row.record.find((r) => r.id === 6).price, 4.6, "the baseline is not the table run 117 left");
  // TIME: each message's bound covers its measured path, every container wait
  // at the longest measured; the two with their reply floors fit the press.
  for (const s of LP.steps) assert.ok(s.ms >= pathNeedMs(s.path), `${s.say.slice(0, 30)}: ${s.ms} < ${pathNeedMs(s.path)}`);
  const need = LP.steps.reduce((t, s) => t + s.ms + UI_REPLY_FLOOR_MS, 0);
  assert.ok(need <= pressLimitMs(LP) && pressLimitMs(LP) === UI_PRESS_MAX_MS, `${need} > ${pressLimitMs(LP)}`);
  // NO OTHER SCENARIO SENDS ITS WORDS.
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) if (k !== "lv-parallel") for (const s of sc.steps || []) assert.ok(s.say !== M1 && s.say !== M2, k);
  // THE FORM NAMES IT.
  const flow = fs.readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");
  assert.match(flow, /lv-parallel \(the readiness press on fold-lane-bakery/);
  assert.match(flow, /lv-parallel[^\n]*followed in a fresh browser session; the changes stay/);
  assert.doesNotMatch(flow, /lv-parallel[^\n]*focaccia put back/);
});

// ── THE VERDICT, BY RECORDED INTERVALS ───────────────────────────────────────
//
// Each case is the view the request's own route serves (`requestView`): a
// part's preparation as `prepRun` (its routing's start and end, and the step's
// own interval and model calls when a step ran) and each part's run jobs as
// `runs` (opened when the job began running, closed when it ended).

const K = RQ_KEY(7);
const stepWith = (parts, over = {}) => [{ sent: true, request: { key: K, final: view(K, parts), ...over } }];
const ran = (job, from, to) => ({ job, from, to });
const prepOf = (from, to, step = null, outcome = "ready") => ({ seq: 1, from, to, outcome, step });

test("overlapVerdict: a part's prepared step overlapping another part's executing job passes, and names both", () => {
  const v = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("job-price-1", 1000, 9000)] }),
    part(1, "the heading", "done", { prepRun: prepOf(1200, 6000, { from: 4000, to: 6000, calls: 2 }), runs: [ran("job-head-1", 9100, 12000)] }),
  ]));
  assert.equal(v.ok, true, v.why);
  assert.deepEqual(v.overlaps.map((o) => [o.prepPart, o.runPart, o.job, o.ms]), [[1, 0, "job-price-1", 2000]]);
  assert.match(v.said, /part 1's prepared step \(2 model call\(s\)\) overlapped part 0's job job-pric for 2 s/);
});

test("NEGATIVE — QUEUED ONLY: a part prepared beside another part's job that never began executing (no interval) does not pass, however the statuses read", () => {
  const v = overlapVerdict(stepWith([
    part(0, "the price", "queued", { ids: ["job-price-1"] }),
    part(1, "the heading", "ready", { prep: "prepared", prepRun: prepOf(1200, 6000, { from: 4000, to: 6000, calls: 2 }) }),
  ]));
  assert.equal(v.ok, false);
  assert.match(v.why, /^missing evidence: no other part's job execution interval was recorded/);
  // A JOB STILL OPEN IS NOT A CLOSED INTERVAL EITHER.
  const open = overlapVerdict(stepWith([
    part(0, "the price", "started", { runs: [ran("job-price-1", 1000, null)] }),
    part(1, "the heading", "ready", { prepRun: prepOf(1200, 6000, { from: 4000, to: 6000, calls: 2 }) }),
  ]));
  assert.equal(open.ok, false);
  assert.match(open.why, /\(1 still open\)/);
});

test("NEGATIVE — PREPARATION DONE BEFORE THE OTHER JOB STARTED: no overlap; and a touching edge is not overlap", () => {
  const before = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("job-price-1", 7000, 9000)] }),
    part(1, "the heading", "done", { prepRun: prepOf(1200, 6000, { from: 4000, to: 6000, calls: 2 }) }),
  ]));
  assert.equal(before.ok, false);
  assert.match(before.why, /ran before that job started or after it ended/);
  const edge = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("job-price-1", 6000, 9000)] }),
    part(1, "the heading", "done", { prepRun: prepOf(1200, 6000, { from: 4000, to: 6000, calls: 2 }) }),
  ]));
  assert.equal(edge.ok, false, "a step ending the moment the job began was taken as overlap");
});

test("NEGATIVE — SEQUENTIAL EXECUTION: jobs one after another, each part prepared only once the one before had ended (run 113's job rows), do not pass", () => {
  const v = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("251047aa", 1000, 2000)] }),
    part(1, "the heading", "done", { prepRun: prepOf(2100, 2500, { from: 2200, to: 2500, calls: 1 }), runs: [ran("ff717aaa", 2600, 3000)] }),
    part(2, "the footer link", "done", { prepRun: prepOf(3100, 3300, { from: 3150, to: 3300, calls: 1 }), runs: [ran("c6cbaaaa", 3400, 4000)] }),
  ]));
  assert.equal(v.ok, false);
  assert.deepEqual(v.overlaps, []);
  // A PART'S OWN JOB IS NOT ANOTHER PART'S.
  const own = overlapVerdict(stepWith([part(1, "the heading", "done", { prepRun: prepOf(1000, 5000, { from: 2000, to: 4000, calls: 2 }), runs: [ran("own", 1500, 4500)] })]));
  assert.equal(own.ok, false);
});

test("NEGATIVE — ROUTING ONLY: a preparation that only routed (no step), or a step that made no model call, beside another part's executing job does not pass, and is named as routing", () => {
  const routed = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("job-price-1", 1000, 9000)] }),
    part(1, "the footer link", "waiting", { prepRun: prepOf(2000, 3000, null, "routed") }),
  ]));
  assert.equal(routed.ok, false);
  assert.equal(routed.routingOnly.length, 1);
  assert.match(routed.why, /only a routing ran beside another part's job \(part 1 beside part 0's job\); no step's work did/);
  const noCall = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("job-price-1", 1000, 9000)] }),
    part(1, "the heading", "done", { prepRun: prepOf(2000, 5000, { from: 3000, to: 5000, calls: 0 }) }),
  ]));
  assert.equal(noCall.ok, false, "a step with no model call was taken as substantive");
});

test("NEGATIVE — MISSING EVIDENCE: no view, an unsent message, a view with no intervals, and malformed intervals all fail, never pass", () => {
  assert.match(overlapVerdict([]).why, /first message was not sent/);
  assert.match(overlapVerdict([{ sent: true, request: { key: K } }]).why, /missing evidence: the request's view was never read/);
  const bare = overlapVerdict(stepWith([part(0, "the price", "done"), part(1, "the heading", "done", { prep: "prepared" })]));
  assert.equal(bare.ok, false);
  assert.match(bare.why, /missing evidence: the view records no preparation and no job execution interval/);
  // THE OLD TRAIL'S STATUS READINGS ARE NOT EVIDENCE (Codex's reproduction:
  // preparing beside queued, prepared beside queued).
  for (const prep of ["preparing", "prepared"]) {
    const trail = [{ ms: 1000, parts: [[0, "queued"], [1, "ready"]], prep: [[1, prep]] }];
    const v = overlapVerdict(stepWith([part(0, "the price", "queued"), part(1, "the heading", "ready", { prep })], { trail }));
    assert.equal(v.ok, false, `${prep} beside queued passed`);
  }
  const junk = overlapVerdict(stepWith([
    part(0, "the price", "done", { runs: [ran("a", "1000", 9000), ran("b", 9000, 1000), null] }),
    part(1, "the heading", "done", { prepRun: prepOf(1, 2, { from: "4000", to: 6000, calls: 2 }) }),
  ]));
  assert.equal(junk.ok, false);
  // THE LAST VIEW OF THE FIRST MESSAGE'S REQUEST IS READ, across steps; another request's view is not.
  const later = overlapVerdict([
    { sent: true, request: { key: K, final: view(K, [part(0, "p", "started"), part(1, "h", "ready")]) } },
    { sent: true, request: { key: K, final: view(K, [part(0, "p", "done", { runs: [ran("j", 1000, 9000)] }), part(1, "h", "done", { prepRun: prepOf(1, 2, { from: 4000, to: 6000, calls: 1 }) })]) } },
  ]);
  assert.equal(later.ok, true, later.why);
  const other = overlapVerdict([
    { sent: true, request: { key: K, final: view(K, [part(0, "p", "started")]) } },
    { sent: true, request: { key: RQ_KEY(8), final: view(RQ_KEY(8), [part(0, "p", "done", { runs: [ran("j", 1000, 9000)] }), part(1, "h", "done", { prepRun: prepOf(1, 2, { from: 4000, to: 6000, calls: 1 }) })]) } },
  ]);
  assert.equal(other.ok, false, "another request's intervals were read as this one's");
});

test("the press's verdict carries the interval check only when the scenario asks for it", () => {
  const spec = { steps: [{ say: "x" }], expect: { overlap: true } };
  const named = "message 1: a part's prepared step ran while another part's job or prepared step was executing, by their recorded intervals";
  const good = stepWith([part(0, "p", "done", { runs: [ran("j", 1000, 9000)] }), part(1, "h", "done", { prepRun: prepOf(1, 2, { from: 4000, to: 6000, calls: 1 }) })]);
  const c = requestBatchVerdict({ spec, steps: good }).checks.find((x) => x.name === named);
  assert.ok(c, "no overlap check");
  assert.equal(c.ok, true, c.why);
  const bad = stepWith([part(0, "p", "queued"), part(1, "h", "ready", { prep: "prepared" })]);
  assert.equal(requestBatchVerdict({ spec, steps: bad }).checks.find((x) => x.name === named).ok, false);
  assert.equal(requestBatchVerdict({ spec, steps: [] }).checks.find((x) => x.name === named).ok, false);
  const off = requestBatchVerdict({ spec: { steps: [{ say: "x" }], expect: {} }, steps: good });
  assert.equal(off.checks.some((x) => x.name === named), false, "a press that does not ask is judged on it");
  // THE TIMELINE IT READ GOES TO THE PRESS, which prints it in its own log.
  const tl = requestBatchVerdict({ spec, steps: good }).timeline;
  assert.ok(Array.isArray(tl) && tl.some((l) => /part 1 prep #1/.test(l)) && tl.some((l) => /part 0 job j /.test(l)), JSON.stringify(tl));
  assert.equal(off.timeline, undefined);
  const press = fs.readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");
  const at = press.indexOf("THE REQUEST'S TIMELINE"), checks = press.indexOf("for (const c of requests.checks) check(c.name, c.ok, c.why);");
  assert.ok(at > 0 && checks > 0 && at > checks && /for \(const line of requests\.timeline\) console\.log\(line\)/.test(press.slice(at, at + 300)), "the press does not print the timeline after its checks");
});

// ── THE WHOLE PRESS, OFFLINE, THROUGH THE REAL CANARY DRIVER ─────────────────
//
// lv-parallel as written, driven by `runUi` against the stand-in app: message
// 1 ends on the footer link's question while the price's job runs and the
// heading is prepared beside it; the answer is sent with its tab closed once a
// progress line shows live, and followed to its end in a fresh browser
// session. Then the press's own verdicts — progress, replies, the interval
// check, the row kept — and its money, reconciled to the charges.

const PK = RQ_KEY(9);
const W0 = "Add a link to our LinkedIn page in the footer";
const W1 = "change the Sea Salt Focaccia's price to £4.60";
const W2 = "change the Order page heading 'Pick your loaf and a collection time' to 'Choose a loaf and a time to collect it'";
const said = (what) => ({ planned: `I'll ${what}.`, doing: `I'm going to ${what} now.`, waiting: `I need an answer before I ${what}.`, unconfirmed: `I tried to ${what}.`, done: `I've managed to ${what}.`, partial: `I did part of: ${what}.`, notdone: `I couldn't ${what}.` });
const S0 = said("add the LinkedIn link"), S1 = said("change the focaccia's price"), S2 = said("change the Order heading");
const LN = (n, text, ms) => ({ n, ms, text });
const Y1 = "I'm adding your LinkedIn link to the footer on every page.";
// THE RECORDED INTERVALS (ms on one clock): the footer link's add-on job asked
// [1000, 3000]; the price's job ran [3500, 9000]; the heading was prepared
// [1200, 6000], its step [4000, 6000] with two model calls — inside the price's
// job — then its own job [9100, 12000]; the answer's menu job [13000, 15000].
const PREP2 = { seq: 1, from: 1200, to: 6000, outcome: "ready", step: { from: 4000, to: 6000, calls: 2 } };
const RUNS = { y1: [1000, 3000], p1: [3500, 9000], h1: [9100, 12000], y2: [13000, 15000] };
const runsOf = (...jobs) => jobs.map((j) => ({ job: j, from: RUNS[j][0], to: RUNS[j][1] }));
const ASK = { id: "q-li", text: "What is the address of your LinkedIn page?", options: [] };
const P0 = (status, over = {}) => part(0, W0, status, { said: S0, ...over });
const P1 = (status, over = {}) => part(1, W1, status, { said: S1, ...over });
const P2 = (status, over = {}) => part(2, W2, status, { said: S2, ...over });
const WAITS = () => P0("waiting", { route: "addon", ids: ["y1"], jobs: ["y1"], question: ASK, runs: runsOf("y1") });
const DONE1 = () => P1("done", { route: "data", ids: ["p1"], jobs: ["p1"], runs: runsOf("p1") });
const DONE2 = () => P2("done", { route: "text", ids: ["h1"], jobs: ["h1"], prepRun: PREP2, runs: runsOf("h1") });
// MESSAGE 1: the footer link asks WHILE the price's job runs and the heading is
// prepared beside it; the heading's job then runs; the message ends on the
// question once nothing else is running (the driver's own rule).
const M1_VIEWS = [
  view(PK, [P0("started", { route: "addon", ids: ["y1"] }), P1("ready", { prep: "preparing" }), P2("ready", { prep: "preparing" })]),
  view(PK, [P0("started", { route: "addon", ids: ["y1"] }), P1("ready", { prep: "preparing" }), P2("ready", { prep: "preparing" })]),
  view(PK, [WAITS(), P1("started", { route: "data", ids: ["p1"], runs: [{ job: "p1", from: 3500, to: null }] }), P2("ready", { prep: "preparing", prepRun: { seq: 1, from: 1200, to: null, outcome: "", step: null } })]),
  view(PK, [WAITS(), P1("started", { route: "data", ids: ["p1"], runs: [{ job: "p1", from: 3500, to: null }] }), P2("ready", { prep: "prepared", prepRun: PREP2 })]),
  view(PK, [WAITS(), DONE1(), P2("started", { route: "text", ids: ["h1"], prepRun: PREP2, runs: [{ job: "h1", from: 9100, to: null }] })]),
  view(PK, [WAITS(), DONE1(), DONE2()]),
];
// MESSAGE 2, THE ANSWER: the footer part resumed on the menu step, a progress
// line live on it, then done and the request ended.
const RESUMED = (over = {}) => P0("started", { route: "nav", addition: true, ids: ["y1", "y2"], jobs: ["y1"], runs: runsOf("y1"), ...over });
const M2_VIEWS = [
  view(PK, [RESUMED(), DONE1(), DONE2()]),
  view(PK, [RESUMED(), DONE1(), DONE2()]),
  view(PK, [RESUMED({ progress: [LN(0, Y1, 2000)] }), DONE1(), DONE2()]),
  view(PK, [RESUMED({ progress: [LN(0, Y1, 2000)] }), DONE1(), DONE2()]),
  view(PK, [P0("done", { route: "nav", addition: true, ids: ["y1", "y2"], jobs: ["y1", "y2"], runs: runsOf("y1", "y2"), progress: [LN(0, Y1, 2000)] }), DONE1(), DONE2()], { ended: true }),
];
const LP_REPLIES = {
  y1: { ok: false, clarify: { id: ASK.id, text: ASK.text } },
  p1: { ok: true, msg: "✅ Updated.", reply: "The Sea Salt Focaccia is now £4.60 on your Order page.", replySource: "model" },
  h1: { ok: true, msg: "✅ Changed.", reply: "Your Order page heading now reads “Choose a loaf and a time to collect it”.", replySource: "model" },
  y2: { ok: true, msg: "✅ Added.", reply: "Every page's footer now links to your LinkedIn page.", replySource: "model" },
};
// THE BAKERY'S TABLE, as both readers serve it: the focaccia at 4.5 until the
// price's job has run (here: once the message is sent), 4.6 after.
function loaves(h) {
  const rows = () => LP.row.record.map((r) => ({ ...r, price: r.id === 6 && h.server.key ? Number(LP.row.to) : r.price }));
  const io = { reads: 0 };
  io.owner = async () => { io.reads++; return { status: 200, json: { rows: rows().map((r) => ({ ...r, price: String(r.price) })) } }; };
  io.pub = async () => { io.reads++; return { status: 200, text: JSON.stringify(rows()) }; };
  io.patch = async () => { throw new Error("the owner route's write was reached"); };
  io.lines = () => [...rows()].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `${r.name} £${Number(r.price).toFixed(2)} · ${r.description}`);
  return io;
}
const FRESH_ACCOUNT = { access_token: "fresh-token", refresh_token: "fresh-r", expires_at: 2_000_000_000, user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c" } };
function lpPress(over = {}) {
  let io = null;
  const h = rqApp({
    progress: true, fresh: true, replies: LP_REPLIES, answerViews: M2_VIEWS,
    send: () => ({ request: { key: PK, views: M1_VIEWS }, route: { intent: "addon" } }),
    shown: () => io.lines(),
    ...over,
  });
  io = loaves(h);
  const listed = async () => { const r = await h.requestsNow(); return { ...r, json: { ...r.json, jobs: [] } }; };
  const run = (o = {}) => drive(h, LP, {
    requestsNow: listed, freshSession: async () => FRESH_ACCOUNT, balanceNow: async () => 30,
    rows: { owner: io.owner, pub: io.pub, patch: io.patch }, siteOrigin: SITE, shownMs: 50,
    firstLineMs: 2_000, freshAwayMs: 5, stepMs: 4_000, stepCapMs: 4_000, ...o,
  });
  return { h, io, run };
}
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.why}`);

test("END TO END, OFFLINE: lv-parallel through the real canary driver — the question asked while the price's job runs; the answer sent with its tab closed and followed in a fresh session; every reply recovered; the row kept with no write; the interval check, the progress checks and the money all pass", async () => {
  const { h, run } = lpPress();
  const rec = await run();
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  // MESSAGE 1: ended on the footer link's question, with the price's job running beside it.
  const [s1, s2] = rec.steps;
  assert.equal(s1.mode, "question");
  assert.deepEqual({ by: s1.question.by, part: s1.question.part, id: s1.question.id }, { by: "step", part: 0, id: ASK.id });
  // THE QUESTION WAS ON SCREEN WHILE UNRELATED WORK WENT ON: a reading of the
  // request with part 0 waiting and the price's job running.
  assert.ok(s1.request.trail.some((x) => x.parts.some(([n, st]) => n === 0 && st === "waiting") && x.parts.some(([n, st]) => n === 1 && st === "started")),
    "the question was not asked while unrelated work went on: " + JSON.stringify(s1.request.trail));
  // MESSAGE 2: the answer resumed that part; its tab closed while it ran; the list alone read; a fresh session followed it to the end.
  assert.equal(s2.mode, "fresh");
  const f = s2.fresh;
  assert.equal(f.first.part, 0);
  assert.equal(f.first.line, Y1);
  assert.equal(f.closedRunning, true);
  assert.ok(f.away.reads > 0 && f.away.calls.length === 0);
  assert.equal(f.reopened.newSession, true);
  assert.equal(f.reopened.sameAccount, true);
  assert.equal(f.reopened.closed, true);
  assert.ok(h.contexts.some((c) => c.inits.some((i) => { try { return JSON.parse(i.value).access_token === "fresh-token"; } catch { return false; } })), "no context was planted with the fresh session");
  // THE PRESS'S CHECKS.
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  const ov = overlapVerdict(rec.steps);
  assert.equal(ov.ok, true, ov.why);
  assert.deepEqual(ov.overlaps.map((o) => [o.prepPart, o.runPart, o.job]), [[2, 1, "p1"]]);
  const v = requestBatchVerdict({ spec: LP, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  const named = (re) => v.checks.filter((c) => re.test(c.name));
  assert.ok(named(/fresh browser session, signed in afresh/).length === 1, "the progress checks are not in the press's verdict");
  assert.deepEqual(failed(named(/fresh browser session|progress line|model's own line|tab that sent it|no page open|recorded intervals/)), []);
  assert.deepEqual(failed(v.replies), []);
  // THE ROW: the one expected change, read on both readers and on the page, and KEPT — no write of any kind.
  assert.equal(rec.row.change.exact, true, JSON.stringify(rec.row.change));
  assert.equal(rec.row.shown.afterEdit.verdict.ok, true, JSON.stringify(rec.row.shown.afterEdit.verdict));
  assert.match(rec.row.restore.skipped, /keeps what the message changed/);
  assert.equal(rec.row.writes, undefined, "the run tried to write the row");
  assert.equal(rec.row.capability, undefined, "the probe ran on a kept row");
  // THE MONEY: routing 2 for the message and 1 for the answer, and the jobs' own charges — data 1, text 1 — with the add-on's hand-over `none`.
  const calls = routeCallsOf(rec.steps);
  assert.deepEqual(calls.map((c) => c.cost), [2, 1]);
  const job = (id, billing, cost, ledger) => ({ job: id, row: { billing, cost }, ledgerRead: { ok: true }, ledger });
  const jobs = [job("y1", "none", 0, []), job("p1", "finalized", 1, [{ delta: -1 }]), job("h1", "finalized", 1, [{ delta: -1 }]), job("y2", "finalized", 2, [{ delta: -2 }])];
  const money = ownMoneyVerdict({ start: 30, end: 30 - 3 - 4, calls, routeRows: { ok: true, rows: [] }, jobs, window: { ok: true, rows: [] }, prior: [] });
  assert.equal(money.ok, true, money.why);
  assert.deepEqual([money.routing, money.edits, money.own, money.spent], [3, 4, 7, 7]);
  // A CHARGE NOT ACCOUNTED FOR IS SEEN: the balance moved one more than the press's own.
  const short = ownMoneyVerdict({ start: 30, end: 22, calls, routeRows: { ok: true, rows: [] }, jobs, window: { ok: true, rows: [{ id: 1, delta: -1, ref: "elsewhere" }] }, prior: [] });
  assert.equal(short.own, 7);
  assert.equal(short.spent, 8);
});

test("END TO END, OFFLINE, NEGATIVE: the same press with the heading prepared only after the price's job ended fails the interval check and nothing else", async () => {
  const late = { ...PREP2, from: 9050, to: 9090, step: { from: 9060, to: 9090, calls: 2 } };
  const swap = (vs) => vs.map((x) => ({ ...x, parts: x.parts.map((p) => (p.prepRun && p.prepRun.step ? { ...p, prepRun: late } : p)) }));
  const { run } = lpPress({ answerViews: swap(M2_VIEWS) });
  const rec = await run();
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const ov = overlapVerdict(rec.steps);
  assert.equal(ov.ok, false);
  assert.match(ov.why, /did not overlap another part's job/);
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
});

// ── TWO PREPARATIONS AT ONCE, EVERY ATTEMPT, AND THE READABLE TIMELINE ───────
// (2026-10-09, diagnosing run 117)

test("TWO PARTS' PREPARED STEPS AT ONCE pass — the work itself ran together, even with no job beside it; routing beside a step, or one part's two attempts, do not", () => {
  const both = overlapVerdict(stepWith([
    part(0, "the price", "queued"),
    part(1, "the photo", "ready", { prepRun: prepOf(1000, 9000, { from: 2000, to: 8000, calls: 2 }) }),
    part(2, "the heading", "ready", { prepRun: prepOf(1500, 9500, { from: 3000, to: 7000, calls: 1 }) }),
  ]));
  assert.equal(both.ok, true, both.why);
  assert.deepEqual(both.overlaps, []);
  assert.deepEqual(both.together.map((t) => [t.parts, t.ms]), [[[1, 2], 4000]]);
  assert.match(both.said, /parts 1 and 2's prepared steps ran together for 4 s/);
  // A ROUTING BESIDE A STEP IS NOT TWO PIECES OF WORK.
  const routed = overlapVerdict(stepWith([
    part(1, "the photo", "ready", { prepRun: prepOf(1000, 9000, { from: 2000, to: 8000, calls: 2 }) }),
    part(2, "the heading", "ready", { prepRun: prepOf(1500, 9500, null, "routed") }),
  ]));
  assert.equal(routed.ok, false);
  // RUN 117'S SHAPE: the second preparation began after the first had ended.
  const serial = overlapVerdict(stepWith([
    part(1, "the footer link", "waiting", { prepRun: prepOf(5000, 33000, { from: 19700, to: 31800, calls: 1 }, "stopped") }),
    part(2, "the heading", "done", { prepRun: prepOf(36200, 49200, { from: 37000, to: 48000, calls: 1 }) }),
    part(0, "the price", "done", { runs: [ran("524dd74b", 57500, 82500)] }),
  ]));
  assert.equal(serial.ok, false);
  assert.match(serial.why, /nor another part's prepared step/);
  // ONE PART'S TWO ATTEMPTS ARE NOT TWO PARTS.
  const self = overlapVerdict(stepWith([part(1, "the photo", "ready", { prepRuns: [prepOf(1000, 5000, { from: 2000, to: 4000, calls: 1 }), { ...prepOf(3000, 9000, { from: 3500, to: 8000, calls: 1 }), seq: 2 }] })]));
  assert.equal(self.ok, false);
});

test("EVERY ATTEMPT IS READ: an earlier attempt's step that overlapped a job passes even when the latest attempt did not", () => {
  const earlier = { ...prepOf(1000, 6000, { from: 2000, to: 5000, calls: 1 }), seq: 1 };
  const latest = { ...prepOf(20000, 25000, { from: 21000, to: 24000, calls: 1 }), seq: 2 };
  const parts = [part(0, "the price", "done", { runs: [ran("job-price-1", 1500, 9000)] }), part(1, "the photo", "done", { prepRun: latest, prepRuns: [earlier, latest] })];
  assert.equal(overlapVerdict(stepWith(parts)).ok, true, "an earlier attempt's overlap was lost");
  const onlyLatest = [parts[0], part(1, "the photo", "done", { prepRun: latest })];
  assert.equal(overlapVerdict(stepWith(onlyLatest)).ok, false, "CONTROL: the latest alone does not overlap");
});

test("THE TIMELINE prints every attempt and every job in clock order, from the request's acceptance, and says when nothing was recorded", () => {
  const v = { ...view(K, [
    part(0, "the price", "done", { route: "data", runs: [ran("524dd74bbdc1", 1791587312704, 1791587337756)] }),
    part(1, "the footer link", "waiting", { prepRun: { seq: 1, sent: 1791587255207, from: 1791587260196, to: 1791587288195, outcome: "stopped", step: { from: 1791587274922, to: 1791587286978, calls: 1 } } }),
    part(2, "the heading", "done", { route: "text", prepRun: { seq: 1, sent: null, from: 1791587291403, to: 1791587304393, outcome: "routed", step: null } }),
  ]), at: 1791587255207 };
  const lines = requestTimeline(v);
  assert.match(lines[0], /accepted 23:07:35\.207 UTC/);
  assert.deepEqual(lines.slice(1).map((l) => l.trim()), [
    "part 1 prep #1: claimed +0.0s, taken +5.0s, step +19.7s–+31.8s (1 model call(s)), answered +33.0s, stopped",
    "part 2 prep #1: claimed ?, taken +36.2s, no step, answered +49.2s, routed",
    "part 0 job 524dd74b (data): ran +57.5s–+82.5s",
  ]);
  assert.match(requestTimeline({ ...view(K, [part(0, "x", "queued")]), at: 1 })[1], /no preparation and no job execution interval recorded/);
  assert.match(requestTimeline(null)[0], /no request view/);
});
