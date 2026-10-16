// THE REMAINING BACKEND ITEMS, TOGETHER (2026-10-16, Codex's acceptance of
// the recovery batch at `68672e86`).
//
//   SRB1  `If-Range` on hosted media, through the Worker's own `/u/` route:
//         a strong tag equal to the file's keeps the range (206); another
//         tag, a weak tag, a stale date or nonsense answers the whole current
//         file (200); the file's own upload date keeps it.
//   SRB2  a replacement BETWEEN the head and the read: never a range of the
//         new file under the old one's length and tag — the new file whole,
//         with its own tag; the next request with the old tag is 200, with
//         the new tag 206.
//   SRB3  a replacement before and after Publish (the publish copy puts the
//         new bytes at the same address): a player holding the old tag gets
//         its range before, and the whole new file after.
//   SRB4  `/u/` is tied to its host: a site's own label, its current name
//         (a renamed site) and its custom domain serve its own uploads and
//         404 another site's; the app's host serves every site's; a host
//         that maps to no site serves none; a draft preview serves only its
//         own site's.
//   SRB5  the media sweep's storage calls, measured at the storage boundary:
//         the earlier walk (unmetered) spends past the budget in one tick on
//         the fixture below (the count is printed and recorded); metered, no tick exceeds the budget (200), and
//         over the following ticks every due session, orphan part and old
//         draft is reclaimed in key order — no item skipped — while an
//         active upload, its parts and every completed file stay.
//   SRB6  unresolved lost-build recovery waits on a schedule: with the
//         evidence unreadable, a pass at the same time does not decide
//         again; each unresolved pass doubles the wait (2, 4, 8 … ≤ 30
//         minutes); however many tries, nothing is settled, refunded or
//         published; restored, the first due pass settles it once; a
//         duplicate run at the same time changes nothing.
//   SRB7  the review reconcile (Edit/Add-on) waits on the same schedule; its
//         schedule goes once the job is decided.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { envFor } from "./fixtures/live-ask.mjs";
import { mediaMetadata, ifRangeHolds, MEDIA_DRAFT_MS } from "../site-media.mjs";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { resultKey, jobMetaKey, packJobMeta } from "../builder/build-job.mjs";
import { stageBuild, activateBuild } from "../site-builds.mjs";
import { saveAsDraft, DRAFT_KEY, previewLabel } from "../site-draft.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const HOUR = 3600 * 1000;

// ── serving ──────────────────────────────────────────────────────────────────
const VIDEO = (n) => { const b = new Uint8Array(4096); b.set([0x1a, 0x45, 0xdf, 0xa3]); b.fill(n, 16); return b; };
const NAME = "a".repeat(32) + ".webm";
async function putVideo(store, slug, bytes, name = NAME) {
  await store.put("uploads/" + slug + "/" + name, bytes, { httpMetadata: { contentType: "video/webm" }, customMetadata: mediaMetadata({ name: "clip.webm", kind: "video" }) });
}
async function get(worker, env, host, path, headers = {}) {
  const r = await worker.fetch(new Request("https://" + host + path, { headers }), env, makeCtx());
  return { status: r.status, headers: r.headers, bytes: new Uint8Array(await r.arrayBuffer()) };
}

test("SRB1 IF-RANGE — a strong tag equal to the file's keeps the range (206); another tag, a weak tag, a stale date or nonsense answers the whole current file (200); the file's own upload date keeps it", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = { SITES_BUCKET: store };
  await putVideo(store, "play-a", VIDEO(1));
  const head = await store.head("uploads/play-a/" + NAME);
  const tag = head.httpEtag;
  const path = "/u/play-a/" + NAME;
  const r206 = await get(worker, env, "gofarther.dev", path, { range: "bytes=0-99", "if-range": tag });
  assert.deepEqual([r206.status, r206.headers.get("content-range"), r206.bytes.length], [206, "bytes 0-99/4096", 100]);
  for (const [why, v] of [["another tag", '"not-this-one"'], ["a weak tag", "W/" + tag], ["a stale date", new Date(head.uploaded.getTime() - 3600e3).toUTCString()], ["nonsense", "yesterday-ish"]]) {
    const r = await get(worker, env, "gofarther.dev", path, { range: "bytes=0-99", "if-range": v });
    assert.deepEqual([r.status, r.headers.get("content-range"), r.bytes.length], [200, null, 4096], why + " kept the range");
  }
  const byDate = await get(worker, env, "gofarther.dev", path, { range: "bytes=0-99", "if-range": head.uploaded.toUTCString() });
  assert.equal(byDate.status, 206, "the file's own upload date did not keep the range");
  // THE RULE ITSELF.
  assert.equal(ifRangeHolds(null, tag, head.uploaded), true);
  assert.equal(ifRangeHolds(tag, "W/" + tag, head.uploaded), false, "a weak current tag matched");
});

