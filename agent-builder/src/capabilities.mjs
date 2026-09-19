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

import { profileFor } from "./rest-profile.mjs";
// ⚠ `approvals.mjs` IS THE IDENTITY MODULE: it builds `<run>:<step>:<index>:<hash>` and
// `splitOperation` is the one reader that takes it apart. Parsing it here would be a second
// copy of a format, and the copy that drifts is the one deciding whether a retry is a retry.
import { splitOperation } from "./approvals.mjs";

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
  "patchAutomation",
  "setAutomationEnabled", "startAutomation",
  "listExecutions", "readExecution", "cancelExecution",
  // ⚠ **A READ OF THE AGENT'S OWN SETTINGS, AND IT IS DELIBERATELY NOT A TOOL.** It exists
  // because a daily schedule needs a time zone and a zone is not a model's to choose; the
  // authoring tools ask this and then either use what a person set or ASK for it. Narrow by
  // construction — see `agent.read_agent_settings`, which answers the zone and nothing else.
  "readAgentSettings",
  // ⚠ **A READ OF THIS ACCOUNT'S OWN OPERATION RECORD, and the one thing it exists for
  // is a refusal that must not be reached.** A tool that validates against CURRENT STATE
  // before writing can refuse a RETRY of work the record already holds — the edit landed,
  // the answer was lost, and the second attempt sees a row that already matches and says
  // "that named no change". So a tool asks this before deciding a fresh write is needed.
  // **A READ, and not a write's door**: it takes no outcome and cannot record one, so the
  // only thing on this surface that can write a record is still the `_once` wrapper.
  "checkOperation",
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
  patchAutomation: "patch_automation",
  setAutomationEnabled: "set_automation_enabled",
  startAutomation: "accept_automation_run",
  listExecutions: "list_executions",
  readExecution: "read_execution",
  cancelExecution: "cancel_run",
  readAgentSettings: "read_agent_settings",
  checkOperation: "operation_check",
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
  "createAutomation", "updateAutomation", "patchAutomation",
  "setAutomationEnabled", "startAutomation", "cancelExecution",
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

  // ⚠ **THE PROFILE COMES FROM THE METHOD, THROUGH `rest-profile.mjs`, AND THIS FILE IS
  // WHY THAT MODULE EXISTS.** It chose by whether the FUNCTION writes, and every PostgREST
  // RPC is a POST — so a read RPC named its schema in a header PostgREST only honours on a
  // GET. MEASURED before the fix: **10 of these 14 operations sent `accept-profile` on a
  // POST**, among them the `read_automation` pre-check `pause_automation` and
  // `run_automation` each make first, so on a real PostgREST both would have failed at
  // their own first step. No call site passed the flag at all, which is why the four that
  // were right were right by having been written differently rather than by the rule.
  const headers = (method) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    ...profileFor(method, schema),
  });

  // ⚠ ONE METHOD, NAMED ONCE. `rpc` had a third parameter for the header and nothing to
  // pass it; the method is the only thing that decides, and it is written here.
  const RPC_METHOD = "POST";

  async function rpc(name, body) {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: RPC_METHOD, headers: headers(RPC_METHOD), body: JSON.stringify(body),
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

  /**
   * ⚠ EVERY WRITE GOES THROUGH ITS OPERATION RECORD, AND THERE IS NO WAY ROUND IT.
   *
   * The six mutating functions each have a `_once` wrapper in the database that claims the
   * operation, does the work through the UNCHANGED function, and records the outcome — one
   * transaction, so the work and the record commit together or neither does. This is the one
   * place that decides, because six call sites deciding is how the profile header came to be
   * wrong on ten of fourteen operations.
   *
   * **AN IDENTITY IS REQUIRED, AND A MISSING ONE IS A REFUSAL RATHER THAN THE OLD PATH.**
   * Falling through to the plain function would make the protection something a caller can
   * forget, which is the fail-OPEN direction — and the defect this closes is a retry
   * overwriting somebody's correction, which is not a thing to leave to a caller's care.
   * An unreadable identity is its own refusal for the same reason: a key invented from a
   * malformed one collides with something.
   *
   * The plain functions stay exactly as they were, and the site's own routes still call them
   * — a PERSON pressing a button twice is a different question with a different answer, and
   * `send_to_agent`'s own key is where that one is settled.
   */
  async function mutate(op, operation, body) {
    const id = splitOperation(operation);
    if (!id) {
      return { ok: false, error: operation === undefined || operation === null
        ? "operation-required" : "operation-unreadable" };
    }
    return rpc(`${CAPABILITY_RPC[op]}_once`, {
      p_op_key: id.key, p_args_hash: id.hash, p_op_run: id.run, ...body,
    });
  }

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
            async saveMemory({ name, value, source, id, operation } = {}) {
              return mutate("saveMemory", operation, {
                p_tenant: tenant, p_agent_id: agentId, p_key: name ?? "", p_value: value ?? "",
                p_id: isId(id) ? id : null, p_source: source ?? "person", p_max: CAP_MEMORIES,
              });
            },
            async deleteMemory({ name, operation } = {}) {
              return mutate("deleteMemory", operation, {
                p_tenant: tenant, p_agent_id: agentId, p_key: name ?? "",
              });
            },

            // ── automations ─────────────────────────────────────────────────
            async listAutomations() {
              return list(await rpc(CAPABILITY_RPC.listAutomations, { p_tenant: tenant, p_agent_id: agentId }));
            },
            async readAutomation({ id } = {}) {
              if (!isId(id)) return null;
              return mine(await rpc(CAPABILITY_RPC.readAutomation, { p_tenant: tenant, p_id: id }));
            },
            async createAutomation({ id, name, enabled, schedule, atLocal, zone, steps, inputs,
                                     days, onDate, onEvent, operation } = {}) {
              return mutate("createAutomation", operation, {
                p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name ?? "",
                p_enabled: enabled !== false, p_schedule: schedule ?? "manual",
                p_at_local: atLocal ?? null, p_zone: zone ?? null,
                p_steps: steps ?? [], p_max: CAP_AUTOMATIONS, p_inputs: inputs ?? [],
                // ⚠ **THE THREE TRIGGER FIELDS, and a create had to gain them or a weekly
                // schedule was a schedule this store could not send.** They go in the shared
                // shape rather than on one path, which is the site's own rule one product over:
                // a create and an edit carrying different trigger fields is how a screen comes
                // to save a weekly schedule that stores no days.
                p_days: Array.isArray(days) ? days : [],
                p_on_date: onDate ?? null, p_on_event: onEvent ?? null,
              });
            },
            async updateAutomation({ id, name, enabled, schedule, atLocal, zone, steps, inputs, operation } = {}) {
              return mutate("updateAutomation", operation, {
                p_tenant: tenant, p_id: id, p_name: name ?? "", p_enabled: enabled !== false,
                p_schedule: schedule ?? "manual", p_at_local: atLocal ?? null, p_zone: zone ?? null,
                p_steps: steps ?? [], p_inputs: inputs ?? [],
              });
            },
            /**
             * ⚠ **CHANGE ONLY WHAT THE CALL NAMES, and the difference from `updateAutomation`
             * is the whole point rather than a variation on it.**
             *
             * That one is a WHOLE REPLACE and is right to be: a person's form shows every
             * field and sends every field, so what it saves is what it shows. A TOOL is the
             * opposite — a model names the one thing it was asked to change — and running an
             * edit like that through the replace is what reactivated a disabled automation
             * and deleted its schedule, its zone and its input declarations on a call that
             * asked for a new name. **Measured before it was fixed**, through the real tool
             * against a real PostgreSQL.
             *
             * **THE PATCH ARRIVES WHOLE AND IS NOT ASSEMBLED HERE.** Presence of a key is
             * what "this call is about that field" means, so building the object from named
             * parameters with `?? null` would put every absent one back in — the defect
             * again, one layer up. The caller hands the object it means.
             *
             * `version` is a FENCE ON THE WORK and not a general one: `update_automation`
             * moves it on a change of steps and on nothing else, so a concurrent rename does
             * not move it. What protects every other field is that the patch writes only what
             * it names, under a row lock the database takes before it resolves anything.
             */
            async patchAutomation({ id, patch, version, operation } = {}) {
              if (!isId(id)) return { ok: false, error: "no-automation" };
              if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
                return { ok: false, error: "bad-patch" };
              }
              return mutate("patchAutomation", operation, {
                p_tenant: tenant, p_id: id, p_patch: patch,
                // ⚠ REFUSED RATHER THAN COERCED, and `null` is what "no fence" means.
                // `Number("x")` is `NaN` and `Number(null)` is `0`, and a `0` here is a
                // version no automation has, so every guarded edit would answer `stale`.
                p_expect_version: Number.isInteger(version) ? version : null,
              });
            },
            async setAutomationEnabled({ id, enabled, operation } = {}) {
              // ⚠ REFUSED, NEVER COERCED. `Boolean("false")` is `true`, and a model
              // writing `"false"` into a tool argument is exactly the input that would
              // turn an automation ON while the sentence says it was turned off.
              if (typeof enabled !== "boolean") return { ok: false, error: "bad-enabled" };
              if (!(await this.readAutomation({ id }))) return { ok: false, error: "no-automation" };
              return mutate("setAutomationEnabled", operation, {
                p_tenant: tenant, p_id: id, p_enabled: enabled,
              });
            },
            async startAutomation({ id, runId, input, operation } = {}) {
              if (!(await this.readAutomation({ id }))) return { ok: false, error: "no-automation" };
              return mutate("startAutomation", operation, {
                p_tenant: tenant, p_automation_id: id, p_run_id: runId,
                p_trigger: "manual", p_occurrence: null, p_input: input ?? {},
              });
            },

            // ── what an execution did ───────────────────────────────────────
            async listExecutions({ automation, limit } = {}) {
              if (!(await this.readAutomation({ id: automation }))) return [];
              return list(await rpc(CAPABILITY_RPC.listExecutions, {
                p_tenant: tenant, p_automation_id: automation, p_limit: limit ?? 10,
              }));
            },
            /**
             * The agent's own authoring settings — its time zone, or `null` where nobody has
             * set a usable one. **A READ, not a write: no path here can set it**, which is
             * what keeps "a model must not choose the zone" a property of the surface rather
             * than a rule somewhere. `null` for a failed read as well as for an absent
             * setting, because the caller's move is the same either way: ask.
             */
            async readAgentSettings() {
              const row = await rpc(CAPABILITY_RPC.readAgentSettings, {
                p_tenant: tenant, p_agent_id: agentId,
              });
              if (row === null || typeof row !== "object" || row.ok !== true) return { zone: null };
              return { zone: typeof row.zone === "string" && row.zone.trim() ? row.zone.trim() : null };
            },
            /**
             * ⚠ **WHAT THIS ACCOUNT'S RECORD ALREADY SAYS ABOUT ONE OPERATION — read-only,
             * and it exists because a refusal computed from CURRENT STATE was reaching a
             * retry whose success is already recorded.**
             *
             * **THE DEFECT, REPRODUCED before this existed.** `change_automation` moved a
             * daily automation from 09:00 to 10:00, its answer was lost, and the retry of the
             * SAME operation read the stored row, found 10:00 already there, computed an
             * empty patch and answered `nothing-asked` — never reaching
             * `patch_automation_once`, which was holding `{ok: true, version: 1, …}` for
             * exactly that identity. Measured through the real tool against a real
             * PostgreSQL. The database was right throughout; the tool refused above it.
             *
             * **THE ACTION IS DERIVED FROM `CAPABILITY_RPC`, NEVER PASSED IN**, so it is the
             * same name the `_once` wrapper records under — one copy, and a caller cannot ask
             * about an action this surface does not perform. **Only a WRITE has a record**, so
             * asking about a read is `unknown` rather than `fresh`: `fresh` is a statement
             * about a record, and there is none to make it about.
             *
             * ⚠ **CANNOT-TELL IS `unknown` AND NEVER `fresh`, and which way that falls is the
             * whole safety argument.** Read as `fresh`, an unreadable answer sends the caller
             * down the ordinary path — which either writes (and the wrapper decides, because
             * it asks this same function inside the transaction) or refuses as it does today.
             * Read as `repeat`, it would invent a success with no outcome to answer from. So
             * the cost of not knowing is the old refusal, never a fabricated answer. A failed
             * REQUEST throws, exactly as every other operation's does — the write below it
             * would throw too, so this adds no new failure mode.
             */
            async checkOperation({ op, operation } = {}) {
              const fn = CAPABILITY_RPC[op];
              if (!fn || !CAPABILITY_WRITES.includes(op)) {
                return { state: "unknown", why: "not-a-write" };
              }
              const id = splitOperation(operation);
              if (!id) {
                return { state: "unknown",
                  why: operation === undefined || operation === null
                    ? "operation-required" : "operation-unreadable" };
              }
              const row = await rpc(CAPABILITY_RPC.checkOperation, {
                p_tenant: tenant, p_op_key: id.key, p_action: fn, p_args_hash: id.hash,
              });
              const state = row && typeof row === "object" && typeof row.state === "string"
                ? row.state : null;
              if (state === null) return { state: "unknown", why: "unreadable-answer" };
              return { state,
                outcome: row.outcome ?? null,
                // WHAT THE KEY WAS RECORDED FOR, on a mismatch. It is the only thing a
                // caller can act on, and it is the wrapper's own field name.
                action: typeof row.action === "string" ? row.action : null,
                recordedAt: row.recordedAt ?? null };
            },
            /**
             * ⚠ **STOP ONE EXECUTION — and the WALL is `readExecution`, not a filter in the
             * function.**
             *
             * `agent.cancel_run` takes a RUN id and filters by tenant alone, because a person
             * is entitled to their whole account. An agent is entitled to its own, so this
             * reads the execution FIRST — which asks `readAutomation` about the automation it
             * belongs to, the one wall no tenant filter can see. **And that read is also what
             * keeps a conversation out of reach**: `agent.automation_history` holds only
             * automation executions, so a run id that is a chat — including the agent's own
             * current run — resolves to nothing and is refused. The scope is a property of
             * which relation is read rather than a check somebody has to remember.
             *
             * ⚠ **`p_by` IS DERIVED FROM THE CLOSURE AND SAYS IT WAS THE AGENT.** It goes into
             * the run's own stop as `cancelledBy`, so a person reading why their automation
             * stopped must not be shown an account id a model wrote — there is no argument for
             * one, and the value names the agent because that is what is true.
             */
            async cancelExecution({ execution, reason, operation } = {}) {
              const row = await this.readExecution({ id: execution });
              if (!row) return { ok: false, error: "no-execution" };
              return mutate("cancelExecution", operation, {
                p_tenant: tenant, p_run_id: execution,
                p_by: `agent:${agentId}`,
                p_reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null,
              });
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
