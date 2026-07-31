// The palette layer, and the one property it exists to guarantee.
//
// NOT WIRED YET — nothing imports site-theme.mjs, so no build behaviour changes.
// It is tested anyway, because the module's whole claim is that a derived
// palette is legible BY CONSTRUCTION, and a claim like that is worth exactly as
// much as the check behind it. The first run of this file is what found
// `destructive` sitting at 4.24:1 in dark mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES, THEME_NAMES, paletteFor, themeCss, contrast, luminance,
  oklchToRgb, foregroundFor, shortlistForPrompt,
  distance, hueGap, separateFromAccent, MIN_STATE_SEPARATION, SAME_LANE_DEGREES,
  CORNERS, cornerCss, fitState,
} from "../builder/site-theme.mjs";

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
  for (const name of THEME_NAMES) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES[name], mode);
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
  for (const name of THEME_NAMES) {
    for (const mode of ["light", "dark"]) {
      const { paper, ink } = THEMES[name][mode];
      const p = paletteFor(THEMES[name], mode);
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
  for (const name of THEME_NAMES) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES[name], mode);
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
  for (const name of THEME_NAMES) {
    for (const mode of ["light", "dark"]) {
      const { accent } = THEMES[name][mode];
      const p = paletteFor(THEMES[name], mode);
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
  for (const name of THEME_NAMES) {
    for (const mode of ["light", "dark"]) {
      const p = paletteFor(THEMES[name], mode);
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
  const css = themeCss("ledger");
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
  const css = themeCss("ledger");
  for (const m of css.matchAll(/--[a-z-]+: ([^;]+);/g)) {
    const v = m[1];
    if (v.endsWith("rem")) continue;
    assert.match(v, /^oklch\(-?\d+(\.\d+)? -?\d+(\.\d+)? -?\d+(\.\d+)?\)$/, `bad value ${v}`);
    assert.ok(!/NaN|undefined/.test(v));
  }
});

test("every corner treatment emits valid css, and only the usable ones are offered", () => {
  const base = { ...THEMES[THEME_NAMES[0]] };
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

test("elliptical writes the scale, because the base cannot hold a slash", () => {
  // `--radius-md` is `calc(var(--radius) - 2px)` and you cannot subtract from a
  // slash pair — so the derived steps are written directly. This is also the
  // whole reason an elliptical corner is reachable at all: the utility CLASS
  // cannot express one, but the variable it reads substitutes whatever it holds.
  const css = cornerCss({ ...THEMES[THEME_NAMES[0]], corner: "elliptical", radius: "1.5rem" });
  for (const step of ["sm", "md", "lg", "xl"]) {
    assert.match(css, new RegExp(`--radius-${step}: [\\d.]+px / [\\d.]+px;`), `${step} is not elliptical`);
  }
  // The vertical radius must be flatter than the horizontal, or it is a circle
  // written the long way.
  const pairs = [...css.matchAll(/--radius-\w+: ([\d.]+)px \/ ([\d.]+)px;/g)];
  assert.ok(pairs.length === 4);
  for (const [, h, v] of pairs) assert.ok(Number(v) < Number(h), "the corner is not flattened");
  // And the steps stay in order, the way the calc() scale does.
  const hs = pairs.map(([, h]) => Number(h));
  assert.deepEqual(hs, [...hs].sort((a, b) => a - b), "the elliptical scale is out of order");
});

test("elliptical needs a radius big enough to see", () => {
  // At the ledger's 4px base the scale collapses — `sm` comes out 0px / 0px and
  // the treatment is indistinguishable from square. Not a defect in the code, a
  // constraint on the theme: asking for elliptical with a tiny radius silently
  // gets you nothing, and silently getting nothing is what this asserts against.
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    if ((t.corner ?? "round") !== "elliptical") continue;
    const px = parseFloat(t.radius) * (t.radius.endsWith("rem") ? 16 : 1);
    assert.ok(px >= 12, `${name} asks for elliptical at ${px}px — too small to read as anything`);
  }
});

test("bevel reaches the descendants, not just the root", () => {
  // `corner-shape` is a box property and box properties DO NOT INHERIT. Set on
  // the root alone it styled the root and nothing inside it, so the whole page
  // rendered as ordinary rounded corners — which looks exactly like the browser
  // not supporting the property. Found by rendering it; nothing else could tell.
  const css = cornerCss({ ...THEMES[THEME_NAMES[0]], corner: "bevel", radius: "0.875rem" });
  assert.match(css, /corner-shape: bevel/);
  assert.match(css, /body \*|,\s*\*/, "bevel must select descendants or it reaches one element");
  // And it must still set a radius — corner-shape has nothing to act on without one.
  assert.match(css, /--radius: 0\.875rem/);
});

test("the shortlist is usable as a tool enum", () => {
  assert.ok(THEME_NAMES.length >= 1);
  for (const n of THEME_NAMES) assert.match(n, /^[a-z][a-z0-9-]*$/, `${n} is not enum-safe`);
  const list = shortlistForPrompt();
  for (const n of THEME_NAMES) assert.ok(list.includes(n));
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
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    const px = parseFloat(t.radius) * (t.radius.endsWith("rem") ? 16 : 1);
    // ~10px is shadcn's default and every SaaS product on earth. A theme landing
    // there has not chosen a radius, it has failed to choose one.
    assert.ok(px <= 6 || px >= 14, `${name}: radius ${px}px sits in the unconsidered middle`);
    // An accent brighter than this reads as a startup, not as a trade.
    for (const mode of ["light", "dark"]) {
      assert.ok(t[mode].accent[1] <= 0.15,
        `${name}/${mode}: accent chroma ${t[mode].accent[1]} is louder than the set allows`);
    }
  }
});
