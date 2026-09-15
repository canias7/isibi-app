# Agent builder — owner notes

Kept separate from `docs/owner-notes.md` at the repository root, which is the
log for everything else in this repo. Nothing in this file is about that, and
nothing in that file governs this.

---

## 2026-09-14 — Session start: what you said, and the one thing I read into it

You said this session is for building an **AI agent builder**, that it is
**mostly backend**, that it has **nothing to do with anything else in this
repo**, and not to mix it with `main` or with other sessions.

**Four setup questions, and your answers:** it lives in a folder in this repo on
this branch; it is a **framework / SDK** rather than a chat-to-agent product; it
runs on **Cloudflare Workers + Supabase + containers**; and it is
**multi-tenant from day one**.

**One of those pairs needed a reading, and I want it on the record because I
could be wrong.** "Framework/SDK" was offered as the option with *no* tenants,
and "customers from day one" was the multi-tenant one. I have taken them
together as: **build it as a library, but thread a tenant identity through
storage, quotas and tool permissions from the start**, so that when a product
gets built on top, isolation is not being retrofitted. That is the reading that
throws away the least work if I have it wrong — but say the word and I will
change it.

### Nothing here can reach the rest of the repo, and I measured it rather than hoping

A push to this branch runs the repo's existing CI, so "don't mix" had to be made
true rather than assumed. What I found:

- Its **unit suite runs on every push to any branch but `main`** — and it runs
  only the root `test/` folder. This product's tests cannot make it red.
- **Two of its checks scan the repository root** and would have swept up any new
  file I put there. They only look at `.mjs` files and do not look inside
  folders, so a new *folder* is invisible to them. Everything here lives in the
  folder for that reason.
- **I must never touch the root `package.json`** — it fires a 25-minute test
  harness, and it is also baked into the container image, so editing it would
  roll your live containers. This folder has its own.
- **Nothing here deploys.** The deploy only fires on a push to `main`, and I
  checked every line of the Dockerfile: it copies named files, never the whole
  folder, so this code cannot become part of a container image by accident.

### What is built

Four modules, all **dependency-free** — they have to run in a Worker, where
there is no `node_modules`, so everything from outside (the model call, the
clock) is handed in. That also means every branch can be tested instead of
waited on.

- **The bounds.** Steps, tool calls, how many tools at once, wall clock,
  per-call and per-tool ceilings, a token budget and a money budget. **Every one
  is enforced in code**, because a cap the model is only told about is not a cap.
- **The declarations.** What an agent is and what a tool is, each **refusing to
  load if a part is missing** rather than failing later somewhere else.
- **The fan-out.** Runs several tools at once, bounded, and **loses none of
  them** — one tool blowing up does not throw away the answers that worked.
- **The loop.** Calls the model, runs the tools it asks for, feeds the results
  back, and stops when it has an answer or when a bound runs out.

### Three decisions in there worth your eye

1. **A run always says WHY it stopped, by name** — "ran out of steps" and "ran
   out of money" are different sentences, because they need different fixes from
   you.
2. **A tool a tenant is not allowed is never even described to the model**, and
   the run record says which ones were held back. Describing a tool the tenant
   cannot use costs tokens and invites the model to plan around it and then
   fail; but hiding it *silently* means nobody can say why the agent could not
   do the thing. Both halves.
3. **A failed model call is not retried.** That is your money rule from the
   other product — *"we should not spend your credits for you"* — and it applies
   here for the same reason. You can always ask again.

### A correction, written down rather than quietly fixed

I got something wrong and the tests caught it. I had applied a rule — that a
caller may only ever *lower* a limit, never raise one — **without its reason.**
That rule earns its keep when every other number is worked out from the limit
when the code starts, because then a bigger number breaks all of them. Nothing
here works that way.

The cost of copying it: **nobody could ask for an unlimited run at all**, which
made a whole piece of the code unreachable from outside — and an unlimited run
is a real thing on your stack, since a container has no clock.

