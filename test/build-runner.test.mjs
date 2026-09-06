// STAGE 5b/5c (2026-09-06): A BUILD RUNS INSIDE THE SITE'S CONTAINER — the
// fork on the build consumer, the design inside the job, and a token whose
// scope follows the name the designer gives the site.
//
//   the consumer   claims the row, resolves who the build is for and which
//                  site (a revise, a chosen name, or no name yet), puts the
//                  job object back for the runner, fires `kind: "build"` at
//                  the site's lane with the row's holder, and returns; every
//                  refusal is the inline path exactly as before
//   the token      a build with a name is scoped to it from the start; one
//                  with no name yet carries a PRE-SCOPE token that opens
//                  only the job's own objects and the id-bound RPCs, and is
//                  re-scoped through the gateway's `/scope` op the moment
//                  the designer names the site — free or the owner's own,
//                  never a stranger's
//   the runner     takes the lease over by name (the slug on the handoff),
//                  runs the WHOLE build — design, generation, compile,
//                  publish — under the container's longer budget, with no
//                  fire and no resume: the generation goes to the build
//                  service next door and the job waits for it
//   the gate       the build's own clock reads the stop signal, so a stopped
//                  build refuses its next stage instead of dying mid-flight
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, loadWorkerModule, makeCtx, hit } from "./fixtures/worker-harness.mjs";
import { JOB_KIND, jobKey, resultKey, packJob, readResult, BUILD_JOB_MS } from "../builder/build-job.mjs";
import { EDIT_JOB_MS, JOB_TOKEN_GRACE_S, LEASE_TTL_S } from "../builder/edit-job.mjs";
import { CONTAINER_BUILD_BUDGET_MS, BUILD_BUDGET_MS, makeBudget } from "../builder/build-budget.mjs";
import { gatewayKey, verifyJobToken, signJobToken, allowedJobKey, allowedJobPrefix, sbDecision, gatewayHandler, preScopeSlug } from "../builder/job-gateway.mjs";
import { makeContainerEnv, refusingQueue, rescopeJob, GatewayBucket } from "../builder/container-env.mjs";
import { readLaunch, runJob } from "../builder/container-job.mjs";
import { JOB_KILL_GRACE_MS, JOB_TERM_GRACE_MS } from "../builder/job-clock.mjs";
import { APP_ZONE } from "../site-domains.mjs";
import { laneName } from "../builder/build-lane.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, (what || needle) + " not found"); return i; };
/** A function's text: from its head to the first `\n}\n` after it. */
const fn = (src, head) => { const from = at(src, head); const end = src.indexOf("\n}\n", from); assert.ok(end > from, head + " has no close"); return src.slice(from, end); };

const ID = "0123456789abcdef0123456789abcdef";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const SB = "https://ujrqdmmtcptvimazlhom.supabase.co";
const SLUG = "fretwork-1";

// ── the numbers ─────────────────────────────────────────────────────────────

test("the numbers: a build's job is longer than an edit's, the container's build budget is longer than the consumer's ceiling and shorter than the job, with room left for the stand-in and the terminal writes", () => {
  assert.equal(BUILD_JOB_MS, 30 * 60_000);
  assert.equal(CONTAINER_BUILD_BUDGET_MS, 27 * 60_000);
  assert.ok(BUILD_JOB_MS > EDIT_JOB_MS, "a build's job is not longer than an edit's");
  assert.ok(CONTAINER_BUILD_BUDGET_MS > BUILD_BUDGET_MS, "the container's build budget is not longer than the consumer's ceiling — the point of running it there");
  assert.ok(BUILD_JOB_MS - CONTAINER_BUILD_BUDGET_MS >= 120_000, "less than two minutes between the budget and the deadline for the placeholder and the terminal writes");
  // The service stops the child a grace past the deadline and kills it a
  // grace after that; the token outlives the deadline by its grace.
  assert.ok(JOB_TOKEN_GRACE_S * 1000 > JOB_KILL_GRACE_MS + JOB_TERM_GRACE_MS, "a stopped build's token expires before the service has finished stopping it");
});

test("the build's own clock reads the stop signal: a stopped job is expired at its next gate, and a call already started keeps its cap", () => {
  const stop = new AbortController();
  const b = makeBudget(60_000, () => 0, stop.signal);
  assert.equal(b.expired(), false);
  assert.equal(b.capMs(5000), 5000);
  stop.abort();
  assert.equal(b.expired(), true, "an aborted stop signal did not expire the budget");
  assert.equal(b.capMs(5000), 5000, "the cap of a call moved on the stop — a call already in flight keeps its own bound; the next gate is what refuses");
  // No signal: the budget as it was, and junk is not a signal.
  assert.equal(makeBudget(60_000, () => 0).expired(), false);
  assert.equal(makeBudget(60_000, () => 0, null).expired(), false);
  assert.equal(makeBudget(60_000, () => 0, { aborted: true }).expired(), true, "a stop signal is read by its `aborted`");
  assert.equal(makeBudget(60_000, () => 0, { aborted: "yes" }).expired(), false, "a truthy non-boolean was read as a stop");
});

// ── the pre-scope token ─────────────────────────────────────────────────────

/** A token signed by hand under the derived key — what a minter that forgot the rule would produce. */
async function forgeToken(payload, key) {
  const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
  const p = b64(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("v1." + p));
  return "v1." + p + "." + b64(new Uint8Array(sig));
}

