// VIDEO AND AUDIO THROUGH THE REAL ROUTES (2026-10-14, the owner's two-area
// batch): the real Worker, its owner gate and its serving, with R2 as the
// binding behaves (`test/fixtures/r2-media.mjs`) and the sign-in and site
// ownership supplied (`test/fixtures/live-ask.mjs`).
//
// Upload in parts → the library lists it, by kind, with its own allowance →
// it plays: `HEAD`, a range `206`, a seek's suffix range, `416` past the end,
// `304` on its ETag → it is replaced at the same address (a new ETag, so a
// cached copy revalidates) → a page that plays it stops a delete until the
// owner confirms → deleted, it is gone. Before a site exists: kept for the
// account, invisible to another, and moved into the library by the build
// that claims the address, where the page writer is given its address. And
// the edit page step and the add-on writer are shown the library's video
// and audio by address. What these cannot show — a real browser playing and
// seeking — is `test/media-playback.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor, USER } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER } from "./fixtures/build-route.mjs";
import { MEDIA_PART_BYTES, MEDIA_CACHE, mediaLimits } from "../site-media.mjs";
import { readFileSync } from "node:fs";

const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));

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

/** The page's upload: start, every part, finish — through the real routes. */
async function upload(worker, env, base, bytes, name, extra = {}) {
  const st = await call(worker, env, "POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await call(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    if (p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}

test("UPLOAD → LIST → PLAY AND SEEK: a site's video, through the real routes", async () => {
  const worker = await loadWorker();
  const slug = "media-play";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const clip = fixture("clip.webm");
    const { st, done } = await upload(worker, env, "/api/site/" + slug + "/media", clip, "Kitchen tour.webm", { meta: { duration: 4, width: 64, height: 48 } });
    assert.equal(st.status, 201, JSON.stringify(st.body));
    assert.equal(done.status, 201, JSON.stringify(done.body));
    const url = done.body.url;
    assert.match(url, /^\/u\/media-play\/[a-f0-9]{32}\.webm$/);

    // LISTED, AS A VIDEO, ON ITS OWN ALLOWANCE.
    const list = await call(worker, env, "GET", "/api/site/" + slug + "/uploads");
    assert.equal(list.status, 200);
    const f = list.body.files.find((x) => x.url === url);
    assert.deepEqual([f.kind, f.mime, f.duration, f.width, f.height, f.download], ["video", "video/webm", 4, 64, 48, "Kitchen tour.webm"]);
    assert.equal(list.body.count, 0, "the video was counted against the pictures' allowance");
    assert.equal(list.body.used, 0, "the video's bytes were counted against the pictures' allowance");
    assert.deepEqual([list.body.media.count, list.body.media.used, list.body.media.maxCount, list.body.media.maxVideo], [1, clip.length, mediaLimits({}).siteFiles, mediaLimits({}).videoBytes]);

    // PLAYED: whole, HEAD, a range, a seek near the end, past the end, revalidated.
    const whole = await call(worker, env, "GET", url);
    assert.equal(whole.status, 200);
    assert.deepEqual(whole.bytes, clip);
    assert.equal(whole.headers.get("content-type"), "video/webm");
    assert.equal(whole.headers.get("accept-ranges"), "bytes");
    assert.equal(whole.headers.get("content-length"), String(clip.length));
    assert.equal(whole.headers.get("cache-control"), MEDIA_CACHE, "a replaceable file was cached as immutable");
    assert.equal(whole.headers.get("content-disposition"), "inline");
    const etag = whole.headers.get("etag");
    assert.ok(etag, "no ETag");
    const head = await call(worker, env, "HEAD", url);
    assert.deepEqual([head.status, head.bytes.length, head.headers.get("content-length")], [200, 0, String(clip.length)]);
    const part = await call(worker, env, "GET", url, { headers: { range: "bytes=100-199" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), "bytes 100-199/" + clip.length);
    assert.deepEqual(part.bytes, clip.subarray(100, 200));
    const tail = await call(worker, env, "GET", url, { headers: { range: "bytes=-50" } });
    assert.deepEqual([tail.status, tail.bytes.length], [206, 50]);
    assert.deepEqual(tail.bytes, clip.subarray(clip.length - 50));
    const past = await call(worker, env, "GET", url, { headers: { range: "bytes=" + clip.length + "-" } });
    assert.deepEqual([past.status, past.headers.get("content-range")], [416, "bytes */" + clip.length]);
    const again = await call(worker, env, "GET", url, { headers: { "if-none-match": etag } });
    assert.deepEqual([again.status, again.bytes.length], [304, 0]);
    // A SEEK READS ONLY ITS BYTES: the range reached R2 as a range.
    assert.ok(store.calls.filter((c) => c === "get").length >= 3);
    const post = await call(worker, env, "POST", url);
    assert.equal(post.status, 405);
  });
});

test("A LARGE FILE IN PARTS, A DROPPED PART SENT AGAIN, AND THE AUDIO LIMIT — through the real routes", async () => {
  const worker = await loadWorker();
  const slug = "media-parts";
  const store = mediaBucket({ fail: { uploadPart: 1 } });
  const env = envFor(store);
  await withWire({}, async () => {
    const head = fixture("tone.mp3");
    const size = MEDIA_PART_BYTES + 4321;
    const bytes = new Uint8Array(size); bytes.set(head);
    const base = "/api/site/" + slug + "/media";
    const st = await call(worker, env, "POST", base, { json: { name: "interview.mp3", size } });
    assert.equal(st.body.parts, 2);
    const p1 = bytes.subarray(0, MEDIA_PART_BYTES);
    // THE CONNECTION DROPS INSIDE R2: the part fails, and is sent again alone.
    const lost = await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: p1 });
    assert.ok(lost.status >= 500, "a failed part was answered as stored");
    const ok1 = await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: p1 });
    assert.equal(ok1.status, 200);
    // A PART LARGER THAN A PART IS REFUSED BEFORE IT IS READ.
    const huge = await call(worker, env, "PUT", base + "/" + st.body.session + "/2", { body: new Uint8Array(MEDIA_PART_BYTES + 1) });
    assert.deepEqual([huge.status, huge.body.code], [413, "too_big"]);
    const ok2 = await call(worker, env, "PUT", base + "/" + st.body.session + "/2", { body: bytes.subarray(MEDIA_PART_BYTES) });
    const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [{ n: 1, etag: ok1.body.etag }, { n: 2, etag: ok2.body.etag }] } });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(done.body.size, size);
    const served = await call(worker, env, "GET", done.body.url, { headers: { range: "bytes=" + (MEDIA_PART_BYTES - 2) + "-" + (MEDIA_PART_BYTES + 1) } });
    assert.deepEqual(served.bytes, bytes.subarray(MEDIA_PART_BYTES - 2, MEDIA_PART_BYTES + 2), "the parts were not joined in order");
    // TOO LARGE FOR AUDIO, BY THE CONFIGURED LIMIT.
    const big = await call(worker, { ...env, MEDIA_MAX_AUDIO_BYTES: "1000" }, "POST", base, { json: { name: "long.mp3", size: 1001 } });
    assert.deepEqual([big.status, big.body.code, big.body.max], [413, "too_big", 1000]);
    // AND THE SINGLE-REQUEST ROUTE POINTS A VIDEO AT THE MEDIA UPLOAD, never storing it whole.
    const whole = await call(worker, env, "POST", "/api/site/" + slug + "/uploads?name=clip.mp4", { body: fixture("clip.mp4") });
    assert.deepEqual([whole.status, whole.body.code], [415, "use_media_upload"]);
  });
});