The fix separates two things that were sharing one name. **The agent's own
limits are code you wrote, so you can set them to anything.** A limit handed in
per-run — which could come from a customer or a request — **may only ever lower
them.** The untrusted party is the model and the tenant, not you.

### What is proven and what is not

**Proven:** **65 tests** over the four modules, all green. **34 deliberate
breakages, 34 caught, none that failed to apply**, and two do-nothing
controls that correctly survived. And the rest of the repo's suite still reads
**6,316 passing, 0 failing** with this folder in the tree — the same numbers as
before it existed, so "it can't touch anything else" is measured rather than
reasoned.

**NOT proven:** none of this has run against a real model, a real Worker, a real
container, or Supabase. There is no HTTP surface, no storage and no migration
yet — so nothing is deployed and nothing is live. It is a library with tests.

### Open, and each needs a word from you eventually

- **Resumability.** A container recycles and an isolate dies; the run record is
  shaped so a run *could* be picked up where it stopped, but nothing writes it
  down yet. Worth doing before there is a customer, not after.
- **What a tool may reach, and how a tenant grants it.** The wall is built and
  fails closed; what is not decided is where the grants live.
- **A tool's error text goes back to the model as-is.** Fine while you write the
  tools. The day someone else writes one, a message that quotes a connection
  string is how a secret ends up in a transcript, and there is nothing here that
  scrubs one.

---

## 2026-09-14 — A run can now survive the thing that keeps killing them

You said keep going, so I built the resumability piece. Plain version: **if the
machine running an agent disappears halfway through, the work already paid for is
not lost.**

**How it works.** Everything the run does gets written down as it happens, to a
list that is only ever added to — never rewritten. That shape is the one that
survives a process vanishing mid-write: there is no half-updated record to
puzzle over, and the worst a crash can cost you is the very last line. **The
model's answer is written the instant it arrives, before any tool runs**, because
that answer is the part that cost money.

**The one genuinely hard bit, and it is about your money.** If the power goes out
right after the model asks for a tool, the record cannot tell whether that tool
ran. Not "probably" — cannot. So the question is not *did it run*, it is **is
running it again safe?** Reading a database twice is fine. Charging a card twice
is not.

So a tool can now say whether it is safe to repeat, and **the default is the
careful one**: if a tool has not said, a resume **stops and names it** rather
than risking it. That means a stuck run sometimes needs you to look at it — which
is annoying, and it is the right way round, because being told is recoverable and
a double charge is not. If you would rather it carried on and told the model "we
could not tell whether this ran", say so and I will switch it; it is written down
as your call.

**Three other things it now refuses to do**, each of which would have cost you:

- **Replaying a finished run does not buy a second one.** It hands back the
  answer it already gave.
- **A record it cannot read is not resumed at all**, and nothing is spent finding
  out. Reading past a corrupt line would send the model a conversation with a
  step missing and under-report the bill.
- **If it cannot write the record, it stops and says so.** You asked for
  durability; carrying on without it produces a run that looks resumable and
  isn't, and then the work gets paid for twice.

One small thing worth knowing: **"how long a run has taken" now means time spent
working, not time on the calendar.** A run that died at midnight and picks up at
nine did not spend nine hours working, and charging it nine hours would fail
every resumed run the moment it restarted.

### What is proven and what is not

**Proven:** 93 tests, all green.

**Also proven, now that the re-run is done: 54 deliberate breakages, 54 caught,
none that failed to apply, both do-nothing controls correctly surviving.**

The first pass came back 50 of 51, and the one that got through was **my test's
fault, not the code's** — I had used a fake record-keeper that failed on *every*
write, so when the breakage made the code ignore one particular write it tripped
over the next one and still reported the right error. The test passed for the
wrong reason. Fixed with a version that fails one kind of write at a time, and I
added a breakage for each of the four write points rather than just the one,
because a careful test of four things needs four deliberate breakages or only the
one you happened to try is really checked. All four are caught now.

**NOT proven live:** still nothing against a real model, Worker, container or
Supabase. No storage, no HTTP route, no migration. Where the record gets *kept*
is deliberately not decided in the code — it takes whatever you hand it.

