// STAGE 4b (2026-09-06): THE SERVICE KEY AND THE MINT SECRET LEAVE THE JOB
// PROCESS — Supabase through the job gateway, under a wall bound to the job.
//
// Until this stage the container's job process held the platform's service
// key and the credit mint secret for the length of the job (JOB_ENV_NAMES
// listed both), because the Worker's code reaches Postgres directly. Now the
// job's env carries a MARKER under both names, the runner's fetch shim sends
// any Supabase request that presents the marker to the gateway's `/sb/…`
// with the job token, and the Worker's end injects the real credentials for
// the RPCs and the tables a job has business with — each bound to the job's
// own row, its site or its owner. What this file drives:
//   1. the wall (`sbDecision`), rule by rule, with literals;
//   2. the handler's `/sb/` branch against a fake Supabase: the forward, the
//      injection, the scrubbed RPC error, the passed table error;
//   3. the shim (`gatewayFetch`): what is rewritten and what goes out as it was;
//   4. THE REAL CONSUMER, end to end: `runContainerJob` inside a container env
//      through the shim, the real handler and the injection — the job's
//      requests carry the token and never the key, Postgres sees the key;
//   5. the launch (v2, no credential), the runner's install, the env's markers,
//      the secrets list, the vault's refusal of the marker as key material;
//   6. the lists held to the code: every RPC the wall admits is one the Worker
//      calls, every RPC the Worker calls is admitted or named Worker-only, and
//      every table the job-path helpers touch is admitted with its method.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  gatewayKey, signJobToken, verifyJobToken, gatewayHandler, gatewayJobId,
  sbDecision, SB_MARKER, SB_RPCS, SB_TABLES, SB_REQUEST_HEADERS, SB_RESPONSE_HEADERS, SB_MAX_BODY,
} from "../builder/job-gateway.mjs";
import { gatewayFetch, makeContainerEnv, GatewayBucket } from "../builder/container-env.mjs";
import { readLaunch, runJob, installGatewayFetch, LAUNCH_NEVER } from "../builder/container-job.mjs";
import { JOB_ENV_NAMES, jobSecrets } from "../builder/edit-job.mjs";
import { keyMaterial, writeMaterial, writeVersion } from "../site-secrets.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));

const JOB = { id: "j_edit00000001", slug: "fretwork-1", uid: "22175f41-6fbf-49d7-b039-a65078a0141c", exp: 1_900_000_000 };
const SB_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
const KEY = "service-role-key-the-container-never-sees";
const MINT = "mint-secret-the-container-never-sees";
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });

// ── 1. the wall ─────────────────────────────────────────────────────────────

test("the RPC wall: every admitted RPC is bound to the job's own row, site or owner; the mint is replaced only when the marker was sent", () => {
  for (const [fn, binds] of Object.entries(SB_RPCS)) {
    if (binds.p_id !== "id") continue;
    const ok = sbDecision(JOB, "POST", "/rest/v1/rpc/" + fn, "", JSON.stringify({ p_id: JOB.id, p_owner: "c_x", p_mint: SB_MARKER }), MINT);
    assert.equal(ok.ok, true, fn + " refused its own row: " + JSON.stringify(ok));
    assert.deepEqual(JSON.parse(ok.body), { p_id: JOB.id, p_owner: "c_x", p_mint: MINT }, fn + ": the mint was not replaced, or the body was changed");
    const foreign = sbDecision(JOB, "POST", "/rest/v1/rpc/" + fn, "", JSON.stringify({ p_id: "j_other00000001", p_mint: SB_MARKER }), MINT);
    assert.deepEqual(foreign, { ok: false, why: "bind:p_id" }, fn + " admitted another job's row");
    const none = sbDecision(JOB, "POST", "/rest/v1/rpc/" + fn, "", JSON.stringify({ p_mint: SB_MARKER }), MINT);
    assert.equal(none.ok, false, fn + " admitted a call naming no row");
  }
  // A handoff binds the slug only when it names one.
  const h = (p_slug) => sbDecision(JOB, "POST", "/rest/v1/rpc/edit_handoff", "", JSON.stringify({ p_id: JOB.id, p_owner: "c_a", p_next: "c_b", p_ttl: 90, p_state: null, p_slug, p_mint: SB_MARKER }), MINT);
  assert.equal(h(null).ok, true);
  assert.equal(h(undefined).ok, true);
  assert.equal(h(JOB.slug).ok, true);
  assert.deepEqual(h("other-1"), { ok: false, why: "bind:p_slug" });
  // The gate read binds nothing; the reversal binds the owner and the job's own ref.
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/rpc/deploy_gate_read", "", JSON.stringify({ p_deploy: "abc", p_mint: SB_MARKER }), MINT).ok, true);
  const rev = (p_target, p_ref) => sbDecision(JOB, "POST", "/rest/v1/rpc/credit_reverse", "", JSON.stringify({ p_target, p_ref, p_reason: "busy", p_amount: 2 }), MINT);
  assert.equal(rev(JOB.uid, "build:" + JOB.id + ":deposit").ok, true);
  assert.deepEqual(rev("33333333-2222-3333-4444-555555555555", "build:" + JOB.id + ":deposit"), { ok: false, why: "bind:p_target" });
  assert.deepEqual(rev(JOB.uid, "build:j_other00000001:deposit"), { ok: false, why: "bind:p_ref" });
  assert.deepEqual(rev(JOB.uid, 7), { ok: false, why: "bind:p_ref" });
  // A body with no p_mint goes out without one (credit_reverse takes none).
  assert.equal(JSON.parse(rev(JOB.uid, "build:" + JOB.id).body).p_mint, undefined);
  // The mint: a real-looking one in the body is a job passing its own — refused; the marker is replaced.
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/edit_beat", "", JSON.stringify({ p_id: JOB.id, p_mint: "the-real-thing" }), MINT), { ok: false, why: "mint" });
  // The Worker's own calls are refused by name.
  for (const fn of ["edit_create", "edit_sweep_lost", "edit_sweep_stale", "edit_cancel", "edit_get", "rebuild_claim", "deploy_gate_set", "deploy_gate_clear", "add_credits", "set_plan", "use_credits_for", "credit_back", "refund_charge", "site_analytics", "edit_phase_stats"]) {
    assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/" + fn, "", JSON.stringify({ p_id: JOB.id, p_mint: SB_MARKER }), MINT), { ok: false, why: "rpc" }, fn + " is a Worker's call and was admitted");
  }
  // The shape: a GET on an RPC, a body that is not an object, a name that is not a name.
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/rpc/edit_beat", "", "", MINT), { ok: false, why: "method" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/edit_beat", "", "[1]", MINT), { ok: false, why: "body" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/edit_beat", "", "not json", MINT), { ok: false, why: "body" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/Edit%20Beat", "", "{}", MINT), { ok: false, why: "rpc" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/rpc/", "", "{}", MINT), { ok: false, why: "path" });
});

