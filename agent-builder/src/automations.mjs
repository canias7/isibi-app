/**
 * THE WORKFLOW — an ordered list of steps, run without a model.
 *
 * This is the second executor in this product. `run.mjs` is the agent loop: a model
 * decides what to do next and every bound exists to stop it running away. Nothing
 * here decides anything — the steps are the customer's own list, in their own order,
 * and this walks it. **NO MODEL CALL AND NO CLOCK OF ITS OWN**: `now` is injected like
 * everything else in this directory, so every branch below is drivable in a test.
 *
 * **A STEP TYPE IS CODE, EXACTLY AS A TOOL IS.** A stored step is `{id, type, …}` and
 * the type resolves against the registry below or resolves to nothing. So a row in a
 * database, a request body or a customer's typing can choose AMONG the things this
 * product implements and can never describe a new one — which is the same wall
 * `agents.mjs` puts in front of tools, for the same reason.
 *
 * **FIVE KINDS, AND EACH ANSWERS SOMETHING DIFFERENT.** That is the whole of why they
 * are separate rather than one `run` with a flag:
 *
 *   `condition` — whether the rest of the workflow should happen at all. A gate.
 *   `action`    — does something, and what it answers IS the execution's result.
 *   `lookup`    — finds something and binds it to a name. NOT a result: reference
 *                 material is an input to the work, not the thing the work produced.
 *   `branch`    — picks a path. Does not stop anything; the other arm is skipped.
 *   `pause`     — suspends the execution and releases the worker.
 *
 * That split is what makes "a condition that does not match is SKIPPED, not FAILED" a
 * property of the design rather than a string somebody remembered to use — and what
 * keeps a retrieved excerpt out of the answer a customer reads.
 *
 * ── RESUMABLE, AND THAT IS THE CHANGE THIS FILE'S OWN NOTE PREDICTED ────────────
 *
 * The note that used to sit here said a `wait` or an `approval` was the step type that
 * would change the storage: an execution that pauses spans transactions, so the
 * outcomes can no longer be written in one statement with the stop — they become
 * journal entries, each fenced, and the execution needs a resumable POSITION. That is
 * what happened, and it is a migration rather than a tweak
 * (`20260917…_agent_workflow_progress.sql`).
 *
 * So `runWorkflow` takes a `position`, the values bound so far, the outcomes already
 * recorded and any approval decisions, and continues. **EVERY COMPLETED STEP IS
 * CHECKPOINTED THROUGH AN INJECTED `record` BEFORE THE NEXT ONE STARTS**, which is what
 * makes "resuming cannot repeat completed actions" a property rather than a hope: the
 * position in the database is always at or ahead of the work really done.
 *
 * **IT COMPUTES NO INSTANT, DELIBERATELY.** A pause answers what it is waiting FOR —
 * `for 30 minutes`, `until 09:00 in Europe/London` — and the DATABASE resolves that to
 * an instant, because `agent.automation_next_at` is the only thing in this product with
 * a time zone database behind it. A second copy of that arithmetic in JavaScript is the
 * copy that would drift, and it would drift about when somebody's work runs.
 */

/** The only kinds of step there are, and a step declares which it is. */
export const STEP_KINDS = Object.freeze(["condition", "action", "lookup", "branch", "pause"]);

/**
 * WHAT A STEP IS CONFIGURED WITH, DECLARED RATHER THAN IMPLIED.
 *
 * `read` is the authority on meaning and always will be — it is what refuses a day that
 * is not a day. `fields` is the SHAPE of the same thing, and it exists because two other
 * places need it and neither can read a function body: the browser draws a form from it,
 * and the site builder's own copy of this catalog is censused against it field by field.
 * A `read` that quietly started accepting a sixth key would otherwise be invisible to
 * both.
 */
export const FIELD_KINDS = Object.freeze(["text", "days", "choice", "number", "time", "name"]);

/**
 * How many steps one workflow may hold.
 *
 * **A COPY OF THE COLUMN'S OWN CHECK CONSTRAINT, DECLARED AS ONE.** A CHECK cannot
 * read this file and this file cannot read SQL, so the number exists twice — and a
 * guard reads it back out of the migration and compares, which is what turns a drift
 * into a red run rather than into a workflow the database refuses to store.
 */
export const MAX_WORKFLOW_STEPS = 20;

