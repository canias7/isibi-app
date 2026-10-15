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
import { clickPlan, journalLive, newJournal, readJournal, addressOverlay, forgottenInDraft, publishPlan, PUBLICATION_PHASES, FINISH_STEPS } from "../site-draft.mjs";

test("a click's plan: none or finished starts; a fresh runner is busy; the same revision stopped resumes; another revision switched is finished first; another before its switch is set aside", () => {
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
  assert.deepEqual(PUBLICATION_PHASES, ["start", "prepared", "switched", "finished"]);
  assert.deepEqual(FINISH_STEPS, ["address", "schema", "jobs", "seeds", "changes", "inserts", "library"]);
});

test("a stored journal is read strictly — not one is null, never a guess", () => {
  const V = "01790468089054-8btpep";
  assert.equal(readJournal("{"), null);
  assert.equal(readJournal({ n: "3", version: V, phase: "start" }), null);
  assert.equal(readJournal({ n: 3, version: "nope", phase: "start" }), null);
  assert.equal(readJournal({ n: 3, version: V, phase: "halfway" }), null);
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
