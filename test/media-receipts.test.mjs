// A RECEIPT IS HISTORY, NOT PROOF; A LEDGER THAT COMES BACK TO THE SAME
// RESERVATIONS IS STILL A NEW LEDGER (2026-10-15, Codex's review of `673e26cb`).
//
// Codex reproduced two problems on `673e26cb`:
//   1. a finished upload's saved file was handed back by `status` and by a
//      repeated `complete` without looking at the object, so the page reused
//      (`reused: true`) a file deleted after it was uploaded;
//   2. with R2's real etags (the MD5 of the bytes), a ledger that returned to
//      the identical empty record kept its old etag: a start that had read the
//      scope's usage before another upload took room, finished and gave it
//      back could still write, and admitted 60 more bytes under a 100-byte,
//      one-file limit. The storage double had hidden it by adding a counter to
//      every etag, which R2 does not do.
// Every case here runs the production routes over the corrected double
// (`test/fixtures/r2-media.mjs`), the page's uploader (`public/site-media.js`)
// where a page is involved, and, for the build's move, the real build route.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER } from "./fixtures/build-route.mjs";
import { call, wireApi, memoryStore, fileOf, fixture, noWait, mediaIn, ledgerOf } from "./fixtures/media-wire.mjs";
import { draftScope } from "../site-media.mjs";

const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");

// ── 1. A RECEIPT IS HISTORY ─────────────────────────────────────────────────

test("DELETED AFTER UPLOAD: status says removed, a repeated complete does not bring it back, and the same file attached again is uploaded again — never reused", async () => {
  const worker = await loadWorker();
  const slug = "rcpt-deleted";
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const rec = memoryStore();
    const file = fileOf(fixture("clip.webm"), "Tour.webm");
    const first = await SiteMedia.upload(file, { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug });
    assert.equal(first.ok, true, JSON.stringify(first));
    const session = [...rec.m.values()][0].sid;
    // THE CONTROL: untouched, the same file attached again is reused.
    const control = wireApi(worker, env, base);
    const again = await SiteMedia.upload(file, { api: control, wait: noWait, store: rec, base: "site:" + slug });
    assert.deepEqual([again.ok, again.reused, again.file.name], [true, true, first.file.name]);
    assert.deepEqual(control.calls.filter((k) => k !== "status"), [], "a file still there was sent again");
    // DELETED in the library.
    assert.equal((await call(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + first.file.name)).status, 200);
    const st = await call(worker, env, "GET", base + "/" + session);
    assert.deepEqual([st.status, st.body.state, st.body.finished, st.body.file], [200, "removed", true, undefined], "a deleted file's receipt was answered as the file: " + JSON.stringify(st.body));
    const closes = bucket.calls.filter((c) => c === "complete").length;
    const rep = await call(worker, env, "POST", base + "/" + session + "/complete", { json: { parts: [] } });
    assert.deepEqual([rep.status, rep.body.code, rep.body.url], [410, "removed", undefined], "a repeated complete answered a deleted file");
    assert.equal(bucket.calls.filter((c) => c === "complete").length, closes, "a repeated complete closed an upload again");
    assert.deepEqual(mediaIn(bucket, slug), [], "a repeated complete brought the deleted file back");
    const ab = await call(worker, env, "DELETE", base + "/" + session);
    assert.deepEqual([ab.status, ab.body.file, ab.body.gone], [200, undefined, true]);
    // ATTACHED AGAIN: sent again, as a new file.
    const after = wireApi(worker, env, base);
    const r = await SiteMedia.upload(file, { api: after, wait: noWait, store: rec, base: "site:" + slug });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.reused, undefined, "a deleted file was reused (Codex's reproduction)");
    assert.notEqual(r.file.name, first.file.name);
    assert.ok(after.calls.includes("start") && after.calls.includes("part"), "the file was not sent again");
    assert.deepEqual(mediaIn(bucket, slug), ["uploads/" + slug + "/" + r.file.name]);
    assert.equal((await call(worker, env, "GET", r.file.url)).status, 200);
  });
});

