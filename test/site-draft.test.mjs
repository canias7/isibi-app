// THE DRAFT RECORD (owner, 2026-10-15: only an explicit Publish makes
// changes live; tasks save drafts). Pure cases over an R2-shaped store with
// content etags and Miniflare's conditions.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DRAFT_KEY, readDraft, saveDraftRecord, publishable, draftState, draftFirst } from "../site-draft.mjs";
import { r2Conditional } from "./fixtures/request-flow.mjs";

function store() {
  const m = new Map(); let at = 1;
  return {
    m,
    get: async (k) => { const o = m.get(k); return o ? { etag: o.etag, text: async () => o.body } : null; },
    put: async (k, body, _ct, onlyIf) => {
      const cur = m.get(k);
      if (!r2Conditional(onlyIf || {}, cur ? { etag: cur.etag, at: cur.at } : null)) return null;
      const etag = crypto.createHash("md5").update(body).digest("hex");
      m.set(k, { body, etag, at: at++ }); return { etag };
    },
  };
}
const V = (n) => "0179" + String(n).padStart(10, "0") + "-abcdef";

test("the switch: only DRAFT_FIRST=on", () => {
  assert.equal(draftFirst({ DRAFT_FIRST: "on" }), true);
  assert.equal(draftFirst({ DRAFT_FIRST: "ON" }), true);
  for (const e of [{}, { DRAFT_FIRST: "off" }, { DRAFT_FIRST: "1" }, null]) assert.equal(draftFirst(e), false);
});

test("a saved version becomes the draft; an older one saved later stays in history and never replaces the newer", async () => {
  const s = store();
  assert.deepEqual(await readDraft(s, "x"), { draft: null, etag: null });
  assert.equal((await saveDraftRecord(s, "x", { version: V(2), job: "j2" })).ok, true);
  assert.equal((await readDraft(s, "x")).draft.version, V(2));
  const late = await saveDraftRecord(s, "x", { version: V(1), job: "j1" });
  assert.equal(late.older, true, "an older version saved after a newer one replaced it");
  const d = (await readDraft(s, "x")).draft;
  assert.equal(d.version, V(2));
  assert.deepEqual(d.history, [V(1)]);
  await saveDraftRecord(s, "x", { version: V(3) });
  const d3 = (await readDraft(s, "x")).draft;
  assert.equal(d3.version, V(3));
  assert.deepEqual(d3.history.sort(), [V(1), V(2)]);
  assert.equal(publishable(d3, V(2)), true, "an earlier saved draft the owner approved is still publishable by name");
  assert.equal(publishable(d3, V(9)), false, "a version never saved as a draft was publishable");
  assert.equal(publishable(null, V(3)), false);
});

test("two tasks saving at once: both land, the newer is the draft (conditional on the record read)", async () => {
  const s = store();
  await saveDraftRecord(s, "x", { version: V(1) });
  let raced = false;
  const realPut = s.put;
  s.put = async (k, b, ct, c) => { if (!raced) { raced = true; await realPut(k, JSON.stringify({ v: 1, version: V(5), history: [V(1)] }), "application/json"); } return realPut(k, b, ct, c); };
  const r = await saveDraftRecord(s, "x", { version: V(4) });
  assert.equal(r.ok, true);
  const d = (await readDraft(s, "x")).draft;
  assert.equal(d.version, V(5), "a save that met another's write overwrote the newer draft");
  assert.ok(d.history.includes(V(4)), "the losing save was lost from history");
});

test("an unreadable draft record throws — cannot-tell is never no draft", async () => {
  const s = store();
  await s.put(DRAFT_KEY("x"), "{not json", "application/json");
  await assert.rejects(() => readDraft(s, "x"));
});

test("what the owner sees: processing, saved, published", () => {
  assert.equal(draftState({ draft: { version: V(2) }, live: { version: V(1) }, running: 1 }).state, "processing");
  assert.equal(draftState({ draft: { version: V(2) }, live: { version: V(1) } }).state, "saved");
  assert.equal(draftState({ draft: { version: V(2) }, live: { version: V(2) } }).state, "published");
  assert.equal(draftState({ draft: null, live: { version: V(2) } }).state, "published");
  assert.equal(draftState({ draft: { version: V(1) }, live: null }).unpublished, true, "a first build's draft read as published");
});

