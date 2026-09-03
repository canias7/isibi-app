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

**Live bugs**

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

## 2026-09-01 — Stage 1 deployed: async edits behind a canary gate

**Live now, changing nothing.** `main` is at the async edit path with its flag
unset and its allowlist empty. Both have to say yes for an edit to queue, so
today every edit is still synchronous.

**Step 7 — the paths still work.**

- `edit smoke`: **all green** against the deployed Worker. Price change routes
  to `data`, colour to `look`, a new page to `addon`, a question is answered
  rather than built. It reused its fixture site, so it cost less than the ~50
  credits budgeted.
- `build smoke`: 8 passed, 6 failed — and **every failure already failed on
  2026-08-30**, two days before this work, on the last run that was not
  skipped. One that failed then passes now (the two briefs are routed
  differently). Zero regressions. The build itself completed and generated a
  real page; the harness failures are about it expecting a different response
  SHAPE than the resume path returns.

**Step 8 — the sub probe still has no ceiling, but it got further than ever.**
For the first time the far end worked: the preflight confirmed on poll 1, the
container held a 1000ms reply. Then a 240s hold came back **500 at 233.8s**
with the container not reporting how long it waited — so the probe refuses a
verdict, correctly. **Do not read 233.8s as the ceiling**: the build path
already runs container calls from a queue consumer and run 6 measured a 261s
container slice, longer than this. The difference is likely that `/slowreply`
sends zero bytes for the whole hold.

**Two mistakes of mine, both worth keeping.**

1. The first Stage 1 deploy **shipped nothing**: `|| ''` is not a fallback,
   because wrangler-action treats an empty value exactly like a missing
   secret. `test/deploy-secrets.test.mjs` had checked that a `||` EXISTS and
   never that the value after it was non-empty — the rule's syntax, not its
   effect. Both fixed; the sentinel is `-`, which `readCanaryList` drops.
2. A commit **explaining** that the previous commit had bought a build spelled
   the smoke opt-in marker while doing so, and armed itself. A second
   `build smoke` ran. The owner's balance was untouched (it funds a throwaway
   by minting) but provider calls and a Neon project were spent. The rule is
   now in CLAUDE.md beside its twin.

## 2026-09-01 — Stage 2: the paid canary spent nothing, and that was my bug

**You ran it with `spend: yes` and nothing was charged.** Balance 309 before,
309 after. `fretwork-1` still serves the same build it did this morning
(`x-site-build: mtholxpx-rg59n3`). Nothing to undo.

**What actually happened.** The POST queued in 1.0s, the consumer picked it up,
replayed it, and the poll came back with a terminal answer 7.9 seconds later:
`{"escalate":true,"reason":"layer","cost":0}`. So the plumbing did its whole
job — and the edit never ran.

**Why.** The edit route does not decide which of its nine rungs to use.
`/api/site/route` does that, and the chatbox posts the answer on. My canary
skipped that call and posted an empty layer, so the route matched no rung and
fell through. **It looked exactly like a clean pass**: a real job id, a real
claim, a real terminal answer, no errors anywhere. That is the part worth
remembering — a green harness proves the path it took, not the path I meant.

**Fixed two ways, because the second is the one that matters.** The canary now
routes first, exactly as the chatbox does, and carries every field the router
decides. And it **refuses to spend** if the router names no layer, rather than
posting blind: the danger here is not failing, it is passing.

**And it found a real defect in the product, one hop over.** On the queued path
an escalate was being rendered as **"✅ Done."** — the customer told their change
was made, the preview bumped to show an unchanged site, and the full rewrite
that is meant to catch exactly this never ran. The synchronous path has always
handled that correctly; the queued one applied every answer as an outcome. Both
now go through one decision, and it is in the file a test can actually drive.

**And underneath THAT was the one that mattered most: the chatbox never
finished watching a queued edit at all.** When a job ends, the poll hands back
the edit's own reply — the same object the old synchronous path returned. That
object has no job-status field in it, because it never needed one, so the
browser read every finished edit as "still running" and kept polling, for ever,
behind a spinner, on an edit that had already published and charged. So had you
made a real edit to `fretwork-1` from the chatbox today, the site would have
changed correctly and the screen would have sat there spinning.

That is now three things fixed in one place, and they were all the same thing:
the queued path had its own private copy of "what to do with the reply", and the
copy had drifted three ways — the spinner, the false tick, and a queued edit
that deleted a page leaving it in the picker (with the row undo neither
remembered nor cleared). Both paths read one reply through one function now.

Two smaller things fixed with it: a sideways hop was reusing the first
submission's retry key, which (now that jobs are real rows) made the cheaper
second attempt a no-op; and one existing guard turned out to pass whatever the
code said, so it never could have caught that.

**Checks**: suite 4,712 → **4,736, green**. Three mutation sweeps, control
survived each time — 9/13, then 14/17, then the three survivors re-run and all
three caught. The canary harness has guards of its own now, which it did not
before; that is why its bug reached a paid run.

**Nothing has been re-run.** The allowlist is still `fretwork-1` only and the
flag is still off for everyone else. Say the word and I'll dispatch the paid
canary again on the fixed harness — it will be one real edit, ~1 credit at the
`look` rung.

## 2026-09-01 — Stage 2 done: the paid canary published

**It worked, and you can see it above in the screenshots.** One real edit on
`fretwork-1` — "make the main call-to-action button background a deeper green"
— went through the queue and landed: the closing band's button is now a deep
green (`#062806`). Balance 309 → **305**: 2 for the routing call, 2 for the edit.

**Your six checks, with the evidence.**

1. **POST returned quickly** — 202 in **1.5s**, after an 8.2s routing call.
2. **Work continued on its own** — the canary only ever polled after that. The
   job ran 414s in the consumer, lease `c_flcbznx7`, heartbeat kept it alive.
3. **Charged exactly once** — one ledger row (`…#1`, reserve, −2), `billing:
   finalized`. Finalize itself moves no money; the metered reserve is the bill.
4. **The expected build published** — the site now serves
   `x-site-build: mtj1iv41-9cmwjw`; the job row recorded the same id.
