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
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";

export const USER = { id: "u-addon-route", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return <h1>Fretwork</h1>}" }];
// WHAT THE PAGE CALL ANSWERS on a case that is not pageless. A generated page
// must export a Route — `validatePages` refuses one that does not, by
// `createFileRoute(`, which is why this is a real page rather than the stored
// one above: a fixture in a shape the pipeline refuses reads as the model
// declining and escalates.
const WRITTEN_PAGES = [{
  path: "src/routes/index.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "export const Route = createFileRoute('/')({ component: Home })\n"
    + "function Home(){ return <main><h1>Fretwork</h1><p>Guitar repairs in Sheffield.</p></main> }\n",
}];

/**
 * A generated page at a route, in the shape `validatePages` accepts — so a case
 * can say "the writer returned /gallery and not /prices" without retyping the
 * route export every time.
 */
export function writtenPage(routePath) {
  const file = routePath === "/" ? "index" : routePath.replace(/^\//, "").replace(/\//g, "-");
  return {
    path: "src/routes/" + file + ".tsx",
    source: "import { createFileRoute } from '@tanstack/react-router'\n"
      + "export const Route = createFileRoute('" + routePath + "')({ component: Page })\n"
      + "function Page(){ return <main><h1>" + file + "</h1><p>Words for " + file + ".</p></main> }\n",
  };
}

/**
 * THE SITE'S STORED SCHEMA, in the shape `_meta` really holds: a `bookings`
 * table with three columns and `access: "user"` — which is what makes the
 * extension case observable at all, since a replaced table loses exactly those.
 */
export const STORED_SCHEMA = {
  tables: [{ name: "bookings", access: "user", columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }, { name: "phone", type: "text" }] }],
  functions: [], apis: [], jobs: [],
};

