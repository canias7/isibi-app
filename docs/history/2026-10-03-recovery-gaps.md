# The combined request flow: two recovery gaps closed (2026-10-03)

On the owner's order after reviewing the fixes, for review on
`claude/help-needed-ehlwlj`. **Unmerged, undeployed, and off by default**
(`REQUEST_FLOW`). No container was built, no model was called, nothing was
spent, and no migration was applied: none is needed. First Build is
unchanged.

- Code: `567409ce`.
- How it works now: `docs/request-flow.md` (§ *The checkpoints*).
- The rounds before: `docs/history/2026-10-03-combined-requests.md`, then
  `docs/history/2026-10-03-request-review-fixes.md`.

## 1. The order

> The main review fixes are substantially addressed. Finish these two
> recovery gaps without expanding scope. First, acceptRequest assumes a
> thrown createRequestRecord means nothing was saved and deletes
> draft.files. I independently executed that function with a storage write
> that persisted the record and then threw: it returned failed:true and
> deleted the attachment referenced by the saved request. Treat a lost write
> response as an uncertain outcome; preserve files while acceptance or
> another concurrent acceptance may reference them, recover using the same
> request key, and clean up only when non-use is established. Test a
> committed write with a lost response, concurrent duplicate acceptance, and
> recovery with the browser closed, verifying the actual attachment bytes
> reach the intended step. Second, persist rewrite approval and the
> information required to finish filing its job before depending on
> subsequent calls. N5(a) currently recovers by pressing approve again after
> the build row lands but its stored job does not; that does not satisfy
> durable approval and browser-independent continuation. Make the server
> recover that boundary automatically through the existing machinery, with
> one rewrite and one charge, and test it without another approval, resend
> or browser GET. Preserve cancellation and duplicate-approval behavior. Keep
> these changes focused, update the tests and handoff, and push for review.
> No merge, deployment, paid calls, live migration or container rebuild.

## 2. The acceptance: a lost write is an outcome not known

**What it was**: the files, the marker and the record were written in one
`try`. Any throw deleted the files and answered `failed: true` — including
a record write that had landed and lost its answer, which left a saved
request naming a file that was gone. Reproduced first: J10–J12 fail on the
old code with *"the file the saved request names was deleted"*.

**What it is now** (`acceptRequest`):
- **Each acceptance has its own id** (`attemptId`: when it began, in base
  36, and a random tail), stored on its record (`attempt`), and its copies
  live under it: `requests/<slug>/<key>/files/<attempt>/<sha>.<ext>`
  (`fileKey`). Two acceptances of one message never share a copy, so what
  one wrote can be let go without touching the other's.
- The marker first (create-only, as before), then the files, then the
  record.
- **Files that fail to store part-way** are let go at once: no record was
  written, and none can name them.
- **A record write that throws deletes nothing.** The record under the key
  is read back:
  - this acceptance's own (its `attempt`): it landed; the acceptance goes
    on;
  - another acceptance's: that one is the answer (`duplicate`), nothing runs
    twice, and this acceptance's own copies are let go;
  - none: written again under the same key, up to three rounds;
  - cannot tell (the read fails too): `failed: true` with everything kept.
    A record that landed has its marker, so the two-minute sweep finishes
    it with no resend and no page open.
- **The sweep lets copies go only once no record can name them**: with an
  orphan marker (no record after 15 minutes), only the copies older than
  that window — an acceptance of the same message still writing keeps its
  own — and a record that lands as the marker goes gets the marker back; a
  day after a request ended, every copy under it.
- An answer's own files are stored under an id of their own
  (`resumeRequestPart`).

**Tests** (each reads the bytes the logo step's job was given:
`logoGotTheFile`):
- **J10**: the record write lands and its answer is lost: accepted, the
  file kept, the logo step gets its bytes, one routing charge, the copy
  gone after the request ends.
- **J11**: two acceptances of one message at once, the first's record write
  losing its answer: one request, its copy kept, the other's own copy let
  go, the bytes delivered, one charge.
