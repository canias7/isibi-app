/**
 * THE CONSUMER — claim a delivery, execute the run, let it go.
 *
 * This is the half of the queue that runs work, and it is the only place in the
 * codebase that may execute a run. The HTTP surface accepts work and answers 202;
 * this picks it up. Nothing here knows it is on Cloudflare: `work`, `store`,
 * `send`, `timer` and the clock are all injected.
 *
 * **EVERY EXECUTION CONTINUES FROM THE STORED LOG — THERE IS NO "FRESH START"
 * PATH.** `accept_run` writes the `started` entry before the response goes out, so
 * by the time anything is delivered the log already holds the prompt, the agent,
 * the model and the bounds. One code path, and the prompt is durable before it is
 * acknowledged rather than living in a request that has gone.
 *
 * **THE CLAIM IS THE ONLY GATE, AND IT IS THE DATABASE'S.** A duplicate delivery
 * and two simultaneous resumes lose the same way: zero rows from one conditional
 * UPDATE. Nothing is checked in this process that could be raced.
 *
 * **AND THE CLAIM IS NOT ENOUGH ON ITS OWN, WHICH IS WHAT THE LEASE GATES ARE
 * FOR.** A worker can lose its lease mid-run — it stalled, the isolate froze, the
 * platform took its time — and the sweeper will then hand the run to somebody
 * else. Two workers on one run means paying for the same model calls twice and
 * firing the same tool twice. So the lease is re-asserted at the two places that
 * matter:
 *
 *   before every model call   — so a lost lease costs nothing rather than money;
 *   before every journal write — so a lost lease cannot write history.
 *
 * The second is what keeps the log honest: `runAgent` reads a refused write as
 * `journal-failed` and returns WITHOUT recording a stop, so a redelivery finds the
 * run exactly as it was. The first is what keeps it cheap.
 *
 * **THE HONEST LIMIT, STATED: the window is one model call plus one tool batch.**
 * Between two checkpoints this process will finish what it started, because tools
 * are the agent author's own code and there is nowhere to interrupt them from.
 * Making that window smaller means a cancellation hook inside the loop, which is a
 * change to `run.mjs` and has not been made.
 */

import { runAgent } from "./run.mjs";
import { stoppedEntry } from "./journal.mjs";

/**
 * How long a claim is good for without a beat. **A LIVENESS CHECK, NOT A DURATION
 * CAP**: reclaim is decided by this and never by how long a run has been going, so
 * a run that keeps beating is never taken away from however long its work honestly
 * takes.
 */
export const LEASE_TTL_S = 90;

/** How often the holder says it is still there. */
export const BEAT_EVERY_MS = 30_000;

/**
 * How many beats may fail before the holder gives up — DERIVED, not chosen.
 *
 * The TTL is deliberately several beats long, so a single missed beat is still
 * inside a lease we demonstrably hold. Tolerating more than the arithmetic allows
 * would be working past a lease that may already have been reassigned.
 *
 * A beat that comes back `false` is NEVER tolerated: that is the database saying
 * the lease is gone, which is not a blip.
 */
export const TOLERATED_MISSES = Math.max(0, Math.floor((LEASE_TTL_S * 1000) / BEAT_EVERY_MS) - 2);

/**
 * How many times a run may be picked up before the queue stops offering it.
 *
 * **A STATE MACHINE NEEDS A NAME FOR EVERY OUTCOME, including "this keeps
 * failing".** Without a ceiling, a run whose journal cannot be written spins
 * forever: every sweep redelivers it, every attempt fails the same way, and
 * nothing ever says so out loud.
 */
export const MAX_ATTEMPTS = 5;

/** Why a delivery did not run the work. Each needs a different thing done about it. */
export const OUTCOMES = Object.freeze([
  "ran", "not-claimable", "already-finished", "unreadable", "no-agent",
  "cannot-resume", "too-many-attempts", "lease-lost", "failed",
]);

const isText = (v) => typeof v === "string" && v.trim() !== "";

