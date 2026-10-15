// THE PAGE'S HALF OF A VIDEO OR AUDIO UPLOAD (2026-10-14): `public/site-media.js`,
// driven with a fake network. A file is cut into the parts the server asked
// for, in order; a part that fails on the network or with a 5xx is sent again
// alone; a refusal ends the upload at once with the server's own sentence and
// gives up what was sent; a connection that keeps dropping is said; a
// cancelled upload stops and gives up. What is media, by name or type.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");
const PART = 1000;

/** A fake server: `plan[n]` is what part n answers on each try, in turn. */
function fakeApi({ parts = 3, plan = {}, start = null, complete = null } = {}) {
  const log = [];
  const tries = {};
  return {
    log,
    api: {
      start: async (body) => { log.push(["start", body]); return start || { status: 201, body: { ok: true, session: "s".repeat(32), partBytes: PART, parts } }; },
      part: async (sid, n, blob) => {
        tries[n] = (tries[n] || 0) + 1;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        log.push(["part", n, bytes.length, bytes[0]]);
        const a = (plan[n] || [])[tries[n] - 1];
        if (a === "throw") throw new Error("network down");
        if (a) return a;
        return { status: 200, body: { ok: true, n, etag: "e" + n } };
      },
      complete: async (sid, list) => { log.push(["complete", list]); return complete || { status: 201, body: { ok: true, name: "x.mp4", url: "/u/s/x.mp4", kind: "video" } }; },
      abort: async () => { log.push(["abort"]); return { status: 200, body: { ok: true } }; },
    },
  };
}
const file = (size, name = "tour.mp4", type = "video/mp4") => {
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = Math.floor(i / PART) + 1;
  return new File([b], name, { type });
};
const noWait = () => Promise.resolve();

test("what is media, by name or by type", () => {
  assert.ok(SiteMedia.isMedia({ name: "tour.MOV", type: "" }));
  assert.ok(SiteMedia.isMedia({ name: "x", type: "audio/mpeg" }));
  assert.ok(!SiteMedia.isMedia({ name: "menu.pdf", type: "application/pdf" }));
  assert.ok(!SiteMedia.isMedia({ name: "photo.jpg", type: "image/jpeg" }));
  assert.equal(SiteMedia.kindOf({ name: "a.webm", type: "" }), "video");
  assert.equal(SiteMedia.kindOf({ name: "a.flac", type: "" }), "audio");
  // THE NAMES THE COMPOSER SENDS ARE REAL FIXTURES' NAMES.
  for (const f of ["clip.mp4", "clip.webm", "clip.mov", "tone.mp3", "tone.m4a", "tone.aac", "tone.wav", "tone.ogg", "tone.flac"]) {
    assert.ok(readFileSync(new URL("./fixtures/media/" + f, import.meta.url)).length > 0);
    assert.ok(SiteMedia.isMedia({ name: f, type: "" }), f);
  }
});

test("a file goes in the parts the server asked for, in order, and the answer is the stored file", async () => {
  const f = fakeApi();
  const seen = [];
  const r = await SiteMedia.upload(file(2500), { api: f.api, wait: noWait, meta: { duration: 3 }, progress: (s, t) => seen.push([s, t]) });
  assert.equal(r.ok, true);
  assert.equal(r.file.url, "/u/s/x.mp4");
  assert.deepEqual(f.log[0], ["start", { name: "tour.mp4", size: 2500, type: "video/mp4", meta: { duration: 3 } }]);
  assert.deepEqual(f.log.filter((x) => x[0] === "part").map((x) => [x[1], x[2], x[3]]), [[1, 1000, 1], [2, 1000, 2], [3, 500, 3]], "the parts were not cut where the server said");
  assert.deepEqual(f.log.find((x) => x[0] === "complete")[1], [{ n: 1, etag: "e1" }, { n: 2, etag: "e2" }, { n: 3, etag: "e3" }]);
  assert.deepEqual(seen, [[1000, 2500], [2000, 2500], [2500, 2500]]);
  assert.ok(!f.log.some((x) => x[0] === "abort"));
});

test("AN INTERRUPTED TRANSFER: a dropped part is sent again alone; the others are not resent", async () => {
  const f = fakeApi({ plan: { 2: ["throw", { status: 502, body: null }] } });
  const r = await SiteMedia.upload(file(2500), { api: f.api, wait: noWait });
  assert.equal(r.ok, true);
  assert.deepEqual(f.log.filter((x) => x[0] === "part").map((x) => x[1]), [1, 2, 2, 2, 3], "a part other than the dropped one was sent again");
});

