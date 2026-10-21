// PHASE B (2026-10-21, docs/plans/2026-10-21-expo-apps.md): an app's files are
// typechecked and exported by the app builder, kept, and served to the phones.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readExpoRequest, tscErrors, THEME_KEYS } from "../app-builder/expo-preview.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default;

const BASE = "/app-preview/shop-1/0123456789abcdef0123456789abcdef";
const TABS = { path: "app/(tabs)/_layout.tsx", source: "x" };
const THEME = { paper: "#ffffff", card: "#ffffff", ink: "#000000", soft: "#555555", line: "#dddddd", primary: "#8a4b1e", onPrimary: "#ffffff", accent: "#eeeeee", good: "#2e8b3d", radius: 14 };

test("a preview request is read strictly: the app's own files only, never the kit, with its tabs and a whole theme", () => {
  const ok = readExpoRequest({ baseUrl: BASE, files: [TABS, { path: "app/(tabs)/index.tsx", source: "y" }, { path: "lib/data.ts", source: "z" }, { path: "components/loaf-card.tsx", source: "w" }], theme: THEME });
  assert.equal(ok.error, undefined); assert.equal(ok.files.length, 4); assert.deepEqual(ok.theme, THEME);
  for (const [bad, why] of [
    [{ baseUrl: "/elsewhere", files: [TABS] }, /baseUrl/],
    [{ baseUrl: BASE, files: [] }, /list/],
    [{ baseUrl: BASE, files: [{ path: "app/index.tsx", source: "x" }] }, /tabs/],
    [{ baseUrl: BASE, files: [TABS, { path: "components/app/button.tsx", source: "x" }] }, /not a file/],
    [{ baseUrl: BASE, files: [TABS, { path: "../server.mjs", source: "x" }] }, /not a file/],
    [{ baseUrl: BASE, files: [TABS, { path: "package.json", source: "{}" }] }, /not a file/],
    [{ baseUrl: BASE, files: [TABS, { path: "app/a.js", source: "x" }] }, /not a file/],
    [{ baseUrl: BASE, files: [TABS, TABS] }, /twice/],
    [{ baseUrl: BASE, files: [{ path: "app/(tabs)/_layout.tsx", source: ["x"] }] }, /path and a source/],
    [{ baseUrl: BASE, files: [TABS], theme: { ...THEME, ink: "black" } }, /theme\.ink/],
    [{ baseUrl: BASE, files: [TABS], theme: { ...THEME, radius: "14" } }, /radius/],
    [{ baseUrl: BASE, files: [TABS], theme: (({ good, ...t }) => t)(THEME) }, /theme needs good/],
  ]) assert.match(readExpoRequest(bad).error || "", why, JSON.stringify(bad).slice(0, 120));
  assert.deepEqual(THEME_KEYS, Object.keys(THEME).filter((k) => k !== "radius"));
});

test("typecheck errors reach the writer as the compiler's own lines", () => {
  const out = "app/(tabs)/index.tsx(3,9): error TS2304: Cannot find name 'Nope'.\n  noise\nlib/x.ts(1,1): error TS1005: ';' expected.\n";
  assert.deepEqual(tscErrors(out), ["app/(tabs)/index.tsx(3,9): error TS2304: Cannot find name 'Nope'.", "lib/x.ts(1,1): error TS1005: ';' expected."]);
});

