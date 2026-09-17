/**
 * THE DURABLE WORK RECORD — the queue's memory, as opposed to its doorbell.
 *
 * Seven RPCs in the `agent` schema, spoken over PostgREST. `fetch` is INJECTED, so
 * every branch here is drivable with no network and no database.
 *
 * **THE CLAIM IS A TOKEN, NOT JUST A NAME, AND THE TOKEN IS WHAT A WRITE
 * PRESENTS.** `claim` answers a `claim_token` minted by the database for that
 * claim alone; `beat`, `release` and `append` all require it. A worker name says
 * WHO; a token says WHICH CLAIM — and those differ in exactly the case that
 * matters, a run reclaimed while its previous holder is still running.
 *
 * **THIS IS WHAT `ctx.waitUntil` WAS MISSING.** `waitUntil` keeps work alive after
 * the response; it does not write down that the work exists. An isolate that is
 * evicted, deployed over or killed takes the closure with it and nothing anywhere
 * says a run was ever meant to progress. A row does.
 *
 * **A MESSAGE IS A DOORBELL AND CARRIES NO AUTHORITY.** The only thing a delivery
 * needs to say is which run; `claim` answers whose it is, in the same statement
 * that takes the work. So a consumer never acts as a tenant a message told it
 * about — the database does the telling, from the row it just locked.
 *
 * NOTHING IN HERE DECIDES ANYTHING ABOUT A RUN. It takes work, holds it, and lets
 * it go. The exclusivity lives in the migration, in one conditional UPDATE, and
 * this module's job is to speak to it correctly and to read its answers the right
 * way round.
 */

const RPC = Object.freeze({
  accept: "accept_run",
  requeue: "requeue_run",
  claim: "claim_run",
  beat: "beat_run",
  release: "release_run",
  sweep: "sweep_run_work",
  append: "append_entry",
});

/** Postgres's "you may not" — what `accept_run` raises for another tenant's id. */
const NOT_ALLOWED = "42501";

const isText = (v) => typeof v === "string" && v.trim() !== "";

/** The states `accept` and `requeue` can answer. A state not on this list is a bug. */
export const WORK_STATES = Object.freeze(["queued", "running", "finished", "not-found"]);

/**
 * What `append` can answer. Nine outcomes, because each needs something different
 * done about it — and two pairs must never be collapsed:
 *
 *   `already` vs `conflict`   — the SAME entry re-sent, versus a DIFFERENT entry at
 *                               the same logical position. The first is a retry and
 *                               is safe; the second is two writers and is not.
 *   `position` vs `conflict`  — the seq is taken by something else (move up and try
 *                               again), versus the entry itself is already there in
 *                               another form (stop).
 *
 * An answer not on this list is raised rather than guessed at.
 */
export const APPEND_ANSWERS = Object.freeze([
  "stored", "already", "position", "conflict",
  "no-work", "finished", "not-holder", "bad-token", "lease-expired",
]);

/**
 * The five that mean THIS WORKER MAY NOT WRITE — the claim is gone, or was never
 * this worker's. Every one of them says stop; none of them says try harder, and a
 * retry under any of them is the double execution the fence exists to prevent.
 */
export const LOST_CLAIM = Object.freeze(["no-work", "finished", "not-holder", "bad-token", "lease-expired"]);

