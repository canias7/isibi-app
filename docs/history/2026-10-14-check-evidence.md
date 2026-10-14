# The correction batch after Codex's review of branch `new` (2026-10-14)

**Status: on branch `new`. Nothing merged, deployed, built into an image,
switched on, pressed or spent. `PROGRESS_TALK` stays off.** Reviewed at
`f1c6f9b0`; this batch is `1e834200` and `d5d04a8e`, with its records on
top. The design as it now stands is
`docs/investigations/progress-talk-more-proposal.md`.

## 1. What was asked

Codex reviewed branch `new` at `f1c6f9b0` and asked for one correction batch
before any release:

- **Fix the red CI.** Unit run 38503645857 failed on one test:
  `test/no-emoji-replies.test.mjs`, *"an allowance matches nothing now —
  drop it: ★ Most popular"*. Diagnose why it failed on CI and not locally,
  and fix the stale allowance or the scanner without weakening the
  no-emoji rule.
- **Complete the check-evidence handoff** across Build, a standalone Edit or
  Add-on, and a combined request:
  - keep the checks that passed, what they found, the ones that were
    unavailable or partial, and whether it was published, each with its task
    and version;
  - give the final reply an accurate account even when narration failed, was
    skipped or came too late.
- **Remove `renderNote`'s "I had a look at the finished pages"** from what
  the customer is told, and hand the reply model the actual automated-check
  findings instead.
- **Keep five things distinct:** compilation, the automated browser check, a
  visual review, publication, and verifying the live page. Imply nothing
  beyond the evidence.
- **Check against the other session's branch.** Prepare an isolated check
  against the current head of `claude/help-needed-ehlwlj`, resolving shared
  files there, without merging either branch into production and without
  needing two releases.
- **Add focused offline cases** for:
  - every final-reply path;
  - unavailable and partial checks;
  - narration failure;
  - clarification and resume;
  - which task each update belongs to when parts run in parallel.
- **Keep** the existing persistence, ordering and duplicate protections;
  model-written wording; and platform-paid narration.

## 2. The red CI: the emoji test reads the running Node's Unicode tables

**Cause.** The scanner treated `\p{Extended_Pictographic}` as "an emoji",
and that property is whatever the running Node's ICU tables say:

| | Node | ICU | Unicode | ★ U+2605 counts as a pictograph |
|---|---|---|---|---|
| this machine | 22.22.0 | 77.1 | 16.0 | yes |
| CI (run 38503645857) | 22.23.3 | 78.3 | 17.0 | **no** |

Unicode 17 took **689 characters** out of the property and added none. Among
them are ★ ☐ ☒ ⚑ ✎ ☞, the mahjong and playing-card blocks, and most of
U+1F546–1F5FF. Read with both binaries, measured.

- Here, the scanner found the pricing badge's ★, and its allowance matched.
- On CI it did not, so the allowance matched nothing and the test failed.
- The same narrowing silently weakened **25 test files** that assert "no
  emoji in this reply" with the bare property.
- The plain checkmark ✓ (U+2713) and cross ✕ (U+2715) were never in the
  property on any version, so no scanner here ever saw them.

**Fix (`1e834200`).**
- `test/fixtures/pictograph.mjs` pins the set as one regular expression. It
  holds three parts:
  - Unicode 16's property, as 75 ranges;
  - ✓ ✕ ✗ ✘ ☆, which the property never had;
  - the running Node's property, in case a later Unicode adds characters.

  It can only find more than the bare property, never less.
- All 25 files use it.
- A new case, *"the scanner reads the same on every Node"*:
  - requires ★ ☐ ☒ ⚑ ✎ ✓ ✗ ✘ ✕ ☆ ✅ ✔ ⚠ 🎉 to be found;
  - requires → • – — £ é to be left alone;
  - refuses the bare property in any test file.

