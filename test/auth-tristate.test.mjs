// "CANNOT TELL" IS NOT "NO" — the last gate in the file that read them as one.
//
// `authUser` collapsed a GoTrue outage, a timeout and a network throw into the
// same `null` as a bad token, silently. The customer-facing consequence is not
// subtle: `apiFetch` in public/chat.js calls `showAuthGate()` on ANY 401, and
// that sets `shell.inert = true` — so a provider blip threw a modal sign-in over
// a live session, made the whole app non-interactive, and invited a retry
// against the same down provider.
//
// DRIVEN THROUGH THE REAL ROUTER, not read. The flag is set in `authUser` and
// acted on in `harden`, two functions ~1,100 lines apart with the request object
// as the only thing joining them — precisely the wiring layer where this repo has
// recorded twelve dead features, and precisely what a source-reading regex
// cannot check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit } from "./fixtures/worker-harness.mjs";

// A route that exists, is behind `authUser`, and needs no bindings to refuse.
const GATED = "/api/credits";

/** Run one request with the global fetch replaced — GoTrue is the only caller. */
async function withProvider(impl, run) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await run(); } finally { globalThis.fetch = real; }
}

const AUTHED = { Authorization: "Bearer some-token" };

test("a real refusal is still 401", async () => {
  // THE HALF THAT MUST NOT MOVE. A bad token is a refusal we DID make, and the
  // sign-in gate is the correct response to it.
  const r = await withProvider(
    async () => new Response(JSON.stringify({ error: "bad jwt" }), { status: 401 }),
    () => hit(GATED, { headers: AUTHED }),
  );
  assert.equal(r.status, 401, "a genuinely bad token stopped being refused");
});

test("no token at all is 401, not a provider outage", async () => {
  // The ordinary signed-out case never reaches the provider, so it must never be
  // flagged — otherwise every anonymous request to a gated route answers 503 and
  // the sign-in gate can never appear at all.
  const r = await hit(GATED);
  assert.equal(r.status, 401, "an unauthenticated caller no longer gets the sign-in gate");
});

for (const status of [500, 502, 503, 429]) {
  test(`a provider ${status} is 503, not 401`, async () => {
    const r = await withProvider(
      async () => new Response("upstream", { status }),
      () => hit(GATED, { headers: AUTHED }),
    );
    assert.equal(r.status, 503, `a provider ${status} still reads as a bad token, so the client throws a sign-in gate`);
    assert.match(r.text, /unavailable/i, "the 503 does not say what went wrong");
  });
}

test("a provider that throws is 503, not 401", async () => {
  const r = await withProvider(
    async () => { throw new TypeError("fetch failed"); },
    () => hit(GATED, { headers: AUTHED }),
  );
  assert.equal(r.status, 503, "a network throw still reads as a bad token");
});

test("a provider timeout is 503, not 401", async () => {
  // The 10s AbortSignal lands in the same catch, and an abort is the shape a
  // slow provider takes rather than a down one.
  const r = await withProvider(
    async () => { const e = new Error("The operation was aborted"); e.name = "TimeoutError"; throw e; },
    () => hit(GATED, { headers: AUTHED }),
  );
  assert.equal(r.status, 503, "a timeout still reads as a bad token");
});

test("the flag does not leak between requests", async () => {
  // Keyed on the request OBJECT for exactly this reason: a shared isolate serves
  // many requests, and a module-level boolean would turn one provider blip into
  // 503 for everybody until the isolate was recycled.
  const down = await withProvider(
    async () => new Response("upstream", { status: 500 }),
    () => hit(GATED, { headers: AUTHED }),
  );
  assert.equal(down.status, 503);

  const after = await withProvider(
    async () => new Response(JSON.stringify({ error: "bad jwt" }), { status: 401 }),
    () => hit(GATED, { headers: AUTHED }),
  );
  assert.equal(after.status, 401, "a later request inherited the previous one's outage");
});

test("the tri-state cannot be a return value", () => {
  // 39 call sites read `authUser`'s answer AS A USER, so any truthy sentinel is
  // an authenticated caller at every one of them. Asserted because the obvious
  // refactor — return `{ down: true }` — is a total authentication bypass that
  // looks like an improvement.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function authUser(request)");
  assert.ok(at > 0, "authUser moved — rescope this");
  const body = w.slice(at, w.indexOf("\n}", w.indexOf("catch (e)", at)));
  assert.ok(body.length > 400, "the authUser window is empty — rescope this");
  const returns = [...body.matchAll(/return ([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(returns.length >= 3, `only ${returns.length} returns found — the scan stopped matching`);
  for (const r of returns) {
    assert.ok(r === "null" || r.startsWith("user &&"),
      "authUser returns something other than null or the user: `" + r + "` — every caller reads this as a signed-in caller");
  }
});

test("the outage is logged, because silence is what left support with nothing", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function authUser(request)");
  const body = w.slice(at, w.indexOf("\n}", w.indexOf("catch (e)", at)));
  assert.equal((body.match(/console\.error/g) || []).length, 2,
    "the provider-failure branches do not both log — an outage leaves no trace anywhere");
});