/** Sunday first, because that is what `Date.prototype.getUTCDay` answers. */
export const WEEKDAYS = Object.freeze(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

/**
 * What became of one step. Four words, and each needs a different thing said about it.
 *
 * `skipped` is the one that earns its place twice over: a condition that did not match
 * is not a failure and must never read as one, and neither is the arm of a branch the
 * execution did not take. `why` is what tells those two apart.
 *
 * `waiting` is the outcome of a step that has suspended and not yet finished — the one
 * outcome that is not final, and the one the screen needs in order to say what is being
 * waited for rather than showing a run that has simply stopped moving.
 */
export const STEP_OUTCOMES = Object.freeze(["ran", "skipped", "failed", "waiting"]);

/**
 * Why an execution ended. The shape `agent.runs.stop` holds.
 *
 * **`rejected` IS NOT A FAILURE, and that is why it is its own word.** Somebody looked
 * at the work and said no; nothing went wrong, and reporting it as an error would tell
 * an account their automation is broken when it did exactly what they asked.
 */
export const STOP_REASONS = Object.freeze(["done", "skipped", "failed", "rejected"]);

/** What a pause is waiting for. Two, and they resume through different doors. */
export const PAUSE_KINDS = Object.freeze(["wait", "approval"]);

/** How an approval can be answered, and what a timeout may be configured to mean. */
export const VERDICTS = Object.freeze(["approved", "rejected"]);
export const TIMEOUT_OUTCOMES = Object.freeze(["approve", "reject", "fail"]);

const isText = (v) => typeof v === "string" && v.trim() !== "";

import { REF_NAME, refsIn, fillRefs } from "./workflow-refs.mjs";
export { REF_NAME, refsIn, fillRefs, valueText } from "./workflow-refs.mjs";

// ── the bounds, all in one place ─────────────────────────────────────────────
//
// ⚠ DECLARED ABOVE THE STEPS THAT READ THEM, not below the registry. A step's `read`
// closes over them and `fields` is evaluated at DEFINITION time, so a `const` declared
// after the step that names it is a `ReferenceError` on LOAD — the temporal dead zone,
// in the one position `node --check` cannot see. It has already cost this file once.

/** How long a note may be. */
export const MAX_NOTE = 2000;
/** How long the text on either side of a branch test may be. */
export const MAX_TEST = 400;
/** How long a search may be, and how many excerpts one lookup may bind. */
export const MAX_QUERY = 200;
export const MAX_EXCERPTS = 5;
/** What somebody is asked when an approval comes up. */
export const MAX_ASK = 400;
/**
 * The longest a pause may last, and both are bounds on a PROMISE rather than on a
 * resource: a wait is free while it waits, but an execution that resumes in a year is
 * one nobody is still expecting, and a work row nothing will claim for a year is
 * indistinguishable from one that is lost.
 */
export const MAX_WAIT_MINUTES = 60 * 24 * 14;   // a fortnight
export const MAX_APPROVAL_HOURS = 24 * 14;      // the same fortnight, in the unit a person picks

/**
 * Declare a step type.
 *
 * **IT THROWS WHEN A PART IS MISSING**, at import, which is the one moment throwing is
 * cheap — a half-declared step that loads is a step that fails later, somewhere else,
 * in a way that does not name this file.
 *
 * `label` and `does` are the WORDS A PERSON READS when choosing a step, kept here
 * beside the behaviour rather than only in the browser, so a type cannot be offered
 * under a description of something else.
 *
 * **A STEP WITH NOTHING TO CONFIGURE MUST SAY SO (`configless`).** `fields` is what the
 * form draws, so an empty one used to be refused outright: a step the form cannot render
 * is a dead control. But `otherwise` and `end` really are markers with nothing to set, and
 * the honest answer is a DECLARATION rather than a relaxed rule — an empty `fields` on a
 * step that forgot them still throws.
 */
export function defineStep(spec = {}) {
  const { type, kind, label, does, fields, read, run, configless } = spec;
  if (!isText(type)) throw new TypeError("defineStep: type must be a non-empty string");
  if (!STEP_KINDS.includes(kind)) throw new TypeError(`defineStep(${type}): kind must be one of ${STEP_KINDS.join(", ")}`);
  if (!isText(label)) throw new TypeError(`defineStep(${type}): label must be a non-empty string`);
  if (!isText(does)) throw new TypeError(`defineStep(${type}): does must be a non-empty string — it is what a person reads when choosing this`);
  if (!Array.isArray(fields)) throw new TypeError(`defineStep(${type}): fields must say what this step is configured with`);
  if (!fields.length && configless !== true) {
    throw new TypeError(`defineStep(${type}): a step with no fields must declare configless: true, so an empty list is deliberate rather than forgotten`);
  }
  if (fields.length && configless === true) {
    throw new TypeError(`defineStep(${type}): configless says there is nothing to configure, so it cannot also declare fields`);
  }
  for (const f of fields) {
    if (!isText(f?.name)) throw new TypeError(`defineStep(${type}): every field needs a name`);
    if (!FIELD_KINDS.includes(f?.kind)) throw new TypeError(`defineStep(${type}): field ${f?.name} must be one of ${FIELD_KINDS.join(", ")}`);
    // A CHOICE WITH NO OPTIONS IS A SELECT WITH NOTHING IN IT — a dead control the form
    // would draw perfectly. The options are also what the site builder's copy is
    // censused against, so they cannot be left to the browser.
    if (f.kind === "choice" && (!Array.isArray(f.options) || !f.options.length)) {
      throw new TypeError(`defineStep(${type}): field ${f.name} is a choice and must list its options`);
    }
    // ⚠ A FIELD THAT ONLY APPLIES SOMETIMES SAYS SO, AND SAYS IT ABOUT A SIBLING THAT
    // REALLY EXISTS. `when: {mode: ["for"]}` is what lets the form hide a control the
    // answer has made irrelevant and lets a validator refuse a value nothing will read —
    // and a `when` naming a field that is not there is a condition nothing can satisfy,
    // so the step would be unfillable with no error anybody could see.
    if (f.when !== undefined) {
      if (!f.when || typeof f.when !== "object" || Array.isArray(f.when)) {
        throw new TypeError(`defineStep(${type}): field ${f.name} has a "when" that is not a condition`);
      }
      for (const [on, allowed] of Object.entries(f.when)) {
        if (!fields.some((o) => o?.name === on)) {
          throw new TypeError(`defineStep(${type}): field ${f.name} depends on ${on}, which is not one of its fields`);
        }
        if (!Array.isArray(allowed) || !allowed.length) {
          throw new TypeError(`defineStep(${type}): field ${f.name}'s "when" must list the values of ${on} it applies to`);
        }
      }
    }
  }
  if (typeof read !== "function") throw new TypeError(`defineStep(${type}): read must be a function`);
  if (typeof run !== "function") throw new TypeError(`defineStep(${type}): run must be a function`);
  return Object.freeze({
    kind: "step", type, stepKind: kind, label, does,
    configless: configless === true,
    fields: Object.freeze(fields.map((f) => Object.freeze({
      ...f,
      ...(f.options ? { options: Object.freeze([...f.options]) } : {}),
      ...(f.when ? { when: Object.freeze(Object.fromEntries(
        Object.entries(f.when).map(([k, vs]) => [k, Object.freeze([...vs])]))) } : {}),
    }))),
    read, run,
  });
}

/**
 * The `out` field, written once and shared by every step that binds a value.
 *
 * **BINDING IS DECLARED BY THE FIELD AND NOT BY THE KIND**, because `readWorkflow` has
 * to know which names a workflow can produce in order to refuse a reference to one it
 * cannot — and it reads that off the cleaned config, which only exists because the field
 * does. One object, so the form draws the same control everywhere and the census has one
 * shape to compare.
 */
const OUT_FIELD = Object.freeze({ name: "out", kind: "name", required: false });

/** Read an `out` name, which is optional everywhere and refused rather than repaired. */
function readOut(raw) {
  if (raw?.out === undefined || raw?.out === null || raw?.out === "") return { out: null };
  if (typeof raw.out !== "string") return { error: "the name to save the answer under didn't arrive as a name" };
  const out = raw.out.trim().toLowerCase();
  if (!REF_NAME.test(out)) {
    return { error: `"${raw.out}" can't be a name — use lower-case letters, digits and underscores, starting with a letter` };
  }
  return { out };
}

/** A whole number inside a range, refused rather than coerced or clamped. */
function readNumber(raw, { name, min, max }) {
  const v = raw;
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
    return { error: `${name} has to be a whole number` };
  }
  if (v < min || v > max) return { error: `${name} has to be between ${min} and ${max}` };
  return { value: v };
}

/** One of a fixed set, by exact match. Never the first option as a default. */
function readChoice(raw, { name, options }) {
  if (typeof raw !== "string" || !options.includes(raw)) {
    return { error: `${name} has to be one of: ${options.join(", ")}` };
  }
  return { value: raw };
}

/** `HH:MM`, whole minutes, because that is what the form offers and the column stores. */
function readTime(raw, { name }) {
  if (typeof raw !== "string") return { error: `${name} has to be a time like 09:00` };
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  if (!m) return { error: `${name} has to be a time like 09:00, on the 24-hour clock` };
  return { value: `${m[1]}:${m[2]}` };
}

/**
 * Text inside a bound, trimmed, with emptiness refused by the caller's own sentence.
 *
 * **`what` IS COMPELLED, because a refusal has to name the thing that was too long.**
 * "That's longer than this field can be" is true of every text box on the form, so a
 * person reading it on a nine-step workflow has to guess which one — and the first draft
 * of this shared reader said exactly that, losing a message the single-purpose one had.
 */
function readTextField(raw, { what, max }) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { empty: true };
  if (text.length > max) return { error: `${what} is longer than ${what} can be (${max} characters)` };
  return { text };
}

// ── the registry ────────────────────────────────────────────────────────────

