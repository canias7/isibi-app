# 2026-10-11 — Tasks start when what they use is ready; a question redoes only what it reaches

Codex reviewed `44344896`, passed 188 focused tests and confirmed the latest
CI green. **Closed as fixed offline**: the table + FAQ overlap (PI 24) and
BG11's CI failure (run 38148556722). Two further mocked integration cases
showed false dependencies that remained, and two existing cases encoded
redone work after a question:

1. **A function that reads no table waited for a table.** An empty signups
   table, a pure SQL function returning 42 and a static FAQ, every scope
   `uses: []`: all finished, but the function waited for the table —
   `designWaits` made every schema kind wait for every schema kind before it.
2. **A component waited for an unrelated table.** A slow table beside a new
   gallery page, and a component that uses the page: the page designer
   answered at once, but the component could not start until the table
   finished — a designer was marked decided only when the fixed loop reached
   it in kind order (`aDecided`/`aFolded`).
3. **PI 30** expected the completed table designer to run again after the
   independent component asked a question.
4. **PL 2** discarded the other look lane's completed answer when one lane
   asked.

**Commits**: `9070e706` (the change and its tests), `acdf4748` (acceptance pin), with records after.
**Image prediction**: production `8d6dbcea93252fbb` → `4b8665dd0256e3f9` (205 inputs, on `9070e706`; was `9d5c417c92c65f99`). Not built.
No merge, deploy, container build, paid call, real image, fal call, balance
change or flag change. Every provider mocked.

## 1. Readiness, not order

**No dependency by category** (`designWaits`, `builder/site-add.mjs`): a
schema kind no longer waits for every schema kind before it. A function that
reads a new table, or a job that runs a new function, says so in `uses` (and
one that did not and needed it answers `needs` and is asked again with it
shown, as before). Declared uses, shared words and the transitive closure
are unchanged; a kind the picker said nothing about still waits for every
earlier site-changing kind.

**A designer starts when what it uses is ready** (`worker.js`):
- Each early answer is checked the moment it lands (`aLanded`). One that
  designed something usable is cleaned against the site it was shown, and
  that result is **ready** (`aReady`) for the designers that use it. They
  start at once (`aStartReady`, no argument now), whatever is still out
  before them in the list.
- What a starting designer is shown is built from the ready results of what
  it uses (`aViewFor(k, aProvisional)`), in run order, through the same fold.
- **The official results still come in order**, and an early answer is still
  used only when its request is byte for byte the one built from the
  official results (`aTakeEarly`, `aSiteFor = aViewFor(k, aOfficial)`). A
  provisional result that differs from the official one costs a fresh call,
  never a wrong design.
- **Never ready early**: a kind that failed, asked a question, or said it
  `needs` what it was not shown. Its turn decides it.
- **A hand-off waits for its giver's turn** (`aHandsTo`): a designer handed a
  requirement by a landed-but-undecided designer starts after that giver is
  decided, so the judged hand-off is in its brief (the existing hand-off
  cases, `addon-route` and `requirement-*`, stay green).
- **A kind whose turn has begun is never started again early** (`aTaken`),
  and nothing starts once the loop has ended (`aLoopDone`, in a `finally`).

## 2. Continuation: a question redoes only what it reaches

**Every request job keeps every answer it got** (`jobSend`'s `keep`,
`jobKeptKey` = `jobs/prepared/<id>.kept.json`): replayed or made now, under
the exact request sent (clarification answers included), written in the job
runner's `finally` beside its `.use.json` evidence.

**The part's next run job replays what is unchanged** (`stageKept`, beside
`stagePreparation` in `stagePrepared`): calls kept by the part's earlier run
jobs **that charged nothing** (`end.cost === 0`) are staged for the new job.
Each call whose request is byte for byte one already answered is answered
from the record; any other is made now. Replayed answers keep their usage
and are billed once, by the job that uses them; nothing already billed is
staged. Idempotent under redelivery.

