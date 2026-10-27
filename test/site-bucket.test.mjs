// Each site's own bucket (2026-10-27): the name, which keys a site may read,
// the copy from the shared bucket, and the REST calls. Supplied stores only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { siteBucketName, isServingKey, headKeys, syncSiteBucket, ensureSiteBucket, restBucket, deleteSiteBucket, RESYNC_PREFIX } from "../builder/site-bucket.mjs";

function store(objs = {}) {
  const m = new Map(Object.entries(objs).map(([k, v]) => [k, { body: v, etag: "e:" + v }]));
  return {
    m,
    calls: [],
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key, etag: m.get(key).etag })); },
    async get(key) { const o = m.get(key); return o ? { body: o.body, contentType: "text/plain" } : null; },
    async put(key, body) { this.calls.push("put " + key); m.set(key, { body, etag: "e:" + body }); },
    async del(key) { this.calls.push("del " + key); m.delete(key); },
  };
}

test("bucket names are valid R2 names, unique per slug, never a shared fallback", () => {
  assert.equal(siteBucketName("fold-lane-bakery"), "gfs-fold-lane-bakery");
  assert.equal(siteBucketName("Fold_Lane"), "gfs-foldlane");
  assert.equal(siteBucketName(""), "");
  assert.equal(siteBucketName("--"), "");
  const a = siteBucketName("a".repeat(80)), b = siteBucketName("a".repeat(79) + "b");
  for (const n of [a, b]) assert.match(n, /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/);
  assert.notEqual(a, b);
});

test("a site may read only its own builds' client files, state sidecar and head keys", () => {
  const s = "bakery";
  assert.ok(isServingKey(s, "builds/bakery/v1/client/assets/a.js"));
  assert.ok(isServingKey(s, "builds/bakery/v1/state/sidecar.json"));
  for (const k of headKeys(s)) assert.ok(isServingKey(s, k));
  for (const k of [
    "builds/bakery/v1/server.js", "builds/bakery/v1/manifest.json", "builds/bakery/v1/state/source.json",
    "builds/other/v1/client/a.js", "sitemeta/other.json", "sites/other/site.live", "source/bakery/pages.json",
    "builds/bakery/v1/client/../../x", "builds/bakery//client/a.js", "builds/bakery/v1/client/",
  ]) assert.equal(isServingKey(s, k), false, k);
});

test("the sync copies only serving keys, trims removed builds, and puts the marker last", async () => {
  const src = store({
    "builds/b/v2/client/a.js": "A", "builds/b/v2/state/sidecar.json": "S", "builds/b/v2/server.js": "SECRET-ISH",
    "sitemeta/b.json": "M2", "sites/b/site.live": "1", "builds/c/v1/client/x.js": "OTHER",
  });
  const dst = store({ "builds/b/v1/client/old.js": "O", "sitemeta/b.json": "M1" });
  const r = await syncSiteBucket({ slug: "b", src, dst });
  assert.deepEqual(r, { done: true, copied: 4, removed: 1, failed: 0, left: 0 });
  assert.deepEqual([...dst.m.keys()].sort(), ["builds/b/v2/client/a.js", "builds/b/v2/state/sidecar.json", "sitemeta/b.json", "sites/b/site.live"]);
  assert.equal(dst.m.get("sitemeta/b.json").body, "M2");
  assert.equal(dst.calls.at(-1), "put sites/b/site.live");
  // A second sync has nothing to do.
  dst.calls.length = 0;
  assert.deepEqual(await syncSiteBucket({ slug: "b", src, dst }), { done: true, copied: 0, removed: 0, failed: 0, left: 0 });
  assert.deepEqual(dst.calls, []);
});

test("a site taken offline in the shared bucket loses its marker in its own", async () => {
  const src = store({ "builds/b/v1/client/a.js": "A" });
  const dst = store({ "builds/b/v1/client/a.js": "A", "sites/b/site.live": "1" });
  const r = await syncSiteBucket({ slug: "b", src, dst });
  assert.equal(r.done, true);
  assert.equal(dst.m.has("sites/b/site.live"), false);
});

