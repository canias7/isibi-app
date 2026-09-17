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
        + `&select=id,automation_id,tenant_id,trigger,occurrence,steps,zone,finished_at&limit=1`,
        undefined, false);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      return {
        runId: row.id,
        automationId: row.automation_id,
        tenant: row.tenant_id,
        trigger: row.trigger,
        occurrence: row.occurrence ?? null,
        // REFUSED RATHER THAN COERCED, and `[]` is a real workflow. A `steps` that is
        // not a list is a row this process cannot execute, and running it as empty
        // would report a workflow nobody wrote as having succeeded.
        steps: Array.isArray(row.steps) ? row.steps : null,
        zone: isText(row.zone) ? row.zone : null,
        finishedAt: row.finished_at ?? null,
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
    async finish({ runId, worker, token, outcomes, stop }) {
      const answer = await call("POST", "rpc/finish_automation_run", {
        p_run_id: runId, p_worker: worker, p_token: token,
        p_outcomes: outcomes, p_stop: stop,
      }, true);
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new Error("finish_automation_run: no answer came back");
      }
      return answer;
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
