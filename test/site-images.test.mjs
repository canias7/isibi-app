// The photograph budget, the tokens, and the substitution.
//
// Every number here is money — one image is ~19 credits against a warm build's
// ~21 — so the tests that matter most are the ones asserting things do NOT
// happen: that a token with no description is never sent, that the cap binds on
// what the model wrote rather than only on what the family asked for, and that
// a balance which cannot carry a picture buys zero rather than refusing a build.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  IMAGE_CAP, IMAGE_ASPECT, MAX_PROMPT_CHARS,
  imagesForPage, imageBudget, imagesAffordable, picturesAreContent,
  parseImageTokens, planImages, applyImages, imagePrompt, imageDirective, imageNote,
  budgetFor, hasBoughtPhotos,
} from "../builder/site-images.mjs";
import { uploadUrl } from "../site-uploads.mjs";
import { FAMILIES, READY_FAMILIES } from "../builder/site-layouts.mjs";
import { IMAGE_USD, pageCost, pageCredits } from "../builder/publish-pages.mjs";
import { lintPages, PAGE_RULES, briefWithLayout, SAFE_IMAGE_COMPONENTS, schemaDigest, validatePages } from "../builder/page-gen.mjs";

const page = (path, source) => ({ path, source });

/* ------------------------------------------------------------- the budget */

test("the cap is 6 on a first build", () => {
  assert.equal(IMAGE_CAP, 6);
});

test("a terminal family gets no photographs anywhere", () => {
  // LAYOUTS.md's own words for that structure are "no imagery, no decoration".
  // A picture on one is not a thin version of the design, it is a different one.
  const terminal = READY_FAMILIES.filter((n) => FAMILIES[n].structure === "terminal");
  assert.ok(terminal.length, "there are terminal families to check");
  for (const n of terminal) {
    assert.equal(imageBudget(n), 0, n + " is terminal and must get no photographs");
    for (const p of FAMILIES[n].pages) assert.equal(imagesForPage(n, p), 0, n + "/" + p.file);
  }
});

test("the home page carries the opening image, and a hero-led structure gets two", () => {
  const led = READY_FAMILIES.find((n) => FAMILIES[n].structure === "full-bleed-hero");
  const plain = READY_FAMILIES.find((n) => FAMILIES[n].structure === "single-scroll");
  assert.equal(imagesForPage(led, { file: "index" }), 2);
  assert.equal(imagesForPage(plain, { file: "index" }), 1);
});

test("an ALTERNATIVE home counts for nothing", () => {
  // Only one of index and its alternatives is ever built, so budgeting for both
  // buys a photograph for a page that will not exist.
  const fam = READY_FAMILIES.find((n) => (FAMILIES[n].pages || []).some((p) => p.alt));
  assert.ok(fam, "some family declares an alt page");
  const alt = FAMILIES[fam].pages.find((p) => p.alt);
  assert.equal(imagesForPage(fam, alt), 0);
  // And it is the `alt` flag doing it, not the file name: the same entry
  // without the flag would be budgeted.
  assert.equal(imagesForPage(fam, { file: alt.file }), FAMILIES[fam].structure === "terminal" ? 0 : (picturesAreContent(fam) ? 1 : 0));
});

test("a page that is not the home page only gets one where pictures are the content", () => {
  const led = READY_FAMILIES.find((n) => picturesAreContent(n) && FAMILIES[n].structure !== "terminal");
  const notLed = READY_FAMILIES.find((n) => !picturesAreContent(n) && FAMILIES[n].structure !== "terminal");
  assert.equal(imagesForPage(led, { file: "work" }), 1);
  assert.equal(imagesForPage(notLed, { file: "pricing" }), 0);
});

test("safe-image does NOT make a family picture-led", () => {
  // 26 families name it and it is the guard every image goes through, so it says
  // a page HAS a picture and nothing about whether pictures are what it is for.
  // Reading it as the signal would have budgeted a photograph on a pricing page.
  const only = READY_FAMILIES.filter(
    (n) => (FAMILIES[n].components || []).includes("safe-image") && !picturesAreContent(n));
  assert.ok(only.length, "some family names safe-image and nothing more picture-led");
  for (const n of only) assert.equal(picturesAreContent(n), false, n);
});

test("every ready family lands inside the cap, and the picture trades get the most", () => {
  let max = 0;
  for (const n of READY_FAMILIES) {
    const b = imageBudget(n);
    assert.ok(b >= 0 && b <= IMAGE_CAP, n + " budget " + b + " is outside 0.." + IMAGE_CAP);
    max = Math.max(max, b);
  }
  assert.ok(max >= 3, "at least one family spends real money on pictures — got " + max);
  // The gallery trades must beat the paperwork ones, or the derivation is not
  // saying anything about the type of page.
  assert.ok(imageBudget("agency") > imageBudget("accountant"),
    "an agency, whose work IS pictures, must budget more than an accountant");
});

