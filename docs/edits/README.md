# fretwork-1 — what each queued edit did, as screenshots

Every image here is the live site rendered headless right after the edit
landed (the page's own HTML and stylesheet; photos, fonts and scripts are not
loaded, so placeholders show where pictures go, the 3D canvas is a grey box,
and the header wordmark shows as its alt text). Read top to bottom: each
edit is applied on top of the ones before it.

**Rows before 08 have blank middles.** The kit reveals sections on scroll, and
a headless full-page capture leaves them at opacity 0 — an instrument
artefact this repo has recorded before, not the site. From row 08 the capture
disables the reveal first, so every section shows.

| # | When | Edit(s) | File |
|---|---|---|---|
| 00 | 2026-08-31 | the site as built, before any edit: one page, “Sheffield Beginner Guitar”, letterpress theme, the eight chord diagrams. Rendered from a capture of the served page taken that afternoon. | `00-before-any-edit.png` |
| 01 | 2026-09-01 19:10 | the paid canary: `css` — "make the main call-to-action button background a deeper green". First attempt targeted the header, matched nothing; the correction round re-targeted the closing band. | `01-canary-full-page.png`, `01-canary-cta-band.png` |
| 02 | 2026-09-01 20:26–20:50 | sweep one: `css` (heading dark red), `brand` (renamed Crookes Guitar School), `favicon` (green G — not visible in a page shot), `lang` (Welsh), `langs` (French and Spanish; the header grew a switch). `theme` was a no-change (already letterpress); `description` and `wordmark` hit a container roll and were refunded. | `02-sweep1-brand-css-lang-langs-favicon.png` |
| 03 | 2026-09-01 22:37 | sweep three: `theme` → noir. Greyscale, black buttons; the dark-red heading from `css` survives on top. | `03-sweep3-theme-noir.png` |

| 04 | 2026-09-01 23:09–23:14 | sweep four (old harness, from main): `description` → the meta description reads "Beginner guitar lessons in Crookes, Sheffield. First lesson free." — and `wordmark` → the header name became a drawn mark served as `/logo.svg`. The harness called the wordmark a lie for looking for an inline svg; the site was right. | `04-sweep4-description-wordmark.png`, `05-sweep4-wordmark-logo.svg` |

| 05 | 2026-09-01 23:49–23:54 | sweep five (old harness, from main): `behavior` was picked as `action` by the lane picker and refused honestly by the nav rung (refunded). `qr` → `/qr.svg` is served and decodes to `tel:01144960123` — correct — but the page references it nowhere, so the page shot is unchanged from row 04. Filed: the qr lane bakes a code nothing places. | `06-sweep5-qr.png`, `06-sweep5-qr.svg` |

| 06 | 2026-09-02 00:02 | sweep five: `three` → a WebGL canvas with a 3D pick beneath the hero, via the page rung. The headless shot cannot run WebGL, so the canvas area is blank here; on the live site it draws. Cost 6. | `07-sweep5-three.png` |

| 07 | 2026-09-02 00:05 | sweep five: `shape` → the price list moved above the numbered steps, via the page rung. First capture with every section visible. Cost 3. | `08-sweep5-shape.png` |

| 08 | 2026-09-02 00:10 | sweep five: `components` → a new FAQ accordion with three questions, via the page rung. Cost 5. | `09-sweep5-components.png` |

| 09 | 2026-09-02 00:15 | sweep five: `purpose` → "make the page about group lessons for adults rather than one-to-one". The hero copy, the price list (group lesson £30, small group of three £18, first lesson free "in a group") and the closing band were all rewritten toward groups, via the page rung. Cost 7. | `10-sweep5-purpose.png` |

| 10 | 2026-09-02 01:53 | sweep six (the whole lane sweep again, run 8, dispatched on the lane harness by mistake): every look lane answered "already looks like that" for 1 credit and published nothing; `tsx` → the six string names E A D G B E in a row under the hero, via the page rung. On sweep five this lane died because the model wrote a separate part file the edit path never sent; this time it kept the component in the page. Cost 7. | `11-sweep8-tsx.png` |

| 11 | 2026-09-02 02:52 | the gap sweep (run 10, harness `gap`): `text` → "change the words 'Get your first lesson free' to 'Your first lesson is free'", sent through the real intent router, which picked the `text` rung. All four occurrences changed (header button, hero button, closing band, footer), published in 2.5 minutes. Cost 3: routing 2, the rung 1. | `12-gap-text.png` (the runner's own copy is `gap-01-text.png`) |

| 12 | 2026-09-02 02:54 | the gap sweep (run 10): `logo` → "use this picture as the logo in the header", with a striped test PNG attached. **The site did not change, and not for the reason the reply gave.** The lane stored the upload and the container compiled fine (23 files), then the queue's publish gate refused: the logo lane makes no model call, so no reserve was ever placed and the job's billing stayed `none`, which `edit_may_publish` reads as `unbilled`. The customer was told "That didn't compile". Cost 0. Filed. The picture is the unchanged site, kept by the runner. | `gap-02-logo.png` |

`pages` ("Add a pricing page") ended sweep five: the verb lane read `add` and pointed at the addon route, which the queue does not run — cost 0, site untouched, so there is no screenshot. `slug` and `kind` have not run; both are held back until the owner names them.