**Found for the first time, so allowed by name** (`test/no-emoji-replies`):
- **Interface controls and form notes:**
  - the menus' selection ✓;
  - the dialog and panel close ✕ buttons;
  - an automation step's remove ✕;
  - "Code re-sent ✓" and "Password updated ✓";
  - the pricing card's "✓ Unused credits roll over";
  - the file list's "Link preview ✓";
  - the component-list generator's ✓, whose output `docs/components.md` is
    compared byte for byte.
- **The build card's step marks and stage chips** (● ✓ ✕ ○, and "✓
  Designed"). These are progress, which the 2026-10-13 no-checkmark rule
  covers. But they are your own treatment E (2026-09-07), and a guard
  requires a failed step to differ from a done one by shape, not by colour
  alone. **Your choice, not changed**: in the backlog, with options to
  render for you.

**Measured:**
- The 26 changed test files: 935 of 935 on Node 22.22.0 and 935 of 935 on
  Node 22.23.3 (the CI version, downloaded for this).
- **CI green on `1e834200`**: unit run 38555418162, `10770 / 10726 / 0 /
  44`. That is the earlier total plus the one new case.

## 3. The check evidence, made once at the publish

`builder/check-evidence.mjs` (new). The publish makes the evidence as data.
The answer keeps it, and every final reply reads it from there.

| Field | Means | Said to the reply model as |
|---|---|---|
| `compiled: true` | the code built without errors (a publish refuses one that did not) | "compiled without errors. Compiling checks that the code fits together; it is not a look at any page." |
| `browser.ran` true, no findings | the automated check opened N pages in a browser and flagged none of what it looks for | "…flagged none of what it looks for (…). It is automated: nobody looked at the design." |
| `browser.findings` | each flagged kind with the page it was on (at most 12, then `more`) | "It flagged text that is nearly invisible (/menu and /), …, and N more findings not listed here." |
| `browser.cut` | the check was cut short | "…was cut short before it finished, so not every page was checked" |
| `browser.ran: false` | the check could not run, or its report cannot be read | "could not run, so nothing checked how the pages load" (never "clean") |
| `css` | the style rules this change wrote each match something on the page | "Each of the N style rules … was checked to match something on the page." |
| `published` | `activate` answered ok: the live pointer moved and the site's script went up | "Published: the new version is now the one the site's address is set to serve. Nobody opened the live address afterwards to confirm it." |
| `version` | the version that publish activated | **never said**: it scopes the evidence; the customer is told whose publish it was in their own words |

`readChecks` reads the evidence strictly. Any other shape reads as no
evidence. "Cannot tell" never reads as a check that ran, nor as one that
did not.

**Where it is made and kept:**
- **`recompileAndPublish`** returns `checks` on every publish. It is built
  from the full render report, including a clean one, which `render` leaves
  off the wire. All 13 places that copy a publish's result onto an Edit or
  Add-on answer copy `checks` too. A multi-step edit takes it from its one
  final publish.
- **Build:**
  - `publishPages` records the version the publisher activated (`out.version`).
  - The publisher now returns `{ files, version }`.
  - Both Build answers, the queued resume and the inline build, put
    `checks: buildChecks(pages)` in `buildFacts`. A build that did not go
    live gets none.

**Where it is read (`builder/site-reply.mjs`):**
- **An Edit or Add-on reply** (synchronous or queued) reads `k` facts from
  the answer's own `checks`.
  - An answer stored before the evidence existed gives only what its browser
    check flagged. It gives nothing about the compile or the publish, which
    it does not record.
  - `renderNote` is never a fact.
- **A Build reply** reads `buildFacts.checks`.
- **A combined request's reply.** `writeRequestReply` reads each part's
  finished jobs' stored answers (`partChecksFor`), and each check is said
  under that part's own words, "For “…”: …". A part that published more
  than once gets "(its 2nd publish)".
  - A request reply is written only when there is something to add. When
    every part finished with its own reply, each part's checks are in that
    reply.
