# The combined release, deploy 2188, and its live verification (2026-10-07)

The owner: *"Proceed with docs/investigations/combined-release-plan.md: I
approve releasing the prepared batch and running its one combined live
verification, with a maximum spend of 40 credits. Preserve the reviewed
recovery fixes and completed green CI evidence. Before merging, perform the
plan's preflight … Then fast-forward main once, deploy and build the container
image once as required, verify the served frontend and running Worker/container
versions, and complete the free runtime check before spending credits. Run the
prepared lv-combined scenario once … Keep the planned 38-credit stopping
threshold and 40-credit hard cap; do not add funds, automatically rerun a
failed paid scenario or start extra paid tests. If a gate fails, stop … Perform
the steps yourself wherever access permits; if a required action is blocked,
name the exact action and access error. Leave the demo changes in place."*

## 1. The preflight (23:03–23:04 UTC), all passed

| Check | Reading |
|---|---|
| The candidate | `9d6bda8a`, the branch tip; `main` `bcc22295` its ancestor; 36 commits |
| Product changes since the reviewed batch | **none**: since `092ff48a` (Codex's 90 assertions) only docs, tests, canary scripts and the dispatch-only canary form `.github/workflows/edit-canary.yml` changed; between `570adb45` and `092ff48a` only docs. `site-provision.mjs` and `site-db.mjs` are as reviewed |
| Test inputs | the site build's gate green on `570adb45` (run 37674861320, attempt 2, 404 checks), its inputs `de6345b9058cd1cc` (3,974 files) the same at `9d6bda8a`; unit CI green on `9d6bda8a` (run 37698296313, `9885 / 9863 / 0 / 22`) |
| Nothing running | no Actions run in progress or queued, read at 23:04 and again right before the push; no open job in `edit_jobs` in any account |
| Balance | 40, the ledger's last row 401 (23:03:55) |
| The image | predicted with the deploy's own functions: `5f946c22d42a1b10` (195 inputs) → `335396c8c0e0fbcb` (196 inputs), at `092ff48a` and `9d6bda8a` alike |
| The rollback | `git revert --no-commit bcc22295..9d6bda8a` in a throwaway worktree gives back `main`'s tree, `dcd4e727…`, exactly |
| The served file before | `chat.js` 920,280 bytes `0e68e324…`, `bcc22295`'s own (23:04:25) |
| Skip-CI marker | absent from all 36 messages |

## 2. The merge and deploy 2188

`main` `bcc22295` → `9d6bda8a`, one fast-forward push at 23:04:49 UTC. Run
37700151308 (deploy 2188), the only run it started, `success`, 23:04:56–23:08:07:
- the image **built** `335396c8c0e0fbcb` (196 inputs) as predicted, the
  container rolled `5f946c22d42a1b10` → `335396c8c0e0fbcb` at 23:07:59;
- `PROGRESS_REPLIES` printed masked: progress stays on;
- `chat.js` served byte-identical to the merged file at 23:08:44 (939,255
  bytes, `dfa07592…`); the other served files unchanged and matching;
- the image window waited once, to 23:25:05.

Full readings: `docs/deploy-record.md`, deploy 2188.

## 3. The free runtime check

The session's one dispatch of *edit canary* (`spend=no`,
`expect_deploy=9d6bda8a`, `expect_image=335396c8c0e0fbcb`, from `main`)
answered **`403 Resource not accessible by integration`** at 23:25:15 UTC. Not
retried, through this client or any other. **The free runtime check, and so the
paid press after it, are the owner's presses** (boxes in the handoff and the
plan's §3). Until the free check reads the merged commit and the image, deploy
2188 is deployed, not runtime-confirmed, and nothing is spent.

**Runtime-confirmed by the owner's free press, run 106** (37703142711, from
`main` at `9d6bda8a`, 23:35:35–23:36:14 UTC): `build-health` and `runtime` both
answered `9d6bda8afc4e`, a cold container `335396c8c0e0fbcb`, async and the
runner on; every zero-cost confirmation passed (the async shape on
`fretwork-1` and `washhouse-3`, a forged replay marker 404, another's job 404,
the free job terminal); `CANARY_SPEND is not 1 — stopping before the paid
edit. Nothing was charged.` Read after it (23:36:32): balance 40, last row
401, no open job. The paid `lv-combined` press is next, the owner's.

## 4. The paid live check: run 107 FAILED two gates (no question inside message 2's bound; no TikTok link); 25 credits

**The press**: the owner's, run 107 (37703443424), `lv-combined` on
`fold-lane-bakery`, from `main` at `9d6bda8a`, 23:38:51–23:59:09 UTC. Its
preflight answered `9d6bda8afc4e` and `335396c8c0e0fbcb` again; every free
check passed; the balance was 40. **Not pressed again, under the owner's
rule.** Evidence: the run's artifact `canary-evidence` (id 11519546184, 38
files, the screenshots among them; the session cannot download artifacts, so
they are not copied here).

### 4.1 What was verified (from the press's own readings, the site and the ledger)

**Message 1** (the Allergens page and its menu link; tab closed, a fresh session):
- routed `addon` (3 credits); the router named the order (the link after the
  page) and held the link back as its own part;
