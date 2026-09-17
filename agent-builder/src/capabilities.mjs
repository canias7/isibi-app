/**
 * WHAT AN AGENT CAN DO — the real backend operations, behind two closures.
 *
 * **THE MILESTONE IS "USING THE SAME UNDERLYING OPERATIONS AS THE FRONTEND", and the
 * shared thing is the DATABASE rather than a JavaScript module.** The site builder and
 * this engine are separate Workers and neither may import the other (`worker.js`'s module
 * graph is a container image input), so every function called here is one the customer's
 * own screen calls: `agent.list_knowledge`, `agent.save_memory`, `agent.create_automation`
 * and the rest, defined once in `20260918000000_agent_capability_operations.sql` and in
 * the migrations before it. A canned answer is not one of the options — there is nothing
 * here but a request to a database function.
 *
 * ── ⚠ THE TENANT AND THE AGENT ARE CLOSURES, NEVER ARGUMENTS ──────────────────
 *
 * `makeCapabilities(...).forTenant(t).forAgent(a)` hands back the operations, and **not
 * one of them takes a tenant or an agent id.** That is the whole boundary: a model
 * writes tool arguments, so an operation with a tenant parameter is an operation a model
 * can point at somebody else's account — and here there is nowhere to put one. It is the
 * shape `store.mjs` already uses for runs, for the same reason, and it is asserted as a
 * CENSUS over the real surface rather than promised in a comment.
 *
 * **THE OBLIGATION THIS MODULE CANNOT CHECK FOR ITS CALLER**: the tenant handed to
 * `forTenant` must come from a verified claim, and the agent handed to `forAgent` from
 * the run's own journal snapshot. Both are read from the log by the runner, which got
 * them from `claim_run` and from an entry nobody can edit.
 *
 * ── AND THE AGENT SCOPE IS ENFORCED HERE, WHICH IS DECLARED RATHER THAN IMPLIED ──
 *
 * Some of these functions are scoped to the ACCOUNT because the screen wants them that
 * way — a person looking at their own automations is entitled to all of them. An agent is
 * not: agent A must not read agent B's automation because they share an owner. So the
 * reads that answer a row carrying an `agent` field are checked against this closure's
 * agent and answer `null` otherwise. **It is a second wall and not the same one**: the
 * database's tenant filter stops another ACCOUNT, and this stops another AGENT of the
 * same account, which no tenant filter can see.
 */

const isText = (v) => typeof v === "string" && v.trim() !== "";

/** A uuid, refused rather than coerced — `String(["…"])` is `"…"`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v) => typeof v === "string" && UUID.test(v);

/**
 * Every operation this module offers, as NAMES, so a census can walk the surface
 * without knowing what any of them does. Derived from nothing — it is the list, and
 * `forAgent` is built from it, so an operation added without a name here is not
 * reachable at all.
 */
export const CAPABILITIES = Object.freeze([
  "searchKnowledge", "listKnowledge", "readKnowledge",
  "listMemory", "saveMemory", "deleteMemory",
  "listAutomations", "readAutomation", "createAutomation", "updateAutomation",
  "setAutomationEnabled", "startAutomation",
  "listExecutions", "readExecution",
]);

/**
 * The database function each one calls, declared so a census can read it.
 *
 * ⚠ **IT IS THE MAP THE SITE'S OWN ROUTES USE TOO**, which is what makes "the same
 * underlying operation" a fact rather than a claim: `test/agent-send.test.mjs` — the one
 * file that may load both products — compares this against the site's and requires the
 * two to name the same functions.
 */
export const CAPABILITY_RPC = Object.freeze({
  searchKnowledge: "search_knowledge",
  listKnowledge: "list_knowledge",
  readKnowledge: "read_knowledge",
  listMemory: "list_memory",
  saveMemory: "save_memory",
  deleteMemory: "delete_memory",
  listAutomations: "list_automations",
  readAutomation: "read_automation",
  createAutomation: "create_automation",
  updateAutomation: "update_automation",
  setAutomationEnabled: "set_automation_enabled",
  startAutomation: "accept_automation_run",
  listExecutions: "list_executions",
  readExecution: "read_execution",
});

