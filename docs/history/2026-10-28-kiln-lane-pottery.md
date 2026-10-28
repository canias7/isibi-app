# 2026-10-28 — Recorded build after deploy 2283: Kiln Lane Pottery

On the owner's word ("just do it and record it"), the first live build on deploy
2283 (`363b13aa9`, the site owns its work). It was sent from the app at
gofarther.dev, signed in with the saved session the earlier recorded builds used
(the "A" account, balance 172 before; not the building account).

## The request (typed into "What are we building?", Grok 4.7, effort Low)

> Kiln Lane Pottery is a small pottery studio in Bristol. I run 2-hour beginner
> wheel classes on Saturdays at 10am and 2pm, £45 per person, max 6 people. I
> want a home page, a classes page, and a booking form where people pick a class
> date and time, give their name, email and number of places, and pay a £15
> deposit online to hold the booking. Email me when someone books.

## What happened

- 05:22:21 UTC sent. The talk began at once and named each step: the address
  `kiln-lane-pottery`, the foundation, the studio's data, then the pages section by
  section (10 sections). Screenshots: `2026-10-28-kiln/12-t302s.png`.
- About 05:29 the build finished, saved as draft revision 1, with three pages:
  Home, Classes and Book a class (`2026-10-28-kiln/22-t604s.png`). The compile
  passed; the render check opened 3 pages and flagged nothing. Two photographs
  were left as placeholders, because picture purchases are off.
- Notes the build printed: `classes.tsx` and `book.tsx` have no page `head` of
  their own, and one part (`band-5-two.tsx`) had a TS2322 type error.
  `tsc` only reports; the site built and published.
- 05:37:33 published (`2026-10-28-kiln/411-pub2.png`). Version
  `01793165074320-p1cifl`, build `mvro9318-bnb83x`. Publishing cost nothing.

## The live site — each piece on the site's own Worker

- `https://kiln-lane-pottery.gofarther.app/`, `/classes` and `/book` answer 200.
  Every answer carries `x-site-data: own`: the site's own Worker served it, through
  the front door.
- A visitor's page reads went to the site's own Worker (`own=own`):
  `GET /api/db/kiln-lane-pottery/data/classes …` 200, and the spam-check config
  `GET …/turnstile` 200.
- The booking form has a date, a time, name, email, places and "Pay £15 deposit".
  A test visitor filled it in (7 November 2026, 10:00, "Test Visitor (Go Farther
  check)", test-visitor@example.com, 1 place) and pressed Pay:
  `POST /api/db/kiln-lane-pottery/checkout` → **503 from the site's own Worker**,
  shown on the page as "this shop hasn't finished setting up payments yet"
  (`2026-10-28-kiln/52-after-submit.png`). That is correct: no Stripe key is set
  on this site, and with the key living only on the site's Worker there is
  nothing to fall back to.
- The page says a place is held only after the deposit is paid. No payment was
  taken, so **no booking row was written and no email was sent**.
- The site has its own database (one `site_backends` row).

## Money (the A account, `credit_events`)

| row | ref | delta | after |
|---|---|---|---|
| 848 | `build:9ced8ef3…:deposit` | −2 | 167 |
| 849 | `build:9ced8ef3…:settle` | −13 | 154 |
| 850 | `build:9ced8ef3…:pages` | −47 | 107 |

The ledger holds 62; the balance went 172 → 107, so 65 in all (routing is not in
the ledger). **That is above the 11–45 measured for earlier first builds.**
Publishing and the visitor test cost nothing.

## Not shown yet

- A paid booking: the deposit through Stripe's checkout, Stripe's message back to
  the site's Worker, the booking row in the site's own table, and the owner's
  email. **This needs the site owner's own Stripe key (test mode is fine), set
  in the site's Payments panel.** After that, the same visitor press shows the
  whole path.
- The two pages without their own `head`, and the part's type error, go to the
  backlog.

## Video

The build, the publish and the visitor press were recorded. They are kept
outside the repository (in the session's scratchpad): build `1fb9b6d0….webm`,
publish `pub/`, visitor `visit/`.
