// VIDEO AND AUDIO: WHAT A LOST ANSWER, A RELOAD OR A SECOND REQUEST AT THE
// SAME MOMENT DOES (2026-10-15, Codex's review of `7ca339d1`).
//
// Codex reproduced two faults the first round's tests did not reach:
//   - finishing deleted the session, so a second `complete` answered 404, and
//     the page — told nothing when the first answer was lost — called the
//     upload failed and aborted it, though the file had been saved;
//   - two starts at once both answered 201 under a one-file, 100-byte limit,
//     reserving two files and 120 bytes.
// Every case here runs the REAL Worker routes over R2 as the binding behaves
// (`test/fixtures/r2-media.mjs`, conditional writes included, every call
// yielding so requests sent together really interleave), and where a page is
// involved the REAL uploader (`public/site-media.js`) drives them, with a
// network that loses the answers a case names after the route has run.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor, USER } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER } from "./fixtures/build-route.mjs";
import { MEDIA_PART_BYTES } from "../site-media.mjs";

const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");
const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
const noWait = () => Promise.resolve();

async function call(worker, env, method, path, { body, json, headers = {} } = {}) {
  const init = { method, headers: { Authorization: TOKEN, ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  const buf = new Uint8Array(await res.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, headers: res.headers, bytes: buf, body: parsed };
}

/**
 * THE PAGE'S CALLS, over the real Worker: `lose(kind, nth)` says which answers
 * never come back — the route RUNS, and the page sees a dropped connection, as
 * it does when the network goes between the server's answer and the browser.
 * `hang(kind, nth)` never answers at all: the page is closed mid-request.
 */
function wireApi(worker, env, base, { lose = () => false, hang = () => false } = {}) {
  const calls = [];
  const go = async (kind, method, path, init) => {
    calls.push(kind);
    const nth = calls.filter((k) => k === kind).length;
    if (hang(kind, nth)) return new Promise(() => {});
    const r = await call(worker, env, method, base + path, init);
    if (lose(kind, nth)) throw new TypeError("Failed to fetch");
    return { status: r.status, body: r.body };
  };
  return {
    calls,
    start: (b) => go("start", "POST", "", { json: b }),
    part: async (sid, n, blob) => go("part", "PUT", "/" + sid + "/" + n, { body: new Uint8Array(await blob.arrayBuffer()) }),
    complete: (sid, parts) => go("complete", "POST", "/" + sid + "/complete", { json: { parts } }),
    abort: (sid) => go("abort", "DELETE", "/" + sid, {}),
    status: (sid) => go("status", "GET", "/" + sid, {}),
  };
}
/** The page's own record of its uploads, as `chat.js` keeps it — here a Map, which outlives a "reload". */
function memoryStore() {
  const m = new Map();
  return { m, get: (k) => m.get(k) || null, put: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))), drop: (k) => m.delete(k) };
}
const fileOf = (bytes, name) => new File([bytes], name, { lastModified: 1760000000000 });
const mediaIn = (store, slug) => [...store.store.keys()].filter((k) => k.startsWith("uploads/" + slug + "/"));
const ledger = (store, scope) => (store.store.has("media-ledger/" + scope + ".json") ? JSON.parse(new TextDecoder().decode(store.raw("media-ledger/" + scope + ".json"))).held : {});
/** A file of `size` bytes whose first bytes are a real fixture's. */
function sized(name, size) {
  const head = fixture(name);
  const out = new Uint8Array(size);
  out.set(head.subarray(0, Math.min(head.length, size)));
  for (let i = head.length; i < size; i++) out[i] = i % 251;
  return out;
}

// ── ADMISSION, ATOMIC ───────────────────────────────────────────────────────

