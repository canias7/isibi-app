// PARKED (2026-11-03, park-old-way): the old-way half of test/build-parallel-route.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// RUN 117's TWO GAPS, THROUGH THE REAL ROUTES (2026-10-14).
//
// Run 117 (the one approved image-free Build test) published for 10 credits
// but showed no parallel work and no reconnect. Two causes, both verified:
//
//   1. THE BUILD RUNS IN THE CONTAINER, AND THE CONTAINER DID NOT HAVE THE
//      DOORS. Since 2026-09-14 (`JOB_RUNNER_EVERYONE` on) a first build is a
//      container job whose env is `jobSecrets(env)` (`JOB_ENV_NAMES`). The
//      design split, the design graph and the band split are each asked
//      there, and none of their names was carried — so every door read shut
//      while the Worker's runtime route read them open. And in the job the
//      queue is a refusal, so `canFire` is false and the band split answered
//      `sync`: the page was one call even with the door open.
//   2. A BUILD SENT WITH ITS OWN NAME WAS NEVER LISTED, and the press read
//      the build before it ended. The press's connection was reset at about
//      285 s with no answer and no job; `liveBuildStart` listed only builds
//      with no slug, so nothing could find the job; the press then read the
//      source and the trace of a build still running.
//
// Each group drives the real code: the build route with supplied model
// answers in the env a container job is really handed; the listing route over
// the real bucket keys; the press's own `runBuildCheck` over a stub network.

import test from "node:test";
import assert from "node:assert/strict";
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER, buildBucket } from "../../../test/fixtures/build-route.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { blockedFetch } from "../../../test/fixtures/no-network.mjs";
import { jobSecrets, JOB_ENV_NAMES, designSplitFor, designGraphFor, bandSplitFor, bandSplitEveryone, designSplitEveryone, designGraphEveryone } from "../../../builder/edit-job.mjs";
import { buildLiveKey, buildChatKey, readBuildLive, packBuildLive, isAttempt, jobTagOf } from "../../../builder/build-live.mjs";
import { resultKey, packResult } from "../../../builder/build-job.mjs";
import { runBuildCheck, attemptMatch, traceAttribution, newAttempt, buildClosureVerdict, BUILD_CHECK_NO_IMAGES, sourceAttribution, buildFlagsVerdict as flagsOf } from "../../../scripts/canary-build.mjs";

const quiet = async (fn) => { const e = console.error, l = console.log; console.error = () => {}; console.log = () => {}; try { return await fn(); } finally { console.error = e; console.log = l; } };

// ── 1. ROUTE SELECTION, IN THE ENV A CONTAINER JOB IS HANDED ─────────────────

/** A page plan with five sections — enough lines for the band split (MIN_BANDS 2 after the chrome). */
const WIDE = Object.freeze({ ...GOOD_DESIGN, shape: [{ path: "/", sections: ["site-chrome — header", "hero — the counter", "boards — what we make", "order — how to order", "visit — hours and address"] }] });
/** The Worker's own env with the account on every parallel door, and the runner on for everyone. */
const WORKER_ENV = Object.freeze({ DESIGN_GRAPH_CANARY: BUILD_USER.id, DESIGN_SPLIT_CANARY: BUILD_USER.id, BAND_SPLIT_CANARY: BUILD_USER.id, JOB_RUNNER_EVERYONE: "on", ANTHROPIC_API_KEY: "k" });

/**
 * THE CONTAINER'S OWN BUILD SERVICE, as the job reaches it on localhost
 * (`makeContainerEnv` marks the namespace `local`): `/model/start` takes a
 * list and answers an id, `/model/result` answers the list's answers, `/model`
 * is the one-at-a-time call. Every hop is recorded with its order.
 */
