// PARKED (2026-11-03, park-old-way): the old-way half of test/build-reconnect.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A FIRST BUILD FOUND AGAIN AFTER A RELOAD OR IN ANOTHER SESSION (2026-10-10,
// the Build browser-reconnection gap).
//
// A first build's POST holds its socket while the build runs; the page learned
// the build's job only when it answered and kept it nowhere. A reload, a closed
// tab or a second device lost the build: its message sat unanswered, its result
// sat uncollected, and the next message in the chat went out as a fresh first
// build. These cases drive the REAL Worker — the build POST (`enqueueSiteBuild`
// with its own wait), the real queue consumer and resume (`fireInterim`,
// `finishResume`), the listing route (`GET /api/site/builds`) and the poll —
// and the REAL browser follow (`reactSend`, `followBuildJob`, the new
// `siteBuildsCheck`) cut out of public/chat.js, fed the bodies the Worker gave.
//
// Covered: a reload while the build runs; a fresh session for the same account
// (no local project at all); a completed build; a failed one (its own answer,
// and the row's verdict); a second POST for the same chat while it runs (no new
// job, row, queue message or charge); a chat whose build ended (a new build is
// allowed); another account (nothing listed, nothing served); a job that could
// not be queued (unlisted); the day's window; signed out.
//
// ⚠ OFFLINE, STAND-IN SERVICES, IMAGES MOCKED: no provider call, no real
// image. Progress lines are the model's own where shown (supplied writer);
// their wording by a real model is not measured here.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { BUSY_SLOTS } from "../../../test/fixtures/busy-slots.mjs";
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "../../../test/fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "../../../test/fixtures/build-lifecycle.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { blockNetwork, blockedFetch, unexpected } from "../../../test/fixtures/no-network.mjs";
import { resultKey, jobKey, packResult, JOB_KIND } from "../../../builder/build-job.mjs";
import { buildLiveKey, buildKeptKey, buildChatKey, buildLiveState, readBuildLive, doneOutcome, markerJobOf, packBuildLive, packBuildChat, packBuildRun, buildRunKey, BUILD_RUN_START_MS, claimVerdict, holdsChat, listsBuild, BUILD_ACCEPT_MS, BUILD_LIVE_MS } from "../../../builder/build-live.mjs";
import { BUILD_JOB_MS } from "../../../builder/build-job.mjs";
import { resumeKey } from "../../../builder/build-resume.mjs";
import { openRecord, appendMark, claimWriter, commitLine, confirmLines, progressKey, packRecord, buildStepFacts } from "../../../builder/site-progress.mjs";

blockNetwork();

const OTHER = { id: "u-other-22", email: "x@example.com" };
const CHAT = "site_1791640000000_abcde";
const BRIEF = "A bakery called Fold Lane on a cobbled street, with our opening hours and a way to order loaves.";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const page = () => "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Fold Lane</h1><p>Opening hours: 7–2.</p></main>); }\n";

/**
 * THE NETWORK FOR THE ROUTES THIS FILE CALLS ITSELF: GoTrue by token (`t` is
 * the build's owner, `other` another account), and the job RPCs, each call
 * kept. `rows` answers `edit_get` per job id (absent: no row).
 */
