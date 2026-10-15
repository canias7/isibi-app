// VIDEO AND AUDIO: WHAT THE BYTES ARE, THE LIMITS, THE RANGES, AND THE
// UPLOAD IN PARTS (2026-10-14, the owner's two-area batch).
//
// The handlers in `site-media.mjs` driven with an R2 that behaves as the
// binding does (`test/fixtures/r2-media.mjs`) and the small local fixtures in
// `test/fixtures/media/` (made locally with ffmpeg; 2 s tones and a 4 s
// 64×48 test pattern — no generated media and no paid service). What these
// establish: each format is told from its contents and nothing else; a file
// appears only when every part is in, each part's length exact; an
// interrupted or refused upload leaves nothing; the limits are configurable
// and never unlimited; a replacement keeps the address and its kind; a range
// is read as browsers send it. The real route, the real serving and a real
// browser's playback are `test/media-route.test.mjs` and
// `test/media-playback.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  sniffMedia, declaredMediaKind, mediaLimits, MEDIA_DEFAULTS, MEDIA_CEILINGS, MEDIA_FORMATS, MEDIA_EXTS, MEDIA_PART_BYTES,
  parseRange, mediaHeaders, etagMatches, partsFor, partLength, handleMediaStart, handleMediaPart, handleMediaComplete,
  handleMediaAbort, handleMediaStatus, readMediaMeta, mediaMetadata, readStoredMeta, pagesUsing, mediaBlock, isMediaName, mediaName, MEDIA_CACHE,
} from "../site-media.mjs";
import { sniffUpload, uploadKind, uploadIsImage, IMAGE_EXTS, UPLOAD_EXTS } from "../site-uploads.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";

const DIR = new URL("./fixtures/media/", import.meta.url);
const fixture = (n) => new Uint8Array(readFileSync(new URL(n, DIR)));
const WANT = {
  "clip.mp4": ["mp4", "video/mp4", "video"], "clip.webm": ["webm", "video/webm", "video"], "clip.mov": ["mov", "video/quicktime", "video"],
  "tone.mp3": ["mp3", "audio/mpeg", "audio"], "tone.m4a": ["m4a", "audio/mp4", "audio"], "tone.aac": ["aac", "audio/aac", "audio"],
  "tone.wav": ["wav", "audio/wav", "audio"], "tone.ogg": ["ogg", "audio/ogg", "audio"], "tone.flac": ["flac", "audio/flac", "audio"],
};

