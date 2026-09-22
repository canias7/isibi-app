/**
 * DELEGATION — a parent hands bounded tasks to specialist agents of the SAME account.
 *
 * DEPENDENCY-FREE AND PURE. No clock, no fetch, no storage: `now` is a parameter and the
 * stores are injected by the caller. That is what lets every branch below be driven in a
 * test rather than waited on, and it is the same shape `limits.mjs` and `fanout.mjs` take.
 *
 * ⚠ **WHAT THIS MODULE IS NOT.** It does not execute a child and it does not talk to a
 * model. Running a child is the QUEUE's job — `accept_run` files it and an ordinary
 * consumer claims it — and that is the whole reason a parent never holds an open request.
 * This module decides: who may be asked, what they are told, what they are allowed to do,
 * what a set of answers adds up to, and when a wait is over.
 *
 * ── THE FOUR LAWS, and each one is a recorded trap in this repository ────────────────
 *
 *   1. **MISSING WORK IS NEVER SUCCESS.** A child that never settled is `unresolved`, and
 *      no policy — not even `best_effort` — counts it as done. This is the one rule the
 *      whole module exists to keep: a parent that read silence as agreement would report a
 *      task complete on the strength of work nobody did.
 *
 *   2. **A GRANT CAN ONLY EVER REDUCE.** A child's tools are a positive intersection of
 *      what the specialist itself declares and what this delegation was granted, minus
 *      anything revoked. There is no branch that adds a name, which is what makes
 *      "delegation cannot bypass approvals or revocations" a property rather than a promise.
 *
 *   3. **CONTEXT IS PASSED BY NAME, NEVER BY DEFAULT.** The default is NOTHING. A parent
 *      says what each specialist gets; secrets are not passable at all, by any name.
 *
 *   4. **CANNOT-TELL IS ITS OWN ANSWER.** An outcome that cannot be read is `unreadable`,
 *      never `failed` and never `done` — the first would blame a specialist for our own
 *      reading and the second is law 1 through the back door.
 */

// ── what a delegated child can be, from the parent's side ────────────────────────────
//
// ⚠ **FIVE, AND COLLAPSING ANY TWO MISLEADS IN A DIFFERENT DIRECTION** — the same
// reasoning `SEARCH_OUTCOMES` and `RUN_STATES` already follow one module over:
//
//   * `queued`     — filed, nobody has claimed it. Real work, not yet started.
//   * `running`    — a consumer holds it.
//   * `done`       — it answered, and the answer was readable.
//   * `failed`     — it ran and did not produce an answer. A fact about the work.
//   * `cancelled`  — somebody stopped it. NOT a fault, and never offered for retry.
//   * `unresolved` — nothing will move it and it never answered: a deadline passed, or the
//                    claim was lost. **The state law 1 is about.**
//   * `unreadable` — it settled and the outcome will not parse. Our fault, not theirs.
export const CHILD_STATES = Object.freeze([
  "queued", "running", "done", "failed", "cancelled", "unresolved", "unreadable",
]);

/** The states in which a child is still expected to move on its own. */
export const CHILD_LIVE = Object.freeze(["queued", "running"]);

/**
 * The states that are SETTLED — nothing further will happen to them.
 *
 * DERIVED rather than listed, so a state added above is classified below without anybody
 * remembering to. Two lists of one thing is this repository's most repeated drift.
 */
export const CHILD_SETTLED = Object.freeze(CHILD_STATES.filter((s) => !CHILD_LIVE.includes(s)));

/** The one settled state that counts as work delivered. Exactly one, deliberately. */
export const CHILD_DELIVERED = "done";