/**
 * ONLY ON THESE DAYS.
 *
 * **WHICH DAY IT IS, IS ASKED OF THE EXECUTION AND NOT OF THE CLOCK.** A scheduled
 * execution carries the local DATE it is an occurrence of, so a catch-up run an hour
 * late still asks about the day it was FOR — which is the only reading that makes
 * "every Monday" mean what it says. A manual run has no occurrence, so it asks what
 * day it is now in the automation's own zone.
 */
const weekday = defineStep({
  type: "weekday",
  kind: "condition",
  label: "Only on certain days",
  does: "Carry on only on the days you pick. On any other day the rest of the workflow is skipped.",
  fields: [{ name: "days", kind: "days", required: true }],
  read: (raw) => {
    const days = raw?.days;
    if (!Array.isArray(days)) return { error: "pick which days it should run on" };
    if (!days.length) return { error: "pick at least one day, or leave this step out" };
    const picked = [];
    for (const d of days) {
      // REFUSED, NEVER COERCED. `String(["mon"])` is `"mon"`, so a coercing reader
      // turns a nested list into a day and nothing complains.
      if (typeof d !== "string") return { error: "one of the days didn't arrive as a day" };
      const name = d.trim().toLowerCase();
      if (!WEEKDAYS.includes(name)) return { error: `there is no day called ${d}` };
      if (!picked.includes(name)) picked.push(name);
    }
    // THE WEEK'S OWN ORDER, not the order they were ticked, so saving one selection
    // twice stores the same bytes both times.
    return { config: { days: WEEKDAYS.filter((d) => picked.includes(d)) } };
  },
  run: (config, ctx) => {
    const today = ctx.weekday;
    const met = config.days.includes(today);
    return {
      met,
      why: met
        ? `${dayName(today)} is one of the days this runs on`
        : `${dayName(today)} isn't one of the days this runs on`,
    };
  },
});

/**
 * SAVE A NOTE TO THE RESULTS.
 *
 * The one real internal action this product has, and it is real: what it answers
 * becomes the execution's own result, stored in the run's stop and shown in the
 * history. **NOTHING ABOUT IT IS A PLACEHOLDER** — there is no model, no provider and
 * nothing pretending to answer. What it writes is the customer's own sentence with
 * their own values put into it.
 */
const note = defineStep({
  type: "note",
  kind: "action",
  label: "Save a note",
  does: "Write a line into this automation's results, so the run has something to show. Put {{a name}} anywhere to use an input or an earlier step's answer.",
  fields: [{ name: "text", kind: "text", required: true, max: MAX_NOTE, refs: true }, OUT_FIELD],
  read: (raw) => {
    const t = readTextField(raw?.text, { what: "that note", max: MAX_NOTE });
    if (t.error) return { error: t.error };
    if (t.empty) return { error: "say what the note should say" };
    const o = readOut(raw);
    if (o.error) return { error: o.error };
    return { config: { text: t.text, out: o.out } };
  },
  run: (config) => ({ result: config.text }),
});

/**
 * IF — the one step that picks a path rather than stopping.
 *
 * **IT IS FLAT, AND THAT IS THE WHOLE DESIGN DECISION.** An `if` opens an arm, an
 * `otherwise` begins the other one and an `end` closes both, exactly as a linear
 * program does. So the editor stays what it already is — an ordered list with add, move
 * and remove — and there is no canvas, no nesting in the stored shape, and no second
 * way to reach a step. Nesting still works, because the three are matched by DEPTH.
 *
 * ⚠ **AN `if` THAT DOES NOT MATCH IS `ran`, NOT `skipped`** — it did its job, which was
 * to choose. What gets `skipped` is the arm nobody took, and its `why` says so. A
 * condition and a branch are different kinds precisely because that reading is
 * different, and collapsing them would report every branch as a workflow that stopped.
 */
const TESTS = Object.freeze(["is", "is not", "contains", "is empty", "is not empty"]);

const branchIf = defineStep({
  type: "if",
  kind: "branch",
  label: "If …",
  does: "Compare a value — an input, or an earlier step's answer — and run the steps under it only when the comparison holds. Put an \"Otherwise\" and an \"End\" below it.",
  fields: [
    { name: "left", kind: "text", required: true, max: MAX_TEST, refs: true },
    { name: "op", kind: "choice", required: true, options: TESTS },
    { name: "right", kind: "text", required: true, max: MAX_TEST, refs: true, when: { op: ["is", "is not", "contains"] } },
  ],
  read: (raw) => {
    const left = readTextField(raw?.left, { what: "the value being compared", max: MAX_TEST });
    if (left.error) return { error: left.error };
    if (left.empty) return { error: "say which value to compare — {{a name}} usually" };
    const op = readChoice(raw?.op, { name: "the comparison", options: TESTS });
    if (op.error) return { error: op.error };
    const needsRight = op.value === "is" || op.value === "is not" || op.value === "contains";
    const right = readTextField(raw?.right, { what: "what it is compared against", max: MAX_TEST });
    if (right.error) return { error: right.error };
    if (needsRight && right.empty) return { error: `"${op.value}" needs something to compare against` };
    // AN UNUSED SIDE IS DROPPED RATHER THAN STORED, so saving "is empty" twice stores
    // the same bytes and the form cannot show a value the comparison ignores.
    return { config: { left: left.text, op: op.value, right: needsRight ? right.text : null } };
  },
  run: (config) => {
    // CASE AND SURROUNDING SPACE ARE IGNORED, deliberately: the values being compared
    // are somebody's own typing on both sides, and "Formal" not matching "formal" is a
    // bug report rather than a feature.
    const fold = (s) => String(s ?? "").trim().toLowerCase();
    const l = fold(config.left);
    const r = fold(config.right);
    let met;
    if (config.op === "is") met = l === r;
    else if (config.op === "is not") met = l !== r;
    else if (config.op === "contains") met = r !== "" && l.includes(r);
    else if (config.op === "is empty") met = l === "";
    else met = l !== "";
    const said = config.right === null ? `"${config.left}" ${config.op}` : `"${config.left}" ${config.op} "${config.right}"`;
    return { met, why: met ? `${said} — so the steps under "if" ran` : `${said} is not so — the steps under "if" were skipped` };
  },
});

const branchOtherwise = defineStep({
  type: "otherwise",
  kind: "branch",
  label: "Otherwise …",
  does: "Begins the other arm of the \"If\" above it. The steps under this one run only when the comparison did not hold.",
  fields: [],
  configless: true,
  read: () => ({ config: {} }),
  run: () => ({}),
});

const branchEnd = defineStep({
  type: "end",
  kind: "branch",
  label: "End of the if",
  does: "Closes the \"If\" above it. Everything after this runs either way.",
  fields: [],
  configless: true,
  read: () => ({ config: {} }),
  run: () => ({}),
});

