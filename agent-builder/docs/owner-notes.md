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

---

## 2026-09-15 — Public-key auth, a real queue, and a 65-second run

Four things you asked for. All four done, and one of them made the milestone from
last time reachable without the secret I was blocked on.

### 1. I stopped asking for your JWT signing secret

Last session I reported the milestone blocked on two secrets. **One of them turned
out to be unnecessary**, and that is the better outcome rather than a workaround.

Asking for a project's JWT signing secret means asking for the credential that can
**mint a token for any one of your users** — to do a job that only needs the
ability to **check** one. I looked at what your project actually offers instead:

- **It publishes an ES256 public key.** `/auth/v1/.well-known/jwks.json` answers
  one key and it imports cleanly into the Worker's crypto. An asymmetric token is
  now verified **inside the Worker, with no secret and no network call**.
- **A legacy HS256 token is checked by asking Supabase.** `GET /auth/v1/user` with
  the token and your *publishable* key. I proved it is a real signature oracle
  against your project: a genuinely signed token comes back refused for its
  **claims** (`missing sub claim`), and the same token with one character changed
  comes back refused for its **signature**. Two different answers for two
  different causes is exactly what makes it usable.

So `SUPABASE_JWT_SECRET` is now **optional** — set it only if you would rather pay
no round trip and have already accepted what that credential can do. Nothing about
your project's signing configuration was changed, and nothing needed to be.

**One thing I was careful about, because it is the oldest hole in this kind of
code:** a token must never be allowed to choose how its own key is used. An HS256
token can never reach a published public key here, and a published key's own
declared algorithm decides, not the token's. Both are driven in tests with a real
generated keypair.

### 2. `waitUntil` is gone. The work is a row now.

The old dispatcher kept a run alive after the response, which is the right shape
and the wrong durability: **the work existed only as a closure in one isolate**, so
an eviction, a deploy or a crash lost it with nothing anywhere recording that a run
was ever meant to progress.

Now accepting a run writes three things in **one transaction** — the run, its first
journal entry (so the prompt outlives the request), and a queue row — and only then
answers 202. A Cloudflare queue message carries **a run id and nothing else**: it
is a doorbell, and if it is lost, a cron finds the row and rings again. Latency,
never work.

**The hard part was making sure one run cannot be executed twice**, because paying
for the same model calls twice is real money and firing a payment tool twice is
worse. Three walls:

- **The claim.** One conditional `UPDATE`: the row is taken only if nobody holds a
  live lease. A duplicate delivery and two people pressing resume at the same
  moment all lose the same way — nothing comes back, and the loser does nothing.
- **The lease.** A worker says "still here" every 30 seconds; the lease lasts 90.
  **It is a liveness check, not a time limit** — a run that keeps beating is never
  taken away, however long its work honestly takes.
- **The gates.** If a worker loses its lease mid-run, it is stopped before its next
  model call (so a lost lease costs nothing) and stopped from writing anything to
  the log (so it cannot write history somebody else now owns). The run is left
  exactly as the next holder needs to find it.

**And the rule about not repeating uncertain work is intact across all of it.** A
tool that may have already run and is not marked safe to repeat still refuses the
resume and names itself. There is a test that takes a payment, loses the lease
while the payment is in flight, has the sweeper offer the run again — and the
payment is taken **once**.

### 3. A 65-second run, demonstrated

`npm run demo:long`. What it showed, all checked rather than described:

- the response came back in **82 ms**;
- the run, its prompt and its queue row were **already in the database** at that
  point;
- the accepting process had **no consumer at all** — it would have thrown if it
  tried to run anything in the background;
- a **separate process**, which never saw the request, found the work in the
  database and ran it;
- it ran for **65.6 seconds** after the response, and progress was visible over the
  API the whole way (steps 1…9, one every 8 seconds);
- the final answer and every step are in the database.

**Where it ran, plainly: a throwaway local PostgreSQL with your real migrations
applied, not the hosted project.** The schema, triggers, indexes and the claim are
the genuine article; what is local is the HTTP translation in front of them. Writing
to the hosted project still needs the service key, which I do not have — that is
the only thing left, and `docs/deploy.md` has the exact command.

### 4. The database half is live

Migration `20260915032807_agent_run_work` is applied to
`ujrqdmmtcptvimazlhom`. I checked it by reading it back rather than trusting the
success flag, and then drove **30 behavioural checks against your live project** —
the claim, the lease, the resume-mid-run case, tenant isolation, the cascade — all
passing, all rolled back, and both tables left empty. The six function bodies match
the file in this repo **byte for byte**.

The security advisors flag one new thing in `agent`: `run_work` has row level
security on with no policies. **That is deliberate and it is the strongest
statement available** — no customer role has any grant on that table at all, so
there is nothing for a policy to permit. Eighteen tables in your project are in the
same state for the same reason.

**One cost I should name:** the queue needs Cloudflare Queues, which is a paid
Workers plan. If you would rather not, the alternative is not going back to
`waitUntil` — it is a different transport behind the same seam, because the durable
part is the row. `scripts/consume.mjs` is a working example that takes no messages
at all.

### What is still not connected

- **`SUPABASE_SERVICE_KEY`** — the one remaining secret, and the only thing between
  this and a run stored in your hosted project.
- **A real model provider.** One registry entry plus a `send` function.
- **Nothing is deployed.** No Worker, no queue, no route, no domain. `docs/deploy.md`
  is the step-by-step.

---

## 2026-09-15 — Ready to deploy, and one command from you

### ⚠ I cannot deploy it. Here is exactly why, and exactly what to run.

There is no `wrangler` and no Cloudflare credential in this session — the rest of
your repo deploys through GitHub Actions with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and neither is reachable from here. So I did everything up
to the two commands and nothing beyond them.

### The one secret, and the exact command

**I configured everything that isn't a secret myself.** The project URL and the
publishable key are now committed in `agent-builder/wrangler.jsonc` — a URL is public
and a publishable key is the one you hand to browsers — so you need exactly one:

```sh
cd agent-builder
wrangler secret put SUPABASE_SERVICE_KEY -c wrangler.jsonc
```

It prompts, doesn't echo, and doesn't touch your shell history. Paste the
service-role key (or an `sb_secret_…` key).

