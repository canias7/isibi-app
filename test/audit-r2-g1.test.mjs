// AUDIT ROUND 2, GROUP 1 (2026-10-23): A14-6, A36-2, A36-3, A36-4, A36-5, S5-3.
// Each case is fed by its real producer where there is one: the held draft a
// row step answers with (`heldDraft` in worker.js), the schema state
// `readSchemaState` returns, the router's window (`routerHistory`) and a
// request record from `newRequest` and `planParts`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editPublishFacts, editStepFacts, editAppliedFacts, addonSchemaFacts, startFacts } from "../builder/site-progress.mjs";
import { converseTables, siteContextBlock, routerHistory } from "../builder/site-converse.mjs";
import { readSchemaState, RECOVER_QUERIES } from "../site-schema-recover.mjs";
import { askRequest, ASK_MAX_TOKENS, RESOLVED_TOKENS } from "../builder/site-ask.mjs";
import { echoTokens } from "../builder/input-budget.mjs";
import { newRequest, planParts, jobBody, requestMaking } from "../builder/request.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const said = (facts) => facts.map((f) => f.text || f.line || JSON.stringify(f)).join("\n");

// ── A14-6 ───────────────────────────────────────────────────────────────────
const HELD = { published: false, held: true, revision: 4, said: "x" }; // worker.js heldDraft's shape
const dataStep = { layer: "data", page: "/prices" };

