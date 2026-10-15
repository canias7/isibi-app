// A HELD CHANGE THE ROUTER NAMED ONLY TABLES FOR IS ROUTED BESIDE AN ADDITION
// THAT MAKES A PAGE (2026-10-15, after run 38649153034's acc-mixed-talk press).
//
// Run 38649153034 sent "add a Bulk Orders page … put a link in the menu, and
// change the Olive & Rosemary's price to £5.90". The router answered the
// addition and held the price back as a part of its own. That part still had
// to be routed, and a routing reads the page list — which the addition was
// about to change by making /bulk-orders — so `clearToPrepare` kept it from
// being prepared until the addition had ended (370 s), and it then ran alone:
// no overlap, no preparation reused. The router had said, seeing the whole
// site, that the price change writes only the loaves table.
//
// The correction (`routeScope`, builder/request-plan.mjs; the route handler in
// worker.js): such a part's routing is shown the page list recorded when the
// request was accepted, in its preparation and its job alike, so it is
// prepared beside the addition and its job is answered from the record. An
// answer outside the scope is asked again of the whole site when the pages
// have changed (`routeInScope`, `samePages`). A part that names no targets, or
// names a read of what the addition makes, still waits.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { routeScope, routeInScope, stepInputs, clearToPrepare } from "../builder/request-plan.mjs";
import { jobBody } from "../builder/request.mjs";

blockNetwork();

const slugOf = (k) => "hr-" + k + "-" + Math.random().toString(16).slice(2, 8);
const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
const loavesDb = () => rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const ADD = "add a gallery page and put it in the menu";
const PRICE = "make the Dark Rye £5.50";

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);

// ── THE PLAN, PURE ──────────────────────────────────────────────────────────

const routePart = (n, targets) => ({ n, at: n, phase: "route", route: null, needs: [], status: "ready", targets, seq: 0, jobs: [] });
const addonPart = { n: 0, at: 0, phase: "run", route: { intent: "addon", op: "addon" }, needs: [], status: "started", targets: { writes: ["new-page:/bulk-orders", "menu"], reads: [] }, seq: 1, jobs: [{ id: "j0" }] };

test("SCOPE 1 — a part to be routed that the router named only stored tables for is scoped to them, and its routing reads the table list, not the page list", () => {
  const p = routePart(1, { writes: ["data:loaves"], reads: [] });
  assert.deepEqual(routeScope(p), { tables: ["loaves"] });
  assert.deepEqual(stepInputs(p), ["tablelist"]);
  // so an addition making a page does not hold its preparation…
  assert.equal(clearToPrepare([addonPart, p], 1, () => false), true);
  // …but one making a table does (the table list it is shown changes)
  const makesTable = { ...addonPart, targets: { writes: ["new-data:orders"], reads: [] } };
  assert.equal(clearToPrepare([makesTable, p], 1, () => false), false);
});

test("SCOPE 2 controls — no scope when nothing is named, when a page or the menu is written, or when anything is read; those routings read the page list and wait for a page being made", () => {
  for (const t of [null, { writes: [], reads: [] }, { writes: ["page:/visit"], reads: [] }, { writes: ["data:loaves", "menu"], reads: [] }, { writes: ["data:loaves"], reads: ["page:/bulk-orders"] }]) {
    const p = routePart(1, t);
    assert.equal(routeScope(p), null, JSON.stringify(t));
    assert.deepEqual(stepInputs(p), ["pagelist"]);
    assert.equal(clearToPrepare([addonPart, p], 1, () => false), false, "waited for nothing: " + JSON.stringify(t));
  }
  // a part already routed is never given a routing scope
  assert.equal(routeScope({ ...routePart(1, { writes: ["data:loaves"], reads: [] }), phase: "run", route: { intent: "edit", layer: "data" } }), null);
});

