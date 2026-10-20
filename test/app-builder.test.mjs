// The Android app builder (2026-10-20, owner: "yea separate container for the
// app"): its own container class and image, the request it reads, the names it
// writes into the Android project, and the Worker's owner-only route, driven
// end to end with a stand-in container.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBuild, capacitorConfig, nativeNames, appIdFor } from "../app-builder/app-config.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, api = W.chatStoreApi;

test("a build request is read strictly: live by default, https only, a real app id", () => {
  const ok = readBuild({ appId: "dev.gofarther.foldlanebakery", name: " Fold Lane ", url: "https://fold-lane-bakery.gofarther.app/" });
  assert.deepEqual(ok, { mode: "live", appId: "dev.gofarther.foldlanebakery", name: "Fold Lane", url: "https://fold-lane-bakery.gofarther.app/", files: [] });
  for (const [bad, why] of [
    [{ appId: "dev.gofarther.x", name: "x", url: "http://x.dev/" }, /https/],
    [{ appId: "Dev.x", name: "x", url: "https://x.dev/" }, /app id/],
    [{ appId: "dev.gofarther.x", name: "", url: "https://x.dev/" }, /name/],
    [{ appId: "dev.gofarther.x", name: "x", url: "https://x.dev/", mode: "other" }, /mode/],
    [{ appId: "dev.gofarther.x", name: "x", url: "https://x.dev/", mode: "bundled", files: [{ path: "a.js", data: "" }] }, /index\.html/],
    [{ appId: "dev.gofarther.x", name: "x", url: "https://x.dev/", mode: "bundled", files: [{ path: "../etc/passwd", data: "" }] }, /bad file/],
    [{ appId: "dev.gofarther.x", name: "x", url: "https://x.dev/", mode: "bundled", files: [{ path: "/abs", data: "" }] }, /bad file/],
  ]) assert.match(readBuild(bad).error || "", why, JSON.stringify(bad));
});

test("a live app opens the site's address; a bundled one carries its files", () => {
  const live = capacitorConfig(readBuild({ appId: "dev.gofarther.a", name: "A", url: "https://a.gofarther.app/" }));
  assert.deepEqual(live.server, { url: "https://a.gofarther.app/", cleartext: false });
  const b = capacitorConfig(readBuild({ mode: "bundled", appId: "dev.gofarther.a", name: "A", url: "https://a.gofarther.app/", files: [{ path: "index.html", data: "" }] }));
  assert.equal(b.server, undefined); assert.equal(b.webDir, "www");
});

test("the app installs under its own name and id, not the template's (found by the first live build)", () => {
  const gradle = 'android {\n    namespace = "dev.gofarther.app"\n    defaultConfig {\n        applicationId "dev.gofarther.app"\n';
  const strings = '<resources>\n<string name="app_name">Go Farther app</string>\n<string name="title_activity_main">Go Farther app</string>\n<string name="package_name">dev.gofarther.app</string>\n<string name="custom_url_scheme">dev.gofarther.app</string>\n</resources>';
  const n = nativeNames(gradle, strings, { appId: "dev.gofarther.foldlanebakery", name: "Fold & Lane's" });
  assert.match(n.gradle, /applicationId "dev\.gofarther\.foldlanebakery"/);
  assert.match(n.gradle, /namespace = "dev\.gofarther\.app"/, "the code's own package stays");
  assert.match(n.strings, /<string name="app_name">Fold &amp; Lane\\'s<\/string>/);
  assert.match(n.strings, /<string name="package_name">dev\.gofarther\.foldlanebakery<\/string>/);
  assert.equal(appIdFor("fold-lane-bakery"), "dev.gofarther.foldlanebakery");
  assert.equal(appIdFor("9lives"), "dev.gofarther.s9lives");
  assert.equal(api.appIdFor("fold-lane-bakery"), appIdFor("fold-lane-bakery"), "the Worker and the builder name an app the same way");
});

test("CONFIG: its own container class, image, binding and migration; the website container untouched", () => {
  const w = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(w, /"class_name": "AppBuildContainer",\s*"image": "\.\/app-builder\/Dockerfile",/);
  assert.match(w, /\{ "class_name": "AppBuildContainer", "name": "APP_BUILD_CONTAINER" \}/);
  assert.match(w, /\{ "tag": "v8", "new_sqlite_classes": \["AppBuildContainer"\] \}/);
  assert.match(w, /"class_name": "SiteBuildContainer",[\s\S]*?"image": "\.\/Dockerfile"/);
  assert.equal(typeof W.AppBuildContainer, "function");
  const d = readFileSync(new URL("../app-builder/Dockerfile", import.meta.url), "utf8");
  assert.match(d, /sdkmanager "platform-tools" "platforms;android-36" "build-tools;36\.0\.0"/);
  assert.match(d, /\.\/gradlew assembleDebug --no-daemon -q/, "the image warms Gradle's libraries so builds run offline");
  assert.match(readFileSync(new URL("../app-builder/server.mjs", import.meta.url), "utf8"), /"assembleDebug", "--offline"/);
  assert.doesNotMatch(readFileSync(new URL("../Dockerfile", import.meta.url), "utf8"), /android|gradle|capacitor/i, "the website image carries none of it");
});

function bucket(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? new TextEncoder().encode(v) : v]));
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { body: new Blob([v]).stream(), arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength), text: async () => new TextDecoder().decode(v), etag: "e" } : null; },
    async put(k, body) { m.set(k, new Uint8Array(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer())); return { etag: "e" }; },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
    async delete(k) { m.delete(k); },
  };
}

