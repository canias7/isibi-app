// One edit, run as a queued job instead of on the customer's connection.
//
// ── WHY (2026-09-01) ───────────────────────────────────────────────────────
//
// The synchronous edit request is reset at ~273 seconds. Measured twice: run
// 101 at 273.2s and run 104 at 273.1s, the second naming it outright as
// ECONNRESET on the inbound TLS socket. Nothing we configure is 273 — the
// ceilings in this repo are 240s, 600s, 780s and 1080s — so the wall is
// infrastructure and no amount of tuning moves it. The work has to leave the
// connection.
//
// ── WHY IT IS A LEAF MODULE ────────────────────────────────────────────────
//
// No imports, no bindings, no I/O. Every decision that can be WRONG is here and
// is driven with literal values in the tests — the budget arithmetic especially,
// which decides whether a correction round is started and therefore whether a
// customer's money is spent on work that cannot finish. Same split as
// `edit-trace.mjs` and `site-render.mjs`: the part that judges is separable from
// the part that acts.

/** The queue message kind. `site-build` is the other one and neither may guess. */
// The one reader of a re-sent message's `tries` (stage 3a), shared with the
// build and resume messages so the count cannot be read three ways.
import { readTries } from "./build-job.mjs";

export const EDIT_JOB_KIND = "site-edit";

/** Where a job's replayable request lives in R2, beside the build jobs. */
export const EDIT_JOB_PREFIX = "jobs/edit/";

// ── THE CLOCKS ─────────────────────────────────────────────────────────────
//
// A QUEUE CONSUMER IS STOPPED AT FIFTEEN MINUTES and that is a hard platform
// cap, not a setting. Everything below has to fit inside it with room for the
// job to record what happened while the isolate is still alive.

/** The platform's cap, named so the arithmetic below can be checked against it. */
export const CONSUMER_CEILING_MS = 900000;

/**
 * The whole job's clock — THIRTEEN MINUTES, the same figure and the same
 * reasoning as `BUILD_BUDGET_MS`.
 *
 * IT IS FIXED AT CLAIM AND NOTHING EXTENDS IT. Heartbeats renew the LEASE,
 * which says who may act; they do not and cannot buy execution time, because the
 * thing that stops the isolate is Cloudflare's ceiling and it is not listening.
 * The same goes for the publish lease. That separation is structural here:
 * `makeEditBudget` closes over its start and exposes no setter.
 *
 * The room between this and the ceiling is the isolate's own teardown — the
 * terminal state write, the refund and the trace, which all have to complete
 * AFTER the deadline fires. It was 120 seconds, a guess; run 33 (2026-09-03)
 * MEASURED it: the container call aborted at 674.5s of the job and the terminal
 * state was written 4.3s later. Sixty seconds is fourteen times that.
 *
 * FOURTEEN MINUTES, not thirteen, since run 33. An addon that names two kinds
 * — a table and the form that writes to it — is a picker, two designers, a
 * page call (390s on Grok) and a compile (157s measured on run 32), and under
 * thirteen minutes the compile began with 235s left and was cut at 129s by the
 * reserves below. The minute this adds is the difference between that addon
 * landing and it failing after eleven minutes with nothing to show.
 */
export const EDIT_JOB_MS = 840000;

/**
 * Held back for the publish sweep: the dist write, the archive, the source, the
 * landmarks and the site Worker upload.
 *
 * MEASURED NOW (2026-09-03, run 32's trace): from the container answering to
 * `publish:1 ok` — the dist write (31 objects), the archive, the source, the
 * landmarks and the site Worker upload — took 38.8 seconds. It was 90 seconds
 * while it was a guess, and the guess was paid for on run 33: the compile is
 * capped at what is left MINUS this, and 90 seconds of reserve for a 39-second
 * sweep is what turned a 157-second compile into a 129-second cap. Sixty is
 * the measurement with half again on top; the cost of it being too small is a
 * job that dies mid-publish and needs a human, so it is not the measurement
 * itself.
 */
export const PUBLISH_RESERVE_MS = 60000;

/**
 * Held back for recording the outcome: the terminal state, the refund, the
 * result and the trace. Small, but it must exist — a job that spends its last
 * millisecond publishing has no time left to say that it did.
 */
export const TERMINAL_RESERVE_MS = 15000;

