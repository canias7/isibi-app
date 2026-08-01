# Component gaps — what the layout families need that the kit lacks

Handoff for a build session. Context: `builder/LAYOUTS.md` is the owner's layout
taxonomy (26 families). The kit at `builder/lovable/template/src/components/ui/`
(1,046 components) was audited against every family's signature layout on
2026-08-01: **21 of 24 families were fully backed when surveyed; 25 `store` and 26 `workspace` landed fully backed the same day.** The gaps below are the
components whose absence makes a family unbuildable or badly approximated.

Checked before listing — these are NOT gaps, so do not rebuild them:
`donation-card` (presets + amount + progress), `seat-map`, `age-gate`,
`store-locator`, `tracking-input` (with carrier detection), `bento-grid`,
`agenda-list`, `waitlist-form` (a BOOKING waitlist — email me if a slot frees —
not a newsletter capture), `ticket-card` (an ISSUED ticket, not a tier picker),
`blur-sensitive` (sensitive-image blur, not a paywall), `video-embed`
(click-to-play YouTube/Vimeo, not a background loop).

## House rules (the kit's own, hold to them)

- **Prop-driven, not children-only** — take the shape of the data a site has.
- **Owner-supplied media is guarded** — render a clean fallback, never a broken
  image (see `safe-image`, `team-grid`).
- **No new npm dependencies. No brand artwork** (the `payment-methods`
  precedent: names, never logos).
- **Monochrome discipline**: state is fill/weight/label, never colour alone.
- **Reduced motion respected** wherever anything moves (see `marquee`,
  `reveal`).
- **Render every one in a browser before committing** — compiling is not
  working; this repo has proven that repeatedly.
- After adding files: insert each name into `UI_COMPONENTS` in
  `builder/page-gen.mjs` **in sorted position without rewrapping the array**
  (it carries interleaved comments that a rewrap deletes), then run
  `node builder/gen-component-api.mjs` and `node builder/gen-components-doc.mjs`,
  then `node --test test/*.test.mjs` — the drift guards check all three layers.

---

## Tier 1 — family signatures, nothing close exists

### `audience-switch`
Unlocks: **13 Institutional** and the **two-sided marketplace** mold-breaker.
"I am a: prospective student / current / alumni" — a prominent segmented
switcher near the top that swaps which link set (or content node) shows.
Props: `audiences: { id, label, content?: ReactNode, links?: {label, href}[] }[]`,
controlled or internal state, remembered in `localStorage` so a returning
visitor lands on their side. Real buttons with `aria-pressed`, not styled divs.
Nearby: `toggle-group` (the control), `nav-list` (the payload).

### `video-hero`
Unlocks: **14 Media-heavy / immersive**.
Full-bleed muted looping background video with a title/CTA overlay. Must:
`muted playsInline loop autoPlay`, a `poster` (owner-supplied, guarded), pause
the loop entirely under `prefers-reduced-motion` and show the poster instead,
and never block text legibility (a scrim layer over the video, under the type).
Self-hosted `src` URL — this is NOT `video-embed` (which is a privacy-preserving
YouTube click-to-play and stays as it is).
Nearby: `hero` (the overlay layout), `safe-image` (the poster guard).

### `paywall`
Unlocks: **18 Membership-gated** (paywalled publication, private community).
The visible half of a metered article: children render with a fade-out mask
after N pixels or paragraphs, then a card — "You've read your free article" —
with subscribe/sign-in actions. Props: `preview` (children), `height?`,
`title`, `actions: {label, href}[]`. Pure presentation: it does NOT enforce
anything (enforcement is the data layer's job); say so in the comment, because
a component that looks like security and isn't must announce it.
Nearby: `edge-fade` (the mask trick), `plan-card` / `login-form` (the actions).

### `email-capture`
Unlocks: **4 Feed / archive-first** (newsletter variant; CTA "Subscribe").
A one-field subscribe band: email input + button on one line, collapsing
stacked on mobile, `autoComplete="email" inputMode="email"`, a success line in
place of the form after submit (no toast dependency), and one error sentence.
Props: `title?, note?, onSubmit(email), busy?, done?`. Distinct from
`waitlist-form`, which is booking-flavoured and says so in its copy.
Nearby: `form-row`, `busy-button`.

---

## Tier 2 — approximable today, worth having

### `ticket-tiers`
**6 Conversion-single-purpose** (events). Tier rows — name, what it includes,
price, quantity stepper — with a computed total line and one primary action.
Sold-out tiers stay visible, struck through with a label (same discipline as
`availability-grid`). Nearby: `pricing-table` (display-only), `quantity-input`,
`money`.

### `install-command`
**11 Documentation-first** (OSS/API). The one-liner hero: `npm i thing` in a
mono block with a copy button and a tab per package manager (npm/pnpm/yarn/bun
as TEXT tabs). Nearby: `code-block`, `copy-button`, `sdk-tabs` (which is
multi-language code examples — close, but this is one command, zero chrome).

### `episode-row`
**4 Feed-first** (podcast). Number, title, date, duration, inline play toggle
wired to one shared `audio-player` instance (two rows playing at once is the
bug to design out — accept a `playing` id + `onPlay` from the page).
Nearby: `audio-player`, `list-row`.

### `calculator-card`
**12 Data-first** (pricing calculator as a landing page). 2–4 labelled inputs
(sliders or steppers) → one live `big-number` result, computed by a
caller-supplied `compute(values)` — the component owns layout and formatting,
never the formula. Nearby: `slider-input`, `stepper-input`, `big-number`,
`money`.

### `curriculum-path`
**21 Educational**. An ordered path of milestones — done / current / locked —
with progress carried by fill and a written state label, never colour alone.
Props: `steps: {title, detail?, state: "done"|"current"|"locked"}[]`.
Nearby: `steps` (generic), `chapter-list` (flat), `progress-ring`.

---

## Tier 3 — niche; build only if the family gets real demand

### `tour-dates`
**10 Narrative-first** (musician). Date / city / venue / tickets-href rows.
`event-card` approximates it today; this is the denser table form.

### `bid-box`
**17 Time-sensitive** (auction). Current bid, ends-in countdown, minimum
increment, amount input + bid action. Presentation only — settlement is a
backend question this platform hasn't answered; don't imply it has.
Nearby: `countdown`, `amount-input`, `live-badge`.

### `store-badges`
**5 Product-first** (mobile app). App Store / Google Play download buttons.
**Decision attached:** official badges are brand artwork the kit refuses on
principle (`payment-methods` precedent). If built, TEXT-styled buttons — "App
Store" / "Google Play" as words — which several owners will find plain. The
alternative is to keep refusing; either is defensible, neither is "we forgot".

---

## Explicitly fine without new components

Checked family by family: booking (1), inventory/search (2), evidence (3),
product (5, minus store-badges), trust (7), menu (8), location (9), docs (11,
minus install-command), data (12, minus calculator-card — the 882 chart
primitives carry this family), immersive (14, minus video-hero), transactional
(15 — even 404/maintenance micro-layouts exist), regulated (16 — `age-gate`,
`terms-block`, `consent-checkbox` all exist), industrial (19), recruiting (20),
local & civic (22), personal (23), AI-native (24 — the deepest-covered family
in the kit), and all 8 structural variants (`bento-grid`, `sidebar-layout`,
`split-view`, `full-bleed`, `card-grid`, `snap-sections` all exist).