test("REPLACE KEEPS THE ADDRESS AND CHANGES THE ETAG; A DELETE A PAGE WOULD FEEL IS SAID FIRST", async () => {
  const worker = await loadWorker();
  const slug = "media-swap";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    const first = await upload(worker, env, base, fixture("tone.ogg"), "Welcome.ogg");
    const url = first.done.body.url;
    const name = first.done.body.name;
    const e1 = (await call(worker, env, "HEAD", url)).headers.get("etag");
    const next = new Uint8Array(fixture("tone.ogg").length + 500); next.set(fixture("tone.ogg"));
    const swap = await upload(worker, env, base, next, "Welcome v2.ogg", { replace: name });
    assert.equal(swap.done.status, 200, JSON.stringify(swap.done.body));
    assert.equal(swap.done.body.url, url, "a replacement moved the file");
    const got = await call(worker, env, "GET", url, { headers: { "if-none-match": e1 } });
    assert.equal(got.status, 200, "a cached copy of the old file was told it is still current");
    assert.deepEqual(got.bytes, next);
    const kind = await call(worker, env, "POST", base, { json: { name: "x.mp4", size: 10, replace: name } });
    assert.equal(kind.body.code, "kind_mismatch");

    // A PAGE PLAYS IT: the delete is held and the page named.
    store.store.set("source/" + slug + "/pages.json", { bytes: new TextEncoder().encode(JSON.stringify([{ path: "index.tsx", source: "<audio controls src=\"" + url + "\" />" }])), etag: "s", at: 1, httpMetadata: {}, customMetadata: {} });
    const held = await call(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + name);
    assert.deepEqual([held.status, held.body.code, held.body.pages], [409, "in_use", ["/"]]);
    assert.equal((await call(worker, env, "HEAD", url)).status, 200, "a held delete deleted");
    const forced = await call(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + name + "?force=1");
    assert.equal(forced.status, 200);
    assert.equal((await call(worker, env, "GET", url)).status, 404, "a deleted file still serves");
    const list = await call(worker, env, "GET", "/api/site/" + slug + "/uploads");
    assert.equal(list.body.media.count, 0, "a deleted file is still counted");
  });
});

