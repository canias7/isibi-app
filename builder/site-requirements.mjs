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
 * ── WHETHER A SITE CAN ALREADY HOLD ONE, AND WHETHER ANYONE CAN LOOK ────────
 *
 * Owner, 2026-09-15: *"Distinguish 'not added by this change' from 'absent from
 * the site.'"* Doing that means knowing, per step, which question is even
 * askable — and the three answers are genuinely different, so they are three
 * lists rather than one flag.
 *
 *   SITE_KINDS    — the site can already hold one, and something can enumerate
 *                   them. A miss here means "not added AND not there" only when
 *                   the caller really READ that inventory (`existing.kinds`);
 *                   otherwise nobody looked and the answer is `unknown`.
 *   OPAQUE_KINDS  — the site may hold one and NOTHING can enumerate them. A
 *                   `component` folded into an existing page leaves no item
 *                   anywhere, and a `photo` is a URL inside a file. Absence is
 *                   never establishable, so these are never `absent`.
 *   neither       — `edit` alone. It names no artifact a site holds; "they can
 *                   change the wording later" is a real answer and the only
 *                   question about it is whether THIS CHANGE did it, which the
 *                   applied evidence answers on its own.
 *
 * `test/requirement-coverage.test.mjs` censuses the three against
 * `COVERAGE_STEPS` in both directions, so a step added next month must be
 * placed deliberately rather than falling into whichever branch it lands in.
 */
export const SITE_KINDS = ["table", "function", "api", "job", "page", "qr", "three"];
export const OPAQUE_KINDS = ["component", "photo"];

/**
 * WHAT BECAME OF A REQUIREMENT ONCE THE WHOLE CHANGE RAN.
 *
 *   delivered   — a behaviour something really EXERCISED ties this need to what
 *                 was built. Nothing fills that list today; see `claimEvidence`.
 *   configured  — the implementation is there and a SETTING read back off it
 *                 matches the claim. Recorded, never promoted: "the function is
 *                 public" does not prove it checks ownership.
 *   unverified  — the implementation IS established — this change applied it,
 *                 or the site already had it — and NOTHING ties it to this
 *                 particular claim.
 *   unknown     — nothing here can establish whether the implementation is
 *                 there at all. Separate from `unverified` since 2026-09-15,
 *                 because that one's sentence opens *"I've set that up"*.
 *   missing     — the implementation is not there, and this layer can see that
 *                 it is not: this change did not add it AND the site does not
 *                 have it, both read from a source that can enumerate.
 *   blocked     — the step this need depends on ran and failed.
 *   failed      — the platform said it could not do it, or the step that
 *                 CLAIMED it failed.
 *
 * ── A HANDOFF IS NOT AN IMPLEMENTATION (2026-09-15, owner, after run 48) ────
 *
 * *"A requirement sent backward to an earlier step is an unresolved handoff;
 * that alone does not establish that its implementation is missing."*
 *
 * This list had three entries and an `elsewhere` requirement whose step was
 * never told fell straight to `failed`. Run 48 is the instance and it is exact:
 * the PAGE step handed *"a new function named count_existing_bookings"* to the
 * FUNCTION step, which runs before it in `ADD_KINDS` order and so could not
 * have heard it — and the customer was told **"Still to do: A new function
 * named count_existing_bookings"** about a function that had been created in
 * that same change, was live, and answered `3` through the site's own public
 * route within the minute.
 *
 * The undelivered handoff was REAL and is still reported (`handoff`), and the
 * rule that produced it is right: a hand-off nobody delivered must never read
 * as satisfied. What was wrong is that it was the only question asked. The
 * implementation is a SECOND question with its own answer, and
 * `implementationOf` asks it against what was really applied.
 *
 * AND THE EVIDENCE IS STILL ASYMMETRIC, which is why `missing` and `unverified`
 * are separate rather than one "not done". Seeing an applied item proves it
 * exists; NOT seeing one proves it is absent only where this layer can see that
 * kind at all — `APPLIED_KINDS` is that list, and a kind off it answers
 * `unverified` rather than `missing`. Silence is never read as success and
 * never as failure.
 */
