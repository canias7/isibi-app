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
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { blockNetwork, blockedFetch, unexpected } from "./fixtures/no-network.mjs";
import { resultKey, jobKey, packResult } from "../builder/build-job.mjs";
import { buildLiveKey, buildKeptKey, buildChatKey, buildLiveState, readBuildLive, doneOutcome, markerJobOf, packBuildLive, BUILD_LIVE_MS } from "../builder/build-live.mjs";
import { resumeKey } from "../builder/build-resume.mjs";
import { openRecord, appendMark, claimWriter, commitLine, confirmLines, progressKey, packRecord, buildStepFacts } from "../builder/site-progress.mjs";

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

test("RC 2 — THE SAME CHAT ASKED AGAIN WHILE ITS BUILD RUNS (a reload, then the message sent again): answered with the running build's own 202 — no new row, R2 job, queue message, marker or charge", async () => {
  const b = buildBucket();
  const q = queue();
  const rpc = [];
  const first = await startBuild(b, q, stand({ rpc }));
  await fireInterim(b, first.job, ledger(), { design: GOOD_DESIGN });
  await first.answer;
  const again = await call(b, q, stand({ rpc, rows: { [first.job]: { state: "running" } } }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
  assert.equal(again.status, 202, JSON.stringify(again.body));
  assert.deepEqual({ stage: again.body.stage, job: again.body.job, already: again.body.already }, { stage: "resuming", job: first.job, already: true });
  assert.equal(q.sent.length, 1, "a second build was queued");
  assert.equal(rpc.filter((r) => r.fn === "edit_create").length, 1, "a second row was filed");
  assert.equal(rpc.filter((r) => /debit|credit|use_credits/.test(r.fn)).length, 0, "the second POST touched the ledger");
  assert.equal(keysUnder(b, "builds-live/" + BUILD_USER.id + "/").filter((k) => markerJobOf(k, BUILD_USER.id)).length, 1, "a second marker was written");
  assert.equal(keysUnder(b, "jobs/").filter((k) => /^jobs\/[0-9a-f]{32}\.json$/.test(k) && k !== jobKey(first.job)).length, 0, "a second R2 job was stored");
});

test("RC 3 — COMPLETED: the build's final answer is kept on its account; the listing hands it back whole (done, its slug), and the poll serves it again after the read-once slot was collected — never 'collected' to its owner", async () => {
  const b = buildBucket();
  const q = queue();
  const s = await startBuild(b, q, stand());
  const led = ledger();
  await fireInterim(b, s.job, led, { design: GOOD_DESIGN });
  await s.answer;
  await finishResume(b, s.job, led, { credits: 400, source: page() });
  assert.ok(b.store.has(buildKeptKey(BUILD_USER.id, s.job)), "the final answer was not kept");
  const rows = { [s.job]: { state: "done" } };
  const found = await call(b, q, stand({ rows }), "GET", "/api/site/builds");
  const it = found.body.builds[0];
  assert.equal(it.state, "done", JSON.stringify(it).slice(0, 300));
  assert.equal(it.answer.status, 200);
  assert.equal(it.answer.body.slug, GOOD_DESIGN.slug);
  // THE POLL, TWICE: the first read collects the slot; the second is served the kept answer.
  const p1 = await call(b, q, stand({ rows }), "GET", "/api/site/build/" + s.job);
  assert.equal(p1.status, 200);
  assert.ok(!b.store.has(resultKey(s.job)), "the slot was not read once");
  const p2 = await call(b, q, stand({ rows }), "GET", "/api/site/build/" + s.job);
  assert.equal(p2.status, 200, JSON.stringify(p2.body).slice(0, 300));
  assert.deepEqual(p2.body, p1.body, "the second read is not the build's own answer");
  // AND THE CHAT IS FREE AGAIN: a new first build for it is filed (the ended one no longer holds it).
  const q2 = queue();
  const next = await startBuild(b, q2, stand({ rows }));
  assert.ok(next.job && next.job !== s.job, "an ended build still held its chat");
  await settlePost(b, next);
});

test("RC 4 — FAILED: a build that ended on its own failure (a design with no plan) is listed failed with that answer — and a resume with no usable page, which answers a placeholder site, is listed done, as the browser's own success gate reads it; one the row says was lost is listed failed with the row's own verdict — neither as running, neither as done", async () => {
  const b = buildBucket();
  const q = queue();
  const s = await startBuild(b, q, stand());
  // A DESIGNER THAT ANSWERED NO PLAN: the build ends before it fires, on its own failure.
  await fireInterim(b, s.job, ledger(), { design: null });
  const posted = await s.answer;
  assert.notEqual(posted.status, 202, JSON.stringify(posted.body).slice(0, 200));
  const f = (await call(b, q, stand({ rows: { [s.job]: { state: "done" } } }), "GET", "/api/site/builds")).body.builds[0];
  assert.equal(f.state, "failed", JSON.stringify(f).slice(0, 300));
  assert.ok(f.answer && f.answer.body && f.answer.body.ok !== true, JSON.stringify(f.answer).slice(0, 300));
  // THE ROW'S VERDICT: a second build, handed on and then lost (no kept answer).
  const b2 = buildBucket();
  const q2 = queue();
  const s2 = await startBuild(b2, q2, stand());
  await fireInterim(b2, s2.job, ledger(), { design: GOOD_DESIGN });
  await s2.answer;
  const lost = (await call(b2, q2, stand({ rows: { [s2.job]: { state: "lost", slug: GOOD_DESIGN.slug } } }), "GET", "/api/site/builds")).body.builds[0];
  assert.equal(lost.state, "failed");
  assert.equal(lost.answer.body.lost, true, JSON.stringify(lost.answer));
  // A RESUME WITH NO USABLE PAGE answers a placeholder site (ok, a slug): the browser shows it as a site, so it is listed done.
  const b3 = buildBucket();
  const q3 = queue();
  const s3 = await startBuild(b3, q3, stand());
  const led3 = ledger();
  await fireInterim(b3, s3.job, led3, { design: GOOD_DESIGN });
  await s3.answer;
  await finishResume(b3, s3.job, led3, { credits: 400 });
  const ph = (await call(b3, q3, stand({ rows: { [s3.job]: { state: "done" } } }), "GET", "/api/site/builds")).body.builds[0];
  assert.equal(ph.state, "done");
  assert.equal(ph.answer.body.page, "placeholder");
});

test("RC 5 — ANOTHER ACCOUNT: nothing of this account's builds is listed for it, its poll is never served the kept answer, and its own first build for the same chat id is its own (keys are per account)", async () => {
  const b = buildBucket();
  const q = queue();
  const s = await startBuild(b, q, stand());
  const led = ledger();
  await fireInterim(b, s.job, led, { design: GOOD_DESIGN });
  await s.answer;
  await finishResume(b, s.job, led, { credits: 400, source: page() });
  const theirs = await call(b, q, stand(), "GET", "/api/site/builds", { token: "other" });
  assert.deepEqual(theirs.body, { builds: [] });
  await call(b, q, stand({ rows: { [s.job]: { state: "done" } } }), "GET", "/api/site/build/" + s.job); // the owner collects the slot
  const poll = await call(b, q, stand(), "GET", "/api/site/build/" + s.job, { token: "other" });
  assert.notEqual(poll.status, 200, "another account was served the build's answer: " + JSON.stringify(poll.body).slice(0, 200));
  assert.ok(!(poll.body && poll.body.slug), "another account learned the site");
  const q2 = queue();
  const theirsBuild = await startBuild(b, q2, stand(), { token: "other" });
  assert.ok(theirsBuild.job, "another account's build for the same chat id was answered with this account's");
  await settlePost(b, theirsBuild, OTHER.id);
});

test("RC 6 — A JOB THAT COULD NOT BE QUEUED (it runs inline, unlisted): its marker and its chat claim are taken back, so nothing points at a build that will never run", async () => {
  const b = buildBucket();
  const q = queue(true);
  globalThis.fetch = stand();
  try {
    const worker = await loadWorker();
    // THE INLINE RUN IS NOT THIS CASE'S SUBJECT: it is cut short by a deadline of zero.
    const res = await Promise.race([
      worker.fetch(new Request("https://gofarther.dev/api/site/react-build", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify({ brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT }) }), ENV(b, q), makeCtx()),
      new Promise((r) => setTimeout(() => r(null), 1500)),
    ]);
    void res;
  } finally { globalThis.fetch = blockedFetch; }
  assert.deepEqual(keysUnder(b, "builds-live/"), [], "a build that was never queued is still listed");
});

test("RC 7 — THE WINDOW AND THE DOOR: a marker past a day is tidied away as it is read and not listed; a signed-out caller is refused", async () => {
  const b = buildBucket();
  const q = queue();
  const old = "0123456789abcdef0123456789abcdef";
  b.store.set(buildLiveKey(BUILD_USER.id, old), JSON.stringify(packBuildLive({ job: old, uid: BUILD_USER.id, chat: CHAT, words: "x", at: Date.now() - BUILD_LIVE_MS - 60000 })));
  const r = await call(b, q, stand(), "GET", "/api/site/builds");
  assert.deepEqual(r.body, { builds: [] });
  assert.ok(!b.store.has(buildLiveKey(BUILD_USER.id, old)), "the old marker was not tidied away");
  const out = await call(b, q, stand(), "GET", "/api/site/builds", { token: "" });
  assert.equal(out.status, 401);
});

test("RC 10 — A MARKER THAT IS NOT THIS ACCOUNT'S, filed under its prefix (a misfiled or forged record): never listed, never treated as its build — the account named inside must be the caller", async () => {
  const b = buildBucket();
  const q = queue();
  const job = "0123456789abcdef0123456789abcdef";
  b.store.set(buildLiveKey(BUILD_USER.id, job), JSON.stringify(packBuildLive({ job, uid: OTHER.id, chat: CHAT, words: "not theirs", at: Date.now() })));
  const r = await call(b, q, stand(), "GET", "/api/site/builds");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { builds: [] }, "a marker naming another account was listed: " + JSON.stringify(r.body));
});

