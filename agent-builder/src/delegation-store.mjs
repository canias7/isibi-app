/**
 * DELEGATION OVER THE WIRE — the five things the engine has to say about a task tree.
 *
 * `fetch` is INJECTED, so every branch is drivable with no network and no database,
 * exactly as in `store.mjs`, `work.mjs` and `automation-store.mjs`. `key` is the service
 * key: it goes into a request header and into nothing else.
 *
 * **IT SPEAKS TO THE DELEGATION FUNCTIONS AND NEVER TO THE QUEUE'S.** Claiming, beating,
 * releasing and sweeping a run are `work.mjs`'s, unchanged, because a child IS an ordinary
 * agent run and uses the same work row — which is the whole reason this feature needed no
 * change to `agent.runs`. What is here is only what is specific to a tree: filing the
 * children, recording an answer, stopping them, reading their progress, and asking which
 * parents have waited past a deadline.
 *
 * ⚠ **THE TENANT IS AN ARGUMENT HERE AND A CLOSURE IN `store.mjs`, and the difference is
 * where it comes from rather than a relaxation.** The rule this directory records is that
 * no OPERATION AN AGENT'S TOOLS CAN REACH takes a tenant as an argument — because a model
 * writes tool arguments, so a tenant among them is a tenant a model could choose. Nothing
 * below is reachable from a tool or from a request body: every caller is the RUNNER, whose
 * tenant comes from `claim_run`'s answer — the same statement that took the row — which is
 * exactly where `automation-store.mjs`'s `read`, `children`, `emit` and `hearPendingEvent`
 * get theirs. Two of the five take no tenant at all and each says why.
 *
 * NOTHING IN HERE DECIDES ANYTHING. The bounds, the narrowing, the absorbing of a
 * redelivered ask and the waking of a parent are all in the migration, inside one
 * transaction each; `src/delegation.mjs` holds the reading. This module's job is to speak
 * to those correctly and to read their refusals the right way round.
 */
import { profileFor } from "./rest-profile.mjs";

const isText = (v) => typeof v === "string" && v.trim() !== "";

