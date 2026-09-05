// The Worker's module as the container's runtime: the loader, the gateway, the
// environment shim — driven end to end against the real handler and a fake
// bucket, with no server and no Cloudflare.
//
// ── WHY (2026-09-04) ────────────────────────────────────────────────────────
//
// Owner: "that stuff gotta run on container". The queue consumer held a Worker
// invocation for every edit and addon — routing, lanes, the page call, the
// compile wait, the publish — under a fifteen-minute ceiling, 250 per queue,
// and evicted by every deploy. Now the SAME module runs inside the site's
// container under Node, its bindings shimmed onto a job-scoped gateway; the
// consumer fires the job and returns. These tests are the contract of that
// runtime: what the loader maps, what the token admits, what a job may touch,
// and that every R2 call the Worker makes comes back in the shape it expects.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { shimFor, extensionCandidates } from "../builder/worker-loader.mjs";
import { rewriteBuildUrl, localBuildOrigin } from "../builder/containers-shim.mjs";
import {
  gatewayKey, signJobToken, verifyJobToken, allowedJobKey, allowedJobPrefix, jobPrefixes,
  metaHeaders, readMetaHeaders, onlyIfHeaders, readOnlyIf, gatewayHandler, gatewayJobId,
} from "../builder/job-gateway.mjs";
import { GatewayBucket, GatewayObject, makeContainerEnv, makeContainerCtx, refusingQueue } from "../builder/container-env.mjs";

const ROOT = new URL("..", import.meta.url);

// ── the loader ──────────────────────────────────────────────────────────────

test("the loader maps exactly the three things the Worker module needs under Node", () => {
  assert.match(shimFor("cloudflare:workers"), /cloudflare-shim\.mjs$/);
  assert.match(shimFor("cloudflare:email"), /cloudflare-shim\.mjs$/);
  assert.match(shimFor("@cloudflare/containers"), /containers-shim\.mjs$/);
  assert.equal(shimFor("@cloudflare/containers/dist/lib/container"), null, "a deep import is not the package");
  assert.equal(shimFor("node:fs"), null);
  assert.equal(shimFor("./site-db.mjs"), null);
  assert.equal(shimFor(undefined), null);
  // The extension repair is for RELATIVE specifiers under a file: parent only.
  assert.deepEqual(extensionCandidates("./lib/container", "file:///x/pkg/index.js"),
    ["/x/pkg/lib/container.js", "/x/pkg/lib/container.mjs", "/x/pkg/lib/container/index.js"]);
  assert.deepEqual(extensionCandidates("some-package", "file:///x/pkg/index.js"), [], "a bare specifier is never repaired");
  assert.deepEqual(extensionCandidates("./x", "data:text/javascript,"), [], "no repair under a non-file parent");
});

