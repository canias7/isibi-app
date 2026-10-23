// AUDIT BATCH 3 (2026-10-22): findings 21-24 of
// docs/audits/2026-10-17-builder-audit.md. Offline; nothing spent.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { saveDraftRecord, previousSidecar, heldMediaSource, heldStandIns, DRAFT_KEY } from "../site-draft.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { MEDIA_PART_BYTES } from "../site-media.mjs";
import { MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { buildPrefix, STATE_DIR, HELD_ABSENT_BODY } from "../site-builds.mjs";
import { manifestFromCsv, mergeRedirects } from "../site-seo.mjs";
import { carryPanelFields } from "../site-meta.mjs";
import { r2Conditional } from "./fixtures/request-flow.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function store() {
  const m = new Map(); let at = 1;
  return {
    m,
    get: async (k) => { const o = m.get(k); return o ? { etag: o.etag, text: async () => o.body } : null; },
    put: async (k, body, _ct, onlyIf) => {
      const cur = m.get(k);
      if (!r2Conditional(onlyIf || {}, cur ? { etag: cur.etag, at: cur.at } : null)) return null;
      const etag = crypto.createHash("md5").update(body).digest("hex");
      m.set(k, { body, etag, at: at++ }); return { etag };
    },
  };
}
const V = (n) => "0179" + String(n).padStart(10, "0") + "-abcdef";
const LIVE = "sitemeta/bakery.json";
const side = (routes, redirects = "") => JSON.stringify({ routesCsv: routes, redirectsCsv: redirects, verify: [] });

// ── A11-3 ────────────────────────────────────────────────────────────────────
async function renamedDraft() {
  const s = store();
  // Live: /, /about, /visit. Draft revision 1 renamed About to Our story.
  await s.put(LIVE, side("/,/about,/visit"));
  await s.put(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json", side("/,/our-story,/visit", "/about=/our-story"));
  assert.equal((await saveDraftRecord(s, "bakery", { version: V(1) })).ok, true);
  return s;
}

test("B3-1 A11-3 A LATER DRAFT SAVE KEEPS THE RENAME'S REDIRECT — under draft-first the previous manifest is the standing draft's staged sidecar, so the next save (renamed = null) still maps /about to /our-story, not home", async () => {
  const s = await renamedDraft();
  const got = await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE });
  assert.equal(got.from, "draft");
  const prev = manifestFromCsv(got.side.routesCsv, got.side.redirectsCsv);
  const red = mergeRedirects(prev, ["/", "/our-story", "/visit"], null);
  assert.equal(red["/about"], "/our-story");
  // CONTROL — the live sidecar alone (the old read) sends /about home.
  const live = JSON.parse(s.m.get(LIVE).body);
  assert.equal(mergeRedirects(manifestFromCsv(live.routesCsv, live.redirectsCsv), ["/", "/our-story", "/visit"], null)["/about"], "/");
});

test("B3-2 A11-3 WITHOUT DRAFT-FIRST, OR WITH NO READABLE STAGED SIDECAR, THE LIVE SIDECAR IS READ; AN UNREADABLE DRAFT RECORD THROWS (never read as no history)", async () => {
  const s = await renamedDraft();
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: false, liveKey: LIVE })).from, "live");
  s.m.delete(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json");
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE })).from, "live");
  await s.put(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json", HELD_ABSENT_BODY);
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE })).from, "live");
  const none = store();
  assert.equal(await previousSidecar(none, "bakery", { draftFirst: true, liveKey: LIVE }), null);
  const bad = store();
  await bad.put("site-drafts/bakery.json", "{not json");
  await assert.rejects(previousSidecar(bad, "bakery", { draftFirst: true, liveKey: LIVE }));
});

