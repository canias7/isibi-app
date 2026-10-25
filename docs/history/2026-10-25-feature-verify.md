# 2026-10-25 — requirements checked against the built site before the reply (branch `feature-verify`)

Branch `feature-verify` from `origin/main` `4a73315c0`. Not merged, not deployed. No model call, no live write.

## The finding

Live 2026-10-25 17:22 on `driftwood-and-daughters-5`, edit jobs `c0bf4e6c` (Lessons), `3550321d` (Cafe) and `ee7a60b0` (Board shop). Every behavioural need came back as `told: "unseen"`, `state: "unknown"`, and the customer read "I can't see from here whether…": a booking form with date, time and people, a maximum of 8, a closed-day switch, an owner-editable menu, prices, vegan and gluten-free badges, browse, search and filter, reserve. Coverage counted 4/4, 3/3 and 4/4 `covered`. All three jobs also ended `ok:false` (two `cancelled` while waiting to publish, one `compile`/cancelled), so nothing from them was published. Only non-secret columns were read (`id`, `op`, `state`, `result`).

## The checks that already existed, and why they missed these

| Check | What it establishes | Why it said nothing about these needs |
|---|---|---|
| Render check (`builder/render-check.mjs`) | every route opens in Chromium; findings, landmarks, first-load text | it never reported forms, and nothing joined its reading to a requirement |
| Content evidence (`builder/content-evidence.mjs`, 2026-10-13) | text a **component** added is in the code and shown on first load | text only; it never asks whether a form saves to a table |
| `carriersReading` / `implementationOf` (`site-requirements.mjs`) | each carrier the judge named **exists** (in `made` or `existing`) | existence only. A function, job, connection or component, or a page the reader could not see, is `unknown`. A carried-`unsure` verdict is `unknown` too |
| `presentOnly` (row-hedge, earlier today) | a need carried only by pages and tables the site **already had** is said plainly | only `already-there`, and never with the page and table joined |
| `claimEvidence` | a configuration or check token in the designer's own claim | prose matching, not a check |

So the pieces were in hand (the shipped page code, the browser's reading, the post-apply schema), but nothing used them on a requirement. And on a failure the route passes `content: null` on purpose, which is honest: an unpublished change cannot claim anything.

## The change

- **`builder/requirement-verify.mjs`** (new): `verifyNeed(carriers, site)` takes the judge's carriers (`page:/p`, `table:T`, `table:T.col`, `table:T:setting`, `function:F`) and checks them against the built site in code:
  - a page: its code shipped and the browser drew the route; which tables its code saves to (`useCreateRow`, `useUpdateRow`, `useUploadFile`, `useCart`, `useCheckout`, `useDeleteRow`), which it lists (`useRows`, `useRow`, `usePublicRows`), which functions it calls (`useRpc`, `useRpcAction`, `useClaimedRow`), and the fields of the forms the browser drew, matched to the table's columns;
  - a table: in the schema, with the column asked for; the owner can edit it in the Data panel; its declared rules named (CHECKs, `maxRows`, `noOverlap`, `unique`, one per person);
  - a declared setting (`checks`, `maxrows`, `nooverlap`, …): in the schema. A setting that sends something (`confirm`, `sms`, `payment`, `webhooks`, `notify`) is behaviour and stays unverifiable;
  - **the join**: a page named beside a table must save to it or list it (or call a function the need also names). A page and a table that never meet are a gap.
  - The verdicts: `present` (with the evidence), `missing` (with the gaps), or `unverifiable`. Unverifiable covers a component, job, API or connection, a table named alone (the row-hedge rule, kept), a function no named page calls (a function is behaviour), and a page the browser did not draw.
  - It uses no keyword rules and never reads the need's words.
- **`builder/site-render.mjs` / `render-check.mjs`**: `formProbe` (desktop, read-only) reports each route's forms (field name, type, label) as `report.forms`. **This changes container inputs, so the image rolls on the next deploy.**
- **`builder/site-requirements.mjs`**: `requirementReport(…, { site })`. Each `set-up` / `shown` / `behind` / `in-code` / `unseen` / `already-there` entry with judged carriers is checked:
  - present: a new told kind **`checked`** with `evidence` (or `present` + `evidence` beside what the site already had);
  - missing: `still-to-do` with `gaps`;
  - unverifiable: the sentence is unchanged.

  The note says it plainly, for example "Each lesson can be booked online…: /lessons shows a form that saves to lesson_bookings (date, time, people)".
- **`builder/site-reply.mjs`**: `checked` is a `changed` fact ("Checked on the built site: … — evidence"); a gap rides with "Not done" as a fact. Under a failure that applied nothing, `checked` reads as `already-there`, the same as `set-up`.
- **`worker.js`**: `aForms = publishedForms(built, aRepairRound)`, and `aVerifySite` (route code from `routedSources` of the shipped pages, the forms, the routes drawn, the post-apply `aSpec`) is built after the pages ship. It is passed only on a change that shipped (`site: failed ? null : aVerifySite`).

The reply is still written by the model, from these facts.

## Not done (kept separate)

- **One retry for a missing need.** A `missing` verdict is told as not done, with the gap named. Handing it back to the page step for one more pass needs a second design-and-publish round inside the addon route. Recorded in the backlog.
- **The three live jobs.** All three were unpublished failures, so the check does not run there by design. Their hedges came from the failure path.
- **Exercising behaviour.** Nothing submits a form or tests a rule. "Present" means the pieces are there and wired.

## Evidence

- `test/feature-verify.test.mjs`, 7 cases on supplied inputs: wiring with comments blanked, carriers read back, a booking form plus the group limit present with evidence, gaps for each missing kind, what stays unverifiable, the report, note and reply facts through the real producers, and the probe, the report and the worker wiring.
- `test/requirement-told.test.mjs`: the `TOLD` order now includes `checked`.
- Red check: against `origin/main`'s code the new file fails (the module and the probe do not exist); mutant 7 below is the behavioural red of the report hook.
- Sweep: 13 of 13 mutants killed (the join, the table-alone guard, the function guard, `declaredPart`, the drawn check, drawn-over-code fields, comment blanking, the report hook, the missing→not-done step, the probe push, the worker pass, the reply kind, the report's `forms`). The comment-only control survived.
- Dockerfile: `builder/requirement-verify.mjs` added to the worker tree (the job runner imports it; `test/dockerfile.test.mjs` caught it).
- Full suite `node --test "test/*.test.mjs"`: `12796 / 12791 / 2 / 3` before the Dockerfile line. The two failures were the Dockerfile case (fixed, re-run green) and `container-room` (the worktree had no `node_modules`; green with it linked: 15 / 15).
