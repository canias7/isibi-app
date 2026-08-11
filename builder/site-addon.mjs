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
 * WHAT AN ADDON MAY CHANGE ABOUT A TABLE THE SITE ALREADY HAS.
 *
 * Exactly the two features that need a PAGE as well as a schema change, which is
 * what makes them this lane's and not the `rules` layer's:
 *
 *   payment    — a table becomes payable, and a page needs a Buy button.
 *   publicView — a read-only projection, and a page needs `usePublicRows`.
 *
 * Everything else about an existing table belongs to `rules`, which publishes
 * nothing. Two lanes able to change one thing is two answers that can disagree.
 */
export const ADDON_TABLE_FIELDS = ["payment", "publicView"];

/**
 * Fold a designed schema over the site's stored one.
 *
 * WHAT THIS FIXES. `normalizeSchema`'s dedup is "first declaration wins, and
 * later ones contribute any COLUMNS the first did not have" — written for the
 * BUILD path, where two tables of one name is a model mistake and first-wins is
 * the protection that stopped a duplicate destroying the first's guarantees.
 * The addon lane concatenated `[...prior, ...designed]` straight into it, so on
 * a table that already existed the designer's `payment` and `publicView` were
 * dropped SILENTLY. Measured through the real normaliser. That is why a site
 * built without a price could never start taking money.
 *
 * A COMPELLED FIELD IS NOT A STATEMENT OF INTENT, AND THAT IS THE WHOLE SAFETY
 * ARGUMENT HERE. `design_schema` requires `["name", "access", "columns"]` on
 * every table, so a designer asked to make `bookings` payable MUST also answer
 * `access` — and whatever it answers is compliance with a schema, not a decision
 * about who may read a real business's booking list. Taking it would let "let
 * people pay for these" quietly publish every customer's name and phone number.
 * So `access`, `read` and `write` are IGNORED on a table that already exists;
 * moving them is the `rules` layer, whose own tool leaves them optional, so a
 * value there really is something somebody asked for.
 *
 * A COLUMN IS NEVER REMOVED AND A TABLE IS NEVER DROPPED, for the reason
 * `mergeRules` gives: `_meta` is what the data API derives from, so dropping a
 * column hides it from every read while the values sit in Postgres.
 */
/**
 * The spec-level tiers an addon may declare, beyond its tables.
 *
 * ALL THREE WERE DROPPED ON THIS PATH, measured: the route passed
 * `{ tables: … }` and nothing else, so `normalizeSchema` never saw them. That
 * is the entire "the model writes the backend" tier — an inbound webhook
 * handler, a confirmation computed by SQL, a third-party read — unreachable on
 * any site after its first build.
 *
 * They are name-keyed lists, so passing only what the designer NAMED is right:
 * `applySiteSchema` seeds `_meta` from the stored spec before merging, so a
 * function nobody mentioned stays recorded, and one that is mentioned is
 * `CREATE OR REPLACE`d. Rate limits are deliberately NOT here — an addon does
 * not ask for them, and the erase semantics are a separate question.
 */
export const ADDON_SPEC_FIELDS = ["functions", "apis", "jobs"];

