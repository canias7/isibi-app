// THE OLD STEPS AS AGENT TOOLS, THROUGH THE REAL ROUTE (2026-10-30). The
// harness is `site-agent-route.test.mjs`'s, with the agent's answers SUPPLIED:
// what this proves is that a setting, a logo, a page rename's redirect, a
// question and the screen sizes really land through `runAgentChange`.
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

function bucket(slug, uploads = []) {
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
    async list(o) { return { objects: o && String(o.prefix || "").startsWith("uploads/") ? uploads.map((n) => ({ key: "uploads/" + slug + "/" + n, customMetadata: {} })) : [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

const use = (name, input) => ({ type: "tool_use", id: "t" + hex(3), name, input });

/** One message through a route; `rounds` are the agent's answers, in order. */
async function drive({ mode = "sync", route = "edit", ask, rounds, chat = null, extra = {}, uploads = [], compiler = {} }) {
  const slug = "agent-" + mode + "-" + hex(4);
  const b = bucket(slug, uploads);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/" + route;
  const reqBody = JSON.stringify({ layer: "page", page: "/", instruction: ask, picker: "sonnet", idem: "idem" + hex(8), ...extra, ...(chat ? { chat: chat.key } : {}) });
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
  const c = installCompiler(compiler);
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
      config: JSON.parse(b.store.get(CONFIG_KEY(slug))), store: b.store, slug,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const BUILT = (first) => [first, [use("build", {})], [use("finish", { summary: "Done." })]];

test("set_site_settings through the edit route: stored in the config, published, facts in the reply", async () => {
  const r = await drive({ ask: "describe the bakery", rounds: [[use("set_site_settings", { name: "Harbour Loaves", description: "Sourdough baked at dawn by the harbour." })], [use("finish", { summary: "Set the name and description." })]] });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.reply.ok, true);
  assert.equal(r.config.look.brand, "Harbour Loaves");
  assert.equal(r.config.look.description, "Sourdough baked at dawn by the harbour.");
  assert.equal(r.css, CSS, "the stylesheet is untouched");
  assert.deepEqual(r.reply.settings.sort(), ["description", "name"]);
  assert.ok(r.compiles.length >= 1, "a settings-only change is published");
});

test("set_logo through the edit route: an owner's upload stored as the header mark", async () => {
  const r = await drive({ ask: "this is my logo", uploads: ["abc123.png"], rounds: [[use("set_logo", { upload: "abc123.png" })], [use("finish", { summary: "Logo set." })]] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.config.look.wordmark, { form: "image", url: "/u/" + r.slug + "/abc123.png" });
  const bad = await drive({ ask: "logo", uploads: [], rounds: [[use("set_logo", { upload: "nope.png" })], [use("finish", { summary: "x" })]] });
  assert.equal(bad.config.look.wordmark, undefined, "a file that is not an upload is never stored");
});

test("a publish that fails puts the stored settings back", async () => {
  const r = await drive({ ask: "x", compiler: { ok: false, error: "broken" }, rounds: [[use("set_site_settings", { name: "Broken" })], [use("finish", { summary: "x" })]] });
  assert.equal(r.reply.ok, false);
  assert.ok(r.compiles.length >= 1, "the publish was tried");
  assert.equal(r.config.look.brand, "Harbour Loaf", "the name is put back");
});

test("rename_page through the edit route: the page moves and the publish records old → new", async () => {
  const r = await drive({ ask: "call the menu page food", rounds: BUILT([use("rename_page", { from: "/menu", to: "/food" })]) });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  const pages = JSON.parse(r.store.get("source/" + r.slug + "/pages.json"));
  assert.ok(pages.some((p) => p.path === "food.tsx") && !pages.some((p) => p.path === "menu.tsx"));
  assert.deepEqual(r.reply.moved, { "/menu": "/food" });
  const stored = [...r.store.values()].filter((v) => typeof v === "string" && v.includes("redirectsCsv"));
  assert.ok(stored.length, "a sidecar was composed");
  assert.ok(stored.some((v) => { const side = JSON.parse(v); return /\/menu[^\n]*\/food/.test(String(side.redirectsCsv || "")); }), "the old address goes to the new one");
});

test("ask_owner through the edit route: the question is the answer, nothing saved", async () => {
  const r = await drive({ ask: "change the hours", rounds: [[use("ask_owner", { question: "Which days?", options: ["Weekdays", "Every day"] })]] });
  assert.match(r.reply.error, /^clarify/, "the ending took it as the agent's question");
  assert.notEqual(r.reply.error, "clarify-mixed", "the ending knows what the answer must still do");
  assert.equal(r.home, HOME);
  assert.equal(r.compiles.length, 0);
});

test("an answer resumes the agent with the question and the answer beside the request", async () => {
  const r = await drive({ ask: "change the hours", extra: { context: [{ q: "Which days?", a: "Every day" }] }, rounds: [[use("finish", { summary: "Nothing." })]] });
  const first = JSON.stringify(r.seen.agent[0].messages[0]);
  assert.ok(first.includes("Which days?") && first.includes("Every day"), "the agent sees both");
});

test("the screen sizes reach the agent and the publish", async () => {
  const r = await drive({ ask: "bigger heading on phones", extra: { devices: ["phone"] }, rounds: [[use("finish", { summary: "Nothing." })]] });
  const first = JSON.stringify(r.seen.agent[0].messages[0]);
  assert.match(first, /PHONE ONLY/);
  const all = await drive({ ask: "bigger heading", rounds: [[use("finish", { summary: "Nothing." })]] });
  assert.doesNotMatch(JSON.stringify(all.seen.agent[0].messages[0]), /ONLY\. Make it inside/);
});

test("set_table_rules is not offered on a site with no database", async () => {
  const r = await drive({ ask: "x", rounds: [[use("finish", { summary: "Nothing." })]] });
  const names = r.seen.agent[0].tools.map((t) => t.name);
  assert.ok(!names.includes("set_table_rules"));
  for (const n of ["set_site_settings", "set_logo", "set_languages", "rename_page", "make_qr", "ask_owner"]) assert.ok(names.includes(n), n);
});