/**
 * WHAT IS LEFT OF THE INVOCATION FOR A JOB THE CONSUMER RUNS ITSELF (stage 5e,
 * 2026-09-06).
 *
 * ── THE ROOM ABOVE `EDIT_JOB_MS` IS NOT FREE, AND THE FIRE SPENDS IT ──────
 *
 * The ceiling is 900s, the job's budget 840s, and the sixty seconds between
 * them are the isolate's teardown — measured at 4.3s on run 33 and left at
 * sixty. That arithmetic assumed the budget's clock starts when the message
 * is delivered. Since the runner (task #93) it does not: the consumer claims,
 * FIRES at the site's container, and only builds the budget if the fire came
 * back empty — and a fire that meets an account with no room WAITS
 * (`withRoom`, `JOB_FIRE_MS` 90s) before answering. Ninety seconds of waiting
 * plus 840 of budget is 930 against a ceiling of 900: the job would be
 * evicted with half a minute of its budget still on the clock, which runs no
 * catch and no finally — run 17's shape, reached by capacity rather than by a
 * deploy.
 *
 * WHY IT IS THIS STAGE'S. With one canary site the account is never full
 * because of us; with the broad flag on, every queued job is a fire and they
 * share the account's container ceiling. The flip is what makes it reachable.
 *
 * SO THE INLINE JOB'S BUDGET IS THE SMALLER of what it wants and what is left
 * of the invocation, less the terminal writes. A fire that returned at once —
 * the flags off, no binding, a refusal — leaves ~884s against a want of 840,
 * so this is a no-op on every path that does not wait, which is every path
 * today. It bites only when something before the job took real time, and then
 * it hands the job a shorter clock rather than an eviction: the budget's own
 * gates refuse the next phase, the customer is told, and the money goes back.
 *
 * `startedAt` is the CONSUMER'S clock — when this delivery began — and never
 * the job's row: a job re-sent after a deferral gets a whole fresh invocation.
 * Absent (the container's runtime, a test driving a consumer directly) means
 * no ceiling applies, because there is no fifteen-minute invocation there.
 */
export function inlineBudgetMs(startedAt, want, now = Date.now()) {
  const wanted = Number.isFinite(want) && want > 0 ? want : EDIT_JOB_MS;
  if (!Number.isFinite(startedAt) || startedAt <= 0) return wanted;
  const spent = Math.max(0, now - startedAt);
  const left = CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS - spent;
  // NEVER ZERO OR NEGATIVE. A budget that cannot be arithmetic on is worse
  // than a tiny one: `makeEditBudget` reads a non-positive total as "use the
  // default", which is exactly the 840s this exists to refuse. One second is
  // already expired at every gate, which is the honest answer for an
  // invocation with nothing left.
  return Math.max(1000, Math.min(wanted, left));
}

/**
 * The floor under a correction round, and its parts are named rather than summed
 * into one number so a later measurement can move one of them.
 *
 * ── WHY THESE ARE MINIMUMS AND NOT CEILINGS ──────────────────────────────
 *
 * "Enough budget for correction, build 2, verification, publishing and the final
 * writes" cannot be read as the per-call CEILINGS, and the arithmetic says why:
 * a correction call may take 240s and a container call 600s, which with the two
 * reserves is 945s — more than the whole 780s budget and more than the
 * platform's 900s. Read that way a correction could never start under any
 * circumstances, and the feature would be dead on arrival.
 *
 * So the reserve is guaranteed STRUCTURALLY and the floor is a separate,
 * weaker thing:
 *
 *   - `capMs` subtracts both reserves from every pre-publish call, so no model
 *     call and no container call can eat the publish window. That is the
 *     guarantee, and it holds whatever these numbers say.
 *   - This floor stops work that is *obviously* doomed — below it there is no
 *     point spending the customer's money on a round that cannot land.
 *
 * The numbers are the smallest a real round has been observed to need, not the
 * largest it may take: a lane call is tens of seconds and an edit's container
 * build is one to two minutes (vite is ~7s over 2,186 modules, the render check
 * ~6s). Conservative on the safe side — too high only skips a correction and
 * refunds, which is the defined outcome anyway.
 */
export const MIN_CORRECT_MS = 60000;
export const MIN_BUILD_MS = 180000;
export const MIN_VERIFY_MS = 10000;
export const CORRECT_FLOOR_MS =
  MIN_CORRECT_MS + MIN_BUILD_MS + MIN_VERIFY_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS;

/**
 * The floor under a PUBLISH — a compile, the sweep, the terminal writes.
 *
 * Run 33 (2026-09-03) is why this exists apart from `expired()`: the addon's
 * publish gate asked only "is there any time left?", there was (235s), the
 * compile was started, and `capMs` — correctly holding the reserves back —
 * cut it at 129s when it needed 157s. Eleven minutes of model work ended in a
 * timeout wearing the compile's sentence, refunded, with nothing to show. A
 * publish that cannot fit is refused BEFORE it starts, by name, and the reply
 * says it ran out of time rather than that the code did not compile.
 */
export const PUBLISH_FLOOR_MS = MIN_BUILD_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS;

/**
 * The floor under a REPAIR ROUND on the publish spine (owner, 2026-09-04:
 * "try to fix it, if not fix, send as it is") — a model call, a second compile,
 * the sweep, the terminal writes: the correction round's parts without its
 * verification, because the render check runs inside the compile.
 *
 * Asked AFTER the first compile has already spent its time, which is why it is
 * a floor of its own rather than `canCorrect`: run 34's shapes, measured off
 * `edit_jobs.phase_ms`, are the calibration — the function addon reached its
 * publish at ~385s of 840 and would have had room; the two-kind table addon
 * reached it at ~540s and would not, and is shipped as it is, said so.
 */
export const REPAIR_FLOOR_MS = MIN_CORRECT_MS + MIN_BUILD_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS;