function localService({ start = "ok", result = "done" } = {}) {
  const hops = [];
  const box = {
    fetch: async (req) => {
      const u = new URL(req.url);
      let b = {};
      try { b = JSON.parse(await req.text()); } catch { b = {}; }
      hops.push({ path: u.pathname, n: Array.isArray(b.reqs) ? b.reqs.length : b.req ? 1 : 0, list: Array.isArray(b.reqs) });
      if (u.pathname === "/model/start") return start === "ok" ? new Response(JSON.stringify({ ok: true, id: "g1" })) : new Response(JSON.stringify({ ok: false, error: "too many" }), { status: 429 });
      if (u.pathname === "/model/result") return new Response(JSON.stringify(result === "done" ? { ok: true, state: "done", answers: [] } : { ok: true, state: result }));
      return new Response(JSON.stringify({ ok: false, message: "stop here", kind: "Error" }));
    },
  };
  return { hops, binding: { local: true, idFromName: (n) => n, get: () => box } };
}

/** One first build through the real route, the trace row captured as it is written. */
async function buildIn(env, design = WIDE, body = {}) {
  let last = null;
  const order = [];
  const onFetch = async (url, init) => {
    if (url.includes("/v1/messages")) { try { const b = JSON.parse(String((init && init.body) || "{}")); order.push((b.tool_choice && b.tool_choice.name) || "?"); } catch { /* recorded below */ } }
    if (url.includes("/rest/v1/site_builds") && init && init.body) { try { const b = JSON.parse(init.body); last = Array.isArray(b) ? b[0] : b; } catch { /* not a row */ } }
    return null;
  };
  const r = await quiet(() => driveBuild({ design: { input: design }, body: { brief: BRIEF, images: [], qa: [], chat: "c", ...body }, env, onFetch }));
  const steps = (last && last.steps) || [];
  return { r, steps, order, mark: (name) => steps.find((s) => s.s === name), bands: steps.filter((s) => String(s.s).startsWith("bands")) };
}

test("PR 1 — THE BUILD AS A CONTAINER JOB RUNS IT: with the account on the doors, the job's own env opens the design graph (15 agents since the kit menu left, 2026-10-23) and the page is written as bands through one local fan-out, the design before any page call", async () => {
  const svc = localService();
  const b = await buildIn({ ...jobSecrets(WORKER_ENV), SITE_BUILD_CONTAINER: svc.binding });
  const d = b.mark("design");
  assert.ok(d && d.graph === 15 && d.agents === 15, "the design was not the graph: " + JSON.stringify(d));
  assert.equal(b.order.filter((t) => t === "design_schema").length, 15, "the design was not fifteen agent calls (the `components` agent left with the kit menu, 2026-10-23)");
  assert.deepEqual(b.bands.map((s) => s.s), ["bands"], "the page was not split into bands: " + JSON.stringify(b.bands));
  assert.equal(b.bands[0].bands, 5, "every planned section is a band");
  const starts = svc.hops.filter((h) => h.path === "/model/start");
  assert.equal(starts.length, 1, "the bands did not go out as ONE fan-out");
  assert.equal(starts[0].n, 5 + 2, "the fan-out did not carry every band, the header and the footer at once (the frame is model-written since 2026-10-23)");
  // DEPENDENT WORK WAITS: every design call precedes the first page call.
  assert.ok(svc.hops.length && b.order.every((t) => t === "design_schema"), "a page call went out beside the design");
  const at = (n) => b.steps.findIndex((s) => s.s === n);
  assert.ok(at("design") < at("gen") && at("gen") < at("bands"), "the page was written before its design");
});

test("PR 2 — THE REPRODUCTION, KEPT: the same build with the job env as it was before this fix (no door names carried) designs in one call and records bands:sync — exactly run 117's trace", async () => {
  const before = Object.fromEntries(Object.entries(jobSecrets(WORKER_ENV)).filter(([k]) => !/^(DESIGN|BAND)_/.test(k)));
  const svc = localService();
  const old = await buildIn({ ...before, SITE_BUILD_CONTAINER: { idFromName: svc.binding.idFromName, get: svc.binding.get } });
  assert.ok(!old.mark("design").graph && !old.mark("design").waves, "a door was open with no name carried");
  assert.equal(old.order.filter((t) => t === "design_schema").length, 1);
  assert.deepEqual(old.bands.map((s) => s.s), ["bands:sync"]);
  assert.equal(svc.hops.filter((h) => h.path === "/model/start").length, 0);
});

