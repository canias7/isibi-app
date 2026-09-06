// The job runner and the consumer's fork: the container runs the Worker's
// consumer for a queued edit, the Worker fires it and returns, and falls back
// to itself when the container cannot take the job.
//
// ── WHY (2026-09-04) ────────────────────────────────────────────────────────
//
// Owner: "that stuff gotta run on container". Everything below the fork is
// the code that already ran in the Worker; what is new and therefore driven
// here is the seam — the launch payload and its checks, the child the build
// service spawns with a clean environment, the flags, the fire with every one
// of its inline fallbacks, the token it mints, the secrets it hands over (held
// to what the RPC helper reads), and the gateway mount on the app zone.
import test from "node:test";
import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { readLaunch, runJob } from "../builder/container-job.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import {
  EDIT_JOB_KIND, EDIT_JOB_PREFIX, EDIT_JOB_MS, packEditJob,
  JOB_ENV_NAMES, jobSecrets, jobRunnerOn, jobRunnerFor, jobRunnerEveryone, readCanaryList, JOB_FIRE_MS, JOB_TOKEN_GRACE_S,
} from "../builder/edit-job.mjs";
import { gatewayKey, verifyJobToken, signJobToken } from "../builder/job-gateway.mjs";
import { APP_ZONE } from "../site-domains.mjs";
import { laneName } from "../builder/build-lane.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const BUILD_SERVER = readFileSync(new URL("builder/build-server.mjs", ROOT), "utf8");
const YML = readFileSync(new URL(".github/workflows/deploy.yml", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));

const ID = "0123456789abcdef0123456789abcdef";
const SECRET = "fedcba9876543210fedcba9876543210";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const SLUG = "fretwork-1";

// ── the launch ──────────────────────────────────────────────────────────────

test("readLaunch admits a v1 launch and refuses every shape this runner cannot run", () => {
  const good = { v: 1, kind: "edit", id: ID, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "t" }, secrets: { A: "a", B: 2, C: null }, buildPort: 9090 };
  const l = readLaunch(JSON.stringify(good));
  assert.deepEqual(l, { kind: "edit", id: ID, gateway: good.gateway, secrets: { A: "a" }, buildPort: 9090 });
  assert.equal(readLaunch(JSON.stringify({ ...good, buildPort: undefined })).buildPort, 8080, "the build service's port defaults");
  assert.throws(() => readLaunch("nope"), /not JSON/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, v: 2 })), /v1/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, kind: "delete" })), /kind/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, id: "" })), /job id/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, id: "../x" })), /job id/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, gateway: { url: "ftp://x", token: "t" } })), /gateway/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, gateway: { url: "https://x", token: "" } })), /gateway/);
  assert.throws(() => readLaunch(JSON.stringify({ ...good, gateway: null })), /gateway/);
  assert.throws(() => readLaunch(""), /not JSON/);
});

test("runJob builds the job env, runs the Worker's export, drains the ctx, and never throws", async () => {
  const launch = readLaunch(JSON.stringify({ v: 1, kind: "edit", id: ID, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "tok" }, secrets: { SUPABASE_SERVICE_KEY: "svc" } }));
  const seen = [];
  const lines = [];
  const out = await runJob(launch, {
    importWorker: async () => ({ runContainerJob: async (env, ctx, job) => { seen.push({ env, ctx, job }); ctx.waitUntil(Promise.resolve()); } }),
    log: (l) => lines.push(l),
  });
  assert.equal(out.ok, true);
  assert.equal(out.kind, "edit");
  assert.equal(out.id, ID);
  assert.ok(typeof out.ms === "number");
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].job, { kind: "edit", id: ID });
  assert.equal(seen[0].env.SUPABASE_SERVICE_KEY, "svc", "the secrets did not reach the job env");
  assert.equal(seen[0].env.SITES_BUCKET.url, "https://gofarther.dev/api/job/" + ID);
  assert.equal(seen[0].env.SITES_BUCKET.token, "tok");
  assert.equal(typeof seen[0].ctx.waitUntil, "function");
  assert.deepEqual(lines, [{ job: ID, kind: "edit", started: true }]);
  // An older Worker tree without the export is named, not a TypeError.
  const older = await runJob(launch, { importWorker: async () => ({ default: {} }) });
  assert.equal(older.ok, false);
  assert.match(older.error, /no runContainerJob export/);
  // A throw out of the job is an answer, not a crash.
  const thrown = await runJob(launch, { importWorker: async () => ({ runContainerJob: async () => { throw new Error("boom"); } }) });
  assert.equal(thrown.ok, false);
  assert.match(thrown.error, /boom/);
  // The ctx is drained before the answer.
  let drained = false;
  const ctx = { waitUntil() {}, async drain() { drained = true; } };
  await runJob(launch, { importWorker: async () => ({ runContainerJob: async () => {} }), ctx, env: {} });
  assert.equal(drained, true);
});

