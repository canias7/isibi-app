// THE FAILURE DIAGNOSIS STEP, PHASE 1: SHADOW MODE (2026-10-24).
//
// The owner, 2026-10-24: *"give it a try … for the next round"* — when a
// build, an edit or an add-on part fails, the builder diagnoses the failure
// the way the "systematic-debugging" skill (obra/superpowers) asks a person
// to: read the real error and evidence, locate where it broke, form ONE
// root-cause hypothesis, propose ONE targeted fix. Never guess and retry.
//
// PHASE 1 ONLY RECORDS. The diagnosis is written beside the job
// (`jobs/<id>.diagnosis.json`, under the seven-day `jobs/` sweep). It changes
// no behaviour, sends nothing to the customer, and charges the customer
// nothing: the call's usage is logged, never debited. Phase 2 (acting on it
// from a fixed menu of safe moves) is the owner's later decision.
//
// OFF BY DEFAULT: `DIAGNOSE_FAILURES` = "on" switches it on. Anything else
// records nothing and makes no call.
//
// This module imports nothing from worker.js; the worker hands it a `send`.

/** The switch: `DIAGNOSE_FAILURES` = "on". */
export function diagnoseOn(env) {
  return !!(env && typeof env.DIAGNOSE_FAILURES === "string" && env.DIAGNOSE_FAILURES.trim().toLowerCase() === "on");
}

/** Where a job's diagnosis is kept: beside its other objects under `jobs/`. */
export const diagnosisKey = (id) => "jobs/" + id + ".diagnosis.json";

/** What kind of failure it was. One per diagnosis. */
export const DIAGNOSIS_KINDS = Object.freeze([
  "misroute",            // the request went to a step that cannot do it
  "empty-pick",          // a picker chose nothing to do
  "asked-after-charge",  // a question came after the customer was charged
  "invalid-model-output",// the model's answer failed a check
  "database-refused",    // Postgres refused a write (type, NOT NULL, CHECK, unique)
  "compile-failed",      // the page did not compile or render
  "provider-error",      // the model provider failed (balance, rate, outage)
  "timeout",             // a deadline ran out
  "capped",              // a limit dropped part of the work
  "other",
]);

/** The phase-2 menu, named now so a phase-1 proposal is comparable later. */
export const FIX_MOVES = Object.freeze(["retry-with-instruction", "re-route", "split", "ask-before-charge", "stand-in", "code-fix", "none"]);

/** Whether a retry, unchanged, would plausibly succeed. */
export const RETRY_VERDICTS = Object.freeze(["yes", "no", "unsure"]);

export const DIAGNOSE_MAX_TOKENS = 1200;
export const DIAGNOSE_MAX_EVIDENCE_CHARS = 12000;
const MAX_FIELD = 600;
const MAX_QUOTES = 6;

/**
 * THE METHOD, AS A SKILL-LIKE INSTRUCTION. Adapted from obra/superpowers'
 * systematic-debugging: the iron law (no fix without a root cause), its four
 * phases cut to what a model can do from a record alone.
 */
export const DIAGNOSE_SKILL = [
  "You are the website builder's failure diagnostician. A build, an edit or an add-on step has failed or ended partly done. You diagnose it from the evidence; you do not fix it, retry it, or speak to the customer.",
  "",
  "THE IRON LAW: NO PROPOSED FIX WITHOUT A ROOT CAUSE FOUND IN THE EVIDENCE. Guessing and retrying is forbidden.",
  "",
  "Work in four steps, in order:",
  "1. READ THE REAL ERROR. Read every line of the evidence: the customer's words, the step that ran, the route it was given, the model's answer, the check that failed, the error text and codes, what was charged. Do not skip a warning or a code (for example a database code such as 23502 means a NOT NULL column was left empty).",
  "2. LOCATE WHERE IT BROKE. Name the one step where the outcome first went wrong — not where it was noticed. Trace backwards: a refused write may come from a wrong route chosen earlier; a question may come after a charge that already landed.",
  "3. ONE HYPOTHESIS. State one root cause, specifically: \"X is the root cause because Y\". Do not list several. If the evidence cannot support one, say so and choose kind \"other\" with retry \"unsure\".",
  "4. ONE TARGETED FIX. Propose the smallest single change that addresses the root cause, and pick the move it is from the menu. Say whether retrying the same request unchanged would plausibly succeed (a provider outage may; a wrong route or a refused value will not).",
  "",
  "Each item of `evidence` must be copied word for word from the evidence you were given, so a reader can find it. Quote the lines that prove the cause; quote nothing you did not see.",
].join("\n");

