/**
 * THE AGENT LOOP.
 *
 * `while (true)` around a model that decides when to stop, with every bound
 * enforced in code rather than described in a prompt. The bounds live in
 * `limits.mjs`; this module spends them and says which one ran out.
 *
 * EVERY OUTSIDE THING IS INJECTED — `send`, `now`. There is no fetch, no clock
 * and no storage in here, because this has to run in a Cloudflare Worker (no
 * node_modules) and because a loop whose clock is real can only be tested by
 * waiting. Every branch below is drivable.
 *
 * THE RUN RECORD IS THE PRODUCT. A run answers what happened, step by step, with
 * the reason it stopped named — not a boolean and not a bare string of text. Two
 * root-product laws force that shape: "a failure that cannot name itself" (seven
 * recorded instances, four causes wearing one sentence), and "store the raw
 * answer ONCE, before anything can refuse it" — three sessions each bought a
 * narrower diagnostic field instead of keeping the artifact.
 */

import { planLimits, narrowLimits, stoppedBy, leftOf, capMs } from "./limits.mjs";
import { toolsFor, wireTools } from "./define.mjs";
import { runFanout } from "./fanout.mjs";

/**
 * The token kinds counted against the run's budget. ALL of them count: a
 * provider prices a cached read at a tenth, but a BUDGET is not a bill, and the
 * root product's own note on this is that the window does not care how cheap a
 * token was.
 */
export const USAGE_KEYS = Object.freeze([
  "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens",
]);

/**
 * Add to a meter, where `null` means UNMEASURED AND STAYS UNMEASURED.
 *
 * "Cannot-tell must never read as a value." Once one call has failed to report
 * its usage, the run's total is unknowable — and a reader that treats the gap as
 * zero lets the run spend for ever against a budget it believes it is inside.
 * `stoppedBy` turns that `null` into a named stop, but only when the bound it
 * cannot measure is finite.
 */
export function addMeter(current, add) {
  if (current === null) return null;
  if (add === null || add === undefined) return null;
  if (typeof add !== "number" || Number.isNaN(add) || add < 0) return null;
  return current + add;
}

/**
 * Total the tokens of one call's usage. `null` when nothing usable was reported,
 * NEVER 0 — a provider that says nothing and one that says "no tokens" are
 * different facts and only one of them is a measurement.
 */
export function usageTokens(usage) {
  if (usage === null || typeof usage !== "object" || Array.isArray(usage)) return null;
  let total = 0;
  let sawOne = false;
  for (const k of USAGE_KEYS) {
    if (!Object.hasOwn(usage, k)) continue;
    const v = usage[k];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0) return null;
    total += v; sawOne = true;
  }
  return sawOne ? total : null;
}

/** Why a run ended. One shape, so a caller can always say what happened. */
const ended = (reason, extra = {}) => Object.freeze({ reason, ...extra });

/**
 * `runAgent({ agent, prompt, tenant, send, now })`
 *
 * `send` is the ONE outside call, and its contract is:
 *
 *   send({ model, system, messages, tools, callMs, step }) → {
 *     text,                     // the assistant's words, if any
 *     toolCalls: [{ id, name, args }],
 *     usage,                    // { inputTokens, ... } or null when unreported
 *     costMicros,               // number, or null when unreported
 *   }
 *
 * `callMs` is handed to `send` rather than enforced here on purpose: only the
 * transport can abort its own request, and a timeout raced in this module would
 * leave the real call running and still billing. The root product paid for the
 * mirror of this — a probe that carried no clock at all and hung.
 *
 * **`messages` IS THIS MODULE'S OWN SHAPE, NOT A PROVIDER'S, and `send` is the
 * translator.** Said out loud because it is the seam somebody will trip over:
 * every provider spells tool calls and tool results differently, and a loop that
 * spoke one of those dialects natively would be a loop that only works with one
 * provider. The cost is that `send` owns the translation and is the one place a
 * provider's shape may appear.
 */
