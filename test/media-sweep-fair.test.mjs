// THE MEDIA SWEEP IS FAIR, BOUNDED AND RESTARTABLE (2026-10-16, Codex's review
// of `fbd53dca`).
//
// Codex reproduced two defects in `runMediaSweep`: it listed 100 sessions,
// looked at 25 and KEPT its incoming cursor whenever it reached 25 — so 25 live
// sessions at the front kept an expired 26th from ever being looked at (four
// ticks reclaimed nothing; a larger budget reclaimed it) — and the parts and
// drafts passes always listed their first page, so an expired 101st draft
// stayed behind 100 young ones. The fixture's two-object pages had hidden both.
// Every case here lists as R2 does (`pageSize: 1000`: a page is as long as the
// `limit` asked), with more records than a tick's budget and retained records
// sorting BEFORE the expired ones, over several ticks.
//
//   MSF1  25 live sessions ahead of an expired 26th: the expired one is
//         reclaimed within two ticks at the default budget; the live ones and
//         their parts are untouched however many ticks run
//   MSF2  100 young pre-site drafts ahead of an expired 101st: it goes within
//         ceil(101 / 50) ticks; none of the young ones goes
//   MSF3  part records of a live session (old by their date) ahead of orphaned
//         ones: the orphans go; the live session's parts stay
//   MSF4  restarts and deletions: the place is a key — the key it names deleted
//         by someone else, the cursor file deleted, or the cursor file garbage —
//         and the sweep still reaches every expired record, never skipping one
//   MSF5  an item that fails is looked at again on the next lap: an expired
//         session whose object check fails once is reclaimed on a later lap
//   MSF6  nothing referenced is ever deleted: the files under `uploads/` and an
//         unexpired session survive hundreds of ticks; the walk is bounded per
//         tick (no tick looks at more than its budget)
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { MEDIA_DRAFT_MS } from "../site-media.mjs";

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const hex = (n, w = 32) => n.toString(16).padStart(w, "0");
const SCOPE = "site-fair";

/** A session record as `handleMediaStart` leaves it, expiring at `expires`. */
async function session(store, sid, expires, { state = "open", key = "uploads/fair/" + sid.slice(0, 8) + ".webm", uploadId = "u-" + sid.slice(0, 6) } = {}) {
  await store.put("media-sessions/" + SCOPE + "/" + sid + ".json", JSON.stringify({ v: 1, id: sid, scope: SCOPE, state, key, uploadId, expires, name: sid.slice(0, 8) + ".webm", kind: "video", size: 6_000_000, parts: 2 }));
}
/** A part record, dated `at`. */
async function part(store, sid, n, at) {
  const k = "media-parts/" + SCOPE + "/" + sid + "/" + n;
  await store.put(k, "", { customMetadata: { etag: "e" + n } });
  store.store.get(k).at = at;
  return k;
}
/** Every key under a prefix, across every page. */
async function keys(store, prefix) {
  const out = []; let cursor;
  for (;;) { const p = await store.list({ prefix, cursor }); out.push(...p.objects.map((o) => o.key)); if (!p.truncated) return out.sort(); cursor = p.cursor; }
}
async function ticks(mod, env, n, now = NOW, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await mod.runMediaSweep(env, { now, ...opts }));
  return out;
}

test("MSF1 25 LIVE SESSIONS AHEAD OF AN EXPIRED 26TH — reclaimed within two ticks at the default budget; the live ones and their parts untouched over many ticks", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  const live = [];
  for (let i = 0; i < 25; i++) { const sid = hex(i + 1); live.push(sid); await session(store, sid, NOW + 20 * HOUR); await part(store, sid, 1, NOW - HOUR); }
  const gone = "f".repeat(32);
  await session(store, gone, NOW - 3 * HOUR);
  assert.ok(live.every((s) => s < gone), "the expired session does not sort after the live ones — this case tests nothing");
  const r = await ticks(mod, env, 2);
  assert.equal(r[0].reclaimed + r[1].reclaimed, 1, "the expired 26th session was not reclaimed within two ticks: " + JSON.stringify(r));
  assert.equal(r[0].looked.sessions, 25, "the first tick did not look at exactly its budget: " + JSON.stringify(r[0]));
  assert.equal(await store.head("media-sessions/" + SCOPE + "/" + gone + ".json"), null);
  // MANY MORE TICKS: every live session and its part stay.
  await ticks(mod, env, 12);
  assert.equal((await keys(store, "media-sessions/")).length, 25, "a live session was reclaimed");
  assert.equal((await keys(store, "media-parts/")).length, 25, "a live session's part was removed");
});

