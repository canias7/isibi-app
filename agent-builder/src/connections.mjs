/**
 * CONNECTIONS TO THINGS OUTSIDE — and one function that performs an action through one.
 *
 * Milestone 8: *provider-independent connection ownership, scopes, credential protection,
 * refresh, disconnect, revocation … a read action and an approved write action, including
 * expired credentials, revoked access, timeout, and uncertain outcome. Design explicitly
 * for providers without idempotency support: uncertain writes need reconciliation, not
 * blind retries. Keep credentials out of model context, tool results, and logs.*
 *
 * ── ⚠ THE TENANT AND THE AGENT ARE CLOSURES, NEVER ARGUMENTS ─────────────────
 *
 * `makeConnections(...).forTenant(t).forAgent(a)` hands back the operations and **not one
 * of them takes a tenant or an agent id**, exactly as `capabilities.mjs` and `store.mjs`
 * already do. A model writes tool arguments; an operation with a tenant parameter is one a
 * model can point at somebody else's mailbox, and here there is nowhere to put one. It is
 * asserted as a census over the real surface rather than promised here.
 *
 * ── ⚠ THE CREDENTIAL NEVER COMES BACK OUT OF THIS MODULE ─────────────────────
 *
 * `agent.lease_connection` is the only thing in the schema that selects a secret, and this
 * is the only caller of it. What `perform` hands back is the PROVIDER's answer; the lease
 * itself is a local and dies with the call. There is no operation that answers a
 * credential, no field on any answer that could carry one, and nothing here logs a lease.
 * **`test/connections.test.mjs` asserts that with a sentinel over every answer and every
 * thrown error this module can produce**, because a promise about logging is the one kind
 * of promise nobody notices being broken.
 *
 * ── ⚠ THE ADAPTER IS CODE, LOOKED UP BY WHAT THE DATABASE SAYS ───────────────
 *
 * `adapters` is a registry of provider name → adapter, handed in at construction. The name
 * used to look one up comes from the LEASE — a column the customer's own connection row
 * holds — and never from an argument, so a model cannot choose which code runs. That is the
 * same division `agent.agents` makes between a customer's instructions (data) and its tools
 * (code): adding a real provider is adding an adapter here, not a migration.
 *
 * ── AND `writes` DECIDES WHETHER A FAILURE IS AN OUTCOME OR A QUESTION ───────
 *
 * A read that fails did not happen. A write that fails MAY have — so a write goes through
 * `agent.operations` and a read deliberately does not. A record for a read would be a row
 * per lookup, protecting nothing: there is no duplicate to prevent, because a second read
 * changes nothing at the provider.
 */

import { profileFor } from "./rest-profile.mjs";
import { splitOperation } from "./approvals.mjs";

const isText = (v) => typeof v === "string" && v.trim() !== "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v) => typeof v === "string" && UUID.test(v);

/**
 * Every operation this module offers, as NAMES, so a census can walk the surface without
 * knowing what any of them does. `forAgent` is built from this list, so an operation added
 * without a name here is not reachable at all.
 */
export const CONNECTION_OPS = Object.freeze([
  "list", "connect", "disconnect", "revoke", "refresh", "perform",
]);

/** The database function each one calls, declared so a census can read it. */
export const CONNECTION_RPC = Object.freeze({
  connect: "connect_provider",
  disconnect: "disconnect_connection",
  revoke: "revoke_connection",
  refresh: "refresh_connection",
  lease: "lease_connection",
  begin: "operation_begin",
  settle: "operation_settle",
});

/**
 * WHICH OF THEM CHANGE SOMETHING, declared beside the list rather than inferred from a name.
 *
 * ⚠ **`perform` IS ON IT AND THAT IS THE INTERESTING PART: it is the one operation whose
 * answer depends on its ARGUMENT rather than on its name.** `read_messages` and
 * `send_message` go through the same function, and only the second changes anything at the
 * provider — so a tool's own `writes` flag cannot be decided from "it calls `perform`". It is
 * decided by whether the ACTION is in the adapter's own `writes` list, which is what
 * `test/capabilities.test.mjs` drives rather than asserting from a name.
 */
export const CONNECTION_WRITES = Object.freeze([
  "connect", "disconnect", "revoke", "refresh", "perform",
]);

/** At most this many live connections per agent — the database's own ceiling, named here. */
export const MAX_CONNECTIONS = 20;

/**
 * ⚠ **THE OPERATION RECORD'S ACTION NAME IS `<provider>_<action>`, AND IT IS BOUNDED
 * RATHER THAN TRUNCATED.** `agent.operations.action` is `^[a-z][a-z0-9_]{0,63}$`, so a
 * provider and an action that together overrun it must be REFUSED: a truncated name is two
 * different actions sharing one record, which is the one mistake this record exists to
 * prevent, arriving through a tidy-looking `slice`.
 */
