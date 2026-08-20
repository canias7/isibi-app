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
  AXES, ASKABLE, MAX_STYLE, MAX_STYLE_BUILD, RADIUS_AXES,
  optionsFor, parseStyle, mergeStyle, applyStyle, explicitRadiusCss,
  styleNote, saidFor, axisHint,
} from "../builder/site-style.mjs";
import * as T from "../builder/site-theme.mjs";
import { stripThemeRadius, ASKABLE as TOKEN_NAMES, saidFor as tokenSaid, valueHint } from "../builder/site-tokens.mjs";
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

/* ------------------------------------------ the one place two patches collide */

test("RADIUS_AXES is the WHOLE truth, derived from the engine", () => {
  // The list is held in code because deriving it needs twelve emitters with
  // three different signatures and a theme to evaluate them against. That is
  // exactly the kind of hand-maintained fact that rots, so the truth is derived
  // HERE: an axis that starts emitting a corner radius and is not in the list
  // would be silently stripped whenever a customer also asks for a radius.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const found = [];
  for (const axis of ASKABLE) {
    for (const option of optionsFor(axis)) {
      const css = T.themeCss(applyStyle(theme, { [axis]: option })) || "";
      const bare = T.themeCss(applyStyle(theme, {})) || "";
      // Only what this axis ADDS: the theme's own rules are in both.
      const added = css.split("\n").filter((l) => !bare.includes(l)).join("\n");
      if (/border-radius/i.test(added) && !found.includes(axis)) found.push(axis);
    }
  }
  assert.deepEqual(found.sort(), [...RADIUS_AXES].sort(),
    "an axis emits a border-radius and is not in RADIUS_AXES — a strip will eat it");
});

test("the customer's OWN corner opinion survives a radius strip", () => {
  // "rounder corners AND pill buttons" got the first and silently lost the
  // second: `stripThemeRadius` is a regex and cannot tell a theme's hard-set
  // button radius from the one just asked for.
  const css = explicitRadiusCss({ buttons: "pill", inputs: "underline" });
  assert.match(css, /border-radius:\s*9999px/, "the explicit pill was not re-emitted");
  assert.match(css, /\.border-input/, "the explicit input style was not re-emitted");
  assert.equal(stripThemeRadius(css).includes("9999px"), false,
    "the fixture is wrong — the strip does not touch this, so the test proves nothing");
});

test("an axis nobody named re-emits NOTHING", () => {
  // Empty for a patch that did not mention them, so a colour-only or radius-only
  // change leaves every existing site exactly as it is.
  assert.equal(explicitRadiusCss({}), "");
  assert.equal(explicitRadiusCss({ density: "airy" }), "");
  assert.equal(explicitRadiusCss(null), "");
  // And empty for the no-op options, which mean "let the radius decide" —
  // which is precisely what the strip leaves behind.
  assert.equal(explicitRadiusCss({ buttons: "inherit", inputs: "standard" }), "");
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
  };
  assert.deepEqual(ASKABLE.slice().sort(), Object.keys(byName).sort(),
    "AXES and this test disagree about which axes exist");
  for (const [a, real] of Object.entries(byName)) {
    assert.deepEqual(optionsFor(a), Object.freeze(Object.keys(real)), a + " restates the engine's options");
    assert.ok(optionsFor(a).length >= 2, a + " has fewer than two options — it is not a choice");
  }
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
  // `border` is a colour here and a weight there. Without a pointer, "make the
  // borders thicker" can land in the colour slot, be refused for not being a
  // colour, and come back as "ask again with a hex code like #ffcc00" — advice
  // that cannot work. Derived, so a name that gains a twin later is covered.
  const twins = TOKEN_NAMES.filter((t) => ASKABLE.includes(t));
  assert.ok(twins.length > 0, "no overlap at all — this guard has stopped meaning anything");
  const at = worker.indexOf("properties: Object.fromEntries(SITE_TOKEN_NAMES.map(");
  assert.ok(at > 0, "the tokens field moved — retarget this");
  const block = worker.slice(at, worker.indexOf("},", at));
  assert.match(block, /SITE_STYLE_AXES\.includes\(t\)/, "the overlap is not derived — or not disambiguated at all");
  assert.match(block, /style\." \+ t/, "the pointer does not name the other slot");
  // And the colour half is still described as a colour, or the fix broke the
  // thing it was bolted onto.
  for (const t of twins) assert.equal(valueHint(t), "#rrggbb", t + " stopped being described as a colour");
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
  assert.match(server, /themeCss\(applyStyle\(theme, style\)\)/,
    "the container renders the theme without the site's own axes");
  const i = server.indexOf("function writeTheme(");
  const sig = server.slice(i, server.indexOf(")", i) + 1);
  assert.match(sig, /style/, "writeTheme cannot be given a style patch");
  assert.match(server, /writeTheme\(payload\.seeds, \{[^}]*style: payload\.style/,
    "the payload's style never reaches writeTheme");
  // AND THE COLLISION, which a mutation proved was covered by nothing: the
  // module's own test drives `explicitRadiusCss` in isolation, and the container
  // is where it has to be APPENDED. Deleting the append left "rounder corners
  // AND pill buttons" silently losing the buttons again, with every test green.
  const branch = server.slice(server.indexOf("const shaped = dropRadius"));
  const stmt = branch.slice(0, branch.indexOf(";") + 1);
  assert.match(stmt, /stripThemeRadius\(css\)/, "the strip is gone from the radius branch");
  assert.match(stmt, /explicitRadiusCss\(style\)/,
    "the strip runs without re-emitting the corner axes the customer named");
  assert.ok(stmt.indexOf("stripThemeRadius") < stmt.indexOf("explicitRadiusCss"),
    "the re-emit runs BEFORE the strip, which eats it");
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

test("THE DESIGNER CAN ASK FOR IT, with the engine's own options", () => {
  // Unreachable from the tool is unreachable full stop — the state 14 other
  // schema features are in, fully built and declarable by nothing.
  assert.match(worker, /import \{[^}]*mergeStyle[^}]*\} from "\.\/builder\/site-style\.mjs"/);
  const at = worker.indexOf("      style: {");
  assert.ok(at > 0, "design_schema has no style field");
  const field = worker.slice(at, worker.indexOf("\n      },", at));
  assert.match(field, /SITE_STYLE_AXES\.map/, "the axes are restated rather than derived");
  assert.match(field, /enum: siteStyleOptions\(a\)/,
    "an option the engine would refuse is merely dropped rather than impossible");
  assert.match(field, /description: siteStyleHint\(a\)/, "the options reach the model unlabelled");
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
  // …and the corner-collision fix, where the re-cap bit hardest: `AXES` declares
  // `buttons` eleventh and `inputs` twelfth, so at the revise cap an eighteen
  // axis patch had BOTH cut before this function looked for them and it returned
  // the empty string — the collision silently un-fixed on the widest patches.
  for (const axis of RADIUS_AXES) {
    assert.ok(explicitRadiusCss(full).length > 0,
      `explicitRadiusCss drops ${axis} out of a wide patch, so a corner change eats the customer's own button shape`);
  }
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
