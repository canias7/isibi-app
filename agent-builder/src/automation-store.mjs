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
import { profileFor } from "./rest-profile.mjs";
import { readSearch } from "./knowledge-search.mjs";


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

  // ⚠ THE PROFILE COMES FROM THE METHOD, THROUGH `rest-profile.mjs`. This store was right
  // in effect and wrong in reasoning: every one of its POST RPCs passed `write: true`,
  // `search_knowledge` — a read function — included, so the flag was carrying the METHOD
  // under a name that describes the function. The next read RPC added here would have been
  // written `false` and broken, which is what happened to `capabilities.mjs`.
  const headers = (method) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    ...profileFor(method, schema),
  });

  async function call(method, path, body) {
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method, headers: headers(method),
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
        + `,position,vars,input,memory,waiting,wait_until,decisions,outcomes,created_at`
        + `,loops,tries,heard&limit=1`,
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
        /**
         * WHAT THIS EXECUTION HAS ALREADY HEARD, keyed by the step that was waiting.
         *
         * **`{}` IS THE RIGHT FALLBACK AND `null` WOULD NOT BE**: an execution that has heard
         * nothing has heard nothing, and the executor reads a missing key as a RE-PAUSE. A
         * row from before this column exists reads the same way, which is what every
         * execution accepted before an event wait existed really is.
         */
        heard: plainObject(row.heard),
        outcomes: Array.isArray(row.outcomes) ? row.outcomes : [],
        // `waiting` AND `wait_until` ARE READ AS A PAIR because the database stores them as
        // one: a pause with no deadline is a row the constraint refuses, so a half-read here
        // would be this process inventing a state the schema forbids.
        waiting: plainObject(row.waiting, null),
        waitUntil: msOf(row.wait_until),
        // ⚠ **WHICH ROUND EVERY OPEN LOOP IS ON, AND HOW MANY TIMES EACH STEP HAS FAILED.**
        // Both are read back for the same reason the position is: a counter that lives only
        // in the process gives every delivery a fresh one — a restart that re-enters a loop
        // body at a round it has already done, and a retry budget that starts again.
        //
        // **`uses` IS DELIBERATELY NOT READ.** It is what was copied in and is written for
        // provenance; nothing in the executor consults it, and a field read with no reader
        // is this repository's own most-recorded defect wearing a completeness argument.
        loops: plainObject(row.loops),
        tries: plainObject(row.tries),
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
      });
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
     * and `advanced: false` with `ok: true` means the ROW DID NOT MOVE — it already holds at
     * least as many outcomes as were offered. ⚠ **That is not the same as "safe".** It is the
     * ordinary answer to a redelivery replaying recorded work, and it is also exactly what a
     * disagreement looks like, so the runner LOGS it rather than reading it as a success: a
     * loop whose every round after the first came back this way is what the reading cost.
     */
    async advance({ runId, worker, token, entry, position, values, outcomes, waiting, loops, tries }) {
      const answer = await call("POST", "rpc/advance_automation_run", {
        p_run_id: runId, p_worker: worker, p_token: token,
        p_entry: entry, p_position: position,
        p_vars: values && typeof values === "object" ? values : {},
        p_outcomes: outcomes,
        p_waiting: waiting ?? null,
        // ⚠ **ON THE SAME CALL AS THE POSITION, so the three can never be persisted apart.**
        // A position saved without its loop state re-enters a body at a round already done,
        // and one saved without its attempt counts gives every delivery a fresh retry
        // budget. The function REFUSES a null, so a caller that did not say is a loud
        // refusal rather than a row quietly told a loop is at its beginning.
        p_loops: plainObject(loops),
        p_tries: plainObject(tries),
      });
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("advance_automation_run: no answer came back");
      }
      return answer;
    },

    /**
     * Every automation of ONE agent, as the steps and version a parent would copy in.
     *
     * **THE SCOPE IS THE WALL AND IT IS THE QUERY'S, NOT THE EXPANSION'S.**
     * `expandWorkflow` knows nothing about a tenant or an agent — what it is handed is
     * data — so "not one of this agent's" and "not there at all" are ONE answer, decided
     * here. Both agents of one owner share a tenant, so the agent id is the only thing
     * that tells them apart, and a tenant filter alone would let one agent run another's
     * workflow.
     */
    async children({ tenant, agentId }) {
      if (!isText(tenant)) throw new TypeError("children: tenant must be a non-empty string, from the claim");
      if (!isText(agentId)) throw new TypeError("children: agentId must be a non-empty string");
      const answer = await call("POST", "rpc/automation_children", {
        p_tenant: tenant, p_agent_id: agentId,
      });
      // REFUSED RATHER THAN COERCED. An answer that is not a list is a read this process
      // cannot understand, and reading it as "this agent has no other automations" would
      // turn an outage into a workflow refused for naming an automation that is really
      // there — the wrong sentence, about the wrong layer.
      if (!Array.isArray(answer)) throw new Error("automation_children: the answer is not a list");
      return answer;
    },

    /**
     * EMIT ONE EVENT.
     *
     * **THE DEPTH IS THE DATABASE'S, TAKEN FROM THE EMITTING RUN.** `p_from_run` is what
     * makes a chain bounded: the function reads that run's own depth and refuses past
     * `MAX_EVENT_DEPTH` by name, so a loop of agents ringing each other stops at a stated
     * number rather than at whatever the platform runs out of first. A caller cannot widen
     * it — the ceiling is the function's own argument default and the runner never sends one.
     */
    async emit({ tenant, agentId, id, name, payload, source, key, fromRun }) {
      if (!isText(tenant)) throw new TypeError("emit: tenant must be a non-empty string");
      if (!isText(id)) throw new TypeError("emit: id must be a non-empty string");
      if (!isText(name)) throw new TypeError("emit: name must be a non-empty string");
      const answer = await call("POST", "rpc/emit_event", {
        p_tenant: tenant, p_agent_id: agentId ?? null, p_id: id, p_name: name,
        p_payload: plainObject(payload), p_source: isText(source) ? source : "person",
        p_key: isText(key) ? key : null, p_from_run: isText(fromRun) ? fromRun : null,
      });
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("emit_event: no answer came back");
      }
      return answer;
    },

    /**
     * FILE WHAT EVERY UNDISPATCHED EVENT TRIGGERS, AND WAKE WHAT WAITED FOR IT.
     *
     * **A PLATFORM SWEEP, SO IT TAKES NO TENANT — and that is not a hole in the closure
     * rule.** The rule is that no OPERATION an agent's tools can reach takes a tenant as an
     * argument; this is reachable only from `worker.scheduled`, exactly as `reclaimable` and
     * the scheduler's own tick are, and it is scoped per EVENT by the row it is reading.
     */
    async dispatchEvents({ limit = 25 } = {}) {
      const rows = await call("POST", "rpc/dispatch_events", { p_limit: limit });
      // REFUSED RATHER THAN COERCED, for `children`'s own reason: reading an unreadable
      // answer as "nothing happened" turns an outage into a platform that quietly stopped
      // delivering events, which is the one failure nobody would notice.
      if (!Array.isArray(rows)) throw new Error("dispatch_events: the answer is not a list");
      return rows;
    },

    /**
     * THE OTHER HALF OF THE ARRIVAL RACE.
     *
     * ⚠ **AN EVENT CAN ARRIVE IN THE INSTANT BETWEEN A WORKFLOW DECIDING TO WAIT AND THE ROW
     * SAYING SO, and neither side alone can close that.** `agent.dispatch_events` wakes what
     * is ALREADY waiting; this asks, for a run that is waiting NOW, whether an event it wants
     * arrived while it was not yet visible. Both take the row lock, so one of them sees the
     * other's write — and `heard ? step` is what stops the same event being applied twice.
     */
    async hearPendingEvent({ runId, tenant }) {
      if (!isText(runId)) throw new TypeError("hearPendingEvent: runId must be a non-empty string");
      if (!isText(tenant)) throw new TypeError("hearPendingEvent: tenant must be a non-empty string, from the claim");
      const answer = await call("POST", "rpc/hear_pending_event", {
        p_run_id: runId, p_tenant: tenant,
      });
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("hear_pending_event: no answer came back");
      }
      return answer;
    },

    /**
     * THE ONE READER OF AN ENDPOINT'S SECRET, and it exists only to be handed to
     * `verifyDelivery`.
     *
     * **IT TAKES NO TENANT BECAUSE A DELIVERY HAS NOBODY TO TAKE ONE FROM.** That is the
     * whole point of the row: the account is what this ANSWERS, so asking for it would be
     * asking the sender who they are. `agent.webhook_for_delivery` is `service_role`-only and
     * is the only function in the schema that returns the secret at all.
     */
    async webhookForDelivery(id) {
      if (!isText(id)) return null;
      const answer = await call("POST", "rpc/webhook_for_delivery", { p_id: id });
      /**
       * ⚠ **ITS ANSWER IS THE ROW OR `null`, WITH NO `ok` AND NO `enabled` — and the first
       * draft of this reader asked for both.** It read `answer.ok !== true` and would have
       * returned `null` for every endpoint that exists, so EVERY delivery on the platform
       * would have been refused `no-endpoint` with the whole chain correct: the wiring layer,
       * caught by reading the function against the caller rather than by a test.
       *
       * `enabled` is `true` by CONSTRUCTION here: the function's own `where enabled` means a
       * row coming back is an enabled row. `verifyDelivery` checks it anyway and the
       * redundancy is declared — that check is what keeps that module drivable and true on
       * its own terms, rather than resting on a clause in another language.
       */
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
      if (!isText(answer.secret) || !isText(answer.tenant_id)) return null;
      return {
        id: answer.id, tenantId: answer.tenant_id, agentId: answer.agent_id,
        event: answer.event_name, secret: answer.secret, enabled: true,
      };
    },

    /**
     * The flattened plan, written once, before the first step.
     *
     * Answers `{ok, set, steps}` or a fenced refusal under its own name. **`set: false` is
     * NOT an error**: a redelivery whose first attempt already expanded finds the plan
     * written and the position moved, which is the ordinary case rather than a fault.
     */
    async setPlan({ runId, worker, token, steps, uses }) {
      /**
       * ⚠ **REFUSED, NOT COERCED — and the coercion this replaces was the worst one in this
       * file.** It read `Array.isArray(steps) ? steps : []`, so a non-list became an EMPTY
       * PLAN: the execution's steps replaced with nothing, running zero steps and reporting
       * `done`. And `agent.set_automation_plan` RAISES on a non-array by its own first line
       * (`the flattened steps must be a list`), so the coercion's only effect was to turn a
       * refusal the database was already making into something it would happily accept. *A
       * coercion in front of a wall is not a belt; it is what stops the wall being reached.*
       *
       * The database's raise stays as the SECOND wall and the redundancy is declared: this
       * one names the caller's own mistake here, rather than arriving several layers away as
       * a Postgres exception about a plan nobody can see.
       */
      if (!Array.isArray(steps)) throw new TypeError("setPlan: the flattened steps must be a list");
      if (!Array.isArray(uses)) throw new TypeError("setPlan: what was copied in must be a list");
      const answer = await call("POST", "rpc/set_automation_plan", {
        p_run_id: runId, p_worker: worker, p_token: token,
        p_steps: steps,
        p_uses: uses,
      });
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("set_automation_plan: no answer came back");
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
      // NO AGENT TO SEARCH IS THE SAME SHAPE AS EVERY OTHER ANSWER, both flags unread — so it
      // reads `unknown` downstream rather than "none of your documents matched". The runner
      // refuses this case by name before it gets here, so this is a belt; a belt that answered
      // a narrower shape than the main path is one every reader has to special-case.
      if (!isText(agentId)) return { searched: null, sources: null, excerpts: [] };
      const answer = await call("POST", "rpc/search_knowledge", {
        p_tenant: tenant, p_agent_id: agentId, p_query: query,
        p_limit: Number.isInteger(limit) && limit > 0 ? limit : 5,
      });
      /**
       * ⚠ **THE ANSWER IS READ BY THE SHARED READER, NOT BY A SECOND READING OF IT.** This
       * built its own excerpt list from rows for as long as the function answered a set, and
       * `capabilities.mjs` built another beside it — so "there was nothing to search for",
       * "this agent has no reference material" and "it has some and none matched" arrived
       * here as one empty list and nothing downstream could tell them apart.
       *
       * **`searched` AND `sources` TRAVEL ON, AND THAT IS THE POINT OF FORWARDING THEM.** The
       * executor's step is what turns them into the sentence a person reads in an execution's
       * history, and a seam that dropped them would make the three nothings one again one
       * layer further in.
       */
      const read = readSearch(answer);
      return {
        searched: read.searched,
        sources: read.sources,
        excerpts: read.excerpts.map((e) => ({
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
      const rows = await call("POST", "rpc/resume_due_automations", { p_limit: limit });
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
      });
      return Array.isArray(rows) ? rows : [];
    },
  };
}
