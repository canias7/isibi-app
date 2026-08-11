// The addon lane: add what the site does not have, and keep everything it does.
//
// THE RUNG BETWEEN EDIT AND BUILD. An edit changes what exists; a build makes a
// site from nothing and replaces every page. Neither can answer "add a gallery"
// honestly — the edit lane finds no target and a build costs ~25 credits and
// rewrites five pages that were fine.
//
// WHAT MAKES IT CHEAPER IS WHAT COMES BACK, not what goes out. The prompt still
// carries the whole site (input is ~5% of a warm build and rides in the cache);
// what changes is that the model returns ONLY the new page and the pages it had
// to touch to make it reachable, and this module merges that over the rest.
// Output is ~87% of what a build costs, so two files instead of six is most of
// the bill.
//
// THE NAV IS WHY IT IS NOT "AND NOTHING ELSE". Each generated page declares its
// own CHROME with its own links — there is no shared header file — so a new page
// nobody links to is a page nobody can reach. The one place this lane reaches
// beyond the thing it adds is the page a visitor would look on to find it.
//
// Plain module, no I/O, like `site-apply.mjs` beside it.

/** A returned set larger than this is not an addon, it is a rewrite wearing one. */
export const MAX_RETURNED = 6;

/**
 * Fold what the model returned over what the site already has.
 *
 * THE MERGE IS THE WHOLE FEATURE, and it is deliberately dumb: a returned path
 * replaces the stored page at that path, a path nobody returned is kept exactly
 * as it was, and a path that did not exist before is new. Nothing is deleted —
 * this lane ADDS, and "return every page and I will infer the deletions" is the
 * revise's contract, not this one. An addon that could delete would turn a model
 * returning two files into a site of two pages.
 *
 * Returns the FULL page set, because that is what the container needs: it wipes
 * `src/routes` and writes what it is given, so handing it the subset would
 * publish a site consisting of the new page alone.
 */
export function mergeAddonPages(prior, returned) {
  const base = (Array.isArray(prior) ? prior : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string");
  const got = (Array.isArray(returned) ? returned : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string" && p.source.trim());
  if (!got.length) return { ok: false, reason: "nothing-returned" };
  if (got.length > MAX_RETURNED) return { ok: false, reason: "too-many", count: got.length };

  const had = new Set(base.map((p) => p.path));
  const byPath = new Map(base.map((p) => [p.path, { path: p.path, source: p.source }]));
  const added = [], changed = [];
  for (const p of got) {
    const same = byPath.has(p.path) && byPath.get(p.path).source === p.source;
    byPath.set(p.path, { path: p.path, source: p.source });
    if (!had.has(p.path)) added.push(p.path);
    // A RETURNED PAGE THAT IS BYTE-IDENTICAL IS NOT A CHANGE, and saying so
    // matters: it is what the customer is told happened, and "changed 4 pages"
    // when three came back untouched is the report that makes somebody go
    // looking for damage that is not there.
    else if (!same) changed.push(p.path);
  }
  if (!added.length && !changed.length) return { ok: false, reason: "no-change" };
  return { ok: true, pages: [...byPath.values()], added, changed };
}

/**
 * Did this addon leave its new page reachable?
 *
 * NOT AN ERROR, A NOTE. A page with no link is a real failure — a visitor cannot
 * get to it and the owner will report the feature as not working — but refusing
 * the publish over it is worse: the page exists, it compiles, and the owner can
 * ask for the link in one more sentence. Refusing would throw the work away and
 * charge for it.
 *
 * Checked crudely on purpose. A link can be written a dozen ways (`SiteLink`, a
 * `links` entry, an `action`, a `Link to=`), and a checker that understands only
 * some of them reports a working site as broken — which this repo has recorded
 * costing more than the miss it prevents. So: does the path appear anywhere in
 * any other page's source, at all.
 */
export function unlinkedPages(pages, added) {
  const list = Array.isArray(pages) ? pages : [];
  const fresh = Array.isArray(added) ? added : [];
  const out = [];
  for (const path of fresh) {
    const route = routeOf(path);
    if (!route) continue;
    const linked = list.some((p) => p && p.path !== path && typeof p.source === "string" && p.source.includes('"' + route + '"'));
    if (!linked) out.push(route);
  }
  return out;
}

/**
 * The URL a generated route file answers on.
 *
 * `src/routes/index.tsx` is `/`, `src/routes/gallery.tsx` is `/gallery`. Only
 * used to look for a link, so an unrecognised shape answers "" and is skipped
 * rather than guessed at — a wrong route here would report a linked page as
 * orphaned.
 */
export function routeOf(path) {
  const m = String(path || "").match(/^src\/routes\/(.+)\.tsx$/i);
  if (!m) return "";
  const rel = m[1];
  if (rel === "index") return "/";
  if (rel.endsWith("/index")) return "/" + rel.slice(0, -"/index".length);
  return "/" + rel;
}

/**
 * What the customer is told, in one line.
 *
 * NAMES THE PAGES. "Done" tells somebody nothing they can check, and this lane
 * can touch a page they did not ask about — the nav link — so not saying which
 * is how a legitimate change reads as their site being altered behind them.
 */
export function addonReply({ added = [], changed = [], unlinked = [] } = {}) {
  const bits = [];
  if (added.length) bits.push("added " + added.map(routeOf).filter(Boolean).join(", "));
  if (changed.length) bits.push("linked it from " + changed.map(routeOf).filter(Boolean).join(", "));
  const head = bits.length ? "✅ Done — " + bits.join(", ") + "." : "✅ Done.";
  if (!unlinked.length) return head;
  // Said plainly, because the owner is about to look for a page they cannot
  // find, and the fix is one sentence from them.
  return head + " Nothing links to " + unlinked.join(", ") + " yet — say where you want the link and I'll add it.";
}
