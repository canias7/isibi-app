# 2026-10-15 — The combined candidate: `new` into `main`, ready for review

Branch `candidate/new-on-main`, prepared in an isolated checkout (a worktree;
`main` untouched at `8e24ca5b`). Unmerged and undeployed. No container build, no
live storage write, no paid call and no image purchase was made to prepare it.

## The commits

| Commit | What |
|---|---|
| `2e5820de` | the merge of `new` (`22779ea5`) into `main` (`8e24ca5b`), conflicts resolved |
| `4fac9f8d` | **the code candidate**: a fired Build's answer says where the owner's video and audio went (found by the integration check) |
| the commit carrying this file | records only (`docs/**`); it changes no image input and no deployed file |

**What `new` brings, in scope:**
- **The assistant conversation:** its own reply, the history window and its
  cut, the site context, and honest capabilities.
- **Video and audio files the owner uploads:**
  - upload in parts, with resume;
  - storage, and playback with ranges;
  - replacement at the same address, and deletion;
  - drafts kept before a site exists, moved into the new site by its first
    Build.

**Nothing generates video or audio.** The diff adds no generation service. The
assistant's capabilities list editing video or audio, and visitors uploading
them, as not offered. Also in scope: the verification harness
(`scripts/media-verify.mjs`) and its dispatch-only workflow.

## Changed files against `main` (product and tooling; tests and documents apart)

| Area | Files |
|---|---|
| Worker and its image | `worker.js`, `site-media.mjs` (new), `site-uploads.mjs`, `Dockerfile` |
| builder | `builder/site-converse.mjs` (new), `builder/site-ask.mjs`, `builder/page-gen.mjs`, `builder/build-budget.mjs`, `builder/build-resume.mjs` |
| browser | `public/chat.js`, `public/chat-talk.js`, `public/site-media.js` (new), `public/index.html`, `public/styles.css` |
| tooling | `scripts/media-verify.mjs` (new), `scripts/owner-session.mjs` (additive), `scripts/canary-probes.mjs`, `.github/workflows/media-verify.yml` (new, dispatch only) |

The full list: `git diff --stat 8e24ca5b <candidate>` (71 files in the merge,
plus 3 in `4fac9f8d`).

## Conflicts, and how each was resolved

**Textual: three, each a union.**
- **`Dockerfile`:** `main`'s `COPY` lists, which add
  `builder/content-evidence.mjs`, plus `new`'s `site-media.mjs` and
  `builder/site-converse.mjs`.
- **`public/chat.js`, the build body:** `main`'s `accept: 'early'` plus `new`'s
  `media`, the drafts kept for the project.
- **`docs/owner-notes.md`:** both sides' new entries, `main`'s first.

**Semantic: one.** `main`'s `470223cb` case in `test/route-decision.test.mjs`
asserted the earlier rule: `answering` or `attached` alone refused an ask
answer. `new` narrowed that rule on purpose (`5f425ceb`): only an answer picked
from our own options is not conversation.
- **The case is restated under the candidate's rule, and keeps its purpose:**
  each flag is proven through the real route.
  - `picked` refuses "ask".
  - `answering` reaches the router's instructions where our questions are
    asked (a first build), and is absent without it.
  - A typed reply and an attachment stay "ask".
- **Cutting the `picked` wire or the `answering` wire in `worker.js` fails
  it.**

## The integration points, checked offline

1. **`main`'s early answer meets `new`'s draft move.**
   - A send with `accept: 'early'` and `media` is answered 202 `accepted`.
   - The queued job's envelope carries the drafts.
   - The real consumer moves them into the new site's library.
   - The poll the page follows returns the final answer.

   This is `test/build-reconnect.test.mjs`, RC 27b.
2. **The fired path, a gap in `new` that this check found.** A Build that
   fires its generation (the container path, the normal one) finishes on the
   resume. That answer carried neither `media` nor the line for a file that
   could not be moved. The draft had moved, and the page writer had the facts,
   but the answer the page reads said nothing.
   - **Fixed in `4fac9f8d`:**
     - The resume record keeps the media outcome as it keeps `deferred`. It
       is normalised, and absent reads as none.
     - The fire writes it.
     - Both resume answers carry it.
   - **The checks:**
     - RC 27b was red before the fix (`media` undefined).
     - RC 27c: with no drafts, no media fields.
     - Mutants: 4 of 4 killed, control survived.
3. **The followed answer reaches the page whole.**
   - The stored result's body is kept as one string (`readResult`).
   - The page replaces its reply with the followed answer, so `contextNote`,
     `notes` and `media` are read from it exactly as from a direct reply.
4. **The router's flags** (the semantic conflict, above).

