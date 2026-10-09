# Parallel tasks, round 6: an addition's photograph kept for its frame, whatever the TSX and however late (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker
> routes, request driver, queue consumer and cron, with the network blocked.

The owner's order (2026-10-09), after Codex reviewed `249eb4ae` and passed 47
focused offline tests: keep the Build progress, the font and translation
overlap and the seven-task flow; close the remaining Add-on image-recovery
gaps together.

## 1. What Codex reproduced

With the existing addon-pending-photo fixture:
1. change the page writer's `src="@@IMG:…@@"` to `src={"@@IMG:…@@"}`, which
   is the same JSX;
2. fail the three upload writes;
3. settle the request.

The purchase was `generated`, but no frame was marked, and the part ended
**partial** instead of recoverable. `markPending` replaced one exact spelling
(`src="TOKEN"`).

## 2. Frames found through the syntax tree (`cd70e5e7`)

- **The page's own parser** (`tweakParser`, already loaded by the add-on for
  its menus) finds every string literal whose **whole value** is the token:
  - a JSX attribute value in any quoting: `"…"`, `'…'`, `{"…"}`, or a
    template literal;
  - on a kit element or on a site component (`<Card image="…" />`);
  - a value a shared component reads: an object or array entry, a variable,
    or a fallback (`a ?? "…"`).
- Each frame becomes an **empty string followed by the purchase's mark**, a
  comment (`pending-photo:<id>`). A bare attribute value is braced
  (`src={"" /…/}`). The frame renders exactly as an unfilled one.
- **What cannot be safely established is never guessed** (`located: false`,
  with the reason). This covers:
  - the token inside a longer string (`url(…)`, `"/x/" + "…"`);
  - the token in text or as a JSX child;
  - the token as a key;
  - an occurrence the tree does not account for (a comment);
  - a file that does not parse;
  - running with no parser at all.
  The token is swept as before, and the purchase stays **pending work with
  no frame**, told as such.
- **Every occurrence or none**: a token repeated in a file is marked in every
  copy, but only if every copy is a safe frame.
- **A shared component is named by its real path.** The first run found
  this: parts carry `name`, not `path`, so the mark's file was empty and the
  purchase read as having no frame.

## 3. The placement, through the same tree

- Each mark is found by its purchase id and checked by the parser. It is
  filled **only when the literal before it is still empty**, the frame as the
  addition left it.
- **A changed frame is kept** (`frame-changed`): the customer's own picture,
  say. The photograph is not bought for it, and the page is not published
  again.
- **A removed frame** is `frame-gone`.
- **With no frame** (`no-frame`), the purchase is **only read** (`mayBuy`
  false). One that landed is reported **saved to the customer's images**, and
  nothing is ever begun: a purchase whose claim never landed is not bought
  for a frame that does not exist (APF 9, which the sweep asked for).
- A purchase still unknown at placement holds the part again (round 5's
  APH 5, kept).
- **Charged only for what is placed**, by count.
- No parser at placement: nothing is filled (`unverified`).

## 4. The timing gap, and its cause

- **The cause**: the add-on hands `buySitePhotos` its job clock. `photoWait`
  read only `remainingMs()`, which a build's budget has, while an edit job's
  clock answers `remaining()`. So the add-on's photograph wait never knew its
  deadline. On a finite Worker job (840 s) a slow photograph could carry the
  job past it with the addition unpublished. In the red check this shows as
  APF 4 hanging on the old code.
