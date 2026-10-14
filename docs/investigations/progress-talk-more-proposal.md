# Proposal: the builder talks more while it works (2026-10-13)

**Status: a proposal for the owner's review with Codex. Nothing is built,
merged, deployed, switched on or spent.** Written on branch `new`.

## What the owner asked

> *"i still dont think that it talks evrything back to user , i want to talk
> more , get me ? like literally everything is doing and thinking"*

Then: all five suggestions below, written down for review before anything
is started.

## What it does today

- **When it speaks.** A running edit or add-on records a milestone at a
  handful of fixed points (`progress.mark(stage, facts)` in `worker.js`,
  `makeProgress`; 44 call sites across stages such as `plan`, `picked`,
  `designed`, `pages`, `photos`, `publish`). Each milestone asks a model to
  write **one** update from the facts recorded since the last one
  (`builder/site-progress.mjs`, `PROGRESS_SYSTEM`, `writeProgress`).
- **How much.** *"Keep it short, usually a sentence or two"*; at most 8
  updates per task (`PROGRESS_LINES_PER_TASK`); 1,000 output tokens
  (`PROGRESS_MAX_TOKENS`).
- **What it may say.** Only what the facts say, each in its true state; never
  "published", "live" or "finished"; never steps, tools, files, code, models
  or ids; never repeat an earlier update.
- **What it never shows.** The editing model's own reasoning. The customer
  sees results of steps, not the thinking behind them.
- **Where it shows.** One task: every update so far, stacked where
  "Thinking" was (since `adacb5b`). Several tasks: under each task in the
  request's card. When it ends: kept, grey, above the final reply.
- **Who pays.** Each update is a model call the platform absorbs; the
  customer is not charged for narration (2026-10-06 release).
- **Switch.** `PROGRESS_REPLIES` (on since deploy 2186/2187).

Typical result today: 2–4 updates for a task.

## The five options

Each is independent; they can ship together or one at a time.

### 1. Say the plan before starting

**What the customer sees**, before any work:
> *"Okay, here's my plan: I'll find the Gallery heading, change the wording,
> check nothing else on the page moved, and then publish it."*

**How.** One more model call at the job's start, from what the router and
the step picker already decided (the layer, the target page, the parts of
the request). A new first milestone, `plan-said`, through the same writer,
record, lease and queue as the other lines.

**Cost.** One small call per task (about the size of one update today).

**Risks.**
- The plan can promise a step that later fails or is skipped. It must be
  worded as intent ("I'll…"), and the final reply stays the authority on
  what happened.
- For a multi-task message the card already names every task; the plan line
  should cover the order and the waiting, not repeat the names.

### 2. Speak at many more moments

**What the customer sees** (5–15 updates instead of 2–4):
> *"I'm looking at your Gallery page." → "I found the heading at the top." →
> "I've written the new wording." → "I'm checking the page still builds." →
> "I'm checking nothing else on the page changed." → "It looks right in the
> preview." → "I'm publishing it now." → "It's live."*

**How.** More `mark()` calls at points the job already passes: reading the
site, the picker's choice, each file written, the compile check, the
preservation checks (`page-keep`, `page-prose`), the render check,
publication, and the live read. Each new milestone needs its own facts with
true states, so a line can never claim a check that did not run.