test("a pre-scope token names the placeholder and says so; it opens the job's own objects and nothing of any site", async () => {
  const key = await gatewayKey("platform-secret");
  const pre = preScopeSlug(ID);
  assert.equal(pre, "pre-" + ID);
  const t = await signJobToken({ id: ID, slug: pre, uid: UID, exp: 2_000_000_000, pre: true }, key);
  const who = await verifyJobToken(t, key, 1_000_000_000_000);
  assert.deepEqual(who, { id: ID, slug: pre, uid: UID, exp: 2_000_000_000, pre: true });
  // A token that is not pre-scoped carries no `pre` at all — every guard that
  // deep-compares a payload stays as it was.
  const plain = await verifyJobToken(await signJobToken({ id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000 }, key), key, 1_000_000_000_000);
  assert.deepEqual(plain, { id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000 });
  assert.equal(Object.hasOwn(plain, "pre"), false);
  // A pre token naming a real site is a confused caller, refused at the mint.
  await assert.rejects(signJobToken({ id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000, pre: true }, key), /pre/);
  // …AND AT THE READER, not only at the mint: a token that says `pre` and
  // names a site — forged under the same key, since the mint refuses it — is
  // refused by verify, so the wall's reader never trusts a minter that forgot
  // the rule. (The sweep's G3: with the reader's own check removed, only the
  // mint stood between a pre token and a real name.) The same forge without
  // the flag verifies, so the forge itself is sound.
  assert.equal(await verifyJobToken(await forgeToken({ id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000, pre: true }, key), key, 1_000_000_000_000), null, "a pre token naming a site verified");
  assert.deepEqual(await verifyJobToken(await forgeToken({ id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000 }, key), key, 1_000_000_000_000), { id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000 });
  // THE WALL under pre: the job's own objects, and nothing else — not even
  // the placeholder's own prefixes, since a pre-scope job has no site.
  for (const k of ["jobs/" + ID + ".json", "jobs/" + ID + ".result.json", "jobs/" + ID + ".resume.json"]) {
    assert.equal(allowedJobKey(pre, ID, k, true), true, k + " should be allowed under pre");
  }
  for (const k of ["sites/" + pre + "/index.html", "source/" + pre + "/pages.json", "config/" + pre + ".json", "current/" + pre + ".json", "sitemeta/" + pre + ".json", "sites/" + SLUG + "/index.html", "jobs/other.json"]) {
    assert.equal(allowedJobKey(pre, ID, k, true), false, k + " was admitted under a pre-scope token");
  }
  assert.equal(allowedJobPrefix(pre, ID, "jobs/" + ID, true), true);
  assert.equal(allowedJobPrefix(pre, ID, "sites/" + pre + "/", true), false, "a pre-scope job may list a site prefix");
  // Without the flag the same placeholder slug is an ordinary (nonexistent)
  // site: the FLAG is what narrows the wall, never the spelling of the slug.
  assert.equal(allowedJobKey(pre, ID, "sites/" + pre + "/index.html"), true);
  assert.equal(allowedJobKey(pre, ID, "sites/" + pre + "/index.html", false), true);
});

test("the Supabase wall under a pre-scope token: the id- and uid-bound calls, never a slug-bound one — not even for the placeholder", () => {
  const pre = preScopeSlug(ID);
  const who = { id: ID, slug: pre, uid: UID, exp: 2_000_000_000, pre: true };
  const ok = (m, p, s, b) => sbDecision(who, m, p, s, b, "real-mint");
  assert.equal(ok("POST", "/rest/v1/rpc/edit_beat", "", JSON.stringify({ p_id: ID, p_owner: "c_x", p_ttl: 90, p_mint: "gf-gateway" })).ok, true, "the beat");
  assert.equal(ok("POST", "/rest/v1/rpc/edit_handoff", "", JSON.stringify({ p_id: ID, p_owner: "c_a", p_next: "c_b", p_ttl: 90, p_state: null, p_slug: null, p_mint: "gf-gateway" })).ok, true, "a handoff naming no slug");
  assert.deepEqual(ok("POST", "/rest/v1/rpc/edit_handoff", "", JSON.stringify({ p_id: ID, p_owner: "c_a", p_next: "c_b", p_ttl: 90, p_state: null, p_slug: SLUG, p_mint: "gf-gateway" })), { ok: false, why: "bind:p_slug" }, "a handoff naming a site under a pre token");
  assert.deepEqual(ok("POST", "/rest/v1/rpc/edit_handoff", "", JSON.stringify({ p_id: ID, p_owner: "c_a", p_next: "c_b", p_ttl: 90, p_state: null, p_slug: pre, p_mint: "gf-gateway" })), { ok: false, why: "bind:p_slug" }, "a handoff naming the placeholder as the site");
  assert.equal(ok("POST", "/rest/v1/rpc/credit_reverse", "", JSON.stringify({ p_target: UID, p_ref: "build:" + ID + ":deposit", p_reason: "design", p_amount: 2 })).ok, true, "the deposit's reversal");
  assert.equal(ok("GET", "/rest/v1/edit_jobs", "?id=eq." + ID + "&select=state", "").ok, true, "the job's own row");
  assert.equal(ok("GET", "/rest/v1/credits", "?user_id=eq." + UID + "&select=balance", "").ok, true, "the owner's balance");
  assert.deepEqual(ok("GET", "/rest/v1/site_backends", "?slug=eq." + pre + "&select=uid", ""), { ok: false, why: "filter:slug" }, "a site read by the placeholder");
  assert.deepEqual(ok("GET", "/rest/v1/site_backends", "?slug=eq." + SLUG + "&select=uid", ""), { ok: false, why: "filter:slug" }, "a site read by a real name");
  assert.deepEqual(ok("POST", "/rest/v1/site_backends", "", JSON.stringify({ slug: pre, uid: UID, neon_db: "" })), { ok: false, why: "row:slug" }, "a claim of the placeholder as a site");
  assert.deepEqual(ok("POST", "/rest/v1/site_builds", "", JSON.stringify({ slug: pre, ok: false })), { ok: false, why: "row:slug" }, "a build record under the placeholder");
  // The same job, once scoped: the ordinary wall.
  const scoped = { id: ID, slug: SLUG, uid: UID, exp: 2_000_000_000 };
  assert.equal(sbDecision(scoped, "GET", "/rest/v1/site_backends", "?slug=eq." + SLUG + "&select=uid", "", "m").ok, true);
  assert.equal(sbDecision(scoped, "POST", "/rest/v1/rpc/edit_handoff", "", JSON.stringify({ p_id: ID, p_owner: "c_a", p_next: "c_b", p_ttl: 90, p_state: null, p_slug: SLUG, p_mint: "gf-gateway" }), "m").ok, true);
});

/** A fake bucket with R2's surface, for the handler. */
function fakeBucket(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { key: k, body: v, size: v.length, etag: "e", async text() { return v; }, async json() { return JSON.parse(v); } }; },
    async put(k, v) { store.set(k, typeof v === "string" ? v : Buffer.from(v).toString("utf8")); return { key: k, etag: "e", size: 1 }; },
    async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
    async head(k) { return store.has(k) ? { key: k, size: 1, etag: "e" } : null; },
    async list() { return { objects: [], truncated: false }; },
  };
}

