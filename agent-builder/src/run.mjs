/**
 * THE AGENT LOOP.
 *
 * `while (true)` around a model that decides when to stop, with every bound
 * enforced in code rather than described in a prompt. The bounds live in
 * `limits.mjs`; this module spends them and says which one ran out.
 *
 * EVERY OUTSIDE THING IS INJECTED — `send`, `now`, `journal`. There is no fetch,
 * no clock and no storage in here, because this has to run in a Cloudflare Worker
 * (no node_modules) and because a loop whose clock is real can only be tested by
 * waiting. Every branch below is drivable.
 *
 * THE RUN RECORD IS THE PRODUCT. A run answers what happened, step by step, with
 * the reason it stopped named — not a boolean and not a bare string of text. Two
 * root-product laws force that shape: "a failure that cannot name itself" (seven
 * recorded instances, four causes wearing one sentence), and "store the raw
 * answer ONCE, before anything can refuse it".
 *
 * **`messages` IS THIS MODULE'S OWN SHAPE, NOT A PROVIDER'S, and `send` is the
 * translator.** Said out loud because it is the seam somebody will trip over:
 * every provider spells tool calls and tool results differently, and a loop that
 * spoke one dialect natively would only ever work with one provider. The cost is
 * that `send` owns the translation and is the one place a provider's shape may
 * appear. The message BUILDERS live in `journal.mjs`, because a replay has to
 * compose the same conversation and two copies of that would drift.
 */

import { planLimits, narrowLimits, stoppedBy, leftOf, capMs } from "./limits.mjs";
import { toolsFor, wireTools } from "./define.mjs";
import { runFanout } from "./fanout.mjs";
import { approvalRefusal } from "./approvals.mjs";
import { addMeter, usageTokens } from "./meters.mjs";
import {
  replay, startedEntry, modelEntry, toolEntry, stoppedEntry,
  userMessage, assistantMessage, toolMessage, toolResultFor, limitsToJson,
} from "./journal.mjs";

/** Why a run ended. One shape, so a caller can always say what happened. */
const ended = (reason, extra = {}) => Object.freeze({ reason, ...extra });

/**
 * `runAgent({ agent, prompt, tenant, send, now, journal, from, limits })`
 *
 * `send` is the ONE model call, and its contract is:
 *
 *   send({ model, system, messages, tools, callMs, step }) → {
 *     text, toolCalls: [{ id, name, args }], usage, costMicros,
 *   }
 *
 * `callMs` is handed to `send` rather than enforced here on purpose: only the
 * transport can abort its own request, and a timeout raced in this module would
 * leave the real call running and still billing. The mirror of this mistake is a
 * caller that carries no clock at all, which does not fail — it hangs.
 *
 * `journal.append(entry)` is called as each thing HAPPENS — never batched at the
 * end, which would defeat the whole point. `from` is a previous run's entries,
 * and handing them in resumes rather than restarts.
 *
 * `checkpoint({ what, step })` is asked BEFORE anything new is started — before each
 * model call, and before each batch of tool calls including the ones a resume
 * finishes. **IT MAY THROW, AND A THROW ESCAPES THIS FUNCTION DELIBERATELY.** Its
 * one caller uses it to ask the database whether this process still holds the run's
 * claim, and a process that does not hold it must write NOTHING — not even a stop,
 * because a stop is what tells the next holder the run is over. So there is no
 * `ended("...")` for it: the record is not the product here, the absence of a write
 * is.
 *
 * **WHAT IT CANNOT DO, said where somebody will read it before trusting it.** It is
 * asked before the work starts, so it stops work that has not begun. It cannot
 * recall a tool call already sent — nothing in a database can — which is why
 * `repeatable` and the `cannot-resume` refusal above are the guarantee and this is
 * only the narrowing.
 */