// ── the policy for partial failure ───────────────────────────────────────────────────
//
// ⚠ **EXPLICIT, AND THERE IS NO DEFAULT THAT MEANS "WHATEVER HAPPENED IS FINE".** The
// brief asks for an explicit policy, and the reason it has to be explicit is that the
// three answers below are three different things to do about the same set of results.
export const WAIT_POLICIES = Object.freeze({
  // Every child must deliver. One failure fails the step, and the step SAYS which.
  all: {
    label: "every specialist must finish",
    does: "If any specialist fails, is cancelled or never answers, the step fails and names which.",
  },
  // One is enough. The failures are still reported — `any` is about what the step DOES,
  // never about hiding what happened.
  any: {
    label: "one finished specialist is enough",
    does: "The step goes on as soon as one specialist has delivered. Any failures are still reported.",
  },
  // Proceed with what came back. **The count of what did not is on the result**, so this
  // is "carry on knowingly" rather than "pretend they all worked".
  best_effort: {
    label: "carry on with whoever finished",
    does: "The step goes on with whatever came back, and reports exactly how many did not.",
  },
});

/** The policy names, DERIVED from the table above. */
export const POLICY_NAMES = Object.freeze(Object.keys(WAIT_POLICIES));

// ── the bounds on a task tree ────────────────────────────────────────────────────────
//
// Conservative on purpose, the same rule `LIMIT_DEFAULTS` states: a framework's default
// must be the one that cannot surprise somebody with a bill.
export const DELEGATION_DEFAULTS = Object.freeze({
  children: 8,        // how many children ONE delegating step may ask for
  concurrency: 4,     // how many of them may be in flight at once
  depth: 2,           // how deep the tree may go. 0 means "may not delegate at all"
  treeChildren: 32,   // how many children the WHOLE tree may create, across every level
  budgetMicros: 2_000_000, // the tree's shared money budget, millionths of a unit
  waitMs: 900_000,    // how long a parent waits before its children read `unresolved`
});

/** The bound names, DERIVED. */
export const DELEGATION_LIMIT_NAMES = Object.freeze(Object.keys(DELEGATION_DEFAULTS));

/**
 * A number a delegation bound may take.
 *
 * ⚠ REFUSES RATHER THAN COERCES, and `Infinity` is a STATED ANSWER — both are recorded
 * laws in `limits.mjs` and this is the same class of reader. `String(["8"])` is `"8"`, so a
 * coercing reader accepts an array as a bound; and `Number.isFinite(Infinity)` is false,
 * so the obvious guard reads a deliberate "no ceiling" as unusable and substitutes a
 * default, for the one input where a default is the most wrong answer available.
 */
export function okBound(v) {
  if (typeof v !== "number") return false;
  return v === Infinity || (Number.isFinite(v) && v >= 0);
}

/**
 * The effective bounds: the defaults, with any readable override applied.
 *
 * An UNREADABLE override is DROPPED AND NAMED rather than silently taken or silently
 * ignored — a filter is a silent drop and a check is a sentence, which is the rule
 * `narrowTools`' own `unknown` follows.
 */
export function delegationBounds(given = {}) {
  const bounds = { ...DELEGATION_DEFAULTS };
  const refused = [];
  if (given && typeof given === "object" && !Array.isArray(given)) {
    for (const name of DELEGATION_LIMIT_NAMES) {
      if (!Object.hasOwn(given, name)) continue;
      const v = given[name];
      if (okBound(v)) bounds[name] = v;
      else refused.push(name);
    }
  }
  return Object.freeze({ bounds: Object.freeze(bounds), refused: Object.freeze(refused) });
}

// ── what a specialist is told ────────────────────────────────────────────────────────
//
// ⚠ **THE DEFAULT IS NOTHING, AND THAT IS THE FEATURE.** "Do not automatically copy every
// conversation, memory or secret to every specialist" is not a warning to be careful — it
// is this function having no branch that copies anything the parent did not name.
//
// **A POSITIVE LIST OF KINDS IS THE WALL.** A deny-list of things not to pass is a claim
// about the producer; an allow-list is a fact about the input, which is the rule this
// repository already states about caller-supplied keys. So a kind that is not below cannot
// travel, whatever it is called and whoever asks.
export const CONTEXT_KINDS = Object.freeze(["note", "memory", "reference"]);