test("the runner's entrypoint reads its launch off stdin and names a bad one, exit 2, before touching the Worker", () => {
  const r = spawnSync(process.execPath, [
    "--import", new URL("builder/worker-register.mjs", ROOT).pathname,
    new URL("builder/container-job.mjs", ROOT).pathname,
  ], { cwd: ROOT.pathname, input: "not a launch", encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 2, "exit " + r.status + ": " + r.stderr.slice(-500));
  const line = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(line.done, false);
  assert.match(line.error, /not JSON/);
});

// ── the build service ───────────────────────────────────────────────────────

test("the build service starts a job child from a clean environment, secrets on stdin, outside the compile chain, holding busy", () => {
  const src = noComments(BUILD_SERVER);
  assert.match(src, /import \{ readLaunch \} from "\.\/container-job\.mjs";/);
  assert.match(src, /import \{ spawn \} from "node:child_process";/);
  const route = src.slice(src.indexOf('req.url === "/job/run"'), src.indexOf('req.url.startsWith("/job/")'));
  assert.ok(route.length > 200, "the /job/run route moved");
  assert.match(route, /readLaunch\(jBody\)/, "the launch is not checked before a child is started");
  assert.match(route, /startJob\(launch, jBody\)/);
  assert.doesNotMatch(route, /oneAtATime\(/, "a job child on the compile chain waits on its own compile");
  assert.match(route, /MAX_JOBS/);
  const start = src.slice(src.indexOf("function startJob("), src.indexOf("function busyState()"));
  assert.match(start, /const release = holdBusy\(\);/, "a running job does not hold the container busy");
  assert.match(start, /spawn\(process\.execPath, \["--import", register, runner\]/, "the child is not started under the loader");
  assert.match(start, /env: cleanChildEnv\(/, "the child inherits this process's environment");
  assert.match(start, /child\.stdin\.end\(raw\);/, "the launch is not handed over on stdin");
  assert.match(start, /child\.on\("close", [\s\S]*?release\(\);/, "busy is not released when the child ends");
  // The clean environment, driven: nothing of this process's own but the path and a home.
  const fnText = src.slice(src.indexOf("function cleanChildEnv("), src.indexOf("function startJob("));
  const cleanChildEnv = new Function("process", fnText + "\nreturn cleanChildEnv;")({ env: { PATH: "/bin", HOME: "/h", LANG: "C", SUPABASE_SERVICE_KEY: "leak", XAI_API_KEY: "leak" } });
  const env = cleanChildEnv({ JOB_BUILD_PORT: "8080", JOB_ID: "x" });
  assert.deepEqual(Object.keys(env).sort(), ["HOME", "JOB_BUILD_PORT", "JOB_ID", "LANG", "NODE_ENV", "PATH"]);
  assert.ok(!Object.values(env).includes("leak"));
  // THE TREE GATE: a launch is refused with 503 while the Worker tree does not
  // import, BEFORE a child is started — the Worker's inline path, never a
  // child nobody is waiting on. Read here; the check itself is driven below.
  assert.match(route, /const tree = WORKER_TREE \|\| await WORKER_TREE_CHECK;\s*if \(!tree\.ok\) return send\(res, 503/,
    "a launch is not gated on the Worker tree importing");
  assert.ok(route.indexOf("WORKER_TREE_CHECK") < route.indexOf("startJob(launch, jBody)"), "the tree is checked after the child is started");
});

// ── THE RUNNER, FOR REAL ────────────────────────────────────────────────────
//
// A launch with NO secrets is the one job that runs to its end without a
// network: the consumer claims first (`edit_claim`), and the RPC helper
// refuses before any fetch when the service key is missing. So the real
// entrypoint, spawned as the build service spawns it, proves the whole seam —
// stdin read, the Worker imported under the loader, `runContainerJob`
// dispatched, the consumer run to its refusal, the ctx drained, one line out,
// exit 0 — for the price of the Worker's import.

const GOOD_LAUNCH = () => JSON.stringify({ v: 1, kind: "edit", id: ID, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "t" }, secrets: {}, buildPort: 8080 });
const jsonLines = (text) => String(text || "").split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

test("THE REAL RUNNER RUNS THE WORKER'S CONSUMER: a secretless launch on stdin goes in, its refusal and one done line come out, exit 0", () => {
  const r = spawnSync(process.execPath, [
    "--import", new URL("builder/worker-register.mjs", ROOT).pathname,
    new URL("builder/container-job.mjs", ROOT).pathname,
  ], { cwd: ROOT.pathname, input: GOOD_LAUNCH(), encoding: "utf8", timeout: 90000, env: { PATH: process.env.PATH, HOME: process.env.HOME || "/tmp" } });
  assert.equal(r.status, 0, "exit " + r.status + ":\n" + (r.stderr || "").slice(-1500) + "\n" + (r.stdout || "").slice(-800));
  const lines = jsonLines(r.stdout);
  assert.deepEqual(lines[0], { job: ID, kind: "edit", started: true }, "the runner did not announce the job: " + r.stdout.slice(0, 400));
  const last = lines[lines.length - 1];
  assert.equal(last.job, ID);
  assert.equal(last.kind, "edit");
  assert.equal(last.done, true, JSON.stringify(last));
  assert.ok(typeof last.ms === "number");
  // The consumer ran — its own words, off the real `runQueuedSiteEdit`.
  assert.match(r.stdout, /edit queue: not claimed .*no-service-key/, "the Worker's consumer did not run to its refusal:\n" + r.stdout.slice(-800));
});

test("a runner whose Worker cannot be imported says so on its one line and exits 1 — the failure code the build service records", () => {
  // Started WITHOUT the loader, the real import fails on the first
  // workerd-only specifier; the answer is the runner's `done: false` line and
  // a non-zero exit, never a stack on stderr and exit 0. A sweep found the
  // failure exit unobserved: only the success path had been driven.
  const r = spawnSync(process.execPath, [new URL("builder/container-job.mjs", ROOT).pathname],
    { cwd: ROOT.pathname, input: GOOD_LAUNCH(), encoding: "utf8", timeout: 90000, env: { PATH: process.env.PATH, HOME: process.env.HOME || "/tmp" } });
  assert.equal(r.status, 1, "exit " + r.status + ":\n" + (r.stderr || "").slice(-600) + "\n" + (r.stdout || "").slice(-600));
  const lines = jsonLines(r.stdout);
  const last = lines[lines.length - 1];
  assert.ok(last && last.job === ID && last.done === false, "the failure was not the runner's own line: " + r.stdout.slice(-400));
  assert.match(String(last.error), /cloudflare|ERR_UNKNOWN|ERR_MODULE_NOT_FOUND|Cannot find/i, "the failure does not name the import that failed: " + last.error);
});

/** `checkWorkerTree`, `cleanChildEnv` and `startJob` out of the build server's source, with their free names handed in. */
function buildServerFns({ WORKER_DIR, PORT = 8080, JOBS = new Map(), holdBusy = () => () => {}, console: c = { log() {}, error() {} } }) {
  const src = noComments(BUILD_SERVER);
  const from = src.indexOf("function checkWorkerTree(");
  const to = src.indexOf("function busyState()");
  assert.ok(from > 0 && to > from, "checkWorkerTree/startJob moved");
  const text = src.slice(from, to).replace(/^const WORKER_TREE_CHECK = [^\n]*$/m, "");
  return new Function("fs", "path", "spawn", "process", "WORKER_DIR", "PORT", "JOBS", "holdBusy", "console",
    text + "\nreturn { checkWorkerTree, cleanChildEnv, startJob };")(fs, path, spawn, process, WORKER_DIR, PORT, JOBS, holdBusy, c);
}

test("checkWorkerTree, driven: the repository's own tree imports; no tree, or one whose worker.js lacks the export, refuses by name", async () => {
  const real = await buildServerFns({ WORKER_DIR: ROOT.pathname }).checkWorkerTree();
  assert.deepEqual(real, { ok: true }, JSON.stringify(real));
  const none = await buildServerFns({ WORKER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "no-tree-")) }).checkWorkerTree();
  assert.equal(none.ok, false);
  assert.match(none.error, /no Worker tree/);
  // A tree that is THERE and does not answer: the loader and the runner in
  // place, worker.js without the export the runner calls.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "old-tree-"));
  fs.mkdirSync(path.join(dir, "builder"));
  for (const f of ["worker-register.mjs", "worker-loader.mjs", "cloudflare-shim.mjs", "containers-shim.mjs", "container-job.mjs", "container-env.mjs", "job-gateway.mjs"]) {
    fs.copyFileSync(new URL("builder/" + f, ROOT).pathname, path.join(dir, "builder", f));
  }
  fs.writeFileSync(path.join(dir, "worker.js"), "export const nothing = 1;\n");
  const older = await buildServerFns({ WORKER_DIR: dir }).checkWorkerTree();
  assert.equal(older.ok, false, "a tree without runContainerJob read as importing");
  assert.match(older.error, /does not import[\s\S]*no runContainerJob export/);
});

test("startJob, driven: the child runs the real runner out of WORKER_DIR with the launch on stdin, its lines logged, busy held until it ends", async () => {
  const JOBS = new Map();
  const logs = [];
  let held = 0, released = 0;
  const fns = buildServerFns({ WORKER_DIR: ROOT.pathname, PORT: 8080, JOBS, holdBusy: () => { held++; return () => { released++; }; }, console: { log: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")) } });
  const launch = readLaunch(GOOD_LAUNCH());
  const started = fns.startJob(launch, GOOD_LAUNCH());
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.ok(started.pid > 0);
  assert.equal(JOBS.get(ID).state, "running");
  assert.equal(held, 1, "the container is not held busy under a running job");
  const until = Date.now() + 90000;
  while (JOBS.get(ID).state === "running" && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  const j = JOBS.get(ID);
  assert.equal(j.state, "done", JSON.stringify(j) + "\n" + logs.slice(-10).join("\n"));
  assert.equal(j.code, 0);
  assert.equal(released, 1, "busy is not released when the child ends");
  assert.ok(logs.some((l) => l.startsWith("job " + ID + " out: ") && /"started":true/.test(l)), "the child's lines are not logged under the job: " + logs.slice(0, 5).join("\n"));
  assert.ok(logs.some((l) => /not claimed .*no-service-key/.test(l)), "the consumer's own words never reached the log");
  // A launch the runner refuses ends the job as failed (exit 2), busy released.
  const bad = fns.startJob({ id: "bad_launch_1", kind: "edit" }, "not a launch");
  assert.equal(bad.ok, true);
  while (JOBS.get("bad_launch_1").state === "running" && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  assert.equal(JOBS.get("bad_launch_1").state, "failed");
  assert.equal(JOBS.get("bad_launch_1").code, 2);
  assert.equal(released, 2);
});

// ── the flags and the secrets ───────────────────────────────────────────────

test("the runner flags: nothing means nobody, a canary names identities, the second word names everyone", () => {
  assert.equal(jobRunnerOn({}), false);
  assert.equal(jobRunnerOn({ JOB_RUNNER_CANARY: "-" }), false, "the deploy's sentinel reads as nobody");
  assert.equal(jobRunnerOn({ JOB_RUNNER_CANARY: "*" }), false);
  assert.equal(jobRunnerOn({ JOB_RUNNER_CANARY: SLUG }), true);
  assert.equal(jobRunnerOn({ JOB_RUNNER_EVERYONE: "on" }), true);
  assert.equal(jobRunnerOn({ JOB_RUNNER_EVERYONE: "maybe" }), false);
  for (const on of ["1", "true", "on", "yes", " On "]) assert.equal(jobRunnerEveryone({ JOB_RUNNER_EVERYONE: on }), true);
  for (const off of ["off", "0", "", "all", undefined, 1, ["on"]]) assert.equal(jobRunnerEveryone({ JOB_RUNNER_EVERYONE: off }), false);
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: SLUG }, { uid: "x", slug: SLUG }), true);
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: UID }, { uid: UID, slug: "other-1" }), true);
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: SLUG }, { uid: "x", slug: "fretwork-11" }), false, "a prefix is not a match");
  assert.equal(jobRunnerFor({ JOB_RUNNER_EVERYONE: "on" }, { uid: "x", slug: "any-1" }), true);
  assert.equal(jobRunnerFor({ JOB_RUNNER_EVERYONE: "on" }, {}), false, "everyone still needs somebody");
  assert.equal(jobRunnerFor({ JOB_RUNNER_EVERYONE: "on" }, { uid: ["x"], slug: ["y"] }), false, "a shape mistake routes nothing");
  assert.equal(jobRunnerFor({}, { uid: "x", slug: SLUG }), false);
  // THE DEPLOY'S DEFAULTS (stage 5a, 2026-09-06): the canary names ONE SITE —
  // a slug, never an account and never a wildcard — and the broad flag is
  // off, and both are uploaded. RE-ANCHORED: from 2026-09-04 to 2026-09-06
  // the canary's default was `-` (nobody) and this guard held both defaults
  // to "the runner is off for everybody"; the owner's "finish the missing
  // steps" turned the canary on for the test site through the deploy's own
  // fallback (this session cannot set a GitHub secret), so the property now
  // is "one site, through the canary alone" — a default that named two
  // sites, an account, or the broad word would widen a canary, which is the
  // one thing a default may never do.
  const canary = /JOB_RUNNER_CANARY: \$\{\{ secrets\.JOB_RUNNER_CANARY \|\| '([^']*)' \}\}/.exec(YML);
  const everyone = /JOB_RUNNER_EVERYONE: \$\{\{ secrets\.JOB_RUNNER_EVERYONE \|\| '([^']*)' \}\}/.exec(YML);
  assert.ok(canary && everyone, "the deploy does not carry both runner secrets");
  assert.equal(jobRunnerEveryone({ JOB_RUNNER_EVERYONE: everyone[1] }), false, "the shipped default turns the runner on for everyone");
  const named = readCanaryList(canary[1]);
  assert.equal(named.length, 1, "the shipped canary names one site, not " + JSON.stringify(canary[1]));
  assert.ok(!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(named[0]), "the shipped canary names an account, not a site: " + named[0]);
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: canary[1], JOB_RUNNER_EVERYONE: everyone[1] }, { uid: "x", slug: named[0] }), true, "the shipped canary does not reach its own site");
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: canary[1], JOB_RUNNER_EVERYONE: everyone[1] }, { uid: "x", slug: "other-1" }), false, "the shipped defaults route another site through the runner");
  assert.equal(jobRunnerFor({ JOB_RUNNER_CANARY: canary[1], JOB_RUNNER_EVERYONE: everyone[1] }, { uid: "11111111-2222-3333-4444-555555555555", slug: "" }), false, "the shipped defaults route an account through the runner");
  const block = YML.slice(YML.indexOf("secrets: |"), YML.indexOf("\n        env:", YML.indexOf("secrets: |")));
  assert.match(block, /\n\s+JOB_RUNNER_CANARY(?:\n|$)/);
  assert.match(block, /\n\s+JOB_RUNNER_EVERYONE(?:\n|$)/);
  assert.ok(JOB_FIRE_MS >= 30_000 && JOB_FIRE_MS <= 240_000, "the fire's wait is a short call, not a job: " + JOB_FIRE_MS);
  assert.ok(JOB_TOKEN_GRACE_S >= 300, "a token must outlive the job's clock for the finalize");
});

