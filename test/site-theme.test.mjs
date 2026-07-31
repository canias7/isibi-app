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
