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
export const COVERAGE_STEPS = ["table", "function", "api", "job", "page", "component", "qr", "three", "photo", "edit"];

/**
 * WHAT BECAME OF A REQUIREMENT ONCE THE WHOLE CHANGE RAN — and there are THREE
 * answers, not two.
 *
 *   delivered   — something we can check ties this need to what was built.
 *   failed      — the platform said it could not, or the step that owned it did
 *                 not run, or ran and refused.
 *   unverified  — the step ran and produced something, and NOTHING here ties
 *                 that something to this particular claim.
 *
 * THE THIRD ONE IS THE CORRECTION. `requirementNote` used to read "the step
 * that owns it ran" as covered, so a planned page, a generated file or a
 * created table was taken as proof of "customers see only their own bookings"
 * or "the same slot cannot be taken twice". Existence is not evidence: the
 * page exists whether or not it enforces anything.
 *
 * AND THE EVIDENCE IS ASYMMETRIC, which is why `failed` and `unverified` are
 * separate rather than one "not done". A call to a function that failed PROVES
 * a problem; the absence of such a call proves nothing at all. So every
 * positive signal this module accepts is a check against something really
 * created, and everything else falls to `unverified` rather than to either
 * verdict — silence is never read as success, and it is never read as failure.
 */
export const REQUIREMENT_STATES = ["delivered", "failed", "unverified"];

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
        "\"covered\" — what you designed here handles it, and `by` says how. " +
        "\"elsewhere\" — it is real and it belongs to another step in this same change (the table that stores it, " +
        "the page that shows it, a function, a job), and `step` names which. " +
        "\"unsupported\" — you could not express it with what this step offers, and `why` says what is missing. " +
        "ANSWER \"unsupported\" RATHER THAN LEAVING IT OUT. A requirement you drop is one the customer is never " +
        "told about; one you mark unsupported is one they are.",
    },
    by: {
      type: "string",
      description:
        "For \"covered\" only: how what you designed covers it, NAMING the thing that does the work — the table, " +
        "column, function, connection or job by its real name: \"bookings.slot with a unique slot so two cannot " +
        "be taken\", \"bookings access user, so a member sees only their own rows\", \"cancel_booking checks the " +
        "owner before deleting\". One short clause, and the NAME IS THE PART THAT MATTERS: it is what lets us " +
        "check afterwards that the thing you named is really there.",
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
export function cleanRequirements(raw, from = "") {
  // WHICH STEP ANSWERED IT, STAMPED HERE. A `covered` entry names no step —
  // the step that wrote it owns it — so without this a `covered` requirement
  // could never be tied back to a step that then failed, and a table step that
  // refused every table would still have its own claims read as delivered.
  // Taken as an argument rather than read off the answer, because it is OURS:
  // the model is never asked which call it is.
  const owner = typeof from === "string" && from ? from : "";
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
    const e = { need, status, ...(owner ? { from: owner } : {}) };
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
 * The needs alone, never the status — the step is being told what the customer
 * has to be able to do, and "the table step could not express this" is our
 * bookkeeping, not an instruction.
 *
 * ── EVERY STEP, NOT ONLY THE PAGE (owner, 2026-09-14) ───────────────────────
 *
 * This function was general and had exactly ONE caller, for `page`. Six kinds
 * answer requirements and any of them may hand one to any other, so a table
 * step that wrote "the reminder has to go out every morning — that is the job
 * step's" reached nobody: the job designer ran a minute later knowing nothing
 * about it, and the customer was told the change was made. The route composes
 * this for each kind before its own call now, and records that it did — see
 * `told` on `requirementOutcomes`, which is what stops an undelivered hand-off
 * reading as satisfied.
 *
 * THE SENTENCE NAMES WHAT THIS STEP IS, so a `job` designer is not told to make
 * something possible "on this page". Generic where the kind is unknown.
 */
export function requirementBrief(list, step) {
  const mine = (requirementsByStep(list)[step] || []).slice(0, MAX_REQUIREMENTS);
  if (!mine.length) return "";
  const where = step === "page" || step === "component" ? "this page has to make possible"
    : "the part you are designing has to make possible";
  return "## What this addition still has to do\n" +
    "Another step in this same change handed these to you. Each is something the customer asked for that " +
    where + ". Cover what you can and change nothing else.\n" +
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
/**
 * A NAME WE REALLY CREATED, MENTIONED IN THE CLAIM ABOUT IT.
 *
 * WORD BOUNDARIES, NOT `includes`. `bookings` is a substring of `bookings_old`
 * and of `no_bookings`, and a claim that name-dropped a table the change did
 * NOT create would then read as evidence. The needle is the created name with a
 * non-word character (or an end) on each side, so `bookings.slot` and
 * `"bookings"` match and `bookings_old` does not.
 *
 * ON ITS OWN THIS IS NOT EVIDENCE OF ANYTHING BUT EXISTENCE — see
 * `claimEvidence`, which is what `requirementOutcomes` asks.
 */
export function evidenceName(claim, names) {
  const text = typeof claim === "string" ? claim.toLowerCase() : "";
  if (!text) return "";
  for (const raw of Array.isArray(names) ? names : []) {
    const n = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (n.length < 3) continue;
    if (wordIn(text, n)) return n;
  }
  return "";
}

/** `needle` inside `text` with a non-word character (or an end) on each side. */
function wordIn(text, needle) {
  let at = text.indexOf(needle);
  while (at >= 0) {
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + needle.length] || "";
    if (!/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after)) return true;
    at = text.indexOf(needle, at + 1);
  }
  return false;
}

/**
 * EVIDENCE FOR THIS PARTICULAR CLAIM, OR NOTHING.
 *
 * `made` is what the change REALLY APPLIED, one entry per item:
 *
 *   { name, holds: [token…], fails: [token…] }
 *
 * `holds` are words from a CLOSED VOCABULARY that are true of the item as it
 * was applied — the access level a table really got, a column it really has, a
 * job's real schedule — and `fails` are words from that SAME vocabulary that
 * are false of it. The caller builds both, because the vocabulary belongs to
 * the schema engine and this module is dependency-free on purpose.
 *
 * ── EXISTENCE IS NOT DELIVERY (owner, 2026-09-14) ───────────────────────────
 *
 * This was a name match and nothing else, and the owner's words are the whole
 * correction: *"'Delivered' still means a name matched … marks 'customers see
 * only their own bookings' delivered when `by` mentions `bookings` — without
 * checking permissions."* A table exists whether or not it keeps anybody's rows
 * private, so the name proves the table and says nothing about the need.
 *
 * So a claim is evidence only when it names an applied item AND names a
 * CHECKED GUARANTEE of that item that really holds. Everything else is
 * `unverified` — including a bare name, which is the commonest shape and the
 * one the old reading called delivered.
 *
 * A TOKEN THAT IS FALSE DENIES THE WHOLE CLAIM, and it is asked FIRST. A claim
 * saying `bookings access user` about a table applied as `collect` is not
 * merely unproven, it disagrees with the database; reading the rest of the
 * sentence for something that happens to hold would let a wrong claim buy
 * itself a verdict off an incidental word.
 *
 * WHY THIS CANNOT CRY WOLF, STATED. Every reading here moves a requirement
 * TOWARDS `unverified` and never towards `failed`: there is no corpus of real
 * `by` claims to measure a false-alarm rate against — this shipped yesterday
 * and has never run live — so the one direction that is safe without one is the
 * direction that costs a sentence inviting the customer to check. A false
 * "I can't confirm" costs a look; a false "done" costs them the guarantee.
 */
export function claimEvidence(claim, made) {
  const text = typeof claim === "string" ? claim.toLowerCase() : "";
  if (!text) return null;
  const low = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  for (const m of Array.isArray(made) ? made : []) {
    const name = low(m && m.name);
    if (name.length < 3 || !wordIn(text, name)) continue;
    // ASKED FIRST: a claim that disagrees with what was applied is not evidence
    // for anything, whatever else it happens to say.
    for (const raw of Array.isArray(m.fails) ? m.fails : []) {
      const t = low(raw);
      if (t.length >= 3 && wordIn(text, t)) return null;
    }
    for (const raw of Array.isArray(m.holds) ? m.holds : []) {
      const t = low(raw);
      if (t.length >= 3 && wordIn(text, t)) return { name: m.name, token: raw };
    }
  }
  return null;
}

/**
 * EVERY REQUIREMENT, WITH WHAT REALLY BECAME OF IT.
 *
 * `[{need, status, step, state, why}]`, `state` one of `REQUIREMENT_STATES`.
 *
 * `told` is the steps that were really HANDED this change's outstanding
 * requirements, `failed` the kinds that ran and did not deliver (a refusal, an
 * item the engine dropped whole, a job that would not register), and `made`
 * WHAT WAS REALLY APPLIED — see `claimEvidence`. The rules, in the one order
 * that keeps a failure from being papered over by a step that ran:
 *
 *   unsupported                       → failed. The step said so itself.
 *   the owning step is in `failed`    → failed, whatever else happened.
 *   the owning step was never TOLD    → failed. A hand-off nobody delivered is
 *                                       a requirement dropped with extra
 *                                       ceremony, and reading it as done is
 *                                       precisely the old bug.
 *   `covered` and `by` names a CHECKED GUARANTEE that holds → delivered.
 *   everything else                   → unverified.
 *
 * `told`, NOT "THE STEP RAN" (owner, 2026-09-14: *"Send each outstanding
 * requirement to its receiving designer when that step is still ahead. Keep
 * requests for an earlier or omitted step outstanding."*). The two are
 * different questions and only one of them is about this requirement: the kinds
 * run in `ADD_KINDS` order, so a requirement the JOB step hands back to the
 * TABLE step names a step that ran perfectly well — an hour earlier in the same
 * message, without ever hearing the request. `told` is stamped where the brief
 * is really composed and sent, so a hand-off that reached nobody cannot read as
 * satisfied, and a hop that was added to the route without being wired cannot
 * either.
 *
 * `made` IS THE APPLIED RESULT, NOT THE PROPOSAL (owner, 2026-09-14: *"`aMadeNames`
 * comes from proposed designs before application. Use actual results"*). The
 * route used to hand in the names off the cleaned designs, so a function
 * Postgres REFUSED to create counted as evidence for the job that names it —
 * measured through the real route: a `CREATE OR REPLACE FUNCTION` answered with
 * a syntax error, `functionErrors` on the reply, and the requirement claiming
 * that function read `delivered` with the customer told nothing.
 *
 * A `covered` requirement has no `step`: the step that ANSWERED it owns it, so
 * the caller passes `kind` alongside and it is read from `r.from` when the
 * route recorded which kind wrote the entry. With no `from`, a `covered` entry
 * cannot be tied to a failed step and rests on its own evidence alone.
 */
export function requirementOutcomes(list, { told = [], failed = [], made = [] } = {}) {
  const heard = new Set((Array.isArray(told) ? told : []).filter((k) => typeof k === "string"));
  const bad = new Set((Array.isArray(failed) ? failed : []).filter((k) => typeof k === "string"));
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r !== "object") continue;
    const owner = r.status === "elsewhere" ? r.step : r.from;
    let state = "unverified", why = r.why || "";
    if (r.status === "unsupported") {
      state = "failed";
    } else if (owner && bad.has(owner)) {
      state = "failed";
      why = why || "the " + owner + " step could not do its part";
    } else if (r.status === "elsewhere" && (!owner || !heard.has(owner))) {
      state = "failed";
      why = why || "the " + (owner || "next") + " step never got it";
    } else if (r.status === "covered" && claimEvidence(r.by, made)) {
      state = "delivered";
    }
    out.push({ ...r, state, ...(why ? { why } : {}) });
  }
  return out;
}

