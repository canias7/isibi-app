/**
 * THE AGENT BUILDER'S STORE, AND ITS AUTHENTICATED SURFACE.
 *
 * The agents screen (`renderAgents` in `public/chat.js`) kept its agents in
 * `localStorage`: gone on another machine, gone when the browser's storage is
 * cleared, and gone to anyone but the person sitting at that keyboard. This is
 * what it reads and writes instead — `agent.agents` and `agent.agent_messages`
 * in Supabase, behind seven operations on one path prefix.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHOSE ROWS THEY ARE IS NEVER THE BROWSER'S TO SAY.
 *
 * `handleAgentApi` takes `tenant` as an argument and the ONLY caller passes
 * `authUser(request).id` — a token GoTrue verified, in this request. No route
 * here reads an account, a tenant, a uid or an owner off the body or the query
 * string, and `readTenant` refuses anything that is not a plain identifier, so
 * a value that could change the MEANING of a filter cannot reach one.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY EVERY QUERY CARRIES ITS OWN TENANT FILTER, WITH RLS ALREADY IN PLACE.
 *
 * Row level security on both tables is keyed on `agent.tenant_id()`, which
 * reads the request's own JWT. That protects the `authenticated` role — a
 * customer reading their own rows directly. It does NOT protect this code:
 * `service_role` carries BYPASSRLS on Supabase, so a query sent with the
 * service key sees every tenant's rows. **So the wall on this path is the
 * `tenant_id=eq.` filter in the URL, and RLS is the belt underneath it.**
 * Saying that out loud matters more than usual, because the two look
 * interchangeable from the outside and only one of them is doing the work
 * here — a query written without the filter would pass every test that only
 * ever signs in as one account.
 *
 * Its consequence is the shape of `update`, `remove` and `ownsAgent`: the
 * tenant goes in the FILTER, not into a check above the statement, so
 * "somebody else's id" and "an id that does not exist" are one answer (no
 * rows) and neither confirms the other's existence.
 *
 * A message carries no tenant of its own — deliberately, the same rule the
 * table follows: a copy there could disagree with the agent it points at, and
 * the disagreeing case is the one where somebody reads another account's
 * conversation. So a message operation asks about its AGENT first, and the
 * foreign key closes the gap between the question and the write: an agent
 * deleted in between makes the insert fail rather than orphan a row.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES NOT DO.
 *
 * It stores what a person wrote and what they typed. It runs nothing. There is
 * no model here, no reply, no tool and no trigger, and `role` is never sent —
 * the column's own `check (role = 'user')` is what makes a reply impossible
 * rather than merely absent. `agent.runs` and `agent.run_entries` (the
 * execution journal, append-only and fenced) are a different half of the
 * schema with no foreign key to this one, and nothing in this file touches
 * them.
 */

// ── the caps ────────────────────────────────────────────────────────────────
//
// EVERY ONE OF THESE IS THE DATABASE'S OWN NUMBER, and `test/agent-api.test.mjs`
// reads them back out of the migration to prove it. A cap here that is LOOSER
// than the column's check constraint turns a refusal we could phrase into a
// Postgres error nobody can act on; one that is tighter for no reason is a
// limit with no stated author.
export const AGENT_NAME_MAX = 200;
export const AGENT_INSTRUCTIONS_MAX = 8000;
export const AGENT_BODY_MAX = 8000;

/** How many agents one account may hold. Not the database's — ours. */
export const MAX_AGENTS = 200;

/**
 * How much of a conversation one read returns.
 *
 * The NEWEST this many, presented oldest-first. Taking the newest and turning
 * them round is the whole of it: a thread read that took the OLDEST 500 would,
 * on a long conversation, show a screen of history with the part somebody is
 * actually in nowhere on it.
 */
export const MAX_THREAD = 500;

/**
 * How many messages one import may carry.
 *
 * `agent.import_agent` refuses past 500; this is 200, because that is
 * `AGENT_THREAD_MAX` in the browser — the cap on the store being imported FROM,
 * so a bigger number here could not describe any real payload. The guard
 * asserts this is at or under the database's ceiling rather than equal to it:
 * the API may be tighter than the store and may never be looser.
 */
export const MAX_IMPORT_MESSAGES = 200;

/**
 * The import's body allowance. 200 messages at `AGENT_BODY_MAX` is 1.6 MB, so
 * this is that plus room for the instructions, the JSON and the multi-byte
 * case. Every other route keeps `readJsonBody`'s ordinary 128 KB.
 */
export const MAX_IMPORT_BODY = 2 * 1024 * 1024;

// ── what an agent may be configured to do ───────────────────────────────────

/**
 * THE TWO STATUSES, AND `active` IS THE ONE A ROW GETS BY DEFAULT.
 *
 * A paused agent keeps its conversation, answers every run already accepted, and
 * refuses to start another. It is NOT a cancellation and nothing here or in the
 * database touches a run in flight — stopping work somebody already asked for
 * would be cancellation wearing a pause's clothes.
 */
export const AGENT_STATUSES = Object.freeze(["active", "paused"]);

/**
 * ⚠ THE TOOL CATALOG — every tool an agent may be given, as the browser is shown
 * them.
 *
 * **IT IS SERVER-CONTROLLED AND A SELECTION IS A LIST OF NAMES.** The browser
 * draws what this says and can never add to it: a name that is not in here is
 * refused at the route, is not stored, and — if it somehow were — resolves to no
 * tool at execution, because the engine looks a name up in its own `OFFERED` array
 * of real `defineTool` results. Three walls, each a positive list.
 *
 * **IT IS A COPY OF THAT ARRAY'S NAMES, DECLARED AS ONE, WITH A CENSUS BOTH WAYS**
 * (`test/agent-send.test.mjs`, which imports `agent-builder/src/agents.mjs` and
 * compares the two name sets). The engine is a separate product that runs in its
 * own Worker; this file may not import it, and there is no arrangement in which one
 * of the two does not hold a copy. A copy with a census both ways is this
 * repository's standard remedy — so a tool added to the engine and not described
 * for customers is a red run, and a tool described here that the engine cannot run
 * is a red run too.
 *
 * **WHAT LIVES HERE AND NOT THERE IS THE WORDS.** The engine's `description` is
 * written for a MODEL to decide whether to call the thing; `label` and `does` are
 * written for a person deciding whether to allow it. They are different jobs and
 * one string cannot do both, so the customer-facing half lives with the
 * customer-facing product.
 *
 * **TODAY IT HOLDS ONE TOOL, AND THAT IS THE HONEST STATE OF IT.** `echo` is
 * implemented, pure, and completes inside an authored run's bounds. `wait` and
 * `commit` are implemented and are deliberately not offered — measured, they cannot
 * finish under those bounds, and a control that always fails is worse than no
 * control. Real integrations are a later milestone.
 */
export const AGENT_TOOLS = Object.freeze([
  Object.freeze({
    name: "echo",
    label: "Echo",
    does: "Repeats a short piece of text back. It is here so you can see that tools work at all — it reads nothing, changes nothing and sends nothing.",
  }),
]);

/** The catalog's names, DERIVED, so nothing holds a second copy of the list. */
export const AGENT_TOOL_NAMES = Object.freeze(AGENT_TOOLS.map((t) => t.name));

/**
 * How many tools one agent may be given.
 *
 * It is the COLUMN'S OWN CHECK CONSTRAINT (`agents_tools_shape`), which the guard
 * reads back out of the migration — the same rule the three text caps above follow.
 * A cap here that is looser than the column's turns a refusal we could phrase into
 * a Postgres error nobody can act on.
 *
 * It is deliberately NOT `AGENT_TOOLS.length`. The catalog is what may be chosen
 * FROM; this is what a stored row may hold, and a row written against last month's
 * larger catalog must not become unsaveable because we retired something.
 */
export const MAX_AGENT_TOOLS = 32;

/**
 * A status, or `null`.
 *
 * REFUSED RATHER THAN DEFAULTED. An unreadable status is a caller bug, and reading
 * it as `active` would mean a typo silently un-pausing an agent somebody paused on
 * purpose. `null` is what every caller below turns into a named refusal.
 */
export function cleanStatus(v) {
  return typeof v === "string" && AGENT_STATUSES.includes(v.trim()) ? v.trim() : null;
}

/**
 * A tool selection, as `{names, unknown}`.
 *
 * **A POSITIVE INTERSECTION WITH THE CATALOG, never a filter against a deny-list.**
 * The input is caller-supplied, so a deny-list would be a claim about the producer
 * rather than about the input.
 *
 * `unknown` COMES BACK BY NAME, because a filter is a silent drop and a check is a
 * sentence: the route refuses on it rather than quietly storing less than was
 * asked for, which is the one way a tool permission could appear to be granted and
 * not be.
 *
 * ORDER IS THE CATALOG'S, and duplicates collapse. So what is stored is a set in a
 * stable order however the browser sent it — which is what makes two saves of the
 * same selection byte-identical rather than merely equivalent.
 *
 * REFUSED RATHER THAN COERCED on the way in: a non-array is `null` for `names`,
 * which the route turns into a refusal, because `["echo"]` and `"echo"` are a list
 * and a string and guessing between them is how a selection of one becomes a
 * selection of five letters.
 */
