// A CONTAINER THE ACCOUNT CANNOT START RIGHT NOW — recognised, waited for, named.
//
// ── WHAT THE LIBRARY ANSWERS, read out of @cloudflare/containers (2026-09-04) ──
//
// `Container.fetch` → `containerFetch` → `startAndWaitForPorts`, and a start the
// platform cannot make is turned INTO A RESPONSE — the catch around
// `startAndWaitForPorts` in the library's container.js — never a throw:
//
//   503  "There is no Container instance available at this time. …"
//        the account's concurrent ceiling (Cloudflare's figures: 6 TiB of
//        memory and 1,500 vCPU, ~1,536 live `standard-1` instances), or an
//        image still provisioning after a deploy
//   429  "you are requesting too many containers per second"
//        a burst of starts; the threshold is undocumented
//   500  "Failed to start container: …"
//        anything else the start threw
//
// ── WHY THE FIRST TWO ARE WAITED FOR ──────────────────────────────────────────
//
// Both get better on their own — an instance frees the moment another site's
// build ends, a burst passes in a second — and both are OURS. Neither publish
// path recognised them (found 2026-09-04, the capacity review): the edit spine
// JSON-parsed the plain text, threw on it, and told the customer their change
// "didn't compile — try describing it differently"; the build path retried
// once with no delay and shipped a placeholder saying "send it again". A
// transient failure of ours is the one kind worth waiting on, and the wait has
// a floor it must never eat: the compile the caller is waiting to make. The
// 500 is named and not waited for — a start that failed outright is not a
// queue, and a retry against it is the retry the `wasKilled` rule already
// makes elsewhere.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────
//
// `containerRoom(status, text)` classifies ONE answer. A JSON body is never a
// room problem whatever its status: the instance was reached and the build
// server judged something, and this module must not second-guess it.
// `withRoom(call, opts)` repeats `call` while the answer is a room problem that
// waiting helps and the next wait plus the caller's floor still fit before the
// deadline. Every clock and sleep is injected, so the loop is driven with
// literals; the Worker hands in the real ones.
//
// Dependency-free: imported by the Worker, drivable without it.

export const CONTAINER_FULL_RE = /no container instance/i;
export const CONTAINER_RATE_RE = /too many containers/i;
export const CONTAINER_START_RE = /^failed to start container/i;

// Ceilings on ONE wait. A burst passes in a second; an instance frees when a
// build ends, which is minutes — so `full` is polled every few seconds and
// never faster than the cold start it is waiting to make (2,453 ms measured
// 2026-08-25), and the ceiling keeps a long wait from turning into one long
// sleep past the deadline the caller can no longer see.
export const RATE_WAIT_MAX_MS = 8_000;
export const FULL_WAIT_MAX_MS = 30_000;

/** The build server's own answer is JSON; the library's refusals are text. */
const looksJson = (t) => /^\s*[[{]/.test(t);

/**
 * Classify one container answer. Null when it is not a room problem — the
 * caller parses the body exactly as it always did.
 *
 *   { kind: "full" }   503, no instance right now — waited for
 *   { kind: "rate" }   429, too many starts this second — waited for
 *   { kind: "start" }  500 "Failed to start container" — ours, NOT waited for
 *
 * Keyed on the STATUS AND THE WORDS, because the status alone is the build
 * server's to use too (a 500 with a stack trace is a real crash the customer's
 * page may have caused), and the words alone would match a page that quotes
 * them. Unknown text under either status stays null, on purpose: a wait is
 * only right for a failure known to pass, and an unknown one is not.
 */
export function containerRoom(status, text) {
  const s = Number(status) || 0;
  const t = String(text || "");
  if (looksJson(t)) return null;
  if (s === 503 && CONTAINER_FULL_RE.test(t)) return { kind: "full", status: s };
  if (s === 429 && CONTAINER_RATE_RE.test(t)) return { kind: "rate", status: s };
  if (s === 500 && CONTAINER_START_RE.test(t)) return { kind: "start", status: s };
  return null;
}

/** Whether a classification is one that gets better by waiting. */
export const roomWaits = (room) => !!room && (room.kind === "full" || room.kind === "rate");

/**
 * How long to wait before the next try: exponential from the kind's base with
 * ±25% jitter, so a hundred builds refused in the same second do not all come
 * back in the same second, capped at the kind's ceiling.
 */
export function roomDelayMs(kind, attempt, rand = Math.random) {
  const n = Math.max(0, Math.floor(Number(attempt) || 0));
  const base = kind === "rate"
    ? Math.min(1_000 * 2 ** n, RATE_WAIT_MAX_MS)
    : Math.min(5_000 * 2 ** n, FULL_WAIT_MAX_MS);
  const r = typeof rand === "function" ? Number(rand()) : 0.5;
  const unit = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0.5;
  return Math.round(base * (0.75 + unit * 0.5));
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call the container until it has room, or until waiting any longer would
 * leave no room for what the caller is waiting to do.
 *
 * `call()` answers `{ status, text }` — the response's status and its body as
 * TEXT, read by the caller so a non-JSON body survives to be classified.
 * `deadline` is the absolute time the caller's own cap ends and `floorMs` is
 * what the work itself needs after the wait (a compile): a wait that would end
 * later than `deadline - floorMs` is not made, and the last answer comes back
 * with its `room` for the caller to name.
 *
 * Answers `{ answer, room, attempts, waited }` — `room` null when the final
 * answer is not a room problem (parse `answer.text` as before), otherwise the
 * classification the wait ran out on, or a `start`, which is never waited for.
 */
export async function withRoom(call, { deadline = Infinity, floorMs = 0, now = Date.now, sleep = realSleep, rand, onWait } = {}) {
  let attempts = 0;
  let waited = 0;
  for (;;) {
    const answer = await call();
    const room = containerRoom(answer && answer.status, answer && answer.text);
    if (!room) return { answer, room: null, attempts, waited };
    if (!roomWaits(room)) return { answer, room, attempts, waited };
    const delay = roomDelayMs(room.kind, attempts, rand);
    // THE FLOOR IS THE POINT. The wait exists to make the compile possible; a
    // wait that ends with no room left for the compile is a slower failure.
    if (now() + delay + floorMs > deadline) return { answer, room, attempts, waited };
    if (typeof onWait === "function") {
      try { onWait({ kind: room.kind, attempt: attempts, delayMs: delay, status: room.status }); }
      catch { /* a listener is never worth the wait */ }
    }
    await sleep(delay);
    waited += delay;
    attempts += 1;
  }
}

/**
 * The customer's sentence for a room problem the wait ran out on. Ours, said
 * so, nothing charged — and which of the three, because "full" waits minutes
 * and "rate" waits a moment.
 */
export function roomSentence(kind) {
  if (kind === "rate") return "That didn't go through — our build service was starting too many sites at once, so nothing was changed. Nothing was charged. Try again in a moment.";
  if (kind === "start") return "That didn't go through — our build service could not start, so nothing was changed. Nothing was charged. Try again in a moment.";
  return "That didn't go through — our build service is full right now, so nothing was changed. Nothing was charged. Try again in a few minutes.";
}