/**
 * WAIT — for a while, or until a time of day.
 *
 * **IT COMPUTES NO INSTANT.** It answers what it is waiting FOR and the database
 * resolves that, through `agent.automation_next_at` for a time of day — the only thing
 * in this product with a time zone database behind it. A JavaScript copy of that
 * arithmetic would be the copy that drifts, and it would drift about when somebody's
 * work runs.
 *
 * ⚠ **A SECOND DELIVERY BEFORE THE TIME RE-PAUSES AND DOES NOT RESTART THE CLOCK.**
 * The deadline already stored is the authority; this step says only "still waiting".
 * Resolving `for 30 minutes` again from now would let a spurious delivery extend a wait
 * indefinitely — a duplicate event doing harm, which is the one thing it must not do.
 */
const WAIT_MODES = Object.freeze(["for", "until"]);

const wait = defineStep({
  type: "wait",
  kind: "pause",
  label: "Wait",
  does: "Pause here for a while, or until a time of day, and carry on afterwards. Nothing is held open while it waits.",
  fields: [
    { name: "mode", kind: "choice", required: true, options: WAIT_MODES },
    { name: "minutes", kind: "number", required: true, min: 1, max: MAX_WAIT_MINUTES, when: { mode: ["for"] } },
    { name: "at", kind: "time", required: true, when: { mode: ["until"] } },
  ],
  read: (raw) => {
    const mode = readChoice(raw?.mode, { name: "the kind of wait", options: WAIT_MODES });
    if (mode.error) return { error: mode.error };
    if (mode.value === "for") {
      const m = readNumber(raw?.minutes, { name: "the number of minutes to wait", min: 1, max: MAX_WAIT_MINUTES });
      if (m.error) return { error: m.error };
      return { config: { mode: "for", minutes: m.value, at: null } };
    }
    const t = readTime(raw?.at, { name: "the time to wait until" });
    if (t.error) return { error: t.error };
    return { config: { mode: "until", minutes: null, at: t.value } };
  },
  run: (config, ctx) => {
    const said = config.mode === "for"
      ? `waiting ${config.minutes} minute${config.minutes === 1 ? "" : "s"}`
      : `waiting until ${config.at} (${ctx.zone})`;
    if (!ctx.resume) return { waiting: { kind: "wait", ...config }, why: said };
    // THE DEADLINE IS THE DATABASE'S ANSWER, and `null` is cannot-tell rather than
    // "now": a row whose instant could not be read must not be treated as due, or a
    // wait somebody asked for would be no wait at all.
    const until = ctx.resume.waitUntil;
    if (typeof until !== "number" || !Number.isFinite(until)) {
      return { failed: "this wait has no deadline recorded, so it cannot be told whether it is over" };
    }
    if (ctx.now < until) return { waiting: { kind: "wait", ...config }, why: `${said} — not yet` };
    return { done: true, why: `${said} — the wait is over` };
  },
});

/**
 * APPROVAL — a wait whose resume is a person.
 *
 * **THE TIMEOUT OUTCOME IS CONFIGURED AND IS NEVER A DEFAULT.** Every one of the three
 * is right for some workflow and wrong for others: carrying on unapproved, treating
 * silence as no, and stopping as a failure somebody has to look at. Choosing on the
 * customer's behalf is choosing which way their work goes wrong, so `on_timeout` is
 * compelled and a value this deployment does not recognise is refused by name.
 *
 * **THE DECISION IS READ FROM THE EXECUTION'S OWN RECORD, never from the request that
 * resumed it.** Ownership is enforced where the decision is WRITTEN
 * (`agent.decide_automation_approval` puts the tenant in its filter), so by the time it
 * reaches this step it is a recorded fact about this account's own execution — and a
 * duplicate press is absorbed there, once, rather than re-decided here.
 */
const approval = defineStep({
  type: "approval",
  kind: "pause",
  label: "Wait for approval",
  does: "Pause and ask to be approved or rejected before carrying on. Say what happens if nobody answers in time.",
  fields: [
    { name: "ask", kind: "text", required: true, max: MAX_ASK, refs: true },
    { name: "hours", kind: "number", required: true, min: 1, max: MAX_APPROVAL_HOURS },
    { name: "on_timeout", kind: "choice", required: true, options: TIMEOUT_OUTCOMES },
  ],
  read: (raw) => {
    const ask = readTextField(raw?.ask, { what: "what is being approved", max: MAX_ASK });
    if (ask.error) return { error: ask.error };
    if (ask.empty) return { error: "say what is being approved" };
    const hours = readNumber(raw?.hours, { name: "how many hours to wait for an answer", min: 1, max: MAX_APPROVAL_HOURS });
    if (hours.error) return { error: hours.error };
    const on = readChoice(raw?.on_timeout, { name: "what happens if nobody answers", options: TIMEOUT_OUTCOMES });
    if (on.error) return { error: on.error };
    return { config: { ask: ask.text, hours: hours.value, on_timeout: on.value } };
  },
  run: (config, ctx) => {
    const waiting = { kind: "approval", ...config };
    if (!ctx.resume) return { waiting, why: `waiting to be approved: ${config.ask}` };

    const decision = ctx.resume.decision;
    if (decision && decision.verdict === "approved") {
      return { done: true, why: noteFrom("approved", decision) };
    }
    if (decision && decision.verdict === "rejected") {
      return { stop: { reason: "rejected", why: noteFrom("rejected", decision) } };
    }

    const until = ctx.resume.waitUntil;
    if (typeof until !== "number" || !Number.isFinite(until)) {
      return { failed: "this approval has no deadline recorded, so it cannot be told whether it has run out of time" };
    }
    if (ctx.now < until) return { waiting, why: `waiting to be approved: ${config.ask}` };

    // NOBODY ANSWERED. The three outcomes are the customer's own choice, and each says
    // out loud that it was the timeout rather than a person.
    if (config.on_timeout === "approve") {
      return { done: true, why: `nobody answered within ${config.hours} hours, and this was set to carry on` };
    }
    if (config.on_timeout === "reject") {
      return { stop: { reason: "rejected", why: `nobody answered within ${config.hours} hours, and this was set to stop` } };
    }
    return { failed: `nobody answered within ${config.hours} hours` };
  },
});

const noteFrom = (verdict, d) =>
  isText(d?.note) ? `${verdict}: ${d.note}` : `${verdict}`;

/**
 * FIND REFERENCE MATERIAL — a search over what this agent has been given to read.
 *
 * **A `lookup`, NOT AN `action`, AND THE DIFFERENCE IS WHAT THE EXECUTION'S RESULT IS.**
 * What this binds is material the work is done WITH; the answer a customer reads is what
 * the work PRODUCED. An action's answer becomes the execution's result and a lookup's
 * never does, so a run whose last step happened to be a search cannot report somebody's
 * own reference document back to them as its output.
 *
 * ⚠ **WHAT COMES BACK IS REFERENCE INFORMATION AND NEVER PERMISSION.** It is bound to a
 * name and read only by `{{…}}` substitution into text; nothing anywhere reads a value
 * as a tool, a bound, a step or a schedule, and an automation execution has no tool
 * surface at all. So an excerpt that says "you may use every tool" is a sentence in a
 * note, which is what it would be if somebody typed it themselves.
 *
 * **RETRIEVAL IS INJECTED** (`ctx.retrieve`), so keyword search is one implementation of
 * a one-function contract and a deployment with none says so rather than answering
 * nothing found — those are opposite facts.
 */