test("THE SCOPE OP, through the real handler: a pre-scope token is re-minted for a name that is free or the owner's own, never a stranger's, never on a token that is not pre-scoped, never when the owner cannot be read", async () => {
  const key = await gatewayKey("platform-secret");
  const now = 1_000_000_000_000;
  const exp = 2_000_000_000;
  const logs = [];
  const owners = { "free-name": null, "mine-1": UID, "theirs-1": "someone-else" };
  const handle = gatewayHandler({
    bucket: fakeBucket(),
    verify: (t) => verifyJobToken(t, key, now),
    log: (why, d) => logs.push({ why, ...d }),
    scope: {
      sign: (p) => signJobToken(p, key),
      owner: async (slug) => { if (slug === "boom") throw new Error("supabase down"); return owners[slug] === undefined ? null : owners[slug]; },
    },
  });
  const preTok = await signJobToken({ id: ID, slug: preScopeSlug(ID), uid: UID, exp, pre: true }, key);
  const post = (token, body) => handle(new Request("https://gofarther.dev/api/job/" + ID + "/scope", {
    method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body),
  }), ID);
  // A free name.
  let r = await post(preTok, { slug: "free-name" });
  const freeText = await r.text();
  assert.equal(r.status, 200, freeText);
  const j = JSON.parse(freeText);
  assert.equal(j.ok, true);
  assert.equal(j.slug, "free-name");
  const who = await verifyJobToken(j.token, key, now);
  assert.deepEqual(who, { id: ID, slug: "free-name", uid: UID, exp }, "the re-minted token is not the same job scoped to the name with the same expiry");
  // The owner's own name (a designer that invented a name the customer holds).
  r = await post(preTok, { slug: "mine-1" });
  assert.equal(r.status, 200);
  assert.equal((await verifyJobToken((await r.json()).token, key, now)).slug, "mine-1");
  // A stranger's: refused, said in the log, the token unchanged.
  r = await post(preTok, { slug: "theirs-1" });
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: "taken", slug: "theirs-1" });
  assert.ok(logs.some((l) => l.why === "scope-taken" && l.slug === "theirs-1" && l.id === ID), JSON.stringify(logs));
  // An owner that cannot be read is not a free name.
  r = await post(preTok, { slug: "boom" });
  assert.equal(r.status, 503, "cannot-tell was read as free");
  // A name this platform would not claim.
  for (const bad of ["Bad Slug", "", "a".repeat(61), "-x", "x-", 42, null]) {
    r = await post(preTok, { slug: bad });
    assert.equal(r.status, 400, "admitted " + JSON.stringify(bad));
  }
  r = await handle(new Request("https://gofarther.dev/api/job/" + ID + "/scope", { method: "POST", headers: { authorization: "Bearer " + preTok }, body: "not json" }), ID);
  assert.equal(r.status, 400);
  // A token that is not pre-scoped may not re-scope itself: its site is its site.
  const scopedTok = await signJobToken({ id: ID, slug: SLUG, uid: UID, exp }, key);
  r = await post(scopedTok, { slug: "free-name" });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /pre/);
  // GET is not the op.
  r = await handle(new Request("https://gofarther.dev/api/job/" + ID + "/scope", { method: "GET", headers: { authorization: "Bearer " + preTok } }), ID);
  assert.equal(r.status, 400, "GET /scope was not refused as no such op");
  // A handler mounted without the scope deps answers 503, never a guess.
  const bare = gatewayHandler({ bucket: fakeBucket(), verify: (t) => verifyJobToken(t, key, now) });
  r = await bare(new Request("https://gofarther.dev/api/job/" + ID + "/scope", { method: "POST", headers: { authorization: "Bearer " + preTok, "content-type": "application/json" }, body: JSON.stringify({ slug: "free-name" }) }), ID);
  assert.equal(r.status, 503);
  // BEFORE AND AFTER, ON EVERY R2 OP. Under the pre token even the
  // PLACEHOLDER'S OWN prefix is refused — a pre-scoped job has no site — and
  // that key is what tells the pre wall from the ordinary one: the sweep's
  // G16 handed the read to the ordinary wall, which refuses a site's key
  // under the placeholder slug anyway and ADMITS the placeholder's own. The
  // re-minted token reaches its site's prefix (404, 200, 204 from the empty
  // bucket), and both read the job's own object.
  const op = (token, method, tail, body) => handle(new Request("https://gofarther.dev/api/job/" + ID + tail, {
    method, headers: { authorization: "Bearer " + token, "content-type": "application/json" }, ...(body !== undefined ? { body } : {}),
  }), ID);
  const own = "sites/" + preScopeSlug(ID) + "/index.html";
  for (const [method, tail, body] of [
    ["GET", "/r2?key=" + encodeURIComponent(own)],
    ["HEAD", "/r2?key=" + encodeURIComponent(own)],
    ["PUT", "/r2?key=" + encodeURIComponent(own), "hello"],
    ["DELETE", "/r2?key=" + encodeURIComponent(own)],
    ["POST", "/r2/delete", JSON.stringify({ keys: [own] })],
    ["POST", "/r2/list", JSON.stringify({ prefix: "sites/" + preScopeSlug(ID) + "/" })],
  ]) {
    const rr = await op(preTok, method, tail, body);
    assert.equal(rr.status, 403, method + " " + tail + " under a pre token answered " + rr.status);
  }
  assert.equal((await op(preTok, "GET", "/r2?key=" + encodeURIComponent("jobs/" + ID + ".json"))).status, 404, "the pre token cannot read the job's own object");
  for (const [method, tail, body, want] of [
    ["GET", "/r2?key=" + encodeURIComponent("sites/free-name/index.html"), undefined, 404],
    ["PUT", "/r2?key=" + encodeURIComponent("sites/free-name/index.html"), "hello", 200],
    ["DELETE", "/r2?key=" + encodeURIComponent("sites/free-name/index.html"), undefined, 204],
    ["POST", "/r2/list", JSON.stringify({ prefix: "sites/free-name/" }), 200],
    ["GET", "/r2?key=" + encodeURIComponent("jobs/" + ID + ".json"), undefined, 404],
  ]) {
    const rr = await op(j.token, method, tail, body);
    assert.equal(rr.status, want, method + " " + tail + " under the re-minted token answered " + rr.status);
  }
});

// ── the launch and the runner ───────────────────────────────────────────────