test("a page may override the derivation, and salon/work is why", () => {
  // The blind spot the override exists for: the derivation reads the FAMILY's
  // component list, and salon's is entirely booking widgets — so its `work`
  // page ("a gallery of finished sets, because nails are a visual trade") got
  // nothing while being the most visual page on the site.
  assert.equal(picturesAreContent("salon"), false, "salon names no gallery component");
  const work = FAMILIES.salon.pages.find((p) => p.file === "work");
  assert.equal(work.img, 1, "salon/work declares its own");
  assert.equal(imagesForPage("salon", work), 1);
  assert.ok(imageBudget("salon") >= 2, "the home page plus the gallery");
});

test("an override is clamped, so a typo cannot spend the whole cap on one page", () => {
  assert.equal(imagesForPage("restaurant", { file: "x", img: 999 }), IMAGE_CAP);
  assert.equal(imagesForPage("restaurant", { file: "x", img: -4 }), 0);
  assert.equal(imagesForPage("restaurant", { file: "x", img: 2.7 }), 2);
});

test("an override of zero is honoured, not read as absent", () => {
  // `img: 0` says "no picture here" and must beat the index default; written
  // with a truthiness check it would silently fall through to it.
  assert.equal(imagesForPage("restaurant", { file: "index", img: 0 }), 0);
});

test("an override cannot resurrect a terminal family or an alt page", () => {
  const terminal = READY_FAMILIES.find((n) => FAMILIES[n].structure === "terminal");
  assert.equal(imagesForPage(terminal, { file: "index", img: 4 }), 0);
  assert.equal(imagesForPage("salon", { file: "call-now", alt: true, img: 4 }), 0);
});

test("every declared override is a sane whole number", () => {
  for (const n of READY_FAMILIES) {
    for (const p of FAMILIES[n].pages) {
      if (p.img === undefined) continue;
      assert.ok(Number.isInteger(p.img) && p.img >= 0 && p.img <= 2,
        n + "/" + p.file + " declares img: " + p.img + " — an override is a correction, not a budget grab");
    }
  }
});

test("an unknown family still gets its one opening image", () => {
  // Zero would make the fallback look deliberate on a site we simply could not
  // classify, which is the one place the placeholder reads as a bug.
  assert.equal(imageBudget("no-such-family"), 1);
  assert.equal(imageBudget(undefined), 1);
});

test("the cap argument clamps and can never RAISE the ceiling", () => {
  assert.equal(imageBudget("agency", { cap: 1 }), 1);
  assert.equal(imageBudget("agency", { cap: 0 }), 0);
  assert.ok(imageBudget("agency", { cap: 99 }) <= IMAGE_CAP, "a caller cannot ask for more than the cap");
  assert.equal(imageBudget("no-such-family", { cap: 0 }), 0, "the unknown-family default is clamped too");
});

/* -------------------------------------------------------- affordability */

test("a balance that cannot carry the build buys zero, and does not go negative", () => {
  // The regression this exists to prevent: a new account is granted 20 credits
  // and a build costs about 21, so anything that REFUSED here would refuse every
  // new account's first build — which is exactly what the picker's `auto` option
  // shipped, at a fifth of this scale.
  assert.equal(imagesAffordable(3, { balance: 20, reserve: 21 }), 0);
  assert.equal(imagesAffordable(3, { balance: 0, reserve: 0 }), 0);
});

test("what is left over after the build is what buys pictures", () => {
  // 0.15 / 0.008 = 18.75 credits an image.
  assert.equal(imagesAffordable(6, { balance: 100, reserve: 21 }), 4, "79 left / 18.75 = 4");
  assert.equal(imagesAffordable(6, { balance: 21 + 18, reserve: 21 }), 0, "18 credits does not buy an 18.75 image");
  assert.equal(imagesAffordable(6, { balance: 21 + 19, reserve: 21 }), 1);
});

test("it can only ever reduce the plan, never add to it", () => {
  assert.equal(imagesAffordable(2, { balance: 100000, reserve: 0 }), 2);
  assert.equal(imagesAffordable(0, { balance: 100000, reserve: 0 }), 0);
});

test("a nonsense plan is zero rather than NaN", () => {
  assert.equal(imagesAffordable(undefined, { balance: 1000, reserve: 0 }), 0);
  assert.equal(imagesAffordable("three", { balance: 1000, reserve: 0 }), 0);
  assert.equal(imagesAffordable(-4, { balance: 1000, reserve: 0 }), 0);
});