5. **Identities agree** — job row, the page's header, and the header on the
   probe path (`/__build.txt`, which is what `confirmSiteWorker` reads) all say
   `mtj1iv41-9cmwjw`. I cannot read R2 from here, so the sidecar and dist copies
   are taken on trust from the publish order, not observed.
6. **Nothing left claimed or leased**; nothing in `needs_review`.
7. **The frontend** — the canary is not the chatbox, so this run says nothing
   about it. The fix from earlier today is covered by the suite, not by a live
   click. A real edit from the chatbox on `fretwork-1` is the remaining proof.

**A bonus you did not order: the correction round proved itself live.** The
first attempt wrote a rule for `header [data-slot="button"]`, which matches
nothing (the header button is a link). Verification caught it — zero matches —
the correction re-targeted the closing band, and the second publish shipped.
Which is also why it took seven minutes: the correction call alone was 134s on
Grok.

**Two things I noticed, filed as task cards rather than fixed.** The render
check opens `-parts/` files as if they were pages and reports two "did not load
(404)" findings on every publish of a site with a part — a false alarm, the
router is right. And a corrected edit is stored as a *failed* trace, so the
phase statistics will count the correction feature's wins as losses.

**Still only `fretwork-1` on the allowlist.** General traffic is not on. The
honest next step before widening is one edit from the actual chatbox on that
site, so the frontend fix is proven the same way the backend now is.

## 2026-09-01 — Sweep run two: one lane, one real bug, nothing spent

The re-run went out with `all` rather than the fourteen, so its first lane was
`css` — already done, the heading already dark red. The server answered
honestly: *"Your site already looks like that — nothing to change."* My harness
called that a lie because nothing published, and stopped. Harness fault, fixed:
an "already so" answer is now its own verdict and the sweep carries on.

**But the row underneath was a real defect in the queued path, mine.** That
honest answer had no terminal state: finalize refuses a job that did not
publish, the refund branch thought it had shipped, and the job sat until the
lost-job sweeper declared it lost and refunded it — two and a half minutes for
a twenty-two-second answer, and the chatbox would have spun the whole time.
Fixed in the database and the consumer; the old function stays as a wrapper so
nothing breaks between the migration and the deploy. Billing matches what the
synchronous path always did: the model calls were real, the reserve stands. If
you would rather an "already so" answer cost nothing, say so — that is a policy
change, not a fix.

Balance 299 → 299. `fretwork-1` unchanged since run one.

**Two more things from fixing that, both worth knowing.** The committed database
check caught a regression in my own fix within minutes: I had rewritten the
finalize function from the migration folder's copy, and that copy had drifted
from what was actually live — four of the day's earlier migrations were never
written to the folder. The folder now carries a snapshot of every live function
read straight out of the database, and the rule is written down: read the live
definition, never the folder, before redefining anything. And the refund
function now refuses a finished job outright, since "finished" can now mean
"answered, nothing to publish" rather than only "published".

All 48 database checks pass, rolled back. Nothing on the site or the ledger
changed while any of this was verified.

## 2026-09-02 — The lane sweep: nineteen lanes on fretwork-1, through the queue

You said *"do all of them lane by lane and lets see how it behaves"*. Done,
bar the two you have to name. Five sweeps, one real ask per lane, and the
verdict on each read off the live site after the publish — never off the
reply. Screenshots of every edit are in `docs/edits/` on the branch, one row
per edit, in order.

| Lane | Ask | What the site did | Cost |
|---|---|---|---|
| css | deeper green button; dark red heading | both, second one with a correction round | 2, 1 |
| brand | rename | Crookes Guitar School, in the title and the head | 1 |
| favicon | a green G | served, decodes | 1 |
| lang | Welsh | `lang="cy"`, `dir` right | 1 |
| langs | French and Spanish | header switch, `/fr` and `/es` routes | 1 |
| theme | noir | greyscale, black buttons; the red heading survives on top | 1 |
| description | new meta description | in the head | 1 |
| wordmark | a drawn mark | served as `/logo.svg` in the brand link (it reads "DI:" — not good, but the lane works) | 1 |
| qr | a code that dials the number | `/qr.svg` served and decodes to `tel:01144960123` — **and nothing on the page shows it** | 1 |
| three | a spinning 3D pick | a WebGL canvas under the hero, real three.js | 6 |
| shape | price list above the steps | moved | 3 |
| components | an FAQ accordion | three questions, `faq` slot | 5 |
| purpose | group lessons rather than one-to-one | hero, prices and closing band rewritten toward groups | 7 |
| backend | members-only prices | honest refusal: no database on this site | 0 |
| pages | add a pricing page | read the verb `add`, pointed at the addon route (the queue does not run it) | 0 |
| behavior | button opens the dialler | **broken**: the router sends it to the nav rung, which says `no-menu` | 0, refunded |
| action | rename the top button | **broken**: the nav rung wrote source that does not parse | 0, refunded |
| images | swap the main photo | **broken**: `no-slots` — the picture matcher wants a literal alt text | 0, refunded |
| tsx | a small custom component | **broken**: the new part is never sent to the container, so the build cannot load it | 0, refunded |
| slug | — | **held** until you name it: the old address redirects for ever | — |
| kind | — | **held** until you name it: a ~45-credit rebuild that replaces the site | — |

**Twelve lanes proven on the site, one half-proven, two correct refusals,
four broken, two waiting on you.** Every broken one is refunded in the
ledger and filed as a task card with the fix spelled out. The product told
no lies: every time the harness shouted "LIE" it was the harness — judging
before the edge had switched over, expecting an inline svg where the mark is
a file, counting og:locale tags — and each of those is now a test.

**Money.** Canary and all five sweeps together: 309 → 274, thirty-five
credits. Sweep five alone, eleven lanes in twenty-six minutes: 296 → 274.
The page-rung lanes are the dear ones (3–7 each); the look lanes are 1.

**Two things I found on the way that are not lanes.** The render check opens
the site's generated component (`/-parts/chord-diagram`) as if it were a page,
gets a 404, and files it as a serious finding on every publish — filed. And
every push to `main` rolls the container, not only one that touches
`builder/`: two lanes died under my own pushes on sweep one. Now written down.

