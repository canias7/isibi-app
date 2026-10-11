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
import { resultKey, jobKey, packResult, JOB_KIND } from "../builder/build-job.mjs";
import { buildLiveKey, buildKeptKey, buildChatKey, buildLiveState, readBuildLive, doneOutcome, markerJobOf, packBuildLive, packBuildChat, packBuildRun, buildRunKey, BUILD_RUN_START_MS, claimVerdict, holdsChat, listsBuild, BUILD_ACCEPT_MS, BUILD_LIVE_MS } from "../builder/build-live.mjs";
import { BUILD_JOB_MS } from "../builder/build-job.mjs";
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
  // ITS MARKER IS GONE, AND ITS CLAIM IS RELEASED BY ITS OWN `ended` RECORD —
  // never a blind delete, which could remove a claim another request had
  // since taken.
  assert.deepEqual(keysUnder(b, "builds-live/").filter((k) => !k.includes("/chat-")), [], "a build that was never queued is still listed");
  const claim = JSON.parse(b.store.get(buildChatKey(BUILD_USER.id, CHAT)));
  assert.equal(claim.ended, true, "the released claim does not say it ended: " + JSON.stringify(claim));
  const listed = await call(b, queue(), stand(), "GET", "/api/site/builds");
  assert.deepEqual(listed.body, { builds: [] });
  // AND THE CHAT IS FREE: the next first build for it is filed as its own.
  const q2 = queue();
  const next = await startBuild(b, q2, stand());
  assert.ok(next.job && q2.sent.length === 1, "a released chat was not free for the next build");
  await settlePost(b, next);
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

test("RC 11 — CODEX'S INTERLEAVING: POST A paused just after its chat claim landed; POST B for the same account and chat follows A's build; A resumes and queues it — one row, one queue message, one job", async () => {
  const b = buildBucket();
  const q = queue();
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const g = gateWrite(b, (k) => k === chatKey(), "after");
    const a = postBuild(b, q);
    await g.reached;
    const aJob = JSON.parse(b.store.get(chatKey())).job;
    const bAns = await postBuild(b, q);
    assert.equal(bAns.status, 202, JSON.stringify(bAns.body));
    assert.deepEqual({ stage: bAns.body.stage, job: bAns.body.job }, { stage: "resuming", job: aJob }, "B did not follow A's build");
    g.release();
    await until(() => q.sent.length > 0);
    assert.deepEqual(q.sent.map((m) => m.id), [aJob], "a second build was queued");
    assert.equal(rpc.filter((r) => r.fn === "edit_create").length, 1, "a second row was filed");
    assert.deepEqual(markersOf(b), [aJob], "B left a marker for a build that never ran");
    assert.equal(JSON.parse(b.store.get(chatKey())).job, aJob, "A lost its claim");
    await settlePost(b, { job: aJob, answer: a });
  } finally { globalThis.fetch = blockedFetch; }
});

test("RC 12 — THE OTHER SIDE OF THE CLAIM: POST A paused after its marker and before its claim; B claims and queues; A resumes, finds B's running build and follows it, taking its own marker back — one row, one queue message", async () => {
  const b = buildBucket();
  const q = queue();
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const g = gateWrite(b, (k) => k === chatKey(), "before");
    const a = postBuild(b, q);
    await g.reached;
    const aMarker = markersOf(b);
    assert.equal(aMarker.length, 1, "A's marker was not written before its claim");
    const bp = postBuild(b, q);
    await until(() => q.sent.length > 0);
    const bJob = q.sent[0].id;
    assert.notEqual(bJob, aMarker[0]);
    g.release();
    const aAns = await a;
    assert.equal(aAns.status, 202, JSON.stringify(aAns.body));
    assert.deepEqual({ stage: aAns.body.stage, job: aAns.body.job }, { stage: "resuming", job: bJob });
    assert.equal(q.sent.length, 1, "A queued a second build");
    assert.equal(rpc.filter((r) => r.fn === "edit_create").length, 1);
    assert.deepEqual(markersOf(b), [bJob], "A's marker for a build it never queued was left listed");
    await settlePost(b, { job: bJob, answer: bp });
  } finally { globalThis.fetch = blockedFetch; }
});

test("RC 13 — A CLAIM WITH NO MARKER IS NOT FREE: a young one is followed (nothing filed, queued or marked); one older than any build runs, or one its owner released, is taken — the ended attempt stays recoverable", async () => {
  const ghost = "0123456789abcdef0123456789abcdef";
  for (const [label, claim, follows] of [
    ["young, no marker", packBuildChat({ job: ghost, at: Date.now() }), true],
    ["abandoned, no marker", packBuildChat({ job: ghost, at: Date.now() - BUILD_JOB_MS - 60000 }), false],
    ["released by its owner", packBuildChat({ job: ghost, at: Date.now(), ended: true }), false],
  ]) {
    const b = buildBucket({ [chatKey()]: JSON.stringify(claim) });
    const q = queue();
    const rpc = [];
    globalThis.fetch = stand({ rpc });
    try {
      const p = postBuild(b, q);
      if (follows) {
        const r = await p;
        assert.equal(r.status, 202, label + ": " + JSON.stringify(r.body));
        assert.equal(r.body.job, ghost, label);
        assert.equal(q.sent.length, 0, label + ": a build was queued");
        assert.equal(rpc.filter((x) => x.fn === "edit_create").length, 0, label + ": a row was filed");
        assert.deepEqual(markersOf(b), [], label + ": a marker was left");
      } else {
        await until(() => q.sent.length > 0);
        assert.equal(q.sent.length, 1, label + ": the chat was not recovered");
        assert.equal(JSON.parse(b.store.get(chatKey())).job, q.sent[0].id, label);
        await settlePost(b, { job: q.sent[0].id, answer: p });
      }
    } finally { globalThis.fetch = blockedFetch; }
  }
  assert.equal(claimVerdict({ held: { job: ghost, at: 1000 }, view: null, now: 2000 }), "held");
  assert.equal(claimVerdict({ held: { job: ghost, at: 1000 }, view: { state: "done" }, now: 2000 }), "free");
  assert.equal(claimVerdict({ held: { job: ghost, at: 1000 }, view: { state: "running" }, now: 2000 + BUILD_JOB_MS }), "held", "a running view lost to the claim's age");
});

test("RC 14 — OWNERSHIP THAT CANNOT BE READ STARTS NOTHING: a chat claim whose read fails answers a retryable 503 — no row, no R2 job, no queue message, no charge, no marker left", async () => {
  const b = buildBucket({ [chatKey()]: JSON.stringify(packBuildChat({ job: "0123456789abcdef0123456789abcdef", at: Date.now() })) });
  const get = b.get.bind(b);
  b.get = async (k) => { if (k === chatKey()) throw new Error("R2 read failed"); return get(k); };
  const q = queue();
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const r = await postBuild(b, q);
    assert.equal(r.status, 503, JSON.stringify(r.body));
    assert.equal(r.body.retry, true);
    assert.equal(q.sent.length, 0);
    assert.equal(rpc.filter((x) => x.fn === "edit_create" || /debit|credit/.test(x.fn)).length, 0);
    assert.deepEqual(markersOf(b), []);
    assert.equal(keysUnder(b, "jobs/").length, 0);
  } finally { globalThis.fetch = blockedFetch; }
});

