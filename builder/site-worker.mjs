// Packaging a built site into a Worker.
//
// The half of the request-time-rendering move that is a pure function, kept
// out of the container and out of `worker.js` so all of it is testable with no
// R2, no esbuild and no Cloudflare account — the shape `publish-pages.mjs` and
// `site-provision.mjs` already use.
//
// WHAT THIS PRODUCES is one small module, `site-config.js`, holding the three
// things the runtime in `site-worker/entry.js` needs and cannot look up: the
// HTML shell, the slug, and the site's own route list. Everything else in the
// script is the SSR bundle the container already builds.

/**
 * The per-site config module.
 *
 * `JSON.stringify` FOR EVERY VALUE, including the slug. The shell is a whole
 * HTML document going into a JavaScript string literal — backticks, `${`,
 * quotes and newlines are all ordinary characters in it, and hand-quoting a
 * document is how a build starts emitting a script that does not parse. The
 * slug is ours and matches `[a-z0-9-]`, so quoting it changes nothing today;
 * it is quoted anyway because a value that is safe only because of a filter
 * somewhere else is one edit away from not being.
 *
 * ROUTES MAY BE EMPTY and that is a real state, not a failure: a site built
 * before the route manifest existed has none, and `isKnownRoute` reads an
 * empty list as "no opinion" and renders everything. Passing `null` and
 * passing `[]` therefore mean the same thing here, deliberately — there is no
 * third answer for the runtime to get wrong.
 */
export function siteConfigModule({ shell, slug, routes } = {}) {
  const list = Array.isArray(routes) ? routes.filter((r) => typeof r === "string") : [];
  return [
    "// Generated per site by site-worker.mjs. Do not edit.",
    "export const SHELL = " + JSON.stringify(String(shell || "")) + ";",
    "export const SLUG = " + JSON.stringify(String(slug || "")) + ";",
    "export const ROUTES = " + JSON.stringify(list) + ";",
    "",
  ].join("\n");
}

/**
 * Can this build be served by a Worker at all?
 *
 * REFUSED RATHER THAN UPLOADED BROKEN. A script that cannot render is worse
 * than the static files it replaces, because the static files at least serve
 * the bundle — so the caller keeps publishing to R2 when this says no, and the
 * customer's site is exactly what it would have been.
 *
 * The two things it needs are the shell (there is nothing to serve without it)
 * and the SSR bundle (there is nothing to render with). Anything else missing
 * degrades rather than refuses.
 */
export function canServeAsWorker({ shell, ssr } = {}) {
  const s = String(shell || "");
  if (!s) return { ok: false, why: "no index.html in the build" };
  if (!s.includes('<div id="root">')) return { ok: false, why: "the shell has no root element to render into" };
  if (!String(ssr || "")) return { ok: false, why: "no SSR bundle — nothing to render with" };
  return { ok: true, why: "" };
}

/**
 * The name a site's script takes in the dispatch namespace.
 *
 * ONE SITE, ONE NAME, derived rather than stored: a second place recording
 * which script belongs to which site is a second thing that can disagree with
 * `site_backends`, and the failure would be uploading over somebody else's
 * site. The slug is already unique across the platform and already claimed by
 * whoever built it first, so it is the natural key.
 *
 * PREFIXED, because a dispatch namespace is a flat space we may later put
 * something other than a customer site into, and an unprefixed name makes that
 * collision silent.
 */
export function scriptNameFor(slug) {
  const s = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return s ? "site-" + s : "";
}