export function mergeAddonSchema(prior, designed) {
  const priorTables = Array.isArray(prior) ? prior : (prior && Array.isArray(prior.tables) ? prior.tables : []);
  const designedSpec = Array.isArray(designed) ? { tables: designed } : (designed && typeof designed === "object" ? designed : {});
  const designedTables = Array.isArray(designedSpec.tables) ? designedSpec.tables : [];
  const base = priorTables.filter((t) => t && t.name).map((t) => ({ ...t }));
  const byName = new Map(base.map((t) => [String(t.name).toLowerCase(), t]));
  const added = [], altered = [];

  for (const d of designedTables) {
    if (!d || !d.name) continue;
    const key = String(d.name).toLowerCase();
    const have = byName.get(key);
    // A TABLE THE SITE DOES NOT HAVE IS APPENDED WHOLE, exactly as before. This
    // is the ordinary addon and nothing about it changes.
    if (!have) {
      const copy = { ...d };
      base.push(copy);
      byName.set(key, copy);
      added.push(copy.name);
      continue;
    }
    const fields = [];
    for (const k of ADDON_TABLE_FIELDS) {
      if (d[k] === undefined || d[k] === null) continue;
      have[k] = d[k];
      fields.push(k);
    }
    // NEW COLUMNS ONLY. This is what `normalizeSchema`'s dedup already did, kept
    // deliberately: "add a photo to the booking form" is a real addon, and it is
    // the one part of the old behaviour that was right.
    const has = new Set((Array.isArray(have.columns) ? have.columns : [])
      .map((c) => String(typeof c === "string" ? c : (c && c.name) || "").toLowerCase()).filter(Boolean));
    for (const c of Array.isArray(d.columns) ? d.columns : []) {
      const name = String(typeof c === "string" ? c : (c && c.name) || "").toLowerCase();
      if (!name || has.has(name)) continue;
      have.columns = [...(Array.isArray(have.columns) ? have.columns : []), c];
      has.add(name);
      fields.push("column " + name);
    }
    if (fields.length) altered.push({ table: have.name, fields });
  }

  // The three spec-level tiers, carried only when the designer named one, so a
  // build that declares nothing sends exactly what it sent before.
  const spec = { tables: base };
  const declared = [];
  for (const k of ADDON_SPEC_FIELDS) {
    const v = designedSpec[k];
    if (!Array.isArray(v) || !v.length) continue;
    spec[k] = v;
    declared.push(k);
  }
  return { spec, tables: base, added, altered, declared };
}

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
export function mergeAddonPages(prior, returned, remove) {
  const base = (Array.isArray(prior) ? prior : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string");
  const got = (Array.isArray(returned) ? returned : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string" && p.source.trim());
  // A REMOVAL IS WORK EVEN WITH NO PAGE BEHIND IT, and reading it as an empty
  // answer is how the commonest deletion there is stayed expensive: take away a
  // page nothing links to and the model correctly returns no files at all, which
  // this refused as `nothing-returned` — straight up the ladder to the ~25-credit
  // revise the lane exists to undercut. Found by a mutant, not by reading.
  const wants = (Array.isArray(remove) ? remove : []).some((r) => typeof r === "string" && r);
  if (!got.length && !wants) return { ok: false, reason: "nothing-returned" };
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
  // ── TAKING A PAGE AWAY ────────────────────────────────────────────────────
  //
  // Allowed here and NOT in the data layer, and the difference is whether it can
  // be undone: every publish is archived and there is a restore route, so a page
  // deleted by mistake is one click from coming back. A deleted ROW has no such
  // record, which is why that layer echoes what it removed instead.
  //
  // Before this, "remove the gallery page" fell through the merge (which only
  // ever added), came back `no-change`, escalated, and cost a ~25-credit full
  // revise to do by omission — about twelve times what it should.
  const gone = [];
  const kept = [];
  for (const raw of Array.isArray(remove) ? remove.slice(0, MAX_RETURNED) : []) {
    const path = typeof raw === "string" ? raw : "";
    if (!byPath.has(path)) continue;                       // nothing to remove
    if (added.includes(path) || changed.includes(path)) continue; // written and removed in one breath
    // THE HOME PAGE IS NEVER REMOVABLE. It is the one address a customer shares,
    // and a site whose root renders nothing is worse than any page they wanted
    // gone. Same rule the salvage already applies to a build with no index.
    if (routeOf(path) === "/") { kept.push({ path, why: "home" }); continue; }
    // A LINK POINTING AT A ROUTE THAT NO LONGER EXISTS DOES NOT COMPILE, so
    // deleting a page nothing was told to unlink would fail the whole change and
    // leave the site untouched — 20-40s of container time to achieve nothing,
    // and a TypeScript error the owner cannot act on. Refused here instead, with
    // the pages that still point at it named.
    const route = routeOf(path);
    const linkers = [...byPath.values()]
      .filter((p) => p.path !== path && !gone.includes(p.path) && typeof p.source === "string" && p.source.includes('"' + route + '"'))
      .map((p) => p.path);
    if (linkers.length) { kept.push({ path, why: "linked", from: linkers.slice(0, 4) }); continue; }
    byPath.delete(path);
    gone.push(path);
  }

  // ── AN ADDON MAY NOT REWRITE THE PAGES IT WAS NOT ASKED ABOUT ─────────────
  //
  // MEASURED LIVE, first run of `edit smoke`: "add a gallery page" came back
  // having changed index, book, manage AND work — four of the site's four
  // existing pages — for 28 credits, which is a whole build's price for an
  // addition. The prompt says "RETURN ONLY WHAT IS NEW OR CHANGED… returning one
  // unchanged bills the customer for retyping their own site", and the model
  // returned everything anyway. A rule a model is merely TOLD is not a rule —
  // the same reasoning that put `MAX_CLARIFY` in code rather than in a schema
  // description.
  //
  // THE JUSTIFICATION IS REACHABILITY, which is the module's own stated reason
  // for touching anything beyond the new page: "the one place this lane reaches
  // beyond the thing it adds is the page a visitor would look on to find it." So
  // a changed page keeps its change if it MENTIONS a route that was added or
  // removed — it is carrying the link, or it is dropping one that would no
  // longer compile. Anything else is a rewrite nobody asked for, and it is
  // reverted to what the customer already had.
  //
  // IT DOES NOT APPLY WHEN NOTHING WAS ADDED OR REMOVED. "Put testimonials on the
  // home page" is an addon whose whole content is a changed page, and the prompt
  // tells the model to do exactly that; there is no route to point at, and
  // reverting there would throw away the entire request.
  const reverted = [];
  if (added.length || gone.length) {
    const routes = [...added, ...gone].map(routeOf).filter(Boolean);
    for (const path of changed.slice()) {
      const src = (byPath.get(path) || {}).source || "";
      const was = base.find((p) => p.path === path);
      if (!was) continue;
      // BOTH SIDES, AND THE SECOND ONE IS LOAD-BEARING RATHER THAN THOROUGH.
      // On a REMOVAL the model's new source is the one with the link taken OUT,
      // so it mentions nothing; the stored source is the one that still points
      // at the deleted route. Checking only the new source would revert exactly
      // that page — putting back a `<Link to="/gallery">` for a route that no
      // longer exists, which does not compile, on the one path where the
      // removal loop above has already satisfied itself that nothing links to it.
      if (routes.some((r) => src.includes('"' + r + '"') || was.source.includes('"' + r + '"'))) continue;
      byPath.set(path, { path, source: was.source });
      changed.splice(changed.indexOf(path), 1);
      reverted.push(path);
    }
  }

  if (!added.length && !changed.length && !gone.length) {
    // A REFUSAL IS NOT AN ABSENCE OF WORK, and the difference decides whether
    // the customer is charged ~25 credits for asking a question. `no-change`
    // escalates: the rung above rewrites the whole site, which is right when
    // this lane simply could not answer. But "remove the home page" HAS an
    // answer — no, and here is why — and sending that up the ladder rebuilds
    // their site in reply to a request that should have been one sentence.
    if (kept.length) return { ok: false, reason: "kept", kept, msg: keptReply(kept) };
    return { ok: false, reason: "no-change" };
  }
  return { ok: true, pages: [...byPath.values()], added, changed, removed: gone, kept, reverted };
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
/**
 * The pages we would not delete, and why — one composition, two readers.
 *
 * It is BOTH half of a success reply and the WHOLE of a refusal: an addon whose
 * every removal was refused did no other work, so this sentence is all there is
 * to say. Two copies of it drift into a refusal that explains itself and a
 * success that keeps a page silently, which is the partial this lane already had
 * once.
 */
export function keptReply(kept) {
  let out = "";
  for (const k of Array.isArray(kept) ? kept.slice(0, 3) : []) {
    if (!k || !k.path) continue;
    out += k.why === "home"
      ? " I left " + routeOf(k.path) + " — that is the home page, and removing it would leave the site with no front door."
      : " I left " + routeOf(k.path) + " — " + (k.from || []).map(routeOf).filter(Boolean).join(", ") +
        " still link" + ((k.from || []).length === 1 ? "s" : "") + " to it. Ask me to take the link out first.";
  }
  return out;
}

export function addonReply({ added = [], changed = [], removed = [], kept = [], unlinked = [], reverted = [] } = {}) {
  const bits = [];
  if (added.length) bits.push("added " + added.map(routeOf).filter(Boolean).join(", "));
  if (removed.length) bits.push("removed " + removed.map(routeOf).filter(Boolean).join(", "));
  if (changed.length) bits.push("linked it from " + changed.map(routeOf).filter(Boolean).join(", "));
  let head = bits.length ? "✅ Done — " + bits.join(", ") + "." : "✅ Done.";
  // A PAGE WE REFUSED TO DELETE IS SAID PLAINLY, with the reason. Silently
  // keeping it is the silent partial this lane already had once: the owner asks
  // for it gone, is told the change worked, and it is still there.
  head += keptReply(kept);
  // A REVERT IS SAID OUT LOUD. It is the customer's own page being put back, so
  // staying quiet about it is the silent partial this lane has already had twice
  // — and if the model really was asked to change that page, this sentence is
  // how they find out it did not stick.
  const back = (Array.isArray(reverted) ? reverted : []).map(routeOf).filter(Boolean).slice(0, 3);
  if (back.length) {
    head += " I left " + back.join(", ") + " as " + (back.length === 1 ? "it was" : "they were") +
      " — nothing there needed to change for this. Ask me directly if you did want " +
      (back.length === 1 ? "it" : "them") + " edited.";
  }
  if (!unlinked.length) return head;
  // Said plainly, because the owner is about to look for a page they cannot
  // find, and the fix is one sentence from them.
  return head + " Nothing links to " + unlinked.join(", ") + " yet — say where you want the link and I'll add it.";
}