test("RC 15 — A RELEASE NEVER TOUCHES ANOTHER REQUEST'S CLAIM: A's queue send fails after another build has taken the chat; A takes back only its own marker, and the other claim is left exactly as it was", async () => {
  const b = buildBucket();
  const other = "fedcba9876543210fedcba9876543210";
  const theirs = JSON.stringify(packBuildChat({ job: other, at: Date.now() }));
  const q = { sent: [], async send() { b.store.set(chatKey(), theirs); throw new Error("queue down"); }, async sendBatch() { throw new Error("no batch"); } };
  globalThis.fetch = stand();
  try {
    await Promise.race([postBuild(b, q), new Promise((r) => setTimeout(r, 1500))]);
  } finally { globalThis.fetch = blockedFetch; }
  assert.equal(b.store.get(chatKey()), theirs, "the release overwrote or removed another request's claim");
  assert.deepEqual(markersOf(b), [], "A's own marker was left");
  // AND IN THE WINDOW INSIDE THE RELEASE ITSELF: A reads its own claim, and
  // another request's claim lands before A acts on that read. A release that
  // deletes after checking would remove it; one conditional on what it read
  // cannot.
  const b2 = buildBucket();
  let failed = false;
  const get = b2.get.bind(b2);
  b2.get = async (k) => {
    const r = await get(k);
    // A REAL WRITE (a new etag), as another request's takeover would land.
    if (failed && k === chatKey() && r) { b2.get = get; await b2.put(chatKey(), theirs); }
    return r;
  };
  const q2 = { sent: [], async send() { failed = true; throw new Error("queue down"); }, async sendBatch() { throw new Error("no batch"); } };
  globalThis.fetch = stand();
  try {
    await Promise.race([postBuild(b2, q2), new Promise((r) => setTimeout(r, 1500))]);
  } finally { globalThis.fetch = blockedFetch; }
  assert.equal(b2.store.get(chatKey()), theirs, "a claim taken inside the release's own read-then-act window was removed or overwritten");
});

test("RC 16 — TWO TAKERS OF ONE ENDED CLAIM: both judge it free; B's takeover lands first and B queues; A's takeover, conditional on the claim it judged, fails, and A judges again — B's running build — and follows it. One row, one queue message", async () => {
  const ghost = "0123456789abcdef0123456789abcdef";
  const b = buildBucket({ [chatKey()]: JSON.stringify(packBuildChat({ job: ghost, at: Date.now(), ended: true })) });
  const q = queue();
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const g = gateWrite(b, (k, o) => k === chatKey() && !!(o && o.onlyIf && o.onlyIf.etagMatches), "before");
    const a = postBuild(b, q);
    await g.reached; // A has judged the ended claim free and is about to take it over
    const bp = postBuild(b, q);
    await until(() => q.sent.length > 0);
    const bJob = q.sent[0].id;
    g.release();
    const aAns = await a;
    assert.equal(aAns.status, 202, JSON.stringify(aAns.body));
    assert.equal(aAns.body.job, bJob, "A did not follow the build that took the chat first");
    assert.equal(q.sent.length, 1, "both takers queued a build");
    assert.equal(rpc.filter((r) => r.fn === "edit_create").length, 1);
    assert.equal(JSON.parse(b.store.get(chatKey())).job, bJob, "A overwrote B's claim");
    assert.deepEqual(markersOf(b), [bJob]);
    await settlePost(b, { job: bJob, answer: bp });
  } finally { globalThis.fetch = blockedFetch; }
});

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

