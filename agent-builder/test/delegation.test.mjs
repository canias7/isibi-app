/**
 * THE READING OF A TASK TREE, which is every rule about delegation that is not the
 * database's.
 *
 * `src/delegation.mjs` is pure and dependency-free, so every branch below is drivable with
 * no queue, no store and no clock — which is the whole reason the reading lives there rather
 * than inside the tool. What the DATABASE decides (the bounds, the depth, the tree count,
 * the revocations) is proved on a real PostgreSQL; what is proved HERE is the part no row
 * can see: that an absence never reads as a value, that a silent drop is a sentence, and
 * that nothing anywhere adds a name to what a child may do.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CHILD_STATES, CHILD_LIVE, CHILD_SETTLED, CHILD_DELIVERED,
  WAIT_POLICIES, POLICY_NAMES,
  DELEGATION_DEFAULTS, DELEGATION_LIMIT_NAMES, okBound, delegationBounds,
  CONTEXT_KINDS, CONTEXT_NEVER, selectContext,
  narrowDelegatedTools, childState, childOutcome, sayDelegation, waitVerdict, combineResults,
  WAITING_MARK, isWaiting,
} from "../src/delegation.mjs";

/** A clock that does not move, so a deadline is a decision rather than a race. */
const at = (ms) => () => ms;
/** A settled child. `ok` is the BOOLEAN on purpose — see the case about it. */
const settled = (ok, result) => ({ settled_at: "2026-09-22T00:00:00Z", outcome: { ok, result } });

test("the state list is a PARTITION, and it is derived rather than listed twice", () => {
  // A state added above and classified nowhere is a child a parent either waits for for
  // ever or does not wait for at all, so the two halves have to cover it between them.
  assert.deepEqual([...CHILD_LIVE, ...CHILD_SETTLED].sort(), [...CHILD_STATES].sort());
  for (const s of CHILD_LIVE) assert.ok(!CHILD_SETTLED.includes(s), `${s} is both live and settled`);
  // EXACTLY ONE STATE COUNTS AS WORK DELIVERED, and it is a settled one. Two would make
  // "delivered" a judgement rather than a fact; a live one would count work not yet done.
  assert.ok(CHILD_STATES.includes(CHILD_DELIVERED));
  assert.ok(CHILD_SETTLED.includes(CHILD_DELIVERED));
  // AND `unresolved` IS A STATE OF ITS OWN rather than a kind of failure — law 1 needs a
  // word for "nothing will move it and it never answered", distinct from "it ran and
  // failed", because the two invite opposite things to be done about them.
  assert.ok(CHILD_STATES.includes("unresolved"));
  assert.ok(CHILD_STATES.includes("failed"));
  assert.notEqual("unresolved", "failed");
  // The policy names are the table's own keys, so a policy cannot be offered and unhandled.
  assert.deepEqual([...POLICY_NAMES].sort(), Object.keys(WAIT_POLICIES).sort());
  for (const p of POLICY_NAMES) {
    assert.equal(typeof WAIT_POLICIES[p].label, "string", `${p} has no label`);
    assert.equal(typeof WAIT_POLICIES[p].does, "string", `${p} does not say what it does`);
  }
  // And the bound names are `DELEGATION_DEFAULTS`' own keys, for the same reason.
  assert.deepEqual([...DELEGATION_LIMIT_NAMES].sort(), Object.keys(DELEGATION_DEFAULTS).sort());
});

test("⚠ A BOUND IS REFUSED RATHER THAN COERCED, AND `Infinity` IS A STATED ANSWER", () => {
  // `String(["8"])` is `"8"`, so a coercing reader takes a list as a bound.
  for (const bad of ["8", ["8"], null, undefined, {}, NaN, -1, true, "Infinity"]) {
    assert.equal(okBound(bad), false, `okBound accepted ${JSON.stringify(bad)}`);
  }
  for (const good of [0, 1, 8, 2_000_000, Infinity]) {
    assert.equal(okBound(good), true, `okBound refused ${good}`);
  }
  // ⚠ `Number.isFinite(Infinity)` IS FALSE, so the obvious guard reads a deliberate "no
  // ceiling" as unusable and substitutes a default — for the one input where a default is
  // the most wrong answer available.
  assert.equal(delegationBounds({ waitMs: Infinity }).bounds.waitMs, Infinity);
  assert.deepEqual(delegationBounds({ waitMs: Infinity }).refused, []);
});