test("SCOPE 3 — an answer is inside the scope only as a data or rules edit of the scoped tables, or an addition naming only their rows, with nothing held and no question", () => {
  const S = { tables: ["loaves"] };
  assert.equal(routeInScope(S, { intent: "edit", layer: "data" }), true);
  assert.equal(routeInScope(S, { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] }), true);
  assert.equal(routeInScope(S, { intent: "edit", layer: "rules", targets: [{ change: 0, writes: ["data:loaves"] }] }), true);
  assert.equal(routeInScope(S, { intent: "addon", targets: [{ change: 0, writes: ["data:loaves"] }] }), true);
  // outside: another layer, another table, a page, a read, held parts, a question, an unnamed addition
  assert.equal(routeInScope(S, { intent: "edit", layer: "text" }), false);
  assert.equal(routeInScope(S, { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:hours"] }] }), false);
  assert.equal(routeInScope(S, { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves", "page:/order"] }] }), false);
  assert.equal(routeInScope(S, { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"], reads: ["page:/order"] }] }), false);
  assert.equal(routeInScope(S, { intent: "edit", layer: "data", alsoAsked: ["and the hours"] }), false);
  assert.equal(routeInScope(S, { intent: "clarify", question: { text: "Which loaf?" } }), false);
  assert.equal(routeInScope(S, { intent: "addon" }), false);
  assert.equal(routeInScope(null, { intent: "edit", layer: "data" }), false);
});

test("SCOPE 4 — the routing body carries the scope only for a prepared part, and the preparation's body and the job's body are the same request", () => {
  const rec = { key: "rqk", slug: "s", picker: "sonnet", message: ADD + ", and " + PRICE + ".", files: [], digest: { name: "Harbour Loaf", pages: ["/", "/visit"] }, parts: [addonPart, { ...routePart(1, { writes: ["data:loaves"], reads: [] }), words: PRICE }] };
  assert.equal(jobBody(rec, 1, "route", "k1").body.scope, undefined, "an unprepared part was scoped");
  rec.parts[1].prep = { seq: 1, for: 0, phase: "route", state: "running" };
  const prep = jobBody(rec, 1, "route", "k-prep1").body;
  const job = jobBody(rec, 1, "route", "k2").body;
  assert.deepEqual(prep.scope, { tables: ["loaves"] });
  const { idem: _a, ...p } = prep, { idem: _b, ...j } = job;
  assert.deepEqual(p, j);
  assert.deepEqual(job.site.pages, ["/", "/visit"], "the recorded page list was not carried");
});

// ── THROUGH THE REAL DRIVER, CONSUMER AND ROUTES ────────────────────────────

const acceptance = (change1) => ({
  intent: "addon", alsoAsked: [PRICE],
  targets: [{ change: 0, writes: ["new-page:/gallery", "menu"] }, ...(change1 ? [{ change: 1, ...change1 }] : [])],
});
const DATA_ROUTE = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const RYE_CHANGE = { write_row_changes: { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] } };

test("PRESS B'S SHAPE — a held price change named for its table is PREPARED BESIDE the addition that makes a page: routed and its row change planned while the addition's job has not run; its job answers both from the record and asks nothing again; both land, each charged once", async () => {
  const db = loavesDb();
  await withPlatform({ slug: slugOf("b"), db, answers: { route: [acceptance({ writes: ["data:loaves"] }), DATA_ROUTE], ...GALLERY, ...RYE_CHANGE } }, async (P) => {
    const r = await sendMessage(P, { message: ADD + ", and " + PRICE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobs = P.queue.filter((m) => m.body.kind !== "request-prep");
    // BEFORE: no preparation was claimed while the addition was still to run.
    assert.equal(prep.length, 1, "the held price change was not prepared beside the addition (it waited for the page list)");
    assert.equal(prep[0].body.n, 1);
    P.queue.splice(0);
    // the preparation runs while the addition's job has not
    await deliver(P, prep[0]);
    const mid = P.record(r.key).parts[1].prep;
    assert.equal(mid.outcome, "ready", "its routing and its row change were not both prepared: " + JSON.stringify(mid));
    assert.equal(db.rows("loaves").find((x) => x.id === 2).price, BAKERY_LOAVES.find((x) => x.id === 2).price, "the preparation wrote the row");
    assert.equal(calls(P, T.route).length, 2, "acceptance + the preparation's routing");
    assert.equal(calls(P, "write_row_changes").length, 1);
    // then the addition makes /gallery: the site's page list changes
    for (const m of jobs) await deliver(P, m);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.equal(db.rows("loaves").find((x) => x.id === 2).price, 5.5);
    // NOTHING ASKED AGAIN: the job's routing was the prepared request, byte for byte
    assert.equal(calls(P, T.route).length, 2, "the price change's routing was asked again although nothing it was shown changed");
    assert.equal(calls(P, "write_row_changes").length, 1, "the row change was asked again");
    const routeJob = P.jobsOf(r.key).find((j) => j.op === "route");
    assert.ok(routeJob, "no routing job ran for the held part");
    assert.equal(P.answerOf(routeJob).routeScope, "kept");
    for (const j of P.jobsOf(r.key)) {
      const rows = P.ledger.filter((e) => e.ref.startsWith(j.id + "#") && e.reason === "reserve");
      assert.ok(rows.length <= 1, j.op + " charged more than once");
    }
  });
});

test("PRESS B control — the same held change with NO targets named still waits for the addition (no preparation beside it): nothing is assumed about an unnamed part", async () => {
  await withPlatform({ slug: slugOf("n"), db: loavesDb(), answers: { route: [acceptance(null), DATA_ROUTE], ...GALLERY, ...RYE_CHANGE } }, async (P) => {
    const r = await sendMessage(P, { message: ADD + ", and " + PRICE + "." });
    assert.equal(r.status, 200);
    assert.equal(P.queue.filter((m) => m.body.kind === "request-prep").length, 0, "an unnamed part was prepared beside a page being made");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"]);
  });
});

test("PRESS B control — a REAL DEPENDENCY: a change that reads the page the addition makes waits for it, and is never prepared beside it", async () => {
  const LINK = "put a link to the gallery page on the Visit page";
  await withPlatform({ slug: slugOf("d"), answers: { route: [{ ...acceptance(null), alsoAsked: [LINK], targets: [{ change: 0, writes: ["new-page:/gallery", "menu"] }, { change: 1, writes: ["page:/visit"], reads: ["new-page:/gallery"] }] }], ...GALLERY } }, async (P) => {
    const r = await sendMessage(P, { message: ADD + ", and " + LINK + "." });
    assert.equal(r.status, 200);
    const rec = P.record(r.key);
    assert.deepEqual(rec.parts[1].needs, [0], "the part that links the new page does not wait for it");
    assert.equal(P.queue.filter((m) => m.body.kind === "request-prep").length, 0);
  });
});

test("WIDENED — a scoped answer outside its scope, after the addition changed the pages, is asked again of the whole site as it now is (the new page listed), billed for both calls, and never applied from the stale view", async () => {
  const db = loavesDb();
  // the preparation's scoped routing answers a text change (outside the scope);
  // with the page list unchanged at preparation time it stands there, and the
  // job — after /gallery exists — asks again of the whole site.
  const TEXT_ROUTE = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
  await withPlatform({ slug: slugOf("w"), db, answers: { route: [acceptance({ writes: ["data:loaves"] }), TEXT_ROUTE, DATA_ROUTE], ...GALLERY, ...RYE_CHANGE } }, async (P) => {
    const r = await sendMessage(P, { message: ADD + ", and " + PRICE + "." });
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobs = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(prep.length, 1);
    P.queue.splice(0);
    await deliver(P, prep[0]);
    assert.equal(P.record(r.key).parts[1].prep.outcome !== undefined, true);
    for (const m of jobs) await deliver(P, m);
    await settle(P, r.key);
    const routeCalls = calls(P, T.route);
    // acceptance, the preparation's scoped call, the job's scoped call answered
    // from the record, and the widened call: three made by a model
    assert.equal(routeCalls.length, 3, "the widened routing was not asked (or asked more than once)");
    assert.match(routeCalls[2].text, /\/gallery/, "the widened routing was not shown the page the addition made");
    assert.doesNotMatch(routeCalls[1].text, /\/gallery/, "the scoped routing was shown the live page list");
    const routeJob = P.jobsOf(r.key).find((j) => j.op === "route");
    assert.equal(P.answerOf(routeJob).routeScope, "widened");
    assert.equal(db.rows("loaves").find((x) => x.id === 2).price, 5.5, "the widened route's answer was not the one applied");
  });
});
