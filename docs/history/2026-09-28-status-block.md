# CLAUDE.md's status block and the fifth prune's note, as of 2026-09-28

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). This is the running
> status paragraph that opened CLAUDE.md — deploys 2158 to 2165, live test 2
> and Tests 3 to 6 — and the fifth prune's note. CLAUDE.md now opens with a
> short "Where things stand" and the sixth prune's note instead.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at its other sections, most of which now live in the docs listed in
> `docs/history/README.md`.

# Go Farther

Add-on escalation correction: [bounded patch and verification](../investigations/addon-escalation-correction.md).
Only verified missing source/design may reconstruct; unreadable state and failed
editable recovery stop. Closed: merged/deployed at `5cb8592`; non-spending canary
36096052737 verified image `b83b0611aeecce8f` at 2026-09-25 04:50:36 UTC.
Edit-path milestone and literal-text guard: [milestone](../investigations/edit-path-milestone.md),
[text preservation](../investigations/edit-text-preservation.md). Merged/deployed at
`6ed355e4` (deploy 2158, image `f05cb5a5a0def44c`), runtime-confirmed by free canary
run 36155364708 at 2026-09-25 15:37 UTC (all free checks passed, spending off, balance 3).
The guard covers parsed literal JSX prose and its supported request grammar only;
every model answer in its evidence is supplied.
Credit-refusal wording (the edit's charge and the routing charge stated apart):
merged/deployed at `c2fa000c` (deploy 2159, image `a51d8b32e5869576`); served
`chat.js` byte-identical to the merged file; runtime-confirmed by canary run 32's
preflight (36172189711, 2026-09-25 18:15 UTC).
Live test 2 (the section move on fretwork-1): run 32 published it through the quick
writer as a pure block move, for route 2 + edit 8 credits. **CLOSED for what it shows
(owner)**: the quick writer moved one section and kept the surrounding source; it does
NOT verify the full-writer text guard, and #418 stays open. Browser-verified 19:00 UTC
(a real Chromium over TLS-verified live bytes). **Merged and deployed at `7384ddba`**
(deploy 2160, 2026-09-26 01:05 UTC, image `c3cc126e45e93815`; served `chat.js` and
`edit-poll.js` byte-identical to the merged files): the canary's after-read wait
(`72885ca9`), the page-qualified and quoted-page text guard (`ce913d06` + `8c0d67a1` +
`d6f5e55e`), the consolidated edit-path milestone (`01222bab` → `8f66dfb9`) and the
rollback round (`7384ddba`: tests and the checklist only). **Then merged and
deployed at `0de188ff`** (deploy 2161, 2026-09-26 05:52 UTC, image
`05750a5120d33570`, predicted from the merged tree and read off the deploy's own
log; `public/` unchanged, so there is no served-file check): the rollback round's
two findings — a stale stylesheet rule holding an unrelated edit, and a failed
restore that was not said (*a publish is held only for the rules a request
wrote*, below) — and the two defects the owner then found in that fix's
stylesheet readers: whitespace inside a quoted value collapsed, so a respaced
selector shipped unjudged (*a quoted value, an escape or a selector's own
whitespace is part of the rule*, below); and a comment read as whitespace, so a
compound rewritten as a descendant shipped unjudged and the judge was handed the
wrong meaning (*a comment is a token boundary, not whitespace*, below). Its site
build ran the new browser control in a real Chromium: 22 of 22.
**Runtime-confirmed by the owner's free canary, run 33** (36223626560, 2026-09-26
06:24 UTC, spending off): both readers answered `0de188ff2d3a` with image
`05750a5120d33570`, all free checks passed, and the balance was 91. The session's own
attempt at 06:08:20Z had answered **403**. Deploy 2160's moment was never read live;
its code is live as part of 2161.
**Test 3 ran as the owner's paid press, run 34** (36224239033, 2026-09-26 06:43 UTC),
and **all seven acceptance items hold**. The full writer removed "The first eight
chords" and nothing else. The route was the router's `look`, the `components` lane,
then the page rung. The quick writer was attempted and the full writer followed; why
the quick attempt did not publish was not captured, and its usage alone does not
establish that it declined. Both preservation checks let the full writer's change
through. It cost route 2 + edit 16 = 18, leaving a balance of 73. The live
page at the job's own version `01790404806543-kk6qsh` is exactly the before page
without that section. The verdicts are inferred from the publish, not captured,
and #418 stays open. **CLOSED BY THE OWNER** after independent review (2026-09-26),
together with the CSS-correction milestone (deploy 2161's batch): no repeat run, no
restoration, no further CSS work.
**What remains, and Test 4b (2026-09-27: narrowed by the owner to D1 alone —
built on the branch at `6602be37`, rehearsed free as run 40; its recovery's
write made CONDITIONAL in the owner rows route, which is Worker code — CLOSED
BY THE OWNER after review (165 focused tests) and MERGED AND DEPLOYED at
`14df0225`, deploy 2163, 2026-09-27 05:15 UTC, image `9038e90ab1d5d7fe` — and
rehearsed free again on that deployment as run 41, which passed — and THE
OWNER'S PAID PRESS PASSED AS RUN 42 — D1 CLOSED BY THE OWNER after an
independent review (2026-09-27); D2 and D3 parked; step 0, `grants preview` run
36286991932, kept as maintenance evidence; the rules test recommended next, on
the candidate site `lido-axes-b`, revised on the owner's two corrections and
BUILT on the branch at `ebf53761` as the scenario `4b-rules-close`, its
booking decided before it leaves the browser since `717bb5b2` (that correction
CLOSED BY THE OWNER after review) — both free checks passing: `grants preview`
run 36309691339 read the starting permissions it was written for, and the
free rehearsal, `edit canary` run 43 (36333244182), stopped exactly the marker
booking in the browser and changed nothing — and THE OWNER'S PAID PRESS PASSED
AS RUN 44 (36337146911, 2026-09-27 17:29–17:31 UTC): routed to `rules`, the
rung marked `bookings` closed, and one real visitor booking was then refused
at the privilege check with no row added, for 3 credits; and the permissions
read after it, `grants preview` run 36339825502, found visitors holding
nothing on `bookings` and the menu unchanged, so every pass item holds — and
THE SCOPED RULES ACCEPTANCE IS CLOSED BY THE OWNER (2026-09-27): booking
permissions removed, the real visitor submission rejected, no row added, the
menu's permissions unchanged, the stored pages and components unchanged;
there was no successful booking measured before the edit, so it proves this
closure request and not every rules operation; bookings stay closed, and the
still-visible invitation and the generic rejection are a separate UX gap,
not this milestone)**: the
top section of the
[edit-path checklist](../investigations/edit-path-checklist.md), summarised in
*remaining work after Test 3* below. Among the QUEUED jobs inspected, a page
removal has never published; **run 44 was the rules rung's first queued
success** (it changes the database and publishes nothing), and **run 42 was
the data rung's first queued job to change a row** (a row edit publishes no
version);
**run 39 was the
first queued publish of the logo rung, the picture rung and a page move**, its
logo and move jobs are the only `exempt` jobs in the queue's history, and it
sent the first messages from one browser tab. A synchronous edit makes no job
row, so that is the queue's record, not proof nothing else ran. **The kit-heading fix is CLOSED BY THE OWNER and
MERGED AND DEPLOYED at `ab74d0d9`** (deploy 2162, 2026-09-26 20:31 UTC, image
`369d7b1e5bae25b0`; *a section headed by the kit*, below), with the owner's
review round (a kit heading the page may not render named its section) in it
at `5ec82214`. **Runtime-confirmed by the owner's free press, run 35**
(36271891594, 21:08 UTC): both readers answered `ab74d0d94384` with image
`369d7b1e5bae25b0`, the restore target was listed and restorable, and the
balance was 73 (*Test 4a, prepared*, below). **Step 0 ran again as run 36**
(36273488436, 21:36 UTC, from the branch with the canary's reader fixed): all
five stored bodies equal the record byte for byte, so Part A's before-state is
complete. **Part A ran as run 37** (36274691376, published 22:02 UTC, the
owner's paid press from the branch): the full writer removed exactly the
"Today's bake" section and the code only it used, kept both photographs, and the
kit-heading fix answered live; route 2 + edit 6 = 8, balance 65 (*Test 4a*,
below). **Parts B and C ran as run 39** (36281551801, 2026-09-27 00:17 UTC,
the owner's paid press of the canary's new UI mode from the branch — the real
app in a real Chromium, signed in as the owner, three messages from one tab):
the logo (attached in the composer, served byte for byte), the reframe and the
page move each published as asked, the composer came back after every reply,
the chain read VERIFIED and every stored page is byte-identical to the
expected; routing 2 + 1 + 2 and one edit of 1 = 6, balance 59 (*Test 4a* and
*the canary's UI mode*, below). Run 38 was refused before signing in (the site
box), spending nothing. **Test 4a is CLOSED BY THE OWNER** after an
independent review of run 39's workflow and evidence (2026-09-27), for the
behaviours runs 37 and 39 demonstrated; three findings are kept as separate
backlog items (the logo reply's "on every page", the message bubble without its
picture, and the job reader's `exempt` wording). **Test 4 is split in
two, each approved on its own**: 4a (pages, photographs, an attachment and second
messages; a free restore undoes it) and 4b (one row of the database, changed
through the real app and put back by the canary with no model call). **Applying
grants through `grants preview` is maintenance, not edit-path acceptance: it
never goes through the rules rung** (owner, 2026-09-27). **Deploy 2163 is
runtime-confirmed by the owner's free rehearsal, run 41** (36297687383, 05:37
UTC, from `main`): both readers answered `14df0225be90` with image
`9038e90ab1d5d7fe`; the conditional write no row can meet answered **409** and
changed nothing; after it, the focaccia read £4.50 on the order page and 4.5 on
both readers; balance 59 → 59. The session's own dispatch at 05:31:35Z had
answered **403** and was not retried. **D1's paid press ran as run 42 and
passed** (36298962234, 2026-09-27 06:03–06:05 UTC, the owner's press from
`main`):
- the message was routed to the `data` layer and filed one data edit;
- row 6's price went 4.5 → 4.6 on both readers and nothing else changed;
- the order page showed £4.60;
- the canary's conditional put-back answered 200 (the first live conditional
  write that matched) and left the row, the visitor read (byte for byte) and
  the order page exactly as before;
- nothing published;
- routing 2 + edit 1 = 3, balance 59 → 56 (*Test 4b*, below).

**D1 is CLOSED BY THE OWNER** after an independent review of run 42
(2026-09-27): exactly one price change on both readers, £4.60 in the browser,
the conditional put-back to £4.50, the page and component source unchanged, 3
credits. The reply's generic wording ("✅ Updated one entry in loaves." names
the table, not the change) is kept for the later model-written-replies work and
is not reopened. **The short edit-path checklist** — demonstrated live, tested
only with supplied model output, still untested, material gaps first — is the
top of the [edit-path checklist](../investigations/edit-path-checklist.md).
**The rules test on `lido-axes-b`, a CANDIDATE site, revised 2026-09-27 on
the owner's two corrections, has run** (*Test 4b*, below). One message was to
close its `bookings` table, for about 3 credits, and then ONE real visitor
booking had to be refused at the privilege check with no row added. **The
harness is built on the branch (`ebf53761`, 2026-09-27; *the rules test,
built*, below), and since `717bb5b2` only the exact marker booking
may leave the browser (closed by the owner after review, 105 focused tests).
Both free checks pass: `grants preview` run 36309691339 read the starting
permissions it was written for (visitors may insert into `bookings`,
table-wide, and not read it; they may read the menu), and the free rehearsal,
`edit canary` run 43 (36333244182), stopped exactly the marker booking in the
browser and changed nothing.** **The owner's paid press, run 44
(36337146911), PASSED every check it makes**: routed `intent=edit
layer=rules` (2 credits); one job whose stored reply applied exactly
`bookings`'s `retired` (1 credit); then one real visitor booking through the
site's own form, exactly the marker, answered **403 `42501` "permission denied
for table bookings"**, the page said "That isn't available.", no row was
added and the notification stamp did not move; nothing published; 56 → 53.
**And press 4, the permissions read after it** (`grants preview` run
36339825502, the owner's, from `main`, 18:13Z), **agrees**: visitors hold
nothing on `bookings` (its planned statements are the two `REVOKE ALL` lines
alone, so the stored schema records it closed) and `menu_items` exactly as
at 09:32. **So every pass item holds.** A booking that went through before
the edit was never measured, so this shows the configuration changing and a
booking refused afterwards. **`lido-axes-b`'s bookings stay closed**, as the
owner approved; its pages still show "Book a table" (*the rules test, built*,
below). **CLOSED BY THE OWNER, 2026-09-27** (*"Run 44 and the
after-permissions preview check out. Close the scoped rules acceptance"*), for
exactly what it showed: booking permissions removed, the real visitor
submission rejected, no row added, the menu's permissions unchanged, and the
stored pages and components unchanged. **The evidence boundary stays
explicit**: no successful booking was measured before the edit, so this proves
this closure request, not every rules operation. The invitation the pages still
show and the generic "That isn't available." are **a separate UX gap** (the
Backlog), not part of this milestone. **Test 5, a page removal and its
restoration, is PREPARED (2026-09-27; nothing paid)** on fold-lane-bakery.
**A page removal on its own is refused on the existing multi-page sites**:
every page but the home page is linked from another page (a site keeps its menu
in every page file; the survey's only unread exceptions are two CRM `/deal`
pages), so the test is two messages from one tab: "Take Gallery out of the menu." then "Remove the gallery page.". Each
message is walled to its own kind of edit (the UI mode's new per-message wall,
scenario `5-page-remove`, on the branch), and it was rehearsed free through the
real edit route, 8 of 8. The recovery is the existing restore mode, free, to
`01790468089054-8btpep`. Cost about 3–5 credits (*Test 5*, below).
**Both free checks passed** (runs 45 and 46, 22:25Z and 22:45Z): the restore
target is listed and restorable, the before-read equals the recorded bodies,
and the rehearsal typed message 1 and sent nothing. **The paid press ran as run
47 (23:05–23:09Z) and stopped at message 1, changing nothing.**
- The router answered `nav` with `remove`, which sends a menu removal through
  the part-picker door.
- The picker named `behavior`, because no lane describes the menu's items.
  That lane answered nothing, and the menu rung never ran.
- Message 2 was then refused by the link rule, as designed.

It cost 2 + 1 = 3 credits for routing, and the balance is 50. It is reproduced
free, word for word. **The owner approved a correction (2026-09-28) and held
it TWICE**:
- **the first version (`a9fc516a`)** kept only the lanes that lead back to the
  router's rung, and so also dropped work asked for beside the removal;
- **the second (`50b97183`)** read the request from how many lanes the picker
  named: one lane was the routed removal, two or more were extra work. So "take
  the photo off and move the opening hours up" answered with `shape` alone
  lost the layout, on both money paths, and with the photo refused the whole
  message was refused with it. The owner: *"Replace the lane-count assumption
  with an explicit distinction between the already-routed operation and
  additional requested work."*

**The third version is BUILT on the branch at `d6f564a5`, not merged** (*Test
5*, below):
- on a door the router opened for its own `nav` or `picture` removal, the
  picker is TOLD the routed change, in the router's own words for that layer
  (`layerLine`), and asked two lists: `additional` (other work asked for, the
  only list that makes steps) and `routed` (which part the routed change is
  about, recorded and never run). Nothing is read from how many lanes either
  list holds;
- the router's own step runs exactly once, with the router's verbs, where its
  lane would run (`doorDispatch`); a removal or page verb applies only to the
  additional work;
- a home page's menu keeps a link to itself it already has, so the menu edit
  removes only the Gallery link;
- the canary sends message 2 only after message 1's job stored a menu
  success, and passes the scenario on nine operation checks, never on two
  replies (run 47 printed "UI MODE PASSED").

Every model answer in its evidence is supplied, and whether a real picker fills
the two lists as asked is unmeasured. Unit CI (8,201, all 86 cases of the
three changed files by name) and the site build (twelve counts green,
site-build 404) are green on `d6f564a5`, and a merge rolls the container
(predicted `a217f74c81122512`).
**MERGED AND DEPLOYED at `e4b15ef6`** (deploy 2164, 2026-09-28 16:31 UTC, image
`a217f74c81122512`, predicted on both ends and built), **runtime-confirmed by the
owner's free run 48** (36454708479, 16:57 UTC). **Run 49, the owner's paid retry
(36458780197, 17:32–17:39 UTC), passed 8 of its 9 checks, and the owner closed
its removal**: the real picker answered `{routed: [], additional: []}`, the menu
rung took exactly the Gallery link off four menus (the home page keeping its own
"Today's bake"), and the removal took `gallery.tsx` alone, free; 50 → 45. **The
ninth failed: `/gallery` answered a plain 404, not the 301 home, and it is a
PUBLISH defect on every site since 2026-08-17** (*run 49 and the redirects no
publish carried*, in *Test 5*): `composePublish` handed `mergeRedirects` the
parsed sidecar, whose lists are `routesCsv`/`redirectsCsv`, so no removed page
got a redirect and the next publish dropped every stored one (`/the-starter`,
301 since run 39, 404s too). **The fix** (`2cf8461c`) reads the sidecar
through `manifestFromCsv`.
**The owner's free restore, run 50 (36466791459, 18:40–18:41 UTC), put `8btpep`
back**: every route answers 200 at it, `/gallery` is a real page again, the menus
and the five stored pages equal the before-read byte for byte, `/the-starter`
301s to `/starter` again (the version's own staged map), and a real browser reads
the five pages as run 39 did at the same version; balance 45. **The owner closed
the removal (run 49) and the restoration (run 50)** (2026-09-28).
**THE FIX IS MERGED AND DEPLOYED at `f5e941f4`** (deploy 2165, 2026-09-28 19:07
UTC, image `8a10715339cdc780`, predicted on both ends and built). **Deployed, not
runtime-confirmed**: the session's one free dispatch at 19:24 UTC, after the
hold, answered **403** and was not retried, so the runtime check is the owner's
free press (from `main`, spend `no`, `expect_deploy`
`f5e941f494fd96c039eeee4e6f1d44120b80e062`, `expect_image`
`8a10715339cdc780`). **It carries the mappings a sidecar holds from now on
and reconstructs none**: a redirect dropped between 2026-08-17 and deploy 2165
stays lost, and the next real publish is the first live exercise of it. The lost
redirects, the QR code that still points at a removed page, and the bare
not-found text on Start sites are three separate Backlog items.
**Test 6, two changes in one message on a named page, is PREPARED (2026-09-28;
nothing paid)** on fold-lane-bakery, through the existing `edit canary`. **The
request was clarified before freezing** (owner: *"change the site's default
search description while keeping existing page-specific descriptions
unchanged, then move the named band on Visit only. Record that exact
sentence"*), because the Visit page has a description of its own:
*Change the site's default search description, the one Google shows, to
"Overnight sourdough from a Bristol side street, baked every morning and ready
to collect at the counter." Where a page has its own description, leave that
description as it is. Then, on the Visit page only, put the "Order a collection
so we hold a loaf" band above "Come to the bakery".* (358 characters, ASCII,
sha256 `484b3febf7e0fe13632585045e93d14e33020486eda4dbbd170b2d480a44f734`; the
first draft, `f894d3e4…`, is superseded). **Acceptance is judged on the stored
and published changes, not the lane names**: the description stored in the
site's settings and served on `/` and `/starter`, the three pages' own
descriptions unchanged, `visit.tsx` exactly the swap, the other four pages, all
menus and every head tag unchanged, and `/the-starter` still 301 to `/starter`.
The free restore to `8btpep` must then show the original head, pages, menus and
stored description. **The reply's omission of the Visit move is the known item
(review #9), judged separately.** It covers mixed work through the look door
only; **real-model mixed work through the removal door stays outstanding**.
**One measurement was missing and is added on the branch**: nothing the canary
recorded showed the description stored in the site's settings (the stored
reply names the field, `moved: ["description"]`, never the value), so its
inventory now reads the app's own SEO route (`GET /api/site/<slug>/seo`, owner
only, read-only) through `readStoredHead` (`scripts/canary-watch.mjs`), and
the presses are from the branch. About 5–6 credits, up to about 10. The plan,
the exact before and after, and the outcomes decided in advance are the
checklist's *Test 6*.

> **Read `docs/owner-notes.md` at the start of every session** — the owner's
> running log and how they like things done. Keep it updated.
>
> **PRUNED 2026-09-20 (owner: "clean up claude md, it has 13,000 lines").** It
> was **15,657 lines / 1,044,962 bytes and is 3,721 / 252,392 — 11,936 lines
> deleted, 76.2%** — and this is the **fifth** prune: 3,786 → (2026-08-28) →
> 10,004 → (09-09) 3,808 → 7,883 → (09-11) 3,933 → 7,615 → (09-14) 3,157 →
> **15,657** → now. Each time the file grows back the same way: by accreting
> the STORY of every shipped change beside its law. **The totals are the file
> as it stands, measured after the assembly rather than estimated before it.**
>
> **What went this time, and the rule that decided it: a fact that is true
> today belongs here; a story about how it got true belongs in git.** The
> section "Editing a site — the ladder" was **10,326 lines — 66% of the whole
> file — across 74 dated milestone narratives**, every one of them the account
> of a change that has already shipped. It is a few hundred lines now, and
> **every rule and every measured number in it is carried across**; only the
> narrative is gone. `THE TRAPS`, `Working rules`, `Structure`, `How a site
> gets built` and `Data, auth, payments, mail` are kept **verbatim** — they
> were already law.
>
> **Checked before cutting, not assumed: NOTHING reads this file from disk.**
> Every `CLAUDE.md` hit in the tree is a comment referring to it. The control
> that proves that check is alive: `docs/owner-notes.md` **is** parsed, by
> `test/brand-rename.test.mjs` and `test/media-deleted.test.mjs`, for its
> "Names that must not be renamed" table — so that file cannot be pruned this
> way and this one can.
>
> **The full record is in git: `git show d304120e:CLAUDE.md`** — every entry,
> every sweep tally, every live-deploy record, 2026-09-14 to 2026-09-20.
> Earlier ones: `git show a4d0f5e5:CLAUDE.md`, `6393b134`, `7104c87b`,
> `5cfd4e58`.
>
> **Keep it this way.** Add an entry when a decision is made or a trap is
> found; when an entry becomes history rather than law, cut it.
>
> **AND WHEN AN ENTRY IS COMPRESSED RATHER THAN CUT, KEEP THE NUMBERS.** A
> measurement is the one part of a shipped entry that stays law: the timings,
> the arithmetic that closed, the bounds and the flag defaults are what the
> next decision is made from, and re-deriving one costs a paid build.

---