export function cleanTools(v, catalog = AGENT_TOOL_NAMES) {
  if (!Array.isArray(v)) return { names: null, unknown: [] };
  if (v.length > MAX_AGENT_TOOLS) return { names: null, unknown: [], tooMany: true };
  // Strings only. A caller-supplied array can hold anything, and `["constructor"]`
  // or a number must not match a catalog entry.
  const want = new Set(v.filter((n) => typeof n === "string").map((n) => n.trim()));
  // ⚠ THE CATALOG IS A PARAMETER SO THE ORDER RULE CAN BE DRIVEN AT ALL. With one
  // tool on the platform, taking the caller's order and taking the catalog's produce
  // the same list — measured, by a sweep mutant that survived every case here. A wall
  // nobody can drive is a wall nobody is guarding, and this one starts mattering the
  // day a second tool ships rather than the day somebody writes a case for it. Every
  // caller uses the default.
  const names = catalog.filter((n) => want.has(n));
  const unknown = [...want].filter((n) => !catalog.includes(n));
  // A non-string among them cannot be quoted back by name, so it is reported as
  // unreadable rather than as an unknown tool — and it still refuses, which is what
  // matters. Two different sentences for two different caller bugs.
  return { names, unknown, unreadable: v.some((n) => typeof n !== "string") };
}

/** The schema PostgREST is told to use, per request, on every call. */
export const AGENT_SCHEMA = "agent";

// ── reading what arrived ────────────────────────────────────────────────────

/**
 * A text field, trimmed, or `null`.
 *
 * REFUSES A NON-STRING RATHER THAN COERCING IT. `String(["a"])` is `"a"`, so a
 * caller sending `{name: ["a"]}` would otherwise store an agent called `a` —
 * shipped as a real bug three times in this repository. A number, an object, a
 * boolean and an array are all `null` here, and `null` is the one thing every
 * caller below turns into a named refusal.
 */
export function cleanText(v, max) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

/**
 * An id, or `null`. A uuid and nothing else.
 *
 * It goes into a PostgREST filter, so the charset is the wall: no comma, no
 * dot, no parenthesis and no quote can reach `id=eq.<x>` to mean something
 * there. Both writers of an id here are `crypto.randomUUID`, so nothing
 * legitimate is turned away by being this strict.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cleanId(v) {
  return typeof v === "string" && UUID.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/**
 * The tenant, or `null`.
 *
 * It arrives from `authUser` and is a Supabase user id, so in practice a uuid —
 * but this is deliberately a CHARSET rather than the uuid test above, because
 * the one thing that must never happen is this refusing a legitimate account
 * id and locking somebody out of their own agents. What it has to guarantee is
 * narrower than "is a uuid": that no character in it can change what
 * `tenant_id=eq.<t>` selects.
 */
const TENANT_OK = /^[A-Za-z0-9_.:@+-]{1,200}$/;
export function readTenant(v) {
  return typeof v === "string" && TENANT_OK.test(v) ? v : null;
}

/**
 * The import's identity: the BROWSER'S OWN RECORD ID for the agent being
 * brought over, or `null`.
 *
 * **NOT `cleanId`, and the difference is a real one.** That is uuid-only, and a
 * legacy local record may carry `String(Date.now()) + Math.random().toString(16)`
 * — the fallback the screen used where `crypto.randomUUID` was missing. Rejecting
 * those would leave exactly the oldest records, the ones most worth preserving,
 * unable to be imported safely. This is the same conservative charset the tenant
 * uses: enough to be certain it cannot mean anything but itself, wide enough for
 * every id the screen has ever minted.
 *
 * It never reaches a URL — it rides in the RPC's JSON body and lands in a `text`
 * column — so the bound here is about size and sanity rather than injection.
 */
export function cleanImportKey(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && TENANT_OK.test(t) ? t : null;
}

/**
 * THE BROWSER'S OWN KEY FOR ONE PRESS, or `null`.
 *
 * A double click and a lost response are the same event from the browser, and both
 * must produce ONE message and ONE run. The key is what tells a retry from a new
 * message, and `agent.agent_messages` holds `(agent_id, send_key)` unique — so the
 * absorbing is the index's, never a read-then-insert.
 *
 * **DELIBERATELY THE SAME CHARSET AS `cleanImportKey` AND NOT `cleanId`.** Both are
 * ids a BROWSER minted, and a browser without `crypto.randomUUID` falls back to
 * `String(Date.now()) + Math.random().toString(16)` — which is not a uuid and is a
 * perfectly good key. Refusing it would turn retry safety off for exactly the
 * browsers least likely to have a reliable connection. It never reaches a URL (it
 * rides in the RPC's JSON body into a `text` column), so what this has to
 * guarantee is size and sanity rather than injection.
 */
export function cleanSendKey(v) {
  return cleanImportKey(v);
}

/**
 * A message's own time, as an ISO string, or `null` for "use now()".
 *
 * ONLY THE IMPORT SENDS ONE, and it is display metadata: `seq` orders a thread,
 * assigned by the database, so a wrong time here cannot reorder anything. What
 * it is bounded against is the two ways it could be nonsense — a date before
 * this platform existed, and one in the future, which would sit a message at
 * the top of a list for ever. A minute of slack for a browser clock that is
 * slightly ahead; anything outside reads as absent rather than as a refusal,
 * because losing a message's time is worth far less than losing the message.
 */
const AT_FLOOR = Date.UTC(2020, 0, 1);
export function cleanAt(v, now = Date.now()) {
  const ms = typeof v === "number" ? v : NaN;
  if (!Number.isFinite(ms) || ms < AT_FLOOR || ms > now + 60_000) return null;
  return new Date(ms).toISOString();
}

// ── what goes on the wire ───────────────────────────────────────────────────

/** ISO out of Postgres, epoch milliseconds in, because `agentWhen` takes ms. */
const ms = (iso) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? t : 0;
};

/**
 * One agent, in the shape the agents list already draws.
 *
 * `created`/`updated` and a `preview` line, matching the local record field for
 * field, so the screen's own `agentWhen` and row markup need no second reader.
 * **`preview` is `""` when nothing has been said** — the view answers SQL NULL
 * there, and the browser's `agentPreview` falls back to the instructions, which
 * is a correct rendering rather than a blank row.
 */
export function agentRow(r) {
  return {
    id: String(r && r.id || ""),
    name: String(r && r.name || ""),
    instructions: String(r && r.instructions || ""),
    created: ms(r && r.created_at),
    updated: ms(r && r.updated_at),
    preview: typeof (r && r.last_message) === "string" ? r.last_message : "",
    // ── the settings half ────────────────────────────────────────────────
    //
    // **FAILS CLOSED, BOTH OF THEM, and neither default is arbitrary.** A status
    // this cannot read is `paused`: the cost of being wrong that way is somebody
    // pressing Resume, and the cost of the other way is an agent taking work its
    // owner stopped. A selection it cannot read is EMPTY, for the same reason the
    // engine reads an absent tool snapshot as none.
    //
    // It is not defensiveness for its own sake: this row comes back from
    // PostgREST, so an older Worker, a view missing a column or a migration not
    // yet applied all arrive here as `undefined`.
    status: cleanStatus(r && r.status) === "active" ? "active" : "paused",
    tools: Array.isArray(r && r.tools) ? r.tools.filter((t) => typeof t === "string") : [],
  };
}

/**
 * THE ONE MODEL THAT IS NOT A MODEL.
 *
 * `agent.runs.model` records what a run really executed under, projected off its
 * own log — so whether an answer is simulated is a fact about THAT RUN rather than
 * a fact about the product today. That is what makes the label replaceable: connect
 * a real provider and the runs that used it are not labelled, with no change here.
 *
 * It is a copy of the engine's stand-in model name, and
 * `agent-builder/test/authored-run.test.mjs` censuses it against the registry —
 * so the day `AUTHORED`'s model changes, that suite goes red and whoever changes it
 * has to decide what the label should do. A label derived from a CONSTANT would
 * quietly keep saying "simulated" over a real answer, and one sniffed out of the
 * text would stop the day the text is reworded.
 */
export const STANDIN_MODEL = "stand-in";

/**
 * The four states a conversation can show, and they are a PARTITION.
 *
 * `queued` — accepted, nothing has happened yet. `working` — it has taken at least
 * one step. `answered` — it stopped with something to show. `failed` — it stopped
 * without. Every run is exactly one of them, so the screen needs no fifth branch
 * and no "unknown" that reads as a blank bubble.
 */
export const RUN_STATES = Object.freeze(["queued", "working", "answered", "failed"]);

