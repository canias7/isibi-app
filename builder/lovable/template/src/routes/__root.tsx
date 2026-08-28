// THE DOCUMENT ITSELF, not a fragment inside one.
//
// Under Start there is no `index.html` — the build emits none, measured — so
// this file IS the shell: `<html>`, `<head>`, `<body>`, produced per request.
// That is the change with the widest blast radius in the whole migration,
// because a static shell was what `writeIndexHtml` edited in the container,
// what `injectMeta` patched at publish, what carried the SEO manifest, and what
// the site's Worker spliced the render into.
//
// `lang` AND THE FAVICON COME FROM `site-brand.ts`, which the container already
// writes per build. They used to be applied by `applyIdentity` doing surgery on
// the shell's HTML; here they are ordinary props, so there is nothing to patch
// and nothing to get wrong with a regex.
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useMatches,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { SpamGuard } from "@/lib/spam-guard";
import { SITE_LANG, SITE_DIR, SITE_LANGS, SITE_ICON, SITE_ICON_TYPE, SITE_NAME, SITE_SLUG, SITE_THEME_COLOR, SITE_TOUCH_ICON } from "@/site-brand";
import { siteMeta } from "@/site-runtime";
// The stylesheet and the site's typeface, imported here rather than in a client
// entry so the SERVER render emits their <link> tags too. Imported in
// `main.tsx` before this, where they reached the client only — which was fine
// while the server render was a throwaway snapshot and is not fine now that the
// browser hydrates it: an unstyled first paint is what the visitor sees.
import "../styles.css";
import "../fonts";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // WHAT `injectMeta` USED TO PATCH INTO A SHELL AT PUBLISH TIME. There is no
  // shell to patch under Start, so the head is composed here — from the baked
  // half (`site-brand.ts`) and the publish-time half the server entry read out
  // of R2 (`site-runtime.ts`).
  //
  // `site-slug` IS THE ONE THAT MATTERS AND IT IS BAKED. `siteSlug()` in
  // `@/lib/rows` learns which site it is from the path — and ON A CUSTOM DOMAIN
  // THERE IS NO `/s/<slug>/` PATH, so without this tag every read and every form
  // would address whatever the build-time default happens to be: a DIFFERENT
  // site's API, silently, on the hostname the owner actually gives to customers.
  // It comes from the bundle rather than the R2 read precisely so that a blip
  // costs a link preview and never the site's data.
  //
  // THE TITLE IS A DEFAULT ANY ROUTE OVERRIDES. `setTitle` used to stamp the
  // brand onto every non-home page at publish, after the fact; a route's own
  // `head()` beating a default is the same outcome with the ordering the right
  // way round.
  head: (ctx) => {
    const m = siteMeta();
    // THE PAGE'S OWN ADDRESS, not the site's, and it is computed here rather
    // than asked of the generator. `og:url` was `m.origin` for every route, so
    // a crawler was told several addresses are one page and every share of
    // /book pointed at the home page. `head` receives the matched routes, so
    // the deepest one's pathname IS the current page — which makes this correct
    // for a page the model has never seen and for one written tomorrow.
    //
    // The basepath is already stripped from a match's pathname, so this stays
    // right in the workspace preview as well as on the site's own domain.
    const here = (() => {
      const list = Array.isArray(ctx?.matches) ? ctx.matches : [];
      const p = list.length ? list[list.length - 1]?.pathname : "";
      return typeof p === "string" && p.startsWith("/") ? p.replace(/\/+$/, "") : "";
    })();
    // THE PAGE'S ONE PUBLIC ADDRESS, computed ONCE and used by `og:url` AND the
    // canonical link — the same expression, so the two can never disagree about
    // which address is the real one. The canonical is what consolidates: once a
    // site has a custom domain it serves at TWO hostnames (the .app subdomain
    // stays live), and without this tag a search engine reads them as duplicate
    // sites and splits the ranking between them. Absent origin means NO tag —
    // a wrong canonical is worse than none.
    const page = m?.origin ? m.origin + here : "";
    const tags: Array<Record<string, string>> = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_NAME },
      { property: "og:title", content: SITE_NAME },
      // THE LITTLE LINE AT THE TOP OF THE CARD. Without it Slack, Discord and
      // Telegram fall back to the raw hostname there — the machine's name in
      // the most visible place a share has.
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: "website" },
      // `og:locale` is the site's own language in OG's underscore spelling;
      // a bilingual site declares the other half as an alternate.
      { property: "og:locale", content: SITE_LANG.replace(/-/g, "_") },
    ];
    for (const l of SITE_LANGS) {
      if (l && l.lang && l.lang !== SITE_LANG) {
        tags.push({ property: "og:locale:alternate", content: l.lang.replace(/-/g, "_") });
      }
    }
    // The mobile browser's own chrome tints to the theme's paper instead of
    // grey. Baked from the SAME reading the share card paints with, so the
    // browser bar and the card cannot name two different papers.
    if (SITE_THEME_COLOR) tags.push({ name: "theme-color", content: SITE_THEME_COLOR });
    if (SITE_SLUG) tags.push({ name: "site-slug", content: SITE_SLUG });
    // EACH ONE ONLY IF THERE IS SOMETHING TO SAY. An empty `og:description` is
    // worse than none — a preview renders the empty string rather than falling
    // back to what the page itself contains.
    if (m?.description) {
      tags.push({ name: "description", content: m.description });
      tags.push({ property: "og:description", content: m.description });
    }
    if (m?.image) {
      tags.push({ property: "og:image", content: m.image });
      // THE DIMENSIONS, ONLY WHEN THEY ARE KNOWN. The composed card is pinned
      // at 1200×630 platform-wide and always serves at /card.png, so an
      // unfurler told the size can lay the card out before the image arrives —
      // the first share renders instantly instead of reflowing. An OWNER
      // upload's dimensions are whatever they uploaded, and a wrong claim is
      // worse than none: some unfurlers crop to the declared box.
      if (/\/card\.png$/.test(m.image)) {
        tags.push({ property: "og:image:width", content: "1200" });
        tags.push({ property: "og:image:height", content: "630" });
      }
      tags.push({ property: "og:image:alt", content: SITE_NAME });
      // `summary_large_image` WITH NO IMAGE RENDERS AN EMPTY BOX, so the card
      // type follows whether there is actually one — the rule `metaTags` already had.
      tags.push({ name: "twitter:card", content: "summary_large_image" });
    } else {
      tags.push({ name: "twitter:card", content: "summary" });
    }
    if (page) tags.push({ property: "og:url", content: page });
    // PROVING THE SITE BELONGS TO THE BUSINESS. Search Console and the rest read
    // the tag off whichever URL they were pointed at, so it goes on EVERY page
    // rather than only the home page — a site verified at its root and not at
    // /book is one failed check away from being unverified.
    //
    // SHAPE-CHECKED HERE TOO, even though the platform resolved it. This value
    // comes off an R2 read and is spread straight into a meta tag; a bad row
    // would otherwise render `name="undefined"`. Bounded for the same reason a
    // head is not a place for an unbounded list.
    for (const v of (Array.isArray(m?.verify) ? m.verify : []).slice(0, 12)) {
      if (v && typeof v.name === "string" && v.name && typeof v.content === "string" && v.content) {
        tags.push({ name: v.name, content: v.content });
      }
    }
    return {
      meta: tags,
      links: [
        { rel: "icon", href: SITE_ICON, type: SITE_ICON_TYPE },
        // The home-screen icon, only when this build rasterised one — a link
        // to a file that was never made is a 404 on every page.
        ...(SITE_TOUCH_ICON ? [{ rel: "apple-touch-icon", href: SITE_TOUCH_ICON }] : []),
        // The one real address, from the SAME `page` og:url speaks.
        ...(page ? [{ rel: "canonical", href: page }] : []),
      ],
    };
  },
  component: RootDocument,
});

