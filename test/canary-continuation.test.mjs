// A CONTINUED REQUEST'S HISTORY IS NOT THIS PRESS'S ACTIVITY (2026-10-08,
// Codex's review of 64148e83). Run 109 answered a question run 107 had left
// waiting; its request's view lists run 107's jobs too, and the canary took
// them all as its own: routing 3 + jobs 2 + 3 + 1 = 9 against the balance's
// move of 4, and run 107's publish left last made the wait target and the
// parent check point backward. The press's baseline is now the request's jobs
// as the gate read them just before Send; this press's activity is what the
// request gained after it, the whole history kept apart. The same attribution
// feeds the charges, the published versions, the wait target and the later
// read, which also reads every job (`parts[].ids`), not only those with a
// reply shown (`parts[].jobs`), and keeps its rows when the snapshot failed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  pressJobsOf, requestJobsOf, ownMoneyVerdict, laterChargesVerdict, laterChargesSaid,
  chainOrdered, chainTarget, chainVerdict, routeCallsOf, waitingCheck, answerExpectation,
} from "../scripts/canary-ui.mjs";
import { publishedVersion } from "../scripts/canary-watch.mjs";

const EV = JSON.parse(fs.readFileSync(new URL("./fixtures/run109-evidence.json", import.meta.url), "utf8"));
const SLUG = EV.slug;
const versions = (rows) => ({ status: 200, json: { versions: rows } });
// THE CALLER'S OWN STEPS: each job filed, its publish found by its own id, put in order.
const publishesOf = (jobs, list, before) => chainOrdered(before, jobs.map((job) => ({ job, ...publishedVersion(list, job) })).filter((p) => p.ok).map((p) => ({ n: 1, job: p.job, id: p.id, parent: p.parent })));
const recordsFor = (jobs) => EV.jobRecords.filter((r) => jobs.includes(r.job));
const callsOf = (idem, cost) => routeCallsOf([{ network: [{ method: "POST", path: "/api/site/route", req: { idem, slug: SLUG }, res: { cost } }] }]);
const pages = (version) => Object.fromEntries(EV.afterPages.map((p) => [p, { version }]));
const RUN107_JOBS = requestJobsOf(EV.baselineAtGate);
// WHAT THE SNAPSHOT COUNTED: the answer's routing row and this press's job rows (408 and 409).
const COUNTED = EV.ledgerWindow;
const OWN = () => pressJobsOf(EV.finalView, { prior: RUN107_JOBS }).jobs;
const freshOwn = (over = {}) => recordsFor(OWN()).map((r) => over[r.job] || r);

