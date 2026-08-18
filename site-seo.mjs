// What a published site tells a search engine — and what it answers for an
// address that is not a page.
//
// THE GAP THIS CLOSES (2026-08-14 audit, three of the medium-value gaps in one
// mechanism): nothing told a crawler which pages a site actually has (no
// sitemap, a two-line robots.txt with no Sitemap: declaration), the server
// answered 200 with the app shell for ANY made-up address (a soft-404, so a
// crawler cannot tell real pages from junk), and the moment an owner renamed or
// deleted a page — features that shipped 2026-08-11/12 — every link Google had
// indexed and every WhatsApp share broke silently.
//
// ONE MECHANISM, NOT THREE. The publish path already knows the site's route
// list (the pages it just compiled), and the serve path's SPA fallback already
// reads `index.html` when a path has no prerendered document. So the route list
// and the redirect map ride INSIDE index.html as two meta tags in the
// `isibi:meta` fenced block — the fallback parses them out of the bytes it has
// already buffered, which costs it no extra R2 read on any path — and the
// sitemap is derived from the same list at publish.
//
// ABSENT MEANS TODAY'S BEHAVIOUR. Every site published before this has no
// manifest in its head, and the fallback answers 200 for everything, exactly as
// it does now — so one deploy cannot change what any existing site serves. A
// site heals on its next publish. The same rule `normalizeLang` follows: a
// refusal to guess, not a default.
//
// THE HOST IS SUBSTITUTED AT SERVE TIME, NOT BAKED AT PUBLISH. The same bytes
// serve at `<slug>.gofarther.app`, at `gofarther.dev/s/<slug>/` and at the
// owner's own custom domain — the Host rewrite makes them one prefix — so a
// sitemap with an absolute host baked in is wrong on every mount but one, and
// the wrong it is on a custom domain is the "visitor must never see our domain"
// leak this repo has already fixed twice. The files carry SITE_ORIGIN_TOKEN and
// the Worker replaces it with the origin the request actually arrived on, the
// same reasoning as the `./` asset rewrite one branch over.

import { routeOf } from "./builder/site-addon.mjs";

/** The placeholder a published sitemap/robots carries where its origin goes. */
export const SITE_ORIGIN_TOKEN = "https://__SITE_ORIGIN__";

/** Redirect map cap. A site has ~3-6 pages; fifty renames is a runaway. */
export const MAX_REDIRECTS = 50;

const ROUTES_META = "site-routes";
const REDIRECTS_META = "site-redirects";

/**
 * The route list a set of page files declares.
 *
 * `routeOf` is site-addon.mjs's mapping — THE one place a stored page path
 * becomes a route, and the function whose duplicate spellings cost the whole
 * page-edit layer once (2026-08-12). A `$` anywhere marks a dynamic segment
 * whose concrete addresses are unknowable here; `dynamic` says one exists.
 */
export function siteRoutes(pages) {
  const routes = [];
  let dynamic = false;
  for (const p of (Array.isArray(pages) ? pages : [])) {
    const r = routeOf(p && p.path).toLowerCase();
    if (!r) continue;
    if (r.includes("$")) { dynamic = true; continue; }
    if (!routes.includes(r)) routes.push(r);
  }
  routes.sort();
  return { routes, dynamic };
}

/**
 * The sitemap, with the origin still a token. Concrete routes only — a dynamic
 * route has no addresses to list, and a sitemap is allowed to be incomplete
 * but not to be wrong.
 */
export function sitemapXml(routes, lastmod) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(lastmod || "")) ? String(lastmod) : "";
  const urls = (Array.isArray(routes) ? routes : []).filter((r) => /^\/[a-z0-9/._-]*$/.test(String(r))).map((r) =>
    "  <url><loc>" + SITE_ORIGIN_TOKEN + (r === "/" ? "/" : r) + "</loc>" +
    (day ? "<lastmod>" + day + "</lastmod>" : "") + "</url>");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") + (urls.length ? "\n" : "") + "</urlset>\n";
}

/**
 * robots.txt with a Sitemap: line — the declaration the template's two-line
 * file never had, which is how a crawler finds the sitemap at all.
 */
