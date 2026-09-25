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

// ── 1. THE FOUR STATES ARE FOUR, AND THE RESOLVER IS THE SHARED ONE ─────────

test("the rung's states come from the shared resolver, not a second copy", () => {
  // THE OBSERVER PROVED ALIVE FIRST. If `backendState` stopped telling these
  // apart, every case below would still pass while asserting nothing.
  assert.deepEqual(BACKEND_STATES, ["ready", "none", "incomplete", "unreadable"]);
  assert.equal(backendState({ site: { neon_db: "db_x" } }).state, "ready");
  assert.equal(backendState({ site: { neon_db: "" }, project: null }).state, "none");
  assert.equal(backendState({ site: { neon_db: "" }, project: { neon_conn: "postgres://h/neondb" } }).state, "incomplete");
  assert.equal(backendState({ failed: new Error("down") }).state, "unreadable");
  // AND THE RUNG ASKS THE READER THAT IGNORES THE KV CACHE. `siteBackendBySlug`
  // checks `env.SITE_ROUTES` first, which is present in the Worker and absent
  // in the container — one rung, two answers, which is defect (2).
  const src = readRulesBranch();
  assert.match(src, /siteBackendDetail\(env, ownerSlug\)/,
    "the rules rung no longer resolves through the four-state reader");
  assert.doesNotMatch(src, /siteBackendBySlug\(/,
    "the rules rung is back on the cache-first reader, so the Worker and the container can disagree again");
});

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
    "⚠️ I couldn't check that this site is yours just now, so I've stopped rather than act on it — this is on us. "
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
    "⚠️ I can't find a site with that name on your account, so there was nothing for me to edit. "
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

test("a schema read that throws refuses, and does not buy a rewrite of every page", async () => {
  // FOUND BY THE CASE BELOW rather than by reading: with the resolution gate
  // fixed, the run-12 shape got past it and straight into `escalate("no-meta")`
  // — the same defect one line down, and the same wrong remedy. A rewrite of
  // every page does not repair an unreadable `_meta` table.
  //
  // ⚠ A `ready` SITE IS NOT PROBED, so the schema read is the FIRST query —
  // measured, after a first draft demanded a second one and failed for that
  // reason. `siteBackendDetail` probes only the `incomplete` branch, where the
  // name was DERIVED and has to be proved; a recorded name needs no proof.
  // So `sql: "down"` here IS the schema read failing, and resolution has
  // already succeeded above it.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: "down",
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.ok(r.seen.sql.length >= 1, "the schema read never happened, so this case is about nothing");
  // ⚠ THE NAMED REASON IS WHAT SEPARATES THIS FROM THE RESOLUTION GATE ABOVE,
  // and a mutation sweep is what showed it mattered. Cutting the resolution
  // gate SURVIVED, because an unresolved backend hands `null` down and the
  // schema read throws — a second wall catching it, with the same status and
  // the same cost. Redundancy is fine; a refusal that cannot say WHICH link
  // failed is not, since "Supabase is down" and "your `_meta` is unreadable"
  // are different things to go and fix.
  assert.equal(r.status, 503, "an unreadable schema answered something other than 503: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0, "an unreadable schema was charged for");
  assert.equal(r.body.ours, true, "this is our failure and the reply does not say so");
  // ⚠ RE-ANCHORED ON THE PROPERTY WHEN THE READER MOVED (2026-09-21). This
  // asserted the literal `"schema-unreadable"`, which was the old reader's one
  // word for every failure; the catalog-aware reader names the STATE and the
  // read (`unreadable:catalog-unreadable` here, measured). The property the
  // sweep proved worth having is unchanged and is what is asserted: the reason
  // says which LINK failed, and it is not the resolution gate's reason.
  assert.ok(r.body.backend && /unreadable|catalog|meta|schema/i.test(String(r.body.backend)),
    "the refusal does not name which read failed: " + JSON.stringify(r.body.backend));
  assert.notEqual(r.body.backend, "derived-database-unreachable",
    "the schema read's refusal wears the resolution gate's reason, so the two walls are indistinguishable");
  assert.notEqual(r.body.escalate, true, "an unreadable schema still escalates");
  // THE CUSTOMER'S SCREEN, composed by the browser's own selection.
  assert.equal(r.said.ok, true, "the screen could not be composed: " + r.said.why);
  assert.equal(r.said.shown, true, "the browser printed NOTHING for this reply");
  assert.match(r.said.text, /database/i, "the screen does not say what could not be read: " + JSON.stringify(r.said.text));
  assert.match(r.said.text, /nothing on your site changed/i,
    "the screen does not tell them their site is untouched: " + JSON.stringify(r.said.text));
  assert.deepEqual(paidActions(r.said), [],
    "an unreadable schema would still buy something: " + JSON.stringify(r.said.actions));
});

// ── 4. A MISSING SCHEMA ROW IS NOT AN EMPTY DATABASE ────────────────────────
//
// Owner, 2026-09-21: *"Missing schema metadata is not proof of an empty
// database."* REPRODUCED — `bookings` exists, the `_meta` row does not, the
// rung asked `_meta` alone, got nothing and escalated to a PAID addon without
// ever looking at the table inventory. That is an inference from the absence of
// ONE ROW to the absence of every table.
//
// THE READER IS THE EXISTING CATALOG-AWARE ONE. `specForAddon` → the Worker's
// `readStoredSpec` → `readSchemaState`, which asks the CATALOG FIRST. Nothing
// here is a second copy of those rules: the three cases below drive the three
// answers that reader really gives, through the real route.

test("a table with no schema row is RECOVERED, not called empty", async () => {
  // THE REPRODUCTION VERBATIM: a live `bookings` table and no stored
  // declaration. The old rung asked `_meta` alone, got nothing, and escalated
  // to a PAID addon. `readSchemaState` answers `tables-without-metadata`, so
  // `specForAddon` rebuilds the declaration from the permission surface and
  // verifies it through the real `policiesFor`/`grantsFor` before using it.
  //
  // ⚠ MEASURED, NOT PREDICTED — and the first draft of this case asserted the
  // opposite. It was written expecting a refusal ("no grants, so nothing can
  // be rebuilt"), and the run answered that recovery SUCCEEDS: a table with no
  // grants and no policies really does derive as the admin pair, and the
  // re-emit matched. The behaviour is right and the guess was wrong, which is
  // this repo's own rule about reading what a thing DOES rather than what it
  // was meant to do.
  //
  // THE RECOVERY'S OWN CORRECTNESS IS NOT RE-TESTED HERE — it has its own
  // sixteen-cell round trip against a real PostgreSQL. What this case is about
  // is that THIS rung reaches it instead of inferring an empty database.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: catalog({ tables: { bookings: ["id", "name", "created_at"] }, spec: null }),
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));

  // THE CATALOG WAS REALLY ASKED — the whole correction. Without this the case
  // could pass against a rung that still reads `_meta` alone.
  assert.ok(r.seen.sql.some(asksCatalog),
    "the table inventory was never read, so this case is about nothing: " + JSON.stringify(r.seen.sql.map((q) => q.slice(0, 40))));
  // ⚠ AND IT DID NOT ESCALATE TO THE PAID ADDON. That is the defect verbatim:
  // a table the customer is asking about, reported as a database with nothing
  // in it, answered with a ~25-credit step.
  assert.notEqual(r.body.escalate, true,
    "a table with no schema row still escalates to a paid step: " + JSON.stringify(r.body));
  assert.notEqual(r.body.reason, "no-meta", "a live table was still called `no-meta`");
  assert.deepEqual(paidActions(r.said), [],
    "a table with no schema row would still buy something: " + JSON.stringify(r.said.actions));
  // THE RECOVERY WAS ATTEMPTED rather than skipped — `reconcileSpec` can decide
  // nothing without the permission surface, so these reads ARE "recover where
  // it is safe".
  assert.ok(r.seen.sql.some(asksPerms),
    "recovery was never attempted, so the rung cannot recover anything: " + JSON.stringify(r.seen.sql.map((q) => q.slice(0, 40))));
  // AND THE RUNG WENT ON TO THE WORK with the recovered table in hand, which is
  // the outcome the customer wanted from the message that produced run 12.
  assert.equal(r.seen.messages, 1,
    "the recovered spec did not reach the work: " + JSON.stringify({ body: r.body, sql: r.seen.sql.map((q) => q.slice(0, 40)) }));
});

