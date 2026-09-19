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
  imagesAffordable,
  parseImageTokens, planImages, applyImages, imagePrompt, imageDirective, imageNote,
  budgetFor, planBudget, hasBoughtPhotos, imageBrief, shownPhotos, photoInventory, imageSources,
  photoUrls, keptImages,
} from "../builder/site-images.mjs";
import { uploadUrl } from "../site-uploads.mjs";
import { IMAGE_USD, pageCost, pageCredits } from "../builder/publish-pages.mjs";
import { normalizePlan } from "../builder/site-plan.mjs";
import { lintPages, PAGE_RULES, briefWithLayout, SAFE_IMAGE_COMPONENTS, schemaDigest, validatePages } from "../builder/page-gen.mjs";

const page = (path, source) => ({ path, source });

/* ------------------------------------------------------------- the budget */

/* THE FAMILY-KEYED BUDGET TESTS WENT WITH THE FUNCTION (2026-08-20).
 *
 * `imagesForPage(family, page)`, `imageBudget(family)` and
 * `picturesAreContent(family)` derived a site's photograph allowance from the
 * family table, and there is no family table. The rules that remain are asserted
 * over the authored plan in `test/site-plan.test.mjs` — the home page gets one,
 * any other page gets one only where the components say pictures are the
 * content — so nothing about the rule is untested; only its old input is gone.
 * (The `terminal` zero and the hero-led two went with `structure` on
 * 2026-08-20; that cost is asserted there too.)
 */
test("A SITE WHOSE PLAN CANNOT BE READ STILL GETS ITS ONE OPENING IMAGE", () => {
  // The unknown-family default, inherited by the path that replaced it. Zero
  // would make the placeholder look like a deliberate design choice on a site we
  // simply could not classify, which is the one place it reads as a bug — and it
  // is why `planBudget` answers null rather than 0 for an unreadable plan.
  assert.equal(budgetFor({}), 1, "a build with no plan at all buys nothing");
  assert.equal(budgetFor({ plan: { purpose: "p", pages: [] } }), 1, "a half-plan reads as a deliberate zero");
});

test("…and a plan whose pages are all unaddressable still means none", () => {
  // The distinction the line above exists to preserve: zero is a REAL budget, so
  // it must stay reachable and stay distinct from "I could not read this". Until
  // 2026-08-20 the worked example was `terminal`; with that skeleton gone, a page
  // list the pipeline cannot address is what still produces an honest zero.
  assert.equal(budgetFor({ plan: { purpose: "p", pages: [{ path: "no-slash", role: "r" }] } }), 0,
    "a page list the pipeline cannot address stopped producing an honest zero");
  assert.equal(budgetFor({ plan: { purpose: "p", pages: [{ role: "no path at all" }] } }), 0);
  // …and that zero is still DISTINCT from not knowing, which is the whole reason
  // `planBudget` answers null rather than 0 when it cannot read a plan at all.
  assert.equal(planBudget({ purpose: "p", pages: [] }), null);
  assert.equal(budgetFor({ plan: null }), 1, "an unreadable plan was read as a deliberate zero");
});

