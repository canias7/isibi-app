// A PART PUT OFF SURVIVES THE BACKGROUND REWRITE: 202, RESUME, RETRIES, AND
// EVERY FINAL REPLY (2026-10-02, the owner's review of batch 2).
//
// Owner: *"persist every deferred part through background rewrite storage,
// resume, retries, and final success/failure replies so the browser still
// reports it … Add focused regressions covering 202→resume→final browser
// reply … asserting both the actual model inputs and complete deferred
// reporting."*
//
// REPRODUCED FIRST on 03189a0d, through this file's own chain: a queued rewrite
// whose generation runs in the container answered 202 naming the part put off
// (the build's wrapper adds it to every answer the build writes) — and then the
// answer the customer finally reads, written minutes later by the RESUME from
// the record the 202 left, named nothing. The record had no field for it, the
// collector composed its answer without it, the poll route replayed that answer
// byte for byte, and the browser trusts a final answer's own account. So
// "I'll do that next" never reached the screen of anyone whose rewrite was long
// enough to fire.
//
// WHAT THIS FILE HOLDS, every hop driven:
//
//   * the RECORD — `packResume`/`readResume` keep the parts, all or nothing, and
//     a record written before the field existed reads as naming none;
//   * the CHAIN — the real `/api/site/react-revise` route, queued: the real
//     consumer, the real build, the real fire into a container that takes the
//     job, then the real resume message through `worker.queue`, the real
//     collector and publish, and the real poll route — on the ordinary finish,
//     on a RETRY (the generation lost, fired again, the record rewritten), and
//     on a GIVE-UP (the generation failed upstream, the stand-in published).
//     The model inputs are read off the requests each model really received:
//     the designer's and the page writer's (the job the container was handed);
//   * the POLL ROUTE'S OWN VERDICT for a build lost after its fire, and the
//     QUEUED ROUTE'S OWN ANSWER when the consumer's answer will not read — the
//     two final replies no build writes;
//   * the BROWSER — `reactSend` and `followBuildJob` cut out of public/chat.js,
//     handed the very bodies the chain produced, and its last sentence read.
//
// Every model answer is SUPPLIED: what is shown is what the code does with an
// answer, never how often a real model gives one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler, getContainer } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
// A NAMESPACE, so a module without the bounds still loads and every other case
// here reports on its own (the red check runs this file against the code
// before the round, which has no such constants).
import * as resumeMod from "../builder/build-resume.mjs";
import { JOB_KIND, resultKey } from "../builder/build-job.mjs";
import { MAX_HELD, MAX_MESSAGE } from "../builder/site-ask.mjs";

const EP = createRequire(import.meta.url)("../public/edit-poll.js");
const { packResume, readResume, resumeKey, genKey } = resumeMod;

// ── THE RECORD ──────────────────────────────────────────────────────────────

const BASE = { id: "a1b2c3d4e5f60718293a4b5c6d7e8f90", auth: "", uid: "u-1", slug: "s", lane: "site-s", genId: "gen-1", firedAt: Date.now(), charged: [], design: { brand: "S" } };