// ── THE PUBLICATION JOURNAL AND THE HELD ADDRESS (2026-10-15) ────────────────
import { clickPlan, journalLive, journalClosed, journalMayBeLive, newJournal, readJournal, addressOverlay, forgottenInDraft, publishPlan, PUBLICATION_PHASES, FINISH_STEPS } from "../site-draft.mjs";

test("a click's plan: none or finished starts; a fresh runner is busy; the same revision stopped resumes; another revision at or after its intent to switch is finished first; another before it is set aside; closed journals start anew", () => {
  const V = "01790468089054-8btpep", stale = 180000, now = 1e9;
  const j = (o) => ({ ...newJournal({ slug: "s", n: 3, version: V, now: now - 1000, id: "x" }), ...o });
  assert.equal(clickPlan(null, 3, { now, staleMs: stale }), "start");
  assert.equal(clickPlan(j({ phase: "finished" }), 3, { now, staleMs: stale }), "start");
  assert.equal(clickPlan(j({}), 3, { now, staleMs: stale }), "busy");
  assert.equal(clickPlan(j({}), 4, { now, staleMs: stale }), "busy");
  assert.equal(clickPlan(j({ running: false, phase: "switched" }), 3, { now, staleMs: stale }), "resume");
  assert.equal(clickPlan(j({ at: now - stale - 1 }), 3, { now, staleMs: stale }), "resume", "a dead runner was taken for a live one");
  assert.equal(clickPlan(j({ running: false, phase: "switched" }), 4, { now, staleMs: stale }), "finishFirst");
  assert.equal(clickPlan(j({ running: false, phase: "prepared" }), 4, { now, staleMs: stale }), "replace");
  assert.equal(journalLive(j({ running: false }), { now, staleMs: stale }), false);
  assert.deepEqual(PUBLICATION_PHASES, ["start", "prepared", "switching", "switched", "finished", "retired"]);
  // THE INTENT TO SWITCH may be live: another revision stopped there is finished (or reconciled) first.
  assert.equal(clickPlan(j({ running: false, phase: "switching", from: "" }), 4, { now, staleMs: stale }), "finishFirst");
  // CLOSED JOURNALS (tombstones) start a new publication, and are never live or running.
  for (const phase of ["finished", "retired"]) {
    assert.equal(clickPlan(j({ phase }), 4, { now, staleMs: stale }), "start", phase);
    assert.equal(journalLive(j({ phase }), { now, staleMs: stale }), false, phase);
    assert.equal(journalClosed(j({ phase })), true, phase);
  }
  assert.deepEqual(["start", "prepared", "switching", "switched"].map((phase) => journalMayBeLive(j({ phase }))), [false, false, true, true]);
  assert.deepEqual(FINISH_STEPS, ["address", "schema", "jobs", "seeds", "changes", "inserts", "library"]);
});

test("a stored journal is read strictly — not one is null, never a guess", () => {
  const V = "01790468089054-8btpep";
  assert.equal(readJournal("{"), null);
  assert.equal(readJournal({ n: "3", version: V, phase: "start" }), null);
  assert.equal(readJournal({ n: 3, version: "nope", phase: "start" }), null);
  assert.equal(readJournal({ n: 3, version: V, phase: "halfway" }), null);
  // AN INTENT TO SWITCH THAT DOES NOT SAY WHAT IT REPLACES is not one.
  assert.equal(readJournal({ n: 3, version: V, phase: "switching" }), null);
  assert.equal(readJournal({ n: 3, version: V, phase: "switching", from: "nope" }), null);
  assert.equal(readJournal({ n: 3, version: V, phase: "switching", from: "" }).from, "");
  assert.equal(readJournal({ n: 3, version: V, phase: "switching", from: V }).from, V);
  const r = readJournal(JSON.stringify({ n: 3, version: V, phase: "switched", running: "yes", done: ["address", 4] }));
  assert.deepEqual([r.running, r.done, r.attempts], [false, ["address"], 0]);
});

