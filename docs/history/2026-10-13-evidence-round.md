# Run 141's remaining evidence work, offline (2026-10-13)

Free. No paid call, image generation, merge, deploy or container build. Run
141 stays closed. The reader and scoped-counter fixes from
`docs/history/2026-10-12-run141-followup.md` are kept.

## 1. Run 141's preparation record: no authorized read path (unconfirmed)

The record is R2
`requests/fold-lane-bakery/71b20ee310bf857b0310a9918215f201/prep/p1-1.json`.
Every read path available today was checked:

| Path | Reaches it? |
|---|---|
| Owner routes: `/api/site/request/…` (request view), `/api/site/source` (current pages), `/api/site/<slug>/versions` (version list and restore), `/api/site/edit/<job>` | None reads `requests/<slug>/<key>/prep/…` or `jobs/prepared/…`. The view carries only counts (`prepRun`, `prepUse`). |
| Supabase (`edit_jobs`, `edit_traces`, `credit_events`) | It is not there. A preparation writes no trace (the 22:58–23:12 window holds only part 0's and the Add-on job's). |
| This session | No R2 credentials. |
| The canary's read-job box | Reads Supabase only. |

**The rejected-correction explanation stays explicitly UNCONFIRMED.**

Two ways to confirm it, neither taken here:
- **The owner, free:** the Cloudflare dashboard, R2, the sites bucket, that
  key. Look for `unusable` on the second entry of `run.calls`.
- **A product change (not made):** a read-only owner route, or a canary box
  using the deploy's Cloudflare token. Either needs the owner's word and a
  deploy.

From now on the stored record carries what is needed without reading R2 (§2).
A preparation's per-call marks are served on the request view, and a
refusal's facts would be too under the design in §4.

## 2. Per-call task-marking diagnostics (built; preparations included)

`partMarks(req)` (`builder/prepared.mjs`) reads a model request exactly as sent
and keeps **numbers and a name, never text**:

| Field | What it records |
|---|---|
| `what` | the tool the call was made for (`tool_choice.name`) |
| `others` | how many other-part spans it carried, inside `⟦ANOTHER PART: …⟧` |
| `rule` | whether the rule sentence ("THE WORDS MARKED … ARE OTHER PARTS OF THE REQUEST") was there |
| `unmarked` | how many times another part's words appear in the request outside a marking and outside the done list (must be 0) |
| `done` | how many earlier parts the done list reports (their words are reported on purpose, so they are counted apart) |

A call with no part section is not a part's call and gives null.

**Recorded at the one boundary every model call of a part passes:**
- the recorder: a preparation's calls → `prepRun.step.marks` on the request
  view;
- the replayer: a job's calls, replayed or made now, with `replayed` → the
  job's `jobs/prepared/<id>.use.json` → `prepUse[].marks` on the view.

**How it is read back:** strictly (`readMarks`). A list that does not read, or
one longer than 100 entries, is null, meaning unknown and never "no markings".

**Tests:**
- `test/part-marks.test.mjs` (5), on the real `partBlock`:
  - one span with the rule and nothing unmarked;
  - a leaked span is counted;
  - the done list is excluded and counted;
  - no section gives null;
  - recorder and replayer order and the `replayed` flag;
  - strict read-back.
- `test/parallel-reuse-run141.test.mjs` R141 5: on run 141's own site, through
  the real Worker:
  - the Add-on's preparation (picker, designer, writer), its job (the same
    three, replayed) and the text job (its text step) each carried the other
    part's words once, marked, with the rule, nothing unmarked;
  - no request text is in the record.

## 3. The isolation check, corrected

**The owner's point:** a model shown an already-appended phrase may notice it
and leave it alone. So "the phrase appears once" cannot prove the Add-on
ignored another task. The verdict (`isolationVerdict`,
`scripts/canary-requests.mjs`) now combines three kinds of evidence:

- **What it was shown.** Every model call of both jobs, and of the Add-on's
  preparation when it ran, carried the other part's words only marked, with
  the rule, nothing unmarked (§2). Missing or unreadable marks are missing
  evidence, never a pass.