test("the table wall: a bound filter must be present as eq., every written row carries the bound fields, embedding and every other table and method are refused", () => {
  const q = (s) => "?" + s;
  // site_backends: read by slug, claimed by slug and owner.
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=eq.fretwork-1&select=uid&limit=1"), "", MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("select=uid&limit=200"), "", MINT), { ok: false, why: "filter:slug" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=eq.other-1&select=uid"), "", MINT), { ok: false, why: "filter:slug" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=in.(fretwork-1)&select=uid"), "", MINT), { ok: false, why: "filter:slug" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=eq.fretwork-1&select=uid,edit_jobs(id)"), "", MINT), { ok: false, why: "embed" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=eq.fretwork-1&select=uid!inner"), "", MINT), { ok: false, why: "embed" });
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_backends", q("slug=eq.fretwork-1&select=*"), "", MINT).ok, true);
  const claim = sbDecision(JOB, "POST", "/rest/v1/site_backends", "", JSON.stringify({ slug: JOB.slug, uid: JOB.uid, neon_db: "", brief: null }), MINT);
  assert.equal(claim.ok, true);
  assert.deepEqual(JSON.parse(claim.body), { slug: JOB.slug, uid: JOB.uid, neon_db: "", brief: null });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", JSON.stringify({ slug: "other-1", uid: JOB.uid }), MINT), { ok: false, why: "row:slug" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", JSON.stringify({ slug: JOB.slug, uid: "33333333-2222-3333-4444-555555555555" }), MINT), { ok: false, why: "row:uid" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", JSON.stringify([{ slug: JOB.slug, uid: JOB.uid }, { slug: "other-1", uid: JOB.uid }]), MINT), { ok: false, why: "row:slug" }, "a foreign row hid behind an own one");
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", "[]", MINT), { ok: false, why: "body" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", "[1]", MINT), { ok: false, why: "body" });
  assert.deepEqual(sbDecision(JOB, "PATCH", "/rest/v1/site_backends", q("slug=eq.fretwork-1"), JSON.stringify({ notify: true }), MINT), { ok: false, why: "method" }, "no job patches a row");
  assert.deepEqual(sbDecision(JOB, "DELETE", "/rest/v1/site_backends", q("slug=eq.fretwork-1"), "", MINT), { ok: false, why: "method" });
  // A duplicate key: the value CHECKED is the value SENT, because the body is re-serialised.
  const dup = sbDecision(JOB, "POST", "/rest/v1/site_backends", "", '{"slug":"other-1","uid":"' + JOB.uid + '","slug":"fretwork-1"}', MINT);
  assert.equal(dup.ok, true);
  assert.equal((dup.body.match(/"slug"/g) || []).length, 1, "the forwarded body carried the key twice");
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_backends", "", '{"slug":"fretwork-1","uid":"' + JOB.uid + '","slug":"other-1"}', MINT).ok, false);
  // edit_jobs: the job's own row only — the sweep's listing is a Worker's read.
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/edit_jobs", q("id=eq." + JOB.id + "&select=id,uid,slug&order=updated_at.asc&limit=20"), "", MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/edit_jobs", q("needs_review=is.true&select=id&limit=20"), "", MINT), { ok: false, why: "filter:id" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/edit_jobs", q("id=eq.j_other00000001&select=id"), "", MINT), { ok: false, why: "filter:id" });
  // site_aliases: any label may be read (an address is public), writes bound to the site and its owner, the delete to the site.
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_aliases", q("alias=eq.crookes-guitar&select=slug,current&limit=1"), "", MINT).ok, true);
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_aliases", q("slug=eq.other-1&current=is.true&select=alias"), "", MINT).ok, true);
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_aliases", "", JSON.stringify({ alias: "crookes-guitar", slug: JOB.slug, uid: JOB.uid, current: true }), MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_aliases", "", JSON.stringify({ alias: "x", slug: "other-1", uid: JOB.uid, current: true }), MINT), { ok: false, why: "row:slug" });
  assert.equal(sbDecision(JOB, "DELETE", "/rest/v1/site_aliases", q("alias=eq.x&slug=eq.fretwork-1&current=is.false"), "", MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "DELETE", "/rest/v1/site_aliases", q("alias=eq.x&current=is.false"), "", MINT), { ok: false, why: "filter:slug" });
  assert.deepEqual(sbDecision(JOB, "DELETE", "/rest/v1/site_aliases", q("alias=eq.x&slug=eq.other-1"), "", MINT), { ok: false, why: "filter:slug" });
  // site_functions: the site's own, by slug; rows by slug and owner.
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_functions", q("select=name,enabled&owner_id=eq." + JOB.uid + "&slug=eq.fretwork-1&name=in.(%22a%22)"), "", MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_functions", q("enabled=is.true&schedule_minutes=not.is.null&select=slug,name"), "", MINT), { ok: false, why: "filter:slug" }, "the cron's listing is a Worker's read");
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_functions", q("on_conflict=owner_id,slug,name"), JSON.stringify([{ owner_id: JOB.uid, slug: JOB.slug, name: "remind", spec: { fn: "f" }, schedule_minutes: 1440 }]), MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_functions", q("on_conflict=owner_id,slug,name"), JSON.stringify([{ owner_id: "33333333-2222-3333-4444-555555555555", slug: JOB.slug, name: "remind" }]), MINT), { ok: false, why: "row:owner_id" });
  // credits: the owner's own balance. edit_traces: the site's own, the owner's own. site_builds: the site's own. site_project: by slug.
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/credits", q("user_id=eq." + JOB.uid + "&select=balance"), "", MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/credits", q("user_id=eq.33333333-2222-3333-4444-555555555555&select=balance"), "", MINT), { ok: false, why: "filter:user_id" });
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/edit_traces", "", JSON.stringify({ cid: "e_1", slug: JOB.slug, uid: JOB.uid, ok: true }), MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/edit_traces", "", JSON.stringify({ cid: "e_1", slug: "other-1", uid: JOB.uid }), MINT), { ok: false, why: "row:slug" });
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_builds", "", JSON.stringify({ slug: JOB.slug, stage: "fire", ok: true }), MINT).ok, true);
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_builds", "", JSON.stringify({ slug: "other-1" }), MINT), { ok: false, why: "row:slug" });
  assert.equal(sbDecision(JOB, "GET", "/rest/v1/site_project", q("slug=eq.fretwork-1&select=neon_project"), "", MINT).ok, true);
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_project", "", JSON.stringify({ slug: JOB.slug, uid: JOB.uid, neon_project: "p" }), MINT).ok, true);
  // Everything else: the Worker's tables, the auth admin API, storage, functions, a nested path.
  for (const t of ["webhook_queue", "site_domains", "neon_teardown", "site_rebuild", "site_hits", "autoreply_log", "user_autoreply", "gen_charges", "user_site_project", "purchases", "platform_flags"]) {
    assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/" + t, q("slug=eq.fretwork-1"), "", MINT), { ok: false, why: "table" }, t + " was admitted");
  }
  assert.deepEqual(sbDecision(JOB, "GET", "/auth/v1/admin/users/" + JOB.uid, "", "", MINT), { ok: false, why: "path" });
  assert.deepEqual(sbDecision(JOB, "POST", "/storage/v1/object/move", "", "{}", MINT), { ok: false, why: "path" });
  assert.deepEqual(sbDecision(JOB, "POST", "/functions/v1/send-email", "", "{}", MINT), { ok: false, why: "path" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/site_backends/extra", "", "", MINT), { ok: false, why: "path" });
  assert.deepEqual(sbDecision(JOB, "GET", "/rest/v1/", "", "", MINT), { ok: false, why: "path" });
});

