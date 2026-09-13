// ── WHAT THE CHANGE NEEDED, AND WHETHER THIS STEP COVERED IT ────────────────
//
// Owner, 2026-09-13: "Implement structured requirement coverage, not just
// free-text notes. Each requirement should identify how the proposed
// configuration covers it, whether another step must handle it, or why it
// remains unsupported."
//
// WHY A SEPARATE MODULE, AND WHY NOT INSIDE `TABLE_ITEM`. This is metadata
// ABOUT a design, not part of one. `TABLE_ITEM` is bound by identity into
// `design_schema` as well as into the add step's tool, so anything added there
// also enlarges the build's 93,598-character tool and becomes a promise
// `test/declarable-enforced.test.mjs` requires the engine to keep. A coverage
// note is neither: no DDL is emitted from it, nothing is stored in `_meta` for
// it, and the schema engine must never see it. Keeping it a SIBLING of the
// kind's own property is what makes both true at once.
//
// AND IT MUST SURVIVE AN ANSWER THAT DESIGNS NOTHING. The case this exists for
// is a requirement the tool could not express — so the shape where it matters
// most is the one where `tables` is empty, or where every entry was skipped.
// That is why it rides `runAdd`'s result beside `value` rather than inside it:
// a cleaner that refuses every table must not take the reason with it.
//
// Dependency-free, like `site-qr-list.mjs` and `site-mark.mjs`, so the tool
// builder, the route and the container can all read one copy.

/**
 * The three answers, and they are genuinely different sentences to a customer.
 *
 *   covered      — this configuration handles it; `by` says how.
 *   elsewhere    — real, and another step in this same change owns it; `step`
 *                  says which, so the route can hand it on.
 *   unsupported  — the platform cannot do it; `why` says so in the customer's
 *                  terms, and the route has to SAY it rather than ship quietly.
 *
 * Collapsing `elsewhere` into `covered` is what makes a gap invisible: the
 * table step legitimately does not write pages, and a requirement it hands to
 * the page step is only covered once that step runs.
 */
export const COVERAGE = ["covered", "elsewhere", "unsupported"];

/**
 * Which step may be named as the owner of an `elsewhere` requirement.
 *
 * DELIBERATELY THE ADD STEP'S OWN KINDS PLUS `edit`. A requirement handed to a
 * step that does not exist is a requirement dropped with extra ceremony, so the
 * names are checked against this list and an unknown one is refused rather than
 * passed along. `edit` is here because "they can change the wording later" is a
 * real and correct answer that no add kind owns.
 */
export const COVERAGE_STEPS = ["page", "component", "function", "api", "job", "qr", "three", "photo", "edit"];

/** A ceiling, never a quota — the rules say "one per thing the change needs". */
export const MAX_REQUIREMENTS = 12;

const MAX_NEED = 200;
const MAX_BY = 200;
const MAX_WHY = 300;

/**
 * The item, as the tool asks for it.
 *
 * `need` and `status` are required and the rest are conditional in PROSE rather
 * than in the schema, because JSON Schema cannot say "required when status is
 * unsupported" in a shape every provider reads the same way — and a field
 * required unconditionally is one the model fills in with something for the two
 * cases where it means nothing.
 */