test("TWO STARTS AT ONCE (Codex's reproduction): under a one-file, 100-byte limit one is admitted and one refused — one file and 60 bytes reserved, not two and 120", async () => {
  const worker = await loadWorker();
  const slug = "media-race";
  const store = mediaBucket({ lag: true });
  const env = { ...envFor(store), MEDIA_MAX_SITE_FILES: "1", MEDIA_MAX_SITE_BYTES: "100" };
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const both = await Promise.all([
      call(worker, env, "POST", base, { json: { name: "a.mp3", size: 60 } }),
      call(worker, env, "POST", base, { json: { name: "b.mp3", size: 60 } }),
    ]);
    assert.deepEqual(both.map((r) => r.status).sort(), [201, 409], "two starts at once were both admitted: " + JSON.stringify(both.map((r) => r.body)));
    assert.equal(both.find((r) => r.status === 409).body.code, "full");
    const held = Object.values(ledger(store, "site-" + slug));
    assert.deepEqual([held.length, held.reduce((n, h) => n + h.size, 0)], [1, 60], "the ledger reserved more than one file");
    // BYTES TOO: five files allowed, 100 bytes — two 60-byte starts at once.
    const bytesEnv = { ...env, MEDIA_MAX_SITE_FILES: "5" };
    const slug2 = "media-race-bytes";
    const pair = await Promise.all([
      call(worker, bytesEnv, "POST", "/api/site/" + slug2 + "/media", { json: { name: "a.mp3", size: 60 } }),
      call(worker, bytesEnv, "POST", "/api/site/" + slug2 + "/media", { json: { name: "b.mp3", size: 60 } }),
    ]);
    assert.deepEqual(pair.map((r) => r.status).sort(), [201, 409], "two starts together passed the byte limit");
    // AND FIVE AT ONCE UNDER A THREE-FILE LIMIT: exactly three.
    const slug3 = "media-race-five";
    const five = await Promise.all([1, 2, 3, 4, 5].map((i) => call(worker, { ...env, MEDIA_MAX_SITE_FILES: "3", MEDIA_MAX_SITE_BYTES: "1000000" }, "POST", "/api/site/" + slug3 + "/media", { json: { name: i + ".mp3", size: 10 } })));
    assert.equal(five.filter((r) => r.status === 201).length, 3, "five starts at once: " + five.map((r) => r.status).join(","));
    assert.equal(Object.keys(ledger(store, "site-" + slug3)).length, 3);
  });
});

test("BEFORE A SITE EXISTS, THE SAME: two draft starts at once under a one-file allowance admit one", async () => {
  const worker = await loadWorker();
  const store = mediaBucket({ lag: true });
  const env = { ...envFor(store), MEDIA_MAX_DRAFT_FILES: "1" };
  await withWire({}, async () => {
    const both = await Promise.all([
      call(worker, env, "POST", "/api/media/drafts", { json: { name: "a.wav", size: 60 } }),
      call(worker, env, "POST", "/api/media/drafts", { json: { name: "b.wav", size: 60 } }),
    ]);
    assert.deepEqual(both.map((r) => r.status).sort(), [201, 409]);
    assert.equal(Object.keys(ledger(store, "draft-" + USER.id)).length, 1);
  });
});

test("COMPETING REPLACEMENTS: one replacement of a file at a time; a smaller one releases nothing; a finished upload gives its room back", async () => {
  const worker = await loadWorker();
  const slug = "media-replace-race";
  const store = mediaBucket({ lag: true });
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const api = wireApi(worker, env, base);
    const first = await SiteMedia.upload(fileOf(fixture("tone.mp3"), "intro.mp3"), { api, wait: noWait });
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.deepEqual(ledger(store, "site-" + slug), {}, "a finished upload still holds room");
    const name = first.file.name;
    const have = store.raw("uploads/" + slug + "/" + name).length;
    const two = await Promise.all([
      call(worker, env, "POST", base, { json: { name: "v2.mp3", size: have, replace: name } }),
      call(worker, env, "POST", base, { json: { name: "v3.mp3", size: have, replace: name } }),
    ]);
    assert.deepEqual(two.map((r) => r.status).sort(), [201, 409], "two replacements of one file were both admitted");
    assert.equal(two.find((r) => r.status === 409).body.code, "replacing");
    // GIVEN UP, ITS TURN IS FREE AGAIN.
    const winner = two.find((r) => r.status === 201).body.session;
    assert.equal((await call(worker, env, "DELETE", base + "/" + winner)).status, 200);
    // A REPLACEMENT RESERVES ITS WHOLE SIZE: the old file is still stored while
    // it is sent, so a promise to be smaller releases nothing.
    const tight = { ...env, MEDIA_MAX_SITE_BYTES: String(have + 50) };
    const smaller = await call(worker, tight, "POST", base, { json: { name: "v4.mp3", size: have - 10, replace: name } });
    assert.deepEqual([smaller.status, smaller.body.code], [409, "full"], "an unfinished smaller replacement was counted as freeing storage");
    const fits = await call(worker, tight, "POST", base, { json: { name: "v5.mp3", size: 40, replace: name } });
    assert.equal(fits.status, 201, JSON.stringify(fits.body));
  });
});

// ── COMPLETION, DURABLE AND IDEMPOTENT ──────────────────────────────────────

