# Owner Notes

Kept for the owner. Two purposes:
1. **How you like things done** — durable preferences, so a fresh session does not
   have to relearn them.
2. **What is open** — bugs, decisions waiting on you, and gaps worth knowing about.

**Read this at the start of every session.** Add a preference line whenever the
owner signals one; move an item out of Open the moment it is resolved.

> **PRUNED 2026-08-28, your call: "they are really big, delete whats old and we
> dont need anymore."** This file had grown to 19,091 lines — a day-by-day diary
> going back to 2026-07-20, most of it describing code that no longer exists (the
> original builder, deleted 2026-07-27; the D1 backend and its 93-item roadmap;
> the hand-built auth layer, deleted 2026-07-30; our own data API, deleted the
> same day). What is here now is what is still TRUE and still OPEN.
>
> **Nothing is lost.** The complete diary is in git: `git show
> ebfa7192:docs/owner-notes.md`. Same for the engineering log: `git show
> 6393b134:CLAUDE.md`.
>
> **PRUNED AGAIN 2026-09-09, your call: "clean up the md files, they are big" →
> "I mean to delete old stuff".** It had grown back to 5,967 lines. **3,056 were
> deleted and nothing was rewritten** — the whole day-by-day diary from
> 2026-09-01 to 2026-09-06 cut out, not condensed: the lane sweeps, the addon
> runs, the nine job-runner stages, the QR and backend rounds. Every one of them
> describes work that is finished and live. **It is all in git: `git show
> 7104c87b:docs/owner-notes.md`.** What is left is how you like things done,
> what is open, and the last few days.

---

## How you like things done

**Communication**
- **Plain English, not jargon.** Walk things layer by layer when touring the code.
- **Show UI changes as screenshots** — you review visually. Render it and send it.
- **Say plainly what is proven and what is not.** Every claim gets "proven live"
  or "NOT proven live". Corrections get written down, not quietly fixed.
- **One thing at a time.** You prefer reviewing and fixing bugs one by one over
  big batches.

**Changes**
- **Small and surgical** — do not restyle or refactor beyond what was asked.
- **"If we are not using it, I don't want it on the code."** Dead code goes.
- When you narrow a job mid-change, the scope is exactly what you named.
- **Desktop-first, no mobile** — *"I'm not preparing my app to be mobile friendly
  honestly."* Do not build or pitch mobile layout work unless you re-open it.
- Bulk or destructive operations **dry-run by default**.

**Money**
- **Never spend credits without asking.** Not on a test build, not on a retry.
- **Never auto-retry a failed build** — *"we should not spend your credits for
  you."* You can always ask again.
- Paid builds are **opt-in by a commit-message marker**, so no push can buy one
  by accident.
- **Documentation-only changes must not deploy** and must not buy a test build.
- **Do not raise the free-credit grant to paper over a shortfall** — *"Use my
  account, don't raise the credit thing."*
- Batch fixes into one live run. Six runs in a night drains the account faster
  than a day of real customers.
- Diagnose from the code before spending a run — *"you said to work it out
  first."*
- You delete leftover test sites yourself.

**How the model should be instructed**
- **"I just want the model to write its own css cmon, lets make it no name."**
  No menus, no enums, no named options where the model can author instead.
- **Delete worked examples; state only the purpose.** A worked example is the one
  thing a model reliably copies — two features shipped verbatim copies of ours.
- **"When in doubt, say less to the model."** Three drafts of the attachment note
  each got shorter and each got better.
- **"Don't invent something the customer hasn't asked for — invent something that
  is related to what the customer wants."** An invented detail stays inside the
  brief.
- **A cap the model is only told about is not a cap.** Enforce it in code.
- **An edit is measured against what was asked.** *"If the user wants one thing,
  you change one thing. If the user wants three, you change three… do not change
  something that the user hasn't told you to change."* And each change reaches
  only as far as the ask did — restyling one button is a rule for that button,
  not a new site-wide colour that happens to repaint it.
- **Editing the look is FREE CSS, not a theme picker.** *"Instead of it being a
  specific theme, it's free css — the model can edit anything on the page."*
  Nothing on the page is out of reach of a rule. The freedom and the ceiling are
  one instruction, never separated: anything may change, only what was asked
  does.
- **"They gotta be smart with the questions, not all the time."**
- **"I just want it treated normal, like an attachment — the user will say what he
  wants that for, it's part of the conversation."**

**Product direction**
- **"For edit it should be able to edit literally everything"** it can build — and
  **an edit changes exactly what was asked for and nothing else.** Absent means
  unchanged, never restated.
- **Cost follows the change, not the pipeline.** When asked whether two things
  should be one: do they differ in what somebody DECIDES, or only in how it is
  carried out? Only the first justifies two paths.
- **"The whole site can't not go live if one step breaks — if one step breaks it's
  gotta ship like that, however it is."**
- **"If I close the app the build is still running."**
- **Frontend first**: a first build designs and writes a site; the backend comes
  when editing or when an addon asks for it.
- **"It's gotta be more universal stuff"** — prefer a universal law over a one-off
  patch.
- **Everything is chatbox-driven.** Studio and the video editor were dropped:
  *"pure AI, drop it all."*
- **Rejected a picker** in favour of just attaching the file and saying what it
  is: *"Hey, this is my logo, put it there."*
- **Existing published sites are left alone** — never sweep-rebuild them. A
  rebuild costs credits and re-rolls the customer's page copy.
- **No arbitrary HTML in the head.** Every website builder offers "paste anything
  into your head" and every one of them is a way to get a site hacked.

**The media product (gofarther.dev)**
- **Never name the provider to a user.** "fal" is an implementation detail; error
  bodies and UI copy say what went wrong, never who we bought it from.
- **The chatbox settings are authoritative** — *"the orchestrator has no power to
  change anything that's set on the chatbox."* A generation runs with exactly what
  the toggles show. The director's words never silently change a setting or a
  price. Sound was the one exception and was removed on all three layers.
- **"Make sure you show users the exact error."** The provider's own detail is
  quoted verbatim — *(exact error: "duration: must be one of 4s, 6s, 8s")* — not
  bucketed into a canned line. Quota and balance messages stay clean, because
  there is no useful upstream detail there.
- **A platform failure is never blamed on the user**, and a failed render always
  refunds.
- **Caps are not printed in the UI** — the app rejects loudly with the reason
  instead. A number in a tooltip goes stale; a refusal cannot.
- **Verify a model's limits against the provider's machine schema, never its docs
  page.** The docs have been wrong; the schema is what the API enforces.
- **Only chat-generated media belongs in the Gallery.**
- **Users think in verbs** — "Edit image", not "Image to image".
- **Grids scale by adding columns, never by growing cards.**
- **Skip the Media Agent** in click-throughs and sweeps unless it is the subject.

**Working discipline**
- **Work on the designated branch**, not main directly. `git push origin
  HEAD:<branch>` is the only form that cannot push the wrong commit, and `git log
  --oneline -1 origin/<branch>` is the only proof — the push output is not.
- **A green merge is not a green deploy.** Confirm the deploy run succeeded before
  testing anything live.
- **Never write GitHub's own skip-CI marker anywhere** — not in a commit message,
  not in a PR body, not while explaining it. It silently suppresses every
  workflow: main moves, nothing deploys, and there is no red run to notice. Done
  twice, both times inside prose about the rule itself. Say "the skip-CI marker".
- **Never commit while a mutation sweep is running** — an interrupted sweep leaves
  a live mutant in the tree.
- **Do NOT edit these notes with `perl -0pi` and a unicode `\x{…}` literal** — it
  re-encodes the file as latin1 and mojibakes every dash and emoji. Use the Edit
  tool for prose.
- **Render and look before shipping** — *"keep me updated with render stuff."*
  Several bugs were found only by opening a PNG, never by a passing test.
- **Do not change the highest-leverage prompt in the middle of a run you are
  trying to read.**

---

## 2026-09-12 — Stage 4: the last of the video side swept out

The fourth and last stage. Nothing of the builder changed; this was clearing out
what three stages of deleting left behind.

**93 files and 12,453 lines went, most of it weight rather than code.** The big
one was a folder called `demo-hero-2` — a frozen copy of the whole old video app,
672 KB, kept months ago as a reference and blocked from being served. It still
named the image provider and still pointed at the live backend, so with the real
thing deleted there was no reason to keep a museum piece of it.

Also out: 2 MB of avatar-builder parts, 3.6 MB of login-screen background videos
nothing had pointed at in months, two badge images, the watermark image, a
leftover test workflow for burning watermarks into video, and the Media Agent's
own document.

**A key we were handing the server on every deploy and nobody was reading.** The
Media Agent's Instagram/YouTube credential (Composio) was still being uploaded to
the Worker after the code that used it was gone. I checked every file we ship
before removing it — zero readers. The key itself is still sitting in your GitHub
settings; deleting it there is your call and costs nothing either way. There is
now a check that every credential we upload is read by something, so the next one
like this fails the moment somebody adds it.

**A watermark that was being painted over screens that no longer exist.** Free
accounts used to get a "✦ gofarther.dev" mark over video players. That code was
still running on every credits check, looking for chat bubbles, gallery cards and
a lightbox that all went in stage 2b. Gone. **Your membership and credits are
untouched** — I specifically counted the places that read whether an account is
paid (the account badge, the free-credits pop-up, the plan pill on the start
screen) and added a check that keeps all three.

**And deleting that old copy exposed a test that had been passing for the wrong
reason.** One check makes sure a database migration never revokes access to
tables the browser reads directly. It proved it was still working by finding at
least two such tables — and the app's three had been deleted in stage 2b. It kept
passing only because the frozen copy still mentioned two of them. It failed the
hour that copy went. Fixed properly: it now proves it is reading the files rather
than counting what it found, and re-arms itself if we ever add a direct read back.

**Two things I did NOT do, both on purpose:**

1. **The landing page's copy.** It still has the video/audio channel selector, the
   list of AI models and the "generate or build" line. You direct design, so
   rewriting it is your call rather than mine — it works as it is, and both doors
   on it open the builder.
2. **The dead stylesheet.** `styles.css` is 476 KB and roughly 40% of its rules
   can no longer match anything. I measured it carefully and stopped, because the
   tool I'd need to do it safely still gets some answers wrong — some class names
   are built in code rather than written out, so they look unused when they are
   not. Cutting on a scan like that risks breaking screens you'd only see later.
   The measurements are written down so it can be picked up properly, and it is
   worth doing: it would be the biggest single speed-up left on first page load.

**Proof the builder still works.** The container test — the one that actually
compiles and renders a real site — ran green on the deletion's own tree for the
first time, all twenty steps, about twenty minutes. Stages 2a, 2b and 3 had each
moved thousands of lines of the Worker without that test ever firing, because its
trigger list had gone stale; that was fixed just before this stage, and this is
the run that proves it.

Full test suite 6,086, all green. Mutation sweep 13 of 13 caught.

**Still outstanding, and it needs your word:** deleting customers' stored video
and image files. That is the one part that cannot be undone, so I have not
touched it and will ask again explicitly.

## 2026-09-12 — Stage 3: the server side of the video half is gone too

You said *"go on stage 3"*, so the endpoints those deleted screens used to call
are out: **2,781 more lines of the Worker** and **25 addresses** — the gallery,
the storage meter, the twelve Instagram/YouTube endpoints, the Media Agent, the
director, cancel, refund, import-from-link, save, the media token and its proxy,
and the video poller. The Worker answered 61 addresses before any of this
started and answers 30 now.

**Your sites' photographs still work and I checked it rather than assumed it.**
That one fal call is the thing you asked me to leave, and it runs on the server
and downloads the picture into our own storage, so it shares nothing with the
road I deleted.

**One thing I fixed that you did not ask for, and I want to flag it.** There is
a standing rule of yours that a customer must never see the word "fal". The
scrubber that enforced it only ever guarded the director's error messages — the
part that is going — and the one fal call left over does put the provider's own
words into data we send the browser. Nothing was leaking (the sentence a
customer reads never quotes it), but the wall was pointing at the wrong door. It
points at the right one now. It is eight lines and I would rather have it than
have to remember.

**Two real bugs came out of this that nothing would have caught otherwise.**

1. **I nearly broke every background task on the platform.** Deleting the Media
   Agent left one line still calling it, in the two-minute timer that also runs
   your sites' scheduled jobs, the nightly backups, the domain setup, the
   webhooks and four sweeps. A timer that throws throws into nothing — no
   customer request fails, nothing goes red — so all of it would have simply
   stopped. One of your own tests caught it because it is the only test that
   actually RUNS that timer, which is luck rather than coverage. So I taught the
   checker that reads the browser files for this exact mistake to read the server
   file too.

2. **It immediately found a second one, in code nobody had touched.** The edit
   path's delete branches call a function that only exists in the browser — two
   places, both of which would have crashed. That is part of the delete work
   that has not run live yet, which is the only reason no customer met it. Fixed
   and driven.

**And one of your tests had been checking the wrong thing for three weeks.** The
guard that keeps the design step's look field honest was proving itself alive by
matching a voice-tuning dial in the *director's* tool — a completely different
thing that happened to be spelled the same way. It passed, so nobody looked.
Deleting the media side is what made it fail. It reads the real field now.

**What is left:** stage 4 sweeps the dead CSS (`styles.css` is 478 KB), the
landing page's own copy, the Media Agent's doc, one workflow and one secret we
still upload for code that no longer exists. **Your customers' stored media is
still a separate step and I will ask again before touching it.**

## 2026-09-12 — The video side is gone from the app, and home is the builder

You said *"yeah thats right, home is the builder now, keep going"*, so that is
what it is. Opening `gofarther.dev` now lands you straight on your sites and the
box that starts a new one. There is no composer, no Gallery, no Avatar, no Media
Agent, and no chat sidebar.

**Two commits.** The first took the video, image and voice generation out of the
server — the three endpoints, every model and price table, the code that
measured how long an uploaded clip was, and six old pricing test scripts:
1,370 lines. The second took the browser side out: 8,255 lines of `public/chat.js`
(17,453 → 9,219), the whole composer and every screen that only the media side
used, plus the in-browser video editor and its 11 MB of vendored code.

**Why it had to be two and not four.** I had planned the server and the browser
as separate commits. Three of your own tests would not allow it: they check that
every address the browser calls is an address the server answers. Take the
endpoints out and the browser is still calling them; take the callers out and the
endpoints have no caller. So I pushed the server half with those three failing
and the message saying exactly which three and why, then finished the browser
half. They are green now — **6,074 tests, all passing**.

**What did NOT change**, and I checked rather than assumed:
- **Your sites' photographs.** The builder buys those down a different road from
  the one I deleted, and it prices them from a different file.
- **Credits and memberships.** Untouched, both ends.
- **Sign-in, Settings, the whole builder.**

**Three things I had to decide, all named so you can overrule them:**
1. **The fal balance no longer gates anything.** There used to be a check that
   refused a video render when the fal account was under $0.50. It lived on the
   endpoints I deleted, and it never covered your sites' photographs. The
   diagnostic route still reads the balance and now says what the reading means —
   empty means every photograph comes back a placeholder. Say the word if you
   want a real check in front of a build buying pictures.
2. **The account badge says "Member", not "Plus"/"Pro"/"Max".** The tier name
   came off the gallery's storage endpoint, which is going. Putting the name back
   means adding it to the credits answer, which is where it belongs — a small
   job, your call.
3. **The landing page is untouched, deliberately.** It still has the channel
   selector with Video/Audio channels, the pipeline listing every AI model, and a
   prompt line that alternates between "generate" and "build". Rewriting that is
   a design job and you direct design, so I left it working: the channels that
   used to open the studio now open the builder, and the tables the pipeline
   reads are kept with a note saying why. It is the last piece of the media side
   still standing.

**Correction to a number in this entry:** I wrote "6,074 tests" above and the
run said **6,078**. Nothing was wrong with the code — the count was typed from
memory instead of read off the run, which is exactly the thing this file says
not to do.

**Still to do:** stage 3 takes the server routes those deleted screens used to
call (gallery, save, import, the director, the Media Agent, the social
connections, the avatar, memory), and stage 4 sweeps the dead CSS — `styles.css`
is 478 KB and a lot of it now styles nothing. **The customers' stored media is
still a separate step and I will ask again before touching it.**

## 2026-09-11 — Each section of a page is its own file now, and the Code tab shows the whole project

You held up Lovable's file explorer next to ours and said **"their stuff is
files organized ours is all on one file"**, and then **"we do have a favicon but
it doesnt show in the code tab"**. Both were true. Neither was what it looked
like.

**The one-file part was one line of our own code.** When a page is written by
several agents at once — which is how every page is written now — each agent
writes a complete, self-contained section. They arrive as separate things. The
very last step took all of them and **glued them into one file** before anything
else saw them. Nothing about the models, the prompts or the design forced that;
it was a decision made when the split was new and never revisited.

So now each section is written to its own file, at `src/routes/-parts/`, and the
page file keeps what is genuinely the page: the route and the frame the sections
sit in. **Nothing new is generated and nothing costs more** — the same answers,
written to the right number of files instead of one.

A nice side effect: two sections that both wanted the same import used to
collide inside the shared file, which is what killed a build back in run 90.
They can't meet any more.

**The favicon was never missing.** It has been stored with every build since the
day the design step started drawing one, and it is served on every live site — I
checked yours, it's 278 bytes and answering fine. **The Code tab just never
looked at it.** That pane only ever asked for pages; the icon, the wordmark, the
QR codes and the stylesheet all live one drawer over, and nobody had opened it.

