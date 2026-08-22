// Uploading a site's Worker into a dispatch namespace.
//
// Workers for Platforms: each customer site is its own script inside a
// namespace we own, and the platform Worker forwards a request to the right
// one by name. This module is the API half — every side effect injected, so
// the decisions are testable with no Cloudflare account, which is what the
// rest of this codebase does with `publish-pages.mjs` and `site-provision.mjs`.
//
// WHY A SCRIPT PER SITE, restated because it is the first thing anybody tries
// to design away: the Workers runtime has no loader. No `eval`, no dynamic
// import of anything not bundled at upload time. So a single Worker that
// renders whichever site was asked for cannot exist, whatever we would prefer.

const API = "https://api.cloudflare.com/client/v4";

/**
 * The ceiling on one Cloudflare API call — two minutes.
 *
 * ANOTHER UNBOUNDED AWAIT ON THE BUILD PATH, found while narrowing run 13's
 * hang. The upload PUTs the site's whole packaged script — near a megabyte, as a
 * multipart form — to a third-party API, and it carried no signal at all, one
 * step after everything around it had been bounded. That is exactly the class
 * `build-budget.mjs` was written about: a per-call cap only bounds the calls
 * somebody thought of, and this was not one of them.
 *
 * IT IS *NOT* WHAT RUN 13 HUNG ON, and saying so is the point of measuring
 * rather than assuming. `putSiteWorker` runs after the `og` mark and that build
 * stopped at `fonts`, so this is eliminated as the cause and fixed on its own
 * merits — an unbounded third-party call on the build path is a bug whether or
 * not it is today's bug.
 *
 * FLAT RATHER THAN COMPOSED WITH THE BUILD BUDGET, deliberately: three of the
 * four callers are not on a build path and have no clock, and the deadline one
 * layer up bounds the customer's wait regardless. What this buys is a call that
 * fails with a diagnosis instead of sitting there.
 */
export const DISPATCH_CALL_MS = 120000;

/**
 * Upload one site's script.
 *
 * MULTIPART, because that is the only shape the endpoint takes for a module
 * Worker: a `metadata` part naming the main module and its bindings, plus the
 * module itself. A JSON body is refused.
 *
 * BINDINGS TRAVEL WITH THE UPLOAD. A dispatch-namespace script does not
 * inherit the platform Worker's bindings — it gets what it was uploaded with,
 * and nothing else. That is the property that makes this safe: a site's script
 * can reach the assets bucket and cannot reach the credit ledger, the secrets
 * key, or another customer's anything, because it was never handed them.
 */
export async function uploadSiteWorker({ accountId, namespace, name, code, bucket, apiToken }, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (!accountId || !namespace || !name || !code) return { ok: false, status: 0, error: "missing accountId, namespace, name or code" };
  if (!apiToken) return { ok: false, status: 0, error: "no api token" };

  const metadata = {
    main_module: "index.js",
    compatibility_date: COMPAT_DATE,
    // REQUIRED, NOT OPTIONAL. Start's server bundle imports `node:async_hooks`
    // (its request-scoped storage) and `node:stream` (the streaming SSR
    // transform), and workerd refuses an unknown module at STARTUP — so without
    // this every uploaded script fails to boot and every page of every site on
    // the rendered path answers an error, while the upload itself reports 200.
    //
    // Named rather than relying on the compatibility date: `nodejs_compat` has
    // never been enabled by a date alone, and a date that quietly started
    // implying it would be a behaviour change nobody asked for.
    compatibility_flags: ["nodejs_compat"],
    bindings: bucket ? [{ type: "r2_bucket", name: "SITES", bucket_name: bucket }] : [],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  // The part NAME must match `main_module`, or the upload succeeds and the
  // script has no entrypoint — a 200 followed by every request failing.
  form.append("index.js", new Blob([code], { type: "application/javascript+module" }), "index.js");

  let r;
  try {
    r = await fetchImpl(
      `${API}/accounts/${encodeURIComponent(accountId)}/workers/dispatch/namespaces/${encodeURIComponent(namespace)}/scripts/${encodeURIComponent(name)}`,
      // BOUNDED — see DISPATCH_CALL_MS. The catch below already turns a throw
      // into `status: 0` with the reason on it, so an abort arrives as an
      // upload that did not happen, which is exactly what it is.
      { method: "PUT", headers: { authorization: "Bearer " + apiToken }, body: form, signal: AbortSignal.timeout(DISPATCH_CALL_MS) },
    );
  } catch (e) {
    // A THROW IS NOT A REFUSAL. The network failing and Cloudflare saying no
    // are different outcomes — the first is worth retrying and the second is
    // not — so the status separates them rather than one shared `ok: false`.
    return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 300) };
  }

  return await verdict(r, [200, 201]);
}

