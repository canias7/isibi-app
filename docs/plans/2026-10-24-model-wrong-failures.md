# Failures where the model got it wrong: 30 days of real data (2026-09-24 to 2026-10-24)

Read-only research. Sources: Supabase `edit_jobs` (state, the parsed `result.body`, cost), `site_builds`,
`edit_traces`, and the recorded canary runs. All accounts. Aggregate only. No model calls, nothing paid.
Code references are to `origin/main` `692087cde`.

## 1. What the raw numbers hide

Over 30 days, `edit_jobs` holds 467 jobs: 164 done, 302 `failed`, 1 `lost`. **Most of the "failed" rows are not failures:**

| Rows | What they are | Evidence |
|---|---|---|
| 244 | `reason: "empty"`: the canary's free round trip (no instruction sent) | one account, 5 fixture slugs; `worker.js:35842` `escalate("empty")`; `builder/edit-failure.mjs:50` ("Kept as the escalate the canary's free round trip reads") |
| 20 | add-on frame jobs answering `reason: "layer"` (`layer: nav`) with `escalate: true`: a **handoff** to the edit route, not a failure | every one is followed within 5 minutes by an edit job on the same site (17 of 20 end `ok` or as a legitimate question) |

Without those, **50 real non-success outcomes** remain across edits, add-ons, routing and builds (plus 1 canary
route-check refusal, run 74, which never became a job). Volume is low, and almost all of it comes from the owner's
test sites. The percentages below are therefore rough.

## 2. The classes

| Class | Count | Share | What it is |
|---|---:|---:|---|
| A provider / transport / capacity | 4 | 8% | add-on `send` "builder is busy" (`worker.js:25373`); 2 builds "every app builder is busy"; 1 build "app could not be checked (500)" |
| B our config / account | 5 | 10% | 1 edit `unbilled`/insufficient (`worker.js:17105`); 2 builds stopped at `credits`; 2 routing calls failed on an empty xAI balance (run 70 and the same incident) |
| **C the model got it wrong** | **23** | **46%** | below |
| D genuinely impossible / needs the customer | 8 | 16% | 6 nav questions asking for a social or shop web address the message did not give (each answered, then done for 0–1 credit); 1 `kept` (the page was still linked: a correct safety refusal); 1 `no-match` where the row really did not exist (run 77) |
| E our bugs / cascades | 5 | 10% | 4 `turn` timeouts waiting on a sibling publish (`worker.js:17638`, `25839`, 2026-10-17); 1 add-on `no-source` on a site whose build had just failed (a cascade) |
| unexplained build jobs | 5 | 10% | build jobs `failed` on 2026-10-21 with no body (`harbour-loaf-24`, `-25`, two of `harbour-loaf`, `sunday-kitchen`), on the same day as the "busy" capacity incident; probably A or E, not shown |

## 3. Class C in detail (23)

Every class-C job ran on **grok-4.6**. Where the effort is recorded (`replyFor.effort`, from 2026-10-22 on), it was
**low**. **No Claude-picker job failed or ran on these paths in the window**, so the data cannot say whether Claude
would have done better. That would need a measured A/B.