test("BUNDLED: the live version's assets, every page and the uploads, at the paths the site serves them", async () => {
  const env = { SITES_BUCKET: bucket({
    "current/shop-1.json": JSON.stringify({ v: 1, version: "01790468089054-8btpep" }),
    "builds/shop-1/01790468089054-8btpep/client/assets/index.js": "js", "builds/shop-1/01790468089054-8btpep/client/assets/index.css": "css",
    "sites/shop-1/index.html": "<h1>home</h1>", "sites/shop-1/visit.html": "<h1>visit</h1>", "sites/shop-1/site.live": "1",
    "uploads/shop-1/a.jpg": "jpg", "builds/other/v1/client/x.js": "no",
  }) };
  const got = await api.siteAppFiles(env, "shop-1");
  assert.deepEqual(got.files.map((f) => f.path).sort(), ["assets/index.css", "assets/index.js", "index.html", "u/shop-1/a.jpg", "visit.html"]);
  assert.equal(Buffer.from(got.files.find((f) => f.path === "index.html").data, "base64").toString(), "<h1>home</h1>");
  assert.match((await api.siteAppFiles({ SITES_BUCKET: bucket({}) }, "none")).error, /no published home page/);
});

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const signIn = (uid, owner) => { globalThis.fetch = async (u, o) => { u = String(u); if (u.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: uid }), { status: 200 }); if (u.includes("/rest/v1/site_backends")) return new Response(JSON.stringify(owner ? [{ uid: owner }] : []), { status: 200 }); return realFetch(u, o); }; };
function containerNs(answer) {
  const seen = [];
  return { seen, idFromName: (n) => n, get: (id) => ({ fetch: async (req) => { seen.push({ id, url: req.url, body: JSON.parse(await req.text()) }); return answer(); } }) };
}
const call = (env, method, slug, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/app/android", {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });

test("ROUTE: signed out 401, someone else's site 404, and nothing is built", async () => {
  const ns = containerNs(() => new Response("x"));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  assert.equal((await call(env, "POST", "shop-2", {}, "")).status, 401);
  signIn("u2", "u1");
  assert.equal((await call(env, "POST", "shop-2", {})).status, 404);
  assert.equal(ns.seen.length, 0);
});

test("ROUTE: the owner's build goes to the app builder, is kept, and downloads", async () => {
  const apk = new Uint8Array([80, 75, 3, 4, 9, 9]);
  const ns = containerNs(() => new Response(apk, { headers: { "content-type": "application/vnd.android.package-archive" } }));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  signIn("u1", "u1");
  const r = await call(env, "POST", "shop-3", { name: "Shop Three" });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.equal(d.mode, "live"); assert.equal(d.bytes, 6);
  assert.equal(ns.seen[0].id, "build-k-app-shop-3", "one lane per site, named like every other container call");
  assert.equal(ns.seen[0].url, "http://app/build");
  assert.deepEqual(ns.seen[0].body, { mode: "live", appId: "dev.gofarther.shop3", name: "Shop Three", url: "https://shop-3.gofarther.app/" });
  const g = await call(env, "GET", "shop-3");
  assert.equal(g.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.match(g.headers.get("content-disposition"), /shop-3\.apk/);
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), apk);
});

