# The fifth Build batch: result delivery by kind, and the rest of the content work (2026-10-08)

Codex reviewed `deb1fee5`:
- CI is green.
- The consumed-envelope protocol record and the answer retry passed
  independent offline checks, including refund totals kept across an
  interrupted settlement write.
- The content checks passed: twelve sections, five long actions, seven
  requested pictures, overflow sections reaching the last band's writer, and
  1 page / 15 components.

All of that is kept. Codex found two connected delivery defects, which are
fixed together here, and the batch then finishes the content work the last
handoff named.

Nothing was merged, deployed or built. There was no paid call, and no SQL was
applied.

## 1. A "still building" answer counted as delivery

**What happened.** When the queue consumer fires a generation, it stores the
build route's real 202 (`stage: "resuming"`). If the browser is closed,
nobody collects it.

`deliverLostAnswer` treated any stored answer without `lost: true` as the
build's newer authoritative one. So after recovery refunded a lost job, the
interim reply stayed. The settlement was recorded as `delivered: true`, the
job left pending, and the customer never heard the outcome. Codex
reproduced exactly that persisted state.

**What changed.** A stored answer is now judged by kind (`resultKind` in
`builder/build-job.mjs`):

| Kind | What it is | What recovery does |
|---|---|---|
| `interim` | `stage: "resuming"` — the build is still going and says nothing of how it ends (the same test as the row's own `buildOutcome`) | replaces it |
| `recovery` | recovery's own earlier answer | replaces it |
| `terminal` | the build's own final answer | keeps it — authoritative |
| `unreadable` | proves no outcome | replaces it |

The settlement record now also says which answer was delivered
(`deliveredAs`: `"recovery"` or `"build"`).

## 2. Delivery overwrote a final answer that landed between its read and write

**What happened.** Delivery read the slot, then wrote unconditionally. A
final answer that landed in between was lost.

**What changed.**
- **Every delivery write is conditional** on what was read: the etag it had,
  or the slot's absence.
- **A refused write re-reads the slot and judges it again** (up to six
  tries). A final answer that landed is kept. A slot still contended after
  that keeps the job pending, and nothing is written blind.
- **The consumer's own "still building" answer is now written only into an
  empty slot.** One that loses the race with recovery's answer, or with the
  resume's final answer, no longer lands over it. A final answer replaces an
  interim one as before.

## The tests for 1 and 2

**`test/build-result-delivery.test.mjs`, 9 cases, through the real producer,
consumer and resume.** Shared with the content tests through
`test/fixtures/build-lifecycle.mjs`.

How each case runs:
- the producer's envelope is consumed by the real `worker.queue`, which
  designs from a supplied answer and fires the generation at a container
  stand-in that accepts it;
- the consumer stores its real 202, and the browser is closed;
- where there is a final answer, it is the real resume's (`RESUME_KIND`
  with a finished generation stored);
- recovery runs repeatedly, with writes failed or interleaved.

What they cover:
- **Codex's reproduction**: the interim answer is replaced by the outcome,
  the full 6 is refunded once, and repeated ticks move nothing.
- **A failed replacement**: the job stays pending and the answer is replaced
  next tick.
- **A failed delivery record**: it is recorded next tick, with the answer
  unchanged.
- **The open-browser control**: the 202 was collected, so the answer is
  written into an empty slot.
- **The race**: the real resume, held after its "recovery owns?" check, has
  its final answer released between delivery's read and write. Recovery's
  write is refused, the slot is judged again, and the final answer is kept
  (`deliveredAs: "build"`). No reference gets back more than it debited, and
  later ticks ask for nothing.
- **A final answer stored before recovery runs**: kept.
- **The consumer's interim answer arriving after recovery delivered**:
  refused; the outcome stays.
- **A slot that keeps moving**: never written blind, and finished once it
  settles.
- **The kinds themselves**: one case pins each.

The ledger is a stand-in that answers `credit_reverse` as the applied SQL
does: bounded per reference across every reason, and shared by the build and
recovery. **It is not a database.**

**Before, on `deb1fee5`'s Worker: 7 of the 9 fail.** The 2 that pass are the
kinds case and the open-browser control. The "kept before recovery" case
fails there only on the new `deliveredAs` field; that code already kept the
answer.

## 3. The content work the last handoff named