### And the thing you called out

You asked why I kept focusing on the site builder. I wasn't building it — but you
were right that it kept showing up, because I justified nearly every rule with
"the other product paid for this". That made your new product read like an
appendix to the old one.

**Stripped.** All 36 of those references are gone from the code comments, the
tests, this file and the engineering notes. Every rule that was worth keeping is
still there, stated on its own terms; nothing was deleted for being
inconvenient. The folder now explains itself without mentioning anything else in
the repo.

The one place the rest of the repo still gets a mention is a short list of rules
for **coexisting** with it — don't touch the root `package.json`, don't put files
at the repo root, run the tests from this folder. Those are load-bearing: break
one and you fire a 25-minute harness or roll a live container. They read as rules
now, not as a tour of the other product.

---

## 2026-09-15 — Runs are stored now, and the database refuses the bad states itself

You asked for the Supabase tables. Built, and **proved against a real PostgreSQL
16.13** — not read over, not reasoned about. Everything below was checked by
trying to break it.

**The one-sentence design: the log is the only thing written, and the database
works everything else out from it.** When a run starts, the only things saved are
its id and whose it is. Its status, which agent, which model, its limits, how it
ended — all of that is derived by the database from the log itself. If the
application wrote a status too, that would be a second copy of something the log
already says, and two copies of one fact eventually disagree.

### What the database now refuses outright

Not "detects and complains about" — **cannot store**:

- a run being started twice, or finished twice;
- two answers recorded for the same step;
- two results recorded for the same tool call;
- an entry that is missing the position it needs to make sense;
- **and any attempt to EDIT an entry after it was written** — refused even for a
  caller with every privilege, because rewriting history is the one thing that
  would make the whole idea worthless.

Deleting is deliberately still allowed, because you have to be able to delete old
runs, and deleting a run has to take its log with it. That one is controlled by
permissions instead.

### Tenant isolation

A customer sees their own runs and nothing else, and **it fails shut in three
different ways**: no credentials, broken credentials, and credentials that don't
name a tenant all see nothing at all. A customer can read and **cannot write
anything** — the runner writes, and the runner is server-side.

**One honest limit, because you should know where the wall stops.** The
server-side key is exempt from those rules by design on Supabase — that is how it
gets its job done — so the rules protect *reading*. Nothing in the database stops
the runner itself from filing a run under the wrong customer. That's the
application's job and there's exactly one line where it's decided.

### The two values that had to survive being saved

- **"We don't know what this cost" stays different from "this cost nothing."**
  Stored as a real unknown, with the field still present, so three different
  situations stay three different situations. A budget enforced by assuming the
  part you failed to measure was free is not enforced.
- **"No limit" survives.** This one is a genuine trap: the standard way of writing
  data to a database turns infinity into an empty value, and an empty value is
  indistinguishable from "we forgot to record the limit." So it's written
  deliberately as a marker and read back as no-limit — **and a genuinely empty
  value is never read as "no limit"**, which would be the most expensive possible
  misreading.

### One thing in there worth knowing about, because it's counter-intuitive

**A rejected duplicate is treated as a success.** If the network drops after the
database has saved something but before it can say so, whoever was saving has no
way to know which side of that line it died on. If a retry were treated as an
error, it would kill a run that is perfectly healthy — and the thing being
re-sent is a model answer you already paid for. So "you already have this" is
read as "good, carry on". That's what makes retrying safe at all, rather than
being an obstacle.

### Three mistakes I made building the test, all mine

Each cost a round and none was the product:

1. The server key on Supabase is exempt from the isolation rules; **my test
   created it without that exemption**, so the writer was blocked by rules it
   isn't subject to and **forty checks failed for a reason that doesn't exist in
   production.** A test set up differently from reality is worse than no test,
   because it gives you a specific wrong answer.
2. Database roles are shared across the whole server, not per database — so "create
   if it doesn't exist" quietly kept a stale version from an earlier run.
3. One of my own setup commands returned a row, which got mixed into every answer
   I was checking. A test that pollutes its own output reports working code as
   broken.