- **J12**: the record write lands, its answer is lost, and reading it back
  fails: `failed: true`, the record and the file kept, nothing filed; **the
  browser closed, no resend**: the sweep finishes it with the file's bytes.
- **J13**: the record write fails outright: written again under the same
  key, not a duplicate, done.
- **J14**: four failed record writes: `failed: true`, the copy kept inside
  the window, cleared with the marker after it; a resend under the same key
  is taken on with its own copy; a stray copy goes a day after the request
  ended, not before.
- **J15**: while the sweep clears an orphan marker, a copy newer than the
  window is kept, and a record that lands just as the marker is deleted
  gets the marker back and runs.
- **J16**: copies whose store failed part-way are let go at once, and the
  message is held; sent again, it runs.
- D1's key assertion now reads the acceptance's id in the path.

## 3. The go-ahead: written before anything depends on it

**What it was**: the press filed the build's row, then stored its job (the
session), then sent its message, then recorded the go-ahead. A press that
died after the row and before the stored job left a row the next step would
not count as given (N5(a)): the customer had to press again.

**What it is now**:
- **The press** (`approveRequestPart`):
  1. stores the build's job (`rewriteJob`: the revise the page posts, with
     the part's words, the request's files, the picked model and the
     pressing session) under the derived id. A store that fails gives
     nothing: 503, the part still waits;
  2. writes the go-ahead on the part, on the record's etag, as a job not yet
     filed (`approvePart` now pushes `id: null`). A write whose answer is
     lost is read back: a go-ahead found there is written, whoever wrote it;
  3. moves the request on (`advanceRequest`).
- **The row and the message are the request's next step**, as every part's
  job is: `nextStep`'s pending job, filed by `fileRequestRewrite` from
  `fileRequestJob` — under the derived id, which is also the idempotency
  key. Whoever takes the step files it: the press, the two-minute sweep, or
  the build's own end. The RPC cannot say a row was already there (the id
  asked for is the row's own), so a row already claimed or ended is
  recorded and read at once, and a row still queued is sent its message —
  again, if a step died after sending it. A second delivery finds the job
  taken or its claim refused, and a request's rewrite never runs without its
  row's lease.
- **The probe is gone**: no row can exist for a go-ahead that is not
  written.
- **A press that wrote no go-ahead gave none.** Its stored job is kept while
  another press of the same go-ahead might still write it, and is let go
  when the request ends (`settleRequestMarker`, which also lets go of a
  second press's late copy). A press refused because the request was
  stopped, ended or lapsed first takes its job back at once.

**Cancellation and duplicate approval, kept**:
- a stop cancels a written rewrite through its row, by the id it is filed
  under — also when the step that filed it died before recording it;
- the build's own read of its request (`requestRewriteStopped`) now ends it
  when the request is stopped, or when its part does not name it, so a stop
  whose cancel never reached the row still ends it before it designs;
- every press of one go-ahead, from any device, at once or later, is
  answered with the one go-ahead and files one row.

**Tests** (each runs the existing queued build: its row, consumer, design
call, page writer, compile, publish and charging):
- **N5**, five ways the press is cut off after the go-ahead is written:
  before the row; after the row (`edit_create` lands, the press never
  hears); the queue refusing the message (the press answers 200); after the
  message (`hangSend`: it lands, the press never hears); and after the
  message with the build ending before any sweep. **From there no second
  press, no resend and no page `GET`**: the sweep and the queue, or the
  build's own end, finish it, and `oneRewrite` checks one build row under
  the go-ahead's id, one design, every build ledger row under that id
  adding up to the build's own cost, and one rewrite job on the part
  settled at that cost; the site published, the part that needed it done,
  the stored job gone.
- **N8**: a press cut off after storing its job and before the go-ahead's
  write gave nothing (the sweep does not count it given), and a Stop lets
  its job go; a write that fails and cannot be read back answers 503, keeps
  the job, and the go-ahead's lapse lets it go; a write that lands with its
  answer lost and a failed read-back answers 503, the sweep runs it as one
  rewrite, and a press after is answered with it.
- **N9**: a Stop after the go-ahead, with both its cancels refused, ends the
  rewrite through the build's own read of the request (the row's cancel
  never set); the Stop reaches a row whose filing step died before recording
  it, by its id, when its own step cannot file it again; a build no
  go-ahead recorded runs nothing.