function bucket(slug, stored) {
  const store = new Map([
    // THE SITE'S OWN PAGES. One by default; a case that is about a MULTI-PAGE
    // site says so, because "which page does this go on" is only a guess when
    // there is more than one answer.
    ["source/" + slug + "/pages.json", JSON.stringify(Array.isArray(stored) && stored.length ? stored : PAGES)],
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
 * exists for and cannot be reached any other way. `true` refuses every one; a
 * NAME refuses that one alone, which is what makes "the block is per job, by
 * the function IT runs" observable rather than a claim: with everything failing,
 * a wholesale "some function failed, so no jobs" passes every assertion.
 *
 * `registered` collects the rows `persistSiteJobs` really upserts, so a job
 * taken off the reply and a job taken off the DATABASE are two different
 * assertions instead of one.
 */
function stub({ kinds, answers, fnFail = false, sql, prompts, meta, registered, written = null }) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE PUBLISH'S OWN UPLOAD, for a case that changes a page. Chained here
    // rather than defaulted, so a pageless case that somehow reached it still
    // meets the catch-all below.
    if (isDispatchUpload(url)) return dispatchOk();
    // `site_project` FIRST: both URLs carry `/rest/v1/` and this is the more
    // specific match — the ordering an earlier fixture of this shape got wrong.
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify([{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@ep-addon.neon.tech/neondb" }]),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "", neon_db: "sitedb" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE JOB REGISTRY. `persistSiteJobs` reads the paused set and then upserts
    // one row per job; both go to `site_functions`, and the POST is the one
    // that says which schedules the platform will really run. Without this the
    // function returns at its first line (no service key) and a job blocked on
    // the reply and a job blocked in the DATABASE are indistinguishable.
    if (url.includes("/rest/v1/site_functions")) {
      if (init && String(init.method || "GET").toUpperCase() === "POST") {
        try { for (const row of JSON.parse(String(init.body || "[]"))) registered.push(row); } catch { /* the assertion below reads the list */ }
        return new Response("", { status: 201 });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
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
      let q = "", params = [];
      try { const b = JSON.parse(String((init && init.body) || "{}")); q = b.query || ""; params = Array.isArray(b.params) ? b.params : []; } catch { q = ""; }
      sql.push(String(q));
      // ── `_meta` REMEMBERS WHAT WAS WRITTEN TO IT (2026-09-14) ─────────────
      //
      // It used to answer `STORED_SCHEMA` to every read, whatever had been
      // applied — a fixture LESS capable than the thing it stands for, and the
      // one that hides the most here: the route re-reads the spec through
      // `loadSiteSchema` straight after the apply and `appliedFacts` decides
      // every function's and connection's guarantees off THAT read. With a
      // frozen `_meta` no function this change created could ever be found, so
      // every claim about one scored `unverified` for the fixture's reason
      // rather than the product's — an all-clear from a blind instrument.
      //
      // `applySiteSchema` writes it with one statement and the merged spec as
      // its first parameter, so that is what is captured: the real producer's
      // own bytes, never a second idea of what the apply stores.
      if (/INSERT INTO _meta/i.test(q)) {
        if (typeof params[0] === "string") meta.value = params[0];
        return new Response(JSON.stringify({ command: "INSERT", rowCount: 1, rows: [], fields: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      // BOTH SPELLINGS, and the second one is why this fixture was blind.
      // The route reads `WHERE k = 'schema'` and `loadSiteSchema` reads
      // `WHERE k='schema'` — the same statement written two ways, and a
      // pattern pinned to the spaced one sent every `loadSiteSchema` call to
      // the catch-all, which answers no rows. That reads as `{tables: []}`:
      // the post-apply spec the whole evidence rule is decided from was EMPTY
      // in every case here, so nothing a change created could ever be found.
      // A fixture pinned to one spelling of a query is the recorded "assert
      // the property, not the spelling" trap, on the answering side.
      if (/^SELECT v FROM _meta WHERE k\s*=\s*'?schema/i.test(q.trim())) {
        return new Response(JSON.stringify({ command: "SELECT", rowCount: 1, rows: [[meta.value]], fields: [{ name: "v", dataTypeID: 25 }] }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      if (fnFail && /CREATE OR REPLACE FUNCTION/i.test(q)
        && (fnFail === true || new RegExp("FUNCTION\\s+\"?" + String(fnFail) + "\"?\\s*\\(", "i").test(q))) {
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
      // THE PAGE CALL, for a case that is not pageless. A connection or a
      // PUBLIC function exists to be read by a page, so `pageless` is false and
      // the route writes one — which is right, and is why those two kinds
      // cannot be demonstrated on the short path. The answer is the smallest
      // real one: the home page rewritten, no parts, no removals.
      // WHAT THE PAGE WRITER RETURNS, per case. The default is the home page
      // rewritten; `written` lets a case answer with the pages it wants —
      // which is the only way to drive "asked for two, got one", the shape the
      // missing-page report exists for.
      const inputObj = asked === "pick_adds" ? { kinds }
        : asked === "write_pages" ? { pages: written || WRITTEN_PAGES, notes: "" }
        : (answers[kind] || {});
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
  const sql = [], prompts = [], registered = [];
  // THE STORED SCHEMA IS PER CALL, not a shared module object: `meta.value`
  // moves when the apply writes, and a case that read another case's leftovers
  // would be the shared-slug trap one field over.
  const meta = { value: JSON.stringify(STORED_SCHEMA) };
  const restore = stub({ ...opts, sql, prompts, meta, registered });
  // ── A COMPILER ONLY WHEN THE CASE NEEDS ONE ──────────────────────────────
  //
  // `getContainer` throws by default and that default is what keeps a pageless
  // case honest: reaching a container means the route took the page path, and a
  // test that silently compiled there would be asserting about a shape it never
  // meant to produce. `publishes: true` opts in — for the two kinds that CANNOT
  // be pageless, a connection and a public function.
  const c = (opts && opts.publishes) ? installCompiler() : null;
  try {
    const worker = await loadWorker();
    const store = bucket(slug, opts && opts.sitePages ? opts.sitePages.map(writtenPage) : null);
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/addon", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ instruction }),
    });
    // THE SERVICE KEY IS PART OF THE ENVIRONMENT UNDER TEST: `persistSiteJobs`
    // returns at its first line without one, so a fixture that leaves it out
    // never registers a job at all and every assertion about which jobs the
    // platform will run is vacuous.
    const env = { SITES_BUCKET: store, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", SUPABASE_SERVICE_KEY: "svc-test", ...(c ? dispatchEnv() : {}) };
    const res = await worker.fetch(req, env, makeCtx());
    const body = await res.json().catch(() => null);
    return { status: res.status, body, sql, prompts, store, registered, compiles: c ? c.calls : [], meta: () => { try { return JSON.parse(meta.value); } catch { return null; } } };
  } finally { restore(); if (c) c.uninstall(); }
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
