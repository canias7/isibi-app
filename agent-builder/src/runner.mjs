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
 * **AND THE CLAIM IS NOT ENOUGH ON ITS OWN, WHICH IS WHAT THE OWNERSHIP CHECKS ARE
 * FOR.** A worker can lose its claim mid-run — it stalled, the isolate froze, the
 * platform took its time, somebody reclaimed the row — and the sweeper or a
 * duplicate delivery will then hand the run to somebody else. Two workers on one run
 * means paying for the same model calls twice and firing the same tool twice.
 *
 * **THE MEASURED HOLE THIS CLOSES (2026-09-15).** Until the fence, "do I still hold
 * this" was answered from a FLAG in this process, set by the heartbeat — so a worker
 * whose claim had been taken went on working, and writing, until its next beat up to
 * `BEAT_EVERY_MS` later. That was not a theory: on the live deployment a run whose
 * lease was revoked at 2 entries reached 4 model answers and 3 tool results before
 * its consumer noticed. The flag was correct about the world as of 30 seconds ago.
 *
 * So ownership is now asked OF THE DATABASE at three places, and the flag is only
 * ever the cheap wall in front of them:
 *
 *   before every model call    — `checkpoint`, so a lost claim costs nothing;
 *   before every tool batch    — `checkpoint`, so a lost claim fires nothing;
 *   with every journal write   — `agent.append_entry`, which validates the holder,
 *                                the token, the work being unfinished and the lease,
 *                                inside the same transaction as the insert.
 *
 * The third is the one that cannot be raced, and it is why the other two are an
 * optimisation rather than the guarantee: a check followed by a write is two
 * statements with a reclaim able to fit between them, and only the database can put
 * them together. `runAgent` reads a refused write as `journal-failed` and returns
 * WITHOUT recording a stop, so a redelivery finds the run exactly as it was.
 *
 * **WHAT NONE OF IT CAN DO, and the distinction is the whole safety argument.**
 * Fencing stops the RECORD, never the action. A tool call already sent to the
 * outside world cannot be recalled by a database, so a stale worker that fired a
 * payment and was then refused its write leaves a model answer with no result —
 * which is exactly a PENDING CALL. If that tool is not `repeatable`, the run refuses
 * to resume (`cannot-resume`) rather than firing it again, and that refusal is the
 * guarantee. Fencing narrows the window in which the send can happen; `repeatable`
 * is what makes the residue safe.
 *
 * **THE HONEST LIMIT, STATED: the window is one model call plus one tool batch.**
 * Between two checkpoints this process will finish what it started, because tools
 * are the agent author's own code and there is nowhere to interrupt them from.
 * Making that window smaller means a cancellation hook inside the loop, which is a
 * change to `run.mjs` and has not been made.
 */

import { runAgent } from "./run.mjs";
import { stoppedEntry } from "./journal.mjs";
import { withInstructions, narrowTools } from "./define.mjs";
import { runWorkflow, expandWorkflow } from "./automations.mjs";

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

/**
 * Why a delivery did not run the work. Each needs a different thing done about it.
 *
 * ⚠ **`waiting` IS THE ONE THAT IS NOT A FAILURE AND IS NOT `ran` EITHER.** The work was
 * claimed, real progress was recorded and the worker was released on purpose — so reading
 * it as `ran` would say the execution finished, and reading it as any refusal would say
 * something went wrong. It is its own word, and the run is put back on the queue by the
 * cron or by an approval rather than by anything here.
 */
export const OUTCOMES = Object.freeze([
  "ran", "waiting", "not-claimable", "already-finished", "unreadable", "no-agent", "no-executor",
  "cannot-resume", "awaiting-approval", "too-many-attempts", "lease-lost", "beat-failed",
  "conflict", "failed",
]);

/**
 * The refusals `agent.append_entry` can give that mean the claim is gone. Mirrors
 * `LOST_CLAIM` in `work.mjs` and `CLAIM_GONE` in `store.mjs`; a test compares all
 * three, because the same fact in three modules is the shape that drifts.
 *
 * **THEY ALL PRODUCE THE OUTCOME `lease-lost`, AND THE REASON IS CARRIED BESIDE IT
 * RATHER THAN AS ITS OWN OUTCOME.** An outcome exists to tell a caller what to DO,
 * and the answer is identical for all five: stop, release nothing, let the run be
 * redelivered. What differs is what an operator should conclude — `bad-token` and
 * `not-holder` mean somebody else has the run, `lease-expired` means this worker was
 * too slow, `finished` means the run is over, `no-work` means retention took the row
 * — so the name rides in the delivery's `error` and in the event, where it is
 * diagnosis and not control flow.
 */