test("REPLACED AT THE SAME ADDRESS: the original's receipt says replaced, a repeated complete leaves the replacement alone, and the original attached again is uploaded as its own file", async () => {
  const worker = await loadWorker();
  const slug = "rcpt-replaced";
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const rec = memoryStore();
    const originalBytes = fixture("tone.mp3");
    const original = fileOf(originalBytes, "Intro.mp3");
    const first = await SiteMedia.upload(original, { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug });
    const session = [...rec.m.values()][0].sid;
    // REPLACED with other bytes, through the same page code.
    const newer = new Uint8Array(originalBytes.length + 64);
    newer.set(originalBytes);
    newer.fill(7, originalBytes.length);
    const swapped = await SiteMedia.upload(fileOf(newer, "Intro v2.mp3"), { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug, replace: first.file.name });
    assert.deepEqual([swapped.ok, swapped.file.name, swapped.file.replaced], [true, first.file.name, true]);
    const key = "uploads/" + slug + "/" + first.file.name;
    assert.deepEqual(bucket.raw(key), newer);
    const st = await call(worker, env, "GET", base + "/" + session);
    assert.deepEqual([st.body.state, st.body.file], ["replaced", undefined], "the original's receipt was answered with the replacement's address");
    const rep = await call(worker, env, "POST", base + "/" + session + "/complete", { json: { parts: [] } });
    assert.deepEqual([rep.status, rep.body.code], [409, "replaced"]);
    assert.deepEqual(bucket.raw(key), newer, "a repeated complete wrote over the newer replacement");
    // THE REPLACEMENT'S OWN RECEIPT IS STILL GOOD (the control).
    const swapSession = [...rec.m.entries()].find(([fp]) => fp.includes("|" + first.file.name + "|"))[1].sid;
    assert.equal((await call(worker, env, "GET", base + "/" + swapSession)).body.state, "done");
    // THE ORIGINAL ATTACHED AGAIN: its own bytes, at its own new address.
    const r = await SiteMedia.upload(original, { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug });
    assert.equal(r.reused, undefined, "the replacement's bytes were taken for the original attachment");
    assert.notEqual(r.file.name, first.file.name);
    assert.deepEqual(bucket.raw("uploads/" + slug + "/" + r.file.name), originalBytes, "the original attachment is not its own bytes");
    assert.deepEqual(bucket.raw(key), newer, "the replacement was touched");
  });
});

test("A REPLACEMENT WHOSE FILE IS DELETED WHILE IT IS SENT is not closed — the deleted file is not brought back", async () => {
  const worker = await loadWorker();
  const slug = "rcpt-repl-deleted";
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const first = await SiteMedia.upload(fileOf(fixture("tone.wav"), "a.wav"), { api: wireApi(worker, env, base), wait: noWait });
    const bytes = fixture("tone.wav");
    const st = await call(worker, env, "POST", base, { json: { name: "b.wav", size: bytes.length, replace: first.file.name } });
    assert.equal(st.status, 201);
    await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: bytes });
    assert.equal((await call(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + first.file.name)).status, 200);
    const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } });
    assert.deepEqual([done.status, done.body.code], [410, "removed"]);
    assert.deepEqual(mediaIn(bucket, slug), [], "the deleted file came back through its replacement");
    assert.deepEqual(ledgerOf(bucket, "site-" + slug).held, {}, "the given-up replacement still holds room");
  });
});

