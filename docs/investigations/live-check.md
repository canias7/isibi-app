# The live check of the page's refresh: one stage to authorize (2026-10-05)

The owner, after the response-order correction passed review: *"Close this
correction in the handoff and stop expanding this audit. Prepare one combined
live Edit/Add-on verification covering correct reply placement, preview
refresh, updated page/table inventory and completion with the tab closed,
using existing passing evidence to avoid redundant cases. Give the exact
deployment workflow inputs, runtime checks, test instruction and estimated
credit cost together so we can authorize the next stage in one go. Keep the
current no-merge, no-deployment and no-paid-retest hold until that
authorization; first Build and RW remain outside scope."*

**Prepared, not authorized.** Nothing is merged, deployed, built, pressed or
spent. The press is the canary's new scenario, `lv-reopen`, on the branch with
its tests (`docs/history/2026-10-05-live-check.md`). First Build and RW are
outside it.

## 1. What it verifies, and what it does not repeat

One press on `fold-lane-bakery` (REQUEST_FLOW on, as deploy 2183 left it),
two messages, real models, real money:

| What | How this press shows it live | Already shown live, not repeated |
|---|---|---|
| Completion with the tab closed | Message 1 is sent, its tab closed once the server has taken it on; the request must end with no page open (read through the requests list alone), and the tab opened afterwards must show it ended | R5 (run 99): a request finished 396 s after its tab closed. Reused here as the way into the reopened page, not proved again on its own |
| Reply placement | On the reopened page and after message 2: no other request's reply drawn after either message; each message's own replies after it; message 1's replies still before message 2 (read by the jobs they are marked with) | Run 99 showed the bug live (7, 10 and 12 replies of other requests drawn after the new message): this is the fix's first live run |
| Preview refresh | The frame's address before each send and once each is done: message 1 from `?v=0` on a fresh record, moved by the reopened page as it reconciles the finished request; message 2 moved again in the same tab; each newer address loaded by that tab (read off the browser's own requests) | Nothing: the address fix and the reconcile are on the branch only |
| Page inventory | The new page (from the add-on) in the reopened page's own list of pages, read again from the server | R1 and R2 added pages through a tab that stayed open |
| Table inventory | Message 1's routing answer names every table the site has (the route's own read, the router's input); the new table in the reopened page's own list; message 2's routing call sends every table, the new one with them, and its answer names them all; after it, the page's tables are what that answer read | No table has been added by a request live before (R1–R5 added pages and lines) |
| Edit and Add-on in one message | Message 1 is a heading (an edit) and a new page with a table of its own (an add-on), one request | R1, R2 and R5 mixed both in one message |

**Not repeated**: R1–R5 and the focused menu check (mixed requests, the
add-on's menu link, a step's question and its answer, an attached logo, the
tab-closed end), the model-written replies (runs 97–99), and every closed
test. **Not shown here** (§7): another browser's addition while a page
watches, two routing calls out at once, and a route whose own read is
unavailable — all three shown with supplied answers only.

## 2. The stage, in order

What one authorization covers, every step free except §2.6:

1. **Before the merge** (the session, free): nothing in flight (no Actions run
   in progress or queued, read twice, the second right before the push; no
   open job in `edit_jobs`); unit CI green on the candidate itself; the site
   build's last run green with the candidate's inputs fingerprint (unchanged
   since `685a922c`, run 37282482599); the image predicted on both ends
   (`386607152d4cb319` at `main` `cd817fee` → **`589e3e4e85a20066`**); the
   rollback (`git revert --no-commit cd817fee..<candidate>`) giving back
   `main`'s own tree in a throwaway worktree; the served `chat.js`,
   `edit-poll.js` and `styles.css` read before; the balance and the ledger's
   last row read; none of the commits carrying the skip-CI marker.
2. **The merge** (the session): `main` `cd817fee` → the candidate, one
   fast-forward push. **The deploy is that push**: the workflow "Deploy to
   Cloudflare" runs on it by itself and takes **no inputs**. (Run by hand it
   would be "Use workflow from" `main`, with no boxes; it is not run by hand.)
3. **The deploy, read** (the session, free): one run, `success`; the log's
   `IMAGE SiteBuildContainer: built …:589e3e4e85a20066 (… 194 inputs …)`;
   the container's `- …:386607152d4cb319` / `+ …:589e3e4e85a20066`;
   Wrangler uploading `chat.js` (the one static asset that changed) and the
   secrets, `MODEL_REPLIES` and `REQUEST_FLOW` among them; the served
   `chat.js` byte-identical to the merged file, `edit-poll.js` and
   `styles.css` unchanged.
4. **The image window**: the session waits 15–20 minutes after the image
   rolls, once, and says when it is over.