test("B3-3 A11-3 WIRING — composePublish reads its previous manifest through previousSidecar with the draft-first switch, never the live key directly", () => {
  const at = worker.indexOf("async function composePublish(");
  const end = worker.indexOf("const redirects = mergeRedirects(prev, man.routes, renamed);", at);
  assert.ok(at > 0 && end > at, "both landmarks");
  const body = worker.slice(at, end);
  assert.match(body, /previousSidecar\(buildDeps\(env\), slug, \{ draftFirst: draftFirst\(env\), liveKey: siteMetaKey\(slug\) \}\)/);
  assert.doesNotMatch(body, /SITES_BUCKET\.get\(siteMetaKey\(slug\)\)/);
});

// ── A11-2 ────────────────────────────────────────────────────────────────────
const S = (o) => JSON.stringify(o);

test("B3-4 A11-2 PUBLISH KEEPS A PANEL CHANGE MADE AFTER THE DRAFT WAS STAGED — the verification tag always; the card and description when the live head differs from the staged head of the version that was live; an edit's description saved in the draft stands", () => {
  const prior = S({ description: "Bread.", image: "/u/b/a.jpg", origin: "https://b.gofarther.app", routesCsv: "/", redirectsCsv: "", verify: [] });
  const live = S({ description: "Fresh bread daily.", image: "/u/b/c.jpg", origin: "https://b.gofarther.app", routesCsv: "/", redirectsCsv: "", verify: [{ name: "google-site-verification", content: "tok" }] });
  const draft = S({ description: "Bread.", image: "/u/b/a.jpg", origin: "https://b.gofarther.app", routesCsv: "/,/visit", redirectsCsv: "/old=/", verify: [] });
  const out = JSON.parse(carryPanelFields(draft, live, prior));
  assert.deepEqual(out.verify, [{ name: "google-site-verification", content: "tok" }]);
  assert.equal(out.description, "Fresh bread daily.");
  assert.equal(out.image, "/u/b/c.jpg");
  assert.equal(out.routesCsv, "/,/visit"); assert.equal(out.redirectsCsv, "/old=/");
  // An edit's description in the draft, no panel change since: the draft's.
  const edited = S({ ...JSON.parse(draft), description: "Sourdough on the quay." });
  assert.equal(JSON.parse(carryPanelFields(edited, prior, prior)).description, "Sourdough on the quay.");
  // Nothing to carry: the same bytes back. Unreadable live: the version's own.
  assert.equal(carryPanelFields(draft, prior, prior), draft);
  assert.equal(carryPanelFields(draft, null, prior), draft);
  assert.equal(carryPanelFields(draft, "{bad", prior), draft);
  assert.equal(carryPanelFields(draft, S({ held: "absent" }), prior), draft);
  // No prior staged head: the verification tag only.
  const np = JSON.parse(carryPanelFields(draft, live, null));
  assert.equal(np.description, "Bread."); assert.equal(np.verify.length, 1);
});

