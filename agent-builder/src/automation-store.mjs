/**
 * AUTOMATIONS OVER THE WIRE — the three things the engine has to say about one.
 *
 * `fetch` is INJECTED, so every branch is drivable with no network and no database,
 * exactly as in `store.mjs` and `work.mjs`. `key` is the service key: it goes into a
 * request header and into nothing else.
 *
 * **IT SPEAKS TO THE AUTOMATION'S OWN FUNCTIONS AND NEVER TO THE QUEUE'S.** Claiming,
 * beating and sweeping are `work.mjs`'s, unchanged, because an automation execution is
 * a run and uses the same work row. What is here is only what is specific to one:
 * reading the configuration it was accepted with, finishing it, and asking the schedule
 * what is due.
 */

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * An object, or the stated fallback.
 *
 * **CANNOT-TELL MUST NEVER READ AS A VALUE, and the two fallbacks are the two readings.**
 * `{}` is right for the value bags — an execution with no values has none — and `null` is
 * right for `waiting`, because `{}` there would be a pause with no kind and no step, which
 * is a state the database refuses and this process must not invent.
 */
const plainObject = (v, fallback = {}) =>
  (v && typeof v === "object" && !Array.isArray(v) ? v : fallback);

/** A timestamp as milliseconds, or `null` for one that cannot be read as an instant. */
const msOf = (v) => {
  if (!isText(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

export function makeAutomationStore(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeAutomationStore: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeAutomationStore: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeAutomationStore: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";

  // The profile header names the RELATION and differs by DIRECTION: `content-profile`
  // for anything that writes, `accept-profile` for a read. PostgREST ignores the read
  // header on a write, which is how a DELETE in the other product once resolved against
  // `public` and could never have worked.
  const headers = (write) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    [write ? "content-profile" : "accept-profile"]: schema,
  });

  async function call(method, path, body, write) {
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method, headers: headers(write),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    if (!res.ok) {
      const e = new Error(`${path}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : text ? ` — ${text.slice(0, 200)}` : ""}`);
      e.status = res.status;
      e.body = parsed;
      throw e;
    }
    return parsed;
  }

  return {
    /**
     * The configuration one execution was accepted with.
     *
     * **THE TENANT IS IN THE FILTER even though the claim already proved this worker
     * holds the row.** It costs nothing and it means a run id that somehow named
     * another account's execution reads as absent rather than as work — the second
     * wall this schema puts behind every one of its first ones.
     *
     * `null` for a row that is not there, which the caller reads as a run with no
     * execution record rather than as an empty workflow — those are opposite facts.
     */
    async read(runId, tenant) {
      if (!isText(runId)) throw new TypeError("read: runId must be a non-empty string");
      if (!isText(tenant)) throw new TypeError("read: tenant must be a non-empty string, from the claim");
      const rows = await call("GET",
        `automation_runs?id=eq.${encodeURIComponent(runId)}&tenant_id=eq.${encodeURIComponent(tenant)}`
        + `&select=id,automation_id,agent_id,tenant_id,trigger,occurrence,steps,zone,finished_at`
        + `,position,vars,input,memory,waiting,wait_until,decisions,outcomes,created_at&limit=1`,
        undefined, false);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      return {
        runId: row.id,
        automationId: row.automation_id,
        // NULL FOR AN EXECUTION ACCEPTED BEFORE THE KNOWLEDGE STEP EXISTED, and the
        // executor reads that as "no material to search" rather than searching whatever
        // it can find.
        agentId: isText(row.agent_id) ? row.agent_id : null,
        tenant: row.tenant_id,
        trigger: row.trigger,
        occurrence: row.occurrence ?? null,
        // REFUSED RATHER THAN COERCED, and `[]` is a real workflow. A `steps` that is
        // not a list is a row this process cannot execute, and running it as empty
        // would report a workflow nobody wrote as having succeeded.
        steps: Array.isArray(row.steps) ? row.steps : null,
        zone: isText(row.zone) ? row.zone : null,
        finishedAt: row.finished_at ?? null,

        // ── how far it has got, and what it holds ─────────────────────────────
        // **EVERY ONE OF THESE FAILS CLOSED TOWARDS STARTING AGAIN FROM THE TOP, and for
        // today's steps that is the safe direction** — nothing this product runs reaches
        // outside the database, so a repeated step costs a recomputation. The day a step
        // sends an email that stops being true, and the honest place to change it is here:
        // an unreadable position would have to refuse the execution rather than reset it.
        position: Number.isInteger(row.position) && row.position > 0 ? row.position : 0,
        values: plainObject(row.vars),
        input: plainObject(row.input),
        memory: plainObject(row.memory),
        decisions: plainObject(row.decisions),
        outcomes: Array.isArray(row.outcomes) ? row.outcomes : [],
        // `waiting` AND `wait_until` ARE READ AS A PAIR because the database stores them as
        // one: a pause with no deadline is a row the constraint refuses, so a half-read here
        // would be this process inventing a state the schema forbids.
        waiting: plainObject(row.waiting, null),
        waitUntil: msOf(row.wait_until),
        startedAt: msOf(row.created_at),
      };
    },

    /**
     * The outcomes and the stop, in one transaction, through the fence.
     *
     * Answers exactly what `agent.append_entry` answered — `{ok, stored|already, seq}`
     * or `{ok: false, why}` — because the caller's whole job is reading that the right
     * way round: a refusal means the claim is gone and this worker must write nothing
     * more, not that the journal is broken.
     */
    async finish({ runId, worker, token, outcomes, stop, position, values }) {
      const answer = await call("POST", "rpc/finish_automation_run", {
        p_run_id: runId, p_worker: worker, p_token: token,
        p_outcomes: outcomes, p_stop: stop,
        p_position: Number.isInteger(position) && position >= 0 ? position : 0,
        p_vars: values && typeof values === "object" ? values : {},
      }, true);
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("finish_automation_run: no answer came back");
      }
      return answer;
    },

    /**
     * One step done — its journal entry and the execution's progress, in one transaction.
     *
     * Answers what `agent.advance_automation_run` answered, which is `append_entry`'s own
     * shape plus `advanced`. **The caller's whole job is reading a refusal the right way
     * round**: `ok: false` means the claim is gone and this worker must write nothing more,
     * and `advanced: false` with `ok: true` means the progress was already recorded — a
     * retry, and safe.
     */
    async advance({ runId, worker, token, entry, position, values, outcomes, waiting }) {
      const answer = await call("POST", "rpc/advance_automation_run", {
        p_run_id: runId, p_worker: worker, p_token: token,
        p_entry: entry, p_position: position,
        p_vars: values && typeof values === "object" ? values : {},
        p_outcomes: outcomes,
        p_waiting: waiting ?? null,
      }, true);
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("advance_automation_run: no answer came back");
      }
      return answer;
    },

    /**
     * Search one agent's reference material.
     *
     * **THIS IS THE ONE IMPLEMENTATION OF THE RETRIEVAL CONTRACT, not the contract.** The
     * executor takes `retrieve` as an injected function and never knows this exists, so
     * replacing keyword search with something else is one function — which is what "a
     * replaceable interface" amounts to in practice rather than in a comment.
     *
     * **NOTHING IT ANSWERS IS EVER READ AS CONFIGURATION.** The excerpts are bound to a
     * name and substituted into text; no reader of `vars` looks at a tool, a bound, a step
     * or a schedule, and an automation execution has no tool surface at all.
     */
    async search({ tenant, agentId, query, limit }) {
      if (!isText(tenant)) throw new TypeError("search: tenant must be a non-empty string, from the claim");
      if (!isText(agentId)) return { excerpts: [] };
      const rows = await call("POST", "rpc/search_knowledge", {
        p_tenant: tenant, p_agent_id: agentId, p_query: query,
        p_limit: Number.isInteger(limit) && limit > 0 ? limit : 5,
      }, true);
      const list = Array.isArray(rows) ? rows : [];
      return {
        excerpts: list.map((e) => ({
          id: e?.id ?? null,
          title: isText(e?.title) ? e.title : "(untitled)",
          version: Number.isInteger(e?.version) ? e.version : null,
          text: typeof e?.text === "string" ? e.text : "",
        })),
      };
    },

    /**
     * Put every suspended execution whose time has come back on the queue.
     *
     * Answers one object per execution touched. **THE CALLER RINGS ONLY THE ONES IT SAYS
     * ARE `queued`** — an execution somebody is already holding answers `running`, and a
     * doorbell for that is a delivery `claim_run` will refuse.
     */
    async resumeDue({ limit } = {}) {
      const rows = await call("POST", "rpc/resume_due_automations", { p_limit: limit }, true);
      return Array.isArray(rows) ? rows : [];
    },

    /**
     * File everything the schedule says is due, and advance past it.
     *
     * Answers one object per automation touched. **THE CALLER'S ONLY JOB AFTERWARDS IS
     * TO RING THE DOORBELL for each `run_id` it names** — the row is already committed,
     * so a failed ring costs latency and never work.
     */
    async tick({ catchupS, limit } = {}) {
      const rows = await call("POST", "rpc/tick_automations", {
        p_catchup_s: catchupS, p_limit: limit,
      }, true);
      return Array.isArray(rows) ? rows : [];
    },
  };
}
