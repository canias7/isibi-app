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

/* ------------------------------------------------------- the clock, not the money */

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
 *   `none` — the reserve is already all there is. Not one shot is waited for.
 *            They have been started and that spend is committed either way; any
 *            that lands before the publish reads the map is still used.
 *
 * A CLOCK THAT THROWS IS NO CLOCK, which is `build-budget.mjs`'s own rule one
 * layer up: a broken clock reads as "plenty of time", because refusing a healthy
 * build is the more expensive mistake and this is not what the customer paid for.
 */
export function photoWait(clock, reserve = PUBLISH_RESERVE_MS) {
  let left = null;
  try {
    if (clock && typeof clock.remainingMs === "function") {
      const n = clock.remainingMs();
      if (typeof n === "number" && Number.isFinite(n)) left = n;
    }
  } catch { left = null; }
  if (left === null) return { wait: "all", ms: null };
  // A NONSENSE RESERVE IS THE REAL ONE, never zero. Read as zero it would mean
  // "wait for everything", which is the bug; read as the default it means the
  // ordinary build. Same direction `makeBudget` takes with a nonsense budget.
  const r = typeof reserve === "number" && Number.isFinite(reserve) && reserve > 0 ? reserve : PUBLISH_RESERVE_MS;
  return left > r ? { wait: "race", ms: left - r } : { wait: "none", ms: 0 };
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
export function imageDirective(n) {
  // THE LIST FORM. Anything that is not a usable array falls through to the
  // count, so a malformed value degrades to today's behaviour rather than to
  // no instruction — which is the one outcome that makes a page writer invent
  // its own tokens.
  if (Array.isArray(n)) {
    const shots = n
      .filter((s) => s && typeof s === "object" && !Array.isArray(s) && String(s.describe || "").trim())
      .slice(0, IMAGE_CAP);
    if (!shots.length) return imageDirective(0);
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
      "Do NOT invent an extra token: any other picture stays a <SafeImage> with no src, which renders this " +
      "theme's own placeholder — that is the intended look for the rest of the site.";
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
  if (!planned && !made) return "";
  if (made) {
    return "Made " + made + " " + (made === 1 ? "photograph" : "photographs") + " for the site" +
      (over ? "; the other " + over + " " + (over === 1 ? "picture is a placeholder" : "pictures are placeholders") + "." : ".");
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
    // The affordability clamp, said plainly. Not an error — a build the customer
    // could not otherwise have had is the whole reason it degrades instead of
    // refusing — but silence here reads as the feature being broken.
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
    return "The pictures weren't described, so they're placeholders — tell me what each one should show.";
  }
  return "Couldn't make the photographs this time, so the pictures are placeholders — the site is otherwise fine.";
}