test("SRB2 A REPLACEMENT BETWEEN THE HEAD AND THE READ — never a range of the new file under the old length and tag: the new file whole with its own tag; then the old tag answers 200 and the new tag 206", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = { SITES_BUCKET: store };
  const key = "uploads/play-b/" + NAME;
  await putVideo(store, "play-b", VIDEO(1));
  const old = (await store.head(key)).httpEtag;
  // THE REPLACEMENT LANDS RIGHT AFTER THE ROUTE READS THE HEAD.
  const realHead = store.head.bind(store);
  let swap = true;
  store.head = async (k) => { const h = await realHead(k); if (swap && k === key) { swap = false; await putVideo(store, "play-b", VIDEO(2).subarray(0, 3000)); } return h; };
  const r = await get(worker, env, "gofarther.dev", "/u/play-b/" + NAME, { range: "bytes=100-199" });
  const now = (await store.head(key)).httpEtag;
  assert.notEqual(now, old);
  assert.equal(r.status, 200, "a range was served across a replacement");
  assert.equal(r.headers.get("etag"), now, "the new bytes were labelled with the old tag");
  assert.equal(r.bytes.length, 3000);
  assert.equal(r.bytes[100], 2, "the bytes are not the new file's");
  const stale = await get(worker, env, "gofarther.dev", "/u/play-b/" + NAME, { range: "bytes=0-9", "if-range": old });
  assert.deepEqual([stale.status, stale.bytes.length], [200, 3000]);
  const fresh = await get(worker, env, "gofarther.dev", "/u/play-b/" + NAME, { range: "bytes=0-9", "if-range": now });
  assert.deepEqual([fresh.status, fresh.bytes.length], [206, 10]);
});

test("SRB3 A REPLACEMENT BEFORE AND AFTER PUBLISH — the publish copy puts the new bytes at the same address: a player holding the old tag keeps its range before Publish and gets the whole new file after", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = { SITES_BUCKET: store };
  await putVideo(store, "play-c", VIDEO(1));
  // THE HELD REPLACEMENT'S STAND-IN, under its own name until Publish.
  const STAND = "b".repeat(32) + ".webm";
  await putVideo(store, "play-c", VIDEO(3), STAND);
  const old = (await store.head("uploads/play-c/" + NAME)).httpEtag;
  const before = await get(worker, env, "gofarther.dev", "/u/play-c/" + NAME, { range: "bytes=0-9", "if-range": old });
  assert.deepEqual([before.status, before.bytes[0], before.bytes.length], [206, 0x1a, 10]);
  // PUBLISH: the stand-in's bytes copied to the live name.
  await putVideo(store, "play-c", store.raw("uploads/play-c/" + STAND));
  const after = await get(worker, env, "gofarther.dev", "/u/play-c/" + NAME, { range: "bytes=0-9", "if-range": old });
  assert.equal(after.status, 200, "an old player's range was answered from the published replacement");
  assert.equal(after.bytes[20], 3);
  assert.notEqual(after.headers.get("etag"), old);
});