test("the draft's address: the last held rename wins; consecutive renames publish as one move from the live name (a name in between never becomes a redirect); a move back to the live name is no move; a rename back to a forgotten name keeps it", () => {
  const ops = [{ kind: "alias", action: "rename", from: "a", to: "b" }, { kind: "alias", action: "rename", from: "b", to: "c" }];
  assert.equal(addressOverlay("a", ops), "c");
  assert.equal(addressOverlay("a", []), "a");
  assert.deepEqual(publishPlan(ops).plan.alias, [{ kind: "alias", action: "rename", from: "a", to: "c" }]);
  assert.deepEqual(publishPlan([...ops, { kind: "alias", action: "rename", from: "c", to: "a" }]).plan.alias, []);
  const f = [{ kind: "alias", action: "forget", name: "old" }, { kind: "alias", action: "forget", name: "older" }, { kind: "alias", action: "rename", from: "a", to: "old" }];
  assert.deepEqual([...forgottenInDraft(f)], ["older"]);
});

// AUDIT BATCH 2, STEP 1 (2026-10-18, A06-3 and A04-1): held schema and jobs
// ops combine BY NAME — a later held change adds to the draft's schema, never
// replaces it — the same for what later tasks read (`specOverlay`) and what
// Publish applies (`publishPlan`).
import { specOverlay, mergeSpec, combineHeld } from "../site-draft.mjs";
import { mergeAddonSchema } from "../builder/site-addon.mjs";

const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "price", type: "numeric" }] };

test("A06-3: a later held spec with no tables keeps the live `loaves`; a held new table survives a later empty spec into the plan", () => {
  const s = specOverlay({ tables: [LOAVES] }, [{ kind: "schema", spec: { tables: [] } }]);
  assert.deepEqual(s.tables.map((t) => t.name), ["loaves"]);
  const ops = [
    { kind: "schema", spec: { tables: [{ name: "gallery", columns: [{ name: "title", type: "text" }] }] } },
    { kind: "row", table: "gallery", op: "insert", ref: "r1", values: { title: "a" } },
    { kind: "schema", spec: { tables: [] } },
  ];
  const p = publishPlan(ops);
  assert.equal(p.ok, true);
  assert.deepEqual(p.plan.spec.tables.map((t) => t.name), ["gallery"]);
  assert.equal(p.plan.inserts.length, 1);
});

test("A04-1: two add-ons held in one draft publish both functions and both jobs", () => {
  const live = { tables: [{ name: "orders", columns: [{ name: "total", type: "numeric" }] }] };
  const fnA = { name: "daily_summary", sql: "select 1" };
  const ops = [
    { kind: "schema", spec: { tables: live.tables, functions: [fnA], jobs: [{ name: "daily", fn: "daily_summary" }] } },
    { kind: "jobs", jobs: [{ name: "daily", fn: "daily_summary", cron: "0 8 * * *" }] },
  ];
  // B is built the way worker.js builds it today: only the overlay's tables.
  const b = mergeAddonSchema(specOverlay(live, ops).tables, { tables: [{ name: "signups", columns: [{ name: "email", type: "text" }] }] });
  ops.push({ kind: "schema", spec: b.spec }, { kind: "jobs", jobs: [{ name: "weekly_digest", fn: "daily_summary", cron: "0 9 * * 1" }] });
  const { plan } = publishPlan(ops);
  assert.deepEqual(plan.spec.functions.map((f) => f.name), ["daily_summary"]);
  assert.deepEqual(plan.spec.tables.map((t) => t.name).sort(), ["orders", "signups"]);
  assert.deepEqual(plan.jobs.map((j) => j.name).sort(), ["daily", "weekly_digest"]);
  assert.deepEqual(specOverlay(live, ops).functions.map((f) => f.name), ["daily_summary"]);
  const c = combineHeld(live, ops);
  assert.equal(c.ok, true);
  assert.deepEqual(c.jobs.map((j) => j.name).sort(), ["daily", "weekly_digest"]);
});

