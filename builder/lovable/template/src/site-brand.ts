// Overwritten per build by build-server.mjs. Do not edit.
//
// It exists in the template so `site-header.tsx` has something to import and the
// template builds standalone. A build rewrites it with this site's own logo URL,
// or leaves it empty for a site that has none — which is every site until its
// owner attaches one.
//
// WHY A GENERATED MODULE RATHER THAN THE INJECTED `<meta>` NEXT TO IT.
// `site-meta.mjs` puts `site-slug` in the head at PUBLISH time, which is fine for
// a value only read when a fetch happens. A logo is RENDERED — and every route is
// prerendered to HTML before the publish step runs, so a component reading the
// meta tag would render without it on the server and with it in the browser: a
// hydration mismatch, and a header that visibly flips from the name to the logo
// on every page load. Baked into the bundle instead, the prerendered HTML and the
// hydrated app agree, and there is nothing to flash.
export const SITE_LOGO = "";
