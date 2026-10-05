// THE ROUTES A QUESTION ON A SITE THAT EXISTS RUNS THROUGH, AS ONE HARNESS
// (2026-10-02).
//
// Shared by `test/live-clarify-route.test.mjs` and
// `test/live-clarify-continue.test.mjs`: the real `POST /api/site/route`, the
// real owner route for the question, the real edit and add-on routes —
// synchronously and through the queue — with the body the browser's own
// `siteEdit` composes, cut out of `public/chat.js`. The store is an R2 bucket
// with etags and conditional puts, as the binding behaves, and its question
// writes can be made to fail or to lose a race on cue.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied: whether a real
// model asks a good question, or acts when it can, is a live measurement this
// harness cannot make.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import { makeCtx } from "./worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";
import { ASK_TOOL } from "../../builder/site-ask.mjs";
import { pickTool, editTool } from "../../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../../builder/site-tweak.mjs";
import { TEXT_TOOL } from "../../builder/site-apply.mjs";
import { QUESTION_KEY, packAsk, newAskId, readAskRecord } from "../../builder/clarify.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../../builder/edit-job.mjs";

const realEditPoll = createRequire(import.meta.url)("../../public/edit-poll.js");
export const T = { route: ASK_TOOL.name, pick: pickTool().name, lane: editTool("description").name, tweak: TWEAK_TOOL.name, text: TEXT_TOOL.name, adds: "pick_adds", design: "add_to_site", pages: "write_pages", takeOff: "take_off" };
export const USER = { id: "u-live-clarify-1", email: "owner@example.com" };
export const OTHER = "u-live-clarify-2";
export const TOKEN = "Bearer some-token";
export const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
export const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
export const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
export const HOME = page("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>"
  + "<section className=\"order\"><h2>Order a loaf for collection</h2><p>Pick a loaf and a time.</p></section>");
export const VISIT = page("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>"
  + "<section className=\"band\"><h2>Order a collection so we hold a loaf</h2><p>We keep one back for you.</p></section>");
