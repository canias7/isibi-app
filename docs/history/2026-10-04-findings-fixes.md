# Run 95's two findings, fixed on the branch (2026-10-04)

The owner, after the investigation (`docs/investigations/request-batch-findings.md`):
*"Proceed with fixing both findings on the current branch, including the review
corrections below; document your implementation approach and complete the work
without stopping for another plan approval."* With it: *"Keep changes on the
branch for review; do not merge, deploy, rebuild containers or run paid tests
yet."*

So nothing here is merged or deployed. No container image is built, and
nothing paid has run: no model call, no fal purchase, no press. `main` stays
`f69c873c`, running image `882477e1bbbe8cbe`. The money is unchanged: balance
95, last ledger row 367, no job open (read at 05:33 UTC). **Every result below
is shown with supplied model answers.** None of it is evidence of what a real
model answers; that is the focused live check's to show.

## 1. F1, the menu link (`builder/site-nav.mjs`, `builder/site-add.mjs`, `worker.js`)

The owner's corrections, each kept:
- Newness is never decided from the union of every page's links. The same
  logic reached the footer's legal and social lists.
- Each page's unrelated links, labels, order and intentional differences
  stay. Nothing copies the union everywhere.
- No keyword rules, fixture names, or Classes and Gallery exceptions.
- Run 95's site has six pages and **five menus**. `/starter` has none, and no
  navigation is made there.

What changed:
- **The model names the additions** (`add`: list, item, `pages`, `after`).
- **Code puts each one into every list in its scope that lacks it**
  (`readAdditions`, `applyAdditions`). An ordinary menu edit takes `add` too.
- **A page with no menu is never given one.** Named in a scope, it is refused
  by name. A scope page the site does not have is said as that.
- **A footer list** gains the entry where it exists, and is made only where
  no page in the scope has one.
- **An addition already true everywhere it was asked for is `satisfied`**:
  `ok`, nothing changed, nothing published.
  - Queued, no reserve is taken, the same net as a refusal's refund.
  - Synchronously, the reading is charged, as a refusal's is.
  - Routing charges stay.
  - The request part ends done, so what needed it runs.
- **The add-on carries the link's placement**
  (`link: { in: "menu" | "page", … }`).
  - `menu`, the default, is added to every existing menu by code.
  - `page` is the writer's, told that page and that place.

## 2. F2, the replies (`worker.js`, `builder/site-reply.mjs`, `builder/job-gateway.mjs`, `builder/container-env.mjs`, `public/edit-poll.js`, `public/chat.js`)

