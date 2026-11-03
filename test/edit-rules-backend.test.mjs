// THE `rules` RUNG'S BACKEND RESOLUTION, AND WHY AN UNRESOLVED ONE MUST NOT
// BUY A REWRITE OF EVERY PAGE.
//
// Run 12 (2026-09-21, `fretwork-1`) is the reproduction. The rung read
// `siteBackendBySlug`, escalated on a falsy answer, and the browser turned
// that escalate into the ~25-credit rewrite of every page — for a site whose
// database is REAL and whose `site_backends.neon_db` is merely blank. Two
// credits, nothing published, a blank screen.
//
// THREE DEFECTS, and each is its own group below:
//
//   1. ONE `null` FOR FOUR FACTS. `site-backend-state.mjs` has argued these
//      apart since 2026-09-15 and the addon path was fixed then; this rung was
//      not. An absent database, a missing REFERENCE to a real one, and a
//      lookup that threw need three different answers.
//
//   2. THE WORKER AND THE CONTAINER DISAGREED SILENTLY. `siteBackendBySlug`
//      checks the `SITE_ROUTES` KV cache first and the container has no such
//      binding, so one rung answered two different ways depending on where it
//      ran. `siteBackendDetail` reads Supabase and never the cache.
//
//   3. AN UNRESOLVED DEPENDENCY ESCALATED. A full-site rewrite cannot repair a
//      missing database reference, so cannot-tell stops here — while a site
//      that genuinely HAS no database still escalates, by name, to the one
//      step that can make one.
//
// Nothing here reaches a model, provisions a database or touches a live site:
// the wire is stubbed and the two Supabase reads are the seams the four states
// are driven through.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { BACKEND_STATES, backendState } from "../site-backend-state.mjs";
import { editGateRefusal } from "../site-owner.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible sentence for an edit body rather than throwing, so a guard pinned
// to it passes whatever the edit screen really says.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
import { readFileSync } from "node:fs";

