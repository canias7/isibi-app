/**
 * THE RUN JOURNAL — an append-only record, and the replay that rebuilds a run
 * from it.
 *
 * WHY APPEND-ONLY. A container recycles and an isolate dies; that is not an edge
 * case on this stack, it is Tuesday. The one shape that survives a process
 * vanishing mid-write is a log you only ever add to: nothing is rewritten, so
 * there is no half-updated record to reason about, and the worst a crash can do
 * is lose the last entry. The rule underneath it: store the raw answer ONCE,
 * before anything can refuse it. The tempting alternative is to keep a summary or
 * a status field instead of the thing itself, and a summary never answers the
 * question you actually end up having.
 *
 * DEPENDENCY-FREE AND PURE. No storage: entries are handed in and handed out.
 * Where they are kept — Postgres, R2, a Durable Object, an array in a test — is
 * the caller's business and this module never needs to know.
 *
 * THE MESSAGE BUILDERS LIVE HERE, and that is the point of putting replay and the
 * loop behind one module. The loop composes messages as it goes; the replay
 * composes them again from the log. Two copies of that composition would drift,
 * and they would drift in the direction where a RESUMED run sends the model a
 * conversation subtly different from the one it would have had — the hardest
 * class of bug to see, because both halves look right on their own.
 */

import { addMeter, usageTokens } from "./meters.mjs";

export const ENTRY_KINDS = Object.freeze(["started", "model", "tool", "stopped"]);

// ── the entries ──────────────────────────────────────────────────────────────
export const startedEntry = (o) => Object.freeze({
  kind: "started", at: o.at, tenant: o.tenant ?? null, agent: o.agent,
  model: o.model, prompt: o.prompt, limits: o.limits ?? null,
  // ── the snapshot a customer-authored run carries ──────────────────────────
  //
  // **PRESENT OR ABSENT, NEVER null-AS-A-VALUE.** A run of a code agent has no
  // snapshot at all and its entry is byte for byte what it always was; a run
  // started from an authored agent carries the instructions it was started with
  // and the conversation it was given. `undefined` is "not applicable" and a
  // stored null would be "we recorded nothing", which is a different fact — the
  // recorded cannot-tell rule, met in an entry shape.
  //
  // **THESE ARE NORMALLY WRITTEN BY `agent.send_to_agent`, NOT BY A CALLER.**
  // That function merges them over whatever this produced, from rows it read in
  // the accepting transaction, so neither a request body nor the server's own
  // earlier read can decide what a run was told. They are accepted here so this
  // stays the ONE producer of the entry shape, which is what keeps a resumed
  // conversation identical to the one the run would have had.
  ...(o.instructions === undefined ? {} : { instructions: o.instructions }),
  ...(o.history === undefined ? {} : { history: o.history }),
  // ⚠ WHICH TOOLS THIS RUN WAS ALLOWED, recorded at the moment the work was
  // accepted. It is the RUN CONFIGURATION half of the snapshot and it exists for
  // exactly one reason: a customer who changes their agent's tools while a run is
  // going must change what the NEXT run may do and never what this one may do.
  // Reading the column at execution time instead would make an in-flight run's own
  // permissions editable from the outside.
  //
  // PRESENT OR ABSENT, and here the two are further apart than anywhere else in this
  // entry: absent means "this is not an authored run, use the agent's own list", and
  // `[]` means "an authored run that may call nothing". A stored null would be a
  // third thing nobody decided.
  ...(o.tools === undefined ? {} : { tools: o.tools }),
  // WHICH authored agent, and WHICH message asked. Written here as well as in
  // `agent.send_to_agent`'s merge for one reason: that merge adds them to the
  // entry AFTER this built it, so without these two lines the SQL path and the
  // JS path would produce different entry shapes — two producers of one shape,
  // which is the exact thing this constructor exists to prevent. A local driver
  // or a verification builds the entry here and would silently lose them.
  ...(o.authoredAgent === undefined ? {} : { authoredAgent: o.authoredAgent }),
  ...(o.message === undefined ? {} : { message: o.message }),
  // ── the snapshot a DELEGATED child carries ─────────────────────────────────
  //
  // ⚠ **`agent.delegate_children` IS A THIRD PRODUCER OF THIS SHAPE, and these four
  // lines are what stop it being a second copy of it.** That function builds a child's
  // first entry in SQL, inside the transaction that files the row — so without them
  // the JS producer could not express what the SQL path writes, which is the exact
  // thing this constructor exists to prevent and is why `authoredAgent` and `message`
  // are here for `agent.send_to_agent`. A census holds the two shapes equal.
  //
  // **AND `delegatedBy` IS READ BACK TO DECIDE SOMETHING, unlike `authoredAgent`.**
  // It is what tells a finished run that it owes its parent an outcome, so it is not
  // merely for a reader tracing one run to another: it is the fact the settle is
  // gated on, taken from an append-only entry nobody can edit rather than from a row
  // somebody could update or from an argument a caller could supply.
  ...(o.delegatedBy === undefined ? {} : { delegatedBy: o.delegatedBy }),
  ...(o.delegation === undefined ? {} : { delegation: o.delegation }),
  ...(o.depth === undefined ? {} : { depth: o.depth }),
  ...(o.context === undefined ? {} : { context: o.context }),
});
export const modelEntry = (o) => Object.freeze({
  kind: "model", at: o.at, step: o.step, ms: o.ms, text: o.text ?? "",
  toolCalls: Object.freeze((o.toolCalls ?? []).map((c) => Object.freeze({ id: c.id ?? null, name: c.name ?? null, args: c.args }))),
  usage: o.usage ?? null, costMicros: o.costMicros ?? null,
});
/**
 * ONE TOOL CALL'S RESULT.
 *
 * ⚠ **`unresolved` IS A THIRD ANSWER AND IT IS NOT A KIND OF FAILURE.** `ok: false` says
 * the work did not happen; `unresolved` says nobody knows whether it did — we asked a
 * store to change something and never heard back. The two invite opposite next moves: a
 * failure invites doing it again, and an unknown invites CHECKING first. Recording an
 * unknown as a failure is a claim nothing here is entitled to make, in the direction that
 * loses somebody's data.
 *
 * It rides only when it is true, so every entry written before this exists and every
 * resolved entry written after it are byte for byte what they were.
 */
