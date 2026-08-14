// Drive the REAL Worker, in a plain Node test, with no bindings.
//
// WHAT THIS IS FOR, and it is the most-repeated failure in this repo. A feature
// gets built in a module, tested there properly, and the ONE line in `worker.js`
// that connects it is missing or wrong — so everything passes and the feature is
// dead. The Attach button. The Builder picker. `dm2` (custom domains). Version
// history. Free text editing. Page deletion. At least twelve times.
//
// Every guard on that layer is a source-reading regex, because the file was
// believed to be unimportable. It is not — see `cf-containers.mjs` for the one
// dependency that was actually blocking it — and a regex is a poor instrument
// besides: two of four mutation survivors in the last sweep were regexes
// matching a sibling line or a comment.
//
// WHAT A ROUTING TEST CAN AND CANNOT SEE. With `env` empty, nothing that talks
// to Supabase, Neon, R2 or a model can run. That is the point rather than a
// limitation: what is under test is whether a request REACHES its handler and
// meets the gate it should, which is exactly where those twelve bugs lived.
//
//   404  the router fell through — there is no such route
//   401  the route exists and correctly refused an unauthenticated caller
//
// That distinction is the whole instrument. It is precisely what nobody could
// tell when `/versions`, `/text` and `/domains` were answering the bottom 404 to
// their own owner, and what a live probe could not tell either, because
// `assertOwner` answers 404 for a slug that is not yours.
import { register } from "node:module";

let cached = null;

/**
 * The whole worker MODULE, for tests that drive an exported function directly
 * — `siteWebResearch` was the first: the one paid executor in the build no
 * test had ever run, because only `default` was surfaced here.
 */
export async function loadWorkerModule() {
  if (cached) return cached;
  register(new URL("./worker-loader.mjs", import.meta.url), import.meta.url);
  cached = await import(new URL("../../worker.js", import.meta.url).href);
  return cached;
}

/** The Worker's default export — `{ fetch(request, env, ctx) }` — loaded once. */
export async function loadWorker() {
  return (await loadWorkerModule()).default;
}

/** A `ctx` with the two methods the Worker uses. `waitUntil` keeps the promise
 *  so a test can await detached work rather than racing it. */
export function makeCtx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), passThroughOnException() {}, pending };
}

/**
 * One request against the real router.
 *
 * `env` defaults to EMPTY, deliberately. A binding supplied here is a promise
 * that something beyond routing will run, and the moment a test needs one it
 * should say so at the call site rather than inheriting it from a shared
 * fixture nobody reads.
 */
export async function hit(path, { method = "GET", headers, body, env = {}, origin = "https://gofarther.dev" } = {}) {
  const worker = await loadWorker();
  const req = new Request(origin + path, { method, headers, body });
  const res = await worker.fetch(req, env, makeCtx());
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not every route answers JSON */ }
  return { status: res.status, text, json, headers: res.headers };
}

/**
 * Did the router fall through?
 *
 * The bottom of the router answers `404 {"error":"not found"}` for a path it has
 * no route for. A route that EXISTS and refuses — 401 unauthenticated, 403, 405
 * on the wrong verb — is reachable, which is what these tests ask about.
 *
 * Matched on the body and not on the status alone: a real handler is entitled to
 * answer 404 (`assertOwner` does, on purpose, so a stranger cannot enumerate
 * slugs), and calling that unreachable would be exactly the confusion this
 * harness exists to end.
 */
export const NOT_FOUND = /"error"\s*:\s*"not found"/;
export const isUnrouted = (r) => r.status === 404 && NOT_FOUND.test(r.text);
