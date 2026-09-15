/**
 * THE RUN JOURNAL — an append-only record, and the replay that rebuilds a run
 * from it.
 *
 * WHY APPEND-ONLY. A container recycles and an isolate dies; that is not an edge
 * case on this stack, it is Tuesday. The one shape that survives a process
 * vanishing mid-write is a log you only ever add to: nothing is rewritten, so
 * there is no half-updated record to reason about, and the worst a crash can do
 * is lose the last entry. The root product learned the same thing the expensive
 * way and its rule is written as "store the raw answer ONCE, before anything can
 * refuse it" — three sessions each bought a narrower diagnostic field instead of
 * keeping the artifact.
 *
 * DEPENDENCY-FREE AND PURE. No storage: entries are handed in and handed out.
 * Where they are kept — Postgres, R2, a Durable Object, an array in a test — is
 * the caller's business and this module never needs to know.
 *
 * THE MESSAGE BUILDERS LIVE HERE, and that is the point of putting replay and the
 * loop behind one module. The loop composes messages as it goes; the replay
 * composes them again from the log. Two copies of that composition would drift,
 * and they would drift in the direction where a RESUMED run sends the model a
 * conversation subtly different from the one it would have had — the hardest
 * class of bug to see, because both halves look right on their own.
 */

import { addMeter, usageTokens } from "./meters.mjs";

export const ENTRY_KINDS = Object.freeze(["started", "model", "tool", "stopped"]);

// ── the entries ──────────────────────────────────────────────────────────────
export const startedEntry = (o) => Object.freeze({
  kind: "started", at: o.at, tenant: o.tenant ?? null, agent: o.agent,
  model: o.model, prompt: o.prompt, limits: o.limits ?? null,
});
export const modelEntry = (o) => Object.freeze({
  kind: "model", at: o.at, step: o.step, ms: o.ms, text: o.text ?? "",
  toolCalls: Object.freeze((o.toolCalls ?? []).map((c) => Object.freeze({ id: c.id ?? null, name: c.name ?? null, args: c.args }))),
  usage: o.usage ?? null, costMicros: o.costMicros ?? null,
});
export const toolEntry = (o) => Object.freeze({
  kind: "tool", at: o.at, step: o.step, index: o.index, name: o.name ?? null,
  ms: o.ms, ok: !!o.ok, value: o.ok ? o.value : undefined,
  error: o.ok ? undefined : String(o.error ?? ""),
});
export const stoppedEntry = (o) => Object.freeze({ kind: "stopped", at: o.at, stop: o.stop });

// ── the message shapes, in ONE place ─────────────────────────────────────────
export const userMessage = (prompt) => ({ role: "user", content: prompt });
export const assistantMessage = (text, toolCalls) =>
  (toolCalls && toolCalls.length ? { role: "assistant", content: text, toolCalls } : { role: "assistant", content: text });
export const toolMessage = (results) => ({ role: "tool", content: results });

/**
 * One tool result as the model is shown it. The SAME function serves the live
 * loop and the replay, so a resumed conversation cannot differ from the one the
 * run would have had.
 */
export const toolResultFor = (call, ok, valueOrError) => ({
  id: call?.id ?? null, name: call?.name ?? null, ok,
  result: ok ? valueOrError : String(valueOrError ?? ""),
});

/**
 * REBUILD A RUN FROM ITS LOG.
 *
 * Answers `{ status, messages, used, step, stop, pending, problems, ... }`.
 *
 * **`used.wallMs` IS WORK TIME, NOT CALENDAR TIME, and that is a decision rather
 * than a convenience.** A run that died at midnight and resumes at nine did not
 * spend nine hours working, and charging it nine hours against a wall-clock
 * budget would fail every resumed run on arrival. So the replayed wall is the SUM
 * OF THE RECORDED `ms` — the work that really happened — and the live loop adds
 * its own segment's elapsed on top. Said out loud because "wall clock" now means
 * something slightly different from what the words suggest.
 *
 * **A JUNK ENTRY IS NAMED, NEVER SKIPPED.** Entries come back from storage, which
 * means they come back from outside, which means they can be anything. Silently
 * ignoring one would rebuild a SHORTER conversation and a SMALLER bill than the
 * run really had — the meters would under-report and the model would be sent a
 * history missing a step. `problems` is how the caller finds out; a replay with
 * problems is one a caller should refuse to resume, and nothing here decides that
 * for them.
 */