test("MSF2 100 YOUNG PRE-SITE DRAFTS AHEAD OF AN EXPIRED 101ST — it goes within ceil(101 / 50) ticks; no young draft goes", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  for (let i = 0; i < 100; i++) { const k = "drafts/u-" + hex(i, 4) + "/" + hex(i) + ".mp3"; await store.put(k, "young"); store.store.get(k).at = NOW - HOUR; }
  const old = "drafts/u-zzzz/" + "e".repeat(32) + ".mp3";
  await store.put(old, "old"); store.store.get(old).at = NOW - MEDIA_DRAFT_MS - 2 * 24 * HOUR;
  const r = await ticks(mod, env, 3);
  assert.equal(r.reduce((n, x) => n + x.drafts, 0), 1, "the expired 101st draft was not removed within three ticks: " + JSON.stringify(r.map((x) => x.drafts)));
  assert.equal(await store.head(old), null);
  await ticks(mod, env, 6);
  assert.equal((await keys(store, "drafts/")).length, 100, "a young pre-site draft was removed");
});

test("MSF3 PART RECORDS OF A LIVE SESSION AHEAD OF ORPHANED ONES — the orphans go; the live session's parts stay", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  const liveSid = hex(1);
  await session(store, liveSid, NOW + 20 * HOUR);
  const kept = [];
  for (let n = 1; n <= 120; n++) kept.push(await part(store, liveSid, n, NOW - 40 * HOUR));
  const orphanSid = "e".repeat(32);
  const orphans = [];
  for (let n = 1; n <= 3; n++) orphans.push(await part(store, orphanSid, n, NOW - 40 * HOUR));
  assert.ok(orphans.every((k) => kept.every((j) => j < k)), "the orphans do not sort after the live parts — this case tests nothing");
  const r = await ticks(mod, env, 3);
  assert.equal(r.reduce((n, x) => n + x.parts, 0), 3, "the orphaned parts behind 120 live ones were not removed: " + JSON.stringify(r.map((x) => x.parts)));
  for (const k of orphans) assert.equal(await store.head(k), null);
  assert.deepEqual(await keys(store, "media-parts/"), kept.slice().sort(), "a live session's part was removed");
});

test("MSF4 RESTARTS AND DELETIONS — the key the place names deleted by someone else, the cursor file deleted, the cursor file garbage: every expired record is still reached and none is skipped", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  const all = [];
  for (let i = 0; i < 90; i++) { const sid = hex(i + 1); all.push(sid); await session(store, sid, i % 3 === 1 ? NOW - 3 * HOUR : NOW + 20 * HOUR); }
  // THE 25TH (the first tick's last) IS LIVE; THE 26TH, RIGHT AFTER IT, IS EXPIRED.
  const expired = all.filter((_, i) => i % 3 === 1);
  const keyOf = (sid) => "media-sessions/" + SCOPE + "/" + sid + ".json";
  // ONE TICK, then the record its place names is deleted by someone else.
  const t1 = await mod.runMediaSweep(env, { now: NOW });
  const place = JSON.parse(await (await store.get("media-sweep/cursor.json")).text());
  assert.equal(place.v, 2);
  assert.equal(typeof place.after.sessions, "string", "the place is not a key: " + JSON.stringify(place));
  await store.delete(place.after.sessions);
  // THE NEXT TICK goes on after it — the 26th session onward, not from the front.
  const t2 = await mod.runMediaSweep(env, { now: NOW });
  assert.equal(t2.looked.sessions, 25, JSON.stringify(t2));
  // A RESTART: the cursor file is gone; then garbage.
  await store.delete("media-sweep/cursor.json");
  await mod.runMediaSweep(env, { now: NOW });
  await store.put("media-sweep/cursor.json", "{not json");
  await ticks(mod, env, 6);
  assert.equal(place.after.sessions, keyOf(all[24]), "the first tick did not stop at its 25th session");
  const left = await keys(store, "media-sessions/");
  for (const sid of expired) assert.ok(!left.includes(keyOf(sid)), "an expired session was skipped: " + sid);
  const liveLeft = all.filter((_, i) => i % 3 !== 1).map(keyOf).filter((k) => k !== place.after.sessions).sort();
  assert.deepEqual(left, liveLeft, "a live session was reclaimed");
  assert.ok(t1.reclaimed >= 1);
});

