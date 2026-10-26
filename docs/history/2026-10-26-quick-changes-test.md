# Quick-changes live test on driftwood-and-daughters-5 (2026-10-25 23:49 → 2026-10-26 00:04 UTC)

On main `0707b1f4d` (before `fix-run6`). One message, recorded:
"Change the main photo on the home page to a surfer catching a wave at sunrise.
Rename the FAQ page to 'Good to know'. Change the font of the headings to something
more modern. Delete the 5-day beginner course from the lessons list. Put the lessons
in order from cheapest to most expensive. On the Contact page, change the email
address to bookings@driftwoodanddaughters.co.uk. Make the cafe opening hours 8am to 4pm."

Cost 45 credits (102 → 57). Nothing left running.

| Part | Outcome |
|---|---|
| Rename FAQ → "Good to know" | done, header and footer on every page (rev 9) |
| Heading font | done; six style changes each checked against the page |
| Order lessons by price | done (rev 10) |
| Delete 5-day course | three rows removed: the table held three duplicates left by earlier test runs |
| Contact email | text changed; the mailto link kept the old address (reply said so) |
| Home photo → sunrise surfer | not done: "New pictures can't be made for sites" (no image generation or search on this path) |
| Cafe hours 8–4 | not done: "I couldn't find that wording on your site" (hours not on the page; it refused instead of adding them) |

## Follow-ups (backlog)

1. Picture replacement with a described photo: no path finds or makes one.
2. A change to something not on the page yet (hours) should add it, not refuse.
3. An email change should update the visible text and the link together.
4. Earlier test runs left duplicate rows (three "5-day beginner course" lessons).
