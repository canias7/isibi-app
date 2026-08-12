import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  handleInbound, authorize, functionFor, secretNames, sameSecret,
  normalizeSignature, hmacHex, PREFIX, MAX_BODY, MAX_PER_MINUTE,
} from "../site-inbound.mjs";

const SECRET = "whsec_a_real_shared_secret";
const BODY = JSON.stringify({ event: "stock.updated", sku: "AB-1", qty: 4 });

const H = (o = {}) => new Headers(o);

/** A schema with one hook and one ordinary internal function beside it. */
const SPEC = {
  functions: [
    { name: "hook_stock", internal: true, args: [{ name: "payload", type: "jsonb" }], returns: "jsonb" },
    // The one that must NOT be reachable here: internal, and it hands back a
    // customer's details given a row id.
    { name: "confirm_booking", internal: true, args: [{ name: "id", type: "int" }], returns: "jsonb" },
    { name: "public_thing", internal: false, args: [{ name: "payload", type: "jsonb" }], returns: "jsonb" },
  ],
};

function deps(over = {}) {
  const calls = [];
  const d = {
    loadSchema: async () => SPEC,
    loadSecrets: async () => ({ HOOK_SECRET_STOCK: SECRET }),
    callFn: async (name, payload) => { calls.push({ name, payload }); return { received: true }; },
    throttle: async () => ({ ok: true }),
    log: () => {},
    ...over,
  };
  d.calls = calls;
  return d;
}
const call = (d, over = {}) => handleInbound(d, {
  slug: "barber", name: "stock", headers: H({ authorization: "Bearer " + SECRET }), body: BODY, ip: "1.2.3.4", ...over,
});

// ------------------------------------------------------------- the happy path

test("a signed delivery reaches the site's own function", async () => {
  const d = deps();
  const r = await call(d);
  assert.equal(r.status, 200);
  assert.equal(d.calls.length, 1);
  assert.equal(d.calls[0].name, "hook_stock");
  // The PARSED payload, so a plpgsql body gets jsonb and not a string.
  assert.deepEqual(d.calls[0].payload, { event: "stock.updated", sku: "AB-1", qty: 4 });
  assert.deepEqual(r.body, { received: true });
});

