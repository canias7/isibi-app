// VIDEO AND AUDIO, RELIABLE IN USE (2026-10-16, branch `codex-work-into-claude`,
// after Codex's review of `99021708`). Small local fixtures
// (`test/fixtures/media/`), R2 as the binding behaves (`r2-media.mjs`), the
// real Worker routes; nothing reaches a network.
//
//   MR1  a delete that stops between its record and the object: the record
//        says deleted, so the address answers 404 (never the stale bytes) and
//        the stopped delete is finished by that read; a live file beside it
//        still plays and seeks (control)
//   MR2  abandoned uploads reclaimed by the tick (`runMediaSweep`): an expired
//        open upload is aborted, its room released, its records gone; a
//        finished one whose record said open keeps its file; an unexpired one
//        is untouched; no file under `uploads/` is ever deleted; an old
//        pre-site draft goes, a young one stays; the cursor carries over ticks
//   MR3  configurable limits reach the runtime: the deploy passes the five
//        `MEDIA_MAX_*` variables with a `default` fallback, a container job is
//        handed them, the owner's file list reports the ones in force, and a
//        configured audio limit refuses a file over it
//        (said in KB under a megabyte); `default` reads as the default
//   MR4  replacement, removal, seeking and preview-versus-live TOGETHER under
//        draft-first on a published site: a recording replaced and a video
//        removed are both held; live plays the old recording (seeking) and the
//        video; the preview plays the new recording at the old address and not
//        the video; Publish of that revision makes both live once, and the tick
//        afterwards deletes nothing
//   MR5  the preview's head is the draft's: a draft save writes the draft's own
//        sidecar, the live one untouched; the site script reads it when
//        previewing; the container's storage wall admits it
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { MEDIA_PART_BYTES, MEDIA_DRAFT_MS, mediaLimits, MEDIA_DEFAULTS } from "../site-media.mjs";
import { DRAFT_KEY, DRAFT_SIDECAR_KEY, saveAsDraft } from "../site-draft.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { jobSecrets, JOB_ENV_NAMES } from "../builder/edit-job.mjs";

const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const other = (b) => { const c = new Uint8Array(b); for (let i = c.length - 64; i < c.length; i++) c[i] ^= 0x5a; return c; };
const V0 = "01790500000000-aaaaaa";

async function hit(worker, env, method, host, path, { json, body, headers = {} } = {}) {
  const init = { method, headers: { Authorization: "Bearer t", ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const ctx = makeCtx();
  const res = await worker.fetch(new Request("https://" + host + path, init), env, ctx);
  const buf = new Uint8Array(await res.arrayBuffer());
  await Promise.allSettled(ctx.pending);
  let parsed = null; try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, headers: res.headers, bytes: buf, body: parsed };
}
const app = (w, e, m, p, o) => hit(w, e, m, "gofarther.dev", p, o);
async function upload(worker, env, slug, bytes, name, extra = {}) {
  const base = "/api/site/" + slug + "/media";
  const st = await app(worker, env, "POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await app(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    parts.push({ n, etag: p.body.etag });
  }
  const done = await app(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}
async function liveSite(store, slug) {
  const pre = buildPrefix(slug, V0);
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }));
  await store.put(pre + SERVER_FILE, "export default {}");
  await store.put("current/" + slug + ".json", JSON.stringify({ version: V0, build: "b0", parent: "", job: null, activatedAt: "x" }));
}

// ── MR1 ─────────────────────────────────────────────────────────────────────

test("MR1 A DELETE STOPPED BETWEEN ITS RECORD AND THE OBJECT — the address answers 404, never the stale bytes, and that read finishes the delete; a live file beside it still plays and seeks", async () => {
  const worker = await loadWorker();
  const slug = "mr-delete";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const a = await upload(worker, env, slug, fixture("tone.mp3"), "Gone.mp3");
    const b = await upload(worker, env, slug, fixture("tone.ogg"), "Kept.ogg");
    assert.equal(a.done.status, 201);
    // THE OBJECT'S DELETE FAILS ONCE: the record already says deleted.
    store.calls.length = 0;
    const realDelete = store.delete.bind(store);
    let fail = 1;
    store.delete = async (k) => { if (fail-- > 0) throw new Error("r2 delete failed"); return realDelete(k); };
    const del = await app(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + a.done.body.name + "?force=1");
    assert.equal(del.status, 502, "the stopped delete was not said as stopped: " + JSON.stringify(del.body));
    assert.ok(await store.head("uploads/" + slug + "/" + a.done.body.name), "the case did not leave the object behind — it tests nothing");
    for (const host of ["gofarther.dev", slug + ".gofarther.app"]) {
      const g = await hit(worker, env, "GET", host, a.done.body.url);
      assert.equal(g.status, 404, host + ": a file deleted by its record still played: " + g.status);
    }
    assert.equal(await store.head("uploads/" + slug + "/" + a.done.body.name), null, "the read did not finish the stopped delete");
    // CONTROL: the other file plays and seeks.
    const kept = await hit(worker, env, "GET", slug + ".gofarther.app", b.done.body.url, { headers: { range: "bytes=0-99" } });
    assert.deepEqual([kept.status, kept.bytes.length], [206, 100]);
  });
});

