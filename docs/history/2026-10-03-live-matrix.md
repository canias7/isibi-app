# Deploy 2180 and the consolidated live-test matrix (2026-10-03)

> **Prepared, not pressed.** Nothing in this file was spent: no model was
> called, no site was changed and no paid press was made. Deploy 2180 is
> deployed and checked against its own log and the served files, and it is
> **not yet runtime-confirmed**: that needs the owner's free press (§1.3).
> The matrix below waits for the owner's approval of its spending cap.
>
> The owner's order (2026-10-03): *"Merge and deploy the reviewed branch
> once, carrying the approved router batches and clarification fixes
> together. Verify required checks, the deployed commit, the actual
> container image, and rollout readiness; run the free runtime checks before
> any model calls. Then prepare one consolidated live-test matrix for edit
> and add-on covering clear requests, ambiguous routing, questions inside
> downstream steps, mixed requests, retained answers, refresh/resume,
> cancellation, repeated questions, and no repeated completed changes or
> charges. Reuse demo sites and avoid separate deployments or unnecessary
> data restoration. … Keep paid tests pending for the next check, and
> distinguish code-tested behavior from behavior verified with real
> models."*

## 1. Deploy 2180

### 1.1 What it carried

`main` moved `f9979497` → **`b8d12ff9`**, a fast-forward of 32 commits:

- the whole-router audit;
- router batch 1 (W1–W4) and its review fixes;
- router batch 2 (W5, W7, W8, W15, W24) and its review fixes;
- questions back on a site that exists (W27), with the owner's four reviews
  of it: continuity, the question limits, and the answer history;
- their records.

`public/chat.js` and `public/edit-poll.js` moved, and the container image was
rebuilt. The full paragraph, in the usual shape, is in
`docs/deploy-record.md` (*Deploy 2180*).

### 1.2 What was verified, and from what

| Check | Reading |
|---|---|
| Required CI on the code | unit tests run 37090241036 on `5cbd5239`: `8972 / 8968 / 0 / 4`. Site build run 37090241073 on `5cbd5239`: all 8 jobs green, 404 checks in 27 sections across 4 shards. Unit tests ran green on both records commits on top: 37090418289 on `94e79672` and 37090691422 on `b8d12ff9`. |
| Nothing in flight | no Actions run in progress or queued; no edit job open. |
| Rollback | reverting `f9979497..b8d12ff9` in a throwaway worktree gives main's own tree, `36200b65…`. |
| The deploy run | 2180 (37091465975, `push` on `b8d12ff9`), `completed` / `success`, 02:55:30–02:58:13 UTC. |
| The deployed commit | Wrangler's `DEPLOY_ID` is `b8d12ff9fe92a79a8ba6050428d9477b31677943` (masked in the log). |
| The container image | `built isibi-app-sitebuildcontainer:8bfc67dc695e65cc` from 191 inputs, as predicted on both ends before the push. Wrangler's container step went `- …:a4409e55d3f3eb09` / `+ …:8bfc67dc695e65cc`, then `SUCCESS Modified application` at 02:58:09Z. |
| The served files | `chat.js` 829,182 bytes (`d90a0553…`) and `edit-poll.js` 42,187 bytes (`638f832e…`), byte-identical to the merged files. Read at 02:59 UTC; the before reading at 02:55 UTC was the old main's. |
| Rollout readiness | the image rolled at 02:58:09Z, so container work waits until about 03:14 UTC (15–20 minutes). |
| Money before the push | balance 137, the ledger's last row 355, no job open. |

### 1.3 The free runtime check

**Not yet confirmed.** Only an authenticated read can show which commit the
Worker runs and which image a cold container starts with. That read comes
from the edit canary's free press. A session cannot press it: its dispatch
answers 403. The session tried once, after the rollout wait, and did not
retry (§1.4).

**The owner's press, with spend `no`** (the edit canary's form):
- "Use workflow from": `main`.
- "Run the ONE paid edit as well (yes/no)":
  ```text
  no
  ```
