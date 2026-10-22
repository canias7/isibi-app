# 2026-10-22: the rebuild-from-a-link and the 3D model in the shared progress talk

Branch `progress-import-3d`, from `codex-work-into-claude` (`a6564cf80`). Approved by
the owner: wire two of the day's features into the shared progress talk. Nothing
spent, nothing deployed, nothing pushed to `main`.

## 1. Rebuild from an old site's link

- `worker.js` (`runSiteBuild`): a new mark, `tr.at("importing", {})`, before
  the read; the existing `import` mark (`ok`, `pages`, `photos`) after it; the
  existing `importphotos` mark (`placed`, `missing`) after the copy. Marks
  reach the build's talk through `bProgress.step` → `talkBuildStepFacts` →
  `buildStepFacts`.
- `builder/site-progress.mjs` `buildStepFacts`, three new cases:
  - `importing`: doing, "Reading their current site…".
  - `import`: `ok === true` with pages: "Read N pages from their current site,
    to rebuild it from. Nothing is built yet." Otherwise, including a
    non-boolean `ok` or zero pages: not done, "Couldn't read their current site,
    so the site is being built from their message alone."
  - `importphotos`: prepared, "Using N of their photos from their current site
    on the pages. Not published yet.", plus a not-done fact for photos that
    could not be copied.
- The line writer turns these facts into the customer's own words, as it does
  for every build step. The exact sentences are the model's.
- **A double count was fixed along the way.** `ownphotos` counted the imported
  photos again, because the imported ones are merged into `ownPhotos` before
  that mark. It now counts only the customer's attached photos.
- `test/build-budget.test.mjs`: `importing` is added beside `import` as a
  pre-design mark. Its stage is the design, which is true.

## 2. The 3D model

- The 3D flow is not a job, so it marks into the site's talk record the way
  Publish and Restore do. It uses the same key (`action-talk/<uid>/<id>.json`),
  the same room (`act:<id>`), and the same readers (`GET /api/site/talk/<id>`
  and its `/stream`).
- `public/chat.js` `siteModel3dGo`: the press makes a talk id (32 hex), keeps
  it on its live message (`talk`), and sends it in the POST. Each poll asks
  `/api/site/talk/<id>` and shows the server's lines once they are in. Until
  then it shows its own lines, which have the same wording.
- `builder/model3d-route.mjs` takes an optional `deps.talk(id, text, end)`.
  The id is kept on the record (`rec.talk`) so later polls can find it. Each
  line comes from what the route really saw:
  - the start, then "Started — N credits reserved…" from the debit;
  - "Waiting in line … (N ahead)…" from fal's queue position;
  - "Shaping and texturing the model — N min so far…", counted from the
    record's start;
  - "Saving it to your files and putting it on /shop…" from the claimed finish
    (never for a failure);
  - the reply, with its cost or refund, as the closing line.

  A refusal at the start closes the talk with its own sentence. A talk that
  throws never costs the model.
- `model3dTalkLine` in `site-progress.mjs` holds the wording. It is literal
  and is never sent to a model.
- `worker.js` `model3dTalkMark` reads the record back and appends to it. It
  does not repeat a line equal to the last one, a closed record takes nothing
  more, and the room is told. It is off when the talk is off (`talkOn`).

**Limits.** Lines are written only while some page polls the route, because
the route does its work on each poll. Another device sees them only if it
knows the talk id (the account-scoped record, the same limit as Publish and
Restore).

## Tests

- `test/progress-import.test.mjs` (new, 5 cases): the import's facts,
  `model3dTalkLine`, and the build's marks in order.
- `test/model3d.test.mjs` (+6 cases): the route's lines with stubs, refusals,
  bad ids, a talk that throws, the Worker's wiring, and the page's POST and
  read.
- **Red check**: on the old product code, 5 of the 6 new model3d cases fail
  and `progress-import.test.mjs` fails to load (39 tests, 6 failing).
- **Sweep**: 14 mutants, all killed. The first run's survivor (the POST no
  longer sending `talk`) showed a guard that was too loose. The guard was
  tightened and the mutant is now killed. The comment-only control survived.
- **Full suite** (`node --test "test/*.test.mjs"`): 11,845 tests, 11,840
  passed, 2 failed, 3 skipped.
  - `build-budget`'s list of marks did not yet include `importing`. It is now
    fixed (23 of 23).
  - The `node_modules` ignore case failed only because of the temporary
    symlink, which was removed before the commit.
- Screenshots, drawn by the page's own `progressListHTML`: `talk-import.png`
  and `talk-3d.png` (session scratchpad).
