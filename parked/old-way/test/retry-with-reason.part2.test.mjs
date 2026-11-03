// PARKED (2026-11-03, park-old-way): the old-way half of test/retry-with-reason.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { tweakInput } from "../../../test/fixtures/tweak-edits.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { TWEAK_TOOL, TWEAK_RETRY_REASONS, checkFeedback, tweakParser } from "../../../builder/site-tweak.mjs";
import { DATA_TOOL, runDataEdit } from "../../../builder/site-apply.mjs";
import { pickLanes, runLane } from "../../../builder/site-lanes.mjs";
import { runNavEdit, navSlots } from "../../../builder/site-nav.mjs";
import { runRulesEdit } from "../../../builder/site-rules.mjs";
import { retryRequest, withReasonRetry, addUsages, traceRetryMark } from "../../../builder/retry-reason.mjs";
import { newTrace } from "../../../builder/edit-trace.mjs";

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

// ── THE ROUTER'S HELD-BACK PART ──────────────────────────────────────────────

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };
const MSG = "Make the header darker. Also add a gallery page.";
const toolReply = (input) => ({ content: [{ type: "tool_use", id: "r1", name: "route_message", input }], usage: { input_tokens: 900, output_tokens: 60 } });
const LOOK = { intent: "edit", layer: "look" };

// ── THE LOOK DOOR'S PICKER ───────────────────────────────────────────────────

const pickReply = (input) => ({ content: [{ type: "tool_use", id: "p1", name: "pick_lanes", input }], usage: { input_tokens: 50, output_tokens: 5 } });
async function pick(answers, routed = null) {
  const sent = [];
  const left = answers.slice();
  const r = await pickLanes({ send: async (req) => { sent.push(req); return pickReply(left.shift()); } }, { message: "make the buttons rounder", current: "pages: /", routed });
  return { r, sent };
}

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
