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
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER, buildBucket } from "./fixtures/build-route.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { blockedFetch } from "./fixtures/no-network.mjs";
import { jobSecrets, JOB_ENV_NAMES, designSplitFor, designGraphFor, bandSplitFor, bandSplitEveryone, designSplitEveryone, designGraphEveryone } from "../builder/edit-job.mjs";
import { buildLiveKey, buildChatKey, readBuildLive, packBuildLive, isAttempt, jobTagOf } from "../builder/build-live.mjs";
import { resultKey, packResult } from "../builder/build-job.mjs";
import { runBuildCheck, attemptMatch, traceAttribution, newAttempt, buildClosureVerdict, BUILD_CHECK_NO_IMAGES, sourceAttribution, buildFlagsVerdict as flagsOf } from "../scripts/canary-build.mjs";

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
    if (url.includes("/v1/messages")) { try { const b = JSON.parse(String((init && init.body) || "{}")); order.push((b.tool_choice && (b.tool_choice.name || (b.tool_choice.type === "any" && b.tools && b.tools[0] && b.tools[0].name))) || "?"); } catch { /* recorded below */ } }
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

test("PR 3 — EVERY BUILD DOOR ANSWERS THE SAME IN A JOB AS IN THE WORKER, canary and everyone, on and off — derived from the doors themselves, not from a list", () => {
  for (const name of ["DESIGN_SPLIT_CANARY", "DESIGN_SPLIT_EVERYONE", "DESIGN_GRAPH_CANARY", "DESIGN_GRAPH_EVERYONE", "BAND_SPLIT_CANARY", "BAND_SPLIT_EVERYONE"]) {
    assert.ok(JOB_ENV_NAMES.includes(name), name + " is not handed to a job");
  }
  const who = { uid: BUILD_USER.id, slug: "fresh-site-1" };
  const envs = [
    {}, WORKER_ENV,
    { DESIGN_SPLIT_EVERYONE: "on", DESIGN_GRAPH_EVERYONE: "on", BAND_SPLIT_EVERYONE: "on" },
    { DESIGN_GRAPH_CANARY: "someone-else-uid-1", BAND_SPLIT_CANARY: "fresh-site-1", DESIGN_SPLIT_EVERYONE: "off" },
  ];
  for (const env of envs) {
    const job = jobSecrets(env);
    for (const [n, f] of [["design", designSplitFor], ["graph", designGraphFor], ["bands", bandSplitFor]]) {
      assert.equal(f(job, who), f(env, who), `${n} answers ${f(env, who)} in the Worker and ${f(job, who)} in a job for ${JSON.stringify(env)}`);
    }
    for (const [n, f] of [["design", designSplitEveryone], ["graph", designGraphEveryone], ["bands", bandSplitEveryone]]) {
      assert.equal(f(job), f(env), `${n} for everyone differs in a job`);
    }
  }
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

test("PR 7 — A BUILD SENT WITH ITS OWN NAME AND AN ATTEMPT KEY IS LISTED WITH THAT KEY (no chat claimed); a second send of the same name with another key is listed apart — the key, not the name or the time, says which is which", async () => {
  const b = buildBucket();
  const q = queue();
  const mine = "bc-" + "a".repeat(32), theirs = "bc-" + "b".repeat(32);
  const s1 = await quiet(() => send(b, q, { slug: "saltmarsh-test-1", attempt: mine, chat: "site_1791640000000_abcde" }));
  assert.ok(s1.job, "the named send queued no job");
  const marker = readBuildLive(JSON.parse(b.store.get(buildLiveKey(BUILD_USER.id, s1.job))));
  assert.equal(marker.attempt, mine);
  assert.equal(marker.chat, "", "a named send claimed a chat");
  assert.ok(![...b.store.keys()].some((k) => k === buildChatKey(BUILD_USER.id, "site_1791640000000_abcde")), "a named send took a chat's ownership");
  const s2 = await quiet(() => send(b, q, { slug: "saltmarsh-test-1", attempt: theirs }));
  const listed = await quiet(() => list(b, q, { [s1.job]: { state: "running" }, [s2.job]: { state: "running" } }));
  const byAttempt = Object.fromEntries(listed.builds.map((x) => [x.attempt, x.job]));
  assert.deepEqual(byAttempt, { [mine]: s1.job, [theirs]: s2.job });
  assert.deepEqual(attemptMatch(listed, mine), { ok: true, attempt: mine, job: s1.job, state: "running", why: "" });
  assert.equal(q.sent.length, 2, "listing queued something");
  await end(b, s1); await end(b, s2);
});

test("PR 8 — THE ATTEMPT KEY IS READ STRICTLY: a malformed key is never stored, a stored marker with a malformed key is not a marker, and an unnamed browser build still claims its chat exactly as before", async () => {
  for (const bad of ["", "short", "UPPER-CASE-KEY-123456", "has space in it 1234567", "a".repeat(70), 7, null]) assert.equal(isAttempt(bad), false, String(bad));
  assert.equal(isAttempt(newAttempt()), true);
  assert.equal(packBuildLive({ job: "a".repeat(32), uid: BUILD_USER.id, chat: "", at: 1, attempt: "BAD KEY" }).attempt, undefined);
  assert.equal(readBuildLive({ v: 1, job: "a".repeat(32), uid: "u-audit-1", chat: "", words: "", at: 1, attempt: "BAD KEY" }), null);
  const b = buildBucket();
  const q = queue();
  const s = await quiet(() => send(b, q, { chat: "site_1791640000000_abcde" }));
  assert.ok(b.store.has(buildChatKey(BUILD_USER.id, "site_1791640000000_abcde")), "the unnamed build no longer claims its chat");
  assert.equal(readBuildLive(JSON.parse(b.store.get(buildLiveKey(BUILD_USER.id, s.job)))).attempt, "");
  await end(b, s);
});

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

test("PR 9 — CONNECTION LOST, BUILD COMPLETES: the original failure is kept (status 0, ECONNRESET), the fresh session finds THIS send by its attempt key — past another attempt's newer build of the same name — follows it to its end, and only then reads the source; sent once, charges of its own job only", async () => {
  const io = pressNet();
  const rec = await runBuildCheck(io, { spec: NI, spend: true, named: 783 });
  assert.deepEqual(rec.accepted, { status: 0, job: "", stage: undefined, ms: 0, why: "ECONNRESET" }, "the original answer was rewritten");
  assert.equal(rec.reconciled.ok, true);
  assert.equal(rec.reconciled.job, JOB, "the latest listed build was taken, not this send's");
  assert.equal(rec.job, JOB);
  assert.equal(io.calls.filter((c) => c === "post").length, 1, "the build was sent again");
  assert.ok(io.calls.filter((c) => c.startsWith("poll:")).every((c) => c === `poll:tok-2:${JOB}`), "polled another job, or by the sender");
  const lastPoll = io.calls.lastIndexOf(`poll:tok-2:${JOB}`), firstSource = io.calls.indexOf("source:tok-2");
  assert.ok(firstSource > lastPoll, "the source was read before the build ended");
  // THE SEND'S OWN ANSWER IS JUDGED APART FROM THE RECOVERY (2026-10-15): a
  // lost connection is not an answer, even though the build was found.
  assert.deepEqual(failed(rec.checks), ["the send was answered with its job within 60 s — answered 0 with no job after 0 s"]);
  assert.equal(rec.acceptance, "recovered");
  assert.equal(rec.money.net, 10);
  const closure = rec.checks.find((c) => /job is known/.test(c.name));
  assert.match(closure.detail, /answered 0 \(ECONNRESET\), no job; found by attempt bc-e+ as job c{32}/);
});

test("PR 10 — ANOTHER ATTEMPT'S RESULT OR CHARGES NEVER COUNT: the other job's ledger rows are 'other' (the build's own net is its own), another attempt's trace judges nothing, and an ambiguous or missing match is no job at all — never a guess, never a resend", async () => {
  // Another attempt's charges inside the window: explained, but not this build's.
  const mixed = await runBuildCheck(pressNet({
    ledgerWindow: async () => rows([{ ref: `build:${OTHER_JOB}:deposit`, delta: -5 }, { ref: `build:${JOB}:deposit`, delta: -2 }, { ref: `build:${JOB}:settle`, delta: -4 }, { ref: `build:${JOB}:pages`, delta: -4 }]),
  }, { moved: 15, last: 470 }), { spec: NI, spend: true, named: 783 });
  assert.equal(mixed.money.net, 10, "another attempt's charge was counted as this build's");
  assert.equal(mixed.money.other, 5);
  // Another attempt's trace (it started after this job ended): refused, and the overlap judged nothing.
  const foreign = await runBuildCheck(pressNet({ trace: async () => ({ steps: TRACE, done: true, ok: true, started_at: "2026-10-14T13:40:00Z" }) }), { spec: NI, spend: true, named: 783 });
  assert.equal(foreign.traceAttribution.ok, false);
  assert.ok(failed(foreign.checks).some((f) => /trace judged is this build's own/.test(f)));
  assert.ok(failed(foreign.checks).some((f) => /independent build work ran at once/.test(f)), "another attempt's overlap passed this build");
  // Two listed builds carry the key: none is taken; no list at all: none; and the build is never sent again.
  for (const builds of [async () => ({ builds: [{ job: JOB, attempt: ATT, state: "running" }, { job: OTHER_JOB, attempt: ATT, state: "running" }] }), async () => ({ builds: [] }), async () => null]) {
    const io = pressNet({ builds });
    const rec = await runBuildCheck(io, { spec: NI, spend: true, named: 783 });
    assert.equal(rec.reconciled.ok, false);
    assert.equal(rec.job, "");
    assert.equal(io.calls.filter((c) => c === "post").length, 1, "the build was resent");
    assert.ok(!io.calls.some((c) => c.startsWith("poll:")), "a job was followed with no match");
    assert.ok(failed(rec.checks).some((f) => /job is known.*reconciling by attempt/.test(f)));
  }
});

test("PR 11 — THE PIECES, DRIVEN: attemptMatch reads only the key; traceAttribution binds a trace to its job's row by slug and time; the closure keeps the lost answer and passes only on an exact match", () => {
  assert.equal(attemptMatch({ builds: [{ job: JOB, attempt: ATT }] }, "").ok, false);
  assert.equal(attemptMatch({ builds: [{ job: JOB, attempt: ATT.toUpperCase() }] }, ATT).ok, false);
  assert.equal(attemptMatch({ builds: [{ job: "nope", attempt: ATT }] }, ATT).ok, false);
  assert.equal(attemptMatch({ builds: [{ job: JOB, attempt: ATT }, { job: JOB, attempt: ATT }] }, ATT).job, JOB, "the same job listed twice is still one job");
  const row = { id: JOB, slug: SLUG, created_at: "2026-10-14T12:21:23Z", updated_at: "2026-10-14T12:29:12Z" };
  const tr = { started_at: "2026-10-14T12:23:43Z", steps: TRACE };
  const sentAt = Date.parse("2026-10-14T12:21:23Z");
  assert.equal(traceAttribution({ trace: tr, jobRow: row, job: JOB, slug: SLUG, sentAt }).ok, true);
  assert.match(traceAttribution({ trace: tr, jobRow: { ...row, slug: "other-site" }, job: JOB, slug: SLUG, sentAt }).why, /names other-site/);
  assert.match(traceAttribution({ trace: tr, jobRow: { ...row, id: OTHER_JOB }, job: JOB, slug: SLUG, sentAt }).why, /job's own row/);
  assert.match(traceAttribution({ trace: tr, jobRow: row, job: JOB, slug: SLUG, sentAt: sentAt + 3_600_000 }).why, /before this send left/);
  assert.match(traceAttribution({ trace: { started_at: "2026-10-14T11:00:00Z", steps: TRACE }, jobRow: row, job: JOB, slug: SLUG, sentAt }).why, /outside this job's life/);
  assert.match(traceAttribution({ trace: tr, jobRow: row, job: "", slug: SLUG, sentAt }).why, /no job/);
  const good = { senderAfter: [], sender: { token: "a", uid: UID }, fresh: { token: "b", uid: UID }, final: { status: 200, json: { ok: true, slug: SLUG } }, site: 200 };
  const lost = { status: 0, job: "", why: "ECONNRESET" };
  assert.ok(buildClosureVerdict({ ...good, accepted: lost, reconciled: { ok: true, attempt: ATT, job: JOB } })[0].ok);
  const no = buildClosureVerdict({ ...good, accepted: lost, reconciled: { ok: false, attempt: ATT, job: "", why: "no listed build carries this attempt key (0 listed)" } })[0];
  assert.equal(no.ok, false);
  assert.match(no.why, /answered 0 \(ECONNRESET\), no job; reconciling by attempt bc-e+: no listed build/);
  assert.equal(buildClosureVerdict({ ...good, accepted: lost })[0].ok, false, "a lost answer passed with no reconciliation");
});

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
const { judgeBuild } = await import("../scripts/canary-build.mjs");

test("PR 12 — THE FREE JUDGE ON RUN 117'S OWN ROWS: its job is a finished build of the site, its trace is its own, one page within the component limit, its own charges 10 on three rows — and its overlap fails on the real reason (one design call, bands:sync), sending nothing", async () => {
  const io = judgeNet();
  const r = await judgeBuild(io, { spec: BUILD_CHECK_NO_IMAGES, job: RUN117 });
  const by = (re) => r.checks.find((c) => re.test(c.name));
  assert.equal(r.sent, false);
  assert.ok(by(/finished build of this site/).ok);
  // RUN 117'S TRACE CARRIES NO JOB TAG (written before tags): attribution is
  // UNVERIFIED, said as such — never credited by its start time.
  assert.equal(by(/trace judged is this build's own/).ok, false);
  assert.equal(r.traceAttribution.unverified, true);
  assert.match(by(/trace judged is this build's own/).why, /attribution unverified: the trace carries no job tag/);
  assert.ok(by(/source judged is this build's own stored version/).ok, r.sourceAttribution.why);
  assert.ok(by(/front page among them/).ok);
  assert.ok(by(/own charges/).ok);
  assert.equal(r.charges.net, 10);
  assert.equal(by(/independent build work ran at once/).ok, false);
  assert.match(by(/independent build work ran at once/).why, /not judged: trace attribution unverified \(the unbound trace reads: .*design in a single call \(no agents\)/);
  assert.ok(r.unverified.some((u) => /no job tag/.test(u)), "the unverified attribution was not reported");
  assert.equal(r.ok, false, "a build with no overlap was judged a pass");
});

test("PR 13 — THE JUDGE NEVER TAKES ANOTHER BUILD'S RESULT OR CHARGES: no job id, a job of another site or still running, another attempt's trace, another job's ledger rows, and a source beyond the page limit each fail on their own reason", async () => {
  assert.match((await judgeBuild(judgeNet(), { spec: BUILD_CHECK_NO_IMAGES, job: "" })).stopped, /job id/);
  for (const row of [{ slug: "other-site" }, { state: "running" }, { op: "edit" }]) {
    const r = await judgeBuild(judgeNet({ jobRow: async (job) => ({ id: job, slug: SLUG, op: "build", state: "done", created_at: "2026-10-14T12:21:23Z", updated_at: "2026-10-14T12:29:12Z", ...row }) }), { spec: BUILD_CHECK_NO_IMAGES, job: RUN117 });
    assert.equal(r.ok, false, JSON.stringify(row));
    assert.ok(r.stopped, "it judged a build that is not a finished build of this site");
  }
  const foreign = await judgeBuild(judgeNet({ trace: async () => ({ steps: TRACE, started_at: "2026-10-14T14:00:00Z" }) }), { spec: BUILD_CHECK_NO_IMAGES, job: RUN117 });
  assert.equal(foreign.checks.find((c) => /trace judged is this build's own/.test(c.name)).ok, false);
  assert.equal(foreign.checks.find((c) => /independent build work/.test(c.name)).ok, false, "another attempt's overlap was credited");
  const others = await judgeBuild(judgeNet({ ledgerByJob: async () => ({ ok: true, rows: [{ id: 1, ref: `build:${OTHER_JOB}:pages`, delta: -9 }] }) }), { spec: BUILD_CHECK_NO_IMAGES, job: RUN117 });
  assert.match(others.checks.find((c) => /own charges/.test(c.name)).why, /no ledger row carries this job's ref/);
  const twoPages = { ...SRC, pages: [...SRC.pages, { path: "src/routes/menu.tsx", source: "export const Route = 1;" }] };
  const big = await judgeBuild(judgeNet({ source: async () => ({ status: 200, json: twoPages }) }), { spec: BUILD_CHECK_NO_IMAGES, job: RUN117 });
  // NO PAGE LIMIT SINCE 2026-10-24: two pages, the front page among them, pass.
  assert.equal(big.checks.find((c) => /front page among them/.test(c.name)).ok, true);
});

test("PR 14 — THE PRESS READS THE BUILD'S OWN VIEW OF THE DOORS: with the runner taking builds, run 117's runtime answer (Worker design and graph on, the job's view all off) is no mode at all and names both views; with the job's view on it is a mode; an older route with no job view keeps the Worker's answer", async () => {
  const { buildFlagsVerdict } = await import("../scripts/canary-build.mjs");
  const worker = { design: true, graph: true, bands: true, bandsEveryone: false, runner: true, runnerEveryone: true };
  const r117 = buildFlagsVerdict({ status: 200, json: { ...worker, jobDesign: false, jobGraph: false, jobBands: false, jobBandsEveryone: false } });
  assert.equal(r117.ok, false);
  assert.match(r117.why, /as the container job sees it.*the Worker's own view reads design true, graph true/);
  const fixed = buildFlagsVerdict({ status: 200, json: { ...worker, jobDesign: true, jobGraph: true, jobBands: true, jobBandsEveryone: false } });
  assert.deepEqual([fixed.ok, fixed.view, fixed.modes], [true, "as the container job sees it", ["design agents at once", "the design as a graph"]]);
  // A ROUTE THAT DOES NOT REPORT THE JOB'S VIEW, WITH BUILDS IN THE CONTAINER:
  // unverified — the Worker's flags (the evidence that misled run 117) never stand in.
  const old = buildFlagsVerdict({ status: 200, json: worker });
  assert.deepEqual([old.ok, old.unverified, old.modes], [false, true, []]);
  assert.match(old.why, /does not report the job's own settings \(jobDesign, jobGraph, jobBands, jobBandsEveryone not reported\).*unverified — nothing is sent/);
  const noRunner = buildFlagsVerdict({ status: 200, json: { ...worker, runnerEveryone: false, runner: false, jobDesign: false, jobGraph: false, jobBands: false, jobBandsEveryone: false } });
  assert.deepEqual([noRunner.ok, noRunner.view], [true, "as the Worker sees it"], "with the runner off the build runs in the Worker, whose view decides");
});