- **N4(c)**: a press that read the request before a Stop is refused (409)
  and takes its stored job back; nothing is filed or charged.
- **N2**: two devices pressing at once are both answered with the one
  go-ahead, one rewrite, run once; a late copy of the job is let go when the
  request is next read.
- **N3**: a press whose job cannot be stored answers 503 and the part still
  waits; pressed again, it runs.

**The test platform** (`test/fixtures/request-flow.mjs`) gained what these
cases cut with: `losePut` (a write lands and its answer is lost),
`failGet`, `beforePut` and `beforeDelete` (another call lands between a
caller's read and its write or delete), `failRpc` (a call refused before
it lands) and `hangSend` (a send lands and its sender never hears).

## 4. Verification

- **Red check** (this round's tests and test platform over `caeb4414`'s
  code, in a worktree): exactly the fourteen changed or new cases fail —
  D1, N2, N3, N4, N5, N8, N9, J10–J16 — and the other 53 of 67 pass. The
  messages are the defects: *"a row was filed before the press died"*
  (N5), *"a go-ahead never written was counted given"* (N8), *"a stopped
  request's rewrite designed"* (N9), *"the file the saved request names was
  deleted"* (J12), *"a copy was let go while a record might still have named
  it"* (J14).
- **Sweep**: 27 mutants over `worker.js` and `builder/request.mjs`, with
  three comment-only controls: **27 of 27 killed, 3 of 3 controls
  survived, every file restored by hash.** Among them: the owner's finding
  put back (a lost write deletes the files), the read-back taking our own
  record for another's, a loser keeping its copy, an unknown outcome
  deleting, no second write, a part-way store left, the orphan clear taking
  a fresh copy, no re-marker, no day-after drop, `attemptAt` and `attemptId`
  misread, the record without its `attempt`; the go-ahead recorded as filed,
  written without its job, a refused press leaving its job, a written
  go-ahead not recognised, a failed press answering 200, the rewrite filed
  as an edit, a row already ended sent again, a refused message recorded as
  sent, the Stop missing an unrecorded row, the build not reading a Stop or
  a part that does not name it, neither kind of stored job let go at the
  end, and the stop check and lease rule removed.
- **Full suite**: `9237 / 9237 / 0 / 0` locally (from `9228`: J10–J16, N8
  and N9 new; N5 rewritten in place; N2, N3 and N4 changed in place).

## 5. Remaining limits

The list is `docs/request-flow.md` § *Limits, as built*. New this round:
- a press answered 503 may still have given the go-ahead, when its write
  landed, its answer was lost and reading it back failed: the server runs
  it, and the page — which says it could not confirm the go-ahead, and to
  press again only if the button is still there — shows it given on its
  next look;
- a second press racing the build can leave a copy of the job, with its
  session, until the request ends;
- a message sent again to a queued row the site is busy for is deferred
  twice, so that row's busy deferrals run out sooner.

Gone from the list: the press that died between the row and its stored job
(N5(a) as reviewed) — no row is filed before the go-ahead and its job are
written.

**Found and kept separate** (`docs/backlog.md`): the test platform's `hang`
on `edit_create` marks the job being filed as dead, though the filer died;
no case's verdict rests on it.

## 6. Not done

No merge, no deploy, no paid call or model call, no live migration, no
container build. The image moves with the code, predicted over both ends
(`containerInputs` and `imageId`) and not built: `main` (`b8d12ff9`)
`8bfc67dc695e65cc` (191 inputs) → `567409ce` `882477e1bbbe8cbe` (194
inputs); the branch before this round, `caeb4414`, was
`ca9a89c7bed78b38`.