**Run it BEFORE the first deploy.** Wrangler will say the Worker doesn't exist and
offer to create it — say yes. This is not fussiness: on your account a standalone
`wrangler secret put` *after* a deploy fails with "the latest version of your Worker
isn't currently deployed", which is why your other product uploads its secrets inside
the deploy step. That's recorded in your own `deploy.yml`; I reused it rather than
rediscovering it.

Then:

```sh
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ./scripts/deploy.sh
```

That runs the tests, creates the `agent-runs` queue, prints the queue verdict loudly
(a token missing the **Queues edit** permission fails in a way that looks exactly
like success, which is your own recorded trap), and deploys.

### Then one command verifies all four things you asked about

```sh
AGENT_URL=https://agent-builder-api.<your-subdomain>.workers.dev \
AGENT_USER_EMAIL=… AGENT_USER_PASSWORD=… \
SUPABASE_URL=https://ujrqdmmtcptvimazlhom.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_icEWWZsuue5VG4ogSwFFCA_D01jLquT \
SUPABASE_SERVICE_KEY=… \
node scripts/verify-live.mjs
```

It signs in as that customer for real and reports the version, the endpoint, every
run id and every result. **About eight minutes**, because three of the runs are the
65-second task and a handover costs a beat plus the sweep's grace plus a cron tick.

### I ran that script before handing it to you — 50 checks, 0 failed

Not against your project (no service key), but against a real PostgreSQL with your
real migrations and **two separate consumer processes**, which is what makes a
handover something that happens rather than something described. The same file,
unmodified. What it showed:

- **the long task**: 202 promptly, progress readable the whole way, final result
  retrievable, and the stored log matching what the API reported;
- **one run, one execution**: two simultaneous resumes mid-run both refused as
  `already-running` without disturbing the holder; a second claim got nothing; nine
  model entries for nine steps, so nothing ran twice;
- **the handover**: a consumer lost the run at 2 steps, another took it over **5
  seconds later**, and it finished at 9 steps with 9 model entries — it continued
  rather than restarting;
- **the blocked action**: the `guarded` agent's tool is declared not-repeatable. Its
  lease was revoked with the tool call in flight, and **the result was never
  written** — no stop recorded, the pending call visible, and asking again refused
  again without repeating it.

One thing worth naming: `guarded` is a payment's shape without a payment. Its tool
only waits. The refusal is decided by the **declaration**, which is the only thing
that should decide it, and a verification must not do anything to anybody.

### Two things I found while doing this

**A refusal that covers two causes.** Checking whether Supabase's API had picked up
the new queue functions, `claim_run` answered "no matches found in the schema cache" —
which reads exactly like a stale cache and isn't one. Called with `{}`, it genuinely
doesn't match, because two of its arguments have no defaults. Called with its real
argument names it answers the `anon` permission wall, while a function that doesn't
exist still answers the cache error. **So your API does know the table and all six
functions** — but only a control could tell those apart.

**An invariant nobody had written down.** A worker learns its lease is gone at its
next beat, so there is a window in which it is still working and doesn't know. The
sweeper's 30-second grace is what stops that window overlapping with another
consumer's — and nothing said so. It's now asserted, and `consume.mjs` refuses to
start with a grace shorter than a beat.

### ⚠ Still not done, and one of them is a real gap

- **Nothing is deployed.** Two commands from you.
- **Crossing a consumer invocation's own time ceiling is untested.** The design
  answer is that the lease lapses and the run resumes from the log — which is exactly
  what the handover check exercises on purpose — but no run has actually reached that
  ceiling. The longest driven end to end is 65.6 seconds. The verification script says
  so in its own closing lines rather than leaving it implied.
- **The service-key half of the verification is unexercised against your hosted
  API.** Reading the queue table and revoking a lease as `service_role` is proved on a
  real PostgreSQL and at the database level on your project, but not over its HTTP
  API, because no service key has been available to me. It will fail loudly with a
  named error rather than quietly if anything is wrong.
- **A real model provider.** One registry entry plus a `send`.

---

## 2026-09-15 — Deploying through Actions

You were right that a dispatch-only workflow can't bootstrap this. I checked, and
it's worse than inconvenient: `POST /actions/workflows/<file>/dispatches` answers
**403 Resource not accessible by integration** from a session — your
`answer-read.yml` already records that so nobody re-tries it. So the trigger is a
push, restricted to this branch and nothing else.

**One new file: `.github/workflows/agent-deploy.yml`.** `deploy.yml` is untouched,
and your own census (`test/merge-triggers.test.mjs`) still reads exactly one workflow
on a push to main.

**A trap worth knowing about.** That census reads the branch filter with a regex and
has no YAML parser, so the filter has to be written inline — `branches: [claude/…]`.
Written as a block list it parses as *no filter*, which means every branch including
main. A perfectly reasonable reformat would either fail the census or, if it slipped
through, put this on your merge. The census would have caught it; I've written the
reason down in the file so nobody "tidies" it.

**Ordinary pushes deploy nothing.** They run the agent's checks and stop. A deploy
needs the tip commit's message to opt in, and I've kept that marker out of every
other file and every other commit message — your existing rule about the smoke
marker is recorded twice over because a commit *explaining* a marker arms itself.

**Verified before arming it**: I pushed once without the marker. The run finished in
14 seconds, ran the agent suite on the runner (**222 tests, 222 pass, 0 fail**), and
**skipped all eight deploy steps**. That's the gate working, confirmed rather than
assumed.

**What the deploy run does**, stopping at the first thing it cannot confirm: the
checks; the credentials, reported by length and never by value, then `wrangler
whoami` — because a secret that exists and has expired looks exactly like one that
works right up to the deploy; `queues create agent-runs`, where **a non-verdict fails
the run** rather than being printed and passed over; `wrangler deploy --config
wrangler.jsonc`, named explicitly so nothing can resolve your other product's config
by accident; `SUPABASE_SERVICE_KEY` and nothing else; a `/health` wait; the four-part
verification; and a cleanup step that runs even if the verification dies.

**One thing I did that you should know about.** The verification needs a real
customer to sign in, and there's no email/password secret. So it creates a confirmed
user through the admin API and deletes it afterwards — **no mail is sent**, which
matters because an earlier round of this work spent one of your 200 daily sends
signing up the ordinary way. The cleanup matches on both halves of the throwaway name
so it can never touch a real customer.