test("⚠ AN UNREADABLE OVERRIDE IS DROPPED AND NAMED, and the rest stay at their defaults", () => {
  const { bounds, refused } = delegationBounds({ children: 2, depth: "deep", nonsense: 9 });
  assert.equal(bounds.children, 2, "a readable override did not apply");
  assert.equal(bounds.depth, DELEGATION_DEFAULTS.depth, "an unreadable override was taken");
  // NAMED, because a filter is a silent drop and a check is a sentence: a deployment that
  // typed a bound wrongly must not run on the default believing its own number applied.
  assert.deepEqual(refused, ["depth"]);
  // A KEY THAT IS NOT A BOUND IS NOT A REFUSAL — it is not this function's business, and
  // reporting it would make every unrelated option in a config read as a rejected bound.
  assert.ok(!refused.includes("nonsense"));
  assert.ok(!Object.hasOwn(bounds, "nonsense"));
  // NO ARGUMENT AT ALL IS THE DEFAULTS, and so is a non-object: `delegationBounds(["x"])`
  // must not iterate a list looking for named bounds.
  assert.deepEqual(delegationBounds().bounds, { ...DELEGATION_DEFAULTS });
  assert.deepEqual(delegationBounds(["x"]).bounds, { ...DELEGATION_DEFAULTS });
  assert.deepEqual(delegationBounds(null).refused, []);
});

test("⚠ NOTHING IS PASSED ON UNLESS IT WAS NAMED — the default is nothing at all", () => {
  // THE FEATURE IS THE ABSENCE OF A BRANCH. "Do not automatically copy every conversation,
  // memory or secret to every specialist" is this function having no path that copies
  // anything the parent did not write down.
  assert.deepEqual(selectContext(undefined).context, []);
  assert.deepEqual(selectContext(undefined).refused, []);
  assert.deepEqual(selectContext(null).context, []);
  assert.deepEqual(selectContext([]).context, []);
  // A NON-ARRAY IS REFUSED, NOT WRAPPED. `[asked]` would turn one malformed object into a
  // valid list of one, which is the coercion that makes a wall optional.
  const notList = selectContext({ kind: "note", name: "n", value: "v" });
  assert.deepEqual(notList.context, []);
  assert.deepEqual(notList.refused, [{ name: null, why: "not-a-list" }]);
});

test("⚠ A SECRET IS NAMED AS NEVER DELEGATED, not as an unknown kind", () => {
  const out = selectContext([
    { kind: "note", name: "brief", value: "the customer's own words" },
    { kind: "secret", name: "stripe", value: "sk_live_x" },
    { kind: "connection", name: "mail", value: "id" },
    { kind: "credential", name: "key", value: "x" },
    { kind: "wallet", name: "w", value: "x" },
  ]);
  // Only the one allowed kind travels, and its value is carried verbatim.
  assert.deepEqual(out.context.map((c) => c.name), ["brief"]);
  assert.equal(out.context[0].value, "the customer's own words");
  // ⚠ NAMED BEFORE "unknown", so somebody who asks for a secret is told that secrets are
  // never delegated rather than that `secret` is not a kind of thing — which would send
  // them to add it to a list.
  const why = new Map(out.refused.map((r) => [r.name, r.why]));
  assert.equal(why.get("stripe"), "secret-never-delegated");
  assert.equal(why.get("mail"), "connection-never-delegated");
  assert.equal(why.get("key"), "credential-never-delegated");
  // AND THE WALL IS THE POSITIVE LIST, so a kind nobody thought of is refused as unknown
  // rather than admitted — which is what makes `CONTEXT_NEVER` a sentence and not the wall.
  assert.equal(why.get("w"), "unknown-kind");
  for (const k of CONTEXT_NEVER) assert.ok(!CONTEXT_KINDS.includes(k), `${k} is both allowed and forbidden`);
});