// ── MR2 ─────────────────────────────────────────────────────────────────────

test("MR2 ABANDONED UPLOADS RECLAIMED BY THE TICK — an expired open upload aborted, its room and records gone; a finished upload whose record said open keeps its file; an unexpired upload untouched; no file deleted; an old draft goes, a young one stays", async () => {
  const worker = await loadWorker();
  const mod = await loadWorkerModule();
  const slug = "mr-sweep";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const big = new Uint8Array(MEDIA_PART_BYTES + 1000); big.set(fixture("clip.webm"));
    // A: abandoned after its first part.
    const aSt = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Abandoned.webm", size: big.length, type: "" } });
    assert.equal(aSt.status, 201, JSON.stringify(aSt.body));
    await app(worker, env, "PUT", "/api/site/" + slug + "/media/" + aSt.body.session + "/1", { body: big.subarray(0, MEDIA_PART_BYTES) });
    // B: finished. C: finished, but its record lost the finish (still says open).
    const b = await upload(worker, env, slug, fixture("tone.mp3"), "Done.mp3");
    const c = await upload(worker, env, slug, fixture("tone.wav"), "Landed.wav");
    const cKey = "media-sessions/site-" + slug + "/" + c.st.body.session + ".json";
    const cRec = JSON.parse(await (await store.get(cKey)).text());
    await store.put(cKey, JSON.stringify({ ...cRec, state: "open", file: undefined }));
    // D: started later, still in its day.
    const now0 = Date.now();
    // PRE-SITE DRAFTS: one far past its 7 days, one young.
    await store.put("drafts/u-1/" + "a".repeat(32) + ".mp3", "old", {});
    const files0 = (await store.list({ prefix: "uploads/" })).objects;
    const ledgerOf = async () => { const l = await store.get("media-ledger/site-" + slug + ".json"); return l ? JSON.parse(await l.text()).held : {}; };
    assert.ok(Object.hasOwn(await ledgerOf(), aSt.body.session), "the abandoned upload holds no room — this case tests nothing");

    // AN HOUR ON: nothing has expired — every session and the draft stay.
    const early = await mod.runMediaSweep(env, { now: now0 + 3600 * 1000 });
    assert.deepEqual([early.reclaimed, early.drafts], [0, 0], "something was reclaimed inside its time: " + JSON.stringify(early));
    assert.ok(await store.get("drafts/u-1/" + "a".repeat(32) + ".mp3"), "a young pre-site draft was removed");
    await store.delete("media-sweep/cursor.json");
    // THE TICK, A DAY AND MORE LATER, until the listing is done.
    const later = now0 + 26 * 3600 * 1000;
    const dateNow = Date.now; Date.now = () => later;
    let total = { reclaimed: 0, kept: 0, drafts: 0 };
    try {
      for (let i = 0; i < 6; i++) {
        const r = await mod.runMediaSweep(env, { now: later + MEDIA_DRAFT_MS });
        total = { reclaimed: total.reclaimed + r.reclaimed, kept: total.kept + r.kept, drafts: total.drafts + r.drafts };
      }
    } finally { Date.now = dateNow; }
    assert.equal(total.reclaimed, 3, "not exactly the three expired sessions reclaimed: " + JSON.stringify(total));
    assert.equal(total.kept, 1, "the finished upload whose record said open was not recognised as landed");
    assert.ok(store.calls.includes("abort"), "the abandoned multipart upload was never aborted");
    assert.equal(Object.hasOwn(await ledgerOf(), aSt.body.session), false, "the abandoned upload's room was not released");
    assert.equal((await store.list({ prefix: "media-sessions/" })).objects.length, 0, "a session record was left");
    assert.equal((await store.list({ prefix: "media-parts/" })).objects.length, 0, "a part record was left");
    // NO FILE DELETED: B and C play.
    const files1 = (await store.list({ prefix: "uploads/" })).objects;
    assert.deepEqual(files1.map((o) => o.key).sort(), files0.map((o) => o.key).sort(), "the sweep touched a file");
    for (const f of [b, c]) assert.equal((await hit(worker, env, "GET", slug + ".gofarther.app", f.done.body.url)).status, 200);
    assert.equal(total.drafts, 1, "the old pre-site draft was not removed");

    // AN UNEXPIRED UPLOAD IS UNTOUCHED.
    const dSt = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Fresh.webm", size: big.length, type: "" } });
    const r2 = await mod.runMediaSweep(env, { now: Date.now() });
    assert.equal(r2.reclaimed, 0);
    assert.ok(await store.get("media-sessions/site-" + slug + "/" + dSt.body.session + ".json"), "an upload still in its day was reclaimed");
  });
});