export const toolEntry = (o) => Object.freeze({
  kind: "tool", at: o.at, step: o.step, index: o.index, name: o.name ?? null,
  ms: o.ms, ok: !!o.ok, value: o.ok ? o.value : undefined,
  error: o.ok ? undefined : String(o.error ?? ""),
  ...(o.ok || o.unresolved !== true ? {} : { unresolved: true }),
});
export const stoppedEntry = (o) => Object.freeze({ kind: "stopped", at: o.at, stop: o.stop });

// ── the message shapes, in ONE place ─────────────────────────────────────────
export const userMessage = (prompt) => ({ role: "user", content: prompt });
export const assistantMessage = (text, toolCalls) =>
  (toolCalls && toolCalls.length ? { role: "assistant", content: text, toolCalls } : { role: "assistant", content: text });
export const toolMessage = (results) => ({ role: "tool", content: results });

/**
 * One tool result as the model is shown it. The SAME function serves the live
 * loop and the replay, so a resumed conversation cannot differ from the one the
 * run would have had.
 */
export const toolResultFor = (call, ok, valueOrError, unresolved) => ({
  id: call?.id ?? null, name: call?.name ?? null, ok,
  // ⚠ SAID IN THE TEXT, not only in a field beside it. A model reads the result; a flag it
  // is not shown is a flag that changes nothing about what it does next, and what it does
  // next is the whole reason to distinguish "did not happen" from "may have happened".
  result: ok ? valueOrError
    : `${unresolved === true ? "UNRESOLVED — this may or may not have happened, so check before doing it again: " : ""}${String(valueOrError ?? "")}`,
  ...(ok || unresolved !== true ? {} : { unresolved: true }),
});

/**
 * REBUILD A RUN FROM ITS LOG.
 *
 * Answers `{ status, messages, used, step, stop, pending, problems, ... }`.
 *
 * **`used.wallMs` IS WORK TIME, NOT CALENDAR TIME, and that is a decision rather
 * than a convenience.** A run that died at midnight and resumes at nine did not
 * spend nine hours working, and charging it nine hours against a wall-clock
 * budget would fail every resumed run on arrival. So the replayed wall is the SUM
 * OF THE RECORDED `ms` — the work that really happened — and the live loop adds
 * its own segment's elapsed on top. Said out loud because "wall clock" now means
 * something slightly different from what the words suggest.
 *
 * **A JUNK ENTRY IS NAMED, NEVER SKIPPED.** Entries come back from storage, which
 * means they come back from outside, which means they can be anything. Silently
 * ignoring one would rebuild a SHORTER conversation and a SMALLER bill than the
 * run really had — the meters would under-report and the model would be sent a
 * history missing a step. `problems` is how the caller finds out; a replay with
 * problems is one a caller should refuse to resume, and nothing here decides that
 * for them.
 */
