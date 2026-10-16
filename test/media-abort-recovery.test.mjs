// AN ABORT IS PROVEN BEFORE ITS RECORDS GO (2026-10-16, Codex's review of
// `ea9a2b71`).
//
// `runMediaSweep` caught every multipart abort error as "already gone", then
// dropped the session and part records and counted the session reclaimed.
// Codex injected one transient abort failure: the multipart upload remained,
// its session disappeared, and three ticks made only one abort attempt — the
// upload was named by nothing any more. The ledger's own expiry
// (`changeLedger`) and a cancelled upload (`abortQuietly`) did the same, and the
// sweep ignored `releaseMedia`'s returned failure.
//
// R2 here answers an abort as R2 does (`r2-media.mjs`): an upload that is not
// there is refused with NoSuchUpload (10024) — proof it is gone; any other
// failure proves nothing.
//
//   MAR1  a failed abort, then recovery: the first tick keeps the session and
//         its parts (the upload still there), the next tick aborts again and
//         reclaims it — two abort attempts, not one
//   MAR2  an upload already absent (R2 says NoSuchUpload): reclaimed at once
//   MAR3  a lost answer: the abort landed, its answer did not — kept; the next
//         tick's abort is told NoSuchUpload, which proves it, and reclaims it
//   MAR4  the room not given back (`releaseMedia` answers a refusal, no throw):
//         the session is kept and reclaimed on a later tick
//   MAR5  the ledger's own expiry: an expired reservation whose abort fails
//         keeps its session record, and the sweep later stops the upload and
//         reclaims it; CONTROL — whose abort succeeds drops it, as before
//   MAR6  a cancelled upload whose abort fails: the session is kept as
//         `aborting` (no part is taken, nothing finishes), its room given
//         back, and the next tick stops it and reclaims it
//   MAR7  completed files and active uploads are untouched through all of it
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { MEDIA_PART_BYTES } from "../site-media.mjs";

const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
const DAY = 24 * 3600 * 1000;

async function hit(worker, env, method, host, path, { json, body, headers = {} } = {}) {
  const init = { method, headers: { Authorization: "Bearer t", ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const ctx = makeCtx();
  const res = await worker.fetch(new Request("https://" + host + path, init), env, ctx);
  const buf = new Uint8Array(await res.arrayBuffer());
  await Promise.allSettled(ctx.pending);
  let parsed = null; try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}
const app = (w, e, m, p, o) => hit(w, e, m, "gofarther.dev", p, o);
async function upload(worker, env, slug, bytes, name) {
  const base = "/api/site/" + slug + "/media";
  const st = await app(worker, env, "POST", base, { json: { name, size: bytes.length, type: "" } });
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await app(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    parts.push({ n, etag: p.body.etag });
  }
  const done = await app(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}
/** An upload started and given one part, then left: its multipart upload open in R2. */
async function abandoned(worker, env, slug, name = "Abandoned.webm") {
  const big = new Uint8Array(MEDIA_PART_BYTES + 1000); big.set(fixture("clip.webm"));
  const st = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name, size: big.length, type: "" } });
  assert.equal(st.status, 201, JSON.stringify(st.body));
  const p = await app(worker, env, "PUT", "/api/site/" + slug + "/media/" + st.body.session + "/1", { body: big.subarray(0, MEDIA_PART_BYTES) });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return { sid: st.body.session, big };
}
async function keys(store, prefix) {
  const out = []; let cursor;
  for (;;) { const p = await store.list({ prefix, cursor }); out.push(...p.objects.map((o) => o.key)); if (!p.truncated) return out.sort(); cursor = p.cursor; }
}
const sessKey = (slug, sid) => "media-sessions/site-" + slug + "/" + sid + ".json";
const openUploads = (store) => [...store.uploads.values()].filter((u) => !u.done).length;
const aborts = (store) => store.calls.filter((c) => c === "abort").length;
const LATER = () => Date.now() + 2 * DAY;

/** A finished file and a fresh, active upload beside the case: MAR7's witnesses. */
async function witnesses(worker, env, slug) {
  const done = await upload(worker, env, slug, fixture("tone.mp3"), "Kept.mp3");
  assert.equal(done.done.status, 201);
  return { done };
}
async function witnessesStand(worker, env, store, slug, w, fresh) {
  assert.ok(await store.head("uploads/" + slug + "/" + w.done.done.body.name), "a completed file was deleted");
  assert.equal((await hit(worker, env, "GET", slug + ".gofarther.app", w.done.done.body.url)).status, 200, "a completed file no longer plays");
  if (fresh) {
    assert.ok(await store.head(sessKey(slug, fresh)), "an active upload's session was reclaimed");
    assert.equal(fresh && [...store.uploads.values()].some((u) => !u.done), true, "an active upload's multipart upload was stopped");
  }
}