function stand({ rows = {}, rpc = [] } = {}) {
  return async (input, init) => {
    const u = String((input && input.url) || input || "");
    const h = (init && init.headers) || {};
    const auth = String(h.Authorization || h.authorization || "");
    if (u.includes("/auth/v1/user")) {
      if (/other/.test(auth)) return json(OTHER);
      if (/Bearer t/.test(auth)) return json(BUILD_USER);
      return json({ msg: "no" }, 401);
    }
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      rpc.push({ fn: m[1], args });
      if (m[1] === "edit_create") return json({ ok: true, job: args.p_id, duplicate: false });
      if (m[1] === "edit_get") {
        const row = Object.hasOwn(rows, args.p_id) && args.p_uid === BUILD_USER.id ? rows[args.p_id] : null;
        return json(row ? { ok: true, ...row } : { ok: false, error: "no-job" });
      }
      return json({ ok: true });
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
}
const queue = (fail = false) => ({ sent: [], async send(m) { if (fail) throw new Error("queue down"); this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } });
let PROGRESS = false;
const ENV = (b, q) => ({ SITES_BUCKET: b, BUILD_QUEUE: q, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", ...(PROGRESS ? { PROGRESS_REPLIES: "on" } : {}) });
/**
 * A BUILD'S PROGRESS RECORD WITH ONE LINE THE WRITER COMMITTED AND CONFIRMED,
 * made with the writer's own functions from the build's real design step —
 * the record the poll and the listing read lines from.
 */
function progressFor(b, job, uid, line) {
  let rec = openRecord({ job, uid, slug: GOOD_DESIGN.slug, op: "build", run: "run-1", words: BRIEF, at: 1 });
  rec = appendMark(rec, { stage: "build-design", facts: buildStepFacts({ s: "design" }), at: 2 }).rec;
  rec = claimWriter(rec, "w", 3).rec;
  rec = commitLine(rec, { owner: "w", marks: [0], text: line, now: 4 });
  rec = confirmLines(rec, 1);
  b.store.set(progressKey(job), JSON.stringify(packRecord(rec)));
}
const LINE = "I've designed your bakery's site — its pages, its look and the photographs it will use — and nothing is built yet.";

/** One request through the real router under `net`; the stand-ins go back after. */
async function call(b, q, net, method, path, { token = "t", body } = {}) {
  globalThis.fetch = net;
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev" + path, {
      method, headers: { "content-type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), ENV(b, q), ctx);
    await Promise.allSettled(ctx.pending);
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = blockedFetch; }
}

/**
 * A FIRST BUILD'S POST, LEFT TO WAIT AS THE BROWSER'S SOCKET DOES: it files the
 * build and waits on its answer slot. Returns the POST's pending answer and
 * the job it queued (read off the queue). The case runs the consumer.
 */
async function startBuild(b, q, net, { chat = CHAT, brief = BRIEF, token = "t" } = {}) {
  globalThis.fetch = net;
  const worker = await loadWorker();
  const ctx = makeCtx();
  const before = q.sent.length;
  const answer = (async () => {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ brief, images: [], picker: "sonnet", qa: [], chat }),
    }), ENV(b, q), ctx);
    return { status: res.status, body: await res.json().catch(() => null) };
  })();
  for (let i = 0; i < 400 && q.sent.length === before; i++) {
    const settled = await Promise.race([answer.then(() => true), new Promise((r) => setImmediate(() => r(false)))]);
    if (settled) break;
  }
  globalThis.fetch = blockedFetch;
  return { answer, job: q.sent.length > before ? q.sent[q.sent.length - 1].id : "" };
}
const keysUnder = (b, p) => [...b.store.keys()].filter((k) => k.startsWith(p));
/** A POST this case does not follow further: its wait is answered, so nothing is left waiting when the case ends. */
async function settlePost(b, s, uid = BUILD_USER.id) {
  b.store.set(resultKey(s.job), JSON.stringify(packResult({ status: 409, body: JSON.stringify({ ok: false, error: "ended by the test" }), uid })));
  await s.answer;
}

test("RC 1 — A RELOAD WHILE THE BUILD RUNS: the build POST lists the build on its account (its chat and words); the page that sent it is gone, and the listing hands the running build back — no second POST, no second job, no charge", async () => {
  const b = buildBucket();
  const q = queue();
  const rpc = [];
  const net = stand({ rpc });
  const { answer, job } = await startBuild(b, q, net);
  assert.ok(job, "the POST queued no job");
  const marker = readBuildLive(JSON.parse(b.store.get(buildLiveKey(BUILD_USER.id, job))));
  assert.deepEqual({ chat: marker.chat, words: marker.words, uid: marker.uid }, { chat: CHAT, words: BRIEF, uid: BUILD_USER.id });
  assert.ok(b.store.has(buildChatKey(BUILD_USER.id, CHAT)), "the chat was not claimed for the build");
  // THE REAL CONSUMER designs and fires; the waiting POST collects its 202 (the original tab).
  const led = ledger();
  await fireInterim(b, job, led, { design: GOOD_DESIGN });
  const posted = await answer;
  assert.equal(posted.status, 202, JSON.stringify(posted.body).slice(0, 300));
  assert.equal(posted.body.stage, "resuming");
  // THE RELOAD: a new page asks for the account's builds.
  const found = await call(b, q, stand({ rows: { [job]: { state: "running" } } }), "GET", "/api/site/builds");
  assert.equal(found.status, 200);
  assert.deepEqual(found.body.builds.map((x) => ({ job: x.job, chat: x.chat, words: x.words, state: x.state })), [{ job, chat: CHAT, words: BRIEF, state: "running" }]);
  assert.equal(q.sent.length, 1, "finding the build queued something");
  assert.equal(rpc.filter((r) => r.fn === "edit_create").length, 1);
});

