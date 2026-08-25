// CAN THE BUILD CONTAINER REACH A MODEL PROVIDER — the free probe, and the
// guards that keep it free and keep it honest.
//
// WHY IT EXISTS: whether a Cloudflare container can reach api.x.ai has never
// been observed, and it is the one fact the whole container-generation change
// rests on. It has already cost TWO real builds — run 38 died mid-generation
// with no record of which side held the call, and run 39's own flag died with
// the build it was meant to describe. Each was ~13 minutes and ~6 credits to
// read one boolean, and neither read it.
//
// THE PROBE ANSWERS IT FOR NOTHING, and the reason is the whole design: the
// request carries NO CREDENTIAL, so a provider answers 401 before it reads a
// token — nothing generated, nothing billed — and **any HTTP status at all is
// the proof**, because DNS, TCP, TLS and HTTP must all have worked to produce
// one. Blocked egress produces ENOTFOUND/ECONNREFUSED/a timeout instead.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SERVER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// Comments blanked before anything is asserted about the source: both files
// EXPLAIN this probe at length, so prose about "Authorization" or "oneAtATime"
// would satisfy a check written to look for the code. Prose containing the thing
// it forbids is this repo's most repeated own-goal.
const blank = (src) => src
  .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));

const S = blank(SERVER);
const W = blank(WORKER);

/** The `/reach` handler's own body, bounded by its own close. */
function reachBody() {
  const at = S.indexOf('req.url === "/reach"');
  assert.ok(at > 0, "the container has no /reach route — the one free answer to the egress question is gone");
  // Bounded by the next top-level route test rather than a byte count: a window
  // sized in bytes is outrun by the next comment somebody writes, which this
  // repo has recorded ten-plus times.
  const nextAt = S.indexOf("req.method ===", at + 40);
  return S.slice(at, nextAt > at ? nextAt : S.length);
}

test("THE PROBE SENDS NO CREDENTIAL, which is what makes it free", () => {
  const body = reachBody();
  // A key here turns a free reachability check into a real request against a
  // real account — and one that would then be run on every push.
  assert.ok(!/Authorization/i.test(body),
    "the reach probe sends an Authorization header — it is a real billable request, not a free probe");
  assert.ok(!/BUILD_KEYS|keysFrom|XAI_API_KEY|ANTHROPIC_API_KEY/.test(body),
    "the reach probe reaches for a credential — the whole point is that it cannot spend anything");
  // And it must not be a model call wearing a probe's name.
  assert.ok(!/callBuilderModel|chat\/completions|\/v1\/messages/.test(body),
    "the reach probe makes a model call — that costs tokens and answers a different question");
});

test("REACHED MEANS A STATUS CAME BACK, never that it was 2xx", () => {
  const body = reachBody();
  // The inversion this guards against is the expensive one: a 401 is the
  // EXPECTED answer, so reporting ok/not-ok would call a working network a
  // failure and send the next person to fix egress that is fine.
  assert.match(body, /reached:\s*true,\s*status:/,
    "the success arm does not report reached with the status — a 401 must read as reachable");
  assert.ok(!/reached:\s*r\.ok/.test(body),
    "reached is derived from r.ok — a 401 from a perfectly reachable provider would read as blocked");
  // The failure arm must name WHICH failure. A refused connection is a policy
  // and a timeout is a black hole, and they need different actions.
  assert.match(body, /reached:\s*false/, "the failure arm does not report reached:false");
  assert.match(body, /code:/, "the failure arm drops the error code — ECONNREFUSED and a timeout read alike");
});

test("BOTH PROVIDERS ARE PROBED, because the answer may differ per host", () => {
  // grok is DEFAULT_PICKER and does the building; Anthropic does the routing and
  // the cheap edit lanes. Egress open to one and closed to the other is a real
  // state, and probing one host would report it as "the container has no
  // network".
  const targets = S.slice(S.indexOf("const REACH_TARGETS"), S.indexOf("const REACH_TIMEOUT_MS"));
  assert.match(targets, /api\.x\.ai/, "the probe does not test xAI — the provider that does the building");
  assert.match(targets, /api\.anthropic\.com/, "the probe does not test Anthropic — the router and every cheap edit lane");
  // BOUNDED, or a blocked host hangs the probe for as long as the platform will
  // hold it, which reads as the container being down rather than the network.
  assert.match(S, /REACH_TIMEOUT_MS\s*=\s*\d+/, "the probe has no timeout — a black-holed host would hang it");
});

test("IT IS NOT QUEUED BEHIND A RUNNING BUILD", () => {
  // Inside `oneAtATime` the probe answers ten minutes late during a build, which
  // is indistinguishable from the timeout it exists to diagnose.
  assert.ok(!/oneAtATime/.test(reachBody()),
    "the reach probe runs inside oneAtATime — during a build it would answer late, which reads as the failure it is meant to tell apart");
});

test("THE WORKER CAN REACH IT, AUTH-GATED, AND SAYS WHICH SIDE FAILED", () => {
  const at = W.indexOf('url.pathname === "/api/site/reach"');
  assert.ok(at > 0, "the Worker has no route to the probe — the container answer is reachable by nobody");
  const nextAt = W.indexOf('url.pathname === "/api/game/build-health"', at);
  const body = W.slice(at, nextAt > at ? nextAt : at + 3000);
  // Gated like every other route here, and for a reason beyond consistency: it
  // starts a container, so an open version lets anyone make us start one.
  assert.match(body, /authUser\(request\)/, "the reach route is not auth-gated — anyone could spin our containers up");
  assert.match(body, /http:\/\/build\/reach/, "the Worker route does not actually ask the container");
  // "The container was unreachable" and "the container could not reach the
  // provider" are different answers and must not wear each other's wording —
  // that confusion is the entire reason this probe exists.
  assert.match(body, /the container could not be reached/,
    "the catch does not distinguish an unreachable container from a container with no egress");
});
