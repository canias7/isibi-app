// THE APP LOADS FASTER, AND A DEPLOY STILL REACHES EVERY RETURNING VISITOR
// (2026-11-02, owner: "do it, but do it carefully").
//
// Three changes, each guarded here:
//  1. caching: the shell names its scripts and stylesheets `?v=<deploy id>`,
//     and only a request carrying the CURRENT id is cached for a year
//     (app-asset-cache.mjs). Driven through the real Worker's fetch.
//  2. scripts: every app script is `defer`, in the order it always ran.
//  3. fonts: the Google Fonts link asks only for families the app uses.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { assetVersion, versionHtml, IMMUTABLE } from "../app-asset-cache.mjs";
import { assetsStub } from "./fixtures/app-assets-stub.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const INDEX = readFileSync(path.join(PUBLIC, "index.html"), "utf8");
const SHA_A = "aaaaaaaaaaaa1111111111111111111111111111";
const SHA_B = "bbbbbbbbbbbb2222222222222222222222222222";
const worker = (await loadWorkerModule()).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (env, p, headers = {}) => worker.fetch(new Request("https://gofarther.dev" + p, { headers }), env, ctx);
const envFor = (id, ASSETS = assetsStub(PUBLIC)) => ({ ASSETS, ...(id === undefined ? {} : { DEPLOY_ID: id }) });