test("a copy that fails or runs out of budget is not done", async () => {
  const src = store({ "builds/b/v1/client/a.js": "A", "builds/b/v1/client/b.js": "B", "sites/b/site.live": "1" });
  const short = await syncSiteBucket({ slug: "b", src, dst: store(), budget: 1 });
  assert.equal(short.done, false);
  assert.equal(short.left, 2);
  const broken = store();
  broken.put = async () => { throw new Error("503"); };
  const r = await syncSiteBucket({ slug: "b", src, dst: broken });
  assert.equal(r.done, false);
  assert.equal(r.failed, 3);
  // With the budget spent before the marker, the site is never made live early.
  const dst = store();
  await syncSiteBucket({ slug: "b", src, dst, budget: 2 });
  assert.equal(dst.m.has("sites/b/site.live"), false);
});

test("creating a bucket that exists is done; a refusal is not", async () => {
  const at = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
  const args = { accountId: "acc", apiToken: "t", bucket: "gfs-b" };
  assert.deepEqual(await ensureSiteBucket(args, { fetch: at(200, {}) }), { ok: true, status: 200, created: true });
  assert.equal((await ensureSiteBucket(args, { fetch: at(409, {}) })).ok, true);
  assert.equal((await ensureSiteBucket(args, { fetch: at(400, { errors: [{ code: 10004 }] }) })).ok, true);
  assert.equal((await ensureSiteBucket(args, { fetch: at(403, { errors: [{ code: 10000 }] }) })).ok, false);
  assert.equal((await ensureSiteBucket({ ...args, bucket: "" }, { fetch: at(200, {}) })).ok, false);
});

test("REST objects: each path part encoded, the bucket in the URL, a missing key's delete is done", async () => {
  const seen = [];
  const fetch = async (url, init) => { seen.push([init.method || "GET", url]); return { ok: init.method !== "DELETE", status: init.method === "DELETE" ? 404 : 200, json: async () => ({ result: [], result_info: {} }) }; };
  const b = restBucket({ accountId: "acc", apiToken: "t", bucket: "gfs-b" }, { fetch });
  await b.put("builds/b/v1/client/a b.js", "x", "text/javascript");
  await b.del("sites/b/site.live");
  await b.list("builds/b/");
  assert.equal(seen[0][1], "https://api.cloudflare.com/client/v4/accounts/acc/r2/buckets/gfs-b/objects/builds/b/v1/client/a%20b.js");
  assert.equal(seen[1][0], "DELETE");
  assert.match(seen[2][1], /\/r2\/buckets\/gfs-b\/objects\?prefix=builds%2Fb%2F/);
});

// ── The wiring in worker.js ─────────────────────────────────────────────────
const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a), j = W.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, a + " … " + b); return W.slice(i, j); };

