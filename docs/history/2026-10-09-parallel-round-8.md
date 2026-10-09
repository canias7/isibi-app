# Parallel tasks, round 8: a legacy add-on with attachments taken on with its files, and the site-build gate (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker routes,
> request driver, queue consumer and cron, with the network blocked. Nothing
> here is live proof.

The owner's order (2026-10-09), after Codex reviewed `6973f7aa` and passed the
9 runtime-path tests:
- keep those fixes;
- finish the attachment entry point: preserve the actual files through the
  durable request storage, clarification and queued jobs;
- when a post only says files were attached, keep that fact and ask for them
  through the model-written clarification;
- resolve the incomplete site-build gate without claiming it passed.

## 1. What an add-on does with attachments (read from the code)

- **The add-on step never reads attachment bytes, on any path.** It reads
  none on the synchronous route, on a job of its own, or as a request part
  (`site-add.mjs`: "handing an attached picture to this step is not shown";
  `jobBody` sends an add-on part `attached`, not files).
- **What `attached` does there**: a question the step asks is marked as about
  files, so the files can come back with the answer.
- **In a request, the files live with the request** (`storeRequestFiles`,
  `rec.files`). Questions on a request's part, answers that bring more files,
  and a later part that does read files (the logo layer gets them) all reach
  them, with no page open.
- **Before this round**, the page's add-on post sent `attached: true` and not
  the files. Round 7 therefore left such a post a job of its own, with no
  automatic recovery.

## 2. The change (`7b7b4641`)

- **The page sends the files.** `siteAddon` now posts the files themselves
  beside `attached`, capped at the page's own limit (`SITE_MAX_FILES`), as the
  routing call does.
- **`addonAsRequest` keeps them** exactly as the router's acceptance keeps a
  message's (`acceptRequest` → `storeRequestFiles`). One request is created,
  holding every file.
- **Never a request that lost files.** A post whose files would not all be
  kept stays a job of its own, as before. That means more than one request
  carries (`MAX_ATTACHMENTS`, 3), or a file that does not read as a data URL.
  `attachmentData` is the one reading, shared with `storeRequestFiles`.
- **A post that only says files came with it** (an older page) is taken on
  with that fact (`attached`, no files):
  - the part's job is told `filesMissing`, and the add-on picker gets one
    line: the files never reached the builder;
  - **the picker decides** whether the request depends on them. If it does,
    it asks through its own question field, so the question is model-written;
  - the question is the request part's. An answer that brings files joins the
    request's files through the existing answer path;
  - the part then resumes told nothing is missing.
- **The deliberately disabled flow stays distinct.** With `REQUEST_FLOW` off,
  a post with files is a job of its own, exactly as before.

## 3. Tests and results

- **New**: `test/addon-attachments.test.mjs`. The real Worker; the network
  blocked. Each case checks the files, page, statuses, provider calls,
  publication and accounting:
  - AT 1: a legacy add-on with two files. Both are kept, byte for byte. The
    page is closed and the cron alone drives it. The store fails, so the part
    is held with the files still kept. The delayed placement then fills the
    frame: the addition not redone, one purchase, two publishes, each job
    charged at most once.
  - AT 2: the same post again. The same request, the files written once, no
    second addition, no second purchase.
  - AT 3: a post that says files came and carries none. The fact is kept, the
    picker is told, and its question is put on the request's part, with no
    addition run before it. The answer brings the files, which join the
    request. The resumed part is told nothing is missing, and the delayed
    photograph is placed once.
  - AT 4: a file that does not read. The post stays a job; nothing is kept.
  - AT 5: the flow off. A job of its own, as before.
  - AT 6: the page's own post (`siteAddon`, cut from `chat.js`) carries the
    files.
  - A network check.
- **Updated**: RT 7 now covers more files than one request carries. The
  page-post harness reads `SITE_MAX_FILES` from `chat.js`.
- **Red check** on `6973f7aa`, the new test and fixture copied in: AT 1, 2, 3
  and 6 fail. AT 4, AT 5 and the network check pass there, because they
  describe behaviour that already held. **4 of 4 behaviour cases fail.**
- **Focused run**: the new file, `addon-runtime-paths`, both pending-photo
  files, `pending-frames`, the seven-task batch and Build progress, all with
  the network blocked: **`52 / 52 / 0 / 0`**.
- **Sweep**: 9 product mutants and a comment-only control:
  - the files not passed to the acceptance;
  - the attached fact lost;
  - an unreadable file accepted, and too many accepted;
  - the missing-files flag dropped, and set even with files held;
  - the picker not told, or its line dropped;
  - the page sending no files.
  **9 of 9 killed, the control survived.**
- **Full suite**: **`10265 / 10265 / 0 / 0`** on `8de702d9` (was 10258).
  The first run on `7b7b4641` was `10265 / 10264 / 1`: one wiring guard
  pinned the picker call's exact arguments. It was re-anchored in `8de702d9`
  to read the new `filesMissing` argument too; the guarded property is
  unchanged.
- **Required CI**:
  - unit tests on `8de702d9` (run 37901724877): green, `10265 / 10224 / 0 /
    41`, the same total as locally;
  - unit tests on `7b7b4641` (run 37901004969): red on the guard above;
  - **site build on `7b7b4641` (run 37901004808): green**, all four
    `site-build.mjs` shards and "all checks". `8de702d9` changed a test only.
- **Image** (predicted, not built): **`f17b91256b43680f`** (204 inputs; was
  `4f631d9c2e42064b` at round 7).

## 4. The site-build gate

- **Run 37894981062** (`f7992fae`), https://github.com/canias7/isibi-app/actions/runs/37894981062:
  - **shard 2 of 4** was cancelled at its 20-minute limit while its runner
    was still installing Playwright's system packages. `apt-get` hung on a
    package mirror before any test ran;
  - the other three shards and the published-site, theme and
    kit-and-generator checks passed;
  - the aggregate "all checks" failed only on that shard.
- **A re-run was tried once from this session**
  (`POST …/actions/runs/37894981062/rerun-failed-jobs`). It answered **403
  "Resource not accessible by integration"**: the session lacks
  `actions: write`. It was not retried.
- **The gate is not shown passing for `f7992fae`.** The owner's action is to
  open the link and press **"Re-run failed jobs"**. Alternatively, the gate
  runs again on this round's push, because it touches the gate's paths:
  **run 37901004808 on `7b7b4641` is green on every job.** That is the gate
  for the branch's current code; `f7992fae`'s own run stays cancelled.
- No product code was changed for the installation failure.

## 5. Mocked versus live

- **Mocked**: every model answer, the image service and its store failures,
  Supabase's RPCs, the queue, the cron and the container.
- **Not shown**: anything live. In particular, whether a real picker asks
  for missing files when the request depends on them is the model's
  judgment, shown only with a supplied answer.

## 6. Remaining acceptance blockers

1. **No live evidence**: no real model, image service, container door or
   timing.
2. **The `/frames` door needs the new image** (round 7).
3. **Not placed automatically, and told:**
   - the synchronous add-on;
   - a legacy job with the flow off;
   - a post whose files would not all be kept (more than 3, or unreadable);
   - a token inside a longer string;
   - a door that is down when the addition marks.
4. **The add-on step still reads no attachment bytes.** Files are kept and
   reach questions and later parts, but using a customer's own picture inside
   an addition is not a feature here and was not added.
5. **The image provider has no idempotency key or lookup.** The finite-clock
   wait still needs a live look.
6. **`f7992fae`'s site-build run** stays cancelled unless re-run; the gate is
   green for the current code (`7b7b4641`).