const ACTION_NAME = /^[a-z][a-z0-9_]{0,63}$/;
export const recordAction = (provider, action) => {
  const name = `${provider}_${action}`;
  return ACTION_NAME.test(name) ? name : null;
};

/**
 * ⚠ **THE TRACE IS THE OPERATION'S OWN IDENTITY, WHICH IS WHAT MAKES RECONCILIATION
 * POSSIBLE AT ALL.** To ask a provider "did I already send this" you need something it
 * stored that you can recognise, and it has to be the SAME on a retry — so it is the
 * operation string, which is stable across every delivery of one call and different for
 * different arguments. Minting one per attempt would make a redelivery unable to find its
 * own earlier send, which is the whole failure being prevented.
 */
export const traceFor = (operation) => (isText(operation) ? operation.trim() : null);

export function makeConnections(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeConnections: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeConnections: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeConnections: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";
  /** ⚠ CODE, keyed by the provider name the DATABASE answers. Never taken from an argument. */
  const adapters = opts.adapters && typeof opts.adapters === "object" ? opts.adapters : {};

  // THE PROFILE COMES FROM THE METHOD, through the one rule — see `rest-profile.mjs`.
  const headers = (method) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    ...profileFor(method, schema),
  });
  const RPC_METHOD = "POST";
  const READ_METHOD = "GET";

  async function rpc(name, body) {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: RPC_METHOD, headers: headers(RPC_METHOD), body: JSON.stringify(body),
    });
    const textBody = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (textBody) { try { parsed = JSON.parse(textBody); } catch { parsed = null; } }
    if (!res.ok) {
      const e = new Error(`${name}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : ""}`);
      e.status = res.status;
      throw e;
    }
    return parsed;
  }

  async function readRows(query) {
    const res = await doFetch(`${base}/rest/v1/${query}`, {
      method: READ_METHOD, headers: headers(READ_METHOD),
    });
    const textBody = typeof res.text === "function" ? await res.text() : "";
    if (!res.ok) {
      const e = new Error(`connections: HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    try { const v = JSON.parse(textBody); return Array.isArray(v) ? v : []; } catch { return []; }
  }

  return {
    forTenant(tenant) {
      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string");
      return {
        forAgent(agentId) {
          if (!isId(agentId)) throw new TypeError("forAgent: agent must be a uuid");

          /**
           * ⚠ READ THROUGH THE VIEW, WHICH CANNOT NAME A CREDENTIAL. `agent.connection_list`
           * does not select either secret, so this cannot hand one out even by asking for
           * `*` — and it is scoped to this agent as well as to the account, because a
           * sibling agent of the same owner is the wall no tenant filter can see.
           */
          async function list() {
            return readRows(`connection_list?tenant_id=eq.${encodeURIComponent(tenant)}` +
              `&agent_id=eq.${encodeURIComponent(agentId)}&order=created_at.desc`);
          }

          /**
           * ⚠ ONE DOOR, AND IT IS A LOCAL. The lease is never returned, never logged and
           * never put on an answer — it is handed to the adapter and goes out of scope with
           * the call.
           */
          async function lease(id, scopes) {
            return rpc(CONNECTION_RPC.lease, {
              p_tenant: tenant, p_agent_id: agentId, p_id: id,
              p_scopes: Array.isArray(scopes) ? scopes : [],
            });
          }

          /**
           * PERFORM ONE ACTION THROUGH ONE CONNECTION.
           *
           * ⚠ **THE ORDER IS THE SAFETY ARGUMENT.** The action is checked against the
           * ADAPTER's own list before anything is leased, so an action nobody implements
           * never reaches a credential; the lease is then what decides whether the
           * connection may be used at all, and its four refusals each come back by their
           * own name. Only then does a write claim its operation record — and a record
           * claimed before the lease would leave a row for work that was never permitted.
           */
          async function perform({ connection, action, args, operation } = {}) {
            const id = isId(connection) ? connection : null;
            if (!id) return { ok: false, error: "no-connection", say: "name a connection of this agent's" };
            const act = isText(action) ? action.trim() : "";
            if (!act) return { ok: false, error: "no-action", say: "say which action to perform" };

            const held = await lease(id, []);
            if (!held?.ok) return { ...held, ok: false };

            // ⚠ THE ADAPTER COMES FROM THE LEASE'S PROVIDER — the database's own column.
            const adapter = Object.hasOwn(adapters, held.provider) ? adapters[held.provider] : null;
            if (!adapter) {
              return { ok: false, error: "no-adapter", provider: held.provider,
                say: `this deployment cannot talk to ${held.provider}` };
            }
            // A POSITIVE LIST, so an action the adapter does not implement is refused by
            // name rather than reaching its code as an unknown string.
            if (!adapter.actions.includes(act)) {
              return { ok: false, error: "no-such-action", action: act,
                offered: adapter.actions.slice(), say: `${held.provider} has no action called that` };
            }

            // ⚠ THE SCOPE IS ASKED OF THE DATABASE, not compared here: the grant lives on the
            // row and the refusal names what is missing. Re-asking for the action's own scope
            // is one lease, so the credential is fetched once whichever way this goes.
            const needs = adapter.scopes?.[act];
            const scoped = isText(needs) ? await lease(id, [needs]) : held;
            if (!scoped?.ok) return { ...scoped, ok: false };

            const writes = Array.isArray(adapter.writes) && adapter.writes.includes(act);
            const sendArgs = args && typeof args === "object" ? { ...args } : {};

            // ── A READ: no record, because there is no duplicate to prevent ──
            if (!writes) {
              try {
                const out = await adapter.run(act, sendArgs, scoped);
                return { ok: true, action: act, provider: held.provider, result: out };
              } catch (e) {
                // A READ THAT FAILED DID NOT HAPPEN, so it is a plain failure and never
                // `unresolved` — which is a word about a change that may have landed.
                return { ok: false, error: "action-failed", action: act,
                  why: e?.why ?? "the provider could not be reached", say: "that could not be read" };
              }
            }

            // ── A WRITE: the record decides whether to send at all ──
            const opId = splitOperation(operation);
            if (!opId) {
              return { ok: false, error: operation === undefined || operation === null
                ? "operation-required" : "operation-unreadable",
                say: "this action needs an identity, so a retry cannot do it twice" };
            }
            const recorded = recordAction(held.provider, act);
            if (!recorded) {
              return { ok: false, error: "action-unrecordable", action: act,
                say: "that provider and action cannot be recorded together, so it will not be attempted" };
            }
            const trace = traceFor(operation);

            const begun = await rpc(CONNECTION_RPC.begin, {
              p_tenant: tenant, p_op_key: opId.key, p_action: recorded,
              p_args_hash: opId.hash, p_op_run: opId.run,
            });
            if (!begun?.ok) return { ...begun, ok: false, action: act };

            if (begun.began === false && begun.state === "repeat") {
              // ⚠ ALREADY DONE, AND THE ANSWER IS WHAT IT DID THE FIRST TIME — a historical
              // fact rather than a reading of the provider now. Nothing is sent.
              return { ok: true, repeat: true, action: act, provider: held.provider,
                result: begun.outcome,
                say: "that had already been done, so it was not done again" };
            }
            if (begun.began === false && begun.state === "unfinished") {
              // ⚠ **SENT ONCE, OUTCOME UNKNOWN. THIS IS THE CASE THE MILESTONE NAMES.** A
              // blind retry here sends a second message, because this provider has no
              // idempotency. So we ASK it what it has.
              return settle(adapter, act, scoped, held, opId, recorded, trace, { reconciling: true });
            }

            // ── WE HOLD THE SLOT. SEND. ──
            let out;
            try {
              out = await adapter.run(act, { ...sendArgs, trace }, scoped);
            } catch (e) {
              if (e?.uncertain) {
                // IT MAY HAVE LANDED. Reconcile rather than retry, and if it cannot be
                // settled the record stays in flight and the answer says so.
                return settle(adapter, act, scoped, held, opId, recorded, trace, { reconciling: false });
              }
              // ⚠ **A DEFINITE REFUSAL IS SETTLED AS A FAILURE, and that does not strand
              // anything.** It records that this operation did not happen, so a REDELIVERY of
              // the same call is answered instead of sending — and a fresh attempt after the
              // model has seen the failure is a new step, hence a new position and a new
              // identity, because this engine never retries a call by itself.
              await settleRecord(opId, recorded, { ok: false, error: "refused", why: e?.why ?? "refused" });
              return { ok: false, error: "action-failed", action: act,
                why: e?.why ?? "the provider refused it", say: "that did not go out" };
            }
            await settleRecord(opId, recorded, { ok: true, result: out });
            return { ok: true, action: act, provider: held.provider, result: out };
          }

          /** Fill in an in-flight record. Write-once in the database; its answer is read. */
          async function settleRecord(opId, recorded, outcome) {
            return rpc(CONNECTION_RPC.settle, {
              p_tenant: tenant, p_op_key: opId.key, p_action: recorded,
              p_args_hash: opId.hash, p_outcome: outcome,
            });
          }

          /**
           * ASK THE PROVIDER WHAT IT ALREADY HAS, AND SETTLE FROM THE ANSWER.
           *
           * ⚠ **THREE OUTCOMES, AND NOT ONE OF THEM SENDS ANYTHING.** It already happened
           * (settle as done); it definitely did not (settle as failed, and say so, so the
           * model can ask again in a new step); or nobody can tell — which stays in flight,
           * answers `unresolved`, and is the honest end of it for a provider whose payload
           * cannot carry a marker.
           *
           * **`unresolved` IS NOT A KIND OF FAILURE.** `ok: false, error: "action-failed"`
           * says the work did not happen; this says nobody knows. They invite opposite next
           * moves — one invites doing it again, the other invites CHECKING first — and
           * recording an unknown as a failure is a claim nothing here is entitled to make.
           */
          async function settle(adapter, act, scoped, held, opId, recorded, trace, { reconciling }) {
            const unresolved = (why) => ({
              ok: false, error: "unresolved", action: act, provider: held.provider,
              uncertain: true, why,
              say: "it may or may not have gone out — check at " + held.provider +
                   " before asking for it again, because asking again could do it twice",
            });
            if (typeof adapter.reconcile !== "function" ||
                (typeof adapter.reconcilable === "function" && !adapter.reconcilable(act))) {
              return { ...unresolved("this action cannot be checked after the fact"), reconcilable: false };
            }
            if (!isText(trace)) return { ...unresolved("there is nothing to match it by"), reconcilable: false };
            let seen;
            try {
              seen = await adapter.reconcile(act, { trace }, scoped);
            } catch (e) {
              return { ...unresolved(e?.why ?? "the check itself could not be made"), reconcilable: true };
            }
            if (!seen || seen.known !== true) {
              return { ...unresolved("the provider could not say"), reconcilable: true };
            }
            if (seen.done) {
              await settleRecord(opId, recorded, { ok: true, result: { ...seen, reconciled: true } });
              return { ok: true, action: act, provider: held.provider, reconciled: true,
                result: { ...seen, reconciled: true },
                say: reconciling
                  ? "that had already been done — I checked rather than doing it again"
                  : "the provider did not answer, but I checked and it had gone out",
              };
            }
            await settleRecord(opId, recorded, { ok: false, error: "not-done", reconciled: true });
            return { ok: false, error: "action-failed", action: act, reconciled: true,
              why: "the provider did not answer, and a check found it had not happened",
              say: "that did not go out — ask again if you still want it" };
          }

          return Object.freeze({
            list,
            /**
             * ⚠ THE ID IS THE CALLER'S, NOT MINTED HERE, so a retried press is absorbed by
             * the database rather than making a second connection. The connect path is a
             * PERSON's (the site's route) and is not offered as a tool at all — see
             * `capability-tools.mjs`: an agent that could store a credential is an agent
             * that could store one it wrote.
             */
            async connect({ id, provider, label, account, scopes, secret, refresh, expires } = {}) {
              return rpc(CONNECTION_RPC.connect, {
                p_tenant: tenant, p_agent_id: agentId, p_id: isId(id) ? id : null,
                p_provider: isText(provider) ? provider.trim() : "",
                p_label: isText(label) ? label.trim() : "",
                p_account: isText(account) ? account.trim() : "",
                p_scopes: Array.isArray(scopes) ? scopes : [],
                p_secret: isText(secret) ? secret : "",
                p_refresh: isText(refresh) ? refresh : null,
                p_expires: expires ?? null, p_max: MAX_CONNECTIONS,
              });
            },
            async disconnect({ id, why } = {}) {
              if (!isId(id)) return { ok: false, error: "no-connection" };
              return rpc(CONNECTION_RPC.disconnect, {
                p_tenant: tenant, p_agent_id: agentId, p_id: id, p_why: isText(why) ? why.trim() : null,
              });
            },
            async revoke({ id, why } = {}) {
              if (!isId(id)) return { ok: false, error: "no-connection" };
              return rpc(CONNECTION_RPC.revoke, {
                p_tenant: tenant, p_agent_id: agentId, p_id: id, p_why: isText(why) ? why.trim() : null,
              });
            },
            async refresh({ id, secret, refresh, expires } = {}) {
              if (!isId(id)) return { ok: false, error: "no-connection" };
              return rpc(CONNECTION_RPC.refresh, {
                p_tenant: tenant, p_agent_id: agentId, p_id: id,
                p_secret: isText(secret) ? secret : "",
                p_refresh: isText(refresh) ? refresh : null, p_expires: expires ?? null,
              });
            },
            perform,
          });
        },
      };
    },
  };
}