test("IMAGE: the app builder carries the kit, installed from its lockfile, warmed once, without the host's node_modules", () => {
  const d = readFileSync(new URL("../app-builder/Dockerfile", import.meta.url), "utf8");
  assert.match(d, /COPY package\.json server\.mjs app-config\.mjs expo-preview\.mjs \.\//);
  assert.match(d, /COPY expo\/ \.\/expo\/\nRUN cd expo && npm ci /);
  assert.match(readFileSync(new URL("../app-builder/.dockerignore", import.meta.url), "utf8"), /^expo\/node_modules$/m);
  assert.match(readFileSync(new URL("../app-builder/server.mjs", import.meta.url), "utf8"), /req\.url === "\/expo"/);
  assert.match(readFileSync(new URL("../app-builder/expo/app.config.js", import.meta.url), "utf8"), /baseUrl: process\.env\.EXPO_BASE_URL \|\| ""/);
});

function bucket(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? new TextEncoder().encode(v) : v]));
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { body: new Blob([v]).stream(), text: async () => new TextDecoder().decode(v) } : null; },
    async put(k, body) { m.set(k, typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body instanceof ArrayBuffer ? body : body.buffer ? body : await new Response(body).arrayBuffer())); return { etag: "e" }; },
    async delete(k) { m.delete(k); },
  };
}
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const signIn = (uid, owner) => { globalThis.fetch = async (u, o) => { u = String(u); if (u.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: uid }), { status: 200 }); if (u.includes("/rest/v1/site_backends")) return new Response(JSON.stringify(owner ? [{ uid: owner }] : []), { status: 200 }); return realFetch(u, o); }; };
function containerNs(answer) {
  const seen = [];
  return { seen, idFromName: (n) => n, get: (id) => ({ fetch: async (req) => { seen.push({ id, url: req.url, body: JSON.parse(await req.text()) }); return answer(); } }) };
}
const ctx = { waitUntil() {}, passThroughOnException() {} };
const call = (env, method, slug, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/app/preview", {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
}), env, ctx);
const b64 = (s) => Buffer.from(s).toString("base64");

test("ROUTE: signed out 401, someone else's app 404, and nothing is checked", async () => {
  const ns = containerNs(() => new Response("x"));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  assert.equal((await call(env, "POST", "shop-2", { files: [TABS] }, "")).status, 401);
  signIn("u2", "u1");
  assert.equal((await call(env, "POST", "shop-2", { files: [TABS] })).status, 404);
  assert.equal(ns.seen.length, 0);
});

test("ROUTE: the owner's app is checked, kept under a fresh token, named current, and served to the phones", async () => {
  const ns = containerNs(() => Response.json({ ok: true, ms: 9, files: [{ path: "index.html", data: b64("<div id=root></div>") }, { path: "_expo/static/js/web/entry-ab.js", data: b64("js") }] }));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  signIn("u1", "u1");
  const r = await call(env, "POST", "shop-3", { files: [TABS], theme: THEME });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.equal(ns.seen[0].url, "http://app/expo");
  assert.match(ns.seen[0].body.baseUrl, /^\/app-preview\/shop-3\/[a-f0-9]{32}$/);
  assert.deepEqual(ns.seen[0].body.files, [TABS]); assert.deepEqual(ns.seen[0].body.theme, THEME);
  assert.equal(d.preview, ns.seen[0].body.baseUrl + "/");
  const g = await (await call(env, "GET", "shop-3")).json();
  assert.equal(g.preview, d.preview, "the current preview is named for the next visit");
  assert.equal(new TextDecoder().decode(env.SITES_BUCKET.m.get("apps/shop-3/source/app/(tabs)/_layout.tsx")), "x", "its source is kept, so Download builds this same app");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(env.SITES_BUCKET.m.get("apps/shop-3/source.json"))).files, ["app/(tabs)/_layout.tsx"]);
  const serve = (p) => worker.fetch(new Request("https://gofarther.dev" + d.preview + p), env, ctx);
  const home = await serve("");
  assert.equal(home.status, 200); assert.match(home.headers.get("content-type"), /text\/html/); assert.equal(await home.text(), "<div id=root></div>");
  assert.equal(await (await serve("order")).text(), "<div id=root></div>", "a screen's address is the app's own page");
  const js = await serve("_expo/static/js/web/entry-ab.js");
  assert.equal(js.headers.get("content-type"), "text/javascript"); assert.match(js.headers.get("cache-control"), /immutable/);
  assert.equal((await serve("_expo/static/js/web/missing.js")).status, 404, "a missing script is not the page");
  assert.equal((await worker.fetch(new Request("https://gofarther.dev/app-preview/shop-3/" + "f".repeat(32) + "/"), env, ctx)).status, 404, "another token sees nothing");
});