test("CONTROL: a later redefinition wins by name (case-insensitive); no schema or jobs op leaves the plan's null; set-aside ops are skipped", () => {
  const wider = { name: "LOAVES", columns: [...LOAVES.columns, { name: "photo", type: "text" }] };
  const s = specOverlay({ tables: [LOAVES] }, [{ kind: "schema", spec: { tables: [wider] } }]);
  assert.equal(s.tables.length, 1);
  assert.equal(s.tables[0].columns.length, 3);
  assert.deepEqual(mergeSpec({ tables: [LOAVES], x: 1 }, { y: 2 }).tables.map((t) => t.name), ["loaves"]);
  assert.equal(mergeSpec({ x: 1 }, { y: 2 }).y, 2);
  const live = { tables: [LOAVES] };
  assert.equal(specOverlay(live, []), live);
  const { plan } = publishPlan([{ kind: "row", table: "loaves", op: "update", id: 1, values: { price: 5 } }]);
  assert.equal(plan.spec, null);
  assert.equal(plan.jobs, null);
  const j2 = publishPlan([{ kind: "jobs", jobs: [{ name: "a", cron: "1" }] }, { kind: "jobs", jobs: [{ name: "A", cron: "2" }] }]).plan.jobs;
  assert.deepEqual(j2, [{ name: "A", cron: "2" }]);
  const c = combineHeld(live, [{ kind: "schema", key: "k1", spec: { tables: [{ name: "gallery" }] } }], { setAside: ["k1"] });
  assert.deepEqual(c.spec.tables.map((t) => t.name), ["loaves"]);  const up = combineHeld(live, [{ kind: "schema", spec: { tables: [{ name: "gallery" }] } }, { kind: "schema", spec: { tables: [{ name: "menu" }] } }], { upTo: 1 });
  assert.deepEqual(up.spec.tables.map((t) => t.name), ["loaves", "gallery"]);
});

// STARTER ROWS HAVE REFS, AND A HELD CHANGE TO ONE FOLDS INTO IT (2026-10-18,
// A28-3): before, a starter row showed a negative id with no ref, the change
// was held by that id, and Publish ran UPDATE/DELETE ... WHERE id = -2.
import { rowsOverlay, STARTER_MISSING } from "../site-draft.mjs";
test("A28-3: starter rows carry refs, and Publish folds held changes into them", () => {
  const seed = { kind: "seed", spec: {}, seed: { services: [{ name: "Cut", price: 20 }, { name: "Fade", price: 25 }] } };
  const ov = rowsOverlay("services", [], [seed], { tableExists: false });
  assert.deepEqual(ov.rows.map((r) => r.id), [-1, -2]);
  assert.equal(ov.tempRefs.get(-1), "seed:services:0:0");
  assert.equal(ov.tempRefs.get(-2), "seed:services:0:1");
  const ops = [seed,
    { kind: "row", table: "services", op: "update", ref: "seed:services:0:1", values: { price: 30 } },
    { kind: "row", table: "services", op: "remove", ref: "seed:services:0:0" }];
  assert.deepEqual(rowsOverlay("services", [], ops, { tableExists: false }).rows, [{ name: "Fade", price: 30, id: -2 }]);
  const p = publishPlan(ops);
  assert.equal(p.ok, true);
  assert.deepEqual(p.plan.seeds[0].seed.services, [{ name: "Fade", price: 30 }]);
  assert.deepEqual(p.plan.changes, []);
  assert.deepEqual(seed.seed.services, [{ name: "Cut", price: 20 }, { name: "Fade", price: 25 }], "the held op is not mutated");
  assert.equal(combineHeld({}, ops).ok, true);
  // a second seed op for the same table numbers its rows apart
  const two = [seed, { kind: "seed", spec: {}, seed: { services: [{ name: "Shave" }] } },
    { kind: "row", table: "services", op: "update", ref: "seed:services:1:0", values: { price: 9 } }];
  assert.deepEqual(publishPlan(two).plan.seeds[1].seed.services, [{ name: "Shave", price: 9 }]);
  assert.deepEqual(publishPlan(two).plan.seeds[0].seed.services, seed.seed.services);
});
test("A28-3: a negative id with no ref, or an unknown or removed starter ref, is refused", () => {
  const seed = { kind: "seed", spec: {}, seed: { services: [{ name: "Cut" }] } };
  for (const bad of [
    { kind: "row", table: "services", op: "update", id: -2, values: { price: 1 } },
    { kind: "row", table: "services", op: "remove", id: -1 },
    { kind: "row", table: "services", op: "update", ref: "seed:services:0:5", values: {} },
  ]) {
    assert.deepEqual(publishPlan([seed, bad]), { ok: false, error: STARTER_MISSING });
    assert.deepEqual(combineHeld({}, [seed, bad]), { ok: false, error: STARTER_MISSING });
  }
  const twice = [seed, { kind: "row", table: "services", op: "remove", ref: "seed:services:0:0" }, { kind: "row", table: "services", op: "update", ref: "seed:services:0:0", values: {} }];
  assert.deepEqual(publishPlan(twice), { ok: false, error: STARTER_MISSING });
  assert.equal(publishPlan([{ kind: "row", table: "services", op: "update", id: 3, values: {} }]).ok, true);
  assert.equal(combineHeld({}, [{ kind: "row", table: "services", op: "update", id: 3, values: {} }]).ok, true);
});

