# 2026-10-15 — One verification proposal for the assistant and media work (branch `new`)

A proposal only. Nothing in it has been run. Nothing is merged, deployed, built
or pressed, and no model call or purchase was made to write it.

## Where things stand

- **Code head: `cbd396d8`. Documentation head: this file's commit, on top of
  `bdebc5e3`.**
- **Final CI on the code head (`cbd396d8`):**
  - unit tests green, `10892 / 10845 / 0 / 47` (run 38670111433);
  - site build green (run 38670111439).
- **Final CI on the documentation head (`bdebc5e3`):** unit tests green,
  `10892 / 10845 / 0 / 47` (run 38670979502). A documentation-only push starts
  no site build.
- **Final local full suite on `cbd396d8`:** `10892 / 10890 / 0 / 2`.
- **`main` has moved to `8e24ca5b`** (help-needed's verification batch).
  - It already holds everything `new` had up to `9ceca1d4`.
  - It holds none of `new`'s 15 later commits (`5f425ceb` … `bdebc5e3`): the
    assistant, video/audio upload to playback, recovery, receipts, quota, the
    per-file mutation record, and the proven-stop fix.
- **Image prediction for `cbd396d8` alone:** `484f4945d711b3c8` (208 inputs).
  A combined candidate's image differs and must be predicted on that tree.

## Can verification share help-needed's eventual deployment and container build?

**Yes, but only as one combined release candidate on `main`.** Nothing about
`new` can be verified live without that.

- **`deploy.yml` deploys on a push to `main`.** It also accepts
  `workflow_dispatch` with no branch guard, so dispatching it from `new` would
  deploy `new` to production in place of `main`. That must not be used for
  verification.
- **There is no preview environment.** `wrangler.jsonc` has one Worker
  (`isibi-app`), and the container image is built from the deployed tree's
  inputs.
- **So one deploy and one image build serve both branches** once help-needed's
  next merge and `new`'s 15 commits land together.

**A trial merge, done locally and discarded.** I merged `new` into
`origin/main` (`8e24ca5b`) in a throwaway worktree. Nothing was pushed or kept.
Three conflicts, all mechanical:
- **`Dockerfile`:** both sides added modules to the same `COPY` lines. `main`
  adds `builder/content-evidence.mjs`; `new` adds `site-media.mjs` and
  `builder/site-converse.mjs`. Keep both.
- **`public/chat.js`:** the build request body. `main` adds `accept: 'early'`;
  `new` adds `media: site.pendingMedia`. Keep both.
- **`docs/owner-notes.md`:** documents only.

`worker.js` merged without a conflict, but two interactions need checking in
the combined candidate:
- `main`'s early-accepted build (`accept: 'early'`) together with `new`'s draft
  move;
- the build's reply fields (`media`, `contextNote`) reaching the page through
  the follow that `main`'s early accept uses.

The combined candidate stays paused until the owner says to prepare it.

## Implementation gaps vs. behaviour only awaiting live verification

**Implementation gaps.** Known, documented, not fixed.
1. **Interrupted delete cleanup.** If a delete crashes after the file's record
   says `deleted` but before the object is removed, the object is still served
   at `/u/` and listed in the library. That lasts until the delete is sent
   again. Receipts and replacements already treat it as deleted.
2. **Draft transfer.**
   - Drafts sit outside the per-file mutation record.
   - A draft deleted while a build is moving it is not coordinated.
   - After a move, the draft's receipt says `removed` (it is no longer a
     draft), and the page uploads the file again rather than linking to the
     site's copy.
   - Expired drafts are removed only when the account's drafts are next listed
     or used, not on a schedule.
3. **Finished-session records** (`media-sessions/`) are not cleaned up on a
   schedule. There is no R2 lifecycle rule.
4. **The upload record lives in one browser.** Another device sends the file
   again.
5. **A storage outage holds deletes.** While R2 cannot confirm an old upload
   stopped, a delete of that file answers 503 `unconfirmed` until it can. This
   is safe, but the owner has to send it again.