export function replay(entries) {
  if (!Array.isArray(entries)) throw new TypeError("replay: entries must be an array");

  const problems = [];
  let started = null, stop = null;
  const models = new Map();            // step → the model entry
  const tools = new Map();             // step → Map(index → the tool entry)

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e === null || typeof e !== "object" || Array.isArray(e) || !ENTRY_KINDS.includes(e.kind)) {
      problems.push(`entry ${i}: not a journal entry`);
      continue;
    }
    if (e.kind === "started") {
      if (started) { problems.push(`entry ${i}: a second "started"`); continue; }
      started = e;
    } else if (e.kind === "model") {
      if (!Number.isInteger(e.step) || e.step < 1) { problems.push(`entry ${i}: model with no usable step`); continue; }
      if (models.has(e.step)) { problems.push(`entry ${i}: a second model answer for step ${e.step}`); continue; }
      models.set(e.step, e);
    } else if (e.kind === "tool") {
      if (!Number.isInteger(e.step) || !Number.isInteger(e.index)) { problems.push(`entry ${i}: tool with no usable step/index`); continue; }
      if (!tools.has(e.step)) tools.set(e.step, new Map());
      if (tools.get(e.step).has(e.index)) { problems.push(`entry ${i}: a second result for step ${e.step} tool ${e.index}`); continue; }
      tools.get(e.step).set(e.index, e);
    } else {
      if (stop) { problems.push(`entry ${i}: a second "stopped"`); continue; }
      stop = e.stop ?? null;
    }
  }

  const messages = [];
  const used = { steps: 0, toolCalls: 0, tokens: 0, costMicros: 0, wallMs: 0 };
  const pending = [];

  if (started) {
    messages.push(userMessage(started.prompt));
    used.wallMs = 0;
  } else if (entries.length) {
    problems.push('no "started" entry, so the run\'s own prompt and tenant are unknown');
  }

  // Steps in ASCENDING ORDER rather than append order. A tool entry always
  // follows its model entry in a healthy log, but a log is evidence rather than a
  // promise, and rebuilding a conversation out of order would be worse than
  // refusing to.
  for (const step of [...models.keys()].sort((a, b) => a - b)) {
    const m = models.get(step);
    used.steps += 1;
    used.tokens = addMeter(used.tokens, usageTokens(m.usage));
    used.costMicros = addMeter(used.costMicros, m.costMicros ?? null);
    used.wallMs += typeof m.ms === "number" && m.ms >= 0 ? m.ms : 0;

    const calls = m.toolCalls ?? [];
    messages.push(assistantMessage(m.text ?? "", calls));
    if (!calls.length) continue;

    // Counted the way the live loop counts it — the whole batch, when the batch
    // was asked for — or a resumed run would believe it had a bigger tool budget
    // left than it does.
    used.toolCalls += calls.length;

    const got = tools.get(step) ?? new Map();
    const results = [];
    for (let index = 0; index < calls.length; index++) {
      const t = got.get(index);
      if (!t) { pending.push({ step, index, name: calls[index]?.name ?? null, id: calls[index]?.id ?? null }); continue; }
      used.wallMs += typeof t.ms === "number" && t.ms >= 0 ? t.ms : 0;
      results.push(toolResultFor(calls[index], t.ok, t.ok ? t.value : t.error));
    }
    if (results.length) messages.push(toolMessage(results));
  }

  const status = stop ? "stopped" : (started ? "running" : "new");
  return Object.freeze({
    status,
    stop: stop ?? null,
    messages,
    used: Object.freeze(used),
    step: used.steps ? Math.max(...models.keys()) : 0,
    pending: Object.freeze(pending),
    problems: Object.freeze(problems),
    prompt: started?.prompt ?? null,
    tenant: started?.tenant ?? null,
    agent: started?.agent ?? null,
    model: started?.model ?? null,
    limits: started?.limits ?? null,
  });
}
