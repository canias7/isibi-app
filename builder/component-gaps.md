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

## The second twenty's gaps (2026-08-02)

Twenty families were added on 2026-08-02 and all twenty are `ready: false`
until the components below land. That is the readiness mechanism working as
designed, not a backlog: `familiesForPrompt` refuses to offer a family whose
signature component is missing, so none of these twenty can be chosen by the
designer yet. Land a component and the suite goes RED until its family's flag
is flipped and the `wants` entry moved into `components`.

House rules above still hold — prop-driven, guarded media, no new npm
dependencies, monochrome discipline.

- **`quote-request`** — *tradesman*. a job description with photographs attached — the trade's real intake form, not a contact box
- **`donation-tiers`** — *charity*. preset amounts with what each buys, one-off beside monthly, and a free-entry field
- **`impact-stat`** — *charity*. one number with the sentence that makes it mean something — never a number alone
- **`service-times`** — *church*. this week's meetings with the one-off changes flagged, not a static weekly grid
- **`fixture-list`** — *sports-club*. next fixture and last result as one scannable block, home/away marked without colour alone
- **`league-table`** — *sports-club*. position, played, points — with the club's own row marked by weight, not a tint
- **`lineup-grid`** — *festival*. acts by day and stage, with clashes visible; the one thing a festival page is for
- **`capacity-table`** — *venue*. the same room at several layouts — seated, standing, cabaret — because the number changes with each
- **`date-enquiry`** — *venue*. a date and a headcount, answered with free/taken/ask, not a generic contact form
- **`availability-calendar`** — *holiday-let*. a month of nights with taken ones struck through, and the rate per night on the free ones
- **`vehicle-lookup`** — *garage*. a registration box that resolves to a vehicle and drives every price after it
- **`arrangement-steps`** — *funeral-director*. what happens next, in plain sentences, with no euphemism and no progress theatre
- **`session-table`** — *nursery*. sessions by day with hours and places left; funded hours shown as what they cover, not as a footnote
- **`fee-table`** — *nursery*. fees by age band and session, with the funded deduction applied rather than explained
- **`practitioner-card`** — *medical*. name, registration number and what they actually treat — the number is the trust signal
- **`triage-banner`** — *medical*. the urgent instruction, above everything, unmissable and never dismissible
- **`exhibition-card`** — *gallery*. one show: title, dates, the room, and whether it is on now, ended or upcoming
- **`tap-list`** — *brewery*. what is pouring, with ABV and style; a producer's stock changes weekly and that IS the news
- **`produce-calendar`** — *farm-shop*. the year by month, so February explains itself without an apology
- **`story-lead`** — *news*. the lead story at lead size — picture, standfirst, byline — distinct from every card below it
- **`frequency-picker`** — *cleaner*. weekly / fortnightly / monthly priced side by side, because recurring is the product
- **`seller-card`** — *marketplace*. a seller as a person: what they make, how long, and their own rating
- **`unit-card`** — *storage*. a size with its price and a live free/taken state, plus what actually fits in it
- **`size-guide`** — *storage*. volumes expressed in furniture rather than square feet, which nobody can picture
- **`subject-list`** — *tutor*. subjects by level with the rate on each, since the rate changes with the level
- **`repair-status`** — *repair-shop*. where a repair is, from its ticket number — received, diagnosed, waiting on a part, ready
- **`device-picker`** — *repair-shop*. pick the make and model; every price and turnaround after it depends on the answer
- **`quote-calculator`** — *removals*. rooms times distance times date, answering with a RANGE — the trade's whole friction is that nobody publishes a number

## Tier-1 gaps — the shapes no family fitted (2026-08-02)

A gap audit against common UK business types found six business SHAPES with no
family that fits. These are the components those families need.

- **`rate-card`** — *hire, home-care*. the same thing priced by PERIOD rather than once — a day, three days, a week, a month — optionally across bands (weekday / weekend / bank holiday). A single headline rate is a quote nobody ever gets, and the break-even between periods is the thing customers work out wrong
- **`fare-quote`** — *taxi*. from and to, answered with a FIXED price on the page — what is included (waiting time, luggage, the meet-and-greet) and what would change it, before anybody rings
- **`inspection-rating`** — *care-home, home-care*. a regulator's rating with the DATE it was given and a link to the report — CQC, Ofsted, food hygiene. A rating with no date is a rating from any year at all
- **`facility-status`** — *facility*. what is free RIGHT NOW and when the next slot is, per activity. A leisure centre's visitor is asking "can I get on today", and every one of these sites answers "we exist"
- **`admission-prices`** — *attraction*. adult, child, concession and family, with the family ticket's SAVING computed against buying the same people separately — the sum every attraction makes its visitors do and most of them get wrong
- **`entry-requirements`** — *pet-boarding*. the things that must be in place BEFORE arrival, with the deadline on each and which are law rather than house rules. A kennel cough jab needed fourteen days ahead is useless discovered the night before

## Tier-2 gaps — five more shapes, five more families (2026-08-02)

- **`pitch-types`** — *campsite*. a pitch type with what it PHYSICALLY takes: the size, the longest unit that fits, hookup, hardstanding, and the nightly rate. A family in a 7.5m motorhome is asking one question, and every campsite site answers "we are in a lovely valley"
- **`house-rules`** — *campsite, bed-and-breakfast*. the arrival and departure WINDOWS at weight, then the conduct rules, each marked firm or flexible. A gate locked at 22:00 is the single thing that strands an arriving guest, and it is always in a PDF
- **`direct-saving`** — *bed-and-breakfast*. the same stay priced here against the platform, with the saving COMPUTED and the date the platform price was checked. "Best price guaranteed" is a claim; £132 there, £115 here, checked on the 28th, is a number
- **`counter-services`** — *local-shop*. what you can actually do at the counter, each with its OWN hours where they differ from the shop's. A post office counter shuts at 17:30 while the shop is open until 22:00 and no shop publishes that
- **`trade-terms`** — *wholesaler*. minimum order, carriage-paid threshold, payment terms, delivery days and whether an account is required — the four facts that decide whether a buyer qualifies, before any product. Every trade site hides them behind a login
- **`investment-table`** — *franchise-sales*. what it really costs to open: the fee, the equipment, the working capital, TOTALLED, and an explicit list of what the headline figure excludes. "From £14,995" is the franchise fee and the real number is three times it
- **`territory-list`** — *franchise-sales*. which areas are free, taken or under offer, with the population each covers. The second question every prospect has and the one no franchise site answers until a phone call

## Tier-2 gaps, batch B — four more (2026-08-02)

- **`tenancy-costs`** — *lettings-agent*. the up-front money a tenant actually needs — holding deposit, first month, security deposit — TOTALLED, with the statutory caps checked against the rent and an explicit statement that everything else is prohibited. The Tenant Fees Act banned admin fees in 2019 and tenants still arrive braced to be stung
- **`membership-grades`** — *professional-body*. the ladder by what each grade REQUIRES (years, qualifications, assessment), not by what it grants. Every institute leads with the benefits and buries the entry criteria, so nobody can place themselves without reading four pages
- **`meeting-papers`** — *parish-council*. a meeting with its date and whether the agenda is PUBLISHED yet, against the statutory three clear days. "Agenda not out yet, due Friday" is information; a bare date is not, and it is what stops a resident preparing to speak
- **`livery-packages`** — *equestrian*. DIY / part / full by the week, with what is included, what is explicitly not, and whether a stable is actually free. "Spaces available" on a yard advert is six months old on every yard's website in the country