// ── 2. the handler's /sb/ branch ────────────────────────────────────────────

function fakeR2() {
  const store = new Map();
  const etagOf = (buf) => createHash("md5").update(Buffer.from(buf)).digest("hex");
  const objOf = (k) => {
    const e = store.get(k);
    if (!e) return null;
    return {
      key: k, size: e.bytes.byteLength, etag: e.etag, httpEtag: '"' + e.etag + '"', uploaded: e.uploaded,
      httpMetadata: e.httpMetadata, customMetadata: e.customMetadata, body: new Blob([e.bytes]).stream(),
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
      const bytes = typeof value === "string" ? Buffer.from(value, "utf8").buffer.slice(0) : value instanceof ArrayBuffer ? value : Buffer.from(value).buffer.slice(0);
      store.set(k, { bytes, etag: etagOf(bytes), uploaded: new Date("2026-09-06T00:00:00.000Z"), httpMetadata: opts.httpMetadata, customMetadata: opts.customMetadata });
      const { body, ...rest } = objOf(k);
      return rest;
    },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k); },
    async list(opts = {}) { const all = [...store.keys()].filter((k) => k.startsWith(opts.prefix || "")).sort(); return { objects: all.map((k) => { const { body, ...rest } = objOf(k); return rest; }), truncated: false, delimitedPrefixes: [] }; },
  };
}

/** The handler with a fake Supabase behind it, and the job's token. */
async function rig({ job = JOB, sb = {}, secret = "platform-secret", now = 1_000_000_000_000, answer } = {}) {
  const key = await gatewayKey(secret);
  const token = await signJobToken(job, key);
  const calls = [];
  const refused = [];
  const supabase = async (url, init) => {
    const h = new Headers(init && init.headers);
    calls.push({ url: String(url), method: init && init.method, headers: Object.fromEntries([...h.entries()]), body: init && init.body, signal: init && init.signal });
    return answer ? answer(String(url), init) : json({ ok: true });
  };
  const handle = gatewayHandler({
    bucket: fakeR2(), verify: (t) => verifyJobToken(t, key, now), log: (why, d) => refused.push({ why, ...d }),
    sb: sb === null ? null : { url: SB_URL, key: KEY, mint: MINT, fetch: supabase, ...sb },
  });
  const base = "https://gofarther.dev/api/job/" + job.id;
  const send = (path, init = {}, tok = token) => handle(new Request(base + path, { ...init, headers: { ...(tok ? { authorization: "Bearer " + tok } : {}), ...(init.headers || {}) } }), job.id);
  return { send, calls, refused, token, key, base };
}