test("PR 4 — LEGITIMATELY SEQUENTIAL WORK STAYS SEQUENTIAL, and says why: a thin plan (one band) is one call with the door open (bands:thin); doors shut for the account is one design call — neither is a defect, and neither fans out", async () => {
  const thin = { ...GOOD_DESIGN, shape: [{ path: "/", sections: ["hero — loaves"] }] };
  const svc = localService();
  const t = await buildIn({ ...jobSecrets(WORKER_ENV), SITE_BUILD_CONTAINER: svc.binding }, thin);
  assert.deepEqual(t.bands.map((s) => s.s), ["bands:thin"], JSON.stringify(t.bands));
  assert.equal(svc.hops.filter((h) => h.path === "/model/start" && h.list).length, 0, "a one-band page fanned out");
  // ONE CALL, STARTED AND POLLED (2026-10-18, the Harbour Loaf build): never
  // held as one long synchronous hop, which Node cuts at 300 seconds.
  assert.ok(svc.hops.some((h) => h.path === "/model/start" && !h.list && h.n === 1), "the one call was not started and polled: " + JSON.stringify(svc.hops));
  assert.equal(svc.hops.filter((h) => h.path === "/model").length, 0, "the one call was held as a synchronous hop");
  const svc2 = localService();
  const shut = await buildIn({ ...jobSecrets({ JOB_RUNNER_EVERYONE: "on" }), SITE_BUILD_CONTAINER: svc2.binding });
  assert.equal(shut.order.filter((x) => x === "design_schema").length, 1, "a design fanned out with every door shut");
  assert.deepEqual(shut.bands.map((s) => s.s), ["bands:door"], "the shut door was not named: " + JSON.stringify(shut.bands));
});

test("PR 5 — A LOCAL FAN-OUT THAT CANNOT START, OR THAT THE CONTAINER FORGOT, FALLS BACK TO THE ONE CALL (bands:nofanout) — the page is still written, never failed by the split", async () => {
  for (const [start, result] of [["refused", "done"], ["ok", "unknown"]]) {
    const svc = localService({ start, result });
    const b = await buildIn({ ...jobSecrets(WORKER_ENV), SITE_BUILD_CONTAINER: svc.binding });
    assert.deepEqual(b.bands.map((s) => s.s), ["bands:nofanout"], `${start}/${result}: ${JSON.stringify(b.bands)}`);
    assert.ok(svc.hops.some((h) => h.path === "/model" && h.n === 1), `${start}/${result}: no single call after the fallback`);
  }
});

test("PR 6 — ON THE WORKER NOTHING CHANGES: with no local service and no queue the page is the one call it always was (bands:sync), the design doors still answer there", async () => {
  const b = await buildIn({ ...WORKER_ENV });
  assert.deepEqual(b.bands.map((s) => s.s), ["bands:sync"]);
  assert.equal(b.mark("design").graph, 15, "the Worker's own build lost its design graph");
});

// ── 2. A NAMED SEND IS LISTED, BY ITS OWN ATTEMPT ─────────────────────────────

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
function stand(rows = {}) {
  return async (input, init) => {
    const u = String((input && input.url) || input || "");
    const h = (init && init.headers) || {};
    const auth = String(h.Authorization || h.authorization || "");
    if (u.includes("/auth/v1/user")) return /Bearer t/.test(auth) ? json(BUILD_USER) : json({ msg: "no" }, 401);
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      if (m[1] === "edit_create") return json({ ok: true, job: args.p_id, duplicate: false });
      if (m[1] === "edit_get") return json(Object.hasOwn(rows, args.p_id) ? { ok: true, ...rows[args.p_id] } : { ok: false, error: "no-job" });
      return json({ ok: true });
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
}
const queue = () => ({ sent: [], async send(m) { this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } });
const ENV = (b, q) => ({ SITES_BUCKET: b, BUILD_QUEUE: q, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m" });

/** A build POST left waiting as a dropped connection leaves it: filed and queued; the case answers it later. */
async function send(b, q, body) {
  globalThis.fetch = stand();
  const worker = await loadWorker();
  const before = q.sent.length;
  const answer = (async () => {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ brief: BRIEF, images: [], picker: "sonnet", qa: [], ...body }),
    }), ENV(b, q), makeCtx());
    return { status: res.status };
  })();
  for (let i = 0; i < 400 && q.sent.length === before; i++) {
    if (await Promise.race([answer.then(() => true), new Promise((r) => setImmediate(() => r(false)))])) break;
  }
  globalThis.fetch = blockedFetch;
  return { answer, job: q.sent.length > before ? q.sent[q.sent.length - 1].id : "" };
}
async function list(b, q, rows) {
  globalThis.fetch = stand(rows);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/builds", { headers: { Authorization: "Bearer t" } }), ENV(b, q), ctx);
    await Promise.allSettled(ctx.pending);
    return await res.json();
  } finally { globalThis.fetch = blockedFetch; }
}
const end = async (b, s) => { b.store.set(resultKey(s.job), JSON.stringify(packResult({ status: 409, body: JSON.stringify({ ok: false, error: "ended by the test" }), uid: BUILD_USER.id }))); await s.answer; };