test("⚠ EVERY CONTEXT REFUSAL IS ITS OWN, and the order asked is the order passed", () => {
  const out = selectContext([
    { kind: "reference", name: "prices", value: "£4" },
    { kind: "NOTE", name: "  brief  ", value: "x" },   // the kind folds, the name trims
    { kind: "note", name: "", value: "x" },            // no name
    { kind: "note", name: "n2", value: 7 },            // a value must be TEXT
    { kind: "memory", name: "tone", value: "plain" },
    { kind: "memory", name: "tone", value: "plain" },  // the same thing twice
    "not an entry",
  ]);
  // ORDER IS THE ORDER ASKED, because a specialist is told things in the order the parent
  // chose and a reordering reader would rewrite what it was told.
  assert.deepEqual(out.context.map((c) => `${c.kind}:${c.name}`),
    ["reference:prices", "note:brief", "memory:tone"]);
  assert.deepEqual(out.refused.map((r) => r.why),
    ["no-name", "value-not-text", "already-asked", "not-an-entry"]);
  // A VALUE MUST BE TEXT rather than coerced: a structured object here is a second,
  // unvalidated shape arriving at a specialist's instructions.
  assert.ok(!out.context.some((c) => c.name === "n2"));
  // AND A DUPLICATE IS REFUSED RATHER THAN DEDUPLICATED SILENTLY, because two entries under
  // one name is a parent that believes it said two things.
  assert.equal(out.context.filter((c) => c.name === "tone").length, 1);
});

test("⚠ A CHILD'S TOOLS ARE AN INTERSECTION MINUS A SET, and no branch can add a name", () => {
  const out = narrowDelegatedTools({
    specialist: ["remember", "forget", "send_message"],
    granted: ["remember", "send_message", "delegate", "constructor"],
    revoked: ["send_message"],
  });
  // specialist ∩ granted − revoked, and nothing else.
  assert.deepEqual(out.tools, ["remember"]);
  // `unknown` AND `withheld` ARE SEPARATE ANSWERS: a grant naming a tool the specialist
  // has not got is the parent's mistake to fix, and a revocation is a decision somebody
  // made. Collapsing them sends one to fix the other.
  assert.deepEqual([...out.unknown].sort(), ["constructor", "delegate"]);
  assert.deepEqual(out.withheld, ["send_message"]);
  // ⚠ `"constructor"` IS TRUTHY ON EVERY OBJECT, so the sets have to be real Sets rather
  // than a lookup on a plain object — asserted above by its landing in `unknown`.
  assert.ok(!out.tools.includes("constructor"));
  // ORDER IS THE SPECIALIST'S, never the grant's, so a stored grant cannot decide how a
  // child sees its own tools.
  const ordered = narrowDelegatedTools({
    specialist: ["a", "b", "c"], granted: ["c", "b", "a"], revoked: [],
  });
  assert.deepEqual(ordered.tools, ["a", "b", "c"]);
  // GRANTING NOTHING IS GIVING NOTHING, which is the default the tool's own schema states.
  assert.deepEqual(narrowDelegatedTools({ specialist: ["a"], granted: [] }).tools, []);
  // STRINGS ONLY ON EVERY SIDE — these lists come out of a database column and a JSON log.
  const junk = narrowDelegatedTools({
    specialist: ["a", 7, null, { name: "b" }], granted: ["a", 7, null], revoked: [{}],
  });
  assert.deepEqual(junk.tools, ["a"]);
  // AND A LIST THAT IS NOT A LIST THROWS rather than being read as empty: an unreadable
  // specialist silently granted nothing is a child that runs and can do nothing, which
  // reads exactly like a specialist that ignored its task.
  assert.throws(() => narrowDelegatedTools({ specialist: "a", granted: [] }), TypeError);
  assert.throws(() => narrowDelegatedTools({ specialist: [], granted: "a" }), TypeError);
  // A REVOCATION LIST THAT IS NOT A LIST IS EMPTY, deliberately and unlike the other two:
  // it is the only one of the three whose absence is ordinary, since most accounts have
  // revoked nothing — and `throw` there would refuse every delegation on a deployment that
  // could not read them. The intersection above is still the wall.
  assert.deepEqual(narrowDelegatedTools({ specialist: ["a"], granted: ["a"], revoked: "x" }).tools, ["a"]);
});

