// THE MONEY AFTER OBSERVATION STOPPED (2026-10-08, run 107).
//
// Run 107's own-charges check passed on a snapshot of 22 credits (routing 4 +
// jobs 18) between its two balance reads. Nine seconds after it stopped, the
// TikTok part of its second request — still open on the server, waiting on a
// question — took 3 more for its routing (ledger row 407): 25 in all, and not
// final while that request stays open. The owner: *"Reconcile test accounting
// after observation stops: retain the 22-credit snapshot but record the later
// routing charge and final 25-credit total, leaving unsettled charges explicit
// rather than declaring final accounting prematurely."*
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { laterChargesVerdict, laterChargesSaid, UI_LATER_READ_MS } from "../scripts/canary-ui.mjs";

const SLUG = "fold-lane-bakery";
const K1 = "66a6a192da0e75125140035f611cf38f", K2 = "475d4ff79c7887bb18d546fcecf15edf";
// RUN 107'S REQUESTS AS THE LIST SHOWED THEM after the press stopped: the first ended, the second waiting on its question.
const LIST = { ok: true, requests: [
  { key: K1, ended: true, state: "done", parts: [{ n: 0, jobs: ["e46a3ccaa8026516da807acd8989f806"] }, { n: 1, jobs: ["5a93543ae7aec8a2c067750cf9f225f4", "7b324768be70456e3f840df90ccb8c75", "65767a3635b8dcc7379456c88a413f0c"] }] },
  { key: K2, ended: false, state: "waiting", parts: [{ n: 0, jobs: ["08b84314ea7533abf49c68976ffb2444"] }, { n: 1, jobs: ["bd79395e015814699b6efc8d78256f51", "cefef70f531c9efc2085db44b8d0243c", "becdd472a9a54f68b7f22b12058c7561"] }] },
  { key: "someone-elses", ended: false, parts: [{ n: 0, jobs: ["ffff0000"] }] },
] };
// THE LEDGER AFTER THE PRESS'S LAST BALANCE READ: row 407 is its own; a row of another job is not.
const ROWS = { ok: true, rows: [
  { id: 407, ref: "bd79395e015814699b6efc8d78256f51#1", delta: "-3", at: "2026-10-07T23:58:28Z" },
  { id: 408, ref: "ffff0000#1", delta: "-5", at: "2026-10-07T23:59:00Z" },
] };

test("LATER 1 — run 107: the 22-credit snapshot stays, the later routing row is this press's, 25 so far, and NOT final while a request waits", () => {
  const v = laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K1, K2], rows: ROWS, list: LIST });
  assert.equal(v.ok, true, v.why);
  assert.equal(v.snapshot, 22);
  assert.deepEqual(v.later.map((r) => [r.id, r.delta]), [[407, -3]]);
  assert.equal(v.laterTotal, 3);
  assert.equal(v.total, 25);
  assert.deepEqual(v.open, [K2]);
  assert.equal(v.settled, false);
  const said = laterChargesSaid(v);
  assert.match(said, /snapshot 22; later 3 \(row 407 bd79395e[^)]*-3\); total so far 25; NOT FINAL: 1 request\(s\) still open/);
});

test("LATER 2 — a request's own routing ref counts, another request's never; every request ended reads settled", () => {
  const list = { ok: true, requests: LIST.requests.map((q) => ({ ...q, ended: true })) };
  const rows = { ok: true, rows: [{ id: 410, ref: "route:" + SLUG + ":" + K2, delta: "-1" }, { id: 411, ref: "route:" + SLUG + ":someone-elses", delta: "-2" }] };
  const v = laterChargesVerdict({ snapshot: 25, slug: SLUG, keys: [K1, K2], rows, list });
  assert.equal(v.total, 26);
  assert.equal(v.settled, true);
  assert.match(laterChargesSaid(v), /settled: every request this press made has ended/);
});

test("LATER 3 — cannot-tell is never final: an unread ledger, an unread list, a request missing from it, a row with no amount", () => {
  assert.equal(laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K1], rows: { ok: false }, list: LIST }).settled, false);
  assert.match(laterChargesSaid(laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K1], rows: { ok: false }, list: LIST })), /^UNSETTLED: the ledger after the press could not be read/);
  const noList = laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K1, K2], rows: ROWS, list: { ok: false } });
  assert.equal(noList.settled, false);
  assert.deepEqual(noList.unknown, [K1, K2]);
  assert.equal(noList.total, 22, "with no list, no job is known to be this press's, so nothing is added — and nothing is called final");
  const gone = laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K1, "missing"], rows: ROWS, list: LIST });
  assert.deepEqual(gone.unknown, ["missing"]);
  assert.equal(gone.settled, false);
  assert.equal(laterChargesVerdict({ snapshot: 22, slug: SLUG, keys: [K2], rows: { ok: true, rows: [{ id: 1, ref: "bd79395e015814699b6efc8d78256f51#1", delta: "x" }] }, list: LIST }).ok, false);
  assert.equal(laterChargesVerdict({ snapshot: NaN, slug: SLUG, keys: [K1], rows: ROWS, list: LIST }).ok, false);
});

test("LATER 4 — the canary reads it after the snapshot check, after one explicit wait, and records it without making it a check", () => {
  assert.equal(UI_LATER_READ_MS, 60_000);
  const src = fs.readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");
  const snap = src.indexOf("this press's own charges add up");
  const later = src.indexOf("THE MONEY AFTER OBSERVATION STOPPED (read");
  assert.ok(snap > 0 && later > snap, "the later read is not after the snapshot check");
  const block = src.slice(later - 1500, later);
  assert.ok(block.includes("setTimeout(res, UI_LATER_READ_MS)"), "no explicit wait before the later read");
  assert.ok(block.includes("at=gt.${encodeURIComponent(bal.endAt)}"), "the later rows are not read from after the press's last balance read");
  assert.ok(block.includes("requestsIo.list()"), "the requests' states are not read");
  assert.ok(!src.slice(later, later + 300).includes("check("), "the later account was made a check");
});
