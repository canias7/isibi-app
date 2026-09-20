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

import { profileFor } from "./rest-profile.mjs";

/**
 * ⚠ EVERY PostgREST RPC IS A POST, and the profile header follows from that rather than
 * from what the function does — see `rest-profile.mjs`. Named once here so the request and
 * the header cannot disagree about it.
 */
const METHOD = "POST";

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
 * tell `1` from `"1"`, or `null` from `"null"`, or `[]` from `{}` once each is in a string,
 * so a canonical form built out of plain JSON has collisions in it — two different asks
 * hashing alike, which is one person's approval authorising the other. Tagging makes the
 * encoding injective, with no sentinel string a real value could collide with.
 *
 * ⚠ IT IS FED `storedForm`, NOT THE RAW ARGUMENTS, and that is the difference between a
 * hash and a hash that survives being written down. See below.
 */
/**
 * THE ARGUMENTS AS THEY WILL BE WRITTEN DOWN — and every hash here is taken over this.
 *
 * ⚠ **A HASH THAT DOES NOT SURVIVE STORAGE IS A HASH THAT REFUSES ITS OWN APPROVAL.**
 * MEASURED: `{id: "a-7", note: undefined}` and the same object after a round trip through
 * the journal hashed DIFFERENTLY, because JSON drops an `undefined` property and rewrites
 * an `undefined` array element as `null`. The live path hashes the model's own object and
 * the resume path hashes what came back out of the store, so an approval on such a call
 * was asked about one hash and re-read at another: `matches` false, the decision `stale`,
 * and a call a person really did approve refused for ever. The two objects PRINT
 * identically — JSON is what prints them — which is why this was invisible to reading.
 *
 * So the normalisation is JSON's own, done by JSON, once, in front of every hash. Nothing
 * that survives storage is collapsed: `1` and `"1"` still differ, and so do `null` and
 * `"null"` and `[]` and `{}`. What is collapsed is only what storage collapses anyway —
 * and preserving a distinction the store cannot keep does not prevent a collision, it
 * manufactures one.
 *
 * **A VALUE JSON CANNOT WRITE AT ALL RAISES**, rather than hashing as something else. A
 * cycle, a BigInt or a `toJSON` that throws is a call that cannot be recorded, so it
 * cannot be resumed and cannot be approved; `run.mjs` answers the model about it as a
 * readable tool result, exactly as it answers a tool that does not exist.
 */
export function storedForm(value) {
  if (value === undefined) return undefined;
  let text;
  try { text = JSON.stringify(value); }
  catch (e) { throw new TypeError(`storedForm: these arguments cannot be written down (${String(e?.message ?? e)})`); }
  // `JSON.stringify` answers `undefined` — not the string — for a value it has no
  // representation for at the top level: a function, a symbol, or `undefined` itself.
  if (text === undefined) return undefined;
  return JSON.parse(text);
}

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

/**
 * A UUID derived from text, deterministically — the same words always give the same id.
 *
 * **THIS IS WHAT MAKES AN ACTION SAFE TO REPEAT.** A tool that mints a fresh id per call
 * turns a redelivery into a second piece of work; one whose id is DERIVED from the call it
 * belongs to turns a redelivery into the database finding the row already there. The
 * digest's own bits are used, with the version and variant nibbles set so the value really
 * is a UUID — a column typed `uuid` refuses anything else, and a "uuid" that is not one is
 * a failure at the last possible moment rather than here.
 */
export async function uuidFrom(text) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text))));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;   // version 5 — named, so nothing reads it as random
  b[8] = (b[8] & 0x3f) | 0x80;   // the RFC variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The arguments, as one stable hex string — stable across a redelivery, a resume, and the
 * journal in between, which is what `storedForm` is in front of it for.
 */