- **Now** `photoWait` reads either shape. An infinite clock (a container's)
  still waits for every shot, as before.
- **A shot still out when the wait ends is pending work.** The buyer reports
  each shot's identity (`purchaseId(slug, key, n, d, k)`) **before any
  waiting**. At the wait's end, every shot not settled is marked under that
  identity (`why: in-flight`).
- **A purchase never claimed counts as known.** No record means nothing was
  begun, so the next look claims it in one conditional write and buys it
  once. The original call, if it ever claims late, finds that claim and buys
  nothing (APF 8).

## 5. Telling it

- **The add-on's publish milestone** keeps "publishing the additions" as its
  own fact. Each photograph still waiting is a separate fact in its own
  state:
  - `next` for one that goes into its kept frame once confirmed;
  - `notdone` for one with no frame, which will not go in by itself.
  None says anything is published before it is.
- **The reply** says whether the photograph was still being made or its
  purchase cannot be told, and whether it goes in by itself. **Placement
  outcomes** have their own sentences: frame gone, frame changed, no safe
  frame, could not be checked, and "saved to your images".

## 6. Tests and results

- **New cases** (supplied answers, stand-in image service, network blocked):
  - `test/addon-pending-forms.test.mjs`:
    - APF 1: the equivalent JSX forms, Codex's first;
    - APF 2: a shared component's list value;
    - APF 3: no safe frame;
    - APF 4: the wait ends mid-purchase;
    - APF 5: every message delivered twice;
    - APF 6: a frame changed before placement;
    - APF 7: the progress facts;
    - APF 8: a claim that never landed;
    - APF 9: a claim that never landed, with no safe frame (never bought by
      the placement);
    - a network check.
    Each asserts the final page, the task statuses, provider calls,
    publication and accounting.
  - `test/pending-frames.test.mjs`, PF 1–4: every form marked and filled
    with the real parser; every form that must stay unlocated; every fill
    outcome.
  - A `photoWait` case for the edit clock in `test/ship-anyway.test.mjs`.
  - APH 1–5 and two wiring guards moved to the new mark and the buyer's
    identity argument.
- **Red check** on `249eb4ae`, with the new tests and fixtures copied in,
  before APF 8 and APF 9 were written:
  - APF 1, 2, 3 and 5 end `partial` / `purchase-unconfirmed` (APF 1 is
    Codex's reproduction);
  - APF 4 hangs (the add-on waits on the held photograph);
  - APF 6 cannot find the customer's picture (no mark to change);
  - APF 7's publish milestone has no waiting-photograph fact;
  - `pending-frames` cannot load (`fillPending` did not exist).
  That is 7 of 7 integration cases failing, and the unit file failing.
- **Sweep**: 20 mutants over the five product files. In the first round
  16 were killed, the control survived, and three survived:
  - `any-parent-value`, which became two PF 3 cases (an element access and
    a type position);
  - `noframe-buys`, which became APF 9;
  - `fill-in-string`, a guard no TSX can reach (a mark typed in a string
    has no literal ending right before it), so it was removed.
  The first round's `wait-ignores-job-clock` hung on APF 4's held call; the
  timed cases now release it when the test aborts. **Re-sweep of the four
  (control included): 3 of 3 killed, the control survived**, with the clock
  mutant ending cleanly. In all, **19 of 19 product mutants killed**.
- **Focused run**: these files plus the seven-task batch
  (`parallel-batch`) and Build progress (`build-parallel`), every one with
  the network blocked: **`36 / 36 / 0 / 0`** on `36d431e2`.
- **Full suite**: **`10249 / 10249 / 0 / 0`** on `36d431e2` (was 10234 at
  round 5's `be9803a0`, and 10247 at `cd70e5e7`).
- **Required CI**: green on `36d431e2`: unit tests (run 37890100961) `10249 / 10208 / 0 / 41`, the same total as locally (CI skips 41); site build (run 37890101484) green.
- **Image** (predicted, not built): `335396c8c0e0fbcb` → **`dbaeecfe12cea870`** (202 inputs).

## 7. Mocked versus live

- **Mocked**: every model answer, the image service and its store failures,
  Supabase's RPCs, the queue, the cron and the container. The parser is the
  real one (`typescript` 5.9.3 at the repository root, the same module the
  container resolves from the template).
- **Not shown**: a real page writer's actual TSX variety, the real image
  service, live timing, and a Worker-inline job actually running into its
  840 s deadline.

## 8. Remaining limits and acceptance blockers

- **A token inside a longer string** (a CSS `url(…)`, a concatenation) is
  never placed automatically. It is told and kept as pending work with no
  frame, and saved to the customer's images when it lands.
- **A page-filed add-on job** (not a request part) has no purchase record.
  A shot still out at its wait's end is told as unresolved, as before.
- **Without the parser** (a Worker isolate that cannot load `typescript`),
  nothing is marked. Every waiting purchase is pending with no frame, and
  told.
- **The image provider has no idempotency key or lookup** (unchanged).
- **No real-model, real image service or live run.** The add-on's change of
  wait on a finite job clock should get its own live look before any
  release.
