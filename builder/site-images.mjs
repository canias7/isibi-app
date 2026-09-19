// Real photographs on a generated site.
//
// Until this, every picture on every site the builder made was `SafeImage`'s
// placeholder — a duotone wash with the alt text as a caption. That fallback is
// designed rather than apologised for (see safe-image.tsx) and it stays the
// answer whenever a photograph cannot be had, which turns out to be most of the
// design here: an image costs REAL MONEY, far more than the whole rest of a
// build, so almost every decision in this file is about not spending it.
//
// THE NUMBER TO KEEP IN YOUR HEAD: one image is $0.15, which is ~19 credits.
// A whole warm build — two model calls, ~27k cached tokens, ~10k of output — is
// about 21. So ONE picture roughly doubles the price of a site and six roughly
// sextuple it. That is why the budget is derived rather than "as many as the
// model asks for", why it is capped, and why it degrades to zero on a balance
// that cannot carry it instead of refusing the build.
//
// HOW MANY A SITE GETS DEPENDS ON THE TYPE OF PAGE (owner's call, 2026-08-08),
// with a hard cap of 6 on a first build. `imagesForPage` is that rule and
// `imageBudget` is its sum over the family's own page set — so a docs site and a
// wedding photographer do not get the same allowance because they do not have
// the same pages. Nothing here is hand-authored per family: it reads what
// the family table already declared, which is what stopped 324 page entries from
// needing 324 judgement calls that would go stale the first time a family moved.
//
// Pure logic, no I/O — the same shape as site-plan.mjs and site-fonts.mjs, so
// all of it is tested outside the Worker. Generating and storing the bytes is
// the caller's half; this module decides what to ask for and what to do with the
// answer.


import { PUBLISH_RESERVE_MS } from "./build-budget.mjs";
// THE KEY GRAMMAR IS `site-picture.mjs`' AND IS IMPORTED RATHER THAN RESTATED —
// see `imageRefs` below. That module imports `site-addon.mjs` and
// `build-models.mjs`, both of which import nothing, so there is no cycle.
import { KEY_BEFORE, keyName } from "./site-picture.mjs";

/* ------------------------------------------------------- the clock, not the money */

/**
 * HOW LONG A PHOTOGRAPH TAKES, so a build can tell in advance whether it has
 * time to buy one at all.
 *
 * CALIBRATED AGAINST THE BUILDS THAT BOUGHT ONE, never chosen: the image step
 * lands in a band of **24.7s to 32.6s** on builds that got a photograph — run 35
 * measured 28,089ms squarely inside it — against 110ms and 151ms on two builds
 * that bought none. So a shot has never been observed to land in under ~24.7s,
 * and the slowest took ~32.6s. Run 37's 22,422ms is NOT evidence about a shot:
 * that is the race timer expiring, which is the bug this exists to fix.
 *
 * ABOVE THE SLOWEST RATHER THAN THE FASTEST, and the direction is the whole
 * decision. Being wrong toward NOT buying costs one placeholder on a site whose
 * owner can ask again — `budgetFor` returns 0 only when the stored pages already
 * carry a `/u/<slug>/` URL, and a swept placeholder carries none, so a revise
 * really does buy. Being wrong the other way costs real money for a picture
 * nobody sees, an orphan in the owner's file allowance, and a wrong `og:image`.
 * The cheap mistake is the one to make.
 *
 * n IS THREE, WHICH IS SMALL, and this number is the first thing to re-measure
 * once there are more builds to read. A `compile` mark that is neither ~0.1s nor
 * in the 24-33s band is evidence about this constant.
 */
export const PHOTO_FLOOR_MS = 35000;

/**
 * HOW LONG THE PHOTOGRAPHS MAY BE WAITED FOR.
 *
 * Everything else in this file is about not spending MONEY on a picture. This
 * one is about not spending the build's last minutes on one — a different
 * currency and the one that has actually cost sites.
 *
 * WHY THIS STEP AND NOT ANOTHER. The build runs gen -> img -> compile ->
 * container -> og -> pages. Running out of time HERE leaves a complete set of
 * pages that can still be compiled and published, with `SafeImage`'s own
 * placeholder where a picture would have been — the fallback this whole file is
 * designed around. Running out of time at any later step leaves nothing.
 *
 * MEASURED. `northgroup` (2026-08-25) spent 619,822ms here, 74% of the 836s it
 * had lived when Cloudflare stopped its consumer at fifteen minutes, mid
 * container: its pages existed and nothing published them. `oak-and-ash`, the
 * build that did publish, spent 304,402ms and had room. The whole difference
 * between a live site and a 404 was this step.
 *
 * THREE ANSWERS, and collapsing any two of them is a bug:
 *
 *   `all`  — there is no clock. The old behaviour EXACTLY: wait for every shot.
 *            One caller supplies a budget today, and a second that knows nothing
 *            about a build must not have its pictures cut short by a bound it
 *            never set. Being wrong that way is silent and shows up as a site
 *            missing photographs nobody can account for.
 *   `race` — wait, but only for the time ABOVE the reserve. NOT `remainingMs()`:
 *            a wait that ends with nothing left is a bounded image step and
 *            still no site, which fixes nothing.
 *   `none` — there is not enough time above the reserve for a shot to land, so
 *            NOTHING IS BOUGHT. `buy` is false and no shot is fired.
 *
 * `buy` IS THE HALF THIS ANSWERED WRONG UNTIL RUN 37, and the arithmetic is
 * exact. That build reached this step with 262,422ms left, so the race got
 * 22,422ms — and its `compile` mark is 22,422ms to the millisecond, which is the
 * timer expiring rather than an image model finishing. The shot was fired
 * anyway, the wait gave up, `applyImages` swept the unmatched token to the
 * placeholder, and the photograph landed in R2 a moment later: money spent, an
 * orphan permanently occupying a slot in the owner's 200-file library, the
 * site's `og:image` pointing at a picture on none of its pages, and `imageNote`
 * falling through to *"Couldn't make the photographs"* — the image-model-failed
 * sentence, said about a shot that succeeded.
 *
 * SO THE CLOCK NOW BOUNDS THE SPEND AND NOT ONLY THE WAIT. This used to say of
 * `none` that the shots "have been started and that spend is committed either
 * way", which described the behaviour accurately and treated it as a given. It
 * is not: whether to start is ours to decide, from the same reading of the same
 * clock, one subtraction before a penny is spent.
 *
 * `all` STILL BUYS, and that is not an oversight. No clock means a caller that
 * set no bound, and refusing to buy there would silently stop photographs on
 * every such build — the regression `all` exists to prevent, arriving through
 * the money instead of the wait.
 *
 * A CLOCK THAT THROWS IS NO CLOCK, which is `build-budget.mjs`'s own rule one
 * layer up: a broken clock reads as "plenty of time", because refusing a healthy
 * build is the more expensive mistake and this is not what the customer paid for.
 */
export function photoWait(clock, reserve = PUBLISH_RESERVE_MS, floor = PHOTO_FLOOR_MS) {
  let left = null;
  try {
    if (clock && typeof clock.remainingMs === "function") {
      const n = clock.remainingMs();
      if (typeof n === "number" && Number.isFinite(n)) left = n;
    }
  } catch { left = null; }
  if (left === null) return { wait: "all", ms: null, buy: true };
  // A NONSENSE RESERVE IS THE REAL ONE, never zero. Read as zero it would mean
  // "wait for everything", which is the bug; read as the default it means the
  // ordinary build. Same direction `makeBudget` takes with a nonsense budget.
  const r = typeof reserve === "number" && Number.isFinite(reserve) && reserve > 0 ? reserve : PUBLISH_RESERVE_MS;
  const f = typeof floor === "number" && Number.isFinite(floor) && floor > 0 ? floor : PHOTO_FLOOR_MS;
  const spare = left - r;
  // `>=`, so a build with exactly a shot's worth of headroom buys. The boundary
  // has to fall somewhere and the floor is already the SLOWEST observed shot, so
  // landing exactly on it is the case the number was chosen to admit.
  return spare >= f ? { wait: "race", ms: spare, buy: true } : { wait: "none", ms: 0, buy: false };
}

/* ------------------------------------------------------------ the budget */

/**
 * The hard ceiling on a first build. Owner's call.
 *
 * It is HEADROOM over the derived defaults rather than a limit on them — the
 * most any family asks for today is 5 — and it binds in the other direction,
 * on what the MODEL emits. The prompt states the allowance and a model is not
 * a promise: a page set that writes twelve tokens gets six pictures and the
 * placeholder for the rest, which is a site that still works.
 */
export const IMAGE_CAP = 6;

