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
    const unsafe = prior.pending.filter((p) => !callable.get(p.name)?.repeatable);
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
    for (const p of prior.pending) {
      const tool = callable.get(p.name);
      const at = now();
      let done;
      try {
        const value = await tool.run(findArgs(prior, p), toolContext({ tenant, agent, limits, step: p.step, id: p.id, room: () => leftOf(limits.wallMs, now() - startedAt) }));
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
    used.toolCalls += asked.length;

    const results = await runFanout(asked, async (call) => {
      const tool = typeof call?.name === "string" ? callable.get(call.name) : undefined;
      // FAILS CLOSED, and it is not redundant with `toolsFor`: a model can name a
      // tool that was never offered — a withheld one, or one it invented — and
      // that must come back as a readable tool RESULT so the model can correct
      // itself, never as a crash and never as a call.
      if (!tool) {
        const why = withheld.some((w) => w.name === call?.name) ? "not permitted for this tenant" : "no such tool";
        throw new Error(`${String(call?.name ?? "(unnamed)")}: ${why}`);
      }
      return tool.run(call?.args, toolContext({ tenant, agent, limits, step: stepNo, id: call?.id ?? null, room: () => leftOf(limits.wallMs, now() - startedAt) }));
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
function toolContext({ tenant, agent, limits, step, id, room }) {
  return Object.freeze({
    tenant: tenant ?? null, agent: agent.name, step, toolCallId: id,
    toolMs: capMs(limits.toolMs, room()),
  });
}

/** The args a pending call was originally made with, out of the log. */
function findArgs(prior, p) {
  const m = prior.messages.find((x) => x.role === "assistant" && x.toolCalls?.some((c) => (c.id ?? null) === p.id));
  return m?.toolCalls?.find((c) => (c.id ?? null) === p.id)?.args;
}