test("RC 8 — buildLiveState from its records: kept answer first (done by the browser's own success gate, else failed), then the row's verdict, a done row with no kept answer as unknown, a row with none as running, and with no row at all running only while younger than a build can run", () => {
  const marker = { job: "0123456789abcdef0123456789abcdef", uid: BUILD_USER.id, chat: CHAT, words: "w", at: 1000 };
  const ok = { status: 200, body: JSON.stringify({ ok: true, slug: "fold-lane" }), type: "application/json" };
  assert.equal(doneOutcome(ok), "done");
  assert.equal(doneOutcome({ status: 200, body: JSON.stringify({ ok: true }) }), "failed", "an answer with no site is not a finished build");
  assert.equal(doneOutcome({ status: 500, body: JSON.stringify({ ok: false, slug: "x" }) }), "failed");
  assert.equal(buildLiveState({ marker, done: ok, row: { verdict: { status: 410, body: { failed: true } } }, now: 2000 }).state, "done", "the kept answer did not win");
  assert.equal(buildLiveState({ marker, row: { verdict: { status: 410, body: { failed: true } }, state: "failed" }, now: 2000 }).state, "failed");
  assert.equal(buildLiveState({ marker, row: { verdict: { status: 410, body: { collected: true } }, state: "done" }, now: 2000 }).state, "unknown");
  assert.equal(buildLiveState({ marker, row: { verdict: null, state: "running" }, now: 2000 }).state, "running");
  assert.equal(buildLiveState({ marker, row: null, now: 2000 }).state, "running");
  assert.equal(buildLiveState({ marker, row: null, now: 1000 + 3 * 3600 * 1000 }).state, "stale");
});