test("MAR1 A FAILED ABORT, THEN RECOVERY — the first tick keeps the session and its parts with the upload still open; the next tick aborts again and reclaims it (two attempts, not one)", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  const slug = "mar1"; const store = mediaBucket({ pageSize: 1000 }); const env = envFor(store);
  await withWire({}, async () => {
    const w = await witnesses(worker, env, slug);
    const { sid } = await abandoned(worker, env, slug);
    assert.equal(openUploads(store), 1);
    store.calls.length = 0;
    store.failNext("abort", 1);
    const t1 = await mod.runMediaSweep(env, { now: LATER() });
    // (The finished witness's own session expired too and is reclaimed: it is
    // the abandoned one that must stay.)
    assert.ok(t1.retried >= 1, JSON.stringify(t1));
    assert.ok(await store.head(sessKey(slug, sid)), "the session record went although its upload was not stopped");
    assert.ok((await keys(store, "media-parts/site-" + slug + "/" + sid + "/")).length >= 1, "the part records went although the upload was not stopped");
    assert.equal(openUploads(store), 1, "the case did not leave the upload open — it tests nothing");
    const t2 = await mod.runMediaSweep(env, { now: LATER() });
    assert.ok(t2.reclaimed >= 1, JSON.stringify(t2));
    assert.equal(openUploads(store), 0, "the next tick did not stop the upload");
    assert.equal(aborts(store), 2, "not exactly two abort attempts over the two ticks");
    assert.equal(await store.head(sessKey(slug, sid)), null);
    assert.deepEqual(await keys(store, "media-parts/"), []);
    await witnessesStand(worker, env, store, slug, w, null);
  });
});

test("MAR2 AN UPLOAD ALREADY ABSENT — R2 answers NoSuchUpload, which proves it gone: reclaimed on the first tick", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  const slug = "mar2"; const store = mediaBucket({ pageSize: 1000 }); const env = envFor(store);
  await withWire({}, async () => {
    const { sid } = await abandoned(worker, env, slug);
    store.uploads.clear();
    const t1 = await mod.runMediaSweep(env, { now: LATER() });
    assert.equal(t1.reclaimed, 1, JSON.stringify(t1));
    assert.equal(await store.head(sessKey(slug, sid)), null);
  });
});

test("MAR3 A LOST ANSWER — the abort landed but its answer did not: kept; the next tick is told NoSuchUpload and reclaims it", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  const slug = "mar3"; const store = mediaBucket({ pageSize: 1000, lose: { abort: 1 } }); const env = envFor(store);
  await withWire({}, async () => {
    const { sid } = await abandoned(worker, env, slug);
    const t1 = await mod.runMediaSweep(env, { now: LATER() });
    assert.equal(openUploads(store), 0, "the lost-answer abort did not land — the case tests nothing");
    assert.equal(t1.reclaimed, 0, "an abort whose answer was lost was taken as proof: " + JSON.stringify(t1));
    assert.ok(await store.head(sessKey(slug, sid)));
    const t2 = await mod.runMediaSweep(env, { now: LATER() });
    assert.equal(t2.reclaimed, 1, JSON.stringify(t2));
    assert.equal(await store.head(sessKey(slug, sid)), null);
  });
});

test("MAR4 THE ROOM NOT GIVEN BACK — `releaseMedia` answers a refusal without throwing: the session is kept, and reclaimed on a later tick", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  const slug = "mar4"; const store = mediaBucket({ pageSize: 1000 }); const env = envFor(store);
  await withWire({}, async () => {
    const { sid } = await abandoned(worker, env, slug);
    const ledgerKey = "media-ledger/site-" + slug + ".json";
    const realPut = store.put.bind(store);
    let refuse = 8;
    store.put = async (k, v, o) => (k === ledgerKey && refuse-- > 0 ? null : realPut(k, v, o));
    const t1 = await mod.runMediaSweep(env, { now: LATER() });
    assert.ok(refuse <= 0, "the ledger was never asked — the case tests nothing");
    assert.equal(t1.reclaimed, 0, "a session whose room was not given back was dropped: " + JSON.stringify(t1));
    assert.ok(await store.head(sessKey(slug, sid)));
    const t2 = await mod.runMediaSweep(env, { now: LATER() });
    assert.equal(t2.reclaimed, 1, JSON.stringify(t2));
    const l = JSON.parse(await (await store.get(ledgerKey)).text());
    assert.equal(Object.hasOwn(l.held, sid), false, "the room was never given back");
  });
});