test("SRB4 /u/ IS TIED TO ITS HOST — a site's label, its current name and its custom domain serve its own uploads and 404 another's; the app's host serves every site's; an unmapped domain none; a preview only its own site's", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const A = "tieda-" + Math.random().toString(16).slice(2, 6), Bs = "tiedb-" + Math.random().toString(16).slice(2, 6), NEWNAME = "renamed-" + Math.random().toString(16).slice(2, 6);
  await putVideo(store, A, VIDEO(1));
  await putVideo(store, Bs, VIDEO(2));
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/rest/v1/site_aliases") && u.includes("alias=eq." + NEWNAME)) return json([{ slug: A, current: true }]);
    if (u.includes("/rest/v1/site_aliases") && u.includes("slug=eq." + A)) return json([{ alias: NEWNAME }]);
    if (u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/rest/v1/site_domains") && u.includes("hostname=eq.shop.example.com")) return json([{ slug: A }]);
    if (u.includes("/rest/v1/site_domains")) return json([]);
    return json([]);
  };
  try {
    // THE PREVIEW NEEDS THE SITE-SCRIPTS BINDING PRESENT (its `/u/` never calls it).
    const env = { SITES_BUCKET: store, SUPABASE_SERVICE_KEY: "svc", SITE_WORKERS: { get: () => ({ fetch: async () => new Response("script") }) } };
    const own = (host, slug) => get(worker, env, host, "/u/" + slug + "/" + NAME);
    assert.equal((await own(Bs + ".gofarther.app", Bs)).status, 200, "a site's own label does not serve its own upload");
    assert.equal((await own(Bs + ".gofarther.app", A)).status, 404, "another site's upload was served on a site's label");
    assert.equal((await own("gofarther.dev", A)).status, 200, "the app's host does not serve uploads");
    assert.equal((await own("gofarther.dev", Bs)).status, 200);
    assert.equal((await own(NEWNAME + ".gofarther.app", A)).status, 200, "a renamed site's current name does not serve its own upload");
    assert.equal((await own(NEWNAME + ".gofarther.app", Bs)).status, 404);
    assert.equal((await own("shop.example.com", A)).status, 200, "a custom domain does not serve its site's upload");
    assert.equal((await own("shop.example.com", Bs)).status, 404, "a custom domain served another site's upload");
    assert.equal((await own("nobody.example.org", A)).status, 404, "an unmapped domain served an upload");
    // THE PREVIEW: its own site's file through the platform route, never another's.
    const token = [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, "0")).join("");
    await store.put(DRAFT_KEY(A), JSON.stringify({ v: 2, version: "01790000000001-aaaaaa", build: "", base: "", job: null, at: new Date().toISOString(), history: [], preview: token, rev: 1, revs: [{ n: 1, version: "01790000000001-aaaaaa", at: "x", job: null }], applied: 0, refs: {} }));
    const ph = previewLabel(A, token) + ".gofarther.app";
    assert.equal((await get(worker, env, ph, "/u/" + A + "/" + NAME)).status, 200, "the preview does not serve its own site's upload");
    assert.equal((await get(worker, env, ph, "/u/" + Bs + "/" + NAME)).status, 404, "the preview served another site's upload");
  } finally { globalThis.fetch = real; }
});

// ── the media sweep's storage calls ─────────────────────────────────────────
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const hex = (n, w = 32) => n.toString(16).padStart(w, "0");
const SCOPE = "site-budget";
async function session(store, sid, expires, { state = "open" } = {}) {
  await store.put("media-sessions/" + SCOPE + "/" + sid + ".json", JSON.stringify({ v: 1, id: sid, scope: SCOPE, state, key: "uploads/budget/" + sid.slice(0, 8) + ".webm", uploadId: "u-" + sid.slice(0, 6), expires, name: sid.slice(0, 8) + ".webm", kind: "video", size: 6_000_000, parts: 2 }));
}
async function part(store, sid, n, at) {
  const k = "media-parts/" + SCOPE + "/" + sid + "/" + n;
  await store.put(k, "", { customMetadata: { etag: "e" + n } });
  store.store.get(k).at = at;
}
async function keys(store, prefix) {
  const out = []; let cursor;
  for (;;) { const p = await store.list({ prefix, cursor }); out.push(...p.objects.map((o) => o.key)); if (!p.truncated) return out.sort(); cursor = p.cursor; }
}
/** 30 expired sessions with 12 parts each, one active session with its parts, 60 orphaned parts, 60 old drafts and 5 young ones, and completed files. */
async function fixture() {
  const store = mediaBucket({ pageSize: 1000 });
  for (let i = 0; i < 30; i++) { const sid = hex(0x100 + i); await session(store, sid, NOW - 5 * HOUR); for (let n = 1; n <= 12; n++) await part(store, sid, n, NOW - 6 * HOUR); }
  const active = hex(0x50);
  await session(store, active, NOW + 20 * HOUR);
  for (let n = 1; n <= 3; n++) await part(store, active, n, NOW - 40 * HOUR);
  for (let i = 0; i < 60; i++) await part(store, hex(0x900 + i), 1, NOW - 40 * HOUR);
  for (let i = 0; i < 60; i++) { const k = "drafts/u-old/" + hex(i, 8) + ".webm"; await store.put(k, "x"); store.store.get(k).at = NOW - MEDIA_DRAFT_MS - 48 * HOUR; }
  for (let i = 0; i < 5; i++) { const k = "drafts/u-new/" + hex(i, 8) + ".webm"; await store.put(k, "x"); store.store.get(k).at = NOW - HOUR; }
  for (let i = 0; i < 4; i++) await store.put("uploads/budget/done" + i + ".webm", "bytes");
  return { store, active };
}