- "Refuse to spend unless the Worker reports this deploy sha (prefix, >=7 chars). Blank = read and print only.":
  ```text
  b8d12ff9
  ```
- "Refuse to spend unless a cold container reports this image id (exact). Blank = read and print only.":
  ```text
  8bfc67dc695e65cc
  ```
- Every other box left as it is (blank, or its default).

It passes when the log shows:
- `build-health 200 deploy=b8d12ff9fe92 image=8bfc67dc695e65cc`;
- `runtime 200 deploy=b8d12ff9fe92` with the queue and the runner on;
- both the expected-build and expected-image checks `ok`;
- nothing charged.

### 1.4 The dispatch attempt

- **At 03:14:13 UTC**, 16 minutes after the roll, the session made one
  dispatch of `edit-canary.yml` on `main` (spend `no`, `expect_deploy`
  `b8d12ff9`, `expect_image` `8bfc67dc695e65cc`). It answered `403 Resource
  not accessible by integration`, the known refusal. It was not retried.
- **At 03:14:23 UTC**, the unauthenticated gates answered as documented:
  `/api/site/build-health` 401, `/api/site/runtime` 401,
  `/api/site/job-probe` 401 and `/api/nope-not-a-route` 404. That shows the
  Worker is up. It is not a version reading.
- **Status: deployed, not runtime-confirmed.** It waits on §1.3's free press.

## 2. How each row is run

| Instrument | What it does | What it can show | What it costs |
|---|---|---|---|
| **The free press** (spend `no`) | reads both readers and a cold container | the deployed commit and image | 0 |
| **A routing-only press** (`route_probes`, one committed list per press, at most 20 messages) | routes each message once with the real router; nothing is edited, added, built or published | the router's own answer for each message: work, a question back, or a part put off | about 1–1.5 a message (runs 90 and 91) |
| **A one-message paid press** (spend `yes`, the message, the site, `expect_route`, `expect_deploy`, `expect_image`) | one message through the real router and the real steps; a different route stops it after routing | what the message did to the site: the stored pages, the publish, the job, the ledger and the trace | routing plus the step that ran |
| **The owner's own chat in the app** | several messages in one tab: a question, its answer, a reload, Cancel | the question card, the answer, the reload, the cancel, and what each turn changed | the model calls the turns make |

**The gap for the question rows (Q1–Q7).** The canary's browser mode
(`ui_scenario`) sends fixed messages in one tab, without a reload. It cannot
answer a question card, reload the page mid-request or press Cancel.

So the Q rows have two possible instruments, and choosing between them is
the owner's decision (§7):
- **the owner's own chat**: I verify every turn afterwards, free;
- **an extension of the browser mode**: free to build, scripts only, no
  deploy. It is a new harness, so it is not built without the owner's word.

## 3. The matrix

Every row's starting condition is read free just before its press. The rows
are judged on what the operations did (the stored pages, the publish, the
ledger, the job and the trace), not on the wording of the reply.

### 3.0 Step 0: the free runtime check

| Row | What | Pass | Estimate |
|---|---|---|---|
| R0 | §1.3's free press | both readers on `b8d12ff9`, a cold container on `8bfc67dc695e65cc`, nothing charged | 0 |

### 3.1 Group R: routing only (two presses)

**R1, `whole-router-1`**: the audit's 20 messages (§5.2 of
`docs/investigations/whole-router-audit.md`), on seven sites. They cover
clear requests, removals, mixed requests, page scope, follow-ups,
attachments, unsupported asks and conflicting instructions. About 22–32
credits.

Batches 1 and 2 are now deployed. That changes the "Current implementation"
column for RM1, RM2 and MX3, as §5.2 records. The router's instructions now
include the live question rule (W27), which `whole-router-1` predates. So
any probe there that answers `clarify` is recorded as a finding to read
against that rule, not as a failure of the press.