/**
 * WHICH OF THEM CHANGE SOMETHING, declared beside the list rather than inferred from a
 * name — `setAutomationEnabled` and `startAutomation` both read as writes and `readExecution`
 * does not, but a rule built on the words `save`/`set`/`start`/`create`/`delete` is a rule
 * the next operation's name breaks in silence.
 *
 * ⚠ IT IS WHAT MAKES `writes` ON A TOOL A CENSUS RATHER THAN A PROMISE.
 * `test/capabilities.test.mjs` drives every tool against a RECORDING capability seam and
 * requires `writes === true` exactly when the tool touched one of these — so a write tool
 * that forgot the flag, and a read tool that carries it, are both red. Neither list is
 * derived from the other and both are asserted total against `CAPABILITIES`, so an
 * operation added to one and not the other fails by existing.
 */
export const CAPABILITY_WRITES = Object.freeze([
  "saveMemory", "deleteMemory",
  "createAutomation", "updateAutomation", "setAutomationEnabled", "startAutomation",
]);

/**
 * The caps this side passes in. **They are the PRODUCT's numbers and the database takes
 * them as arguments**, exactly as `create_automation`'s `p_max` already does — so the
 * shape lives in the schema (the columns' own checks) and the count lives with the
 * product, and a census compares these against the site's.
 */
export const CAP_MEMORIES = 100;
export const CAP_AUTOMATIONS = 20;

