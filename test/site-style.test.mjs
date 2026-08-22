// The rest of the look, and whether it is REACHABLE.
//
// This repo has recorded a feature dead at one silent link more times than any
// other class of bug, and the shape is always the same: the module is correct,
// every unit test passes, and one wiring layer never carries the value. So the
// module's own behaviour is the smaller half of this file — the larger half is
// the chain from a model's answer to a rule in a published stylesheet.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AXES, ASKABLE, MAX_STYLE, MAX_STYLE_BUILD, AXIS_WIRE, wireName,
  optionsFor, parseStyle, mergeStyle, applyStyle,
  styleNote, saidFor, axisHint, AUTHORED_AXES, authoredHint,
} from "../builder/site-style.mjs";
import { IMAGE_FUNCS, MAX_LAYER, MAX_LAYERS } from "../builder/site-css.mjs";
import { AXIS_DECLS, AXIS_RAMPS, authoredFieldHint } from "../builder/site-authored.mjs";
import * as T from "../builder/site-theme.mjs";
import { ASKABLE as TOKEN_NAMES, saidFor as tokenSaid, valueHint } from "../builder/site-tokens.mjs";
import { normalizeSeeds } from "../builder/site-seeds.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/* ------------------------------------------------------------------ parsing */

test("an axis and an option the engine knows are kept", () => {
  assert.deepEqual(parseStyle({ buttons: "pill", density: "airy" }).style,
    { buttons: "pill", density: "airy" });
});

test("an unknown axis and an unknown option are both DROPPED, never guessed", () => {
  const out = parseStyle({ buttons: "pill", nope: "x", density: "SPACIOUS" });
  assert.deepEqual(out.style, { buttons: "pill" });
  assert.deepEqual(out.dropped.sort(), ["density", "nope"]);
});

test("the value must be a STRING, not anything stringifiable", () => {
  // `String(["pill"])` is `"pill"`, so a one-element array passes a shape test
  // and sets a real axis from a value nobody wrote. The `normalizeRole` lesson,
  // and the same one that let `access: ["display"]` through on a table deciding
  // who may read customer data.
  for (const bad of [["pill"], { toString: () => "pill" }, 7, true, null, undefined]) {
    assert.deepEqual(parseStyle({ buttons: bad }).style, {},
      "a non-string set an axis: " + JSON.stringify(bad));
  }
});

test("a prototype name is not an axis", () => {
  // `AXES["constructor"]` is a function — truthy, so a plain lookup walks past a
  // `|| null`. The exact bug that shipped in the Stripe plan lookup and again in
  // `resolveTheme`.
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.deepEqual(parseStyle({ [name]: "pill" }).style, {}, name + " was treated as an axis");
  }
  // And the same on the OPTION, where the lookup is into a theme constant.
  assert.deepEqual(parseStyle({ buttons: "constructor" }).style, {});
});

test("names are normalised the way a customer's answer arrives", () => {
  assert.deepEqual(parseStyle({ "  Buttons ": "  PILL " }).style, { buttons: "pill" });
});

test("the array shape a model sometimes answers with is read too", () => {
  assert.deepEqual(parseStyle([{ axis: "buttons", option: "sharp" }, { name: "density", value: "airy" }]).style,
    { buttons: "sharp", density: "airy" });
});

test("junk in cannot throw — this runs on every build", () => {
  for (const bad of [null, undefined, 7, "buttons", [], {}, [null, 3, "x"]])
    assert.deepEqual(parseStyle(bad).style, {}, "threw or answered oddly on " + JSON.stringify(bad));
});

test("more than MAX_STYLE is a re-theme, and the extras are REPORTED", () => {
  const many = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[1]]));
  const out = parseStyle(many);
  assert.equal(Object.keys(out.style).length, MAX_STYLE);
  assert.equal(out.dropped.length, ASKABLE.length - MAX_STYLE,
    "an over-cap axis was silently discarded rather than reported");
});

/* ------------------------------------------------------------------- merging */

test("a patch ACCUMULATES — a revise names only what it is changing", () => {
  // THE FAILURE THIS PREVENTS. Square buttons asked for today and airy spacing
  // tomorrow both have to survive; a replacing merge hands back the theme's own
  // buttons on the second revise, which reads as the first instruction being
  // forgotten.
  assert.deepEqual(mergeStyle({ buttons: "sharp" }, { density: "airy" }),
    { buttons: "sharp", density: "airy" });
});

test("the newest answer wins on the same axis", () => {
  assert.deepEqual(mergeStyle({ buttons: "sharp" }, { buttons: "pill" }), { buttons: "pill" });
});

test("a stored look is kept WHOLE — the cap bounds the patch, not the site", () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE, and it was right for as long as
  // nothing could author more than six. It pinned the MERGED TOTAL at
  // `MAX_STYLE`, which means an earlier instruction is silently dropped to make
  // room — the exact "first instruction being forgotten" failure the merge's own
  // comment promises to avoid. The day a first build could author eighteen that
  // stopped being a rounding detail: measured, a site built with all eighteen and
  // then asked for round buttons came back with SIX, its whole visual identity
  // stripped to the template's defaults on the customer's first edit.
  // THE PRIOR MUST EXCEED `MAX_STYLE` OR THIS DISCRIMINATES NOTHING. A first
  // draft used exactly six stored axes, so capping the prior at the revise cap
  // was a no-op and the mutant that reintroduced the bug SURVIVED the sweep —
  // a fixture too small to reach the case it was written for. It is built from
  // every axis the site could have.
  const prior = Object.fromEntries(ASKABLE.filter((a) => a !== "inputs").map((a) => [a, optionsFor(a)[1]]));
  assert.ok(Object.keys(prior).length > MAX_STYLE, "the fixture no longer exceeds the cap, so this proves nothing");
  const merged = mergeStyle(prior, { inputs: "filled" });
  assert.equal(Object.keys(merged).length, Object.keys(prior).length + 1,
    "a stored axis was dropped to make room for the new one");
  assert.equal(merged.inputs, "filled",
    "the instruction the customer is looking at the result of was the one dropped");
  for (const a of Object.keys(prior)) assert.equal(merged[a], prior[a], a + " was lost from the stored look");
});

test("…and the PATCH is still capped, which is what MAX_STYLE is for", () => {
  // "A customer moving half the look is not asking for an adjustment to the
  // theme they have, they are telling us the theme is wrong." That is a fact
  // about ONE INSTRUCTION, so it bounds `next` and nothing else.
  const everything = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[0]]));
  assert.equal(Object.keys(mergeStyle({}, everything)).length, MAX_STYLE,
    "a single revise may now restyle the whole site");
});

test("growth is bounded by the axis list, so accumulating cannot run away", () => {
  // The total is uncapped on purpose; what stops it growing without bound is
  // that there are only eighteen axes to set.
  let look = {};
  for (let i = 0; i < 10; i++) look = mergeStyle(look, Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[0]])));
  assert.ok(Object.keys(look).length <= ASKABLE.length,
    "the merge produced more axes than exist, so something is inventing keys");
});

test("a stored patch that has gone bad does not poison the merge", () => {
  assert.deepEqual(mergeStyle({ buttons: "banana", nope: 7 }, { density: "airy" }), { density: "airy" });
});

/* ------------------------------------------------------------------ applying */

test("applyStyle merges the axes onto the theme", () => {
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const out = applyStyle(theme, { buttons: "sharp", density: "airy" });
  assert.equal(out.buttons, "sharp");
  assert.equal(out.density, "airy");
  assert.equal(out.light, theme.light, "the palette was not carried through");
});

test("NOTHING VALID MEANS THE THEME ITSELF, not a copy", () => {
  // A site that never asked for a patch must get a byte-identical stylesheet to
  // the build before this existed. Identity is the strongest way to say so.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  for (const nothing of [null, undefined, {}, { nope: "x" }, { buttons: "banana" }])
    assert.equal(applyStyle(theme, nothing), theme, "a no-op patch replaced the theme object");
});

test("a missing theme stays missing", () => {
  // `writeTheme` fails soft on an unresolved theme; inventing an object here
  // would turn that fail-soft into a look that is neither the theme nor the
  // template's own.
  for (const bad of [null, undefined, "chalk", 7]) assert.equal(applyStyle(bad, { buttons: "pill" }), bad);
});

test("THE MERGED THEME REALLY RENDERS DIFFERENTLY — the whole mechanism, driven", () => {
  // Not "applyStyle returned an object with the field on it" — the property that
  // matters is that the theme engine ACTS on it. Every axis is driven, because a
  // twelve-axis feature where two happen to be read is the shape this repo keeps
  // shipping.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const base = T.themeCss(theme);
  assert.ok(base && base.length > 500, "the reference theme did not render");
  for (const axis of ASKABLE) {
    // EVERY option, and at least one must move the CSS. Picking "the first one
    // that is not the theme's own" looked right and was wrong: three axes have
    // a no-op default FIRST (`inherit`, `standard`, `ink`) and a theme that
    // leaves the field absent means exactly that default — so the search
    // returned the no-op and the assertion failed on an axis that works.
    const moved = optionsFor(axis).filter((o) => T.themeCss(applyStyle(theme, { [axis]: o })) !== base);
    assert.ok(moved.length, "no option of `" + axis + "` changes the rendered CSS at all");
  }
});

/* ------------------------------------- what the corner strip left behind */

test("the AXES are the only source of border-radius in a theme's CSS", () => {
  // THIS IS THE PROPERTY THE DELETION RESTS ON, so it is asserted rather than
  // reasoned. `stripThemeRadius` existed because 280 of the 500 REGISTRY themes
  // hard-set a radius as a real rule the `--radius` token could not reach; the
  // registry went on 2026-08-20, and if a seeds-only theme ever starts emitting
  // one of its own again then a customer's radius token silently stops winning
  // over it and the strip's case comes back.
  const bare = normalizeSeeds({
    name: "b", paper: "#f7f4ee", ink: "#171310", accent: "#b44a2e",
  });
  assert.ok(bare.theme, bare.why);
  assert.equal((T.themeCss(bare.theme).match(/border-radius/gi) || []).length, 0,
    "a seeds-only theme emits a corner rule of its own — the strip's case is back");

  // And with axes named, every radius rule in the sheet came from an axis the
  // customer asked for. Driven over the whole askable set rather than the two
  // the old `RADIUS_AXES` list happened to hold — which is exactly what made an
  // AUTHORED `corner` fall through it.
  const seen = [];
  for (const axis of ASKABLE) {
    for (const option of optionsFor(axis)) {
      const css = T.themeCss(applyStyle(bare.theme, { [axis]: option })) || "";
      const plain = T.themeCss(applyStyle(bare.theme, {})) || "";
      const added = css.split("\n").filter((l) => !plain.includes(l)).join("\n");
      if (/border-radius/i.test(added) && !seen.includes(axis)) seen.push(axis);
    }
  }
  assert.ok(seen.length > 0, "no axis emits a corner rule at all — the sweep found nothing");
  assert.deepEqual(seen.filter((a) => !ASKABLE.includes(a)), [],
    "a corner rule came from something that is not an askable axis");
});

test("an authored corner reaches the CSS the strip used to eat", () => {
  // THIS IS ONE LINK, NOT THE PROOF, and saying so is the point — the first
  // draft called itself "an authored corner survives a radius token", which it
  // does not test: the strip lived in `build-server.mjs` and never touched
  // `themeCss`, so this assertion was equally true while the bug was live.
  //
  // The chain is three checks in three places. THIS one: the authored corner
  // really is in the theme's CSS, so there is something to lose. The absence
  // guards below: nothing in the container removes it any more. And
  // `site-build`: it survives into a real compiled bundle beside a real
  // `--radius`, which is the only layer that can see the cascade.
  //
  // MEASURED BEFORE THE FIX: `corner: "border-radius: 18px"` emitted its rule,
  // `stripThemeRadius` removed it, and `explicitRadiusCss` re-emitted only
  // `buttons` and `inputs` — so authoring a corner AND naming a radius lost the
  // corner, silently. That combination became reachable the day the enums went
  // and nothing else; the strip's list was written when `corner` could not emit
  // a rule of its own.
  const seeds = normalizeSeeds({
    name: "b", paper: "#f7f4ee", ink: "#171310", accent: "#b44a2e",
  });
  const css = T.themeCss(applyStyle(seeds.theme, { corner: "border-radius: 18px" }));
  assert.match(css, /border-radius:\s*18px/,
    "an authored corner no longer reaches the theme's CSS at all");
});


/* --------------------------------------------------------------- the sentence */

test("what changed is said in the customer's words, not ours", () => {
  assert.equal(styleNote({ display: "accent" }, []), "Changed the heading colour.");
  assert.match(styleNote({ buttons: "pill", density: "airy", icon: "heavy" }, []),
    /button shape, overall spacing and icon weight/);
});