test("⚠ READING ONE CHILD FAILS CLOSED, AND THE ORDER IS THE MEANING", () => {
  // A ROW THIS CANNOT READ AT ALL IS `unreadable` — our fault, not the child's, and not a
  // failure of the work.
  for (const bad of [null, undefined, 7, "done", ["done"]]) {
    assert.equal(childState(bad), "unreadable", `childState read ${JSON.stringify(bad)}`);
  }
  // CANCELLATION OUTRANKS EVERYTHING, because it is a decision somebody made: a child that
  // answered and was then cancelled is still a child somebody stopped.
  assert.equal(childState({ ...settled(true), cancelled_at: "2026-09-22T00:00:00Z" }), "cancelled");
  // A SETTLED OUTCOME OUTRANKS THE DEADLINE, or a child that answered late reads as
  // never having answered — which is law 1 inverted, and would throw away real work.
  assert.equal(childState({ created_at: "2020-01-01T00:00:00Z", ...settled(true) },
    { now: at(Date.parse("2026-09-22T00:00:00Z")), waitMs: 1000 }), "done");
  // ⚠ `ok` MUST BE THE BOOLEAN. `"false"` is truthy, so a coercing reader reports a failed
  // specialist as having delivered — the one direction that breaks law 1.
  assert.equal(childState(settled(true)), "done");
  assert.equal(childState(settled(false)), "failed");
  for (const bad of ["true", "false", 1, 0, null, undefined]) {
    assert.equal(childState({ settled_at: "x", outcome: { ok: bad } }), "unreadable",
      `ok: ${JSON.stringify(bad)} was read as a verdict`);
  }
  // A SETTLED CHILD WHOSE OUTCOME WILL NOT PARSE IS `unreadable`, not `failed`: we cannot
  // say the work failed, only that we cannot read what it said.
  assert.equal(childState({ settled_at: "x", outcome: "done" }), "unreadable");
  assert.equal(childState({ settled_at: "x" }), "unreadable");
});

test("⚠ THE DEADLINE IS WHAT MAKES SILENCE AN ANSWER", () => {
  const born = "2026-09-22T00:00:00Z";
  const t0 = Date.parse(born);
  const row = { created_at: born, claimed_at: born };
  // Inside the window a claimed child is `running` and an unclaimed one is `queued`.
  assert.equal(childState(row, { now: at(t0 + 500), waitMs: 1000 }), "running");
  assert.equal(childState({ created_at: born }, { now: at(t0 + 500), waitMs: 1000 }), "queued");
  // ⚠ PAST IT, SILENCE IS `unresolved` — without which a child whose consumer died between
  // the claim and the answer leaves the parent waiting for ever, and a parent that waits
  // for ever is one nobody can tell from a parent that is working.
  assert.equal(childState(row, { now: at(t0 + 1001), waitMs: 1000 }), "unresolved");
  // `Infinity` IS A STATED ANSWER and means no deadline, so it never expires.
  //
  // ⚠ **AND `childState`'s OWN `waitMs !== Infinity` IS A DECLARED SECOND WALL, MEASURED
  // INERT** — `x > Infinity` is false for every finite x, so the comparison below it answers
  // the same thing either way (sixteen shapes, zero differences; the measurement is in the
  // source). The property asserted here is true; what makes it REACHABLE is `okBound`
  // admitting `Infinity`, one function over, because a reader that refused it would hand
  // `delegationBounds` the default — fifteen minutes to a deployment that asked for none.
  // That half is driven by the bounds case above and really does go red.
  assert.equal(childState(row, { now: at(t0 + 1e12), waitMs: Infinity }), "running");
  // AND AN UNREADABLE BOUND MEANS NO DEADLINE, which is the safe direction here: declaring
  // a live child dead on the strength of a bound we could not read is worse than waiting.
  assert.equal(childState(row, { now: at(t0 + 1e12), waitMs: "soon" }), "running");
  // A ROW WITH NO BIRTH TIME CANNOT BE AGED, so it is read as what it is rather than as
  // expired — cannot-tell must never read as a value.
  assert.equal(childState({ claimed_at: born }, { now: at(t0 + 1e12), waitMs: 1 }), "running");
});