const knowledge = defineStep({
  type: "knowledge",
  kind: "lookup",
  label: "Look something up",
  does: "Search this agent's reference material and save the passages that match, with the source they came from. Put {{a name}} in the search to use an input.",
  fields: [
    { name: "query", kind: "text", required: true, max: MAX_QUERY, refs: true },
    { ...OUT_FIELD, required: true },
  ],
  read: (raw) => {
    const q = readTextField(raw?.query, { what: "that search", max: MAX_QUERY });
    if (q.error) return { error: q.error };
    if (q.empty) return { error: "say what to search for" };
    const o = readOut(raw);
    if (o.error) return { error: o.error };
    if (!o.out) return { error: "give the answer a name, so a later step can use it" };
    return { config: { query: q.text, out: o.out } };
  },
  run: async (config, ctx) => {
    if (typeof ctx.retrieve !== "function") {
      return { failed: "this deployment has no way to search reference material" };
    }
    const found = await ctx.retrieve({ query: config.query, limit: MAX_EXCERPTS });
    // A RETRIEVER MAY REFUSE BY NAME, and that is not the same as finding nothing. An
    // execution accepted before reference material existed has no agent recorded to search,
    // and answering "found nothing" for it would be a silent empty in the one place a
    // customer would read it as "there is nothing in my documents about this".
    if (isText(found?.error)) return { failed: found.error };
    const excerpts = Array.isArray(found?.excerpts) ? found.excerpts : [];
    if (!excerpts.length) {
      return { value: "", note: `searched for "${config.query}" and found nothing`, sources: [] };
    }
    const sources = excerpts.map((e) => ({
      title: isText(e?.title) ? e.title : "(untitled)",
      version: Number.isInteger(e?.version) ? e.version : null,
    }));
    // THE SOURCE NAME TRAVELS WITH THE TEXT, in the value itself and not only in the
    // outcome — because the value is what ends up quoted in a note, and an excerpt with
    // no source is an assertion nobody can check.
    const value = excerpts
      .map((e, i) => `${sources[i].title}: ${isText(e?.text) ? e.text.trim() : ""}`)
      .join("\n");
    return {
      value,
      note: `searched for "${config.query}" and found ${excerpts.length} passage${excerpts.length === 1 ? "" : "s"} in ${new Set(sources.map((s) => s.title)).size} source${new Set(sources.map((s) => s.title)).size === 1 ? "" : "s"}`,
      sources,
    };
  },
});

/**
 * REMEMBER — read one saved fact or preference.
 *
 * **THE MEMORIES ARE THE ONES SNAPSHOTTED AT ACCEPTANCE, with their versions**, so a
 * correction reaches the NEXT execution and can never change one already under way —
 * the same rule the workflow itself and the instruction snapshot follow. Which versions
 * a run used is therefore a recorded fact rather than something to infer from
 * timestamps.
 *
 * **NOTHING REMEMBERED YET IS AN ANSWER, NOT A FAILURE.** An empty value is a real state
 * of the world and `if {{tone}} is empty` is the natural thing to write about it; the
 * outcome says which key found nothing, so the emptiness is never silent.
 */
const memory = defineStep({
  type: "memory",
  kind: "lookup",
  label: "Use something remembered",
  does: "Read one of this agent's saved facts or preferences and save it under a name a later step can use.",
  fields: [
    { name: "key", kind: "name", required: true },
    { ...OUT_FIELD, required: true },
  ],
  read: (raw) => {
    const key = typeof raw?.key === "string" ? raw.key.trim().toLowerCase() : "";
    if (!key) return { error: "say which saved fact to use" };
    if (!REF_NAME.test(key)) {
      return { error: `"${raw.key}" can't be the name of a saved fact — use lower-case letters, digits and underscores, starting with a letter` };
    }
    const o = readOut(raw);
    if (o.error) return { error: o.error };
    if (!o.out) return { error: "give the answer a name, so a later step can use it" };
    return { config: { key, out: o.out } };
  },
  run: (config, ctx) => {
    const bag = ctx.memory && typeof ctx.memory === "object" && !Array.isArray(ctx.memory) ? ctx.memory : {};
    if (!Object.hasOwn(bag, config.key)) {
      return { value: "", note: `nothing is remembered under "${config.key}" yet`, sources: [] };
    }
    const entry = bag[config.key];
    const value = typeof entry?.value === "string" ? entry.value : "";
    const version = Number.isInteger(entry?.version) ? entry.version : null;
    return {
      value,
      note: `used what is remembered under "${config.key}"`,
      sources: [{ key: config.key, version }],
    };
  },
});

/**
 * THE CATALOG. Built last, from the steps above, so adding one is adding it here
 * rather than remembering to — and a stored `type` can only ever name what is in it.
 *
 * **THE ORDER IS THE ORDER THE FORM OFFERS THEM IN**, which is why the two branch
 * markers sit beside the `if` they belong to rather than at the end.
 */
export const AUTOMATION_STEPS = Object.freeze([
  weekday, branchIf, branchOtherwise, branchEnd, wait, approval, knowledge, memory, note,
]);

/** The catalog's type names, DERIVED, so nothing holds a second copy of the list. */
export const STEP_TYPES = Object.freeze(AUTOMATION_STEPS.map((s) => s.type));

/** By name, for the one lookup everything does. */
export function stepRegistry(steps = AUTOMATION_STEPS) {
  const m = new Map();
  for (const s of steps) {
    if (m.has(s.type)) throw new TypeError(`stepRegistry: two steps called ${s.type}`);
    m.set(s.type, s);
  }
  return m;
}

const dayName = (d) => ({
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
}[d] ?? d);

// ── dates, without a time zone library ──────────────────────────────────────

/**
 * The local date in a named zone, as `YYYY-MM-DD`.
 *
 * **`Intl` IS THE TIME ZONE DATABASE HERE**, and it is asked for the parts rather than
 * for a formatted string, because a locale's own date format is not a contract. A zone
 * this runtime does not know THROWS, which is what makes the caller's fallback a
 * decision rather than a silent wrong day.
 */
export function localDate(at, zone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(at));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The weekday of a `YYYY-MM-DD` date, as one of `WEEKDAYS`.
 *
 * **READ AS UTC ON PURPOSE.** A bare date has no time and no zone; parsing it in the
 * runtime's local time would make the answer depend on where the Worker happens to be
 * running, which is the one thing a date must not do. `Date.UTC` has no such opinion.
 */
export function weekdayOf(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // A DATE THAT DOES NOT EXIST IS NOT A DAY. `Date.UTC(2026, 1, 31)` rolls into March
  // rather than refusing, so the round trip is what catches `2026-02-31`.
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return WEEKDAYS[d.getUTCDay()];
}

/**
 * Which day this execution is about, and where.
 *
 * **THE OCCURRENCE WINS WHENEVER THERE IS ONE.** A scheduled execution is FOR a local
 * date, and a catch-up that runs an hour after midnight must still be about the day it
 * was scheduled for — otherwise "every Monday" quietly becomes "most Mondays".
 *
 * **NO ZONE MEANS UTC, AND IT SAYS SO.** An automation with no zone has never been told
 * where it lives; guessing the Worker's locality would be inventing one.
 */