// <HeadContent /> is what makes each route's `head: () => ({ meta })` block
// actually reach the document. Start renders it server-side; without it every
// page's title and og tags are computed and then silently thrown away.
//
// <Scripts /> is the other half and has no equivalent in the old shell: it
// emits the module tags that load the client bundle. `index.html` carried a
// hardcoded `<script src="/src/main.tsx">`; this emits the built, hashed names,
// which is also why `absolutizeAssets` stops being needed.
//
// <Toaster /> is mounted here because sonner's `toast()` queues into a
// container that has to exist somewhere in the tree. Every generated form
// reports success and failure through it, so without this the submit button
// works and the visitor is told nothing.
//
// <SpamGuard /> is mounted here rather than offered to the generator as a
// component, so a form cannot be built without it. It renders NOTHING and
// fetches no third-party script on a site whose owner has not configured
// Turnstile, which is almost all of them.
/**
 * WHICH PAGE THIS IS, as an attribute a stylesheet can select on.
 *
 * WHY IT IS HERE AND NOT ON THE FRAME. The look was site-wide — one `site_look`
 * row, one `site_tokens` row — so "make the booking page calmer" was
 * unreachable at any price. A page's own colours are a SCOPE rather than a
 * second stylesheet, and `<body>` is the one ancestor every page has whether or
 * not it uses `SiteChrome` (16 of 318 exemplars do not).
 *
 * THE SAME READING `head()` USES, deliberately. The deepest match's pathname is
 * the current page, with the basepath already stripped — so this is right in the
 * workspace preview at `/s/<slug>/book` and on the site's own domain at `/book`,
 * and right for a page the model has never seen. Computing it from
 * `location.pathname` instead would carry the basepath on one mount and not the
 * other, and the selector would match on neither.
 *
 * IT UPDATES ON NAVIGATION because `useMatches` subscribes: clicking through to
 * another page re-stamps, which is what makes a per-page colour survive
 * client-side routing rather than only a fresh load.
 */
