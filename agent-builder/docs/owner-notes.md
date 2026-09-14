# Agent builder — owner notes

Kept separate from `docs/owner-notes.md` at the repository root, which is the
**website builder's** log. Nothing in this file is about that product and nothing
in that file governs this one.

---

## 2026-09-14 — Session start: what you said, and the one thing I read into it

You said this session is for building an **AI agent builder**, that it is
**mostly backend**, that it has **nothing to do with the website builder**, and
not to mix it with `main` or with other sessions.

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

### Nothing can reach the website builder, and I measured that rather than hoping

A push to this branch runs the website builder's CI, so "don't mix" had to be
made true rather than assumed. What I found:

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
  is enforced in code**, because your own rule from the other product is that a
  cap the model is only told about is not a cap.
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

I got something wrong and the tests caught it. I had copied a rule from the
website builder — that a caller may only ever *lower* a limit, never raise one —
**without its reason.** Over there that rule exists because every other number
is worked out from the limit when the code starts, so a bigger number would
break all of them. Nothing here works that way.

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
controls that correctly survived. And the website builder's own suite still
reads **6,316 passing, 0 failing** with this folder in the tree — the same
numbers as before it existed, so "it can't touch your other product" is
measured rather than reasoned.

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
  string is how a secret ends up in a transcript — the website builder already
  has a scrubber for exactly that and this has nothing.