test("⚠ `childOutcome` IS THE INVERSE OF `childState`, AND ONLY `answered` IS DELIVERED", () => {
  // THE ROUND TRIP IS WHY THIS FUNCTION LIVES BESIDE `childState` RATHER THAN IN THE RUNNER.
  // The settle writes what this answers and the parent reads it back with that one, so the
  // two halves of one shape are asserted to agree rather than assumed to: a shape that
  // round-trips today stops doing so the first time one half is edited alone.
  const asRow = (stop) => ({ settled_at: "2026-09-22T00:00:00Z", outcome: childOutcome(stop) });
  assert.equal(childState(asRow({ reason: "answered", text: "the tide table" })), "done");

  // A CHILD THAT ANSWERED HANDS OVER ITS WORDS, and `result` is the field `combineResults`
  // reads once the row has been projected.
  const done = childOutcome({ reason: "answered", text: "the tide table" });
  assert.deepEqual(done, { ok: true, reason: "answered", result: "the tide table" });
  assert.deepEqual(
    combineResults([{ index: 0, state: childState(asRow({ reason: "answered", text: "the tide table" })), result: done.result }]).results,
    [{ index: 0, agent: null, result: "the tide table" }],
  );

  // ⚠ EVERY OTHER ENDING IS A FAILURE AND CARRIES ITS OWN REASON. Out of steps, out of
  // budget, a failed call, a crash — each is a run that stopped without answering, and
  // reading any of them as delivered is law 1 inverted. A reason this has never heard of
  // falls the same way, so a stop kind added next month is a failure rather than a success.
  for (const reason of ["spent", "unmeasured", "call-failed", "crashed", "cancelled", "next-months-word"]) {
    const out = childOutcome({ reason, text: "half a sentence" });
    assert.equal(out.ok, false, `${reason} read as delivered`);
    assert.equal(out.reason, reason, `${reason} lost its reason`);
    // `result` RIDES ONLY ON THE SUCCESS: a bound-stopped run may carry partial text, and
    // handing it on puts words in a specialist's mouth it never finished saying. There is
    // no reader for it either — `combineResults` contributes nothing from a child that is
    // not `done` — so a key here would be a value with a trap in it for the next reader.
    assert.ok(!("result" in out), `${reason} carried a result`);
    assert.equal(childState({ settled_at: "x", outcome: out }), "failed");
  }

  // ⚠ A STOP THIS CANNOT READ IS `ok: false` WITH `reason: "unrecorded"` — never a throw,
  // never an absence, and above all never `ok: true`. Cannot-tell must never read as a
  // value, and the value here is work delivered.
  for (const bad of [null, undefined, 7, "answered", ["answered"], {}, { reason: "" }, { reason: 1 }, { ok: true }]) {
    const out = childOutcome(bad);
    assert.equal(out.ok, false, `${JSON.stringify(bad)} read as delivered`);
    assert.equal(out.reason, "unrecorded", `${JSON.stringify(bad)} invented a reason`);
    assert.equal(childState({ settled_at: "x", outcome: out }), "failed");
  }

  // AND `answered` WITH NOTHING TO SAY IS STILL AN ANSWER, with `result: null` rather than
  // a missing key: a specialist that ran to its end and produced no text delivered nothing,
  // which is a different fact from not having delivered — and `combineResults` has a reader
  // for the null already. A text this cannot read is that same null, never the raw value.
  assert.deepEqual(childOutcome({ reason: "answered" }), { ok: true, reason: "answered", result: null });
  assert.deepEqual(childOutcome({ reason: "answered", text: ["a"] }), { ok: true, reason: "answered", result: null });

  // A BOUND AND AN ERROR ARE NAMED WHEREVER THE STOP GIVES ONE, because a parent told only
  // "it failed" has nothing to say to a customer and nothing to decide from — and they are
  // ABSENT rather than `undefined` when it does not, so the settle writes no key a reader
  // could take for a value.
  assert.deepEqual(childOutcome({ reason: "spent", bound: "steps" }),
    { ok: false, reason: "spent", bound: "steps" });
  assert.deepEqual(childOutcome({ reason: "call-failed", error: "socket hang up" }),
    { ok: false, reason: "call-failed", error: "socket hang up" });
  for (const junk of [7, ["steps"], null, {}]) {
    assert.ok(!("bound" in childOutcome({ reason: "spent", bound: junk })),
      `bound: ${JSON.stringify(junk)} was carried`);
    assert.ok(!("error" in childOutcome({ reason: "crashed", error: junk })),
      `error: ${JSON.stringify(junk)} was carried`);
  }

  // IT IS FROZEN, so nothing between the settle and the wire can edit a verdict.
  assert.ok(Object.isFrozen(done));
});

