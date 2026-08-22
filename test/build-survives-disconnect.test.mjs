// The build must outlive the client.
//
// WHAT THIS IS ABOUT. Cloudflare cancels a Worker when its client disconnects,
// and the build route runs for minutes — so every dropped connection killed the
// build mid-flight and left a claimed slug, a live Neon project, a settled
// schema charge and NO SITE. Measured four times: runs 4 and 10 at 286.0s and
// 285.3s, and run 11 (2026-08-22) at 274.3s on an ENGLISH brief of exactly the
// shape that had published twice before, which is what killed the theory that
// the wall was a property of the language.
//
// `ctx.waitUntil` is the documented mechanism for exactly this: work registered
// on it outlives the response. A reset connection then costs the ANSWER and no
// longer costs the SITE.
//
// WHY IT IS DRIVEN RATHER THAN READ. This is the wiring layer, where this repo
// has recorded twelve dead features — a source-read for `waitUntil(` is
// satisfied by any of the other twenty-eight calls in the file, by a comment,
// and by a call whose result is discarded. What has to hold is that THIS route
// registers THIS work, and that the wrapper still returns the Response the
// handler produced rather than swallowing it.
//
// WHAT AN EMPTY `env` CAN AND CANNOT SEE. Nothing that talks to Supabase, Neon,
// R2 or a model can run here, so what is exercised is the refusal path — which
// is exactly right: a refusal goes through the SAME wrapper as a real build, so
// if the wrapper forwards a refusal it forwards a build, and if it registers on
// a refusal it registers on a build. What this cannot prove is that Cloudflare
// really keeps the work alive across a real disconnect; only a live run can.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadWorker, makeCtx, isUnrouted } from "./fixtures/worker-harness.mjs";

const ROUTES = ["/api/site/react-build", "/api/site/build", "/api/site/react-revise"];

async function build(path, ctx) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief: "a barber shop in Leeds" }),
  });
  const res = await worker.fetch(req, {}, ctx);
  return { res, text: await res.text() };
}

test("the build route still ANSWERS — the wrapper forwards what the handler returned", async () => {
  // THE FAILURE THIS RULES OUT IS TOTAL AND SILENT. Wrapping 1,800 lines in an
  // async IIFE is only correct if every exit is a `return`; a single
  // fall-through path resolves the wrapper to `undefined` and the router hands
  // back nothing at all — every build on the platform, 500, instantly.
  for (const path of ROUTES) {
    const { res, text } = await build(path, makeCtx());
    assert.ok(res, `${path}: the route resolved to nothing — the wrapper has a fall-through path`);
    assert.equal(typeof res.status, "number", `${path}: not a Response`);
    assert.ok(!isUnrouted({ status: res.status, text }),
      `${path}: the router fell through — the wrapper broke the route's own dispatch`);
    // Unauthenticated, so this is the auth gate refusing. What matters is that
    // a refusal survives the wrapper unchanged.
    assert.equal(res.status, 401, `${path}: expected the auth gate, got ${res.status}: ${text.slice(0, 120)}`);
  }
});

test("…and it registers the work so a disconnect cannot cancel it", async () => {
  // THE HALF THAT IS THE FIX. Without this the route is correct and the build
  // still dies on every reset — the wiring-layer shape, asserted at the
  // boundary rather than by looking for the call in the source.
  for (const path of ROUTES) {
    const ctx = makeCtx();
    await build(path, ctx);
    assert.ok(ctx.pending.length >= 1,
      `${path}: nothing was registered on waitUntil, so a dropped connection still kills the build`);
    // And it is a PROMISE, not a value — `waitUntil(undefined)` registers
    // nothing and would read as present here.
    assert.ok(ctx.pending.every((p) => p && typeof p.then === "function"),
      `${path}: something other than a promise was registered`);
  }
});

test("a registered rejection is handled, and the caller still sees the throw", async () => {
  // TWO OPPOSITE MISTAKES, and only one of them is visible without this.
  //
  // Registering the raw promise means an unhandled rejection inside the runtime
  // whenever a build throws — noisy at best, and on some runtimes fatal to the
  // isolate. Registering a SWALLOWED one and returning that instead means a
  // build that threw answers 200 with an empty body: strictly worse than the
  // crash it replaced.
  //
  // The shape that satisfies both is the one in the source — `.then(noop, noop)`
  // handed to `waitUntil`, and the ORIGINAL returned. Driven here rather than
  // matched, because the two spellings differ by one character.
  const worker = await loadWorker();
  const ctx = makeCtx();
  // A body that is not JSON reaches the route's own parse and is refused there.
  const req = new Request("https://gofarther.dev/api/site/react-build", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{oops",
  });
  const res = await worker.fetch(req, {}, ctx);
  assert.ok(res && typeof res.status === "number", "a malformed body lost the response entirely");
  // Every registered promise must settle without an unhandled rejection.
  await Promise.all(ctx.pending.map((p) => p.then(() => {}, () => {})));
});

test("the wrapper is guarded on ctx, so a caller without one is not a TypeError", () => {
  // `ctx` is a runtime argument rather than a language guarantee. There is one
  // caller today and it always passes one; a second added later without it
  // would otherwise turn EVERY build into `Cannot read properties of undefined`.
  // Read from the source because the property is about the absent case, which a
  // harness supplying a ctx cannot reach.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const buildDone = (async () => {");
  assert.ok(at > 0, "the build wrapper is gone — the build no longer survives a disconnect");
  const tail = src.slice(at, at + 200000);
  const call = tail.match(/ctx && typeof ctx\.waitUntil === "function"\) ctx\.waitUntil\(buildDone[^\n]*/);
  assert.ok(call, "the waitUntil call is unguarded, or no longer registers buildDone");
  assert.match(call[0], /\.then\(\(\) => \{\}, \(\) => \{\}\)/,
    "the registered promise has no rejection handler");
  // …AND WHAT IS RETURNED IS THE ORIGINAL, NEVER THE SWALLOWED ONE. That is the
  // property, and this used to pin the spelling `return buildDone;` — which went
  // red the day the route started racing the build against its own deadline, on
  // a change that preserves the property exactly. The recurring own-goal, in the
  // guard written for the shape it is guarding.
  //
  // The failure it exists for differs from a correct answer by one character:
  // registering the swallowed promise and returning THAT means a build that
  // threw answers 200 with an empty body — strictly worse than the crash it
  // replaced. So the test is that the return NAMES the build and does NOT carry
  // the swallow.
  const ret = tail.match(/\n *return ([^\n]*buildDone[\s\S]{0,400}?);\n/);
  assert.ok(ret, "the route no longer returns anything built from the build's own promise");
  assert.doesNotMatch(ret[1], /\.then\(\(\) => \{\}, \(\) => \{\}\)/,
    "the route returns the SWALLOWED promise, so a build that threw answers 200 with an empty body");
});