test("every supported format is told from its CONTENTS, whatever it is called", () => {
  const files = readdirSync(DIR).filter((f) => !f.startsWith("."));
  assert.deepEqual(files.sort(), Object.keys(WANT).sort(), "a fixture is missing or unexpected");
  for (const [f, [ext, mime, kind]] of Object.entries(WANT)) {
    const b = fixture(f);
    assert.ok(b.length < 40_000, f + " is not a small fixture");
    assert.deepEqual(sniffMedia(b), { ext, mime, kind }, f);
  }
  // NAMES ARE NEVER BELIEVED: a PNG called clip.mp4 is not a video, and text is nothing.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  assert.equal(sniffMedia(png), null);
  assert.equal(sniffMedia(new TextEncoder().encode("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffMedia(new Uint8Array(4)), null, "a short read was guessed at");
  // A Matroska file that is not WebM, and an ftyp brand we do not play, are refused.
  const mkv = fixture("clip.webm").slice(); const at = Buffer.from(mkv).indexOf("webm"); mkv.set(new TextEncoder().encode("mkvx"), at);
  assert.equal(sniffMedia(mkv), null);
  const gp = fixture("clip.mp4").slice(); gp.set(new TextEncoder().encode("3gp5"), 8);
  assert.equal(sniffMedia(gp), null);
});

test("the upload module classifies by kind — media is never an image, and images and documents are unchanged", () => {
  for (const ext of MEDIA_EXTS) {
    assert.equal(uploadKind("a." + ext), MEDIA_FORMATS[ext].kind);
    assert.equal(uploadIsImage("a." + ext), false, ext + " is read as a picture");
    assert.ok(!IMAGE_EXTS.includes(ext));
    assert.ok(UPLOAD_EXTS.includes(ext), ext + " cannot be addressed");
  }
  assert.deepEqual(IMAGE_EXTS, ["png", "jpg", "webp", "gif"]);
  assert.equal(uploadKind("a.pdf"), "doc");
  assert.equal(uploadKind("a.docx"), "doc");
  assert.equal(uploadKind("a.png"), "image");
  assert.equal(uploadKind("a.exe"), null);
  assert.equal(uploadIsImage("interview.mp3"), false, "the measured case: an mp3 is not a picture");
  // THE SINGLE-REQUEST ROUTE STILL TAKES PICTURES AND DOCUMENTS ONLY: media goes in parts.
  assert.equal(sniffUpload(fixture("clip.mp4"), "clip.mp4"), null);
});

test("a name or a type says the kind before any byte is read; nothing else does", () => {
  assert.equal(declaredMediaKind("Tour.MP4", ""), "video");
  assert.equal(declaredMediaKind("x", "audio/mpeg"), "audio");
  assert.equal(declaredMediaKind("talk.opus", ""), "audio");
  assert.equal(declaredMediaKind("notes.txt", "text/plain"), null);
});

test("the limits are configurable, clamped, and never unlimited or zero", () => {
  assert.deepEqual(mediaLimits({}), { ...MEDIA_DEFAULTS });
  assert.equal(MEDIA_DEFAULTS.videoBytes, 250_000_000);
  assert.equal(MEDIA_DEFAULTS.audioBytes, 50_000_000);
  assert.equal(MEDIA_DEFAULTS.siteBytes, 2_000_000_000);
  assert.equal(MEDIA_DEFAULTS.siteFiles, 100);
  const set = mediaLimits({ MEDIA_MAX_VIDEO_BYTES: "500000000", MEDIA_MAX_SITE_FILES: "20" });
  assert.equal(set.videoBytes, 500_000_000);
  assert.equal(set.siteFiles, 20);
  const huge = mediaLimits({ MEDIA_MAX_VIDEO_BYTES: "999999999999999", MEDIA_MAX_SITE_BYTES: "999999999999999" });
  assert.equal(huge.videoBytes, MEDIA_CEILINGS.videoBytes, "a huge value promised more than the ceiling");
  assert.equal(huge.siteBytes, MEDIA_CEILINGS.siteBytes);
  for (const bad of ["0", "-5", "1e9", "lots", "", " ", "12.5"]) {
    assert.equal(mediaLimits({ MEDIA_MAX_AUDIO_BYTES: bad }).audioBytes, MEDIA_DEFAULTS.audioBytes, JSON.stringify(bad) + " was not read as the default");
  }
  assert.ok(MEDIA_DEFAULTS.videoBytes !== 5_000_000 && MEDIA_DEFAULTS.siteBytes !== 100_000_000, "the image limits were reused");
});

test("a range is read as browsers send it", () => {
  assert.equal(parseRange(null, 100), null);
  assert.deepEqual(parseRange("bytes=0-", 100), { offset: 0, length: 100 });
  assert.deepEqual(parseRange("bytes=10-19", 100), { offset: 10, length: 10 });
  assert.deepEqual(parseRange("bytes=90-500", 100), { offset: 90, length: 10 }, "an end past the file is clipped");
  assert.deepEqual(parseRange("bytes=-30", 100), { offset: 70, length: 30 });
  assert.deepEqual(parseRange("bytes=-300", 100), { offset: 0, length: 100 });
  assert.equal(parseRange("bytes=100-", 100), "unsatisfiable");
  assert.equal(parseRange("bytes=20-10", 100), "unsatisfiable");
  assert.equal(parseRange("bytes=-0", 100), "unsatisfiable");
  assert.equal(parseRange("bytes=0-1,5-6", 100), null, "several ranges are answered whole, never split wrongly");
  assert.equal(parseRange("items=0-5", 100), null);
  const h = mediaHeaders({ mime: "video/mp4", size: 100, etag: '"e"', range: { offset: 10, length: 10 } });
  assert.equal(h["content-range"], "bytes 10-19/100");
  assert.equal(h["content-length"], "10");
  assert.equal(h["accept-ranges"], "bytes");
  assert.equal(h["cache-control"], MEDIA_CACHE);
  assert.ok(etagMatches('W/"e", "f"', '"e"') && etagMatches("*", '"x"') && !etagMatches('"g"', '"e"'));
});

// ── THE UPLOAD, IN PARTS, AGAINST A BUCKET ─────────────────────────────────

/** The deps the Worker gives the handlers, over a fake bucket: a site's library. */
function siteDeps(B, { slug = "fold", owner = true, now = () => Date.now(), who = "u-owner" } = {}) {
  let n = 0;
  const ledgerKey = (sc) => "media-ledger/" + sc + ".json";
  const partsPrefix = (sc, sid) => "media-parts/" + sc + "/" + sid + "/";
  return {
    gate: async () => (owner ? {} : { error: { status: 404, body: { error: "not found" } } }),
    who,
    now,
    random: () => (++n).toString(16).padStart(32, "0"),
    objectKey: (_s, name) => "uploads/" + slug + "/" + name,
    urlOf: (_s, name) => "/u/" + slug + "/" + name,
    used: async () => {
      const objs = [...B.store.keys()].filter((k) => k.startsWith("uploads/" + slug + "/") && isMediaName(k.split("/").pop()));
      return { files: objs.length, bytes: objs.reduce((t, k) => t + B.raw(k).length, 0) };
    },
    // THE LEDGER OVER THE BUCKET'S OWN CONDITIONAL WRITE, as the Worker's.
    readLedger: async (sc) => {
      const got = await B.get(ledgerKey(sc));
      if (!got) return { held: {}, rev: 0, etag: null };
      const j = JSON.parse(await got.text());
      return { held: j.held, rev: j.rev || 0, etag: got.etag };
    },
    writeLedger: async (sc, { held, rev, w }, etag) => !!(await B.put(ledgerKey(sc), JSON.stringify({ v: 2, rev, w, held }), { onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" } })),
    exists: async (key) => {
      const h = await B.head(key);
      return h ? { size: h.size, kind: MEDIA_FORMATS[key.split(".").pop()].kind, up: h.customMetadata.up || "" } : null;
    },
    create: async (key, { mime, meta }) => (await B.createMultipartUpload(key, { httpMetadata: { contentType: mime }, customMetadata: meta })).uploadId,
    uploadPart: (key, id, i, bytes) => B.resumeMultipartUpload(key, id).uploadPart(i, bytes),
    complete: async (key, id, parts) => ({ size: (await B.resumeMultipartUpload(key, id).complete(parts)).size }),
    abort: (key, id) => B.resumeMultipartUpload(key, id).abort(),
    saveSession: (sc, s) => B.put("media-sessions/" + sc + "/" + s.sid + ".json", JSON.stringify(s)),
    loadSession: async (sc, sid) => (B.store.has("media-sessions/" + sc + "/" + sid + ".json") ? JSON.parse(new TextDecoder().decode(B.raw("media-sessions/" + sc + "/" + sid + ".json"))) : null),
    dropSession: (sc, sid) => B.delete("media-sessions/" + sc + "/" + sid + ".json"),
    savePart: (sc, sid, i, etag) => B.put(partsPrefix(sc, sid) + i, "", { customMetadata: { etag } }),
    savedParts: async (sc, sid) => Object.fromEntries([...B.store.keys()].filter((k) => k.startsWith(partsPrefix(sc, sid))).map((k) => [Number(k.split("/").pop()), B.store.get(k).customMetadata.etag])),
    dropParts: async (sc, sid) => B.delete([...B.store.keys()].filter((k) => k.startsWith(partsPrefix(sc, sid)))),
  };
}
/** A file of `size` bytes whose first bytes are a real fixture's. */
function sized(name, size) {
  const head = fixture(name);
  const out = new Uint8Array(size);
  out.set(head.subarray(0, Math.min(head.length, size)));
  for (let i = head.length; i < size; i++) out[i] = i % 251;
  return out;
}
const LIM = mediaLimits({});
async function send(deps, scope, bytes, name, { replace, meta } = {}) {
  const st = await handleMediaStart(deps, { scope, limits: LIM, name, size: bytes.length, type: "", replace, meta });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await handleMediaPart(deps, { scope, sid: st.body.session, n, bytes: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    if (p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await handleMediaComplete(deps, { scope, sid: st.body.session, parts });
  return { st, done };
}

test("A SMALL FILE: one part, the bytes decide, and it appears at its address with its metadata", async () => {
  const B = mediaBucket();
  const deps = siteDeps(B);
  const bytes = fixture("clip.webm");
  const { st, done } = await send(deps, "site-fold", bytes, "Our kitchen.webm", { meta: { duration: 4, width: 64, height: 48, extra: "x" } });
  assert.equal(st.status, 201);
  assert.equal(st.body.parts, 1);
  assert.equal(done.status, 201, JSON.stringify(done.body));
  assert.match(done.body.name, /^[a-f0-9]{32}\.webm$/);
  assert.equal(done.body.url, "/u/fold/" + done.body.name);
  assert.deepEqual([done.body.kind, done.body.mime, done.body.size, done.body.duration, done.body.width], ["video", "video/webm", bytes.length, 4, 64]);
  const key = "uploads/fold/" + done.body.name;
  assert.deepEqual(B.raw(key), bytes, "the stored bytes are not the file");
  const stored = B.store.get(key);
  assert.equal(stored.httpMetadata.contentType, "video/webm");
  assert.deepEqual(readStoredMeta(stored.customMetadata), { duration: 4, width: 64, height: 48 });
  assert.equal(decodeURIComponent(stored.customMetadata.dl), "Our kitchen.webm");
  // THE SESSION IS KEPT AS A COMPLETION RECORD (2026-10-15), its parts'
  // records gone and its room given back: the file is counted from now on.
  const rec = [...B.store.keys()].filter((k) => k.startsWith("media-sessions/"));
  assert.equal(rec.length, 1);
  assert.equal(JSON.parse(new TextDecoder().decode(B.raw(rec[0]))).state, "done");
  assert.equal([...B.store.keys()].filter((k) => k.startsWith("media-parts/")).length, 0, "the parts' records outlived the upload");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(B.raw("media-ledger/site-fold.json"))).held, {}, "the finished upload still holds room");
});

test("A LARGE FILE GOES IN PARTS, EACH CHECKED, AND APPEARS ONLY WHEN THE LAST ONE IS IN", async () => {
  const B = mediaBucket();
  const deps = siteDeps(B);
  const size = MEDIA_PART_BYTES * 2 + 12345;
  const bytes = sized("clip.mp4", size);
  const st = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "tour.mp4", size });
  assert.equal(st.body.parts, 3);
  assert.equal(partsFor(size), 3);
  assert.equal(partLength(size, 3), 12345);
  const key = "uploads/fold/" + st.body.name;
  const p1 = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 1, bytes: bytes.subarray(0, MEDIA_PART_BYTES) });
  assert.equal(p1.status, 200);
  assert.equal(B.store.has(key), false, "the file appeared before it was whole");
  // A PART OF THE WRONG LENGTH IS REFUSED, SAID, AND NEVER REACHES R2.
  const before = B.calls.filter((c) => c === "uploadPart").length;
  const short = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 2, bytes: bytes.subarray(MEDIA_PART_BYTES, MEDIA_PART_BYTES * 2 - 1) });
  assert.deepEqual([short.status, short.body.code, short.body.expected], [400, "bad_length", MEDIA_PART_BYTES]);
  assert.equal(B.calls.filter((c) => c === "uploadPart").length, before);
  const p2 = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 2, bytes: bytes.subarray(MEDIA_PART_BYTES, MEDIA_PART_BYTES * 2) });
  // FINISHING WITH A PART MISSING IS REFUSED, NAMING IT, AND NOTHING APPEARS —
  // whatever the page claims: the third part never reached the server.
  const early = await handleMediaComplete(deps, { scope: "site-fold", sid: st.body.session, parts: [{ n: 1, etag: p1.body.etag }, { n: 3, etag: "made-up" }] });
  assert.deepEqual([early.status, early.body.code, early.body.missing], [400, "parts_missing", [3]]);
  assert.equal(B.store.has(key), false);
  const short2 = await handleMediaComplete(deps, { scope: "site-fold", sid: st.body.session, parts: [{ n: 1, etag: p1.body.etag }, { n: 2, etag: p2.body.etag }] });
  assert.deepEqual([short2.status, short2.body.code, short2.body.missing], [400, "parts_missing", [3]], "a file was finished without its last part");
  assert.equal(B.store.has(key), false, "a file appeared without its last part");
  const p3 = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 3, bytes: bytes.subarray(MEDIA_PART_BYTES * 2) });
  assert.equal(p3.status, 200);
  // THE SERVER HOLDS EVERY PART'S ETAG, so finishing needs none from the page.
  const done = await handleMediaComplete(deps, { scope: "site-fold", sid: st.body.session, parts: [] });
  assert.equal(done.status, 201);
  assert.equal(done.body.size, size);
  assert.deepEqual(B.raw(key), bytes, "the parts were not joined in order");
});