test("MAR5 THE LEDGER'S OWN EXPIRY — an expired reservation whose abort fails keeps its session; the sweep later stops it and reclaims it; CONTROL: one whose abort succeeds is dropped as before", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  for (const fail of [true, false]) {
    const slug = fail ? "mar5" : "mar5c"; const store = mediaBucket({ pageSize: 1000 }); const env = envFor(store);
    await withWire({}, async () => {
      const { sid } = await abandoned(worker, env, slug);
      // ITS RESERVATION EXPIRED (the session's own record still in its day).
      const ledgerKey = "media-ledger/site-" + slug + ".json";
      const l = JSON.parse(await (await store.get(ledgerKey)).text());
      assert.ok(l.held[sid] && l.held[sid].uploadId, "the reservation does not name its upload — the case tests nothing");
      l.held[sid].expires = Date.now() - 1000;
      await store.put(ledgerKey, JSON.stringify(l));
      if (fail) store.failNext("abort", 1);
      store.calls.length = 0;
      // ANOTHER UPLOAD STARTS: its ledger change drops the expired entry.
      const other = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Other.mp3", size: 1000, type: "" } });
      assert.equal(other.status, 201, JSON.stringify(other.body));
      assert.ok(store.calls.includes("abort"), "the ledger's expiry did not try the abort");
      if (!fail) { assert.equal(await store.head(sessKey(slug, sid)), null, "CONTROL: a proven abort did not drop the session"); return; }
      assert.ok(await store.head(sessKey(slug, sid)), "the ledger's expiry dropped a session whose upload was not stopped");
      assert.equal(openUploads(store) >= 1, true);
      const t = await mod.runMediaSweep(env, { now: LATER() });
      assert.ok(t.reclaimed >= 1, JSON.stringify(t));
      assert.equal(await store.head(sessKey(slug, sid)), null);
      assert.equal([...store.uploads.entries()].some(([, u]) => !u.done && String(u.key).includes("uploads/")) && store.uploads.size > 1, false);
    });
  }
});

test("MAR6 A CANCELLED UPLOAD WHOSE ABORT FAILS — kept as `aborting`: no part is taken and it cannot finish, its room is given back, and the next tick stops it and reclaims it", async () => {
  const worker = await loadWorker(); const mod = await loadWorkerModule();
  const slug = "mar6"; const store = mediaBucket({ pageSize: 1000 }); const env = envFor(store);
  await withWire({}, async () => {
    const w = await witnesses(worker, env, slug);
    const fresh = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Fresh.mp3", size: 2000, type: "" } });
    const { sid, big } = await abandoned(worker, env, slug);
    store.failNext("abort", 1);
    const cancel = await app(worker, env, "DELETE", "/api/site/" + slug + "/media/" + sid);
    assert.ok(cancel.status < 300, JSON.stringify(cancel.body));
    const s = JSON.parse(await (await store.get(sessKey(slug, sid))).text());
    assert.equal(s.state, "aborting", "a cancel whose abort failed did not keep the session for the tick: " + JSON.stringify(s.state));
    const part = await app(worker, env, "PUT", "/api/site/" + slug + "/media/" + sid + "/2", { body: big.subarray(MEDIA_PART_BYTES) });
    assert.equal(part.status, 404, "an upload being stopped took a part");
    const l = JSON.parse(await (await store.get("media-ledger/site-" + slug + ".json")).text());
    assert.equal(Object.hasOwn(l.held, sid), false, "the cancelled upload's room was not given back");
    // THE NEXT TICK, at once (an `aborting` session is due without waiting for its expiry).
    const t = await mod.runMediaSweep(env, { now: Date.now() });
    assert.equal(t.reclaimed, 1, JSON.stringify(t));
    assert.equal(await store.head(sessKey(slug, sid)), null);
    await witnessesStand(worker, env, store, slug, w, fresh.body.session);
  });
});