**R2, `clarify-live-1`** (new, committed in `scripts/router-probes/`;
sha256 `e0b8beb0167c83c7…`, which the press prints): 9 messages on five
sites. Starting conditions were read from the served pages at 03:00 UTC
today. About 10–14 credits; the press refuses under 27 (3 a message).

| ID | Site | Message | Intended | Covers |
|---|---|---|---|---|
| AMB1 | hartleys-barbers | Can you do something about the prices? | `clarify` | ambiguous routing: what should happen is unsaid |
| AMB2 | oak-and-ash | The workshop page needs sorting out. | `clarify` | ambiguous routing |
| AMB3 | hearth-paper | The bulk pricing bit, can you deal with it? | `clarify` | ambiguous routing: change or remove |
| AMB4 | fretwork-1 | Do the Spanish thing we talked about. | `clarify` | a reference to a conversation the router is not shown |
| STEP1 | oak-and-ash | Show more of the top of the photo on the Work page. | `edit` `look` or `edit` `picture` | a detail inside a page is the step's: the router must not ask which photo |
| STEP2 | fretwork-1 | Take the QR code off the home page. | `edit` `look` | the same, for one of two codes |
| STEP3 | repairbench-1 | Change the heading 'What a pound is worth' to something friendlier. | `edit` `text` | never ask for a choice the work can make |
| ADD1 | hartleys-barbers | Add a link to our Instagram in the footer. | `addon` | the missing address is the add-on step's to ask for |
| ADD2 | hartleys-barbers | Add a link to instagram.com/hartleysbarbers in the footer. | `addon` | the clear control for ADD1 |

**A side effect, stated in each probe's note.** When the router answers
`clarify`, the route keeps one pending question on that site, because the
probe posts as the site's owner. The page and the data are not touched. The
next message to that site replaces the question, and otherwise it expires
after a day:
- AMB1's question is replaced by ADD1 in the same press;
- AMB2's question is replaced by STEP1's message;
- AMB4's question is replaced by STEP2's message;
- AMB3's question stays until its day ends, or until Q4 starts on that site.

### 3.2 Group D: clear and mixed requests, one message each (one-message paid presses)

These come from the audit's §5.3 and §5.4. They are the delivered checks of
batches 1 and 2, now deployed. Each starting condition was re-read today, at
03:00 UTC:
- `fretwork-1` serves its two QR codes and its French and Spanish versions;
- `repairbench-1`'s five pages carry menus of 4, 2, 2, 3 and 4 items;
- `oak-and-ash` serves `/`, `/make`, `/work` and `/workshop`, with no QR
  code and no `/commissions`;
- `hartleys-barbers` has no QR code.

| Row | Site | Message | Expected route | Pass | Estimate | Recovery |
|---|---|---|---|---|---|---|
| D1 | fretwork-1 | We've stopped teaching in Spanish, so take the Spanish version of the site down. (RM1) | `edit` `look` | only the Spanish version goes; French and both QR codes stay; every other page byte for byte | 2–4 | none needed (§4) |
| D2 | fretwork-1 | Take the Scan for prices QR code off the home page but keep the one for ringing us. (RM2) | `edit` `look` | only the prices code and its caption go; the ringing code stays | 2–4 | none needed |
| D3 | repairbench-1 | Rename Booking Check to Check a booking in the menu. | `edit` `nav` | the label changes on every menu that has it; each page keeps its own menu, with no menu flattened | 3–5 | none needed |
| H1 | oak-and-ash | Take the old Commissions page down and add a page for our spoon-carving classes. (MX3) | `edit` `page` `/commissions` `remove` | refused at no cost for the edit; the real pages named; the addition named as left for later; nothing stored or published | 1–2 | none |
| H2 | hartleys-barbers | Make the headings dark green and add a QR code that opens our booking page. | `edit` `look` | the headings change; no code is made; the QR words are named as left for later | 2–5 | none needed |
| H3 | hartleys-barbers | Put a QR code on the home page that opens our booking page. | `edit` `look` | the look step hands the code to the add-on step with its reason, part and page (cost 0); the press stops at the hand-over | 1–2 | none |
| H4 | oak-and-ash | Make the headings dark green, put a QR code on the home page that opens our workshop page, and put another one on the Make page that opens our work page. | `edit` `look` | the headings change; no code is made; both codes are named as left for later, in order | 2–5 | none needed |