// ── THE LEASE ──────────────────────────────────────────────────────────────

/** How long a claim is good for. Three missed renewals before it can go stale. */
export const LEASE_TTL_S = 90;

/**
 * How often it is renewed.
 *
 * A TIMER, NEVER A PHASE BOUNDARY, and this is the one lease decision that is
 * not a matter of taste. The container call is a single await of up to ten
 * minutes with no boundary inside it, so a heartbeat that only fired between
 * phases would let the lease expire during every single build — the sweep would
 * then steal a healthy job and refund a customer whose edit was still running.
 */
export const HEARTBEAT_S = 30;

/**
 * How far past expiry a lease has to be before the sweep may take it. One extra
 * TTL of grace, so a slow renewal costs nothing.
 */
export const STALE_GRACE_S = 60;

/**
 * The window `edit_may_publish` grants.
 *
 * IT IS NOT EXECUTION TIME. It is longer than the publish reserve on purpose —
 * the sweep needs `expiry + STALE_GRACE_S` to elapse before it can act, so a
 * publish that runs to its full reserve still cannot be stolen mid-flight. The
 * consumer's own budget is what limits how long it may actually run, and it is
 * shorter.
 */
export const PUBLISH_LEASE_S = 300;

// ── ONE JOB PER SITE AT A TIME (stage 6, 2026-09-05) ─────────────────────────
//
// The claim is the wall: under the site's own advisory lock, `edit_claim`
// refuses a job whose site another job holds — a live lease, a publish in
// flight, the platform rebuilding it — as `site-busy`, and COUNTS the refusal
// on the row. The consumer re-sends its own message with a delay, once per
// refusal; the refusal past the cap fails the row from inside the RPC, with
// the reason on it, so nothing waits for ever behind a site that never frees.

/**
 * How long the consumer waits before asking again. A minute — the resume
 * look's own cadence — so a job behind a fourteen-minute edit asks about
 * fourteen times, and a queue message per ask costs nothing.
 */
export const SITE_BUSY_DEFER_S = 60;

/**
 * How many refusals a job may collect before the claim FAILS it. Forty-five
 * minutes at the cadence above: room to sit behind a whole edit (fourteen
 * minutes), a whole generation (the container's thirty-minute bound) or a
 * rebuild (ten), and under the browser's own watch bound, so the customer is
 * told rather than left with a spinner. THE DATABASE IS THE AUTHORITY — the
 * RPC carries the literal and gives up on its own count; this copy exists for
 * the guard that holds the two equal and for the sentence in the docs.
 */
export const MAX_SITE_BUSY_DEFERRALS = 45;

// ── THE DEPLOY GATE (stage 3a, 2026-09-05) ─────────────────────────────────
//
// A deploy SETS A GATE before it rolls — one row in private.platform_flags,
// written by deploy_gate_set with the deploy's own id and an expiry — and
// passes that id into the Worker as DEPLOY_ID. A consumer names its own id on
// every claim; the RPC refuses the claim `deploy-gated` while a gate under a
// DIFFERENT id stands, because that consumer is the isolate the deploy is
// about to evict (run 17: a queue invocation cancelled nine minutes after a
// deploy, the job it held swept as lost). The new code's id IS the gate's, so
// it claims straight through; a Worker with no id — a hand deploy — sends
// none and is never gated. The refusal is counted and bounded exactly as a
// busy site's (the same column, the same cap, the same give-up), and the
// consumer sends its own message again with the same delay.

/** The shape of a deploy id: a git sha, or any short label a hand deploy might set. */
export const DEPLOY_ID_RE = /^[A-Za-z0-9._-]{4,64}$/;

/** This Worker's own deploy id, or "" when it has none or the value is not one. */
export function deployIdOf(env) {
  const v = env && env.DEPLOY_ID;
  return typeof v === "string" && DEPLOY_ID_RE.test(v) ? v : "";
}

/**
 * A CLAIM THAT COULD NOT BE READ — the RPC failed in transport, was refused
 * with a status, or answered no shape — is deferred ONCE: the message is sent
 * again carrying `tries`, because a consumer that cannot ask the gate cannot
 * tell whether a deploy is rolling under it. The second unreadable claim
 * proceeds as the consumer always did (a build builds, an edit is left for the
 * stale sweep): the gate is a safety, not a wall, and a database that is down
 * is not a deploy.
 */
export const CLAIM_RETRY_MAX = 1;

/** Was this claim answer no answer at all — nothing, a transport failure, a refusal, no shape? */
export function unreadClaim(c) {
  return !c || (c.ok === false && (c.error === "rpc" || c.error === "rpc-shape"));
}

/** A claim refused for a reason the consumer waits out: the site is held, or a deploy is rolling. */
export function deferredClaim(c) {
  return !!c && c.claimed !== true && (c.error === "site-busy" || c.error === "deploy-gated");
}