// ── MR3 ─────────────────────────────────────────────────────────────────────

test("MR3 CONFIGURABLE LIMITS REACH THE RUNTIME — the deploy passes the five variables with a `default` fallback; a container job is handed them; the file list reports the ones in force; a configured audio limit refuses a larger file, said in KB; `default` reads as the default", async () => {
  const wf = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  for (const n of ["MEDIA_MAX_VIDEO_BYTES", "MEDIA_MAX_AUDIO_BYTES", "MEDIA_MAX_SITE_BYTES", "MEDIA_MAX_SITE_FILES", "MEDIA_MAX_DRAFT_FILES"]) {
    assert.match(wf, new RegExp("vars: \\|\\n(?:\\s+[A-Z_]+\\n)*\\s+" + n + "\\n"), n + " is not in the deploy's vars list");
    assert.match(wf, new RegExp(n + ": \\$\\{\\{ vars\\." + n + " \\|\\| 'default' \\}\\}"), n + " has no `default` fallback (an empty value fails the deploy)");
    assert.ok(JOB_ENV_NAMES.includes(n), n + " is not handed to a container job");
  }
  assert.deepEqual(mediaLimits({ MEDIA_MAX_AUDIO_BYTES: "default" }), { ...MEDIA_DEFAULTS }, "`default` did not read as the default");
  const configured = { MEDIA_MAX_AUDIO_BYTES: "5000" };
  assert.equal(mediaLimits(jobSecrets(configured)).audioBytes, 5000, "a container job does not get the configured limit");
  const worker = await loadWorker();
  const slug = "mr-limits";
  const store = mediaBucket();
  const env = { ...envFor(store), ...configured };
  await withWire({}, async () => {
    // THE LIMITS IN FORCE, AS THE OWNER'S FILE LIST REPORTS THEM (the runtime
    // route answers booleans only, by its own contract).
    const list = await app(worker, env, "GET", "/api/site/" + slug + "/uploads");
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.deepEqual([list.body.media.maxAudio, list.body.media.maxVideo], [5000, MEDIA_DEFAULTS.videoBytes], "the configured limit is not the one in force: " + JSON.stringify(list.body.media));
    const rt = await app(worker, env, "GET", "/api/site/runtime?slug=" + slug);
    assert.equal(rt.status, 200);
    assert.equal(Object.hasOwn(rt.body, "mediaLimits"), false, "the runtime route carries a value, against its booleans-only contract");
    const big = await app(worker, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Long.mp3", size: fixture("tone.mp3").length, type: "" } });
    assert.equal(big.status, 413, JSON.stringify(big.body));
    assert.match(big.body.error, /under 5 KB/, "a limit under a megabyte was not said in KB: " + big.body.error);
  });
});

// ── MR4 ─────────────────────────────────────────────────────────────────────

test("MR4 REPLACEMENT, REMOVAL, SEEKING AND PREVIEW-VERSUS-LIVE TOGETHER — held under draft-first: live plays the old recording (seeking) and the video; the preview plays the new recording at the old address and not the video; Publish makes both live once; the tick then deletes nothing", async () => {
  const worker = await loadWorker();
  const mod = await loadWorkerModule();
  const slug = "mr-together";
  const store = mediaBucket();
  const env = { ...envFor(store), SITE_WORKERS: { get: () => ({ fetch: async () => new Response("page") }) } };
  await withWire({}, async () => {
    const song = fixture("tone.mp3"), song2 = other(song), clip = fixture("clip.mp4");
    const a = await upload(worker, env, slug, song, "Welcome.mp3");
    const v = await upload(worker, env, slug, clip, "Tour.mp4");
    await liveSite(store, slug);
    env.DRAFT_FIRST = "on";
    const rep = await upload(worker, env, slug, song2, "Welcome 2.mp3", { replace: a.done.body.name });
    assert.equal(rep.done.body.held, true, JSON.stringify(rep.done.body));
    const del = await app(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + v.done.body.name + "?force=1");
    assert.equal(del.body && del.body.held, true, "the removal was not held: " + JSON.stringify(del.body));
    const tail = (b) => [...b.subarray(b.length - 64)];
    // LIVE: as published.
    const L = slug + ".gofarther.app";
    assert.deepEqual(tail((await hit(worker, env, "GET", L, a.done.body.url, { headers: { range: "bytes=" + (song.length - 64) + "-" } })).bytes), tail(song), "live seeked into the replacement before Publish");
    assert.equal((await hit(worker, env, "GET", L, v.done.body.url)).status, 200, "live lost the video before Publish");
    // PREVIEW: as the draft has it.
    const rec = JSON.parse(bare(await (await store.get(DRAFT_KEY(slug))).text()));
    const PV = slug + "--draft-" + rec.preview + ".gofarther.app";
    const ps = await hit(worker, env, "GET", PV, a.done.body.url, { headers: { range: "bytes=" + (song2.length - 64) + "-" } });
    assert.deepEqual([ps.status, tail(ps.bytes)], [206, tail(song2)], "the preview did not seek into the draft's replacement");
    assert.equal((await hit(worker, env, "GET", PV, v.done.body.url)).status, 404, "the preview still played the removed video");
    // PUBLISH the newest revision, then again.
    const st = await app(worker, env, "GET", "/api/site/" + slug + "/draft");
    const pub = await app(worker, env, "POST", "/api/site/" + slug + "/publish", { json: { revision: st.body.revision, version: st.body.draft } });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const after = await hit(worker, env, "GET", L, a.done.body.url, { headers: { range: "bytes=0-99" } });
    assert.deepEqual([after.status, [...after.bytes]], [206, [...song2.subarray(0, 100)]], "Publish did not put the replacement live");
    assert.equal((await hit(worker, env, "GET", L, v.done.body.url)).status, 404, "Publish did not take the video off");
    const again = await app(worker, env, "POST", "/api/site/" + slug + "/publish", { json: { revision: st.body.revision } });
    assert.equal(again.body.already, true);
    // THE TICK DELETES NOTHING THAT PLAYS.
    const before = (await store.list({ prefix: "uploads/" })).objects.map((o) => o.key).sort();
    await mod.runMediaSweep(env, { now: Date.now() + 30 * 3600 * 1000 });
    assert.deepEqual((await store.list({ prefix: "uploads/" })).objects.map((o) => o.key).sort(), before, "the tick deleted a file");
    assert.equal((await hit(worker, env, "GET", L, a.done.body.url)).status, 200);
  });
});

// ── MR5 ─────────────────────────────────────────────────────────────────────

test("MR5 THE PREVIEW'S HEAD IS THE DRAFT'S — a draft save writes the draft's own sidecar and leaves the live one; the site script reads it when previewing; the container's storage wall admits it", async () => {
  const store = new Map();
  const deps = {
    get: async (k) => (store.has(k) ? { etag: store.get(k).etag, text: async () => store.get(k).body } : null),
    put: async (k, body, _ct, cond = {}) => {
      const cur = store.get(k);
      if (cond.etagMatches && (!cur || cur.etag !== cond.etagMatches)) return null;
      if (cond.etagDoesNotMatch === "*" && cur) return null;
      const etag = String(Math.random()); store.set(k, { body: String(body), etag }); return { etag };
    },
  };
  store.set("sitemeta/mr5.json", { body: JSON.stringify({ description: "live words" }), etag: "x" });
  const sidecar = JSON.stringify({ description: "the draft's words", redirects: [["/old", "/"]] });
  const out = await saveAsDraft(deps, { slug: "mr5", version: "01790600000000-bbbbbb", sidecar, commit: async () => {} });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(store.get(DRAFT_SIDECAR_KEY("mr5")).body, sidecar, "the draft's sidecar was not written");
  assert.equal(JSON.parse(store.get("sitemeta/mr5.json").body).description, "live words", "a draft save wrote the live sidecar");
  // THE SITE SCRIPT, landmark to landmark: previewing reads the draft's sidecar first.
  const src = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const a = src.indexOf("async function loadMeta(env: Env, previewing = false)");
  const b = src.indexOf('env.SITES.get("sitemeta/" + SITE_SLUG + ".json")', a);
  assert.ok(a > 0 && b > a, "the site script's meta reader moved — rescope this");
  assert.match(src.slice(a, b), /if \(previewing\) \{\s*const draft = env\.SITES && \(await env\.SITES\.get\("sitemeta-draft\/" \+ SITE_SLUG \+ "\.json"\)\);/);
  assert.match(src, /await loadMeta\(env, previewing\);/, "the preview flag never reaches the meta reader");
  assert.equal(allowedJobKey("mr5", "a".repeat(32), "sitemeta-draft/mr5.json"), true, "a container job may not write the draft's sidecar");
  assert.equal(allowedJobKey("mr5", "a".repeat(32), "sitemeta-draft/other.json"), false, "a container job may write another site's draft sidecar");
});
