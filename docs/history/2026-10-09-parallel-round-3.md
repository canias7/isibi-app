# Parallel tasks, round 3: one purchase per picture whoever makes it, and a first Build's photographs beside its pages (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker
> routes, request driver, queue consumer, build consumer and build resume.
> No real model, image service or live site was asked anything.

The owner's order (2026-10-09, after Codex passed 77 focused tests on
`2045f915` and confirmed the overlapping-delivery fix) had two parts:
- close the two remaining purchase failures Codex reproduced;
- build the missing Build capability rather than counting the existing
  design graph as it.

## 1. What Codex reproduced

Both through the real request-flow consumer with mocked services.

1. **An unreadable previous record taken as "nothing happened".** Follow
   OWN 3, hang right after the bought note lands, recover and expire the
   preparation, then make the next read of its previous `/prep/p1-<seq>.json`
   fail. `runRequestPrep` caught the read error as an empty record and bought
   again: two purchases, the preparation marked ready.
2. **A job buying while the preparation's purchase was still out.** Follow
   OWN 5, but let the part's regular job finish before the first purchase is
   released. The job bought another picture while the original's outcome was
   unknown; then the original landed too: two purchases, both tasks done.

The ownership and the purchase notes stopped at the preparation's edge; the
applying job had its own, separate idea of what was bought.

## 2. One purchase per picture (`dba60da6`)

A picture a request part buys is now **one logical purchase with one
record**, under the site's own source
(`source/<slug>/purchases/<key>/p<n>-<id>.json`), shared by every
preparation attempt, every retake and the part's applying job, wherever it
runs (the container's gateway allows the site's `source/`). Its id is the
part plus the picture's description and its place among the part's
purchases of that description — the same in a preparation and in the job,
because they send the step the same words.

- **absent**: nobody began it; whoever writes `buying` first (a
  conditional create) may buy it.
- **buying**: begun; nobody else buys it. A reader first looks for the
  stored photograph, which `makeSitePhoto` now tags with the purchase's id
  (R2 custom metadata, carried by the gateway); found, it is recorded
  `bought` and reused. Not found, the outcome is **unknown**.
- **bought**: reused by everyone after.
- **none**: ended with no picture; it may be begun again.
- **released**: the customer said, knowing it may cost, to buy it again.
- **A record that cannot be read (after three tries) or does not read as one
  is unknown too** — never absent.

What a reader does with an unknown outcome:
- **a preparation** ends `uncertain`, with no further call;
- **a part's job** holds the part — answers `purchase-unconfirmed`, nothing
  published, nothing charged — and the request records it as **`uncertain`**,
  a new non-final status: what needs it waits, independent parts carry on.
  - The driver looks again on every step (the sweep's included): a purchase
    found to have landed, or released, moves the part on as a new job of the
    same step, which reuses or makes the purchase through its record.
  - The customer can say **"Buy the picture again (may cost again)"** on the
    card (`POST …/buy-again`), which releases each held purchase and runs the
    part again; a second press answers 409.
  - Held for a day, it expires, told as not done; nothing is ever bought on a
    guess.
  - The progress line for it is the model's "unconfirmed" line (it tried and
    cannot tell yet whether it went through); the job's reply facts say it is
    on hold, not given up, and how it moves on.
- **The add-on step's photographs** go through the same record when the
  add-on is a request part: a retried add-on job reuses what an earlier try
  bought, and one whose outcome is unknown is left as its frame, told, and
  not bought again (the part ends partial; it is not resumed).

**An unreadable previous attempt record** (Codex's first reproduction) is
read again; one that still cannot be read, or reads as nothing, ends the
retake `uncertain` with no call and no purchase. The part's job reads it
again when it is staged and reuses its recorded calls; when it still cannot,
the job makes its calls again (ours: a preparation's calls are never
charged) and buys nothing, because the purchase is on its own record.

**Provider idempotency or lookup**: the image service is called on its
synchronous endpoint, which offers neither an idempotency key nor a lookup
by request. The lookup that exists is ours — the tag on the stored
photograph. A purchase the provider completed and charged whose photograph
was never stored cannot be resolved from our side; that is exactly the
outcome held as unknown.

## 3. A first Build's photographs beside its pages (`2c4def8b`)

**Existing, unchanged**: the design graph runs its agents concurrently by
their needs (P8). Everything after the design ran in one line: slug,
provisioning, schema, seed, look, placeholder, then page generation, then
the photographs, compile, render check, publish.

**What could run at once**: the photographs need only the design. Each
description is the design's own, and the page writer is handed exactly those
words as its tokens. So they are now **a task of their own**:
- started by `publishPages` right after its balance read, beside the page
  generation (`prefetch`), bounded by the design's budget and the balance
  less a reserve held for the pages (60 credits);
- each the build's logical purchase (§2, keyed by the build's job), so a
  resume or a retried run reuses it;
- **joined at the image step** (after the pages, before the compile): a
  token whose purchase is in flight waits for it, one bought is reused, one
  the writer changed is bought then, one whose outcome nobody can tell is
  left as the placeholder and told as unconfirmed;
- a picture bought beside the pages that no page wrote is told as stored and
  not on the site, and is **not in `made`, which is what the bill counts**;
- **nothing is handed on** — to the resume, the reply or the refund — while
  a purchase the task began is in flight.