/**
 * A QUEUED ROW NOBODY HAS PICKED UP (stage 3a): no lease, and nothing has
 * touched it for this long — its message was never delivered, its consumer
 * was evicted before the claim landed, or a re-send failed. The sweep sends
 * its message again ONCE (the row marked `stale`); a row still untouched a
 * window later is failed with the reason on it, a build's deposit given back.
 * Ten minutes: a deferred message is delivered within a minute or two, and
 * every deferral touches the row, so a job waiting behind a site or a deploy
 * is never stale.
 */
export const STALE_QUEUED_S = 600;

// ── STATES ─────────────────────────────────────────────────────────────────

/** Every state the database's own CHECK constraint admits, in order.
 *  `generating` (stage 2c) is a BUILD row's state while the container holds
 *  its lease — set by `edit_handoff`, never reached by an edit. */
export const EDIT_PHASES = Object.freeze([
  "queued", "claimed", "routing", "editing", "building",
  "verifying", "correcting", "rebuilding", "publishing", "generating",
]);

/** Nothing moves out of these. Kept in step with the CHECK constraint by a test. */
export const TERMINAL_STATES = Object.freeze(["done", "failed", "cancelled", "lost"]);

/**
 * A NON-STRING IS NOT TERMINAL, and it is not coerced into one either.
 *
 * The first draft of this line was `TERMINAL_STATES.includes(String(s || ""))`,
 * which answers TRUE for `["done"]` — `String(["done"])` is `"done"`. That is
 * this repo's own recorded trap, shipped for a fourth time, and caught by the
 * test written for it in the same commit. The direction of the mistake here is a
 * running job read as finished.
 */
export const isTerminalEdit = (s) => typeof s === "string" && TERMINAL_STATES.includes(s);

/**
 * The whole-job clock.
 *
 * `capMs` HANDS BACK WHICHEVER IS SOONER — the per-call bound, or what is left
 * of the job minus the reserves. That is what makes the two bounds compose
 * rather than compete, and it is the same shape as `makeBudget` on the build
 * path, deliberately: one idea, two clocks, no second way of thinking about it.
 */
export function makeEditBudget(totalMs = EDIT_JOB_MS, now = () => Date.now()) {
  const t0 = now();
  const left = () => Math.max(0, totalMs - Math.max(0, now() - t0));
  // ONE EXPRESSION for the repair call's room, read by `capMs` and by
  // `canRepair` — the cap and the gate cannot disagree about it.
  const repairRoom = () => Math.max(0, left() - MIN_BUILD_MS - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS);
  return {
    startedAt: t0,
    elapsed: () => Math.max(0, now() - t0),
    /** What remains of the whole job, reserves included. */
    remaining: left,
    /**
     * What remains for WORK — the job's time less both reserves.
     *
     * This is the number every gate reads, and it is what makes the publish
     * window safe by construction rather than by anybody remembering to leave
     * room for it.
     */
    spendable: () => Math.max(0, left() - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS),
    /**
     * The ceiling for one call. `publishing: true` releases the publish reserve,
     * because at that point the publish IS the work being bounded.
     *
     * NEVER ZERO for the same reason `capMs` on the build path is never zero: a
     * timer of 0 fires immediately, which turns "no time left" into "this call
     * failed instantly" and hides the real reason under a wrong one. A caller
     * that must refuse asks `expired()`.
     */
    capMs(cap, { publishing = false, repairing = false } = {}) {
      const room = publishing
        ? Math.max(0, left() - TERMINAL_RESERVE_MS)
        : repairing
          ? repairRoom()
          : Math.max(0, left() - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS);
      return Math.max(1, Math.min(Number(cap) || 0, room));
    },
    /**
     * The room a REPAIR CALL has: what is left less the second compile, the
     * sweep and the terminal writes — the three things that MUST follow the
     * call, or it was made for nothing (run 36, 2026-09-04).
     *
     * `capMs` alone holds back the two reserves, which is right for every
     * call BEFORE the first compile: the compile's room is still ahead of
     * them. A repair call sits after a compile that succeeded and in front
     * of a second one, so the plain cap let run 36's fix run the whole 240 s
     * quick-call ceiling — `phase_ms.repair` exactly 240,000, the job at 747
     * of 840 s — and be cut with nothing to show. This is the number the
     * call is capped at (`capMs(cap, { repairing: true })`) and the number
     * `canRepair` judges against, so the two cannot disagree.
     */
    repairMs: repairRoom,
    /** No time left to do any work in. */
    expired: () => left() <= PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS,
    /**
     * May a correction round START?
     *
     * Asked BEFORE the round, never during. A round begun with too little left
     * spends the model call and the container run and then fails anyway — the
     * customer is refunded either way, so the only difference is whether we
     * spent their credits to reach the same place.
     */
    canCorrect: () => left() >= CORRECT_FLOOR_MS,
    /**
     * May a PUBLISH start? Asked at the last gate before anything is written.
     * Below the floor the compile would be cut by its own cap (run 33), so the
     * honest answer is to stop here, charge nothing, and say why.
     */
    canPublish: () => left() >= PUBLISH_FLOOR_MS,
    /**
     * May a REPAIR ROUND start, after the first compile? Asked before the
     * model call, so a round there is no room for spends nothing and the
     * page ships as it is, said so.
     *
     * `needMs` IS WHAT THE CALL IS EXPECTED TO TAKE, MEASURED — the addon
     * route hands in what its page call took per page it wrote, on the same
     * model, because a fix re-emits that file and no better estimate exists
     * in the job. The floor is `MIN_CORRECT_MS` whatever the estimate says:
     * with nothing measured the answer is what it was before, `left() >=
     * REPAIR_FLOOR_MS`, and a call is never refused for a number we do not
     * have. With one, a round the room cannot hold is refused BEFORE it is
     * bought — run 36's shape: 140 s of room against a page the same model
     * had just spent 153 s writing.
     */
    canRepair: (needMs = 0) => repairRoom() >= Math.max(MIN_CORRECT_MS, Number(needMs) || 0),
  };
}