### It is live

**`https://agent-builder-api.aniascapital.workers.dev`** — version
`2dfb8be6-3bf1-400d-91dc-ee5990081ffd`, running the stand-in, on your existing
Supabase project. Actions run
[34931112854](https://github.com/canias7/isibi-app/actions/runs/34931112854), green.
**52 checks, 0 failed.**

The four runs it made are rows in your database, and I read them back afterwards
rather than trusting the log:

| | run id | what happened |
|---|---|---|
| long task | `8f7d4d7f…` | 202 immediately, **72.9 s of work after it**, progress readable the whole way, answer retrievable. 9 model / 8 tool entries, 1 attempt |
| one execution | `fca9851c…` | two resumes pressed at the same moment, both told `already-running`; a second claim got nothing. 9 answers for 9 steps, **1 attempt** |
| handover | `1946e28b…` | I revoked its lease at 2 steps; a different consumer picked it up **69 seconds later** and finished at 9. **Exactly 2 attempts** — one original, one replacement |
| blocked action | `4d3c4d0d…` | lease revoked mid-call on a tool marked not-repeatable: **4 answers, 3 results** — the in-flight one was never written, no ending was recorded, and asking again changed nothing |

That `attempts` column is the part I'd point at. 1 where one consumer did the work, 1
where two people pressed resume, and exactly 2 where a consumer was replaced. A run
executed twice could not hide from it.

**Two things the log showed that the checks didn't ask about**, and both are worth
your attention:

**The one-beat window is real, and I saw it.** A worker finds out its lease is gone at
its next heartbeat — 30 seconds — and until then it keeps working and its writes land,
because the database has no idea. On the guarded run that meant two more stages
completed after I revoked the lease. Nothing was lost: those were the run's own next
steps, and the moment the heartbeat caught up the in-flight result was refused, which
is the behaviour that matters.

**But the margin protecting that is exactly zero.** The sweeper waits 30 seconds
before offering a dropped run to anyone else, and a heartbeat is 30 seconds — equal.
In this run the cron's own minute gave real slack and there was no overlap (the
original stopped by 05:07:48, the replacement claimed at 05:08:24). I'd rather widen
the sweeper's wait than rely on the cron's timing, but that is a change to make on
purpose and re-verify, not one to slip in after a green run. **Your call.**

**Housekeeping**: the throwaway customer was deleted and the cleanup confirmed `13
users listed, 0 left by a verification`. The four verification runs are still in
`agent.runs` as the evidence above — say the word and I'll remove them.

### The stale-writer window is closed, and not by widening the grace

You asked me to close the gap the last round found — the one where a consumer whose
lease I had revoked kept working, and writing, for another thirty seconds. It is closed,
and the way it is closed matters more than the fact:

**The database now decides at write time.** Every claim gets a token (a fresh uuid, per
claim), and every journal write has to present it. The check is not "ask, then write" —
that is two statements with a reclaim able to fit between them, which is the same race
one layer up. It is one function that locks the work row, checks the holder, the token,
that the run is unfinished and that the lease is live, and inserts, all in one
transaction. Whoever takes the row lock first wins; the loser reads what the winner
left. There is no third possibility.

**And the direct door is shut, not merely unused.** The Worker's own credential no
longer has permission to insert a log entry at all. That is the difference between a
wall and a habit: however the code is written, an entry can only go in through the
function that checks.

**I did NOT widen the sweeper's grace, and here is why that was the wrong lever.** You
have the note from last time where I said the margin was zero and offered to widen it.
Looking at it properly: the claim function takes a lapsed lease with *no* grace at all
— the grace only governs the sweeper, which is one of several ways a run gets offered
again. A duplicate delivery arriving a second after a lease lapses claims it
immediately. So the window a bigger grace would cover is not the window that existed.
Both proofs assert that out loud: the replacement takes the run over while the sweeper
still refuses to offer it.

**I also did not lean on the `attempts` column.** It counts claims, so it is evidence
about the queue and says nothing about what a displaced worker went on to write — which
is precisely what was wrong. The evidence here is refusals: the old holder's write comes
back `lease-expired`, or `not-holder`, or `bad-token`, and the replacement's is stored.

**The one thing fencing cannot do, said plainly because it is easy to believe
otherwise.** It stops the *record* of an action, never the action. A tool call already
sent cannot be recalled by a database. If a stale worker fired a payment and then had
its write refused, the run is left with a model answer and no result — a pending call —
and because that tool is marked not-repeatable, the run refuses to resume rather than
firing it again. That refusal is still the guarantee. Fencing narrows the window in
which the send can happen; it does not replace the rule.

**And a cost, so you have it before you find it.** A result a stale worker really did
obtain is now thrown away rather than written, so a run that would have limped to the
end can instead end up waiting for a person. I chose exclusivity over completion. If
you would rather have it the other way round for some class of tool, that is a decision
to make deliberately.

**One thing I found while checking my own work, which is not mine and which I left
alone.** Two functions from the very first migration don't match the repository: an
earlier session's apply turned every em dash into `--`. In one of them that dash is
inside an error message, so the live wording differs by one character from the file.
Cosmetic, nothing reads past it, and fixing it means another migration on your shared
project for a punctuation mark — so it is written down rather than changed. Today's
apply did not do it: all five functions I touched match the file exactly.

**What it took to prove, and the numbers.** 185 checks against a real PostgreSQL 16.13
— up from 125 — including the exact scenario you described: a paused holder, its lease
expired, a replacement claimed through a duplicate delivery while the sweeper would
still have refused to offer the run. The old holder's write fails, the replacement's is
stored, and the log holds the replacement's entry. It also measures the before/after on
the revoked permission in BOTH directions on the same database: with the old grant a
direct insert lands, and with it revoked the same statement is refused by name. 229 unit
tests. 67 checks through the same verification script an operator points at the
deployment, run unmodified against a local PostgreSQL with two consumer processes. The
code sweep took three passes to come clean — 8 survivors, then 5, then 0 — and none of
the eight was the product: one was dead code I deleted, one mutant was badly written,
one needed a test at the layer where the answer is first read, and five are redundancies
the fence created, now written down in the code so the next reader does not delete them.
Your other product's suite still reads 6,316 tests, 6,314 passing, 0 failures.

