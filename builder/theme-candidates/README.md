# Theme candidates — swatches, not shipped themes

Five batches of owner-requested theme candidates (471 total), rendered as
swatches for the owner to shortlist from. **Nothing here is wired into any
build**: `site-theme.mjs` never imports this directory, and a theme only
ships by being promoted into `THEMES` there — with both modes rendered on
real reference apps, tests, and any `needs` capability built.

- `batch-1.mjs` — the owner's 81-item list minus the 8 structural items
  (those are the layout layer) and the 2 already shipped. 71 entries.
- `batch-2.mjs` — the second hundred (materials · places · eras · land ·
  trades · media · digital · food · civic · moods).
- `batch-3.mjs` — the third hundred (music · sport · study · craft ·
  seasons · travel · fashion · story · office · world).
- `batch-4.mjs` — the fourth hundred (americana · stage · games · water ·
  sky · childhood · underground · post · shopfront · patina).
- `batch-5.mjs` — the fifth hundred (garden · kitchen · hobby · ritual ·
  architecture · weather · mechanism · street · antiquity · frontier).

Kept in the repo because the scratchpad is ephemeral — a container recycle
deleted all three once (2026-08-01) and they had to be recovered from the
session transcript. `needs:` on an entry records an engine capability the
full look requires (texture, glow, ornament, a missing font genre); the
swatch still renders palette, type and components honestly without it.