const good = { v: 2, kind: "build", id: ID, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "t" }, sb: { url: SB }, secrets: { A: "a" }, buildPort: 9090, deadlineAt: 1_900_000_000_000 };

test("readLaunch reads a build's slug or its pre-scope flag, refuses a slug it cannot use and a launch that says both, and leaves an edit's shape alone", () => {
  const named = readLaunch(JSON.stringify({ ...good, slug: SLUG }));
  assert.equal(named.slug, SLUG);
  assert.equal(Object.hasOwn(named, "pre"), false);
  const pre = readLaunch(JSON.stringify({ ...good, pre: true }));
  assert.equal(pre.pre, true);
  assert.equal(Object.hasOwn(pre, "slug"), false);
  const neither = readLaunch(JSON.stringify(good));
  assert.equal(Object.hasOwn(neither, "slug"), false);
  assert.equal(Object.hasOwn(neither, "pre"), false);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, slug: "Bad Slug" })), /slug/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, slug: "../x" })), /slug/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, slug: SLUG, pre: true })), /pre/, "a launch that names a slug AND says pre-scope");
  assert.equal(readLaunch(JSON.stringify({ ...good, pre: "true" })).pre, undefined, "a string is not the flag");
  // An edit launch is exactly what it was.
  assert.deepEqual(readLaunch(JSON.stringify({ ...good, kind: "edit" })), { kind: "edit", id: ID, gateway: good.gateway, sb: { url: SB }, secrets: { A: "a" }, buildPort: 9090, deadlineAt: 1_900_000_000_000 });
});

test("the job env: a pre-scope launch gets a JOB_SCOPE hook and nothing else does; the refusing queue says it refuses", async () => {
  assert.equal(refusingQueue.refusing, true, "the refusing queue does not say so — `canFire` reads it");
  const gw = { url: "https://gofarther.dev/api/job/" + ID, token: "old" };
  const pre = makeContainerEnv({ secrets: {}, gateway: gw, sb: { url: SB }, pre: true, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal(typeof pre.JOB_SCOPE, "function", "a pre-scope job env has no scope hook");
  assert.equal(pre.BUILD_QUEUE.refusing, true);
  const plain = makeContainerEnv({ secrets: {}, gateway: gw, sb: { url: SB }, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal(plain.JOB_SCOPE, undefined, "a scoped job env carries a scope hook it must never call");
  const edit = makeContainerEnv({ secrets: {}, gateway: gw, sb: { url: SB }, pre: false, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal(edit.JOB_SCOPE, undefined);
});

test("rescopeJob: one POST to the gateway's scope op with the current token, and BOTH shims carry the new token afterwards; a taken name is the claim's own refusal; anything else is a named failure that leaves the token alone", async () => {
  const seen = [];
  const answers = [];
  const fetch = async (url, init) => {
    seen.push({ url: String(url), method: init && init.method, auth: new Headers(init && init.headers).get("authorization"), body: init && init.body });
    const a = answers.shift() || { status: 200, body: { ok: true, token: "new-token", slug: "free-name" } };
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } });
  };
  const gateway = { url: "https://gofarther.dev/api/job/" + ID, token: "pre-token" };
  const bucket = new GatewayBucket({ url: gateway.url, token: gateway.token, fetch });
  const out = await rescopeJob({ gateway, bucket, fetch }, "free-name");
  assert.deepEqual(out, { ok: true, slug: "free-name" });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, gateway.url + "/scope");
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].auth, "Bearer pre-token", "the scope op was not asked with the token the job holds");
  assert.deepEqual(JSON.parse(seen[0].body), { slug: "free-name" });
  assert.equal(gateway.token, "new-token", "the fetch shim's token did not move");
  assert.equal(bucket.token, "new-token", "the bucket shim's token did not move");
  await bucket.head("jobs/" + ID + ".json");
  assert.equal(seen[1].auth, "Bearer new-token", "the bucket's next request did not carry the new token");
  // Through the env's own hook, the same two moves.
  const gw2 = { url: gateway.url, token: "pre-2" };
  const env = makeContainerEnv({ secrets: {}, gateway: gw2, sb: { url: SB }, pre: true, fetch });
  await env.JOB_SCOPE("mine-1");
  assert.equal(gw2.token, "new-token");
  assert.equal(env.SITES_BUCKET.token, "new-token");
  // Taken: the claim's own shape, so the route's catch answers "that name is taken".
  const gw3 = { url: gateway.url, token: "pre-3" };
  const b3 = new GatewayBucket({ url: gw3.url, token: gw3.token, fetch });
  answers.push({ status: 403, body: { error: "taken", slug: "theirs-1" } });
  await assert.rejects(rescopeJob({ gateway: gw3, bucket: b3, fetch }, "theirs-1"), (e) => e.conflict === true && e.stage === "claim");
  assert.equal(gw3.token, "pre-3", "a refused scope moved the token");
  assert.equal(b3.token, "pre-3");
  // Anything else: named, not conflict, the token unmoved.
  answers.push({ status: 503, body: { error: "owner unreadable" } });
  await assert.rejects(rescopeJob({ gateway: gw3, bucket: b3, fetch }, "free-name"), (e) => e.conflict !== true && e.stage === "claim" && /scope/.test(e.message));
  assert.equal(gw3.token, "pre-3");
  answers.push({ status: 200, body: { ok: true } });
  await assert.rejects(rescopeJob({ gateway: gw3, bucket: b3, fetch }, "free-name"), /scope/, "a 200 with no token was taken as a re-scope");
  assert.equal(gw3.token, "pre-3");
});

test("runJob hands the launch's slug to the Worker's job and builds a scope hook for a pre-scope launch only", async () => {
  const seen = [];
  const run = (launch) => runJob(launch, { importWorker: async () => ({ runContainerJob: async (env, ctx, job) => { seen.push({ env, job }); } }), ctx: { waitUntil() {}, async drain() {} } });
  assert.equal((await run(readLaunch(JSON.stringify({ ...good, slug: SLUG })))).ok, true);
  assert.deepEqual(seen[0].job, { kind: "build", id: ID, slug: SLUG });
  assert.equal(seen[0].env.JOB_SCOPE, undefined);
  assert.equal((await run(readLaunch(JSON.stringify({ ...good, pre: true, holder: "c_consumer" })))).ok, true);
  assert.deepEqual(seen[1].job, { kind: "build", id: ID, holder: "c_consumer" });
  assert.equal(typeof seen[1].env.JOB_SCOPE, "function", "a pre-scope launch's env has no scope hook");
  assert.equal((await run(readLaunch(JSON.stringify({ ...good, kind: "edit" })))).ok, true);
  assert.deepEqual(seen[2].job, { kind: "edit", id: ID });
});

