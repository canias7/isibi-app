# Audit fixes 35–37: fonts the model names now render (2026-10-22)

A19-1, A20-1, A20-2 from `docs/audits/2026-10-17-builder-audit.md`. Offline; nothing spent, nothing deployed.

## Re-verified on the current code first

All three were still real at `3fda8174`:

- `fontsIn(':root{--font-sans:"Lora", Georgia, serif}')` (the css tool's own example) gave `{ids:[], missing:[]}`; so did `--font-heading:"Fraunces"`, `font:700 2rem/1.1 "Fraunces",serif` and `var(--x,"Fraunces")`. A page-scoped `--font-heading:"Caveat"` beside a root `"Lora"` gave `["lora"]` only.
- `h1{font-family:"Playfair Display",...}` resolved to `playfair-display` and the container imported `@fontsource-variable/playfair-display`, whose faces are registered only as "Playfair Display Variable". The sheet still said "Playfair Display", so no face matched. `Baskerville` resolved to the fetched `baskervville`, declared as "Baskervville". Nothing anywhere renamed a family.

## The fix

- **Names reconciled in the stack** (`aliasFonts`, `builder/site-freecss.mjs`; called by `writeCss` in `builder/build-server.mjs`). After each family name `fontsIn` resolved, the registered family is inserted: `"Playfair Display", "Playfair Display Variable", Georgia, serif`. The model's own spelling stays first and its fallbacks stay after. It applies to every stack shape below. It runs only where the sheet is written into the build, so the stored sheet stays the model's words. It is idempotent and leaves a stack that already names the registered face alone.
  - Why not `@font-face` aliases: an installed package's files are hashed by Vite at build time, so an alias written beforehand could not name them, and for fetched files it would add a second download.
- **`fontsIn` reads every shape** (a shared `stackSpans` walk):
  - `--font-sans` and `--font-heading` are always stacks, because the template consumes them;
  - every declaration of a stack property counts (page scopes too);
  - the family half of a `font:` shorthand (after the size and line-height; `font: inherit` names nothing);
  - a `var(--x, "Fallback")` fallback.
- **What still cannot be found is said.** A name that resolves nowhere was already reported (`missingFonts`, the "not ones we can host" note), and now that covers the new shapes. New: a fetched family whose file never reached the container gets a `writeFonts` note ("could not be downloaded, so they fall back to a system font").
- `readCss` also returns `fontSpellings` (name, id, registered family).

## Checks

- **Red**: the 6 cases in `test/audit-fonts.test.mjs` all fail on the old module (0 pass, 6 fail).
- **Guard updated**: `test/site-freecss.test.mjs`'s write-line spelling now names `aliasFonts(report.css, report.fontSpellings)`. The order assertions (the guards before the model's sheet) are unchanged.
- **Visual**: a headless Chromium page that loads the real `@fontsource-variable/playfair-display` CSS.
  - Before: the browser loaded no face, and the heading is the serif fallback (`fonts-before.png`).
  - After: it loaded "Playfair Display Variable" (`fonts-after.png`).
  - Both images are in the session scratchpad.
- **Suite**: see the commit message and the owner-notes entry.

## Container image

`builder/site-freecss.mjs` and `builder/build-server.mjs` are both copied by the root `Dockerfile` (lines 136 and 169), so this change **rolls the image** when it is deployed.

## Not in this fix

- A20-3 (a fetched face is one static 400 weight, Latin only) is still open.
- A20-4 (the shortest reverse prefix wins, e.g. "Sofia Pro" → `sofia`) is still open. With names now reconciled, those substitutes become visible, as the audit predicted.
