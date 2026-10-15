# 2026-10-15 — Codex's review of `7ca339d1`: completion, admission, history cuts, media narration

Branch `new`. Unmerged and undeployed. No container build, no paid call, no
generated media, and nothing on `claude/help-needed-ehlwlj` touched.

Codex confirmed green unit CI on `7ca339d1`. It then reproduced four faults
that the first round's tests did not reach. All four are fixed here, and each
reproduction is now a test that fails on the old code.

## 1. Upload completion: durable and asked again safely

**What Codex reproduced.**
- `handleMediaComplete` completed the object and then deleted its session, so
  a second `complete` answered 404.
- `public/site-media.js` treated a lost answer to `complete` as a failure and
  called `abort`, although the file had been saved.

**What happens now (`site-media.mjs`).**
- **The session is kept after it finishes.** It is saved with
  `state: "done"` and the file it made, for another 24 hours.
  - A repeated `complete` answers the same file, `200` with `again: true`.
  - An `abort` that arrives after the finish keeps the file and says so.
  - A part sent after the finish is refused with `409 done`.
- **The file carries its upload's id.** It is stored as `up` in the file's R2
  custom metadata. A `complete` that finds the upload already closed by R2 (R2's
  own answer lost) reads `up` and recognises the file as its own.
- **Each part's etag is recorded as it lands** (`media-parts/<scope>/<sid>/<n>`).
  - `complete` uses the server's record first, and the page's list only for
    parts the server did not record.
  - A part missing everywhere is asked for by number (`parts_missing`,
    `missing: [n…]`).
- **A new status route**, `GET …/media/<session>` (site) and
  `GET /api/media/drafts/<session>` (drafts), answers one of:
  - `done`, with the file;
  - `open`, with the parts the server holds;
  - `404`, when the upload expired, was cancelled, or belongs to another
    account.
- **Each session is bound to the account that started it** (`by`). Within the
  same scope and past the same gate, another account's request finds nothing.

**What the page does now (`public/site-media.js`, `chat.js`).**
- **A lost or unclear end is asked about.**
  - The page calls `status` (5 tries with backoff).
  - A finished upload counts as finished (`recovered: true`).
  - An open one is finished again, sending only the parts the server lacks.
  - When nothing can be found out, the answer is
    `{ ok: false, uncertain: true, code: "unconfirmed" }`. It is never called
    failed and never aborted.
- **The page keeps a record of each upload**, in the browser's own storage
  (`gf-media-uploads`, 24 h). It is keyed by where the file goes, what it
  replaces, and the file's name, size and last-modified time. It holds only the
  session id and the result, never the bytes.
  - The same file attached again, after a lost answer, a reconnect or a reload,
    reuses a finished upload (`reused: true`, no bytes sent).
  - If the upload is still open, it resumes: only the missing parts are sent.
- **The composer chip has a new state**, "Video · checking it finished…".
  - It is re-checked every 5 s (6 times) and whenever the browser comes back
    online.
  - The message waits while a chip is in this state.
  - A chip shows "Not uploaded" only when the server says the upload is gone.
- **The Files panel** says "couldn't confirm yet" and refreshes its list
  instead of reporting an error.

## 2. Quota admission and replacement accounting: atomic

**What Codex reproduced.** Under a one-file, 100-byte limit, two simultaneous
starts both answered 201, reserving two files and 120 bytes.

**What happens now.**
- **Every reservation is an entry in one record per scope.** This covers an
  upload, a replacement, and a draft moved into a site by a build. The record
  is `media-ledger/<scope>.json`, changed only by an R2 conditional write over
  the etag it was read at. This is the same `onlyIf` pattern `worker.js`
  already uses for build claims and replies.
  - A writer that loses the race reads again (up to 8 times) and counts the
    winner.
  - If it cannot get a turn, it answers `503 busy`.
- **The order is the ledger, then the scope's stored media, then the write.**
  A finishing upload stores its file before it gives back its reservation, so
  at any moment the bytes are counted once or twice, never not at all.
- **A replacement reserves its whole size.** While it is being sent, the old
  file is still stored and served, so a promise to be smaller releases nothing.
- **A replacement is admitted one at a time per file.** A second replacement of
  the same file is refused with `409 replacing` until the first finishes, is
  cancelled, or expires.
- **Reservations end on their own.** Expired entries are dropped, and their
  uploads aborted, by the next write. A finished upload gives its room back as
  it records its completion.
- **Both scopes use this.** Site libraries (`site-<slug>`) and account drafts
  (`draft-<uid>`) go through the same path, and so does the build's move of
  drafts into a new site.

## 3. History truncation: carried end to end

**What Codex reproduced.** `historyWire` cut each message to 4,000 characters
and dropped the earlier turns before `readHistory` saw them, so the models were
shown those prefixes as complete.

**What happens now.**
- **The page sends what it cut** (`public/chat-talk.js`). A cut turn carries
  `full`, its whole length. When turns are dropped, the list opens with
  `{ omitted: n }`.
- **`readHistory` reads both strictly.**
  - `omitted` is believed only as the list's first item, as the only key, and
    as an integer from 1 to 100,000.
  - `full` is believed only as an integer longer than the text it came with.
  - Anything else claims nothing; an invalid item is counted as one left out.