/**
 * Components a family reaches for when pictures are the CONTENT — a gallery, a
 * masonry wall, a before-and-after. Derived from what families already declare,
 * deliberately: the owner picked those component lists per family, so this is
 * their judgement about the trade rather than a second one of mine that can
 * disagree with it.
 *
 * `safe-image` is NOT in this set even though 26 families name it. It is the
 * guard every image on every page goes through, so it says a page HAS a picture
 * and nothing at all about whether pictures are what the page is for.
 */
const PICTURE_LED = new Set([
  "gallery", "masonry", "lightbox", "before-after", "progressive-image", "image-strip",
]);

/**
 * Does this component list treat pictures as content rather than as decoration?
 *
 * TAKES THE LIST, NOT A FAMILY NAME, since 2026-08-20: the component list is
 * authored per site now, so the question this asks has one answer and two places
 * it can come from. One predicate rather than two that can disagree about what
 * "picture-led" means.
 */
export function componentsAreContent(components) {
  return Array.isArray(components) && components.some((c) => PICTURE_LED.has(c));
}

/* THE FAMILY-KEYED IMAGE BUDGET IS GONE (2026-08-20).
 *
 * `picturesAreContent(family)`, `imagesForPage(family, page)` and
 * `imageBudget(family)` derived a site's photograph allowance from the family
 * table's own page set and component list. That table went with the families,
 * and `planBudget` below applies what is left of those rules — the home page
 * gets one, any other page gets one only where the components say pictures are
 * the content — over the plan the designer wrote for THIS site. (The third,
 * which keyed on `structure`, went with that field on 2026-08-20; the cost is
 * recorded on `planBudget` itself.)
 *
 * TWO THINGS FELL AWAY CLEANLY RATHER THAN NEEDING A REPLACEMENT. `alt` was an
 * alternative home page, a property of a REFERENCE app so one family could ship
 * two designs; a generated site has never had one. And the per-page `img`
 * override existed for a stated blind spot — the derivation read the FAMILY's
 * component list, so `salon/work` was a gallery on a family whose components are
 * all booking widgets — which is precisely the question the designer now answers
 * directly, per site, having written the page list first.
 */

/**
 * Does this site ALREADY show photographs it paid for?
 *
 * THE QUESTION A REVISE SHOULD ASK, and it was asking a different one. The rule
 * was `revise ? 0 : imageBudget(family)`, which is right about the case it was
 * written for — a revise re-derives the same budget and the model writes fresh
 * descriptions, so nothing matches what was bought last time and a customer
 * revising a 5-photo site paid ~94 credits for pictures they already owned.
 *
 * It assumes a revise means the site HAS pictures. A site whose FIRST build
 * failed has none — images are bought after the pages validate, so a generation
 * that returns nothing never reaches them — and from that moment every attempt
 * is a revise, because a revise is decided by ownership. Measured live
 * 2026-08-10 on a real site: first build died at `stage: validate`, every retry
 * after it was a revise, and the site could never get a photograph however many
 * times it was rebuilt. Same shape as the `publicView` bug — a rule correct
 * about its own case and silently wrong about the one beside it.
 *
 * Asked of the STORED PAGES rather than by listing R2, for two reasons. They are
 * already loaded on every revise (`loadSiteSource`), so this costs no I/O. And
 * they answer the question that actually matters — whether the site DISPLAYS a
 * photograph — where the upload library would answer "are there files", which is
 * true of an owner who uploaded a logo and would suppress photographs forever.
 *
 * UNREADABLE PAGES ANSWER TRUE, i.e. buy nothing. A site built before the source
 * was stored hands back null, and guessing "no photographs" there would re-buy
 * the whole set on the next revise — the expensive mistake this rule exists to
 * prevent. Not knowing must cost nothing.
 */
export function sitePhotoUrl(slug) {
  return "/u/" + String(slug || "").toLowerCase() + "/";
}

export function hasBoughtPhotos(pages, slug) {
  if (!Array.isArray(pages)) return true;   // unknown → spend nothing
  const mark = sitePhotoUrl(slug);
  if (!slug) return true;
  return pages.some((p) => p && typeof p.source === "string" && p.source.includes(mark));
}

/**
 * HOW MANY PHOTOGRAPHS THIS SITE REALLY SHOWS — AND WHETHER WE CAN TELL
 * (2026-09-17).
 *
 * `hasBoughtPhotos` answers the SPENDING question and its unknown case is
 * deliberately `true` — not knowing must cost nothing. That direction is
 * exactly wrong for DESCRIBING the site to a model: read as a description,
 * "unknown" would become "this site has photographs" when nothing was read.
 * And the reverse is worse, which is what this exists for: the addon told
 * every page writer *"PHOTOGRAPHS: none on this site"* whatever the site had —
 * measured through the real route on a site showing two — so a page added to a
 * photographed site was written by a model that believed there were none, on a
 * step whose own `ADD_DESIGN_RULE` says to keep the site's design system.
 *
 * SO IT IS THREE-STATE, and `known` is the whole point: a caller that cannot
 * tell must say nothing rather than pick a side. The same reason
 * `readSiteParts` answers `{ok, parts, why}` rather than `null`.
 *
 * DISTINCT URLs, not occurrences: the same photograph repeated in two bands is
 * one photograph, and counting the repeats would tell a designer the site is
 * richer than it is.
 */
export function shownPhotos(pages, slug) {
  if (!Array.isArray(pages) || !slug) return { known: false, count: 0, urls: [] };
  const seen = new Set();
  for (const p of pages) for (const u of photoUrls(p && p.source, slug)) seen.add(u);
  // ── AND THE URLs THEMSELVES, BECAUSE A COUNT CANNOT BE COPIED (2026-09-19)
  //
  // A page writer told *"this site already shows 2 photographs"* and given
  // nothing else can protect them and cannot REUSE one: showing a picture the
  // owner already paid for on a new page needs its exact `src`, and until today
  // the directive carried no `/u/` url at all (measured: zero, in all three
  // forms). The capability was there the whole time — a copied url passes
  // `keptImages`, survives `applyImages` byte-identical and adds no spend — and
  // nothing invited it.
  //
  // `count` STAYS THE DISTINCT TOTAL AND THE LIST MAY BE SHORTER. The count is
  // what the protection sentence is about and must be true of the whole site;
  // the list is what may be copied, and a cap on it is a cap on the prompt, not
  // a claim about the site. `MAX_KEEP_URLS` is 12 against a measured real-site
  // maximum of 3 (`fold-lane-bakery`), so today it never cuts — and when it
  // does, the clause says the list is partial rather than letting a shorter
  // list read as a smaller site.
  //
  // SORTED, so two reads of one site produce one prompt: the set's order is
  // the order the files happened to be walked in, and a prompt that moves for
  // no reason is a cache miss and an unreadable diff.
  const urls = [...seen].sort();
  return { known: true, count: seen.size, urls: urls.slice(0, MAX_KEEP_URLS) };
}

/** How many of a site's own photograph urls the directive will list. */
export const MAX_KEEP_URLS = 12;

/**
 * THE PHOTOGRAPHS ONE FILE SHOWS — this site's own, by exact URL (2026-09-17).
 *
 * ONE READER, because the COUNT a designer is told and the WALL that refuses a
 * change which drops one are the same question asked twice, and two spellings
 * of "an image reference this site owns" is how they come to disagree about a
 * picture somebody paid for.
 *
 * SCOPED TO THIS SITE'S OWN PREFIX. A kit illustration, a data URI and another
 * site's upload are all `src` attributes and none of them is a photograph this
 * platform bought for this owner — `sitePhotoUrl` is the one definition of the
 * prefix, and it is where `hasBoughtPhotos` and `makeSitePhoto` both write.
 *
 * THE SLUG TEST FOLDS CASE AND THE URL DOES NOT, and the asymmetry is
 * deliberate. A slug is lowercased at every door this platform has, so folding
 * there admits the `/u/FW/…` a model may type for `fw` — while the rest of the
 * path is an R2 KEY, where a re-cased hash is a different object and therefore
 * a broken image. So `/u/fw/A1.jpg` is a photograph of this site's that the
 * wall must see LOST when it comes back as `/u/fw/a1.jpg`, which is exactly
 * what an exact comparison says and a folded one would miss. `/u/` itself is
 * ours to write and is matched literally.
 */
export function photoUrls(source, slug) {
  const out = new Set();
  if (typeof source !== "string" || !slug) return out;
  const mark = sitePhotoUrl(slug);
  for (const m of source.matchAll(/["'](\/u\/[^"']+)["']/g)) {
    if (m[1].toLowerCase().startsWith(mark)) out.add(m[1]);
  }
  return out;
}