test("⚠ `over` AND `ok` ARE TWO QUESTIONS, and the module turns on not conflating them", () => {
  // STILL WORKING: the parent's step is not over, so it may not go on — and `blocking`
  // names which children by INDEX, because two specialists can share a name.
  const working = waitVerdict(["done", "running", "queued"]);
  assert.equal(working.over, false);
  assert.equal(working.ok, false);
  assert.equal(working.why, "still-working");
  assert.deepEqual(working.blocking, [1, 2]);
  // OVER AND NOT OK: every child settled and one did not deliver. `over` is what releases
  // the parent; `ok` is what the step does about the results.
  const partial = waitVerdict(["done", "failed"]);
  assert.equal(partial.over, true);
  assert.equal(partial.ok, false);
  assert.equal(partial.why, "not-all-delivered");
  assert.deepEqual(partial.blocking, [1]);
  // OVER AND OK.
  const whole = waitVerdict(["done", "done"]);
  assert.equal(whole.over, true);
  assert.equal(whole.ok, true);
  assert.equal(whole.why, "all-delivered");
  assert.deepEqual(whole.blocking, []);
});

test("⚠ LAW 1: SILENCE IS NEVER WORK DELIVERED, UNDER ANY POLICY", () => {
  for (const policy of POLICY_NAMES) {
    const v = waitVerdict(["unresolved", "unresolved"], policy);
    assert.equal(v.over, true, `${policy}: an unresolved child left the step waiting`);
    assert.equal(v.ok, false, `${policy}: unresolved children were read as work delivered`);
    assert.equal(v.counts.done, 0);
    assert.equal(v.counts.unresolved, 2);
  }
  // AND `best_effort` REFUSES WHEN NOTHING CAME BACK: "carry on with whoever finished"
  // presupposes that somebody did, and answering `ok` over zero results would be law 1
  // arriving through the policy door.
  assert.equal(waitVerdict(["failed", "cancelled"], "best_effort").ok, false);
  assert.equal(waitVerdict(["failed", "cancelled"], "best_effort").why, "nothing-delivered");
  assert.equal(waitVerdict(["done", "failed"], "best_effort").ok, true);
  assert.equal(waitVerdict(["done", "failed"], "best_effort").why, "carried-on");
  // AND THE COUNT OF WHAT DID NOT IS ON THE RESULT, which is what makes it "carry on
  // knowingly" rather than "pretend they all worked".
  assert.equal(waitVerdict(["done", "failed"], "best_effort").counts.failed, 1);
});

test("⚠ NO CHILDREN AT ALL IS NOT A SATISFIED WAIT", () => {
  // A step that asked for nothing must not read as every child having delivered — which is
  // what `live === 0` alone would answer.
  const none = waitVerdict([]);
  assert.equal(none.over, true, "a step with no children left the parent waiting for ever");
  assert.equal(none.ok, false);
  assert.equal(none.why, "no-children");
  assert.equal(none.total, 0);
  for (const policy of POLICY_NAMES) assert.equal(waitVerdict([], policy).ok, false, policy);
  // A NON-LIST IS THE SAME ANSWER rather than a throw: this reads rows, and a reader that
  // threw would take a parent's whole delivery down over a shape it could describe.
  assert.equal(waitVerdict(null).why, "no-children");
  assert.equal(waitVerdict("done").why, "no-children");
});