test("a table that cannot be recovered safely stops, and does not invent a schema", async () => {
  // THE OTHER ARM, and it is the safety-critical one: the permission surface
  // cannot be read, so nothing can be VERIFIED, so nothing may be rebuilt —
  // and a spec still missing a live table must never be designed against.
  //
  // THE THREE WRONG ANSWERS THIS FORBIDS, each of which the old path gave: call
  // it empty, escalate to a paid addon, or design rules against a declaration
  // known to be short a table.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: catalog({ tables: { bookings: ["id", "name", "created_at"] }, spec: null, permsDown: true }),
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.ok(r.seen.sql.some(asksCatalog), "the inventory was never read");
  assert.ok(r.seen.sql.some(asksPerms), "recovery was never attempted, so this case is about nothing");
  assert.equal(r.status, 503, "an unverifiable recovery answered something else: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0);
  assert.notEqual(r.body.escalate, true, "an unverifiable recovery still escalates to a paid step");
  assert.notEqual(r.body.reason, "no-meta", "a live table was still called `no-meta`");
  assert.equal(r.seen.messages, 0, "a model was called against a schema known to be short a table");
  assert.deepEqual(paidActions(r.said), [], "an unverifiable recovery would still buy something");
  // THE REASON NAMES WHAT STOPPED IT, never a generic failure.
  assert.match(String(r.body.backend), /permission|recover|unread/i,
    "the refusal does not say what stopped it: " + JSON.stringify(r.body.backend));
});

test("a table inventory that cannot be read stops; it is never an empty site", async () => {
  // CANNOT-SEE-THE-CATALOG IS CANNOT-TELL. The old path could not reach this
  // state at all — it never asked — so a database whose catalog is unreadable
  // answered exactly like one with nothing in it.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: catalog({ catalogDown: true }),
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.equal(r.status, 503, "an unreadable inventory answered something else: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0);
  assert.notEqual(r.body.escalate, true, "an unreadable inventory still escalates to a paid step");
  assert.equal(r.seen.messages, 0, "a model was called against a database that could not be inspected");
  assert.deepEqual(paidActions(r.said), [], "an unreadable inventory would still buy something");
  assert.equal(r.said.shown, true, "the browser printed NOTHING for an unreadable inventory");
  // THE EXACT WORDING, and it is scoped to the edit rather than the request.
  // ⚠ SINCE 2026-09-23 THE SCOPED HALF IS THE BROWSER'S: the rung's own
  // sentence ends at its own advice, and "nothing on your site changed, and
  // this edit cost you nothing" is added on the refusal branch because the
  // reply says `unchanged` — so the same rung sentence printed beside a step
  // that shipped (this rung is reached as one step of several through the
  // `backend` lane) no longer claims the whole site stood still.
  assert.equal(r.body.unchanged, true, "the refusal does not say this rung wrote nothing");
  assert.equal(r.said.text,
    "⚠️ I couldn't read what your site's database is set up to do just now, so I've stopped rather than guess — this is on us. "
    + "Try again in a few minutes. Nothing on your site changed, and this edit cost you nothing.");
});

test("a stored spec with tables passes both gates and reaches the work", async () => {
  // THE SUCCESSFUL CONTROL, and it is what stops the two cases above from
  // being satisfied by a rung that refuses everything. A site whose `_meta`
  // declares the table the customer is asking about must get past resolution
  // AND past the schema read.
  //
  // ⚠ WHAT IS CLAIMED IS EXACTLY "REACHED THE WORK", NOT "PUBLISHED". The wire
  // fails `/v1/messages` on purpose in this file, so the model call going out
  // is the observable and the reply after it is not the subject. Saying this
  // out loud rather than letting a green case read as a published edit.
  const store = bucket(SLUG);
  const spec = { tables: [{ name: "bookings", columns: [{ name: "name", type: "text" }], read: "none", write: "anyone" }] };
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: catalog({ tables: { bookings: ["id", "name"] }, spec }),
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.ok(r.seen.sql.some(asksCatalog), "the inventory was not read even on the good path");
  assert.ok(r.seen.sql.some(asksMeta), "the stored spec was never read");
  assert.equal(r.seen.messages, 1,
    "a site whose schema declares the table did NOT reach the model call — the new gates refuse a good site: "
    + JSON.stringify({ body: r.body, sql: r.seen.sql }));
  // AND NOTHING ABOUT THIS PATH IS A BACKEND REFUSAL.
  assert.notEqual(r.body && r.body.backend, "unreadable:catalog-unreadable");
});

test("a database the catalog CONFIRMS is empty keeps its legitimate fallback, by name", async () => {
  // THE OTHER CONTROL, and it is what stops the fix from deleting the ladder:
  // a database that reads fine and genuinely holds nothing has a real answer —
  // there is nothing here to make a rule about, and the addon step is where a
  // table is made. **This is the only state in which `{tables: []}` is true**,
  // and it is now measured (the catalog answered no rows) rather than inferred
  // from a missing `_meta` row.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: catalog({ tables: {}, spec: null }),
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.ok(r.seen.sql.some(asksCatalog),
    "the empty answer was inferred rather than measured — the catalog was never asked");
  assert.equal(r.body.escalate, true, "an empty database stopped escalating, which deletes the ladder");
  assert.equal(r.body.reason, "no-meta");
  assert.equal(r.body.layer, "addon", "the escalate does not name the step that can make a table");
  assert.deepEqual(r.said.actions, ["post a PAID request to the addon route"],
    "an empty database no longer reaches the addon step: " + JSON.stringify(r.said.actions));
  assert.ok(!r.said.actions.some((a) => /rewrite/i.test(a)),
    "an empty database still starts a full-site rewrite: " + JSON.stringify(r.said.actions));
});

test("a derived database that will not answer is unreadable, never an empty site", async () => {
  // The `incomplete` shape — a project row and no recorded name — with the
  // probe FAILING. `siteBackendDetail` resolves the name, builds a connection
  // and proves it; this is the proof failing, which must not read as "no
  // database" and must not design against an empty schema.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: "down",
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.equal(r.status, 503, "a dead database answered something other than 503: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0);
  assert.notEqual(r.body.escalate, true, "a dead database escalates to a rewrite that cannot fix it");
  assert.equal(r.seen.messages, 0, "a model was called for a site whose database could not be proved");
  assert.deepEqual(paidActions(r.said), [], "a dead database would still buy something");
  // ⚠ AND THE REASON IS THE RESOLUTION'S OWN, not the schema read's.
  //
  // A SWEEP IS WHAT MADE THIS ASSERTION WORTH HAVING. Cutting the resolution
  // gate SURVIVED an earlier, weaker version of this case (`typeof backend ===
  // "string"`), because an unresolved backend hands `null` to `readSiteSchema`,
  // the query throws, and the NEXT gate refuses with the same status and the
  // same cost. That second wall is a real and deliberate defence — but it
  // names the wrong link, and "Supabase could not be reached" against "your
  // `_meta` is unreadable" are different things to go and fix. So the guard
  // is on the REASON, which is the one thing the two walls do not share.
  assert.equal(r.body.backend, "derived-database-unreachable",
    "the refusal no longer names the resolution as what failed — a later gate is answering for it: "
    + JSON.stringify(r.body.backend));
});

// ── 3. A SITE THAT REALLY HAS NO DATABASE KEEPS ITS LEGITIMATE FALLBACK ─────

test("a site with genuinely no database escalates to the step that can make one", async () => {
  // `none` — no recorded name AND no project row — is the one state in which
  // this site truly has no database. The addon step's first backend kind
  // PROVISIONS one, so escalating there is real work a broader writer can do.
  const store = bucket(SLUG);
  const r = await withWire({ backends: [{ uid: USER.id, brief: "", neon_db: "" }], project: [] },
    (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  assert.equal(r.body.escalate, true, "a site with no database stopped escalating, which deletes the ladder");
  assert.equal(r.body.cost, 0);
  assert.equal(r.seen.messages, 0, "a model was called before the rung knew whether a database existed");
  // ⚠ THE LAYER IS NAMED, AND THAT IS THE WHOLE FIX. `escalateAction` reads
  // `e.layer`; with none on the reply it falls to `up` — the ~25-credit
  // rewrite of every page, which cannot provision a database either.
  assert.equal(r.body.layer, "addon", "the escalate does not name the step that can make a database");
  assert.deepEqual(r.said.actions, ["post a PAID request to the addon route"],
    "a site with no database no longer reaches the addon step: " + JSON.stringify(r.said.actions));
  assert.ok(!r.said.actions.some((a) => /rewrite/i.test(a)),
    "a missing database still starts a full-site rewrite: " + JSON.stringify(r.said.actions));
});

test("the run-12 shape — a real database with a missing reference — is not a rewrite", async () => {
  // ⚠ THE REPRODUCTION. `fretwork-1`: a `site_project` row, a blank
  // `neon_db`, and a database that answers. Before the fix this was
  // `escalate("no-backend")` with no layer, which the browser turns into the
  // ~25-credit rewrite of every page — for a missing REFERENCE a rewrite
  // cannot repair.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
  // The rung gets PAST resolution now: the database was found and proved, so
  // whatever it answers next, it is not the no-backend escalate.
  assert.notEqual(r.body && r.body.reason, "no-backend",
    "a site whose database is real and reachable still answers no-backend");
  assert.ok(!r.said.actions.some((a) => /rewrite/i.test(a)),
    "the run-12 shape still starts a full-site rewrite: " + JSON.stringify(r.said.actions));
  // THE PROBE REALLY RAN — the observer alive, so "it got past" is a reading
  // rather than the resolver having skipped the check.
  assert.ok(r.seen.sql.length >= 1, "the derived database was never proved before being used");
  // AND THE REFERENCE IS RECORDED ON THE WAY PAST, from a database known good.
  assert.ok(r.seen.patches.length >= 1, "the missing reference was not repaired once the database was proved");
});

// ── 5. THE CHARGING SENTENCE IS SCOPED TO THIS EDIT ─────────────────────────
//
// Owner, 2026-09-21: *"The new database-error replies say 'you haven't been
// charged,' but routing was billed separately. A zero edit cost does not
// establish a zero-cost request."* MEASURED on run 12: `cost: 0` on the
// terminal body and the balance moved 79 → 77 — two credits for the routing
// call, which is a separate POST this route never sees. No refund is claimed
// either, because none happened: there was nothing to reverse.

test("no refusal this round added claims the whole request was free", () => {
  // A SOURCE CENSUS, because the property is about every sentence these two
  // places can produce, and driving them one at a time asserts only the ones
  // somebody remembered to drive.
  //
  // ⚠ COMMENTS BLANKED FIRST. The note explaining this correction QUOTES the
  // forbidden phrase — prose containing the thing it forbids, which is this
  // repo's most repeated own-goal and would fail this case against itself.
  const blank = (s) => s.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");

  // ⚠ WINDOWED TO THE FUNCTION, NOT THE FILE. A first draft read every long
  // string in `site-owner.mjs` and went red on a member-access sentence forty
  // lines away — an observer so wide it reports about code this case is not
  // about. Landmark to landmark, on CODE, both ends asserted.
  const osrc = readFileSync(new URL("../site-owner.mjs", import.meta.url), "utf8");
  const oAt = osrc.indexOf("export function editGateRefusal(");
  const oEnd = osrc.indexOf("async function openSite(", oAt);
  assert.ok(oAt > 0, "`editGateRefusal` is gone — the edit boundary no longer re-shapes anything");
  assert.ok(oEnd > oAt, "the closing landmark is gone or moved above the opening one");
  const owner = blank(osrc.slice(oAt, oEnd));
  const wsrc = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // The rules rung's own window, landmark to landmark on CODE, with both ends
  // asserted — a missing landmark gives `slice(-1, -1)` and passes everything.
  const at = wsrc.indexOf("const rBack = await siteBackendDetail(env, ownerSlug);");
  const end = wsrc.indexOf("let rCost = 0, rBilled = false;", at);
  assert.ok(at > 0, "the rules rung's opening landmark is gone — this scan is over nothing");
  assert.ok(end > at, "the rules rung's closing landmark is gone or moved above the opening one");
  const rung = blank(wsrc.slice(at, end));

  // THE OBSERVER PROVED ALIVE before any absence is believed: both regions
  // really do carry customer sentences. `editGateRefusal` writes its three as
  // ternary arms rather than under a `msg:` key, so both spellings are read.
  const msgs = [...owner.matchAll(/msg:\s*"([^"]+)"/g), ...rung.matchAll(/msg:\s*"([^"]+)"/g)].map((m) => m[1])
    .concat([...owner.matchAll(/[?:]\s*"([^"]{60,})"/g)].map((m) => m[1]));
  assert.ok(msgs.length >= 5, "found only " + msgs.length + " sentences, so the absence below means nothing");

  for (const s of msgs) {
    // ⚠ BOTH APOSTROPHES. The source writes a typographic one in places and a
    // search for the ASCII form alone answers zero on text carrying the claim.
    assert.ok(!/have?n.t been charged/i.test(s),
      "a refusal still claims the whole request was free, and the routing call was billed: " + JSON.stringify(s));
  }
  // ⚠ AND WHO SAYS WHAT IT COST SPLIT ON 2026-09-23, AND MOVED WHOLLY TO THE
  // READER ON 2026-09-25. The ownership gate's sentences used to say "this
  // edit cost you nothing" themselves, and the browser's whole-request note
  // said it again beside them once the note stated every refusal's money. So
  // the gate now says what happened and nothing about money, and its body
  // carries `unchanged: true` and `cost: 0` — from which the browser says both
  // — which is the rules rung's shape one boundary over. Both halves are
  // asserted: a sentence that states money states it twice on the screen, and
  // a body without the two fields is a refusal that tells nobody what it cost.
  const ownerMsgs = [...owner.matchAll(/[?:]\s*"([^"]{60,})"/g)].map((m) => m[1]);
  assert.ok(ownerMsgs.length >= 3, "found only " + ownerMsgs.length + " gate sentences — this scan is over nothing");
  for (const s of ownerMsgs) {
    assert.doesNotMatch(s, /charg|refund|cost/i, "a gate refusal states money the browser states as well: " + JSON.stringify(s));
  }
  // `assertOwner`'s own shape: `{error: {status, body}}`.
  for (const [status, body] of [
    [503, { error: "couldn't check that site just now — try again in a moment" }],
    [404, { error: "no such site" }],
    [401, { error: "sign in" }],
    [500, { error: "anything else" }],
  ]) {
    const out = editGateRefusal({ error: { status, body } });
    assert.equal(out.status, status, "the gate's own status was not carried");
    assert.equal(out.body.error, body.error, "the gate's own sentence was not carried");
    assert.equal(out.body.unchanged, true, "a gate refusal no longer lets the browser say nothing changed: " + JSON.stringify(out.body));
    assert.equal(out.body.cost, 0, "a gate refusal no longer lets the browser say what it cost: " + JSON.stringify(out.body));
  }
  const rungMsgs = [...rung.matchAll(/msg:\s*"([^"]+)"/g)];
  assert.ok(rungMsgs.length >= 2, "found only " + rungMsgs.length + " rung sentences — this scan is over nothing");
  for (const m of rungMsgs) {
    // THE ANSWER THIS SENTENCE BELONGS TO: back to its own opening, forward
    // to the sentence. `unchanged: true` has to be in THAT object.
    const open = Math.max(rung.lastIndexOf("eAnswer({", m.index), rung.lastIndexOf("Response.json({", m.index));
    assert.ok(open > 0, "a rung sentence sits in no answer this scan can find: " + JSON.stringify(m[1]));
    assert.ok(/unchanged:\s*true/.test(rung.slice(open, m.index)) || /this edit cost you nothing/i.test(m[1]),
      "a rung refusal neither says what it cost nor lets the browser say it: " + JSON.stringify(m[1]));
  }
});

test("nothing in this rung provisions a database", () => {
  // The owner's own bound: resolve and verify, never create. A rung that
  // provisioned would turn a reporting bug into a second empty database
  // beside a real one — run 47's shape, one path over.
  const src = readRulesBranch();
  for (const forbidden of ["ensureSiteBackend", "createSiteDatabase", "createSiteProject"]) {
    assert.ok(!src.includes(forbidden), "the rules rung now provisions: " + forbidden);
  }
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
