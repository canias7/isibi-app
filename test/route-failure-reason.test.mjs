// A FAILED ROUTING CALL NAMES ITS REASON, AND ONLY A SAFE ONE (Lane 1b,
// 2026-09-30).
//
// `routeMessage` wrapped the request build and the model call in one bare
// `catch` and returned the fallback with `failed: true`, so run 70 (Batch 1)
// answered `addon` + `failed` in 0.4 s and nothing could say why: the xAI
// account's balance was empty, which the owner found by looking. The reason now
// rides on the answer as `failure` — which step threw (building the request or
// sending it), the provider, its status, its own error token, whether it was
// refused on our account, and the error's class — through `/api/site/route` and
// into the canary's evidence.
//
// EVERY ROUTE CASE DRIVES THE REAL `POST /api/site/route` with the provider
// answered on the wire, the way `test/canary-route.test.mjs` does. What is
// established is what the route reports for each failure shape, never how often
// a real provider fails that way.
//
// AND NOTHING SECRET-BEARING GETS OUT. The keys the Worker holds, a bearer
// token, a connection string and the customer's own words are planted in every
// place a failure can carry text — the provider's message, its error token, the
// thrown error's message, name, cause and extra fields — and each must be
// absent from the route's whole reply and from the canary's line.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL, FALLBACK_WITH_SITE, FALLBACK_NO_SITE, routeMessage, ROUTE_FAILURE_KINDS } from "../builder/site-ask.mjs";
import { XAI_ENDPOINT } from "../builder/model-xai.mjs";
import { failureSaid } from "../scripts/canary-route.mjs";

const USER = { id: "u-route-failure-1", email: "owner@example.com" };
// THE SECRETS, shaped like the real ones: the two provider keys the Worker is
// handed, a Supabase-style bearer, a Neon connection string with its password,
// and the customer's message, which is their data.
const KEYS = {
  xai: "xai-Sk3yZq7Rt9Lm2Np4Vx6Bc8Df0Gh1Jk3Lm5Np7Qr9St1Uv3Wx5Yz7Ab9Cd1Ef3Gh5Ij7Kl9Mn1Op3Qr5St7Uv9Wx1",
  anthropic: "sk-ant-api03-Q9w8E7r6T5y4U3i2O1p0AsDfGhJkLzXcVbNm1234567890abcdEFGHijklMNOPqrst-uvwxYZAA",
};
const BEARER = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWNyZXQifQ.c2VjcmV0LXNpZ25hdHVyZQ";
const CONN = "postgres://owner_role:npg_S3cretPassw0rd@ep-quiet-lake-123456.eu-west-2.aws.neon.tech/site_fretwork_1";
const MESSAGE = "Change the price of the Hour one-to-one lesson back to £40 for Acme Hidden Studio";
const SECRETS = [KEYS.xai, KEYS.anthropic, BEARER, CONN, "npg_S3cretPassw0rd", MESSAGE, "Acme Hidden Studio", "Hour one-to-one"];
const SITE = { name: "fretwork-1", url: "https://fretwork-1.gofarther.app", pages: ["/", "/prices", "/gear"], tables: ["lessons"] };

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const toolReply = (input) => json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

/**
 * One routing call through the real Worker. `provider(url, init)` answers the
 * model call (or throws, as a network does); every debit is recorded.
 */
async function route({ picker = "grok", provider, env = {}, body = {} } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const seen = { model: [], debits: [] };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      seen.debits.push(want);
      return json(want);
    }
    if (url.startsWith(XAI_ENDPOINT) || url.startsWith("https://api.anthropic.com/")) {
      seen.model.push(url);
      return provider(url, init);
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + BEARER },
      body: JSON.stringify({ message: MESSAGE, site: SITE, picker, firstBuild: false, brief: MESSAGE, qa: [], answering: false,
        attached: false, slug: "fretwork-1", hasSite: true, ...body }),
    }), { ANTHROPIC_API_KEY: KEYS.anthropic, XAI_API_KEY: KEYS.xai, ...env }, makeCtx());
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), seen };
  } finally {
    globalThis.fetch = real;
  }
}

/** Nothing secret-bearing anywhere in what left. */
function assertNoSecrets(what, ...texts) {
  for (const t of texts) {
    for (const s of SECRETS) assert.ok(!String(t).includes(s), `${what}: "${s.slice(0, 24)}…" escaped into ${String(t).slice(0, 160)}`);
    assert.ok(!/Bearer\s/i.test(String(t)), `${what}: an Authorization header escaped`);
  }
}