test("A WORKING TOOL BUYS NOTHING, whatever its plan declares (2026-08-27)", () => {
  // The espresso-machine bug, closed in arithmetic. The design tool's `kind`
  // field and the page directive both SAY a tool gets no photographs — and the
  // designer read "no photographs anywhere" and declared one on four
  // consecutive builds (runs 43–46), so the prose is not the guarantee. This
  // line is: a `kind: "tool"` plan buys zero whatever else it carries.
  const pages = [{ path: "/", role: "the pipeline" }, { path: "/deals", role: "deals" }];
  assert.equal(planBudget({ purpose: "p", kind: "tool", pages }), 0,
    "a tool bought its home page a photograph");
  assert.equal(planBudget({
    purpose: "p", kind: "tool", pages, components: ["gallery"],
    images: [{ page: "/", describe: "an espresso machine on a bench" }],
  }), 0, "a tool that DECLARED a picture still bought it — the espresso machine, structurally");
  assert.equal(budgetFor({ plan: { purpose: "p", kind: "tool", pages } }), 0,
    "budgetFor re-opened the budget planBudget closed");
  // BEFORE the pages guard, deliberately: a readable `kind: "tool"` IS a
  // classification, so even a plan broken everywhere else buys nothing —
  // buying a photograph for a tool has no correct case.
  assert.equal(planBudget({ kind: "tool" }), 0, "a broken tool plan fell back to the one-image default");
  // And the other kind is inert: a declared shopfront answers exactly what an
  // absent kind always has, so no stored plan moves.
  assert.equal(planBudget({ purpose: "p", kind: "shopfront", pages }), planBudget({ purpose: "p", pages }));
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

/* ── the designer's own pictures (owner's call, 2026-08-23) ─────────────── */

test("GIVEN THE DESIGNER'S LIST, THE PAGE WRITER IS HANDED THE EXACT TOKENS", () => {
  // THE WHOLE MOVE. What each picture is OF used to be decided by the
  // page-generation call, which — measured — contains zero references to the
  // `css` the designer wrote. So the model choosing the subjects had never seen
  // the palette. Now the designer describes them and this hands them over.
  //
  // VERBATIM IS THE PROPERTY: the text between the delimiters is the prompt an
  // image model is paid to draw, so a word changed is a different picture bought.
  const d = imageDirective([
    { page: "/", describe: "the shop front at dusk, warm light through the window" },
    { page: "/work", describe: "a fade in progress, clippers close, shallow depth" },
  ]);
  assert.match(d, /this site gets 2 real photographs/);
  assert.match(d, /ALREADY CHOSEN/);
  assert.match(d, /VERBATIM/);
  assert.ok(d.includes('/ — <SafeImage src="@@IMG:the shop front at dusk, warm light through the window@@"'),
    "the home page's exact token is not handed over:\n" + d);
  assert.ok(d.includes('/work — <SafeImage src="@@IMG:a fade in progress, clippers close, shallow depth@@"'),
    "the second page's exact token is not handed over:\n" + d);
  // AND IT IS TOLD NOT TO ADD ANY, or the count is advisory and the page writer
  // spends photographs nobody authorised.
  assert.match(d, /Do NOT invent an extra token/);
});

test("…and the tokens it writes are the ones the buying path parses", () => {
  // THE ONE PROPERTY THAT MAKES THIS WORK AT ALL, and it spans two functions:
  // the directive writes `@@IMG:…@@` and `parseImageTokens` is what finds them
  // in the returned page source. Asserted by round-trip rather than by matching
  // the delimiter twice — two copies of a token shape is exactly how a picture
  // gets described, written, and then never bought.
  const shot = { page: "/", describe: "a copper kettle on a scrubbed pine table" };
  const d = imageDirective([shot]);
  const token = (d.match(/@@IMG:[\s\S]*?@@/) || [])[0];
  assert.ok(token, "the directive hands over nothing the parser could find");
  const found = parseImageTokens([{ path: "index.tsx", source: `<SafeImage src="${token}" alt="x" />` }]);
  assert.deepEqual(found.map((t) => t.prompt), [shot.describe],
    "the token the directive writes is not the token the buying path reads");
});

test("a picture with nothing to draw is not handed over", () => {
  // `planImages` already refuses an empty prompt rather than paying $0.15 to see
  // what an image model does with one. The same answer belongs here, one step
  // earlier, where it costs a line rather than a photograph.
  const d = imageDirective([
    { page: "/", describe: "   " },
    { page: "/", describe: "a copper kettle on a scrubbed pine table" },
  ]);
  assert.match(d, /gets 1 real photograph\b/);
  assert.ok(!d.includes("@@IMG:   @@"), "an empty description was handed over as a prompt");
});

test("AN UNUSABLE LIST DEGRADES TO THE COUNT, never to no instruction", () => {
  // THE ONE OUTCOME THAT MUST NOT HAPPEN is silence: a page writer with no
  // instruction writes image tokens anyway, and every one of them is a token
  // nothing buys. So anything that is not a usable list falls back rather than
  // vanishing — which for a list with no usable entries is the stated zero.
  for (const junk of [[], [null], [{}], [{ page: "/" }], [{ describe: "" }], ["a picture"]]) {
    assert.match(imageDirective(junk), /none on this site/,
      "an unusable list produced something other than the stated zero: " + JSON.stringify(junk));
  }
});

test("the designer's list cannot ask for more than the cap either", () => {
  const many = Array.from({ length: IMAGE_CAP + 4 }, (_, i) => ({ page: "/", describe: "picture number " + i }));
  const d = imageDirective(many);
  assert.match(d, new RegExp("gets " + IMAGE_CAP + " real"));
  assert.ok(!d.includes("picture number " + IMAGE_CAP), "a picture past the cap was handed over");
});

test("A DECLARED LIST IS THE BUDGET, and an EMPTY one is a real answer", () => {
  // ABSENT IS NOT EMPTY, and that is what makes this safe against every site
  // already published: their stored plans predate the field, so reading a
  // missing `images` as "none" would suppress photographs on the next revise of
  // all of them. Missing falls through to the derived rule; `[]` is a site that
  // said no — which a CRM or a terminal-styled site legitimately is.
  const base = { purpose: "p", pages: [{ path: "/", role: "home" }, { path: "/work", role: "the work" }] };
  assert.equal(planBudget(base), 1, "the derived rule no longer answers for a plan that declares nothing");
  assert.equal(planBudget({ ...base, images: [] }), 0, "an empty list was not honoured as a deliberate none");
  assert.equal(planBudget({ ...base, images: [{ page: "/", describe: "a" }, { page: "/work", describe: "b" }] }), 2);
  // AND IT IS STILL CAPPED. The declaration decides how many, not whether the
  // ceiling applies — each one is real money.
  const many = Array.from({ length: IMAGE_CAP + 3 }, () => ({ page: "/", describe: "x" }));
  assert.equal(planBudget({ ...base, images: many }), IMAGE_CAP);
});

test("a declared picture for a page the site has not got is dropped", () => {
  // It would be bought and shown to nobody: the token has to be written into
  // that page's source for a URL to land anywhere. Checked in `normalizePlan`,
  // which is what `planBudget` counts, so this is asserted through the real
  // chain rather than against the counter alone.
  const plan = normalizePlan({
    purpose: "the slot picker is the hero",
    pages: [{ path: "/", role: "book a chair" }],
    images: [
      { page: "/", describe: "the shop front at dusk" },
      { page: "/ghost", describe: "a page that does not exist" },
    ],
  });
  assert.deepEqual(plan.images.map((i) => i.page), ["/"]);
  assert.equal(planBudget(plan), 1, "a picture for a page nobody generated was still budgeted for");
});

test("WHAT THE PAGE WRITER IS SHOWN IS THE LIST, BOUNDED BY THE BUDGET", () => {
  // EXTRACTED FROM `worker.js` BECAUSE A SOURCE-READ COULD NOT HOLD IT. Inline,
  // two mutants survived the wiring guard: `false && plan.images` still contains
  // the words `plan.images`, and dropping the bound still leaves `imgBudget`
  // mentioned one clause away. A presence standing in for a property, for the
  // fourth recorded time — so the decision moved here, where it is driven.
  const shots = [
    { page: "/", describe: "the shop front at dusk" },
    { page: "/work", describe: "a fade in progress" },
    { page: "/", describe: "the chairs, empty, morning" },
  ];
  const plan = { purpose: "p", pages: [{ path: "/", role: "r" }], images: shots };
  assert.deepEqual(imageBrief(plan, 3), shots, "the designer's own pictures did not reach the page writer");
  // THE BUDGET IS THE LAW, and this is the assertion that stops money leaking:
  // `budgetFor` answers 0 on a revise of a site that already has photographs, so
  // an unbounded list re-buys a set the owner already paid for.
  assert.deepEqual(imageBrief(plan, 2), shots.slice(0, 2), "the list was not cut to the budget");
  assert.equal(imageBrief(plan, 0), 0, "a budget of 0 still handed over pictures to write");
  // AND THE COUNT PATH SURVIVES, which is every site whose stored plan predates
  // the field. Falling back to nothing is the one outcome that must not happen:
  // a page writer with no instruction writes tokens anyway, and none get bought.
  assert.equal(imageBrief({ purpose: "p", pages: [{ path: "/", role: "r" }] }, 2), 2);
  assert.equal(imageBrief(null, 2), 2);
  assert.equal(imageBrief({ images: "three" }, 2), 2);
  assert.equal(imageBrief({ images: [] }, 2), 2, "an empty list produced an empty brief rather than the count");
  // …and it can never exceed the cap however it is asked.
  assert.equal(imageBrief(null, 999), IMAGE_CAP);
  assert.equal(imageBrief(plan, -1), 0);
});

test("…and one with nothing to draw is dropped at the plan too", () => {
  // THE SAME REFUSAL `planImages` MAKES, one step earlier, and a mutation sweep
  // found nothing was holding it: paying $0.15 to see what an image model does
  // with an empty prompt is the most expensive way to get a random picture, and
  // an entry kept here would occupy a budget slot before the buying path ever
  // got the chance to refuse it — so the site loses a real photograph to a blank.
  const plan = normalizePlan({
    purpose: "the slot picker is the hero",
    pages: [{ path: "/", role: "book a chair" }],
    images: [
      { page: "/", describe: "   " },
      { page: "/" },
      { page: "/", describe: "the shop front at dusk" },
    ],
  });
  assert.deepEqual(plan.images.map((i) => i.describe), ["the shop front at dusk"]);
  assert.equal(planBudget(plan), 1, "a blank description still spent a slot of the budget");
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
  const withBudget = briefWithLayout({ brief: "a restaurant in Leeds", images: 2 });
  assert.match(withBudget, /this site gets 2 real photographs/);
  assert.ok(!/@@IMG:what the picture shows@@/.test(PAGE_RULES),
    "the per-build count must not be baked into the cached rules");
});

test("a caller that states no budget sends exactly the request it sent before this existed", () => {
  const before = briefWithLayout({ brief: "a restaurant in Leeds" });
  assert.ok(!/PHOTOGRAPHS/.test(before), "omitted, not defaulted");
  assert.equal(briefWithLayout({ brief: "x" }), "x");
});

test("a stated budget of zero still reaches the model", () => {
  // `images: 0` is a real instruction and `images: undefined` is the absence of
  // one. Written with a truthiness check these collapse, and every terminal
  // family silently stops being told not to write tokens.
  assert.match(briefWithLayout({ brief: "x", images: 0 }), /none on this site/);
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

test("FIVE causes, five sentences — none of them wears another's", () => {
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
  // AND THE CLOCK IS THE FIFTH, added after run 37 wore the fourth one's
  // sentence. That build's photograph SUCCEEDED — the bytes are in R2 and are
  // the site's og:image — and the customer would have read "Couldn't make the
  // photographs": our own deadline reported as an image-model failure, with
  // nothing to act on.
  const notes = {
    broke: imageNote({ made: 0, planned: 3, budget: 0 }),
    full: imageNote({ made: 0, planned: 3, budget: 0, full: true }),
    slow: imageNote({ made: 0, planned: 3, budget: 0, slow: true }),
    empty: imageNote({ made: 0, planned: 3, budget: 3, empty: 2 }),
    failed: imageNote({ made: 0, planned: 3, budget: 3, error: "photo 500" }),
  };
  assert.match(notes.broke, /Not enough credits/);
  assert.match(notes.full, /library is full/);
  assert.match(notes.slow, /ran out of time/);
  assert.match(notes.empty, /weren't described/);
  assert.match(notes.failed, /Couldn't make the photographs/);
  assert.equal(new Set(Object.values(notes)).size, 5, "two causes still wear one sentence: " + JSON.stringify(notes));
  // Each names something the customer can do about it, which is the point of
  // telling them apart at all.
  assert.match(notes.full, /delete a few uploads/i);
  assert.match(notes.empty, /tell me what each one should show/i);
  // The clock's answer is the only one that needs nothing bought, deleted or
  // described — just asked again — and that promise is kept by `budgetFor`,
  // which refuses a revise only when the STORED pages carry a real photo URL.
  assert.match(notes.slow, /ask again/i);
});

test("a build that ran out of time is not a build that could not afford one", () => {
  // The two produce the same zero and need opposite instructions — the same
  // trap `full` was added for. Being told to buy credits when the answer is to
  // ask again is the wrong instruction twice over: it costs money and it does
  // not help.
  assert.notEqual(
    imageNote({ made: 0, planned: 1, budget: 0, slow: true }),
    imageNote({ made: 0, planned: 1, budget: 0 }),
  );
  // And a build that really did make them says so, whatever the clock did.
  assert.match(imageNote({ made: 2, planned: 2, budget: 2, slow: true }), /Made 2 photographs/);
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

test("the refusal SAYS what it saw, because one message covers two opposite failures", () => {
  // Measured live 2026-08-16: a photography studio's home page reported
  // "writes a @@IMG:@@ token outside any tag" and the source went with the
  // site, so nobody could tell which of these it was:
  //
  //   (a) the token is loose in the page — the picture really is lost
  //   (b) `const HERO = "@@IMG:…@@"` used later in a SafeImage — which WORKS,
  //       because applyImages substitutes by a plain text replace over the
  //       whole file, so this rule refused a correct page
  //
  // Those need opposite fixes — a worked example, or narrowing the lint — and
  // a false alarm is worse than the miss here, so the message has to separate
  // them. Asserted on both shapes, or a snippet that only ever showed one
  // would read as a diagnostic and answer nothing.
  const asConst = lintPages([page("index.tsx", 'const HERO = "@@IMG:the studio@@";')], { tables: [] })
    .filter((x) => /@@IMG/.test(x));
  assert.equal(asConst.length, 1);
  assert.match(asConst[0], /outside any tag/);
  assert.match(asConst[0], /saw: "…const HERO = "/, "a constant must be recognisable from the message alone");

  const inProse = lintPages([page("index.tsx", "<p>Our studio @@IMG:the studio@@ in Manchester</p>")], { tables: [] })
    .filter((x) => /@@IMG/.test(x));
  assert.equal(inProse.length, 1);
  assert.match(inProse[0], /saw: "…/);
  assert.ok(!/const/.test(inProse[0]), "prose must not read as a constant");

  // The snippet is CLIPPED and whitespace-collapsed — a multi-line hero would
  // otherwise fill the reply the customer reads.
  //
  // TWO THINGS THIS FIXTURE HAS TO AVOID, both found by a mutation surviving.
  //
  // No QUOTE before the token: a first draft used `<img\n src="@@IMG:a@@" />`
  // and read the snippet with /saw: "…([^"]*)/, which stops at the `src="`
  // quote that shape always carries — so the capture was short whatever the
  // clip did. Asserts on a MARKER not reaching the message now, not a length
  // off a fragile capture.
  //
  // And the long run is in real JSX text, not a COMMENT: the lint blanks
  // comments before it scans, so a `// qqq…` prefix collapses to spaces and
  // the snippet came back as `<p>` however long the run was.
  // THE LINE BREAKS HAVE TO BE INSIDE THE WINDOW, not in front of the token.
  // `.trim()` already eats trailing whitespace, so a fixture whose only
  // newlines sit between the run and the token exercises nothing and the
  // collapse mutation survived twice. This one puts real text across several
  // lines in the last 60 characters, and a run long enough that an unclipped
  // snippet would carry 70 of them.
  const long = lintPages([page("index.tsx", "<p>" + "q".repeat(300) + "\nand\nmore\n@@IMG:a@@</p>")], { tables: [] })
    .filter((x) => /@@IMG/.test(x));
  assert.equal(long.length, 1);
  assert.ok(!/q{70}/.test(long[0]), "the snippet must be clipped, not the whole file");
  assert.match(long[0], /saw: "…[^\n]*"\)/, "collapsed to one line");
});

test("a token with nothing before it does not print an empty snippet", () => {
  // The first thing in the file. `slice` returns "" and an ' (saw: "…")' with
  // nothing in it reads as a diagnostic that ran and found nothing, which is
  // the reassuring way to say the opposite of what happened.
  const out = lintPages([page("index.tsx", "@@IMG:a@@")], { tables: [] }).filter((x) => /@@IMG/.test(x));
  assert.equal(out.length, 1);
  assert.ok(!/saw:/.test(out[0]), out[0]);
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
  // THE BUDGET COMES FROM THE PLAN NOW, not from a family row. The rule under
  // test is unchanged; only where the number comes from has moved.
  const plan = { purpose: "a gallery of finished work",
    pages: [{ path: "/", role: "the work" }, { path: "/work", role: "the gallery" }], components: ["gallery"] };
  const full = budgetFor({ revise: false, priorPages: null, slug: "cafe", plan });

  assert.equal(full, 2, "a first build must get the plan's own budget");
  assert.equal(budgetFor({ revise: true, priorPages: withPhoto, slug: "cafe", plan }), 0,
    "a revise of a site that already shows photographs must buy none — this is the ~94-credit bug");
  assert.equal(budgetFor({ revise: true, priorPages: without, slug: "cafe", plan }), full,
    "a revise of a site with no photographs is the first build it never got");
  // …and the two assertions above must not agree by accident.
  assert.ok(full > 0, "the plan under test buys no pictures, so this proves nothing");
});

test("not knowing costs nothing, and one site's pictures are not another's", () => {
  // FAILS TOWARD SPENDING NOTHING. A site built before the source was stored
  // hands back null, and reading that as "no photographs" would re-buy the whole
  // set on its next revise — the expensive mistake, and the one this rule exists
  // to prevent. Being wrong the other way costs an unbought picture.
  const plan = { purpose: "a gallery of finished work",
    pages: [{ path: "/", role: "the work" }, { path: "/work", role: "the gallery" }], components: ["gallery"] };
  for (const bad of [null, undefined, "not an array", {}]) {
    assert.equal(budgetFor({ revise: true, priorPages: bad, slug: "cafe", plan }), 0, String(bad));
  }
  // A missing slug is the same kind of not-knowing: with nothing to match on,
  // every page would read as photograph-less and every revise would buy again.
  assert.equal(budgetFor({ revise: true, priorPages: [{ path: "i.tsx", source: 'src="/u/cafe/a.jpg"' }], plan }), 0,
    "with no slug the match is meaningless and must not authorise a purchase");
  // And the match is SCOPED — another site's upload URL is not this site's
  // photograph, or one customer's pictures would suppress another's.
  assert.equal(
    budgetFor({ revise: true, priorPages: [{ path: "i.tsx", source: 'src="/u/other-shop/a.jpg"' }], slug: "cafe", plan }),
    2, "another site's uploads must not count as this site's");
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
  // ASSERT THE PROPERTY, NOT THE SPELLING. This was pinned to the exact argument
  // list `budgetFor(family, { revise, priorPages, slug })` and went red the day
  // `plan` was added beside them — a test about word order failing a correct
  // change, which is this repo's most repeated own-goal and which its own
  // neighbours already record. What has to hold is that `imgBudget` comes from
  // `budgetFor` and that every input it needs to answer for the right site is
  // named; the order they are written in is not a fact about anything.
  const call = w.match(/const imgBudget = budgetFor\(([^;]*?)\);/);
  assert.ok(call, "the image budget is no longer decided by budgetFor — a site whose first build failed can never get a photograph again");
  // `family` STOOD IN THIS LIST AND IS GONE. It was the leading argument and
  // was unread for a while before it was removed — the plan answers every
  // question this function asks.
  for (const arg of ["revise", "priorPages", "slug", "plan"]) {
    assert.match(call[1], new RegExp("\\b" + arg + "\\b"),
      "budgetFor is called without `" + arg + "` — it answers for the wrong site, silently");
  }
  assert.doesNotMatch(w, /const imgBudget = revise \? 0 :/,
    "the old rule is back: a revise buys nothing even when the site has no pictures at all");
  // budgetFor needs all three or it silently answers for the wrong site. Read
  // off the import too, since a call to a name that was never imported is a
  // ReferenceError on the build path — the `OWN_ZONES` failure, one file over.
  assert.match(w, /import \{[^}]*\bbudgetFor\b[^}]*\} from "\.\/builder\/site-images\.mjs"/,
    "budgetFor is called but never imported");
});

// ─────────────────────────────────────────────────────────────────────────────
// A BUDGET OF OURS IS NOT A FACT ABOUT THE SITE (2026-09-17)
//
// The addon passes a literal `images: 0` — correct, and the rule `budgetFor`
// exists to keep. It was SAID as *"PHOTOGRAPHS: none on this site"*, which is
// false on every site that has any; measured through the real addon route on a
// site showing two.
// ─────────────────────────────────────────────────────────────────────────────
test("shownPhotos is three-state, because unknown must not pick a side", () => {
  const withTwo = [
    { source: '<SafeImage src="/u/fw/a.jpg" /><SafeImage src="/u/fw/b.jpg" />' },
    { source: '<SafeImage src="/u/fw/a.jpg" />' },   // the SAME picture twice
  ];
  assert.deepEqual(shownPhotos(withTwo, "fw"), { known: true, count: 2 },
    "a repeated photograph was counted twice");
  assert.deepEqual(shownPhotos([{ source: '<SafeImage alt="x" />' }], "fw"), { known: true, count: 0 });

  // UNKNOWN IS ITS OWN ANSWER, and it is the whole reason this is not
  // `hasBoughtPhotos`. That reader answers TRUE when it cannot tell, because
  // not knowing must cost nothing — the right direction for SPENDING and the
  // wrong one for DESCRIBING, where it becomes "this site has photographs"
  // over a source nobody read.
  assert.deepEqual(shownPhotos(null, "fw"), { known: false, count: 0 });
  assert.deepEqual(shownPhotos([{ source: "x" }], ""), { known: false, count: 0 });
  assert.equal(hasBoughtPhotos(null, "fw"), true, "the control moved: the spending reader no longer fails closed");

  // ANOTHER SITE'S UPLOAD IS NOT THIS SITE'S PHOTOGRAPH.
  assert.deepEqual(shownPhotos([{ source: '<SafeImage src="/u/other/a.jpg" />' }], "fw"), { known: true, count: 0 });
});

test("photoInventory is the WHOLE site or nothing, never a shorter list", () => {
  // ⚠ THE READER ABOVE IS ONLY AS GOOD AS WHAT IT IS HANDED, and that is the
  // reported defect (owner, 2026-09-17): *"A photograph inside an existing
  // custom component currently produces 'This site shows no real photographs
  // yet.'"* `shownPhotos` was correct throughout; its INPUT was the site's
  // pages, and a site's own components live in their own list.
  const pages = [{ path: "index.tsx", source: "<h1>Fretwork</h1>" }];
  const parts = [{ name: "gallery-grid", source: '<SafeImage src="/u/fw/hero.jpg" alt="the bench" />' }];
  assert.deepEqual(shownPhotos(pages, "fw"), { known: true, count: 0 },
    "the control moved: the pages alone were never the defect");
  assert.deepEqual(shownPhotos(photoInventory(pages, parts, true), "fw"), { known: true, count: 1 },
    "a photograph inside a component was not counted — the reported defect");

  // AND AN INCOMPLETE INVENTORY IS `null`, NEVER A SHORTER LIST (the owner's
  // own instruction: *"Do not turn an incomplete photo inventory into a claim
  // that every image is a placeholder."*). A component store that could not be
  // read is nobody having looked, and `shownPhotos` answers `known: false` for
  // exactly that — handing it the pages alone instead would be a real count of
  // part of the site presented as a count of all of it.
  assert.equal(photoInventory(pages, null, false), null, "an unreadable component store answered a partial inventory");
  assert.deepEqual(shownPhotos(photoInventory(pages, null, false), "fw"), { known: false, count: 0 });
  assert.equal(photoInventory(null, parts, true), null, "a site with no readable pages answered an inventory anyway");

  // A SITE WITH NO COMPONENTS IS A READ THAT SUCCEEDED, so it is the pages and
  // is `known` — the difference between "there are none" and "nobody looked",
  // which is the same distinction `readSiteParts` draws one layer up.
  assert.deepEqual(shownPhotos(photoInventory(pages, [], true), "fw"), { known: true, count: 0 });
  assert.deepEqual(photoInventory(pages, [], true).map((f) => f.path), ["index.tsx"]);

  // AND THE PATHS ARE `imageSources`' OWN, so this and the frame counter key
  // the same file by the same name. A second spelling here is the whole class
  // of defect the frame count was just fixed for.
  assert.deepEqual(photoInventory(pages, parts, true), imageSources(pages, parts),
    "photoInventory is a second definition of what the image steps operate on");
});

test("imageDirective says a zero budget as ours, and the build path is byte-identical", () => {
  // THE CONTROL FIRST: every site on the platform generates through the number
  // and list forms, so a change here that moved them would be a change to every
  // build there has ever been.
  assert.equal(imageDirective(0), "PHOTOGRAPHS: none on this site. Do not write any @@IMG:@@ token. Every picture is " +
    "<SafeImage> with no src, which renders this theme's own placeholder — that is the intended look here.");
  assert.match(imageDirective(3), /^PHOTOGRAPHS: this site gets 3 real photographs\./);
  assert.match(imageDirective([{ page: "/", describe: "the bench" }]), /^PHOTOGRAPHS: this site gets 1 real photograph, and they are ALREADY CHOSEN\./);

  const said = (o) => imageDirective(o);
  // THE SITE'S OWN PHOTOGRAPHS ARE NAMED AND PROTECTED.
  const two = said({ buy: 0, shown: { known: true, count: 2 }, place: false });
  assert.match(two, /this change buys none/);
  assert.match(two, /already shows 2 real photographs/);
  assert.doesNotMatch(two, /none on this site/, "the false claim survived on a site that has two");

  // A SITE WITH NONE IS TOLD SO — a different sentence from "we buy none",
  // because collapsing them is the defect.
  assert.match(said({ buy: 0, shown: { known: true, count: 0 }, place: false }), /shows no real photographs yet/);

  // AND A SOURCE NOBODY READ CLAIMS NEITHER WAY.
  const unknown = said({ buy: 0, shown: { known: false, count: 0 }, place: false });
  assert.doesNotMatch(unknown, /already shows/, "an unread source was described as having photographs");
  assert.doesNotMatch(unknown, /no real photographs yet/, "an unread source was described as having none");
  assert.match(unknown, /Leave every picture already on this site exactly as it is/);

  // `place` ASKS FOR THE SLOT SHAPE THE NEXT RUNG CAN FILL. `imageSlots`
  // rewrites a `src` attribute, so an element with none is invisible to it —
  // and "ask for the photograph on its own and I'll place it" is the promise
  // this clause makes keepable.
  const placing = said({ buy: 0, shown: { known: true, count: 0 }, place: true });
  assert.match(placing, /an EMPTY src, never a missing one/);
  assert.match(placing, /src=""/, "the directive did not spell the shape it is asking for");
  assert.doesNotMatch(said({ buy: 0, shown: { known: true, count: 0 }, place: false }), /EMPTY src, never a missing one/,
    "the slot instruction was sent to a change nobody asked a photograph of");

  // EVERY FORM FORBIDS THE TOKEN, which is what keeps the budget at zero
  // whatever else the sentence says.
  for (const o of [{ buy: 0, shown: { known: true, count: 2 }, place: true },
                   { buy: 0, shown: { known: false, count: 0 }, place: false }]) {
    assert.match(said(o), /do not write any @@IMG:@@ token/i, "a form of the directive stopped forbidding the token");
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT THE SITE ALREADY SHOWS, AND THAT IT STAYS (2026-09-17)
   ═════════════════════════════════════════════════════════════════════════ */

test("photoUrls reads this site's own photographs, by exact url", () => {
  const src = 'a <SafeImage src="/u/fw/a1.jpg" /> b <img src="/u/fw/b2.jpg" />'
    + ' c <SafeImage src="/u/other/c3.jpg" /> d <SafeImage src="/logo.svg" />'
    + ' e <SafeImage src="data:image/png;base64,AAA" /> f <SafeImage src="/u/fw/a1.jpg" />';
  assert.deepEqual([...photoUrls(src, "fw")].sort(), ["/u/fw/a1.jpg", "/u/fw/b2.jpg"],
    "the reader took in a picture that is not this site's, or missed one that is");

  // THE SLUG FOLDS CASE AND THE FILE DOES NOT, and both halves are load-bearing
  // — driven rather than described, because the first draft of this case
  // asserted a fold on the `/u/` literal that the reader does not do.
  //
  // The slug is lowercased at every door this platform has, so `/u/FW/` names
  // this site and counting it is right. The rest of the path is an R2 KEY,
  // where a re-cased hash is a different object and therefore a broken image —
  // so the wall must read it as a DIFFERENT photograph and report the first one
  // lost. `/u/` itself is written by us and is matched literally.
  assert.deepEqual([...photoUrls('<SafeImage src="/u/FW/a1.jpg" />', "fw")], ["/u/FW/a1.jpg"],
    "a re-cased slug was not recognised as this site's");
  assert.equal(photoUrls('<SafeImage src="/U/fw/a1.jpg" />', "fw").size, 0,
    "the reader matched a prefix nothing on this platform writes");
  assert.deepEqual(keptImages(
    [{ path: "a.tsx", source: '<SafeImage src="/u/fw/A1.jpg" />' }],
    [{ path: "a.tsx", source: '<SafeImage src="/u/fw/a1.jpg" />' }], "fw").lost,
    ["/u/fw/A1.jpg"], "a re-cased R2 key was read as the same photograph — it is a 404");

  // A NON-STRING SOURCE AND A MISSING SLUG ANSWER NOTHING, never throw: this
  // reader is handed model output and a stored list that may be neither.
  for (const [s, slug] of [[null, "fw"], [["a"], "fw"], [123, "fw"], ['<img src="/u/fw/a.jpg">', ""]]) {
    assert.equal(photoUrls(s, slug).size, 0, "a junk input did not answer empty: " + JSON.stringify([s, slug]));
  }
  // ⚠ AND IT REFUSES RATHER THAN COERCES, which is the difference a junk input
  // alone cannot show: `String(["x"]) === "x"`, so a one-element array whose
  // entry happens to hold a quoted url reads as a page really showing that
  // photograph. This repository has shipped that coercion as a real bug three
  // times, and here it would make a wall fire over a file whose `source` is not
  // a string at all.
  assert.equal(photoUrls(['"/u/fw/a1.jpg"'], "fw").size, 0,
    "an array was coerced to its own single element and read as a page's source");
});

test("keptImages is site-wide across pages AND components", () => {
  const page = (s) => ({ path: "index.tsx", source: s });
  const part = (s) => ({ name: "strip", source: s });
  const A = '<SafeImage src="/u/fw/a1.jpg" />';
  const B = '<SafeImage src="/u/fw/b2.jpg" />';

  // NOTHING TO LOSE IS `ok` WITH NO WORK — the ordinary site, and the early
  // return that keeps this off every addon that has no photographs.
  assert.deepEqual(keptImages([page("<p>x</p>")], [page("")], "fw"), { ok: true, lost: [] });

  // A LOSS IN EITHER LIST IS A LOSS.
  assert.deepEqual(keptImages([page(A)], [page("")], "fw").lost, ["/u/fw/a1.jpg"]);
  assert.deepEqual(keptImages([part(A)], [part("")], "fw").lost, ["/u/fw/a1.jpg"]);

  // ⚠ AND A MOVE BETWEEN THEM IS NOT. This is the whole reason the reader takes
  // two LISTS rather than two strings: a per-file comparison refuses a writer
  // that put the picture in a component instead, which loses the customer
  // nothing. Driven both ways round, because a wall that answered `ok` to
  // everything would satisfy this half alone.
  assert.equal(keptImages([page(A), part("")], [page(""), part(A)], "fw").ok, true,
    "a photograph moved from a page into a component was reported as lost");
  assert.equal(keptImages([page(A), part(B)], [page(B), part(A)], "fw").ok, true,
    "two photographs swapping files were reported as lost");

  // REPLACEMENT IS REMOVAL, which is the owner's "removal or replacement" said
  // as one thing — and an ADDITION is invisible, because adding is what this
  // step is for.
  assert.deepEqual(keptImages([page(A)], [page(B)], "fw").lost, ["/u/fw/a1.jpg"]);
  assert.equal(keptImages([page(A)], [page(A + B)], "fw").ok, true, "adding a photograph read as losing one");

  // AN UNREADABLE AFTER IS A TOTAL LOSS, and that is the fail-closed direction:
  // a caller that cannot say what the change produced must not be told every
  // picture survived it.
  assert.deepEqual(keptImages([page(A)], null, "fw").lost, ["/u/fw/a1.jpg"]);
  // …and an unreadable BEFORE claims nothing, because there is nothing to
  // compare against and refusing every change would be the opposite mistake.
  assert.equal(keptImages(null, [page("")], "fw").ok, true);
});

test("a paid directive names what the site already has, and bans only what the change ADDS", () => {
  const shots = [{ page: "/gallery", describe: "the bench" }];
  const paid = imageDirective({ buy: shots, shown: { known: true, count: 2 } });
  assert.match(paid, /this site gets 1 real photograph/);
  // ⚠ THE REPORTED DEFECT: the tail used to read "any other picture stays a
  // <SafeImage> with no src … that is the intended look for the rest of the
  // site", which on a site with photographs is an instruction to strip them.
  assert.doesNotMatch(paid, /any other picture stays a <SafeImage> with no src/);
  assert.doesNotMatch(paid, /the intended look for the rest of the site/);
  assert.match(paid, /A picture this change ADDS beyond those is a <SafeImage> with an EMPTY src/);
  assert.match(paid, /already shows 2 real photographs, and they stay exactly as they are/);

  // THE SAME CLAUSE, FROM ONE DEFINITION. The zero form has said this since it
  // was written; a second copy in the paid form is how a correction lands on one
  // and misses the other.
  const zero = imageDirective({ buy: null, shown: { known: true, count: 2 } });
  const clause = /This site already shows 2 real photographs, and they stay exactly as they are — do not replace one, and do not remove it\./;
  assert.match(paid, clause, "the paid form's clause is not the zero form's");
  assert.match(zero, clause);

  // AND THE BUILD PATH IS SILENT, because it supplies no inventory — `budgetFor`
  // answers 0 for a revise of a site that has photographs, so a paid directive
  // is only ever reached there on a site that has none. A sentence invented
  // about a site nobody read is the "cannot-tell as a value" trap.
  const build = imageDirective(shots);
  assert.doesNotMatch(build, /already shows/, "the build path was told about photographs nobody counted");
  assert.doesNotMatch(build, /Leave every picture/, "the build path gained a sentence about an inventory it has not got");
  assert.match(build, /A picture this change ADDS beyond those is a <SafeImage> with an EMPTY src/,
    "the two doors compose different paid instructions");

  // AND THE ZERO FORM READS AN ABSENT INVENTORY AS "nobody looked", where the
  // paid form reads it as silence. The two are not the same want: this form's
  // whole subject is what the site has, so a caller that supplied nothing must
  // hear the third sentence rather than be told the site has none.
  const blind = imageDirective({ buy: null });
  assert.match(blind, /Leave every picture already on this site exactly as it is/,
    "a zero form with no inventory claimed something either way: " + blind);
  assert.doesNotMatch(blind, /shows no real photographs yet/, "an unread site was described as having none");

  // A LIST WITH NOTHING USABLE FALLS BACK TO WHAT THE CALLER COULD HAVE SAID:
  // the bare count for the build path, the object's own zero where an inventory
  // is in hand.
  assert.match(imageDirective([]), /PHOTOGRAPHS: none on this site/);
  assert.match(imageDirective({ buy: [], shown: { known: true, count: 2 } }),
    /this change buys none[\s\S]*already shows 2 real photographs/);
});

test("imageNote carries the full request apart from what was affordable", () => {
  // THE REPRODUCTION, AT THE MODULE: two asked for, one bought.
  const half = imageNote({ made: 1, planned: 2, budget: 1, overflow: 0, unaffordable: 1 });
  assert.match(half, /^Made 1 photograph for the site\./, "the picture that was made stopped being reported");
  assert.match(half, /There weren't enough credits for the other one, so it isn't on the site/);
  assert.match(half, /top up and ask for it and I'll add it\./);
  // ⚠ AND IT DOES NOT SAY "placeholder", because none exists: the second picture
  // was cut off the list before the writer saw it, so there is no token and no
  // frame. Wiring it into `overflow` would have said exactly that.
  assert.doesNotMatch(half, /placeholder/);

  // `overflow` IS THE OTHER SHORTFALL AND KEEPS ITS OWN WORDS — tokens the
  // writer WROTE beyond the budget, which `applyImages` sweeps to `src=""`, so
  // a placeholder really is standing there. The two counters must not merge.
  assert.match(imageNote({ made: 1, planned: 3, budget: 1, overflow: 2 }),
    /Made 1 photograph for the site; the other 2 pictures are placeholders\.$/);
  // BOTH AT ONCE: two written beyond the budget AND one never offered.
  const both = imageNote({ made: 1, planned: 4, budget: 1, overflow: 2, unaffordable: 1 });
  assert.match(both, /the other 2 pictures are placeholders\. There weren't enough credits for the other one/);

  // PLURALS, BOTH WAYS — and "credits" is always plural, whatever the count of
  // pictures is: the first cut read "There wasn't enough credits for the other
  // one."
  const two = imageNote({ made: 1, planned: 3, budget: 1, unaffordable: 2 });
  assert.match(two, /There weren't enough credits for the other 2, so they aren't on the site/);
  assert.match(two, /ask for them and I'll add them\./);

  // AND A REQUEST THAT PRODUCED NOTHING NEVER GOES SILENT, both ways round.
  // Silence reads as "no photograph was ever asked for", which is the one thing
  // the customer knows is false — so a request that was PLANNED and a request
  // that was CUT each keep it speaking on their own.
  assert.notEqual(imageNote({ planned: 2, made: 0, budget: 0 }), "",
    "a request that was planned and produced nothing said nothing");
  assert.notEqual(imageNote({ planned: 0, made: 0, budget: 0, unaffordable: 2 }), "",
    "a request the balance cut to nothing said nothing");
  // …and the ordinary quiet case is still quiet.
  assert.equal(imageNote({ planned: 0, made: 0, budget: 0 }), "");
  assert.equal(imageNote(null), "");

  // AND ZERO IS BYTE-IDENTICAL TO WHAT IT WAS, which is what keeps every caller
  // that knows nothing about this field exactly where it was.
  assert.equal(imageNote({ made: 2, planned: 2, budget: 2 }), "Made 2 photographs for the site.");
  assert.equal(imageNote({ made: 2, planned: 2, budget: 2, unaffordable: 0 }), "Made 2 photographs for the site.");

  // THE CLAUSE RIDES THE FAILURE SENTENCES TOO, because "the provider refused
  // the one we could pay for" and "the balance would not cover the second" are
  // two different true things about one request.
  assert.match(imageNote({ made: 0, planned: 2, budget: 1, error: "502", unaffordable: 1 }),
    /Couldn't make the photographs this time[\s\S]*weren't enough credits for the other one/);
  // …AND NOT THE ZERO-BUDGET ONE, where nothing was affordable at all and the
  // clause would say the same thing twice in two different ways.
  assert.equal(imageNote({ made: 0, planned: 2, budget: 0, unaffordable: 2 }),
    "Not enough credits left over for photographs, so the pictures are placeholders for now.");
});

test("the credits sentence claims a placeholder only where one survived", () => {
  // ⚠ THE OWNER'S CONSTRAINT: *"Do not imply a placeholder exists unless one
  // actually survived publication."* `frames` is the observation — how many
  // empty picture frames the change really left — and this is the one branch a
  // page with no token at all can reach, because `full`, `slow`, `empty` and
  // the error sentence are each reachable only once a token was written and
  // swept.
  const said = (frames) => imageNote({ made: 0, planned: 1, budget: 0, ...(frames === undefined ? {} : { frames }) });
  assert.match(said(1), /so the pictures are placeholders for now\.$/, "a real frame stopped being called one");
  assert.match(said(0), /so there's no picture there for now\.$/);
  assert.doesNotMatch(said(0), /placeholder/, "a placeholder was promised where no frame survived");
  // A CALLER THAT DOES NOT KNOW SAYS WHAT IT ALWAYS SAID — the build path, which
  // passes no such count.
  assert.equal(said(undefined), "Not enough credits left over for photographs, so the pictures are placeholders for now.");
  // AND THE OTHER ZERO-BUDGET CAUSES KEEP THEIR OWN SENTENCES, since each one
  // needs a different action from the customer.
  assert.match(imageNote({ made: 0, planned: 1, budget: 0, full: true, frames: 0 }), /image library is full/);
  assert.match(imageNote({ made: 0, planned: 1, budget: 0, slow: true, frames: 0 }), /ran out of time/);
});

test("REUSING a photograph the site already has is accepted end to end", async () => {
  // ⚠ THE CAPABILITY ASSESSMENT THIS CORRECTS (owner, 2026-09-19): *"Existing
  // URLs can already reach the writer through page source, and reuse is
  // accepted."* Both halves are right, and `CLAUDE.md` had said the opposite —
  // *"a photograph the site already has cannot be placed on a new page"* — from
  // reading the directive alone rather than driving the path.
  //
  // WHAT IS PROVEN HERE is the second half: a `/u/` url the writer copies onto
  // a NEW page survives every wall between it and the publish. Nothing has to
  // be built for that; it is what the pipeline already does.
  const slug = "fw";
  const u = (c) => "/u/fw/" + c.repeat(32) + ".jpg";
  const home = { path: "index.tsx", source: '<SafeImage src="' + u("a") + '" alt="The bench" />' };
  const about = { path: "about.tsx", source: '<SafeImage src="' + u("b") + '" alt="The oven" />' };
  const reused = { path: "gallery.tsx", source: '<SafeImage src="' + u("a") + '" alt="The bench again" />' };
  const before = [home, about];
  const after = [home, about, reused];

  // 1. THE WALL SEES NO LOSS, because reuse ADDS. `keptImages` asks whether
  //    every photograph the site SHOWED is still shown, site-wide.
  assert.deepEqual(keptImages(before, after, slug), { ok: true, lost: [] },
    "reusing a photograph read as losing one");
  // 2. THE SWEEP LEAVES IT ALONE — it rewrites unbought `@@IMG:` tokens, and a
  //    real url is not one. Byte-identical is the assertion, not "still there".
  const swept = after.map((p) => ({ ...p }));
  applyImages(swept, {});
  assert.equal(swept[2].source, reused.source, "the sweep rewrote a url the writer reused");
  // 3. …AND THE SITE NOW SHOWS THE SAME TWO PHOTOGRAPHS, not three: distinct
  //    urls, so a picture drawn twice is one picture and no new spend.
  assert.deepEqual(shownPhotos(swept, slug), { known: true, count: 2 },
    "a reused photograph was counted as a second one");

  // ── THE TWO GAPS, MEASURED RATHER THAN ARGUED ────────────────────────────
  //
  // (a) GUIDANCE. The directive states the COUNT and forbids replacing or
  //     removing; it says nothing about showing one again, and carries no url.
  //     Recorded as a measurement of today's prompt: when guidance is added
  //     this goes red, which is the assessment changing rather than drifting.
  const d = imageDirective({ buy: null, shown: shownPhotos(before, slug), place: false });
  assert.match(d, /already shows 2 real photographs/, "the count is not stated at all: " + d);
  assert.equal(d.includes("/u/"), false, "the directive carries a url — re-read the assessment: " + d);
  // (b) CONTEXT. The inventory is SITE-WIDE and the source the writer is shown
  //     is bounded, so on a large site the count can name a photograph whose
  //     page was withheld — and then no url reaches the writer at all. The two
  //     readers are different questions and this pins that they can disagree.
  const { priorPagesSent, MAX_PRIOR_CHARS } = await import("../builder/page-gen.mjs");
  const filler = (n) => "const x" + n + ' = "' + "y".repeat(44000) + '";';
  const big = [
    { path: "index.tsx", source: filler(1) },
    { path: "about.tsx", source: filler(2) },
    { path: "kitchen.tsx", source: '<SafeImage src="' + u("a") + '" alt="The bench" />' + filler(3) },
  ];
  assert.ok(big.reduce((n, p) => n + p.source.length, 0) > MAX_PRIOR_CHARS, "this site fits — the case tests nothing");
  const sent = priorPagesSent(big, { keep: ["/"] });
  assert.equal(sent.shown.some((p) => p.source.includes(u("a"))), false,
    "the page carrying the photograph was shown — pick a bigger fixture");
  assert.deepEqual(shownPhotos(big, slug), { known: true, count: 1 },
    "the count is not site-wide, so the two readers cannot disagree");
});
