/**
 * ONE TOOL CALL A PERSON HAS TO SAY YES TO — asked, answered, and bound to the
 * arguments it was asked about.
 *
 * `fetch` is INJECTED, as in `store.mjs`, `work.mjs` and `capabilities.mjs`, so every
 * branch is drivable with no network and no database. `key` is the service key: it goes
 * into a request header and into nothing else.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **THE REQUIREMENT IS DECLARED IN CODE, ON THE TOOL** (`defineTool({ approval: true })`)
 * and nowhere else. It is not read off an instruction, a retrieved document, a memory or
 * a tool result, because **none of those may grant a capability** — and a requirement that
 * DATA can set is a requirement data can unset. Data may tighten what an agent may do (the
 * tools list a customer ticks); it may never loosen it.
 *
 * **THE IDENTITY IS `(run, step, index)` AND THE AUTHORITY IS THE ARGUMENT HASH.** Two
 * calls of the same tool in one answer are two requests: the position is part of who is
 * being asked about. And approving a row authorises EXACTLY the arguments that row holds
 * — so a model that asks again at the same position with different arguments finds a
 * decision that does not apply, and is refused rather than carried by somebody else's yes.
 *
 * **THE WAIT IS THE ONE THIS PRODUCT ALREADY HAS.** A run whose tool calls have no results
 * is already the shape of "stopped part-way": the work row is marked done, the log is left
 * OPEN, and `agent.decide_tool_approval` calls `agent.requeue_run` — the same function a
 * person pressing "try again" uses. There is no second queue, no second journal and no
 * poller.
 *
 * **NOTHING HERE DECIDES.** `decide_tool_approval` is granted to `service_role` and is not
 * named in this module at all, which `test/approvals.test.mjs` asserts as a census rather
 * than leaving as a fact about today's code: an agent that could reach the deciding
 * function is an agent approving its own request, whatever sentence is in front of it.
 */

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * The arguments in a form where the SAME call always reads the same way.
 *
 * **KEY ORDER IS NOT PART OF THE ARGUMENTS**, and if it were, `{a:1,b:2}` and `{b:2,a:1}`
 * would be two different calls — a person's approval would stop applying because a
 * provider happened to reorder a field. Arrays KEEP their order, because there the order
 * is the value.
 *
 * ⚠ EVERY SCALAR CARRIES ITS TYPE, and that is not decoration. `JSON.stringify` cannot
 * tell `{a: undefined}` from `{}` (it drops the key) or `1` from `"1"` once both are in a
 * string, so a canonical form built out of plain JSON has collisions in it — two different
 * asks hashing alike, which is one person's approval authorising the other. Tagging makes
 * the encoding injective, with no sentinel string a real value could collide with.
 */
export function canonicalJson(value) {
  const walk = (v) => {
    if (v === undefined) return ["u"];
    if (v === null) return ["z"];
    if (typeof v === "boolean") return ["b", v];
    // `String(NaN)` and `String(Infinity)` are stable and are not JSON numbers, so they
    // ride as text rather than becoming `null` the way `JSON.stringify` would write them.
    if (typeof v === "number") return ["n", String(v)];
    if (typeof v === "string") return ["s", v];
    if (Array.isArray(v)) return ["a", v.map(walk)];
    if (typeof v === "object") return ["o", Object.keys(v).sort().map((k) => [k, walk(v[k])])];
    // A function, a symbol or a bigint is not something that can arrive over the wire, so
    // this is a programming error rather than an input — named, never quietly coerced.
    return ["?", typeof v];
  };
  return JSON.stringify(walk(value));
}

