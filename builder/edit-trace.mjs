// What actually happened during one edit — a phase timeline, kept so a failure
// can name itself.
//
// ── WHY THIS EXISTS (2026-09-01, owner's call after run 101) ────────────────
//
// Run 101 answered HTTP 500 after 273.2 seconds carrying `kind: "Error"` and
// nothing else. Reconstructing it afterwards, the ONLY two facts recoverable
// anywhere were the request's own duration (from the harness log) and the
// moment the ledger was debited (from Supabase, 109.3s in). Everything between
// those points — which model calls ran, whether the container was reached, how
// many times, whether the first build succeeded, which operation threw — left
// no record at all.
//
// The owner's instruction was exact: "implement diagnostic instrumentation
// only… Do not change the edit flow, timeout behavior, verification logic,
// build behavior, or publishing behavior."
//
// ── WHY IT IS A LEAF MODULE ────────────────────────────────────────────────
//
// No I/O, no Worker bindings, no imports. Every decision that could be WRONG
// lives here and is driven with literal objects — the redaction especially,
// which is the one thing in this file that can leak a secret if it is subtly
// mistaken. Same split as `site-render.mjs` (judges) versus `render-check.mjs`
// (observes), and for the same reason: the dangerous half must be testable
// without infrastructure.
//
// ── WHY MARKS ARE PUSHES AND THE WRITE IS ONE ──────────────────────────────
//
// A trace that writes per phase would add ~20 subrequests to the request it is
// measuring, which changes the timing it exists to record — the instrument
// altering the thing, which this repo has already been bitten by twice (the
// full-page screenshot of a scroll-animated site, and `compileMsg` collapsing
// two causes). So `mark()` is an in-memory array push with no await, and the
// whole timeline is written ONCE at the end, off the response path.

/** Hard caps. A trace is for reading; an unbounded one is a denial of service on the reader. */
export const MAX_EVENTS = 80;
export const MAX_MSG = 300;
export const MAX_STACK = 2000;
export const MAX_DETAIL_KEYS = 8;

/**
 * Everything that must never reach storage, in the order it must be removed.
 *
 * ORDER MATTERS AND THE GENERIC RULE IS LAST. A Supabase JWT is also a run of
 * base64url characters, so the catch-all would swallow it and the reader would
 * lose the ability to tell "a service key appeared in an error" from "some long
 * opaque token did". Naming the specific ones first keeps that distinction.
 *
 * EVERY PATTERN IS ANCHORED ON THE SHAPE OF THE SECRET, never on the label
 * beside it. `"x-api-key: sk-ant-…"` and `"…the key sk-ant-… was rejected"`
 * carry the same secret and only one of them looks like a header.
 */
const SECRETS = Object.freeze([
  // Supabase / GoTrue JWTs — the service key is one of these, and it is the
  // single most dangerous string that can appear in a Postgres or PostgREST
  // error, because those quote the request that carried them.
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?/g, "[redacted:jwt]"],
  // Provider keys, by their own published prefixes.
  [/\b(?:sk-ant|xai|sk|rk|pk)-[A-Za-z0-9_-]{8,}/g, "[redacted:key]"],
  // An Authorization header, however it was quoted.
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]"],
  // A Neon connection string. The password sits between `://` and `@`, so the
  // credentials are cut and the HOST is deliberately kept — which database a
  // failure touched is exactly what a reader needs.
  [/\b(postgres(?:ql)?:\/\/)[^@\s/]+@/gi, "$1[redacted]@"],
  // Cloudflare and GitHub tokens have no single prefix, so they land here.
  // LAST, and deliberately blunt: any long opaque run that survived the named
  // rules above is something we did not recognise, and an unrecognised long
  // token is exactly the case to be conservative about.
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[redacted:token]"],
]);

/**
 * Strip anything secret-shaped from text that is about to be stored.
 *
 * A NON-STRING IS "", NEVER COERCED. `String(["sk-ant-x"])` is `"sk-ant-x"` — a
 * perfectly good secret assembled out of a shape mistake — and this repo has
 * shipped that coercion as a real bug three times. Here the direction of the
 * mistake would be a leak, so it refuses.
 */
export function redact(text, cap = MAX_MSG) {
  if (typeof text !== "string" || !text) return "";
  let out = text;
  for (const [re, to] of SECRETS) out = out.replace(re, to);
  return out.length > cap ? out.slice(0, cap) + "…" : out;
}

/**
 * A short id for one edit, to correlate the trace with a reply and a log line.
 *
 * NOT A UUID and not from `crypto.randomUUID()`: this is read aloud, pasted into
 * a query and grepped in a log, so it is short and unambiguous. Random rather
 * than sequential because two Workers have no shared counter.
 */
export function newCid() {
  // EIGHT RANDOM CHARACTERS, NOT FOUR, and the test is what said so. The first
  // draft took `slice(0, 4)` of a random base36 string: 500 ids minted inside
  // one millisecond share the same `Date.now()` prefix, so uniqueness rested
  // entirely on 36^4 — a ~7% birthday collision over that many, and
  // `Math.random().toString(36)` is sometimes SHORTER than the slice, which
  // makes it worse still. Two traces sharing a cid is one overwriting the
  // other in a primary-keyed table: the diagnosis silently losing a request.
  //
  // Padded rather than assumed, so the length is fixed whatever `Math.random`
  // returns.
  const r = Math.random().toString(36).slice(2).padEnd(8, "0").slice(0, 8);
  return "e_" + Date.now().toString(36) + r;
}

