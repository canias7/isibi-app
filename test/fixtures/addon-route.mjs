// DRIVE THE REAL ADDON ROUTE, END TO END, IN A PLAIN NODE TEST.
//
// WHY THIS EXISTS, in the owner's own words (2026-09-14): *"Demonstrate these
// cases through the relevant route, including what the customer is told. Helper
// tests and source-text assertions alone missed these connections."* Four
// defects shipped on 2026-09-14 with the modules perfectly correct and the
// route wrong about which value it handed them — the cleaner's items where the
// model's declaration was wanted, the proposed names where the applied result
// was wanted, a table replaced where the apply merges, and a hand-off composed
// for one of six kinds. Every one of them is invisible to a module test and to
// a source scan, and every one is one line of output away through here.
//
// WHAT IT REACHES. `POST /api/site/<slug>/addon` on the PAGELESS path — a
// scheduled job, or an internal function only the platform calls, changes no
// page — so the whole route runs: the picker, one designer per kind, the
// cleaner, the per-tier audit, the schema apply against a real
// `applySiteSchema` over a fake Neon, the coverage, and the reply the customer
// reads. No container, no compile, no publish, no credit, no network.
//
// EVERY SEAM IS THE REAL PRODUCER'S. GoTrue, the two Supabase tables, the
// ledger, Neon's SQL-over-HTTP endpoint and both model providers are answered
// in THEIR OWN shapes off one `fetch` stub, and the add call's kind is read off
// the REQUEST — `add_to_site`'s one property is named by the kind — rather than
// guessed from call order, which is what changed underneath an earlier fixture
// of this shape once already.
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";

export const USER = { id: "u-addon-route", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return <h1>Fretwork</h1>}" }];

/**
 * THE SITE'S STORED SCHEMA, in the shape `_meta` really holds: a `bookings`
 * table with three columns and `access: "user"` — which is what makes the
 * extension case observable at all, since a replaced table loses exactly those.
 */
export const STORED_SCHEMA = {
  tables: [{ name: "bookings", access: "user", columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }, { name: "phone", type: "text" }] }],
  functions: [], apis: [], jobs: [],
};

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fretwork", pages: [] }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/**
 * ONE `fetch`, every seam the route really uses.
 *
 * `fnFail` makes Postgres REFUSE `CREATE OR REPLACE FUNCTION` — a real failure
 * shape, answered as a 400 the way Neon answers one — because "the function
 * does not exist but the job that runs it does" is the case the evidence rule
 * exists for and cannot be reached any other way.
 */
function stub({ kinds, answers, fnFail = false, sql, prompts }) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    // `site_project` FIRST: both URLs carry `/rest/v1/` and this is the more
    // specific match — the ordering an earlier fixture of this shape got wrong.
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify([{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@ep-addon.neon.tech/neondb" }]),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "", neon_db: "sitedb" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    // A HEALTHY LEDGER, answering what it was asked for: a dead one stops the
    // route a gate short of everything under test.
    if (url.includes("/rpc/use_credits")) {
      let want = 0; try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
    }
    // NEON, SQL OVER HTTP — the seam `applySiteSchema` really uses (`neon()` is
    // a closure over fetch). Rows come back as ARRAYS with `fields`, which is
    // the driver's own wire shape; an object row makes it throw `c.map`.
    if (url.includes("neon.tech/sql")) {
      let q = ""; try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { q = ""; }
      sql.push(String(q));
      if (/^SELECT v FROM _meta WHERE k = /i.test(q.trim())) {
        return new Response(JSON.stringify({ command: "SELECT", rowCount: 1, rows: [[JSON.stringify(STORED_SCHEMA)]], fields: [{ name: "v", dataTypeID: 25 }] }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      if (fnFail && /CREATE OR REPLACE FUNCTION/i.test(q)) {
        return new Response(JSON.stringify({ message: 'syntax error at or near "selct"' }), { status: 400, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const anthropic = url.includes("/v1/messages");
    const xai = url.includes("/v1/chat/completions");
    if (anthropic || xai) {
      // WHICH TOOL, AND FOR WHICH KIND — read off the REQUEST, never guessed
      // from call order. Every add call asks for `add_to_site`, whose ONE
      // property besides `requirements` is named by the kind.
      const b = (() => { try { return JSON.parse(String(init && init.body) || "{}"); } catch { return {}; } })();
      const asked = (b.tool_choice && (b.tool_choice.name || (b.tool_choice.function && b.tool_choice.function.name))) || "";
      const props = (() => {
        const t = (b.tools || []).find((x) => (x.name || (x.function && x.function.name)) === asked);
        const schema = t && (t.input_schema || (t.function && t.function.parameters));
        return Object.keys((schema && schema.properties) || {});
      })();
      const kind = props.find((x) => x !== "requirements") || "";
      prompts.push({ tool: asked, kind, text: JSON.stringify(b.messages || b.system || b) });
      const inputObj = asked === "pick_adds" ? { kinds } : (answers[kind] || {});
      const body = anthropic
        ? { stop_reason: "tool_use", content: [{ type: "tool_use", name: asked, input: inputObj }], usage: { input_tokens: 10, output_tokens: 5 } }
        : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked, arguments: JSON.stringify(inputObj) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    // EVERYTHING ELSE REFUSED. A stub that answered every call would let the
    // route wander past the thing under test.
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

/**
 * One addition, through the real route.
 *
 * `{ status, body, sql, prompts, store }` — `prompts` is every model request
 * the route really sent, which is how a hand-off is proved to have REACHED its
 * designer rather than merely to have been composed.
 *
 * A SLUG PER CASE, and that is not tidiness: `siteBackendBySlug` memoizes on
 * the slug for five minutes, so a shared name lets the first case's answer
 * serve every later one.
 */
export async function addon(slug, instruction, opts) {
  const sql = [], prompts = [];
  const restore = stub({ ...opts, sql, prompts });
  try {
    const worker = await loadWorker();
    const store = bucket(slug);
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/addon", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ instruction }),
    });
    const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" }, makeCtx());
    const body = await res.json().catch(() => null);
    return { status: res.status, body, sql, prompts, store };
  } finally { restore(); }
}

/** The request the named kind's designer really received, or `undefined`. */
export const promptFor = (r, kind) => r.prompts.find((p) => p.kind === kind);

/** The stored developer record, as `saveAddonAnswer` left it. */
export function storedAnswer(r, slug) {
  for (const [k, v] of r.store.store) {
    if (k.includes(slug) && k.includes("addon-answer")) { try { return JSON.parse(v); } catch { return null; } }
  }
  return null;
}
