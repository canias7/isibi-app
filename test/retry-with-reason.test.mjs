// RETRY ONCE WITH THE CHECK'S OWN REASON (owner, 2026-10-24).
//
// Wherever a model's answer fails an exact check, the same request is sent
// once more — SAME model, SAME effort (the owner's explicit choice) — with the
// model's previous answer and a tool_result marked is_error (or a user turn)
// stating the failed check in plain words. One retry; then the existing
// refusal or climb. Each case supplies the model's answers in order:
//   - the first fails the check, the retry passes → success, one extra call,
//     the retry request equal to the first apart from its two new turns, and
//     the reason's words present;
//   - the retry fails too → the existing refusal, still exactly two calls;
//   - the first passes → no retry at all.
// The tweak and the data step are driven through the real
// `POST /api/site/<slug>/edit`; the router, the look-door picker and the menu
// step through their real module entry points with the real request builders.
import test from "node:test";
import assert from "node:assert/strict";
import { tweakInput } from "./fixtures/tweak-edits.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL, TWEAK_RETRY_REASONS, checkFeedback, tweakParser } from "../builder/site-tweak.mjs";
import { DATA_TOOL, runDataEdit } from "../builder/site-apply.mjs";
import { routeMessage, HELD_UNREAD_REASON, heldUnread } from "../builder/site-ask.mjs";
import { pickLanes, runLane } from "../builder/site-lanes.mjs";
import { runNavEdit, navSlots } from "../builder/site-nav.mjs";
import { runRulesEdit } from "../builder/site-rules.mjs";
import { retryRequest, withReasonRetry, addUsages, traceRetryMark } from "../builder/retry-reason.mjs";
import { newTrace } from "../builder/edit-trace.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const USER = { id: "u-retry-reason-1", email: "owner@example.com" };

/** The retry request is the first, with only two turns appended: same model, same effort. */
function sameButTurns(first, second) {
  const { messages: m1, ...rest1 } = first;
  const { messages: m2, ...rest2 } = second;
  assert.deepEqual(rest2, rest1, "the retry changed something other than the messages (model, effort, tools)");
  assert.equal(m2.length, m1.length + 2, "not exactly the previous answer and the reason appended");
  assert.deepEqual(m2.slice(0, m1.length), m1, "the first request's turns were not kept");
  assert.equal(m2[m1.length].role, "assistant");
  assert.equal(m2[m1.length + 1].role, "user");
  return m2[m1.length + 1].content;
}
const reasonText = (turn) => (Array.isArray(turn) ? turn : []).map((b) => (b && (b.content || b.text)) || "").join(" ");

// ── THE HELPER ───────────────────────────────────────────────────────────────

test("retryRequest answers every tool_use with an is_error tool_result, the reason on the first; a text answer gets a user turn", () => {
  const req = { model: "m-1", thinking: { type: "enabled", budget_tokens: 1024 }, effort: "low", messages: [{ role: "user", content: "x" }] };
  const reply = { content: [{ type: "tool_use", id: "t1", name: "a", input: {} }, { type: "tool_use", id: "t2", name: "a", input: {} }] };
  const r = retryRequest(req, reply, "THE REASON");
  const turn = sameButTurns(req, r);
  assert.deepEqual(turn.map((b) => [b.type, b.tool_use_id, b.is_error]), [["tool_result", "t1", true], ["tool_result", "t2", true]]);
  assert.equal(turn[0].content, "THE REASON");
  const t = retryRequest(req, { content: [{ type: "text", text: "hm" }] }, "WHY");
  assert.deepEqual(t.messages.at(-1), { role: "user", content: [{ type: "text", text: "WHY" }] });
  assert.deepEqual(addUsages({ in: 1, out: 2, model: "m" }, { in: 3, out: 4, model: "m" }), { in: 4, out: 6, model: "m" });
});

