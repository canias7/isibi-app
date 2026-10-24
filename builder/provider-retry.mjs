// A MODEL PROVIDER THAT IS DOWN IS WAITED FOR, NOT FAILED ON (owner, 2026-10-24).
//
// The owner's design (docs/plans/2026-10-24-model-failures.md, "The owner's
// design for the waiting notice" and "The exact fixed messages"):
//
//   - WHICH FAILURES: the provider-side kinds only — 503 unavailable, 502, 504,
//     500, 429 (waiting at least as long as the provider asks), and a connection
//     dropped mid-answer, including an error sent INSIDE the stream with no HTTP
//     status (xAI's `unavailable`), whose word is mapped to the standard code.
//     NOT out of credit, a bad or revoked key, a bad request, a model not found,
//     a cut-off answer, a refusal or a wrong-shape answer: those keep their own
//     handling (they are refused here, so the caller sees exactly what it saw).
//   - RETRY ONLY THE CALL THAT FAILED, every 5 minutes, with NO attempt count,
//     until the model answers. Inside a job, while the job's deadline leaves
//     room for one more wait; past it the call is PARKED ("waiting for Grok")
//     and the background tick resumes the job from its saved step.
//   - A FIXED NOTICE, never model-written (the model may be the thing that is
//     down): the code and its name, the provider's own words, its status page,
//     and a live countdown. "✓ <Model> is answering again" on recovery; "Stopped.
//     Nothing was built or charged for this part." on a Stop while waiting.
//
// This reverses audit A23-3's "a provider's error is its answer, never asked
// again" FOR THE RETRYABLE KINDS ONLY: a 503 or an in-stream `unavailable` is
// the provider saying "not now", which is exactly what waiting fixes.
//
// NOTHING HERE PERFORMS I/O OR READS A CLOCK: `now` and `sleep` are handed in,
// so every branch — the countdown, the 429 wait, the park past the deadline,
// the Stop — is driven in the unit suite with a fake clock and a stub wire.

/** The wait between tries (owner: "every 5 minutes"). */
export const PROVIDER_RETRY_MS = 5 * 60 * 1000;
/** Room kept before the job's deadline for the call itself after a wait. */
export const PROVIDER_PARK_MARGIN_MS = 3 * 60 * 1000;
/** A Stop is read at least this often while a wait runs. */
export const PROVIDER_STOP_POLL_MS = 10 * 1000;
/** The provider's own words, at most this long (the same cap `xaiErrorDetail` keeps). */
export const PROVIDER_WORDS_MAX = 300;
/** Where a parked job's record lives (under `jobs/`, which nothing serves; the key names the job). */
export const WAITING_PREFIX = "jobs/waiting/";
export const waitingKey = (id) => WAITING_PREFIX + String(id) + ".json";
/** The job's current notice, read by its poll. */
export const noticeKey = (id) => "jobs/" + String(id) + ".wait.json";

/** The standard names, exactly as the owner's table spells them. */
export const STATUS_NAMES = Object.freeze({
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  429: "Too Many Requests",
  529: "Overloaded",
});
export const RETRY_STATUSES = Object.freeze(Object.keys(STATUS_NAMES).map(Number));

/** A provider's word with no number, mapped to the standard code (owner: unavailable → 503, overloaded → 529, rate limited → 429). */
export const WORD_CODES = Object.freeze({
  unavailable: 503, service_unavailable: 503,
  overloaded: 529, overloaded_error: 529,
  rate_limit: 429, rate_limited: 429, rate_limit_error: 429, rate_limit_exceeded: 429, too_many_requests: 429, resource_exhausted: 429,
  bad_gateway: 502,
  gateway_timeout: 504, deadline_exceeded: 504,
  internal: 500, internal_error: 500, internal_server_error: 500, server_error: 500, api_error: 500,
});

/** Our account or our key: never waited for, whatever the status says. */
const ACCOUNT_TYPES = new Set(["insufficient_quota", "billing_error", "billing", "payment_required", "credit_balance", "permission_error", "authentication_error", "invalid_api_key"]);
const ACCOUNT_WORDS = /\b(credit|credits|billing|quota|balance|payment|insufficient funds|spending limit|api key|unauthori[sz]ed)\b/i;

