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

## Open — waiting on you

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


**0. The edit step is finished except `slug`; ADDON is untouched.**
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

**Live bugs**

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
Actions). It has long since been spent; the balance today is 418 (topped up 100 + 400 on
2026-08-30 to fund the `ashgrove-1` builds; runs 80, 82 and 83 spent 80 of it).