**Cost.** Each milestone is a model call: roughly 3–4 times today's
narration per task. Needs a measured number from one live run before it is
promised (owner's rule: measure calls, never promise a count).

**Risks.**
- **Latency.** Lines are written in the background and never hold the job,
  but more of them arrive late. The existing late-line rule (no line after
  the final reply) still applies.
- **Noise.** Fast steps (a wording change) would produce a burst of lines in
  a few seconds. One option: merge milestones that land within a few seconds
  of each other into one call.
- `PROGRESS_LINES_PER_TASK` (8) must rise, e.g. to 20.

### 3. Longer, chattier updates

**What the customer sees:**
> *"I'm putting the new picture at the top of the gallery, because that's
> where your other photos start, so it'll be the first thing people see."*

**How.** Instructions only: "a few sentences, and say why when the facts
give a reason". The facts must carry the reason (the picker's own stated
reason, the designer's choice) or the model will invent one; that wiring is
the real work.

**Cost.** Slightly more output per call. `PROGRESS_MAX_TOKENS` (1,000) is
enough.

**Risks.**
- **Invented reasons.** The single biggest risk. A "because…" with no fact
  behind it is a claim the code never checked. The rule should be: a reason
  only when a fact states one.
- `PROGRESS_SYSTEM` is held under 2,000 characters by a test; the new rule
  must fit or the limit must be reviewed (owner: concise instructions, no
  arbitrary limits).

### 4. Show its thinking, ChatGPT style

**What the customer sees**: under each task, a **"Thinking…"** block that
fills in live while the model works, then folds to **"Thought for 12s"**.
Opening it shows everything it considered:
> *"They want the heading changed only on the Gallery page. There are two
> headings there; the big one at the top says 'Gallery', so that's the one.
> I'll keep the same size and font and only change the words…"*

**How.**
- Ask the editing model to return its reasoning (provider support must be
  checked: the default builder model is `grok-4.6`, `DEFAULT_PICKER`;
  Sonnet and Opus can return a thinking summary).
- Stream it into the job's progress record as a separate field, not as
  lines, and draw it as a collapsible block in `public/chat.js`, the same
  look in a single task and in a card.
- **Recommended: a cleaned summary, not the raw text.** Raw reasoning names
  files, code and components, which the current rules keep from the
  customer, and it weighs options the job then does not take.

**Cost.** Depends on the provider. Reasoning tokens are billed as output;
a summary pass adds one small call per task.

**Risks.**
- **It conflicts with the owner's grounding rule** (2026-10-10): every line
  states only what really happened. Thinking includes ideas that are then
  dropped. It must be visibly labelled as thinking and kept apart from the
  updates and the final reply.
- **Leaks.** Raw reasoning can contain the site's code, internal names, or
  instructions text. The summary step must strip those; a test must prove it.
- **Provider gaps.** If the chosen model returns no reasoning, the block
  must not appear at all (never a fake "thinking").

### 5. A fuller final message

**What the customer sees**, at the end:
> *"Done. I changed the Gallery heading to 'Photographs from our ovens'. I
> checked the rest of the page and nothing else moved, it still builds, and
> it's live now. If you want it back the way it was, say 'undo'."*

**How.** `builder/site-reply.mjs`: the facts already carry what was done,
what was checked (`page-keep`, preservation, publish, live read) and how to
undo. Today `REPLY_SYSTEM` says to explain every fact; this adds "and what
was checked", which needs the checks passed in as facts where they are not
yet.

**Cost.** Slightly longer replies; same single call (`REPLY_MAX_TOKENS`
2,000 is enough).

**Risks.** Low. The reply already may not claim anything no fact states.
Switched by `MODEL_REPLIES`.

## Recommendation

**Start with 1 + 2 + 4**, and add 5 (low risk) alongside:
- the plan sets expectations;
- many small updates make it feel live;
- the folded "Thinking" block gives "literally everything" to whoever wants
  it without flooding the chat.

Leave 3 until the facts carry real reasons, so no update invents one.

## Decisions for the owner

1. **Who pays for the extra narration?** Absorbed as today, or reflected in
   what the customer is charged.
2. **Thinking vs. the grounding rule.** Is visible "thinking" (including
   ideas it drops) acceptable when clearly labelled, or summary-only?
3. **Raw or cleaned thinking.** Recommended: cleaned summary.
4. **Which model narrates.** The same model as the edit, or a fixed quick
   model for all narration.
5. **Behind a switch.** Ship each option off by default, as the owner has
   asked for new features (2026-10-06), and turn on after one measured live
   run.

## Questions for Codex

- Which of the 44 `mark()` points already carry enough facts for option 2,
  and which checks (`page-keep`, `page-prose`, render, live read) report a
  result a fact can state?
- Does `grok-4.6` return reasoning through the transport the builder uses,
  and in what form? Same for the Anthropic models in `BUILD_MODELS`.
- Is merging milestones that land within a few seconds the right answer to
  bursts, or should the writer simply skip to the newest facts (it already
  writes from "facts since the last update")?
- What is the narrowest test that proves a thinking summary never contains
  code, file paths or instruction text?

## How each would be tested (offline, supplied answers)

- **1:** the plan line is written before the first milestone; it is worded
  as intent; a failed step is never described as done by it.
- **2:** each new milestone's facts match what really ran (a skipped check
  gives no "checked" fact); lines never arrive after the final reply; the
  cap holds.
- **3:** a "because" appears only when a fact carries a reason.
- **4:** no block when the model returns no reasoning; the summary carries
  no code, paths or instruction text; the block folds when the task ends and
  is kept on reload.
- **5:** every check that ran is named, none that did not.
- Then one live run per switch, measuring calls, tokens, time and cost
  before anything is promised.