test("RC 9 — A RUNNING BUILD'S LIVE LINES COME BACK WITH IT: the listing carries the model's own committed lines from the build's progress record (as the poll does), and none from a record that is another account's", async () => {
  const w = await workerBodies();
  assert.deepEqual(w.running.builds[0].progress.map((l) => l.text), [LINE]);
  const b = buildBucket();
  const q = queue();
  const s = await startBuild(b, q, stand());
  await fireInterim(b, s.job, ledger(), { design: GOOD_DESIGN });
  await s.answer;
  progressFor(b, s.job, OTHER.id, "someone else's line");
  PROGRESS = true;
  try {
    const r = await call(b, q, stand({ rows: { [s.job]: { state: "running" } } }), "GET", "/api/site/builds");
    assert.equal(r.body.builds[0].state, "running");
    assert.equal(r.body.builds[0].progress, undefined, "lines from another account's record were handed over");
  } finally { PROGRESS = false; }
});

// ── THE BROWSER: the real follow, found again on open ───────────────────────

const CHATJS = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
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
const EP = createRequire(import.meta.url)("../public/edit-poll.js");
const SRC = [
  cut("async function apiFetch("),
  cutLine("const BUILD_POLL_MS ="), cutLine("const BUILD_FOLLOW_MS ="),
  cut("async function followBuildJob("),
  cut("function reactSend("),
  cutLine("let siteBuildsChecked ="), cutLine("const siteBuildsShown ="),
  cut("function siteFoundAnswer("), cut("function siteBuildFinish("), cut("function siteBuildOwed("), cut("function siteBuildsCheck("),
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
async function browserPage({ sites = [], answer, renders = 1 } = {}) {
  const store = sites.map((s) => JSON.parse(JSON.stringify(s)));
  const reqs = [];
  const told = [];
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" }, EditPoll: EP,
    AbortController, Response, Headers, encodeURIComponent, JSON, Promise, Object, Array, Set, Math, Date, String, Number,
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      reqs.push(method + " " + String(url));
      const a = answer(String(url), method);
      if (!a) return Promise.resolve(new Response(JSON.stringify({ ok: false, error: "unscripted" }), { status: 500, headers: { "content-type": "application/json" } }));
      return Promise.resolve(new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } }));
    },
    setTimeout: (fn) => { setImmediate(fn); return 0; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    sitesLoad: () => store, siteById: (id) => store.find((s) => s.id === id) || null, sitesSave: () => {}, renderSites: () => {},
    siteSnap: () => {}, reactRoutePages: () => [{ path: "/" }], readReactStream: async () => ({}),
    siteReplyMsg: (t) => ({ r: "a", t }),
    setBuildPhase: () => {}, setBuildCode: () => {}, setBuildProgress: (origin, lines) => told.push({ origin, progress: lines.map((l) => l.text) }), buildWhy: () => "",
    siteBuildStart: () => {}, siteBuildStop: () => {}, paintReactLive: () => {}, designQuestion: () => false,
    buildPicker: "sonnet", siteBuild: null, siteAbort: null, siteErr: null, siteBusy: false, siteOpenId: null,
  });
  vm.runInContext(SRC, ctx);
  for (let i = 0; i < renders; i++) {
    ctx.siteBuildsCheck();
    for (let j = 0; j < 600; j++) await new Promise((r) => setImmediate(r));
  }
  return { reqs, store, told, busy: ctx.siteBusy };
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

