// Overwritten per build by build-server.mjs. Do not edit.
//
// It exists in the template so `site-header.tsx` has something to import and the
// template builds standalone. A build rewrites it with this site's own logo URL,
// or leaves it empty for a site that has none — which is every site until its
// owner attaches one.
//
// WHY A GENERATED MODULE RATHER THAN THE INJECTED `<meta>` NEXT TO IT.
// `site-meta.mjs` puts `site-slug` in the head at PUBLISH time, which is fine for
// a value only read when a fetch happens. A logo is RENDERED, so a component
// reading the meta tag would render without it on the server and with it in the
// browser: a hydration mismatch, and a header that visibly flips from the name to
// the logo on every page load. Baked into the bundle instead, the server render
// and the hydrated app agree, and there is nothing to flash.
//
// THAT REASONING IS WHY THE OTHER TWO MOVED HERE. `lang` and the favicon were
// applied by `applyIdentity` doing regex surgery on `index.html`, which Start
// does not produce — the document is `__root.tsx` now — so they are ordinary
// values a component renders, under exactly the rule above. It also removes the
// surgery: nothing to patch, no pattern to get wrong.
// WHICH SITE THIS IS. Baked rather than read at request time, and that is the
// load-bearing choice in the whole meta split: `siteSlug()` in `@/lib/rows`
// normally learns it from the `/s/<slug>/` path, and ON A CUSTOM DOMAIN THERE IS
// NO SUCH PATH — the site is served at `/` on the owner's own hostname. Without
// it every read and every form addresses whatever the build-time default is: a
// DIFFERENT site's API, silently, on the domain customers are actually given.
// From the bundle, so an R2 blip costs a link preview and never the site's data.
export const SITE_SLUG = "";
export const SITE_LOGO = "";
// The document's language. A REFUSAL RATHER THAN A DEFAULT lives one layer up in
// `normalizeLang` — a site whose language could not be established keeps
// whatever it had, and the template's own answer is English.
export const SITE_LANG = "en";
// The tab's mark. `/icon.svg` when the build wrote one from the business's
// initials, and the template's own `favicon.svg` otherwise — never overwritten,
// because this container is long-lived and the first site's mark would become
// every later brandless site's.
export const SITE_ICON = "/favicon.svg";
// The business's name, used as the document's DEFAULT title — a route that
// declares its own `head()` beats it. `setTitle` used to stamp this onto every
// non-home page at publish, after the fact; a default the routes can override is
// the same outcome with the ordering the right way round.
export const SITE_NAME = "App";
// WHICH BUILD THIS IS — the one value here that nothing renders. `src/server.ts`
// returns it as `x-site-build` on every response, and the platform waits for it
// to match what it just uploaded before calling a publish done: a script does
// not start serving the instant its upload is accepted, so without this the
// route reports success while the site still answers with the previous build.
// Empty in the template, because a standalone build is not a published site and
// has nothing to confirm.
export const SITE_BUILD = "";
