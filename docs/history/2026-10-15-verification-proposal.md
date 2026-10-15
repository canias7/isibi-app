# 2026-10-15 — One verification proposal for the assistant and media work (branch `new`), revised

**Revised after Codex's review of `9a2ea70b`.** The checks are now prepared as a
script and a workflow, and nothing in this proposal has been run. Nothing is
merged, deployed or built. No storage was written, no model was called, and
nothing was bought to prepare it.

What changed from the first version:
- **Automated checks.** Every check a browser or API can do is now automated
  in one script, `scripts/media-verify.mjs`. It is pressed through a
  dispatch-only workflow, `.github/workflows/media-verify.yml`. No devtools
  steps or console snippets remain.
- **Photographs off.** `IMAGE_PURCHASES=false` must be verified on the live
  Worker before every model-backed send. Writing "no photographs" in the
  prompt does not count.
- **No assumed balance.** The 13-credit figure and the top-up remark are gone.
  The balance is read immediately before each send.
- **F7 is judged on where it ends**, not on one fixed pair of statuses.
- **The cut-history case is deterministic.**
- **A raw R2 probe** is explained as not supported by the existing tooling. It
  is proposed, not built.

## Where things stand

- **Code head: `cbd396d8`.**

  | Run | Result |
  |---|---|
  | unit, run 38670111433 | green, `10892 / 10845 / 0 / 47` |
  | site build, run 38670111439 | green |
  | local full suite | `10892 / 10890 / 0 / 2` |

- **`9a2ea70b`** (the first proposal, documents only): unit green, run
  38672810336.
- **This revision** adds the script, its test and the workflow. It changes no
  product file: nothing under `public/`, nor `worker.js`, `site-media.mjs` or
  the `Dockerfile`. Its CI and offline readings are in this round's
  owner-notes entry.
- **`main`:**
  - It is `8e24ca5b`. help-needed's earlier batch is merged and deployed
    there.
  - It holds none of `new`'s commits from `5f425ceb` onwards.
  - help-needed still has parallel-execution work pending.

## Deployment: shared is possible, not scheduled

Live verification needs this code on the production Worker. There is no
preview environment, and dispatching `deploy.yml` from `new` would deploy `new`
in place of `main`. That must never be done.

So the checks run only after `new` reaches `main` through a merge the owner
orders. That merge can happen in either of two ways:
- **Alone,** in its own deploy and image build.
- **Combined** with help-needed's next merge, sharing one deploy and one image
  build.

The combined route is **a possibility, not an established schedule**:
- help-needed's parallel-execution work is still pending;
- its timing and contents are not set here;
- nothing in this proposal waits on it or assumes it.

Either way, before the merge:
1. The candidate's image is predicted on its own tree. For `cbd396d8` alone it
   is `484f4945d711b3c8`, from 208 inputs; a combined tree differs.
2. Rollback is verified.
3. Required CI is green.

The earlier trial merge into `8e24ca5b`, done locally and discarded, still
stands: three mechanical conflicts, in `Dockerfile`, `public/chat.js` and
`owner-notes`. If help-needed's next merge comes first, it is redone on that
tree.

**The workflow becomes pressable only on `main`.** GitHub offers a
dispatch-only workflow from the default branch only. `media verify` therefore
appears in the Actions tab once the merge carrying it lands, and it cannot be
pressed before.

## How a press works: `scripts/media-verify.mjs`

**Signing in.** The script signs in as the building account through the same
handshake every canary uses (`scripts/owner-session.mjs`). No credential is
printed or kept.