/**
 * The clock a REPAIR CALL rides — `quickSend`'s `budget` argument, answering
 * `capMs` with the room a repair call has (`repairMs`) rather than the room
 * any call has. `null` without a job, which `quickSend` reads as its own flat
 * ceiling, exactly as a synchronous addon's other calls do.
 *
 * ITS OWN FUNCTION so the addon route cannot hand the round the job's plain
 * budget by habit: `aQuick(what)` does exactly that for every call before the
 * first compile, and the only difference between the two spellings is the
 * four minutes run 36 lost.
 */
export function repairClock(budget) {
  if (!budget || typeof budget.capMs !== "function") return null;
  return { capMs: (cap) => budget.capMs(cap, { repairing: true }) };
}

/**
 * The client's idempotency key, or nothing.
 *
 * REFUSES, NEVER REPAIRS AND NEVER GENERATES. A key minted here would make every
 * retry a distinct job, which is exactly the double charge the key exists to
 * prevent — the failure is silent and costs the customer money, so the bias
 * inverts here the way it does for the `pages` verb and for `cleanAlias`.
 *
 * AND IT REFUSES A NON-STRING RATHER THAN COERCING ONE. `String(["abc"])` is
 * `"abc"` — a perfectly good key assembled out of a shape mistake — and this
 * repo has shipped that coercion as a real bug three times.
 */
export function cleanIdemKey(v) {
  if (typeof v !== "string") return null;
  return /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

/**
 * A consumer instance's name, for the lease.
 *
 * NOT THE JOB ID. Two consumers racing for one job must be distinguishable, and
 * naming the lease after the job makes every holder look like every other one —
 * which is the whole thing the lease is for.
 */
export function newLeaseOwner(rnd = Math.random) {
  return "c_" + rnd().toString(36).slice(2).padEnd(8, "0").slice(0, 8);
}

/**
 * Read one queue message, and REFUSE anything that is not ours.
 *
 * THE REFUSAL IS THE POINT. Three kinds share this queue and each has its own
 * handler; a reader that guessed would put an edit through the BUILD path, which
 * replays the request as a build — a second design call and a second charge on a
 * job that has already been billed. `readMessage` in `build-job.mjs` refuses
 * everything but `site-build` for exactly this reason, and this is its mirror.
 */
export function readEditMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.kind !== EDIT_JOB_KIND) return null;
  // A NON-STRING ID IS REFUSED, NOT COERCED. `String(["abc"])` is `"abc"`.
  if (typeof body.id !== "string" || !/^[0-9a-f]{32}$/.test(body.id)) return null;
  // `tries` (stage 3a): how often this message was sent again because its
  // claim could not be read — build-job.mjs's one reader, bounded by the
  // consumer (`CLAIM_RETRY_MAX`), absent on a first delivery.
  const tries = readTries(body);
  return tries === undefined ? { kind: EDIT_JOB_KIND, id: body.id } : { kind: EDIT_JOB_KIND, id: body.id, tries };
}

/**
 * The header that tells the front door this request IS the replay.
 *
 * WITHOUT IT THE CONSUMER WOULD ENQUEUE ITSELF for ever — the replayed request
 * hits the same route, sees the flag on, and files another job. The marker is
 * the base case.
 *
 * ── AND ITS PRESENCE PROVES NOTHING ON ITS OWN ────────────────────────────
 *
 * A header name is public and a job id is handed to the customer in the 202, so
 * neither is evidence of anything. The first cut of this treated the header's
 * PRESENCE as the test — and any signed-in owner could send it and drop
 * straight into the inline pipeline, skipping the queue, the budget, the lease
 * and, worst of all, `edit_create`'s `needs_review` refusal, which is the only
 * thing stopping a new edit on a site whose last publish state is unknown.
 *
 * So the marker is `<jobId>.<secret>`, and the secret is 32 random hex minted
 * server-side, stored only in the service-role-only job object, and never sent
 * to any client. Knowing your own job id is not enough; there is nothing a
 * customer can observe that lets them build one.
 */
