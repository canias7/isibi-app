# fretwork-1 — what each queued edit did, as screenshots

Every image here is the live site rendered headless right after the edit
landed (the page's own HTML and stylesheet; photos and web fonts are not
loaded, so placeholders show where pictures go). Read top to bottom: each
edit is applied on top of the ones before it.

| # | When | Edit(s) | File |
|---|---|---|---|
| 01 | 2026-09-01 19:10 | the paid canary: `css` — "make the main call-to-action button background a deeper green". First attempt targeted the header, matched nothing; the correction round re-targeted the closing band. | `01-canary-full-page.png`, `01-canary-cta-band.png` |
| 02 | 2026-09-01 20:26–20:50 | sweep one: `css` (heading dark red), `brand` (renamed Crookes Guitar School), `favicon` (green G — not visible in a page shot), `lang` (Welsh), `langs` (French and Spanish; the header grew a switch). `theme` was a no-change (already letterpress); `description` and `wordmark` hit a container roll and were refunded. | `02-sweep1-brand-css-lang-langs-favicon.png` |
| 03 | 2026-09-01 22:37 | sweep three: `theme` → noir. Greyscale, black buttons; the dark-red heading from `css` survives on top. | `03-sweep3-theme-noir.png` |

| 04 | 2026-09-01 23:09–23:14 | sweep four (old harness, from main): `description` → the meta description reads "Beginner guitar lessons in Crookes, Sheffield. First lesson free." — and `wordmark` → the header name became a drawn mark served as `/logo.svg`. The harness called the wordmark a lie for looking for an inline svg; the site was right. | `04-sweep4-description-wordmark.png`, `05-sweep4-wordmark-logo.svg` |

| 05 | 2026-09-01 23:49–23:54 | sweep five (old harness, from main): `behavior` was picked as `action` by the lane picker and refused honestly by the nav rung (refunded). `qr` → `/qr.svg` is served and decodes to `tel:01144960123` — correct — but the page references it nowhere, so the page shot is unchanged from row 04. Filed: the qr lane bakes a code nothing places. | `06-sweep5-qr.png`, `06-sweep5-qr.svg` |

Later rows are added as the remaining lanes run.
