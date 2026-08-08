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
} from "../builder/site-images.mjs";
import { FAMILIES, READY_FAMILIES } from "../builder/site-layouts.mjs";
import { IMAGE_USD, pageCost, pageCredits } from "../builder/publish-pages.mjs";
import { lintPages, PAGE_RULES, briefWithLayout, SAFE_IMAGE_COMPONENTS } from "../builder/page-gen.mjs";

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
  for (const tag of ["SafeImage", "Gallery", "Hero", "TeamGrid", "ProductCard", "ImageStrip"]) {
    const ok = lintPages([page("index.tsx", "<" + tag + ' src="@@IMG:the shop front@@" alt="the shop" />')], { tables: [] });
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
  for (const tag of ["Section", "Skeleton", "SiteChrome", "SafeImageX"]) {
    const bad = lintPages([page("index.tsx", "<" + tag + ' src="@@IMG:a thing@@" />')], { tables: [] });
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
