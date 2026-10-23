# 2026-10-23 — Design decisions: contrast probe, button contrast, font weight

Branch `decide-g-design` from `main` `a8fbfe876`. Three builder-audit findings
the round 2 records left for the owner (`2026-10-23-r2-g3.md` for #207 and
#208, `2026-10-23-r1-g7.md` for #149), fixed with the owner's chosen options.
Offline only: nothing paid, no model calls, no live writes. Not merged, not
deployed.

## 1. #208 (A34-3) — the contrast probe measures page text against the paper

- **Before**: `probe()`'s `solidBehind` skipped any element whose ancestor
  chain met a translucent background. A world or glass theme re-declares
  `--background` as its paper at alpha 0.35–0.88 and every page sits inside
  site-chrome's `bg-background`, so page text was never measured on 467 of 500
  themes (90 of the 100 shortlisted).
- **Now** (`builder/site-render.mjs`): the probe reads the root's
  `--background`, makes it opaque, and a translucent layer whose colour is
  that paper (within 2 of 255 per channel) is measured against it. Any other
  translucent layer is still skipped, as before. A page with no
  `--background` has no paper.
- **Tests**: 6 new cases in `test/integration/contrast-cases.mjs` (8 → 14
  pages, 16 → 28 checks; site build's "contrast-cases 16" count becomes 28): dark copy on opened
  paper clean; faint copy on opened paper reported, light and dark; faint copy
  on a black/50 layer and on a layer one step off the paper (red 60 lower)
  still skipped; dark copy on a translucent layer with no theme paper clean.
  Red on the old probe: 2 fail (the two "faint copy on opened paper" cases).
  28 / 28 green on the new one.
- **Sweep**: 6 mutants. Killed: isPaper always false, return null instead of
  the paper, isPaper always true, the empty-variable guard removed, the red
  tolerance widened to 200. Survived: keeping the paper's alpha (equivalent:
  `lum` ignores alpha). Comment-only control survived.
- Not done (out of the owner's option): counting `scanned` only after a
  background resolved (the audit's second suggestion).

## 2. #207 (A34-2) — every theme's button label clears 4.5:1

- **Before**: 115 of 500 registry themes had `primary-foreground` on
  `primary` below 4.5:1 in light mode (dark: 0), 21 of them shortlisted;
  minimum vaporwave 3.47. Measured the same from `paletteFor` and from the
  final `:root` tokens of `themeCss`.
- **Now**: each of the 115 themes' **light accent lightness only** moved by
  the smallest 0.001 step (either direction, whichever is nearer) at which
  `foregroundFor` clears 4.5:1. Chroma, hue, paper, ink, dark mode and every
  other axis unchanged. Files: `builder/theme-candidates/batch-1..6.mjs`.
  - Size of the moves (OKLCH L): mean 0.0187, median 0.016, max 0.065
    (vaporwave 0.62 → 0.555); 43 moved ≤ 0.01, 23 by 0.01–0.02, 43 by
    0.02–0.04, 6 by more. 79 darker, 36 lighter. In 2 themes the label
    colour flips (ink ↔ paper) because the darker accent now suits the paper
    (vaporwave is one).
  - Shortlisted 21: mid-century 0.65→0.651; jewellery 0.55→0.548; sticker
    0.6→0.618; paperback 0.6→0.608; daybreak 0.6→0.617; orchestra
    0.55→0.549; harvest 0.58→0.546; frost 0.55→0.549; sleeper-train
    0.55→0.549; perfumery 0.55→0.548; corner-office 0.55→0.548; riad
    0.58→0.613; drive-in 0.58→0.558; ballet 0.6→0.562; casino 0.55→0.543;
    cheesemonger 0.58→0.545; ham-radio 0.55→0.545; midnight-snack 0.6→0.62;
    heatwave 0.58→0.566; gramophone 0.55→0.54; impressionist 0.58→0.552.
  - New minimum: 4.500 light (by construction, the smallest step), 4.598
    dark. A browser rounds to 8-bit sRGB, so a rendered reading may differ by
    about ±0.02.
- `builder/site-seeds.mjs`'s calibration note corrected (button min 4.50, and
  the "a button label is large text" rationale replaced: the kit Button is
  `text-sm font-medium`, normal text, 4.5:1). The floor of 3 is unchanged.
- **Tests**: new registry-wide guard in `test/site-theme-registry.test.mjs`:
  all 500 themes, both modes, `primary` and `sidebar-primary` pairs in the
  palette, and the shipped css's final `:root` pair; asserts it checked every
  theme. Red on the old theme data.
- **Sweep**: old data (red) killed; ballet back to 0.6 killed; ballet one
  step short (0.563) killed, which shows the move is the smallest; the loop
  emptied killed. Test-side weakenings (threshold 3.4, light mode skipped)
  survive on the fixed data, which passes either way. Comment-only control
  survived.
- **Screenshots**: `themes-207-before-after.png` (vaporwave, ballet, riad,
  claymorphism; light mode, before | after) in the session scratchpad's
  `shots-design/`.

## 3. #149 (A20-3) — a fetched font declares its real weight

- **Before**: `fetchSiteFonts` downloads one static file (the 400, or the
  lexically first weight) and `fontCss` declared it `font-weight:100 900`.
- **Now**: `fetchSiteFonts` records the weight it fetched on the family
  (`f.weight`); `fontWeightsOf(cssRead.fonts, fontFiles)` puts it on both
  container payloads as `fontWeights`; `writeFonts` passes it to `fontCss`,
  which declares `font-weight:<w>;`. A weight it was not told (an older
  Worker during the roll, a key that is not `100`–`900`) is left undeclared
  (the browser reads `normal`), never the range and never a guess.
- Not done (outside the owner's option): fetching more weights or a variable
  file, and non-Latin subsets. A heading asking for 700 on a 400-only face now
  gets the browser's synthetic bold.
- **Tests** (`test/site-fonts.test.mjs`, 4 new, 2 wiring regexes updated):
  the real `fetchSiteFonts` and `fontWeightsOf` lifted from worker.js under a
  stubbed network, 400 and 700-only variant sets, through the real `fontCss`;
  unknown, non-string, non-weight and inherited weights undeclared;
  `fontWeightsOf` cases; the payload, container and `fontCss` wiring. Red on
  the old code: 5 of 32 fail.
- **Sweep**: 8 mutants, 8 killed (range restored, any string accepted,
  inherited key read, weight never recorded, files ignored, any weight
  accepted, one payload dropping it, the container dropping it). Comment-only
  control survived.
- `builder/build-server.mjs` and `builder/site-fonts.mjs` are container
  inputs, so the image will roll on deploy.

## Suites

- Affected files: theme files (18 files, 708 tests), site-render users (14
  files, 699), fonts (4 files, 119), all green. `contrast-cases.mjs` 28 / 28.
- `theme-seam.mjs` could not run here (the template has no `node_modules` in
  this checkout); it reads the css seam, not colour values.
- Full unit suite: see the commit message of the records commit.