test("withReasonRetry runs a step at most twice, marks retry_reason {step, reason, ok}, and never retries a step that made other than one call", async () => {
  const marks = [];
  let n = 0;
  const run = async (d) => { await d.send({ model: "m", messages: [] }); return { ok: false, usage: { in: 1 } }; };
  const out = await withReasonRetry({ step: "s", deps: { send: async () => { n++; return { content: [] }; } }, run, reasonOf: (r) => (r.ok ? null : { code: "c", text: "t" }), mark: (d) => marks.push(d) });
  assert.equal(n, 2, "not exactly one retry");
  assert.deepEqual(marks, [{ step: "s", reason: "c", ok: false }]);
  assert.deepEqual(out.retryReason, { step: "s", reason: "c", ok: false });
  // A STEP STILL REFUSED AFTER ITS RETRY CHARGES ITS FIRST CALL ONLY (round 2): the retry rides apart.
  assert.deepEqual(out.usage, { in: 1 });
  assert.deepEqual(out.retryUsage, { in: 1 });
  let m = 0;
  const two = async (d) => { await d.send({}); await d.send({}); return { ok: false }; };
  await withReasonRetry({ step: "s", deps: { send: async () => { m++; return {}; } }, run: two, reasonOf: () => ({ code: "c", text: "t" }) });
  assert.equal(m, 2, "a two-call step was retried");
  // THE EDIT TRACE CARRIES IT under the closed status vocabulary.
  const tr = newTrace({ slug: "x" });
  traceRetryMark(tr)({ step: "nav", reason: "no-menu", ok: true });
  assert.deepEqual(tr.events().map((e) => [e.p, e.s, e.d]), [["retry_reason", "ok", { step: "nav", reason: "no-menu", ok: true }]]);
});

// ── THE TWEAK, THROUGH THE ROUTE ─────────────────────────────────────────────

const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
const TWEAK_OK = HOME.replace("<h1>", '<h1 className="text-5xl">');
const TWEAK_BROKEN = TWEAK_OK.replace("<section>", "<section><div>");
const TWEAK_REWORDED = TWEAK_OK.replace("Nine until five.", "From nine till five.");
const REWRITE_OK = HOME.replace("<h1>", '<h1 className="text-6xl">');

function bucket(store) {
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/** One page edit through the real route; `answers[tool]` is a list consumed in order. */
async function tweakDrive(answers) {
  const slug = "rwr-" + Math.random().toString(16).slice(2, 10);
  const b = bucket(new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }])],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]));
  const seen = { tools: [], reqs: [], debits: [], backs: [] };
  const left = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.slice()]));
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) { seen.backs.push(args); return new Response(null, { status: 204 }); }
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === TWEAK_TOOL.name) seen.reqs.push(args);
      const list = left[tool];
      if (!list || !list.length) return new Response("no stub for tool " + tool, { status: 503 });
      const a = list.shift();
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_" + seen.tools.length, name: tool, input: tool === TWEAK_TOOL.name ? tweakInput(typeof a === "string" ? { source: a } : a, args) : a }], usage: { input_tokens: 1000, output_tokens: 500 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({});
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger", picker: "sonnet" }),
    }), env, ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const stored = JSON.parse(b.store.get("source/" + slug + "/pages.json")).find((p) => p.path === "index.tsx").source;
    return { status: res.status, body, ...seen, stored };
  } finally { c.uninstall(); globalThis.fetch = real; }
}
const writers = (r) => r.tools.filter((t) => t === TWEAK_TOOL.name || t === "write_pages");

