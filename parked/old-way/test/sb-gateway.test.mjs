// PARKED (2026-11-03, park-old-way): the old-way half of test/sb-gateway.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/job-gateway.mjs";
import { gatewayFetch, makeContainerEnv, GatewayBucket } from "../../../builder/container-env.mjs";
import { readLaunch, runJob, installGatewayFetch, LAUNCH_NEVER } from "../../../builder/container-job.mjs";
import { JOB_ENV_NAMES, jobSecrets } from "../../../builder/edit-job.mjs";
import { keyMaterial, writeMaterial, writeVersion } from "../../../site-secrets.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";

const ROOT = new URL("../../..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));

const JOB = { id: "j_edit00000001", slug: "fretwork-1", uid: "22175f41-6fbf-49d7-b039-a65078a0141c", exp: 1_900_000_000 };
const SB_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
const KEY = "service-role-key-the-container-never-sees";
const MINT = "mint-secret-the-container-never-sees";
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });

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

// ── 6. the lists, held to the code ──────────────────────────────────────────

/** The RPCs the Worker calls only from its own side: the cron, the routes, the enqueue. */
// `build_debit` is no longer here (2026-10-08, Codex's review of `b4300a07`):
// the wall admits it, bound to the job's own id, account and refs, so a
// container-run build whose bearer expired can still settle.
const WORKER_ONLY_RPCS = ["edit_create", "edit_sweep_lost", "edit_sweep_stale", "edit_get", "edit_cancel", "rebuild_claim", "deploy_gate_set", "deploy_gate_clear", "edit_phase_stats"];

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
  ["async function readCreditsFor(", "credits", "GET"],
  ["async function writeBuildRecord(", "site_builds", "POST"],
  // THE PROVISIONING HELPERS (2026-10-23, audit A09-8): each runs inside a
  // container job (add-on, rules rung, revise), and two were refused there
  // with every test green (A09-1's heal PATCH, A09-6's teardown read).
  ["async function healSiteBackendDb(", "site_backends", "PATCH"],
  ["async function siteNeonProject(", "site_project", "GET"],
  ["async function neonTearingDown(", "neon_teardown", "GET"],
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

test("A33-9: the rename lane and the Publish preflight read the alias row uncached", () => {
  const src = WORKER;
  assert.match(src, /async function aliasRowFor\(env, label, \{ fresh = false \} = \{\}\) \{[\s\S]{0,200}const hit = fresh \? null : aliasRoutes\.get\(l\);/);
  assert.match(src, /async function addressTaken\([\s\S]{0,400}aliasRowFor\(env, name, \{ fresh: true \}\)/);
  assert.match(src, /const takenByAlias = await aliasRowFor\(env, wanted, \{ fresh: true \}\);/);
});