/**
 * EVERY PHOTOGRAPH THE SITE SHOWED IS STILL SHOWN — the wall (2026-09-17).
 *
 * Owner: *"prevent an addon that buys new photographs from accepting removal or
 * replacement of existing image references in pages and custom components."*
 *
 * REPRODUCED THROUGH THE REAL ROUTE FIRST. The paid directive's own tail said
 * *"any other picture stays a `<SafeImage>` with no src… that is the intended
 * look for the rest of the site"*, which on a site showing two bought
 * photographs is an instruction to strip them — and the writer did: the
 * compiler payload and the stored source both came back with ZERO `/u/` urls,
 * the customer was told *"Made 1 photograph for the site."*, and the two
 * stripped pictures were counted as empty frames this change had ADDED. The
 * directive is corrected above; this is the wall behind the correction, in the
 * shape `keptProse` already has one rung over: a change that would lose one is
 * refused before the gate and the bill.
 *
 * SITE-WIDE, NEVER PER FILE, and that is the whole of why this takes two LISTS
 * rather than two strings. `keptProse` asks per page because words belong to
 * the page they are on; a photograph does not — a writer moving a
 * `<SafeImage>` out of the home page and into a new `-parts/gallery-grid.tsx`
 * has kept every picture the site shows, and a per-file wall would refuse
 * exactly that legitimate reorganisation. The question the customer has is
 * *"does my site still show the pictures I paid for"*, and this asks it.
 *
 * PAGES AND COMPONENTS TOGETHER, through `imageSources` — the one definition of
 * "every generated file that can carry a photograph" — so a component is not a
 * second wall beside this one.
 *
 * REPLACEMENT IS REMOVAL HERE, deliberately: a `src` swapped for a different
 * `/u/` url loses the first, which is what the owner's "removal or replacement"
 * names as one thing. An ADDITION is invisible to this — the whole point of the
 * step is that it may add.
 */
export function keptImages(before, after, slug) {
  const had = new Set();
  for (const p of Array.isArray(before) ? before : []) {
    for (const u of photoUrls(p && p.source, slug)) had.add(u);
  }
  if (!had.size) return { ok: true, lost: [] };
  const now = new Set();
  for (const p of Array.isArray(after) ? after : []) {
    for (const u of photoUrls(p && p.source, slug)) now.add(u);
  }
  const lost = [...had].filter((u) => !now.has(u));
  return { ok: !lost.length, lost };
}

/**
 * ── A `src` THIS SITE DOES NOT OWN NEVER SHIPS (2026-09-19) ────────────────
 *
 * The wall behind the reuse permission, and it is `keptImages` turned round:
 * that one asks which of the site's photographs went MISSING, this one asks
 * which `/u/<slug>/` urls APPEARED that the site never had. Both are additions
 * as far as the other is concerned, which is why one function cannot answer
 * both — measured before this existed: an invented
 * `/u/fw/deadbeef….jpg` passed `keptImages` (`{ok: true, lost: []}`), came
 * through `applyImages` byte-identical (the sweep rewrites `@@IMG:` tokens and
 * this is not one) and `photoUrls` read it as this site's, so it would have
 * published as a broken image on a real customer's page.
 *
 * SWEPT TO EMPTY, NOT REFUSED, and the precedent is exact. `applyImages`
 * already answers an unbought token by writing `src=""` — the page ships, the
 * frame becomes a real slot the picture rung can fill, and `newEmptySlots`
 * counts it so the customer is told about it in the sentence that already
 * exists. Refusing the whole change instead would cost a customer their page
 * and their QR code over one wrong path in one attribute.
 *
 * ASKED BEFORE THE PURCHASE, because after it every photograph this change
 * bought is a url the site did not have and would read as invented. At the
 * moment `keptImages` runs, every `/u/<slug>/` url in the answer is either one
 * the site owns or one the model made up, and there is no third kind.
 *
 * EACH FILE IS WRITTEN BACK INTO THE LIST IT CAME FROM. `applyImages`' own
 * comment records why: the union is sliced apart by length nowhere, because
 * that is how a fix of this shape silently breaks again.
 *
 * ⚠ AND THE FIRST CUT OF IT GOT BOTH HALVES WRONG — corrected 2026-09-19, both
 * REPRODUCED through the route first.
 *
 * Owner: *"'Not referenced in existing source' does not mean 'not owned by this
 * site.' … Establish asset existence from the site's upload storage when
 * validation is needed. An unreadable check must remain unknown. Restrict any
 * image correction to actual image references; never blanket-replace matching
 * strings in links or other content."*
 *
 * (1) OWNERSHIP WAS INFERRED FROM THE PAGES, and a picture the owner uploaded
 * and has not placed yet is on no page. MEASURED through the route: a valid
 * upload put on a new gallery came back `<SafeImage src="" …>` — this platform
 * deleting the customer's own photograph because nothing had drawn it before.
 * The question "is this the site's" is answered by the UPLOAD STORE, which is
 * the thing that decides whether `/u/<slug>/<file>` serves bytes; `before` is
 * kept as a fast path and NOT as the definition, because a url already on a
 * live page is one the site has been serving, and sweeping it would be this
 * change removing a picture `keptImages` refuses to let it remove one line up.
 *
 * (2) THE CORRECTION WAS A BLANKET STRING REPLACE, so it reached anything
 * quoting that value. MEASURED: a valid uploaded price list linked as
 * `<a href="/u/<slug>/menu….pdf" download>` came back `href=""` — a download
 * button that downloads nothing, from a photograph guard. The rewrite is
 * restricted to an IMAGE reference now, by `site-picture.mjs`' own key grammar,
 * so an `href` is not a candidate and cannot be one.
 */
/**
 * THE ONE DEFINITION OF AN IMAGE REFERENCE, read by the finder AND the
 * corrector — a `src` as a JSX attribute (`src="…"`) or as an object key
 * (`src: "…"`, `"src": "…"`), which is the kit's own naming in both places:
 * `Gallery` and `MediaGrid` declare `items: { src?, alt?, caption? }` and every
 * `<SafeImage>` takes `src`. `href` is neither, which is the correction.
 *
 * THE GRAMMAR IS IMPORTED, NEVER RESTATED. `KEY_BEFORE` is what stops `dataSrc`
 * and `image_src` matching the `src` inside them, and `keyName` is what admits
 * the quoted key — both already measured over the corpus where they live.
 */
const imgRefRe = () => new RegExp(
  "(" + KEY_BEFORE + keyName("src") + "\\s*[:=]\\s*)([\"'])(\\/u\\/[^\"']+)\\3", "g");

export function imageRefs(source, slug) {
  const out = new Set();
  if (typeof source !== "string" || !slug) return out;
  const mark = sitePhotoUrl(slug);
  for (const m of source.matchAll(imgRefRe())) {
    if (m[4].toLowerCase().startsWith(mark)) out.add(m[4]);
  }
  return out;
}

/**
 * `/u/<slug>/<file>` → the R2 key it is served from, or `null` when it is not a
 * url this platform could serve at all.
 *
 * THE SHAPE IS THE SERVE ROUTE'S OWN, character for character, because the
 * question being asked is *"does this url fetch bytes"* — and a url whose shape
 * the serve route refuses answers 404 whatever is in the bucket, so there is no
 * object that could make it true. The slug folds case (it is lowercased at every
 * door) and the FILE does not: the rest of the path is an R2 key, where a
 * re-cased hash is a different object.
 */
export function uploadKeyFor(slug, url) {
  const m = String(url == null ? "" : url).match(/^\/u\/([a-z0-9][a-z0-9-]{0,80})\/([A-Za-z0-9._-]{1,80})$/);
  if (!m) return null;
  if (m[1].toLowerCase() !== String(slug == null ? "" : slug).toLowerCase()) return null;
  return "uploads/" + m[1].toLowerCase() + "/" + m[2];
}

/**
 * THE CANDIDATES — image references in `after` that were not in `before`, which
 * is every url this change could have invented and no url it inherited.
 */
export function newImageRefs(before, after, slug) {
  const had = new Set();
  for (const p of Array.isArray(before) ? before : []) {
    for (const u of imageRefs(p && p.source, slug)) had.add(u);
  }
  const fresh = new Set();
  for (const p of Array.isArray(after) ? after : []) {
    for (const u of imageRefs(p && p.source, slug)) if (!had.has(u)) fresh.add(u);
  }
  return [...fresh].sort();
}