test("RC 17 — ONE EXECUTION THROUGH A STORAGE FAILURE: a send that fails after its message landed — the producer takes the job's execution record and runs it inline, and the delivered message's consumer finds the record taken and never executes; a store whose write landed but reported failure, likewise; and when the record itself cannot be written after a failed send, nothing runs inline and the consumer runs it once", async () => {
  // (a) THE SEND'S MESSAGE LANDS; the producer is told it failed.
  {
    const b = buildBucket();
    const q = { sent: [], async send(m) { this.sent.push(m); throw new Error("queue: network reset after write"); }, async sendBatch() { throw new Error("no batch"); } };
    const rpc = [];
    const inlineDesigns = [];
    const sql = sqlJobs();
    globalThis.fetch = runNet({ rpc, designs: inlineDesigns, sql });
    let job;
    try {
      const a = postBuild(b, q, { env: { ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k" } });
      await until(() => q.sent.length > 0, 20000);
      job = q.sent[0].id;
      await a;
      await a.settled();
    } finally { globalThis.fetch = blockedFetch; }
    // THE DELIVERED MESSAGE: the real consumer, with the job envelope back in place.
    const designs = [];
    await fireInterim(b, job, ledger(), { designs, over: sql.over });
    assert.equal(designs.length, 0, "the consumer executed a job the inline build already held");
    assert.equal(JSON.parse(b.store.get(buildRunKey(job)) || "{}").owner, "inline", "the producer ran it without holding its execution record");
    // ONE EXECUTION, UNDER THE JOB'S OWN BILLING IDENTITY: the inline build's
    // deposit is taken under build:<job> — never a fresh ref beside the queue's.
    assert.equal(inlineDesigns.length, 1, "the inline build did not run once");
    const debits = rpc.filter((r) => r.fn === "build_debit");
    assert.ok(debits.length >= 1, "the inline build reached no deposit — this guard is watching nothing");
    for (const d of debits) assert.ok(String(d.args.p_ref || "").startsWith("build:" + job), "the inline build billed outside its job's identity: " + JSON.stringify(d.args));
    // …AND THE SQL TOOK IT (round 5): the row was live when the deposit came.
    assert.ok(sql.of("build_debit").length >= 1 && sql.of("build_debit").every((c) => c.out.ok === true), "the inline deposit was refused: " + JSON.stringify(sql.of("build_debit").map((c) => c.out)));
    assert.equal(sql.row(job).states.length, 3, "the row did not go queued → claimed → ended once: " + sql.row(job).states.join(" → "));
  }
  // (b) THE STORE'S WRITE LANDS; the producer is told it failed.
  {
    const b = buildBucket();
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { const r = await put(k, v, o); if (/^jobs\/[0-9a-f]{32}\.json$/.test(k)) throw new Error("R2: reset after write"); return r; };
    const q = queue();
    globalThis.fetch = stand();
    try {
      const a = postBuild(b, q);
      await a;
      await a.settled();
      assert.equal(q.sent.length, 0, "a job run inline was announced to the consumer as well");
      const job = markersOf(b)[0] || [...b.store.keys()].map((k) => (k.match(/^builds-run\/([0-9a-f]{32})\.json$/) || [])[1]).find(Boolean);
      assert.equal(JSON.parse(b.store.get(buildRunKey(job))).owner, "inline");
    } finally { globalThis.fetch = blockedFetch; }
  }
  // (c) THE SEND FAILS AND THE EXECUTION RECORD CANNOT BE WRITTEN: never inline.
  {
    const b = buildBucket();
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { if (k.startsWith("builds-run/") && !globalThis.__consumerTurn) throw new Error("R2 write failed"); return put(k, v, o); };
    const q = { sent: [], async send(m) { this.sent.push(m); throw new Error("queue: reset"); }, async sendBatch() { throw new Error("no batch"); } };
    const rpc = [];
    const sql = sqlJobs();
    globalThis.fetch = runNet({ rpc, sql });
    let job, a;
    try {
      a = postBuild(b, q);
      await until(() => q.sent.length > 0, 20000);
      job = q.sent[0].id;
      for (let i = 0; i < 300; i++) await new Promise((r) => setImmediate(r));
      assert.equal(edits(rpc, "edit_refund").length, 0, "the row was closed though nobody could be shown to hold the execution");
      assert.equal(b.store.has(buildRunKey(job)), false);
      assert.equal(readBuildLive(JSON.parse(b.store.get(buildLiveKey(BUILD_USER.id, job)))).accepted, true, "the followed build was not accepted");
    } finally { globalThis.fetch = blockedFetch; }
    globalThis.__consumerTurn = true;
    const designs = [];
    try { await fireInterim(b, job, ledger(), { designs, over: sql.over }); } finally { delete globalThis.__consumerTurn; }
    assert.equal(designs.length, 1, "the consumer did not run the one execution");
    assert.equal(sql.of("build_debit").length, 1, "not one deposit");
    assert.equal(sql.of("build_debit")[0].out.ok, true, "the consumer's deposit was refused");
    const ans = await a;
    assert.equal(ans.status, 202, JSON.stringify(ans.body).slice(0, 200));
    assert.equal(ans.body.job, job);
  }
  // (d) THE STORE FAILS, THE RECORD CANNOT BE WRITTEN, AND THE ROW CANNOT BE
  // CLOSED: a sweep could still announce the job, so it is queued and
  // followed — never run inline with nothing to stop a consumer.
  {
    const b = buildBucket();
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { if (/^jobs\/[0-9a-f]{32}\.json$/.test(k) || k.startsWith("builds-run/")) throw new Error("R2 write failed"); return put(k, v, o); };
    const q = queue();
    const rpc = [];
    const base = stand({ rpc });
    globalThis.fetch = async (input, init) => { const u = String((input && input.url) || input || ""); if (u.includes("/rpc/edit_refund")) { rpc.push({ fn: "edit_refund", args: {} }); return json({ ok: false, error: "rpc down" }); } return base(input, init); };
    try {
      const a = postBuild(b, q);
      await until(() => q.sent.length > 0, 20000);
      assert.equal(q.sent.length, 1, "a job whose row could not be closed was run inline instead of queued");
      await settlePost(b, { job: q.sent[0].id, answer: a });
    } finally { globalThis.fetch = blockedFetch; }
  }
});

test("RC 20 — CODEX'S MARKER-WRITE REPRODUCTION: an accepted running build holds the chat; a new candidate whose own marker write throws follows that build — no row, no queue message, no marker; and with no owner at all, a candidate whose marker write throws starts nothing (a retryable 503)", async () => {
  const S = "5555555555555555aaaaaaaaaaaaaaaa";
  const seed = () => buildBucket({
    [buildLiveKey(BUILD_USER.id, S)]: JSON.stringify(packBuildLive({ job: S, uid: BUILD_USER.id, chat: CHAT, words: BRIEF, at: Date.now() - 60000, accepted: true })),
    [chatKey()]: JSON.stringify(packBuildChat({ job: S, at: Date.now() - 60000 })),
  });
  const failOwnMarker = (b) => { const put = b.put.bind(b); b.put = async (k, v, o) => { const j = markerJobOf(k, BUILD_USER.id); if (j && j !== S) throw new Error("R2 write failed"); return put(k, v, o); }; };
  {
    const b = seed();
    failOwnMarker(b);
    const q = queue();
    const rpc = [];
    const r = await call(b, q, stand({ rpc, rows: { [S]: { state: "running" } } }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(r.body.job, S, "the candidate did not follow the chat's running build");
    assert.equal(q.sent.length, 0, "a second build was queued");
    assert.equal(edits(rpc, "edit_create").length, 0, "a second row was filed");
    assert.deepEqual(markersOf(b), [S]);
    assert.equal(JSON.parse(b.store.get(chatKey())).job, S, "the running build lost its claim");
  }
  {
    const b = buildBucket();
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { if (markerJobOf(k, BUILD_USER.id)) throw new Error("R2 write failed"); return put(k, v, o); };
    const q = queue();
    const rpc = [];
    const r = await call(b, q, stand({ rpc }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
    assert.equal(r.status, 503, JSON.stringify(r.body));
    assert.equal(r.body.retry, true);
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0, "a build was started with no ownership");
    assert.equal(b.store.has(chatKey()), false, "a claim with no marker behind it was written");
  }
  // (c) A CLAIM THAT LOOKS FREE (its owner's own release) is never taken over
  // by a candidate whose marker could not be written: it starts nothing.
  {
    const b = buildBucket({ [chatKey()]: JSON.stringify(packBuildChat({ job: S, at: Date.now() - 60000, ended: true })) });
    const before = b.store.get(chatKey());
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { if (markerJobOf(k, BUILD_USER.id)) throw new Error("R2 write failed"); return put(k, v, o); };
    const q = queue();
    const rpc = [];
    const r = await call(b, q, stand({ rpc }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
    assert.equal(r.status, 503, JSON.stringify(r.body));
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0);
    assert.equal(b.store.get(chatKey()), before, "a free claim was taken by a candidate with no marker");
  }
});

test("RC 21 — CODEX'S HELD-DESIGNER REPRODUCTION: the queue accepts the message and the real consumer reaches its designer; while the designer is held, the producer's send rejects as though its response was lost — the producer finds the execution taken, runs nothing inline, closes no row; one designer call, one deposit under one billing identity, and the POST answers with that one build", async () => {
  const b = buildBucket();
  const rpc = [];
  const debits = [];
  const sql = sqlJobs();
  let releaseDesign; const designGate = new Promise((r) => { releaseDesign = r; });
  let atDesign; const reached = new Promise((r) => { atDesign = r; });
  const designs = [];
  let consumer;
  const q = {
    sent: [],
    async send(m) {
      this.sent.push(m);
      consumer = fireInterim(b, m.id, ledger(), {
        designs,
        onDesign: async () => { atDesign(); await designGate; return new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { "content-type": "application/json" } }); },
        over: async (u, init) => { const mm = u.match(/\/rest\/v1\/rpc\/(\w+)/); if (mm && /debit|credit_reverse|use_credits/.test(mm[1])) debits.push({ fn: mm[1], args: JSON.parse(String((init && init.body) || "{}")) }); if (mm) rpc.push({ fn: mm[1] }); return sql.over(u, init); },
      });
      await reached;
      throw new Error("queue: response lost");
    },
    async sendBatch() { throw new Error("no batch"); },
  };
  globalThis.fetch = runNet({ rpc, sql });
  const a = postBuild(b, q);
  await reached;
  for (let i = 0; i < 400; i++) await new Promise((r) => setImmediate(r));
  const job = q.sent[0].id;
  assert.equal(designs.length, 1, "another designer call ran while the consumer's first was held: " + designs.length);
  assert.equal(edits(rpc, "edit_refund").length, 0, "the active consumer's row was closed on a failed send");
  assert.equal(JSON.parse(b.store.get(buildRunKey(job)) || "{}").owner, "queue");
  assert.equal(edits(rpc, "edit_refund").length, 0, "the active consumer's row was closed on a failed send");
  releaseDesign();
  await consumer;
  const ans = await a;
  assert.equal(designs.length, 1, "the build designed more than once");
  assert.equal(ans.status, 202, JSON.stringify(ans.body).slice(0, 200));
  assert.equal(ans.body.job, job, "the POST answered with something other than the one execution");
  const refs = debits.map((d) => String(d.args.p_ref || d.args.ref || "")).filter(Boolean);
  assert.ok(refs.length >= 1 && refs.every((r) => r.startsWith("build:" + job)), "billing outside the one build's identity: " + JSON.stringify(refs));
  assert.equal(debits.filter((d) => d.fn === "build_debit").length, 1, "the deposit was taken more than once");
  assert.equal(sql.of("build_debit")[0].out.ok, true, "the one deposit was refused by the rows' own rule");
  assert.deepEqual(sql.row(job).states, ["queued", "claimed"], "the active consumer's row moved outside the SQL's transitions");
  assert.equal(edits(rpc, "edit_create").length, 1);
});

test("RC 22 — THE TRANSITION WINDOWS: an execution record outranks a lost 'accepted' or 'inline' write and the acceptance timeout — a queued executor is followed and an inline one is answered 409, long after the window; an attempt abandoned with no executor is revoked before its chat is taken, and its late delivery never executes", async () => {
  const old = Date.now() - BUILD_ACCEPT_MS - 60000;
  const J = "7777777777777777bbbbbbbbbbbbbbbb";
  const planted = (owner) => buildBucket({
    [buildLiveKey(BUILD_USER.id, J)]: JSON.stringify(packBuildLive({ job: J, uid: BUILD_USER.id, chat: CHAT, words: BRIEF, at: old })),
    [chatKey()]: JSON.stringify(packBuildChat({ job: J, at: old })),
    ...(owner ? { [buildRunKey(J)]: JSON.stringify(packBuildRun({ job: J, owner, at: Date.now() - 30000 })) } : {}),
  });
  const post = (b, q, rpc) => call(b, q, stand({ rpc }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
  // A QUEUED EXECUTOR WHOSE "ACCEPTED" WRITE WAS LOST, past the acceptance window, no row.
  {
    const b = planted("queue"); const q = queue(); const rpc = [];
    const r = await post(b, q, rpc);
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(r.body.job, J);
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0, "a second build started beside a running executor");
    const listed = await call(b, queue(), stand(), "GET", "/api/site/builds");
    assert.deepEqual(listed.body.builds.map((x) => [x.job, x.state]), [[J, "running"]], "a running executor was hidden or freed");
  }
  // AN INLINE EXECUTOR WHOSE "INLINE" WRITE WAS LOST, past the window.
  {
    const b = planted("inline"); const q = queue(); const rpc = [];
    const r = await post(b, q, rpc);
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.error, "build-running-inline");
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0);
  }
  // A CLAIM WITH NO MARKER AT ALL, older than any acceptance, whose job is executing: held.
  {
    const b = buildBucket({
      [chatKey()]: JSON.stringify(packBuildChat({ job: J, at: Date.now() - BUILD_JOB_MS - 60000 })),
      [buildRunKey(J)]: JSON.stringify(packBuildRun({ job: J, owner: "queue", at: Date.now() - 30000 })),
    });
    const q = queue(); const rpc = [];
    const r = await post(b, q, rpc);
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(r.body.job, J, "a chat whose job is executing was taken because its claim and marker looked abandoned");
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0);
  }
  // ABANDONED, BUT ITS JOB CANNOT BE REVOKED (the record's write fails): nothing is taken over.
  {
    const b = planted(null);
    const before = b.store.get(chatKey());
    const put = b.put.bind(b);
    b.put = async (k, v, o) => { if (k.startsWith("builds-run/")) throw new Error("R2 write failed"); return put(k, v, o); };
    const q = queue(); const rpc = [];
    const r = await post(b, q, rpc);
    assert.equal(r.status, 503, JSON.stringify(r.body));
    assert.equal(q.sent.length + edits(rpc, "edit_create").length, 0, "a chat was taken without its old job revoked");
    assert.equal(b.store.get(chatKey()), before);
  }
  // ABANDONED, ITS JOB ALREADY REVOKED (by another request): free to take.
  {
    const b = planted("revoked"); const q = queue();
    globalThis.fetch = stand();
    let p;
    try {
      p = postBuild(b, q);
      await until(() => q.sent.length > 0, 20000);
    } finally { globalThis.fetch = blockedFetch; }
    assert.equal(q.sent.length, 1, "a chat whose old job was already revoked was not free");
    await settlePost(b, { job: q.sent[0].id, answer: p });
  }
  // ABANDONED, NO EXECUTOR: revoked first, then taken — and its late delivery never executes.
  {
    const b = planted(null); const q = queue(); const rpc = [];
    globalThis.fetch = stand({ rpc });
    let p;
    try {
      p = postBuild(b, q);
      await until(() => q.sent.length > 0, 20000);
    } finally { globalThis.fetch = blockedFetch; }
    assert.equal(JSON.parse(b.store.get(buildRunKey(J))).owner, "revoked", "the abandoned job was not revoked before its chat was taken");
    const late = [];
    await fireInterim(b, J, ledger(), { designs: late });
    assert.equal(late.length, 0, "a revoked job executed on its late delivery");
    await settlePost(b, { job: q.sent[0].id, answer: p });
  }
});

test("RC 18 — THE INLINE FALLBACK OWNS ITS CHAT: the queue send fails and the job is provably gone, so the build runs inline — while it runs, a second POST for the chat is told it is already being built (409, nothing filed, queued or charged) and the listing shows nothing; when it ends the claim is released and the next build is free", async () => {
  const b = buildBucket();
  const q = queue(true);
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const g = gateWrite(b, (k, o, v) => markerJobOf(k, BUILD_USER.id) !== "" && typeof v === "string" && v.includes('"inline":true'), "after");
    const a = postBuild(b, q);
    await g.reached;
    const job = markersOf(b)[0];
    assert.ok(job, "no inline marker");
    // THE ROW IS HELD, NOT CLOSED, WHILE THE FALLBACK RUNS (round 5): its own
    // deposit is taken against it, so a failed row here would refuse it.
    assert.equal(edits(rpc, "edit_refund").length, 0, "the fallback failed its own row before running");
    assert.equal(edits(rpc, "edit_claim").length, 1, "the fallback did not take its row's lease");
    const second = await call(b, queue(), stand({ rpc }), "POST", "/api/site/react-build", { body: { brief: BRIEF, images: [], picker: "sonnet", qa: [], chat: CHAT } });
    assert.equal(second.status, 409, JSON.stringify(second.body));
    assert.equal(second.body.error, "build-running-inline");
    assert.equal(edits(rpc, "edit_create").length, 1, "the second POST filed a row");
    const listed = await call(b, queue(), stand(), "GET", "/api/site/builds");
    assert.deepEqual(listed.body, { builds: [] }, "a build running inline was listed as a job to follow");
    // `call` puts the blocked network back when it ends; A's inline build runs under the stand-ins.
    globalThis.fetch = stand({ rpc });
    g.release();
    // THE INLINE BUILD RUNS TO ITS END under this file's own stand-ins (the
    // network stays stubbed until it has answered).
    await a;
    await a.settled();
    await until(() => markersOf(b).length === 0);
    assert.deepEqual(markersOf(b), [], "the inline build's marker outlived it");
    assert.equal(JSON.parse(b.store.get(chatKey())).ended, true, "the inline build did not give its chat back");
    const q3 = queue();
    const next = await startBuild(b, q3, stand());
    assert.ok(next.job && q3.sent.length === 1, "the chat was not free after the inline build ended");
    await settlePost(b, next);
  } finally { globalThis.fetch = blockedFetch; }
});

test("RC 19 — DISCOVERY NEVER HANDS OUT AN UNACCEPTED JOB: while a build is being accepted (marker written, message not yet sent) the listing shows nothing and a second POST follows nothing new; it is listed only once its message is sent; and an attempt abandoned before acceptance is never listed and frees its chat", async () => {
  const b = buildBucket();
  let release; const gate = new Promise((r) => { release = r; });
  let reached; const at = new Promise((r) => { reached = r; });
  const q = { sent: [], async send(m) { reached(); await gate; this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } };
  globalThis.fetch = stand();
  let job;
  try {
    const a = postBuild(b, q);
    await at;
    job = markersOf(b)[0];
    const during = await call(b, queue(), stand({ rows: { [job]: { state: "queued" } } }), "GET", "/api/site/builds");
    assert.deepEqual(during.body, { builds: [] }, "a build not yet accepted was listed");
    release();
    await until(() => q.sent.length > 0);
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    const after = await call(b, queue(), stand({ rows: { [job]: { state: "queued" } } }), "GET", "/api/site/builds");
    assert.deepEqual(after.body.builds.map((x) => x.job), [job], "an accepted build was not listed");
    await settlePost(b, { job, answer: a });
  } finally { globalThis.fetch = blockedFetch; }
  // ABANDONED BEFORE ACCEPTANCE: a marker never accepted, no row, older than an acceptance takes.
  const ghost = "0123456789abcdef0123456789abcdef";
  const b2 = buildBucket({
    [buildLiveKey(BUILD_USER.id, ghost)]: JSON.stringify(packBuildLive({ job: ghost, uid: BUILD_USER.id, chat: CHAT, words: BRIEF, at: Date.now() - BUILD_ACCEPT_MS - 60000 })),
    [chatKey()]: JSON.stringify(packBuildChat({ job: ghost, at: Date.now() - BUILD_ACCEPT_MS - 60000 })),
  });
  const listed = await call(b2, queue(), stand(), "GET", "/api/site/builds");
  assert.deepEqual(listed.body, { builds: [] }, "an abandoned attempt was listed");
  const q2 = queue();
  globalThis.fetch = stand();
  try {
    const p = postBuild(b2, q2);
    await until(() => q2.sent.length > 0);
    assert.equal(q2.sent.length, 1, "an abandoned attempt still held its chat");
    await settlePost(b2, { job: q2.sent[0].id, answer: p });
  } finally { globalThis.fetch = blockedFetch; }
});

test("RC 8 — buildLiveState from its records: kept answer first (done by the browser's own success gate, else failed), then the row's verdict, a done row with no kept answer as unknown, a row with none as running, and with no row at all running only while younger than a build can run", () => {
  const marker = { job: "0123456789abcdef0123456789abcdef", uid: BUILD_USER.id, chat: CHAT, words: "w", at: 1000, accepted: true };
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
  // NOT YET ACCEPTED (round 3): being accepted while its row has no verdict or
  // while young with no row; abandoned once its row has a verdict or it is
  // older than an acceptance takes. Never listed either way.
  const pending = { ...marker, accepted: false };
  assert.equal(buildLiveState({ marker: pending, row: { verdict: null, state: "queued" }, now: 1000 + BUILD_JOB_MS }).state, "accepting", "a row with no verdict lost its hold to age");
  assert.equal(buildLiveState({ marker: pending, row: { verdict: { status: 410, body: { failed: true } } }, now: 2000 }).state, "abandoned");
  assert.equal(buildLiveState({ marker: pending, row: null, now: 2000 }).state, "accepting");
  assert.equal(buildLiveState({ marker: pending, row: null, now: 1000 + BUILD_ACCEPT_MS + 1 }).state, "abandoned");
  // RUNNING INLINE: its own state whatever its (closed) row says, until older than a build runs.
  const inl = { ...marker, accepted: false, inline: true };
  assert.equal(buildLiveState({ marker: inl, row: { verdict: { status: 410, body: { failed: true } } }, now: 2000 }).state, "inline", "a closed row freed a chat whose build runs inline");
  assert.equal(buildLiveState({ marker: inl, row: null, now: 1000 + BUILD_JOB_MS + 1 }).state, "stale");
  for (const st of ["running", "accepting", "inline"]) assert.equal(holdsChat({ state: st }), true, st);
  for (const st of ["done", "failed", "unknown", "abandoned", "stale"]) assert.equal(holdsChat({ state: st }), false, st);
  for (const st of ["running", "done", "failed", "unknown"]) assert.equal(listsBuild({ state: st }), true, st);
  for (const st of ["accepting", "abandoned", "inline", "stale"]) assert.equal(listsBuild({ state: st }), false, st);
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
  cutLine("const SITE_BUILDS_RETRY_MS ="), cutLine("const SITE_BUILDS_COOLDOWN_MS ="), cutLine("const siteBuildsState ="),
  cutLine("const siteBuildsOwed ="), cutLine("const siteBuildsShown ="),
  cut("function siteFoundAnswer("), cut("function siteBuildFinish("), cut("function siteBuildOwed("),
  cut("function siteBuildTake("), cutLine("const SITE_BUILDS_WAIT_MS ="), cut("function siteBuildsDrain("), cut("function siteBuildsRetry("), cut("function siteBuildsCheck("),
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
async function browserPage({ sites = [], answer, renders = 1, busy = false, clock = null, between = null } = {}) {
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
    buildPicker: "sonnet", siteBuild: null, siteAbort: null, siteErr: null, siteBusy: busy, siteOpenId: null,
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

/** The same running build, as a second chat's: its own job and chat, the Worker's own bodies. */
function secondBuild(w) {
  const job2 = "abcdefabcdefabcdefabcdefabcdef12";
  const chat2 = "site_1791640000999_fghij";
  const b0 = w.running.builds[0];
  return { job2, chat2, entry: { ...b0, job: job2, chat: chat2, words: "A florist called Petal Row." }, pending: { ...w.pending, job: job2 } };
}

test("RB 6 — TWO RUNNING BUILDS IN TWO CHATS, THREE RENDERS (Codex's case): both are followed to their ends, one after the other — each chat restored with its answer, each job polled, nothing posted, and the page free at the end", async () => {
  const w = await workerBodies();
  const { job2, chat2, entry, pending } = secondBuild(w);
  const listing = { builds: [entry, w.running.builds[0]] };
  const polls = { [w.job]: 0, [job2]: 0 };
  const p = await browserPage({
    sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }],
    renders: 3,
    answer: (url) => {
      if (url === "/api/site/builds") return { status: 200, body: listing };
      for (const j of [w.job, job2]) {
        if (url === "/api/site/build/" + j) return ++polls[j] < 2 ? { status: 202, body: j === w.job ? w.pending : pending } : { status: w.poll.status, body: w.poll.body };
      }
      return null;
    },
  });
  assert.ok(!p.reqs.some((r) => r.startsWith("POST")), JSON.stringify(p.reqs));
  assert.equal(p.reqs.filter((r) => r === "GET /api/site/builds").length, 1, "the listing was read more than once");
  assert.ok(polls[w.job] >= 2 && polls[job2] >= 2, "a running build was skipped for good: " + JSON.stringify(polls));
  // ONE AT A TIME: the page's busy state is held by the build it follows, so
  // the second build's polls all come after the first build's last.
  const order = p.reqs.filter((r) => r.startsWith("GET /api/site/build/")).map((r) => r.slice("GET /api/site/build/".length));
  const firstJob = order[0];
  const lastOfFirst = order.lastIndexOf(firstJob);
  assert.ok(order.slice(0, lastOfFirst + 1).every((j) => j === firstJob), "the two found builds were followed at once: " + JSON.stringify(order));
  const one = p.store.find((s) => s.id === CHAT);
  const two = p.store.find((s) => s.id === chat2);
  assert.ok(two, "the second chat was never restored");
  for (const s of [one, two]) {
    assert.equal(s.slug, GOOD_DESIGN.slug, s.id + " has no site");
    assert.equal(s.msgs.filter((m) => m.r === "a").length, 1, s.id + " was answered " + s.msgs.filter((m) => m.r === "a").length + " times");
  }
  assert.equal(p.busy, false);
});

test("RB 7 — DISCOVERY WHILE ANOTHER OPERATION IS BUSY: the listing is read, but nothing is taken up and the other operation's busy state is never cleared; once it is free, every owed build — ended and running — is taken up, each once", async () => {
  const w = await workerBodies();
  const { job2, chat2, entry, pending } = secondBuild(w);
  const ended = { ...w.done.builds[0], job: "1234567890abcdef1234567890abcdef", chat: "site_1791640000555_klmno", words: "A tea room." };
  const listing = { builds: [entry, ended] };
  let polled = 0;
  let seenWhileBusy = null;
  const p = await browserPage({
    sites: [],
    busy: true,
    renders: 3,
    answer: (url) => {
      if (url === "/api/site/builds") return { status: 200, body: listing };
      if (url === "/api/site/build/" + job2) return ++polled < 2 ? { status: 202, body: pending } : { status: w.poll.status, body: w.poll.body };
      return null;
    },
    between: (i, ctx) => {
      if (i === 0) {
        seenWhileBusy = { busy: ctx.siteBusy, sites: ctx.sitesLoad().length, polled };
        ctx.siteBusy = false; // THE OTHER OPERATION ENDS (its own finish frees the page)
      }
    },
  });
  assert.deepEqual(seenWhileBusy, { busy: true, sites: 0, polled: 0 }, "discovery acted, or cleared another operation's busy state, while it was busy");
  assert.ok(!p.reqs.some((r) => r.startsWith("POST")));
  assert.equal(p.reqs.filter((r) => r === "GET /api/site/builds").length, 1);
  const a = p.store.find((s) => s.id === ended.chat);
  const b = p.store.find((s) => s.id === chat2);
  assert.ok(a && b, "an owed build was lost: " + JSON.stringify(p.store.map((s) => s.id)));
  assert.equal(a.msgs.filter((m) => m.r === "a").length, 1);
  assert.equal(b.msgs.filter((m) => m.r === "a").length, 1);
  assert.equal(b.slug, GOOD_DESIGN.slug);
  assert.equal(p.busy, false);
});

test("RB 8 — A TEMPORARY LISTING FAILURE IS TRIED AGAIN, NEVER OVERLAPPING: renders while the first read is out ask nothing more; its 503 is retried once after 2 s, and the build it then names is shown", async () => {
  const w = await workerBodies();
  let release;
  const first = new Promise((r) => { release = r; });
  let n = 0;
  let whileOut = -1;
  const clock = { t: 1_000_000 };
  const p = await browserPage({
    sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }],
    clock,
    renders: 3,
    answer: (url) => (url === "/api/site/builds" ? (++n === 1 ? { wait: first } : { status: 200, body: w.done }) : null),
    between: (i) => {
      if (i === 1) {
        // RENDERS 0 AND 1 HAVE RUN WITH THE FIRST READ STILL OUT: one read only.
        whileOut = n;
        release({ status: 503, body: { error: "unavailable" } });
      }
    },
  });
  assert.equal(whileOut, 1, "a render started a second listing read while the first was out");
  assert.equal(p.reqs.filter((r) => r === "GET /api/site/builds").length, 2, JSON.stringify(p.reqs));
  assert.deepEqual(p.delays.filter((d) => d >= 1000), [2000], "the retry was not the first step of the schedule");
  assert.equal(p.store[0].slug, GOOD_DESIGN.slug, "the build named after the retry was not shown");
  assert.equal(p.store[0].msgs.length, 2);
});

test("RB 9 — A LISTING THAT KEEPS FAILING IS BOUNDED: five automatic retries at 2, 4, 8, 16 and 32 s, then nothing until a render a minute on — no rapid loop — and a thrown network error counts the same", async () => {
  const clock = { t: 5_000_000 };
  let n = 0;
  const p = await browserPage({
    sites: [],
    clock,
    renders: 4,
    answer: (url) => (url === "/api/site/builds" ? (++n % 2 ? { status: 503, body: { error: "unavailable" } } : { throws: true }) : null),
    between: (i) => { if (i === 2) clock.t += 60000; },
  });
  // 1 + 5 retries, then renders 1 and 2 (inside the cool-down) ask nothing; render 3 (a minute on) asks once.
  assert.equal(p.reqs.filter((r) => r === "GET /api/site/builds").length, 7, JSON.stringify(p.reqs));
  // EXACTLY THE SCHEDULE, and no timer after it: the read a minute on that fails again waits for another render.
  assert.deepEqual(p.delays.filter((d) => d >= 1000), [2000, 4000, 8000, 16000, 32000]);
});

test("RB 10 — THE NEXT OWED BUILD STARTS WHEN THE FIRST ONE ENDS, not only on a later render: one render, two running builds, both followed to their ends", async () => {
  const w = await workerBodies();
  const { job2, chat2, entry, pending } = secondBuild(w);
  const polls = { [w.job]: 0, [job2]: 0 };
  const p = await browserPage({
    sites: [{ id: CHAT, name: "Fold Lane", msgs: [{ r: "u", t: BRIEF }] }],
    renders: 1,
    answer: (url) => {
      if (url === "/api/site/builds") return { status: 200, body: { builds: [entry, w.running.builds[0]] } };
      for (const j of [w.job, job2]) {
        if (url === "/api/site/build/" + j) return ++polls[j] < 2 ? { status: 202, body: j === w.job ? w.pending : pending } : { status: w.poll.status, body: w.poll.body };
      }
      return null;
    },
  });
  assert.ok(polls[w.job] >= 2 && polls[job2] >= 2, "the second build waited for a render that never came: " + JSON.stringify(polls));
  assert.equal(p.store.find((s) => s.id === chat2).slug, GOOD_DESIGN.slug);
  assert.equal(p.busy, false);
});

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

test("RC 23 — CODEX'S FALLBACK-BILLING REPRODUCTION: the queue send fails and the job is provably gone, so the producer takes the execution and runs inline; its deposit goes through build_debit against its own row, which the SQL refuses once the row is failed — so the row is held under the fallback's own lease (queued → claimed), the deposit is taken (one billing identity, build:<job>), the designer runs once, and the row is finalized only when the work ends; and a row the sweep already ended is still refused, at no charge", async () => {
  // (a) THE EXACT REPRODUCTION, against rows that move only as the SQL moves them.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    const rpc = [];
    const designs = [];
    globalThis.fetch = runNet({ rpc, designs, sql });
    let ans;
    try {
      const a = postBuild(b, queue(true), { env: { ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k" } });
      ans = await a;
      await a.settled();
    } finally { globalThis.fetch = blockedFetch; }
    const job = [...sql.rows.keys()][0];
    assert.ok(job && sql.rows.size === 1, "not exactly one row was filed");
    assert.equal(runOf(b, job).owner, "inline", "the fallback ran without the job's execution record");
    const debits = sql.of("build_debit");
    assert.ok(debits.length >= 1, "the fallback reached no deposit — this guard is watching nothing");
    assert.equal(debits[0].out.ok, true, "the fallback's deposit was refused: " + JSON.stringify(debits[0].out));
    assert.ok(debits.every((d) => d.args.p_id === job && String(d.args.p_ref).startsWith("build:" + job)), "billing outside the job's own identity: " + JSON.stringify(debits.map((d) => d.args)));
    assert.equal(designs.length, 1, "the designer did not run exactly once");
    assert.notEqual(ans.status, 503, "the fallback answered " + JSON.stringify(ans.body).slice(0, 200));
    assert.doesNotMatch(JSON.stringify(ans.body), /Credits check failed/);
    // VALID TRANSITIONS: no terminal write before the deposit; one at the end.
    const order = sql.calls.map((c) => c.fn);
    const firstDebit = order.indexOf("build_debit");
    assert.ok(!order.slice(0, firstDebit).some((f) => f === "edit_refund" || f === "edit_finalize"), "the row was ended before the fallback's deposit: " + order.join(","));
    const r = sql.row(job);
    assert.deepEqual(r.states.slice(0, 2), ["queued", "claimed"], "the fallback did not hold its row: " + r.states.join(" → "));
    assert.equal(r.states.length, 3, "the row did not end exactly once: " + r.states.join(" → "));
    assert.ok(["done", "failed"].includes(r.states[2]));
    const end = order.lastIndexOf(r.states[2] === "done" ? "edit_finalize" : "edit_refund");
    assert.ok(end > firstDebit, "the row was ended before the work");
    assert.equal(sql.calls[order.indexOf("edit_claim")].out.claimed, true, "the fallback did not take its row's lease");
  }
  // (b) CONTROL — THE TERMINAL GUARD STANDS: a row the sweep already marked
  // lost before the fallback could hold it is refused its deposit, and the
  // build designs nothing and charges nothing.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    const designs = [];
    const net = runNet({ designs, sql });
    globalThis.fetch = async (input, init) => {
      const u = String((input && input.url) || input || "");
      if (u.includes("/rpc/edit_claim")) { const id = JSON.parse(String(init.body)).p_id; const r = sql.row(id); if (r && r.state === "queued") { r.state = "lost"; r.states.push("lost"); } }
      return net(input, init);
    };
    let ans;
    try {
      const a = postBuild(b, queue(true), { env: { ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k" } });
      ans = await a;
      await a.settled();
    } finally { globalThis.fetch = blockedFetch; }
    const debits = sql.of("build_debit");
    assert.ok(debits.length >= 1 && debits.every((d) => d.out.ok === false && d.out.error === "terminal"), "a lost row's deposit was not refused: " + JSON.stringify(debits.map((d) => d.out)));
    assert.equal(designs.length, 0, "a refused deposit still designed");
    assert.equal(ans.status, 503, JSON.stringify(ans.body).slice(0, 200));
  }
});

test("RC 24 — CODEX'S LOST-RECORD-WRITE REPRODUCTION: the consumer's conditional builds-run write commits and then throws; read back, the record is its own attempt's, so this delivery runs it once; and when the read back fails too, the job is put back and asked again carrying the attempt, and the retry adopts its own unstarted attempt (its lease taken over by name) — one designer call, one deposit on one row, the build carried on, never stranded", async () => {
  const lostWrite = (b, job, { readFails = false } = {}) => {
    const put = b.put.bind(b);
    const get = b.get.bind(b);
    let armed = true, failRead = false;
    b.put = async (k, v, o) => {
      const r = await put(k, v, o);
      if (armed && k === buildRunKey(job) && o && o.onlyIf && o.onlyIf.etagDoesNotMatch === "*") { armed = false; failRead = readFails; throw new Error("R2: response lost after commit"); }
      return r;
    };
    b.get = async (k) => { if (failRead && k === buildRunKey(job)) { failRead = false; throw new Error("R2: read failed"); } return get(k); };
  };
  // (a) THE READ BACK FINDS ITS OWN TOKEN: the same delivery proceeds.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await fileRow(sql, JOB_X);
    lostWrite(b, JOB_X);
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over });
    assert.equal(designs.length, 1, "the delivery whose record write was lost did not run its job once");
    assert.equal(jobSends(q).length, 0, "a settled claim was asked again");
    const run = runOf(b, JOB_X);
    assert.deepEqual({ owner: run.owner, started: run.started }, { owner: "queue", started: true });
    const debits = sql.of("build_debit");
    assert.equal(debits.length, 1, "not one deposit");
    assert.equal(debits[0].out.ok, true);
    assert.ok(String(debits[0].args.p_ref).startsWith("build:" + JOB_X));
    assert.ok(b.store.has(resumeKey(JOB_X)), "the build did not carry on to its generation");
  }
  // (b) THE READ BACK FAILS TOO: put back, asked again with the attempt; the
  // retry adopts it.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await fileRow(sql, JOB_X);
    lostWrite(b, JOB_X, { readFails: true });
    const designs = [];
    const q1 = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over });
    assert.equal(designs.length, 0, "an unsettled claim executed");
    assert.equal(sql.of("build_debit").length, 0, "an unsettled claim charged");
    assert.equal(jobSends(q1).length, 1, "the unsettled attempt was not asked again — the accepted work is stranded");
    const retry = jobSends(q1)[0];
    const first = runOf(b, JOB_X);
    assert.ok(first && first.owner === "queue" && first.started !== true && retry.token === first.token, "the retry does not carry the attempt that holds the record: " + JSON.stringify({ retry, first }));
    assert.equal(retry.holder, sql.row(JOB_X).lease, "the retry does not name the lease its attempt holds");
    assert.equal(retry.waits, 1);
    assert.ok(b.store.has(jobKey(JOB_X)), "the job's input was not kept for the retry");
    const { kind: _k, id: _i, ...extra } = retry;
    const q2 = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over, msg: extra, keepJob: true });
    assert.equal(designs.length, 1, "the retry did not run the job exactly once");
    assert.equal(jobSends(q2).length, 0);
    const run = runOf(b, JOB_X);
    assert.deepEqual({ token: run.token, started: run.started }, { token: first.token, started: true }, "the retry ran under another attempt's name");
    const taken = sql.of("edit_handoff").filter((c) => c.args.p_owner === retry.holder);
    assert.ok(taken.length === 1 && taken[0].out.ok === true, "the retry did not take its attempt's lease over by name: " + JSON.stringify(taken.map((c) => c.out)));
    const debits = sql.of("build_debit");
    assert.equal(debits.length, 1, "not one deposit");
    assert.equal(debits[0].out.ok, true);
    assert.deepEqual(sql.row(JOB_X).states, ["queued", "claimed"], "the row moved outside the SQL's transitions");
    assert.ok(b.store.has(resumeKey(JOB_X)), "the build did not carry on to its generation");
  }
});