test("the secrets a job carries are the ones the edit path reads — the RPC helper's own reads included — and nothing else", () => {
  // DERIVED: every `env.X` the RPC helper reads must be on the list, or the
  // container's first claim fails as "no-service-key". Found by reading the
  // helper, which refuses without the credit mint secret too.
  const rpc = noComments(WORKER).slice(WORKER.indexOf("async function editRpc("), WORKER.indexOf("\n}\n", WORKER.indexOf("async function editRpc(")));
  const reads = [...rpc.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(reads.length >= 2, "the RPC helper's reads were not found");
  for (const name of reads) assert.ok(JOB_ENV_NAMES.includes(name), "the edit RPCs read env." + name + " and the job is not handed it");
  const svc = noComments(WORKER).slice(WORKER.indexOf("function svcHeaders("), WORKER.indexOf("\n}\n", WORKER.indexOf("function svcHeaders(")));
  for (const m of svc.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)) assert.ok(JOB_ENV_NAMES.includes(m[1]), "svcHeaders reads env." + m[1] + " and the job is not handed it");
  for (const must of ["SUPABASE_SERVICE_KEY", "CREDITS_MINT_SECRET", "XAI_API_KEY", "ANTHROPIC_API_KEY", "FAL_KEY", "NEON_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SITE_SECRETS_KEY"]) {
    assert.ok(JOB_ENV_NAMES.includes(must), must + " is not handed to the job");
  }
  for (const never of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "COMPOSIO_API_KEY", "DOMAIN_CONNECT_KEY", "SITES_BUCKET", "BUILD_QUEUE", "EMAIL"]) {
    assert.ok(!JOB_ENV_NAMES.includes(never), never + " has no business inside the container");
  }
  const env = { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", STRIPE_SECRET_KEY: "sk", XAI_API_KEY: "", FAL_KEY: 42, SITES_BUCKET: {} };
  assert.deepEqual(jobSecrets(env), { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m" }, "an empty, non-string or unlisted value travelled");
});

// ── the fork, driven through the real queue handler ─────────────────────────

function fakeBucket(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { key: k, body: v, size: v.length, async text() { return v; }, async json() { return JSON.parse(v); } }; },
    async put(k, v) { store.set(k, typeof v === "string" ? v : Buffer.from(v).toString("utf8")); return { key: k, etag: "e", size: 1 }; },
    async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list() { return { objects: [], truncated: false }; },
  };
}

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