// AUDIT BATCH 2, STEP 4 (2026-10-18, A06-3 writer): a revise Build of a
// published site holds the merged spec, or nothing when it declares nothing.
import { reviseHeldSpec } from "../site-draft.mjs";
import { readFileSync as readSrcAB4 } from "node:fs";
test("AB4 THE REVISE BUILD HOLDS mergeSpec(overlay, spec), OR NOTHING WHEN IT DECLARES NOTHING (A06-3 writer)", () => {
  const live = { tables: [{ name: "loaves", columns: [{ name: "price" }] }], functions: [{ name: "daily_summary" }] };
  const overlay = specOverlay(live, [{ kind: "schema", spec: { tables: [{ name: "gallery" }] } }]);
  // NOTHING DECLARED: nothing held.
  assert.equal(reviseHeldSpec(overlay, { tables: [] }), null);
  assert.equal(reviseHeldSpec(overlay, {}), null);
  assert.equal(reviseHeldSpec(overlay, { tables: [], functions: [], apis: [] }), null);
  // A DECLARED TABLE: held over the overlay, every earlier name kept.
  const held = reviseHeldSpec(overlay, { tables: [{ name: "Orders" }] });
  assert.deepEqual(held.tables.map((t) => t.name), ["loaves", "gallery", "Orders"]);
  assert.deepEqual(held.functions.map((f) => f.name), ["daily_summary"]);
  // A REDEFINITION WINS (control).
  const redef = reviseHeldSpec(overlay, { tables: [{ name: "LOAVES", columns: [] }] });
  assert.deepEqual(redef.tables.find((t) => /loaves/i.test(t.name)).columns, []);
  // A FUNCTION ALONE COUNTS AS DECLARED.
  assert.ok(reviseHeldSpec(overlay, { functions: [{ name: "f" }] }));
  // NO OVERLAY READABLE: the build's own spec, as given.
  assert.deepEqual(reviseHeldSpec(null, { tables: [{ name: "x" }] }), { tables: [{ name: "x" }] });
  // "rye £5" after an empty revise: the next task still finds loaves.
  const h = reviseHeldSpec(overlay, { tables: [] });
  const next = specOverlay(live, h ? [{ kind: "schema", spec: h }] : []);
  assert.ok(next.tables.some((t) => t.name === "loaves"));
  // WIRED: the revise's schema call goes through reviseHeldSpec when holding.
  const src = readSrcAB4(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("const bWriter = await backendWriter(env, slug);");
  const b = src.indexOf('tr.at("schema"', a);
  assert.ok(a > 0 && b > a, "landmarks missing");
  const seg = src.slice(a, b);
  assert.match(seg, /bWriter\.holding/);
  assert.match(seg, /reviseHeldSpec\(/);
  assert.match(seg, /if \(schemaSpec\) made = await applySiteSchema\(db, schemaSpec\)/);
});

import { publishStopKind, publishNextTry, journalBlocked, clickPlan as clickPlanB, PUBLISH_MAX_ATTEMPTS } from "../site-draft.mjs";
test("SD-B A STOP'S KIND, ITS PAUSE, AND THE CLICK ON A BLOCKED REVISION (2026-10-18, audit A06-4)", () => {
  for (const c of ["22P02", "23505", "23502", "23514", "42P01", "42703"]) assert.equal(publishStopKind({ code: c }), "permanent", c);
  for (const e of [{ code: "57P01" }, { code: "08006" }, new Error("fetch failed"), null, { code: 23505 }]) assert.equal(publishStopKind(e), "temporary", JSON.stringify(e));
  const t0 = 1_000_000;
  assert.deepEqual([1, 2, 3, 4, 5, 9].map((a) => (publishNextTry(a, t0) - t0) / 60000), [2, 4, 8, 16, 30, 30]);
  assert.equal(PUBLISH_MAX_ATTEMPTS, 8);
  const j = { phase: "switched", n: 3, running: false, at: 0, blocked: { stage: "inserts", why: "x" } };
  assert.equal(journalBlocked(j), true);
  assert.equal(journalBlocked({ ...j, phase: "finished" }), false);
  assert.equal(clickPlanB(j, 4, { now: 1e12, staleMs: 1 }), "blocked");
  assert.equal(clickPlanB(j, 3, { now: 1e12, staleMs: 1 }), "resume", "the owner's own click on the blocked revision is not a retry");
  assert.equal(clickPlanB({ ...j, blocked: null }, 4, { now: 1e12, staleMs: 1 }), "finishFirst");
});

import { rebaseDraft, draftState as draftStateR, readDraft as readDraftR, saveDraftRecord as saveDraftRecordR, markApplied as markAppliedR } from "../site-draft.mjs";
test("SD-R REBASE: THE RESTORED VERSION BECOMES THE DRAFT'S, AS PUBLISHED; A DRAFT WITH UNPUBLISHED WORK IS NEVER REBASED (2026-10-18, audit A06-2)", async () => {
  const store = new Map(); let n = 0;
  const deps = {
    get: async (k) => (store.has(k) ? { text: async () => store.get(k).v, etag: store.get(k).e } : null),
    put: async (k, v, ct, only) => {
      const cur = store.get(k);
      if (only && only.etagMatches && (!cur || cur.e !== only.etagMatches)) return null;
      if (only && only.etagDoesNotMatch === "*" && cur) return null;
      store.set(k, { v, e: "e" + (++n) }); return { etag: "e" + n };
    },
  };
  const V0 = "01790000000000-aaaaaa", V1 = "01790000000100-bbbbbb";
  await saveDraftRecordR(deps, "s", { version: V1 });
  // UNPUBLISHED: refused, nothing written.
  const before = JSON.stringify([...store]);
  const r0 = await rebaseDraft(deps, "s", { version: V0 });
  assert.equal(r0.unpublished, true);
  assert.equal(JSON.stringify([...store]), before);
  await markAppliedR(deps, "s", { revision: 1 });
  const r = await rebaseDraft(deps, "s", { version: V0 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const d = (await readDraftR(deps, "s")).draft;
  assert.deepEqual([d.version, d.base, d.applied, d.rev], [V0, V0, 2, 2]);
  assert.equal(draftStateR({ draft: d, live: { version: V0 } }).state, "published");
  assert.ok(d.history.includes(V1), "the version rolled back from left the history");
  assert.equal((await rebaseDraft(deps, "s", { version: V0 })).same, true);
});

import { discardDraft, unpublishedVersions as unpublishedVersionsX, sealHeldRevision as sealHeldRevisionX } from "../site-draft.mjs";
test("SD-X DISCARD: THE DROPPED REVISIONS LEAVE THE LIST, THE NEW ONE IS PUBLISHED, NOTHING READS AS UNPUBLISHED (2026-10-18)", async () => {
  const store = new Map(); let n = 0;
  const deps = {
    get: async (k) => (store.has(k) ? { text: async () => store.get(k).v, etag: store.get(k).e } : null),
    put: async (k, v, ct, only) => {
      const cur = store.get(k);
      if (only && only.etagMatches && (!cur || cur.e !== only.etagMatches)) return null;
      if (only && only.etagDoesNotMatch === "*" && cur) return null;
      store.set(k, { v, e: "e" + (++n) }); return { etag: "e" + n };
    },
  };
  const V0 = "01790000000000-aaaaaa", V1 = "01790000000100-bbbbbb", V2 = "01790000000200-cccccc";
  await saveDraftRecordR(deps, "s", { version: V0 });
  await markAppliedR(deps, "s", { revision: 1 });
  await saveDraftRecordR(deps, "s", { version: V1 });
  await saveDraftRecordR(deps, "s", { version: V2 });
  const r = await discardDraft(deps, "s", { live: { version: V0, build: "b0" } });
  assert.equal(r.dropped, 2, JSON.stringify(r));
  const d = (await readDraftR(deps, "s")).draft;
  assert.deepEqual(d.revs.map((x) => x.n), [1, 4], "the dropped revisions are still listed");
  assert.deepEqual([d.version, d.applied, d.rev], [V0, 4, 4]);
  assert.equal(unpublishedVersionsX(d).size, 0);
  assert.equal(draftStateR({ draft: d, live: { version: V0 } }).state, "published");
  void sealHeldRevisionX;
});