test("AN INTERRUPTED TRANSFER: a part that fails is sent again alone; an abandoned upload leaves nothing, and its session expires", async () => {
  const B = mediaBucket({ fail: { uploadPart: 1 } });
  const deps = siteDeps(B);
  const size = MEDIA_PART_BYTES + 100;
  const bytes = sized("tone.wav", size);
  const st = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "talk.wav", size });
  await assert.rejects(handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 1, bytes: bytes.subarray(0, MEDIA_PART_BYTES) }), /uploadPart failed/);
  const again = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 1, bytes: bytes.subarray(0, MEDIA_PART_BYTES) });
  assert.equal(again.status, 200, "the same part could not be sent again");
  // ABANDONED: the page goes away. Nothing is at the address; the session is
  // reserved only until it expires, and then gone.
  assert.equal(B.store.has("uploads/fold/" + st.body.name), false);
  let clock = Date.now() + 25 * 60 * 60 * 1000;
  const later = siteDeps(B, { now: () => clock });
  const p2 = await handleMediaPart(later, { scope: "site-fold", sid: st.body.session, n: 2, bytes: bytes.subarray(MEDIA_PART_BYTES) });
  assert.deepEqual([p2.status, p2.body.code], [404, "no_session"], "an expired upload went on");
  // ABORTED: the parts are given up and nothing appears.
  const st2 = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "talk.wav", size });
  await handleMediaPart(deps, { scope: "site-fold", sid: st2.body.session, n: 1, bytes: bytes.subarray(0, MEDIA_PART_BYTES) });
  const ab = await handleMediaAbort(deps, { scope: "site-fold", sid: st2.body.session });
  assert.equal(ab.status, 200);
  assert.ok(B.calls.includes("abort"));
  assert.equal(B.uploads.size, 1, "the aborted upload's parts were kept (only the expired one is left for R2 to clear)");
  assert.equal(B.store.has("uploads/fold/" + st2.body.name), false);
  // A COMPLETE THAT FAILS IN R2 IS SAID, AND THE SESSION STAYS FOR ANOTHER TRY.
  const C = mediaBucket({ fail: { complete: 1 } });
  const cd = siteDeps(C);
  const small = fixture("tone.mp3");
  const s3 = await handleMediaStart(cd, { scope: "site-fold", limits: LIM, name: "a.mp3", size: small.length });
  const pp = await handleMediaPart(cd, { scope: "site-fold", sid: s3.body.session, n: 1, bytes: small });
  const fail = await handleMediaComplete(cd, { scope: "site-fold", sid: s3.body.session, parts: [{ n: 1, etag: pp.body.etag }] });
  assert.deepEqual([fail.status, fail.body.code], [502, "complete_failed"]);
  const ok = await handleMediaComplete(cd, { scope: "site-fold", sid: s3.body.session, parts: [{ n: 1, etag: pp.body.etag }] });
  assert.equal(ok.status, 201, "the upload could not be finished on a second try");
});