test("SRB5 THE MEDIA SWEEP'S STORAGE CALLS, MEASURED — unmetered, one tick spends past the budget on this fixture; metered, no tick exceeds the budget, and over the next ticks every due item is reclaimed in key order while the active upload, its parts and every completed file stay", async () => {
  const mod = await loadWorkerModule();
  // THE EARLIER WALK, UNMETERED, ON THE SAME FIXTURE.
  {
    const { store } = await fixture();
    const before = store.calls.length;
    await mod.runMediaSweep(envFor(store), { now: NOW, calls: { sessions: 1e9, parts: 1e9, drafts: 1e9, cursor: 1e9 } });
    const spent = store.calls.length - before;
    assert.ok(spent > 200, "the unmetered tick spent " + spent + " calls, within the budget — the fixture does not show the problem");
    console.log("SRB5 unmetered tick: " + spent + " storage calls");
  }
  const { store, active } = await fixture();
  const env = envFor(store);
  const perTick = [];
  for (let t = 0; t < 40; t++) {
    const before = store.calls.length;
    const r = await mod.runMediaSweep(env, { now: NOW });
    const spent = store.calls.length - before;
    perTick.push(spent);
    assert.ok(spent <= 200, "tick " + t + " spent " + spent + " storage calls, past its budget: " + JSON.stringify(r.calls));
    assert.equal(r.calls.total, spent, "the sweep's own count disagrees with the storage boundary");
    const left = (await keys(store, "media-sessions/")).length + (await keys(store, "media-parts/")).length + (await keys(store, "drafts/u-old/")).length;
    if (left === 1 + 3) break;
  }
  console.log("SRB5 metered ticks: " + perTick.join(","));
  assert.deepEqual(await keys(store, "media-sessions/"), ["media-sessions/" + SCOPE + "/" + active + ".json"], "not every expired session was reclaimed, or the active one was");
  assert.equal((await keys(store, "media-parts/")).length, 3, "orphaned parts remain, or the active session's were removed");
  assert.equal((await keys(store, "drafts/u-old/")).length, 0, "old drafts remain");
  assert.equal((await keys(store, "drafts/u-new/")).length, 5, "a young draft was removed");
  assert.equal((await keys(store, "uploads/budget/done")).length, 4, "a completed file was deleted");
  assert.ok(perTick.length > 2, "everything fit one tick — the budget was never exercised");
});

// ── recovery on a schedule ──────────────────────────────────────────────────
const SLUG = "harbour-loaf";
const V2 = "01791429280760-09n7s1";
function depsOf(b) {
  return { get: (k) => b.get(k), put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined), remove: (k) => b.delete(k), list: async (prefix) => (await b.list({ prefix })).objects };
}
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "f1a2b3c4d50718293a4b5c6d7e8f9";

