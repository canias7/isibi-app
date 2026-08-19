// A SITE IN MORE THAN ONE LANGUAGE.
//
// THE MECHANISM WAS DECIDED BY A MEASUREMENT, NOT A PREFERENCE. A published
// site is ONE bundle in ONE Worker script — the dispatch namespace keys a script
// per slug, and a Worker cannot load code at runtime — so a bilingual site
// cannot be two bundles. That leaves exactly two designs: rewrite every literal
// string in model-written page code into a runtime lookup, or make the second
// language ORDINARY ROUTES in the same bundle.
//
// Measured through the real container and the real router before a line of this
// was written: `es/index.tsx` and `es/book.tsx` build, and the packaged worker
// answers `/` and `/book` in English, `/es` and `/es/book` in Spanish, and
// `/fr` with the site's own branded 404. `routeOf` already maps a nested
// directory to its address, so the addressing layer needed no change at all.
//
// So the second language is pages, and this module is only the arithmetic:
// which languages, what prefix each gets, how a page's path and route id are
// prefixed, and how the links inside a translated page are re-pointed. The
// translation itself is a model call and lives elsewhere; every decision here
// is pure, so all of it is tested outside the Worker and the container.
//
// WHAT IS DELIBERATELY OUT OF SCOPE, stated rather than implied: DATABASE ROWS.
// A café's menu items live in Postgres, not in the page source, so a second
// language does not translate them — the dishes stay in the owner's own words.
// Translating rows means a column per language, a Data panel that edits both,
// and a rule for what a half-translated row shows; that is a separate feature
// and pretending otherwise would ship a site that is bilingual in its headings
// and monolingual in its content without saying so.
import { normalizeLang } from "./site-identity.mjs";
import { routeOf } from "./site-addon.mjs";

/**
 * How many languages beyond the site's own.
 *
 * EACH ONE IS A FULL SET OF ROUTES IN THE BUNDLE and a full translation call, so
 * this is not a slider — three extra languages is four copies of every page to
 * compile, to store and to keep in step on every later edit. The feature is
 * bilingual; the cap allows the natural next ask without inviting a site with
 * twelve of them.
 */
export const MAX_EXTRA_LANGS = 3;

/**
 * Segments a language may not claim, because something else already answers
 * there. A prefix that collides is not a cosmetic clash: it is a language whose
 * pages are unreachable, or a platform path shadowed on the site's own origin.
 */
export const RESERVED_PREFIXES = new Set(["api", "assets", "u", "s", "_build", "favicon", "robots", "sitemap"]);

/**
 * The URL segment for a language.
 *
 * THE BASE SUBTAG, NOT THE FULL TAG. `/es/book` is what a visitor expects and
 * what every site that does this uses; `/es-es/book` is noise. The cost is that
 * two variants of one language cannot both be offered — `pt-BR` and `pt-PT`
 * would both want `/pt` — and that is refused explicitly rather than resolved
 * by silently lengthening one of them, because a site whose Brazilian pages
 * live at `/pt` and whose Portuguese ones live at `/pt-pt` is a site nobody
 * asked for.
 */
export function langPrefix(tag) {
  const t = normalizeLang(tag);
  return t ? t.split("-")[0].toLowerCase() : null;
}

/**
 * A language's name IN ITS OWN LANGUAGE — "Español", not "Spanish".
 *
 * A switcher labelled in the language the reader cannot read is a switcher they
 * cannot find, which is the whole point of it. Capitalised because
 * `Intl.DisplayNames` lowercases in several languages ("español", "français")
 * and a nav item is a label rather than a sentence.
 *
 * THE BASE SUBTAG, NOT THE FULL TAG. `en-GB` resolves to "British English",
 * which is regional noise in a two-item nav — the reader is choosing a language,
 * not a dialect. Safe because two variants of one language can never both be
 * offered: they would want the same URL prefix and `resolveLangs` refuses the
 * second.
 *
 * IT LIVES HERE RATHER THAN IN THE CONTAINER, where it was written and where
 * nothing could drive it — `build-server.mjs` starts an HTTP server, so a unit
 * test cannot import it and the base-subtag rule was held by a source-read at
 * best. It is arithmetic about a language tag, which is what this module is.
 */
export function langLabel(tag, prefix) {
  try {
    const base = String(tag).split("-")[0];
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(base);
    if (name && typeof name === "string" && name.toLowerCase() !== base.toLowerCase()) {
      return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
    }
  } catch { /* fall through */ }
  // AN UNUSABLE ANSWER FALLS BACK TO THE PREFIX IN CAPITALS, which is plain and
  // never wrong — a runtime with no `Intl.DisplayNames`, or a tag it has no name
  // for, gives "ES" rather than nothing at all.
  return String(prefix || tag).toUpperCase();
}

/**
 * The languages this site serves, primary first.
 *
 * REFUSES RATHER THAN REPAIRS, and each refusal is a real failure it prevents:
 * an unreadable tag has no prefix to serve from; a duplicate base would give two
 * languages one address; a reserved segment shadows something that already
 * answers there; and a prefix that matches a page the site already has would
 * make that page unreachable the day the language is added.
 *
 * Returns `{ langs, refused }` — never throws, because this runs on a build
 * path where losing one language must not lose the site.
 */