/**
 * WHICH OF THOSE THE UPLOAD STORE SAYS ARE NOT THERE — and which it could not
 * answer for.
 *
 * `exists` ANSWERS THREE THINGS AND ONLY `false` SWEEPS. `true` is an asset the
 * site really holds; `false` is one it demonstrably does not; anything else —
 * a throw, a missing binding, a shape this reader does not recognise — is
 * `unknown` and the src is LEFT ALONE. Owner: *"An unreadable check must remain
 * unknown."* The direction is the cheap one either way round: an unknown left
 * standing is at worst a broken image on a page, where an unknown swept is the
 * customer's own photograph deleted by a guard.
 *
 * STRICTLY `=== true` / `=== false`, because a reader that answered `undefined`
 * for "I did not look" would otherwise be indistinguishable from one that
 * looked and found nothing — this repository's own most-repeated defect, in the
 * branch where being wrong costs somebody a picture.
 */
export async function strayImages(urls, exists) {
  const stray = [], unknown = [];
  for (const u of Array.isArray(urls) ? urls : []) {
    if (typeof u !== "string" || !u) continue;
    let answer = null;
    try { answer = typeof exists === "function" ? await exists(u) : null; } catch { answer = null; }
    if (answer === true) continue;
    if (answer === false) stray.push(u); else unknown.push(u);
  }
  return { stray: stray.sort(), unknown: unknown.sort() };
}

/**
 * Empty the `src` of every IMAGE reference in `files` naming one of `stray`,
 * and say which files moved.
 *
 * THE KEY, THE SEPARATOR AND THE QUOTE ARE ALL KEPT — only the value between
 * the quotes goes — so `src: '…'` stays an object key and `src="…"` stays an
 * attribute, and nothing that is not a `src` is looked at at all.
 *
 * THE VALUE IS MATCHED WHOLE, between its own quotes, which is what keeps a url
 * that is a PREFIX of another from taking its sibling with it.
 */
export function dropStrayPhotos(files, stray) {
  const drop = new Set((Array.isArray(stray) ? stray : []).filter((u) => typeof u === "string" && u));
  if (!drop.size || !Array.isArray(files)) return { files: Array.isArray(files) ? files : [], dropped: [] };
  const dropped = [];
  const out = files.map((f) => {
    if (!f || typeof f.source !== "string") return f;
    let hit = false;
    const src = f.source.replace(imgRefRe(), (whole, lead, _before, quote, url) => {
      if (!drop.has(url)) return whole;
      hit = true;
      return lead + quote + quote;
    });
    if (!hit) return f;
    dropped.push(String(f.path || ""));
    return { ...f, source: src };
  });
  return { files: out, dropped };
}

/**
 * EVERY FILE A PHOTOGRAPH CAN BE IN — or `null` when part of it is unreadable
 * (2026-09-17).
 *
 * ⚠ THE READER ABOVE WAS HANDED PAGES ONLY, AND A SITE'S PICTURES ARE NOT ALL
 * ON ITS PAGES. Since the band split a section is a COMPONENT, so a site whose
 * hero photograph lives in `-parts/gallery-grid.tsx` answered
 * `{known: true, count: 0}` and every page writer was told *"This site shows no
 * real photographs yet; every picture on it is a placeholder."* MEASURED:
 * `shownPhotos(pages, "fw")` → 0 against `shownPhotos(imageSources(pages,
 * parts), "fw")` → 1 on the same site.
 *
 * `imageSources` IS THE ONE DEFINITION OF "the files the image steps operate
 * on", and its own comment records why it exists: five steps each read `pages`
 * and a band-split build's photographs were never planned, bought, counted,
 * swept or linted. This is the sixth step asking it rather than a sixth copy
 * of the union.
 *
 * AND AN INCOMPLETE INVENTORY IS `null`, NEVER A SHORTER LIST — which is the
 * whole reason this is a function and not a call site. `readSiteParts` answers
 * `{ok, parts, why}` precisely because a read that FAILED is not a site with no
 * components; hand the failure through as `[]` and the answer becomes *"every
 * picture on it is a placeholder"* about a site whose pictures we could not
 * see. `null` reaches `shownPhotos` as `known: false`, and the directive then
 * says nothing either way. The recorded "cannot-tell must never read as a
 * value", in the one input that decides what a model believes about the site it
 * is editing.
 */
export function photoInventory(pages, parts, partsKnown) {
  if (!Array.isArray(pages) || !partsKnown) return null;
  return imageSources(pages, Array.isArray(parts) ? parts : []);
}

/**
 * What a build may spend on pictures, once it is known whether this is the first.
 *
 * ONE PLACE, so the two cases cannot drift: a first build gets the family's
 * budget, a revise of a site that already shows photographs gets nothing, and a
 * revise of a site that has none is treated as the first build it never got.
 */
export function budgetFor({ revise, priorPages, slug, plan } = {}) {
  if (revise && hasBoughtPhotos(priorPages, slug)) return 0;
  // THE PLAN IS THE ONLY SOURCE NOW. It briefly fell back to `imageBudget(family)`
  // for sites built before 2026-08-20; the family table went the same day.
  //
  // A PLAN WE CANNOT READ GETS ONE PICTURE, not zero, and the distinction is the
  // one `planBudget` returns null to preserve. Zero is a real budget — a page
  // list the pipeline cannot address produces one, and until 2026-08-20 the
  // worked example was `terminal` — so answering it for "I cannot read this"
  // would make an
  // unreadable plan indistinguishable from a deliberate choice to have none, and
  // would silently suppress photographs on every site with a stored family and no
  // plan. One is the same answer the old unknown-family path gave, for the same
  // reason: a site we cannot classify still has a home page.
  //
  // THE LEADING `family` ARGUMENT IS GONE. It was kept for a while as an unread
  // first parameter "so every caller keeps compiling", which is how a dead
  // argument reads as a live one — every decision here comes from the plan.
  const fromPlan = planBudget(plan);
  return fromPlan == null ? Math.min(1, IMAGE_CAP) : fromPlan;
}

/**
 * Two rules now: the home page gets one, and any other page gets one only where
 * the components say pictures are the content. Capped at `IMAGE_CAP`.
 *
 * IT WAS THREE UNTIL `structure` WENT (owner's call, 2026-08-20), and the two
 * branches that went with it are recorded here rather than lost, because each
 * is a real behaviour this no longer has and both cost money in one direction
 * or the other:
 *
 *   `terminal` RETURNED 0. A site whose whole premise is "no imagery, no
 *   decoration" now buys one photograph for its home page — ~19 credits of real
 *   fal spend on a picture it should not have. Bounded to one, and to the rare
 *   site that would have picked that skeleton.
 *
 *   `editorial` AND `full-bleed-hero` GOT TWO on the home page, on the grounds
 *   that an opening image IS the page there and one small picture reads as
 *   unfinished. They get one now.
 *
 * NEITHER WAS REPLACED BY AN INFERENCE, deliberately. The obvious move is to
 * key both on `components` — the manifest is a concrete list the model really
 * wrote, where the skeleton was an adjective it measurably ignored — and the
 * home page defeats it: a barber's home page wants exactly one photograph and
 * would name `hero` and `safe-image`, neither of which is picture-led. Guessing
 * a new signal on no data is how a budget starts being wrong quietly, so the
 * cost is taken and stated instead.
 *
 * THE TWO THINGS A PLAN HAS NO EQUIVALENT FOR are `alt` and the per-page `img`
 * override, and both fall away cleanly. An alternative home page is a property
 * of a REFERENCE app — a family shipped two so one could be shown — and a
 * generated site has never had one. The `img` override existed because the
 * derivation read the FAMILY's component list, so `salon/work` could be a
 * gallery on a family whose components are all booking widgets; with the list
 * authored for THESE pages that blind spot is what the model is now answering
 * directly.
 *
 * NULL, NOT ZERO, when there is no usable plan. Zero is a real budget — a page
 * list the pipeline cannot address produces one, and until 2026-08-20 `terminal`
 * was the worked example — so returning it for "I cannot read this" would make
 * an unreadable plan indistinguishable from a site that genuinely wants no
 * pictures, and would silently suppress them on every site with a stored family.
 */
