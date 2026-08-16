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

  if (r.status === 200 || r.status === 201) return { ok: true, status: r.status, error: "" };
  return { ok: false, status: r.status, error: (await readError(r)).slice(0, 300) };
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

  if (r.status === 200 || r.status === 204 || r.status === 404) return { ok: true, status: r.status, error: "" };
  return { ok: false, status: r.status, error: (await readError(r)).slice(0, 300) };
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
