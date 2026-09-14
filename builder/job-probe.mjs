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
// ONE RUN OF EACH IS USEFUL WHATEVER IT SAYS — but only one of the three
// outcomes settles anything about run 45, and the difference is the owner's own
// correction (2026-09-14): *"'No-wall' means the failure wasn't reproduced; it
// doesn't settle the historical cause."*
//   quiet fails ~270s + trickle survives  → the idle kill is real; streaming IS
//                                           the fix, and run 45's reading holds.
//   both survive                          → the failure was NOT REPRODUCED.
//                                           That removes one hypothesis and
//                                           proves no other: run 45 may have
//                                           died of something else, or of a
//                                           condition not present at probe time.
//                                           NOT "run 45's reading is wrong".
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
  // THE READING, STATED BY THE PROBE RATHER THAN LEFT TO THE READER — the
  // four outcomes mean four different next moves and a session reading two
  // raw rows will pick one of them by eye.
  const reading = quiet.ok && trickle.ok ? "no-wall"
    : !quiet.ok && trickle.ok ? "idle-kill"
    : !quiet.ok && !trickle.ok ? "lifetime-cap"
    : "quiet-survived-trickle-did-not";
  // AND IT GETS A LINE OF ITS OWN, BECAUSE THE ONLY PLACE IT CAN BE READ HAS A
  // 300-CHARACTER FLOOR AND THE ANSWER SITS AT THE END OF THE LONG LINE.
  //
  // `build-server.mjs` keeps a job's last five stdout lines and slices each at
  // 300 characters (`tail.push(line.slice(0, 300))`), and that tail is the ONLY
  // thing a caller outside the container can read once the child has closed.
  // MEASURED rather than suspected: the whole-answer line for a realistic
  // failure is **exactly 300 characters** with `reading` as its last field — no
  // margin at all — and `wireCall` slices a provider's message at 200, so one
  // real error message pushes the verdict clean off the end. What is left still
  // parses and still looks like a complete answer, which is this repository's
  // own "cannot-tell must never read as an answer" with the instrument as its
  // subject. One short line cannot be truncated.
  //
  // TWO DEFENCES, AND THE REDUNDANCY IS DELIBERATE — measured, not assumed.
  // `reading` also moved AHEAD of `quiet`/`trickle` in the answer below, which
  // puts it ~110 characters into the whole-answer line and is sufficient on its
  // own today. So is this line, on its own. Each protects a different thing:
  // field order protects the verdict INSIDE the long line and is one added
  // field away from silently breaking again, while this line does not depend on
  // the answer's shape at all. `test/job-probe.test.mjs` measures both and
  // mutates the PAIR, because a sweep cannot say a redundancy was chosen and
  // the next session deletes what nothing appears to need.
  log({ probe: "wire", reading, quiet: quiet.ok, trickle: trickle.ok });
  return {
    ok: quiet.ok || trickle.ok,
    shape: "wire", askedMs: ms, everyMs,
    reading,
    quiet, trickle,
  };
}

/**
 * TURN A FINISHED JOB RECORD INTO THE DURATION ANSWER.
 *
 * Here rather than in the runner script, because the shape of what `probeHold`
 * produced is this module's to know — a second reader in `scripts/` is two lists
 * of the same thing with a container between them.
 *
 * IT FAILS CLOSED IN EVERY CANNOT-TELL CASE, which is the one property that
 * matters: a missing `ms` reads as 0 minutes and a missing `code` is not 0, so
 * an unreadable record can only ever answer NOT PROVEN. An instrument that
 * reports success it did not earn is worse than one that goes quiet.
 */
export function holdVerdict(rec, pastMin = 15) {
  const r = rec || {};
  const ranMin = (Number(r.ms) || 0) / 60000;
  const past = ranMin > pastMin;
  const clean = r.code === 0 && !r.signal;
  return {
    proven: past && clean,
    ranMin,
    why: past && clean ? "ran past " + pastMin + " minutes and ended cleanly"
      : past ? "ran past " + pastMin + " minutes but did not end cleanly"
      : "did not reach " + pastMin + " minutes",
  };
}

/**
 * TAKE THE WIRE READING OUT OF A JOB'S TAIL.
 *
 * The tail is the only thing readable from outside the container once the child
 * has closed, and `probeWire` puts the verdict on a line of its own precisely so
 * this can find it whole (see the 300-character measurement above). It answers
 * `null` for a tail with no reading in it rather than a default: a shape nobody
 * recognised silently becoming one of the four would be a wall reported that was
 * never measured.
 */
export function wireVerdict(tail) {
  for (const line of Array.isArray(tail) ? tail : []) {
    if (typeof line !== "string" || !line.includes('"reading"')) continue;
    try {
      const o = JSON.parse(line);
      if (typeof o.reading === "string" && o.reading) return { reading: o.reading, line };
    } catch { /* a truncated or interleaved line is not a reading */ }
  }
  return { reading: null, line: null };
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