test("TWEAK: a first answer that does not parse is retried once with that reason, and the retry's sound answer ships", async () => {
  assert.equal(typeof (await tweakParser()), "function", "no parser here, so this case proves nothing");
  const r = await tweakDrive({ [TWEAK_TOOL.name]: [TWEAK_BROKEN, TWEAK_OK] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.tweak, true, "not the tweak path");
  assert.deepEqual(writers(r), [TWEAK_TOOL.name, TWEAK_TOOL.name], "not one extra call: " + JSON.stringify(r.tools));
  assert.equal(r.stored, TWEAK_OK);
  const turn = sameButTurns(r.reqs[0], r.reqs[1]);
  assert.equal(turn[0].type, "tool_result");
  assert.equal(turn[0].is_error, true);
  assert.match(turn[0].content, /no longer parses/);
  assert.equal(r.reqs[1].model, r.reqs[0].model, "the retry switched model");
  // ONE BILL, carrying both calls.
  assert.equal(r.debits.length, 1);
  assert.equal(r.backs.length, 0);
});

test("TWEAK: a reworded first answer is retried with the rewording reason; a reworded retry falls back to the rewrite as today", async () => {
  const ok = await tweakDrive({ [TWEAK_TOOL.name]: [TWEAK_REWORDED, TWEAK_OK] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(writers(ok), [TWEAK_TOOL.name, TWEAK_TOOL.name]);
  assert.match(reasonText(sameButTurns(ok.reqs[0], ok.reqs[1])), /visible wording/);
  const both = await tweakDrive({ [TWEAK_TOOL.name]: [TWEAK_REWORDED, TWEAK_REWORDED], write_pages: [{ pages: [{ path: "src/routes/index.tsx", source: REWRITE_OK }], parts: [] }] });
  assert.equal(both.status, 200, JSON.stringify(both.body));
  assert.deepEqual(writers(both), [TWEAK_TOOL.name, TWEAK_TOOL.name, "write_pages"], "not two tweaks then the existing climb: " + JSON.stringify(both.tools));
  assert.equal(both.stored, REWRITE_OK);
});

test("TWEAK: a first answer that passes is never retried", async () => {
  const r = await tweakDrive({ [TWEAK_TOOL.name]: [TWEAK_OK] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(writers(r), [TWEAK_TOOL.name]);
});

test("TWEAK: every retried check has its own plain-words reason", () => {
  assert.deepEqual([...TWEAK_RETRY_REASONS], ["edits", "no-change", "truncated", "syntax", "moved-route", "reworded", "needs-parts", "lint"]);
  const said = TWEAK_RETRY_REASONS.map((reason) => checkFeedback({ reason, problems: ["P1"], parts: ["Card"], edit: "old-missing", index: 0 }));
  assert.equal(new Set(said).size, said.length, "two checks share a sentence");
  for (const s of said) assert.match(s, /Nothing was changed/);
});

// ── THE DATA STEP, THROUGH THE ROUTE ─────────────────────────────────────────

const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const SPEC = { tables: [{ name: "loaves", access: "display", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }] }] };
const dpage = "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: Page })\nfunction Page(){ return <main><h1>Fold Lane</h1></main> }\n";

async function dataDrive(slug, answers) {
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES } }, meta: { schema: JSON.stringify(SPEC) } });
  const worker = await loadWorker();
  const seen = { reqs: [], debits: [] };
  const left = answers.slice();
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    let body = {};
    try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(body.cost) || 0); return json(Number(body.cost) || 0); }
    if (url.includes("/rest/v1/")) {
      if (method !== "GET") return json([]);
      if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_conn: PROJECT_CONN }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(url)) return db.answer(String(body.query || ""), Array.isArray(body.params) ? body.params : []) || json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    if (url.includes("/v1/messages")) {
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      if (tool !== DATA_TOOL.name || !left.length) return new Response("no stub for tool " + tool, { status: 503 });
      seen.reqs.push(body);
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "d" + seen.reqs.length, name: DATA_TOOL.name, input: left.shift() }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const store = new Map([["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: dpage }])], ["source/" + slug + "/parts.json", "[]"], [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane", theme: "broadsheet" }, css: "" })]]);
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ instruction: "Make the Dark Rye £5.60.", layer: "data", page: "", remove: false, rename: "", tab: false, picker: "sonnet" }),
    }), { SITES_BUCKET: bucket(store), ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    const text = await res.text();
    let reply = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    return { status: res.status, reply, text, db, ...seen };
  } finally { globalThis.fetch = real; }
}
const NONE = { changes: [] };
const RYE = { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] };

test("DATA: an answer that matched no row is retried once with that reason; the retry's row is written and billed once", async () => {
  const r = await dataDrive("rwr-data-a", [NONE, RYE]);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.reply.ok, true, r.text.slice(0, 300));
  assert.equal(r.reqs.length, 2, "not exactly one extra call");
  assert.match(reasonText(sameButTurns(r.reqs[0], r.reqs[1])), /matches a row/);
  assert.equal(r.debits.length, 1, "not one bill: " + JSON.stringify(r.debits));
});

test("DATA: a retry that matches no row either ends as today's no-match; a first answer that matches is never retried", async () => {
  const both = await dataDrive("rwr-data-b", [NONE, NONE]);
  assert.equal(both.reqs.length, 2);
  assert.equal(both.reply.ok, false, both.text.slice(0, 300));
  const once = await dataDrive("rwr-data-c", [RYE]);
  assert.equal(once.reply.ok, true, once.text.slice(0, 300));
  assert.equal(once.reqs.length, 1);
});

test("DATA: the retry's reserve is handed both calls' usage, so the one bill carries the retry", async () => {
  const tables = [{ name: "loaves", columns: ["name", "price"], rows: BAKERY_LOAVES.slice(0, 2) }];
  const tool = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "x", name: DATA_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
  const replies = [tool(NONE), tool(RYE)];
  const reserved = [];
  const r = await runDataEdit({ send: async () => replies.shift(), before: async (u) => { reserved.push(u); return true; }, apply: async () => ({ ...BAKERY_LOAVES[1], price: 5.6 }) }, { instruction: "x", tables });
  assert.equal(r.ok, true);
  assert.equal(reserved.length, 1);
  assert.equal(reserved[0].in, 20, "the reserve saw only the retry's usage");
  assert.equal(r.usage.in, 20);
});