export const REPLAY_HEADER = "x-gf-job";
/**
 * THE POLL SAYING "THIS IS THE ANSWER, NOT ME TALKING".
 *
 * A finished job hands back its STORED REPLY byte for byte — the same object the
 * synchronous path returns — and that object has no job-state field in it,
 * because it never needed one. So the client could not tell a finished job from
 * a running one: `classify(undefined)` answers `running`, and the browser polled
 * a completed, charged, published edit for ever behind a spinner.
 *
 * HTTP STATUS CANNOT CARRY IT EITHER. A stored reply keeps its own status — 200
 * for a success, 422 for a compile failure, 503 for a model outage — and the
 * poll route has its own 503 for a row it could not read. Read by number alone,
 * a stored 503 is indistinguishable from a transient one and gets retried until
 * the client gives up.
 *
 * So the distinction is stated rather than inferred. Set on the stored-reply
 * branch and nowhere else.
 */
export const FINAL_HEADER = "x-gf-edit";
export const FINAL_VALUE = "final";

/** A per-job replay secret. Never leaves the server, never reaches a client. */
export function newReplaySecret(fill) {
  const b = new Uint8Array(16);
  fill(b);
  let out = "";
  for (const x of b) out += x.toString(16).padStart(2, "0");
  return out;
}

/** `<jobId>.<secret>`, the only form the front door accepts. */
export function packReplayMarker(id, secret) {
  return String(id || "") + "." + String(secret || "");
}

/**
 * Split a marker, and REFUSE anything that is not exactly one.
 *
 * Both halves are checked for shape here so the caller's comparison is between
 * two known-good strings rather than between whatever arrived and a stored
 * value — and a non-string is refused rather than coerced, because
 * `String(["a…"])` is `"a…"` and this repo has shipped that three times.
 */
export function readReplayMarker(v) {
  if (typeof v !== "string" || !v) return null;
  const dot = v.indexOf(".");
  if (dot < 0) return null;
  const id = v.slice(0, dot);
  const secret = v.slice(dot + 1);
  if (!/^[0-9a-f]{32}$/.test(id) || !/^[0-9a-f]{32}$/.test(secret)) return null;
  return { id, secret };
}

/**
 * WHAT THE CONSUMER REPLAYS. Deliberately NOT the build path's `packJob`.
 *
 * ── NO BEARER TOKEN, AND THAT IS THE POINT ────────────────────────────────
 *
 * `packJob` stores the customer's own `Authorization` header, because a build's
 * ledger calls go through `use_credits`, which resolves the user from
 * `auth.uid()` and so cannot be made by a service key. An async edit has no such
 * need: its money moves through `edit_reserve`, which is service-role and takes
 * the uid explicitly.
 *
 * Storing one anyway would buy three problems for nothing — a live credential at
 * rest, a job that fails because a token expired while it sat in the queue, and
 * an identity broader than the one job it is for. The `uid` and `slug` here are
 * the immutable record instead, and the consumer's authority is the LEASE.
 */
export function packEditJob({ url, body, uid, slug, secret, at }) {
  return {
    v: 1,
    url: String(url || ""),
    body: String(body || ""),
    uid: String(uid || ""),
    slug: String(slug || "").toLowerCase(),
    secret: String(secret || ""),
    at: Number(at) || 0,
  };
}

/** And back, refusing any shape we did not write. */
export function readEditJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== 1) return null;
  for (const k of ["url", "body", "uid", "slug", "secret"]) {
    if (typeof raw[k] !== "string" || !raw[k]) return null;
  }
  if (!/^[0-9a-f]{32}$/.test(raw.secret)) return null;
  return { url: raw.url, body: raw.body, uid: raw.uid, slug: raw.slug, secret: raw.secret, at: Number(raw.at) || 0 };
}

/**
 * Rebuild the customer's request for the consumer to run.
 *
 * TWO HEADERS, AND NO AUTHORIZATION. Copying more would be a bug rather than a
 * kindness: `content-length` would describe a body that has been through JSON,
 * and any conditional header would apply to a request nobody is waiting on. The
 * absent one is the deliberate part — see `packEditJob`.
 */
export function replayEditRequest({ url, body, marker }) {
  const headers = { "content-type": "application/json" };
  if (marker) headers[REPLAY_HEADER] = String(marker);
  return new Request(String(url || ""), { method: "POST", headers, body: String(body || "") });
}

/**
 * How long each phase actually took, from a trace's events.
 *
 * ── WHY THIS EXISTS (owner, 2026-09-01) ───────────────────────────────────
 *
 * "Do not treat observed minimums as the permanent admission threshold…
 * persist real durations from every async edit, then derive the correction
 * requirement from measured p90/p95."
 *
 * The trace already records a `start` and an outcome for every phase, but the
 * numbers on them are ELAPSED-SINCE-JOB-START, not durations — so a percentile
 * query over the raw events would be computing percentiles of "how late in the
 * job this happened", which is a different quantity that happens to look
 * plausible. Subtracting here, once, is what makes the stored numbers mean what
 * a later query will assume they mean.
 *
 * A phase that started and never finished contributes NOTHING rather than a
 * zero: it is the one that was running when the job died, and folding it in as
 * 0ms would drag every percentile down at exactly the moment the data is about
 * a job that ran too long.
 */