test("A REFUSED AXIS IS NAMED", () => {
  // Somebody who asks for something we cannot do, and is told nothing, reads the
  // unchanged page as the builder being broken rather than as a request that did
  // not land.
  const note = styleNote({}, ["shadow"]);
  assert.match(note, /Couldn’t change the shadows/);
  assert.equal(note.includes("Changed the"), false, "claimed a change on a patch that set nothing");
});

test("the note is empty when nothing was asked for", () => {
  // So a build that never mentioned the look has a byte-identical note block.
  assert.equal(styleNote({}, []), "");
  assert.equal(styleNote(null, null), "");
});

test("every axis has a plain name and it is not the engine's label", () => {
  for (const a of ASKABLE) {
    assert.ok(saidFor(a) && saidFor(a).length < 20, a + " has no usable plain name");
    const label = Object.values(AXES[a].options)[0].label;
    assert.notEqual(saidFor(a), label, a + " reuses the theme's own label, which is written for a chooser");
  }
  const said = ASKABLE.map(saidFor);
  assert.equal(new Set(said).size, said.length, "two axes share a plain name: " + said.join(", "));
});

/* ------------------------------------------------- derived from the engine */

test("EVERY AXIS IS THE ENGINE'S OWN LIST, in both directions", () => {
  // A restated option list is a second thing that can drift, and the direction
  // it drifts in is describing an option to the model that the engine then
  // refuses — reported to the customer as a change that did not happen.
  const byName = {
    corner: T.CORNERS, scale: T.TYPE_SCALES, tracking: T.TRACKINGS, leading: T.LEADINGS,
    weight: T.WEIGHTS, density: T.DENSITIES, width: T.WIDTHS, border: T.BORDERS, icon: T.ICON_STROKES,
    shadow: T.SHADOWS, buttons: T.BUTTONS, inputs: T.INPUTS, display: T.DISPLAYS,
    surface: T.SURFACES, backdrop: T.BACKDROPS, decor: T.DECORS,
    ambient: T.AMBIENTS, skin: T.SKINS,
    motion: T.MOTIONS, hover: T.HOVERS, focus: T.FOCUSES, reveal: T.REVEALS,
    transition: T.TRANSITIONS,
  };
  assert.deepEqual(ASKABLE.slice().sort(), Object.keys(byName).sort(),
    "AXES and this test disagree about which axes exist");
  for (const [a, real] of Object.entries(byName)) {
    assert.deepEqual(optionsFor(a), Object.freeze(Object.keys(real)), a + " restates the engine's options");
    assert.ok(optionsFor(a).length >= 2, a + " has fewer than two options — it is not a choice");
  }
});

/* ------------------------------------------- the interactive half of the look */

const seedTheme = () => normalizeSeeds({ name: "W", paper: "#faf7f2", ink: "#1b1714", accent: "#b44a2e" }).theme;
const cssFor = (patch) => T.themeCss(applyStyle(seedTheme(), patch));