test("A SECOND `complete` ANSWERS WHAT THE FIRST DID — same file, no second object; status says done; an abort after it keeps the file", async () => {
  const worker = await loadWorker();
  const slug = "media-again";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const bytes = fixture("tone.ogg");
    const st = await call(worker, env, "POST", base, { json: { name: "Bells.ogg", size: bytes.length } });
    const p = await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: bytes });
    const one = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [{ n: 1, etag: p.body.etag }] } });
    const two = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [{ n: 1, etag: p.body.etag }] } });
    assert.equal(one.status, 201, JSON.stringify(one.body));
    assert.equal(two.status, 200, "a repeated complete was not answered (Codex: it was 404): " + JSON.stringify(two.body));
    assert.deepEqual([two.body.name, two.body.url, two.body.size, two.body.again], [one.body.name, one.body.url, one.body.size, true]);
    assert.equal(store.calls.filter((c) => c === "complete").length, 1, "the upload was closed twice");
    assert.equal(mediaIn(store, slug).length, 1, "a second file appeared");
    const status = await call(worker, env, "GET", base + "/" + st.body.session);
    assert.deepEqual([status.status, status.body.state, status.body.file.name], [200, "done", one.body.name]);
    const late = await call(worker, env, "DELETE", base + "/" + st.body.session);
    assert.deepEqual([late.status, late.body.done], [200, true]);
    assert.equal((await call(worker, env, "GET", one.body.url)).status, 200, "an abort after the finish removed the file");
    assert.equal(store.calls.filter((c) => c === "abort").length, 0, "a finished upload was aborted");
  });
});

test("R2 FINISHES BUT ITS ANSWER IS LOST: the route reads the file's own upload id and answers it finished", async () => {
  const worker = await loadWorker();
  const slug = "media-r2-lost";
  const store = mediaBucket({ lose: { complete: 1 } });
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const bytes = fixture("tone.flac");
    const st = await call(worker, env, "POST", base, { json: { name: "a.flac", size: bytes.length } });
    await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: bytes });
    const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } });
    assert.equal(done.status, 201, "a finished upload whose R2 answer was lost was called failed: " + JSON.stringify(done.body));
    assert.equal(store.store.get("uploads/" + slug + "/" + done.body.name).customMetadata.up, st.body.session);
  });
});

test("THE PAGE LOSES THE ANSWER TO `complete` (Codex's reproduction): it asks, finds the file, calls it done — no abort, no second upload, no second file", async () => {
  const worker = await loadWorker();
  const slug = "media-page-lost";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const api = wireApi(worker, env, "/api/site/" + slug + "/media", { lose: (k, n) => k === "complete" && n === 1 });
    const r = await SiteMedia.upload(fileOf(fixture("clip.webm"), "Tour.webm"), { api, wait: noWait, store: memoryStore(), base: "site:" + slug });
    assert.equal(r.ok, true, "a saved file was reported as failed: " + JSON.stringify(r));
    assert.equal(r.recovered, true);
    assert.match(r.file.url, new RegExp("^/u/" + slug + "/[a-f0-9]{32}\\.webm$"));
    assert.equal(api.calls.includes("abort"), false, "the page aborted an upload whose file was saved");
    assert.equal(api.calls.filter((c) => c === "start").length, 1, "the file was started again");
    assert.equal(mediaIn(store, slug).length, 1, "a duplicate asset was made");
    assert.equal((await call(worker, env, "GET", r.file.url)).status, 200);
  });
});

test("NOTHING CAN BE FOUND OUT: the answer is 'not confirmed yet' — never failed, never aborted — and a later check, or the same file attached again, recovers it", async () => {
  const worker = await loadWorker();
  const slug = "media-unknown";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const rec = memoryStore();
    const dark = wireApi(worker, env, base, { lose: (k) => k === "complete" || k === "status" });
    const file = fileOf(fixture("tone.wav"), "Jingle.wav");
    const r = await SiteMedia.upload(file, { api: dark, wait: noWait, store: rec, base: "site:" + slug });
    assert.deepEqual([r.ok, r.uncertain, r.code], [false, true, "unconfirmed"], JSON.stringify(r));
    assert.doesNotMatch(r.error, /fail/i, "an unknown outcome was described as a failure");
    assert.equal(dark.calls.includes("abort"), false, "an unknown outcome was aborted");
    assert.equal(mediaIn(store, slug).length, 1, "the file the server saved is gone");
    // THE CONNECTION COMES BACK: the chip's check finds it.
    const back = wireApi(worker, env, base);
    const c = await SiteMedia.confirm(r.session, { api: back, wait: noWait });
    assert.equal(c.ok, true, JSON.stringify(c));
    // AND ATTACHED AGAIN AFTER A RELOAD (the record outlives the page): reused, not sent.
    const again = wireApi(worker, env, base);
    const r2 = await SiteMedia.upload(file, { api: again, wait: noWait, store: rec, base: "site:" + slug });
    assert.deepEqual([r2.ok, r2.reused, r2.file.name], [true, true, c.file.name]);
    assert.deepEqual(again.calls.filter((k) => k === "start" || k === "part"), [], "the same file was sent again");
    assert.equal(mediaIn(store, slug).length, 1, "a duplicate asset was made");
  });
});