test("B3-5 A11-2 WIRING — Publish (when it moves the pointer) and restore hand activation the version's sidecar through withPanelFields, never the staged bytes alone", () => {
  const pub = worker.indexOf("async function runPublication(");
  const pubEnd = worker.indexOf("const act = await activateBuild(deps, {", pub);
  assert.ok(pub > 0 && pubEnd > pub, "runPublication landmarks");
  assert.match(worker.slice(pub, pubEnd), /if \(j\.from !== j\.version\) sidecar = await withPanelFields\(deps, slug, sidecar, j\.from(, \{ origin: !rename \})?\);/);
  const rs = worker.indexOf("async function restoreVersion(");
  const rsEnd = worker.indexOf("putWorker:", rs);
  assert.ok(rs > 0 && rsEnd > rs, "restoreVersion landmarks");
  const r = worker.slice(rs, rsEnd);
  assert.match(r, /sidecar: await (?:withShareHost\(env, slug, await )?withPanelFields\(deps, slug, /);
  assert.doesNotMatch(r, /sidecar: typeof b\.sidecar === "string" \? b\.sidecar : undefined, sidecarKey/);
  assert.match(worker, /async function withPanelFields\(deps, slug, sidecar, prior(, opts = \{\})?\) \{[\s\S]{0,400}carryPanelFields\(sidecar, live, was(, opts)?\)/);
});

// ── A10-2 ────────────────────────────────────────────────────────────────────
blockNetwork();

test("B3-6 A10-2 THE PREVIEW FOLLOWS THE HELD LIBRARY OPS AS PUBLISH APPLIES THEM — a chained replacement [A<-B, B<-C] plays B's bytes at A (Publish copies B to A before C reaches B); two replacements of A play the later; a stand-in deleted after its replacement is gone and A still gets its bytes; a file held for removal is gone", () => {
  const R = (name, w) => ({ kind: "media-replace", name, with: w });
  assert.equal(heldMediaSource([R("a.mp3", "b.mp3"), R("b.mp3", "c.mp3")], "a.mp3"), "b.mp3");
  assert.equal(heldMediaSource([R("a.mp3", "b.mp3"), R("b.mp3", "c.mp3")], "b.mp3"), "c.mp3");
  assert.equal(heldMediaSource([R("a.mp3", "b.mp3"), R("a.mp3", "c.mp3")], "a.mp3"), "c.mp3");
  assert.equal(heldMediaSource([R("a.mp3", "b.mp3"), { kind: "media-delete", name: "b.mp3" }], "a.mp3"), "b.mp3");
  assert.equal(heldMediaSource([R("a.mp3", "b.mp3")], "b.mp3"), null);
  assert.equal(heldMediaSource([{ kind: "media-delete", name: "a.mp3" }], "a.mp3"), null);
  assert.equal(heldMediaSource([{ kind: "upload-delete", file: "0a.png" }], "0a.png"), null);
  assert.equal(heldMediaSource([], "a.mp3"), "a.mp3");
  assert.deepEqual([...heldStandIns([R("a.mp3", "b.mp3")])], [["b.mp3", "a.mp3"]]);
});

const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
async function hit(wk, env, method, host, path, { body, json, headers = {} } = {}) {
  const init = { method, headers: { Authorization: TOKEN, ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await wk.fetch(new Request("https://" + host + path, init), env, makeCtx());
  const buf = new Uint8Array(await res.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, bytes: buf, body: parsed };
}
const app = (wk, env, method, path, opts) => hit(wk, env, method, "gofarther.dev", path, opts);
async function upload(wk, env, slug, bytes, name, extra = {}) {
  const base = "/api/site/" + slug + "/media";
  const st = await app(wk, env, "POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await app(wk, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    parts.push({ n, etag: p.body.etag });
  }
  return { st, done: await app(wk, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } }) };
}
const take = (bytes, x) => { const b = new Uint8Array(bytes); for (let i = b.length - 64; i < b.length; i++) b[i] = b[i] ^ x; return b; };
async function publishLive(store, slug, version) {
  const pre = buildPrefix(slug, version);
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }), { httpMetadata: { contentType: "application/json" } });
  await store.put(pre + SERVER_FILE, "export default {}", { httpMetadata: { contentType: "text/javascript" } });
  await store.put("current/" + slug + ".json", JSON.stringify({ version, build: "b0", parent: "", job: null, activatedAt: "2026-10-16T00:00:00.000Z" }), { httpMetadata: { contentType: "application/json" } });
}

