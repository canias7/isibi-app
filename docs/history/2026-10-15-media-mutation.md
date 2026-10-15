# 2026-10-15 — Codex's review of `aef027fd`: delete and replacement as one sequence per file, and the progress-ordering failure explained

Branch `new`. Unmerged and undeployed. No container build, no paid call, and the
help-needed branch untouched.

Codex confirmed independently that deleted receipts answer `removed`/410 and
that the stale admission is refused. Both fixes are kept. Codex then
reproduced the gap the previous round had documented: a replacement read the
old object, a delete landed immediately after, and the multipart completion
returned 200 and recreated the deleted file.

## The fix: one durable record per file (`site-media.mjs`)

**The record.** Deletion and a replacement's close now go through the same
record for the file, `media-assets/<scope>/<name>.json`. It changes only by an
R2 conditional write over the etag it was read at. Like the quota ledger, each
write carries a growing revision and its own write id, so the record never
returns to an old etag.

| State | Meaning |
|---|---|
| `live`, generation G | the file as it stands |
| `committing`, generation G, with a claim (session, upload, time) | a replacement is closing R2's upload |
| `deleted`, generation G+1 | the owner deleted it |

A file with no record yet (every file from before this change, and new files
never replaced) is read from its object as `live` at generation 0.

**A replacement** records the generation it started from (`baseGen`).
1. To close, it first claims the record, which is allowed only while the record
   is `live` at that same generation.
2. Only then does it ask R2 to close.
3. After R2 has closed, the record moves to `live` at G+1, carrying the
   replacement's own upload id.

What it meets at step 1 decides the outcome:
- **Deleted meanwhile:** `410 removed`. Nothing is closed, the upload is
  aborted and its room is released.
- **A newer generation:** `409 replaced`, with the same clean-up.
- **Its own claim** (a close sent again): it carries on.

**A delete** writes `deleted` first and removes the object afterwards. While a
replacement holds a fresh claim, the delete is refused with
`409 replacing, retry: true`. A delete sent again is answered as done
(`already: true`) and does not move the generation. The library's delete
route sends media files here, after the existing "a page plays this file"
confirmation.