/**
 * Kinds that exist in the product and may NEVER be delegated, named so the refusal can say
 * why rather than answering "unknown kind" about something the customer can see on screen.
 *
 * A secret is the obvious one. A CONNECTION is the less obvious one and is the reason this
 * list is not just `["secret"]`: handing a child a connection would hand it the authority to
 * send as the account, which is exactly the widening law 2 forbids — and it would do it
 * through the context door rather than the tools door, where nobody would be looking.
 */
export const CONTEXT_NEVER = Object.freeze(["secret", "connection", "credential"]);

/**
 * `selectContext(asked)` → `{ context, refused }`
 *
 * `asked` is a list of `{ kind, name, value }` the PARENT chose. Answers the entries that
 * may travel, in the order asked, and NAMES every refusal with its reason — because a
 * silently dropped piece of context is a specialist told less than the parent believes it
 * was told, which is indistinguishable from a specialist that ignored it.
 */
export function selectContext(asked) {
  if (asked === undefined || asked === null) return Object.freeze({ context: Object.freeze([]), refused: Object.freeze([]) });
  if (!Array.isArray(asked)) {
    // REFUSED, NOT COERCED. `[asked]` would make one malformed object into a valid list.
    return Object.freeze({ context: Object.freeze([]), refused: Object.freeze([{ name: null, why: "not-a-list" }]) });
  }
  const context = [];
  const refused = [];
  const seen = new Set();
  for (const item of asked) {
    if (!item || typeof item !== "object" || Array.isArray(item)) { refused.push({ name: null, why: "not-an-entry" }); continue; }
    const kind = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) { refused.push({ name: null, why: "no-name" }); continue; }
    // ⚠ NAMED BEFORE "unknown", so a customer who asks for a secret is told that secrets
    // are never delegated rather than that `secret` is not a kind of thing.
    if (CONTEXT_NEVER.includes(kind)) { refused.push({ name, why: `${kind}-never-delegated` }); continue; }
    if (!CONTEXT_KINDS.includes(kind)) { refused.push({ name, why: "unknown-kind" }); continue; }
    // The value must be text. A child is TOLD things; a structured object here would be a
    // second, unvalidated shape arriving at a specialist's instructions.
    if (typeof item.value !== "string") { refused.push({ name, why: "value-not-text" }); continue; }
    const key = `${kind}:${name}`;
    if (seen.has(key)) { refused.push({ name, why: "already-asked" }); continue; }
    seen.add(key);
    context.push(Object.freeze({ kind, name, value: item.value }));
  }
  return Object.freeze({ context: Object.freeze(context), refused: Object.freeze(refused) });
}

// ── what a specialist is allowed to do ───────────────────────────────────────────────

/**
 * `narrowDelegatedTools({ specialist, granted, revoked })` → `{ tools, unknown, withheld }`
 *
 * ⚠ **THREE SETS IN, AND THE ANSWER IS AN INTERSECTION MINUS A SET.** There is deliberately
 * no branch that can add a name:
 *
 *     tools = specialist ∩ granted − revoked
 *
 * `specialist` is what that agent declares it can do — the same positive lookup
 * `narrowTools` makes, for the same reason: a customer chooses FROM a catalog and can never
 * extend it. `granted` is the authority given to THIS delegation, which is how a parent
 * hands over less than the specialist could otherwise do. `revoked` is the account's own
 * withdrawal, applied LAST so nothing can be granted around it.
 *
 * **`unknown` AND `withheld` ARE SEPARATE ANSWERS.** A grant naming a tool the specialist
 * does not have is a parent's mistake to fix; a tool the account has revoked is a decision
 * somebody made. Collapsing them would send one to fix the other.
 */