test("ROUTE: a failed check answers 422 with the compiler's lines, and nothing is kept", async () => {
  const ns = containerNs(() => Response.json({ ok: false, stage: "typecheck", errors: ["app/(tabs)/_layout.tsx(1,38): error TS2304: Cannot find name 'Nope'."] }));
  const env = { SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns };
  signIn("u1", "u1");
  const r = await call(env, "POST", "shop-4", { files: [TABS] });
  const d = await r.json();
  assert.equal(r.status, 422); assert.equal(d.stage, "typecheck"); assert.match(d.errors[0], /TS2304/);
  const kept = [...env.SITES_BUCKET.m.keys()];
  assert.ok(kept.length === 2 && kept.every((k) => /^apps\/shop-4\/failed\/\d+\//.test(k)), "only the failed attempt is kept, under failed/: " + kept.join(","));
  assert.ok(kept.some((k) => k.endsWith("/errors.json")) && kept.some((k) => k.endsWith("/app/(tabs)/_layout.tsx")));
  assert.ok(!env.SITES_BUCKET.m.has("apps/shop-4/preview.json"), "a failure names no current preview");
});

test("the request reader runs where the Worker runs: no Buffer, no Node-only global", () => {
  const src = readFileSync(new URL("../app-builder/expo-preview.mjs", import.meta.url), "utf8");
  const reader = src.slice(src.indexOf("export function readExpoRequest"), src.indexOf("export function tscErrors"));
  assert.ok(reader.length > 500, "the observer found the reader");
  assert.doesNotMatch(reader, /\bBuffer\b|\bprocess\./);
  const saved = globalThis.Buffer;
  try { globalThis.Buffer = undefined; assert.equal(readExpoRequest({ baseUrl: BASE, files: [TABS] }).error, undefined); }
  finally { globalThis.Buffer = saved; }
});

test("the bundler's own complaint is kept, not its first line", async () => {
  const { bundlerErrors } = await import("../app-builder/expo-preview.mjs");
  const out = "Using (experimental) base path: /app-preview/x/0\nStarting Metro Bundler\n\x1b[31mError: Unable to resolve module ./nope from app/(tabs)/index.tsx\x1b[0m\n  12 | import X from './nope';";
  assert.deepEqual(bundlerErrors(out), ["Error: Unable to resolve module ./nope from app/(tabs)/index.tsx"]);
  assert.deepEqual(bundlerErrors("a\nb"), ["a", "b"], "with nothing named, the tail");
  assert.deepEqual(bundlerErrors(""), ["the app could not be bundled"]);
});

test("SELF-TEST: the image carries the test app and the builder runs it through both jobs; the owner's door reaches it", () => {
  const d = readFileSync(new URL("../app-builder/Dockerfile", import.meta.url), "utf8");
  assert.match(d, /COPY selftest\/ \.\/selftest\//);
  const srv = readFileSync(new URL("../app-builder/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /req\.url === "\/selftest"[\s\S]*buildExpoAndroid\(/);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /\\\/app\\\/\(builder\|selftest\)\$\//);
  for (const f of ["app/(tabs)/_layout.tsx", "app/(tabs)/index.tsx", "lib/data.ts"]) {
    assert.equal(readFileSync(new URL("../app-builder/selftest/" + f, import.meta.url), "utf8"), readFileSync(new URL("./fixtures/expo-harbour/" + f, import.meta.url), "utf8"), f + " is the fixture's own");
  }
});

test("LONG JOBS: the builder answers 202 with a job and keeps the result; the Worker starts, asks after, and fetches the app", () => {
  const srv = readFileSync(new URL("../app-builder/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /req\.url === "\/expo-android"[\s\S]*?json\(res, 202, \{ job: startJob\(/);
  assert.match(srv, /req\.url === "\/selftest"[\s\S]*?json\(res, 202, \{ job: startJob\(/);
  assert.match(srv, /\/\^\\\/jobs\\\/\(\[a-f0-9\]\{16\}\)\(\\\/apk\)\?\$\//);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /async function appBuilderJob\(env, slug, path, payload/);
  assert.match(w, /if \(expo\) \{\n\s+const out = await appBuilderJob\(env, aslug, "\/expo-android", req\);/);
  assert.match(w, /new Request\("http:\/\/app\/selftest", \{ method: "POST"/);
  assert.match(w, /new Request\("http:\/\/app\/jobs\/" \+ job,/);
});
