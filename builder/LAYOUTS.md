<!--
  The layout taxonomy — owner-authored, 2026-08-01.

  This is the SOURCE document for builder/site-layouts.mjs: every numbered
  family below has an entry in the module's FAMILIES table, every bullet under
  "structural variants" has an entry in STRUCTURES, and test/site-layouts.test.mjs
  holds the two in bijection. Edit here, then mirror there — the test fails on
  any drift, in either direction.

  A LAYOUT IS NOT A THEME. Themes vary how a site looks (site-theme.mjs);
  layouts vary how it is ARRANGED — the hero pattern, the body rhythm, and
  which verb leads. The reference pages stay one constant set (the grammar all
  families share); the chosen family rides in the per-build USER message, so
  the cached system block never varies.
-->

# Website Layout Families

A taxonomy of site *kinds* grouped by the layout family they belong to.
Each family shares a hero pattern, a body rhythm, and a primary CTA.

---

## 1. Booking-first
**Shape:** calendar / slot picker is the hero. Everything else supports the appointment.
**CTA:** Book now · Check availability

- Salon, spa, nail studio
- Clinic, dental, therapy
- Tattoo studio
- Home services (plumber, electrician, HVAC) — *call-now* variant
- Fitness studio / yoga — *class-schedule* variant

---

## 2. Inventory / search-first
**Shape:** filter rail + result grid. Search bar sits above or replaces the hero.
**CTA:** View listing · Save · Inquire

- Real estate
- Car dealership
- Job board
- Rentals (equipment, venues, gear)
- Travel + hotel — *date-picker* variant

---

## 3. Evidence-first
**Shape:** the work speaks. Large imagery, minimal copy, contact is the destination.
**CTA:** Start a project · Inquire

- Agency / consultancy — case studies
- Law firm — practice areas + consult
- Architecture / interior
- Photographer, videographer
- Wedding & event vendors (gallery → inquiry)

---

## 4. Feed / archive-first
**Shape:** reverse-chronological stream. Newest thing on top, nav is secondary.
**CTA:** Read · Subscribe

- Publication, blog, magazine
- Podcast (episode list + player)
- Newsletter — *single-column capture* variant
- Creator / personal brand — *link-hub* variant

---

## 5. Product-first
**Shape:** the thing itself is the hero — screenshot, render, or trailer.
**CTA:** Sign up · Buy · Download

- SaaS — signup + feature proof
- Mobile app — screenshot carousel + store badges
- Hardware — hero shot + specs + buy
- Game — trailer video takeover
- Developer tool / API — *docs-sidebar* variant

---

## 6. Conversion-single-purpose
**Shape:** one page, one action. Everything is subordinate to a single button.
**CTA:** Donate · Register · Enroll · Join

- Nonprofit → cause + donate
- Event / conference → date, lineup, tickets
- Course / cohort → outcome + curriculum + enroll
- Community / membership → join + social proof
- Coming soon → one field, nothing else

---

## 7. Trust-first
**Shape:** credentials, licensing, and proof before any pitch. Conservative typography.
**CTA:** Free consultation · Get a quote

- Accounting, tax prep, bookkeeping
- Insurance broker
- Financial advisor / wealth management
- Medical specialist practice
- Childcare, eldercare, tutoring
- Veterinary — *booking hybrid*

---

## 8. Menu-first
**Shape:** the list of things IS the page. Often single-scroll, sometimes no nav at all.
**CTA:** Order · Reserve · Directions

- Café, deli, food truck
- Bakery / catering — *order-form* variant
- Bar / brewery — *hours + tap list* variant
- Delivery-native (ghost kitchen) — order widget above everything

---

## 9. Location-first
**Shape:** map is load-bearing. Locator or property switcher near the top.
**CTA:** Find nearest · Get directions

- Multi-location franchise → store locator
- Gym chain, coworking spaces
- Dispensary, pharmacy
- Hotel group / resort — *property switcher* variant
- Retail with pickup — *in-stock near you*

---

## 10. Credential / narrative-first
**Shape:** one person is the product. Portrait, story, then proof of authority.
**CTA:** Book me · Apply · Follow

- Résumé site
- Speaker / author — bio, talks, book, booking
- Coach / consultant — problem → method → apply
- Politician / campaign — *donate + volunteer split*
- Artist / musician — tour dates + release

---

## 11. Documentation-first
**Shape:** persistent sidebar, dense internal linking, search always visible.
**CTA:** Copy install command · Get started

- API reference, SDK docs
- Open source project — install command as hero
- Knowledge base / help center — search bar + categories
- Changelog / status page — reverse-chronological, no marketing

---

## 12. Data-first
**Shape:** numbers or the interface showing numbers is the hero.
**CTA:** Try it · Download report · Compare

- Dashboard product — screenshot of the dashboard *is* the hero
- Analytics / BI tool
- Pricing calculator as landing page
- Comparison / review site — table above the fold
- Research report / whitepaper — gated download

---

