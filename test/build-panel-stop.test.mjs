// THE FIRST BUILD IN THE BACKGROUND PANEL, WITH A REAL STOP (2026-10-24, the
// owner; branch build-panel-stop).
//
// Before this branch a first build's Stop aborted only the browser's own
// follow ("■ Stopped. (A build already running may still finish
// server-side.)"): nothing reached the server, so the build ran on, published
// and was charged. The queued build already read a Stop at its stage
// boundaries (S3-4, `edit_beat` → `cancel`), but no page ever sent one, and an
// inline fallback build carried no check at all.
//
//   PANEL  a running first build is a row of its own in the panel: its title
//          the model's first line, its job view every line, its Stop the
//          server's; it is kept on the project for a reload; stopped, it
//          shows the stopped state and the build's own reply.
//   ROUTE  `POST /api/site/build-stop` marks the build's row cancelled
//          (`edit_cancel`, owner-scoped), by job or — for a build the page has
//          no job id for — by its chat's claim; too late says so.
//   INLINE an inline fallback build reads the Stop on its held row at the
//          next stage boundary, reverses every debit by ref, publishes
//          nothing, and answers 410 `cancelled` with the facts.
//   QUEUED is `test/build-stop-midway.test.mjs` (unchanged, still green).
//
// Only the network is faked (GoTrue, the ledger and edit RPCs, Anthropic);
// R2 is a Map; no paid call, no container, no live data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { blockedFetch, noteUnexpected } from "./fixtures/no-network.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { buildBucket, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";
import { buildChatKey, packBuildChat } from "../builder/build-live.mjs";
import { STOPPED_FREE_MSG } from "../builder/build-lease.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });
const USER = { id: "0f3c2a1b-aaaa-4bbb-8ccc-1234567890ab", email: "o@example.com" };
const CHAT_ID = "site_1729000000000_ab12c";
const JOB = "d1b2c3d4e5f60718293a4b5c6d7e8f92";

