# Parallel tasks, round 9: every attachment read whole before any is kept (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker routes,
> request driver, queue consumer and cron, with the network blocked. Nothing
> here is live proof.

The owner's order (2026-10-09), after Codex reviewed `e72b46d6`, passed the 23
tests in `addon-attachments`, `parallel-batch` and `build-parallel`, and
confirmed the newer site-build gate green. One defect remained:
- **Codex's reproduction.** A post to the real legacy add-on route carried
  one valid file, `{name:"broken.png", data:"data:image/png;base64,AAAAA"}`,
  a valid key and `attached: true`.
- **What it did.** The route answered 200 with an accepted request, but
  `rec.files` held only the valid file.
- **Why:**
  - `attachmentData` checked the data-URL shape without decoding;
  - `storeRequestFiles` caught the Base64 failure and went on;
  - `filesMissing` stayed false, because one file survived.
- **The order.** Fix it generally, check the router's acceptance and the
  answer path, and never present a partial set as complete.

## 1. The change

The change is in two commits: `18d6aae1`, and `58d3350b`, which follows the
sweep.

- **One shared reading** in `worker.js`, `decodeAttachment` and
  `readAttachments`:
  - a file must be a data URL;
  - its Base64 must be standard (RFC 4648): whitespace is allowed anywhere
    and removed, and padding only at the end;
  - it must decode to at least one byte.
  `readAttachments` returns the files that read, the ones that do not (by
  name), and whether there are more than one request carries
  (`MAX_ATTACHMENTS`, 3). `attachmentsWhole` is true only when every file
  reads and the count fits.
- **`storeRequestFiles` keeps all or none.** It throws on a list that does
  not read whole, instead of skipping a file. No caller hands it such a list
  (below); this is the backstop.
- **The callers, each checked:**
  - **The router's acceptance** (`acceptRequest`) declines a message whose
    files do not all read. That is the existing fallback: the message is
    answered as before, and no request is created.
  - **The legacy add-on** (`addonAsRequest`) goes through the same
    `acceptRequest`, so it takes the same rule from one place; its own second
    check was removed in `58d3350b`. A post it declines stays a job of its
    own, as in round 8.
  - **An answer to a part's question** whose file does not read is refused
    whole, 422 `answer-files-unreadable`, with `cost: 0` and the unreadable
    names. This happens before any model call, charge or file write. The
    question stays open, and the page puts the answer and its files back in
    the box. This is fixed error text, like the existing `answer-files-full`;
    **the questions themselves stay model-written.**
- **Never a partial set shown as complete.** A request holds every file it
  was sent, or it is not created. A post that only says files came (round 8)
  still gets `filesMissing`, and the picker may ask.

## 2. What an add-on does with attachments (unchanged)

- **The add-on step preserves attachments but does not consume their image
  contents, on any path.**
- The files are kept with the request (`rec.files`). They reach the part's
  questions, the answers that bring more, and later parts that do read files
  (the logo layer).
- **Using a customer's own picture inside an addition is not implemented**,
  and is not claimed.

## 3. Tests and results

- **New in `test/addon-attachments.test.mjs`** (the real Worker, the network
  blocked):
  - AT 7: Codex's mixed payload. The post stays a job, no request, nothing
    kept, and no partial list anywhere.
  - AT 8: every file malformed. The same.
  - AT 9: seven malformed files, each beside a valid file: a length of 4n+1,
    no padding, padding in the middle, too much padding, padding past a
    quad, nothing after the comma, and no Base64 marker. Each post stays a
    job with nothing kept.
  - AT 10: PNG, JPEG, WEBP, GIF and PDF, with line breaks, spaces and tabs in
    their Base64. Each is kept byte for byte, under its own type and name.
  - AT 11: the clarification resubmission. An answer with an unreadable file
    is refused (422):
    - no file joins and the question stays open;
    - the routing model is not asked and the ledger does not move.
    The same answer sent again with files that read resumes the part, and the
    delayed photograph is placed once.
  - AT 12: the router's own acceptance. No request, no record and no files,
    and no store-failure flag: a decline, not a failure.
- **Kept and passing**:
  - AT 2: a duplicate post finds the same request, with the files written
    once, no second addition and no second purchase;
  - AT 1: valid files recovered with the page closed, the cron alone driving
    it, one purchase and each job charged at most once.
- **Red check** on `e72b46d6`, the new test file copied in: **AT 7, 9, 11 and
  12 fail, 4 of 4 defect cases**. AT 8 and AT 10 pass there, because they
  describe behaviour that already held: every file failing already left no
  request, and valid files already decoded.
- **Focused run** on `58d3350b`: `addon-attachments`, `addon-runtime-paths`,
  `addon-pending-forms`, `addon-pending-photo`, `pending-frames`, the
  seven-task batch (`parallel-batch`) and Build progress (`build-parallel`),
  the network blocked: **`58 / 58 / 0 / 0`**.
- **Sweep.** The first sweep, on `18d6aae1`, left 4 survivors, each showing
  a redundant layer:
  - an unreachable `atob` catch, now removed;
  - `addonAsRequest`'s duplicate check, now removed;
  - the router's decline not told apart from a store failure, now asserted by
    AT 12;
  - `store-skips`, kept (below).
  The re-sweep, 5 product mutants and a comment-only control:
  - killed: `pattern-only` (shape checked, not decoded),
    `whitespace-kept`, `router-partial-accepted` and
    `answer-unread-ignored`;
  - **survived: `store-skips`** (the store skipping an unreadable file again).
    That is the all-or-none backstop inside `storeRequestFiles`, which no
    caller can reach, because every caller declines or refuses first. **Kept
    on purpose and declared here.**
  - the control survived.
  **4 of 5 product mutants killed.**
- **Full suite**: **`10271 / 10271 / 0 / 0`** on `58d3350b` (was 10265).
- **Required CI** on `58d3350b`:
  - unit tests (run 37926585857): green, `10271 / 10230 / 0 / 41`, the same
    total as locally;
  - site build (run 37926585858): green on every job, all four shards and
    "all checks".
- **Image** (predicted, not built): **`6c9fc805fe4de0d8`** (204 inputs; was
  `f17b91256b43680f` at round 8).

## 4. Remaining limitations

1. **No live evidence**: no real model, image service, container door or
   timing.
2. **The add-on step does not consume attachment image contents.** It only
   preserves them (§2).
3. **A message whose files do not all read**:
   - in the router, it is answered as before, with no request, so it gets no
     durable recovery;
   - as a legacy add-on post, it stays a job of its own (nothing places its
     frames later).
   The customer is not told which file failed on those two paths; only the
   answer path names it.
4. **Decoding is not content checking.** A file whose Base64 decodes is kept
   under the type it declares; its bytes are not checked against that type.
5. **Unchanged from round 8:**
   - the `/frames` door needs the new image;
   - the synchronous add-on, the flow off, and a token inside a longer string
     are told, never placed automatically;
   - the image provider has no idempotency key.
6. **`store-skips`**: an unreachable backstop that the tests do not pin
   (§3).