**A claim whose holder was interrupted** (amended after Codex's review of `69462730`; see the section below) is recovered by the next request that
meets it after `MEDIA_CLAIM_MS` (15 minutes):
1. The claimed upload is aborted first, so a close still in flight cannot land
   afterwards.
2. The object then shows which way it went:
   - **It carries the claim's upload id:** the replacement landed. The record
     moves to G+1 and the session is recorded as done.
   - **It does not:** the record stays at G, and the session is given up with
     its room released.
3. A close released after its claim was settled reports the record's actual
   state, deleted or given up, never "try again".

**A receipt** (the previous round's `whereNow`) also reads the record: a file
the record says is deleted is `removed`, even if a crashed delete left the
object in place.

**Proof it was the gap.** On `aef027fd`'s code, with the same barriers:
1. The delete in the gap answered 200 and removed the file.
2. The close then answered 200, and the file was present again.

That is Codex's reproduction. On the new code that delete answers
409 `replacing`.

## Stopping the old upload must be proven (Codex's review of `69462730`)

**What Codex reproduced.** `recoverClaim` swallowed abort errors as though
the upload were already closed or gone. The sequence:
1. Pause the replacement's completion inside R2's close.
2. Move the clock past `MEDIA_CLAIM_MS`.
3. Make every abort throw without stopping the upload, then delete.
   - The delete answered 200.
4. Resume the paused close.
   - It answered 200, recreated the object, and recorded its receipt done
     while the record said deleted.

**A claim is now settled only on a proven outcome:**
- **Landed:** the object carries the claim's upload id. That is true whatever
  the abort said, because a close happens once.
- **Stopped:** the abort succeeded, or R2 said the upload no longer exists
  (`NoSuchUpload`, code 10024). `uploadGone(e)` recognises exactly that.
- **Otherwise the claim is kept.** The delete, or a later replacement, is
  refused with 503 `unconfirmed` and `retry: true`. Nothing is released,
  nothing deleted, and no generation is moved until storage answers.

No further existence check was added: the question is settled by the abort's
proven outcome or the object's own upload id.

**Tests** (4 added to `test/media-mutation.test.mjs`, production routes):
- **Codex's exact interleaving.**
  1. The delete is refused as `unconfirmed`, with the claim, the old bytes,
     the reservation and the open session all kept.
  2. The paused close lands.
  3. Object, record (generation 1), both receipts (the replacement `done`, the
     original `replaced`), the reservation (released) and every answer agree.
  4. The delete sent again removes the file, and the receipt then says
     `removed`.
- **Storage returns before the close.**
  1. The delete sent again stops the old upload for certain.
  2. The generation is kept at 0, then the file is deleted.
  3. The session is given up and the room released.
  4. The resumed close cannot land and is told `410 removed`.
- **Control: R2 says the upload no longer exists.** That proves it stopped, and
  the delete goes through.
- **Control: the close had landed and the abort fails.** The object proves it
  landed: generation 1, then deleted at 2.

**Red check.** On `69462730`, exactly the two new failure cases fail: the
delete answered 200 (`{"ok":true}`). The controls pass on both versions, as
controls should.

**Sweep.** 6 of 6 killed, and the comment-only control survived. The mutants:
- an abort's failure taken as stopped;
- NoSuchUpload not taken as stopped;
- an unconfirmed stop settling the claim anyway;
- a landed close needing a confirmed abort too;
- any abort error read as NoSuchUpload;
- the delete writing an unconfirmed recovery.

## Tests

**`test/media-mutation.test.mjs` (9).** Real routes over the R2 double. The
double now has barriers before a multipart close lands
(`hooks.beforeComplete`) and before a delete lands (`hooks.beforeDelete`).
Together with `hooks.beforePut` on the record's conditional write, these hold
requests exactly between checking and committing.
- **Control.** An ordinary replacement goes to generation 1, and an ordinary
  delete goes to `deleted` 2. A file a page plays is still held for
  confirmation (`in_use`), and `force=1` deletes it. No reservation is left.
- **Codex's order.** The replacement is held at R2's close, and the delete is
  refused (`409 replacing`) with the old bytes untouched. Once released, the
  close lands. The delete sent again removes the file. A repeated close
  answers `410 removed` and nothing comes back.
- **Delete first.** The close answers `410 removed`, R2 is never asked to close,
  the upload is aborted and the room released. Status answers 404.
- **Delete in its own gap** (marked deleted, object not yet removed). The close
  answers `410`, then the delete finishes.
- **Overlapping, both orders.** Both requests read the record at the same etag,
  and both are held at their conditional write.
  - *The replacement writes first:* the delete's second read meets the claim
    (`409`), then the close lands.
  - *The delete writes first:* the close is told `410 removed`, and the file is
    not recreated.
- **Retries and lost answers.** A close sent again answers the same
  (`again: true`, no second R2 close). A delete sent again answers
  `already: true`, without moving the generation.
- **Interrupted before R2 closed.**
  1. A delete is refused while the claim is fresh.
  2. Past the lease, the recovery aborts the upload, keeps generation 0 and then
     deletes. The interrupted session is given up (404).
  3. The interrupted close, released, cannot land: it answers given-up or
     removed, and the file stays deleted.
  4. No room is held.
- **Interrupted after R2 closed, before the record moved.**
  1. Past the lease, the recovery finds the landed replacement and records it
     as generation 1, with its receipt done.
  2. The delete then removes it (generation 2), and the receipt answers
     `removed`.
  3. The stale holder's record write cannot land over the delete.

**`test/media-files.test.mjs`, one new case.** A newer generation saved while a
replacement was being sent: the close answers `409 replaced`, R2 is never
asked, the newer bytes are untouched and the room is released.

**Red check on `aef027fd`.** 8 of the 9 mutation cases fail there. Most fail
first because there is no record; Codex's sequence, run without that
assertion, shows the recreation (above). "Delete first" passes on the old code
too, because its existence check already caught that order.

**Mutation sweep, first part:** 13 mutants. 11 were killed and the
comment-only control survived. The mutants covered:
- a delete ignoring a fresh claim;
- a replacement closing without claiming;
- the generation not checked;
- a recovery ignoring a landed close;
- the record not moved after the close;
- the record's write not conditional;
- a receipt ignoring a deleted record (killed after a test was added for the
  half-done delete's receipt);
- a settled claim's failed close said as a retry;
- the library's delete bypassing the record;
- a delete removing the object before marking the record.

Two survived, and both are equivalent today:
- **Recovery without its first abort.** Only a delete recovers a claim, and
  the delete removes the object after its record write, so the outcome is
  identical.
- **The record without its revision and write id.** Every record write
  changes its generation, state or timestamp, so its bytes never repeat. The
  revision and write id guarantee this instead of relying on it.

**Affected tests together:**
- First run: 1031 pass, 0 fail, over 45 files. That set missed `test/site-busy.test.mjs`, a source guard on `worker.js` (below).
- Final run on `cbd396d8`: 7272 pass, 0 fail, over 288 files. These were every file that reads `worker.js` or `site-media`, or uses the media or build doubles, plus the conversation and progress files.

**Full offline suites, every run recorded:**
1. On `344d1a10`: `10888 / 10885 / 1 / 2`. The failure was this change's own
   and deterministic. The source guard in `test/site-busy.test.mjs` pins the
   media delete's page read, which had moved to skip itself after `force=1`.
   The guard was re-anchored in `69462730`; the count is still 10 and the read
   is still read-only. Unit CI on `344d1a10` was red for the same reason (run
   38668530734).
2. On `69462730`: stopped partway, by me, before Codex's review was folded in,
   so that it would not read files being edited. No result is claimed for it.
3. On `cbd396d8`: `10892 / 10890 / 0 / 2`.

**Unit CI on `cbd396d8`:** green, `10892 / 10845 / 0 / 47` (run 38670111433;
CI has no browser, so the browser cases are among its skips). Site build is
green (run 38670111439). On `69462730`, unit tests were green (run
38669279438).

**Image prediction:** `cbd396d8` → `484f4945d711b3c8` (208 inputs); nothing built.

## The progress-ordering failure from the last full suite

**What failed.** `PLW 4` in `test/progress-live-writer.test.mjs`, in the full
suite on `bb1c1f31`. The photographs line held
`[f7 prepared "New page written, not published yet: /bakers.", f10 prepared
"The photograph … was made and put on the page. Not published yet."]`, where
the test expects the photograph's fact alone.

**What it is: a test-order assumption, not a product ordering requirement.**
- In `worker.js`, `mark()` only queues a milestone's record write (`step(...)`).
  The job does not wait for it. The test's header says so too ("the job, which
  does not wait for its milestones").
- So nothing promises the `pages` milestone has landed by the time the photo
  call starts.
- The test waited only for the photo call before delivering the first line.
  Under the full suite's load, the `pages` record write was still queued, so
  the page's fact rode on the next line.

**Reproduced exactly.** I held the `pages` milestone's record write until after
the first line. The second line then holds exactly those two facts:
`[f7 prepared …, f10 prepared …]`, byte for byte the full-suite failure.

**The product behaviour in that case is correct.**
- Each fact is told once and in its own state.
- Nothing is said to be done that is not.
- The part ends done.

**What changed, in the test only.** No assertion was changed.
- The harness now waits for the `pages` milestone to land before delivering the
  first line, as it already waited for the publish milestone.
- New case **PLW 5** holds that write on purpose and pins the late-landing
  behaviour: the page and the photograph each told once, in their own states,
  and the part done.
- The progress code itself is untouched.

**The earlier record stands.** The failure in the full run on `bb1c1f31`
happened, and green CI did not erase it. This entry explains it; it does not
replace it.

## Not shown (live only)

- **Real R2 under real concurrency.** The record's conditional writes, and R2
  refusing to close an aborted multipart upload, are shown against the double,
  which follows R2's documented etags.
- **The recovery's lease is a choice.** A holder that closes R2's upload more
  than 15 minutes after its claim cannot land, because the recovery aborts its
  upload first. Until then, a delete is refused and has to be sent again.
- **A crashed delete leaves an orphaned object.** If the record was marked
  deleted but the object was not removed, the object stays until the delete is
  sent again. `/u/` still serves it, and the library lists it, though receipts
  and replacements treat it as deleted.
- **Drafts are not covered.** Drafts cannot be replaced; a draft deleted while a
  build moves it is outside this change.
- **Still open from earlier rounds:** proprietary codecs (MP4, MOV, M4A, AAC),
  Safari and Firefox, real models, edge caching, and the upload record being
  per browser.