/** A transport death: the request went out and no answer came back. Our own clock (TimeoutError/AbortError) is not one. */
const DROPPED_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT", "EPIPE", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "UND_ERR_SOCKET", "UND_ERR_CLOSED"]);
const DROPPED_WORDS = /stream ended early|connection closed|socket hang up|fetch failed|other side closed|network (?:error|connection)|terminated|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE/i;

/** The model's name as the customer reads it. */
export function modelName(model) {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("grok") || m.includes("xai")) return "Grok";
  if (m.startsWith("claude") || m.includes("anthropic")) return "Claude";
  return "The model";
}
/** The provider's own status page (owner: status.x.ai for Grok, status.claude.com for Claude). */
export function statusLink(model) {
  const n = modelName(model);
  if (n === "Grok") return "https://status.x.ai";
  if (n === "Claude") return "https://status.claude.com";
  return null;
}

/** The provider's words, cleaned: control characters out, whitespace folded, capped. Never anything but a string. */
// CREDENTIAL SHAPES, never shown (2026-10-24, the re-land): the owner's notice
// quotes the provider word for word, but a provider that echoes a key, a
// bearer token or a connection string back must not put it on a page. Each is
// replaced by "[hidden]"; every other word stays as sent.
const CREDENTIAL_SHAPES = [
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g, /\bsk-[A-Za-z0-9_-]{16,}/g, /\bxai-[A-Za-z0-9_-]{16,}/g,
  /\bBearer\s+[^\s"',;]+/gi, /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@"']+@[^\s"']+/gi, /\bnpg_[A-Za-z0-9]{6,}/g,
];
export function cleanWords(w) {
  if (typeof w !== "string") return null;
  let t = w;
  for (const re of CREDENTIAL_SHAPES) t = t.replace(re, "[hidden]");
  const s = t.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, PROVIDER_WORDS_MAX);
  return s || null;
}

/** The type and the message out of an error's `detail` (xAI's translated envelope, Anthropic's own, or plain text). */
export function errorFacts(e) {
  const d = e && typeof e.detail === "string" ? e.detail : "";
  let type = null, message = null;
  if (d) {
    let body = null;
    try { body = JSON.parse(d); } catch { body = null; }
    if (body && typeof body === "object") {
      const err = body.error && typeof body.error === "object" ? body.error : null;
      const t = (err && (err.type || err.code)) || body.code || (body.type !== "error" ? body.type : null);
      type = typeof t === "string" && /^[A-Za-z_]{1,40}$/.test(t) ? t.toLowerCase() : null;
      message = cleanWords((err && err.message) || (typeof body.error === "string" ? body.error : null) || body.message || null);
    } else {
      // A BODY CUT AT ITS CAP (the detail is kept to 300 characters) no longer
      // parses: its message is read up to the cut rather than the raw envelope
      // shown (2026-10-24, the re-land).
      const m = d.trimStart().startsWith("{") ? d.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/) : null;
      message = cleanWords(m ? m[1].replace(/\\(.)/g, "$1") : d);
      if (m) {
        const types = [...d.matchAll(/"(?:type|code)"\s*:\s*"([A-Za-z_]{1,40})"/g)].map((x) => x[1]).filter((x) => x !== "error");
        type = types.length ? types[types.length - 1].toLowerCase() : null;
      }
    }
  }
  return { type, message };
}

/** A retry-after header's value (seconds or an HTTP date), in ms from `now`; null when absent or unreadable. */
export function retryAfterMs(v, now = 0) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  const at = Date.parse(s);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

/**
 * IS THIS A FAILURE WORTH WAITING FOR? The facts for the notice, or null —
 * and null is every kind the owner kept out: our account, our key, a bad
 * request, a missing model, our own clock, our own sentences, the answer's
 * own faults (those never arrive as a thrown provider error at all).
 */
