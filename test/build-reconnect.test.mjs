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
import { buildLiveKey, buildKeptKey, buildChatKey, buildLiveState, readBuildLive, doneOutcome, markerJobOf, packBuildLive, packBuildChat, claimVerdict, holdsChat, listsBuild, BUILD_ACCEPT_MS, BUILD_LIVE_MS } from "../builder/build-live.mjs";
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
function postBuild(b, q, { token = "t", chat = CHAT } = {}) {
  const ctx = makeCtx();
  const p = (async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ brief: BRIEF, images: [], picker: "sonnet", qa: [], chat }),
    }), ENV(b, q), ctx);
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

test("RC 17 — A STORAGE FAILURE NEVER RUNS THE BUILD TWICE: the queue send fails after its message may have landed, and the job cannot be proven gone (its delete fails) — the build is NOT run inline; the queued job is kept, its row stays open, it is accepted and listed, and the consumer runs it once", async () => {
  const b = buildBucket();
  const del = b.delete.bind(b);
  b.delete = async (k) => { if (/^jobs\/[0-9a-f]{32}\.json$/.test(k)) throw new Error("R2 delete failed"); return del(k); };
  // THE AMBIGUOUS SEND: the message lands, and the producer is told it failed.
  const q = { sent: [], async send(m) { this.sent.push(m); throw new Error("queue: network reset after write"); }, async sendBatch() { throw new Error("no batch"); } };
  const rpc = [];
  globalThis.fetch = stand({ rpc });
  try {
    const a = postBuild(b, q);
    await until(() => q.sent.length > 0, 20000);
    assert.equal(q.sent.length, 1, "the build was never sent to the queue: " + JSON.stringify(rpc.map((r) => r.fn)) + " " + JSON.stringify([...b.store.keys()]));
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    const job = q.sent[0].id;
    assert.ok(b.store.has(jobKey(job)), "the queued job was dropped");
    assert.equal(edits(rpc, "edit_refund").length, 0, "the row was closed as if the build ran inline");
    const m = readBuildLive(JSON.parse(b.store.get(buildLiveKey(BUILD_USER.id, job))));
    assert.deepEqual({ accepted: m.accepted, inline: m.inline }, { accepted: true, inline: false }, "the kept build was not marked accepted");
    const listed = await call(b, queue(), stand({ rows: { [job]: { state: "queued" } } }), "GET", "/api/site/builds");
    assert.deepEqual(listed.body.builds.map((x) => [x.job, x.state]), [[job, "running"]]);
    // THE CONSUMER RUNS IT (once), and the waiting POST collects that build's answer.
    await fireInterim(b, job, ledger(), { design: GOOD_DESIGN });
    const ans = await a;
    assert.equal(ans.status, 202, JSON.stringify(ans.body).slice(0, 300));
    assert.equal(ans.body.job, job, "the POST answered with something other than the one queued build");
    assert.equal(edits(rpc, "edit_create").length, 1);
  } finally { globalThis.fetch = blockedFetch; }
  // AND ON THE STORE SIDE: the job's write lands but the producer is told it
  // failed, and the delete that would prove it gone fails too. The queued
  // path is kept (the message is sent), never an inline build beside it.
  const b2 = buildBucket();
  const put2 = b2.put.bind(b2);
  b2.put = async (k, v, o) => { const r = await put2(k, v, o); if (/^jobs\/[0-9a-f]{32}\.json$/.test(k)) throw new Error("R2: reset after write"); return r; };
  const del2 = b2.delete.bind(b2);
  b2.delete = async (k) => { if (/^jobs\/[0-9a-f]{32}\.json$/.test(k)) throw new Error("R2 delete failed"); return del2(k); };
  const q2 = queue();
  const rpc2 = [];
  globalThis.fetch = stand({ rpc: rpc2 });
  try {
    const a2 = postBuild(b2, q2);
    await until(() => q2.sent.length > 0, 20000);
    assert.equal(q2.sent.length, 1, "a job that may be stored was run inline instead of queued");
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    assert.equal(edits(rpc2, "edit_refund").length, 0, "the row was closed as if the build ran inline");
    assert.equal(readBuildLive(JSON.parse(b2.store.get(buildLiveKey(BUILD_USER.id, q2.sent[0].id)))).accepted, true);
    await settlePost(b2, { job: q2.sent[0].id, answer: a2 });
  } finally { globalThis.fetch = blockedFetch; }
  // AND WHEN THE READ-BACK ITSELF FAILS: a send that failed, then a check of
  // the job that cannot answer, is not proof the job is gone — no inline build.
  const b3 = buildBucket();
  const head3 = b3.head.bind(b3);
  b3.head = async (k) => { if (/^jobs\/[0-9a-f]{32}\.json$/.test(k)) throw new Error("R2 read failed"); return head3(k); };
  const q3 = { sent: [], async send(m) { this.sent.push(m); throw new Error("queue: reset"); }, async sendBatch() { throw new Error("no batch"); } };
  const rpc3 = [];
  globalThis.fetch = stand({ rpc: rpc3 });
  try {
    const a3 = postBuild(b3, q3);
    await until(() => q3.sent.length > 0, 20000);
    for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r));
    const job3 = q3.sent[0].id;
    assert.equal(edits(rpc3, "edit_refund").length, 0, "an unreadable job was taken as gone and the build run inline");
    assert.equal(readBuildLive(JSON.parse(b3.store.get(buildLiveKey(BUILD_USER.id, job3)))).accepted, true);
    await settlePost(b3, { job: job3, answer: a3 });
  } finally { globalThis.fetch = blockedFetch; }
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
    assert.equal(edits(rpc, "edit_refund").length, 1, "the gone job's row was not closed");
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

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
