// TWO QUESTIONS ONLY THE CONTAINER CAN ANSWER, ASKED WITHOUT SPENDING ANYTHING.
//
// ── WHY (2026-09-14) ────────────────────────────────────────────────────────
//
// Owner: *"Test duration and transport separately. Controlled test executing
// inside the container for >15 minutes, then finishing and publishing. Test the
// long AI connection separately so proof doesn't depend on the model randomly
// answering slowly."*
//
// Both halves of that are right and the second is the sharper one. Run 45 died
// at 270,025 ms; `build-call.mjs` has recorded the container's own
// `model call failed after 270036 ms — socket hang up` since 2026-08-26. Eleven
// milliseconds apart is strong evidence and it is not proof, and the only way to
// turn it into proof by MODEL is to hope a model answers slowly — which is a
// test whose result depends on something nobody controls, and which costs money
// every time it runs.
//
// So the transport is asked WITHOUT A MODEL. The far end is our own gateway's
// `/wire` op, which holds a connection open for a stated time in one of two
// shapes:
//
//   quiet    headers, then NOTHING for `ms`, then the answer. This is exactly
//            what a non-streaming provider call looks like on the wire, and it
//            is the shape an idle-connection kill destroys.
//   trickle  a byte every `everyMs`. This is what `stream: true` produces.
//
// ONE RUN OF EACH SETTLES IT, and both outcomes are useful:
//   quiet fails ~270s + trickle survives  → the idle kill is real; streaming IS
//                                           the fix, and run 45's reading holds.
//   both survive                          → the wall is not an idle kill at all
//                                           and run 45's reading is WRONG.
//   both fail at the same time            → a total-lifetime cap, which
//                                           streaming cannot beat and the next
//                                           fix has to be something else.
// `callFailure`'s `wire` field says which: `headersMs: -1, chars: 0` is a death
// before any byte moved; `chars > 0` is a death with the stream open.
//
// ── WHAT THE `hold` SHAPE PROVES, AND WHAT IT DELIBERATELY DOES NOT ─────────
//
// It occupies a real JOB CHILD — spawned by `/job/run`, holding `_busy`, armed
// with the launch's own deadline and its terminator — for as long as it is
// asked. That covers the two links of the duration chain that live INSIDE the
// container and which no unit test and no Postgres check can reach: the child's
// own deadline and terminator, and whether the platform keeps the instance
// alive under a job that runs past fifteen minutes.
//
// IT TOUCHES NO ROW, NO LEASE AND NO LEDGER, on purpose. The other links —
// `edit_sweep_lost` selecting on `lease_expires_at` and never on elapsed, and
// `edit_handoff`'s ttl ceiling — are Postgres properties and are provable
// against a real Postgres, which is where they are checked. A probe that also
// claimed a row would put a test in the money path to prove something the money
// path is not where it lives. **Publishing is not proven here either** — that
// is the real addon run's job, and saying so is the point.
//
// ── AND IT IS BOUNDED BELOW A REAL JOB ──────────────────────────────────────
//
// `PROBE_MAX_MS` sits under `JOB_MAX_MS` so a probe can never occupy a lane for
// longer than a customer's edit could, and the caller's number is clamped rather
// than refused: a probe is an instrument, and an instrument that errors on a
// too-big argument is one somebody runs with a smaller one and mis-reads.

import { callFailure } from "./build-call.mjs";
import { JOB_MAX_MS } from "./job-duration.mjs";

/** The launch kind. Not an edit, not a build — it runs no customer's work. */
export const PROBE_KIND = "probe";

/** What a probe may be asked to do. Anything else is refused by name. */
export const PROBE_SHAPES = ["hold", "wire"];

/**
 * The longest a probe may occupy a lane — under the real setting, so an
 * instrument can never hold a container longer than the work it measures.
 */
export const PROBE_MAX_MS = JOB_MAX_MS - 5 * 60_000;

/** How often `hold` says it is still alive. One line a minute reads as a pulse. */
export const PROBE_SLICE_MS = 60_000;

/** A streamed model call's own cadence — what `trickle` imitates. */
export const WIRE_TRICKLE_MS = 20_000;

/** The default ask: past fifteen minutes, which is the number in question. */
export const PROBE_DEFAULT_MS = 20 * 60_000;

/**
 * Read a probe's own fields off a launch. **Clamps rather than refuses** for
 * the duration (see the header) and REFUSES an unknown shape by name, because
 * a shape nobody recognises silently becoming `hold` would report a transport
 * answer that was never asked for.
 */