test("THE WORKER MODULE IMPORTS UNDER NODE with the loader — the property the runtime rests on", () => {
  // Measured 555 ms on the spike. A new workerd-only import in worker.js or any
  // module it reaches goes red HERE, before it can go red in a container.
  const r = spawnSync(process.execPath, [
    "--import", new URL("builder/worker-register.mjs", ROOT).pathname,
    "--input-type=module", "-e",
    "const w = await import(process.argv[1]); if (typeof w.default.fetch !== 'function' || typeof w.default.queue !== 'function') throw new Error('no fetch/queue'); console.log('ok');",
    new URL("worker.js", ROOT).pathname,
  ], { cwd: ROOT.pathname, encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 0, "worker.js does not import under Node:\n" + (r.stderr || "").slice(-1500));
  assert.match(r.stdout, /ok/);
});

test("the container namespace's fetch goes to the build service on localhost", () => {
  assert.equal(localBuildOrigin({}), "http://127.0.0.1:8080");
  assert.equal(localBuildOrigin({ JOB_BUILD_PORT: "9090" }), "http://127.0.0.1:9090");
  assert.equal(rewriteBuildUrl("http://build/build", "http://127.0.0.1:8080"), "http://127.0.0.1:8080/build");
  assert.equal(rewriteBuildUrl("http://build/model/result?id=x", "http://127.0.0.1:8080"), "http://127.0.0.1:8080/model/result?id=x");
  assert.equal(rewriteBuildUrl("http://build", "http://127.0.0.1:8080"), "http://127.0.0.1:8080/");
  assert.equal(rewriteBuildUrl("https://api.x.ai/v1", "http://127.0.0.1:8080"), "https://api.x.ai/v1", "only the build host is rewritten");
  assert.equal(rewriteBuildUrl("http://builder/x", "http://127.0.0.1:8080"), "http://builder/x", "a prefix is not the host");
});

// ── the token ───────────────────────────────────────────────────────────────

const JOB = { id: "j_abc12345", slug: "fretwork-1", uid: "22175f41-6fbf-49d7-b039-a65078a0141c", exp: 2_000_000_000 };

test("a token round-trips, and is refused when tampered, expired, mis-signed or malformed", async () => {
  const key = await gatewayKey("platform-secret");
  const t = await signJobToken(JOB, key);
  assert.match(t, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "the token is not base64url with no padding");
  assert.deepEqual(await verifyJobToken(t, key, 1_000_000_000_000), JOB);
  // expired, by the clock handed in
  assert.equal(await verifyJobToken(t, key, JOB.exp * 1000), null, "a token at its expiry is still accepted");
  // another key
  assert.equal(await verifyJobToken(t, await gatewayKey("another"), 1_000_000_000_000), null);
  // tampered payload: another job's id under the same signature
  const [v, p, s] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JOB, id: "j_other" })).toString("base64url");
  assert.equal(await verifyJobToken([v, forged, s].join("."), key, 1_000_000_000_000), null);
  assert.equal(await verifyJobToken([v, p, s.slice(0, -2) + "AA"].join("."), key, 1_000_000_000_000), null);
  for (const bad of ["", "v1", "v2." + p + "." + s, "v1.." + s, null, undefined, 42, {}]) {
    assert.equal(await verifyJobToken(bad, key, 1_000_000_000_000), null, "accepted " + JSON.stringify(bad));
  }
  // The signing key is derived, never the platform's own secret.
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode("platform-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  assert.equal(await verifyJobToken(t, raw, 1_000_000_000_000), null, "the token verifies under the raw platform secret");
  // Minting refuses a malformed job rather than signing nonsense.
  await assert.rejects(signJobToken({ ...JOB, slug: "Bad Slug" }, key));
  await assert.rejects(signJobToken({ ...JOB, uid: "" }, key));
  await assert.rejects(signJobToken({ ...JOB, exp: "soon" }, key));
  await assert.rejects(gatewayKey(""), "a gateway key from an empty secret");
});

// ── the scope ───────────────────────────────────────────────────────────────

test("a job may touch its own site's keys and its own job objects, and nothing else", () => {
  const { slug, id } = JOB;
  for (const k of [
    "sites/fretwork-1/", "sites/fretwork-1/index.html", "sites/fretwork-1/client/assets/x.js", "sites/fretwork-1/.meta.json",
    "source/fretwork-1/pages.json", "source/fretwork-1/parts.json", "versions/fretwork-1/mtn/manifest.json",
    "uploads/fretwork-1/logo.png", "backups/fretwork-1/2026-09-04.json", "config/fretwork-1.json",
    "jobs/edit/" + id, "jobs/" + id, "jobs/result/" + id + ".json",
  ]) assert.equal(allowedJobKey(slug, id, k), true, k + " should be allowed");
  for (const k of [
    "sites/fretwork-11/index.html", "sites/fretwork/index.html", "sites/other-1/index.html", "sites/", "sites",
    "config/other-1.json", "config/fretwork-1.json.bak", "config/", "config/fretwork-11.json",
    "jobs/edit/j_other", "jobs/", "jobs/edit/", "orphans/fretwork-1/x", "sitemeta/fretwork-1",
    "sites/fretwork-1/../other-1/index.html", "", null, undefined,
  ]) assert.equal(allowedJobKey(slug, id, k), false, String(k) + " should be refused");
  // A malformed identity admits nothing at all.
  assert.equal(allowedJobKey("Bad Slug", id, "sites/Bad Slug/x"), false);
  assert.equal(allowedJobKey(slug, "", "sites/fretwork-1/x"), false);
  assert.deepEqual(jobPrefixes("cafe"), ["sites/cafe/", "source/cafe/", "versions/cafe/", "uploads/cafe/", "backups/cafe/"]);
});