export function requirementNote(list, { told = [], invalid = [], failed = [], made = [] } = {}) {
  const outcomes = requirementOutcomes(list, { told, failed, made });
  const bad = (Array.isArray(invalid) ? invalid : []).filter((x) => typeof x === "string" && x);
  const broke = outcomes.filter((r) => r.state === "failed");
  const unsure = outcomes.filter((r) => r.state === "unverified");
  if (!broke.length && !unsure.length && !bad.length) return "";
  const parts = [];
  const unsupported = broke.filter((r) => r.status === "unsupported");
  const handed = broke.filter((r) => r.status !== "unsupported");
  if (unsupported.length) {
    parts.push("One thing your site can't do yet: " + unsupported.slice(0, 3)
      .map((r) => r.need + (r.why ? " — " + r.why : "")).join("; ") + ".");
    if (unsupported.length > 3) parts.push("And " + (unsupported.length - 3) + " more like it.");
  }
  if (handed.length) {
    parts.push("Still to do: " + handed.slice(0, 3).map((r) => r.need).join("; ") + ".");
  }
  // THE HONEST CLAUSE, AND IT IS THE POINT OF THE THIRD STATE. What was built
  // is built; what nothing here can confirm is said as exactly that, rather
  // than left to the reply's "Done" to claim. It is deliberately an invitation
  // to check rather than a warning: the ordinary case is that it works.
  if (unsure.length) {
    parts.push("I've set that up, but I can't confirm from here that " + unsure.slice(0, 2)
      .map((r) => r.need).join("; or that ") + " — have a look and tell me if it isn't right.");
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
export function requirementRecord({ list = [], skipped = [], invalid = [], altered = [], ran = [], told = [], failed = [], made = [], unbuilt = {} } = {}) {
  const outcomes = requirementOutcomes(list, { told, failed, made });
  const n = (s) => outcomes.filter((r) => r.state === s).length;
  return {
    counts: {
      ...requirementCounts(list, skipped),
      // THE THREE STATES, BESIDE THE THREE STATUSES AND NOT INSTEAD OF THEM.
      // A status is what the MODEL said; a state is what really became of it.
      // Keeping both is what makes "the designer said covered and nothing here
      // can confirm it" a countable thing rather than an impression.
      delivered: n("delivered"), failed: n("failed"), unverified: n("unverified"),
    },
    requirements: outcomes.slice(0, MAX_REQUIREMENTS),
    unreadable: (Array.isArray(skipped) ? skipped : []).slice(0, MAX_REQUIREMENTS),
    invalidProps: (Array.isArray(invalid) ? invalid : []).slice(0, MAX_REQUIREMENTS),
    // A DECLARED VALUE THE PIPELINE STORED DIFFERENTLY — `method: "PUT"` kept as
    // `"GET"`, a schedule raised to the floor. Developer-facing, because a
    // customer cannot act on a property name; what they hear is the count of
    // guarantees that are not in place, which is `invalidProps`' clause.
    changedProps: (Array.isArray(altered) ? altered : []).slice(0, MAX_REQUIREMENTS),
    // WHAT THIS CHANGE REALLY APPLIED, and the guarantees each item really has —
    // the evidence every `delivered` above was decided from. Kept beside the
    // verdicts so a person reading the record can see WHY one was unverified
    // rather than having to re-derive it against the database.
    applied: (Array.isArray(made) ? made : []).slice(0, MAX_REQUIREMENTS * 2),
    handedTo: requirementsByStep(list),
    // WHICH STEPS WERE REALLY HANDED THEM, beside the list of who was NAMED.
    // The two disagreeing is the finding: a step named by a requirement that
    // had already run is a hand-off nobody could have delivered.
    toldSteps: (Array.isArray(told) ? told : []).filter((k) => typeof k === "string"),
    ran: (Array.isArray(ran) ? ran : []).filter((k) => typeof k === "string"),
    failedSteps: (Array.isArray(failed) ? failed : []).filter((k) => typeof k === "string"),
    // WHAT THE ENGINE DROPPED WHOLE, PER TIER — the report that did not exist
    // above the table tier at all. `{function: ["send_reminder"], job: […]}`.
    unbuilt: unbuilt && typeof unbuilt === "object" ? unbuilt : {},
  };
}