export function planBudget(plan, { cap = IMAGE_CAP } = {}) {
  const p = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : null;
  // A WORKING TOOL BUYS NOTHING, AND THIS LINE IS THE ENFORCEMENT (2026-08-27,
  // owner's report: "he made an espresso machine on a CRM"). The design tool's
  // `kind` field and the page directive both SAY a tool gets no photographs,
  // and a cap a model is merely told about is not a cap — the designer read
  // "no photographs anywhere" and declared one on four consecutive builds. So
  // the answer is arithmetic: whatever a tool plan declares in `images`, and
  // whatever the derived rule below would have bought its home page, the
  // budget is zero and no image model is ever called.
  //
  // BEFORE THE PAGES GUARD, deliberately. The unreadable-plan `null` exists
  // because "a site we cannot classify still has a home page" — but a plan
  // carrying a readable `kind: "tool"` IS classified, and buying a photograph
  // for a tool has no correct case, however broken the rest of the plan is.
  if (p && p.kind === "tool") return 0;
  const pages = p && Array.isArray(p.pages) ? p.pages : null;
  if (!pages || !pages.length) return null;
  const lim = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(cap))) || 0);
  // THE DESIGNER'S OWN ANSWER WINS, AND AN EMPTY LIST IS AN ANSWER (owner's
  // call, 2026-08-23 — "lets move image generator to the designer").
  //
  // ABSENT IS NOT EMPTY, and that distinction is what makes this safe to deploy
  // against every site already published. Their stored plans predate the field
  // entirely, so reading a missing `images` as "none" would silently suppress
  // photographs on the next revise of all of them — the `publicView` shape, a
  // rule correct about its own case and wrong about the one beside it. Missing
  // falls through to the rule below; `[]` is a site that said no.
  //
  // `normalizePlan` has already dropped any entry naming a page the site has not
  // got and any with no description, so what arrives here is what can really be
  // bought — which is why this counts rather than re-judging.
  if (Array.isArray(p.images)) return Math.min(p.images.length, lim);
  const led = componentsAreContent(p.components);
  let n = 0;
  for (const pg of pages) {
    const path = pg && typeof pg.path === "string" ? pg.path : "";
    if (!path) continue;
    if (path === "/") n += 1;
    else if (led) n += 1;
  }
  return Math.min(n, lim);
}

/**
 * How many of a planned budget the balance can actually carry.
 *
 * `reserve` is what THIS BUILD's model calls really cost, measured — not an
 * estimate — because images are decided after generation has already happened.
 * So the arithmetic is exact and a build can never spend the pages' own budget
 * on photographs and then be unable to pay for the pages.
 *
 * IT FALLS TO ZERO RATHER THAN REFUSING, and that is the whole reason this
 * function exists. A new account is granted 20 credits and a build costs about
 * 21, so a floor that included even one image would refuse every new account's
 * first build — which is exactly the regression the Builder picker's `auto`
 * option shipped, at five times the scale. Zero images is not a failure: it is
 * the site every build produced up to today.
 */
export function imagesAffordable(planned, { balance = 0, reserve = 0, usd = 0.15, creditUsd = 0.008 } = {}) {
  const want = Math.max(0, Math.floor(Number(planned)) || 0);
  const left = (Number(balance) || 0) - (Number(reserve) || 0);
  const per = (Number(usd) || 0) / (Number(creditUsd) || 1);
  if (!(per > 0)) return want;
  return Math.max(0, Math.min(want, Math.floor(left / per)));
}

/* ------------------------------------------------------------- the tokens */

/**
 * `@@IMG:a wide daylight shot of the shop front@@`
 *
 * The same shape as the game builder's `@@SPRITE:@@`, for the same reason: the
 * model writes prose describing a picture in the place the picture goes, and
 * something later swaps in a URL. A model cannot be asked to invent a filename
 * for an image that does not exist yet, and asking it to leave a blank and list
 * the pictures separately means matching two lists it wrote independently.
 *
 * Non-greedy, so two tokens on one line stay two tokens.
 */
export const IMAGE_TOKEN = /@@IMG:([\s\S]*?)@@/g;

/** Longest description we will send. Past this it is a page, not a prompt. */
export const MAX_PROMPT_CHARS = 240;

/** Where a part is written, and the one place that path is spelled for a lint. */
export const partPath = (p) => "src/routes/-parts/" + String((p && p.name) || "") + ".tsx";

/**
 * EVERY GENERATED FILE THAT CAN CARRY A PHOTOGRAPH TOKEN — the pages AND the
 * parts (2026-09-12, owner, on a live site with a raw token across its hero:
 * *"LOOK AT THIS AND TELL ME WHAT HAPPENED HERE"*).
 *
 * WHAT WAS BROKEN: the whole photograph pipeline read `pages` and nothing read
 * `parts`. Five steps, all of them — `planImages` (which photographs to buy),
 * `buySitePhotos` (buying them), `countImageSlots` (the sentence the customer
 * gets), `applyImages` (token → URL, or → the empty src `SafeImage` draws as its
 * placeholder) and `lintPages` (the check written to refuse a token in a bare
 * `<img>`). A band-split build writes its sections as PARTS, so a photograph
 * planned into a band was never planned, never bought, never counted, never
 * swept and never linted, and the token shipped into the bundle as a literal
 * `src="@@IMG:the stone shopfront of a small bike workshop…@@"`. The browser
 * cannot fetch that, so the page rendered the alt text across the hero.
 * MEASURED on `hebden-bike-repair` (2026-09-12): 11 `SafeImage`s on the page,
 * 9 of them drawing their placeholder correctly and 2 raw `<img>` carrying the
 * unswept token. The build's own render check SAW it — "/ has an image that did
 * not load" — and it published anyway, which is the ship-it rule working; the
 * finding had no reader.
 *
 * THIS IS THE RECORDED "A DROPPED FIELD HAS A TWIN ONE HOP OVER", and this file
 * is the answer to it: not five call sites each remembering to add `parts`, but
 * ONE function that says what the image steps operate on. A sixth step added
 * next month asks this and cannot forget.
 *
 * IT IS FOR READING ONLY, and that is deliberate rather than a limitation.
 * `applyImages` has to write each file back into the list it came from, so it is
 * called once per list with the SAME url map — never over this union with the
 * answer sliced apart by length, which is index arithmetic and is exactly how a
 * fix like this breaks again in silence.
 *
 * A PART IS GIVEN ITS REAL PATH, because `lintPages` destructures `{ path }` to
 * name the file in its message and a part carries `name`. Without it every
 * finding in a band would read `undefined: writes a @@IMG:@@ token`.
 */
export function imageSources(pages, parts) {
  const ps = Array.isArray(pages) ? pages : [];
  const bs = Array.isArray(parts) ? parts : [];
  return ps.concat(bs.map((p) => ({ ...p, path: partPath(p) })));
}

/**
 * Every distinct token across the pages, in the order they appear.
 *
 * DEDUPED ON THE WHOLE TOKEN, which is a real saving and not a tidiness thing:
 * a header photograph repeated on four pages is one $0.15 image, not four. The
 * key is the token text rather than the cleaned prompt so that two tokens
 * differing only in whitespace stay one image, which is the same answer R2's
 * content-hash naming would reach one layer later anyway.
 */
export function parseImageTokens(pages) {
  const seen = new Map();
  for (const p of Array.isArray(pages) ? pages : []) {
    const src = String((p && p.source) || "");
    for (const m of src.matchAll(IMAGE_TOKEN)) {
      const token = m[0];
      const prompt = String(m[1] || "").replace(/\s+/g, " ").trim();
      if (!seen.has(token)) seen.set(token, prompt);
    }
  }
  return [...seen.entries()].map(([token, prompt]) => ({ token, prompt }));
}

/**
 * Which tokens get a real photograph and which fall back.
 *
 * A token with no description is DROPPED rather than sent — `@@IMG:@@` is the
 * model forgetting to say what it wanted, and paying $0.15 to find out what an
 * image model does with an empty prompt is the most expensive way to get a
 * random picture. It falls back like anything else.
 *
 * The overflow is returned rather than discarded so the caller can say how many
 * pictures the page asked for beyond what it got — the difference between "this
 * site has no photographs" and "this site wanted twelve".
 */
export function planImages(pages, budget) {
  const lim = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(budget)) || 0));
  const all = parseImageTokens(pages);
  const usable = all.filter((t) => t.prompt.length > 0);
  return {
    shots: usable.slice(0, lim).map((t) => ({ ...t, prompt: t.prompt.slice(0, MAX_PROMPT_CHARS) })),
    overflow: usable.length - Math.min(usable.length, lim),
    empty: all.length - usable.length,
  };
}

/**
 * What we actually ask the image model for.
 *
 * "No text" earns its place twice over: lettering is what makes a generated
 * picture read as generated, and a sign with garbled words on a real business's
 * home page is worse than no picture at all. 4:3 matches `SafeImage`'s own
 * default ratio, and the component crops with object-cover, so one source shape
 * serves every box the model puts it in.
 */
export function imagePrompt(raw) {
  const s = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_CHARS);
  if (!s) return null;
  return s + ". A photograph for a real small-business website: natural light, realistic, " +
    "sharply focused, unstaged. No text, no lettering, no signage, no logo, no watermark, no border, no collage.";
}

/** 4:3 — SafeImage's own default box, and it crops acceptably into 16/9 and 1/1. */
export const IMAGE_ASPECT = "4:3";

