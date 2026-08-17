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
      { method: "PUT", headers: { authorization: "Bearer " + apiToken }, body: form },
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
      { method: "DELETE", headers: { authorization: "Bearer " + apiToken } },
    );
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 300) };
  }

  return await verdict(r, [200, 204, 404], [404]);
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