/**
 * What a message's run looks like on the wire, or `null` if it started none.
 *
 * **`null` IS A REAL ANSWER AND IS NOT A FAILURE.** Every imported conversation is
 * that shape, and so is a message whose run was retained away — the run's record is
 * gone, the writing is not. A screen that drew "failed" there would tell somebody
 * their message broke when nothing did.
 *
 * ⚠ **QUEUED AND WORKING ARE TOLD APART BY THE STEP, NOT BY THE STATUS.**
 * `agent.runs.status` is projected off the log and the accepting transaction writes
 * the `started` entry, so a run reads `running` from the instant it is queued —
 * measured on a real PostgreSQL, after an expectation written the other way round.
 * The queue's own row would say it directly and is deliberately unreadable from
 * here: `authenticated` holds nothing on `agent.run_work`, so a view reaching it
 * would answer NULL for every customer and read as a run that never started.
 */
export function runView(r) {
  const id = cleanId(r && r.run_id);
  if (!id) return null;
  const stop = r && r.run_stop && typeof r.run_stop === "object" && !Array.isArray(r.run_stop) ? r.run_stop : null;
  const step = Number.isInteger(r && r.run_step) && r.run_step > 0 ? r.run_step : 0;
  // The model that really answered, so the label is about this run.
  const simulated = (r && r.run_model) === STANDIN_MODEL;
  const at = ms(r && r.run_stopped_at);
  if (r.run_status !== "stopped") {
    return { id, state: step > 0 ? "working" : "queued", step, simulated, text: "", why: "", at: 0 };
  }
  if (stop && stop.reason === "answered") {
    // The text is whatever the run produced. It is NOT trimmed, coerced or
    // defaulted to a sentence of ours: an answered run with an empty answer is a
    // thing that happened, and inventing words for it would be the dead control
    // that ANSWERS, wrongly.
    return { id, state: "answered", step, simulated, text: typeof stop.text === "string" ? stop.text : "", why: "", at };
  }
  // STOPPED WITHOUT AN ANSWER. `why` is the engine's own reason — `spent`,
  // `call-failed`, `unmeasured` — and `"unknown"` where there is no stop to read,
  // which is a cannot-tell said out loud rather than an empty string that reads
  // like a reason nobody wrote down.
  const why = stop && typeof stop.reason === "string" && stop.reason ? stop.reason : "unknown";
  return { id, state: "failed", step, simulated, text: "", why, at };
}

/**
 * One message, in the shape the thread already draws.
 *
 * `text`, not `body` — the screen reads `m.text`, and renaming a field on the
 * wire to match the column would be a second vocabulary for one thing. No
 * `role`: every row here is the person's, by the column's own constraint, and a
 * role on the wire would be the first half of a reply the product does not have.
 */
export function messageRow(r) {
  return { id: String(r && r.id || ""), text: String(r && r.body || ""), at: ms(r && r.created_at) };
}

/**
 * One message AND the state of the run it started.
 *
 * `messageRow` plus `run`, so the screen has one row per message and never has to
 * line two lists up — which is the second place a message could end up wearing
 * another run's outcome.
 */
export function threadRow(r) {
  return { ...messageRow(r), run: runView(r) };
}

// ── the store ───────────────────────────────────────────────────────────────

/**
 * A failure that names itself.
 *
 * Every refusal from PostgREST arrives with a status and, usually, Postgres's
 * own words. "Couldn't save" with nothing after it is the shape that costs an
 * afternoon, so the status rides on the error and the server's message rides in
 * `detail` — where the ROUTE decides whether the customer sees it. They do not:
 * the sentences below are ours. `detail` is for the log.
 */
function storeFail(what, r) {
  const why = (r && r.body && r.body.message) || (r && r.text) || "";
  const e = new Error(`${what}: HTTP ${r && r.status}${why ? ` — ${why}` : ""}`);
  e.status = (r && r.status) || 0;
  e.detail = why;
  return e;
}

/**
 * The seven operations, over PostgREST.
 *
 * `fetch` and `key` are INJECTED so every one of them can be driven outside a
 * Worker. `key` is the service key and never leaves this process: it goes into
 * a request header and into nothing else — no log line, no response body, no
 * error message this module composes.
 */
