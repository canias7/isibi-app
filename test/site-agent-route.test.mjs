// THE SITE AGENT THROUGH THE REAL ROUTES (2026-10-28): `POST /api/site/<slug>/edit`
// and `/addon`, on the synchronous path and as a queued job, with the agent's
// model answers SUPPLIED round by round. What this proves is the PATH: the
// agent is reached whole, its build compiles without saving, its save
// stores the pages, the stylesheet and nothing else, the money is taken once
// and only for a saved change, and a stop saves and charges nothing. It
// proves nothing about what a real model would do with these tools.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pageCredits } from "../builder/publish-pages.mjs";
import { modelsFor } from "../builder/build-models.mjs";

// The unit suite runs the older steps' tests with the agent stood aside
// (package.json); this file is the agent's own, so it runs as production does.
delete process.env.GF_OLD_LANES;

const USER = { id: "u-agent-1", email: "owner@example.com" };
const hex = (n) => randomBytes(n).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n" +
  "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
const HOME = page("/", "<h1>Harbour Loaf</h1><p>Open 7am to 4pm.</p>");
const MENU = page("/menu", "<h1>Menu</h1>");
const HOME_NEW = page("/", "<h1>Harbour Loaf</h1><p>Open 8am to 5pm.</p>");
const CSS = ":root{--brand:#123}";
const CSS_NEW = ":root{--brand:#a00}";
const ROUND = { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 9000 };
const MODEL = modelsFor("sonnet").pages;

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf" }, css: CSS })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

const use = (name, input) => ({ type: "tool_use", id: "t" + hex(3), name, input });

/** One message through a route; `rounds` are the agent's answers, in order. */
async function drive({ mode = "sync", route = "edit", ask, rounds, chat = null }) {
  const slug = "agent-" + mode + "-" + hex(4);
  const b = bucket(slug);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/" + route;
  const reqBody = JSON.stringify({ layer: "page", page: "/", instruction: ask, picker: "sonnet", idem: "idem" + hex(8), ...(chat ? { chat: chat.key } : {}) });
  if (chat) b.store.set("chat/" + USER.id + "/" + chat.key + ".json", JSON.stringify({ v: 1, rev: 1, msgs: chat.msgs }));
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body: reqBody, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { agent: [], other: [], debits: [], rpc: [] };
  let reserved = 0, n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(500);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("/v1/messages")) {
      const tools = Array.isArray(args.tools) ? args.tools.map((t) => t.name) : [];
      if (tools.includes("finish")) {
        seen.agent.push(args);
        const r = rounds[Math.min(n++, rounds.length - 1)];
        return json({ stop_reason: "tool_use", content: r, usage: ROUND });
      }
      seen.other.push((args.tool_choice && args.tool_choice.name) || "(none)");
      return new Response("no stub", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let reply = null, status = 0;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
      assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
      reply = JSON.parse(fin.args.p_result.body);
      status = fin.args.p_result.status;
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: reqBody }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const pages = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    return {
      status, reply, seen, compiles: c.calls.map((k) => k.body || {}),
      home: pages.find((p) => p.path === "index.tsx").source, menu: (pages.find((p) => p.path === "menu.tsx") || {}).source,
      css: JSON.parse(b.store.get(CONFIG_KEY(slug))).css,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const GOOD = [
  [use("read_files", { files: ["styles.css"] })],
  [use("write_file", { file: "index.tsx", source: HOME_NEW }), use("write_file", { file: "styles.css", source: CSS_NEW })],
  [use("build", {})],
  [use("finish", { summary: "Opening hours on the home page now 8am to 5pm; the brand colour is red." })],
];
const BILL = pageCredits(...Array.from({ length: 4 }, () => ({ in: ROUND.input_tokens, out: ROUND.output_tokens, cacheRead: ROUND.cache_read_input_tokens, cacheWrite: 0, model: MODEL })));

for (const mode of ["sync", "job"]) {
  test("SAR1 " + mode + ": the edit route hands the whole message to the agent, builds without saving, then saves once and charges once", async () => {
    const r = await drive({ mode, ask: "Change the hours to 8am to 5pm and make the brand colour red.", rounds: GOOD });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true);
    assert.equal(r.reply.layer, "agent");
    assert.deepEqual(r.reply.deferred, []);
    assert.match(r.reply.msg, /8am to 5pm/);
    assert.equal(r.seen.agent.length, 4, "four rounds");
    assert.deepEqual(r.seen.other, [], "no router lane, picker or writer was called");
    assert.equal(r.seen.agent[0].messages[0].content[0].text.includes("THE OWNER'S REQUEST\nChange the hours"), true, "the whole message, in the first message");
    assert.equal(r.compiles.length, 2, "the build tool's compile, then the save's");
    for (const k of r.compiles) assert.match(JSON.stringify(k.files || {}), /8am to 5pm/);
    assert.equal(r.home, HOME_NEW, "the page is stored");
    assert.equal(r.menu, MENU, "the other page is untouched");
    assert.equal(r.css, CSS_NEW, "the stylesheet is stored");
    if (mode === "job") assert.deepEqual(r.reserves, [BILL], "one reserve, for the four rounds");
    else assert.deepEqual(r.seen.debits, [BILL], "one charge, for the four rounds");
    assert.equal(r.reply.cost, BILL);
  });

  // NO ROUND LIMIT since 2026-10-30 (the owner: "no limit"), so an agent that
  // never finishes is one that stops answering with a tool mid-work.
  test("SAR2 " + mode + ": an agent that stops without finishing saves nothing and charges nothing", async () => {
    const r = await drive({ mode, ask: "Change the hours.", rounds: [[use("write_file", { file: "index.tsx", source: HOME_NEW })], [use("read_files", { files: ["menu.tsx"] })], [{ type: "text", text: "I am not sure." }]] });
    assert.equal(r.reply.ok, false);
    assert.equal(r.reply.error, "agent-stopped");
    assert.match(r.reply.msg, /Nothing on the site was changed.*Nothing was charged/);
    assert.equal(r.home, HOME, "the page is as it was");
    assert.equal(r.css, CSS);
    assert.equal(r.compiles.length, 0);
    assert.deepEqual(r.reserves, []);
    assert.deepEqual(r.seen.debits, []);
  });
}

test("SAR3 the add-on route hands an addition to the same agent", async () => {
  const ABOUT = page("/about", "<h1>About us</h1>");
  const r = await drive({ route: "addon", ask: "Add an About page.", rounds: [
    [use("write_file", { file: "about.tsx", source: ABOUT })], [use("build", {})], [use("finish", { summary: "Added an /about page." })],
  ] });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.reply.layer, "agent");
  assert.equal(r.reply.ok, true);
  assert.deepEqual(r.seen.other, []);
  assert.equal(r.home, HOME);
});