/** The fallback, unchanged: the same answer, nothing billed, no usage. */
function assertFallback(r, intent = FALLBACK_WITH_SITE) {
  assert.equal(r.status, 200, "the route no longer answers 200 on a failure: " + r.text.slice(0, 200));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.intent, intent, "the fallback moved");
  assert.equal(r.body.failed, true);
  assert.equal(r.body.cost, 0, "a failed routing call was billed");
  assert.equal(r.body.usage, undefined);
  assert.deepEqual(r.seen.debits, [], "the ledger was asked to collect for a failed call");
}

// ── THE PROVIDER ANSWERED, WITH AN ERROR ───────────────────────────────────

test("run 70's shape: xAI refuses on an empty balance — named as the provider, our account, with its status and token", async () => {
  // The body xAI sends for an exhausted team, with the key and the request
  // quoted back into it for good measure.
  const r = await route({ picker: "grok", provider: () => json({
    code: "insufficient_quota",
    error: "Your team has run out of credits. Key " + KEYS.xai + " was used for: " + MESSAGE,
  }, 403) });
  assertFallback(r);
  assert.equal(r.seen.model.length, 1, "the provider was not asked exactly once");
  assert.deepEqual(r.body.failure, { kind: "provider", provider: "xai", status: 403, type: "insufficient_quota", billing: true, error: "Error" });
  assert.equal(failureSaid(r.body.failure), "provider xai 403 insufficient_quota — refused on our account (billing or key)");
  assertNoSecrets("xai 403", r.text, failureSaid(r.body.failure));
});

test("Anthropic overloaded: the provider's token, and not our account", async () => {
  const r = await route({ picker: "sonnet", provider: () => json({ type: "error", error: { type: "overloaded_error", message: "Overloaded while reading: " + MESSAGE } }, 529) });
  assertFallback(r);
  assert.deepEqual(r.body.failure, { kind: "provider", provider: "anthropic", status: 529, type: "overloaded_error", billing: false, error: "Error" });
  assertNoSecrets("anthropic 529", r.text, failureSaid(r.body.failure));
});

test("a provider token that is not a token is dropped, never echoed", async () => {
  // A key-shaped token, a sentence and markup in the provider's own type field:
  // each is refused by shape, and the status still says who answered.
  for (const type of [KEYS.xai, "your brief was: " + MESSAGE, "<script>alert(1)</script>", "x".repeat(41)]) {
    const r = await route({ picker: "sonnet", provider: () => json({ type: "error", error: { type, message: CONN } }, 400) });
    assertFallback(r);
    assert.deepEqual(r.body.failure, { kind: "provider", provider: "anthropic", status: 400, type: null, billing: false, error: "Error" }, type.slice(0, 30));
    assertNoSecrets("type " + type.slice(0, 20), r.text, failureSaid(r.body.failure));
  }
});

// ── NO ANSWER CAME BACK ────────────────────────────────────────────────────

test("the connection failed on the way: transport, with the error's class and nothing it said", async () => {
  const cause = new Error("connect to " + CONN + " with Authorization: Bearer " + KEYS.xai);
  const e = new TypeError("fetch failed: " + KEYS.xai + " " + CONN, { cause });
  e.request = { headers: { Authorization: "Bearer " + KEYS.xai }, body: MESSAGE };
  const r = await route({ picker: "grok", provider: () => { throw e; } });
  assertFallback(r);
  assert.deepEqual(r.body.failure, { kind: "transport", provider: "xai", status: null, type: null, billing: false, error: "TypeError" });
  assert.equal(failureSaid(r.body.failure), "transport xai TypeError");
  assertNoSecrets("transport", r.text, failureSaid(r.body.failure));
});

test("our own clock ran out: timeout, not transport", async () => {
  const r = await route({ picker: "sonnet", provider: () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); } });
  assertFallback(r);
  assert.deepEqual(r.body.failure, { kind: "timeout", provider: "anthropic", status: null, type: null, billing: false, error: "TimeoutError" });
});

test("a key that is not set: config, and the provider is never called", async () => {
  const r = await route({ picker: "grok", env: { XAI_API_KEY: "" }, provider: () => { throw new Error("the provider was called with no key"); } });
  assertFallback(r);
  assert.equal(r.seen.model.length, 0, "a request went out with no key");
  assert.deepEqual(r.body.failure, { kind: "config", provider: "xai", status: null, type: null, billing: false, error: "Error" });
});

test("an error whose class name carries text is reported as a plain Error", async () => {
  const e = new Error(KEYS.anthropic);
  e.name = "sk" + "antapi03SECRETKEYabcdef";
  const r = await route({ picker: "sonnet", provider: () => { throw e; } });
  assertFallback(r);
  assert.equal(r.body.failure.error, "Error");
  assert.equal(r.body.failure.kind, "transport");
  assertNoSecrets("named error", r.text, failureSaid(r.body.failure));
  assert.ok(!r.text.includes(e.name), "the error's own name escaped");
});

