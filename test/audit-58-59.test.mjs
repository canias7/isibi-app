// Audit A33-1 and A33-2 (2026-10-22, the builder audit's findings 58 and 59):
// the SEO tab's description survives the next edit, and Publish keeps the
// owner's panel changes and a later address change made after a draft was
// staged. Driven through the real routes (the SEO tab, Publish) on the
// in-process Worker, with no network and no model call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { MANIFEST_FILE, SERVER_FILE, buildPrefix, STATE_DIR, writeHead } from "../site-builds.mjs";
import { saveDraftRecord } from "../site-draft.mjs";
import { carryPanelFields, keepPanelDescription, siteMetaKey } from "../site-meta.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const TOKEN = "Bearer some-token";
const JSONCT = { httpMetadata: { contentType: "application/json" } };
const OLD = "Neighbourhood sourdough in Bristol.";
const NEW = "Overnight sourdough from a Bristol side street, ready to collect at the counter.";
const LOOK = (description) => ({ brand: "Harbour Loaf", theme: "warm", description });

async function app(wk, env, method, path, json) {
  const init = { method, headers: { Authorization: TOKEN } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  const res = await wk.default.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { body = null; }
  return { status: res.status, body, text };
}
async function stage(store, slug, version, { description, sidecar }) {
  const pre = buildPrefix(slug, version);
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b-" + version.slice(-6) }), JSONCT);
  await store.put(pre + SERVER_FILE, "export default {}", { httpMetadata: { contentType: "text/javascript" } });
  await store.put(pre + STATE_DIR + "config.json", JSON.stringify({ look: LOOK(description) }), JSONCT);
  await store.put(pre + STATE_DIR + "sidecar.json", JSON.stringify(sidecar), JSONCT);
}
const point = (store, slug, version) => store.put("current/" + slug + ".json", JSON.stringify({ version, build: "b-" + version.slice(-6), parent: "", job: null, activatedAt: "2026-10-22T00:00:00.000Z" }), JSONCT);
const readJson = async (store, k) => { const o = await store.get(k); return o ? JSON.parse(await o.text()) : null; };
const V1 = "01790500000000-aaaaaa";
const V2 = "01790500000001-bbbbbb";
const sidecar = (description, extra = {}) => ({ description, routesCsv: "/", redirectsCsv: "", verify: [], origin: "https://old-name.gofarther.app", ...extra });

// ── A33-1 ────────────────────────────────────────────────────────────────────
test("A33-1 THE SEO TAB'S DESCRIPTION SURVIVES THE CHECK EVERY EDIT RUNS FIRST — after the real SEO POST, ensureEditableState (what loadSiteSourceForEdit runs before an edit reads the config it composes the head from) leaves the new description in the config; the live head keeps it too", async () => {
  const wk = await loadWorkerModule();
  const slug = "a33-seo";
  const store = mediaBucket();
  const env = envFor(store);
  await stage(store, slug, V1, { description: OLD, sidecar: sidecar(OLD) });
  await point(store, slug, V1);
  await writeHead({ put: (k, t) => store.put(k, t, JSONCT) }, slug, V1);
  await store.put(CONFIG_KEY(slug), JSON.stringify({ look: LOOK(OLD) }), JSONCT);
  await store.put(siteMetaKey(slug), JSON.stringify(sidecar(OLD)), JSONCT);
  await withWire({}, async () => {
    const r = await app(wk, env, "POST", "/api/site/" + slug + "/seo", { description: NEW });
    assert.deepEqual([r.status, r.body && r.body.live], [200, true], r.text);
    assert.equal((await readJson(store, CONFIG_KEY(slug))).look.description, NEW, "observer: the tab wrote the config");
    const st = await wk.siteTurn.ensureEditableState(env, slug);
    assert.equal(st.ok, true, JSON.stringify(st));
    const cfg = await readJson(store, CONFIG_KEY(slug));
    assert.equal(cfg.look.description, NEW, "the check put the old description back into the config the edit composes from");
    assert.equal(cfg.look.theme, "warm");
    assert.equal((await readJson(store, siteMetaKey(slug))).description, NEW);
  });
});

test("A33-1 A DESCRIPTION THE LIVE HEAD DOES NOT SERVE IS STILL PUT BACK — a job that stored its look before a publish that never came leaves the config ahead; the check still restores the version's look (the repair's purpose)", async () => {
  const wk = await loadWorkerModule();
  const slug = "a33-ahead";
  const store = mediaBucket();
  const env = envFor(store);
  await stage(store, slug, V1, { description: OLD, sidecar: sidecar(OLD) });
  await point(store, slug, V1);
  await writeHead({ put: (k, t) => store.put(k, t, JSONCT) }, slug, V1);
  await store.put(CONFIG_KEY(slug), JSON.stringify({ look: { ...LOOK(NEW), theme: "cold" } }), JSONCT);
  await store.put(siteMetaKey(slug), JSON.stringify(sidecar(OLD)), JSONCT);
  await withWire({}, async () => {
    const st = await wk.siteTurn.ensureEditableState(env, slug);
    assert.equal(st.ok, true, JSON.stringify(st));
    const cfg = await readJson(store, CONFIG_KEY(slug));
    assert.deepEqual([cfg.look.description, cfg.look.theme], [OLD, "warm"]);
  });
});

test("A33-1 THE RULE — kept only when the current description is the one the live head serves; unreadable, missing or different live text puts it back", () => {
  const want = { look: LOOK(OLD), css: "x" };
  const cur = { look: { ...LOOK(NEW), theme: "cold" } };
  assert.deepEqual(keepPanelDescription(want, cur, JSON.stringify({ description: NEW })), { look: LOOK(NEW), css: "x" });
  assert.equal(keepPanelDescription(want, cur, JSON.stringify({ description: OLD })), want);
  assert.equal(keepPanelDescription(want, cur, "{not json"), want);
  assert.equal(keepPanelDescription(want, cur, null), want);
  assert.equal(keepPanelDescription(want, { look: LOOK(OLD) }, JSON.stringify({ description: OLD })), want);
});

test("A33-1 WIRING — ensureEditableState's config merge reads the live head and passes the version's fields through keepPanelDescription before comparing", () => {
  const at = worker.indexOf("async function ensureEditableState(");
  const end = worker.indexOf("async function", at + 40);
  assert.ok(at > 0 && end > at);
  const body = worker.slice(at, end);
  const m = body.indexOf("const mergeConfig = async");
  const same = body.indexOf("sameJson(repairConfigOf(cur.config), want)", m);
  const keep = body.indexOf("keepPanelDescription(", m);
  assert.ok(m > 0 && same > 0, "landmarks");
  assert.ok(keep > m && keep < same, "keepPanelDescription is not applied before the comparison");
  assert.match(body.slice(m, same), /siteMetaKey\(slug\)/);
});

// ── A33-2 ────────────────────────────────────────────────────────────────────
async function draftSite(slug) {
  const store = mediaBucket();
  const env = { ...envFor(store), SITE_WORKERS: { get: () => ({ fetch: async () => new Response("page") }) } };
  await stage(store, slug, V1, { description: OLD, sidecar: sidecar(OLD) });
  await point(store, slug, V1);
  await store.put(CONFIG_KEY(slug), JSON.stringify({ look: LOOK(OLD) }), JSONCT);
  await store.put(siteMetaKey(slug), JSON.stringify(sidecar(OLD)), JSONCT);
  // Revision 1: a colour change, staged with the head as it stood then.
  await stage(store, slug, V2, { description: OLD, sidecar: sidecar(OLD, { css: "red" }) });
  assert.equal((await saveDraftRecord(store, slug, { version: V2 })).ok, true);
  env.DRAFT_FIRST = "on";
  return { store, env };
}
async function publish(wk, env, slug) {
  const shown = await app(wk, env, "GET", "/api/site/" + slug + "/draft");
  assert.equal(shown.status, 200, shown.text);
  return app(wk, env, "POST", "/api/site/" + slug + "/publish", { revision: shown.body.revision, version: shown.body.draft });
}

test("A33-2a THROUGH THE REAL PUBLISH — a description set in the SEO tab and a verification tag set on the live head after the draft was staged are still on the live head after Publish (covered by A11-2's carryPanelFields)", async () => {
  const wk = await loadWorkerModule();
  const slug = "a33-pub";
  const { store, env } = await draftSite(slug);
  await withWire({}, async () => {
    const r = await app(wk, env, "POST", "/api/site/" + slug + "/seo", { description: NEW });
    assert.deepEqual([r.status, r.body && r.body.live], [200, true], r.text);
    // The verification panel's write, as it lands on the live head.
    const live = await readJson(store, siteMetaKey(slug));
    live.verify = [["google-site-verification", "tok123"]];
    await store.put(siteMetaKey(slug), JSON.stringify(live), JSONCT);
    const pub = await publish(wk, env, slug);
    assert.equal(pub.status, 200, pub.text);
    assert.equal((await readJson(store, "current/" + slug + ".json")).version, V2, "observer: Publish moved the pointer");
    const after = await readJson(store, siteMetaKey(slug));
    assert.equal(after.description, NEW);
    assert.deepEqual(after.verify, [["google-site-verification", "tok123"]]);
    assert.equal(after.css, "red", "the version's own fields go live");
  });
});