/**
 * Only what a reader needs, and never anything the caller handed us whole.
 *
 * DETAIL IS AN ALLOW-SHAPE, NOT A PASSTHROUGH. A caller that marks
 * `{ ...response }` would put a provider body — headers, echoed request, key —
 * into storage, and the marking call sites are all over an 800-line route. So
 * every value is reduced to a number, a boolean, or a redacted short string
 * here, where the rule can be tested, rather than trusted at ~20 call sites.
 */
function safeDetail(d) {
  // THE SHAPE CHECK IS DEFENSIVE, NOT LOAD-BEARING, and a sweep proved it:
  // removing it SURVIVED, and driving both versions over strings, arrays,
  // arrays-of-objects, numbers, booleans and Dates gave 0 disagreements. The
  // key-name test below already rejects everything `Object.keys` produces for a
  // string or an array — they are numeric, and a name must start with a letter.
  //
  // KEPT ANYWAY, and recorded as inert rather than deleted: it states the
  // intent at the top of the function instead of leaving a reader to derive it
  // from a regex four lines down, and it costs nothing. Written here so the next
  // sweep meets the measurement rather than re-running it.
  if (!d || typeof d !== "object" || Array.isArray(d)) return undefined;
  const out = {};
  let n = 0;
  for (const k of Object.keys(d)) {
    if (n >= MAX_DETAIL_KEYS) break;
    if (!/^[a-z][a-z0-9_]{0,19}$/i.test(k)) continue;
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = redact(v, 80);
    else if (Array.isArray(v)) out[k] = v.slice(0, 4).map((x) => redact(String(x), 60));
    else continue;
    n++;
  }
  return n ? out : undefined;
}

/**
 * Start a trace. `now` is injected so tests drive the clock rather than sleep.
 *
 * IT CAN NEVER THROW, and that is structural rather than a promise: this runs
 * inside a request that is already doing the customer's work, and an instrument
 * that can fail the thing it measures is worse than no instrument. Every method
 * swallows its own faults.
 */
export function newTrace({ slug = "", uid = null, now = () => Date.now() } = {}) {
  const t0 = now();
  const events = [];
  let over = 0;
  const t = {
    cid: newCid(),
    slug: String(slug || "").slice(0, 80),
    uid: uid || null,
    startedAt: t0,
    /**
     * Record one phase event.
     *
     * NEVER AWAITED AND NEVER ASYNC. See the header: a per-phase write would
     * add subrequests to the request being measured.
     */
    mark(phase, status, detail) {
      try {
        if (events.length >= MAX_EVENTS) { over++; return; }
        events.push({
          p: String(phase || "?").slice(0, 40),
          s: status === "ok" || status === "fail" || status === "start" ? status : "?",
          ms: Math.max(0, now() - t0),
          ...(safeDetail(detail) ? { d: safeDetail(detail) } : {}),
        });
      } catch { /* an instrument may not break the thing it measures */ }
    },
    /** The events so far — a copy, so a caller cannot mutate the timeline. */
    events: () => events.slice(),
    dropped: () => over,
    elapsed: () => Math.max(0, now() - t0),
  };
  return t;
}

/**
 * The row to store, from a trace and how the request ended.
 *
 * THE FAILING PHASE IS DERIVED, NOT PASSED. A caller naming it would be a second
 * opinion about what went wrong, and the two can disagree — the timeline already
 * knows: the last phase that STARTED and never reported an outcome is the one
 * that was running. That is the question run 101 could not answer.
 */
export function traceRow(trace, { ok = true, error = null, now = () => Date.now() } = {}) {
  if (!trace || typeof trace.mark !== "function") return null;
  const events = trace.events();
  let failed = null;
  // A phase that FAILED names itself; otherwise the last one still open.
  for (const e of events) if (e.s === "fail") failed = e.p;
  if (!failed) {
    const open = new Set();
    for (const e of events) {
      if (e.s === "start") open.add(e.p);
      else open.delete(e.p);
    }
    failed = [...open].pop() || null;
  }
  const ms = trace.elapsed();
  return {
    cid: trace.cid,
    slug: trace.slug,
    uid: trace.uid,
    ended_at: new Date(now()).toISOString(),
    ms,
    ok: !!ok && !error,
    failed_phase: ok && !error ? null : failed,
    err_name: error ? String((error && error.name) || "Error").slice(0, 40) : null,
    // REDACTED, and the message is kept at all ONLY because it is redacted here.
    // `worker.js`'s owner-route catch discards it entirely for the same danger,
    // which is right for a reply that goes to a browser and is why run 101 could
    // not be diagnosed. A trace behind the service key is a different audience.
    err_msg: error ? redact(String((error && error.message) || ""), MAX_MSG) : null,
    err_stack: error ? redact(String((error && error.stack) || ""), MAX_STACK) : null,
    events: trace.dropped() ? [...events, { p: "…", s: "?", ms, d: { dropped: trace.dropped() } }] : events,
  };
}