async function drive({ env, answer = () => new Response(JSON.stringify({ ok: true, id: ID, pid: 7 }), { status: 200, headers: { "content-type": "application/json" } }) }) {
  const worker = await loadWorker();
  const bucket = fakeBucket({ [EDIT_JOB_PREFIX + ID]: JSON.stringify(packEditJob({ url: "https://" + APP_ZONE + "/api/site/edit", body: "{}", uid: UID, slug: SLUG, secret: SECRET, at: Date.now() })) });
  const ns = fakeNamespace(answer);
  const supabase = [];
  const realFetch = globalThis.fetch;
  // THE CLAIM IS ANSWERED (stage 6): the consumer claims the row BEFORE it
  // asks a container, so a stub that refused every claim would fire nothing
  // and prove nothing about the fire. Every other RPC is answered with junk
  // the consumer tolerates, as before.
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    supabase.push(u);
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
    if (/rpc\/edit_claim$/.test(u)) return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: UID, slug: SLUG, needs_review: false, deferrals: 0 });
    return json({ claimed: false, error: "test" });
  };
  let acked = 0;
  try {
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id: ID }, ack() { acked++; } }] },
      { SITES_BUCKET: bucket, SITE_BUILD_CONTAINER: ns, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", STRIPE_SECRET_KEY: "never", ...env }, makeCtx());
  } finally { globalThis.fetch = realFetch; }
  return { bucket, ns, supabase, acked };
}