export const REQUIREMENT_STATES = ["delivered", "configured", "unverified", "unknown", "missing", "blocked", "failed"];

/**
 * WHAT BECAME OF THE HAND-OFF ITSELF, beside what became of the work.
 *
 *   delivered    — the step it names was really composed a brief and sent it.
 *   undelivered  — it named a step that never heard it: one that had already
 *                  run, or one this change never ran at all.
 *
 * Its own field because the two answers are independent in both directions. A
 * delivered handoff whose step then made nothing is `missing` work with a
 * delivered handoff; an undelivered handoff whose thing exists anyway — run
 * 48 — is a real bookkeeping gap over working software. Collapsing them is what
 * let one of those be reported as the other.
 */
export const HANDOFF_STATES = ["delivered", "undelivered"];

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
    // THE EXPLICIT REFERENCE, AND IT IS OPTIONAL ON PURPOSE. With it, "did that
    // step really make this" is one equality against an applied name; without
    // it the question falls back to the kind, which is coarser and still
    // structural. Asking for it unconditionally would get one invented, and an
    // invented name reads as a thing that was never made.
    item: {
      type: "string",
      description:
        "For \"elsewhere\" only, and ONLY if you can name it exactly: the name of the thing you are asking that " +
        "step to make — a function name, a table name, a route like \"/booking-check\". It is what lets us check " +
        "afterwards whether that step really made it. LEAVE IT OUT rather than inventing one: a guessed name is " +
        "worse than none, because it reads as something that was asked for and never built.",
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
      if (COVERAGE_STEPS.includes(step)) {
        e.step = step;
        // NOT VALIDATED AGAINST ANYTHING, because there is nothing to validate
        // it against yet — the thing it names is what a LATER step may make.
        // It is compared by equality when the results are in, and an empty or
        // unreadable one simply leaves the reconcile on the kind.
        const item = str(r.item, 80);
        if (item) e.item = item;
      } else { e.status = "unsupported"; e.why = "named a step this change does not run"; }
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
 *   { name, holds: [token…], fails: [token…], checked: [token…] }
 *
 * `holds` are words from a CLOSED VOCABULARY that are true of the item as it
 * was applied — the access level a table really got, a column it really has, a
 * job's real schedule — and `fails` are words from that SAME vocabulary that
 * are false of it. The caller builds both, because the vocabulary belongs to
 * the schema engine and this module is dependency-free on purpose.
 *
 * ── CONFIGURATION IS NOT BEHAVIOUR (owner, 2026-09-14) ──────────────────────
 *
 * *"Matching configuration words must not mark an entire business requirement
 * delivered. 'The function is public' does not prove it checks ownership."*
 *
 * Every token in `holds` is a CONFIGURATION fact: a setting we read back off
 * what was applied. It is real, and it is not the requirement. A claim saying
 * *"send_reminder is public and only sends to the person who booked"* names a
 * configuration word that genuinely holds and a BEHAVIOUR nothing here has
 * exercised — and the old reading promoted the whole sentence to `delivered`
 * off the first half.
 *
 * So the two kinds of fact are SEPARATE LISTS on the item, and the PRODUCER
 * says which is which rather than this module guessing from the words:
 *
 *   `holds`    configuration, read back from what was applied. Recorded as a
 *              configuration fact and NEVER a delivery.
 *   `checked`  a BEHAVIOUR this change really exercised. The only thing that
 *              can answer `delivered`.
 *
 * **NOTHING FILLS `checked` TODAY**, and that is the honest state rather than
 * an oversight: no step on this path runs a function, calls a connection or
 * fires a job to see what it does. `appliedFacts` says so in as many words.
 * The door is here so that the day something DOES verify a behaviour it has a
 * way to say so — and until then every `covered` claim reads back as *"I've
 * set that up, but I can't confirm from here that …"*, which is what the
 * customer should hear about a behaviour nobody checked.
 *
 * **THE COST, STATED**: `delivered` is unreachable from this path, so that
 * count is 0 on every change and the honest clause appears on every covered
 * claim. That is more sentences than before and each one is true; the reverse
 * — a confident "done" off a configuration word — is the failure this exists
 * to stop.
 *
 * **AND IT IS NOT A KEYWORD HEURISTIC.** Nothing here reads a claim for
 * behavioural-sounding words or scores how much of a sentence is accounted
 * for. The split is structural: the producer of a fact knows whether it
 * checked a setting or exercised a behaviour, and says so by which list it
 * puts the token in.
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
    // A BEHAVIOUR SOMETHING REALLY EXERCISED comes first, because it is the
    // only kind of fact that can settle the requirement rather than describe
    // the thing the requirement is about.
    for (const raw of Array.isArray(m.checked) ? m.checked : []) {
      const t = low(raw);
      if (t.length >= 3 && wordIn(text, t)) return { name: m.name, token: raw, kind: "checked" };
    }
    for (const raw of Array.isArray(m.holds) ? m.holds : []) {
      const t = low(raw);
      if (t.length >= 3 && wordIn(text, t)) return { name: m.name, token: raw, kind: "config" };
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
/**
 * DID THE STEP A REQUIREMENT WAS HANDED TO REALLY MAKE THE THING?
 *
 * `{ state: "found" | "absent" | "unknown", by, name, kind }`.
 *
 * ── EXPLICIT REFERENCES, NOT ANOTHER KEYWORD SCAN (owner, 2026-09-15) ───────
 *
 * *"Reconcile requirements with actual applied results using explicit
 * references, such as kind and item name — not another keyword heuristic."*
 *
 * Two comparisons and both are structural. `r.step` is an enum off
 * `COVERAGE_STEPS` and `m.kind` is stamped by the loop in `appliedFacts` that
 * produced the entry, so `r.step === m.kind` reads one label against another.
 * `r.item` — when the designer named what it was asking for — is compared to
 * `m.name` by EQUALITY, lowercased and trimmed and nothing else. No text is
 * searched, so the recorded failure modes of `evidenceName` (a substring, a
 * name that happens to appear in a sentence about something else) cannot arise.
 *
 * ── AND THE TWO DIRECTIONS ARE NOT SYMMETRIC, WHICH IS THE WHOLE CARE HERE ──
 *
 * With an `item`, both directions are exact: the named thing is in the applied
 * list or it is not.
 *
 * WITHOUT one, only ONE direction is sound. A kind that applied NOTHING
 * certainly did not apply the particular thing, so `absent` follows. A kind
 * that applied SOMETHING tells you nothing about whether that something is what
 * this requirement asked for — a job step writing *"the reminder shows their
 * booking time — that is the function step's"* is not answered by the existence
 * of a function designed before the request. So a populated kind with no `item`
 * answers **`unknown`**, never `found`.
 *
 * That asymmetry is this module's own rule kept: seeing a thing proves it
 * exists, and not seeing one proves absence only where absence is visible.
 * Reading a populated kind as `found` would make any function satisfy any
 * request for a function, which is the coarse version of exactly the collapse
 * this change exists to undo.
 *
 * `reportable` is the kinds whose answer is KNOWN when the question is asked —
 * the route's own list. A kind off it answers `unknown` whatever `made` holds,
 * and with no `reportable` at all NOTHING is absent, so an unchanged caller
 * keeps the conservative answer.
 *
 * **WHAT THIS CANNOT ESTABLISH, STATED.** That the thing WORKS. An applied
 * function establishes that a function was created and nothing whatever about
 * whether it does what the requirement asked — which is why `found` answers
 * `unverified` and never `delivered`, and why `page` entries carry an empty
 * vocabulary. The only list that settles a requirement is `checked`, and
 * nothing fills it (`appliedFacts`).
 */
export function implementationOf(r, made = [], reportable = [], existing = null) {
  const kind = r && typeof r === "object" && r.status === "elsewhere" ? String(r.step || "") : "";
  if (!kind) return { state: "unknown", by: "", name: "", kind: "" };
  const low = (v) => String((v && v.name) || "").trim().toLowerCase();
  const ofKind = (list) => (Array.isArray(list) ? list : []).filter((m) => m && String(m.kind || "") === kind);
  // ── TWO SOURCES OF PRESENCE, AND THEY ARE NOT THE SAME CLAIM ────────────
  //
  // `made` is what THIS CHANGE applied; `existing` is what the site ALREADY
  // had, and a caller supplies it only for kinds it can really enumerate.
  // Both answer "the thing is there"; neither alone answers "it is not".
  const canApplied = (Array.isArray(reportable) ? reportable : []).includes(kind);
  const ex = existing && typeof existing === "object" ? existing : null;
  const canExisting = !!ex && (Array.isArray(ex.kinds) ? ex.kinds : []).includes(kind);
  const mine = ofKind(made);
  const theirs = ex ? ofKind(ex.items) : [];
  // **ABSENCE NEEDS EVERY READER THAT COULD SPEAK TO HAVE SPOKEN**, which is
  // the owner's instruction — *"Where existing presence cannot be established,
  // report unknown — not missing"* — and NOT a blanket demand for two readers.
  // The three cases are `SITE_KINDS` / `OPAQUE_KINDS` / neither:
  //
  //   * a kind the site can hold is `absent` only when its inventory was really
  //     read (`canExisting`); unread, nobody looked, so `unknown`.
  //   * a kind nothing can enumerate is NEVER absent, whatever was applied.
  //   * `edit` names no artifact, so the applied evidence is the whole answer —
  //     demanding a site inventory there would lose a real finding, which is
  //     what the first cut of this change did.
  const opaque = OPAQUE_KINDS.includes(kind);
  const holdable = SITE_KINDS.includes(kind);
  const visible = canApplied && !opaque && (!holdable || canExisting);
  const item = typeof r.item === "string" ? r.item.trim().toLowerCase() : "";
  if (item) {
    const hit = mine.find((m) => low(m) === item);
    if (hit) return { state: "found", by: "item", where: "applied", name: String(hit.name), kind };
    // NOT ADDED BY THIS CHANGE IS NOT ABSENT FROM THE SITE. A change that
    // deliberately reuses a function it did not need to create leaves nothing
    // in `made`, and reading that as "still to do" is run 48's defect wearing
    // a different hat.
    const had = theirs.find((m) => low(m) === item);
    if (had) return { state: "found", by: "item", where: "existing", name: String(had.name), kind };
    return { state: visible ? "absent" : "unknown", by: "item", name: item, kind };
  }
  // No name to match: only the EMPTY direction is sound. See the head — and it
  // is emptiness of BOTH, because a site that already has things of this kind
  // cannot say whether one of them is the thing this requirement asked for.
  if (mine.length || theirs.length) return { state: "unknown", by: "kind", name: "", kind };
  return { state: visible ? "absent" : "unknown", by: "kind", name: "", kind };
}

export function requirementOutcomes(list, { told = [], failed = [], failedItems = [], made = [], reportable = [], existing = null } = {}) {
  const heard = new Set((Array.isArray(told) ? told : []).filter((k) => typeof k === "string"));
  const bad = new Set((Array.isArray(failed) ? failed : []).filter((k) => typeof k === "string"));
  // ── WHICH THING FAILED, NOT WHICH KIND (owner, 2026-09-15) ──────────────
  //
  // *"One failed function must not block a requirement whose different
  // function applied successfully."* `failed` is a set of KINDS, so one
  // refused function blocked every requirement handed to the function step —
  // including one naming a function the database created without complaint.
  // `failedItems` is `[{kind, name}]`: the things that really failed, so a
  // requirement that NAMES its dependency is judged on that dependency.
  const broken = new Set((Array.isArray(failedItems) ? failedItems : [])
    .filter((f) => f && typeof f === "object")
    .map((f) => String(f.kind || "") + "::" + String(f.name || "").trim().toLowerCase()));
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r !== "object") continue;
    const owner = r.status === "elsewhere" ? r.step : r.from;
    // ── THE HAND-OFF'S OWN ANSWER, DECIDED FIRST AND KEPT WHATEVER ELSE ────
    //
    // A hand-off that reached nobody is a real finding and is still reported
    // here — what it is NOT is evidence about the work, which is decided
    // separately below. Run 48 collapsed the two and told a customer a live,
    // working function was still to do.
    const handoff = r.status === "elsewhere" ? (owner && heard.has(owner) ? "delivered" : "undelivered") : "";
    const impl = r.status === "elsewhere" ? implementationOf(r, made, reportable, existing) : null;
    // THE NAMED DEPENDENCY, AND WHETHER IT IS THE ONE THAT BROKE. Asked in
    // this order deliberately: a thing KNOWN to have failed is blocked before
    // anything else is asked about it, and only then does a thing known to be
    // there excuse its step's other failures. The two are disjoint today (the
    // route puts only CREATED items in `made`), and the fail-closed order is
    // what keeps that an observation rather than a dependency.
    const dep = impl && typeof r.item === "string" ? r.item.trim().toLowerCase() : "";
    const depBroke = !!dep && broken.has(String(owner || "") + "::" + dep);
    const depThere = !!impl && impl.state === "found";
    let state = "unverified", why = r.why || "", configuredBy = "";
    if (r.status === "unsupported") {
      // The step said so itself, in its own words.
      state = "failed";
    } else if (r.status === "elsewhere" && depBroke) {
      // THIS requirement's own dependency failed — the strongest and most
      // specific thing that can be said, and it names the item.
      state = "blocked";
      why = why || "the " + dep + " it needs could not be created";
    } else if (r.status === "elsewhere" && owner && bad.has(owner) && !depThere) {
      // A DEPENDENCY FAILED. Its own state, because "the part this needed did
      // not work" is a different thing to tell somebody from "we could not do
      // this" — the first names something to go and fix.
      //
      // `!depThere` is the scope: the step had A failure, and if the thing THIS
      // requirement names is nonetheless there, that failure was somebody
      // else's. A requirement that names nothing still blocks, because a step
      // that failed is the only evidence available about it.
      state = "blocked";
      why = why || "the " + owner + " step could not do its part";
    } else if (r.status === "covered" && owner && bad.has(owner)) {
      // The step that CLAIMED to cover it failed, so the claim goes with it.
      state = "failed";
      why = why || "the " + owner + " step could not do its part";
    } else if (r.status === "elsewhere") {
      if (impl.state === "absent") {
        state = "missing";
        why = why || (handoff === "undelivered"
          ? "the " + (owner || "next") + " step never got it, and nothing of that kind was added"
          : "the " + (owner || "next") + " step was told and added nothing for it");
      } else if (impl.state === "found") {
        // THE IMPLEMENTATION IS ESTABLISHED and its behaviour is not — an item
        // proves existence and never conduct, whether this change applied it
        // or the site already had it.
        state = "unverified";
      } else {
        // NOTHING HERE CAN SEE WHETHER IT IS THERE, and that is its own answer
        // rather than a quiet "unverified" (owner, 2026-09-15): the customer's
        // sentence for `unverified` opens *"I've set that up"*, which is a
        // claim nobody is entitled to make about an implementation nobody
        // could find.
        state = "unknown";
      }
    } else if (r.status === "covered") {
      // ── CONFIGURATION SETTLES NOTHING (owner, 2026-09-14) ────────────────
      //
      // A configuration fact is its own STATE now rather than a note beside
      // `unverified`: *"'The function is public' does not prove it checks
      // ownership."* Only a `checked` token — a behaviour something really
      // exercised — answers `delivered`, and nothing fills that list today, so
      // `configured` is as far as a claim about a real setting can get.
      const ev = claimEvidence(r.by, made);
      if (ev && ev.kind === "checked") state = "delivered";
      else if (ev) { state = "configured"; configuredBy = String(ev.name) + ": " + String(ev.token); }
    }
    out.push({
      ...r, state,
      ...(handoff ? { handoff } : {}),
      // `implementedBy` IS ONLY EVER THE THING THAT WAS FOUND. The reader
      // carries the name it SOUGHT out of a miss too, which is useful inside
      // it and is a lie on the wire: a field named "implemented by" beside
      // `implementation: "absent"` reads as the thing existing.
      // …AND `foundIn` SAYS WHICH READER ANSWERED, because "this change made
      // it" and "the site already had it" are the distinction item 2 is about
      // and a record that collapses them cannot be audited later.
      ...(impl ? { implementation: impl.state, ...(impl.state === "found" && impl.name ? { implementedBy: impl.name, foundIn: impl.where || "applied" } : {}) } : {}),
      ...(configuredBy ? { configuredBy } : {}),
      ...(why ? { why } : {}),
    });
  }
  return out;
}