test("MOVED INTO A SITE BY ITS BUILD: the draft's receipt says removed, a repeated complete does not recreate the draft, and the site's copy is the site's", async () => {
  const name = "4".repeat(32) + ".mp3";
  const sid = "5".repeat(32);
  const other = "6".repeat(32) + ".mp3";
  const otherSid = "7".repeat(32);
  const scope = draftScope(BUILD_USER.id);
  const receipt = (n, s) => JSON.stringify({
    sid: s, scope, key: "drafts/" + BUILD_USER.id + "/" + n, name: n, display: "Jingle.mp3", ext: "mp3", kind: "audio", size: 11, parts: 1,
    uploadId: "u", created: Date.now(), expires: Date.now() + 3600000, state: "done", by: BUILD_USER.id, meta: {},
    file: { name: n, kind: "audio", mime: "audio/mpeg", size: 11, download: "Jingle.mp3" },
  });
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF, images: [], qa: [], chat: "c", media: [name] },
    stored: {
      ["drafts/" + BUILD_USER.id + "/" + name]: "a recording", ["media-sessions/" + scope + "/" + sid + ".json"]: receipt(name, sid),
      ["drafts/" + BUILD_USER.id + "/" + other]: "another one", ["media-sessions/" + scope + "/" + otherSid + ".json"]: receipt(other, otherSid),
    },
    storedMeta: { ["drafts/" + BUILD_USER.id + "/" + name]: { media: "audio", up: sid }, ["drafts/" + BUILD_USER.id + "/" + other]: { media: "audio", up: otherSid } },
  });
  assert.ok(r.store.has("uploads/harbour-loaf/" + name), "the build did not move the draft — this case cannot see what follows");
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).includes("/auth/v1/user") ? Response.json(BUILD_USER) : new Response("no", { status: 503 }));
  try {
    const st = await call(worker, r.env, "GET", "/api/media/drafts/" + sid);
    assert.deepEqual([st.status, st.body.state, st.body.file], [200, "removed", undefined], "a moved draft's receipt was answered as a draft");
    const rep = await call(worker, r.env, "POST", "/api/media/drafts/" + sid + "/complete", { json: { parts: [] } });
    assert.deepEqual([rep.status, rep.body.code], [410, "removed"]);
    assert.equal(r.store.has("drafts/" + BUILD_USER.id + "/" + name), false, "the draft came back");
    assert.equal(r.store.get("uploads/harbour-loaf/" + name), "a recording", "the site's copy was touched");
    // THE CONTROL: a draft the build did not name is still answered as itself.
    const kept = await call(worker, r.env, "GET", "/api/media/drafts/" + otherSid);
    assert.deepEqual([kept.body.state, kept.body.file.name], ["done", other]);
  } finally { globalThis.fetch = real; }
});

test("STORAGE THAT CANNOT BE READ: said as unreadable — never done, never removed — and the page neither reuses nor re-sends; once it answers, the file is reused", async () => {
  const worker = await loadWorker();
  const slug = "rcpt-dark";
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const rec = memoryStore();
    const file = fileOf(fixture("tone.ogg"), "Bells.ogg");
    const first = await SiteMedia.upload(file, { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug });
    const session = [...rec.m.values()][0].sid;
    bucket.failNext("head", 1000);
    const st = await call(worker, env, "GET", base + "/" + session);
    assert.deepEqual([st.status, st.body.code, st.body.state], [503, "unreadable", undefined]);
    const rep = await call(worker, env, "POST", base + "/" + session + "/complete", { json: { parts: [] } });
    assert.deepEqual([rep.status, rep.body.code], [503, "unreadable"]);
    const dark = wireApi(worker, env, base);
    const r = await SiteMedia.upload(file, { api: dark, wait: noWait, store: rec, base: "site:" + slug });
    assert.deepEqual([r.ok, r.uncertain, r.reused], [false, true, undefined], "an unreadable store was taken for a decision: " + JSON.stringify(r));
    assert.deepEqual(dark.calls.filter((k) => k !== "status"), [], "the file was sent again while nothing could be checked");
    // STORAGE ANSWERS AGAIN: reused, as a recovery should be.
    bucket.failNext("head", 0);
    const back = await SiteMedia.upload(file, { api: wireApi(worker, env, base), wait: noWait, store: rec, base: "site:" + slug });
    assert.deepEqual([back.ok, back.reused, back.file.name], [true, true, first.file.name]);
    assert.equal(mediaIn(bucket, slug).length, 1);
  });
});

