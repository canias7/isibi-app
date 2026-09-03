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
// The animated mark and the QR code, both overwritten per build like the logo.
// EMPTY IS THE ORDINARY VALUE and it is a real answer: a page renders neither
// unless the site actually has one. They are declared here so a page that uses
// them compiles in the template too — a binding that only exists after a build
// is a page that builds on the platform and not on a developer's machine.
export const SITE_ANIMATED = "";
export const SITE_QR = "";
export const SITE_QR_LABEL = "";
// EVERY QR CODE THE SITE CARRIES, BY NAME (2026-09-03, a site carries several):
// `SITE_QRS.wifi` is `{ src, label }` for the code called `wifi`. `SITE_QR` and
// `SITE_QR_LABEL` above still name the FIRST one, so a page written before
// there was a list keeps working. Empty in the template for the reason the
// three above are: a page using it must build standalone.
export const SITE_QRS: Readonly<Record<string, { src: string; label: string }>> = {};
// The document's language. A REFUSAL RATHER THAN A DEFAULT lives one layer up in
// `normalizeLang` — a site whose language could not be established keeps
// whatever it had, and the template's own answer is English.
export const SITE_LANG = "en";
// WHICH WAY THE PAGE READS. Derived from the language by `dirFor`, never stored
// and never asked for — the script decides, so a second value here could only
// ever disagree with the tag above it.
//
// THE KIT WAS SWEPT ONTO LOGICAL UTILITIES FOR THIS. `ml-4` is a left margin
// whichever way the page reads; `ms-4` is a margin on the side the text starts.
// The two are byte-identical in LTR — measured over all 96 mappings the kit
// uses, so the sweep changed nothing about any site the platform has published —
// and only the logical one mirrors. Without it `dir="rtl"` would flip the text
// and leave every margin, padding, border and offset on the wrong side, which
// reads as a badly-made site rather than an honest limit.
//
// ANNOTATED for the reason `SITE_PAGE_TRANSITION` is: an unannotated const has the LITERAL
// type `"ltr"`, so comparing it with `"rtl"` is `TS2367` and nothing compiles.
export const SITE_DIR: "ltr" | "rtl" = "ltr";
// EVERY LANGUAGE THIS SITE SERVES BEYOND ITS OWN, with the URL segment each one
// lives under. Empty on a site with one language, which is every site published
// before 2026-08-19 and the ordinary case for ever after — so `__root.tsx` finds
// nothing, falls back to the two constants above, and nothing renders
// differently.
//
// WHY A SECOND LANGUAGE IS ROUTES RATHER THAN A STRING TABLE. A published site
// is ONE bundle in ONE Worker script: the dispatch namespace keys a script per
// slug and a Worker cannot load code at runtime, so two bundles is not a thing
// that can exist. The alternative was rewriting every literal string in
// model-written page code into a runtime lookup — a transform on code we did not
// write, where a mistake is a page that does not compile. Measured through the
// real container first: a page at `es/book.tsx` declaring `/es/book` builds and
// serves, and `routeOf` already maps the directory to the address.
//
// The PRIMARY language has no prefix, so every URL an existing site has ever
// published is untouched and the second language is purely additive.
export const SITE_LANGS: ReadonlyArray<{ lang: string; dir: "ltr" | "rtl"; prefix: string; label: string }> = [];
// LIGHT OR DARK. One class on `<html>` in `__root.tsx`, and that is the whole
// mechanism: `styles.css` declares `@custom-variant dark (&:is(.dark *))`, and
// `themeCss` already emits the theme's OWN designed dark palette as a `.dark`
// block into every site's stylesheet. Nothing ever applied it, so all 500 themes
// shipped their dark half as dead CSS and the only way to a dark site was
// patching the ground colour — which left the buttons and highlights on colours
// picked for white paper.
//
// `SITE_MODE` IS GONE (owner's call, 2026-08-23) — light or dark is a colour,
// and colour is the designer's `css`. A dark site writes dark values on
// `:root`; there is no second switch to keep in step with it.
//
// `.dark` STILL MEANS SOMETHING, so do not read this as dark mode being
// removed: `theme-toggle` toggles the class on `documentElement`, so a page
// that renders one lets a VISITOR switch. What went is the BAKED default.
//
// Measured before deleting: ZERO of the kit's components carry a `dark:`
// utility, so nothing here branches on the class — the whole of dark mode is
// token values, which is exactly what `css` writes.
// WHETHER THE ROUTER STARTS A VIEW TRANSITION BETWEEN PAGES — the half of the
// page-transition axis that cannot live in the stylesheet, because a transition
// has to be STARTED before there is anything for CSS to animate.
//
// FALSE HERE AND ON EVERY SITE THAT DID NOT ASK, and that is not caution: the
// browser's UA stylesheet animates the view-transition pseudo-elements by
// default, so turning this on without CSS gives every site a cross-fade nobody
// chose. `transitionOn` in `site-theme.mjs` is the ONE question both halves ask
// — this flag and the animation come from the same call, so they cannot end up
// saying different things about the same site.
//
// A browser with no support is unaffected either way: the router feature-detects
// (`"startViewTransition" in document`) and does an ordinary navigation.
export const SITE_PAGE_TRANSITION: boolean = false;
// The tab's mark. `/icon.svg` when the build wrote one from the business's
// initials, and the template's own `favicon.svg` otherwise — never overwritten,
// because this container is long-lived and the first site's mark would become
// every later brandless site's.
export const SITE_ICON = "/favicon.svg";
// WHAT THOSE BYTES ACTUALLY ARE. The mark this build draws is an SVG and the
// document declared `image/svg+xml` unconditionally — fine while that was the
// only icon a site could have, and a lie about the bytes the moment an owner
// sends their own PNG. A browser is entitled to refuse an icon whose declared
// type does not match, so the type is written per icon rather than assumed.
export const SITE_ICON_TYPE = "image/svg+xml";
// The business's name, used as the document's DEFAULT title — a route that
// declares its own `head()` beats it. `setTitle` used to stamp this onto every
// non-home page at publish, after the fact; a default the routes can override is
// the same outcome with the ordering the right way round.
export const SITE_NAME = "App";
// THE MOBILE BROWSER'S OWN TINT — `<meta name="theme-color">` — baked from the
// theme's light paper, the SAME reading the share card paints with, so the
// browser bar and the card cannot name two different papers. Empty — the
// template's own standalone state — means the tag is not emitted at all, so
// every site built before this renders exactly as it did.
export const SITE_THEME_COLOR: string = "";
// THE HOME-SCREEN ICON — `/apple-touch-icon.png`, rasterised per build from the
// same mark the tab shows (the drawn favicon or the initials), on the theme's
// paper so a transparent mark does not become a black square on iOS. Empty when
// this build made none — an owner-uploaded tab icon is a remote file this
// build does not rasterise (a stated limit, not an oversight) — and empty means
// no link is emitted, because a link to a file that was never made is a 404 on
// every page.
export const SITE_TOUCH_ICON: string = "";
// WHICH BUILD THIS IS — the one value here that nothing renders. `src/server.ts`
// returns it as `x-site-build` on every response, and the platform waits for it
// to match what it just uploaded before calling a publish done: a script does
// not start serving the instant its upload is accepted, so without this the
// route reports success while the site still answers with the previous build.
// Empty in the template, because a standalone build is not a published site and
// has nothing to confirm.
export const SITE_BUILD = "";