test("RC 25 — A GENUINELY ACTIVE COMPETING CONSUMER STAYS PROTECTED: a delivery finding another attempt that started (or an inline run) never executes or charges; one finding another attempt that claimed and has not started waits, its job kept and asked again; one finding an attempt that never started past its window replaces it, conditionally, and runs once", async () => {
  const seed = async (b, sql, { owner = "queue", started = false, age = 0, lease = "c_other99" } = {}) => {
    await fileRow(sql, JOB_X);
    await sql.over("https://x/rest/v1/rpc/edit_claim", { body: JSON.stringify({ p_id: JOB_X, p_owner: lease }) });
    await b.put(buildRunKey(JOB_X), JSON.stringify(packBuildRun({ job: JOB_X, owner, at: Date.now() - age, token: "c_other99", started })));
  };
  for (const [what, opts] of [["a started queued attempt", { started: true }], ["an inline run", { owner: "inline", started: true }]]) {
    const b = buildBucket();
    const sql = sqlJobs();
    await seed(b, sql, opts);
    const before = b.store.get(buildRunKey(JOB_X));
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over });
    assert.equal(designs.length, 0, what + " was run beside");
    assert.equal(sql.of("build_debit").length, 0, what + " was charged again");
    assert.equal(jobSends(q).length, 0, what + " was asked again");
    assert.equal(b.store.get(buildRunKey(JOB_X)), before, what + "'s record was touched");
    assert.equal(sql.row(JOB_X).lease, "c_other99", what + "'s lease was taken");
  }
  // PENDING: waited for, never run beside, never dropped.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await seed(b, sql);
    const before = b.store.get(buildRunKey(JOB_X));
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over });
    assert.equal(designs.length, 0, "a pending attempt was run beside");
    assert.equal(sql.of("build_debit").length, 0);
    assert.equal(b.store.get(buildRunKey(JOB_X)), before);
    assert.equal(jobSends(q).length, 1, "the waiting delivery was not asked again");
    assert.equal(jobSends(q)[0].waits, 1);
    assert.ok(b.store.has(jobKey(JOB_X)), "the job's input was dropped");
  }
  // RECOVERABLE: an attempt that never started past its window is replaced.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await seed(b, sql, { age: BUILD_RUN_START_MS + 1000 });
    sql.expire(JOB_X);
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over });
    assert.equal(designs.length, 1, "an attempt that never started stranded its job");
    assert.equal(jobSends(q).length, 0);
    const run = runOf(b, JOB_X);
    assert.ok(run.token !== "c_other99" && run.started === true && run.owner === "queue", "the stale attempt was not replaced: " + JSON.stringify(run));
    assert.equal(sql.of("build_debit").length, 1);
    assert.equal(sql.of("build_debit")[0].out.ok, true);
  }
  // AT THE BOUND THE JOB IS KEPT: a delivery that has waited its fill puts the
  // input back and sends nothing — never deletes it on a label.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await seed(b, sql);
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over, msg: { waits: 99 } });
    assert.equal(designs.length, 0);
    assert.equal(jobSends(q).length, 0, "a delivery past its bound was sent again");
    assert.ok(b.store.has(jobKey(JOB_X)), "a delivery past its bound dropped the job's input");
  }
});

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

