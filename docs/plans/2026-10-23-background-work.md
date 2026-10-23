# Background work: keep chatting while the builder works (owner, 2026-10-23)

Approved design: `2026-10-23-background-work-mock.html` (option A, the pill above the message box). Not built.

## What the customer sees
- The message box always shows **Send** (never Stop) while jobs run.
- A small pill above the box: "N things in progress ▾". Tapping it opens a panel above the box:
  - header "N things · K in progress", **Stop all**, ▴ to close;
  - one row per job: state dot (spinning = working, empty ring = next, filled = done), its name, one live AI-written line, and ›.
  - Done jobs show "Saved as draft · <time>" and drop off after a while.
- Tapping a job opens its own view inside the panel: "‹ Back · <name> · Stop" fixed at the top, "You asked: …", then its full live progress, then (when finished) its AI-written reply with **Show me** (opens the page in the preview) or, if it failed, the explanation and **Try again**. A "next" job shows what was asked, "starts when X is done", and **Remove**.
- **Scrolling**: the panel has a fixed maximum height (about half the chat). The job list and a job's view scroll inside their own box; the top bar stays put; a working job follows its newest line unless the customer scrolled up, with a "↓ new" button to jump back down.
- All text is model-written from facts (owner rule); only the fixed UI labels are static.

## How it behaves
- A **question about the site** gets an immediate AI answer, without touching the running jobs.
- A **new change** joins the list: independent changes run alongside, ones touching the same thing wait ("next").
- Stop on one job stops only that job; Stop all stops everything.
- Server side, a running request no longer makes the composer "busy"; the router decides per message whether it's a question (answer now) or a change (queue as a part of a new request or append to the live one).

## Builds on
The parallel card, the request flow (parts, needs), per-project busy slots, the progress talk writer, and fix-edit-flow's "a waiting question is not running work".