**An answer is shown where it belongs** (`by`):
- A question from one call inside a step names its asker
  (`by: "add:component"` on the add-on's clarify answer → `packAsk`'s `by`,
  `ASKER_RE` → the stored question → the request part's question → the
  answer pair → `readContext` keeps it).
- In an addition, an answer with `by` is shown to that designer, to the
  designers that use its result, and to every call that is neither a designer
  nor the picker (the judge, the page writer). Never to the picker or a
  designer it does not reach (`aShownTo`) — so their requests are the ones
  they made before the question, and are replayed.
- The look door already scopes answers per lane by the picker's own reading
  (`toldBy`); a lane told no answer sends the same request as before.

**A step that ends on a question first lets work already in flight finish**
(`eSettleLanes` for the look lanes; the designers already started, before the
add-on's clarify answer), so their answers are kept.

**Validation is the exact request**: a saved answer is reused only for the
identical request, which carries every input the call actually used — the
site facts it was shown, its brief, the answers it was shown, the part's
context. Anything the question changed changes the request, so it is asked
again.

## 3. Tests (all mocked, through the real driver, queue consumer, routes)

`test/parallel-readiness.test.mjs` (new):
- **SCH 1 ×2** (both orders): table, pure function, FAQ — all three designers
  meet; the function is not shown the table; each made once, each designer
  asked once.
- **SCH 2 ×2** (both orders): the slow table is held until the component
  starts and is released by it, not by its 2.5 s limit; the component starts
  after the page designer, is shown the page and not the table; each asked
  once; the gallery published; no charge twice.
- **SCH 3**: the genuine chains — a function using the table starts after the
  table and is shown it; a job running the function starts after it and is
  shown it; the job registered.
- **SCH 4**: the page designer asks; a component uses the page; a table is
  unrelated. After the answer, the page and the component are asked again
  (both shown the answer), the table's finished design and the picker are
  replayed (one call each in all); all land once, no charge twice.
- **SCH 5**: the table asks at once while a slow page designer is still out
  and a component uses the page. The step waits for the page's answer
  before it asks (kept, replayed after: one call in all) and starts nothing
  once it has ended (the component is not designed before the answer); the
  picker is asked once in all.

`test/parallel-addon-independent.test.mjs`:
- **PI 27** revised: no chain by category; declared chains still transitive.
- **PI 30** rewritten: after the component's question, the table designer is
  called once in all (replayed), the picker once, the component twice (shown
  the answer); the question names `add:component`; the table made once; no
  charge twice.
- **PI 31** (new): the same, every message after the answer delivered twice
  at once — still one table call, one table made, no charge twice.
- **PI 21** restated: the run after a held purchase replays the picker and
  both designers (one call each in all) and asks only the page writer that
  failed; the same picture placed, generated once. (Its old script — a
  question from the picker's second call — is no longer reachable: that call
  is replayed.)

`test/parallel-lanes.test.mjs`:
- **PL 2** rewritten: the name lane asks; after the answer the description
  lane's finished answer is replayed (one call in all), the name lane is
  asked again shown the answer; both land; no charge twice.

`test/fixtures/request-flow.mjs`: a stand-in for a scheduled job's
registration (`site_functions`), kept in `jobsRegistered`.

## 4. Remaining broad input scopes — necessary waits and implementation gaps

A wait is **necessary** when the waiting task's correct result depends on the
other's output or their writes conflict; it is an **implementation gap** when
the task waits only because the current code shows or plans it as reading
more than its result depends on.

| Wait | Kind | Why |
|---|---|---|
| Writes applied one job at a time (site lock, one publish per job) | necessary | concurrent writes to the same site's source and config would race; model work overlaps, application does not |
| A component on a new page, a function over a new table, a job running a new function | necessary | each consumes the other's output (SCH 3, PI 25) |
| One addition's apply is one publish; a question pauses its apply | necessary | the addition is applied whole or not at all |
| Logo step versus any page writer | necessary (write conflict) | the logo step rewrites the shared frame on every page |
| A table/function/API/job addition as its own part waits for page-writing parts | **gap** | every table addition runs the page writer, which must return a page and may choose any; a schema-only addition need not write a page, and its preparation could be scoped to the schema |
| Look step as a part waits for every page writer | **gap** | only the layout lanes read a page; value lanes (description, name, theme, language) read their own stored field; the planner cannot tell before the picker runs, but router targets could scope it |
| Rules step as a part reads every table | **gap** | a rule change for one named table could be scoped like a data change (`prepScope`) |
| Page step reads every page beside the one it writes | partly necessary, partly gap | the writer copies the site's design from sibling pages (necessary input), but it is shown their full content, so an unrelated text edit elsewhere invalidates its preparation; a design summary would be enough |
| Dispatched rungs inside one edit job run in turn | **gap** for the model work, necessary for the writes | each rung reads and writes stored state, so applying in turn is necessary, but their model calls could be prepared side by side where inputs are disjoint, as parts are |
| An addition's page writer is one call for every frontend kind | design choice, partly gap | one call keeps the pages coherent; splitting by page is possible but not done |
| Designers not yet started when a question ends the loop | **gap** | ready designers that the question does not reach are not started, so after the answer they run then (no redone work, but no overlap with the question either) |
| A page-writer question in an addition | gap (unsupported) | the add-on page writer cannot ask; a held-purchase re-run therefore never asks anything new |

## 5. Verification

- **Red check** (this round's tests over `44344896`'s `worker.js`,
  `builder/site-add.mjs`, `clarify.mjs`, `site-ask.mjs` and `request.mjs`,
  in a throwaway worktree): exactly SCH 1 ×2, SCH 2 ×2, SCH 4, PI 21, PI 27,
  PI 30, PI 31 and PL 2 fail; SCH 3 (the genuine chains) and every other case
  in the three files pass (34 of 44).
- **Mutation sweep** (`sweep11`, 7 files, green baseline): 13 product mutants
  and a comment-only control. The control survived. 9 were killed at once;
  4 survived and were each a question about the tests first:
  - *the picker shown `by`-tagged answers* — no case counted the picker's
    calls after an answer: PI 30 and SCH 4 now do;
  - *no settle before the add-on's question* and *starts allowed after the
    loop ended* — no case had a designer still out when another asked:
    **SCH 5** (new: the table asks at once, a slow page designer is still
    out, a component uses the page) kills both;
  - *earlier charged run jobs staged too* — **survives**: in every case in
    the four continuation files, the earlier run job of a re-run part charged
    nothing (`clarify` or a held purchase, `uncertain`; measured by logging
    every earlier job's ending), so no current path reaches it. The filter is
    kept as the guard against billing a replayed answer twice.
  Re-swept (`sweep12`): those three killed by SCH 5 / PI 30 / SCH 4, the
  control survived. **13 of 14 killed, 1 unreachable survivor.**
- **Full suite** on the code of `9070e706`: `10513 / 10513 / 0 / 0` locally
  (`10505` before; +8: SCH 1 ×2, SCH 2 ×2, SCH 3, SCH 4, NET, PI 31). SCH 5
  and the picker counts came after (records commit): the touched files 67 of
  67.
- **Doc tests** 32 of 32; acceptance entry points 11 of 11 with the new pin.
- **Required CI** on `acdf4748` (the code of `9070e706` plus the pin): unit
  tests 38154478033 `success`, site build 38154478000 `success`. CI on the records commit (SCH 5 and the picker counts) is read after its push.

## 6. Not verified live

Nothing here is deployed or pressed. Whether a real picker fills `uses` so
that a function that reads no table is declared independent, whether a real
designer asks only what it needs, and how often provisional results match the
official ones (each mismatch costs a fresh call) are unmeasured. Provider
concurrency limits are not measured. The universal feature stays unfinished.