// ── THE PAGE ────────────────────────────────────────────────────────────────
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n}\n", open) + 3);
}
function cutConst(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const line = CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
  if (!/\{\s*$/.test(line)) return line;
  return CHAT.slice(open, CHAT.indexOf("\n};\n", open) + 4);
}
const FNS = ["esc", "progressListHTML", "siteSaidFor", "siteParState", "siteParTitle", "siteParTag", "siteRequestWorking", "siteRunningWork", "siteBusyHere", "siteComposerStops",
  "siteBgState", "siteBgKeep", "siteBgItems", "siteBgWhen", "siteBgLine", "siteBgHTML", "siteBgJobHTML", "siteBgPaint", "siteBgScrolled", "siteBgClick", "siteBgStopAll", "siteBgStopPart",
  "siteBuildJobLines", "siteBuildJobBegin", "siteBuildJobEnd", "siteBuildJobItem", "siteBuildServerStop", "siteStopWork", "siteStop", "setBuildProgress"];
const CONSTS = ["const SITE_PAR_STATE =", "const SITE_PAR_LABEL =", "const SITE_REQ_PREP =", "const SITE_SAID_FOR =", "const SITE_BG_KEEP_MS =", "const siteBgUi =", "const SITE_BG_KEEP_KEY ="];
const src = () => [...FNS.map((n) => cut("function " + n + "(")), ...CONSTS.map(cutConst)].join("\n");

function page(site, { answer = { status: 200, body: { ok: true, job: JOB, status: "running", cancel: true } }, busy = true } = {}) {
  const posts = [], toasts = [], aborts = [];
  const host = { innerHTML: "", onclick: null, querySelector: () => null };
  const ctx = vm.createContext({
    EditPoll, console, setTimeout: () => 0, clearTimeout: () => {},
    siteOpenId: site.id, siteBusy: busy, siteBusyFor: busy ? site.id : null, siteBuild: null,
    siteAborts: new Map([[site.id, { abort: () => aborts.push(site.id) }]]), siteAbort: null,
    document: { getElementById: (id) => (id === "stBg" ? host : null) },
    siteById: (id) => (id === site.id ? site : null),
    siteJobOutcome: () => "done", sitePages: (s) => s.pages || [],
    sitesSave: () => {}, renderSites: () => {}, paintReactLive: () => {},
    siteRequestStop: () => {}, siteMsgText: (m) => m.t,
    sbToast: (t) => toasts.push(t),
    apiFetch: async (url, init) => { posts.push([url, init && init.method, init && init.body ? JSON.parse(init.body) : null]); return { ok: answer.status < 300, status: answer.status, json: async () => answer.body }; },
  });
  vm.runInContext(src(), ctx);
  const el = (attrs) => ({ getAttribute: (k) => (Object.hasOwn(attrs, k) ? attrs[k] : null) });
  const press = (attrs) => ctx.siteBgClick({ target: { closest: () => el(attrs) } }, site.id);
  return { ctx, posts, toasts, aborts, host, press, html: (now) => ctx.siteBgHTML(site, now) };
}
const text = (h) => h.replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const flush = () => new Promise((r) => setImmediate(r));
const fresh = () => ({ id: CHAT_ID, msgs: [{ r: "u", t: BRIEF }], requests: {}, jobCards: {} });

test("PANEL — a running first build is a row: its title is the model's first line, its line the newest, and the box keeps Send", () => {
  const site = fresh();
  const p = page(site);
  p.ctx.siteBuildJobBegin(CHAT_ID, JOB, BRIEF);
  assert.equal(site.buildJob.job, JOB);
  assert.equal(site.buildJob.state, "run");
  // RE-ANCHORED 2026-10-24 (combine-d): task-label renamed the pill's "things" to "tasks".
  assert.match(text(p.html()), /1 task in progress/, "the pill does not count the build");
  p.press({ "data-bg": "open" });
  // ITS TITLE IS A FIXED LABEL UNTIL THE MODEL WRITES, then the model's own first line.
  assert.match(text(p.html()), /Building your site/);
  p.ctx.setBuildProgress(CHAT_ID, [{ text: "Planning a warm bakery site with a collection order form" }, { text: "Designing the menu table" }]);
  const t = text(p.html());
  assert.match(t, /Planning a warm bakery site with a collection order form/, "the row is not titled by the model's first line");
  assert.match(t, /Designing the menu table/, "the row's line is not the newest line");
  assert.equal(p.ctx.siteComposerStops(site), false, "the box swapped Send for Stop while the build is in the panel");
});

test("PANEL — the build's job view follows its lines and carries Stop; Stop posts the server's stop with its job", async () => {
  const site = fresh();
  const p = page(site);
  p.ctx.siteBuildJobBegin(CHAT_ID, JOB, BRIEF);
  p.ctx.setBuildProgress(CHAT_ID, [{ text: "Planning" }, { text: "Writing the home page" }]);
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": "build|0" });
  let h = p.html();
  assert.match(h, /st-bg-jobview/);
  assert.match(text(h), /You asked: “Harbour Loaf/);
  assert.match(text(h), /Writing the home page/);
  assert.match(h, /data-bg="stop" data-bg-id="build\|0"/, "the build's view has no Stop");
  p.ctx.setBuildProgress(CHAT_ID, [{ text: "Planning" }, { text: "Writing the home page" }, { text: "Checking it renders" }]);
  assert.match(text(p.html()), /Checking it renders/, "the job view did not follow the new line");
  p.press({ "data-bg": "stop", "data-bg-id": "build|0" });
  assert.equal(site.buildJob.state, "stopping");
  assert.match(text(p.html()), /Stopping…/);
  await flush();
  assert.deepEqual(p.posts.map((x) => [x[0], x[1], x[2]]), [["/api/site/build-stop", "POST", { job: JOB, chat: CHAT_ID }]], "Stop did not reach the server");
  assert.deepEqual(p.aborts, [], "Stop let go of the follow instead of waiting for the build's own answer");
  assert.equal(site.buildJob.state, "stopping", "a stop the server marked was undone");
});

test("PANEL — the box's Stop on a first build is the server's too; with no job id it names the chat, and only a build the server does not know lets go", async () => {
  const site = fresh();
  const p = page(site, { answer: { status: 404, body: { ok: false, error: "not found" } } });
  p.ctx.siteStopWork(site);
  await flush();
  assert.deepEqual(p.posts.map((x) => x[2]), [{ chat: CHAT_ID }]);
  assert.deepEqual(p.aborts, [CHAT_ID], "a build the server did not know was not let go of");
  const q = page(fresh());
  q.ctx.siteStopWork(siteFor(q));
  await flush();
  assert.deepEqual(q.aborts, [], "a marked inline build was let go of before its answer");
});
function siteFor(p) { return vm.runInContext("siteById(siteOpenId)", p.ctx); }

test("PANEL — too late, or a failed stop, says so and keeps the build running in the panel", async () => {
  for (const [answer, said] of [[{ status: 409, body: { ok: false, error: "too-late" } }, /Too late to stop/], [{ status: 503, body: { ok: false } }, /Couldn’t stop the build just now/]]) {
    const site = fresh();
    const p = page(site, { answer });
    p.ctx.siteBuildJobBegin(CHAT_ID, JOB, BRIEF);
    p.ctx.siteBgStopAll(site);
    await flush();
    assert.equal(site.buildJob.state, "run");
    assert.match(p.toasts.join(" "), said);
  }
});

test("PANEL — stopped: the row says Stopped and its view shows the build's own reply; a reload keeps it (it lives on the project)", () => {
  const site = fresh();
  const p = page(site);
  p.ctx.siteBuildJobBegin(CHAT_ID, JOB, BRIEF);
  p.ctx.setBuildProgress(CHAT_ID, [{ text: "Planning" }]);
  const reply = "I stopped your build before it wrote any pages, and you weren't charged for it.";
  p.ctx.siteBuildJobEnd(CHAT_ID, false, { ok: false, cancelled: true, cost: 0, msg: reply });
  assert.equal(site.buildJob.state, "stopped");
  p.press({ "data-bg": "open" });
  assert.match(text(p.html()), /Stopped · just now/);
  assert.doesNotMatch(p.html(), /data-bg="stop"/, "a stopped build still offers Stop");
  p.press({ "data-bg-row": "build|0" });
  assert.match(text(p.html()), new RegExp(reply.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // A RELOAD: the record is plain data on the project, read by a new page.
  const again = JSON.parse(JSON.stringify(site));
  const p2 = page(again, { busy: false });
  p2.press({ "data-bg": "open" });
  assert.match(text(p2.html()), /Stopped/);
  // AND IT DROPS OFF after the keep window, like every finished row.
  assert.equal(p2.ctx.siteBgItems(again, Date.now() + 6 * 60 * 1000).length, 0);
});

test("PANEL — the follow drives the row: a 202 begins it and the final answer ends it (wired in reactSend, both guarded)", () => {
  const rs = cut("function reactSend(");
  const begin = rs.indexOf("siteBuildJobBegin(origin, d.job, t)");
  const follow = rs.indexOf("const done = await followBuildJob(d.job");
  const end = rs.indexOf("siteBuildJobEnd(origin,");
  assert.ok(begin > 0 && follow > begin && end > follow, "the row is not begun before the follow and ended after it");
  const send = cut("function wireSiteComposer(");
  assert.match(send, /site\.buildJob && \(site\.buildJob\.state === 'run'[^\n]*sbToast\('Your site is still being built/, "a message sent during the build is not held and said");
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────
async function stopRoute(body, { cancel = { ok: true, state: "running", cancel: true }, auth = true, bucket = buildBucket() } = {}) {
  const rpc = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return auth ? json(USER) : json({ msg: "no" }, 401);
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      delete args.p_mint;
      rpc.push({ fn: m[1], args });
      if (m[1] === "edit_cancel") return json(cancel);
      return json({ ok: true });
    }
    noteUnexpected("GET", url, "build-panel-stop");
    return new Response("no", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: bucket, SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m" };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/build-stop", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify(body) }), env, makeCtx());
    return { status: res.status, body: await res.json(), rpc };
  } finally { globalThis.fetch = blockedFetch; }
}

test("ROUTE — by job: the row is cancelled through `edit_cancel` under the caller's own id", async () => {
  const r = await stopRoute({ job: JOB });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, job: JOB, status: "running", cancel: true });
  assert.deepEqual(r.rpc.filter((x) => x.fn === "edit_cancel").map((x) => x.args), [{ p_id: JOB, p_uid: USER.id }]);
});

test("ROUTE — by chat: the account's own chat claim names the build; an ended claim, no claim or a bad id names nothing", async () => {
  const bucket = buildBucket({ [buildChatKey(USER.id, CHAT_ID)]: JSON.stringify(packBuildChat({ job: JOB, at: 1 })) });
  const r = await stopRoute({ chat: CHAT_ID }, { bucket });
  assert.equal(r.status, 200);
  assert.deepEqual(r.rpc.map((x) => x.args), [{ p_id: JOB, p_uid: USER.id }]);
  const ended = buildBucket({ [buildChatKey(USER.id, CHAT_ID)]: JSON.stringify(packBuildChat({ job: JOB, at: 1, ended: true })) });
  for (const [body, b] of [[{ chat: CHAT_ID }, ended], [{ chat: CHAT_ID }, buildBucket()], [{ job: "nope" }, buildBucket()], [{}, buildBucket()]]) {
    const x = await stopRoute(body, { bucket: b });
    assert.equal(x.status, 404, JSON.stringify(body));
    assert.equal(x.rpc.length, 0, "a row was cancelled for " + JSON.stringify(body));
  }
});

test("ROUTE — too late is said (409); another account's job is not found (404); signed out is 401", async () => {
  const late = await stopRoute({ job: JOB }, { cancel: { ok: false, error: "too-late", state: "done" } });
  assert.equal(late.status, 409);
  assert.equal(late.body.error, "too-late");
  const other = await stopRoute({ job: JOB }, { cancel: { ok: false, error: "no-job" } });
  assert.equal(other.status, 404);
  const out = await stopRoute({ job: JOB }, { auth: false });
  assert.equal(out.status, 401);
  assert.equal(out.rpc.length, 0);
});

// ── AN INLINE FALLBACK BUILD ────────────────────────────────────────────────
/** The build route with a queue that cannot take the job, so it runs inline under its held row. */
async function driveInline({ cancelFrom = Infinity, claim = true } = {}) {
  const seen = { tools: [], rpc: [], beats: 0 };
  let claimed = false;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      delete args.p_mint;
      seen.rpc.push({ fn: m[1], args });
      if (m[1] === "edit_create") return json({ ok: true, id: args.p_id });
      if (m[1] === "edit_claim") return claim ? json({ ok: true, claimed: true, state: "claimed", billing: "external", uid: USER.id }) : json({ ok: false, error: "no-job" });
      if (m[1] === "edit_beat") { seen.beats++; return json({ ok: true, alive: true, state: "claimed", cancel: seen.beats >= cancelFrom }); }
      if (m[1].startsWith("edit_") || m[1] === "deploy_gate_read") return json({ ok: true });
      if (m[1] === "build_debit") return new Response("{}", { status: 404 });
      if (m[1] === "credit_debit") return json({ ok: true, exempt: false, taken: Number(args.p_amount) || 2, balance: 500, repeat: false });
      if (m[1] === "credit_reverse") return json({ ok: true, refunded: String(args.p_ref).endsWith(":deposit") || String(args.p_ref).endsWith(":settle") ? 2 : 0, already: 0, debited: 2, repeat: false });
      if (m[1] === "use_quota") return json(true);
      if (m[1] === "get_credits") return json(500);
      return json({ ok: false, error: "no stub for " + m[1] }, 500);
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "POST") { claimed = true; return json([{ slug: "x", uid: USER.id }], 201); }
      return json(claimed ? [{ uid: USER.id, neon_db: "", brief: BRIEF }] : []);
    }
    if (url.includes("neon.tech")) return new Response("no neon here", { status: 503 });
    if (url.includes("/v1/messages")) {
      const b = JSON.parse(String((init && init.body) || "{}"));
      const tool = (b.tool_choice && b.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === "design_schema") return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } });
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    if (url.includes("/rest/v1/")) return json([]);
    noteUnexpected(method, url, "build-panel-stop inline");
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  const bucket = buildBucket();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: bucket, BUILD_QUEUE: { send: async () => { throw new Error("queue down"); } }, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-build", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify({ picker: "sonnet", brief: BRIEF, images: [], qa: [], chat: CHAT_ID }) }), env, ctx);
    const reply = await res.json().catch(() => null);
    for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
    return { status: res.status, reply, seen, store: bucket.store };
  } finally { globalThis.fetch = blockedFetch; c.uninstall(); }
}
const step = (x) => String(x.args.p_ref || "").split(":").pop();
const debits = (seen) => seen.rpc.filter((x) => x.fn === "credit_debit").map(step);
const reversals = (seen, reason) => seen.rpc.filter((x) => x.fn === "credit_reverse" && (!reason || x.args.p_reason === reason)).map(step);
const published = (store) => [...store.keys()].filter((k) => k.startsWith("current/") || k.startsWith("drafts/") || /^sites\/[^/]+\/live/.test(k));