5. **The free runtime check** (the owner's press, §3.1): both readers answer
   the merged commit, a cold container answers `589e3e4e85a20066`, queued
   jobs and the runner on, nothing charged.
6. **The paid live check** (the owner's press, §3.2), only after §2.5 passes.
7. **The readings and the record** (the session, free): the canary's log and
   its record, the site read back, the ledger rows by the press's own refs,
   and the records (history, deploy record, handoff, checklist).

A failure at any step stops the stage there, said, and nothing after it runs
without the owner's word.

## 3. The two presses' boxes

The canary workflow ("edit canary"), each box named by its description as
the form shows it. **The merged commit** is the branch's tip at the merge —
the session's report names it, eight characters — and `main` points at it
after the fast-forward. Every box not listed is left as it is: blank, or
its default where it has one (the site box `fretwork-1` in the free check,
the second site `washhouse-3` in both).

### 3.1 The free runtime check

"Use workflow from":

```
main
```

"Run the ONE paid edit as well (yes/no)":

```
no
```

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7 chars). Blank = read and print only.":

```
<the merged commit, 8 characters>
```

"Refuse to spend unless a cold container reports this image id (exact). Blank = read and print only.":

```
589e3e4e85a20066
```

It passes when both readers answer the merged commit, a cold container
answers `589e3e4e85a20066`, every zero-cost confirmation passes, and the
balance does not move.

### 3.2 The paid live check

"Use workflow from":

```
main
```

"Run the ONE paid edit as well (yes/no)":

```
yes
```

"RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":

```
lv-reopen
```

"The site to edit. Defaults to the canary site; name another to run this against it. Not needed with read_job.":

```
fold-lane-bakery
```

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7 chars). Blank = read and print only.":

```
<the merged commit, 8 characters>
```

"Refuse to spend unless a cold container reports this image id (exact). Blank = read and print only.":

```
589e3e4e85a20066
```

"What to change", "REQUEST BATCH ONLY …", "Refuse to post the paid edit unless
the router answers this …", "Refuse to route or spend unless one table …",
"ROUTING-ONLY BATCH …", "READ ONE EXISTING JOB AND STOP …", "PUT ONE SAVED
VERSION BACK …" and "Rules test only …": blank.

## 4. The test instruction

`lv-reopen` (`scripts/canary-ui.mjs`), in the real app in a real Chromium,
signed in as the building account, on `fold-lane-bakery`:

1. **Message 1**, typed and sent:

   > Add a Bake List page where people can join our weekly bake list by leaving their name and email address, and change the Visit page heading 'Our shop on the street' to 'Find us on the street'.

   Once the routing answer names the request and the page has drawn its
   card, **the tab is closed**. Until the request has ended only the requests
   list is read (every 20 s), never the request's own route. Then **a new tab
   opens the site** in the same browser and must show the request ended,
   every reply on screen.
2. **Message 2**, from that reopened tab:

   > Change the Gallery page heading 'Photographs from the bakery' to 'Photographs from Fold Lane'.

**It passes when every check passes** (the canary prints each one):
- each message left as one routing call with its words, was taken on as a
  request, and ended with every part done at a route the press allows (text,
  look, nav or page for the edits; the add-on step for the page); nothing
  stopped by the press's wall; message 1 ended while no page was open,
  nothing read its route meanwhile, and the reopened tab showed it ended;
- the site: one new page about the bake list, stored and served 200; every
  page's menu gained "Bake List" pointing at it, keeping its own items;
  `/visit` reads "Find us on the street" and `/gallery` "Photographs from
  Fold Lane"; exactly one new table, which visitors can send to and nobody
  can read (`collect`), with an email column; every other table, stored page,
  component, logo and the description as they were;
- every reply the model's own, on screen;
- the live checks (`liveChecks`, §1's rows): no other request's reply after
  either message, each message's own after it, message 1's still before
  message 2; the preview given a newer address once each was done and that
  address loaded by its tab; message 1's routing answer naming every table
  the site had; the new page and the new table in the reopened page's lists;
  message 2's routing call and answer carrying every table; the page's tables
  then what that answer read;
- the money: the press's own charges (routing by its keys, jobs by theirs)
  add up to the balance's move.

## 5. The cost

**About 17–27 credits** in all, an estimate and not a cap, from what the same
kinds of work cost in runs 95–99:
- message 1: routing 1–3; the heading 2; the add-on's own routing 1; the
  add-on (a page with a sign-up form and its table, the menu link the
  builder's) 10–16 — about **14–22**;
- message 2: routing 1–3; the heading 2 — about **3–5**.

The press stops itself before message 2 if message 1 has spent 32 or more
(its budget), so the most it can spend is message 1's charge plus message 2's.
The deploy and the free runtime check cost nothing. The balance was **48** at
11:07 UTC (last ledger row 385, no job open); nothing enforces a per-request
cap, so the balance is the only bound.

## 6. What stays, and if it fails

- **The changes stay** (the demo-site rule): the Bake List page, its table,
  its menu link and the two headings. The press writes nothing of its own.
- **If a check fails**, the record says which and why; nothing is pressed
  again, repaired or put back without the owner's word. A saved version can
  be put back free (the restore box) for the pages; a table is not removed by
  that.
- **If the merge or the deploy fails**, nothing is pressed. The rollback is
  the revert verified in §2.1.

## 7. Not shown by this press

- **Another browser's addition finishing while a page watches**, and an
  older routing answer arriving after a newer one: shown with supplied
  answers (RECON 7 and 8; INV 5, 6 and 8–12), not live. The app sends one
  routing call at a time, so the race is not reached through it.
- **A route whose own read of the tables is unavailable**: shown with
  supplied answers (INV 4 and 8–12); the live route reads them.
- **A request the reader applies in the tab that sent it** (its undo offer,
  the words in the box): R1–R5 sent and watched their requests in one tab;
  message 2 is one such, its preview and lists judged here.
- **First Build and RW**: outside this stage.