## 13. Institutional
**Shape:** audience-split navigation. Multiple unrelated user journeys share one homepage.
**CTA:** Apply · Find · Pay · Visit

- University / school — audience-split nav (prospective, current, alumni)
- Government / municipal — task-oriented, search-heavy
- Hospital system — find a doctor + find a location + pay bill
- Museum / gallery — hours, exhibitions, tickets
- Church / congregation — service times + livestream

---

## 14. Media-heavy / immersive
**Shape:** full-bleed imagery or video, minimal chrome, sparse type, scroll as choreography.
**CTA:** Explore · Configure · Shop

- Fashion brand — full-bleed editorial, minimal chrome
- Car manufacturer — configurator
- Luxury hospitality — video loop, sparse type
- Film / show — trailer takeover
- Awwwards-style studio — scroll-jacked narrative

---

## 15. Transactional utility
**Shape:** no marketing. Form, state, confirmation. Layout discipline over expression.
**CTA:** Submit · Continue · Pay

- SaaS billing / customer portal
- Support ticket submission
- Appointment reminder / confirmation page
- Checkout flow (its own layout discipline entirely)
- 404, maintenance, waitlist — micro-layouts worth designing on purpose

---

## 16. Regulated / disclosure-heavy
**Shape:** compliance blocks are structural, not footnotes. Gates and disclaimers shape the page.
**CTA:** Open account · Verify age · View rates

- Bank, credit union — rates table + login prominent
- Crypto exchange — chart hero + regulatory footer
- Pharma / drug brand — ISI block, safety info dominates layout
- Cannabis retail — age gate before anything renders
- Gambling / sportsbook — odds board as homepage

---

## 17. Time-sensitive
**Shape:** live state is the content. Countdowns, auto-refresh, ends-in timers.
**CTA:** Bid · Buy now · Refresh

- Ticketing / box office — seat map, countdown
- Auction — live bid state, ends-in timer
- Flash sale / drop — countdown + waitlist
- Election night / live results — auto-refreshing data
- Weather, transit, outage — status-first, no marketing

---

## 18. Membership-gated
**Shape:** two different sites — logged-out is a pitch, logged-in is a product.
**CTA:** Subscribe · Log in · Join

- Paywalled publication — meter, partial article + wall
- Private community — logged-out pitch page, logged-in feed
- Alumni / association portal
- Fan club / Patreon-style — tier ladder
- B2B customer portal — auth wall is the front door

---

## 19. Industrial / B2B non-SaaS
**Shape:** specs, downloads, and quote paths. Pricing often behind auth.
**CTA:** Request quote · Download spec · Find distributor

- Manufacturer — spec sheets, CAD downloads, distributor locator
- Logistics / freight — quote calculator, tracking input
- Construction / GC — project portfolio + bid submission
- Wholesale / distributor — login for pricing, catalog behind auth
- Lab / testing services — capability matrix

---

## 20. Recruiting-first
**Shape:** filtered role list plus culture proof. Sometimes dual-audience.
**CTA:** Apply · Submit résumé · Post a job

- Careers site — filters + culture + apply
- Staffing agency — dual audience (employers / job seekers)
- Talent marketplace — profile-as-page
- Internship / bootcamp — outcomes + placement stats

---

## 21. Educational
**Shape:** curriculum tree or practice surface. Progress is a visible element.
**CTA:** Enroll · Start lesson · Practice

- Online course platform — path / curriculum tree
- Documentation-as-course (interactive tutorial)
- LMS student dashboard
- Flashcard / practice tool — the tool IS the homepage
- Library / archive — advanced search, faceted results

---

## 22. Local & civic
**Shape:** hours, address, contact, documents. Utility over polish.
**CTA:** Visit · Contact · Download

- Restaurant chain locator
- HOA / neighborhood
- Library branch
- Nonprofit chapter site
- Small-town municipal — PDF-heavy

---

## 23. Personal / niche web
**Shape:** intimate scale, one narrative, often single-page.
**CTA:** RSVP · Read · Give

- Wedding site — RSVP + registry + story
- Memorial / obituary
- Baby registry
- Résumé-as-single-page
- Personal wiki / digital garden — dense internal linking
- Link-in-bio — vertical stack, thumb-optimized

---

## 24. Emerging / AI-native
**Shape:** the input is the hero. Try-before-signup, no auth wall, output is the proof.
**CTA:** Generate · Try it · Run

- Chat-as-homepage (input box is the entire hero)
- Agent / workflow builder — canvas UI
- Prompt gallery / model directory
- Playground — try-before-signup, no auth wall
- Generative tool — before/after slider hero

---

## Cross-cutting: mold-breakers

Two shapes that don't sit inside a single family:

- **Two-sided marketplace** — supply/demand toggle above the fold
- **Directory** — search bar as the entire homepage

## Cross-cutting: structural variants

Any family above can be expressed through:

- Single-page scroll
- Bento grid
- Sidebar-persistent
- Split-screen 50/50
- Full-bleed hero + centered content column
- Card-grid dense
- Editorial asymmetric
- Terminal / monospace minimal