- **`jobChecksFor` is gone.** The progress record is narration's. With the
  switch off, narration failed, its record lost, or its tasks late, the
  reply is handed the same checks.

**The reply instructions.**
- `REPLY_SYSTEM` defines `k` for every reply: *"a check, made or not made,
  exactly as far as its text says"*.
- It adds one rule: *"Name only the checks a k fact states, each no further
  than its words: code that compiled was not looked at; an automated browser
  check is not anybody looking at the design; published is not anybody
  opening the live site. Never say or suggest you looked at, reviewed,
  tested or confirmed anything else."*
- `REPLY_TALK_RULES` no longer defines `k`.

**`renderNote`** is still the fixed line the page shows when no written
reply is there.
- It now says *"An automated check that opened the finished pages in a
  browser flagged: …"*.
- A page the check cannot reach "was not checked with real data", where it
  used to say "I couldn't see it".
- The progress record's check wording reads the same finding kinds as the
  reply's (`FINDING_SAID`).

## 4. Tests

**`test/check-evidence-flow.test.mjs` (14, new).** It checks state, not
prose, and every model answer is supplied.
- **The module:**
  - EVIDENCE: made and read strictly;
  - FACTS: each check said as far as it reaches; cut, not run and
    unpublished said as such; no version id; scoped and numbered;
  - INSTRUCTIONS.
- **Each fact builder:**
  - EDIT AND ADD-ON: the evidence becomes `k` facts; `renderNote` never
    does; an old answer gives only its findings; none gives none; malformed
    gives none;
  - BUILD;
  - COMBINED REQUEST: each part under its own words, in order; another
    part's check is never given.
- **Through the real Worker:**
  - an edit with narration off;
  - an add-on whose browser check could not run;
  - one cut short with a finding;
  - narration refused, with its record deleted before the reply;
  - two parallel parts: each job keeps its own evidence and version, and no
    request reply is written when each part said its own;
  - a combined request with one part failed: the request's reply carries the
    done part's checks under its words, and none for the failed part;
  - a question, then its resumed job: the question carries no checks, and
    the resumed publish's checks go to its reply alone;
  - a queued Build: its facts carry the evidence with its version, and the
    reply writer is handed every check;
  - an inline Build that did not go live: no checks. Its publish wire is
    read from the source, because no fixture drives an inline build to a
    publish.

**Existing tests changed, each for a stated reason:**

| File | Change | Why |
|---|---|---|
| `progress-talk-flow` | CHECKS AND PUBLISH and OFF compare the reply's `k` facts with the answer's evidence | they asserted the old record-based facts |
| `model-replies` | the render sentence is no longer a fact; the evidence is | it pinned "the render sentence" as a fact |
| `model-replies-routes`, `mixed-work` | the step's own facts are compared with the checks set aside, and the checks get their own assertion | exact fact lists |
| `progress-flow`, `reply-background`, `model-replies-routes` | two runs are compared with the version id normalised, as the job id already was | the evidence names a random version per run |
| `site-render` | "the note reads as a second look" becomes "says an automated browser check flagged it, never that anybody looked" | it pinned the claim being removed |
| `build-answer` | the note's new sentence | the same |
| `wiring` | the wording edit's answer line now carries `checks: out.checks` | an exact-source guard |
| `dockerfile` | (no change) caught the missing COPY | the job runner's worker tree now carries `builder/check-evidence.mjs` |

**Mutation sweep.**
- 30 mutants, one per property:
  - the evidence: run, cut, not run, cap, CSS, the strict reader;
  - each fact's reach;
  - the version id kept unsaid;
  - the request's scoping and numbering;
  - `renderNote` kept out of the facts, and the old answers' fallback;
  - the Build reply;
  - the reply instructions and the `k` prefix;
  - each Worker wire: publish, merged edit, add-on, request, both Build
    sides;
  - `buildFacts`, the Build version;
  - `renderNote` and `unmet` wording;
  - the pinned pictograph set;
  - the progress kinds.