test("⚠ AN UNKNOWN POLICY IS `all`, THE STRICTEST — fail closed", () => {
  // Reading a typo as `best_effort` makes a misspelling into a step that proceeds on
  // partial work, which is the expensive direction.
  for (const bad of ["ALL", "any_of", "", null, undefined, 7, ["any"], "constructor"]) {
    const v = waitVerdict(["done", "failed"], bad);
    assert.equal(v.policy, "all", `policy ${JSON.stringify(bad)} was not read as all`);
    assert.equal(v.ok, false);
  }
  // `any` MAY FINISH EARLY: one delivered answer is the whole condition, so the parent does
  // not sit through the rest — which is the one place `over` is true with children live.
  const early = waitVerdict(["done", "running"], "any");
  assert.equal(early.over, true);
  assert.equal(early.ok, true);
  assert.equal(early.why, "one-delivered");
  // AND `all` DOES NOT, on the same list: its answer is about all of them.
  assert.equal(waitVerdict(["done", "running"], "all").over, false);
  // `any` WITH NOTHING DELIVERED AND NOTHING LIVE IS OVER AND NOT OK.
  const nothing = waitVerdict(["failed", "unresolved"], "any");
  assert.equal(nothing.over, true);
  assert.equal(nothing.ok, false);
  assert.equal(nothing.why, "none-delivered");
});

test("⚠ A STATE THIS DOES NOT RECOGNISE IS COUNTED, never ignored", () => {
  // An ignored child is one the parent waits for for ever — or worse, one it does not wait
  // for. So an unknown state is `unreadable`, which is settled and is not delivered.
  const v = waitVerdict(["done", "sideways"]);
  assert.equal(v.total, 2, "a child was dropped from the roster");
  assert.equal(v.counts.unreadable, 1);
  assert.equal(v.over, true);
  assert.equal(v.ok, false);
  // AND EVERY STATE HAS A COUNT, so a reader can name what happened rather than inferring
  // it from the difference between two numbers.
  assert.deepEqual(Object.keys(v.counts).sort(), [...CHILD_STATES].sort());
});

test("⚠ THE COMBINATION IS DETERMINISTIC BY INDEX, never by completion order", () => {
  // The index is the only thing tying an answer back to what it was asked of once they
  // finish out of order — `runFanout`'s own law, one layer up.
  const out = combineResults([
    { index: 2, agent: "third", task: "c", state: "done", result: { n: 3 } },
    { index: 0, agent: "first", task: "a", state: "done", result: { n: 1 } },
    { index: 1, agent: "second", task: "b", state: "failed" },
  ]);
  assert.deepEqual(out.results.map((r) => r.index), [0, 2]);
  assert.deepEqual(out.results.map((r) => r.result), [{ n: 1 }, { n: 3 }]);
  // ONLY `done` CHILDREN CONTRIBUTE A RESULT, AND EVERY CHILD IS ON THE ROSTER — so the
  // difference between what came back and what was asked for is never invisible.
  assert.deepEqual(out.roster.map((r) => `${r.index}:${r.state}`), ["0:done", "1:failed", "2:done"]);
  assert.equal(out.roster.length, 3);
  // TWO RUNS OF THE SAME DELEGATION COMBINE IDENTICALLY, whatever order the queue happened
  // to deliver them in.
  const shuffled = combineResults([
    { index: 1, agent: "second", task: "b", state: "failed" },
    { index: 2, agent: "third", task: "c", state: "done", result: { n: 3 } },
    { index: 0, agent: "first", task: "a", state: "done", result: { n: 1 } },
  ]);
  assert.deepEqual(shuffled, out);
  // A DELIVERED CHILD WITH NO RESULT IS `null`, not absent: it answered, and what it
  // answered was nothing — which is a different fact from not having answered.
  const empty = combineResults([{ index: 0, state: "done" }]);
  assert.deepEqual(empty.results, [{ index: 0, agent: null, result: null }]);
  // AN UNREADABLE ENTRY IS STILL ON THE ROSTER, at the position it was asked at.
  const junk = combineResults([{ index: 0, state: "sideways" }, "nonsense"]);
  assert.deepEqual(junk.roster.map((r) => r.state), ["unreadable", "unreadable"]);
  assert.deepEqual(junk.results, []);
  assert.deepEqual(combineResults(null).roster, []);
});