/**
 * Swap every token for its URL, and clear the ones that have none.
 *
 * THE SECOND HALF IS THE IMPORTANT HALF. A token with no picture behind it must
 * become the empty string, because `SafeImage` renders its designed placeholder
 * for an empty `src` — that is the day-one look of every site this platform has
 * ever built, so a page that could not get its photographs is not degraded, it
 * is simply where it would have been. Leaving the token in ships the literal
 * text `@@IMG:...@@` into the bundle, where it is both a broken image and a
 * visible leak of how the site was made.
 *
 * The sweep at the end catches malformed and half-written tokens too, so
 * nothing shaped like one can survive to the compiler.
 */
/**
 * How many picture slots a page set asks for.
 *
 * FOUR OUTCOMES RENDER THE SAME BLANK BOX and only one of them is a bug — that
 * is why `imageNote` exists on the build path. The edit and addon lanes buy no
 * photographs at all (deliberate: a revise re-buying pictures the owner already
 * has was a ~94-credit bug), so a NEW page that wants one publishes with a
 * placeholder and, until this, said nothing about it. The customer is left
 * looking at an empty frame with no way to know it is theirs to fill.
 *
 * Counted BEFORE `applyImages` sweeps, because after it there is nothing left to
 * count.
 */
export function countImageSlots(pages) {
  let n = 0;
  for (const p of Array.isArray(pages) ? pages : []) {
    const src = String((p && p.source) || "");
    for (const _ of src.matchAll(IMAGE_TOKEN)) n++;
  }
  return n;
}

export function applyImages(pages, urlByToken) {
  const map = urlByToken instanceof Map ? urlByToken : new Map(Object.entries(urlByToken || {}));
  return (Array.isArray(pages) ? pages : []).map((p) => {
    let src = String((p && p.source) || "");
    for (const [token, url] of map) if (url) src = src.split(token).join(url);
    src = src.replace(IMAGE_TOKEN, "");
    // AND ANY `@@` AT ALL, which is the invariant rather than a second guess at
    // the shape. A description containing `@@` — "a sign saying @@home@@ over the
    // door" — parses as the token `@@IMG:a sign saying @@` and leaves
    // `home@@ over the door@@` behind, so a BOUGHT photograph rendered as
    // `src="/u/x/a.jpghome@@ over the door@@"`: a broken image somebody paid for.
    // Sweeping the delimiter itself makes that unreachable however the text is
    // shaped, and `@@` has no legitimate meaning in generated TSX.
    src = src.replace(/@@[^@]*@@/g, "").replace(/@@/g, "");
    return { ...p, source: src };
  });
}

/**
 * What the page writer is shown: the designer's own pictures, or a bare count.
 *
 * A FUNCTION RATHER THAN TWO LINES AT THE CALL SITE, and a mutation sweep is
 * why. Inline in `worker.js` the decision could only be asserted by READING the
 * source — and two mutants survived that: `false && plan.images` still contains
 * the words `plan.images`, and dropping the `.slice` still leaves `imgBudget`
 * mentioned one clause away. A presence standing in for a property, which is a
 * shape this repo has now recorded four times. Here it is driven.
 *
 * `budget` IS THE LAW, and it is the whole safety argument. `budgetFor` answers
 * 0 on a revise of a site that already has photographs, so slicing to it is what
 * stops a re-declared set being bought twice — and the directive now names
 * actual pictures, so an unbounded list is a page writer invited to spend money
 * nobody authorised.
 *
 * FALLS BACK TO THE COUNT, never to nothing. A plan with no readable list is
 * every site published before 2026-08-23, and the one outcome that must not
 * happen is silence: a page writer with no instruction writes image tokens
 * anyway, and every one of those is a token nothing buys.
 */
export function imageBrief(plan, budget) {
  const n = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(budget)) || 0));
  const p = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : null;
  const list = p && Array.isArray(p.images) ? p.images : null;
  // AN EMPTY LIST IS THE COUNT, not an empty brief. `planBudget` has already
  // turned a deliberate `[]` into a budget of 0, so the count says the zero —
  // and `imageDirective` states a zero rather than omitting it.
  if (!list || !list.length || !n) return n;
  return list.slice(0, n);
}

/* -------------------------------------------------------------- the prompt */

/**
 * What the model is told, per build. Rides in the USER message, never the system
 * block: PAGE_RULES sits under `cache_control: ephemeral` at ~27,000 tokens and
 * a number that changes per build would miss that cache every single time —
 * thirteen times the input cost, measured, to say one integer.
 *
 * Zero is stated rather than omitted. Silence reads as "no instruction", and a
 * model with no instruction writes image tokens anyway; a stated zero is a rule
 * it can follow, and it keeps the placeholder look deliberate on the sites that
 * are meant to have it.
 *
 * A NUMBER OR THE PICTURES THEMSELVES (owner's call, 2026-08-23). Given the
 * designer's own list, this hands over the EXACT tokens to write, page by page,
 * and the page writer places them instead of inventing them. That is the whole
 * of "move the image generator to the designer" at this hop: the model that has
 * the brief AND has just written the stylesheet decides what each picture is
 * of, and the model that writes the JSX decides where it sits.
 *
 * BOTH FORMS SURVIVE, and the number is not legacy. `budgetFor` still answers a
 * bare count for every site whose stored plan predates the field, and the edit
 * and addon lanes pass a literal `0` — so a count is a live shape and stays a
 * first-class one.
 *
 * THE COUNT IS STILL THE LAW even when the list is given, because the list has
 * already been cut by the balance: `imagesAffordable` may hand back fewer shots
 * than the designer asked for, and printing all of them would invite a page
 * writer to spend money the account has not got. The caller slices; this only
 * ever describes what it is given.
 */
/**
 * WHAT THE SITE ALREADY SHOWS, AND THAT IT STAYS — one sentence, two readers.
 *
 * Written out twice would be the recorded "two copies of one thing": the paid
 * form and the zero form are describing the same fact about the same site, and
 * a correction that reached one of them is how a page writer comes to hear that
 * the pictures are protected on a change that buys nothing and not on the one
 * that buys something — which is precisely the wrong way round, since only the
 * buying form ever said anything that invited a strip.
 *
 * SILENT ON AN ABSENT INVENTORY. Nobody looked is not "there are none", and a
 * caller with no answer must not be given a sentence that reads as one. The
 * build path is that caller by construction and is correct to be: `budgetFor`
 * answers 0 for a revise of a site that has photographs, so its paid forms are
 * only ever reached on a site that has none.
 *
 * LEADING SPACE, so the caller concatenates rather than deciding whether to.
 */
function keepClause(shown) {
  const s = shown && typeof shown === "object" && !Array.isArray(shown) ? shown : null;
  if (!s) return "";
  const has = s.known ? Math.max(0, Math.floor(Number(s.count)) || 0) : null;
  if (has === null) return " Leave every picture already on this site exactly as it is.";
  if (has > 0) {
    let out = " This site already shows " + has + " real " + (has === 1 ? "photograph" : "photographs") +
      ", and they stay exactly as they are — do not replace one, and do not remove it.";
    // ── AND THEY MAY BE SHOWN AGAIN (2026-09-19) ─────────────────────────
    //
    // Owner: *"Photo reuse needs no new permission decision merely to improve
    // guidance."* The capability is already there and was measured — a `/u/`
    // url copied onto a new page passes `keptImages` (reuse ADDS; the wall asks
    // about losses), comes through `applyImages` byte-identical (the sweep
    // rewrites unbought `@@IMG:` tokens and a real url is not one), and leaves
    // the distinct count where it was, so it costs nothing. What was missing is
    // that nothing ever said so, and the sentence beside this one — *"any
    // picture this change adds stays a `<SafeImage>` with an empty src"* — read
    // literally as an instruction not to.
    //
    // THE LIST IS THE WHOLE POINT. A count cannot be copied into a `src`, and a
    // model asked to show a picture it has only been counted has exactly one
    // way to comply: invent a path. So the permission and the urls arrive
    // together or not at all — with no list this says nothing about reuse and
    // the protection stands alone, which is the fail-closed direction and the
    // shape an older caller (or a failed inventory read) gets.
    //
    // AND THE WALL IS STATED TO THE MODEL, not only enforced behind it. A `src`
    // this site does not own is swept to empty by `strayPhotos` either way;
    // saying so here is what makes the sweep a rule the writer can follow
    // rather than a silent correction it cannot see.
    const urls = Array.isArray(s.urls) ? s.urls.filter((u) => typeof u === "string" && u) : [];
    if (urls.length) {
      out += " You MAY show one of them again somewhere new: copy its src EXACTLY from this list" +
        (urls.length < has ? " (" + urls.length + " of the " + has + ")" : "") + " — " + urls.join(", ") +
        ". A src of that shape that is not on the list, or one you have altered, is not a picture this site " +
        "owns and will be emptied.";
    }
    return out;
  }
  return " This site shows no real photographs yet; every picture on it is a placeholder.";
}

