// The one thing a site's script needs a name for.
//
// THIS FILE USED TO BE THE PACKAGING STEP — it produced a `site-config.js`
// holding the HTML shell, the slug and the route list, which a hand-written
// `site-worker/entry.js` read to serve documents out of R2. TanStack Start
// replaced all of it: the document is `__root.tsx` rendered per request by
// `src/server.ts`, which Start's own build bundles, so there is no shell to
// splice and no config to generate.
//
// WHAT WENT WITH IT: `siteConfigModule`, `canServeAsWorker`, `shellIsUsable`,
// and therefore the `[object Object]` failure class — `String()` turned a dist
// entry into fifteen literal characters and every page served them as its whole
// document, past a typecheck, a bundle, a size check, and an assertion that
// matched the entry file's own copy of the string it was looking for.
//
// KEPT AS ITS OWN MODULE rather than folded into `worker.js`: the name is the
// address a script is uploaded to, overwritten at and removed from, so it is
// read by the platform Worker and by the dispatch tests, and `worker.js` is the
// one file neither can import cheaply.

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