### Proven, and where it actually stands

- **117 unit tests, all green.**
- **51 checks against a real PostgreSQL, 0 failed.** The schema in that check is
  read out of the migration file rather than typed into the test, so what is
  proved is what would actually be applied. Every refusal is checked for *which*
  wall stopped it — a refusal from the wrong wall looks exactly like the right one
  working — and every group has a control that must succeed, without which a
  database that rejected everything would pass the whole file.
- **68 deliberate breakages, 68 caught**, both do-nothing controls surviving.

**⚠ NOT APPLIED TO SUPABASE. Nothing has been created in any Supabase project.**
This is the part you asked me to be clear about. The only Supabase project this
repo has credentials for is the one belonging to your other product, and putting
these tables there is exactly the mixing you told me to avoid. To go live this
needs **either its own Supabase project, or your say-so to share that one.** Your
call, and it is the next decision rather than the next piece of work.

**One gap named rather than hidden:** the deliberate-breakage sweep can't see SQL,
only JavaScript. What stands in for it is that all 51 database checks are
adversarial by design — each one tries to break a specific guarantee and names the
wall that has to stop it.

Still no HTTP route, no real model calls, no container — you scoped those out and
they're untouched.

---

## 2026-09-15 — You were right about the single-entry delete, and it was the bad kind of wrong

You asked me to check whether one journal entry could be deleted with its run left
in place. **It could, and the damage is exactly the shape you described — worse,
actually, because nothing complains.**

**What I found.** The runner can't do it (no permission) and a customer can't
(no permission). But a caller with full database privileges could, and when I
deleted one entry the log was left describing a payment that had been *asked for*
with no record of it *completing*. Replay reads that as **still pending** — and
**reports no problem at all**, because a deleted entry looks identical to one that
was never written. So a charge that already went through would be re-attempted on
resume, or the run would strand, depending on how the tool is declared. Measured,
not guessed.

**The fix, and retention still works the way you wanted.** Deleting a single entry
is now refused outright — including for a caller with every privilege, since that
was the only caller who could do it. **Deleting a run still deletes its whole
journal with it**, which is the only route through, and I checked that it still
does rather than assuming.

One detail worth recording because the obvious approach would have been wrong:
the natural way to allow the cascade is to ask "is the run still there?", since
deleting a run removes it first. But whether that row is *visible* depends on who
is asking, and **a wall whose answer depends on who is looking fails open when it
fails.** So it uses an explicit marker instead, and I checked the marker can't
survive past the transaction that set it — a leaked one would reopen the hole for
everything else on that connection.

### The storage adapter, and the boundary you asked for

**The tenant is no longer something any call accepts.** The store now gives out
exactly one thing — "work as this tenant" — and everything else comes from that.
**No operation takes a tenant at all, so a tenant id arriving in a request body
cannot become authority even by mistake: there is nowhere to put it.** That's
checked as a census over the real surface, not promised in a comment.

**Loading is authorised too**, which was the gap you pointed at. And you cannot
get a way to *write* to a run without having passed that check first — the only
two sources of one both authorise, and the read-only view deliberately can't hand
one out.

**Somebody else's run reads as "not found", never "forbidden"**, and the error
never names who owns it. "Forbidden" would tell a stranger that the id they
guessed is real.

**One subtle one I'd have missed without looking:** creating a run twice is
harmless by design, but the id is unique on its own — so a "duplicate" could be
*another tenant's* run with the same id. Handing back a way to write to it would
have been the exact leak. It now confirms ownership before absorbing a duplicate.

### The round trip you asked for, end to end

Run → saved → reloaded in a fresh process → resumed. It picks up at the right
step, **does not re-buy the model call it already paid for**, carries its spending
across the gap, and the earlier tool result reaches the model. Nothing is written
twice.

Plus the two cases you named: **a customer cannot reach another customer's run to
resume it at all**, and **a finished run reloaded does not run again** — it hands
back the answer it already gave, with zero model calls.