The explanation is model-written from the build's facts, which now say which
pictures were shown, which were bought and are not on the site, and which
could not be confirmed. A first build still has no live progress line of
its own during the build (recorded gap).

**Not orchestrated** (judged, not done): provisioning, schema and seed
beside the page writer (a first build normally has no database at all —
the designer's tool has no backend field — and the page writer reads the
stored spec); fonts; the placeholder; the share image. The limits of 1 page
and 15 components are unchanged.

## 4. The page tweak (the recorded gap)

A preparation case for the page **tweak** (not the page writer's rewrite):
a style change to the Visit page's heading, prepared while another task's
job is inside its own work. Nothing of the site is written before its job,
the rewrite is never asked for, and the tweak's answer is applied once.
This case passes on the base too: the gap was that it was untested, not
broken. A tweak that adds words is the rewrite's job by the tweak's own
rule, so that is not a preparation defect.

## 5. Capability table

| Path | Parallel work |
|---|---|
| Edit: text, menu, picture, look, data, rules | **full preparation** beside another task's job (round 2), now with one purchase per picture across preparation, retakes and the job |
| Edit: page | **full preparation**: the page writer's rewrite and, now tested, the tweak |
| Add-on, no new database; list entries | **full preparation** (round 2); its photographs are bought by its job through the purchase record |
| Add-on that needs a new database | preparation up to its design; **the provisioning boundary**: its page writer runs after provisioning, in its job |
| Edit: logo | routing only (no model call) |
| Build: design | **existing** designer concurrency (the design graph), unchanged |
| Build: photographs | **new**: bought beside the page generation, joined at the image step, durable across resume and retry |
| Build: provisioning, schema, seed, fonts, publish | sequential, as before |
| Writes to one site | one at a time (the database's lock), unchanged |

## 6. Results

- **Commits**: `dba60da6` (one purchase per picture), `2c4def8b` (the
  Build photograph task and the page-tweak case), `17ce3f6f` (two cases the
  sweep asked for), and the records.
- **New cases**: 19, and OWN 4 revised to the held behaviour:
  - `test/parallel-purchase.test.mjs`, 11 through the real consumer: Codex's
    two reproductions (PUR 1, PUR 4), a previous record unreadable for good
    (PUR 2) or malformed (PUR 3), completion before the job starts (PUR 5),
    a stored photograph whose buyer died before recording it (PUR 6), a
    purchase that never answers, released by the customer, with the job's
    message delivered twice at once and a second press refused (PUR 7), a
    malformed purchase record (PUR 8), expiry (PUR 9), the purchase record
    itself unreadable (PUR 10), and a claim whose answer was lost (PUR 11).
    Each asserts provider purchases, stored photographs, publishes and the
    step's charges separately;
  - `test/build-parallel.test.mjs`, 5 through the real build consumer and
    resume: the new overlap (BLD 1), the hand-over order and every result kept
    (BLD 2), a retried run (BLD 3), a landed and an unknown purchase at the
    resume (BLD 4), and the balance control (BLD 5);
  - the page tweak's preparation, in `test/parallel-prep-paths.test.mjs`;
  - 2 unit cases in `test/parallel-plan.test.mjs`.
- **Red check** on `2045f915`: 17 of the 20 new or revised cases fail (all eleven PUR cases but PUR 5, BLD 1–4, OWN 4, the two unit cases). Three pass there and guard what already worked: PUR 5 (OWN 5's order), BLD 5 (the balance control) and the page tweak's preparation.
- **Sweep**: 29 mutants over `worker.js`, `builder/request.mjs`, `builder/prepared.mjs`, `builder/publish-pages.mjs`, `builder/site-images.mjs` and `builder/site-reply.mjs`: 27 killed in the first round; the two survivors (a purchase record that cannot be read taken as absent; a lost claim answer taken as permission) led to PUR 10 and PUR 11 (`17ce3f6f`), and a second round killed both. **29 of 29 killed; the comment-only control survived.**
- **Full suite**: recorded in the owner-notes handoff.
- **Required CI**: recorded in the owner-notes handoff.
- **Image** (predicted, not built): production `335396c8c0e0fbcb` → `3200859f5ffd7283` (202 inputs).

## 7. Mocked versus live

- **Mocked**: every model answer, the image service, Supabase's RPCs, the
  queue, the container.
- **Not shown live**: a real lost purchase; the provider's own behaviour on a
  retried call; real overlap timings for a first build; how often a page
  writer changes the design's words (each such picture is bought twice in
  effect: once beside the pages, unused, ours; once at the image step).

## 8. Remaining gaps

- **The image provider has no idempotency or lookup** on the endpoint we
  use; a purchase it completed whose photograph we never stored stays
  unknown, held, and can only be bought again on the customer's say-so.
- **An add-on's unknown photograph** ends its part partial (frame left
  empty, told); it is not held and resumed as the picture step is.
- **A first Build**: the photographs are the only new task. Provisioning,
  schema and seed beside the page writer are not done; no live progress line
  during a build.
- **Photographs bought beside the pages that the writer did not use** are
  our cost (stored in the owner's library, not charged).
- **An unreadable previous attempt record that stays unreadable** costs us
  the job's repeated model calls (never a second purchase).
- **The join's in-flight wait** is exercised only within one invocation; the
  queued tests settle the task before the hand-over, so the wait itself is
  shown by the hand-over ordering case, not by an assembly that meets an
  in-flight purchase.
- **No real-model or live run.**