// ── 3. THE PRESS: A LOST ANSWER, RECONCILED BY ITS OWN ATTEMPT ────────────────

const JOB = "c".repeat(32), OTHER_JOB = "d".repeat(32), SLUG = BUILD_CHECK_NO_IMAGES.slug;
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const ATT = "bc-" + "e".repeat(32);
// THE PUBLISH MARK CARRIES THE JOB'S TAG (worker.js's `pages` mark, `jobTagOf`), as a build now writes it.
const tagFor = (steps, job) => steps.map((x) => (x.s === "pages" ? { ...x, jobTag: jobTagOf(job) } : x));
const TRACE0 = [{ s: "auth" }, { s: "design", in: 1, out: 1, graph: 16, agents: 16, agentMs: 90_000, waveMs: 40_000 }, { s: "provision" }, { s: "gen" }, { s: "bands", bands: 4, wrote: 4, agentMs: 80_000, waveMs: 30_000 }, { s: "fonts" }, { s: "img" }, { s: "compile" }, { s: "container" }, { s: "og" }, { s: "pages" }];
const TRACE = tagFor(TRACE0, "c".repeat(32));
const VER = "01790600000000-abc123";
/** `/api/site/source?job=` as the route answers it: the version whose manifest names the job, live when the pointer names it. */
const byJob = (io) => async function (t, slug, job) { const r = await this.source(t, slug); return r && r.status === 200 ? { status: 200, json: { ...r.json, ok: true, slug, job, version: VER, live: { version: VER, job } } } : r; };
const SRC = { reads: { pages: true, parts: true, assets: true }, pages: [{ path: "src/routes/index.tsx", source: 'import { Hero } from "@/components/ui/hero";\nexport const Route = createFileRoute("/")({});' }], parts: [] };
const rows = (list) => ({ ok: true, complete: true, rows: list.map((r, i) => ({ id: 467 + i, ...r })) });