### ⚠ The distinction you asked me to keep explicit

**The 60 database checks are NOT a SQL mutation sweep, and I am not going to blur
that.** No schema guarantee has been proved by deliberately breaking the schema
and watching a check go red. What the checks do is weaker: each one attacks a
specific guarantee from the outside and names which wall has to stop it, and each
group has a control that must succeed. That is hand-written coverage, not
mechanical coverage — **nothing proves those checks would catch a schema broken in
a way I didn't think of.** Building a real one is feasible (break the migration
file, run the database checks, confirm they go red) and I have not done it. Say
the word if you want it.

### Where it stands

- **121 unit tests green.**
- **60 database checks against a real PostgreSQL 16.13, 0 failed.**
- **74 deliberate breakages, 74 caught**, both controls surviving. All seven new
  ones aimed at the ownership boundary died.

**Still NOT applied to Supabase — nothing created in any project.** As you said,
we settle which project first. Still no HTTP route, no real model calls, no
container.

---

## 2026-09-15 — There is an API now, and the deliberate-breakage sweep on the database found a real hole

### The API

Three things work end to end, locally: **start a run, read its progress or
result, resume an interrupted one.**

**Every request goes through the same four steps in the same order, and that order
IS the security:** check the token, take the customer's identity *from the verified
token*, build a store that can only see that customer, and only then look at what
was asked for. Nothing can reorder those, because the store that gets built takes
no customer argument at all — **so an identity arriving in the request body has
nowhere to go.** A body that carries one is **refused outright**, not quietly
ignored, since a silent drop lets somebody think it worked.

**A request that isn't properly signed in gets nothing**, and I tested that with
real signatures rather than a stand-in: no credentials, a token signed with the
wrong key, an expired one, one with no expiry at all, one with the signature
turned off, one that claims a different kind of signature to trick the check, one
with the customer edited in flight, and one with no customer in it. Ten shapes,
four routes, all refused. **And the refusal never says which of the ten it was** —
telling you would turn the endpoint into a tool for guessing at tokens.

**Another customer's run id gets nothing either**, and reads as *not found* rather
than *forbidden* — because "forbidden" tells a stranger that the id they guessed is
real.

### The work outlives the request

**Starting a run writes it down, hands the work off, and answers immediately.**
Nothing in the request waits for the model. That matters because a real run takes
minutes and an HTTP connection does not.

Where the work actually *goes* is deliberately left as a plug — you pass in a
dispatcher. Wire it to a queue or a container when you have one; today the tests
pass in a queue that runs nothing until asked, **which is what makes "the response
didn't wait" something I can prove rather than claim.**

Two things it refuses to do: **a finished run is never started again** (it hands
back the answer it already gave, without calling the model), and **a run whose
record can't be read cleanly is never resumed** — resuming past a corrupt line
would send the model a conversation with a step missing.

One I built because the alternative is nasty: **if the background work crashes, the
run records that it crashed.** Otherwise it would read as "still running" for ever,
which is the one state nobody can act on.

### ⚠ The database sweep found a real hole, which is why you asked for it

You said the 60 checks weren't a deliberate-breakage sweep. You were right, and
building one **immediately found something I had got wrong.**

**The hole:** when I stopped single journal entries being deleted, the marker I used
said only *"some run is being deleted right now"* — not *which* one. So inside one
transaction, deleting **any** run authorised deleting **another** run's entries. My
claim was "an entry can only go with its own run", and that claim was false. It now
names the run. Narrow exposure — nobody has the permission to try it except a full
database administrator — but the claim was wrong and is now right.

**It also found that one of my own checks couldn't see its own subject.** Every
check ran as a separate database connection, so anything that persisted at
*connection* level rather than *transaction* level was invisible to all of them.

**And it found two breakages that genuinely change nothing**, which I proved by
measuring rather than by hunting for a missing test:
- one wall inside the customer-isolation rules is redundant today, because another
  rule already covers it. I've kept it (it's what holds if the other is ever
  loosened) and **written in the file that it's deliberate**, so nobody deletes it
  as useless.
