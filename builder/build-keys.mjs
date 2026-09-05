// THE CONTAINER'S API KEYS — TAKEN OUT OF THE ENVIRONMENT AT STARTUP.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// The model call is moving into the container, so the container needs the two
// provider keys. The container also EXECUTES MODEL-WRITTEN CODE: the render
// check builds the site's own server bundle — which IS the model's
// `src/routes/*.tsx` — and runs it in a child process to render each page.
//
// Both of the container's spawn paths hand that child the whole environment,
// MEASURED rather than assumed:
//
//   build-server.mjs:484  runStep(..., { env: { ...process.env, ...(env || {}) } })
//   site-ssr.mjs:105      spawn(..., { env: env || process.env })   ← no caller passes one
//
// So without this file, `process.env.ANTHROPIC_API_KEY` is readable from inside
// model-written page code, in a container with proven outbound egress to both
// providers. The privilege drop does not help: dropping to an unprivileged uid
// stops the child WRITING, and does nothing at all about what it can READ out of
// its own environment or send over the network.
//
// ── WHY A SCRUB AT STARTUP RATHER THAN AT EVERY SPAWN ───────────────────────
//
// Because a guard every spawn site has to remember is one a spawn site
// eventually forgets — this repo's own `safe-image` argument, and the reason
// `spam-guard` mounts once at the app root instead of being a component the
// generator must place. There are two spawn sites today, a third is one commit
// away, and the failure when somebody forgets is SILENT: the build works
// perfectly and the key is readable.
//
// Deleting the names once, before anything can spawn, covers every child that
// exists and every child added later, BY CONSTRUCTION. There is no list of
// spawn sites to keep in step, because the thing being protected is gone from
// the environment the moment this module is evaluated.
//
// ── THAT `delete` REALLY IS A SCRUB, MEASURED FOUR WAYS ─────────────────────
//
// Node's `process.env` is not a plain object; deleting from it calls the real
// `unsetenv`. Driven before this was written, with a fake secret:
//
//   our own view after delete      → undefined
//   Object.keys(process.env)       → absent
//   child spawned with no `env`    → undefined
//   child spawned `{...process.env}` → undefined
//   /proc/self/environ IN THE CHILD → 0 hits
//
// The last one is the one that matters: it is the OS environment block, not a
// JavaScript view of it, so nothing the child does can recover the value.
//
// ── AND THE ENTRYPOINT IS WHY STARTUP IS EARLY ENOUGH ──────────────────────
//
// The site image's `Dockerfile` (at the repository root since 2026-09-04)
// ends `CMD ["node", "build-server.mjs"]` — no shell, no
// sibling process, no wrapper. So the build service is the first thing in the
// container to see the environment, and an import-time delete happens before it
// listens on a port, let alone before a build can spawn anything.

import { SECRET_ENV as KEY_ENV_NAMES } from "./build-call.mjs";

/** The names the container is handed and must not pass on.
 *
 * DERIVED FROM `build-call.mjs`, NOT RESTATED, and the reason is the one-reading
 * rule that module already lives under: the Worker reads these names off its
 * bindings AND sets them on the container's start config, and the container
 * takes them out of `process.env`. A second spelling here would mean the
 * container scrubbing one name while the Worker set another — a key left in the
 * environment, with every test green, which is the exact failure this file
 * exists to prevent.
 *
 * A LIST RATHER THAN A PREFIX CONVENTION, so the three surfaces keep ONE
 * spelling per secret rather than a transport name and a read name.
 *
 * WHAT STOPS THE LIST GOING STALE is not memory. A secret that is not on it can
 * only be USED by naming it somewhere else under `builder/`, and
 * `test/build-keys.test.mjs` fails on any such read. So the list cannot fall
 * behind what the container actually uses: the guard goes red first.
 */
export const SECRET_ENV = Object.values(KEY_ENV_NAMES);

/**
 * Read the secrets out of an environment and REMOVE them from it.
 *
 * @param {Record<string, string|undefined>} env  mutated in place
 * @param {string[]} names
 * @returns {Record<string, string>} only the names that carried a usable value
 *
 * DELETED UNCONDITIONALLY, including when the value is absent, empty, or not a
 * string. "We did not recognise it, so we left it there" is the wrong
 * direction: an unrecognised value is still bytes a child can read and send,
 * and the one thing we know about a name on this list is that no child of ours
 * has any business seeing it. The RETURN is the half that is conditional — an
 * empty string is not a key, and handing one on produces a request with an
 * empty Authorization header, which some providers answer 200 to with degraded
 * data rather than refusing.
 *
 * PURE APART FROM THE MUTATION, so it can be driven against a fake object in a
 * test. The effect on the real `process.env` happens once, below.
 */
export function takeKeys(env, names = SECRET_ENV) {
  const out = {};
  const src = env || {};
  for (const name of names) {
    const v = src[name];
    if (typeof v === "string" && v) out[name] = v;
    delete src[name];
  }
  return out;
}

/** The container's keys, taken at import time.
 *
 * `keysFrom(BUILD_KEYS)` in `build-call.mjs` reads the same two names off this
 * that it reads off the Worker's `env`, so neither surface learns a second
 * spelling and the call site is identical on both.
 */
export const BUILD_KEYS = takeKeys(process.env);
