// The palette layer, and the one property it exists to guarantee.
//
// NOT WIRED YET — nothing imports site-theme.mjs, so no build behaviour changes.
// It is tested anyway, because the module's whole claim is that a derived
// palette is legible BY CONSTRUCTION, and a claim like that is worth exactly as
// much as the check behind it. The first run of this file is what found
// `destructive` sitting at 4.24:1 in dark mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  THEMES, THEME_NAMES, paletteFor, themeCss, contrast, luminance,
  oklchToRgb, foregroundFor, shortlistForPrompt,
  distance, hueGap, separateFromAccent, MIN_STATE_SEPARATION, SAME_LANE_DEGREES,
  CORNERS, cornerCss, fitState, temperState, STATE_CHROMA_RATIO, MIN_STATE_CHROMA,
  TYPE_SCALES, typeCss, DENSITIES, densityCss, BORDERS, borderCss, SHADOWS, shadowCss,
} from "../builder/site-theme.mjs";
import { SHORTLIST } from "../builder/site-fonts.mjs";

/**
 * THE ENGINE IS TESTED AGAINST THIS, NOT AGAINST WHATEVER IS SHIPPED.
 *
 * `THEMES` is deliberately empty right now, and before this fixture existed the
 * engine's coverage was entangled with the shipped list: emptying it made four
 * tests crash on `THEMES[THEME_NAMES[0]]` and turned every per-theme loop into a
 * pass over nothing. Derivation is a property of the code and should be provable
 * with no themes declared at all — so it is.
 *
 * Chosen to EXERCISE rather than to look nice: the accent sits at hue 30, inside
 * the same lane as `destructive` at 27.3, so `separateFromAccent` has to fire;
 * and the paper is off-white at L 0.93 rather than near-white, which is the case
 * that broke the semantic colours the first time.
 */
const FIXTURE = {
  label: "Fixture — the engine's test subject, not a shipped theme",
  radius: "0.25rem", corner: "round",
  scale: "standard", density: "standard", border: "hairline", shadow: "crisp",
  fonts: { heading: "geist", body: "geist" },
  light: { paper: [0.93, 0.008, 90], ink: [0.2, 0.014, 60], accent: [0.45, 0.13, 30] },
  dark: { paper: [0.18, 0.012, 60], ink: [0.95, 0.006, 90], accent: [0.45, 0.12, 30] },
};

/**
 * WHAT THE PER-THEME INVARIANTS RUN OVER: the shipped set PLUS the fixture.
 *
 * A `for (const name of NAMES_UNDER_TEST)` over an empty `THEMES` passes without
 * checking anything — the exact shape of dead guard this repo has found in its
 * own tests five times. Including the fixture means every invariant below is
 * proven against at least one real theme no matter what is shipped, and each
 * shipped theme is still checked on top.
 */
const THEMES_UNDER_TEST = { ...THEMES, fixture: FIXTURE };
const NAMES_UNDER_TEST = Object.keys(THEMES_UNDER_TEST);

const PAIRS = [
  ["background", "foreground"], ["card", "card-foreground"], ["popover", "popover-foreground"],
  ["primary", "primary-foreground"], ["secondary", "secondary-foreground"],
  ["accent", "accent-foreground"], ["muted", "muted-foreground"],
  ["destructive", "destructive-foreground"], ["success", "success-foreground"],
  ["warning", "warning-foreground"], ["sidebar", "sidebar-foreground"],
  ["sidebar-primary", "sidebar-primary-foreground"], ["sidebar-accent", "sidebar-accent-foreground"],
];

test("the colour maths is right, or every ratio below is fiction", () => {
  // Anchored on values that cannot be argued with, because a subtly wrong
  // OKLCH->sRGB would still produce plausible-looking numbers — and plausible
  // numbers are what a contrast check is supposed to protect against.
  const white = oklchToRgb(1, 0, 0), black = oklchToRgb(0, 0, 0);
  for (const c of white) assert.ok(c > 0.99, `white channel came out ${c}`);
  for (const c of black) assert.ok(c < 0.01, `black channel came out ${c}`);
  // WCAG's own extremes: white on black is exactly 21:1.
  assert.ok(Math.abs(contrast([1, 0, 0], [0, 0, 0]) - 21) < 0.05);
  // A colour against itself is 1:1.
  assert.ok(Math.abs(contrast([0.5, 0.1, 30], [0.5, 0.1, 30]) - 1) < 1e-9);
  // Luminance is monotonic in lightness.
  assert.ok(luminance([0.2, 0, 0]) < luminance([0.6, 0, 0]));
  // Out of gamut must clamp, never NaN — a NaN would silently poison a ratio
  // into passing rather than failing.
  for (const c of oklchToRgb(0.7, 0.9, 140)) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1);
});