// ── the fork, driven through the real queue handler ─────────────────────────

function fakeNamespace(answer) {
  const calls = [];
  return {
    calls,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({
      async fetch(req) {
        calls.push({ lane: id.name, url: req.url, method: req.method, body: await req.text() });
        return typeof answer === "function" ? answer() : answer;
      },
    }),
  };
}

const TAKEN = () => new Response(JSON.stringify({ ok: true, id: ID, pid: 7 }), { status: 200, headers: { "content-type": "application/json" } });
const CLAIMED = { ok: true, claimed: true, state: "claimed", billing: "external", uid: UID, needs_review: false, deferrals: 0 };

/**
 * One build message through the real handler. `owners` answers the site
 * lookup by slug (null = free, a uid = whose); the customer's own auth hop
 * answers nobody, so an inline build ends at its own 401 in one step — which
 * is exactly what tells "the build ran here" from "the build was fired".
 */
async function driveBuild({ env = {}, body = { brief: "a barber shop in Sheffield" }, answer = TAKEN, owners = {}, claim = CLAIMED, queue = null } = {}) {
  const worker = await loadWorker();
  const bucket = fakeBucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://" + APP_ZONE + "/api/site/react-build", auth: "Bearer t", body: JSON.stringify(body), uid: UID, at: Date.now() })) });
  const ns = fakeNamespace(answer);
  const urls = [];
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (/rpc\/edit_claim$/.test(u)) { if (typeof claim === "function") return json(claim()); if (claim instanceof Error) throw claim; return json(claim); }
    const m = /rest\/v1\/site_backends\?slug=eq\.([a-z0-9-]+)/.exec(u);
    if (m) { const o = owners[m[1]]; return json(o ? [{ uid: o }] : []); }
    if (u.includes("/auth/v1/user")) return json({});
    return json({ ok: false, error: "test" });
  };
  let acked = 0;
  try {
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id: ID }, ack() { acked++; } }] },
      { SITES_BUCKET: bucket, SITE_BUILD_CONTAINER: ns, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", NEON_API_KEY: "neon", ANTHROPIC_API_KEY: "k", STRIPE_SECRET_KEY: "never",
        BUILD_QUEUE: queue || { async send(msg, opts) { sent.push({ msg, opts }); } }, ...env }, makeCtx());
  } finally { globalThis.fetch = realFetch; }
  const rpcs = urls.map((u) => (u.match(/rpc\/(\w+)$/) || [])[1]).filter(Boolean);
  const stored = bucket.store.get(resultKey(ID));
  return { bucket, ns, urls, rpcs, acked, sent, ranHere: urls.some((u) => u.includes("/auth/v1/user")), result: stored ? readResult(JSON.parse(stored)) : null };
}

test("A REVISE OF THE CANARY'S SITE IS FIRED AT ITS LANE: the launch says build, names the site and the row's holder, its token is scoped to the site and outlives a build's clock, the object is left for the runner, and the consumer neither builds nor closes the row", async () => {
  const slug = "own-site-a";
  const d = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: slug }, body: { slug, instruction: "make it blue" }, owners: { [slug]: UID } });
  assert.equal(d.ns.calls.length, 1, "the container was not asked to run the build");
  const call = d.ns.calls[0];
  assert.equal(call.lane, laneName(slug), "the build was not fired at the site's own lane");
  assert.equal(call.url, "http://build/job/run");
  const launch = JSON.parse(call.body);
  assert.equal(launch.v, 2);
  assert.equal(launch.kind, "build");
  assert.equal(launch.id, ID);
  assert.equal(launch.slug, slug, "the launch does not name the site");
  assert.equal(Object.hasOwn(launch, "pre"), false, "a named build was launched pre-scoped");
  assert.match(String(launch.holder || ""), /^c_[A-Za-z0-9_-]{4,}$/, "the launch does not carry the consumer's lease name");
  assert.equal(launch.gateway.url, "https://" + APP_ZONE + "/api/job/" + ID);
  assert.equal(launch.sb.url, SB);
  assert.equal("SUPABASE_SERVICE_KEY" in launch.secrets, false);
  assert.ok(launch.deadlineAt >= Date.now() + BUILD_JOB_MS - 60_000 && launch.deadlineAt <= Date.now() + BUILD_JOB_MS, "the deadline is not a build's: " + launch.deadlineAt);
  const who = await verifyJobToken(launch.gateway.token, await gatewayKey("platform-secret"), Date.now());
  assert.ok(who, "the token does not verify");
  assert.equal(who.slug, slug);
  assert.equal(who.uid, UID);
  assert.equal(Object.hasOwn(who, "pre"), false);
  assert.ok(who.exp * 1000 > Date.now() + BUILD_JOB_MS, "the token expires before a build's clock does");
  assert.ok(who.exp * 1000 <= Date.now() + BUILD_JOB_MS + JOB_TOKEN_GRACE_S * 1000 + 5000, "the token outlives the build by more than its grace");
  // The consumer: one claim, the owner read, and nothing else — no build, no
  // result, no close; the object waits for the runner.
  assert.deepEqual(d.rpcs, ["edit_claim"], "the consumer did more than claim before firing: " + d.rpcs.join(","));
  assert.equal(d.ranHere, false, "the consumer also ran the build itself");
  assert.equal(d.result, null, "a fired build wrote a result here");
  assert.equal(d.bucket.store.has(jobKey(ID)), true, "the job object was not left for the runner");
  assert.equal(d.sent.length, 0);
  assert.equal(d.acked, 1);
});