6. **The claim lease of 15 minutes is a judgement call.**
7. **One unresolved receipt case.** If an upload finished at R2 but its record
   was never written, and the file was then deleted, the session reads as open.
   The page ends "not confirmed yet" until the session expires (24 h).
8. **A test double, not the product.** The build-route test double still gives
   counter etags. This was suggested as its own task.

**Awaiting live verification only.** Built, and tested offline against stand-ins.
1. R2's conditional writes: `etagMatches`, `etagDoesNotMatch: "*"`, and the
   content-MD5 etag.
2. R2's error for an aborted or unknown multipart upload (expected
   `NoSuchUpload` / 10024).
3. R2 refusing to close an aborted upload.
4. Multipart throughput, and a real browser's upload of a file of several
   parts.
5. The edge's handling of `Range`, `206`, `416`, `304` and the 5-minute
   revalidated cache, at both `gofarther.dev/u/` and `<slug>.gofarther.app/u/`.
6. Playback of MP4, MOV, M4A and AAC (not played here; this Chromium lacks
   H.264/AAC). Also Safari, Firefox, iOS and Android.
7. What a real model writes:
   - conversational answers and their length;
   - asking rather than guessing on a cut history;
   - the router's `resolved`;
   - the page writer's media narration in `notes`.
8. The real cost of a conversational message (routing plus reply).

## The fixtures

All are in `test/fixtures/media/`, generated locally with ffmpeg (a test tone
and a test pattern). None is model-generated.

| File | Bytes | Contents |
|---|---|---|
| `clip.webm` | 15,452 | VP8, 64×48, 4.0 s |
| `clip.mp4` | 7,127 | H.264, 64×48, 4.0 s |
| `clip.mov` | 3,618 | H.264, 64×48, 2.0 s |
| `tone.mp3` | 8,482 | MP3, 22.05 kHz, 2.06 s |
| `tone.m4a` | 7,187 | AAC in MP4, 22.05 kHz, 2.0 s |
| `tone.aac` | 6,515 | AAC (ADTS), 22.05 kHz, 2.09 s |
| `tone.wav` | 32,078 | PCM 16-bit, 8 kHz, 2.0 s |
| `tone.ogg` | 4,556 | Opus, 48 kHz, 2.0 s |
| `tone.flac` | 15,956 | FLAC, 8 kHz, 2.0 s |

**One larger local file for the part-by-part and reconnect checks.** It is made
locally and is never uploaded except to the test site: a 20 MB WAV of a test
tone, three parts of 8 MiB. Made with:

```
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=44100 -t 118 -ac 2 test-20mb.wav
```

**For the refusal checks:** `renamed.mp4`, which is `tone.mp3` renamed (expect
`415 format_mismatch`), and any PDF given a `.mp3` name (expect `415 bad_type`).

## Part 1 — checks with no model call (free apart from storage)

These run on the deployed combined candidate, on a test site that is not one of
help-needed's fixtures. The site comes from Part 2's build, or an existing
throwaway site the owner chooses. The owner runs each one in their own browser.
Readings come from the browser's network panel and the site's Files panel. No
credential is read or minted.

**F1. Upload, list, play and seek: every fixture, in Chrome, then Safari,
Firefox, iOS Safari and Android Chrome.** For each fixture:
1. Add it through Files → Add a file. The progress shows, then the file is
   listed with its kind, size and length.
2. Read its `/u/` address with a GET: expect 200, the right `content-type`,
   `accept-ranges: bytes`, `cache-control: public, max-age=300,
   must-revalidate`, and an ETag.
3. Read the headers with a HEAD.
4. Play it in the panel's player and seek to the end. The network panel should
   show `206` with a `content-range`.
5. Request a range past the end: expect `416`.
6. Request it again with its ETag: expect `304`.

Expected outcome: WebM, WAV, MP3, Ogg and FLAC play everywhere they are
supported. MP4, M4A and AAC play in Chrome, Edge and Safari. MOV plays in Safari
and Chrome, and may not in Firefox. Record the actual result for each browser
and format.

**F2. Refusals.**
- `renamed.mp4`: `415 format_mismatch`.
- The PDF named `.mp3`: `415 bad_type`.
- A video over the 250 MB default limit: `413 too_big` before any byte is sent.
  Only the start request is made; no big file is needed.