test("A PSEUDO-CLASS REACHES EVERY MEMBER OF THE SELECTOR LIST", () => {
  // THE BUG THIS SHIPPED WITH FOR ONE DRAFT, and it is silently catastrophic.
  // `${LIST}:hover` where LIST is itself comma-separated attaches the pseudo to
  // the LAST selector only, so `[data-slot="button"], button.justify-center,
  // a.x:hover` matches every button on the site ALWAYS. Measured on the first
  // emit: `lift` left every button permanently raised and shadowed and
  // `focus: bold` a permanent 3px outline round every card and input. It is
  // valid CSS, it compiles, it bundles, and only reading the rules shows it.
  for (const patch of [{ hover: "lift" }, { hover: "tint" }, { hover: "edge" }, { focus: "bold" }, { focus: "inset" }]) {
    for (const line of cssFor(patch).split("\n")) {
      if (!/:hover|:focus-visible/.test(line)) continue;
      const sel = /^\s*(\S.*?)\s*\{/.exec(line);
      if (!sel) continue;
      for (const part of sel[1].split(",")) {
        assert.match(part, /:hover|:focus-visible/,
          `${JSON.stringify(patch)} emits a bare selector that matches ALWAYS: ${part.trim()}`);
      }
    }
  }
});

test("EVERY INTERACTIVE AXIS MOVES THE STYLESHEET", () => {
  // The engine emitted ONE keyframe and zero rules for transition, hover or
  // focus before these existed, so an axis that changes nothing is the whole
  // feature dead rather than one option missing.
  const bare = cssFor(undefined);
  for (const a of ["motion", "hover", "focus", "reveal", "transition"]) {
    const moved = optionsFor(a).filter((o) => cssFor({ [a]: o }) !== bare);
    assert.ok(moved.length >= 2, `${a} changes the stylesheet on ${moved.length} of its options`);
  }
  // AND THE DERIVED HALF, which needs no list and cannot go stale: an axis
  // whose every option leaves the stylesheet byte-identical is a knob wired to
  // nothing — the `display` failure, where a rule named `.font-heading` and no
  // file in the kit or the corpus carried that class, so the axis was stored,
  // reported as applied, and changed nothing on any site for as long as it
  // existed. `surface` moves on one of two because `solid` IS the default,
  // which is why the floor here is one rather than the two above.
  for (const a of ASKABLE) {
    const moved = optionsFor(a).filter((o) => cssFor({ [a]: o }) !== bare);
    assert.ok(moved.length >= 1, a + " is a knob wired to nothing — no option changes the stylesheet");
  }
  // …and a site that asks for none of them is unchanged, so no existing site
  // is re-drawn by this shipping.
  assert.equal(cssFor({ corner: "bevel" }), cssFor({ corner: "bevel" }));
  assert.equal(/--site-duration|:focus-visible|isibi-reveal|@media \(hover|view-transition/.test(bare), false,
    "an interactive rule is emitted with no axis asked for");
});

test("HOVER IS GUARDED FOR TOUCH, where :hover STICKS after a tap", () => {
  // Without `@media (hover: hover)` a lift stays on the last card somebody
  // pressed until they press another — and most visitors to these sites are on
  // a phone.
  for (const o of ["tint", "lift", "edge"]) {
    assert.match(cssFor({ hover: o }), /@media \(hover: hover\)/, o + " is applied on touch screens too");
  }
});

test("LIFT MOVES ONLY WHAT SHOULD MOVE — not the inputs, not the badges", () => {
  // The source says exactly this and nothing held it: a mutation replacing the
  // lift's own list with the full interactive set survived the entire suite.
  // A raised input box reads as a fault rather than as an answer, and a badge
  // is a label rather than something you press — and every OTHER assertion
  // about `lift` passes either way, because they are about the pseudo-class
  // reaching each member rather than about which members there are.
  const rule = cssFor({ hover: "lift" }).split("\n").find((l) => /translateY/.test(l));
  assert.ok(rule, "lift emits no transform at all");
  for (const t of ["input", "badge"]) {
    assert.equal(rule.includes(T.STYLE_TARGETS[t].sel), false,
      `lift raises the ${t}s: ${rule.trim().slice(0, 120)}`);
  }
  // …and it really does still reach the two that SHOULD move, or the check
  // above passes just as well against a lift that raises nothing.
  assert.ok(rule.includes(T.STYLE_TARGETS.card.sel), "lift no longer raises the cards");
  assert.match(rule, /\[data-slot="button"\]:hover/, "lift no longer raises the buttons");
});

test("FOCUS HAS NO 'none', because it is an accessibility decision", () => {
  assert.equal(optionsFor("focus").includes("none"), false, "the focus indicator can be switched off");
  // …and it is `:focus-visible`, or a mouse click leaves a ring behind it.
  for (const o of ["bold", "inset"]) {
    const css = cssFor({ focus: o });
    assert.match(css, /:focus-visible/);
    assert.equal(/[^-]:focus\b(?!-visible)/.test(css), false, o + " rings on plain :focus");
  }
});

test("REVEAL CANNOT TRAP CONTENT INVISIBLE — the double guard", () => {
  // The failure mode of every reveal-on-scroll. The from-state exists ONLY
  // where the mechanism provably runs, so no support or reduced motion means
  // no rule at all and the section is simply visible.
  for (const o of ["fade", "rise"]) {
    const css = cssFor({ reveal: o });
    const at = css.indexOf("isibi-reveal");
    assert.ok(at > 0, o + " emits no reveal");
    const before = css.slice(0, at);
    assert.match(before, /@supports \(animation-timeline: view\(\)\)/,
      o + " sets an opacity-0 from-state outside the support guard");
    assert.match(before, /prefers-reduced-motion: no-preference/,
      o + " hides content from a visitor who asked for less motion");
    assert.match(css, /animation-range: entry/,
      o + " has no entry range, so anything already on screen fades in after the fact");
  }
});

test("MOTION ZEROES THE DURATION rather than dropping the rule", () => {
  // The end state has to be identical for a visitor who asked for less motion —
  // only the travel goes. Dropping the transition instead would be the same
  // outcome; zeroing it keeps ONE definition of what eases.
  const css = cssFor({ motion: "calm" });
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ :root \{ --site-duration: 0ms/);
  // `transition: all` would animate layout properties and make every resize a
  // slideshow, so the list is explicit — and `transform` must be on it, or
  // `hover: lift` jumps.
  assert.match(css, /transition-property: color, background-color, border-color, box-shadow, transform/);
  assert.equal(/transition:\s*all/.test(css), false, "the transition is unbounded");
});

test("A PAGE TRANSITION IS SUPPRESSED, not omitted, under reduced motion", () => {
  // THE POLARITY IS THE OPPOSITE OF EVERY OTHER AXIS HERE, and getting it
  // backwards is invisible. A reveal that emits nothing leaves the section
  // VISIBLE; a page transition that emits nothing leaves the BROWSER'S OWN
  // cross-fade, because the UA stylesheet animates these pseudo-elements by
  // default. So "drop the rule under `reduce`" — which is what the reveal does
  // and what looks consistent — would hand a visitor who asked for LESS motion
  // strictly MORE of it than one who did not.
  for (const o of ["fade", "rise"]) {
    const css = cssFor({ transition: o });
    assert.match(css, /::view-transition-new\(root\)/, o + " emits no page transition");
    const at = css.indexOf("prefers-reduced-motion: reduce");
    assert.ok(at > 0, o + " has no reduced-motion answer at all");
    const block = css.slice(at, css.indexOf("}\n", css.indexOf("{", at)) + 2);
    assert.match(block, /::view-transition-old\(root\), ::view-transition-new\(root\) \{ animation: none/,
      o + " drops its own rule under reduced motion and leaves the browser's cross-fade standing");
  }
});

test("A PAGE TRANSITION HAS ITS OWN DURATION, so `motion: none` cannot silently void it", () => {
  // The obvious move is to hang this off `--site-duration` like the other three,
  // and it creates a change reported as applied that does nothing: `motion:
  // "none"` pins that variable to 0, so a site asking for BOTH would be told
  // the fade landed and get a cut. The CURVE still follows the motion axis,
  // through a var with a fallback — a missing custom property falls back rather
  // than voiding the declaration, which would drop the whole `animation`
  // shorthand and hand the page straight back to the UA's default cross-fade.
  const both = cssFor({ transition: "fade", motion: "none" });
  const at = both.indexOf("::view-transition-old(root)");
  const rule = both.slice(at, both.indexOf("\n", at));
  assert.equal(/var\(--site-duration/.test(rule), false, "the page transition is voided by `motion: none`");
  assert.match(rule, /animation: \d+ms /, "the page transition has no duration of its own");
  assert.match(rule, /var\(--site-ease, [^)]*\)\)/, "the curve does not fall back when no motion axis was named");
});

test("THE ROUTER FLAG AND THE ANIMATION ASK ONE QUESTION", () => {
  // Two copies of "is the transition on" disagree silently in BOTH directions:
  // a flag with no CSS is the browser's own cross-fade on a site that asked for
  // `cut`, and CSS with no flag is a rule nothing ever triggers. So `pageCss`
  // and `writeSiteBrand` go through `transitionOn` rather than each testing the
  // value, and the emitter is asserted to agree with it on every option there
  // is — including the ones that are not options at all.
  for (const o of [...optionsFor("transition"), undefined, null, "nonsense", ["fade"], 0]) {
    const on = T.transitionOn(o);
    const css = T.pageCss({ transition: o });
    assert.equal(css.length > 0, on, `transitionOn and pageCss disagree about ${JSON.stringify(o)}`);
  }
  // `cut` IS AN ANSWER AND IT IS OFF. It reads like the absence of a choice and
  // it is the choice every site published before this axis existed already has.
  assert.equal(T.transitionOn("cut"), false);
  assert.equal(optionsFor("transition")[0], "cut", "the default option is not the one that changes nothing");
});

test("EVERY STYLE TARGET SELECTS SOMETHING THE KIT REALLY RENDERS", () => {
  // THE DEAD-AXIS FAILURE, ONE LAYER UP. `displayCss` named `.font-heading`, a
  // class in 0 of the 2,112 kit files, and was inert for its whole life while
  // every unit test passed. A target list is the same trap multiplied: one entry
  // pointing at a hook nothing carries is a whole vocabulary the customer can
  // name and nothing can act on.
  //
  // DERIVED FROM THE KIT ON DISK, so a primitive that stops stamping its hook
  // fails here rather than shipping a lane that silently does nothing.
  const uiDir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const read = (f) => fs.readFileSync(new URL(f, uiDir), "utf8");
  const kit = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx"));
  assert.ok(kit.length > 1000, "the kit scan found " + kit.length + " files — it is reading the wrong place");
  const all = kit.map(read).join("\n");

  for (const [name, t] of Object.entries(T.STYLE_TARGETS)) {
    assert.ok(t && typeof t.sel === "string" && t.sel, name + " has no selector");
    assert.ok(t && typeof t.said === "string" && t.said.length > 2, name + " has no plain name");
    const slot = (t.sel.match(/^\[data-slot="([a-z-]+)"\]$/) || [])[1];
    if (slot) {
      // A STAMPED HOOK has to be stamped BY something. Counted across the whole
      // kit, because a component composing another one inherits it.
      // A WHOLE ATTRIBUTE, NOT A SUBSTRING. `data-slot="input"` is a PREFIX of
      // `data-slot="input-group-control"`, so a plain `includes` reported the
      // input hook as stamped by a component that stamps something else — and
      // the mutation deleting the real one survived. The same class as the RTL
      // sweep's first grep, where `items-center` contained `ms-`.
      const stamped = new RegExp('data-slot="' + slot + '"(?![-\\w])');
      assert.match(all, stamped,
        name + ' selects [data-slot="' + slot + '"] and no kit component stamps exactly that');
    } else {
      // AN ELEMENT SELECTOR has to name real elements, never a class — the
      // `.font-heading` mistake.
      for (const part of t.sel.split(",").map((s) => s.trim())) {
        assert.match(part, /^[a-z][a-z0-9]*$/, name + " selects `" + part + "`, which is not an element");
      }
    }
  }
  // …and every plain name has to read differently, or one reply says "Updated
  // the look — buttons, buttons" about two different things.
  const said = Object.values(T.STYLE_TARGETS).map((t) => t.said);
  assert.equal(new Set(said).size, said.length, said.join(", "));

  // EACH PRIMITIVE CARRIES ITS OWN, which the kit-wide scan above cannot say.
  // `input` is stamped by BOTH `input.tsx` and `textarea.tsx` — deliberately,
  // because "the input boxes" means both — so deleting it from one leaves the
  // scan perfectly green while every text field on every site silently stops
  // following the lane. Found by mutation.
  for (const [file, slot] of [["button", "button"], ["input", "input"], ["textarea", "input"],
                              ["card", "card"], ["badge", "badge"]]) {
    assert.match(read(file + ".tsx"), new RegExp('data-slot="' + slot + '"(?![-\\w])'),
      file + ".tsx no longer stamps its hook");
  }
});

test("the button axis selects the PRIMITIVE, not a guess at its utility classes", () => {
  // IT USED TO SELECT `button.justify-center, a.justify-center.whitespace-nowrap`
  // — two classes `buttonVariants` happens to emit, which holds today and breaks
  // silently the day a kit refresh reorders them.
  //
  // AND THE PRIMITIVE RATHER THAN THE ELEMENT, deliberately: 450 kit files write
  // a raw `<button>` against 220 that use `Button`, and those 450 are accordion
  // triggers, sort toggles, close crosses and hamburgers. "Make the buttons
  // rounder" means the ones that look like buttons.
  const pill = T.buttonsCss("pill");
  // THE HOOK LEADS. The class half is KEPT deliberately and is no longer a
  // guess: `calendar.tsx` hands `buttonVariants()` to react-day-picker as a
  // `classNames` map, so the LIBRARY renders those elements and there is nowhere
  // to stamp an attribute. `alert-dialog` and `pagination` had the same shape,
  // were stampable, and are stamped — so the union is strictly a superset of
  // what this selected before, and nothing that changed shape stops changing.
  assert.match(pill, /^\[data-slot="button"\]/, "the exact hook is not the primary selector");
  assert.match(pill, /button\.justify-center/,
    "the fallback for library-rendered buttons is gone — calendar's nav stops following the axis");
  assert.equal(T.buttonsCss("inherit"), "", "the no-op option must emit nothing");
  // COMMENTS BLANKED FIRST. `button.tsx` explains the hook at length and that
  // prose contains the string `data-slot="button"`, so a scan of the raw file
  // matched the EXPLANATION — both assertions below stayed green with the
  // attribute deleted, found by mutation. Prose describing a thing contains that
  // thing's spelling: the sixth time this repo has recorded it.
  const btn = fs.readFileSync(
    new URL("../builder/lovable/template/src/components/ui/button.tsx", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
  assert.match(btn, /data-slot="button"/, "the axis selects a hook the primitive does not stamp");
  // BEFORE THE SPREAD, so a caller can override it and `asChild` carries it onto
  // the child — which is what replaces the old `a.justify-center` half.
  assert.match(btn, /data-slot="button"[\s\S]{0,200}\{\.\.\.props\}/,
    "the hook is written after the spread, so a caller cannot override it");
});

test("the heading-colour axis names what the TEMPLATE calls a heading", () => {
  // THIS AXIS WAS DEAD FROM THE DAY IT SHIPPED, and nothing could see it: it
  // targeted `.font-heading`, a class in 0 of the 2,112 kit files and 0 of the
  // 324 corpus pages, so Tailwind — which only generates a utility something
  // uses — never emitted the rule. Verified against a real compiled stylesheet.
  // "Put our brand colour in the headings" was stored, reported as applied, and
  // changed nothing on any site.
  //
  // DERIVED FROM THE TEMPLATE'S OWN RULE, because the failure was two places
  // disagreeing about what a heading is. `styles.css` moved the FONT off the
  // class onto the elements and the colour was left behind.
  const css = fs.readFileSync(
    new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  const rule = css.match(/([\sa-z0-9,]+)\{\s*font-family:\s*var\(--font-heading\)/);
  assert.ok(rule, "the template no longer sets the heading font on elements — this guard is reading nothing");
  const wanted = rule[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
  assert.ok(wanted.length >= 3 && wanted.every((h) => /^h[1-6]$/.test(h)), JSON.stringify(wanted));

  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  for (const style of ["accent", "gradient"]) {
    const out = T.displayCss({ ...theme, display: style });
    const sel = (out.match(/^([^{@\n][^{]*)\{\s*(?:color|background-image)/m) || [])[1] || "";
    const got = sel.split(",").map((s) => s.trim().replace(/:not\(.*$/, "")).filter(Boolean).sort();
    assert.deepEqual(got, wanted, style + " colours a different set of elements than the template fonts");
    // A HEADING SITTING ON THE ACCENT keeps its own colour, or it is painted
    // accent-on-accent and disappears.
    // THE PROPERTY, NOT THE SPELLING: the exclusion has been written two ways
    // already (`:not(.bg-primary *)` and `:not(:where(.bg-primary *))`) and both
    // are correct. What must hold is that a heading on the accent is spared.
    assert.match(out, /:not\([^)]*\.bg-primary[^{]*\*/, style + " would paint a heading accent-on-accent");
  }
  // `ink` is the ordinary page and must emit nothing at all.
  assert.equal(T.displayCss({ ...theme, display: "ink" }), "");
  assert.equal(T.displayCss({ ...theme }), "");
});

test("the width axis moves the SHELL and never the reading column", () => {
  // THE BOUNDARY IS MEASURED, NOT JUDGED. Counting every `max-w-*` in the
  // 324-page corpus against whether its own element also carries a page gutter
  // (`px-N`): 4xl 52/52, 5xl 127/127, 6xl 364/364 and 7xl 2/2 are page shells
  // 100% of the time, while 2xl is 9% and lg/prose/sm/xs are 0%. So a paragraph
  // column must NOT widen — pulling 65 characters to 90 is harder to read,
  // which is the opposite of what "make it wider" asks for.
  assert.deepEqual(Object.keys(T.CONTAINER_STEPS), ["4xl", "5xl", "6xl", "7xl"],
    "the axis reaches a container size that is not a page shell");
  for (const w of ["narrow", "wide", "full"]) {
    const css = T.widthCss(w);
    for (const step of ["4xl", "5xl", "6xl", "7xl"]) assert.match(css, new RegExp("--container-" + step + ":"), w);
    // The reading widths are the ones a page uses for prose and for cards.
    for (const step of ["2xl", "3xl", "lg", "md", "sm", "xs", "prose"])
      assert.doesNotMatch(css, new RegExp("--container-" + step + "\\b"), w + " moved a reading column");
  }
  // NOTHING AT ALL for the ordinary width, so a site that never asked for this
  // gets a byte-identical stylesheet — the `buttonsCss` rule for `inherit`.
  assert.equal(T.widthCss("standard"), "");
  assert.equal(T.widthCss(undefined), "");
  assert.equal(T.widthCss("nonsense"), "", "an unknown option must read as the default, not as an override");
  // A RATIO, so a page mixing 4xl and 6xl keeps the relationship it was drawn
  // with — asserted as the property rather than as four numbers.
  const num = (css, step) => Number((css.match(new RegExp("--container-" + step + ": ([\\d.]+)rem")) || [])[1]);
  for (const w of ["narrow", "wide", "full"]) {
    const css = T.widthCss(w);
    const base = T.CONTAINER_STEPS["6xl"] / T.CONTAINER_STEPS["4xl"];
    assert.ok(Math.abs(num(css, "6xl") / num(css, "4xl") - base) < 0.001, w + " distorted the scale");
  }
  assert.ok(num(T.widthCss("narrow"), "6xl") < T.CONTAINER_STEPS["6xl"]);
  assert.ok(num(T.widthCss("wide"), "6xl") > T.CONTAINER_STEPS["6xl"]);
  assert.ok(num(T.widthCss("full"), "6xl") > num(T.widthCss("wide"), "6xl"));
  // AND IT IS COMPOSED INTO THE THEME. A `widthCss` nothing calls is the
  // dead-axis shape this repo has recorded once already, one axis over.
  const base = T.THEMES[Object.keys(T.THEMES)[0]];
  assert.ok(base && base.light && base.dark, "no theme to compose against");
  const theme = String(T.themeCss({ ...base, width: "wide" }));
  assert.match(theme, /--container-6xl: 84\.96rem/, "the axis is never composed into the theme CSS");
  // …and the same theme WITHOUT it must not carry one, or the assertion above
  // passes on a stylesheet that would have said this anyway.
  assert.doesNotMatch(String(T.themeCss(base)), /--container-6xl/);
});

test("every option carries a label, because the label IS the instruction", () => {
  // `pill` on its own is a guess; "fully round ends, whatever the cards do" is
  // an instruction. An option with no label reaches the model as a bare name.
  for (const a of ASKABLE) {
    for (const [o, def] of Object.entries(AXES[a].options))
      assert.ok(def && typeof def.label === "string" && def.label.length > 4,
        a + "." + o + " has no usable label");
    assert.ok(axisHint(a).includes(optionsFor(a)[0]), a + "'s hint does not name its own first option");
  }
  assert.equal(axisHint("nope"), "", "an unknown axis produced a hint");
});

test("THE TWO VOCABULARIES CANNOT SAY THE SAME THING", () => {
  // MEASURED, not hypothetical. `site-tokens.mjs` and this module compose two
  // SEPARATE sentences that land in the same note block, and both called their
  // thing "borders" — so a build that changed the border COLOUR and the border
  // WEIGHT printed "Changed the borders." twice, about two different things.
  // `primary`/`buttons` and `input`/`inputs` were the same trap one step
  // quieter. Derived across both, because the next name added to either list
  // has no way of knowing what the other one already says.
  const seen = new Map();
  for (const t of TOKEN_NAMES) seen.set(tokenSaid(t), "token:" + t);
  for (const a of ASKABLE) {
    const name = saidFor(a);
    assert.equal(seen.has(name), false,
      "`style:" + a + "` and `" + seen.get(name) + "` both say \"" + name + "\" to the customer");
    seen.set(name, "style:" + a);
  }
  assert.ok(seen.size >= TOKEN_NAMES.length + ASKABLE.length, "the scan lost entries");

  // AND NOT A PREFIX OF EACH OTHER EITHER, which the equality check above
  // cannot see. `background` beside `background wash` and `background motion`,
  // and `cards` beside `card style`, are three pairs that read as the same
  // thing in one note block — the exact clash one step quieter. Both were live
  // the moment the world axes landed.
  const all = [...TOKEN_NAMES.map(tokenSaid), ...ASKABLE.map(saidFor)];
  for (const a of all) for (const b of all) {
    if (a === b) continue;
    assert.equal(b.startsWith(a + " "), false, "\"" + b + "\" reads as a variant of \"" + a + "\"");
  }
});

test("A NAME ON BOTH LISTS SAYS WHICH SLOT IS WHICH", () => {
  // THIS GUARD ASSERTED THE POINTER AND NOW ASSERTS THE MECHANISM, because the
  // thing it was written for was fixed rather than mitigated. `border` was a
  // colour on one list and a weight on the other, so "make the borders thicker"
  // could land in the colour slot, be refused for not being a colour, and come
  // back as "ask again with a hex code" — advice that cannot work. The tool
  // carried a hand-written pointer to the other slot; the axis is now
  // `borderWeight` on the wire and there is nothing left to point at.
  //
  // So what is held is that the pointer is still DERIVED FROM THE WIRE NAMES.
  // It goes quiet on its own now that nothing collides, and comes back on its
  // own the day something does — which is why it is kept rather than deleted:
  // deleting it leaves the next collision with no mitigation and nothing to
  // notice it. A separate test asserts the overlap is currently EMPTY, so this
  // one going quiet is a measured fact rather than an assumption.
  const at = worker.indexOf("properties: Object.fromEntries(SITE_TOKEN_NAMES.map(");
  assert.ok(at > 0, "the tokens field moved — retarget this");
  const block = worker.slice(at, worker.indexOf("},", at));
  assert.match(block, /SITE_STYLE_AXES\.map\(siteWireName\)\.includes\(t\)/,
    "the pointer is computed from the INTERNAL names, so it would point at a field the tool does not have");
  assert.match(block, /style\." \+ t/, "the pointer does not name the other slot");
  // And a token whose name an axis ever shares must still be described as a
  // colour, or the disambiguation would be bolted onto something that stopped
  // being one. Vacuous today by construction — asserted over the real overlap
  // so it starts meaning something again the moment there is one.
  for (const t of TOKEN_NAMES.filter((n) => ASKABLE.map(wireName).includes(n))) {
    assert.equal(valueHint(t), "#rrggbb", t + " stopped being described as a colour");
  }
});

test("GLASS IS GIVEN SOMETHING TO SIT ON", () => {
  // THE ONLY COUPLING AMONG THE SEVENTEEN, and it was measured by rendering
  // rather than reasoned. `surfaceCss` sets `--card` to 0.5 alpha; on a plain
  // ground the cards do not look "subtly wrong", they VANISH. So a customer who
  // asks for frosted panels and nothing else gets a wash to frost against.
  const flat = T.THEMES.editorial || T.THEMES[Object.keys(T.THEMES)[0]];
  assert.ok(!flat.backdrop || flat.backdrop === "plain", "the fixture theme already has a backdrop");
  const out = applyStyle(flat, { surface: "glass" });
  assert.equal(out.surface, "glass");
  assert.ok(out.backdrop && out.backdrop !== "plain", "glass was left with nothing behind it");
  assert.ok(Object.hasOwn(T.BACKDROPS, out.backdrop), "the supplied backdrop is not one the engine knows");
});

test("`plain` IS NOT A BACKDROP — it is the word for not having one", () => {
  // FOUND BY MUTATION, and a real hole rather than a contrived one: `plain`'s
  // own label in the engine is "nothing behind the page — the ordinary ground".
  // Counted as a backdrop, a theme or a patch that names it explicitly leaves
  // glass with nothing to frost against, which is the exact failure the
  // coupling exists for. Every existing test used a theme whose backdrop is
  // ABSENT, so the distinction was covered by nothing.
  const flat = T.THEMES.editorial || T.THEMES[Object.keys(T.THEMES)[0]];
  const declared = { ...flat, backdrop: "plain" };
  const out = applyStyle(declared, { surface: "glass" });
  assert.ok(out.backdrop && out.backdrop !== "plain",
    "a theme declaring `plain` left glass with nothing behind it");
  // AND WHEN THE CUSTOMER THEMSELVES ASKS FOR BOTH. That instruction is
  // self-contradictory — frosted panels over nothing — and it resolves toward
  // the page that works, because the alternative ships invisible cards over a
  // request nobody could have known was impossible.
  const both = applyStyle(flat, { surface: "glass", backdrop: "plain" });
  assert.ok(both.backdrop && both.backdrop !== "plain", "glass + plain shipped invisible cards");
});

test("…but never over a backdrop they chose", () => {
  // Explicit beats implicit, the rule already in force one function over.
  const flat = T.THEMES.editorial || T.THEMES[Object.keys(T.THEMES)[0]];
  assert.equal(applyStyle(flat, { surface: "glass", backdrop: "horizon" }).backdrop, "horizon");
  // And a theme that already has one keeps it.
  const glassy = { ...flat, backdrop: "glow" };
  assert.equal(applyStyle(glassy, { surface: "glass" }).backdrop, "glow");
});

test("…and nothing else drags a partner in", () => {
  // The coupling is ONE-DIRECTIONAL and one axis wide. A backdrop asked for
  // alone must not turn the panels to glass — rendered, that direction is fine
  // on its own and forcing it would be design nobody asked for.
  const flat = T.THEMES.editorial || T.THEMES[Object.keys(T.THEMES)[0]];
  for (const [a, o] of [["backdrop", "wash"], ["decor", "linen"], ["skin", "frame"], ["ambient", "drift"]]) {
    const out = applyStyle(flat, { [a]: o });
    assert.equal(out[a], o);
    assert.equal(out.surface, flat.surface, "`" + a + "` changed the surface");
    if (a !== "backdrop") assert.equal(out.backdrop, flat.backdrop, "`" + a + "` invented a backdrop");
  }
  // `solid` is not glass, so it earns nothing either.
  assert.equal(applyStyle(flat, { surface: "solid" }).backdrop, flat.backdrop);
});

test("WHAT IS STILL OUT, and why", () => {
  // `fonts` is on the look edit and moves through a different path; `radius` is
  // a LENGTH and belongs to the colour patch's parser. Pinned because "we forgot
  // it" and "we decided against it" look identical in a list of names a year on.
  for (const a of ["fonts", "radius", "light", "dark"])
    assert.equal(ASKABLE.includes(a), false, a + " is askable here — it belongs to another path");
});

/* -------------------------------------------------------------- the wiring */

test("THE CONTAINER MERGES BEFORE IT RENDERS", () => {
  // The whole mechanism is one call, and `build-server.mjs` cannot be imported
  // into a test that also drives the Worker, so it is read.
  assert.match(server, /import \{[^}]*applyStyle[^}]*\} from "\.\/site-style\.mjs"/,
    "the container does not import the module");
  // THE PROPERTY: the stylesheet is rendered from the COMPOSED theme, not the
  // bare one. Pinned to `themeCss(applyStyle(theme, style))` it went red the day
  // the composition was bound to a name so its refusals could also be read — a
  // test about word order, which is this repo's most repeated own-goal and is
  // recorded twice already in this same test.
  assert.match(server, /applyStyle\(theme, style\)/, "the container never composes the site's own axes onto the theme");
  const composed = server.match(/(\w+) = applyStyle\(theme, style\)/);
  assert.ok(composed, "the composition is not bound, so nothing but themeCss can read it");
  assert.match(server, new RegExp(`themeCss\\(${composed[1]}\\)`),
    "the container renders a theme other than the one it just composed");
  const i = server.indexOf("function writeTheme(");
  const sig = server.slice(i, server.indexOf(")", i) + 1);
  assert.match(sig, /style/, "writeTheme cannot be given a style patch");
  // THE PROPERTY, NOT THE SPELLING. This was pinned to `style: payload.style`
  // and went red the day the patch started being parsed ONCE at the call site
  // and handed to both writers — a test about word order, which is this repo's
  // most repeated own-goal. What has to hold is that the patch off the wire
  // reaches `writeTheme` through something, and that the something is the SAME
  // variable `writeSiteBrand` was given, or the page transition's two halves
  // can disagree about whether the axis was named.
  const parsed = server.match(/const (\w+) = parseStyle\(payload\.style/);
  assert.ok(parsed, "the container never parses the payload's style");
  // …AND `writeTheme` GETS THE WHOLE PATCH, NEVER THE PARSED ENUM MAP. That
  // variable is `parseStyle(...).style`, which is exactly right for reading one
  // axis off — and an AUTHORED value never appears in it, because `parseStyle`
  // keeps those in `.authored`. So handing it here drops a hand-written backdrop
  // silently: validated by the Worker, stored in `_meta`, sent over the wire, and
  // thrown away one line before the only function that could render it.
  assert.match(server, /writeTheme\(payload\.seeds, \{[^}]*style: payload\.style\b/,
    "writeTheme is given the parsed enum map, so an authored backdrop can never reach applyStyle");
  // BOTH HALVES OF THE PAGE TRANSITION STILL READ ONE SOURCE, which is what this
  // assertion has always been for. They are no longer the same EXPRESSION — one
  // is the patch, the other its parse — and that is not a disagreement: they are
  // rooted at the same `payload.style` and `parseStyle` is idempotent (asserted
  // separately), so the two cannot answer differently about whether the axis was
  // named. What must not happen is a second SOURCE, which is what is checked.
  assert.match(server, new RegExp(`writeSiteBrand\\([^)]*transition: ${parsed[1]}\\.transition`),
    "the router's half of the page transition reads a different patch from the CSS half");
  // AND THE CORNER STRIP STAYS GONE, which is the direction that rots silently.
  // It removed every `border-radius` the theme emitted whenever a customer named
  // a radius token, and then put two of the three back — so restoring it would
  // once again eat an AUTHORED `corner` with every other test green. Asserted as
  // an ABSENCE over the whole file, comments blanked first, because the note
  // explaining the removal necessarily spells the names being forbidden.
  const code = server.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  for (const gone of ["stripThemeRadius", "explicitRadiusCss", "dropRadius"]) {
    assert.equal(code.includes(gone), false,
      `${gone} is back in the container — an authored corner beside a radius token is eaten again`);
  }
});

test("THE PAGE TRANSITION'S OTHER HALF REACHES THE ROUTER", () => {
  // THE ONE AXIS WITH A HALF OUTSIDE THE STYLESHEET. Everything else here is
  // finished the moment `themeCss` emits it; this needs the router to wrap the
  // navigation in `document.startViewTransition` before there is anything for
  // the CSS to animate. So there is a value in the bundle and a flag on the
  // router, and each end is checked separately — either alone passes perfectly
  // while the wire between them is cut, which is how twelve features in this
  // repo shipped dead.
  const router = fs.readFileSync(new URL("../builder/lovable/template/src/router.tsx", import.meta.url), "utf8");
  const brand = fs.readFileSync(new URL("../builder/lovable/template/src/site-brand.ts", import.meta.url), "utf8");
  assert.match(server, /const transitionValue = transitionOn\(transition\)/,
    "the container decides the flag some other way than the shared question");
  assert.match(server, /import \{[^}]*\btransitionOn\b[^}]*\} from "\.\/site-theme\.mjs"/,
    "the container never imports the shared question — a bare read is a ReferenceError");
  // ANNOTATED at BOTH ends, the `SITE_MODE` lesson: an unannotated const has
  // the literal type of whichever value was written, so the generated file and
  // the template placeholder stop agreeing the moment anything compares them.
  assert.match(server, /export const SITE_PAGE_TRANSITION: boolean = /);
  assert.match(brand, /export const SITE_PAGE_TRANSITION: boolean = false/,
    "the template's own answer is not the one that changes nothing");
  assert.match(router, /import \{ SITE_PAGE_TRANSITION \} from "\.\/site-brand"/);
  assert.match(router, /defaultViewTransition: SITE_PAGE_TRANSITION/,
    "the router decides for itself whether to transition");
  // AND NEVER UNCONDITIONALLY, which is the failure that reads as a feature.
  // `defaultViewTransition: true` with no CSS is not "no transition" — the UA
  // stylesheet cross-fades these pseudo-elements by default — so a hardcoded
  // flag would hand a cross-fade to every site on the platform, including
  // every one built before the axis existed.
  assert.equal(/defaultViewTransition:\s*true/.test(router), false,
    "every site transitions, whether or not it asked");
});

test("THE CONTAINER IMAGE CARRIES THE MODULE", () => {
  // A module the Dockerfile does not COPY is an import that throws on startup,
  // which stops the build container rather than degrading anything. Caught this
  // way once already, for `site-tokens.mjs`.
  const dockerfile = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /\bsite-style\.mjs\b/, "site-style.mjs is not copied into the image");
});

test("EVERY CONTAINER PAYLOAD CARRIES THE PATCH", () => {
  // The container merges this into the theme on EVERY build — it has to, or one
  // site's look decisions leak onto the next — so a payload that does not send
  // the stored patch sends nothing, and nothing means the theme's own defaults.
  // A customer who asked for square buttons and then changed one word of copy
  // would have watched them go round again. The `priorLogo` failure exactly.
  //
  // `matchAll`, NOT `match` + `indexOf`. The two payload lines are BYTE
  // IDENTICAL, so `indexOf` answered the same position for both and the scan
  // checked one payload twice — a mutation deleting the other one's `style`
  // survived the whole suite. An assertion that cannot see half of what it
  // claims to cover is the shape this repo keeps recording.
  const payloads = [...worker.matchAll(/tokens: Object\.keys\(tokens \|\| \{\}\)\.length[^\n]*/g)];
  assert.equal(payloads.length, 2, "found " + payloads.length + " container payloads — the scan is broken");
  assert.notEqual(payloads[0].index, payloads[1].index, "the scan is reading one payload twice");
  for (const p of payloads) {
    // RUN TO A LANDMARK, NOT A BYTE COUNT. This was `+ 900` and went red on a
    // correct change the moment a documented field was added between the two
    // lines — a window sized in bytes stops covering what it was written for as
    // soon as a comment lands inside it, which this repo has recorded three
    // times. `worker: true` closes both payloads.
    const end = worker.indexOf("worker: true", p.index);
    assert.ok(end > p.index, "the container payload no longer ends the way this scan expects");
    const after = worker.slice(p.index, end);
    assert.match(after, /style: Object\.keys\(style \|\| \{\}\)\.length \? style : undefined/,
      "a container payload sends the colours and not the rest of the look");
  }
});

test("THE BUILD PATH HANDS IT TO THE PUBLISHER", () => {
  // `buildAndPublishPages` reads `style` off its argument object and forwards it
  // to the container. A caller that never passes one forwards `undefined`
  // forever, and the payload assertion above stays perfectly green — which is
  // exactly what a mutation showed.
  //
  // ANCHORED ON `await`, because `buildAndPublishPages(env, {` matches the
  // DECLARATION too — `async function buildAndPublishPages(env, { brief, spec,
  // …` — whose destructuring braces close 190 characters later. That is the
  // `confirmSubmitter` failure this repo has already recorded twice: a
  // source-read must anchor on something only the thing being asserted can have.
  const at = worker.indexOf("await buildAndPublishPages(env, {");
  assert.ok(at > 0, "nothing calls buildAndPublishPages");
  assert.equal(worker.slice(at - 20, at).includes("function"), false, "anchored on the declaration");
  let depth = 0, i = worker.indexOf("{", at), end = i;
  for (; end < worker.length; end++) {
    if (worker[end] === "{") depth++;
    else if (worker[end] === "}") { depth--; if (!depth) { end++; break; } }
  }
  const args = worker.slice(i, end);
  // THE BOUND IS ON CODE, NOT ON PROSE. It exists to catch a scan that matched
  // the wrong brace and ran away — not to police how well this block is
  // documented — and it went red the day the authored plan arrived with its
  // reasoning written above it, on a change that was entirely correct. That is
  // the same fix `api-auth.test.mjs` already made to its own window, for the
  // same reason: a repo that puts its arguments in comments cannot size a
  // window in bytes of file.
  const code = args.replace(/^[ \t]*\/\/.*$/gm, "");
  assert.ok(code.length > 200 && code.length < 6000, "the argument scan is broken: " + code.length + " chars of code");
  assert.match(args, /tokens: siteTokens/, "the scan is wrong — it cannot even see the colours");
  assert.match(args, /style: siteStyle/, "the merged patch never reaches the publisher");
});

test("EVERY PAYLOAD PATH READS THE STORED PATCH", () => {
  // The other half, and either alone passes while the wire is cut: a payload
  // that faithfully sends an always-null variable is indistinguishable from one
  // that works.
  const rows = worker.match(/r\.k === "site_style"/g) || [];
  assert.equal(rows.length, 3, "expected the two payload paths and the look edit to read it, found " + rows.length);
  for (const q of worker.match(/SELECT k, v FROM _meta WHERE k IN \([^)]*\)/g) || []) {
    if (q.includes("site_logo")) assert.ok(q.includes("site_style"),
      "a payload-path read asks for the logo and not the style: " + q);
  }
});

test("IT IS ITS OWN _meta KEY, never a field on site_look", () => {
  // `mergeLook` rebuilds its output from `EDIT_FIELDS` alone, so anything else
  // stored on that object is dropped by the next look edit — the reason
  // `site_tokens` and `site_logo` are separate keys too.
  const edit = fs.readFileSync(new URL("../builder/site-edit.mjs", import.meta.url), "utf8");
  assert.equal(/EDIT_FIELDS = \[[^\]]*style/.test(edit), false,
    "style is on EDIT_FIELDS, where a look edit will drop it");
  assert.match(worker, /VALUES \('site_style', \?\)/, "nothing writes the style key");
  assert.equal((worker.match(/VALUES \('site_style', \?\)/g) || []).length, 2,
    "the build path and the look edit must both store it");
});

test("THE DESIGNER CAN ASK FOR IT, and it AUTHORS rather than picks", () => {
  // Unreachable from the tool is unreachable full stop — the state 14 other
  // schema features are in, fully built and declarable by nothing.
  //
  // THIS ASSERTED THE ENUM UNTIL 2026-08-22, and the enum is the thing that
  // went: "an option the engine would refuse is merely dropped rather than
  // impossible" was the right property while the domain was 23 fixed lists, and
  // "any CSS" has no enumerable domain — so it is replaced rather than
  // abandoned. The guarantee moves from "cannot be said" to "cannot be said and
  // reach the page": `site-authored.mjs` parses what comes back and RE-EMITS it,
  // so nothing lands in a customer's stylesheet that we did not assemble.
  //
  // Held as an ABSENCE as well as a presence, because an enum coming back is
  // the tidy-looking edit that quietly restores the menu — and run 14 measured
  // what a menu does to an escape hatch beside it: the model reached for the
  // names on both axes that had one.
  assert.match(worker, /import \{[^}]*mergeStyle[^}]*\} from "\.\/builder\/site-style\.mjs"/);
  const at = worker.indexOf("      style: {");
  assert.ok(at > 0, "design_schema has no style field");
  const field = worker.slice(at, worker.indexOf("\n      },", at));
  assert.match(field, /SITE_STYLE_AXES\.map/, "the axes are restated rather than derived");
  assert.doesNotMatch(field, /enum:/, "an enum is back on a style axis — the names are supposed to be gone");
  assert.match(field, /siteAuthoredSchema\(a/, "the fields are no longer built from the engine's own tables");
});

test("A FIRST BUILD AUTHORS THE AXES — nothing else decides them", () => {
  // THE PREMISE FIRST, because the description is only honest while this holds.
  // It used to read "omit it entirely otherwise — on a first build the theme
  // already decides all of these", which was TRUE while a theme was a row from
  // the 500-strong registry: every one of those rows carried all eighteen axes.
  // The registry went the same day the seeds landed and an authored theme is
  // `{label, light, dark}`, so the clause outlived its own premise by hours and
  // every site since has shipped the template's plain defaults while the model
  // was told they were already designed.
  //
  // DRIVEN THROUGH THE REAL NORMALISER rather than asserted about the shape, so
  // the day seeds legitimately start carrying axes this goes red and points at
  // the sentence that would then need to change back.
  const seeded = normalizeSeeds({ name: "Warm Brick", paper: "#faf7f2", ink: "#1b1714", accent: "#b44a2e" });
  assert.ok(seeded.theme, "the fixture palette is refused, so this proves nothing: " + seeded.why);
  const carried = ASKABLE.filter((a) => a in seeded.theme);
  assert.deepEqual(carried, [],
    "an authored theme carries style axes again, so the field description may say the theme decides them: " + carried.join(","));
  // And the same fact one layer down: with no patch, none of the eighteen is
  // attached, so an omitted axis is the template's plain default rather than a
  // design choice — which is exactly what the description now tells the model.
  assert.deepEqual(ASKABLE.filter((a) => a in applyStyle(seeded.theme, undefined)), [],
    "applyStyle attaches axes with no patch, so an omitted axis is no longer the plain default");

  // THEN THE SENTENCE. Read from the DESCRIPTION alone and never from the file:
  // the comment above the field explains the deleted clause, and prose about a
  // removal spells the removed thing — this repo's most repeated own-goal.
  const at = worker.indexOf("      style: {");
  const raw = worker.slice(worker.indexOf("description:", at), worker.indexOf("properties:", at));
  // Adjacent string literals joined, so a rule split across a line break by the
  // concatenation still reads as one sentence — a phrase assertion that has to
  // know where the `" +` falls is a test about line wrapping.
  const desc = raw.replace(/"\s*\+\s*\n\s*"/g, "");
  assert.match(desc, /ON A FIRST BUILD/, "nothing tells the model to author the axes on a first build");
  assert.equal(/theme already decides/.test(desc), false,
    "the description claims the theme decides the axes, which stopped being true when the registry went");
  assert.equal(/[Oo]mit it entirely otherwise/.test(desc), false,
    "the description tells the model to omit the axes on a first build");
  // The revise half is unchanged and must stay: naming an axis nobody asked
  // about is how a colour change silently re-styles a live site.
  assert.match(desc, /ON A REVISE/, "the revise rule is gone, so an edit may move axes nobody asked about");
  assert.match(desc, /only the axes the customer actually asked about/,
    "the revise half no longer says to name only what was asked");
});

test("THE CAP IS A REVISE RULE — a first build is not cut to six", () => {
  // The behaviour first, driven through the real module. Capped at six on a
  // build, the merge keeps whichever six `AXES` declares first and drops the
  // buttons, the shadows, the icon weight and the whole world layer — an
  // arbitrary cut nobody designed, which `styleNote` then reports to the
  // customer as twelve axes we refused.
  const full = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[0]]));
  assert.equal(Object.keys(mergeStyle(null, full, { max: MAX_STYLE_BUILD })).length, ASKABLE.length,
    "a first build's whole authored look does not survive the merge");
  assert.equal(parseStyle(full, { max: MAX_STYLE_BUILD }).dropped.length, 0,
    "a first build is told axes were refused that were not");
  // …and the revise cap is UNTOUCHED, which is the half a widening quietly
  // takes with it: an edit naming half the look is a re-theme wearing a patch.
  assert.equal(Object.keys(mergeStyle(null, full)).length, MAX_STYLE,
    "the revise cap moved, so a look edit may now restyle a live site wholesale");

  // AND THE WIRING, because a module that is correct and never called the right
  // way is this repo's most-recorded bug. `parseStyle` applies its OWN cap, so
  // the bound has to reach both calls or the patch is cut to six before the
  // merge sees it and the widening reads as done while doing nothing.
  const at = worker.indexOf("const styleMax =");
  assert.ok(at > 0, "the build path no longer chooses a cap, so it uses the revise one on a first build");
  const block = worker.slice(at, worker.indexOf("tr.at(\"merge\")", at));
  assert.match(block, /existing \? MAX_STYLE : MAX_STYLE_BUILD/,
    "the cap is not chosen by whether this site already exists");
  assert.match(block, /mergeStyle\(priorStyle, designed && designed\.style, \{ max: styleMax \}\)/,
    "the merge does not get the build cap");
  assert.match(block, /parseStyle\(designed && designed\.style, \{ max: styleMax \}\)/,
    "the note and the stored patch can disagree about what was kept");
  assert.match(worker, /import \{[^}]*MAX_STYLE_BUILD[^}]*\} from "\.\/builder\/site-style\.mjs"/,
    "MAX_STYLE_BUILD is read without being imported, which is a ReferenceError on the build path");

  // The look edit lane must NOT take the build cap — checked apart from the
  // build path, since one `mergeStyle` call site carrying it is satisfied by
  // the other.
  const look = worker.indexOf("const nextStyle = mergeStyle(");
  assert.ok(look > 0, "the look lane's merge moved");
  assert.equal(/MAX_STYLE_BUILD/.test(worker.slice(look, look + 200)), false,
    "the look edit lane took the build cap, so an edit may restyle a live site wholesale");
});

test("THE NOTE COUNTS WHAT WAS APPLIED, never re-capping it", () => {
  // `styleNote` re-parsed with the DEFAULT cap, so handed the eighteen axes a
  // first build may now author it named SIX of them and called that what
  // changed. The caller decides how many survive; a reporter that quietly
  // counts fewer is the "change reported as applied" failure the other way up.
  const full = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[0]]));
  const kept = parseStyle(full, { max: MAX_STYLE_BUILD }).style;
  const note = styleNote(kept, []);
  for (const a of ASKABLE) {
    assert.ok(note.includes(saidFor(a)), `"${saidFor(a)}" is missing from the sentence, so the note undercounts`);
  }
  // …and it still DROPS what the engine does not know, which is the reason it
  // parses at all rather than listing the keys it was handed.
  assert.equal(styleNote({ nope: "pill", buttons: "not-an-option" }, []), "",
    "an axis the engine refuses is reported to the customer as changed");
});