export function makeDelegationStore(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeDelegationStore: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeDelegationStore: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeDelegationStore: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";

  // ⚠ THE PROFILE COMES FROM THE METHOD, THROUGH `rest-profile.mjs` — one rule for every
  // store, because the defect it closed was each store deciding for itself behind a flag
  // named for what the FUNCTION does rather than for what the REQUEST is. Every PostgREST
  // RPC is a POST however purely the function behind it reads.
  const headers = (method) => ({
    apikey: opts.key,
    authorization: `Bearer ${opts.key}`,
    "content-type": "application/json",
    accept: "application/json",
    ...profileFor(method, schema),
  });

  async function rpc(name, args) {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: headers("POST"),
      body: JSON.stringify(args),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch { body = null; } }
    if (!res.ok) {
      // A FAILURE THAT NAMES ITSELF: the status and the server's own words, because
      // "delegation failed" with nothing after it is the shape that costs an afternoon.
      const e = new Error(`${name}: HTTP ${res.status}${body?.message ? ` — ${body.message}` : text ? ` — ${text.slice(0, 200)}` : ""}`);
      e.status = res.status;
      e.body = body;
      throw e;
    }
    return body;
  }

  /**
   * An answer, or a raise.
   *
   * ⚠ **A REQUEST THAT ANSWERED NOTHING IS NOT A REFUSAL, and collapsing the two is how
   * an outage becomes "your specialists declined".** Every function below answers a jsonb
   * OBJECT with `ok` on it, so anything else is our own layer having failed to read it —
   * and a caller handed `{ok: undefined}` reads it as a refusal it can compose a sentence
   * about, which is a sentence about somebody's account that is not true.
   */
  function answered(name, body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`${name}: no answer came back`);
    }
    return body;
  }

  return {
    /**
     * FILE ONE CHILD RUN PER DELEGATED TASK, AND LET THE PARENT GO — one transaction.
     *
     * ⚠ **THE IDS ARE THE CALLER'S AND THIS STORE MINTS NONE.** `agent.delegate_children`
     * refuses a child with no `id` and no `run_id` rather than minting them, and that
     * refusal is the retry safety: an id derived from the slot is the same id on every
     * delivery, and a server-minted one is a fresh one by construction — so a redelivery
     * would make a twin. Minting here would be the same defect one layer up.
     *
     * ⚠ **THE PARENT'S CLAIM IS HANDED OVER SO THE RELEASE IS IN THAT TRANSACTION.**
     * Filing the children and letting go must not be two statements: between them the
     * children exist and the parent still holds its work, and a child settling in that
     * window finds the parent HELD, so `agent.requeue_run` refuses to disturb it and the
     * wake is lost — a parent waiting for ever on children that have all answered.
     * MEASURED by driving the function before the release existed.
     *
     * Optional, because a caller with more to do before it waits keeps its claim — and
     * the release is FENCED, so a token that does not match releases nothing rather than
     * releasing somebody else's work. The answer says which of the three happened
     * (`parent_released`: `null` nothing handed in, `false` it did not match, `true`).
     */
    async delegate({ tenant, parent, step, children, bounds, waitMs, worker, token }) {
      if (!isText(tenant)) throw new TypeError("delegate: tenant must be a non-empty string, from the claim");
      if (!isText(parent)) throw new TypeError("delegate: parent must be a non-empty string");
      if (!isText(step)) throw new TypeError("delegate: step must be a non-empty string");
      if (!Array.isArray(children)) throw new TypeError("delegate: children must be an array");
      return answered("delegate_children", await rpc("delegate_children", {
        p_tenant: tenant,
        p_parent: parent,
        p_step: step,
        p_children: children,
        // ⚠ ABSENT IS A REAL ANSWER AND IS THE FUNCTION'S OWN DEFAULT, never one written
        // here. A bound this module filled in would be a second copy of a number the
        // migration already holds, and the copy that drifts is the one nothing enforces.
        ...(bounds === undefined ? {} : { p_bounds: bounds }),
        ...(waitMs === undefined ? {} : { p_wait_ms: waitMs }),
        ...(worker === undefined || token === undefined ? {} : { p_worker: worker, p_token: token }),
      }));
    },

    /**
     * RECORD ONE CHILD'S OUTCOME, and put the parent back once nothing of that step is
     * outstanding.
     *
     * **IT TAKES NO TENANT BECAUSE IT IS FENCED BY THE CHILD'S OWN CLAIM** — the same five
     * checks every journal write presents, against the work row the function locks. The
     * worker and the token ARE the authority, so a tenant beside them would be a second
     * one that can disagree with the row.
     *
     * The first answer stands: a redelivery says `repeat` and writes nothing, so a
     * duplicate delivery cannot count a result twice.
     */
    async settle({ child, worker, token, outcome }) {
      if (!isText(child)) throw new TypeError("settle: child must be a non-empty string");
      if (!isText(worker)) throw new TypeError("settle: worker must be a non-empty string, from the claim");
      if (!isText(token)) throw new TypeError("settle: token must be a non-empty string, from the claim");
      // ⚠ REFUSED RATHER THAN COERCED, and the function refuses it too. `ok` has to be the
      // jsonb boolean, because `Boolean("false")` is `true` and an outcome whose success
      // is a string is one a combination would read as delivered.
      if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
        throw new TypeError("settle: outcome must be an object");
      }
      return answered("settle_delegation", await rpc("settle_delegation", {
        p_child: child, p_worker: worker, p_token: token, p_outcome: outcome,
      }));
    },

    /**
     * STOP EVERY OUTSTANDING CHILD OF ONE PARENT, and say how far each had got.
     *
     * A child that had already answered is left exactly as it is and comes back under
     * `alreadyAnswered` — because **an effect that already happened stays happened**, and
     * reporting one as stopped would claim work was undone that was not.
     */
    async cancel({ tenant, parent, by, reason }) {
      if (!isText(tenant)) throw new TypeError("cancel: tenant must be a non-empty string, from the claim");
      if (!isText(parent)) throw new TypeError("cancel: parent must be a non-empty string");
      if (!isText(by)) throw new TypeError("cancel: by must be a non-empty string — a stop nobody can be tied to is one nobody can be asked about");
      return answered("cancel_delegations", await rpc("cancel_delegations", {
        p_tenant: tenant, p_parent: parent, p_by: by, p_reason: reason ?? null,
      }));
    },

    /**
     * EVERY CHILD OF ONE PARENT IN POSITION ORDER — what it was told, what it was allowed,
     * its run's status and its outcome.
     *
     * ⚠ **A READ THAT FAILED IS RAISED AND NEVER READ AS "no children".** The two are
     * opposite facts: one is a step that asked for nothing, the other is a tree whose work
     * we could not see — and `waitVerdict` answers `no-children` for the first, which is
     * the one reading that must not be reachable by an outage. Cannot-tell must never read
     * as a value, and the value here is what a parent combines.
     *
     * ORDERED BY POSITION BY THE FUNCTION, which is what makes `combineResults` and the
     * screen agree about which child is which; a sort here would be a second ordering.
     */
    async progress({ tenant, parent }) {
      if (!isText(tenant)) throw new TypeError("progress: tenant must be a non-empty string, from the claim");
      if (!isText(parent)) throw new TypeError("progress: parent must be a non-empty string");
      const rows = await rpc("delegation_progress", { p_tenant: tenant, p_parent: parent });
      if (!Array.isArray(rows)) throw new Error("delegation_progress: the answer is not a list");
      return rows;
    },

    /**
     * PUT BACK ON THE QUEUE EVERY PARENT WITH A CHILD PAST ITS DEADLINE, so silence
     * becomes an answer rather than a wait with no end.
     *
     * **A PLATFORM SWEEP, SO IT TAKES NO TENANT — and that is not a hole in the closure
     * rule.** The rule is about what a tool can reach; this is reachable only from
     * `worker.scheduled`, exactly as `reclaimable`, `dispatchEvents` and the scheduler's
     * own tick are, and it is scoped per PARENT by the rows it reads.
     *
     * **IT SETTLES NOTHING, deliberately**: `unresolved` is DERIVED from the deadline, so
     * an outcome written here would be a second source of truth beside it — and it would
     * be OUR outcome for work somebody's specialist may yet answer. The parent is put back
     * and decides what silence adds up to, which under every policy is not success.
     *
     * ⚠ **AN UNREADABLE ANSWER IS RAISED RATHER THAN READ AS AN EMPTY SWEEP**, which is
     * `dispatchEvents`' rule and deliberately NOT `work.sweep`'s coercion: reading an
     * outage as "no parent was overdue" turns it into a platform that quietly stopped
     * rescuing stranded trees, and every parent waiting on a dead child waits for ever
     * with nothing said.
     */
    async overdue({ limit = 25 } = {}) {
      const rows = await rpc("sweep_delegations", { p_limit: limit });
      if (!Array.isArray(rows)) throw new Error("sweep_delegations: the answer is not a list");
      return rows;
    },

    /**
     * ── THE RUN-BOUND SEAM, and it is the only part of this module a TOOL may reach ──
     *
     * `forTenant(t).forRun({ runId })` hands back the two operations a delegating tool
     * needs, with the account and the parent already applied: **neither takes a tenant and
     * neither takes a run id**, so there is nowhere for a model-written argument to become
     * authority. It is the shape `approvals.mjs`' `forTenant(t).forRun({ runId })` already
     * takes, for the same reason and with the same obligation on the caller — the tenant
     * must come from `claim_run`'s answer and the run id from the delivery.
     *
     * The five flat operations above stay as they are, because the RUNNER and the platform
     * sweep are their callers and a tenant argument is correct there.
     */
    forTenant(tenant) {
      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string, from the claim");
      return {
        forRun({ runId } = {}) {
          if (!isText(runId)) throw new TypeError("forRun: runId must be a non-empty string");
          return Object.freeze({
            /**
             * File this step's children, or find the ones already filed.
             *
             * **ONE METHOD RATHER THAN A `file` AND A `find` THAT CAN DISAGREE**, which is
             * the shape `ask` takes one module over: the unique index is on
             * `(parent, step, position)`, so a redelivery ABSORBS and reads back what is
             * there. So asking is the same act as filing, and a tool needs no branch for
             * which delivery it is on.
             *
             * ⚠ **THE PARENT'S CLAIM IS DELIBERATELY NOT HANDED OVER, and the reason is a
             * correction to the migration's own comment.** `delegate_children` CAN release
             * the parent inside its transaction, which is what would make a child settling
             * in the next microsecond wake it with no delay — and the cost of that is that
             * NOTHING MAY WRITE TO THE JOURNAL AFTERWARDS, because every write presents the
             * claim and the fence refuses a released one. A model can call this alongside
             * another tool in one batch, and those siblings' results are written after the
             * fanout returns: with the claim gone they would all be refused, the delivery
             * would answer `journal-failed`, and every redelivery would do the same until
             * the attempt ceiling. So the RUNNER releases, exactly as it does for an
             * approval, and the race is bounded by the cron rather than by the deadline —
             * see `sweep_delegations`' second arm.
             */
            async open({ step, children, bounds, waitMs } = {}) {
              return rpc("delegate_children", {
                p_tenant: tenant, p_parent: runId, p_step: step, p_children: children,
                ...(bounds === undefined ? {} : { p_bounds: bounds }),
                ...(waitMs === undefined ? {} : { p_wait_ms: waitMs }),
              });
            },

            /**
             * Every child of this parent in position order, with what it was told, what it
             * was allowed, its run's status and its outcome.
             *
             * ⚠ **AN UNREADABLE ANSWER IS RAISED, NEVER READ AS "no children".** An empty
             * list is what a parent that delegated to nobody looks like, and `waitVerdict`
             * answers `no-children` for it — which is a real refusal. Reading an OUTAGE as
             * that same shape would turn a database blip into a step reporting that its
             * specialists were never asked for anything.
             */
            async look() {
              const rows = await rpc("delegation_progress", { p_tenant: tenant, p_parent: runId });
              if (!Array.isArray(rows)) throw new Error("delegation_progress: the answer is not a list");
              return rows;
            },
          });
        },
      };
    },
  };
}