### 3.3 Group Q: questions back, in several turns (the owner's chat, or the extended browser mode)

No question back has run with a real model yet. Every behaviour in this
group is shown only with supplied model answers (§6).

| Row | Site | Turns | Covers | Pass | Estimate |
|---|---|---|---|---|---|
| Q1 | oak-and-ash | 1. "The workshop page needs sorting out." → the router asks. 2. Answer: "Put the How the workshop works section first." | ambiguous routing; an answer resuming the waiting request | one question; after the answer, exactly that section moves on `/workshop`, nothing else changes, one publish; the routing calls charged twice, the edit once | 4–8 |
| Q2 | oak-and-ash | 1. "Make the heading on the Work page bigger and show more of the top of the photo." → the heading runs and the photo step asks which photo. 2. Reload the page; the card must come back. 3. Answer: "The staircase." | a question inside a downstream step; a mixed request; refresh and resume; no completed change repeated | turn 1 publishes the heading only and keeps a question; after the reload the card is back with its Cancel; after the answer, only the staircase photo's framing changes; the heading is not changed again and not charged again (source diff and ledger); nobody asks which photo again | 5–11 |
| Q3 | fretwork-1 | 1. "Take the QR code off the home page." → the look step asks which code. 2. Press Cancel. 3. Send any ordinary message, for example "Change the heading Book a guitar lesson to Book a lesson." | cancellation; a step's question is free | after Cancel, both codes are still there, nothing is published, and the step's question cost nothing (routing only); the next message runs on its own and is not taken as an answer | 3–6 |
| Q4 | hearth-paper | 1. "The bulk pricing bit, can you deal with it?" → the router asks. 2. An answer that does not settle it: "Not sure, whatever you think." 3. Answer the follow-up: "Take it off the page." | a repeated question; never acting on a guess | after turn 2 the router asks a more specific follow-up, or shows the same question under the note naming the earlier answer; it never acts on turn 2 alone; after turn 3 the Bulk pricing section goes and nothing else changes | 5–10 |
| Q5 | hartleys-barbers | 1. "Add a link to our Instagram in the footer." → the add-on step asks for the address. 2. Reload; the card must come back. 3. Answer: "instagram.com/hartleysbarbers". | an add-on step's question; refresh; a retained answer | exactly one Instagram link in the footer, with that address, and the footer's map, phone and email kept; nothing else changes; the question's call free; one add-on charge | 4–10 |
| Q6 | oak-and-ash | 1. "The photo on the Work page needs sorting out." → the router asks what should happen. 2. Answer: "Show more of the top of it." → the step asks which photo. 3. Answer: "The kitchen." | retained answers across the router and a step | the step's question does not ask again what should happen (the first answer reached it); only the kitchen photo's framing changes | 4–9 |
| Q7 | hartleys-barbers | 1. "Add a link to our Facebook page in the footer." → the add-on step asks for the address. 2. Press Cancel. | cancellation on the add-on side | nothing added, nothing published, routing charged only | 1–2 |

For Q2 and Q5, "no repeated charge" is read in `credit_events`: each
completed part has exactly one charge row, and an answer adds only its own
routing call and the work it still had to do.

## 4. Order, sites and restoration

**Order** (each site's rows run in this order, so no row needs another's
undone):
1. R0, then R1 and R2. They change nothing on any site.
2. The Q rows, before the D rows on the same site. Q2 and Q6 need `/work`'s
   two photographs and its first heading, and Q3 needs `fretwork-1`'s two
   QR codes, which D2 changes.