test("with the canary naming the site, the consumer FIRES the job at the site's lane and does not run it", async () => {
  const { bucket, ns, supabase, acked } = await drive({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: SLUG } });
  assert.equal(ns.calls.length, 1, "the container was not asked to run the job");
  const call = ns.calls[0];
  assert.equal(call.lane, laneName(SLUG), "the job was not fired at the site's own lane");
  assert.equal(call.url, "http://build/job/run");
  assert.equal(call.method, "POST");
  const launch = JSON.parse(call.body);
  assert.equal(launch.v, 1);
  assert.equal(launch.kind, "edit");
  assert.equal(launch.id, ID);
  assert.equal(launch.gateway.url, "https://" + APP_ZONE + "/api/job/" + ID);
  assert.equal(launch.buildPort, 8080);
  // THE TOKEN VERIFIES under the key derived from the platform secret, names
  // this job, its site and its owner, and outlives the job's clock.
  const who = await verifyJobToken(launch.gateway.token, await gatewayKey("platform-secret"), Date.now());
  assert.ok(who, "the minted token does not verify");
  assert.equal(who.id, ID);
  assert.equal(who.slug, SLUG);
  assert.equal(who.uid, UID);
  assert.ok(who.exp * 1000 > Date.now() + EDIT_JOB_MS, "the token expires before the job's clock does");
  assert.ok(who.exp * 1000 <= Date.now() + EDIT_JOB_MS + JOB_TOKEN_GRACE_S * 1000 + 5000, "the token outlives the job by more than its grace");
  // THE SECRETS: the listed ones that are set, and never the rest.
  assert.equal(launch.secrets.SUPABASE_SERVICE_KEY, "svc");
  assert.equal(launch.secrets.CREDITS_MINT_SECRET, "mint");
  assert.equal(launch.secrets.SITE_SECRETS_KEY, "platform-secret");
  assert.equal("STRIPE_SECRET_KEY" in launch.secrets, false, "a Stripe key travelled into the container");
  // THE CONSUMER CLAIMED THE ROW FIRST AND HANDED THE LEASE ON (stage 6):
  // ONE claim, before the container was asked, its owner's name in the
  // launch for the runner to take the lease over from — and it did NOT run
  // the job itself: no replay, no finalize, no refund, and the stored request
  // still there for the runner to read and delete.
  assert.deepEqual(supabase.map((u) => (u.match(/rpc\/(\w+)$/) || [])[1]), ["edit_claim"], "the consumer did more than claim before firing");
  assert.match(String(launch.holder || ""), /^c_[A-Za-z0-9_-]{4,}$/, "the launch does not carry the consumer's lease name for the runner to take over");
  assert.equal(bucket.store.has(EDIT_JOB_PREFIX + ID), true, "the job object was deleted before the runner could read it");
  assert.equal(acked, 1);
});