**Its readings.** Each press writes `media-verify.json` (the run's artifact):
- every check, with its observed value;
- every spend, with the balance before and after;
- the deploy and the image id it ran against.

**Exit codes:**

| Code | Meaning |
|---|---|
| 0 | every check passed |
| 1 | a check failed |
| 2 | refused before doing anything |

**The workflow's boxes, by their descriptions:**

| Box description | What it takes |
|---|---|
| Mode | `rehearsal`, `storage`, `browser`, `converse` or `build` |
| Site slug to run against | the site |
| Write and delete test files on that site? | `yes` for storage or browser |
| Spend credits? | `yes` for converse or build |
| Harness ceiling for this press, in credits | the press's ceiling |
| Repetitions of each concurrency check | how many times each race repeats |
| Model for converse and build | the model |

| Mode | What it does | What it touches | Gate |
|---|---|---|---|
| `rehearsal` | Signs in and reads the runtime switches (deploy, `imagePurchases`), the image id, the balance and the site's library. Lists what each other mode would refuse on. | **Read-only** | a site |
| `storage` | S1–S7 below | **Storage-mutating** (R2 through the Worker). No model, no credits. | `mutate=yes` |
| `browser` | B1–B3 below | **Storage-mutating.** No model, no credits. | `mutate=yes` |
| `converse` | C1–C5 and C8 below | **Paid** | `spend=yes`, a ceiling, photographs verified off |
| `build` | P9 below | **Paid**, one new Build | the same |

**The guarded sites.** Every mode refuses to write to or spend on these:
`fold-lane-bakery`, `fretwork-1`, `lido-axes-b`, `copperleaf-tea-room` and
`saltmarsh-cheese-counter`. These are help-needed's fixtures and the sites its
pending batches name. A rehearsal may read them.

**What every gate shares.** It is decided before any write or send. A refusal
exits 2, with nothing changed.

**Clean-up.** The storage and browser modes delete everything they made in a
`finally`. Files are deleted with `force=1`, and open sessions are aborted.
The library is then read back and must equal what was found at the start.

## Which sites: an existing demo site, or a new Build

- **Reuse an existing demo site** for `rehearsal`, `storage`, `browser` and
  `converse`.
  - None of these needs a fresh site. Storage and browser put their own
    fixtures up and take them down again. The conversation cases ask about the
    stored pages and the attachment the request carries.
  - The owner names a non-guarded demo site the building account owns. From
    the live list, `markbook-1`, `shoeroom-1`, `repairbench-1`, `ashgrove-1`
    and `washhouse-1` are candidates.
  - A free `rehearsal` on it confirms first that it is owned and reachable,
    and shows its library. Its pages are never changed. C3 reads them, and
    its expected answer is judged against what they say.
- **Only P9 needs a new Build.**
  - What it verifies is a first build: drafts attached before any site
    exists, moved into the new site's library, and the page writer narrating
    them.
  - An existing site cannot show the move from drafts.
  - The slug is the owner's, typed in the site box, and must be new.
  - The site stays afterwards.

## Part 1 — free, no model call

**R0. Rehearsal (read-only).** Run on the chosen demo site.
- It confirms the deploy is the merged sha, records the image id, and reads
  `imagePurchases`.
- It reads the balance and lists the library.
- It names any mode that would refuse, and why.

**S1–S7. Storage mode**, on the demo site, with `mutate=yes`, repeat 3:

- **S1 — every fixture up, listed, and served on both origins.** This covers
  all nine fixtures, on `gofarther.dev/u/` and `<slug>.gofarther.app/u/`. Each
  upload must read back as:
  - GET 200, the exact content type, `accept-ranges: bytes`, `max-age=300`, and
    the exact length;
  - HEAD with no body and the right length;
  - a byte range answering 206 with the exact bytes, a range past the end 416,
    and its ETag 304.
- **S2 — refusals.**
  - An MP3 named `.mp4`: `415 format_mismatch`, read from the bytes.
  - A PDF named `.mp3`: `415 bad_type`.
  - A video over the limit: `413 too_big` at the start, before any byte is
    sent.
- **S3 — replace.** The address is kept, the new bytes are served with a new
  ETag, and a replacement in another format is refused.
- **S4 — three parts, with lost answers.** The script makes a three-part WAV
  (8 MiB parts) in memory.
  - One part's answer is "lost" and the part is sent again.
  - Status names the parts the server holds.
  - The finish is completed from the server's own part record.
  - A lost finish is answered again, the same.
  - An abort after the finish keeps the file.
  - The end of the joined file equals the end of the file sent.
- **S5 — abort, then finish.** After an abort, a finish and a part find
  nothing, and nothing is stored.
- **S6 — races,** each repeated:
  - **S6a, competing replacements:** exactly one is admitted and the other
    gets `409 replacing`.
  - **S6b, delete against a replacement's close** (below).
  - **S6c, draft admission:** eight starts at once against the draft room.
    - Never more than the room is admitted.
    - A `503 busy` start is sent again, one at a time, until exactly the room
      is admitted and no more.
    - All are then given up, and the room is free again.
- **S7 — delete.** The file is gone, its address 404s, and the library count
  drops. A file a page plays is held as `409 in_use` until confirmed.

**S6b is judged on where it ends** (`judgeDeleteVsClose`, corrected after
Codex's review). The close and the delete are sent together. A valid outcome is
any order that ends with the file deleted, its receipts agreeing, and no room
held:

| Close | Delete | Then |
|---|---|---|
| 200 | 409 `replacing` | the delete sent again: 200 |
| 200 | 200 | the close landed first, then the delete removed it |
| 410 `removed` | 200 | the delete first |
| (any) | 503 `unconfirmed` | sent again until 200; valid only while the old upload could still land |

After each run, all of these must hold:
- the address answers 404;
- the original's receipt says `removed`;
- the replacement's receipt says `removed` or given up, never `done`;
- the reservation is free.

Invalid in every case:
- a delete that answered 200 while the file is still served;
- a close that answered 200 over a file the record had already deleted;
- room still held.

The record's generation is internal and not visible over the API. The offline
tests judge it (`test/media-mutation.test.mjs`); live, the order, the final
object, the receipts and the reservation are judged.

**B1–B3. Browser mode**, on the demo site, with `mutate=yes`. Browsers are
installed on the runner by Playwright: Chromium, Firefox and WebKit. Google
Chrome is GitHub's own preinstalled one.
- **B1 — play and seek every fixture** from its `/u/` address in each engine.
  The media element must load, report its duration, and play past a seek near
  the end.

  | Engine | Must pass | Recorded only (Linux codec builds vary) |
  |---|---|---|
  | Chromium | WebM, MP3, WAV, Ogg, FLAC | MP4, MOV, M4A, AAC |
  | Chrome | WebM, MP4, MP3, M4A, AAC, WAV, Ogg, FLAC | MOV |
  | Firefox | WebM, MP3, WAV, Ogg, FLAC | MP4, MOV, M4A, AAC |
  | WebKit (Linux) | none | all nine |

  An engine the runner installs but that fails to launch is a failed check,
  not a skip, so a silent Firefox cannot read as a passing one.
- **B2 — the composer, in Chromium, on the real app,** signed in by a planted
  session, as the UI canary does.
  - **The session.** It comes from the same handshake. `owner-session.mjs` now
    also hands back that session's refresh token and expiry; the change is
    additive, and they are never printed. The session is planted for the app's
    origin only.
  - **Writes are confined.** Every write the page makes, other than this site's
    own media and uploads, is aborted and recorded, and that list must be
    empty. No message is ever sent.
  - **The steps:**
    1. Attach `clip.webm`: it goes up, the chip ends ready, and exactly one new
       file is in the library.
    2. Reload, then attach the same file: it is reused, with no part sent and
       no new file.
    3. Delete it from the page, then attach it again: it is sent again as a
       new file.
  - **Clean-up.** Every file made is deleted, and the library must end as
    found.
- **B3 — the Files panel** lists the file as media with a player.

**Genuinely unavailable, so manual or unverified:**
- Safari on macOS;
- Safari on iOS;
- Chrome on Android;
- Microsoft Edge.

No GitHub Ubuntu runner has these. They are reported as **unverified**, never
as passed. WebKit on Linux is not Safari, and its results are recorded as
WebKit's. If the owner wants Safari or a phone covered, those are manual
checks on the owner's own devices. The script cannot reach them.

**Not covered by the existing tooling: R2's own abort and finish answers.**
- **What is missing.** R2's own answers for an aborted or unknown multipart
  upload are not seen live: `NoSuchUpload` / 10024, and R2 refusing to close
  an aborted upload.
- **Why it can't be built from what exists.** The existing tooling reaches R2
  only through the Worker's bucket binding. The media routes never ask R2 to
  close or abort an upload whose session is gone, so no existing route can
  produce those answers.
- **Two ways to build one, neither built.** Either is storage-mutating, and
  either would be its own change with its own approval:
  - **A Worker probe route.**
    - It is gated to the owner and confined to a `probe/` prefix.
    - It starts a multipart upload of one small part, aborts it, then asks R2
      to complete it and to upload a part, and records R2's error codes.
    - It deletes anything it made.
    - This is a product change, and it needs a deploy.
  - **An S3-API client** with R2 access keys.
    - It needs a new secret, and a SigV4 signer this repository does not have.
- **Until one is approved,** this stays shown offline only, against the double
  that follows R2's documented behaviour.

## Part 2 — paid (each press needs the owner's approval)

**Photographs off is a verified prerequisite, not a hope.**
- Before every model-backed send, the script reads `/api/site/runtime` for the
  site and requires `imagePurchases === false`. It reads this at the start, and
  again immediately before each message and before the build.
- If it is not false, nothing is sent (exit 2).
- Turning `IMAGE_PURCHASES` off on the live Worker is the owner's setting.
- The P9 brief no longer says "no photographs", so passing does not depend on
  the wording.
- Any image spend is a failure. P9 also checks the build's answer for
  photographs made.

**The balance is read, never assumed.**
- Immediately before each send, the balance is read from the ledger
  (`/api/credits`).
- Immediately after each send, it is read again. The charge must equal the
  cost the reply reports.
- No earlier figure in any record is used.

**Estimates against the one enforced limit:**

| | What it is |
|---|---|
| A conversational message | **estimate** 2–6 credits: routing (measured 1–2) plus the reply's own call on grok-4.6 (about 2 typical, 5 at the full window and the 2,400-token ceiling), under one charge |
| P9 | **estimate** 13–47 credits: a first build (measured 11–45) plus its routing; no photograph can be bought |
| The ceiling box | **the harness's limit, set by the owner per press.** The next send is refused when what this press has spent plus that send's upper estimate would pass it. The press stops if a send overshoots it. |
| The platform | **caps nothing**; the balance is the only bound it knows |

**The conversation cases**, on the demo site, run in one `converse` press. All
six are fixed messages:

| Case | Message | Expected |
|---|---|---|
| C1 | "hi" | a short greeting and an invitation; no work |
| C2 | a comparison of a booking page and an enquiry form | a structured comparison; no work |
| C3 | "What does my home page say? Summarise it in two sentences." | an answer from the stored page words; never a claim of visiting the live site |
| C4 | "What time do we open on Sundays?" | says what it wasn't shown and how to add it; no invented time |
| C5 | "ok, use the third version", on a fixed cut thread | asks for the third version again; `resolved` absent; no work |
| C8 | "What could I use this clip for on my site?", with `clip.webm` attached | stays conversation; the file named as unseen |

**C5 is deterministic.**
- **The earlier history is fixed** (`cutThread()`): a long earlier reply whose
  "Version three" lies past the page's 4,000-character cut. No model writes
  it.
- **The cut is the page's own.** The history is built by the page's own
  `ChatTalk.historyWire`, so it is cut exactly as the page cuts it.
- **The cut is proven before anything is sent.** The assistant turn carries
  `full`, longer than its text, and its text holds Version two but not Version
  three. If that proof fails, the case refuses without calling.
- **So it costs one message**, and it cannot come back "not exercised".

**P9. A new Build with two drafts.** It runs in one `build` press, on a new slug
the owner types.
- **The brief:**

  > A small bakery in Leeds called Harbour Loaf. Put the attached video on the
  > home page and the jingle on an About page.
- **The drafts:** `clip.webm` and `tone.mp3`, uploaded as drafts first.
- **The early-accepted build is followed.** Its `202` is followed through its
  poll until the build answers.
- **It is judged on:**
  - both drafts placed and none missing;
  - no fixed narration of the move;
  - a non-empty, model-written `notes`, recorded for reading;
  - no photograph made;
  - each file served from the new site;
  - the drafts gone from the drafts list;
  - each draft's receipt saying `removed`.

**Optional, only on the owner's word** (not in the script):
- P7, discussion becoming action (routing plus an add-on, measured 2–13).
- P10, an edit adding the jingle as a player (routing plus the page step,
  measured 6–22).

**Totals, estimates only:**

| Set | Credits |
|---|---|
| The six conversation cases | about 12–36 |
| P9 | about 13–47 |
| Both | about 25–83 |

The owner sets the ceiling box per press, and the balance read before each send
decides whether the press can proceed at all.

## Offline proof of the harness (`test/media-verify.test.mjs`)

- **The judge.** It accepts every valid order, including close 200 then delete
  200. It refuses a delete that answered 200 with the file still served, wrong
  receipts, and held room.
- **The cut case** is proven cut through the real `historyWire`.
- **The generated three-part WAV** is a WAV the server takes from its bytes.
- **Labels.** Estimates are labelled estimates, the unavailable browsers are
  named, and every required format is a fixture.
- **The gates refuse before any write or send:**
  - a guarded site;
  - a mutating mode without `mutate=yes`;
  - a paid mode with photographs on.
- **Rehearsal** makes no write.
- **Storage mode end to end** runs against the real Worker in-process, over the
  R2 double with lag. Every check passes, every race ends consistent, and the
  library ends as found.
- **Converse mode:**
  - the ceiling stops it before sending;
  - with room, a case is sent once, with images verified off;
  - its charge is read from the ledger.
- **Build mode** follows a 202 poll and judges the answer.
- **Browser mode** runs in real Chromium against a local server bridged to the
  Worker. B2 and B3 run on the repository's own `public/` app, with media
  answered by the real Worker, and all of their checks must be present and
  passing.
- **The composer page's write rule** allows only this site's media and
  uploads. Routing, builds, edits and other sites are refused.
- **Two harness mutants were each killed:** skipping the composer checks, and
  allowing every write from the page.
- **The workflow** is dispatch only. Its mode options equal the script's modes,
  and it passes every variable the command line reads. Three mutants of the
  workflow were each killed.

## Order, when the owner approves

1. The owner orders the merge, alone or combined. Before it, the candidate's
   image is predicted, rollback is verified, and CI is green.
2. Deploy, then confirm the runtime with the free canary (sha and image).
3. Owner presses:
   1. `rehearsal` on the chosen demo site (free, read-only).
   2. `storage` with `mutate=yes` (free, storage-mutating).
   3. `browser` with `mutate=yes` (free, storage-mutating).
4. The owner sets `IMAGE_PURCHASES` off. A `rehearsal` shows it as off.
5. Approved, paid: `converse` with `spend=yes` and a ceiling, then `build` on a
   new slug with `spend=yes` and a ceiling. The balance is read by the script
   before every send.
6. P7 and P10 only on the owner's word.

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
