/**
 * THE WORKFLOW — an ordered list of steps, run without a model.
 *
 * This is the second executor in this product. `run.mjs` is the agent loop: a model
 * decides what to do next and every bound exists to stop it running away. Nothing
 * here decides anything — the steps are the customer's own list, in their own order,
 * and this walks it. **NO MODEL CALL, NO NETWORK, NO CLOCK OF ITS OWN**: `now` is
 * injected like everything else in this directory, so every branch below is drivable.
 *
 * **A STEP TYPE IS CODE, EXACTLY AS A TOOL IS.** A stored step is `{id, type, …}` and
 * the type resolves against the registry below or resolves to nothing. So a row in a
 * database, a request body or a customer's typing can choose AMONG the things this
 * product implements and can never describe a new one — which is the same wall
 * `agents.mjs` puts in front of tools, for the same reason.
 *
 * **TWO KINDS, AND THE DIFFERENCE IS WHAT THEY ANSWER.** A `condition` answers
 * whether the rest of the workflow should happen; an `action` does something and
 * answers what it did. That split is what makes "a condition that does not match is
 * SKIPPED, not FAILED" a property of the design rather than a string somebody
 * remembered to use.
 *
 * ⚠ **WHAT THIS SHAPE IS BUILT TO GROW INTO, and what each one needs that is not here
 * yet** — written down because the next person to touch this file is adding one:
 *
 *   `app-action`  — an action that reaches something outside. Needs a credential and a
 *                   network call, so it needs `repeatable` the way a tool does: a
 *                   redelivery must not send a second email.
 *   `branch`      — a condition that picks a path rather than stopping. Needs steps to
 *                   hold children, so `read` would recurse and the outcome list would
 *                   stop being flat.
 *   `wait`        — ⚠ THE ONE THAT CHANGES THE STORAGE. An execution that pauses spans
 *                   transactions, so the outcomes can no longer be written in one
 *                   statement with the stop: they become journal entries, each fenced,
 *                   and the execution needs a resumable POSITION. That is a migration.
 *   `approval`    — a wait whose resume is a person. Everything `wait` needs, plus a
 *                   door that is not the queue.
 *
 * The three that do not touch storage are ordinary additions to the registry.
 */

/** The only two kinds of step there are, and a step declares which it is. */
export const STEP_KINDS = Object.freeze(["condition", "action"]);

/**
 * WHAT A STEP IS CONFIGURED WITH, DECLARED RATHER THAN IMPLIED.
 *
 * `read` is the authority on meaning and always will be — it is what refuses a day that
 * is not a day. `fields` is the SHAPE of the same thing, and it exists because two other
 * places need it and neither can read a function body: the browser draws a form from it,
 * and the site builder's own copy of this catalog is censused against it field by field.
 * A `read` that quietly started accepting a fifth key would otherwise be invisible to
 * both.
 */
export const FIELD_KINDS = Object.freeze(["text", "days"]);

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
 * What became of one step. Three words, and each needs a different thing said about it.
 *
 * `skipped` is the one that earns its place: a condition that did not match is not a
 * failure and must never read as one, and neither is a step that never got its turn
 * because an earlier one stopped the workflow. Both are `skipped`, and `why` is what
 * tells them apart.
 */
export const STEP_OUTCOMES = Object.freeze(["ran", "skipped", "failed"]);

/** Why an execution ended. The shape `agent.runs.stop` holds. */
export const STOP_REASONS = Object.freeze(["done", "skipped", "failed"]);

const isText = (v) => typeof v === "string" && v.trim() !== "";

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
 */
export function defineStep(spec = {}) {
  const { type, kind, label, does, fields, read, run } = spec;
  if (!isText(type)) throw new TypeError("defineStep: type must be a non-empty string");
  if (!STEP_KINDS.includes(kind)) throw new TypeError(`defineStep(${type}): kind must be one of ${STEP_KINDS.join(", ")}`);
  if (!isText(label)) throw new TypeError(`defineStep(${type}): label must be a non-empty string`);
  if (!isText(does)) throw new TypeError(`defineStep(${type}): does must be a non-empty string — it is what a person reads when choosing this`);
  if (!Array.isArray(fields) || !fields.length) throw new TypeError(`defineStep(${type}): fields must say what this step is configured with`);
  for (const f of fields) {
    if (!isText(f?.name)) throw new TypeError(`defineStep(${type}): every field needs a name`);
    if (!FIELD_KINDS.includes(f?.kind)) throw new TypeError(`defineStep(${type}): field ${f?.name} must be one of ${FIELD_KINDS.join(", ")}`);
  }
  if (typeof read !== "function") throw new TypeError(`defineStep(${type}): read must be a function`);
  if (typeof run !== "function") throw new TypeError(`defineStep(${type}): run must be a function`);
  return Object.freeze({
    kind: "step", type, stepKind: kind, label, does,
    fields: Object.freeze(fields.map((f) => Object.freeze({ ...f }))),
    read, run,
  });
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
 * How long a note may be. Bounded here because nothing else bounds it.
 *
 * ⚠ DECLARED ABOVE THE STEP THAT READS IT, not below the registry. `note.read` closes
 * over it, and a `const` called before its own line is a `ReferenceError` that
 * `node --check` cannot see — this repository's own temporal-dead-zone trap. Nothing
 * calls `read` at import today, which is exactly what would make the mistake invisible
 * until the day something did.
 */
export const MAX_NOTE = 2000;

/**
 * SAVE A NOTE TO THE RESULTS.
 *
 * The one real internal action this milestone has, and it is real: what it answers
 * becomes the execution's own result, stored in the run's stop and shown in the
 * history. **NOTHING ABOUT IT IS A PLACEHOLDER** — there is no model, no provider and
 * nothing pretending to answer.
 */
const note = defineStep({
  type: "note",
  kind: "action",
  label: "Save a note",
  does: "Write a line into this automation's results, so the run has something to show.",
  fields: [{ name: "text", kind: "text", required: true, max: MAX_NOTE }],
  read: (raw) => {
    const text = typeof raw?.text === "string" ? raw.text.trim() : "";
    if (!text) return { error: "say what the note should say" };
    if (text.length > MAX_NOTE) return { error: `that note is longer than one note can be (${MAX_NOTE} characters)` };
    return { config: { text } };
  },
  run: (config) => ({ result: config.text }),
});

/**
 * THE CATALOG. Built last, from the steps above, so adding one is adding it here
 * rather than remembering to — and a stored `type` can only ever name what is in it.
 */
export const AUTOMATION_STEPS = Object.freeze([weekday, note]);

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

// ── reading a stored workflow ───────────────────────────────────────────────

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
 */
export function readWorkflow(raw, { registry = stepRegistry(), max = MAX_WORKFLOW_STEPS } = {}) {
  if (!Array.isArray(raw)) return { error: "the steps have to arrive as a list" };
  if (raw.length > max) return { error: `that's more steps than one automation can hold (${max})` };
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
    steps.push(Object.freeze({ id: `s${at}`, type: def.type, ...readIt.config }));
  }
  return { steps };
}