test("with the claim refused for the site being busy, nothing is fired: the message is re-sent with a delay instead (stage 6)", async () => {
  const worker = await loadWorker();
  const bucket = fakeBucket({ [EDIT_JOB_PREFIX + ID]: JSON.stringify(packEditJob({ url: "https://" + APP_ZONE + "/api/site/edit", body: "{}", uid: UID, slug: SLUG, secret: SECRET, at: Date.now() })) });
  const ns = fakeNamespace(() => new Response(JSON.stringify({ ok: true, id: ID, pid: 7 }), { status: 200 }));
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(JSON.stringify(/rpc\/edit_claim$/.test(String(url))
    ? { ok: true, claimed: false, error: "site-busy", gave_up: false, other: "e_other", deferrals: 3, state: "queued" }
    : { ok: false, error: "unexpected" }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id: ID }, ack() {} }] },
      { SITES_BUCKET: bucket, SITE_BUILD_CONTAINER: ns, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on",
        BUILD_QUEUE: { async send(msg, opts) { sent.push({ msg, opts }); } } }, makeCtx());
  } finally { globalThis.fetch = realFetch; }
  assert.equal(ns.calls.length, 0, "a busy site was fired at a container");
  assert.deepEqual(sent.map((s) => s.msg), [{ kind: EDIT_JOB_KIND, id: ID }], "the message was not re-sent");
  assert.ok(sent[0].opts && sent[0].opts.delaySeconds > 0, "the re-send carries no delay");
});