**One thing is honestly unfinished, and it is about my coverage rather than the code.**
The SQL sweep's first pass found four gaps — all of them in the CHECK file, none in the
schema — and I fixed all four; the schema check went from 177 to 185 checks doing it. The
second pass, which would confirm those four fixes actually catch their breakages, was
stopped at 10 of 67 so I could commit and deploy. I will finish it and report the number
rather than leave the old one standing.

---

## 2026-09-15 — the sweep finished, and a defect in my own reporting

**The SQL sweep is done and it is clean: 64 breakages, 64 caught, none that failed to
apply, and the three comment-only controls survived as they must.** The code sweep was
re-run for today's change and reads **202 breakages, 202 caught, 0 survived, 4 controls**;
the suite is **233 tests, 0 failures**, and the verification script itself passes **69
checks** end to end against a local database with two consumer processes. That closes the
honestly-unfinished item above — the four gaps the first pass found were in my check
file, not in your schema, and this pass confirms the fixes for them really do catch
their breakages. The migration files are back exactly as committed, checked against git
rather than by eye, and every one of the sweep's 67 anchors is present exactly once.

**Then I found something wrong with the run I had just reported to you as verified.**
Not with the Worker — with my ability to say WHICH Worker I had verified. The deploy
printed version `e3bdf22e…`; the Worker has actually been serving `64ac3bb4…` since that
run. The reason is a small fact nobody had measured: **uploading the runtime secret
creates a version of its own, and prints no id at all.** So the id my report quoted was
never the one serving, and the id that was serving appeared in no log.

Worse, the check that was supposed to catch this could not. It asked `/health` once, two
seconds after the upload, and got the version from the deploy *before* last — which is a
truthful answer from an edge that had not picked the new one up yet. The verification
printed it. **Printing a version reads exactly like verifying one**, and 69 checks passed
underneath it.

**What I changed.** The deploy run now ends with a deploy rather than a secret upload, so
it finishes holding one version id printed by the step that made it; `/health` is then
asked repeatedly until it answers *that* id, and the run fails if it never does — `ok:
true` is not accepted as a substitute, because the previous deployment answers `ok: true`
just as truthfully. The verification asserts the id instead of echoing it, and says so
out loud when it has no id to hold anything to. `/health` also forbids caching now, which
rules out the other explanation for a stale answer rather than fixing the propagation
one.

**The sweep caught me out, and that part is worth telling you.** Five of its breakages
survived — every one of them in a guard I had written minutes earlier for this very
change. One accepted a renamed step because it matched part of a name rather than the
whole of it; one accepted a loop that runs exactly once; two survived because I was
READING the verification script instead of RUNNING it, so a check quietly rewired to
always pass still looked right in the source; and one of my own breakages turned out to
change nothing at all, which is not a test gap but a badly written test of a test. All
five are fixed and the pass after them is clean — and the lesson is that a guard written
in the same sitting as the change inherits the same blind spots. The sweep is the only
thing that reads it as an opponent.

**And the workflow now has a guard, which it never had.** That is the gap that let this
ship: nothing in the test suite had ever read the deploy file, so a step could stop
checking and no run would go red. The guard asserts the order of the steps, that nothing
touches the Worker after the version is minted, that the id reaches both the wait and the
verification, and that a run which never sees its version fails.

**The fence itself, measured on the deployment rather than described.** I read the rows
out of your live project — the same check, the same agent, before and after:

| | run | what the displaced worker wrote |
|---|---|---|
| before | `4d3c4d0d…` | 8 entries — 4 model answers, 3 tool results, up to step 4, over the 32 seconds AFTER its lease was taken away |
| after | `1ec246d9…` | 2 entries — 1 model answer, 0 tool results, step 1. It stopped at the first checkpoint |

Both runs end the same way on purpose: still `running`, no stop written, one tool call
left pending. That is the rule you asked for — an action that may already have gone out
is not repeated automatically. What the fence removed is the three extra model answers
and three tool results the old worker used to add to a run it no longer held.

**And the deployed Worker is provably using the new database functions, from a privilege
rather than from a version number.** The service key has no INSERT permission on the
journal table at all now; the three completed runs of that deployment hold 19 entries
each. Rows in a table the caller cannot write to can only have got there through the
fenced function.

**It is deployed and verified, and the fix caught the problem happening again on its own
run.** That run produced THREE versions of the Worker in seven seconds — one from the
deploy, one from the secret upload that no tool ever printed, and one from the new final
deploy. The check asked `/health`, got the invisible middle one first (answering
perfectly healthily), refused it because it was not the id this run had made, waited ten
seconds and got the right one. The old check would have stopped at the first answer and
reported the wrong version for the third deploy in a row.

Live now: **version `47e5e88a-6f1e-4f76-ad61-615eaf2f9b91`**, from commit `3344755`,
Actions run 34941653115 — green, **71 checks passed, 0 failed**, the throwaway customer
deleted and no verification data left behind.

**What none of this changes:** the fence itself, which was the milestone, and the
distinction it rests on. Database fencing stops a displaced worker writing to the log; it
cannot recall an external action already sent, and an uncertain non-repeatable action
stays blocked from automatic replay. The stand-in model is still the only model this
deploys with.

---

## 2026-09-15 — merging, and what the merge caught

**I did not merge on the first attempt, and I am glad.** Your two products share exactly
one thing: the `.github/workflows/` directory. When I built the merge and ran the SITE
BUILDER's test suite against it, one test went red — a guard the other side wrote for its
own repair workflows, reading my agent deploy file, which did not exist when that guard was
written. **It was right, and it found a real bug in mine.**

The bug: my deploy step asks Cloudflare "does this queue exist?" and reads the answer's
exit status. It pipes that answer into a log file at the same time — and in the shell
GitHub uses by default, a pipeline's status is the LAST thing in it, which was the log
writer, which always succeeds. So the check could not fail. It has been printing "QUEUE
OK" on every run; that answer was true, but it was never evidence. Fixed by naming the
shell explicitly, which I measured both ways rather than taking on faith.

Fixing it exposed a second one underneath: with the stricter shell, a search that finds
nothing kills the step outright — so the message that would have told you "the deploy
printed no version id" could never be reached. Both are fixed, and this product now carries
its own copy of both checks, because the other side's guard only exists on main and would
not have caught a later change to my file until the next merge.