| What | Before | Now |
|---|---|---|
| Plan purpose | cut at 400 | whole |
| Plan sections and actions | cut at the 16,000 input budget (Codex's finding) | whole: they are the designer's own output, bounded by its output ceiling, not by the policy for what a customer sends |
| Picture descriptions (build path) | cut at 240 in the plan, the token, the alt text, the key and the prompt | whole end to end; 240 was no provider bound. `MAX_PROMPT_CHARS` is now the add-on's own cut only (`site-add.mjs`, backlog) |
| Research facts | cut at 2,500 | whole; bounded by the research model's own rounds (4 × 1,200 tokens) |
| Linked-page text | 4,000 a page, cut silently | whole until one message's worth (16,000) in all is used, in the order written; a page cut by it carries `kept`/`chars`, and the customer is told "Used only the first N of M characters of …" |
| Links past two | ignored | still not opened: each is a fetch of up to 1.5 MB and 12 s from our address, an abuse bound kept under the owner's rule. Each is now named ("one build opens at most 2 links"), and each link opened spends one of the `sitelinks` quota (it was one per brief) |
| Pictures past what one build buys | never offered to a writer, never mentioned | named with the rule that stopped them: the cap of 6, a working tool, or a site that keeps its photographs (`imagesNotOffered`, `notOfferedWhy`, carried as `images.notOffered`, said in `imagesNote`) |
| A section whose writer failed (P2) | published as an empty part, nothing said | named in the plan's own words: the fact `unwritten` and the note `unwrittenNote`, shown in the chat |

Unchanged: 1 page, 15 components, and every timeout, provider bound,
security control and spending safeguard.

## The tests for 3

**`test/build-content-outcomes.test.mjs`, 11 cases:**
- the plan fields past every old cut;
- a long description through the real build route into the stored plan,
  then whole in the token, the key and the prompt;
- research facts through the real `siteWebResearch`;
- linked pages: the shared allowance, the exact facts and the sentence;
- a quota refusal named;
- the real build route spending one quota unit per link;
- the pictures-not-offered rules and sentences;
- **through the Worker**: a real queued build that asked for nine pictures,
  published by the real resume, answers with pictures 7–9 named;
- `publishPages` carrying the list;
- **P2**: a real band fan-out with a failed writer, published, with the
  section named. Its control is every band written, with no fact.

Updated pins:
- `site-context` (the per-page cut test now pins whole text and `chars`);
- `site-images` (the clipped-description test now pins the whole
  description).

**Before** (the old modules, with inert stand-ins for the new names): 9 of
the first 10 cases fail. The one that passes is the P2 control.

**The browser.** The note list in `public/chat.js` shows `unwrittenNote`. It
was rendered in real Chromium with sentences from the real composers, and
the screenshot was shown to the owner.

## Measured

- **Sweep**: 21 of 21 killed, and the comment-only control survived
  (`scripts/mutants/build-batch-q-2026-10-08.json`).
- **Commit**: `6e27ddd4`.
- **Full suite** on `6e27ddd4`: `10045 / 10045 / 0 / 0` locally. A first
  run failed one source guard (`image-parts`' census reads the call as
  `return buySitePhotos(env, {`). The call was put back in that shape, the
  wiring mutant was re-swept (killed), and the suite was run again.
- **Required CI on `6e27ddd4`**:
  - unit tests run 37769870814: `10045 / 10020 / 0 / 25`. The totals match;
    CI skips 25 browser cases.
  - site build run 37769870801: 8 of 8 green.
- **The next image, predicted** (not built): `f395b40508182c86`, 198 inputs.

## Remaining gaps

- **The build's notes are composed by code, not by the model.** This covers
  images, context, unwritten sections and salvage, as before this batch.
  The new sentences are new code-composed text, said here plainly.
- **A final answer can land after recovery delivered.** That happens when a
  worker passed its "recovery owns?" check before the claim. The build's
  answer then replaces recovery's, and it does not mention recovery's
  refund. It is narrow, but it can happen.
- **A buy that throws loses the not-offered list.** If the picture purchase
  itself throws, `out.images` is rebuilt as an error without it.
- **Long descriptions are unmeasured against the image provider.** A
  provider refusal would show as the existing "couldn't make the
  photographs" outcome.
- **The add-on path still cuts its own descriptions at 240** (backlog).
- **Linked text costs more.** It now rides whole, up to 16,000 characters,
  in every page writer's brief, so a build with long linked pages pays more
  input tokens per writer than before. It is bounded by that allowance.
- **The context note is still not on a resumed build's answer.** This is
  the existing `contextNote` limitation in `build-answer.mjs`.