test("an admitted RPC is forwarded to Supabase with the real key and the real mint, and its answer comes back whole", async () => {
  const { send, calls, refused } = await rig({ answer: () => json({ ok: true, claimed: true, state: "claimed" }, 200, { "preference-applied": "x", "x-not-forwarded": "1" }) });
  const r = await send("/sb/rest/v1/rpc/edit_claim", { method: "POST", headers: { "content-type": "application/json", prefer: "return=representation", "x-gf-extra": "dropped" }, body: JSON.stringify({ p_id: JOB.id, p_owner: "c_x", p_ttl: 90, p_mint: SB_MARKER }) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, claimed: true, state: "claimed" });
  assert.equal(r.headers.get("content-type"), "application/json");
  assert.equal(r.headers.get("preference-applied"), "x");
  assert.equal(r.headers.get("x-not-forwarded"), null, "a header outside the list came back");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, SB_URL + "/rest/v1/rpc/edit_claim");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.apikey, KEY);
  assert.equal(calls[0].headers.authorization, "Bearer " + KEY);
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.equal(calls[0].headers.prefer, "return=representation");
  assert.equal("x-gf-extra" in calls[0].headers, false, "a header outside the list was forwarded");
  assert.deepEqual(JSON.parse(calls[0].body), { p_id: JOB.id, p_owner: "c_x", p_ttl: 90, p_mint: MINT });
  assert.ok(calls[0].signal instanceof AbortSignal, "the forward has no clock of its own");
  assert.deepEqual(refused, []);
});

test("an admitted table read carries its query whole and its answer back with the content-range; a delete's 204 is a 204", async () => {
  const { send, calls } = await rig({ answer: (u, init) => init.method === "DELETE" ? new Response(null, { status: 204 }) : json([{ uid: JOB.uid }], 200, { "content-range": "0-0/1" }) });
  const r = await send("/sb/rest/v1/site_backends?slug=eq.fretwork-1&select=uid&limit=1", { method: "GET" });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [{ uid: JOB.uid }]);
  assert.equal(r.headers.get("content-range"), "0-0/1");
  assert.equal(calls[0].url, SB_URL + "/rest/v1/site_backends?slug=eq.fretwork-1&select=uid&limit=1");
  assert.equal(calls[0].body, undefined, "a read was forwarded with a body");
  const d = await send("/sb/rest/v1/site_aliases?alias=eq.x&slug=eq.fretwork-1&current=is.false", { method: "DELETE", headers: { prefer: "return=minimal" } });
  assert.equal(d.status, 204);
  assert.equal(calls[1].method, "DELETE");
});