**What needs you.** The harness fixes are on the branch, not on `main`; the
last three sweeps were dispatched from `main` and ran the old harness, which
is why they called two working lanes lies. Merge the branch (it rolls the
container; wait fifteen to twenty minutes before the next run) or dispatch
from the branch. And say the word if you want `slug` or `kind` run.

## 2026-09-02 — The whole sweep again by accident, then text and logo

Three runs tonight, and the record of each.

**Run 8 was the entire lane sweep a second time** — the harness box on the
form was left at its default. You said wait for it, so it ran: nineteen
lanes in nineteen minutes, 16 credits. It turned out to be a measurement
worth having. Every look lane answered *"your site already looks like
that"* for one credit and published nothing; the page-rung lanes escalated
no-change for nothing. Asking twice costs almost nothing and changes
nothing, which is how it should be. And `tsx` passed this time (the six
string names under the hero): the model kept the component inside the page
instead of writing a separate file the edit path never sends. One for two,
and the task card for it stands.

**Run 9 died on a space.** The harness box came through as `gap ` and the
workflow compared the raw text — the confirm word's own trap from yesterday,
one box over. Nothing spent. The workflow now reads the word trimmed and
lowercased, and the guard drives that line under bash for real.

**Run 10 was the gap sweep, text and logo, as you asked.**

- **text works.** "Change the words *Get your first lesson free* to *Your
  first lesson is free*" went through the real intent router, which picked
  the text rung; all four places changed and the site published in two and a
  half minutes. Three credits: two for routing, one for the rung.
- **logo does not, and the reason is new.** The upload landed and the
  container compiled the site — 23 files, status 200 — and then the queue's
  own publish gate refused it. That gate lets a job publish only when it has
  been billed or exempted, and the logo lane makes no model call, so nothing
  ever billed it. Worse, the customer was told *"That didn't compile"*. The
  same gate will refuse any free rung sent through the queue: taking a page
  away and moving a page are also model-free. On a site that is not on the
  allowlist the identical edit works, because the synchronous path has no
  gate. Filed as a task card with the fix: mark the job exempt when its rung
  spent nothing, rather than loosening the gate.

Balance 274 → 255 across the three runs. Screenshots of every edit are in
`docs/edits/`, rows 10 to 12.

**Not run tonight, written and ready** in the same harness: cancel, move and
move-back, remove, data, rules, backend — the last six on the lido cafe.
Name them in the lanes box with `harness: gap` whenever you want them.

## 2026-09-02 — Why the logo did not publish, and the fix

You asked why. The short version: the edit worked and the queue's own
bookkeeping refused to publish it.

Every queued edit is charged by a reserve placed the moment a rung reports
model usage. The last check before anything is written — a database function
called `edit_may_publish` — lets a job through only if it has been billed or
explicitly exempted. The logo lane makes no model call, so nothing ever
reserved for it, its billing stayed at "none", and the gate answered
"unbilled". The container had already compiled the site (23 files, status
200). Worse, the lane's error handler was written for a failed compile, so
you were told "That didn't compile". The real reason was in the reply's
detail field, not in the sentence.

**Fixed tonight, as a state rather than a looser gate.** A new database
function, `edit_exempt`, marks a job exempt — for the consumer that holds its
lease, and only while the job has not reserved; a job that has reserved is
refused, so a wrong count can never make paid work free. The Worker counts
successful reserves on the job and, just before the gate, exempts a job whose
rungs reserved nothing. The refusal message now names the gate's reason
instead of blaming the compile. The committed database check gained a
section of seven checks for it, driven against the live database and rolled
back; its first draft filed the test job on a site the previous section had
just put under review, which is its own small lesson recorded in CLAUDE.md.

The same fix covers taking a page away and moving a page, which are also
model-free. It needs a deploy to reach the Worker, then one more run of
`logo` through the gap harness to prove it on the site.

**And the pictures you asked for.** A single page, `fretwork-1, edit by
edit`, with every edit as a before-and-after pair, the changes a capture
cannot show (tab icon, wordmark, QR, description, languages), and the lanes
that produced no picture and why. Sent to you as a file; the captures
themselves are in `docs/edits/`, now with row 00, the site as built.

## 2026-09-02 — The four broken lanes, fixed in the tree

You asked to work on the broken ones. Each turned out to be one small thing.

- **action.** The button writer read a header whose button is computed — a
  label chosen by a ternary, which is how fretwork-1's was written — as "no
  button yet", then sliced the file at an offset that slot does not have.
  `slice(0, undefined)` is the whole file, so the page came back as itself,
  the attribute, then itself again. Found by driving the writer over all 332
  generated pages and parsing every result with TypeScript: one page broke,
  the same shape as fretwork-1. A computed button is now replaced in place.
  The corpus parse is kept as a guard.
- **behavior.** The first ask, "press the button, open the dialler", read as
  the button's link and went to the same nav rung. The two lanes' hints now
  say which is which, and the sweep asks about the FAQ instead.
- **images.** The picture scanner only saw `<SafeImage>` and `<img>`; every
  hero on the platform carries its photo as component props
  (`image`, `imageAlt`), so "change the main photo" found no slot. Those
  props are slots now. Measured over the corpus: 18 more slots, none lost.
- **tsx.** The page rung's model wrote the new component in `parts`, as the
  tool asks, and the rung threw it away: only pages were sent, so the
  container never got the file. The parts now travel with the page, are
  merged by name over the stored ones, sent, and stored after the publish.
  The page rung also now tells the model what the site already has — its
  components, its QR, its 3D scene — which it never did.
- **qr.** Made but never shown. When the qr lane runs on a page that does
  not reference the code, one page step follows it with a fixed ask to place
  the figure using the generated file.
- **And one more found while checking the tsx chain end to end.** Two asks in
  one message run two rungs and one publish, and the publish collects from
  the LAST rung. "Add a component and change the button" would have handed
  the publish the button rung's pages and the build's old component list,
  and the new page would not have compiled. The component list now carries
  across rungs the way a rename already did.