test("RC 26 — CODEX'S RETRY REPRODUCTIONS: two copies of one retry, both reading the envelope before either deletes it, reach one designer between them — one lease handoff wins, the other copy does no work; a copy arriving after its attempt started never joins it, whether its handoff is refused or the lease has lapsed; and with no row to serialise them, the record alone admits one copy", async () => {
  const fired = [];
  // (a) CONCURRENT COPIES: the lease handoff from the attempt's lease decides.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    const retry = await leftForRetry(b, sql);
    const reads = bothReadEnvelope(b);
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: heldDesign, over: sql.over, msg: retry, keepJob: true, copies: 2, fire: async () => { fired.push("a"); } });
    assert.equal(reads(), 2, "the two copies did not both read the envelope — this case is watching nothing");
    assert.equal(designs.length, 1, "both copies of the retry designed: " + designs.length);
    const hand = sql.of("edit_handoff").filter((c) => c.args.p_owner === retry.holder);
    assert.deepEqual(hand.map((c) => c.out.ok), [true, false], "not one won and one refused handoff: " + JSON.stringify(hand.map((c) => c.out)));
    const run = runOf(b, JOB_X);
    assert.ok(run.started === true && run.token === retry.token, "the attempt was not started under its own token");
    assert.equal(run.holder, hand[0].args.p_next, "the record's holder is not the delivery that holds the lease");
    const debits = sql.of("build_debit");
    assert.equal(debits.length, 1, "the losing copy reached the deposit: " + debits.length);
    assert.ok(debits[0].out.ok === true && String(debits[0].args.p_ref).startsWith("build:" + JOB_X));
    assert.ok(fired.filter((f) => f === "a").length <= 1, "both copies launched work");
    assert.deepEqual(sql.row(JOB_X).states, ["queued", "claimed"]);
    assert.ok(jobSends(q).every((m) => m.token === retry.token), "a copy asked again under another attempt");
  }
  // (b) ARRIVING AFTER THE FIRST COPY STARTED: its handoff is refused, and
  // the started record is not joined.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    const retry = await leftForRetry(b, sql, { started: true, holder: "c_winner02", leaseTo: "c_winner02" });
    const before = b.store.get(buildRunKey(JOB_X));
    const designs = [];
    const q = await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over, msg: retry, keepJob: true, fire: async () => { fired.push("b"); } });
    assert.equal(designs.length, 0, "a copy arriving after its attempt started designed again");
    assert.equal(sql.of("build_debit").length, 0);
    assert.ok(!fired.includes("b"), "a refused copy launched the container");
    const hand = sql.of("edit_handoff");
    assert.ok(hand.length === 1 && hand[0].out.ok === false && hand[0].out.error === "not-holder", "the handoff was not refused: " + JSON.stringify(hand.map((c) => c.out)));
    assert.equal(b.store.get(buildRunKey(JOB_X)), before, "the started record was touched");
    assert.equal(sql.row(JOB_X).lease, "c_winner02", "the running copy's lease was taken");
    assert.equal(jobSends(q).length, 0, "a copy of a started attempt was asked again");
  }
  // (b2) …AND WITH THE LEASE LAPSED: the claim succeeds, but the record is
  // started by another delivery, so the matching token is still not permission.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    const retry = await leftForRetry(b, sql, { started: true, holder: "c_winner02", leaseTo: "c_winner02", expired: true });
    const designs = [];
    await fireInterim(b, JOB_X, ledger(), { designs, onDesign: designOk, over: sql.over, msg: retry, keepJob: true });
    assert.equal(designs.length, 0, "a matching token joined a started execution");
    assert.equal(sql.of("build_debit").length, 0);
    assert.equal(runOf(b, JOB_X).holder, "c_winner02");
  }
  // (c) NO ROW TO SERIALISE THEM: both copies reach the record, and only one
  // conditional takeover of the unstarted attempt can win.
  {
    const b = buildBucket();
    const sql = sqlJobs();
    await b.put(buildRunKey(JOB_X), JSON.stringify(packBuildRun({ job: JOB_X, owner: "queue", at: Date.now(), token: "c_attempt1", holder: "c_holder01" })));
    const reads = bothReadEnvelope(b);
    const designs = [];
    await fireInterim(b, JOB_X, ledger(), { designs, onDesign: heldDesign, over: sql.over, msg: { token: "c_attempt1", holder: "c_holder01", waits: 1 }, keepJob: true, copies: 2 });
    assert.equal(reads(), 2);
    assert.equal(sql.of("edit_claim").length, 2, "both copies did not reach the row claim");
    // ONE COPY GOT PAST THE RECORD: only it reaches the deposit (which the SQL
    // refuses `no-job`, there being no row, so neither designs at all).
    const debits = sql.of("build_debit");
    assert.equal(debits.length, 1, "with no row, both copies passed the record: " + debits.length);
    assert.equal(debits[0].out.error, "no-job");
    assert.equal(designs.length, 0);
    const run = runOf(b, JOB_X);
    assert.ok(run.started === true && run.holder !== "c_holder01" && run.token === "c_attempt1");
  }
  // (d) and (e): THE TWO LAYERS, EACH ON ITS OWN. With no row, copy B is held
  // at its row claim until copy A has taken the attempt over; then:
  //   (d) A pauses after its takeover until B has taken it over in turn — A's
  //       start must find the record no longer its own (only the holder starts);
  //   (e) A's start waits until B has read the record and reached its own
  //       takeover, and B's takeover waits until A has started — B's write,
  //       conditional on what it read, must not land over a started attempt.
  for (const kind of ["d", "e"]) {
    const b = buildBucket();
    const sql = sqlJobs();
    await b.put(buildRunKey(JOB_X), JSON.stringify(packBuildRun({ job: JOB_X, owner: "queue", at: Date.now(), token: "c_attempt1", holder: "c_holder01" })));
    bothReadEnvelope(b);
    const signal = () => { let r; const p = new Promise((res) => { r = res; }); p.fire = r; return p; };
    const aTook = signal(), bTook = signal(), bAtTake = signal(), aStarted = signal();
    let aHolder = "";
    const put = b.put.bind(b);
    b.put = async (k, v, o) => {
      if (k !== buildRunKey(JOB_X) || !(o && o.onlyIf && o.onlyIf.etagMatches)) return put(k, v, o);
      const r = JSON.parse(v);
      const isA = !aHolder || r.holder === aHolder;
      if (!r.started && !aHolder) { aHolder = r.holder; const out = await put(k, v, o); aTook.fire(); if (kind === "d") await bTook; return out; }
      if (!r.started && !isA) { if (kind === "e") { bAtTake.fire(); await aStarted; } const out = await put(k, v, o); bTook.fire(); return out; }
      if (r.started && isA && kind === "e") { await bAtTake; const out = await put(k, v, o); aStarted.fire(); return out; }
      return put(k, v, o);
    };
    let claims = 0;
    const over = async (u, init) => { if (String(u).includes("/rpc/edit_claim") && ++claims === 2) await aTook; return sql.over(u, init); };
    const designs = [];
    await fireInterim(b, JOB_X, ledger(), { designs, onDesign: heldDesign, over, msg: { token: "c_attempt1", holder: "c_holder01", waits: 1 }, keepJob: true, copies: 2 });
    assert.ok(aHolder, "(" + kind + ") no copy took the attempt over — this case is watching nothing");
    const debits = sql.of("build_debit");
    assert.equal(debits.length, 1, "(" + kind + ") both copies passed the record: " + debits.length);
    assert.equal(runOf(b, JOB_X).started, true);
  }
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