3. The D and H rows.

**Restoration: none is needed for the matrix to hold.** No row writes a
database row, so no data is restored at all. Every row is judged against the
before-read taken just before its own press, so an earlier row's published
change does not spoil a later one.

Each site's version before its first row is recorded. If the owner wants a
site back afterwards, the free restore puts that version back.
Otherwise the demo sites keep their changes, as the owner's rule for demo
data has it.

**One deploy only.** No row needs a code change, and no deploy happens
between rows.

## 5. Cost, and the proposed spending cap

| Group | Rows | Estimate |
|---|---|---|
| Step 0 | R0 | 0 |
| Group R | R1 (20 messages) | 22–32 |
| Group R | R2 (9 messages) | 10–14 |
| Group D | D1–D3 | 7–13 |
| Group D | H1–H4 | 6–14 |
| Group Q | Q1–Q7 | 26–56 |
| **All** | | **about 71–129** |

These are estimates, not limits. Nothing enforces a per-request cap: the
balance is the only bound.

At the measured routing average of about 1.3 a call, the likely total is
about 85–100.

**The proposed cap is 115 of the balance of 137.** After each press I read
the ledger. Before the next press I check that its upper estimate fits under
what is left of the cap. If it does not, I stop and come back to the owner
instead of pressing on.

If the Q rows run as the owner's own chat, the owner sees each turn's cost
in the chat, and I read the ledger after each row.

## 6. Code-tested, and verified with real models

"Code-tested" means shown through the real routes with supplied model
answers. "Real model" means a live run on the deployed code.

| Behaviour | Code-tested | Real model, live |
|---|---|---|
| Clear requests reach the right step | yes | yes, on earlier router instructions: runs 90 and 91 (34 probes), and Tests 5–12. Not since the live question rule was added (W27). |
| Removals keep their neighbours (W2) | yes (batch 1) | no (D1, D2) |
| Menu edits keep each page's own menu (W4) | yes (batch 1) | no (D3) |
| A part put off is named on every ending (W7) | yes (batch 2) | no (H1, H2, H4) |
| A hand-over carries its reason, part and page (W15, W24) | yes (batch 2) | no (H3) |
| The router asks only when a detail decides its answer | yes | no (R2, Q1, Q4, Q6) |
| A step asks inside a page | yes | no (Q2, Q3, Q5, Q6) |
| A mixed request: one part runs, another asks | yes | no (Q2) |
| Answers kept as a history (up to 64) and retrieved for each operation | yes | no (Q2, Q5, Q6) |
| A reload brings the question back and resumes | yes | no (Q2, Q5) |
| Cancel closes the question, free | yes | no (Q3, Q7) |
| A repeated question is held under a note, never acted on | yes | no (Q4) |
| No completed change or charge repeated on resume | yes | no (Q2, Q5) |
| `answers-full`, `answer-too-long`, a question busy elsewhere | yes | not planned: reaching them on purpose costs many turns for no new reading |

## 7. Decisions that are the owner's

- **The cap**: 115, or another number.
- **How the Q rows run**: by the owner's own chat (free to prepare, and the
  turns are the owner's), or by an extension of the canary's browser mode
  (free to build, scripts only, no deploy, not built without the owner's
  word).
- **Whether the demo sites go back afterwards**: by default, no.
- **Order against the model-written replies change** (2026-10-03, on the
  branch, not deployed). If that change is merged before the matrix runs,
  every row is still judged on what it did, not on its wording. Each reply
  would then also carry the reply writer's own cost, measured in that
  change's record, and the cap would need to be read again. Running the
  matrix on deploy 2180 first keeps the two apart.

## 8. What the matrix cannot show

- **How often an answer happens**: each message is routed once, by one
  model.
- **What each step's model was handed**: the trace shows the operations,
  not the words each lane was given. That stays shown with supplied answers
  only.
- **The full rewrite with a part put off** (W8): no natural message reliably
  reaches it.