test("a listing is allowed only inside a prefix the job may touch", () => {
  const { slug, id } = JOB;
  assert.equal(allowedJobPrefix(slug, id, "sites/fretwork-1/"), true);
  assert.equal(allowedJobPrefix(slug, id, "sites/fretwork-1/client/"), true);
  assert.equal(allowedJobPrefix(slug, id, "versions/fretwork-1/"), true);
  assert.equal(allowedJobPrefix(slug, id, "jobs/edit/" + id), true, "its own object as a prefix");
  assert.equal(allowedJobPrefix(slug, id, "sites/"), false, "every site");
  assert.equal(allowedJobPrefix(slug, id, "sites/fretwork-1"), false, "a prefix that also matches fretwork-11");
  assert.equal(allowedJobPrefix(slug, id, "jobs/edit/"), false, "everybody's jobs");
  assert.equal(allowedJobPrefix(slug, id, "config/"), false);
  assert.equal(allowedJobPrefix(slug, id, ""), false);
});

// ── metadata on the wire ────────────────────────────────────────────────────

test("metadata rides as headers and comes back whole, including values a header cannot carry raw", () => {
  const obj = {
    key: "sites/x/a b.txt", size: 12, etag: "abc", httpEtag: '"abc"', uploaded: new Date("2026-09-04T22:00:00.000Z"),
    httpMetadata: { contentType: "text/html; charset=utf-8", cacheControl: "public, max-age=60", contentEncoding: "gzip", cacheExpiry: new Date("2026-09-05T00:00:00.000Z") },
    customMetadata: { build: "mtn2pqqq-0q059t", note: "two\nlines, and a ünicode ✓", "odd key": "v" },
  };
  const h = metaHeaders(obj);
  assert.equal(h.get("content-type"), "text/html; charset=utf-8");
  assert.equal(h.get("x-gf-size"), "12");
  const back = readMetaHeaders(h);
  assert.equal(back.key, obj.key);
  assert.equal(back.size, 12);
  assert.equal(back.etag, "abc");
  assert.equal(back.httpEtag, '"abc"');
  assert.equal(back.uploaded.toISOString(), obj.uploaded.toISOString());
  assert.deepEqual({ ...back.httpMetadata, cacheExpiry: back.httpMetadata.cacheExpiry.toISOString() },
    { contentType: obj.httpMetadata.contentType, cacheControl: obj.httpMetadata.cacheControl, contentEncoding: "gzip", cacheExpiry: "2026-09-05T00:00:00.000Z" });
  assert.deepEqual(back.customMetadata, obj.customMetadata);
  // Nothing → nothing, not empty objects the code would then treat as metadata.
  const none = readMetaHeaders(new Headers());
  assert.equal(none.httpMetadata, undefined);
  assert.equal(none.customMetadata, undefined);
  // The conditions, both ways.
  const when = new Date("2026-09-04T22:00:00.000Z");
  const oh = onlyIfHeaders({ etagMatches: "e1", etagDoesNotMatch: "e2", uploadedBefore: when, uploadedAfter: when });
  const o = readOnlyIf(oh);
  assert.equal(o.etagMatches, "e1");
  assert.equal(o.etagDoesNotMatch, "e2");
  assert.equal(o.uploadedBefore.toISOString(), when.toISOString());
  assert.equal(o.uploadedAfter.toISOString(), when.toISOString());
  assert.equal(readOnlyIf(new Headers()), undefined);
  assert.deepEqual(onlyIfHeaders(null), {});
});

// ── the bucket, driven through the REAL handler against a fake R2 ───────────