The hint change for behavior/action is guarded on the property, not the
words — each hint names the other lane — because every hint is still your
placeholder to reword.

Mutation sweep, measured after the run: 23 mutants, 23 killed, the
comment-only control survived, sidecars restored byte-identical. The
mutants are each fix cut back to the failure the sweep measured live —
the button keyed on the wrong null again, the component slots gone, the
parts dropped at the rung, at the collector and at the spine, the QR step
gone or ungated, the hint cross-reference removed, the harness hop
ungated — and every one was caught by a test that names the lane.

## 2026-09-02 — Run 11: the seventh sweep, four lanes in, two real answers

You dispatched at 12:32, eight minutes after the push, with the budget box
left at 80. Balance 255 → 247. What the SITE says, lane by lane:

- **wordmark — failed, nothing charged, on Grok's speed.** The lane call
  ran past the four minutes we allow a quick call and we gave up. Logo
  unchanged. Same lane passed in sweep four. Not the fix; retry.
- **behavior — routed to its own lane for the first time.** That is the
  hint fix working. The lane then said the site already does it: the ask
  was "close the other FAQ questions when one opens" and the kit's
  accordion already does exactly that. Honest, 1 credit.
- **qr — PROVEN on the site (screenshot 14).** The look step said "already
  so" (the code has been stored since sweep five), and the new page step
  behind it published 25 files to place a 120px figure under the contact
  band with its caption. The harness read the site before the edge served
  the new build and printed "already so" — its mistake, fixed below.
- **action — half right, and the half that was wrong matters (screenshot
  15).** The header button now says "Book a free lesson" on the computed
  button that doubled the file twice before. But its link went from
  `tel:+441144960123` to `/`: the page's one working control became a link
  to itself, on a request about wording. The harness called it a lie for
  the wrong reason (its selector) and was right anyway. The run stopped
  there, so tsx, kind and slug did not run.

**Why the link was lost, and the fix.** The rung shows the model the current
button only when BOTH halves are plain strings; this header's words are
computed, so the model was told "(there is no button)", wrote a new one,
and had to invent the link. The slot now carries each half as it stands
(`knownAction`), and the digest says "its words are worked out on the page
-> tel:+441144960123" and tells the model to keep the half they did not
ask about. The tool already says "return the whole button, both halves,
even when only one is changing"; it just never had the link to copy.

**Three harness misreads, all fixed.** The wait for the edge and the
"already so" verdict were keyed on `moved` alone — the nav rung reports
`changed`, the qr page step only `files` — so both lanes were judged off a
stale read. And the action check read a `site-link` slot the new anchor
no longer carried. Now: any of `moved`, `changed` or `files` is a claimed
publish; already-so needs none of them AND an unmoved build; the action
check reads the header's last non-language anchor by position and requires
the words changed AND the link kept.

**Found in passing, filed as task 44:** the render check opens
`/-parts/chord-diagram` as a route on every publish (two 404 findings per
component). Harmless today; `routeOf` should skip a `-` segment the way it
skips `_`.

**Your Grok balance.** You said $0.27 before the run. The four lanes used
roughly six cents. tsx is a page rewrite (~15c) and kind a rebuild (35c or
more), so the next run probably runs dry at kind; when xAI refuses, the
lane fails with a `send` error and our side refunds it, and I can tell
that apart from a fix failure in the stored reply.

Mutation sweep for this round, measured after the run: 10 mutants, 10
killed, the comment-only control survived. Two needed a second pass: one
mutant's anchor was a substring of another's and never applied, and the
object-form slot's `known` survived because the guard only drove the JSX
form — an object-form guard was added and both were re-run and killed.

## 2026-09-02 — Add goes to the addon step; tsx stays an edit

Your call: "add will always go in addon", with the carve-out that the
page's code always exists, so changing a component is an edit. The line is
at the thing now, not the page: if what the customer names exists, EDIT
changes it; if it does not, ADDON makes it. Before today the router said the
opposite in as many words — "add a testimonials section" was an edit because
the home page existed.

What it took, in four places:

- **The router's wording** says the new rule, with the tsx carve-out.
- **A wall at the edit route's picker.** If the picker names `qr` or `three`
  and the site has none stored, the edit path refuses to create one and
  hands the message to the addon step. It sits at the picker rather than
  inside the look step because `three` goes to the page rung and never runs
  the look step — my first draft would have let "add a 3D scene" through.
- **The browser now has a way to the addon step from an edit.** It did not:
  an edit that gave up either hopped sideways to another cheap rung or fell
  straight to the ~25-credit full revise. "Add a pricing page" from an edit
  has been landing on the revise all along.
- **The addon step kept nothing it designed.** It ran the designer, read the
  tables and the pages off the answer, and threw the rest away — so "add a
  QR code" designed a code and dropped it. It keeps the look now, tells the
  page call the bindings, stores just before publishing and puts the old
  look back if the publish fails. And it refused any site without a
  database, which is most of them: a first build makes none, so every "add
  a QR code" on the platform was climbing to a full rebuild. It works
  without one now; a table designed for such a site is refused by name.

The lane sweep's asks changed to match: `qr`, `three`, `tsx` and
`components` now edit what fretwork-1 already has (the code's caption, the
pick's speed, the chord-diagram component, the accordion swapped for a
list), because "Add a QR code…" is an addon ask and the harness posts
straight to the edit route. The addon step itself has not run live on a
site without a database yet; a gap-harness case for it would cost about 25
credits and is yours to call.

Mutation sweep, measured after the run: 23 mutants, 23 killed, the
comment-only control survived. Two survived the first pass — a mutant can
leave the store and the revert calls in place and gate them off — so the
guard now reads each call's own condition, and both were re-run and
killed. One guard was found passing on a comment (the addon test's
escalation list still matched "no-backend" in the comment explaining its
removal); comments are blanked there now and the absence is asserted.

## 2026-09-02 — Run 12: every lane in order, and the Grok balance ran dry

You dispatched at 14:38 with the lanes box on `all`, so it walked all
nineteen in order rather than the five. Balance 247 → 238. What the site
says:

- **qr — PROVEN as an edit** (screenshot 16). The caption changed to "Scan
  to ring and book"; the code itself unchanged, same number, same bytes.
- **css, brand, description, favicon, lang, langs, behavior** — "already
  looks like that", honest: sweeps one to five set all of these. 1–2 each.
- **theme** — no-change escalate, already noir. 0.
- **wordmark** — Grok timed out at the 4-minute cap again, nothing charged.
  Task 47.
- **action** — "That's already what the button says and where it goes."
  The words are already "Book a free lesson" from run 11, so the rung had
  nothing to do; the link is still `/` and this ask did not mention it.
  The next ask has to name the link.
- **images** — the hero is a slot now, which is the fix; then "one picture
  couldn't be made": the fal balance is empty, so no photograph can be
  bought. Refunded.
- **backend** — honest refusal, no database. 0.
- **tsx — a real gap, fixed.** The ask changed a word inside the
  chord-diagram component; the model rewrote the PART and handed the page
  back unchanged, and the rung read the unchanged page as "no change". A
  new or differing part counts as a change now.
- **three — my wall misfired, fixed.** The 3D pick was drawn by the page
  rung in sweep five, and that rung stores no design field, so the stored
  look said "no scene" while the page had a canvas; the wall sent an EDIT
  of it to the addon step. The wall now reads the page too: a `SITE_QR`
  binding or a fiber canvas in the source is proof the thing exists.
- **shape, components, purpose, pages — your Grok credits ran out here.**
  Every call from `shape` on came back 403 from xAI, exactly where the
  arithmetic said it would. Nothing charged. And every one of those told
  the customer "the builder is busy — try again in a moment", which is the
  one thing a refused key does not get better with: a 401, 402 or 403 is
  now classed as our account (on us, never the customer's to retry), and
  xAI's wording about credits is read as billing.

**Not run:** kind and slug (never under `all`). **Still to prove live:**
tsx and three as edits, action with the link named, the addon step on a
database-less site. All of that needs the Grok top-up first.

The harness's `action` ask now names the link as well as the words —
"Change the button at the top to say 'Book a free lesson' and make it ring
0114 496 0123" — and passes only with both on the header's button, in any
of the ways a model writes a UK number. That is the ask that puts the dial
link back after run 11 sent it to `/`.

Next run, after the top-up: lanes `action,tsx,three,kind,slug`, budget
120, from `main`, at least 20 minutes after the last push.

## 2026-09-02 — Run 13: action proven, then the harness tripped on the edge again

You topped up Grok and ran at 15:22. **`action` is proven on the site**
(screenshot 17): "Book a free lesson", ringing `tel:0114 496 0123` — the
link run 11 lost is back, on one ask that named both halves. 1 credit,
238 → 237.

Then the harness called it a lie and stopped, ten seconds after the
publish, with the build id unmoved and the button still pointing at `/`.
That was a stale read, not the site: the wait for the edge breaks when a
probe's build id differs from the old one, and a probe that comes back
WITHOUT the header (a failed fetch, or an edge mid-swap) has an empty id,
which is never equal to the old one. So one bad probe ended the wait at
once and the snapshot read the old build. Third time the edge has fooled
the harness; this one is fixed at both ends — the break needs a real id
that differs, and the snapshot that follows is re-taken until it shows
that same id (bounded, thirty seconds). The site was right every time.

`tsx`, `three`, `kind`, `slug` did not run. Re-dispatch with lanes
`tsx,three,kind,slug` once the container has rolled from this push.

## 2026-09-02 — Run 14: tsx and three proven, then my own check tripped

You ran at 15:53. 237 → 225, read from the ledger: 8 for tsx, 4 for three.

- **tsx — PROVEN as an edit of the page's own code** (screenshot 18). The
  word "Fingering" now sits above every one of the eight chord diagrams.
  The page file came back byte-identical; only the component changed —
  the exact case run 12 called "no change", fixed and now seen live. 8
  credits.
- **three — PUBLISHED, and the harness got it wrong.** "Make the pick
  spin half as fast" went through as a component-only change too: 25
  files, the canvas kept, the page file unchanged. My check for this lane
  demanded a changed PAGE whenever the reply listed one, and a
  component-only publish lists none, so it called a real publish a lie
  and stopped the run. Fourth false alarm from the harness today, and this
  one was mine to the letter: I had just taught the product that a
  changed component is a change and not the harness. Fixed — any of the
  three signs of a publish counts. Motion is not observable headless, so
  there is no picture; the build id and the file count are the evidence.
  4 credits.

`kind` and `slug` did not run. Re-dispatch with lanes `kind,slug` once
the container has rolled from this push.

None of this is proven on the site yet; that is the run you are about to
dispatch: wordmark, behavior, qr, action, tsx, then kind and slug, the two
you named. In the workflow form: harness `lane`, lanes
`wordmark,behavior,qr,action,tsx,kind,slug`, site `fretwork-1`, confirm
`spend`, budget `120`. Dispatch it from the branch until main carries it,
and only after the container has rolled (15–20 minutes after the push).
`kind` is a real rebuild (~11–45 credits on its own) and `slug` renames the
site to `crookes-guitar` for good — the old address 301s to it after that.

## 2026-09-02 — Run 16: kind proven; slug never ran, and the reason is a full stop

You ran at 16:52 with lanes `kind,slug.` — a full stop after the last
name. The harness dropped the name it did not know without a word, ran
`kind` alone, and the log read as a complete pass. Fixed in this commit:
a name that is not a lane now refuses before sign-in, naming it and the
real lanes, and `slug.` reads as `slug`. Both harnesses, because the
workflow feeds one input box to both.

**kind — PROVEN LIVE** (screenshot 20). "Turn this into a booking tool
rather than a shopfront": the lane escalated to a rebuild in ten seconds
for 0, the harness followed it to the build route and watched for 18
minutes, and the site came back as a tool — "Book a guitar lesson", a
week strip, a month calendar, a booking form, opening hours, then the
eight chords and the QR. **17 credits, 225 → 208**: the revise price,
not the first-build one, because the design anchored on what was stored.
The build provisioned fretwork-1's first database (two tables) and seeded
it, which is why the calendar shows booked days.

What the rebuild kept and what it dropped is the useful reading:
- Kept, from the stored design: the name, the description, the favicon,
  the three languages, the QR with its caption, and the header logo — the
  striped test picture the gap sweep uploaded in run 10, which could not
  publish then and rode out on this build. Swap it when you like; the
  logo lane is free.
- Gone with the page: the 3D pick (the page rung drew it and stores no
  design field), "Fingering" (the chord-diagram part was rewritten), the
  header button's words and dial link (the action lane writes source),
  the hero and its prose (a tool has no hero). A rebuild keeps what the
  DESIGN remembers and redraws everything the page rungs did. That is by
  construction, not a defect — but a customer who spent five edits on
  the page and then asks for a rebuild loses the five.
- One thing to look at: the kit's availability calendar prints its own
  legend — "the night beginning on that date… the whole property" —
  holiday-let copy on a guitar diary. The model picked the component and
  did not override the text. Backlogged.

**slug — NOT RUN.** `crookes-guitar` still answers 404, no alias row.
Dispatch it alone: lanes `slug`, budget `20`, from `main` once the
container has rolled from this push (15–20 minutes). It renames the site
for good — the old address 301s to it after that.

Sweep for the chooser change: 9 mutants, 9 killed, comment-only control
survived — after a first round where two survived, because my tests only
put the punctuation at the end of the whole list and the whole-string
trim was catching it before the per-name one could. A stray dot before a
comma is a case now.

## 2026-09-02 — Run 17: the rename landed, the job was lost, and the head never moved

You ran `slug` at 17:38, twelve minutes after my push — inside the
container's roll. Read off the site and the tables, not the log:

- **The addresses are right.** `crookes-guitar.gofarther.app` answers 200,
  `fretwork-1.gofarther.app` 301s to it (subpaths too), and the alias rows
  landed old-then-new at 17:39:49. Your site is at the new name.
- **The queued job was lost.** The consumer's heartbeat stopped at 17:40:37
  — inside the roll — the lease ran out at 17:42:07, and the sweeper
  refunded the 1 credit at 17:44:17. Balance still 208. The harness
  printed `failed` and the run went GREEN, which it must not; `failed` is
  red now. What killed the consumer is task 52: the Worker's own log is
  the only witness, and I cannot press "container logs" from here (403) —
  it is free, one click, and 3 hours of log:
  https://github.com/canias7/isibi-app/actions/workflows/container-logs.yml
- **The canonical at the new address still said the old one** — and that
  was NOT the lost publish. Two hops were missing at once: the publish
  spine wrote the head's origin from the STORAGE slug (so even a finished
  republish would have baked `fretwork-1` back in, and so would your next
  colour change), and the rename's whole plan for moving the head was that
  republish. `publicNameFor` existed and nothing used it. The guard for
  this read the code and passed; the harness read both addresses and never
  the head. Fixed both ways: one reader of the public address at every
  writer of the canonical, and the rename patches the head's one key in R2
  the moment the alias is current — no container, nothing to lose. A new
  guard drives the route and reads the write.
