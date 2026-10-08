// THE BUILD ROUTE, DRIVEN WITH A SUPPLIED DESIGN ANSWER (2026-10-08, the
// first-Build audit's correction batch).
//
// One real `POST /api/site/react-build` through the Worker's own router: the
// real auth read, the real deposit, the real design call against a supplied
// model answer, the real merge, the real config write and the real refusals.
// Only the network is faked — GoTrue, the ledger RPCs, Anthropic and the
// Neon API answer from here — and R2 is a Map. No paid call, no container.
//
// The page writer is answered with a 503, so a build that gets that far stops
// at its own credit floor or generation step; what the cases read is what
// happened BEFORE that: what was charged and given back, what the designer
// was told, what was stored.

import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./cf-containers.mjs";

export const BUILD_USER = { id: "u-audit-1", email: "o@example.com" };

const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });

/**
 * An R2 stand-in over a Map, with the list the upload store reads.
 *
 * R2'S CONDITIONS AND PAGES, HONOURED (2026-10-08): every write gives the key
 * a new etag; `onlyIf.etagDoesNotMatch: "*"` writes only when the key is
 * absent, `onlyIf.etagMatches` only when the key still has that etag, and a
 * refused write answers null. `list` pages by `limit` and an opaque
 * `cursor`, and says `truncated`. `hooks.beforePut(key, value, opts)` lets a
 * test run another writer between a read and a write — the interleavings.
 */
export function buildBucket(entries = {}, hooks = {}) {
  const store = new Map(Object.entries(entries));
  const etags = new Map();
  let n = 0;
  const tag = (k) => { if (!etags.has(k)) etags.set(k, "e" + (++n)); return etags.get(k); };
  const obj = (k, v) => ({ key: k, etag: tag(k), text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(k, v); },
    async put(k, v, opts) {
      if (hooks.beforePut) await hooks.beforePut(k, v, opts);
      const c = opts && opts.onlyIf;
      if (c && c.etagDoesNotMatch === "*" && store.has(k)) return null;
      if (c && typeof c.etagMatches === "string" && (!store.has(k) || tag(k) !== c.etagMatches)) return null;
      store.set(k, typeof v === "string" ? v : v instanceof Uint8Array ? "bytes:" + v.length : String(v));
      etags.set(k, "e" + (++n));
      return { key: k, etag: etags.get(k) };
    },
    async delete(k) { store.delete(k); etags.delete(k); },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? Number(cursor) || 0 : 0;
      const page = keys.slice(from, from + limit);
      const truncated = from + limit < keys.length;
      return { objects: page.map((k) => ({ key: k, size: 1 })), truncated, ...(truncated ? { cursor: String(from + limit) } : {}) };
    },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
  };
}

/**
 * Drive one build. `design` is the model's answer to the design call: either
 * `{ input }` (a tool call) or `{ stop, text }` (no tool call). `ledger`
 * overrides any RPC answer by name (a function gets the args). Returns what
 * the route answered and everything it was seen doing.
 */
export async function driveBuild({ design, body, ledger = {}, usage = { input_tokens: 100, output_tokens: 50 }, env: extraEnv = {} } = {}) {
  const seen = { tools: [], designer: [], rpc: [], neon: 0 };
  let claimed = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      delete args.p_mint;
      seen.rpc.push({ fn: m[1], args });
      if (Object.hasOwn(ledger, m[1])) {
        const a = typeof ledger[m[1]] === "function" ? ledger[m[1]](args) : ledger[m[1]];
        return a instanceof Response ? a : json(a);
      }
      if (m[1] === "credit_debit") return json({ ok: true, exempt: false, taken: Number(args.p_amount) || 2, balance: 500, repeat: false });
      if (m[1] === "credit_reverse") return json({ ok: true, refunded: Number(args.p_amount) > 1000 ? 0 : Number(args.p_amount) || 0, already: 0, debited: 2, repeat: false });
      if (m[1] === "use_quota") return json(true);
      if (m[1] === "get_credits") return json(500);
      return json({ ok: false, error: "no stub for " + m[1] }, 500);
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "POST") { claimed = true; return json([{ slug: "x", uid: BUILD_USER.id }], 201); }
      return json(claimed ? [{ uid: BUILD_USER.id, neon_db: "", brief: body.brief }] : []);
    }
    if (url.includes("console.neon.tech") || url.includes("neon.tech/api")) { seen.neon++; return new Response("no neon here", { status: 503 }); }
    if (url.includes("/v1/messages")) {
      const b = JSON.parse(String((init && init.body) || "{}"));
      const tool = (b.tool_choice && b.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === "design_schema") {
        seen.designer.push(JSON.stringify(b.messages || ""));
        const content = design.input
          ? [{ type: "tool_use", id: "t1", name: "design_schema", input: design.input }]
          : [{ type: "text", text: design.text || "Here is a design." }];
        return json({ stop_reason: design.input ? "tool_use" : (design.stop || "end_turn"), content, usage });
      }
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    if (url.includes("/rest/v1/")) return json([]);
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  const store = buildBucket();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify({ picker: "sonnet", ...body }),
    });
    const env = { SITES_BUCKET: store, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {}, ...extraEnv };
    const res = await worker.fetch(req, env, makeCtx());
    const reply = await res.json().catch(() => null);
    const cfgRaw = store.store.get("config/" + String((reply && reply.slug) || "harbour-loaf") + ".json");
    const config = cfgRaw ? JSON.parse(cfgRaw) : null;
    return { status: res.status, reply, store: store.store, config, seen };
  } finally { globalThis.fetch = real; c.uninstall(); }
}

export const BRIEF = "Harbour Loaf, a bakery in Leeds. Order loaves for collection.";

/** A complete frontend-only design: every field the first-build tool asks for, and no tables. */
export const GOOD_DESIGN = Object.freeze({
  brand: "Harbour Loaf", slug: "harbour-loaf", description: "A bakery in Leeds", kind: "shopfront",
  purpose: "Order a loaf", pages: [{ path: "/", name: "Home" }],
  shape: [{ path: "/", sections: ["site-chrome — header", "hero — loaves"] }],
  components: ["site-chrome"], action: ["Order a loaf"], theme: "artisan", wordmark: "text",
  favicon: "<svg viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\"/></svg>", behavior: [],
  images: [{ page: "/", describe: "a loaf at dawn" }],
});

/** A real JPEG header, so the upload store's sniff takes it as a picture. */
export const JPEG_DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD" + "A".repeat(64);
