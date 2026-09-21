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
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible sentence for an edit body rather than throwing, so a guard pinned
// to it passes whatever the edit screen really says.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

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
      seen.sql.push(url);
      // `sql` is a MODE or a function of which call this is, because the
      // schema-read case needs the probe to SUCCEED and the read after it to
      // fail — one answer for every query cannot express that pair, and the
      // pair is the whole discriminator.
      const mode = typeof sql === "function" ? sql() : sql;
      if (mode === "down") return new Response("could not connect", { status: 500 });
      const rows = mode === "empty" ? [] : [[1]];
      return new Response(JSON.stringify({
        command: "SELECT", rowCount: rows.length, rows,
        fields: [{ name: "?column?", dataTypeID: 23, tableID: 0, columnID: 0, dataTypeSize: 4, dataTypeModifier: -1, format: "text" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
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

  // ⚠⚠ AND HERE IS AN OPEN FINDING THIS FILE RECORDS RATHER THAN FIXES.
  //
  // The SERVER is right — 503, no model, no query, no charge, nothing
  // published — and the BROWSER still falls through to the ~25-credit rewrite,
  // because this body carries only `{error}`: no `ok`, no `msg`, so
  // `editAnswer` reaches its catch-all and calls `fallback()`. Same class as
  // the two defects this round fixes, one layer up.
  //
  // NOT FIXED HERE ON PURPOSE. The sentence comes from `assertOwner` in
  // `site-owner.mjs`, ONE gate shared by a dozen owner routes (measured:
  // `grep -c "assertOwner(" worker.js`), so changing its body shape is a
  // change to every one of them — a reporting redesign, which this round is
  // explicitly not. It is the owner's call.
  //
  // ASSERTED AS IT IS, so the day it changes this case says so rather than
  // going quiet. A test that simply omitted it would leave the finding
  // undiscoverable.
  assert.deepEqual(r.said.actions, ["start the FULL ~25-credit rewrite (the browser's `fallback`)"],
    "the shared ownership refusal's browser behaviour changed — re-read this note and decide whether the finding is closed: "
    + JSON.stringify(r.said.actions));
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
  assert.equal(r.body.backend, "schema-unreadable", "the refusal does not name which read failed");
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

test("a database with no tables keeps its legitimate fallback, by name", async () => {
  // THE CONTROL FOR THE CASE ABOVE, and it is what stops the fix from simply
  // deleting the ladder: a database that reads fine and holds nothing has a
  // real answer — there is nothing here to make a rule about, and the addon
  // step is where a table is made.
  const store = bucket(SLUG);
  const r = await withWire({
    backends: [{ uid: USER.id, brief: "", neon_db: "site_ravenscroft_rules" }],
    project: [{ uid: USER.id, neon_conn: "postgres://u:p@host.neon.tech/neondb" }],
    sql: "empty",
  }, (seen) => rulesEdit("only twenty places on a booking", { store }).then((x) => ({ ...x, seen })));
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