- one flag I'd assumed was doing the work turns out not to be. The behaviour is
  right either way; **I checked three ways and I don't know why**, and I've written
  that down as "not known" rather than inventing a reason.

**A correction to something I told you earlier.** I said the isolation rules are
"forced, so the owner isn't quietly exempt". **That part is untested.** It's only
observable to a database owner who isn't an administrator, and in my test
environment the owner *is* one — administrators bypass those rules regardless. So I
deliberately don't break that line in the sweep, and the claim stands as unproven.

### What works locally, and what is still not connected

**Works locally, proven:** the whole flow — request, background execution, storage,
result — plus interrupted resume and completed-run replay. **149 tests**, a **real
PostgreSQL 16** for the database (70 checks), **98 deliberate code breakages** and
**20 deliberate database breakages**, each with a do-nothing control.

**Not connected, and each needs something from outside:**
1. **Supabase** — still nothing applied anywhere. We settle which project first.
2. **A real model.** Every test uses a stand-in. Nothing has called a provider and
   nothing has spent anything.
3. **A real background dispatcher** — a queue or a container. The plug is there and
   tested; what goes in it is infrastructure.
4. **Where the signing secret comes from.** The token checker takes one; in
   production it's Supabase's JWT secret and needs to reach the Worker.
5. **A deployment.** No Worker config, no routes, no domain. Nothing is deployed.

---

## 2026-09-15 — The tables are live in your existing project, and I checked every claim against it

You said same project as the site builder, so that's where they are:
**`ujrqdmmtcptvimazlhom`** — applied and verified.

**Nothing of yours was touched.** The agent tables live in their own namespace,
not alongside your site tables, so no name can clash and deleting this product
later is deleting one namespace. Your 32 site tables are still exactly 32. The
migration adds nothing to, and changes nothing in, anything that was already
there — it only creates new things.

**Small thing worth knowing:** that project is *named* "fifa-tournament-hub" in
the Supabase dashboard — a leftover from something earlier. It's definitely the
right one (it holds all your site tables), but the name is misleading if you go
looking.

### I verified it against the real database rather than trusting "success"

Your own rule is that a migration file isn't the record of what's live, so I read
it back: the tables, the auto-derived columns, all four duplicate rules, all four
triggers, isolation switched on and forced, the policies, the functions.

Then I ran the behaviour itself against the live database — **which matters,
because your project runs Postgres 17 and all my local testing was on 16**. Every
guarantee held: duplicates refused, entries un-editable, a single entry
un-deletable, deleting a run still taking its log, "we don't know the cost"
staying distinct from "no cost", "no limit" surviving storage, and a real
signed-in customer seeing only their own runs — plus seeing **nothing** with
missing or corrupt credentials. **That probe undid itself when it finished**, so
both tables are empty.

**Supabase's own security scanner flags nothing in the new namespace.** Everything
it reports is pre-existing in your site builder (tables with isolation on but no
policies, a few functions signed-in users can call). I haven't touched any of
those — they're yours to judge, and I can go through them separately if you want.

### ⚠ One switch left, and it's in the dashboard not in code

**Supabase doesn't yet let the API see the new namespace**, so the code can't
reach those tables over the network even though they exist and are correct. It's
one setting: **Project Settings → API → Exposed schemas → add `agent`.**

I deliberately didn't do that for you — it widens what your project's public API
surface can serve, and that felt like yours to press. If you'd rather not add it
at all, the alternative is putting these tables in with your site tables under a
name prefix instead, which works today with no setting but gives up the clean
separation you asked for. Your call.

### So what actually works now

**Live:** the database. Every guarantee proven against your real project.

**Still not connected:** a real model (everything uses a stand-in; nothing has
spent a penny), a real background dispatcher, the signing secret reaching the
Worker, that one dashboard switch, and a deployment — there's still no Worker
config, no route, no domain.

---

## 2026-09-15 — Wired to your live project, and driving it for real found a bug my tests couldn't

### The switch is on, and your site builder is fine