test("RB 1 — RELOAD WHILE RUNNING (the page's own project, its message unanswered): the page finds the build, follows it to its end through the real follow and shows the build's answer — never a POST", async () => {
  const w = await workerBodies();
  let polls = 0;
  const p = await browserPage({
    sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }],
    answer: (url) => {
      if (url === "/api/site/builds") return { status: 200, body: w.running };
      if (url === "/api/site/build/" + w.job) return ++polls < 2 ? { status: 202, body: w.pending } : { status: w.poll.status, body: w.poll.body };
      return null;
    },
  });
  assert.deepEqual(p.reqs, ["GET /api/site/builds", "GET /api/site/build/" + w.job, "GET /api/site/build/" + w.job]);
  // THE MODEL'S OWN LINES, picked up with the build before its first poll.
  assert.deepEqual(p.told.find((t) => t.progress), { origin: CHAT, progress: [LINE] });
  const s = p.store[0];
  assert.equal(s.slug, GOOD_DESIGN.slug, "the finished site was not recorded on its project");
  assert.equal(lastOf(s).r, "a", JSON.stringify(s.msgs));
  assert.equal(p.busy, false);
});

test("RB 2 — A FRESH SESSION FOR THE SAME ACCOUNT (no project here at all): the project is made under the chat's own id with the customer's words, and the running build is followed into it — never a POST", async () => {
  const w = await workerBodies();
  let polls = 0;
  const p = await browserPage({
    sites: [],
    answer: (url) => {
      if (url === "/api/site/builds") return { status: 200, body: w.running };
      if (url === "/api/site/build/" + w.job) return ++polls < 2 ? { status: 202, body: w.pending } : { status: w.poll.status, body: w.poll.body };
      return null;
    },
  });
  assert.ok(!p.reqs.some((r) => r.startsWith("POST")), JSON.stringify(p.reqs));
  assert.equal(p.store.length, 1);
  assert.equal(p.store[0].id, CHAT);
  assert.deepEqual(JSON.parse(JSON.stringify(p.store[0].msgs[0])), { r: "u", t: BRIEF });
  assert.equal(p.store[0].slug, GOOD_DESIGN.slug);
  assert.equal(lastOf(p.store[0]).r, "a");
});