| Sub-class | n | Codes (where in the code) | Cost wasted (job credits) | Would a retry have helped? |
|---|---:|---|---:|---|
| Picker found no lane, or nothing usable | 7 | `no-menu` ×3 (`builder/site-nav.mjs:2307`…`2452`); `no-lane` ×1 (`edit-failure.mjs:70`) on a plain look request ("buttons rounder, darker terracotta"); add-on `declined` ×1 (`worker.js:42769`) on a clear list of menu items; `look/no-change` ×1 (`edit-failure.mjs:138`); 1 page part `no-change` inside a done job | 6 (+ about 3 routing each) | **Yes, likely.** The first `no-menu` ("put a link to the new Classes page in the menu") succeeded at 1 credit the same day when reworded. The other two are ordinary header-link requests that the same lane does daily. |
| Unnecessary question (`clarify`) | 5 | 3 add-on `add:pages` questions about design choices with obvious defaults, **asked after 12–13 credits were already charged** (`worker.js:42742`); 2 nav questions where the target was inferable (a button's destination; hours wording) (`worker.js:35840`) | **37** | Mostly. A default plus "tell me to change it" would have done them. |
| Writer left out required content (`not-landed`) | 3 | the page came back without the words the add-on was asked to add (`worker.js:45967`) | **43** | Probably. The check is deterministic and names the missing line, so it can be fed back. |
| Writer produced invalid or inconsistent code | 3 | add-on `compile` (an import of a component path that does not exist, `worker.js:18400`); build `vite` failed (a default import from a module with only named exports); add-on `no-job-fn` (a job naming a function that does not exist, `builder/site-add.mjs:3993`) | **23** (+ the failed build) | **Yes.** Each error is a single, named, mechanical error, so repairing it with the error text is very likely to work. |
| Routing chose wrong, or copied badly | 3 | `held-unread` ×2 (`worker.js:27357`; `edit-failure.mjs:60`: the router's `alsoAsked` text not found in the message); run 74's `text` answer where `data` was right (refused by the canary route check) | 2 | For held-unread, yes: a deterministic substring check can refuse the answer and retry. For the misroute, it is unknown. |
| Writer changed things it should not have (`rewrote`) | 1 | an addition dropped an existing heading (`worker.js:45730`) | 0 | Yes: the guard names what was lost. |
| `no-match` when the row may have existed | 1 | data picker (2026-09-30 22:22) | 1 | Unknown |

**Total C credits charged on failed jobs: about 112** (about $0.90), plus about 2–3 routing credits per failed message.
**Customer cost is the bigger loss**: 11 of the 23 ended a turn with nothing done.

The top three C sub-classes are the picker finding nothing (7), unnecessary questions (5), and the writer's
omissions and invalid code (3 + 3).

## 4. Recommendations (in priority order, by failures removed)

1. **Verify, then retry with the reason (the same step, once), for every deterministic check we already run.**
   This applies to `compile`/vite, `not-landed`, `rewrote`, `no-job-fn` and `held-unread`. Each one has an exact,
   machine-made reason (the error line, the missing words, the lost heading, the unknown function name, the
   unmatched quote). Feed it back in one retry before refusing.
   Fixes: invalid code (3), omissions (3), rewrote (1), held-unread (2). **Removes about 9 of 23 C failures (about 40%).**
   Cost: one extra writer call only when a check fails (about 2–20 credits on the add-on path, which mostly saves
   the 66 credits now charged for nothing). Retry on the higher effort.
2. **Retry with a fallback when the picker or lane returns nothing.** Applies to `no-menu`, `no-lane`, `declined` and `no-change`.
   One retry at high effort, and if that fails too, on the other model (Grok to Claude). The answer is cheap
   (1–2 credits), and the evidence shows that a reworded request succeeded.
   Fixes: picker empty (7). **About 30% of C.** Cost: about 1–3 credits on a failure only.
3. **No questions after spending, and a default-first rule for design questions.** Ask before anything is charged,
   or proceed with a stated default ("I used X; say if you want Y"). A deterministic gate can do this: a
   `clarify` with options, or one asked after `add:pages` has charged, takes the first option.
   Fixes: unnecessary questions (5). **About 20% of C**, and it saves the 37 credits charged before questions.
   Cost: none (prompt and gate).
4. **Constrained schemas and deterministic pre-checks in the writer's context.** Give the writer the real list of
   component paths and exports (and the site's function names for jobs) as an enum or allow-list, and lint imports
   before `vite` runs. This prevents the invalid-code cases at the source instead of repairing them. It overlaps
   with item 1. Cost: none at run time.
5. **Router: a substring check on `alsoAsked`/`heldBack` with a retry at the router**, before the message is
   refused (held-unread is "ours" today). Covers 2 cases. For the `data`/`text` misroute, collect more samples
   before rewording (1 case; the canary already refuses it at no edit cost).
6. **Split large requests and add a self-check step: not yet.** No failure in this window is explained by request
   size. A separate self-check model call would duplicate the deterministic checks that already exist (items 1 and
   4) at a higher cost.

Items 1 to 3 together cover about 21 of the 23 class-C failures (about 90%). Those are the paths where the model
was wrong and a deterministic signal already exists.

## 5. Not class C, worth a separate look (backlog, not this plan)

- The 5 unexplained build jobs and the 2 "builder busy" builds on 2026-10-21 (capacity).
- The 4 `turn` timeouts (2026-10-17).
- The add-on `no-source` cascade after a failed build.
- The canary's `empty` probes are stored as `failed` jobs (244). Mark them as probes so failure counts are honest.

## Method notes

`result.body` is stored as a JSON **string**; it was parsed with `(result->>'body')::jsonb`. `site_builds` steps
carry no per-page salvage or repair detail, so model errors that a build recovered from are invisible. Only the 6
builds with `ok=false` are counted. `edit_traces` (384 traces, 8 not ok) agreed with the job outcomes.