**F3. Replace.**
- Replace `tone.mp3` with another MP3 (for example the 20 MB WAV converted to
  MP3 locally). Expect the same address, a new ETag, and the player playing the
  new file after at most 5 minutes of cache.
- Replace it with a WAV: `409 format_mismatch`.

**F4. Delete.**
- Delete a file no page plays: it is gone, its address answers 404, and the
  library count drops.
- Delete a file a page plays: `409 in_use`, naming the page. Confirm: it is
  deleted, and the page's player goes silent, as designed and said.

**F5. Reconnect and reload with the 20 MB WAV.**
1. Start an upload in the composer, set the network to offline in devtools part
   way, then back online. Only the failed part is sent again, and the chip ends
   ready.
2. Start another upload and reload mid-way, then attach the same file. Only
   the missing parts are sent; check the count of PUTs.
3. Attach a file that already finished. It is reused, with no PUT.
4. Delete it in Files, then attach it again. It is sent again as a new file.

**F6. Before a site exists.** On a new project's start screen, attach
`clip.webm` and `tone.mp3`. Both chips show ready, and `GET
/api/media/drafts` lists both. This is free; Part 2's P9 then builds with them.

**F7. Real-storage concurrency.** Run from the browser console on the test site
as the signed-in owner. These are small `apiFetch` snippets, handed over with
the batch when it is approved. Each is repeated 10 times, and the outcomes must
always match:
- **Admission under the draft allowance (6).** Fire 8 draft starts of 100
  bytes at once. Exactly the room left is admitted; the rest get `409 full`.
  Then abort them all, and the ledger is empty again (a follow-up start is
  admitted).
- **Competing replacements.** Two replace starts of the same file at once: one
  `201` and one `409 replacing`.
- **Delete versus replacement.** Send a replacement's single part, then fire
  its complete and the file's delete together. Exactly one of these must hold:
  - complete `200` and delete `409 replacing` (then a second delete `200`);
  - delete `200` and complete `410 removed`.

  Afterwards the file's address and the Files panel must agree. Never both
  `200` with the file present.
- **Repeated and lost answers.** Complete the same session twice: the second
  answers `200` with `again: true` and no second file. Delete twice: the second
  answers `200` with `already: true`.

**F8. What these free checks cannot reach.** R2's `NoSuchUpload` error and its
refusal to close an aborted upload are reached only by the stale-claim
recovery, which waits 15 minutes and needs an upload interrupted at R2's close.
Exercising that live needs either:
- a small read-only probe added to the free canary, which is a code change and
  would be proposed separately; or
- a long manual sequence: start a replacement, kill the tab exactly during the
  close, and wait out the lease.

I propose leaving this to the offline tests, and recording it as not shown
live.

## Part 2 — paid model calls (each needs the owner's approval)

Costs use the measured history in CLAUDE.md and the price table in
`builder/publish-pages.mjs`. One credit is $0.008. The default model is grok-4.6
($2 in and $6 out per million tokens).

**The ledger is read before and after every step. Before any of it, the balance
must be read, not assumed:** the last figure recorded for the building account
was 13 credits, which is below the smallest useful set.

**A conversational message costs routing plus the reply's own call, under one
charge.**
- Routing has measured 1–2 credits.
- The reply's call:
  - typical: about 5,000 input tokens and 600 output tokens, about $0.014, so
    about 2 credits;
  - worst case at the full context window and the 2,400-token ceiling: about
    11,000 input and 2,400 output tokens, about $0.037, so 5 credits.
- Expect **2–4 credits per message, 6 at most** on grok. With the `sonnet`
  picker, up to about 9.

**P9. A first build with media drafts, the model-written narration (run first;
the other cases run on its site).**
- **The message**, on F6's project with both drafts attached:

  > A small bakery in Leeds called Harbour Loaf. Put the attached video on the
  > home page and the jingle on an About page. No photographs please.