- **Both models are told.** The router (8-turn window) and the conversation
  reply (30-turn window) are shown each cut with its real length ("only the
  first 4000 of its 5714 characters are shown") and the count of messages not
  shown. They are also given a rule: if the latest message refers to something
  that could be in a part not shown, ask; never guess.
- **The router's `resolved` field** (a request written out from the
  conversation) is never written from a part marked as not shown. When the work
  depends on such a part, the answer is "ask", asking the owner to say it again.

## 4. Media narration: written by the model

**What was wrong.** `mediaSentence` added a fixed sentence to the build's
`contextNote`, for example "Your video "…" is in your site's file library now,
and the pages were given its address." That was ordinary narration written by
us.

**What happens now.**
- The page writer, which writes the build's reply in `notes`, is given the
  outcome as facts:
  - which library files this request moved in (marked `moved`);
  - which files could not be added, and why.
- It is told to say in its own words where each file is played, and to say
  plainly what was not added.
- **The only fixed line kept** is the technical error, `mediaErrorNote`:
  "Not added to your site's file library: "x" (the site's video and audio
  storage is full)." It covers the case where page writing itself fails.

## Tests

**New tests** (all through real handlers; the page's flow through its real
code):
- `test/media-recovery.test.mjs` (10). Real Worker routes over the R2 double,
  with conditional writes and interleaving calls (`lag`); the real uploader
  over those routes, on a network that loses chosen answers after the route
  has run. Covers:
  - Codex's two reproductions;
  - five starts under a three-file limit;
  - draft starts;
  - competing and smaller replacements;
  - a repeated complete, an abort after the finish, and status;
  - R2's own answer lost;
  - nothing being findable, then confirmed and then reused after a "reload";
  - a page closed mid-part, then resumed with only the missing part;
  - ownership of status;
  - a build's move blocked by an in-flight reservation.
- `test/conversation-gaps.test.mjs` (4). The page's own `historyWire` (34
  turns, one reply of about 5,700 characters holding three headline versions)
  through strict reading, both prompts, and the real route. A reference to the
  cut part is asked about, and no work starts.
- `test/media-composer-browser.test.mjs` (1, real Chromium). The repo's own
  `public/` app, with every media request answered by the real Worker:
  1. A video attached in the composer: the answer to `complete` is lost and
     status is unreachable. The chip says "checking it finished…", nothing is
     aborted, one file is stored. When the connection returns, the chip turns
     ready.
  2. The message carries the file's address.
  3. After a reload, the same file is reused, with no part re-sent.
  4. The Files panel lists the video, replaces it through Replace (same
     address, one file), adds a recording through Add a file, and deletes it.

  It passed 10 runs in a row with files chosen from disk. The first run, with
  in-memory files, failed once: two part requests in step 1. That run still
  stored one file, which is the outcome the test protects. It did not happen
  again, and its cause is not established.
- **Unit and guard additions:**
  - an account binding case (status, part and complete from another account,
    same scope);
  - the server-recorded parts finishing an upload with no list from the page;
  - a replacement's whole-size reservation;
  - the completion record left after a finish;
  - the writer being told which files moved and which did not;
  - the fixed narration gone from `contextNote`.

**Red checks** (new tests against `01483928`'s code, in a throwaway worktree):
- `media-recovery` failed 10 of 10, each for the reproduced reason:
  - "two starts at once were both admitted", with both bodies 201;
  - "a repeated complete was not answered", the 404 Codex saw;
  - "a saved file was reported as failed".
- `conversation-gaps` failed 4 of 4.

**Mutation sweep** (26 mutants across the server, the Worker, the page, the chip, the history wire and reader, both prompts and the build's media facts; run against the media files/route/recovery/client tests and the three conversation files, plus the browser case for the chip): 26 of 27 killed, and the comment-only control survived. The one survivor, which lets an abort after the finish go through, is equivalent: the next branch reads the file's `up`, finds the completion record and gives the same answer.

**Full offline suite:**
- On `4315e31c`: `10869 / 10866 / 1 / 2`. The one failure is the first build's router pin, which the router text changed on purpose.
- Re-pinned in `4ce4fa68` after proving it: with the two new strings taken back out of each request, all 42 old request halves come back, and all 42 reading halves are unchanged.
- On `4ce4fa68`: `10869 / 10867 / 0 / 2` locally, and `10869 / 10823 / 0 / 46` on unit CI (run 38664068165). CI has no browser, so the browser cases, this round's included, are among its skips.

**Not shown (live gaps):**
- R2's real conditional write under real concurrency, and the real multipart
  `complete` throwing after it stored the object. Both are shown only against
  the R2 double, which follows R2's documented behaviour.
- Ledger contention at scale. Eight retries suit one owner's uploads, not a
  crowd; past that, the answer is 503, which the page shows as the server's
  sentence.
- Housekeeping. A finished session's record (a few hundred bytes) stays in
  `media-sessions/` after its 24 hours until something reads it. There is no
  sweep and no R2 lifecycle rule. Ledger and part records are removed as they
  are used.
- The browser record is per browser. Another device cannot reuse an upload, and
  re-sends the file.
- Proprietary codecs (MP4, MOV, M4A, AAC) are not played here; this Chromium
  has no H.264/AAC decoder. Safari and Firefox are not run.
- What a real model writes. This covers the page writer's `notes` about moved
  files, and whether a real router asks rather than writing `resolved` when the
  reference is in a cut part. No paid call was made.
