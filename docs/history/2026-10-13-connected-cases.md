# The connected Edit/Add-on cases, carried to the reply model's facts (2026-10-13)

The owner asked for one consolidated batch, not a stop after each small issue:
- finish the reporting corrections;
- cover the connected Edit/Add-on cases together, reusing the existing tests
  and evidence and adding offline cases only where coverage was missing;
- fix any failure found within the batch;
- keep observed success, missing work and unverified behaviour accurate all
  the way into the reply model's facts.

**Nothing was spent, merged, deployed or built.** No paid call, image or fal
call, and no container build. Main stays `fef80b9b`, and production is deploy
2201. The Build flags, the page and component limits, the task-isolation
guards and correction reuse are unchanged. No completed live test was
reopened, and no Build audit was started.

## 1. The reporting corrections (`9a0c6bed`)

These are the three gaps left open by the interactive-content fix
(`docs/history/2026-10-13-interactive-content.md` §§4 and 6).

| Gap | Correction | Test |
|---|---|---|
| Two components designed for one page shared that page's added texts, so one that was written could vouch for one that was not. | Each reads only the texts inside its own tag or part file. When it has neither words nor a tag of its own on a page others share, it reads **unread**, never present. | **CE 15** |
| The repaired build's text replacing the first compile's was untested (the sweep's one survivor). | `publishedTexts(built, repair)`, a tested helper: the repaired build's render when a repair recompiled; nothing when that recompile has no report; the first compile's otherwise. | **CE 13** |
| The canary's console count included the app's re-reads of earlier jobs (run 144's replayed 422). | `consoleLine` tells apart errors logged before the first message. It counts whole when the times do not line up or nothing was sent. | **CE 14** |

## 2. The coverage map, before this batch

The existing tests for each of the seven cases (read from the tests, not
from memory):

| Case | Already shown, offline | Missing |
|---|---|---|
| Several requirements on one page | PI 1, PI 32 and PI 34 (several kinds in one addition); CE 15 (two components on one page) | An Edit and an Add-on on **one** page in one request; two Add-on parts writing **one** file |
| Independent tasks actually overlapping | PI 1–3, PI 32, PI 34 and PI 36, by rendezvous | Reply facts on an overlap |
| Dependent tasks waiting | PI 4, PI 5, PI 25, PI 26 and PI 35 | Reply facts on a dependency that succeeded |
| Changes to one target keeping each other's work | PI 4 (a shared target is serialized, different files), PI 6 (a stale preparation is refused), PI 37 (isolation) | A lost update on one file; reply facts |
| A question pausing and resuming the right task | PI 30 and PI 31 (inside one addition), P-series clarifications | Two Add-on parts, one asking; reply facts at the pause and after the answer |
| One task failing without losing another's work | PI 8 (a refused picture), P1c, SP 4 | Reply facts on an Add-on or Edit part failing beside one that succeeded |
| Retries reusing results with no duplicate work or charge | P5 and P6 (Edit parts), PI 7, PI 16, PI 19–21 (pictures) | An Add-on job lost after its charge: refund, rerun from its preparation, one reply |

## 3. The new cases (`test/parallel-addon-independent.test.mjs`, CC 1–7)

All of them run through the real request driver, queue consumer, routes and
job runner, with supplied model answers and no network. Each reads what the
reply writer was given (`P.replyLog`), as well as the site, the jobs and the
ledger.

| Case | What it does | What it shows |
|---|---|---|
| **CC 1a / 1b** | A questions section and an About heading change, both on `/about`, in each order | Both land, each once. The second job builds on the first's page (serialized on the shared page). The facts say "Updated /about." and the heading's new words. Nothing is told as not done. One charge per job. |
| **CC 2a** | Two Add-on parts writing `/about` | Both sections land, each once, with the story kept. Both replies say About was updated. |
| **CC 2b** | The second part's writer answers from the page as it was **before** the first part's section (a lost update) | It is refused (`rewrote`). The first section stays on the site, and the refused one is never published. The facts say the second "Nothing was added", with the words it would have lost. The request summary names it as not done. The first part's success stands, told once. |
| **CC 3** | Two Add-on parts on two pages; the About part's designer asks a question | The Visit part finishes while About waits. At the pause the facts say "Updated /visit.", "Nothing was added yet; one detail is needed first.", and the question quoted, with nothing told as done for About. The answer resumes only About. The finished part's job is never run again and never told again, and the new reply says "Updated /about." |
| **CC 4** | The Add-on part's page writer fails on our side (provider 529) beside a heading change | The heading lands and stays. About is untouched. The failed job's answer reads "nothing made, nothing published", with no charge (no reserve row). The facts say the heading's change, and "Not done: … — its own reply above says why". Nothing is claimed for the section. |
| **CC 5** | The Edit part's step finds nothing to change beside an Add-on | The section lands and stays. Home is untouched, and the edit is not charged. The facts say "The change was not made", "Nothing on their site changed." and "This change cost them nothing." beside "Updated /about.". The summary says which part was done and which was not. |
| **CC 6** | The Add-on part's own job is lost just after its charge (the Add-on twin of P5) | The sweep refunds it (net 0). The part runs once more, charged once. The picker, designer and page writer are each asked once, the rerun using the preparation. The finished heading part is not run again. One section is on the site and one reply says so. |
| **CC 7 / 7b** | A collapsed questions section added as one part of a request beside an edit, its reply written in the background from the stored answer | **7:** the job's answer says `behind` with the hidden answer, and the background reply's facts say "not shown when the published page first loads … not checked", with the words, never "can't see". **7b:** with the published page unread, `in-code`: "could not be read, so whether it shows is not known", never shown and never missing. |

Reply-fact checks were also added to two existing cases:
- **PI 35** (a dependent part waits for a new page): once it runs, it is
  told as done, once, and nothing as not done;
- **PI 36** (three parts, two Add-on preparations overlapping): each part's
  own success is told once, and nothing as not done.

## 4. What failed, and what was fixed

- **Product failures found by the new cases: none.** Every connected case
  behaved correctly on the first run that exercised it as intended.
- **Test-side problems found while writing them** (none of them a product
  fault):
  - CC 6's first hang predicate named a field the reserve call does not
    carry; it is matched by the job's id now.
  - CC 7's judge stand-in misread its input (a fixed offset); it reads past
    the heading now.
- **Checked, and not a defect: CC 4's failed Add-on has no model-written
  reply of its own.** A provider failure is a technical failure (`generate`,
  in `TECHNICAL`), so its job's fixed sentence is what the chat shows ("The
  builder is busy — try again in a moment."). The request summary's "its own
  reply above says why" refers to that sentence. This is the existing rule
  (technical failures keep fixed sentences), which the owner has not
  reopened ("Not yet" to the fixed-sentence audit).
- **Checked, and accurate: "It has not run yet … done separately after this
  one"**, the fact a part's reply carries for a later part. Overlap happens
  between one part's job and another's **preparation**. Jobs themselves run
  one at a time per request (`nextStep`), so the later part has truly not
  run when that reply is written.
- **Checked, and accurate: the request summary names part 0 by its own
  words with each held part replaced by "…"** (`shownWithout`). It never
  claims the held parts.

## 5. Mutation sweep (scratchpad `hb-sweep/`)

Product mutants, run against the CC cases and PI 35/36:

| Mutant | Result |
|---|---|
| M1: a failed part told as queued (request summary) | killed: CC 2b, CC 4, CC 5 |
| M2: the kept-prose guard off | killed: CC 2b |
| M3a: content cut from the stored record | survived here; **killed by CE 11** |
| M3b: content cut from the requirement report | killed: CC 7, CC 7b |
| M4: conflicting parts prepared together (`clearToPrepare`) | survived here; **killed by `routedForPrep` and P3b** (27 request and plan files) |
| M5: the question not quoted to the reply model | killed: CC 3 |
| M6: a waiting addition told as updated | killed: CC 3 |
| M7: a failed part told as done | killed: CC 2b, CC 4, CC 5 |
| C1, C2: comment-only controls | both survived |

**6 of 8 were killed by the new cases, and 8 of 8 by the suite.** Both
survivors are guarded elsewhere:
- M3a's stored record is read by CE 11.
- M4's shared-page cases are also caught by the next line (`partFeeds`);
  the shape where only `conflicts` matters is covered by P3b.

## 6. Full suite

**`10766 / 10766 / 0 / 0` locally**, on the tests committed as `da8dd276`
(the code of `9a0c6bed`). That is 10,753 at `edfabc3e`, plus CE 13–15, plus
the 10 CC cases. Before it, the focused file read 52 / 52.

**Image:** test files are not container inputs, so the batch moves nothing.
A future release from this branch would build `6b66dc466b933115` (206
inputs, read at `9a0c6bed`), against production's `4444d9d53d906b8d`.
`98c56f9b20da4403` was the prediction at `88dec2a0`, before `9a0c6bed`
changed `builder/content-evidence.mjs`.

## 7. What still needs a real-model run (none run here)

Everything above uses supplied model answers. Not shown:
- **Whether the real router splits these messages this way:**
  - an Edit and an Add-on on one page;
  - two additions on one page as two parts (its instructions make them one
    `addon` answer when it can make them all, so CC 2's shape needs an edit
    as the message's answer, as PI 36 notes);
  - a designer asking while another part is independent.
- **A real page writer facing a page another part just changed** (CC 1b,
  CC 2a). The stand-in writer builds on the page as it is; a real model
  might not, and then the kept-prose guard refuses it, as CC 2b shows.
- **A real reply model writing from these facts**, especially:
  - the waiting-plus-done pair (CC 3);
  - the failed-beside-done pairs (CC 4, CC 5);
  - `behind` and `in-code` inside a request (CC 7).
- **The render check's first-load text from a real container**
  (`textProbe` is unit-tested only).
- **A lost job in a real container** (CC 6 is the sweep's path under the
  stand-in clock and ledger).