test("A FIRST BUILD WITH NO NAME IS FIRED PRE-SCOPED, at a lane of its own, for an owner the flags admit", async () => {
  const d = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: UID } });
  assert.equal(d.ns.calls.length, 1, "the container was not asked to run the build");
  const call = d.ns.calls[0];
  const launch = JSON.parse(call.body);
  assert.equal(launch.kind, "build");
  assert.equal(launch.pre, true, "a nameless first build was not launched pre-scoped");
  assert.equal(Object.hasOwn(launch, "slug"), false, "a nameless build's launch names a slug");
  assert.equal(call.lane, laneName(preScopeSlug(ID)), "the nameless build was not fired at the placeholder's lane");
  const who = await verifyJobToken(launch.gateway.token, await gatewayKey("platform-secret"), Date.now());
  assert.ok(who);
  assert.equal(who.pre, true);
  assert.equal(who.slug, preScopeSlug(ID));
  assert.equal(who.uid, UID);
  assert.equal(d.urls.some((u) => u.includes("site_backends")), false, "a nameless build read a site row before firing");
  assert.equal(d.ranHere, false);
  assert.equal(d.bucket.store.has(jobKey(ID)), true);
});

test("A CHOSEN NAME THAT IS FREE is fired scoped to it; the SAME NAME OWNED BY ANOTHER is never fired — the inline path answers its 409 in seconds and no token is minted for a stranger's site", async () => {
  const free = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on" }, body: { brief: "x", slug: "free-site-b" }, owners: {} });
  assert.equal(free.ns.calls.length, 1);
  const launch = JSON.parse(free.ns.calls[0].body);
  assert.equal(launch.slug, "free-site-b");
  assert.equal(Object.hasOwn(launch, "pre"), false);
  assert.equal(free.ns.calls[0].lane, laneName("free-site-b"));
  const theirs = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on" }, body: { brief: "x", slug: "their-site-c" }, owners: { "their-site-c": "someone-else" } });
  assert.equal(theirs.ns.calls.length, 0, "a build of another account's site was fired at a container");
  assert.equal(theirs.ranHere, true, "the inline path did not run");
  assert.equal(theirs.bucket.store.has(jobKey(ID)), false, "the object outlived the inline run");
  assert.ok(theirs.result && theirs.result.status === 401, "the inline build did not write its answer: " + JSON.stringify(theirs.result));
  assert.equal(theirs.rpcs.filter((r) => r === "edit_claim").length, 1, "the inline run claimed again");
});

test("with the flags off, nothing is fired, no site row is read, and the consumer builds exactly as before", async () => {
  const d = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret" }, body: { brief: "x", slug: "own-site-d" }, owners: { "own-site-d": UID } });
  assert.equal(d.ns.calls.length, 0);
  assert.equal(d.urls.some((u) => u.includes("site_backends")), false, "an off runner paid a site read");
  assert.equal(d.ranHere, true);
  assert.equal(d.bucket.store.has(jobKey(ID)), false);
  assert.equal(d.rpcs.filter((r) => r === "edit_claim").length, 1);
  assert.equal(d.acked, 1);
});

test("a container without the endpoint, refusing, or full is the inline path after the fire: one claim, the object taken back, the build run here", async () => {
  let n = 0;
  for (const [status, body] of [[404, "nf"], [429, JSON.stringify({ ok: false, error: "too many jobs" })], [500, JSON.stringify({ ok: false })], [200, JSON.stringify({ ok: false, error: "x" })]]) {
    const slug = "own-site-e" + (n++);
    const d = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on" }, body: { brief: "x", slug }, owners: { [slug]: UID }, answer: () => new Response(body, { status }) });
    assert.equal(d.ns.calls.length, 1, "no fire on " + status);
    assert.equal(d.ranHere, true, "on " + status + " the consumer did not run the build itself");
    assert.equal(d.bucket.store.has(jobKey(ID)), false, "on " + status + " the object was left behind");
    assert.equal(d.rpcs.filter((r) => r === "edit_claim").length, 1, "on " + status + " the consumer claimed " + d.rpcs.filter((r) => r === "edit_claim").length + " times");
    assert.ok(d.result && d.result.status === 401, "on " + status + " no answer was written");
  }
});