export function replay(entries) {
  if (!Array.isArray(entries)) throw new TypeError("replay: entries must be an array");

  const problems = [];
  let started = null, stop = null;
  const models = new Map();            // step → the model entry
  const tools = new Map();             // step → Map(index → the tool entry)

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e === null || typeof e !== "object" || Array.isArray(e) || !ENTRY_KINDS.includes(e.kind)) {
      problems.push(`entry ${i}: not a journal entry`);
      continue;
    }
    if (e.kind === "started") {
      if (started) { problems.push(`entry ${i}: a second "started"`); continue; }
      started = e;
    } else if (e.kind === "model") {
      if (!Number.isInteger(e.step) || e.step < 1) { problems.push(`entry ${i}: model with no usable step`); continue; }
      if (models.has(e.step)) { problems.push(`entry ${i}: a second model answer for step ${e.step}`); continue; }
      models.set(e.step, e);
    } else if (e.kind === "tool") {
      if (!Number.isInteger(e.step) || !Number.isInteger(e.index)) { problems.push(`entry ${i}: tool with no usable step/index`); continue; }
      if (!tools.has(e.step)) tools.set(e.step, new Map());
      if (tools.get(e.step).has(e.index)) { problems.push(`entry ${i}: a second result for step ${e.step} tool ${e.index}`); continue; }
      tools.get(e.step).set(e.index, e);
    } else {
      if (stop) { problems.push(`entry ${i}: a second "stopped"`); continue; }
      stop = e.stop ?? null;
    }
  }

  const messages = [];
  const used = { steps: 0, toolCalls: 0, tokens: 0, costMicros: 0, wallMs: 0 };
  const pending = [];
  // `null` until an entry names a tool list, so absent and empty stay two answers.
  let snapTools = null;

  if (started) {
    // ── the conversation this run was given, before its own prompt ──────────
    //
    // **A TURN IS A QUESTION AND WHAT THE AGENT ANSWERED**, so the model sees a
    // real alternating conversation rather than a pile of consecutive user
    // turns. An answer that is absent — a run that failed, one still going, one
    // whose record was retained away — leaves the question standing on its own:
    // dropping the question because its answer is missing would send the model a
    // history that never happened.
    //
    // **A MALFORMED TURN IS NAMED, NEVER SKIPPED**, exactly as a malformed entry
    // is. The snapshot comes back from storage, so it comes from outside, and
    // silently dropping one rebuilds a SHORTER conversation than the run really
    // had — with both halves looking right on their own.
    //
    // NOTHING HERE TOUCHES A METER. This is conversation the run was handed, not
    // work it did; charging a resumed run for the history it was given would
    // make every reply more expensive than the one before it.
    const history = started.history;
    if (history !== undefined) {
      if (!Array.isArray(history)) {
        problems.push('the "started" entry\'s history is not a list, so the conversation is unknown');
      } else {
        for (let i = 0; i < history.length; i++) {
          const turn = history[i];
          if (turn === null || typeof turn !== "object" || Array.isArray(turn) || typeof turn.user !== "string" || turn.user === "") {
            problems.push(`history ${i}: not a turn`);
            continue;
          }
          messages.push(userMessage(turn.user));
          // An answer is text or it is not there. Anything else is a turn we
          // cannot read rather than a turn with no answer.
          if (turn.agent === null || turn.agent === undefined) continue;
          if (typeof turn.agent !== "string") { problems.push(`history ${i}: the answer is not text`); continue; }
          if (turn.agent !== "") messages.push(assistantMessage(turn.agent));
        }
      }
    }
    // ── which tools this run was allowed ────────────────────────────────────
    //
    // **THE SAME THREE STATES the history has, and they mean different things.**
    // Absent is "no tool snapshot", which the runner reads as the agent's own list
    // for a code agent and as NOTHING for an authored one. A list is the selection.
    // A `tools` that is present and cannot be read is a run whose PERMISSIONS are
    // unknown, and that is a problem rather than an empty selection: `problems`
    // stops the run being resumed at all, which is the only safe answer to "we
    // cannot tell what this run was allowed to do".
    const listed = started.tools;
    if (listed !== undefined) {
      if (!Array.isArray(listed)) {
        problems.push('the "started" entry\'s tools is not a list, so what the run may call is unknown');
      } else {
        const names = [];
        for (let i = 0; i < listed.length; i++) {
          // REFUSED, NEVER COERCED. `String(["echo"])` is `"echo"`, so a coercing
          // reader turns a nested list into a tool name and nothing complains.
          if (typeof listed[i] !== "string" || listed[i] === "") { problems.push(`tools ${i}: not a tool name`); continue; }
          names.push(listed[i]);
        }
        snapTools = Object.freeze(names);
      }
    }
    messages.push(userMessage(started.prompt));
    used.wallMs = 0;
  } else if (entries.length) {
    problems.push('no "started" entry, so the run\'s own prompt and tenant are unknown');
  }

  // Steps in ASCENDING ORDER rather than append order. A tool entry always
  // follows its model entry in a healthy log, but a log is evidence rather than a
  // promise, and rebuilding a conversation out of order would be worse than
  // refusing to.
  for (const step of [...models.keys()].sort((a, b) => a - b)) {
    const m = models.get(step);
    used.steps += 1;
    used.tokens = addMeter(used.tokens, usageTokens(m.usage));
    used.costMicros = addMeter(used.costMicros, m.costMicros ?? null);
    used.wallMs += typeof m.ms === "number" && m.ms >= 0 ? m.ms : 0;

    // ⚠ A STORED `toolCalls` THAT IS NOT A LIST IS NAMED, NEVER ITERATED. MEASURED before
    // this line existed: `toolCalls: "junk"` came back as FOUR pending calls named `null`
    // and four tool calls on the meter, with `problems` empty — a string is iterable by
    // index and `.length` is its character count. So a run resumed from an unreadable log
    // was billed for calls nobody made and told "cannot resume" about calls that do not
    // exist. This is the one function whose own documentation says a junk entry is named
    // rather than skipped.
    if (m.toolCalls !== undefined && !Array.isArray(m.toolCalls)) {
      problems.push(`step ${step}: the model entry's tool calls are not a list, so this step's calls are unknown`);
      messages.push(assistantMessage(m.text ?? ""));
      continue;
    }
    const calls = m.toolCalls ?? [];
    messages.push(assistantMessage(m.text ?? "", calls));
    if (!calls.length) continue;

    // Counted the way the live loop counts it — the whole batch, when the batch
    // was asked for — or a resumed run would believe it had a bigger tool budget
    // left than it does.
    used.toolCalls += calls.length;

    const got = tools.get(step) ?? new Map();
    const results = [];
    for (let index = 0; index < calls.length; index++) {
      const t = got.get(index);
      if (!t) {
        // ⚠ **THE ARGUMENTS COME FROM THE SLOT THAT IS PENDING, at the moment the slot is
        // made.** They used to be looked up later, by the call's `id`, which a model is
        // not obliged to give: `modelEntry` stores `id: c.id ?? null` and a `.find` on
        // null returns the FIRST null. MEASURED — two writes in one batch, the model
        // naming no ids, the store dying before the results were written — and on the
        // resume `forget` ran with `remember`'s arguments: the agent forgot the fact it
        // had just been told to keep, and the name it was asked to forget was never
        // touched. For a gated call the wall fails closed instead (the decision is read
        // at the right position with the wrong arguments, so `matches` is false and it
        // reads `stale`), which strands a call a person really did approve.
        //
        // Taking them HERE, off `calls[index]`, is what kills the class rather than the
        // instance: the name, the id and the arguments all come out of one object, so
        // there is no later pairing left to get wrong.
        pending.push({
          step, index, name: calls[index]?.name ?? null, id: calls[index]?.id ?? null,
          args: calls[index]?.args,
        });
        continue;
      }
      used.wallMs += typeof t.ms === "number" && t.ms >= 0 ? t.ms : 0;
      results.push(toolResultFor(calls[index], t.ok, t.ok ? t.value : t.error, t.unresolved === true));
    }
    if (results.length) messages.push(toolMessage(results));
  }

  const status = stop ? "stopped" : (started ? "running" : "new");
  return Object.freeze({
    status,
    stop: stop ?? null,
    messages,
    used: Object.freeze(used),
    step: used.steps ? Math.max(...models.keys()) : 0,
    pending: Object.freeze(pending),
    problems: Object.freeze(problems),
    prompt: started?.prompt ?? null,
    tenant: started?.tenant ?? null,
    agent: started?.agent ?? null,
    model: started?.model ?? null,
    limits: started?.limits ?? null,
    // The snapshot, read back for the runner. `null` here means this run has no
    // snapshot and the registered agent's own instructions are the ones to use.
    instructions: typeof started?.instructions === "string" && started.instructions !== "" ? started.instructions : null,
    // The tool snapshot, read back for the runner. `null` means this entry named no
    // tool list at all, which for an authored run the runner reads as NONE — the
    // fail-closed direction, and the behaviour of every run accepted before the
    // selection existed.
    //
    // ⚠ NAMED APART FROM `tools`, WHICH IN THIS SCOPE IS THE MAP OF TOOL RESULTS.
    // Returning the bare name handed every caller that Map under a field whose whole
    // job is to say which tools a run may CALL — the recorded "a re-anchor lands in a
    // scope it did not write", caught by reading the scope rather than by a test.
    tools: snapTools,
    // Which customer-authored agent and which message started this, for a reader
    // tracing one back to the other. Never used to decide anything.
    authoredAgent: typeof started?.authoredAgent === "string" ? started.authoredAgent : null,
    message: typeof started?.message === "string" ? started.message : null,
    // ⚠ WHICH PARENT THIS RUN OWES AN OUTCOME TO, and this one DECIDES something.
    // A finished child settles its delegation while it still holds its claim, and this
    // is what says it is a child at all — so a run with no such entry costs no round
    // trip, and a run that has one cannot have it edited, because the log is
    // append-only and fenced.
    //
    // **REFUSED, NEVER COERCED, AND BOTH HALVES OR NEITHER.** `String(["x"])` is
    // `"x"`, and a `delegatedBy` with no readable `delegation` beside it is half a
    // link — the settle is keyed on the CHILD's run id so it would still work, but a
    // reader handed one and not the other cannot say which row an outcome is about.
    delegatedBy: typeof started?.delegatedBy === "string" && typeof started?.delegation === "string"
      ? started.delegatedBy : null,
    delegation: typeof started?.delegatedBy === "string" && typeof started?.delegation === "string"
      ? started.delegation : null,
  });
}

