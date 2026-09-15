/**
 * THE DURABLE WORK RECORD — the queue's memory, as opposed to its doorbell.
 *
 * Six RPCs in the `agent` schema, spoken over PostgREST. `fetch` is INJECTED, so
 * every branch here is drivable with no network and no database.
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
});

/** Postgres's "you may not" — what `accept_run` raises for another tenant's id. */
const NOT_ALLOWED = "42501";

const isText = (v) => typeof v === "string" && v.trim() !== "";

/** The states `accept` and `requeue` can answer. A state not on this list is a bug. */
export const WORK_STATES = Object.freeze(["queued", "running", "finished", "not-found"]);

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
      return {
        claimed: true,
        runId: answer.run_id,
        tenant: answer.tenant_id,
        kind: answer.kind,
        attempts: answer.attempts ?? 0,
      };
    },

    /**
     * Still here. `false` means the lease is gone and this worker must stop —
     * never that it should try harder.
     */
    async beat({ runId, worker, ttlS }) {
      return (await rpc(RPC.beat, { p_run_id: runId, p_worker: worker, p_ttl_s: ttlS })) === true;
    },

    /** `done` means nothing more should be delivered; without it the row stays outstanding. */
    async release({ runId, worker, done = true, error = null }) {
      return (await rpc(RPC.release, { p_run_id: runId, p_worker: worker, p_done: done, p_error: error })) === true;
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
