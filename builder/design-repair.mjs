/**
 * A FIRST BUILD'S DESIGN, RECOVERED RATHER THAN ABANDONED (2026-10-08, the
 * ninth Build batch: Codex reproduced a first Build whose design came back
 * unusable — exactly one `design_schema` call, then `design-unusable`, and
 * nothing tried to correct it).
 *
 * WHAT WENT WRONG DECIDES WHAT HAPPENS NEXT. A designer's answer that is the
 * model's own mistake (no tool call, required fields missing, arguments that
 * would not parse) or that ran out of room is corrected by the model itself, in
 * one bounded attempt told exactly what was wrong and shown what it had
 * already written. A provider that was busy or dropped the connection before
 * answering is asked again, once. An account or billing refusal, a request the
 * provider rejects as malformed (ours, which asking again cannot fix) and our
 * own time ceiling are not retried: no attempt would help. And a decision only
 * the customer can make is asked of them, in the model's own words, through
 * the question field every step already shares (`withQuestion`).
 *
 * PURE, so the decisions can be driven: the route supplies what it observed
 * (the answer, the error, the provider's status and type, the clock) and acts
 * on what this answers. Nothing here calls a model or writes anything.
 */
import { readAsk } from "./clarify.mjs";
import { designUsable } from "./site-plan.mjs";

/** At most one corrective attempt and one provider retry per design. */
export const DESIGN_REPAIR_MAX = 1;
export const DESIGN_RETRY_MAX = 1;
/**
 * The least time a further design call needs. A design call has taken up to a
 * couple of minutes; one started with less than this left would leave no time
 * for the pages it exists to serve, so it is not started.
 */
export const DESIGN_RETRY_FLOOR_MS = 150000;

const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const TRANSIENT_TYPE = new Set(["overloaded_error", "rate_limit_error", "api_error", "timeout_error"]);

/**
 * WHAT A DESIGN STEP'S ENDING WAS. `answer` is the designer's return
 * (`{ input, shape }`) or null when it threw; `error` what it threw;
 * `upstream` the route's reading of the provider's answer (`upstreamKind`:
 * `{ type, billing }`) with `status`; `timeout` whether it was our own clock.
 * Answers `{ kind, retry, missing?, why }`:
 *   ok           a usable design
 *   malformed    the model's mistake: no tool call, required fields missing,
 *                unparseable arguments — corrected by the model (`retry:
 *                "repair"`)
 *   truncated    the answer ran out of room — corrected by the model, told to
 *                keep every requirement and write more tightly (`repair`)
 *   transient    the provider busy, rate-limited or the connection dropped
 *                before an answer — asked again as it was (`again`)
 *   account      a billing, quota or credentials refusal — never retried
 *   rejected     the provider refused the request itself (a 400 that is not
 *                billing): ours, and asking again cannot fix it — never retried
 *   timeout      our own time ceiling — never retried (no time is left)
 */
export function designFailure({ answer = null, error = null, upstream = null, status = null, timeout = false } = {}) {
  if (!error) {
    const input = answer && answer.input;
    const usable = designUsable(input);
    if (usable.ok) return { kind: "ok", retry: null };
    const fromShape = answer && answer.shape && Array.isArray(answer.shape.missing) ? answer.shape.missing.map(String) : [];
    const missing = [...new Set([...usable.missing, ...fromShape])];
    const why = answer && answer.shape && answer.shape.tool === false ? "no-tool-call" : "fields-missing";
    return { kind: "malformed", retry: "repair", missing, why };
  }
  if (error && error.truncated) return { kind: "truncated", retry: "repair", why: "max-tokens" };
  if (timeout) return { kind: "timeout", retry: null, why: "ceiling" };
  const up = upstream && typeof upstream === "object" ? upstream : {};
  if (up.billing) return { kind: "account", retry: null, why: "billing" };
  const code = Number(status) || 0;
  if (code === 401 || code === 403) return { kind: "account", retry: null, why: "credentials" };
  if (TRANSIENT_STATUS.has(code) || (up.type && TRANSIENT_TYPE.has(up.type))) return { kind: "transient", retry: "again", why: "provider-" + (code || up.type) };
  if (code >= 400) return { kind: "rejected", retry: null, why: "status-" + code };
  // NO STATUS AND NOT OUR CLOCK: the request never got an answer (a dropped
  // connection, a reset socket) — the same reading `retryHere` gives a call
  // that may be made again.
  return { kind: "transient", retry: "again", why: "no-response" };
}