export function robotsTxt() {
  return "User-agent: *\nAllow: /\n\nSitemap: " + SITE_ORIGIN_TOKEN + "/sitemap.xml\n";
}

/** Put the real origin into a published sitemap/robots body at serve time. */
export function substituteOrigin(text, base) {
  const b = String(base || "").replace(/\/+$/, "");
  if (!b) return String(text == null ? "" : text);
  return String(text == null ? "" : text).split(SITE_ORIGIN_TOKEN).join(b);
}

/**
 * The routes meta value. EMPTY when a dynamic route exists, deliberately: the
 * fallback cannot enumerate a `$` route's addresses, and a list that omits
 * them would 404 a real deep link — so the manifest says nothing and the
 * fallback fails open to 200, today's behaviour. Zero of the 318 exemplars
 * and zero reference routes declare one, so this is the rare case, not the
 * ordinary one.
 */
export function routesContent(man) {
  if (!man || man.dynamic || !Array.isArray(man.routes) || !man.routes.length) return "";
  return man.routes.join(",");
}

/** The redirects meta value: `/old=/new` pairs, comma-joined. Route paths
 *  cannot contain `,` or `=` (cleanPath's own character class), so the
 *  encoding is unambiguous by construction rather than by escaping. */
export function redirectsContent(map) {
  const pairs = Object.entries(map || {}).filter(([f, t]) =>
    /^\/[a-z0-9/._$-]*$/i.test(String(f)) && /^\/[a-z0-9/._$-]*$/i.test(String(t)));
  return pairs.slice(0, MAX_REDIRECTS).map(([f, t]) => f + "=" + t).join(",");
}

/**
 * Read the manifest back out of a published index.html.
 *
 * `null` when there is no manifest at all — a site published before this
 * existed, or the schema placeholder — which the caller must treat as "no
 * opinion", never as "no routes". `routes: null` inside a manifest means the
 * same thing one level down (a dynamic site publishes redirects only).
 */
export function parseSiteManifest(html) {
  const src = String(html == null ? "" : html);
  const grab = (name) => {
    const m = src.match(new RegExp('<meta name="' + name + '" content="([^"]*)"'));
    return m ? m[1] : null;
  };
  const rawRoutes = grab(ROUTES_META);
  const rawRedirects = grab(REDIRECTS_META);
  if (rawRoutes === null && rawRedirects === null) return null;
  const routes = rawRoutes
    ? rawRoutes.split(",").map((r) => r.trim().toLowerCase()).filter((r) => r.startsWith("/"))
    : null;
  const redirects = {};
  for (const pair of (rawRedirects || "").split(",")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const from = pair.slice(0, eq).trim().toLowerCase();
    const to = pair.slice(eq + 1).trim().toLowerCase();
    if (from.startsWith("/") && to.startsWith("/") && from !== to) redirects[from] = to;
  }
  return { routes: routes && routes.length ? routes : null, redirects };
}

/**
 * Only the moves whose destination REALLY EXISTS in this publish.
 *
 * The whole value of an explicit move is that the 301 lands on the renamed page
 * instead of the home page — so a pair naming a target this publish does not
 * serve is worse than no pair at all: it 301s a working old address onto a 404,
 * where the derived rule would at least have reached the home page. Checked
 * against the route list rather than trusted, because the caller's `to` comes
 * from a model-driven lane.
 *
 * Tolerant of one pair or a list of them, since `renameRoute` returns a single
 * `{from, to}` and a publish could in principle carry several.
 */
function normalizeMoves(renamed, routes) {
  const list = Array.isArray(renamed) ? renamed : renamed ? [renamed] : [];
  const out = {};
  for (const m of list.slice(0, MAX_REDIRECTS)) {
    if (!m || typeof m !== "object") continue;
    const from = typeof m.from === "string" ? m.from.trim().toLowerCase() : "";
    const to = typeof m.to === "string" ? m.to.trim().toLowerCase() : "";
    if (!from.startsWith("/") || !to.startsWith("/")) continue;
    // The home page has no address to move, and a self-move is a redirect loop.
    if (from === "/" || from === to) continue;
    if (!routes.includes(to)) continue;
    out[from] = to;
  }
  return out;
}