- part 0, the add-on (job `e46a3cca…`, 13 credits): `/allergens` added,
  served 200, headings *Allergen notice · A notice about our loaves · One
  kitchen, every loaf · In short*; the nine other pages' menus each gained
  one link to `/allergens`, keeping every item; published `ourh30` at
  23:49:11;
- part 1, the link (route job `5a93543a…`, 3 credits → the add-on step,
  which handed it over at no charge → the menu step, job `65767a36…`, cost
  0): **"Nothing needed changing: “Allergens” is already in the menu on every
  page that has one"** — the add-on's own run had already put the link in
  (its trace's `menu-links:ok`);
- **dependency order held**: part 1 stayed blocked until part 0 was done
  (588 s), on every reading, the card's included;
- **progress and the closed tab: all eight checks passed** — the first line
  live in the sending tab 150 s after the send (*"I've worked out that I'll
  add a new Allergens page. I'll design it next."*), the tab closed, the
  requests list alone read three times, a fresh session signed in afresh
  found the request and followed it to its end, every line and reply on
  screen; the model's own lines through the build (*"I've designed the
  Allergens page…"*, *"I've written the Allergens page and added a link to it
  in the menu. I'm publishing…"*);
- both parts' replies the model's own and on screen.

**Message 2** (the Order heading and the TikTok footer link):
- routed `edit`/`text` (1 credit), the TikTok link held back as its own part;
- part 0, the heading (job `08b84314…`, 2 credits): `/order` now reads
  **"Choose your loaf and a collection time"**, served; published `f821gr`
  at 23:57:30. Its publish waited 221 s for a container;
- part 1, the link: routed only at 23:57:55 (after part 0's publish), so the
  press's 6-minute bound for message 2 (23:52:16 + 6 min) had passed; **the
  press stopped at 23:58:19: no question shown — message 3 not sent**. On the
  server the request went on: routed `addon` (3 credits, row 407, 23:58:28),
  handed by the add-on step to the menu step at no charge, which **asked
  "What’s the full address of your TikTok profile?" at 23:59:18** (job
  `becdd472…`, cost 0). **The request is waiting on that question; it was
  left unanswered** (an answer would be a further paid action).

**The site after** (`01791417187002-f821gr`): every stored page byte for byte
as before apart from the named changes; every component as it was; the four
tables, their rules, columns and row counts as they were; no other page
added or removed; the description unchanged; **no footer gained a TikTok
link**.

**The money**: 40 → 15, **25 credits**, ledger rows 402–407:

| Row | What | Credits |
|---|---|---|
| 402 | message 1's routing | 3 |
| 403 | the Allergens add-on (`e46a3cca…`) | 13 |
| 404 | the link part's routing (`5a93543a…`) | 3 |
| 405 | message 2's routing | 1 |
| 406 | the heading (`08b84314…`) | 2 |
| 407 | the TikTok part's routing (`bd79395e…`), after the press stopped | 3 |

The press's own money check passed for what it saw (22 = routing 4 + jobs 18,
the balance's move exactly); row 407 came 9 s after it stopped. Narration
added no charge: 8 calls, $0.02245 of the platform's own (2.8 credits'
worth, absorbed). Within the 38 stopping threshold and the 40 cap.

### 4.2 The verdict, check by check

**Failed** (5): every message sent (2 of 3); message 2's reply on screen
(still being written when judged — it was written: *"⚠️ The heading on the
Order page now reads “Choose your loaf and a collection time”. Adding a link
to your TikTok in the footer was not tried yet…"*); message 2 ending on the
step's question (the question came 7 min after the send, 1 min past the
bound); message 3 sent; every footer gaining the TikTok link. **Passed**:
everything else — the release on the live site, message 1 end to end
(mixed request, order, eight progress checks, the closed tab, replies), the
heading, the site otherwise unchanged, the money.

### 4.3 What stays unverified

- **Clarification end to end**: the question was asked by the real step, but
  no answer was sent, so *an answer resumes the waiting part* and the TikTok
  link's placement are not shown live.
- Model behaviour generally: one sample each; how often the router holds a
  part back, or the add-on adds the menu link itself, is not measured.

### 4.4 Findings (backlog; not fixed in this round)

1. **The press's bound for message 2 was too short for this path**: the link
   part runs only after the heading part's publish, which waited 221 s for a
   container; the question came at 7 min against a 6-minute bound. A timing
   flaw in the prepared scenario, not a product failure; the product asked
   the question.
2. **Message 1's reply misstates the link**: it says the menu link *"was not
   tried this time … will be done separately"*, while the add-on's own run had
   already added it (its own progress line said so, and the menu step then
   found it there). The reply was written before part 1 ran and spoke of the
   part, not of the site.
3. **A part already satisfied, or handed over, still pays its routing**: the
   link part paid 3 for a routing call that sent it to the add-on step,
   which handed it on, where nothing was needed; the TikTok part paid 3 the
   same way. Routing `addon` for a menu or footer link is the router's answer
   (model behaviour), and the hand-over is free, but the 3 credits are spent.