export function makeAgentStore({ fetch: doFetch, url, key, schema = AGENT_SCHEMA } = {}) {
  if (typeof doFetch !== "function") throw new TypeError("makeAgentStore: fetch must be a function");
  if (typeof url !== "string" || !url.trim()) throw new TypeError("makeAgentStore: url must be a non-empty string");
  if (typeof key !== "string" || !key.trim()) throw new TypeError("makeAgentStore: key must be a non-empty string");
  const base = url.replace(/\/+$/, "");

  // The schema is not `public`, so PostgREST is told which one PER REQUEST, and
  // the header differs by direction: `content-profile` for a write,
  // `accept-profile` for a read. Sending the wrong one is a request answered
  // against `public`, where none of these relations exist.
  //
  // **DERIVED FROM THE VERB, NOT FROM A FLAG THE CALLER PASSES.** It was an
  // option on `req`, and `remove` omitted it — so the DELETE went out with
  // `Accept-Profile`, which PostgREST IGNORES on a write. That delete resolved
  // against `public` and could never have worked, and the guard written for it
  // asserted the broken header as correct, reasoning that a DELETE has no body
  // and therefore nothing to profile. **The profile names the RELATION, not a
  // body**: every verb that changes something takes `Content-Profile`, body or
  // no body. An option each call site has to remember is one a call site will
  // eventually forget, so there is nothing left to pass.
  const WRITE_VERBS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
  const headers = (method) => ({
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    [WRITE_VERBS.has(method) ? "content-profile" : "accept-profile"]: schema,
  });

  async function req(method, path, { body, prefer } = {}) {
    const h = headers(method);
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...h, prefer } : h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    return { ok: !!res.ok, status: res.status, body: parsed, text };
  }

  const rows = (r) => (Array.isArray(r.body) ? r.body : []);
  const t = (tenant) => encodeURIComponent(tenant);

  /**
   * The object a transaction answered with.
   *
   * **AN ANSWER THAT IS NOT AN OBJECT IS A FAILURE, never an empty success.** PostgREST
   * hands back whatever the function returned, and reading `undefined.ok` as "not ok"
   * would turn a broken deployment into a plausible refusal sentence.
   */
  const answerOf = (r, what) => {
    const a = r.body;
    if (!a || typeof a !== "object" || Array.isArray(a)) {
      throw storeFail(what, { status: r.status, text: "no answer came back" });
    }
    return a;
  };

  return {
    /** Every agent of one account, newest first, off the overview view. */
    async list(tenant) {
      const r = await req("GET",
        `agent_overview?tenant_id=eq.${t(tenant)}` +
        `&select=id,name,instructions,created_at,updated_at,last_message,status,tools` +
        `&order=updated_at.desc&limit=${MAX_AGENTS}`);
      if (!r.ok) throw storeFail("list agents", r);
      return rows(r).map(agentRow);
    },

    /**
     * How many this account holds. Ids only, and one past the ceiling, so the
     * answer the caller needs costs a few hundred bytes rather than every
     * instruction they have ever written.
     */
    async count(tenant) {
      const r = await req("GET", `agents?tenant_id=eq.${t(tenant)}&select=id&limit=${MAX_AGENTS + 1}`);
      if (!r.ok) throw storeFail("count agents", r);
      return rows(r).length;
    },

    /**
     * Does this account own this agent?
     *
     * The tenant is in the filter, so a stranger's id and a nonexistent id are
     * one answer. Its callers turn that into the same 404, which is what keeps
     * this from confirming that somebody else's agent exists.
     */
    async ownsAgent(tenant, id) {
      const r = await req("GET", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}&select=id&limit=1`);
      if (!r.ok) throw storeFail("read agent", r);
      return rows(r).length === 1;
    },

    /**
     * THE ID IS OURS, never the caller's: a client cannot choose a primary key.
     *
     * **A FIELD THE CALLER DID NOT NAME IS NOT SENT, and for `status` that is the
     * whole of "default to active only when it is omitted".** The column's own
     * default is `active`; writing `"active"` here when nobody asked would be a
     * second copy of that default in a second language, and the copy that drifts is
     * the one a migration cannot move. So `undefined` means the key stays off the
     * wire and the database decides — exactly as `tools` already works.
     */
    async create(tenant, { id, name, instructions, status, tools }) {
      // `fresh`, not `row`: the answer's own row is already called that eight lines
      // down, and a second `const row` in this scope is a module that does not load.
      const fresh = { id, tenant_id: tenant, name, instructions };
      if (status !== undefined) fresh.status = status;
      if (tools !== undefined) fresh.tools = tools;
      const r = await req("POST", "agents", {
        prefer: "return=representation",
        body: [fresh],
      });
      if (!r.ok) throw storeFail("create agent", r);
      const row = rows(r)[0];
      if (!row) throw storeFail("create agent", { status: r.status, text: "the row did not come back" });
      return agentRow(row);
    },

    /**
     * Zero rows back means "not this account's", and the caller answers 404.
     *
     * **A FIELD THE CALLER DID NOT SEND IS LEFT AS IT IS, which is what makes this a
     * PATCH rather than a replace.** `status` and `tools` arrived after this route
     * did, so a browser tab opened before today saves a name and an instruction and
     * says nothing about either — and filling them in from a default would
     * un-pause an agent somebody paused, from a screen that never showed a pause
     * control. Absent and empty are two different things and only the caller knows
     * which it meant: `tools: []` is a real selection, `undefined` is silence.
     */
    async update(tenant, id, { name, instructions, status, tools }) {
      const body = { name, instructions };
      // ⚠ THE GUARDS ARE NOT WHAT KEEPS AN UNNAMED FIELD OFF THE WIRE, and saying so
      // is the point: `JSON.stringify` OMITS a key whose value is `undefined`, so
      // assigning unconditionally sends exactly the same bytes. MEASURED, after a sweep
      // mutant that dropped the `tools` guard survived every case here.
      // What the guards really buy is that the body says what it means in THIS process
      // — a logged or inspected body has the key only when the caller named it — and
      // what matters on the wire is that neither field is ever DEFAULTED here. That is
      // the observable property and it is what the mutants aim at now.
      if (status !== undefined) body.status = status;
      if (tools !== undefined) body.tools = tools;
      const r = await req("PATCH", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
        body,
      });
      if (!r.ok) throw storeFail("update agent", r);
      return rows(r).length === 1 ? agentRow(rows(r)[0]) : null;
    },

    /** The messages go with it, by the foreign key's own `on delete cascade`. */
    async remove(tenant, id) {
      const r = await req("DELETE", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
      });
      if (!r.ok) throw storeFail("delete agent", r);
      return rows(r).length === 1;
    },

    /**
     * One thread. THE NEWEST `MAX_THREAD`, TURNED ROUND.
     *
     * `order=seq.desc&limit=N` then reverse, because a thread is read at its
     * live end; ordering ascending with a limit would pin a long conversation
     * to its oldest screen for ever.
     */
    async messages(agentId) {
      // OFF `agent.agent_thread`, WHICH IS A VIEW AND NOT AN EMBED. The messages
      // table has a foreign key to `agent.runs` now, so `select=…,runs(status,stop)`
      // would work with no migration — and could only ever be asserted from
      // documentation, because nothing in this repository can run PostgREST. A view
      // is plain SQL and the schema check drives it on a real PostgreSQL.
      const r = await req("GET",
        `agent_thread?agent_id=eq.${agentId}` +
        `&select=id,body,created_at,seq,run_id,run_status,run_stop,run_step,run_model,run_stopped_at` +
        `&order=seq.desc&limit=${MAX_THREAD}`);
      if (!r.ok) throw storeFail("read messages", r);
      return rows(r).map(threadRow).reverse();
    },

    /** NO `role` IS SENT. The column's default and its check decide. */
    async addMessage(agentId, { id, body, at }) {
      const row = { id, agent_id: agentId, body };
      if (at) row.created_at = at;
      const r = await req("POST", "agent_messages", {
        prefer: "return=representation",
        body: [row],
      });
      if (!r.ok) throw storeFail("save message", r);
      const got = rows(r)[0];
      if (!got) throw storeFail("save message", { status: r.status, text: "the row did not come back" });
      return messageRow(got);
    },

    /**
     * SAVE A MESSAGE AND START A RUN FOR IT, IN ONE TRANSACTION.
     *
     * **EVERY ARGUMENT IS AN ID OR THE WORDS SOMEBODY TYPED.** There is no entry,
     * no model, no bound, no instruction and no history among them — the function
     * takes six arguments and not one of them is structured, which is asserted by
     * the schema check against the catalog. So the run's shape and the snapshot it
     * is started with are the database's, and a bug in this process cannot widen a
     * limit or rewrite an instruction even by accident.
     *
     * **THE IDS ARE OURS, never the caller's.** A browser choosing a run id could
     * name somebody else's run; it supplies only `key`, which is scoped to the
     * agent and decides nothing but whether this press is a retry.
     *
     * **A REPEAT IS A SUCCESS.** It answers the message that already landed and the
     * run it already started, and starts nothing — the whole point of the key.
     */
    async send(tenant, { agentId, messageId, runId, body, key }) {
      const r = await req("POST", "rpc/send_to_agent", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_message_id: messageId,
          p_body: body, p_send_key: key, p_run_id: runId,
        },
      });
      if (!r.ok) throw storeFail("send to agent", r);
      const a = r.body;
      if (!a || typeof a !== "object" || Array.isArray(a)) {
        throw storeFail("send to agent", { status: r.status, text: "no answer came back" });
      }
      return a;
    },

    // ═══════════════════════════════════════════════════════════════════
    // AUTOMATIONS
    // ═══════════════════════════════════════════════════════════════════

    /** Every automation of one agent, newest-changed first. */
    async listAutomations(tenant, agentId) {
      const r = await req("GET",
        `automations?tenant_id=eq.${t(tenant)}&agent_id=eq.${agentId}` +
        `&select=id,agent_id,name,enabled,schedule,at_local,zone,steps,next_run_at,updated_at` +
        `&order=updated_at.desc&limit=${MAX_AUTOMATIONS}`);
      if (!r.ok) throw storeFail("list automations", r);
      return rows(r).map(automationRow);
    },

    /**
     * Does this account own this automation?
     *
     * The tenant is in the filter, so a stranger's id and an id that does not exist are
     * one answer — which is what keeps this from confirming that somebody else's
     * automation is real.
     */
    async ownsAutomation(tenant, id) {
      const r = await req("GET", `automations?id=eq.${id}&tenant_id=eq.${t(tenant)}&select=id&limit=1`);
      if (!r.ok) throw storeFail("read automation", r);
      return rows(r).length === 1;
    },

    /**
     * Make one.
     *
     * **THE ID IS OURS AND THE ARITHMETIC IS THE DATABASE'S.** A daily schedule's next
     * instant is computed by `agent.automation_next_at`, which is the only thing in this
     * system that owns a time zone database — working it out here would be a second copy
     * of it, in a language whose answer would then decide when somebody's work runs.
     */
    async createAutomation(tenant, { agentId, id, name, enabled, schedule, at, zone, steps }) {
      const r = await req("POST", "rpc/create_automation", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name,
          p_enabled: enabled, p_schedule: schedule, p_at_local: at, p_zone: zone,
          p_steps: steps, p_max: MAX_AUTOMATIONS,
        },
      });
      if (!r.ok) throw storeFail("create automation", r);
      return answerOf(r, "create automation");
    },

    /** Change one. A replace of its settings, and the form always sends all of them. */
    async updateAutomation(tenant, { id, name, enabled, schedule, at, zone, steps }) {
      const r = await req("POST", "rpc/update_automation", {
        body: {
          p_tenant: tenant, p_id: id, p_name: name, p_enabled: enabled,
          p_schedule: schedule, p_at_local: at, p_zone: zone, p_steps: steps,
        },
      });
      if (!r.ok) throw storeFail("update automation", r);
      return answerOf(r, "update automation");
    },

    /**
     * Turn one on or off, and NOTHING ELSE.
     *
     * **ITS OWN NARROW WRITE, deliberately.** The toggle is the one change that must not
     * carry a whole configuration with it: sending the form's other fields from a list
     * row would mean a stale tab quietly restoring an old schedule as the price of
     * pressing a switch.
     */
    async setAutomationEnabled(tenant, id, enabled) {
      const r = await req("PATCH", `automations?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
        body: { enabled },
      });
      if (!r.ok) throw storeFail("enable automation", r);
      return rows(r).length === 1 ? automationRow(rows(r)[0]) : null;
    },

    /** The executions go with it, by the foreign key's own `on delete cascade`. */
    async removeAutomation(tenant, id) {
      const r = await req("DELETE", `automations?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
      });
      if (!r.ok) throw storeFail("delete automation", r);
      return rows(r).length === 1;
    },

    /**
     * START ONE NOW — the same transaction the schedule uses, with `manual` as the
     * trigger and no occurrence.
     *
     * **EVERY ARGUMENT IS AN ID.** There is no workflow, no step and no bound among
     * them: what this execution runs is read from the automation's own row inside the
     * transaction, so a bug in this process cannot change what somebody's automation
     * does even by accident.
     */
    async runAutomation(tenant, { automationId, runId }) {
      const r = await req("POST", "rpc/accept_automation_run", {
        body: {
          p_tenant: tenant, p_automation_id: automationId, p_run_id: runId,
          p_trigger: "manual", p_occurrence: null,
        },
      });
      if (!r.ok) throw storeFail("run automation", r);
      return answerOf(r, "run automation");
    },

    /**
     * One automation's history, newest first.
     *
     * OFF `agent.automation_history`, which is a VIEW: the execution's own record joined
     * to its run's projected status and stop. The status lives in exactly one place and
     * this is the only reader that needs both halves.
     */
    async executions(tenant, automationId, limit = MAX_EXECUTIONS) {
      const r = await req("GET",
        `automation_history?tenant_id=eq.${t(tenant)}&automation_id=eq.${automationId}` +
        `&select=id,automation_id,trigger,occurrence,steps,outcomes,missed,created_at,finished_at,` +
        `run_status,run_stop&order=created_at.desc&limit=${Number(limit) || MAX_EXECUTIONS}`);
      if (!r.ok) throw storeFail("read executions", r);
      return rows(r).map(executionRow);
    },

    /**
     * One agent and its whole conversation, in one transaction, ONCE.
     *
     * Two different guarantees and the second was missing until 2026-09-15.
     * ATOMIC: it either happened or it did not, so a failure cannot leave half
     * an agent behind. IDEMPOTENT: `key` is the browser's own record id and the
     * database holds `(tenant_id, import_key)` unique, so a press whose ANSWER
     * was lost can be pressed again and gets the same agent back with its
     * conversation unchanged. Atomicity alone left that second press making a
     * second agent, which nothing afterwards could tell from a real one.
     */
    async importOne(tenant, { name, instructions, messages, key }) {
      const r = await req("POST", "rpc/import_agent", {
        body: {
          p_tenant: tenant, p_name: name, p_instructions: instructions,
          p_messages: messages, p_import_key: key,
        },
      });
      if (!r.ok) throw storeFail("import agent", r);
      const id = typeof r.body === "string" ? r.body : null;
      if (!cleanId(id)) throw storeFail("import agent", { status: r.status, text: "no id came back" });
      return id;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIONS — a trigger, a condition, an action, a saved result
// ═══════════════════════════════════════════════════════════════════════════

/** How many automations one agent may hold. The create function's own ceiling. */
export const MAX_AUTOMATIONS = 20;

/** How long an automation's name may be — the column's own check constraint. */
export const AUTOMATION_NAME_MAX = 200;

/** How many steps one workflow may hold — the column's own check constraint. */
export const MAX_AUTOMATION_STEPS = 20;

/** How long a note may be — the engine's own `MAX_NOTE`, censused against it. */
export const MAX_STEP_NOTE = 2000;

/**
 * How many executions one history read carries.
 *
 * Newest first and bounded, because a daily automation left alone for a year holds 365
 * of them and a screen showing one automation does not need all of them to say what it
 * has been doing.
 */
export const MAX_EXECUTIONS = 50;

/** How a trigger starts. `manual` is Run now only; `daily` also fires once a day. */
export const AUTOMATION_SCHEDULES = Object.freeze(["manual", "daily"]);

/** Sunday first, because that is the order every weekday index in this tree uses. */
export const AUTOMATION_DAYS = Object.freeze(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

/**
 * ⚠ THE STEP CATALOG — every kind of step a workflow may hold, as the browser is
 * shown them.
 *
 * **A COPY OF THE ENGINE'S `AUTOMATION_STEPS`, DECLARED AS ONE, CENSUSED BOTH WAYS**
 * (`test/agent-send.test.mjs`, the one file that may import both products). The engine
 * runs in its own Worker and this file may not import it — `worker.js`'s module graph is
 * a container image input, so importing the agent product would pull the whole of it
 * into the image. A copy with a census both ways is this repository's standard remedy,
 * and it is the same arrangement `AGENT_TOOLS` already has.
 *
 * **WHAT IS COPIED IS A DECLARATION, NOT A RULE.** `fields` says what a step is
 * configured WITH, which is what the form needs to draw and what the validator below
 * needs to read; what each value MEANS is the engine's `read`, and it stays the
 * authority — this refuses a note with no text, and the engine refuses it again at run
 * time because the row came back from a database.
 *
 * **THE WORDS ARE THE SAME ON BOTH SIDES HERE, unlike the tool catalog's**, because a
 * step's `label` and `does` were written for a person on both sides. They are censused
 * too, so a step described one way in the engine and another way on screen is a red run.
 */
export const AUTOMATION_STEPS = Object.freeze([
  Object.freeze({
    type: "weekday",
    kind: "condition",
    label: "Only on certain days",
    does: "Carry on only on the days you pick. On any other day the rest of the workflow is skipped.",
    fields: Object.freeze([Object.freeze({ name: "days", kind: "days", required: true })]),
  }),
  Object.freeze({
    type: "note",
    kind: "action",
    label: "Save a note",
    does: "Write a line into this automation's results, so the run has something to show.",
    fields: Object.freeze([Object.freeze({ name: "text", kind: "text", required: true, max: MAX_STEP_NOTE })]),
  }),
]);

/** The catalog's type names, DERIVED, so nothing holds a second copy of the list. */
export const AUTOMATION_STEP_TYPES = Object.freeze(AUTOMATION_STEPS.map((s) => s.type));

/**
 * A stored workflow, or a named refusal.
 *
 * **ONE VALIDATOR OVER THE DECLARED FIELDS, rather than one per type.** A step type is
 * a `type` and a list of fields, so the rules are about FIELD KINDS — and adding a
 * fourth step type is adding it to the catalog rather than adding a branch here.
 *
 * **IT REFUSES RATHER THAN SHORTENING, and it names the step by position.** A workflow
 * quietly missing the step it could not read is one that looks saved and does something
 * else; "step 2" is what a person can act on, because that is how the form numbers them.
 *
 * **THE ID IS MINTED FROM THE POSITION AND NEVER TAKEN FROM THE CALLER** — the same rule
 * the engine's reader follows, so an outcome's `id` names the same step on both sides.
 */
export function cleanWorkflow(v, catalog = AUTOMATION_STEPS, max = MAX_AUTOMATION_STEPS) {
  if (!Array.isArray(v)) return { error: "the steps have to arrive as a list" };
  if (v.length > max) return { error: `that's more steps than one automation can hold (${max})` };
  const byType = new Map(catalog.map((s) => [s.type, s]));
  const steps = [];
  for (let i = 0; i < v.length; i++) {
    const at = i + 1;
    const raw = v[i];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: `step ${at} didn't arrive as a step` };
    }
    const def = byType.get(typeof raw.type === "string" ? raw.type : "");
    if (!def) return { error: `step ${at}: this platform has no step called ${String(raw.type ?? "(nothing)")}` };
    const one = { id: `s${at}`, type: def.type };
    for (const f of def.fields) {
      const got = readStepField(raw[f.name], f);
      if (got.error) return { error: `step ${at}: ${got.error}` };
      // A FIELD THE CALLER DID NOT NAME IS NOT SENT. `required` is what decides whether
      // that is a refusal; an optional one absent simply is not stored.
      if (got.value !== undefined) one[f.name] = got.value;
    }
    steps.push(one);
  }
  return { steps };
}