test("with the flags off, nothing is fired and the consumer runs the job itself — byte for byte the old path", async () => {
  const { ns, supabase, acked } = await drive({ env: { SITE_SECRETS_KEY: "platform-secret" } });
  assert.equal(ns.calls.length, 0, "the container was asked with the runner off");
  assert.ok(supabase.some((u) => /rpc\/edit_claim/.test(u)), "the inline consumer did not claim the job");
  assert.equal(acked, 1);
});

// THE INLINE RUN IS UNDER THE CLAIM THE CONSUMER ALREADY MADE (stage 6): one
// `edit_claim` for the whole job, and the run itself is what comes after it
// (the replay's own RPCs — finalize, refund — under the same lease), never a
// second claim, which would answer `leased` against our own lease and stop.
const claims = (urls) => urls.filter((u) => /rpc\/edit_claim$/.test(u)).length;
const ran = (urls) => urls.some((u) => /rpc\/edit_(finalize|refund)$/.test(u));

test("a container without the endpoint (an older image), or refusing, is the inline path", async () => {
  for (const [status, body] of [[404, "nf"], [429, JSON.stringify({ ok: false, error: "too many jobs on this container" })], [500, JSON.stringify({ ok: false })], [200, JSON.stringify({ ok: false, error: "x" })]]) {
    const { ns, supabase } = await drive({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: SLUG }, answer: () => new Response(body, { status }) });
    assert.equal(ns.calls.length, 1, "no fire on " + status);
    assert.equal(claims(supabase), 1, "on " + status + " the consumer claimed " + claims(supabase) + " times");
    assert.ok(ran(supabase), "on " + status + " the consumer did not run the job itself");
  }
});

test("the canary naming another identity, or no secrets key to mint with, is the inline path with nothing fired", async () => {
  const other = await drive({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: "other-1" } });
  assert.equal(other.ns.calls.length, 0);
  assert.equal(claims(other.supabase), 1);
  assert.ok(ran(other.supabase));
  const noKey = await drive({ env: { JOB_RUNNER_CANARY: SLUG } });
  assert.equal(noKey.ns.calls.length, 0, "a job was fired with no key to open the gateway");
  assert.equal(claims(noKey.supabase), 1);
  assert.ok(ran(noKey.supabase));
  // EVERYONE fires for a site the canary never named — after the one claim.
  const everyone = await drive({ env: { SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_EVERYONE: "on" } });
  assert.equal(everyone.ns.calls.length, 1);
  assert.equal(claims(everyone.supabase), 1);
  assert.equal(ran(everyone.supabase), false, "a fired job was also run inline");
});

