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
// site-layouts.mjs already declares, which is what stops 324 page entries from
// needing 324 judgement calls that would go stale the first time a family moved.
//
// Pure logic, no I/O — the same shape as site-layouts.mjs and site-fonts.mjs, so
// all of it is tested outside the Worker. Generating and storing the bytes is
// the caller's half; this module decides what to ask for and what to do with the
// answer.

import { FAMILIES } from "./site-layouts.mjs";

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
 * Structures where the opening image IS the page rather than decorating it.
 * `full-bleed-hero` is an edge-to-edge opening by definition and `editorial` is
 * magazine spreads; both read as unfinished with one small picture in them.
 */
const HERO_LED = new Set(["editorial", "full-bleed-hero"]);

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

/** Does this family treat pictures as content rather than as decoration? */
export function picturesAreContent(family) {
  const f = FAMILIES[family];
  if (!f) return false;
  return componentsAreContent(f.components);
}

/**
 * How many photographs a single page of this family should get.
 *
 * THE "TYPE OF PAGE" RULE, in three lines, first match wins:
 *
 *  - a `terminal` family gets NONE, anywhere. LAYOUTS.md's own words for that
 *    structure are "no imagery, no decoration" — a photograph on one is not a
 *    thin version of the design, it is the wrong design.
 *  - the HOME page gets the opening image: two where the structure is built
 *    around one, one everywhere else. Every non-terminal business site wants a
 *    picture at the top; this is the cheapest non-zero answer that is true.
 *  - any other page gets one ONLY where pictures are the content. A booking
 *    form, a pricing table and a docs page are all better with nothing, and
 *    they are most of the pages this platform writes.
 *
 * An ALTERNATIVE home (`alt: true`) counts for nothing: only one of index and
 * its alternatives is ever built, so counting both budgets for a page that will
 * not exist.
 *
 * A page may override the answer with its own `img`, and it is there because the
 * derivation has a known blind spot: it reads the FAMILY's component list, so a
 * family whose list names no gallery gets nothing on a page that is one.
 * `salon/work` is the case that proved it — "a gallery of finished sets, because
 * nails are a visual trade" — while salon's components are all booking widgets.
 * The override is NOT a general escape hatch to be filled in everywhere: 324
 * page entries hand-annotated is 324 judgements that go stale the first time a
 * family moves, which is what the derivation exists to avoid. It is for the
 * pages where the family's own declarations point the wrong way.
 *
 * Reading the ROLE TEXT was tried instead and rejected on measurement: scanning
 * 324 roles for picture words finds 12, and four of those are false — a quote
 * form where the VISITOR sends photographs, a page that "answers plainly", a
 * visit you "book a look round" for. A rule wrong on a third of its hits is
 * worse than one that is merely narrow.
 */
export function imagesForPage(family, page) {
  const f = FAMILIES[family];
  if (!f || !page) return 0;
  if (f.structure === "terminal") return 0;
  if (page.alt) return 0;
  // Clamped, not trusted: a typo in a page entry must not be able to spend the
  // whole cap on one page, and a negative must not subtract from another's.
  if (Number.isFinite(page.img)) return Math.max(0, Math.min(IMAGE_CAP, Math.floor(page.img)));
  if (page.file === "index") return HERO_LED.has(f.structure) ? 2 : 1;
  return picturesAreContent(family) ? 1 : 0;
}

/**
 * What this site is allowed to spend on pictures, before money is considered.
 *
 * The sum of the per-page rule over the family's OWN page set, capped. An
 * unknown family gets 1 rather than 0 — a build with no family still has a home
 * page, and answering "no pictures" for a site we simply cannot classify would
 * make the fallback path look like a deliberate design choice.
 */
export function imageBudget(family, { cap = IMAGE_CAP } = {}) {
  const lim = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(cap))) || 0);
  const f = FAMILIES[family];
  if (!f) return Math.min(1, lim);
  const n = (f.pages || []).reduce((sum, p) => sum + imagesForPage(family, p), 0);
  return Math.min(n, lim);
}

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
export function budgetFor(family, { revise, priorPages, slug, plan } = {}) {
  if (revise && hasBoughtPhotos(priorPages, slug)) return 0;
  // THE AUTHORED PLAN WINS AND THE FAMILY IS THE FALLBACK, the same order
  // `briefWithLayout` uses and for the same reason: nothing sets a family any
  // more, but every site built before 2026-08-20 has one stored. `planBudget`
  // answers null rather than 0 for a plan it cannot read, so an unusable plan
  // falls through to the family instead of silently costing the site its
  // pictures — a 0 here and a "no opinion" here are different answers.
  const fromPlan = planBudget(plan);
  return fromPlan == null ? imageBudget(family) : fromPlan;
}

/**
 * The same three rules, over an authored plan instead of a family row.
 *
 * IT IS THE SAME DERIVATION, NOT A SECOND ONE. `terminal` gets nothing anywhere;
 * the home page gets two where the structure is built around an opening image
 * and one otherwise; any other page gets one only where the components say
 * pictures are the content. Capped at `IMAGE_CAP`. A family row and a plan
 * carrying the same structure, page count and components produce the same
 * number, which is asserted rather than assumed.
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
 * NULL, NOT ZERO, when there is no usable plan. Zero is a real budget — it is
 * what `terminal` gets — so returning it for "I cannot read this" would make an
 * unreadable plan indistinguishable from a deliberate choice to have no
 * pictures, and would silently suppress them on every site with a stored family.
 */
export function planBudget(plan, { cap = IMAGE_CAP } = {}) {
  const p = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : null;
  const pages = p && Array.isArray(p.pages) ? p.pages : null;
  if (!pages || !pages.length) return null;
  const lim = Math.max(0, Math.min(IMAGE_CAP, Math.floor(Number(cap))) || 0);
  if (p.structure === "terminal") return 0;
  const led = componentsAreContent(p.components);
  let n = 0;
  for (const pg of pages) {
    const path = pg && typeof pg.path === "string" ? pg.path : "";
    if (!path) continue;
    if (path === "/") n += HERO_LED.has(p.structure) ? 2 : 1;
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
 */
export function imageDirective(n) {
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