- **The live head gets fixed for free** once this deploy is on: a platform
  republish row for fretwork-1 (no model call, no credits) rebakes the
  canonical from the public name. I will do that and check it.

The harness follows the 301 once at the start now (otherwise it reads your
renamed site as "does not answer 200"), keeps `site: fretwork-1` — the
storage name the API keys on — and flips the rename target, so a second
`slug` run renames back to `fretwork-1` and proves the lane the whole way,
head included. Same form values, lanes `slug`, budget `20`, after the
container has rolled from the push.

Sweep for this change: 13 mutants, 13 killed, comment-only control survived
— after a first pass in which the control never applied (I had anchored it
as a line comment on a block comment), which is a sweep with no control.
Suite 4,805 green.

## 2026-09-02 — Run 18: the way back was refused as "taken"

You ran `slug` again at 14:22, before I had said go, and the harness did
what it now should: it saw the site at crookes-guitar and asked for the
way back to fretwork-1. The lane refused in 13 seconds — "That name is
already taken by another site." The site check asked "is fretwork-1 a
site?", and it is: this one. The alias check beside it already knew the
row for that name belongs to this site; only the site check needed
telling. Fixed: a site's own storage name is never taken from it, driven
in the guard (the rows demote the alias and promote the storage name,
the head follows the site back, nothing compiles). 1 credit reserved and
refunded, balance 208. The run went red, which is right — `failed` is
red now, and this is the first run to show it.

Once this deploy is on, the same `slug` run renames the site back and
checks the head as well as the addresses. A rename no longer touches the
container, so no waiting on the roll: about four minutes after the push.

**What your "container logs" click showed about run 17's lost job.** At
17:39:51 a container instance booted; at 17:39:56 the consumer sent it
the compile (the republish the old rename lane made); the heartbeat
carried on for 41 seconds; and then nothing from our code was logged
again until the sweeper's own line at 17:44:18 ("lost 1, refunded 1").
No error, no exception, no last words — the isolate died silently
mid-call. The log the script prints carries only messages; the outcome
Cloudflare records for a killed invocation (CPU limit, memory, cancel)
is a separate field it did not print. It does now — beside each line, and
tallied at the end — and my push aimed the reader at that exact window,
so no press was needed. **The answer: Cloudflare cancelled it.** The
queue invocation carrying the job (started 13:39:35, the moment the job
was filed) ended with outcome `canceled` at 13:40:49 after 75 seconds of
wall time and a tenth of a second of CPU; the container call it had in
flight ended `canceled` at 61 seconds. Not our code, not a CPU or memory
limit, no exception — the platform evicted the isolate, nine minutes
after the 13:31 deploy from my push. A cancellation runs no catch and no
finally, which is why nothing refunded or finalized until the sweeper.
So the "wait 15–20 minutes after a push" rule covers running queued jobs
too, not just new container work. The rename no longer compiles, so that
lane cannot die this way again; any other lane's publish still can, and
whether a job that made no model call may be re-run after a cancel is
your call (retries are off because a redelivered edit re-buys its model
calls).

## 2026-09-02 — Run 19: the rename lane is proven end to end