export async function runAgent(opts = {}) {
  const { agent, prompt, tenant, send } = opts;
  if (!agent || agent.kind !== "agent") throw new TypeError("runAgent: agent must come from defineAgent");
  if (typeof send !== "function") throw new TypeError("runAgent: send must be a function");
  const now = typeof opts.now === "function" ? opts.now : Date.now;

  // THE AGENT'S OWN LIMITS ARE THE AUTHOR'S AND ARE TRUSTED; a per-run override
  // is NOT, so it goes through `narrowLimits` and may only ever reduce them. This
  // is where a tenant-supplied or request-supplied bound belongs: a caller can
  // ask for a cheaper run and can never ask for a more expensive one.
  const base = agent.limits ?? planLimits();
  const limits = Object.hasOwn(opts, "limits") && opts.limits !== undefined
    ? narrowLimits(base, opts.limits)
    : base;

  // The tenancy wall, asked ONCE and before any call. Its `withheld` half rides
  // on the record so the caller can say why the agent could not do a thing —
  // a filter is a silent drop, a check is a sentence.
  const { allowed, withheld } = toolsFor(agent, tenant?.grants);
  const callable = new Map(allowed.map((t) => [t.name, t]));

  const startedAt = now();
  const steps = [];
  const used = { steps: 0, toolCalls: 0, tokens: 0, costMicros: 0, wallMs: 0 };
  // REFUSED, NOT COERCED. This read `typeof prompt === "string" ? prompt : ""`,
  // which turned any non-string into an empty run: a model asked nothing, an
  // answer about nothing, and a bill. That is the silent-drop class this module
  // has a rule against everywhere else — a filter on somebody's input is a drop,
  // a check is a sentence — and `String(["hi"])` being `"hi"` is why coercing
  // would not have been better.
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new TypeError("runAgent: prompt must be a non-empty string");
  }
  const messages = [{ role: "user", content: prompt }];

  const record = (stop) => Object.freeze({
    ok: stop.reason === "answered",
    stop,
    text: stop.reason === "answered" ? stop.text : null,
    steps: Object.freeze(steps),
    used: Object.freeze({ ...used, wallMs: now() - startedAt }),
    withheld,
    tenant: tenant?.id ?? null,
    messages: Object.freeze(messages),
  });

  for (;;) {
    used.wallMs = now() - startedAt;

    // THE BOUNDS, ASKED BEFORE ANYTHING IS SPENT. `stoppedBy` names which one.
    const out = stoppedBy(limits, used);
    if (out) return record(ended("bound", { ...out }));

    // The per-call ceiling is min(its own cap, what the run has left) — never
    // more than the run's remaining wall, and `Infinity` survives both sides.
    const callMs = capMs(limits.callMs, leftOf(limits.wallMs, used.wallMs));

    // COUNTED BEFORE THE CALL, NOT AFTER. A `send` that always throws would
    // otherwise never advance the step meter and this loop would never end —
    // the bound would be described and not enforced.
    used.steps += 1;
    const stepNo = used.steps;
    const stepAt = now();

    let answer;
    try {
      answer = await send({
        model: agent.model,
        system: agent.instructions,
        messages: [...messages],
        tools: wireTools(allowed),
        callMs,
        step: stepNo,
      });
    } catch (error) {
      // NO AUTO-RETRY, and that is the owner's own money rule rather than a
      // technical limit: "we should not spend your credits for you." A caller
      // who wants another attempt asks for one, having seen what failed.
      steps.push(Object.freeze({
        n: stepNo, at: stepAt, ms: now() - stepAt, failed: true,
        error: String(error?.message ?? error),
      }));
      return record(ended("call-failed", { step: stepNo, error: String(error?.message ?? error) }));
    }

    const usage = answer?.usage ?? null;
    used.tokens = addMeter(used.tokens, usageTokens(usage));
    used.costMicros = addMeter(used.costMicros, answer?.costMicros ?? null);

    const asked = Array.isArray(answer?.toolCalls) ? answer.toolCalls : [];
    const text = typeof answer?.text === "string" ? answer.text : "";
    const step = {
      n: stepNo, at: stepAt, ms: now() - stepAt, text,
      usage, costMicros: answer?.costMicros ?? null,
      toolCalls: asked.map((c) => ({ id: c?.id ?? null, name: c?.name ?? null })),
    };

    // NO TOOL CALLS IS THE ANSWER. The model stopped asking for things, so what
    // it said last is the result.
    if (asked.length === 0) {
      steps.push(Object.freeze(step));
      messages.push({ role: "assistant", content: text });
      return record(ended("answered", { text, step: stepNo }));
    }

    // THE WHOLE BATCH IS REFUSED WHEN IT WOULD OUTRUN THE TOOL BUDGET, rather
    // than a prefix of it being run. A prefix would perform real side effects
    // whose results nobody ever reads, because the run ends either way and the
    // model is not there to see them.
    const roomForTools = leftOf(limits.toolCalls, used.toolCalls);
    if (roomForTools !== null && roomForTools !== Infinity && asked.length > roomForTools) {
      steps.push(Object.freeze(step));
      return record(ended("bound", {
        bound: "toolCalls", reason: "batch-would-exceed",
        limit: limits.toolCalls, used: used.toolCalls, asked: asked.length,
      }));
    }
    used.toolCalls += asked.length;

    const toolRoom = () => leftOf(limits.wallMs, now() - startedAt);
    const results = await runFanout(asked, async (call) => {
      const tool = typeof call?.name === "string" ? callable.get(call.name) : undefined;
      // FAILS CLOSED, and it is not redundant with `toolsFor`: a model can name a
      // tool that was never offered — a withheld one, or one it invented — and
      // that must come back as a readable tool RESULT so the model can correct
      // itself, never as a crash and never as a call.
      if (!tool) {
        const why = withheld.some((w) => w.name === call?.name)
          ? "not permitted for this tenant"
          : "no such tool";
        throw new Error(`${String(call?.name ?? "(unnamed)")}: ${why}`);
      }
      return tool.run(call?.args, Object.freeze({
        tenant: tenant ?? null,
        agent: agent.name,
        step: stepNo,
        toolCallId: call?.id ?? null,
        toolMs: capMs(limits.toolMs, toolRoom()),
      }));
    }, { limit: limits.parallelTools, now });

    // A FAILED TOOL IS A RESULT, NEVER AN ABSENCE. The model is shown the error
    // so it can recover; dropping it would leave the model waiting for an answer
    // that never comes and re-asking for the same tool for ever.
    step.results = results.map((r) => ({
      index: r.index, name: asked[r.index]?.name ?? null, ms: r.ms,
      ok: r.ok, value: r.ok ? r.value : undefined,
      error: r.ok ? undefined : String(r.error?.message ?? r.error),
    }));
    steps.push(Object.freeze(step));

    messages.push({ role: "assistant", content: text, toolCalls: asked });
    messages.push({
      role: "tool",
      content: results.map((r) => ({
        id: asked[r.index]?.id ?? null,
        name: asked[r.index]?.name ?? null,
        ok: r.ok,
        result: r.ok ? r.value : String(r.error?.message ?? r.error),
      })),
    });
  }
}