export async function runAgent(opts = {}) {
  const { agent, tenant, send } = opts;
  if (!agent || agent.kind !== "agent") throw new TypeError("runAgent: agent must come from defineAgent");
  if (typeof send !== "function") throw new TypeError("runAgent: send must be a function");
  const now = typeof opts.now === "function" ? opts.now : Date.now;
  const journal = opts.journal ?? null;
  if (journal !== null && typeof journal.append !== "function") {
    throw new TypeError("runAgent: journal must have an append function");
  }
  // REFUSED, NOT IGNORED. A `checkpoint` that is present and not callable is a
  // caller that believes it has an ownership check and has none — and the failure
  // would be invisible, because a missing check looks exactly like a passing one.
  if (Object.hasOwn(opts, "checkpoint") && opts.checkpoint !== undefined && typeof opts.checkpoint !== "function") {
    throw new TypeError("runAgent: checkpoint must be a function");
  }
  const checkpoint = typeof opts.checkpoint === "function" ? opts.checkpoint : null;
  /**
   * ⚠ WHAT A TOOL CAN REACH, ALREADY SCOPED TO ONE ACCOUNT AND ONE AGENT.
   *
   * It is handed in rather than built here for the reason every dependency in this file
   * is: a loop that could open a database is a loop that cannot be driven without one.
   * What matters for safety is that it arrives ALREADY SCOPED — the caller applied the
   * tenant and the agent, both of which it read from the claim and the journal, so
   * nothing below this line can widen it and no tool argument can reach past it.
   *
   * **`null` IS A REAL ANSWER and is the default.** Every capability tool refuses by name
   * without one; the alternative — building an unscoped backend here — is the one shape
   * that could hand a tool the whole database.
   */
  const capabilities = opts.capabilities ?? null;
  if (capabilities !== null && typeof capabilities !== "object") {
    throw new TypeError("runAgent: capabilities must be an object of operations, already scoped");
  }
  /**
   * ⚠ WHERE A CALL THAT NEEDS A PERSON GOES TO ASK — already bound to THIS run.
   *
   * Handed in for the same reason `capabilities` is: a loop that could open a database is
   * a loop nobody can drive. It arrives bound to the run and the account by the caller,
   * which read both from the claim, so nothing below this line can ask about another
   * run's approval and no tool argument can reach past it.
   *
   * **`null` IS A REAL ANSWER and is the default.** A deployment with nowhere to ask
   * REFUSES a gated call and says so, which is not the same as one that quietly runs it.
   */
  const approvals = opts.approvals ?? null;
  if (approvals !== null && typeof approvals?.ask !== "function") {
    throw new TypeError("runAgent: approvals must be an object with an ask(), already bound to this run");
  }
  /** Where a tool that starts work gets its identifier. Injected; never a global. */
  const newId = typeof opts.newId === "function" ? opts.newId : null;
  const mayStart = async (what, step) => { if (checkpoint) await checkpoint({ what, step }); };

  // THE AGENT'S OWN LIMITS ARE THE AUTHOR'S AND ARE TRUSTED; a per-run override
  // is NOT, so it goes through `narrowLimits` and may only ever reduce them.
  const base = agent.limits ?? planLimits();
  const limits = Object.hasOwn(opts, "limits") && opts.limits !== undefined
    ? narrowLimits(base, opts.limits)
    : base;

  // The tenancy wall, asked ONCE and before any call. Its `withheld` half rides
  // on the record so the caller can say why the agent could not do a thing.
  const { allowed, withheld } = toolsFor(agent, tenant?.grants);
  const callable = new Map(allowed.map((t) => [t.name, t]));

  // ── the approval gate ──────────────────────────────────────────────────────
  //
  // **WHICH CALLS NEED A PERSON IS READ OFF THE TOOL, and the tool is looked up in
  // `callable`** — the list the tenancy wall already narrowed. So a model naming a tool
  // it was not given never reaches this at all: it is refused below as "no such tool",
  // which is a stronger answer than an approval request nobody can grant.
  //
  // **NOTHING A MODEL WRITES DECIDES ANYTHING HERE.** The step and the position come
  // from this loop's own counters, the tool name from the narrowed list, and the account
  // and the run from a store the caller bound before `runAgent` was called. The only
  // model-written value in the whole exchange is the ARGUMENTS — and those are what is
  // being asked about.
  const decideOne = async (step, index, tool, args) => {
    // A DEPLOYMENT WITH NOWHERE TO ASK REFUSES, and says which of the two it is: the
    // model is told nobody could be asked, rather than that somebody said no.
    if (!approvals) return { state: "unavailable", index, tool, id: null };
    return { ...(await approvals.ask({ step, index, tool, args })), index, tool };
  };
  /** Every gated call in one batch, asked in order, keyed by its position in it. */
  const decideBatch = async (calls, step) => {
    const out = new Map();
    for (let i = 0; i < calls.length; i++) {
      const name = typeof calls[i]?.name === "string" ? calls[i].name : null;
      const tool = name === null ? undefined : callable.get(name);
      if (!tool?.approval) continue;
      out.set(i, await decideOne(step, i, tool.name, calls[i]?.args));
    }
    return out;
  };

  // ── the journal ────────────────────────────────────────────────────────────
  // A FAILED WRITE STOPS THE RUN AND SAYS SO. A caller who passed a journal asked
  // for durability; carrying on without it would produce a run that looks
  // resumable and is not, and the work would then be paid for twice. Nothing is
  // lost by stopping: everything so far is still on the returned record.
  let journalError = null;
  const write = async (entry) => {
    if (!journal) return true;
    try { await journal.append(entry); return true; }
    catch (e) { journalError = String(e?.message ?? e); return false; }
  };

  // ── resume, or start ───────────────────────────────────────────────────────
  const entries = opts.from === undefined ? null : [...requireEntries(opts.from)];
  let prior = entries ? replay(entries) : null;

  const startedAt = now();
  let priorMs = 0;
  const used = { steps: 0, toolCalls: 0, tokens: 0, costMicros: 0, wallMs: 0 };
  let messages = [];
  let nextStep = 1;
  const steps = [];

  const record = (stop) => Object.freeze({
    ok: stop.reason === "answered",
    stop,
    text: stop.reason === "answered" ? stop.text : null,
    steps: Object.freeze(steps),
    used: Object.freeze({ ...used, wallMs: priorMs + (now() - startedAt) }),
    withheld,
    tenant: tenant?.id ?? null,
    messages: Object.freeze(messages),
    resumed: !!prior,
  });

  if (prior) {
    // A LOG THAT CANNOT BE READ IS NOT AN EMPTY LOG. Resuming past a junk entry
    // would rebuild a SHORTER conversation and a SMALLER bill than the run really
    // had — the model sent a history missing a step, the meters under-reporting.
    if (prior.problems.length) {
      return record(ended("journal-unreadable", { problems: prior.problems }));
    }
    // A FINISHED RUN IS NOT RESTARTED. Its own stop is returned as it was, so a
    // caller that replays a completed run twice gets the same answer rather than
    // a second bill.
    if (prior.status === "stopped") {
      messages = [...prior.messages];
      Object.assign(used, prior.used);
      priorMs = prior.used.wallMs;
      return record(prior.stop && typeof prior.stop === "object" ? prior.stop : ended("stopped"));
    }

    // PENDING TOOL CALLS ARE THE WHOLE HAZARD OF RESUMING. A tool call with no
    // recorded result may have run, may have half-run, or may never have started
    // — the log cannot tell, because the process died before it could say. So the
    // question is not "did it run" but "is running it again safe", which is what
    // `repeatable` answers.
    // ⚠ ASKED BEFORE `repeatable`, AND THE ORDER IS THE WHOLE POINT. A call still waiting
    // for a person has definitively NOT run — the gate below sits in front of the
    // dispatch — so answering `cannot-resume` about it would strand a run on a hazard
    // that does not exist, for ever, since every later delivery would refuse the same
    // way. The two questions are different: `repeatable` asks *might this have run*, and
    // this asks *was it ever allowed to*.
    //
    // ⚠ EACH IS ASKED AT ITS OWN `(step, index)`, taken off the pending entry, because a
    // decision is BOUND to that position and it is the call a person was shown. A batch
    // that half-finished leaves a GAPPED pending list — calls 0 and 2 answered, 1 and 3
    // not — so numbering them 0..n afresh here would ask about calls that do not exist
    // and answer about ones that do.
    const decided = new Map();
    for (const [slot, p] of prior.pending.entries()) {
      if (!callable.get(p.name)?.approval) continue;
      try { decided.set(slot, await decideOne(p.step, p.index, p.name, findArgs(prior, p))); }
      catch (e) {
        // NOWHERE TO ASK IS NOT A VERDICT. The log is left open with no stop, so a later
        // delivery tries again rather than the run being closed over an outage.
        return record(ended("approval-failed", { error: String(e?.message ?? e) }));
      }
    }
    const stillWaiting = [...decided.entries()].filter(([, d]) => d.state === "pending");
    if (stillWaiting.length) {
      // NOTHING RAN AND NOTHING WAS SPENT. Recorded rather than finished, so the log
      // still reads as a run in progress with its calls pending — which is exactly what
      // the delivery after the decision resumes from.
      return record(ended("awaiting-approval", {
        waiting: stillWaiting.map(([i, d]) => ({
          id: d.id, tool: d.tool, step: prior.pending[i].step, index: prior.pending[i].index,
        })),
      }));
    }

    // A call a person REFUSED, or one nobody could be asked about, never ran — so it is
    // not a resume hazard and is left out of the question below.
    const refusedHere = new Set([...decided.entries()]
      .filter(([, d]) => d.state !== "approved").map(([i]) => i));
    const unsafe = prior.pending.filter((p, i) => !refusedHere.has(i) && !callable.get(p.name)?.repeatable);
    if (unsafe.length) {
      // FAILS CLOSED, and names every tool that blocked it. Refusing strands the
      // run, which is bad; running a payment twice is worse, and only one of the
      // two is reversible by a person who has been told.
      return record(ended("cannot-resume", {
        pending: unsafe.map((p) => ({ step: p.step, index: p.index, name: p.name })),
      }));
    }

    // Every pending call is repeatable, so finish them, record each, and then
    // REPLAY AGAIN. Re-replaying rather than patching the message list is what
    // keeps ONE composer of the conversation: the gaps are filled in the log and
    // the log is the thing that builds the messages.
    for (const [i, p] of prior.pending.entries()) {
      // A CALL A PERSON REFUSED IS ANSWERED, NOT RUN. Its result is a refusal the model
      // can read and act on — `ok: true` because the tool did not fail, with the refusal
      // INSIDE the value, which is the shape every other wall in this product uses.
      const verdict = decided.get(i);
      if (verdict && verdict.state !== "approved") {
        const said = toolEntry({ at: now(), step: p.step, index: p.index, name: p.name,
                                 ms: 0, ok: true, value: approvalRefusal(verdict) });
        entries.push(said);
        if (!(await write(said))) return record(ended("journal-failed", { error: journalError, step: p.step }));
        continue;
      }
      // ASKED BEFORE THE TOOL RUNS, not after. These are the pending calls of a run
      // somebody else may now own, and they are `repeatable` — which makes running
      // them safe to REPEAT, not safe to run twice at once.
      await mayStart("tools", p.step);
      const tool = callable.get(p.name);
      const at = now();
      let done;
      try {
        const value = await tool.run(findArgs(prior, p), toolContext({ tenant, agent, limits, step: p.step, id: p.id, room: () => leftOf(limits.wallMs, now() - startedAt), capabilities, newId }));
        done = toolEntry({ at, step: p.step, index: p.index, name: p.name, ms: now() - at, ok: true, value });
      } catch (error) {
        done = toolEntry({ at, step: p.step, index: p.index, name: p.name, ms: now() - at, ok: false, error: String(error?.message ?? error) });
      }
      entries.push(done);
      if (!(await write(done))) return record(ended("journal-failed", { error: journalError, step: p.step }));
    }
    prior = replay(entries);

    messages = [...prior.messages];
    Object.assign(used, prior.used);
    priorMs = prior.used.wallMs;
    nextStep = prior.step + 1;
  } else {
    // REFUSED, NOT COERCED. This read `typeof prompt === "string" ? prompt : ""`,
    // which turned any non-string into an empty run: a model asked nothing, an
    // answer about nothing, and a bill. `String(["hi"])` being `"hi"` is why
    // coercing would not have been better either.
    if (typeof opts.prompt !== "string" || opts.prompt.trim() === "") {
      throw new TypeError("runAgent: prompt must be a non-empty string");
    }
    messages = [userMessage(opts.prompt)];
    const first = startedEntry({
      at: startedAt, tenant: tenant?.id ?? null, agent: agent.name,
      model: agent.model, prompt: opts.prompt, limits: limitsToJson(limits),
    });
    if (!(await write(first))) return record(ended("journal-failed", { error: journalError, step: 0 }));
  }

  const finish = async (stop) => {
    // The stop is recorded LAST and only once, so a log without one is exactly
    // what an interrupted run looks like — which is how `replay` tells a run that
    // is still going from one that is over.
    if (!(await write(stoppedEntry({ at: now(), stop })))) {
      return record(ended("journal-failed", { error: journalError, was: stop.reason }));
    }
    return record(stop);
  };

  for (;;) {
    used.wallMs = priorMs + (now() - startedAt);

    // THE BOUNDS, ASKED BEFORE ANYTHING IS SPENT. `stoppedBy` names which one.
    const out = stoppedBy(limits, used);
    if (out) return finish(ended("bound", { ...out }));

    // The per-call ceiling is min(its own cap, what the run has left).
    const callMs = capMs(limits.callMs, leftOf(limits.wallMs, used.wallMs));

    // **OWNERSHIP BEFORE MONEY.** Asked before the step is even counted, so a run
    // that has lost its claim costs nothing at all — not a call, not a meter, not an
    // entry.
    await mayStart("model", nextStep);

    // COUNTED BEFORE THE CALL, NOT AFTER. A `send` that always throws would
    // otherwise never advance the step meter and this loop would never end —
    // the bound would be described and not enforced.
    used.steps += 1;
    const stepNo = nextStep++;
    const stepAt = now();

    let answer;
    try {
      answer = await send({
        model: agent.model, system: agent.instructions,
        messages: [...messages], tools: wireTools(allowed), callMs, step: stepNo,
      });
    } catch (error) {
      // NO AUTO-RETRY, and that is the owner's money rule rather than a technical
      // limit: "we should not spend your credits for you." A caller who wants
      // another attempt asks for one, having seen what failed.
      steps.push(Object.freeze({ n: stepNo, at: stepAt, ms: now() - stepAt, failed: true, error: String(error?.message ?? error) }));
      return finish(ended("call-failed", { step: stepNo, error: String(error?.message ?? error) }));
    }

    const usage = answer?.usage ?? null;
    used.tokens = addMeter(used.tokens, usageTokens(usage));
    used.costMicros = addMeter(used.costMicros, answer?.costMicros ?? null);

    const asked = Array.isArray(answer?.toolCalls) ? answer.toolCalls : [];
    const text = typeof answer?.text === "string" ? answer.text : "";

    // WRITTEN THE MOMENT IT ARRIVES, BEFORE ANY TOOL RUNS. This answer cost money;
    // it is the one artifact a crash must never take, and every later entry is
    // cheap by comparison.
    const mEntry = modelEntry({ at: stepAt, step: stepNo, ms: now() - stepAt, text, toolCalls: asked, usage, costMicros: answer?.costMicros ?? null });
    if (entries) entries.push(mEntry);
    if (!(await write(mEntry))) return record(ended("journal-failed", { error: journalError, step: stepNo }));

    const step = {
      n: stepNo, at: stepAt, ms: now() - stepAt, text,
      usage, costMicros: answer?.costMicros ?? null,
      toolCalls: asked.map((c) => ({ id: c?.id ?? null, name: c?.name ?? null })),
    };

    // NO TOOL CALLS IS THE ANSWER.
    if (asked.length === 0) {
      steps.push(Object.freeze(step));
      messages.push(assistantMessage(text));
      return finish(ended("answered", { text, step: stepNo }));
    }

    // THE WHOLE BATCH IS REFUSED WHEN IT WOULD OUTRUN THE TOOL BUDGET, rather
    // than a prefix of it being run. A prefix performs real side effects whose
    // results nobody ever reads, because the run ends either way and the model is
    // not there to see them.
    const roomForTools = leftOf(limits.toolCalls, used.toolCalls);
    if (roomForTools !== null && roomForTools !== Infinity && asked.length > roomForTools) {
      steps.push(Object.freeze(step));
      return finish(ended("bound", {
        bound: "toolCalls", reason: "batch-would-exceed",
        limit: limits.toolCalls, used: used.toolCalls, asked: asked.length,
      }));
    }
    // **OWNERSHIP BEFORE SIDE EFFECTS.** The model answer is written by now, so
    // this costs the run nothing to skip; what it buys is that a worker which lost
    // its claim during the model call does not go on to fire this batch at the
    // outside world.
    await mayStart("tools", stepNo);

    // ── the approval gate, IN FRONT OF THE DISPATCH AND IN FRONT OF THE METER ──
    //
    // A call waiting for a person has not happened: it must not be billed as a tool
    // call, and it must not be dispatched beside its neighbours. **THE BATCH IS HELD
    // WHOLE**, for the reason the budget refusal above it is — a prefix performs real
    // side effects whose results nobody ever reads, because the run stops either way.
    let decided;
    try { decided = await decideBatch(asked, stepNo); }
    catch (e) {
      // NOWHERE TO ASK IS NOT A VERDICT, and is not the end of the run either: the log
      // is left open with no stop, so a later delivery asks again.
      steps.push(Object.freeze(step));
      return record(ended("approval-failed", { step: stepNo, error: String(e?.message ?? e) }));
    }
    const waitingOn = [...decided.values()].filter((d) => d.state === "pending");
    if (waitingOn.length) {
      steps.push(Object.freeze(step));
      // ⚠ RECORDED, NOT FINISHED — no `stopped` entry. The log still reads as a run in
      // progress with its tool calls pending, which is what the delivery after the
      // decision resumes from; `agent.decide_tool_approval` puts the run back on the
      // queue through `requeue_run`, the same function a person pressing "try again"
      // already uses. There is no second queue and no poller.
      return record(ended("awaiting-approval", {
        step: stepNo,
        waiting: waitingOn.map((d) => ({ id: d.id, tool: d.tool, step: stepNo, index: d.index })),
      }));
    }

    used.toolCalls += asked.length;

    const results = await runFanout(asked, async (call, i) => {
      const tool = typeof call?.name === "string" ? callable.get(call.name) : undefined;
      // FAILS CLOSED, and it is not redundant with `toolsFor`: a model can name a
      // tool that was never offered — a withheld one, or one it invented — and
      // that must come back as a readable tool RESULT so the model can correct
      // itself, never as a crash and never as a call.
      if (!tool) {
        const why = withheld.some((w) => w.name === call?.name) ? "not permitted for this tenant" : "no such tool";
        throw new Error(`${String(call?.name ?? "(unnamed)")}: ${why}`);
      }
      // **THE WALL IS HERE AND NOT IN THE TOOL.** A tool that checked its own approval
      // would be a wall each of thirteen authors has to remember, and the one forgotten
      // is the one that matters; and a tool cannot see its own position in the batch,
      // which is half of what a decision is bound to. Every gated call has a decision by
      // now — the batch was held above until they all did — so `approved` is the only
      // state that reaches the tool.
      const verdict = decided.get(i);
      if (verdict && verdict.state !== "approved") return approvalRefusal(verdict);
      return tool.run(call?.args, toolContext({ tenant, agent, limits, step: stepNo, id: call?.id ?? null, room: () => leftOf(limits.wallMs, now() - startedAt), capabilities, newId }));
    }, { limit: limits.parallelTools, now });

    // EACH RESULT IS RECORDED AS IT LANDS, which is what makes a half-finished
    // batch readable later: `replay` can then say exactly which calls have
    // answers and which do not.
    for (const r of results) {
      const call = asked[r.index];
      const e = toolEntry({
        at: r.startedAt, step: stepNo, index: r.index, name: call?.name ?? null,
        ms: r.ms, ok: r.ok, value: r.value, error: r.ok ? undefined : String(r.error?.message ?? r.error),
      });
      if (entries) entries.push(e);
      if (!(await write(e))) return record(ended("journal-failed", { error: journalError, step: stepNo }));
    }

    // A FAILED TOOL IS A RESULT, NEVER AN ABSENCE. The model is shown the error so
    // it can recover; dropping it would leave the model waiting for an answer that
    // never comes and re-asking for the same tool for ever.
    step.results = results.map((r) => ({
      index: r.index, name: asked[r.index]?.name ?? null, ms: r.ms,
      ok: r.ok, value: r.ok ? r.value : undefined,
      error: r.ok ? undefined : String(r.error?.message ?? r.error),
    }));
    steps.push(Object.freeze(step));

    messages.push(assistantMessage(text, asked));
    messages.push(toolMessage(results.map((r) => toolResultFor(asked[r.index], r.ok, r.ok ? r.value : String(r.error?.message ?? r.error)))));
  }
}