You ran `slug` at 14:53 (a little inside the window I asked you to wait
out — it went fine). **Proven on the site**: the harness asked the way
back to `fretwork-1`, the lane renamed it in 16 seconds for 1 credit,
`fretwork-1.gofarther.app` answers 200 with its own canonical and og:url,
and `crookes-guitar.gofarther.app` redirects to it. No container touched.
Both held lanes, `kind` and `slug`, are now proven live; your site is
back at its original address. Balance 207.

The run still went red, and that was the harness — its fifth false alarm
today, with the product right every time. It read the old address twenty
seconds after the rename, when one edge was still serving the site there
instead of redirecting: the row it had cached before the rename lives
five minutes per isolate, and only the isolate that did the rename
forgets at once. Two minutes later the redirect was everywhere. So a
rename settles within five minutes across the platform — a fact worth
knowing, now written down — and the harness waits for both addresses up
to that lifetime before judging. If you want that lag shorter, the price
is a Supabase read per uncached request; your call.

What is left on this thread: the free republish only proves something
while the site is at an alias, so it is optional now — one more `slug`
run (to crookes-guitar) followed by a republish would show the publish
spine baking the alias into the head live; the driven guard already
proves it in the tree.

## 2026-09-02 — Forgetting an old address, built

You asked why there are two addresses after a rename and said you want
the old one gone. Built: on the address lane, "forget the old address
crookes-guitar" (or "drop the old name", "stop crookes-guitar working")
deletes that name. The old address stops answering — a plain 404, never
cached — and the name is free for anyone to claim. It is its own step,
never something a rename does by itself, because once somebody else takes
the name it cannot be undone. The lane refuses to forget the site's
current address ("give it a new address first"), refuses a name that was
never this site's, and is shown the site's old names so it can tell. A
forgotten storage name (the one the site was built under) also stops
answering; nobody else can build under it, because it is still the key
to your site's files. Our own `/s/<name>/` links now go to whatever the
site is called today, so they survive a forgotten name. Like a rename,
it settles everywhere within five minutes.

To run it on fretwork-1, which has `crookes-guitar` as its one old name:
lanes `forget`, same form otherwise, budget `20`. It costs about 1 credit
(the routing call and the address call, no compile). After it,
`crookes-guitar.gofarther.app` answers 404 and anyone could claim that
name — including you again, by renaming to it.

## 2026-09-02 — The addon step is its own path now

You said: "ok now that you have a big idea of what we want, lets start
building the addon part." Built, the same way the edit step was split on
the 29th, and for the same reason.

**What was wrong.** When a customer asked to add something — a page, a
booking form, a QR code — the addon ran the BUILD's designer: the whole
93,852-character tool that invents a business from nothing, pointed at a
site that already exists, with twenty-one of its twenty-four questions
about things the addition had no business touching. And it threw most of
the answer away: it kept the tables and the code/scene and dropped the
plan for the addition itself, so the step that writes the page got your
sentence and nothing else.

**What it is now** (`builder/site-add.mjs`, which borrows nothing from the
build):

1. A small picker reads the message and names WHAT is being added — one of
   six kinds: a **table** (something to store), a **page**, a **component**
   on a page it has (your call the same evening: "section is just adding a
   new component, so its a tsx step that adds components" — the kind names
   the component, from the kit or written for the site, and an answer that
   names none is refused), a **QR code**, a **3D scene**, a **photograph**.
2. One small designer per kind, in your words for ADDING to a site that
   exists: where it goes, what it is built from, what it leads with. Each has
   one property and nothing required, so a kind that cannot answer says
   nothing rather than inventing. The photograph is handed sideways to the
   picture step, which already places one.
3. The page call is told the addition — the file, the route, the bands top
   to bottom, the kit parts and their exact props — and returns only what is
   new or changed, as before.
4. One publish, as before.

**What it refuses, by name, instead of rebuilding your site**: a second QR
code or 3D scene on a site that has one ("ask me to change it instead" —
the same line the edit path draws from the other side, so the two never
bounce you between them); a table on a site with no database (before any
model call now); a page the site already has; a QR code with no real
destination. A photograph asked for beside a page is set aside and said,
so you ask for it on its own.

**What it shares with the build**: only shapes. The definition of a table —
its columns, who may read and write it, every guarantee — was lifted out of
the build's tool into a module both steps read, byte-for-byte what was on
the wire before, so there is one definition of a table on the platform and
not two that drift.

**What it costs on the wire**: about 1,900 characters of picker plus one
small tool — 1,300 for a scene, 1,600 for a code, 20,000 for a table,
~35,000 for a page or a section (the list of 2,112 kit parts is most of
that) — against 93,852 before. Every prompt in it is a placeholder for
yours.

**NOT proven live.** Nothing here has run on a real site. The `lane sweep`
workflow has a third harness for it: harness `addon`, lanes `all`, site
`fretwork-1`, budget `40`. It posts one ask per kind straight to the addon
route and reads the site after each. On fretwork-1, which has no database
and already carries a code and a scene: the **section** and the **page**
publish (a testimonials band on the home page; a pricing page, linked from
the menu, with screenshots of both), **table / qr / three** are driven to
their honest refusals, and **photo** hops to the picture step, which will
say it cannot buy a photograph while the image balance is empty. Two
publishes at Grok's addon prices — I would expect under 15 credits in all.
**Wait 15–20 minutes after the push before running it**: this change
touches `builder/`, so the container rolls, and the addon route compiles in
the container.

Mutation sweep, measured after the run: 19 mutants, 19 killed, the
comment-only control survived. Thirteen test files went red on lifting the
table definition out of the build's tool — each was reading it out of the
old place — and each now reads it where it lives and checks the tool still
binds it.

**And a red I found by reading CI after the push, which was not this
change.** The `unit tests` workflow has failed on every push to main today —
fifteen runs, from 12:25 to 20:20 UTC (I first wrote "four", having read
only the last page of runs) — because one guard written this morning (the one that drives the
button-writer over the whole page corpus and parses every result) needed a
copy of TypeScript that only exists where the kit is installed, and the CI
runner never installs the kit. Green here every time, red there every time,
and nobody looked. Fixed: TypeScript is declared at the root so the runner
has it, and the guard uses either copy. Proven by hiding the kit's copy and
running the guard on the root's.