export function providerFailure(e, model, { now = 0 } = {}) {
  if (!e || typeof e !== "object") return null;
  const name = typeof e.name === "string" ? e.name : "";
  if (name === "TimeoutError" || name === "AbortError") return null;
  if (typeof e.message === "string" && /_API_KEY is not set$/.test(e.message)) return null;
  if (e.truncated) return null;
  const { type, message } = errorFacts(e);
  if (type && ACCOUNT_TYPES.has(type)) return null;
  if (message && ACCOUNT_WORDS.test(message)) return null;
  const base = { model: modelName(model), link: statusLink(model), words: message, type };
  const status = Number.isInteger(e.status) ? e.status : null;
  if (status !== null) {
    if (!RETRY_STATUSES.includes(status)) return null;
    const after = status === 429 ? retryAfterMs(e.retryAfter, now) : null;
    return { ...base, code: status, name: STATUS_NAMES[status], retryAfterMs: after };
  }
  // AN ERROR SENT DOWN THE OPEN STREAM: no number, only the provider's word.
  if (name === "StreamError") {
    const code = type && Object.hasOwn(WORD_CODES, type) ? WORD_CODES[type] : null;
    if (code === null) return null;
    return { ...base, code, name: STATUS_NAMES[code], retryAfterMs: null };
  }
  // A CONNECTION DROPPED MID-ANSWER, or a stream gone silent.
  const cause = e.cause && typeof e.cause === "object" ? e.cause : null;
  const code = (cause && typeof cause.code === "string" && cause.code) || (typeof e.code === "string" ? e.code : "");
  const dropped = name === "IdleTimeoutError" || DROPPED_CODES.has(code) || DROPPED_WORDS.test(typeof e.message === "string" ? e.message : "")
    || (cause && typeof cause.message === "string" && DROPPED_WORDS.test(cause.message));
  if (!dropped) return null;
  return { ...base, code: null, name: "No response", words: null, retryAfterMs: null };
}

/** How long to wait before the next try: 5 minutes, or longer when a 429 names a longer wait. */
export function waitMsFor(f) {
  const after = f && Number.isFinite(f.retryAfterMs) ? f.retryAfterMs : 0;
  return Math.max(PROVIDER_RETRY_MS, after);
}