test("A14-6 a held row change is said as held in the draft, never as changed in the database; a live one still is", () => {
  const held = [{ step: dataStep, body: { ok: true, draft: HELD }, failed: false }];
  const live = [{ step: dataStep, body: { ok: true }, failed: false }];
  for (const f of [editPublishFacts(held, { draft: true }), editStepFacts(held[0], 0, 2), editAppliedFacts(held)]) {
    const t = said(f);
    assert.doesNotMatch(t, /Changed in the site's database/, "a held change told as made: " + t);
    assert.match(t, /Held in their draft/);
  }
  assert.match(said(editPublishFacts(live)), /Changed in the site's database/, "control: a live change lost its fact");
  assert.equal(editPublishFacts(held).find((f) => /Held/.test(said([f]))).state, "prepared");
});

test("A14-6 an add-on's held schema is said as held, and its publish as a draft save; the plan ends at the draft", () => {
  const h = said(addonSchemaFacts({ tables: ["bookings"], jobs: ["weekly"] }, { publishing: true, held: true, draft: true }));
  assert.doesNotMatch(h, /Created in the site's database|Publishing the site/);
  assert.match(h, /Held in their draft/);
  assert.match(h, /Saving the additions to their draft/);
  assert.doesNotMatch(h, /Set to run on a timer/);
  // A SITE NOT LIVE YET: the schema is made, the timers are still held (`backendWriter`).
  const n = said(addonSchemaFacts({ tables: ["bookings"], jobs: ["weekly"] }, { heldJobs: true }));
  assert.match(n, /Created in the site's database/);
  assert.match(n, /Held in their draft until they press Publish, to be set to run on a timer/);
  assert.match(said(addonSchemaFacts({ tables: ["bookings"] }, { publishing: true })), /Created in the site's database: the table .bookings.[\s\S]*Publishing the site/, "control");
  for (const op of ["edit", "addon", "build"]) {
    assert.doesNotMatch(said(startFacts({ op, draft: true })), /and it is published|built and published/, op);
    assert.match(said(startFacts({ op, draft: true })), /saved (to|as) their draft/, op); // the plan ends at the draft; the Publish clause is said once, by the save (progress-voice-2)
    assert.match(said(startFacts({ op })), /published/, op + " control");
  }
  // WIRED: every start and the add-on's schema milestone are handed the switch.
  assert.equal((W.match(/startFacts\(\{[^}]*draft: draftFirst\(env\)/g) || []).length, 4, "a start milestone is not told about draft-first");
  assert.match(W, /addonSchemaFacts\([^;]*held: aWriter\.holding, heldJobs: aWriter\.on, draft: aWriter\.on/);
});

// ── A36-2 ───────────────────────────────────────────────────────────────────
const sqlFor = (cols, meta) => async (q) => {
  if (q === RECOVER_QUERIES.columns) return cols;
  if (meta === null) throw new Error('relation "_meta" does not exist');
  return [{ v: JSON.stringify(meta) }];
};
const COLS = [{ t: "bookings", c: "id" }, { t: "bookings", c: "when" }, { t: "loaves", c: "id" }, { t: "loaves", c: "name" }];

test("A36-2 a database with tables but no stored spec is told its tables, not 'no database tables'", async () => {
  const st = await readSchemaState({ sql: sqlFor(COLS, null) });
  assert.equal(st.state, "tables-without-metadata");
  const tables = converseTables(st, () => "x");
  assert.deepEqual(tables.map((t) => t.name), ["bookings", "loaves"]);
  assert.deepEqual(tables[0].columns, ["id", "when"]);
  assert.equal(tables[0].who, "access not recorded");
  const block = siteContextBlock({ exists: true, name: "N", tables });
  assert.doesNotMatch(block, /It has no database tables/);
  assert.match(block, /- bookings \(id, when\) — access not recorded/);
});

test("A36-2 a stored spec missing a live table: the declared one with its access, the missing one added; the honest empty stays empty", async () => {
  const st = await readSchemaState({ sql: sqlFor(COLS, { tables: [{ name: "loaves", columns: [{ name: "id" }, { name: "name" }] }] }) });
  assert.equal(st.state, "stored");
  const tables = converseTables(st, (t) => "public read (" + t.name + ")");
  assert.deepEqual(tables.map((t) => [t.name, t.who]), [["loaves", "access: public read (loaves)"], ["bookings", "access not recorded"]]);
  const empty = await readSchemaState({ sql: sqlFor([], null) });
  assert.deepEqual(converseTables(empty), []);
  assert.equal(converseTables({ ok: false, state: "unreadable" }), null, "cannot-tell read as a value");
  // A NAME THAT IS NOT AN IDENTIFIER NEVER REACHES THE PROMPT.
  const odd = await readSchemaState({ sql: sqlFor([{ t: "x; drop", c: "id" }, { t: "ok_t", c: "bad col" }], null) });
  assert.deepEqual(converseTables(odd), [{ name: "ok_t", columns: [], who: "access not recorded" }]);
  // WIRED: the conversation's reader uses it.
  const at = W.indexOf("async function readConverseContext(");
  const body = W.slice(at, W.indexOf("\n}\n", at));
  assert.ok(at > 0);
  assert.match(body, /converseTables\(spec, accessLabel\)/);
});

// ── A36-4 ───────────────────────────────────────────────────────────────────
test("A36-4 under draft-first the conversation is told changes go to a draft and are live only after Publish", () => {
  const on = siteContextBlock({ exists: true, name: "N", url: "https://n.gofarther.app", draftFirst: true });
  assert.match(on, /saved to a draft first and goes live only when they press Publish/);
  assert.match(on, /never say a change is live unless they have published it/);
  assert.doesNotMatch(siteContextBlock({ exists: true, name: "N", url: "https://n.gofarther.app" }), /draft/i, "control: off says nothing of a draft");
  const at = W.indexOf("async function readConverseContext(");
  assert.match(W.slice(at, W.indexOf("\n}\n", at)), /draftFirst: draftFirst\(env\)/);
});

// ── A36-3 ───────────────────────────────────────────────────────────────────
test("A36-3 a go-ahead on a long plan has room to restate it and copy its held parts", () => {
  const plan = Array.from({ length: 6 }, (_, i) => (i + 1) + ". " + "Improve the section with clearer words and a better photograph ".repeat(8)).join("\n").slice(0, 3200);
  const history = routerHistory([{ role: "user", text: "what should I improve first?" }, { role: "assistant", text: plan }]);
  assert.ok(history.turns.some((t) => t.text.length > 2500), "the router's window cut the plan before the test");
  const req = askRequest({ message: "go ahead with all of it", site: {}, hasSite: true, live: true, history });
  const need = ASK_MAX_TOKENS + echoTokens("go ahead with all of it") + RESOLVED_TOKENS + 2 * echoTokens(...history.turns.map((t) => t.text));
  assert.ok(req.max_tokens >= need, "the ceiling " + req.max_tokens + " leaves no room to restate a " + plan.length + "-character plan (" + need + ")");
  assert.equal(askRequest({ message: "hi", site: {} }).max_tokens, ASK_MAX_TOKENS, "control: no conversation, no growth");
});

// ── A36-5 ───────────────────────────────────────────────────────────────────
test("A36-5 a part's routing job keeps the table names known at acceptance as the route's fallback", () => {
  const MSG = "Change the headline, and add a gallery page";
  const rec = newRequest({ key: "k".repeat(16), uid: "u1", slug: "fold-lane", message: MSG, digest: { name: "N", pages: ["/"], tables: ["loaves"] }, parts: planParts(MSG, { intent: "edit", alsoAsked: ["add a gallery page"] }).parts });
  const b = jobBody(rec, rec.parts.length - 1, "route", "k".repeat(16) + "-p1-1");
  assert.deepEqual(b.body.site.tables, ["loaves"]);
  // AND THE ROUTE STILL REPLACES THEM WHENEVER ITS READ ANSWERS.
  assert.match(W, /const filled = Array\.isArray\(names\) \? names : null;\s*if \(filled\) out = \{ \.\.\.out, tables: filled \};/);
});

// ── S5-3 ────────────────────────────────────────────────────────────────────
test("S5-3 a request with a part being prepared counts as still making a change; one waiting on the owner or ended does not", () => {
  const now = 1_000_000;
  const part = (status, prep) => ({ status, ...(prep ? { prep } : {}) });
  assert.equal(requestMaking({ ended: false, parts: [part("done"), part("ready")] }, now), true);
  assert.equal(requestMaking({ ended: false, parts: [part("done"), part("queued")] }, now), true);
  assert.equal(requestMaking({ ended: false, parts: [part("done"), part("waiting")] }, now), false);
  // A BLOCKED PART WHOSE PREPARATION IS RUNNING has no job row and is being made.
  const prep = (at) => ({ ...part("blocked", { for: 1, phase: 0, state: "running", startedAt: at }), seq: 1, phase: 0 });
  assert.equal(requestMaking({ ended: false, parts: [part("waiting"), prep(now - 1000)] }, now), true);
  assert.equal(requestMaking({ ended: false, parts: [part("waiting"), prep(now - 60 * 60 * 1000)] }, now), false, "a stale preparation counted");
  assert.equal(requestMaking({ ended: true, parts: [part("done")] }, now), false);
  assert.equal(requestMaking(null), false);
  // WIRED: the draft read counts them beside the job rows.
  assert.match(W, /const running = \(\(await runningForSite\(env, ou\.id, ownerSlug\)\) \|\| 0\) \+ \(await requestsMakingFor\(env, ou\.id, ownerSlug\)\);/);
  const at = W.indexOf("async function requestsMakingFor(");
  const body = W.slice(at, W.indexOf("\n}\n", at));
  assert.ok(at > 0);
  assert.match(body, /found\.rec\.uid === uid && requestMaking\(found\.rec\)/, "another owner's request is counted");
  assert.match(body, /mark\.endedAt != null\) continue/);
});
