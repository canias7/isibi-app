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
export const STEP_KINDS = Object.freeze(["condition", "action", "lookup", "branch", "pause", "call"]);

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
export const FIELD_KINDS = Object.freeze(["text", "days", "choice", "number", "time", "name", "id", "event"]);

/**
 * WHAT A NAMED VALUE IS, and it is a different question from what a FIELD is.
 *
 * `FIELD_KINDS` is about a CONTROL — what the form draws and what `read` will accept in
 * one box. This is about a VALUE bound to a name and read back later through `{{…}}`, and
 * the two lists differ on purpose: `days`, `time` and `choice` are ways of filling in a
 * box, not kinds of thing a step can produce.
 *
 * **THREE, AND EACH EARNS ITS PLACE BY SOMETHING REFUSING IT.** `text` is what every
 * binding has always been and is the DEFAULT, so nothing stored before today moves.
 * `number` is refused where text is expected and vice versa. `list` is the one a loop can
 * iterate, and it is why this list exists at all: without a field that accepts ONLY a
 * list, a type is a label nothing reads.
 */
export const VALUE_TYPES = Object.freeze(["text", "number", "list"]);

/**
 * What a reference of one type may be used where another is wanted.
 *
 * **IT IS NOT SYMMETRIC AND THAT IS THE POINT.** A number reads perfectly well as text —
 * `valueText` already renders one — so a `{{count}}` inside a sentence is fine. Text does
 * NOT read as a number: `Number("nine")` is NaN and `Number("")` is 0, and this repository
 * has the second of those recorded as a real defect. A LIST reads as neither, because
 * `String(["a"])` is `"a"` and a single-element list would silently become its element.
 */
export const TYPE_ACCEPTS = Object.freeze({
  text: Object.freeze(["text", "number"]),
  number: Object.freeze(["number"]),
  list: Object.freeze(["list"]),
});

/**
 * How many steps one workflow may hold.
 *
 * **A COPY OF THE COLUMN'S OWN CHECK CONSTRAINT, DECLARED AS ONE.** A CHECK cannot
 * read this file and this file cannot read SQL, so the number exists twice — and a
 * guard reads it back out of the migration and compares, which is what turns a drift
 * into a red run rather than into a workflow the database refuses to store.
 */
/**
 * ⚠ WHEN AN AUTOMATION RUNS — a DECLARED COPY of the site builder's own list, and of the
 * database's own check constraint (`automations_schedule_known`).
 *
 * Neither product may import the other and a CHECK cannot be read from JavaScript, so this
 * is the same fact in three languages. `test/agent-send.test.mjs` — the one file that may
 * load both products — censuses it against the site's `AUTOMATION_SCHEDULES` BOTH WAYS, and
 * `test/integration/pg-schema.mjs` reads the constraint out of the migration. A schedule an
 * agent could ask for and the database refuses is a control that answers and then fails.
 */
export const AUTOMATION_SCHEDULES = Object.freeze(["manual", "daily", "weekly", "once"]);

/**
 * How long an event name may be and what it may hold.
 *
 * ⚠ **AN IDENTIFIER AND NOT PROSE**, because the dispatcher compares it for EQUALITY: two
 * names that read the same and differ by a space or a capital would behave differently, and
 * from a customer's side that is an automation that does not fire. The same shape the
 * database's own `events_name_shaped` check holds, which `test/agent-send.test.mjs`
 * censuses against this constant.
 */
export const EVENT_NAME = /^[a-z][a-z0-9_.-]{0,63}$/;

/** How many events deep one chain may go before it is refused BY NAME. */
export const MAX_EVENT_DEPTH = 4;

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
import { readSearch, searchOutcome } from "./knowledge-search.mjs";
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
 * How many times one loop may go round, and how deep loops may nest.
 *
 * **BOTH ARE ENFORCED IN CODE AND NEITHER IS A NUMBER THE MODEL IS TOLD ABOUT AND
 * TRUSTED WITH** — this directory's own first rule. `MAX_LOOP_ITERATIONS` bounds a
 * `times` at save time AND a resolved list at RUN time, because the list comes from a
 * value and a value comes from outside.
 */
export const MAX_LOOP_ITERATIONS = 50;
export const MAX_LOOP_DEPTH = 2;

/**
 * ⚠ **HOW MANY STEP RUNS ONE EXECUTION MAY MAKE, and it is the bound loops make
 * necessary rather than a tidy extra.**
 *
 * `MAX_WORKFLOW_STEPS` bounds the LIST. Before loops those were the same number; with
 * them a twenty-step workflow holding two nested loops of fifty is fifty thousand step
 * runs, and every one of them is a checkpoint — a transaction, a journal entry, and a
 * delivery window that cannot hold them. So the real resource is RUNS, and this is what
 * bounds it.
 *
 * **IT IS A CEILING ON THE WHOLE EXECUTION, which is what makes it survive a resume**:
 * the count is the number of outcomes already recorded plus what this delivery does, so
 * an execution cannot spend it again by being restarted.
 */
export const MAX_STEP_RUNS = 200;

/**
 * ⚠ **HOW DEEP ONE AUTOMATION MAY CALL ANOTHER, AND HOW LONG THE FLATTENED LIST MAY BE.**
 *
 * `MAX_SUBWORKFLOW_DEPTH` bounds the CHAIN — a parent calling a child calling a
 * grandchild is depth 2 — and it is what makes a cycle terminate even before the cycle
 * check below sees it. **`MAX_FLAT_STEPS` IS DERIVED FROM `MAX_STEP_RUNS` and equals it**:
 * a list longer than the number of step runs one execution may make cannot finish however
 * it is written, so a longer one is refused while it is still somebody's form rather than
 * failing half way through with work already done.
 */
export const MAX_SUBWORKFLOW_DEPTH = 2;
export const MAX_FLAT_STEPS = MAX_STEP_RUNS;

/**
 * ⚠ **WHAT HAPPENS WHEN A STEP DOES NOT WORK, AND `stop` IS THE DEFAULT BECAUSE IT IS
 * WHAT EVERY WORKFLOW SAVED BEFORE THIS ALREADY DOES.**
 *
 * Absent means `stop`, so nothing anybody has stored changes meaning and nothing is
 * migrated. The other two are opt-in per step, and each is right for some workflow and
 * wrong for others — which is exactly why it is the customer's answer rather than ours:
 * a lookup that found nothing may be fine to carry past, and a lookup whose store was
 * down may be worth one more attempt.
 *
 * **`continue` DOES NOT MAKE A FAILURE A SUCCESS.** The step's outcome stays `failed`
 * with its own error; what changes is only whether the steps below it run. Recording it
 * as `ran` would be a workflow that says it worked, which is the one thing a history
 * exists to prevent.
 */
export const ERROR_PATHS = Object.freeze(["stop", "continue", "retry"]);

/**
 * How many EXTRA attempts a step may be given, over and above its first.
 *
 * Bounded in code, and bounded again by `MAX_STEP_RUNS` — a retry IS a step run, so a
 * workflow cannot buy itself more work by asking for retries. Three is chosen rather
 * than measured: it is enough for a store that is briefly down and few enough that a
 * failing step does not hold a delivery window open on its own.
 */
export const MAX_STEP_RETRIES = 3;

/**
 * WHAT A STEP MAY PUT ON ITS OWN OUTCOME BESIDE THE OUTCOME ITSELF — a POSITIVE list.
 *
 * ⚠ **A LIST RATHER THAN A SPREAD OF THE ANSWER, because a step's answer is its author's
 * object and an outcome is read by a screen.** Spreading it would let a field nobody has
 * written reach a customer, and would make every future field of every step's internal
 * answer part of this product's wire shape by accident.
 *
 * Each one is here for a reason a reader can check: `result` is what the step produced (and
 * the last one wins the execution's own result), `prepared` is what it was going to do,
 * `sent`/`message` are what really happened at the far end, `unresolved` is the one field
 * that separates "it did not happen" from "nobody can say", `simulated` says the far end was
 * a stand-in, and `repeat` says this delivery found the work already done.
 */
export const PAUSE_MARKS = Object.freeze([
  "result", "prepared", "sent", "message", "unresolved", "simulated", "repeat",
]);

/**
 * ⚠ **WHICH KINDS OF STEP MAY DECLARE AN ERROR PATH, AND THE TWO THAT MAY NOT ARE THE
 * INTERESTING HALF.**
 *
 * A `branch` is always `ran` — it did its job, which was to choose — and carrying on
 * past an `if` that could not decide would leave the branch map pointing at arms nobody
 * picked. A `pause` does not fail: a `wait` waits, and a REJECTION is a person saying
 * no, so `continue` there would be a workflow ignoring them. Both stay hard stops, and
 * the form never offers the choice, so there is no control to be surprised by.
 */
export const FAILABLE_KINDS = Object.freeze(["condition", "action", "lookup"]);

/**
 * ⚠ **THE ERROR-PATH FIELDS ARE APPENDED BY `defineStep`, NOT TYPED INTO EACH STEP.**
 *
 * They are the same two controls with the same meaning on every step that can fail, and
 * a step author who forgot them would ship a step whose failures cannot be handled — so
 * they are DERIVED from the kind, which means a fifth failable step next month gets
 * them by existing. `retries` is appended only where a retry is really available, or it
 * is a control that answers and is then refused.
 */
function errorPathFields(retryable) {
  const paths = retryable ? ERROR_PATHS : ERROR_PATHS.filter((p) => p !== "retry");
  const out = [{
    name: "on_error", kind: "choice", options: paths,
    says: "what to do if this step doesn't work",
  }];
  if (retryable) {
    out.push({
      name: "retries", kind: "number", required: true, min: 1, max: MAX_STEP_RETRIES,
      when: { on_error: ["retry"] }, says: "how many more times to try",
    });
  }
  return out;
}

/**
 * Read a stored step's error path.
 *
 * **ONE READER, CALLED BY BOTH DOORS** — the validator that answers a person and the
 * executor that acts on the answer — because a step whose path saves one way and runs
 * another is a workflow that does something nobody asked for.
 *
 * **ABSENT IS `stop` AND STORES NOTHING**, so a workflow saved before this exists round
 * trips byte for byte. A value it cannot read is REFUSED BY NAME rather than falling
 * back to the default: a typo read as `stop` is a customer's `continue` silently
 * dropped, and reading an unknown word as `continue` would carry on past a failure
 * nobody agreed to carry on past.
 */
