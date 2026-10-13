# A component on the page is not the request met; K3B prepared for two designers inside one Add-on (2026-10-13)

The owner asked for two tasks in one batch:
- fix the remaining boundary between observing a component and confirming
  its requirement (Codex's reproduction at `d0e76bdf`);
- prepare the exact K3B image-free scenario that tests two designers inside
  one Add-on, with in-press evidence, an honest not-exercised result and no
  automatic repeat.

**Nothing was spent, merged, deployed or built in this batch.** No paid
call, image or fal call, and no container build. Main stays `fef80b9b`;
production is deploy 2201, image `4444d9d53d906b8d`. The paid opt-ins stay
closed (the balance box admits no press). Every flag and limit, and every
completed test's result, is unchanged. Run 144 stays closed.

**The probe before this batch did spend.** Run 147 (`addon-kinds-3`,
2026-10-13) charged **9 credits**, balance 837 → 828. The earlier handoff
called it "not pressed" and said "nothing spent"; that wording is corrected
in `docs/owner-notes.md` and in
`docs/history/2026-10-13-attribution-corrections.md` (§6's heading and the
opening paragraph).

**Commits** on `claude/help-needed-ehlwlj`:

| Commit | What it is |
|---|---|
| `62bbd81b` | Presence is not fulfilment: every addition kept by itself (AT 10–17) |
| `abb57130` | K3B: the scenario and its in-press verdict (K3B 1–13) |

## 1. Codex's reproduction

**At `d0e76bdf`:**
- two card designs on `/visit`, one for free parking and one for dogs being
  welcome;
- the page writer rendered "Free parking." twice, in two new cards;
- `componentEvidence` returned `card` as `shown: all`;
- `requirementReport` fed the reply model "Added, and seen…" for **both**
  requirements, the dogs one included, whose words never appeared.

**The cause.** Evidence was aggregated per component *type*. Two new card
instances, each with shown words, made "the card" shown, and each
requirement whose design used a card was told added and seen. A component
being present said nothing about which addition it was, or what it said.

## 2. The fix: observations by addition; fulfilment stated as unchecked

**Evidence stays tied to each addition** (`builder/content-evidence.mjs`):
- each text keeps the new instance it sits in: the file and the instance's
  own position (`inst`). Two cards written identically are still two
  additions, never one;
- `componentOnRoute` returns `additions`: one entry per new instance of the
  component, with its own words and, for each word, what the published page
  showed (`seen`: true, false, or null when it could not be told). An
  instance with no readable words of its own is listed with none, up to the
  number of new instances found;
- the aggregate (`stored`, `shown`, `texts`) is unchanged, and still only
  says the component is there.

**Carried strictly to the stored outcome** (`builder/site-requirements.mjs`):
- `readContent` keeps `additions` through `readAdditions`, which reads every
  entry or drops the list whole (never shortened, never coerced);
- `contentOf` merges them; the requirement report hands them to the reply
  facts for `shown`, `behind` and `in-code`;
- **the stored state stays `unverified`.** No requirement is recorded as met
  because its component is present.

**The reply model's facts** (`builder/site-reply.mjs`):
- `shown`: "What this change added for it: a new card on /visit whose own
  words are “Free parking.”; a new card on /visit whose own words are “Free
  parking.”. The published page showed those words as it first loaded.
  Whether what was added is what was asked for is not checked here: …";
- `behind` and `in-code` say the same, with what was not on the first load,
  or that the page could not be read;
- a word the first load did not show is marked as such, and one that could
  not be confirmed is marked "not confirmed on the published page";
- "Added, and seen…" is gone. The untried-behaviour fact is unchanged.

**The deterministic note** (`toldNote`) now says "I've added something for
this … but I haven't checked that what it says is what you asked for".

**No keyword rules.** Nothing in code compares the request's words with the
addition's. The reply model is given both and judges the match; code only
keeps what was observed, addition by addition.

## 3. Tests (`test/content-attribution.test.mjs`, AT 10–17)

Each case checks the stored outcome and the facts the reply model is given.

| Case | Shape | What it shows |
|---|---|---|
| **AT 10** | Codex's: two card designs, "Free parking." in both | Two additions kept apart; both requirements `unverified`; the dogs facts list both "Free parking." additions and "not checked here"; no "Added, and seen"; no dogs words quoted as present |
| **AT 11** | One card designed for dogs, the writer wrote "Free parking." | Present, `unverified`; the facts quote what was really added |
| **AT 12** | Two designs, one card omitted | Unknown for both, never added, never seen, never missing |
| **AT 13** | Positive control: one card each with its own words | Both present and shown; each requirement's facts list both additions for the reply model to compare; fulfilment still unchecked, by design |
| **AT 14** | Codex's shape through the real Add-on route (`Card` from `@/components/ui/card`), plus a control | The stored record keeps each addition's words, both requirements `unverified`; the reply model is never told the dogs request was added and seen |
| **AT 15** | A card nested inside the new card; two new cards, one whose copy is computed | The nested card is part of its outer addition; the word-less card is still listed, and the facts say it has no words of its own that could be read |
| **AT 16** | Malformed additions (a `seen` that is not true/false/null, an empty word, no page or name) | The list is refused whole and never reaches the stored content |
| **AT 17** | Additions beside unseen, still to do, set up or already there | The reply's reader refuses them; beside shown, behind or in-code they read |

AT 15–17 were added after the sweep's first round (§5).

**Existing cases updated:** AT 2's control now also stores its one
addition; CE and AT deep-equals compare the aggregate apart from
`additions`, which are asserted explicitly; CC 7 and the CE wording
assertions follow the new sentences.

**Red check on `d0e76bdf`:** 4 of the 5 fail there. AT 11 reproduces
Codex's "Added, and seen" for the dogs request; AT 10, 13 and 14 fail for
want of the per-addition record. AT 12 (one card omitted, so unknown) already
passed on `d0e76bdf`, as the previous round's attribution made it.

## 4. K3B: two designers inside one Add-on, judged in the press

**The scenario** (`acc-addon-k3b`, `scripts/canary-ui.mjs`):
- K3B's words exactly, from `addon-kinds-3`: *"Add to the Order page,
  together: a short questions section answering 'Can I change my order?'
  with 'Yes, until 6pm the day before.', and one line under the collection
  times saying 'Orders open every Sunday at noon.'"*;
- `fold-lane-bakery`, request mode, the Add-on step, no image, the
  acceptance cap, funds checked first, one message, no repeat step.

**Why the current deployment suffices.** The deployed job (`fef80b9b`)
already marks, in its own trace:
- `pick_adds` ok with `kinds` (the picker's choice);
- each `add:<kind>` start, with `after` only when it waits for another;
- each designer's outcome.

The press already reads that job's record, its trace tied to it, and the
jobs around it (`readJobRecords`). So the verdict needs no new release. The
reporting changes of §2 are unreleased and are **not** pass conditions
(K3B 13 holds the verdict to the trace and the request view).

**The verdict** (`innerDesignVerdict`, `scripts/canary-requests.mjs`), in
order:
1. **Routing:** exactly one part, routed `addon`, nothing held back.
   Otherwise **not exercised**.
2. **The job:** that part filed exactly one add-on job, whose record was
   read. Otherwise unverified.
3. **Attribution:** exactly one trace tied to that job
   (`addonDesignOverlap`, which now names it). Otherwise unverified.
4. **Picking:** the last finished `pick_adds` names at least two designer
   kinds (`row` is not a designer). One kind or a failed pick is **not
   exercised**; no pick mark is unverified.
5. **Independence:** at least two picked kinds whose first designer start
   carries no `after`. Otherwise **not exercised**.
6. **Overlap:** those designers' calls crossed: **pass**. Ran one after
   another, or overlapped only outside the independent kinds: **fail**.

One Add-on routing answer alone proves neither the picking nor the overlap,
and is never a pass.

**In the press** (`scripts/edit-canary.mjs`), after the money checks and
before the evidence file:
- `INSIDE ONE ADD-ON  PASS | FAIL | NOT-EXERCISED | UNVERIFIED (stage)`,
  the picked and independent kinds, and the designer intervals;
- not exercised or unverified is a failed check plus a `NOT VERIFIED` line,
  "not retried; a second press is the owner's decision". Nothing repeats.
- `requests.inner` is saved in `ui.json`.

**Also checked in the same press** (existing verdicts):
- **outcome:** on `/order`, the questions section states "can I change my
  order", "until 6pm" and "the day before"; the line states "orders open",
  "every Sunday" and "at noon", with no other day; stored, and served with
  each question opened;
- **preservation:** `/order` keeps every word it had; every other stored page
  byte for byte; photographs and the logo as they were;
- **charging:** the press's own charges add up to the balance's move
  (`ownMoneyVerdict`), the estimate is a finding if exceeded, and later
  charges are read after observation stops.

**Tests** (`test/acceptance-addon-k3b.test.mjs`, K3B 1–13). Traces are
written by the real tracer (`newTrace`/`traceRow`), with the marks pinned to
the Worker's source (K3B 3):

| Case | What it shows |
|---|---|
| K3B 1–2 | The scenario's words, guards and facts; the balance box stays closed to it; the read-job note is replaced only for it |
| K3B 3 | The marks read are the ones the Worker writes |
| K3B 4 | Pass; a routing job beside the add-on job is ignored |
| K3B 5 | Not exercised: two parts, a part held back, an edit answer, nothing sent |
| K3B 6 | Not exercised: one kind, a kind beside the row step, a failed pick |
| K3B 7 | Not exercised: a designer that waited for the other; a picked kind never started |
| K3B 8 | Fail: no overlap; overlap only outside the independent kinds (with a pass control) |
| K3B 9 | Unverified: no record, two traces, another job beside it, a partial window, no pick mark |
| K3B 10–11 | Outcome on `/order`: both facts pass in other words too; a missing line, a wrong time, a contradiction, another day, a lost word and another page changed each fail |
| K3B 12–13 | Wiring order and no repeat; the verdict reads no reply facts |

## 5. Mutation sweep (scratchpad `jd1-sweep/`, in a worktree)

30 mutants, run from a verified-green baseline in a worktree:

| Group | Mutants | Result |
|---|---|---|
| Presence (M1–M16): instance key, outermost instance, seen flags, word-less instances, carrying additions to the evidence, the stored content, the report and the facts, the strict reads, the wording | 16 | **16 killed.** The first round killed 12. M2 (innermost instance), M4 (word-less instance not listed), M7 (lenient `seen`) and M14 (additions beside a non-observation) survived as untested edges. AT 15–17 were added, and all four were then killed. |
| K3B (K1–K12): routing parts, held-back parts, kind count, the row step, waiting, a failed pick, the overlap pair, no overlap, the trace tie, the returned `cid`, the job's op, a missing designer start | 12 | **12 killed** |
| Comment-only controls (C1, C2) | 2 | both survived |

The first run stopped at an anchor check before any mutant ran: two anchors
started at the wrong quote. They were fixed and the sweep was run again.

## 6. Suites

- focused: `content-attribution`, `content-evidence` and
  `parallel-addon-independent`, 87 of 87; `acceptance-addon-k3b`, 13 of 13;
  the canary and acceptance files, all passing after the scenario lists were
  updated (`canary-form` WIRE 2, the workflow's scenario box);
- **full suite on `abb57130`: `10800 / 10800 / 0 / 0`** (10,779 before,
  plus AT 10–17 and K3B 1–13).

## 7. Image

A release from this branch would build **`0e06c1826e3c3c00`** (206 inputs, read at `abb57130`),
against production's `4444d9d53d906b8d`, because three builder modules
changed. Nothing was built. The K3B press needs no release: it runs against
the current deployment.

## 8. The one K3B run: cost and approval needed

**Estimated cost: about 18–27 credits.** This is an estimate, not a cap; the
balance is the only bound.
- routing 3 (run 147's K3B);
- one Add-on job with a section and a line: 15–24. Measured: a section alone
  15 (run 144), a line alone 9 (run 135); one job shares the picker, page
  writer and judgment;
- if the router splits it into two parts, as it did K, about 30 (run 135).
  That press would report **not exercised**, and nothing repeats.

**What the owner needs to approve, for one run only:**
1. **The balance opt-in for `acc-addon-k3b` alone.** The balance (828) is
   above the 100-credit acceptance cap, and the box is closed. On approval, a
   commit names that one press in `BALANCE_OPT_IN`. After the run it is
   closed again.
2. **Image purchases off** (`IMAGE_PURCHASES`), then a redeploy of `main`
   with no code change, as for run 144; on again afterwards.
3. **The press**, from `claude/help-needed-ehlwlj`, with the scenario box
   `acc-addon-k3b`, spend `yes`, the deploy sha `fef80b9b`, the image
   `4444d9d53d906b8d`, and the balance box at the exact balance then.

No automatic repeat. Whatever the router or picker does is recorded once.

## 9. Limits and what is live-only

- An addition whose words come from a computed value, a prop default or a
  file the route does not list is listed with no words of its own; the reply
  model is told so, never that it matched.
- The reply model's judgement of the match is not tested live.
- K3B: the router answered one Add-on for these words once (run 147); the
  real picker's kinds and the designers' timing have never been read live
  for them.