// ── the limits codec: the one place `Infinity` crosses JSON ──────────────────
//
// **`JSON.stringify(Infinity)` IS `"null"`.** An unbounded limit written straight
// out therefore arrives as a null, and a reader cannot tell that null from "no
// limit was recorded" — cannot-tell wearing a value's clothes, arriving through a
// serialiser instead of through a reader. So it is written as the STRING
// `"Infinity"` and read back as the number.
//
// THE PAIR LIVES TOGETHER ON PURPOSE. An encoder in one file and a decoder in
// another is the shape where a round trip quietly stops being one: each half
// looks right, and the only thing that would notice is a test that runs both,
// which nobody writes when they are apart.

/** The marker. A string, because every other JSON scalar is a value it could be confused with. */
export const UNBOUNDED = "Infinity";

/** Limits → JSON-safe. The report arrays (`narrowed`, `refused`, `unknown`) are not bounds and are dropped. */
export function limitsToJson(limits) {
  if (limits === null || typeof limits !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(limits)) {
    if (Array.isArray(v)) continue;
    out[k] = v === Infinity ? UNBOUNDED : v;
  }
  return out;
}

/**
 * JSON → limits. `"Infinity"` becomes `Infinity` again.
 *
 * **A `null` STAYS `null` AND DOES NOT BECOME `Infinity`.** That is the whole
 * point of the marker: if a stored null could decode to "unbounded", then a limit
 * that failed to record would silently become no limit at all — the most
 * expensive possible reading of a missing value.
 */
export function limitsFromJson(stored) {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return null;
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    out[k] = v === UNBOUNDED ? Infinity : v;
  }
  return out;
}