test("UNSUPPORTED FILES are refused by name or by contents, and a refused first part aborts the upload", async () => {
  const B = mediaBucket();
  const deps = siteDeps(B);
  const txt = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "notes.txt", size: 100, type: "text/plain" });
  assert.deepEqual([txt.status, txt.body.code], [415, "bad_type"]);
  assert.match(txt.body.error, /MP4, WebM or MOV; audio: MP3, M4A, AAC, WAV, Ogg or FLAC/);
  // CALLED .mp4, IS A PNG: refused on the first part, from the bytes.
  const png = new Uint8Array(200); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const st = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "fake.mp4", size: png.length });
  const p = await handleMediaPart(deps, { scope: "site-fold", sid: st.body.session, n: 1, bytes: png });
  assert.deepEqual([p.status, p.body.code], [415, "bad_type"]);
  assert.ok(B.calls.includes("abort"), "a refused upload was left open");
  assert.equal(B.calls.filter((c) => c === "uploadPart").length, 0, "the refused bytes reached R2");
  // CALLED .mp4, IS WEBM: said, with what it is, never renamed for them.
  const webm = fixture("clip.webm");
  const st2 = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "clip.mp4", size: webm.length });
  const p2 = await handleMediaPart(deps, { scope: "site-fold", sid: st2.body.session, n: 1, bytes: webm });
  assert.deepEqual([p2.status, p2.body.code, p2.body.is], [415, "format_mismatch", "webm"]);
  // CALLED .mp3, IS A VIDEO: the kind disagrees.
  const st3 = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "song.mp3", size: webm.length });
  const p3 = await handleMediaPart(deps, { scope: "site-fold", sid: st3.body.session, n: 1, bytes: webm });
  assert.equal(p3.body.code, "bad_type");
});