test("a function returning nothing still acknowledges", async () => {
  // Some senders read an empty body as a failed delivery and retry forever.
  for (const out of [null, undefined]) {
    const r = await call(deps({ callFn: async () => out }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
  }
});

// ------------------------------------------------------------- who may deliver

test("no secret stored means the hook does not exist", async () => {
  // FAILS CLOSED, and answers the same as an undeclared hook: a distinct
  // "exists but unauthorized" tells a stranger which integrations a business
  // runs.
  const d = deps({ loadSecrets: async () => ({}) });
  const r = await call(d);
  assert.equal(r.status, 404);
  assert.equal(d.calls.length, 0, "nothing is called");
});

test("a wrong secret is refused", async () => {
  const d = deps();
  const r = await call(d, { headers: H({ authorization: "Bearer nope" }) });
  assert.equal(r.status, 401);
  assert.equal(d.calls.length, 0);
});

test("no proof at all is refused", async () => {
  const d = deps();
  assert.equal((await call(d, { headers: H() })).status, 401);
  assert.equal(d.calls.length, 0);
});

test("the secret is accepted from the headers senders actually use", async () => {
  for (const h of [
    { authorization: "Bearer " + SECRET },
    { authorization: SECRET },              // bare, no scheme
    { "x-webhook-secret": SECRET },
    { "x-api-key": SECRET },
    { "x-webhook-token": SECRET },
  ]) {
    const r = await call(deps(), { headers: H(h) });
    assert.equal(r.status, 200, JSON.stringify(h));
  }
});

test("an HMAC of the raw body is accepted, in every spelling providers use", async () => {
  const hex = await hmacHex(SECRET, BODY);
  const b64 = Buffer.from(hex, "hex").toString("base64");
  for (const h of [
    { "x-signature": hex },
    { "x-hub-signature-256": "sha256=" + hex },     // GitHub
    { "x-shopify-hmac-sha256": b64 },               // Shopify
    { "x-signature-256": hex.toUpperCase() },
    { "x-webhook-signature": hex },
  ]) {
    const r = await call(deps(), { headers: H(h) });
    assert.equal(r.status, 200, JSON.stringify(h));
  }
});

test("a signature over DIFFERENT bytes is refused", async () => {
  // The whole value of an HMAC over a shared secret: it proves the body was not
  // altered in flight.
  const hex = await hmacHex(SECRET, JSON.stringify({ event: "stock.updated", sku: "AB-1", qty: 4000 }));
  const r = await call(deps(), { headers: H({ "x-signature": hex }) });
  assert.equal(r.status, 401);
});

test("the signature is checked against the RAW body, not a re-serialised one", async () => {
  // Key order and whitespace change the bytes, so a re-serialise here would
  // fail every real signature while passing every hand-built test payload.
  const raw = '{ "qty":4,\n  "sku": "AB-1" }';
  const hex = await hmacHex(SECRET, raw);
  const r = await call(deps(), { headers: H({ "x-signature": hex }), body: raw });
  assert.equal(r.status, 200);
});

test("the comparison cannot be short-circuited by length", () => {
  assert.equal(sameSecret("abcd", "abcd"), true);
  assert.equal(sameSecret("abcd", "abce"), false);
  assert.equal(sameSecret("abcd", "abcde"), false);
  assert.equal(sameSecret("abcd", "abc"), false);
  // An empty stored secret must never match an empty header — that is the
  // unconfigured site accepting everybody.
  assert.equal(sameSecret("", ""), false);
  assert.equal(sameSecret(null, undefined), false);
});

test("the comparison is constant-time, which no behavioural test can see", () => {
  // MUTATION-DRIVEN. Replacing the accumulator loop with `x === y` — and
  // replacing it with a loop that returns on the first differing byte — both
  // survived the entire suite, because the property under test is HOW LONG the
  // answer takes and every assertion above only reads the answer. An attacker
  // who can measure that learns the secret one character at a time.
  //
  // So it is asserted on the source. That is weaker than a behavioural test and
  // it is the strongest thing available here.
  const src = fs.readFileSync(new URL("../site-inbound.mjs", import.meta.url), "utf8");
  const i = src.indexOf("export function sameSecret");
  assert.ok(i > 0, "the function exists");
  const body = src.slice(i, src.indexOf("\n}", i));
  const loop = body.indexOf("for (");
  assert.ok(loop > 0, "it loops rather than comparing whole strings");
  const inLoop = body.slice(loop);
  // The only `return` after the loop starts is the one reading the accumulator.
  const returns = inLoop.match(/\breturn\b/g) || [];
  assert.equal(returns.length, 1, "no early exit inside the comparison");
  assert.ok(/return diff === 0/.test(inLoop), "and it answers from the accumulator");
  // `===` on the secrets themselves would short-circuit in the engine.
  assert.ok(!/return x === y/.test(body), "never a whole-string equality");
});

test("normalizeSignature refuses anything that is not a 32-byte digest", () => {
  assert.equal(normalizeSignature("").length, 0);
  assert.equal(normalizeSignature("hello").length, 0);
  assert.equal(normalizeSignature("a".repeat(63)).length, 0, "too short");
  assert.equal(normalizeSignature("a".repeat(65)).length, 0, "too long");
  assert.equal(normalizeSignature("z".repeat(64)).length, 0, "not hex");
  assert.equal(normalizeSignature("A".repeat(64)), "a".repeat(64), "case folded");
  assert.equal(normalizeSignature("sha256=" + "A".repeat(64)), "a".repeat(64));
});

// ------------------------------------------------------- what may be reached

test("the hook_ prefix keeps other internal functions out of reach", async () => {
  // WITH THE SECRET IN HAND. This is the assertion that matters: knowing the
  // shared secret must not become a way to read every customer's confirmation
  // by counting row ids.
  const d = deps();
  const r = await handleInbound(d, {
    slug: "barber", name: "booking", headers: H({ authorization: "Bearer " + SECRET }), body: BODY, ip: "",
  });
  assert.equal(r.status, 404);
  assert.equal(d.calls.length, 0);
  // And the same function IS unreachable under its own name too.
  assert.equal(functionFor(SPEC, "confirm_booking"), null);
});

test("functionFor demands all four properties", () => {
  assert.ok(functionFor(SPEC, "stock"), "the declared hook resolves");
  assert.equal(functionFor(SPEC, "nope"), null, "undeclared");
  assert.equal(functionFor({ functions: [] }, "stock"), null, "no functions at all");
  assert.equal(functionFor(null, "stock"), null, "no schema");
  const one = (over) => functionFor({ functions: [{ name: "hook_x", internal: true, args: [{ name: "p", type: "jsonb" }], ...over }] }, "x");
  assert.ok(one({}), "the control resolves, or every case below passes vacuously");
  assert.equal(one({ internal: false }), null, "a public function gains no second door");
  assert.equal(one({ args: [] }), null, "the payload must have somewhere to go");
  assert.equal(one({ args: [{ name: "p", type: "text" }] }), null, "and it must be jsonb");
  assert.equal(one({ args: [{ name: "p", type: "jsonb" }, { name: "q", type: "text" }] }), null, "exactly one");
});

test("the name cannot carry anything into SQL", () => {
  for (const bad of ["a; drop table x", "a b", "A".repeat(60), "1abc", "", null, "x'y", "../etc"]) {
    assert.equal(functionFor(SPEC, bad), null, JSON.stringify(bad));
  }
});

test("PREFIX is what the whole boundary rests on", () => {
  assert.equal(PREFIX, "hook_");
  assert.equal(functionFor(SPEC, "stock").name, "hook_stock");
});

// ------------------------------------------------------------------ the edges

test("an oversized body is refused before anything is looked up", async () => {
  const d = deps();
  const r = await call(d, { body: "x".repeat(MAX_BODY + 1) });
  assert.equal(r.status, 413);
  assert.equal(d.calls.length, 0);
});

test("the rate limit runs before any query", async () => {
  let looked = 0;
  const d = deps({
    throttle: async () => ({ ok: false, retryAfter: 30 }),
    loadSchema: async () => { looked++; return SPEC; },
    loadSecrets: async () => { looked++; return {}; },
  });
  const r = await call(d);
  assert.equal(r.status, 429);
  assert.equal(looked, 0, "a refused caller costs no database work");
  assert.equal(r.retryAfter, 30);
});

test("a body that is not json is the CALLER's fault", async () => {
  const d = deps();
  const r = await call(d, { body: "not json at all" });
  assert.equal(r.status, 400);
  assert.equal(d.calls.length, 0);
});

test("an array or a scalar payload is passed through, not second-guessed", async () => {
  for (const raw of ["[1,2,3]", '"hello"', "4", "null"]) {
    const d = deps();
    const r = await call(d, { body: raw });
    assert.equal(r.status, 200, raw);
    assert.equal(d.calls.length, 1, raw);
  }
});

test("a failing function answers 5xx so the sender retries", async () => {
  // A 4xx tells almost every webhook sender to give up permanently, so a
  // transient database failure answered 4xx loses the delivery forever.
  const d = deps({ callFn: async () => { throw new Error('relation "orders" does not exist'); } });
  const r = await call(d);
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(r.body).includes("orders"), "a Postgres error quotes the statement");
});

test("secretNames prefers the hook's own, and falls back to a shared one", () => {
  assert.deepEqual(secretNames("stock"), ["HOOK_SECRET_STOCK", "HOOK_SECRET"]);
  assert.deepEqual(secretNames("order-sync"), ["HOOK_SECRET_ORDER_SYNC", "HOOK_SECRET"]);
  assert.deepEqual(secretNames(""), ["HOOK_SECRET"]);
});

test("the shared fallback works, and the specific one WINS", async () => {
  const shared = "shared_secret_value_here";
  // Fallback alone.
  assert.equal((await call(deps({ loadSecrets: async () => ({ HOOK_SECRET: shared }) }),
    { headers: H({ authorization: "Bearer " + shared }) })).status, 200);
  // Both present: the per-hook one is the one that counts, so rotating a
  // supplier's secret really does lock that supplier out.
  const both = deps({ loadSecrets: async () => ({ HOOK_SECRET_STOCK: SECRET, HOOK_SECRET: shared }) });
  assert.equal((await call(both, { headers: H({ authorization: "Bearer " + SECRET }) })).status, 200);
  assert.equal((await call(both, { headers: H({ authorization: "Bearer " + shared }) })).status, 401);
});

test("authorize refuses when there is no stored secret, whatever is presented", async () => {
  const r = await authorize({ secret: "", headers: H({ authorization: "Bearer anything" }), body: BODY });
  assert.equal(r.ok, false);
});

// ------------------------------------------------------------------- wiring

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const has = (re, why) => assert.ok(re.test(worker), why);

test("the route exists, is matched strictly and is POST only", () => {
  has(/handleInbound\(inboundDeps\(/, "the decision module is called with the real side effects");
  has(/\/api\\\/db\\\/\(\[a-z0-9\]\[a-z0-9-\]\{0,80\}\)\\\/hook\\\//, "the slug and name are matched, not split off a path");
  const i = worker.indexOf('url.pathname.includes("/hook/")');
  assert.ok(i > 0, "the dispatch exists");
  assert.ok(/method !== "POST"/.test(worker.slice(i, i + 900)), "POST only");
});

test("the function is called on the OWNER connection, never granted out", () => {
  // A hook function is `internal`, so it has no EXECUTE grant — which is the
  // whole reason it cannot be reached through the Data API instead.
  const i = worker.indexOf("function inboundDeps(");
  assert.ok(i > 0, "the deps factory exists");
  const fn = worker.slice(i, i + 2200);
  assert.ok(/sqlQuery\(db,/.test(fn), "it runs SQL on the site's own connection");
  assert.ok(/sqlIdent\(name\)/.test(fn), "and quotes the name it was given");
  // The payload is BOUND, not interpolated: it is a stranger's JSON.
  assert.ok(/\(\?::jsonb\)/.test(fn), "the payload is a bound parameter");
});

test("the DESIGNER can declare one, or nothing ever reaches this route", () => {
  // The failure this repo has hit at five separate layers on one feature: the
  // route is correct, the module is correct, and no schema can ever produce a
  // function it will accept because the tool never mentioned the convention.
  const i = worker.indexOf("      functions: {");
  assert.ok(i > 0, "the design_schema field exists");
  // RUN TO THE NEXT FIELD, never a byte count. This was `slice(i, i + 4000)`
  // and went red the moment the functions description grew — a capacity
  // paragraph was added ahead of the webhook half, and the window stopped
  // reaching the thing it asserts. A guard sized in bytes silently stops
  // covering what it was written for; this repo has now recorded that four
  // separate times, and this is the fifth.
  const end = worker.indexOf("      tables: {", i);
  assert.ok(end > i, "the field after `functions` moved — retarget this window");
  const field = worker.slice(i, end);
  assert.ok(field.length > 1000, "the functions field was not read whole: " + field.length);
  assert.ok(/hook_<something>/.test(field), "the naming convention is stated");
  assert.ok(/one jsonb argument/.test(field), "and the shape it must have");
  assert.ok(/internal:true/.test(field), "and that it must be internal");
  // Idempotency is the difference between a retried delivery and a duplicate
  // order, and only the model can express it — it is a schema constraint.
  assert.ok(/ON CONFLICT DO NOTHING/.test(field), "retries are named as the sender's normal behaviour");
});

test("`internal` survives into _meta, which is the only copy this route sees", () => {
  // FOUND AS A LIVE BREAK, an hour after shipping the route. `functionFor`
  // demands `internal`, and `applySiteSchema` wrote `{name, args, returns}` —
  // so the build succeeded, the function existed in Postgres, and EVERY hook on
  // EVERY site resolved to null. The parsed spec is long gone by request time;
  // `_meta` is all there is.
  //
  // Asserted at both ends rather than on one file: the property is that the
  // reader's requirement and the writer's output agree.
  const schema = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const mod = fs.readFileSync(new URL("../site-inbound.mjs", import.meta.url), "utf8");
  assert.ok(/!f\.internal/.test(mod), "the reader requires it");
  // The ASSIGNMENT, not the name: the first mention of `metaOut.functions` in
  // this file is inside a comment 80 lines above the code, so a bare-name
  // anchor lands on prose and reads the wrong window. Same trap as every other
  // source guard here.
  const i = schema.indexOf("metaOut.functions = Array.from(");
  assert.ok(i > 0, "the writer exists");
  const writer = schema.slice(Math.max(0, i - 1200), i);
  assert.ok(/internal: !!f\.internal/.test(writer), "…and the writer records it");
});

test("the raw body is what is verified", () => {
  const i = worker.indexOf("handleInbound(");
  const block = worker.slice(Math.max(0, i - 1200), i + 400);
  assert.ok(/await request\.text\(\)/.test(block), "the bytes, not a re-serialised parse");
});
