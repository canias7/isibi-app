// WHICH BUILD CONTAINER A REQUEST LANDS ON — ONE PER UNIT OF WORK.
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
// ── WHY THIS IS NO LONGER A BUCKET (2026-08-25, owner's call) ────────────────
//
// Until today this hashed every key into FIVE fixed lanes. The stated reason was
// that **what Cloudflare does past `max_instances` is "not documented on either
// container page, and the client library has no knowledge of the limit at all"**,
// so the boundary was "enforced somewhere we cannot see, in a way we cannot
// predict". Bucketing made it unreachable by construction.
//
// THE LITERAL HALF OF THAT WAS TRUE AND THE CONCLUSION WAS NOT. `max_instances`
// really does appear nowhere in `@cloudflare/containers` — but the library
// recognises the ceiling BY NAME and gives it a status of its own:
//
//     const NO_CONTAINER_INSTANCE_ERROR = 'there is no container instance that
//                                          can be provided to this durable object';
//     const RATE_LIMITED_ERROR          = 'you are requesting too many containers per second';
//
// handled in three places, as a 503 and a 429. So the boundary is not
// unpredictable at all: it is two named errors with two distinct statuses.
//
// AND THE CEILING IS 300x HIGHER THAN THE NUMBER WE PICKED. Cloudflare's own
// figures: an account may run 6 TiB of concurrent memory, 1,500 concurrent vCPU
// and 30 TB of concurrent disk; `standard-1` is 1/2 vCPU, 4 GiB, 8 GB. Memory
// binds first at **6 TiB / 4 GiB = 1,536 instances**, which is exactly what their
// changelog claims — "you can now run over 1,500 instances of the standard-1
// instance type concurrently". Five was never a platform limit. It was a guess
// made while the documentation was unclear.
//
// SO THE UNIT OF WORK GETS ITS OWN CONTAINER, and the wait a customer felt was
// never the container starting — measured 2026-08-25, a cold start is 2,453ms
// against 176ms warm. The wait was QUEUEING BEHIND SOMEBODY ELSE'S BUILD: over
// five lanes two simultaneous builds collided about one time in five, and six
// collided always, and a collision meant waiting out the whole ten-minute build
// in front.
//
// ── WHY `oneAtATime` STAYS ───────────────────────────────────────────────────
//
// It is not made redundant by this — it is made PRECISE. Two builds of ONE site
// still share a name, therefore one instance, therefore one working directory,
// and the build server wipes a shared `src/routes` and `dist` per build. That is
// how two builds destroyed each other on 2026-07-29. What changes is only that
// two builds of DIFFERENT sites no longer queue behind each other.
//
// ── THE KEY, AND WHY EACH CALL SITE CHOOSES ITS OWN ─────────────────────────
//
// Every caller already passes the right thing and none of them had to change:
// a site build and a site edit pass the SLUG (two edits of one site share an
// instance on purpose); a game BUILD passes the ACCOUNT, because a game names
// itself only after it compiles and there is nothing narrower in scope; the
// probes pass a literal, because a probe has no build to be keyed by.
//
// AND IT NEVER ANSWERS `undefined`. That is the one return value that would be
// catastrophic and silent: `getContainer(binding, undefined)` takes the default
// parameter and lands back on `cf-singleton-container` — the exact bug, restored
// invisibly, with every test green.

// HOW LONG A KEY MAY BE AND STILL BE USED AS ITSELF.
//
// SIXTY, BECAUSE THAT IS `cleanSlug`'S OWN CAP — `.slice(0, 60)` in worker.js —
// so every real site name reads as itself in a Cloudflare dashboard beside every
// other Durable Object on the account. A first draft said 48 and its comment
// claimed "every real site name is under this", which was false for any slug
// between 49 and 60 characters: those were hashed, and the dashboard showed a
// base36 number where the customer's site name should be. Caught by mutation —
// nothing asserted a long slug stays legible, so the number could be anything.
//
// It is a legibility bound, not a platform one: a Durable Object name may be up
// to 2048 bytes, so nothing here is close to refusing. Anything longer or
// stranger than this is hashed rather than refused.
const MAX_PLAIN_KEY = 60;

/**
 * FNV-1a over a key. NOT a sum of character codes — this repo already records
 * why, on the favicon hue: a sum hashes "ab" and "ba" identically, and two slugs
 * that are anagrams of each other are exactly the pair that would collide and
 * never separate.
 *
 * Exported so that property can be asserted directly rather than through the
 * name, where a collision would be invisible among the plain-key answers.
 */
export function keyHash(key) {
  // NOT COERCED. `String(["a","b"])` is `"a,b"` — the coercion this repo has
  // shipped as a real bug three times. A non-string is not a key.
  const s = typeof key === "string" ? key : "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // `Math.imul` because the FNV prime overflows 32 bits and `*` would go
    // through a double, losing the low bits that carry the mixing.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// THE NAME AN UNUSABLE KEY GETS, and it is deliberately NOT `build-h-0`.
//
// FNV-1a can answer 0, so `keyHash(s).toString(36)` can be the string `"0"` —
// which means a real site whose slug happened to hash to zero would share one
// container, and therefore one working directory, with every keyless caller.
// One chance in 4.29 billion, and free to make structurally impossible: this
// name carries no `k-`/`h-` marker at all, so neither branch can ever produce
// it. The danger being avoided is never a wrong container — it is `undefined`,
// which takes `getContainer`'s default parameter and restores the platform-wide
// singleton invisibly, with every test green.
const NO_KEY_NAME = "build-none";

/**
 * THE NAME TO HAND `getContainer` — one per key, and never `undefined`.
 *
 * A key that is already a safe short identifier is used AS ITSELF, so
 * `build-k-fold-lane-bakery` is legible in a dashboard beside every other
 * Durable Object on the account; anything else is hashed.
 *
 * THE TWO BRANCHES CANNOT COLLIDE, AND THE `k-` MARKER IS WHAT DOES THAT WORK.
 * A hashed name is base36 of a uint32, whose alphabet is `0-9a-z` — measured,
 * no hyphen — so `build-h-<hash>` can never contain the `k-` that every plain
 * name carries immediately after `build-`. The `h-` marker is therefore
 * BELT-AND-BRACES TODAY and is said so rather than deleted or falsely asserted:
 * a mutant removing it survives, because what actually separates the branches
 * is a property of the OTHER one. It becomes load-bearing the moment the plain
 * branch's marker changes or a third branch is added, which is one edit away.
 */
export function laneName(key) {
  const s = typeof key === "string" ? key : "";
  if (!s) return NO_KEY_NAME;
  if (s.length <= MAX_PLAIN_KEY && /^[a-z0-9][a-z0-9-]*$/.test(s)) return "build-k-" + s;
  return "build-h-" + keyHash(s).toString(36);
}