test("SAR4 a question: the agent answers, nothing is saved, the rounds are charged", async () => {
  const r = await drive({ ask: "What are my opening hours?", rounds: [[use("read_files", { files: ["index.tsx"] })], [use("finish", { summary: "Your home page says you open 7am to 4pm." })]] });
  assert.equal(r.reply.ok, true);
  assert.match(r.reply.msg, /7am to 4pm\. Nothing on the site was changed\./);
  assert.equal(r.compiles.length, 0);
  assert.equal(r.home, HOME);
  assert.equal(r.reply.cost, pageCredits(...Array.from({ length: 2 }, () => ({ in: ROUND.input_tokens, out: ROUND.output_tokens, cacheRead: ROUND.cache_read_input_tokens, cacheWrite: 0, model: MODEL }))));
});

test("SAR5 the routing route answers a site's message with the agent's door: no model call, nothing charged", async () => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    calls.push(u);
    if (u.includes("/auth/v1/user")) return json(USER);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message: "Make the hours 8 to 5", slug: "agent-route-1", hasSite: true, firstBuild: false, picker: "sonnet" }) }), { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    const d = await res.json();
    assert.deepEqual(d, { ok: true, intent: "edit", layer: "page", page: "/", cost: 0, agent: true });
    const ask = async (body) => (await (await worker.fetch(new Request("https://gofarther.dev/api/site/route", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify(body) }), { SUPABASE_SERVICE_KEY: "svc" }, makeCtx())).json());
    assert.deepEqual(await ask({ message: "A bakery called Harbour Loaf", firstBuild: true, picker: "sonnet" }), { ok: true, intent: "build", cost: 0, agent: true });
    assert.deepEqual(await ask({ message: "the home page", slug: "agent-route-1", hasSite: true, firstBuild: false, ask: { id: "q1", chosen: false } }),
      { ok: true, intent: "edit", layer: "page", page: "/", cost: 0, agent: true, ask: { answered: true, round: 1, putOff: [], context: [] }, instruction: "the home page" });
    assert.ok(!calls.some((u) => u.includes("/v1/messages") || u.includes("x.ai") || u.includes("use_credits")), "no model call, no charge: " + calls.join(", "));
  } finally { globalThis.fetch = real; }
});

test("SAR6 the agent reads the conversation: an answer to an earlier question means what it meant", async () => {
  const r = await drive({ ask: "the home page", chat: { key: "chat-abc1", msgs: [{ r: "u", t: "Make the hero blue" }, { r: "a", t: "Which page's hero — home or menu?" }, { r: "u", t: "the home page" }] },
    rounds: [[use("finish", { summary: "Nothing to change yet." })]] });
  const first = r.seen.agent[0].messages[0].content[0].text;
  assert.match(first, /THE CONVERSATION SO FAR \(for what the request refers to\)\nOwner: Make the hero blue\nYou: Which page's hero — home or menu\?\nOwner: the home page\n\nTHE OWNER'S REQUEST\nthe home page/);
});