test("a row the consumer does not hold is never fired: the runner takes a lease over by name, and there is none to take", async () => {
  const d = await driveBuild({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on" }, body: { brief: "x", slug: "own-site-f" }, owners: { "own-site-f": UID }, claim: { ok: false, claimed: false, error: "no-job" } });
  assert.equal(d.ns.calls.length, 0, "a build with no lease was fired");
  assert.equal(d.ranHere, true, "the build did not run inline as it always did without a row");
});

// ── the runner's side, driven through the Worker's export ───────────────────

test("THE RUNNER TAKES THE LEASE OVER BY NAME, names the site on the handoff, deletes the object, runs the whole build here, writes the answer and closes the row — and never sends on the queue", async () => {
  const mod = await loadWorkerModule();
  const bucket = fakeBucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://" + APP_ZONE + "/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ slug: SLUG, instruction: "x" }), uid: UID, at: Date.now() })) });
  const handoffs = [];
  const rpcs = [];
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const m = u.match(/rpc\/(\w+)$/);
    if (m) rpcs.push(m[1]);
    if (/rpc\/edit_claim$/.test(u)) return json({ ok: true, claimed: false, state: "claimed", error: "leased" });
    if (/rpc\/edit_handoff$/.test(u)) { const b = JSON.parse(String(init && init.body)); handoffs.push(b); return json({ ok: true, state: "claimed", owner: b.p_next, slug: SLUG, uid: UID }); }
    if (/rpc\/edit_refund$/.test(u)) return json({ ok: true, refunded: 0 });
    if (u.includes("/auth/v1/user")) return json({});
    return json({ ok: false, error: "test" });
  };
  try {
    await mod.runContainerJob({ SITES_BUCKET: bucket, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", NEON_API_KEY: "n", ANTHROPIC_API_KEY: "k", SITE_BUILD_CONTAINER: { local: true },
      BUILD_QUEUE: { async send(msg) { sent.push(msg); } }, JOB_STOP: new AbortController() }, makeCtx(), { kind: "build", id: ID, holder: "c_consumer", slug: SLUG });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(handoffs.length, 1, "the lease was not taken over exactly once: " + JSON.stringify(handoffs));
  const h = handoffs[0];
  assert.equal(h.p_id, ID);
  assert.equal(h.p_owner, "c_consumer", "the takeover does not name the consumer as the holder");
  assert.match(String(h.p_next), /^c_[A-Za-z0-9_-]{4,}$/, "the takeover does not move the lease to the runner's own name");
  assert.equal(h.p_ttl, LEASE_TTL_S);
  assert.equal(h.p_state, null);
  assert.equal(h.p_slug, SLUG, "the takeover does not set the row's slug from the launch");
  assert.equal(bucket.store.has(jobKey(ID)), false, "the runner left the job object behind");
  const stored = bucket.store.get(resultKey(ID));
  assert.ok(stored, "the runner wrote no answer");
  assert.equal(readResult(JSON.parse(stored)).status, 401, "the build did not run to its own first refusal here");
  assert.ok(rpcs.includes("edit_refund"), "the row was not closed: " + rpcs.join(","));
  assert.deepEqual(sent, [], "the runner sent on the queue");
});

test("a runner whose claim cannot be read does not wait for a queue it has not got: no re-send, the build runs", async () => {
  const mod = await loadWorkerModule();
  const bucket = fakeBucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://" + APP_ZONE + "/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: "x" }), uid: UID, at: Date.now() })) });
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/rpc\/edit_claim$/.test(u)) throw new Error("supabase down");
    return new Response(JSON.stringify(u.includes("/auth/v1/user") ? {} : { ok: false }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await mod.runContainerJob({ SITES_BUCKET: bucket, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", NEON_API_KEY: "n", ANTHROPIC_API_KEY: "k", SITE_BUILD_CONTAINER: { local: true },
      BUILD_QUEUE: { async send(msg) { sent.push(msg); } }, JOB_STOP: new AbortController() }, makeCtx(), { kind: "build", id: ID, holder: "c_consumer" });
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(sent, [], "the runner re-sent a message it cannot send");
  assert.ok(bucket.store.has(resultKey(ID)), "the build did not run");
  assert.equal(bucket.store.has(jobKey(ID)), false);
});

// ── the Worker, read where it cannot be driven ──────────────────────────────

test("`canFire` is false inside the container — the queue there refuses — and true for the Worker's own consumer, evaluated out of the source", () => {
  const src = noComments(WORKER);
  const build = fn(src, "async function runSiteBuild(");
  const m = /canFire: (.+),\n/.exec(build);
  assert.ok(m, "the build's canFire expression was not found");
  const canFire = new Function("jobId", "env", "return " + m[1] + ";");
  const container = makeContainerEnv({ secrets: {}, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "t" }, sb: { url: SB }, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal(canFire(ID, container), false, "a build inside the container would fire its generation at a queue that cannot carry the resume");
  assert.equal(canFire(ID, { SITES_BUCKET: {}, BUILD_QUEUE: { async send() {} } }), true, "the Worker's own consumer can no longer fire");
  assert.equal(canFire(null, { SITES_BUCKET: {}, BUILD_QUEUE: { async send() {} } }), false, "the inline HTTP path fires with no job to come back to");
  assert.equal(canFire(ID, { SITES_BUCKET: {} }), false);
});

test("the build consumer and the runner's dispatch, read off the Worker: the fire after the claim and before the delete, only with the lease held and only from the Worker; the runner's takeover, its slug and its longer budget; the budget reading the stop", () => {
  const src = noComments(WORKER);
  const q = fn(src, "async function runQueuedSiteBuild(");
  const claimAt = at(q, "await claimBuildRow(env, id, rowOwner, takeOver, launchSlug)");
  const fireAt = at(q, "await fireContainerJob(env, id, { holder: lease, kind: \"build\", who })");
  const identAt = at(q, "await buildFireIdentity(env, job)");
  assert.ok(claimAt < identAt && identAt < fireAt, "the fire does not follow the claim and the identity");
  const gate = q.slice(q.lastIndexOf("if (", identAt), identAt);
  assert.match(gate, /lease && !takeOver && jobRunnerOn\(env\)/, "the fire is not gated on the lease being held, the caller being the Worker, and the runner being on: " + gate);
  // The object goes BACK before the fire and is taken again when the fire fails.
  const putBack = q.slice(identAt, fireAt);
  assert.match(putBack, /SITES_BUCKET\.put\(jobKey\(id\), raw\)/, "the object is not put back for the runner before the fire");
  const afterFire = q.slice(fireAt, at(q, "const rec = makeRecorder({"));
  assert.match(afterFire, /if \(fire\.fired\)[\s\S]*?return;/, "a fired build does not end the consumer's work");
  assert.match(afterFire, /SITES_BUCKET\.delete\(jobKey\(id\)\)/, "the object is not taken back when the fire fails");
  // The budget reads the stop signal; the container hands its longer one in.
  assert.match(q, /makeBudget\(budgetMs[^\n]*JOB_STOP/, "the build's budget does not read the stop signal");
  const dispatch = fn(src, "export async function runContainerJob(");
  assert.match(dispatch, /kind === "build"\) return runQueuedSiteBuild\(env, ctx, id, \{ takeOver:[^\n]*slug[^\n]*budgetMs: CONTAINER_BUILD_BUDGET_MS/, "the runner's build does not take the lease over with the slug under the container's budget");
  // The unread deferral is the Worker's, never the runner's.
  assert.match(q, /if \(row\.unread && tries < CLAIM_RETRY_MAX && !takeOver\)/, "a runner whose claim could not be read would try to re-send");
  // The takeover names the slug on the handoff.
  const claim = fn(src, "async function claimBuildRow(");
  assert.match(claim, /p_slug: isRowSlug\(slug\) \? slug : null/, "the takeover's handoff does not carry the launch's slug");
});

test("the fire, read off the Worker: a build's clock and token expiry, the placeholder's lane for a nameless build, the launch's slug and pre flag; the identity: a name that is not the owner's is never fired", () => {
  const src = noComments(WORKER);
  const fire = fn(src, "async function fireContainerJob(");
  assert.match(fire, /const budgetMs = kind === "build" \? BUILD_JOB_MS : EDIT_JOB_MS;/, "the launch's clock is not the kind's");
  assert.match(fire, /deadlineAt: Date\.now\(\) \+ budgetMs,/);
  assert.match(fire, /exp: Math\.floor\(\(Date\.now\(\) \+ budgetMs\) \/ 1000\) \+ JOB_TOKEN_GRACE_S/, "the token's expiry is not the kind's clock plus the grace");
  assert.match(fire, /slug: pre \? preScopeSlug\(id\) : who\.slug/, "a pre-scope token does not name the placeholder");
  assert.match(fire, /laneName\(pre \? preScopeSlug\(id\) : who\.slug\)/, "a nameless build is not fired at the placeholder's lane");
  assert.match(fire, /v: 2, kind, id,/, "the launch's kind is not the caller's");
  const ident = fn(src, "async function buildFireIdentity(");
  assert.match(ident, /if \(!named\) return \{ uid: job\.uid, slug: "", pre: true \};/, "a nameless build is not pre-scoped");
  assert.match(ident, /siteOwnerBySlug\(named, env\)/, "the owner is not asked before a named build is fired");
  assert.match(ident, /if \(owner && owner !== job\.uid\) return null;/, "a stranger's site can be fired");
  assert.match(ident, /return \{ uid: job\.uid, slug: named, pre: false \};/);
  // The gateway's scope deps: the Worker signs with the derived key and asks
  // the fresh owner lookup, never the memoized one.
  const mount = fn(src, "function jobGateway(env)");
  assert.match(mount, /scope: \{[\s\S]*sign:[\s\S]*signJobToken\([\s\S]*owner:[\s\S]*siteBackendRowFresh\(env, slug\)/, "the gateway is not handed the scope deps");
});

test("the build route: the job's scope follows the name BEFORE the recorder, the ownership check and the claim; a taken name refunds and answers 409; the row learns the name after the claim — read by order", () => {
  const src = noComments(WORKER);
  const build = fn(src, "async function runSiteBuild(");
  const slugAt = at(build, "const slug = namedSlug || cleanSlug(designed && designed.slug)");
  const scopeAt = at(build, "await env.JOB_SCOPE(slug)");
  const identifyAt = at(build, "rec.identify(slug, bu.id);");
  const ownerAt = at(build, "const owner = await siteBackendRowFresh(env, slug);");
  const claimAt = at(build, "await claimSiteSlug(env, slug, bu.id, brief);");
  const provAt = at(build, 'tr.at("provision", needsDb ? undefined : { db: 0 });');
  const learnAt = at(build, "await rowLearnsSlug(env, { id: jobId, owner: lease, slug })");
  // The claim's try closes right after the provision mark; the row's name is
  // written inside it, after the mark — so a lost claim never writes a name.
  const catchAt = build.indexOf("} catch (e) {", provAt);
  assert.ok(catchAt > provAt, "the claim's catch no longer follows the provision mark");
  assert.ok(slugAt < scopeAt && scopeAt < identifyAt && identifyAt < ownerAt && ownerAt < claimAt, "the scope hook is not between the name and the first thing that reads it");
  assert.ok(provAt < learnAt && learnAt < catchAt, "the row does not learn the name right after the claim, inside its try");
  const hook = build.slice(scopeAt, identifyAt);
  assert.match(hook, /if \(e && e\.conflict\)[\s\S]*?refundFields\(\)[\s\S]*?"that name is taken"[\s\S]*?status: 409/, "a taken name at the scope does not refund and answer 409");
  assert.match(hook, /console\.error\("job scope failed:"[\s\S]*?refundFields\(\)[\s\S]*?status: 503/, "a scope that fails otherwise does not refund and answer 503");
  const gate = build.slice(build.lastIndexOf("if (", scopeAt), scopeAt);
  assert.match(gate, /typeof env\.JOB_SCOPE === "function"/, "the hook is not gated on the env carrying it");
  const learnGate = build.slice(build.lastIndexOf("if (", learnAt), learnAt);
  assert.match(learnGate, /lease && jobId/, "the row's name is written without a lease");
  const learn = fn(src, "async function rowLearnsSlug(");
  assert.match(learn, /"edit_handoff"/);
  assert.match(learn, /p_owner: owner, p_next: owner/, "the row learns its name through anything but a self-handoff");
  assert.match(learn, /p_slug: isRowSlug\(slug\) \? slug : null/);
});

// ── the build route, DRIVEN: the scope hook is asked with the name the designer gave, before any read under it ──

const ENV = { NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "svc", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };
const AUTHED = { Authorization: "Bearer t", "content-type": "application/json" };

test("THE SCOPE HOOK, DRIVEN through the real build route: asked once, with the name the designer gave, before any read under that name; a taken name answers 409 and gives the money back", async () => {
  const scoped = [];
  const calls = { debit: [], reverse: [], other: [] };
  const order = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json({ id: UID, email: "a@b.c" });
    if (url.includes("/rest/v1/rpc/credit_debit")) { calls.debit.push(JSON.parse(String(init && init.body) || "{}")); return json({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false }); }
    if (url.includes("/rest/v1/rpc/credit_reverse")) { calls.reverse.push(JSON.parse(String(init && init.body) || "{}")); return json({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }); }
    if (url.includes("/rest/v1/rpc/use_quota")) return json(true);
    if (url.includes("/v1/messages")) {
      order.push("design");
      return json({ id: "m1", type: "message", role: "assistant", stop_reason: "tool_use", usage: { input_tokens: 100, output_tokens: 50 },
        content: [{ type: "tool_use", id: "t1", name: "design_schema", input: { brand: "Crookes Guitar", slug: "crookes-guitar-x", description: "lessons", kind: "shopfront", purpose: "book a lesson", pages: [], components: [] } }] });
    }
    if (url.includes("site_backends")) order.push("site_backends");
    calls.other.push(url);
    return new Response("not stubbed", { status: 503 });
  };
  try {
    const res = await hit("/api/site/react-build", {
      method: "POST", headers: AUTHED,
      env: { ...ENV, JOB_SCOPE: async (slug) => { scoped.push(slug); order.push("scope"); throw Object.assign(new Error("that name is taken"), { stage: "claim", conflict: true }); } },
      body: JSON.stringify({ brief: "guitar lessons in Sheffield", picker: "sonnet" }),
    });
    assert.deepEqual(scoped, ["crookes-guitar-x"], "the hook was not asked exactly once with the designer's name");
    assert.equal(res.status, 409, JSON.stringify(res.json));
    assert.equal(res.json.error, "that name is taken");
    assert.equal(res.json.cost, 0, "the money did not come back: " + JSON.stringify(res.json));
    assert.ok(calls.reverse.length >= 1, "nothing was reversed");
    assert.equal(order.indexOf("site_backends"), -1, "a site row was read under the name before the scope followed it: " + order.join(","));
    assert.ok(order.indexOf("design") < order.indexOf("scope"), "the scope was asked before the designer named the site");
    assert.deepEqual(calls.other, [], "the route reached something unstubbed: " + calls.other.join(", "));
  } finally { globalThis.fetch = real; }
});
