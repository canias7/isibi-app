// THE SITE AGENT'S ROUTE DRIVER, copied from test/site-agent-route.test.mjs (2026-10-30),
// with `images` on the request body, for test/site-agent-inputs.test.mjs.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../../builder/edit-job.mjs";
import { pageCredits } from "../../builder/publish-pages.mjs";
import { modelsFor } from "../../builder/build-models.mjs";


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
export async function drive({ mode = "sync", route = "edit", ask, rounds, chat = null, images = null }) {
  const slug = "agent-" + mode + "-" + hex(4);
  const b = bucket(slug);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/" + route;
  const reqBody = JSON.stringify({ layer: "page", page: "/", instruction: ask, picker: "sonnet", idem: "idem" + hex(8), ...(chat ? { chat: chat.key } : {}), ...(images ? { images } : {}) });
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

