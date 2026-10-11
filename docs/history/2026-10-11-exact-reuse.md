# 2026-10-11 — Prepared answers reused only by exact replay of what the model saw

Codex reviewed `1694dc88`. 65 focused tests passed, but two independent
checks found defects:

1. **A stale numeric result through the real request flow.**
   - The router deliberately omitted a read dependency. Task 0 changed
     Monday's opening from 09:00 to 08:00; task 1 set the Dark Rye's price
     to two pounds less than that opening hour.
   - Task 1's preparation answered 7 from the old hours. `rebaseData`
     applied 7 after the hours changed, marked both parts done, and recorded
     `rebased: 1, fresh: 0`. The correct value was 6.
   - **An omitted read was treated as proof that changed context was
     irrelevant.** The lexical clash checks cannot see a dependency in
     meaning.
2. **False evidence for an image-only preparation.** `replayer.wrap`
   returned the live send itself when no call was recorded. An image-only
   prepared record made a fresh model call while `used().missed` stayed 0.

**Commits**: `c5f4cb45` (the change), with records after.

**Image prediction**: production `8d6dbcea93252fbb` → `771ff668c8624677`
(205 inputs; the deleted module is out of the image's worker tree). Not
built.

No merge, deploy, container build, paid call, real image or image retry.
fal stays funded and off limits. Build's limits and flags are unchanged.

## 1. The design

**Reuse rests on exactly what the model was shown.**
- A prepared part's step (text or data, with a declared scope from
  `prepScope`) is **shown only that scope**. The text step gets the named
  pages' words, plus word-for-word copies of those lines on other pages
  (its own rule changes every copy). The data step gets the named tables'
  rows, their just-removed rows and their lists. Each is told the names of
  what is left out (`NOT SHOWN`).
- Its tool gains one field, `needs`: set it, and change nothing, when what
  was asked depends on anything not shown. The step is then **asked again
  with the whole site as it is when its job runs** (`runTextEdit`,
  `runDataEdit`; usage of both calls is summed and billed).
- A scoped answer is **checked against what it was shown**: it can name
  only lines or tables in its scope.
- The preparation and the job send the **same scoped request**: `jobBody`
  carries the scope on the edit body of a part that was prepared, and the
  edit route passes it to both steps (`stepScopeOf` in `worker.js`). A part
  that was never prepared runs as before, shown the whole site.
- **Only an exact replay reuses an answer.** A change outside the scope
  leaves the scoped request byte for byte the same, so independent
  page/table tasks still overlap and reuse. A change inside it makes a
  different request, which is asked again.
- **Why an omitted read can no longer make an answer stale**: the prepared
  answer could only rest on what its request held. If it needed anything
  else, it said `needs`; its job replays that `needs` and asks the whole
  site, as it now is, fresh. Writing jobs are filed one at a time in apply
  order, so that fresh call runs after the work it depends on.

**Removed**: `builder/prepared-rebase.mjs`, its test, its line in the
`Dockerfile`, the recorder's copy of each request (`q`) and the replayer's
re-base path. `rebased` stays in the evidence shape and is always 0.

**The replayer counts every call.** `wrap` always wraps. With nothing
recorded (none prepared, or only pictures), each call is made and counted
in `missed`.

**Per-job evidence** (`jobs/prepared/<id>.use.json`, `v: 2`):
- written for every request job, not only those with a staged preparation;
  an empty replayer is installed when nothing is staged or the staged record
  cannot be read;
- carries `staged` (`yes`, `no` or `unreadable`) beside `replayed`,
  `rebased` and `fresh`;
- the request view serves each run job as `{ job, known: true, staged,
  replayed, rebased, fresh }`. A job with no evidence, or evidence that
  cannot be read, is `{ job, known: false }` with no counts. A count that
  does not read is `null`. **Missing evidence is never shown as 0.**

## 2. Tests

**`test/parallel-independent.test.mjs`**, through the real request driver,
queue consumer and routes, with supplied answers:
- **IND 1**: two text edits on separate pages. The About step's call runs
  while the Visit job is held, shown only the About page. Its job replays it
  exactly: `{ known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 0 }`;
  part 0 (unprepared) is `{ staged: "no", fresh: 1 }`.
- **IND 2**: the same for row changes in `hours` and `loaves`; the loaves
  step is never shown the hours.