/**
 * One field of one step.
 *
 * **REFUSED, NEVER COERCED.** `String(["mon"])` is `"mon"`, so a coercing reader turns a
 * nested list into a day and nothing complains — and `Boolean("false")` is `true`. Every
 * kind below asks the type first.
 */
function readStepField(raw, f) {
  if (f.kind === "text") {
    if (raw === undefined || raw === null) {
      return f.required ? { error: `${f.name} can't be empty` } : { value: undefined };
    }
    if (typeof raw !== "string") return { error: `${f.name} didn't arrive as text` };
    const text = raw.trim();
    if (!text) return f.required ? { error: `${f.name} can't be empty` } : { value: undefined };
    if (f.max && text.length > f.max) return { error: `${f.name} is longer than it can be (${f.max} characters)` };
    return { value: text };
  }
  if (f.kind === "days") {
    if (!Array.isArray(raw)) return { error: "pick which days it should run on" };
    if (!raw.length) return { error: "pick at least one day, or take this step out" };
    const picked = [];
    for (const d of raw) {
      if (typeof d !== "string") return { error: "one of the days didn't arrive as a day" };
      const name = d.trim().toLowerCase();
      if (!AUTOMATION_DAYS.includes(name)) return { error: `there is no day called ${d}` };
      if (!picked.includes(name)) picked.push(name);
    }
    // THE WEEK'S OWN ORDER, not the order they were ticked, so saving one selection
    // twice stores the same bytes both times — and matches what the engine stores.
    return { value: AUTOMATION_DAYS.filter((d) => picked.includes(d)) };
  }
  // A FIELD KIND THIS DOES NOT KNOW IS A REFUSAL, never a pass. It can only arrive from
  // a catalog entry somebody added without adding its rule, and passing it through would
  // store whatever the caller sent under a name the form invented.
  return { error: `${f.name} is configured in a way this can't read` };
}

/** `HH:MM`, whole minutes, nothing else. The one shape the schedule stores. */
const AT_SHAPE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Is this a time zone this runtime really has?
 *
 * **ASKED OF `Intl`, NEVER OF A LIST.** A hand-kept list of zones is wrong the first
 * time a country changes its mind, and the one it is missing is the one somebody needs.
 * The same rule the site builder's scheduled jobs already follow.
 *
 * It is the FIRST of two walls: `agent.automation_next_at` raises for a zone PostgreSQL
 * cannot use, so a zone this admits and the database does not is refused there instead
 * of being stored. Two runtimes, two time zone databases, and only one of them decides
 * when something runs.
 */
export function validTimeZone(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  const zone = v.trim();
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return zone; }
  catch { return null; }
}

/**
 * The trigger off a request body, or a named refusal.
 *
 * **A SCHEDULE IS WHOLE OR IT IS NOT A SCHEDULE** — the column's own constraint says the
 * same thing, and refusing here is what turns it into a sentence rather than a Postgres
 * error nobody can act on.
 *
 * **THE ZONE IS THE AUTOMATION'S, NOT THE SCHEDULE'S**, so a Run-now automation may have
 * one too: a weekday condition asks which day it is somewhere, and without this it would
 * mean the day in UTC for every manual automation, silently.
 */