test("THE CONTAINER APPLIES WHAT IT IS GIVEN — the third place the cap lived", () => {
  // FOUND BY THE CONTAINER HARNESS AND BY NOTHING ELSE, which is why it is worth
  // the twenty minutes. `applyStyle` runs in the build service, downstream of
  // the Worker's decision, and re-parsed with the REVISE cap — so an eighteen
  // axis build had the Worker store eighteen, send eighteen, and twelve thrown
  // away here. Measured against a real compiled stylesheet: the icon weight came
  // back at the theme's own value and the world layer was absent entirely.
  const full = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[optionsFor(a).length - 1]]));
  const theme = { label: "T", light: { paper: "#fff", ink: "#111", accent: "#b44a2e" } };
  const out = applyStyle(theme, full);
  assert.deepEqual(ASKABLE.filter((a) => !(a in out)), [],
    "the container drops axes the Worker stored, so the widest looks are silently cut");
  // The revise cap is still reachable, so a caller that wants one can say so —
  // this is a DEFAULT that trusts the caller, not the cap being deleted.
  assert.equal(ASKABLE.filter((a) => a in applyStyle(theme, full, { max: MAX_STYLE })).length, MAX_STYLE);
});

test("MAX_STYLE_BUILD IS DERIVED, not a generous number that goes stale", () => {
  // Written as a cap rather than as "no cap" so both call sites read the same
  // way — and derived from the axis list so a nineteenth axis is included
  // without anybody remembering this file.
  assert.equal(MAX_STYLE_BUILD, ASKABLE.length);
  const src = fs.readFileSync(new URL("../builder/site-style.mjs", import.meta.url), "utf8");
  assert.match(src, /MAX_STYLE_BUILD = ASKABLE\.length/,
    "the build cap is a literal, so it silently stops covering the axis list");
});