export function phaseDurations(events) {
  if (!Array.isArray(events)) return {};
  const open = new Map();
  const out = {};
  for (const e of events) {
    if (!e || typeof e.p !== "string") continue;
    const at = Number(e.ms);
    if (!Number.isFinite(at)) continue;
    if (e.s === "start") { open.set(e.p, at); continue; }
    if (e.s !== "ok" && e.s !== "fail") continue;
    if (!open.has(e.p)) continue;
    // LAST WINS for a phase that ran twice under one name. Nothing does today
    // (the two publishes are `publish:1` and `publish:2`), and a silent sum
    // would be a number no percentile could be read from.
    out[e.p] = Math.max(0, at - open.get(e.p));
    open.delete(e.p);
  }
  return out;
}

/**
 * Is the async edit path on AT ALL?
 *
 * OPTIONAL, AND OFF IS THE DEFAULT INCLUDING WHEN THE VALUE IS NONSENSE. An
 * unreadable flag must not turn a customer-facing path on by accident, so
 * anything that is not an affirmative word is off.
 *
 * ON ITS OWN THIS IS NOT ENOUGH TO ROUTE ANYTHING. See `editAsyncFor`: the flag
 * is the master switch and the allowlist is who it applies to, and both have to
 * say yes.
 */
export function editAsyncOn(env) {
  const v = env && env.EDIT_ASYNC;
  if (typeof v !== "string") return false;
  return ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

/**
 * WHO THE ASYNC PATH APPLIES TO — a list of uids and slugs, and nothing else.
 *
 * ── THERE IS NO WILDCARD, DELIBERATELY ────────────────────────────────────
 *
 * Not `*`, not `all`, not an empty string meaning everybody. The one mistake
 * this must never make is turning a canary into general traffic because a value
 * was typed wrong, so an entry that is not a well-formed uuid or slug is
 * DROPPED, and a list with nothing well-formed in it is an empty list — which
 * keeps every edit synchronous.
 *
 * That is the safe direction and it is worth being explicit about which way it
 * fails: a malformed allowlist means the canary does not get the new path,
 * which is visible in one test edit. The opposite mistake is every customer on
 * a path that has never run.
 */
export function readCanaryList(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const out = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    const v = piece.trim().toLowerCase();
    if (!v) continue;
    // A uuid, or a slug of the shape every other route in this codebase admits.
    // Anything else — a wildcard, a regex, a hostname, a stray quote — is not a
    // narrower match, it is a value nobody meant, so it is dropped rather than
    // interpreted.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) { out.push(v); continue; }
    if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(v)) { out.push(v); continue; }
  }
  return out;
}

/**
 * EVERYONE — the whole platform, once the master switch says on.
 *
 * ── A SECOND WORD, NOT A WILDCARD (2026-09-04) ─────────────────────────────
 *
 * `readCanaryList` refuses `*` and `all` on purpose: widening a canary to every
 * customer must never be what a typo in the allowlist does. So the widening is
 * its own variable, read exactly the way the master switch is read — an
 * affirmative word or nothing — and it still needs the master switch:
 * `EDIT_ASYNC` off keeps every edit synchronous whatever this says, which keeps
 * the one-step rollback the canary was built with.
 *
 * WHY IT EXISTS. A synchronous edit is reset at ~273 s and an addon died at
 * 257 s (run 21), and a compile alone is 150–220 s — so off the allowlist the
 * edit path fails for most edits and the addon path for all of them. The queue
 * has run every lane and every addon kind on fretwork-1 (runs 22–39); the
 * allowlist was the proving ground, this is the door.
 */