export async function argsHash(args) {
  const bytes = new TextEncoder().encode(canonicalJson(storedForm(args) ?? {}));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * ⚠ AN OPERATION'S IDENTITY, TAKEN APART — the POSITION and the ARGUMENTS, kept separate.
 *
 * `ctx.operation` is `<run>:<step>:<index>:<hash>` and the two halves answer different
 * questions. The KEY is the first three: one tool call, in one run, at one position, the
 * same on every redelivery. The HASH is what the call was ASKED with.
 *
 * **THEY MUST NOT BE ONE STRING WHERE A DATABASE STORES THEM**, and that is the whole
 * reason this function exists. Keyed on the WHOLE thing, two different argument sets are
 * two different keys and therefore two separate operations — SILENTLY, which is exactly
 * the outcome the requirement forbids. Kept apart, a slot re-filled with a different call
 * meets the same key with a different hash and is refused.
 *
 * **SPLIT ON THE LAST COLON, deliberately**: a run id is a uuid, a step and an index are
 * numbers, and a hash is hex — so only one colon can be the last one. And it is a REFUSAL
 * rather than a repair: a shape this cannot read answers `null`, because a key invented
 * from a malformed identity is a key that collides with something.
 *
 * `run` is the seed only when it really is a uuid (it is the run's own id), because that
 * column is a uuid and a seed of some other shape is not a run.
 */
export function splitOperation(operation) {
  if (typeof operation !== "string") return null;
  const cut = operation.lastIndexOf(":");
  // ⚠ `cut === operation.length - 1` IS A DECLARED REDUNDANCY, MEASURED INERT: the hash
  // charset test below requires at least one character, so a trailing colon is refused there
  // anyway. Verified over 18 shapes — every answer identical with the clause and without it.
  // It stays because it says out loud that a hash is REQUIRED, which is the whole reason the
  // arguments are a separate field; the sweep mutates it as a PAIR with that test.
  if (cut <= 0 || cut === operation.length - 1) return null;
  const key = operation.slice(0, cut);
  const hash = operation.slice(cut + 1);
  // THE KEY MUST STILL HOLD A POSITION. `a:b` splits into `a` and `b` and is not an
  // identity; the shape is `<seed>:<step>:<index>`, so the key carries two colons of its
  // own. Asked as a shape rather than by counting, so a seed containing a colon is refused
  // rather than silently read as a step.
  if (!/^[^\s:]+:\d+:\d+$/.test(key)) return null;
  if (!/^[0-9a-zA-Z+/=_-]+$/.test(hash)) return null;
  const seed = key.slice(0, key.indexOf(":"));
  return Object.freeze({ key, hash, run: UUID_SHAPE.test(seed) ? seed : null });
}

/** A uuid, for deciding whether an operation's seed is really a run's id. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ⚠ SEVEN STATES, AND EVERY ONE IS A DIFFERENT THING TO DO ABOUT IT.
 *
 *   `approved`  — a person said yes to THESE arguments. Run it.
 *   `rejected`  — a person said no. Do not run it; tell the model, with their words.
 *   `revoked`   — somebody withdrew the request or the permission. Nobody refused the CALL,
 *                 which is why it is not a rejection: the answer is about the authority
 *                 being taken back rather than about the work being unwanted.
 *   `expired`   — nobody answered inside the window. Nothing was decided by anybody, which
 *                 is why it is not a verdict at all and is derived from the clock.
 *   `pending`   — nobody has answered yet. Stop the run and wait; nothing has been spent.
 *   `stale`     — there is a request at this position for DIFFERENT arguments. Fail closed.
 *   `unshowable`— the arguments cannot be put in front of a person at all. Nothing is asked.
 *
 * **`revoked`, `expired` AND `rejected` ARE THREE REFUSALS AND NOT ONE.** A model told "a
 * person declined this" about a request nobody ever saw would report the wrong thing to a
 * customer, and one told "it timed out" about a real refusal would ask again.
 *
 * **AND `unshowable` IS NOT A REFUSAL BY ANYBODY EITHER — it is this platform declining to
 * ASK.** It is the only one of the seven that never reaches the database: see `showableArgs`.
 */
export const APPROVAL_STATES = Object.freeze([
  "approved", "rejected", "revoked", "expired", "pending", "stale", "unshowable",
]);

/**
 * ⚠ **CAN THESE ARGUMENTS BE PUT IN FRONT OF A PERSON — asked BEFORE anything is stored.**
 *
 * **THE DEFECT THIS CLOSES WAS MEASURED, and it is the worst shape available on this path.**
 * `ask` hashed the arguments A MODEL REALLY WROTE and stored `p_args` COALESCED to `{}`, so
 * for `args: "hello"` the row a person was shown held **no arguments** while the hash bound
 * `"hello"` — they approve a call with nothing in it, `matches` is satisfied (it compares the
 * real value both times), and the call runs with `"hello"`. **An approval bound to arguments
 * nobody was ever shown**, which is the one mistake here that cannot be taken back.
 *
 * So the coalescing is gone and this is the wall instead. Two answers:
 *
 *   • **ABSENT IS A REAL ANSWER AND IS `{}`** — `undefined` and `null` are how a model calls
 *     a tool that takes no arguments, and `{}` is an honest drawing of that. **It is not a
 *     coercion, because `argsHash`'s own `?? {}` already hashes both of them as `{}`**, so
 *     the row and the hash agree BY CONSTRUCTION rather than by care. Asserted, not assumed.
 *   • **EVERYTHING ELSE IS REFUSED** — a string, a number, a boolean, an array. None is a
 *     shape any tool's `input_schema` declares, there is no honest way to draw one as a set
 *     of named arguments, and inventing a key for it (`{value: args}`) would label a person's
 *     decision with a field name the tool does not have. *Refuse, never coerce.*
 *
 * **NOTHING IS WRITTEN ON THE REFUSING PATH**, deliberately: a row for a call nobody can be
 * shown would sit on somebody's screen for ever offering a decision they cannot make.
 *
 * **AND A ROW WRITTEN BEFORE THIS IS LEFT TO EXPIRE, which is the honest outcome rather than
 * an oversight.** Such a row holds `{}` with a hash over the real value, so it can never be
 * matched again; the run is answered `arguments-unshowable` and carries on, and the request
 * closes with its own window. Nothing is stranded and nothing is migrated.
 */
export function showableArgs(args) {
  if (args === undefined || args === null) return Object.freeze({ ok: true, args: {} });
  if (typeof args !== "object" || Array.isArray(args)) return Object.freeze({ ok: false, args: null });
  return Object.freeze({ ok: true, args });
}

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
  if (decision?.state === "revoked") {
    // ⚠ NOT A REJECTION. Either the request was withdrawn before anybody answered, or the
    // permission for the tool was taken away — in both cases nobody said the work was
    // unwanted, and a model told "a person declined this" would say so to a customer.
    return { ok: false, error: "revoked",
             say: decision.note
               ? `the authority for this was withdrawn: ${decision.note}`
               : "the authority for this was withdrawn, so nothing was done" };
  }
  if (decision?.state === "expired") {
    // ⚠ NOBODY DECIDED ANYTHING. The window closed, which is a fact about time rather than
    // about anyone's wishes — so the model is told that, and may reasonably ask again at a
    // later step rather than treating it as a refusal of the work.
    return { ok: false, error: "expired",
             say: "nobody answered this in time, so nothing was done — it can be asked again" };
  }
  if (decision?.state === "stale") {
    return { ok: false, error: "arguments-changed",
             say: "the decision on record is about different arguments, so nothing was done — " +
                  "ask again and it will be put to a person afresh" };
  }
  if (decision?.state === "unshowable") {
    // ⚠ NOBODY WAS ASKED, AND THE MODEL IS TOLD THAT RATHER THAN THAT SOMEBODY REFUSED. The
    // remedy is the model's own: send the arguments as an object, which is what the tool's
    // schema asks for. Read as a rejection it would tell a customer a person declined their
    // work; read as "nowhere to ask" it would send somebody to look at a deployment.
    return { ok: false, error: "arguments-unshowable",
             say: "this needs a person's approval and its arguments could not be shown to " +
                  "anybody, so nothing was asked and nothing was done — send them as an " +
                  "object with a name for each value and it will be put to a person" };
  }
  // `unavailable` — there is nowhere to ask. Named rather than folded into a rejection,
  // because "somebody said no" and "nobody could be asked" want opposite things done.
  return { ok: false, error: "no-approver",
           say: "this needs a person's approval and there is nowhere to ask, so nothing was done" };
};

/**
 * WHAT THE MODEL IS TOLD WHEN THE PERMISSION ITSELF WAS TAKEN AWAY — which is a different
 * fact from every state above, and the sentences have to differ or it reads as a rejection.
 *
 * **A REVOCATION IS NOT A DECISION ABOUT A CALL; IT IS A DECISION ABOUT A TOOL.** Nobody
 * looked at these arguments and said no: somebody withdrew the agent's permission to use
 * the tool at all, so every call of it — this one and any later one — is refused for the
 * same reason. `approvalRefusal` cannot say that, because its whole subject is one row
 * somebody was shown.
 *
 * ⚠ **AND ON A RESUME IT MUST NOT CLAIM NOTHING HAPPENED.** A pending call is one whose
 * result was never written, so for a WRITING tool the first attempt may already have
 * landed — and a revocation does not reach back and undo it. *Don't claim completed
 * effects were undone*: the sentence says what is true (we will not run it again) and
 * stops short of what is not (that it never ran).
 */
export const toolRevoked = (name, opts = {}) => {
  const tool = isText(name) ? name : "that tool";
  const may = opts?.mayHaveRun === true;
  return { ok: false, error: "tool-revoked",
           say: may
             ? `the permission to use ${tool} was withdrawn, so it was not run again — ` +
               "whether the earlier attempt took effect is not known from here"
             : `the permission to use ${tool} was withdrawn, so nothing was done` };
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
      method: METHOD,
      headers: {
        apikey: opts.key, authorization: `Bearer ${opts.key}`,
        "content-type": "application/json", accept: "application/json",
        ...profileFor(METHOD, schema),
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
     * ⚠ EVERY RUN WHOSE APPROVAL WINDOWS HAVE ALL CLOSED, PUT BACK ON THE QUEUE.
     *
     * **IT TAKES NO TENANT, AND THAT IS NOT A HOLE IN THE CLOSURE RULE.** The rule is that
     * no OPERATION takes a tenant as an argument, so no model-written value can become
     * authority; this is a PLATFORM SWEEP, exactly like `reclaimable` and the scheduler's
     * tick, and there is no tenant to scope it to because it is about every account at
     * once. It is reachable only from `worker.scheduled`, which no request touches.
     *
     * **WHY IT HAS TO EXIST AT ALL — measured, not reasoned about.** A run waiting for a
     * person has its work row marked DONE, and `decide_tool_approval` is what puts it back.
     * So when nobody answers, nothing does: a redelivery answers `not-claimable` and the
     * run sits for ever reading as `running` with a refusal that is correct and
     * unreachable. The cron is the only thing that runs without anybody pressing anything.
     */
    async expiredApprovals({ limit } = {}) {
      const rows = await call("requeue_expired_approvals", { p_limit: limit ?? null });
      return Array.isArray(rows) ? rows : [];
    },

    /**
     * The account, from the claim. **There is no argument for it anywhere below**, so no
     * model-written value can reach it.
     */
    forTenant(tenant) {
      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string, from the claim");
      return {
        /**
         * WHICH TOOLS THIS AGENT MAY NO LONGER USE, read LIVE and never from the snapshot.
         *
         * ⚠ **THIS IS THE ONE THING ABOUT AN IN-FLIGHT RUN THAT IS DELIBERATELY NOT
         * SNAPSHOTTED, and the asymmetry is the whole design.** A customer un-ticking a
         * tool is a statement about what the agent may do FROM NOW ON, so it reaches the
         * next run and not this one — which is why `agent.agents.tools` is copied into the
         * run's first journal entry and read from there. A REVOCATION is a statement about
         * what must stop, so it has to reach a run already going. Two different acts, two
         * different readers; collapsing them would mean either that an ordinary settings
         * edit silently re-permissions a live run, or that a withdrawal cannot stop one.
         *
         * A run with no authored agent has no revocations to read (there is no row to key
         * on), which is `[]` — the same answer as an agent nobody has revoked anything for.
         * The two are indistinguishable and do not need distinguishing: neither subtracts.
         */
        async revokedTools(agentId) {
          if (!isText(agentId)) return [];
          const rows = await call("revoked_tools", { p_tenant: tenant, p_agent_id: agentId });
          // A SET-RETURNING FUNCTION ANSWERS A LIST OF STRINGS. Anything else is refused
          // rather than coerced — `String(["a"])` is `"a"`, and a malformed answer read as
          // one tool name would revoke the wrong thing.
          return Array.isArray(rows) ? rows.filter((r) => typeof r === "string") : [];
        },

        /**
         * Take one tool away from one agent, now.
         *
         * `by` is the person, from a VERIFIED session at the caller — the database refuses
         * a blank one, for the reason `decide_tool_approval` does: a withdrawal nobody can
         * be tied to is one nobody can be asked about afterwards.
         */
        async revokeTool({ agentId, tool, by, note = null } = {}) {
          return call("revoke_agent_tool", {
            p_tenant: tenant, p_agent_id: agentId, p_tool: tool, p_by: by, p_note: note,
          });
        },

        /** Lift a revocation. It does NOT re-open the requests the revocation withdrew. */
        async restoreTool({ agentId, tool } = {}) {
          return call("restore_agent_tool", { p_tenant: tenant, p_agent_id: agentId, p_tool: tool });
        },

        /**
         * Withdraw ONE waiting request, without deciding it.
         *
         * Separate from `decide_tool_approval` because it is not a verdict: nobody looked at
         * the call and said no, so a model told "a person declined this" would be told a
         * thing that did not happen.
         */
        async revokeApproval({ id, by, note = null } = {}) {
          return call("revoke_tool_approval", {
            p_tenant: tenant, p_id: id, p_by: by, p_note: note,
          });
        },

        /**
         * Stop one run: release its work, clear any wait, withdraw anything waiting for a
         * person, and record how far it got. **Nothing already done is undone**, and the
         * answer says so rather than leaving a caller to infer it.
         */
        async cancelRun({ runId, by, reason = null } = {}) {
          return call("cancel_run", {
            p_tenant: tenant, p_run_id: runId, p_by: by, p_reason: reason,
          });
        },

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
              // ⚠ **ASKED BEFORE ANYTHING IS HASHED OR SENT, so a call nobody could be shown
              // leaves no row at all.** See `showableArgs` for the defect this closes.
              const show = showableArgs(args);
              if (!show.ok) return { state: "unshowable", id: null, tool, hash: null, expiresAt: null };
              // ⚠ **THE HASH AND THE STORED ROW ARE OVER THE SAME VALUE, which is the whole
              // invariant.** They were not: the hash was over what a model wrote and the row
              // carried `{}` whenever that was not a plain object.
              const hash = await argsHash(show.args);
              const answer = await call("request_tool_approval", {
                p_tenant: tenant, p_run_id: runId, p_agent_id: agentId,
                p_step: step, p_idx: index, p_tool: tool,
                p_args: show.args,
                p_hash: hash,
              });
              if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
                throw new Error("request_tool_approval: no answer came back");
              }
              if (answer.ok !== true) throw new Error(`request_tool_approval: ${answer.error ?? "refused"}`);
              // ⚠ THE HASH IS COMPARED BY THE DATABASE, INSIDE THE STATEMENT THAT READ THE
              // ROW. Comparing here would be a second copy of the test over a value that
              // travelled, and the row it has to agree with is the one a person was shown.
              /**
               * ⚠ **THE ROW'S OWN HASH AND ITS OWN WINDOW COME BACK, and both are the
               * DATABASE'S rather than ours.**
               *
               * `hash` is the fingerprint of the request A PERSON WAS SHOWN, so a caller that
               * performs the approved action can use it as that action's identity and be using
               * the same value the approval was bound to. On the `approved` path it equals the
               * hash computed above — `matches` is exactly that statement — so returning the
               * row's rather than ours costs nothing and says something stronger.
               *
               * `expiresAt` is the window, for a caller that has to decide when to come back
               * and look. **It is NOT a second copy of the rule**: nothing outside may compare
               * it to decide whether the request expired, because the verdict above already
               * is that comparison, made where the row was read.
               */
              const whole = (state, extra = {}) => ({
                state, id: answer.id ?? null, tool,
                hash: isText(answer.args_hash) ? answer.args_hash : null,
                expiresAt: isText(answer.expiresAt) ? answer.expiresAt : null,
                ...extra,
              });
              if (answer.matches !== true) return whole("stale");
              if (answer.verdict === "approved") return whole("approved");
              // ⚠ **THE DATABASE NAMES THE STATE AND THIS DOES NOT RE-DERIVE IT.** `expired`
              // is the clock's answer and `revoked` is somebody's act; comparing a timestamp
              // here would be a second copy of the window's rule over a value that travelled,
              // and the two copies would disagree the moment either clock drifted.
              for (const state of ["rejected", "revoked", "expired"]) {
                if (answer.verdict === state) {
                  return whole(state, { note: isText(answer.note) ? answer.note : null });
                }
              }
              return whole("pending");
            },
          });
        },
      };
    },
  };
}