/**
 * MAY ANOTHER CALL BE MADE NOW? Bounded per kind of retry, by the attempts
 * already recorded (`done`, the durable record's own list, so a redelivered
 * job counts the attempts an earlier delivery made), and by the time left.
 */
export function mayRetry(failure, done = [], { remainingMs = null, floorMs = DESIGN_RETRY_FLOOR_MS } = {}) {
  if (!failure || !failure.retry) return { ok: false, why: failure ? "not-retryable" : "no-failure" };
  const list = Array.isArray(done) ? done : [];
  const used = list.filter((a) => a && a.retry === failure.retry).length;
  const max = failure.retry === "repair" ? DESIGN_REPAIR_MAX : DESIGN_RETRY_MAX;
  if (used >= max) return { ok: false, why: "attempts-used" };
  if (typeof remainingMs === "number" && Number.isFinite(remainingMs) && remainingMs < floorMs) return { ok: false, why: "no-time" };
  return { ok: true };
}

/** The model's own earlier answer, as it can be shown back to it: whole up to the bound, never silently shorter. */
export const REPAIR_SHOWN_CHARS = 16000;

/**
 * WHAT THE CORRECTIVE ATTEMPT IS TOLD, appended to the same request (the same
 * brief, the same answers, the same attached files). The validation failures
 * by name, the answer it already gave (when there is one) so nothing right in
 * it is lost, and the rules that keep the build whole: every page, feature,
 * table and requirement the request asks for stays; nothing is dropped to fit.
 * When the earlier answer is longer than the bound it is cut AND SAID TO BE
 * CUT, so the model does not read the end of its own answer as the end.
 */
export function repairNote(failure, partial = null) {
  const lines = ["", "", "YOUR PREVIOUS ANSWER TO THIS REQUEST COULD NOT BE USED, and this is your one chance to correct it."];
  if (failure && failure.kind === "truncated") {
    lines.push("It ran out of room before it was complete. Answer again, complete, with tighter wording: shorter descriptions and fewer sample rows. Keep every page, feature, table and requirement the request asks for — never drop one to fit.");
  } else {
    const missing = failure && Array.isArray(failure.missing) && failure.missing.length ? failure.missing : ["the design"];
    lines.push(failure && failure.why === "no-tool-call"
      ? "It did not use the design tool at all. Answer with the design tool."
      : "These required parts were missing or empty: " + missing.join(", ") + ".");
    lines.push("Answer again with the COMPLETE design: every required part filled in, and every page, feature, table and requirement the request asks for kept.");
  }
  if (partial && typeof partial === "object" && !Array.isArray(partial) && Object.keys(partial).length) {
    let shown = "";
    try { shown = JSON.stringify(partial); } catch { shown = ""; }
    if (shown) {
      const cut = shown.length > REPAIR_SHOWN_CHARS;
      lines.push("What you answered before (keep every part of it that was right):");
      lines.push(cut ? shown.slice(0, REPAIR_SHOWN_CHARS) + " … [cut here: the rest of your earlier answer is not shown]" : shown);
    }
  }
  lines.push("Use their own words, their earlier answers and the files they attached to settle anything you can. ONLY if a decision that is theirs alone blocks a complete design — nothing you were given settles it — leave the design out and ask them that one thing in `question`.");
  return lines.join("\n");
}

/**
 * THE CORRECTIVE ATTEMPT'S ENDING: a usable design, a question for them, or
 * still not usable. The question is read by the shared reader (`readAsk`): a
 * question it cannot show whole is not a question, and a usable design always
 * wins over a question asked beside it.
 */
export function repairOutcome(answer) {
  const input = answer && answer.input;
  const usable = designUsable(input);
  if (usable.ok) return { kind: "repaired" };
  const ask = input && typeof input === "object" ? readAsk(input.question) : null;
  if (ask && !ask.unusable && typeof ask.text === "string" && ask.text.trim()) return { kind: "question", question: { text: ask.text, options: Array.isArray(ask.options) ? ask.options.slice() : [] } };
  return { kind: "still-unusable", missing: usable.missing };
}

/** Two usages summed, field by field, so every call made is the one the ledger settles. */
export function addUsage(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const n = (x) => Math.max(0, Number(x) || 0);
  return { ...a, in: n(a.in) + n(b.in), out: n(a.out) + n(b.out), cacheRead: n(a.cacheRead) + n(b.cacheRead), cacheWrite: n(a.cacheWrite) + n(b.cacheWrite) };
}