**The focused integration set on the merged tree.** It ran before
`4fac9f8d`, with the restated case: 806 of 806.
- `build-reconnect`, `build-resume*`, `build-queue*`, `site-route-failure`,
  `site-entry-inventory`, `band-build`, `route-decision`, `site-ask`,
  `worker-imports`;
- every `media-*` and `conversation*` file, and every `progress-*` file;
- `merge-triggers`, `ci-browser-order`, `deploy-secrets`, `brand-rename`,
  `components-doc`, `canary-build`, `build-as-owner`.

`container-images` was run on the committed candidate: 17 of 17. **CI on
`4fac9f8d`:** unit green (run 38742153754), and site build green (run
38742154022).

## Deployment prerequisites (none met by preparing; each is the owner's)

1. **The owner says merge.** `main` fast-forwards to the candidate, and the
   push deploys. `deploy.yml` is never dispatched from a branch.
2. **Nothing in flight:**
   - **Actions runs:** none of help-needed's presses running.
   - **Edit and build jobs:** none open.
   - **help-needed's parallel-execution work.** If `main` moves before the
     merge, the candidate is redone on the new `main`.
3. **Required CI green on the candidate head:** unit and site build.
4. **The image, predicted.**

   | | Image | Inputs |
   |---|---|---|
   | `main` (`8e24ca5b`) | `e420b3c2d3224dd3` | 207 (176 distinct paths) |
   | candidate | **`01b76fb595ee2600`** | **209 (178 distinct paths)** |

   - The candidate adds `site-media.mjs` and `builder/site-converse.mjs`.
   - The predictor reproduces `main`'s recorded `e420b3c2d3224dd3`.
   - **The image rolls,** so allow the 15–20 minute window before any
     container work.
5. **Rollback, verified in a throwaway worktree.** Revert `4fac9f8d`, then
   revert the merge `2e5820de` with `-m 1`. That gives back `main`'s exact
   tree.
6. **After the deploy:**
   - **The free runtime canary** must answer with the candidate's sha and
     image.
   - **`public/` changed,** so the served `chat.js`, `chat-talk.js`,
     `site-media.js`, `index.html` and `styles.css` are byte-compared with the
     merged files, the before reading taken first.
7. **No new secret, binding or variable.** `wrangler.jsonc` and `deploy.yml`
   are unchanged by `new`.

## The next verification batch, after the merge

Every check runs through the `media verify` workflow (dispatch only, pressable
once on `main`). Each press keeps `media-verify.json` as its evidence, and no
console step is asked of the owner.

**Batch V1 — free, storage and browser.** No model call, no credits.

| Press | Mode | Touches | Boxes |
|---|---|---|---|
| V1.1 | `rehearsal` | read-only | the demo site |
| V1.2 | `storage` | writes test files to that site's library and deletes them; the library must end as found | write-files box: yes |
| V1.3 | `browser` | the same, plus real Chromium, Chrome, Firefox and WebKit, and the real app's composer with every other write blocked | write-files box: yes |

- **The demo site is one the owner names.** It must not be one of
  help-needed's (`fold-lane-bakery`, `fretwork-1`, `lido-axes-b`,
  `copperleaf-tea-room`, `saltmarsh-cheese-counter`, all refused by the
  script). Candidates are `markbook-1`, `shoeroom-1`, `repairbench-1`,
  `ashgrove-1` and `washhouse-1`.
- **R0 confirms first** that the site is owned and readable, and shows its
  library.

**Batch V2 — paid, kept apart, each press on the owner's approval.**

| Press | Mode | Estimate | What bounds it |
|---|---|---|---|
| V2.1 | `converse` (twelve fixed cases since 2026-10-15, on the demo site; three route only) | **about 21–72 credits** | the ceiling typed for the press; the platform caps nothing |
| V2.2 | `build` (P9: one new Build with two drafts, on a new slug) | **about 13–47 credits** | the same |

- **Photographs off is required.** `IMAGE_PURCHASES` must be off on the live
  Worker, and a rehearsal shows it. The script reads it again before every
  send and refuses if it is not off. Turning it off is the owner's setting,
  and it is turned back on after the batch.
- **The balance is read from the ledger** before and after every send.
- **An unknown or unreconciled charge stops the press.** The spend is recorded
  as unknown, never zero.
- **The Build needs a steady ledger reading** before any draft is made, and
  again before the send.
- **Estimates are not limits.**

**What comes back for review.** Every conversational answer is kept whole in
`results.recorded`. Each case's purpose comes back in `results.unverified`
with its answer, the source evidence to read it against, and hints. P9's
narration comes back the same way. Codex reads their meaning from the
artifact. A converse press ends "needs review" (exit 3) at best.

**Not covered by any press:**
- Safari on macOS and iOS, Chrome on Android, and Edge, which no runner has;
- R2's own abort and finish answers, for which no probe is built.
