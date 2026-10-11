# 2026-10-11 — Independent tasks run together: page edits and table edits

> **CORRECTED the same day, after Codex's review of `1694dc88`.** The re-base
> described in §2 was **wrong and has been removed**. Its lexical checks did
> not prevent wrong reuse: in Codex's reproduction (Monday opening 09:00 →
> 08:00; the Dark Rye's price set to two pounds less than that hour; the
> router omitted the read), the preparation answered 7 from the old hours,
> the re-base carried 7 onto the changed site, and the job recorded
> `rebased: 1, fresh: 0`. The correct value was 6. The claims below that
> the re-base "can't make a wrong change land" and is "conservative: never
> a wrong re-base" (§5) are false. Separately, the replayer returned the live
> send untouched when no answer was recorded, so an image-only preparation's
> fresh call went uncounted (`missed: 0`). What replaced both — exact replay
> of a step shown only its declared scope, with a way to say it needs more,
> and a replayer that counts every call — is
> [`2026-10-11-exact-reuse.md`](2026-10-11-exact-reuse.md). The text below is
> kept as the record of what was claimed.

Codex reviewed `625bf4ee` and passed all 46 focused tests; the reuse and
counting fixes are kept. Codex then reproduced the remaining gap in the
original goal ("independent tasks run together unless they need another
task's result or conflict with its changes"):
- two text edits targeting separate pages, and two data edits targeting
  separate tables, declared non-conflicting targets;
- yet `clearToPrepare` refused both, because `stepInputs` planned the text
  step as reading every page and the data step as reading every table.

**Commits**: `bd635405` (the change), `ebcc1d70` (declared reads never
narrowed), with records after.

**Image prediction**: production `8d6dbcea93252fbb` → `ca9893133acc43b6`
(206 inputs; the new module is in the image's worker tree). Not built.

No merge, deploy, paid call, real image or image retry. Build's limits and
flags are unchanged.

## 1. What each step's model actually reads

- **The text step** (`textRequest`, `builder/site-apply.mjs`) is shown every
  page's text, numbered, on purpose. A phone number in every footer must be
  changed everywhere, and a truncated list escalates rather than
  half-editing.
- **The data step** (`dataRequest`) is shown every table's rows. Its token
  room (`max_tokens`) grows with all of them.
- **That context is necessary, so it is not narrowed.** Hiding other pages
  or tables would hide context the model needs. What narrows is the step's
  dependency. *(Superseded: narrowing the dependency without narrowing what
  the model sees is what let a stale answer through. A prepared step is now
  shown only its scope and can ask for the whole site — see the correction
  at the top.)*

## 2. The change

**The plan's narrowing** (`builder/request-plan.mjs`):
- `prepScope(part)` gives a text step whose every write names a page those
  pages, and a data step whose every write names a table those tables.
- `stepInputs` uses that scope, so `clearToPrepare` prepares two such parts
  side by side when their targets don't overlap.
- **It is never narrowed for**:
  - a step whose route names another page than its targets;
  - a step with any write beyond pages or tables;
  - a step with no named targets;
  - **a step that declares any read** ("make the About line match the
    Visit heading");
  - rules, look, menu, page writer and add-on steps, whose reach the model
    decides inside the step;
  - a part still to be routed.
- **Also fixed**: a placed picture (`images`) now feeds every page-scoped
  input, because a picture with no page named lands on some page.

**The re-base at apply time** (`builder/prepared-rebase.mjs`):
- **When**: after the first part is applied, the second part's request no
  longer matches its preparation byte for byte. Exact replay used to make
  the job ask again.
- **What happens now**: the job re-bases the prepared answer onto its
  request, only when all of these hold:
  - the step, its instructions, its tool and its own words are unchanged
    (for data, only the token room may differ, and only if the prepared
    answer did not hit it);
  - everything inside the declared scope is byte for byte as prepared;
  - the answer touches nothing outside the scope;
  - **no change outside the scope carries the words the answer changes or
    writes**, compared on lower-cased words with punctuation removed. A
    change elsewhere that shares those words is a consistency question, so
    the job asks the model again.
- **How the answer carries over**: text answers' line numbers are
  re-pointed at the same lines of the same pages. Data answers name rows by
  table and id, which do not move.
- **Mechanics**: prepared calls now keep their request (`q`) so a re-base
  can be checked. The replayer tries an exact match first, then a re-base,
  then a fresh model call.
- **Billing**: a re-based answer is billed by the job like an exact
  replay, through its own reserve.

**Durable per-job evidence**:
- every job that had a preparation writes `jobs/prepared/<id>.use.json` with
  `replayed`, `rebased`, `fresh` and `images`;
- the request's view serves it per part as `prepUse: [{ job, replayed,
  rebased, fresh }]`;
- a later live check can read reuse directly, instead of inferring it from
  timing.

**Unchanged**:
- **Publication**: one job per request and one writer per site; the request
  record and the pointer are written on their etags.
- **Recovery, questions per part, and model-written progress**: the
  existing suites are green.
- **Build**: nothing in its limits or flags.

## 3. Tests

**`test/parallel-independent.test.mjs`**, through the real request driver,
queue consumer and routes, with supplied answers:
- **IND 1, two text edits on separate pages**:
  - the About line's text call runs during the Visit heading's held job;
  - applied after the heading changed, the answer is re-based, with no
    second model call;
  - the job's record says `{ replayed: 0, rebased: 1, fresh: 0 }`;
  - the recorded intervals overlap and the verdict passes;
  - both changes are kept, and each job charges once.
- **IND 2, two row changes in separate tables**: the same, for `hours` and
  `loaves`.
- **IND 3, conflicts still wait**:
  - two text edits on the same page, and two row changes in the same table,
    never do their step's model work during the first job;
  - both changes are kept.
- **IND 4, a changed input is asked again**:
  - the heading's new text carries the words the About part changes, so the
    re-base refuses;
  - the About job asks fresh (`{ rebased: 0, fresh: 1 }`);
  - both changes are kept.

**`test/prepared-rebase.test.mjs`**, each rule alone:
- re-pointing a text answer when another page's lines grew;
- every text refusal: the scoped page changed, an edit outside the scope, a
  question, other words, another frame, a clash on changed or written
  words, no scope;
- the data re-base and its refusals: the scoped table changed, an answer
  outside the scope, an answer cut at its token limit, other words, a
  clash, a question;
- the replayer's order (exact, then re-base, then fresh) and its counts;
- `prepScope`'s refusals, including declared reads.

**Changed**: `parallel-plan`'s `used()` shape gains `rebased`.

## 4. Verification

- **Red check on `625bf4ee`'s code**: IND 1 and IND 2 fail (the second part
  stops at `routed`, Codex's reproduction), and IND 4 fails. IND 3, the
  conflict control, passes there too.
- **Sweep**: 18 of 18 mutants killed, and the comment control survived. The
  mutants cover:
  - each scope rule and the declared-reads rule;
  - the placed-picture feed;
  - each re-base check;
  - the replayer's re-base;
  - keeping the per-job record;
  - staging the scope.
- **Related suites**: 414 of 414 (parallel, request, progress and
  re-base); image tests 38 of 38.
- **Full suite**: `10394 / 10394 / 0 / 0` locally, on `bd635405` and again
  after `ebcc1d70`.

- **CI on `e0e20e7e`** (one push): unit tests 38118494730 green (5 m 22 s);
  site build 38118494731 green.

## 5. Remaining limitations

- **Narrowed only for text and data steps.** Rules, look, menu, page writer
  and add-on steps still depend on the whole of what they read.
- **Depends on the router naming targets.** None named means the whole
  site, as before. ~~A router that names too narrow a target can't make a
  wrong change land: the re-base refuses in-scope differences and word
  clashes.~~ **False** (Codex, on `1694dc88`): an omitted read let a stale
  numeric answer land. A dependency that shares no words was not caught
  either.
- **The clash check is lexical**, on words of three characters or more.
  ~~It is conservative: unrelated shared words cause a fresh call, never a
  wrong re-base.~~ **False**: it cannot see a dependency in meaning, so it
  re-based wrongly. Removed.
- **Publication stays one job at a time** (coordinated by design). The
  overlap is the model work; writes are serialized.
- **Nothing is live**: none of this is deployed or pressed. The canary does
  not read `prepUse` yet.