Option B, on the server's own job and recovery machinery:
- **The record.** Each reply has its own record (`edit-replies/<job>.json`,
  and the request's beside its request), with its own state.
- **The ask.** The reply is asked for once the job's outcome and money are
  final. The container asks through the gateway's new `/reply`, under the
  job's own token.
- **The writer.** The queue writes it (`edit-reply`):
  - a claim by conditional write, with a lease;
  - 90 s per call and 150 s per try;
  - three tries, 30 s and then 120 s apart, then `failed`.
- **The reads.** No read calls the model. A read that finds nothing, or a
  stale record, asks once.
- **Recovery.** The two-minute cron asks again for a lost ask, a lapsed claim
  or a missed retry; past 15 minutes, the reply is `failed`.
- **The page** waits while the reply is written (*"Done — writing up what
  changed…"*). It keeps a request open while any reply is pending, and picks
  the reply up after a reload or on another device.
- **Synchronous replies**: 30 s per call and 45 s in all (were 12 and 20).
- **The cause of run 95's misses stays strongly inferred** from its timings:
  the Worker's logs were not read.

The full account is the investigation's *What is fixed*.

## 3. The tests (supplied answers; sync and queued where both exist)

- `test/request-findings.test.mjs`: 12 cases on run 95's own pages and part
  results. The 5 FOUND cases now assert what replaced each.
- `test/edit-removal-door.test.mjs`: 6 new FRAME ADDITION cases, 3 per path:
  - a scoped addition, the rest, then already done;
  - a page with no menu, refused;
  - legal links made only where no page in scope has the list.

  Four earlier cases were moved to `add`.
- `test/addon-route.test.mjs`: 2 new cases, a menu placement and a placement
  on one page, on run 47's bakery.
- `test/request-flow.test.mjs`:
  - M5, R1's shape: the link's part already done, nothing published, its
    step not charged, the dependent part run, its own reply a "nothing
    changed" fact;
  - seven cases now read the reply the page was served (`toldIn`,
    `readWritten`), since replies are written in the background.
- `test/reply-background.test.mjs`, new, 7 cases:
  - BG1: a reply held 13 s (real time) while the next part runs;
  - BG2: a provider refusing every try;
  - BG3: two simultaneous deliveries, a late duplicate and three reads, one
    model call;
  - BG4: the consumer dying after finalize; the cron asks;
  - BG5: a writer evicted after its claim;
  - BG6: the gateway's `/reply` and the container's `JOB_REPLY`;
  - BG7: a reload or another device.
- `test/request-flow-page.test.mjs`, the page's own functions:
  - PAGE 7: a part's reply pending, then both replies shown in order, and a
    page on another device;
  - PAGE 8: the request's own reply pending when it ends, and the page keeps
    looking.
- `test/model-replies-routes.test.mjs`: 5 cases moved to the background
  writer, with the failed-reply case's three tries and its `failed`.
- The harness (`test/fixtures/request-flow.mjs`):
  - `replyWith`: the reply writer's pace and faults, honouring the caller's
    abort;
  - `heldFor`, `deliver`, `pumpBeside`, `readWritten`, `factsOf`.
- The screenshot: the live step *"Done — writing up what changed…"*, then the
  written reply. That is the real `public/` app in headless Chromium, with
  the reply text supplied.

## 4. The focused live check's instrument (`rq-menu-link`)

- **A new scenario** (`scripts/canary-ui.mjs`): *"Put the Classes page in the
  menu on every page."* on `fold-lane-bakery`.
  - Its budget is 10, estimate 3–9.
  - It allows nav or look and opens the add-on step, because the router may
    send a menu link either way.
- **A new verdict** (`menuFinish`, `scripts/canary-requests.mjs`):
  - every menu that lacked the link gains exactly it, keeping its own items;
  - every menu that had it is as it was;
  - at least one menu gains it, and every served header links it;
  - a page with no menu is held by the byte-for-byte check.
- **The form** names it; the plan's §4 and Appendix B carry it.
- **Tests**: 2 cases, the lands case and six ways it does not land.
- **Neither instrument needs a change for background replies.** The request
  canary watches until the page itself closes the request, and the one-edit
  canary's watch reads `pending` as wait (`EditPoll.readPoll`).

## 5. Checks

- **Red check** on `9b543d8f`, in a throwaway worktree:
  - every new or converted case fails, 26 cases in six files;
  - three files cannot load, because the functions they test do not exist
    there;
  - no unchanged case fails.
- **Sweep of the fixes**, 30 mutants and 3 comment-only controls:
  - 26 killed at first;
  - the four survivors were test gaps: an unknown scope page's reason, the
    satisfied fact's kind, a late duplicate past the conditional write, and
    the request's own reply pending on the page;
  - each was closed by a case, and all four were killed on the re-run;
  - the controls survived both runs, and every file was restored by hash.
- **Sweep of the focused check's verdict**: 5 of 5 killed, and its control
  survived.
- **The full suite**: `9334 / 9334 / 0 / 0`, from 9,308 by 26 new cases.

## 6. Next (each the owner's word)

1. Merge and deploy, then the free runtime press.
2. The focused check, `rq-menu-link` (3–9).
3. R2–R5, one press each (R2 10–25, R3 4–12, R4 3–7, R5 8–17). R1 and
   `rq-canary` are done and not repeated.

The batch has spent **25** (`rq-canary` 4, R1 21). The steps above, at their
upper estimates, take it to 96, within 100.