test("the switch decides, and anything short of a finished copy keeps the shared bucket", () => {
  const f = between("async function sealedBucketFor(", "\n}\n");
  assert.match(f, /env\.SITE_OWN_BUCKETS !== "1"[^\n]*return shared/);
  assert.match(f, /if \(!made\.ok\)[^\n]*return shared/);
  assert.match(f, /if \(!r\.done\)[^\n]*return shared/);
  assert.match(f, /catch \(e\) \{[\s\S]*return shared/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /const bucket = await sealedBucketFor\(env, slug, creds\);[\s\S]*return \{ bucket, vars:/);
});

test("offline removes the own bucket's marker before anything changes; Back online copies it after", () => {
  const r = between("if (lb.on !== false && !(await ownBucketMarker(env, lslug, \"off\")))", "AN OPEN PUBLICATION IS ABANDONED");
  assert.ok(r.indexOf("ownBucketMarker(env, lslug, \"off\")") < r.indexOf("takeOffline(liveDeps"));
  assert.ok(r.indexOf("putBackOnline(liveDeps") < r.indexOf("ownBucketMarker(env, lslug, \"sync\")"));
});

test("every activation and every panel write of the head copies to the own bucket", () => {
  const live = W.split('liveKey: "sites/" + slug + "/" + SITE_LIVE_FILE,').length - 1;
  const after = W.split('liveKey: "sites/" + slug + "/" + SITE_LIVE_FILE, afterLive: () => ownBucketMarker(env, slug, "sync"),').length - 1;
  assert.ok(live >= 4);
  assert.equal(after, live);
  const panels = [...W.matchAll(/await env\.SITES_BUCKET\.put\(siteMetaKey\((\w+)\), JSON\.stringify\(side\)[^;]*;( await ownBucketMarker\(env, (\w+), "sync"\);)?/g)];
  assert.ok(panels.length >= 5);
  for (const m of panels) { assert.ok(m[2], "panel write without a copy: " + m[0].slice(0, 80)); assert.equal(m[3], m[1]); }
});

test("activateBuild calls afterLive only after its marker stands, and never fails on it", () => {
  const S = fs.readFileSync(new URL("../site-builds.mjs", import.meta.url), "utf8");
  const i = S.indexOf("if (!made) { liveMissing = true; uploadedOk = false; }"), j = S.indexOf("await afterLive()");
  assert.ok(i > 0 && j > i);
  assert.match(S.slice(j - 120, j + 120), /uploadedOk && typeof afterLive === "function"[\s\S]*try \{ await afterLive\(\); \} catch/);
});

test("deleting a bucket empties it first; a bucket never made is done; a stuck file is reported", async () => {
  const args = { accountId: "acc", apiToken: "t", bucket: "gfs-b" };
  const seen = [];
  const ok = async (url, init = {}) => {
    seen.push((init.method || "GET") + " " + url.replace("https://api.cloudflare.com/client/v4/accounts/acc/r2/buckets/", ""));
    if (!init.method) return { ok: true, status: 200, json: async () => ({ result: [{ key: "a.js" }, { key: "sites/b/site.live" }], result_info: {} }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  assert.deepEqual(await deleteSiteBucket(args, { fetch: ok }), { ok: true, status: 200, removed: 2 });
  assert.equal(seen.at(-1), "DELETE gfs-b");
  assert.equal(seen.filter((x) => x.startsWith("DELETE gfs-b/objects/")).length, 2);
  const none = async () => ({ ok: false, status: 404, json: async () => null });
  assert.equal((await deleteSiteBucket(args, { fetch: none })).ok, true);
  const stuck = async (url, init = {}) => init.method === "DELETE"
    ? { ok: false, status: 500, json: async () => null }
    : { ok: true, status: 200, json: async () => ({ result: [{ key: "a.js" }], result_info: {} }) };
  const r = await deleteSiteBucket(args, { fetch: stuck });
  assert.equal(r.ok, false);
  assert.equal(r.removed, 0);
});

test("a site's delete drops its own bucket after its files, whatever the switch says", () => {
  const d = between("const workerDrop = await dropSiteWorker(env, dslug);", "The archive goes too");
  assert.ok(d.indexOf("deleteSitePrefix(env, dslug)") < d.indexOf("deleteSiteBucket("));
  assert.doesNotMatch(d, /SITE_OWN_BUCKETS/);
  assert.match(d, /RESYNC_PREFIX \+ dslug/);
});

test("an unfinished copy is remembered and the tick retries it, dropping the mark only when done", () => {
  const f = between("async function sealedBucketFor(", "\n}\n");
  assert.equal((f.match(/await markResync\(env, slug\)/g) || []).length, 2);
  const t = between("async function runOwnBucketResync(", "\n}\n");
  assert.match(t, /limit: RESYNC_PER_TICK/);
  assert.match(t, /if \(r\.done\) \{ await env\.SITES_BUCKET\.delete\(o\.key\)/);
  assert.match(W, /ctx\.waitUntil\(runOwnBucketResync\(env\)/);
  assert.equal(RESYNC_PREFIX, "ownbucket-pending/");
});