export function imageDirective(n) {
  // ⚠ ONE COMPOSER FOR THE LIST, REACHED THROUGH TWO DOORS (2026-09-17). A bare
  // array is the object with nothing else known, so the build path's
  // `imageBrief` answer and the addon's `{buy, shown, place}` produce the same
  // sentences from the same lines — and a correction to the paid instruction
  // cannot land on one path and miss the other. The alternative was a second
  // list branch inside the object form, which is this repository's own "two
  // lists of one thing" with the two hops one function apart.
  if (Array.isArray(n)) return imageDirective({ buy: n });
  // THE LIST FORM. Anything that is not a usable array falls through to the
  // count, so a malformed value degrades to today's behaviour rather than to
  // no instruction — which is the one outcome that makes a page writer invent
  // its own tokens.
  if (n && typeof n === "object" && Array.isArray(n.buy)) {
    const shots = n.buy
      .filter((s) => s && typeof s === "object" && !Array.isArray(s) && String(s.describe || "").trim())
      .slice(0, IMAGE_CAP);
    // AN UNUSABLE LIST FALLS BACK TO WHAT THE CALLER COULD OTHERWISE HAVE SAID.
    // With an inventory in hand that is the object's own zero form, which
    // states the zero as OURS; with none it is the bare count, which is the
    // build path's door and is left exactly as it was.
    if (!shots.length) return imageDirective(n.shown ? { ...n, buy: null } : 0);
    const byPage = new Map();
    for (const s of shots) {
      const page = String(s.page || "/").trim() || "/";
      const describe = String(s.describe).replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_CHARS);
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push(describe);
    }
    const lines = [];
    for (const [page, list] of byPage) {
      for (const describe of list) lines.push(`  ${page} — <SafeImage src="@@IMG:${describe}@@" alt="..." />`);
    }
    return "PHOTOGRAPHS: this site gets " + shots.length + " real " +
      (shots.length === 1 ? "photograph" : "photographs") + ", and they are ALREADY CHOSEN. " +
      // THE PROSE MUST NOT SPELL THE DELIMITERS, and this is not style. Written
      // as "the text between `@@IMG:` and `@@`", the sentence itself parses as a
      // token — so anything scanning this directive finds the EXPLANATION before
      // it finds a picture. Caught by the round-trip test in `site-images`,
      // which is the umpteenth instance of prose containing the thing it
      // describes; the same trap has bitten a lint, a router guard, an absence
      // check and a scope scan in this repo.
      "Write each token below into the page it names, VERBATIM — the words inside a token are the prompt an " +
      "image model is paid to draw, so a word changed is a different picture bought:\n" +
      lines.join("\n") + "\n" +
      "Put each one where that page's arrangement calls for it, and write your own `alt`. " +
      // ⚠ CORRECTED 2026-09-17, AND THIS SENTENCE WAS AN INSTRUCTION TO STRIP
      // THE PICTURES THE OWNER HAD ALREADY PAID FOR. It read *"any other
      // picture stays a <SafeImage> with no src, which renders this theme's own
      // placeholder — that is the intended look for the rest of the site"*,
      // which is true of a FIRST BUILD (nothing else on the site is real yet)
      // and false of every addon that buys one for a site that has some.
      // REPRODUCED through the real route on a site showing two: the writer
      // returned both stripped, the compiler payload and the stored source came
      // back with zero `/u/` urls, and the customer was told *"Made 1
      // photograph for the site."*
      //
      // TWO HALVES, AND THE SECOND IS ONLY POSSIBLE BECAUSE THE INVENTORY IS
      // HERE NOW. The ban is narrowed to what this change ADDS — which is all
      // it was ever meant to cover — and `keepClause` states what the site
      // already shows, from the same three-state reader the zero form uses.
      // The build path supplies no inventory and is silent, correctly: a paid
      // directive is only ever reached there on a site with no photographs,
      // because `budgetFor` answers 0 for a revise of one that has any.
      //
      // AND AN EMPTY SRC RATHER THAN NO SRC, for the reason written out below:
      // the picture rung fills a slot by rewriting a `src`, so an element with
      // none is invisible to the one step that could later fill it.
      // ⚠ THE KEEP CLAUSE MOVED AHEAD OF THE EMPTY-SRC SENTENCE (2026-09-19),
      // because it now grants something that sentence has to carve out: the
      // urls a writer may reuse have to be in hand before it is told what to do
      // with a picture that is NOT one of them. Read in the old order the two
      // contradict each other for a whole sentence.
      keepClause(n.shown).trim() + (n.shown ? " " : "") +
      "Do NOT invent an extra token. A picture this change ADDS that is neither one of those tokens nor a src " +
      "copied from the list above is a <SafeImage> with an EMPTY src, which renders this theme's own placeholder.";
  }
  // ── THE FORM FOR A CHANGE THAT BUYS NONE (2026-09-17) ────────────────────
  //
  // A BUDGET OF OURS IS NOT A FACT ABOUT THE SITE, and until today the two were
  // one sentence. The addon passes a literal `images: 0` — correct, and the
  // rule `budgetFor` exists to keep: this step must never re-buy a set the
  // owner already has. But it was SAID as *"PHOTOGRAPHS: none on this site"*,
  // which is false on every site that has any. Measured through the real route
  // on a site showing two bought photographs: identical sentence.
  //
  // AND IT ASKS FOR THE SLOT SHAPE THE PLATFORM ALREADY SHIPS. The zero form
  // below says "a <SafeImage> with NO src", and the picture rung — the rung
  // this step hands a photograph request to — fills a slot by rewriting its
  // `src` attribute, so an element that has none is invisible to it.
  // MEASURED, both directions: a build whose token was not bought comes out of
  // `applyImages` as `src=""` and the picture rung sees ONE slot; the shape the
  // addon asks for reads as ZERO. So the addon was writing the one shape its
  // own next step cannot fill, and the customer was told to "ask for it on its
  // own and I'll place it" — a promise the next rung could not keep in one hop.
  // An EMPTY src and a missing one render identically (`SafeImage` branches on
  // `!src`), so this costs nothing a visitor can see.
  //
  // `!Array.isArray(n)` IS A DECLARED BELT, NOT A WALL, and it is said here
  // because a sweep cannot say it. The list form above returns on EVERY path —
  // including its own `!shots.length` fallback — so no array can reach this
  // line. MEASURED over ten array shapes (empty, one shot, two pages, a null
  // entry, an entry with no `describe`, a blank `describe`, a bare string, a
  // repeated shot): byte-identical with the test and with it cut. It stays
  // because the PAIR is what a reader needs — *arrays are answered above* and
  // *this branch is objects only* — and reordering the two branches is a
  // one-line edit that reads as tidying. The sweep drives the two observable
  // halves of the same property instead: the list branch's own guard, and this
  // line's `typeof` test, which a number really does fall through.
  if (n && typeof n === "object" && !Array.isArray(n)) {
    const lines = ["PHOTOGRAPHS: this change buys none, so do not write any @@IMG:@@ token."];
    // WHAT THE SITE HAS, said only when it was really read — and now shared
    // with the PAID form above rather than written out twice, because "what
    // this site already shows and may not lose" is one fact and a second copy
    // of it is one that drifts.
    //
    // ABSENT IS NORMALISED TO "nobody looked" HERE AND TO SILENCE THERE, and
    // the two are not the same want. This form's whole subject is what the site
    // has, so a caller that supplied no inventory has to hear the third
    // sentence — the recorded "cannot-tell must never read as a value". The
    // paid form's subject is what to BUY, so with no inventory it says nothing
    // about the site rather than guessing at it.
    lines.push(keepClause(n.shown || { known: false }).trim());
    // AND A SLOT THE NEXT STEP CAN FILL, when the customer asked for a picture.
    // ⚠ AND BOTH SENTENCES CARVE THE REUSE OUT (2026-09-19). Each said "empty
    // src" of EVERY picture this change adds, which on a site with photographs
    // is an instruction not to show one again — the clause above has just said
    // it may. A picture that is one of those is a copied src; everything else is
    // a placeholder, exactly as before.
    const spare = (n.shown && Array.isArray(n.shown.urls) && n.shown.urls.length) ? " that is not one of those" : "";
    if (n.place) {
      lines.push("Where this change wants a photograph" + spare + ", write " +
        "`<SafeImage src=\"\" alt=\"what will be here\" />` — " +
        "an EMPTY src, never a missing one. That renders this theme's own placeholder now, and it is the slot " +
        "the picture step fills when they ask for the photograph itself.");
    } else {
      lines.push("Any picture this change adds" + spare + " stays a <SafeImage> with an empty src, which renders " +
        "this theme's own placeholder.");
    }
    return lines.join(" ");
  }
  const k = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(n)) || 0));
  if (!k) {
    return "PHOTOGRAPHS: none on this site. Do not write any @@IMG:@@ token. Every picture is " +
      "<SafeImage> with no src, which renders this theme's own placeholder — that is the intended look here.";
  }
  return "PHOTOGRAPHS: this site gets " + k + " real " + (k === 1 ? "photograph" : "photographs") +
    ". Write `<SafeImage src=\"@@IMG:what the picture shows@@\" alt=\"...\" />` in the " + k +
    " places a photograph earns its keep, describing each one in a sentence — the subject, the light, the framing. " +
    "Spend them where a picture is the argument (the opening, the work, the room) and nowhere decorative. " +
    "Repeat a token verbatim to reuse the same picture; that costs nothing extra. " +
    "Every OTHER image stays a <SafeImage> with no src.";
}