function usePagePath() {
  const matches = useMatches();
  const p = matches.length ? matches[matches.length - 1]?.pathname : "";
  if (typeof p !== "string" || !p.startsWith("/")) return "/";
  // A trailing slash is the same page — `/book/` and `/book` must not be two
  // selectors, and the home page has to stay "/" rather than becoming "".
  return p.replace(/\/+$/, "") || "/";
}

/**
 * WHICH LANGUAGE THIS REQUEST IS IN.
 *
 * A SECOND LANGUAGE IS ORDINARY ROUTES under a prefix — `/es`, `/es/book` — in
 * the same bundle, because a Worker cannot load code at runtime and the dispatch
 * namespace keys one script per slug, so two bundles is not a design that
 * exists. That makes the document's own `lang` and `dir` a fact about the ROUTE
 * rather than about the site, and they were one baked constant each.
 *
 * READ OFF THE SAME PATHNAME `usePagePath` ALREADY READS, so this costs nothing
 * new: the root is re-rendered per request either way, and `data-page` has been
 * deriving from it since the per-page colour scope shipped.
 *
 * MATCHED ON A WHOLE SEGMENT. `/eshop` is not Spanish, and a `startsWith` here
 * is the anchoring mistake the hostname rewrite already recorded once.
 *
 * A SITE WITH ONE LANGUAGE ANSWERS EXACTLY WHAT IT ANSWERED BEFORE: `SITE_LANGS`
 * is empty on every site published before this, so the loop finds nothing and
 * both values fall back to the baked constants.
 */
function useActiveLang() {
  const path = usePagePath();
  const seg = path.split("/").filter(Boolean)[0];
  const hit = seg ? SITE_LANGS.find((l) => l.prefix === seg.toLowerCase()) : undefined;
  return { lang: hit ? hit.lang : SITE_LANG, dir: hit ? hit.dir : SITE_DIR, path };
}

function RootDocument() {
  const active = useActiveLang();
  return (
    // DARK MODE IS ONE CLASS ON `<html>`, and that is the entire feature.
    //
    // `styles.css` declares `@custom-variant dark (&:is(.dark *))`, and
    // `themeCss` already emits the theme's OWN designed dark palette as a
    // `.dark` block — 31 colour properties, solved rather than picked — into
    // every site's stylesheet. Nothing ever applied it: all 500 themes shipped
    // their dark half as dead CSS, and "make my site dark" got a token patch
    // instead, which darkened the ground and left the buttons and highlights on
    // colours chosen for white paper.
    //
    // ON `<html>` RATHER THAN `<body>`, because the variant is
    // `&:is(.dark *)` — a DESCENDANT of `.dark` — so the class has to sit above
    // everything it is meant to reach, and `<body>` is already carrying the
    // per-page scope.
    //
    // BAKED, NOT DETECTED. A site does not follow the visitor's own light/dark
    // setting, deliberately: the owner picked a look and half their visitors
    // seeing a different one is not a feature they asked for.
    // `dir` IS WRITTEN ON EVERY SITE, INCLUDING EVERY LEFT-TO-RIGHT ONE. `ltr`
    // is the initial value, so stating it changes nothing that renders — and it
    // means the attribute's PRESENCE is never a signal anybody has to reason
    // about. On `<html>` rather than `<body>` because the logical utilities the
    // kit was swept onto resolve against the inherited `direction`, and the
    // per-page colour scope already lives on `<body>`.
    // THE LANGUAGE AND THE DIRECTION ARE PER ROUTE, not per site. On a bilingual
    // site `/es/book` must declare Spanish or a screen reader reads Spanish with
    // an English voice and Chrome offers to translate a page that is already in
    // the visitor's language — the exact failure `lang` was added to fix, one
    // level down. And an English/Arabic pair needs `dir` to change with it,
    // which is only expressible because the kit is on logical utilities.
    <html lang={active.lang} dir={active.dir}>
      <head>
        <HeadContent />
      </head>
      <body data-page={active.path}>
        <Outlet />
        <Toaster />
        <SpamGuard />
        <Scripts />
      </body>
    </html>
  );
}