export function makeWork(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeWork: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeWork: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeWork: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";

  async function rpc(name, args) {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: opts.key,
        authorization: `Bearer ${opts.key}`,
        "content-type": "application/json",
        // The schema is named per request rather than left to a default, because a
        // default is the thing that silently keeps working while meaning something
        // else.
        "content-profile": schema,
        accept: "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch { body = null; } }
    if (!res.ok) {
      const e = new Error(`${name}: HTTP ${res.status}${body?.message ? ` — ${body.message}` : text ? ` — ${text.slice(0, 200)}` : ""}`);
      e.status = res.status;
      e.body = body;
      // A run id that belongs to somebody else is NOT FOUND, never forbidden —
      // the same rule the store follows, for the same reason: "forbidden" tells a
      // stranger the id they guessed is real.
      if (body?.code === NOT_ALLOWED) e.code = "not-found";
      throw e;
    }
    return body;
  }

  /** A state we do not recognise is raised, never treated as one we do. */
  function stateOf(answer, where) {
    const state = answer?.state;
    if (!WORK_STATES.includes(state)) throw new Error(`${where}: unrecognised state ${JSON.stringify(state)}`);
    return state;
  }

  return {
    /**
     * Take on a new run: the run row, its first journal entry and its work row, in
     * ONE transaction. Nothing is acknowledged to a caller until all three are
     * committed, which is the whole of "persist the work before accepting it".
     *
     * THE `started` ENTRY IS PART OF THIS, not something the run writes later, and
     * that is what makes the log self-describing: the prompt, the agent, the model
     * and the bounds are durable before the HTTP response goes out. Without it a
     * work row would say "run this" about a request that no longer exists.
     */
    async accept({ runId, tenant, entry, kind = "start" }) {
      const answer = await rpc(RPC.accept, { p_run_id: runId, p_tenant: tenant, p_entry: entry, p_kind: kind });
      return { runId, state: stateOf(answer, "accept"), attempts: answer?.attempts ?? 0 };
    },

    /**
     * Ask for an existing run to be picked up again.
     *
     * **`running` IS A REAL ANSWER AND NOT AN ERROR.** A second resume arriving
     * while the first is still working must not become a second delivery, and the
     * database is where that is decided — a check in the caller would be a race
     * dressed as a wall.
     */
    async requeue({ runId, tenant }) {
      const answer = await rpc(RPC.requeue, { p_run_id: runId, p_tenant: tenant });
      return { runId, state: stateOf(answer, "requeue"), attempts: answer?.attempts ?? 0 };
    },

    /**
     * Take the work, exclusively, and learn whose it is.
     *
     * `{ claimed: false }` is the ordinary answer for a duplicate delivery and is
     * not a failure: it means somebody else has it.
     */
    async claim({ runId, worker, ttlS }) {
      const answer = await rpc(RPC.claim, { p_run_id: runId, p_worker: worker, p_ttl_s: ttlS });
      if (answer?.claimed !== true) return { claimed: false };
      if (!isText(answer.tenant_id)) throw new Error("claim: the claim carries no tenant");
      // **A CLAIM WITH NO TOKEN IS REFUSED, not carried on with.** Every write this
      // worker is about to make has to present one, so a claim missing it would
      // produce a run that cannot write a single entry — and the failure would show
      // up several steps later wearing a journal error's clothes. The database mints
      // it in the same UPDATE that takes the row; its absence means we are talking
      // to something that is not `claim_run`.
      if (!isText(answer.claim_token)) throw new Error("claim: the claim carries no token");
      return {
        claimed: true,
        runId: answer.run_id,
        tenant: answer.tenant_id,
        kind: answer.kind,
        // ⚠ **WHICH EXECUTOR WANTS THIS ROW, FORWARDED — and forgetting it here is what
        // shipped the automation routing DEAD.** The database answered it, `claim_run`
        // has carried it since the automations migration, and this object is built field
        // by field: an answer that is not named here does not exist to the runner. The
        // routing branch was correct, the column was correct, and every automation
        // delivery came back `no-agent` because `claim.executor` was `undefined`.
        //
        // **FOUND BY THE REAL DISPATCHER AND BY NOTHING ELSE.** The runner's own guard
        // drives a FAKE `work` whose `claim` answers `executor` directly, so it proved
        // the branch and not the hop — *a fixture more capable than the real producer
        // hides a defect exactly as well as one that is less.* `work.test.mjs` now drives
        // this function over a fake fetch and asserts the field survives.
        //
        // `?? "agent"` because a deployment whose database predates the column answers no
        // such field, and the only safe reading of "this row does not say" is the
        // executor every row had before there was a choice.
        // `isText`, NOT TRUTHINESS: `"   "` is a truthy string and is not an executor —
        // caught by this module's own guard, which is the recorded "refuse, never coerce"
        // one line after writing a comment about failing closed.
        executor: isText(answer.executor) ? answer.executor.trim() : "agent",
        attempts: answer.attempts ?? 0,
        token: answer.claim_token,
      };
    },

    /**
     * Still here, and still THIS claim. `false` means the claim is gone and this
     * worker must stop — never that it should try harder.
     *
     * **THIS IS ALSO THE OWNERSHIP CHECK, and that is deliberate rather than
     * convenient.** "May I still work on this run" and "I am still here" are the
     * same question asked of the same row, so making them two RPCs would be two
     * answers that can disagree. The runner asks it before it starts anything new.
     */
    async beat({ runId, worker, token, ttlS }) {
      return (await rpc(RPC.beat, { p_run_id: runId, p_worker: worker, p_token: token, p_ttl_s: ttlS })) === true;
    },

    /** `done` means nothing more should be delivered; without it the row stays outstanding. */
    async release({ runId, worker, token, done = true, error = null }) {
      return (await rpc(RPC.release, { p_run_id: runId, p_worker: worker, p_token: token, p_done: done, p_error: error })) === true;
    },

    /**
     * **THE ONLY DOOR INTO THE LOG.** The holder, the token, the work being
     * unfinished and the lease still being live are all checked inside the same
     * transaction that inserts the row, against the work row it locks — so a
     * reclaim cannot fit between the check and the write. `service_role` has no
     * INSERT on `agent.run_entries` at all, which is what makes this the only door
     * rather than the preferred one.
     *
     * Answers one of `APPEND_ANSWERS`, and reading them is the caller's whole job:
     * `stored` and `already` are successes, `position` says move up and try again,
     * and the six others say stop.
     */
    async append({ runId, seq, body, worker, token }) {
      const a = await rpc(RPC.append, {
        p_run_id: runId, p_seq: seq, p_body: body, p_worker: worker, p_token: token,
      });
      // The two success shapes are told apart by `already` rather than by absence,
      // because "not stored" and "already stored" are opposite readings of the same
      // missing field.
      const answer = a?.ok === true
        ? (a.already === true ? "already" : a.stored === true ? "stored" : null)
        : a?.why ?? null;
      if (!APPEND_ANSWERS.includes(answer)) {
        throw new Error(`append: unrecognised answer ${JSON.stringify(a)}`);
      }
      // `seq` is the database's, not ours: an `already` names where the entry
      // REALLY is, which can be a position this journal never proposed.
      return { answer, seq: Number.isInteger(a?.seq) ? a.seq : null };
    },

    /** Work whose lease is not live. What a redelivery is built from. */
    async sweep({ graceS = 30, limit = 50 } = {}) {
      const rows = await rpc(RPC.sweep, { p_grace_s: graceS, p_limit: limit });
      return (Array.isArray(rows) ? rows : []).map((r) => ({
        runId: r.run_id, tenant: r.tenant_id, kind: r.kind,
        attempts: r.attempts ?? 0, lastError: r.last_error ?? null,
      }));
    },
  };
}