**Your two rules for the addon, in.** (1) Universal: whatever is added keeps
the site's design system — same theme, stylesheet, typefaces, colours, shape
of page, kit parts and conventions; it slots in, nothing around it moves,
nothing about the look is re-decided. Said in one sentence to both models
that have to hold it: the one that designs the addition and the one that
writes the page. (2) No low limits while testing: a message may name every
kind it asks for, and pages, components and tables come back as lists — up
to 6 pages (the page writer keeps six), 12 components, 6 tables — with the
rule "as many as they asked for, not one more". An entry that cannot be
added (a page the site has, a form with nothing to send to) is left out and
named in the reply; the rest go in. Sweep for the two rules: 8 mutants, 8
killed, control survived.

**Section → component, the same evening.** Your correction — "section is
just adding a new component, so its a tsx step that adds components" —
is in: the kind is `component`, it names the component (from the kit, or
written for the site), and an answer that names none is refused rather
than handed to the page writer to invent. Sweep for the change: 6
mutants, 6 killed, control survived — one only after I added the guard it
showed was missing (the harness could have stopped checking that the new
words actually landed on the page and nothing would have noticed).

## 2026-09-03 — Run 21: the first live addon hit the wall, and the fork it needed

You ran the addon harness (`addon`, `component,page,qr,three,photo`, budget
80) at 01:25 UTC. It got one case in. "Add a testimonials section to the
home page" was posted to the addon route, and the platform reset the
connection at 257.6 seconds — the same ~273-second wall that made the edit
path queued on 09-01. Nothing was charged (207 → 207), the site did not
move, and the harness stopped on NO ANSWER, which is the honest verdict for
"the request died". The cause is not in the addon step. The route was still
running the addition on your connection, because the addon route never got
the queue fork the edit route got. An addition is a picker, a designer per
kind, a whole page call on Grok and a container compile — four to eight
minutes — so it can never fit under that wall, and no amount of tuning moves
the wall.

Fixed in the tree tonight, the edit route's own way: the addon route files a
job through the same queue and answers a receipt within a second; the
consumer replays the addition off your connection; the poll route hands back
the stored reply; the browser watches it through the same watcher with the
addon's own reader; the harness sends a retry key and watches the same way.
Same flag, same allowlist — still fretwork-1 only. The bill is one number,
reserved before the publish on a queued job and refunded if the publish does
not land, exactly as an edit's is. Mutation sweep, measured after the run:
21 mutants, 21 killed, the comment-only control survived. Not proven live:
the re-run of `harness: addon` (same inputs) is what proves it, once the
deploy carrying the fork has finished — and give it the usual 15–20 minutes
after the deploy, because every push rolls the container and a queued job
caught under the roll is evicted the way run 17's was.

One thing worth knowing before you fire it: the addition now takes the same
shape on your screen as a queued edit — a receipt at once, then the reply
when the job finishes, minutes later. The harness prints "queued …;
watching" and then the job's own answer.

## 2026-09-03 — Run 22: the queued addon is live, and my harness fell over

You ran it at 09:32 UTC. The first case, "add a testimonials section to
the home page with three short quotes from beginner students", got its
receipt in 2.9 seconds, and the addition ran off the connection exactly as
designed: the job reserved 12 credits just before the publish, published
at 09:38:23, and finalized — 5 minutes 36 seconds from the POST to the
live site, balance 207 → 195. The three quotes sit under the QR block in
the site's own cards (screenshot in the chat and at
`docs/edits/addon-run22-component.png`). That is the queued addon proven
end to end, on the first kind.

Then the harness died five seconds after printing "watching": the watch I
added sat outside `main` and read a name that only exists inside it, so
the first poll threw and the run went red while the job it had stopped
watching went on to publish. Nothing the checks read could see that; only
running the watch could, and nothing did. Fixed: the watch takes the token
as an argument, and a test now drives it with fake polls — the reply, a
404, a lost job, a watch that runs out. Sweep: 7 mutants, 7 killed,
control survived. The same lesson as the five edge false alarms: the
product was right, the instrument was not.

The other four cases never ran. When the deploy is on and the roll is
over, run it again with lanes `page,qr,three,photo` — not `component`,
which would add a second set of quotes to a page that has one now.

## 2026-09-03 — Run 23: the prices page is live, and the harness misread the sitemap

You ran `page,qr,three,photo` at 10:00 UTC. The page case went through the
queue cleanly: receipt in 2.9 seconds, 13 credits reserved just before the
publish, live at 10:08:01 — 6 minutes 39 seconds — balance 195 → 182. The
new page is real: `/prices`, "Lesson Prices" in the header and footer, a
heading, and the kit's price list reading the site's own `lessons` table —
the one the rebuild seeded — so it shows First lesson £0, Group of three
£18, One-to-one £30, Hour one-to-one £40 (screenshot in the chat and at
`docs/edits/addon-run23-page.png`). One thing for you to judge: the ask
named "a 30-minute lesson, an hour, and a block of five", and the page
kept that sentence as its subline but listed the site's own lessons rather
than inventing three prices. The data is the site's; the wording is the
ask's.

The harness called it a LIE, and it was wrong: it read the sitemap two
seconds after the publish, and the edge, which caches the sitemap
separately from the page, still served the old list — a minute later it
listed `/prices`. That is the seventh time the edge has fooled the harness
and the seventh time the product was right. Fixed: the harness now
re-reads the sitemap, bounded, until it lists every new route before it
judges. Sweep: 4 mutants, 4 killed, control survived.

Because it stopped on that verdict, `qr`, `three` and `photo` have still
not run. Once the deploy and the roll are done, run it again with lanes
`qr,three,photo`.

And a note on my own instrument, for the record: a mirror of the served
page in this sandbox showed the price list EMPTY, and for ten minutes that
read as a defect. The rows come through the site's own data path, which a
mirror cannot reach. I read them through that path and served them to the
mirror before believing the screenshot.