test("CONT 1 — run 109 replayed: the live verdict reproduced as it was, then corrected offline — 4 credits, one publish, the chain verified", () => {
  const calls = callsOf(EV.answerRoute.idem, EV.answerRoute.cost);
  const routeRows = { ok: true, rows: EV.ledgerWindow.filter((r) => r.ref.startsWith("route:")) };
  const window = { ok: true, rows: EV.ledgerWindow };
  const list = versions(EV.versions);
  const all = requestJobsOf(EV.finalView);
  assert.equal(all.length, 6, "the final view does not list the whole history");

  // AS RUN 109 READ IT (its original verdict, kept): every job of the request taken as its own.
  const live = ownMoneyVerdict({ start: EV.balance.start, end: EV.balance.end, calls, routeRows, jobs: recordsFor(all), window });
  assert.equal(live.ok, false);
  assert.equal(live.own, 9);
  assert.match(EV.live.moneyCheck, /routing 3 \+ jobs 6 = 9, are more than the balance's move of 4/);
  assert.match(live.why, /routing 3 \+ jobs 6 = 9, are more than the balance's move of 4/);
  const livePub = publishesOf(all, list, EV.beforeVersion);
  assert.deepEqual(livePub.map((p) => p.id), ["01791429280760-09n7s1", "01791417187002-f821gr"], "the live list is not what run 109 printed");
  assert.equal(livePub[livePub.length - 1].id, "01791417187002-f821gr", "the live wait target was the last listed, run 107's publish");
  assert.equal(chainVerdict({ before: EV.beforeVersion, published: livePub, wait: { kind: "match" }, after: pages(EV.afterVersion) }).why, "parent-mismatch");

  // CORRECTED OFFLINE: the baseline the gate read before Send is history.
  const own = pressJobsOf(EV.finalView, { prior: RUN107_JOBS });
  assert.deepEqual(own.jobs, ["30a0ad5c70a881c81fe7d4ee74323353", "90bc2b2d568b9fe89f16e0476b7fb38f"]);
  assert.deepEqual(own.requestJobs, all, "the request's whole history is not kept");
  const money = ownMoneyVerdict({ start: EV.balance.start, end: EV.balance.end, calls, routeRows, jobs: recordsFor(own.jobs), window, prior: RUN107_JOBS });
  assert.equal(money.ok, true, money.why);
  assert.deepEqual([money.routing, money.edits, money.own, money.spent, money.excess], [3, 1, 4, 4, 0]);
  assert.deepEqual(money.others.rows, [], "the press's own rows read as someone else's");
  const pub = publishesOf(own.jobs, list, EV.beforeVersion);
  assert.deepEqual(pub.map((p) => p.id), ["01791429280760-09n7s1"]);
  assert.equal(chainTarget(EV.beforeVersion, pub), EV.afterVersion);
  const chain = chainVerdict({ before: EV.beforeVersion, published: pub, wait: { kind: "match" }, after: pages(EV.afterVersion) });
  assert.deepEqual([chain.verified, chain.target, chain.links], [true, EV.afterVersion, 1]);
  // THE LATER READ: no row after the press, the request ended, settled at 4.
  const later = laterChargesVerdict({ snapshot: money.own, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: EV.ledgerAfter }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn() });
  assert.deepEqual([later.ok, later.total, later.ended, later.reconciled, later.settled, later.later.length, later.duplicates.length], [true, 4, true, true, true, 0, 0]);
});

test("CONT 2 — the baseline is read at the gate: waitingCheck carries the request's jobs as they stand, and a fresh request has none", () => {
  const x = answerExpectation({ key: EV.requestKey, part: 1, question: "What’s the full address of your TikTok profile?", id: "a00872db7f0459d0fd270d6029e611ae", askedAt: "2026-10-07T23:59:18Z" });
  const w = waitingCheck({ status: 200, json: { requests: [EV.baselineAtGate] } }, x, { now: Date.parse("2026-10-08T03:13:00Z") });
  assert.equal(w.why, "");
  assert.deepEqual(w.waiting.jobs, RUN107_JOBS);
  // AN ORDINARY FRESH REQUEST: no baseline, so every job its view names is this press's.
  const fresh = { key: "f".repeat(32), ended: true, parts: [{ n: 0, ids: ["a1", "a2"] }, { n: 1, ids: ["b1"] }] };
  assert.deepEqual(pressJobsOf(fresh), { requestJobs: ["a1", "a2", "b1"], jobs: ["a1", "a2", "b1"] });
});

test("CONT 3 — hand-overs and repeated observations: a hand-over's two jobs are both this press's; the same view read twice, or a second message of the same press, adds no job twice", () => {
  const view = { key: "k", parts: [{ n: 0, ids: ["route1", "addon1", "nav1"] }] };
  const first = pressJobsOf(view);
  assert.deepEqual(first.jobs, ["route1", "addon1", "nav1"]);
  assert.deepEqual(pressJobsOf(view), first, "a second read of the same view answered differently");
  const dup = { key: "k", parts: [{ n: 0, ids: ["route1", "addon1"] }, { n: 1, ids: ["addon1", "nav1"] }] };
  assert.deepEqual(pressJobsOf(dup).jobs, ["route1", "addon1", "nav1"], "a job named twice was counted twice");
  // A LATER MESSAGE OF THE SAME PRESS takes only what the earlier did not.
  const second = { key: "k", parts: [{ n: 0, ids: ["route1", "addon1", "nav1"] }, { n: 1, ids: ["nav2"] }] };
  assert.deepEqual(pressJobsOf(second, { earlier: first.jobs }).jobs, ["nav2"]);
});

test("CONT 4 — several publishes of this press, listed out of order, are put in order; the wait is the last of the chain", () => {
  const B = "01791400000000-before";
  const list = versions([
    { id: "01791400000300-third", parent: "01791400000200-second", job: "j3" },
    { id: "01791400000100-first", parent: B, job: "j1" },
    { id: "01791400000200-second", parent: "01791400000100-first", job: "j2" },
  ]);
  const pub = publishesOf(["j3", "j1", "j2"], list, B);
  assert.deepEqual(pub.map((p) => p.job), ["j1", "j2", "j3"]);
  assert.equal(chainTarget(B, pub), "01791400000300-third");
  assert.equal(chainVerdict({ before: B, published: pub, wait: { kind: "match" }, after: { "/": { version: "01791400000300-third" } } }).verified, true);
});

test("CONT 5 — a genuine parent mismatch is still named: this press's own publish built from a version the before-read did not see", () => {
  const B = "01791400000000-before";
  const list = versions([{ id: "01791400000100-mine", parent: "01791399999999-elsewhere", job: "j1" }]);
  const pub = publishesOf(["j1"], list, B);
  assert.equal(chainTarget(B, pub), "01791400000100-mine", "nothing joins, so the last listed is still waited on");
  const v = chainVerdict({ before: B, published: pub, wait: { kind: "match" }, after: { "/": { version: "01791400000100-mine" } } });
  assert.deepEqual([v.verified, v.why, v.expected], [false, "parent-mismatch", B]);
  // AND A LEFTOVER BEHIND A GOOD LINK: the wait goes to the chain's end, the leftover is still named.
  const both = publishesOf(["j0", "j1"], versions([{ id: "01791400000050-good", parent: B, job: "j0" }, { id: "01791400000100-mine", parent: "01791399999999-elsewhere", job: "j1" }]), B);
  assert.equal(chainTarget(B, both), "01791400000050-good");
  assert.equal(chainVerdict({ before: B, published: both, wait: { kind: "match" }, after: { "/": { version: "01791400000050-good" } } }).why, "parent-mismatch");
});

test("CONT 6 — a genuine duplicate is caught: an earlier job charged again while this press ran fails the money, and after it is told apart, never added", () => {
  const calls = callsOf(EV.answerRoute.idem, EV.answerRoute.cost);
  const routeRows = { ok: true, rows: EV.ledgerWindow.filter((r) => r.ref.startsWith("route:")) };
  const again = { id: 410, delta: -3, ref: "bd79395e015814699b6efc8d78256f51#2", at: "2026-10-08T03:15:00Z" };
  const own = pressJobsOf(EV.finalView, { prior: RUN107_JOBS });
  const m = ownMoneyVerdict({ start: 15, end: 8, calls, routeRows, jobs: recordsFor(own.jobs), window: { ok: true, rows: [...EV.ledgerWindow, again] }, prior: RUN107_JOBS });
  assert.equal(m.ok, false);
  assert.match(m.why, /earlier job of the continued request was charged again/);
  assert.deepEqual(m.duplicates.map((r) => r.id), [410]);
  // UNRELATED ACTIVITY is not a duplicate: told beside, and the press passes.
  const other = { id: 411, delta: -5, ref: "route:another-site:" + "9".repeat(32), at: "2026-10-08T03:15:00Z" };
  const u = ownMoneyVerdict({ start: 15, end: 6, calls, routeRows, jobs: recordsFor(own.jobs), window: { ok: true, rows: [...EV.ledgerWindow, other] }, prior: RUN107_JOBS });
  assert.equal(u.ok, true, u.why);
  assert.deepEqual([u.own, u.excess, u.others.recorded, u.others.rows.map((r) => r.id)], [4, 5, 5, [411]]);
  const later = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [again] }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn() });
  assert.deepEqual([later.total, later.later.length, later.duplicates.map((r) => r.id), later.reconciled, later.settled], [4, 0, [410], false, false]);
  assert.match(laterChargesSaid(later), /DUPLICATE: row 410/);
});

