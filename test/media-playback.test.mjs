// A REAL BROWSER PLAYS AND SEEKS THE OWNER'S VIDEO AND AUDIO (2026-10-14).
//
// The owner: *"support browser playback and seeking with appropriate
// Range/HEAD responses … Use small local audio/video fixtures to verify …
// playback and seeking."* Headless Chromium loads a page with <video> and
// <audio> elements pointing at `/u/<slug>/<file>`, served by the REAL
// Worker's own handler (a local HTTP server hands each request to
// `worker.fetch` as it came, Range header and all), from files stored in R2
// as a finished upload stores them. For each fixture it waits for the
// browser's own `loadedmetadata`, seeks, waits for `seeked`, and reads back
// where it landed and what the network did: a Range request answered 206.
//
// WHAT THIS CANNOT SHOW: proprietary codecs. This Chromium build has no
// H.264/AAC decoder, so the MP4, MOV, M4A and AAC fixtures are asked only
// what the browser says it can play (`canPlayType`) and are not played here;
// Chrome, Edge and Safari ship those decoders. Skipped where no browser is
// installed, said by name.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { mediaMetadata } from "../site-media.mjs";

const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const SLUG = "play-site";
const FILES = {
  video: [["clip.webm", "video/webm", 4]],
  audio: [["tone.wav", "audio/wav", 2], ["tone.mp3", "audio/mpeg", 2], ["tone.ogg", "audio/ogg", 2], ["tone.flac", "audio/flac", 2]],
  proprietary: [["clip.mp4", "video/mp4"], ["clip.mov", "video/quicktime"], ["tone.m4a", "audio/mp4"], ["tone.aac", "audio/aac"]],
};
const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
const nameOf = (i, f) => String(i).padStart(32, "a") + "." + f.split(".").pop();

async function serve(worker, env, seen) {
  const page = (els) => "<!doctype html><meta charset=utf-8><body>" + els + "</body>";
  const server = http.createServer(async (req, res) => {
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(page(globalThis.__mediaPage || "")); return; }
    const headers = {};
    for (const h of ["range", "if-none-match"]) if (req.headers[h]) headers[h] = req.headers[h];
    const r = await worker.fetch(new Request("https://gofarther.dev" + req.url, { method: req.method, headers }), env, makeCtx());
    seen.push({ path: req.url, method: req.method, range: headers.range || "", status: r.status });
    const out = {};
    r.headers.forEach((v, k) => { out[k] = v; });
    res.writeHead(r.status, out);
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return server;
}

test("Chromium plays and seeks the owner's WebM video and WAV, MP3, Ogg and FLAC audio, through the Worker's own serving", { skip: SKIP }, async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const all = [...FILES.video, ...FILES.audio, ...FILES.proprietary];
  all.forEach(([f, mime], i) => {
    store.store.set("uploads/" + SLUG + "/" + nameOf(i, f), { bytes: fixture(f), etag: "e" + i, at: 1, httpMetadata: { contentType: mime }, customMetadata: mediaMetadata({ name: f, kind: mime.split("/")[0] }) });
  });
  const seen = [];
  // THE APP'S OWN ASSETS are not under test: the browser's favicon asks land there.
  const server = await serve(worker, { SITES_BUCKET: store, ASSETS: { fetch: async () => new Response("not here", { status: 404 }) } }, seen);
  const port = server.address().port;
  const playable = [...FILES.video, ...FILES.audio];
  globalThis.__mediaPage = playable.map(([f, mime], i) => {
    const tag = mime.startsWith("video") ? "video" : "audio";
    return "<" + tag + ' id="m' + i + '" preload="auto" muted src="/u/' + SLUG + "/" + nameOf(i, f) + '"></' + tag + ">";
  }).join("");
  const b = await chromium.launch({ executablePath: EXE });
  try {
    const pg = await b.newPage();
    await pg.goto("http://127.0.0.1:" + port + "/");
    for (let i = 0; i < playable.length; i++) {
      const [f, , dur] = playable[i];
      const got = await pg.evaluate(async ({ id, to }) => {
        const el = document.getElementById(id);
        const wait = (ev) => new Promise((ok, no) => {
          const t = setTimeout(() => no(new Error(ev + " timed out, error " + (el.error && el.error.code))), 8000);
          el.addEventListener(ev, () => { clearTimeout(t); ok(); }, { once: true });
        });
        if (el.readyState < 1) await wait("loadedmetadata");
        const duration = el.duration;
        el.currentTime = to;
        await wait("seeked");
        return { duration, at: el.currentTime, error: el.error ? el.error.code : 0 };
      }, { id: "m" + i, to: dur - 0.5 });
      assert.equal(got.error, 0, f + " failed to play");
      assert.ok(Math.abs(got.duration - dur) < 0.3, f + ": the browser read a duration of " + got.duration + ", not " + dur);
      assert.ok(Math.abs(got.at - (dur - 0.5)) < 0.3, f + ": the seek landed at " + got.at);
    }
    // THE NETWORK: every file was asked for by range and answered 206; nothing failed.
    for (let i = 0; i < playable.length; i++) {
      const path = "/u/" + SLUG + "/" + nameOf(i, playable[i][0]);
      const mine = seen.filter((s) => s.path === path);
      assert.ok(mine.length >= 1, playable[i][0] + " was never requested");
      assert.ok(mine.some((s) => s.range && s.status === 206), playable[i][0] + ": no range request answered 206 — " + JSON.stringify(mine));
      assert.ok(mine.every((s) => s.status === 200 || s.status === 206), playable[i][0] + ": " + JSON.stringify(mine));
    }
    // THE PROPRIETARY FORMATS: served with their types; what this browser says it plays is recorded.
    const can = await pg.evaluate((types) => types.map((t) => document.createElement(t.startsWith("video") ? "video" : "audio").canPlayType(t)), FILES.proprietary.map(([, m]) => m));
    for (let j = 0; j < FILES.proprietary.length; j++) {
      const i = playable.length + j;
      const r = await fetch("http://127.0.0.1:" + port + "/u/" + SLUG + "/" + nameOf(i, FILES.proprietary[j][0]), { method: "HEAD" });
      assert.equal(r.headers.get("content-type"), FILES.proprietary[j][1]);
      assert.equal(r.headers.get("accept-ranges"), "bytes");
    }
    assert.equal(can.length, FILES.proprietary.length);
  } finally {
    await b.close();
    server.close();
    delete globalThis.__mediaPage;
  }
});