// ── ACCEPTANCE OWNERSHIP UNDER INTERLEAVING (Codex's review of 7a8e7518) ───

/** A first build's POST, started and left running (it waits on its answer slot as the browser's socket does). */
function postBuild(b, q, { token = "t", chat = CHAT, env = {} } = {}) {
  const ctx = makeCtx();
  const p = (async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ brief: BRIEF, images: [], picker: "sonnet", qa: [], chat }),
    }), { ...ENV(b, q), ...env }, ctx);
    return { status: res.status, body: await res.json().catch(() => null) };
  })();
  // ITS BACKGROUND WORK (what the request handed to `waitUntil`), for a case
  // that must let it finish under this file's stand-ins.
  p.settled = async () => { let n = -1; while (n !== ctx.pending.length) { n = ctx.pending.length; await Promise.allSettled(ctx.pending); } };
  return p;
}
/**
 * PAUSES THE FIRST WRITE TO A KEY THAT `match` ACCEPTS, before it lands or
 * just after it has landed. `reached` resolves at the pause; `release` lets
 * it go on. Every other write passes straight through.
 */
function gateWrite(b, match, when) {
  // `match(key, opts, value)`: the write's key, its options (its `onlyIf`) and what it writes.
  let release; const gate = new Promise((r) => { release = r; });
  let hit; const reached = new Promise((r) => { hit = r; });
  const put = b.put.bind(b);
  let armed = true;
  b.put = async (k, v, o) => {
    if (!armed || !match(k, o, v)) return put(k, v, o);
    armed = false;
    if (when === "before") { hit(); await gate; return put(k, v, o); }
    const r = await put(k, v, o); hit(); await gate; return r;
  };
  return { reached, release };
}
const chatKey = (uid = BUILD_USER.id) => buildChatKey(uid, CHAT);
const markersOf = (b, uid = BUILD_USER.id) => keysUnder(b, "builds-live/" + uid + "/").map((k) => markerJobOf(k, uid)).filter(Boolean);
async function until(pred, n = 2000) { for (let i = 0; i < n && !pred(); i++) await new Promise((r) => setImmediate(r)); }

// ── ROUND 3: STORAGE FAILURES, UNACCEPTED JOBS AND THE INLINE FALLBACK ─────

const edits = (rpc, fn) => rpc.filter((r) => r.fn === fn);
/**
 * THE STAND-IN NETWORK FOR A BUILD THAT RUNS (round 4): `stand`'s accounts
 * and job RPCs, plus the ledger and the designer answering as the lifecycle
 * fixture's do — so an inline build gets as far as its deposit, and every
 * billing call and designer call is kept.
 */
/**
 * THE BUILD ROWS AS THE REPOSITORY'S SQL KEEPS THEM (2026-10-10, round 5),
 * in place of answers that always said yes. One row per job, moved only the
 * way the applied functions move it:
 *   edit_create   → queued (a second create of the same id is a duplicate);
 *   edit_claim    → claimed under the lease, refused `terminal` on a done,
 *                   failed, cancelled or lost row and `leased` while another
 *                   owner holds an unexpired lease (`expire(id)` ends it);
 *   edit_handoff  → moves the lease only from its current owner;
 *   edit_beat     → only the current owner;
 *   edit_refund   → failed (or the asked state), refused `terminal` on done;
 *   edit_finalize → done or failed;
 *   build_debit   → refused `terminal` on lost, failed or cancelled
 *                   (`supabase/proposed/build_debit.sql`), `not-a-build`,
 *                   `not-owner`, `no-job`; else taken, once per ref.
 * Every call and every state a row passes through is kept, in order.
 */