test("the fire waits for room and shares one clock across its attempts, read off the Worker", () => {
  const src = noComments(WORKER);
  const fn = src.slice(src.indexOf("async function fireContainerJob("), src.indexOf("\n}\n", src.indexOf("async function fireContainerJob(")));
  assert.ok(fn.length > 500, "fireContainerJob moved");
  assert.match(fn, /if \(!jobRunnerOn\(env\)\) return \{ fired: false, why: "off" \};/, "an off platform must not pay a read");
  assert.match(fn, /await withRoom\(async \(\) =>/, "the fire does not wait for room");
  assert.match(fn, /deadline, floorMs: 0/);
  assert.match(fn, /signal: AbortSignal\.timeout\(Math\.max\(1000, deadline - Date\.now\(\)\)\)/, "an attempt is not bounded by what is left");
  assert.match(fn, /if \(out\.room\) return \{ fired: false, why: "room:" \+ out\.room\.kind \};/);
  assert.doesNotMatch(fn, /SITES_BUCKET\.delete\(/, "the fire deletes the job object the runner must read");
  // The queue handler falls back for every non-fired answer but says nothing for "off".
  const q = src.slice(src.indexOf("async queue(batch, env, ctx)"), src.indexOf("async function runQueuedSiteBuild("));
  // RE-ANCHORED 2026-09-05 (stage 6): the consumer claims before it fires,
  // the launch carries its lease name, and the inline run is under that lease.
  assert.match(q, /fire = await fireContainerJob\(env, edit\.id, \{ holder: owner \}\);/);
  assert.match(q, /if \(fire\.fired\)[\s\S]*?else \{[\s\S]*?await runQueuedSiteEdit\(env, ctx, edit\.id, \{ lease: owner, claim \}\);/);
  // And the export the runner calls dispatches to the three consumers, the
  // edit under a takeover from the launch's holder.
  const ex = src.slice(src.indexOf("export async function runContainerJob("), src.indexOf("\n}\n", src.indexOf("export async function runContainerJob(")));
  assert.match(ex, /kind === "edit"\) return runQueuedSiteEdit\(env, ctx, id, \{ takeOver: /);
  assert.match(ex, /kind === "build"\) return runQueuedSiteBuild\(env, ctx, id\)/);
  assert.match(ex, /kind === "resume"\) return runResumedSiteBuild\(env, ctx, id\)/);
});

// ── the gateway mount ───────────────────────────────────────────────────────

test("the gateway answers on the app zone for a job's own key, refuses without a token, and is not mounted on a site's host", async () => {
  const worker = await loadWorker();
  const bucket = fakeBucket({ ["sites/" + SLUG + "/index.html"]: "<h1>hi</h1>", "sites/other-1/index.html": "theirs" });
  const env = { SITES_BUCKET: bucket, SITE_SECRETS_KEY: "platform-secret" };
  const token = await signJobToken({ id: ID, slug: SLUG, uid: UID, exp: Math.floor(Date.now() / 1000) + 600 }, await gatewayKey("platform-secret"));
  const hit = (host, key, auth) => worker.fetch(new Request("https://" + host + "/api/job/" + ID + "/r2?key=" + encodeURIComponent(key), { headers: auth ? { authorization: "Bearer " + auth } : {} }), env, makeCtx());
  const ok = await hit(APP_ZONE, "sites/" + SLUG + "/index.html", token);
  const okText = await ok.text();
  assert.equal(ok.status, 200, okText);
  assert.equal(okText, "<h1>hi</h1>");
  assert.equal((await hit(APP_ZONE, "sites/" + SLUG + "/index.html", null)).status, 401);
  assert.equal((await hit(APP_ZONE, "sites/other-1/index.html", token)).status, 403, "another site's key was served");
  assert.equal((await hit(APP_ZONE, "sites/" + SLUG + "/missing.html", token)).status, 404);
  // A token minted under another platform secret does not open this one.
  const foreign = await signJobToken({ id: ID, slug: SLUG, uid: UID, exp: Math.floor(Date.now() / 1000) + 600 }, await gatewayKey("another"));
  assert.equal((await hit(APP_ZONE, "sites/" + SLUG + "/index.html", foreign)).status, 401);
  // Not on a site's own host: the mount is the app zone's alone.
  const onSite = await hit(SLUG + ".gofarther.app", "sites/" + SLUG + "/index.html", token);
  assert.notEqual(onSite.status, 200, "the gateway answered on a site's host");
  // With no secrets key on the Worker there is no gateway at all, whatever the token.
  const bare = await worker.fetch(new Request("https://" + APP_ZONE + "/api/job/" + ID + "/r2?key=x", { headers: { authorization: "Bearer " + token } }), { SITES_BUCKET: bucket }, makeCtx());
  assert.equal(bare.status, 401);
});