// ── running one ─────────────────────────────────────────────────────────────

/**
 * Walk the steps in order and answer what happened.
 *
 * **IT NEVER THROWS.** A step's own `run` may, and that becomes that step's outcome;
 * anything else would leave the caller unable to record what it had got through, which
 * is the whole product here.
 *
 * **EVERY STEP GETS AN OUTCOME, INCLUDING THE ONES THAT NEVER RAN.** A list shorter
 * than the workflow would make the screen show a workflow that stops for no stated
 * reason — and the outcomes are what "each step's outcome" in the requirement means.
 */
export async function runWorkflow(opts = {}) {
  const steps = Array.isArray(opts.steps) ? opts.steps : [];
  const registry = opts.registry ?? stepRegistry();
  const now = typeof opts.now === "function" ? opts.now() : Date.now();
  const day = executionDay({ occurrence: opts.occurrence ?? null, zone: opts.zone ?? null, now });

  const ctx = Object.freeze({
    date: day.date, weekday: day.weekday, zone: day.zone, dayFrom: day.from, now,
  });

  const outcomes = [];
  let stopped = null;      // {kind: "skipped"|"failed", at, why|error}
  let result = null;

  for (let i = 0; i < steps.length; i++) {
    const one = steps[i] ?? {};
    const id = isText(one.id) ? one.id : `s${i + 1}`;
    const type = typeof one.type === "string" ? one.type : "";

    if (stopped) {
      outcomes.push({
        id, type, outcome: "skipped",
        why: stopped.kind === "failed"
          ? "an earlier step didn't work, so this one didn't run"
          : "an earlier condition didn't match, so this one didn't run",
      });
      continue;
    }

    const def = registry.get(type);
    // A STORED STEP WHOSE TYPE THIS DEPLOYMENT NO LONGER HAS. Failed rather than
    // skipped: skipping would quietly run a DIFFERENT workflow from the one somebody
    // saved, and the whole list after it as though nothing were wrong.
    if (!def) {
      outcomes.push({ id, type, outcome: "failed", error: `there is no step called ${type || "(nothing)"} on this deployment` });
      stopped = { kind: "failed", at: id, error: `there is no step called ${type || "(nothing)"} on this deployment` };
      continue;
    }

    // ⚠ READ AGAIN AT RUN TIME, although the route read it before storing. These steps
    // came back from a database, so they came from outside — the same rule the journal
    // follows for its own entries. The two readers have different jobs: the route's
    // answers a person, this one keeps a malformed row from reaching a step's `run`.
    const readIt = def.read(one);
    if (readIt?.error) {
      outcomes.push({ id, type, outcome: "failed", error: readIt.error });
      stopped = { kind: "failed", at: id, error: readIt.error };
      continue;
    }

    try {
      const answer = await def.run(readIt.config, ctx);
      if (def.stepKind === "condition") {
        const met = answer?.met === true;
        const why = isText(answer?.why) ? answer.why : (met ? "it matched" : "it didn't match");
        outcomes.push({ id, type, outcome: met ? "ran" : "skipped", why });
        // ⚠ A CONDITION THAT DID NOT MATCH IS `skipped`, AND SO IS EVERYTHING AFTER IT.
        // Never `failed`: nothing went wrong, the workflow simply said not today.
        if (!met) stopped = { kind: "skipped", at: id, why };
      } else {
        const got = typeof answer?.result === "string" ? answer.result : null;
        if (got !== null) result = got;
        outcomes.push({ id, type, outcome: "ran", result: got });
      }
    } catch (e) {
      const error = String(e?.message ?? e);
      outcomes.push({ id, type, outcome: "failed", error });
      stopped = { kind: "failed", at: id, error };
    }
  }

  const stop = stopped === null
    ? { reason: "done", result }
    : stopped.kind === "skipped"
      ? { reason: "skipped", at: stopped.at, why: stopped.why }
      : { reason: "failed", at: stopped.at, error: stopped.error };

  // THE DAY THIS EXECUTION ASKED ABOUT RIDES ON THE STOP. Without it, "skipped because
  // it isn't Monday" is unanswerable after the fact — the reader would have to work out
  // which day the execution thought it was, in a zone it cannot see.
  return { outcomes, stop: { ...stop, on: ctx.date, weekday: ctx.weekday, zone: ctx.zone } };
}