export const DIAGNOSE_TOOL = Object.freeze({
  name: "record_diagnosis",
  description: "Record one diagnosis of the failure: its kind, the one root cause, the evidence quoted exactly, the one targeted fix and whether a plain retry would succeed.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...DIAGNOSIS_KINDS] },
      broke_at: { type: "string", description: "The one step where the outcome first went wrong." },
      root_cause: { type: "string", description: "One root cause: \"X is the root cause because Y\"." },
      evidence: { type: "array", items: { type: "string" }, description: "Lines copied exactly from the evidence that prove the cause." },
      proposed_fix: { type: "string", description: "The one smallest change that addresses the root cause." },
      fix_move: { type: "string", enum: [...FIX_MOVES] },
      retry_would_succeed: { type: "string", enum: [...RETRY_VERDICTS] },
    },
    required: ["kind", "broke_at", "root_cause", "evidence", "proposed_fix", "fix_move", "retry_would_succeed"],
  },
});

/**
 * WHETHER AN ENDED JOB'S ANSWER IS A FAILURE WORTH DIAGNOSING: not shipped,
 * `ok: false`, or partly done. A cancelled job is the customer's choice, not
 * a failure; an ok answer with nothing to do is not one either.
 */
export function needsDiagnosis({ status = 200, payload = null, shipped = null } = {}) {
  if (payload && typeof payload === "object" && payload.cancelled === true) return false;
  if (shipped === false) return true;
  if (Number(status) >= 400) return true;
  if (!payload || typeof payload !== "object") return Number(status) >= 400;
  if (payload.ok === false) return true;
  if (payload.partial === true || (payload.partial && typeof payload.partial === "object")) return true;
  return false;
}

const clip = (v, n) => {
  let s;
  if (typeof v === "string") s = v;
  else { try { s = JSON.stringify(v); } catch { s = ""; } }
  if (typeof s !== "string") s = "";
  return s.length > n ? s.slice(0, n) + "…" : s;
};

/** The payload fields that carry what really happened, in a fixed order. */
const PAYLOAD_FIELDS = ["ok", "error", "failure", "why", "stage", "layer", "route", "partial", "question", "asked", "failed", "applied", "added", "skipped", "deferred", "cost", "charged", "refunded", "code", "detail", "reply"];

/**
 * THE EVIDENCE, AS ONE BOUNDED TEXT, built only from recorded facts: the
 * operation, the customer's words, the route, the job's ended answer and any
 * extra lines (a trace's notes, a request part's record). Its own keys only
 * (`Object.hasOwn`); a non-string never coerced into a word.
 */
export function failureEvidence({ op = "", slug = "", words = "", status = null, payload = null, notes = [] } = {}) {
  const lines = [];
  if (typeof op === "string" && op) lines.push("OPERATION: " + op);
  if (typeof slug === "string" && slug) lines.push("SITE: " + slug);
  if (typeof words === "string" && words) lines.push("CUSTOMER'S WORDS: " + clip(words, 2000));
  if (status !== null && Number.isFinite(Number(status))) lines.push("HTTP STATUS: " + Number(status));
  if (payload && typeof payload === "object") {
    for (const k of PAYLOAD_FIELDS) {
      if (Object.hasOwn(payload, k) && payload[k] !== undefined && payload[k] !== null) lines.push("ANSWER." + k + ": " + clip(payload[k], 1500));
    }
  }
  if (Array.isArray(notes)) for (const n of notes) if (typeof n === "string" && n) lines.push("NOTE: " + clip(n, 1500));
  const text = lines.join("\n");
  return text.length > DIAGNOSE_MAX_EVIDENCE_CHARS ? text.slice(0, DIAGNOSE_MAX_EVIDENCE_CHARS) : text;
}

/** The one forced-tool request. */
export function diagnoseRequest({ evidence, model }) {
  return {
    model,
    max_tokens: DIAGNOSE_MAX_TOKENS,
    tools: [DIAGNOSE_TOOL],
    tool_choice: { type: "tool", name: DIAGNOSE_TOOL.name },
    system: [{ type: "text", text: DIAGNOSE_SKILL }],
    messages: [{ role: "user", content: "THE EVIDENCE OF THE FAILURE:\n" + String(evidence || "") }],
  };
}

const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