test("LIMITS: per file by kind, per site in files and bytes, with live uploads reserved", async () => {
  const B = mediaBucket();
  const deps = siteDeps(B);
  const big = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "long.mp3", size: LIM.audioBytes + 1 });
  assert.deepEqual([big.status, big.body.code, big.body.max], [413, "too_big", LIM.audioBytes]);
  const okVideo = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "long.mp4", size: LIM.audioBytes + 1 });
  assert.equal(okVideo.status, 201, "a video was held to the audio limit");
  const small = { ...LIM, siteFiles: 2, siteBytes: 1_000_000 };
  const C = mediaBucket();
  const cd = siteDeps(C);
  const a = await send(cd, "site-fold", fixture("tone.mp3"), "a.mp3");
  assert.equal(a.done.status, 201);
  // ONE MORE STARTED (not finished) HOLDS THE LAST PLACE.
  const held = await handleMediaStart(cd, { scope: "site-fold", limits: small, name: "b.mp3", size: 1000 });
  assert.equal(held.status, 201);
  const full = await handleMediaStart(cd, { scope: "site-fold", limits: small, name: "c.mp3", size: 1000 });
  assert.deepEqual([full.status, full.body.code, full.body.max], [409, "full", 2]);
  const bytes = await handleMediaStart(cd, { scope: "site-fold", limits: { ...small, siteFiles: 10 }, name: "d.mp3", size: 995_000 });
  assert.deepEqual([bytes.status, bytes.body.code], [409, "full"], "the bytes limit was not held");
  assert.equal(await handleMediaStart(cd, { scope: "site-fold", limits: LIM, name: "x.mp3", size: 0 }).then((r) => r.body.code), "no_size");
});