export const REQUIREMENT_ITEM = {
  type: "object",
  properties: {
    need: {
      type: "string",
      description:
        "One thing this change has to be able to do, in the business's own terms and in a single short sentence " +
        "— \"a visitor can book a slot and get it back later\", \"only the owner sees a customer's phone number\", " +
        "\"the same slot cannot be taken twice\". Read it off what they asked for, including what the ask IMPLIES: " +
        "a booking form implies somewhere to put the booking and somebody who may read it. Not a column, not a " +
        "table name — the requirement, which the configuration below is your answer to.",
    },
    status: {
      type: "string",
      enum: COVERAGE,
      description:
        "\"covered\" — the tables you designed here handle it, and `by` says how. " +
        "\"elsewhere\" — it is real and it belongs to another step in this same change (the page that shows it, " +
        "a function, a job), and `step` names which. " +
        "\"unsupported\" — you could not express it with what this step offers, and `why` says what is missing. " +
        "ANSWER \"unsupported\" RATHER THAN LEAVING IT OUT. A requirement you drop is one the customer is never " +
        "told about; one you mark unsupported is one they are.",
    },
    by: {
      type: "string",
      description:
        "For \"covered\" only: how this configuration covers it, naming the table and the thing that does the " +
        "work — \"bookings.slot with a unique slot so two cannot be taken\", \"bookings access user, so a member " +
        "sees only their own rows\". One short clause.",
    },
    step: {
      type: "string",
      enum: COVERAGE_STEPS,
      description: "For \"elsewhere\" only: which step owns it.",
    },
    why: {
      type: "string",
      description:
        "For \"unsupported\" only: what is missing, in one short sentence a person who does not know this " +
        "platform can act on. Never an apology and never a promise about later.",
    },
  },
  required: ["need", "status"],
};

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Clean what the model answered. `{ list, skipped }`.
 *
 * `String(["covered"])` IS `"covered"`, which has shipped as a real bug in this
 * repository three times — a one-element array passing as a role, an access
 * level and a language. Every field is refused unless it is genuinely a string.
 *
 * AN ENTRY WE CANNOT READ IS SKIPPED AND COUNTED, NEVER REPAIRED TO "covered".
 * That is the recorded "cannot-tell must never read as a value" rule pointed at
 * the one field whose wrong reading hides the gap this whole shape exists to
 * surface. A skipped entry keeps its `need` where there is one, so the developer
 * record can say WHAT was unreadable rather than only how many.
 */
export function cleanRequirements(raw) {
  const items = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? [raw] : []);
  const list = [];
  const skipped = [];
  for (const r of items.slice(0, MAX_REQUIREMENTS)) {
    if (!r || typeof r !== "object" || Array.isArray(r)) { skipped.push({ need: "", why: "not-an-entry" }); continue; }
    const need = str(r.need, MAX_NEED);
    if (!need) { skipped.push({ need: "", why: "no-need" }); continue; }
    // `includes` over the frozen list, never `Object.hasOwn` on a map — the
    // statuses are values, not keys, so `"constructor"` is simply not one.
    const status = str(r.status, 20).toLowerCase();
    if (!COVERAGE.includes(status)) { skipped.push({ need, why: "bad-status" }); continue; }
    const e = { need, status };
    if (status === "covered") {
      const by = str(r.by, MAX_BY);
      if (by) e.by = by;
    } else if (status === "elsewhere") {
      const step = str(r.step, 20).toLowerCase();
      // A STEP NOBODY RUNS IS NOT A HAND-OFF. Refused to `unsupported` rather
      // than dropped, because the requirement is still real — what is wrong is
      // only the claim about who owns it, and the customer should hear it.
      if (COVERAGE_STEPS.includes(step)) e.step = step;
      else { e.status = "unsupported"; e.why = "named a step this change does not run"; }
    }
    if (e.status === "unsupported" && !e.why) {
      const why = str(r.why, MAX_WHY);
      e.why = why || "no reason was given";
    }
    list.push(e);
  }
  return { list, skipped };
}

/**
 * The ones that are NOT settled by this step: everything but `covered`.
 *
 * Two different fates, kept together because both are "the customer has not got
 * this yet": an `elsewhere` is handed to its step and becomes covered when that
 * step runs, an `unsupported` never does. The route splits them; a reader that
 * only wants "is anything outstanding" asks this.
 */
export function unresolvedRequirements(list) {
  return (Array.isArray(list) ? list : []).filter((r) => r && r.status && r.status !== "covered");
}

/** Just the ones a downstream step was named for, grouped by that step. */
export function requirementsByStep(list) {
  const out = {};
  for (const r of unresolvedRequirements(list)) {
    if (r.status !== "elsewhere" || !r.step) continue;
    (out[r.step] = out[r.step] || []).push(r.need);
  }
  return out;
}