- **What each job did.** The canary now reads the page as served at the
  moment each run job's final answer is seen (`rec.between` in
  `scripts/canary-ui.mjs`, with `x-site-version`).
  - The three versions must be distinct, in order: before, after the first
    job, after the second.
  - Each job's own change is the difference between consecutive versions.
  - The Add-on's version must leave the heading line exactly as it found it.
  - The edit's version must turn the heading into the heading with the
    phrase.
  - A read that missed the window (the second job had already published, or
    nothing yet) is missing evidence, never a pass.
- **What it said.** The edit job's own answer applied a change naming the
  phrase. The final page carries the phrase once, straight after the heading.

**What a pass proves depends on the order, which is recorded:**

| Order | What a pass proves |
|---|---|
| **The Add-on first** | The change was still to be made while the Add-on ran. Its input carried it only marked, and its own published version left the heading alone. **The Add-on did not make another part's change** (`strength: "discriminating"`). |
| **The edit first** | The phrase was already on the page. An Add-on that left the heading alone is consistent with isolation and equally with a model that noticed the change already made (`strength: "consistent"`). The press says this in its unverified lines and never counts it as proof. |

**What stays unverified in any order:**
- why a model left the other part's words alone (the rule, or its own
  judgment);
- answers a preparation made that no job used;
- whether the router splits the message at all. A request not split into one
  edit part and one Add-on part is "not exercised", never a pass.

**Tests:** `test/canary-isolation.test.mjs` (10):
- either order;
- the Add-on making the change, in either sub-case;
- the Add-on touching the heading after the edit;
- the owner's case (left alone after the edit, so consistent only);
- every marks failure, including the preparation's;
- each missing-version case;
- not exercised;
- the edit's own answer;
- the wiring and the scenario;
- the driver, through the stand-in app: one read per job, with the served
  version, and none for a scenario that does not judge isolation.

## 4. Correction reuse: a safe design (not built)

`docs/history/2026-10-13-correction-reuse-design.md`.

**The rule it changes:** `readPrepared`'s "gives it to nobody", and
validation-scheduling §1's "never staged, replayed or handed to a
continuation" (pinned by VA 0–5 and UA 0–6).

The design keeps the refused answer exactly as unreachable as now. It stages
only the refusal's facts: reason, exact feedback, superseded requirements, and
a digest of the cleaner's input. A job whose first request (exact fingerprint
of the final request) and cleaner input both match then skips to the recorded
correction. That correction is still exactly matched, and still validated by
the job's own cleaner before anything is applied. Any mismatch falls back to
today's behaviour.

## 5. The old spending opt-in, closed

`BALANCE_OPT_IN` is now empty. The box refuses every press before the sign-in,
`acc-isolation` (run 141) included, with "the balance box is closed". The form
describes it as CLOSED.

`test/acceptance-balance-opt-in.test.mjs` was rewritten (7 cases): the closed
message for every press, malformed numbers still named, the end-to-end press
refusing with no network call, and the form.

## Verification

- **Focused files:**

  | File | Result |
  |---|---|
  | `part-marks` | 5/5 |
  | `parallel-reuse-run141` | 5/5 |
  | `canary-isolation` | 10/10 |
  | `acceptance-balance-opt-in` | 7/7 |

- **Red check** (the new tests against the branch head, in a throwaway
  worktree):

  | File | Result on the old code |
  |---|---|
  | `part-marks` | cannot load |
  | `parallel-reuse-run141` | R141 5 fails |
  | `canary-isolation` | 8 of 10 fail; ISO 7 and 8 are controls that hold on the old code |
  | `acceptance-balance-opt-in` | 4 fail |

- **Sweep:** 21 of 21 mutants killed across:
  - `partMarks`/`readMarks` and the recorder and replayer;
  - the three Worker plumbing points;
  - the two view readers;
  - six verdict mutants;
  - the driver read (never made, or made without isolation);
  - the closed box.

  Both comment controls survived.
- Commit `8626608a`.
  - Full suite: `10726 / 10726 / 0 / 0` locally. The first full run had one
    failure: `prepared-scope`'s exact `requestView` shape. It was updated so
    evidence written before marks reads `marks: null`, with a valid and a
    malformed case added.
  - CI: unit tests run 38330114781, `10726 / 10682 / 0 / 44 skipped`; site
    build run 38330114817, success.
  - Image prediction (from the commit): `eda28cb21064287d` →
    `16443a41923f7aeb`, 205 inputs.
  - Nothing merged, deployed or built.