/**
 * The redirect map for a new publish, given the previous one.
 *
 * A route that EXISTED last publish and is gone from this one redirects to the
 * home page — old → new is a guess the DIFF cannot make, and home is where
 * every page's header already points. Accumulated across publishes (a page
 * deleted two revises ago still redirects), and an entry whose source is a live
 * route again is DROPPED — a re-added page must serve itself.
 *
 * `renamed` IS THE ONE CASE WHERE old → new IS NOT A GUESS. A rename looks
 * exactly like a delete plus an add from the outside, so without it the address
 * a customer has in their index and in last month's messages 301s to the home
 * page rather than to the page they renamed — which is the whole reason
 * `renameRoute` returns an explicit pair. Applied FIRST, for the same reason
 * newly-gone routes are: `redirectsContent` keeps the first MAX_REDIRECTS pairs,
 * so whatever is written first is what survives the cap, and a move is the most
 * valuable pair in the map.
 *
 * A kept entry whose target has since gone is re-pointed at home rather than
 * chained — two hops is where redirect loops come from — EXCEPT when a move
 * says where that target went, which is one hop and lands on the real page.
 */
export function mergeRedirects(prev, newRoutes, renamed = null) {
  const routes = Array.isArray(newRoutes) ? newRoutes : [];
  const moved = normalizeMoves(renamed, routes);
  const out = {};
  for (const [from, to] of Object.entries(moved)) out[from] = to;
  // NEWLY GONE FIRST, AND THAT ORDER IS THE CAP'S MEANING. `redirectsContent`
  // keeps the first MAX_REDIRECTS pairs, so whichever end is written first is
  // the end that survives. Built the other way round — carried-over entries
  // first — the pair that gets dropped on a site at the cap is the page deleted
  // JUST NOW: the one whose old address is in Google's index today and in
  // somebody's messages this week, while a redirect from a year ago is kept
  // forever. It is also unrecoverable, because a dropped pair never reaches the
  // manifest and the route is already gone from the page list, so the next
  // publish cannot see that it ever existed.
  for (const r of ((prev && prev.routes) || [])) {
    // `out[r]` is a move already recorded for this exact route, and it must win:
    // a renamed page is BOTH gone from the old address and explained, and the
    // derived rule would overwrite the explanation with the home page.
    if (r === "/" || routes.includes(r) || out[r]) continue;
    out[r] = "/";
  }
  const prevRedirects = (prev && prev.redirects) || {};
  for (const [from, to] of Object.entries(prevRedirects)) {
    if (routes.includes(from)) continue;
    if (from === "/" || out[from]) continue;
    // A move tells us where a now-dead target went, so an older redirect that
    // pointed at it follows the page rather than collapsing to home. Still ONE
    // hop: `moved` only ever names live routes.
    out[from] = routes.includes(to) ? to : (moved[to] || "/");
  }
  return out;
}

/**
 * What the SPA fallback should do with an extensionless path that has no
 * prerendered document. Pure — the serve path hands it the parsed manifest and
 * acts on the verdict, so every branch of this is testable without a Worker.
 *
 *   redirect — the path was a page once; send the visitor where it went.
 *   ok       — a real route (or no manifest to say otherwise): serve the
 *              shell 200 and let the client router render it.
 *   notfound — the manifest KNOWS the routes and this is not one: serve the
 *              shell so the branded 404 renders, with HTTP 404 so a crawler
 *              stops indexing junk addresses as pages.
 */
export function decideFallback(manifest, path) {
  const p = String(path || "/").toLowerCase().replace(/\/+$/, "") || "/";
  if (!manifest) return { kind: "ok" };
  const to = manifest.redirects && manifest.redirects[p];
  if (to) return { kind: "redirect", to };
  if (!manifest.routes) return { kind: "ok" };
  return manifest.routes.includes(p) ? { kind: "ok" } : { kind: "notfound" };
}
