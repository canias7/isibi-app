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
  Object.freeze({
    name: "cancel_execution",
    label: "Stop a run that is under way",
    // ⚠ THE WORDS SAY WHAT IT CANNOT DO, because that is what somebody deciding needs. Stopping
    // is not undoing, and a label that left that out would promise the wrong thing.
    does: "Stops one run of one of its automations part way through. Anything already done stays "
      + "done — this only stops what is left, and it can never start anything. You are asked "
      + "before it happens.",
  }),
  // ── what it may do OUTSIDE this platform ──────────────────────────────────
  //
  // ⚠ **THE WORDS HERE ARE FOR A PERSON DECIDING WHETHER TO ALLOW IT, which is why they say
  // what it reaches rather than what it calls.** The engine's own `description` for the same
  // tool is written for a model choosing whether to use it; that is the whole reason this
  // catalog is a declared COPY rather than an import.
  //
  // **CONNECTING SOMETHING IS NOT ON THIS LIST AND CANNOT BE**: an agent that could store a
  // credential could store one it wrote, so a connection is made by a PERSON and the agent is
  // only ever allowed to USE one.
  Object.freeze({
    name: "list_connections",
    label: "See what it is connected to",
    does: "Lists the outside accounts you have connected for this agent, and whether each is usable right now. It never sees any password or key.",
  }),
  Object.freeze({
    name: "read_messages",
    label: "Read a connected account",
    does: "Reads what is in one of the accounts you have connected. It only reads.",
  }),
  Object.freeze({
    name: "send_message",
    label: "Send from a connected account",
    does: "Sends a message from one of the accounts you have connected. You are asked to approve every one before it goes out, and you see who it is for and what it says.",
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
    /**
     * ⚠ **THE TIME ZONE ITS SCHEDULES ARE WRITTEN IN, AND `null` IS THE FAIL-CLOSED ANSWER.**
     *
     * Not `"UTC"`: a guessed zone is right for almost nobody and wrong invisibly, and the
     * authoring path reads `null` as *ask the person* — which is the behaviour this whole
     * setting exists to make possible. A row from an older Worker, a view missing the column
     * or a migration not yet applied all arrive here as `undefined`, and every one of them
     * means nobody has said.
     */
    zone: typeof (r && r.zone) === "string" && r.zone.trim() ? r.zone.trim() : null,
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
 * WHAT A CANCELLATION RECORDED, read once for every reader of it.
 *
 * ⚠ **IT EXISTS BECAUSE THE SECOND READER GOT ALL FOUR NAMES WRONG, and a demonstration is
 * what found it.** `agent.cancel_run` writes `cancelledBy`, `note`, `completedSteps` and
 * `completedCalls`; `executionRow` was written against `by`, `why`, `steps` and `calls` — a
 * reader written against an IMAGINED producer while the correct one sat forty lines away in
 * this same file. MEASURED through the site's own history route: `state: "cancelled"` with
 * every one of the four `null`, so the word was right and nothing under it was. That is
 * *two readers of one fact*, and the fix is to have one.
 *
 * **EACH CALLER STILL CHOOSES ITS OWN ABSENT VALUE**, which is why this answers `null`
 * rather than a default: a conversation always shows a run and reads a missing count as `0`,
 * while an execution list has to tell "none completed" from "nobody recorded how far it got".
 * What is shared is the PRODUCER'S SHAPE, which is the only part a reader can be wrong about.
 *
 * `by` goes through `cleanId` because the stop is a jsonb body and the wire must not carry
 * whatever else one happens to hold.
 */
export function cancelledFacts(stop) {
  const st = stop && typeof stop === "object" && !Array.isArray(stop) ? stop : null;
  return {
    by: cleanId(st && st.cancelledBy) || null,
    note: typeof st?.note === "string" ? st.note : null,
    steps: Number.isInteger(st?.completedSteps) ? st.completedSteps : null,
    calls: Number.isInteger(st?.completedCalls) ? st.completedCalls : null,
  };
}

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
      // THE NAMES ARE `cancelledFacts`' — one reader of the producer's shape — and the ABSENT
      // values are this reader's own: a conversation always shows a run, so `""` and `0` are
      // what a screen can draw without a branch per field.
      by: cancelledFacts(stop).by || "",
      note: cancelledFacts(stop).note || "",
      completedSteps: cancelledFacts(stop).steps ?? 0,
      completedCalls: cancelledFacts(stop).calls ?? 0,
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
        `&select=id,name,instructions,created_at,updated_at,last_message,status,tools,zone` +
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
    async create(tenant, { id, name, instructions, status, tools, zone }) {
      // `fresh`, not `row`: the answer's own row is already called that eight lines
      // down, and a second `const row` in this scope is a module that does not load.
      const fresh = { id, tenant_id: tenant, name, instructions };
      if (status !== undefined) fresh.status = status;
      if (tools !== undefined) fresh.tools = tools;
      if (zone !== undefined) fresh.zone = zone;
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
    async update(tenant, id, { name, instructions, status, tools, zone }) {
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
      // ⚠ `null` IS A VALUE AND `undefined` IS SILENCE, which is why this is `!== undefined`
      // and not truthiness: clearing a zone has to be possible, and an older tab that says
      // nothing about it must not clear one.
      if (zone !== undefined) body.zone = zone;
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
        `&select=${AUTOMATION_COLUMNS.join(",")}` +
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
        `&select=${AUTOMATION_COLUMNS.join(",")}&limit=1`);
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
     * Set one name to one value — **through `agent.save_memory`, the SAME function the
     * agent's own `remember` tool calls.**
     *
     * ⚠ **IT WAS A DIRECT UPSERT, AND THAT MADE ONE OPERATION TWO IMPLEMENTATIONS.** The
     * upsert was correct about the row and could not be correct about everything else: the
     * CEILING was asked in JavaScript above it, which is a count and an insert in two
     * statements and therefore raceable (two saves landing together both read one short of
     * the cap and both insert), and `source` was a literal here rather than the closed set the
     * function refuses outside of. The function does all of it inside one transaction.
     *
     * **WHAT IS UNCHANGED IS THE DATABASE'S OWN HALF, and saying so matters because it is
     * what made the drift invisible**: the unique index over `(tenant, agent, key)` IS the
     * scope, and the `version` trigger fires on the TABLE — so both doors always agreed about
     * the scope and the version, whichever writer they went through. What they did not agree
     * about is the cap and who may be recorded as having said so.
     *
     * It answers the function's own jsonb, so a caller reads `saved` (`created` · `corrected`
     * · `unchanged`) and a refusal by its code rather than by a missing row.
     */
    async saveMemory(tenant, { agentId, id, key, value, source = "person" }) {
      const r = await req("POST", "rpc/save_memory", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_key: key, p_value: value,
          p_id: id, p_source: source,
          // THE CEILING IS PASSED, not left to the parameter's own default — the engine passes
          // its own the same way, and the cross-product census is what keeps the two equal.
          p_max: MAX_MEMORIES,
        },
      });
      if (!r.ok) throw storeFail("save memory", r);
      return answerOf(r, "save memory");
    },

    /**
     * Forget one name — **through `agent.delete_memory`, the SAME function `forget` calls.**
     *
     * ⚠ **IT WAS A DIRECT DELETE, AND THE COST WAS THE REACH.** What forgetting reaches —
     * later runs yes, an execution already accepted no, the journal no — is that function's
     * own answer, and with the delete done here the route had to WRITE THOSE THREE FIELDS OUT
     * BY HAND. Two copies of a sentence about what a delete does, in two languages, with the
     * one that drifts being the one a person reads. Forwarded now.
     */
    async removeMemory(tenant, agentId, key) {
      const r = await req("POST", "rpc/delete_memory", {
        body: { p_tenant: tenant, p_agent_id: agentId, p_key: key },
      });
      if (!r.ok) throw storeFail("delete memory", r);
      return answerOf(r, "delete memory");
    },

    /**
     * Make one.
     *
     * **THE ID IS OURS AND THE ARITHMETIC IS THE DATABASE'S.** A daily schedule's next
     * instant is computed by `agent.automation_next_at`, which is the only thing in this
     * system that owns a time zone database — working it out here would be a second copy
     * of it, in a language whose answer would then decide when somebody's work runs.
     */
    async createAutomation(tenant, { agentId, id, name, enabled, schedule, at, zone, steps, inputs, days, onDate, onEvent }) {
      const r = await req("POST", "rpc/create_automation", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name,
          p_enabled: enabled, p_schedule: schedule, p_at_local: at, p_zone: zone,
          p_steps: steps, p_inputs: inputs ?? [], p_max: MAX_AUTOMATIONS,
          // ⚠ `null` RATHER THAN OMITTED, so a save that clears a day list really clears it.
          // These are a REPLACE like every other field on this form, and a key left off is a
          // field PostgREST fills from the parameter's default — which for an edit that turned
          // a weekly schedule into a daily one would leave the old days behind.
          p_days: days ?? [], p_on_date: onDate ?? null, p_on_event: onEvent ?? null,
        },
      });
      if (!r.ok) throw storeFail("create automation", r);
      return answerOf(r, "create automation");
    },

    /**
     * Change only the fields an edit really NAMED.
     *
     * ⚠ **IT REPLACED A WHOLE-ROW WRITE, AND THE DIFFERENCE IS A LOST UPDATE.**
     * `agent.update_automation` takes every column and writes every column, so a form built
     * from a row a browser read minutes ago overwrote whatever anybody else had changed
     * since — including a trigger this form has no control for, which is how an event
     * binding came to be copied out of a cached row in the first place.
     * `agent.patch_automation` takes the row lock FIRST and resolves every key the patch does
     * not carry from the LOCKED row, so an omitted field keeps what the database holds rather
     * than what a browser remembers, and ownership and wholeness are both decided inside that
     * same transaction.
     *
     * **THE REPLACE DOOR IS GONE RATHER THAN LEFT BESIDE THIS ONE.** A caller that can still
     * send a whole row is a caller that can still lose an update, and this engine dropped its
     * own token-less `beat_run` overloads for exactly that reason: an unused bypass is the
     * defect waiting to be re-wired. `agent.update_automation` is still the one WRITER —
     * `patch_automation` delegates to it — and nothing above the database reaches it now.
     *
     * **THE PLAIN FUNCTION, NOT `patch_automation_once`.** A person pressing Save twice is not
     * a redelivery: nothing retries this request, and the same patch applied twice writes the
     * same values. The `_once` wrapper is the AGENT's door, where a queue really can deliver
     * one call again, and it is the one place an operation record is worth keeping.
     *
     * ⚠ **THE FENCE IS SENT WHERE — AND ONLY WHERE — THE EDIT WAS VALIDATED AGAINST SOMETHING
     * STORED, and this paragraph used to say the fence was deliberately unused.**
     *
     * That reasoning was right about the case it considered and wrong as a general rule. It read:
     * *"`version` moves on a change of STEPS and on nothing else, so it cannot see a concurrent
     * rename; a fence would refuse a name change because somebody else had edited the steps."*
     * True — and irrelevant to an edit whose own VERDICT came from the stored steps or the stored
     * declarations. There the counter is not an unrelated field that might have moved; it is the
     * identity of the thing that was checked.
     *
     * So the fence is `cleanPatch`'s answer, sent verbatim and never computed here: it is offered
     * only for an edit that named exactly one half of the validated surface, and the counter now
     * moves on the steps OR on what the automation asks for. A rename still fences on nothing and
     * still cannot be refused for somebody else's edit.
     *
     * `undefined` READS AS NO FENCE, so every existing caller behaves byte for byte as it did.
     */
    async patchAutomation(tenant, { id, patch, expectVersion = null }) {
      const r = await req("POST", "rpc/patch_automation", {
        body: { p_tenant: tenant, p_id: id, p_patch: patch,
                p_expect_version: Number.isInteger(expectVersion) ? expectVersion : null },
      });
      if (!r.ok) throw storeFail("patch automation", r);
      return answerOf(r, "patch automation");
    },

    /**
     * Turn one on or off, and NOTHING ELSE.
     *
     * **ITS OWN NARROW WRITE, deliberately.** The toggle is the one change that must not
     * carry a whole configuration with it: sending the form's other fields from a list
     * row would mean a stale tab quietly restoring an old schedule as the price of
     * pressing a switch.
     */
    /**
     * Turn one automation on or off — **through `agent.set_automation_enabled`, the SAME
     * function the agent's own `pause_automation` calls.**
     *
     * ⚠ **IT WAS A BARE `PATCH {enabled}`, AND THE DIVERGENCE WAS BEHAVIOURAL RATHER THAN
     * COSMETIC — reproduced on a real PostgreSQL before this was changed.** That function does
     * one thing more than set the column: turning a SCHEDULED automation back on it recomputes
     * `next_run_at` from the schedule and NOW, because a stale one is in the past and
     * `tick_automations` selects on `next_run_at <= now()`. The PATCH did not, so an automation
     * paused for five days and re-enabled FROM THE SCREEN kept a `next_run_at` five days behind
     * — measured, `2026-09-14 09:44` against the tool's `2026-09-20 08:00` for the same act on
     * the same automation, so the cron's catch-up window (`AUTOMATION_CATCHUP_S`, an hour) read
     * it as a MISSED occurrence and logged one instead of scheduling the next.
     *
     * **A DISABLE STILL LEAVES THE SCHEDULE EXACTLY WHERE IT WAS**, which is the function's own
     * rule (`when p_enabled and a.schedule <> 'manual'`) and not this store's care.
     *
     * It answers the function's own jsonb — `{ok, id, enabled, next_run_at}` — so a caller
     * reads a refusal by its code rather than by a missing row, and gets the recomputed instant
     * rather than having to ask for it.
     */
    async setAutomationEnabled(tenant, id, enabled) {
      const r = await req("POST", "rpc/set_automation_enabled", {
        body: { p_tenant: tenant, p_id: id, p_enabled: enabled },
      });
      if (!r.ok) throw storeFail("enable automation", r);
      return answerOf(r, "enable automation");
    },

    // ── inbound endpoints ─────────────────────────────────────────────────
    /**
     * Every endpoint of one agent — **and the secret is not among the columns, because the
     * function does not select it.** That is asserted against the function itself rather
     * than trusted: `test/agent-api.test.mjs` reads `list_webhooks` out of the migration
     * and requires `secret` to be absent from its projection.
     */
    async listWebhooks(tenant, agentId) {
      const r = await req("POST", "rpc/list_webhooks", {
        body: { p_tenant: tenant, p_agent_id: agentId },
      });
      if (!r.ok) throw storeFail("list endpoints", r);
      const a = answerOf(r, "list endpoints");
      return Array.isArray(a) ? a.map(webhookRow) : [];
    },

    // ── connected accounts ──────────────────────────────────────────────────
    //
    // ⚠ **FOUR OPERATIONS AND NOT ONE OF THEM CAN ANSWER A CREDENTIAL.** The list reads
    // `agent.connection_list`, which selects neither secret; the other three are functions
    // whose answers carry a status and an id. `agent.lease_connection` — the only thing in
    // the schema that selects a credential — is deliberately NOT here: it is the engine's,
    // reached from a job, and a copy of it on this side would be a second door.

    /**
     * Every connection of one agent, without its credentials.
     *
     * ⚠ **THE COLUMNS ARE NAMED, so a column added to the view later cannot reach a browser
     * by accident** — and the two secrets are not among them because the VIEW has not got
     * them, which `test/agent-api.test.mjs` asserts against the migration itself rather than
     * trusting this list.
     */
    async listConnections(tenant, agentId) {
      const r = await req("GET",
        `connection_list?tenant_id=eq.${t(tenant)}&agent_id=eq.${t(agentId)}` +
        `&select=id,agent_id,provider,label,account,scopes,status,expires_at,stopped_why,refreshable,created_at` +
        `&order=created_at.asc&limit=${MAX_CONNECTIONS + 1}`);
      if (!r.ok) throw storeFail("list connections", r);
      return rows(r).map(connectionRow);
    },

    /**
     * Connect one.
     *
     * ⚠ **THE CREDENTIAL IS AN ARGUMENT AND IS MINTED BY THE ROUTE**, so it crosses this
     * module once, into the transaction, and there is nothing anywhere that reads it back —
     * not an answer, not an error, not a log.
     */
    async connectProvider(tenant, { agentId, id, provider, label, account, scopes, secret }) {
      const r = await req("POST", "rpc/connect_provider", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_id: id, p_provider: provider,
          p_label: label, p_account: account, p_scopes: scopes, p_secret: secret,
          p_max: MAX_CONNECTIONS,
        },
      });
      if (!r.ok) throw storeFail("connect account", r);
      return answerOf(r, "connect account");
    },

    /**
     * Disconnect one.
     *
     * **IT DESTROYS THE CREDENTIAL RATHER THAN FLAGGING THE ROW** — that is the function's
     * own doing, and it is why a disconnect cannot be undone by a toggle. The ROW stays as
     * the record of what was in use; what goes is the only part that can do anything.
     */
    async disconnectConnection(tenant, { agentId, id, why }) {
      const r = await req("POST", "rpc/disconnect_connection", {
        body: { p_tenant: tenant, p_agent_id: agentId, p_id: id, p_why: why ?? null },
      });
      if (!r.ok) throw storeFail("disconnect account", r);
      return answerOf(r, "disconnect account");
    },

    /**
     * Record that the provider withdrew access.
     *
     * ⚠ **A SEPARATE VERB FROM A DISCONNECT, because they are separate acts with separate
     * remedies**: one is the account's owner saying stop and the other is the far end saying
     * no. Collapsing them would leave a screen unable to say which happened, and the two
     * need different things done about them.
     */
    async revokeConnection(tenant, { agentId, id, why }) {
      const r = await req("POST", "rpc/revoke_connection", {
        body: { p_tenant: tenant, p_agent_id: agentId, p_id: id, p_why: why ?? null },
      });
      if (!r.ok) throw storeFail("revoke account", r);
      return answerOf(r, "revoke account");
    },

    /**
     * Make one.
     *
     * ⚠ **THE SECRET IS AN ARGUMENT HERE AND IS MINTED BY THE ROUTE**, so this operation
     * carries it exactly once, into the transaction, and nothing reads it back afterwards.
     */
    async createWebhook(tenant, { agentId, id, name, event, secret }) {
      const r = await req("POST", "rpc/create_webhook", {
        body: {
          p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name,
          p_event: event, p_secret: secret, p_max: MAX_WEBHOOKS,
        },
      });
      if (!r.ok) throw storeFail("create endpoint", r);
      return answerOf(r, "create endpoint");
    },

    /** Turn one on or off. Its own narrow write, for the toggle's own reason. */
    async setWebhookEnabled(tenant, id, enabled) {
      const r = await req("POST", "rpc/set_webhook_enabled", {
        body: { p_tenant: tenant, p_id: id, p_enabled: enabled },
      });
      if (!r.ok) throw storeFail("enable endpoint", r);
      return answerOf(r, "enable endpoint");
    },

    /**
     * Take one away.
     *
     * **DELETING IT IS THE ONLY WAY TO CHANGE A SECRET, and that is deliberate.** A rotate
     * would have to answer the new secret, which makes a second door that hands one out;
     * delete and make another is one door, and the old endpoint stops answering at once.
     */
    async removeWebhook(tenant, id) {
      const r = await req("POST", "rpc/delete_webhook", {
        body: { p_tenant: tenant, p_id: id },
      });
      if (!r.ok) throw storeFail("delete endpoint", r);
      return answerOf(r, "delete endpoint");
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
/** A recipient and a message, for the send step. The provider's own payload, bounded. */
export const MAX_STEP_RECIPIENT = 200;
export const MAX_STEP_MESSAGE = 4000;
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
export const AUTOMATION_SCHEDULES = Object.freeze(["manual", "daily", "weekly", "once"]);

/**
 * ONE WORKED EXAMPLE A CUSTOMER CAN START FROM, in the editor they already have.
 *
 * ⚠ **IT IS THE WORKFLOW THE DEMONSTRATION PROVES END TO END, and that is the whole reason
 * it is worth having rather than a plausible-looking seed.** `verify:send` reads THIS object
 * — it imports this module — so the thing a customer is handed is the thing driven through
 * the routes, the queue, the approval and the fake provider's mailbox. Two copies that agree
 * today would be one example and one claim about it.
 *
 * **IT SEEDS THE FORM AND IS EDITABLE THE INSTANT IT IS DRAWN.** There is no new editor, no
 * template stored anywhere and no route: the draft the Automations form already renders is
 * what it fills in, so every field, every step and every input can be changed or removed
 * before it is ever saved. An example a person cannot edit is a demo, not a starting point.
 *
 * ⚠ **THE SEND STEP DELIBERATELY NAMES NO CONNECTION.** A connection id belongs to one
 * account and cannot be invented, so an example carrying one would either be a dead id or
 * somebody else's account. Absent, the form's own refusal names the field — *say which
 * connected account to send from* — which is actionable, and the browser fills it in from
 * the person's own first connected account when they have one. What must never happen is a
 * seed that SAVES and then cannot send.
 */
export const EXAMPLE_AUTOMATION = Object.freeze({
  name: "Reply to an enquiry",
  schedule: "manual",
  inputs: Object.freeze([
    Object.freeze({ name: "who", label: "Who it is for", required: true }),
    Object.freeze({ name: "topic", label: "What they asked about", required: true }),
  ]),
  steps: Object.freeze([
    Object.freeze({ type: "knowledge", query: "{{topic}}", out: "facts" }),
    Object.freeze({ type: "note", out: "reply",
      text: "Hello {{who}} — about your {{topic}}: {{facts}} (this reply is scripted, not written by a model)" }),
    Object.freeze({ type: "send", to: "{{who}}", body: "{{reply}}" }),
  ]),
});


/** `YYYY-MM-DD`, which is what a one-off schedule names and what the column holds. */
const ON_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * WHAT AN EVENT NAME LOOKS LIKE — the DATABASE's grammar (`agent.events_name_shaped`),
 * pinned here as an external constraint rather than invented.
 *
 * ⚠ **IT IS WIDER THAN `AGENT_NAME_RE` AND THAT IS THE WHOLE REASON THE `event` FIELD KIND
 * EXISTS.** An event name may carry dots and dashes (`order.paid`), which the `name` kind
 * refuses — so a shape enforced anywhere but in a field kind would mean this door refusing
 * what the engine accepts, measured, with both halves reading as correct.
 */
export const AGENT_EVENT_RE = /^[a-z][a-z0-9_.-]{0,63}$/;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AN INBOUND ENDPOINT — what somebody else's system POSTs to, to raise an event here
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ **THE SECRET IS MINTED HERE AND IS ANSWERED EXACTLY ONCE.** `agent.create_webhook`
 * takes it and does not hand it back, and `agent.list_webhooks` never selects the column —
 * so the create's own answer is the only time it exists outside the database. That is the
 * design rather than a limitation: a secret a list can re-read is one that leaks through
 * every later screen, log line and cached response that ever shows the list.
 *
 * **AND IT IS MINTED BY THE SERVER, NEVER TAKEN FROM THE REQUEST.** A caller-supplied
 * secret is a caller-chosen one, so a browser could set it to a word — and a browser is
 * not where the strength of a signing key should be decided. There is nowhere to put one:
 * the route reads no secret field at all.
 */

/** How many endpoints one agent may hold. The create function's own ceiling. */
export const MAX_WEBHOOKS = 10;

/** How long an endpoint's name may be — the column's own check constraint. */
export const WEBHOOK_NAME_MAX = 80;

/**
 * How many bytes of randomness a minted secret carries.
 *
 * **32 BYTES, WHICH IS 64 HEX CHARACTERS — inside the column's own 32..200 and well past
 * the floor.** The floor is what the database guarantees; this is what we choose, and the
 * two are deliberately not the same number: a secret AT the minimum would be one the next
 * person to raise the floor breaks.
 */
export const WEBHOOK_SECRET_BYTES = 32;

// ── connected accounts ───────────────────────────────────────────────────────

/**
 * WHAT MAY BE CONNECTED, AND IT IS A POSITIVE LIST OF ONE.
 *
 * ⚠ **A BROWSER MAY NOT NAME A PROVIDER, and that is the whole of this constant.** The name
 * on a connection row is what the engine looks an ADAPTER up by, so a caller-chosen provider
 * is a caller choosing which code runs — and a name with no adapter behind it is a connection
 * that saves, lists, and fails at every send: a control that answers, wrongly. So the set is
 * declared here, in code, and a request that names anything else is refused BY NAME.
 *
 * **IT HOLDS THE FAKE PROVIDER AND NOTHING ELSE, DELIBERATELY** — the milestone says *use a
 * clearly labeled fake provider for now* and *do not connect Gmail or another real provider*.
 * The label travels with it so a screen cannot draw one of these as anything but simulated,
 * and `simulated: true` is a field rather than a word in the label, because a word in a label
 * is something a later edit tidies away.
 *
 * It is a declared COPY of the engine's own adapter — neither product may import the other —
 * and `test/agent-send.test.mjs`, the one file that may load both, compares the name and the
 * scopes both ways.
 */
export const AGENT_PROVIDERS = Object.freeze([Object.freeze({
  name: "fakemail",
  label: "Fake mail (simulated)",
  simulated: true,
  does: "A stand-in mail account that runs entirely inside the platform. Nothing it is asked to send leaves — messages go to a mailbox nobody else can read. It is here so a workflow that sends can be built and watched end to end before a real account is connected.",
  /**
   * THE PERMISSIONS A PERSON MAY GRANT, each with what it lets the agent do. **Server-side and
   * per provider**, so a request cannot invent one — `cleanScopes` keeps only what is here.
   */
  scopes: Object.freeze([
    Object.freeze({ name: "read", label: "Read messages", does: "Let the agent read what is in this mailbox." }),
    Object.freeze({ name: "send", label: "Send messages", does: "Let the agent send from this account. A person still approves every message before it goes." }),
  ]),
  /**
   * ⚠ **WHICH OF THOSE PERMISSIONS A `send` WORKFLOW STEP NEEDS — a DECLARED COPY of the
   * engine's `adapter.scopes[SEND_ACTION]`, and it exists so no screen holds the word `send`
   * as a literal of its own.**
   *
   * A screen has to be able to tell an account that could carry a send from one that is
   * connected for reading only, and the answer is per PROVIDER: the mapping from an action to
   * the permission it needs lives on the adapter, so a second provider may well spell its own
   * differently. Reading the FIRST scope, or matching the word "send" in a label, would each be
   * a guess about a provider rather than a fact about it.
   *
   * `test/agent-send.test.mjs` — the one file that may load both products — compares this
   * against the engine's own `SEND_ACTION` and `FAKE_SCOPES`, so a provider whose send scope
   * moved would fail a test rather than leave a screen offering an account that cannot send.
   */
  sendScope: "send",
})]);


/** By name, for the one lookup every route does. */
export const providerByName = (name) =>
  AGENT_PROVIDERS.find((p) => p.name === name) ?? null;

/** At most this many live connections per agent — the database's own ceiling, named here. */
export const MAX_CONNECTIONS = 20;

/** How long a person's own label for a connection may be. The column's own bound. */
export const CONNECTION_LABEL_MAX = 80;
/** And the account it names — an address, a handle, whatever the provider calls one. */
export const CONNECTION_ACCOUNT_MAX = 200;

/**
 * How many bytes of credential a connection is minted with.
 *
 * ⚠ **AND THE POINT OF THIS ONE IS THAT NOBODY OUTSIDE EVER SEES IT — unlike a webhook
 * secret, which is answered exactly once because whoever is going to sign with it needs it.**
 * Here the only thing that ever uses the credential is the engine, through
 * `agent.lease_connection`, so there is no reader to hand it to and it is never on any answer
 * at all. That is a stronger rule than "answered once" and it costs nothing, because a real
 * provider's credential would arrive from the provider rather than from us.
 */
export const CONNECTION_SECRET_BYTES = 32;

/**
 * Keep only the permissions this provider really offers, in ITS OWN ORDER.
 *
 * ⚠ **A POSITIVE INTERSECTION, and a name it does not know is REFUSED rather than dropped** —
 * a permission quietly left out is one that appears granted and is not, which is the worst
 * direction for a list whose whole job is to say what an agent may do. The provider's order,
 * so two saves of one selection are byte-identical.
 */
export function cleanScopes(given, provider) {
  const offered = (provider?.scopes ?? []).map((sc) => sc.name);
  if (!Array.isArray(given)) return { error: "say which permissions to grant" };
  const seen = new Set();
  for (const g of given) {
    if (typeof g !== "string") return { error: "a permission has to arrive as a name" };
    const name = g.trim().toLowerCase();
    if (!offered.includes(name)) return { error: `this platform has no permission called ${name}` };
    seen.add(name);
  }
  if (!seen.size) return { error: "grant at least one permission, or there is nothing the agent can do with it" };
  return { scopes: offered.filter((n) => seen.has(n)) };
}

/**
 * ⚠ **WHY A CONNECTION CANNOT BE USED, AND THE THREE ARE THREE DIFFERENT ACTS.** A single
 * "that connection does not work" would send somebody to reconnect when a refresh is what is
 * wanted, or to refresh what only the provider can put back. **The engine says the same three
 * things to a workflow**, and the two copies are compared in the cross-product census: one
 * sentence per cause, whichever door somebody meets it at.
 */
export const CONNECTION_TROUBLE = Object.freeze({
  expired: "the credential for that connection has run out — refresh it and run this again",
  revoked: "the provider withdrew access to that connection — it has to be connected again",
  disconnected: "that connection was disconnected, so nothing can be sent through it",
});

/**
 * WHAT A WORKFLOW NEEDS THAT IS NOT IN THE WORKFLOW — a declared COPY of the engine's
 * `workflowNeeds`, censused both ways in `test/agent-send.test.mjs`.
 *
 * ⚠ **STRUCTURE AND DEPENDENCIES ARE TWO ANSWERS.** `cleanWorkflow` says whether the steps are
 * a workflow at all — an unknown action, a branch that does not balance, a `{{reference}}`
 * nothing produces — and nothing outside the list can fix any of those, so they are a REFUSAL.
 * What is here is different in kind: an account not connected yet, a permission the provider
 * has not granted, an automation somebody is about to make, a time zone nobody has set. **Every
 * one can be true tomorrow without the workflow changing a character**, so reporting them as
 * refusals tells somebody their steps are wrong when it is their account that is not ready.
 *
 * ⚠ **AND "COULD NOT ASK" IS A THIRD ANSWER, never a satisfied one.** These are questions about
 * rows, so a read that failed leaves them unanswered — and reading that as "nothing is missing"
 * is a confident check about a workflow nobody looked at.
 *
 * **IT IS A COPY BECAUSE NEITHER PRODUCT MAY IMPORT THE OTHER**, and pure for the same reason
 * `cleanWorkflow` is: the caller hands in what it read, so one rule decides for the screen and
 * for a model's own `check_workflow` rather than two readings that agree until one is edited.
 * `null` means not read; `[]` means read and there are none, which is a real answer.
 */
export const WORKFLOW_NEEDS = Object.freeze(["connection", "permission", "subworkflow", "zone"]);

export function workflowNeeds(steps, {
  connections = null, automations = null, zone = null, sendScopes = null,
} = {}) {
  const needs = [];
  const unchecked = [];
  const list = Array.isArray(steps) ? steps : [];
  const want = (kind, what, say) => needs.push({ kind, what, say });
  const cannot = (kind, what, why) => unchecked.push({ kind, what, why });

  for (const st of list) {
    if (st?.type === "send") {
      const id = typeof st.connection === "string" ? st.connection : "";
      if (connections === null) {
        cannot("connection", id, "the connected accounts could not be read");
        continue;
      }
      const row = connections.find((c) => c?.id === id) ?? null;
      if (!row) {
        want("connection", id, "that connected account is not one of this agent's — connect it, "
          + "or point the step at one that is");
        continue;
      }
      if (row.status !== "active") {
        want("connection", id, CONNECTION_TROUBLE[row.status] ?? "that connected account cannot be used");
        continue;
      }
      // ⚠ THE PERMISSION IS THE CONNECTION'S OWN SCOPE, per PROVIDER, off `sendScope` — a
      // second provider may spell its own differently, and an account granted reading and not
      // sending is perfectly `active` and still cannot do the one thing the step is for.
      const need = sendScopes && typeof sendScopes === "object" ? sendScopes[row.provider] : undefined;
      if (typeof need !== "string" || !need) {
        cannot("permission", id, `nothing here says which permission a send through ${
          typeof row.provider === "string" && row.provider ? row.provider : "that provider"} needs`);
        continue;
      }
      const has = Array.isArray(row.scopes) ? row.scopes : [];
      if (!has.includes(need)) {
        want("permission", id, `that connected account was not granted permission to send `
          + `(${need}) — connect it again and allow sending`);
      }
      continue;
    }
    if (st?.type === "workflow") {
      const id = typeof st.runs === "string" ? st.runs : "";
      if (automations === null) { cannot("subworkflow", id, "this agent's automations could not be read"); continue; }
      if (!automations.some((a) => a?.id === id)) {
        want("subworkflow", id, "this agent has no automation with that id, so there is nothing to run");
      }
      continue;
    }
  }
  if (zone !== null) {
    if (zone.needed && !zone.have) {
      want("zone", zone.schedule ?? "", "nobody has set a time zone for this agent yet, so a "
        + "timed schedule has no local time to run at — set one in its settings");
    }
  }
  return { needs, unchecked };
}

/** Which send scopes this side knows, by provider — derived from the catalog, never typed. */
export const sendScopesByProvider = () => Object.fromEntries(
  AGENT_PROVIDERS.filter((p) => typeof p.sendScope === "string" && p.sendScope)
    .map((p) => [p.name, p.sendScope]));

/**
 * What a screen is told about one connection. **Never a credential**, because the view it
 * comes from does not select one — asserted against the view itself in `test/agent-api.test.mjs`.
 *
 * ⚠ **A STATUS IT CANNOT READ IS `disconnected`, WHICH FAILS CLOSED.** Being wrong that way
 * costs somebody a reconnect; the other way round draws an unusable connection as ready and
 * sends them looking for a fault in their workflow.
 */
export const CONNECTION_STATES = Object.freeze(["active", "expired", "revoked", "disconnected"]);
export function connectionRow(r) {
  const status = CONNECTION_STATES.includes(r?.status) ? r.status : "disconnected";
  const provider = typeof r?.provider === "string" ? r.provider : "";
  const known = providerByName(provider);
  return {
    id: typeof r?.id === "string" ? r.id : "",
    agentId: typeof r?.agent_id === "string" ? r.agent_id : "",
    provider,
    /** THE PROVIDER'S OWN WORDS, so a screen does not hold a second copy of them. */
    providerLabel: known?.label ?? provider,
    /** ⚠ **UNKNOWN MEANS SIMULATED HERE, and that is the safe direction**: a row naming a
     * provider this deployment does not have cannot send anything at all, so drawing it as
     * real would be the one claim that matters made wrongly. */
    simulated: known ? known.simulated === true : true,
    label: typeof r?.label === "string" ? r.label : "",
    account: typeof r?.account === "string" ? r.account : "",
    scopes: Array.isArray(r?.scopes) ? r.scopes.filter((x) => typeof x === "string") : [],
    status,
    /** WHY IT CANNOT BE USED, in a sentence — and only where there is something to say. */
    trouble: status === "active" ? null : (CONNECTION_TROUBLE[status] ?? null),
    /** WHETHER A REFRESH IS EVEN POSSIBLE, read from the view's own generated column. */
    refreshable: r?.refreshable === true,
    expiresAt: typeof r?.expires_at === "string" ? r.expires_at : null,
    stoppedWhy: typeof r?.stopped_why === "string" ? r.stopped_why : null,
    at: typeof r?.created_at === "string" ? r.created_at : null,
  };
}

/**
 * THE PATH A DELIVERY IS POSTED TO, on the agent engine.
 *
 * ⚠ **A PATH AND NEVER A URL, because this product does not hold the engine's origin.** It
 * rings the engine through a queue BINDING, which carries no address — so composing a URL
 * here would mean inventing one, and an invented origin is a URL somebody configures their
 * system with and which never works. The path is what we can say truthfully.
 */
export const webhookPath = (id) => `/deliver/${id}`;

/**
 * Mint one endpoint secret.
 *
 * **THE RANDOMNESS IS INJECTED**, so the one thing that must be unguessable is drivable in
 * a test — and it is REQUIRED rather than defaulted, because a minter that quietly falls
 * back to something weaker is the one failure nobody would see. Hex, so it survives every
 * header, form and JSON hop between here and whoever signs with it.
 */
export function mintWebhookSecret(random) {
  if (typeof random !== "function") throw new TypeError("mintWebhookSecret: needs a randomness source");
  const bytes = random(WEBHOOK_SECRET_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.length !== WEBHOOK_SECRET_BYTES) {
    throw new TypeError(`mintWebhookSecret: expected ${WEBHOOK_SECRET_BYTES} bytes`);
  }
  // ⚠ `byte`, NEVER `b` — and that is not style. `b` names the REQUEST BODY everywhere else
  // in this module, and `test/agent-api.test.mjs` censuses every `b.<field>` in the whole
  // file to prove no route reads an account off what somebody sent. A `b` that is a byte
  // made that census read `b.toString` as a body field and report a correct file as broken:
  // *a scan is only as good as the premise it states, and this module states that one.*
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * WHAT A LIST ROW SAYS, and the census that it says no secret.
 *
 * `webhookRow` FAILS CLOSED ON `enabled`: a value it cannot read is `false`, because being
 * wrong that way costs a press of the switch and the other way accepts deliveries for an
 * endpoint somebody turned off.
 */
export function webhookRow(r) {
  return {
    id: typeof r?.id === "string" ? r.id : "",
    name: typeof r?.name === "string" ? r.name : "",
    event: typeof r?.event_name === "string" ? r.event_name : "",
    enabled: r?.enabled === true,
    lastAt: typeof r?.last_at === "string" ? r.last_at : null,
    createdAt: typeof r?.created_at === "string" ? r.created_at : null,
    path: typeof r?.id === "string" ? webhookPath(r.id) : "",
  };
}

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
export const AUTOMATION_FIELD_KINDS = Object.freeze(["text", "days", "choice", "number", "time", "name", "id", "event"]);

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
    type: "event",
    kind: "pause",
    // ⚠ ITS RESUME IS KEYED BY THIS STEP'S ID AND THE FIRST ARRIVAL STANDS — `heard` is a map
    // keyed by step, accumulated and never cleared, exactly as `decisions` is. So it carries the
    // approval's own loop wall for the approval's own reason. A DECLARED COPY of the engine's
    // flag, censused both ways.
    decided: true,
    label: "Wait for something to happen",
    does: "Pause until an event of a given name reaches this agent, then carry on with what it carried.",
    fields: Object.freeze([
      F({ name: "name", kind: "event", required: true, says: "the name of the event to wait for",
          empty: "say which event to wait for" }),
      OUT,
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
    /**
     * SEND SOMETHING THROUGH A CONNECTED ACCOUNT — a `pause`, because a person approves it.
     *
     * ⚠ **THE APPROVAL AND THE SEND ARE ONE STEP, which is why this is not two entries.** An
     * approval step followed by a send step would re-resolve its own `{{references}}` at its
     * own moment, so a value that moved between the two is approved in one shape and sent in
     * another. The engine resolves the payload once, hashes it, shows it, and performs the
     * action from the same object — and a change to `to` or `body` changes the hash, which is
     * what makes editing them require fresh approval.
     *
     * **The words here are a PERSON'S** — the engine's `does` is the same sentence because
     * both halves of this catalog are read by a person choosing a step, unlike a tool's
     * description, which is written for a model.
     */
    type: "send",
    kind: "pause",
    label: "Send a message",
    does:
      "Send a message from one of this agent's connected accounts. A person is shown the " +
      "account, who it is for and the exact words, and has to approve it before it goes. " +
      "Put {{a name}} anywhere in the recipient or the message to use an input or an " +
      "earlier step's answer.",
    fields: Object.freeze([
      F({ name: "connection", kind: "id", required: true, says: "which connected account to send from",
          names: "a connection", empty: "say which connected account to send from" }),
      F({ name: "to", kind: "text", required: true, max: MAX_STEP_RECIPIENT, refs: true,
          says: "who it is for", empty: "say who it is for" }),
      F({ name: "body", kind: "text", required: true, max: MAX_STEP_MESSAGE, refs: true,
          says: "what it says", empty: "say what it should say" }),
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
          names: "an automation", empty: "say which automation to run" }),
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
    /**
     * ⚠ **WHAT KIND OF THING AN ID NAMES IS THE FIELD'S, NOT THIS READER'S — and until the
     * send step there was only one, so this said "automation" about every id there could
     * be.** Found by the cross-product census the hour a second one existed: the site said
     * *which connected account to send from didn't arrive as an automation*, which names the
     * wrong kind of thing and sends somebody to look at their automations. `names` is
     * declared on the field beside `says` and `empty`, for the same reason those are, and it
     * defaults to `automation` so every field written before this says exactly what it said.
     */
    const kind = typeof f.names === "string" && f.names.trim() !== "" ? f.names : "an automation";
    if (typeof raw !== "string") return { error: `${said} didn't arrive as ${kind}` };
    const id = raw.trim().toLowerCase();
    if (!id) return f.required ? { error: blank } : { value: undefined };
    if (!AUTOMATION_ID.test(id)) return { error: `${said} didn't arrive as ${kind}` };
    return { value: id };
  }
  /**
   * AN EVENT NAME, and it is its own kind rather than a `name` with a pattern on top.
   *
   * ⚠ **`AGENT_NAME_RE` REFUSES A DOT AND AN EVENT NAME CARRIES ONE** (`order.paid`), so a shape
   * enforced anywhere but here would mean this door refusing what the engine accepts — measured,
   * with both halves reading as correct. This reader is generic over the KIND and knows nothing
   * about one step's own `read`, which is exactly why the shape has to live on a kind.
   */
  if (f.kind === "event") {
    if (raw === undefined || raw === null || raw === "") {
      return f.required ? { error: blank } : { value: null };
    }
    if (typeof raw !== "string") return { error: `${said} didn't arrive as a name` };
    const name = raw.trim().toLowerCase();
    if (!AGENT_EVENT_RE.test(name)) {
      return { error: `${said} has to be a short name: lower-case letters, digits, dots, dashes and underscores, starting with a letter` };
    }
    return { value: name };
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
/**
 * ⚠ **ONE READER PER TRIGGER VALUE, BECAUSE THERE ARE TWO DOORS AND THEY MUST NOT DRIFT.**
 *
 * `cleanSchedule` reads a WHOLE trigger — every field at once, with the wholeness rules a
 * create needs — and `cleanPatch` reads only the fields an edit NAMED, leaving wholeness to
 * the transaction. What a value may be, and the sentence a bad one earns, is the same question
 * either way: two copies of "which strings are days, in which order" is how one door comes to
 * refuse what the other stores, and this repository has the same shape recorded a dozen times
 * over. So the shapes live here and the two doors differ only in WHICH of them they ask.
 *
 * Each answers `{error}` or the field under its own name, so a caller reads one property and
 * cannot mistake "no answer" for a value.
 */
const blankish = (v) => v === undefined || v === null || v === "";

/**
 * The time of day, as somebody typed it — `HH:MM`.
 *
 * ⚠ **THE TWO DOORS WANT TWO SHAPES OF ONE VALUE, and that is the two FUNCTIONS' contracts
 * rather than a normalisation this reader gets to choose.** `agent.create_automation` and
 * `agent.update_automation` take a `time`, so the store sends the column's own `HH:MM:SS`;
 * `agent.patch_automation` reads `atLocal` against `^([01][0-9]|2[0-3]):[0-5][0-9]$` — which is
 * also the shape the engine's own `change_automation` sends it. **MEASURED: seconds there are
 * answered `bad-time`**, which is how this was found, by a demonstration rather than by reading.
 *
 * So this answers the SHAPE it was given and each door adds what its own function wants.
 */
export function trigAt(v) {
  const at = typeof v === "string" ? v.trim() : "";
  if (!AT_SHAPE.test(at)) return { error: "say what time of day it should run, as HH:MM" };
  return { at };
}

/** A time zone the SERVER can really use, asked of `Intl` rather than of a list. */
export function trigZone(v) {
  const zone = validTimeZone(v);
  if (!zone) return { error: "that isn't a time zone this can use" };
  return { zone };
}

/**
 * The days of the week, in the WEEK's own order.
 *
 * ⚠ **`AUTOMATION_DAYS`' OWN ORDER, which is the ENGINE's `WEEKDAYS` — Sunday first, because
 * `Date.getDay()` is.** Two saves of one selection are byte-identical because the order is this
 * list's rather than the ticking order, which is what makes a stored value comparable at all.
 *
 * **REFUSED BY NAME, NEVER SHORTENED**: a selection quietly missing the day it could not read is
 * a schedule that looks saved and runs on other days. `[]` comes back as `[]` — whether an empty
 * list is allowed is the CALLER's question, because it is a refusal on a weekly schedule and a
 * real clear on an edit that stops being one.
 */
export function trigDays(raw) {
  if (!Array.isArray(raw)) return { error: "pick at least one day of the week" };
  const bad = raw.find((d) => typeof d !== "string" || !AUTOMATION_DAYS.includes(d.trim().toLowerCase()));
  if (bad !== undefined) return { error: `"${String(bad)}" isn't a day of the week` };
  const picked = new Set(raw.map((d) => d.trim().toLowerCase()));
  return { days: AUTOMATION_DAYS.filter((d) => picked.has(d)) };
}

/**
 * The one day a one-off runs on.
 *
 * ⚠ **CHECKED AS A REAL CALENDAR DAY, not just as a shape** — `2026-02-30` matches
 * `ON_DATE_SHAPE` and is not a day, and Postgres would refuse the insert with its own message
 * about a date somebody typed. The arithmetic is done rather than handed to `Date`, because
 * `new Date("2026-02-30")` rolls forward to March and would store a day nobody chose.
 *
 * ⚠ **A DATE IN THE PAST IS NOT REFUSED, AND THE REASON THIS COMMENT USED TO GIVE WAS FALSE.**
 *
 * It read: *"`tick_automations` answers a one-off whose day has gone as MISSED and records it,
 * which is a fact somebody can read"*. **MEASURED on a real PostgreSQL, a `once` schedule created
 * for `2020-01-01`:** `agent.automation_next_run` answers **NULL**, so `next_run_at` is stored
 * NULL, the tick's own `where next_run_at <= now()` matches nothing, and it answers **no rows at
 * all** — 0 history rows, 0 executions, nothing recorded missed. So the automation is accepted,
 * looks scheduled, and is silently inert for ever.
 *
 * **WHAT IS TRUE is that this reader cannot decide it, and that IS about midnight**: it is handed
 * the date alone, and whether a day has gone depends on the automation's own ZONE, which lives
 * two fields away. `cleanSchedule` and `cleanPatch` both have the zone in hand and could refuse
 * it; that is a DESIGN DECISION and it is recorded as one rather than taken here, because a
 * refusal at the site's two doors and not at the agent's `make_automation` would be a wall one
 * door has — this repository's own recorded class.
 *
 * **WHAT IS DONE INSTEAD IS FEEDBACK**: the automations list says the date has passed and that it
 * will not run (`autoTrigger` in `public/chat.js`), so the one thing a person cannot see from a
 * stored row is the thing the screen now says.
 */
export function trigOnDate(v) {
  const on = typeof v === "string" ? v.trim() : "";
  if (!ON_DATE_SHAPE.test(on)) return { error: "say which day it should run, as YYYY-MM-DD" };
  const [y, mo, d] = on.split("-").map(Number);
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > days[mo - 1]) return { error: `${on} isn't a day in the calendar` };
  return { onDate: on };
}

/**
 * The event that starts it.
 *
 * **THE CASE IS FOLDED**, here and in the endpoint and in the engine's own reader, so
 * `Order.Paid` stores `order.paid` everywhere and a trigger really matches.
 */
export function trigOnEvent(v) {
  const name = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!name || !AGENT_EVENT_RE.test(name)) {
    return { error: "an event's name is lower-case letters, digits, dots, dashes and underscores, starting with a letter" };
  }
  return { onEvent: name };
}

/**
 * ⚠ **WHAT EACH SCHEDULE NEEDS — a declared copy of the engine's `SCHEDULE_NEEDS`, and of
 * `automations_schedule_is_whole` behind it, censused both ways in `test/agent-send.test.mjs`.**
 *
 * `cleanSchedule` decides the same thing per branch and will go on doing so — its refusals are
 * per field and per schedule, which a table cannot express. What this is for is the questions
 * ABOUT a schedule rather than the reading of one: which of them is local to somewhere, and
 * therefore needs a time zone somebody has to have set. The engine derives exactly that from
 * its own copy, and a third derivation on this side would be a third answer.
 */
export const AUTOMATION_SCHEDULE_NEEDS = Object.freeze({
  manual: Object.freeze([]),
  daily: Object.freeze(["at"]),
  weekly: Object.freeze(["at", "days"]),
  once: Object.freeze(["at", "onDate"]),
});

/**
 * WHICH SCHEDULES ARE LOCAL TO SOMEWHERE — DERIVED, never listed. A hand-kept list is what
 * let a weekly schedule through with no zone on the engine's side once already.
 */
export const SCHEDULE_NEEDS_ZONE = Object.freeze(
  Object.keys(AUTOMATION_SCHEDULE_NEEDS).filter((k) => AUTOMATION_SCHEDULE_NEEDS[k].includes("at")));

export function cleanSchedule(b) {
  /**
   * ⚠ **ABSENT AND WRONG-KIND ARE TWO ANSWERS, AND THIS READ COLLAPSED THEM.** A non-string
   * fell through to `manual`, so a request asking for `["daily"]` saved an automation that
   * runs by HAND and answered `ok` — the daily run it asked for would never have fired, and
   * nothing anywhere said so. **A filter on somebody's input is a silent drop; a check is a
   * sentence.**
   *
   * The engine's `authorableSchedule` had the same shape and both are fixed together, because
   * the two doors have to agree about what may be stored — the rule `cleanWorkflow` and the
   * refusal sentences already follow, censused in `test/agent-send.test.mjs`.
   */
  if (b?.schedule !== undefined && b?.schedule !== null && b?.schedule !== ""
      && typeof b.schedule !== "string") {
    return { error: "say when it runs as a word: by hand, every day, on chosen days, or once on a date" };
  }
  const schedule = typeof b?.schedule === "string" ? b.schedule.trim() : "manual";
  if (!AUTOMATION_SCHEDULES.includes(schedule)) {
    return { error: "an automation runs by hand, every day, on chosen days of the week, or once on a date" };
  }
  let zone = null;
  if (!blankish(b?.zone)) {
    const z = trigZone(b.zone);
    if (z.error) return z;
    zone = z.zone;
  }

  /**
   * WHICH EVENT STARTS IT, and it is answered for EVERY schedule rather than being a fifth
   * one.
   *
   * ⚠ **AN EVENT IS NOT A SCHEDULE — it is a second, independent way in.** "Every morning AND
   * whenever a payment lands" is a thing somebody wants, and folding the two into one field
   * would make it unsayable; a manual automation that also listens is the ordinary shape of
   * "I can run this myself, and it runs itself when something happens".
   */
  let onEvent = null;
  if (!blankish(b?.on_event)) {
    const ev = trigOnEvent(b.on_event);
    if (ev.error) return ev;
    onEvent = ev.onEvent;
  }

  if (schedule === "manual") {
    // A TIME WITH NO SCHEDULE IS A CONTROL SOMEBODY SET THAT NOTHING READS, so it is
    // dropped rather than stored — and the column's constraint refuses it anyway.
    return { schedule, at: null, zone, days: [], onDate: null, onEvent };
  }

  const at = trigAt(b?.at);
  if (at.error) return at;
  // EVERY TIMED SCHEDULE NEEDS A ZONE, and the sentence names the schedule that was asked
  // for: "a daily schedule needs a time zone" about a weekly one sends somebody to the wrong
  // control. One reader, one sentence per schedule.
  if (!zone) return { error: `a ${schedule} schedule needs a time zone, so the time means somewhere` };
  /**
   * ⚠ **`[]` RATHER THAN `null` FOR A SCHEDULE WITH NO DAYS, because that is what the COLUMN
   * means.** `agent.automations.days` is `not null default '{}'` and
   * `automations_schedule_is_whole` compares it with `'{}'` for every schedule but weekly — so
   * empty IS "not applicable" here, and the first draft of this reader answered `null`, which
   * the column refused outright. One shape leaves this reader, and it is the store's.
   */
  // THE COLUMN'S OWN SHAPE, because `create_automation` and `update_automation` take a `time`.
  const when = { schedule, at: `${at.at}:00`, zone, days: [], onDate: null, onEvent };

  if (schedule === "weekly") {
    const picked = trigDays(b?.days);
    if (picked.error) return picked;
    // A WEEKLY SCHEDULE WITH NO DAYS WOULD NEVER COME DUE, and the emptiness rule is the
    // CALLER's rather than the reader's: an edit that moves a weekly schedule to a daily one
    // has to CLEAR the days, so `[]` is a real answer at the patch door and is not one here.
    if (!picked.days.length) return { error: "pick at least one day of the week" };
    return { ...when, days: picked.days };
  }

  if (schedule === "once") {
    const on = trigOnDate(b?.on_date);
    if (on.error) return on;
    // A DATE IN THE PAST IS DELIBERATELY NOT REFUSED HERE. `tick_automations` answers a
    // one-off whose day has gone as MISSED and records it, which is a fact somebody can read;
    // refusing it at the door would instead depend on which side of midnight the save landed.
    return { ...when, onDate: on.onDate };
  }
  // SECONDS ARE OURS, NOT THE CALLER'S. The screen offers a time, not a stopwatch.
  return when;
}

/**
 * ⚠ **EVERY COLUMN `automationRow` READS, AND THE `&select=` OF EVERY READ IT MAPS.**
 *
 * PostgREST sends only the columns a request NAMES, and `automationRow` fails closed on
 * every field it cannot read — so a column missing from a select list is not an error
 * anywhere: it is a weekly automation showing no days, a one-off with no date, an event
 * trigger listening for nothing, and declared inputs absent from the screen's own list.
 * **MEASURED before this constant existed**: the list named ten of the fourteen, so
 * `agentAutoRunPress` read `inputs: []` and started an automation that asks for answers
 * with none of them, and the edit form seeded `inputs: []` over a full replace.
 *
 * It is ONE list because two were two copies of one thing that had already drifted apart
 * from each other and from the reader. `test/agent-automations.test.mjs` derives the set
 * from `automationRow` ITSELF — driving it through a recording proxy, never a scan of its
 * source — so a field added to that function next month fails by existing.
 */
/**
 * ⚠ **WHAT AN EDIT REALLY ASKED FOR — AND PRESENCE IS THE INTERFACE.**
 *
 * `cleanSchedule` above reads a WHOLE trigger, which is what a create needs: there is no stored
 * row to fall back on, so every field has to be answered and the wholeness rules can be applied
 * here. An EDIT is the opposite question. It names the fields somebody changed, and everything it
 * does not name has to keep what the DATABASE holds — resolved under the row lock inside
 * `agent.patch_automation`, never reconstructed here and never reconstructed from a browser's
 * cached copy of the row.
 *
 * **SO THIS READER VALIDATES SHAPES AND DELIBERATELY NOT WHOLENESS.** A patch of `{"days": []}`
 * on a weekly automation is a schedule with no days, and whether that is whole depends on the
 * SCHEDULE the row will end up with — which is knowable only after the absent keys are resolved,
 * which is inside the transaction. Checking it here would mean reading the row first and deciding
 * from an unlocked answer, which is the stale read this whole change removes.
 *
 * **AN ABSENT KEY AND AN EXPLICIT `null` ARE DIFFERENT THINGS, and that distinction is the
 * requirement.** Absent means leave it alone. `null` (and `""`, which is what an emptied box
 * sends) means CLEAR it, which is what moving a daily schedule to a manual one needs. A reader
 * that collapsed the two would make a form with no control for a field able to delete that field
 * by saying nothing about it — which is exactly how an event binding was lost.
 */
export const AUTOMATION_PATCH_FIELDS = Object.freeze({
  name: "name", enabled: "enabled", schedule: "schedule", at: "atLocal", zone: "zone",
  steps: "steps", inputs: "inputs", days: "days", on_date: "onDate", on_event: "onEvent",
});

/**
 * Whether a body really NAMES a field.
 *
 * `Object.hasOwn` rather than truthiness, because `enabled: false`, `steps: []` and `zone: ""`
 * are each a value somebody meant — and the two of those that are falsy are the edits a person
 * most needs to be able to make. An explicit `undefined` reads as absent: a parsed JSON body
 * cannot carry one, so the only caller that can is a JavaScript one, and there `undefined` means
 * "I have nothing to say about this".
 */
export const fieldNamed = (b, f) =>
  !!b && typeof b === "object" && Object.hasOwn(b, f) && b[f] !== undefined;

/**
 * ⚠ **WHETHER AN EDIT HAS TO BE VALIDATED AGAINST THE STORED CONFIGURATION.**
 *
 * A `{{reference}}` in a step is refused unless something produces it, and a declared input is
 * half of what can — so **the steps and the declarations are one thing to validate, and an edit
 * that names either half has to be checked against whatever the automation will really have.**
 *
 * ⚠ **THE RULE WAS `steps && !inputs`, AND THAT MISSED THE OTHER HALF ENTIRELY — reproduced
 * before this was touched.** An inputs-only patch named no steps, so nothing here asked for the
 * stored ones and `cleanWorkflow` was never called at all:
 *
 *     stored: inputs [{name:"customer"}]  steps [{type:"note", text:"Hello {{customer}}"}]
 *     patch : {inputs: []}
 *     cleanPatch answered {"patch":{"inputs":[]}} — accepted, written, nothing said
 *
 * ...and the next execution failed at step 1 for a value nothing produced. The validator could
 * see it perfectly — the SAME steps against an empty declaration set answer *step 1: nothing
 * here produces a value called "customer"* — so this was never a missing rule. It was a rule
 * one door never reached. **A rename of the input is the same shape and is the commoner one.**
 *
 * **THE ENGINE'S OWN `change_automation` HAD IT RIGHT ALREADY** (`capability-tools.mjs`, the
 * *validated together* block), down to naming this exact failure in its own comment — so the two
 * doors onto one operation disagreed, and the one a person uses was the weaker one.
 *
 * So: TRUE when the patch names exactly one of the two, because then the other half comes from
 * the stored row. Both named is self-contained and needs no read; neither named touches nothing
 * `cleanWorkflow` looks at.
 *
 * ONE READER, so the route and `cleanPatch` cannot disagree about when that read is needed. A
 * caller that forgot to ask this passes no configuration, and `cleanPatch` then REFUSES rather
 * than validating against emptiness — see its own note, which is where that direction is
 * decided.
 */
export const patchNeedsStored = (b) => fieldNamed(b, "steps") !== fieldNamed(b, "inputs");

/**
 * Read an edit into the patch `agent.patch_automation` takes.
 *
 * `held` is the automation as it stands — `{steps, inputs, version}`, an `automationRow`. It is
 * read ONLY to validate against and is never put into the patch, so what the transaction
 * preserves is still what it resolves from the LOCKED row rather than what this process read a
 * moment ago.
 *
 * ⚠ **IT USED TO TAKE THE DECLARATIONS ALONE, and that shape is what made the defect above
 * unreachable-by-construction in one direction only.** With only the inputs in hand there was
 * nothing to check a stored STEP list against, so an inputs-only edit had no validation to fail.
 * The argument is the row now, which is the smallest thing that can answer both halves.
 *
 * ⚠ **AND IT ANSWERS THE VERSION TO FENCE ON, rather than leaving the caller to decide.** When
 * the verdict drew on a stored half, the combination that was validated is only the combination
 * that gets written if nothing moved that half in between — so the number to compare comes back
 * beside the patch, from the same read the verdict came from. A caller cannot fence on a
 * different read than the one that was validated, because there is only one.
 */
export function cleanPatch(b, held) {
  /**
   * ⚠ **A `held` THAT IS NOT A ROW IS A CALL SITE'S BUG AND IT THROWS, because every other
   * reading of it is silently wrong about a customer's configuration.**
   *
   * The old signature took the DECLARATIONS ALONE, so a call site left behind hands an ARRAY.
   * Measured against the reads below: `held?.inputs` is `undefined`, `held?.steps` is `undefined`
   * and `held?.version` is `undefined` — while `!held` is FALSE, because an array is truthy. So
   * the fail-closed refusal does not fire and the whole combination is validated against
   * EMPTINESS: a stored step list refused for every reference in it (*"your steps are broken"*
   * about steps that are fine), proposed steps refused for every reference to an input the
   * automation really has, and no fence sent for an edit that needed one.
   *
   * **A RETURNED ERROR WOULD BE THE WRONG SENTENCE**, because it reads as a fact about the
   * request when it is a fact about our own hop — and this argument can only ever come from code
   * in this file (the route passes `automationRow`'s answer or `null`), never from a body. So the
   * one moment it can be wrong is an edit to a call site, which is exactly when a throw is cheap
   * and a silent misreading is not.
   *
   * `null` and an absent argument stay a real answer: *nothing was read*, which the refusal
   * below names.
   */
  if (held != null && (typeof held !== "object" || Array.isArray(held))) {
    throw new TypeError("cleanPatch takes the automation as it stands (an automationRow) or null");
  }

  const patch = {};

  if (fieldNamed(b, "name")) {
    const name = cleanText(b.name, AUTOMATION_NAME_MAX);
    if (!name) return { error: "give it a name first" };
    patch.name = name;
  }

  // **REFUSED RATHER THAN COERCED.** `Boolean("false")` is `true`, so a string out of a form
  // would turn "off" into "on" — the one direction that starts work nobody asked for.
  if (fieldNamed(b, "enabled")) {
    if (typeof b.enabled !== "boolean") return { error: "an automation is either on or off" };
    patch.enabled = b.enabled;
  }

  // A SCHEDULE CANNOT BE CLEARED, because `manual` is what "no schedule" is called. So there is
  // no `null` reading here: a blank is a caller that meant something it has not said.
  if (fieldNamed(b, "schedule")) {
    if (typeof b.schedule !== "string") {
      return { error: "say when it runs as a word: by hand, every day, on chosen days, or once on a date" };
    }
    const when = b.schedule.trim();
    if (!AUTOMATION_SCHEDULES.includes(when)) {
      return { error: "an automation runs by hand, every day, on chosen days of the week, or once on a date" };
    }
    patch.schedule = when;
  }

  if (fieldNamed(b, "at")) {
    if (blankish(b.at)) patch.atLocal = null;
    else { const r = trigAt(b.at); if (r.error) return r; patch.atLocal = r.at; }
  }

  if (fieldNamed(b, "zone")) {
    if (blankish(b.zone)) patch.zone = null;
    else { const r = trigZone(b.zone); if (r.error) return r; patch.zone = r.zone; }
  }

  // `[]` IS A REAL ANSWER HERE and is not one on a weekly schedule: an edit that stops being
  // weekly has to clear the days, or the combination it leaves cannot be a row at all.
  if (fieldNamed(b, "days")) {
    const r = trigDays(b.days);
    if (r.error) return r;
    patch.days = r.days;
  }

  if (fieldNamed(b, "on_date")) {
    if (blankish(b.on_date)) patch.onDate = null;
    else { const r = trigOnDate(b.on_date); if (r.error) return r; patch.onDate = r.onDate; }
  }

  if (fieldNamed(b, "on_event")) {
    if (blankish(b.on_event)) patch.onEvent = null;
    else { const r = trigOnEvent(b.on_event); if (r.error) return r; patch.onEvent = r.onEvent; }
  }

  /**
   * ⚠ **THE STEPS AND THE DECLARATIONS ARE VALIDATED AS ONE COMBINATION, and every half the
   * patch does not name comes from the stored row — which is what the automation will still have
   * when this is done.**
   *
   * The three cases and why they are one rule:
   *   - **inputs only** — the STORED steps are checked against the proposed declarations, so
   *     removing or renaming an input that a stored step refers to is refused here rather than
   *     at the step, days later, on a run that has already done the steps above it.
   *   - **steps only** — the proposed steps are checked against the STORED declarations, which
   *     is what this door already did.
   *   - **both** — the proposed combination is checked against itself, and nothing stored is
   *     read or fenced on, because the answer cannot depend on a value that is not in the call.
   *
   * ⚠ **ONLY WHAT THE CALL NAMED GOES ON THE PATCH.** `cleanWorkflow` answers a canonical step
   * list even when it was handed the stored one, and putting that on the patch would turn "I
   * renamed an input" into an edit of the steps — which moves the version, invalidates a
   * parent's snapshot, and makes the approval a person gave cover more than what they saw. The
   * engine's own tool states this rule about the same patch; it is the same rule here.
   */
  const sameSurface = fieldNamed(b, "steps") === fieldNamed(b, "inputs");
  let declared = Array.isArray(held?.inputs) ? held.inputs : [];
  if (fieldNamed(b, "inputs")) {
    const asked = cleanInputs(b.inputs);
    if (asked.error) return asked;
    patch.inputs = asked.inputs;
    declared = asked.inputs;
  }

  if (fieldNamed(b, "steps") || fieldNamed(b, "inputs")) {
    /**
     * ⚠ **A PATCH THAT NEEDS THE STORED CONFIGURATION AND WAS HANDED NONE IS REFUSED, not
     * validated against emptiness.**
     *
     * Validating a stored step list against `[]` would refuse every reference in it and read as
     * "your steps are broken" about steps that are fine; validating proposed steps against `[]`
     * would refuse every reference to an input the automation really has. Both are a wrong
     * sentence about correct configuration, which is worse than a refusal that names the cause —
     * and the route always reads the row (`patchNeedsStored`), so this is a wall for a caller
     * that skipped that hop rather than a path anybody reaches from the screen.
     */
    if (!sameSurface && !held) {
      return { error: "couldn't read what this automation has now, so this change wasn't checked — try again" };
    }
    const steps = fieldNamed(b, "steps") ? b.steps
      : (Array.isArray(held?.steps) ? held.steps : []);
    const flow = cleanWorkflow(steps, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, declared);
    if (flow.error) return flow;
    if (fieldNamed(b, "steps")) patch.steps = flow.steps;
  }

  /**
   * ⚠ **THE FENCE, AND IT IS ONLY OFFERED WHERE IT IS REALLY NEEDED.**
   *
   * A verdict that drew on a stored half is only a verdict about what gets written if nothing
   * moved that half between the read and the write. `agent.patch_automation` has taken
   * `p_expect_version` since it was written and no door had ever sent one; `version` now moves
   * on a change of the steps OR of what the automation asks for, which is exactly this surface.
   *
   * **A CONCURRENT RENAME STILL DOES NOT REFUSE ANYTHING**, which is what made the old "no fence
   * from this door" reasoning right about the case it was considering: the counter does not move
   * for a name, a time, a zone, a day list, a date or an event. So this cannot produce a refusal
   * with nothing for the person to do about it — it refuses exactly when somebody else changed
   * the thing this edit was checked against.
   *
   * `null` WHERE THE VERSION COULD NOT BE READ, and `expectVersion` is then absent: a fence on a
   * number nobody read is a fence that passes because two unknowns happened to match.
   */
  const expectVersion = !sameSurface && Number.isInteger(held?.version) ? held.version : null;
  return expectVersion === null ? { patch } : { patch, expectVersion };
}

/**
 * One sentence per refusal `agent.patch_automation` can make.
 *
 * ⚠ **THE WHOLENESS REFUSALS ARE THE REACHABLE ONES, and they are the reason this exists.**
 * Every shape is checked by `cleanPatch` before anything is sent, so `bad-name` and its siblings
 * are walls rather than paths from this door — but the COMBINATION a patch resolves to is decided
 * in the transaction, against the locked row, so `bad-time`, `bad-zone`, `bad-days`, `bad-date`
 * and `bad-schedule` are answers a person can really get and each one names something different
 * to do about it.
 *
 * **THE FUNCTION CARRIES THE RESOLVED SCHEDULE on exactly those five**, which is what lets the
 * sentence say which schedule is short of what — *"a daily schedule needs a time zone"* about a
 * weekly one sends somebody to the wrong control. Where it is absent the sentence is the shape
 * one, which is the honest reading of a refusal about the value rather than the combination.
 *
 * `null` for a code this does not know, so the route can answer 500 rather than blame the caller
 * for something nobody here can name — the rule `sayMemory` already follows.
 */
export function sayPatch(a) {
  const when = typeof a?.schedule === "string" && a.schedule !== "manual" ? a.schedule : "";
  switch (a?.error) {
    case "bad-patch": return "say which fields to change";
    case "bad-field": return `there is nothing called "${String(a?.field ?? "")}" to change`;
    case "bad-name": return "give it a name first";
    case "bad-enabled": return "an automation is either on or off";
    case "bad-schedule":
      return "that combination isn't a schedule: one that runs by hand can't also carry a time, "
        + "a day list or a date — clear those as well";
    case "bad-time":
      return when ? `a ${when} schedule needs a time of day — say what time it should run`
                  : "say what time of day it should run, as HH:MM";
    case "bad-zone":
      return when ? `a ${when} schedule needs a time zone, so the time means somewhere`
                  : "that isn't a time zone this can use";
    case "bad-days":
      if (when === "weekly") return "pick at least one day of the week";
      return when ? `a ${when} schedule doesn't run on chosen days — clear the day list as well`
                  : "pick the days of the week as a list";
    case "bad-date":
      if (when === "once") return "say which day it should run, as YYYY-MM-DD";
      return when ? `a ${when} schedule doesn't run on one date — clear the date as well`
                  : "say which day it should run, as YYYY-MM-DD";
    case "bad-event":
      return "an event's name is lower-case letters, digits, dots, dashes and underscores, starting with a letter";
    case "bad-steps": return "send the steps as a list";
    case "bad-inputs": return "send what it asks for as a list";
    /**
     * ⚠ **REACHABLE FROM THIS DOOR NOW, and this comment used to say it was not.** An edit that
     * named one half of the steps-and-declarations surface is validated against the stored other
     * half and fences on the version of it, so `stale` is the answer when somebody else changed
     * that half in between — and the sentence has to send a person to re-open rather than retry,
     * because the combination they were shown is not the combination that is stored now.
     *
     * **IT NAMES WHAT MOVED**, since "somebody changed this" about a form with a dozen controls
     * is not something to act on: the two fields the counter covers are the steps and what the
     * automation asks for, and those are the two the person has to look at again.
     */
    case "stale":
      return "somebody else changed this automation's steps or what it asks for while you had it "
        + "open — open it again so you're editing what's there now";
    default: return null;
  }
}

export const AUTOMATION_COLUMNS = Object.freeze([
  "id", "agent_id", "name", "enabled", "schedule", "at_local", "zone",
  "days", "on_date", "on_event", "steps", "inputs", "next_run_at", "updated_at",
  // ⚠ `version` IS WHAT A GUARDED EDIT NEEDS, and it was missing from this list while the
  // migration's own comment said the read "carries its version, which is what a guarded edit
  // needs". So the fence `agent.patch_automation` has always offered could not be used from
  // this door at all: the number to send was never on the wire. A reader that cannot see the
  // thing it is meant to compare is the wiring layer, one field wide.
  "version",
]);

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
    // ⚠ FAILS CLOSED, EACH IN ITS OWN DIRECTION. A `days` that cannot be read is `[]` rather
    // than every day — a weekly schedule showing no days is a screen somebody fixes, and one
    // showing seven is a claim the row does not make. An unreadable date or event is `null`,
    // which reads as "not on a date" and "not on an event".
    days: Array.isArray(r?.days) ? AUTOMATION_DAYS.filter((d) => r.days.includes(d)) : [],
    onDate: typeof r?.on_date === "string" && r.on_date ? r.on_date.slice(0, 10) : null,
    onEvent: typeof r?.on_event === "string" && r.on_event ? r.on_event : null,
    steps,
    // WHAT IT ASKS FOR WHEN IT IS STARTED. `[]` for an automation that asks nothing,
    // which is a real answer and what every automation made before this had.
    inputs: Array.isArray(r?.inputs) ? r.inputs : [],
    nextRunAt: typeof r?.next_run_at === "string" ? r.next_run_at : null,
    updatedAt: typeof r?.updated_at === "string" ? r.updated_at : null,
    /**
     * ⚠ **THE VERSION OF THE CONFIGURATION A GUARDED EDIT FENCES ON — `null` for a row whose
     * version cannot be read, never a number.**
     *
     * It moves on a change of the STEPS or of what the automation ASKS FOR: together those are
     * the whole surface `cleanWorkflow` reads, so a counter over them is exactly what says
     * "the combination you validated is still the combination you are writing into".
     *
     * `null` is "we do not know", the rule `knowledgeRow` already follows for the same field
     * name — and it is load-bearing here rather than tidy: `cleanPatch` refuses to fence on a
     * version it could not read rather than sending one it guessed, because a guessed number
     * that happens to match is a fence that passes over a change it never saw.
     */
    version: Number.isInteger(r?.version) ? r.version : null,
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
/**
 * ⚠ **THE FUNCTION'S OWN MEMORY OBJECT, READ THE WAY A ROW IS.**
 *
 * `agent.save_memory` answers `{id, name, value, version, source}` and `agent_memory` answers
 * a ROW with `key`, `created_at` and `updated_at` — so the two shapes are not the same object
 * and this is where the difference lives, rather than in the route. The screen reads `key`, so
 * that is the name it gets; the two timestamps are NOT invented, because the function does not
 * answer them and a made-up `at` is worse on a list than an absent one.
 */
export function memoryFromAnswer(m) {
  return memoryRow({
    id: m?.id, key: m?.name, value: m?.value, source: m?.source, version: m?.version,
    created_at: null, updated_at: null,
  });
}

/**
 * ⚠ **ONE SENTENCE PER REFUSAL `agent.save_memory` AND `agent.delete_memory` CAN ANSWER, and
 * a code with no sentence is NOT read as somebody else's problem.**
 *
 * Those functions answer CODES, which is right for a caller and useless on a screen. The
 * checks above each route compose the ordinary sentences, so what reaches here is a refusal
 * they did not anticipate — which must still be said properly rather than falling through to
 * "that agent isn't here", the answer it used to get by being a `null` row.
 *
 * **`no-agent` IS THE ONE THAT KEEPS ITS OLD WORDS**, because it really is the missing-agent
 * answer and a stranger must not be able to tell a refusal from an agent that is not theirs.
 */
export function sayMemory(code, answer) {
  if (code === "no-agent") return [404, "that agent isn't here"];
  if (code === "too-many") {
    const held = Number.isInteger(answer?.held) ? answer.held : MAX_MEMORIES;
    return [409, `that's as much as one agent can remember (${held}) — delete something first`];
  }
  if (code === "bad-name") {
    return [400, "that can't be a name — use lower-case letters, digits and underscores, starting with a letter"];
  }
  if (code === "empty") return [400, "say what to remember — to forget it, delete it instead"];
  if (code === "too-long") return [400, `that's longer than one memory can be (${MEMORY_VALUE_MAX} characters)`];
  if (code === "bad-source") return [400, "a memory has to say who it came from"];
  // ⚠ A CODE THIS DOES NOT KNOW IS A 500 AND SAYS SO, never a 400 blaming the caller for
  // something we cannot name. A refusal nobody can act on is a refusal to look into.
  return [500, "that couldn't be saved just now"];
}

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
 * **TEN WORDS, AND EACH IS A DIFFERENT THING TO SAY TO SOMEBODY.** `skipped` is the one
 * that earns its place twice over: a condition that did not match is not a failure, and
 * showing it as one would tell a customer their automation is broken when it did exactly
 * what they asked.
 *
 * ⚠ **THE LAST THREE ARE NEW AND EACH REPLACES A `failed` OR A `queued` THAT WAS A LIE —
 * measured through this reader before any of them was written**, with the two that matter
 * most being the same corrections M9 made for the CONVERSATION reader and never made here:
 *
 *   - `cancelled` — a person asked for it to stop. It read **`failed` with no error at
 *     all**, which tells them their own decision was a fault and then says nothing about
 *     what happened. It is also the one non-answered stop a screen must not offer to retry.
 *   - `unresolved` — a send went out and the answer never came back. It read `failed`,
 *     which says *the work did not happen* about work that may well have; the two invite
 *     opposite next moves, and calling it a failure is what invites repeating it. The
 *     brief's own words: *an uncertain send must not appear successful or be blindly
 *     repeated.*
 *   - `running` — told from `queued` by how far it got, exactly as the conversation reader
 *     tells them apart by the step. Both were `queued`, so "about to start" and "half way
 *     through" were one word.
 */
export const AUTOMATION_STATES = Object.freeze([
  "queued", "running", "done", "skipped", "failed", "missed", "paused", "waiting",
  "rejected", "cancelled", "unresolved",
]);

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
  /**
   * ⚠ **AN UNRESOLVED SEND IS READ OFF THE STEP'S OWN OUTCOME, never off the stop.** The
   * step answers `{failed, unresolved: true, prepared}` when a write went out and no answer
   * came back, and the stop above it only ever says the workflow failed — so the stop
   * cannot tell "it did not happen" from "nobody knows", and the outcome can.
   */
  const outcomes = Array.isArray(r?.outcomes) ? r.outcomes : [];
  const uncertain = outcomes.some((o) => o && typeof o === "object" && o.unresolved === true);
  /**
   * **THE ORDER IS THE MEANING, in both halves.**
   *
   * Not stopped: somebody who CAN answer is the thing to do whatever else is true, so
   * `waiting` outranks the rest; then how far it got tells `running` from `queued` — the
   * same distinction `runView` makes by the step, and `position` is this table's own copy
   * of it.
   *
   * Stopped: a CANCELLATION is a person's own decision and is the primary fact about the
   * run, so it outranks an unresolved send — a run cancelled after a send that never
   * answered is cancelled, and the send's own outcome is still on the row for anybody
   * reading it. Only then does an unresolved send beat the stop's plain `failed`.
   */
  const step = Number.isInteger(r?.position) ? r.position : 0;
  const state = r?.run_status !== "stopped"
    ? (waiting ? "waiting" : (step > 0 ? "running" : "queued"))
    : reason === "cancelled" ? "cancelled"
    : uncertain ? "unresolved"
    : AUTOMATION_STATES.includes(reason) && reason !== "queued" && reason !== "waiting"
      && reason !== "running" && reason !== "unresolved" ? reason : "failed";
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
    /**
     * ⚠ **A CANCELLATION SAYS WHO, THEIR OWN WORDS, AND HOW FAR IT GOT — and NEVER that
     * anything was undone.** The counts are the only honest thing to say about it (the
     * brief: *don't claim completed effects were undone*), and they come from
     * `agent.cancel_run`'s own entry rather than being composed here — read through
     * `cancelledFacts`, which is the ONE reader of that entry's shape, because writing a
     * second one is how all four of these came back `null` for a real cancellation.
     *
     * ABSENT IS `null` AND NEVER `0`: "none completed" and "nobody recorded how far it got"
     * are different things to show, which is where this reader parts company with the
     * conversation's — the names are shared, the absent values are each reader's own.
     */
    cancelledBy: state === "cancelled" ? cancelledFacts(stop).by : null,
    cancelledWhy: state === "cancelled" ? cancelledFacts(stop).note : null,
    completedSteps: state === "cancelled" ? cancelledFacts(stop).steps : null,
    completedCalls: state === "cancelled" ? cancelledFacts(stop).calls : null,
    /**
     * ⚠ **WHAT IS UNCERTAIN, BY STEP, so a screen can say WHICH send nobody can account
     * for** — and only on `unresolved`, because on any other state there is nothing
     * uncertain and a list beside it would invite drawing one.
     */
    unresolved: state === "unresolved"
      ? outcomes.filter((o) => o?.unresolved === true).map((o) => (typeof o?.id === "string" ? o.id : "")).filter(Boolean)
      : [],
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
      // ⚠ **A FIXED SET RATHER THAN A FALL-THROUGH, so an event pause is not drawn as a timed
      // wait with no deadline.** The old shape read "approval or else wait", which was right
      // while those were the only two and would have shown "waiting until —" for an event.
      kind: waiting.kind === "approval" ? "approval" : (waiting.kind === "event" ? "event" : "wait"),
      // WHICH EVENT, for an event pause only. A screen that cannot say what is being waited for
      // is a screen that says a run is stuck.
      event: typeof waiting.name === "string" && waiting.kind === "event" ? waiting.name : null,
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
  // ⚠ A READ THAT WRITES NOTHING, and a POST because a whole workflow does not fit in a
  // query string. `AGENT_ROUTES`' verb is about the SHAPE of the request, not about whether
  // it changes anything — this one changes nothing at all, which the handler says out loud.
  "/api/agent/automation-check": "POST",
  // ── inbound endpoints ─────────────────────────────────────────────────────
  // ⚠ NO `webhook-rotate`, DELIBERATELY. A rotate has to hand back the new secret, which
  // is a SECOND door that gives one out — and the whole design is that there is exactly
  // one. Delete and make another does the same job through the door that already exists.
  // ── connected accounts ────────────────────────────────────────────────────
  // ⚠ NO `connection-refresh` AND NO `connection-lease`, DELIBERATELY. A refresh needs a NEW
  // credential, which for a real provider arrives from the provider and never from a browser;
  // and a lease hands one OUT, which is the engine's business and has exactly one door in the
  // whole schema. Adding either here would be a second place a credential can move.
  "/api/agent/connections": "GET",
  "/api/agent/connection-connect": "POST",
  "/api/agent/connection-disconnect": "POST",
  "/api/agent/connection-revoke": "POST",
  "/api/agent/webhooks": "GET",
  "/api/agent/webhook-create": "POST",
  "/api/agent/webhook-enable": "POST",
  "/api/agent/webhook-delete": "POST",
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
 * **IT FAILS CLOSED ON THE ARGUMENTS**, which is the field the whole decision is about.
 * Approving what you were not shown is the one mistake here that cannot be taken back.
 *
 * ⚠ **AND `{}` USED TO MEAN TWO OPPOSITE THINGS, which is the defect this shape closes.**
 * A row whose `args` could not be read answered `{}` — the same value a call that really
 * takes no arguments answers — and the screen drew that as *"with nothing filled in"*, a
 * POSITIVE claim about a value it had failed to read. So `null` is *we could not read them*
 * and `{}` is *there are none*, which are three screens rather than two: the list, the
 * sentence, and a row that must not offer Approve at all.
 *
 * ⚠ **AND `expiresAt` WAS DROPPED HERE, one hop below the function that answers it.**
 * `agent.pending_approvals` has carried the window since the approval-controls round and
 * this reader did not name it, so **a decision's deadline never reached the person making
 * it**: the request simply vanished from the banner when it closed, with nothing having
 * said it would. *A value computed and never forwarded*, in the field that decides whether
 * somebody knows they have to answer today.
 */
export function toolApprovalRow(r) {
  const readable = r?.args && typeof r.args === "object" && !Array.isArray(r.args);
  return {
    id: typeof r?.id === "string" ? r.id : "",
    run: typeof r?.run === "string" ? r.run : "",
    agent: typeof r?.agent === "string" ? r.agent : null,
    tool: typeof r?.tool === "string" ? r.tool : "",
    args: readable ? r.args : null,
    step: Number.isInteger(r?.step) ? r.step : 0,
    index: Number.isInteger(r?.index) ? r.index : 0,
    requestedAt: typeof r?.requestedAt === "string" ? r.requestedAt : null,
    expiresAt: typeof r?.expiresAt === "string" ? r.expiresAt : null,
  };
}

/**
 * ⚠ WHY A TOOL-CALL DECISION WAS NOT RECORDED — one sentence per reason the function gives.
 *
 * **NOT FOUND, NEVER FORBIDDEN, AND ONLY FOR THE ONE CODE THAT MEANS IT.**
 * `agent.decide_tool_approval` puts the tenant in its own locked lookup, so another
 * account's request and one that does not exist are BOTH `no-request` and both answer 404.
 * Every other code below is only ever about a request THIS account owns, so naming it leaks
 * nothing — and naming it is the whole point, because *"that request isn't waiting any
 * more"* is false of an expired one (it is still there; the window closed) and false of a
 * revoked one (the permission went, not the request).
 *
 * **EACH CARRIES ITS OWN FLAG BESIDE THE SENTENCE**, so the screen offers the one thing that
 * helps rather than parsing our prose for it — the idiom the paused agent and the disabled
 * automation already use. **AND A 409 RATHER THAN A 404**: the request was well formed, the
 * thing exists and is theirs, and nothing is broken.
 *
 * **A CODE THIS DOES NOT KNOW IS A 502 AND NEVER A 400.** `bad-verdict` and `no-decider` are
 * refusals of things this route decides for itself — the verdict is checked against
 * `TOOL_VERDICTS` and the decider is the verified session — so one arriving is our own fault,
 * and blaming the caller for it would send them to fix something they did not send.
 */
function sayVerdict(d) {
  const why = typeof d?.error === "string" ? d.error : "";
  if (why === "no-request") return no(404, "that request isn't waiting any more");
  if (why === "expired") {
    return no(409, "nobody answered that in time, so it can't be approved now — ask the agent for it again", {
      expired: true, expiresAt: typeof d?.expiresAt === "string" ? d.expiresAt : null,
    });
  }
  if (why === "revoked-permission") {
    return no(409, "this agent's permission for that was taken away, so the call can't be approved", {
      revoked: true, tool: typeof d?.tool === "string" ? d.tool : null,
    });
  }
  return no(502, "couldn't record that just now — nothing was decided, try again", { retry: true });
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
 * The agent's time zone off a request body, or a named refusal.
 *
 * ⚠ **THE THIRD READER IN THIS SHAPE, and it exists because a SCHEDULE HAS TO BE LOCAL TO
 * SOMEWHERE.** An agent's authoring tools can set a daily schedule, and the one thing they
 * must not choose is the zone — "every day at nine" somewhere nobody lives is worse than no
 * schedule at all. So the zone is a setting a PERSON owns, this is the door they set it
 * through, and the tool reads it and refuses where there is none. **Reproduced before this
 * existed**: with nowhere to get a zone from, every daily automation authored through a tool
 * threw a PL/pgSQL exception out of the store.
 *
 * ⚠ **ASKED OF `Intl`, NEVER OF A LIST**, which is the rule the automation routes already
 * follow: a hand-kept list of zone names is a second copy of the tz database and the copy
 * that drifts is ours. `validTimeZone` is that one reader.
 *
 * **AND `null` IS A REAL VALUE HERE, distinct from silence.** Absent leaves the stored zone
 * alone (the same patch semantics `readStatus` and `readTools` have, for the same reason —
 * an older tab saves a name and says nothing about a setting); an explicit `null` clears it,
 * which somebody has to be able to do without deleting the agent.
 */
function readZone(b) {
  if (!Object.hasOwn(b, "zone") || b.zone === undefined) return { zone: undefined };
  if (b.zone === null || b.zone === "") return { zone: null };
  if (typeof b.zone !== "string") return { refusal: no(400, "the time zone has to arrive as a name") };
  const named = b.zone.trim();
  if (!validTimeZone(named)) {
    return { refusal: no(400, `"${named}" is not a time zone this platform knows — use a name like Europe/London`) };
  }
  return { zone: named };
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
export async function handleAgentApi({ path, method, query, body, tenant, store, ring, newId, now, log, random } = {}) {
  if (!Object.hasOwn(AGENT_ROUTES, path)) return null;
  if (AGENT_ROUTES[path] !== method) return no(405, "wrong method for that");

  const who = readTenant(tenant);
  // A TENANT WE CANNOT READ IS A REFUSAL, NEVER AN UNFILTERED QUERY. There is
  // no sensible fallback: every statement below is scoped by this value, so
  // proceeding without it would mean proceeding across accounts.
  if (!who) return no(401, "sign in required");

  const mint = typeof newId === "function" ? newId : () => crypto.randomUUID();
  // THE PLATFORM'S OWN RANDOMNESS, injected so the one value that must be unguessable is
  // drivable — and the default is the real source rather than a weaker one, exactly as
  // `mint` above defaults to `crypto.randomUUID`.
  const dice = typeof random === "function" ? random : (n) => crypto.getRandomValues(new Uint8Array(n));
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
      // ⚠ AND THE ZONE, for the same reason the status is here: the settings form draws the
      // field for a NEW agent, so a route that dropped it would make that box a control
      // somebody sets and nothing reads.
      const zoned = readZone(b);
      if (zoned.refusal) return zoned.refusal;
      if ((await store.count(who)) >= MAX_AGENTS) {
        return no(409, `that's as many agents as one account can hold (${MAX_AGENTS}) — delete one first`);
      }
      return ok({
        agent: await store.create(who, {
          id: mint(), name, instructions, status: rest.status, tools: picked.names, zone: zoned.zone,
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
      const zoned = readZone(b);
      if (zoned.refusal) return zoned.refusal;
      const agent = await store.update(who, id,
        { name, instructions, status, tools: picked.names, zone: zoned.zone });
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
        // ⚠ **THE WORKED EXAMPLE RIDES ON THE SAME ANSWER, for the catalog's own reason**:
        // the form is only reachable from this screen, so an example arriving separately
        // would be a second thing to fail and a second state to draw. A browser that gets
        // no `example` key — an older Worker — simply offers no example, which is what it
        // did before this shipped.
        example: EXAMPLE_AUTOMATION,
      });
    }

    if (path === "/api/agent/automation-create" || path === "/api/agent/automation-update") {
      const editing = path.endsWith("update");

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

      /**
       * ⚠ **AN EDIT CHANGES ONLY WHAT IT NAMES, AND THIS WAS A WHOLE-ROW REPLACE.**
       *
       * Everything below the create's own readers answers the question a create asks — what
       * should this automation BE — and an edit asks a different one: what did somebody
       * CHANGE. Read the edit through those readers and every field the caller said nothing
       * about arrives as a default (`cleanSchedule({})` is `manual`), which is why a form with
       * no control for a field had to send that field from a row it had cached, and why doing
       * so overwrote whatever anybody else had changed since.
       *
       * So the two branches are two branches. `cleanPatch` reads only what the body names and
       * `agent.patch_automation` resolves the rest from the LOCKED row, which is the only place
       * "what it is now" can be read without a window between reading it and writing.
       */
      if (editing) {
        const id = cleanId(b.id);
        if (!id) return no(400, "which automation?");

        /**
         * ⚠ **THE STORED CONFIGURATION IS READ TO VALIDATE AGAINST AND IS NEVER WRITTEN BACK.**
         * A `{{reference}}` needs something that produces it, and a declared input is half of
         * what can — so **the steps and the declarations are one combination**, and an edit that
         * names either half has to be checked against the other half as it really stands. What is
         * PRESERVED is still the transaction's own resolution from the locked row; this read
         * decides a refusal and never a value, so it can never cost somebody their steps or their
         * inputs.
         *
         * ⚠ **AND WHAT A STALE READ COSTS IS NO LONGER "a validation decided a moment stale",
         * which is what this paragraph used to say and is what the fence below closes.** Between
         * this read and the write another browser can change the half that was read, and then the
         * combination written is not the combination checked. `cleanPatch` answers the version of
         * the surface it validated and the patch fences on it, so the write happens against the
         * configuration the verdict was about or not at all.
         *
         * **AND IT IS NOT THE OWNERSHIP CHECK.** It is tenant-scoped, so a stranger gets the
         * missing-automation 404 here as well — but the wall is the patch's own locked lookup,
         * which has no window between deciding and writing.
         */
        let stored = null;
        if (patchNeedsStored(b)) {
          const one = await store.readAutomation(who, id);
          if (!one) return NO_AUTOMATION();
          stored = one;
        }

        const asked = cleanPatch(b, stored);
        if (asked.error) return no(400, asked.error);
        /**
         * **AN EDIT THAT NAMES NOTHING IS REFUSED RATHER THAN WRITTEN.** Sending `{}` would
         * resolve every field from the row and write them all back — a no-op that still moves
         * `updated_at` and still takes the lock. The screen never sends one (it skips the
         * request when nothing changed), so this is a wall for a caller rather than a path, and
         * it is the answer the agent's own `change_automation` gives for the same body.
         */
        if (!Object.keys(asked.patch).length) return no(400, "say which fields to change");

        // THE FENCE IS `cleanPatch`'s ANSWER, PASSED THROUGH — never a version this route read
        // for itself. One read decided the verdict and one number fences it, so the two cannot
        // be about different moments.
        const a = await store.patchAutomation(who,
          { id, patch: asked.patch, expectVersion: asked.expectVersion ?? null });
        { const r = callRefusal(a.error); if (r) return r; }
        if (a.error === "no-automation") return NO_AUTOMATION();
        if (a.ok !== true) {
          const said = sayPatch(a);
          // A REFUSAL THIS DOOR DID NOT ANTICIPATE IS OURS, not the caller's: a 400 naming
          // nothing they can act on would send somebody to look at their own request.
          return said ? no(400, said) : no(500, "couldn't save that change");
        }
        // ⚠ AN EDIT REACHES THE NEXT EXECUTION AND CAN NEVER REACH AN ACCEPTED ONE. What a
        // run executes was copied into its own record when it was accepted, so this statement
        // cannot change what is already running or already ran — which is the property
        // `steps` being a snapshot exists for.
        return ok({ id: a.id, nextRunAt: a.next_run_at ?? null });
      }

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
      // ⚠ **THE WHOLE DECLARATIONS, NEVER THEIR NAMES — and the difference is a TYPE.** This
      // line read `declared.inputs.map((i) => i.name)`, so every declaration arrived as a
      // bare string and `cleanWorkflow` read it as `text` (which is what a bare string
      // means, correctly). MEASURED: a `list` input plus a loop over it was refused here
      // *"step 1: \"lines\" is text, and the list to go through needs a list"* while the
      // engine's own reader accepted the same steps with the same declarations — so a
      // declared list was a kind of thing a person could save and never use, and a number
      // could never be used where a number is wanted.
      //
      // `cleanWorkflow` has read a declaration's `type` since types existed; nothing sent
      // it one. *A value computed and never forwarded*, in the one hop between the reader
      // that validates a declaration and the reader that validates a reference to it — and
      // invisible to the cross-product census, which drives both validators with real
      // declarations and cannot see the argument this route builds.
      const flow = cleanWorkflow(b.steps, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS,
        declared.inputs);
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
        // ⚠ **THIS SHAPE IS THE CREATE'S ALONE NOW, and the comment that said otherwise had
        // to go with the replace.** It read "the create and the edit cannot carry different
        // ones", which was the reason for one object while both branches sent a whole row; an
        // edit sends a PATCH, and what keeps the two doors in step is that both read the same
        // value readers (`trigAt`, `trigZone`, `trigDays`, `trigOnDate`, `trigOnEvent`) and
        // `AUTOMATION_PATCH_FIELDS` names every field an edit may carry.
        days: trigger.days, onDate: trigger.onDate, onEvent: trigger.onEvent,
        steps: flow.steps, inputs: declared.inputs,
      };

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

    if (path === "/api/agent/automation-enable") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which automation?");
      if (typeof b.enabled !== "boolean") return no(400, "say whether it should be on or off");
      const a = await store.setAutomationEnabled(who, id, b.enabled);
      // **TURNING IT OFF PREVENTS NEW EXECUTIONS AND NOTHING ELSE.** It is not a delete
      // and not a cancellation: work already accepted keeps its own recorded
      // configuration and finishes.
      /**
       * ⚠ **THE ANSWER IS THE FUNCTION'S, so a refusal it makes reaches a reader as itself.**
       * `no-automation` is the missing-automation 404 — an automation that is not this
       * account's and one that does not exist are the same answer, which is what stops a
       * stranger confirming that somebody else's id is real. Anything else is a refusal the
       * checks above did not anticipate, and it is a 500 rather than a 400 blaming the caller
       * for something nobody here can name.
       */
      if (a.ok !== true) {
        return a.error === "no-automation" ? NO_AUTOMATION()
          : no(500, "that couldn't be changed just now");
      }
      // ⚠ **`nextRunAt` TRAVELS BECAUSE THE FUNCTION RECOMPUTED IT.** Turning a scheduled
      // automation back on moves its next run to the next real occurrence, and a caller told
      // only `ok` would have to ask for the one fact that changed besides the flag.
      return ok({ id: a.id, enabled: a.enabled, nextRunAt: a.next_run_at ?? null });
    }

    /**
     * ⚠ **CHECK A WORKFLOW WITHOUT SAVING IT — the SAME answer a model's own `check_workflow`
     * gets, from the same readers.**
     *
     * It exists because every refusal these validators can make was reachable only by pressing
     * Save: a person with a twenty-step workflow found out what was wrong one refusal at a time,
     * and a dependency that is not about the steps at all — an account not connected, a
     * permission the provider withheld, a time zone nobody set — could only be discovered by
     * running the automation and reading the failure afterwards.
     *
     * **STRUCTURE REFUSES AND DEPENDENCIES ARE REPORTED**, which is the distinction this whole
     * answer is built around: `error` is something in the steps, `needs` is something about the
     * account that can be true tomorrow without the steps changing, and `unchecked` is a
     * question this could not put. A reader that folded the three would either tell somebody
     * their workflow is wrong when their account is not ready, or say "fine" about a check
     * nobody could make.
     *
     * ⚠ **IT WRITES NOTHING AND IS NOT AUTHORISATION.** There is no record of a check anywhere,
     * so nothing downstream can read "this was checked" — a save still reads every field again
     * and a run still checks ownership, permissions, approval and limits. Said on the answer as
     * well, because a screen that shows a green tick invites a reader to believe the next step
     * is permitted.
     */
    if (path === "/api/agent/automation-check") {
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();

      // THE SAME ORDER THE SAVE READS IN, and for the same reason: the steps are checked
      // AGAINST the declarations, so a reference to an input has to be resolvable on the one
      // check that introduces it.
      const trigger = cleanSchedule(b);
      if (trigger.error) return ok({ checked: true, error: trigger.error, needs: [], unchecked: [] });
      const declared = cleanInputs(b.inputs);
      if (declared.error) return ok({ checked: true, error: declared.error, needs: [], unchecked: [] });
      const flow = cleanWorkflow(b.steps, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, declared.inputs);
      if (flow.error) return ok({ checked: true, error: flow.error, needs: [], unchecked: [] });

      /**
       * ⚠ **A STRUCTURAL REFUSAL IS A 200 CARRYING `error`, NOT A 400.** The REQUEST was
       * well formed — somebody asked a question and got an answer — and answering 400 would
       * make "your workflow has a problem" indistinguishable from "this call was wrong", which
       * on this screen is the difference between a sentence to read and a bug to report.
       *
       * Every read is in its own `try`, because three dependencies behind one `catch` would let
       * one outage silence the other two — and a question that could not be put is `unchecked`
       * rather than satisfied.
       */
      const wantsConnection = flow.steps.some((st) => st.type === "send");
      const wantsSub = flow.steps.some((st) => st.type === "workflow");
      let connections = null;
      let automations = null;
      let zone = null;
      const extra = [];
      if (wantsConnection) {
        try { connections = await store.listConnections(who, agentId); }
        catch { connections = null; }
      }
      if (wantsSub) {
        try { automations = await store.listAutomations(who, agentId); }
        catch { automations = null; }
      }
      if (SCHEDULE_NEEDS_ZONE.includes(trigger.schedule)) {
        try {
          const mine = await store.list(who);
          const row = mine.find((a) => a.id === agentId) ?? null;
          /**
           * AN AGENT THAT IS NOT IN ITS OWNER'S OWN LIST IS NOT A ZONE ANSWER. `ownsAgent` has
           * already passed, so this is a list that came back short rather than a stranger — and
           * reading it as "no zone" would name a dependency nobody has.
           *
           * ⚠ **MEASURED INERT TODAY, AND KEPT AS A DECLARED SECOND WALL.** With the guard
           * gone, `row.zone` on a missing row throws a TypeError straight into the `catch`
           * below, which answers the same `unchecked` — so the two cannot be told apart from
           * outside and no single mutant kills either. It stays because the guard says the
           * intent, where the catch only happens to be right: the day `find` answers `{}`
           * instead of nothing, or the read moves, a throw stops arriving and the catch's luck
           * runs out. The sweep mutates the PAIR (the guard plus the catch's own answer),
           * which IS observable and dies.
           */
          if (row) zone = { needed: true, have: !!(row.zone && String(row.zone).trim()), schedule: trigger.schedule };
        } catch { zone = null; }
        if (zone === null) {
          extra.push({ kind: "zone", what: trigger.schedule,
            why: "this agent's own settings could not be read, so whether it has a time zone is unknown" });
        }
      }
      const around = workflowNeeds(flow.steps, {
        connections, automations, zone, sendScopes: sendScopesByProvider(),
      });
      return ok({
        checked: true, error: null, steps: flow.steps.length, produces: flow.produces,
        inputs: declared.inputs.map((i) => i.name),
        trigger: {
          schedule: trigger.schedule, at: trigger.at, days: trigger.days,
          onDate: trigger.onDate, onEvent: trigger.onEvent,
        },
        needs: around.needs, unchecked: [...around.unchecked, ...extra],
      });
    }

    // ── CONNECTED ACCOUNTS ────────────────────────────────────────────────────
    if (path === "/api/agent/connections") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      /**
       * ⚠ **THE CATALOG RIDES ON THE ANSWER, so a screen does not hold a second copy of what
       * may be connected or what each permission means.** It is the same reason `AGENT_TOOLS`
       * rides on the agent list: a browser drawing a control from its own list is a browser
       * that can offer something the server refuses.
       */
      return ok({
        connections: await store.listConnections(who, agentId),
        providers: AGENT_PROVIDERS, max: MAX_CONNECTIONS,
      });
    }

    // ── AN INBOUND ENDPOINT ───────────────────────────────────────────────────
    if (path === "/api/agent/webhooks") {
      const agentId = cleanId(q.get("agent"));
      if (!agentId) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, agentId))) return NO_AGENT();
      // THE PATH RIDES ON EVERY ROW, because an endpoint whose address nobody can read is
      // one nobody can configure — and it is a PATH, since this product does not hold the
      // engine's origin and inventing one prints a URL that does not work.
      return ok({ webhooks: await store.listWebhooks(who, agentId), max: MAX_WEBHOOKS });
    }

    if (path === "/api/agent/connection-connect") {
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      /**
       * ⚠ **THE PROVIDER IS LOOKED UP IN A LIST THIS CODE HOLDS, and a name not on it is
       * refused BY NAME.** The name on the row is what the engine looks an ADAPTER up by, so
       * admitting one we have no adapter for makes a connection that saves, lists, and fails
       * at every send — a control that answers, wrongly.
       */
      const provider = providerByName(typeof b.provider === "string" ? b.provider.trim().toLowerCase() : "");
      if (!provider) {
        return no(400, `this platform can only connect: ${AGENT_PROVIDERS.map((x) => x.name).join(", ")}`);
      }
      const account = cleanText(b.account, CONNECTION_ACCOUNT_MAX);
      if (!account) return no(400, "say which account this is — the address or handle it sends as");
      // A PERSON'S OWN LABEL IS OPTIONAL and falls back to the account, because a list of
      // rows all called the same thing is a list nobody can choose from.
      const label = cleanText(b.label, CONNECTION_LABEL_MAX) || account;
      /**
       * ⚠ **THE PERMISSIONS ARE THE PERSON'S OWN CHOICE, from a server-side catalog.**
       * *Connecting accounts and granting permissions remain user-only actions* — so they
       * arrive on the request, and what bounds them is `cleanScopes`, which refuses a name
       * this platform does not offer rather than dropping it.
       */
      const grant = cleanScopes(b.scopes, provider);
      if (grant.error) return no(400, grant.error);
      /**
       * ⚠ **THE CREDENTIAL IS MINTED HERE AND IS NEVER ANSWERED, NEVER LOGGED, AND NEVER
       * READ BACK.** For a fake provider there is nothing for a person to paste in and
       * nothing for them to keep, so the strongest available rule is the simplest one: no
       * route reads a credential off a request and no answer carries one. A real provider's
       * would arrive from the provider through its own flow, not through this door.
       */
      const secret = mintWebhookSecret(dice);
      const id = mint();
      const a = await store.connectProvider(who, {
        agentId, id, provider: provider.name, label, account, scopes: grant.scopes, secret,
      });
      if (a?.error === "no-agent") return NO_AGENT();
      if (a?.error === "too-many") {
        return no(409, `that's as many connected accounts as one agent can hold (${MAX_CONNECTIONS}) — disconnect one first`);
      }
      if (a?.ok !== true) return NO_AGENT();
      /**
       * ⚠ **THE ANSWER CARRIES NO CREDENTIAL AND SAYS WHAT IT IS.** A `repeat` is the same
       * press twice — the function absorbs it — and it is said rather than dressed up as a
       * new connection, because a person pressing Connect twice should not end up wondering
       * which of two rows is live.
       */
      return ok({
        id: typeof a.id === "string" ? a.id : id,
        provider: provider.name, providerLabel: provider.label, simulated: provider.simulated === true,
        label, account, scopes: grant.scopes,
        repeat: a.repeat === true,
        note: provider.simulated === true
          ? "this is a simulated account — nothing it sends leaves the platform, and a person still approves every message"
          : null,
      });
    }

    if (path === "/api/agent/connection-disconnect") {
      const id = cleanId(b.id);
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      if (!id) return no(400, "which connected account?");
      const a = await store.disconnectConnection(who, { agentId, id, why: cleanText(b.reason, TOOL_NOTE_MAX) || null });
      if (a?.ok !== true) return no(404, "that connected account isn't here any more");
      /**
       * ⚠ **IT SAYS THE CREDENTIAL IS GONE, because that is what makes this different from a
       * toggle.** Somebody who reads "disconnected" and expects a switch back is somebody who
       * will be surprised; the sentence is the whole of what stops that.
       */
      return ok({
        id, status: "disconnected", repeat: a.repeat === true,
        note: "the credential for that account has been destroyed — connecting it again makes a new one",
      });
    }

    if (path === "/api/agent/connection-revoke") {
      const id = cleanId(b.id);
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      if (!id) return no(400, "which connected account?");
      const a = await store.revokeConnection(who, { agentId, id, why: cleanText(b.reason, TOOL_NOTE_MAX) || null });
      if (a?.ok !== true) return no(404, "that connected account isn't here any more");
      return ok({
        id, status: "revoked", repeat: a.repeat === true,
        note: CONNECTION_TROUBLE.revoked,
      });
    }

    if (path === "/api/agent/webhook-create") {
      const agentId = cleanId(b.agent);
      if (!agentId) return no(400, "which agent?");
      const name = cleanText(b.name, WEBHOOK_NAME_MAX);
      if (!name) return no(400, "give it a name first");
      /**
       * ⚠ **THE EVENT NAME IS CHECKED AGAINST THE SAME SHAPE THE TRIGGER USES.** An endpoint
       * emitting a name no automation can listen for is a dead control that ANSWERS: it takes
       * deliveries, records events, and nothing ever runs. One regex, so the two doors cannot
       * disagree about what an event may be called.
       */
      const event = typeof b.event === "string" ? b.event.trim().toLowerCase() : "";
      if (!AGENT_EVENT_RE.test(event)) {
        return no(400, "an event name is lower case letters, digits, dots, dashes or underscores, starting with a letter");
      }
      // ⚠ NOTHING READS A SECRET OFF THE REQUEST, and there is nowhere to put one. A
      // caller-chosen signing key is a browser deciding how strong it is.
      const secret = mintWebhookSecret(dice);
      const id = mint();
      const a = await store.createWebhook(who, { agentId, id, name, event, secret });
      if (a?.error === "no-agent") return NO_AGENT();
      if (a?.error === "too-many") {
        return no(409, `that's as many endpoints as one agent can hold (${MAX_WEBHOOKS}) — delete one first`);
      }
      if (a?.ok !== true) return NO_AGENT();
      /**
       * ⚠ **THE ONE AND ONLY TIME THE SECRET IS ANSWERED, and the sentence says so.** Nothing
       * can read it back: `agent.list_webhooks` does not select the column and no route asks
       * for it. Somebody who loses it deletes the endpoint and makes another.
       */
      return ok({
        id, name, event, path: webhookPath(id), secret,
        note: "this is the only time you'll see that secret — copy it into whatever will be sending, and if it's lost, delete this endpoint and make another",
      });
    }

    if (path === "/api/agent/webhook-enable") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which endpoint?");
      // REFUSED RATHER THAN COERCED: `Boolean("false")` is `true`, so a string out of a form
      // would turn "off" into "on" — the one direction that keeps accepting deliveries for an
      // endpoint somebody meant to close.
      if (typeof b.enabled !== "boolean") return no(400, "an endpoint is either on or off");
      const a = await store.setWebhookEnabled(who, id, b.enabled);
      if (a?.ok !== true) return no(404, "that endpoint isn't here any more");
      return ok({ id, enabled: a.enabled === true });
    }

    if (path === "/api/agent/webhook-delete") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which endpoint?");
      const a = await store.removeWebhook(who, id);
      if (a?.ok !== true) return no(404, "that endpoint isn't here any more");
      return ok({ id });
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
      /**
       * ⚠ **THE CEILING IS THE FUNCTION'S NOW, and the count that used to be here is GONE
       * rather than kept as a belt.** It read the whole list and then inserted — two
       * statements, so two saves landing together both read one short of the cap and both
       * insert. `agent.save_memory` counts inside the transaction that writes, which is the
       * only place the question can be asked safely, and it is the same wall the agent's own
       * `remember` meets. Keeping a copy here would be the drift this change removes, one
       * release later.
       *
       * **WHAT STAYS ABOVE IS THE WORDS.** The checks on the name and the value are a person's
       * SENTENCES — `save_memory` answers `bad-name` and `too-long`, which is right for a
       * caller and useless on a screen — so they are a composer rather than a wall, and the
       * mapping below catches anything they did not anticipate instead of letting it read as a
       * missing agent.
       */
      const saved = await store.saveMemory(who, { agentId, id: mint(), key, value });
      if (saved.ok !== true) return no(...sayMemory(saved.error, saved));
      return ok({ memory: memoryFromAnswer(saved.memory), saved: saved.saved });
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
      // ⚠ **THREE REFUSALS, AND THIS COLLAPSED THEM INTO ONE 404 SAYING THE WRONG THING
      // ABOUT TWO OF THEM.** `agent.decide_tool_approval` answers `no-request`, `expired`
      // and `revoked-permission`, and each needs something different done about it — ask the
      // agent again, or restore the permission it lost. *A failure that cannot name itself*,
      // in the door a person presses on the money path.
      if (d?.ok !== true) return sayVerdict(d);
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
      const gone = await store.removeMemory(who, agentId, key);
      if (gone.ok !== true) return no(...sayMemory(gone.error, gone));
      if (gone.forgot !== true) return NO_MEMORY();
      /**
       * ⚠ **WHAT FORGETTING REACHES IS FORWARDED, NEVER COMPOSED HERE — and it used to be
       * composed here.** `deleted` is not `erased`: the row is gone so no LATER run will see
       * it, and two things are deliberately untouched — an execution already ACCEPTED keeps
       * the snapshot it was accepted with (the rule the instructions and the step list follow;
       * reaching into it would mean a correction changing what a run in flight is doing), and
       * the JOURNAL keeps whatever was quoted, because an entry is append-only by trigger and
       * a history that forgetting could edit is a history nobody can audit.
       *
       * **THE FIELDS AND THE SENTENCE ARE `agent.delete_memory`'S OWN**, which is the same
       * function the agent's `forget` tool calls — so a note about what a delete does cannot
       * drift from what a delete does. Written out here, it was two copies of one sentence in
       * two languages, and the one that drifts is the one a person reads.
       *
       * ⚠ **AND A REACH THE FUNCTION DID NOT ANSWER IS AN ABSENCE RATHER THAN AN INVENTED
       * SET.** An older deployment answers no `affects` at all; `Array.isArray`-style
       * guessing would put a claim about three relations into a reply nothing supports.
       */
      const affects = gone.affects && typeof gone.affects === "object" && !Array.isArray(gone.affects)
        ? gone.affects : null;
      return ok({
        agent: agentId, key, affects,
        note: typeof gone.note === "string" && gone.note ? gone.note : null,
      });
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