- **Expected outcome:**
  - The drafts move into the new site's library and `/api/media/drafts` is
    empty.
  - The pages play both files from `/u/<slug>/…`.
  - The reply (`notes`) says in the model's own words where each file plays.
  - No fixed sentence such as "is in your site's file library now" appears.
  - The context note is empty unless a file could not be moved.
  - The draft receipts answer `removed`.
- **Cost:** 11–45 credits (measured first builds), plus routing of 1–2. "No
  photographs" is meant to keep picture purchases out, at $0.15 (about 19
  credits) each. If the design buys any anyway, the reading says so.

**Conversational cases on P9's site.** One message each, 2–4 credits each:
- **P1, a greeting.** "hi". Expected: a short greeting and an invitation, no
  stock opener, no work started, routing plus reply charged once.
- **P2, a detailed comparison.** "Should I use a booking page or an enquiry
  form for bread-making classes? Compare them for me." Expected: a structured
  answer with headings or lists, drawn correctly in the chat, and no work
  started.
- **P3, a grounded question.** "What does my home page say about the video?"
  Expected: an answer from the stored page words and the file library (name,
  kind, size), and no claim of having watched the video.
- **P4, missing context.** "What time do we open on Sundays?" with no hours on
  the site. Expected: it says it doesn't know from what it was shown, and how
  to add the hours. No invented time.
- **P5, a cut history and clarification.**
  1. Ask for "three versions of a headline, each with a long explanation", so
     the reply runs past 4,000 characters (this is one P-message on its own,
     2–4 credits).
  2. Then send "use the third version".

  Expected: if the third version is past the cut, the assistant says it can't
  see it and asks for it again. No edit runs and `resolved` is absent. If the
  model happened to put the third version before the cut, the case is
  recorded as not exercised, and is not repeated at cost.
- **P8, discussing an attachment.** Attach `clip.webm` in the composer and ask
  "What could I use this clip for on my site?" Expected: it stays conversation,
  the file is named as unseen, there's no claim of having watched it, and no
  work starts.

**Optional, only on the owner's word:**
- **P7, discussion becoming action.** After P2, "ok, add the enquiry form on
  the About page". Expected: `resolved` is written out, the add-on runs once,
  and the reply says what was done. Cost: routing 1–2 plus an add-on, 2–13
  measured.
- **P10, Edit with media.** "Add the jingle as an audio player at the bottom of
  the Visit page" (if there is one; otherwise the About page). Expected: the
  page writer is given the file's address, and the player plays it. Cost:
  routing 1–2 plus the page step, 6–22 measured.

**Totals (estimates, not caps):**

| Set | Credits |
|---|---|
| Minimal: P9, then P1–P5 and P8 (7 messages, P5 being two) | about 26–75 |
| With P7 and P10 | about 35–112 |

Nothing caps a request, so the balance is the only bound. A top-up is likely
needed, and how the account is topped up is the owner's matter.

## Order, when the owner approves

1. The owner says to prepare the combined candidate (help-needed's next merge
   and `new`'s 15 commits).
2. Resolve the three conflicts as above, predict the image, verify rollback,
   and confirm required CI is green. Then the owner says merge.
3. Deploy and confirm the runtime with the free canary (sha and image).
4. Run Part 1 (free).
5. Read the ledger, then run P9, then the conversational cases, each with its
   reading recorded.
6. Run the optional P7 and P10 only on the owner's word.

## Correction to an earlier record

The `aef027fd` round recorded the mutant "a recovery does not abort the claimed
upload first" as equivalent: only a delete recovers a claim, and the delete
removes the object afterwards. **That was wrong.**

Codex's reproduction on `69462730` showed why stopping the old upload has to be
proven. An abort that did not happen, or that failed, leaves the old close able
to land after the delete has answered 200, and it brought the file back. The
first abort, and its outcome, is what makes recovery safe.

On today's code (`cbd396d8`) that mutant is killed by 3 tests:
- interrupted before R2 closed;
- abort fails, then storage returns;
- NoSuchUpload.

The other survivor recorded then, "the record without its revision and write
id", remains equivalent. Every record write changes its generation, state or
timestamp, so its bytes never repeat; the revision and write id guarantee it
rather than rely on it.