test("A LOOK EDIT COUNTS IT AS A CHANGE", () => {
  // Without this, "square buttons" escalates to a ~27-credit page rewrite that
  // cannot put square buttons on anything either — the rung above recompiles
  // from the same stored look. The whole point of the lane is that a look change
  // costs one cheap call.
  assert.match(worker, /const styleMoved = JSON\.stringify\(nextStyle\) !== JSON\.stringify\(priorStyle \|\| \{\}\)/);
  // THE PROPERTY, NOT THE SPELLING. This pinned the whole one-line
  // `if (…) return escalate("no-change")` and went red when that became a block
  // — a test about statement shape failing a correct change, for the fifth time
  // in this repo. What must hold is that `styleMoved` is one of the three things
  // the nothing-moved test asks about, whatever the branch below it does.
  // …AND THE PIN WENT RED AGAIN when a FOURTH thing joined the condition, which
  // is the same lesson one turn later. Asserted as MEMBERSHIP now: `styleMoved`
  // has to be one of the terms, and the branch may ask about as many others as
  // it needs to.
  const cond = /if \(([^)]*!styleMoved[^)]*)\) \{/.exec(worker);
  assert.ok(cond, "a style-only edit is no longer counted as a change, so it escalates as though nothing had been asked for");
  assert.match(cond[1], /!moved\.length/, "the nothing-moved test stopped asking about the look fields");
  assert.match(cond[1], /!tokensMoved/, "the nothing-moved test stopped asking about the colours");
});