test("REPLACING keeps the address, the kind and the format; a missing file or another kind is refused", async () => {
  const B = mediaBucket();
  const deps = siteDeps(B);
  const first = await send(deps, "site-fold", fixture("tone.mp3"), "intro.mp3");
  const name = first.done.body.name;
  const next = sized("tone.mp3", 9000);
  const r = await send(deps, "site-fold", next, "intro v2.mp3", { replace: name });
  assert.equal(r.done.status, 200, JSON.stringify(r.done.body));
  assert.equal(r.done.body.name, name, "a replacement moved the file to a new address");
  assert.equal(r.done.body.replaced, true);
  assert.deepEqual(B.raw("uploads/fold/" + name), next);
  const other = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "x.mp4", size: 100, replace: name });
  assert.equal(other.body.code, "kind_mismatch");
  const fmt = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "x.wav", size: 100, replace: name });
  assert.equal(fmt.body.code, "format_mismatch");
  const none = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "x.mp3", size: 100, replace: "f".repeat(32) + ".mp3" });
  assert.equal(none.status, 404);
  const bad = await handleMediaStart(deps, { scope: "site-fold", limits: LIM, name: "x.mp3", size: 100, replace: "../../etc/passwd" });
  assert.equal(bad.status, 404);
  // A REPLACEMENT RESERVES ITS WHOLE SIZE (2026-10-15): while it is sent the
  // old file is still stored and served, so a promise to be smaller — or only
  // a little bigger — releases nothing. It adds no file to the count.
  const have = B.raw("uploads/fold/" + name).length;
  const tight = { ...LIM, siteBytes: have + 500, siteFiles: 1 };
  const smaller = await handleMediaStart(deps, { scope: "site-fold", limits: tight, name: "x.mp3", size: have - 100, replace: name });
  assert.deepEqual([smaller.status, smaller.body.code], [409, "full"], "an unfinished smaller replacement was let release storage");
  const fits = await handleMediaStart(deps, { scope: "site-fold", limits: tight, name: "x.mp3", size: 400, replace: name });
  assert.equal(fits.status, 201, "a replacement was charged as a new file");
});