/** The Visit page with its two sections swapped — the move the page step makes. */
export const VISIT_MOVED = page("/visit", "<section className=\"band\"><h2>Order a collection so we hold a loaf</h2><p>We keep one back for you.</p></section>"
  + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>");
export const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
export const ROUTES = ["/", "/visit"];
export const OLD_DESC = "Neighbourhood sourdough in Bristol.";
export const NEW_DESC = "Overnight sourdough from a Bristol side street, ready to collect at the counter.";
export const Q = { text: "Which page should the band move on — Home or Visit?", options: ["Home", "Visit"] };
export const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
export const hex32 = () => randomBytes(16).toString("hex");
export const freshSlug = (k) => "live-q-" + k + "-" + hex32().slice(0, 8);

/**
 * R2 as the binding behaves: etags, and conditional puts answering null. The
 * question's own key can be made to fail — every read (`failQuestionRead`),
 * every write (`failQuestion`), or the first `failQuestionPuts` writes — and
 * `beforeQuestionPut(store, value, opts)` runs before a write is decided, so a
 * case can move the record under it (another writer winning the race).
 */
export function bucket(slug, { failQuestion = false, failQuestionRead = false, failQuestionPuts = 0, beforeQuestionPut = null } = {}) {
  const store = new Map();
  let n = 0;
  let putsFailed = 0;
  const put = (k, v) => { store.set(k, { body: String(v), etag: "e" + (++n) }); };
  put(SOURCE_KEY(slug), JSON.stringify(PAGES));
  put(PARTS_KEY(slug), JSON.stringify([]));
  put(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet", description: OLD_DESC }, css: "" }));
  const obj = (o) => ({ etag: o.etag, text: async () => o.body, json: async () => JSON.parse(o.body), arrayBuffer: async () => new TextEncoder().encode(o.body).buffer });
  const questionWrites = [];
  const b = {
    store, questionWrites,
    failQuestion,
    raw: (k) => (store.get(k) || {}).body,
    /** Write a key as another writer would: a new etag. */
    poke: (k, v) => put(k, v),
    async get(k) {
      if (failQuestionRead && k === QUESTION_KEY(slug)) throw new Error("r2 down");
      const o = store.get(k); return o ? obj(o) : null;
    },
    async put(k, v, opts = {}) {
      if (k === QUESTION_KEY(slug)) {
        if (b.failQuestion) throw new Error("r2 down");
        if (putsFailed < failQuestionPuts) { putsFailed++; throw new Error("r2 blip"); }
        if (beforeQuestionPut) beforeQuestionPut(b, String(v), opts);
        questionWrites.push(String(v));
      }
      const cur = store.get(k);
      if (opts.onlyIf && opts.onlyIf.etagMatches != null && (!cur || cur.etag !== String(opts.onlyIf.etagMatches))) return null;
      // AND THE OTHER HALF (2026-10-03): `etagDoesNotMatch`, where "*" matches
      // any object — a write only when nothing is there yet, as workerd's
      // wildcard etag reads it. A queued job's reply is kept that way.
      if (opts.onlyIf && opts.onlyIf.etagDoesNotMatch != null && cur && (String(opts.onlyIf.etagDoesNotMatch) === "*" || cur.etag === String(opts.onlyIf.etagDoesNotMatch))) return null;
      put(k, v);
      return { etag: store.get(k).etag };
    },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  return b;
}
export const question = (b, slug) => readAskRecord(b.raw(QUESTION_KEY(slug)) || "null");
export const seedQuestion = (b, slug, over = {}) => {
  const rec = packAsk({ id: newAskId(), uid: USER.id, slug, stage: "route", round: 1, question: Q,
    request: "Put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\"", held: [], at: Date.now(), ...over });
  assert.ok(rec, "the seeded question is not a question");
  b.store.set(QUESTION_KEY(slug), { body: JSON.stringify(rec), etag: "seed-" + rec.id.slice(0, 6) });
  return rec;
};

/** The text a request carried after one of its own headings. */
export function after(body, marker, until) {
  const content = String(body && body.messages && body.messages[0] && body.messages[0].content || "");
  const at = content.indexOf(marker);
  if (at < 0) return null;
  const rest = content.slice(at + marker.length);
  const end = until ? rest.indexOf(until) : -1;
  return end < 0 ? rest : rest.slice(0, end);
}

/** A model call's whole user message, as text. */
export const userText = (body) => {
  const c = body && body.messages && body.messages[0] && body.messages[0].content;
  return typeof c === "string" ? c : JSON.stringify(c || "");
};

// THE TOOLS WHOSE ANSWER MAY BE A LIST OF ANSWERS, ONE PER CALL: their own
// answer is an object, so a list cannot be mistaken for one. The router's
// answers are keyed `route`.
const SEQUENCED = new Set(["route", T.pick, T.tweak, T.pages, T.adds]);

/**
 * THE MODEL AND THE PLATFORM, per call. `answers[tool]` is the model's answer
 * — for the router, the picker, the page writers and the add-on picker a list
 * of answers is one per call, and for every key a function `(args, n)` answers
 * the n-th call. Lanes answer by `lane:<field>` (the field's value), add-on
 * designers by `add:<kind>` (the whole tool input). A tool with no stub is
 * refused. `owner` is who the site_backends row names. Every model call's user
 * message is kept by tool (`seen.inputs`), so a case can read what each model
 * was really sent.
 */
export function withWire(answers, run, { owner = USER.id, slug = "" } = {}) {
  const real = globalThis.fetch;
  const seen = { calls: [], routerAsked: [], picks: [], lanes: [], writers: [], texts: [], debits: [], rpc: [], designers: [], pageWriters: [], inputs: {} };
  let reserved = 0;
  const counts = {};
  const next = (key) => { counts[key] = (counts[key] || 0) + 1; return counts[key] - 1; };
  const answerFor = (key, args) => {
    const a = answers[key];
    if (typeof a === "function") return a(args, next(key));
    if (SEQUENCED.has(key) && Array.isArray(a)) return a[next(key)];
    return a;
  };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = url.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost) || 0; return json({ ok: true, charged: Number(args.p_cost) || 0, cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (url.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    // A SITE WITH NO DATABASE (a blank name, no project row): the routing route
    // reads it as having no tables and says so (`tables-none`, 2026-10-05).
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: owner, brief: "", neon_db: "" }]);
    if (url.includes("/rest/v1/site_project") || url.includes("/rest/v1/site_aliases")) return json([]);
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      (seen.inputs[tool] = seen.inputs[tool] || []).push(userText(args));
      const usage = { input_tokens: 10, output_tokens: 5 };
      // AN ANSWER CUT OFF AT ITS CEILING (2026-10-03): a supplied answer carrying
      // `__stop_reason` arrives with that stop reason and without the key.
      const say = (input) => {
        if (input && typeof input === "object" && typeof input.__stop_reason === "string") {
          const { __stop_reason, ...rest } = input;
          return json({ stop_reason: __stop_reason, content: [{ type: "tool_use", name: tool, input: rest }], usage });
        }
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage });
      };
      const props = (args.tools && args.tools[0] && args.tools[0].input_schema && args.tools[0].input_schema.properties) || {};
      if (tool === T.route) {
        seen.routerAsked.push(args);
        const a = answerFor("route", args);
        if (!a) return new Response("no stub for this routing call", { status: 503 });
        return say(a);
      }
      if (tool === T.pick) seen.picks.push(after(args, "Their message:\n"));
      if (tool === T.text) seen.texts.push(userText(args));
      if (tool === T.lane) {
        const field = Object.keys(props)[0] || "";
        seen.lanes.push({ field, asked: after(args, "What they asked for:\n"), offered: Object.hasOwn(props, "question") });
        if (!Object.hasOwn(answers, "lane:" + field)) return new Response("no stub for lane " + field, { status: 503 });
        const a = answers["lane:" + field];
        const v = typeof a === "function" ? a(args, next("lane:" + field)) : a;
        return say(v && typeof v === "object" && Object.hasOwn(v, "question") && Object.keys(v).length === 1 ? v : { [field]: v });
      }
      if (tool === T.tweak) {
        seen.writers.push({ instruction: after(args, "THE CHANGE THEY ASKED FOR\n", "\n\nTHE FILE (") });
        if (!Object.hasOwn(answers, T.tweak)) return new Response("no stub for the page writer", { status: 503 });
        return say(answerFor(T.tweak, args));
      }
      if (tool === T.pages) {
        seen.pageWriters.push({ text: userText(args), offered: Object.hasOwn(props, "question") });
        if (!Object.hasOwn(answers, T.pages)) return new Response("no stub for the full page writer", { status: 503 });
        return say(answerFor(T.pages, args));
      }
      if (tool === T.design) {
        const kind = Object.keys(props).find((k) => k !== "requirements" && k !== "question") || "";
        seen.designers.push({ kind, text: userText(args), offered: Object.hasOwn(props, "question") });
        if (!Object.hasOwn(answers, "add:" + kind)) return new Response("no stub for the " + kind + " designer", { status: 503 });
        const a = answers["add:" + kind];
        return say(typeof a === "function" ? a(args, next("add:" + kind)) : a);
      }
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return say(answerFor(tool, args));
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(seen); } finally { globalThis.fetch = real; } })();
}