/** The arguments, as one stable hex string. */
export async function argsHash(args) {
  const bytes = new TextEncoder().encode(canonicalJson(args ?? {}));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * What one ask can come back as. Every one is a different thing to DO, which is why none
 * of them is folded into another.
 *
 *   `approved`  — a person said yes to THESE arguments. Run it.
 *   `rejected`  — a person said no. Do not run it; tell the model, with their words.
 *   `pending`   — nobody has answered. Stop the run and wait; nothing has been spent.
 *   `stale`     — there is a request at this position for DIFFERENT arguments. Fail closed.
 */
export const APPROVAL_STATES = Object.freeze(["approved", "rejected", "pending", "stale"]);

/**
 * WHAT THE MODEL IS TOLD when a call does not happen. One copy, because the run loop says
 * these in two places — the batch it is about to dispatch and the pending calls of a
 * resumed run — and two copies of a refusal drift into two different explanations of the
 * same fact.
 *
 * **EVERY ONE IS A TOOL RESULT AND NOT A CRASH**, in the `no-backend` idiom: the model has
 * to be able to read why, say so, and carry on with the rest of what it was asked. A
 * refusal it never sees is a tool it asks for again immediately.
 */
export const approvalRefusal = (decision) => {
  if (decision?.state === "rejected") {
    return { ok: false, error: "rejected",
             say: decision.note
               ? `a person declined this, and said: ${decision.note}`
               : "a person declined this" };
  }
  if (decision?.state === "stale") {
    return { ok: false, error: "arguments-changed",
             say: "the decision on record is about different arguments, so nothing was done — " +
                  "ask again and it will be put to a person afresh" };
  }
  // `unavailable` — there is nowhere to ask. Named rather than folded into a rejection,
  // because "somebody said no" and "nobody could be asked" want opposite things done.
  return { ok: false, error: "no-approver",
           say: "this needs a person's approval and there is nowhere to ask, so nothing was done" };
};

export function makeApprovals(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeApprovals: fetch must be a function");
  if (!isText(opts.url)) throw new TypeError("makeApprovals: url must be a non-empty string");
  if (!isText(opts.key)) throw new TypeError("makeApprovals: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = isText(opts.schema) ? opts.schema : "agent";

  // The profile header names the RELATION and differs by DIRECTION. This is a POST to
  // `/rpc/`, so it writes, and PostgREST ignores the read header on a write.
  const call = async (name, body) => {
    const res = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: opts.key, authorization: `Bearer ${opts.key}`,
        "content-type": "application/json", accept: "application/json",
        "content-profile": schema,
      },
      body: JSON.stringify(body),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    // ⚠ RAISED, NEVER READ AS AN ANSWER. A failed ask read as "not approved" would stop
    // every run during an outage and fill a customer's screen with requests nobody made;
    // read as "approved" it would be an outage authorising tool calls. Both readings are
    // wrong, so there is no reading.
    if (!res.ok) {
      const e = new Error(`${name}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : ""}`);
      e.status = res.status;
      throw e;
    }
    return parsed;
  };

  return {
    /**
     * The account, from the claim. **There is no argument for it anywhere below**, so no
     * model-written value can reach it.
     */
    forTenant(tenant) {
      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string, from the claim");
      return {
        /**
         * One run's gate. `agentId` is the AUTHORED agent, so a screen can show what is
         * waiting without joining through the journal; a run started through `POST /runs`
         * has none and the column is nullable.
         */
        forRun({ runId, agentId = null } = {}) {
          if (!isText(runId)) throw new TypeError("forRun: runId must be a non-empty string");
          return Object.freeze({
            /**
             * Ask about one call, and answer what to do about it.
             *
             * **ASKING IS IDEMPOTENT AND IS THE SAME ACT AS READING.** A redelivery asks
             * again and finds the first request — decision and all — rather than making a
             * second one somebody has to answer twice. So there is ONE method here rather
             * than a `request` and a `read` that can disagree about what was asked.
             */
            async ask({ step, index, tool, args }) {
              const hash = await argsHash(args);
              const answer = await call("request_tool_approval", {
                p_tenant: tenant, p_run_id: runId, p_agent_id: agentId,
                p_step: step, p_idx: index, p_tool: tool,
                p_args: args && typeof args === "object" && !Array.isArray(args) ? args : {},
                p_hash: hash,
              });
              if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
                throw new Error("request_tool_approval: no answer came back");
              }
              if (answer.ok !== true) throw new Error(`request_tool_approval: ${answer.error ?? "refused"}`);
              // ⚠ THE HASH IS COMPARED BY THE DATABASE, INSIDE THE STATEMENT THAT READ THE
              // ROW. Comparing here would be a second copy of the test over a value that
              // travelled, and the row it has to agree with is the one a person was shown.
              if (answer.matches !== true) return { state: "stale", id: answer.id ?? null, tool };
              if (answer.verdict === "approved") return { state: "approved", id: answer.id ?? null, tool };
              if (answer.verdict === "rejected") {
                return { state: "rejected", id: answer.id ?? null, tool,
                         note: isText(answer.note) ? answer.note : null };
              }
              return { state: "pending", id: answer.id ?? null, tool };
            },
          });
        },
      };
    },
  };
}