export function requirementNote(list, { told = [], invalid = [], failed = [], failedItems = [], made = [], reportable = [], existing = null, unexpressed = [] } = {}) {
  const outcomes = requirementOutcomes(list, { told, failed, failedItems, made, reportable, existing });
  const bad = (Array.isArray(invalid) ? invalid : []).filter((x) => typeof x === "string" && x);
  const lost = (Array.isArray(unexpressed) ? unexpressed : []).filter((x) => typeof x === "string" && x);
  const unsupported = outcomes.filter((r) => r.state === "failed" && r.status === "unsupported");
  const broke = outcomes.filter((r) => r.state === "failed" && r.status !== "unsupported");
  const blocked = outcomes.filter((r) => r.state === "blocked");
  const gone = outcomes.filter((r) => r.state === "missing");
  // CONFIGURED SITS WITH UNVERIFIED IN WHAT THE CUSTOMER HEARS, and it should:
  // both mean "it is there and nothing here checked what it does", which is one
  // sentence to a person. The two are separate in the RECORD, where the
  // difference is actionable.
  const unsure = outcomes.filter((r) => r.state === "unverified" || r.state === "configured");
  // …AND `unknown` IS NOT ONE OF THEM (owner, 2026-09-15): *"'I've set that up'
  // is inappropriate when implementation is unknown."* The clause below opens
  // with exactly that, so a need whose implementation nobody could find gets
  // its own sentence rather than a claim about work that may not exist.
  const unseen = outcomes.filter((r) => r.state === "unknown");
  if (!unsupported.length && !broke.length && !blocked.length && !gone.length && !unsure.length
    && !unseen.length && !bad.length && !lost.length) return "";
  const parts = [];
  if (unsupported.length) {
    parts.push("One thing your site can't do yet: " + unsupported.slice(0, 3)
      .map((r) => r.need + (r.why ? " — " + r.why : "")).join("; ") + ".");
    if (unsupported.length > 3) parts.push("And " + (unsupported.length - 3) + " more like it.");
  }
  // ── "STILL TO DO" MEANS THE WORK IS NOT THERE, AND NOTHING ELSE ──────────
  //
  // It used to be said about any hand-off nobody delivered, whatever had been
  // built — run 48's *"Still to do: A new function named
  // count_existing_bookings"* about a function that was live and answering. It
  // is reached now only from `missing` (this layer looked and the thing is not
  // there) and from a `covered` claim whose own step failed.
  const absent = [...gone, ...broke];
  if (absent.length) {
    parts.push("Still to do: " + absent.slice(0, 3).map((r) => r.need).join("; ") + ".");
  }
  // A DIFFERENT SENTENCE FOR A DEPENDENCY, because it points somewhere else: a
  // customer can act on "the part this needed didn't work" by asking about that
  // part, where "still to do" invites them to ask for the same thing again.
  if (blocked.length) {
    parts.push("And this one is waiting on another part of the same change that didn't work: "
      + blocked.slice(0, 2).map((r) => r.need + (r.why ? " — " + r.why : "")).join("; ") + ".");
  }
  // THE HONEST CLAUSE, AND IT IS THE POINT OF THE THIRD STATE. What was built
  // is built; what nothing here can confirm is said as exactly that, rather
  // than left to the reply's "Done" to claim. It is deliberately an invitation
  // to check rather than a warning: the ordinary case is that it works.
  if (unsure.length) {
    parts.push("I've set that up, but I can't confirm from here that " + unsure.slice(0, 2)
      .map((r) => r.need).join("; or that ") + " — have a look and tell me if it isn't right.");
  }
  // ── AND A DIFFERENT SENTENCE FOR A DIFFERENT SILENCE ─────────────────────
  //
  // The clause above says *the work is there and I could not check it*; this
  // one says *I could not even see whether it is there*. Telling somebody the
  // first about the second is a claim, and the thing to do about it is the
  // same look with a different question — so it asks for that, and it invites
  // the ask again rather than a correction, because there may be nothing to
  // correct.
  if (unseen.length) {
    parts.push("I can't see from here whether " + unseen.slice(0, 2)
      .map((r) => r.need).join("; or whether ")
      + " — nothing I can check says either way, so have a look, and ask me for it again if it isn't there.");
  }
  // ONE CLAUSE, AND IT DOES NOT NAME THE PROPERTY. The count is what a customer
  // can act on ("ask me again and say which"); the names are the developer's.
  if (bad.length) {
    parts.push(bad.length === 1
      ? "I also asked the database for a guarantee it doesn't offer, so that one isn't in place."
      : "I also asked the database for " + bad.length + " guarantees it doesn't offer, so those aren't in place.");
  }
  // ── A DIFFERENT SENTENCE, BECAUSE IT IS A DIFFERENT PARTY ────────────────
  //
  // Owner, 2026-09-14: *"Distinguish 'the engine does not support this' from
  // 'the addon cannot express or preserve this.' `language` is the second
  // case."*
  //
  // The clause above says the DATABASE cannot do it, which is what a customer
  // hears as "stop asking for that". This one says the database can and THIS
  // STEP could not carry it — so the thing to do is ask again another way, or
  // ask us to widen the step, and telling them the first sentence about the
  // second case sends them to argue with the wrong layer.
  //
  // Counts, never names, for exactly the reason the clause above gives; and
  // naming them here would ALSO be the "expose hidden settings" the owner ruled
  // out in the same message — `language` and `definer` are deliberately not on
  // the tool, and a sentence listing them is an invitation to ask for one.
  if (lost.length) {
    parts.push(lost.length === 1
      ? "One setting the design asked for isn't something this kind of change can carry through, so it's on the database's own default — say it again on its own and I'll have another go."
      : lost.length + " settings the design asked for aren't things this kind of change can carry through, so they're on the database's own defaults — say them again on their own and I'll have another go.");
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
export function requirementRecord({ list = [], skipped = [], invalid = [], altered = [], ran = [], told = [], shown = [], failed = [], failedItems = [], made = [], reportable = [], existing = null, unbuilt = {}, unexpressed = [] } = {}) {
  const outcomes = requirementOutcomes(list, { told, failed, failedItems, made, reportable, existing });
  const n = (s) => outcomes.filter((r) => r.state === s).length;
  return {
    counts: {
      ...requirementCounts(list, skipped),
      // EVERY STATE, BESIDE THE THREE STATUSES AND NOT INSTEAD OF THEM. A
      // status is what the MODEL said; a state is what really became of it.
      // Keeping both is what makes "the designer said covered and nothing here
      // can confirm it" a countable thing rather than an impression.
      delivered: n("delivered"),
      // A CLAIM THAT MATCHED A REAL SETTING is a different kind of unverified
      // from one nothing could be said about at all, and collapsing the two
      // loses the only half of the evidence this path can actually produce.
      configured: n("configured"),
      unverified: n("unverified"),
      // NOBODY COULD SEE WHETHER IT IS THERE — its own number, because a run
      // full of these is a run that answered almost nothing, and folded into
      // `unverified` it reads as a run that built a lot and checked none of it.
      unknown: n("unknown"),
      // THE WORK IS NOT THERE / A DEPENDENCY FAILED / THE STEP SAID IT COULD
      // NOT — three different things to do about it, so three numbers.
      missing: n("missing"), blocked: n("blocked"), failed: n("failed"),
    },
    // ── THE HAND-OFF LEDGER, SEPARATE FROM THE WORK (2026-09-15) ───────────
    //
    // `undelivered` is the count of requirements that named a step which never
    // heard them. It is a real defect in this change's own bookkeeping and is
    // worth reading on its own — but it is NOT the count of things that did not
    // get built, and reading it as one is what run 48 did. Its neighbours above
    // are what did not get built.
    handoffs: {
      delivered: outcomes.filter((r) => r.handoff === "delivered").length,
      undelivered: outcomes.filter((r) => r.handoff === "undelivered").length,
    },
    requirements: outcomes.slice(0, MAX_REQUIREMENTS),
    unreadable: (Array.isArray(skipped) ? skipped : []).slice(0, MAX_REQUIREMENTS),
    invalidProps: (Array.isArray(invalid) ? invalid : []).slice(0, MAX_REQUIREMENTS),
    // A DECLARED VALUE THE PIPELINE STORED DIFFERENTLY — `method: "PUT"` kept as
    // `"GET"`, a schedule raised to the floor. Developer-facing, because a
    // customer cannot act on a property name; what they hear is the count of
    // guarantees that are not in place, which is `invalidProps`' clause.
    changedProps: (Array.isArray(altered) ? altered : []).slice(0, MAX_REQUIREMENTS),
    // WHAT THE ENGINE WOULD HAVE USED AND THIS STEP COULD NOT CARRY — the other
    // half of `invalidProps`, and the half a customer's sentence deliberately
    // does not name. THIS is where the names belong: `language` here says the
    // addon's function tool has no property for it, which is a thing to go and
    // build, where the same name under `invalidProps` would say the database
    // never heard of it, which is false.
    unexpressedProps: (Array.isArray(unexpressed) ? unexpressed : []).slice(0, MAX_REQUIREMENTS),
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
    // ── AND WHAT EACH STEP WAS SHOWN ABOUT THE DATABASE (2026-09-15) ───────
    //
    // Run 48's first demonstration — *"the function designer's actual input
    // includes the existing bookings schema"* — had NO stored answer, because
    // the only `site` on the record was the one value left at the end of the
    // loop. `shownSteps` is per kind, in run order, and each entry is taken
    // from the object really handed to that call (`shownSchema`). It is the
    // smallest thing that settles "did this step see that table?" as a fact.
    shownSteps: (Array.isArray(shown) ? shown : []).filter((x) => x && typeof x === "object").slice(0, MAX_REQUIREMENTS),
    ran: (Array.isArray(ran) ? ran : []).filter((k) => typeof k === "string"),
    failedSteps: (Array.isArray(failed) ? failed : []).filter((k) => typeof k === "string"),
    // WHAT THE ENGINE DROPPED WHOLE, PER TIER — the report that did not exist
    // above the table tier at all. `{function: ["send_reminder"], job: […]}`.
    unbuilt: unbuilt && typeof unbuilt === "object" ? unbuilt : {},
  };
}