test("OWNERSHIP: another account cannot start, send to, finish or delete in a site's library", async () => {
  const worker = await loadWorker();
  const slug = "media-mine";
  const store = mediaBucket();
  const env = envFor(store);
  let session = "";
  await withWire({}, async () => {
    const st = await call(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "a.mp3", size: fixture("tone.mp3").length } });
    session = st.body.session;
  });
  await withWire({}, async () => {
    const base = "/api/site/" + slug + "/media";
    assert.equal((await call(worker, env, "POST", base, { json: { name: "a.mp3", size: 10 } })).status, 404);
    assert.equal((await call(worker, env, "PUT", base + "/" + session + "/1", { body: fixture("tone.mp3") })).status, 404);
    assert.equal((await call(worker, env, "POST", base + "/" + session + "/complete", { json: { parts: [] } })).status, 404);
    assert.equal(store.calls.filter((c) => c === "uploadPart").length, 0, "another account's bytes reached the library");
  }, { owner: "someone-else" });
  // AND NOT SIGNED IN AT ALL.
  const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/media", { method: "POST", body: "{}" }), env, makeCtx());
  assert.equal(res.status, 401);
});

test("BEFORE A SITE EXISTS: kept for the account, unseen by another, removable", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const done = (await upload(worker, env, "/api/media/drafts", fixture("tone.wav"), "Jingle.wav")).done;
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(done.body.url, undefined, "a draft was given a public address");
    assert.ok(store.store.has("drafts/" + USER.id + "/" + done.body.name), "the draft is not kept for its account");
    const mine = await call(worker, env, "GET", "/api/media/drafts");
    assert.deepEqual(mine.body.files.map((f) => [f.name, f.kind, f.download]), [[done.body.name, "audio", "Jingle.wav"]]);
    assert.equal((await call(worker, env, "GET", "/u/anything/" + done.body.name)).status, 404, "a draft is served");
    const gone = await call(worker, env, "DELETE", "/api/media/drafts/file/" + done.body.name);
    assert.equal(gone.status, 200);
    assert.equal((await call(worker, env, "GET", "/api/media/drafts")).body.files.length, 0);
    // THE ALLOWANCE BEFORE A SITE: `draftFiles`.
    const tight = { ...env, MEDIA_MAX_DRAFT_FILES: "1" };
    await upload(worker, tight, "/api/media/drafts", fixture("tone.wav"), "a.wav");
    const full = await call(worker, tight, "POST", "/api/media/drafts", { json: { name: "b.wav", size: 100 } });
    assert.deepEqual([full.status, full.body.code], [409, "full"]);
  });
  // ANOTHER ACCOUNT SEES NONE OF THEM.
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).includes("/auth/v1/user") ? Response.json({ id: "u-someone-else", email: "x@example.com" }) : new Response("no", { status: 503 }));
  try {
    const theirs = await call(worker, env, "GET", "/api/media/drafts");
    assert.deepEqual(theirs.body.files, [], "another account sees this account's drafts");
  } finally { globalThis.fetch = real; }
});