test("⚠ THE WAITING MARKER IS HALF OF A PAIR, AND IT IS REFUSED RATHER THAN COERCED", () => {
  // `Boolean("false")` is `true`, so only the boolean counts: a string out of a JSON round
  // trip must not be what suspends somebody's run.
  assert.equal(isWaiting({ [WAITING_MARK]: true }), true);
  for (const bad of ["true", 1, {}, [], null, undefined, "waiting", { [WAITING_MARK]: "true" }]) {
    assert.equal(isWaiting(bad), false, `isWaiting accepted ${JSON.stringify(bad)}`);
  }
  // AND EVERYTHING ELSE IS AN ORDINARY ANSWER, which is the direction that FINISHES a step
  // rather than leaving it open for ever.
  assert.equal(isWaiting({ ok: true }), false);
});

test("⚠ EVERY REFUSAL HAS ITS OWN WORDS, and a position is one-based in the sentence", () => {
  // Each needs a different thing done about it: a depth refusal is a workflow to
  // restructure, a child cap is a step to split, a full tree is a budget to raise, a paused
  // specialist is a setting to change, and a stopped parent is not a fault at all.
  const errors = ["nothing-asked", "no-parent", "parent-stopped", "no-tree", "too-deep",
    "too-many-children", "tree-full", "bad-child", "no-ids", "no-specialist",
    "self-delegation", "specialist-paused"];
  const said = errors.map((e) => sayDelegation(e, { at: 0, limit: 2, asked: 9, depth: 3, held: 32 }));
  assert.equal(new Set(said).size, errors.length, "two refusals share a sentence");
  for (const s of said) assert.ok(s.length > 20, `a refusal answered "${s}"`);
  // ⚠ ZERO-BASED IN THE ANSWER AND ONE-BASED IN THE SENTENCE, because the list it names is
  // the one somebody wrote and nobody counts their own list from 0.
  assert.match(sayDelegation("bad-child", { at: 0 }), /task 1\b/);
  assert.match(sayDelegation("bad-child", { at: 4 }), /task 5\b/);
  // WITH NO POSITION IT SAYS SO rather than naming task 1, which would send somebody to fix
  // the wrong one.
  assert.match(sayDelegation("bad-child", {}), /one of the tasks/);
  assert.match(sayDelegation("bad-child", { at: -1 }), /one of the tasks/);
  // THE NUMBERS ARE NAMED WHERE THE DATABASE GIVES THEM, so a cap refusal is actionable.
  assert.match(sayDelegation("too-many-children", { asked: 9, limit: 4 }), /9 tasks.*\b4\b/);
  assert.match(sayDelegation("too-deep", { depth: 3, limit: 2 }), /3 levels deep.*\b2\b/);
  // AND A MISSING NUMBER IS SAID AS ONE rather than printed as `undefined` — cannot-tell
  // must never read as a value, and here the value would be a bound nobody set.
  assert.match(sayDelegation("tree-full", {}), /the limit/);
  assert.ok(!sayDelegation("tree-full", {}).includes("undefined"));
  // AN ERROR NOBODY HAS HEARD OF STILL ANSWERS A SENTENCE, because a refusal that arrives
  // as `undefined` is one a model reads as nothing having gone wrong.
  assert.equal(typeof sayDelegation("who-knows", {}), "string");
  assert.ok(sayDelegation("who-knows", {}).length > 10);
  assert.equal(typeof sayDelegation(undefined), "string");
});
