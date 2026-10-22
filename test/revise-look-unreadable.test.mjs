// A REVISE WHOSE STORED LOOK CANNOT BE READ STOPS, REFUNDED (2026-10-22, the
// builder audit's A26-1).
//
// The revise read the site's config to keep what the site wears, and a failed
// read was logged and passed over: `priorLook` stayed null, `mergeLook(null, ...)`
// had no owner's mark to keep, and the merged look was written over the stored
// one. Since 2026-09-07 an uploaded logo and tab icon live INSIDE the look
// (`{form:"image"}`), so one storage blip during a revise deleted the owner's
// logo and icon for good. Cannot-tell must never read as a value: a config
// that could not be read now stops the revise before anything is written, and
// gives back what it took, as the revise's schema read already does.
//
// Reproduced on the parent through the real `POST /api/site/react-revise`, the
// config's first read refused once (the blip over before the write).
// Every model answer is SUPPLIED; nothing here is paid.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

const STORED_LOOK = { brand: "Fretwork", theme: "broadsheet", wordmark: { form: "image", url: "/u/revise-look/aaaa.png" }, favicon: { form: "image", url: "/u/revise-look/bbbb.png" } };
const USER = { id: "u-revise-look-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const HOME = "import { createFileRoute } from '@tanstack/react-router'\nimport { useRpc } from \"@/lib/rows\"\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + 'function Home(){ const q = useRpc("bookings_on_day", { day: "2026-09-22" }); return <main><h1>Fretwork</h1><p>{String(q.data)}</p></main> }\n';
// WHAT THE SITE STORES: a table and the function its home page calls.
const SPEC = {
  tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }, { name: "name", type: "text" }], read: "none", write: "anyone" }],
  functions: [{ name: "bookings_on_day", args: [{ name: "day", type: "date" }], returns: "integer" }],
};
const CATALOG = { bookings: ["id", "day", "name", "created_at"] };
const asksCatalog = (q) => /information_schema\.columns/i.test(String(q));
const asksMeta = (q) => /_meta/i.test(String(q)) && /k\s*=\s*'schema'/i.test(String(q));
const FRONTEND = "THIS SITE HAS NO DATABASE";
const DIGEST_FN = /bookings_on_day\(day: date\) -> integer/;
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