/* ------------------------------------------------------------- the tokens */

test("tokens are found across pages, in order, and deduped whole", () => {
  const found = parseImageTokens([
    page("index.tsx", 'a <SafeImage src="@@IMG:the shop front@@" /> b <SafeImage src="@@IMG:the chair@@" />'),
    page("about.tsx", '<SafeImage src="@@IMG:the shop front@@" />'),
  ]);
  assert.deepEqual(found.map((t) => t.prompt), ["the shop front", "the chair"]);
});

test("a repeated token is ONE image, which is the whole point of saying so in the prompt", () => {
  const pages = [page("a.tsx", '"@@IMG:x@@" "@@IMG:x@@" "@@IMG:x@@" "@@IMG:x@@"')];
  assert.equal(parseImageTokens(pages).length, 1);
  assert.equal(planImages(pages, 6).shots.length, 1, "four appearances must not cost $0.60");
});

test("two tokens on one line stay two tokens", () => {
  // Greedy matching would swallow the gap between them and bill one enormous
  // prompt for a picture nobody described.
  const found = parseImageTokens([page("a.tsx", '"@@IMG:one@@" and "@@IMG:two@@"')]);
  assert.deepEqual(found.map((t) => t.prompt), ["one", "two"]);
});

test("a token with no description is dropped, never sent", () => {
  // $0.15 to find out what an image model does with an empty prompt.
  const r = planImages([page("a.tsx", '"@@IMG:@@" "@@IMG:   @@" "@@IMG:a real one@@"')], 6);
  assert.deepEqual(r.shots.map((s) => s.prompt), ["a real one"]);
  assert.equal(r.empty, 2);
});

test("the budget binds on what the MODEL wrote, not only on what the family asked for", () => {
  const src = Array.from({ length: 12 }, (_, i) => '"@@IMG:shot ' + i + '@@"').join(" ");
  const r = planImages([page("a.tsx", src)], 3);
  assert.equal(r.shots.length, 3);
  assert.equal(r.overflow, 9, "the ones that will fall back are counted, not silently dropped");
});

test("the hard cap holds even when the caller asks for more", () => {
  const src = Array.from({ length: 20 }, (_, i) => '"@@IMG:shot ' + i + '@@"').join(" ");
  assert.equal(planImages([page("a.tsx", src)], 50).shots.length, IMAGE_CAP);
});

test("a very long description is clipped before it is sent", () => {
  const r = planImages([page("a.tsx", '"@@IMG:' + "x".repeat(2000) + '@@"')], 1);
  assert.equal(r.shots[0].prompt.length, MAX_PROMPT_CHARS);
});

/* -------------------------------------------------------------- applying */

test("a bought token becomes its URL", () => {
  const out = applyImages(
    [page("a.tsx", '<SafeImage src="@@IMG:the chair@@" />')],
    new Map([['@@IMG:the chair@@', "/u/cafe/abc.jpg"]]));
  assert.equal(out[0].source, '<SafeImage src="/u/cafe/abc.jpg" />');
});

test("an UNBOUGHT token becomes an empty string, which is the designed placeholder", () => {
  // Leaving it in ships the literal text `@@IMG:...@@` into the bundle — both a
  // broken image and a visible leak of how the site was made.
  const out = applyImages([page("a.tsx", '<SafeImage src="@@IMG:nothing@@" alt="x" />')], new Map());
  assert.equal(out[0].source, '<SafeImage src="" alt="x" />');
  assert.ok(!out[0].source.includes("@@"), "no token survives to the compiler");
});

test("a malformed or half-written token is swept too", () => {
  const out = applyImages([page("a.tsx", 'x "@@IMG:a@@ then @@IMG:b@@" y')], new Map());
  assert.ok(!out[0].source.includes("@@IMG:"), "nothing shaped like a token reaches the bundle");
});

test("applying returns the same number of pages, with paths untouched", () => {
  const src = [page("index.tsx", '"@@IMG:a@@"'), page("book.tsx", "no images here")];
  const out = applyImages(src, new Map([['@@IMG:a@@', "/u/s/1.jpg"]]));
  assert.deepEqual(out.map((p) => p.path), ["index.tsx", "book.tsx"]);
  assert.equal(out[1].source, "no images here");
});

test("an empty URL does not blank the token by accident", () => {
  // A map entry whose value is "" must take the fall-back path, not substitute
  // an empty string and then get swept anyway — same visible answer, but only
  // one of the two survives a bug where the URL is built wrong.
  const out = applyImages([page("a.tsx", '"@@IMG:a@@"')], new Map([['@@IMG:a@@', ""]]));
  assert.equal(out[0].source, '""');
});