export function readProbe(p) {
  const shape = String((p && p.probe) || "hold");
  if (!PROBE_SHAPES.includes(shape)) throw new Error("probe shape " + JSON.stringify(shape) + " is not one this runner runs");
  // NON-NUMBERS FALL TO THE DEFAULT, NEVER COERCED — `Number(["1200000"])` is
  // 1200000, which is this repository's own recorded coercion bug wearing an
  // array.
  const want = typeof p?.ms === "number" && Number.isFinite(p.ms) ? p.ms : PROBE_DEFAULT_MS;
  const ms = Math.max(1000, Math.min(PROBE_MAX_MS, Math.round(want)));
  const evWant = typeof p?.everyMs === "number" && Number.isFinite(p.everyMs) ? p.everyMs : WIRE_TRICKLE_MS;
  const everyMs = Math.max(1000, Math.min(ms, Math.round(evWant)));
  return { shape, ms, everyMs };
}

const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * OCCUPY A JOB CHILD FOR `ms`, SAYING SO EVERY SLICE.
 *
 * The pulse is what makes the result readable from outside: the build service
 * keeps the last five stdout lines on the job's record, so a probe that was
 * killed at minute fourteen and one that ran to twenty are told apart by what
 * the tail says rather than by the absence of a final line, which a crash also
 * produces. Cannot-tell must not read as an answer.
 */
export async function probeHold(ms, { log = () => {}, sleep = sleepFor, now = Date.now, stop = null } = {}) {
  const at = now();
  let slices = 0;
  while (now() - at < ms) {
    if (stop && stop.aborted) return { ok: false, shape: "hold", askedMs: ms, ranMs: now() - at, slices, stopped: true };
    const left = ms - (now() - at);
    await sleep(Math.min(PROBE_SLICE_MS, left));
    slices++;
    log({ probe: "hold", slice: slices, elapsedMs: now() - at, askedMs: ms });
  }
  return { ok: true, shape: "hold", askedMs: ms, ranMs: now() - at, slices };
}

/**
 * HOLD ONE LONG CONNECTION OPEN, AND SAY WHAT THE WIRE DID.
 *
 * `send` is the SAME transport a model call uses (`longPost`), handed in rather
 * than imported, because the whole point is to measure the thing the job really
 * uses — a probe with a transport of its own would measure the probe.
 *
 * A REFUSAL IS AN ANSWER AND IS REPORTED AS ONE. Anything but a throw means the
 * connection survived to a status, which is the question; only a throw is a
 * dead wire, and `callFailure` is what says which kind of dead.
 */
export async function wireCall(send, url, token, body, { onData = null, now = Date.now } = {}) {
  const at = now();
  try {
    const r = await send(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(body),
      ...(onData ? { onData } : {}),
    });
    const text = await r.text().catch(() => "");
    return { ok: true, status: r.status, ms: now() - at, chars: text.length };
  } catch (e) {
    return { ok: false, ms: now() - at, error: String((e && e.message) || e).slice(0, 200), ...callFailure(e) };
  }
}

/**
 * BOTH SHAPES, IN ORDER, ON ONE LAUNCH. Quiet first: it is the one expected to
 * die, and running it first means a container that is torn down mid-probe still
 * leaves the more interesting half in the log.
 *
 * THE TWO CALLS ARE NOT RACED. They share one egress and a concurrent pair
 * would leave the reading open to "the second one kept the first one's path
 * warm" — which is exactly the kind of explanation a measurement must not need.
 */
export async function probeWire(gateway, { ms, everyMs }, { send, log = () => {}, now = Date.now }) {
  const url = String(gateway.url).replace(/\/+$/, "") + "/wire";
  const quiet = await wireCall(send, url, gateway.token, { mode: "quiet", ms }, { now });
  log({ probe: "wire", mode: "quiet", askedMs: ms, ...quiet });
  let seen = 0;
  const trickle = await wireCall(send, url, gateway.token, { mode: "trickle", ms, everyMs }, {
    now, onData: (all) => { seen = all.length; },
  });
  log({ probe: "wire", mode: "trickle", askedMs: ms, everyMs, sawChars: seen, ...trickle });
  return {
    ok: quiet.ok || trickle.ok,
    shape: "wire", askedMs: ms, everyMs,
    quiet, trickle,
    // THE READING, STATED BY THE PROBE RATHER THAN LEFT TO THE READER — the
    // four outcomes mean four different next moves and a session reading two
    // raw rows will pick one of them by eye.
    reading: quiet.ok && trickle.ok ? "no-wall"
      : !quiet.ok && trickle.ok ? "idle-kill"
      : !quiet.ok && !trickle.ok ? "lifetime-cap"
      : "quiet-survived-trickle-did-not",
  };
}

/** One probe launch, whichever shape it asked for. Never throws. */
export async function runProbe(launch, { send, log = () => {}, now = Date.now, sleep = sleepFor, stop = null } = {}) {
  const at = now();
  try {
    const p = readProbe(launch);
    if (p.shape === "hold") return { ...(await probeHold(p.ms, { log, sleep, now, stop })), job: launch.id };
    return { ...(await probeWire(launch.gateway, p, { send, log, now })), job: launch.id };
  } catch (e) {
    return { ok: false, job: launch && launch.id, ms: now() - at, error: String((e && e.message) || e).slice(0, 300) };
  }
}