/** A fake R2 with the semantics the code relies on: etags, onlyIf, listing. */
function fakeR2() {
  const store = new Map();
  const etagOf = (buf) => createHash("md5").update(Buffer.from(buf)).digest("hex");
  const objOf = (k) => {
    const e = store.get(k);
    if (!e) return null;
    return {
      key: k, size: e.bytes.byteLength, etag: e.etag, httpEtag: '"' + e.etag + '"', uploaded: e.uploaded,
      httpMetadata: e.httpMetadata, customMetadata: e.customMetadata,
      body: new Blob([e.bytes]).stream(),
      async text() { return Buffer.from(e.bytes).toString("utf8"); },
      async json() { return JSON.parse(Buffer.from(e.bytes).toString("utf8")); },
      async arrayBuffer() { return e.bytes.slice(0); },
    };
  };
  return {
    store,
    async get(k) { return objOf(k); },
    async head(k) { const o = objOf(k); if (!o) return null; const { body, ...rest } = o; return rest; },
    async put(k, value, opts = {}) {
      const cur = store.get(k);
      const oi = opts.onlyIf;
      if (oi) {
        if (oi.etagMatches != null && (!cur || cur.etag !== String(oi.etagMatches).replace(/"/g, ""))) return null;
        if (oi.etagDoesNotMatch != null && cur && cur.etag === String(oi.etagDoesNotMatch).replace(/"/g, "")) return null;
      }
      const bytes = typeof value === "string" ? Buffer.from(value, "utf8").buffer.slice(0) : value instanceof ArrayBuffer ? value : Buffer.from(value).buffer.slice(0);
      const e = { bytes, etag: etagOf(bytes), uploaded: new Date("2026-09-04T22:30:00.000Z"), httpMetadata: opts.httpMetadata, customMetadata: opts.customMetadata };
      store.set(k, e);
      const { body, ...rest } = objOf(k);
      return rest;
    },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k); },
    async list(opts = {}) {
      const all = [...store.keys()].filter((k) => k.startsWith(opts.prefix || "")).sort();
      const start = opts.cursor ? Number(opts.cursor) : 0;
      const limit = opts.limit || 1000;
      const page = all.slice(start, start + limit);
      return { objects: page.map((k) => { const { body, ...rest } = objOf(k); return rest; }), truncated: start + limit < all.length, cursor: start + limit < all.length ? String(start + limit) : undefined, delimitedPrefixes: [] };
    },
  };
}

/** The shim wired straight to the handler: no network, one protocol. */
async function rig({ job = JOB, secret = "platform-secret", now = 1_000_000_000_000 } = {}) {
  const key = await gatewayKey(secret);
  const token = await signJobToken(job, key);
  const r2 = fakeR2();
  const refused = [];
  const handle = gatewayHandler({ bucket: r2, verify: (t) => verifyJobToken(t, key, now), log: (why, d) => refused.push({ why, ...d }) });
  const base = "https://gofarther.dev/api/job/" + job.id;
  const fetch = async (url, init) => {
    const u = new URL(url);
    const id = gatewayJobId(u.pathname);
    const req = new Request(u.toString(), init);
    return handle(req, id);
  };
  const bucket = new GatewayBucket({ url: base, token, fetch });
  return { bucket, r2, refused, token, key, base, fetch };
}

test("put, get, head, list and delete round-trip through the gateway in R2's own shapes", async () => {
  const { bucket, r2 } = await rig();
  const put = await bucket.put("sites/fretwork-1/index.html", "<h1>hi</h1>", {
    httpMetadata: { contentType: "text/html; charset=utf-8", cacheControl: "no-cache" }, customMetadata: { build: "mtn1" },
  });
  assert.ok(put instanceof GatewayObject);
  assert.equal(put.key, "sites/fretwork-1/index.html");
  assert.equal(put.size, 11);
  assert.ok(put.etag && put.httpEtag === '"' + put.etag + '"');
  assert.ok(put.uploaded instanceof Date);
  assert.equal(r2.store.get("sites/fretwork-1/index.html").httpMetadata.contentType, "text/html; charset=utf-8");
  assert.deepEqual(r2.store.get("sites/fretwork-1/index.html").customMetadata, { build: "mtn1" });

  const got = await bucket.get("sites/fretwork-1/index.html");
  assert.equal(await got.text(), "<h1>hi</h1>");
  assert.equal(got.httpMetadata.contentType, "text/html; charset=utf-8");
  assert.equal(got.httpMetadata.cacheControl, "no-cache");
  assert.deepEqual(got.customMetadata, { build: "mtn1" });
  assert.equal(got.size, 11);
  assert.equal(got.etag, put.etag);
  assert.equal(await bucket.get("sites/fretwork-1/missing"), null);

  // JSON and bytes, the two other readings the Worker makes.
  await bucket.put("source/fretwork-1/pages.json", JSON.stringify({ pages: [1, 2] }), { httpMetadata: { contentType: "application/json" } });
  assert.deepEqual(await (await bucket.get("source/fretwork-1/pages.json")).json(), { pages: [1, 2] });
  const bin = new Uint8Array([0, 1, 2, 255, 254]);
  await bucket.put("sites/fretwork-1/client/card.png", bin, { httpMetadata: { contentType: "image/png" } });
  const back = new Uint8Array(await (await bucket.get("sites/fretwork-1/client/card.png")).arrayBuffer());
  assert.deepEqual([...back], [...bin], "binary bytes did not survive the wire");
  // The body as a stream, for the serve-style copy.
  const streamed = await bucket.get("sites/fretwork-1/index.html");
  assert.ok(streamed.body && typeof streamed.body.getReader === "function");
  assert.equal(await new Response(streamed.body).text(), "<h1>hi</h1>");

  const head = await bucket.head("sites/fretwork-1/index.html");
  assert.equal(head.size, 11);
  assert.equal(head.customMetadata.build, "mtn1");
  assert.equal(head.body, null);
  assert.equal(await bucket.head("sites/fretwork-1/nope"), null);

  const listing = await bucket.list({ prefix: "sites/fretwork-1/" });
  assert.deepEqual(listing.objects.map((o) => o.key).sort(), ["sites/fretwork-1/client/card.png", "sites/fretwork-1/index.html"]);
  assert.equal(listing.truncated, false);
  assert.ok(listing.objects[0] instanceof GatewayObject);
  // Paged, the way the sweep walks a big site.
  const page1 = await bucket.list({ prefix: "sites/fretwork-1/", limit: 1 });
  assert.equal(page1.objects.length, 1);
  assert.equal(page1.truncated, true);
  const page2 = await bucket.list({ prefix: "sites/fretwork-1/", limit: 1, cursor: page1.cursor });
  assert.equal(page2.truncated, false);
  assert.notEqual(page1.objects[0].key, page2.objects[0].key);

  await bucket.delete("sites/fretwork-1/index.html");
  assert.equal(await bucket.get("sites/fretwork-1/index.html"), null);
  await bucket.delete(["sites/fretwork-1/client/card.png", "source/fretwork-1/pages.json"]);
  assert.equal(r2.store.size, 0);
  await bucket.delete([]);
});

test("a put with a condition that fails answers NULL, the way R2 does — the resume's claim depends on it", async () => {
  const { bucket } = await rig();
  const first = await bucket.put("jobs/" + JOB.id + "/resume.json", "a");
  const stale = await bucket.put("jobs/" + JOB.id + "/resume.json", "b", { onlyIf: { etagMatches: "not-the-etag" } });
  assert.equal(stale, null, "a failed condition must be null, not a throw and not an object");
  const fresh = await bucket.put("jobs/" + JOB.id + "/resume.json", "b", { onlyIf: { etagMatches: first.etag } });
  assert.ok(fresh && fresh.etag !== first.etag);
  assert.equal(await (await bucket.get("jobs/" + JOB.id + "/resume.json")).text(), "b");
  const clash = await bucket.put("jobs/" + JOB.id + "/resume.json", "c", { onlyIf: { etagDoesNotMatch: fresh.etag } });
  assert.equal(clash, null);
});

test("the gateway refuses another site's keys, another job's token, an expired token, and says why", async () => {
  const { bucket, refused, r2, base, key } = await rig();
  await r2.put("sites/other-1/index.html", "theirs");
  await assert.rejects(bucket.get("sites/other-1/index.html"), /gateway get 403/);
  await assert.rejects(bucket.put("config/other-1.json", "{}"), /gateway put 403/);
  await assert.rejects(bucket.list({ prefix: "sites/" }), /gateway list 403/);
  await assert.rejects(bucket.delete(["sites/fretwork-1/a", "sites/other-1/b"]), /gateway delete 403/);
  assert.equal(r2.store.has("sites/other-1/index.html"), true, "a refused delete must delete nothing");
  assert.deepEqual(refused.map((r) => r.why), ["out-of-scope", "out-of-scope", "out-of-scope", "out-of-scope"]);
  assert.deepEqual(refused.map((r) => r.key), ["sites/other-1/index.html", "config/other-1.json", "sites/", "sites/other-1/b"]);
  assert.equal(refused[0].slug, "fretwork-1");
  // A token for another job, presented on this job's path.
  const other = await signJobToken({ ...JOB, id: "j_other123" }, key);
  const b2 = new GatewayBucket({ url: base, token: other, fetch: (await rig()).fetch });
  await assert.rejects(b2.get("sites/fretwork-1/index.html"), /403/);
  // Expired: the same token read after its expiry.
  const late = await rig({ now: JOB.exp * 1000 + 1 });
  await assert.rejects(late.bucket.get("sites/fretwork-1/index.html"), /401/);
  // No token at all.
  const bare = await (await rig()).fetch(base + "/r2?key=sites%2Ffretwork-1%2Findex.html", { method: "GET" });
  assert.equal(bare.status, 401);
  // An op the protocol does not have.
  const odd = await rig();
  const res = await odd.fetch(base + "/r2/rename", { method: "POST", headers: { authorization: "Bearer " + odd.token } });
  assert.equal(res.status, 400);
});

test("gatewayJobId reads the job out of the path and nothing else", () => {
  assert.equal(gatewayJobId("/api/job/j_abc12345/r2"), "j_abc12345");
  // AT THE START OF THE PATH, not anywhere in it: a site's own route that
  // happens to contain the mount (`/s/<slug>/api/job/…`, a page named after
  // it) is not a gateway request. A sweep found the anchor unguarded.
  assert.equal(gatewayJobId("/s/other-1/api/job/j_abc12345/r2"), null, "the mount matched inside a site's path");
  assert.equal(gatewayJobId("/x/api/job/j_abc12345"), null);
  assert.equal(gatewayJobId("/api/job/j_abc12345"), "j_abc12345");
  assert.equal(gatewayJobId("/api/job/j_abc12345/r2/list"), "j_abc12345");
  assert.equal(gatewayJobId("/api/jobs/j_abc12345/r2"), null);
  assert.equal(gatewayJobId("/api/job/"), null);
  assert.equal(gatewayJobId("/api/job/a b/r2"), null);
  assert.equal(gatewayJobId("/api/site/edit/j_abc12345"), null);
});

// ── the env ─────────────────────────────────────────────────────────────────

test("the job env carries the strings, the bucket shim, a refusing queue, and no other binding", () => {
  const env = makeContainerEnv({
    secrets: { SUPABASE_SERVICE_KEY: "svc", XAI_API_KEY: "x", EDIT_ASYNC: "on", NOT_A_STRING: 42, ALSO: null },
    gateway: { url: "https://gofarther.dev/api/job/j_1", token: "t" },
    fetch: async () => new Response(null, { status: 404 }),
  });
  assert.equal(env.SUPABASE_SERVICE_KEY, "svc");
  assert.equal(env.EDIT_ASYNC, "on");
  assert.equal("NOT_A_STRING" in env, false, "a non-string binding is not a secret");
  assert.ok(env.SITES_BUCKET instanceof GatewayBucket);
  assert.equal(env.BUILD_QUEUE, refusingQueue);
  assert.deepEqual(env.SITE_BUILD_CONTAINER, { local: true });
  for (const absent of ["SITE_ROUTES", "SITE_API_CACHE", "EMAIL", "SITE_WORKERS", "ASSETS", "GAME_BUILD_CONTAINER"]) {
    assert.equal(absent in env, false, absent + " has no business inside the container");
  }
  assert.throws(() => makeContainerEnv({ secrets: {}, gateway: { url: "", token: "" } }), /gateway/);
  assert.rejects(env.BUILD_QUEUE.send({ kind: "site-edit", id: "x" }), /inside the container/);
});

test("the job ctx collects waitUntil and drains it, a rejected one included", async () => {
  const ctx = makeContainerCtx();
  const order = [];
  ctx.waitUntil(new Promise((r) => setTimeout(() => { order.push("a"); r(); }, 5)));
  ctx.waitUntil(Promise.reject(new Error("b")));
  ctx.waitUntil((async () => { order.push("c"); })());
  await ctx.drain();
  assert.deepEqual(order.sort(), ["a", "c"]);
  ctx.passThroughOnException();
});