// ── THE REQUEST COULD NOT BE BUILT ─────────────────────────────────────────

test("a request that cannot be built is named as ours, and no model is asked", async () => {
  // Reachable from the public body: a site name the digest cannot turn into
  // text (`String({toString: 1})` throws). Before this it read as a model
  // failure.
  const r = await route({ picker: "grok", provider: () => toolReply({ intent: "edit", layer: "data" }),
    body: { site: { ...SITE, name: { toString: 1 } } } });
  assertFallback(r);
  assert.equal(r.seen.model.length, 0, "a model was asked with a request that could not be built");
  assert.deepEqual(r.body.failure, { kind: "request", provider: "xai", status: null, type: null, billing: false, error: "TypeError" });
});

// ── THE FALLBACK AND THE BILLING DID NOT MOVE ──────────────────────────────

test("with no site the fallback is still a build, and it carries its reason too", async () => {
  const r = await route({ picker: "grok", provider: () => json({ code: "rate_limit_exceeded", error: "slow down" }, 429), body: { hasSite: false } });
  assertFallback(r, FALLBACK_NO_SITE);
  assert.deepEqual(r.body.failure, { kind: "provider", provider: "xai", status: 429, type: "rate_limit_exceeded", billing: false, error: "Error" });
});

test("CONTROL: an answer that routed is billed as before and carries no failure", async () => {
  const r = await route({ picker: "sonnet", provider: () => toolReply({ intent: "edit", layer: "data" }) });
  assert.equal(r.status, 200);
  assert.equal(r.body.intent, "edit");
  assert.equal(r.body.layer, "data");
  assert.equal(r.body.failed, undefined, "a working route says it failed");
  assert.equal(Object.hasOwn(r.body, "failure"), false, "a working route carries a failure");
  assert.ok(r.body.cost > 0, "a routed answer was not billed");
  assert.equal(r.seen.debits.length, 1);
});

// ── THE MODULE ON ITS OWN ──────────────────────────────────────────────────

test("routeMessage reads a failure without the Worker's reader, and a bad reader cannot widen it", async () => {
  const refuse = Object.assign(new Error("xai 402"), { status: 402, detail: JSON.stringify({ error: { type: "insufficient_quota", message: KEYS.xai } }) });
  const bare = await routeMessage({ send: async () => { throw refuse; } }, { message: MESSAGE, site: SITE, hasSite: true, model: "grok-4.6" });
  assert.equal(bare.failed, true);
  assert.equal(bare.intent, FALLBACK_WITH_SITE);
  assert.equal(bare.usage, null);
  // No reader: the status alone says it was our account; the token is unread.
  assert.deepEqual(bare.failure, { kind: "provider", provider: "xai", status: 402, type: null, billing: true, error: "Error" });
  // A reader that throws, or answers junk, changes nothing it may not.
  const throwing = await routeMessage({ send: async () => { throw refuse; }, classify: () => { throw new Error(KEYS.xai); } },
    { message: MESSAGE, site: SITE, hasSite: true, model: "grok-4.6" });
  assert.deepEqual(throwing.failure, bare.failure);
  const junk = await routeMessage({ send: async () => { throw Object.assign(new Error("x"), { status: 500 }); }, classify: () => ({ type: "has space", billing: "yes" }) },
    { message: MESSAGE, site: SITE, hasSite: true, model: "claude-sonnet-5" });
  assert.deepEqual(junk.failure, { kind: "provider", provider: "anthropic", status: 500, type: null, billing: false, error: "Error" });
  // A status that is not an HTTP status is not one.
  const odd = await routeMessage({ send: async () => { throw Object.assign(new Error("x"), { status: "403" }); } }, { message: MESSAGE, site: SITE, hasSite: true, model: "grok-4.6" });
  assert.equal(odd.failure.kind, "transport");
  assert.equal(odd.failure.status, null);
  assertNoSecrets("module", JSON.stringify([bare, throwing, junk, odd]));
  // Every kind the module can answer is one the canary can say.
  for (const kind of ROUTE_FAILURE_KINDS) assert.match(failureSaid({ kind }), new RegExp("^" + kind + "\\b"));
});

test("the canary's line says only what it can read", () => {
  // Cannot-tell is said as such, never as a value.
  for (const bad of [undefined, null, "provider", [], { kind: "exploded" }, { kind: ["provider"] }]) {
    assert.equal(failureSaid(bad), "no reason given", JSON.stringify(bad));
  }
  // A field of the wrong shape is left out, not coerced.
  assert.equal(failureSaid({ kind: "provider", provider: "xai", status: "403", type: "has space", billing: "true", error: "sk-ant" }), "provider xai");
});
