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
 * DELIBERATELY THROWS. A test that reaches a container has left the layer this
 * harness is for — routing, dispatch, gating — and is about to wait on a build
 * that will never come. Failing loudly beats a mystery timeout, and beats a
 * fake success that reads as a passing test of something never exercised.
 */
export function getContainer() {
  throw new Error("the container is not available in a routing test — this request reached a real build");
}