// ── THE ROUTER'S HELD-BACK PART ──────────────────────────────────────────────

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };
const MSG = "Make the header darker. Also add a gallery page.";
const toolReply = (input) => ({ content: [{ type: "tool_use", id: "r1", name: "route_message", input }], usage: { input_tokens: 900, output_tokens: 60 } });
async function route(answers) {
  const sent = [], marks = [];
  const left = answers.slice();
  const r = await routeMessage({ send: async (req) => { sent.push(req); return toolReply(left.shift()); }, mark: (d) => marks.push(d) }, { message: MSG, site: SITE, hasSite: true });
  return { r, sent, marks };
}
const LOOK = { intent: "edit", layer: "look" };

test("ROUTER: a held-back part not found in the message is retried once with that reason; the retry's exact copy is used", async () => {
  assert.equal(heldUnread(MSG, "add a gallery section"), true);
  assert.equal(heldUnread(MSG, "Also add a gallery page."), false);
  const { r, sent, marks } = await route([{ ...LOOK, alsoAsked: "add a gallery section" }, { ...LOOK, alsoAsked: "Also add a gallery page." }]);
  assert.equal(sent.length, 2);
  assert.match(reasonText(sameButTurns(sent[0], sent[1])), /not found word for word/);
  assert.ok(reasonText(sameButTurns(sent[0], sent[1])).includes(HELD_UNREAD_REASON));
  assert.equal(heldUnread(MSG, r.alsoAsked), false);
  assert.deepEqual(r.retryReason, { step: "route", reason: "held-unread", ok: true });
  assert.deepEqual(marks, [{ step: "route", reason: "held-unread", ok: true }]);
  assert.equal(r.usage.in, 1800, "the retry's call is not on the routing bill");
});

test("ROUTER: a retry that still misquotes is answered as it came (the routes refuse held-unread as today); a good first answer is not retried", async () => {
  const bad = await route([{ ...LOOK, alsoAsked: "add a gallery section" }, { ...LOOK, alsoAsked: "a map" }]);
  assert.equal(bad.sent.length, 2);
  assert.equal(heldUnread(MSG, bad.r.alsoAsked), true);
  assert.deepEqual(bad.r.retryReason, { step: "route", reason: "held-unread", ok: false });
  assert.equal(bad.r.usage.in, 900, "a routing retry that still misquotes was billed (round 2: first call only)");
  const good = await route([{ ...LOOK, alsoAsked: "Also add a gallery page." }]);
  assert.equal(good.sent.length, 1);
  assert.equal(good.r.retryReason, undefined);
});

// ── THE LOOK DOOR'S PICKER ───────────────────────────────────────────────────

const pickReply = (input) => ({ content: [{ type: "tool_use", id: "p1", name: "pick_lanes", input }], usage: { input_tokens: 50, output_tokens: 5 } });
async function pick(answers, routed = null) {
  const sent = [];
  const left = answers.slice();
  const r = await pickLanes({ send: async (req) => { sent.push(req); return pickReply(left.shift()); } }, { message: "make the buttons rounder", current: "pages: /", routed });
  return { r, sent };
}

test("PICKER: an answer naming no lane is retried once with that reason; a retry naming none is today's no-lane; a door is never retried", async () => {
  const ok = await pick([{ fields: [] }, { fields: ["shape"] }]);
  assert.equal(ok.sent.length, 2);
  assert.deepEqual(ok.r.fields, ["shape"]);
  assert.match(reasonText(sameButTurns(ok.sent[0], ok.sent[1])), /named no lane/);
  assert.deepEqual(ok.r.retryReason, { step: "pick_lanes", reason: "no-lane", ok: true });
  const none = await pick([{ fields: [] }, { fields: [] }]);
  assert.equal(none.sent.length, 2);
  assert.deepEqual(none.r.fields, []);
  const once = await pick([{ fields: ["shape"] }]);
  assert.equal(once.sent.length, 1);
  const door = await pick([{ fields: [] }], { layer: "nav", remove: true, page: "" });
  assert.equal(door.sent.length, 1, "the removal door's empty extra list was retried");
});

// ── THE MENU STEP ────────────────────────────────────────────────────────────

