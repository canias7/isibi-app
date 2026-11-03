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
// absent from the route's whole reply, from the Worker's own log and from the
// canary's line.
import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL } from "../builder/route-shared.mjs";
import { FALLBACK_WITH_SITE } from "../parked/old-way/builder/site-ask.mjs";
import { XAI_ENDPOINT } from "../builder/model-xai.mjs";
import { failureSaid } from "../scripts/canary-route.mjs";
import { canaryRoutingLine } from "./fixtures/canary-line.mjs";

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
  // THE WORKER'S LOG IS AN EXIT TOO: every line it writes while it answers is
  // kept, objects as a real console would print them.
  const logs = [];
  const quiet = {};
  for (const k of ["error", "warn", "log", "info"]) {
    quiet[k] = console[k];
    console[k] = (...a) => logs.push(a.map((x) => (typeof x === "string" ? x : inspect(x, { depth: 6 }))).join(" "));
  }
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
    return new Response("no stub (test fixture)", { status: 400 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + BEARER },
      body: JSON.stringify({ message: MESSAGE, site: SITE, picker, firstBuild: false, brief: MESSAGE, qa: [], answering: false,
        attached: false, slug: "fretwork-1", hasSite: true, ...body }),
    }), { ANTHROPIC_API_KEY: KEYS.anthropic, XAI_API_KEY: KEYS.xai, ...env }, makeCtx());
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), seen, logs };
  } finally {
    globalThis.fetch = real;
    Object.assign(console, quiet);
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
  // THE LOG: the reason once, the same allow-listed object the reply carries —
  // which also proves the capture is alive before the absence below is read.
  const said = r.logs.filter((l) => l.startsWith("route failed:"));
  assert.equal(said.length, 1, "the failure was not logged exactly once: " + JSON.stringify(r.logs).slice(0, 300));
  assert.equal(said[0], "route failed: " + JSON.stringify(r.body.failure), "the log and the reply disagree");
  assertNoSecrets("the Worker's log", r.logs.join("\n"));
  // AND THE CANARY'S OWN LINE, evaluated from its source on this very answer.
  assertNoSecrets("the canary's routing line", canaryRoutingLine({ ms: 400 }, r.body));
}

/**
 * RE-ANCHORED 2026-10-24 (provider-retry re-landed; the owner's design in
 * docs/plans/2026-10-24-model-failures.md): a PROVIDER-SIDE failure of the
 * routing call (503, 502, 504, 500, 429 that is not billing, 529 overloaded, a
 * dropped connection) is no longer the fallback: nothing is routed, run or
 * charged, and the route answers `waiting` with the fixed notice so the page
 * asks again when its countdown ends. The reason is still carried and logged,
 * exactly as the fallback carried it — which is what these cases guard.
 */
function assertWaiting(r) {
  assert.equal(r.status, 200, "the waiting answer is not a 200: " + r.text.slice(0, 200));
  assert.equal(r.body.ok, false);
  assert.equal(r.body.waiting, true, "a provider outage did not answer waiting");
  assert.equal(r.body.failed, true);
  assert.equal(r.body.cost, 0, "a routing call that is waiting was billed");
  assert.equal(r.body.wait && r.body.wait.kind, "provider-wait", "the waiting answer carries no notice");
  assert.deepEqual(r.seen.debits, [], "the ledger was asked to collect while waiting");
  const said = r.logs.filter((l) => l.startsWith("route failed:"));
  assert.equal(said.length, 1, "the failure was not logged exactly once: " + JSON.stringify(r.logs).slice(0, 300));
  assert.equal(said[0], "route failed: " + JSON.stringify(r.body.failure), "the log and the reply disagree");
  assertNoSecrets("the Worker's log", r.logs.join("\n"));
  assertNoSecrets("the canary's routing line", canaryRoutingLine({ ms: 400 }, r.body));
}
/** The owner's provider-side kinds, by status (a billing refusal is never one, whatever its status). */
const WAITED = new Set([500, 502, 503, 504, 429, 529]);
const assertFallbackOrWaiting = (r, status, billing, intent) => (WAITED.has(status) && !billing ? assertWaiting(r) : assertFallback(r, intent));

// ── ONLY A CODE THE PROVIDER DOCUMENTS IS NAMED ────────────────────────────
//
// A code's characters prove nothing: `private_token_probe` is as well formed as
// `overloaded_error`. So the route names a provider's code only from a finite
// table, by provider, and drops anything else — an unknown code, or a code that
// is not a string at all — without echoing or coercing it. The table below is
// this test's own: Anthropic's documented `error.type` values with their
// statuses, and the one xAI code the Worker itself classifies (xAI documents
// no body codes).
const ANTHROPIC_DOCUMENTED = [
  ["invalid_request_error", 400], ["authentication_error", 401], ["billing_error", 402], ["permission_error", 403],
  ["not_found_error", 404], ["request_too_large", 413], ["rate_limit_error", 429], ["api_error", 500], ["overloaded_error", 529],
];
const PROBE = "private_token_probe";
const anthropicBody = (type, message = "no") => json({ type: "error", error: { type, message } }, 400);

test("the canary's line says only what it can read", () => {
  // Cannot-tell is said as such, never as a value.
  for (const bad of [undefined, null, "provider", [], { kind: "exploded" }, { kind: ["provider"] }]) {
    assert.equal(failureSaid(bad), "no reason given", JSON.stringify(bad));
  }
  // A field of the wrong shape is left out, not coerced.
  assert.equal(failureSaid({ kind: "provider", provider: "xai", status: "403", type: "has space", billing: "true", error: "sk-ant" }), "provider xai");
  // A code is printed only when its own provider documents it: a well-formed
  // unknown one, a known one in an array, and another provider's are not.
  assert.equal(failureSaid({ kind: "provider", provider: "anthropic", status: 400, type: "private_token_probe" }), "provider anthropic 400");
  assert.equal(failureSaid({ kind: "provider", provider: "anthropic", status: 529, type: ["overloaded_error"] }), "provider anthropic 529");
  assert.equal(failureSaid({ kind: "provider", provider: "xai", status: 529, type: "overloaded_error" }), "provider xai 529");
  assert.equal(failureSaid({ kind: "provider", provider: "anthropic", status: 403, type: "insufficient_quota", billing: true }),
    "provider anthropic 403 — refused on our account (billing or key)");
  // CONTROLS: a documented code under its own provider is printed.
  assert.equal(failureSaid({ kind: "provider", provider: "anthropic", status: 529, type: "overloaded_error" }), "provider anthropic 529 overloaded_error");
  assert.equal(failureSaid({ kind: "provider", provider: "xai", status: 403, type: "insufficient_quota", billing: true }),
    "provider xai 403 insufficient_quota — refused on our account (billing or key)");
});