test("every pair in every theme clears 4.5:1, in BOTH modes", () => {
  // The property the whole module exists for. Not a spot check — every declared
  // pair, every theme, both modes, so adding a theme cannot quietly ship an
  // unreadable one.
  const failures = [];
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      for (const [a, b] of PAIRS) {
        const r = contrast(p[a], p[b]);
        if (r < 4.5) failures.push(`${name}/${mode}: ${a} on ${b} is ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("a foreground is the theme's own ink or paper — with one deliberate exception", () => {
  // What keeps a page two-tone. Picking a "nicer" third colour per surface is
  // how a palette turns into a swatch collection.
  //
  // `muted-foreground` is the exception and it is not an oversight: secondary
  // text has to sit BETWEEN the ink and the paper or it is not secondary, it is
  // just body text. So it is asserted differently — on the line, strictly
  // between the ends, and still clearing 4.5:1 above.
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const { paper, ink } = THEMES_UNDER_TEST[name][mode];
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      const allowed = [JSON.stringify(paper), JSON.stringify(ink)];
      for (const [, fgKey] of PAIRS) {
        if (fgKey === "muted-foreground") continue;
        assert.ok(allowed.includes(JSON.stringify(p[fgKey])),
          `${name}/${mode}: ${fgKey} is neither the ink nor the paper`);
      }
      // Strictly between, on every channel, so it cannot collapse onto either
      // end — at the ink it stops reading as secondary, at the paper it fails
      // contrast, and both look like a rendering glitch rather than a palette bug.
      const mf = p["muted-foreground"];
      for (let i = 0; i < 3; i++) {
        const lo = Math.min(paper[i], ink[i]), hi = Math.max(paper[i], ink[i]);
        assert.ok(mf[i] >= lo && mf[i] <= hi, `${name}/${mode}: muted-foreground channel ${i} is off the line`);
      }
      assert.notDeepEqual(mf, ink, `${name}/${mode}: muted-foreground collapsed onto the ink`);
      assert.notDeepEqual(mf, paper, `${name}/${mode}: muted-foreground collapsed onto the paper`);
    }
  }
});

test("foregroundFor picks the better of the two, not the first", () => {
  const ink = [0.2, 0, 0], paper = [0.98, 0, 0];
  assert.deepEqual(foregroundFor([0.95, 0, 0], ink, paper), ink, "ink on a light surface");
  assert.deepEqual(foregroundFor([0.15, 0, 0], ink, paper), paper, "paper on a dark surface");
});

test("surfaces sit between the paper and the ink, and in the right order", () => {
  // The derivation's own shape: card is the smallest step off the page, then
  // muted, then border, then input. Out of order and a card reads as a panel or
  // a border disappears — both of which look like a design choice rather than a
  // bug, which is why it is asserted.
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      const d = (k) => Math.abs(p[k][0] - p.background[0]);
      assert.ok(d("card") < d("muted"), `${name}/${mode}: card is not the smallest step`);
      assert.ok(d("muted") < d("border"), `${name}/${mode}: muted is past the border`);
      assert.ok(d("border") <= d("input"), `${name}/${mode}: input is not past the border`);
    }
  }
});

test("a state colour is separable from the accent, not just conventional", () => {
  // THE BUG A RENDER FOUND AND THE NUMBERS DID NOT. With an oxblood accent,
  // "Request" and "Cancel" sat at hue 28 and 27.3 — every contrast pair passed,
  // and the two solid fills read as one colour used twice rather than as
  // brand-versus-danger. Contrast says "can you read it"; nothing said "can you
  // tell these apart".
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const { accent } = THEMES_UNDER_TEST[name][mode];
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      for (const k of ["destructive", "success", "warning"]) {
        const apart = hueGap(p[k], accent) >= SAME_LANE_DEGREES ||
          distance(p[k], accent) >= MIN_STATE_SEPARATION;
        assert.ok(apart, `${name}/${mode}: ${k} is indistinguishable from the accent`);
      }
    }
  }
});

test("separation only fires inside the same hue lane", () => {
  // The first version measured OKLab distance alone, which conflates "different
  // colour" with "different lightness" — a green at the accent's lightness came
  // out at 0.290 and got nudged for nothing. Hue had already done the work.
  const ink = [0.2, 0.01, 60], paper = [0.98, 0.006, 95];
  const redAccent = [0.46, 0.14, 28];
  const green = [0.596, 0.145, 156];
  assert.deepEqual(separateFromAccent(green, redAccent, ink, paper), green,
    "a green must not move for a red accent");

  const red = [0.577, 0.245, 27.325];
  const moved = separateFromAccent(red, redAccent, ink, paper);
  assert.notDeepEqual(moved, red, "a red in the same lane must move");
  assert.equal(moved[2], red[2], "the HUE must not move — that is what says danger");
  assert.equal(moved[1], red[1], "chroma is left alone; the separation is bought in lightness");
  assert.ok(distance(moved, redAccent) >= MIN_STATE_SEPARATION);
  assert.ok(contrast(moved, foregroundFor(moved, ink, paper)) >= 4.5,
    "a separated colour must still be legible");
});

test("a blue accent leaves every state colour untouched", () => {
  // The derivation must cost nothing in the ordinary case, or it is a rule that
  // quietly reshapes palettes it was never meant to touch.
  const ink = [0.2, 0.01, 60], paper = [0.98, 0.006, 95];
  const blue = [0.5, 0.15, 250];
  for (const c of [[0.577, 0.245, 27.325], [0.596, 0.145, 156], [0.75, 0.16, 78]]) {
    assert.deepEqual(separateFromAccent(c, blue, ink, paper), c);
  }
});

test("state colours keep their conventional hue", () => {
  // Red-means-bad is inherited, not designed. A brand-tinted success is how a
  // confirmation stops reading as one.
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      const hue = (k) => p[k][2];
      assert.ok(hue("destructive") < 40 || hue("destructive") > 340, "destructive is not red");
      assert.ok(hue("success") > 110 && hue("success") < 190, "success is not green");
      assert.ok(hue("warning") > 50 && hue("warning") < 110, "warning is not amber");
    }
  }
});

test("the css writes :root AND .dark, because the template defines both", () => {
  // The one mechanical difference from the font injection, which writes `@theme`
  // and gets `:root` only. The template declares every colour twice — `--primary`
  // at line 101 and again at 140 — so a theme writing one block would leave half
  // of every site on the stock palette, visible only to somebody in dark mode.
  const css = themeCss(FIXTURE);
  assert.match(css, /^:root \{/m);
  assert.match(css, /^\.dark \{/m);
  // Both blocks carry the full palette, not a partial override.
  const root = css.slice(css.indexOf(":root"), css.indexOf(".dark"));
  const dark = css.slice(css.indexOf(".dark"));
  for (const [a, b] of PAIRS) {
    assert.ok(root.includes(`--${a}:`) && root.includes(`--${b}:`), `:root is missing ${a}/${b}`);
    assert.ok(dark.includes(`--${a}:`) && dark.includes(`--${b}:`), `.dark is missing ${a}/${b}`);
  }
  // radius belongs to the theme, not to a mode.
  assert.equal((css.match(/--radius:/g) || []).length, 1);
  assert.equal(themeCss("no-such-theme"), null);
});

test("every emitted value is a real oklch triple", () => {
  // A NaN or an undefined here is a CSS declaration the browser drops silently,
  // leaving that one token on the stock palette with nothing to show for it.
  const css = themeCss(FIXTURE);
  // WHICH tokens must be colours is DERIVED from the palette, not from a shape
  // in the text. The first version skipped anything ending in `rem` and demanded
  // oklch of everything else, which was true until the type scale started
  // emitting unitless line heights — a correct value failing a test about
  // colours. Deriving the names means a new non-colour axis cannot break it, and
  // a colour that stops being one still fails.
  const colourTokens = new Set(Object.keys(paletteFor(FIXTURE, "light")));
  let checked = 0;
  for (const m of css.matchAll(/--([a-z0-9-]+): ([^;]+);/g)) {
    const [, name, v] = m;
    if (colourTokens.has(name)) {
      assert.match(v, /^oklch\(-?\d+(\.\d+)? -?\d+(\.\d+)? -?\d+(\.\d+)?\)$/, `bad colour ${name}: ${v}`);
      checked++;
    }
    // Every token, colour or not: a NaN or an undefined is a declaration the
    // browser drops silently, leaving that one value on the stock default.
    assert.ok(!/NaN|undefined/.test(v), `${name} emitted ${v}`);
  }
  assert.ok(checked >= colourTokens.size, `only ${checked} of ${colourTokens.size} colour tokens were seen`);
});

test("every corner treatment emits valid css, and only the usable ones are offered", () => {
  const base = { ...FIXTURE };
  for (const style of Object.keys(CORNERS)) {
    const css = cornerCss({ ...base, corner: style, radius: "1rem" });
    assert.match(css, /--radius:/, `${style} must still set the base radius`);
    assert.ok(!/NaN|undefined/.test(css), `${style} emitted a broken value`);
    // Balanced braces — a malformed block silently kills every rule after it.
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, `${style} braces`);
  }
  // An unknown treatment falls back to the ordinary corner rather than emitting
  // nothing, or a typo in a theme would drop the radius entirely.
  assert.match(cornerCss({ ...base, corner: "nonsense", radius: "1rem" }), /--radius: 1rem/);

  // NOTCH AND SCOOP ARE REFUSED ON PURPOSE. Both exist and both render — and
  // across a component kit they are unusable: the notch cuts through an input's
  // border, a card's edge comes apart, and an avatar's initials get clipped.
  // Asserted so that "we forgot" and "we tried it and it broke" cannot be
  // confused a year from now.
  assert.ok(!("notch" in CORNERS) && !("scoop" in CORNERS));
});

test("no corner treatment writes a radius token the bundle cannot read", () => {
  // THE GUARD THE `elliptical` TREATMENT NEEDED AND DID NOT HAVE. It wrote
  // `--radius-sm/md/lg/xl` as slash pairs and was a silent no-op in every
  // browser, because the template declares that scale inside `@theme inline` —
  // and `inline` makes Tailwind substitute the value into the utility instead of
  // referencing the variable. The compiled bundle contains
  // `calc(var(--radius) - 2px)` and never the string `var(--radius-md)`, so the
  // tokens are write-only. The old test asserted the emitted CSS TEXT held the
  // slash pairs: true, and worth nothing.
  //
  // Derived at BOTH ends — the swallowed names are read out of the template
  // rather than listed here, so adding a step to that block extends this guard
  // without anyone remembering to.
  const sheet = fs.readFileSync(
    new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  const inlineBlock = sheet.match(/@theme inline \{[\s\S]*?\n\}/);
  assert.ok(inlineBlock, "the template no longer has an @theme inline block — re-derive this test");
  const swallowed = [...inlineBlock[0].matchAll(/--(radius-[a-z0-9]+):/g)].map((m) => m[1]);
  assert.ok(swallowed.length >= 4, `expected several radius steps, found ${swallowed.length}`);

  for (const style of Object.keys(CORNERS)) {
    const css = cornerCss({ ...FIXTURE, corner: style, radius: "1.5rem" });
    for (const name of swallowed) {
      assert.ok(!css.includes(`--${name}:`),
        `${style} sets --${name}, which @theme inline makes unreadable at runtime`);
    }
    // `--radius` itself is the ONE token the utilities really do read.
    assert.match(css, /--radius: 1\.5rem/, `${style} must still set the base radius`);
  }
});

test("squircle and bevel both reach the descendants, not just the root", () => {
  // `corner-shape` is a box property and box properties DO NOT INHERIT. Set on
  // the root alone it styled the root and nothing inside it, so the whole page
  // rendered as ordinary rounded corners — which looks exactly like the browser
  // not supporting the property. Found by rendering it; nothing else could tell.
  for (const style of ["squircle", "bevel"]) {
    const css = cornerCss({ ...FIXTURE, corner: style, radius: "0.875rem" });
    assert.match(css, new RegExp(`corner-shape: ${style}`));
    assert.match(css, /body \*|,\s*\*/, `${style} must select descendants or it reaches one element`);
    // And it must still set a radius — corner-shape has nothing to act on without one.
    assert.match(css, /--radius: 0\.875rem/);
  }
  // `round` is the browser default, so emitting the property for it is noise.
  assert.ok(!/corner-shape/.test(cornerCss({ ...FIXTURE, corner: "round", radius: "1rem" })));
});

test("a shaped corner needs a radius big enough to see it", () => {
  // A squircle or a bevel at 2px is indistinguishable from a square, so a theme
  // asking for one at a tiny radius has silently got nothing — which is the
  // failure this whole section exists to stop being invisible.
  for (const name of NAMES_UNDER_TEST) {
    const t = THEMES_UNDER_TEST[name];
    if ((t.corner ?? "round") === "round") continue;
    const px = parseFloat(t.radius) * (t.radius.endsWith("rem") ? 16 : 1);
    assert.ok(px >= 6, `${name} asks for ${t.corner} at ${px}px — too small to read as anything`);
  }
});

test("bevel reaches the descendants, not just the root", () => {
  // `corner-shape` is a box property and box properties DO NOT INHERIT. Set on
  // the root alone it styled the root and nothing inside it, so the whole page
  // rendered as ordinary rounded corners — which looks exactly like the browser
  // not supporting the property. Found by rendering it; nothing else could tell.
  const css = cornerCss({ ...FIXTURE, corner: "bevel", radius: "0.875rem" });
  assert.match(css, /corner-shape: bevel/);
  assert.match(css, /body \*|,\s*\*/, "bevel must select descendants or it reaches one element");
  // And it must still set a radius — corner-shape has nothing to act on without one.
  assert.match(css, /--radius: 0\.875rem/);
});

test("every shadow utility the KIT uses is one a theme can turn off", () => {
  // THE GUARD FOR THE BUG THIS AXIS SHIPPED WITH. The first version covered
  // `xs…xl` and missed the BARE `.shadow`, which the kit uses 22 times — Card
  // among them — so every `flat` theme still had the framework's drop shadow on
  // every card while the code reported success. Nothing in the CSS said so; it
  // was found by reading `--tw-shadow` back off a rendered card.
  //
  // Derived from the component kit, so a component adopting a new step fails
  // here rather than quietly escaping the theme.
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const used = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".tsx")) continue;
    const src = fs.readFileSync(new URL(f, dir), "utf8");
    // `shadow` or `shadow-<step>` as a whole class token. `shadow-none` is
    // excluded: it is a page asking for no shadow, which every style honours.
    for (const m of src.matchAll(/(?<![\w-])shadow(-(?:xs|sm|md|lg|xl|2xl))?(?![\w-])/g)) {
      used.add(m[1] ? m[1].slice(1) : "");
    }
  }
  assert.ok(used.size >= 4, `expected several shadow steps in the kit, found ${used.size}`);
  assert.ok(used.has(""), "the bare `shadow` should be in the kit — re-derive this test if it has gone");
  for (const style of Object.keys(SHADOWS)) {
    const css = shadowCss(style);
    for (const step of used) {
      const sel = `.shadow${step ? "-" + step : ""} {`;
      assert.ok(css.includes(sel), `${style} does not override ${sel.trim()}, which the kit uses`);
    }
  }
});

test("a shadow is darker than the surface it falls on, in BOTH modes", () => {
  // A shadow is an absence of light. The first version mixed against
  // `var(--foreground)` and stopped, which is correct in light mode and exactly
  // inverted in dark — `--foreground` is the near-white ink there, so every card
  // on Ledger and Atrium got a white halo at 7-10% and read as glowing rather
  // than raised. Measured as `oklch(0.96 0.004 230 / 0.07)` on a near-black
  // page. Nothing else could see it: the shadow existed, it was the theme's own
  // colour, and it was the wrong end of the theme.
  for (const name of NAMES_UNDER_TEST) {
    const theme = THEMES_UNDER_TEST[name];
    if (theme.shadow === "flat") continue;
    const css = shadowCss(theme.shadow, theme);

    // LIGHT: the anchor is the live ink token, and the ink must be the darker end.
    const light = css.split("\n").filter((l) => l.startsWith(".shadow"));
    assert.ok(light.length > 0, `${name} emitted no light-mode shadow`);
    for (const rule of light) {
      assert.match(rule, /var\(--foreground\)/, `${name}: light shadow is not anchored on the ink`);
    }
    assert.ok(theme.light.ink[0] < theme.light.paper[0],
      `${name}: the light ink is not darker than its paper, so var(--foreground) is the wrong anchor`);

    // DARK: a literal, because no token holds "darker than the page".
    const dark = css.split("\n").filter((l) => l.startsWith(".dark .shadow"));
    assert.ok(dark.length === light.length, `${name}: ${dark.length} dark rules against ${light.length} light ones`);
    for (const rule of dark) {
      const m = rule.match(/oklch\((-?[\d.]+) [\d.]+ [\d.]+\)/);
      assert.ok(m, `${name}: dark shadow has no literal anchor — ${rule.slice(0, 90)}`);
      assert.ok(Number(m[1]) < theme.dark.paper[0],
        `${name}: dark shadow anchor L ${m[1]} is lighter than the page at ${theme.dark.paper[0]} — that is a glow`);
    }
    // And it carries more of itself, or a dark-on-dark shadow does not register.
    const alpha = (rule) => Number(rule.match(/([\d.]+)%, transparent/)[1]);
    assert.ok(alpha(dark[0]) > alpha(light[0]),
      `${name}: the dark shadow is no stronger than the light one`);
  }
  // Without a theme the dark half cannot be derived, so it must be OMITTED
  // rather than guessed — a wrong dark rule is worse than none.
  assert.ok(!shadowCss("crisp").includes(".dark"), "a themeless call invented a dark-mode shadow");
});

test("a border weight is a whole pixel, or it is the weight below it", () => {
  // MEASURED, not assumed: Chrome floors the USED border-width to a whole CSS
  // pixel at EVERY device pixel ratio, so 1px, 1.25px, 1.5px and 1.75px all
  // render as 1px. `drawn` shipped at 1.5px in the first draft, which made it
  // `hairline` under a different name — the elliptical failure again, one axis
  // over.
  const seen = new Set();
  for (const [name, { width }] of Object.entries(BORDERS)) {
    assert.match(width, /^\d+px$/, `${name} is ${width}; a fraction of a pixel is floored away`);
    assert.ok(!seen.has(width), `${name} is ${width}, which another weight already is`);
    seen.add(width);
  }
  // And the numbered utilities are left alone — a page that wrote `border-2`
  // asked for two pixels, and a theme must not overrule the markup.
  const css = borderCss("bold");
  assert.ok(!/\.border-\d/.test(css), "a theme is rewriting an explicit border-2");
  assert.ok(!/\.border-(transparent|input|primary)/.test(css), "a colour utility was caught by the selector");
});

test("the type scale moves the display sizes and leaves body text alone", () => {
  // Shrinking `sm` or `base` is an accessibility decision wearing a style
  // costume, so the scale only acts above `base`.
  for (const scale of Object.keys(TYPE_SCALES)) {
    const css = typeCss(scale);
    for (const step of ["xs", "sm", "base"]) {
      assert.ok(!css.includes(`--text-${step}:`), `${scale} moves --text-${step}, which is body text`);
    }
    const sizes = [...css.matchAll(/--text-[a-z0-9]+: ([\d.]+)rem;/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length >= 6, `${scale} emitted only ${sizes.length} steps`);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), `${scale} is out of order`);
    assert.ok(sizes[0] > 1, `${scale} starts below the base size`);
    // Leading tightens as type grows — a display size set at body leading looks
    // double-spaced, and that is most of what makes big type look amateur.
    const leads = [...css.matchAll(/--line-height: ([\d.]+);/g)].map((m) => Number(m[1]));
    assert.deepEqual(leads, [...leads].sort((a, b) => b - a), `${scale}: leading does not tighten as size grows`);
    // Monotonic is not enough — a CONSTANT leading is trivially sorted, and a
    // mutation setting every step to 1.4 survived this test until the gap was
    // asserted as well. Display type set at body leading is most of what makes
    // big type look amateur, so the drop has to be real.
    assert.ok(leads[0] - leads.at(-1) >= 0.15,
      `${scale}: leading only drops ${(leads[0] - leads.at(-1)).toFixed(3)} across the whole scale`);
    assert.ok(leads.at(-1) >= 1, "a line height under 1 clips ascenders");
  }
  // The scales must actually differ, or naming three of them is theatre.
  const big = (s) => Number(typeCss(s).match(/--text-4xl: ([\d.]+)rem/)[1]);
  assert.ok(big("grand") > big("standard") * 1.2, "grand is not meaningfully grander");
  assert.ok(big("compact") < big("standard") * 0.9, "compact is not meaningfully more compact");
});

test("density is one token, and the range stays inside what a layout survives", () => {
  for (const [name, { spacing }] of Object.entries(DENSITIES)) {
    assert.match(spacing, /^0\.\d+rem$/, `${name} is ${spacing}`);
    const px = parseFloat(spacing) * 16;
    // `--spacing` multiplies widths as well as padding, and container widths do
    // NOT move with it, so past about a fifth either way the two scales come
    // apart and the page reads as broken rather than as dense.
    assert.ok(Math.abs(px - 4) / 4 <= 0.2, `${name} is ${px}px, more than 20% off the 4px base`);
  }
  assert.equal((densityCss("standard").match(/--spacing/g) || []).length, 1,
    "density must be ONE token — that is the entire reason it is a single lever");
  assert.match(densityCss("nonsense"), /--spacing: 0\.25rem/, "an unknown density must fall back, not emit nothing");
});

test("every theme declares every axis, with a value the axis offers", () => {
  // A theme missing an axis silently gets the fallback, which reads in a diff as
  // a deliberate choice of the ordinary value and is not one.
  const AXES = [["scale", TYPE_SCALES], ["density", DENSITIES], ["border", BORDERS], ["shadow", SHADOWS], ["corner", CORNERS]];
  for (const name of NAMES_UNDER_TEST) {
    const t = THEMES_UNDER_TEST[name];
    for (const [key, table] of AXES) {
      assert.ok(t[key], `${name} declares no ${key}`);
      assert.ok(key in table === false || table[t[key]], `${name}.${key} is "${t[key]}", which is not on offer`);
    }
    assert.ok(t.fonts?.heading && t.fonts?.body, `${name} recommends no font pair`);
  }
  // And every option is USED by something. An option nothing picks is the
  // capability-nobody-reaches pattern this repo has hit four times.
  //
  // GATED ON THERE BEING A SHIPPED SET, and this is the one place gating is
  // right rather than lazy: with nothing shipped the claim is not "no theme uses
  // bevel" — it is that the question does not apply yet. Asserting it anyway
  // would fail the suite for a deliberate empty state, and quietly dropping it
  // would let a dead option slip in with the next set.
  if (THEME_NAMES.length === 0) return;
  for (const [key, table] of AXES) {
    for (const option of Object.keys(table)) {
      assert.ok(THEME_NAMES.some((n) => THEMES[n][key] === option),
        `no theme uses ${key}: "${option}" — either use it or take it out`);
    }
  }
});

test("the recommended font pair is a real entry in the font shortlist", () => {
  // A name that is not installed produces a site whose CSS points at a font
  // never bundled — it renders as the fallback and looks like nothing happened,
  // which is what site-fonts.mjs already asserts about its own list.
  const ids = new Set(SHORTLIST.map((f) => f.id));
  for (const name of NAMES_UNDER_TEST) {
    const { heading, body } = THEMES_UNDER_TEST[name].fonts;
    assert.ok(ids.has(heading), `${name}: heading font "${heading}" is not in the shortlist`);
    assert.ok(ids.has(body), `${name}: body font "${body}" is not in the shortlist`);
  }
});

test("the shortlist is usable as a tool enum", () => {
  // Zero is a legal state — the set was emptied deliberately — so what is
  // asserted is that the prompt and the enum agree, whatever their size.
  for (const n of NAMES_UNDER_TEST) assert.match(n, /^[a-z][a-z0-9-]*$/, `${n} is not enum-safe`);
  const list = shortlistForPrompt();
  for (const n of THEME_NAMES) assert.ok(list.includes(n), `${n} is missing from the prompt shortlist`);
  assert.equal(list === "" , THEME_NAMES.length === 0, "the shortlist disagrees with the enum about being empty");
  // Cheap enough to sit in the prompt — the font shortlist is ~74 tokens and
  // this must not be the thing that makes per-site design expensive.
  assert.ok(list.length < 600, `the shortlist is ${list.length} chars`);
});

test("nothing imports this yet, and that is deliberate", () => {
  // Recorded rather than assumed. This module is a demonstration: wiring it is a
  // separate decision, and until then no build behaviour changes. When it IS
  // wired, this test should be replaced by one asserting the opposite — a module
  // nothing imports is the exact shape of the blocks and examples this repo
  // installed twice and deleted twice.
  const fs = require$("node:fs");
  const hits = [];
  for (const f of ["builder/page-gen.mjs", "builder/build-server.mjs", "builder/publish-pages.mjs", "worker.js"]) {
    if (/site-theme/.test(fs.readFileSync(f, "utf8"))) hits.push(f);
  }
  assert.deepEqual(hits, [],
    "site-theme.mjs is now imported — wire it properly and replace this test with a reachability chain");
});

// node:test runs as ESM here; `require` is not defined, so the one filesystem
// read above goes through createRequire rather than a top-level import that
// would suggest this module needs fs.
import { createRequire } from "node:module";
const require$ = createRequire(import.meta.url);

test("a state colour is fitted to THIS theme's paper, not to white", () => {
  // THE BUG THAT APPEARED THE MOMENT THEMES STOPPED USING OFF-WHITE. The
  // conventional red/green/amber are tuned for a near-white ground. On bone at
  // L 0.93 the standard red measures 3.98:1 against BOTH the theme's ink and its
  // paper, because it sits between them — and it failed in seven of eight
  // light/dark combinations at once. Invisible to any amount of looking: a red
  // chip with white text looks completely fine right up until somebody reads it.
  const ink = [0.175, 0.018, 262], paper = [0.932, 0.008, 88];
  const red = [0.577, 0.245, 27.325];
  assert.ok(contrast(red, foregroundFor(red, ink, paper)) < 4.5, "the premise: it really does fail");
  const fitted = fitState(red, ink, paper);
  assert.ok(contrast(fitted, foregroundFor(fitted, ink, paper)) >= 4.5, "fitting must fix it");
  assert.equal(fitted[2], red[2], "the HUE must not move — that is what says danger");
  assert.equal(fitted[1], red[1], "chroma is left alone; only lightness moves");
  // A colour that already clears is left exactly where it is. Not the red:
  // it measures 4.57 on Ledger's near-white, which passes the 4.5 bar the suite
  // asserts but not the 4.6 fitState works to — so fitting nudges it there too,
  // and using it here asserted a no-op that never happens.
  const amber = [0.75, 0.16, 78];
  const ledgerInk = [0.22, 0.014, 60], ledgerPaper = [0.985, 0.006, 95];
  assert.ok(contrast(amber, foregroundFor(amber, ledgerInk, ledgerPaper)) >= 4.6);
  assert.deepEqual(fitState(amber, ledgerInk, ledgerPaper), amber);
});

test("every theme is a deliberate choice, not a default", () => {
  // The three tells of generated design, asserted rather than trusted to taste.
  for (const name of NAMES_UNDER_TEST) {
    const t = THEMES_UNDER_TEST[name];
    const px = parseFloat(t.radius) * (t.radius.endsWith("rem") ? 16 : 1);
    // ~10px is shadcn's default and every SaaS product on earth. A theme landing
    // there has not chosen a radius, it has failed to choose one.
    //
    // SCOPED TO `round`, and that is not the goalposts moving. The tell is the
    // 10px ROUNDED RECTANGLE specifically — a squircle or a bevel at the same
    // number is a different shape, and nobody's default. Applying the rule to
    // them would rule out the only radii at which those treatments are visible
    // at all, which the test below asserts they need.
    if ((t.corner ?? "round") === "round") {
      assert.ok(px <= 6 || px >= 14, `${name}: radius ${px}px sits in the unconsidered middle`);
    }
    // An accent brighter than this reads as a startup, not as a trade.
    for (const mode of ["light", "dark"]) {
      assert.ok(t[mode].accent[1] <= 0.15,
        `${name}/${mode}: accent chroma ${t[mode].accent[1]} is louder than the set allows`);
    }
  }
});

test("no state colour is allowed to out-shout its own theme's accent", () => {
  // The failure this replaces was visible only in a browser: a fire-engine
  // Cancel button on bone paper, beside an accent at a third of its chroma.
  for (const name of NAMES_UNDER_TEST) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES_UNDER_TEST[name], mode);
      const ceiling = Math.max(MIN_STATE_CHROMA, THEMES_UNDER_TEST[name][mode].accent[1] * STATE_CHROMA_RATIO);
      for (const k of ["destructive", "success", "warning"]) {
        assert.ok(p[k][1] <= ceiling + 1e-9,
          `${name}/${mode}: ${k} chroma ${p[k][1].toFixed(3)} exceeds ${ceiling.toFixed(3)}`);
        // ...and it is still a colour. Below the floor a red is a brown, and the
        // token has stopped carrying the one thing it exists to carry.
        assert.ok(p[k][1] >= MIN_STATE_CHROMA - 1e-9,
          `${name}/${mode}: ${k} chroma ${p[k][1].toFixed(3)} is under the floor`);
      }
    }
  }
});

test("tempering lowers chroma only, and never touches the hue", () => {
  const red = [0.577, 0.245, 27.325];
  // A quiet accent pulls it down...
  const quiet = temperState(red, [0.34, 0.075, 264]);
  assert.equal(quiet[1], 0.075 * STATE_CHROMA_RATIO);
  assert.equal(quiet[2], red[2], "the hue is the meaning and must not move");
  assert.equal(quiet[0], red[0], "lightness is fitState's job, not this one");
  // ...a loud one does NOT push it up. The constants are the maximum, so a garish
  // brand cannot license an alert more garish still.
  assert.deepEqual(temperState(red, [0.6, 0.31, 300]), red);
  // The floor binds where the accent is effectively achromatic.
  assert.equal(temperState(red, [0.245, 0.012, 88])[1], MIN_STATE_CHROMA);
});

test("tempering happens before fitting, or the fit measures a colour that never ships", () => {
  // ALL SIX SHIPPED THEMES CLEAR THE BAR IN EITHER ORDER, so testing the set
  // proves nothing here — the order is the difference between a guarantee and
  // luck, and the luck currently holds. What the order actually buys is visible
  // only against themes that do not exist yet, which is exactly what a rule
  // written into a generator has to survive.
  //
  // Tempering lowers chroma, which RAISES a red's luminance. Where the derived
  // foreground is the light one, that raise cuts the contrast — after the fit has
  // already declared the colour legible and stopped looking.
  //
  // Three cases lifted from a 15,750-theme sweep, in which the shipped order
  // never fell below 4.60:1 and fit-first fell below 4.5 one hundred and thirty
  // times.
  const red = [0.577, 0.245, 27.325];
  const CASES = [
    { paper: [0.08, 0.012, 88], ink: [0.985, 0.015, 260], accent: [0.9, 0.01, 90] },
    { paper: [0.353, 0.012, 88], ink: [0.985, 0.015, 260], accent: [0.9, 0.06, 27] },
    { paper: [0.977, 0.012, 88], ink: [0.526, 0.015, 260], accent: [0.526, 0.06, 27] },
  ];
  for (const { paper, ink, accent } of CASES) {
    // THROUGH `paletteFor`, not through the two functions in isolation. Composing
    // them by hand in the test proves the principle and guards nothing: swapping
    // the real call site left this passing until the assertion was moved here.
    const p = paletteFor({ light: { paper, ink, accent } }, "light");
    assert.ok(contrast(p.destructive, p["destructive-foreground"]) >= 4.5,
      `paletteFor produced an illegible destructive on paper ${paper[0]} / ink ${ink[0]}`);
    // The premise, asserted rather than assumed. Without this the test would keep
    // passing if the two orders ever became equivalent, proving nothing at all.
    const wrong = temperState(fitState(red, ink, paper), accent);
    assert.ok(contrast(wrong, foregroundFor(wrong, ink, paper)) < 4.5,
      `fit-first was supposed to fail on paper ${paper[0]} / ink ${ink[0]} and did not`);
  }
});