/* ------------------------------------------------------------- the prompt */

test("the prompt refuses lettering, which is what makes a generated picture look generated", () => {
  const p = imagePrompt("a wide shot of the shop front");
  assert.match(p, /^a wide shot of the shop front\./);
  assert.match(p, /No text, no lettering/);
  assert.match(p, /no watermark/);
});

test("an empty description produces no prompt at all", () => {
  assert.equal(imagePrompt(""), null);
  assert.equal(imagePrompt("   "), null);
  assert.equal(imagePrompt(null), null);
});

test("the aspect ratio matches SafeImage's own default box", () => {
  // 4:3 vs "4/3" — one is fal's syntax and one is CSS, and they have to mean the
  // same shape or every generated picture is cropped on arrival.
  assert.equal(IMAGE_ASPECT, "4:3");
  const src = readFileSync(new URL("../builder/lovable/template/src/components/ui/safe-image.tsx", import.meta.url), "utf8");
  assert.match(src, /ratio\s*=\s*"4\/3"/, "SafeImage's default ratio moved; IMAGE_ASPECT has to move with it");
});

/* ---------------------------------------------------------- the directive */

test("zero is STATED, not omitted", () => {
  // Silence reads as "no instruction", and a model with no instruction writes
  // image tokens anyway.
  const d = imageDirective(0);
  assert.match(d, /none on this site/);
  assert.match(d, /Do not write any @@IMG:@@ token/);
});