export function executionDay({ occurrence, zone, now }) {
  if (occurrence) {
    const day = weekdayOf(occurrence);
    if (day) return { date: occurrence, weekday: day, zone: zone ?? "UTC", from: "occurrence" };
  }
  const where = isText(zone) ? zone : "UTC";
  let date;
  try { date = localDate(now, where); }
  catch { date = localDate(now, "UTC"); }
  return { date, weekday: weekdayOf(date), zone: where, from: "now" };
}

// ── the branch structure ────────────────────────────────────────────────────

/**
 * Match every `if` to its `otherwise` and its `end`, by DEPTH.
 *
 * **ONE IMPLEMENTATION, READ AT SAVE TIME AND AT RUN TIME.** `readWorkflow` calls it to
 * refuse an unbalanced list by name, and `runWorkflow` calls it to know where to jump.
 * Two copies would let a workflow save cleanly and then jump somewhere else.
 *
 * **THE STRUCTURE IS NOT STORED**, deliberately: it is a pure function of the types in
 * order, so storing it would be a second copy of the step list that a later edit could
 * leave behind. Recomputing it costs one pass over at most twenty entries.
 */
export function branchMap(steps) {
  const map = new Map();
  const open = [];
  const list = Array.isArray(steps) ? steps : [];
  for (let i = 0; i < list.length; i++) {
    const type = list[i]?.type;
    const at = i + 1;
    if (type === "if") {
      open.push({ at: i, elseAt: null });
      map.set(i, { kind: "if", elseAt: null, endAt: null });
    } else if (type === "otherwise") {
      const top = open[open.length - 1];
      if (!top) return { error: `step ${at}: "Otherwise" has no "If" above it` };
      if (top.elseAt !== null) return { error: `step ${at}: that "If" already has an "Otherwise"` };
      top.elseAt = i;
      map.get(top.at).elseAt = i;
      map.set(i, { kind: "otherwise", ifAt: top.at, endAt: null });
    } else if (type === "end") {
      const top = open.pop();
      if (!top) return { error: `step ${at}: "End of the if" has no "If" above it` };
      map.get(top.at).endAt = i;
      if (top.elseAt !== null) map.get(top.elseAt).endAt = i;
      map.set(i, { kind: "end", ifAt: top.at });
    }
  }
  if (open.length) {
    return { error: `step ${open[open.length - 1].at + 1}: that "If" has no "End of the if" below it` };
  }
  return { map };
}

// ── reading a stored workflow ───────────────────────────────────────────────

/** `s4` → 3. The id is minted from the position, so this is exact and not a guess. */
export function indexOfId(id) {
  const m = /^s(\d+)$/.exec(String(id ?? ""));
  if (!m) return -1;
  return Number(m[1]) - 1;
}

/**
 * Validate a whole list of steps against the registry.
 *
 * **THE ID IS MINTED FROM THE POSITION AND NEVER TAKEN FROM THE CALLER.** An id exists
 * so an outcome can name the step it is about, and within one stored workflow the
 * position is exactly that — stable, unique by construction, and impossible to
 * collide. Accepting one would be a second identity for the same thing and a
 * uniqueness rule to enforce.
 *
 * **IT REFUSES BY NAME AND NEVER SHORTENS.** A workflow quietly missing the step it
 * could not read is a workflow that looks saved and does something else.
 *
 * **A REFERENCE TO A NAME NOTHING CAN PRODUCE IS REFUSED HERE, while it is still
 * somebody's form and not a failed run.** `inputs` is the declared input names and the
 * `out` names of EARLIER steps are added as it goes, so a forward reference is refused
 * too. **The one thing it deliberately does not do is trace which arm of a branch runs**:
 * a name bound only inside an arm CAN be produced, so it passes here and fails at run
 * time naming itself if that arm did not run. Refusing it would forbid the ordinary
 * shape where both arms bind the same name.
 */
export function readWorkflow(raw, { registry = stepRegistry(), max = MAX_WORKFLOW_STEPS, inputs = [] } = {}) {
  if (!Array.isArray(raw)) return { error: "the steps have to arrive as a list" };
  if (raw.length > max) return { error: `that's more steps than one automation can hold (${max})` };
  const available = new Set();
  for (const n of Array.isArray(inputs) ? inputs : []) if (typeof n === "string") available.add(n);
  const steps = [];
  for (let i = 0; i < raw.length; i++) {
    const at = i + 1;
    const one = raw[i];
    if (one === null || typeof one !== "object" || Array.isArray(one)) {
      return { error: `step ${at} didn't arrive as a step`, at };
    }
    const def = registry.get(typeof one.type === "string" ? one.type : "");
    if (!def) return { error: `there is no step called ${String(one.type ?? "(nothing)")}`, at };
    const readIt = def.read(one);
    if (readIt?.error) return { error: `step ${at}: ${readIt.error}`, at };
    const config = readIt.config ?? {};

    for (const f of def.fields) {
      if (f.refs !== true) continue;
      for (const name of refsIn(config[f.name])) {
        if (!available.has(name)) {
          return { error: `step ${at}: nothing here produces a value called "${name}"`, at };
        }
      }
    }
    // ITS OWN `out` IS ADDED AFTER ITS OWN REFERENCES ARE CHECKED, so a step cannot
    // refer to the answer it is about to produce.
    if (isText(config.out)) available.add(config.out);

    steps.push(Object.freeze({ id: `s${at}`, type: def.type, ...config }));
  }
  const struct = branchMap(steps);
  if (struct.error) return { error: struct.error };
  return { steps, produces: [...available] };
}

// ── running one ─────────────────────────────────────────────────────────────

const plain = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/**
 * Put this run's values into every field that takes them.
 *
 * **WHICH FIELDS THOSE ARE IS DERIVED FROM THE DECLARATION** (`refs: true`), so a field
 * added next month either declares that it takes references or does not take them. A
 * list of field names here would be a second copy of the catalog.
 */
function fillConfig(def, config, values) {
  const out = { ...config };
  const missing = [];
  for (const f of def.fields) {
    if (f.refs !== true) continue;
    if (typeof out[f.name] !== "string") continue;
    const r = fillRefs(out[f.name], values);
    out[f.name] = r.text;
    for (const n of r.missing) if (!missing.includes(n)) missing.push(n);
  }
  return { config: out, missing };
}