**So the Code tab now shows the project.** Four groups, in the order you'd read
them: **Pages**, then **Components** (the new section files), then **Assets**
(the favicon, the wordmark, the QR codes, the site's stylesheet), then **Shared**
— the 18 files every site is built from, marked as shared so it is obvious which
half is yours and which half is the platform's. The kit is deliberately not in
there: 3,394 files nobody asked for.

**And the tree, the Download button and the file count now agree.** They were
three separate opinions about what a project contains, and they disagreed. Same
list, same paths, same names, all three — checked by opening the actual zip.

**The part that mattered most isn't visible at all.** Splitting the sections into
files would have quietly broken editing: the cheap rung that changes wording only
ever read the page file, so the moment the words moved into section files, **every
wording change would have fallen through to the expensive full rewrite** — about
one credit becoming twenty-five, every time, silently. That's fixed in the same
change: the edit path now sees the page and its sections as one list. Driven and
proven: an edit reached two separated sections and changed both.

**Proven, on a real generated site**: six sections in six files, `vite` built it
(2,094 modules), the typechecker passed, none of the section files leaked out as
a public page, and the favicon showed up in both the tree and the download.

**And the deliberate-sabotage pass found ten holes — in my own testing, not in
the code.** I break the code on purpose, one small change at a time, and check
that a test notices. Ten changes went unnoticed: nine were things I had built
correctly and never actually tested (the read-only label, the note under the
stylesheet, the file counter, an uploaded logo being shown as a file it isn't,
and so on), and one was a test I'd written so short it couldn't tell right from
wrong. All ten now have a real test behind them. **One of the ten was the
sabotage tool itself** — it had a bug that would have made every future run
report a clean pass while testing nothing at all. Fixed first, before anything
else was trusted.

**Here is what it looks like** — `docs/edits/code-tab-project-tree.png`, a
nine-section site with the four groups down the left.

**Not proven live** — this needs the deploy, and because it touches the Worker
the container rolls, so the usual 15–20 minute wait applies before firing
anything.

**One thing I did not fix, and it's a small step down rather than a break.** The
rung that makes little layout tweaks still finds pages by their web address, so
on a split site a layout tweak falls to the next rung up — roughly 1 credit
becoming 1–3. Wording, colours, pictures, links and the rest are unaffected.
Worth doing, not worth bundling into this.

---

## 2026-09-10 — The build now records enough to answer the question you asked

You said **"lets fix that"** about the two things I could not tell you after the
Millbrook build. Both are fixed. Nothing a customer sees changes; what changes is
what the build writes down about itself.

**The first problem: the page half left no trace at all.** The design step has
always stamped "I split this" into the record. The page step stamped nothing — so
a page written in eight pieces at once and a page written in one go looked
*identical* afterwards. There was one line in the code that mentioned it, and it
only ran in the case where the split was *refused*, which is the case nobody
hits. So I genuinely could not tell you whether your page had been written in
pieces. Now the build writes a `bands` step, and it carries two numbers: how many
pieces were asked for, and how many came back. **The step only exists on a split
build**, so its presence is the answer. And if the two numbers differ, that is a
page missing a section — which used to look exactly like a clean build.

**The second problem: one number cannot answer "did it overlap".** The design
step recorded how long it took, and nothing else. The whole point of running four
agents side by side is that they overlap — but the only way to see that from one
number is to compare it against other builds, and I now have seven of those,
running from 131 seconds to 252. The gap between ordinary builds is *bigger than
any saving the split could produce*, so that comparison can never settle
anything. That is not a measurement problem I can fix by doing more runs.

**What I did instead: two numbers that answer it from a single build.** One adds
up how long each agent's own call took. The other adds up how long each *wave*
took on the wall clock. If four agents really run side by side, the first number
is much bigger than the second, and **the difference is the overlap, in
milliseconds.** If they're equal, nothing overlapped. No second build needed, no
comparison, nothing to explain away. The stopwatch for the agent half was already
being taken — the code was throwing it away.

**A third thing turned up while I was doing it, and it is older than either
split.** Every one of these little notes the build writes goes through one small
piece of plumbing, and that plumbing was **dropping the numbers and keeping only
the name.** It has done that since the day it was written. I found it by reading
the actual database rather than the code: eight stored builds, and the step that
is supposed to record how the pictures were made carries no such number on a
single one of them. Nothing ever failed, nothing was logged — three tests
confirmed the code *asked* for the number, and no test ever confirmed it
*arrived*. My new `bands` numbers would have vanished the same way. Fixed, and it
brings the older one back to life at the same time.

**Something I want to flag because it went right.** There is a check in this
project that walks every note a build writes and demands each one have a stage
attached — so that if a build times out, you get told the truthful thing about
how far it got. My new `bands` note had no stage, and that check went red *just
by the note existing*. Nobody had to remember to add it. It reads as "generate"
now — deliberately the cautious side, because the note also fires on a build
where every piece failed and there is no page at all.

**And three older tests went red for this change.** All three were pinned to
exactly how a line was written rather than to what it has to do. One of them was
the same trap this project has hit twice before: a test that reads a fixed number
of characters of the code, which my new explanatory comment pushed past — so it
reported a working thing as broken. Re-anchored properly, all three, with a note
saying which spelling moved and why.

31 mutation tests, all 31 caught, three do-nothing controls untouched. Full test
suite 5,850, green.

**Not live yet, and this one rolls the container** — so give it 15–20 minutes
after the deploy before firing a build that needs it. The proof is one build:
the design step should carry both new numbers, there should be a `bands` step,
and the pictures step should carry its number for the first time ever.

**One correction, from the review below:** that last item — the pictures number —
was going to come back WRONG. See the next entry.

---

## 2026-09-10 — You asked me to check my own work, and it found one I'd broken

You said **"now go check your work"**, then **"read only"**, then **"double check
and fix"**. All three were right, in that order.

**What the check was.** Seven independent reviewers over the change I'd just
merged, each looking through a different lens taken from this project's own list
of traps — is anything computed and never forwarded, is the new number actually
measuring what it claims, can the new tests actually fail, are the search windows
sound, what else did the change touch, does the clock hold up, do the numbers in
the notes match the code. Nineteen findings. Every one then went to three
skeptics whose *job* was to knock it down, because a false alarm here is worse
than a miss. Fourteen got knocked down. Two survived — and they were the same
thing, found independently by two lenses that never spoke to each other.

**And your "read only" caught a real risk.** My first version let a reviewer make
a temporary edit and undo it. Seven of them running at once, one dies mid-edit,
and the change is sitting in the code with nobody to undo it — this project has
that exact accident written down already. I stopped it, checked nothing had been
touched, and re-ran it under a hard rule: nothing may be written anywhere. What
it does instead is better — it loads a file into memory *as text*, makes the
change there, and runs the test's own search against it. Same answer, nothing
touched.

**What it found.** This morning's fix brought a dead field back to life — the one
that records whether your pictures were made in the container or in the Worker.
It had been thrown away since the day it was written. **It started saving, and on
an ordinary build it started saving the wrong answer**: "the Worker did it", about
exactly the builds the container did. Then the one thing that reads it falls back
to that field *precisely* on those builds. Driven end to end, it printed
`gen=worker` where the truth was `container`. Before my change it printed nothing.

Silence turned into a wrong answer, which is the worse of the two — and the
sharpest part is that my own promise to you was *"the pictures step will carry its
number for the first time."* It would have. I'd have read it back to you as a win.

**Two fixes.** First, the wall: if we don't know which side did it, the field is
now simply absent instead of guessing — which is what three other places in the
same file already do. Second, the truth: a collected answer can only have come
from the container, because that's the only way it gets collected. So the
collector says so. `gen=worker` → `gen=container`, with the other two readings
untouched.

**Two of my own comments were also just wrong**, and arithmetic proves it: I'd
written that a broken design "reads as fewer agents than waves". The waves are
1, 2, 1 — so a *finished* design reads 4 against 3, and one that broke in the
middle reads 3 against 3. My rule of thumb worked for one case in three.

**Two older tests went red doing their jobs**, and one of my new ones was broken.
A test that reads a fixed number of characters of the code got outrun by my own
new comment — this project's most-repeated mistake, now fixed properly. A
head-count test refused to let two new fields appear on a reply without me saying
out loud that I meant them. And one test I wrote to check a comment was searching
a copy of the file with all the comments stripped out, so it could never fail —
I only found that by breaking the thing deliberately and watching the test pass
anyway.

15 mutation tests, 14 caught; the one that survived was measured and proved
harmless rather than assumed, then swapped for one that isn't — which was caught.
Both do-nothing controls untouched. Full suite **5,854**, green.

**The proof list for your build changes by one line**: the pictures step should
now read **container**, not "for the first time" — that part was already true and
already wrong.

---

## 2026-09-10 — Both splits are switched on, for your account only

You said **"switch it on"**. Both are on now — the design step answered by
several agents at once, and the page written a band at a time — and **only for
your account**. Every customer on the platform still gets the single design call
and the single page call, exactly as they have for months. The wide switches
(`*_EVERYONE`) stay off; those are a separate decision and a bigger one.

**How it is switched on: your account id, in both places.** Both doors take
either an account or a site. The design one can only take an account — it is
asked before the design call runs, and on a first build the site's name is one of
the things that call decides, so a site name there could never match. And naming
`fretwork-1` for the page half would have split that one site's edits while every
NEW build still wrote its page in one go — half on, which is the worst state to
read a trace of. So it is one value in both: `22175f41-…-a65078a0141c`, the
account that owns all 54 of your sites.

**It lives in the deploy file, not in a GitHub secret**, because a session cannot
set a repository secret — the job-runner canary has named `fretwork-1` the same
way since 2026-09-06. **A secret still beats it**, so if you ever want either
split off without waiting for me: set `BAND_SPLIT_CANARY` or
`DESIGN_SPLIT_CANARY` to `-` in GitHub's secrets and redeploy.

**Two of my own guards went red for this and I re-anchored them, not silenced
them.** Each said "the default is `-`", which was a spelling, not the point. The
point is that a default — what ships when nobody has set a secret — may open a
door to exactly ONE named identity and never further. Both now read the real
value out of the deploy file and try the door with it: one identity, not two, not
the whole platform, and a stranger still gets the old path.

**And one of the new checks was wrong the first time it ran.** I asserted that
your account id handed in as a site name would be refused. It is not — the door
tests its list against both, so it matches either way. The check went red against
code that was correct, which is the failure I care about most, so I deleted the
claim rather than reword it.

**What you should see: nothing, on the site.** A split build and a single-call
build publish the same page to the same address. What changes is how long the
build takes, and I have not measured that and will not guess. **The next build
you make is the measurement.**

**It is deployed and I read the proof I could.** Deploy 2071 went green in **55
seconds** — the fastest since the image-skip work, because nothing an image is
built from changed: both containers reported "no changes", so nothing rolled and
there is no 15–20 minute wait this time. The deploy's own log lists both canaries
carrying your account id and both wide switches `off`, all four uploaded to the
live Worker. That is the same evidence that proved the doors shut yesterday, read
the same way.

**What I could not confirm from here.** The cleanest proof is opening
`/api/site/runtime?slug=<any of your sites>` while signed in and seeing
`design: true` and `bands: true`. That needs your session; there is no key in
this environment to sign in with.

**And I cannot fire the test build either — you have to.** GitHub refuses this
session permission to start a workflow (403), which is the same wall recorded a
week ago. **Easiest path: just build a site in the app the way a customer
would** — type a brief on the start screen and send it. That runs on your
account, so both splits are on. (The other way is the `build as owner` workflow
with mode `build`.)

**I pulled the "before" numbers first, free, so the run actually means
something.** Your last five first builds, all of them single-call:

| build | design step | compile + page |
|---|---|---|
| hartleys-barbers | 197s | 74s |
| hearth-paper | 131s | 74s |
| plyhouse | 192s | 210s |
| fretwork-1 | 170s | 355s |
| coalhole-2 | 175s | 94s |

So **the design step is 131–197 seconds today** — that is the number the split
has to beat, and it is now measured rather than quoted.

**One honest warning about reading the result.** The design half should show
plainly: it is one number against a fairly tight band. **The page half will
not.** That column above runs 74s to 355s across five builds of the same kind —
nearly five times — so a single fast run proves nothing about the band split,
and I will say so rather than claim a win. What I *can* confirm from one run,
exactly, is whether each split actually ran: the build's own trace records the
design step as four agents in three rounds when it splits, and records nothing
when it does not. I will read that first and the stopwatch second.

---

## 2026-09-10 — The design step is split too, and that switch is also off

You said *"ok now split the design step"* → *"ok go"*. It is built, wired end to
end, and **nothing on the platform behaves differently today**, because the
switch that turns it on names nobody. Same shape as the page split above.
**(Superseded the same day — see the entry above: you switched both on.)**

**What the design step is.** One model call that answers 22 questions about the
site — its name, its address, what it is for, what pages it has, which kit parts
it is built from, how the page is laid out, its theme, its stylesheet, the logo,
the tab icon, what each button does. It answers them in a fixed order and each
answer can see the ones before it, so the whole thing is one long write.
Measured at about 170 seconds.

**What it is now, behind the switch.** Three rounds, and inside a round the
agents work at the same time:

1. **identity** — the name, the address, the one-line description, what kind of
   site it is, the language, the one action the site most wants done.
2. **plan** and **look**, side by side. The plan is the pages, the kit parts and
   the layout. The look is the theme, the stylesheet and the two drawn marks.
3. **detail** — anything the kit could not do, and what each control does.

**Why those three and not some other three.** I tried the obvious thing first
and it does not work: read each question's own text, find where it mentions
another question, and sort by that. What comes out is a **circle** — the parts
question mentions the theme, the theme mentions the stylesheet, the stylesheet
mentions the parts — because a mention is not the same as a dependency. A
question names another to say "that was already decided", or "don't repeat it",
or "this is what will read your answer", and those are three different things
that look identical. So the rounds are the dependencies the step actually states
as reasons: everything about the plan depends on what kind of site it is; the
"anything the kit can't do" question is asked by a model that has just searched
the kit; a control can't be described before the page that holds it exists; the
marks draw the name; the stylesheet sits on top of the theme.

**Where the time actually is, and it is not the plan.** The logo and the tab
icon are DRAWN — the model writes the picture, which is slow. In the single call
those two sit in the queue with the plan, so the plan waits for them and they
wait for the plan. Putting them side by side in round 2 is most of what this
buys. **This corrects something I told you yesterday** — I said splitting the
design "loses". That was about the wrong half of the call.

**And I have to correct the number I used for it, same day.** I said run 41
measured 292 seconds for one drawn mark, as though that settled it. Run 41 is the
EDIT lane — one call, drawing one mark, on its own. The whole design call, all 22
questions with both marks inside, takes about 170 seconds. So the marks plainly
do not cost 292 seconds each in there, or it could never finish. 292 is the most
a drawn answer can cost, not what these two cost inside the design step, and
nothing has measured that. The reasoning still holds; the arithmetic I hung on it
did not.

**The second win is quieter and it is about size.** The parts question alone is
**32,603 characters** of the 64,076 a first build sends, because it carries the
whole menu of kit components. The look agent has no business with that menu and
no longer pays to be shown it. Per agent: identity 7,339 · plan 41,353 · look
11,058 · detail 4,836.

**What happens when one agent fails.** Three different failures, three different
sentences, because they need different reactions: an agent that ran out of room
gets "try describing fewer things"; an agent the provider refused carries the
provider's own error through, so "they're overloaded, try again" stays different
from "we sent something wrong"; and agents that simply answered nothing get the
same refusal a single call gets when the model declares nothing.

**One trade you should know about.** If an agent is lost, the design fails —
free, refunded, and it says why. The single call is looser: it hands a partial
answer straight on. I went the stricter way because of what the two mistakes
cost. A refused design costs nothing and can be asked again; a design that ships
with no page plan charges you for a site that isn't one. Your *"ship it as it
is"* rule was about a type error in a page that works, not about a design with a
hole in it. If a lost agent ever costs a real build, say so and I will loosen it.

**The switch.** `DESIGN_SPLIT_CANARY` in GitHub, and it names an **account**,
not a site — this runs before the site has an address, so a slug there could
never match. Free first step: set it to your account id, redeploy, then open
`/api/site/runtime?slug=<any site you own>` and check `design` says true. That
proves the setting reached the live Worker before a single credit is spent. The
build after that is the real proof and costs a build.

**Merged and deployed** (your *"ok merge"*). Tests green, main moved, **deploy
2070 green in 3 minutes**: the site container image was rebuilt and the container
rolled at 04:09Z, so anything that runs in a container was safe to fire from
about 04:29Z. The game container was untouched.

**And I checked the switch is really off on the LIVE Worker, not just in the
repository** — the deploy's own secret upload lists `DESIGN_SPLIT_CANARY: -` and
`DESIGN_SPLIT_EVERYONE: off`, beside the band split's two. Reading the workflow
file would only have told you the default; this is the deployment.

**Not proven live, and there is nothing to see until you open it.** Nothing about
any site changed today.

---

## 2026-09-10 — Writing a page in pieces, at the same time (half built, nothing live)

You asked whether the design step and the generate step really have to wait for
each other, and whether we could send several agents off at once. I looked at
both and came back with four options; you picked **A — split the page by band**.
Two pieces of it are now built. **Neither is switched on, and no build uses
them yet.** I am writing that down plainly because a piece of code nobody calls
is the mistake this project has made more than any other.

**Why the page and not the design.** The design step is one call that asks a
very long question — about 93,000 characters — and gets a short answer back.
That long question is cached, so asking it costs little time; splitting it into
five smaller calls would mean paying to send a question five times to save
almost nothing. The generate step is the opposite: a short question and a very
long answer, and it is the one that takes the time. We have measured it at
between five and a half and ten minutes, against the design step's under three.
**So the time is in the page, and the page is what I split.**

**How a page gets cut up.** It already is. The design step answers a field
called `shape`, which lists the page as an ordered set of bands — a hero, then
what you offer, then the prices, then the contact strip. Up to eight. Nobody
had to invent a way to divide a page; the plan has been describing one all
along and the generate step was gluing it back into a single request.

**Each band is written as its own small component.** I checked all 324 real
pages we have generated before deciding that, and the reason is boring and
important: real pages keep their moving parts at the top of the file, and there
is no way to know in advance which band will need one. Give each band its own
file and the question never comes up. The page itself then becomes a short list
of the bands in order, which is a thing we can write ourselves rather than ask
a model for.

**One bad band is not eight bad bands.** If we fired eight requests the obvious
way, the first one to fail would throw away the seven that worked — after we
had already paid for all eight. Each one now catches its own trouble, and a
band that fails is replaced with a placeholder while the rest of the page
publishes. That is the same rule the builder already follows elsewhere: a page
missing one strip beats no page at all.

**The container had to learn to hold several calls at once.** It was built to
do one thing at a time — deliberately, and it was right until today, because
nothing had ever needed two. So a split page is now **one job holding eight
calls**, which keeps every safety property the old single call had: the
container knows it is busy, so it is not shut down halfway; there is one id, so
memory stays bounded; there is one report at the end, so nothing downstream
changed.

**Something worth telling you about the testing.** Two of my checks passed on
code that was actually broken, because they were reading the code as text
rather than running it. A piece of error handling that quietly re-throws still
*looks* like error handling on the page. I moved that logic into its own small
file so the tests could genuinely run it, and both faults died immediately. It
is the same lesson this project keeps relearning: reading code proves less than
running it.

Also: two of my own tests were using real clocks and became unreliable under
load — they reported correct code as broken, which is worse than missing a
fault. Rewritten so they do not depend on timing.

**What one agent is now asked.** This is the third piece, and it is written. An
agent gets the brief, the site's name, and the whole page as a numbered list
with its own band marked — then four rules about how to write it. It is told
its neighbours are being written *right now by someone else*, so it does not
write the hero, does not repeat the prices and does not close the page. It is
never shown their code, because there isn't any yet: that is the whole point.

**The most valuable decision in it is one you would not see.** The long block of
rules that tells the model which components exist and what it may do — about
14,000 characters — is the *same block, character for character*, that the
normal one-call path already sends. That block is cached at the model provider,
so sharing it means eight agents read something that is already warm rather than
paying for it eight times. Writing a separate set of rules for bands would have
cost twice: a second copy of every rule to keep in step, and a cold start on
every build.

**Two things the mutation testing caught, and one of them was bigger than this
work.** The first was ordinary: nothing checked that the *brief* actually
reaches the agent. Delete it and every test still passed — an agent writing a
section for no business at all, from a prompt that still looked complete.

The second was a list. There is an old check here that makes sure no cheap step
quietly hardcodes which AI model it uses — it exists because one day last month
every cheap step on the platform was pinned to one provider, that provider
refused a bill, and the whole thing went down at once. **That check reads a
hand-written list of eight files. I measured it: there are eleven files it
should be reading.** Three had never been checked. None of them was actually
broken — but nothing was watching them, and that kind of gap is invisible,
because a check that isn't running produces nothing to notice. It works itself
out now: it finds the files by looking for the thing they do, so a file added
next month is covered without anyone remembering.

**What is left before this does anything.** Three things: the code that builds
the eight requests and puts the answers back together; a switch that chooses
between this and today's single-call path; and a real container test, which is
the only thing that can prove the container truly runs eight at once. **Until
that last one exists, no container has ever actually done this.**

---

## 2026-09-10 — The rest of it is built, and the switch is off

You said *"ok go build it"*, so the three things from the note above are done.
All of it is wired end to end and **nothing on the platform behaves differently
today**, because the switch that turns it on names nobody. That is deliberate,
and I will explain the switch last.

**The container really does run several calls at once — proven, not argued.**
This was the one thing I could not claim without an actual container, so the
container test suite got nine new checks and now reads **382 passing, 0
failing**. The check that settles it is a small trick: I sent three requests
that were all guaranteed to fail, and asked what came back. The naive way of
running things in parallel would have come back with **one** failure and thrown
the other two away. It came back with **three separate answers**, each knowing
which band it belonged to and carrying its own error message. That is a shape
the broken version cannot produce, so it is proof rather than a reading of the
code.

**The page is assembled and it compiles.** The end-to-end test runs four bands
where the answers deliberately arrive in the wrong order — third, first, second,
fourth — and one of the four fails outright. What comes out is a page with the
bands **in the order the design planned**, not the order they finished; the
failed band replaced by a placeholder; two bands that both wanted the same
component sharing one import instead of declaring it twice (that duplicate is
what broke a real build back in run 90); and the finished file handed to the
project's own TypeScript, which accepts it. That last part matters most — up to
here everything was a claim about text.

**The money did not change shape.** The split path hands back exactly the same
object the single call hands back, so the compiler step, the publish step and
the billing all see something they cannot tell apart. Eight calls' worth of
usage is added into one figure and rounded once, the way one call is rounded
once. Rounding eight times would have charged a minimum per band.

**One decision worth reading twice, because it protects a build in flight.** A
build fires the generation and walks away; another invocation picks the answer
up eight minutes later. In between, a deploy can happen — deploys take about
three minutes. So if the second invocation asked *the switch* which path to
take, it could get a different answer from the one that started the work. And
neither wrong answer would fail loudly: it would just quietly produce nothing,
or quietly replace every band with a placeholder. **So the second invocation
asks what it is actually holding** — a list of eight answers, or one answer —
and takes the path that matches. The switch is only ever asked at the start.

**If the container cannot take the split, the build writes the page the old
way.** Right after a deploy, the new container image rolls out over a minute or
two, and for that minute the old image is still answering. It does not know how
to take eight requests. Rather than fail those builds, the code notices that
particular refusal by name and quietly falls back to the single call — which is
exactly what every build does today anyway.

**Now the switch.** It works like the one for the job runner: name a site's slug
in a GitHub secret called `BAND_SPLIT_CANARY` and that site's next build splits;
a second secret can turn it on for everybody. **The default is `-`, which means
nobody.** The job runner's equivalent names your test site by default, because
it had been proven on it. This one has never written a live page, so it names
nobody until you say otherwise.

**And you can check the switch for free before spending anything.** The
diagnostic at `/api/site/runtime?slug=` now answers `bands: true/false` for your
own sites. That is worth having because a GitHub secret is a thing the code
cannot see: reading the workflow file tells you the default, not what is
actually deployed. So the order is: set the secret, redeploy, read that
endpoint, and only then buy a build.

**What is proven and what is not.** The container running several calls at once
is proven, on the real service. The assembly, the ordering, the failure handling
and the billing are proven by running them. **A real site built this way is
not** — nothing has been through it end to end, and it cannot be until you turn
the switch on. That is one build's worth of credits, and it is your call.

**Merged and deployed** (your "ok merge"). The test suite ran green on the exact
tree first — 83 seconds — then main moved to it and the deploy went out in
**3m27s**. The container image rebuilt (2m19s, most of it uploading one large
layer) and the build container **rolled at 02:54:08Z**, so the twenty-minute
wait before firing anything that builds ended around **03:14Z**.

**And I can confirm the switch is off on the live system, not just in the
code** — the deploy log lists `BAND_SPLIT_CANARY: -` and `BAND_SPLIT_EVERYONE:
off` among the twenty secrets it uploaded. That is exactly the thing reading the
config file cannot tell you.

**I got something wrong while watching that deploy and told you about it.**
GitHub's status API kept reporting the image step as still running long after it
had finished, and I reported a 32-minute hang — and went further and said the
deploy gate was holding customers' edits back for 45 minutes. Neither happened:
the step took 2m19s and the gate cleared normally. The signal that it was a
stale answer was sitting in the same response I was reading, in a timestamp I
did not check. Written down as a trap, because raising a false alarm is worse
here than missing something.

**One more thing on testing.** Four existing checks went red for this change and
every one of them was pointing at correct code — they were pinned to how a line
was *spelled* rather than what it had to be *true* about. One of them has now
been re-pointed three separate times for the same reason: it insists on the
exact shape of a message the builder sends to the container, so it complains
every time that message grows. Each was re-pointed at the actual property, with
a note saying which spelling moved, so the next session does not pin it back.

---

## 2026-09-09 — Every project has its own web address now

You held up Lovable's `lovable.dev/projects/a752aa91-…` and said *"or something
with id, look at lovable for example"* → *"build it"*. Done.

Open a site and the address bar now reads
`gofarther.dev/projects/site_1784380035480_w53jb`. The project list is
`gofarther.dev/projects`. Both are real addresses — paste one into another tab,
bookmark it, send it to someone with an account, and it opens that project.

**What it was before.** The whole app was one page. Every screen — the start
screen, a project's workspace, the gallery, settings — was a hidden block inside
it that got shown or hidden, and the address never changed from plain
`gofarther.dev`. So there was no way to link to a project, no way to have two of
them open in two tabs, and the browser's Back button took you out of the app
altogether instead of back a screen.

**We already had the id, we just weren't showing it.** The moment you type a
brief, the app makes a project id — `site_`, the time, and five random
characters — and it has been sending that id to the server on every call since
yesterday. This change puts it in the address bar.

**Why the id and not the site's name.** `gofarther.dev/projects/hartleys-barbers`
would read better, and I'd argue against it for two reasons. A site's name can
be changed — you have a rename lane for exactly that — so the address would move
under you and under anyone you'd already sent the link to. And the name doesn't
exist until the build finishes, which is the eight-minute stretch where being
able to send someone the link is worth the most. The id never changes and exists
from the first keystroke.

**Back and Forward work properly now.** Back goes from a project to the list, and
from the list out to wherever you were before. Forward returns. Re-opening the
project you already have open doesn't quietly add a step you'd then have to press
Back through twice.

**A link to a project that's gone lands on the list**, and the address corrects
itself rather than sitting there naming something that isn't there.

**Checks**: 13 new guards. Two of them exist only because the sabotage run found
holes in my first set — I'd checked that opening a project moves the state and
moves the address, and never that the screen actually redraws, so deleting the
redraw passed every test I had. That's the address bar changing while the screen
sits still, which is the exact opposite of the point of this. Fixed, then re-run:
23 deliberate breakages, all 23 caught. Whole suite green at 5,745.

**Also proved in a real browser**, not just in tests — real Chromium, real
server, real Back button. 11 checks, all passed, including that a pasted link
boots straight into that project and a reload stays on it.

**No screenshot this time, and that's not me skipping it** — nothing on the page
changed. What moved is the address bar, which is the browser's own chrome rather
than anything we draw.

**Not seen live yet.** This one touches the Worker, so the container rebuilds:
**wait 15–20 minutes after the deploy** before judging it. And **hard-refresh** —
`chat.js` is cached. Then: open a site, look at the address bar, and paste it
into a new tab.

---

## 2026-09-09 — The wire goes green when the project has a database

You asked for it: *"if the project has a database, the wire turns green to the
site box or the mobile app one, depending on which one is it."* I drew four ways
of doing it, you picked **A** — just the wire, nothing else changes — then asked
for a livelier green, and picked **G4** out of five.

Done. On the start screen, a card whose project has a database now has a green
wire running from the database down to the site. A card with no database has the
same two dark wires it always had — nothing changed on those at all, which is
most of them, because a first build doesn't make a database.

**The app's wire can't go green yet, and that's not a bug.** A database belongs
to the SITE — it's reached through that site's own address — and no project on
the platform has a mobile app at all. So the site's wire is the live one and the
app's is always dark. I did write the app half into the code rather than leaving
it out, so that the day a mobile app can own a database it's one word to switch
on instead of something a future session has to go and find.

**About the green you picked.** It's the most vivid of the five and also the
faintest line on the page — that's not a contradiction, it's how colour works on
our cream paper: the brighter a green gets, the less it stands out against the
background. Measured, the dark wire beside it scores 11.1 for contrast and this
green scores 1.95. You saw all five with that number under each and chose this
one, so it's shipped as chosen. If it ever looks too washed out on your screen,
it's one line to darken — say the word and it's a two-minute change.

**Worth telling you because it nearly misled us both:** my first set of contrast
numbers was upside down. The tool was measuring each green against black instead
of against the cream, so it told me the brightest green was the *most* readable,
which is the exact opposite of the truth. I caught it, fixed the tool, and the
numbers above are from the corrected one. A measuring tool that's wrong in a
believable direction is worse than not measuring at all.

**Checks**: two new guards, both driven rather than read; proved they fail on
four different ways of breaking this before proving they pass; 18 deliberate
sabotages of the new code, all 18 caught; the older sweep for this screen re-run
whole after four of its markers went stale on lines I moved (69 more, all
caught). Whole test suite green at 5,722.

**Not seen live yet.** This is browser-only, so nothing rebuilds and there's no
wait. One look at your start screen proves it: green wire on the sites with a
database, dark on the rest. **Hard-refresh first** — `chat.js` is cached, so the
first load after a push can still be the old file. Renders:
`docs/edits/site-cards-live-wire.png` and `-2across.png`.

---

## 2026-09-09 — The phone button is off the top bar; the tab does it all

You said *"OPK YOU CAN DELETE THIS BUTTON SINCE WE HAVE THE DRAG THING."* Done —
the little sidebar icon in the workspace's top row is gone.

**You were right that it had stopped earning its place, and here is exactly
when.** When the tab first appeared on the right edge this morning, it could only
*open* the phone column — the moment the column opened, the tab hid behind it, so
the button in the top bar genuinely was the only way to close it again. Then the
drag work changed that: the tab stays on screen whether the column is open or
shut, and a press that doesn't drag counts as a click, which closes it. From that
point the button was a second door to a room that already had one. Nothing
announced it — this app keeps finding rules that quietly stopped being true when
the thing underneath them moved.

**One thing had to change with it.** That button was the only control that ever
said *"Hide the mobile app"*; the tab said *"Show the mobile app"* and nothing
else, which was honest while it only opened and becomes a small lie the moment
it's also how you close. The tab now says whichever is true.

**And a detail I want on the record because it has bitten this screen before.**
The name is written in two places — into the page when the workspace is drawn,
and again by hand when you press. Both are needed: the workspace redraws itself
every time the builder replies, so a name written only by the press handler goes
stale on the next answer. That exact bug survived a round of testing on this same
panel a few days ago, so both halves are checked now.

**What I deliberately kept.** The sidebar drawing itself stays in the icon set
even though nothing uses it — deleting an icon because its one user went quiet is
how a feature gets expensive to put back. And the top bar's spacing rule stays
untouched: it's what stops the centred Preview/Code/More tabs sliding sideways
when the picker and reload button come and go.

**A mistake of mine, caught by running the checks rather than reading them.** In
rewriting the tests I asserted the panel gets opened "from at least three places"
— and there are two. I'd listed the drag's open-on-press and the press itself as
separate things, and they're the same line of code. A number written before
counting, which is the thing I'm supposed to be careful about. It reported a
working feature as broken, which is how I found it. It counts properly now, and
names each of the two directions so if either ever goes, the failure says which.

**Everything was proved broken before it was proved fixed.** I put the button
back and watched two checks fail, restored its old styling rule and watched a
third, froze the tab's name to one word and watched two more, and cut the
close-on-click and watched three. Then fifteen deliberate breakages, all fifteen
caught. I also re-ran all eight of the older test sets for this panel, because
twenty of their deliberate breakages pointed at lines that no longer exist —
"couldn't find it" looks exactly like "caught it" in a summary and proves nothing
either way. Six of those I retired outright, with a note saying so: they described
a button that is now deliberately gone, and a test asserting the opposite of what
you asked for is worse than no test.

**Not on the live site yet.** When it is: hard refresh, open a site, and the top
row should have no sidebar icon next to the download arrow. The tab on the right
edge still opens, closes and drags exactly as it does now.

---

## 2026-09-09 — The database icon sits above the pair now

You said: *"the database thing on top of the card but in the middle … the width
of the site and the mobile app together is 100, but the size of the site is 70
and the mobile app 30, the database has to be 50, and make sure is outside the
square but in the middle on top of each of them."* Then *"just the icon"*, and
then *"just the icon without the box is in, and a bit more higher up."*

**All of it is in, and your numbers are the numbers.** I measured it at four
window sizes and it comes out the same every time: the site is 73.9% of the pair,
the phone 21.3%, and the database is **exactly 50%**, dead centre — nought pixels
off — and **20 pixels clear** of the top of the card.

**Just the icon.** I drew three versions first — a rounded pill matching the
card, a little tab sitting on top of the card, and the bare icon — and you picked
the bare one, then asked for it higher twice. It sits **28 pixels** above the
card now (it was 8, then 20). So there is no box and no word next to it. The
half-width is still doing something, though: it is the area you can click, so a
small icon is easy to hit without a box drawn round it.

**Nothing else moved when I raised it**, and I measured that rather than assuming
it: the card is still 258 pixels wide, the phone still exactly as tall as the
site picture, the icon still dead centre at half the width, and the space between
the rows is unchanged. Worth knowing why: the icon is already sitting at the very
top of its own block, so the only way to put it "higher" is to add space between
it and the card — which is one number, and it touches nothing else.

**Both states came with it.** A site with a database gets the normal icon and
opens your Data view. A site without one keeps the icon, dimmed, and hovering it
says *"No database yet — ask for one in the chat"*. Most sites are that second
one — a first build doesn't make a database — so the greyed icon is the ordinary
card, and it is how you'd ever find out you can ask for one.

**One thing I nearly shipped broken, and it is worth knowing because this project
has done it before.** The buttons on a card are wired up by finding everything
with the card's own class name. The moment the database icon moved *off* the
card, it stopped being that class — so it would have been drawn, hoverable, with
the right tooltip, and **completely dead when you pressed it**. Nothing would
have failed, nothing would have logged. It is now wired by "anything that names
a site", which is what the click handler actually reads, so any control on a card
works wherever it ends up sitting. There is a test that presses it.

**And one real gap the mutation sweep found.** I deleted the rule that dims a
disabled database icon, and every test still passed — because they all check the
markup, and "disabled" is in the markup. The icon would have been inert while
looking perfectly live. That is the same thing that got past us two days ago on
the card's own icons, one control over. Guarded now.

**Raised twice more since**, on *"put it a BIT HIGHER"* and then *"PUT THE
DATABASE THING A BIT HIGHER"*: 20 → 28 → **36 pixels** above the card. Measured
at four window sizes each time, and nothing else moved either time — same card
width, same phone, same spacing between rows. The test never needed touching for
any of it, which is deliberate: it checks that there *is* a gap and never how
big, so you can keep nudging it without a test edit.

**The lines are dark now whether the site has a database or not** — your call:
*"ALSO PUT IT DARK THE LINES, NO MATTER IF ITSD ON IR OFF."* Worth saying out
loud because it goes against a rule this project has otherwise kept: everything
else here fades when it is switched off, so you can tell at a glance what you
can press. The database icon no longer does. It is still switched off on a site
with no database — nothing happens when you press it, and hovering still says
*"No database yet — ask for one in the chat"* — it just doesn't look it. Written
down in the code as your decision rather than left looking like a slip, and the
fading rule on the card's own icons is still tested, so this stays one exception
rather than quietly becoming the new normal.

---

## 2026-09-09 — An Apple/Android switch on each card's phone

You asked for *"a swictch to swtitch from apple to andorid, just as a perview
thing"* where the phone sits. I built it, drew two placements into the real
screen, and you picked **A** — the switch under the phone.

**Two little logos, no words, and that was measured rather than chosen.** The
phone on a card is **74.5 pixels wide** when three fit across. The switch in the
workspace panel — the one with "iPhone" and "Android" written out — needs 248
pixels. So the words don't fit, and the names live in the tooltip and in what a
screen reader announces instead.

**It changes something real.** Press the apple and the phone gets rounder corners
and the wide pill notch; press the robot and it gets squarer corners and a small
punch-hole. That mattered more than it sounds: a switch whose two halves look
identical is a dead control, and this project has now caught that six times in
its own screens.

*(This paragraph used to end "and stands a few pixels taller", which was true of
the first version and is the very thing you spotted the next morning — see the
entry below. Corrected here rather than left, because a note describing a bug as
a feature is what the next person reads.)*

**Each card remembers its own phone — and I got that wrong first.** The version I
showed you moved every phone on the screen at once, off one shared setting. My
reasoning was that no site has a mobile app yet, so nothing about *this* site
makes its phone different from the next one's. You looked at it and said *"MAKE
SURE IT ONLY SWITCHED THE ONE I TAPPED, NBOT ALL OF THEM"*, which is right: you
are comparing cards, and a preview you can't set per card isn't a comparison.

Fixed, and driven in a real browser to be sure: six cards, press the second one's
robot and only it changes, press the fourth's and the second stays put, press the
second back to apple and the fourth stays on android.

Worth saying why it cost an hour rather than a week — I flagged it as an open
question when I showed you the work rather than quietly deciding it was settled.

**It costs the card 9 pixels of height** (219 → 229), because the tile gains a
row and the card grows to match it. The other placement I showed you — the switch
inside the phone — cost nothing, which is why I measured both and put the number
in front of you rather than picking for you.

**And the phone's shape is now written down once instead of twice.** Two parts of
the app draw these phones — the card and the workspace panel — so I made them
read one definition. Otherwise they drift, and you end up with a card showing a
different iPhone from the panel showing an iPhone.

**One honest note about my own checking.** After the mutation tests I ran a quick
search of my own to confirm nothing was left behind, and it reported fifteen
problems — none of which were real. The search was simply wrong: a test that
deletes a line leaves text that still *looks* present. I checked properly against
git, which showed the files untouched. Worth writing down because this project
has a rule about exactly this — a check that flags correct code is worse than no
check — and I broke it with my own thirty-second script.

32 guard tests on this screen now, up from 24. 194 mutation tests across five
sets, all 194 caught.

**One of them found a hole in my own testing, and it is a neat one.** A test
checks that a card with no name can't be stored. I was checking it with the phone
that is *already the default* — so the code answers "nothing changed" whether the
protection is there or not, and removing the protection changed nothing I could
see. Checking with the other phone is the only way to see it. Fixed, and caught
by the mutation run rather than by reading.

**Not on the live site yet.** When it is: hard refresh, then look for two small
marks under each phone.

---

## 2026-09-09 — The square stopped moving when you tap the switch

You said *"THE SITE SQUARE THING MOVES , WHEN I TAP TO SWICTH."* You were right,
and it was worse than it looked.

**What was happening.** The two phones are genuinely different shapes — an
iPhone is 393 by 852, an Android 412 by 915 — and the phone was sized from its
width, so switching to Android made it *taller*. The site card and the phone sit
in the same row and stretch to match each other, so that extra height pushed the
card down — **and the card next to it too**. Measured before the fix: the card
grew about 4 pixels at a normal window, 6 at a narrower one, 7 at the narrowest,
and its neighbour moved by exactly the same amount.

**What I did.** The phone now sits inside a frame that never changes shape, and
the phone is sized from that frame's *height* instead of the column's width. So a
taller phone comes out **narrower** rather than taller, and nothing around it can
move. Measured after, at three window sizes: card 0, tile 0, neighbouring card 0.
The only thing that changes is the phone's own width, by two or three pixels —
which is the switch doing its job.

**A small bonus.** The frame's shape is the one all the original column
arithmetic was built on, so the phone now lines up with the site thumbnail to
within a single pixel instead of two.

**And I have to own the way this got in.** The note I wrote yesterday describing
the switch says the Android phone *"stands a few pixels taller"* — I measured
that difference while building it, wrote it down as if it were a description, and
never asked where those pixels go. It was in my own notes the whole time. I have
corrected that sentence rather than leaving it, because a note describing a bug
as a feature is what the next person reads.

**The tests all passed through it, which is the part worth telling you.** There
are thirty-odd checks on that screen and every one of them proves the switch
*changes something* — a corner, a camera notch, which button lights up. Not one
of them proved it changes *only* that. So there is a new check now for exactly
that, and I proved it fails on the old broken version before trusting it.

**One thing the automated tests caught that I had not thought of.** Because the
phone now changes width inside a fixed frame, if it were not centred it would
jump to the left edge every time you tapped — the same complaint you made,
sideways instead of downwards. Nothing was checking the centring. It is checked
now.

**And an honest note about the machine.** Halfway through, this session's
container restarted while the mutation tests were running, which left one
deliberately-broken line sitting in the stylesheet. I found it by reading the
diff before doing anything else and put it back, then re-ran all five sets from
scratch — a test run that was interrupted proves nothing about the code it never
finished checking.

**Not on the live site yet.** When it is: hard refresh, then tap between the
apple and the robot on any card and watch the square beside it. Nothing should
move but the phone.

---

## 2026-09-09 — Two wires from the database to the site and the app

You asked for *"TWO WIRES COMING FROM THE STABASE, ONE THAT GOES TO THE SITE AND
ONE TO THE APP."* I drew three versions into the real screen — straight lines, a
right-angled one like a circuit board, and curves — and you picked the curves,
then said *"BUT THE DATABSE THNG MORE TO THE RIGHT SO ITS IN THE MIDDEL, NO
MATTER IF ITS NOT 50 IN THE MIDDLE."* Both are in. You said **"GOOD"** to the
result.

**You were right, and here is the arithmetic behind why.** The database was
sitting at the halfway mark across the pair. But the site takes about 74% of the
width and the phone about 21%, so halfway across the *pair* is nowhere near
halfway between the two *things* — the wire to the site had a short run and the
wire to the phone a long one, which looks lopsided no matter how carefully it is
centred. It now sits at **63.3%**, which is worked out as the exact midpoint
between the middle of the site and the middle of the phone rather than typed in.
The result: the two wires run **exactly the same distance** left and right — 90
pixels each at three across, 132 at two, 165 at one. Measured, not eyeballed.

**The size did not change**, only where it sits. The clickable area is still half
the pair, which was your number.

**The wires land dead on both.** Within two pixels of the middle of the site and
one pixel of the middle of the phone, at every window size I tried. They leave
the icon's own centre to the pixel.

**They are drawn, not a picture file** — same pen weight as the database icon
itself, so they read as one drawing. And they are decoration only: a screen
reader ignores them, they can't be tabbed to, and they don't swallow clicks meant
for the card underneath.

**One thing worth knowing, because it is a mistake this project keeps making.**
Two of the test harnesses broke the moment the wires went in — not because
anything was wrong, but because they build a little sandbox to run the card code
in, and the card code now reaches for one more thing than the sandbox had.
There's a comment in one of those harnesses, written weeks ago, predicting
exactly this would happen. It did. Fixed by handing the real code in rather than
a fake, because a fake would have made every "are the wires there?" check blind.

**And one test was flagging correct code.** A checker that makes sure the
stylesheet never uses a colour or size it hasn't defined only recognised
definitions written at the start of a line — so the two new ones, written inline,
looked undefined to it and it reported a perfectly working stylesheet as broken.
Fixed the checker, not the stylesheet: a test that cries wolf is worse than no
test, and that same file already has a note saying so from a similar slip.

69 mutation tests, all 69 caught. Full suite 5,712, all green.

**It is live now.** Merged and deployed at 17:07Z — the whole deploy took **61
seconds**, because nothing in it touched the container: it is stylesheet and
browser code only, so there is no waiting period afterwards. Cloudflare uploaded
exactly two files, `chat.js` and `styles.css`, and I checked the copies now being
served are byte-for-byte the ones I wrote. I also read the new rules back off the
live files rather than off my own diff — the icon's position, the wires, the dark
lines, and the fact that the fading rule on the card's own icons is still there
and untouched.

**What you should see, after a hard refresh** (the page's code is nearly a
megabyte and your browser caches it, so the first load can still be yesterday's):
a small database icon floating above each pair, sitting exactly halfway between
the site and its phone, with two curved wires running down to them. **It is dark
on every card**, whether that site has a database or not — that was your call.
Pictures: `docs/edits/site-cards-phone.png` and `site-cards-phone-2across.png`.

**One test job went red and it is not this change.** Three little check jobs run
after every merge, and all three sign in as you at the same moment. Supabase only
lets one sign-in link be outstanding at a time, so whichever of the three is a
fraction of a second late gets told its link has already expired. This time it
was the container one; on Tuesday's merge it was a different one; on another it
was none of them. Known, written down as a task, and worth fixing when there is
a quiet moment — one shared sign-in instead of three.

---

## 2026-09-09 — The mobile app sits next to each site on the start screen

You asked for three across instead of four, with the site in one square and the
mobile app beside it. Then twice more to get it right: *"no i mean the square
and next to it the phone, not inside"*, and *"leave the square the size it is
currently, just add the phone thing next to it"*. Then *"the phone same height
as the square"*. All four are in.

**Your site card did not change.** Same width, same picture, same name and date
row. It measures 258 pixels wide at three across, which is exactly what it
measured at four before this. That is not luck — the gap between the card and
the phone is sized to leave the card alone, and there is a test that fails if
somebody rounds it off.

**The phone stands exactly as tall as the site picture beside it**, and it stays
that way at any window size — including when the grid drops to two across and
then to one, where the card gets much wider and the phone grows with it. That
comes out of a bit of arithmetic rather than a number I picked: the picture's
shape and the phone's shape decide the column's width between them, so they
cannot drift apart. Measured at four window sizes: 161 against 160, 239 against
238, 300 against 299.

**The little phone icon came off the card.** It was greyed out and said "Mobile
app — not built yet", and now there is a whole phone beside the card saying the
same thing — the same sentence twice on one card, three times if you count what
a screen reader reads out. Taking it off also gave the name back the room those
two icons were using: `hartleys-barbers` no longer gets cut to
`hartleys-barb…`.

**The phone is a picture, not a button.** Nothing happens when you click it, on
purpose — same rule the icon was under. When the mobile app is real, that square
becomes its preview.

**Two things worth telling you, because both cost time and both were found by
looking rather than reading.**

First, my first version named the phone's box the same thing as the mobile-app
column in the workspace — the panel you open and close on the right. It quietly
inherited that panel's rules and rendered **842 pixels tall**. Renamed, and
there is now a test that stops anyone doing it again.

Second, a test I wrote to make sure the phone sits *beside* the card and not
inside it was checking the wrong thing — it would have passed with the phone
nested inside, which is the exact thing you corrected me on twice. The mutation
sweep caught it. It counts properly now.

Also: an old test had gone green for the wrong reason. It was looking at a
stretch of code that ran "from the globe icon to the phone icon", and when the
phone icon went, that stretch became "to the end", which happened to still
contain the right thing. It passed while reading something else entirely. Fixed
so it reads each button on its own.

30 mutation tests, all 30 caught. Full suite 5,703, all green. (This entry said
26 and 5,702 when I first wrote it, which was true then — the extra four and the
extra one came with the row-spacing work further down, which is part of the same
entry. Corrected here rather than left to drift.)

**Merged and deployed** (you said "merge it"). Main moved straight onto it at
06:48Z and the deploy was green in **58 seconds** — nothing rebuilt, no
container roll, no waiting period. I checked the files actually being served
from gofarther.dev and they match the tree exactly: three across, the phone
column, the phone's shape, and **zero** occurrences of the old phone icon.
Nothing paid ran.

**Then you asked for more space between the rows** — "floor one to floor 2".
Done, then more twice when you asked again: **104 pixels** between one row and
the next, where before it was 16 — the same as the gap between columns, which is
why a row ran straight into the one below it.

I read that wrong the first time and started on the horizontal gap. Worth
knowing why that one is not free: the page is capped at 1080 pixels wide, so
more space *between* pairs takes width *off* each pair and shrinks your card
from 258 to about 246 — which fights what you told me earlier about leaving the
square alone. The row gap costs nothing: **the card is still 258** at every
setting, measured.

**You still need a hard refresh** to see any of it, because `chat.js` is about
932 KB and your browser caches it. Then: three pairs across with clear space
between the rows, a phone beside each site standing exactly as tall as its
picture, and no little phone icon in the row with the name. Picture:
`docs/edits/site-cards-phone.png`.

---

## 2026-09-09 — The phone column only shows on Preview now

You said the phone thing should only be there on the preview. It was showing on
Code and More as well — a phone frame sitting next to a file tree, which is a
column about nothing. It is Preview-only now.

To be clear about what this was: the column has behaved that way since the day it
shipped, so this is a change you asked for rather than something I broke
yesterday with the drag work.

**All three parts go together**: the column, the little tab on the right edge that
opens and drags it, and the phone button in the top bar. A button that opens
something that is not there is worse than no button at all — that is the same
problem we have now found five times in this app's own toolbar.

Three things worth knowing:

- **It remembers what you left.** Drag the column wide, press Code, come back to
  Preview — same width, still open. Nothing is reset.
- **The top bar does not shift.** The button is hidden but keeps its space, so the
  Preview / Code / More tabs stay in exactly the same place when you change view.
  Measured: identical position in all three.
- **It reads what is actually on screen.** There is a case where the app shows you
  the preview even though a different tab was the last one picked (a site with no
  database, last left on Data). The column asks what the screen is really showing
  rather than what was last asked for, so it can never end up hidden next to a
  preview.

Nothing else about the panel changed — same phones, same switch, same drag.

`public/` only, so there is no container rebuild and no waiting period after the
push. Picture: `docs/edits/mobile-preview-only.png`, both states.

**Merged and live (you said "merge it").** Main moved forward by four commits —
the edge tab, the drag and the two phones, the width that now survives the panel
redrawing, and this one. **The deploy took 55 seconds**, which is the fast kind:
the container image was untouched, so nothing rebuilt and nothing rolled, and
there is no twenty-minute wait afterwards. Only two files went up, `chat.js` and
`styles.css`, and I checked both off the live site — they match the code exactly.
The tests passed. The paid build test skipped itself, as it should on a merge.

**One thing to do when you look**: hard-refresh the page. `chat.js` is nearly a
megabyte and your browser holds on to it, so the first load after a deploy is
often still yesterday's file. That is the standing explanation whenever something
I have just fixed still looks broken.

**And one thing I noticed while reading the test runs, which is not about this
change.** Three small checks that run after every deploy sign in as you, and they
all ask for a login link at the same moment — and asking for a second link
cancels the first, so whichever one is last gets told its link has expired and
goes red. It swaps around: this time it was one of them, last time a different
one. So a red mark on those three is usually them tripping over each other, not
anything wrong with the site. Worth fixing properly at some point — they should
share one login — but I have left it alone since you asked for a merge.

---

## 2026-09-08 — The mobile app column, on the right, opens and closes

You asked for a column down the right-hand side, said it was for the mobile app,
then narrowed it twice: *"in a sidebar not free like that"* (so it is docked, not
floating over the preview) and *"something you open and close, not just something
there"* (so it has a button). It is built, and it is in `public/` only — nothing
on the server changed, so the moment the deploy is green and you reload the page
you have it.

**What you get.** A button on the top bar, just right of the three width buttons
(desktop / tablet / phone). Press it and a third column slides in on the right
with a phone drawn in it. Press it again and it goes. It starts closed, and it
stays however you left it while you are in that site.

**What is in the phone: one sentence, and no button.** I mocked one up that said
"Build the mobile app" and asked you whether to keep it; you said no button, just
the sentence — and that was the right call. Nothing on the platform can build a
mobile app yet, so a button there would do nothing when pressed. That is the same
problem we have now found five times in our own screens (the members icon, the
security scan, the effort dial, the old Publish button), and it is why the phone
icon on the site cards is greyed out with "not built yet" on it.

The sentence changes with the state and both versions are true:
- a site that has been built: *"No mobile app yet — ask in the chat and I'll
  build one from this site."*
- a brand-new project: *"No mobile app yet — build your website first, then ask
  me for the app."*

The second one matters. On a project with nothing built there is no site to make
an app from, so the first sentence would be a promise about something that does
not exist.

**Two things I checked in a real browser rather than assuming.** Opening the
panel does not reload the preview, and it does not wipe a half-typed message.
Both are true because the button flips a switch on the screen rather than
redrawing the whole workspace — the same trick the "hide chat" button already
uses. I drove both in Chromium against the real files: the preview frame is the
same one afterwards, and the message box still held what I had typed.

**The icon is deliberately not a phone.** There is already a phone icon two
buttons along — that is the phone-width preview — and two phone icons in one row
meaning different things is a control nobody can read. So this one draws a panel
with a line down the right: "open the right-hand panel". It is the mirror of the
"hide chat" button's icon on the left.

**One thing the tests missed and the sweep caught.** Every check I wrote about
the button lighting up read the click handler, which lights it correctly. Nothing
read the markup that redraws that button every time the builder replies — so if
someone deleted one line there, the panel would stay open and its button would go
dark from the next reply onward, and nothing would fail. Fixed, and the check now
reads both ends.

**Where to look**: `docs/edits/mobile-panel-closed.png`,
`mobile-panel-open.png`, and `mobile-panel-new-project.png` (the other sentence).

**When the mobile app is real**, this is where it goes: drop the two sentences
and draw the app inside the phone. Nothing else has to move.

**And then you asked for the switch** — *"now a switch there for android and
apple"*. It is in the panel's header: **iPhone** and **Android**, two little
segments, and pressing one changes the phone you are looking at.

**It really changes the phone, which is the point.** An iPhone and an Android
are not the same shape, so the frame is not the same frame: the iPhone is
393×852 with much rounder corners and the wide pill Apple calls the Dynamic
Island; the Android is 412×915, squarer corners, and the little round
punch-hole camera. Those are the real numbers off the real handsets. That
matters because a switch whose two halves look identical is a control that does
nothing — the thing we have now caught five times in our own screens — and this
one you can see working with no app in it at all.

**I called them iPhone and Android rather than iOS and Android.** That is the
pair a person actually says. You said "apple" — if you want that word on the
button it is one line, say so.

**The first version of it was the dead control I just described, and the tests
caught it.** I had the frame sized from its width with a height cap, and the cap
is what actually binds — so both phones came out exactly 369×742 and the two
shapes I had written did nothing whatsoever. The frame is sized from its height
now, which also fixed something that was already slightly wrong: the phone used
to be about six per cent squatter than a real handset, and now it is right. I
measured it at four window sizes and it never spills out of its column.

**Three things survived the first sweep and one of them was my own test being
wrong** — it compared two CSS blocks that each start with their own selector, so
they could never come out equal and the check was empty. Fixed. The other two
were real: nothing checked that the panel opens on a phone that exists, and
nothing checked that the lit half of the switch actually looks lit.

**A tab on the edge** — *"it gotta show it like a hidden sidebar tho, not like a
button opens it"*. Fair point: until today the mobile app panel could only be
found by pressing a small unlabelled icon in the top bar, so if nobody told you
it was there, it wasn't.

I drew four versions of the closed state into the real screen and you picked the
first — a small tab on the right-hand edge with an arrow on it. Press it and the
panel slides in; the tab disappears, because once the panel is open the panel
itself is the obvious thing to look at.

**It borrows the panel's own skin.** Same border, same background, same rounded
corners — except the right-hand side, where I took the border off and squared the
corners. That's the whole trick that makes it look like the edge of something
tucked away rather than a button sitting near the edge.

**Both ways in now run through the same piece of code.** The top-bar icon and the
tab were going to be two copies of the same three lines, and two copies always
drift apart eventually — and the one that would have gone quietly wrong is the
tab, which is the one your customers will actually use. So there's one function
and both press it. I checked by pressing the tab and watching the top-bar icon
light up on its own.

**And I checked the two things that matter when it opens**: the website preview
does not reload, and a half-typed message in the chat box is still there
afterwards. Both measured in a real browser, not assumed.

**One thing I'd like your eye on.** Close up it reads clearly as a tab. At normal
size it's very quiet — grey on grey, about as wide as a pencil line. Your
complaint was that nobody would find it, and I'm not certain this version fixes
that so much as moves it. I can leave it, darken it slightly, or give it a
stronger background so it looks like an object rather than a seam. Say the word
and it's a one-line change.

---

**And then you can drag it** — *"that tab can be dragaable and open until the
chatbox in the left … it can show the two layouts one next to each other"*.

Pull the tab leftwards and the panel gets wider, following your pointer, right up
to where the chat starts and no further. Let go and it stays. Press it without
moving and it just opens or closes, so the one control does both jobs.

**Drag it far enough and you get both phones side by side** — iPhone and Android
together, each with its name underneath. Below that width you get one phone and
the little switch decides which; above it the switch disappears, because once
both are on screen it isn't choosing anything, and a control that does nothing is
the thing we keep deleting.

**Nothing reloads while you drag.** I checked by typing half a message into the
chat and dragging the panel across the screen — the message was still there, and
the website preview never blinked. That's deliberate: the whole panel is built so
that opening and resizing move one number rather than redrawing the screen.

**Two things were broken and neither showed up by reading the code.**

The phones came out far too narrow — like a phone squashed sideways. The reason
is a genuinely obscure one about how browsers work out sizes, and the fix was to
lay the box out a different way. I only found it because I measured the phone and
compared it against a real handset's proportions.

And clicking the tab did nothing at all. I'd written a note to myself in the code
saying "check whether the panel was open *before* you open it" — and then wrote
the two lines in the wrong order, so it opened and immediately shut again. I
found it by watching the actual mouse events instead of re-reading my own code,
which is a lesson I keep having to relearn.

**Two things you might want changed.** The names under the phones sit very close
to the bottom edge. And the width where the second phone appears is a number I
picked rather than measured — it's set just above the panel's normal width, so
two phones only ever show up because you dragged for them, never by accident.

---

**And then the logos** — *"instead of the names, the names plus their logo"*. The
two buttons still say **iPhone** and **Android**, and each now has its logo in
front of the word.

**I drew both by hand rather than downloading them.** Nothing is fetched when the
page loads, there is no image file to keep in step with anything, and they are
drawn in the same ink as the button — so they go pale when the button is off and
light up when it is on, without needing a rule of their own.

**The Android robot took three goes, and only looking at it found that out.**
These sit at 13 pixels, smaller than the words beside them. My first drawing had
a small head low in the box with long thin antennae, and at that size his eyes
closed up and the antennae read as two loose hairs. Nothing in the tests could
have told me — a test can check the drawing is there and on the right button, not
whether it looks like anything. So I rendered it, looked, redrew it with a bigger
head and shorter, wider, thicker antennae, and looked again. The apple was right
the first time; it is one solid shape and shrinks well.

**One small thing I found and fixed while I was in there.** I had put an
attribute on both marks whose job was to punch the robot's eyes out as holes
rather than paint them on. I measured it, and the eyes were already holes for a
different reason — so on the apple, where it genuinely does nothing at all, I
took it off; on the robot I left it as a second belt, with a note saying which
one is actually holding the trousers up. Small, but the alternative is the next
person reading it as the thing that matters and building on it.

**One of my own tests was wrong again, the same way as before.** To check that
each button carries its own logo I had to cut the button out of the page markup,
and I did it by counting backwards a fixed number of characters — and the button
starts just before that count, so the cut wrapped round to the end of the page
and reported a perfectly good button as having no logo. Fixed by looking for the
button's own opening tag instead. This is the third or fourth time counting
characters has bitten me and it is written down in the rules; I did it anyway.

**Where to look**: `docs/edits/mobile-panel-iphone.png` and
`mobile-panel-android.png`, side by side.

---

## 2026-09-08 — You found a real one: Code showed the preview

You asked me to check that the things I added actually work, and pointed at the
Hartley's Barbers screenshot. **You were right — the Code tab was broken, on
every site.**

**What was wrong.** Making the Code tab real needed three things: put the button
on the bar, put the code panel on the screen, and fetch the code into it. I did
the first and the third and left the second one switched off. So pressing Code
lit the button up, quietly fetched your source, found nowhere to put it, and gave
up — and the screen fell back to showing the preview. No error message anywhere,
which is why it looked like nothing was happening.

**It's fixed** — one line, plus a test that fails if it ever comes back. I proved
the test catches it by putting the bug back and watching the test go red.

**What I should have caught.** My own test checked the button and checked the
fetch, and never checked the panel in between. Three steps, two tested. I've
written that down as a rule: when something needs several steps to work, test
every step, not the ones you happen to be thinking about.

**The rest of the check, and the good news.** Everything else I looked at is
working: the site is live and serving, the download button works (it asks the
server for your code directly rather than reading the Code tab, so it survived
the bug next to it), the build stayed in its own chat, the reply and the step
list are right, and the server side of the code tab was healthy the whole time.

**Confirmed working** — you loaded Code after a hard refresh and saw the source.
That's the proof, and it's the only kind that counts here: I can check that the
right code is being served, but only a person looking at the screen can tell me
the panel actually drew.

**Worth knowing for next time:** the app's main script is about 900KB and your
browser holds on to it. So a fix like this is live on the server the moment the
deploy is green, and live *for you* only when the tab reloads. If something I've
just fixed still looks broken, a hard refresh (Ctrl+Shift+R) is the first thing
to try — it's also the most likely reason Hartley's never got linked to its chat.

**One thing I could not settle.** The new "this site belongs to this chat" link
did not get recorded for Hartley's. The most likely reason is that the browser
tab you built in was open from before that change went out, so it was still
running the old page code — the new code is definitely being served now. The way
to know for sure is to hard-refresh and build once; I did not want to guess.

## 2026-09-08 — Merged the removal-verb branch into main

You said "Merge". Everything from today was already on main, so what was left
was the working branch: three commits nobody had merged, building the **removal
verb** — saying "take the 3D scene off" and having it actually come off, for no
model call and no credits, with a plain sentence when a thing cannot be removed.

**It conflicted in two places and both were the same small thing.** That branch
and today's logo work had each added an option to the same function, and neither
knew about the other. Both are needed, so the function takes both. Nothing was
thrown away.

**The interesting part is that my own explanation of the fix was wrong, and the
mutation sweep caught it.** I wrote a comment saying the removal beats the
"don't overwrite somebody's uploaded logo" rule *because of the order the two
checks run in*. It doesn't — it wins for a different reason, and I only found
that out because I deliberately broke the order and the tests stayed green. The
behaviour was right either way; the reason written next to it was not, and that
is the thing the next session would have inherited. Corrected in the code and
written down rather than quietly changed.

**And the sweep found a real trap the merge itself created**: when two branches
edit the same import line, it is very easy for the resolution to silently drop
one side's names. That does not break anything on startup — it breaks the first
time a customer uses that feature. There is now a check that works out which
names are needed rather than keeping a list, so it cannot go stale.

5,625 tests green. **Not proven live**: the removal verb has never run on a real
site — that is a separate test when you want it.

**It is on main and deployed.** The deploy went green in three minutes at 06:08
this morning; the container was rebuilt and swapped in, so anything that runs in
there needs until about 06:28 before it is on the new code. Nothing was spent:
the three paid test workflows that would have run all skipped themselves, which
is what we set up on 30 August — and merges are exactly the case that used to
cost the most, because git writes the message itself and there is no way to mark
one as "don't spend".

---

## 2026-09-08 — "Off the web" is now a fact the server knows

You said: *"fix the offline flag on the server too."*

**What was wrong.** Taking a site off the web, and putting it back, both worked
properly on the server. What did NOT was the app remembering which state a site
was in: that lived only in the browser that pressed the button. So if you took a
site down on your laptop and later opened it on your phone, the phone said the
site was **Live** and offered to take it offline again. The card I added an hour
earlier is what made this reachable — before it, the panel had no door on any
built site, so nobody could see the wrong answer.

**What I did NOT do, and why it matters.** The obvious fix is a yes/no column:
"is this site off?" I did not use one, because it would be wrong within a day.
Taking a site off the web works by deleting the files and the little program that
serves them — "offline" is simply *nothing there any more*. It does not touch
your pages, so **the next ordinary edit you make puts the site straight back up**
without ever going through the "put it back online" button. A yes/no column would
still say "off" for a site that was up again, and the thing that would have to
correct it now runs inside your site's own container, which deliberately is not
allowed to write to that table at all. Fixing that would mean loosening a
security wall to keep a convenience field tidy.

**So I stored the TIME of the switch instead.** A site is off the web only while
nothing has been published since that moment — and the server already knows when
each site last built. The flag gets out of the way on its own; nothing has to
remember to clear it, and no wall moved.

**Three answers, not two.** The panel can now say "Live", "Off the web", or fall
back to what this browser remembers when the server genuinely could not work it
out (the "when did it last build" read is allowed to fail without breaking your
sites list). That third answer is deliberate: guessing "Live" there would tell
you your site is up when it may be down, which is the one thing this field exists
to get right.

**The bug I nearly shipped.** The panel gets its site from the browser's own
records, not from the merged server list — so the server's answer would have
reached the sites grid, been used there, and never reached the one screen that
actually draws "Live" or "Off the web". That is the same shape of mistake this
codebase has made thirteen times: the value gets computed, and one of the two
places that needs it never asks. Both ask the same function now.

**Also caught before it shipped**, by a check that exists for exactly this: the
new file was not on the list of things copied into your site's container, so the
first job after deploying would have crashed on startup and told you "our build
service was restarting". Fifth time that check has saved a deploy.

**Proof.** `docs/edits/offline-two-faces.png` shows both faces of the panel side
by side, with the browser's own flag saying "live" in each — so the only thing
that differs is the server's answer, which is the whole change.

**It is deployed** (run 2050, green in under three minutes at 05:10Z; both test
runs green). I read the live files back: the rule is in `/site-list.js`, the
panel asks for it in `/chat.js`, and the sites route answers "sign in required"
rather than "no such route", so it is really mounted. That proves the code is
there and cannot prove two browsers agree. **Not proven live**: that takes two
browsers — take a site off the web in one, open **More → Cloud → Visibility** in
the other, and it should say "Off the web" with "Put it back online". The push
rebuilt the container, so anything that runs there needs until about 05:30Z.

---

## 2026-09-07 — Runs 41 and 42: the streaming works, it uncovered a lane that charged for an invisible change, and one mark fixed it

**The streaming is proven live.** You fired `wordmark` on fretwork-1 at 22:13Z.
`lane:wordmark` ran **292,336 ms** and finished. Runs 11, 12 and 40 were all cut
at exactly 240,000 ms for nothing; this one went 52 seconds past that wall,
answered, stored, published and charged 2 credits. Job `2b9b2201…`, `state:
done`, `billing: finalized`, build `mtnfl34h-8uuf06` → `mtqdjyhg-bizsag`.

**Two proofs rode along free.** fretwork-1 served no `x-site-version` before
this; it now serves `01788733184386-yboq08`. That publish was the site's FIRST
activation under the immutable layout, and the corrected activation from the
publication-integrity work carried it — 36 files, render check ok, nothing left
leased. Both were "not proven live" this morning.

**And the run was red, correctly.** The wordmark is stored (`moved:
["wordmark"]`) and nothing on the site shows it. `writeSiteBrand` bakes a
designed mark only when you have uploaded none — *"a model must not outrank a
person"*, its own words — and fretwork-1's header carries an uploaded PNG (run
10's striped test image, which run 16's rebuild made the header logo). So the
lane drew 612 characters of SVG, published a whole build, took 2 credits and
said "done" for something no visitor could ever be shown. **That is the defect,
not the precedence**: the precedence is right and stays.

**FIRST FIX — a wall at the picker that refused such an ask for nothing.** It
worked and it was a symptom, and you said so: *"instead of it being 3 things or
4 or 5, its gotta be one, wordmark, but it can be made in svg, etc etc etc"*.

**SO IT IS ONE THING NOW.** Your site's header mark was three separate fields
with an invisible ladder between them — a picture you uploaded, a drawing the
model made, and your name in type underneath both — and the tab icon had the
same three-way split. Six places, two doors, three names for two slots.

Each mark is one field carrying a **form**:

| form | what it is |
|---|---|
| `text` / `initials` | the floor — your name in type, or a mark drawn from its initials |
| `svg` | a drawing |
| `image` | a file you sent |

A new form **replaces** the one before it. So the ask that started all this just
works: "redraw the header wordmark" redraws the header wordmark, whatever was
there. There is nothing left to shadow and nothing to refuse, so the wall and its
sentence are gone.

**THE ONE RULE FROM THE OLD LADDER SURVIVES, and it is yours** (2026-08-28,
*a model must not outrank a person*). It is not a ladder any more, it is a rule
in one place: an **edit you asked for** always replaces the mark; a **rebuild**,
which re-answers every design field whether or not you mentioned it, leaves a
picture you uploaded alone. Without that, run 16's rebuild would have wiped your
logo. And it defaults to protecting: getting it wrong toward "keep your file"
costs an edit that does not take, which you can see and say again — wrong the
other way silently deletes artwork you sent us.

**NOTHING MOVES ON ANY LIVE SITE.** Every site still stores the old shape and
reads exactly as it does today; the new one is written the first time anything
touches that site's mark. No migration, no republish, nothing a visitor sees
changes until a site is edited.

**THE ICON CAME ALONG.** It had the identical three-way split, and fixing the
wordmark alone would have left the same mess one field over — the favicon would
have cost the same wasted credit the first time anyone asked for one on a site
with an uploaded icon.

**A REMOVAL NOW SAYS WHAT IT FELL BACK TO.** "Took the logo off — back to your
name in type" was a sentence about a site nobody had looked at. It names the
actual result now. **On a site still carrying the old pair** — every site except
fretwork-1 — taking an uploaded picture off reveals the drawing that was
underneath it, and says so. **On fretwork-1 since run 42 there is nothing
underneath**: the CGS drawing IS the one stored value, so taking it off gives the
floor, your name in type, and the sentence says that instead. That is what "one
mark" means, and it is the point of the change rather than a gap in it.

**Four defects in my own new code that the test suite caught**, all of which a
source read would have missed: the fold inverted the very precedence it was
meant to preserve (fretwork-1's next publish would have dropped your uploaded
logo); the logo rung would have written the site's look field whole and taken
the theme, brand, description and every language off; an absent look became an
empty object and a broken-site check stopped firing; and one name was used and
never imported — the third time this session that `node --check` passed a file
that would have thrown live.

**PROVEN LIVE — run 42, 2026-09-07 04:37Z, 1 credit, 176 seconds.** You fired
the `wordmark` lane at fretwork-1: *"Redraw the header wordmark as the letters
CGS in a bold serif, black on transparent."* It did exactly that. The header now
carries **CGS** in a bold serif where the striped test PNG was
(`docs/edits/mark-run42-header.png`), balance 503 → 502.

**The one number that is the whole proof: `/logo.svg` went from 0 bytes to 245.**
That file was a 404 before this run — which IS what run 41 cost you. Run 41 drew
a wordmark, stored it, published a whole build and charged 2 credits for
something no visitor could ever be shown, because the uploaded PNG won and the
drawing was never written to disk at all. It is written now, and the header
points at it.

**Three other things rode this run and all held.** The publish went up under the
corrected activation — the script really served before anything was committed,
which is the publication-integrity work doing its job on a real customer publish
for the first time. Both languages were already cached, so nothing extra was
charged. And the lane call itself finished in **11.8 seconds**, against three
earlier runs that were cut dead at four minutes and one that needed 292 seconds;
this answer was short, so it did not re-test the streaming, but nothing went
backwards.

**Two findings on the run, neither of them this change's.** The site's Welsh
day-names still disagree between the checker's two runtimes on a phone-width
render (the open React #418 item — not something a visitor on Chrome sees), and
the stored stylesheet has two rules aimed at things no longer on the page,
reported and not enforced. Both were there before run 42.

**Still not proven: the removal.** Free, and it takes the CGS mark back off, so
it is your call — "take the logo off fretwork-1" should now answer with your name
in type rather than with the drawing, for the reason two paragraphs up.

**A note on my own mistake, since it cost time:** I put a `git checkout --`
restore trap on the mutation sweep, and on a normal exit it fired and wiped my
own uncommitted changes. The sweep runner already restores in its own `finally`;
my belt was redundant and destructive. Re-applied and re-verified. The rule
should be: snapshot to a copy, never `git checkout` a tree with uncommitted work.

---

## 2026-09-06 — Run 40: the wordmark timed out a third time, and the fix for it was aimed at the wrong bound

You fired the `wordmark` lane on fretwork-1. It failed the same way it failed
on runs 11 and 12: **`waitedMs: 240000`, `TimeoutError`, cost 0**, the site
untouched, nothing charged. Job `73e8a7d1…`.

**What that run bought.** Task #47 (this session, earlier) had answered the
first two timeouts by capping the ANSWER — `max_tokens` 16,000 → 3,334 for a
drawn wordmark — and I marked it "not proven live, the next wordmark ask is the
proof". The proof came back negative, which is the system working exactly as
it should: a claim was marked unproven, and the proof disproved it.

**Why it was wrong, and it is worth knowing because it is a whole class.** I
drove it rather than guessing: the ceiling really is on the wire. But
generation time follows the tokens a model actually EMITS, not the ceiling it
is allowed to reach — so a smaller budget truncates a long answer and cannot
make a slow one finish sooner. The giveaway is *which* failure came back: a
bound ceiling stops with a `max_tokens` stop, and this stopped with a timeout,
so the model had not even reached 3,334 tokens when our own clock cut it.

**The real bound is the wire, and the fix is one your codebase already had.**
The 240 s ceiling exists only because the egress hangs up an *idle* connection
at ~270 s. Streaming stops it being idle — and the call layer has been able to
stream, on both providers, folding the result back so nothing downstream can
tell, since the container needed it. The Worker's wrapper was dropping the
argument that asks for it. So: the small calls stream now, and a queued call is
bounded by the job's own clock instead of a flat number.

**One thing I got wrong and your tests caught.** My first cut gave the streamed
call `BUILDER_CALL_MS` — ten minutes, a build's clock. `build-budget.test.mjs`
went red with the exact message it was written for. I fixed the change rather
than the guard, and then tightened the guard, because it had never listed
`BUILDER_CALL_MS` and so caught me by luck rather than by cover.

**Not proven live.** The next `wordmark` ask on Grok is the proof, ~1 credit —
and it needs the deploy first. Balance is unchanged at **505**; run 40 cost
nothing.

**MERGED AND DEPLOYED (you: "Ok merge").** Main was fast-forwarded from
`b2428351` to `72c639ff` at 21:48Z — one commit, clean, nothing of its own on
main. **Deploy run 2035, green in 3m07s**: the gate set in 1 s; the image step
**2m17s**, so the site image was BUILT and the container app `EDIT`ed off
`d76a…70c277` onto `isibi-app-sitebuildcontainer:f93d8236b725db6e`, applied
**21:51:41Z** (`worker.js` is an image input, so every Worker code push rolls
it); `deploy gate (drain)` returned instantly with no live leases; Wrangler
22 s, all four triggers and both queue ends redeployed; the clear step on
success left the gate to expire. **The 15–20 minute hold ends ~22:07–22:12Z** —
nothing that needs the new code should be fired at a container before then,
because an instance started seconds after "deploy completed" is still on the
previous image.

**Then fire it, and it is your click** (this session's dispatch is refused by
GitHub, 403, as it has been all day): `lane-sweep.yml` → harness `lane`, lanes
`wordmark`, ref `main`. About 1 credit against 505.

**What that one run proves, and it is more than the streaming.** fretwork-1 is
still on the LEGACY publish layout — I read it live and it serves no
`x-site-version` header — so if the wordmark publishes, that publish is also
the first activation under the immutable layout. One ~1-credit run would then
settle three things at once: the streamed call, the first `current/<slug>.json`
pointer, and the publication-integrity work that merged earlier today.

**And if it times out again, the reading is different from run 40's.** The
ceiling is 480 s now, so a timeout there is a genuinely slow generation rather
than our own 240 s wall, and the next move would be the job's clock rather than
the call's.

**Still unproven, and unrelated to this:** the container runner did not take
run 40 (the lease stayed with the Worker consumer the whole time), so task
#93's live proof is still outstanding, and `/api/site/runtime?slug=fretwork-1`
is the free way to see whether the canary flag actually names that site.

---

## 2026-09-07 — The model picker was lying about one call, and now it sits on the first screen

You typed HEY, looked at the composer and said *"IT PUTS SONNET THERE."* Two
separate things came out of that, and one of them was a real bug.

**Sonnet 5 on that chip is your own old choice, not something HEY did.** The
app's default has been Grok since 22 August, but a choice you have already made
wins — it is remembered in your browser — so the switch only ever reached new
sessions. Your browser has been holding "Sonnet" since some earlier pick. That
part is working as designed.

**The bug: the chip was telling the truth about everything except the call that
had just run.** Every message you send is first read by a small, cheap step that
decides what you are asking for — build, question, edit, add-on. That step is
supposed to run on whichever model you picked. It never received your choice: the
build, the revise and the edit all sent it, and this one hop did not, so **it has
always run on Grok for everyone, whatever the chip said.**

Why it matters beyond a wrong label: your own rule when we moved off the old
routing model was *"if grok is picked then that will be it"* — the point being
that one supplier should not decide every message. That is exactly what cost us
before, when Anthropic refused on billing and every routing call died in five
seconds. Pinned to one default, we were back in that shape — and Grok's credits
have run dry once already. If that happens now, every customer's message falls
through to "just build it".

**Fixed.** The routing step gets your pick like everything else does.

**And you asked for the picker on the first screen** — *"PUT THE PICKER TOO IN
THE SITESPAGE PAGE, THE ONE BEFORE, AND THEN WHATEVR THE USER CHOOSES THERE IT
GOES NEXT."* It is there now, next to Attach. It was only ever in the workspace,
which is the screen you land on **after** the first build has already started —
so the one build where the model matters most was the one build you could not
choose it for.

Whatever you pick there is what the build runs on, and the next screen shows the
same thing. That needs no plumbing: there is one setting, in one place, and both
screens read it — which is also why it cannot drift out of step with itself.

**Screenshot**: `docs/edits/start-screen-picker.png` — the row closed, and the
menu open. One small thing I had to fix to get there: three separate controls on
that row each wanted to push the others aside, so the chip floated in the middle
of the row looking like a stray. The send button is the one that should hold the
right edge, so the others give way and the controls group on the left.

**Merged and deployed** — run 2042, green in 51 seconds, nothing rebuilt.

**Then you said: make sure whatever the user selects is what carries into the
next, no default — and Grok stays the default for our testing.** I checked it
rather than assumed it, because assuming is exactly what caused the bug above.

Two ways. First in code, against a store carried across a fresh start — which is
what a reload is. Then **in a real browser**, with real storage, a real click on
the menu and a real page reload:

- A fresh browser, nothing chosen: it uses Grok, and **writes nothing down**. So
  the default can never quietly become a choice you did not make.
- Pick Opus → both screens say Opus 5, and it is still Opus after two reloads.
- Same for Sonnet, same for Grok.

And every step that spends a model now carries your pick: the routing step, the
edit, the add-on, the build and the revise. That list is worked out from the code
itself rather than written down by hand — a hand-written list is what let the
routing step slip through in the first place.

**One correction I owe you.** The commit says the test suite is 5,473; it is
5,474 for that commit, and 5,476 now. I ran the suite, then added one more test,
then shipped the older number without re-running. My own rule says a number goes
in only after the run that produced it — I broke it, and the commit message keeps
the wrong figure permanently. The notes and the engineering log are corrected.

**Still not proven in your browser** — this is browser code only, so nothing
rebuilds and there is no waiting period after the push. The proof is your next
load: the chip beside Attach on the first screen, and your pick still there after
a refresh.

**Then: "DELETE THE EFFORT THING FOR NOW."** Done — the composer is now just the
`+`, the Builder chip and the send button (`docs/edits/composer-no-effort.png`).

Worth knowing why it goes so easily: **that dial has never done anything.** You
decided that yourself back on 8 August — *"leave the effort thing off, leave it
there but doesn't work, i want it like that"* — and the build has ignored it ever
since. So what people saw was a five-level control that changed nothing at all.

That is the third dead control found in our own app in a fortnight: the members
icon, the Security panel's "Run scan" button, and now this. The rule we settled
on with the site-card icons holds — a control earns its place by saying something
true. "Not built yet" says something. A dial with no effect does not.

**One thing I did beyond taking the chip away, and it matters.** The setting was
still being sent to the server on every build, and yours was set to Max. With the
control gone you could never see or change it again — an invisible setting stuck
on your most expensive option. Nothing reads it today, but if anyone ever wires it
up, it would quietly apply a choice you made months ago through a control that no
longer exists. That is the same bug I fixed an hour earlier, from the other side.
So the setting comes off the wire too.

**Not deleted, parked** — you said "for now". The machinery is still there with a
note saying exactly which three lines bring it back, the same way the animated-mark
step was parked. Bringing it back means also making it *do* something, or it
returns exactly as dead as it left.

---

## 2026-09-07 — The start screen shows every site you own, from the server

You: *"fix it so the screen shows everysite, server not local."*

**What was wrong, in one number.** That grid read your browser's own storage and
nothing else, and the save keeps **twenty**. Your account owns **51 sites**. So
the screen could show at most twenty of them, only in the browser that built
them, and none at all on your phone or after clearing site data. They were live,
they were yours, they were paid for, and the app could not see them.

**Now**: the app asks the server for your sites and shows all of them. Your
browser still supplies what only it has — the conversation on each site, the
name you typed — and the server decides which sites exist.

**The rule I built it on, because it is the one that can hurt you.** A list we
*could not read* is not an empty list. If the network blips, or you are signed
out, or the database is slow, your existing screen stands exactly as it was —
you never open the app and find every site you own gone. Those two cases are
spelled differently at every step so they cannot be confused.

**One thing that would have shipped broken and did not.** Every card looked its
site up in browser storage. For a site built on another machine that finds
nothing — so the thumbnail would have been blank, clicking would have done
nothing, and worst, the **delete** button would have quietly skipped the real
server-side delete and left the live site running while telling you it was
removed. All three go through the merged list now and adopt the site on first
touch.

**Two things to know before you look:**

1. **I have not seen it in a browser yet.** It is driven by tests and the sweep,
   not by eyes. I will screenshot it before calling it done.
2. **The names will look like `fretwork-1`, `northgroup-9`.** The friendly name
   you typed only ever lived in that one browser. The server knows the slug, the
   address and your original brief; the real brand name sits in each site's own
   config file, which would be 51 reads on one page load. Your call whether that
   is worth a second hop — say the word and I will do it.

Suite 5,442. Sweep 28/28 with its control — one survived the first pass and it
was my test's fault, not the code's, so it was tightened and re-run to a kill.

---

## 2026-09-07 — The build now shows what it is doing

You: *"WHEN THE BUILDER IS DOING STUIFF, IT KINDA NEEDS TO SHOW IT."* Then, after
I drew six treatments and four variants of the one you liked: *"B, BUT LETS EDIT
B"* → *"OK B1."*

**What you were looking at.** That build of `plyhouse` took **17 minutes 8
seconds** and cost 16 credits, and for the whole of it the screen said a spinner
and the word "Thinking…", above a box with a blinking cursor in it.

**Why.** The box was not an empty placeholder waiting for something — it was a
real display wired to a feed the site builder has never sent. Only the game
builder streams; the site builder fires the job and walks away. So that box
could never have had anything in it, on any build, ever. Three more things sat
under that: the poll asking for progress every six seconds read only "still
going" and threw the rest of the answer away; the label on the right was painted
once at the start and never again; and the first thing a build did was announce
"Writing the code" — over the three minutes it spends designing the site,
claiming the address and setting up the database, before a line is written.

**What is there now.** The big panel is the display. It shows the stage the
build is actually in, a line saying what that stage does, a running clock, ticks
for the stages already finished with nothing invented, and four bars that fill as
it goes. The steps on the left move with it. The empty cursor box is gone.

**The one rule I would not bend.** Inside a stage we genuinely do not know how
far along it is — the code the model is writing never leaves its container until
it is finished. So the bar for the stage in progress creeps up with time and
**stops short of the end, always**. Filling it would be the screen claiming a
stage had finished when only the build gets to say that. A progress bar that
invents progress is worse than none, and this one has to be honest for a quarter
of an hour at a stretch.

**Not proven live.** Nothing about progress can be checked from a served file —
your next real build is the proof. What to watch for in the first minute: the
words leaving "Thinking…" and becoming "Planning your site", and a ✓ appearing
as each stage ends.

Suite 5,487. Sweep 30/30 with its control. Five mutants survived a first pass;
four were my tests' fault and one was a wall that genuinely changes nothing today
— I drove all 126 cases to prove that rather than guess, kept the wall, and wrote
down why.

---

## 2026-09-07 — The build shows the code as it writes it

You asked whether the code step showed the actual code. It did not, and the
answer to why is worth keeping.

**The box you were looking at could never have had anything in it.** It was a
real display wired to a live feed — and only the *game* builder sends that feed.
The site builder fires the job and walks away, so there was no open pipe, and
the code itself was sitting inside the container in a variable that nothing read
until the whole thing was finished.

**Now it comes out as it is written.** The container sends what it has every few
seconds, the server keeps the latest, and your browser picks it up on the poll it
was already making. You see the file name and the code filling in, a few seconds
at a time — more like a log filling than a typewriter, which is the honest speed.

**Two things I made sure of.**

1. **It can never cost you a build.** Everything on this path is a courtesy: if
   the display throws, if a send fails, if storage blips — the build carries on
   and you see what you saw a moment ago. Nothing about showing the code can
   take the code away.
2. **Only you can see yours.** This is your own site's source, so the server
   hands it back only inside a check that the build is yours, and only while it
   is actually being written.

**One thing that would have shipped broken and did not.** The new file was
missing from the container's build recipe. The image would have built fine and
then died the moment the first customer's build started — reported to them as
"our build service was restarting", which is the sentence that has already
hidden two other causes here. A check that compares the recipe against what the
code imports caught it before it went anywhere.

**And the checking round found five holes in my own checks, not in the code.**
The way I test this is to break the code on purpose, one small change at a time,
and see whether a check notices. Five changes went unnoticed — each one a case
my tests described but never actually ran, which is the shape that has caught
this project out before. All five are covered now. A sixth turned out to make no
difference at all whichever way it went, so I wrote that down instead of adding
a test that would only have been proving itself.

**Not proven live.** Your next real build is the proof: in the code step you
should see the file name appear and the source fill in under it. This one rolls
the container, so leave 15–20 minutes after it deploys before starting a build
that needs the new code.

---

## 2026-09-07 — The steps on the left, redrawn (you picked E)

I drew six treatments and you picked **E — the dense log**. It's built.

**What changed.** The three bordered boxes are gone. The steps are one
monospace column now, flush left: a mark, the step in lower case, and the time
on the right. The code hangs straight off the step that's writing it, with line
numbers down the side.

**The step that's running says which file it's writing** — "writing index.tsx"
rather than "writing the code". That's the gap I flagged last time: the file
name was already being sent all the way to your browser and had nowhere to
show, because the clock and the name were fighting for the same slot. E gives
it a slot.

**The line numbers are the file's own, and that took real work.** The panel
only ever holds the last few thousand characters, so numbering it from the top
would say "line 1" for what is actually line 47 — a wrong number on your own
code, which is worse than no numbers at all. So the container counts the lines
before it cuts, and the number travels with the text and gets adjusted every
time anything trims it further. If that ever can't be worked out, the numbers
don't appear rather than being made up.

**The finished list matches.** When a build ends, the live list turns into the
summary in place — so if I'd only restyled the live half, the whole thing would
have changed shape at the moment your build succeeded. Both halves are E, and
the failure state keeps its own red cross so you can still tell at a glance.

**And it made an old typo visible: "1 files".** Every single-file build has
said that. The line directly below it has counted properly since the day it was
written. Fixed.

**Not proven live.** Same as before — your next real build shows it. This push
rolls the container, so leave 15–20 minutes after it deploys.

---

## Open — waiting on you

**0x. BOTH SPLITS ARE ON FOR YOUR ACCOUNT — ONE BUILD MEASURES THEM
(2026-09-10, your "switch it on").** Step 1 of what this item used to say is
done: both canaries name your account id, and no customer is on either path.
**What is left is the measurement, and it costs one build.** Build a site
normally. Nothing about the finished site should look different; what changes is
how long it takes, and I will read the trace afterwards and tell you where the
time went. Below is what each half is supposed to buy and what it risks — worth
reading once before you spend the build, because you are the only person who can
say whether the page still hangs together.

**What the design half should buy: wall clock.** The design step is about 170 seconds today,
and the two drawn marks — the logo and the tab icon — are the slow part, because
drawing a picture is a long answer. Splitting puts them beside the plan instead
of in the queue with it. **I have not measured the saving and will not guess at
one.** The first split build is the measurement. (I earlier cited run 41's 292
seconds here as though it sized the marks inside this call. It does not — that
run is the edit lane drawing one mark alone, and the whole call is 170 seconds.)

**What it risks:** four agents that do not see each other's answers within a
round. Each is told what the earlier rounds decided and told the other parts are
being written at the same moment, but a plan and a look decided side by side
could pull apart in a way one call would not have. One build tells you.

**And one trade is already made, on purpose:** if an agent is lost, the design
fails — free and refunded — where the single call would have handed a partial
answer on. Reasoning in the 2026-09-10 entry above; say the word and I will
loosen it.

**0y. THE PAGE HALF OF 0x, same build, same measurement.** Writing a page eight
bands at a time is on for your account too. The page comes out assembled from its
bands; a band that fails is a placeholder and the rest of the page still
publishes.

**What it should buy: wall clock.** The page call is the long step of a build —
measured between five and a half and ten minutes — and eight bands run at once
instead of one after another. **I have not measured the saving and will not
guess at one.** The first split build is the measurement.

**What it risks:** a page whose bands read like eight strangers wrote them. Each
agent is told the whole page plan with its own band marked and is told not to
write the hero, repeat the prices or close the page — but that is a rule, and
rules get read past. One build tells you whether the page hangs together.

**0z. THREE ICONS ON EVERY SITE CARD (2026-09-07, your "A,B,A" then "LEAVE IT
THERE BUT OFF SINCE WE HAVENT DONE THE MOBILE APP THING YET").** What ships:

- **cylinder → the site's Data view.** A site with **no database** shows it
  dimmed with the tooltip *"No database yet — ask for one in the chat"*. That is
  most sites: a first build provisions none. Hiding the button entirely was the
  other option and it is how nobody learns the feature exists.
- **globe → the live site**, in a new tab. Dimmed with *"Not published yet"*
  before a site has an address.
- **handset → the mobile app**, dimmed on **every** card whatever the site,
  tooltip *"Mobile app — not built yet"*. A placeholder for the thing we have
  not built.

**I had it wrong for an afternoon and you fixed it in one line.** I read "mobile
app" as *see it on a phone* — the preview device switch the workspace already
has — because that was the only thing in the tree the words could point at. That
guess was written down as a guess in my reply, which is why it cost an afternoon
and not a feature.

**When the mobile app is real**, three small things: drop `disabled`, write the
tooltip, add what it does. Nothing has to be redrawn.

**Merged and deployed** (your "merge it"): main went to `4995e8ef` at 18:42Z,
deploy run 2039 green in 2m57s, container rolled at 18:44:29Z — so hold off on
container work until about 19:05Z. I read the live files back: the three icons,
the tooltip and the dimming are all being served.

**You looked and nothing was missing** ("NO MISSING"), so both of today's start
screen changes are proven live in the one way that counts: the server-side site
list AND the three card icons, seen on a real screen. Everything I could check
myself was bytes on the wire; only your load could answer whether it renders as
a screen you recognise.

**0y. TWO ICONS OFF THE TOP BAR (2026-09-07, your "DELETE THIS 2 THINGS").**
The **Form submissions** icon and the **Site members** icon are gone from the
right of the workspace top bar.

**The panels are not gone** — both already had their own card in **Cloud**
("Submissions", "Members"), which says what it opens instead of making you
guess from an icon. The two icons were a second door to the same rooms.

**And the people icon was already dead.** It was drawn with a tooltip and did
nothing at all when pressed — no handler was ever wired to it. That is the
"dead control" problem on your backlog, found in our own toolbar rather than in
a site a model built.

**0a. THE CANARY PLAN, REVISED (2026-09-06, your call to run it or not).**
Nothing below has been run. Everything below is on branch
`claude/publish-integrity`, which is NOT merged and NOT deployed.

**What it would prove.** Three things that have never happened live:
1. the job runner — the container has never executed a single job, on any site;
2. stage 7's immutable publishing — fretwork-1 answers `x-site-build:
   mtnfl34h-8uuf06` and **no `x-site-version`**, so it is still on the legacy
   layout and stage 7 has never served a request;
3. that this week's activation corrections still publish normally.

**What it CANNOT prove, and I am not going to pretend otherwise.** The
failed-upload path needs a real dispatch failure. It cannot be provoked on
purpose without breaking a publish, which is the same position 3b's reconcile
is in. Its proof is the next real failure, and the line to read then is *"the
new version was built but couldn't be put live"* where the reply used to say
*"that didn't compile"*.

**COST — measured, estimated, and what is actually enforced.**

| what | credits | where the number comes from |
|---|---|---|
| intent router (`/api/site/route`) | **2** | measured on Grok, 2026-09-01. **Only if you send it as a chat message.** The `lane-sweep` workflow posts the layer straight to the edit route and never calls the router — which is why runs 38 and 39 cost 1 each, not 3. |
| `pick_lanes` + the acting lane | **1** | measured, runs 38 and 39 (one `pageCredits`, floor 1) |
| translations | **+1** | one call per extra language with something new to say, on their own reserve with their own floor. fretwork-1 is `cy` + `fr` + `es`. **Never charged before run 39** — the fix landed after it, so this is an estimate, not a measurement. A css or colour edit adds no new strings and pays nothing here. |
| a correction round (`lane:correct`) | **+0** | rides the same message's bill |
| **total, via the workflow** | **1–2** | 1 for a css edit, 2 for one that changes words |
| **total, as a chat message** | **3–4** | the router on top |

**ESTIMATED IS NOT A CEILING, and there is no ceiling.** `buildFloor` gates a
BUILD before it starts; **nothing gates an edit or an addon**. An edit's price
is metered on real token usage with a floor of 1 per charge and no cap. The
only enforcement is `edit_reserve` REFUSING when the balance cannot cover a
bill — and that happens *after* the model calls have been made, so at a low
balance the work is done and thrown away. Since stage 1a-i that refusal stops
the publish and says so ("there aren't enough credits for it, so it wasn't
published and nothing was charged") instead of shipping free.

**BALANCE: 505 credits** — you said *"Top it up"* on 2026-09-06 and chose the
direct grant at 500. It was 5, unchanged since 2026-09-04 20:48Z, so nothing
had been spent since run 39.

**HOW THE TOP-UP WAS DONE, because it was NOT a purchase and the ledger should
not be read as if it were.** `add_credits(target, amount, cents, ref, mint_key)`
is service-role AND mint-key gated, and `CREDITS_MINT_SECRET` lives in GitHub
Actions, not in a session — so the product's own path was closed to me. The
grant mirrors that function's body exactly, minus the mint check: one
`purchases` row `(500 credits, ref 'grant:session_01Ro69RoRa3qPtpAd3uJk215:
2026-09-06')` inserted `on conflict (ref) do nothing`, and the balance moved
only because that insert landed — the same CTE shape, so the ref IS the
idempotency. **PROVEN, not asserted**: the identical statement re-run
immediately after returned zero rows and moved nothing; balance 505, one grant
row. **`amount_cents` is 0 on purpose** — no money was paid, and a fabricated
figure there is the one thing that would make a Stripe reconciliation lie. To
reverse it: delete that ref's row and subtract 500.

**THE INITIAL-BUILD CANARY IS NOW FUNDED.** A first build is 11–45 credits
(measured range, two builds on one model) and `buildFloor` refuses before
spending; 505 covers it many times over. **What the top-up did NOT do is
create a ceiling** — the entry above still stands: nothing gates an edit or an
addon, an edit is metered on real usage with a floor of 1 and no cap, and the
only enforcement is `edit_reserve` refusing after the model calls are made.
A large balance removes the one thing that was accidentally limiting a
runaway, so the run list below is the budget now, not the ledger.

**THE ASK — deterministic, no invention.** Not "the nearest car parks", which
asks a model for a fact nobody here can check. Instead, on the `text` lane:

> Change the heading above the opening hours to read exactly: Lesson times

The check is an exact string match on the served page — `Lesson times` is
there or it is not — and reverting it is the same ask with the old wording. It
changes words, so it also exercises the translation charge.

**REVERSIBILITY — NOT VERIFIED, and this is the honest state of it.** You asked
me to check that the existing legacy version is really restorable before
calling the canary reversible. **I could not.** The version list lives in R2
and is reachable only through `GET /api/site/fretwork-1/versions`, which is
owner-gated; I have no owner token and will not mint one. `site_builds` has no
version column — it records build RUNS, not versions. So:
- **The free check is yours**: signed in as the building account, open
  `/api/site/fretwork-1/versions`. It costs nothing and changes nothing.
- **What the code says**: `restoreVersion` refuses a build-layout version
  whose script was never saved (`that version's script was never saved`), and
  falls through to `rollbackVersion` — the copy path, with the pointer dropped
  — for a legacy one. So a listed legacy version should be restorable.
- **A fact worth knowing before you decide**: the canary edit is ITSELF the
  migration. fretwork-1 is on the legacy layout today; its next publish moves
  it to `builds/<slug>/<version>/` with a pointer. Going back to a legacy
  version after that is the pointer-dropping branch, **which has never run
  live either**. The cheapest reversal is therefore not a restore at all — it
  is the same edit again with the old wording, one more credit.

**THE ORDER, if you say go.** Merge → wait for the deploy → **hold 15–20
minutes** (the container rolls; `worker.js` and the builder modules are image
inputs) → then, before spending anything, open
`/api/site/runtime?slug=fretwork-1` — free, read-only, and it answers whether
the runner is actually on for that site instead of leaving us to read a
workflow default. Only then the edit.

**0b. DONE 2026-08-29: a TSX step that generates a component the kit has not got** (owner,
2026-08-29: *"what if customer wants something that we dont have in our library,
make a step for that, a tsx step that generates stuff, put it as optional, and
its gotta be after the components step… i know is expensive but well"*). Not
started. The kit is 2,112 components and the `components` field is a manifest
picked from it; this is the escape hatch for the site that needs something the
kit cannot express. **Optional, and immediately after `components`** — your call
on the position, and it is also the right one, since the field only means
anything once the model has tried to find what it needs and failed.

**You chose: the design step declares it, the page step writes it.** Same split as
the photographs — the design decides the site needs one and what it is, another
step makes it. Cheaper too: the design call answers 22 fields under a ten-minute
cap, while the page call streams and has no clock, and the default builder model
is Grok, which is about three times slower writing code.

**Two things I found before building, both of which would have bitten:**

- **The build container is shared between customers.** It wipes one directory
  between builds — the pages — and nothing else. So the obvious version of this,
  dropping the new component into the kit folder, would have left one customer's
  component sitting in everybody else's site. The components go somewhere that
  *is* wiped, and are named so the site never publishes them as a page.
- **Your cheap edits rebuild the site from what is stored.** A page that imports a
  component the rebuild does not send does not compile — so without storing them,
  the first typo fix after a build would have taken the site down. They are stored
  and re-sent on every publish. The end-to-end test caught a missing piece of
  exactly this while I was writing it.

**What it costs:** the design call goes from 89,195 to 91,232 characters, and the
field is optional and absent on almost every site, so an ordinary build pays
nothing for it. Cap of three, and the wording tells the model to search the kit
first and say what it searched for — a component we build that the kit already
had is the expensive mistake here.

**0e. DONE 2026-08-30: the 3D scene actually gets built now.**

You asked me to fix it and it is fixed. Worth being straight about what happened,
because it is the same mistake twice on one small feature.

When I added the 3D step I wired it to the design call and nowhere else. The model
decided a scene on every build and the answer was thrown away before anything
could use it. I found that a day later and fixed the storage half — and then
reported it as "stored but not yet reaching the page", which was accurate and
still left the feature worth nothing.

This closes the second half: the scene the design step decided is now handed to
the step that writes the page, so a canvas actually gets built.

**The instruction never needed changing.** The page rules already said "write a
canvas only where the design step asked for it" — a perfectly good rule, waiting
on a message that was never sent. That is the thing I keep having to relearn here:
when a feature comes back empty, check whether the answer can physically arrive
before touching any wording.

**0d. DONE 2026-08-29: renaming a site — the last unbuilt lane** (owner: "now the
slug lane", then "yeah do the alias one").

**Every lane on the platform now does something.** `slug` was the last one that
did not.

**Nothing moves when a site is renamed.** I looked at doing it "properly" —
copying everything to a new name and deleting the old — and it is the wrong
trade. A site's name is the key to five database tables, seven storage areas and
its own Worker script, and there is no way to rename storage: you copy it item by
item, and if that stops halfway the site is half at each address with no way
back.

And the safe version needs nothing extra. Either way we have to remember the old
name belongs to that site, because **the old address has to keep working** —
people print it, put it on vans, and as of today we put it on QR codes — and
because the old name has to stay taken, or the next customer to ask for
`shoeroom-1` takes over an address a live site is still sending people to. Once
you have that record, the copying buys nothing.

So: the site keeps its internal name, gets a new public one, and the old address
permanently redirects. Reversible, and nothing can half-fail.

**One thing to know, and it is permanent:** a site's storage name and its web
address can now be different. That is fine and invisible to customers, but it
means nothing in the code may assume they are the same — it is written into
CLAUDE.md as a standing trap.

**The table is made and it is live** (2026-08-30). I checked it works rather than
assuming: the rule that a site can only have one current address is enforced by
the database itself, and I proved it by trying to give one site two addresses and
watching it get refused. Nothing else in the table, and only our own server can
read it.

So renaming works now. Worth knowing what a customer sees: they say "rename it to
sunset shoes", the site answers at the new address immediately, and the old
address keeps working and sends people to the new one — forever, so printed
cards, links and QR codes all keep working.

**It will not guess.** If they say "change our address" without saying what to, it
asks rather than picking something. That is deliberate and it is the opposite of
how every other edit behaves: everywhere else a wrong guess is visible and you can
just tell me to change it back, but a redirect is permanent, so a guess here is a
mistake nobody can undo.

**0c. DONE 2026-08-29: a QR code and an animated mark, both optional** (owner:
*"qr code maker as optional, also gif maker as optional too, in the design
step"*, and on the second: *"just like a svg step, a gif step to generate gif"*).

**The QR.** You chose "a QR code ON the site" — a menu, a booking link, a wifi
network — rather than a generator the visitor drives. The design step says what
it points at and what the words beside it are; **we draw the code**, at build
time, so it costs a visitor nothing to load. The model never draws one, and that
is deliberate: a QR is real error-correcting maths, and a subtly wrong one looks
exactly like a working QR and simply does not scan. Nothing we have could catch
that — not a build, not a screenshot, only a phone in somebody's hand. So the
code comes from a proper library, and there is a test that checks our drawing
against that library square by square. Two rules the model is held to: it may
never invent a destination (a QR is the one thing on a page somebody can't read
before trusting it), and a code with no caption is a black square nobody scans,
so both are required together.

**The animated mark.** Built exactly as you said — the same step as the SVG one.
The model draws one document, the same validator checks it, and a bad one is
refused whole and the site simply has none. **What it produces is an animated
SVG rather than a `.gif` file**, and I want to be straight about that rather than
let the name imply otherwise: for a small loop on a website the SVG is better on
every count that matters — a few hundred bytes instead of a few hundred
kilobytes, sharp at any size, and it picks up the site's colours because it is
part of the page. A real `.gif` needs an encoder and a frame renderer in the
build container and buys nothing for a site; worth doing only if you ever want
these shared *off* the site, and it is written down as that.

One thing I had to add for it: animation lets a drawing change an attribute
rather than write it, so a mark that isn't allowed to contain a link could have
*animated* one into existence. It can only animate something it was already
allowed to write.

**0a. DONE 2026-08-29: three.js and WebGL as OPTIONAL design fields** (owner:
*"we are adding more tools, as optional — three.js and webgl"*). Shipped, then
found to be **stored nowhere** and fixed the next day — see the bug entry below.
The two things that bit, both worth keeping:

- **A new design field MUST get an edit lane.** `test/edit-lanes.test.mjs`
  asserts the design tool's fields and the edit path's lanes match **in both
  directions** — a field the build can produce with no lane is a part of a site
  the customer can never change again. Adding two fields makes it 19 lanes, and
  each needs its four-part rule (`is` · `yours` · `wide` · `keep`) or
  `laneRule` throws at module load. Decide early whether they ACT (edit the
  stored value), DISPATCH (another rung does it) or ESCALATE.
- **The library has to actually be installed, or every build fails.** The page
  prompt says *"Import nothing that is not already a dependency"* and, of
  animation, *"there is NO animation library installed and none is needed — add
  one and the build fails."* So this is a template change (`builder/lovable/
  template`) before it is a prompt change, and the container image has to roll —
  15–20 minutes after a push that touches `builder/`.

Worth deciding at the same time: whether a WebGL site is a third `kind`
alongside `shopfront` and `tool`. `kind` is answered before the plan and every
later answer follows from it, so if these sites are shaped differently that is
where it belongs — and `kind` already gates the chart catalogue, so the
machinery for "this kind gets different instructions" exists.

**0a-2. DONE 2026-08-29: the design step now plans BEHAVIOUR** (owner: *"update
only the frontend design step to plan behavior… for every interactive component
the design output must specify what triggers it, what it does, what it affects or
opens, what result the user should see, and whether the behavior is built into
the selected TSX component or requires custom behavior"*).

Every button, link, form, tab, filter, menu and carousel now gets an entry with
those five answers plus the name of the control itself, so an entry can be found
again later. **Any behaviour at all** — there is no list to choose from, which
was your instruction and is also the only version that survives contact with real
briefs. It is answered **last** of the design fields, because a control cannot be
described before the page that holds it exists.

**It decides and records; nothing generates from it yet** — your call, and it is
written into the code and the guards so nobody reads the empty hop as a bug. The
matching edit lane **acts** rather than dispatching (*"try and make it more
universal, whatever the user asks, like we been doing it"*), so changing what a
control does is one cheap call, not a page rewrite. One consequence to know: until
behaviour is generated, editing it changes the record and the visitor sees no
difference.

**What this was really about.** `northgroup-17` shipped with its stage filters,
its "New deal" button and every deal row all pointing at the section they were
already sitting in — dead controls, while the reply claimed the filters worked.
I checked the other 100 sites before agreeing on a fix: only 31 in-page links
across the whole corpus and 6 self-referential ones, so `northgroup-17` is an
outlier rather than the platform. The honest diagnosis was never "the model
ignored a rule" — **there was no rule anywhere.** Now there is a field.


**0. The edit step is finished (`slug` shipped 2026-09-02, and `forget` with
it); ADDON was split off the build's designer the same day — see the dated
entry at the end. What follows is the status as it stood on 2026-08-29.**
Your drawing is at **`docs/architecture.md`**. **EDIT** now: 17 lanes, all
addressable — 8 edited in the edit path itself, 6 dispatched to the rung that
already does that work, `pages` acting through three verbs (add/remove/move),
`kind` escalating to the build rung, and **`slug` the one genuinely unbuilt lane**
(a real address change: republish under a new name, redirect the old, keep custom
domains pointing at it). Every lane has a four-part rule with a per-field ceiling.
Every lane the customer names runs — none is dropped — and **one message is one
publish**.

**ADDON still calls the build's designer** with the whole 84.8k tool to add one
page. Identical defect to the one the edit step had, and the obvious next job.
**DELETE parked at your word.**

Two things I want you to push back on if I read you wrong:
- **Every prompt is still a placeholder** (7.8k of my wording), waiting on yours.
  One `hint` and four rule parts per lane, all in one table.
- **Nothing has run on a real site.** 4,467 tests, zero live edits, balance 0.
  Every claim above is "tested", never "proven live".

**1. The model account is at 18 credits — under the price of one build.**
Five shipped features have never run on a real site and all five ride the same
build: the model-drawn favicon, the drawn wordmark, the composed share card, the
share-image picker, and the standard head tags. **One top-up proves all five at
once.** (Verified against the ledger 2026-08-28. Note the building account is
`aniascristian@gmail.com`, not the address these notes are addressed to.)

**2. Every scheduled job on the platform has never sent anything.**
26 jobs, all switched on, zero sends ever — verified live: 11 report "the site's
database is unreachable", 11 "this job is no longer part of the site", 4 have
never run. One wrong line repeated in three places passes the wrong kind of value
to the lookup. **Deliberately not fixed**: switching it on starts 26 real email
and SMS senders on real customers' sites. Ten-minute change when you say so.

**3. No card has ever been charged.** The payments path is built and tested and
has never seen a real Stripe key on a real site. Needs one test-mode key.

**4. Spam protection (Turnstile) has no live proof, and SMS cannot have a free
one** — SMS needs a real Twilio account and every message costs money.

**5. Two Neon projects are still billing for nothing.** `orange-frog-62041286`
and `soft-tree-10362597`, left behind by early smoke runs before the teardown
queue existed. Delete them next time you are in the Neon console. (Every project
since is cleaned up automatically — the queue fires on the row being deleted.)

**6. Kling and Gemini have no tier badges** — *"i will do kling and gemini
later."* The price tables are settled; the labels are yours to write.

**7. Leaked-password protection is still off in Supabase Auth.** One toggle: it
checks new passwords against HaveIBeenPwned. Verified still disabled 2026-08-28.

---

## Open — bugs and gaps

**Fixed 2026-09-07 — the Preview panel was showing your sites with the
JavaScript switched off**

You spotted this as *"I CANT SEE THE 3D THING"*, then nailed it yourself:
*"ITS PREVIEW THING, BECAUSE ON THE URL SHOWS FINE."* You were right, and it was
bigger than the 3D box.

- **What was wrong.** The Preview panel shows your site inside a locked-down
  window. The lock was one notch too tight: it stripped the site of its own
  identity, and a site with no identity is not allowed to load its own code. So
  the panel showed the page's text and pictures — which arrive already
  written out from the server, which is why it looked complete — and then
  nothing else ever ran. **Not just the 3D box: the language switcher, the
  accordions, the forms and the calendar were all dead in that panel too.**
  Your published sites were fine the whole time; only the preview of them was
  not.
- **Why the two screenshots disagreed.** You were looking through the Preview
  panel and I was looking at the site directly, which is why mine had the guitar
  and yours had an empty grey box. Same page, two different windows.
- **The fix.** One permission on that window, and it is not a loosening: it lets
  the framed page be *itself*, never our app. There is one case where that
  permission would be dangerous — the old draft preview, which really is served
  from our own address — so the code works it out per site and, whenever it
  cannot be certain, keeps the old tight setting.
- **It covers every site, old and new, with nothing to republish.** The change
  is in our app rather than in any site, so it applies the moment it deploys.
- **The proof, before and after:** `docs/edits/preview-sandbox-fix.png`.
- **Not proven live yet** — the next time you open a site's Preview after this
  deploys is the proof. The 3D box should show the guitar and the switcher
  should work inside the panel.
- **The thumbnails on the start screen are deliberately left as they are.** They
  have the same limitation, and there it is the right trade: that screen draws
  one little frame per site — 51 of them on your account — and letting each run
  its whole app would mean starting fifty-one apps to draw fifty-one stamps.

**Live bugs**

- **3D scenes come out grey instead of wearing the site's colours (open, your
  call).** Separate from the preview fix above, and smaller than I first said.
  When you asked about the 3D box I told you the guitar was "white on white and
  therefore invisible" — **that was wrong, and I'd measured it badly.** Read
  properly, the guitar has real contrast: it is plainly there, just grey rather
  than themed. What is true is that the 3D part cannot read the colour format
  our themes are written in, so it falls back to its own default grey and
  ignores your palette. The fix is to write the colours out in a second, older
  format alongside the modern one at build time, so the 3D part can read them.
  Worth doing for new builds; nothing is broken without it.

- **The gif step is gone (2026-08-31, your call).** You asked for it deleted "for
  now", and it is off the design step — no future build will be asked for an
  animated mark.
  - **It did work.** `washhouse-1` and `washhouse-3` both have one today. The
    laundrette's is a washing-machine drum: a ring and three dots going round
    once every six seconds, in 534 bytes.
  - **What killed it was the word, not the thing.** You asked for a gif; what it
    makes is an animated SVG. On the site that is better in every way — a
    hundredth of the size, sharp at any size, and it uses the site's own colours.
    Off the site it stops moving: paste it into WhatsApp or an email and you get
    a still picture. So the one thing "gif" promises is the one thing it cannot
    do. If you ever want the pasteable kind, that is a different job — encoding a
    real `.gif` — and only worth it if sharing it is the point.
  - **Your two live sites keep their marks.** I deliberately did not rip the
    feature out by the roots: the storage and the publishing still carry it, so
    those two sites go on serving what they have. What they lost is the ability
    to *change* it.
  - **Putting it back is one line plus its edit lane.** Nothing else moved.
- **Run 92 PUBLISHED (2026-08-31): `fretwork-1` is live at
  https://fretwork-1.gofarther.app/ — 12 credits.** The build that finally
  answered the question runs 90 and 91 were bought for: **the model wrote its own
  component.** One, called `chord-diagram` — the chord box, used eight times.
  - **All eight chord shapes are musically correct.** E, A, D, G, C, Em, Am, Dm.
  - **It cost about 1 credit — under a penny.** 5,017 characters of code at
    Grok's output rate. It is extra words in a call that was already happening,
    not a second call.
  - **It also wrote the bit our own kit refuses to do.** Our components avoid
    drawings because a screen reader cannot read one. This one draws the diagram
    *and* writes it out in words underneath for anyone who cannot see it.
  - **One bug of ours, found by it**: the check that opens every page after a
    build also tries to open the new component as if it were a page, gets a 404,
    and puts two false "a page didn't load" warnings on your response. Not fixed
    yet.
- **The whole cheap edit ladder was down, and builds were fine — fixed
  2026-08-31, your call.** I bought an edit to test the `css` step and it came
  back in 5.3 seconds having done nothing and charged nothing: *"The site builder
  is temporarily unavailable."*
  - **Anthropic had refused us on billing.** Every small call on the platform —
    the bit that reads your message and decides what you meant, the bit that
    picks which part of the site to change, and all eight of the cheap change
    types — was hardcoded to one Anthropic model. Builds run on Grok, so they
    carried on working perfectly while every edit on the platform failed.
  - **Now they all use whichever model is picked.** Pick Grok and there is no
    Anthropic anywhere in your path; pick Sonnet and there is no Grok. One
    provider having a bad day can no longer take out half the product.
  - **A sweep caught a real gap while I was doing it**: I had threaded the model
    through the router and it silently ignored it. Every readable check passed —
    the code looked right — and only actually running it showed the value never
    reaching the wire. There is a test that does that now, for all eight.
  - **Still to do: the edit test itself.** Run 93 never got as far as the `css`
    step, so we still do not know how that step behaves. That is the next run.
- **Run 91 PUBLISHED (2026-08-31): `coalhole-2` is live at
  https://coalhole-2.gofarther.app/ — 11 credits.** Same theatre brief that
  killed run 90, built clean this time: one page, 8,967 characters, 291 seconds.
  - **So the repeated line was a one-off, not a fault in the path.** The stored
    page imports `createFileRoute` exactly once. Nothing was wrong with the
    feature run 90 was testing.
  - **And the kit already had the hard part.** It reached for `SeatMap`,
    `AvailabilityLegend`, `Tabs`, `AdmissionPrices` and `EventCard` and wrote
    **no** hand-made components — a 48-seat plan with the pillar seats marked
    restricted, a second plan for cabaret nights with row A as tables, and
    tapping a seat tells you the number to give on the phone. It decided there
    should be no booking form, "because there is nowhere for it to go", and said
    so in its reply. That is the right call and it named it.
  - **11 credits, not the ~45 a first build cost on run 80.** Both are real
    measurements of a first Grok build; the number depends on the site, so treat
    ~45 as the top of the range rather than the price.
  - **The store is proven working on a real build**, which the build alone could
    not show: the page was read back out of storage afterwards, in full, for
    nothing. That read is a button now — Actions → "answer read" → the slug.
  - **One thing did not go to plan and is worth knowing.** The build log itself
    did NOT print the page: the runner stopped watching at 10.1 minutes with the
    generation still finishing, so it had no result to work from even though the
    site had already published. The log is a snapshot of what one runner saw;
    the store is the record. That is exactly why the separate reader exists.
- **Run 90 FAILED (2026-08-30), and I could not tell you why — which is the part
  that is now fixed.** The build died with one line:

  ```
  Error transforming route file /app/src/routes/index.tsx:
  SyntaxError: Identifier 'createFileRoute' has already been declared. (3:9)
  ```

  The model wrote the same line twice at the top of the page. A computer will not
  accept the same name introduced twice, so it stopped reading and there was no
  site to publish. **You asked four times why it repeated the line, and every
  answer I gave was a guess** — because we only saved a page's code when a build
  *worked*, so the file had been thrown away.
  - **Not a type error, and that matters.** Your "ship it even if it's broken"
    change covers a page whose *types* are wrong; this page could not be *read* at
    all, and there is genuinely nothing to publish from a file that will not parse.
  - **What is fixed (2026-08-30): the file is kept now, win or lose.** The model's
    answer is stored the moment it arrives, before anything is allowed to refuse
    it, under its own key so a broken answer can never become the site's source.
    The build log prints the whole page when a build does not publish clean.
  - **And the repeat itself is walled off now (2026-08-31, your call).** Before
    the page goes to the compiler we look at the list of imports at the top and,
    if the identical one appears twice, delete the second. Removing an exact
    duplicate is a no-op — same names, same place, twice and once mean the same
    thing — so there is nothing to get wrong, and it costs nothing: no model
    call, no build, no credits.
    - **Not a prompt rule, which you asked about and were right to.** A rule is
      something a model reads past: runs 84 and 85 both died on a component whose
      own documentation already said what it does, including after I rewrote the
      instruction between them. And this is not a decision to argue with — it is
      a slip partway through nine thousand characters.
    - **It only removes an EXACT repeat.** Two imports that overlap without being
      identical still fail, on purpose: merging them is a guess, and a wrong
      guess compiles and ships the wrong thing, which is worse than a failed
      build. Now that the file is kept, I can read those if they ever happen.
    - **Measured, not argued**: run over 3,736 real files — every page in the
      calibration corpus and the entire component kit — it rewrites none of them.
      That is the bar here before a check ships, because a check that flags good
      code is worse than the problem it prevents.
  - **What I still do not know is WHY it repeated the line**, and I am not
    guessing again. It cannot take a site down any more, which is the part that
    was costing you money.
- **Run 84 FAILED (2026-08-30), and it failed ON the thing you asked me to test —
  8 credits.** You asked for a build with a QR. I gave it a laundrette brief where
  a code on the screen is the obvious answer (the wifi password). **The design step
  DID ask for a QR** — that was the open question and it is answered. The page then
  broke writing it.
  - **Why**: the kit has two captioned picture components and their names do not
    tell them apart. `Figure` draws its own picture and takes nothing inside it;
    `MediaCaption` takes the picture inside it. The QR has to be put inside one.
    The model picked the one whose name matched the job. Fixed by naming the right
    component where the model is told about the QR, plus a check that keeps the two
    honest with each other.
  - **And a bigger thing fell out of it.** The rescue step that is supposed to save
    a build when one page will not compile **cannot run on a new site at all**. A
    new site is one page; that page is the home page; and the rescue step refuses
    to replace the home page. Both halves are sensible on their own and together
    they cancel out. It was fine when sites had five pages and quietly stopped
    working when we moved to one. Your placeholder still goes up, so nobody ever
    gets a blank site — but the second safety net has been dead for weeks and
    three of today's four paid builds ended on the placeholder because of it.
    **Not fixed, because it is your call**: should a site whose only page is broken
    go live as an apology page, or keep the placeholder? I lean to the placeholder.
- **Fixed 2026-08-30, your call: a broken page SHIPS now.** You said it plainly —
  *"I want it to ship as it is, dont matter if its anything broken, even after is
  reviewed by the compiler"* — and there was one gate still doing the opposite.
  - **Four paid builds died on it today** (runs 80, 82, 84, 85), every one of them
    a *type* error, every one leaving you charged with a placeholder site.
  - **And none of them had to.** The typecheck is a check *we* run; the thing that
    actually builds the site ignores types completely. I proved it on the exact
    page that killed two of those runs: the typechecker refused it, the builder
    produced the whole site in seven seconds. **All four would have gone live.**
  - So the typecheck now *reports* instead of refusing. The site ships, and the
    reply tells you which bit is shaky and to send it again. The only thing that
    still stops a build is the site genuinely failing to build — a missing file, a
    syntax error — where there is nothing to publish at all.
  - **The lesson worth keeping**: before spending money hardening a gate, check
    whether the step below it needs the gate. Four builds went on teaching a
    checker to pass when nothing downstream was asking.
- **Run 83 PUBLISHED (2026-08-30): `ashgrove-1` is live at
  https://ashgrove-1.gofarther.app/ — 17 credits.** Third attempt, first success,
  and it cost a third of what the failed first build did: a revise anchors to the
  design already stored, so the expensive decide-everything half does not re-run.
  **A first build is ~45, a revise is ~17** — worth knowing when you are pricing
  this.
  - **The 3D chair is real WebGL, not a picture.** three.js, modelled in code
    from boxes and cylinders, two lights, and the drag-to-turn written by hand
    because the off-the-shelf orbit control is not a dependency. It got
    `setPointerCapture` and `touch-none` right unprompted, which is what makes it
    work on a phone instead of fighting the scroll. **It costs 992 KB of
    JavaScript**, and that lands on any site that asks for a scene — worth a
    thought before this becomes common.
  - **Also proven live for the first time**: the favicon, the wordmark, the head
    tags, the share image picking your own upload over the generated card, and
    the rule that a *tool* page buys zero photographs.
  - **The QR and the animated mark: checked, and they work.** They did not appear
    on this build, so I went looking for a cut wire and did not find one — they
    are offered on every build and reach the page correctly. What I DID find is
    that **nothing had ever actually built a site carrying either of them**; the
    test that claimed to cover it was reading the code rather than running it,
    which is the same miss that cost the first failed build. There is now a real
    build in the test suite that ships both, and it passed first time.
  - **Why this one had no QR is a judgement, not a bug, and I think it is right.**
    Your brief says every chair leaves with a card carrying a code you scan. The
    QR belongs on that printed card, pointing at the site — the site's job is to
    *answer* the code, which is exactly the chair register it built (AG-0161,
    Ruth Hale, ash, linseed). Putting a QR on the page would be the site linking
    to itself.
  - **One visible bug on the live page.** The option list prices English oak at
    **+£16.40** while the total underneath says **£1880.00** — same rows, one of
    them divided by a hundred. The kit component wants pence and was handed
    pounds. Not fixed; you have not asked, and it is a five-minute change
    whenever you want it.
  - **The raw hex colour again**, third run running. Reported every time, never
    enforced, so it ships every time.
- **Fixed 2026-08-30: two paid builds of `ashgrove-1` died at the last step, and
  neither failure was the model's fault.** You funded the build, it ran, and both
  times the site kept its placeholder. **63 credits between the two runs** (45 +
  18, read off the balance — nothing records what a build costs, which is its own
  small gap).
  - **Run 80 — `three` ships no type declarations.** I wired the 3D step up the
    day before and put `three` in the template's dependencies without
    `@types/three`. The moment a model wrote the import the step invites, the
    typecheck refused. **The instructive half is why nothing caught it: the field
    had been DEAD until that same day**, so no page had ever imported `three` and
    the missing declaration was unreachable. Wiring a feature up is what makes
    its defects reachable — a feature that has never run has never been tested,
    however green the suite is.
  - **Run 82 — a reasonable page broke a file it had never seen.** The model
    wrote a configurator and put its state in the URL (required search params on
    `/`). In TanStack, that retypes `/` for the whole app, and two links in the
    KIT — files the model cannot see and could not have fixed — stopped
    compiling. Salvage rightly refused to stub a foreign file, so the whole build
    died. **Any customer asking for anything with URL state would have hit this.**
  - **What has changed**: the types are installed and pinned to the same minor
    line; the kit's literal links are plain anchors; and there are now two
    container fixtures — one importing every package the page rules advertise,
    one declaring required search params — so both failures reproduce for free
    instead of on your balance. I also found and fixed a **third** copy of the
    same link defect (`manage.tsx`) that neither run had reached yet.
  - **The uncomfortable finding behind run 80**: the page rules promise the model
    five packages it may import, and **not one had ever been compiled** — 0 of 5
    in fixtures, 0 of 324 real generated pages. All five were promises nobody had
    checked. `three` was simply the first one a model reached for.
- **Found and fixed 2026-08-29: the 3D step shipped dead the same day it shipped.**
  You asked for three.js/WebGL as an optional tool that morning, and it went in
  with its lane, its guards and a green suite. It was never *stored*. The design
  step asked the model for a 3D scene on every build, the model answered, and the
  answer was thrown away one step later — so no site could ever have got a scene,
  and nothing anywhere would have said so. Found the next day by tracing every one
  of the 21 design fields to whatever actually consumes it. My miss, and it is the
  same miss this codebase has now made a dozen times: the piece was written
  correctly and one wire was left off. The scene is stored now. **It still does
  not reach the step that writes pages** — that is a second wire, and it is
  written down rather than quietly assumed. *Not proven on a live site.*
- **Fixed 2026-08-29 (the second half): the same refusal was in the shared
  publish step.** The first fix opened the two lanes and the change then hit the
  same wall one level down — the step every cheap edit publishes through asked
  for a database too. So *nothing* cheap worked on a site without one: not a
  wording fix, not a menu change, not a photo swap. **20 of your 47 sites** are
  in that state; the older ones (the-lido-cafe and its era) have databases and
  were fine, which is why this never showed up before. Now it asks whether the
  site *exists* rather than whether it has a database. Proven by driving the real
  route; not yet proven on a live site.
- **Fixed 2026-08-28: every colour change cost ~17 credits instead of under one.**
  The cheap CSS editor refused to run on any site without a database — and a new
  site doesn't get one unless it needs to store something, so this was most of
  your sites. The change got bumped up to the full page rewrite every time. The
  logo swap had the identical fault, and that rung is supposed to be free. Found
  by running a real edit on `shoeroom-1`: "make the footer black" worked, looked
  right, and quietly cost 17. Neither lane ever used the database it was asking
  for — the stylesheet and the logo live in file storage. *Fixed, with guards and
  a mutation sweep; not yet proven on a live site (needs credits).*

- **Fixed same day, never reached a site: the canonical was malformed on every
  page but the home page.** The head tags shipped 28 August glued the site's
  address (which ends in a slash) to the page's path (which starts with one), so
  `/menu` declared itself as `https://slug.gofarther.app//menu` in both its
  canonical and its share link. That is not a cosmetic slip — a browser reads
  `//menu` as a different *site*, so the tag would have pointed search engines
  away from the site entirely. Caught the same afternoon; the last site published
  was 11 hours before the bug existed, so no customer site ever carried it. Worth
  knowing because it says something about the tests rather than the code: both
  the unit guard and the container harness certified it, because the harness's
  fixture had typed the address by hand and got that one slash wrong. The fixture
  now comes from the real code instead.

- **`Tooltip` crashes any page that uses it.** The kit's `Tooltip` is a bare Radix
  root with no provider, nothing mounts one at the app root, and `tooltip` is in
  the list the generator is told it may use. It typechecks, bundles, publishes,
  and throws when a visitor loads the page. Two-line fix either way (self-provide,
  or mount one at the root) — flagged rather than chosen. *Verified still true
  2026-08-28.*
- **Fake controls on one-page sites.** On `northgroup-17` the stage filters, "New
  deal" and every deal row link to the band they already sit in — 15 of 24
  in-page links are dead by construction — while the builder's reply claims the
  filters work. The fix is a structural lint: a link whose target is its own
  ancestor is dead. Not built.
- **A brand-new site is unreachable for roughly its first minute** after publish.
  Warming it at the end of a build is an unmade decision.
- **A price change once failed with nothing applied**, on a table where a row
  could be removed and restored seconds later. Never diagnosed.

**The media side (gofarther.dev)**

- **The landing filmstrip 404s on every view.** It draws cells from
  `/mkt/f1.jpg`…`f14.jpg` and none of those files exist — ~14 failed requests per
  landing view. Either drop real output in, or gate the strip until the files are
  there. *Verified still true 2026-08-28.*
- **The Media Agent's "Schedule post" tab is frontend only.** Composing queues to
  `localStorage`; nothing publishes, and the media is previewed locally rather
  than uploaded. The composer says "Preview · not published yet", so nobody is
  misled — the Composio wiring is the pending half.
- **Some fal price cards are unverified**: Seedance Fast/Mini and the reference
  cards, the Fast-reference-at-4K tier question, and the 0.6× video-reference
  billing basis. One live check each, whenever you next fund a sweep.
- **Dead CSS**, four blocks: the removed sidebar nav, the orchestrator upsell,
  the CRT knobs/HUD, and about half the old Morphic landing. 100% inert —
  cosmetic debt, and by your own rule it should go.
- **SSRF DNS-rebinding is deliberately not fixed**: the link-fetcher blocks
  internal addresses but never resolves DNS, so a public hostname pointing at a
  private IP is not caught. There is no clean Cloudflare Workers fix — no DNS
  resolution API — so this is a known accepted risk, not an oversight.

**Things the builder still cannot do**

- **Turn a constraint OFF** (uniqueness, no-overlap, one-per-customer, row caps)
  or change which columns one covers. There is not one `DROP INDEX` in the repo.
- **Rename a site's web address.** A customer whose site says "The Chair Room" at
  `sharp-fade-barbers.gofarther.app` is stuck with it; the only exit is
  delete-and-rebuild, which loses everything.
- **Add any third-party tag** — Google Analytics, Meta Pixel, a chat widget,
  Calendly. Structurally impossible under the published-site security policy.
- Drop a table, bulk-delete rows, use an external image URL, set a page to
  no-index, offer social sign-in to a site's own members, or set per-site rate
  limits.
- **Per-page share previews** are still site-level only.
- **Right-to-left has never been built live.** The machinery works and is proven
  in a browser; no designer has ever chosen it on a real build (four Arabic
  attempts, no site).

**Known-inert and worth a decision**

- **~17 schema features are parsed, stored and acted on by nothing** —
  `transitions`, `sla`, `roundRobin`, `assignBy`, `webhooks`, `geo`, `currency`,
  `formulas`, `searchWeights`, `jsonShapes`, `checks`, `computed`, `defaultSort`,
  `fieldRoles`, `teamRead`, `approval`, `sequence`. Nothing can declare them, so
  no site is broken — but by your own rule they should go.
- **There is no linter in the repo.** `no-undef` alone would catch the class of
  bug that has caused three separate total outages (a name used but never bound —
  it passes `node --check`, bundles, and throws at runtime).
- **The `access` field is marked required while the tool tells the model to leave
  it out** — a contradiction in the highest-leverage prompt.
- **The Data panel mislabels a table declared as a read/write pair** and offers an
  "email me on submissions" toggle on a table nobody can submit to. Harmless.
- **Three Cloud cards are still dead**: Edge functions, Emails, Files.
- **`claim_token` has no backfill** — bookings taken before a manage-page edit
  cannot be managed by the customer who made them.
- **97 kit components draw a supplied link as a plain anchor**, so on the
  `/s/<slug>/` mount they full-page-reload instead of routing. Not broken on the
  real `.gofarther.app` address.
- **The mobile menu**: a site's primary button sits outside the sheet, so it is
  unreachable while the menu is open, and the panel is two links in a tall wide
  box. True of every site we build — design decisions to make on purpose.
- **`build smoke` still has ~40 checks written for a build that has a database**,
  which a frontend-first build correctly does not have. It stops with one honest
  failure instead of pretending.

---

## What is live

**The builder.** A customer describes a business in chat and gets a published
site at `<slug>.gofarther.app`. One design call decides everything: what KIND of
thing it is (a shopfront or a working tool), the theme (from 500, shown a
100-name shortlist), a drawn favicon, the logo (the name in type or a drawn
wordmark), the page's shape from a 13-shape reference book, up to 15 components,
the photographs, and its own stylesheet. **One page, one job** — a band that is
really a second screen is left out rather than stacked below.

**Editing.** Cheapest rung that can express the change: words (free), rows and
list order, schema rules, the look, a photograph, the logo, the menu and footer,
one page's layout, and only then a full page rewrite. An edit changes what was
asked and nothing else — a tweak that moved the words is thrown away.

**Every site gets, free:** a share card composed at build time (the name and
description on the theme's own paper, 1200×630), a real tab icon, a home-screen
icon, the standard head tags every site on the web has, a sitemap, honest 404s,
redirects when a page is renamed, and an error panel that tells you when a
visitor's browser hit a problem.

**The owner's own controls** (Cloud): Files with the link-preview picker, Data,
Members, Domains, Secrets, Backups (nightly, kept 7), Version history with a real
restore, Security log, Errors, Analytics, and an on/off switch per scheduled job.

**The media side.** The chatbox at gofarther.dev generates images, video and
voice through a curated lineup of models, metered in credits at 1 credit =
$0.008 of provider cost. An orchestrator writes the prompt from what you typed (and searches the web
when the request needs current facts), but it never touches a setting you chose.
Gallery, avatars and chats sync across devices; a universal memory learns your
taste from ordinary conversation and applies it to every generation, with no UI
of its own. The Media Agent reads Instagram and YouTube and auto-replies to
comments; DMs are blocked pending Meta's review.

**Payments and mail are bring-your-own.** You paste your own Stripe key and your
own mail key into a site's Secrets; we are never in the money flow and take no
cut. Our own sender is for signing in to Go Farther and nothing else.

**Analytics is collecting** and has been since 15 August: 451 page views in the
7 days to 28 August across ~25 sites. Cloudflare → Analytics → Web Analytics, or
the free `rum report` check.

---

## Parked — do not build until re-opened

- **The 8 home presets** (Blitz Motion and the rest) — *"forget about them for
  now."* Assets kept: Blitz Motion has an approved sample prompt and model pick.
- **The voice lane on the landing filmstrip** — built and removed twice. The
  second removal was a wrong-project merge, not a design rejection; the bigger
  300×118 version is the one you approved visually.
- **Luma Reframe** — offered, declined. Do not re-pitch.

---

## Names that must not be renamed

The brand became **Go Farther** on 2026-08-30 and everything a person reads was
renamed with it. The strings below were NOT, and must not be: they are not
branding, they are identifiers something outside this repo already wrote down.
`test/brand-rename.test.mjs` reads this very list and fails if one goes missing,
so adding a name here is what puts it under guard.

| Name | What breaks if it is renamed |
|---|---|
| `isibi:meta` | the fence is already inside the HTML of every published site in R2 — rename the reader and no existing site's metadata can be found |
| `$isibi$` | the Postgres dollar-quote tag wrapping model-written function bodies |
| `isibi_` | the RLS policy name prefix on every table in every customer's Neon database |
| `isibi_slug` | metadata on Stripe intents already in flight; rename it and their webhooks cannot be matched to an order |
| `isibi-analytics-v1` | salt in a hash — change it and every returning visitor gets a new id, splitting every site's analytics at the deploy |
| `isibi-${slug}` | the Stripe idempotency key; change it and a retried payment that was already taken is charged twice |
| `isibi-app` | the deployed Worker script; renaming deploys a NEW one and orphans the live script with its routes, secrets and bindings |
| `isibi-sites` | the R2 bucket every published site is served from |
| `isibi-user-` | the Neon project name for every per-user project that already exists |
| `site-secrets-v1` | the v1 key-derivation suffix, and the `"isibi"` fallback beside it in `site-secrets.mjs`; change either and every secret already encrypted under v1 stops decrypting |
| `isibi-ambient` | a CSS animation name baked into published sites, matched against its own @keyframes |
| `isibi-reveal` | the same, for the reveal keyframe |
| `isibi-marquee` | the same again, for the marquee — found 2026-09-12 sitting beside the two above and NOT on this list, which is the hole this table exists to close |
| `isibi:runtime-error` | the postMessage type every published site's frozen bundle sends to the workspace preview; rename the reader and a live site's runtime errors stop reaching the Fix-with-AI badge until that site republishes |
| `zephyr_session_v1` | a live user's session, in their browser; renaming signs everyone out |
| `zephyr_chats_v1` | their chat history — renaming does not migrate it, it orphans it |
| `zephyr_memory_v1` | their learned taste |
| `zephyr_avatars_v1` | their saved avatars |
| `zephyr_owner_v1` | which account the browser belongs to |

**`isibi.schema.json` was the exception.** It is `gofarther.schema.json` now, and
only because `parseSchemaSpec` was widened to accept both first — read as absent
it does not fail loudly, it reads as a site that declared no database.

**And the trap that makes a blind replace catastrophic:** `isibi` is a substring
of **`visibility`**, about 107 times across the tree. A case-insensitive
find-and-replace rewrites every one of them, mostly inside CSS, where nothing
throws — the page just stops hiding things. `test/page-gen.test.mjs` has
anchored on this since 2026-08-24 via the kit's `visibility-toggle` component.

Also: the **`react-day-picker` pin at `^9.14.0`** must stay. `calendar.tsx` needs
v9 and a v10 upgrade breaks it. Do not "clean it up".

---

## Security posture

Last full sweep 2026-07-20, zero findings, tested as real signed-in users:

- **Money** — a normal user cannot call the minting RPCs, cannot make
  `use_credits` add, and has no write grant on any money table. Minting is
  service-role only.
- **Row-level security** — user A reads zero rows of B's credits, purchases,
  plan, chats, memory, assets or usage.
- **SSRF** — every internal address blocked on the link-fetcher, including
  decimal, hex, octal and IPv4-mapped-IPv6 encodings and the cloud metadata
  address; non-HTTP schemes refused.
- **Storage** — the media bucket is path-scoped per user; uploading into someone
  else's folder is refused.
- **Stripe webhook** — unsigned and forged-signature events both rejected, no
  credits minted.
- **Generation** — unauthenticated is refused, and a model not on the allow-list
  is refused before any spend.

Since then: every declared database function is revoked from PUBLIC (Postgres
grants EXECUTE to everyone by default — that was a real hole, found by a test on
its first run), member sessions are cookies scoped to the site's own API path,
and a payable table gets no public insert grant at all, so a price can only ever
come from the site's own rows.

**Two standing advisor warnings that are NOT holes**, written down so nobody
re-investigates them: `queue_neon_teardown` is flagged as callable by a signed-out
visitor, and it returns `trigger` — Postgres refuses to run a trigger function
outside a trigger, so the call cannot succeed. And the tables flagged as "RLS on,
no policies" are that way **on purpose**: no policies means nobody but the service
key can read them, which is the whole point for the connection-string table.

**One accounting fact:** ✦300 was once added to the ledger by hand rather than
bought through Stripe (the minting function needs a secret that lives in GitHub
Actions). It has long since been spent; the balance is **341**, read from the ledger on
2026-08-31 after run 90 (topped up 100 + 400 on 2026-08-30 to fund the
`ashgrove-1` builds; runs 80–90 have spent 159 of it).

## Merged (2026-09-08)

Owner: "merge it". The three commits from tonight are on main — the progress
panel, the code streaming out as it is written, and the dense-log rail you
picked as E. Main had nothing of its own, so it went across cleanly with
nothing to reconcile.

The deploy took three minutes and rebuilt the container image, so the site
container rolled at 00:03. Wait until about twenty-five past before firing
anything that needs the container, so it runs on the new image.

The three browser files went out and I read them back off the live site: the
line-number gutter, the four step marks as characters, the lower-case labels
and the borderless rail are all there in the served stylesheet and the served
chat.js.

What none of that proves is how it LOOKS while a build runs, and it cannot —
reading a file only says the bytes arrived. The next real build is the proof,
and the two lines to watch are the running step saying "writing index.tsx"
instead of just a clock, and the code filling in underneath it with the file's
own line numbers down the side rather than starting at 1.

One number worth having, since the notes had been asking for it: this was the
first push that changed the Worker's code and nothing above it, so the image
build reused most of its layers and came in at two minutes instead of the two
and a half we had been assuming. The container still rolls either way, so the
twenty-minute wait is unchanged.

## The build that published and said it had failed (2026-09-08)

You asked what happened, and then you worked out the shape of it yourself:
*"the build gotta stay in that chat, not make a new one."* That was right, and
the cause turned out to be one line.

**What you saw.** A build designed the site, wrote the pages, compiled them,
published them and took 14 credits — and the app said *"That didn't come
together — you weren't charged."* Both halves of that sentence were false.
`hearth-paper` is live and serving, and the credits really did go.

**Why.** A build can finish in two different places. If it is quick, the same
request that started it also finishes it and answers you. If it takes longer
than a few minutes — which most real builds do — the connection is let go and a
later, separate run picks the answer up and stores it for the browser to
collect. Those two places were each writing their own version of the answer,
and the second one left out the site's name.

The browser will only treat a build as successful if the answer names the site.
No name, no success — so it fell through every sensible branch to the last one,
which has no explanation of its own and says that generic sentence. The same
missing name is why the site never attached itself to the chat you built it in
and turned up on the start screen as a card of its own instead. One cause,
three symptoms.

`plyhouse` the night before ended the same way, so this had been happening to
every long build, not just this one.

**The fix.** There is one small file now whose only job is to write that part of
the answer, and both places use it. They cannot drift apart again, because there
is only one of them.

**Something the test found on its own.** While writing the guard I had it work
out, from the browser's own code, every piece of information it expects a
finished build to hand back — and then check that somebody actually produces
each one. Five sentences came up missing from the second path: what happened to
the photographs, whether a page had to be replaced by a stub, and whether any
page threw an error. So a long build was not only reporting failure, it was also
silent about all of that. Three of the five it can honestly know, and they go
through the same shared file now. The other two need information that is not
kept anywhere the second run can reach, and I have written down where and why
rather than guessing.

Two more turned out to be things the browser reads and nothing has ever sent —
a note about the stylesheet's design axes and one about the fonts. They are not
broken by this change; they have simply never appeared. Whether a build should
carry them is a design call, so I have named them rather than invented an
answer.

**A note on the comment that hid it.** Above the code that follows a build there
was a paragraph saying the answer comes back "byte for byte" and that
"everything below runs unchanged whichever invocation actually finished". The
first half was true. The second half was the bug, written down as a fact. That
is almost certainly why nobody looked here before. I corrected it rather than
deleting it, and it now says which half was wrong.

**What this does not do.** It stops the answer getting lost. It does not yet
bind a site to the chat it was built in — that was the second half of what you
asked for, and it is the next piece of work. `hearth-paper` cannot be put back
into its chat, because nothing anywhere recorded which chat asked for it; it
stays a loose card. The two empty `HEY` cards are safe to delete.

**Not proven live.** The next real build is the proof, since the collected path
is the normal one: the reply should say "Built ..." with the site in the same
chat and the preview filled in. This push rebuilds the container image, so give
it fifteen to twenty minutes after the deploy before starting anything that
needs the container.

---

## 2026-09-08 — the site now belongs to the chat that built it

You said *"idc abut past stuff, but lets fix anything fro future stuff"*, so
this is the forward half: from now on, a site built in a chat stays in that
chat.

**The odd part is that the app already had the answer and never sent it.** Every
workspace has had its own private id since long before any of this — it is how
the app keeps one conversation's messages apart from another's. It just never
told the server. So the server had no way of knowing which chat a build came
from, and a finished site had nowhere to go back to except the start screen.
Now the build sends it, the server stores it against the site, and the start
screen uses it to put the site back where it came from.

**One chat, one site — and the database enforces it, not the app.** There is a
rule in Postgres now saying two sites cannot claim the same chat on the same
account. That matters because of what happens when you press send twice, or the
connection hiccups and something retries: two builds start a second apart, both
look and both see nothing, and both go ahead. No amount of checking in the app
survives that; the database can refuse it outright, and does. I proved it by
inserting a second one and watching Postgres throw it out, then rolling the
whole thing back — nothing was left behind.

**Sending the same build twice now costs nothing.** If a chat already has a
site, the build stops before it spends anything and just opens the site you
already have, with a line saying so. Before this, a lost answer or a double
press could buy a second full build of the thing you were already looking at.

**Your 57 existing sites are left exactly as they are, on purpose.** Nothing
anywhere ever recorded which chat asked for them, so attaching them now would
mean guessing, and a wrong guess puts somebody's site into somebody else's
conversation. They stay as they are, and the rule is written so that is a
permanent, supported state rather than something half-finished.

**A revise is deliberately not affected.** When you edit a site you already
have, the message names the site, so there is nothing to work out — and if that
message came from a different chat, re-pointing the site at it would be wrong.
Only a first build binds.

**One thing the tests caught that a reading would not have.** The new file was
not on the list of files copied into the build container. Nothing about that is
visible from the code — it would have built fine, deployed fine, and then every
build after the deploy would have failed with what you'd have seen as *"our
build service was restarting"*. The check that compares the container's file
list against what the code actually imports found it the same hour it was
written. That is the third time that particular check has paid for itself.

**One thing worth saying about the checks.** I deliberately broke this in
forty-eight different ways to see whether anything noticed — dropping the chat
off the message, letting a retry charge for the site it did not build, taking
the uniqueness rule out of the database, and so on. Forty-seven were caught.
The forty-eighth was a control that changes only a comment and is supposed to
pass. Four of the breakages turned out to change nothing at all, which is its
own finding: in two places I had written two walls where one does the work, and
one of them came with a comment claiming it mattered. The comment was wrong and
now says what is actually true rather than what I assumed.

**Deployed and checked.** It went out at 02:30 and was green three minutes
later; the container rebuilt and rolled at 02:33. I then read the live files
back off the server: the build request really does carry the chat now, the start
screen's file really does read it, and the list endpoint answers "sign in
required" where a route that does not exist answers "not found" — so it is
mounted and gated. That is as far as reading files can go; it proves the wiring
is there and cannot prove a build ends up in the right chat. Give it until about
02:53 before starting anything that needs the container.

**One more thing I checked while it deployed.** Deleting a site frees its chat —
the delete removes the registration row completely, so that workspace can build
again. That is the only way a chat is ever released, and nothing was testing it,
so a future change to the delete could have quietly left a chat unable to ever
build again. It has a check on it now.

**Not proven live.** The next new build is the proof: it should finish inside
the chat you started it in, with the preview filled in and no extra card on the
start screen. The free half you can try any time — start a build, then send the
same thing again in that chat: the second should come straight back with the
site you already have and take no credits. This push rebuilds the container
image, so give it fifteen to twenty minutes after the deploy before starting
anything that needs the container.

---

## The build screen only appears when there is a build (2026-09-08)

You typed **hey**, and the whole right-hand side turned into a build screen —
Design · Code · Compile · Publish, a clock counting up, "Planning your site…" —
for a message that was never a build. Meanwhile the little list on the left,
one pane over, correctly said **Thinking**. Two halves of one screen, each
telling you something different about the same message.

**Why it did that.** The moment you send anything, the app marks itself busy and
opens a build record, because it does not yet know what you sent — the router
has not answered. The list on the left has always waited to be told it is a
build. The big panel on the right never asked: it just checked "busy", which is
true for a greeting, a question and a real build alike.

So the information was there the whole time and one of the two readers never
looked at it. That is the same shape as most of the faults in this app's
history, and the panel's own notes already record the lesson one layer down —
two things that can be drawn separately will eventually disagree. Drawing had
been unified; asking had not.

**The fix is one question, asked by both.** There is now a single place that
answers "is a build actually running", and the list and the panel both ask it.
Neither works it out for itself any more, so they cannot drift apart again.

It is worded the careful way round: a build is running when it says which stage
it is in. Written the other way — "running unless it says it's thinking" — a
message carrying no stage at all would have counted as a build, which is exactly
the wrong direction to be wrong in. I only found that because I ran the thing
rather than read it; reading it, it looked right.

**And the faint dots are gone.** Under the left-hand list there was a small
animated "…" that read like an empty line of code. It is the older "still
working" mark, left over from before that list existed, and it had already been
switched off for the other progress display and never for this one. Off for both
now.

**The second thing you asked about — "no code, no nothing".** That screenshot
was taken while the build was still **planning**, and there is genuinely no code
at that point: the model has not started writing the page yet. The code appears
when the second step starts. So nothing is broken there, and after this change
that stage is at least honest about which step it is on rather than sitting
under a panel that has been claiming a build since the first keystroke.

**Not proven live.** The push only touches the browser files, so nothing rebuilds
and there is no waiting period. Say **hey** in a fresh chat and the right-hand
side should stay as the invitation to describe your site; start a real build and
the panel should come back exactly as it was.

---

## The Code tab and the Download are real now (2026-09-08)

You sent two screenshots and said the buttons were different depending on whether
there was a build. They were, and the reason was not "has a build" — it was a flag
meaning **has this project ever built**. Three controls were switched on only while
the answer was no: **Code**, **Download**, and **Publish**.

That is backwards, and it was worse than it looked. On the empty project two of
them were greyed out and **Code opened an empty code editor** — an empty file
list, an empty file name, and a Download button in it that did nothing. On a real
site with real code, all three vanished.

**Why it was that way.** They are all left over from the old static-site version
of the builder. Nothing can make one of those sites any more: a new project has
no flag, the first message always goes down the React path, and every site the
server lists comes back as React. So those three buttons could only ever reach
one screen, and did nothing on it.

**You chose to make them work rather than delete them, so:**

**Code** now opens on your site's actual code — the page the model wrote, plus any
component it wrote specially for your site. It comes from the server, so it works
on any machine you sign in from, and the file names are the real ones your site
uses. There is a file list down the left and a Download button for the single file
you are looking at.

**Download** (the arrow in the top right) gives you a **zip of your whole site's
code**, named after the site. Before your first build it is greyed out and the
tooltip says why, rather than being hidden — same rule as the icons on the site
cards: you can't ask for a feature you never knew was there.

**Publish is gone.** It could not do anything: your site goes live as part of every
build, so there was nothing to publish. It was already invisible on every real
site anyway.

**One thing that came out of this and is worth a decision.** That Publish button
was the only way to reach the panel with **"Take it offline"** and **"Put it back
online"** in it. Because the button was hidden on React sites, **that panel has had
no door at all on any of your live sites** — the feature works, the server side is
fine, there is just nothing to press. My change doesn't cause that; it was already
the case. I've left the panel and its code in place with a note saying exactly how
to give it a door again: one card in the Cloud tab, beside Submissions and Members.
**Say the word and it's a ten-minute job.**

**On the zip, since it is the one thing that can look fine and be broken.** A zip
is a stack of byte offsets — write one field short and the file still downloads,
still has the right name, and fails when you double-click it a week later. So the
test doesn't read my code, it makes a real archive and hands it to **Python's own
zip reader**, which checks every file's checksum and reads every file back out.
Including one with accented characters in it, which is where this format usually
goes wrong.

**And the zip test found two real faults in my own writer, which is the point of
writing it that way.** Python's reader is thorough but it does not look at
*everything* — it works out the file names from the archive's index at the end,
and it counts the files by measuring that index rather than by reading the number
the archive states. So two fields I write were never being checked: the file-name
encoding recorded on each file itself, and the file count in the footer. Either
one wrong is an archive that opens perfectly here and badly somewhere else — a
"drag it out one file at a time" tool reads the first, and plenty of tools trust
the second. There is a second check now that takes the archive apart by hand and
compares what it *says* against what it *contains*, which is the one comparison a
single reader can't make.

**Not proven live.** This one does touch the server file, and that file is part of
what the build container is made from — so the container rebuilds and you should
give it **15–20 minutes** after the deploy goes green before judging anything.
After that: open any built site, press **Code** — you should see your page's real
source — then press the arrow and you should get a zip that opens.

---

## "Take it offline" has a button again (2026-09-08)

You asked what a Cloud card was, then said add it. Done.

**More → Cloud** now has a fourteenth tile, **Visibility**, sitting just before
Domains — the two tiles about your site's public face, side by side. Pressing it
opens the panel with **"Take it offline"** and **"Put it back online"** in it.

**That panel has existed and worked for weeks with nothing able to open it.** The
only thing that ever opened it was the Publish button, and Publish only appeared
on projects that had never built — so on every real site of yours, the ability to
take it off the web was there on the server and unreachable in the app. Deleting
Publish yesterday didn't cause that; it just made it obvious.

**It works on any published site**, whether or not it has a database. Taking a
site off the web has nothing to do with having one, and the tile would have been
hidden from most of your sites if I'd tied it to that. Before your first build it
sits greyed with the reason, the same as the others.

**One thing I deliberately did not do, and it's worth a decision.** The tile says
what it *does* — "Take your site off the web, or put it back" — rather than what
state your site is currently in. That's because the app only remembers "this site
is offline" **in the browser you switched it from**. Take a site offline on your
laptop, open the app on another machine, and that machine still thinks it's live.
So a tile claiming "Live at its address" would sometimes be lying to you about
your own site, and I won't ship that.

**The panel behind it has the same blind spot** — it picks which of its two faces
to show from the same browser-local memory. That's not new and I haven't widened
it, but it means on a fresh machine an offline site opens on the "Live" face. The
fix is to have the server tell the app which sites are off the web, the same way
it already tells it which ones have a database. **Small, and your call.**

**Not proven live.** Browser files only, so nothing rebuilds and there's no
waiting period. Open any built site, go to **More → Cloud**, and Visibility
should be there and open.

---

## 2026-09-08 — the download zip opens, and I proved it without your browser

You picked the zip. I can't press the arrow in your browser, so I proved the
part I can reach — and I made a point of proving it against the **code your
site is actually serving**, not the copy on my disk.

**What I did.** Downloaded `site-zip.js` from gofarther.dev and checked it is
identical, byte for byte, to the file in the repo. Cut the three functions that
name your files and hand a file to the disk straight out of the served
`chat.js` — not retyped, the real ones. Ran all of it in a real Chrome, through
the real "save this file" path, and caught the download as a file. Chrome named
it `fretwork-1.zip` on its own.

**Then I opened it with something that has never seen our code.** The tests
already open these archives with Python's zip reader; this time I used the
plain `unzip` command, a completely separate program written by other people.
It checked every file's checksum and found nothing wrong. All four files came
out identical to what went in, including an empty file and a folder name
starting with a dash, which trips some tools up. A line with accents and
Japanese in it came out perfect, which is the bit most likely to arrive as
gibberish. And two downloads made in two fresh browsers came out byte for byte
the same, which is on purpose — the file's internal timestamp is fixed rather
than "now", so an unchanged site always gives you the same archive.

**What's left.** Your own press adds two things I can't stand in for: the trip
to the server to fetch your source, and whatever your Mac or PC uses to open
zips. The server trip is well covered by tests and answers correctly when I
poke it live. The archive itself now has a third independent program vouching
for it. So if you press it and it opens, that's confirmation rather than news —
but it's still worth one press.

**Nothing changed in the code today.** This was a measurement, not a fix.

---

## 2026-09-08 — all fifteen can be deleted now, not nine

You were right. The delete verb could take fifteen things off a site and only
**nine** of them could ever be reached.

**Why.** Everything the delete verb does sits behind one gate in the code, and
that gate only opened when the router decided your message was about the site's
"look" — colours, fonts, the name, the languages, the QR code, what a button
does. Those nine things have no other door, so they were fine. The other six
live somewhere else: a photo, the header button, a section, the 3D scene, the
chord diagrams, the page's shape. Ask for one of those to go and the router sent
your message straight to the part that handles photos, or buttons, or pages —
past the gate entirely.

(I first wrote this up as seven and eight. It is nine and six — I read the wrong
lookup table, which is grouped rather than one row per thing. Corrected here and
in the engineering notes, with a line telling the next session to work the split
out rather than trust the sentence.)

**Nothing looked broken, which is why it lasted.** The message still reached
something, and that something did its best. What went wrong is quieter: the
site's own record of what it has kept saying it had the thing. So the page and
the record disagreed, and the next big edit could put it back.

**Two fixes, because the six don't all arrive the same way.** For a photo or a
button, the router already sets a "they want this gone" flag — it was just being
thrown away for those. That's now kept, and it opens the gate. For a section, a
scene or the site's own components, the flag can't be used at all, and that's
worth knowing: on a page, that same flag means *delete this whole page*. If I'd
widened it, "take the 3D scene off the home page" would have **deleted your home
page**. So those arrive a different way — the router is now told that taking
anything off is worked out at the gate, with a whole page named as the one
exception.

**Two things I want to flag rather than bury.**

The first is that a delete sent to the wrong place used to escalate to the full
rewrite — about 25 credits. Now, if the gate opens and there turns out to be
nothing for it to do, the message just carries on to where the router was
sending it anyway. A delete can't quietly cost you a rewrite.

The second is that my own test caught a hole in my own fix. I'd written the gate
as "open for anything that isn't a page or a logo", which is right about
everything the router produces — but the app reads that flag from the request
itself, so a hand-made one naming the *data* layer would have slipped through and
escalated. It asks a proper list now. Reading the line, it looked fine; only
driving it found that.

**Not proven live yet, and the two halves prove differently.** The photo/button
half costs about a credit: "take the photo of the shop off" on fretwork-1. The
section/scene half is about how the router decides, so only a real message
settles it — "take the 3D scene off" is the one. Both are cheap, both are yours
to call. This touches the worker, so the container rebuilds and there's the
usual 15–20 minute wait after the deploy before anything heavy.

**Deploy went out clean** (run 2053, green in about four minutes, tests green).
The container rebuilt and rolled at 15:34Z, so anything heavy should wait until
about **15:55Z**.

**One thing the deploy log corrected.** My notes said a push that only touches
the worker code takes about two minutes to build the image, because the slow
setup layers get reused. This one took nearly three and rebuilt *everything* —
including a 48-second Chromium install it was supposed to skip. Nothing is
broken; the reuse just depends on the build machine having a warm cache, and
those machines are thrown away after each run. So two minutes is the best case,
three is normal, and a slow image build is **not** a sign that something bigger
changed. I've corrected the note.

---

## 2026-09-09 — The Code tab with the phone column, and a drag that didn't stick

You asked to see what the **Code** tab looks like with the mobile column open.
It works: the file list, the file name, the Download button, the line numbers
and your real source, all there, and the code scrolls sideways inside its own
box rather than pushing the page about. Preview is untouched — switch back and
the live frame is where it was, with the column still out. Three pictures in
`docs/edits/`: `mobile-code-open.png`, `-wide.png`, `-max.png`.

**But driving it found a real bug in the drag, and I've fixed it.** The panel
remembers two things — whether it's open, and how wide you dragged it. Only the
first one survived the screen redrawing. So you'd drag the panel wide, and the
next time the workspace redrew it would snap back to its default width. I
measured it: 1004 pixels down to 393. And the workspace redraws **every time the
builder replies to you**, so this would have bitten in the middle of an ordinary
conversation, not just when switching tabs. Both halves are written in the same
place now, so the next person to touch one is looking at the other. I also made
it re-check the width after each redraw, in case you've resized the window or
hidden the chat since.

**Two things I did NOT change, because they're your call:**

1. **The file list never gets narrower.** As you drag the column open, the thing
   that shrinks is your *code*, and the thing that keeps its full width is the
   list of file names. At a 693-pixel panel the code is down to a 99-pixel
   sliver — you can see the line numbers and about four characters. It feels
   backwards to me: the file names are the part you could afford to lose.

2. **Dragged all the way over, the Code view disappears completely** — and the
   "Code" tab at the top stays lit above nothing. That is exactly what "open
   until the chatbox" means, which is what you asked for, so it may be right.
   It just reads differently on Code than on Preview, where the two phones fill
   that space.

**Not live yet.** This only touches the browser files, so nothing rebuilds and
there's no waiting after the deploy. The proof is one drag: pull the panel wide,
send the builder a message, and the panel should stay where you put it.

---

## 2026-09-09 — The phone column floats over the site instead of squashing it

You sent a screenshot of the panel dragged wide with the site's own text crushed
to one word a line, and said the panel should **overlay** — the stuff in the site
shouldn't shrink. It does now.

**What was wrong.** The panel was a column *in* the row, sitting next to the
preview, so the two shared the space: every pixel the panel gained came straight
off the site. I measured it before the change — as you drag, the preview goes
1017 pixels wide, then 491, 351, 191, and finally **zero**. The site was being
re-laid-out live under your hand, which is why the text stacked up.

**What it does now.** The panel is lifted out of the row and floats on top, with
a soft shadow down its left edge so it reads as sitting *above* the site rather
than cut into it. Measured after: the preview holds **1017 pixels the whole way
through the drag** and never moves. The panel still stops in exactly the same
place as before — 26 pixels past the chat box, to the pixel — so "open until the
chatbox" is unchanged.

**A bonus worth knowing about.** Because the site's frame is no longer being
resized as you drag, it stops re-rendering. Before, every intermediate width made
the site inside redraw itself.

**Three small things came with it, and one was a real bug I caught by looking.**

1. The little handle used to sit a gap away from the panel, because there *was* a
   gap between the two columns. There isn't one any more, so it sits flush on the
   panel's edge.
2. The handle used to square itself off when the panel opened. Flush against the
   panel that would have drawn two borders on top of each other — a visible
   double line — so it keeps its rounded sticking-out edge now, open or shut.
3. **The panel's background was slightly see-through**, which nobody could tell
   while it had nothing but our own paper behind it. The moment it floats over
   your live site, that matters: the first version I rendered showed the site's
   address bar showing straight through the panel's heading. Fixed — same
   colour, just solid now.

**Merged and deployed** (you said "merge it"). Main moved straight onto it at
04:53Z and the deploy was green in **44 seconds** — the fastest one this project
has had. Nothing rebuilt: the container image was reused, so there's no waiting
period before you can use it. I checked the two files that actually went out
against what's in the repository and they're identical, and I read the new rules
back off the live stylesheet rather than trusting the diff — the panel floats,
the handle sits flush, and the old rule that squared the handle off is gone.

Nothing paid ran, which is how it should be: a straight fast-forward writes no
merge message, so the message on the commit is my own and it doesn't ask for the
paid checks.

**Not proven live yet** — that part is you. The proof is one drag: open a site,
pull the handle left, and the site behind should stay exactly the size it was.
Pictures in `docs/edits/`:
`mobile-overlay-open.png`, `mobile-overlay-wide.png`, and
`mobile-overlay-before-wide.png` for what it replaced.

**One thing to remember when you look:** `chat.js` is about 930 KB and your
browser caches it, so the first load after a deploy can still be the old file. A
hard refresh is part of any browser-side fix reaching you.

**One more thing worth telling you, because it is the same mistake this codebase
keeps making.** A check went red while I was finishing, and it was reading my own
comment. I had written a note in the stylesheet explaining what the panel used to
be — quoting the old line — and a checker that scans for stylesheet variables read
that quote as if it were live code and reported a problem that does not exist. The
codebase already has a rule for this ("ignore comments before scanning") and this
one check had never been given it. Fixed in the check, not in my comment: the
comment is fine, and had I quietly reworded it, the next person to explain a rule
in a comment would have hit the same thing.

---

## 2026-09-09 — A merge now runs the deploy and nothing else

You said: *"REMOVE ALL THOSE WORKFLOWS FROM THE MERGE THING, I JUST WANT THE
MERGE THING THERE, THATS IT."* Done.

**What used to happen when you merged.** Twenty-three separate jobs started. The
deploy — the one you actually want — plus twenty-two others: five tests that fire
the moment the deploy finishes (payments, member sign-in, the confirmation email,
the frame policy, the paid build smoke), three probes that check the container can
reach a model, the unit test suite, and thirteen more that wake up whenever the
merge happens to touch a file they watch. One of those thirteen, the edit smoke,
spends about fifty credits every time it runs.

**What happens now.** One job: the deploy. Nothing else.

**Nothing was deleted.** Every one of those workflows is still in the repository
with all its settings; what came off is only the part that made it start by
itself. That part is commented out inside each file with a note saying so and how
to bring it back — uncomment it. And every one of them still has its manual
button, so you can run any of them whenever you want by pressing it. I checked
that specifically: a workflow with no trigger and no button would be one nobody
could ever run again, and that would have been a deletion pretending to be a
pause.

**Three of them I treated differently, and I want to flag it in case you meant
otherwise.** The unit tests, the site-build check and the answer-read tool were
not set up for main specifically — they ran on *every* branch. So instead of
switching them off I excluded main only. They still run when I push to the
working branch, which is where I actually do the work; they just don't run again
on the merge. The reason that loses nothing: merging here copies a commit that
has already been tested onto main without changing a single line, so the merge
run was reading exactly the same files a second time. If you'd rather they were
off completely, that's one word.

**The honest cost.** Nothing is checked automatically on main any more. Those
smokes and probes were free and they ran on their own; that safety net is now a
button somebody has to press. I'd rather say that plainly than let you find it
later. If something important is about to ship, the thing to do is press the
buttons first.

**Something I found while doing this, which is worth a minute.** I took twenty-two
triggers off in one go and then ran the whole test suite — all 5,722 tests — and
every single one passed. Nothing in this repository had any idea which workflows a
merge starts. That is the one part of the setup that decides what gets checked and
what gets spent, and it was the only part with nothing watching it. It also fails
in the direction that looks fine: a check that quietly stops running doesn't turn
anything red, it just goes silent. There is now a test that counts them — it reads
the folder itself rather than a list I typed, so a workflow added next month with
the old settings copied off an existing one fails immediately instead of showing
up as a surprise on your next merge.

**Checked:** the whole suite green at 5,732 (the ten new ones are the count). A
mutation sweep of twenty deliberate breakages — a workflow sneaked back onto the
merge, the deploy itself taken off it, a parked block mangled so it couldn't be
restored, the reader made blind in six different ways — all twenty caught, with
two harmless comment edits confirming the tests aren't just failing at everything.
Every workflow file still parses, and I cross-checked my own reader against a real
YAML parser over all thirty-three of them: no disagreements.

**Not proven live yet** — that part is the next merge. What you should see: the
Actions list showing one run, "Deploy to Cloudflare", and nothing underneath it.

---

## 2026-09-10 — when the page doesn't get split, it now tells you why

**What the test build showed.** `ridgeway-cycle-works` published fine and gave us
two of the three things I was watching for. The design step really did run as four
agents side by side, and the trace now carries the number that proves it: the
agents spent 251.6 seconds of work between them and the step took 185.6, so
**66 seconds of it happened simultaneously**. That's measured from your one build
— no comparing against older builds, which was the whole point of adding it. The
other thing that landed correctly is the "who generated this page" flag, which was
reading the wrong answer for a few hours this morning and now reads right.

**The third thing didn't happen at all.** The page was written in one call, not
band by band. And when I went to find out why, I couldn't — because nothing
recorded it.

**Why I couldn't tell.** There are five separate reasons the page won't get split,
and all five looked identical from outside: silence. A build that declined to split
and a build that was never asked to split left exactly the same empty space. So I
could tell you it hadn't split and not one thing more.

**What I built today.** Each of those five reasons now writes its own line into the
build's record, named after the reason. So the next build will say one of:

- *sync* — this build ran in a way that can't fan out at all
- *pages* — the plan had more than one page, which we deliberately don't split
- *tsx* — the design asked for a custom component, and a band can't write one
- *revise* — it's an edit of an existing site, not a fresh build
- *thin* — the plan only had one band, so splitting buys nothing
- *door* — the feature is switched off for this account
- *nofanout* — the container refused it

**One thing worth knowing about how it's stored.** The build's record only accepts
numbers — that's on purpose, so nothing sensitive can accidentally end up in it.
So I couldn't just write the reason in as a value; it would have been silently
thrown away and we'd be back to silence. The reason goes in the *name* of the
line instead, which is stored as-is.

**And I found something while doing it.** One of the five checks — whether the
feature is switched on for your account — was the last in a chain, so on any build
where an earlier check had already said no, **it was never even asked**. That
means "the plan refused" and "it's switched off for you" were genuinely the same
nothing, not just hard to tell apart. It's asked properly now.

**Checked.** Twenty-two deliberate breakages — the reason deleted, all seven
reasons collapsed onto one name, the reason stored in the way that gets thrown
away, the switch put back inside the chain, each of the five walls disabled in
turn — all twenty-two caught, with two harmless comment edits confirming the tests
aren't just failing at everything. Full suite green at 5,862. Two older tests went
red because I'd moved the lines they were watching; I re-pointed them at what they
were actually meant to check rather than loosening them.

**Not proven live yet.** The next build proves it, and the useful part is that it
proves it either way now — either the page gets split, or the record names which
wall stopped it. This one touches the Worker, so the container rolls again and the
usual 15–20 minute wait applies before firing anything.

---

## 2026-09-10 — the page split has never once run, and now we know why

You switched both splits on this morning. The design one has been working — two
builds show it. The page one has **never run, for you or anyone, since the day it
shipped**. Here's the whole story, because the interesting part is how we found
out rather than the bug itself.

**What we could see this morning.** `ridgeway-cycle-works` built fine and the
record said the design had been split into waves. It said nothing at all about
the page — so "the page was split" and "the page was not split" looked identical
from outside.

**So the first thing we built was the thing that tells you.** Seven different
walls can stop a page being split, and every one of them was silently doing
nothing. Now the build writes down which one it hit. That went out this
afternoon.

**Then you fired a build and it told us straight away.** `thornbury-kiln`
recorded **`bands:door`** — meaning "the split is switched off for this account".
Which was wrong: you'd switched it on hours earlier, and the same build's record
proves the *design* half of that same switch was working.

**The bug, in plain terms.** When a build asks "is the split on for this
customer", it needs the customer's **account**. It was handed the **login token**
instead — the long random string a browser sends to prove who it is. Those are
two different things: the token proves you're you, the account *is* who you are.
Ask a token which account it belongs to and you get nothing, so the answer was
always blank, and a blank account matches nobody. Every build on the platform
failed that check, every time, for the entire life of the feature.

**Nothing broke, and that's exactly the problem.** A blank account and a customer
who genuinely isn't in the test group give the same answer: no split, page
written the old way, site publishes normally. No error, no log, no slow build,
nothing on any invoice. It could have sat there for months. The only reason it
surfaced today is that we spent the morning building the one instrument that
could tell those two apart — and it caught the feature it was written to watch,
on its first live run.

**Two of our own tests were watching this and neither could see it.** One had the
buggy line written into it as if it were the rule, so the single check staring
straight at the problem was confirming it. The other tested the door by handing
it an account directly — which proves the door can *read* an account and says
nothing about whether anyone ever *gives* it one. That's the same mistake we made
with the model picker a few days ago; it's now written down in the rules file for
the third time.

The test runs the whole chain end to end now instead of reading it: it takes the
real code that works out the account, feeds it into the real code that checks the
door, and requires your own account to open it — with checks that a stranger and
an unidentifiable build still don't. It was proved to fail three different ways
before it was allowed to pass.

**One more thing worth knowing.** A test went red at me over my own comment. It
reads the list of things handed to the build step and splits that list on commas
— including commas inside comments. A comment I'd written had "…packed,
deliberately: one shape…" in it, and the word `deliberately` got read as a real
setting. That's a test calling correct code broken, which we treat as worse than
missing a bug, so the test got fixed rather than the sentence.

**Checked.** Seventeen deliberate breakages — the token put back, the account
dropped at each hop in turn, the door thrown open to everyone, and the test's own
safety checks disabled — all seventeen caught, with two harmless comment edits
confirming the tests aren't just failing at everything. Three more breakages were
corrected rather than counted: two turned out to change nothing at all when I
measured them, and two could never have been caught because they break a *test*,
and nothing tests the tests. Full suite green at 5,863.

**What this means for you.** Nothing a customer sees changes. Once this deploys,
the next build should finally write its page in pieces — and if it still doesn't,
the record will name the wall. This touches the Worker, so the container rolls
again and the usual 15–20 minute wait applies before firing anything.

**Still unknown, said plainly:** we don't yet know whether splitting the page is
actually faster. Nobody has ever measured it, because it has never run. That's
what one build will finally tell us.

---

## 2026-09-10 — the container can now tell you which code it's running

You asked why the container always takes twenty minutes. The honest answer was:
it doesn't — **I do.** So we fixed the part that was actually broken.

**What the twenty minutes really was.** Three things were getting lumped
together. The deploy itself is about three minutes, and that's real work —
rebuilding and pushing the container image. Pointing the container at the new
image is instant. The twenty minutes is the bit after: a container that's
already warm keeps serving the *old* image until it gets recycled. That part is
genuinely Cloudflare's, not ours.

**But twenty was a guess.** Nobody had ever measured it. It came from one
observation — "an instance started right after a deploy is still on the old
image" — rounded up to something that felt safe. And it couldn't be checked,
because **the container had no way to say which image it was running.** It has a
health check, but all that reported was a fingerprint of one template file — so
it changed when the template changed and said nothing about a code-only push,
which is nearly every push we make now. No question to ask, so waiting blind was
the only option.

**What we built.** The deploy now writes the image's own id into the image, the
container reports it, and there's an owner-only address you can ask. "Is the
container on the new code?" is a five-second question with a real answer instead
of a number nobody measured.

**One thing that could have gone quietly wrong and didn't.** The image's id is
worked out by hashing what goes into it. Writing that id back into the same file
sounds like a snake eating its tail — and if it were, the id would change on
every deploy, every image would look new, and every push would rebuild both
images for no reason, slowly and silently. It isn't circular, because the hash
reads the *committed* files and the id is written into the *working copy*
afterwards. That's not a claim in a comment — the test computes the id, writes
the stamp, recomputes and requires them equal, with a control proving the id does
still move when something real changes.

**Also worth knowing.** A container instance is *per site*. So a brand-new build
starts a fresh instance and probably doesn't need the wait at all; the wait is
really about editing a site whose instance is already warm. We didn't act on that
today because there's a second unknown underneath it that nobody has measured
either — and 13 credits isn't worth a guess.

**Two things caught during the work, both by our own tests.** A trap this project
has hit several times before turned up in code I'd written ten minutes earlier: a
one-item list quietly turning into text, which would have stamped a nonsense id
into an image as if it were real. And one deliberate breakage survived at first —
switching the new address off without deleting it, which left every landmark
exactly where the test was looking. That's a test checking that something is *in
the right place* rather than that it *runs*, which we've been caught by before;
it now runs the thing.

**Checked.** Twenty deliberate breakages, all twenty caught, with two harmless
comment edits confirming the tests aren't just failing at everything. Full suite
green at 5,873. Three older tests went red because they were counting things
rather than checking them; each was re-pointed at what it was actually meant to
protect.

**What's left.** The next deploy after this one is the first with a stamped
image, so the new address will honestly say "unstamped" until it rolls — the last
time that'll ever be the answer. And the twenty minutes is still twenty minutes
until someone watches one deploy from roll to flip and writes down the real
number. That's free, and it's the next thing worth doing.

---

## 2026-09-10 — it worked: the page was written five bands at once

`ashcombe-fishmonger`, 18:28Z. **The first time in the feature's life that a page
has been written in pieces.** Five sections, five agents, all five came back.

The record says `bands: 5, wrote: 5`. The second number is the one worth knowing
about: if an agent had come back empty, its section would have been replaced with
a stub rather than dropped, and you'd have got a page quietly missing a chunk with
nothing saying so. `wrote` matching `bands` means that didn't happen.

**The tell arrived before the answer did.** Six minutes in, before the page had
been assembled, I could already say it had worked — because the record showed *no
refusal* at the point where this morning's build showed one. That's the whole
value of the thing we built this afternoon: the difference between "it split" and
"it didn't" used to be invisible, and now the absence of a reason is itself an
answer.

**The page reads as one page**, which was the real risk. Five independent writers
could easily have produced five disconnected slabs, each opening with its own
headline and closing with its own "get in touch". They didn't — 11 sections, and
the headings run through the brief in order: what came in today and who landed it,
the boats by name, prepared while you wait, the smokehouse, the restaurant round,
find us. Have a look: **https://ashcombe-fishmonger.gofarther.app/** — one build
isn't a pattern, and your eye is better than my markup reading.

**Is it faster? Still don't know, and I'm not going to guess again.** The step
where the splitting happens took 130 seconds. Single-call builds have taken
anywhere from 74 to 355 seconds for the same step. One run inside that range tells
you nothing, which is exactly what I said before it ran — and I got this wrong
once already today by predicting a saving that turned into a hundred seconds the
other way. Answering it properly means running the *same* brief several times with
the split on and off, which is a spending decision rather than a technical one.

Cost: 17 credits, 407 down to 390. That's up from 13 for the last two, on a
noticeably richer brief.

**Where the whole thing stands.** Both splits are on for your account and nobody
else's. Three things are proven that weren't this morning: the door opens, the
container really runs five model calls side by side, and the pieces reassemble
into a page that compiles and publishes. What's unproven is whether any of it
saves time.

---

## 2026-09-10 — is splitting faster? For the design step: no. And now one build can answer it for the page step

You asked the right question. Here's the honest answer for one half of it, and the
instrument that will answer the other half on your next build.

**The design step splitting into four is a wash.** It cost nothing to find out —
the numbers were already sitting in three builds you'd already paid for. Against
the two ordinary single-call builds we have as a baseline, the three split builds
came out dead even, then 4.6 seconds slower, then 51 seconds slower. Not faster.

**Why, in one paragraph.** Splitting buys you two things and charges you one. It
buys overlap — work happening at the same time — and that really is happening:
between 52 and 66 seconds of it on each of those three builds. But it charges you
for the split itself, because four agents each read the brief and each think about
the site, where one call did that once. That charge came to between 65 and 103
seconds. The two numbers are the same size, so they cancel out.

**And it can't get much better, for a structural reason.** The four agents don't
all run at once — they run in three rounds: one alone, then two together, then one
alone. Three of the four are running by themselves. So the *most* that running side
by side can ever save is however long the shorter of the two paired agents takes,
while the cost of splitting is paid four times regardless. The rounds are that
shape for real reasons (the logo can't be drawn before the site has a name, the
behaviour of a button can't be described before the page exists), so it isn't a bug
we can fix — it's what this particular split is.

**The page step is a completely different shape**, which is why I'm not calling the
whole idea dead. There, five sections run **all at once**, not two, and they're
running on a call that takes five to ten minutes rather than three. The fixed cost
of splitting is the same, but it's a much smaller slice of a much bigger number.
That's exactly the shape where splitting should win.

**We just couldn't read it.** The record kept how many sections were written and
whether any came back empty, and no timings at all. So the only way to ask was to
run the same brief several times with the split on and off and compare — and the
natural spread on that step is 74 to 355 seconds between builds, which is wider
than any saving we'd be looking for. That's a lot of credits to buy an answer the
noise would eat.

**So the change today is two numbers on the record.** How long each of the five
sections took added up (what running them one after another would have cost), and
how long the whole batch took on the clock. Subtract, and you have the overlap — off
a *single* build, no baseline, nothing to compare against. Then it's the same
arithmetic as the table above: does the overlap beat what splitting cost you?

**One thing I got wrong and fixed.** I wrote a comment claiming the measured clock
beats the simpler alternative of "take the slowest call". Today those two give the
same answer, and saying otherwise was overclaiming. Measuring is still the right
call for a narrower reason: they agree only because all five calls start in the
same instant, and if anything ever staggers them, "slowest call" would under-report
the time — which is wrong in the flattering direction, the worst way for a number
you're going to make a decision with. There's now a test whose calls deliberately
stagger, so that stays honest.

**Checked.** Eighteen deliberate breakages, all eighteen caught, two harmless
comment edits confirming the tests aren't just failing at everything. Full suite
green at 5,875. Two older tests went red because they were pinned to exactly where
something sat rather than what it did; both re-pointed.

**What's left.** Your next ordinary build proves it — no special run, no extra
spend, just read the record afterwards. This touches the worker, so the container
rolls and the usual 15–20 minute wait after the deploy applies.

**Merged and deployed.** Run 2077, green in 3m03s. The container rolled at
19:30:10Z, so the usual wait after a deploy ended around 19:45–19:50.

**And this deploy is the first one where that wait can actually be measured.**
Yesterday's change gave the container a way to say which build of itself it's
running. Until now both sides of the comparison didn't exist — the outgoing
container had no name for itself. Now it does: before the roll the address
answers one id, after it answers another, and the moment it flips is the real
end of the wait. That's the number that replaces "15 to 20 minutes, probably".

It needs you signed in — the address is `/api/site/build-health` and it only
answers to the account that owns the sites, so I can't take the reading from
here. If you open it a few times over the twenty minutes after a deploy, the id
changing is the answer. Free, and it's the last piece of the "why does the
container take 20 minutes" question you asked this afternoon.

---

## 2026-09-10 — four minutes of every build were spent waiting for nothing

You asked what we do. I went looking for the four minutes, and it's one number
written down eleven days ago that stopped being true this week.

**What it is.** When a build sends the page off to be written, it also books a
time to come back and collect the answer — four minutes later. That was measured
and correct: five real builds took between five and a half and ten minutes to
write a page, so coming back sooner would just have been asking "is it ready?"
five times and being told no.

**Then the splitting changed it.** Your Kestrel build wrote its page in **ninety
three seconds**. But nobody was coming back for it until the four minutes were
up. So the page sat there, finished, for two and a half minutes, waiting for an
appointment made when the answer couldn't possibly have existed yet.

**It's the same trap this project keeps writing down**: a rule that was true
because of how something underneath worked, and the thing underneath moved, and
nothing announced it. The number was right. The world changed around it.

**The arithmetic is exact, which is how I know it's this and not something else.**
Four builds spent 253,290 / 252,403 / 256,150 / 260,826 milliseconds outside
anything they could account for. Eight seconds apart from each other, on builds
whose pages were written seven ways, five ways and one way. A cost that doesn't
care what the work cost isn't the work — it's a wait.

**The fix is small and most of it was already built.** When the page is finished,
it gets handed back and filed away safely — and at that moment the system already
works out which build it belongs to, because it has to. It just never told
anyone. Now it does: the answer knocks on the door itself instead of leaving
someone to turn up later.

**I deliberately didn't just lower the four minutes.** That would be a new guess
about how fast things are today, and it would go stale the same way the moment
splitting gets faster again — which is exactly how we got here. The four minutes
stays as a backstop for the case the knock can't cover: a container that dies
after writing the page but before handing it over. And the note explaining the
number now records that its own reasoning was overtaken, with the measurement
that overtook it, so nobody spends an afternoon hunting the delay somewhere else.

**One consequence worth knowing.** Every build now produces two collection
attempts — the knock and the backstop. The second one finding nothing to do was
already handled; it just used to be a rare accident and is now deliberate, so I
wrote that down and put tests on it. Nothing can get charged twice.

**Checked.** Eleven deliberate breakages, all eleven caught, two harmless comment
edits confirming the tests aren't just failing at everything. Eight new tests,
every one driving the real thing rather than reading it. Full suite green at
5,883. One older test went red because it was pinned to the code being on one
line rather than to what it does; re-pointed.

**And it makes the page splitting worth something for the first time.** The split
really did cut writing a page from six-ish minutes to ninety seconds — the whole
gain was being handed straight back to this timer, which is why four builds
couldn't show it. Whether splitting beats not splitting is still open for a
different reason: we time the split version and don't time the un-split one, so
there's nothing to compare against. That's the next free thing, and it's small.

**Not proven live yet.** Your next ordinary build proves it — no special run, no
extra spend. This touches the worker, so the container rolls and the usual 15–20
minute wait applies after the deploy.

---

## 2026-09-10 — Now we can actually time it

**You asked whether it'll tell us how long each one takes. It will now — it
couldn't before, and that's worth saying plainly.**

Here's the hole. When we split a page into pieces, we record how long the pieces
took. When we *don't* split it, we record nothing at all. So the question "is
splitting faster?" had no second number to compare against. That's not "we
haven't measured it yet" — there was nothing to measure it against, and buying
more builds would never have produced one.

**The fix is one number on both.** When a page is sent off to be written, we
already stamp the time. When the answer comes back, we already know the time.
Subtract, and that's how long writing the page took — the same number whether it
was split into seven pieces or written in one go. It goes on the record every
build already keeps.

**And this only works because of what I merged an hour ago.** Before the answer
started knocking on the door, this subtraction came out at about four minutes no
matter what — because it was measuring the four-minute timer, not the work.
Same sum, useless answer. I've written that dependency down next to the code:
if the knock ever stops working, this number quietly goes back to measuring the
timer, and it'll look perfectly reasonable while doing it. That's the trap that
cost us four builds, so it's on the record this time before it happens.

**A couple of small decisions.** If we can't work the number out — no stamp, a
clock that disagrees with itself — we record *nothing* rather than zero. Zero
would read as "the page took no time", which is a worse lie than silence. And we
only record it when the page actually arrived: recording it when we gave up
would store the age of a failed attempt, which looks exactly like the cost of a
page and isn't one.

**Checked.** Sixteen deliberate breakages, all sixteen caught, two harmless
comment edits confirming the tests aren't just failing at everything. Full suite
green at 5,890.

**Three of those breakages survived the first pass, and that's the interesting
part.** Two were genuine holes in my own tests. One of them is the mistake this
codebase makes more than any other — I worked the number out correctly and then
didn't hand it over, and every test I'd written checked that it was *calculated*,
not that it *arrived*. Fixed by running the real code end to end instead of
reading it. The third breakage turned out to change nothing at all: a
belt-and-braces check that's genuinely redundant today. I measured that rather
than assuming it, kept it, and wrote a note saying it's deliberate — otherwise
the next person deletes a safety check that looks like dead code.

**What it answers, and when.** Your next ordinary build carries the number. The
comparison that settles your original question is that number on a split build
against the same number with splitting switched off — one flag, no code change.
This touches the worker, so the container rolls and the usual 15–20 minute wait
applies after the deploy.

**Footnote, and it's about our own tooling rather than the product.** GitHub's
API told me the test run was still going for about fifteen minutes after it had
actually finished — green, in the usual eighty-odd seconds. Three different ways
of asking all gave the same frozen answer. That's the second time in two days,
and yesterday's note about how to spot it didn't help this time, because the
whole snapshot was stale rather than half of it. I've corrected the note: the
thing that actually catches it is knowing how long the step normally takes, and
waiting. I didn't report it as stuck, and I didn't report it as passed until it
really had.

**Merged and deployed.** Main moved to `50f2ff19` at 20:56Z, deploy went green in
3m19s. The container rolled at 20:59:44Z, so the usual 15–20 minute wait runs to
about 21:15–21:20Z. After that, **your next ordinary build carries the number** —
no special run, nothing extra to spend.

**What to look for.** On that build's record, the collector's step now carries
`genMs`: how long writing the page actually took. Then, when you want the answer
to your original question, run one more with splitting switched off — that's one
GitHub secret (`BAND_SPLIT_CANARY` set to `-`) and a redeploy, no code change.
Two numbers, same measurement, and you'll know.

**One free thing this deploy also made possible.** Both container images now
carry an id, so the 15–20 minute wait can be measured for the first time instead
of guessed. If you're signed in, `/api/site/build-health` answering
`0976b2e45f397667` means the old image is still serving, and the flip to
`9b2b2483f6c968c…` is the moment the wait genuinely ends. I can't read that one —
it needs your login.

## 2026-09-10 — Your build answered the question, and the blank screen is fixed

Two things, and the first one is the answer you've been after for three days.

### 1. Splitting the page IS faster. About twice as fast.

You turned splitting off before this build, which made it the control I needed —
and the trace says so in its own words (`bands:door`, which is the little
instrument I built this morning naming exactly why it didn't split). So:

| build | how the page was written | how long it took |
|---|---|---|
| `kestrel-bindery`, 7:51pm | split into 7 pieces at once | **93 seconds** |
| `marlow-and-tide`, 9:27pm | one go | **180 seconds** |

**That's the comparison that didn't exist yesterday.** Being honest about its
limits: it's two different briefs, one build each, and the two numbers are
measured from slightly different points (the single-call one includes about 7
seconds of plumbing either side). But the gap is 87 seconds against 7 seconds of
noise, so it isn't the instruments. One more ordinary build with splitting back
on gives the clean, identical-measurement version — both paths write the same
field now.

**What did NOT halve is the whole build.** Marlow took 8m25s and Kestrel 9m29s.
The page is one part of a build whose *design* step alone is over three minutes.
If you want the total to come down, design is where the time is — and we already
measured that splitting the design step is a wash, so that's a different problem.

### 2. The four-minute wait is really gone

You saw the idea; here's it working. Every build used to sit doing nothing for
about 253 seconds no matter what. On this build that dead time was 188 seconds —
and 180 of those were *the page actually being written*. Seven seconds of
genuine overhead, down from 253.

The clearest way to see it: Kestrel finished its page in 93 seconds and then sat
there for 160 seconds doing nothing, because the timer hadn't gone off. Marlow
waited longer — because its page took longer. **The waiting now tracks the work.**
That's the whole point.

### 3. The blank screen — fixed

**What was wrong.** When you press send, we draw the screen and *then* mark the
build as started. In that order. So at the moment of drawing, the build hasn't
officially begun yet, and the big panel correctly shows "Describe your site on
the left". A split second later we mark it started and tell the screen to
refresh — but the refresh only knew how to *update* the build panel, and there
wasn't one to update. So it did nothing, and the invitation stayed there for the
whole eight minutes.

Clicking a button redrew the whole screen from scratch, which is why that worked.

**The fix.** The refresh can now *create* the panel, not just update it. One
line of decision and one line of drawing, both shared between the two places that
need them — because the underlying mistake was that the screen's own drawing was
shared and its *decision* wasn't.

**This is the third time this exact thing has bitten us**, and I've written that
down. First the panel said "Thinking…" for seventeen minutes. Then typing "hey"
replaced your preview with a build bar. Both times the fix stopped one layer
short of this one. It should be the last.

**One thing I deliberately left alone.** On a site that already exists, that big
panel holds your live preview. Painting a build panel over it would throw your
preview away and reload it in the middle of an edit. So the fix only touches
sites that have nothing to show yet — and there's a test that fails if anyone
loosens that.

**Checked.** Twenty-one deliberate breakages, nineteen caught, two harmless
comment edits confirming the tests aren't just failing at everything. Full suite
green at 5,898. Screenshot of before and after in the chat.

**Two of those breakages survived my first pass and neither was harmless** — both
were holes in my own tests rather than the code. I measured both rather than
assuming they were nothing, then wrote the missing tests. That's the check
working.

**No wait after this one.** This is browser code only, so nothing rebuilds and
there's no 15–20 minute hold. You will need a hard refresh for it to reach you,
though — the browser caches that file.

## 2026-09-10 — merged, and it's live

Deploy went green in **54 seconds** — the fast shape, because nothing this push
touched goes into the container. **Nothing rebuilt, nothing rolled, no 15–20
minute wait.** I read that off the deploy's own log rather than guessing from how
long it took: it says "no changes" for both containers, in as many words.

The neatest confirmation is in the upload: Wrangler read 212 files and uploaded
**exactly one — `chat.js`**. That's the fix and nothing else.

**So it's live now. Hard refresh** (the browser caches that file) and the big
screen will fill in as soon as your next build starts.

**One thing for when you want the comparison build.** The deploy log shows
`BAND_SPLIT_CANARY` as fully hidden while the design one shows its value —
side by side, same upload. That means the secret you set at 21:19pm to switch
splitting off is still there, and a secret you set always beats the default in
the code. **So splitting is still off.** To turn it back on: delete that secret
in GitHub (it falls back to your account automatically) or set it to your
account id, then run the deploy once. After that, one ordinary build gives the
clean comparison.

**A footnote on our own tooling, third day running.** GitHub told me the deploy
was still going for about nine minutes after it had actually finished. This time
the tell I wrote down yesterday did work — the run's own "last updated" stamp was
sitting behind its step stamps, which is the giveaway — so I waited and re-asked
instead of reporting anything. It came back green.

**And a small thing worth knowing.** When I merged, git's own summary listed some
worker files as changed. They weren't — my local copy of main was three commits
behind, so the summary was measuring from the wrong place. The real comparison is
against what's actually on the server, and that's eight files, none of them
container ones. I've written that down, because reading the wrong summary is
exactly how someone concludes "the container rolled" when it didn't.

## 2026-09-10 — your drawing, built

You drew four lines of different lengths hitting one wall, with WAIT written
twice. That's exactly right, and it's the whole thing: **when you fire four
agents at once, the wave costs whatever the slowest one costs.** The other three
finish early and then sit there waiting. So splitting turns "add them all up"
into "just the longest one" — which is why it's faster — and the only way to make
it faster *again* is to find the slow one and cut it down.

**Here's the problem I had to fix first.** We were storing the total. Four agents,
one number. It told us the split saved about a minute, and it could not tell us
*which* agent was making everyone wait. Cutting a fast agent in half buys nothing
at all, so without that, any next step is a guess.

**So now each agent's own time is stored, under its own name.** Four numbers on
the same row you already have: identity, plan, look, detail. One build and you
can see which one is the wall.

**Nothing else changed.** No new calls, nothing rearranged, nothing split. It's
four extra numbers on a row we were already writing. The design step behaves
exactly as it did this afternoon.

**What I expect it to show, and I want to be honest that this is a guess.** My
money is on **look** — it's the agent that draws your logo and your tab icon and
writes the stylesheet, and drawing is slow. **plan** sends the biggest question
by a mile (the whole component menu, 32,000 characters of it) but its answers are
short lists, and time follows what a model *writes*, not what we send it. I've
been wrong about this once already today, so it's a guess until the build says.

**Checked.** Twenty-three deliberate breakages, twenty-three caught, three
harmless comment edits confirming the tests aren't just failing at everything.
Full suite green at 5,907.

**One of the twenty-three survived my first pass**, and it was worth chasing. A
safety check looked like it did nothing — so I measured it against nineteen
different kinds of bad input and it made no difference on eighteen of them. But
on the nineteenth it did. I wrote the missing test rather than deleting the
check, and then it failed properly. The rule here is that a check that *appears*
useless gets measured before anyone removes it.

**This one does rebuild the container**, so after it deploys there's the usual
**15–20 minute wait** before a build picks it up.

**To read the answer you need one ordinary build** — nothing special, just a
normal one. Then I can tell you which agent is the wall, and we can talk about
whether it's worth cutting.

## 2026-09-10 — merged, deployed, live

Deploy went green in **3m21s**, the normal shape for a push that touches the
container. The image rebuilt (2m25s) and **the container rolled** — I read that
off the deploy's own log rather than guessing from how long it took: it says
`EDIT isibi-app-sitebuildcontainer` and names the old image and the new one.

**The 15–20 minute wait ended around 23:15–23:20.** It's past that, so the new
code is live and your next build picks it up.

**A footnote you should know about, because it wasted an hour of my evening.**
GitHub told me the deploy was still running for **forty minutes** after it had
actually finished — on a step that takes two and a half minutes. That's ten
times worse than any of the previous days. I didn't report it as stuck and I
didn't report it as done; I waited and kept re-asking, which is the rule I wrote
down yesterday.

**And I learned something new about it.** I tried asking a *different* GitHub
endpoint as a second opinion, and it agreed with the wrong one — because they
share the same cache. So two GitHub answers that agree are not two answers, they
are one. The only thing that told the truth was the finished job's **log**, and
that isn't available until the job admits it's done. I've written that down.

**The one thing still on your side.** The deploy log confirms the band split is
switched off — your secret from 21:19 is in place and beating the code default.
The design split is on for your account. To turn the band one back on: delete
`BAND_SPLIT_CANARY` in GitHub or set it to your account id, then run the deploy
once.

**Then one ordinary build answers three things at once**: which design agent is
the slow one, whether the split page really is half the single one on a matched
pair, and what the whole build costs with both splits on now the four-minute
dead wait is gone.

## 2026-09-10 — you fired a build, and it named the wall: **look**

`ravenscroft-and-fyne`, 23:10:41 to 23:17:29. It worked, and the design step now
carries one number per agent — which is what your drawing asked for.

| agent | how long it took |
|---|---|
| identity | 21.9s |
| plan | 78.6s |
| **look** | **132.4s** |
| detail | 83.4s |

**`plan` and `look` run side by side, and `look` takes 54 seconds longer.** So
`plan` finishes its work and then stands at the barrier doing nothing for 54
seconds, waiting for `look`. That is exactly the picture you drew.

**Why this matters more than the total.** The whole design step took 237.7s. If
we made `plan` twice as fast, the design step would still take 237.7s — not one
second saved, because `plan` isn't what anyone is waiting for. If we made `look`
as fast as `plan`, we'd get about **54 seconds** back. Before today the row only
stored the four added together, so there was no way to tell those two apart.

**The numbers check out against each other three ways**, which is how I know the
instrument is telling the truth and not just producing plausible figures:
the four agents add up to exactly the total work; the longest agent in each wave
adds up to exactly the wall clock; and the "time saved by running them together"
comes out to exactly `plan`'s own time. Nothing rounded, nothing approximate.

**What `look` actually does**, so the number makes sense: it draws your logo, it
draws your tab icon, and it writes the stylesheet. Drawing is slow — we measured
one logo alone at nearly five minutes on the edit path once. The other three
agents answer in words and lists, which is quick.

**So the obvious next question is whether to split `look` in two** — the two
drawings in one agent, the theme and the stylesheet in another. That would make
the middle wave three-wide instead of two and could take a real chunk off. I
haven't started it. **It's your call**, and it isn't free — it's another agent,
so another call to pay for.

**Two other things off the same build, both free.** The page was written in one
call, as expected, since your band secret is still switched off — the trace says
so in a word. And that single call took **294s**, where the last one took 180s.
So single-call page times swing a lot, which is worth knowing before we try to
compare a split page against one.

## 2026-09-10 — and the same row tells us the ceiling, for free

I did the arithmetic on your barrier picture and it gives a cleaner answer than
one build's numbers.

**The time you save is always whichever of the two finishes first.** `plan` and
`look` run side by side; the one that finishes early stands and waits. So the
saving is exactly that one's own time — 78.6s on this build, which is `plan` to
the millisecond. That also explains something I've been reporting as unexplained
for two days: the four earlier builds saved 51.9s, 65.2s, 66.0s and 66.2s, and I
had no reason for the spread. There isn't one. **Each of those was just that
build's `plan`**, and generations vary. Nothing more needs buying to know that.

**And here's the ceiling, which is the part worth your attention.** Three of the
four agents run *alone* — `identity` on its own, then the pair, then `detail` on
its own. So however fast we make `look`, the design step can never go below
**identity + plan + detail = 183.9s, about three minutes.** Today it's 237.7s.
That means:

- cutting `look` is worth up to **~54 seconds**, and not a second more;
- after that, the only way down is **more agents running at the same time** —
  widening the middle, not making anyone faster.

So there are really two separate decisions here, and they're different sizes.
The small one is splitting `look` in two, worth about 54s. The big one is
reshaping the waves so more than two things ever run at once, which is where the
remaining three minutes are. **Both are your call and I haven't started either.**

## 2026-09-11 — your drawing, measured

`docs/edits/design-waves-barrier.png` is the picture you drew with the real
numbers on it, plus the two "what if" cases underneath.

**One thing in it differs from your sketch, and it's the point.** You drew
several lines all waiting at the barrier. In reality **only one waits** —
`plan`, for 53.8 seconds, behind `look`. The other two agents (`identity` and
`detail`) don't have anyone to run beside; they go on their own, one before the
pair and one after. So there is exactly one gap in the whole design step.

That's the difference between this and the page split. **The page split is seven
things at once, for its whole run** — 424 seconds of work in 93 seconds of
clock. **The design split is two things at once, and only in the middle third.**
Same idea, very different shape, and the shape is what decides whether it pays.

## 2026-09-11 — three waves or one, and how many steps there really are

**You asked how many steps the design step has. It's 23** — 23 questions on the
tool, 15 of them compulsory. A first build skips one (`backend`, which only the
add-on step uses), so **22 get answered**. I measured it rather than trusting my
own notes, which have been one out before.

**The three waves do NOT start together.** Wave 2 waits for wave 1 to finish,
wave 3 waits for wave 2. Your drawing is one wave. `docs/edits/design-waves-shapes.png`
puts the three shapes side by side on this build's real numbers:

| shape | what the customer waits | vs today |
|---|---|---|
| today, three waves | 237.7s | — |
| two waves | 154.3s | **83s faster** |
| one wave (your drawing) | 132.4s | **105s faster, 44%** |

**In one wave the design step is just its slowest agent** — `look`, at 132s.

**What the waves are buying, so the trade is clear.** Each later agent is told
what the earlier ones decided. Drop that and they each invent the business on
their own — and the wordmark could be drawn for one name while the pages use a
different one. That has actually happened here before (four builds in a row
invented names for the wrong business). It isn't a theoretical risk.

**And here's the thing I think matters most.** Look at these two:

- `identity` answers **eleven** questions in **22 seconds**
- `look` answers **four** questions in **132 seconds**

So the number of questions tells you nothing. What costs time is the *kind* of
answer. Naming a business and picking a language is quick. Drawing a logo is
slow. Which means the current grouping was made on the wrong basis — we grouped
by what depends on what, and never by what's actually slow.

**The honest limit: I can't tell you which of `look`'s four is the 132 seconds.**
Theme, stylesheet, logo, tab icon all go out in one call, so they share one
number. Unlike everything else this week, there's no free way to find out.

**Cheapest way to know**: make `look` two agents — the two drawings in one, the
theme and stylesheet in the other. One ordinary build then says which half is
slow, and that's the number that decides whether one wave is worth its risk.
Not started; your call.

## 2026-09-11 — your second drawing: all 22, only the real waits

You're right, and it's a better model than what we built. `docs/edits/design-field-graph.png`
draws it: every field starts at once, and only the ones that genuinely need
another's answer wait — your line cut in two pieces.

**Eleven of the twenty-two can start on the first second.** The deepest chain is
five long — kind → pages → components → shape → behavior — and everything else
is at most two deep.

**Today's waste, in one sentence:** `tsx` and `behavior` sit waiting for all 132
seconds of `look`, and neither of them needs anything `look` answers. That's the
barrier costing us for no reason.

**But I found the real obstacle while reading the field text, and it isn't the
scheduling.** The tool is written as one conversation with itself:

- the stylesheet field says "the theme you picked **above**"
- the layout field says "the page and the components are **already decided above**"
- the custom-component field says "you have **just picked** from the kit"

Split those into separate agents and the sentences stop being true — an agent
writing the stylesheet on its own never picked a theme. So the job isn't
rescheduling; it's **rewriting about eleven fields so each takes its input as
given instead of as something it did itself.** That's prompt work, which is
where we've lost real builds before, so it needs care rather than speed.

**Two things I still can't tell you, honestly:**
- which chain is the slow one — we time agents, never fields, so `look`'s 132s
  could be the logo or the stylesheet and there's no free way to find out;
- whether 22 calls can run at once where they're made. The limit is 4 today and
  the code's own comment says that's a memory-and-sockets question.

**Not started.** If you want it, I'd build it behind a flag like the other two
splits, so nothing changes for anyone until you switch it on.

## 2026-09-11 — you were right to push back: I over-claimed the waits

I said eleven of the twenty-two had to wait for something. **It's seven, and
only three of those are real.** I checked it properly this time by reading each
field's own wording instead of reasoning about it.

**How the tool says a field waits.** It uses a phrase — "the theme you picked
*above*", "you have *just picked* from the kit", "*already decided above*",
"only when needsWeb is true". Seven fields carry one of those. Fifteen say
nothing at all.

**Three I made up.** `slug`, `pages` and `favicon` were my reasoning, not the
code. I had also put `behavior` at the end of the longest chain, and the tool
never says it waits for anything either. That's four wrong out of eleven, in a
picture I'd already sent you and pushed. Corrected now —
`docs/edits/design-field-graph.png` is redrawn.

**Of the seven that do wait, only three genuinely can't be answered otherwise:**
the stylesheet (it *is* the bit the theme doesn't give you), the layout (it
arranges the component list), and the custom-components field (it's whatever the
kit couldn't do). The other four are soft — the logo only wants the theme so its
colours don't vanish, the photos only want the layout for flavour, and the
search-queries one is just the back half of a yes/no that should share its
agent.

**So it lands almost exactly where you drew it.** Fifteen start on the first
second, and there's one real chain: page → components → layout → photos.

**One genuine gap I found while checking.** `behavior` is supposed to list every
button, form and toggle on the page — but the tool never tells it to wait for
the page to be planned. It's been relying on the order of the questions to do
that silently. Under the current waves it works by luck; under your graph it
would start immediately and describe controls for a page nobody has designed
yet. That sentence needs writing whichever way we go.

## 2026-09-11 — what the graph would actually look like

`docs/edits/design-graph-shape.png`. **19 agents covering the 22 fields, eleven
of them starting on the first second, and one chain of four:**
pages → components → shape → images.

In code it's a plain list — each entry is a name, the fields it answers, and
what it needs. No `needs` means it starts immediately. The scheduler gives each
agent a promise that waits for its `needs` and then fires, so **that list IS the
running order** — nothing anywhere says "wave 1, wave 2" any more.

**Two of the arrows are mine rather than the tool's, and they're drawn dashed
so nobody forgets:**
- `behavior` waits for `shape`, because it lists every button and form on the
  page and can't do that before the page is arranged. The tool has never said
  this; it's been getting away with it because of question order.
- `favicon` waits for the name and the theme, because a letterform needs the
  initials and the mood needs the theme.

**And `brand`, `slug` and `description` stay in one agent** — three separate
ones would each invent a business name and they'd disagree.

**Why this beats the waves:** the two slow fields are the drawings, and they now
hang off two of the *cheapest* answers. So the slow work starts almost at once
instead of in the middle of the second wave.

**Regrouping later is editing that list** — moving names between the `fields`
arrays, no new code. Which is exactly what stage C would be, once a real build
has told us which field is the slow one.

## 2026-09-11 — you asked again, and most of those waits weren't real

Six of the ten arrows I drew don't earn their place. Redrawn:
`docs/edits/design-graph-shape.png` — **fifteen of the nineteen agents now start
on the first second, and the only chain left is three long.**

**What I dropped, and why each was wrong:**

- **components waiting for pages.** `pages` says "ONE page… one entry: what the
  site is called, route /". It's a near-constant. This arrow is a leftover from
  when a site had five pages, and it was sitting at the head of the longest
  chain doing nothing.
- **shape waiting for pages.** Same. Shape still waits for the components, which
  is the arrow that actually matters.
- **tsx waiting for components.** It needs the kit's *menu*, not which fifteen
  got picked — and its own field says "OMIT ENTIRELY… the right answer for
  nearly every site", so it barely ever runs. Worst case if it's wrong: one
  duplicate part.
- **images waiting for shape.** The field says "THE BRIEF'S OWN WORDS ABOUT
  PHOTOGRAPHS ARE LAW". The shape only tinted the wording.
- **wordmark waiting for theme.** Colour contrast only — and the tool already
  names its own safe answer, "a plate behind the letters is the safe shape".
- **favicon waiting for the name and theme.** Both were mine, neither is in the
  code, and it's one of the two SLOW fields — so that arrow cost the most and
  bought the least.

**The four that stay:** shape waits for components (it arranges them), css waits
for the theme (it *is* the bit the theme doesn't give), wordmark waits for the
name (you can't set a name you haven't got), and behavior waits for the layout.

**Third time I've had to correct this.** I called `tsx` unavoidable twice. The
pattern is the same each time: I reasoned about what *sounds* like it needs
something instead of reading what the field actually says. Worth me remembering
the next time I draw one of these.

## 2026-09-11 — and not all of them are required

Checked: **14 required on a first build, 8 optional** — tsx, qr, css, lang,
langs, three, needsWeb, webQueries. Two things follow, and the second would have
bitten us.

**Four of the optional ones are usually ABSENT**, by their own wording — tsx
("OMIT ENTIRELY… the right answer for nearly every site"), css ("OMIT unless the
customer's own words ask"), three, and qr. So four separate agents would each
buy a model call in order to answer "nothing". That's paying for silence.

**Group them.** One call that says "no custom components, no QR, no 3D" costs a
quarter of four calls and loses no time, because a "nothing" answer comes back
instantly either way. Same for lang + langs, which are one decision about
language. That takes it from **19 agents to 16 with identical parallelism** —
twelve starting at once, same chain of three — and three fewer calls on every
build.

**The failure rule has to split in two.** Today "an agent answered nothing" ends
the design. With one agent per field that stops being an edge case and becomes
an everyday event: tsx answering nothing is the RIGHT answer on most sites. So:

- answered nothing, field optional → normal, carry on
- answered nothing, field required → the design failed

**And one useful consequence.** Of the four waits left, `css` is the only one
whose own field is optional. So if the theme agent dies, css is simply skipped.
If `components` dies, `shape` and `behavior` both fall over and the design is
genuinely done for. Worth knowing which failures are survivable before building
it rather than after.

## 2026-09-11 — built it: the design step is the graph you drew

Your drawing, in code. `builder/design-graph.mjs` — **sixteen agents, twelve of
them starting on the first second, one chain three long.** No waves, no
barriers: each agent starts the moment its own input lands.

**It's switched OFF.** Nobody is on it — not even your account, which is
different from the last two splits. Those two named your account in the default
because each had already been proved live; this one has never designed a site,
so the default opens nothing and turning it on is a deliberate step.

### What's in it

| starts immediately | waits for |
|---|---|
| the name (brand + slug + description together), theme, components, pages, kind, purpose, action, images, favicon, the optional extras (tsx/qr/3D), language, web search | wordmark → the name · css → the theme · shape → the components · behavior → the shape |

**The name stays as one agent on purpose.** A slug is the brand as an address
and a description is the brand in one line — three agents reading the same brief
would each invent a different business name. Four nameless-CRM runs already
taught us what that costs.

**The rarely-used optional fields share one agent.** tsx, QR and 3D are absent
on nearly every site by their own instructions, so four separate agents would
each buy a model call to answer "nothing". One call saves three and loses no
time, because "nothing" comes back instantly either way.

### What I had to be careful about

**A loop in the arrows doesn't crash — it HANGS.** Two agents waiting on each
other just sit there until the job clock kills the build, with everything
charged and nothing to show. So the graph is checked before it runs, and
anything wrong with it falls back to the way builds work today.

**Each agent is told only what it asked for**, not everything that happened to
finish first. Otherwise the same brief gives different prompts on two runs, and
a build that came out well can't be reproduced.

**A failed agent doesn't hang the ones behind it** — they're skipped and named
on the row, so you can see "shape was skipped because components died" instead
of a build that stops with no explanation.

### The honest bit about my own tests

The sweep found **seventeen holes**, and thirteen of them were the same mistake:
my tests proved the graph was *shaped* right — who starts, who waits, who gets
told what — and never read a single number it produces. The numbers are the
whole point of this change. Fixed, and the sweep is now **69 mutants, 67 killed,
nothing survived**. Suite 5,937.

The other four turned out to be walls that a second wall already covers — I
measured that over 68,000 generated graphs rather than guessing, wrote in the
code that the doubling-up is deliberate, and replaced each with a test that does
bite.

### What happens next

**Stage B is one build with the flag on, on your account.** That's the only
thing that produces a time for every single field — which is what we'd need
before regrouping anything. Turning it on is one secret in GitHub and a
redeploy; I can't fire a build from here, so it's your button.

Nothing about the site a customer gets changes either way.

## 2026-09-11 — merged, deployed, and your secret is confirmed on the Worker

Deploy 2084, green in **3m03s**. The container rolled at 01:58:57Z, so the
15–20 minute hold ended around 02:14–02:19Z. It's long past — **a build now
runs the new code.**

**Your secret is really there**, and the log proves it in a way that's worth
knowing about for next time. `DESIGN_GRAPH_CANARY` printed as `***` — fully
hidden. The code's own fallback is a dash, and GitHub prints a dash in the
clear because a dash is nobody's secret. Hidden means a real secret is behind
it.

And there's a second tell: `DESIGN_SPLIT_CANARY` has printed as `22…75f4…`
on every deploy since yesterday, and today it went fully hidden too. GitHub
hides a secret's *value* everywhere it shows up — so the design split's
built-in default got hidden only because a registered secret now holds that
same account id. **So the log says both that your secret exists and that it's
the right account.** Reading the code file could never have told us either.

**GitHub's status API lied for twenty-five minutes again** — third time
today, once on the test run and twice on deploys. The job finished at
01:59:08Z and the API said "still running" until about 02:20. There's no
reading that beats it; the only honest move is to wait and re-check, which is
what I did. If you ever want to know sooner than I can, the Actions page in
your browser shows the live log and the API doesn't.

**Next is one build.** The brief I gave you is sized to match
`ravenscroft-and-fyne`, which is where today's four per-agent numbers came
from — so the comparison is clean. Tell me the site name and I'll pull the row.

## 2026-09-11 — the build ran, and the design step beat every run we have measured

`sowerby-forge` is live. It cost **14 credits** (332 → 318) and the whole
build took a shade under five minutes.

**The design step took 159,599 ms — 2 minutes 40.** Every previous build on
your account, whichever way it designed, sat between **175,259** and
**237,763**. So this is not a bit quicker than the average, it is under the
whole range.

**And the numbers prove themselves.** Two sums have to come out exact if the
thing really ran the way we built it, and both do:

- The sixteen agents' own times add up to 527,944 — which is exactly the
  total the build recorded. Nothing lost, nothing double-counted.
- `components` + `shape` + `behavior` = 159,599 — which is exactly what the
  whole step took. That chain of three IS the design step. Everything else
  finished underneath it.

So the twelve agents that wait for nothing really did run side by side. If
they had run one after another the step would have cost 527,944, not 159,599.

### Where the time actually went

**Nine minutes of work in two and a half minutes of clock.** That is the
368,345 ms of overlap. And this is the first time the trade has gone the
right way: the three waves bought about a minute of overlap and cost about a
minute of extra work, which is why it was a wash. Sixteen separate calls cost
more in total than four — but they overlap so much more that it stops
mattering.

**We were wrong about which step was slow.** For a day the record has said
the drawings were the wall — the wordmark and the tab icon, both hand-drawn
SVG. Now that they are separate we can see: the two drawings together are
**83,426**, and the **stylesheet on its own is 93,013** — the single most
expensive step in the whole graph.

One honest caveat: the stylesheet step normally answers *nothing* and costs
nothing. It only does work when the brief asks for a look the theme does not
already give — and the brief I gave you said "dark, heavy, a bit sooty",
which is exactly that. So 93,013 is what it costs when it works, not what it
costs every time. What is not brief-dependent is that the drawings are no
longer the thing to blame.

### What to change next, if you want to

The slowest run is `components → shape → behavior`. Second place is
`theme → css` at 113,397 — about **46 seconds behind**. So:

- Cutting the long chain is worth **about 46 seconds and no more**, because
  the stylesheet becomes the wall the moment you get past it.
- The drawings are not on the slow path at all. Speeding them up buys zero.
- The link I would question first is **`behavior` waiting on `shape`**. It is
  the only one of the four waits that is my judgement rather than something
  the step's own instructions say. If it does not really need to wait, that
  is the 46 seconds.

That is Stage C and it is your call — nothing is changed yet.

### The picture

`docs/edits/design-graph-sowerby.png` — your barrier drawing with this
build's real numbers on it. Sixteen bars, each starting where it really
started, the slow run in green ending exactly on the line, and the old
three-wave finish as a faint line further right so you can see the gap.

## 2026-09-11 — the same for the generate step: what it says, and what it could not

Short version: **the generate step does not record what each band cost**, so the
chart you asked for cannot be drawn from it yet. I built the instrument that
records it. Here is what the step *does* say today —
`docs/edits/generate-step-today.png`.

### What the numbers already show

The last build that wrote its page in pieces was `kestrel-bindery`, and it is
the most impressive number on this platform:

- **7 bands, all at once: 93,375 ms** — a minute and a half.
- **The same work one after another: 424,444 ms** — seven minutes.
- So **331,069 ms of overlap**. The design split, by comparison, buys about a
  minute. This is the split that really pays.
- And against a page written in ONE call (`marlow-and-tide`, the control I ran
  the same night): **93,375 against 180,456** — roughly half.

### What is missing

The design step now reports one number per agent — which is how we found that
the stylesheet, not the drawings, is the wall. The generate step reports **one
number for all seven bands**, so "which band is the wall" cannot be asked at
all. And the wall is the only thing worth cutting: the other six answer and then
wait for it.

That is what I added. Each band now gets its own number — `b1Ms`, `b2Ms` and so
on, counting down the page — so the next split build draws the same chart the
design step drew.

**Keyed by position rather than by name, and that is a real decision.** The
bands are called things like `Band1Testimonials`, and the trace cuts a label at
sixteen characters — so two bands whose words start the same way would end up
sharing one slot, with the second quietly writing over the first. A wrong number
wearing the right name is the one way this could lie to us instead of just going
quiet. The position cannot do that, and it is what a chart shows anyway: band 1
is the top of the page.

### One thing you need to do

**The band split is switched off right now.** You set that secret yourself last
night at 21:19 so we could time a single-call control, and it worked — that is
where the 180,456 came from. Every build since has recorded `bands:door`, which
is the trace saying "the flag is off for this account":
`marlow-and-tide`, `ravenscroft-and-fyne`, and last night's `sowerby-forge`.

So the per-band chart needs the split back on. Either delete
`BAND_SPLIT_CANARY` in GitHub (the code's own default already names your
account) or set it to `22175f41-6fbf-49d7-b039-a65078a0141c`, then redeploy.
After that, one ordinary build fills the chart in.

**No page a customer sees changes either way**, and nothing about the design
graph moves — that stays on.

## 2026-09-11 — one agent per thing on the generate step

You asked for the design step's shape on the generate step: one agent per thing,
and a thing waits only if it genuinely needs something first.

### Nothing waits, and I checked rather than guessed

I went looking for what has to wait for what, the same way I did on the design
step — by reading what each prompt actually says, not by reasoning about what
sounds like it would need to wait. (That is how I got the design graph wrong
three times before it was right.)

The answer is **nothing waits**. Two reasons, both in the code already:

- The band prompt already tells each band, in as many words, that *"the bands
  above and below yours are being written at the same time by someone else."*
- A component's whole input is its own description — its name, what it does,
  what props it takes, where it is imported from — and the design step answered
  all of that before any of this starts. A band that uses the component reads
  that same description.

So neither one needs to see the other's code. There was no waiting to add.

### What "one agent per thing" actually bought

Here is the part that turned out to matter. The split had a rule that refused to
run at all if the design had asked for a **custom component** — something the
2,112-piece kit does not have, which the model writes itself. The reason was
honest: a band writes one section of the page, and nobody was writing the
components, so a split build of that site would produce a page importing a file
that does not exist, and the build would die.

**One agent per thing fixes exactly that.** A component is the same kind of thing
a band is — one file, one job — so it gets its own agent, and now it goes out
alongside the bands in the same burst. That refusal is gone.

It matters because it was not rare. Any site interesting enough to need something
the kit has not got was quietly falling back to writing its whole page in one
call — the slow way — and nothing said so.

### The safety bit

If one of those component agents comes back with nothing, we **do not drop it**.
We write a placeholder file that compiles and shows nothing. Dropping it would be
the dead build all over again: a page importing a file that is not there.

A missing section is a page with a gap. A missing file is no page at all.

### One new refusal in its place

There is a ceiling of 8 on how many agents can run in one burst. A page can plan
up to 8 bands and the design can ask for up to 3 components — 11, which does not
fit. When that happens the split now steps aside and the page is written in one
call, and the trace says `bands:wide` so we can see it happened.

It counts what was actually asked for, not what could have been — a page with
five bands and one component is never refused for a limit it never reached.

### On the chart

Each band and each component now reports its own time, and the trace label says
which kind it was: `b1Ms`, `b2Ms` … for the bands down the page, `p1Ms`, `p2Ms` …
for the components. Without the letter, component 1 of a seven-band page would
have filed itself as "band 8" — a number that looks perfectly fine and names the
wrong thing, which is worse than no number.

### Nothing to do, and one thing still waiting on you

No page a customer sees changes. No prompt changes. The design graph stays
exactly as it is.

**The band split is still switched off** — that is the secret you set on the
10th so we could time a single-call control, and it is still doing its job. To
see any of this run, and to fill in the per-band chart, delete
`BAND_SPLIT_CANARY` in GitHub (the code's own default already names your
account) or set it to `22175f41-6fbf-49d7-b039-a65078a0141c`, then redeploy.
One ordinary build after that shows the whole thing.

## 2026-09-11 — we tested it: the refusal is gone, and the wall moved

Merged, deployed, and built `ben-crowe-guitar` with the guitar-teacher brief.
Site is live, it cost **20 credits** (318 → 298), and the picture is
`docs/edits/design-generate-ben-crowe.png`.

### The good half

**The component got written.** The design asked for a fretboard the kit has not
got, the page was built with it, and it is on the live site — "See where the
fingers go", with the chord markup under it.

**Yesterday that exact build would have been refused.** It would have recorded
`bands:tsx` — the old rule that said *this site wants a custom component, so do
not split it at all*. That rule is gone. Which is the thing we set out to fix.

### The half that did not get to run

It still wrote the page in **one call**, and it took **407,694 ms** — nearly
seven minutes, the longest page write we have ever measured. It says why:
**`bands:wide`**.

Here is the arithmetic. A page can plan up to **8** bands. A design can ask for
up to **3** custom components. The container can hold **8** calls at once. This
page did both, so the list came to at least 9 — one over — and the split stepped
aside rather than drop anything.

**So the page that most wants splitting is the page that cannot.** A rich page
that also needs something the kit has not got is exactly the expensive case, and
it is the one that overflows. That is not bad luck, it is the shape of the rule,
and this build is the proof.

For scale: a page that *did* split — `kestrel-bindery`, seven bands — took
**93,375 ms**. Different brief, so it is not a like-for-like, but the gap between
93 seconds and 407 is roughly what this is costing.

### Your call, three ways

1. **Leave it.** The refusal is honest and it only bites the widest pages.
2. **Let the container take a longer list and run 8 at a time.** We already do
   exactly this in the design step — sixteen agents through a pool of eight. It
   would have let this build split, and it invents no new number. **This is the
   one I would pick.**
3. **Raise the limit from 8.** Quickest, and the one I would avoid: 8 is there
   because seven-at-once is the most we have ever actually run, and too many open
   calls is how a container dies mid-build.

### And the design graph proved itself twice over

Second build running, second time the numbers close exactly: the sixteen agents
sum to their own total, and the slow chain — components → shape → behavior —
comes to **245,189 ms**, which is the whole design step to the millisecond. Ten
minutes of work done in four minutes.

One thing that confirms an earlier note: the stylesheet took **29,763 ms** here
against **93,013** on the last build. That entry said the 93 seconds was what
`css` costs *when the brief asks for a look the theme does not give*, and that on
a brief that does not ask it would be quick. This brief did not ask. It was.

---

## 2026-09-11 — built option 2: the queue

You said it plainly: *"whatever the designer does then it should go to the
generate, if the designer does 9 the generate needs 9 if 8, 8."* That is what
this does.

### What was wrong

One number was answering two different questions. `MAX_MODEL_FANOUT` = 8 meant
both *how many calls may be open at once* and *how long a list may be*. Because
those were the same number, a plan of nine pieces could not be sent at all — so
instead of running nine, we ran **one**, and the whole page went out in a single
model call. That is `bands:wide`, and it is what cost `ben-crowe-guitar` nearly
seven minutes.

### What it does now

The two questions are two numbers.

- **8 calls at a time** — unchanged, and it is the only number about sockets and
  memory. Seven-at-once is still the most this platform has ever actually run.
- **Up to 16 in a list** — new. The fan-out takes the whole list and holds the
  extra ones back; as each call finishes, the next starts.

So eleven pieces is eleven agents: eight go immediately, and the last three go as
slots free up. Nothing is dropped, nothing is refused, and nothing is written in
one call because the number was awkward. **`bands:wide` is gone entirely** — the
refusal word is deleted, not merely never reached.

Sixteen is not a guess I want you to have to trust: the most a design can ever
ask for is 8 bands + 3 components = 11, and there is a test that fails the day
either of those caps grows past 16. So it cannot silently go back to the old
behaviour.

### The one thing that stays true

The last piece in a queue of eleven still waits for a slot, so it is eleven
agents but not eleven at the same instant. It is still far faster than one call
writing the whole page. Going past 8 at once is a separate question and I have
not touched it — nothing here has ever run more than 7 at once, so raising it
would be guessing.

### What a page that already fits does

Exactly what it did yesterday, byte for byte. The queue only engages when there
is something to queue, so every build shipping today is untouched.

### How you will see it worked

The next build whose design declares a component and plans a full page. Today
that records `bands:wide` and one long call. After this it should record a
`bands` step with a time for every single band and every component — `b1Ms`,
`b2Ms`, … and `p1Ms` — which is a measurement we have never once been able to
take, because the builds rich enough to be interesting were the ones being
refused.

---

## 2026-09-11 — why the two Saltmarsh builds failed

You sent the kayak brief twice. Both failed, for two completely different
reasons, and neither of them was the splitting work.

### The first one: the AI asked for a file that isn't there

It wrote `import { SafeImage } from "@/components/SafeImage"`. The real file is
`@/components/ui/safe-image`. The bundler can't build a page that imports a file
that doesn't exist, so the whole site came out as the placeholder.

I went looking for why it guessed, and the answer is embarrassing in a useful
way: **our own instructions never tell it where that file is.** They order it to
use `<SafeImage>` on every picture — the rule names it fifteen times and gives
its full signature — and not once say the path. Every other component gets its
path from the menu of components the design step picked, but this one is
mandatory for every site and may not be on that menu at all.

Two things nobody could see it coming with:

- the rule was silent about the path;
- both of our import checkers only look at paths inside the `ui/` folder, so a
  path one folder up was invisible to both of them. I ran the real checker over
  that exact import to be sure: it caught an unrelated mistake and said nothing
  about the file that doesn't exist.

**What I changed.** The rule now names the path. And rather than just *reporting*
a bad path — a report doesn't stop the bundler refusing — the builder now
**fixes** it: if the import names a component that only one kit file exports, it
rewrites the path to that file. Free, before anything compiles, no model call.
2,385 of the kit's 2,412 component names belong to exactly one file, so that
covers nearly everything. Where it can't be sure — an unknown name, a name two
files both export, or names from two different files in one line — it refuses to
guess and reports instead, because a wrong guess would compile and render the
wrong thing, which is worse than a failed build.

I also measured it against every real page we have — 324 generated pages and the
whole 3,412-file kit — and it changes none of them and complains about none of
them. That's the bar here: a checker that cries wolf on correct code teaches the
model away from something that works.

### The second one: it was treated as an edit, not a build

The second attempt recorded `bands:revise` — the splitting was switched off
because the system thought you were editing an existing site.

Here's why. **A build claims its name at the start, not at the end.** The first
attempt claimed `saltmarsh-kayak-co` and then died. The claim stayed. When you
sent the same brief again, the design step naturally picked the same name, the
system looked it up, found a site under your account with that name, and decided
this must be a revision of it. Revisions don't split.

You said it plainly and you're right: typing in that box should be a fresh build
no matter what, unless you pick a site from the list. That's a separate fix and
it's on the list now.

### The money

This is the one I'd want to know about. Both builds charged and neither was
refunded: 9 credits on the first, 10 on the second, 275 left from 298. The
second one told you on screen *"you weren't charged"* while taking 10. The
design step ran and was paid for both times; the page never landed, so the page
charge never happened — but the deposit and the settle stand, and nothing
reversed them.

Also on the list, and I'd put it above the other two.

### What still hasn't been tested

The queue. The first build did run eight agents at once and every number lines
up — 7 bands plus 1 component, all eight answered, times that add up exactly —
but eight fits in eight, so nothing had to wait in line. Proving the queue needs
a design that asks for nine or more pieces.

---

## 2026-09-11 — a failed build no longer charges for the half that ran

The "you weren't charged" message was a **string literal**. It sat in the error
card with no answer from the server anywhere near it, so it said the same thing
whatever had happened — including over your build that had just taken 10
credits.

That was the smaller half.

### The money

The platform already had a rule for this and it was only being applied to half
the bill. Every build failure is classed as either **the model's fault** (the
page it wrote doesn't compile) or **ours** (the bundler, the container, the
collector giving up, or anything nobody has thought about yet). The rule's own
note in the code is blunt about why it leans our way: *"the cost of being wrong
the other way is billing somebody for our own rollout, which is the exact trust
problem this rule exists to prevent."*

Both of your failed builds were ours by that rule — one died in the bundler, one
timed out waiting.

The problem is **when** the money is taken. A build pays twice: once for the
design, once for writing the pages. The rule was asked before the pages charge —
which is why neither build has a pages charge on it — and the design charge is
taken earlier, before any of that runs. Every refund on that route sits in the
early refusals, above the design call. So once a build had actually started,
nothing could give the design money back, ever.

Now it can. A build that ends with no site, at a stage that's ours, reverses what
it took. A build that fails because the model wrote a page that doesn't compile
still pays — that one isn't ours, and the code already said so.

The collector — the part that picks a build up after the fact — needed the same
thing, and it's the one that took your 10 credits. It's a separate run with no
memory of what was charged, so it reverses by the build's own reference and lets
the ledger decide how much is left. Both of its endings do it now.

### The sentence

The card reads the answer instead of asserting one. Three outcomes:

- we know nothing was charged → it says so;
- we know something was → it says how much;
- we never got an answer to read → **it says nothing about money at all**, and
  your balance at the top is the honest place to look.

That last one matters more than it sounds. Guessing "you weren't charged" when
we don't know is the same false claim in a quieter voice. And a refund we tried
to make and couldn't now beats a zero — that's the one case where saying
"nothing was charged" would be worst.

### One thing I got wrong while writing it

My first version of the refund told "there was nothing to give back" apart from
"the ledger didn't answer" by looking at the wrong field — and both cases report
the same value there, so a dead ledger would have been silently read as "nothing
owed". Caught by the guard, and the test now pins it.

### What this doesn't do

It doesn't give you back the 19 credits from today. Those two builds are done
and reversing them is a deliberate action on the existing records — your call,
not something I'd do on my own.

---

## 2026-09-11 — typing in the start box always makes a new site now

You said it plainly and you were right: that box means a new site, unless you
pick one from the list.

### Why it wasn't

A build **claims its name at the very start**, before it writes anything. So
when the first Saltmarsh build died, the name `saltmarsh-kayak-co` stayed
claimed. You typed the same brief again, the designer picked the same name from
the same brief, and the system found a site under your account with that name and
decided you must be editing it.

That's what `bands:revise` in the trace meant. And revisions don't split, so the
whole page went out in one call again — the build that most needed splitting
couldn't have it, purely because its own earlier attempt had failed.

### What it does now

If the **designer** picked the name (you typed a brief rather than naming a
site), and the chat you're in definitely owns no site yet, and the name turns out
to be one you already hold — it takes the next free one. `saltmarsh-kayak-co`
becomes `saltmarsh-kayak-co-2`. `fretwork-1` would become `fretwork-2`, not
`fretwork-1-2`.

Three things it deliberately won't do:

- **It won't move a name you chose yourself.** If you name a site, that's the
  name; if it's taken by you, that's a revision and always was.
- **It won't move off someone else's name.** That still tells you the name is
  taken and asks you to pick another, which is the honest answer.
- **It won't move on a maybe.** If the lookup can't tell whether your chat has a
  site, nothing changes — guessing wrong there would make a second paid site
  where a retry should have found the first.

### Half of this already worked

Worth saying: if your chat **does** already have a site, typing in it has been
returning that site rather than building a second one since 8 September. What was
missing was the other half — the case where the chat has no site but the *name*
collides.

### One correction to my own notes

I'd written that the chat↔site link lives in a column called `project_id`. It's
`chat_id`. Checked against the live database rather than the migration.

### Merged and live

Both of today's fixes went out together at 17:16Z. The deploy was green in three
minutes and the container really did roll — I read that off the deploy log
itself rather than guessing it from how long the step took. Wrangler uploaded
exactly one browser file, `chat.js`, which is the tightest confirmation that
nothing else in the front end moved.

The new code was serving by about 17:35Z.

The proof for the naming fix is one build: type the Saltmarsh brief into the
start box again. You've still got the name, so before today it would have
revised the empty placeholder; now it should make a brand new site called
`saltmarsh-kayak-co-2` and write its page in pieces.

---

## 2026-09-11 — the test build: three fixes proven in one go

You typed the Saltmarsh brief into a fresh chat and it worked. The site is live
at `saltmarsh-kayak-co-2` — 100 KB, the biggest page we've made, with the tide
chart really on it: three put-ins, a fortnight of rows.

### What it proved

**The start box makes a new site now.** You still held the old name, so
yesterday this same brief would have quietly revised the empty placeholder. It
made `-2` instead.

**The SafeImage fix held.** The first attempt died because a band imported a file
that doesn't exist. This one compiled. Worth being honest about what that does
and doesn't tell us: we shipped two things — telling the model where the file
lives, and repairing a wrong path if it guesses. The model didn't guess this
time, so only the first one got exercised.

**And the queue really queued.** This is the one I'd been waiting for. The page
came out as nine pieces against a container that holds eight, so one had to wait
its turn — and the numbers say so plainly: the whole step took 381,833 ms while
the longest single piece took 347,868. The step took *longer than anything in
it*, which can only happen if something waited. It waited 33,965 ms, and the
piece that freed up the slot took 33,860. A tenth of a second apart.

### The honest bit

Splitting barely helped. Yesterday's build was the same nine-piece shape, refused
the split, and went out in one call at 407,694 ms. This one split and took
390,123 — about 3% faster.

The reason is simple: the tide chart alone took 348 seconds. All eight ordinary
bands were finished in under 147. You can't go faster than your slowest piece, so
giving it more slots wouldn't help — only making that one component faster would.

### What it cost

**31 credits**, 275 down to 244. Most expensive build we've measured. A rich page
with a hand-written component is the top of the range, not the middle.

### The chart

Drawn and committed, both steps on one axis, in the style you picked. I also kept
the script that draws it — `scripts/build-chart.mjs`. We had ten of these
drawings and no way to redraw any of them; the numbers were retyped by hand every
time, which is exactly the sort of thing that goes wrong quietly. The script now
refuses to draw at all unless the numbers on the page add up to the numbers in
the database.

Still on your desk: the 19 credits from the two failed builds.

---

## The code tab's headings are folders now (11 Sept)

You asked for it and it's done — each heading shows how many files are in it, and
you click one to open it. On a nine-piece site that's thirty-one rows down to
five until you go looking.

It opens with one folder already open: whichever one holds the file you're
looking at. The rest are shut with their counts showing, so nothing is hidden —
you can see there are 9 components and 17 shared files without opening either.

Screenshot is in the chat: as it opens, and after clicking Components.

### Your question about nesting

You're right and I haven't done it. Inside a folder the files are still flat, so
you see `-parts/` typed out nine times and `public/` four times where a folder
should be. It's half a hierarchy — we already strip `src/routes/` off your own
files, so the tree is inconsistent with itself.

Nesting them properly under the four headings is the change. Say go and I'll do
it; it's not started.

### Two things I found on the way

**The last push's tests were red on GitHub and green on my machine.** The cause
was real and it was ours: one of the "shared with every site" files —
`routeTree.gen.ts` — isn't in the repository at all. It's rebuilt by the site
builder every single time, and the copy we were showing customers was the one
sitting on my machine from an old build. Nobody would have noticed, because it
looks like a perfectly ordinary file. It's out of the list, and the check now
asks git whether a file is really in the repository rather than asking the disk,
so the next generated file can't sneak in the same way.

**And the tool that runs our safety sweeps couldn't be stopped.** I tried to kill
one to make room for the fix above and it just carried on. Measured it: the stop
signal was being swallowed entirely — the sweep would run to the end no matter
what, and the only way to stop it was the hard kill, which is exactly the thing
that leaves broken code sitting in the tree. Fixed, and there's a test for it
now; the tool had no tests at all before today, which is its own kind of problem
given it decides whether everything else is safe.

### Where this stands

Everything above is committed and pushed. The safety sweep on the folder change
hasn't finished — I stopped it twice, once for the red tests and once for your
nesting question — so it runs before this goes to main. Full test suite is green
at 6,024.

Still on your desk: the 19 credits from the two failed builds.

---

## And the folders are real folders now (11 Sept)

You drew `1. / 1.a. / 2.` and asked why it wasn't that. No good reason — it is
now.

The four headings stay on top, and inside each one the files sit in their actual
folders. Nothing prints a path as text any more.

One thing I did deliberately: a run of folders that each hold only one thing gets
joined into a single row — you see `src/routes/-parts` rather than `src`, then
`routes`, then `-parts`. Our paths are deep and narrow, so without that the Pages
group would be three rows of nothing with one file at the bottom. VS Code does
the same.

Every folder folds and every folder tells you how many files are under it,
counting the whole thing below — so `src` says 12 even though it holds mostly
other folders.

Screenshot in the chat: how it opens, and opened up.

### Two things I got wrong and caught by looking

The first version drew every file flush against the left edge, ignoring the
folder it was in — two lines of styling fighting each other, and the wrong one
won. The second drew every folder's arrow pointing shut even while it was open.
Neither would have been caught by a test; I only saw them because I looked at the
picture. Both fixed, and both now have a test.

Worth saying because it's the same lesson as the rest of today: the instrument
has to be checked against the thing.

### Where this stands

Committed and pushed. The safety sweep hasn't run on this yet — it's written and
ready, 47 checks — and it runs before any of this goes to main. Tests are green
at 6,025. The earlier red tests on GitHub are fixed and that run came back green.

Still on your desk: the 19 credits from the two failed builds.

---

## The sweep came back (11 Sept, late)

45 checks, all caught, both controls behaved. Two got through on the first pass
and both were gaps in my testing rather than faults in the code — I closed them
and re-ran to make sure they now fail.

The first is worth knowing about because it's a real bug we don't have: if a file
sits below one of those joined-up folder chains, the tree could draw its folder
shut — in the very panel showing that file. None of my test cases could see it,
because in our project the chain always swallows the whole path and there's
nothing after it. Added a case with a folder below the chain.

The second: the styling could have indented every row by the same fixed amount
and my check would still have passed, because I checked the rule existed rather
than that it read the depth. A tree where nothing looks like it's inside anything.

**And my first attempt to work out whether the first one mattered told me it
didn't.** A quoting slip meant the "broken" version I tested was actually the
normal code, so of course it agreed with itself. Same class of mistake the sweep
exists to catch, in the thing I was using to check the sweep. Redid it properly
and the answer flipped.

### On your question about the time

You were right that it was slow. It was re-running all 6,025 tests once per
check, 45 times. Only about 2,300 of those tests can even see the files being
changed — running just those takes 32 seconds instead of 90, so the whole thing
is 25 minutes rather than 70. Changed. The safety rule is that anything that
survives gets re-checked against the full set before I believe it, so narrowing
can only ever cost a false alarm, never a missed bug.

Everything is committed and pushed. Tests green at 6,025, GitHub green. Ready to
merge when you say.

Still on your desk: the 19 credits from the two failed builds.

---

## Merged, and CLAUDE.md pruned (12 Sept)

Main is at `5cfd4e58`. The deploy runs on the merge; `worker.js` and four builder
modules moved, so the container rolls and the usual 15-20 minute wait applies
before firing anything that needs the new code.

### The cleanup

CLAUDE.md was **7,883 lines** and is **3,933** — about 3,950 gone.

Same call as the last two times, done slightly differently. Before, whole entries
were cut. This time the forty-odd dated entries between "The published site" and
"Editing a site" were **compressed** instead: every one of them described work
that's already shipped and live, so I kept what still governs — the flag names
and what they default to, the two limits, the measured numbers, the rule that
came out of each fix — and threw away the story of how each one got there. They
now sit in four sections rather than forty:

- **The code explorer** — the file tree, what's shown and what isn't
- **The two splits** — design and page, the flags, how they're shaped
- **The instruments** — what each build records and how to read it
- **Rules from recent fixes** — the start box, charging, the removal verb, and so on

Five new traps went into the traps list rather than staying as stories.

One rule I added to the header: **when an entry is compressed rather than cut,
keep the numbers.** The timings and the arithmetic are the one part of a finished
entry that stays useful — they're what the next decision gets made from, and
re-measuring one costs a real build.

All of it is still in git if anything is ever needed back.

Tests green at 6,025.

Still on your desk: the 19 credits from the two failed builds.

---

### Reading the deploy after the merge (2026-09-12)

Checked both pushes landed properly. They did, but I got one thing wrong in a
commit message and want it written down rather than left sitting there.

**Everything is green.** Tests passed on all three pushes (runs 2450, 2451,
2452). The code merge deployed in 3m13s and everything came up fine.

**The thing I got wrong.** The last two commits each end with "nothing rolls" —
meaning the build container doesn't need restarting, so you don't have to wait
before making a site. That's true of those two commits on their own. It's wrong
about the push, because the three commits underneath them changed files the
container is built from. The container *did* restart, at 23:58:22, so the usual
15–20 minute wait did apply.

Nothing went wrong because of it — nobody built a site in that window. But if
someone had read that commit and fired a build straight after, they'd have got
the old code and no warning. So the correction is in CLAUDE.md now, with the
rule: **the restart question is about the whole push, never about the last
commit in it.** There are exactly two honest ways to ask — compare against what
main had before you pushed, or read the deploy log afterwards.

**One other thing worth knowing, now written down.** A push that only changes
notes and docs doesn't deploy at all — it produces no run whatsoever, by design,
so nothing is wasted. I spent a few minutes hunting for a "missing" deploy
before finding that out. It's in CLAUDE.md now so nobody repeats it.

Still on your desk: the 19 credits from the two failed builds.

---

### The code tab shows the whole project root now (2026-09-12)

You held up Lovable's file list beside ours. Theirs had twelve files at the top
level; ours had four.

**The eight missing ones were already there.** They're in our template, tracked,
and have been all along — the list that decides what the code tab shows just
named the four our build reads and skipped the rest. So nothing was generated
for this and nothing new is stored. What a customer now sees: the readme, the
notes for AI tools, the linter and formatter settings, the ignore file, and the
lock file.

**The lock file is the one that matters.** `package.json` says "React 19"; the
lock file says React 19.0.2 and four hundred others at exact versions. Without
it, someone installing your site's code next month gets whatever is newest and
it may not run. With it, the download is a project you can actually start.

It's the big one — 311 KB — and the whole set goes to the browser each time the
Code tab opens. Compressed, which is what really travels, the whole thing went
from 61 KB to 127 KB. About 66 KB more per open. Fine.

**And I added a check so this can't happen again.** It reads the real project
root and fails if any file there isn't being shown. A file added next month
shows up because it exists, rather than because somebody remembered.

**One thing for you to decide.** Showing the root means every customer can now
open `package.json`, and the first line reads:

    "name": "isibi-lovable-clone"

That's the old name from before the rename, and it calls the product a clone of
a competitor. Nothing I changed caused it — showing the root is just what made
it visible. Renaming it touches the lock file too and it's your brand, so I left
it alone. Two smaller ones I also left: `AGENTS.md` opens with "generated by
isibi", and there's an error-reporting hook that sends messages to a listener
that doesn't exist anywhere in our code.

Tests green at 6,026. Sweep 10 of 10.

## The name is gofarther-site now (12 Sept)

You said change it, so it's changed. `package.json` now reads:

    "name": "gofarther-site"

**The lock file was half the job, not a side effect.** npm refuses to install a
project whose lock file disagrees with `package.json` about the name, and the
name is in the lock file twice. All three had to move together, or the container
that builds every site would have stopped building at the install step. I ran
npm's own check against the renamed pair before going further and it resolved
the whole dependency tree clean, which it can't do if the names disagree.

The shared bundle went from 489,115 bytes to 489,100 — fifteen bytes, which is
exactly the new name being five characters shorter, three times over. Nothing
else moved.

**Two smaller ones are still there and are yours whenever you want them.**
`AGENTS.md` — the file we show next to the readme, written for other AI tools —
opens with "This project was generated by isibi". One line. And the error hook
that sends messages to a listener nothing in our code is listening for, which is
inherited from where the template came from and does nothing either way. Neither
is a name anything reads, so neither can break a build.

Tests green at 6,027. Sweep 7 of 7, run from a clean baseline.

## Both of the leftovers, and one of them was a real bug (12 Sept)

You said fix, so both of the things I'd named are done — and the second turned
out to be worse than I described it.

**The easy one.** `AGENTS.md` — the file we show next to the readme, written for
other AI tools — opened "This project was generated by isibi". It says Go
Farther now, with a link. I also added it to the check that scans for the old
name, because it wasn't on that list: the list named the readme by hand back when
the code tab only showed four files, and nothing noticed when we started showing
the whole root. It reads the real list now, so the next file we add is covered
because it exists. Proven by putting the old line back and watching it fail.

**The one I got wrong.** I told you the error hook "sends messages to a listener
that doesn't exist anywhere in our code" and left it as harmless. The listener
really was missing — but it isn't a dead feature, it's a broken one.

Every site we build watches itself for crashes. When a page breaks, it tells
three people: the visitor's browser console, our own error endpoint, and the
workspace preview panel. The first two work. The third was talking to nobody.

**And the half that worked is the half nobody would test.** There are two
previews: the draft one (before a site is published) and the real one (the
published site in a frame). The draft preview has its own crash reporter that we
inject, and that one always worked. The published site uses its own — and that's
the one the panel wasn't listening to. So a live site could throw an error in
front of you and the panel would show a blank page with no warning badge, while
the draft version of the same site reported it fine.

Now it listens. A crash on your published site puts the error in the panel with
the page it happened on, same as a draft crash always did, and the Fix with AI
button picks it up.

**One thing I deliberately did not rename.** The message these sites send is
labelled with the old brand. Every site already published has that label baked
into its code and can't be changed without republishing it, so renaming it would
make all of them go quiet. It's on the do-not-rename list now. While I was there
I found another one that should have been on that list and wasn't — an animation
name that's baked into published sites the same way.

Tests green at 6,035. Sweep 15 of 15, from a clean baseline.

## The file tree reads like an editor now (12 Sept)

You held Lovable's explorer up next to ours and said do it. Two of the four gaps
are closed — the two that were cheap. The other two are real features and I have
not started them.

**Every file has its own icon.** Before this, every single row drew the same
little chevron pair, so a readme, a lock file, a stylesheet and a page all looked
identical and the panel read as a list of filenames rather than a project. Now
markdown gets a page, JSON gets braces, the lock file gets a padlock, a
stylesheet gets a droplet, and the dotted config files get sliders.

Small thing worth knowing: I drew the config icon as a cog first and it turned
into a smudge at that size — eight teeth in thirteen pixels is an asterisk. The
sliders stay legible.

**The list is in alphabetical order.** It used to come out in whatever order our
own code happened to list the files in, so finding one file among twenty-five
meant reading all of them. Folders first, then files A–Z, with the dotted ones at
the top — same as any editor.

**One decision I reversed, and you should know I did.** Our file list has a note
in it saying "never alphabetical", because the order it uses is the order you'd
read a project in if you were reading the whole thing start to finish. That's the
right order for reading and the wrong one for finding, and finding is what this
panel is for. The list itself is untouched — it still decides what goes into the
download — only what the tree shows.

**Still not done, both from your screenshot:** they have a search box, and a
little menu on each row. Those are features rather than tweaks, so I stopped.
They also show one flat root where we show four headings — that one's a
deliberate difference of ours, not a gap, but say the word if you want it flat.

Tests green at 6,039. Sweep 15 of 15 — one survived the first pass and it was my
test's fault, not the code's: I'd fed it the one input where the right answer and
the lazy answer happen to agree. Fixed the input, and it dies.

## The search box (12 Sept)

You asked for the search box from their screenshot, so it's in — at the top of
the file tree, and it searches **inside** your files as well as their names.

That second half is the part worth knowing. Your whole project is already in the
browser the moment the Code tab opens — that's what the Download button zips — so
searching the actual code costs nothing extra and never goes near the server.
Type `booking` and you get every file with that word in it, not only the ones
with it in the filename.

**Each result says why it's there.** A file that matched inside gets the number
of times the word appears, on the right of the row, lined up with the folder
counts. A file with no number matched its name, which you can already read.

**Under the box it says what it's showing** — "5 of 28 files". Without that, a
filtered tree looks exactly like a normal tree, so if you forgot you'd typed
something you'd read missing files as missing files.

**Nothing matching says so**, in a sentence with your own word in it, rather than
leaving an empty column.

**Two ways to clear it**: the × in the box, or Escape while you're typing in it.
Both put the tree straight back — including whichever folders you had open before
you searched, because searching never touches them. And whatever file you had
open stays open the whole time, even while it's filtered out of the list.

One thing I was careful about: typing redraws the tree and nothing else. If it
redrew the whole panel you'd lose the cursor after the first letter, and the file
you were reading would jump back to its first line on every keystroke.

Measured: about 1.1 milliseconds a keystroke to search all 25 shared files
(489,130 bytes), whatever you type. The hit count stops at 99 and shows "99+", so
a one-letter search doesn't sit there counting forty thousand matches in the lock
file.

**Still not done from your screenshot:** the little menu on each row. And their
one flat root against our four headings — still a deliberate difference of ours,
say the word if you want it flat.

Tests green at 6,048. Sweep 39 of 39 — three survived the first pass and all
three were my tests' fault rather than the code's: two of them only go wrong
on a redraw of the whole panel, which typing never does, and the third was a
missing icon that nothing was checking for. All three are checked now.

## The vibrating panel — my bug, from an hour earlier (12 Sept)

You clicked around the Code tab and the screen shook. That was mine, from the
search box an hour before, and it's fixed.

**What was happening.** The file tree column is meant to be a fixed 210 pixels
wide. It wasn't any more — it was growing to fit whatever the longest visible row
was. So opening a folder with a long name widened the column, and closing it
narrowed it back, and the code pane beside it slid sideways every time. Click,
click, click: shudder.

**Why I broke it.** To give the search box a fixed spot at the top, I moved the
scrolling from the column itself down to the list of rows inside it. That looked
like a tidy little change. What I didn't know was that the scrolling was the only
thing holding the column's width — a browser rule says a column that scrolls is
allowed to be narrower than its contents, and one that doesn't isn't. Take the
scrolling away and the width goes with it.

So the width was never really set by the "210 pixels" line. It was being held up
by something next to it that nobody had written down, and when I moved that
thing, the width quietly went too. One line puts it back and says so in plain
words this time, so the next person moving things around can see what's load
bearing.

**How I know it's fixed rather than think it is.** I ran the real panel in a real
browser through seven different open/closed states and measured the column each
time. Before the search box: 193 pixels, every time. After: 209 or 224 depending
on which folders were open — there's the shake. With the fix: constant again.

Worth saying: nothing in our tests could have caught this. Checking the page's
structure doesn't see it, and neither does checking that the rule is written —
the rule *was* written, it just wasn't doing what it looked like it was doing.
The only instrument that sees it is actually rendering the thing and measuring,
which is what found it and what proves it.

Tests green at 6,048. Sweep 3 of 3, including the bug itself as one of them.

## The row menu, and the READ ONLY pill is gone (12 Sept)

Both asks, in one change. That's the last thing from Lovable's screenshot.

**The pill is deleted.** No argument — you asked, it's gone. Worth saying that
nothing about the panel changed, only the label: you still can't type in a file
there, you change your site by asking in the chat. The bar is just the filename
and Download now.

**Each file row has a `...` when you point at it.** Three things in it:

- **Copy path** — the whole path, because that's what you'd paste into an import.
- **Copy contents** — the whole file. The pane on the right only draws the first
  120,000 characters so a huge file can't lock the tab; the copy doesn't do that,
  or it'd be quietly handing you a file with the end missing.
- **Download** — the row you're pointing at, without having to open it first.
  (The bar's Download is for the file that's already open.)

**Folders don't get one,** deliberately. Everything in that menu is about one
file's contents, and a folder hasn't got any — so a `...` there would open a menu
where nothing works. That's the dead-control thing we keep finding; a menu is the
easiest place in the app to hide one.

**Nothing in it writes.** Rename, delete, new file are what you'd find in an
editor's row menu and each would be a button promising something this panel
can't do.

**One thing the screenshot caught that no test would have.** My first version
painted the menu with the same background the model picker on the media side
uses. That colour is almost fully transparent — it works over there because the
chrome behind it is dark, and over here on the cream it's basically a window: you
could read the file tree straight through the menu, both sets of words on top of
each other. Rendering it is the only way to see that, and it's why every UI change
here gets a picture before it gets merged.

Tests green at 6,053. Sweep 24 of 24 — three survived the first pass and all
three were my tests', not the code's. One of them was the same mistake I made an
hour earlier: I checked for the text "st-code-bar" to prove the toolbar was still
there, and "st-code-bar2" contains "st-code-bar", so the check would have passed
over a toolbar that had been renamed away. Both are fixed and written down.

## The click twitch — the second half of the vibration (12 Sept)

You told me twice that the screen vibrates. The first time I found a real cause
and fixed it, and it was only half the story: that one was about the column
changing WIDTH when you folded a directory, so it only happened on folds. This
one happens on **every click, including clicking a file**, and it is a different
thing entirely.

**What it was.** The panel carries a little entrance animation — it slides up 8px
and fades in when you switch to Code, Preview, More or Data. That was written back
when the panel was only ever built when you switched tabs. But clicking a file in
the tree rebuilt the whole panel to show the new file, so the browser treated it
as the panel arriving again and played the entrance. Every single click: the whole
thing drops 8px, goes invisible, and slides back, over about a fifth of a second.

I measured it in a real browser rather than guessing — 8.00px of travel on a
click, and 0.00px when only the part that changed is redrawn. The picture I sent
is the same frame, 60 milliseconds after the same click, both ways.

**What it is now.** Clicking a file redraws the file and the tree; folding a
directory redraws the tree. Nothing rebuilds the panel any more except opening
the tab, which is what the animation was for. Two things you'd have noticed
eventually came out in the wash:

- **The tree keeps its place.** It used to jump back to the top on every click,
  so reading anything near the bottom of the list meant scrolling down again each
  time.
- **The file you're reading keeps its place when you fold a directory.** It used
  to jump back to line 1, for a click that had nothing to do with the file.

**Why the first fix didn't catch it.** Both are "the screen moves when I click",
and the width one was real, measurable and enough to explain what you'd shown me,
so I stopped there. The honest lesson is that a still screenshot can't see this
class of thing at all — the defect only exists for a fifth of a second — so
"looks right" was never evidence either way.

Tests green at 6,061. Sweep 18 of 18, both controls surviving. Five survived the
first pass: one was a mutation that changed nothing at all (I proved that rather
than assuming it, and replaced it), and the other four were real holes in my own
tests — clicking the file that's already open, clicking a row for a file that no
longer exists, the 120,000-character clip, and whether the code shown is escaped.
All four have a test now.

## The third cause: Windows scrollbars (12 Sept)

You told me it still vibrates, and then you told me you're on Windows. That
second thing is what I'd been missing.

**The tree has a scrollbar, and folding a group is exactly what makes it come and
go.** I measured that part earlier and walked straight past it: at a normal panel
height, opening PAGES makes the list long enough to scroll, folding it makes it
short enough to fit, opening `shared/src` makes it scroll again. Every fold click
flips it.

**On Windows a scrollbar is a solid bar that takes about 17px of real width out of
the column.** The tree column is 210px. So every time that bar appears or
disappears, every file name in the list jumps sideways by 8% of the column — on
every click. On a Mac the scrollbar floats on top and takes no width, which is why
it never showed up in any of my tests.

The fix is one line on each of the two scrolling boxes: reserve the scrollbar's
lane permanently, so it's there whether or not the bar is. Measured: the lane is
now a constant width in every fold state instead of coming and going, and nothing
moves.

**Why it took three goes.** Each of the three causes was real and each one only
explained part of what you were seeing:

1. the column growing to fit its widest row — fold clicks only;
2. the panel replaying its entrance animation — every click, both kinds;
3. this one — every fold, but only on Windows and Linux.

The first two are fixed and measured. The third I could not see at all from here:
my headless browser uses floating scrollbars and reports zero width whether the
column is steady or jumping, so it read "nothing moves" in exactly the case that
moves. I tried to force it and couldn't. The thing that actually cracked it was
you saying "Windows".

Tests green at 6,061. Sweep 4 of 4, control survived. **You confirmed it: "it
works now".** Third time, and the thing that fixed it was you telling me which
computer you were on — worth remembering for the next one of these.

## The project you download can actually build now (12 Sept)

You held up Lovable's file tree beside ours and said we don't have all of it.
Looking into it found something worse than a missing list.

**The Download was broken and nobody had noticed.** The Code tab showed 28 files
and the Download zipped the same 28 — and one of those 28, `src/routes/__root.tsx`,
starts by importing a component that wasn't in the zip. So the "project" we handed
a customer couldn't build: its very first import pointed at a file that wasn't
there. That's a promise broken regardless of what anyone else does.

**Why the components were missing, and why the fix isn't what I first said.** I
told you we'd list all 3,394 kit files and fetch each one when clicked. Then I
measured the thing that actually matters: **a site doesn't have 3,394 files, it
has the ones its pages import.** Across 100 real generated sites that's **9 to 53
files** — about the same as the 25 shared files we already send, and about the
same as Lovable's whole components folder. So there's nothing to lazy-load. The
files just travel with the rest of the code.

The container works out which ones at publish time — it's the only place that has
both the site's pages and the kit on disk at once — and they're stored with the
site, listed under their own heading **"Design system"**, and zipped with
everything else.

**They get their own heading rather than going in "Shared with every site"** on
purpose: which of these a site has depends on what its pages use, so two of your
sites will show different numbers. Folded in with the platform files, that
heading would be lying about half its rows.

**Existing sites see no change until they next publish.** The list comes back
empty, the tab shows what it showed before, no error and nothing to explain, and
it fills in the next time that site publishes anything.

Two smaller things from the same comparison, for the record: their `src/assets`
has 7 photos because their builder writes generated images into the project —
ours is genuinely empty, since every picture is still a placeholder (no generated
photo has ever been bought). And their root has `bun.lock`/`bunfig.toml` where
ours has `package-lock.json`; that's just a different package manager, not a gap.

Tests green, sweep 25 of 25 with both controls surviving. One thing I got wrong
on the way: six mutants survived the first pass and three of them were the same
mistake — I checked that a line *existed* rather than that it *runs*, so wrapping
it in `if (false)` slipped straight past. That's a trap already written down here
and I walked into it anyway; the checks read each call's own condition now.

**One test was already broken before I started, and it held this up.** The big
build test — the slow one that compiles a real site, the only thing here that
proves a build actually works — came back with one failure. It wasn't mine. A
check written on the 10th posts nine jobs at once and expects the container to
refuse them; on the 11th we deliberately raised that limit so nine would be
allowed, and nobody re-ran this test. So it has been sitting red for a day,
reporting the builder as broken when the builder was doing exactly what we
changed it to do. The check asks the code what the limit is now instead of
having its own copy of the number. Everything else in that run passed.

Both runs green after the fix: the big build test **382 of 382**, and the normal
test suite **6,077**. And a smaller thing I found while in there — our mutation
tool has a way of marking one test as the "control" (a change that must NOT
break anything, which proves the run is honest). Four recent batches named theirs
in the label only, not the way the tool reads it, so the tool's own check on
itself was switched off in exactly the runs that reported it working. Fixed and
all four re-run: 18, 4, 25 and 7, every control surviving.

## Why the start screen looked wrecked on your laptop (12 Sept)

Those six grey slabs are the **phone tiles** — the little handset drawn beside
each site. They're meant to be about 100px wide. On your laptop each one had
blown up to roughly 506px wide and the full height of the window, so six of them
sat almost edge to edge across the whole screen, overlapping. The grey is only
10% ink, which is why they got darker towards the right: that's two and three of
them stacked on top of each other.

**Your screenshot is what solved it.** I measured the slabs off it — about 520px
wide, full window tall — and the phone's shape is 0.46 wide for every 1 tall.
0.46 × your window height comes to 506. That arithmetic closing is what told me
the tile was being sized off the *window* instead of off its own little box.

Why one Mac and not the other: the tile's height is worked out from its shape
rather than typed in, and browsers disagree about that particular calculation.
Yours gets it right on the desktop and wrong on the laptop. I could not
reproduce it here at all — I rendered the screen at five different widths and it
was correct to within a pixel every time, which is the same thing that happened
with the scrollbar two days ago: my browser can't see your browser's bug.

**So I fixed the class rather than the guess.** The tile now clips, so a phone
that computes wrong physically cannot paint outside its own column on any
browser, and the phone is capped in both directions so the sizing isn't wrong in
the first place. I kept both on purpose — one catches the paint, the other the
layout. I checked it changes nothing where things already work: rendered before
and after at five widths, every box identical.

**Reload the laptop and it should be right.** Nothing for you to do beyond that.

Tests 6,078 green. Sweep 6 of 6, control survived.

**You confirmed it: "it works now".** One report, one fix, no second round —
which is the difference your screenshot made. The slabs' size in that picture was
the measurement that told me what was wrong; without it I'd have been guessing at
browser versions.

One habit worth keeping from this: my own check that the fix had reached the live
site nearly told me "done" while the deploy was still running, because the text I
searched for also appears in an unrelated rule further up the file. Two other
reads in the same command disagreed with it, which is the only reason I noticed.
Written down so the next one doesn't get through.

## Deleting the video side — stage 1 of 4 done (12 Sept)

You asked me to keep the website builder and carefully delete everything else:
the video/image/voice maker, and — when I asked — the game builder too, plus the
customers' stored media. Fal stays for the site builder's photographs, and the
memberships and credits stay exactly as they are.

I'm doing it in four stages so nothing goes out half-finished:

1. **the game builder** — done, this commit;
2. video, image and voice generation and the composer;
3. everything around it — the gallery, saving, importing, the director, the
   Media Agent, the avatar;
4. the sweep — leftover styling, tests, workflows, secrets, docs.

**The stored media is a separate step, after all four are merged and working**,
and I'll ask you once more before I touch it. It's the only part that can't be
undone.

### Stage 1 also found two live bugs

Neither was caused by the deletion — deleting is just what made them visible.

**The Gallery has been broken.** Two settings it needs (which filter, which
sort order) are declared in a *demo copy* of the app's main file and were never
in the one we actually serve. The gallery reads them before anything can set
them, so opening Gallery threw an error and left the panel blank. Fixed. It's
on the list to be deleted in stage 3 anyway, but it works in the meantime.

**And the deletion nearly shipped one of its own.** The game code defined a
small function the *saved-assets sync* was still calling. Nothing here could
see it: the file passes every check we have, because in JavaScript a name that
doesn't exist only fails at the moment that line runs — and in the browser that
would have been every signed-in customer, every sync.

So I built a check for that whole class. It reads every script the page loads
the way a browser would, and reports any name that's used but defined nowhere.
It found both of the above, and — this is the part I care about — **nothing
else**: 23 things came up on the first run, 21 of which were my own list being
incomplete, and the two real ones are the two above. It's now part of the test
suite, so the next deletion can't do this quietly.

**One more guard, on the deploy itself.** Removing the game's container needed a
specific line in the config, and Cloudflare refuses the *entire deploy* if it's
missing. That rule was written in a comment and checked by nothing — it had come
up twice and both times someone had to remember it. There's a test for it now,
and I proved it catches the mistake before shipping it.

Tests 6,072 green. Sweep 13 of 13, both controls survived.

**Both CI runs came back green on that commit.** The normal test suite in 2m26s,
and the big build test — the one that compiles a real site in a real container,
which is the only thing here that proves a site can still be built — **382 of
382, 0 failed**, 17m36s.

That last number is worth one line: it had been sitting in my notes as "382"
from a local run three days ago, nothing had re-checked it, and when something
finally did it came back **381 and one red** — a stale hardcoded number inside
the test itself, not a real fault. This is the first run where the count and the
colour agree and neither of them is from my machine. So the site builder still
builds, with the game code gone.

The normal suite went 6,078 → 6,072, which is what a deletion looks like: the
game's own tests came out (fourteen) and the two new guards went in (eight).