test("INLINE — the control: the queue down, the build runs inline under its held row past every gate, not cancelled", async () => {
  const r = await driveInline();
  assert.ok(r.reply, "no answer");
  assert.notEqual(r.reply.cancelled, true);
  assert.ok(r.seen.rpc.some((x) => x.fn === "edit_claim"), "the inline build never held its row — this case is not the inline path");
  assert.ok(r.seen.tools.includes("design_schema"));
  assert.deepEqual(reversals(r.seen, "cancelled"), []);
  assert.ok(r.seen.beats >= 3, "the stage boundaries were not asked (" + r.seen.beats + " beats)");
});

test("INLINE — a Stop read before the design: the design call never runs, the deposit is reversed, nothing is published, 410 with the facts", async () => {
  const r = await driveInline({ cancelFrom: 1 });
  assert.equal(r.status, 410, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.cancelled, true);
  assert.equal(r.reply.stage, "design");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.reply.msg, STOPPED_FREE_MSG, "the writer is unreachable here, so the fixed fallback is the reply");
  assert.ok(!r.seen.tools.includes("design_schema"), "the design call ran after the Stop");
  assert.deepEqual(debits(r.seen), ["deposit"]);
  assert.deepEqual(reversals(r.seen, "cancelled"), ["deposit", "settle", "pages"], "not every ref was reversed");
  assert.deepEqual(published(r.store), []);
});