export function narrowDelegatedTools({ specialist, granted, revoked } = {}) {
  if (!Array.isArray(specialist)) throw new TypeError("narrowDelegatedTools: specialist must be an array of tool names");
  if (!Array.isArray(granted)) throw new TypeError("narrowDelegatedTools: granted must be an array of tool names");
  const rev = new Set((Array.isArray(revoked) ? revoked : []).filter((n) => typeof n === "string"));
  // STRINGS ONLY, on every side. These lists come out of a database column and a JSON log,
  // so they can hold anything — a number, an object, `"constructor"`.
  const has = new Set(specialist.filter((n) => typeof n === "string"));
  const want = new Set(granted.filter((n) => typeof n === "string"));
  // ORDER IS THE SPECIALIST'S, never the grant's — the rule `narrowTools` states, so a
  // stored grant cannot decide how a child sees its own tools.
  const tools = [...has].filter((n) => want.has(n) && !rev.has(n));
  const unknown = [...want].filter((n) => !has.has(n));
  const withheld = [...want].filter((n) => has.has(n) && rev.has(n));
  return Object.freeze({
    tools: Object.freeze(tools),
    unknown: Object.freeze(unknown),
    withheld: Object.freeze(withheld),
  });
}

// ── reading one child ────────────────────────────────────────────────────────────────

/**
 * `childState(row, { now, waitMs })` → one of `CHILD_STATES`
 *
 * ⚠ **FAILS CLOSED, AND THE ORDER IS THE MEANING.** Cancellation is read first because it
 * is a decision somebody made and outranks whatever the work was doing; then a settled
 * outcome; then the deadline, which is what turns silence into `unresolved` rather than
 * leaving a parent waiting for ever. A row this cannot read at all is `unreadable` — law 4.
 */
export function childState(row, { now = Date.now, waitMs = DELEGATION_DEFAULTS.waitMs } = {}) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "unreadable";
  if (row.cancelled_at) return "cancelled";
  if (row.settled_at) {
    const outcome = row.outcome;
    if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) return "unreadable";
    // `ok` MUST BE THE BOOLEAN. `"false"` is truthy, so a coercing reader would report a
    // failed specialist as having delivered — the one direction that breaks law 1.
    if (outcome.ok === true) return "done";
    if (outcome.ok === false) return "failed";
    return "unreadable";
  }
  // ⚠ THE DEADLINE IS WHAT MAKES SILENCE AN ANSWER. Without it a child whose consumer died
  // between the claim and the answer leaves the parent waiting for ever, and a parent that
  // waits for ever is one nobody can tell from a parent that is working.
  const started = Date.parse(row.created_at ?? "");
  if (Number.isFinite(started) && okBound(waitMs) && waitMs !== Infinity && now() - started > waitMs) {
    return "unresolved";
  }
  if (row.claimed_at) return "running";
  return "queued";
}

// ── may this delegation happen at all ────────────────────────────────────────────────

/**
 * `mayDelegate({ depth, asked, treeCount, bounds, parentStopped })` → `{ ok, error, ... }`
 *
 * Every refusal NAMES ITSELF, because each one needs a different thing done about it: a
 * depth refusal is a workflow to restructure, a `children` refusal is a step to split, a
 * tree refusal is a budget to raise, and a stopped parent is not a fault at all.
 */
export function mayDelegate({ depth = 0, asked = 0, treeCount = 0, bounds = DELEGATION_DEFAULTS, parentStopped = false } = {}) {
  // ⚠ ASKED FIRST, because a parent that has been cancelled must start NOTHING, whatever
  // the bounds would otherwise allow. Reading the bounds first would let a cancelled
  // parent's refusal read as "too many children", sending somebody to raise a limit.
  if (parentStopped) return Object.freeze({ ok: false, error: "parent-stopped" });
  if (!Number.isInteger(depth) || depth < 0) return Object.freeze({ ok: false, error: "bad-depth" });
  if (!Number.isInteger(asked) || asked < 1) return Object.freeze({ ok: false, error: "nothing-asked" });
  // `depth` is how deep THIS parent already is. A tree bounded at depth 2 allows a
  // delegating step at depth 0 and 1, and refuses one at 2 — so `depth >= bounds.depth`
  // rather than `>`, and a bound of 0 means "may not delegate at all", which is a real
  // setting somebody may want.
  if (depth >= bounds.depth) return Object.freeze({ ok: false, error: "too-deep", depth, limit: bounds.depth });
  if (asked > bounds.children) return Object.freeze({ ok: false, error: "too-many-children", asked, limit: bounds.children });
  if (treeCount + asked > bounds.treeChildren) {
    return Object.freeze({ ok: false, error: "tree-full", held: treeCount, asked, limit: bounds.treeChildren });
  }
  return Object.freeze({ ok: true, concurrency: Math.max(1, Math.min(bounds.concurrency, asked)) });
}