test("B3-7 A10-2 THROUGH THE REAL MEDIA ROUTES — a held replacement's stand-in cannot be replaced or deleted on its own (409 stand_in, nothing held); replacing the original again plays the later take in the preview AND on the live site after Publish (they agreed on neither before); the stand-ins are gone after Publish", async () => {
  const wk = await loadWorker();
  const slug = "b3-standin";
  const store = mediaBucket();
  const env = { ...envFor(store), SITE_WORKERS: { get: () => ({ fetch: async () => new Response("page") }) } };
  await withWire({}, async () => {
    const one = fixture("tone.mp3"); const two = take(one, 0x5a); const three = take(one, 0x33);
    const first = await upload(wk, env, slug, one, "Welcome.mp3", { meta: { duration: 2 } });
    assert.equal(first.done && first.done.status, 201);
    const name = first.done.body.name; const url = first.done.body.url;
    await publishLive(store, slug, "01790500000000-aaaaaa");
    env.DRAFT_FIRST = "on";
    const r2 = await upload(wk, env, slug, two, "Welcome take 2.mp3", { replace: name, meta: { duration: 2 } });
    assert.ok(r2.done.status < 300, JSON.stringify(r2.done.body));
    const standIn = r2.done.body.name;
    // (b) Replace on the stand-in: refused, nothing started.
    const onStand = await app(wk, env, "POST", "/api/site/" + slug + "/media", { json: { name: "Welcome take 3.mp3", size: three.length, type: "", replace: standIn } });
    assert.deepEqual([onStand.status, onStand.body && onStand.body.code, onStand.body && onStand.body.replaces], [409, "stand_in", name], JSON.stringify(onStand.body));
    // (c) Delete on the stand-in: refused; the replacement still stands.
    const del = await app(wk, env, "DELETE", "/api/site/" + slug + "/uploads/" + standIn);
    assert.deepEqual([del.status, del.body && del.body.code], [409, "stand_in"], JSON.stringify(del.body));
    // The original replaced again: the later take.
    const r3 = await upload(wk, env, slug, three, "Welcome take 3.mp3", { replace: name, meta: { duration: 2 } });
    assert.ok(r3.done.status < 300, JSON.stringify(r3.done.body));
    const rec = JSON.parse(String(await (await store.get(DRAFT_KEY(slug))).text()).trim());
    const pv = slug + "--draft-" + rec.preview + ".gofarther.app";
    const pw = await hit(wk, env, "GET", pv, url);
    assert.equal(pw.status, 200);
    assert.deepEqual(pw.bytes, three, "the preview did not play the take Publish will put live");
    const shown = await app(wk, env, "GET", "/api/site/" + slug + "/draft");
    const pub = await app(wk, env, "POST", "/api/site/" + slug + "/publish", { json: { revision: shown.body.revision, version: shown.body.draft } });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const live = await hit(wk, env, "GET", slug + ".gofarther.app", url);
    assert.deepEqual(live.bytes, three, "the live site does not play what the preview played");
    assert.equal(await store.head("uploads/" + slug + "/" + standIn), null);
    assert.equal(await store.head("uploads/" + slug + "/" + r3.done.body.name), null);
  });
});

test("B3-8 A10-2 WIRING — the writers' media list (siteMediaFiles) leaves out what Publish takes off (heldMediaSource null: stand-ins and held removals); the preview's /u/ reads heldMediaSource; the Files panel offers no Use in chat, Replace or delete on a stand-in row", () => {
  const at = worker.indexOf("async function siteMediaFiles(");
  const end = worker.indexOf(".map((o) => {", at);
  assert.ok(at > 0 && end > at, "landmarks");
  const body = worker.slice(at, end);
  assert.match(body, /draftView\(env, slug\)/);
  assert.match(body, /heldMediaSource\(ops, uploadFileName\(o\.key\)\) !== null/);
  const sp = worker.indexOf("async function servePreview(");
  const spEnd = worker.indexOf("THE PLATFORM'S OWN `/u/` ROUTE", sp);
  assert.ok(sp > 0 && spEnd > sp);
  assert.match(worker.slice(sp, spEnd), /const file = heldMediaSource\(ops, um\[2\]\.toLowerCase\(\)\);\s*if \(file === null\) return no\(\);/);
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const c = chat.indexOf("const standIn = f.draft === 'replaces';");
  assert.ok(c > 0, "the stand-in flag");
  const row = chat.slice(c, chat.indexOf("shareBtn + mediaBtns + '</figure>'", c));
  assert.match(row, /const mediaBtns = \(vid \|\| aud\) && !f\.visitor && !standIn/);
  assert.match(row, /\(standIn \? '' : '<button type="button" class="fl-del"/);
});