test("INLINE — a Stop read after the design refuses the next stage: no later model call, deposit and settlement reversed, never charged", async () => {
  const r = await driveInline({ cancelFrom: 2 });
  assert.equal(r.status, 410, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.stage, "provision");
  assert.equal(r.reply.cost, 0);
  assert.ok(r.seen.tools.includes("design_schema"));
  assert.ok(!r.seen.tools.some((t) => t && t !== "design_schema"), "a later model call ran after the Stop");
  assert.deepEqual(reversals(r.seen, "cancelled"), ["deposit", "settle", "pages"]);
  assert.deepEqual(published(r.store), []);
});

test("INLINE — the facts the reply is written from name the stop and its money (`buildFacts` failure kind stopped, cost 0)", () => {
  const at = W.indexOf("const stoppedAnswer = async (stage) => {");
  const body = W.slice(at, W.indexOf("\n      };\n", at));
  assert.ok(at > 0);
  assert.match(body, /narrateBuild\(env, \{/);
  assert.match(body, /cancelled: true/);
  assert.match(body, /failure: \{ kind: "stopped", cost: 0, short: !!short \}/);
  // AND THE INLINE ROUTE HANDS ITS CHECK TO THE ONE BUILD DEFINITION.
  assert.match(W, /runSiteBuild\(buildReq, env, \{ rec, tr, budget, auth, billId: inlineBill, stopCheck: inlineStop \}\)/);
});