test("SRB6 UNRESOLVED LOST-BUILD RECOVERY WAITS ON A SCHEDULE — the evidence unreadable: not decided again before its time; each unresolved pass doubles the wait up to 30 minutes; however many tries, nothing settled, refunded or published; restored, the first due pass settles it once; a duplicate run changes nothing", async () => {
  const mod = await loadWorkerModule();
  const id = newId();
  const b = buildBucket();
  // A DRAFT SAVE, THEN THE EARLIER CODE'S MARKER, THEN THE DRAFT UNREADABLE.
  b.store.set(jobMetaKey(id), JSON.stringify(packJobMeta({ fenced: true })));
  await stageBuild(depsOf(b), { slug: SLUG, version: V2, files: { "index.html": { t: "x" } }, state: { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" }, manifest: { job: id, at: 1 } });
  await mod.claimBuildFence({ SITES_BUCKET: b }, id, "publish");
  assert.equal((await activateBuild(depsOf(b), { slug: SLUG, version: V2, job: id, expectEtag: null, asDraft: saveAsDraft, putWorker: async () => ({ ok: true }) })).ok, true);
  b.store.set("jobs/" + id + ".fence.json", JSON.stringify({ by: "publish", published: V2 }));
  const good = b.store.get(DRAFT_KEY(SLUG));
  b.store.set(DRAFT_KEY(SLUG), "{broken");
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const refunds = [];
  // THE FRESH LISTING ANSWERS THE ROW ONCE (the cursor moves past it); the
  // pending entry's read by id answers it every time.
  let freshSeen = false;
  const pass = async (now) => {
    const real = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = String((input && input.url) || input || "");
      if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) { refunds.push(u); return json({ ok: true, refunded: 2, already: 0, debited: 2 }); }
      if (u.includes("/rest/v1/edit_jobs") && u.includes("id=in.")) return json([row]);
      if (u.includes("/rest/v1/edit_jobs")) { if (freshSeen) return json([]); freshSeen = true; return json([row]); }
      return json([]);
    };
    try { return await mod.reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now }); }
    finally { globalThis.fetch = real; }
  };
  const T0 = Date.parse("2026-10-08T12:00:00Z");
  const meta = () => { const o = b.meta ? b.meta.get("recovery/pending/" + id) : null; return o; };
  const decided = () => b.store.has(resultKey(id)) || b.store.has("jobs/" + id + ".lost.json");
  // FIRST PASS: unknown, scheduled two minutes on.
  let r = await pass(T0);
  assert.equal(r.unknown, 1, JSON.stringify(r));
  // A DUPLICATE RUN AT THE SAME TIME, AND ONE A MINUTE ON: not due.
  r = await pass(T0);
  assert.deepEqual([r.deferred, r.unknown], [1, 0], "a pass before its time asked again: " + JSON.stringify(r));
  r = await pass(T0 + 60e3);
  assert.equal(r.deferred, 1);
  // THE WAITS DOUBLE, CAPPED: each due pass leaves it unresolved.
  const waits = [];
  let at = T0, last = T0;
  for (let i = 0; i < 9; i++) {
    const entry = JSON.parse(b.store.get("recovery/pending/" + id));
    waits.push(entry.next - last);
    last = entry.next;
    at = entry.next;
    r = await pass(at);
    assert.equal(r.unknown, 1, "a due pass did not ask: " + JSON.stringify(r));
    assert.equal(decided(), false, "uncertainty became an outcome after " + (i + 2) + " tries");
  }
  assert.deepEqual(waits.slice(0, 5).map((w) => w / 60e3), [2, 4, 8, 16, 30], "the waits do not double up to the cap: " + waits.map((w) => w / 60e3));
  assert.ok(waits.slice(5).every((w) => w === 30 * 60e3), "the wait passed its cap");
  assert.deepEqual(refunds, [], "an unresolved build was refunded");
  assert.equal(b.store.has("current/" + SLUG + ".json"), false);
  // RESTORED: the next due pass settles it, once.
  b.store.set(DRAFT_KEY(SLUG), good);
  const due = JSON.parse(b.store.get("recovery/pending/" + id)).next;
  r = await pass(due);
  assert.equal(r.saved, 1, "the restored evidence was not used: " + JSON.stringify(r));
  const answer = b.store.get(resultKey(id));
  r = await pass(due); r = await pass(due + 60 * 60e3);
  assert.equal(b.store.get(resultKey(id)), answer, "a later pass rewrote the settled answer");
  assert.deepEqual(refunds, []);
});