test("CONT 7 — late charges: a later part's routing under the request's key, a routing job only parts[].ids names, a current job's refund, and an open request", () => {
  const calls = callsOf(EV.answerRoute.idem, EV.answerRoute.cost);
  const lateRoute = { id: 412, delta: -2, ref: "route:" + SLUG + ":" + EV.requestKey, at: "2026-10-08T03:19:30Z" };
  const v = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [lateRoute] }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn() });
  assert.deepEqual([v.laterTotal, v.total, v.settled], [2, 6, true], "a later part's routing charge was missed");
  // A SECOND ROW UNDER THE ANSWER'S OWN, ALREADY COUNTED ROUTING CALL is not a late charge.
  const again = { id: 417, delta: -3, ref: "route:" + SLUG + ":" + EV.answerRoute.idem, at: "2026-10-08T03:19:31Z" };
  const u = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [again] }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn() });
  assert.deepEqual([u.total, u.unexpected.map((r) => r.id), u.reconciled], [4, [417], false]);
  // A CHARGED ROUTING JOB THAT ONLY parts[].ids NAMES (no reply was shown for it).
  const view = { key: "r".repeat(32), ended: true, parts: [{ n: 0, ids: ["routejob", "edit1"], jobs: ["edit1"] }] };
  const routeJobRow = { id: 413, delta: -3, ref: "routejob#1", at: "2026-10-08T03:19:40Z" };
  const fresh = [{ job: "routejob", row: { billing: "finalized", cost: 3 }, ledgerRead: { ok: true }, ledger: [routeJobRow] }, { job: "edit1", row: { billing: "none", cost: 0 }, ledgerRead: { ok: true }, ledger: [] }];
  const w = laterChargesVerdict({ snapshot: 2, slug: SLUG, keys: [view.key], rows: { ok: true, rows: [routeJobRow] }, list: { ok: true, requests: [view] }, counted: [], fresh });
  assert.deepEqual([w.laterTotal, w.total, w.settled], [3, 5, true], "the routing job's late charge was dropped");
  // A REFUND OF THIS PRESS'S OWN JOB, its record now refunded: told as a refund, and the total comes down.
  const refund = { id: 414, delta: 1, ref: "90bc2b2d568b9fe89f16e0476b7fb38f", at: "2026-10-08T03:20:00Z" };
  const refunded = { job: "90bc2b2d568b9fe89f16e0476b7fb38f", row: { billing: "refunded", cost: 1 }, ledgerRead: { ok: true }, ledger: [EV.ledgerWindow[1], refund] };
  const r = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [refund] }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn({ [refunded.job]: refunded }) });
  assert.deepEqual([r.laterTotal, r.total, r.refunds.map((x) => x.id), r.later.length, r.duplicates.length, r.settled], [-1, 3, [414], 0, 0, true]);
  assert.match(laterChargesSaid(r), /refunded on this press's jobs: row 414/);
  // AN OPEN REQUEST is never called final, however reconciled.
  const open = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [] }, list: { ok: true, requests: [{ ...EV.finalView, ended: false }] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn() });
  assert.deepEqual([open.reconciled, open.ended, open.settled, open.open], [true, false, false, [EV.requestKey]]);
});