test("the record keeps the parts put off, all or nothing, and one written before the field existed names none", () => {
  const round = (deferred) => readResume(JSON.parse(JSON.stringify(packResume({ ...BASE, deferred })))).deferred;
  assert.deepEqual(round(["add a page for our cake orders"]), ["add a page for our cake orders"]);
  assert.deepEqual(round(["add a map", "make the header navy"]), ["add a map", "make the header navy"]);
  assert.deepEqual(round(["add a map", "add a map"]), ["add a map"], "the same part twice is one part");
  assert.deepEqual(round([]), []);
  assert.deepEqual(round(undefined), [], "absent is none");
  // ALL OR NOTHING: a record this module did not write names nothing rather
  // than half of something — never a value read out of junk.
  assert.deepEqual(round(["add a map", 7]), []);
  assert.deepEqual(round(["add a map", " "]), []);
  assert.deepEqual(round("add a map"), [], "a bare string is not the record's shape");
  assert.deepEqual(round(["a", "b", "c", "d", "e"]), [], "more parts than a hand-over carries");
  assert.deepEqual(round(["x".repeat(MAX_MESSAGE + 1)]), [], "a part longer than any message (the record's bound is the hand-over's, below)");
  assert.deepEqual(round(["x".repeat(MAX_MESSAGE)]), ["x".repeat(MAX_MESSAGE)]);
  // AN OLDER RECORD — no field at all — still resumes, and names none.
  const old = packResume(BASE);
  delete old.deferred;
  const read = readResume(JSON.parse(JSON.stringify(old)));
  assert.ok(read, "a record written before the field existed no longer resumes");
  assert.deepEqual(read.deferred, []);
  // AND A JUNK FIELD ON THE WAY IN IS NARROWED ON THE WAY OUT TOO.
  assert.deepEqual(readResume({ ...JSON.parse(JSON.stringify(old)), deferred: { part: "x" } }).deferred, []);
});

test("the record's bounds are the hand-over's own", () => {
  assert.equal(resumeMod.MAX_RESUME_DEFERRED, MAX_HELD, "a record could name more parts than a hand-over carries, or fewer");
  assert.equal(resumeMod.MAX_RESUME_DEFERRED_CHARS, MAX_MESSAGE, "a record could keep a part longer than any message, or cut one short");
});

// ── THE CHAIN ───────────────────────────────────────────────────────────────

const page = (route, body) => "import { createFileRoute, Link } from \"@tanstack/react-router\";\n"
  + "export const Route = createFileRoute(\"" + route + "\")({ component: Page });\n"
  + "function Page() { return <main>" + body + "</main>; }\n";
const HOME = page("/", "<h1>Harbour Loaf</h1><Link to=\"/menu\">Menu</Link>");
const HOME_EDITED = page("/", "<h1>Harbour Loaf — open from 7</h1><Link to=\"/menu\">Menu</Link>");
const MENU = page("/menu", "<h1>Menu</h1><p>Sourdough, rye, buns.</p>");
const VISIT = page("/visit", "<h1>Visit</h1><p>Quay Street.</p>");
const PRIOR = [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }, { path: "visit.tsx", source: VISIT }];
const SAY = "Say we open from 7 on the home page";
const LATER = "add a page for our cake orders";
const MAP = "add a map of the shop";
const MIXED = SAY + ", " + LATER + ", and " + MAP + ".";
const USER = { id: "u-resume-1", email: "owner@example.com" };
const HAND = { from: "look", reason: "build", field: "kind" };
const HAND_LINE = "Handed on by the look step: the change needs the whole site rebuilt. The part of the site: kind.";
const rjson = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** The page writer's answer, in the shape the model returns it — what the container reports. */
const WRITER_ANSWER = { stop_reason: "tool_use", content: [{ type: "tool_use", name: SITE_PAGES_TOOL.name, input: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], notes: "Updated the home page." } }], usage: { input_tokens: 100, output_tokens: 50 } };