test("ROUTE: the builder's refusal is said, and nothing is kept", async () => {
  const ns = containerNs(() => new Response(JSON.stringify({ error: "the app could not be built" }), { status: 500, headers: { "content-type": "application/json" } }));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  signIn("u1", "u1");
  const r = await call(env, "POST", "shop-4", {});
  assert.equal(r.status, 502); assert.match((await r.json()).error, /could not be built/);
  assert.equal(env.SITES_BUCKET.m.size, 0);
  assert.equal((await call(env, "GET", "shop-4")).status, 404);
});

// ── WAITING ITS TURN, THE ROUTER'S "app", THE PICKER (2026-10-20, owner: "3 and it has to be through model calls") ──
import { readRouting, ASK_TOOL, LIVE_ASK_TOOL } from "../builder/site-ask.mjs";

test("QUEUE: a busy builder is asked again until it is free; one never free is said, and nothing is kept", async () => {
  api.setAppWait(1, 200);
  try {
    let n = 0;
    const apk = new Uint8Array([80, 75, 3, 4]);
    const ns = containerNs(() => (++n < 3 ? new Response("busy", { status: 503 }) : new Response(apk, { headers: { "content-type": "application/vnd.android.package-archive" } })));
    const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
    signIn("u1", "u1");
    const r = await call(env, "POST", "shop-5", {});
    assert.equal(r.status, 200); assert.equal(n, 3, "it waited its turn");
    const never = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: containerNs(() => new Response("busy", { status: 503 })) };
    const r2 = await call(never, "POST", "shop-6", {});
    assert.equal(r2.status, 503); assert.match((await r2.json()).error, /Every app builder is busy/);
    assert.equal(never.SITES_BUCKET.m.size, 0);
  } finally { api.setAppWait(10_000, 5 * 60 * 1000); }
});

test("ROUTER: \"app\" is one of its answers, with the phone named; with no site it stays a build", () => {
  assert.ok(LIVE_ASK_TOOL.input_schema.properties.intent.enum.includes("app"));
  assert.deepEqual(LIVE_ASK_TOOL.input_schema.properties.platform.enum, ["android", "ios"]);
  assert.ok(!ASK_TOOL.input_schema.properties.intent.enum.includes("app") && !ASK_TOOL.input_schema.properties.platform, "a first build's tool is unchanged: there is no site to make an app of");
  assert.match(LIVE_ASK_TOOL.input_schema.properties.intent.description, /"app" — they want the site that ALREADY EXISTS made into a phone app/);
  const said = (input, o) => readRouting({ content: [{ type: "tool_use", input }] }, o);
  assert.deepEqual(said({ intent: "app", platform: "ios" }, { hasSite: true, live: true }), { intent: "app", platform: "ios", answer: "" });
  assert.equal(said({ intent: "app" }, { hasSite: true }).platform, "android", "Android when no phone was named");
  assert.equal(said({ intent: "app", platform: "windows" }, { hasSite: true }).platform, "android", "a phone off the list is never passed on");
  assert.equal(said({ intent: "app", platform: "android" }, { hasSite: false }).intent, "build", "with no site, there is a website to build first");
});

test("WIRING: the route tells the page which phone; the page makes the app, and the picker is drawn and kept", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /platform: routed\.intent === "app" \? routed\.platform : undefined,/);
  assert.match(src, /sleepAfter = "1m";/);
  const page = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(page, /if \(d\.intent === 'app'\) return slug && \(d\.platform === 'android' \|\| d\.platform === 'ios'\);/);
  assert.match(page, /if \(d\.intent === 'app' && site\.slug\) return siteMakeApp\(site, d\.platform, finish\);/);
  assert.match(page, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/app\/android', \{ method: 'POST'/);
  assert.match(page, /Apple apps are on the way, but not ready yet/);
  assert.match(page, /buildKindHTML\('down'\) \+ buildPickerHTML\('down'\) \+ buildEffortHTML\('down'\)/);
  assert.match(page, /wireBuildKind\(\);\s*wireBuildPicker\(\);/);
  assert.match(page, /kind: 'zephyr_build_kind_v1',/);
  assert.match(src, /"mediaUploads", "kind"\]/, "the choice is kept on the account");
});