test("CONT 8 — unreadable evidence: a failed snapshot keeps the later rows it read; an unreadable ledger or job record is never a zero", () => {
  const calls = callsOf(EV.answerRoute.idem, EV.answerRoute.cost);
  const row = { id: 415, delta: -1, ref: "90bc2b2d568b9fe89f16e0476b7fb38f#2", at: "2026-10-08T03:19:50Z" };
  // A LEGITIMATE DELAYED SETTLEMENT: the job's record now says 2, its ledger took 409 and 415.
  const settledLater = { job: "90bc2b2d568b9fe89f16e0476b7fb38f", row: { billing: "finalized", cost: 2 }, ledgerRead: { ok: true }, ledger: [EV.ledgerWindow[1], row] };
  const v = laterChargesVerdict({ snapshot: NaN, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows: [row] }, list: { ok: true, requests: [EV.finalView] }, calls, prior: RUN107_JOBS, counted: COUNTED, fresh: freshOwn({ [settledLater.job]: settledLater }) });
  assert.equal(v.ok, false);
  assert.equal(v.total, null, "a total was claimed without a snapshot");
  assert.deepEqual(v.later.map((r) => r.id), [415], "the rows read after the press were dropped with the snapshot");
  assert.match(laterChargesSaid(v), /UNSETTLED: the snapshot of this press's own charges was not read; later rows read: row 415/);
  const noRows = laterChargesVerdict({ snapshot: 4, slug: SLUG, keys: [EV.requestKey], rows: { ok: false, rows: null }, list: { ok: true, requests: [EV.finalView] } });
  assert.deepEqual([noRows.ok, noRows.settled], [false, false]);
  const own = pressJobsOf(EV.finalView, { prior: RUN107_JOBS });
  const blind = recordsFor(own.jobs).map((r) => (r.job.startsWith("90bc") ? { ...r, ledgerRead: { ok: false }, ledger: null } : r));
  const m = ownMoneyVerdict({ start: 15, end: 11, calls, routeRows: { ok: true, rows: EV.ledgerWindow.slice(0, 1) }, jobs: blind, window: { ok: true, rows: EV.ledgerWindow }, prior: RUN107_JOBS });
  assert.equal(m.ok, false);
  assert.match(m.why, /ledger could not be read/);
});