test("SRB7 THE REVIEW RECONCILE WAITS ON THE SAME SCHEDULE — a row it cannot decide is not asked again before its time; the waits double; decided, its schedule goes", async () => {
  const mod = await loadWorkerModule();
  const b = buildBucket();
  const row = { id: "r".repeat(32).replace(/r/g, "a"), slug: "", state: "publishing", needs_review: true, op: "edit", uid: BUILD_USER.id };
  let asks = 0;
  const pass = async (now) => {
    const real = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = String((input && input.url) || input || "");
      if (u.includes("/rest/v1/edit_jobs") && u.includes("needs_review=eq.true")) return json([row]);
      if (u.includes("/rest/v1/edit_jobs")) { asks++; return json([row]); }
      return json([]);
    };
    try { return await mod.runReviewReconcile({ SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b }, { now }); }
    finally { globalThis.fetch = real; }
  };
  const T0 = Date.parse("2026-10-08T12:00:00Z");
  const sched = () => { const t = b.store.get("recovery/review/" + row.id + ".json"); return t ? JSON.parse(t) : null; };
  await pass(T0);
  const first = sched();
  assert.ok(first && first.tries === 1 && first.next === T0 + 2 * 60e3, "the unresolved row was not scheduled: " + JSON.stringify(first));
  await pass(T0 + 60e3);
  assert.equal(sched().tries, 1, "a pass before its time asked again");
  await pass(first.next);
  assert.deepEqual([sched().tries, sched().next - first.next], [2, 4 * 60e3]);
  assert.equal(mod.recoveryDelay(1), 2 * 60e3);
  assert.equal(mod.recoveryDelay(50), 30 * 60e3);
});

test("SRB5b A SHARE SPENT MID-ITEM — small shares cut items short: no tick passes its total share by a single call; every session at or before the kept place is gone, and the first session after it, cut short, is still there and handled from the start next lap; all of it reclaimed in the end", async () => {
  const mod = await loadWorkerModule();
  const { store, active } = await fixture();
  const env = envFor(store);
  const share = { sessions: 30, parts: 10, drafts: 10, cursor: 1 };
  const total = share.sessions + share.parts + share.drafts + share.cursor;
  let cutSeen = false;
  for (let t = 0; t < 80; t++) {
    const before = store.calls.length;
    const r = await mod.runMediaSweep(env, { now: NOW, calls: share });
    const spent = store.calls.length - before;
    assert.ok(spent <= total, "tick " + t + " spent " + spent + " calls, past its share of " + total);
    // EACH PREFIX WITHIN ITS OWN SHARE, and the counts agree with the storage boundary.
    for (const k of ["sessions", "parts", "drafts", "cursor"]) assert.ok(r.calls[k] <= share[k], "tick " + t + ": " + k + " spent " + r.calls[k] + ", past its share of " + share[k]);
    assert.equal(r.calls.total, spent);
    const cur = JSON.parse(store.raw("media-sweep/cursor.json") ? new TextDecoder().decode(store.raw("media-sweep/cursor.json")) : "{}");
    const kept = cur.after && cur.after.sessions;
    if (r.stopped && r.stopped.sessions && kept) {
      const left = (await keys(store, "media-sessions/")).filter((k) => !k.includes(active));
      assert.ok(left.every((k) => k > kept), "a session at or before the kept place " + kept + " is still there: " + left.filter((k) => k <= kept).join(","));
      if (left.length) cutSeen = true;
    }
    const remaining = (await keys(store, "media-sessions/")).length + (await keys(store, "media-parts/")).length + (await keys(store, "drafts/u-old/")).length;
    if (remaining === 1 + 3) break;
  }
  assert.ok(cutSeen, "no tick stopped mid-sessions — this case tests nothing");
  assert.deepEqual(await keys(store, "media-sessions/"), ["media-sessions/" + SCOPE + "/" + active + ".json"]);
  assert.equal((await keys(store, "media-parts/")).length, 3);
  assert.equal((await keys(store, "drafts/u-old/")).length, 0);
  assert.equal((await keys(store, "uploads/budget/done")).length, 4);
});
