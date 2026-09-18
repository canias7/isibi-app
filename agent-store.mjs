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
  // ── what the agent may read ───────────────────────────────────────────────
  Object.freeze({
    name: "search_reference",
    label: "Search its reference material",
    does: "Looks through the sources you have given this agent and finds the passages that match, each with the name of the source it came from.",
  }),
  Object.freeze({
    name: "list_reference",
    label: "List its reference material",
    does: "Sees what sources it has, by name. It does not read them — that is the next one.",
  }),
  Object.freeze({
    name: "read_reference",
    label: "Read one source in full",
    does: "Opens one of its sources and reads the whole thing.",
  }),
  // ── what it may remember ──────────────────────────────────────────────────
  Object.freeze({
    name: "list_memory",
    label: "See what it remembers",
    does: "Lists the facts and preferences saved for this agent.",
  }),
  Object.freeze({
    name: "remember",
    label: "Remember something",
    does: "Saves a short fact or preference under a name, or corrects one it already has. Anything it saves is marked as having come from the agent rather than from you.",
  }),
  Object.freeze({
    name: "forget",
    label: "Forget something",
    does: "Removes one remembered fact by its name.",
  }),
  // ── what it may do with its automations ───────────────────────────────────
  // ⚠ THE WORDS HERE ARE FOR A PERSON DECIDING WHETHER TO ALLOW A THING, and the engine's
  // own `description` for the same tool is written for a MODEL deciding whether to call it.
  // That is the one thing this copy holds that the engine's does not, and it is why the
  // census between them is over NAMES rather than over text.
  Object.freeze({
    name: "list_actions",
    label: "See what a workflow can be built from",
    does: "Reads the list of actions an automation can use — what each does and what it needs. It is this platform's own list; the agent cannot add to it.",
  }),
  Object.freeze({
    name: "check_workflow",
    label: "Check a workflow before saving it",
    does: "Tries a set of steps against the same rules your own screen uses and says what is wrong with it. It saves nothing and changes nothing.",
  }),
  Object.freeze({
    name: "list_automations",
    label: "See its automations",
    does: "Lists this agent's automations — what each is called, whether it is on, and when it next runs.",
  }),
  Object.freeze({
    name: "read_automation",
    label: "Read one automation",
    does: "Opens one automation and reads every step in it.",
  }),
  Object.freeze({
    name: "make_automation",
    label: "Create an automation",
    does: "Writes a new automation for this agent — a name, when it runs, and its steps. You are asked to approve it before anything is saved, every time.",
  }),
  Object.freeze({
    name: "change_automation",
    label: "Change an automation",
    does: "Rewrites one of this agent's automations, steps and all. You are asked to approve it before anything is saved, every time.",
  }),
  Object.freeze({
    name: "pause_automation",
    label: "Turn an automation on or off",
    does: "Stops one of its automations running, or starts it again. It cannot change what the automation does.",
  }),
  Object.freeze({
    name: "run_automation",
    label: "Run an automation now",
    does: "Starts one of its automations straight away, without waiting for its schedule.",
  }),
  Object.freeze({
    name: "list_executions",
    label: "See what an automation did",
    does: "Looks at the recent runs of one automation — whether each finished, what it is waiting for, and what it produced.",
  }),
  Object.freeze({
    name: "read_execution",
    label: "Read one run in full",
    does: "Opens one run of an automation and reads every step's outcome.",
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
/**
 * ⚠ **SEVEN STATES, AND FOUR OF THEM USED TO BE ONE WORD.**
 *
 * `working` covered a run really thinking, a run waiting for a person, a run that can never
 * move again, and a run somebody stopped — the last two for EVER, which is the one thing the
 * requirement names out loud. Each of the four wants something different done about it, so
 * each has to be sayable:
 *
 *   `queued`   — accepted, nothing done yet.
 *   `working`  — a step is under way.
 *   `waiting`  — a person can still answer a request; the screen's banner is the thing to do.
 *   `unresolved` — tool calls with no result and NOBODY able to answer. It will not move on
 *                its own, and nothing about it is a failure: it is a run that needs a person
 *                to decide, and until this existed it read as *working*.
 *   `answered` — it finished and said something.
 *   `cancelled`— somebody stopped it. **Not `failed`**: nothing went wrong, and the run's own
 *                stop carries who stopped it and how far it got.
 *   `failed`   — it stopped without answering, with the engine's own reason.
 *
 * **NOTHING WAS REDESIGNED TO GET THEM.** `agent.runs.status` is still `new | running |
 * stopped`, projected off the log; the two facts that tell the middle four apart are columns
 * appended to the view the screen already reads, and both come out of relations the customer
 * can already see.
 */
export const RUN_STATES = Object.freeze([
  "queued", "working", "waiting", "unresolved", "answered", "cancelled", "failed",
]);

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
    // ⚠ **A RUN NOBODY CAN MOVE MUST NOT READ AS WORKING.** A run waiting for a person has
    // its work row marked done and the log left open, so nothing is going to deliver it until
    // somebody answers — and the answer might be unreachable (a withdrawn request, a closed
    // window) or the calls might never have been asked about at all. Three different things
    // to do about it, so three different words.
    //
    // ⚠ REFUSED, NEVER COERCED, on both facts. `run_awaiting` must be the boolean `true` —
    // a string `"false"` is truthy and would put every run in the waiting state — and
    // `run_open_calls` must be a real integer, because a view that answered `null` for it
    // (a reader asking for fewer columns, an older deployment) must read as "nothing to say"
    // rather than as a stranding.
    const awaiting = (r && r.run_awaiting) === true;
    const open = Number.isInteger(r && r.run_open_calls) && r.run_open_calls > 0 ? r.run_open_calls : 0;
    // THE ORDER IS THE MEANING. A person who CAN answer is the thing to do, whatever else is
    // true; only when nobody can does an unanswered call become a stranding.
    const state = awaiting ? "waiting" : open > 0 ? "unresolved" : step > 0 ? "working" : "queued";
    // `open` RIDES ON THE ANSWER for the two states it is about, because "one call" and "four
    // calls" are different things for somebody deciding what to do — and it is left off the
    // ordinary states rather than sent as 0, which would invite a reader to draw it.
    return {
      id, state, step, simulated, text: "", why: "", at: 0,
      ...(state === "waiting" || state === "unresolved" ? { open } : {}),
    };
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
  // ⚠ **A RUN SOMEBODY STOPPED IS NOT A RUN THAT FAILED.** Nothing went wrong: a person asked
  // for it to stop, and the stop carries who and how far it got. Reading it as `failed` would
  // tell them their own decision was a fault — and `cancelled` is the one non-answered stop
  // that a screen should not offer to retry.
  if (why === "cancelled") {
    return {
      id, state: "cancelled", step, simulated, text: "", why, at,
      // WHO, AND WHAT HAD ALREADY RUN. *Don't claim completed effects were undone*: the
      // counts are the only honest thing to say about a cancelled run, so they travel with it
      // rather than being left in a journal nothing on this side reads.
      // WHO STOPPED IT, through `cleanId` because it is an account id and the wire must not
      // carry whatever else a stop body happens to hold. An unreadable one is `""` — absent
      // rather than guessed, which is the only honest answer when the journal cannot say.
      by: cleanId(stop && stop.cancelledBy) || "",
      note: typeof stop?.note === "string" ? stop.note : "",
      completedSteps: Number.isInteger(stop?.completedSteps) ? stop.completedSteps : 0,
      completedCalls: Number.isInteger(stop?.completedCalls) ? stop.completedCalls : 0,
    };
  }
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
        `&select=id,body,created_at,seq,run_id,run_status,run_stop,run_step,run_model,run_stopped_at,run_open_calls,run_awaiting` +
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
     * One automation, for the sake of what it asks for.
     *
     * **`null` FOR ANOTHER ACCOUNT'S AND FOR ONE THAT IS NOT THERE**, the same answer, so a
     * caller cannot tell them apart and neither can a stranger through it.
     */
    async readAutomation(tenant, id) {
      const r = await req("GET",
        `automations?id=eq.${id}&tenant_id=eq.${t(tenant)}` +
        `&select=id,agent_id,name,enabled,schedule,at_local,zone,steps,inputs,next_run_at,created_at,updated_at&limit=1`);
      if (!r.ok) throw storeFail("read automation", r);
      return rows(r).length === 1 ? automationRow(rows(r)[0]) : null;
    },

    /**
     * Answer one waiting approval.
     *
     * **THE TENANT IS AN ARGUMENT TO THE FUNCTION and the function puts it in the lookup**,
     * so ownership is enforced inside the transaction that writes rather than in a check
     * this process makes first — which is the only arrangement with no window between them.
     */
    async decideApproval(tenant, { runId, step, verdict, note }) {
      const r = await req("POST", "rpc/decide_automation_approval", {
        body: {
          p_tenant: tenant, p_run_id: runId, p_step: step,
          p_verdict: verdict, p_note: note ?? null, p_by: null,
        },
      });
      if (!r.ok) throw storeFail("decide approval", r);
      return answerOf(r, "decide approval");
    },

    // ── a tool call waiting for a person ────────────────────────────────────

    /**
     * Every tool call this account has waiting, oldest first.
     *
     * `agentId` narrows it to one agent's, and `null` is every agent's — which is what a
     * list screen wants. **THE TENANT IS AN ARGUMENT AND IS ALWAYS IN THE FILTER**: the
     * function bypasses RLS like every other one here, so this is the wall.
     */
    async listToolApprovals(tenant, agentId = null, limit = MAX_TOOL_APPROVALS) {
      const r = await req("POST", "rpc/pending_approvals", {
        body: { p_tenant: tenant, p_agent_id: agentId ?? null, p_limit: limit },
      });
      if (!r.ok) throw storeFail("list tool approvals", r);
      return rows(r).map(toolApprovalRow);
    },

    /**
     * A person answers one of them.
     *
     * **`by` IS COMPELLED BY THE DATABASE AND IS SUPPLIED FROM THE VERIFIED SESSION.**
     * The function refuses a blank one (`no-decider`), which is what "only an authorized
     * user can approve" rests on — a decision nobody can be tied to is one nobody can be
     * asked about afterwards. It is never read from a request body; there is no argument
     * for it on the route.
     */
    async decideToolApproval(tenant, { id, verdict, note, by }) {
      const r = await req("POST", "rpc/decide_tool_approval", {
        body: { p_tenant: tenant, p_id: id, p_verdict: verdict, p_note: note ?? null, p_by: by },
      });
      if (!r.ok) throw storeFail("decide tool approval", r);
      return answerOf(r, "decide tool approval");
    },

    /**
     * A person WITHDRAWS one waiting request, without deciding it.
     *
     * ⚠ **NOT A REJECTION, AND THE DIFFERENCE REACHES THE MODEL.** Nobody looked at the call
     * and said no — the request is being taken back — so a model told "a person declined this"
     * would be told something that did not happen. `decide_tool_approval` deliberately
     * REFUSES `revoked` as a verdict, so there is no way to reach this through that door and
     * skip this function's own rules.
     */
    async revokeToolApproval(tenant, { id, by, note }) {
      const r = await req("POST", "rpc/revoke_tool_approval", {
        body: { p_tenant: tenant, p_id: id, p_by: by, p_note: note ?? null },
      });
      if (!r.ok) throw storeFail("withdraw tool approval", r);
      return answerOf(r, "withdraw tool approval");
    },

    /**
     * A person takes ONE TOOL away from ONE AGENT, now.
     *
     * ⚠ **THIS IS NOT THE SETTINGS TICK, and conflating the two is the mistake this exists to
     * avoid.** Unticking a tool changes what the agent's NEXT run is accepted with, and
     * deliberately does not reach a run already going — a run that loses a tool half way
     * through is a run whose plan no longer works. A revocation is the opposite act: it says
     * *stop doing this now*, and the engine reads it again on every delivery. So a customer
     * has both, and which one they want is a real choice rather than a duplicate.
     */
    async revokeAgentTool(tenant, { agentId, tool, by, note }) {
      const r = await req("POST", "rpc/revoke_agent_tool", {
        body: { p_tenant: tenant, p_agent_id: agentId, p_tool: tool, p_by: by, p_note: note ?? null },
      });
      if (!r.ok) throw storeFail("revoke tool", r);
      return answerOf(r, "revoke tool");
    },

    /** ...and lifts it. It does NOT re-open the requests the revocation withdrew. */
    async restoreAgentTool(tenant, { agentId, tool }) {
      const r = await req("POST", "rpc/restore_agent_tool", {
        body: { p_tenant: tenant, p_agent_id: agentId, p_tool: tool },
      });
      if (!r.ok) throw storeFail("restore tool", r);
      return answerOf(r, "restore tool");
    },

    /** Which tools this agent may no longer use, so a screen can offer to lift one. */
    async listRevokedTools(tenant, agentId) {
      const r = await req("POST", "rpc/revoked_tools", {
        body: { p_tenant: tenant, p_agent_id: agentId },
      });
      if (!r.ok) throw storeFail("list revoked tools", r);
      // A SET-RETURNING FUNCTION ANSWERS A LIST OF STRINGS. Refused rather than coerced:
      // `String(["act"])` is `"act"`, and a malformed answer read as one name would tell a
      // customer a tool is revoked that is not.
      const got = rows(r);
      return got.filter((t) => typeof t === "string");
    },

    /**
     * A person STOPS one run.
     *
     * ⚠ **AND NOTHING ALREADY DONE IS UNDONE.** The answer carries how far the run got, and
     * the sentence says so, because *don't claim completed effects were undone* is the one
     * thing a cancellation must not imply. Cancelling twice answers what really happened
     * rather than writing a second ending.
     */
    async cancelRun(tenant, { runId, by, reason }) {
      const r = await req("POST", "rpc/cancel_run", {
        body: { p_tenant: tenant, p_run_id: runId, p_by: by, p_reason: reason ?? null },
      });
      if (!r.ok) throw storeFail("cancel run", r);
      return answerOf(r, "cancel run");
    },

    // ── reference material ──────────────────────────────────────────────────
    //
    // **PLAIN TABLE WRITES RATHER THAN FUNCTIONS, and the difference from the automation
    // side is real**: an automation's create has to compute a schedule's next instant and
    // count what an agent holds, which are decisions; a source is a row, and its version
    // and its timestamps belong to the column and the trigger. What keeps it safe is the
    // same thing either way — the tenant is in every filter.

    /** Every source of one agent, A–Z, WITHOUT the material itself. */
    async listKnowledge(tenant, agentId, limit = MAX_KNOWLEDGE) {
      // ⚠ THE BODIES ARE NOT SENT TO THE BROWSER. Twenty sources at 200,000 characters is
      // four megabytes to draw a list of names, and the list is only ever a list of names;
      // the material is fetched one source at a time when somebody opens it.
      const r = await req("GET",
        `agent_knowledge?tenant_id=eq.${t(tenant)}&agent_id=eq.${agentId}` +
        `&select=id,title,format,version,created_at,updated_at&limit=${limit}`);
      if (!r.ok) throw storeFail("list knowledge", r);
      return rows(r).map(knowledgeRow);
    },

    /** One source WITH its material, for editing it. */
    async readKnowledge(tenant, id) {
      const r = await req("GET",
        `agent_knowledge?id=eq.${id}&tenant_id=eq.${t(tenant)}` +
        `&select=id,agent_id,title,body,format,version,created_at,updated_at&limit=1`);
      if (!r.ok) throw storeFail("read knowledge", r);
      return rows(r).length === 1 ? { ...knowledgeRow(rows(r)[0]), body: String(rows(r)[0].body ?? "") } : null;
    },

    async countKnowledge(tenant, agentId) {
      const r = await req("GET",
        `agent_knowledge?tenant_id=eq.${t(tenant)}&agent_id=eq.${agentId}&select=id&limit=${MAX_KNOWLEDGE + 1}`);
      if (!r.ok) throw storeFail("count knowledge", r);
      return rows(r).length;
    },

    async addKnowledge(tenant, { agentId, id, title, body, format }) {
      const r = await req("POST", "agent_knowledge", {
        prefer: "return=representation",
        body: { id, tenant_id: tenant, agent_id: agentId, title, body, format },
      });
      // ⚠ ONE SOURCE NAME PER AGENT IS A UNIQUE INDEX, so the refusal is Postgres's and
      // arrives as a code rather than as something this process checked first. Read as its
      // own answer, because "there is already one called that" is a sentence somebody can
      // act on and a 502 is not.
      if (!r.ok && r.status === 409) return { error: "duplicate" };
      if (!r.ok) throw storeFail("add knowledge", r);
      return { source: rows(r).length === 1 ? knowledgeRow(rows(r)[0]) : null };
    },

    /** Editing the material is what bumps the version, and the trigger is what does it. */
    async updateKnowledge(tenant, { id, title, body, format }) {
      const r = await req("PATCH", `agent_knowledge?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
        body: { title, body, format },
      });
      if (!r.ok) throw storeFail("update knowledge", r);
      return rows(r).length === 1 ? knowledgeRow(rows(r)[0]) : null;
    },

    async removeKnowledge(tenant, id) {
      const r = await req("DELETE", `agent_knowledge?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
      });
      if (!r.ok) throw storeFail("delete knowledge", r);
      return rows(r).length === 1;
    },

    // ── memory ──────────────────────────────────────────────────────────────

    /** Everything one agent remembers, by name. Small by construction, so all of it. */
    async listMemory(tenant, agentId, limit = MAX_MEMORIES) {
      const r = await req("GET",
        `agent_memory?tenant_id=eq.${t(tenant)}&agent_id=eq.${agentId}` +
        `&select=id,key,value,source,version,created_at,updated_at&limit=${limit}`);
      if (!r.ok) throw storeFail("list memory", r);
      return rows(r).map(memoryRow);
    },

    /**
     * Set one name to one value.
     *
     * **AN UPSERT, BECAUSE THAT IS WHAT SAVING A MEMORY IS.** `resolution=merge-duplicates`
     * over `(tenant, agent, key)` — the unique index that IS the scope — so a caller never
     * has to know whether the name exists, which would be doing that index's job in
     * JavaScript and racing itself while it did.
     */
    async saveMemory(tenant, { agentId, id, key, value }) {
      const r = await req("POST", "agent_memory", {
        prefer: "return=representation,resolution=merge-duplicates",
        body: { id, tenant_id: tenant, agent_id: agentId, key, value, source: "person" },
      });
      if (!r.ok) throw storeFail("save memory", r);
      return rows(r).length === 1 ? memoryRow(rows(r)[0]) : null;
    },

    /** By NAME, because the name is the identity a workflow and a person both use. */
    async removeMemory(tenant, agentId, key) {
      const r = await req("DELETE",
        `agent_memory?tenant_id=eq.${t(tenant)}&agent_id=eq.${agentId}&key=eq.${encodeURIComponent(key)}`, {
        prefer: "return=representation",
      });
      if (!r.ok) throw storeFail("delete memory", r);
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
    async createAutomation(tenant, { agentId, id, name, enabled, schedule, at, zone, steps, inputs }) {
      const r = await req("POST", "rpc/create_automation", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name,
          p_enabled: enabled, p_schedule: schedule, p_at_local: at, p_zone: zone,
          p_steps: steps, p_inputs: inputs ?? [], p_max: MAX_AUTOMATIONS,
        },
      });
      if (!r.ok) throw storeFail("create automation", r);
      return answerOf(r, "create automation");
    },

    /** Change one. A replace of its settings, and the form always sends all of them. */
    async updateAutomation(tenant, { id, name, enabled, schedule, at, zone, steps, inputs }) {
      const r = await req("POST", "rpc/update_automation", {
        body: {
          p_tenant: tenant, p_id: id, p_name: name, p_enabled: enabled,
          p_schedule: schedule, p_at_local: at, p_zone: zone, p_steps: steps,
          p_inputs: inputs ?? [],
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
    async runAutomation(tenant, { automationId, runId, input }) {
      const r = await req("POST", "rpc/accept_automation_run", {
        body: {
          p_tenant: tenant, p_automation_id: automationId, p_run_id: runId,
          p_input: input ?? {},
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
        `position,vars,input,waiting,wait_until,decisions,` +
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

/**
 * ⚠ **WHAT HAPPENS WHEN A STEP DOES NOT WORK, and `stop` is the default because it is what
 * every workflow saved before this already does.** A DECLARED COPY of the engine's
 * `ERROR_PATHS`, censused both ways in `test/agent-send.test.mjs` — the one file that may
 * load both products.
 *
 * `continue` does NOT make a failure a success: the step's outcome stays `failed` with its
 * own error, and what changes is only whether the steps below it run.
 */
export const AUTOMATION_ERROR_PATHS = Object.freeze(["stop", "continue", "retry"]);
/** How many EXTRA attempts one step may be given. A copy of the engine's `MAX_STEP_RETRIES`. */
export const MAX_STEP_RETRIES = 3;
/**
 * ⚠ **WHICH KINDS OF STEP MAY DECLARE AN ERROR PATH, and the two that may not are the
 * interesting half.** A `branch` is always `ran` — it did its job, which was to choose —
 * and a `pause` does not fail: a REJECTION is a person saying no, so carrying on past one
 * would be a workflow ignoring them. A copy of the engine's `FAILABLE_KINDS`.
 */
export const AUTOMATION_FAILABLE_KINDS = Object.freeze(["condition", "action", "lookup"]);

/**
 * The engine's own bounds, censused against it field by field.
 *
 * **EVERY ONE OF THESE IS A COPY, DECLARED AS ONE.** `worker.js`'s module graph is a
 * container image input, so importing the agent product would pull the whole of it into
 * the image; a copy with a census both ways is this repository's standard remedy. What
 * makes it safe is that `test/agent-send.test.mjs` — the one file that may import both
 * products — compares the two catalogs name by name, field by field and bound by bound.
 */
export const MAX_STEP_NOTE = 2000;
export const MAX_STEP_TEST = 400;
export const MAX_STEP_QUERY = 200;
export const MAX_STEP_ASK = 400;
export const MAX_WAIT_MINUTES = 60 * 24 * 14;
export const MAX_APPROVAL_HOURS = 24 * 14;

/** How many inputs one automation may declare — the column's own check constraint. */
export const MAX_AUTOMATION_INPUTS = 8;
/** And how long each of its parts may be. */
export const INPUT_LABEL_MAX = 120;
export const INPUT_DEFAULT_MAX = 2000;
/** How long a value handed to a run may be, and how long an approval's note may be. */
export const INPUT_VALUE_MAX = 4000;
export const DECISION_NOTE_MAX = 1000;

/** What a comparison may be, and what a timeout may be set to mean. */
export const AUTOMATION_TESTS = Object.freeze(["is", "is not", "contains", "is empty", "is not empty"]);
export const AUTOMATION_WAIT_MODES = Object.freeze(["for", "until"]);
export const AUTOMATION_TIMEOUTS = Object.freeze(["approve", "reject", "fail"]);
/** How an approval may be answered. */
export const AUTOMATION_VERDICTS = Object.freeze(["approved", "rejected"]);

/**
 * What a name may be — an input's, a step's `out`, a memory's key.
 *
 * **ONE RULE FOR ALL THREE, and it is the engine's `REF_NAME` and the memory column's own
 * CHECK constraint, in a third language.** A name is what `{{a name}}` refers to, so three
 * different rules would mean a name that saves in one place and cannot be referred to from
 * another.
 */
export const AGENT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;

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

/**
 * WHAT A NAMED VALUE IS — a DECLARED COPY of the engine's `VALUE_TYPES`, censused both ways.
 *
 * It is a different question from what a FIELD is: `AUTOMATION_STEPS`' field kinds are about
 * a control the form draws, and these are about a thing a step can produce and a later step
 * can refer to. `text` is the DEFAULT, so every input and every step that existed before
 * today keeps exactly the meaning it had.
 */
export const AUTOMATION_VALUE_TYPES = Object.freeze(["text", "number", "list"]);

/**
 * ⚠ **WHAT MAY BE USED WHERE — and it is deliberately not symmetric.** A number reads as
 * text, so `{{count}}` in a sentence is fine. Text does NOT read as a number
 * (`Number("nine")` is NaN and `Number("")` is 0, the second of which this repository has
 * recorded as a real defect), and a LIST reads as neither, because `String(["a"])` is
 * `"a"` and a one-element list would silently become its element.
 */
export const AUTOMATION_TYPE_ACCEPTS = Object.freeze({
  text: Object.freeze(["text", "number"]),
  number: Object.freeze(["number"]),
  list: Object.freeze(["list"]),
});

/** What a repeat goes over, and the bounds on it. Copies of the engine's, censused. */
export const AUTOMATION_LOOP_MODES = Object.freeze(["each", "times"]);
export const MAX_LOOP_ITERATIONS = 50;
export const MAX_LOOP_DEPTH = 2;

/** Sunday first, because that is the order every weekday index in this tree uses. */
export const AUTOMATION_DAYS = Object.freeze(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

/**
 * ⚠ **WHAT KINDS OF STEP AND OF FIELD EXIST, DECLARED HERE RATHER THAN AS A LITERAL IN A
 * GUARD.** Both are DECLARED COPIES of the engine's `STEP_KINDS` and `FIELD_KINDS`, censused
 * both ways in `test/agent-send.test.mjs` — the one file that may load both products. A guard
 * that listed them inline was a list frozen by its contents, which is this repository's own
 * recorded trap and went red on the first honest addition; now the addition has to reach both
 * catalogs or fail a census.
 *
 * `call` is the kind a subworkflow is: it neither acts, decides, looks anything up, branches
 * nor pauses — it names another automation, whose steps are copied in before the run starts.
 */
export const AUTOMATION_STEP_KINDS = Object.freeze(["condition", "action", "lookup", "branch", "pause", "call"]);
export const AUTOMATION_FIELD_KINDS = Object.freeze(["text", "days", "choice", "number", "time", "name", "id"]);

/**
 * ⚠ **HOW DEEP ONE AUTOMATION MAY RUN ANOTHER, AND HOW LONG THE FLATTENED LIST MAY BE.**
 * Copies of the engine's `MAX_SUBWORKFLOW_DEPTH` and `MAX_FLAT_STEPS`; the expansion itself
 * is the ENGINE's and has no counterpart here, because nothing on this side runs a workflow.
 */
export const MAX_SUBWORKFLOW_DEPTH = 2;
export const MAX_FLAT_STEPS = 200;

/** What an automation's id looks like — the database's own grammar, so a caller's typo is refused. */
const AUTOMATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
/**
 * ⚠ **WHAT A REFUSAL CALLS A FIELD, IN ONE PLACE.** The derivation was written out twice — in
 * the typed-reference message and in the generic field reader — which is two copies of one
 * rule, and the copy that drifts is whichever one somebody edits. `says` is what the field
 * declares and BOTH DOORS of the platform read it; absent means the field's NAME, which is
 * right for every field whose key is already the customer's own word (`days`, `hours`).
 */
const saidOf = (f) => (typeof f?.says === "string" && f.says ? f.says : f?.name);

const F = (o) => Object.freeze(o);

/**
 * `out` — the name a step's answer is saved under. ONE OBJECT, shared, because the form
 * draws the same control everywhere and the census has one shape to compare.
 *
 * **`says` IS WHAT A REFUSAL CALLS IT, and `out` needs one where the others do not.** Every
 * other field is named the way the form labels it (`days`, `text`, `query`, `ask`), so the
 * field name is already the customer's word; "out can't be empty" is about a key nothing on
 * their screen is called. Optional, and absent means the name — so no existing sentence
 * moves, which is why this is a field's own word rather than a second table of labels.
 */
const OUT = F({ name: "out", kind: "name", required: false, says: "the name for this step's answer" });

/**
 * ⚠ **THE ERROR-PATH CONTROLS ARE APPENDED RATHER THAN TYPED INTO EACH STEP.**
 *
 * They are the same two controls with the same meaning on every step that can fail, so
 * deriving them from the kind is what makes a fifth failable step next month carry them by
 * existing — and it is the engine's own `errorPathFields`, so the two lists cannot drift in
 * their order, their bounds or their words. `retries` is appended only where a retry is
 * really available, or it is a control that answers and is then refused.
 *
 * **THE OPTIONS ARE THE WALL:** `retry` is simply absent from a step whose answer a second
 * attempt could not change, so the generic reader's own refusal covers it and there is no
 * second rule beside the list.
 */
const errorPathFields = (retryable) => {
  const paths = retryable ? AUTOMATION_ERROR_PATHS : AUTOMATION_ERROR_PATHS.filter((p) => p !== "retry");
  const out = [F({ name: "on_error", kind: "choice", options: Object.freeze(paths),
    says: "what to do if this step doesn't work" })];
  if (retryable) {
    out.push(F({ name: "retries", kind: "number", required: true, min: 1, max: MAX_STEP_RETRIES,
      when: F({ on_error: Object.freeze(["retry"]) }), says: "how many more times to try" }));
  }
  return out;
};

/** A catalog entry, with its error path appended where its kind can fail. */
const withErrorPath = (one) => {
  const failable = AUTOMATION_FAILABLE_KINDS.includes(one.kind);
  const retryable = one.retryable === true;
  return F({
    ...one, failable, retryable,
    fields: failable ? Object.freeze([...one.fields, ...errorPathFields(retryable)]) : one.fields,
  });
};

export const AUTOMATION_STEPS = Object.freeze([
  F({
    type: "weekday",
    kind: "condition",
    label: "Only on certain days",
    does: "Carry on only on the days you pick. On any other day the rest of the workflow is skipped.",
    fields: Object.freeze([F({ name: "days", kind: "days", required: true, empty: "pick at least one day, or take this step out" })]),
  }),
  F({
    type: "if",
    kind: "branch",
    label: "If …",
    does: "Compare a value — an input, or an earlier step's answer — and run the steps under it only when the comparison holds. Put an \"Otherwise\" and an \"End\" below it.",
    fields: Object.freeze([
      F({ name: "left", kind: "text", required: true, max: MAX_STEP_TEST, refs: true,
          says: "the value being compared", empty: "say which value to compare — {{a name}} usually" }),
      F({ name: "op", kind: "choice", required: true, options: AUTOMATION_TESTS, says: "the comparison" }),
      F({ name: "right", kind: "text", required: true, max: MAX_STEP_TEST, refs: true, when: F({ op: Object.freeze(["is", "is not", "contains"]) }),
          says: "what it is compared against", empty: "say what to compare it against" }),
    ]),
  }),
  F({
    type: "otherwise",
    kind: "branch",
    label: "Otherwise …",
    does: "Begins the other arm of the \"If\" above it. The steps under this one run only when the comparison did not hold.",
    fields: Object.freeze([]),
    configless: true,
  }),
  F({
    type: "end",
    kind: "branch",
    label: "End of the if",
    does: "Closes the \"If\" above it. Everything after this runs either way.",
    fields: Object.freeze([]),
    configless: true,
  }),
  F({
    type: "repeat",
    kind: "branch",
    label: "Repeat …",
    does: "Runs the steps under it once for each thing in a list, or a fixed number of times. Put an \"End of the repeat\" below it.",
    fields: Object.freeze([
      F({ name: "mode", kind: "choice", required: true, options: AUTOMATION_LOOP_MODES, says: "what this repeats over" }),
      // ⚠ THE ONE FIELD IN THIS PRODUCT THAT ACCEPTS ONLY A LIST, and it is why the types
      // above exist: without a field that refuses text, a type is a label nothing reads.
      F({ name: "each", kind: "text", required: true, max: MAX_STEP_TEST, refs: true,
          accepts: "list", says: "the list to go through",
          empty: "say which list to go through — {{a name}}",
          when: F({ mode: Object.freeze(["each"]) }) }),
      F({ name: "times", kind: "number", required: true, min: 1, max: MAX_LOOP_ITERATIONS,
          says: "how many times", when: F({ mode: Object.freeze(["times"]) }) }),
      F({ name: "as", kind: "name", required: true, says: "what to call each one",
          when: F({ mode: Object.freeze(["each"]) }) }),
    ]),
  }),
  F({
    type: "endrepeat",
    kind: "branch",
    label: "End of the repeat",
    does: "Closes the \"Repeat\" above it. Everything after this runs once, when the loop has finished.",
    fields: Object.freeze([]),
    configless: true,
  }),
  F({
    type: "wait",
    kind: "pause",
    label: "Wait",
    does: "Pause here for a while, or until a time of day, and carry on afterwards. Nothing is held open while it waits.",
    fields: Object.freeze([
      F({ name: "mode", kind: "choice", required: true, options: AUTOMATION_WAIT_MODES, says: "the kind of wait" }),
      F({ name: "minutes", kind: "number", required: true, min: 1, max: MAX_WAIT_MINUTES, when: F({ mode: Object.freeze(["for"]) }),
          says: "the number of minutes to wait" }),
      F({ name: "at", kind: "time", required: true, when: F({ mode: Object.freeze(["until"]) }), says: "the time to wait until" }),
    ]),
  }),
  F({
    type: "approval",
    kind: "pause",
    // ITS RESUME IS A DECISION STORED UNDER THIS STEP'S ID, which is why it cannot go in a
    // loop. A DECLARED COPY of the engine's own flag, censused both ways.
    decided: true,
    label: "Wait for approval",
    does: "Pause and ask to be approved or rejected before carrying on. Say what happens if nobody answers in time.",
    fields: Object.freeze([
      F({ name: "ask", kind: "text", required: true, max: MAX_STEP_ASK, refs: true, says: "what is being approved",
          empty: "say what is being approved" }),
      F({ name: "hours", kind: "number", required: true, min: 1, max: MAX_APPROVAL_HOURS,
          says: "how many hours to wait for an answer" }),
      F({ name: "on_timeout", kind: "choice", required: true, options: AUTOMATION_TIMEOUTS,
          says: "what happens if nobody answers" }),
    ]),
  }),
  F({
    type: "knowledge",
    kind: "lookup",
    label: "Look something up",
    // ⚠ THE ONE STEP A SECOND ATTEMPT COULD ANSWER DIFFERENTLY, because it is the only one
    // that reaches the database. `memory` reads a snapshot taken when the execution was
    // accepted, `note` substitutes a string and `weekday` compares a date that is fixed for
    // the whole execution — so trying any of those again spends a step run to reach the
    // same answer, and `retry` is not among the options they offer.
    retryable: true,
    does: "Search this agent's reference material and save the passages that match, with the source they came from. Put {{a name}} in the search to use an input.",
    fields: Object.freeze([
      F({ name: "query", kind: "text", required: true, max: MAX_STEP_QUERY, refs: true, says: "that search",
          empty: "say what to search for" }),
      F({ ...OUT, required: true, empty: "give the answer a name, so a later step can use it" }),
    ]),
  }),
  F({
    type: "memory",
    kind: "lookup",
    label: "Use something remembered",
    does: "Read one of this agent's saved facts or preferences and save it under a name a later step can use.",
    fields: Object.freeze([
      F({ name: "key", kind: "name", required: true, says: "the saved fact to use",
          empty: "say which saved fact to use" }),
      F({ ...OUT, required: true, empty: "give the answer a name, so a later step can use it" }),
    ]),
  }),
  F({
    type: "note",
    kind: "action",
    label: "Save a note",
    does: "Write a line into this automation's results, so the run has something to show. Put {{a name}} anywhere to use an input or an earlier step's answer.",
    fields: Object.freeze([
      F({ name: "text", kind: "text", required: true, max: MAX_STEP_NOTE, refs: true, says: "that note",
          empty: "say what the note should say" }),
      OUT,
    ]),
  }),
  F({
    type: "workflow",
    kind: "call",
    label: "Run another automation",
    does: "Run the steps of another of this agent's automations here, as part of this one. Its steps are copied in as they are when this execution starts, so editing it afterwards does not change a run already going.",
    fields: Object.freeze([
      F({ name: "runs", kind: "id", required: true, says: "which automation to run",
          empty: "say which automation to run" }),
    ]),
  }),
].map(withErrorPath));

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
export function cleanWorkflow(v, catalog = AUTOMATION_STEPS, max = MAX_AUTOMATION_STEPS, inputs = []) {
  if (!Array.isArray(v)) return { error: "the steps have to arrive as a list" };
  if (v.length > max) return { error: `that's more steps than one automation can hold (${max})` };
  const byType = new Map(catalog.map((s) => [s.type, s]));
  const steps = [];
  // ⚠ WHAT A `{{reference}}` MAY NAME, ALONG THE PATH THAT REALLY REACHES IT — not a flat
  // list of every `out` written above it. A forward reference is refused for the same
  // reason a typo is (nothing produces it at the moment the step runs), and so is a value
  // produced only inside a branch that might not run: the first draft of this collected
  // every `out` into ONE set, so a name bound under `if` was "available" to the
  // `otherwise` arm and to every step past the `end`. It saved cleanly and resolved to
  // nothing at run time, on whichever path did not produce it.
  //
  // **A FRAME PER OPEN `if`, EACH ARM KEEPING ITS OWN ADDITIONS**, and only what BOTH arms
  // produce survives the rejoin — which is the one set of names every path out of the
  // branch really has. An `if` with no `otherwise` contributes nothing at all, because the
  // empty arm is a real path through the workflow.
  //
  // ⚠ IT IS A DECLARED COPY of the engine's `readWorkflow`, for the reason every copy in
  // this file is one: `worker.js`'s module graph is a container image input, so nothing
  // here may import `agent-builder/`. `test/agent-send.test.mjs` is the one file that may
  // load both, and it DRIVES the two over the same shapes and requires the same verdict —
  // comparing behaviour rather than source, because these two are written differently and
  // have to agree only about what they accept.
  // ⚠ **A NAME'S TYPE TRAVELS WITH IT, which is why these are maps rather than sets.** What
  // a reference may be used FOR is a property of what produced it. An input handed in as a
  // bare STRING is `text`, which is what every caller that existed before today hands in.
  const outer = new Map();
  for (const d of Array.isArray(inputs) ? inputs : []) {
    if (typeof d === "string") outer.set(d, "text");
    else if (d && typeof d === "object" && typeof d.name === "string") {
      outer.set(d.name, AUTOMATION_VALUE_TYPES.includes(d.type) ? d.type : "text");
    }
  }
  /** `{before, first, other, inElse, hasElse, loop}` — `first`/`other` are each arm's own. */
  const frames = [];
  const here = () => (frames.length ? frames[frames.length - 1] : null);
  const visible = () => {
    const f = here();
    if (!f) return outer;
    return new Map([...f.before, ...(f.inElse ? f.other : f.first)]);
  };
  const produce = (name, type = "text") => {
    const f = here();
    if (!f) outer.set(name, type);
    else (f.inElse ? f.other : f.first).set(name, type);
  };
  /**
   * How many blocks of one kind are open — counted from the FRAMES rather than from a
   * number kept beside them, because the frames are what is really nested and a counter is
   * a second copy of the same fact.
   */
  const depthOf = (loop) => frames.filter((f) => f.loop === loop).length;
  // ⚠ NAMES AN ARM PRODUCED THAT DID NOT SURVIVE ITS REJOIN, remembered for the SENTENCE
  // and never for visibility — nothing below the `end` may name one. Without it the frame
  // is gone by then, so the commonest shape of this mistake (bind under `if`, use after
  // the branch) gets the one sentence that sends somebody hunting a misspelling that is
  // not there.
  const armOnly = new Set();
  for (let i = 0; i < v.length; i++) {
    const at = i + 1;
    const raw = v[i];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: `step ${at} didn't arrive as a step` };
    }
    const def = byType.get(typeof raw.type === "string" ? raw.type : "");
    if (!def) return { error: `step ${at}: this platform has no step called ${String(raw.type ?? "(nothing)")}` };
    /**
     * ⚠ **A STEP WHOSE RESUME IS A STORED DECISION MAY NOT GO IN A LOOP.**
     *
     * `agent.automation_runs.decisions` is keyed by the STEP'S ID and the first decision at a
     * key stands, so inside a `repeat` the same id comes round again with an answer already
     * recorded — every round after the first would take the first round's verdict with
     * nobody asked, which is an approval nobody gave rather than a run that gets stuck.
     *
     * DERIVED FROM THE CATALOG'S OWN FLAG, and the sentence is the engine's word for word:
     * the two doors refuse the same shape with the same words or a customer gets a different
     * answer depending on which one turned them away.
     */
    if (def.decided === true && depthOf(true) > 0) {
      return { error: `step ${at}: "${def.label}" cannot go inside a "Repeat" — one answer would stand for every time round` };
    }
    const one = { id: `s${at}`, type: def.type };
    for (const f of def.fields) {
      // ⚠ A FIELD THAT DOES NOT APPLY IS NOT READ AND IS NOT STORED. `when` says which
      // answers make it relevant — a wait's minutes only when it is waiting FOR a while —
      // and storing the other one would be keeping a value nothing will ever read, which
      // the form would then draw back as though it mattered.
      if (!fieldApplies(f, one)) continue;
      const got = readStepField(raw[f.name], f);
      if (got.error) return { error: `step ${at}: ${got.error}` };
      // A FIELD THE CALLER DID NOT NAME IS NOT SENT. `required` is what decides whether
      // that is a refusal; an optional one absent simply is not stored.
      if (got.value !== undefined) one[f.name] = got.value;
      if (f.refs === true && typeof got.value === "string") {
        const canSee = visible();
        // WHAT THIS FIELD CAN USE. Absent means `text`, which is every field that existed
        // before the loop — so the test below is a no-op for all of them.
        const wants = AUTOMATION_VALUE_TYPES.includes(f.accepts) ? f.accepts : "text";
        for (const name of refsInText(got.value)) {
          if (canSee.has(name)) {
            // ⚠ THE TYPE IS CHECKED WHILE IT IS STILL SOMEBODY'S FORM, and the sentence is
            // the engine's word for word — the two are censused on their VERDICTS, so a
            // refusal that differs is a customer told two different things by two doors.
            const gotType = canSee.get(name) ?? "text";
            if (!(AUTOMATION_TYPE_ACCEPTS[wants] ?? []).includes(gotType)) {
              const said = saidOf(f);
              const word = (t) => (t === "list" ? "a list" : t === "number" ? "a number" : "text");
              return { error: `step ${at}: "${name}" is ${word(gotType)}, and ${said} needs ${word(wants)}` };
            }
            continue;
          }
          {
            // ⚠ TWO REFUSALS, BECAUSE THEY NEED DIFFERENT THINGS DONE ABOUT THEM. A name
            // nothing anywhere produces is a typo; a name produced on some OTHER path is a
            // real value the customer can see on their own form, and telling them it does
            // not exist would send them looking for a misspelling that is not there.
            // The open frames cover a reference still INSIDE the branch; `armOnly` covers
            // one below it. `here()` is itself in `frames`, so a third test for the arm
            // being stood in would be dead code.
            const onlyInAnArm = frames.some((fr) => fr.first.has(name) || fr.other.has(name))
              || armOnly.has(name);
            return { error: onlyInAnArm
              ? `step ${at}: "${name}" is only produced inside a branch that might not run — produce it in both arms, or move the step that uses it inside`
              : `step ${at}: nothing here produces a value called "${name}"` };
          }
        }
      }
    }
    // ⚠ **A STEP THAT CANNOT FAIL REFUSES AN ERROR PATH RATHER THAN DROPPING IT.** The form
    // never offers one on a branch or a pause, so this can only arrive from an agent's tool
    // or a hand-written request — and a key quietly dropped is a control that saves, draws
    // back and does nothing. The sentence is the engine's, word for word.
    //
    // **ASKED AFTER THE STEP'S OWN FIELDS, and the order is the engine's.** A person filled
    // those in; only a tool can produce this one, so a refusal about their own answer has to
    // win — otherwise a step with a bad field AND a stray error path is refused for
    // different reasons by the two doors, which a census over both caught.
    if (!def.failable && raw.on_error !== undefined && raw.on_error !== null && raw.on_error !== "") {
      return { error: `step ${at}: ${def.label} has no failures to handle` };
    }
    // ITS OWN `out` IS ADDED AFTER ITS OWN REFERENCES ARE CHECKED, so a step cannot refer
    // to the answer it is about to produce.
    // **THE TYPE IS THE STEP'S OWN**, off the catalog entry rather than off the stored row.
    if (typeof one.out === "string" && one.out) produce(one.out, stepProduces(def));
    // AND THE FRAMES FOLLOW THE BLOCK. The list is checked for balance below, so a stray
    // `otherwise` or `end` here simply finds no frame and is left to that refusal.
    if (def.type === "if") {
      frames.push({ before: visible(), first: new Map(), other: new Map(), inElse: false, hasElse: false, loop: false });
    } else if (def.type === "repeat") {
      // ⚠ A LOOP IS A SCOPE WITH ONE ARM, AND THE SECOND ARM IS THE ZERO-ITERATIONS PATH:
      // a list can be empty, so the body may never run — which makes the rejoin below
      // exactly the rule an `if` with no `otherwise` already has.
      if (depthOf(true) >= MAX_LOOP_DEPTH) {
        return { error: `step ${at}: that is more repeats inside each other than one workflow can have (${MAX_LOOP_DEPTH})` };
      }
      frames.push({ before: visible(), first: new Map(), other: new Map(), inElse: false, hasElse: false, loop: true });
      // WHAT EACH ONE IS CALLED IS VISIBLE INSIDE THE BODY AND NOWHERE ELSE, which is the
      // frame doing the work rather than a rule about the name.
      if (typeof one.as === "string" && one.as) produce(one.as, "text");
    } else if (def.type === "otherwise") {
      const f = here();
      if (f) { f.inElse = true; f.hasElse = true; }
    } else if (def.type === "end" || def.type === "endrepeat") {
      const f = frames.pop();
      // ONLY WHAT BOTH ARMS PRODUCE SURVIVES, and an `if` with no `otherwise` has an empty
      // second arm, so nothing does. A LOOP is that shape too.
      if (f) {
        const both = f.hasElse ? [...f.first.keys()].filter((x) => f.other.has(x)) : [];
        for (const n of both) produce(n, f.first.get(n));
        for (const n of [...f.first.keys(), ...f.other.keys()]) if (!both.includes(n)) armOnly.add(n);
      }
    }
    steps.push(one);
  }
  // ⚠ THE BRANCHES HAVE TO BALANCE, and this is the one structural rule that is not about
  // a single step. Refused HERE, while it is still somebody's form: a stored list whose
  // `if` has no `end` is one the executor has to fail whole, because running the steps it
  // can read is running a workflow nobody wrote.
  const shape = branchShape(steps);
  if (shape.error) return { error: shape.error };
  // ⚠ `produces` STAYS A LIST OF NAMES, because that is what the cross-product census
  // compares both ways and what every caller reads; `types` is the same scope read the
  // other way, for a caller that needs it.
  return { steps, produces: [...outer.keys()], types: Object.fromEntries(outer) };
}

/**
 * What kind of value a step's answer is.
 *
 * ⚠ **IT IS THE STEP'S OWN FACT AND IS NEVER TAKEN FROM A STORED ROW.** A row is caller
 * input; a catalog entry is code. Absent means `text`, which is what every step here
 * produces — so this reads as a constant today and is the hop that stops being one the
 * moment a step produces something else.
 */
function stepProduces(def) {
  return AUTOMATION_VALUE_TYPES.includes(def?.produces) ? def.produces : "text";
}

/**
 * `{{name}}` — the same syntax the engine resolves, in the one place the site needs it.
 *
 * **A MALFORMED REFERENCE IS LEFT ALONE, NOT REFUSED.** `{{ }}` and `{{Name}}` match the
 * braces and not the name rule, so they stay literal text — which is the only reading that
 * lets somebody write about braces. What is refused is a WELL-FORMED name nothing produces.
 */
export function refsInText(text) {
  const out = [];
  if (typeof text !== "string") return out;
  for (const m of text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) {
    if (AGENT_NAME_RE.test(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Does this field apply, given the answers already read for its own step? */
function fieldApplies(f, soFar) {
  if (!f.when) return true;
  for (const [on, allowed] of Object.entries(f.when)) {
    if (!allowed.includes(soFar[on])) return false;
  }
  return true;
}

/**
 * Match every `if` to its `otherwise` and its `end`, by DEPTH.
 *
 * **THE SAME ALGORITHM THE ENGINE RUNS, and it is a copy for the same reason the catalog
 * is.** What keeps them in step is that the answer is structural rather than a matter of
 * taste: a list of types either balances or does not, and the census drives both sides over
 * the same shapes.
 */
export const AUTOMATION_BLOCK_SHAPES = Object.freeze([
  Object.freeze({ open: "if", middle: "otherwise", close: "end",
                  opened: "If", middled: "Otherwise", closed: "End of the if" }),
  Object.freeze({ open: "repeat", middle: null, close: "endrepeat",
                  opened: "Repeat", middled: null, closed: "End of the repeat" }),
]);

export function branchShape(steps, shapes = AUTOMATION_BLOCK_SHAPES) {
  const open = [];
  const list = Array.isArray(steps) ? steps : [];
  const byOpen = new Map(shapes.map((sh) => [sh.open, sh]));
  const byMiddle = new Map(shapes.filter((sh) => sh.middle).map((sh) => [sh.middle, sh]));
  const byClose = new Map(shapes.map((sh) => [sh.close, sh]));
  for (let i = 0; i < list.length; i++) {
    const at = i + 1;
    const type = list[i]?.type;
    if (byOpen.has(type)) open.push({ at: i, elseAt: null, shape: byOpen.get(type) });
    else if (byMiddle.has(type)) {
      const sh = byMiddle.get(type);
      const top = open[open.length - 1];
      if (!top) return { error: `step ${at}: "${sh.middled}" has no "${sh.opened}" above it` };
      // ⚠ A MIDDLE MARKER BELONGS TO ITS OWN OPENER. An `Otherwise` directly inside a
      // `Repeat` has no `If` to be the other arm of, and reading it as the repeat's would
      // be a workflow nobody wrote.
      if (top.shape !== sh) {
        return { error: `step ${at}: "${sh.middled}" has no "${sh.opened}" above it — the nearest block is a "${top.shape.opened}"` };
      }
      if (top.elseAt !== null) return { error: `step ${at}: that "${sh.opened}" already has an "${sh.middled}"` };
      top.elseAt = i;
    } else if (byClose.has(type)) {
      const sh = byClose.get(type);
      const top = open[open.length - 1];
      if (!top) return { error: `step ${at}: "${sh.closed}" has no "${sh.opened}" above it` };
      // ⚠ **A CLOSER MUST CLOSE ITS OWN KIND OF BLOCK.** With two shapes a list can balance
      // by COUNT and pair a loop with a branch's end — a workflow the executor would then
      // run. Refused by name and by position, at save time.
      if (top.shape !== sh) {
        return { error: `step ${at}: "${sh.closed}" closes a "${sh.opened}", and the nearest block above it is a "${top.shape.opened}"` };
      }
      open.pop();
    }
  }
  if (open.length) {
    const top = open[open.length - 1];
    return { error: `step ${top.at + 1}: that "${top.shape.opened}" has no "${top.shape.closed}" below it` };
  }
  return { ok: true };
}

/**
 * What an automation asks for when it is started.
 *
 * **A DECLARATION, NOT A VALUE**: a name, the words the form puts beside the box, whether
 * it has to be answered, and what to use when it is not. **The NAME is what a
 * `{{reference}}` may say**, so it follows the one identifier rule this product has rather
 * than a rule of its own.
 */
export function cleanInputs(v, max = MAX_AUTOMATION_INPUTS) {
  if (v === undefined || v === null) return { inputs: [] };
  if (!Array.isArray(v)) return { error: "the inputs have to arrive as a list" };
  if (v.length > max) return { error: `that's more things to ask for than one automation can have (${max})` };
  const inputs = [];
  const seen = new Set();
  for (let i = 0; i < v.length; i++) {
    const at = i + 1;
    const d = v[i];
    if (d === null || typeof d !== "object" || Array.isArray(d)) return { error: `input ${at} didn't arrive as an input` };
    const name = typeof d.name === "string" ? d.name.trim().toLowerCase() : "";
    if (!name) return { error: `input ${at}: give it a name, so a step can use it` };
    if (!AGENT_NAME_RE.test(name)) {
      return { error: `input ${at}: "${d.name}" can't be a name — use lower-case letters, digits and underscores, starting with a letter` };
    }
    // TWO INPUTS OF ONE NAME IS A REFERENCE NOBODY CAN RESOLVE — which of them?
    if (seen.has(name)) return { error: `input ${at}: there is already something called "${name}"` };
    seen.add(name);
    const label = typeof d.label === "string" ? d.label.trim() : "";
    if (label.length > INPUT_LABEL_MAX) return { error: `input ${at}: that label is longer than a label can be (${INPUT_LABEL_MAX} characters)` };
    const dflt = typeof d.default === "string" ? d.default : "";
    if (dflt.length > INPUT_DEFAULT_MAX) return { error: `input ${at}: that default is longer than it can be (${INPUT_DEFAULT_MAX} characters)` };
    // REFUSED, NEVER COERCED: `Boolean("false")` is `true`, and a required flag that came
    // from a string would make every input required.
    if (d.required !== undefined && typeof d.required !== "boolean") {
      return { error: `input ${at}: whether it has to be answered didn't arrive as a yes or no` };
    }
    // ⚠ **WHAT KIND OF THING IT IS, REFUSED RATHER THAN COERCED, AND ABSENT MEANS `text`.**
    // Absent is what every input stored before today is, and text is what every one of them
    // held — so nothing moves. A type nobody recognises is a REFUSAL rather than a fallback
    // to text: a `list` misspelt `lsit` would be stored as text, and the loop that meant to
    // iterate it would be refused at save time for a reason nobody could see on the form.
    if (d.type !== undefined && !AUTOMATION_VALUE_TYPES.includes(d.type)) {
      return { error: `input ${at}: "${String(d.type)}" isn't a kind of thing — it has to be one of: ${AUTOMATION_VALUE_TYPES.join(", ")}` };
    }
    const type = d.type === undefined ? "text" : d.type;
    // A DEFAULT IS TEXT EVEN FOR A LIST, because it is what the form puts in the box; a
    // list's default is the empty list, which is what an unanswered one already means.
    inputs.push({ name, label: label || name, required: d.required === true, default: dflt, type });
  }
  return { inputs };
}

/**
 * The values handed to one run, against what the automation asks for.
 *
 * **THE SAME THREE REFUSALS `agent.accept_automation_run` MAKES, and that is deliberate
 * rather than wasteful.** The database's copy is the wall — it reads the declaration out of
 * the row it has already locked — and this one exists so the answer reaches somebody as a
 * sentence about the box they filled in rather than as an error code.
 */
export function cleanRunInput(v, inputs) {
  if (v === undefined || v === null) return { input: {} };
  if (typeof v !== "object" || Array.isArray(v)) return { error: "the answers have to arrive as an object" };
  const decl = Array.isArray(inputs) ? inputs : [];
  const out = {};
  for (const k of Object.keys(v)) {
    const d = decl.find((one) => one?.name === k);
    // NAMED, NEVER IGNORED. A filter on somebody's input is a silent drop; a check is the
    // only thing that tells them the field they filled in went nowhere.
    if (!d) return { error: `this automation doesn't ask for anything called "${k}"` };
    // ⚠ **EACH ANSWER IS READ AS ITS DECLARED TYPE**, and `text` is what an input with no
    // type is — so every automation stored before today reads exactly as it did.
    const want = AUTOMATION_VALUE_TYPES.includes(d.type) ? d.type : "text";
    if (want === "list") {
      if (!Array.isArray(v[k])) return { error: `"${k}" didn't arrive as a list` };
      if (v[k].length > MAX_LOOP_ITERATIONS) {
        // THE SAME BOUND A LOOP GOES ROUND, because this is what a loop goes round — a
        // longer list saved here is one the execution would refuse, which is a refusal
        // arriving days after the form was filled in.
        return { error: `"${k}" has ${v[k].length} things in it, and an automation can go through at most ${MAX_LOOP_ITERATIONS}` };
      }
      let total = 0;
      for (const one of v[k]) {
        if (typeof one !== "string") return { error: `everything in "${k}" has to be text` };
        total += one.length;
      }
      if (total > INPUT_VALUE_MAX) return { error: `"${k}" is longer than an answer can be (${INPUT_VALUE_MAX} characters)` };
      out[k] = [...v[k]];
      continue;
    }
    if (want === "number") {
      // ⚠ REFUSED, NEVER COERCED: `Number("")` is 0 and `Number("nine")` is NaN. A number
      // that arrived as text is a form sending the wrong thing, and reading it as zero is
      // this repository's own recorded defect.
      if (typeof v[k] !== "number" || !Number.isFinite(v[k])) return { error: `"${k}" didn't arrive as a number` };
      out[k] = v[k];
      continue;
    }
    if (typeof v[k] !== "string") return { error: `"${k}" didn't arrive as text` };
    if (v[k].length > INPUT_VALUE_MAX) return { error: `"${k}" is longer than an answer can be (${INPUT_VALUE_MAX} characters)` };
    out[k] = v[k];
  }
  for (const d of decl) {
    if (d?.required !== true) continue;
    const want = AUTOMATION_VALUE_TYPES.includes(d.type) ? d.type : "text";
    if (!Object.hasOwn(out, d.name)) {
      // ⚠ A DEFAULT IS TEXT ON THE FORM, so only a TEXT input can be satisfied by one. A
      // required list or number left out is unanswered whatever the default box holds —
      // reading `""` as a list would be a coercion, and as a number it would be zero.
      const given = want === "text" && typeof d.default === "string" ? d.default : "";
      if (want !== "text" || given.trim() === "") return { error: `${d.label || d.name} has to be filled in` };
      continue;
    }
    // AND AN ANSWER THAT ARRIVED EMPTY IS STILL UNANSWERED, whichever kind it is.
    const got = out[d.name];
    const empty = want === "list" ? got.length === 0 : want === "number" ? false : String(got).trim() === "";
    if (empty) return { error: `${d.label || d.name} has to be filled in` };
  }
  return { input: out };
}

/**
 * One field of one step.
 *
 * **REFUSED, NEVER COERCED.** `String(["mon"])` is `"mon"`, so a coercing reader turns a
 * nested list into a day and nothing complains — and `Boolean("false")` is `true`. Every
 * kind below asks the type first.
 */
function readStepField(raw, f) {
  // WHAT A REFUSAL CALLS THIS FIELD. The name is the fallback, so a field with no `says`
  // reads exactly as it always did.
  const said = saidOf(f);
  // ⚠ WHAT TO SAY WHEN A REQUIRED FIELD IS BLANK, off the field's own declaration and the
  // ENGINE's own words — because that is the sentence a customer reads, and the two doors
  // used to say different things about the same box: `"left can't be empty"` here against
  // `"say which value to compare"` there. Found by the cross-product census, which had
  // never driven an empty required field; `${said} can't be empty` is the fallback, which
  // is what every field with no sentence of its own already got.
  const blank = typeof f.empty === "string" && f.empty ? f.empty : `${said} can't be empty`;
  if (f.kind === "text") {
    if (raw === undefined || raw === null) {
      return f.required ? { error: blank } : { value: undefined };
    }
    if (typeof raw !== "string") return { error: `${said} didn't arrive as text` };
    const text = raw.trim();
    if (!text) return f.required ? { error: blank } : { value: undefined };
    if (f.max && text.length > f.max) return { error: `${said} is longer than it can be (${f.max} characters)` };
    return { value: text };
  }
  if (f.kind === "days") {
    if (!Array.isArray(raw)) return { error: "pick which days it should run on" };
    if (!raw.length) return { error: blank };
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
  if (f.kind === "choice") {
    // ⚠ **AN OPTIONAL CHOICE ABSENT IS NOT A REFUSAL**, which every other kind here already
    // knew and this one did not — every choice was required until an error path became one
    // that is not. Without it, a step naming no `on_error` is refused for leaving alone a
    // control whose whole point is that absent means the default.
    if (raw === undefined || raw === null || raw === "") {
      if (f.required !== true) return { value: undefined };
    }
    // ONE OF A FIXED SET, BY EXACT MATCH, and never the first option as a default: an
    // unrecognised answer is a control the form drew differently from the one this reads.
    if (typeof raw !== "string" || !f.options.includes(raw)) {
      return { error: `${said} has to be one of: ${f.options.join(", ")}` };
    }
    return { value: raw };
  }
  if (f.kind === "number") {
    if (raw === undefined || raw === null || raw === "") {
      return f.required ? { error: `${said} has to be a whole number` } : { value: undefined };
    }
    // REFUSED, NEVER COERCED OR CLAMPED. `Number("")` is 0 and `Number("3 days")` is NaN,
    // and a clamp would store a bound nobody chose as though they had.
    if (typeof raw !== "number" || !Number.isInteger(raw)) return { error: `${said} has to be a whole number` };
    if (f.min !== undefined && raw < f.min) return { error: `${said} has to be between ${f.min} and ${f.max}` };
    if (f.max !== undefined && raw > f.max) return { error: `${said} has to be between ${f.min} and ${f.max}` };
    return { value: raw };
  }
  if (f.kind === "time") {
    if (raw === undefined || raw === null || raw === "") {
      return f.required ? { error: `${said} has to be a time like 09:00` } : { value: undefined };
    }
    if (typeof raw !== "string") return { error: `${said} has to be a time like 09:00` };
    // WHOLE MINUTES ON THE 24-HOUR CLOCK, which is what the form offers and what the
    // column stores; a stored 09:00:30 would be a schedule nothing can draw.
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
    if (!m) return { error: `${said} has to be a time like 09:00, on the 24-hour clock` };
    return { value: `${m[1]}:${m[2]}` };
  }
  if (f.kind === "id") {
    // ⚠ **AN IDENTIFIER, NOT A NAME.** A name is something a person typed and can be
    // lower-cased into shape; an id is the database's own and is refused rather than
    // repaired, because a repaired id names a different row or none. Folded to lower case
    // only, which is what a uuid already is.
    if (raw === undefined || raw === null || raw === "") {
      return f.required ? { error: blank } : { value: undefined };
    }
    if (typeof raw !== "string") return { error: `${said} didn't arrive as an automation` };
    const id = raw.trim().toLowerCase();
    if (!id) return f.required ? { error: blank } : { value: undefined };
    if (!AUTOMATION_ID.test(id)) return { error: `${said} didn't arrive as an automation` };
    return { value: id };
  }
  if (f.kind === "name") {
    if (raw === undefined || raw === null || raw === "") {
      return f.required ? { error: blank } : { value: null };
    }
    if (typeof raw !== "string") return { error: `${said} didn't arrive as a name` };
    const name = raw.trim().toLowerCase();
    if (!AGENT_NAME_RE.test(name)) {
      return { error: `"${raw}" can't be a name — use lower-case letters, digits and underscores, starting with a letter` };
    }
    return { value: name };
  }
  // A FIELD KIND THIS DOES NOT KNOW IS A REFUSAL, never a pass. It can only arrive from
  // a catalog entry somebody added without adding its rule, and passing it through would
  // store whatever the caller sent under a name the form invented.
  return { error: `${said} is configured in a way this can't read` };
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
    // WHAT IT ASKS FOR WHEN IT IS STARTED. `[]` for an automation that asks nothing,
    // which is a real answer and what every automation made before this had.
    inputs: Array.isArray(r?.inputs) ? r.inputs : [],
    nextRunAt: typeof r?.next_run_at === "string" ? r.next_run_at : null,
    updatedAt: typeof r?.updated_at === "string" ? r.updated_at : null,
  };
}

/**
 * One source of reference material, as the browser reads it.
 *
 * **WITHOUT ITS MATERIAL, unless the caller asked for one source in particular.** A list of
 * names is what the list is; sending twenty documents to draw it is four megabytes to
 * render a few lines.
 */
export function knowledgeRow(r) {
  return {
    id: typeof r?.id === "string" ? r.id : "",
    title: typeof r?.title === "string" ? r.title : "",
    format: KNOWLEDGE_FORMATS.includes(r?.format) ? r.format : "text",
    // THE VERSION IS WHAT A RUN QUOTES BACK, so a row whose version cannot be read says
    // nothing rather than saying 1 — `null` is "we do not know", and 1 is a claim.
    version: Number.isInteger(r?.version) ? r.version : null,
    at: typeof r?.created_at === "string" ? r.created_at : null,
    updatedAt: typeof r?.updated_at === "string" ? r.updated_at : null,
  };
}

/** One saved fact, with where it came from and when it last changed. */
export function memoryRow(r) {
  return {
    id: typeof r?.id === "string" ? r.id : "",
    key: typeof r?.key === "string" ? r.key : "",
    value: typeof r?.value === "string" ? r.value : "",
    // ⚠ WHERE IT CAME FROM, and an unreadable one is `person`. **That default WAS "the
    // only source anything can write today" and is not any more**: an agent holding the
    // `remember` tool writes `run`, which is set by the tool itself and can never come
    // from a model's arguments. The default stays `person` because it is the reading that
    // claims LESS — saying a person typed something they typed is right, and saying a run
    // learned something nobody can point at is a provenance nobody can correct.
    source: MEMORY_SOURCES.includes(r?.source) ? r.source : "person",
    version: Number.isInteger(r?.version) ? r.version : null,
    at: typeof r?.created_at === "string" ? r.created_at : null,
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
export const AUTOMATION_STATES = Object.freeze(["queued", "done", "skipped", "failed", "missed", "paused", "waiting", "rejected"]);

/** How many sources one agent may hold, how long each may be, and what a source is. */
export const MAX_KNOWLEDGE = 20;
export const KNOWLEDGE_TITLE_MAX = 200;
export const KNOWLEDGE_BODY_MAX = 200000;
export const KNOWLEDGE_FORMATS = Object.freeze(["text", "markdown"]);

/** How much one agent may remember, and how long one memory may be. */
export const MAX_MEMORIES = 100;
/**
 * How many waiting tool calls one read hands back.
 *
 * **IT IS THE DATABASE'S OWN CEILING, not a second one beside it.**
 * `agent.pending_approvals` clamps its limit to 100, so asking for more is asking for
 * something the function will not give — and a screen built on a bound the server does
 * not share is one that silently shows a short list as a whole one.
 */
export const MAX_TOOL_APPROVALS = 100;
export const MEMORY_VALUE_MAX = 4000;
/** Where a memory came from. `run` exists for the day extraction does; nothing writes it. */
export const MEMORY_SOURCES = Object.freeze(["person", "run"]);

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
  const waiting = r?.waiting && typeof r.waiting === "object" && !Array.isArray(r.waiting) ? r.waiting : null;
  // ⚠ **`waiting` IS TOLD FROM `queued` BY THE EXECUTION ROW, not by the run's status.**
  // A suspended execution has a `started` entry and no `stopped` one, so the run says
  // `running` — which is true and useless: the difference between "about to be picked up"
  // and "waiting until Tuesday" is the whole of what somebody looking at it needs.
  const state = r?.run_status !== "stopped"
    ? (waiting ? "waiting" : "queued")
    : AUTOMATION_STATES.includes(reason) && reason !== "queued" && reason !== "waiting" ? reason : "failed";
  return {
    id: typeof r?.id === "string" ? r.id : "",
    automationId: typeof r?.automation_id === "string" ? r.automation_id : "",
    trigger: r?.trigger === "schedule" ? "schedule" : "manual",
    occurrence: typeof r?.occurrence === "string" ? r.occurrence : null,
    state,
    // WHAT IT SAVED, WHY IT STOPPED, OR WHAT BROKE — one of the three, never two.
    // **A REJECTION HAS A `why` AND DELIBERATELY NO `result`**: somebody said no, so the
    // automation produced nothing it was allowed to produce, and carrying the last note
    // forward would make a refusal read like a success in every reader that shows the
    // result first.
    result: state === "done" && typeof stop?.result === "string" ? stop.result : null,
    why: (state === "skipped" || state === "rejected") && typeof stop?.why === "string" ? stop.why : null,
    error: state === "failed" && typeof stop?.error === "string" ? stop.error : null,
    on: typeof stop?.on === "string" ? stop.on : null,
    // ⚠ **HOW MANY STEPS FAILED AND WERE CARRIED PAST, and it is why a finished run is not
    // automatically a run where everything worked.** A step declaring `continue` keeps its
    // own `failed` outcome and the workflow runs on, so `done` alone would be a success
    // reported over a failure nobody reads. Only on `done`: on any other state the reason
    // already says what happened, and a count beside it would invite drawing both.
    carried: state === "done" && Number.isInteger(stop?.carried) && stop.carried > 0 ? stop.carried : 0,
    missed: Number.isInteger(r?.missed) ? r.missed : null,
    outcomes: Array.isArray(r?.outcomes) ? r.outcomes : [],
    steps: Array.isArray(r?.steps) ? r.steps : [],
    at: typeof r?.created_at === "string" ? r.created_at : null,
    finishedAt: typeof r?.finished_at === "string" ? r.finished_at : null,

    // ── how far it got, what it holds, and what it is waiting for ────────────
    // **THE VALUES ARE SHOWN, and that is deliberate.** They are the account's own inputs
    // and its own steps' answers, and showing what a run actually used is the difference
    // between a history and a list of timestamps.
    position: Number.isInteger(r?.position) ? r.position : 0,
    values: r?.vars && typeof r.vars === "object" && !Array.isArray(r.vars) ? r.vars : {},
    input: r?.input && typeof r.input === "object" && !Array.isArray(r.input) ? r.input : {},
    waiting: waiting ? {
      // ONLY WHAT SOMEBODY LOOKING AT IT NEEDS: which step, which kind, what is being
      // asked, and when it runs out. Never the whole stored object, so a field added to a
      // pause cannot reach a screen nobody has written yet.
      kind: waiting.kind === "approval" ? "approval" : "wait",
      step: typeof waiting.step === "string" ? waiting.step : "",
      ask: typeof waiting.ask === "string" ? waiting.ask : null,
      onTimeout: AUTOMATION_TIMEOUTS.includes(waiting.on_timeout) ? waiting.on_timeout : null,
      until: typeof r?.wait_until === "string" ? r.wait_until : null,
    } : null,
    decisions: r?.decisions && typeof r.decisions === "object" && !Array.isArray(r.decisions) ? r.decisions : {},
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
  "/api/agent/automation-approve": "POST",
  // ── reference material and memory ─────────────────────────────────────────
  "/api/agent/knowledge": "GET",
  "/api/agent/knowledge-save": "POST",
  "/api/agent/knowledge-delete": "POST",
  "/api/agent/memory": "GET",
  "/api/agent/memory-save": "POST",
  "/api/agent/memory-delete": "POST",
  // ── a tool call waiting for a person ──────────────────────────────────────
  // ⚠ NAMED `tool-*` BECAUSE THIS PRODUCT ALREADY HAS AN `approval` THAT IS NOT THIS
  // ONE. `/api/agent/automation-approve` answers an approval STEP inside a workflow —
  // a place in a list of steps somebody wrote. These answer one TOOL CALL a model made
  // inside a conversation, identified by where it sits in that conversation. Two
  // different things wearing one word is how a screen comes to send the wrong one.
  "/api/agent/tool-approvals": "GET",
  "/api/agent/tool-approve": "POST",
  // ⚠ WITHDRAWING IS ITS OWN ROUTE AND NOT A THIRD VERDICT ON `tool-approve`. Taking a
  // request back is not deciding it, and the model is told a different thing — so the two
  // cannot share a door, or a screen sending the wrong field would turn a withdrawal into a
  // rejection somebody never made.
  "/api/agent/tool-withdraw": "POST",
  // ── a permission taken away, and a run stopped ────────────────────────────
  // NAMED FOR WHAT THEY ACT ON. `tool-revoke` is about ONE TOOL of one agent, for ever until
  // it is restored; `run-cancel` is about ONE RUN. Neither is the settings form, which decides
  // what the NEXT run is accepted with.
  "/api/agent/tool-revoke": "POST",
  "/api/agent/tool-restore": "POST",
  "/api/agent/revoked-tools": "GET",
  "/api/agent/run-cancel": "POST",
});

/** Approve, or reject. Nothing else, and never a default. */
export const TOOL_VERDICTS = Object.freeze(["approved", "rejected"]);
/** How long a decider's note may be. The column's own bound. */
export const TOOL_NOTE_MAX = 2000;

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

/**
 * One tool call waiting for a person, as the screen reads it.
 *
 * **IT FAILS CLOSED ON THE ARGUMENTS**, which is the field the whole decision is about:
 * a row whose `args` cannot be read as an object answers `{}` and the screen says it has
 * nothing to show, rather than drawing a person a decision they cannot see the subject
 * of. Approving what you were not shown is the one mistake here that cannot be taken back.
 */
export function toolApprovalRow(r) {
  const args = r?.args && typeof r.args === "object" && !Array.isArray(r.args) ? r.args : {};
  return {
    id: typeof r?.id === "string" ? r.id : "",
    run: typeof r?.run === "string" ? r.run : "",
    agent: typeof r?.agent === "string" ? r.agent : null,
    tool: typeof r?.tool === "string" ? r.tool : "",
    args,
    step: Number.isInteger(r?.step) ? r.step : 0,
    index: Number.isInteger(r?.index) ? r.index : 0,
    requestedAt: typeof r?.requestedAt === "string" ? r.requestedAt : null,
  };
}

/** The one answer for "not yours" and "no such agent". */
const NO_AGENT = () => no(404, "that agent isn't here any more");

/** And its counterpart, for the same reason: not found, never forbidden. */
const NO_AUTOMATION = () => no(404, "that automation isn't here any more");

/**
 * The same answer for three more things, and for the same reason every time.
 *
 * **NOT FOUND, NEVER FORBIDDEN.** Another account's execution, source or memory and one
 * that does not exist answer identically, because the difference between them is
 * information: "you may not touch that" tells a stranger the id they guessed is real.
 */
const NO_EXECUTION = () => no(404, "that run isn't here any more");
const NO_SOURCE = () => no(404, "that source isn't here any more");
const NO_MEMORY = () => no(404, "that memory isn't here any more");

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
        maxInputs: MAX_AUTOMATION_INPUTS,
      });
    }

    if (path === "/api/agent/automation-create" || path === "/api/agent/automation-update") {
      const editing = path.endsWith("update");
      const name = cleanText(b.name, AUTOMATION_NAME_MAX);
      if (!name) return no(400, "give it a name first");

      const trigger = cleanSchedule(b);
      if (trigger.error) return no(400, trigger.error);
      // ⚠ THE INPUTS ARE READ BEFORE THE STEPS, because the steps are checked AGAINST
      // them: a `{{reference}}` is refused unless something produces it, and the declared
      // input names are half of what can. Reading them the other way round would make
      // every reference to an input fail on the one save that introduced it.
      const declared = cleanInputs(b.inputs);
      if (declared.error) return no(400, declared.error);
      const flow = cleanWorkflow(b.steps, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS,
        declared.inputs.map((i) => i.name));
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
        steps: flow.steps, inputs: declared.inputs,
      };

      /**
       * ⚠ **WHAT A `workflow` STEP MAY NAME IS THE TRANSACTION'S ANSWER, and it needs its own
       * sentences.** Both refusals used to fall through to "that agent isn't here any more",
       * which is false and sends somebody to look at the wrong thing — measured, on the run
       * that introduced them.
       *
       * `no-child` is 400 rather than 404 **because the workflow is what is wrong**, not the
       * thing being saved, and because it is ONE answer for "not there" and "another agent's":
       * naming the difference would tell a caller that an automation they cannot see exists.
       * ONE reader, so the create and the edit cannot say it differently.
       */
      const callRefusal = (e) => {
        if (e === "no-child") {
          return no(400, "one of the automations this runs isn't one of this agent's — pick another");
        }
        if (e === "runs-itself") return no(400, "an automation can't run itself");
        return null;
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
        { const r = callRefusal(a.error); if (r) return r; }
        if (a.error === "too-many") {
          return no(409, `that's as many automations as one agent can hold (${MAX_AUTOMATIONS}) — delete one first`);
        }
        if (a.ok !== true) return NO_AGENT();
        return ok({ id: a.id, nextRunAt: a.next_run_at ?? null });
      }

      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      const a = await store.updateAutomation(who, { id, ...shape });
      { const r = callRefusal(a.error); if (r) return r; }
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
      // ⚠ THE ANSWERS ARE CHECKED AGAINST WHAT THIS AUTOMATION ASKS FOR, and the
      // declaration is read for that — not taken from the request. **The database makes
      // the same three refusals inside the accepting transaction**, from the row it has
      // already locked; this copy exists so the answer arrives as a sentence about the box
      // somebody filled in rather than as a code, and the two are censused against each
      // other by name.
      const one = await store.readAutomation(who, id);
      if (!one) return NO_AUTOMATION();
      const given = cleanRunInput(b.input, one.inputs);
      if (given.error) return no(400, given.error);
      const a = await store.runAutomation(who, { automationId: id, runId: mint(), input: given.input });
      if (a.error === "no-automation") return NO_AUTOMATION();
      // THE DATABASE'S OWN INPUT REFUSALS, each as its own sentence. They are reachable
      // even with the check above — a declaration edited between the read and the accept
      // is exactly the race that check cannot close, and the transaction can.
      if (a.error === "unknown-input") return no(400, `this automation doesn't ask for anything called "${a.name}"`);
      if (a.error === "missing-input") return no(400, `"${a.name}" has to be filled in`);
      if (a.error === "bad-input") return no(400, `"${a.name}" didn't arrive as text`);
      if (a.error === "bad-inputs") return no(400, "what this automation asks for can't be read — edit it and save it again");
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

    /**
     * ── AN APPROVAL IS ANSWERED ────────────────────────────────────────────────
     *
     * **OWNERSHIP IS THE TENANT IN THE FILTER, INSIDE THE TRANSACTION THAT WRITES.** So
     * another account's execution and one that does not exist are the same 404, and there
     * is no window between a check here and the write there.
     *
     * **A SECOND PRESS IS ABSORBED AND SAYS SO.** The first decision stands, because the
     * execution may already have carried on — there would be nothing left to change.
     */
    if (path === "/api/agent/automation-approve") {
      const runId = cleanId(b.run);
      if (!runId) return no(400, "which run?");
      const step = cleanText(b.step, 40);
      if (!step) return no(400, "which step is being answered?");
      if (!AUTOMATION_VERDICTS.includes(b.verdict)) return no(400, "say whether it is approved or rejected");
      const note = b.note === undefined || b.note === null ? null : cleanText(b.note, DECISION_NOTE_MAX);
      if (b.note !== undefined && b.note !== null && typeof b.note !== "string") {
        return no(400, "that note didn't arrive as text");
      }
      const d = await store.decideApproval(who, { runId, step, verdict: b.verdict, note });
      if (d.error === "no-execution") return NO_EXECUTION();
      // ⚠ TWO REFUSALS THAT ARE NOT FAILURES, and neither writes anything. A finished
      // execution has nothing to answer; one that is not waiting at this step would be
      // given a decision nothing will ever read.
      if (d.error === "finished") {
        return no(409, "that run has already finished, so there is nothing left to approve", { finished: true });
      }
      if (d.error === "not-waiting") {
        return no(409, "that run isn't waiting to be approved just now — open its history to see where it is", { notWaiting: true });
      }
      if (d.ok !== true) return NO_EXECUTION();

      // THE DOORBELL, AFTER THE COMMIT. The decision is durable by now, so a failed ring
      // decides how soon it carries on and nothing about whether it does.
      let notified = false;
      if (d.queued === "queued" && typeof ring === "function") {
        try { await ring(runId); notified = true; }
        catch (e) { if (typeof log === "function") log("approval: the queue was not rung", String(e?.message ?? e)); }
      }
      return ok({ runId, step, verdict: d.verdict, repeat: !!d.repeat, notified });
    }

    // ═══════════════════════════════════════════════════════════════════
    // REFERENCE MATERIAL — what an agent has been given to read
    //
    // **IT IS NEITHER A CONVERSATION NOR A MEMORY, and the three are kept apart because
    // they are managed differently**: a conversation is never edited, a memory is
    // corrected, and this is a document with a name and a version that is replaced.
    //
    // ⚠ **WHAT COMES BACK OUT OF A SEARCH IS REFERENCE INFORMATION AND NEVER PERMISSION.**
    // Nothing on this side reads a stored document as configuration — it is text, bound to
    // a name by a workflow step and substituted into other text — and an automation
    // execution has no tool surface at all for it to widen.
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/api/agent/knowledge") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      // ⚠ **ONE SOURCE WHOLE IS ASKED FOR BY NAME, and the list deliberately never carries
      // the material.** Twenty sources at 200,000 characters is four megabytes to draw a
      // list of names, so opening one to edit it is its own read — and it is this route with
      // a `source=` rather than a second route, because the question is the same question.
      const one = cleanId(q.get("source"));
      if (one) {
        const k = await store.readKnowledge(who, one);
        return k ? ok({ agent: agentId, sources: [k] }) : NO_SOURCE();
      }
      return ok({
        agent: agentId,
        sources: await store.listKnowledge(who, agentId),
        max: MAX_KNOWLEDGE, bodyMax: KNOWLEDGE_BODY_MAX, formats: KNOWLEDGE_FORMATS,
      });
    }

    if (path === "/api/agent/knowledge-save") {
      const title = cleanText(b.title, KNOWLEDGE_TITLE_MAX);
      if (!title) return no(400, "give the source a name, so an answer can say where it came from");
      // THE BODY IS NOT `cleanText`'d TO A TRIM, because a document's own blank lines are
      // part of it; what is bounded is its length, and emptiness is refused by name.
      if (typeof b.body !== "string") return no(400, "the material didn't arrive as text");
      const body = b.body.replace(/^\s+|\s+$/g, "");
      if (!body) return no(400, "there is nothing in that source to read");
      if (body.length > KNOWLEDGE_BODY_MAX) {
        return no(400, `that source is longer than one source can be (${KNOWLEDGE_BODY_MAX} characters) — split it in two`);
      }
      // REFUSED, NEVER DEFAULTED TO ONE OF THEM: what somebody uploaded is a fact about
      // the upload, and guessing it from the bytes is a guess that changes when the
      // guesser does.
      const format = b.format === undefined ? "text" : b.format;
      if (!KNOWLEDGE_FORMATS.includes(format)) return no(400, `a source is ${KNOWLEDGE_FORMATS.join(" or ")}`);

      const id = cleanId(b.id);
      if (id) {
        const k = await store.updateKnowledge(who, { id, title, body, format });
        return k ? ok({ source: k, saved: "edited" }) : NO_SOURCE();
      }
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      const held = await store.countKnowledge(who, agentId);
      if (held >= MAX_KNOWLEDGE) {
        return no(409, `that's as much reference material as one agent can hold (${MAX_KNOWLEDGE}) — delete a source first`);
      }
      const k = await store.addKnowledge(who, { agentId, id: mint(), title, body, format });
      if (k.error === "duplicate") {
        return no(409, `there is already a source called "${title}" — edit that one instead, so its version keeps counting`);
      }
      if (!k.source) return NO_AGENT();
      return ok({ source: k.source, saved: "added" });
    }

    if (path === "/api/agent/knowledge-delete") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which source?");
      return (await store.removeKnowledge(who, id)) ? ok({ id }) : NO_SOURCE();
    }

    // ═══════════════════════════════════════════════════════════════════
    // MEMORY — facts and preferences that persist between conversations
    //
    // **THE SCOPE IS (ACCOUNT, AGENT) AND IT IS THE DATABASE'S**, a unique index rather
    // than a filter anybody has to remember. Saving is "set this name to this value", so it
    // is an upsert: a caller that had to know whether the name existed would be doing that
    // index's job in JavaScript.
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/api/agent/memory") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      return ok({
        agent: agentId,
        memories: await store.listMemory(who, agentId),
        max: MAX_MEMORIES, valueMax: MEMORY_VALUE_MAX,
      });
    }

    if (path === "/api/agent/memory-save") {
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      // ⚠ `name`, NOT `key`, AND THAT IS A COLLISION AVOIDED RATHER THAN A PREFERENCE.
      // `/api/agent/import` already reads `b.key` as the browser's own record id, whose
      // grammar is nothing like an identifier — so two routes reading `b.key` under two
      // grammars would be one census away from letting either shape through the other's
      // door. `name` is also what this really is: the name a step asks for.
      const key = typeof b.name === "string" ? b.name.trim().toLowerCase() : "";
      if (!key) return no(400, "give it a name, so a step can ask for it");
      if (!AGENT_NAME_RE.test(key)) {
        return no(400, `"${b.name}" can't be a name — use lower-case letters, digits and underscores, starting with a letter`);
      }
      if (typeof b.value !== "string") return no(400, "what to remember didn't arrive as text");
      const value = b.value.trim();
      if (!value) return no(400, "say what to remember — to forget it, delete it instead");
      if (value.length > MEMORY_VALUE_MAX) {
        return no(400, `that's longer than one memory can be (${MEMORY_VALUE_MAX} characters)`);
      }
      // THE CEILING IS ASKED ONLY FOR A NAME THIS AGENT DOES NOT ALREADY HOLD, or
      // correcting the last one would be refused by the cap it is already inside.
      const held = await store.listMemory(who, agentId);
      if (!held.some((m) => m.key === key) && held.length >= MAX_MEMORIES) {
        return no(409, `that's as much as one agent can remember (${MAX_MEMORIES}) — delete something first`);
      }
      const m = await store.saveMemory(who, { agentId, id: mint(), key, value });
      return m ? ok({ memory: m }) : NO_AGENT();
    }

    if (path === "/api/agent/tool-approvals") {
      // ⚠ THE AGENT FILTER IS OPTIONAL AND IS CHECKED WHEN IT IS GIVEN. Without one the
      // answer is this ACCOUNT'S waiting calls, which is what a person wants to see; with
      // one, the ownership test runs first, so a stranger's agent id reads as a missing
      // agent exactly as it does everywhere else.
      const agentId = q.get("agent") === null ? null : cleanId(q.get("agent"));
      if (q.get("agent") !== null && !agentId) return no(400, "which agent?");
      if (agentId && !(await store.ownsAgent(who, agentId))) return NO_AGENT();
      return ok({ agent: agentId, approvals: await store.listToolApprovals(who, agentId) });
    }

    if (path === "/api/agent/tool-approve") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which request?");
      // REFUSED, NEVER DEFAULTED. A verdict this cannot read is a person's answer nobody
      // can establish — and reading a typo as `approved` runs a call nobody allowed.
      if (!TOOL_VERDICTS.includes(b.verdict)) return no(400, "say whether it is approved or rejected");
      if (b.note !== undefined && b.note !== null && typeof b.note !== "string") {
        return no(400, "that note didn't arrive as text");
      }
      const note = b.note === undefined || b.note === null ? null : cleanText(b.note, TOOL_NOTE_MAX);
      // ⚠ WHO DECIDED COMES FROM THE VERIFIED SESSION AND FROM NOWHERE ELSE. There is no
      // `by` on this route's body and nothing reads one: an agent cannot approve its own
      // request because it has no way to be a session, and a person cannot be impersonated
      // because the field is not on the wire.
      const d = await store.decideToolApproval(who, { id, verdict: b.verdict, note, by: who });
      // NOT FOUND, NEVER FORBIDDEN — another account's request and one that does not
      // exist answer identically, because the difference between them is information.
      if (d?.ok !== true) return no(404, "that request isn't waiting any more");
      // ⚠ THE DOORBELL, AND IT IS A DOORBELL AND NEVER THE WORK. `decide_tool_approval`
      // already put the run back on the queue INSIDE its own transaction — but it is a
      // SQL function and a SQL function cannot ring a Cloudflare queue, so without this
      // the person presses Approve and nothing visibly happens until the sweeper's next
      // tick. **A failed ring is logged and said (`notified: false`) and never raised**:
      // the work is durable either way, and answering an error would tell somebody their
      // decision failed when it is committed and will run.
      //
      // ⚠ RUNG EVEN ON A REPEAT, for the send route's own reason: a first press whose
      // ring failed leaves a run nobody has told anyone about, and the second press is
      // exactly when to say it again. A duplicate ring is harmless by construction —
      // `claim_run` answers `not-claimable` and the delivery does nothing.
      let notified = false;
      const back = cleanId(d.run);
      if (back && typeof ring === "function") {
        try { await ring(back); notified = true; }
        catch (e) { if (typeof log === "function") log("agent approval: the queue was not rung", String(e?.message ?? e)); }
      }
      return ok({
        notified,
        id: d.id, verdict: d.verdict, note: d.note ?? null,
        // ⚠ `repeat` IS SAID RATHER THAN HIDDEN. Two people pressing at once is one
        // decision and a loser, and the loser must be told whose answer stands rather
        // than being shown their own.
        repeat: d.repeat === true, decidedBy: d.decided_by ?? null,
      });
    }

    if (path === "/api/agent/tool-withdraw") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which request?");
      if (b.note !== undefined && b.note !== null && typeof b.note !== "string") {
        return no(400, "that note didn't arrive as text");
      }
      const note = b.note === undefined || b.note === null ? null : cleanText(b.note, TOOL_NOTE_MAX);
      // WHO WITHDREW IT COMES FROM THE VERIFIED SESSION, exactly as the verdict's does, and
      // there is no `by` on this route's body either.
      const d = await store.revokeToolApproval(who, { id, by: who, note });
      if (d?.ok !== true) {
        // ⚠ TWO REFUSALS THAT ARE NOT THE SAME THING. A call that has already RUN cannot be
        // taken back — a database cannot recall a tool call — and saying "that isn't waiting
        // any more" about it would imply it did not happen.
        if (d?.error === "already-ran") {
          return no(409, "that call has already run, so there is nothing left to take back");
        }
        return no(404, "that request isn't waiting any more");
      }
      // ⚠ RUNG FOR THE SAME REASON AN APPROVAL IS: the run has been put back on the queue
      // inside the function's own transaction, and without the doorbell nothing visibly
      // happens until the sweeper's next tick. A failed ring is said and never raised.
      let notified = false;
      const back = cleanId(d.run);
      if (back && typeof ring === "function") {
        try { await ring(back); notified = true; }
        catch (e) { if (typeof log === "function") log("agent withdrawal: the queue was not rung", String(e?.message ?? e)); }
      }
      return ok({ notified, id: d.id, withdrawn: true, repeat: d.repeat === true });
    }

    if (path === "/api/agent/revoked-tools") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      return ok({ agent: agentId, revoked: await store.listRevokedTools(who, agentId) });
    }

    if (path === "/api/agent/tool-revoke" || path === "/api/agent/tool-restore") {
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      // ⚠ THE TOOL NAME IS CHECKED AGAINST THE CATALOG, NOT ONLY AGAINST THE GRAMMAR. A
      // revocation of a name no tool has is a row that can never do anything, and it would
      // sit on a screen looking like a permission somebody took away.
      const tool = typeof b.tool === "string" ? b.tool.trim() : "";
      if (!tool) return no(400, "which tool?");
      if (!AGENT_TOOLS.some((t) => t.name === tool)) {
        return no(400, `there is no tool called "${tool}"`);
      }
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      if (path === "/api/agent/tool-restore") {
        const back = await store.restoreAgentTool(who, { agentId, tool });
        if (back?.ok !== true) return NO_AGENT();
        // ⚠ SAID PLAINLY, because it is the one thing about lifting a revocation somebody
        // will get wrong: the requests it withdrew stay withdrawn, and the agent has to ask
        // again if it still wants the call.
        return ok({ agent: agentId, tool, lifted: back.lifted === true,
                    say: "it can use that again from its next action — anything that was waiting for it stays withdrawn" });
      }
      if (b.note !== undefined && b.note !== null && typeof b.note !== "string") {
        return no(400, "that note didn't arrive as text");
      }
      const note = b.note === undefined || b.note === null ? null : cleanText(b.note, TOOL_NOTE_MAX);
      const gone = await store.revokeAgentTool(who, { agentId, tool, by: who, note });
      if (gone?.ok !== true) return NO_AGENT();
      // ⚠ **EVERY RUN IT ANSWERED IS RUNG, AND THAT IS NOT A NICETY.** A run waiting for a
      // person has its work row marked done; the revocation has just answered that request
      // INSTEAD of a person, and `revoke_agent_tool` put the run back inside its own
      // transaction — but a SQL function cannot ring a Cloudflare queue, so without this the
      // run sits reading as working until the next cron tick. A failed ring is said
      // (`notified`) and never raised: the work is durable either way.
      let notified = 0;
      const back = Array.isArray(gone.runs) ? gone.runs : [];
      for (const runId of back) {
        if (!cleanId(runId) || typeof ring !== "function") continue;
        try { await ring(runId); notified += 1; }
        catch (e) { if (typeof log === "function") log("agent revoke: the queue was not rung", String(e?.message ?? e)); }
      }
      return ok({ agent: agentId, tool, withdrew: gone.withdrew ?? 0, notified,
                  say: "it cannot use that again — and anything that was waiting for it has been taken back" });
    }

    if (path === "/api/agent/run-cancel") {
      const runId = cleanId(b.run);
      if (!runId) return no(400, "which run?");
      if (b.reason !== undefined && b.reason !== null && typeof b.reason !== "string") {
        return no(400, "that reason didn't arrive as text");
      }
      const reason = b.reason === undefined || b.reason === null ? null : cleanText(b.reason, TOOL_NOTE_MAX);
      // ⚠ THE RUN IS NOT LOOKED UP HERE AND THAT IS DELIBERATE: `cancel_run` puts the tenant
      // in its own locked lookup, so another account's run and one that does not exist are
      // one answer — and a check here would be a second copy of that wall with a race
      // between the two.
      const stopped = await store.cancelRun(who, { runId, by: who, reason });
      if (stopped?.ok !== true) return no(404, "there is no run of yours with that id");
      return ok({
        run: runId,
        // ⚠ WHAT HAD ALREADY COMPLETED, and the sentence that says it was not undone. A
        // cancellation is the work stopping, not the work coming back.
        completedSteps: stopped.completedSteps ?? 0,
        completedCalls: stopped.completedCalls ?? 0,
        withdrewApprovals: stopped.withdrewApprovals ?? 0,
        releasedWait: stopped.releasedWait === true,
        alreadyStopped: stopped.alreadyStopped === true,
        repeat: stopped.repeat === true,
        say: typeof stopped.say === "string" ? stopped.say
          : "stopped — what had already run has already run and was not undone",
      });
    }

    if (path === "/api/agent/memory-delete") {
      const agentId = cleanId(b.agent);
      const key = typeof b.name === "string" ? b.name.trim().toLowerCase() : "";
      if (!agentId) return no(400, "which agent?");
      if (!key) return no(400, "which memory?");
      // ⚠ **THE AGENT AND THE KEY ARE BOTH IN THE FILTER, with the tenant.** A delete by
      // id alone would work and would make the id the identity; the name is the identity
      // here, because that is what a workflow asks for and what a person sees.
      return (await store.removeMemory(who, agentId, key)) ? ok({ agent: agentId, key }) : NO_MEMORY();
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