test("a refused op is 403 with the reason, logged with the op, and Supabase is never asked", async () => {
  const { send, calls, refused } = await rig();
  const r = await send("/sb/rest/v1/rpc/edit_create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ p_id: "x", p_mint: SB_MARKER }) });
  assert.equal(r.status, 403);
  const body = await r.json();
  assert.equal(body.why, "rpc");
  assert.equal(body.op, "POST /rest/v1/rpc/edit_create");
  const t = await send("/sb/rest/v1/site_backends?select=slug&limit=200", { method: "GET" });
  assert.equal(t.status, 403);
  assert.equal((await t.json()).why, "filter:slug");
  assert.equal(calls.length, 0, "a refused op reached Supabase");
  assert.deepEqual(refused.map((x) => x.why), ["sb-out-of-scope", "sb-out-of-scope"]);
  assert.equal(refused[0].op, "POST /rest/v1/rpc/edit_create");
  assert.equal(refused[0].reason, "rpc", "the log does not say why the wall refused");
  assert.equal(refused[1].reason, "filter:slug");
  assert.equal(refused[1].slug, JOB.slug);
  assert.equal(refused[1].id, JOB.id);
});

test("an RPC Supabase refused comes back as its STATUS with a scrubbed body — PostgREST quotes the request, and the request carries the mint", async () => {
  const { send, refused } = await rig({ answer: () => new Response(JSON.stringify({ message: "invalid input", details: 'the request {"p_id":"x","p_mint":"' + MINT + '"}' }), { status: 400, headers: { "content-type": "application/json" } }) });
  const r = await send("/sb/rest/v1/rpc/edit_beat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ p_id: JOB.id, p_mint: SB_MARKER }) });
  assert.equal(r.status, 400);
  const text = await r.text();
  assert.equal(text.includes(MINT), false, "the mint reached the container in an error body");
  assert.deepEqual(JSON.parse(text), { error: "supabase", status: 400 });
  assert.deepEqual(refused.map((x) => x.why), ["sb-refused"]);
  assert.equal(refused[0].status, 400);
});

test("a table write Supabase refused keeps its body — nothing in it is a platform secret, and the customer's sentence names the constraint", async () => {
  const { send } = await rig({ answer: () => new Response(JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint site_aliases_pkey" }), { status: 409, headers: { "content-type": "application/json" } }) });
  const r = await send("/sb/rest/v1/site_aliases", { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ alias: "x", slug: JOB.slug, uid: JOB.uid, current: true }) });
  assert.equal(r.status, 409);
  assert.match(await r.text(), /site_aliases_pkey/);
});

test("no token is 401, another job's token 403, no Supabase configured 503, a Supabase that cannot be reached 502, a body over the cap 413", async () => {
  const { send, key, base } = await rig();
  assert.equal((await send("/sb/rest/v1/rpc/edit_beat", { method: "POST", body: "{}" }, "")).status, 401);
  const other = await signJobToken({ ...JOB, id: "j_other00000001" }, key);
  assert.equal((await send("/sb/rest/v1/rpc/edit_beat", { method: "POST", body: "{}" }, other)).status, 403);
  const none = await rig({ sb: null });
  assert.equal((await none.send("/sb/rest/v1/rpc/edit_beat", { method: "POST", body: JSON.stringify({ p_id: JOB.id, p_mint: SB_MARKER }) })).status, 503);
  const down = await rig({ answer: () => { throw new TypeError("fetch failed"); } });
  const r = await down.send("/sb/rest/v1/rpc/edit_beat", { method: "POST", body: JSON.stringify({ p_id: JOB.id, p_mint: SB_MARKER }) });
  assert.equal(r.status, 502);
  assert.deepEqual(down.refused.map((x) => x.why), ["sb-unreachable"]);
  const big = await rig();
  const huge = await big.send("/sb/rest/v1/edit_traces", { method: "POST", headers: { "content-length": String(SB_MAX_BODY + 1) }, body: "x" });
  assert.equal(huge.status, 413);
  assert.equal(big.calls.length, 0);
  // The R2 branch is what it was, with the same token: a key outside the site is still refused.
  const r2 = await big.send("/r2?key=" + encodeURIComponent("sites/other-1/index.html"), { method: "GET" });
  assert.equal(r2.status, 403);
  assert.ok(base.endsWith(JOB.id));
});

// ── 3. the shim ─────────────────────────────────────────────────────────────

test("the shim rewrites a request presenting the marker to the gateway with the job token, and leaves every other request exactly as it was", async () => {
  const seen = [];
  const f = async (input, init) => { seen.push({ input, init }); return new Response("{}", { status: 200 }); };
  const gw = { url: "https://gofarther.dev/api/job/" + JOB.id + "/", token: "tok-1" };
  const fetchThrough = gatewayFetch({ gateway: gw, sbUrl: SB_URL + "/rest/v1", fetch: f });
  const ac = new AbortController();
  const init = { method: "POST", headers: { apikey: SB_MARKER, Authorization: "Bearer " + SB_MARKER, "content-type": "application/json", Prefer: "return=minimal", "x-gf-mine": "1" }, body: '{"p_id":"x"}', signal: ac.signal };
  await fetchThrough(SB_URL + "/rest/v1/rpc/edit_beat", init);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].input, "https://gofarther.dev/api/job/" + JOB.id + "/sb/rest/v1/rpc/edit_beat");
  const h = seen[0].init.headers;
  assert.equal(h.get("authorization"), "Bearer tok-1");
  assert.equal(h.get("apikey"), null, "the marker travelled as an apikey");
  assert.equal(h.get("content-type"), "application/json");
  assert.equal(h.get("prefer"), "return=minimal");
  assert.equal(h.get("x-gf-mine"), null, "a header outside the list travelled");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.body, '{"p_id":"x"}');
  assert.equal(seen[0].init.signal, ac.signal, "the caller's own clock was dropped");
  assert.equal("duplex" in seen[0].init, false, "a string body needs no duplex");
  // A read keeps its query, sends no body.
  await fetchThrough(SB_URL + "/rest/v1/site_backends?slug=eq.fretwork-1&select=uid", { headers: { apikey: SB_MARKER, Authorization: "Bearer " + SB_MARKER } });
  assert.equal(seen[1].input, "https://gofarther.dev/api/job/" + JOB.id + "/sb/rest/v1/site_backends?slug=eq.fretwork-1&select=uid");
  assert.equal(seen[1].init.method, "GET");
  assert.equal(seen[1].init.body, undefined);
  // The customer's own call — the anon key and their JWT — goes out untouched, the same arguments by identity.
  const own = { headers: { apikey: "anon-public", Authorization: "Bearer eyJ.customer.jwt" } };
  await fetchThrough(SB_URL + "/auth/v1/user", own);
  assert.equal(seen[2].input, SB_URL + "/auth/v1/user");
  assert.equal(seen[2].init, own);
  // A provider, the build service, the R2 gateway itself: untouched — the marker outside the Supabase origin is not a Supabase request.
  for (const [u, i] of [["https://api.x.ai/v1/chat", { headers: { authorization: "Bearer xai-key" } }], ["http://127.0.0.1:8080/build", { method: "POST", body: "{}" }], [gw.url + "r2?key=x", { headers: { authorization: "Bearer tok-1" } }], ["https://elsewhere.example/x", { headers: { apikey: SB_MARKER } }]]) {
    const before = seen.length;
    await fetchThrough(u, i);
    assert.equal(seen[before].input, u);
    assert.equal(seen[before].init, i);
  }
  // A Request object carrying the marker is rewritten too; an unparsable input passes through.
  await fetchThrough(new Request(SB_URL + "/rest/v1/rpc/edit_beat", { method: "POST", headers: { apikey: SB_MARKER }, body: "{}" }));
  assert.equal(seen[seen.length - 1].input, "https://gofarther.dev/api/job/" + JOB.id + "/sb/rest/v1/rpc/edit_beat");
  assert.equal(seen[seen.length - 1].init.headers.get("authorization"), "Bearer tok-1");
  await fetchThrough("not a url", { headers: { apikey: SB_MARKER } });
  assert.equal(seen[seen.length - 1].input, "not a url");
  assert.throws(() => gatewayFetch({ gateway: { url: "", token: "" }, sbUrl: SB_URL }), /gateway/);
});

// ── 4. the real consumer, end to end ────────────────────────────────────────