/**
 * One sentence for the customer about the pictures — or nothing at all.
 *
 * FOUR OUTCOMES LOOK IDENTICAL ON THE PUBLISHED PAGE, because all four render
 * the same placeholder: a site that was never meant to have photographs, one
 * that could not afford them, one whose image model failed, and one that wanted
 * twelve and got six. Only this sentence separates them, which is why `planned`
 * is carried alongside `budget` — the budget has already been cut down by the
 * balance, so on its own it cannot say whether anything was ever wanted.
 *
 * Composed on the SERVER, like `contextSentence`: `public/chat.js` cannot import
 * this module, so a sentence written there is a second copy of this reasoning
 * and the direction it drifts in is claiming pictures that were never made.
 *
 * Silent on the ordinary case with nothing to report, so this adds no noise to
 * a site that has no photographs and never asked for any.
 */
export function imageNote(images) {
  const i = images || {};
  const made = Math.max(0, Number(i.made) || 0);
  const planned = Math.max(0, Number(i.planned) || 0);
  const budget = Math.max(0, Number(i.budget) || 0);
  const over = Math.max(0, Number(i.overflow) || 0);
  // ── ASKED FOR AND NEVER EVEN OFFERED TO THE PAGE (2026-09-17) ──────────────
  //
  // Owner: *"Carry the full requested photo list separately from the affordable
  // purchase list. A two-photo request with credits for one must explain that
  // one was omitted because of the balance. Do not imply a placeholder exists
  // unless one actually survived publication."*
  //
  // REPRODUCED through the real route: two pictures designed, credits for one,
  // one bought — and the customer heard *"Made 1 photograph for the site."*
  // with `photos: 0` beside it. Nothing said the second existed, nothing said
  // why it did not, and nothing they could act on.
  //
  // ⚠ IT IS NOT `overflow`, AND WIRING IT THERE WOULD HAVE BEEN THE LIE THE
  // OWNER'S THIRD SENTENCE NAMES. `overflow` is tokens the writer WROTE beyond
  // the budget: `applyImages` sweeps each to `src=""`, so a placeholder really
  // is standing where the picture would have been and *"the other 2 pictures
  // are placeholders"* is true. These were cut off the list BEFORE the writer
  // ever saw them, so there is no token, no frame and no space — which is a
  // different fact needing a different sentence, and the two must not share a
  // counter.
  //
  // THE REASON IS THE CALLER'S TO NAME, which is why this field carries it.
  // `imagesAffordable` is the one thing that cuts a designed list down before
  // the page call, and the route says so where it slices; this function cannot
  // see that and must not infer it from `planned - budget`, which on the build
  // path is the credits clamp INSIDE the purchase and is already `overflow`.
  const unaffordable = Math.max(0, Number(i.unaffordable) || 0);
  if (!planned && !made && !unaffordable) return "";
  // A SECOND CLAUSE RATHER THAN A SECOND SENTENCE, so every outcome below keeps
  // its exact words and a change that buys nothing extra is byte-identical.
  // "weren't enough CREDITS" whatever the count — the verb agrees with the
  // credits, not with the pictures, and the first cut read "There wasn't enough
  // credits for the other one."
  const one = unaffordable === 1;
  const short = unaffordable
    ? " There weren't enough credits for the other " + (one ? "one" : unaffordable) + ", so " +
      (one ? "it isn't" : "they aren't") + " on the site — top up and ask for " + (one ? "it" : "them") +
      " and I'll add " + (one ? "it" : "them") + "."
    : "";
  if (made) {
    return "Made " + made + " " + (made === 1 ? "photograph" : "photographs") + " for the site" +
      (over ? "; the other " + over + " " + (over === 1 ? "picture is a placeholder" : "pictures are placeholders") + "." : ".") +
      short;
  }
  if (!budget) {
    // TWO CLAMPS PRODUCE THIS ZERO AND THEY NEED OPPOSITE INSTRUCTIONS. The
    // balance is one; the owner's 200-file upload library being full is the
    // other, and this sentence used to be the only answer for both — telling
    // somebody to buy credits that cannot possibly help, when what they need is
    // to delete a few uploads. `full` is set by the caller only when the library
    // is what took it to zero, so an unreadable listing keeps the credit
    // sentence, which is the honest answer when we could not look.
    if (i.full) {
      return "Your image library is full, so the new pictures are placeholders — delete a few uploads and ask again.";
    }
    // THE THIRD CLAMP, AND THE ONLY ONE WHOSE ANSWER IS "just ask again". The
    // credits clamp needs money and the library clamp needs a deletion; this one
    // needs nothing at all, because the next build starts its clock afresh.
    //
    // AND THAT PROMISE IS ONE THE CODE KEEPS, checked rather than assumed:
    // `budgetFor` returns 0 on a revise only when `hasBoughtPhotos` finds a
    // `/u/<slug>/` URL in the STORED pages, and a build that bought nothing
    // stored placeholders carrying none — so a revise really does buy. Saying
    // "ask again" while the revise path refused to spend would be the worst of
    // the five sentences here.
    if (i.slow) {
      return "The build ran out of time before the photographs, so they're placeholders — ask again and I'll add them.";
    }
    // The affordability clamp, said plainly. Not an error — a build the customer
    // could not otherwise have had is the whole reason it degrades instead of
    // refusing — but silence here reads as the feature being broken.
    //
    // ⚠ AND IT ONLY CLAIMS A PLACEHOLDER WHERE ONE REALLY SURVIVED (2026-09-17,
    // the owner's own constraint). `frames` is the number of empty picture
    // frames the change really left, counted after the merge and the publish
    // decisions — so a caller that knows says so, and one that does not passes
    // nothing and gets exactly the sentence it got before. It is asked HERE and
    // nowhere else because this is the one branch a page with no token can
    // reach: `full`, `slow`, `empty` and the error below are all reachable only
    // once a token was written and swept, so a frame exists there by
    // construction. The addon is the caller that can be wrong — with nothing
    // affordable it asks the writer for `<SafeImage src="" …>` and a writer
    // that ignores that leaves no space at all.
    //
    // `short` IS NOT APPENDED IN THIS BRANCH, deliberately: nothing was
    // affordable, so `unaffordable` is the whole request and the clause would
    // say the same thing twice in two different ways.
    if (Number(i.frames) === 0) {
      return "Not enough credits left over for photographs, so there's no picture there for now.";
    }
    return "Not enough credits left over for photographs, so the pictures are placeholders for now.";
  }
  // NOBODY DESCRIBED THEM, WHICH IS NOT THE SAME AS OUR FAILING TO MAKE THEM.
  // A `@@IMG:@@` token with nothing inside it is dropped rather than sent — a
  // deliberate refusal to pay $0.15 to find out what an image model does with an
  // empty prompt — and until now the customer was told "couldn't make the
  // photographs", which blames us for something we chose not to attempt and
  // gives them nothing to do about it.
  //
  // `error` is the discriminator and it cannot be faked: it is set by the caller
  // whenever a shot was ATTEMPTED and did not land, and every shot that reaches
  // the image model has a non-empty prompt by construction. So no error plus an
  // empty count means nothing was tried, and a real failure keeps its own
  // sentence.
  if (!i.error && Math.max(0, Number(i.empty) || 0) > 0) {
    return "The pictures weren't described, so they're placeholders — tell me what each one should show." + short;
  }
  return "Couldn't make the photographs this time, so the pictures are placeholders — the site is otherwise fine." + short;
}