export function resolveLangs(primary, extra, { routes = [] } = {}) {
  const refused = [];
  const home = normalizeLang(primary) || "en";
  const homePrefix = langPrefix(home);
  const langs = [{ tag: home, prefix: "", primary: true }];
  const taken = new Set([homePrefix]);
  // A route the site already has, as a first segment: `/es` as a PAGE is a
  // perfectly ordinary thing for an English site to have, and it is exactly
  // what a Spanish language prefix would shadow.
  const pageSegments = new Set(
    (Array.isArray(routes) ? routes : [])
      .map((r) => String(r || "").split("/").filter(Boolean)[0])
      .filter(Boolean)
      .map((s) => s.toLowerCase()),
  );
  for (const raw of Array.isArray(extra) ? extra : []) {
    if (langs.length > MAX_EXTRA_LANGS) { refused.push({ lang: String(raw), why: "cap" }); continue; }
    const tag = normalizeLang(raw);
    if (!tag) { refused.push({ lang: String(raw), why: "unreadable" }); continue; }
    const prefix = langPrefix(tag);
    if (taken.has(prefix)) { refused.push({ lang: tag, why: "duplicate" }); continue; }
    if (RESERVED_PREFIXES.has(prefix)) { refused.push({ lang: tag, why: "reserved" }); continue; }
    if (pageSegments.has(prefix)) { refused.push({ lang: tag, why: "page" }); continue; }
    taken.add(prefix);
    langs.push({ tag, prefix, primary: false });
  }
  return { langs, refused };
}

/**
 * A page's file path inside a language.
 *
 * THE PRIMARY LANGUAGE KEEPS ITS PATHS EXACTLY AS THEY ARE, which is what makes
 * this safe to add to a site that already exists: every URL a customer has
 * shared, every link a search engine has indexed and every stored page path is
 * untouched, and the second language is additive.
 */
export function prefixPagePath(path, prefix) {
  const p = String(path || "").replace(/^\/+/, "");
  if (!p) return null;
  return prefix ? prefix + "/" + p : p;
}

/** The route id a prefixed page declares. `/` becomes `/es`, not `/es/`. */
export function prefixRoute(route, prefix) {
  const r = String(route || "/");
  if (!prefix) return r;
  return r === "/" ? "/" + prefix : "/" + prefix + r;
}

/**
 * Which of the site's languages a pathname is in.
 *
 * THE PRIMARY IS THE ANSWER FOR EVERYTHING UNPREFIXED, including a path that
 * happens to begin with two letters — `/eshop` is not Spanish. Matched on a
 * whole segment for that reason, which is the same anchoring mistake the
 * hostname rewrite already recorded (`includes` against `startsWith`).
 */
export function langOfPath(pathname, langs) {
  const list = Array.isArray(langs) ? langs : [];
  const home = list.find((l) => l && l.primary) || list[0] || null;
  const seg = String(pathname || "/").split("/").filter(Boolean)[0];
  if (!seg) return home;
  const hit = list.find((l) => l && l.prefix && l.prefix === seg.toLowerCase());
  return hit || home;
}

/**
 * The same page in every language, for the head's `hreflang` alternates.
 *
 * NOT WIRED YET, AND SAID SO RATHER THAN LEFT LOOKING LIVE. `hreflang` is how a
 * search engine learns that `/book` and `/es/book` are one page in two
 * languages rather than two thin pages competing with each other — so without
 * it a bilingual site's second half is a duplicate-content problem instead of a
 * feature. The head is composed per route in `__root.tsx` and the routes' own
 * `head()`, which is a wider change than the rest of this; it is the named next
 * step rather than an omission somebody has to rediscover.
 *
 * Kept because it is one decision away from mattering and is already the shape
 * the head needs — the same convention `COMPONENT_API` is kept under.
 */
export function alternatesFor(route, langs) {
  const list = Array.isArray(langs) ? langs : [];
  const bare = stripLangPrefix(route, list);
  return list.filter((l) => l && l.tag).map((l) => ({ lang: l.tag, path: prefixRoute(bare, l.prefix) }));
}

/** A prefixed route back to its primary-language address. */
export function stripLangPrefix(route, langs) {
  const r = String(route || "/");
  const list = Array.isArray(langs) ? langs : [];
  for (const l of list) {
    if (!l || !l.prefix) continue;
    if (r === "/" + l.prefix) return "/";
    if (r.startsWith("/" + l.prefix + "/")) return r.slice(l.prefix.length + 1);
  }
  return r;
}

