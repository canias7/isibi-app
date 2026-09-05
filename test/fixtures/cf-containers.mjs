// A stand-in for `@cloudflare/containers`, and the ONLY thing that was ever
// stopping `worker.js` from being imported.
//
// THE PREMISE THAT WAS WRONG. "worker.js cannot be imported" is written all
// through CLAUDE.md and is the stated reason every guard on the Worker is a
// source-reading regex — which is how a feature ends up correct, tested, and
// dead at one wiring line, at least twelve recorded times. Measured 2026-08-13:
// the file imports fine. What failed was ONE dependency, whose published
// `dist/index.js` re-exports from `"./lib/container"` with no extension. Node's
// ESM resolver refuses that; wrangler's bundler resolves it. Two symbols.
//
// So this is not a mock of the Worker or of anything the Worker does. It is a
// shim for a packaging quirk in somebody else's dist, and it exists so a test
// can drive the REAL router with the REAL dispatch and the REAL gates.

/** The base class `SiteBuildContainer` and `GameBuildContainer` extend. Nothing
 *  in a routing test ever instantiates one; it only has to be a class. */
export class Container {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

/**
 * ── AN OPT-IN COMPILER, AND ONLY WHEN A TEST ASKS FOR ONE ────────────────────
 *
 * `getContainer` THROWS by default and that default stays: a test that reaches a
 * container has left the layer this harness is for — routing, dispatch, gating —
 * and is about to wait on a build that will never come. Failing loudly beats a
 * mystery timeout, and beats a fake success that reads as a passing test of
 * something never exercised.
 *
 * But a whole class of question lives one step PAST the compile, and none of it
 * could be asked: what a message costs when it runs two rungs, whether the
 * routing call is billed once or once per rung, whether a second rung sees the
 * first one's changes, and — the one the owner asked for — whether two asks in
 * one message publish ONCE. Every one of those needs a publish that SUCCEEDS.
 *
 * So a test may install a compiler for the duration of one case. It answers the
 * one hop the publish spine makes (`http://build/build`) with the files it was
 * handed, which is what a real compile returns for an unchanged source, and
 * records every call so a test can count publishes. Everything else still
 * throws, so nothing can wander into an unstubbed hop and read a fake success.
 *
 * `installCompiler` RETURNS ITS OWN UNINSTALLER rather than a global reset,
 * because a test that forgets leaves every later test in this process compiling
 * against a stub — the fixture-in-a-different-shape trap, applied to the whole
 * suite at once.
 */
let COMPILER = null;

// `render` IS A REAL FIELD OF A REAL BUILD RESPONSE, and its absence here was a
// fixture quietly less capable than the thing it stands for. The container runs
// a browser over every route and returns that report — `deadSelectors`,
// `landmarks`, findings — and the publish spine now BRANCHES on it: a rule that
// matches no element withholds the publish. With no `render` in the stub that
// branch could never be taken, so the whole zero-match gate was untestable and a
// sweep deleting it survived. Passed per case rather than defaulted, so every
// existing caller keeps the response it already had.
export function installCompiler({ ok = true, error = "", render = null } = {}) {
  const calls = [];
  COMPILER = {
    calls,
    fetch: async (req) => {
      const url = String(req && req.url ? req.url : req);
      let body = {};
      try { body = JSON.parse(await req.text()); } catch { body = {}; }
      calls.push({ url, body });
      if (!url.includes("/build")) {
        // NOT THE HOP THIS STANDS IN FOR. Answered as a failure rather than a
        // plausible success: a stub that answers everything lets a test wander
        // past the thing it is checking.
        return new Response(JSON.stringify({ ok: false, error: "no stub for " + url }), { status: 503 });
      }
      if (!ok) return new Response(JSON.stringify({ ok: false, error: error || "compile failed" }), { status: 200 });
      // THE FILES BACK, WHICH IS WHAT AN UNCHANGED SOURCE REALLY COMPILES TO.
      // Inventing a dist here would be a fixture in a shape the pipeline never
      // produces, and this repo has paid for that one more than once.
      //
      // ECHOED WHOLE, WHATEVER SHAPE IT IS. The spine sends a path->source MAP,
      // not a list; a first draft here coerced it with `Array.isArray(...) ? ...
      // : []` and handed back an empty dist that every caller read as a
      // successful build of nothing. A fixture that quietly changes the shape it
      // was given is the same trap as one that invents a shape.
      const files = body.files || {};
      // THE RENDER REPORT, WHEN THE CASE ASKED FOR ONE. A function so a test can
      // answer differently on the second call — which is exactly what the
      // correction round needs: dead the first time, clean after the fix.
      const rep = typeof render === "function" ? render(calls.length) : render;
      return new Response(JSON.stringify({ ok: true, files, ...(rep ? { render: rep } : {}) }),
        { status: 200, headers: { "content-type": "application/json" } });
    },
  };
  return { calls, uninstall: () => { COMPILER = null; } };
}

export function getContainer(binding, name) {
  // A TEST-SUPPLIED NAMESPACE IS HONOURED THE WAY THE LIBRARY HONOURS THE REAL
  // ONE (2026-09-04): `binding.get(binding.idFromName(name))`, which is the
  // library's own two lines. It is what lets a case watch WHICH lane the
  // Worker fires a job at and what it sends — the job runner's fork — without
  // a compiler. An env with no such binding behaves exactly as before.
  if (binding && typeof binding.idFromName === "function" && typeof binding.get === "function") {
    return binding.get(binding.idFromName(name));
  }
  if (COMPILER) return COMPILER;
  throw new Error("the container is not available in a routing test — this request reached a real build");
}
