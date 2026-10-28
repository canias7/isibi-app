// The independent review of the three Workers (2026-10-28): each finding, held.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTemplate } from "./fixtures/template-ts.mjs";
import { bindableSecret } from "../builder/site-dispatch.mjs";

const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const T = (p) => fs.readFileSync(new URL("../builder/lovable/template/src/" + p, import.meta.url), "utf8");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

test("1+6: a preview gets no owner keys and no database login; old keys are forgotten only after a LIVE upload, only those really bound", () => {
  const up = between(W, "async function uploadScriptOnce(", "\n}\n");
  assert.match(up, /if \(preview\) return \{ bucket, vars, secrets: null \};/);
  assert.match(up, /legacyKeys = \(given && given\.legacy \? given\.legacy : \[\]\)\.filter\(\(n\) => secrets && bindableSecret\(n, secrets\[n\]\)\);/);
  assert.match(up, /if \(r\.ok && !preview && legacyKeys\.length\) await forgetLegacyKeys\(env, slug, legacyKeys\);/);
  assert.equal(bindableSecret("RESEND_KEY", "re_1"), true);
  assert.equal(bindableSecret("RESEND_KEY", "a\nb"), false, "a key the upload drops would be forgotten");
  assert.equal(bindableSecret("lower", "x"), false);
  assert.equal(bindableSecret("RESEND_KEY", "x".repeat(4097)), false);
  const push = between(W, "async function pushSiteSecret(", "\n}\n");
  assert.doesNotMatch(push, /previewScriptName/, "an owner key is still pushed to the draft's preview");
});

test("2: a site on the shared bucket never queues, drains or sweeps webhooks there", async () => {
  const { queueFailed, drainOwnQueue, siteTick } = await loadTemplate("lib/site-webhook-retry.ts");
  const touched = [];
  const B = { get: async (k) => { touched.push(k); return null; }, put: async (k) => { touched.push(k); }, delete: async (k) => { touched.push(k); }, list: async (o) => { touched.push(o.prefix); return { objects: [], truncated: false }; } };
  const env = { SITES: B, WEBHOOK_URL: "https://h.example/x" };
  assert.equal(await queueFailed(env, { slug: "x", table: "t", action: "created", out: { sent: false, status: 503, body: "{}", eventId: "e1" } }), null);
  await drainOwnQueue(env, "x");
  const u = new URL("https://x.gofarther.app/__gf/tick");
  await siteTick(new Request(u, { method: "POST", headers: { "x-gf-site-job": "1" } }), env, u, "x", "x-gf-site-job");
  assert.deepEqual(touched, [], "the shared bucket was touched: " + touched.join(", "));
});

test("3: the clock wakes every site in turn, whatever the count", async () => {
  const src = between(W, "export function siteTickSlice(", "\n}\n") + "\n}";
  const siteTickSlice = new Function("return " + src.replace("export ", ""))();
  for (const n of [1, 39, 40, 41, 80, 160, 1234]) {
    const slugs = Array.from({ length: n }, (_, i) => "s" + i);
    const seen = new Set();
    for (let t = 0; t < Math.ceil(n / 40) * 2 + 2; t++) for (const s of siteTickSlice(slugs, t, 40)) seen.add(s);
    assert.equal(seen.size, n, "some sites are never woken at n=" + n);
  }
  const run = between(W, "async function runSiteTicks(", "\n}\n");
  assert.match(run, /slug=gt\./, "the site list stops at a thousand");
});

test("4: a data path with . or .. segments is refused by the site", () => {
  const S = T("server.ts");
  const n = (S.match(/path\.split\("\/"\)\.some\(\(seg\) => seg === "\." \|\| seg === "\.\."\)\) return null;/g) || []).length;
  assert.equal(n, 2, "the write and the read paths must both refuse it");
});

test("5: on the app's own address, a site's visitor calls are refused when the site has its own address", () => {
  const at = W.indexOf("const vm = url.pathname.match(/^\\/api\\/db\\/");
  assert.ok(at > 0);
  assert.match(W.slice(at, at + 1200), /if \(isAppHostname\(url\.hostname\) && siteHostFor\(vslug\)\) \{\s*return Response\.json\(\{ error: "this site answers at its own address"/);
});

test("7: the address lookup is rate-limited for outside callers, never for the front door", () => {
  const at = W.indexOf('url.pathname === "/__gf/route"');
  const blk = W.slice(at, at + 1400);
  assert.match(blk, /const rip = request\.headers\.get\("CF-Connecting-IP"\);\s*if \(rip\) \{/);
});

test("8: a visitor upload is capped while it is read, with or without a length", async () => {
  const { visitorUpload } = await loadTemplate("lib/site-files.ts");
  const big = new Uint8Array(3 * 1024 * 1024);
  const stream = new ReadableStream({ start(c) { c.enqueue(big.subarray(0, 1024 * 1024)); c.enqueue(big.subarray(0, 1024 * 1024)); c.enqueue(big.subarray(0, 1024 * 1024)); c.close(); } });
  const u = new URL("https://x.gofarther.app/api/db/x/uploads?table=t");
  const req = new Request(u, { method: "POST", body: stream, duplex: "half" });
  const env = { OWN_BUCKET: "1", SITE_TABLES: "[]", SITES: { put: async () => assert.fail("stored"), list: async () => ({ objects: [], truncated: false }) } };
  const r = await visitorUpload(req, env, u, "x");
  assert.equal(r.status, 413);
});