export function makeRunner(opts = {}) {
  const { work, store, send } = opts;
  if (!work || typeof work.claim !== "function") throw new TypeError("makeRunner: work must come from makeWork");
  if (!store || typeof store.forTenant !== "function") throw new TypeError("makeRunner: store must come from makeRunStore");
  if (typeof send !== "function") throw new TypeError("makeRunner: send must be a function");
  const registry = new Map(Object.entries(opts.agents ?? {}));
  if (registry.size === 0) throw new TypeError("makeRunner: agents must hold at least one agent");
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const onError = typeof opts.onError === "function" ? opts.onError : () => {};
  const onEvent = typeof opts.onEvent === "function" ? opts.onEvent : () => {};
  const ttlS = Number.isFinite(opts.leaseTtlS) && opts.leaseTtlS > 0 ? opts.leaseTtlS : LEASE_TTL_S;
  const beatEveryMs = Number.isFinite(opts.beatEveryMs) && opts.beatEveryMs > 0 ? opts.beatEveryMs : BEAT_EVERY_MS;
  const maxAttempts = Number.isFinite(opts.maxAttempts) && opts.maxAttempts > 0 ? opts.maxAttempts : MAX_ATTEMPTS;
  // The timer is injected so the heartbeat is drivable without waiting: the one
  // branch that matters most — a lease lost half way through a run — is otherwise
  // only reachable by sitting still for ninety seconds.
  const timer = opts.timer ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) };
  // A worker's name identifies THIS holder. It must differ per delivery, or two
  // concurrent deliveries in one isolate would each read the other's claim as
  // their own — the exact confusion the claim exists to prevent.
  const nameWorker = typeof opts.nameWorker === "function"
    ? opts.nameWorker
    : () => `w-${crypto.randomUUID()}`;

  /**
   * Run one delivery. Answers `{ ran, why, runId, stop }` and NEVER throws: a
   * consumer that throws is a delivery the platform retries blindly, which is how
   * one run becomes four.
   */
  async function deliver(runId) {
    if (!isText(runId)) throw new TypeError("deliver: runId must be a non-empty string");
    const worker = nameWorker();

    let claim;
    try { claim = await work.claim({ runId, worker, ttlS }); }
    catch (e) {
      // Could not even ask. Nothing is held, so nothing is released; the row is
      // still outstanding and the sweeper will offer it again.
      onError({ at: "claim", runId, error: String(e?.message ?? e) });
      return { ran: false, why: "failed", runId, stop: null };
    }
    // THE ORDINARY ANSWER FOR A DUPLICATE DELIVERY, and not a failure.
    if (!claim.claimed) { onEvent({ at: "skip", runId, why: "not-claimable" }); return { ran: false, why: "not-claimable", runId, stop: null }; }

    // ── the lease, held out loud ────────────────────────────────────────────
    let held = true;
    let lostBecause = null;
    let misses = 0;
    let handle = null;

    const stopBeating = () => { if (handle !== null) { timer.clear(handle); handle = null; } };
    const tick = async () => {
      handle = null;
      if (!held) return;
      let ok = false, threw = null;
      try { ok = await work.beat({ runId, worker, ttlS }); }
      catch (e) { threw = e; }
      if (threw) {
        // CANNOT-TELL IS NOT A YES. A beat we could not send may mean the lease is
        // fine or may mean it is gone, and only one of those readings is safe. One
        // miss is inside the lease the arithmetic says we hold; past that, stop.
        misses += 1;
        onError({ at: "beat", runId, error: String(threw?.message ?? threw), misses });
        if (misses > TOLERATED_MISSES) { held = false; lostBecause = "beat-failed"; return; }
      } else if (!ok) {
        // Definitive: the database says this lease is not ours.
        held = false; lostBecause = "lease-lost"; return;
      } else {
        misses = 0;
      }
      handle = timer.set(tick, beatEveryMs);
    };
    handle = timer.set(tick, beatEveryMs);

    const assertHeld = () => {
      if (!held) throw new Error(`the lease on this run is gone (${lostBecause})`);
    };

    /** Let go, and say whether anything more should be delivered. */
    const finish = async (done, why, error = null, stop = null) => {
      stopBeating();
      // **A LOST LEASE RELEASES NOTHING.** Somebody else may hold this row now, and
      // `release_run` is gated on `claimed_by` anyway — two walls, deliberately:
      // this one is the intent, that one survives a mistake here.
      if (held) {
        try { await work.release({ runId, worker, done, error }); }
        catch (e) { onError({ at: "release", runId, error: String(e?.message ?? e) }); }
      }
      onEvent({ at: "done", runId, why, done });
      return { ran: why === "ran", why, runId, stop };
    };

    try {
      // **THE TENANT COMES FROM THE CLAIM, NEVER FROM THE DELIVERY.** The message
      // said which run; the database said whose. So a forged or stale message can
      // only ever name a run id — it can never make this process act as a tenant.
      const scoped = store.forTenant(claim.tenant);

      if (claim.attempts > maxAttempts) {
        // Said out loud and taken off the queue, rather than spun on for ever.
        return await finish(true, "too-many-attempts", `given up after ${claim.attempts} attempts`);
      }

      const open = await scoped.open(runId);

      // A finished run is not executed again. `runAgent` would refuse it too —
      // two walls, and this one also takes the work off the queue.
      if (open.state.status === "stopped") return await finish(true, "already-finished", null, open.state.stop);

      // A log that cannot be read is not resumed, and nothing is spent finding
      // out. A redelivery would read the same junk, so it comes off the queue.
      if (open.state.problems.length) {
        return await finish(true, "unreadable", open.state.problems.join("; "));
      }

      const name = open.run?.agent_name ?? open.state.agent;
      const agent = isText(name) ? registry.get(name) : undefined;
      // A run whose agent is no longer registered cannot be helped by another
      // delivery: that needs a deployment, not a retry.
      if (!agent) return await finish(true, "no-agent", `the agent "${name ?? "?"}" is not registered here`);

      const record = await runAgent({
        agent,
        tenant: { id: claim.tenant },
        from: open.entries,
        // THE LEASE GATE ON THE MONEY. Checked immediately before each call, so a
        // lease lost during the previous step costs nothing at all.
        send: async (req) => { assertHeld(); return send(req); },
        // THE LEASE GATE ON THE HISTORY. `runAgent` reads a refused write as
        // `journal-failed` and returns WITHOUT recording a stop, which is exactly
        // right: the run is left as it was for whoever holds the lease now.
        journal: { append: async (entry) => { assertHeld(); return open.journal.append(entry); } },
        now,
      });

      // Asked AFTER the run rather than inferred from the record: the record's own
      // stop reason for a lost lease is `journal-failed`, which is also what a
      // genuinely broken journal says, and those need opposite handling.
      if (!held) return await finish(false, lostBecause ?? "lease-lost", null, null);

      const reason = record?.stop?.reason ?? null;

      // A run that cannot be safely resumed is NOT a failure and NOT retryable.
      // It is waiting for a person: a pending tool call that is not repeatable
      // may have taken a payment, and another delivery would just refuse again.
      // Deliberately leaves the log without a stop, so the run still reads as
      // running with its pending calls visible.
      if (reason === "cannot-resume") {
        return await finish(true, "cannot-resume", JSON.stringify(record.stop.pending ?? []), record.stop);
      }

      // The journal broke for a real reason. Retryable, up to the ceiling.
      if (reason === "journal-failed") {
        return await finish(false, "failed", `journal-failed: ${record.stop.error ?? ""}`, record.stop);
      }

      // Everything else ended with a `stopped` entry in the log — answered, out of
      // steps, out of budget, a failed call. The work is over either way.
      return await finish(true, "ran", null, record?.stop ?? null);
    } catch (e) {
      onError({ at: "deliver", runId, error: String(e?.message ?? e) });
      if (!held) return await finish(false, lostBecause ?? "lease-lost");

      // **AN UNEXPECTED THROW MUST STILL END SOMEWHERE VISIBLE.** A run left with
      // no stop reads as `running` for ever, which is indistinguishable from one
      // still going — the state nobody can act on. On the last permitted attempt
      // the log is closed; before that the run is left alone so a redelivery can
      // try again.
      const last = claim.attempts >= maxAttempts;
      if (last) {
        try {
          await closeWithCrash(runId, claim.tenant, String(e?.message ?? e));
        } catch (e2) {
          onError({ at: "deliver-stop", runId, error: String(e2?.message ?? e2) });
        }
      }
      return await finish(last, "failed", String(e?.message ?? e));
    }
  }

  /** Close a run's log with a `crashed` stop. Best effort, and only ever last. */
  async function closeWithCrash(runId, tenant, error) {
    const scoped = store.forTenant(tenant);
    const open = await scoped.open(runId);
    if (open.state.status === "stopped") return;
    await open.journal.append(stoppedEntry({ at: now(), stop: { reason: "crashed", error } }));
  }

  /**
   * Offer every dropped run again. What makes a lost doorbell cost latency instead
   * of work.
   *
   * It only NAMES the runs; the caller does the delivering, because how a message
   * is sent is the transport's business and this module has no transport.
   */
  async function reclaimable({ graceS, limit } = {}) {
    return work.sweep({ graceS, limit });
  }

  return { deliver, reclaimable };
}
