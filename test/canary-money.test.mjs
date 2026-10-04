// A PRESS'S MONEY, BY ITS OWN CHARGES (2026-10-04). The owner, told that the
// money check reads the balance's whole move, so that any other use of the
// account during a press fails it: *"yes do the fix but dont stop any of the
// runs pls"*.
//
// What is held here, on run 94's own recorded routing call and ledger rows
// (test/fixtures/run94-money.json, from its evidence and the ledger):
//   - the page's routing call carries the message's key and site, which make
//     the ref the Worker keeps its charge under (`route:<site>:<idem>`);
//   - the press's own charges are its routing calls (each keyed one matched to
//     its ledger row) and its jobs (row and ledger agreeing), and they must add
//     up and fit inside the balance's move;
//   - whatever else moved the balance meanwhile is told beside the check —
//     rows under other refs, and what no row records — and never fails it;
//   - a press whose own charges cannot be read or do not add up still fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { routeCallsOf, routeCostsOf, ownMoneyVerdict, ownMoneySaid, moneyVerdict, jobCharges } from "../scripts/canary-ui.mjs";
import { spentOf } from "../scripts/canary-batch.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const F = JSON.parse(fs.readFileSync(ROOT + "test/fixtures/run94-money.json", "utf8"));
const KEY = "03e480007a6f9a1416b6e42b813ce6cf";
const REF = `route:fold-lane-bakery:${KEY}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = (over = {}) => ({
  start: F.balance.start, end: F.balance.end,
  calls: routeCallsOf(F.steps),
  routeRows: { ok: true, rows: clone(F.routeRows) },
  jobs: clone(F.jobs),
  window: { ok: true, rows: [...clone(F.routeRows), ...clone(F.jobs[0].ledger)] },
  ...over,
});

test("the real page's routing call carries the message's key and site: the ref is the one the ledger kept run 94's charge under", () => {
  const calls = routeCallsOf(F.steps);
  assert.deepEqual(calls, [{ ref: REF, cost: 3 }]);
  assert.equal(F.routeRows[0].ref, REF, "the fixture's ledger row is not under the call's own ref");
  assert.deepEqual(routeCostsOf(F.steps), [3], "the two readers disagree on the call's cost");
  // A call with no key, or no site, pays through the older gate: no ref.
  const noKey = [{ network: [{ method: "POST", path: "/api/site/route", req: { slug: "fold-lane-bakery" }, res: { cost: 2 } }] }];
  assert.deepEqual(routeCallsOf(noKey), [{ ref: "", cost: 2 }]);
  const noSite = [{ network: [{ method: "POST", path: "/api/site/route", req: { idem: KEY }, res: { cost: 2 } }] }];
  assert.deepEqual(routeCallsOf(noSite), [{ ref: "", cost: 2 }]);
  // Only the routing route's POSTs are routing calls; a body that is not an object has no key.
  const mixed = [{ network: [
    { method: "GET", path: "/api/site/route", req: { slug: "s", idem: "k" }, res: { cost: 9 } },
    { method: "POST", path: "/api/site/fold-lane-bakery/edit", req: { slug: "s", idem: "k" }, res: { cost: 9 } },
    { method: "POST", path: "/api/site/route", req: "raw", res: null },
  ] }];
  assert.deepEqual(routeCallsOf(mixed), [{ ref: "", cost: undefined }]);
  assert.deepEqual(routeCallsOf(null), []);
});

test("run 94's own money closes exactly on its own charges: routing 3 + its job's 1 = the balance's move of 4", () => {
  const m = ownMoneyVerdict(base());
  assert.equal(m.ok, true, m.why);
  assert.deepEqual({ spent: m.spent, routing: m.routing, edits: m.edits, own: m.own, excess: m.excess }, { spent: 4, routing: 3, edits: 1, own: 4, excess: 0 });
  assert.deepEqual(m.others, { recorded: 0, unrecorded: 0, rows: [] }, "the press's own rows were counted as someone else's");
  assert.equal(ownMoneySaid(m), "the balance moved 4, exactly this press's own charges");
  // And the balance-move check, still every other press's, agrees here.
  assert.equal(moneyVerdict({ start: 137, end: 133, routeCosts: routeCostsOf(F.steps), jobs: clone(F.jobs) }).ok, true);
});

test("another build spending on the account during the press is told beside the check, and does not fail it", () => {
  // The same press, with the balance also carrying the build's 6 (rows 358 and 359).
  const m = ownMoneyVerdict(base({ end: 127, window: { ok: true, rows: [...clone(F.routeRows), ...clone(F.jobs[0].ledger), ...clone(F.otherBuildRows)] } }));
  assert.equal(m.ok, true, m.why);
  assert.equal(m.own, 4);
  assert.equal(m.spent, 10);
  assert.equal(m.excess, 6);
  assert.deepEqual(m.others.rows.map((r) => [r.id, r.delta]), [[358, -2], [359, -4]]);
  assert.equal(m.others.recorded, 6);
  assert.equal(m.others.unrecorded, 0);
  assert.match(ownMoneySaid(m), /the balance moved 10: 4 this press's own, 6 other activity on the account meanwhile — 6 recorded under other refs \(build:872f9f7103764eab5a4e36374b2be161:deposit -2, build:872f9f7103764eab5a4e36374b2be161:settle -4\), 0 recorded nowhere/);
  // The old check fails this same press: that is the change.
  assert.equal(moneyVerdict({ start: 137, end: 127, routeCosts: [3], jobs: clone(F.jobs) }).ok, false);
});

test("a charge no ledger row records is told as recorded nowhere, and does not fail the press either", () => {
  const m = ownMoneyVerdict(base({ end: 130 }));
  assert.equal(m.ok, true, m.why);
  assert.equal(m.excess, 3);
  assert.deepEqual({ recorded: m.others.recorded, unrecorded: m.others.unrecorded }, { recorded: 0, unrecorded: 3 });
  assert.match(ownMoneySaid(m), /3 other activity on the account meanwhile — 0 recorded under other refs \(none\), 3 recorded nowhere/);
  // Unread, the ledger between the reads is said to be unread, never guessed.
  const u = ownMoneyVerdict(base({ end: 130, window: null }));
  assert.equal(u.ok, true);
  assert.equal(u.others, null);
  assert.match(ownMoneySaid(u), /the ledger between the balance reads could not be read/);
  const bad = ownMoneyVerdict(base({ end: 130, window: { ok: false, rows: null } }));
  assert.equal(bad.others, null);
});

test("the press fails when its own charges are more than left the balance, or cannot be read, or do not match the ledger", () => {
  const more = ownMoneyVerdict(base({ end: 134 }));
  assert.equal(more.ok, false);
  assert.match(more.why, /this press's own charges, routing 3 \+ jobs 1 = 4, are more than the balance's move of 3/);
  // The routing row under the call's own key took something else.
  const rows = clone(F.routeRows); rows[0].delta = -2;
  const mism = ownMoneyVerdict(base({ routeRows: { ok: true, rows } }));
  assert.equal(mism.ok, false);
  assert.match(mism.why, new RegExp(`the routing call under ${REF} answered 3; the ledger took 2`));
  // No row at all under a keyed call that cost something.
  assert.match(ownMoneyVerdict(base({ routeRows: { ok: true, rows: [] } })).why, /answered 3; the ledger took 0/);
  // A row under another key does not stand in for this one.
  const other = clone(F.routeRows); other[0].ref = "route:fold-lane-bakery:ffff";
  assert.equal(ownMoneyVerdict(base({ routeRows: { ok: true, rows: other } })).ok, false);
  // Unreadable rows, an amount that is not a number, an unreadable balance, a cost that is not a number.
  assert.match(ownMoneyVerdict(base({ routeRows: { ok: false, rows: null } })).why, /could not be read/);
  assert.match(ownMoneyVerdict(base({ routeRows: null })).why, /could not be read/);
  const nan = clone(F.routeRows); nan[0].delta = "x";
  assert.match(ownMoneyVerdict(base({ routeRows: { ok: true, rows: nan } })).why, /has no amount/);
  assert.match(ownMoneyVerdict(base({ start: -1 })).why, /could not be read at both ends/);
  assert.match(ownMoneyVerdict(base({ end: null })).why, /could not be read at both ends/);
  assert.match(ownMoneyVerdict(base({ calls: [{ ref: REF, cost: undefined }] })).why, /cost is not a number/);
  assert.match(ownMoneyVerdict(base({ calls: [{ ref: REF, cost: -1 }] })).why, /cost is not a number/);
  // A job whose row and ledger disagree.
  const jobs = clone(F.jobs); jobs[0].row.cost = 2;
  assert.match(ownMoneyVerdict(base({ jobs })).why, /job 82e2a76cfcb0d8dbc1e86bc162693c61: its row says 2; the ledger took 1/);
  const unread = clone(F.jobs); unread[0].ledgerRead = { ok: false };
  assert.match(ownMoneyVerdict(base({ jobs: unread })).why, /ledger could not be read/);
});

test("a second call under the same key is charged once; a call with no key counts its answered cost, with no row to read", () => {
  // The same message sent again (a lost response): the Worker answers the cost again but takes nothing more.
  const twice = ownMoneyVerdict(base({ calls: [{ ref: REF, cost: 3 }, { ref: REF, cost: 3 }] }));
  assert.equal(twice.ok, true, twice.why);
  assert.equal(twice.routing, 3, "a repeated key was counted twice");
  // A keyless call: counted from its answer; no row is asked for.
  const keyless = ownMoneyVerdict(base({ calls: [{ ref: REF, cost: 3 }, { ref: "", cost: 2 }], end: 131 }));
  assert.equal(keyless.ok, true, keyless.why);
  assert.equal(keyless.routing, 5);
  assert.equal(keyless.own, 6);
  assert.equal(keyless.excess, 0);
  // No keyed call at all: the routing rows are never needed.
  assert.equal(ownMoneyVerdict(base({ calls: [{ ref: "", cost: 3 }], routeRows: null })).ok, true);
  // A keyed call that cost nothing needs no row.
  assert.equal(ownMoneyVerdict(base({ calls: [{ ref: REF, cost: 0 }], routeRows: { ok: true, rows: [] }, end: 136 })).ok, true);
});

test("the press's own rows inside the window are never counted as someone else's: its routing key's and each job's", () => {
  const extraJob = { job: "aaaa1111bbbb2222cccc3333dddd4444", row: { billing: "finalized", cost: 2 }, ledgerRead: { ok: true }, ledger: [{ id: 400, delta: -2, ref: "aaaa1111bbbb2222cccc3333dddd4444#1" }] };
  const buildRow = { id: 401, delta: -5, ref: "build:aaaa1111bbbb2222cccc3333dddd4444:deposit" };
  const jobs = [...clone(F.jobs), { ...extraJob, ledger: [...extraJob.ledger, buildRow] }];
  jobs[1].row.cost = 7;
  const m = ownMoneyVerdict(base({
    jobs, end: 137 - 3 - 1 - 7,
    window: { ok: true, rows: [...clone(F.routeRows), ...clone(F.jobs[0].ledger), extraJob.ledger[0], buildRow] },
  }));
  assert.equal(m.ok, true, m.why);
  assert.equal(m.own, 11);
  assert.deepEqual(m.others, { recorded: 0, unrecorded: 0, rows: [] });
});

test("the batch counts each press's own charges when its money check passed, and the balance's move otherwise", () => {
  const rec = (money, start = 120, end = 100) => ({ ui: { balance: { start, end } }, requests: { money } });
  assert.equal(spentOf(rec({ ok: true, own: 14 })), 14, "the owner's own spending was counted as the batch's");
  assert.equal(spentOf(rec({ ok: true, own: 0 })), 0);
  assert.equal(spentOf(rec({ ok: false, own: 14 })), 20, "a failed money check's figure was trusted");
  assert.equal(spentOf(rec({ ok: true, own: -1 })), 20);
  assert.equal(spentOf(rec({ ok: true, own: "14" })), 20);
  assert.equal(spentOf(rec({ ok: true, own: NaN })), 20);
  assert.equal(spentOf(rec(null)), 20);
  assert.equal(spentOf({ ui: { balance: { start: 120, end: 100 } } }), 20);
  assert.equal(spentOf({ requests: { money: { ok: true, own: 7 } } }), 7);
});

test("the job logic the two money checks share is the old check's own", () => {
  assert.deepEqual(jobCharges(clone(F.jobs)), { ok: true, why: "", edits: 1 });
  assert.deepEqual(jobCharges([]), { ok: true, why: "", edits: 0 });
  assert.match(jobCharges([{ job: "j", row: null }]).why, /job j has no readable row/);
  assert.match(jobCharges([{ job: "j", row: { billing: "exempt" }, ledgerRead: { ok: true }, ledger: [{ delta: -1 }] }]).why, /exempt and the ledger names it/);
  assert.match(jobCharges([{ job: "j", row: { billing: "refunded" }, ledgerRead: { ok: true }, ledger: [{ delta: -2 }, { delta: 1 }] }]).why, /refunded; the ledger took 2 and returned 1/);
  assert.match(jobCharges([{ job: "j", row: { billing: "reserved" }, ledgerRead: { ok: true }, ledger: [] }]).why, /reserved, not settled/);
});