/**
 * THE DIAGNOSIS, READ AND CHECKED: every field present and of its type, each
 * enum one of its values, and every quoted line found in the evidence (step 1
 * of the method: a quote the model did not see is a guess, and a guess is
 * refused). `{ ok, diagnosis }` or `{ ok: false, why }`.
 */
export function readDiagnosis(reply, evidence) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : null;
  if (!blocks) return { ok: false, why: "unreadable" };
  const use = blocks.find((b) => b && b.type === "tool_use" && b.name === DIAGNOSE_TOOL.name);
  if (!use || !use.input || typeof use.input !== "object") return { ok: false, why: "unreadable" };
  const i = use.input;
  if (!DIAGNOSIS_KINDS.includes(i.kind)) return { ok: false, why: "kind" };
  if (!FIX_MOVES.includes(i.fix_move)) return { ok: false, why: "fix-move" };
  if (!RETRY_VERDICTS.includes(i.retry_would_succeed)) return { ok: false, why: "retry" };
  for (const f of ["broke_at", "root_cause", "proposed_fix"]) if (!nonEmpty(i[f])) return { ok: false, why: f };
  if (!Array.isArray(i.evidence) || i.evidence.length === 0) return { ok: false, why: "evidence" };
  const quotes = i.evidence.slice(0, MAX_QUOTES);
  if (!quotes.every((q) => nonEmpty(q))) return { ok: false, why: "evidence" };
  const seen = String(evidence || "");
  const unseen = quotes.filter((q) => !seen.includes(q.trim()));
  if (unseen.length) return { ok: false, why: "unseen-evidence", unseen };
  return {
    ok: true,
    diagnosis: {
      kind: i.kind,
      broke_at: clip(i.broke_at.trim(), MAX_FIELD),
      root_cause: clip(i.root_cause.trim(), MAX_FIELD),
      evidence: quotes.map((q) => clip(q.trim(), MAX_FIELD)),
      proposed_fix: clip(i.proposed_fix.trim(), MAX_FIELD),
      fix_move: i.fix_move,
      retry_would_succeed: i.retry_would_succeed,
    },
  };
}

/**
 * ONE DIAGNOSIS: one call, read and checked. Never throws; a failed call or an
 * unreadable answer is recorded as such, never as a diagnosis. No retry: the
 * step is an instrument, and an instrument does not spend twice.
 */
export async function diagnose(deps, { evidence, model }) {
  if (!deps || typeof deps.send !== "function") return { ok: false, why: "send" };
  if (!nonEmpty(evidence)) return { ok: false, why: "no-evidence" };
  let reply;
  try { reply = await deps.send(diagnoseRequest({ evidence, model })); }
  catch (e) { return { ok: false, why: "call", error: clip((e && e.message) || String(e), 200) }; }
  const read = readDiagnosis(reply, evidence);
  const usage = reply && reply.usage && typeof reply.usage === "object" ? reply.usage : null;
  return { ...read, ...(usage ? { usage } : {}) };
}

/**
 * THE RECORD WRITTEN BESIDE THE JOB. `shadow: true` says what phase 1 is: no
 * behaviour followed from it, and `charged: 0` says the customer paid nothing.
 */
export function diagnosisRecord({ id, op, at, evidence, out }) {
  return {
    id: String(id || ""),
    op: String(op || ""),
    at: Number(at) || 0,
    shadow: true,
    charged: 0,
    evidence: String(evidence || ""),
    ...(out && out.ok ? { diagnosis: out.diagnosis } : { unread: (out && out.why) || "unknown" }),
    ...(out && out.usage ? { usage: out.usage } : {}),
  };
}

/**
 * THE WHOLE STEP for one ended job: switch, failure test, evidence, the call,
 * the record. `deps`: `{ env, send, put(key, text), model, now }`. Returns the
 * record written, or null when nothing was owed. Never throws.
 */
export async function diagnoseJobEnded(deps, { id, op, slug = "", words = "", status = 200, payload = null, shipped = null, notes = [] } = {}) {
  try {
    if (!deps || !diagnoseOn(deps.env)) return null;
    if (typeof id !== "string" || !id || typeof deps.put !== "function") return null;
    if (!needsDiagnosis({ status, payload, shipped })) return null;
    const evidence = failureEvidence({ op, slug, words, status, payload, notes });
    const out = await diagnose({ send: deps.send }, { evidence, model: deps.model });
    const rec = diagnosisRecord({ id, op, at: typeof deps.now === "function" ? deps.now() : Date.now(), evidence, out });
    await deps.put(diagnosisKey(id), JSON.stringify(rec));
    return rec;
  } catch {
    return null;
  }
}