- **IND 3** (control, unchanged): the same page and the same table still
  wait; every call is accounted for in the per-job evidence.
- **IND 4, Codex's reproduction**: hours 09:00 → 08:00, the price two pounds
  less than the Monday opening, no read declared. Shown only the loaves, the
  prepared step says `needs`; its job asks again shown `opens="08:00"` and
  sets **6**. Evidence `{ replayed: 1, fresh: 1 }`.
- **IND 5, a dependency with no shared words**: the About heading to say in
  French what the Visit heading says. The French follows the new heading.
- **IND 6, incomplete declarations**: a read naming the wrong target, and no
  targets for the price part. Both give 6.
- **IND 7, image-only preparation**: the job's call is counted `fresh: 1`.
- **IND 8, missing evidence**: with the evidence file removed, the view
  serves `{ job, known: false }`.

**`test/prepared-scope.test.mjs`** (new, pure):
- the replayer: exact hits, misses with nothing recorded, with only
  pictures, and with nothing at all; a replayed answer used once;
- the recorder keeps a fingerprint and the answer only;
- `scopedText` and `scopedData`: what is shown, the copies, when not
  scoped;
- the scoped requests: no word of other pages or tables, the rest named,
  `needs` offered; the unscoped requests unchanged;
- a scoped request is identical whatever changes outside, and different when
  its scope changes (text and data);
- `runTextEdit` and `runDataEdit`: `needs` asks again with the whole site
  (usage summed); an answer naming what it was not shown writes nothing;
  removed rows filtered to the scope;
- `prepScope`'s rules (moved from the deleted test file);
- `jobBody` carries the scope only for a prepared part;
- `requestView`: known, unknown, and unreadable counts.

**Changed**: `parallel-plan`'s empty-replayer case now requires the send to
be wrapped (it asserted the defect).

## 3. Verification

- **Red check on `1694dc88`** (the new integration file run on the reviewed
  code):
  - IND 4 fails with the stale value: `expected: 6, actual: 7`, Codex's
    reproduction;
  - IND 5 fails: the stale French is applied;
  - IND 7 fails: `fresh: 0` beside a call that was made;
  - IND 1–3, 6 and 8 fail there too, on the evidence fields that code does
    not serve (`known`, `staged`, evidence for unstaged jobs).
- **Sweep**: 27 of 27 mutants killed; the comment-only control survived.
  One survivor in the first pass (the removed-rows filter) was killed by an
  added case; two ambiguous anchors were fixed and rerun. Every file was
  checked restored by checksum. The mutants cover:
  - the replayer's count and the old empty-record shortcut;
  - each scoping rule, the copies rule, `needs` reading only `true`;
  - the re-send on `needs` (text and data), the checks against what was
    shown, the summed usage, the removed-rows filter, the `needs` field on
    each tool, the names of what is not shown;
  - `jobBody`'s scope, and only for a prepared part;
  - the view's unknown and `null` counts;
  - the Worker's scope reader (pages and tables), the empty replayer, the
    `staged` value, unknown evidence, and the scope passed to each step.
- **Related suites**: 577 of 577 (request, parallel, site-apply, ordering,
  data evidence, input budget, picked model, image and doc tests).
- **Full suite**: `10405 / 10405 / 0 / 0` locally, on the code of
  `c5f4cb45`.
- **Doc tests**: 32 of 32.
- **CI on `178fd0a7`** (code plus records, one push, nothing pushed while it
  ran): unit tests 38120608188 green (5 m 19 s); site build 38120608244
  green (all nine jobs).

## 4. Remaining gaps

- **The `needs` answer is shown only with supplied answers.** Whether a real
  model says `needs` when its answer depends on what it was not shown,
  rather than guessing, is not measured. If it guesses, the answer is wrong
  for the same reason it would be with any missing context. It is not a
  stale reuse: what it saw is what its request held.
- **A prepared step that says `needs` also asks the whole site during its
  preparation** (on the old state), a call its job then cannot reuse once
  the site has changed. One extra small call in that case.
- **Text scoping shows only word-for-word copies** of the scoped lines on
  other pages. The same thing written differently elsewhere (a phone number
  in another format) is left to the model's `needs`.
- **Scoping covers only prepared text and data steps.** Rules, look, menu,
  page writer and add-on steps still wait for anything they read.
- **Writes stay serialized**, by design.
- **Nothing is deployed or pressed.** The canary does not read `prepUse`.