test("THE REAL CONSUMER INSIDE A CONTAINER ENV: its claim, its takeover and its refund reach Postgres with the real key and mint, and nothing that left the container carried either", async () => {
  const mod = await loadWorkerModule();
  const key = await gatewayKey("platform-secret");
  const token = await signJobToken(JOB, key);
  const r2 = fakeR2();
  const sbCalls = [];
  const refused = [];
  const supabase = async (url, init) => {
    const fn = (String(url).match(/rpc\/(\w+)$/) || [])[1];
    sbCalls.push({ fn, url: String(url), headers: Object.fromEntries([...new Headers(init.headers).entries()]), body: JSON.parse(init.body) });
    if (fn === "edit_claim") return json({ ok: true, claimed: false, error: "leased", state: "claimed" });
    if (fn === "edit_handoff") return json({ ok: true, state: "claimed", owner: "c_runner", uid: JOB.uid, slug: JOB.slug });
    if (fn === "edit_refund") return json({ ok: true, refunded: 0, state: "failed" });
    return json({ ok: false, error: "no stub for " + fn }, 500);
  };
  const handle = gatewayHandler({ bucket: r2, verify: (t) => verifyJobToken(t, key, Date.now()), log: (why, d) => refused.push({ why, ...d }), sb: { url: SB_URL, key: KEY, mint: MINT, fetch: supabase } });
  const gatewayUrl = "https://gofarther.dev/api/job/" + JOB.id;
  // THE WIRE: everything the job process sends, as the network would see it.
  const wire = [];
  const transport = async (input, init) => {
    const u = new URL(String(input));
    wire.push({ url: u.toString(), headers: Object.fromEntries([...new Headers(init && init.headers).entries()]), body: init && typeof init.body === "string" ? init.body : "" });
    if (u.hostname === "gofarther.dev" && u.pathname.startsWith("/api/job/")) return handle(new Request(u.toString(), init), gatewayJobId(u.pathname));
    return new Response("unreachable", { status: 503 });
  };
  const launch = readLaunch(JSON.stringify({ v: 2, kind: "edit", id: JOB.id, gateway: { url: gatewayUrl, token }, sb: { url: SB_URL }, secrets: { SITE_SECRETS_KEY: "platform-secret", XAI_API_KEY: "xai" }, holder: "c_consumer0001" }));
  const realFetch = globalThis.fetch;
  globalThis.fetch = transport;
  const logs = [];
  const realLog = console.log;
  const realErr = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = (...a) => logs.push(a.join(" "));
  let out;
  let fetchAfter = null;
  try {
    out = await runJob(launch, { importWorker: async () => mod, log: () => {} });
    // READ BEFORE THIS TEST'S OWN RESTORE: the sweep found the assertion below
    // vacuous when it sat after the `finally` that puts the fetch back itself.
    fetchAfter = globalThis.fetch;
  } finally { globalThis.fetch = realFetch; console.log = realLog; console.error = realErr; }
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(fetchAfter, transport, "the runner did not put the process's fetch back");
  // Postgres saw the three RPCs, each with the real credentials and the job's own row.
  assert.deepEqual(sbCalls.map((c) => c.fn), ["edit_claim", "edit_handoff", "edit_refund"], "the consumer did not run its claim, takeover and refund through the gateway");
  for (const c of sbCalls) {
    assert.equal(c.headers.apikey, KEY, c.fn + " reached Postgres without the real key");
    assert.equal(c.headers.authorization, "Bearer " + KEY);
    assert.equal(c.body.p_mint, MINT, c.fn + " reached Postgres without the real mint");
    assert.equal(c.body.p_id, JOB.id);
  }
  assert.equal(sbCalls[1].body.p_owner, "c_consumer0001", "the takeover is not from the launch's holder");
  assert.equal(sbCalls[2].body.p_note, "request object missing");
  // Nothing that left the container carried the key or the mint — not a URL, not a header, not a body.
  assert.ok(wire.length >= 4, "the job made fewer requests than its claim, takeover, object read and refund: " + wire.length);
  const flat = JSON.stringify(wire);
  assert.equal(flat.includes(KEY), false, "the service key left the container");
  assert.equal(flat.includes(MINT), false, "the mint secret left the container");
  for (const w of wire) {
    assert.ok(w.url.startsWith(gatewayUrl + "/"), "a request went somewhere other than the gateway: " + w.url);
    assert.equal(w.headers.authorization, "Bearer " + token, "a request left without the job token: " + w.url);
    assert.equal("apikey" in w.headers, false, "the marker travelled as an apikey: " + w.url);
  }
  const rpcOnWire = wire.filter((w) => w.url.includes("/sb/rest/v1/rpc/"));
  assert.equal(rpcOnWire.length, 3);
  for (const w of rpcOnWire) assert.equal(JSON.parse(w.body).p_mint, SB_MARKER, "the RPC left the container with something other than the marker as its mint");
  assert.ok(wire.some((w) => w.url.includes("/r2?key=jobs%2Fedit%2F" + JOB.id)), "the job object was not read through the R2 gateway");
  assert.deepEqual(refused, [], "the gateway refused something the consumer needed: " + JSON.stringify(refused));
  assert.ok(logs.some((l) => /no stored request for/.test(l)), "the consumer's own words did not reach the log: " + logs.join(" | "));
});

// ── 5. the launch, the runner, the env, the list, the vault ─────────────────

test("a v2 launch names the Supabase origin and carries no Supabase credential; v1, no origin, or a credential is refused by name", () => {
  const good = { v: 2, kind: "edit", id: JOB.id, gateway: { url: "https://gofarther.dev/api/job/" + JOB.id, token: "t" }, sb: { url: SB_URL + "/rest/v1/" }, secrets: { XAI_API_KEY: "x", N: 1 }, buildPort: 9090, deadlineAt: 1_900_000_000_000 };
  const l = readLaunch(JSON.stringify(good));
  assert.deepEqual(l, { kind: "edit", id: JOB.id, gateway: good.gateway, sb: { url: SB_URL }, secrets: { XAI_API_KEY: "x" }, buildPort: 9090, deadlineAt: 1_900_000_000_000 });
  assert.throws(() => readLaunch(JSON.stringify({ ...good, v: 1 })), /v2/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, sb: undefined })), /supabase origin/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, sb: { url: "ftp://x" } })), /supabase origin/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, sb: { url: "" } })), /supabase origin/);
  for (const never of LAUNCH_NEVER) {
    assert.throws(() => readLaunch(JSON.stringify({ ...good, secrets: { ...good.secrets, [never]: "leak" } })), new RegExp("no Supabase credential.*" + never), never + " travelled in a v2 launch");
  }
  assert.deepEqual(LAUNCH_NEVER, ["SUPABASE_SERVICE_KEY", "CREDITS_MINT_SECRET"]);
});