const USER = { id: "u-rulesback-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SLUG = "ravenscroft-rules";
const SRC_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";

const ROUTE_HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n";
const HOME = ROUTE_HEAD + "function Home(){return <main><h1>Ravenscroft</h1></main>}\n";

function bucket(slug) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/**
 * THE WIRE, WITH THE TWO BACKEND READS AS ITS SEAMS.
 *
 * `site_backends` and `site_project` are exactly the two rows `backendState`
 * decides from, so driving them drives the four states through the REAL
 * resolver rather than through a second copy of its rules written here.
 *
 * `throwBackends` makes the first lookup fail, which is the only way to reach
 * `unreadable` honestly: a state that is asserted by handing the route a
 * pre-made verdict is a statement about the fixture.
 *
 * A MODEL CALL IS A FAILURE HERE, not a stub. Every case below is meant to
 * stop before one, so a `/v1/messages` request means the rung got further than
 * its subject and the case would otherwise pass for the wrong reason.
 */
function withWire({ backends = [{ uid: USER.id, brief: "", neon_db: "" }], project = [], throwBackends = false, sql = null } = {}, run) {
  const real = globalThis.fetch;
  const seen = { messages: 0, backendReads: 0, projectReads: 0, patches: [], sql: [] };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rpc/use_credits") || url.includes("/rpc/credit_debit")) {
      return new Response("100", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "PATCH") { seen.patches.push(url); return new Response("[]", { status: 200, headers: { "content-type": "application/json" } }); }
      seen.backendReads++;
      if (throwBackends) return new Response("upstream is down", { status: 500 });
      return new Response(JSON.stringify(backends), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      seen.projectReads++;
      return new Response(JSON.stringify(project), { status: 200, headers: { "content-type": "application/json" } });
    }
    // Neon's HTTP SQL endpoint — how `siteBackendDetail` PROVES a derived
    // database answers before handing its connection over.
    //
    // ⚠ THE SHAPE IS DERIVED FROM THE DRIVER, NOT TYPED FROM MEMORY. The first
    // draft answered `{rows:[{...}], fields:[]}`, which reads exactly like a
    // Postgres result and is not one: the serverless driver maps `fields` over
    // every row, so it threw `c.map is not a function` and the probe FAILED —
    // which made two cases pass for a reason that had nothing to do with their
    // subject. `rows` are arrays of VALUES and `fields` carries the names.
    if (/neon\.tech|\/sql$/.test(url)) {
      // ⚠ THE QUERY IS READ, NOT JUST COUNTED (2026-09-21). The catalog-aware
      // reader asks TWO different things — `information_schema.columns` and
      // then `_meta` — and the whole of correction 2 is that they can disagree:
      // a table that exists with no schema row. A fixture answering every query
      // the same way cannot express that at all, so it is dispatched on what
      // was actually asked. The body shape is DERIVED from the driver
      // (`{"query":…,"params":[]}`), not typed from memory.
      let asked = "";
      try { asked = String(JSON.parse(String((init && init.body) || "{}")).query || ""); }
      catch { asked = String((init && init.body) || ""); }
      // ⚠ RECORDED WHOLE, SLICED ONLY WHEN PRINTED. The first draft pushed
      // `asked.slice(0, 80)` and then matched on `information_schema.columns`,
      // which falls PAST that cut — so four cases reported the catalog as never
      // asked when it had been asked first. A window sized in bytes, met inside
      // the guard written for the fix that needed it.
      seen.sql.push(asked);
      // `sql` is a MODE, or a FUNCTION of the query text — because the
      // schema-read case needs the probe to SUCCEED and the read after it to
      // fail, and the catalog cases need the two reads to answer differently.
      const mode = typeof sql === "function" ? sql(asked, seen.sql.length) : sql;
      if (mode === "down") return new Response("could not connect", { status: 500 });
      // A descriptor answers a shaped result; a bare string keeps the two
      // original modes working byte for byte.
      const rows = mode && typeof mode === "object" && Array.isArray(mode.rows)
        ? mode.rows
        : mode === "empty" ? [] : [[1]];
      const fields = mode && typeof mode === "object" && Array.isArray(mode.fields)
        ? mode.fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" }))
        : [{ name: "?column?", dataTypeID: 23, tableID: 0, columnID: 0, dataTypeSize: 4, dataTypeModifier: -1, format: "text" }];
      return new Response(JSON.stringify({ command: "SELECT", rowCount: rows.length, rows, fields }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/messages")) {
      seen.messages++;
      return new Response("a model call is a failure in this file", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(seen); } finally { globalThis.fetch = real; }
  })();
}

async function rulesEdit(instruction, { store } = {}) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + SLUG + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer: "rules", page: "", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const env = {
    SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
    NEON_API_KEY: "test-neon-key", ...dispatchEnv(),
  };
  const res = await worker.fetch(req, env, makeCtx());
  const body = await res.clone().json().catch(() => null);
  // `res.ok` TRAVELS WITH THE BODY: `{ok:false}` at 200 and at 503 are two
  // different screens and only the pair separates them.
  return { status: res.status, body, said: editBrowserReply(body, res.ok) };
}

/** Did the browser's own handling record a second, PAID request? */
const paidActions = (said) => (said.actions || []).filter((a) => /PAID|rewrite/i.test(a));

/**
 * WHICH OF THE CATALOG-AWARE READER'S TWO QUESTIONS IS THIS?
 *
 * Both are matched on a fragment of the module's OWN query text rather than on
 * call order, because the order is `readSchemaState`'s to change and a guard
 * that encodes it would report a refactor as a defect.
 */
const asksCatalog = (q) => /information_schema\.columns/i.test(String(q));
const asksMeta = (q) => /_meta/i.test(String(q)) && /k\s*=\s*'schema'/i.test(String(q));

/**
 * A DATABASE WHOSE CATALOG AND `_meta` CAN DISAGREE.
 *
 * `tables` is what `information_schema.columns` answers — the shape `appTables`
 * reads, one row per column — and `spec` is what `_meta` holds, with `null`
 * meaning THE ROW IS ABSENT. That pair is the whole of correction 2: a table
 * that exists with no schema row is neither "empty" nor "unreadable", and the
 * rung used to call it empty and buy a paid addon for it.
 */
function catalog({ tables = {}, spec = null, catalogDown = false, permsDown = false } = {}) {
  return (asked) => {
    if (asksCatalog(asked)) {
      if (catalogDown) return "down";
      const rows = [];
      for (const [t, cols] of Object.entries(tables)) for (const c of cols) rows.push([t, c, "text"]);
      return { rows, fields: ["t", "c", "ty"] };
    }
    if (asksMeta(asked)) return { rows: spec === null ? [] : [[JSON.stringify(spec)]], fields: ["v"] };
    // THE PERMISSION SURFACE — the three reads `reconcileSpec` needs before it
    // may rebuild anything. Failing them is the honest way to reach "recovery
    // is not safe here", because without grants and policies there is nothing
    // to verify a rebuilt declaration against.
    if (asksPerms(asked)) return permsDown ? "down" : { rows: [], fields: ["t"] };
    // Everything else — the `incomplete` probe among them — answers empty
    // rather than failing, so a case that reaches it reports about the branch
    // it means to.
    return { rows: [], fields: ["x"] };
  };
}

/** The three reads the recovery needs: grants, policies, triggers. */
const asksPerms = (q) => /privileges|pg_policies|pg_trigger/i.test(String(q));

// ── 2. AN UNREADABLE DEPENDENCY STOPS, AND BUYS NOTHING ─────────────────────

test("a Supabase that cannot be read refuses above the rung, and starts nothing", async () => {
  // ⚠ WHAT THIS REALLY DRIVES, stated because the first draft asserted
  // something else and was wrong about WHERE the refusal comes from. With
  // `site_backends` unreadable the route cannot establish OWNERSHIP, so it
  // refuses before the rung is reached at all — which is correct, and is why
  // the rung-level `unreadable` case below uses a failing DATABASE PROBE
  // instead. Asserting the rung here would have been a claim about a branch
  // this input never takes.
  const store = bucket(SLUG);
  const r = await withWire({ throwBackends: true },
    (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.equal(r.status, 503, "an unreadable ownership check no longer answers 503: " + JSON.stringify(r.body));
  assert.equal(r.seen.messages, 0, "a model was called for a site whose ownership could not be checked");
  assert.equal(r.seen.sql.length, 0, "a site whose ownership could not be checked was queried anyway");
  // ⚠ THE PROPERTY: no escalate on the wire. That field is what the browser
  // turns into the ~25-credit rewrite, and a rewrite does not fix Supabase.
  assert.notEqual(r.body && r.body.escalate, true, "an unreadable dependency still escalates");

  // ⚠ THIS CASE ASSERTED THE DEFECT AND NOW ASSERTS THE FIX (2026-09-21,
  // owner: *"Ownership lookup failure still starts a full rewrite"*).
  //
  // It was written as a recorded OPEN finding — the server right, the browser
  // falling through to the ~25-credit rewrite because the gate's body carries
  // only `{error}` and `editAnswer` needs a `msg` to display anything. The
  // reasoning for leaving it was that `assertOwner` is ONE gate shared by a
  // dozen owner routes, which is true and is not a reason to leave the EDIT
  // route starting a paid request off a refusal: `editGateRefusal` re-shapes
  // the answer at this boundary alone and the gate is untouched.
  assert.equal(r.said.shown, true, "the browser printed NOTHING for an unreadable ownership check");
  assert.deepEqual(r.said.actions, [],
    "an unreadable ownership check still starts a paid request: " + JSON.stringify(r.said.actions));
  // THE EXACT WORDING, because "displays something" and "displays the right
  // thing" are two claims and only the second is worth having.
  //
  // ⚠ THE MONEY IS THE READER'S, FROM THE REPLY (2026-09-25): the gate's own
  // sentence says what happened, and the body carries `unchanged: true` and
  // `cost: 0`, from which the browser says the site did not change and what
  // this edit cost — beside what the routing call cost, when the page holds
  // its reply (this harness hands none over, so that line is absent here).
  assert.equal(r.said.text,
    "I couldn't check that this site is yours just now, so I've stopped rather than act on it — this is on us. "
    + "Try again in a few minutes. Nothing on your site changed, and this edit cost you nothing.");
  assert.equal(r.body.unchanged, true, "the refusal no longer says it wrote nothing: " + JSON.stringify(r.body));
  // OWNERSHIP ENFORCEMENT IS UNCHANGED: the gate's own decision and its own
  // sentence both survive verbatim on the wire, under the field the other
  // dozen routes read.
  assert.equal(r.body.error, "couldn't check that site just now — try again in a moment",
    "the gate's own refusal was rewritten rather than carried: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, false, "a refusal claimed success");
  assert.equal(r.body.cost, 0);
});

test("a site that is not yours is refused on the screen, not with a paid rewrite", async () => {
  // ⚠ THE REPORT NAMED THE 503 AND THE 404 HAD THE IDENTICAL DEFECT —
  // MEASURED, not assumed: `{error: "no such site"}` carries no `msg` either,
  // so it fell through the same way. A rewrite cannot make a site yours.
  //
  // AND THIS IS THE ENFORCEMENT CONTROL. A fix that made the refusal friendly
  // by letting the edit through would satisfy every assertion above it, so the
  // status, the gate's own body and the absence of any work are all asserted.
  const store = bucket(SLUG);
  const r = await withWire({ backends: [{ uid: "somebody-else", brief: "", neon_db: "site_x" }] },
    (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.equal(r.status, 404, "a stranger's site answered something other than 404: " + JSON.stringify(r.body));
  assert.equal(r.body.error, "no such site", "the 404's own sentence was rewritten: " + JSON.stringify(r.body));
  assert.equal(r.seen.messages, 0, "a model was called for a site the caller does not own");
  assert.equal(r.seen.sql.length, 0, "a site the caller does not own was queried anyway");
  assert.equal(r.said.shown, true, "the browser printed NOTHING for a site that is not yours");
  assert.deepEqual(r.said.actions, [],
    "a site that is not yours still starts a paid request: " + JSON.stringify(r.said.actions));
  assert.equal(r.said.text,
    "I can't find a site with that name on your account, so there was nothing for me to edit. "
    + "Nothing on your site changed, and this edit cost you nothing.");
});

test("the re-shaping is the EDIT route's and no other owner route's", async () => {
  // THE CENSUS THAT KEEPS THE BOUND. `assertOwner` is shared by a dozen routes
  // that hand its body straight back, and widening the GATE would change every
  // one of them to fix one — which the owner ruled out in as many words. So the
  // property is that exactly one call site re-shapes.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // Blanked, because the note above the call site names the function and a
  // comment about a name is not a second caller.
  const code = src.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const calls = (code.match(/editGateRefusal\(/g) || []).length;
  assert.equal(calls, 1, "the edit boundary's re-shaping has spread to " + calls + " call sites");
  // AND THE OBSERVER IS PROVED ALIVE: the gate itself still has its many.
  const gates = (code.match(/assertOwner\(/g) || []).length;
  assert.ok(gates >= 10, "the scanner found only " + gates + " `assertOwner` calls, so its zero above means nothing");
});

/**
 * THE RULES BRANCH'S OWN SOURCE, landmark to landmark.
 *
 * ⚠ ON CODE, NEVER ON A HEADING COMMENT — the blanker turns a comment into
 * whitespace, and a window that opens on one is a window over nothing. Both
 * landmarks are asserted, because `indexOf` answering -1 gives `slice(-1,-1)`
 * = `""`, which passes everything inside it.
 */
function readRulesBranch() {
  const raw = readWorker();
  const at = raw.indexOf('if (eLayer === "rules") {');
  assert.ok(at > 0, "the rules branch is gone from worker.js");
  const end = raw.indexOf("runRulesEdit({", at);
  assert.ok(end > at, "the rules branch's closing landmark moved above its opening one");
  const block = raw.slice(at, end);
  assert.ok(block.length > 400, "the rules branch came out too small to assert over: " + block.length);
  return blankComments(block);
}

let WORKER_SRC = null;
function readWorker() {
  if (WORKER_SRC == null) WORKER_SRC = require("node:fs").readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  return WORKER_SRC;
}

/**
 * Whole-line comments blanked, length preserved.
 *
 * PROSE CONTAINS THE THING IT FORBIDS: the comments above this branch NAME
 * `siteBackendBySlug` while explaining that it must not be used, so a scan
 * that forbids that spelling has to read past them or it reports the fix as
 * the defect. Line comments only, and block openers only at the start of a
 * line — `// Every /api/* call …` has opened a false block running 71,729
 * characters in this repo before.
 */
function blankComments(src) {
  return src.split("\n").map((line) => {
    const t = line.trimStart();
    return (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) ? " ".repeat(line.length) : line;
  }).join("\n");
}

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