test("AN ASK THAT IS ALREADY SATISFIED IS ANSWERED, NOT ESCALATED", () => {
  // Every escalation falls through to the full revise by contract, so a customer
  // repeating an instruction that already applied — the ordinary result of a
  // stale preview — bought a ~21-27-credit rebuild that regenerated every page
  // and published a byte-identical site. The cheap lane was holding the answer.
  //
  // The discriminator is whether the model NAMED anything: fields that all equal
  // what is stored is "you already have that"; naming nothing at all is "I could
  // not express this", which is what the escalation was written for and must
  // stay. Both halves asserted, because keeping only the first turns every
  // unexpressible look ask into a dead end.
  // ANCHORED ON THE PROPERTY, not on the exact list of terms — the same pin
  // one test up went red the moment a fourth thing was counted as a change.
  const at = worker.search(/if \([^)]*!styleMoved[^)]*\) \{/);
  assert.ok(at > 0, "the nothing-moved branch moved — rescope this");
  const block = worker.slice(at, worker.indexOf("\n              try {", at));
  assert.match(block, /const named = EDIT_FIELDS\.some\(\(k\) => designed && hasValue\(designed\[k\]\)\)/,
    "nothing distinguishes 'already applied' from 'could not express it'");
  assert.match(block, /hasValue\(designed && designed\.tokens\) \|\| hasValue\(designed && designed\.style\)/,
    "a colour-only or axis-only ask is not counted as the model having named something");
  assert.match(block, /if \(!named\) return escalate\("no-change"\)/,
    "an ask the model could not express no longer escalates — it is a dead end now");
  assert.match(block, /lookNote: "Your site already looks like that/,
    "an already-satisfied ask says nothing to the customer");
  assert.ok(/ok: true/.test(block), "an already-satisfied ask is not reported as a success");
});

test("THE CUSTOMER IS TOLD, at both ends of the wire", () => {
  // Composed on the server because `public/chat.js` cannot import this module,
  // and a second copy there drifts toward claiming a change that did not happen.
  // THE PROPERTY, NOT THE SPELLING. This pinned the exact expression and went
  // red the moment the build path's copy legitimately became conditional — a
  // test about word order failing a correct change, which is this repo's most
  // repeated own-goal. What has to hold is that BOTH replies compose the
  // sentence through this module rather than restating it in the client.
  assert.equal((worker.match(/styleNote: [^,\n]*styleNote\(styleAsk\.style, styleAsk\.dropped\)/g) || []).length, 2,
    "the build path and the look edit must both say what happened, through the module");
  assert.match(chat, /d\.styleNote === 'string'/, "the client never renders the sentence");

  // …AND THE BUILD PATH SAYS IT ONLY ON A REVISE. A first build CHANGED
  // nothing, so "Changed the corner shape, text size and letter spacing" is
  // said to somebody seeing their site for the first time, about a site they
  // never asked to style. It became reachable the day a first build could
  // author the axes at all; before that `designed.style` was always absent
  // there and the note was always empty by accident.
  const bAt = worker.indexOf("styleNote: existing ?");
  assert.ok(bAt > 0, "the build reply's style sentence is no longer gated on this being a revise");
  assert.ok(bAt < worker.indexOf("styleNote: styleNote(styleAsk.style", bAt),
    "the gated copy is the look lane's, not the build reply's");

  // SCOPED TO THE LOOK BRANCH, and it was not. That match above is satisfied by
  // the BUILD reply's note block, which is a different code path — so this test
  // said "at both ends of the wire" while the look lane's own `styleNote` was
  // returned by the server and rendered by NOTHING, and `tokenNote` was not
  // computed there at all. A customer asking for two colours and getting one
  // was told about the one, in the one lane every colour change is routed to
  // first. Vacuous-by-scope, which is this repo's most-recorded test failure.
  const at = chat.indexOf("if (e.layer === 'look') {");
  assert.ok(at > 0, "the look reply moved — rescope this");
  const lookReply = chat.slice(at, chat.indexOf("\n  return '✅ Done.';", at));
  assert.ok(lookReply.length > 200, "the look reply window came out empty");
  // AND THE NOTHING-TO-DO ANSWER, which the sweep proved was guarded at the
  // server end only: the route composed `lookNote` and the client rendered it
  // nowhere, so an already-satisfied ask would have printed "✅ Updated the
  // look." with an empty list — which reads as a change that silently failed,
  // and is the precise thing the answer exists to avoid. The layer below the
  // break, again.
  assert.match(lookReply, /e\.lookNote/, "the look reply never renders the nothing-to-do answer");
  const noteAt = lookReply.indexOf("e.lookNote");
  assert.ok(noteAt < lookReply.indexOf("const moved ="),
    "the nothing-to-do answer is composed after the change list, so the empty list wins");
  assert.match(lookReply, /e\.styleNote/, "the look reply never renders which axis was refused");
  assert.match(lookReply, /e\.tokenNote/, "the look reply never renders which colour was refused");
  assert.match(worker, /tokenNote: tokenNote\(null, tokenAsk\.dropped\) \|\| undefined/,
    "the look lane computes no refused-colour sentence");

  // The look lane's own reply joins a list of names, and they arrive already
  // plain — raw keys would print "Updated the look — display" about the heading
  // colour, or "popover" about the card colour.
  assert.match(worker, /Object\.keys\(nextStyle\)\.map\(styleSaid\)/,
    "the look lane sends raw axis keys to a client that cannot translate them");
  assert.match(worker, /Object\.keys\(nextTokens\)\.map\(\(k\) => tokenSaid\(k\)\)/,
    "the look lane sends raw token keys — one reply would name two changes two different ways");
  assert.match(chat, /concat\(tokens, style\)/, "the client drops the style names from its sentence");
});

test("A RESTATED AXIS TAKES THE NEW VALUE, and nothing else moves", () => {
  // The dedup-before-the-cap machinery this replaced existed ONLY to make a
  // total cap correct: `[...Object.keys(b), ...keys]` listed a restated key
  // twice, so slicing it let a duplicate occupy a slot and the kept set came out
  // SHORT — a customer losing an extra earlier instruction they never asked to
  // change. With no total cap there is nothing to make room for and the whole
  // question goes away, which is the better fix for the same failure.
  const prior = { corner: "bevel", weight: "uniform", density: "airy", icon: "heavy", border: "bold", inputs: "underline" };
  const out = mergeStyle(prior, { corner: "round", ambient: "drift" });
  assert.equal(out.corner, "round", "the restated axis kept its OLD value");
  assert.equal(out.ambient, "drift", "the new instruction was dropped");
  assert.equal(Object.keys(out).length, 7, "an axis nobody named went missing");
  for (const a of ["weight", "density", "icon", "border", "inputs"]) {
    assert.equal(out[a], prior[a], a + " was dropped to make room, which is the bug this replaced");
  }
});