test("runJob puts the gateway fetch in front of the process before the import and the env, hands the env the markers, and puts the process's fetch back after", async () => {
  const good = readLaunch(JSON.stringify({ v: 2, kind: "edit", id: JOB.id, gateway: { url: "https://gofarther.dev/api/job/" + JOB.id, token: "tok" }, sb: { url: SB_URL }, secrets: { XAI_API_KEY: "x" } }));
  const seen = [];
  const realFetch = globalThis.fetch;
  const stub = async (input, init) => { seen.push({ input: String(input), headers: Object.fromEntries([...new Headers(init && init.headers).entries()]) }); return json({ ok: true }); };
  globalThis.fetch = stub;
  let envSeen = null;
  let fetchDuring = null;
  let fetchAfter = null;
  try {
    const out = await runJob(good, {
      importWorker: async () => {
        fetchDuring = globalThis.fetch;
        return {
          runContainerJob: async (env) => {
            envSeen = env;
            await fetch(SB_URL + "/rest/v1/rpc/edit_beat", { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY }, body: JSON.stringify({ p_id: JOB.id, p_mint: env.CREDITS_MINT_SECRET }) });
            await fetch("https://api.x.ai/v1/x", { headers: { authorization: "Bearer " + env.XAI_API_KEY } });
          },
        };
      },
    });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.notEqual(fetchDuring, realFetch, "the shim was not in place when the Worker was imported");
    // Read BEFORE this test's own restore (the sweep's R5 survived on the assertion after it).
    fetchAfter = globalThis.fetch;
  } finally { globalThis.fetch = realFetch; }
  assert.equal(fetchAfter, stub, "the process's fetch was not put back");
  assert.equal(envSeen.SUPABASE_SERVICE_KEY, SB_MARKER);
  assert.equal(envSeen.CREDITS_MINT_SECRET, SB_MARKER);
  assert.equal(envSeen.XAI_API_KEY, "x");
  assert.ok(envSeen.SITES_BUCKET instanceof GatewayBucket);
  assert.deepEqual(seen.map((s) => s.input), ["https://gofarther.dev/api/job/" + JOB.id + "/sb/rest/v1/rpc/edit_beat", "https://api.x.ai/v1/x"]);
  assert.equal(seen[0].headers.authorization, "Bearer tok");
  assert.equal(seen[1].headers.authorization, "Bearer x", "a provider call was touched");
  // The install answers a restore, and restores.
  const before = globalThis.fetch;
  const restore = installGatewayFetch(good);
  assert.notEqual(globalThis.fetch, before);
  restore();
  assert.equal(globalThis.fetch, before);
});