function sqlJobs() {
  const rows = new Map();
  const calls = [];
  const TERMINAL = ["done", "failed", "cancelled", "lost"];
  const move = (r, state) => { r.state = state; r.states.push(state); };
  const answer = (fn, a) => {
    const r = rows.get(a.p_id);
    if (fn === "edit_create") {
      if (rows.has(a.p_id)) return { ok: true, job: a.p_id, duplicate: true };
      rows.set(a.p_id, { id: a.p_id, uid: a.p_uid, op: a.p_op, state: "queued", states: ["queued"], lease: null, expired: false, refs: new Set() });
      return { ok: true, job: a.p_id, duplicate: false };
    }
    if (fn === "edit_claim") {
      if (!r) return { ok: false, claimed: false, error: "no-job" };
      if (TERMINAL.includes(r.state)) return { ok: true, claimed: false, state: r.state, error: "terminal" };
      if (r.lease && !r.expired) return { ok: true, claimed: false, state: r.state, error: "leased" };
      r.lease = a.p_owner; r.expired = false;
      if (r.state === "queued") move(r, "claimed");
      return { ok: true, claimed: true, state: r.state, billing: "external", uid: r.uid, slug: "build:x", needs_review: false };
    }
    if (fn === "edit_handoff") {
      if (!r) return { ok: false, error: "no-job" };
      if (TERMINAL.includes(r.state)) return { ok: false, error: "terminal", state: r.state };
      if (r.lease !== a.p_owner) return { ok: false, error: "not-holder" };
      r.lease = a.p_next; r.expired = false;
      return { ok: true, uid: r.uid };
    }
    if (fn === "edit_beat") {
      if (!r || r.lease !== a.p_owner || TERMINAL.includes(r.state)) return { ok: false, error: "not-holder" };
      return { ok: true };
    }
    if (fn === "edit_refund") {
      if (!r) return { ok: false, error: "no-job" };
      if (r.state === "done") return { ok: false, error: "terminal", state: r.state };
      move(r, a.p_state || "failed");
      return { ok: true, refunded: 0, billing: "external" };
    }
    if (fn === "edit_finalize") {
      if (!r) return { ok: false, error: "no-job" };
      if (TERMINAL.includes(r.state)) return { ok: false, error: "terminal", state: r.state };
      move(r, a.p_ok === false ? "failed" : "done");
      return { ok: true };
    }
    if (fn === "build_debit") {
      if (!r) return { ok: false, error: "no-job" };
      if (r.op !== "build") return { ok: false, error: "not-a-build" };
      if (r.uid !== a.p_uid) return { ok: false, error: "not-owner" };
      if (["lost", "failed", "cancelled"].includes(r.state)) return { ok: false, error: "terminal", state: r.state, taken: 0 };
      const repeat = r.refs.has(a.p_ref);
      r.refs.add(a.p_ref);
      return { ok: true, taken: repeat ? 0 : Number(a.p_amount) || 0, balance: 400, repeat };
    }
    return null;
  };
  const over = async (u, init) => {
    const m = String(u).match(/\/rest\/v1\/rpc\/(\w+)/);
    if (!m) return null;
    const args = JSON.parse(String((init && init.body) || "{}"));
    const out = answer(m[1], args);
    if (out == null) return null;
    calls.push({ fn: m[1], args, out, state: rows.has(args.p_id) ? rows.get(args.p_id).state : null });
    return json(out);
  };
  return { rows, calls, over, row: (id) => rows.get(id), expire: (id) => { const r = rows.get(id); if (r) r.expired = true; }, of: (fn) => calls.filter((c) => c.fn === fn) };
}

function runNet({ rpc = [], designs = [], sql = sqlJobs() } = {}) {
  const base = stand({ rpc });
  return async (input, init) => {
    const u = String((input && input.url) || input || "");
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const r = await sql.over(u, init);
      if (r) { rpc.push({ fn: m[1], args: JSON.parse(String((init && init.body) || "{}")) }); return r; }
    }
    if (m && m[1] === "get_credits") { rpc.push({ fn: m[1], args: {} }); return json(400); }
    if (m && m[1] === "use_quota") { rpc.push({ fn: m[1], args: {} }); return json(true); }
    if (u.includes("/v1/messages")) {
      const bd = JSON.parse(String((init && init.body) || "{}"));
      if (bd.tool_choice && bd.tool_choice.name === "design_schema") { designs.push(bd); return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } }); }
      return new Response("stop", { status: 503 });
    }
    return base(input, init);
  };
}

// ── THE BROWSER: the real follow, found again on open ───────────────────────