/**
 * Walk the steps in order and answer what happened.
 *
 * **IT NEVER THROWS.** A step's own `run` may, and that becomes that step's outcome;
 * anything else would leave the caller unable to record what it had got through, which
 * is the whole product here.
 *
 * **EXACTLY ONE OF `stop`, `waiting` AND `halted` COMES BACK**, and they are three
 * different things to do next: finish the execution, leave it suspended and release the
 * worker, or write nothing at all because the claim is gone.
 *
 * **EVERY STEP GETS AN OUTCOME ONCE THE EXECUTION ENDS, including the ones that never
 * ran** — a list shorter than the workflow would make the screen show a workflow that
 * stops for no stated reason. While it is WAITING the list is deliberately short: the
 * steps after the pause have not been decided, and filling them in as skipped would say
 * they are not going to run.
 *
 * **PROGRESS IS CHECKPOINTED THROUGH `record` AFTER EVERY STEP, BEFORE THE NEXT ONE
 * STARTS.** That is what makes "resuming cannot repeat completed actions" a property: the
 * position in the database is always at or ahead of the work really done, never behind
 * it. The cost is stated rather than hidden — an execution is N+1 transactions where it
 * used to be one, and that is the price of being able to pause at all.
 */
export async function runWorkflow(opts = {}) {
  const steps = Array.isArray(opts.steps) ? opts.steps : [];
  const registry = opts.registry ?? stepRegistry();
  const now = typeof opts.now === "function" ? opts.now() : Date.now();
  // ⚠ WHICH DAY THIS EXECUTION IS ABOUT IS FIXED WHEN IT STARTED, NOT WHEN IT RESUMED,
  // and that is what makes a pause safe for a `weekday` gate. A scheduled execution is
  // pinned by its occurrence either way; a MANUAL one asked "what day is it" — so an
  // approval answered the following morning would otherwise put a run into a different
  // day from the one it began in, and a workflow that runs "only on Mondays" would
  // decide it is Tuesday half way through. `now` stays the real clock, because a
  // deadline has to be compared against the present.
  const asOf = typeof opts.startedAt === "number" && Number.isFinite(opts.startedAt) ? opts.startedAt : now;
  const day = executionDay({ occurrence: opts.occurrence ?? null, zone: opts.zone ?? null, now: asOf });
  const decisions = plain(opts.decisions);
  const memory = plain(opts.memory);
  const retrieve = typeof opts.retrieve === "function" ? opts.retrieve : null;
  const record = typeof opts.record === "function" ? opts.record : null;
  const values = { ...plain(opts.values) };
  const pausedOn = plain(opts.waiting);
  const waitUntil = typeof opts.waitUntil === "number" && Number.isFinite(opts.waitUntil) ? opts.waitUntil : null;

  const results = new Map();
  // A RESUME KEEPS WHAT IS ALREADY RECORDED, matched BY ID rather than by position in
  // the stored list: the ids are minted from the position of the snapshotted workflow,
  // so they are the one thing that survives a list being read back.
  for (const o of Array.isArray(opts.outcomes) ? opts.outcomes : []) {
    const at = indexOfId(o?.id);
    if (at >= 0 && at < steps.length) results.set(at, o);
  }

  const put = (at, o) => results.set(at, {
    id: steps[at]?.id ?? `s${at + 1}`, type: steps[at]?.type ?? "", ...o,
  });
  const skipRange = (from, to, why) => {
    for (let k = from; k < to && k < steps.length; k++) if (!results.has(k)) put(k, { outcome: "skipped", why });
  };
  const ordered = () => {
    const out = [];
    for (let k = 0; k < steps.length; k++) if (results.has(k)) out.push(results.get(k));
    return out;
  };
  const ctxFor = (resume) => Object.freeze({
    date: day.date, weekday: day.weekday, zone: day.zone, dayFrom: day.from, now,
    values: Object.freeze({ ...values }), memory, retrieve, resume,
  });

  let i = Number.isInteger(opts.position) && opts.position > 0 ? opts.position : 0;
  let stopped = null;   // {kind: "skipped"|"failed"|"rejected", at, why|error}
  let waiting = null;
  let waitingAt = null;
  let halted = null;

  const checkpoint = async (position, pause) => {
    if (!record) return true;
    let answer;
    try {
      answer = await record({
        position, outcomes: ordered(), values: { ...values }, waiting: pause ?? null,
        // ⚠ THE EXECUTOR'S OWN CLOCK, NOT THE RECORDER'S, and that is what makes a retry
        // inside one delivery replay a BYTE-IDENTICAL journal entry — which is the only
        // thing `agent.append_entry` can read as `already` rather than as a second entry.
        // Reading the clock again per call would put a new millisecond in every body.
        at: now,
      });
    } catch (e) {
      halted = String(e?.message ?? e);
      return false;
    }
    // ⚠ A REFUSED CHECKPOINT MEANS THIS WORKER MAY NOT WRITE, so it stops there and
    // NOTHING ELSE is attempted — not the next step, not a stop. `ok` must be exactly
    // true: a recorder answering something else has not told us it wrote.
    if (answer?.ok !== true) {
      halted = isText(answer?.why) ? answer.why : "the progress could not be recorded";
      return false;
    }
    return true;
  };

  const struct = branchMap(steps);
  if (struct.error) {
    // A STORED LIST WHOSE BRANCHES DO NOT BALANCE. Refused at save time, so this is a
    // row written by another version — and it FAILS rather than running the steps it can
    // read, because running half a branch is running a workflow nobody wrote.
    const at = steps[i]?.id ?? null;
    put(Math.min(i, Math.max(0, steps.length - 1)), { outcome: "failed", error: struct.error });
    stopped = { kind: "failed", at, error: struct.error };
    i = steps.length;
  }

  const jumpedToElse = new Set();

  while (i < steps.length && !stopped && !waiting && halted === null) {
    const one = steps[i] ?? {};
    const id = isText(one.id) ? one.id : `s${i + 1}`;
    const type = typeof one.type === "string" ? one.type : "";
    const def = registry.get(type);

    // A STORED STEP WHOSE TYPE THIS DEPLOYMENT NO LONGER HAS. Failed rather than
    // skipped: skipping would quietly run a DIFFERENT workflow from the one somebody
    // saved, and the whole list after it as though nothing were wrong.
    if (!def) {
      const error = `there is no step called ${type || "(nothing)"} on this deployment`;
      put(i, { outcome: "failed", error });
      stopped = { kind: "failed", at: id, error };
      break;
    }

    // ⚠ READ AGAIN AT RUN TIME, although the route read it before storing. These steps
    // came back from a database, so they came from outside — the same rule the journal
    // follows for its own entries. The two readers have different jobs: the route's
    // answers a person, this one keeps a malformed row from reaching a step's `run`.
    const readIt = def.read(one);
    if (readIt?.error) {
      put(i, { outcome: "failed", error: readIt.error });
      stopped = { kind: "failed", at: id, error: readIt.error };
      break;
    }

    const filled = fillConfig(def, readIt.config ?? {}, values);
    if (filled.missing.length) {
      // NAMED, NEVER SUBSTITUTED WITH NOTHING. A note that quietly lost half its
      // sentence is something somebody sends to a customer.
      const error = filled.missing.length === 1
        ? `there is no value called "${filled.missing[0]}" in this run`
        : `there are no values called ${filled.missing.map((n) => `"${n}"`).join(", ")} in this run`;
      put(i, { outcome: "failed", error });
      stopped = { kind: "failed", at: id, error };
      break;
    }
    const config = filled.config;

    // ── a branch picks a path; it never stops the workflow ──────────────────
    if (def.stepKind === "branch") {
      const b = struct.map?.get(i) ?? {};
      if (type === "if") {
        let answer;
        try { answer = await def.run(config, ctxFor(null)); }
        catch (e) {
          const error = String(e?.message ?? e);
          put(i, { outcome: "failed", error });
          stopped = { kind: "failed", at: id, error };
          break;
        }
        const met = answer?.met === true;
        // ⚠ `ran`, WHATEVER THE ANSWER WAS. An `if` that did not match still did its job.
        // `took` is what makes "which branch ran" a field rather than something to read
        // out of the skipped steps below it.
        put(i, { outcome: "ran", took: met ? "first" : "otherwise", why: isText(answer?.why) ? answer.why : (met ? "it matched" : "it didn't match") });
        const hasElse = b.elseAt !== null && b.elseAt !== undefined;
        const target = hasElse ? b.elseAt : b.endAt;
        if (met) { i += 1; }
        else {
          skipRange(i + 1, target, "the comparison didn't hold, so this step was skipped");
          if (hasElse) jumpedToElse.add(b.elseAt);
          i = target;
        }
      } else if (type === "otherwise") {
        if (jumpedToElse.has(i)) {
          put(i, { outcome: "ran", why: "the comparison didn't hold, so these steps ran instead" });
          i += 1;
        } else {
          const why = "the steps under \"If\" ran, so this arm didn't";
          put(i, { outcome: "skipped", why });
          skipRange(i + 1, b.endAt, why);
          i = b.endAt;
        }
      } else {
        put(i, { outcome: "ran", why: "both arms rejoin here" });
        i += 1;
      }
      if (!(await checkpoint(i, null))) break;
      continue;
    }

    // ⚠ IS THIS THE STEP THE EXECUTION WAS SUSPENDED ON? Asked by the step's own ID and
    // never by the position alone, so a resume that arrived for one pause can never be
    // read as the answer to another.
    const resume = pausedOn.step === id
      ? { waitUntil, decision: Object.hasOwn(decisions, id) ? decisions[id] : null }
      : null;

    let answer;
    try { answer = await def.run(config, ctxFor(resume)); }
    catch (e) {
      const error = String(e?.message ?? e);
      put(i, { outcome: "failed", error });
      stopped = { kind: "failed", at: id, error };
      break;
    }

    // A STEP MAY REFUSE WITHOUT THROWING, and `failed` is how it says so — one reading
    // for every kind, so a refusal cannot be mistaken for an answer.
    if (isText(answer?.failed)) {
      put(i, { outcome: "failed", error: answer.failed });
      stopped = { kind: "failed", at: id, error: answer.failed };
      break;
    }

    if (def.stepKind === "condition") {
      const met = answer?.met === true;
      const why = isText(answer?.why) ? answer.why : (met ? "it matched" : "it didn't match");
      put(i, { outcome: met ? "ran" : "skipped", why });
      // ⚠ A CONDITION THAT DID NOT MATCH IS `skipped`, AND SO IS EVERYTHING AFTER IT.
      // Never `failed`: nothing went wrong, the workflow simply said not today.
      if (!met) stopped = { kind: "skipped", at: id, why };
      i += 1;
      if (!stopped && !(await checkpoint(i, null))) break;
      continue;
    }

    if (def.stepKind === "pause") {
      if (answer?.waiting) {
        waiting = { ...answer.waiting, step: id };
        waitingAt = i;
        put(i, { outcome: "waiting", why: isText(answer.why) ? answer.why : "waiting" });
        // THE PAUSE IS RECORDED BY THE SAME SEAM EVERY OTHER STEP USES, so there is ONE
        // writer of progress. The position stays AT this step, because this step has not
        // finished — that is what a resume re-enters.
        if (!(await checkpoint(waitingAt, waiting))) { waiting = null; break; }
        break;
      }
      if (answer?.stop) {
        const why = isText(answer.stop.why) ? answer.stop.why : "stopped here";
        put(i, { outcome: "ran", why });
        stopped = { kind: answer.stop.reason === "rejected" ? "rejected" : "failed", at: id, why };
        break;
      }
      put(i, { outcome: "ran", why: isText(answer?.why) ? answer.why : "carried on" });
      i += 1;
      if (!(await checkpoint(i, null))) break;
      continue;
    }

    if (def.stepKind === "lookup") {
      const value = typeof answer?.value === "string" ? answer.value : "";
      if (isText(config.out)) values[config.out] = value;
      put(i, {
        outcome: "ran",
        why: isText(answer?.note) ? answer.note : "found it",
        sources: Array.isArray(answer?.sources) ? answer.sources : [],
        chars: value.length,
      });
      i += 1;
      if (!(await checkpoint(i, null))) break;
      continue;
    }

    // An action. Its answer is the execution's result, and it may also be bound.
    const got = typeof answer?.result === "string" ? answer.result : null;
    if (got !== null && isText(config.out)) values[config.out] = got;
    put(i, { outcome: "ran", result: got });
    i += 1;
    if (!(await checkpoint(i, null))) break;
  }

  if (halted !== null) {
    return { outcomes: ordered(), values, position: i, stop: null, waiting: null, halted };
  }

  if (waiting) {
    return { outcomes: ordered(), values, position: waitingAt, stop: null, waiting, halted: null };
  }

  // EVERY REMAINING STEP GETS AN OUTCOME, and the reason says which kind of ending it
  // was — "an earlier condition didn't match" and "an earlier step didn't work" are
  // different things for somebody reading the history to see.
  const why = stopped === null ? "" :
    stopped.kind === "failed" ? "an earlier step didn't work, so this one didn't run" :
    stopped.kind === "rejected" ? "it wasn't approved, so this one didn't run" :
    "an earlier condition didn't match, so this one didn't run";
  if (stopped !== null) skipRange(0, steps.length, why);

  const outcomes = ordered();
  // THE RESULT IS THE LAST ACTION'S ANSWER, read back out of the outcomes rather than
  // tracked in a variable — because on a resume the actions before the pause ran in
  // another process and their answers are in the record, not in this one's memory.
  let result = null;
  for (const o of outcomes) if (typeof o?.result === "string") result = o.result;

  const stop = stopped === null
    ? { reason: "done", result }
    : stopped.kind === "skipped"
      ? { reason: "skipped", at: stopped.at, why: stopped.why }
      : stopped.kind === "rejected"
        // NO `result` ON A REJECTION, deliberately. `stop.result` is what the automation
        // PRODUCED, and a rejected one produced nothing it was allowed to produce —
        // carrying the last note forward would make a refusal read like a success in
        // every reader that shows the result first. The note is still in the outcomes.
        ? { reason: "rejected", at: stopped.at, why: stopped.why }
        : { reason: "failed", at: stopped.at, error: stopped.error };

  // THE DAY THIS EXECUTION ASKED ABOUT RIDES ON THE STOP. Without it, "skipped because
  // it isn't Monday" is unanswerable after the fact — the reader would have to work out
  // which day the execution thought it was, in a zone it cannot see.
  return {
    outcomes, values, position: steps.length, waiting: null, halted: null,
    stop: { ...stop, on: day.date, weekday: day.weekday, zone: day.zone },
  };
}