test("the env: with a Supabase origin the two names carry the marker whatever the secrets said; without one, what was handed", () => {
  const gw = { url: "https://gofarther.dev/api/job/j_1", token: "t" };
  const env = makeContainerEnv({ secrets: { SUPABASE_SERVICE_KEY: "leak", CREDITS_MINT_SECRET: "leak", XAI_API_KEY: "x" }, gateway: gw, sb: { url: SB_URL }, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal(env.SUPABASE_SERVICE_KEY, SB_MARKER, "a secret handed under the service key's name survived into the env");
  assert.equal(env.CREDITS_MINT_SECRET, SB_MARKER);
  assert.equal(env.XAI_API_KEY, "x");
  const plain = makeContainerEnv({ secrets: { XAI_API_KEY: "x" }, gateway: gw, fetch: async () => new Response(null, { status: 404 }) });
  assert.equal("SUPABASE_SERVICE_KEY" in plain, false);
  assert.equal("CREDITS_MINT_SECRET" in plain, false);
});

test("the secrets list no longer carries the service key or the mint, and jobSecrets never lets either travel — the RPC helper's reads are met by the markers", () => {
  for (const never of LAUNCH_NEVER) assert.equal(JOB_ENV_NAMES.includes(never), false, never + " is still handed to the job");
  assert.deepEqual(jobSecrets({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", XAI_API_KEY: "x", SITE_SECRETS_KEY: "k" }), { XAI_API_KEY: "x", SITE_SECRETS_KEY: "k" });
  // DERIVED: every `env.X` the RPC helper and the header builder read must be
  // a listed secret OR a name the env fills with the marker — the helpers'
  // own presence checks pass, and the shim is what carries the difference.
  const src = noComments(WORKER);
  const slice = (name) => { const at = src.indexOf(name); assert.ok(at > 0, name + " not found"); return src.slice(at, src.indexOf("\n}\n", at)); };
  const reads = new Set();
  for (const fn of ["async function editRpc(", "function svcHeaders("]) for (const m of slice(fn).matchAll(/env\.([A-Z][A-Z0-9_]+)/g)) reads.add(m[1]);
  assert.ok(reads.has("SUPABASE_SERVICE_KEY") && reads.has("CREDITS_MINT_SECRET"), "the helpers no longer read the two names this stage is about: " + [...reads].join(","));
  const env = makeContainerEnv({ secrets: jobSecrets({ XAI_API_KEY: "x" }), gateway: { url: "https://g/api/job/j_1", token: "t" }, sb: { url: SB_URL }, fetch: async () => new Response(null, { status: 404 }) });
  for (const name of reads) assert.ok(JOB_ENV_NAMES.includes(name) || env[name] === SB_MARKER, "the RPC helper reads env." + name + " and the job env neither carries it nor marks it");
});

test("the vault refuses the marker as key material: a v1 row cannot be opened in the container and nothing is written under the marker", () => {
  assert.equal(keyMaterial({ SUPABASE_SERVICE_KEY: SB_MARKER, FAL_KEY: "fal" }, 1), null, "a key was derived from the marker, or from the fallback under it");
  assert.equal(writeMaterial({ SUPABASE_SERVICE_KEY: SB_MARKER, FAL_KEY: "fal" }), null);
  assert.equal(writeVersion({ SUPABASE_SERVICE_KEY: SB_MARKER }), null);
  assert.equal(writeMaterial({ SUPABASE_SERVICE_KEY: SB_MARKER, SITE_SECRETS_KEY: "k".repeat(64) }).version, 2, "the marker stopped a v2 write");
  assert.equal(keyMaterial({ SUPABASE_SERVICE_KEY: SB_MARKER, SITE_SECRETS_KEY: "k" }, 2), "k|site-secrets-v2");
  // A Worker with the real name is what it was.
  assert.equal(keyMaterial({ SUPABASE_SERVICE_KEY: "svc" }, 1), "svc|site-secrets-v1");
  assert.equal(writeMaterial({ SUPABASE_SERVICE_KEY: "svc" }).version, 1);
});

// ── 6. the lists, held to the code ──────────────────────────────────────────

/** The RPCs the Worker calls only from its own side: the cron, the routes, the enqueue. */
const WORKER_ONLY_RPCS = ["edit_create", "edit_sweep_lost", "edit_sweep_stale", "edit_get", "edit_cancel", "rebuild_claim", "deploy_gate_set", "deploy_gate_clear", "edit_phase_stats"];

test("every RPC the wall admits is one the Worker calls, and every RPC the Worker calls through the helper is admitted or named as the Worker's own", () => {
  const src = noComments(WORKER);
  const called = new Set([...src.matchAll(/editRpc\(env, "([a-z_]+)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/rest\/v1\/rpc\/([a-z_]+)`/g)) called.add(m[1]);
  assert.ok(called.size >= 15, "the Worker's RPC calls were not found: " + [...called].join(","));
  for (const fn of Object.keys(SB_RPCS)) assert.ok(called.has(fn), "the wall admits " + fn + ", which the Worker never calls");
  const helperCalls = [...src.matchAll(/editRpc\(env, "([a-z_]+)"/g)].map((m) => m[1]);
  for (const fn of new Set(helperCalls)) {
    assert.ok(Object.hasOwn(SB_RPCS, fn) || WORKER_ONLY_RPCS.includes(fn), "editRpc calls " + fn + ", which is neither admitted by the wall nor named as the Worker's own — a job that needs it fails inside the container as a 403 in the gateway's log");
  }
  for (const fn of WORKER_ONLY_RPCS) assert.equal(Object.hasOwn(SB_RPCS, fn), false, fn + " is both admitted and named Worker-only");
});

/** The job-path helpers and the table (with the method) each reaches; the
 *  memoized owner lookup closes on `});`, the plain functions on `}`. */
const JOB_PATH_TABLES = [
  ["async function writeEditTrace(", "edit_traces", "POST"],
  ["async function readEditRows(", "edit_jobs", "GET"],
  ["const siteOwnerBySlug = memoize(", "site_backends", "GET", "\n});\n"],
  ["async function siteBackendRowFresh(", "site_backends", "GET"],
  ["async function claimSiteSlug(", "site_backends", "POST"],
  ["async function aliasRowFor(", "site_aliases", "GET"],
  ["async function publicNameFor(", "site_aliases", "GET"],
  ["async function formerNamesFor(", "site_aliases", "GET"],
  ["async function persistSiteJobs(", "site_functions", "GET"],
  ["async function persistSiteJobs(", "site_functions", "POST"],
  ["async function readCreditsFor(", "credits", "GET"],
  ["async function writeBuildRecord(", "site_builds", "POST"],
];

test("every table a job-path helper touches is admitted by the wall with that method, read off the helper's own source", () => {
  const src = noComments(WORKER);
  for (const [fn, table, method, close = "\n}\n"] of JOB_PATH_TABLES) {
    const at = src.indexOf(fn);
    assert.ok(at > 0, fn + " not found");
    const end = src.indexOf(close, at);
    assert.ok(end > at, fn + " has no close");
    const body = src.slice(at, end);
    const named = new RegExp("rest/v1/(?:\\$\\{[A-Z_]+\\}|" + table + ")[?`]").test(body) || (table === "site_builds" && /BUILD_RECORD_TABLE/.test(body));
    assert.ok(named, fn + " no longer reaches " + table + " — the wall's entry may be dead, or the helper reads another table now");
    assert.ok(SB_TABLES[table] && SB_TABLES[table][method], fn + " needs " + method + " " + table + " and the wall refuses it");
  }
  // The header lists carry what PostgREST needs and nothing that names a job.
  assert.deepEqual(SB_REQUEST_HEADERS, ["content-type", "prefer", "accept", "accept-profile", "content-profile", "range"]);
  assert.deepEqual(SB_RESPONSE_HEADERS, ["content-type", "content-range", "preference-applied"]);
  assert.equal(SB_REQUEST_HEADERS.includes("authorization"), false);
  assert.equal(SB_REQUEST_HEADERS.includes("apikey"), false);
});

test("the Worker mounts the Supabase branch with its own origin, key and mint, and the fire sends a v2 launch naming the origin and no credential (read off the source; the fire is driven in container-job.test.mjs)", () => {
  const src = noComments(WORKER);
  const mount = src.slice(src.indexOf("function jobGateway(env)"), src.indexOf("\n}\n", src.indexOf("function jobGateway(env)")));
  assert.match(mount, /sb: \{ url: SUPABASE_URL, key: \(env && env\.SUPABASE_SERVICE_KEY\) \|\| "", mint: \(env && env\.CREDITS_MINT_SECRET\) \|\| "" \}/, "the gateway is not handed the Worker's Supabase origin, key and mint");
  const fire = src.slice(src.indexOf("async function fireContainerJob("), src.indexOf("\n}\n", src.indexOf("async function fireContainerJob(")));
  // RE-ANCHORED for stage 5b: the launch's kind is the CALLER's now (an edit
  // or a build fire the same way); the edit's `kind: "edit"` is driven in
  // container-job.test.mjs and the build's in build-runner.test.mjs.
  assert.match(fire, /v: 2, kind, id,/, "the launch is not v2");
  assert.match(fire, /sb: \{ url: SUPABASE_URL \},/, "the launch does not name the Supabase origin");
  assert.match(fire, /secrets: jobSecrets\(env\),/);
});