test("CONT 9 — refunds, extra debits, repeated rows, unrelated activity and unreadable records, each from the ledger and the job's own billing", () => {
  const calls = callsOf(EV.answerRoute.idem, EV.answerRoute.cost);
  const list = { ok: true, requests: [EV.finalView] };
  const read = (rows, fresh = freshOwn(), snapshot = 4) => laterChargesVerdict({ snapshot, slug: SLUG, keys: [EV.requestKey], rows: { ok: true, rows }, list, calls, prior: RUN107_JOBS, counted: COUNTED, fresh });
  // AN EARLIER JOB'S REFUND (positive, under its bare id) is an adjustment to that work: not a duplicate, not this press's spending.
  const priorRefund = { id: 420, delta: 3, ref: "bd79395e015814699b6efc8d78256f51", at: "2026-10-08T03:19:00Z" };
  const a = read([priorRefund]);
  assert.deepEqual([a.duplicates.length, a.priorAdjustments.map((r) => r.id), a.total, a.reconciled, a.settled], [0, [420], 4, true, true]);
  assert.match(laterChargesSaid(a), /ADJUSTED on an earlier request's jobs \(not this press's spending\): row 420/);
  assert.doesNotMatch(laterChargesSaid(a), /DUPLICATE/);
  // AN EXTRA DEBIT ON AN EARLIER, FINALIZED JOB: a duplicate, kept out of the total, and the charges are not reconciled.
  const priorExtra = { id: 421, delta: -3, ref: "bd79395e015814699b6efc8d78256f51#2", at: "2026-10-08T03:19:05Z" };
  const b = read([priorExtra]);
  assert.deepEqual([b.duplicates.map((r) => r.id), b.total, b.reconciled, b.settled], [[421], 4, false, false]);
  // CODEX'S REPRODUCTION: AN EXTRA DEBIT ON THIS PRESS'S FINALIZED FOOTER JOB, whose recorded cost is still 1.
  const curExtra = { id: 422, delta: -1, ref: "90bc2b2d568b9fe89f16e0476b7fb38f#2", at: "2026-10-08T03:19:10Z" };
  const stillOne = { job: "90bc2b2d568b9fe89f16e0476b7fb38f", row: { billing: "finalized", cost: 1 }, ledgerRead: { ok: true }, ledger: [EV.ledgerWindow[1], curExtra] };
  const c = read([curExtra], freshOwn({ [stillOne.job]: stillOne }));
  assert.equal(c.ok, true);
  assert.deepEqual([c.total, c.unexpected.map((r) => r.id), c.later.length, c.reconciled, c.settled], [4, [422], 0, false, false], "an extra debit on a settled job was taken as an ordinary late charge");
  assert.match(laterChargesSaid(c), /UNEXPECTED: row 422 [^(]*\(job 90bc2b2d568b9fe89f16e0476b7fb38f: its row says 1; the ledger took 2 and returned 0\)/);
  // THE SAME ROW, BUT THE JOB'S RECORD NOT READ AGAIN (its stale ledger has only 409): still unexpected, never added.
  const stale = read([curExtra]);
  assert.deepEqual([stale.total, stale.unexpected.map((r) => r.id), stale.settled], [4, [422], false]);
  // REPEATED OBSERVATIONS: rows the snapshot already counted, read again, are counted once.
  const d = read([...EV.ledgerWindow, ...EV.ledgerWindow]);
  assert.deepEqual([d.repeated, d.total, d.later.length, d.unexpected.length, d.settled], [4, 4, 0, 0, true]);
  // UNRELATED ACCOUNT ACTIVITY: another site's job and another request's routing are no part of it.
  const e = read([{ id: 423, delta: -5, ref: "ffff0000ffff0000ffff0000ffff0000#1" }, { id: 424, delta: -2, ref: "route:another-site:" + "9".repeat(32) }]);
  assert.deepEqual([e.total, e.later.length, e.unexpected.length, e.settled], [4, 0, 0, true]);
  // UNREADABLE OR UNSETTLED FINAL RECORDS: unverified, never a zero and never reconciled.
  const blind = { job: "90bc2b2d568b9fe89f16e0476b7fb38f", row: null, ledgerRead: { ok: false, why: "not read" }, ledger: [] };
  const f = read([], freshOwn({ [blind.job]: blind }));
  assert.deepEqual([f.unverified.map((u) => u.job), f.reconciled, f.ended, f.settled], [["90bc2b2d568b9fe89f16e0476b7fb38f"], false, true, false]);
  const pending = { job: "90bc2b2d568b9fe89f16e0476b7fb38f", row: { billing: "reserved", cost: 1 }, ledgerRead: { ok: true }, ledger: [EV.ledgerWindow[1]] };
  assert.deepEqual(read([], freshOwn({ [pending.job]: pending })).unverified.map((u) => u.job), ["90bc2b2d568b9fe89f16e0476b7fb38f"]);
  const missing = read([], freshOwn().filter((r) => !r.job.startsWith("90bc")));
  assert.match(missing.unverified[0].why, /was not read again/);
  assert.match(laterChargesSaid(missing), /charges NOT reconciled; UNVERIFIED: 90bc2b2d/);
});