export function cleanSchedule(b) {
  const schedule = typeof b?.schedule === "string" ? b.schedule.trim() : "manual";
  if (!AUTOMATION_SCHEDULES.includes(schedule)) {
    return { error: "an automation is started by hand or on a daily schedule" };
  }
  const zone = b?.zone === undefined || b?.zone === null || b?.zone === ""
    ? null
    : validTimeZone(b.zone);
  if (b?.zone && !zone) return { error: "that isn't a time zone this can use" };

  if (schedule === "manual") {
    // A TIME WITH NO SCHEDULE IS A CONTROL SOMEBODY SET THAT NOTHING READS, so it is
    // dropped rather than stored — and the column's constraint refuses it anyway.
    return { schedule, at: null, zone };
  }
  const at = typeof b?.at === "string" ? b.at.trim() : "";
  if (!AT_SHAPE.test(at)) return { error: "say what time of day it should run, as HH:MM" };
  if (!zone) return { error: "a daily schedule needs a time zone, so the time means somewhere" };
  // SECONDS ARE OURS, NOT THE CALLER'S. The screen offers a time, not a stopwatch.
  return { schedule, at: `${at}:00`, zone };
}

/**
 * One automation, as the browser reads it.
 *
 * **IT FAILS CLOSED ON EVERY FIELD IT CANNOT READ.** An `enabled` that is not a boolean
 * reads as OFF — being wrong that way costs a press of the toggle, and being wrong the
 * other way is an automation running that somebody believes is stopped.
 */
export function automationRow(r) {
  const steps = Array.isArray(r?.steps) ? r.steps : [];
  return {
    id: typeof r?.id === "string" ? r.id : "",
    agentId: typeof r?.agent_id === "string" ? r.agent_id : "",
    name: typeof r?.name === "string" ? r.name : "",
    enabled: r?.enabled === true,
    schedule: AUTOMATION_SCHEDULES.includes(r?.schedule) ? r.schedule : "manual",
    // `HH:MM:SS` out of Postgres, `HH:MM` on screen. One shape leaves this file.
    at: typeof r?.at_local === "string" ? r.at_local.slice(0, 5) : null,
    zone: typeof r?.zone === "string" && r.zone ? r.zone : null,
    steps,
    nextRunAt: typeof r?.next_run_at === "string" ? r.next_run_at : null,
    updatedAt: typeof r?.updated_at === "string" ? r.updated_at : null,
  };
}

/**
 * What became of one execution.
 *
 * **SIX WORDS, AND EACH IS A DIFFERENT THING TO SAY TO SOMEBODY.** `skipped` is the one
 * that earns its place twice over: a condition that did not match is not a failure, and
 * showing it as one would tell a customer their automation is broken when it did exactly
 * what they asked.
 */
export const AUTOMATION_STATES = Object.freeze(["queued", "done", "skipped", "failed", "missed", "paused"]);

/**
 * One execution, as the browser reads it.
 *
 * **THE STATE IS DERIVED FROM THE RUN'S OWN STOP AND FROM NOTHING ELSE.** The execution
 * row deliberately carries no status column — that would be a second copy of a fact the
 * journal already states — so this is the only place the word is chosen.
 *
 * **AN UNREADABLE STOP ON A STOPPED RUN IS `failed`, NOT `queued`.** Cannot-tell must
 * never read as "still going": a row that says it is queued for ever is the one state
 * nobody can act on.
 */
export function executionRow(r) {
  const stop = r?.run_stop && typeof r.run_stop === "object" && !Array.isArray(r.run_stop) ? r.run_stop : null;
  const reason = typeof stop?.reason === "string" ? stop.reason : "";
  const state = r?.run_status !== "stopped"
    ? "queued"
    : AUTOMATION_STATES.includes(reason) && reason !== "queued" ? reason : "failed";
  return {
    id: typeof r?.id === "string" ? r.id : "",
    automationId: typeof r?.automation_id === "string" ? r.automation_id : "",
    trigger: r?.trigger === "schedule" ? "schedule" : "manual",
    occurrence: typeof r?.occurrence === "string" ? r.occurrence : null,
    state,
    // WHAT IT SAVED, WHY IT SKIPPED, OR WHAT BROKE — one of the three, never two.
    result: state === "done" && typeof stop?.result === "string" ? stop.result : null,
    why: state === "skipped" && typeof stop?.why === "string" ? stop.why : null,
    error: state === "failed" && typeof stop?.error === "string" ? stop.error : null,
    on: typeof stop?.on === "string" ? stop.on : null,
    missed: Number.isInteger(r?.missed) ? r.missed : null,
    outcomes: Array.isArray(r?.outcomes) ? r.outcomes : [],
    steps: Array.isArray(r?.steps) ? r.steps : [],
    at: typeof r?.created_at === "string" ? r.created_at : null,
    finishedAt: typeof r?.finished_at === "string" ? r.finished_at : null,
  };
}

// ── the surface ─────────────────────────────────────────────────────────────

/** Every path this handles, so `worker.js` and the guard read ONE list. */
export const AGENT_ROUTES = Object.freeze({
  "/api/agent/list": "GET",
  "/api/agent/messages": "GET",
  "/api/agent/create": "POST",
  "/api/agent/update": "POST",
  "/api/agent/delete": "POST",
  "/api/agent/message": "POST",
  "/api/agent/send": "POST",
  "/api/agent/import": "POST",
  // ── automations ───────────────────────────────────────────────────────────
  "/api/agent/automations": "GET",
  "/api/agent/automation-create": "POST",
  "/api/agent/automation-update": "POST",
  "/api/agent/automation-enable": "POST",
  "/api/agent/automation-delete": "POST",
  "/api/agent/automation-run": "POST",
  "/api/agent/automation-history": "GET",
});

/** Which routes read a body, so the caller knows whether to parse one. */
export const AGENT_POST_ROUTES = Object.freeze(
  Object.keys(AGENT_ROUTES).filter((p) => AGENT_ROUTES[p] === "POST"));

/**
 * How big a body one route may carry, or `undefined` for the ordinary allowance.
 *
 * **THE ROUTE NAME LIVES HERE RATHER THAN AT THE DISPATCH**, and that is not
 * only tidiness. Written inline it was `url.pathname === "/api/agent/import" ? …`
 * in `worker.js`, which reads to `test/api-auth.test.mjs` as a DISPATCH POINT —
 * a route whose gate must follow it — and the gate for all seven of these sits
 * ABOVE the block. So a correct, gated route reported as unauthenticated. One
 * caller, and it asks by path rather than carrying a second copy of the name.
 */
export function agentBodyMax(path) {
  return path === "/api/agent/import" ? MAX_IMPORT_BODY : undefined;
}

const ok = (body) => ({ status: 200, body: { ok: true, ...body } });
const no = (status, error, extra) => ({ status, body: { error, ...(extra || {}) } });

/** The one answer for "not yours" and "no such agent". */
const NO_AGENT = () => no(404, "that agent isn't here any more");

/** And its counterpart, for the same reason: not found, never forbidden. */
const NO_AUTOMATION = () => no(404, "that automation isn't here any more");

/**
 * A store failure, as one sentence plus a log line.
 *
 * `detail` carries Postgres's own words and is deliberately NOT put in front of
 * a customer — a constraint name is no use to anybody typing into a text box —
 * but it IS logged, because a save that fails with nothing written down is the
 * shape this repository keeps paying for.
 */
function broke(what, e, log) {
  if (typeof log === "function") log(`agent ${what} failed:`, e && e.message);
  const status = e && e.status >= 400 && e.status < 500 ? 400 : 502;
  return no(status, "couldn't save that just now — nothing was lost, try again", { retry: true });
}

/**
 * The status off a request body, or a named refusal.
 *
 * ONE READER FOR BOTH WRITING ROUTES, for the same reason `readTools` below is one:
 * create and update ask the same question, and two copies of it would be two answers
 * about what may be stored. The routes then differ only in what SILENCE means — on a
 * create the column's default decides, on an update the stored value is left alone —
 * and both spell that silence the same way, by not sending the key.
 *
 * **A STATUS THAT CANNOT BE READ IS A REFUSAL, NEVER A DEFAULT.** Reading a typo as
 * `active` would silently un-pause an agent somebody paused on purpose, and reading
 * it as `paused` would stop one nobody asked to stop. Absent is the only safe
 * silence, and `Object.hasOwn` is how absent is told from wrong — never truthiness,
 * because every object literal has a truthy `constructor`.
 */
function readStatus(b) {
  if (!Object.hasOwn(b, "status") || b.status === undefined) return { status: undefined };
  const picked = cleanStatus(b.status);
  if (!picked) return { refusal: no(400, "an agent is either active or paused") };
  return { status: picked };
}

/**
 * The tool selection off a request body, or a named refusal.
 *
 * ONE READER FOR BOTH WRITING ROUTES, because create and update ask the same
 * question and two copies of it would be two answers about what may be stored.
 * `undefined` for `names` means the caller said nothing, which both routes leave
 * alone; a `refusal` means the caller said something this cannot store.
 *
 * **IT REFUSES RATHER THAN STORING LESS THAN WAS ASKED FOR.** A selection quietly
 * shortened is a permission that appears granted and is not — the one failure here
 * that nobody can see from either side.
 */