**What the merge itself does to the site builder: nothing it can see.** All 52 paths are
additions — not one of the other session's files is modified, moved or deleted; the two
sides changed zero files in common, even though 29 commits arrived on main while I worked.
The container image is not rebuilt (the Dockerfile copies named paths, and none of mine are
among them) and `worker.js` and `public/` are unchanged, so the deploy this merge triggers
re-uploads the same site-builder code it already had.

**The lesson worth keeping:** "no overlapping files" is not the same as "safe to merge".
Running the other product's whole suite on the merged tree is the only place a check from
one side can read the other side's work — and it is what stopped me shipping this.

**Merged, and it rolled nothing — measured, not assumed.** `main` is `bd6bf98`. The deploy
the merge triggered took **45 seconds**: the build container's image was **reused** (the
registry answered 200 to the unchanged tag), the container itself reported **no changes**,
and there were **no asset uploads**. The site builder's own deploy three hours earlier is
the control — it built a new image, rolled the container and uploaded a changed file, which
is what those lines look like when something really moves. `gofarther.dev` answers 200, and
every binding came back.

**One thing I found in that log which is yours to decide on, and it is not from my merge.**
Your site builder's deploy prints `QUEUE NOT CONFIRMED — do NOT add a queue binding until
this line reads OK` on every run, while that queue binding is live and working in the same
log. It is the identical bug to the one in mine: the step matches Cloudflare's WORDING
("created queue|already exists") and Cloudflare now says "is already taken". I checked it
predates my work — that line was last changed on 13 September and my merge does not touch
that file at all. It does not break the deploy, because that step prints and carries on by
design. But the message is always wrong now, and it tells whoever reads it not to do
something that is already done. I have not touched it; say the word and I will fix it the
same way I fixed mine.


---

## The engine runs a customer's own agent now (2026-09-16)

The piece that was missing: an agent somebody wrote in the browser had nowhere to go.
Now a message to one saves AND starts a run, the existing queue and runner execute it
exactly as they execute anything else, and the answer comes back into the conversation.

**The division is the whole design, and it is worth stating plainly: the customer owns
the INSTRUCTIONS and the conversation, and this codebase owns everything else.** The
tools, the limits and the model are code in `agents.mjs`. A request can name an agent;
it can never describe one. What the customer writes is data, and a run carries a COPY
of it in its own first journal entry — so editing an agent changes the next run and
never one already accepted.

**One transaction, and the app cannot decide anything in it.** The function takes six
arguments and not one of them is structured — no entry, no model, no bound, no history.
The first version took the whole journal entry as an argument and merged the important
parts over it, which still left a caller choosing the bounds. There is nothing left to
choose now.

**A guard caught a real defect before it shipped, and it is the kind that would have
looked like a feature working.** I first gave the customer-facing agent `toolCalls: 0`,
meaning "and no budget to call one either". `toolCalls` is a run TOTAL, and the loop
stops a run whose total is spent — at the start that is `0 >= 0`, so every
customer-authored run would have stopped before its first model call, reported as a
limit doing its job. The empty tool list is the real wall; the bound is now one, and it
is written down that it is not a second wall.

**What I checked**: 256 unit tests, 344 database checks on a real PostgreSQL 16, 65
deliberate breakages in the code all caught, and the whole flow end to end — the site
builder's route, this database, this queue, this runner — **58 checks, nothing failed.**

**What is still simulated**: the model, and only the model. The stand-in answers and
labels itself as one, in its own text and in the screen's chrome, and both labels read
which model really ran so a real provider stops them automatically.

**What is not done**: nothing is applied, deployed or merged. And when the site builder
accepts a run, nothing rings this Worker's queue — the two are separate Workers — so the
sweeper picks it up on its own minute-by-minute cron. That is correct and slow; a
doorbell is the obvious next piece.

## An operation's identity is its position AND its arguments (2026-09-17)

This was the "make actions safe across retries and interruptions" milestone. It turned up
**four real defects**, every one reproduced before it was fixed, and none of them visible
by reading the code.

**1. A resumed call ran with another call's arguments.** When a process dies between a
tool call and the write that records its answer, the run resumes and finishes that call.
It was finding the call's arguments by the call's *id* — and a model is not obliged to give
one. With two ids missing, both calls got the FIRST one's arguments. Measured: an agent
asked to remember one thing and forget another, interrupted, resumed — and it forgot the
thing it had just been told to keep, while the thing it was asked to forget was untouched.
For a call waiting on your approval it failed the safe way instead, but "safe" there means
the call you approved can never run.

The fix is not a repair, it is a rearrangement: the arguments now travel with the call
from the moment it is recorded, so there is no later lookup left to get wrong.

**2. The fingerprint an approval is bound to did not survive being written down.** An
approval is tied to the exact arguments you saw, by a hash. Two objects that print
identically — because JSON is what prints them — hashed differently once one had been
through the database. So an approval could be asked about one fingerprint and re-read at
another, and a call you really did approve would be refused for ever. Fixed by taking the
fingerprint of the arguments *as they will be stored*, which is the only form anybody ever
sees.

**3. An unreadable record was counted as four tool calls that never existed.** A stored
list that is not a list came back as four pending calls and four calls on the meter, with
nothing reporting a problem — in the one function whose job is to report problems. It says
so now and invents nothing.

**4. Starting the same automation twice raised an error instead of saying "already
running".** When an agent starts one of your automations, it derives the work's identity
from the call so that a redelivery asks for the same piece of work rather than making a
second one. The database refused the second ask with a key violation instead of absorbing
it — so no duplicate was ever possible, but a redelivery came back as a FAILURE about work
that is queued and will run. Measured on a real PostgreSQL, fixed, and proved both ways.

**And there is a new third answer: "unresolved".** "It failed" and "nobody knows whether it
happened" are different facts and they want opposite next moves — one invites trying again,
the other invites checking first. A tool that only reads cannot be unresolved; one that
writes can, and it now says so to the model in words rather than in a field nobody reads.
Which tools write is derived by driving each one and watching what it touches, not by a
label somebody could forget.

**One thing worth knowing about my own tooling.** Eight of the deliberate-breakage checks
for the database had been aimed at an older copy of a function that a later migration
replaces — so they were testing dead code, and their passing meant nothing. Nobody noticed
because that sweep had not been run since the copy moved. The generator asks now, and it
took three attempts to get the question right; the first two reported correct checks as
broken, and the third was a check that could not fail at all.

**Measured**: the engine suite 402, the real-PostgreSQL checks 633, and the tools
demonstration 78 — all green. The three other demonstrations (70, 125, 112) and the site
builder's own 6,791 are unchanged, which is how I know this round moved nothing else. The
deliberate-breakage sweep is **394 of 394 caught**, with all six do-nothing controls
surviving.

**And that sweep is the part worth telling you about.** Its first pass caught 383 of 394
and let **eleven** through — every one of them in this round's own work, and eight of them
the same hole: the thing this milestone is *about* had no small test at all. It was proved
by the end-to-end demonstration, which the breakage sweep does not run, so no breakage
could be caught by it. Seven new tests close them and the second pass caught everything.
Two of the eleven turned out to be breakages that had quietly stopped breaking anything;
both are replaced with ones that do.

I also made two process mistakes worth naming, since both are written down in this
directory as things not to do. I started the first sweep in a way that let it be orphaned
half way through, which left one deliberate breakage sitting in the working files — caught
immediately, restored, and verified — and I piped that run's output in a way that nearly
lost the list of what got through. Neither reached anything committed.

**Nothing is applied, deployed or merged.**

---

## 2026-09-17 — a header that was wrong on ten of fourteen calls, and a stand-in that could not see it

You asked me to carry on with the agent's backend and gave me nine things. **This is the
first, and it is the one that was already broken.**

**What was wrong.** When our engine asks the database to run one of its functions, it has to
say which part of the database to look in. That instruction goes in a header, and there are
two of them — one for reading, one for writing. **Ten of our fourteen agent operations used
the reading one, and every single one of those calls is technically a write as far as the
database's front door is concerned.** So the header was ignored, no part of the database was
named, and on the real thing those calls would have been told "no such function". Two of the
affected ones were the checks that run FIRST when an agent pauses or starts an automation,
so both of those would have failed before doing anything.

**Why nobody noticed.** Our local stand-in for the database's front door **read the address
and threw the headers away**. So our end-to-end demonstration passed all 78 of its checks
over code that could not have worked. That is the third time this has happened to us in this
product, and it is always the same shape: *a stand-in that is more forgiving than the real
thing hides a bug exactly as well as one that is less capable.*

**What I changed.**

- **One rule, in one place, and all five of our database-talking modules ask it.** It was
  decided separately in each of them, behind a flag named for what the *function* does rather
  than for what the *request* is — which is why it kept being got wrong. There is nothing left
  for anybody to remember.
- **The stand-in now enforces the rule**, in the database's own words and error codes, so a
  wrong header fails on my laptop instead of in production. I checked it refuses the six ways
  it should and lets the two correct cases through — because a gate that refuses *everything*
  would have passed all my checks about it refusing.
- **The demonstration now proves this itself**, rather than relying on me having set the
  stand-in up right: it counts how many requests the gate turned away across the whole run
  (zero), then deliberately sends one bad request to show the gate is actually switched on in
  that very run.

**Two things found on the way, both worth telling you.**

1. **Two of the five modules used the new rule without importing it** — which still *loads*
   fine and then fails on the first real request. Our small tests caught it immediately: 89 of
   them went red. The demonstration only reported "a run failed". That is the small tests
   earning their keep on a class of bug the big one is bad at.
2. **Two numbers in last milestone's notes were wrong, and low.** I wrote down the test counts
   and then added seven more tests to close the sweep's findings, and never re-took the
   measurement — which is the one rule at the top of my own notes. The real numbers are 402
   tests and 633 database checks, not 395 and 632. I have corrected them where they were
   written and said why, rather than quietly editing the figures.

**Everything still green**: 408 small tests, 633 database checks, and all four end-to-end
demonstrations (82 / 112 / 70 / 125 checks) — the three unchanged counts being the proof that
this round broke nothing, and worth more than before because they now run against a stand-in
that refuses a header it used to ignore.

**Nothing is applied, deployed or merged. Still no model, still your call, still last.**

---

## 2026-09-17 — a retry that overwrote somebody's correction

**Second of the nine. This one was a real bug with real consequences, and I reproduced it
before writing a line of the fix.**

**What went wrong.** An agent is told to remember something — say the tone to write in.
It saves it. Then the process it was running in dies before it can record *that it saved
it* — which happens: a deploy, an eviction, a lost connection. Meanwhile you notice the
tone is wrong and change it yourself. The interrupted work then comes back, sees an
unfinished job, does it again — **and your correction is gone.** Worse, it reported
"changed it" while doing so, and nothing was reading that.

The reasoning behind it was that saving the same fact twice leaves the same result. That is
true if nothing happens in between. It is not true when somebody else can write.

**What I built.** The backend now keeps a **record of every action it takes on your
behalf**: which action, what it was asked with, and what happened. A repeat of the same
action is answered from that record — the work is *not done again* — and the answer says
plainly that it is a repeat, so the agent knows the current state may have moved on. The
record and the action are saved together, in one go, so there is never a moment where the
work happened and nothing knows about it.

**And using one action's slot for a different request is refused**, not quietly turned into
a second action. That matters: "do this again" and "do something else instead" arrive
looking identical, and treating the second as the first is how work gets done nobody asked
for.

**Six things can be repeated safely now**: remembering, forgetting, turning an automation
on or off, creating one, editing one, and starting one.

**What I checked, and it is all through the real thing** — your own screen's routes, a real
database, the real dispatcher, the real tools:

- your correction survives the retry, and the retry says so;
- **deleting and re-creating**: an agent forgets something, you write it again, the stale
  forget comes back — and what you wrote is still there;
- **two deliveries at once**: the fact is written once, both are answered, they agree;
- **a restart**: a completely fresh connection with no memory of anything still recognises
  the repeat, which is how I know the record is in the database and not in a variable;
- **end to end**: a real message through the queue leaves a record stamped with that run.

53 checks in a new demonstration, 24 more in the database checks, three more small tests.
Everything else unchanged and green, which is how I know nothing else broke.

**⚠ And the concurrency check found a second bug in my own fix**, which is why it was worth
writing: two attempts arriving at the same instant, and the *underlying* save refused one of
them with a database error instead of giving it the other's answer. The record decides what
any failure was now — somebody else's win, or a real problem that must not be swallowed.

**Five smaller mistakes of mine on the way**, all caught and all recorded: I hardcoded an
agent's id where the route mints its own (every check failed for a reason that had nothing to
do with the feature, while the check above them passed because it only asked for a 200); a
type mistake Postgres refused outright; a parameter name colliding with one already there;
**a test harness of mine that truncated its own input and then reported the migrations as
broken**; and two breakage-sweep targets that matched six places instead of one.

**Nothing is applied, deployed or merged. Still no model, still your call, still last.**

---

## 2026-09-17 — an agent can write an automation now, and you approve every one

**Third of the nine.** An agent could read its automations, turn them on and off and start
them. It could not WRITE one. Now it can, and four things make that safe.

**It gets the real list of actions.** Not a description I wrote for it — the platform's own
list, the same nine your form draws from, with each one's fields and the limit on how many
steps an automation may have. A step it invents is not a step, and nothing it reads or
remembers can add one.

**It can check a workflow before saving it.** That check is free, changes nothing, and can be
run as many times as it needs. It uses **exactly the same validator your own screen's Save
button goes through** — so "it passed the check" and "it will save" are the same statement. If
something is wrong it gets your validator's own sentence back, which is what lets it fix it
rather than guess.

**What reaches the database is the validator's output, never the agent's list.** That sounds
like a detail and it is the whole thing: a check that happens *beside* the save rather than in
*front* of it is how unchecked data gets in with a tick beside it.

**And you approve every create and every change, every time.** I want to be plain about a
trade here. The obvious design is to ask you only when the automation is actually switched on —
but "is it switched on" comes from the agent's own request, so an agent could save a switched-off
one without asking and then switch it on. **A gate the agent can step around is not a gate**, so
both are gated, always. The cost is that you will be asked about drafts too.

**What it still cannot decide**: the time zone (that is yours — an agent choosing it would make
"every morning at nine" mean nine somewhere nobody lives), the identity of the automation it is
writing, and the step limit.

**Checked end to end**: 112 checks in the tools demonstration — the catalog read both directly
and by a real model through a real message, a bad reference and an unbalanced branch refused
with your validator's words, a save whose row I read back to confirm it holds the *validated*
steps, a bad save that wrote nothing at all, a replacement, another agent's automation refused,
the same create sent twice becoming one automation, and a create through the real loop stopping
for approval and only running after it.

**⚠ And the breakage sweep found eight gaps in LAST round's work**, every one of them a
property I had proved end to end and not in a small test — which means no deliberate breakage
could be caught by it. Seven are closed with new tests; the eighth turned out to be a breakage
that changes nothing, and I measured that rather than hunting it, and wrote down which line is
a deliberate second wall so nobody deletes it later.

**Nothing is applied, deployed or merged. Still no model, still your call, still last.**

## 2026-09-18 — five more milestones, and the ones my own tests could not see

Catching this log up. Five rounds landed since the last entry and each is written up in full in
`agent-builder/CLAUDE.md`; here is what changed for you and what it cost.

**Approvals now close, can be taken back, and a run can be stopped.** An approval request
expires after 24 hours — a window the server owns, not something a caller can widen — and when
one closes, the run that was waiting is put back on the queue rather than sitting there for
ever. You can withdraw a permission from an agent *while a run is going*, which is deliberately
a different act from unticking a tool in its settings: the tick decides what the NEXT run may
do, because a run that loses a tool half way through is a run whose plan no longer works;
withdrawing says *stop doing this now* and is read live on every delivery. And you can cancel a
run: pending work stops, waits are released, and it records what had already finished. **It
does not claim to undo anything that already happened**, and I was careful never to write a
sentence that implies it did.

**A stranded run no longer reads as "working".** This was the honest gap I had written down
myself and not fixed. A run waiting for you, a run genuinely thinking, and a run nothing will
ever pick up again all showed the same word. There are seven states on the wire now —
queued, working, waiting, unresolved, answered, cancelled, completed — and a run that somebody
stopped reads `cancelled` rather than `failed`, because nothing went wrong: you asked.

**Workflows got richer.** Typed values, so a list handed to a box that wants a sentence is
refused while it is still your form rather than turning into nonsense when it runs; bounded
loops whose progress survives a restart; subworkflows, which are copied in at the moment they
are used and stamped with the version they came from; explicit error paths (stop, carry on, or
try again a bounded number of times); and I proved a restart *inside* a loop, a branch and a
subworkflow resumes without doing completed work twice.

**Triggers: one-off and weekly schedules, an inbound endpoint, and internal events.** The
endpoint is signed — the account comes from the endpoint I verified, never from anything in the
payload — and its secret is answered exactly once, when you create it, because a second way to
read one out is a second way to leak it. There is no rotate button for that reason; delete it
and make another.

**Reference material and memory: bounded, isolated, and honest about deletion.** This is the
one I want to be precise about, because it is easy to say the wrong thing. **Forgetting a
memory reaches one place: what a NEW run will be built from.** A run already under way keeps
what it was started with, and the journal keeps what it quoted. That is on purpose — a run
executes what it was accepted with — so I do not say "erased", I say what it reaches, and the
answer carries that in its own words as well as in its fields.

### The three things worth telling you about, because each was my own mistake

**A retry could destroy the connection it was retrying.** Found today, driving the new
credential storage on a real database rather than reading it. Storing a connection replaces any
live one for the same account — right — but it did not exclude *the row the retry is about*, so
pressing once and then again answered *"already connected"* and left the connection dead and
unusable. One clause. It is now reproduced in the checks, and the check asserts the connection
is still usable afterwards rather than just that the answer said "already", which is what let
it through the first time.

**One of my own checks was green over a broken view.** It asked "does the owner read a count
that is not zero" — and a read that is *refused* answers nothing at all, which is also not
zero. The underlying problem was real: the list view runs as whoever is reading it, so it
needed a grant I had deliberately left out, and with no grant nobody could read their
connections at all. Fixed both: the grant names every column except the two credentials, and
whether a connection *can* be refreshed is now a column of its own so that answering it never
requires reading the credential.

**And a guard of mine asserted a rule I then changed on purpose.** A check demanded the
database refuse an operation record with no outcome. That was right while every such record was
written in one go — and wrong the moment something has to say *"sent, and I do not yet know what
happened"*, which is exactly what a provider with no retry protection needs. So the record can
say that now, it is named rather than read as an answer, and it can only ever be filled in
once. I replaced the check rather than deleting it, and wrote down which property it is really
about.

**Measured:** 967 checks against a real PostgreSQL, 0 failed. The breakage sweep over the
engine came back 568 of 568 caught, clean on the first pass. The seven end-to-end
demonstrations are all still green at their recorded counts, which is how I know none of this
broke anything already working.

**Nothing is applied, deployed or merged, no model is connected, and no real outside account is
touched — the credential work runs against a fake provider that says so in its own name.** The
connection and action work is half built: the storage is done and proved, the engine side is
next.

## 2026-09-18 — an agent can act on something outside now, and it asks you first

The last of the nine. An agent can be connected to an outside account and act through it: read
what is there, and send something once you have approved it. **Nothing real is connected and
nothing can be** — the only provider this can talk to is a fake one called `fakemail` that says
so in its own name and in every answer it gives, and nothing it does leaves the process.

**You make a connection; the agent only ever uses one.** Storing a credential is not something
any tool can do, deliberately: an agent that could store one could store one it made up. So
connecting stays your act, and what the agent gets is permission to use what you connected.

**The credential has exactly one door.** One database function hands it out, one module calls
that function, and it lives and dies inside a single call. It is not in any list, any answer, any
error message, any log, or the run's own permanent journal — I check that with a made-up
credential and then search every one of those places for it. The screen reads a view that has no
credential column at all, so there is nothing there for a future change to accidentally expose;
whether a connection *can* be refreshed is a separate column, precisely so that answering that
question never requires reading the secret.

**Four states, because each one needs different words from you.** Usable; expired, which a
refresh fixes; revoked, which means the provider withdrew it and only they can put it back; and
disconnected, which means you took it away. A refresh cannot revive the last two — otherwise the
engine could put back something you removed. And a disconnect or a revocation *destroys* the
credential rather than flagging it: a row that still holds one is a row a bug can still use.

**And the hard part, which is the part I want to explain properly.** The fake provider has no way
to tell a repeat from a new request — which is true of plenty of real ones. So if we send
something and then don't hear back, we genuinely do not know whether it went out. **Sending again
would be the obvious thing and it is the wrong thing**: it might be a second message to somebody.
What happens instead is that we *ask the provider what it already has*, using a marker we put in
the message that is the same on every retry. Three answers, and none of them sends anything: it
already happened, so we record that; it definitely did not, so we say so plainly and you or the
agent can ask again; or nobody can tell, in which case the answer is *"it may or may not have
gone out — check before asking again, because asking again could do it twice."* That last one is
not a failure and I am careful never to word it as one.

### Three things worth telling you about, all my own mistakes

**A retry could destroy the connection it was retrying.** Storing a connection replaces any live
one for the same account — right — but it did not exclude *the row the retry is about*. So
pressing once and then again answered "already connected" and left the connection dead. One
clause. Found by driving it on a real database, not by reading it.

**And my fake provider could not produce the one situation this whole design is for.** It gave up
*before* storing the message, so "we didn't hear back" always meant "nothing happened" — and
every check I thought was about a lost answer was quietly about a request that never arrived. It
has a fifth behaviour now: the message really lands and the answer never comes. From our side the
two look identical, which is the point; the only thing that can tell them apart is asking the
provider.

**And one commit of mine left your website builder's tests red.** The engine gained three tools
and the builder's own list of tools-you-can-tick did not, so ticking one would have said "this
platform has no tool called that". A check that compares the two lists caught it — I had only run
the engine's tests, which is the rule I already know: *a change to a list both sides hold puts
both sides' tests in scope.*

### And then I read the sending code again, and found three more things wrong with it

All three only happen when something goes wrong at the wrong moment — which is why the
demonstration was green and every test passed. I reproduced each one before fixing it.

**A bug in the sending code was treated as proof the message had not gone.** If the part that
talks to the provider crashed in a way it did not recognise — an ordinary programming error — we
recorded "this did not happen" and never asked the provider again. So a message that really went
out would be lost to us for good, because of a crash on our side. We now treat anything we
cannot classify as *we do not know*, which costs one question to the provider and saves the
message.

**We wrote our own note of what happened and never checked the note landed.** The send was fine;
what was missing is that a failed note said nothing to anybody. It now rides on the answer, in
its own field, so it cannot be mistaken for something being wrong with the message itself.

**And the worst of the three: a hiccup writing that note reported the message as FAILED.** The
message had gone out. The note could not be written. The error escaped, and the agent was told
the send failed — so its next move is to send it again. That is the exact duplicate this whole
design exists to prevent, caused by our own bookkeeping rather than by the provider. Writing the
note can no longer change what we say about the message.

**One more thing worth telling you, because it is about how I check my own work.** The mutation
test for the first of these was pinned to the broken line — it *required* the bug to be there.
That is a test asserting a defect as correct, which I have hit before in this project, and it is
why I re-anchor those on the property rather than on the exact words.

### What is honest to say about where this leaves you

**There is no screen for making a connection yet.** The three tools are tickable, and with
nothing connected they truthfully say "this agent is not connected to anything yet" — so nothing
lies, but nothing is usable either until that screen exists. I have pinned the wording so it
cannot drift into implying the agent can connect something itself.

**Measured:** 967 checks against a real PostgreSQL, 0 failed. **65** checks in the new
demonstration, which goes through your own routes, the real queue, the real approval step and a
real database — the four extra ask the database itself what it answers when somebody has already
recorded an outcome, rather than my taking my own word for it. The engine's own tests are 555, 0
failed. The other six demonstrations are all still green at exactly their previous counts, which
is how I know none of this disturbed what was already working.

**And the mutation sweep of the engine came back clean first time: 597 deliberate breakages, all
597 caught.** It ran against the code as it stood *before* those last three fixes, which I am
saying rather than letting a clean number read as covering them — the three have their own
checks, each proved to go red against the bug it forbids, and the nine mutation tests around
them were run on their own and all nine caught. The database sweep is still running.

**Nothing is applied, deployed or merged, no model is connected, no real account is touched, and
no credential of anybody's exists anywhere in this work.**