export function readErrorPath(raw, def) {
  const has = raw && typeof raw === "object" && !Array.isArray(raw);
  const given = has ? raw.on_error : undefined;
  const blank = given === undefined || given === null || given === "";
  const onF = (def?.fields ?? []).find((f) => f?.name === "on_error") ?? null;
  // ⚠ **A STEP THAT CANNOT FAIL REFUSES AN ERROR PATH RATHER THAN DROPPING IT.** The form
  // never offers one, so this can only arrive from an agent's tool or a hand-written
  // request — and a key quietly dropped is a control that saves, draws back and does
  // nothing. "A filter is a silent drop; a check is a sentence."
  if (!onF) return blank ? { config: {} } : { error: `${def?.label ?? "that step"} has no failures to handle` };
  if (blank) return { config: {} };
  // ⚠ **THE OPTIONS ARE THE WALL, AND THEY ARE THE FIELD'S OWN.** `retry` is simply absent
  // from a step that is not retryable, so "there is no such path" and "that path is not
  // available here" are ONE refusal derived from one declaration — rather than a second
  // rule beside the list, which is the copy that drifts. The sentence is derived too, from
  // the field's own `says` and `options`, so the site builder's generic reader produces it
  // word for word from the same frozen field.
  if (!isText(given) || !onF.options.includes(given)) {
    return { error: `${onF.says} has to be one of: ${onF.options.join(", ")}` };
  }
  if (given !== "retry") return { config: { on_error: given } };
  const rF = (def?.fields ?? []).find((f) => f?.name === "retries") ?? null;
  if (!rF) return { error: `${onF.says} has to be one of: ${onF.options.join(", ")}` };
  const n = has ? raw.retries : undefined;
  // REFUSED, NEVER COERCED OR CLAMPED. `Number("")` is 0 and a clamp would store a bound
  // nobody chose as though they had.
  if (typeof n !== "number" || !Number.isInteger(n)) return { error: `${rF.says} has to be a whole number` };
  if (n < rF.min || n > rF.max) return { error: `${rF.says} has to be between ${rF.min} and ${rF.max}` };
  return { config: { on_error: "retry", retries: n } };
}

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
  const { type, kind, label, does, fields, read, run, configless, retryable, decided } = spec;
  if (!isText(type)) throw new TypeError("defineStep: type must be a non-empty string");
  if (!STEP_KINDS.includes(kind)) throw new TypeError(`defineStep(${type}): kind must be one of ${STEP_KINDS.join(", ")}`);
  if (!isText(label)) throw new TypeError(`defineStep(${type}): label must be a non-empty string`);
  if (!isText(does)) throw new TypeError(`defineStep(${type}): does must be a non-empty string — it is what a person reads when choosing this`);
  if (!Array.isArray(fields)) throw new TypeError(`defineStep(${type}): fields must say what this step is configured with`);
  /**
   * ⚠ **`decided` — THIS STEP'S RESUME IS A STORED DECISION KEYED BY ITS ID.**
   *
   * Only an `approval` is: `agent.automation_runs.decisions` is `{ "<step id>": … }` and the
   * first decision at a key stands, so inside a loop every round after the first would take
   * the first round's answer with nobody asked. That is why a `decided` step may not go in a
   * loop, refused where the workflow is written — and the flag is on the DECLARATION rather
   * than a list of names elsewhere, so a second such step next month carries the wall by
   * existing.
   *
   * REFUSED, NEVER COERCED (`Boolean("false")` is `true`), and refused on a step that cannot
   * pause at all: a flag about how a resume is matched is an opinion on a step with no
   * resume, which is a dead declaration.
   */
  if (decided !== undefined && typeof decided !== "boolean") {
    throw new TypeError(`defineStep(${type}): decided must be true or false, or left out`);
  }
  if (decided === true && kind !== "pause") {
    throw new TypeError(`defineStep(${type}): only a pause can have its resume decided, and this is a ${kind}`);
  }
  if (!fields.length && configless !== true) {
    throw new TypeError(`defineStep(${type}): a step with no fields must declare configless: true, so an empty list is deliberate rather than forgotten`);
  }
  if (fields.length && configless === true) {
    throw new TypeError(`defineStep(${type}): configless says there is nothing to configure, so it cannot also declare fields`);
  }
  // ⚠ **WHETHER A SECOND ATTEMPT COULD ANSWER DIFFERENTLY IS THE STEP AUTHOR'S FACT.**
  // Refused rather than coerced — `Boolean("false")` is `true`, and a string out of a
  // config file must not be what makes a step retryable — and refused on a kind that
  // cannot fail, because there it is a declaration nothing reads.
  if (retryable !== undefined) {
    if (typeof retryable !== "boolean") {
      throw new TypeError(`defineStep(${type}): retryable must be true or false, so it cannot be set by accident`);
    }
    if (!FAILABLE_KINDS.includes(kind)) {
      throw new TypeError(`defineStep(${type}): a ${kind} cannot fail, so saying whether it may be retried reads nothing`);
    }
  }
  const failable = FAILABLE_KINDS.includes(kind);
  // A STEP THAT CAN FAIL ALWAYS HAS AN ERROR PATH TO CONFIGURE, so it cannot also say
  // there is nothing to configure — the form would draw no controls and the appended
  // pair would be dead.
  if (failable && configless === true) {
    throw new TypeError(`defineStep(${type}): a ${kind} carries an error path, so it is not configless`);
  }
  // THE AUTHOR'S OWN FIELDS PLUS THE ERROR PATH, validated and frozen as one list — so
  // the appended pair meets every rule below, `when` can name its sibling, and the form
  // draws them exactly as it draws the rest.
  const all = failable ? [...fields, ...errorPathFields(retryable === true)] : fields;
  for (const f of all) {
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
    // ⚠ A FIELD THAT TAKES REFERENCES MAY SAY WHAT KIND OF VALUE IT WANTS, and absent
    // means `text` — which is what every field that has ever existed here wants, so
    // nothing moves. It is checked against `VALUE_TYPES` rather than left free, because
    // an `accepts: "lsit"` would silently accept everything: `TYPE_ACCEPTS[undefined]`
    // is `undefined`, and a lookup nothing can satisfy reads exactly like no wall at all.
    // ⚠ **WHAT A REFUSAL SAYS WHEN A REQUIRED FIELD IS BLANK, DECLARED ON THE FIELD.**
    //
    // Found by widening the cross-product census to drive an empty required field: the
    // site's generic reader said `"left can't be empty"` — naming a key nobody's screen
    // calls anything — while this module's own `read` said `"say which value to compare"`.
    // FOUR steps diverged that way and nothing had ever compared them, so a customer read
    // one sentence or the other depending on which door refused. It is written HERE, once,
    // both products read it, and the census compares it.
    //
    // **AND IT ONLY MEANS ANYTHING ON A REQUIRED FIELD.** An optional one absent is not a
    // refusal at all, so a sentence for it is a rule nothing reads.
    if (f.empty !== undefined) {
      if (!isText(f.empty)) throw new TypeError(`defineStep(${type}): field ${f.name}'s empty must be a sentence`);
      if (f.required !== true) {
        throw new TypeError(`defineStep(${type}): field ${f.name} says what to say when it is blank but is not required`);
      }
    }
    if (f.accepts !== undefined) {
      if (!VALUE_TYPES.includes(f.accepts)) {
        throw new TypeError(`defineStep(${type}): field ${f.name} accepts ${String(f.accepts)}, which is not one of ${VALUE_TYPES.join(", ")}`);
      }
      // AND A FIELD THAT DOES NOT TAKE REFERENCES CANNOT HAVE AN OPINION ABOUT THEM. The
      // pair would be a rule nothing reads, which is a dead declaration rather than a
      // dead control — cheaper, and still worth refusing at author time.
      if (f.refs !== true) {
        throw new TypeError(`defineStep(${type}): field ${f.name} says what it accepts but does not take references`);
      }
    }
    if (f.when !== undefined) {
      if (!f.when || typeof f.when !== "object" || Array.isArray(f.when)) {
        throw new TypeError(`defineStep(${type}): field ${f.name} has a "when" that is not a condition`);
      }
      for (const [on, allowed] of Object.entries(f.when)) {
        if (!all.some((o) => o?.name === on)) {
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
  // ⚠ **WHAT A STEP PRODUCES IS THE STEP'S OWN FACT, DERIVED HERE AND NEVER DECLARED BY A
  // CALLER.** A step knows what kind of thing its answer is; a model or a form guessing is
  // a type that can be WRONG, and a wrong type is worse than no type — it would refuse a
  // legitimate reference and accept an illegitimate one, both silently. Absent means `text`,
  // which is what every step here has always produced.
  if (spec.produces !== undefined && !VALUE_TYPES.includes(spec.produces)) {
    throw new TypeError(`defineStep(${type}): produces ${String(spec.produces)}, which is not one of ${VALUE_TYPES.join(", ")}`);
  }
  /**
   * ⚠ **WHAT EVERY REFUSAL ABOUT A FIELD CALLS IT, DERIVED FROM THE FIELD ITSELF.**
   *
   * A step's `read` used to carry its own phrases as literals — `"the comparison"`,
   * `"the number of minutes to wait"` — while the site builder's generic reader named the
   * field's KEY. MEASURED over every step and every field: **15 divergent sentences across
   * 11 fields**, so a customer read one or the other depending on which door turned them
   * away. The word lives on the field as `says` and BOTH doors read it; absent means the
   * name, which is what every field whose key is already the customer's word wants.
   */
  const words = Object.freeze(Object.fromEntries(all.map((f) => [f.name, isText(f.says) ? f.says : f.name])));
  /**
   * ⚠ **AND THE BLANK-FIELD SENTENCE COMES FROM THE SAME PLACE, which closed a second copy
   * that had just been created.** Declaring `empty` on the field left every `read` still
   * carrying the same sentence as a literal — two copies of one string, in one file, and the
   * copy that drifts is whichever one somebody edits. `say.blank(name)` is the field's own,
   * and absent falls back to what the site's generic reader composes.
   */
  const blanks = Object.freeze(Object.fromEntries(all.map((f) =>
    [f.name, isText(f.empty) ? f.empty : `${words[f.name]} can't be empty`])));
  const say = (name) => words[name] ?? name;
  say.blank = (name) => blanks[name] ?? `${say(name)} can't be empty`;
  Object.freeze(say);
  return Object.freeze({
    kind: "step", type, stepKind: kind, label, does, words,
    configless: configless === true,
    decided: decided === true,
    produces: spec.produces ?? "text",
    failable, retryable: retryable === true,
    fields: Object.freeze(all.map((f) => Object.freeze({
      ...f,
      ...(f.options ? { options: Object.freeze([...f.options]) } : {}),
      ...(f.when ? { when: Object.freeze(Object.fromEntries(
        Object.entries(f.when).map(([k, vs]) => [k, Object.freeze([...vs])]))) } : {}),
    }))),
    // THE WORDS ARE HANDED IN, so a `read` cannot carry a phrase of its own and no step
    // author has to remember to. A reader written before this ignores the second argument
    // and behaves exactly as it did.
    read: (raw) => read(raw, say),
    run,
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
const OUT_FIELD = Object.freeze({
  name: "out", kind: "name", required: false,
  /**
   * ⚠ **WHAT A REFUSAL CALLS IT, AND IT WAS MISSING HERE WHILE THE SITE HAD IT.** Found by
   * widening the cross-product census to compare `says`, which nothing had ever compared —
   * so for however long, the two halves described one control with two different words. The
   * engine's `readOut` writes its own sentences and never reads this, so adding it changes
   * no behaviour at all; what it fixes is the DECLARATION, which is the thing a form draws
   * from and the thing the census can see. *A drift nothing compares is a drift nothing
   * reports.*
   */
  says: "the name for this step's answer",
});

/**
 * Read an `out` name, which is optional everywhere and refused rather than repaired.
 *
 * ⚠ **`said` IS REQUIRED AND HAS NO DEFAULT, because this reader serves TWO fields.**
 * Five call sites pass `say("out")` and one passes `say("as")` — the loop's *what to call
 * each one* — so any default is one field's words used about the other, and a sentence
 * that names the wrong control sends somebody to a box that is not the one they filled
 * in. A default was a second copy of `OUT_FIELD.says` as well, and the copy that drifts
 * is whichever one somebody edits: the cross-product census compares the DECLARATION, so
 * a default keeping the old phrase alive for a forgetful caller would be a drift that
 * census is structurally unable to see. Without one, a caller that forgets composes
 * `undefined didn't arrive as a name`, which is FOUND — where a plausible wrong phrase
 * is not. *A filter is a silent drop; a check is a sentence*, applied to the sentence.
 */
function readOut(raw, said) {
  if (raw?.out === undefined || raw?.out === null || raw?.out === "") return { out: null };
  if (typeof raw.out !== "string") return { error: `${said} didn't arrive as a name` };
  const out = raw.out.trim().toLowerCase();
  if (!REF_NAME.test(out)) {
    return { error: `"${raw.out}" can't be a name — use lower-case letters, digits and underscores, starting with a letter` };
  }
  return { out };
}

/**
 * An EVENT NAME, which is its own field kind and not a `name` with a pattern on top.
 *
 * ⚠ **THE TWO DOORS READ A FIELD BY ITS KIND, so a shape enforced anywhere else cannot
 * reach both.** The site builder's `readStepField` is generic over `FIELD_KINDS` and knows
 * nothing about one step's `read`; a regex applied only in the engine's own reader would
 * mean the screen and the engine disagreeing about what may be saved — and MEASURED, they
 * would disagree in the direction that matters: the site's `name` kind refuses a dot, so
 * `order.paid` could not be saved through the screen at all while the engine accepted it.
 * A kind is already censused both ways, so this puts the shape in exactly one place per
 * product.
 *
 * **IT IS THE DATABASE'S OWN GRAMMAR** (`events_name_shaped`), pinned here as an external
 * constraint: a name that saves has to be a name an event can carry.
 */
function readEventName(raw, { what, blank }) {
  if (raw === undefined || raw === null || raw === "") return { error: blank };
  if (typeof raw !== "string") return { error: `${what} didn't arrive as a name` };
  const name = raw.trim().toLowerCase();
  if (!EVENT_NAME.test(name)) {
    return { error: `${what} has to be a short name: lower-case letters, digits, dots, dashes and underscores, starting with a letter` };
  }
  return { value: name };
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
/**
 * WHAT AN AUTOMATION'S ID LOOKS LIKE, pinned as the DATABASE's grammar rather than ours:
 * `agent.automations.id` is a uuid, so anything else can only be a caller's mistake and is
 * refused rather than handed to a lookup that cannot find it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * ⚠ **A NON-STRING IS THE WRONG KIND, NOT BLANK — and reading it as blank was a coercion.**
 * `readTextField` answered `{empty: true}` for a list or a number, so a required field given
 * `["hi"]` got the "say what to write" sentence while the other door said it did not arrive
 * as text. "Refuse, never coerce" in the reader every text field goes through.
 */
function readTextField(raw, { what, max }) {
  if (raw === undefined || raw === null || raw === "") return { empty: true };
  if (typeof raw !== "string") return { error: `${what} didn't arrive as text` };
  const text = raw.trim();
  if (!text) return { empty: true };
  if (text.length > max) return { error: `${what} is longer than it can be (${max} characters)` };
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
  fields: [{ name: "days", kind: "days", required: true, empty: "pick at least one day, or take this step out" }],
  read: (raw, say) => {
    const days = raw?.days;
    if (!Array.isArray(days)) return { error: "pick which days it should run on" };
    if (!days.length) return { error: say.blank("days") };
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
  fields: [{ name: "text", kind: "text", required: true, max: MAX_NOTE, refs: true, says: "that note",
    empty: "say what the note should say" }, OUT_FIELD],
  read: (raw, say) => {
    const t = readTextField(raw?.text, { what: say("text"), max: MAX_NOTE });
    if (t.error) return { error: t.error };
    if (t.empty) return { error: say.blank("text") };
    const o = readOut(raw, say("out"));
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
    { name: "left", kind: "text", required: true, max: MAX_TEST, refs: true, says: "the value being compared",
      empty: "say which value to compare — {{a name}} usually" },
    { name: "op", kind: "choice", required: true, options: TESTS, says: "the comparison" },
    { name: "right", kind: "text", required: true, max: MAX_TEST, refs: true, when: { op: ["is", "is not", "contains"] },
      says: "what it is compared against", empty: "say what to compare it against" },
  ],
  read: (raw, say) => {
    const left = readTextField(raw?.left, { what: say("left"), max: MAX_TEST });
    if (left.error) return { error: left.error };
    if (left.empty) return { error: say.blank("left") };
    const op = readChoice(raw?.op, { name: say("op"), options: TESTS });
    if (op.error) return { error: op.error };
    const needsRight = op.value === "is" || op.value === "is not" || op.value === "contains";
    const right = readTextField(raw?.right, { what: say("right"), max: MAX_TEST });
    if (right.error) return { error: right.error };
    // ⚠ THE OP IS NO LONGER IN THIS SENTENCE, and that is the trade the one-word rule makes:
    // the operator is on the same row of the form, and one sentence from one place is worth
    // more than an interpolation the other door cannot produce.
    if (needsRight && right.empty) return { error: say.blank("right") };
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
 * REPEAT — once for each of a list, or a fixed number of times.
 *
 * ⚠ **THE ITERATION IS DURABLE AND THAT IS THE WHOLE REQUIREMENT.** A restart inside
 * iteration three of five resumes AT THREE: it does not start again (which would repeat
 * three iterations of completed effects) and it does not skip (which would lose two).
 * The state lives on the execution row, so it survives a deploy, an eviction and a lost
 * lease — the same argument the position itself rests on.
 *
 * **THE LIST IS SNAPSHOTTED WHEN THE LOOP OPENS**, exactly as an execution's steps are
 * at acceptance and a child's are at the call. A loop that re-read its source each time
 * round could iterate a list that changed under it — and on a resume it would iterate
 * one it had never seen, which is a different workflow from the one that started.
 *
 * **TWO MODES, ONE FIELD EACH, AND NEVER BOTH.** `when` hides the one the answer has
 * made irrelevant and refuses a value nothing will read — the rule `wait` already
 * follows, for the same reason.
 */
const LOOP_MODES = Object.freeze(["each", "times"]);

const repeat = defineStep({
  type: "repeat",
  kind: "branch",
  label: "Repeat …",
  does: "Runs the steps under it once for each thing in a list, or a fixed number of times. Put an \"End of the repeat\" below it.",
  fields: [
    { name: "mode", kind: "choice", required: true, options: LOOP_MODES, says: "what this repeats over" },
    // ⚠ THE ONE FIELD IN THIS PRODUCT THAT ACCEPTS ONLY A LIST, and it is why types
    // exist at all: without it a `type` on a value would be a label nothing reads.
    { name: "each", kind: "text", required: true, max: MAX_TEST, refs: true, accepts: "list",
      says: "the list to go through", empty: "say which list to go through — {{a name}}",
      when: { mode: ["each"] } },
    { name: "times", kind: "number", required: true, min: 1, max: MAX_LOOP_ITERATIONS,
      says: "how many times", when: { mode: ["times"] } },
    // WHAT EACH ONE IS CALLED INSIDE THE LOOP. Compelled for `each`, because a list you
    // cannot name is a list you cannot use; meaningless for `times`, which counts rather
    // than iterates anything.
    { name: "as", kind: "name", required: true, says: "what to call each one", when: { mode: ["each"] } },
  ],
  read: (raw, say) => {
    const mode = readChoice(raw?.mode, { name: say("mode"), options: LOOP_MODES });
    if (mode.error) return { error: mode.error };
    if (mode.value === "each") {
      const each = readTextField(raw?.each, { what: say("each"), max: MAX_TEST });
      if (each.error) return { error: each.error };
      if (each.empty) return { error: say.blank("each") };
      const as = readOut({ out: raw?.as }, say("as"));
      if (as.error) return { error: as.error };
      if (!as.out) return { error: "say what to call each one, so the steps under it can use it" };
      return { config: { mode: "each", each: each.text, as: as.out, times: null } };
    }
    const times = readNumber(raw?.times, { name: say("times"), min: 1, max: MAX_LOOP_ITERATIONS });
    if (times.error) return { error: times.error };
    return { config: { mode: "times", each: null, as: null, times: times.value } };
  },
  // ⚠ **IT DECIDES NOTHING AND THAT IS DELIBERATE.** A loop is control flow, so the
  // executor owns it — exactly as `if` computes its comparison here and the JUMP there.
  // What this cannot do is resolve the list, because `fillConfig` has already turned a
  // `{{name}}` into TEXT by the time a `run` sees it, and a list rendered as text is the
  // `String(["a"])` trap. The executor reads the value itself, by name.
  run: () => ({}),
});

const repeatEnd = defineStep({
  type: "endrepeat",
  kind: "branch",
  label: "End of the repeat",
  does: "Closes the \"Repeat\" above it. Everything after this runs once, when the loop has finished.",
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
    { name: "mode", kind: "choice", required: true, options: WAIT_MODES, says: "the kind of wait" },
    { name: "minutes", kind: "number", required: true, min: 1, max: MAX_WAIT_MINUTES, when: { mode: ["for"] },
      says: "the number of minutes to wait" },
    { name: "at", kind: "time", required: true, when: { mode: ["until"] }, says: "the time to wait until" },
  ],
  read: (raw, say) => {
    const mode = readChoice(raw?.mode, { name: say("mode"), options: WAIT_MODES });
    if (mode.error) return { error: mode.error };
    if (mode.value === "for") {
      const m = readNumber(raw?.minutes, { name: say("minutes"), min: 1, max: MAX_WAIT_MINUTES });
      if (m.error) return { error: m.error };
      return { config: { mode: "for", minutes: m.value, at: null } };
    }
    const t = readTime(raw?.at, { name: say("at") });
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
 * WAIT FOR AN EVENT — a wait whose resume is something that happened.
 *
 * ⚠ **THE ARRIVAL RACE IS THE WHOLE OF WHY THIS STEP IS SMALL.** It asks for a NAME and
 * nothing else, and the matching is the database's: the dispatcher looks for suspended
 * executions waiting on that name, and the pause's own transaction looks for an event that
 * arrived before it was recorded. Both take this execution's row lock, so an event landing at
 * the moment the wait starts is seen by exactly one of them — never lost, never twice.
 *
 * **`decided: true`, FOR THE SAME REASON AN APPROVAL IS**: what it heard is stored under this
 * step's own id (`automation_runs.heard`), so inside a loop the second round would find the
 * first round's event already there and carry on without waiting. Refused where the workflow
 * is written, by the one flag.
 *
 * **IT COMPUTES NO DEADLINE, AND HAS NONE.** An event wait that timed out would need a second
 * configured outcome and a second reader; what a customer wants instead is a `wait` beside it,
 * which this product already has. Said out loud because "it waits for ever" is a real answer
 * and looks like a missing feature.
 */
const EVENT_WAIT = defineStep({
  type: "event",
  kind: "pause",
  // ⚠ ITS RESUME IS KEYED BY THIS STEP'S ID AND THE FIRST ARRIVAL STANDS — `heard` is a map
  // keyed by step, accumulated and never cleared, exactly as `decisions` is. So it carries
  // the approval's own loop wall for the approval's own reason: inside a `repeat`, round two
  // would read round one's event and carry on with NO SECOND EVENT. Making it per-round means
  // keying `heard` by the outcome key, which is a migration and is not this.
  decided: true,
  label: "Wait for something to happen",
  does: "Pause until an event of a given name reaches this agent, then carry on with what it carried.",
  fields: [
    { name: "name", kind: "event", required: true, says: "the name of the event to wait for",
      empty: "say which event to wait for" },
    OUT_FIELD,
  ],
  read: (raw, say) => {
    const name = readEventName(raw?.name, { what: say("name"), blank: say.blank("name") });
    if (name.error) return { error: name.error };
    // ⚠ **`OUT_FIELD` IN `fields` IS WHAT THE FORM DRAWS; THIS IS WHAT MAKES IT MEAN
    // ANYTHING.** The first draft had the field and not this line, so the box was drawn, the
    // answer was read off the form, and `readWorkflow` never learned the step produced a
    // name — `{{it}}` came back as "nothing here produces a value called it" about a step
    // whose whole job is to produce one. A field a `read` drops is a dead control.
    const o = readOut(raw, say("out"));
    if (o.error) return { error: o.error };
    return { config: { name: name.value, out: o.out } };
  },
  run: (config, ctx) => {
    const said = `waiting for ${config.name}`;
    if (!ctx.resume) return { waiting: { kind: "event", ...config }, why: said };
    const heard = ctx.resume.heard;
    // ⚠ **NOTHING HEARD YET IS A RE-PAUSE, NOT A FAILURE.** A delivery can arrive for another
    // reason entirely — the sweeper, a resume somebody pressed — and reading that as "the
    // event did not happen" would end a run that is waiting perfectly well.
    if (!heard || typeof heard !== "object") return { waiting: { kind: "event", ...config }, why: `${said} — nothing yet` };
    /**
     * ⚠ **THE PAYLOAD IS RENDERED AS TEXT, AND THAT IS A DELIBERATE RENDERING RATHER THAN A
     * COERCION.** `agent.events.payload` is a jsonb OBJECT by its own constraint, and this
     * product's reference syntax is deliberately small — a name and nothing else, no property
     * paths — so the whole thing is what there is to bind. `JSON.stringify` here is explicit
     * and is not `String(["a"])`: the value is written down the way the database holds it.
     *
     * **AN EMPTY PAYLOAD BINDS `""`, NOT `"{}"`.** "The event carried nothing" is what an
     * empty object means, and `""` is the answer every other binder already gives for
     * nothing — so `{{it}}` reads as empty rather than as two braces in somebody's note.
     *
     * **THE LIMITATION IS STATED**: one field of a payload is not reachable until references
     * carry property paths, which is not built and is a language rather than an increment.
     */
    const carried = heard.payload;
    const bind = carried && typeof carried === "object" && Object.keys(carried).length
      ? JSON.stringify(carried)
      : "";
    return { done: true, why: `${config.name} happened`, bind };
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
  // ITS RESUME IS A DECISION STORED UNDER THIS STEP'S ID — see `defineStep`'s own note.
  decided: true,
  label: "Wait for approval",
  does: "Pause and ask to be approved or rejected before carrying on. Say what happens if nobody answers in time.",
  fields: [
    { name: "ask", kind: "text", required: true, max: MAX_ASK, refs: true, says: "what is being approved",
      empty: "say what is being approved" },
    { name: "hours", kind: "number", required: true, min: 1, max: MAX_APPROVAL_HOURS,
      says: "how many hours to wait for an answer" },
    { name: "on_timeout", kind: "choice", required: true, options: TIMEOUT_OUTCOMES,
      says: "what happens if nobody answers" },
  ],
  read: (raw, say) => {
    const ask = readTextField(raw?.ask, { what: say("ask"), max: MAX_ASK });
    if (ask.error) return { error: ask.error };
    if (ask.empty) return { error: say.blank("ask") };
    const hours = readNumber(raw?.hours, { name: say("hours"), min: 1, max: MAX_APPROVAL_HOURS });
    if (hours.error) return { error: hours.error };
    const on = readChoice(raw?.on_timeout, { name: say("on_timeout"), options: TIMEOUT_OUTCOMES });
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
 * SEND SOMETHING THROUGH A CONNECTED ACCOUNT — and it is ONE step, not two.
 *
 * Milestone 12: *let scheduled and event-triggered workflows invoke supported actions
 * through the same backend operations used by chat tools … show the customer the selected
 * connection, recipient, and exact message before approval. The approved action must
 * execute with those values.* And, in as many words: ***a generic approval step followed by
 * an independently constructed send is insufficient.***
 *
 * ⚠ **SO THE APPROVAL AND THE SEND ARE THE SAME STEP, AND THAT IS THE WHOLE DESIGN.** Two
 * steps — `approval` then `send` — is the shape the requirement forbids, and forbids for a
 * reason that is easy to miss: the second step re-resolves its own `{{references}}` at its
 * own moment, so a value that moved between the two (a later-arriving lookup, an edited
 * template, a memory somebody corrected) is approved in one shape and sent in another, with
 * every step reading correctly and nothing anywhere to compare. Here the payload is resolved
 * ONCE, hashed, shown, approved against that hash, and performed from the same object.
 *
 * ── ⚠ IT IS A `pause`, AND ITS ANSWER IS STILL THE EXECUTION'S RESULT ────────
 *
 * Only a `pause` can suspend an execution, so that is the kind. What it costs is that the
 * pause tail, not the action tail, writes its outcome — so `result` is carried through
 * there deliberately (see the executor), because what this step did is exactly the sort of
 * thing a customer's history is FOR.
 *
 * ── ⚠ NOTHING HERE IS A SECOND IMPLEMENTATION OF ANYTHING ───────────────────
 *
 * The approval is `makeApprovals(...).forRun(...).ask(...)` — the same function, the same
 * table and the same site routes a chat tool's approval uses, so expiry, revocation,
 * first-decision-stands, duplicate presses and `stale` are REUSED rather than rebuilt. The
 * action is `connections.perform(...)` — the same function `send_message` calls, so the
 * connection's scopes, the credential's one door, the operation record and the
 * reconciliation of an uncertain write are reused too. **This step contributes no wall of
 * its own to either.**
 *
 * ── ⚠ AND IT MAY GO IN A LOOP, WHICH THE `approval` STEP MAY NOT ────────────
 *
 * That step is `decided: true` because its resume is `decisions[<step id>]` and the first
 * decision at a key stands — so round two would take round one's answer with nobody asked.
 * This one is keyed `(run, position, iteration)`: every round asks its own question and
 * carries its own operation identity, so the hazard is absent rather than guarded. It reads
 * no `ctx.resume.decision` at all; asking IS reading.
 */
const SEND_TOOL = "send_message";
/**
 * WHICH ACTION A SEND STEP ASKS ITS ADAPTER FOR, and it is EXPORTED so a reader outside this
 * module can ask which permission a send needs rather than holding a second copy of the word.
 *
 * ⚠ **THE SITE BUILDER'S SCREEN IS THAT READER.** It has to know which scope to look for on a
 * connection before offering it as one a send could go through, and `adapter.scopes[<action>]`
 * is the only place that mapping lives. Neither product may import the other, so the site's
 * provider catalog carries a declared copy — and the cross-product census reads THIS name and
 * the adapter's own map, so the copy cannot drift into offering an account that cannot send.
 */
export const SEND_ACTION = "send_message";
/** How long a recipient and a message may be. The provider's own payload, bounded here. */
export const MAX_RECIPIENT = 200;
export const MAX_MESSAGE = 4000;

/**
 * WHEN TO WAKE AN EXECUTION THAT IS WAITING TO BE APPROVED, in whole hours.
 *
 * ⚠ **IT IS DERIVED FROM THE WINDOW THE DATABASE REPORTED AND IS NEVER A SECOND COPY OF
 * IT.** `agent.tool_approvals.expires_at` is the one authority on whether a request can
 * still be answered — `decide_tool_approval` refuses past it — so this is only a wake-up,
 * and it is ROUNDED UP so the execution is never woken BEFORE the window closes. Woken
 * early it would re-ask, find the request still pending, and re-pause on a deadline the
 * database keeps, which is a row the scheduler offers every minute for ever.
 */
export const wakeHours = (expiresAt, now) => {
  const at = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(at) || !Number.isFinite(now)) return 1;
  return Math.max(1, Math.min(MAX_APPROVAL_HOURS, Math.ceil((at - now) / 3600000)));
};

/**
 * WHAT A CONNECTION THAT CANNOT BE USED SAYS, and each of the three is a different act with
 * a different remedy — which is the requirement in as many words (*understand why an
 * expired or revoked connection cannot be used*). A single "that connection does not work"
 * would send somebody to reconnect when a refresh is what is wanted, or to refresh what
 * only the provider can put back.
 */
const CONNECTION_TROUBLE = Object.freeze({
  expired: "the credential for that connection has run out — refresh it and run this again",
  revoked: "the provider withdrew access to that connection — it has to be connected again",
  disconnected: "that connection was disconnected, so nothing can be sent through it",
});


/**
 * WHAT A WORKFLOW NEEDS THAT IS NOT IN THE WORKFLOW — checked before it runs, and kept
 * strictly apart from whether it READS.
 *
 * ⚠ **STRUCTURE AND DEPENDENCIES ARE TWO ANSWERS AND COLLAPSING THEM MISLEADS BOTH WAYS.**
 * `readWorkflow` says whether the steps are a workflow at all: an unknown action, a branch
 * that does not balance, a `{{reference}}` nothing produces. Those cannot be fixed by
 * anything outside the list, so they are a REFUSAL. What is here is different in kind — an
 * account not connected yet, a permission the provider has not granted, a subworkflow
 * somebody is about to make, a time zone nobody has set. **Every one of them can be true
 * tomorrow without the workflow changing a character**, so reporting them as refusals would
 * tell somebody their workflow is wrong when it is their account that is not ready; and
 * reporting them as nothing at all is the check saying "fine" about a workflow whose first
 * send will fail.
 *
 * ⚠ **AND "COULD NOT ASK" IS A THIRD ANSWER, never a satisfied one.** These questions are
 * about rows, so a store that is absent or unreachable leaves them unanswered — and reading
 * that as "nothing is missing" is the one direction that produces a confident check about a
 * workflow nobody looked at. *Cannot-tell must never read as a value.*
 *
 * ⚠ **IT IS PURE AND TAKES THE ANSWERS, so the same rule serves both doors.** A tool reads
 * the rows through the capability surface and a person's screen reads them through its own
 * route; handing the lists in is what lets one function decide, rather than two readings that
 * agree until one is edited. `null` means "not read"; `[]` means "read, and there are none",
 * which is a real answer and a real dependency.
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
      /**
       * ⚠ **THE PERMISSION IS THE CONNECTION'S OWN SCOPE, and it is the provider's word for
       * it rather than ours.** `lease` refuses a send through an account granted reading and
       * not sending, so an account that is perfectly `active` can still be unable to do the
       * one thing this step is for — which reads to somebody as the step being broken. The
       * scope a send needs comes from the adapter, per PROVIDER, because a second provider
       * may spell its own differently; a caller that hands in no map cannot ask.
       */
      const need = sendScopes && typeof sendScopes === "object"
        ? sendScopes[row.provider] : undefined;
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

  /**
   * ⚠ **A TIMED SCHEDULE NEEDS A TIME ZONE AND IT IS THE ACCOUNT'S, so it is a dependency
   * rather than a field of the workflow.** Nothing in the steps can supply one — a model may
   * not choose one at all — so a create refuses `no-zone` until somebody sets it on the
   * settings form. Reporting that as a structural error would send them to edit their steps.
   */
  if (zone !== null) {
    if (zone.needed && !zone.have) {
      want("zone", zone.schedule ?? "", "nobody has set a time zone for this agent yet, so a "
        + "timed schedule has no local time to run at — set one in its settings");
    }
  }
  return { needs, unchecked };
}

const sendStep = defineStep({
  type: "send",
  kind: "pause",
  label: "Send a message",
  does:
    "Send a message from one of this agent's connected accounts. A person is shown the " +
    "account, who it is for and the exact words, and has to approve it before it goes. " +
    "Put {{a name}} anywhere in the recipient or the message to use an input or an " +
    "earlier step's answer.",
  fields: [
    { name: "connection", kind: "id", required: true, says: "which connected account to send from",
      empty: "say which connected account to send from" },
    { name: "to", kind: "text", required: true, max: MAX_RECIPIENT, refs: true,
      says: "who it is for", empty: "say who it is for" },
    { name: "body", kind: "text", required: true, max: MAX_MESSAGE, refs: true,
      says: "what it says", empty: "say what it should say" },
    OUT_FIELD,
  ],
  // ⚠ REFUSED, NEVER COERCED, and the connection is read exactly as `subworkflow` reads
  // its own id — absent and wrong-kind are two refusals because they need two different
  // things done about them.
  read: (raw, say) => {
    const given = raw?.connection;
    if (given === undefined || given === null || given === "") return { error: say.blank("connection") };
    if (typeof given !== "string") return { error: "which connected account to send from didn't arrive as a connection" };
    const id = given.trim().toLowerCase();
    if (!id) return { error: say.blank("connection") };
    if (!UUID.test(id)) return { error: "which connected account to send from didn't arrive as a connection" };
    const to = readTextField(raw?.to, { what: say("to"), max: MAX_RECIPIENT });
    if (to.error) return { error: to.error };
    if (to.empty) return { error: say.blank("to") };
    const body = readTextField(raw?.body, { what: say("body"), max: MAX_MESSAGE });
    if (body.error) return { error: body.error };
    if (body.empty) return { error: say.blank("body") };
    const o = readOut(raw, say("out"));
    if (o.error) return { error: o.error };
    return { config: { connection: id, to: to.text, body: body.text, out: o.out } };
  },
  run: async (config, ctx) => {
    if (typeof ctx.connections?.perform !== "function" || typeof ctx.connections?.list !== "function") {
      // ⚠ TWO CAUSES, ONE SENTENCE TO THE CUSTOMER AND TWO IN THE LOG. A deployment with no
      // connection store and an execution whose agent could not be scoped are different
      // problems for an operator and the same fact for somebody reading their history: this
      // one could not send. The runner logs which; this says what it means.
      return { failed: "this execution cannot reach any connected account, so nothing was sent" };
    }
    if (typeof ctx.approve !== "function") {
      return { failed: "there is nowhere to ask for this to be approved, so nothing was sent" };
    }
    if (!ctx.at || !isText(ctx.at.run)) {
      return { failed: "this execution has no identity recorded, so a send could not be made safe to retry" };
    }

    /**
     * ⚠ **THE CONNECTION IS RESOLVED BEFORE THE APPROVAL, because the approval has to SHOW
     * which account it is.** A request that said only "connection 8f3c…" is one nobody can
     * answer honestly. And the row is read through `list`, which selects no credential —
     * the lease is `perform`'s business and happens after somebody has said yes.
     *
     * ⚠ **`list()` ANSWERS A BARE ARRAY, and reading it as `rows.connections` is what this
     * step shipped with.** That is the site ROUTE's shape, not the store's — `readRows`
     * answers the rows themselves and `list_connections` reads `rows.length` directly, so
     * this was the one caller reading a key nothing produces. MEASURED through the real
     * store: the find ran over `[]` every time and **every send failed "that connected
     * account is not one of this agent's" whatever was connected** — the whole step dead,
     * with eleven green guards over it, because the bench answered `{connections: rows}`.
     * *A fake in a different shape from the real producer hides a defect exactly as well as
     * one that is less capable*, and the fixture is derived from `readRows` now.
     */
    let rows;
    try { rows = await ctx.connections.list(); }
    catch (e) { return { failed: `the connected accounts could not be read: ${String(e?.message ?? e)}` }; }
    const row = (Array.isArray(rows) ? rows : []).find((c) => c?.id === config.connection);
    if (!row) return { failed: "that connected account is not one of this agent's" };
    if (row.status !== "active") {
      return { failed: CONNECTION_TROUBLE[row.status] ?? "that connected account cannot be used" };
    }

    /**
     * ⚠ **WHAT IS APPROVED IS WHAT IS SENT, AND THIS OBJECT IS BOTH.** It is built once,
     * hashed by `ask`, stored on the request a person reads, and handed to `perform`
     * unchanged. Editing the workflow changes `to` or `body`, which changes the hash, which
     * the database answers `stale` — *editing them requires fresh approval*, enforced by
     * arithmetic rather than by anybody remembering.
     *
     * The provider and the account ride in it deliberately: they are what a person needs to
     * see, and including them means a connection swapped for another account's is a
     * different payload rather than the same one wearing a new id.
     */
    const payload = {
      connection: config.connection, provider: row.provider, account: row.account,
      to: config.to, body: config.body,
    };

    let asked;
    try { asked = await ctx.approve({ step: ctx.at.step, index: ctx.at.index, tool: SEND_TOOL, args: payload }); }
    catch (e) {
      // ⚠ **AN ASK THAT FAILED IS NOT A VERDICT.** Read as "not approved" an outage stops
      // every automation; read as approved it is an outage authorising a send. It is a
      // failure of ours, and the step's own error path decides what happens next.
      return { failed: `this could not be put to anybody for approval: ${String(e?.message ?? e)}` };
    }

    const said = `send to ${payload.to} from ${payload.account}`;
    if (asked.state === "pending") {
      /**
       * ⚠ **THE PAUSE'S DEADLINE IS THE APPROVAL'S OWN WINDOW, read back from the database
       * rather than chosen here.** Two clocks for one wait is two copies of the window, and
       * the copies disagree the moment either drifts — so `hours` is derived from
       * `expiresAt` and the only thing that decides whether the window closed is the
       * database, which is also what refuses a late decision.
       */
      return {
        waiting: {
          kind: "approval", ask: said, hours: wakeHours(asked.expiresAt, ctx.now), on_timeout: "fail",
          /**
           * ⚠ **WHICH REQUEST ANSWERS THIS PAUSE, and without it the screen presses the wrong
           * door.**
           *
           * An `approval` STEP's pause and this one are byte-identical in shape — both
           * `{kind: "approval", ask, hours, on_timeout}` — and they are answered by two
           * DIFFERENT functions: a step's decision goes to `agent.decide_automation_approval`,
           * keyed by run and step, while a send is gated by a TOOL approval bound to its
           * payload's hash and answered by `agent.decide_tool_approval`, keyed by the
           * request's own id. MEASURED before this line existed: the execution history's
           * Approve button sent the step's decision, the database answered `ok`, the run was
           * requeued, `ctx.approve` found its request still pending and the workflow paused at
           * the same step again — for ever, with nothing sent and a decision recorded where
           * nothing reads it. **A dead control that ANSWERS, and answers `ok`.**
           *
           * It is the request's id rather than a flag, because the tool door needs exactly
           * that value: the two mechanisms do not even number their steps the same way (this
           * pause's `step` is `"s3"` and the request's is the index `2`), so nothing could
           * match them without a mapping. Naming the request is the direct answer.
           */
          request: isText(asked.id) ? asked.id : null,
        },
        why: `waiting to be approved: ${said}`,
      };
    }
    if (asked.state === "rejected") {
      return { stop: { reason: "rejected", why: isText(asked.note) ? `not approved: ${asked.note}` : "not approved" } };
    }
    // ⚠ FOUR REFUSALS, NEVER ONE. Somebody said no; the window closed with nobody
    // answering; the permission was withdrawn; and the payload no longer matches what was
    // shown. They want opposite things done about them, and a customer reading one wants
    // to know which it was.
    if (asked.state === "expired") {
      return { failed: "nobody approved this in time, so nothing was sent" };
    }
    if (asked.state === "revoked") {
      return { failed: "permission to send was withdrawn, so nothing was sent" };
    }
    if (asked.state === "stale") {
      return { failed: "this was changed after it was put up for approval, so it needs approving again and nothing was sent" };
    }
    if (asked.state !== "approved") {
      // A STATE THIS DEPLOYMENT DOES NOT KNOW IS NOT AN APPROVAL. Cannot-tell must never
      // read as a value, and here the value would be somebody's permission.
      return { failed: `this could not be told whether it was approved (${String(asked.state)}), so nothing was sent` };
    }

    /**
     * APPROVED — so the action runs, through the same operation a chat tool uses, with the
     * identity that makes a redelivery reconcile instead of sending again.
     */
    /**
     * ⚠ **FROM `payload`, AND THAT IS MEASURED INERT AGAINST `config` — WHICH IS THE POINT.**
     *
     * `fillConfig` fills every `refs: true` field before `run` is called, so `config.to` and
     * `payload.to` are the same string and a mutant swapping them changes nothing. Written
     * down because the conclusion is the design: **the "approve one thing, send another"
     * hazard is not reachable inside one step** — it needs TWO, each resolving its own
     * references at its own moment, which is exactly the shape the requirement rules out and
     * exactly why this is one step. What `payload` carries that `config` cannot is the
     * PROVIDER and the ACCOUNT, which is what a person has to be shown, and a mutant that
     * drops either of those is observable and dies.
     */
    const done = await ctx.connections.perform({
      connection: payload.connection, action: SEND_ACTION,
      args: { to: payload.to, body: payload.body },
      operation: `${ctx.at.run}:${ctx.at.step}:${ctx.at.index}:${asked.hash ?? ""}`,
    });

    if (done?.ok === true) {
      const msg = isText(done.result?.message) ? done.result.message : null;
      return {
        result: `sent to ${payload.to} from ${payload.account}${msg ? ` (${msg})` : ""}`,
        bind: msg ?? "",
        sent: true, message: msg, prepared: payload.body,
        // ⚠ THE PROVIDER'S OWN ANSWER SAYS IT IS SIMULATED, AND IT IS CARRIED RATHER THAN
        // RE-STATED HERE. Connecting a real provider stops the label with no change to any
        // reader, which is what makes it a fact about the run rather than a constant.
        simulated: done.result?.simulated === true,
        repeat: done.repeat === true,
        why: `sent to ${payload.to} from ${payload.account}${done.repeat === true ? " (already sent — this delivery did not send it again)" : ""}`,
      };
    }

    /**
     * ⚠ **AN UNCERTAIN SEND IS NOT A FAILURE AND MUST NOT READ AS ONE.** `perform` has
     * already asked the provider what it holds; `unresolved` is what is left when nobody can
     * say. So the step FAILS — the workflow must not carry on as though a message went — and
     * the outcome says which of the two it is, because a failure invites doing it again and
     * an unknown invites checking first. **Nothing here retries**: a step declaring
     * `retry` on its error path would re-enter this step, and the operation record is what
     * makes that safe rather than a second message.
     */
    if (done?.error === "unresolved") {
      return {
        failed: isText(done.say) ? done.say : "nobody can say whether that was sent",
        unresolved: true, prepared: payload.body,
      };
    }
    return {
      failed: isText(done?.say) ? done.say : `that could not be sent (${String(done?.error ?? "unknown")})`,
      prepared: payload.body,
    };
  },
});

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
  // ⚠ **THE ONE STEP A SECOND ATTEMPT COULD ANSWER DIFFERENTLY, and it is the only one
  // here that reaches outside this process.** Its `retrieve` is an injected seam to the
  // database, so a refusal can be an outage rather than an answer — which is precisely
  // what a retry is for. Every other step is deterministic given its configuration:
  // `memory` reads a snapshot taken at acceptance, `note` substitutes a string, and
  // `weekday` compares a date that is fixed for the whole execution. Trying any of those
  // again spends a step run to reach the same answer, so `readErrorPath` refuses it.
  retryable: true,
  does: "Search this agent's reference material and save the passages that match, with the source they came from. Put {{a name}} in the search to use an input.",
  fields: [
    { name: "query", kind: "text", required: true, max: MAX_QUERY, refs: true, says: "that search",
      empty: "say what to search for" },
    { ...OUT_FIELD, required: true, empty: "give the answer a name, so a later step can use it" },
  ],
  read: (raw, say) => {
    const q = readTextField(raw?.query, { what: say("query"), max: MAX_QUERY });
    if (q.error) return { error: q.error };
    if (q.empty) return { error: say.blank("query") };
    const o = readOut(raw, say("out"));
    if (o.error) return { error: o.error };
    if (!o.out) return { error: say.blank("out") };
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
    /**
     * ⚠ **BOUNDED ON THE WAY IN AS WELL AS ON THE WAY OUT, because `retrieve` is a SEAM.**
     *
     * The ask carries `MAX_EXCERPTS` and `agent.search_knowledge` clamps its own answer, so on
     * today's path an overrun cannot happen. But retrieval is deliberately an injected
     * one-function contract — *"replacing keyword search is replacing this closure"* — and a
     * bound enforced only by the thing that is meant to be replaceable is not a bound. A
     * vector retriever, a cache, or a `p_limit` that lost count would otherwise put fifty
     * passages into a value a note quotes and fifty entries into the run's sources.
     *
     * MEASURED before this line existed: a retriever answering 50 put all 50 through.
     *
     * **IT TAKES THE FIRST `MAX_EXCERPTS`, and the surplus is not reported to the customer**:
     * an answer longer than was asked for is our own layer miscounting, not a fact about their
     * documents, so it is not something for them to act on. What they read is the number that
     * really reached the workflow.
     */
    const read = readSearch(found);
    const answered = read.excerpts;
    const excerpts = answered.length > MAX_EXCERPTS ? answered.slice(0, MAX_EXCERPTS) : answered;
    if (!excerpts.length) {
      /**
       * ⚠ **THREE DIFFERENT NOTHINGS, THREE DIFFERENT SENTENCES — and until this line they
       * were one.** `searched for "X" and found nothing` was said whether the ask held nothing
       * searchable, whether this agent has no reference material at all, or whether it has
       * some and none of it matched. MEASURED before the change: a stopword-only query and a
       * genuine miss produced BYTE-IDENTICAL outcomes.
       *
       * Only the last of the three is a fact about somebody's documents, and it is the only
       * one worded as one. `searchOutcome` makes the choice so this step and the agent's own
       * `search_reference` tool cannot decide it differently; the WORDS are separate on
       * purpose, because this one is read by a person in an execution's history and that one
       * by a model deciding what to do next.
       *
       * **`unknown` BLAMES NOTHING.** It is what an older database, a reading this cannot
       * parse, or an execution with no agent behind it produces, and saying "your documents do
       * not mention that" about any of them is a claim nothing here is entitled to make.
       */
      const note = {
        "not-searched": `there was nothing to search for in "${config.query}"`,
        "no-sources": `searched for "${config.query}" — this agent has no reference material yet`,
        "no-match": `searched for "${config.query}" and nothing in the reference material matched`,
        "unknown": `searched for "${config.query}" and got no passages back; whether there was anything to match is not something this can say`,
      }[searchOutcome(read)];
      return { value: "", note, sources: [] };
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
    { name: "key", kind: "name", required: true, says: "the saved fact to use",
      empty: "say which saved fact to use" },
    { ...OUT_FIELD, required: true, empty: "give the answer a name, so a later step can use it" },
  ],
  read: (raw, say) => {
    // THE SAME THREE REFUSALS THE SITE'S GENERIC `name` READER MAKES, in the same words:
    // absent, the wrong kind, and a name that is not a name.
    if (raw?.key === undefined || raw?.key === null || raw?.key === "") return { error: say.blank("key") };
    if (typeof raw.key !== "string") return { error: `${say("key")} didn't arrive as a name` };
    const key = raw.key.trim().toLowerCase();
    if (!key) return { error: say.blank("key") };
    if (!REF_NAME.test(key)) {
      return { error: `"${raw.key}" can't be a name — use lower-case letters, digits and underscores, starting with a letter` };
    }
    const o = readOut(raw, say("out"));
    if (o.error) return { error: o.error };
    if (!o.out) return { error: say.blank("out") };
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
    /**
     * ⚠ **WHO CONFIRMED IT, AND `unknown` IS A REAL ANSWER RATHER THAN A DEFAULT.**
     *
     * `agent.agent_memory.source` separates a fact a PERSON confirmed from one a RUN wrote,
     * and a snapshot taken before that column was carried has neither. Reading the absence as
     * `person` would UPGRADE an agent's own note into a confirmed fact — which is the one
     * direction that matters, because the whole point of the column is that somebody auditing
     * an answer can tell where it came from. **Cannot-tell must never read as a value.**
     *
     * IT RIDES BESIDE THE VALUE AND NEVER INSIDE IT: the value is what a note quotes, and
     * putting our bookkeeping into somebody's own words is not a thing to do to them.
     *
     * ⚠ **THE SITE'S OWN `memoryRow` DEFAULTS TO `person` AND THAT IS NOT A DISAGREEMENT WITH
     * THIS LINE — they are two different absences.** A row out of `list_memory` comes from a
     * `not null default 'person'` COLUMN, so there the default is a belt nothing can reach and
     * `person` is simply the column's own answer. Here the absence is a SNAPSHOT taken before
     * this column was carried, which is a real state for every execution already accepted —
     * and those really could be either. Saying so beats letting a reader find the two defaults
     * and take one for a bug.
     */
    const source = entry?.source === "person" || entry?.source === "run" ? entry.source : "unknown";
    const said = source === "person" ? "confirmed by you"
      : source === "run" ? "written by this agent"
      : "recorded before this was tracked";
    return {
      value,
      note: `used what is remembered under "${config.key}" (${said})`,
      sources: [{ key: config.key, version, source }],
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
/**
 * RUN ANOTHER OF THIS AGENT'S AUTOMATIONS HERE.
 *
 * ⚠ **IT IS EXPANDED, NOT CALLED, AND THAT IS THE WHOLE DESIGN.** `expandWorkflow` replaces
 * the step with the child's own steps before the execution starts, so the executor never
 * sees one — which means a subworkflow needs no new wait kind, no parent-child link, no
 * second journal, and no way for a child to be stranded while its parent waits. **The
 * budget is then shared BY CONSTRUCTION rather than by a check**: one flattened list, one
 * `MAX_STEP_RUNS`, one set of outcomes, and one position a restart re-enters.
 *
 * **ITS `run` EXISTS TO REFUSE.** A `workflow` step reaching the executor means the
 * expansion did not happen, which is a row that does not match what somebody saved — so it
 * fails by name rather than being skipped, exactly as a step type this deployment no longer
 * has does.
 */
const subworkflow = defineStep({
  type: "workflow",
  kind: "call",
  label: "Run another automation",
  does: "Run the steps of another of this agent's automations here, as part of this one. Its steps are copied in as they are when this execution starts, so editing it afterwards does not change a run already going.",
  fields: [{ name: "runs", kind: "id", required: true, says: "which automation to run",
    empty: "say which automation to run" }],
  // ⚠ **REFUSED, NEVER COERCED — and the first draft of this reader coerced.** It read a
  // non-string as `""` and answered "say which automation to run", where the site's generic
  // reader says it did not arrive as an automation: `String(["x"])` territory, and a
  // divergence the cross-product census caught the hour it was written. Absent and
  // wrong-kind are two refusals because they need different things done about them.
  read: (raw) => {
    const given = raw?.runs;
    if (given === undefined || given === null || given === "") return { error: "say which automation to run" };
    if (typeof given !== "string") return { error: "which automation to run didn't arrive as an automation" };
    const id = given.trim().toLowerCase();
    if (!id) return { error: "say which automation to run" };
    if (!UUID.test(id)) return { error: "which automation to run didn't arrive as an automation" };
    return { config: { runs: id } };
  },
  run: () => ({ failed: "this automation was supposed to be copied in before the run started, and was not" }),
});

export const AUTOMATION_STEPS = Object.freeze([
  weekday, branchIf, branchOtherwise, branchEnd, repeat, repeatEnd,
  wait, EVENT_WAIT, approval, knowledge, memory, note, sendStep, subworkflow,
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
export const BLOCK_SHAPES = Object.freeze([
  Object.freeze({ open: "if", middle: "otherwise", close: "end",
                  opened: "If", middled: "Otherwise", closed: "End of the if" }),
  Object.freeze({ open: "repeat", middle: null, close: "endrepeat",
                  opened: "Repeat", middled: null, closed: "End of the repeat" }),
]);

export function branchMap(steps, shapes = BLOCK_SHAPES) {
  const map = new Map();
  const open = [];
  const list = Array.isArray(steps) ? steps : [];
  const byOpen = new Map(shapes.map((sh) => [sh.open, sh]));
  const byMiddle = new Map(shapes.filter((sh) => sh.middle).map((sh) => [sh.middle, sh]));
  const byClose = new Map(shapes.map((sh) => [sh.close, sh]));
  for (let i = 0; i < list.length; i++) {
    const type = list[i]?.type;
    const at = i + 1;
    if (byOpen.has(type)) {
      const sh = byOpen.get(type);
      open.push({ at: i, elseAt: null, shape: sh });
      map.set(i, { kind: type, elseAt: null, endAt: null });
    } else if (byMiddle.has(type)) {
      const sh = byMiddle.get(type);
      const top = open[open.length - 1];
      if (!top) return { error: `step ${at}: "${sh.middled}" has no "${sh.opened}" above it` };
      // ⚠ **A MIDDLE MARKER BELONGS TO ITS OWN OPENER AND NOT TO WHATEVER IS OPEN.** An
      // `Otherwise` directly inside a `Repeat` has no `If` to be the other arm of, and
      // reading it as the repeat's would be a workflow nobody wrote — the same reason a
      // mismatched closer is refused below.
      if (top.shape !== sh) {
        return { error: `step ${at}: "${sh.middled}" has no "${sh.opened}" above it — the nearest block is a "${top.shape.opened}"` };
      }
      if (top.elseAt !== null) return { error: `step ${at}: that "${sh.opened}" already has an "${sh.middled}"` };
      top.elseAt = i;
      map.get(top.at).elseAt = i;
      map.set(i, { kind: type, ifAt: top.at, endAt: null });
    } else if (byClose.has(type)) {
      const sh = byClose.get(type);
      const top = open[open.length - 1];
      if (!top) return { error: `step ${at}: "${sh.closed}" has no "${sh.opened}" above it` };
      // ⚠ **A CLOSER MUST CLOSE ITS OWN KIND OF BLOCK.** With two block shapes an "End of
      // the if" can be written under a "Repeat", and matching it to whatever is on the
      // stack would pair a loop with a branch's end — a workflow that balances by count
      // and means something nobody asked for. Refused by NAME and by POSITION, at save
      // time, exactly as an unbalanced list already is.
      if (top.shape !== sh) {
        return { error: `step ${at}: "${sh.closed}" closes a "${sh.opened}", and the nearest block above it is a "${top.shape.opened}"` };
      }
      open.pop();
      map.get(top.at).endAt = i;
      if (top.elseAt !== null) map.get(top.elseAt).endAt = i;
      map.set(i, { kind: type, ifAt: top.at });
    }
  }
  if (open.length) {
    const top = open[open.length - 1];
    return { error: `step ${top.at + 1}: that "${top.shape.opened}" has no "${top.shape.closed}" below it` };
  }
  return { map };
}

// ── reading a stored workflow ───────────────────────────────────────────────

/**
 * `s4` → 3. The id is minted from the position, so this is exact and not a guess.
 *
 * ⚠ **AND IT READS AN ITERATION SUFFIX TOO — `s4#2.1` IS STILL POSITION 3.** A step inside
 * a loop records one outcome per time round, so its id carries which time; the POSITION is
 * what this answers and it is the same for all of them. Without the second half every
 * outcome written inside a loop would come back as -1 on a resume and be DROPPED, which is
 * a resumed execution re-running work it had already done.
 */
export function indexOfId(id) {
  const m = /^s(\d+)(?:#[\d.]+)?$/.exec(String(id ?? ""));
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
  /**
   * ⚠ **WHAT A REFERENCE MAY NAME IS A PROPERTY OF THE PATH, NOT OF THE LIST.**
   *
   * **THE DEFECT THIS FIXES, REPRODUCED FOUR WAYS BEFORE IT WAS TOUCHED.** This was one
   * flat Set that only ever grew — so a value produced inside an arm stayed "available"
   * after that arm, and `{{draft}}` after an `end` was accepted although the only step
   * that produces `draft` may never run. Measured on `6f72e31`: only-under-`if`,
   * only-under-`otherwise`, one arm reading the other's value, and a value from a NESTED
   * arm used after the outer `end` — all four ACCEPTED, and every one of them is a run
   * that fails at the step, with the steps above it already done and charged for.
   *
   * **THE RULE, AND IT IS THE ONE A READER WOULD GUESS**: inside an arm you may use what
   * was available before the branch plus what that arm has produced so far; after the
   * `end` you may use what was available before, plus only what BOTH arms produce —
   * because either arm may be the one that runs. An `if` with no `otherwise` therefore
   * contributes NOTHING past its `end`, which is the same rule with one arm empty.
   *
   * **A STACK, because branches nest**, and each frame remembers what was available when
   * it opened and what each arm has added since.
   */
  /**
   * ⚠ **A NAME'S TYPE TRAVELS WITH IT, AND THE SETS BECAME MAPS FOR THAT ALONE.** What a
   * reference may be used FOR is a property of what produced it, so the scope has to
   * remember both. Every existing caller hands in a list of STRINGS and every one of
   * those is `text`, which is what they have always been — so nothing stored moves and no
   * caller has to change.
   */
  const declared = new Map();
  for (const d of Array.isArray(inputs) ? inputs : []) {
    if (typeof d === "string") declared.set(d, "text");
    else if (d && typeof d === "object" && typeof d.name === "string") {
      declared.set(d.name, VALUE_TYPES.includes(d.type) ? d.type : "text");
    }
  }
  const outer = declared;
  /** `{before, first, other, inElse}` — `first`/`other` are each arm's own additions. */
  const frames = [];
  const here = () => (frames.length ? frames[frames.length - 1] : null);
  /**
   * How many blocks of one kind are open right now.
   *
   * ⚠ **THE DEPTH IS COUNTED FROM THE FRAMES RATHER THAN FROM A NUMBER SOMEBODY KEEPS**,
   * because the frames are the thing that is really nested — a counter beside them is a
   * second copy of the same fact and the copy that drifts is the one deciding whether a
   * workflow is refused.
   */
  const depthOf = (kind) => frames.filter((f) => (kind === "repeat" ? f.loop : !f.loop)).length;
  /** What a step at this point may refer to: the enclosing scope plus this arm's own. */
  const visible = () => {
    const f = here();
    if (!f) return outer;
    return new Map([...f.before, ...(f.inElse ? f.other : f.first)]);
  };
  /** Where a step's own `out` lands: the arm it is in, or the outer scope. */
  const produce = (name, type = "text") => {
    const f = here();
    if (!f) outer.set(name, type);
    else (f.inElse ? f.other : f.first).set(name, type);
  };
  /**
   * ⚠ NAMES AN ARM PRODUCED THAT DID NOT SURVIVE ITS REJOIN, remembered for the SENTENCE
   * and never for visibility — nothing below the `end` may name one.
   *
   * Without it the frame is already popped by the time a later step refers to such a
   * name, so "produced on one path only" comes back as "nothing here produces it" — and
   * that is the commonest shape of this mistake (bind something under `if`, use it after
   * the branch) getting the one sentence that sends somebody hunting a misspelling that
   * is not there. **Found by a sweep survivor**, which measured what the refusal really
   * SAID rather than that it refused.
   */
  const armOnly = new Set();
  const steps = [];
  for (let i = 0; i < raw.length; i++) {
    const at = i + 1;
    const one = raw[i];
    if (one === null || typeof one !== "object" || Array.isArray(one)) {
      return { error: `step ${at} didn't arrive as a step`, at };
    }
    const def = registry.get(typeof one.type === "string" ? one.type : "");
    /**
     * ⚠ **IT NAMES THE POSITION AND THE PLATFORM, and it said neither.** Every neighbour in
     * this loop opens `step ${at}:` and this one did not, so a twenty-step workflow with one
     * unknown action said only which word it did not know — and the SITE's own reader, which
     * has to agree with this one word for word, said `step 1: this platform has no step called
     * X`. MEASURED side by side: the only shape of the thirty the cross-product census drives
     * where the two sentences differed, and it differed because no shape in it had an unknown
     * type. Both doors read alike now, and the census has the shape.
     */
    if (!def) {
      return { error: `step ${at}: this platform has no step called ${String(one.type ?? "(nothing)")}`, at };
    }
    /**
     * ⚠ **A STEP WHOSE RESUME IS A STORED DECISION MAY NOT GO IN A LOOP.**
     *
     * `agent.automation_runs.decisions` is keyed by the STEP'S ID and the first decision at a
     * key stands, so inside a `repeat` the same id comes round again with an answer already
     * recorded — and every round after the first would take the first round's verdict with
     * nobody asked. **That is worse than a stranding: it is an approval nobody gave.**
     *
     * So it is refused where the workflow is WRITTEN, by name and by position, while it is
     * still somebody's form. A `wait` in a loop is fine and is driven: its state is a
     * deadline, which is cleared between rounds. Making an approval per-round means keying
     * the decisions by the outcome key, which is a migration and is not this.
     *
     * DERIVED FROM THE DECLARATION (`decided`), never from a list of type names here.
     */
    if (def.decided === true && depthOf("repeat") > 0) {
      return { error: `step ${at}: "${def.label}" cannot go inside a "Repeat" — one answer would stand for every time round`, at };
    }
    const readIt = def.read(one);
    if (readIt?.error) return { error: `step ${at}: ${readIt.error}`, at };
    // ⚠ **THE ERROR PATH IS READ BY ONE SHARED READER AND NEVER BY THE STEP'S OWN
    // `read`.** Four steps' readers would be four copies of one rule, and a step author
    // who forgot to read it would ship a control the form draws, the customer answers and
    // nothing acts on — this repository's own dead-control-that-ANSWERS finding. Merged
    // into the stored config here, so the executor reads what was validated.
    const ep = readErrorPath(one, def);
    if (ep.error) return { error: `step ${at}: ${ep.error}`, at };
    const config = { ...(readIt.config ?? {}), ...ep.config };

    const canSee = visible();
    for (const f of def.fields) {
      if (f.refs !== true) continue;
      // WHAT THIS FIELD CAN USE. Absent means `text`, which is every field that existed
      // before loops — so the test below is a no-op for all of them and a real wall for
      // the one that iterates.
      const wants = VALUE_TYPES.includes(f.accepts) ? f.accepts : "text";
      for (const name of refsIn(config[f.name])) {
        if (canSee.has(name)) {
          // ⚠ **THE TYPE IS CHECKED WHILE IT IS STILL SOMEBODY'S FORM.** A list in a
          // sentence is `String(["a"])` — this repository's most repeated value trap —
          // and text where a number is wanted is `Number("nine")`. Either way the run
          // fails at the step with the steps above it already done and charged for, so
          // the refusal belongs here, by NAME and by POSITION.
          const got = canSee.get(name) ?? "text";
          if (!(TYPE_ACCEPTS[wants] ?? []).includes(got)) {
            const said = isText(f.says) ? f.says : f.name;
            return {
              error: `step ${at}: "${name}" is ${got === "list" ? "a list" : got === "number" ? "a number" : "text"}, and ${said} needs ${wants === "list" ? "a list" : wants === "number" ? "a number" : "text"}`,
              at,
            };
          }
          continue;
        }
        {
          // ⚠ THE SENTENCE SAYS WHICH OF THE TWO IT IS, because they need different
          // things done about them: a name nothing anywhere produces is a typo, and a
          // name produced only in an arm that may not run is a workflow that has to say
          // what to do otherwise.
          // ⚠ THE CURRENT FRAMES COVER A REFERENCE STILL INSIDE THE BRANCH; `armOnly`
          // covers one BELOW it, where the frame is already gone. `here()` is itself in
          // `frames`, so a third test for the arm being stood in would be dead code —
          // measured identical over nine shapes, and deleted rather than left to read
          // as a wall.
          const onlyInAnArm = frames.some((fr) => fr.first.has(name) || fr.other.has(name))
            || armOnly.has(name);
          return {
            error: onlyInAnArm
              ? `step ${at}: "${name}" is only produced inside a branch that might not run — produce it in both arms, or move the step that uses it inside`
              : `step ${at}: nothing here produces a value called "${name}"`,
            at,
          };
        }
      }
    }
    // ITS OWN `out` IS ADDED AFTER ITS OWN REFERENCES ARE CHECKED, so a step cannot
    // refer to the answer it is about to produce. **THE TYPE IS THE STEP'S OWN**, derived
    // at declaration and never taken from the stored row.
    if (isText(config.out)) produce(config.out, def.produces);

    // ── the frame moves with the block markers ──────────────────────────────
    if (def.type === "if") {
      frames.push({ before: visible(), first: new Map(), other: new Map(), inElse: false, hasElse: false, loop: false });
    } else if (def.type === "repeat") {
      // ⚠ **A LOOP IS A SCOPE WITH ONE ARM, AND THE SECOND ARM IS THE ZERO-ITERATIONS
      // PATH.** A list can be empty, so the body may never run — which makes the rejoin
      // rule below exactly the one an `if` with no `otherwise` already has, rather than a
      // special case. Nothing bound inside a loop survives its end.
      if (depthOf("repeat") >= MAX_LOOP_DEPTH) {
        return { error: `step ${at}: that is more repeats inside each other than one workflow can have (${MAX_LOOP_DEPTH})`, at };
      }
      frames.push({ before: visible(), first: new Map(), other: new Map(), inElse: false, hasElse: false, loop: true });
      // WHAT EACH ONE IS CALLED IS VISIBLE INSIDE THE BODY AND NOWHERE ELSE, which is the
      // frame doing the work: it goes into this block's own arm, and the arm contributes
      // nothing past the `endrepeat`.
      if (isText(config.as)) produce(config.as, "text");
    } else if (def.type === "otherwise") {
      const f = here();
      // A MARKER WITH NO FRAME is `branchMap`'s refusal below, not this one's — it reads
      // the whole list and says which step, which is the better sentence.
      if (f) { f.inElse = true; f.hasElse = true; }
    } else if (def.type === "end" || def.type === "endrepeat") {
      const f = frames.pop();
      if (f) {
        // ⚠ **ONLY WHAT BOTH ARMS PRODUCE SURVIVES**, and an `if` with no `otherwise`
        // has an empty second arm — so nothing from inside it does, which is the same
        // rule rather than a special case. A LOOP is that shape too: its second arm is
        // the path where the list was empty.
        const both = f.hasElse ? [...f.first.keys()].filter((n) => f.other.has(n)) : [];
        for (const n of both) produce(n, f.first.get(n));
        // WHAT EACH ARM BOUND AND THE REJOIN DID NOT KEEP. It is remembered for the
        // SENTENCE and never for visibility: nothing below may name these.
        for (const n of [...f.first.keys(), ...f.other.keys()]) if (!both.includes(n)) armOnly.add(n);
      }
    }

    // ⚠ **THE EXPANSION'S OWN STAMP SURVIVES VALIDATION, and it did not until a case caught
    // it.** `readWorkflow` rebuilds each step from its READ config, which is right — it is
    // what keeps a stored row from carrying a field nothing validated — and it therefore
    // dropped the `from`/`ver` a flattened subworkflow's steps carry. So the snapshot was
    // written by `expandWorkflow` and thrown away by the validator that runs next, which is
    // this repository's own wiring layer one function along.
    //
    // **CHECKED RATHER THAN TRUSTED.** They are provenance and nothing decides anything from
    // them, so a forged pair is a wrong label in a history rather than a hole — and a wrong
    // label is still worth refusing, so a `from` that is not an id and a `ver` that is not a
    // whole number are dropped rather than stored.
    // **BOTH OR NEITHER**: a `from` with no `ver` claims to have come from an automation
    // without saying which version, which is a snapshot that cannot say what it snapshotted.
    const stamped = isText(one.from) && UUID.test(one.from) && Number.isInteger(one.ver);
    const stamp = stamped ? { from: one.from, ver: one.ver } : {};
    steps.push(Object.freeze({ id: `s${at}`, type: def.type, ...config, ...stamp }));
  }
  const struct = branchMap(steps);
  if (struct.error) return { error: struct.error };
  // ⚠ **`produces` STAYS A LIST OF NAMES and that is not laziness.** It is what the site
  // builder's own validator answers and what the cross-product census compares BOTH WAYS,
  // so changing its shape would change a contract for a fact that fits beside it. `types`
  // is the same scope read the other way, for a caller that needs it.
  return { steps, produces: [...outer.keys()], types: Object.fromEntries(outer) };
}

/**
 * ⚠ **FLATTEN A WORKFLOW'S SUBWORKFLOW CALLS INTO ONE LIST, AND TAKE THE SNAPSHOT WHILE
 * DOING IT.**
 *
 * `lookup(id)` answers `{steps, version, name, inputs} | null` for one of this agent's own
 * automations, and it is INJECTED — this function knows nothing about a database, a tenant
 * or an agent, so the wall that stops a parent reaching a sibling account's automation is
 * the lookup's and is enforced where the query is. What comes back here is data.
 *
 * **THE ANSWER CARRIES `uses`**: every child id with the VERSION that was copied in. That is
 * the version snapshot — the record of what really ran, written where a history can read it,
 * rather than something to infer from timestamps.
 *
 * **EVERY SPLICED STEP IS STAMPED `from` AND `ver`** so an outcome can say which automation
 * it came from, and **the ids are re-minted by flattened position**, because the executor
 * keys its outcomes on position and two children both numbering their steps `s1` would
 * collide. The child's own numbering is recoverable from the order and is not a field.
 *
 * ⚠ **A CYCLE IS REFUSED BY NAME AND WITH ITS CHAIN, not merely bounded.** The depth limit
 * would terminate one on its own, and the customer would read "too deep" about a workflow
 * that is not deep — it calls itself, which is a different mistake needing a different fix.
 *
 * ⚠ **A CHILD THAT DECLARES ITS OWN INPUTS IS REFUSED, because nothing supplies them.** A
 * subworkflow shares the parent's values; there is no argument list on the call step yet, so
 * a child asking for an input would have every reference to it resolve to nothing at run
 * time — a workflow that saves and then fails. Passing values in is the next increment and
 * is deliberately not built.
 */
export function expandWorkflow({ steps, lookup, depth = 0, seen = [], uses = [] } = {}) {
  const list = Array.isArray(steps) ? steps : [];
  if (typeof lookup !== "function") return { error: "there is no way to look up another automation here" };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const one = list[i];
    const type = one && typeof one === "object" && !Array.isArray(one) ? one.type : null;
    if (type !== "workflow") { out.push(one); continue; }
    const id = typeof one.runs === "string" ? one.runs : "";
    if (seen.includes(id)) {
      return { error: `this automation runs itself: ${[...seen, id].join(" → ")}` };
    }
    if (depth >= MAX_SUBWORKFLOW_DEPTH) {
      return { error: `that is more automations running one another than one run may have (${MAX_SUBWORKFLOW_DEPTH})` };
    }
    const child = lookup(id);
    // NOT FOUND AND NOT THIS AGENT'S ARE ONE ANSWER, which is the lookup's own rule and is
    // why this reads it as one: naming the difference would tell a caller that another
    // account's automation exists.
    if (!child) return { error: "one of the automations this runs is not one of this agent's" };
    if (Array.isArray(child.inputs) && child.inputs.length) {
      return { error: `"${child.name ?? id}" asks for its own inputs, so it cannot be run as part of another automation` };
    }
    const ver = Number.isInteger(child.version) ? child.version : 1;
    const inner = expandWorkflow({ steps: child.steps, lookup, depth: depth + 1, seen: [...seen, id], uses });
    if (inner.error) return { error: inner.error };
    for (const st of inner.steps) {
      // THE INNERMOST ORIGIN WINS: a grandchild's steps keep the grandchild's stamp, because
      // that is the automation whose words they are.
      out.push(st && typeof st === "object" && Object.hasOwn(st, "from") ? st : { ...st, from: id, ver });
    }
    if (!uses.some((u) => u.id === id && u.version === ver)) uses.push({ id, version: ver });
  }
  if (depth > 0) return { steps: out, uses };
  if (out.length > MAX_FLAT_STEPS) {
    return { error: `once the automations it runs are copied in, that is ${out.length} steps, which is more than one run may hold (${MAX_FLAT_STEPS})` };
  }
  // ⚠ **THE IDS ARE RE-MINTED ONLY AT THE TOP**, so the recursion hands back the child's
  // steps unnumbered and exactly one pass decides what every position is called.
  return { steps: out.map((st, at) => ({ ...st, id: `s${at + 1}` })), uses };
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
  /**
   * ⚠ **THE TWO SEAMS AN ACTION THAT REACHES OUTSIDE NEEDS, AND THEY ARE TWO.**
   *
   * `connections` performs the action and `approve` asks a person about it — different
   * stores, different tables, different refusals, and a deployment can honestly have one
   * without the other. One seam covering both would make "this deployment cannot reach
   * anything outside" and "there is nowhere to ask" the same sentence, and they send a
   * reader to different places.
   *
   * **NEITHER IS BUILT HERE.** What is behind them is the runner's business, which is what
   * keeps this module a pure executor and every branch drivable with no network.
   */
  const connections = opts.connections && typeof opts.connections === "object" ? opts.connections : null;
  const approve = typeof opts.approve === "function" ? opts.approve : null;
  /**
   * ⚠ **THE EXECUTION'S OWN RUN ID, and it is REQUIRED for an action rather than defaulted.**
   * It is the seed of every operation identity and of every approval's key, so a made-up one
   * is two runs sharing an identity — which is one customer's approval answering another's
   * send. A step that needs it and does not have it refuses BY NAME.
   */
  const runId = isText(opts.runId) ? opts.runId : null;
  const record = typeof opts.record === "function" ? opts.record : null;
  const values = { ...plain(opts.values) };
  const pausedOn = plain(opts.waiting);
  /**
   * WHAT THIS EXECUTION HAS ALREADY HEARD, keyed by the step that was waiting.
   *
   * ⚠ **IT IS A MAP AND NOT ONE PAYLOAD, for `decisions`' own reason**: two event waits in one
   * workflow are two questions, and one slot would let the first one's event answer the
   * second. It comes off the ROW, so what heard it was the database — either the dispatcher
   * finding this execution suspended, or the pause's own transaction finding an event that
   * arrived before the row said it was waiting.
   */
  const heard = plain(opts.heard);
  const waitUntil = typeof opts.waitUntil === "number" && Number.isFinite(opts.waitUntil) ? opts.waitUntil : null;

  /**
   * ⚠ **THE LOOP STATE, AND IT IS THE WHOLE OF "durable iteration progress".**
   *
   * `{ "<the repeat's id>": { at, of, list, as } }`, carried in and out on the execution
   * row. A restart inside iteration three of five resumes AT THREE — not at one, which
   * would repeat three iterations of completed effects, and not at four, which would lose
   * one. Nothing about it lives in this process.
   *
   * **THE LIST IS SNAPSHOTTED WHEN THE LOOP OPENS**, which is the same rule an
   * execution's steps follow at acceptance: a loop that re-read its source each time
   * round would iterate something that changed under it, and on a resume it would iterate
   * a list it had never seen.
   */
  const loops = new Map();
  for (const [k, v] of Object.entries(plain(opts.loops))) {
    if (v && typeof v === "object" && !Array.isArray(v) && Number.isInteger(v.at) && Number.isInteger(v.of)) {
      loops.set(k, { at: v.at, of: v.of, list: Array.isArray(v.list) ? v.list : [], as: isText(v.as) ? v.as : null });
    }
  }

  /**
   * ⚠ **HOW MANY TIMES EACH STEP HAS ALREADY BEEN TRIED AND FAILED, and it is durable for
   * the same reason the loop's iteration is.**
   *
   * A counter living in this process gives UNBOUNDED retries across restarts: every
   * delivery would start at attempt one, so a step failing for a whole afternoon would be
   * tried three times a minute for ever and the bound would be a description rather than
   * a wall. Carried in and out on the execution row, keyed exactly as an outcome is — so a
   * step inside a loop gets its own count PER ROUND, because round three failing is not
   * evidence about round one and must not inherit its exhausted budget.
   */
  const tried = new Map();
  for (const [k, v] of Object.entries(plain(opts.tries))) {
    if (Number.isInteger(v) && v > 0) tried.set(k, v);
  }

  const results = new Map();
  /**
   * ⚠ **WHERE ONE STEP'S OUTCOME LIVES, AND A LOOP IS WHY IT IS NOT JUST THE POSITION.**
   *
   * A step inside a loop runs N times, so a map keyed by position alone would hold one
   * outcome for all of them — and a resume would read iteration one's outcome as iteration
   * three's and SKIP a step that has not run. The key carries the iteration of every loop
   * it is inside, and the id it stores carries the same, so the record and the reader agree
   * without either computing it twice.
   *
   * **A STEP IN NO LOOP KEEPS ITS BARE POSITION AND ITS BARE `sN` ID**, so every outcome
   * this product has ever written reads back exactly as it did.
   */
  /**
   * WHICH ROUND OF EVERY ENCLOSING LOOP THIS STEP IS ON, outermost first.
   *
   * ⚠ **ONE DEFINITION, TWO READERS, and they answer different questions from it.** The
   * outcome key needs a STRING that tells one round's record from another's; an action's
   * operation identity needs an INTEGER, because `splitOperation` requires digits. Deriving
   * the second by parsing the first would be a second reading of the same fact, and the
   * copy that drifts is the one deciding whether two rounds share an approval.
   */
  const rounds = () => {
    const parts = [];
    for (const [openId, st] of loops) {
      const openAt = indexOfId(openId);
      const b = openAt >= 0 ? struct.map?.get(openAt) : null;
      if (b && Number.isInteger(b.endAt) && openAt < i && i <= b.endAt) parts.push({ at: openAt, round: st.at });
    }
    return parts;
  };
  const trail = () => {
    const parts = rounds().map((r) => `${r.at + 1}.${r.round}`);
    return parts.length ? `#${parts.join(".")}` : "";
  };
  /**
   * ⚠ **THE SAME ROUNDS AS ONE NUMBER, so an action inside a loop has its own identity and
   * its own approval every time round.** Positional notation in base `MAX_LOOP_ITERATIONS`,
   * which is injective exactly because every round is below that bound and `MAX_LOOP_DEPTH`
   * caps how many there can be. **A step outside every loop is 0, and it cannot collide with
   * round 0 of a loop**, because one POSITION is either inside a given loop or it is not —
   * the number of parts is a property of where the step sits, not of the execution.
   */
  const roundIndex = () => {
    let n = 0;
    for (const r of rounds()) n = n * MAX_LOOP_ITERATIONS + r.round;
    return n;
  };
  const keyAt = (at, suffix) => `${at}${suffix}`;
  const idAt = (at, suffix) => `${steps[at]?.id ?? `s${at + 1}`}${suffix}`;

  for (const o of Array.isArray(opts.outcomes) ? opts.outcomes : []) {
    const at = indexOfId(o?.id);
    if (at < 0 || at >= steps.length) continue;
    const m = /^s\d+(#[\d.]+)$/.exec(String(o?.id ?? ""));
    results.set(keyAt(at, m ? m[1] : ""), o);
  }

  const put = (at, o, suffix = null) => {
    const sfx = suffix === null ? trail() : suffix;
    // ⚠ **HOW MANY ATTEMPTS IT TOOK RIDES ON THE OUTCOME, and it is written HERE so no
    // caller has to remember.** A step that worked on the second try and one that worked
    // first time are different histories, and a step that failed three times and one that
    // failed once are different problems — so the count is on the row rather than
    // inferrable from a log nothing on a screen reads. Absent means one attempt, which is
    // every outcome this product has ever written.
    const before = tried.get(keyAt(at, sfx)) ?? 0;
    const extra = before > 0 ? { tries: before + 1 } : {};
    results.set(keyAt(at, sfx), { id: idAt(at, sfx), type: steps[at]?.type ?? "", ...extra, ...o });
  };
  const skipRange = (from, to, why) => {
    const sfx = trail();
    for (let k = from; k < to && k < steps.length; k++) {
      if (!results.has(keyAt(k, sfx))) put(k, { outcome: "skipped", why }, sfx);
    }
  };
  /**
   * The history, in POSITION order and then in iteration order.
   *
   * ⚠ **NOT INSERTION ORDER, although that is execution order and looks like the honest
   * one.** The final sweep fills in every step that never ran, so insertion order would
   * put all of those at the END — moving every existing outcome list on every screen. The
   * sort is what keeps a workflow's history reading down the page.
   */
  const ordered = () => {
    const rows = [...results.entries()].map(([k, v]) => {
      const [pos, ...iters] = k.split("#");
      return { pos: Number(pos), iters: (iters[0] ?? "").split(".").filter(Boolean).map(Number), v };
    });
    rows.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      const n = Math.max(a.iters.length, b.iters.length);
      for (let k = 0; k < n; k++) {
        const x = a.iters[k] ?? -1;
        const y = b.iters[k] ?? -1;
        if (x !== y) return x - y;
      }
      return 0;
    });
    return rows.map((r) => r.v);
  };
  const ctxFor = (resume) => Object.freeze({
    date: day.date, weekday: day.weekday, zone: day.zone, dayFrom: day.from, now,
    values: Object.freeze({ ...values }), memory, retrieve, resume,
    connections, approve,
    /**
     * ⚠ **WHERE THIS STEP IS, WHICH IS WHAT MAKES AN ACTION'S IDENTITY STABLE ACROSS A
     * RESTART.** Both numbers come off the execution's own row — the position and the loop
     * state — so a redelivery computes the same identity and finds its own earlier work
     * rather than starting a second lot. `index` distinguishes rounds of a loop, and a
     * subworkflow's steps are distinguished because flattening re-mints every position.
     */
    at: Object.freeze({ run: runId, step: i, index: roundIndex() }),
  });

  let i = Number.isInteger(opts.position) && opts.position > 0 ? opts.position : 0;
  let stopped = null;   // {kind: "skipped"|"failed"|"rejected", at, why|error}
  let waiting = null;
  let waitingAt = null;
  let halted = null;
  // WHETHER THE PAUSE THIS DELIVERY RESUMED HAS BEEN HANDED TO ITS STEP. Declared here —
  // above the loop and above `checkpoint`, which is the first thing that could read it —
  // because this file has the temporal dead zone recorded twice already.
  let resumeSpent = false;

  const checkpoint = async (position, pause) => {
    if (!record) return true;
    let answer;
    try {
      answer = await record({
        position, outcomes: ordered(), values: { ...values }, waiting: pause ?? null,
        // ⚠ **WHICH TIME ROUND EVERY OPEN LOOP IS ON, ON THE SAME CALL AS THE POSITION.**
        // One writer of progress, so the two can never be persisted apart — a position
        // saved without its loop state is a restart that re-enters the body at an
        // iteration it has already done, which is the defect this whole column exists to
        // prevent. Rendered fresh each time rather than shared, because the caller stores
        // it and a live reference would let a later round rewrite an earlier record.
        loops: Object.fromEntries([...loops].map(([k, v]) => [k, { at: v.at, of: v.of, list: v.list, as: v.as }])),
        // ⚠ **AND HOW MANY TIMES EACH STEP HAS FAILED, ON THE SAME CALL.** A position
        // persisted without its attempt counts is a restart that starts every retry budget
        // again — bounded retries, unbounded in practice.
        tries: Object.fromEntries(tried),
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

  /**
   * ⚠ **WHAT THIS EXECUTION HAS REALLY RUN, WHICH IS NOT THE NUMBER OF OUTCOMES.**
   *
   * A retry overwrites its step's outcome row, so counting rows alone would make retries
   * free against the budget — a workflow could buy itself unbounded work by asking for
   * them. Each failed attempt is one run beyond the row it will end up as, and `tried` is
   * durable, so the count survives a restart exactly as the rows do.
   */
  const runsSpent = () => {
    let extra = 0;
    for (const v of tried.values()) extra += v;
    return results.size + extra;
  };

  /**
   * ⚠ **THE ONE PLACE A STEP'S OWN FAILURE DECIDES WHAT HAPPENS NEXT.**
   *
   * It governs the TWO ways a step says it failed — it threw, or it answered `failed` —
   * and NOTHING ELSE. A row this deployment cannot read, a reference that resolves to
   * nothing, a branch that does not balance: those are not failing steps, they are a
   * workflow that does not match what somebody saved, and carrying on past one would run a
   * different workflow while reporting the one they wrote. That line is the whole of why
   * this is a helper with two call sites rather than a wrapper round the loop.
   *
   * It records the outcome and either arms a retry or ends the run; the CALLER moves the
   * position and checkpoints, which is the idiom every other branch of the loop follows.
   */
  const failStep = (at, id, error, path, retries, marks = {}) => {
    const key = keyAt(at, trail());
    const already = tried.get(key) ?? 0;
    // ⚠ **`path === "retry"` IS A DECLARED SECOND WALL, MEASURED INERT AND KEPT.** Over 252
    // shapes of stored row, `readErrorPath` never answers a positive `retries` beside any
    // other path — it is stored on the retry branch alone — and the executor derives
    // `retries` from that config and nowhere else, so `already < retries` is 0 for every
    // other path and decides the same thing on its own. It stays because the two say
    // different things: that one is arithmetic about a budget, this is the customer's own
    // choice, and a later reader taking the count from somewhere less careful would find no
    // wall at all. The sweep mutates the PAIR.
    const wantsRetry = path === "retry" && already < retries;
    // ⚠ **THE BUDGET IS ASKED BEFORE ARMING A RETRY, NEVER AFTER.** A retry that cannot
    // be afforded is SAID rather than quietly skipped: a customer who asked for three
    // attempts and got one needs to know it was the budget and not their configuration.
    const room = runsSpent() < MAX_STEP_RUNS;
    const why = path !== "retry" ? undefined
      : wantsRetry && room ? `that attempt didn't work, trying again`
      : wantsRetry ? `there was no room left to try again (${MAX_STEP_RUNS} step runs)`
      : `it didn't work after ${retries + 1} attempts`;
    // RECORDED BEFORE THE COUNT MOVES, so the row says which attempt failed rather than
    // which one is about to start.
    put(at, { outcome: "failed", error, ...(why ? { why } : {}), ...marks });
    if (wantsRetry && room) {
      tried.set(key, already + 1);
      return "retry";
    }
    // ⚠ **`continue` LEAVES THE OUTCOME `failed`.** What it changes is whether the steps
    // below run, and nothing else — a workflow that recorded a carried-past failure as
    // `ran` would be one that says it worked.
    if (path === "continue") return "continue";
    stopped = { kind: "failed", at: id, error };
    return "stop";
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

  /**
   * ⚠ **WHICH ARM A BRANCH TOOK IS RECOVERED FROM THE RECORD, NEVER HELD IN MEMORY.**
   *
   * **THE DEFECT THIS FIXES, REPRODUCED BEFORE IT WAS TOUCHED.** This was a bare `new
   * Set()` filled only by the `if` step as it ran. A delivery that checkpointed a FALSE
   * `if` and then died — which is the ordinary shape, because the checkpoint is the last
   * thing that step does — came back with the set EMPTY. The resumed run re-entered at
   * the `otherwise`, found nothing saying it had been jumped to, read that as "the first
   * arm ran, so this one didn't", skipped the whole arm and **stopped with `done`.**
   * Measured on `6f72e31`: uninterrupted the run answered `"TOLD THEM IN PLAIN WORDS"`,
   * resumed it answered `null` — and called itself successful both times.
   *
   * **THE DECISION WAS ALREADY PERSISTED; nothing was reading it.** Every `if` records
   * `took: "first" | "otherwise"` in its own outcome, for the history to show — and a
   * resume is handed those outcomes. So the arm is derived from the record rather than
   * from a variable this process happens to hold, which is what makes it survive a
   * restart at any point.
   *
   * **BY THE `if`'s OWN INDEX, THEN THROUGH `struct.map`**, so a stored outcome list that
   * no longer matches the workflow cannot point at an arm that is not there.
   */
  const jumpedToElse = new Set();
  for (let k = 0; k < steps.length; k++) {
    if (steps[k]?.type !== "if") continue;
    // ⚠ **THE KEY IS THE BARE POSITION, WHICH IS AN `if` OUTSIDE ANY LOOP.** An `if` INSIDE
    // one records a decision per iteration, and the arm it took on iteration two is not
    // evidence about iteration three — so the loop's own re-entry re-decides it from the
    // condition, which is correct and is what makes this reader's narrowness deliberate.
    // (Measured: with the map keyed by string and this line asking for an integer, `get`
    // answers `undefined` for every `if` and a resumed run re-decides every branch — which
    // is the defect M2 closed, returning through a key.)
    const recorded = results.get(keyAt(k, ""));
    if (recorded?.took !== "otherwise") continue;
    // ⚠ THE RECORD MUST AGREE WITH THE STEP IT SITS AT. `took` is a field only an `if`
    // can write, so an outcome recorded against something else carrying one is not
    // evidence about this branch — it is a list that no longer matches this workflow.
    // Refuse rather than coerce: the cost of ignoring it is one arm re-decided from the
    // condition, and the cost of trusting it is an arm opened by a stale row.
    if (recorded.type !== "if") continue;
    const elseAt = struct.map?.get(k)?.elseAt;
    if (Number.isInteger(elseAt)) jumpedToElse.add(elseAt);
  }

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

    // ⚠ **A CALL THAT WAS NEVER EXPANDED IS A ROW THAT DOES NOT MATCH WHAT SOMEBODY
    // SAVED.** `expandWorkflow` replaces every `workflow` step before the execution starts,
    // so one arriving here means the expansion did not run — and it must not fall through to
    // the action tail below, which would read a call as a step that did something.
    //
    // ⚠ **IT WAS DECLARED AN UNKILLABLE PAIR WITH THE STEP'S OWN `run` AND IT IS NOT ONE —
    // MEASURED, after a sweep survivor said so.** This comment used to read *"neither can be
    // killed on its own and the sweep mutates them together"*, and driving an unexpanded call
    // both ways falsifies it: with this branch gone the step's own `run` does refuse, with the
    // same reason and the same hard stop, but in ITS OWN WORDS — *"this automation was supposed
    // to be copied in…"* against *"Run another automation was supposed to be copied in…"*. So
    // the two are observable apart, and what was really missing was anything asserting WHICH
    // sentence a customer reads. There is a case for it now.
    //
    // **BOTH ARE KEPT, for two different readers.** This one names the step as the catalog
    // labels it, which is what tells somebody which row of their own workflow is the problem —
    // a workflow can hold several calls and "this automation" names none of them. The step's
    // own `run` is its contract, for a caller that dispatches it directly and never reaches
    // here. **AND THE ESCAPE THE MUTANT LOOKS LIKE IT OPENS IS SHUT ONE LAYER UP, also
    // measured**: a `workflow` step is not `failable`, so `on_error: "continue"` is refused
    // where the workflow is SAVED (*"Run another automation has no failures to handle"*) and an
    // unexpanded call cannot carry on past itself however this branch is written.
    if (def.stepKind === "call") {
      const error = `${def.label} was supposed to be copied in before the run started, and was not`;
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

    // ⚠ **THE ERROR PATH IS READ WITH THE SAME READER THE VALIDATOR USED**, so a stored
    // row cannot mean one thing when it was saved and another when it runs. A row this
    // reader REFUSES is a malformed row, which is a hard stop exactly as `read`'s refusal
    // above is — never the step's own error path, because we do not know what it says.
    const epRun = readErrorPath(one, def);
    if (epRun.error) {
      put(i, { outcome: "failed", error: epRun.error });
      stopped = { kind: "failed", at: id, error: epRun.error };
      break;
    }
    const onError = epRun.config.on_error ?? "stop";
    const retries = Number.isInteger(epRun.config.retries) ? epRun.config.retries : 0;

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

    // ── a loop goes round; the executor owns the control flow ───────────────
    if (type === "repeat" || type === "endrepeat") {
      const b = struct.map?.get(i) ?? {};
      if (type === "repeat") {
        // ⚠ **THE LIST IS READ BY NAME AND NEVER OUT OF THE FILLED CONFIG**, because
        // `fillConfig` has already rendered `{{names}}` into TEXT by now — and a list
        // rendered as text is `String(["a"])`, this repository's most repeated value trap.
        // `readWorkflow` has already refused a reference of the wrong type here, so this
        // is the second wall and it is declared as one: what it catches is a stored row
        // from a version that had no types, where the value really is not a list.
        let list = [];
        let of = 0;
        if (config.mode === "each") {
          const named = refsIn(one.each)[0] ?? null;
          const raw = named !== null && Object.hasOwn(values, named) ? values[named] : undefined;
          if (!Array.isArray(raw)) {
            const error = named === null
              ? "say which list to go through — {{a name}}"
              : `"${named}" is not a list, so there is nothing to go through`;
            put(i, { outcome: "failed", error });
            stopped = { kind: "failed", at: id, error };
            break;
          }
          if (raw.length > MAX_LOOP_ITERATIONS) {
            // ⚠ REFUSED WHOLE, NEVER TRUNCATED. A loop that quietly did the first fifty of
            // two hundred would report itself done having left three quarters of somebody's
            // work undone — the prefix argument the tool-budget refusal makes one layer up.
            const error = `"${named}" has ${raw.length} things in it, which is more than one repeat can go through (${MAX_LOOP_ITERATIONS})`;
            put(i, { outcome: "failed", error });
            stopped = { kind: "failed", at: id, error };
            break;
          }
          list = [...raw];
          of = list.length;
        } else {
          of = Number.isInteger(config.times) ? config.times : 0;
        }
        // THE STATE IS WRITTEN BEFORE THE BODY RUNS, so the checkpoint below carries it and
        // a restart one step in knows which time round it is.
        const st = { at: 0, of, list, as: isText(config.as) ? config.as : null };
        loops.set(id, st);
        if (of === 0) {
          // ⚠ `ran`, NOT `skipped`: the repeat did its job — there was nothing to go
          // through. And the body is skipped at the loop's own trail, which is the trail
          // BEFORE this loop is entered, so those outcomes read as the ones that never ran.
          const why = config.mode === "each" ? "the list was empty, so the steps under it didn't run" : "it was set to no times at all";
          loops.delete(id);
          put(i, { outcome: "ran", rounds: 0, why });
          skipRange(i + 1, b.endAt, why);
          i = b.endAt + 1;
        } else {
          if (st.as) values[st.as] = of && config.mode === "each" ? list[0] : "";
          put(i, { outcome: "ran", rounds: of, why: config.mode === "each" ? `going through ${of} of them` : `going round ${of} times` });
          i += 1;
        }
        if (!(await checkpoint(i, null))) break;
        continue;
      }
      // ── the end of a repeat: go round again, or carry on ─────────────────
      const openAt = Number.isInteger(b.ifAt) ? b.ifAt : -1;
      const openId = openAt >= 0 ? (steps[openAt]?.id ?? `s${openAt + 1}`) : null;
      const st = openId !== null ? loops.get(openId) : null;
      if (!st) {
        // A STORED LIST WHOSE LOOP STATE IS GONE. Failed rather than carried on: carrying
        // on would run the steps after the loop having done an unknown number of rounds.
        const error = "the repeat this closes has no record of where it got to";
        put(i, { outcome: "failed", error });
        stopped = { kind: "failed", at: id, error };
        break;
      }
      // ⚠ **THE BUDGET IS COUNTED IN STEP RUNS AND IS ASKED BEFORE GOING ROUND AGAIN.**
      // `MAX_WORKFLOW_STEPS` bounds the LIST; with loops the resource is RUNS, and it is
      // counted from the RECORD so an execution cannot spend it again by being restarted.
      if (runsSpent() >= MAX_STEP_RUNS) {
        const error = `this has run ${runsSpent()} steps, which is as many as one automation may (${MAX_STEP_RUNS})`;
        put(i, { outcome: "failed", error });
        stopped = { kind: "failed", at: id, error };
        break;
      }
      const next = st.at + 1;
      if (next < st.of) {
        st.at = next;
        if (st.as) values[st.as] = Array.isArray(st.list) && st.list.length ? st.list[next] : "";
        // ⚠ **THE POSITION GOES BACK TO THE FIRST STEP OF THE BODY, AND THE ITERATION IS
        // ALREADY ADVANCED** — so the outcomes this round writes are keyed to `next` and
        // cannot overwrite the last round's. That pair is the whole of "resuming inside a
        // loop does not repeat completed effects": the record says which round each outcome
        // belongs to, and the state says which round to re-enter.
        i = openAt + 1;
        if (!(await checkpoint(i, null))) break;
        continue;
      }
      // DONE GOING ROUND. The item is unbound, which is a SECOND wall and is declared as
      // one: `readWorkflow` already refuses a reference to it below the `endrepeat`,
      // because a loop's arm contributes nothing past its own end. This one covers a
      // stored row from a version that had no such rule.
      if (st.as) delete values[st.as];
      loops.delete(openId);
      put(i, { outcome: "ran", rounds: st.of, why: `went round ${st.of} time${st.of === 1 ? "" : "s"}` }, "");
      i += 1;
      if (!(await checkpoint(i, null))) break;
      continue;
    }

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

    /**
     * ⚠ IS THIS THE STEP THE EXECUTION WAS SUSPENDED ON? Asked by the step's own ID and
     * never by the position alone, so a resume that arrived for one pause can never be
     * read as the answer to another.
     *
     * ⚠ **AND IT IS SPENT BY THE FIRST ARRIVAL, which a LOOP is what made necessary.** The
     * stored pause records a step ID and nothing else, so inside a `repeat` the same id
     * comes round again — and a resume matched on the id alone was read a second time, with
     * a deadline that had already passed. MEASURED, through the real database: a `wait` five
     * minutes inside a two-round loop waited once and then went straight through, and the
     * execution finished having honoured one of the two waits it was asked for. Every later
     * arrival is a FRESH pause, which is what each round of a loop is.
     */
    const resume = !resumeSpent && pausedOn.step === id
      ? {
        waitUntil,
        decision: Object.hasOwn(decisions, id) ? decisions[id] : null,
        // ⚠ `Object.hasOwn`, NEVER `heard[id]` ALONE — `{{constructor}}` is a function and
        // truthiness would hand a step something nobody wrote. `null` is a real answer here
        // and means "this pause has not heard its event", which an event wait reads as a
        // RE-PAUSE rather than as a failure.
        heard: Object.hasOwn(heard, id) ? heard[id] : null,
      }
      : null;
    if (resume) resumeSpent = true;

    let answer;
    let threw = null;
    try { answer = await def.run(config, ctxFor(resume)); }
    catch (e) { threw = String(e?.message ?? e); }

    // ⚠ THE TWO WAYS A STEP SAYS IT FAILED, AND THEY TAKE THE SAME PATH. It threw, or it
    // answered `failed` without throwing — one reading for every kind, so a refusal cannot
    // be mistaken for an answer, and one decision, so a step's declared error path cannot
    // apply to one and not the other.
    const failure = threw !== null ? threw : (isText(answer?.failed) ? answer.failed : null);
    if (failure !== null) {
      /**
       * ⚠ **A FAILURE MAY SAY MORE THAN THAT IT FAILED, AND `unresolved` IS WHY THIS EXISTS.**
       * "It did not happen" and "nobody can say whether it happened" are both failures of the
       * step and they want opposite things done about them — one invites doing it again, the
       * other invites CHECKING first. Collapsing them into the error sentence would leave a
       * screen parsing prose to tell them apart.
       */
      const marks = {};
      for (const k of PAUSE_MARKS) if (answer?.[k] !== undefined) marks[k] = answer[k];
      const verdict = failStep(i, id, failure, onError, retries, marks);
      if (verdict === "retry") {
        // THE POSITION DOES NOT MOVE: the next attempt re-enters this step, and the
        // checkpoint is what makes the attempt count durable rather than this process's.
        if (!(await checkpoint(i, null))) break;
        continue;
      }
      if (verdict === "continue") {
        i += 1;
        if (!(await checkpoint(i, null))) break;
        continue;
      }
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
        // AN EVENT PAUSE CARRIES WHEN IT BEGAN. Only an event wait needs it — a timed wait has
        // its deadline and an approval has its window — so it is written where it is needed
        // rather than on every pause, which would be a field three readers ignore.
        if (waiting.kind === "event") waiting.since = new Date(now).toISOString();
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
      /**
       * ⚠ **A PAUSE MAY BIND WHAT ITS RESUME CARRIED, and until the event wait there was
       * nothing to bind — which is exactly why this had to be written rather than assumed.**
       * `EVENT_WAIT` answered `bind:` while this branch read only `why`, so the payload went
       * nowhere and the step's own `does` ("carry on with what it carried") was a promise
       * nothing kept: a dead control in the step being written. Guarded on `config.out`, so a
       * pause that binds nothing is byte for byte what it was.
       */
      if (isText(config.out) && typeof answer?.bind === "string") values[config.out] = answer.bind;
      /**
       * ⚠ **A PAUSE THAT DID SOMETHING RECORDS WHAT IT DID, and `result` is carried here for
       * the same reason an action's is.** Only a `pause` can suspend an execution, so a step
       * that waits for a person and THEN acts has to be one — and without this line the whole
       * of what it did would be a sentence. `stop.result` is the last outcome carrying a
       * string `result`, so this is also what puts a send in the execution's own result.
       *
       * `PAUSE_MARKS` rather than a spread of the answer: a pause's answer is the step
       * author's object, and spreading it would let a field nobody has written reach a screen.
       */
      const marks = {};
      for (const k of PAUSE_MARKS) if (answer?.[k] !== undefined) marks[k] = answer[k];
      put(i, { outcome: "ran", why: isText(answer?.why) ? answer.why : "carried on", ...marks });
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

  /**
   * ⚠ **THE LOOP STATE COMES BACK ON EVERY ANSWER, INCLUDING THE HALTED ONE.**
   *
   * It is the caller that persists it, so an exit that left it out would be an execution
   * that forgot which time round it was — and the caller would have nothing to write. On a
   * HALT nothing is written anyway (the claim is gone), and answering it there costs
   * nothing and keeps one shape for all three exits, which is what stops a reader having
   * to know which exit it is looking at before it knows what it has.
   */
  /**
   * ⚠ **`since` IS WRITTEN ONTO AN EVENT PAUSE BY THE EXECUTOR, and it is what bounds a wait
   * to news it was really waiting for.** `agent.hear_pending_event` and the dispatcher both
   * compare an event's `at` against it, so without it an event from last week would satisfy a
   * wait somebody set up this morning. It is the EXECUTOR's clock rather than the recorder's,
   * for the same reason every checkpoint's `at` is: a retry inside one delivery must replay a
   * byte-identical entry, which is the only thing `append_entry` can read as `already`.
   */
  const loopState = () => Object.fromEntries([...loops].map(([k, v]) => [k, { at: v.at, of: v.of, list: v.list, as: v.as }]));
  const triesState = () => Object.fromEntries(tried);

  if (halted !== null) {
    return { outcomes: ordered(), values, position: i, loops: loopState(), tries: triesState(), stop: null, waiting: null, halted };
  }

  if (waiting) {
    return { outcomes: ordered(), values, position: waitingAt, loops: loopState(), tries: triesState(), stop: null, waiting, halted: null };
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

  // ⚠ **A RUN THAT CARRIED PAST A FAILURE IS STILL `done`, AND IT SAYS HOW MANY.**
  //
  // The workflow ran to its end exactly as its author configured it, so inventing a
  // fourth reason would make every reader treat a deliberate `continue` as a fault. But
  // `done` alone would be a run reporting success with a failed step in it that nobody
  // reads — so the COUNT rides on the stop, where a screen meets it, rather than being
  // something to derive by walking the outcomes.
  let carried = 0;
  for (const o of outcomes) if (o?.outcome === "failed") carried += 1;

  const stop = stopped === null
    ? { reason: "done", result, ...(carried > 0 ? { carried } : {}) }
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
    outcomes, values, position: steps.length, loops: loopState(), tries: triesState(), waiting: null, halted: null,
    stop: { ...stop, on: day.date, weekday: day.weekday, zone: day.zone },
  };
}