test("MSF5 A FAILED ITEM IS LOOKED AT AGAIN ON THE NEXT LAP — an expired session whose object check fails once is reclaimed on a later lap", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  for (let i = 0; i < 40; i++) await session(store, hex(i + 1), NOW + 20 * HOUR);
  const sick = hex(41);
  await session(store, sick, NOW - 3 * HOUR);
  // ITS OBJECT CHECK FAILS ONCE (the first `head` the sweep makes for it).
  const realHead = store.head.bind(store);
  let fail = 1;
  store.head = async (k) => { if (k === "uploads/fair/" + sick.slice(0, 8) + ".webm" && fail-- > 0) throw new Error("r2 head failed"); return realHead(k); };
  const first = await ticks(mod, env, 2);
  assert.equal(fail, 0, "the failing check was never reached — this case tests nothing");
  assert.equal(first.reduce((n, x) => n + x.reclaimed, 0), 0, "the session was reclaimed although its check failed");
  assert.ok(await store.head("media-sessions/" + SCOPE + "/" + sick + ".json"), "the failed session was dropped");
  // THE NEXT LAP reaches it again.
  const later = await ticks(mod, env, 3);
  assert.equal(later.reduce((n, x) => n + x.reclaimed, 0), 1, "the failed session was never looked at again: " + JSON.stringify(later));
  assert.equal(await store.head("media-sessions/" + SCOPE + "/" + sick + ".json"), null);
});

test("MSF6 NOTHING REFERENCED IS EVER DELETED, AND EACH TICK IS BOUNDED — the files under `uploads/` and an unexpired session survive hundreds of ticks; no tick looks at more than its budget", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  const files = [];
  for (let i = 0; i < 30; i++) { const k = "uploads/fair/" + hex(i, 8) + ".webm"; await store.put(k, "bytes", { customMetadata: { up: hex(i + 1) } }); files.push(k); }
  // EXPIRED SESSIONS WHOSE BYTES LANDED (finished uploads whose record said open) — their files are kept.
  for (let i = 0; i < 30; i++) await session(store, hex(i + 1), NOW - 3 * HOUR, { key: files[i] });
  const fresh = "f".repeat(32);
  await session(store, fresh, NOW + 20 * HOUR);
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const r = await mod.runMediaSweep(env, { now: NOW, budget: { sessions: 7, parts: 5, drafts: 5 } });
    worst = Math.max(worst, r.looked.sessions);
  }
  assert.ok(worst <= 7, "a tick looked at more than its budget: " + worst);
  assert.deepEqual(await keys(store, "uploads/"), files.slice().sort(), "the sweep deleted a file");
  assert.deepEqual(await keys(store, "media-sessions/"), ["media-sessions/" + SCOPE + "/" + fresh + ".json"], "an unexpired session was reclaimed, or an expired one was left");
});

test("MSF7 A FINISHED PREFIX STARTS AGAIN AT ONCE, AND A PLACE THAT IS NOT THE PREFIX'S IS NOT BELIEVED — a record that sorts before the end, added after a whole lap, is reached on the very next tick; a cursor file naming another prefix's key (or one past every key) reaches the front on its first tick", async () => {
  const mod = await loadWorkerModule();
  const store = mediaBucket({ pageSize: 1000 });
  const env = envFor(store);
  for (let i = 1; i <= 10; i++) { const k = "drafts/u-m/" + hex(i) + ".mp3"; await store.put(k, "young"); store.store.get(k).at = NOW - HOUR; }
  const lap = await mod.runMediaSweep(env, { now: NOW });
  assert.equal(lap.looked.drafts, 10, "the whole prefix was not looked at in one tick: " + JSON.stringify(lap));
  // AFTER THE LAP: an expired draft that sorts FIRST.
  const first = "drafts/u-a/" + hex(0) + ".mp3";
  await store.put(first, "old"); store.store.get(first).at = NOW - MEDIA_DRAFT_MS - 2 * 24 * HOUR;
  const next = await mod.runMediaSweep(env, { now: NOW });
  assert.equal(next.drafts, 1, "the finished prefix did not start again from the front on the next tick: " + JSON.stringify(next));
  // A PLACE THAT IS NOT THE PREFIX'S: another prefix's key, and one past every key.
  for (const foreign of ["drafts/u-z/" + "f".repeat(32) + ".mp3", "zzzz/after-everything"]) {
    const sid = hex(7);
    await session(store, sid, NOW - 3 * HOUR);
    await store.put("media-sweep/cursor.json", JSON.stringify({ v: 2, after: { sessions: foreign, parts: null, drafts: null } }));
    const r = await mod.runMediaSweep(env, { now: NOW });
    assert.equal(r.reclaimed, 1, "a place naming " + foreign + " was believed: the front was not reached on the first tick: " + JSON.stringify(r));
  }
});