test("the directive names the count and the only place a token may go", () => {
  const d = imageDirective(3);
  assert.match(d, /this site gets 3 real photographs/);
  assert.match(d, /SafeImage src="@@IMG:/);
  assert.match(d, /Repeat a token verbatim to reuse the same picture/);
});

test("one photograph is singular", () => {
  assert.match(imageDirective(1), /1 real photograph\b/);
  assert.ok(!/1 real photographs/.test(imageDirective(1)));
});

test("the directive can never ask for more than the cap", () => {
  assert.match(imageDirective(999), new RegExp("gets " + IMAGE_CAP + " real"));
  assert.match(imageDirective(-3), /none on this site/);
  assert.match(imageDirective("four"), /none on this site/);
});

test("the allowance rides in the USER message, appended to the brief", () => {
  // PAGE_RULES sits under cache_control: ephemeral at ~27,000 tokens. A number
  // that changes per build in the system block misses that cache every build —
  // measured at thirteen times the input cost on the family exemplar.
  const withBudget = briefWithLayout({ brief: "a restaurant in Leeds", family: "restaurant", images: 2 });
  assert.match(withBudget, /this site gets 2 real photographs/);
  assert.ok(!/@@IMG:what the picture shows@@/.test(PAGE_RULES),
    "the per-build count must not be baked into the cached rules");
});

test("a caller that states no budget sends exactly the request it sent before this existed", () => {
  const before = briefWithLayout({ brief: "a restaurant in Leeds", family: "restaurant" });
  assert.ok(!/PHOTOGRAPHS/.test(before), "omitted, not defaulted");
  assert.equal(briefWithLayout({ brief: "x" }), "x");
});

test("a stated budget of zero still reaches the model", () => {
  // `images: 0` is a real instruction and `images: undefined` is the absence of
  // one. Written with a truthiness check these collapse, and every terminal
  // family silently stops being told not to write tokens.
  assert.match(briefWithLayout({ brief: "x", family: "restaurant", images: 0 }), /none on this site/);
});

/* ----------------------------------------------------------- the sentence */

test("a site that never wanted photographs says nothing at all", () => {
  assert.equal(imageNote({ made: 0, planned: 0, budget: 0, overflow: 0 }), "");
  assert.equal(imageNote({}), "");
  assert.equal(imageNote(), "", "a build from before this field existed must not throw");
});

test("photographs made are counted, and singular reads properly", () => {
  assert.match(imageNote({ made: 3, planned: 3, budget: 3 }), /Made 3 photographs/);
  assert.match(imageNote({ made: 1, planned: 1, budget: 1 }), /Made 1 photograph for/);
});

test("the ones that fell back are named beside the ones that did not", () => {
  const s = imageNote({ made: 2, planned: 2, budget: 2, overflow: 4 });
  assert.match(s, /Made 2 photographs/);
  assert.match(s, /other 4 pictures are placeholders/);
});

test("could-not-afford and could-not-make are DIFFERENT sentences", () => {
  // The whole reason `planned` travels beside `budget`: on the published page
  // these two render the identical placeholder, and only one of them is a fault.
  const broke = imageNote({ made: 0, planned: 3, budget: 0, overflow: 0 });
  const failed = imageNote({ made: 0, planned: 3, budget: 3, overflow: 0, error: "photo 500" });
  assert.match(broke, /Not enough credits/);
  assert.match(failed, /Couldn't make the photographs/);
  assert.notEqual(broke, failed);
});

test("the failure sentence says the site is otherwise fine", () => {
  // A customer reading "couldn't make the photographs" needs to know that is a
  // missing picture and not a broken build.
  assert.match(imageNote({ made: 0, planned: 1, budget: 1 }), /the site is otherwise fine/);
});

test("FOUR causes, four sentences — none of them wears another's", () => {
  // `imageNote` is the ONE field built to separate the causes of an identical
  // placeholder, and two pairs of them were collapsed.
  //
  // A FULL IMAGE LIBRARY IS NOT A SHORTAGE OF CREDITS. Both clamp `budget` to
  // zero, and the credit sentence was the only answer for both — so an owner at
  // the 200-file cap was told to buy credits that cannot possibly help, on the
  // one build where the fix is to delete a few uploads.
  //
  // AND NOBODY DESCRIBING THE PICTURES IS NOT US FAILING TO MAKE THEM. A
  // `@@IMG:@@` token with an empty prompt is DROPPED rather than sent — a
  // deliberate refusal to pay $0.15 to see what an image model does with
  // nothing — and the customer was told "couldn't make the photographs", which
  // blames us for something never attempted and gives them nothing to do.
  const notes = {
    broke: imageNote({ made: 0, planned: 3, budget: 0 }),
    full: imageNote({ made: 0, planned: 3, budget: 0, full: true }),
    empty: imageNote({ made: 0, planned: 3, budget: 3, empty: 2 }),
    failed: imageNote({ made: 0, planned: 3, budget: 3, error: "photo 500" }),
  };
  assert.match(notes.broke, /Not enough credits/);
  assert.match(notes.full, /library is full/);
  assert.match(notes.empty, /weren't described/);
  assert.match(notes.failed, /Couldn't make the photographs/);
  assert.equal(new Set(Object.values(notes)).size, 4, "two causes still wear one sentence: " + JSON.stringify(notes));
  // Each names something the customer can do about it, which is the point of
  // telling them apart at all.
  assert.match(notes.full, /delete a few uploads/i);
  assert.match(notes.empty, /tell me what each one should show/i);
});

test("a REAL failure keeps its own sentence even when a token was also empty", () => {
  // The discriminator has to be `error` and not the empty count, or a page that
  // wrote one described picture and one bare token would report the model's
  // omission while OUR image call was the thing that failed.
  assert.match(imageNote({ made: 0, planned: 3, budget: 3, empty: 1, error: "photo 500" }),
    /Couldn't make the photographs/);
});

test("an unreadable upload listing keeps the credit sentence, not the library one", () => {
  // `full` is set by the caller only when the library is REALLY what took the
  // budget to zero. Saying "your library is full" because we could not look is
  // an instruction to delete photographs that may not need deleting.
  assert.match(imageNote({ made: 0, planned: 3, budget: 0, full: false }), /Not enough credits/);
});

/* ------------------------------------------------------ the rules and lint */

test("the rules point the model at SafeImage for a photograph token", () => {
  assert.match(PAGE_RULES, /A REAL PHOTOGRAPH is a `@@IMG:describe the picture@@` token/);
  assert.match(PAGE_RULES, /NEVER invent a path under \/u\//,
    "a made-up path is a 404 on every page that shows it");
});

test("the lint refuses a token in a bare <img>, which is the one that really breaks", () => {
  // The tag decides what an UNBOUGHT picture looks like: an empty src is a
  // designed placeholder inside SafeImage and a broken-image icon in an <img>.
  const bad = lintPages([page("index.tsx", '<img src="@@IMG:the shop front@@" />')], { tables: [] });
  assert.equal(bad.length, 1);
  assert.match(bad[0], /photograph token inside <img>/);
  assert.match(bad[0], /bare <img> draws as a broken image/);
});

test("the lint passes a token in ANY component that draws through SafeImage", () => {
  // SafeImage alone was too narrow — measured on the first live build, which
  // put one in <Gallery> and was told off for doing the right thing. Refusing
  // those teaches the model to hand-roll an <img>, which is the failure.
  // FILTERED TO THE TOKEN RULE'S OWN MESSAGES. These fixtures are synthetic —
  // `<Gallery src=… alt=…>` is not a call that would compile, because Gallery
  // takes `items` — and since the prop lint landed, an invalid call is reported
  // as one. That is the prop lint doing its job on a fixture that was never
  // meant to be realistic; this test is about the IMAGE TOKEN, so it asserts on
  // the image-token verdict and lets the other rule speak for itself.
  const tokenOnly = (out) => out.filter((x) => /@@IMG|token/i.test(x));
  for (const tag of ["SafeImage", "Gallery", "Hero", "TeamGrid", "ProductCard", "ImageStrip"]) {
    const ok = tokenOnly(lintPages([page("index.tsx", "<" + tag + ' src="@@IMG:the shop front@@" alt="the shop" />')], { tables: [] }));
    assert.deepEqual(ok, [], tag + " must be allowed");
  }
});

test("the allow-list is DERIVED from the kit, in both directions", () => {
  // A hand-kept list goes stale the first time a card starts using the guard,
  // and the failure is the lint scolding the model for being right.
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const found = new Set();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    if (!/from "@\/components\/ui\/safe-image"/.test(src) && f !== "safe-image.tsx") continue;
    for (const m of src.matchAll(/export function ([A-Z][\w]*)/g)) found.add(m[1]);
  }
  assert.ok(found.size > 30, "the scan broke — only found " + found.size);
  assert.deepEqual([...SAFE_IMAGE_COMPONENTS].sort(), [...found].sort());
});

test("the lint names SafeImage exactly, not any tag that resembles it", () => {
  // Found by mutation: `!tag.startsWith("S")` passed the whole suite, because
  // every case here happened to use <img>. The kit is full of S components —
  // Section, Skeleton, SiteChrome — and a token in any of them is a broken
  // image the moment it cannot be bought.
  const tokenOnly = (out) => out.filter((x) => /@@IMG|token/i.test(x));
  for (const tag of ["Section", "Skeleton", "SiteChrome", "SafeImageX"]) {
    const bad = tokenOnly(lintPages([page("index.tsx", "<" + tag + ' src="@@IMG:a thing@@" />')], { tables: [] }));
    assert.equal(bad.length, 1, tag + " must be refused");
    assert.match(bad[0], new RegExp("inside <" + tag + ">"));
  }
});

test("the lint catches a token in a bare constant, where nothing would clear it", () => {
  const bad = lintPages([page("index.tsx", 'const HERO = "@@IMG:a thing@@";\n<div />')], { tables: [] });
  assert.equal(bad.length, 1);
});

test("a token inside a nested expression in a SafeImage src is still fine", () => {
  const ok = lintPages(
    [page("index.tsx", '<SafeImage src={loud ? "@@IMG:a loud room@@" : ""} alt="" />')], { tables: [] });
  assert.deepEqual(ok, []);
});

/* --------------------------------------------------------------- the price */

test("a photograph is priced from the one table, beside the tokens and the searches", () => {
  assert.equal(IMAGE_USD, 0.15);
  assert.equal(pageCost({ images: 2 }), 0.30);
  // Rounded ONCE with everything else, which is the property `totalCost` exists
  // for: rounding the images and the tokens separately charges twice for it.
  assert.equal(pageCredits({ images: 1 }), 19, "0.15 / 0.008 = 18.75");
  assert.equal(pageCredits({ images: 6 }), 113, "not 6 x 19 = 114");
});

test("a usage object with no images costs what it always did", () => {
  const before = pageCost({ in: 1000, out: 5000, model: "claude-sonnet-5" });
  assert.equal(pageCost({ in: 1000, out: 5000, model: "claude-sonnet-5", images: 0 }), before);
});

test("one photograph really does cost about what a whole warm build costs", () => {
  // The sentence this feature is designed around, asserted so it cannot quietly
  // stop being true: if an image ever gets cheap, the budget derivation is far
  // more conservative than it needs to be and should be revisited.
  const warmBuild = pageCredits({ in: 700, out: 10000, cacheRead: 27000, cacheWrite: 0, model: "claude-sonnet-5" });
  assert.ok(pageCredits({ images: 1 }) >= warmBuild * 0.8,
    "an image (" + pageCredits({ images: 1 }) + ") is no longer comparable to a build (" + warmBuild + ")");
});

/* --------------------------------------------------- CommonJS in an ES module */

test("the lint refuses require() — it compiles, publishes, and then throws", () => {
  // MEASURED LIVE 2026-08-08. A generated page reached for `require()` out of
  // training-data habit and passed every check: the lint said nothing, `tsc`
  // accepted it (Node's types declare `require`), vite bundled it, the site
  // published — and the browser threw `ReferenceError: require is not defined`,
  // taking the whole component tree under it to the error boundary on a live
  // customer site. `build smoke` going red on "no console errors" was the only
  // thing in the repo that noticed.
  const bad = lintPages([page("index.tsx", 'const x = require("react");\n<div />')], { tables: [] });
  assert.equal(bad.length, 1);
  assert.match(bad[0], /CommonJS/);
  assert.match(bad[0], /throws at\s+runtime/);

  for (const src of ['module.exports = Page;', 'exports.Page = Page;']) {
    assert.equal(lintPages([page("index.tsx", src)], { tables: [] }).length, 1, "must refuse: " + src);
  }
});

test("an ordinary import is not mistaken for one", () => {
  // The blanket-refusal direction: a rule that flagged every page would pass the
  // test above while making the lint useless.
  const ok = lintPages([page("index.tsx", 'import { useRows } from "@/lib/rows";\n<div />')], { tables: [] });
  assert.deepEqual(ok, []);
  // And a word merely CONTAINING it — `requireAuth`, `required` — is not a call.
  assert.deepEqual(lintPages([page("index.tsx", 'const required = true;\nrequireAuth();')], { tables: [] }), []);
});

test("the rules say so too, not just the lint", () => {
  // A lint problem is reported on a site that still publishes, so the rule text
  // is what actually prevents it. Both halves, or the model learns by rejection.
  assert.match(PAGE_RULES, /NO CommonJS/);
  assert.match(PAGE_RULES, /require is not defined/);
});

test("no @@ survives to the bundle, however the description is shaped", () => {
  // It used to parse as a TRUNCATED prompt and leave the rest of the text behind
  // in the source, so a BOUGHT photograph rendered as
  // `src="/u/x/a.jpghome@@ over the door@@"` — a broken image that was paid for.
  // Not a token now, so it sweeps to an empty src and draws the placeholder like
  // any other unbought picture.
  const pages = [page("a.tsx", '<SafeImage src="@@IMG:a sign saying @@home@@ over the door@@" />')];
  const tok = parseImageTokens(pages);
  // Unbought: swept clean.
  assert.ok(!applyImages(pages, new Map())[0].source.includes("@@"));
  // BOUGHT: this is the path that was corrupt — the URL landed, and the residue
  // stayed glued to the end of it.
  const bought = applyImages(pages, new Map([[tok[0].token, "/u/x/a.jpg"]]))[0].source;
  assert.ok(!bought.includes("@@"), "residue survived beside a paid-for photograph: " + bought);
});

test("an ordinary description still parses", () => {
  // The blanket direction: a pattern that matched nothing would pass the test
  // above and quietly turn the whole feature off.
  assert.deepEqual(parseImageTokens([page("a.tsx", '"@@IMG:the shop front at dusk@@"')]).map((t) => t.prompt),
    ["the shop front at dusk"]);
});

/* ------------------------------------------------ what the digest may name */

test("an internal function is neither advertised nor accepted", () => {
  // `internal: true` means REVOKEd from PUBLIC and never granted to the Data API
  // roles — the flag exists because a confirmation builder returns somebody's
  // address and message. The digest listed them anyway and the lint accepted the
  // call, so the page compiled, published and answered 403 to every visitor.
  const spec = {
    tables: [{ name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] }],
    functions: [
      { name: "confirm_booking", args: [{ name: "id", type: "int" }], returns: "text", internal: true },
      { name: "slots_left", args: [], returns: "int" },
    ],
  };
  const digest = schemaDigest(spec);
  assert.ok(!/confirm_booking/.test(digest), "an internal function is offered to the model");
  assert.match(digest, /slots_left/, "a callable one is no longer offered — the filter is too wide");

  const bad = lintPages([page("index.tsx", 'useRpc("confirm_booking", {})')], spec);
  assert.equal(bad.length, 1);
  assert.match(bad[0], /declares as internal/, "an internal call is reported as merely undeclared");
  assert.deepEqual(lintPages([page("index.tsx", 'useRpc("slots_left", {})')], spec), []);
});

test("a link to a nested index route is left alone", () => {
  // `menu/index.tsx` is `/menu` to TanStack. The route was derived as
  // `/menu/index`, so every CORRECT link to it was treated as dangling and
  // rewritten to "/" — the page existed, nothing reached it, and a false problem
  // was reported on a site that published.
  const route = (p) => `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: P });
function P(){ return <div><Link to="/menu">m</Link></div>; }`;
  const r = validatePages({ pages: [page("index.tsx", route()), page("menu/index.tsx", route())], notes: "" });
  assert.deepEqual(r.problems, [], "a correct link was reported as dangling");
  assert.match(r.pages[0].source, /to="\/menu"/, "the link was rewritten to the home page");
  // And a link that really IS dangling is still caught, or the fix is a hole.
  const bad = validatePages({ pages: [page("index.tsx", route())], notes: "" });
  assert.equal(bad.problems.length, 1);
  assert.match(bad.pages[0].source, /to="\/"/);
});

/* ------------------- a site whose first build failed could never get a photo */

test("a revise buys none — unless the site never got any in the first place", () => {
  // THE TRAP THIS CLOSES, measured live 2026-08-10. `revise ? 0 : imageBudget()`
  // is right about its own case: a revise re-derives the same budget with fresh
  // descriptions, so a customer revising a 5-photo site paid ~94 credits for
  // pictures they already owned. It assumes a revise means the site HAS
  // pictures. Images are bought AFTER the pages validate, so a first build whose
  // generation returns nothing never reaches them — and every attempt after that
  // is a revise, because a revise is decided by ownership. A real site sat with
  // zero photographs and no way to ever get one.
  const withPhoto = [{ path: "index.tsx", source: '<SafeImage src="/u/cafe/abc123.jpg" alt="the shop" />' }];
  const without = [{ path: "index.tsx", source: "<SafeImage src={row.photo} alt={row.name} />" }];

  assert.equal(budgetFor("marketplace", { revise: false, priorPages: null, slug: "cafe" }), imageBudget("marketplace"),
    "a first build must get the family's budget");
  assert.equal(budgetFor("marketplace", { revise: true, priorPages: withPhoto, slug: "cafe" }), 0,
    "a revise of a site that already shows photographs must buy none — this is the ~94-credit bug");
  assert.equal(budgetFor("marketplace", { revise: true, priorPages: without, slug: "cafe" }), imageBudget("marketplace"),
    "a revise of a site with no photographs is the first build it never got");
  // …and the two assertions above must not agree by accident.
  assert.ok(imageBudget("marketplace") > 0, "the family under test buys no pictures, so this proves nothing");
});

test("not knowing costs nothing, and one site's pictures are not another's", () => {
  // FAILS TOWARD SPENDING NOTHING. A site built before the source was stored
  // hands back null, and reading that as "no photographs" would re-buy the whole
  // set on its next revise — the expensive mistake, and the one this rule exists
  // to prevent. Being wrong the other way costs an unbought picture.
  for (const bad of [null, undefined, "not an array", {}]) {
    assert.equal(budgetFor("marketplace", { revise: true, priorPages: bad, slug: "cafe" }), 0, String(bad));
  }
  // A missing slug is the same kind of not-knowing: with nothing to match on,
  // every page would read as photograph-less and every revise would buy again.
  assert.equal(budgetFor("marketplace", { revise: true, priorPages: [{ path: "i.tsx", source: 'src="/u/cafe/a.jpg"' }] }), 0,
    "with no slug the match is meaningless and must not authorise a purchase");
  // And the match is SCOPED — another site's upload URL is not this site's
  // photograph, or one customer's pictures would suppress another's.
  assert.equal(
    budgetFor("marketplace", { revise: true, priorPages: [{ path: "i.tsx", source: 'src="/u/other-shop/a.jpg"' }], slug: "cafe" }),
    imageBudget("marketplace"), "another site's uploads must not count as this site's");
});

test("hasBoughtPhotos matches the URL applyImages actually writes", () => {
  // The two must agree about the shape or the check is looking for something
  // that is never written. Driven through the REAL substitution rather than a
  // retyped copy of the URL.
  const url = uploadUrl("cafe", "abc123.jpg");
  const pages = applyImages([{ path: "index.tsx", source: '<SafeImage src="@@IMG:the shop front@@" />' }],
    { "@@IMG:the shop front@@": url });
  assert.match(pages[0].source, /src="\/u\/cafe\/abc123\.jpg"/, "applyImages no longer writes that URL shape");
  assert.equal(hasBoughtPhotos(pages, "cafe"), true, "the check cannot see a photograph applyImages just wrote");
});

test("…and worker.js actually asks budgetFor, rather than keeping the old rule", () => {
  // THE WIRING LAYER, which every unit test above is blind to: worker.js cannot
  // be imported, so a mutation reverting the call site to `revise ? 0` survived
  // the whole file while `budgetFor` sat there correct and unused. That shape is
  // recorded in this repo more times than any other.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const imgBudget = budgetFor\(family, \{ revise, priorPages, slug \}\)/,
    "the image budget is no longer decided by budgetFor — a site whose first build failed can never get a photograph again");
  assert.doesNotMatch(w, /const imgBudget = revise \? 0 :/,
    "the old rule is back: a revise buys nothing even when the site has no pictures at all");
  // budgetFor needs all three or it silently answers for the wrong site. Read
  // off the import too, since a call to a name that was never imported is a
  // ReferenceError on the build path — the `OWN_ZONES` failure, one file over.
  assert.match(w, /import \{[^}]*\bbudgetFor\b[^}]*\} from "\.\/builder\/site-images\.mjs"/,
    "budgetFor is called but never imported");
});