export function editAsyncEveryone(env) {
  const v = env && env.EDIT_ASYNC_EVERYONE;
  if (typeof v !== "string") return false;
  return ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

/**
 * WHO RUNS THE JOB — the Worker's queue consumer, or the site's container?
 *
 * ── THE JOB RUNS IN THE CONTAINER (2026-09-04; owner: "that stuff gotta run
 * on container") ──────────────────────────────────────────────────────────
 *
 * The consumer used to hold a Worker invocation for the whole job. Now, for
 * the identities these two say yes to, it fires the job at the site's own
 * container (`/job/run` on the build service, which runs the Worker's module
 * under Node — worker-loader.mjs) and returns; the container does the work
 * and finalizes. The same two-door shape as the async fork: a canary list of
 * uids and slugs (`readCanaryList`, no wildcard) for proving it on one site,
 * and a second word, `JOB_RUNNER_EVERYONE`, for the whole platform once it is
 * proven. Nothing set means nobody: the Worker's consumer runs the job itself,
 * exactly as it did. The consumer also falls back to itself when the container
 * cannot take the job — no room, an old image without the endpoint — so the
 * wide door can never turn a full account into a queue of failed edits.
 */
export function jobRunnerEveryone(env) {
  const v = env && env.JOB_RUNNER_EVERYONE;
  if (typeof v !== "string") return false;
  return ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

/** Is the container runner on for ANYBODY? Asked before the job is read, so an
 *  off platform pays no extra read. */
export function jobRunnerOn(env) {
  return jobRunnerEveryone(env) || readCanaryList(env && env.JOB_RUNNER_CANARY).length > 0;
}

export function jobRunnerFor(env, { uid = "", slug = "" } = {}) {
  const u = typeof uid === "string" ? uid.toLowerCase() : "";
  const s = typeof slug === "string" ? slug.toLowerCase() : "";
  if (!u && !s) return false;
  if (jobRunnerEveryone(env)) return true;
  const list = readCanaryList(env && env.JOB_RUNNER_CANARY);
  if (!list.length) return false;
  return (!!u && list.includes(u)) || (!!s && list.includes(s));
}

/**
 * THE STRING BINDINGS A JOB CARRIES INTO THE CONTAINER, by name.
 *
 * An explicit list rather than "every string on `env`", because the Worker's
 * env also holds the Stripe keys, the Composio and Domain Connect keys — none
 * of which an edit or an addon ever reads, and none of which belong in a
 * container's memory. What IS here is what the edit route, the addon route
 * and the publish spine read: the provider keys, the Neon key for the addon's
 * first-touch database, fal for the picture rung, the API token and account
 * for the site's script upload, the secrets key for a site's own vault, and
 * the flags the replay reads. A name a job needs that is missing here fails
 * inside the container as the code's own named refusal, never silently — and
 * the answer is a line here.
 *
 * THE SERVICE KEY AND THE MINT SECRET ARE NOT HERE (stage 4b, 2026-09-06).
 * They were, because every `edit_*` RPC carries the mint as `p_mint` and
 * `editRpc` refuses without both — and so the one process that executes a
 * customer's page code (in a child, with a clean env, but the same box) held
 * the credentials that open every site's rows and every ledger. Now the job
 * reaches Supabase through the gateway with its own token: `makeContainerEnv`
 * puts the gateway MARKER under both names, so the helpers' presence checks
 * pass and the fetch shim recognises the request, and the Worker's end
 * injects the real key and mint for the RPCs and tables a job has business
 * with (`SB_RPCS`, `SB_TABLES` in job-gateway.mjs). A launch that still
 * carries either name is refused by the runner. `test/container-job.test.mjs`
 * derives the RPC helper's reads and holds them to the markers.
 */
export const JOB_ENV_NAMES = [
  "ANTHROPIC_API_KEY", "XAI_API_KEY", "GEMINI_API_KEY", "FAL_KEY",
  "NEON_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SITE_SECRETS_KEY",
  "SITE_WORKERS_NAMESPACE", "SITE_WORKERS_API_ACCOUNT", "SITES_BUCKET_NAME", "SAAS_FALLBACK_ORIGIN", "EMAIL_FROM",
  "EDIT_ASYNC", "EDIT_ASYNC_CANARY", "EDIT_ASYNC_EVERYONE",
];

/** The subset of `env` a job is handed: the names above, strings only. */
export function jobSecrets(env) {
  const out = {};
  for (const name of JOB_ENV_NAMES) {
    const v = env && env[name];
    if (typeof v === "string" && v) out[name] = v;
  }
  return out;
}

/** How long the consumer waits to FIRE a job (room waits included) before
 *  running it itself; the fire is one short call, not the job. */
export const JOB_FIRE_MS = 90_000;
/** A gateway token outlives the job's clock by this much, for the finalize. */
export const JOB_TOKEN_GRACE_S = 900;

/**
 * Does THIS edit go through the queue?
 *
 * THE MASTER SWITCH HAS TO SAY YES, AND THEN ONE OF TWO DOORS. The wide one
 * (`editAsyncEveryone`) admits any identity at all; the narrow one is the
 * allowlist, the blast radius the path was proved behind. Either door alone
 * routes nothing with the switch off. An empty allowlist with the switch on and
 * the wide door shut is a deploy that changed no behaviour at all, which is
 * exactly what the first deployment of this was.
 *
 * MATCHED ON EITHER THE ACCOUNT OR THE SITE, because the two questions a canary
 * asks are different: one account's every edit, or one site's every edit
 * whoever makes it. Both are narrow and neither implies the other.
 */
export function editAsyncFor(env, { uid = "", slug = "" } = {}) {
  if (!editAsyncOn(env)) return false;
  // NON-STRINGS ARE REFUSED, NOT COERCED. `String(["u1"])` is `"u1"`, and a
  // shape mistake that let an array match an allowlist entry would widen the
  // canary silently — the one direction this must never fail in.
  const u = typeof uid === "string" ? uid.toLowerCase() : "";
  const s = typeof slug === "string" ? slug.toLowerCase() : "";
  // EVERYONE STILL NEEDS SOMEBODY. A call with no string identity has nothing
  // to route and is refused under the wide door exactly as under the narrow
  // one — the fork only ever asks after `authUser`, so a real request always
  // carries one, and a shape mistake cannot widen anything.
  if (editAsyncEveryone(env)) return !!(u || s);
  const list = readCanaryList(env && env.EDIT_ASYNC_CANARY);
  if (!list.length) return false;
  return (!!u && list.includes(u)) || (!!s && list.includes(s));
}