// ── small shared pieces ──────────────────────────────────────────────────────

function requireEntries(from) {
  if (!Array.isArray(from)) throw new TypeError("runAgent: from must be an array of journal entries");
  return from;
}

/** What a tool is told. One builder, so the live path and the resume path agree. */
function toolContext({ tenant, agent, limits, step, id, room, capabilities, newId }) {
  return Object.freeze({
    tenant: tenant ?? null, agent: agent.name, step, toolCallId: id,
    toolMs: capMs(limits.toolMs, room()),
    /**
     * ⚠ THE BACKEND A TOOL REACHES, ALREADY SCOPED — and the scoping is why it arrives
     * here rather than being looked up by the tool.
     *
     * It is `capabilities.forTenant(t).forAgent(a)` already applied, so not one operation
     * on it takes a tenant or an agent id and there is nowhere for a tool argument to
     * become one. The two identities came from the claim and from the run's own journal
     * snapshot; neither has ever been through a model.
     *
     * **ABSENT IS A REAL ANSWER.** A run built with no capabilities hands every tool
     * `undefined`, and each of them refuses BY NAME rather than pretending — which is
     * what keeps a deployment with no store behind it from answering as though it had
     * done the work.
     */
    capabilities: capabilities ?? null,
    /**
     * A fresh identifier, for the one tool that starts work. **It is injected because
     * nothing below this line may reach a global**, and it is the reason a model cannot
     * name a run: there is no argument for one, and this is the only source.
     */
    newId: typeof newId === "function" ? newId : null,
  });
}

/** The args a pending call was originally made with, out of the log. */
function findArgs(prior, p) {
  const m = prior.messages.find((x) => x.role === "assistant" && x.toolCalls?.some((c) => (c.id ?? null) === p.id));
  return m?.toolCalls?.find((c) => (c.id ?? null) === p.id)?.args;
}