/**
 * Remove a site's script.
 *
 * 404 IS DONE. Deleting a site drops its Neon project, its R2 objects and its
 * registration row, and this is one more thing in that sequence — so a script
 * that is already gone is the goal, not a failure. The same rule
 * `site-teardown.mjs` settled for Neon projects, and for the same reason:
 * treating already-gone as an error means the cleanup never reports success
 * and somebody goes looking for a leak that is not there.
 *
 * 401 AND 403 ARE NEVER DONE, equally deliberately. During a token rotation
 * every call answers 403, and a sweeper that read that as success would drop
 * the only record of every script at the moment it cannot see Cloudflare.
 */
export async function deleteSiteWorker({ accountId, namespace, name, apiToken }, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (!accountId || !namespace || !name) return { ok: false, status: 0, error: "missing accountId, namespace or name" };
  if (!apiToken) return { ok: false, status: 0, error: "no api token" };

  let r;
  try {
    r = await fetchImpl(
      `${API}/accounts/${encodeURIComponent(accountId)}/workers/dispatch/namespaces/${encodeURIComponent(namespace)}/scripts/${encodeURIComponent(name)}`,
      // Bounded like the upload. A delete that hangs is worse than one that
      // fails: `deleteSiteFor` removes the ownership row LAST precisely so a
      // failure stays retryable, and a hang never reaches that decision.
      { method: "DELETE", headers: { authorization: "Bearer " + apiToken }, signal: AbortSignal.timeout(DISPATCH_CALL_MS) },
    );
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 300) };
  }

  return await verdict(r, [200, 204, 404], [404]);
}

/**
 * Wait until the namespace is actually serving the script we just uploaded.
 *
 * AN ACCEPTED UPLOAD IS NOT A LIVE SCRIPT. Measured on two consecutive live
 * runs: the publish route returned 200, the site was read 0.2s later, and it
 * answered with the PREVIOUS build's document — the same stylesheet href, so a
 * colour change looked as though it had not happened. A read 1.4s after another
 * publish was fresh. The window is short, and everything automated lands inside
 * it: the builder reloads its preview the moment the route returns, so the
 * customer sees their old site and concludes the change did nothing. Then they
 * ask again, and the look lane correctly answers "you already have that".
 *
 * SO THE PUBLISH WAITS, rather than the preview guessing at a delay. A timed
 * guess is right until the day it is not, and its failure is silent; asking the
 * dispatch what it is serving is the same question the visitor asks.
 *
 * THROUGH THE STUB, NOT OVER THE NETWORK. `stubFor` is `env.SITE_WORKERS.get`,
 * which is exactly how the serve path reaches a site — so this measures the
 * real thing with no subrequest to our own hostname, which is the shape
 * Cloudflare's loop protection exists to refuse.
 *
 * BEST-EFFORT, ALWAYS. Every failure — no binding, a throwing stub, a script
 * that never answers with this id — returns `confirmed: false` and NOTHING
 * else. The site is published and the script is uploaded either way; refusing
 * a publish because a confirmation was slow would turn a cosmetic lag into a
 * lost edit, which is the trade nobody would make.
 *
 * THE PROBE ASKS FOR A FILE, NOT A PAGE, and that is a cost decision. The
 * entry's asset branch is its FIRST branch: one R2 get, a miss, a 404 — no
 * React render, no liveness probe, no meta read. Asking for `/` instead would
 * render a whole document per attempt, and this polls.
 *
 * The name has an extension so the entry classifies it as a file, and its
 * being absent is the point — the answer is a 404 either way and only the
 * header is read. `x-site-build` rides on EVERY response the entry makes
 * including that 404, deliberately: a first build uploads its script while the
 * site is not browsable yet, so a document-only stamp would be invisible on
 * exactly the build that most needs confirming.
 */
const PROBE_PATH = "/__build.txt";