// ── what a set of children adds up to ────────────────────────────────────────────────

/**
 * `waitVerdict(states, policy)` → `{ over, ok, counts, why, blocking }`
 *
 * `states` is a list of `CHILD_STATES`, in delegation order.
 *
 * ⚠ **`over` AND `ok` ARE TWO QUESTIONS AND THE WHOLE MODULE TURNS ON NOT CONFLATING THEM.**
 * `over` is "has the waiting finished" — the parent's work row stays released until it is
 * true. `ok` is "may the step go on" — a judgement about the results. A reader that asked
 * only one of them would either resume a parent whose children are still working, or leave
 * a parent waiting on children that have all failed.
 *
 * ⚠ **LAW 1 LIVES IN `delivered`.** It counts `done` and nothing else. `unresolved` is
 * never added to it under any policy, which is what stops a parent reading silence as work.
 */
export function waitVerdict(states, policy = "all") {
  const list = Array.isArray(states) ? states.slice() : [];
  // A state this does not recognise is counted as `unreadable` rather than ignored — an
  // ignored child is one the parent waits for for ever, or worse, one it does not wait for.
  const known = list.map((s) => (CHILD_STATES.includes(s) ? s : "unreadable"));
  const counts = Object.freeze(Object.fromEntries(
    CHILD_STATES.map((s) => [s, known.filter((x) => x === s).length]),
  ));
  const total = known.length;
  const live = known.filter((s) => CHILD_LIVE.includes(s)).length;
  const delivered = counts[CHILD_DELIVERED];
  // A POLICY THIS DOES NOT RECOGNISE IS `all`, the STRICTEST — fail closed. Reading an
  // unknown policy as `best_effort` would make a typo into a step that proceeds on partial
  // work, which is the expensive direction.
  const pol = POLICY_NAMES.includes(policy) ? policy : "all";

  if (total === 0) {
    // NO CHILDREN AT ALL is not a satisfied wait — it is a step that asked for nothing, and
    // it must not read as every child having delivered.
    return Object.freeze({ over: true, ok: false, policy: pol, counts, total,
      why: "no-children", blocking: Object.freeze([]) });
  }

  // `any` may finish EARLY: one delivered answer is the whole condition, so the parent does
  // not sit through the rest. Every other policy needs the roster complete, because their
  // answer is about all of them.
  const over = pol === "any" ? (delivered >= 1 || live === 0) : live === 0;
  if (!over) {
    return Object.freeze({ over: false, ok: false, policy: pol, counts, total,
      why: "still-working", blocking: Object.freeze(known.map((s, i) => (CHILD_LIVE.includes(s) ? i : -1)).filter((i) => i >= 0)) });
  }

  // Which children are the reason a strict policy cannot pass — by INDEX, so the caller can
  // name them. Index and not name, because two specialists can share a name and the index
  // is the one thing tying an answer back to what it was asked of.
  const blocking = Object.freeze(known.map((s, i) => (s === CHILD_DELIVERED ? -1 : i)).filter((i) => i >= 0));

  if (pol === "all") {
    const ok = delivered === total;
    return Object.freeze({ over: true, ok, policy: pol, counts, total,
      why: ok ? "all-delivered" : "not-all-delivered", blocking });
  }
  if (pol === "any") {
    const ok = delivered >= 1;
    return Object.freeze({ over: true, ok, policy: pol, counts, total,
      why: ok ? "one-delivered" : "none-delivered", blocking });
  }
  // `best_effort` — ⚠ AND IT STILL REFUSES WHEN NOTHING CAME BACK. "Carry on with whoever
  // finished" presupposes that somebody did; answering `ok` over zero delivered results
  // would be law 1 arriving through the policy door, with the step reporting success on a
  // combination of nothing.
  const ok = delivered >= 1;
  return Object.freeze({ over: true, ok, policy: pol, counts, total,
    why: ok ? "carried-on" : "nothing-delivered", blocking });
}