test("RB 3 — COMPLETED BEFORE THE PAGE CAME BACK: the kept answer is shown with no poll and no POST; and a project that already shows its site is never answered twice, however often the page renders", async () => {
  const w = await workerBodies();
  const p = await browserPage({ sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }], answer: (url) => (url === "/api/site/builds" ? { status: 200, body: w.done } : null) });
  assert.deepEqual(p.reqs, ["GET /api/site/builds"]);
  assert.equal(p.store[0].slug, GOOD_DESIGN.slug);
  assert.equal(p.store[0].msgs.length, 2, JSON.stringify(p.store[0].msgs));
  const again = await browserPage({ sites: p.store, answer: (url) => (url === "/api/site/builds" ? { status: 200, body: w.done } : null), renders: 3 });
  assert.deepEqual(again.reqs, ["GET /api/site/builds"], "the listing was read more than once a page load");
  assert.equal(again.store[0].msgs.length, 2, "a shown build was answered again");
});

test("RB 4 — FAILED: the build's own failure answer is shown in its chat (never a site), with no POST; and signed out, the page asks again on its next render rather than never", async () => {
  const failed = { builds: [{ job: "0123456789abcdef0123456789abcdef", chat: CHAT, words: BRIEF, at: Date.now(), state: "failed", answer: { status: 410, body: { ok: false, lost: true, stage: "queue", job: "0123456789abcdef0123456789abcdef", msg: "That build was lost." } } }] };
  const p = await browserPage({ sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }], answer: (url) => (url === "/api/site/builds" ? { status: 200, body: failed } : null) });
  assert.deepEqual(p.reqs, ["GET /api/site/builds"]);
  assert.ok(!p.store[0].slug, "a failed build gave the project a site");
  assert.equal(lastOf(p.store[0]).r, "a");
  let n = 0;
  const out = await browserPage({ sites: [], answer: (url) => (url === "/api/site/builds" ? (++n === 1 ? { status: 401, body: { error: "sign in first" } } : { status: 200, body: { builds: [] } }) : null), renders: 2 });
  assert.deepEqual(out.reqs, ["GET /api/site/builds", "GET /api/site/builds"], "a signed-out first look was never retried");
});

test("RB 5 — A CHAT THAT ALREADY HAS ITS SITE, with a later message of its own unanswered: its finished first build is not owed again — nothing shown, nothing added, no POST", async () => {
  const w = await workerBodies();
  const site = { id: CHAT, name: "Fold Lane", slug: GOOD_DESIGN.slug, msgs: [{ r: "u", t: BRIEF }, { r: "a", t: "Your site is live." }, { r: "u", t: "Make the heading bigger." }] };
  const p = await browserPage({ sites: [site], answer: (url) => (url === "/api/site/builds" ? { status: 200, body: w.done } : null) });
  assert.deepEqual(p.reqs, ["GET /api/site/builds"]);
  assert.equal(p.store[0].msgs.length, 3, "the old build was answered into a chat that already has its site: " + JSON.stringify(p.store[0].msgs));
  assert.equal(p.busy, false);
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