test("a connection that keeps dropping is said, and what was sent is given up", async () => {
  const f = fakeApi({ plan: { 1: ["throw", "throw", "throw", "throw", "throw"] } });
  const r = await SiteMedia.upload(file(2500), { api: f.api, wait: noWait });
  assert.deepEqual([r.ok, r.code], [false, "network"]);
  assert.equal(f.log.filter((x) => x[0] === "part").length, SiteMedia.PART_TRIES);
  assert.ok(f.log.some((x) => x[0] === "abort"), "the half-sent upload was left open");
  assert.ok(!f.log.some((x) => x[0] === "complete"));
});

test("a refusal ends the upload at once, in the server's own words", async () => {
  const f = fakeApi({ plan: { 1: [{ status: 415, body: { error: "that doesn't look like a video or audio file", code: "bad_type" } }] } });
  const r = await SiteMedia.upload(file(2500), { api: f.api, wait: noWait });
  assert.deepEqual([r.ok, r.code, r.error], [false, "bad_type", "that doesn't look like a video or audio file"]);
  assert.equal(f.log.filter((x) => x[0] === "part").length, 1, "a refused part was sent again");
  assert.ok(f.log.some((x) => x[0] === "abort"));
  const g = fakeApi({ start: { status: 413, body: { error: "that video is too big — keep it under 250 MB", code: "too_big" } } });
  const t = await SiteMedia.upload(file(10), { api: g.api, wait: noWait });
  assert.deepEqual([t.ok, t.code, t.error], [false, "too_big", "that video is too big — keep it under 250 MB"]);
  assert.ok(!g.log.some((x) => x[0] === "part"));
});

test("a cancelled upload stops between parts and gives up what was sent", async () => {
  const f = fakeApi();
  let n = 0;
  const r = await SiteMedia.upload(file(2500), { api: f.api, wait: noWait, cancelled: () => ++n > 1 });
  assert.deepEqual([r.ok, r.code], [false, "cancelled"]);
  assert.equal(f.log.filter((x) => x[0] === "part").length, 1);
  assert.ok(f.log.some((x) => x[0] === "abort"));
});

test("a replacement names the file it replaces", async () => {
  const f = fakeApi({ parts: 1 });
  await SiteMedia.upload(file(10, "intro.mp3", "audio/mpeg"), { api: f.api, wait: noWait, replace: "a".repeat(32) + ".mp3" });
  assert.equal(f.log[0][1].replace, "a".repeat(32) + ".mp3");
});

// ── THE COMPOSER'S WIRING (2026-10-14) ─────────────────────────────────────
// `chat.js` cannot be imported, so the composer's half is read where it is
// written: a video or recording is hosted, not shown to a model and not one of
// the three picture places; a message waits while one is sending; the message
// names each file; a first build sends the drafts' names; the Files panel's
// delete asks again for a file a page plays.
test("the composer hosts a video, holds the message while it sends, names it, and hands drafts to the first build", async () => {
  const { readFileSync: rf } = await import("node:fs");
  const chat = rf(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /const hosted = typeof SiteMedia !== 'undefined' \? all\.filter\(\(f\) => SiteMedia\.isMedia\(f\)\) : \[\];\n\s+hosted\.forEach\(\(f\) => siteAttachMedia\(owner, f\)\);\n\s+const picked = all\.filter\(\(f\) => !hosted\.includes\(f\)\);/,
    "a video is still read into the picture places, or not hosted");
  assert.match(chat, /if \(md\.some\(\(m\) => m\.state === 'up'\)\) \{ if \(typeof sbToast === 'function'\) sbToast\('Your file is still uploading/, "a message goes while its file is still sending");
  assert.match(chat, /t = t \+ '\\n\\n' \+ ready\.map\(mediaRefLine\)\.join\('\\n'\);/, "the message does not name its files");
  assert.match(chat, /media: Array\.isArray\(site\.pendingMedia\) && site\.pendingMedia\.length \? site\.pendingMedia\.slice\(0, 20\) : undefined/, "a first build is not told its drafts");
  assert.match(chat, /slug \? '\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/media' : '\/api\/media\/drafts'/, "a file is not sent to the library or the drafts");
  assert.match(chat, /if \(r2\.status === 409\) \{/, "a held delete is not asked again");
  assert.match(chat, /'\?force=1', \{ method: 'DELETE' \}/);
  const html = rf(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("/site-media.js") > 0 && html.indexOf("/site-media.js") < html.indexOf("/chat.js\""), "the page does not load the upload script before chat.js");
});
