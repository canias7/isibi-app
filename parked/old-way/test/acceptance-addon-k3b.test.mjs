// PARKED (2026-11-03, park-old-way): the old-way half of test/acceptance-addon-k3b.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { UI_SCENARIOS, ACCEPTANCE_CAP, BALANCE_OPT_IN, readBalanceOptIn } from "../../../scripts/canary-ui.mjs";
import { innerDesignVerdict, requestBatchVerdict, outcomeChecks, routeOfPage } from "../../../scripts/canary-requests.mjs";
import { newTrace, traceRow } from "../../../builder/edit-trace.mjs";

const ROOT = new URL("../../../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const SC = UI_SCENARIOS["acc-addon-k3b"];

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