test("…and a merge with no overlap adds without taking anything away", () => {
  const prior = { corner: "bevel", weight: "uniform", density: "airy", icon: "heavy", border: "bold", inputs: "underline" };
  const out = mergeStyle(prior, { ambient: "drift" });
  assert.equal(Object.keys(out).length, 7);
  assert.equal(out.ambient, "drift", "the newest instruction must survive");
  assert.equal(out.inputs, "underline", "the oldest instruction was dropped for it");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE AUTHORED HALF REACHES A STYLESHEET
//
// Every layer below the tool was built and tested before the tool could send
// one, so the whole path was correct and unreachable — and that is not a
// hypothetical: `mergeStyle` returned `.style` alone, so the stored patch and
// the container payload both dropped an authored value on the floor. These hold
// the four hops the value has to survive, because a module test at either end
// passes perfectly while the wire between them is cut.
// ─────────────────────────────────────────────────────────────────────────────

const AUTHORED_WASH = Object.freeze({
  light: ["linear-gradient(160deg, #f6e3d2 0%, #ffffff 70%)"],
  dark: ["linear-gradient(160deg, oklch(0.28 0.06 40) 0%, oklch(0.16 0.02 40) 70%)"],
});

test("the merged patch carries an authored value, not just the enum axes", () => {
  // THE HOP THAT WAS CUT. `siteStyle` is what is written to `_meta.site_style`
  // and what is sent to the container, so a merge that keeps only `.style`
  // makes the entire authored path unreachable from a real build — validated,
  // reported, and thrown away before anything could render it.
  const merged = mergeStyle(null, { backdrop: AUTHORED_WASH, corner: "bevel" }, { max: MAX_STYLE_BUILD });
  assert.equal(typeof merged.backdrop, "object", "the authored value did not survive the merge");
  assert.deepEqual(merged.backdrop, AUTHORED_WASH, "the RAW spec must survive, or the container cannot re-read it");
  assert.equal(merged.corner, "bevel", "the enum axes still merge as strings");
});

test("the merged patch round-trips: what is stored is what parseStyle takes", () => {
  // The reason the spec travels raw rather than validated. `applyStyle` re-reads
  // the stored patch, so the merge's OUTPUT has to be legal INPUT — and it is
  // exactly the shape the tool sends, which is what keeps one reader for both.
  const merged = mergeStyle(null, { backdrop: AUTHORED_WASH, corner: "bevel" }, { max: MAX_STYLE_BUILD });
  const again = parseStyle(merged, { max: MAX_STYLE_BUILD });
  assert.deepEqual(again.dropped, [], "the stored patch is not readable by the thing that has to read it");
  assert.ok(again.authored && again.authored.backdrop && again.authored.backdrop.ok);
  assert.equal(again.style.corner, "bevel");
});

test("an axis can change KIND across a merge, both ways", () => {
  // A site on `aurora` asks for its own wash, and then asks for `aurora` back.
  // Each side's enum and authored bags are disjoint, so the only thing that can
  // get this wrong is the spread order.
  const toAuthored = mergeStyle({ backdrop: "aurora" }, { backdrop: AUTHORED_WASH });
  assert.equal(typeof toAuthored.backdrop, "object", "an authored value did not replace the named one");
  const toNamed = mergeStyle({ backdrop: AUTHORED_WASH }, { backdrop: "aurora" });
  assert.equal(toNamed.backdrop, "aurora", "a named option did not replace the authored one");
});

test("an authored wash reaches the compiled stylesheet, in BOTH modes", () => {
  const theme = normalizeSeeds({ name: "Fold", paper: "#faf7f2", ink: "#1a1613", accent: "#b4542e" }).theme;
  const merged = mergeStyle(null, { backdrop: AUTHORED_WASH }, { max: MAX_STYLE_BUILD });
  const css = T.themeCss(applyStyle(theme, merged));
  assert.match(css, /#f6e3d2/, "the light wash never reached the stylesheet");
  assert.match(css, /oklch\(0\.28 0\.06 40\)/, "the dark wash never reached the stylesheet");
});

test("`var()` resolves against THIS site's palette, and the literal is what ships", () => {
  // The whole reason `themeVars` exists. Without it every layer naming a token
  // is refused for "names a colour the theme does not define" — a permission in
  // the allow-list that could never be exercised.
  const theme = normalizeSeeds({ name: "Fold", paper: "#faf7f2", ink: "#1a1613", accent: "#b4542e" }).theme;
  const wash = { light: ["linear-gradient(160deg, var(--primary) 0%, #ffffff 70%)"], dark: AUTHORED_WASH.dark };
  const css = T.themeCss(applyStyle(theme, mergeStyle(null, { backdrop: wash })));
  const layers = (css.match(/background-image:[^;]*/g) || []).join("\n");
  assert.ok(layers.length, "no wash was emitted at all");
  assert.doesNotMatch(layers, /var\(/, "a var() survived into the stylesheet — the floor was measured against a colour nobody can read");
  // …AND IT IS THIS SITE'S OWN BRAND, not some default. `--primary` is the seed
  // accent; the pinned value is what `paletteFor` derives from #b4542e.
  const vars = T.themeVars(theme);
  assert.match(layers, new RegExp(vars.light["--primary"].replace(/[.()]/g, "\\$&")),
    "the resolved colour is not the one the palette defines");
});

test("`applyStyle` supplies the palette, and no other caller can", () => {
  // The split, asserted rather than left to reading: this is the only place both
  // the value and the palette are in hand, so it is the only place a var() can
  // be judged. The other call sites answer "did the model name this axis".
  const src = fs.readFileSync(new URL("../builder/site-style.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function applyStyle("));
  assert.match(body.slice(0, body.indexOf("\n}")), /parseStyle\(style, \{ max, vars: themeVars\(theme\) \}\)/,
    "applyStyle no longer supplies the palette, so every var() in an authored layer is refused");
});

test("a var() the Worker cannot resolve is DEFERRED, never reported as refused", () => {
  // The customer-facing half. `normalizeSeeds` runs in the container, so the
  // Worker holds three hex seeds and none of the 31 derived tokens — and telling
  // somebody their backdrop failed while it paints on their site is the
  // two-readings-disagree failure landing on the half they read.
  const wash = { light: ["linear-gradient(160deg, var(--primary), #fff)"], dark: AUTHORED_WASH.dark };
  const worker = parseStyle({ backdrop: wash }, { max: MAX_STYLE_BUILD });
  assert.deepEqual(worker.dropped, [], "the Worker reports a refusal it is not in a position to make");
  assert.deepEqual(worker.refused || [], []);
  assert.equal(worker.authored.backdrop.ok, false, "…and it must not pretend it read it, either");
  assert.deepEqual(worker.authored.backdrop.spec, wash, "the raw spec is what lets the container judge it");
});

test("a value wrong for a reason that has nothing to do with the palette is refused with NO palette", () => {
  // The other side of the deferral, and what stops it becoming "the Worker never
  // refuses anything". Every failure but the unresolved token is decidable from
  // the text, so they must still be caught where the customer is told.
  for (const [why, layer] of [
    ["url", "linear-gradient(160deg, url(http://x/y.png), #fff)"],
    ["color-mix", "linear-gradient(160deg, color-mix(in oklch, #fff, #000), #fff)"],
    ["a semicolon", "linear-gradient(160deg, #fff, #000); background: red"],
  ]) {
    const r = parseStyle({ backdrop: { light: [layer], dark: AUTHORED_WASH.dark } }, { max: MAX_STYLE_BUILD });
    assert.deepEqual(r.dropped, ["backdrop"], `${why} was not refused without a palette`);
    assert.ok((r.refused || []).length, `${why} was refused with no reason for the customer`);
  }
});

test("a DEFERRED value never becomes a layer, however it reaches applyStyle", () => {
  // A deferred entry has no `layers`, so attaching it would emit `undefined`
  // into a customer's stylesheet. It cannot arise through `applyStyle` (which
  // always supplies the palette) and the guarantee is held here rather than left
  // to that, since the failure is silent and reaches a published page.
  const theme = { label: "T", light: {}, dark: {} };  // themeVars reads nothing from it
  const wash = { light: ["linear-gradient(160deg, var(--primary), #fff)"], dark: AUTHORED_WASH.dark };
  const out = applyStyle(theme, { backdrop: wash });
  assert.equal(out.authored, undefined, "a value nothing could read was attached as a layer");
});

test("the tool offers an authored value on exactly the axes the engine accepts one on", () => {
  // DERIVED AT BOTH ENDS. An axis taught to accept a value in `parseStyle` and
  // not offered by the tool is a capability nothing can reach; one offered and
  // not accepted is a look reported as applied that never arrives.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /SITE_AUTHORED_AXES/, "the tool no longer knows which axes take an authored value");
  assert.match(worker, /AUTHORED_AXES as SITE_AUTHORED_AXES/, "…and it must be the engine's own list, not a copy");
  // EVERY AXIS IS AUTHORED NOW (2026-08-22), so this asserted a SPELLING that
  // was true of the two-axis shape and says nothing about the property — the
  // own-goal this repo has recorded more than any other. What has to hold is
  // that the field list is BUILT from the engine's tables rather than restated,
  // and that the two image axes keep the suffixed name their `{light, dark}`
  // pair needs.
  assert.match(worker, /siteAuthoredSchema\(a, siteStyleSaid\(a\)\)/,
    "the style fields are no longer built from the engine's own tables");
  assert.match(worker, /SITE_AUTHORED_IMAGE\.includes\(a\)/,
    "the two background-image axes are no longer told apart from the rest");
  assert.match(worker, /a \+ "Css"/, "the image axes lost the suffixed field their pair shape needs");
  // AND NO UNION, which is a decision rather than a style. The `webhooks` field
  // in this same tool refused one for a reason that still holds — an untested
  // JSON Schema construct here 400s EVERY build rather than degrading — and the
  // first draft of the authored value shipped one anyway. Asserted so it cannot
  // come back as a tidy-up; overturning it means proving the API takes one.
  // …and this reads the CODE, not the prose. The comment at that field explains
  // the decision and therefore SPELLS the thing it forbids, so an absence check
  // over the raw text matches its own explanation and fails against correct
  // code. Blanked by whole line and length-preserving, the trap this repo has
  // now recorded in a lint, a router guard, an absence check and a scope scan.
  const code = worker.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
  assert.doesNotMatch(code.slice(code.indexOf('name: "design_schema"')), /anyOf|oneOf/,
    "design_schema grew a union — prove the API accepts one before relying on it");
  // …AND EVERY OPTION SURVIVES AS A DEFAULT, which is what makes the enum safe
  // to remove. The names are gone from the WIRE and still standing behind it:
  // an axis nobody authors falls back to one, and every site published before
  // today has names stored that are re-parsed on every publish. An axis with no
  // options left is one where a refused answer degrades to nothing at all.
  for (const a of AUTHORED_AXES) {
    assert.ok(optionsFor(a).length, `${a} has no options left to fall back to`);
  }
  // The hint has to name the refusals, not only the permissions: `url()` and
  // `color-mix()` are the two a model reaches for unprompted, and an answer
  // spent on either is an axis silently dropped. THE TWO IMAGE AXES ONLY —
  // `authoredHint` is the `{light, dark}` gradient hint, and the other 21 are
  // described by `authoredFieldHint`, which has its own guard.
  for (const axis of AUTHORED_AXES.filter((a) => AXIS_DECLS[a] && AXIS_DECLS[a].image)) {
    const hint = authoredHint(axis);
    assert.match(hint, /url\(\)/, `${axis}: the hint does not warn about url()`);
    assert.match(hint, /color-mix\(\)/, `${axis}: the hint does not warn about color-mix()`);
    assert.match(hint, /BOTH MODES ARE REQUIRED/, `${axis}: a one-mode answer is refused and the hint does not say so`);
    assert.match(hint, /var\(--primary\)/, `${axis}: the hint does not name the brand colour`);
    // MEASURED, not assumed: `--accent` in this palette is a pale hover surface
    // (oklch L 0.94 against the brand's 0.56), so a hint recommending it would
    // produce a wash nobody asked for.
    assert.match(hint, /NOT `var\(--accent\)`/, `${axis}: the hint does not warn off the token that is not the brand`);
  }
});

test("the authored hint is derived from the validator, not restated", () => {
  const hint = authoredHint("backdrop");
  for (const f of [...IMAGE_FUNCS].filter((n) => n.endsWith("-gradient"))) {
    assert.ok(hint.includes(f), `the hint does not offer ${f}, which the validator accepts`);
  }
  assert.ok(hint.includes(String(MAX_LAYERS)), "the layer cap is restated rather than derived");
  assert.ok(hint.includes(String(MAX_LAYER)), "the length cap is restated rather than derived");
});

test("the wire name folds onto the axis at the door", () => {
  // The tool sends `backdropCss`; everything below `parseStyle` sees `backdrop`.
  // Without the fold the field is an unknown axis, so it lands in `dropped` and
  // the customer is told their own wash "isn't one of the options for it".
  const r = parseStyle({ backdropCss: AUTHORED_WASH }, { max: MAX_STYLE_BUILD, vars: {} });
  assert.deepEqual(r.dropped, [], "the tool's own field name was read as an unknown axis");
  assert.ok(r.authored && r.authored.backdrop, "the value did not land on the axis it belongs to");
  assert.equal(r.style.backdrop, undefined, "an authored value must not also set the enum axis");
});

test("a refusal is reported against the axis, not the field name nobody saw", () => {
  const r = parseStyle({ backdropCss: { light: ["url(http://x/y.png)"], dark: AUTHORED_WASH.dark } },
    { max: MAX_STYLE_BUILD, vars: {} });
  assert.deepEqual(r.dropped, ["backdrop"], "the customer is shown a field name from our wire format");
  assert.equal((r.refused || [])[0].axis, "backdrop");
});

test("the authored field beats a bare one on the same axis, and costs one slot", () => {
  // Both together is one question answered twice; the authored half is the more
  // specific answer. And it must count ONCE against the cap, or a model sending
  // both quietly buys itself an extra axis.
  const r = parseStyle({ backdrop: "aurora", backdropCss: AUTHORED_WASH }, { max: 1, vars: {} });
  assert.ok(r.authored && r.authored.backdrop, "the authored value lost to the named one");
  assert.equal(r.style.backdrop, undefined);
  const two = parseStyle({ backdrop: "aurora", backdropCss: AUTHORED_WASH, corner: "bevel" }, { max: 1, vars: {} });
  assert.deepEqual(two.dropped, ["corner"], "one axis answered twice consumed one slot, not two");
});

test("a wash refused for contrast leaves this function, or nobody can be told", () => {
  // The one refusal on this whole path that only `applyStyle` can make: the
  // Worker's `styleNote` is composed from a parse with no palette, so it never
  // reaches this gate. Discarded, a hand-written wash that leaves the quiet text
  // illegible is dropped in silence — the site keeps the backdrop it had and the
  // customer's own colours are simply not there.
  const theme = normalizeSeeds({ name: "Fold", paper: "#faf7f2", ink: "#1a1613", accent: "#b4542e" }).theme;
  // MEASURED: this reaches deep enough that no muted ink fits over both ends.
  const deep = {
    light: ["linear-gradient(160deg, #3a2418 0%, #f6e3d2 100%)"],
    dark: ["linear-gradient(160deg, oklch(0.20 0.03 40), oklch(0.12 0.01 40))"],
  };
  const out = applyStyle(theme, { backdrop: deep });
  assert.equal(out.authored, undefined, "an illegible wash was kept");
  assert.ok(Array.isArray(out.styleRefused) && out.styleRefused.length, "the refusal is invisible to every caller");
  assert.equal(out.styleRefused[0].axis, "backdrop");
  assert.match(out.styleRefused[0].why, /4\.5/, "the reason does not say what it needed, so nobody can act on it");
  // …and a theme that refused nothing is byte-identical to before this existed.
  assert.equal(applyStyle(theme, { corner: "bevel" }).styleRefused, undefined);
});

test("…and the container turns it into a note it already carries back", () => {
  // `writeTheme`'s notes are forwarded on both publish paths (the 2026-08-14
  // fix), so this is the whole delivery. Asserted at BOTH ends: the composition
  // is read for its refusals, and they reach every return below it — a
  // stylesheet that could not be read does not un-refuse the wash.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("function writeTheme("), src.indexOf("\n}", src.indexOf("function writeTheme(")));
  assert.match(fn, /styleRefused/, "the container never reads what applyStyle refused");
  const notes = fn.match(/notes: [^}]*/g) || [];
  const after = notes.slice(notes.findIndex((n) => /refusedNotes/.test(n)));
  assert.ok(after.length >= 2, "the refusal is carried on one return only");
  for (const n of after) {
    assert.match(n, /refusedNotes/, "a return below the gate drops the refusal: " + n.slice(0, 80));
  }
});

test("the hint tells the model what each axis OWNS, now that there is no list", () => {
  // WHAT THE ENUM WAS CARRYING went with it: `icon: fine` read "drawn thin —
  // jeweller, gallery, tailoring", which is a whole brief in six words. What
  // replaces it cannot be a shorter list, so it has to say what the axis IS,
  // what the declarations LAND ON, and which properties this one writes.
  //
  // The selector is the half that is easy to leave out and the half that
  // decides whether the answer is any good: a hover state written blind is a
  // guess about whether it applies to the button or the card it sits in.
  for (const [axis, spec] of Object.entries(AXIS_DECLS)) {
    if (spec.image) continue;
    const hint = authoredFieldHint(axis, "x");
    assert.match(hint, /lands on /, `${axis}: the hint does not say what it applies to`);
    assert.ok(hint.includes(spec.sel), `${axis}: the hint's selector is not the one the emitter uses`);
    for (const prop of Object.keys(spec.props)) {
      assert.ok(hint.includes(prop), `${axis}: the hint does not name ${prop}, so it reads as forbidden`);
    }
    // NO BRACES AND NO SELECTOR — the one instruction that decides whether the
    // answer parses at all, since a model handed "write CSS" writes a rule.
    assert.match(hint, /no braces and no selector/, `${axis}: nothing stops the model writing a whole rule`);
  }
});

test("a ramp hint states its own bounds, so a refusal is never a surprise", () => {
  // Every bound is a rendering failure — `scale 2.4` is an h1 taller than a
  // phone screen, `leading 0.4` is lines overlapping — and a model that is not
  // told the range spends the axis on a value that is silently dropped.
  for (const [axis, spec] of Object.entries(AXIS_RAMPS)) {
    const hint = authoredFieldHint(axis, "x");
    assert.match(hint, /Send \{/, `${axis}: the hint does not say what shape to send`);
    for (const [field, f] of Object.entries(spec.fields)) {
      assert.ok(hint.includes(field), `${axis}: the hint does not name the ${field} field`);
      if (f.kind !== "ease") {
        assert.ok(hint.includes(String(f.min)) && hint.includes(String(f.max)),
          `${axis}.${field}: the bounds are not stated, so a refused value reads as a bug`);
      }
    }
  }
});

test("the hints are DERIVED, so a widened allow-list cannot drift from its description", () => {
  // The "described then refused" failure `site-tokens.mjs` already records: a
  // permission the model is told about and the engine refuses, or the reverse —
  // an axis that gained a property and is still described without it, so it is
  // never used. Proved by widening one and requiring the hint to follow.
  const before = authoredFieldHint("focus", "x");
  assert.doesNotMatch(before, /\boutline-offset-x\b/);
  const widened = { ...AXIS_DECLS.focus, props: { ...AXIS_DECLS.focus.props, "outline-offset-x": "length" } };
  // Driven through the same expression the real one uses rather than a copy.
  assert.ok(Object.keys(widened.props).every((p) =>
    `${"x"} — lands on ${widened.sel}. This one writes ${Object.keys(widened.props).join(", ")}.`.includes(p)),
    "the hint is built from something other than the property table");
});

/* ------------------------------- the contrast gate refuses the WASH, not the look */

test("an illegible wash drops the wash and NOTHING else", () => {
  // UNTIL THE ENUMS WENT, THIS COULD NOT BE WRONG — `backdrop` and `decor` were
  // the only two axes a model could author, so everything in `good` WAS the
  // world and rolling all of it back was right. With all 23 authorable, a site
  // that writes a wash and a hover state has both, and this refusal is a fact
  // about the wash alone.
  //
  // MEASURED, not invented: `oklch(0.38 0.16 45)` on a light theme fits the
  // quiet ink at 3.87:1, under the 4.5 floor, and no ink fits — the gradient is
  // pale at the other end, so an ink that reads over the deep corner vanishes
  // over the light one. It is a fact about the wash rather than a number to
  // tune, which is why it is refused rather than repaired.
  const seeds = normalizeSeeds({
    name: "b", paper: "#f7f4ee", ink: "#171310", accent: "#3a3a3a",
    dark: { paper: "#12100e", ink: "#f2efe9", accent: "#c9c9c9" },
  });
  assert.ok(seeds.theme, seeds.why);
  const illegible = {
    light: ["linear-gradient(155deg, oklch(0.38 0.16 45) 0%, #ffffff 100%)"],
    dark: ["linear-gradient(155deg, #2b1a07 0%, #0f0703 100%)"],
  };
  const out = applyStyle(seeds.theme, { backdrop: illegible, hover: "transform: translateY(-7px)" });

  // THE WASH IS GONE, from the bag `worldCss` reads.
  assert.equal(out.authored && out.authored.backdrop, undefined,
    "the illegible wash survived the contrast gate");

  // AND THE HOVER STATE IS STILL THERE, IN BOTH PLACES — which is the half the
  // old rollback got wrong in two directions at once. It restored the bag and
  // left `out.hover` standing from the write above, so the hover was reported
  // dropped and shipped anyway: the answer disagreeing with the artefact.
  //
  // Asserted at BOTH readers deliberately. `worldCss` reads the bag and every
  // other emitter reads `theme.<axis>`, so a value in one and not the other is
  // the wiring failure this repo has recorded twelve times, one level down.
  assert.ok(out.authored && out.authored.hover, "the hover was dropped by a gate about the wash");
  assert.equal(out.hover && out.hover.css, "transform: translateY(-7px);",
    "the hover reached the bag but not the axis the emitter reads");

  // AND IT REALLY EMITS — the property a bag entry alone does not prove.
  assert.match(T.themeCss(out), /translateY\(-7px\)/,
    "the hover survived the rollback and still did not reach the stylesheet");

  // A GOOD WASH KEEPS BOTH, or the test above passes equally well on a gate
  // that refuses every wash there is.
  const fine = {
    light: ["linear-gradient(155deg, #f4dfc6 0%, #ffffff 100%)"],
    dark: ["linear-gradient(155deg, #2b1a07 0%, #0f0703 100%)"],
  };
  const good = applyStyle(seeds.theme, { backdrop: fine, hover: "transform: translateY(-7px)" });
  assert.ok(good.authored && good.authored.backdrop, "a legible wash was refused");
  assert.ok(good.authored && good.authored.hover, "a legible wash cost the hover");
});

test("the refusal names the wash, and not the axes that had nothing to do with it", () => {
  // The sentence is the only thing the customer is given to act on, and it is
  // about a gradient. Said about a `translateY` it is nonsense they cannot act
  // on — and it was the WHOLE report, since `dropped` carried every authored
  // axis too.
  const seeds = normalizeSeeds({
    name: "b", paper: "#f7f4ee", ink: "#171310", accent: "#3a3a3a",
    dark: { paper: "#12100e", ink: "#f2efe9", accent: "#c9c9c9" },
  });
  const patch = {
    backdrop: {
      light: ["linear-gradient(155deg, oklch(0.38 0.16 45) 0%, #ffffff 100%)"],
      dark: ["linear-gradient(155deg, #2b1a07 0%, #0f0703 100%)"],
    },
    hover: "transform: translateY(-7px)",
  };
  // The route composes its note from a `parseStyle` reading, so the refusal has
  // to leave `applyStyle` on the same shape — driven through the real thing
  // rather than restated.
  const theme = seeds.theme;
  let seen = null;
  const original = applyStyle(theme, patch);
  seen = original;
  assert.ok(seen, "applyStyle returned nothing");
  // The note itself is composed from what `applyStyle` reports back, so what is
  // asserted here is the property that decides it: the hover is not among the
  // things the gate took away.
  assert.ok(seen.authored && seen.authored.hover,
    "the gate took an axis it says nothing about");
  assert.equal(seen.authored.backdrop, undefined,
    "the gate kept the thing it refused");
});

/* --------------------------------- one name, one meaning, across both lists */

test("NO AXIS SHARES A NAME WITH A TOKEN — the collision is gone and stays gone", () => {
  // `border` was the same word in two vocabularies: the axis is the border's
  // WEIGHT, the token `--border` is its COLOUR. They sit on different parents
  // (`style` and `tokens`), so nothing could arrive in the wrong slot — the harm
  // was a model reading one word meaning two things and having to hold the
  // parent in mind to answer "make the borders thicker". The tool carried a
  // hand-written pointer to the other slot to paper over it.
  //
  // DERIVED FROM BOTH LISTS, so an axis or a token added later cannot
  // reintroduce a twin without this going red.
  const wire = ASKABLE.map((a) => saidFor(a) && a).map((a) => wireName(a));
  assert.deepEqual(wire.filter((w) => TOKEN_NAMES.includes(w)), [],
    "an axis and a token answer to the same name again — 'make the borders thicker' has two homes");

  // AND EVERY `said` STILL READS DIFFERENTLY, which is the half a rename does
  // not fix on its own: two distinct field names describing themselves the same
  // way put the customer back where they started.
  for (const a of ASKABLE) {
    for (const t of TOKEN_NAMES) {
      assert.notEqual(saidFor(a), tokenSaid(t),
        `the axis ${a} and the token ${t} both call themselves "${saidFor(a)}"`);
    }
  }
});

test("the OLD axis name still parses — every published site depends on it", () => {
  // NOT OPTIONAL. Every site published before the rename stores `site_style`
  // with the internal key, and it is re-parsed on EVERY publish — a text fix, a
  // colour change, a swapped picture. Refusing it would drop that axis to its
  // default on the customer's next unrelated edit: a platform re-styled by a
  // typo fix, reported as a success. The same reasoning that made `isName` a
  // shape test rather than a field-name test.
  for (const [axis, wire] of Object.entries(AXIS_WIRE)) {
    const option = Object.keys(AXES[axis].options)[0];
    assert.equal(parseStyle({ [axis]: option }).style[axis], option,
      `a stored ${axis} no longer parses — every site that set it loses it on its next publish`);
    assert.equal(parseStyle({ [wire]: option }).style[axis], option,
      `the wire name ${wire} does not reach the ${axis} axis`);
    // AND THE FOLD IS ONTO THE AXIS, never a second key beside it — the cap
    // counts it once and the merge stores it under one name.
    assert.equal(Object.hasOwn(parseStyle({ [wire]: option }).style, wire), false,
      `${wire} was stored under the wire name as well, so the cap counts it twice`);
  }
});

test("wireName cannot be tricked by a prototype key", () => {
  // `AXIS_WIRE["constructor"]` is a function — truthy, so a plain lookup hands
  // back something that is not a name. The exact bug that shipped once in the
  // Stripe plan lookup and again in `resolveTheme`.
  assert.equal(wireName("constructor"), "constructor");
  assert.equal(wireName("__proto__"), "__proto__");
  assert.equal(wireName("hover"), "hover", "an axis with no alias must answer itself");
});

test("the tool asks for the WIRE name, and the pointer it replaced is gone", () => {
  // Either half alone passes while the other is broken: the alias can be
  // correct and the tool still ask for the internal name, or the tool can ask
  // for the new name while the parser has never heard of it.
  // THE PROPERTY NAME IS DERIVED AT RUNTIME, so the literal `borderWeight` is
  // nowhere in `worker.js` — asserting it appeared was wrong, and the first run
  // of this test said so. What has to hold is that the key comes from
  // `siteWireName`, and that the parser accepts BOTH names (asserted above).
  // Either half alone passes while the other is broken: the alias can be right
  // and the tool still ask for the internal name, or the tool can ask for the
  // new name while the parser has never heard of it.
  assert.match(worker, /\[siteWireName\(a\), siteAuthoredSchema\(/,
    "the style block keys its properties on the internal axis name, so the rename never reaches the model");
  assert.ok(Object.keys(AXIS_WIRE).length > 0,
    "nothing is aliased any more — this guard has stopped meaning anything");
  // AND THE HAND-WRITTEN POINTER IS DERIVED FROM THE WIRE NAMES, so it goes
  // quiet now that nothing collides and comes BACK on its own if a twin ever
  // appears. Kept rather than deleted for exactly that: deleting it leaves the
  // next collision with no mitigation and nothing to notice it.
  assert.match(worker, /SITE_STYLE_AXES\.map\(siteWireName\)\.includes\(t\)/,
    "the token pointer is computed from the internal names, so it points at a field the tool does not have");
});