/**
 * Re-point the internal links inside a translated page.
 *
 * A TRANSLATED PAGE THAT LINKS AT THE PRIMARY LANGUAGE THROWS THE VISITOR OUT OF
 * THEIR OWN. They read the Spanish home page, press what it calls "Reservar",
 * and land on the English booking form — the site works and the feature does
 * not, which is the shape this repo keeps recording.
 *
 * ONLY A ROUTE THE TRANSLATED SET REALLY HAS. The route tree is typed, so a
 * `<Link to="/es/menu">` with no `es/menu.tsx` behind it is a COMPILE error and
 * the whole site is lost to it — which is also why a language is all-or-nothing
 * across the page list. Anything else is left exactly as written: an external
 * URL, a `tel:`, a `#prices` anchor on the same page, an `/u/` upload.
 */
export function relinkForLang(source, prefix, routes) {
  const src = String(source || "");
  // BELT-AND-BRACES, AND SAID SO RATHER THAN LEFT LOOKING LOAD-BEARING. Removing
  // this cannot change the answer — with no prefix `prefixRoute` returns the
  // route untouched, so the replace below rewrites every link to itself — which
  // a mutation sweep confirmed by surviving. It is kept because that is an
  // emergent property of a function one edit away from changing, and because
  // "the primary language is never rewritten" is the guarantee that makes this
  // safe to add to a site that already exists; it should read locally, not rest
  // on what `prefixRoute` happens to do two functions down.
  if (!prefix) return src;
  const known = new Set((Array.isArray(routes) ? routes : []).map((r) => String(r || "")));
  let changed = 0;
  // `(?<![\w-])` RATHER THAN `\b`. A word boundary exists between the hyphen and
  // the `t` of `data-to=`, so `\b` matches a data attribute that has nothing to
  // do with routing — the anchoring class the hostname rewrite already recorded,
  // where `includes` matched what `startsWith` would not.
  const out = src.replace(/(?<![\w-])(to|href)(\s*[=:]\s*)(["'])(\/[^"'`\n]*)\3/g, (whole, attr, mid, q, route) => {
    // Already in this language, or in another one: leave it. A page that names
    // its own prefix is a link somebody wrote deliberately.
    //
    // ALSO BELT-AND-BRACES TODAY, and stated for the same reason as the guard
    // above: `known` only ever holds the PRIMARY language's routes, so
    // `/es/book` misses it and falls through untouched anyway — and a site with
    // a real page at `/es` cannot exist, because `resolveLangs` refuses a prefix
    // that shadows one. So this rests on two properties in two other functions,
    // which is exactly the kind of protection that reads local and is not.
    if (route === "/" + prefix || route.startsWith("/" + prefix + "/")) return whole;
    const [bare] = route.split("#");
    const hash = route.slice(bare.length);
    if (!known.has(bare)) return whole;
    changed++;
    return attr + mid + q + prefixRoute(bare, prefix) + hash + q;
  });
  return changed ? out : src;
}

/**
 * The whole translated page: source, path and declared route.
 *
 * THE ROUTE ID IS REWRITTEN IN THE SOURCE, not only in the filename — so
 * `es/book.tsx` says `createFileRoute("/es/book")` rather than leaving the
 * primary's `/book` inside a file that is not at that address.
 *
 * IT IS NOT LOAD-BEARING, AND THIS SAID IT WAS. The claim here was that the
 * generator "refuses it rather than picking one"; measured, on two real builds
 * differing only in that string, BOTH build and BOTH serve `/es/services` with
 * the Spanish page — `tsr generate` writes the tree from the FILE PATH and
 * corrects the call. So the bug this comment covered for (every non-home page
 * shipping the wrong declaration, because `bare` fell back to `"/"`) was latent
 * rather than fatal. The rewrite is kept because the source should say what the
 * file is and because `route` on the returned object is read as truth, and the
 * claim is corrected because a false one in a comment is what gets believed.
 */
export function pageForLang(page, prefix, routes) {
  const path = prefixPagePath(page && page.path, prefix);
  if (!path) return null;
  // DERIVED FROM THE PATH, because a stored page HAS NO `route` FIELD. This read
  // `page.route || "/"`, and `loadSiteSource` hands back `{path, source}` — so
  // `bare` was `"/"` for every page of every site, `declared === bare` was false
  // for everything but the home page, and the route id was left saying `/services`
  // inside `es/services.tsx`: two files declaring one address. It survived only
  // because `tsr generate` writes the tree from the FILE PATH and corrects the
  // call, so the comment above was describing a rewrite that happened once per
  // site. `routeOf` is the one reading of file→address this repo already has —
  // the alternative was a second copy of that rule living here.
  const bare = String((page && page.route) || routeOf((page && page.path) || "") || "/");
  const route = prefixRoute(bare, prefix);
  let source = relinkForLang(String((page && page.source) || ""), prefix, routes);
  if (prefix) {
    // Anchored on the call rather than on the string, so a page that merely
    // MENTIONS its own address in prose keeps saying so.
    source = source.replace(
      /createFileRoute\(\s*(["'])([^"'`\n]*)\1\s*\)/,
      (whole, q, declared) => (declared === bare || declared === bare + "/" ? "createFileRoute(" + q + route + q + ")" : whole),
    );
  }
  return { path, route, source };
}