export async function confirmSiteWorker({ stubFor, name, build, origin = "https://site.invalid" }, deps = {}) {
  const wait = deps.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now || (() => Date.now());
  const budgetMs = deps.budgetMs == null ? 6000 : deps.budgetMs;
  const stepMs = deps.stepMs == null ? 250 : deps.stepMs;
  // NOTHING TO CONFIRM IS NOT A FAILURE TO CONFIRM. A caller with no binding,
  // no script name or no stamp is a deployment where this feature is simply not
  // on — every site built before it, and the whole platform if the container is
  // rolled back — and it must behave exactly as it did before this existed.
  if (typeof stubFor !== "function" || !name || !build) return { confirmed: false, ms: 0, tried: 0 };
  const t0 = now();
  let tried = 0;
  for (;;) {
    tried++;
    try {
      const stub = stubFor(name);
      const res = stub && (await stub.fetch(new Request(origin + PROBE_PATH, { method: "GET" })));
      // THE HEADER IS THE ONLY EVIDENCE READ. Not the status, which is 404 on a
      // site whose files are not written yet, and not the body, which is a
      // whole rendered page we would be buffering for nothing.
      if (res && res.headers && res.headers.get("x-site-build") === build) {
        return { confirmed: true, ms: now() - t0, tried };
      }
    } catch {
      // A THROWING STUB IS A RETRY, NOT AN ANSWER. The commonest reason to
      // throw here is the namespace not yet holding the name at all, which is
      // the exact state being waited out.
    }
    if (now() - t0 + stepMs >= budgetMs) return { confirmed: false, ms: now() - t0, tried };
    await wait(stepMs);
  }
}

/**
 * Did Cloudflare actually do it?
 *
 * THE HTTP STATUS IS NOT THE ANSWER ON THIS API, and reading it as though it
 * were is what let a delete report success while the script kept serving.
 * Cloudflare's v4 endpoints answer **200 with `{"success": false, "errors":
 * […]}`** for a class of refusals — so a status-only check turns "we refused"
 * into "done", silently, which is precisely the shape `GRANT USAGE ON SCHEMA
 * auth` had: a statement that reported success and changed nothing.
 *
 * MEASURED, not theorised: a real `build smoke` run deleted a site — 21 R2
 * objects gone, the Neon project dropped, the ownership row removed — and the
 * site was still answering 200 fifteen minutes later, because its script was
 * never removed and nothing said so.
 *
 * `success` IS ONLY BELIEVED WHEN IT IS PRESENT AND FALSE. A 204 carries no
 * body at all, and a body that will not parse is not evidence of refusal —
 * treating either as a failure would turn a working delete into a retry loop.
 * So the status still has to be in the accepted list, and `success: false` can
 * only ever DEMOTE a status that was otherwise fine.
 */
async function verdict(r, okStatuses, conclusive = []) {
  if (!okStatuses.includes(r.status)) {
    return { ok: false, status: r.status, error: (await readError(r)).slice(0, 300) };
  }
  // A STATUS THE BODY CANNOT ARGUE WITH. 404 on a delete means the script is
  // not there, which IS the goal — and Cloudflare sends `success: false` with
  // it, as it does for every error status. Without this, "already gone" reads
  // as a refusal, and since most deletes are of sites that never had a script
  // the cleanup would report failure on its commonest path. Found by the test
  // written for the fix above, not by reasoning about it.
  if (conclusive.includes(r.status)) return { ok: true, status: r.status, error: "" };
  let body = null;
  try { body = await r.clone().json(); } catch { /* 204, or not JSON — no opinion */ }
  if (body && body.success === false) {
    const errs = (body.errors || []).map((e) => (e.code ? e.code + ": " : "") + (e.message || "")).join("; ");
    return { ok: false, status: r.status, error: ("refused with " + r.status + ": " + (errs || JSON.stringify(body))).slice(0, 300) };
  }
  return { ok: true, status: r.status, error: "" };
}

/**
 * Cloudflare's own reason, not ours.
 *
 * Every Cloudflare error body is `{errors: [{code, message}]}`, and the whole
 * value of surfacing it is that the codes are specific — 10000 is a token
 * without the scope, 1404 is a product not enabled on the account, and those
 * need completely different actions. A generic "upload failed" sends the
 * reader to the wrong one, which this repo has already paid for once by
 * telling somebody to add an SSL permission that could not have helped.
 */
async function readError(r) {
  try {
    const j = await r.json();
    const errs = (j && j.errors) || [];
    if (errs.length) return errs.map((e) => (e.code ? e.code + ": " : "") + (e.message || "")).join("; ");
    return JSON.stringify(j).slice(0, 300);
  } catch {
    try { return await r.text(); } catch { return "HTTP " + r.status; }
  }
}

// PINNED, not "today". A compatibility date is what decides which runtime
// behaviours a script gets, so leaving it floating means an upload months
// apart produces two scripts that behave differently from identical source —
// and the second one is a customer's live site changing for no reason anybody
// can point at.
export const COMPAT_DATE = "2026-08-16";