const ROUTES = ["/", "/gallery", "/visit"];
const ITEMS = [{ label: "Gallery", href: "/gallery" }, { label: "Visit", href: "/visit" }];
const lit = (items) => "[" + items.map((it) => `{ label: ${JSON.stringify(it.label)}, href: ${JSON.stringify(it.href)} }`).join(", ") + "]";
const navSrc = `import { SiteChrome } from "@/components/ui/site-chrome";\n\nexport default function P() {\n  return (\n    <SiteChrome name="Fold Lane" links={${lit(ITEMS)}}>\n      <h1>Bread</h1>\n    </SiteChrome>\n  );\n}\n`;
const navPages = () => [{ path: "index.tsx", source: navSrc }, { path: "gallery.tsx", source: navSrc }, { path: "visit.tsx", source: navSrc }];
const navReply = (input) => ({ content: [{ type: "tool_use", id: "n1", input }], usage: { input_tokens: 1, output_tokens: 1 } });
async function nav(answers) {
  const sent = [];
  const left = answers.slice();
  const r = await runNavEdit({ send: async (req) => { sent.push(req); return navReply(left.shift()); } }, { instruction: "Put Visit first in the menu", pages: navPages(), routes: ROUTES });
  return { r, sent };
}
const MOVED = [ITEMS[1], ITEMS[0]];

test("NAV: an answer that would change nothing is retried once with that reason; the retry's change is made", async () => {
  const r = await nav([{ links: ITEMS }, { links: MOVED }]);
  assert.equal(r.sent.length, 2);
  assert.equal(r.r.ok, true, r.r.msg);
  for (const s of navSlots(r.r.pages)) assert.deepEqual(s.items.map((it) => it.href), ["/visit", "/gallery"]);
  assert.match(reasonText(sameButTurns(r.sent[0], r.sent[1])), /already what the site has/);
  assert.deepEqual(r.r.retryReason, { step: "nav", reason: "no-change", ok: true });
  assert.equal(r.r.usage.in, 2, "the retry's usage is not on the bill");
});

test("NAV: an answer naming nothing usable is retried with the no-menu reason; a second miss is today's refusal; a good first answer is not retried", async () => {
  const miss = await nav([{}, {}]);
  assert.equal(miss.sent.length, 2);
  assert.equal(miss.r.ok, false);
  assert.equal(miss.r.reason, "no-menu");
  assert.match(reasonText(sameButTurns(miss.sent[0], miss.sent[1])), /named no menu link/);
  const once = await nav([{ links: MOVED }]);
  assert.equal(once.sent.length, 1);
  assert.equal(once.r.ok, true);
});

// ── THE RULES STEP AND A LOOK LANE (widened, owner 2026-10-24) ───────────────

const RTABLES = [{ name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }, { name: "slot_date", type: "text" }, { name: "slot_time", type: "text" }] }];
const rulesSaid = (input) => ({ content: [{ type: "tool_use", id: "w1", name: "write_table_rules", input }], usage: { input_tokens: 900, output_tokens: 60 } });
async function rules(answers) {
  const sent = [], applied = [];
  const left = answers.slice();
  const r = await runRulesEdit({ send: async (req) => { sent.push(req); return rulesSaid(left.shift()); }, apply: async (spec) => { applied.push(spec); return true; } }, { instruction: "stop double bookings", tables: RTABLES });
  return { r, sent, applied };
}
const UNIQUE = { tables: [{ table: "bookings", unique: ["slot_date", "slot_time"] }] };

test("RULES: an answer naming no rule change is retried once with that reason; a second miss is today's no-match; a good first answer is not retried", async () => {
  const fixed = await rules([{ tables: [] }, UNIQUE]);
  assert.equal(fixed.sent.length, 2);
  assert.equal(fixed.r.ok, true, JSON.stringify(fixed.r));
  assert.equal(fixed.applied.length, 1);
  assert.match(reasonText(sameButTurns(fixed.sent[0], fixed.sent[1])), /named no rule change/);
  const miss = await rules([{ tables: [] }, { tables: [] }]);
  assert.equal(miss.sent.length, 2);
  assert.equal(miss.r.reason, "no-match");
  const once = await rules([UNIQUE]);
  assert.equal(once.sent.length, 1);
});

test("LANE: an answer with no tool answer at all is retried once with that reason; a lane that declines (null) is not", async () => {
  const sent = [];
  const replies = [{ content: [{ type: "text", text: "sure" }], usage: {} }, { content: [{ type: "tool_use", id: "l1", input: { css: ".x{}" } }], usage: {} }];
  const r = await runLane({ send: async (req) => { sent.push(req); return replies.shift(); } }, { field: "css", message: "rounder buttons", value: "", model: "m" });
  assert.equal(sent.length, 2);
  assert.equal(r.value, ".x{}");
  assert.match(reasonText(sameButTurns(sent[0], sent[1])), /could not be used/);
  const s2 = [];
  const d = await runLane({ send: async (req) => { s2.push(req); return { content: [{ type: "tool_use", id: "l2", input: { css: null } }], usage: {} }; } }, { field: "css", message: "rounder buttons", value: "", model: "m" });
  assert.equal(s2.length, 1, "a declining lane was retried");
  assert.equal(d.value, undefined);
});
