/**
 * RETRY ONCE WITH THE CHECK'S OWN REASON (owner, 2026-10-24).
 *
 * Wherever a model's answer fails an exact check we already run — the tweak's
 * edits that did not apply or broke the page, a router's held-back part not
 * found in the message, a picker that named no lane, a menu answer that changed
 * nothing, a data answer that matched no row — the SAME request is sent once
 * more with the model's own previous answer and a turn stating, in plain words,
 * which check it failed. Then the step reads the second answer exactly as it
 * read the first; a second failure is the step's existing refusal or climb.
 *
 * ⚠ THE SAME MODEL AND THE SAME EFFORT, BY CONSTRUCTION (the owner's explicit
 * choice: do not raise the effort, do not switch the model). The retry request
 * is the first request object spread, with only `messages` extended — so every
 * field that picks the model or the effort (`model`, `thinking`, `effort`,
 * `reasoning_effort`, `output_config`, …) is the first request's own bytes.
 *
 * ONE RETRY, NEVER A LOOP: `withReasonRetry` runs the step at most twice.
 *
 * Plain module, no I/O: the model call stays injected (`deps.send`).
 */

/**
 * The retry request: the first request, its messages followed by the model's
 * previous answer and one user turn carrying the reason. When the answer used
 * tools, every `tool_use` is answered with a `tool_result` marked `is_error`
 * (the API requires each one answered), the reason on the first; otherwise the
 * reason is a plain user turn.
 */
export function retryRequest(request, reply, reason) {
  const req = request && typeof request === "object" ? request : {};
  const before = Array.isArray(req.messages) ? req.messages : [];
  const content = reply && Array.isArray(reply.content) ? reply.content : [];
  const uses = content.filter((b) => b && b.type === "tool_use");
  const said = String(reason || "").trim() || "Your answer failed a check.";
  const turn = uses.length
    ? uses.map((u, i) => ({ type: "tool_result", tool_use_id: u.id || "tool", is_error: true, content: i === 0 ? said : "Not applied: see the first error." }))
    : [{ type: "text", text: said }];
  return {
    ...req,
    messages: [
      ...before,
      { role: "assistant", content: content.length ? content : [{ type: "text", text: "(no answer)" }] },
      { role: "user", content: turn },
    ],
  };
}

/** Two usage records added, field by numeric field; either may be null. */
export function addUsages(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (typeof b[k] === "number" && Number.isFinite(b[k])) out[k] = (typeof a[k] === "number" && Number.isFinite(a[k]) ? a[k] : 0) + b[k];
    else if (!(k in out)) out[k] = b[k];
  }
  return out;
}

/**
 * Call a caller's mark, never letting it throw: `mark(step, reason, ok)`. The
 * trace mark is `retry_reason {step, reason, ok}`.
 */
export function markRetry(mark, step, reason, ok) {
  try { if (typeof mark === "function") mark({ step: String(step), reason: String(reason), ok: ok === true }); } catch { /* an instrument never costs the step */ }
}

/** A mark function for an edit trace (`builder/edit-trace.mjs`), or undefined. */
export function traceRetryMark(trace) {
  if (!trace || typeof trace.mark !== "function") return undefined;
  return (d) => { try { trace.mark("retry_reason", d.ok ? "ok" : "fail", d); } catch { /* never */ } };
}

/** A mark for a route that keeps no trace row: the log line `retry_reason {…}`. */
export function logRetryMark(d) {
  try { console.log("retry_reason", JSON.stringify(d)); } catch { /* never */ }
}

/**
 * Run a step that makes ONE model call through `deps.send`; when its result
 * fails a check (`reasonOf(result)` answers the reason sentence and its code),
 * run it once more with that call's request extended by `retryRequest`.
 *
 *   step      — the name the trace mark carries
 *   run(deps) — the step itself
 *   reasonOf  — (result) => null | { code, text }
 *   usageKey  — where the step keeps its usage on the result (default `usage`)
 *   wrapDeps  — (deps, firstUsage) => deps for the second run (e.g. a reserve
 *               funnel that must see the summed usage)
 *
 * A step that made other than exactly one call (a widened second call, a
 * provider failure) is not retried: its last request is not the request whose
 * answer was judged. The result carries `retryReason: {step, reason, ok}`
 * when a retry ran, and its usage is both calls' together.
 */
export async function withReasonRetry({ step, deps, run, reasonOf, usageKey = "usage", wrapDeps = null, mark = null }) {
  const calls = [];
  const send = deps && deps.send;
  const first = await run({ ...deps, send: async (req) => { const r = await send(req); calls.push({ req, reply: r }); return r; } });
  const why = calls.length === 1 && first ? await reasonOf(first) : null;
  if (!why) return first;
  const { req, reply } = calls[0];
  let sent = false;
  const again = { ...deps, send: async (r) => { if (sent) return send(r); sent = true; return send(retryRequest(req, reply, why.text)); } };
  let second;
  try {
    second = await run(wrapDeps ? wrapDeps(again, first[usageKey] || null) : again);
  } catch (e) {
    markRetry(mark, step, why.code, false);
    return { ...first, retryReason: { step, reason: why.code, ok: false }, retryError: e };
  }
  // THE RETRY'S OWN CALL FAILED (the provider, a cut-off answer): the first
  // answer's refusal stands, as it would have without the retry.
  if (!second || second.failed === true || second.reason === "send") {
    markRetry(mark, step, why.code, false);
    return { ...first, retryReason: { step, reason: why.code, ok: false } };
  }
  const ok = !(await reasonOf(second));
  markRetry(mark, step, why.code, ok);
  // PAY ONLY FOR WHAT WORKED (owner, 2026-10-24, round 2): a step that still
  // ends refused after its retry carries the FIRST call's usage only — exactly
  // what it charged before retries existed — and the retry's own tokens ride
  // apart (`retryUsage`, for the record, ours). Only a retry that passed its
  // check AND ended in a step that succeeded is billed as both calls.
  const second_ = (second && second[usageKey]) || null;
  if (!ok || second.ok === false) return { ...second, [usageKey]: first[usageKey] || null, retryUsage: second_, retryReason: { step, reason: why.code, ok } };
  const usage = addUsages(first[usageKey] || null, second_);
  return { ...second, [usageKey]: usage, retryReason: { step, reason: why.code, ok } };
}

/**
 * A model call shaped `(keys, request, budget)` that remembers its last
 * request and answer (`rec.last`), and `rec.again(reason)`: a call of the same
 * shape that sends, in place of whatever request it is handed, the remembered
 * request extended by `retryRequest` — the SAME model and effort by
 * construction. For writers whose call is injected deep inside a pipeline
 * (the page writer, the add-on writer, the build's pages call).
 */
export function recordCall(call) {
  const rec = { last: null };
  rec.call = async (keys, req, budget) => {
    const reply = await call(keys, req, budget);
    rec.last = { req, reply };
    return reply;
  };
  rec.again = (reason, via = call) => async (keys, req, budget) => {
    const sent = rec.last ? retryRequest(rec.last.req, rec.last.reply, reason) : req;
    const reply = await via(keys, sent, budget);
    rec.last = { req: sent, reply };
    return reply;
  };
  return rec;
}