export const envFor = (store) => ({ SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() });

export async function routeCall(worker, env, { slug, message, ask, firstBuild = false, hasSite = true, attached = false }) {
  const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ message, site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: ROUTES, tables: ["loaves"] },
      picker: "sonnet", firstBuild, brief: message, qa: [], answering: false, attached, slug, hasSite, ...(ask === undefined ? {} : { ask }) }),
  }), env, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}
export async function questionCall(worker, env, slug, method, body) {
  const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/question", {
    method, headers: { "content-type": "application/json", Authorization: TOKEN }, body: body === undefined ? undefined : JSON.stringify(body),
  }), env, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}

// THE BROWSER'S OWN POST, cut out of chat.js — the body `siteEdit` or `siteAddon` composes.
export const CHAT = readFileSync(new URL("../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
export const cut = (head) => {
  const open = CHAT.indexOf("\nfunction " + head + "(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
  return CHAT.slice(open, shut + 2);
};
export function browserPost(site, d, instruction, imgs = []) {
  const sent = [];
  const ctx = vm.createContext({
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-live-q-" + hex32().slice(0, 12), outcomeMessage: (s) => "outcome:" + s },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext([cut("editAsk"), cut("editAskDone"), cut("siteEdit"), cut("siteAddon")].join("\n"), ctx);
  if (d.intent === "addon") ctx.siteAddon(site, instruction, "origin-1", () => {}, () => {}, d, imgs);
  else ctx.siteEdit(site, d, instruction, "origin-1", () => {}, () => {}, imgs, false);
  assert.equal(sent.length, 1, "the browser made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

/** The POST, synchronously or as a queued job; `{ status, body }` as the browser would read it. */
export async function postRoute(worker, env, store, seen, slug, post, mode) {
  const url = "https://gofarther.dev" + post.url;
  if (mode === "job") {
    const id = hex32();
    const before = seen.rpc.length;
    store.store.set(EDIT_JOB_PREFIX + id, { body: JSON.stringify(packEditJob({ url, body: JSON.stringify(post.body), uid: USER.id, slug, secret: hex32(), at: Date.now() })), etag: "job" });
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
    await Promise.allSettled(ctx.pending || []);
    const fin = seen.rpc.slice(before).find((r) => r.fn === "edit_finalize");
    assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.slice(before).map((r) => r.fn)));
    return { status: fin.args.p_result.status, body: JSON.parse(fin.args.p_result.body), finalized: fin.args, refunded: seen.rpc.slice(before).some((r) => r.fn === "edit_refund") };
  }
  const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(post.body) }), env, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}
export const SITE = (slug) => ({ slug, name: "Harbour Loaf", react: true, pages: ROUTES.map((p) => ({ path: p })), msgs: [] });
export const storedLook = (b, slug) => (JSON.parse(b.raw(CONFIG_KEY(slug)) || "{}").look || {});
export const storedPage = (b, slug, path) => (JSON.parse(b.raw(SOURCE_KEY(slug))).find((p) => p.path === path) || {}).source;
