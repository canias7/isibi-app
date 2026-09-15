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