// ── 2. THE LEDGER'S REPEATED STATE ──────────────────────────────────────────

test("THE STORAGE DOUBLE GIVES R2'S ETAGS, NO STRONGER: the same bytes written again carry the same etag, and a new version", async () => {
  const b = mediaBucket();
  const one = await b.put("k", "{\"held\":{}}");
  const two = await b.put("k", "{\"held\":{}}");
  assert.equal(one.etag, createHash("md5").update("{\"held\":{}}").digest("hex"));
  assert.equal(two.etag, one.etag, "identical bytes were given a new etag");
  assert.notEqual(two.version, one.version);
  // …so a conditional write over the first etag still matches: the hazard is real.
  assert.ok(await b.put("k", "x", { onlyIf: { etagMatches: one.etag } }));
});

test("A START READ BEFORE ANOTHER UPLOAD TOOK ROOM, FINISHED AND GAVE IT BACK (Codex's reproduction): the ledger is back to the same reservations, and the stale start is still refused", async () => {
  const worker = await loadWorker();
  const slug = "ledger-aba";
  const scope = "site-" + slug;
  // A's CONDITIONAL WRITE OF THE LEDGER IS HELD until B has run whole.
  let holdA = true;
  let heldA = null;
  let releaseA = null;
  const bucket = mediaBucket({
    hooks: {
      beforePut: async (key, _bytes, opts) => {
        if (key !== "media-ledger/" + scope + ".json" || !opts.onlyIf || !holdA) return;
        holdA = false;
        await new Promise((r) => { heldA = true; releaseA = r; });
      },
    },
  });
  // AN EXISTING EMPTY LEDGER, as one is after uploads came and went (the old shape).
  bucket.store.set("media-ledger/" + scope + ".json", { bytes: new TextEncoder().encode(JSON.stringify({ v: 1, held: {} })), etag: createHash("md5").update(JSON.stringify({ v: 1, held: {} })).digest("hex"), version: "v0", at: 1, httpMetadata: {}, customMetadata: {} });
  const env = { ...envFor(bucket), MEDIA_MAX_SITE_FILES: "1", MEDIA_MAX_SITE_BYTES: "100" };
  const base = "/api/site/" + slug + "/media";
  const bytes = fixture("tone.mp3").subarray(0, 60);
  await withWire({}, async () => {
    // A: reads the ledger and the library (empty), then waits at its write.
    const a = call(worker, env, "POST", base, { json: { name: "a.mp3", size: 60 } });
    for (let i = 0; i < 400 && !heldA; i++) await new Promise((r) => setTimeout(r, 5));
    assert.ok(heldA, "A never reached its ledger write — this case cannot see the race");
    // B: takes the room, finishes its file, and gives the room back.
    const st = await call(worker, env, "POST", base, { json: { name: "b.mp3", size: 60 } });
    assert.equal(st.status, 201, JSON.stringify(st.body));
    assert.equal((await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: bytes })).status, 200);
    const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.deepEqual(ledgerOf(bucket, scope).held, {}, "the ledger did not return to the same reservations — this case is not the reproduction");
    // A WRITES NOW, over the etag it read before B.
    releaseA();
    const ra = await a;
    assert.deepEqual([ra.status, ra.body.code], [409, "full"], "a stale start was admitted over a ledger back at the same reservations: " + JSON.stringify(ra.body));
    assert.equal(mediaIn(bucket, slug).length, 1);
    assert.deepEqual(ledgerOf(bucket, scope).held, {}, "the refused start left a reservation");
    assert.ok(ledgerOf(bucket, scope).rev >= 3, "the ledger's revision did not move with each write");
  });
});