/**
 * `combineResults(children)` → `{ results, roster }`
 *
 * ⚠ **DETERMINISTIC BY INDEX, NEVER BY COMPLETION ORDER**, which is `runFanout`'s own law:
 * the index is the only thing tying an answer back to what it was asked of once they finish
 * out of order. Two runs of the same delegation with the same answers combine identically,
 * whatever order the queue happened to deliver them in.
 *
 * **ONLY `done` CHILDREN CONTRIBUTE A RESULT, AND EVERY CHILD IS ON THE ROSTER.** The
 * roster is what makes the combination honest: a caller reading `results` alone sees what
 * came back, and a caller reading `roster` sees what was asked for — so the difference
 * between them is never invisible.
 */
export function combineResults(children) {
  const list = Array.isArray(children) ? children : [];
  const ordered = list
    .map((c, i) => ({ c, i: Number.isInteger(c?.index) ? c.index : i }))
    .sort((a, b) => (a.i - b.i) || 0);
  const results = [];
  const roster = [];
  for (const { c, i } of ordered) {
    const state = CHILD_STATES.includes(c?.state) ? c.state : "unreadable";
    roster.push(Object.freeze({
      index: i,
      agent: typeof c?.agent === "string" ? c.agent : null,
      task: typeof c?.task === "string" ? c.task : null,
      state,
    }));
    if (state !== CHILD_DELIVERED) continue;
    results.push(Object.freeze({
      index: i,
      agent: typeof c?.agent === "string" ? c.agent : null,
      // The specialist's own answer, carried as it came. Nothing here interprets it.
      result: c?.result === undefined ? null : c.result,
    }));
  }
  return Object.freeze({ results: Object.freeze(results), roster: Object.freeze(roster) });
}

// ── the one marker that can suspend a run ────────────────────────────────────────────

/**
 * `WAITING_MARK` — the key a `waits: true` tool's answer carries to say *this call has not
 * finished and its result will arrive in a later delivery*.
 *
 * ⚠ **IT IS HALF OF A PAIR AND NEITHER HALF IS SUFFICIENT.** `run.mjs` holds a run only
 * where the tool DECLARED `waits: true` AND its answer carries this — so an ordinary tool
 * that happens to answer a `waiting` key cannot suspend a run by accident, and a tool that
 * declares it and answers an ordinary value is answered ordinarily. A declaration alone
 * would suspend every call of that tool, including the ones that really did finish (a
 * delegation whose children had all settled by the time it looked), and a value alone would
 * put the decision in the hands of whatever a tool's own code returned.
 */
export const WAITING_MARK = "waiting";

/**
 * `isWaiting(value)` → whether a tool's answer claims to be unfinished.
 *
 * **REFUSED, NEVER COERCED.** `Boolean("false")` is `true` and `String(["x"])` is `"x"`, so
 * only the boolean `true` counts: a string out of a JSON round trip must not be what
 * suspends somebody's run. Everything else — absent, `null`, `"true"`, `1` — is an ordinary
 * answer, which is the direction that FINISHES a step rather than leaving it open for ever.
 */
export function isWaiting(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return value[WAITING_MARK] === true;
}