/** An R2 stand-in with the etags the resume's claim is a compare-and-set on. */
function bucket(entries) {
  const store = new Map(entries);
  const etags = new Map();
  let n = 0;
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { key: k, etag: etags.get(k) || "e0", text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer }; },
    async put(k, v, opts) {
      if (opts && opts.onlyIf && opts.onlyIf.etagMatches && (etags.get(k) || "e0") !== opts.onlyIf.etagMatches) return null;
      store.set(k, String(v)); etags.set(k, "e" + (++n)); return { key: k, etag: etags.get(k) };
    },
    async delete(k) { store.delete(k); etags.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * ONE REWRITE THROUGH THE QUEUE, THE FIRE, THE RESUME AND THE POLL.
 *
 * `report` decides what the container left for the first look: `"done"` the
 * page writer's answer; `"lost"` nothing, and the container no longer knows the
 * job, so the build fires again (the retry) and the second look finds the
 * answer under the NEW record's token; `"failed"` an upstream failure, so the
 * build gives up and publishes the stand-in. Returns every hop's evidence.
 */
async function chain({ report = "done", alsoAsked = [LATER, MAP], handOver = HAND } = {}) {
  const slug = "resume-" + Math.random().toString(36).slice(2, 8);
  const b = bucket([
    ["source/" + slug + "/pages.json", JSON.stringify(PRIOR)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" })],
  ]);
  const prompts = [];
  const fires = [];
  const resumes = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (/\/rest\/v1\/rpc\/edit_\w+/.test(url)) return rjson({ ok: true, claimed: true, state: "claimed", uid: USER.id, slug, job: { id: "x", uid: USER.id, slug } });
    if (url.includes("/auth/v1/user")) return rjson(USER);
    if (url.includes("/rpc/credit_debit")) return rjson({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false });
    if (url.includes("/rpc/credit_reverse")) return rjson({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false });
    if (url.includes("/rpc/use_quota")) return rjson(true);
    if (url.includes("/rpc/get_credits")) return rjson(500);
    if (url.includes("/rpc/use_credits")) return rjson(Number(args.cost) || 0);
    if (url.includes("/rest/v1/site_backends")) return method === "GET" ? rjson([{ uid: USER.id, neon_db: "", brief: "a bakery" }]) : rjson([]);
    if (url.includes("/rest/v1/")) return rjson([]);
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      prompts.push({ tool, text: JSON.stringify(args.messages || []) + JSON.stringify(args.system || "") });
      if (tool === "design_schema") return rjson({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }], components: [], css: "" } }], usage: { input_tokens: 100, output_tokens: 50 } });
      return new Response("no stub for " + tool, { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  const worker = await loadWorker();
  // THE CONTAINER TAKES EACH GENERATION JOB AND NAMES IT; asked about one, it
  // answers what this case says. Everything else is the compiler's hop.
  const container = {
    idFromName: (n) => n,
    get: () => ({ async fetch(req) {
      const u = String(req.url || req);
      if (u.includes("/model/start")) { fires.push(JSON.parse(await req.text())); return rjson({ ok: true, id: "gen-" + fires.length }); }
      if (u.includes("/model/result")) return rjson({ state: "unknown" });
      return getContainer(null, "build").fetch(req);
    } }),
  };
  const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: container };
  // THE QUEUE: a build job is consumed at once by the real consumer (so the
  // POST's own wait finds its answer on the first look); a resume is kept for
  // the case to deliver when the container has answered.
  env.BUILD_QUEUE = {
    async send(msg) {
      if (msg && msg.kind === JOB_KIND) { const ctx = makeCtx(); await worker.queue({ messages: [{ body: msg, ack() {}, retry() {} }] }, env, ctx); await Promise.allSettled(ctx.pending); }
      else resumes.push(msg);
    },
    async sendBatch() { throw new Error("no batch"); },
  };
  const deliver = async (msg) => { const ctx = makeCtx(); await worker.queue({ messages: [{ body: msg, ack() {}, retry() {} }] }, env, ctx); await Promise.allSettled(ctx.pending); };
  const recordOf = (id) => { const raw = b.store.get(resumeKey(id)); return raw ? readResume(JSON.parse(raw)) : null; };
  try {
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-revise", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ slug, instruction: MIXED, picker: "sonnet", alsoAsked, handOver }),
    }), env, ctx);
    const post = { status: res.status, body: await res.json().catch(() => null) };
    await Promise.allSettled(ctx.pending);
    const job = post.body && post.body.job;
    const records = [recordOf(job)];
    if (records[0] && report === "done") b.store.set(genKey(records[0].report), JSON.stringify({ state: "done", answer: WRITER_ANSWER }));
    if (records[0] && report === "failed") b.store.set(genKey(records[0].report), JSON.stringify({ state: "failed", status: 529, detail: "", message: "Overloaded", kind: "Error" }));
    if (resumes[0]) await deliver(resumes[0]);
    if (report === "lost") {
      // THE RETRY: the first look fired the generation again and rewrote the
      // record; the answer lands under the NEW token, and the next look finds it.
      records.push(recordOf(job));
      if (records[1] && resumes[1]) {
        b.store.set(genKey(records[1].report), JSON.stringify({ state: "done", answer: WRITER_ANSWER }));
        await deliver(resumes[1]);
      }
    }
    const stored = b.store.get(resultKey(job));
    const final = stored ? { status: JSON.parse(stored).status, body: JSON.parse(JSON.parse(stored).body) } : null;
    const pres = await worker.fetch(new Request("https://gofarther.dev/api/site/build/" + job, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
    const poll = { status: pres.status, text: await pres.text() };
    poll.body = (() => { try { return JSON.parse(poll.text); } catch { return null; } })();
    const build = c.calls.filter((k) => /\/build$/.test(k.url)).pop();
    const files = (build && build.body && build.body.files) || {};
    const pageFiles = Object.fromEntries(Object.entries(files).filter(([p]) => /\.tsx$/.test(p) && !p.includes("-parts/") && !/__root/.test(p)).map(([p, src]) => [p.replace(/^src\/routes\//, ""), src]));
    return { slug, job, post, records, resumes, final, poll, prompts, fires, pageFiles, store: b.store };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

/** Everything one generation job carried: the page writer's own request, as the container was handed it. */
const writerReq = (fire) => JSON.stringify((fire && (fire.req || fire.reqs)) || null);
const designerOf = (r) => (r.prompts.find((p) => p.tool === "design_schema") || {}).text || "";
/** The site's stored page source after the build — what the next edit reads. */
const storedPages = (r) => JSON.parse(r.store.get("source/" + r.slug + "/pages.json"));
const EDITED = [{ path: "index.tsx", source: HOME_EDITED }, { path: "menu.tsx", source: MENU }, { path: "visit.tsx", source: VISIT }];
/** ONE REAL REWRITE'S OWN BODIES — its 202 and its collected answer — for the browser cases, so no browser case reads a shape its producer never wrote. */
let realOnce = null;
const realBodies = () => (realOnce ||= chain({ report: "done" }));

// ── THE BROWSER: the real follow and the real last sentence ─────────────────

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHAT.slice(open, shut + 3);
}
function cutLine(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
}
const SRC = [
  cut("async function apiFetch("),
  cutLine("const BUILD_POLL_MS ="), cutLine("const BUILD_FOLLOW_MS ="),
  cut("async function followBuildJob("),
  cut("function reactSend("),
  cut("function alsoTail("),
  cut("function buildCostWords("),
  cut("function buildErrOutcome("),
  cut("function buildDownMsg("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

/**
 * THE BROWSER'S REWRITE, ANSWERED FROM `answers`: the POST, then each poll of the
 * build in turn. An answer `{ reject }` is a dropped connection. Returns the
 * sentence the customer is left with, and every request made.
 */
async function browser(answers, ho = { alsoAsked: [LATER, MAP], handOver: HAND }) {
  const script = answers.slice();
  const reqs = [];
  const said = [];
  const site = { id: "origin-1", slug: "harbour-loaf", react: true, name: "Harbour Loaf", pages: [{ path: "/" }] };
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" }, EditPoll: EP,
    AbortController, Response, Headers, encodeURIComponent, JSON, Promise, Object, Array, Set, Math, Date, String, Number,
    fetch: (url, init) => {
      reqs.push({ url: String(url), method: (init && init.method) || "GET", body: init && init.body ? JSON.parse(init.body) : undefined });
      const next = script.shift();
      if (!next) return Promise.resolve(new Response(JSON.stringify({ ok: false, error: "unscripted" }), { status: 500, headers: { "content-type": "application/json" } }));
      if (next.reject) return Promise.reject(next.reject);
      return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } }));
    },
    setTimeout: (fn) => { setImmediate(fn); return 0; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? site : null), siteSnap: () => {}, reactRoutePages: () => [], readReactStream: async () => ({}),
    siteFinishBuild: (origin, reply) => said.push(reply), setBuildPhase: () => {}, setBuildCode: () => {}, buildWhy: () => "",
    paintReactLive: () => {}, buildPicker: "sonnet", siteBuild: null, siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  ctx.reactSend(site, MIXED, "origin-1", "revise", [], (t) => said.push(t), [], ho);
  for (let i = 0; i < 400 && !said.length; i++) await new Promise((r) => setImmediate(r));
  return { said: said[0], reqs };
}

const tailDone = (parts) => "\nI only did part of it this time. Say " + parts.map((p) => "“" + p + "”").join(", then ") + ", and I’ll do those next.";
const tailLeft = (parts) => "\nI left " + parts.map((p) => "“" + p + "”").join(" and ") + " for later, so they weren’t tried. Send each on its own when you’re ready.";

// ── 202 → RESUME → FINAL BROWSER REPLY ──────────────────────────────────────

test("202 → resume → final browser reply: the parts put off reach no model, ride the record, and are named on the 202, the collected answer, the poll and the screen", async () => {
  const r = await chain({ report: "done" });
  // THE 202: the generation was handed to the container, and the parts are named.
  assert.equal(r.post.status, 202, JSON.stringify(r.post.body));
  assert.equal(r.post.body.stage, "resuming", JSON.stringify(r.post.body));
  assert.ok(r.job, "the 202 carries no job to follow");
  assert.deepEqual(r.post.body.deferred, [LATER, MAP], "the 202 does not name what was put off");
  // THE MODEL INPUTS: the designer and the page writer were handed the part to
  // do, and nothing of either part put off; the writer is told why it was handed the work.
  assert.equal(r.fires.length, 1, "the page writer's job was not handed to the container");
  assert.ok(designerOf(r).includes(SAY), "the designer was not handed the part to do");
  assert.ok(writerReq(r.fires[0]).includes(SAY), "the page writer was not handed the part to do");
  for (const p of [LATER, MAP]) {
    for (const q of r.prompts) assert.ok(!q.text.includes(p), "“" + p + "” reached " + q.tool);
    assert.ok(!writerReq(r.fires[0]).includes(p), "“" + p + "” reached the page writer's job");
  }
  assert.ok(writerReq(r.fires[0]).includes(HAND_LINE), "the page writer was not told why it was handed the request");
  assert.ok(!designerOf(r).includes("Handed on by"), "the hand-over line reached the designer, whose description becomes the site's");
  // THE RECORD THE 202 LEFT carries the parts, for the invocation that answers.
  assert.deepEqual(r.records[0].deferred, [LATER, MAP], "the resume record does not carry what was put off");
  // THE COLLECTED ANSWER: written by the resume, from the record — and it names them.
  assert.ok(r.final, "the resume stored no answer");
  assert.equal(r.final.status, 200);
  assert.equal(r.final.body.ok, true, JSON.stringify(r.final.body).slice(0, 300));
  assert.equal(r.final.body.page, "app", JSON.stringify(r.final.body).slice(0, 300));
  assert.equal(r.final.body.resumed, "finish");
  assert.deepEqual(r.final.body.deferred, [LATER, MAP], "the answer the customer finally reads does not name what was put off");
  // THE NEIGHBOURING PAGES WERE KEPT, byte for byte; the change was made.
  assert.deepEqual(r.pageFiles, { "index.tsx": HOME_EDITED, "menu.tsx": MENU, "visit.tsx": VISIT }, "the publish did not carry the whole site");
  assert.deepEqual(storedPages(r), EDITED, "the stored pages are not the site with the one change");
  // THE POLL ROUTE replays that answer, the parts included.
  assert.equal(r.poll.status, 200);
  assert.deepEqual(r.poll.body.deferred, [LATER, MAP], "the poll route's answer does not name what was put off");
  // THE SCREEN: the browser follows the 202 to that answer and asks for each part in turn.
  const b = await browser([{ status: 202, body: r.post.body }, { status: 202, body: { ok: false, pending: true, job: r.job } }, { status: r.poll.status, body: r.poll.body }]);
  assert.deepEqual(b.reqs.map((q) => q.method + " " + q.url), ["POST /api/site/react-revise", "GET /api/site/build/" + r.job, "GET /api/site/build/" + r.job]);
  assert.deepEqual(b.reqs[0].body.alsoAsked, [LATER, MAP], "the browser did not post the parts put off");
  assert.equal(b.said, "✅ Updated the home page." + tailDone([LATER, MAP]), "the screen does not say what waits");
});

test("a RETRY: the generation is lost, the build fires again and rewrites the record — the parts survive the refire, reach neither job, and are named at the end", async () => {
  const r = await chain({ report: "lost" });
  assert.equal(r.post.status, 202, JSON.stringify(r.post.body));
  // TWO GENERATION JOBS: the first, and the one the retry fired. Neither carried a part put off.
  assert.equal(r.fires.length, 2, "the lost generation was not fired again");
  for (const f of r.fires) {
    assert.ok(writerReq(f).includes(SAY), "a page writer's job lost the part to do");
    for (const p of [LATER, MAP]) assert.ok(!writerReq(f).includes(p), "“" + p + "” reached a page writer's job");
  }
  // THE RECORD, REWRITTEN BY THE RETRY: a new generation, and the same parts.
  assert.ok(r.records[1], "the retry left no record");
  assert.notEqual(r.records[1].genId, r.records[0].genId, "the record was not pointed at the new generation");
  assert.equal(r.records[1].refires, 1);
  assert.deepEqual(r.records[1].deferred, [LATER, MAP], "the retry's rewrite of the record dropped what was put off");
  assert.equal(r.resumes.length, 2, "the retry did not schedule its own look");
  // THE END: the second look finished, and its answer names the parts.
  assert.equal(r.final && r.final.body.page, "app", JSON.stringify(r.final && r.final.body).slice(0, 300));
  assert.deepEqual(r.final.body.deferred, [LATER, MAP]);
  assert.deepEqual(r.poll.body.deferred, [LATER, MAP]);
  assert.deepEqual(storedPages(r), EDITED, "the stored pages are not the site with the one change");
  const b = await browser([{ status: 202, body: r.post.body }, { status: r.poll.status, body: r.poll.body }]);
  assert.equal(b.said, "✅ Updated the home page." + tailDone([LATER, MAP]));
});

test("a GIVE-UP: the generation failed upstream — the final reply is a failure naming the parts as left for later; nothing published, nothing claimed done", async () => {
  const r = await chain({ report: "failed" });
  assert.equal(r.post.status, 202, JSON.stringify(r.post.body));
  assert.deepEqual(r.post.body.deferred, [LATER, MAP]);
  assert.ok(r.final, "the give-up stored no answer");
  // THE COLLECTOR'S OWN FAILURE: the stored answer of a give-up, as it was
  // before this round, with the parts added — never a success.
  assert.equal(r.final.status, 500, JSON.stringify(r.final.body).slice(0, 300));
  assert.equal(r.final.body.ok, false);
  assert.equal(r.final.body.stage, "resume");
  assert.equal(r.final.body.resumed, "stop");
  assert.equal(r.final.body.upstream, 529);
  assert.deepEqual(r.final.body.deferred, [LATER, MAP], "a failure's final answer does not name what was put off");
  assert.equal(r.poll.status, 500);
  assert.deepEqual(r.poll.body.deferred, [LATER, MAP], "the poll route's failure answer does not name what was put off");
  // NOTHING WAS PUBLISHED, and the stored pages are as they were, byte for byte.
  assert.equal(r.store.has("current/" + r.slug + ".json"), false, "a failed generation moved the live pointer");
  assert.deepEqual(storedPages(r), PRIOR, "a failed generation wrote over the stored pages");
  const b = await browser([{ status: 202, body: r.post.body }, { status: r.poll.status, body: r.poll.body }]);
  assert.ok(b.said.startsWith("⚠️ "), "a failure was shown as a success: " + b.said);
  assert.ok(b.said.endsWith(tailLeft([LATER, MAP])), "the screen does not say the parts were left untried: " + b.said);
  assert.ok(!b.said.includes("I only did"), "the screen claims something was done: " + b.said);
});

// ── THE TWO FINAL REPLIES NO BUILD WRITES ───────────────────────────────────

test("a build lost after its fire: the poll route's verdict names the parts off the record — for its owner only", async () => {
  const JOB = "b1b2c3d4e5f60718293a4b5c6d7e8f90";
  const rec = (uid) => JSON.stringify(packResume({ ...BASE, id: JOB, uid, slug: "fold-lane", report: "0f1e2d3c4b5a69788796a5b4c3d2e1f0", deferred: [LATER] }));
  const run = async (uid) => {
    const b = bucket([[resumeKey(JOB), rec(uid)]]);
    const real = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = String((input && input.url) || input || "");
      if (u.includes("/auth/v1/user")) return rjson(USER);
      if (u.includes("/rest/v1/rpc/edit_get")) return rjson({ ok: true, job: JOB, slug: "fold-lane", state: "lost", phase: "generating", cost: 0, billing: "external" });
      if (u.includes("/rest/v1/")) return rjson([]);
      return new Response("unavailable", { status: 503 });
    };
    try {
      const worker = await loadWorker();
      const res = await worker.fetch(new Request("https://gofarther.dev/api/site/build/" + JOB, { headers: { Authorization: "Bearer t" } }), { SITES_BUCKET: b, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m" }, makeCtx());
      return { status: res.status, body: await res.json() };
    } finally { globalThis.fetch = real; }
  };
  const mine = await run(USER.id);
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.equal(mine.body.lost, true);
  assert.equal(mine.body.page, "placeholder");
  assert.equal(mine.body.deferred, LATER, "the verdict for a lost build does not name what was put off");
  // THE 202 THIS RECORD'S POST WOULD HAVE ANSWERED: the real one's shape, this record's job and part.
  const fired = { ...(await realBodies()).post.body, job: JOB, deferred: LATER };
  const b = await browser([{ status: 202, body: fired }, { status: mine.status, body: mine.body }], { alsoAsked: LATER });
  assert.ok(b.said.endsWith("\nI left “" + LATER + "” for later, so it wasn’t tried. Send that on its own when you’re ready."), b.said);
  // A STRANGER'S RECORD NAMES NOTHING: the parts are the customer's own words.
  const other = await run("someone-else");
  assert.equal(other.status, 200);
  assert.equal(Object.hasOwn(other.body, "deferred"), false, "a record that is not the caller's named its parts");
});

test("the queued route's own answer (the consumer's answer would not read) names the parts; parts the build would not find are not named", async () => {
  const drive = async (alsoAsked) => {
    const slug = "resume-q-" + Math.random().toString(36).slice(2, 8);
    const b = bucket([]);
    const real = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = String((input && input.url) || input || "");
      if (u.includes("/auth/v1/user")) return rjson(USER);
      if (/\/rest\/v1\/rpc\/edit_\w+/.test(u)) return rjson({ ok: true, job: "x" });
      return rjson([]);
    };
    try {
      const worker = await loadWorker();
      // THE CONSUMER LEAVES AN ANSWER THAT WILL NOT READ: the envelope is ours.
      const env = { SITES_BUCKET: b, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m",
        BUILD_QUEUE: { async send(msg) { if (msg && msg.kind === JOB_KIND) b.store.set(resultKey(msg.id), "{not json"); }, async sendBatch() {} } };
      const res = await worker.fetch(new Request("https://gofarther.dev/api/site/react-revise", {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
        body: JSON.stringify({ slug, instruction: MIXED, alsoAsked }),
      }), env, makeCtx());
      return { status: res.status, body: await res.json() };
    } finally { globalThis.fetch = real; }
  };
  const named = await drive([LATER, MAP]);
  assert.equal(named.status, 503, JSON.stringify(named.body));
  assert.equal(named.body.error, "the build's answer could not be read");
  assert.deepEqual(named.body.deferred, [LATER, MAP], "the queued route's own answer does not name what was put off");
  const b = await browser([{ status: named.status, body: named.body }]);
  assert.ok(b.said.endsWith(tailLeft([LATER, MAP])), b.said);
  // A PART THE MESSAGE DOES NOT HOLD was never taken out — the build refuses
  // it (`held-unread`) — so this answer names none.
  const unfound = await drive("add a gallery of the ovens");
  assert.equal(unfound.status, 503);
  assert.equal(Object.hasOwn(unfound.body, "deferred"), false, "a part nobody could take out was named as put off");
});

// ── THE BROWSER ALONE ───────────────────────────────────────────────────────
//
// Every body is a real rewrite's own (`realBodies`); where a case needs two
// accounts to DIFFER so the precedence can be seen, the one field it changes
// is `deferred` — the shape around it is the producer's.

test("the browser: a followed build's final answer names its own parts; with none of its own, the 202's are named; a direct answer with none names nothing", async () => {
  const r = await realBodies();
  const fired = r.post.body;
  const { deferred: _own, ...bare } = r.poll.body;
  assert.deepEqual(fired.deferred, [LATER, MAP]);
  // THE FINAL ANSWER'S OWN ACCOUNT WINS (made to differ from the 202's here).
  const own = await browser([{ status: 202, body: fired }, { status: 200, body: { ...bare, deferred: LATER } }]);
  assert.equal(own.said, "✅ Updated the home page.\nI only did one thing this time. Say “" + LATER + "” and I’ll do that next.");
  // NONE OF ITS OWN — a verdict whose record is gone — the 202 said what the
  // server took out, and is named.
  const none = await browser([{ status: 202, body: fired }, { status: 200, body: bare }]);
  assert.equal(none.said, "✅ Updated the home page." + tailDone([LATER, MAP]), "a followed build's final answer without `deferred` named nothing");
  // A DIRECT ANSWER WITH NONE NAMES NOTHING: the route took nothing out, though the post carried parts.
  const direct = await browser([{ status: 200, body: bare }]);
  assert.equal(direct.said, "✅ Updated the home page.");
});

test("the browser: stopped following, or a Stop press mid-follow — the 202's parts are named, not what the post carried; with no 202, what the post carried", async () => {
  const r = await realBodies();
  // THE 202 NAMES ONE PART and the post carried two: made to differ, so which account is named can be seen.
  const fired = { ...r.post.body, deferred: LATER };
  const one = "\nI left “" + LATER + "” for later, so it wasn’t tried. Send that on its own when you’re ready.";
  // A DROPPED CONNECTION WHILE FOLLOWING: six blips and the follow gives up,
  // so the build is still running when we stop watching.
  const blips = Array.from({ length: 6 }, () => ({ reject: new TypeError("Failed to fetch") }));
  const stopped = await browser([{ status: 202, body: fired }, ...blips]);
  assert.equal(stopped.said, "⏳ " + fired.msg + one, "the 202's account was not the one named");
  // A STOP PRESS WHILE FOLLOWING: the follow's own abort, caught by the send.
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  const pressed = await browser([{ status: 202, body: fired }, { reject: abort }]);
  assert.equal(pressed.said, "■ Stopped. (A build already running may still finish server-side.)" + one);
  // NO 202 AT ALL — the POST itself lost — names what the post carried.
  const lost = await browser([{ reject: new TypeError("Failed to fetch") }]);
  assert.equal(lost.said, "⚠️ Lost the connection while building — check your internet and try again in a moment." + tailLeft([LATER, MAP]));
});