const CHATJS = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHATJS.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHATJS.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHATJS.slice(open, shut + 3);
}
function cutLine(head) {
  const open = CHATJS.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHATJS.slice(open, CHATJS.indexOf("\n", open + 1) + 1);
}
const EP = createRequire(import.meta.url)("../../../public/edit-poll.js");
const SRC = [
  cut("async function apiFetch("),
  cutLine("const BUILD_POLL_MS ="), cutLine("const BUILD_FOLLOW_MS ="),
  cut("async function followBuildJob("),
  cut("function reactSend("),
  cutLine("const SITE_BUILDS_RETRY_MS ="), cutLine("const SITE_BUILDS_COOLDOWN_MS ="), cutLine("const siteBuildsState ="),
  cutLine("const siteBuildsOwed ="), cutLine("const siteBuildsShown ="),
  cut("function siteFoundAnswer("), cut("function siteBuildFinish("), cut("function siteBuildOwed("),
  cut("function siteBuildTake("), cutLine("const SITE_BUILDS_WAIT_MS ="), cut("function siteBuildsDrain("), cut("function siteBuildsRetry("), cut("function siteBuildsCheck("),
  BUSY_SLOTS, // the per-project busy state (#138)
  cut("function siteFinishBuild("),
  cut("function buildToldLines("), cut("function settlementLine("), cut("function buildFactLines("), cut("function buildFailureView("),
  cut("function failureCostLine("), cutLine("const siteTablesOrder ="), cut("function siteTablesAdd("), cut("function siteTablesRead("),
  cut("function alsoTail("), cut("function buildCostWords("), cut("function buildErrOutcome("), cut("function buildDownMsg("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

/**
 * ONE PAGE LOAD with `sites` in its store, answering `answer(url, method)`
 * (`{ status, body }`). Returns the requests made, the sites after, and what
 * each chat was told. `renders` re-runs the page's render this many times.
 */
async function browserPage({ sites = [], answer, renders = 1, busy = false, clock = null, between = null, stubs = {} } = {}) {
  const store = sites.map((s) => JSON.parse(JSON.stringify(s)));
  const reqs = [];
  const told = [];
  const delays = [];
  // A CONTROLLED CLOCK when given (`clock.t`), so the retry schedule's waits are
  // read, not slept: a timer runs at once and its delay is recorded.
  const D = clock ? Object.assign(function () {}, { now: () => clock.t }) : Date;
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" }, EditPoll: EP,
    AbortController, Response, Headers, encodeURIComponent, JSON, Promise, Object, Array, Set, Math, Date: D, String, Number,
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      reqs.push(method + " " + String(url));
      const a = answer(String(url), method, reqs);
      if (!a) return Promise.resolve(new Response(JSON.stringify({ ok: false, error: "unscripted" }), { status: 500, headers: { "content-type": "application/json" } }));
      if (a.throws) return Promise.reject(new TypeError("Failed to fetch"));
      if (a.wait) return a.wait.then((x) => new Response(JSON.stringify(x.body), { status: x.status, headers: { "content-type": "application/json" } }));
      return Promise.resolve(new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } }));
    },
    setTimeout: (fn, ms) => { delays.push(ms || 0); if (clock && ms) clock.t += ms; setImmediate(fn); return delays.length; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    sitesLoad: () => store, siteById: (id) => store.find((s) => s.id === id) || null, sitesSave: () => {}, renderSites: () => {},
    siteSnap: () => {}, reactRoutePages: () => [{ path: "/" }], readReactStream: async () => ({}),
    siteReplyMsg: (t) => ({ r: "a", t }),
    setBuildPhase: () => {}, setBuildCode: () => {}, setBuildProgress: (origin, lines) => told.push({ origin, progress: lines.map((l) => l.text) }), buildWhy: () => "",
    siteBuildStart: () => {}, siteBuildStop: () => {}, paintReactLive: () => {}, designQuestion: () => false,
    buildPicker: "sonnet", siteBuild: null, siteAbort: null, siteErr: null, siteBusy: busy, siteBusyFor: null, siteOpenId: null,
    ...stubs,
  });
  vm.runInContext(SRC, ctx);
  const settle = async () => { for (let j = 0; j < 600; j++) await new Promise((r) => setImmediate(r)); };
  for (let i = 0; i < renders; i++) {
    ctx.siteBuildsCheck();
    await settle();
    if (between) { await between(i, ctx); await settle(); }
  }
  return { reqs, store, told, delays, busy: ctx.siteBusy, ctx, settle };
}