test("BUILD: the drafts the message names move into the new site's library, and the page writer is given their addresses", async () => {
  const name = "c".repeat(32) + ".mp4";
  const draft = "drafts/" + BUILD_USER.id + "/" + name;
  let writer = "";
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF + " Put our bakery tour video on the home page.", images: [], qa: [], chat: "c", media: [name, "f".repeat(32) + ".mp3"] },
    stored: { [draft]: "a small video" },
    onFetch: async (url, init) => {
      if (url.includes("/v1/messages")) {
        const b = JSON.parse(String((init && init.body) || "{}"));
        if (b.tool_choice && b.tool_choice.name === "write_pages") writer = JSON.stringify(b.messages || "");
      }
      return null;
    },
  });
  assert.ok(r.reply, "the build answered nothing");
  assert.ok(r.store.has("uploads/harbour-loaf/" + name), "the draft did not move into the site's library");
  assert.equal(r.store.has(draft), false, "the draft was kept after it moved");
  assert.deepEqual(r.reply.media.placed, [{ name, url: "/u/harbour-loaf/" + name, kind: "video" }]);
  assert.deepEqual(r.reply.media.missing, [{ name: "f".repeat(32) + ".mp3", why: "it was no longer kept" }]);
  assert.match(r.reply.contextNote, /Your video ".*" is in your site's file library now/);
  assert.match(r.seen.designer[0], /THE OWNER'S VIDEO AND AUDIO FILES, which go into the site's own library/, "the designer was not told");
  assert.ok(writer, "the page writer was never asked — this case cannot see what it is shown");
  assert.match(writer, new RegExp("/u/harbour-loaf/" + name), "the page writer was not given the address");
});

test("BUILD: another account's draft is never moved", async () => {
  const name = "d".repeat(32) + ".mp4";
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF, images: [], qa: [], chat: "c", media: [name] },
    stored: { ["drafts/u-someone-else/" + name]: "theirs" },
  });
  assert.equal(r.store.has("uploads/harbour-loaf/" + name), false, "another account's draft moved into this site");
  assert.ok(r.store.has("drafts/u-someone-else/" + name), "another account's draft was touched");
  assert.deepEqual(r.reply.media.missing.map((m) => m.why), ["it was no longer kept"]);
});

test("BUILD: a draft that would pass the site's video and audio limit stays a draft, said", async () => {
  const name = "e".repeat(32) + ".mp3";
  const draft = "drafts/" + BUILD_USER.id + "/" + name;
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF, images: [], qa: [], chat: "c", media: [name] },
    // THE SITE'S LIBRARY ALREADY HOLDS ONE, AND ONE IS ITS LIMIT. (The build
    // fixture's listing reports every object as one byte, so the file count
    // is the limit a case can make bite here.)
    stored: { [draft]: "a recording", ["uploads/harbour-loaf/" + "f".repeat(32) + ".mp3"]: "already there" },
    env: { MEDIA_MAX_SITE_FILES: "1" },
  });
  assert.equal(r.store.has("uploads/harbour-loaf/" + name), false, "a draft past the site's limit moved in");
  assert.ok(r.store.has(draft), "the draft was lost though it did not move");
  assert.deepEqual(r.reply.media.missing.map((m) => m.why), ["the site's video and audio storage is full"]);
  assert.match(r.reply.contextNote, /I couldn't add .* \(the site's video and audio storage is full\) to your site's library\./);
});