test("OWNERSHIP: every step asks the gate, and a session is only its scope's", async () => {
  const B = mediaBucket();
  const mine = siteDeps(B);
  const st = await handleMediaStart(mine, { scope: "site-fold", limits: LIM, name: "a.mp3", size: fixture("tone.mp3").length });
  const notMine = siteDeps(B, { owner: false });
  for (const r of [
    await handleMediaStart(notMine, { scope: "site-fold", limits: LIM, name: "a.mp3", size: 10 }),
    await handleMediaPart(notMine, { scope: "site-fold", sid: st.body.session, n: 1, bytes: fixture("tone.mp3") }),
    await handleMediaComplete(notMine, { scope: "site-fold", sid: st.body.session, parts: [] }),
    await handleMediaAbort(notMine, { scope: "site-fold", sid: st.body.session }),
  ]) assert.equal(r.status, 404, "a caller who is not the owner got past the gate");
  // ANOTHER SITE'S SCOPE CANNOT USE THIS SESSION.
  const other = await handleMediaPart(siteDeps(B, { slug: "other" }), { scope: "site-other", sid: st.body.session, n: 1, bytes: fixture("tone.mp3") });
  assert.equal(other.body.code, "no_session");
  const forged = await handleMediaPart(mine, { scope: "site-fold", sid: "../x", n: 1, bytes: fixture("tone.mp3") });
  assert.equal(forged.body.code, "no_session");
  // A SESSION IS BOUND TO THE ACCOUNT THAT STARTED IT (2026-10-15): in the
  // same scope, past the same gate, another account's request finds nothing —
  // not its status, its parts, its finish or its abort.
  const someoneElse = siteDeps(B, { who: "u-other" });
  for (const r of [
    await handleMediaStatus(someoneElse, { scope: "site-fold", sid: st.body.session }),
    await handleMediaPart(someoneElse, { scope: "site-fold", sid: st.body.session, n: 1, bytes: fixture("tone.mp3") }),
    await handleMediaComplete(someoneElse, { scope: "site-fold", sid: st.body.session, parts: [] }),
  ]) assert.deepEqual([r.status, r.body.code], [404, "no_session"], "another account reached this account's upload");
  assert.equal((await handleMediaStatus(mine, { scope: "site-fold", sid: st.body.session })).body.state, "open");
});

test("the browser's report is kept as metadata, strictly, and said as the browser's", () => {
  assert.deepEqual(readMediaMeta({ duration: 12.34, width: 1920, height: 1080 }), { duration: 12.3, width: 1920, height: 1080 });
  assert.deepEqual(readMediaMeta({ duration: "12", width: 1920 }), {});
  assert.deepEqual(readMediaMeta({ duration: Infinity, width: -1, height: 2 }), {});
  assert.deepEqual(mediaMetadata({ name: "Tour‮4pm.mp4", meta: { duration: 4 }, kind: "video" }), { media: "video", dl: encodeURIComponent("Tour 4pm.mp4"), dur: "4" });
  const block = mediaBlock([{ url: "/u/f/a.mp4", name: "Tour.mp4", kind: "video", size: 12_000_000, duration: 95, width: 1280, height: 720 }, { url: "/u/f/b.png", kind: "image" }]);
  assert.match(block, /"Tour\.mp4": \/u\/f\/a\.mp4 \(MP4 video, 12 MB, 1:35 long, 1280×720\)/);
  assert.match(block, /Nobody has watched or listened to these files/);
  assert.match(block, /<video> or <audio>/);
  assert.doesNotMatch(block, /b\.png/, "a picture was listed as media");
  assert.equal(mediaBlock([]), "");
  assert.deepEqual(pagesUsing([{ path: "index.tsx", source: "<video src=\"/u/fold/" + "a".repeat(32) + ".mp4\" />" }, { path: "b.tsx", source: "" }], "fold", "a".repeat(32) + ".mp4"), ["index.tsx"]);
  assert.equal(mediaName("z".repeat(32), "mp4"), null);
  assert.equal(isMediaName("a".repeat(32) + ".mp4"), true);
  assert.equal(isMediaName("a".repeat(32) + ".exe"), false);
});