/** The Worker's own bodies for one build, at each stage, for the browser cases. */
let bodiesOnce = null;
async function workerBodies() {
  if (bodiesOnce) return bodiesOnce;
  const b = buildBucket();
  const q = queue();
  const s = await startBuild(b, q, stand());
  const led = ledger();
  await fireInterim(b, s.job, led, { design: GOOD_DESIGN });
  await s.answer;
  progressFor(b, s.job, BUILD_USER.id, LINE);
  PROGRESS = true;
  let running;
  try { running = (await call(b, q, stand({ rows: { [s.job]: { state: "running" } } }), "GET", "/api/site/builds")).body; } finally { PROGRESS = false; }
  const pending = (await call(b, q, stand({ rows: { [s.job]: { state: "running" } } }), "GET", "/api/site/build/" + s.job)).body;
  await finishResume(b, s.job, led, { credits: 400, source: page() });
  const done = (await call(b, q, stand({ rows: { [s.job]: { state: "done" } } }), "GET", "/api/site/builds")).body;
  const poll = await call(b, q, stand({ rows: { [s.job]: { state: "done" } } }), "GET", "/api/site/build/" + s.job);
  bodiesOnce = { job: s.job, running, pending, done, poll };
  return bodiesOnce;
}
const lastOf = (s) => s.msgs[s.msgs.length - 1];

/** The same running build, as a second chat's: its own job and chat, the Worker's own bodies. */
function secondBuild(w) {
  const job2 = "abcdefabcdefabcdefabcdefabcdef12";
  const chat2 = "site_1791640000999_fghij";
  const b0 = w.running.builds[0];
  return { job2, chat2, entry: { ...b0, job: job2, chat: chat2, words: "A florist called Petal Row." }, pending: { ...w.pending, job: job2 } };
}

// ── ROUND 5 (2026-10-10): THE FALLBACK'S ROW AND THE LOST RECORD WRITE ──────

/** A ROW FILED AS THE ROUTE FILES ONE, straight into the SQL stand-in. */
async function fileRow(sql, id) {
  await sql.over("https://x/rest/v1/rpc/edit_create", { body: JSON.stringify({ p_id: id, p_uid: BUILD_USER.id, p_op: "build", p_idem: id }) });
}
const designOk = () => new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { "content-type": "application/json" } });
const runOf = (b, job) => JSON.parse(b.store.get(buildRunKey(job)) || "null");
const JOB_X = "c".repeat(32);
/** THE BUILD JOB'S OWN RE-SENDS — not the generation's resume message a build that carried on sends. */
const jobSends = (q) => q.sent.filter((m) => m.kind === JOB_KIND);

// ── ROUND 6 (2026-10-10): A RETRY'S TOKEN IS NOT PERMISSION TO EXECUTE ─────

/**
 * THE STATE A FIRST DELIVERY LEAVES WHEN ITS CLAIM COULD NOT BE SETTLED: the
 * row filed and leased to that delivery (`H1`), its record written for the
 * attempt (`T`) and not started, the job's envelope put back, and the retry
 * message carrying the attempt and the lease.
 */
async function leftForRetry(b, sql, { started = false, holder = "c_holder01", leaseTo = "c_holder01", expired = false } = {}) {
  await fileRow(sql, JOB_X);
  await sql.over("https://x/rest/v1/rpc/edit_claim", { body: JSON.stringify({ p_id: JOB_X, p_owner: leaseTo }) });
  if (expired) sql.expire(JOB_X);
  await b.put(buildRunKey(JOB_X), JSON.stringify(packBuildRun({ job: JOB_X, owner: "queue", at: Date.now(), token: "c_attempt1", holder, started })));
  return { token: "c_attempt1", holder: "c_holder01", waits: 1 };
}
/** BOTH COPIES READ THE ENVELOPE BEFORE EITHER DELETES IT: the first read waits for the second. */
function bothReadEnvelope(b, n = 2) {
  const get = b.get.bind(b);
  let reads = 0; let open; const gate = new Promise((r) => { open = r; });
  b.get = async (k) => {
    if (k !== jobKey(JOB_X) || reads >= n) return get(k);
    const v = await get(k);
    if (++reads === n) open(); else await gate;
    return v;
  };
  return () => reads;
}
/** A DESIGNER HELD OPEN long enough for any other copy to reach its own. */
const heldDesign = async () => { for (let i = 0; i < 400; i++) await new Promise((r) => setImmediate(r)); return designOk(); };
