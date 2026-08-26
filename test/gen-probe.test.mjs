// THE FIRE-AND-COLLECT PROBE — the route that lets somebody SEE what the
// container says, instead of inferring it from an error's name.
//
// Run 40 came back `{stage:"resume", kind:"TimeoutError"}` and three rounds of
// reading could narrow it to a branch and no further. This route drives the same
// two container endpoints a real build uses, with a request no provider will
// answer, so the whole mechanism is exercised and nothing is spent.
//
// TWO PROPERTIES DECIDE WHETHER IT MAY EXIST AT ALL, and both are asserted here:
// it must not be able to spend money, and it must not be able to touch a
// customer's build lane. Everything else is a diagnostic.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit } from "./fixtures/worker-harness.mjs";
import { laneName } from "../builder/build-lane.mjs";

const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
// COMMENTS BLANKED, length-preserving. The route argues every one of these
// decisions at length and therefore spells them, so a scan over the raw text
// matches the EXPLANATION and passes against a route that does none of it —
// this repo's most recorded own-goal.
const CODE = RAW.split("\n")
  .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l))
  .join("\n");
assert.equal(CODE.length, RAW.length, "the blanker changed the file's length — every offset below would be wrong");

/** The route's own block, bounded by the NEXT route matcher rather than by a
 *  byte count. A window sized in bytes is the own-goal that went red on a
 *  correct change earlier in this same arc. */
function routeBlock() {
  const at = CODE.indexOf('url.pathname === "/api/site/genprobe"');
  assert.ok(at > 0, "the gen probe route is gone — rescope this guard");
  const rest = CODE.slice(at + 1);
  const next = rest.search(/\n\s{4}if \(\(?url\.pathname/);
  assert.ok(next > 0, "the next route matcher is gone — this window has no end and proves nothing");
  const block = CODE.slice(at, at + 1 + next);
  assert.ok(block.length > 600 && block.length < 6000, `the probe route reads as ${block.length} bytes — the window has lost its bounds`);
  return block;
}

test("THE PROBE CANNOT SPEND — it names a model no provider has", () => {
  // THE PROPERTY THAT LETS THIS RUN ON EVERY PUSH. A provider refuses an unknown
  // model before it generates a token, so the call is free AND its status is the
  // measurement: 404 is a key that was accepted, 401 is one that was not. A
  // probe that named a REAL model would quietly buy a generation per push.
  const block = routeBlock();
  const m = /model:\s*"([^"]+)"/.exec(block);
  assert.ok(m, "the probe no longer names a model — it cannot be free by construction");
  assert.match(m[1], /probe/i, `the probe fires "${m[1]}" — a name a provider might actually answer`);
  // …and it asks for nothing even if something did answer.
  assert.match(block, /max_tokens:\s*1\b/, "the probe does not cap its own output at one token");
  // The prefix is what `isXaiModel` routes on, so this must still exercise the
  // provider a real build uses rather than falling through to the other one.
  assert.match(m[1], /^grok-/, "the probe no longer routes to the provider a build uses");
});

test("THE PROBE HAS ITS OWN LANE, and can never take a customer's", () => {
  // One lane is one container instance is one working directory. A probe keyed
  // by anything a customer controls could queue behind — or ahead of — a real
  // build, and this one deliberately fires a job and walks away.
  const block = routeBlock();
  const m = /laneName\("([^"]+)"\)/.exec(block);
  assert.ok(m, "the probe's lane is not a literal — it could be keyed by a customer's slug");
  assert.equal(laneName(m[1]), laneName("gen-probe"), "the probe's lane moved without this guard being told");
  assert.doesNotMatch(block, /laneName\(\s*slug/, "the probe reaches for a slug");
});

test("BOTH PHASES PASS THE CONTAINER'S OWN ANSWER THROUGH", () => {
  // The whole value of this route is that it does NOT reinterpret. `state`,
  // `status`, `kind` and `message` are the shape `resumeDecision` reads, and a
  // probe that summarised them would be a second opinion about the one thing
  // being measured.
  const block = routeBlock();
  assert.match(block, /model\/start/, "the probe cannot fire");
  assert.match(block, /model\/result/, "the probe cannot collect");
  const spreads = [...block.matchAll(/\{\s*\.\.\.body,/g)];
  assert.ok(spreads.length >= 2, `the container's answer is passed through on ${spreads.length} of the two phases`);
  // READ AS TEXT FIRST, like every other hop to this container: a 502 from the
  // runtime, an OOM kill and an empty 200 are three different things, and
  // parsing straight to JSON reports them all as "no answer".
  assert.ok(!/await r\.json\(\)/.test(block), "the probe parses straight to JSON, so a runtime 502 reads as no answer");
});

test("the probe refuses an unauthenticated caller rather than throwing", async () => {
  // It spins up a container, so an open version is a way for anyone to make us
  // start one — the same argument `/api/site/reach` already makes.
  const r = await hit("/api/site/genprobe");
  assert.equal(r.status, 401, "an anonymous caller does not get a clean 401 — the route is unreachable or broken");
});

test("…and says so plainly when there is no container binding", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: "owner-1" }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const r = await hit("/api/site/genprobe", { headers: { Authorization: "Bearer t" }, env: { SITE_BUILD_CONTAINER: undefined } });
    assert.equal(r.status, 501, "a missing binding is reported as something else");
  } finally { globalThis.fetch = real; }
});