/** m:ss, as the countdown shows it ("4:59"). */
export function clock(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** The title line, exactly as the owner's table spells it. */
export function noticeTitle(f) {
  if (!f) return "";
  return f.code ? "⚠ " + f.model + " error " + f.code + " · " + f.name : "⚠ " + f.model + " connection dropped · No response";
}

/**
 * THE WAITING NOTICE: fixed text, the facts it is made of, and when the next
 * try is (`until`, the server's clock; `at`, when this was said), so the
 * browser counts down from what the server knows. The countdown's own text is
 * `kept(remainingMs)`; the "said" part is null when the provider sent no words.
 */
export function waitNotice(f, { now, waitMs = waitMsFor(f) } = {}) {
  return {
    kind: "provider-wait",
    model: f.model, code: f.code || null, name: f.name, words: f.words || null, link: f.link || null,
    title: noticeTitle(f),
    said: f.words ? f.model + " said: " + f.words : null,
    kept: keptLine(waitMs),
    waitMs, at: now, until: now + waitMs,
  };
}
export const keptLine = (ms) => "Your work so far is kept. Retrying in " + clock(ms) + " · no charge while waiting";
export const recoveredLine = (model) => "✓ " + model + " is answering again · picking up where it stopped";
export const STOPPED_LINE = "Stopped. Nothing was built or charged for this part.";
export const recoveredNotice = (f, now) => ({ kind: "provider-recovered", model: f.model, code: f.code || null, title: recoveredLine(f.model), at: now });
export const stoppedNotice = (f, now) => ({ kind: "provider-stopped", model: f ? f.model : null, title: STOPPED_LINE, at: now });
/** The panel row: "⚠ Events page · Grok 503 · retrying in 4:59". */
export function panelRow(label, f, ms) {
  const what = f.code ? f.model + " " + f.code : f.model + " connection dropped";
  return "⚠ " + (label ? label + " · " : "") + what + " · retrying in " + clock(ms);
}

const realSleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** A wait cut into slices so a Stop is read while it runs. True when it ran out, false when stopped. */
async function waitOut(ms, { sleep, stopped, pollMs }) {
  let left = ms;
  while (left > 0) {
    if (await stopped()) return false;
    const step = Math.min(left, pollMs);
    await sleep(step);
    left -= step;
  }
  return !(await stopped());
}

/**
 * ASK AGAIN, EVERY 5 MINUTES, UNTIL THE MODEL ANSWERS — only `fn`, the one
 * call that failed. No attempt count (owner, 2026-10-24).
 *
 *   deadlineAt  the job's own deadline; a wait that would end inside
 *               `marginMs` of it is not started and the call is PARKED:
 *               the original error is rethrown with `parked: true` and
 *               `providerWait` (the facts, the notice, `resumeAt`), so every
 *               caller's existing handling still reads its status and detail.
 *               Absent (a request-response route, a Worker consumer) parks at
 *               once: nothing here ever sleeps where no deadline was named.
 *   stopped()   the customer's Stop, read before each try and through a wait;
 *               a Stop throws `ProviderStopped` (`stopped: true`).
 *   onWait / onRecover / onPark / onStop   the job's notice sink; never awaited
 *               past a throw (a display fault never costs the call).
 */
export async function withProviderRetry(fn, {
  model = "", now = Date.now, sleep = realSleep, deadlineAt = null, marginMs = PROVIDER_PARK_MARGIN_MS,
  pollMs = PROVIDER_STOP_POLL_MS, stopped = () => false, onWait = null, onRecover = null, onPark = null, onStop = null, log = () => {},
} = {}) {
  let last = null;
  const safe = (cb, v) => { try { if (typeof cb === "function") cb(v); } catch { /* the notice is a courtesy */ } };
  const stop = () => {
    const s = new Error("stopped while waiting for " + (last ? last.model : "the model"));
    s.name = "ProviderStopped";
    s.stopped = true;
    s.providerWait = last ? { facts: last } : null;
    safe(onStop, stoppedNotice(last, now()));
    return s;
  };
  for (;;) {
    if (last && (await stopped())) throw stop();
    let out;
    try {
      out = await fn();
    } catch (e) {
      const t = now();
      const f = providerFailure(e, model, { now: t });
      if (!f) throw e;
      last = f;
      const wait = waitMsFor(f);
      const notice = waitNotice(f, { now: t, waitMs: wait });
      if (!Number.isFinite(deadlineAt) || t + wait + marginMs > deadlineAt) {
        // `inline` (2026-10-24, the re-land): no deadline AND no job sink to
        // park into — a request answered in place (the inline build). Nothing
        // can resume it, so its caller keeps its own older in-request retry
        // (`designFailure` reads it); it must never fail faster than before.
        const inline = !Number.isFinite(deadlineAt) && typeof onPark !== "function";
        try { e.parked = true; e.providerWait = { facts: f, notice, resumeAt: t + wait, inline }; } catch { /* a frozen error still throws */ }
        safe(onPark, notice);
        log("model call parked — " + notice.title);
        throw e;
      }
      safe(onWait, notice);
      log("model call waiting — " + notice.title + " — asking again in " + clock(wait));
      if (!(await waitOut(wait, { sleep, stopped, pollMs }))) throw stop();
      continue;
    }
    if (last) safe(onRecover, recoveredNotice(last, now()));
    return out;
  }
}

/** The record a parked job leaves for the tick. */
export function parkRecord({ id, kind, holder = "", slug = "", uid = "", notice, now }) {
  return { v: 1, id: String(id), kind: String(kind), holder: String(holder || ""), slug: String(slug || ""), uid: String(uid || ""), since: now, resumeAt: notice && Number.isFinite(notice.until) ? notice.until : now + PROVIDER_RETRY_MS, notice };
}

/** A record as the tick reads it: null when it is not one. */
export function readPark(v) {
  if (!v || typeof v !== "object" || v.v !== 1) return null;
  if (typeof v.id !== "string" || !v.id || (v.kind !== "edit" && v.kind !== "build")) return null;
  if (!Number.isFinite(v.resumeAt)) return null;
  return v;
}

/**
 * THE TICK'S QUESTION, for one parked job: `wait` (not yet due), `drop` (the
 * row is over — stopped, finished, lost: nothing to resume), or `resume`
 * (send the job again; its next try is in 5 minutes if this one is lost too).
 */
export function wakeDecision(rec, { now, state = null } = {}) {
  if (!rec) return { act: "drop", why: "unreadable" };
  if (state && ["done", "failed", "cancelled", "lost"].includes(state)) return { act: "drop", why: state };
  if (now < rec.resumeAt) return { act: "wait", inMs: rec.resumeAt - now };
  return { act: "resume", next: { ...rec, resumeAt: now + PROVIDER_RETRY_MS, woke: (Number(rec.woke) || 0) + 1 } };
}