export function makeCapabilities(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeCapabilities: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeCapabilities: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeCapabilities: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";

  // The profile header names the RELATION and differs by DIRECTION: `content-profile`
  // for anything that writes, `accept-profile` for a read. PostgREST ignores the read
  // header on a write — which is how a DELETE in the other product once resolved against
  // `public` and could never have worked.
  const headers = (write) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    [write ? "content-profile" : "accept-profile"]: schema,
  });

  async function rpc(name, body, write) {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST", headers: headers(write), body: JSON.stringify(body),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    if (!res.ok) {
      const e = new Error(`${name}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : ""}`);
      e.status = res.status;
      throw e;
    }
    return parsed;
  }

  const list = (v) => (Array.isArray(v) ? v : []);

  return {
    forTenant(tenant) {
      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string");
      return {
        forAgent(agentId) {
          if (!isId(agentId)) throw new TypeError("forAgent: agent must be a uuid");

          /**
           * ⚠ THE SECOND WALL, and it is the one the database cannot put up. These
           * functions are scoped to the ACCOUNT because a person is entitled to their
           * whole account; an agent is entitled to ITS OWN. So a row that names an agent
           * is checked against this closure's, and one belonging to a sibling agent
           * answers `null` — the same answer a row that does not exist gives, because
           * telling them apart is telling a caller that another agent's id is real.
           */
          const mine = (row) => {
            if (row === null || typeof row !== "object") return null;
            const owner = row.agent ?? row.agent_id ?? null;
            return owner === agentId ? row : null;
          };

          return Object.freeze({
            // ── reference material ──────────────────────────────────────────
            async searchKnowledge({ query, limit } = {}) {
              return list(await rpc(CAPABILITY_RPC.searchKnowledge, {
                p_tenant: tenant, p_agent_id: agentId, p_query: query ?? "", p_limit: limit ?? 5,
              }));
            },
            async listKnowledge() {
              return list(await rpc(CAPABILITY_RPC.listKnowledge, { p_tenant: tenant, p_agent_id: agentId }));
            },
            async readKnowledge({ id } = {}) {
              if (!isId(id)) return null;
              return mine(await rpc(CAPABILITY_RPC.readKnowledge, { p_tenant: tenant, p_source_id: id }));
            },

            // ── memory ──────────────────────────────────────────────────────
            async listMemory() {
              return list(await rpc(CAPABILITY_RPC.listMemory, { p_tenant: tenant, p_agent_id: agentId }));
            },
            async saveMemory({ name, value, source, id } = {}) {
              return rpc(CAPABILITY_RPC.saveMemory, {
                p_tenant: tenant, p_agent_id: agentId, p_key: name ?? "", p_value: value ?? "",
                p_id: isId(id) ? id : null, p_source: source ?? "person", p_max: CAP_MEMORIES,
              }, true);
            },
            async deleteMemory({ name } = {}) {
              return rpc(CAPABILITY_RPC.deleteMemory, {
                p_tenant: tenant, p_agent_id: agentId, p_key: name ?? "",
              }, true);
            },

            // ── automations ─────────────────────────────────────────────────
            async listAutomations() {
              return list(await rpc(CAPABILITY_RPC.listAutomations, { p_tenant: tenant, p_agent_id: agentId }));
            },
            async readAutomation({ id } = {}) {
              if (!isId(id)) return null;
              return mine(await rpc(CAPABILITY_RPC.readAutomation, { p_tenant: tenant, p_id: id }));
            },
            async createAutomation({ id, name, enabled, schedule, atLocal, zone, steps, inputs } = {}) {
              return rpc(CAPABILITY_RPC.createAutomation, {
                p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name ?? "",
                p_enabled: enabled !== false, p_schedule: schedule ?? "manual",
                p_at_local: atLocal ?? null, p_zone: zone ?? null,
                p_steps: steps ?? [], p_max: CAP_AUTOMATIONS, p_inputs: inputs ?? [],
              }, true);
            },
            async updateAutomation({ id, name, enabled, schedule, atLocal, zone, steps, inputs } = {}) {
              return rpc(CAPABILITY_RPC.updateAutomation, {
                p_tenant: tenant, p_id: id, p_name: name ?? "", p_enabled: enabled !== false,
                p_schedule: schedule ?? "manual", p_at_local: atLocal ?? null, p_zone: zone ?? null,
                p_steps: steps ?? [], p_inputs: inputs ?? [],
              }, true);
            },
            async setAutomationEnabled({ id, enabled } = {}) {
              // ⚠ REFUSED, NEVER COERCED. `Boolean("false")` is `true`, and a model
              // writing `"false"` into a tool argument is exactly the input that would
              // turn an automation ON while the sentence says it was turned off.
              if (typeof enabled !== "boolean") return { ok: false, error: "bad-enabled" };
              if (!(await this.readAutomation({ id }))) return { ok: false, error: "no-automation" };
              return rpc(CAPABILITY_RPC.setAutomationEnabled, {
                p_tenant: tenant, p_id: id, p_enabled: enabled,
              }, true);
            },
            async startAutomation({ id, runId, input } = {}) {
              if (!(await this.readAutomation({ id }))) return { ok: false, error: "no-automation" };
              return rpc(CAPABILITY_RPC.startAutomation, {
                p_tenant: tenant, p_automation_id: id, p_run_id: runId,
                p_trigger: "manual", p_occurrence: null, p_input: input ?? {},
              }, true);
            },

            // ── what an execution did ───────────────────────────────────────
            async listExecutions({ automation, limit } = {}) {
              if (!(await this.readAutomation({ id: automation }))) return [];
              return list(await rpc(CAPABILITY_RPC.listExecutions, {
                p_tenant: tenant, p_automation_id: automation, p_limit: limit ?? 10,
              }));
            },
            async readExecution({ id } = {}) {
              if (!isId(id)) return null;
              const row = await rpc(CAPABILITY_RPC.readExecution, { p_tenant: tenant, p_id: id });
              if (row === null || typeof row !== "object") return null;
              // AN EXECUTION NAMES ITS AUTOMATION, NOT ITS AGENT, so the agent scope is
              // asked of the automation it belongs to — one hop, and the same wall.
              return (await this.readAutomation({ id: row.automation })) ? row : null;
            },
          });
        },
      };
    },
  };
}
