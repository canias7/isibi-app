// WHICH BUILD CONTAINER A REQUEST LANDS ON.
//
// THE BUG THIS EXISTS TO END. `getContainer(binding)` takes an optional name and
// every call site on the platform omitted it — and the library's default is the
// literal string `cf-singleton-container`:
//
//     export function getContainer(binding, name = singletonContainerId) {
//       return binding.get(binding.idFromName(name));
//     }
//
// One name is one Durable Object is ONE container instance. So every build the
// platform has ever run — every site, every customer, every cheap edit, every
// game — resolved to the same instance, and `oneAtATime` inside the build server
// then serialised the whole platform behind whichever one arrived first. A build
// that hangs does not stall one customer, it queues everybody.
//
// THE DESIGN WAS ALREADY RIGHT AND ITS SECOND HALF WAS NEVER SWITCHED ON.
// `builder/build-server.mjs`'s own comment says so in as many words:
//
//     "Serialised rather than given a directory each ... Cloudflare scales
//      container INSTANCES; this only has to make one instance honest."
//
// `oneAtATime` protects an instance from itself — the build server wipes a
// SHARED `src/routes` and `dist` per build, which is how two builds destroyed
// each other on 2026-07-29. It was never meant to be the platform's queue. What
// was missing is the half that hands different work to different instances.
//
// `max_instances` HAS THEREFORE NEVER BEEN REACHABLE. Both classes declare 5 and
// exactly 1 has ever existed.
//
// ── WHY A BUCKET RATHER THAN THE KEY ITSELF ──────────────────────────────────
//
// The obvious fix is `getContainer(binding, slug)`: one instance per site, total
// concurrency. It is rejected for one measured reason — **what Cloudflare does
// when a Worker asks for more instances than `max_instances` allows is not
// documented on either container page, and the client library has no knowledge
// of the limit at all** (grep it: `max_instances` appears nowhere in
// `@cloudflare/containers`). So the boundary is enforced somewhere we cannot
// see, in a way we cannot predict, on the platform's primary feature.
//
// Hashing into a FIXED number of lanes makes that boundary unreachable. The
// instance count is bounded by construction, so there is no limit to be refused
// at — and the failure mode of a collision is the one thing already proven to
// work: two builds share a lane, share an instance, and `oneAtATime` serialises
// them exactly as it serialises the whole platform today. **A collision degrades
// to today's behaviour rather than to an undocumented error**, which is the
// whole argument.
//
// ── WHY `oneAtATime` STAYS ───────────────────────────────────────────────────
//
// Two keys can hash to one lane, and a lane is one instance with one working
// directory. Removing the chain to "finish the job" reintroduces the 2026-07-29
// failure — one build deleting another's `src/routes` mid-compile — on a path
// that now looks concurrent and is not.
//
// ── THE KEY ──────────────────────────────────────────────────────────────────
//
// FNV-1a, NOT a sum of character codes. This repo already records why, on the
// favicon hue: a sum hashes "ab" and "ba" identically, and two slugs that are
// anagrams of each other (`fold-lane` / `lane-fold`) are exactly the pair that
// would collide and never separate.
//
// AND IT NEVER ANSWERS `undefined`. That is the one return value that would be
// catastrophic and silent: `getContainer(binding, undefined)` takes the default
// parameter and lands back on `cf-singleton-container` — the exact bug, restored
// invisibly, with every test green. Anything unusable answers lane 0, which is a
// real lane.

// HOW MANY LANES. This MUST equal `max_instances` in wrangler.jsonc, and
// `test/build-lane.test.mjs` reads both files and asserts it: set it higher and
// the undocumented boundary is reachable again, which is the one thing the
// bucketing exists to prevent; set it lower and we pay for instances nothing can
// ever use.
//
// FIVE BECAUSE FIVE IS WHAT ALREADY DEPLOYS. Raising the ceiling is one number
// in two places and is now guarded — but a `wrangler.jsonc` value the platform
// refuses is not a slower build, it is NO DEPLOY AT ALL (three merges shipped
// nothing that way on 2026-08-07), and `max_instances: 5` is proven. The change
// worth making today is going from ONE lane to five; the cap is a separate,
// verifiable step.
export const BUILD_LANES = 5;

/**
 * WHICH LANE A KEY BELONGS TO — 0 .. lanes-1, always.
 *
 * Deterministic: the same key is always the same lane, which is what makes
 * `oneAtATime` correct for two builds of one site.
 */
export function buildLane(key, lanes = BUILD_LANES) {
  // A NONSENSE LANE COUNT IS ONE LANE, not a crash and not a modulo by zero.
  // This is reached on the build path of every site on the platform; refusing
  // here would turn a bad constant into every build failing, where falling back
  // costs exactly the behaviour we have today.
  const n = Number.isInteger(lanes) && lanes > 0 ? lanes : 1;
  // NOT COERCED. `String(["a","b"])` is `"a,b"` — the coercion this repo has
  // shipped as a real bug three times. A non-string is not a key.
  const s = typeof key === "string" ? key : "";
  if (!s) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // `Math.imul` because the FNV prime overflows 32 bits and `*` would go
    // through a double, losing the low bits that carry the mixing.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

/**
 * THE NAME TO HAND `getContainer`.
 *
 * Prefixed, so a lane is identifiable in a Cloudflare dashboard rather than
 * being a bare digit beside every other Durable Object name on the account.
 */
export function laneName(key, lanes = BUILD_LANES) {
  return "build-" + buildLane(key, lanes);
}