`agent` is now visible to the API on `ujrqdmmtcptvimazlhom`. **I read the existing
list out of the API itself rather than assuming it** — asking for an unexposed name
makes it tell you exactly which ones are exposed — so what's there now is the two
that were there before **plus** `agent`, and nothing dropped. **I checked your site
builder's own API immediately afterwards: still answering.** That was the whole
risk of this change.

One thing to know: I set it **in the database**, not in the dashboard, because
that's the only lever I have. Reversing it is one line. If you ever edit the
dashboard's exposed-schemas and it seems not to take effect, this override is why.

### ⚠ A real bug, and only driving it for real could find it

**Supabase does not put a "which customer is this" field in its login tokens.** My
isolation rules keyed on one — so every rule was correct and **impossible to
satisfy**: a genuinely signed-in customer would have matched nothing, for ever.

**161 tests, 70 database checks and two deliberate-breakage sweeps all passed while
that was true.** They passed because every token my tests create *includes* that
field. The test setup was more capable than reality, and that is the one kind of
mistake you cannot catch by writing more tests of the same shape — only by running
the real thing against the real thing, which is what you asked for.

Fixed: an explicit customer field still wins, and without one **each signed-in user
is their own customer** — the normal Supabase arrangement, no extra setup. I'll flag
that this is a *widening*: before, nothing anyone presented matched anything; now a
signed-in user matches their own runs. That's the intent, but it isn't a no-op.

I also strengthened the check that's supposed to keep the code and the database in
step — **it had been checking one of the two names, which is checking neither
decision.**

### Verified against your live API, as a real signed-in customer

I created a throwaway user, signed in for a genuine token, and checked over real
HTTP. They **read only their own** run and journal; the other customer's run and
journal both come back **empty** rather than refused (refused would tell a stranger
the id is real). And **every write is rejected** — adding a journal entry, creating
a run, editing one, deleting one, deleting an entry. Nothing changed. A caller with
no login is stopped even earlier, at the namespace itself.

**Cleaned up after myself:** the probe runs, and the throwaway user, are gone.
One note — signing that user up sent a confirmation email to a fake address, which
used one of your 200/day. I didn't repeat it.

### The Worker is built

Its own config file, separate from your site builder's, which **cannot ship by
accident**: your deploy runs at the repository root and never reads it. Deploying
is a deliberate command and **I have not run it.** The three secrets are set with
`wrangler secret put`, never committed.

The work is handed off so it outlives the request. Two deliberate refusals worth
knowing: **a missing setting answers a clear 503 rather than crashing** (a crash
would come back as an HTML error page telling you nothing), and **a model name it
doesn't recognise is refused rather than quietly falling back to the stand-in** —
because a deployment that thinks it's talking to a real model while answering from
a canned script is the worst possible silence.

There's also `npm run serve`, which runs the Worker's *actual* handler over real
HTTP locally — not a copy of it.

### ⚠ The milestone is blocked on two secrets, and it isn't a code problem

One complete task through the Worker into your live database needs:

1. **Your project's JWT secret** — without it the Worker can't verify a customer's
   login.
2. **Your service-role key** — without it the Worker can't write.

This session has no way to get either; Supabase only hands me the public key. So I
proved the next best thing, and it's a real proof: **running the actual handler over
real HTTP against your real project**, no credentials got 401, a forged token got
401, and a correctly signed token was accepted, carried into storage, and reached
your Supabase — which refused it for holding no privilege. **The chain is connected
end to end and stops exactly at the credential.**

When you want to finish it: put those two in as Worker secrets (or hand them to me
as environment variables you set, not pasted into chat) and the same command
demonstrates the whole thing.

### Where it stands

**Implemented:** the run engine, storage, auth, the HTTP routes, the dispatcher, the
Worker entry, its own config, the local runner, the agent registry, the model
stand-in.

**Deployed:** the **database only**. Nothing else — no Worker, no route, no domain.

**Still to connect:** the two secrets above, a real model provider, and a queue or
container for runs longer than one Worker invocation (the seam is there and tested;
only the thing behind it is missing).