function bucket(slug, configDown) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }])],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: STORED_LOOK, css: ".site-footer{background:teal}" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { if (k === CONFIG_KEY(slug) && configDown.on && ++configDown.reads === 2) throw new Error("R2 blip"); const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * ONE REVISE OF A COLOUR, on a site in the named state. `db` decides what the
 * database answers: "up" answers the catalog and `_meta`, "down" refuses every
 * query, "catalog-down" answers the proof and refuses the catalog.
 */
async function revise({ state = "none", db = "up", backend = null, down = false }) {
  const slug = "revise-look-" + (down ? "down" : "up");
  // THE SECOND READ OF THE CONFIG IS THE LOOK'S (the first is the route's
  // earlier read); the blip is over by the write's own read after it.
  const configDown = { on: down, reads: 0 };
  const seen = { bucket: null, tools: [], writer: null, sql: [], writes: [], debits: [], reverses: [], neonApi: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/credit_debit")) { seen.debits.push(JSON.parse(String(init.body))); return json({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false }); }
    if (url.includes("/rpc/credit_reverse")) { seen.reverses.push(JSON.parse(String(init.body))); return json({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }); }
    if (url.includes("/rpc/use_quota")) return json(true);
    if (url.includes("/rpc/get_credits")) return json(500);
    if (url.includes("/rest/v1/site_backends")) {
      if (method !== "GET") { seen.writes.push(method + " " + url); return json([]); }
      return json([{ uid: USER.id, neon_db: state === "ready" ? "db_ready" : "", brief: "a guitar school" }]);
    }
    if (url.includes("/rest/v1/site_project")) return json(state === "none" ? [] : [{ uid: USER.id, neon_conn: PROJECT_CONN }]);
    if (url.includes("console.neon.tech") || url.includes("/api/v2/projects")) { seen.neonApi.push(method + " " + url); return new Response("no", { status: 503 }); }
    if (/neon\.tech|\/sql$/.test(url)) {
      let asked = "";
      try { asked = String(JSON.parse(String(init.body || "{}")).query || ""); } catch { asked = String(init.body || ""); }
      seen.sql.push(asked);
      if (db === "down") return new Response("could not connect", { status: 500 });
      if (db === "catalog-down" && asksCatalog(asked)) return new Response("permission denied", { status: 500 });
      let rows = [], fields = ["x"];
      if (asksCatalog(asked)) { for (const [t, cols] of Object.entries(CATALOG)) for (const c of cols) rows.push([t, c, "text"]); fields = ["t", "c", "ty"]; }
      else if (asksMeta(asked)) { rows = [[JSON.stringify(SPEC)]]; fields = ["v"]; }
      else if (/^\s*SELECT 1\s*$/i.test(asked)) { rows = [[1]]; fields = ["?column?"]; }
      return json({ command: "SELECT", rowCount: rows.length, rows, fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
    }
    if (url.includes("/v1/messages")) {
      const body = JSON.parse(String(init.body || "{}"));
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === SITE_PAGES_TOOL.name) seen.writer = { system: JSON.stringify(body.system || ""), user: JSON.stringify(body.messages || "") };
      if (tool === "design_schema") {
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { brand: "Fretwork", slug, description: "guitar lessons", kind: "shopfront", purpose: "book a lesson", pages: [{ path: "/", name: "Home" }], components: [], css: ".site-footer{background:navy}", ...(backend ? { backend } : {}) } }], usage: { input_tokens: 100, output_tokens: 50 } });
      }
      // THE WRITER'S REQUEST IS THE READING; its answer is not.
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/react-revise", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ slug, instruction: "Make the footer navy", picker: "sonnet" }),
    });
    const env = { SITES_BUCKET: (seen.bucket = bucket(slug, configDown)), ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const res = await worker.fetch(req, env, makeCtx());
    const reply = await res.json().catch(() => null);
    return { status: res.status, reply, ...seen };
  } finally {
    globalThis.fetch = real;
    c.uninstall();
  }
}


test("a revise whose config read fails stops, refunded, and leaves the owner's logo and tab icon stored", async () => {
  const r = await revise({ down: true });
  const stored = JSON.parse(r.bucket.store.get(CONFIG_KEY("revise-look-down")));
  // THE PROPERTY FIRST: what the site wears afterwards.
  assert.deepEqual(stored.look.wordmark, STORED_LOOK.wordmark, "the uploaded logo was written over: " + JSON.stringify(stored.look.wordmark));
  assert.deepEqual(stored.look.favicon, STORED_LOOK.favicon, "the uploaded tab icon was written over: " + JSON.stringify(stored.look.favicon));
  assert.equal(r.status, 503, JSON.stringify(r.reply));
  assert.equal(r.reply.ok, false);
  assert.equal(r.reply.error, "look-unreadable", JSON.stringify(r.reply));
  assert.equal(r.reply.ours, true);
  assert.equal(r.writer, null, "the pages were rewritten without the stored look");
  assert.equal(r.reverses.length, 1, "the design deposit was not given back, or was given back twice");
  assert.equal(r.reply.cost, 0, "the refusal does not report what the revise cost after its refund");
});

test("control: a readable config keeps the logo and tab icon and the revise goes on", async () => {
  const r = await revise({ down: false });
  // THE OBSERVER IS ALIVE: the read happened and the revise reached the writer.
  assert.ok(r.writer, "the writer was never called: " + JSON.stringify(r.reply));
  const stored = JSON.parse(r.bucket.store.get(CONFIG_KEY("revise-look-up")));
  assert.deepEqual(stored.look.wordmark, STORED_LOOK.wordmark);
  assert.deepEqual(stored.look.favicon, STORED_LOOK.favicon);
});
