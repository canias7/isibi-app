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

| 13 | 2026-09-02 | the tab icon the `favicon` lane drew, read from the live site: a dark green circle with a white G. Kept here because a page capture cannot show it. | `13-favicon-green-g.svg` |

| 14 | 2026-09-02 12:41 | the seventh sweep (run 11, the fixed lanes): `qr` → the code is now PLACED, not only served: a 120px figure under the contact band with its caption "Scan to call and book". The look step answered "already so" (the code was stored by sweep five) and the new page step behind it published 25 files to show it. The harness read the site before the edge had the new build and called it "already so"; the site is right. Cost 5. The crop has the code inlined so the headless capture can draw it. | `14-sweep7-qr.png`, `14-sweep7-qr-section.png` |

| 15 | 2026-09-02 12:44 | `action` → the header button reads "Book a free lesson", on the computed button that doubled the file twice before. **But the link was lost**: it pointed at `tel:+441144960123` and now points at `/`. The rung's digest told the model "(there is no button)" because the words are computed, so it wrote a new one and invented the link. The harness called it a lie, for the wrong reason (its selector); the verdict was right. Cost 2. Fixed in the tree: the digest now states each half as it is. | `15-sweep7-action.png` |

Earlier in run 11: `wordmark` timed out on its Grok call (the 4-minute cap on a lane call — nothing charged, logo unchanged) and `behavior` was routed to its own lane for the first time and answered "already so" for an accordion that already closes the others. `tsx`, `kind` and `slug` did not run: the sweep stops on a LIE.

| 16 | 2026-09-02 14:49 | run 12 (lanes `all`, after "add goes to addon"): `qr` as an EDIT — the caption changed to "Scan to ring and book"; the code itself is untouched (same 2,290 bytes, same number). The first proof of the qr lane editing what the site has rather than making one. Cost 1. | `16-sweep8-qr-caption.png` |

| 17 | 2026-09-02 15:25 | run 13 (`action,tsx,three,kind,slug`, after the Grok top-up): `action` with both halves named — "Book a free lesson", ringing `tel:0114 496 0123`. The dial link run 11 sent to `/` is back, and the button renders as a `site-link` again. Cost 1. The harness then called this a lie off a stale read (one probe without the build header ended its edge wait at once) and stopped the run; the site was right, and the wait is fixed. | `17-sweep9-action-link.png` |

| 18 | 2026-09-02 15:59 | run 14 (`tsx,three,kind,slug`): `tsx` as an EDIT of the page's own code — "Fingering" now sits above every one of the eight chord diagrams. The page file came back byte-identical; only the `chord-diagram` component changed, which is the part-only case the rung used to call "no change" (run 12). Cost 8. | `18-sweep10-tsx-fingering.png` |

| 19 | 2026-09-02 16:03 | run 14: `three` — "make the 3D pick spin half as fast". Published (build `mtka3ufv` → `mtka8mgq`, 25 files, the canvas kept, the page file again byte-identical: the scene is a component). Motion is not observable headless, so there is no picture of it. The harness's own check then called this a lie because the reply listed no changed PAGE, and stopped the run before `kind` and `slug`; the check now counts a component-only publish. Cost 4. | (no capture) |

| 20 | 2026-09-02 17:12 | run 16: `kind` → "Turn this into a booking tool rather than a shopfront". The lane escalated to a rebuild in ten seconds for 0, and the harness followed it to the build route and watched for 18 minutes. The site came back as a TOOL: "Book a guitar lesson" at the top, a week strip and a month calendar with booked days (seed rows — this build provisioned the site's first database, two tables), a booking form, opening hours, then the eight chord diagrams and the QR with its caption. **Kept from the stored design**: the name, the description, the favicon, the three languages, the QR and the uploaded header logo. **Gone with the page**: the 3D pick (drawn by the page rung, never a design field), "Fingering" (the chord-diagram part was rewritten), the header button's words and dial link (the action lane wrote source, not design), the hero and its prose (a tool has no hero). The kit's availability calendar shipped with its own legend about "the night beginning on that date" and "the whole property" — holiday-let copy on a guitar diary. Cost 17 (225 → 208), build `mtka8mgq` → `mtkckb7z`. | `20-run16-kind-booking-tool.png` |

| 21 | 2026-09-02 17:39 | `slug` did not run in run 16 (the lanes box said `kind,slug.` and the harness dropped the name it did not know — fixed, a stranger refuses). Run 17 ran it alone: **the rename landed on the addresses** — `crookes-guitar.gofarther.app` answers 200, `fretwork-1.gofarther.app` 301s to it, alias rows old-then-new — **the queued job was lost** (the consumer died inside the container's roll from a push twelve minutes earlier; 1 credit refunded; harness `failed`, run green — fixed, `failed` is red) **and the head at the new address still named the old one**, which the lost publish did not cause: the spine baked the canonical from the storage slug at both publish sites, and the rename's plan for the head was that republish. Fixed both ways; the live head is rebaked by a free platform republish after the deploy. A head change has no picture. | (no capture) |

| 22 | 2026-09-02 18:22 | run 18: `slug` again, asking the way back to `fretwork-1`. Refused in 13 seconds: "That name is already taken by another site" — the storage name is a site, this one, and the site check did not know whose. Fixed in the tree; refunded; the run went red, as a failed lane now does. | (no capture) |

| 23 | 2026-09-02 18:54 | run 19: `slug` — **PROVEN END TO END.** "Change the site address to "fretwork-1"" (the harness flips the target): the site renamed back in 16 seconds for 1 credit, `fretwork-1.gofarther.app` answers 200 with its own canonical and og:url, `crookes-guitar.gofarther.app` 301s to it, and no container was involved. The harness still called it a lie, its fifth false alarm today: it read the old address 20 seconds after the rename, when an edge still holding the alias row it had cached before the rename served the site instead of redirecting. That row lives five minutes per isolate and only the lane's own isolate forgets at once; two minutes later the redirect was there. The wait now holds for both addresses up to that lifetime. A rename has no picture; the head is the evidence. | (no capture) |

`pages` ("Add a pricing page") ended sweep five: the verb lane read `add` and pointed at the addon route, which the queue does not run — cost 0, site untouched, so there is no screenshot. `kind` ran in run 16 (row 20). `slug` has not run and is held back until the owner names it — typed exactly, since row 21.