/** The press's whole network, offline: the send's answer is lost (`status 0`), the build carries on. */
// THE BUILD'S ONE LINE, kept on its final answer and in the list (2026-10-15).
const LINE0 = { n: 0, ms: 1000, text: "I'm laying out your cheese counter's page." };
function pressNet(over = {}, { moved = 10, last = 469 } = {}) {
  const calls = [];
  let clock = 0, signIns = 0, polled = 0, listed = 0;
  const io = {
    calls,
    attempt: () => ATT,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    log: () => {},
    signIn: async () => { signIns++; return { token: `tok-${signIns}`, uid: UID }; },
    balance: async () => (calls.includes("post") ? 783 - moved : 783),
    ledgerLast: async () => ({ ok: true, id: calls.includes("post") ? last : 466 }),
    existing: async () => ({ backends: { status: 200, rows: [] }, builds: { status: 200, rows: [] }, host: { status: 404 } }),
    // THE RUNNER TAKES BUILDS AND THE ROUTE REPORTS THE JOB'S OWN VIEW (the fixed route).
    runtime: async () => ({ status: 200, json: { imagePurchases: false, design: true, graph: true, bands: true, bandsEveryone: false, runner: true, runnerEveryone: true, jobDesign: true, jobGraph: true, jobBands: true, jobBandsEveryone: false } }),
    post: async (t, body) => { calls.push("post"); calls.push(`post-by:${t}`); assert.equal(body.attempt, ATT); return { status: 0, json: null, why: "ECONNRESET" }; },
    // NOT LISTED YET ON THE FIRST READ, then listed — beside another attempt's newer build for the same name.
    // THE LIST CARRIES THE BUILD'S LINES IN EVERY STATE (2026-10-15).
    builds: async (t) => { calls.push(`builds:${t}`); listed++; return { builds: listed < 2 ? [] : [{ job: OTHER_JOB, attempt: "bc-" + "f".repeat(32), state: "running", at: 9 }, { job: JOB, attempt: ATT, state: polled >= 4 ? "done" : "running", at: 1, progress: [LINE0] }] }; },
    // STILL RUNNING FOR A WHILE, THEN DONE: the connection was lost, the build was not.
    poll: async (t, job) => { calls.push(`poll:${t}:${job}`); polled++; return polled < 4 ? { status: 202, json: { ok: false, pending: true, progress: [LINE0] } } : { status: 200, json: { ok: true, slug: SLUG, progress: [LINE0] } }; },
    trace: async () => ({ steps: TRACE, done: true, ok: true, started_at: "2026-10-14T12:23:43Z" }),
    jobRow: async (job) => ({ id: job, slug: SLUG, op: "build", state: "done", created_at: "2026-10-14T12:21:23Z", updated_at: "2026-10-14T12:29:12Z" }),
    source: async (t) => { calls.push(`source:${t}`); return { status: 200, json: SRC }; },
    sourceJob: byJob(),
    served: async () => ({ status: 200, html: "<main><h1>Saltmarsh</h1></main>" }),
    uploads: async () => ({ ok: true, files: [] }),
    ledgerWindow: async () => rows([{ ref: `build:${JOB}:deposit`, delta: -2 }, { ref: `build:${JOB}:settle`, delta: -4 }, { ref: `build:${JOB}:pages`, delta: -4 }]),
    ...over,
  };
  return io;
}
const NI = { ...BUILD_CHECK_NO_IMAGES, reconcileMs: 60_000 };
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} — ${c.why}`);

// ── 4. THE FREE JUDGE: ONE FINISHED BUILD, BY ITS JOB ID ─────────────────────

const RUN117 = "b6360027c827aa2048dfd199c0a5bc01";
/** Run 117's own stored rows (read 2026-10-14): its job row, its trace's start and steps, its three ledger rows. */
function judgeNet(over = {}) {
  const calls = [];
  return {
    calls,
    signIn: async () => ({ token: "tok-j", uid: UID }),
    jobRow: async (job) => ({ id: job, slug: SLUG, op: "build", state: "done", created_at: "2026-10-14 12:21:23.901643+00", updated_at: "2026-10-14 12:29:12.903168+00" }),
    trace: async () => ({ done: true, ok: true, started_at: "2026-10-14 12:23:43.435254+00", steps: [{ s: "auth" }, { s: "body" }, { s: "gate" }, { s: "design-recovery", attempts: 0 }, { s: "design", in: 17751, out: 821 }, { s: "owner" }, { s: "normalize" }, { s: "provision", db: 0 }, { s: "schema", tables: 0 }, { s: "seed" }, { s: "merge" }, { s: "gen" }, { s: "bands:sync" }, { s: "fonts", beside: 1 }, { s: "img", viaContainer: 1 }, { s: "compile" }, { s: "container" }, { s: "og" }, { s: "pages", credits: 4 }] }),
    source: async (t) => { calls.push(`source:${t}`); return { status: 200, json: SRC }; },
    sourceJob: byJob(),
    ledgerByJob: async (job) => ({ ok: true, rows: [{ id: 467, ref: `build:${job}:deposit`, delta: -2 }, { id: 468, ref: `build:${job}:settle`, delta: -4 }, { id: 469, ref: `build:${job}:pages`, delta: -4 }] }),
    ...over,
  };
}
const { judgeBuild } = await import("../../../scripts/canary-build.mjs");
