# Prompt for the owner's external assistant: add-on / edit audit (2026-10-24)

Paste everything between the lines.

---

You are auditing the site builder of Go Farther, GitHub repository
`canias7/isibi-app`, branch `main` (commit `c985956c0` or later). A customer
describes a business in chat and gets a published website; they then edit it
and add features by chatting. **This is a read-only audit**: do not change
code, do not run anything that calls a paid AI model or writes to a live site,
do not open pull requests. Write your findings to one Markdown file.

**Read first:** `CLAUDE.md`, `docs/architecture.md`, `docs/edit-path.md`,
`docs/addon-path.md`, `docs/traps.md`.

## What happened (real runs, 2026-10-24, model Grok 4.7)

A big site was built from one prompt (a surf school with Lessons, Board shop,
Cafe, Hire, Events, Gallery, FAQ, Contact pages and their tables). The build
worked. Then one big follow-up message asked to "add" those pages with more
detail (bookable lessons with date/time/people, shop search and filters, cafe
menu, hire form, events sign-up), plus "Instagram and Facebook links and a
newsletter sign-up in the footer, and a header menu linking every page", plus
home-page changes. Results:

1. **Existing pages sent to the add-on step.** The router answered `intent:
   "addon"` (reasons `tables-filled`, `pages-filled`) for parts whose targets
   already existed (`page:/shop`, `page:/cafe`, `page:/hire`, `data:lessons`).
   The add-on step can only add new things. Outcomes:
   - "Add a bookable Lessons page" was picked as a single `row` and inserted
     into the existing `lessons` table with a missing NOT NULL column →
     Postgres 23502 → "the database didn't accept it" (worker.js ~43790,
     43890-43895; `cleanAdd` row case in builder/site-add.mjs ~3878; `rowBrief`
     ~3201 knows nothing about NOT NULL).
   - On another run the same request inserted four lesson rows and replied
     "All four lesson types are now on Lessons", while the booking feature
     asked for was never built.
   - Board shop / Cafe / Hire: empty pick → `aFailure("no-add")` (worker.js
     ~43773) or the requirement judge marked every need "elsewhere /
     already-there" (site-add.mjs ~4395) → "Nothing new was added. I couldn't
     work out what to add". Nothing was handed to the edit (page) step.
2. **Questions after the request was charged.** For queued parts of an
   already-paid request the router answered `intent: "clarify"` ("X is already
   on the site. Should I update those pages?"; worker.js ~34685-34830,
   `storeAskIfFree`, `rQuestionFor`). The customer's answer "Update the
   existing pages" was resumed as the same add-on request
   (`rInstruction = rWaiting.request`) → failed again → charged routing again.
   The owner's rule: no questions after charging, across all parts.
3. **Footer + menu refused twice.** The footer/menu part went to the add-on
   step, which escalated it (`reason: "layer"`, `layer: "nav"`, `kind:
   "frame"`, `escalate: true`); the nav step refused; then an `edit` job on the
   frame was refused (`error: "refused"`, `frame: true`, cost 6). Why both
   refused is **not yet known** — find it.
4. **Queued parts invisible.** While the server ran and charged more than 30
   part jobs for one message, the panel showed no "tasks in progress" pill and
   no Stop button.
5. **Diagnosis step (shadow mode, `builder/diagnose.mjs`) said "can't tell"**
   for all three failures: it only receives the job's final answer fields, not
   the route decision, the site's pages/tables, or the job's step trace.

A pending fix branch `fix-addon-existing` (commit `dae79768d`) already covers
part of 1 and 2 (`builder/addon-existing.mjs`, `rowRequired`, no re-charge on
an answer; `partClarifyChoice` written but not wired). Read it and say what it
misses; don't duplicate it.

## Areas to audit (billing is out of scope this round)

1. **Routing** (`builder/site-ask.mjs`, the routing route in `worker.js`,
   `builder/route-*`): add vs edit for things that already exist; clarify
   offered to parts of a paid request; where an answer resumes.
2. **Add-on → edit hand-off** (`builder/site-add.mjs`, `builder/site-addon.mjs`,
   worker.js add-on route): every way the add-on ends with nothing done, and
   whether the work reaches a step that can do it.
3. **Header, footer and menu** (`builder/site-frame.mjs`, `builder/site-nav.mjs`,
   the frame/nav lanes): why "social links + newsletter in the footer + a menu
   linking every page" is refused by both the nav step and the edit step.
4. **Multi-part requests** (`builder/request.mjs`, `builder/request-plan.mjs`,
   request-needs, `splitAsk`): splitting, waiting, deferring, dependency
   handling; how one message became 30+ jobs.
5. **Stop and the panel** (`public/chat.js`, `public/edit-poll.js`, build-stop
   and job-cancel routes): queued parts must show as tasks and be stoppable.
6. **Database rows** (`site-add.mjs` row path, `builder/site-apply.mjs`):
   required columns, defaults, validation before writing.
7. **Diagnosis evidence** (`builder/diagnose.mjs`, `diagnoseEnded` in worker.js,
   `edit_traces`): what a failed job records and what the diagnosis can read;
   what read-only look-up tools it would need to find causes by itself.
8. **Replies** (`builder/site-reply.mjs`, `editReply`): replies that claim or
   hide what the operations did (e.g. "all four lessons are on Lessons" when
   the booking feature was not built).
9. **The edit steps** (text, look lanes `builder/site-lanes.mjs`, page rung
   `builder/site-tweak.mjs`): refusals of normal requests.
10. **Retries**: owner rule "a task must never fail completely without at
    least one retry (with the reason, same model, same effort)". Find every
    failure path with no retry (`builder/retry-reason.mjs`,
    `builder/provider-retry.mjs`, `builder/edit-failure.mjs`).
11. **Whole features on existing pages**: "make it bookable", "add search and
    filters" when the page/table exists — which step builds it?

## For each finding

- file:line, the concrete path from a customer message to the failure;
- detected today? recovery today? what the customer sees;
- the smallest fix, general (no keyword- or fixture-specific rules);
- priority (critical / high / medium / low) and how many of the failures above
  it would remove.

## Output

One Markdown file: a findings table (area · file:line · failure · detected? ·
recovery · customer impact · fix · priority), then the top 15 fixes ranked by
failures removed, then anything you could not verify, marked **unverified**.
Cite file and line for every claim; don't guess at behaviour you didn't read.

---

## Notes for Claude (not part of the prompt)

- Check every claim against the code before fixing anything; it's model output.
- Job ids from the runs: driftwood-and-daughters-5 jobs `2124dc02…` (add-on
  no-add), `6f7583f4…` (add-on → nav escalate), `75f25f2f…` (edit refused,
  cost 6). Earlier runs: driftwood-and-daughters-3 and -4, 19:21–19:42 UTC.