function readTools(b) {
  if (!Object.hasOwn(b, "tools") || b.tools === undefined) return { names: undefined };
  const picked = cleanTools(b.tools);
  if (picked.tooMany) {
    return { refusal: no(400, `that's more tools than one agent can hold (${MAX_AGENT_TOOLS})`) };
  }
  if (picked.names === null) return { refusal: no(400, "the tools to allow have to arrive as a list") };
  if (picked.unreadable) return { refusal: no(400, "one of the tools didn't arrive as a name") };
  if (picked.unknown.length) {
    // NAMED, because a tool the platform does not have is the one thing a caller
    // can actually act on here — and because silently dropping it is how a screen
    // comes to show a tool as allowed that nothing will ever run.
    return { refusal: no(400, `this platform has no tool called ${picked.unknown.slice(0, 3).join(", ")}`) };
  }
  return { names: picked.names };
}

/**
 * Handle one call.
 *
 * Answers `{status, body}`, or `null` for a path that is not ours — so the
 * caller's dispatch and this module cannot disagree about what is handled.
 *
 * `tenant` MUST come from verified authentication. Nothing in here reads an
 * account from `body` or `query`, and a tenant this cannot read refuses the
 * whole call rather than falling back to anything.
 */
export async function handleAgentApi({ path, method, query, body, tenant, store, ring, newId, now, log } = {}) {
  if (!Object.hasOwn(AGENT_ROUTES, path)) return null;
  if (AGENT_ROUTES[path] !== method) return no(405, "wrong method for that");

  const who = readTenant(tenant);
  // A TENANT WE CANNOT READ IS A REFUSAL, NEVER AN UNFILTERED QUERY. There is
  // no sensible fallback: every statement below is scoped by this value, so
  // proceeding without it would mean proceeding across accounts.
  if (!who) return no(401, "sign in required");

  const mint = typeof newId === "function" ? newId : () => crypto.randomUUID();
  const at = typeof now === "function" ? now : () => Date.now();
  const b = body && typeof body === "object" ? body : {};
  const q = query || new URLSearchParams();

  try {
    if (path === "/api/agent/list") {
      // **THE CATALOG RIDES WITH THE LIST, and it is the server's answer to "what
      // may I configure".** One read for the screen rather than a second route: the
      // settings form is only reachable from this screen, so a catalog that arrived
      // separately would be a second thing to fail and a second state to draw.
      //
      // A BROWSER THAT GETS NO `tools` KEY — an older Worker — reads it as an empty
      // catalog and says so honestly. That is what makes the empty state a real
      // branch rather than a decorative one.
      return ok({ agents: await store.list(who), tools: AGENT_TOOLS });
    }

    if (path === "/api/agent/messages") {
      const id = cleanId(q.get("id"));
      if (!id) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, id))) return NO_AGENT();
      return ok({ id, messages: await store.messages(id) });
    }

    if (path === "/api/agent/create") {
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      if (!name) return no(400, "give it a name first");
      if (!instructions) return no(400, "say what it should do");
      // ⚠ THE SETTINGS FORM DRAWS A PAUSE CONTROL FOR A NEW AGENT, SO THIS ROUTE HAS
      // TO CARRY ONE. It used to drop `status` on the floor — the control answered,
      // and what it answered was discarded, which is a dead control that ANSWERS
      // rather than one that does nothing. **Absent is still the ordinary answer and
      // still means active**, decided by the column's default rather than here.
      const rest = readStatus(b);
      if (rest.refusal) return rest.refusal;
      const picked = readTools(b);
      if (picked.refusal) return picked.refusal;
      if ((await store.count(who)) >= MAX_AGENTS) {
        return no(409, `that's as many agents as one account can hold (${MAX_AGENTS}) — delete one first`);
      }
      return ok({
        agent: await store.create(who, {
          id: mint(), name, instructions, status: rest.status, tools: picked.names,
        }),
      });
    }

    if (path === "/api/agent/update") {
      const id = cleanId(b.id);
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      if (!id) return no(400, "which agent?");
      if (!name) return no(400, "give it a name first");
      if (!instructions) return no(400, "say what it should do");
      // ── the settings, each only when the caller named it ─────────────────
      //
      // THE SAME TWO READERS THE CREATE USES. What differs is only what silence
      // buys: here an absent field is the stored value left alone, which is what
      // makes this a PATCH rather than a replace — a browser tab opened before
      // today saves a name and an instruction and says nothing about either
      // setting, and filling them in from a default would un-pause an agent from a
      // screen that never showed a pause control.
      const rest = readStatus(b);
      if (rest.refusal) return rest.refusal;
      const status = rest.status;
      const picked = readTools(b);
      if (picked.refusal) return picked.refusal;
      const agent = await store.update(who, id, { name, instructions, status, tools: picked.names });
      return agent ? ok({ agent }) : NO_AGENT();
    }

    if (path === "/api/agent/delete") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which agent?");
      return (await store.remove(who, id)) ? ok({ id }) : NO_AGENT();
    }

    if (path === "/api/agent/message") {
      const id = cleanId(b.id);
      const text = cleanText(b.body, AGENT_BODY_MAX);
      if (!id) return no(400, "which agent?");
      if (!text) return no(400, "there was nothing to send");
      // OWNERSHIP FIRST, then the insert. The window between them is closed by
      // the foreign key: an agent deleted in between makes this fail rather
      // than leave a message pointing at nothing.
      if (!(await store.ownsAgent(who, id))) return NO_AGENT();
      const saved = await store.addMessage(id, { id: mint(), body: text, at: cleanAt(b.at, at()) });
      return ok({ id, message: saved });
    }

    if (path === "/api/agent/send") {
      const id = cleanId(b.id);
      const text = cleanText(b.body, AGENT_BODY_MAX);
      const key = cleanSendKey(b.key);
      if (!id) return no(400, "which agent?");
      if (!text) return no(400, "there was nothing to send");
      // THE KEY IS REQUIRED AND IS NOT OPTIONAL WITH A FALLBACK. Minting one here
      // would make every press a new key and every retry a second message and a
      // second run — retry safety failing OPEN, which is the direction that
      // duplicates a conversation and pays for the work twice. A refusal is
      // recoverable; a silent duplicate is not.
      if (!key) return no(400, "that send didn't say which press it was — try again");

      // ⚠ NO OWNERSHIP CHECK HERE, AND THAT IS DELIBERATE RATHER THAN MISSING.
      // The check is INSIDE the transaction, against the tenant this process
      // verified, and it has to be: a check out here would be a separate statement
      // with an agent deletion able to fit between it and the insert. Every other
      // route asks first because its write is a single statement and the foreign
      // key closes that window; this one has a window big enough to matter, so the
      // question is asked where the answer cannot go stale.
      const a = await store.send(who, {
        agentId: id, messageId: mint(), runId: mint(), body: text, key,
      });
      // NOT FOUND, NEVER FORBIDDEN — the same answer a nonexistent agent gets, so
      // this cannot confirm that somebody else's agent exists.
      if (a.error === "no-agent") return NO_AGENT();
      // ⚠ A PAUSE IS A SENTENCE OF ITS OWN, AND IT IS NOT A FAILURE. The transaction
      // wrote nothing at all — no message, no run — so the words are still the
      // customer's to send once they resume it, and the browser keeps them in the box
      // AND keeps its retry key, because the next press really is the same press.
      //
      // **409, NOT 404 AND NOT 500.** It is a conflict with the agent's own state: the
      // request was well formed, the agent exists and is theirs, and nothing is
      // broken. `paused` rides beside the sentence so the screen can offer the one
      // thing that helps rather than parsing our prose for it.
      if (a.error === "paused") {
        return no(409, "this agent is paused, so it isn't starting anything new — resume it in its settings and send again", { paused: true });
      }
      if (a.ok === false) return NO_AGENT();

      // ── RING THE ENGINE, AFTER THE TRANSACTION AND NEVER BEFORE IT ────────────
      //
      // The run, its first entry and its queue row are committed by now, so this is
      // a DOORBELL and not the work: it decides how soon a conversation starts, and
      // nothing about whether it starts at all. Without it the engine's own
      // minute-by-minute sweep finds the row — correct, and up to a minute of
      // somebody watching a screen that says nothing.
      //
      // **A FAILED RING IS LOGGED AND SAID, NEVER RAISED.** Answering an error here
      // would tell the customer their message failed when it is committed and will
      // run; `notified` is on the wire because "it is on the queue" and "something
      // will find it within the minute" are different promises.
      //
      // **A DUPLICATE RING IS HARMLESS BY CONSTRUCTION, and that is the queue's
      // property rather than this line's care.** `claim_run` is the one gate: a
      // second delivery for a run already claimed or finished answers
      // `not-claimable` / `already-finished` and does nothing. So a repeat is rung
      // TOO — a first press whose ring failed leaves a row nobody has told anyone
      // about, and the retry is exactly when to say it again.
      const runId = cleanId(a.run_id);
      let notified = false;
      if (runId && typeof ring === "function") {
        try {
          await ring(runId);
          notified = true;
        } catch (e) {
          if (typeof log === "function") log("agent send: the queue was not rung", String(e?.message ?? e));
        }
      }
      return ok({
        id,
        repeat: !!a.repeat,
        // WHETHER THE SEND WAS ABSORBED UNDER THIS KEY WITH DIFFERENT WORDS. The
        // transaction answers it; this carries it, because a caller that reads a
        // repeat as a plain success clears a box holding an edit nobody saved.
        mismatch: !!a.mismatch,
        // WHETHER THE ENGINE WAS TOLD. `false` is not a failure — the work is
        // durable either way — it means the start waits for the sweep.
        notified,
        // WHETHER THE WORK REALLY REACHED THE QUEUE, said rather than assumed. A
        // repeat put nothing on it and says so; anything but `queued` from the
        // accepting function means the run was not newly enqueued, which a caller
        // watching for progress needs to know.
        queued: a.state === "queued",
        // The message as STORED, never as sent: a retry under one key with
        // different words is answered with the conversation's own text.
        message: messageRow({ id: a.message_id, body: a.body, created_at: a.created_at }),
        // The run's id only. ITS STATE HAS EXACTLY ONE READER and it is the thread —
        // describing it here too would be a second composer of the same fact, and
        // the two would disagree the moment one of them was updated.
        runId,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // AUTOMATIONS
    //
    // **THE TENANT IS `who` IN EVERY ONE OF THEM AND IS NEVER READ FROM A BODY.** It
    // came from the verified token above, the block is gated ONCE over all of these,
    // and every statement below carries it in the FILTER — which is the wall, because
    // `service_role` bypasses row level security and the policies only protect a
    // customer's own direct read.
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/api/agent/automations") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      // **THE CATALOG RIDES WITH THE LIST**, exactly as the tool catalog rides with the
      // agent list: the form is only reachable from this screen, so a catalog arriving
      // separately would be a second thing to fail and a second state to draw. A browser
      // that gets no `steps` key — an older Worker — says so honestly rather than
      // drawing an empty form.
      return ok({
        agent: agentId,
        automations: await store.listAutomations(who, agentId),
        steps: AUTOMATION_STEPS,
        days: AUTOMATION_DAYS,
        max: MAX_AUTOMATIONS,
      });
    }

    if (path === "/api/agent/automation-create" || path === "/api/agent/automation-update") {
      const editing = path.endsWith("update");
      const name = cleanText(b.name, AUTOMATION_NAME_MAX);
      if (!name) return no(400, "give it a name first");

      const trigger = cleanSchedule(b);
      if (trigger.error) return no(400, trigger.error);
      const flow = cleanWorkflow(b.steps);
      if (flow.error) return no(400, flow.error);
      // **`enabled` IS REFUSED RATHER THAN COERCED.** `Boolean("false")` is `true`, so a
      // string out of a form would turn "off" into "on" — the one direction that starts
      // work nobody asked for. Absent means on, which is what making one means.
      if (Object.hasOwn(b, "enabled") && typeof b.enabled !== "boolean" && b.enabled !== undefined) {
        return no(400, "an automation is either on or off");
      }
      const enabled = b.enabled === undefined ? true : b.enabled;

      const shape = {
        name, enabled, schedule: trigger.schedule, at: trigger.at, zone: trigger.zone,
        steps: flow.steps,
      };

      if (!editing) {
        const agentId = cleanId(b.agent);
        if (!agentId) return no(400, "which agent?");
        // NO OWNERSHIP CHECK OUT HERE, and that is deliberate rather than missing: the
        // check is INSIDE the transaction, against the tenant this process verified, so
        // an agent deleted between a check and an insert cannot leave an automation
        // pointing at nothing.
        const a = await store.createAutomation(who, { agentId, id: mint(), ...shape });
        if (a.error === "no-agent") return NO_AGENT();
        if (a.error === "too-many") {
          return no(409, `that's as many automations as one agent can hold (${MAX_AUTOMATIONS}) — delete one first`);
        }
        if (a.ok !== true) return NO_AGENT();
        return ok({ id: a.id, nextRunAt: a.next_run_at ?? null });
      }

      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      const a = await store.updateAutomation(who, { id, ...shape });
      if (a.ok !== true) return NO_AUTOMATION();
      // ⚠ AN EDIT REACHES THE NEXT EXECUTION AND CAN NEVER REACH AN ACCEPTED ONE. What a
      // run executes was copied into its own record when it was accepted, so this
      // statement cannot change what is already running or already ran — which is the
      // property `steps` being a snapshot exists for.
      return ok({ id: a.id, nextRunAt: a.next_run_at ?? null });
    }

    if (path === "/api/agent/automation-enable") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      if (typeof b.enabled !== "boolean") return no(400, "say whether it should be on or off");
      const a = await store.setAutomationEnabled(who, id, b.enabled);
      // **TURNING IT OFF PREVENTS NEW EXECUTIONS AND NOTHING ELSE.** It is not a delete
      // and not a cancellation: work already accepted keeps its own recorded
      // configuration and finishes.
      return a ? ok({ automation: a }) : NO_AUTOMATION();
    }

    if (path === "/api/agent/automation-delete") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      return (await store.removeAutomation(who, id)) ? ok({ id }) : NO_AUTOMATION();
    }

    if (path === "/api/agent/automation-run") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      const a = await store.runAutomation(who, { automationId: id, runId: mint() });
      if (a.error === "no-automation") return NO_AUTOMATION();
      // ⚠ TWO REFUSALS, TWO SENTENCES, AND NEITHER IS A FAILURE. The transaction wrote
      // nothing at all on either path — no execution, no run — so turning the thing back
      // on and pressing again is a fresh press rather than a retry of a half-written one.
      // **409, NOT 404 AND NOT 500**: the request was well formed, the automation exists
      // and is theirs, and nothing is broken.
      if (a.error === "disabled") {
        return no(409, "this automation is off, so it isn't starting anything — turn it on and try again", { disabled: true });
      }
      if (a.error === "paused") {
        return no(409, "this agent is paused, so its automations aren't starting anything new — resume it in its settings", { paused: true });
      }
      if (a.ok !== true) return NO_AUTOMATION();

      // ── RING THE ENGINE, AFTER THE TRANSACTION AND NEVER BEFORE IT ──────────
      // The same doorbell a message rings, for the same reason and with the same
      // reading: the work is committed by now, so a failed ring decides how soon this
      // starts and nothing about whether it starts at all.
      const runId = cleanId(a.run_id);
      let notified = false;
      if (runId && typeof ring === "function") {
        try { await ring(runId); notified = true; }
        catch (e) { if (typeof log === "function") log("automation run: the queue was not rung", String(e?.message ?? e)); }
      }
      return ok({ id, runId, notified, repeat: !!a.repeat });
    }

    if (path === "/api/agent/automation-history") {
      const id = cleanId(q.get("id"));
      if (!id) return no(400, "which automation?");
      if (!(await store.ownsAutomation(who, id))) return NO_AUTOMATION();
      return ok({ id, executions: await store.executions(who, id) });
    }

    if (path === "/api/agent/import") {
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      // THE KEY IS REQUIRED, not optional with a fallback. Without it this call
      // cannot be retried safely, and an import that quietly loses that property
      // is worse than one that refuses: the failure only shows up as a duplicate
      // agent nobody can explain, days later. Every record the screen offers has
      // an id, so nothing legitimate is turned away.
      const key = cleanImportKey(b.key);
      if (!key) return no(400, "an agent being brought over needs to say which one it is");
      if (!name) return no(400, "an agent being brought over needs its name");
      if (!instructions) return no(400, "an agent being brought over needs its instructions");
      const raw = Array.isArray(b.messages) ? b.messages : [];
      if (raw.length > MAX_IMPORT_MESSAGES) {
        return no(413, `that conversation is longer than one import can carry (${MAX_IMPORT_MESSAGES} messages)`);
      }
      // A MESSAGE THAT CANNOT BE READ IS COUNTED AND SAID, NEVER DROPPED IN
      // SILENCE. The local store is not deleted, so somebody can go and look at
      // what did not come over — which is only worth anything if they are told
      // there was something.
      const messages = [];
      let unreadable = 0;
      for (const m of raw) {
        const text = cleanText(m && m.text, AGENT_BODY_MAX);
        if (!text) { unreadable++; continue; }
        const stamp = cleanAt(m && m.at, at());
        messages.push(stamp ? { body: text, at: stamp } : { body: text });
      }
      const id = await store.importOne(who, { name, instructions, messages, key });
      return ok({ id, key, imported: messages.length, unreadable });
    }
  } catch (e) {
    return broke(path.slice("/api/agent/".length), e, log);
  }

  // UNREACHABLE BY CONSTRUCTION and answered anyway: the membership test above
  // and the branches here are two lists of the same names, and a route added to
  // one and not the other must not fall out of this function as `undefined`.
  return no(500, "that isn't wired up");
}
