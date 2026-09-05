// THE JOB RUNNER — the Worker's queue consumer, executed inside the site's
// container.
//
// ── WHAT THIS PROCESS IS (2026-09-04) ────────────────────────────────────────
//
// `build-server.mjs` spawns it for `POST /job/run` with a CLEAN environment and
// the launch payload on stdin: which job, where the gateway is, the token that
// opens it, and the string secrets the job's code reads off `env`. It builds
// the Worker's `env` (container-env.mjs), imports the Worker's own module under
// the loader (worker-loader.mjs, registered by the `--import` this process is
// started with), and runs the same consumer function the Worker's queue handler
// runs — `runQueuedSiteEdit` for an edit or an addon — to the end: the claim,
// the replay of the customer's request through the real route, every model
// call, the compile on the build service next door, the publish through the
// gateway, the finalize. Then it drains `ctx.waitUntil`, prints one JSON line
// with the outcome, and exits. The Worker's consumer fired it and returned
// seconds ago; the poll route reads the stored reply as it always has.
//
// ── SECRETS ON STDIN, NEVER IN THE ENVIRONMENT ──────────────────────────────
//
// build-keys.mjs is the rule: the container executes model-written page code
// in a child, and children inherit the environment. The payload arrives on a
// pipe this process alone reads, lives in this process's memory for the job's
// length, and is handed to nothing — this process spawns nothing; the build
// service does the spawning, from its own scrubbed environment. The one value
// written into `process.env` is the build service's port, which is not a
// secret and which the container shim reads to find it.
//
// ── ONE LINE OUT, WHATEVER HAPPENS ──────────────────────────────────────────
//
// stdout is the build service's log of this job: `{"job":…,"done":true}` or
// `{"job":…,"done":false,"error":…}`, and the exit code says the same. A throw
// anywhere is caught and named; the consumer function catches its own and
// refunds, so a non-zero exit here is the runtime failing, not the edit.

import { readFileSync } from "node:fs";
import { makeContainerEnv, makeContainerCtx } from "./container-env.mjs";

/** The launch payload, checked. Throws on anything this runner cannot run. */
export function readLaunch(raw) {
  let p = null;
  try { p = JSON.parse(String(raw || "")); } catch { throw new Error("launch payload is not JSON"); }
  if (!p || typeof p !== "object" || p.v !== 1) throw new Error("launch payload is not v1");
  const kind = String(p.kind || "");
  if (!["edit", "build", "resume"].includes(kind)) throw new Error("launch kind " + JSON.stringify(p.kind) + " is not one this runner runs");
  const id = String(p.id || "");
  if (!/^[a-z0-9][a-z0-9_-]{3,80}$/i.test(id)) throw new Error("launch has no job id");
  const g = p.gateway;
  if (!g || typeof g !== "object" || typeof g.url !== "string" || !/^https?:\/\//.test(g.url) || typeof g.token !== "string" || !g.token) {
    throw new Error("launch has no usable gateway");
  }
  const secrets = {};
  for (const [k, v] of Object.entries(p.secrets && typeof p.secrets === "object" ? p.secrets : {})) if (typeof v === "string") secrets[k] = v;
  const buildPort = Number(p.buildPort) || 8080;
  // THE LEASE'S HOLDER (stage 6): the Worker's consumer claims the row before
  // it fires, so the site's lock has answered before a container is asked,
  // and the runner takes the lease over from that name. Optional — a launch
  // without one is the runner claiming fresh, as it did before — and held to
  // the shape a minted owner has, because it reaches an RPC's WHERE.
  const holder = typeof p.holder === "string" && /^[A-Za-z0-9_:-]{4,80}$/.test(p.holder) ? p.holder : "";
  return { kind, id, gateway: { url: g.url, token: g.token }, secrets, buildPort, ...(holder ? { holder } : {}) };
}

/**
 * Run one job. `importWorker` answers the Worker module (the real one under
 * the loader; a fake in tests); `env`/`ctx` may be handed in for a test.
 * Answers `{ ok, kind, id, ms, error? }` and never throws.
 */
export async function runJob(launch, { importWorker, env, ctx, log = () => {} } = {}) {
  const at = Date.now();
  const { kind, id } = launch;
  try {
    const jobEnv = env || makeContainerEnv({ secrets: launch.secrets, gateway: launch.gateway });
    const jobCtx = ctx || makeContainerCtx();
    const worker = await importWorker();
    if (!worker || typeof worker.runContainerJob !== "function") throw new Error("the Worker module has no runContainerJob export — the image's Worker tree is older than this runner");
    log({ job: id, kind, started: true, ...(launch.holder ? { holder: launch.holder } : {}) });
    await worker.runContainerJob(jobEnv, jobCtx, { kind, id, ...(launch.holder ? { holder: launch.holder } : {}) });
    if (typeof jobCtx.drain === "function") await jobCtx.drain();
    return { ok: true, kind, id, ms: Date.now() - at };
  } catch (e) {
    return { ok: false, kind, id, ms: Date.now() - at, error: String((e && e.stack) || (e && e.message) || e).slice(0, 2000) };
  }
}

/**
 * DOES THE TREE THIS RUNNER SITS IN IMPORT? `--check` answers without a
 * launch: the Worker module imported under the loader and the export this
 * runner calls looked for — the build service asks it once at startup and
 * refuses every launch while the answer is no (its `checkWorkerTree`). Here
 * rather than as a script the build service hands `node -e`, because that
 * service may not carry an `import(` of any kind in its own source — the
 * render boundary's guard — and the tree's own runner is the honest place to
 * ask whether the tree runs. Answers `{ ok, error? }`; never throws.
 */
export async function checkTree(importWorker) {
  try {
    const w = await importWorker();
    if (!w || typeof w.runContainerJob !== "function") return { ok: false, error: "no runContainerJob export" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.stack) || (e && e.message) || e).slice(0, 2000) };
  }
}

const isMain = process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href;
if (isMain && process.argv[2] === "--check") {
  const c = await checkTree(() => import("../worker.js"));
  process.stdout.write((c.ok ? "ok" : "the Worker tree does not import: " + c.error) + "\n");
  process.exit(c.ok ? 0 : 1);
}
if (isMain) {
  let launch;
  try {
    launch = readLaunch(readFileSync(0, "utf8"));
  } catch (e) {
    process.stdout.write(JSON.stringify({ done: false, error: String((e && e.message) || e) }) + "\n");
    process.exit(2);
  }
  // The build service's port, for the container shim — the one environment
  // write this process makes, and it is a number, not a secret.
  process.env.JOB_BUILD_PORT = String(launch.buildPort);
  const out = await runJob(launch, {
    importWorker: () => import("../worker.js"),
    log: (line) => process.stdout.write(JSON.stringify(line) + "\n"),
  });
  process.stdout.write(JSON.stringify({ job: out.id, kind: out.kind, done: out.ok, ms: out.ms, ...(out.error ? { error: out.error } : {}) }) + "\n");
  process.exit(out.ok ? 0 : 1);
}
