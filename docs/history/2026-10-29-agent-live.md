# 2026-10-29 — First live run of the site agent (deploy 2286): Kiln Lane

On the owner's "Go", from the app at gofarther.dev, signed in with the saved
"A" account session (balance 107 before), recorded (video kept in the
session's scratchpad, `rec/build/564d59f8….webm`, 50 MB; screenshots in
`2026-10-29-agent-live/`).

## Runtime first (free)
- Canary run 40807883968 (owner's press, 02:41 UTC): both readers
  `7363794366a3`, cold container `a1f126d49bbe9fe8`. **Deploy 2286
  runtime-confirmed.**
- `build-health.agentNet` read live: `netCut "userns"`, `asUser true`, probe
  `NET-BLOCKED ENETUNREACH`, `DNS-BLOCKED`. Commands in the real container
  have no internet.

## The build
Message: *"A small pottery studio called Kiln Lane in Bristol: weekly wheel
classes, a shop for mugs and bowls, and a contact form."* Sent 02:46:23 UTC;
done about 02:57 (10 min 45 s).
- Planned Home, Classes, Shop, Contact; artisan look; database with three
  tables (classes, products, enquiries) and starting rows.
- The agent wrote the header/footer and four pages (5, 4, 3, 2 sections),
  checked the code, compiled clean, opened the pages in a real browser.
- Saved as a draft, not published. The browser check "was cut short before it
  finished"; on the pages it reached it found nothing wrong. Photographs were
  not bought (credits too low); three placeholder frames.
- Progress talk ran throughout in plain English (one line every ~30 s).

## Money (A account, `credit_events`)
| row | ref | delta | after |
|---|---|---|---|
| 851 | `build:5cbe19cd…:deposit` | −2 | 105 |
| 852 | `build:5cbe19cd…:settle` | −11 | 94 |
| 853 | `build:5cbe19cd…:pages` | −88 | 6 |

**101 credits, against an estimate of 15–45** (the 2026-10-28 Kiln Lane build
on the older steps cost 62 in the ledger). The agent's page writing (88) is
the cost. Balance now 6.

## Not done
The approved edit ("Make the hero headline say 'Hand-thrown in Bristol' and
add opening hours to the contact page") was **not sent**: the build already
spent more than estimated, and a balance of 6 may not cover it. Waiting on the
owner.

## The three findings and their fixes (offline, same day)
The build's own record (`site_builds`, `kiln-lane`) showed our agent ran: an
`agent` mark and 26 logged rounds before the trace's 60-step cap cut it off.
Three findings, fixed on the branch (not deployed):
1. **What each round did was dropped.** The trace keeps numbers only, and the
   round's tool names were a list. Each round now logs counts (`writes`,
   `reads`, `commands`, `looks`, `builds`, …) and its tokens (`inTok`,
   `cached`, `outTok`); the trace holds 140 steps, enough for 40 rounds.
2. **Clearing the desk spent the cache.** Above 60,000 characters it rewrote
   older rounds every round (rounds 24–26 cleared 6–8 items each), so every
   byte after the rewrite was billed at full price again. Now a clearing is
   made only when it saves at least 15,000 characters
   (`COMPACT_MIN_SAVE`); otherwise the pile stays byte-for-byte as it was.
3. **One file per round.** The rules never said several tools may go in one
   answer. They now say so: every known file in one answer, reads together.
Tests SA31–SA34 and a trace-room case; sweep 6 of 6 killed, the comment
control survived. The saving is not measured until a live build.

## The second build, after the fixes (deploy 2287, runtime-confirmed)
`build-health` read by the session at 03:45: `0299f6126`, image
`98e49766f0f461b8`, `agentNet` blocked (the owner's canary run 40813864022
pressed too). Same message, sent 03:53:28 UTC, site `kiln-lane-2`, saved as a
draft (not published), build 12.1 min.
- **18 rounds** (the first build: about 36). Rounds 1–12 each ran ONE command
  (looking around); round 13 wrote 6 files at once and round 14 two; one
  build (passed), one look, finish.
- **The cache now holds**: from round 3 most of each request was read cached
  (16k → 38k tokens); one clearing (6 items) at round 15.
- **Money**: ledger 855–857: deposit 2, settle 12, pages 54 → **68** (the first
  build: 101; pages 88 → 54). Balance 106 → 38.
- **What is left**: each round re-reads the whole conversation; at $0.50 per
  million cached tokens 38k tokens is ~2.4 credits a round even when the
  round does almost nothing. The twelve one-command rounds cost about 24.

## After the second build: the agent works blind (fixed offline, same day)
The second build's record showed round 17 calling `look` and being refused, and
its final reply flagged nearly invisible text the agent never heard about.
Traced to three gaps and a limit, all fixed on the branch (not deployed):
1. **A first build never wired `look`.** The agent is one, but it is plugged in
   at two places (the first-build writer's slot and the edit route), each
   handing it its own tools; the build slot passed no `look`. Now it does (the
   same compile, asked for the one page's screenshots), and the agent is only
   ever offered tools that are wired (`toolsFor`).
2. **Look returned only screenshots.** The browser check's findings were
   dropped before they reached the agent (edit path `compileOnly`, and the build
   slot). Now `build` and `look` answer with them in words, by page and width
   (`checkNotes`), and with the type checker's errors that did not stop the
   build (the "mistake in the header").
3. **Finishing with a serious finding open.** Unreadable text, a blank or
   crashing page, sideways scrolling or a see-through menu are marked FIX
   THIS; the first `finish` while one is open is sent back once, the second
   is let go (the final reply still says what the check found).
4. **The browser check had a 25 s limit for the whole site** and was cut short
   on both live builds. On the owner's word ("no cap") it now checks every
   page at every width; each page still has its 6 s to open.
Tests: SA35–SA38 and SAB2 (a real first build through the route: `look`
offered, screenshots back, the contrast finding named, the finish held once);
sweep 10 of 10 killed, the comment control survived.

## The third build, after deploy 2288 (agent sees the checks; no whole-check limit)
Same message, sent 06:20:53 UTC, site `kiln-lane-3`, saved as a draft (not
published), about 17.5 min. Balance 38 → 138 (owner-approved top-up, ledger
858) → 65.
- **22 rounds**: 10 one-command rounds looking around; 6 files then 2 written
  at once; a first build failed (its reason is not recorded: the trace keeps
  numbers only), two commands fixed it, the second build passed; **then it
  looked: 1 page, then 3** (the look tool working in a first build); finished
  first time (nothing must-fix open).
- **The browser check opened all four pages** ("not cut short" this time) and
  flagged nothing; the final reply and the progress lines agree; the photo
  reason is the one true one.
- **Money**: ledger 859–861: deposit 2, settle 12, pages 59 → **73** (the
  second build 68). The last round re-read the screenshots uncached (38,799
  fresh tokens, about 10 credits).
- Still open: the ten one-command rounds (about 18 credits); the reply says
  "That is not a look at any page" although the agent looked; a failed
  build's reason is not kept in the record.

## After the third build: the reply knows the agent looked; a failed build's kind is kept
1. The reply said "it is not a look at any page" and "nobody looked at the
   design" though the agent had looked at all four pages. The pages it looked
   at now travel to the checks (`looked`, build and edit), and the reply says
   "The builder also looked at screenshots of 4 pages (…) itself before
   finishing"; without them the sentences are as before.
2. A failed build's reason was lost (the trace keeps numbers only). Its kind
   is now logged as a count: `timeout`, `types`, `missing`, `serverTest`,
   `crash` or `other` (`agent:build-fail`), never its text.
Tests SA39, SA40, CL1–CL4; sweep 7 of 7 killed, the comment control survived;
1,608 related tests pass.

## The look-around rounds (fixed offline, same day)
The third build spent rounds 1–10 on one command each, learning the project
(about 18 credits). Now:
1. **A map at the door**: a new site's first message carries THE PROJECT —
   where pages and shared parts go, that a first build writes its own parts
   (no kit to look through), that the rules already say how data is read, and
   the site's tables with their columns — and says to start writing.
2. **One command per look**: the rules ask for everything to be looked at in
   ONE command (joined with `;`), never one look per round.
3. **What each command did, as kinds**: each round logs `cmdList`, `cmdRead`,
   `cmdSearch`, `cmdCheck`, `cmdEdit`, `cmdOther` counts; the command's text is
   never kept.
Tests SA41, SA42; sweep 6 of 6 killed, the comment control survived. The
saving is not measured until a live build.

## The parallel tests (08:11 UTC, after deploy 2289) and two fixes
Three at once on the A account (balance 65 → 165, owner-approved top-up,
ledger 862):
- **Question** on `kiln-lane-2` ("What pages does my site have…"): failed, no
  charge. The agent answered in plain text, and the loop reads an answer with
  no tool as `stopped: no-tool`, so the answer was dropped. Open (owner to say).
- **Edit** on `kiln-lane-3` ("Hand-thrown in Bristol" and opening hours): done,
  3 rounds, 1 build, 4 pages checked clean, draft revision 2, 12 credits. It
  **invented the opening hours** (Tue–Sat 10–6…), and one progress line said
  "Publishing the site now" though it was saved to the draft.
- **Build** `kiln-lane-4`: running at the time of writing.
Fixed (offline): the agent's rules now forbid inventing anything — every fact
comes from the owner, the site or its tables; a missing one is a clearly
marked placeholder named in finish (owner: "dont invent anything", universal);
the progress line after the checks says "Saving it to the site's draft now…"
under draft-first, "Saving the change now." when a rebuild may yet go live.
Tests SA43, SD1–SD2; sweep 3 of 3 killed, the comment control survived.

## The fourth build (`kiln-lane-4`) and the page that gave up
The build saved as a draft after 22½ minutes (ok, ledger 863, 864 and 867:
2 + 12 + 76 = **90**), but the page said "That didn't come together" at about
20 minutes: `BUILD_FOLLOW_MS` was 20 minutes, from the page writer's day, and
the agent may run 40. Now 50 minutes (test BF1 keeps it at least the agent's
limit plus eight; the old value fails it). Why the page showed an error rather
than its "still being written" sentence is not yet reproduced.
The map at the door worked (the looking around took 2 rounds, not 10); the
rest of the cost was a failed first build, five looks after a held finish,
and the clearing triggered by each look's screenshots (open).

## Screenshots leave after one round (fixed offline)
kiln-lane-4's later rounds cost 3–7 credits each: every look added ~100,000
characters of screenshots, pushed the pile over COMPACT_AT, and the next round
rewrote older rounds (seven clearings). Now a screenshot is seen for one round
and then becomes a one-line note (`dropSeenShots`; only the message just before
the newest changes, so everything before it stays cached), and screenshots no
longer count towards the pile (`pileSize`). Tests SA44, SA45; sweep 4 of 4
killed (the first sweep's surviving mutant, the pile counting screenshots,
was killed by SA45), the comment control survived; the 52 agent-related tests
pass. The saving is not measured until a live build.

## A question answered in plain words (fixed offline)
The parallel test's question ("What pages does my site have…", `kiln-lane-2`)
was answered in text without `finish`; the loop read that as `no-tool` and
the reply said it could not answer. Now, when nothing was written or changed,
the agent's plain words are its answer; after a change, plain words are still
a stop mid-work, and a cut-off answer is still `too-long`. Tests SA46 (SA10
now uses an empty answer); sweep 3 of 3 killed, the comment control survived;
the 54 agent-related tests pass.

## Why a finish was sent back (fixed offline)
kiln-lane-4's agent was sent back once, and the record said only that. Now the
hold is logged with the must-fix kinds the last check found, as counts
(`agent:held`, e.g. `contrast: 2`): a label in our build record, never a
message to the customer, never the finding's text. Test SA47; sweep 2 of 2
killed, the comment control survived.

## The second parallel tests (19:59 UTC, after deploy 2290)
Balance 63 → 163 (owner-approved top-up, ledger 868) → 86.
- **Question** on `kiln-lane-2`: **answered** (the plain-words fix), four
  pages described, nothing changed, 5 credits (ledger 869).
- **Edit** on `kiln-lane-4`, "Add our opening hours to the contact page." (no
  hours given): done, 3 rounds, 1 build, draft revision 2, 14 credits (872,
  873). It took the hours the site already states and left out Sunday and
  Monday "because the site does not state those hours" — no invention. The
  session's recording browser crashed mid-run (three at once); the server's
  job was unaffected.
- **Build** `kiln-lane-5`: saved as a draft, 12.2 min, 18 rounds, **58 credits**
  (2 + 11 + 45; the earlier builds 101, 68, 73, 90). The looking around took 4
  rounds; two failed builds (`missing`, `other`); one look; one `shots-out`
  and **no clearing at all**; the finish was not held. The reply names an
  error written while the Enquire page loads, found by the browser check
  after the agent had finished.