// Every local script src and stylesheet href in a page, in document order.
const localRefs = (html) => [...html.matchAll(/<(?:script\b[^>]*?\ssrc|link\b[^>]*?\shref)="(\/(?!\/)[^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map((m) => m[1]);
const ORDER = ["/auth.js", "/edit-poll.js", "/key-card.js", "/chat-talk.js", "/site-media.js", "/site-list.js", "/site-zip.js", "/vendor/qrcode.js", "/coder.js", "/chat.js", "/gf-landing.js"];

// ── 1. CACHING ──────────────────────────────────────────────────────────────

test("the shell names every script and stylesheet with this deploy's id, and a new deploy names new URLs", async () => {
  const plain = localRefs(INDEX);
  assert.ok(plain.length >= 12, "the observer found too few local refs: " + plain.length);
  const a = await get(envFor(SHA_A), "/");
  assert.equal(a.status, 200);
  assert.match(a.headers.get("cache-control"), /max-age=0, must-revalidate/, "the HTML itself must stay revalidated");
  const refsA = localRefs(await a.text());
  assert.deepEqual(refsA, plain.map((r) => r + "?v=aaaaaaaaaaaa"));
  const b = await get(envFor(SHA_B), "/");
  const refsB = localRefs(await b.text());
  assert.deepEqual(refsB, plain.map((r) => r + "?v=bbbbbbbbbbbb"));
  for (let i = 0; i < refsA.length; i++) assert.notEqual(refsA[i], refsB[i], "a deploy left a URL unchanged: " + refsA[i]);
  // A project address serves the same shell, versioned the same way.
  const proj = await get(envFor(SHA_A), "/projects/abc123");
  assert.deepEqual(localRefs(await proj.text()), refsA);
});

test("a deploy that leaves index.html's bytes alone still never 304s the old shell", async () => {
  const a = await get(envFor(SHA_A), "/");
  const etagA = a.headers.get("etag");
  assert.ok(etagA, "the shell has no ETag");
  // Same deploy: the browser's copy is still good.
  const same = await get(envFor(SHA_A), "/", { "if-none-match": etagA });
  assert.equal(same.status, 304);
  // New deploy, same index.html bytes: the old ETag must not match.
  const next = await get(envFor(SHA_B), "/", { "if-none-match": etagA });
  assert.equal(next.status, 200, "a new deploy answered 304 to the old shell — returning visitors would keep the old ?v");
  assert.match(await next.text(), /\/chat\.js\?v=bbbbbbbbbbbb"/);
});

test("only the current deploy's versioned URL is cached for a year", async () => {
  const env = envFor(SHA_A);
  const cur = await get(env, "/chat.js?v=aaaaaaaaaaaa");
  assert.equal(cur.status, 200);
  assert.equal(cur.headers.get("cache-control"), IMMUTABLE);
  const css = await get(env, "/styles.css?v=aaaaaaaaaaaa");
  assert.equal(css.headers.get("cache-control"), IMMUTABLE);
  // An old or foreign id (a rollout's other version) is answered as before.
  for (const p of ["/chat.js?v=bbbbbbbbbbbb", "/chat.js?v=", "/chat.js"]) {
    const r = await get(env, p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate", p + " lost today's revalidate behaviour");
  }
});

test("unversioned requests and a Worker without DEPLOY_ID behave exactly as before", async () => {
  for (const id of [undefined, "", "not-a-sha"]) {
    const env = envFor(id);
    const html = await (await get(env, "/")).text();
    assert.equal(html, INDEX, "with no usable deploy id the shell must be served untouched");
    for (const q of ["/chat.js?v=aaaaaaaaaaaa", "/chat.js?v="]) {
      const js = await get(env, q);
      assert.equal(js.headers.get("cache-control"), "public, max-age=0, must-revalidate", q);
    }
  }
  // A 304 for an unversioned file passes through untouched.
  const env = envFor(SHA_A);
  const first = await get(env, "/auth.js");
  const again = await get(env, "/auth.js", { "if-none-match": first.headers.get("etag") });
  assert.equal(again.status, 304);
  // A missing file is still a 404, never cached.
  const miss = await get(env, "/nope.js?v=aaaaaaaaaaaa");
  assert.equal(miss.status, 404);
  assert.notEqual(miss.headers.get("cache-control"), IMMUTABLE);
});

test("the vendored demos and other pages' URLs are not rewritten", async () => {
  const env = envFor(SHA_A, assetsStub(PUBLIC, { files: { "/mkt/demo9/index.html": '<script src="/mkt/demo9/a.js"></script>' } }));
  assert.equal(await (await get(env, "/mkt/demo9/")).text(), '<script src="/mkt/demo9/a.js"></script>');
  assert.equal(versionHtml('<script src="https://x.test/a.js"></script><script src="//x.test/a.js"></script><script src="/a.js?x=1"></script>', "abc1234"),
    '<script src="https://x.test/a.js"></script><script src="//x.test/a.js"></script><script src="/a.js?x=1"></script>');
  assert.equal(assetVersion({ DEPLOY_ID: SHA_A }), "aaaaaaaaaaaa");
});

// ── 2. SCRIPTS ──────────────────────────────────────────────────────────────

test("every app script is deferred, in the order the app has always loaded them", () => {
  const tags = [...INDEX.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(tags.length >= ORDER.length, "the observer found too few script tags");
  const srcs = tags.map((t) => (t.match(/\ssrc="([^"]+)"/) || [])[1]);
  assert.deepEqual(srcs, ORDER, "a script was added, dropped or reordered");
  for (const t of tags) {
    assert.match(t, /\sdefer(?=[\s>])/, "not deferred: " + t);
    assert.ok(!/\sasync\b/.test(t), "async breaks the order: " + t);
  }
  // The CSP forbids inline scripts; an inline one would also run before the
  // deferred ones and find nothing defined.
  assert.ok(!/<script\b(?![^>]*\ssrc=)[^>]*>/.test(INDEX), "an inline script in index.html");
  assert.ok(!/\son[a-z]+="/i.test(INDEX), "an inline event handler in index.html");
});

test("no app script depends on running while the page is still being parsed", () => {
  for (const f of ORDER) {
    const src = readFileSync(path.join(PUBLIC, f), "utf8");
    assert.ok(src.length > 200, f + " read empty");
    assert.ok(!/document\.write\s*\(/.test(src), f + " uses document.write, which a deferred script cannot");
    assert.ok(!/document\.currentScript/.test(src), f + " reads currentScript");
    assert.ok(!/readyState\s*===?\s*["']loading["']/.test(src), f + " tests for the loading state");
  }
});

// ── 3. FONTS ────────────────────────────────────────────────────────────────

test("the font link asks for the families the app uses and no other, with swap and preconnect", () => {
  const link = (INDEX.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/) || [])[0];
  assert.ok(link, "no Google Fonts link");
  const fams = [...link.matchAll(/family=([^:&]+)/g)].map((m) => m[1].replace(/\+/g, " "));
  assert.deepEqual(fams, ["Geist", "Geist Mono", "Inter", "Caveat", "Patrick Hand"]);
  assert.match(link, /display=swap/);
  assert.match(INDEX, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  // Each asked-for family is named in a font-family somewhere the app renders.
  const css = ["styles.css", "gf-landing.css", "index.html"].map((f) => readFileSync(path.join(PUBLIC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
  for (const f of fams) assert.ok(new RegExp(`(font-family|--(?:display|mono))\\s*:[^;}]*['"]?${f}['"]?\\s*[,;}]`).test(css), f + " is asked for but never used");
  assert.ok(!/Space Grotesk/.test(css), "Space Grotesk is used again — put it back in the link");
});