/** The counts, for a developer record and a trace mark. Never shown to a customer. */
export function requirementCounts(list, skipped) {
  const all = Array.isArray(list) ? list : [];
  const n = (s) => all.filter((r) => r && r.status === s).length;
  return {
    total: all.length,
    covered: n("covered"),
    elsewhere: n("elsewhere"),
    unsupported: n("unsupported"),
    unreadable: (Array.isArray(skipped) ? skipped : []).length,
  };
}

/**
 * What a downstream step is TOLD, as a directive block. `""` when it owns none.
 *
 * The needs alone, never the status — the page step is being told what the page
 * has to let somebody do, and "the table step could not express this" is our
 * bookkeeping, not an instruction.
 */
export function requirementBrief(list, step) {
  const mine = (requirementsByStep(list)[step] || []).slice(0, MAX_REQUIREMENTS);
  if (!mine.length) return "";
  return "## What this addition still has to do\n" +
    "The step that designed the data handed these to you. Each is something the customer asked for that this " +
    "page has to make possible. Cover what you can and change nothing else.\n" +
    mine.map((n) => "- " + n).join("\n");
}

/**
 * The sentence the CUSTOMER reads, or `""`.
 *
 * ONLY WHAT IS STILL OUTSTANDING AFTER THE WHOLE CHANGE RAN, and only in their
 * terms. An `elsewhere` requirement whose step really ran is covered and is not
 * here; `ran` is the caller's list of kinds that produced something, so this
 * cannot claim a hand-off that never happened.
 *
 * INVALID PROPERTIES ARE SAID TOO, in one clause and without their names: a
 * customer has no use for `encryptAtRest`, and the developer record keeps it.
 * What they can act on is that a guarantee they asked for is not there.
 */
export function requirementNote(list, { ran = [], invalid = [] } = {}) {
  const done = new Set((Array.isArray(ran) ? ran : []).filter((k) => typeof k === "string"));
  const open = unresolvedRequirements(list).filter((r) => !(r.status === "elsewhere" && r.step && done.has(r.step)));
  const bad = (Array.isArray(invalid) ? invalid : []).filter((x) => typeof x === "string" && x);
  if (!open.length && !bad.length) return "";
  const parts = [];
  const unsupported = open.filter((r) => r.status === "unsupported");
  const handed = open.filter((r) => r.status === "elsewhere");
  if (unsupported.length) {
    parts.push("One thing your site can't do yet: " + unsupported.slice(0, 3)
      .map((r) => r.need + (r.why ? " — " + r.why : "")).join("; ") + ".");
    if (unsupported.length > 3) parts.push("And " + (unsupported.length - 3) + " more like it.");
  }
  if (handed.length) {
    parts.push("Still to do: " + handed.slice(0, 3).map((r) => r.need).join("; ") + ".");
  }
  // ONE CLAUSE, AND IT DOES NOT NAME THE PROPERTY. The count is what a customer
  // can act on ("ask me again and say which"); the names are the developer's.
  if (bad.length) {
    parts.push(bad.length === 1
      ? "I also asked the database for a guarantee it doesn't offer, so that one isn't in place."
      : "I also asked the database for " + bad.length + " guarantees it doesn't offer, so those aren't in place.");
  }
  return parts.join(" ");
}

/**
 * The developer-facing record: everything, including what a customer is not told.
 *
 * Stored beside the raw replies in `source/<slug>/addon-answer.json`, which is
 * the file run 28's three blind declines are the reason for — a boolean is not
 * a diagnosis. Bounded, because this is written on every addition.
 */
export function requirementRecord({ list = [], skipped = [], invalid = [], ran = [] } = {}) {
  return {
    counts: requirementCounts(list, skipped),
    requirements: (Array.isArray(list) ? list : []).slice(0, MAX_REQUIREMENTS),
    unreadable: (Array.isArray(skipped) ? skipped : []).slice(0, MAX_REQUIREMENTS),
    invalidProps: (Array.isArray(invalid) ? invalid : []).slice(0, MAX_REQUIREMENTS),
    handedTo: requirementsByStep(list),
    ran: (Array.isArray(ran) ? ran : []).filter((k) => typeof k === "string"),
  };
}