- **29 killed on the first pass.**
- The survivor dropped "only" from *"Name only the checks a k fact states"*.
  It was a missing assertion: added, and the mutant is killed on rerun.
  **30 of 30.**
- The comment-only control survived.

**Full suite:**
- **Locally on `d5d04a8e`: `10784 / 10782 / 0 / 2`** (the two skips are the
  template's browser cases, whose dependencies are not installed here).
  Before the batch, on `f1c6f9b0`: `10769 / 10767 / 0 / 2`.
- **On the integration merge (§5): `10876 / 10874 / 0 / 2`.**
- **CI on the pushed head `e8426dbc`** (read after the runs, from each job's
  own fields and the unit step's log):
  - **unit tests**, run 38561669854: `10784 / 10740 / 0 / 44`. Same total as
    the local run; CI skips 44.
  - **site build**, run 38561669952: all eight jobs succeeded, including
    the `all checks` gate.
- The first full run of the uncommitted batch failed 10:
  - 8 were tests pinning old fact lists or source lines (fixed above);
  - one was the image guard: a new input not yet committed;
  - one was `progress-live-writer` PLW 1, which passed 5 of 5 alone and in
    every later full run. It is likely load-sensitive, like PLW 4, which is
    already in the backlog.

## 5. The integration check against the other session's branch

- **Where:** a separate git worktree at `/home/user/integ`, detached at
  `claude/help-needed-ehlwlj`'s current head **`4586c678`**, fetched just
  before.
- **What:** branch `new` at `d5d04a8e` merged into it, with a local merge
  commit **`8d2b4351`** that is **never pushed**. Neither branch was moved.
- **Conflicts, two, both textual:**
  - **`Dockerfile`**: both branches add one module to the job runner's
    worker-tree COPY line (theirs `content-evidence.mjs`, ours
    `check-evidence.mjs`). Resolved by keeping both, in alphabetical order.
  - **`docs/owner-notes.md`**: both branches prepend entries to the
    newest-first log and the handoff. Resolved by keeping both, theirs then
    ours.
- **Merged without a conflict:**
  - **The canary scripts** (`scripts/canary-ui.mjs`, `canary-additions.mjs`,
    `edit-canary.mjs`), where a conflict was expected. Read after the merge,
    every ✅/⚠ left in `scripts/` is in a comment, so nothing reads a symbol
    `new` removed.
  - **`builder/site-reply.mjs`, `site-render.mjs` and `worker.js`** also
    merged cleanly. Their `content-evidence.mjs` reads the render report's
    new `texts`, which `checksOf` neither reads nor copies.
- **Result: the full suite on `8d2b4351` is `10876 / 10874 / 0 / 2`.**
- **Image predicted:** `e83931028c001b76`, 207 inputs.

## 6. Container image, predicted only (nothing built)

| Commit | Image | Inputs |
|---|---|---|
| `main` `fef80b9b` | `4444d9d53d906b8d` (production's, reproduced) | 205 |
| `new` `1e834200` | `de8c30066bf602a1` (unchanged by the scanner fix) | 205 |
| `new` `d5d04a8e` | **`13b722b05e3748b6`** | 206 |
| `claude/help-needed-ehlwlj` `4586c678` | `0e06c1826e3c3c00` | 206 |
| integration `8d2b4351` | **`e83931028c001b76`** | 207 |

## 7. One release, proposed (each step needs your word)

The integration shows the two branches combine with two textual
resolutions. So there is **one** release, not two:

1. Choose when `claude/help-needed-ehlwlj` is ready (its own reviews and
   presses are its session's).
2. Make the candidate: that branch's head with `new` merged in, resolved as
   §5 says. Re-run the full suite and the site build on it, and predict the
   image again (`e83931028c001b76` for today's heads).
3. Rehearse the rollback in a throwaway worktree: `git revert --no-commit
   main..<candidate>` must give back `main`'s own tree.
4. Fast-forward `main` to the candidate: one deploy run, then 15–20 minutes
   for the image roll, then your free runtime press (sha and image).
5. `PROGRESS_TALK` stays **off** through that release. The check evidence,
   the `k` facts, the new `renderNote` line and the emoji rule are live in
   it regardless of the switch.
6. Then, on your word: `PROGRESS_TALK` = `on` (a redeploy with no code
   change, image reused) and the one live verification below.

## 8. The one consolidated live verification (prepared, not pressed)

**One press session, three paths, one new site, image purchases off for its
duration.** Steps:

1. **Build.** A first build of a one-page site on a fresh slug, verified
   free first, with a brief that asks for no photographs. Read:
   - the conversational record's plan;
   - the container's turn ("built");
   - `buildFacts.checks` on the stored answer (compiled, the browser check,
     published, version);
   - that the build's final reply names no check its evidence lacks.
2. **One message, three parts.** (a) an Edit: a heading's wording; (b) an
   Add-on: a simple FAQ page, no photograph; (c) a menu link to the new
   page, which needs (b). Read:
   - each part's lines on its own part;
   - (c) waits for (b), and its writer is told why;
   - each job's record: `start`, then its checks, then `published`;
   - each job's stored `checks`, with a different version per publish;
   - each job's final reply against its own evidence: no "I had a look", no
     "it's live" beyond "published", a browser check said as automated;
   - the request's own reply, if one is written: each check under its
     part's words;
   - how many milestones each writer call covered.
3. **Reconnect.** Close the tab while (b) runs, and reopen it in a fresh
   session. Read:
   - the same lines and explanation;
   - no line committed after any job's end;
   - the order of lines and final replies.

**Evidence kept:**
- each job's `jobs/<id>.progress.json` and stored answer (free reads);
- the request record;
- screenshots at intervals;
- the final replies;
- the ledger rows (narration never makes one);
- `scripts/narration-usage.mjs`'s priced read of every narration call.

**Realistic customer cost: about 17–65 credits:**
- the build: 11–45;
- routing: about 2;
- the wording edit: 1–3;
- the page add-on: 2–13;
- the menu link: about 2.

Narration is platform-paid, measured and not in that range. Nothing caps a
request, so only the balance bounds it.

**What it would show:** one real model's prose against the evidence, for one
sample, read by you. It cannot show the prose is always truthful.

## 9. Limits: resolved and remaining

**Resolved by this batch:**
- **The checks reached the final reply only through the progress record.**
  They now come from the answer, so they arrive with the switch off, with
  narration failed, with the record lost, or with its tasks late.
- **The checks that could not run were not handed over.** A check that
  could not run, one cut short, and each finding by page now reach the
  reply.
- **The Build reply and the combined-request reply got no checks.** Both
  now get them, scoped to the part and to which of its publishes.
- **`renderNote`'s "I had a look at the finished pages"** is gone from the
  reply facts, and its fixed line says what the check is.
- **CI and this machine disagreed about what an emoji is.** The set is now
  pinned for every Node.

**Remaining:**
1. **The prose itself is not verified.** The instructions and the facts
   stand against an overclaim; nothing checks the words.
2. **No visual review and no read of the live page are ever made.** The
   facts say so; they do not do them.
3. **A lost Build that recovery finds did go live** carries no evidence (the
   recovery has no render report). Its reply claims no check, and says it
   went live from recovery's own facts. A recovered Edit or Add-on answer is
   not written by the model at all (`recovered`), so it keeps its fixed
   sentence.
4. **The inline Build's publish wire** is shown by a source guard only.
5. **The build card's ✓ and ✕ marks** are waiting for your choice.
6. **Unchanged from the talk batch:** few recorded reasons, and the
   3-second wait not yet measured.
7. **Everything here is supplied-model evidence.** The live verification is
   the first real model's sample.