test("CLOSED MID-UPLOAD, THEN RELOADED: the same file attached again sends only the parts the server does not hold", async () => {
  const worker = await loadWorker();
  const slug = "media-resume";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const rec = memoryStore();
    const bytes = sized("tone.mp3", MEDIA_PART_BYTES + 777);
    const file = fileOf(bytes, "Long talk.mp3");
    // THE PAGE CLOSES while part 2 is on its way: it never answers.
    const closing = wireApi(worker, env, base, { hang: (k, n) => k === "part" && n === 2 });
    SiteMedia.upload(file, { api: closing, wait: noWait, store: rec, base: "site:" + slug });
    for (let i = 0; i < 200 && closing.calls.filter((k) => k === "part").length < 2; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(closing.calls.filter((k) => k === "part").length, 2);
    // RELOADED: the record finds the open upload; only part 2 goes.
    const reopened = wireApi(worker, env, base);
    const r = await SiteMedia.upload(file, { api: reopened, wait: noWait, store: rec, base: "site:" + slug });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(reopened.calls.filter((k) => k !== "status"), ["part", "complete"], "the resumed upload sent more than its missing part");
    assert.deepEqual(store.raw("uploads/" + slug + "/" + r.file.name), bytes, "the resumed file is not the file");
    assert.equal(mediaIn(store, slug).length, 1);
  });
});

test("OWNERSHIP: another account cannot read an upload's status, in a site's library or in another account's drafts", async () => {
  const worker = await loadWorker();
  const slug = "media-status-mine";
  const store = mediaBucket();
  const env = envFor(store);
  let site = "", draft = "";
  await withWire({}, async () => {
    site = (await call(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "a.mp3", size: 100 } })).body.session;
    draft = (await call(worker, env, "POST", "/api/media/drafts", { json: { name: "a.mp3", size: 100 } })).body.session;
    assert.equal((await call(worker, env, "GET", "/api/site/" + slug + "/media/" + site)).body.state, "open");
    assert.equal((await call(worker, env, "GET", "/api/media/drafts/" + draft)).body.state, "open");
  });
  await withWire({}, async () => {
    assert.equal((await call(worker, env, "GET", "/api/site/" + slug + "/media/" + site)).status, 404, "another account read a site's upload");
  }, { owner: "someone-else" });
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).includes("/auth/v1/user") ? Response.json({ id: "u-someone-else", email: "x@example.com" }) : new Response("no", { status: 503 }));
  try {
    assert.equal((await call(worker, env, "GET", "/api/media/drafts/" + draft)).status, 404, "another account read this account's draft upload");
  } finally { globalThis.fetch = real; }
});

test("A BUILD'S MOVE TAKES ROOM IN THE SAME LEDGER: an upload already holding the last place keeps the draft a draft", async () => {
  const name = "a".repeat(32) + ".mp3";
  const draft = "drafts/" + BUILD_USER.id + "/" + name;
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF, images: [], qa: [], chat: "c", media: [name] },
    // AN UPLOAD IS IN FLIGHT ON THE NEW SITE, HOLDING ITS ONE PLACE.
    stored: {
      [draft]: "a recording",
      ["media-ledger/site-harbour-loaf.json"]: JSON.stringify({ v: 1, held: { ["b".repeat(32)]: { sid: "b".repeat(32), size: 10, files: 1, expires: Date.now() + 600000 } } }),
    },
    env: { MEDIA_MAX_SITE_FILES: "1" },
  });
  assert.equal(r.store.has("uploads/harbour-loaf/" + name), false, "a move took a place an upload already held");
  assert.ok(r.store.has(draft), "the draft was lost though it did not move");
  assert.deepEqual(r.reply.media.missing.map((m) => m.why), ["the site's video and audio storage is full"]);
});