export const CLAIM_GONE = Object.freeze(["no-work", "finished", "not-holder", "bad-token", "lease-expired"]);

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
  /**
   * ⚠ THE SECOND EXECUTOR, AND IT IS OPTIONAL RATHER THAN REQUIRED — deliberately.
   *
   * The deployed Worker always passes one, and a deployment that did not would be
   * unable to run a whole kind of work; but every caller written before automations
   * existed builds a runner with three dependencies, and making this a fourth
   * REQUIRED one would turn a feature addition into a breaking change for a local
   * driver. Absent, an automation delivery answers `no-executor` — which says exactly
   * what is true — rather than being routed into the agent loop, which is the one
   * wrong thing available.
   */
  const automations = opts.automations && typeof opts.automations.read === "function"
    ? opts.automations
    : null;
  /**
   * ⚠ WHAT A TOOL CAN REACH, AND IT IS UNSCOPED HERE ON PURPOSE.
   *
   * `makeCapabilities(...)` on its own can reach nothing: the operations only exist once
   * `forTenant(t).forAgent(a)` has been applied, and the two identities are applied per
   * delivery, below, from the CLAIM and from the run's own journal snapshot. So what this
   * module holds is a factory that has no account attached to it, and the scoping happens
   * at the one point where both facts are known and neither has been through a model.
   *
   * **A deployment that hands in nothing is a deployment where every capability tool
   * refuses by name** — which is right, and is not the same as one where they quietly
   * answer as though the work were done.
   */
  const capabilities = opts.capabilities && typeof opts.capabilities.forTenant === "function"
    ? opts.capabilities
    : null;
  /**
   * ⚠ WHERE A CALL THAT NEEDS A PERSON GOES TO ASK — UNSCOPED HERE, for `capabilities`'
   * own reason. The gate only exists once `forTenant(t).forRun({runId})` has been
   * applied, and both come from the claim, per delivery, below.
   *
   * **A deployment that hands in nothing REFUSES every gated call by name.** That is the
   * safe direction and it is not the same as one that runs them: the model is told that
   * nobody could be asked, which is a different sentence from "somebody said no".
   */
  const approvals = opts.approvals && typeof opts.approvals.forTenant === "function"
    ? opts.approvals
    : null;
  /** Where a tool that starts work gets an identifier. Injected; never a global. */
  const newId = typeof opts.newId === "function" ? opts.newId : () => crypto.randomUUID();
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

    // ── the claim, held out loud ────────────────────────────────────────────
    // **THE HOLD IS THE WORKER AND THE TOKEN, and every call that acts on this run
    // presents both.** The name says who; the token says which claim — and those come
    // apart in exactly the case that matters, a run reclaimed while this process is
    // still going. `work.claim` refuses a claim carrying no token, so this cannot be
    // half-built.
    const hold = { worker, token: claim.token };

    let held = true;
    let lostBecause = null;
    let refusal = null;   // what `agent.append_entry` refused, if it did
    let misses = 0;
    let handle = null;

    const stopBeating = () => { if (handle !== null) { timer.clear(handle); handle = null; } };

    /**
     * ONE BEAT: say we are still here, and learn whether we still hold the claim.
     *
     * **THE SAME ARITHMETIC SERVES THE HEARTBEAT AND THE OWNERSHIP CHECK**, because
     * two rules about when a claim is lost is two answers that can disagree — and the
     * disagreeing case is the one where this process thinks it holds a run it does
     * not. Answering the question and renewing the lease are the same UPDATE, so they
     * cannot be out of step either.
     */
    const beatOnce = async () => {
      let ok = false, threw = null;
      try { ok = await work.beat({ runId, worker, token: hold.token, ttlS }); }
      catch (e) { threw = e; }
      if (threw) {
        // CANNOT-TELL IS NOT A YES. A beat we could not send may mean the lease is
        // fine or may mean it is gone, and only one of those readings is safe. One
        // miss is inside the lease the arithmetic says we hold; past that, stop.
        misses += 1;
        onError({ at: "beat", runId, error: String(threw?.message ?? threw), misses });
        if (misses > TOLERATED_MISSES) { held = false; lostBecause = "beat-failed"; }
        return held;
      }
      if (!ok) {
        // Definitive: the database says this claim is not ours.
        held = false; lostBecause = "lease-lost";
        return false;
      }
      misses = 0;
      return true;
    };

    const tick = async () => {
      handle = null;
      if (!held) return;
      if (!(await beatOnce())) return;
      handle = timer.set(tick, beatEveryMs);
    };
    handle = timer.set(tick, beatEveryMs);

    const assertHeld = () => {
      if (!held) throw new Error(`the claim on this run is gone (${lostBecause})`);
    };

    /**
     * **OWNERSHIP, ASKED OF THE DATABASE BEFORE ANYTHING NEW IS STARTED.** Handed to
     * `runAgent` as its `checkpoint`, so it runs before each model call and before
     * each batch of tool calls.
     *
     * IT THROWS, and the throw is the mechanism rather than an error path: it escapes
     * `runAgent` without a stop being written, which leaves the run exactly as the
     * next holder needs to find it. A `return` here would need `run.mjs` to invent a
     * stop reason, and writing a stop is the one thing a process that has lost the
     * run must not do.
     */
    const mayStart = async ({ what, step }) => {
      assertHeld();
      if (await beatOnce()) return;
      onEvent({ at: "stand-down", runId, what, step, why: lostBecause });
      throw new Error(`the claim on this run is gone (${lostBecause}) — not starting ${what}`);
    };

    /** Let go, and say whether anything more should be delivered. */
    const finish = async (done, why, error = null, stop = null) => {
      stopBeating();
      // **A LOST CLAIM RELEASES NOTHING.** Somebody else may hold this row now, and
      // `release_run` is gated on the holder, the token AND a live lease anyway — two
      // walls, deliberately: this one is the intent, that one survives a mistake here.
      //
      // MEASURED: removing this `if (held)` SURVIVES the sweep, because the database
      // refuses a stale release and the call is a no-op. Kept as the statement of
      // intent and as one fewer pointless round trip; the wall is the SQL one.
      if (held) {
        try { await work.release({ runId, worker, token: hold.token, done, error }); }
        catch (e) { onError({ at: "release", runId, error: String(e?.message ?? e) }); }
      }
      // The REASON rides on the event beside the outcome, because "a failure that
      // cannot name itself" is this product's most repeated own goal and a
      // `lease-lost` that does not say WHICH refusal produced it is one.
      onEvent({ at: "done", runId, why, done, error });
      return { ran: why === "ran", why, runId, stop, error };
    };

    /**
     * ⚠ RUN AN AUTOMATION — the second executor, and the whole of what it does
     * differently.
     *
     * It is reached only from a claim that said `executor: "automation"`, so everything
     * above it — the claim, the token, the heartbeat, the attempt ceiling — has already
     * happened and is shared. What is different is that there is no model, no agent
     * registry lookup and no journal replay: the configuration comes out of the execution
     * record it was accepted with, and the whole thing is one pass and one write.
     *
     * **NO CHECKPOINT LOOP, AND THAT IS ARITHMETIC RATHER THAN AN OMISSION.** `runAgent`
     * asks the database whether it still holds the run before every model call and every
     * tool batch, because each of those costs money or touches the outside world and there
     * are many of them. A workflow of this milestone's steps touches nothing outside this
     * process and finishes in microseconds, so there is nothing to interrupt between: the
     * one place exclusivity has to hold is the WRITE, and `agent.finish_automation_run`
     * puts that behind the same fence every journal write goes through. **The day a step
     * can reach outside — an app action, a wait — that stops being true**, and the note at
     * the top of `automations.mjs` says what has to change with it.
     */
      const deliverAutomation = async () => {
      // A DEPLOYMENT WITH NO AUTOMATION EXECUTOR SAYS SO. Taken off the queue rather than
      // retried, because another delivery cannot help: that needs a deployment.
      if (!automations) {
        return await finish(true, "no-executor", "this deployment has no automation executor");
      }

      let exec;
      try {
        exec = await automations.read(runId, claim.tenant);
      } catch (e) {
        // COULD NOT ASK. Nothing is decided, so the run is released UNFINISHED and the
        // sweeper offers it again — the same reading `work.claim` failing gets.
        onError({ at: "automation-read", runId, error: String(e?.message ?? e) });
        return await finish(false, "failed", String(e?.message ?? e));
      }

      // A WORK ROW WHOSE EXECUTION RECORD IS GONE, or whose steps cannot be read. Neither
      // is helped by another delivery, and running an unreadable workflow as an empty one
      // would report a run nobody configured as having succeeded.
      if (!exec) {
        return await finish(true, "unreadable", "this run has no automation execution record");
      }
      if (!Array.isArray(exec.steps)) {
        return await finish(true, "unreadable", "this execution's stored steps cannot be read as a list");
      }

      /**
       * ⚠ **THE SUBWORKFLOWS ARE COPIED IN BEFORE THE FIRST STEP, AND ONLY THERE.**
       *
       * `expandWorkflow` replaces a `workflow` step with the child's own steps, so from here
       * down there is ONE list, one position, one budget and one set of outcomes — which is
       * what makes the shared execution budget a property of the shape rather than a check.
       *
       * **PAST POSITION 0 THE LIST IS LEFT EXACTLY AS IT IS, and that is not an
       * optimisation.** Expanding then would RENUMBER every position, and the outcomes
       * already recorded would point at steps they are not about; `set_automation_plan`
       * refuses the write, so the flattened list would run against a row that still holds
       * the unflattened one. A `workflow` step that reaches the executor fails BY NAME — the
       * step's own `run` says it was supposed to be copied in and was not — which is the
       * honest reading of a row in that state.
       *
       * **NO FLAG SAYS WHETHER IT HAS BEEN EXPANDED, AND NONE IS NEEDED**: a flattened list
       * holds no `workflow` step, so the absence of one IS the flag, in the only place that
       * can see it. A redelivery whose first attempt expanded and then died finds the plan
       * written and skips this whole block.
       */
      let steps = exec.steps;
      if (exec.position === 0 && steps.some((st) => st && typeof st === "object" && st.type === "workflow")) {
        // AN EXECUTION WITH NO AGENT RECORDED CANNOT LOOK ONE UP, and that is a refusal
        // rather than an empty list: "this agent has no other automations" and "we cannot
        // tell whose automations to look at" are opposite facts, and the second must not
        // read as a workflow naming something that is not there.
        if (!exec.agentId) {
          return await finish(true, "unreadable",
            "this execution has no agent recorded, so the automations it runs cannot be found");
        }
        let children;
        try {
          children = await automations.children({ tenant: claim.tenant, agentId: exec.agentId });
        } catch (e) {
          // COULD NOT ASK. Nothing is decided and nothing is written, so the run is released
          // UNFINISHED and the sweeper offers it again — the same reading the read failing gets.
          onError({ at: "automation-children", runId, error: String(e?.message ?? e) });
          return await finish(false, "failed", String(e?.message ?? e));
        }
        const found = expandWorkflow({
          steps,
          // THE LOOKUP IS THE WALL. `expandWorkflow` is handed data and answers one refusal
          // for "not there" and "not this agent's", because naming the difference would tell
          // a caller that another account's automation exists.
          lookup: (id) => children.find((c) => c && c.id === id) ?? null,
        });
        if (found.error) {
          /**
           * ⚠ **A WORKFLOW THAT CANNOT BE ASSEMBLED IS A FAILED EXECUTION WITH ITS REASON, not
           * an unreadable one.** `unreadable` takes the run off the queue and says nothing a
           * customer can act on; this is a workflow naming an automation that is not theirs,
           * or running itself, or too deep — each of which somebody can fix, and each of which
           * reads differently. So it stops the way a failed step stops, and the reason travels
           * to the history where they will meet it.
           */
          const stop = { reason: "failed", at: null, error: found.error };
          let answer;
          try {
            answer = await automations.finish({
              runId, worker, token: hold.token, outcomes: [], stop, position: 0, values: {},
            });
          } catch (e) {
            onError({ at: "automation-finish", runId, error: String(e?.message ?? e) });
            return await finish(false, "failed", String(e?.message ?? e));
          }
          if (answer?.ok !== true) {
            const why = typeof answer?.why === "string" ? answer.why : "unknown";
            if (CLAIM_GONE.includes(why)) { held = false; lostBecause = "lease-lost"; }
            return await finish(false, CLAIM_GONE.includes(why) ? "lease-lost" : "failed", why);
          }
          // ALREADY RELEASED BY THE TRANSACTION THAT FINISHED IT, exactly as an ordinary stop is.
          stopBeating();
          onEvent({ at: "done", runId, why: "ran", done: true, reason: "failed" });
          return { ran: true, why: "ran", runId, stop, error: null };
        }
        let set;
        try {
          set = await automations.setPlan({
            runId, worker, token: hold.token, steps: found.steps, uses: found.uses,
          });
        } catch (e) {
          onError({ at: "automation-plan", runId, error: String(e?.message ?? e) });
          return await finish(false, "failed", String(e?.message ?? e));
        }
        // A FENCED REFUSAL MEANS THIS WORKER MAY NOT WRITE, so it stops here and attempts
        // nothing else — the same reading a refused checkpoint gets. `set: false` is NOT one
        // of these: that is a plan somebody else already wrote, and the position it wrote is
        // what the next delivery reads.
        if (set?.ok !== true) {
          const why = typeof set?.error === "string" ? set.error : "unknown";
          if (CLAIM_GONE.includes(why)) { held = false; lostBecause = "lease-lost"; }
          return await finish(false, CLAIM_GONE.includes(why) ? "lease-lost" : "failed",
            `set_automation_plan: ${why}`);
        }
        // ⚠ **THE EXPANDED LIST IS ONLY RUN WHEN IT IS THE LIST THAT WAS STORED.** `set:
        // false` means another worker's plan is in the row and the position may have moved,
        // so running ours would execute a list the record does not hold. Released unfinished:
        // the next delivery reads what is really there, which terminates.
        if (set.set !== true) {
          return await finish(false, "conflict", "this execution's plan was written by another worker");
        }
        steps = found.steps;
      }

      /**
       * ⚠ RETRIEVAL IS INJECTED, AND THIS IS THE ONE PLACE IT IS CHOSEN. The executor takes
       * a one-function contract and never knows what is behind it, so replacing keyword
       * search is replacing this closure. **An execution with no agent recorded REFUSES BY
       * NAME rather than finding nothing** — one predates the reference material entirely,
       * and "nothing matched" would read to a customer as a fact about their own documents.
       */
      const retrieve = async ({ query, limit }) => {
        if (!exec.agentId) {
          return { error: "this execution was accepted before reference material existed, so there is nothing to search" };
        }
        return await automations.search({ tenant: claim.tenant, agentId: exec.agentId, query, limit });
      };

      /**
       * ⚠ THE CHECKPOINT — one step's progress, fenced, before the next step starts.
       *
       * It is what makes "resuming cannot repeat completed actions" a property rather than a
       * hope, and it is the reason an execution is N+1 transactions rather than one. The
       * journal entry is the durable record and the row update is the resumable position;
       * `agent.advance_automation_run` writes both or neither.
       *
       * **A REFUSAL IS HANDED BACK AS `{ok: false}` AND NEVER THROWN, because the executor
       * reads it** — it stops there and attempts nothing else, which is exactly right: a
       * worker whose claim is gone must not write a stop either.
       */
      const record = async ({ position, outcomes, values, waiting, at, loops, tries }) => {
        const entry = {
          kind: "step",
          // THE POSITION REACHED, which is what this entry is about. A pause records the
          // position it is paused AT, so the pause and the later completion of that same step
          // carry different values and neither can be mistaken for the other.
          step: position,
          at,
          // AND WHICH OF THE TWO THIS IS. Without it a step that finished and then paused
          // would produce two byte-identical bodies, the second read as `already`, and the
          // log would hold one entry for two events.
          mark: waiting ? "waiting" : "progress",
          done: outcomes.length,
        };
        let answer;
        try {
          answer = await automations.advance({
            runId, worker, token: hold.token, entry, position, values, outcomes, waiting,
            // ⚠ **FORWARDED, because a value computed and never forwarded is this
            // repository's most-recorded defect.** The executor renders both fresh on every
            // checkpoint; dropping either here would leave a restart re-entering a loop at
            // a round it has already done, or giving each delivery a fresh retry budget,
            // with the executor and the database both perfectly correct.
            loops, tries,
          });
        } catch (e) {
          onError({ at: "automation-advance", runId, error: String(e?.message ?? e) });
          return { ok: false, why: String(e?.message ?? e) };
        }
        if (answer?.ok !== true) {
          const why = typeof answer?.why === "string" ? answer.why : "unknown";
          // THE DATABASE'S REFUSAL IS AUTHORITATIVE, and the flag is corrected from the one
          // source that knows — the beat has not necessarily noticed yet.
          if (CLAIM_GONE.includes(why)) { held = false; lostBecause = "lease-lost"; }
          return { ok: false, why };
        }
        // ⚠ **A CHECKPOINT THAT WAS ACCEPTED AND DID NOT LAND IS SAID, never swallowed.** The
        // fence answered `ok`, so this worker may write — and the row still refused the move,
        // which now means one thing only: it already holds at least as many outcomes as we
        // offered. That is the ordinary answer to a redelivery replaying work already
        // recorded, and it is ALSO what a genuine disagreement looks like, so it goes in the
        // log rather than being inferred later from a position that does not add up. **This is
        // the line the loop defect hid behind**: for every round after the first the answer
        // was `ok: true, advanced: false` and nothing anywhere looked at it.
        if (answer?.advanced === false) {
          onError({ at: "automation-stale", runId, error: `the row did not move to ${position}` });
        }
        return { ok: true };
      };

      // **THE CONFIGURATION IS THE ONE RECORDED AT ACCEPTANCE**, read here and never from
      // `agent.automations`. That is what makes an edit reach the next execution and never
      // this one — the same rule the instruction snapshot follows one executor over.
      const walked = await runWorkflow({
        // THE FLATTENED LIST, which is `exec.steps` unless this delivery expanded it.
        steps,
        zone: exec.zone,
        occurrence: exec.occurrence,
        now,
        // ── where it had got to, and what it holds ─────────────────────────────
        startedAt: exec.startedAt,
        position: exec.position,
        values: exec.values,
        outcomes: exec.outcomes,
        decisions: exec.decisions,
        waiting: exec.waiting,
        waitUntil: exec.waitUntil,
        loops: exec.loops,
        tries: exec.tries,
        memory: exec.memory,
        retrieve,
        record,
      });
      const { outcomes, stop, waiting, halted, values, position } = walked;

      // ⚠ **A REFUSED CHECKPOINT MEANS NOTHING MORE MAY BE WRITTEN.** The execution is left
      // exactly as the next holder needs to find it — no stop, no release — which is the same
      // reading `runAgent` gives a refused journal write.
      if (halted !== null) {
        stopBeating();
        onEvent({ at: "lost", runId, why: "lease-lost", done: false, error: halted });
        return { ran: false, why: "lease-lost", runId, stop: null, error: halted };
      }

      // ⚠ **WAITING: ALREADY RELEASED BY THE TRANSACTION THAT RECORDED THE PAUSE**, so the
      // ordinary `finish` is not called and nothing is held open. The cron or an approval puts
      // it back on the queue, and a later delivery continues from the position just written.
      if (waiting) {
        stopBeating();
        onEvent({ at: "waiting", runId, why: "waiting", done: false, kind: waiting.kind, step: waiting.step });
        return { ran: true, why: "waiting", runId, stop: null, waiting, error: null };
      }

      // The cheap wall in front of the fence, and a SECOND wall rather than the same one:
      // `finish_automation_run` refuses the write anyway, in the transaction that would
      // have performed it. This only saves a round trip on a run we already know is gone.
      assertHeld();

      let answer;
      try {
        answer = await automations.finish({ runId, worker, token: hold.token, outcomes, stop, position, values });
      } catch (e) {
        onError({ at: "automation-finish", runId, error: String(e?.message ?? e) });
        return await finish(false, "failed", String(e?.message ?? e));
      }

      if (answer?.ok !== true) {
        const why = typeof answer?.why === "string" ? answer.why : "unknown";
        // THE DATABASE'S REFUSAL IS AUTHORITATIVE. A fenced refusal means the claim is
        // gone — which the beat has not necessarily noticed yet — so the flag is corrected
        // from the one source that knows, and nothing is released: somebody else holds it.
        if (CLAIM_GONE.includes(why)) {
          held = false; lostBecause = "lease-lost";
          return await finish(false, "lease-lost", why);
        }
        // A DIFFERENT entry in this run's own slot. The claim may still be ours; what is
        // stale is our picture of the log, and the next delivery reads what is really
        // there.
        if (why === "conflict") {
          return await finish(false, "conflict", "another writer's entry is in this run's log");
        }
        return await finish(false, "failed", `finish_automation_run: ${why}`);
      }

      // ⚠ **FINISHED, AND ALREADY RELEASED BY THE TRANSACTION THAT FINISHED IT** — so the
      // ordinary `finish` is NOT called here, and calling it would be a second release of
      // a claim the database has already cleared. What still has to happen is this
      // process's own tidying: stop the heartbeat, and say what happened.
      stopBeating();
      onEvent({ at: "done", runId, why: "ran", done: true, reason: stop?.reason ?? null });
      return { ran: true, why: "ran", runId, stop, error: null };
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

      /**
       * ⚠ **WHICH EXECUTOR, ANSWERED BY THE CLAIM, AND ASKED BEFORE THE AGENT IS
       * LOOKED UP.** An automation has no agent in the registry, so reading the log
       * first would answer `no-agent` about work that has nothing to do with agents.
       *
       * **IT IS `claim.executor` AND NOT `claim.kind`, and that distinction cost a
       * design.** `kind` is why the row is outstanding — `agent.requeue_run` sets it to
       * `'resume'` on every resume — so an automation discriminated by it would become
       * an agent run the first time anybody asked for it again. `executor` is what the
       * row IS, and nothing rewrites it.
       *
       * **AND IT COMES FROM THE DATABASE, NOT FROM THE MESSAGE.** The doorbell carries
       * a run id and nothing else, exactly as before; the same statement that takes the
       * work says whose it is AND what it is. A delivery cannot choose an executor any
       * more than it can choose a tenant.
       */
      if (claim.executor === "automation") {
        return await deliverAutomation();
      }

      // **THE JOURNAL IS BOUND TO THIS CLAIM.** `open` refuses to hand one back
      // without a hold, so there is no way to reach a writer that does not present
      // the claim it is writing under.
      const open = await scoped.open(runId, { hold });

      // A finished run is not executed again. `runAgent` would refuse it too —
      // two walls, and this one also takes the work off the queue.
      if (open.state.status === "stopped") return await finish(true, "already-finished", null, open.state.stop);

      // A log that cannot be read is not resumed, and nothing is spent finding
      // out. A redelivery would read the same junk, so it comes off the queue.
      if (open.state.problems.length) {
        return await finish(true, "unreadable", open.state.problems.join("; "));
      }

      const name = open.run?.agent_name ?? open.state.agent;
      const registered = isText(name) ? registry.get(name) : undefined;
      // A run whose agent is no longer registered cannot be helped by another
      // delivery: that needs a deployment, not a retry.
      if (!registered) return await finish(true, "no-agent", `the agent "${name ?? "?"}" is not registered here`);

      /**
       * **THE INSTRUCTIONS COME FROM THE LOG, AND THE TOOLS AND BOUNDS COME FROM
       * THE CODE.** A customer-authored agent is a name, an instruction and a
       * conversation — data — and it executes under a REGISTERED agent that owns
       * everything capability-shaped. `withInstructions` is the only door between
       * the two and it can carry nothing but the text.
       *
       * **READ FROM THE LOG ON EVERY DELIVERY, WHICH IS WHAT MAKES THE SNAPSHOT A
       * SNAPSHOT.** The entry was written when the work was accepted and cannot be
       * edited afterwards, so a customer who rewrites their agent's instructions
       * while a run is going — or before a resume, or before the sweeper offers it
       * again — changes what the NEXT run is told and never what this one was.
       * Reading `agent.agents` here instead would make an in-flight run's own
       * instructions mutable from the outside, which is the defect this whole
       * arrangement exists to prevent.
       */
      let agent = open.state.instructions
        ? withInstructions(registered, open.state.instructions)
        : registered;

      /**
       * **AND WHICH TOOLS IT MAY CALL COMES FROM THE LOG TOO, narrowed against the
       * catalog in code.** `registered.authored` says this agent's own tool list is a
       * CATALOG rather than a permission set, so a run gets exactly the subset its
       * first entry recorded — `[]` when it recorded none, which is every run
       * accepted before the selection existed and is the fail-closed answer.
       *
       * **THE DECISION IS `registered.authored` AND NEVER A FIELD ON THE ENTRY**, and
       * that is the wall rather than a style. `POST /runs` can name any registered
       * agent with no snapshot at all; reading "is this authored" off the log would
       * hand such a run the whole catalog, which is the one way this could widen.
       *
       * **READ AGAIN ON EVERY DELIVERY, exactly as the instructions are.** A customer
       * who unticks a tool while a run is going changes what the NEXT run may call and
       * never what this one may call — and a customer who TICKS one cannot reach a run
       * already accepted. Reading `agent.agents.tools` here instead would make an
       * in-flight run's own permissions editable from the outside.
       */
      if (registered.authored) {
        const narrowed = narrowTools(agent, open.state.tools ?? []);
        agent = narrowed.agent;
        // A SELECTION NAMING A TOOL THIS DEPLOYMENT NO LONGER OFFERS IS SAID, never
        // silently dropped. It does not stop the run — the tools that remain are still
        // the customer's — but a capability that quietly stops working with nothing
        // written down anywhere is how a retired tool becomes a mystery.
        if (narrowed.unknown.length) {
          onEvent({ at: "tools-gone", runId, agent: registered.name, unknown: narrowed.unknown });
        }
      }

      /**
       * ⚠ THE BACKEND THIS RUN'S TOOLS MAY REACH, SCOPED FROM TWO FACTS NEITHER OF WHICH
       * CAME FROM A MODEL — and both are read again on every delivery, exactly as the
       * instructions and the tool selection are.
       *
       *   * the TENANT is `claim.tenant`, answered by `claim_run` in the same statement
       *     that took the row, so a stale or replayed message can never make a consumer
       *     act as somebody else;
       *   * the AGENT is the run's own first journal entry, which nobody can edit.
       *
       * **A run with no authored agent gets NO capabilities at all.** That is every
       * verification agent and every run started through `POST /runs`, and handing one of
       * those a backend would mean choosing an agent for it here — which is the one
       * decision this code has no honest way to make.
       */
      const authoredAgent = typeof open.state?.authoredAgent === "string" ? open.state.authoredAgent : null;
      const canDo = capabilities && authoredAgent
        ? capabilities.forTenant(claim.tenant).forAgent(authoredAgent)
        : null;
      // ⚠ THE GATE IS BOUND TO THE RUN AND THE ACCOUNT HERE, from the claim — and unlike
      // the capability backend it does NOT need an authored agent. Every run can have a
      // call that needs a person; the agent id only decides whether a screen can show
      // what is waiting without reading the journal, so it rides as null where there is
      // none, exactly as the column allows.
      const mayCall = approvals
        ? approvals.forTenant(claim.tenant).forRun({ runId, agentId: authoredAgent })
        : null;

      /**
       * ⚠ WHICH TOOLS HAVE BEEN TAKEN AWAY — READ LIVE, ON EVERY DELIVERY, AND NEVER FROM
       * THE SNAPSHOT.
       *
       * **THE ASYMMETRY WITH THE LINES ABOVE IS THE DESIGN, not an inconsistency.** The tool
       * SELECTION is read from `open.state.tools` — the run's own first journal entry —
       * precisely so a customer editing their settings cannot change what a run already
       * under way may call: that edit is a statement about what the agent may do from now
       * on. A REVOCATION is a statement about what must stop, so it has to reach a run
       * already going, which means asking the database again here.
       *
       * IT COSTS ONE READ PER DELIVERY and it is not optional: a revocation nobody asks
       * about is a revocation that does not revoke anything. **A read that FAILS raises**,
       * through the same path every other store failure takes — answering `[]` would be an
       * outage silently restoring every withdrawn permission, which is the one direction
       * that lets a revoked tool run.
       *
       * A run with no authored agent has nothing to revoke against and answers `[]`; so
       * does an agent nobody has revoked anything for. The two do not need distinguishing,
       * because neither subtracts anything.
       */
      const revoked = approvals && authoredAgent
        ? await approvals.forTenant(claim.tenant).revokedTools(authoredAgent)
        : [];
      // SAID, never silently applied. A withdrawal is somebody's deliberate act and the one
      // place an operator can see it took effect on a run already going is this log line.
      if (revoked.length) {
        onEvent({ at: "tools-revoked", runId, agent: registered.name, tools: revoked });
      }

      const record = await runAgent({
        agent,
        tenant: { id: claim.tenant },
        capabilities: canDo,
        approvals: mayCall,
        // ⚠ THE RUN IS THE HALF THE LOOP CANNOT KNOW, and it is the claim's own id — so a
        // tool that starts work derives an identity from the CALL rather than minting one,
        // and a redelivery of this run asks the database for the same row.
        operationSeed: runId,
        newId,
        // ⚠ SUBTRACTED INSIDE THE LOOP rather than applied to `agent` here, because the loop
        // needs the NAMES: a revoked tool a model asks for anyway has to be answered with the
        // real reason, and a pending call of one has to be answered rather than re-run. An
        // agent narrowed here would leave both of those reading as "no such tool".
        revoked,
        from: open.entries,
        // **OWNERSHIP BEFORE ANY NEW WORK, ASKED OF THE DATABASE.** Before each model
        // call and before each tool batch — so a claim lost during the previous step
        // costs neither money nor a side effect.
        checkpoint: mayStart,
        // The cheap wall in front of it, and a SECOND wall rather than the same one:
        // `checkpoint` has already asked the database immediately above this call, so
        // what this catches is a beat that came back `false` in between.
        //
        // **A SWEEP CANNOT KILL THIS ONE ON ITS OWN AND THAT IS MEASURED, not argued:**
        // removing `assertHeld()` here SURVIVES, because the checkpoint one line up has
        // just asked the database the same question. The window it covers — the periodic
        // beat answering `false` between the checkpoint and this call — is real and is
        // microseconds wide, which is why no test can open it. Declared here because a
        // sweep cannot see a deliberate redundancy and the next reader deletes what
        // nothing appears to need; the spec mutates the PAIR, which dies.
        send: async (req) => { assertHeld(); return send(req); },
        // THE GATE ON THE HISTORY, AND THE ONE THAT CANNOT BE RACED. The write itself
        // is validated against the work row inside one transaction by
        // `agent.append_entry`; what this wrapper adds is reading the refusal the
        // right way round. `runAgent` reads a refused write as `journal-failed` and
        // returns WITHOUT recording a stop, which is exactly right: the run is left as
        // it was for whoever holds the claim now.
        journal: {
          append: async (entry) => {
            // **AND THIS ONE IS REDUNDANT WITH THE DATABASE, which is the strongest
            // thing that can be said about it.** Removing it SURVIVES the sweep:
            // `agent.append_entry` refuses the write anyway, in the same transaction
            // that would have performed it. The wall that matters is one layer down and
            // is killed by the SQL sweep's own mutants; this is the cheap one in front,
            // saving a round trip on a run we already know we have lost.
            assertHeld();
            try { return await open.journal.append(entry); }
            catch (e) {
              // **THE DATABASE'S REFUSAL IS AUTHORITATIVE, AND IT IS NOT A JOURNAL
              // FAILURE.** A fenced refusal means the claim is gone — which the beat
              // has not necessarily noticed yet — so the flag is corrected from the
              // one source that knows, and under the refusal's OWN name.
              if (e?.code === "fenced" && CLAIM_GONE.includes(e.why)) {
                held = false; lostBecause = "lease-lost"; refusal = e.why;
              } else if (e?.code === "conflict") {
                // Somebody else's entry is in this slot. We may still hold the claim,
                // so this is not a lost lease: it is a log this process's snapshot is
                // behind on, and the answer is a fresh delivery.
                refusal = "conflict";
              }
              throw e;
            }
          },
        },
        now,
      });

      // Asked AFTER the run rather than inferred from the record: the record's own
      // stop reason for a lost claim is `journal-failed`, which is also what a
      // genuinely broken journal says, and those need opposite handling.
      if (!held) return await finish(false, lostBecause ?? "lease-lost", refusal, null);

      // **A CONFLICT IS NOT A LOST CLAIM AND NOT A FAILURE.** A different entry
      // arrived in a slot this run's snapshot thought was free, so the log has moved
      // under us. The claim may still be ours, so it is RELEASED — not done — and the
      // next delivery re-reads the log and continues from what is really there.
      // Terminating, because that delivery's snapshot includes the other entry.
      if (refusal === "conflict") {
        return await finish(false, "conflict", "another writer's entry is in this run's log");
      }

      const reason = record?.stop?.reason ?? null;

      // A run that cannot be safely resumed is NOT a failure and NOT retryable.
      // It is waiting for a person: a pending tool call that is not repeatable
      // may have taken a payment, and another delivery would just refuse again.
      // Deliberately leaves the log without a stop, so the run still reads as
      // running with its pending calls visible.
      if (reason === "cannot-resume") {
        return await finish(true, "cannot-resume", JSON.stringify(record.stop.pending ?? []), record.stop);
      }

      // ⚠ WAITING FOR A PERSON, AND IT IS NEITHER A FAILURE NOR `ran`. The work row is
      // marked DONE — there is nothing to redeliver until somebody answers — and the log
      // is deliberately left with no stop, so the run still reads as in progress with
      // its calls pending. `agent.decide_tool_approval` puts it back on the queue through
      // `requeue_run`, which is the durable wait this product already had rather than a
      // second one built beside it.
      if (reason === "awaiting-approval") {
        return await finish(true, "awaiting-approval", JSON.stringify(record.stop.waiting ?? []), record.stop);
      }

      // NOWHERE TO ASK IS RETRYABLE, exactly as a broken journal is: the run is left
      // open and a later delivery asks again, rather than a customer's work being closed
      // over an outage in the approval store.
      if (reason === "approval-failed") {
        return await finish(false, "failed", `approval-failed: ${record.stop.error ?? ""}`, record.stop);
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
          await closeWithCrash(runId, claim.tenant, hold, String(e?.message ?? e));
        } catch (e2) {
          onError({ at: "deliver-stop", runId, error: String(e2?.message ?? e2) });
        }
      }
      return await finish(last, "failed", String(e?.message ?? e));
    }
  }

  /**
   * Close a run's log with a `crashed` stop. Best effort, and only ever last.
   *
   * **IT PRESENTS THE CLAIM LIKE EVERY OTHER WRITE.** A crash is the one moment when
   * writing a stop without checking would be most tempting and most wrong: a stop is
   * what tells the next holder the run is over, so a stale worker writing one ends a
   * run somebody else is in the middle of. It is reached only while the claim is
   * still held, and the fence checks again anyway.
   */
  async function closeWithCrash(runId, tenant, hold, error) {
    const scoped = store.forTenant(tenant);
    const open = await scoped.open(runId, { hold });
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
