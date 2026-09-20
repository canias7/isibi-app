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
// also enlarges the build's 97,142-character tool and becomes a promise
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
 *                   anywhere. Absence is never establishable, so these are
 *                   never `absent`.
 *   neither       — `edit` alone. It names no artifact a site holds; "they can
 *                   change the wording later" is a real answer and the only
 *                   question about it is whether THIS CHANGE did it, which the
 *                   applied evidence answers on its own.
 *
 * ⚠ `photo` MOVED FROM OPAQUE TO SITE (2026-09-19), and the reason is the
 * IDENTITY rather than a change of mind. It sat here because "a photo is a URL
 * inside a file" — true, and the wrong thing to identify one BY. The `photo`
 * designer answers `{page, describe}` and cannot know the url, which the
 * provider mints after it has spoken, so the only thing a requirement about a
 * picture can name is its PLACEMENT — the owner's own word. By that identity a
 * photograph IS enumerable: `imageRefs` reads which pages carry one, so "this
 * site already shows a photograph on /gallery" is a fact this layer can state,
 * which is exactly the test that separates the two lists. `component` stays
 * opaque because nothing gives it an identity at all.
 *
 * `test/requirement-coverage.test.mjs` censuses the three against
 * `COVERAGE_STEPS` in both directions, so a step added next month must be
 * placed deliberately rather than falling into whichever branch it lands in.
 */
export const SITE_KINDS = ["table", "function", "api", "job", "page", "qr", "three", "photo"];
export const OPAQUE_KINDS = ["component"];

/**
 * THE KINDS A REFERENCE MAY NAME — every step that owns an artifact.
 *
 * DERIVED from `COVERAGE_STEPS`, which is the census's own list, so a step added
 * next month is offered here by construction. `edit` is the one exclusion and it
 * is excluded BY MEANING rather than by being left out of a second list: it
 * names no artifact a site holds, so `{kind: "edit", item: "x"}` could never be
 * looked up in anything.
 *
 * `component` and `photo` ARE offered and always answer `unknown`, which is the
 * honest pair: the designer can say what it made, and this layer says it cannot
 * see one. Refusing the kind would leave them naming nothing or lying.
 */
export const ITEM_KINDS = Object.freeze(COVERAGE_STEPS.filter((k) => k !== "edit"));

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
    // ── WHAT KIND OF THING `item` NAMES, AND IT IS THE `covered` HALF ONLY ──
    //
    // Owner, 2026-09-15: *"Allow covered requirements to name a different
    // implementation kind explicitly; the authoring step alone cannot identify
    // it."* An `elsewhere` reference is a request TO a named step, so `step`
    // already says what kind of thing is being asked for. A `covered` reference
    // does not: `from` is which CALL answered, and the tool invites a table step
    // to name the function that does the work, so the step is not the kind.
    //
    // WITHOUT IT THE REFERENCE IS AMBIGUOUS AND STAYS `unknown`. Searching every
    // kind by name instead is what let an applied TABLE satisfy a claim about a
    // FUNCTION of the same name — `bookings` is the ordinary shape of that
    // collision, not a contrived one.
    kind: {
      type: "string",
      enum: ITEM_KINDS,
      description:
        "For \"covered\" only, and only beside `item`: what KIND of thing `item` names — a \"table\", a " +
        "\"function\", a \"page\" and so on. Name it whenever you name an item, INCLUDING when it is the same " +
        "kind of thing this step makes: a table and a function may share a name, and without this we cannot tell " +
        "which of them you meant and will report that we could not check it.",
    },
    // THE EXPLICIT REFERENCE, AND IT IS OPTIONAL ON PURPOSE. With it, "is that
    // thing really there" is one equality against an applied name; without it
    // the question falls back to the kind, which is coarser and still
    // structural. Asking for it unconditionally would get one invented, and an
    // invented name reads as a thing that was never made.
    //
    // OFFERED FOR BOTH STATUSES SINCE 2026-09-15 (owner: *"Support explicit
    // item references for covered requirements"*). `by` already names the thing
    // inside a sentence; this is the same name on its own, where it can be
    // compared by equality instead of searched for in prose.
    item: {
      type: "string",
      description:
        "ONLY if you can name it exactly: the name of the one thing this rests on — a function name, a table " +
        "name, a route like \"/booking-check\", the short name you gave a photograph. A requirement about ONE " +
        "picture names that picture; one about every picture on a page names the page's route. " +
        "For \"elsewhere\" it is what you are asking that step to make; " +
        "for \"covered\" it is the thing in your own design that does the work, the same name `by` mentions. " +
        "It is what lets us check afterwards whether that thing is really there. LEAVE IT OUT rather than " +
        "inventing one: a guessed name is worse than none, because it reads as something that was asked for " +
        "and never built.",
    },
    // ── THE HAND-OFF'S OWN IDENTITY, ECHOED BACK ────────────────────────
    //
    // Set ONLY when this entry answers a requirement another step handed you.
    // The brief you were given prints each one with its id in square brackets;
    // copy that id here, exactly, on the entry that covers it.
    //
    // IT IS AN ID AND NOT A SENTENCE. Two steps describing one need in their
    // own words is the ordinary case, and matching those descriptions is how a
    // reconciliation quietly joins two DIFFERENT needs that happen to read
    // alike. Leave it out rather than guessing: an entry with no id is simply
    // judged on its own, which is what happens today.
    answers: {
      type: "string",
      description: "Only when this entry answers a requirement handed to you: the id it was listed under in "
        + "\"What this addition still has to do\", copied exactly (it looks like `function#0`). It is how we "
        + "tie what you built to what you were asked for, so the customer is told once rather than twice. "
        + "LEAVE IT OUT unless you are answering one of those — never invent one, and never use it for a "
        + "requirement you are raising yourself.",
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
  // ⚠ AND THE CAP WAS A SILENT DROP ONE LINE ABOVE THE LIST THAT NAMES DROPS
  // (2026-09-20). `items.slice(0, MAX_REQUIREMENTS)` ran BEFORE this loop, so
  // a step that raised more needs than the cap had the rest discarded with no
  // `skipped` row and no count — the customer told the change was made, and
  // the record silent about the gaps the whole shape exists to surface.
  //
  // THIS IS `cleanAdd`'s OWN CORRECTION, RE-APPLIED ONE MODULE OVER: it moved
  // its list cap below the loop for exactly this reason and gave the loss its
  // own token. Two readers of one lesson, and only one of them had it.
  //
  // `over-cap` IS ITS OWN WHY, never `not-an-entry`: the entry was perfectly
  // readable and we chose not to carry it, which is a different thing to tell
  // a developer and needs a different fix.
  for (const r of items.slice(MAX_REQUIREMENTS)) {
    skipped.push({ need: str(r && r.need, MAX_NEED), why: "over-cap" });
  }
  for (const r of items.slice(0, MAX_REQUIREMENTS)) {
    if (!r || typeof r !== "object" || Array.isArray(r)) { skipped.push({ need: "", why: "not-an-entry" }); continue; }
    const need = str(r.need, MAX_NEED);
    if (!need) { skipped.push({ need: "", why: "no-need" }); continue; }
    // `includes` over the frozen list, never `Object.hasOwn` on a map — the
    // statuses are values, not keys, so `"constructor"` is simply not one.
    const status = str(r.status, 20).toLowerCase();
    if (!COVERAGE.includes(status)) { skipped.push({ need, why: "bad-status" }); continue; }
    // ── A STABLE IDENTITY, OURS AND NOT THE MODEL'S ─────────────────────
    //
    // `<step>#<position>` over the entries this step KEPT — deterministic, so
    // the same answer cleans to the same ids twice, and unique across steps
    // because the step owns the prefix. It is stamped only when we know which
    // step wrote it: with no owner there is nothing to make an id out of and
    // nothing downstream that could use one.
    const e = { need, status, ...(owner ? { from: owner, id: owner + "#" + list.length } : {}) };
    // THE EXPLICIT REFERENCE SURVIVES CLEANING FOR BOTH STATUSES (owner,
    // 2026-09-15: *"Support explicit item references for covered requirements,
    // preserve them through cleaning"*). It sat inside the `elsewhere` branch,
    // so a `covered` entry that named its thing exactly had that name dropped
    // one hop after it was written — the recorded shape of `readAddAnswer`'s
    // own defect, in the field added to stop guessing.
    //
    // NOT VALIDATED AGAINST ANYTHING, because there is nothing to validate it
    // against yet — the thing it names is what this change may be about to
    // make. It is compared by equality once the results are in, and an empty
    // or unreadable one simply leaves the reconcile on the kind.
    const item = str(r.item, 80);
    if (item) e.item = item;
    if (status === "covered") {
      const by = str(r.by, MAX_BY);
      if (by) e.by = by;
      // …AND THE KIND THAT MAKES THE REFERENCE AN IDENTITY (owner, 2026-09-15:
      // *"Use the same explicit kind + item identity … Preserve that reference
      // through cleaning"*). Kept ONLY for `covered`: an `elsewhere` entry's
      // kind IS its `step`, and a second field carrying the same fact is a
      // two-field invariant that can disagree with itself.
      //
      // A KIND WE DO NOT KNOW IS DROPPED AND THE REFERENCE GOES AMBIGUOUS,
      // never repaired to a plausible one: `unknown` is a sentence the customer
      // can act on and a wrong kind is a lookup in the wrong list.
      const kind = str(r.kind, 20).toLowerCase();
      if (ITEM_KINDS.includes(kind)) e.kind = kind;
    } else if (status === "elsewhere") {
      const step = str(r.step, 20).toLowerCase();
      // A STEP NOBODY RUNS IS NOT A HAND-OFF. Refused to `unsupported` rather
      // than dropped, because the requirement is still real — what is wrong is
      // only the claim about who owns it, and the customer should hear it.
      if (COVERAGE_STEPS.includes(step)) e.step = step;
      else { e.status = "unsupported"; e.why = "named a step this change does not run"; delete e.item; }
    } else delete e.item;
    // A REFERENCE BELONGS TO A STATUS THAT CAN USE ONE. `kind` is only ever
    // written on the `covered` branch above, so this is the same rule `item`
    // gets when a step refuses: an `unsupported` entry refers to nothing this
    // change will run, and a reference left on it invites a later reconcile.
    //
    // **THIS LINE IS A DELIBERATE BELT AND IS INERT TODAY, MEASURED** (720
    // probes — every status including junk and wrong-case, every kind including
    // junk, empty and `undefined`, every step including junk and `undefined` —
    // byte-identical with it and without it). `e` is built fresh above and
    // `e.kind` is assigned inside `if (status === "covered")` and nowhere else,
    // and the one status rewrite in this function is on the `elsewhere` branch,
    // which a `covered` entry never takes. So the structure is what really
    // enforces the rule and this restates it.
    //
    // IT IS KEPT AND SAID OUT LOUD because a sweep cannot say it and the next
    // session deletes what nothing appears to need: the PAIR is "the assignment
    // sits inside the covered branch" and "a non-covered entry cannot keep a
    // kind", and hoisting the assignment out is a one-line refactor that reads
    // as tidying. `scripts/mutants/kind-identity.json` mutates the two
    // together, which is the only way a redundancy can be sweep-tested at all.
    if (e.status !== "covered") delete e.kind;
    // ── WHICH HAND-OFF THIS ENTRY ANSWERS, KEPT FOR `covered` ONLY ─────────
    //
    // An `elsewhere` entry is a request TO another step; it cannot also be the
    // answer to one. And an `unsupported` entry answers nothing by definition —
    // it is the step saying it could not. Keeping the id on either would let a
    // refusal reconcile a hand-off, which is the one reading that would turn
    // "nobody did this" into "it is configured".
    const ans = str(r.answers, 80);
    if (e.status === "covered" && ans) e.answers = ans;
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

/**
 * THE SAME GROUPING, AS ENTRIES RATHER THAN SENTENCES.
 *
 * `requirementsByStep` answers NEEDS because that is what the developer record
 * wants under `handedTo`. The brief wants the ENTRY, because it has to print
 * each one's id — and changing the older reader's shape would quietly rewrite
 * a field two other things read. Two functions over one filter, which is the
 * cheaper of the two mistakes available here.
 */
export function handoffsByStep(list) {
  const out = {};
  for (const r of unresolvedRequirements(list)) {
    if (r.status !== "elsewhere" || !r.step) continue;
    (out[r.step] = out[r.step] || []).push(r);
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
  const mine = (handoffsByStep(list)[step] || []).slice(0, MAX_REQUIREMENTS);
  if (!mine.length) return "";
  const where = step === "page" || step === "component" ? "this page has to make possible"
    : "the part you are designing has to make possible";
  // ── EACH ONE WITH ITS ID, AND THE INSTRUCTION TO ECHO IT ────────────────
  //
  // The id is what lets the entry you write be tied back to the request you
  // were given, so the customer hears one outcome instead of two descriptions
  // of one need. It is printed rather than derived because the receiving
  // designer has no other way to know it, and matching on the WORDS is what
  // this replaces — two steps describing one need differently is the ordinary
  // case, and two different needs reading alike is the failure it invites.
  //
  // A brief with no ids (an older caller, or a list cleaned without an owner)
  // simply prints the needs, and nothing downstream reconciles. Additive, and
  // it fails closed to exactly today's behaviour.
  return "## What this addition still has to do\n" +
    "Another step in this same change handed these to you. Each is something the customer asked for that " +
    where + ". Cover what you can and change nothing else.\n" +
    "Where you cover one of these, put its id in `answers` on that entry, copied exactly.\n" +
    mine.map((r) => "- " + (r && r.id ? "[" + r.id + "] " + r.need : (r && r.need) || r)).join("\n");
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
 * itself a verdict off an incidental word. It answers `contradicted` — its own
 * kind, never `null` — because the item was named and really applied, so the
 * IMPLEMENTATION is established and only the guarantee is denied.
 *
 * WHY THIS CANNOT CRY WOLF, STATED. Every reading here moves a requirement
 * TOWARDS `unverified` and never towards `failed`: there is no corpus of real
 * `by` claims to measure a false-alarm rate against — this shipped yesterday
 * and has never run live — so the one direction that is safe without one is the
 * direction that costs a sentence inviting the customer to check. A false
 * "I can't confirm" costs a look; a false "done" costs them the guarantee.
 */
/**
 * THE ITEMS A CLAIM MAY BE WEIGHED AGAINST — the same haystack the
 * IMPLEMENTATION reading used, and never a wider one.
 *
 * Owner, 2026-09-16: *"claimEvidence(r.by, made) still searches every applied
 * kind … Carry the explicit kind + name identity through the evidence lookup
 * too. Evidence from another item must not turn an unknown implementation into
 * configured, unverified, or delivered. Missing or ambiguous references must
 * not regain certainty through an unrestricted prose match."*
 *
 * THE BYPASS THIS CLOSES, reproduced before it was written. An applied TABLE
 * `bookings`, a `covered` requirement whose reference is `{kind: "component",
 * item: "bookings"}`, and `by: "bookings shows the total"`. The reference reads
 * `implementation: "unknown"` — `component` is opaque, nothing can enumerate one
 * — and the claim was then matched against EVERY applied item, found the table,
 * and answered `named` → `unverified` → *"I've set that up."* The same shape
 * rescues a `function` reference whenever function inventory is unavailable:
 * the exact question has no answer and a prose match about a different thing
 * supplies one anyway.
 *
 * SO THE HAYSTACK IS THE IDENTITY, AND THERE ARE EXACTLY THREE ANSWERS, keyed
 * off what `implementationOf` already resolved rather than re-deriving it:
 *
 *   `by: "item"`   the reference is `{kind, name}` — that item and nothing else.
 *                  A miss is an EMPTY haystack, which is right whichever way the
 *                  implementation read: absent (the thing is not there), or
 *                  unknown (nobody could look). Neither may be talked over by a
 *                  sentence that happens to name something else.
 *   `by: "kind"`   no reference at all. The claim is weighed against the output
 *                  of THE STEP RESPONSIBLE, which is the question the no-name
 *                  branch of `implementationOf` already asks in as many words —
 *                  one haystack, two readers. Restricted, not unrestricted.
 *   no kind        ambiguous (a name with no kind), or not reconciled at all.
 *                  Nothing to scope by, so nothing to weigh against.
 *
 * **AND THE `kind` TEST IS WHAT MAKES THE LAST CASE SAFE.** An ambiguous
 * reference carries `kind: ""`, and a filter for that would match every applied
 * item whose own kind is missing rather than none of them — the empty-needle
 * shape, in the branch whose whole job is to answer nothing.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: narrow an item reference by `from`. That
 * is which CALL answered, never a claim about where the thing lives — the
 * distinction `referenceOf` is built on — and it is only the no-reference
 * haystack's scope because there the question really is about a step's output.
 */
export function evidenceItems(made, impl) {
  if (!impl || !impl.kind) return [];
  const all = (Array.isArray(made) ? made : []).filter((m) => m && typeof m === "object");
  const ofKind = all.filter((m) => String(m.kind || "") === impl.kind);
  if (impl.by === "kind") return ofKind;
  if (impl.by === "item") return ofKind.filter((m) => String(m.name || "").trim().toLowerCase() === impl.name);
  return [];
}

export function claimEvidence(claim, made) {
  const text = typeof claim === "string" ? claim.toLowerCase() : "";
  if (!text) return null;
  const low = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  // ── THE EXISTENCE HALF WAS BEING THROWN AWAY (owner, 2026-09-15) ─────────
  //
  // A claim naming an applied item and none of its guarantees used to answer
  // `null`, which read as no evidence at all — so *"bookings.slot with a unique
  // slot so two cannot be taken"* about a table this change really applied fell
  // through to the `covered` label, and the label is exactly what may not stand
  // in for evidence. The name match is weaker than a guarantee and it is not
  // nothing: it locates the implementation. It is kept as its own kind and
  // answers `unverified`, never `configured` and never `delivered`.
  //
  // KEPT RATHER THAN RETURNED, because a later item may carry a real
  // guarantee — returning the first bare name would hide the stronger answer
  // behind the weaker one, which is this file's own asked-in-order rule broken.
  let named = null;
  for (const m of Array.isArray(made) ? made : []) {
    const name = low(m && m.name);
    if (name.length < 3 || !wordIn(text, name)) continue;
    // ASKED FIRST: a claim that disagrees with what was applied is not evidence
    // for anything, whatever else it happens to say — INCLUDING the bare name,
    // so a contradicted claim cannot buy `configured` or `delivered` off the
    // existence half.
    //
    // **IT IS ITS OWN KIND AND NOT A `null` (2026-09-15).** Answering nothing
    // made a contradiction indistinguishable from a claim with nothing to check
    // against, and once `covered` started reading its implementation the two
    // fell to opposite states: `unknown`, whose sentence says *"nothing I can
    // check says either way"*, is FALSE here — something can be checked and it
    // says the opposite. The item was named and really applied, so the
    // implementation is established; what is not is the guarantee. That is
    // `unverified`, and the fact that denied it rides out for the record.
    for (const raw of Array.isArray(m.fails) ? m.fails : []) {
      const t = low(raw);
      if (t.length >= 3 && wordIn(text, t)) return { name: m.name, token: raw, kind: "contradicted" };
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
    if (!named) named = { name: m.name, token: "", kind: "named" };
  }
  return named;
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
/**
 * THE ONE IDENTITY A REQUIREMENT'S REFERENCE HAS: `{kind, name}` or `null`.
 *
 * Owner, 2026-09-15: *"Use the same explicit kind + item identity for applied,
 * existing, and failed items … Ambiguous references should remain unknown."*
 * Three lookups asked the same question three ways before this — `made`,
 * `existing.items` and `failedItems` — and the `covered` half of each ignored
 * the kind, so a name was enough to match anything.
 *
 * WHERE THE KIND COMES FROM IS THE ONLY PER-STATUS PART:
 *
 *   `elsewhere` — the STEP is the kind. A request to the function step is a
 *                 request for a function; there is nothing to declare and a
 *                 second field saying it could only ever disagree.
 *   `covered`   — the DECLARED `kind`, and nothing else. `from` is which call
 *                 answered, and the tool invites a table step to name the
 *                 function that does the work, so the step cannot stand in.
 *
 * `null` MEANS UNIDENTIFIABLE, NOT ABSENT — no name, or a `covered` name with
 * no kind beside it. Every caller reads it as `unknown`: a reference we cannot
 * resolve is one we may not answer either way.
 */
export function referenceOf(r) {
  if (!r || typeof r !== "object") return null;
  const name = typeof r.item === "string" ? r.item.trim().toLowerCase() : "";
  if (!name) return null;
  const kind = r.status === "elsewhere" ? String(r.step || "") : String(r.kind || "");
  return kind ? { kind, name } : null;
}

export function implementationOf(r, made = [], reportable = [], existing = null) {
  const status = r && typeof r === "object" ? r.status : "";
  // ── BOTH STATUSES ARE RECONCILED, AGAINST THE SAME RESULTS (owner, 2026-09-15)
  //
  // *"Do not let the model's covered label substitute for implementation
  // evidence … reconcile both covered and elsewhere against the same item-level
  // results and existing-site evidence."* A `covered` entry used to skip this
  // reader entirely and rest on its own label, so "I've set that up" was said
  // about work nothing had looked for.
  if (status !== "elsewhere" && status !== "covered") return { state: "unknown", by: "", name: "", kind: "" };
  // ── WHOSE RESULTS ANSWER IT, AND THAT IS NOT ONE QUESTION ────────────────
  //
  // `elsewhere` NAMES A STEP. The requirement is a request TO that step, so
  // "did it make this" is asked of that step's applied items and of nobody
  // else's — a function turning up under some other kind is not the function
  // the page step asked the function step for.
  //
  // `covered` names no step. `from` is OUR OWN bookkeeping of which call
  // answered, never the model's claim about where the thing lives — so it
  // answers "did the step responsible produce anything", which is the question
  // the no-name branch at the foot of this function asks, and NOT "what kind of
  // thing is this reference". That second question is `referenceOf`'s.
  const kind = status === "elsewhere" ? String(r.step || "") : String(r.from || "");
  if (!kind) return { state: "unknown", by: "", name: "", kind: "" };
  const low = (v) => String((v && v.name) || "").trim().toLowerCase();
  const ofKind = (list, k) => (Array.isArray(list) ? list : []).filter((m) => m && String(m.kind || "") === k);
  // ── TWO SOURCES OF PRESENCE, AND THEY ARE NOT THE SAME CLAIM ────────────
  //
  // `made` is what THIS CHANGE applied; `existing` is what the site ALREADY
  // had, and a caller supplies it only for kinds it can really enumerate.
  // Both answer "the thing is there"; neither alone answers "it is not".
  const ex = existing && typeof existing === "object" ? existing : null;
  // VISIBILITY IS ASKED OF WHICHEVER KIND IS BEING LOOKED IN, because "could we
  // have seen one of these" is a question about the haystack and not about the
  // step that asked. The item branch below asks it of the REFERENCE's kind; the
  // no-name branch asks it of the step's.
  const seeable = (k) => {
    const canApplied = (Array.isArray(reportable) ? reportable : []).includes(k);
    const canExisting = !!ex && (Array.isArray(ex.kinds) ? ex.kinds : []).includes(k);
    return canApplied && !OPAQUE_KINDS.includes(k) && (!SITE_KINDS.includes(k) || canExisting);
  };
  const mine = ofKind(made, kind);
  const theirs = ex ? ofKind(ex.items, kind) : [];
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
  const ref = referenceOf(r);
  if (typeof r.item === "string" && r.item.trim()) {
    // ── ONE IDENTITY, AND IT IS `{kind, name}` (owner, 2026-09-15) ─────────
    //
    // *"Use the same explicit kind + item identity for applied, existing, and
    // failed items."* The search used to be BY NAME ACROSS EVERY KIND for a
    // `covered` claim, and two collisions fell straight out of it, both
    // reproduced before this was written: an applied TABLE `bookings` answered
    // a claim about the FUNCTION `bookings` with `found` and *"I've set that
    // up"*, and a FAILED function `bookings` blocked a claim about the TABLE.
    // `bookings` is the ordinary name for both, not a contrived one.
    //
    // AN UNIDENTIFIABLE REFERENCE STAYS `unknown` — never widened back into a
    // name search, which is the collision, and never narrowed onto `from`,
    // which is the step that ANSWERED and not the kind of the thing.
    if (!ref) return { state: "unknown", by: "ambiguous", name: String(r.item).trim().toLowerCase(), kind: "" };
    const hit = ofKind(made, ref.kind).find((m) => low(m) === ref.name);
    if (hit) return { state: "found", by: "item", where: "applied", name: String(hit.name), kind: ref.kind };
    // NOT ADDED BY THIS CHANGE IS NOT ABSENT FROM THE SITE. A change that
    // deliberately reuses a function it did not need to create leaves nothing
    // in `made`, and reading that as "still to do" is run 48's defect wearing
    // a different hat. Same identity, second source.
    const had = ex ? ofKind(ex.items, ref.kind).find((m) => low(m) === ref.name) : null;
    if (had) return { state: "found", by: "item", where: "existing", name: String(had.name), kind: ref.kind };
    return { state: seeable(ref.kind) ? "absent" : "unknown", by: "item", name: ref.name, kind: ref.kind };
  }
  // No name to match: only the EMPTY direction is sound. See the head — and it
  // is emptiness of BOTH, because a site that already has things of this kind
  // cannot say whether one of them is the thing this requirement asked for.
  //
  // AND THIS BRANCH STAYS KIND-SCOPED FOR BOTH STATUSES, deliberately: with no
  // name the question is no longer "does the thing exist" but "did the step
  // responsible produce anything at all", and that is a question about one
  // step's output whichever status asked it.
  //
  // ── ⚠ AND A COUNT OF THAT OUTPUT IS NOT AN ASSOCIATION (2026-09-19) ───────
  //
  // Owner: *"Remove output-count matching as proof of requirement
  // implementation. A gallery handoff currently becomes 'set up' when the step
  // produces only a Wi-Fi code. Associate the requirement with its actual item
  // explicitly; preserve uncertainty where that association is missing."*
  //
  // REPRODUCED before it was touched, on run 51's own shape: the `page` step
  // hands *"A QR code opens the gallery page."* to the `qr` step, the `qr` step
  // designs ONE code — `{name: "wifi", points: "WIFI:S=Bakery;…"}` — and the
  // reader answered `made` → `unverified` → *"I've set that up"*. A code that
  // opens no page at all, offered as evidence that a page has a code. The
  // gallery case and the Wi-Fi case came back BYTE-IDENTICAL, which is the
  // whole of it: a count cannot tell them apart because a count is not about
  // the things.
  //
  // THE COUNT WAS UNSOUND AT EVERY N, not merely at the margin. Its argument
  // was *"a step that made as many things as there are asks resting on it made
  // something for each of them"* — which is arithmetic about CARDINALITY and
  // says nothing whatever about CORRESPONDENCE. One ask and one thing made is
  // the case it was written for and is exactly the case above.
  //
  // WHAT AN ASSOCIATION IS, AND IT ALREADY EXISTS: `{kind, name}` — the
  // requirement's own `item`, resolved against the applied items by identity in
  // the branch above. That is explicit, it is the designer's own claim rather
  // than our inference, and it is driven. Where it is missing the answer is
  // `unknown`, which says *nothing here can establish whether the
  // implementation is there* — true, and the uncertainty the owner asked to
  // preserve.
  //
  // ⚠ AND THE GAP THAT USED TO BE NAMED HERE IS CLOSED — corrected 2026-09-19,
  // because it was stale in the direction that matters. It read *"`qr`, `three`
  // and `photo` are the three kinds off `REQUIREMENT_ADDS`, so their tools
  // carry no `requirements` property and a step that makes a code CANNOT echo
  // the id it was handed"*. MEASURED on this tree: `REQUIREMENT_ADDS` is all
  // NINE add kinds, so every step that designs anything can raise a need and
  // echo the id of a hand-off it answers. `three` and `photo` joined on
  // 2026-09-19 (night queue 4) and `qr` in the round that wrote this very
  // paragraph — the note simply outlived its own fix by one commit.
  //
  // WHAT STANDS is the rule it was explaining, which is about associations and
  // not about which tools exist: with no `item` there is nothing to resolve,
  // and a count of a step's output is not an association whatever the tools
  // offer.
  if (mine.length || theirs.length) return { state: "unknown", by: "kind", name: "", kind };
  return { state: seeable(kind) ? "absent" : "unknown", by: "kind", name: "", kind };
}

/**
 * WHY A NAMED DEPENDENCY BEING BROKEN STOPS THIS REQUIREMENT, in the customer's
 * own terms (2026-09-19).
 *
 * The blocked clause used to be one sentence for every kind — *"the X it needs
 * could not be created"* — which is exact wherever the name IS the thing that
 * gets created: a function, a job, a table, an api, a page, a QR code, a scene.
 *
 * A PHOTOGRAPH IS THE EXCEPTION AND IT IS NOT A NEAR MISS. Its identity is the
 * ROUTE it was asked for, because the url is minted by the provider after the
 * designer has spoken and the page is the only thing either haystack can name
 * — so the general sentence reads *"the /gallery it needs could not be
 * created"* about a page that published perfectly well and is merely missing
 * its picture. That sends the customer to look at the wrong thing.
 *
 * A KIND WITH NO ENTRY GETS THE GENERAL SENTENCE, which is the right default:
 * it is true of every kind whose name is the artifact, and a kind added later
 * reads oddly at worst rather than pointing somewhere false.
 *
 * AND THE PHOTOGRAPH'S SENTENCE SAYS *"the one it asked for isn't there"*,
 * which is the distinction its wall exists to draw. A photo route only reaches
 * this branch when the page really does carry a picture — a route with none is
 * `absent` to the implementation reader and earns the better *"Still to do"*
 * clause — so *"could not be created"* would read as a flat contradiction of
 * what the customer can see on the page.
 *
 * IT NAMES NO CAUSE, deliberately. A requested picture can be missing three
 * ways here (the provider refused it, the balance could not afford it, or the
 * writer put its token on another page that already has one), and the addon
 * route can tell all three apart. It does not carry which, because
 * `failedItems` is `{kind, name}` and giving one kind a reason field is a
 * mechanism every other kind would then want. The REPLY's own `pictureNote`
 * names the cause where there is one to name.
 */
export function brokeWhy(ref) {
  const name = String((ref && ref.name) || "").trim();
  if (!name) return "";
  if (ref && ref.kind === "photo") return "the photograph it asked for on " + name + " isn't there";
  return "the " + name + " it needs could not be created";
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
  const items = (Array.isArray(failedItems) ? failedItems : []).filter((f) => f && typeof f === "object");
  // ONE INDEX, KEYED THE WAY `referenceOf` ANSWERS (owner, 2026-09-15). It was
  // this index PLUS a bare-name one for `covered`, and the bare-name half was
  // the second reported collision: a failed FUNCTION `bookings` blocked a claim
  // about the applied TABLE `bookings`, because the names matched and nothing
  // compared the kinds. A requirement whose reference cannot be identified has
  // no dependency to be blocked on and reads `unknown` instead.
  const broken = new Set(items.map((f) => String(f.kind || "") + "::" + String(f.name || "").trim().toLowerCase()));
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
    const reconciled = r.status === "elsewhere" || r.status === "covered";
    const impl = reconciled ? implementationOf(r, made, reportable, existing) : null;
    // THE NAMED DEPENDENCY, AND WHETHER IT IS THE ONE THAT BROKE. Asked in
    // this order deliberately: a thing KNOWN to have failed is blocked before
    // anything else is asked about it, and only then does a thing known to be
    // there excuse its step's other failures. The two are disjoint today (the
    // route puts only CREATED items in `made`), and the fail-closed order is
    // what keeps that an observation rather than a dependency.
    //
    // THE REFERENCE IS THE SAME OBJECT THE IMPLEMENTATION READER USED, which is
    // the whole of the owner's "the same explicit kind + item identity for
    // applied, existing, and failed items": one `{kind, name}`, three lookups.
    const ref = reconciled ? referenceOf(r) : null;
    const dep = ref ? ref.name : "";
    const depBroke = !!ref && broken.has(ref.kind + "::" + ref.name);
    const depThere = !!impl && impl.state === "found";
    // A REFERENCE NOBODY CAN RESOLVE IS ITS OWN FINDING, and it is actionable
    // in a way "nobody looked" is not: the designer named a thing and left off
    // what KIND it is, so the tool could have been answered and was not.
    const unresolved = !!impl && impl.by === "ambiguous";
    // THE CLAIM, READ ONLY FOR `covered` — `elsewhere` carries no `by`, the
    // cleaner never keeps one for it, and a requirement that asks another step
    // for something has made no claim of its own to weigh.
    //
    // …AND READ AGAINST THE SAME IDENTITY THE IMPLEMENTATION WAS (owner,
    // 2026-09-16). `made` used to go in whole, so a prose match against ANY
    // applied item could turn an implementation nobody could find into
    // `unverified`, `configured` or `delivered`. `evidenceItems` is the one
    // scope, derived from `impl` rather than re-resolved, so the two readers
    // cannot come apart.
    // ── …AND AN UNRESOLVED ANSWER MAY NOT REGAIN CERTAINTY THROUGH PROSE ─────
    //
    // (owner, 2026-09-19, reproduced before anything was touched.) Run 51's
    // exact shape: the page step hands *"A QR code opens the gallery page."* to
    // the qr step with no item; the qr step echoes `answers: "page#0"`, names no
    // item either, and describes its work in prose — `by: "the gallery code
    // points at /gallery"`. Its own implementation is `unknown` (no reference,
    // and a count of a step's output is not an association), so
    // `reconcileHandoffs` correctly refuses it — and then `claimEvidence`
    // matched the word `gallery` inside that sentence against the qr step's own
    // applied code and promoted it to `configured`. **One need, two opposite
    // sentences in one reply**: *"I've set that up, but I can't confirm…"* from
    // the answer and *"I can't see from here whether…"* from the hand-off it
    // claims to answer.
    //
    // AN ECHO IS A CLAIM ABOUT WHICH REQUEST IS BEING ANSWERED, NEVER EVIDENCE
    // THAT IT WAS. An entry that names the hand-off it answers has said where
    // its work belongs; if nothing can resolve WHAT that work is, the honest
    // ceiling is the same `unknown` the implementation reader already gave it,
    // and a prose match must not lift it above the request it is answering.
    //
    // NARROW BY CONSTRUCTION, and deliberately so: it asks for `answers`, so a
    // bare `covered` claim is untouched and the prose match keeps the five real
    // findings the stricter reading was measured to lose (2026-09-16). And
    // `absent` never reaches here anyway — it is settled as `missing` above —
    // so `!== "found"` is `unknown` today and is written as the property rather
    // than as that neighbour's leftovers.
    const echoed = r.status === "covered" && typeof r.answers === "string" && !!r.answers;
    const speaks = !echoed || (!!impl && impl.state === "found");
    const ev = r.status === "covered" && speaks ? claimEvidence(r.by, evidenceItems(made, impl)) : null;
    let state = "unverified", why = r.why || "", configuredBy = "", contradictedBy = "";
    if (r.status === "unsupported") {
      // The step said so itself, in its own words.
      state = "failed";
    } else if (reconciled && depBroke) {
      // THIS requirement's own dependency failed — the strongest and most
      // specific thing that can be said, and it names the item. **Both
      // statuses**, because a `covered` claim resting on a function the
      // database refused is waiting on the same broken part as a hand-off is.
      state = "blocked";
      // ⚠ AND THE SENTENCE IS THE KIND'S, because one wording cannot serve
      // every kind and a wrong one points the customer at the wrong thing.
      // *"the send_reminder it needs could not be created"* is exact for a
      // function, a job, a table or a page — each of those IS created — and is
      // FALSE of a photograph, where the name is the ROUTE the picture was
      // asked for: *"the /gallery it needs could not be created"* says a page
      // failed, about a page that published perfectly well and is simply
      // missing its picture.
      why = why || brokeWhy(ref);
    } else if (reconciled && owner && bad.has(owner) && !depThere) {
      // THE STEP FAILED AND NOTHING SAYS THIS REQUIREMENT ESCAPED IT.
      //
      // **`!depThere` IS THE WHOLE SCOPE, AND IT NOW GUARDS BOTH STATUSES**
      // (owner, 2026-09-15: *"covered + from:function + an unrelated function
      // failure still becomes failed, even when the referenced function
      // applied … Block only on the requirement's actual failed
      // dependencies."*). The step had A failure; if the thing THIS
      // requirement names is nonetheless there, that failure was somebody
      // else's and this requirement is judged on its own evidence below.
      //
      // A requirement that names nothing still stops here, because a step that
      // failed is then the only evidence available about it — and the two
      // statuses part company only on WHICH SENTENCE that earns: a hand-off is
      // waiting on another part, a claim the failed step made goes down with
      // the step that made it.
      state = r.status === "covered" ? "failed" : "blocked";
      why = why || "the " + owner + " step could not do its part";
    } else if (unresolved) {
      // ── AN AMBIGUOUS REFERENCE OUTRANKS EVERY WEAKER READING ─────────────
      //
      // Owner, 2026-09-15: *"Ambiguous references should remain unknown."* The
      // designer NAMED the thing this rests on and left off what kind it is, so
      // the one exact question has no answer — and the readings below it are
      // all kind-blind prose matches over `by`, which is the same collision one
      // layer over: an applied TABLE `bookings` satisfies a sentence about the
      // FUNCTION `bookings` just as easily as the old item search did.
      //
      // So nothing weaker may rescue it. Falling through to `claimEvidence`
      // would answer the question the designer did not ask with evidence about
      // a thing they may not have meant, and say *"I've set that up"* off it.
      //
      // **A DECLARED REDUNDANCY SINCE 2026-09-16, AND MEASURED INERT rather
      // than assumed.** `evidenceItems` now scopes an ambiguous reference to
      // nothing (it carries no kind), so `ev` is already `null` here and the
      // fall-through lands on `unknown` anyway: **27,216 probes over every
      // status, kind, item, `from`, claim, failed kind and failed item —
      // byte-identical with this branch and with it cut.** It is KEPT because
      // the two say different things and only one of them is about scope: this
      // branch is the ORDER (ambiguity outranks every weaker reading, and in
      // particular is asked AFTER the two failure branches), and the haystack
      // is the SCOPE. Widen the scope by one line — an ambiguous reference
      // falling back to the step's kind is the plausible version — and this
      // becomes the only wall again. The sweep mutates the PAIR, because a
      // sweep cannot say this and the next session deletes what nothing
      // appears to need.
      state = "unknown";
    } else if (impl && impl.state === "absent") {
      // THE NAMED THING IS NOT THERE, and the explicit reference outranks the
      // claim: a designer that named the item answered the narrower question,
      // and an incidental name inside `by` must not talk over it.
      state = "missing";
      why = why || (r.status === "covered"
        ? "the " + (dep || "thing") + " it says covers this was not added"
        : handoff === "undelivered"
          ? "the " + (owner || "next") + " step never got it, and nothing of that kind was added"
          : "the " + (owner || "next") + " step was told and added nothing for it");
    } else if (ev && ev.kind === "checked") {
      // ── CONFIGURATION SETTLES NOTHING (owner, 2026-09-14) ────────────────
      //
      // A configuration fact is its own STATE rather than a note beside
      // `unverified`: *"'The function is public' does not prove it checks
      // ownership."* Only a `checked` token — a behaviour something really
      // exercised — answers `delivered`, and nothing fills that list today, so
      // `configured` is as far as a claim about a real setting can get.
      state = "delivered";
    } else if (ev && ev.kind === "config") {
      state = "configured";
      configuredBy = String(ev.name) + ": " + String(ev.token);
    } else if ((impl && impl.state === "found") || (ev && (ev.kind === "named" || ev.kind === "contradicted"))) {
      // THE IMPLEMENTATION IS ESTABLISHED and its behaviour is not — an item
      // proves existence and never conduct, whether this change applied it, the
      // site already had it, or the claim named it (`named`: an applied item's
      // real name, word-bounded, with nothing it says contradicted).
      //
      // ⚠ `found` IS THE ONLY POSITIVE STATE, and a `made` alongside it is what
      // 2026-09-19 removed: a count of one step's output is not an association
      // between a requirement and a thing, so it never belonged in the branch
      // whose sentence opens *"I've set that up"*. See `implementationOf`.
      //
      // `contradicted` IS HERE AND NOT IN `unknown`, and the reason is which
      // sentence would be a lie: the claim named an item this change really
      // applied, so the thing exists — what is wrong is the guarantee it claims
      // about it, which nothing here may promote to a refusal (the never-move-
      // towards-`failed` rule above). The fact that denied it is recorded.
      state = "unverified";
      if (ev && ev.kind === "contradicted") contradictedBy = String(ev.name) + ": " + String(ev.token);
    } else {
      // NOTHING HERE CAN SEE WHETHER IT IS THERE, and that is its own answer
      // rather than a quiet "unverified" (owner, 2026-09-15): the customer's
      // sentence for `unverified` opens *"I've set that up"*, which is a claim
      // nobody is entitled to make about an implementation nobody could find —
      // **and that is now as true of a `covered` label as of a hand-off.**
      state = "unknown";
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
      // THE ONE READING THAT SAYS SOMETHING POSITIVE, and it would otherwise
      // vanish: `unverified` reached three ways means three different things to
      // a developer, and "the applied item says the opposite of this claim" is
      // the one worth acting on. The CUSTOMER hears the same sentence either
      // way, deliberately — nothing here is entitled to call a claim wrong.
      ...(contradictedBy ? { contradictedBy } : {}),
      // DEVELOPER-FACING, and it separates two `unknown`s that need different
      // work: "nobody could look" is ours to fix, "the reference names no kind"
      // is one word the designer could have written. The customer hears the
      // same can't-see sentence either way — a reference is our bookkeeping.
      ...(unresolved ? { unresolved: "no-kind" } : {}),
      ...(why ? { why } : {}),
    });
  }
  return reconcileHandoffs(out);
}

/**
 * ── ONE NEED, ONE OUTCOME (owner, 2026-09-16, after run 50) ─────────────────
 *
 * Run 50 wrote the same need TWICE, because both designers spoke to it: the
 * function step handed *"that count runs every night at 11"* to the job step
 * with no item, and the job step covered it naming `nightly_booking_count`.
 * Judged apart, the first read `unknown` and the second `configured` — and the
 * customer heard the first: *"I can't see from here whether that count runs
 * every night at 11"*, about a job registered at 23:00 Europe/London that the
 * same run then fired successfully. One reply calling one thing configured AND
 * unseeable.
 *
 * THE JOIN IS AN ID AND NEVER PROSE. The receiving designer echoes the id it
 * was given back in `answers`; two steps describing one need in their own
 * words is the ordinary case, so matching descriptions is how a reconciliation
 * silently joins two DIFFERENT needs that happen to read alike — which is the
 * control the guard drives.
 *
 * FOUR CONDITIONS, AND EACH IS ONE OF THE OWNER'S:
 *   · the answering entry must NAME this hand-off (`answers === id`) — never
 *     "this step ran", which would clear every requirement the step owns;
 *   · it must be `covered` — a step SAYING it could not (`unsupported`) must
 *     not settle what it was asked for;
 *   · its own implementation must have been FOUND — otherwise an unknown
 *     launders into a configured through a claim nobody could check;
 *   · and the result is CAPPED at `configured`. Configuration must never imply
 *     delivered behaviour, so even an answering entry that reached `delivered`
 *     hands this one `configured` — the hand-off is evidence about what was
 *     SET UP, and behaviour is the answering entry's own claim to make.
 *
 * THE ORIGINAL ENTRIES ARE UNTOUCHED apart from the added fields: both keep
 * their own state for diagnosis, and it is the CUSTOMER note that collapses
 * them. A reconciliation that rewrote the record would destroy the evidence
 * that the hand-off was ever ambiguous.
 *
 * ADDITIVE AND FAIL-CLOSED. No id, no echo, an echo naming nothing, or an
 * older caller whose entries carry no ids at all: nothing reconciles and every
 * outcome is exactly what it is today.
 */
const RECONCILABLE = ["delivered", "configured", "unverified"];
export function reconcileHandoffs(outcomes) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  const answering = new Map();
  // ── EVERY REQUEST THAT REALLY EXISTS, so an echo naming nothing is not
  // silenced into thin air. An entry that answers an id nobody sent is the only
  // record of its own need, and dropping it would lose the need entirely.
  const requested = new Set();
  for (const r of list) {
    if (r && r.status === "elsewhere" && typeof r.id === "string" && r.id) requested.add(r.id);
  }
  // ── AN ANSWER THAT RESOLVED TO NOTHING IS SPOKEN FOR BY ITS REQUEST ───────
  //
  // (owner, 2026-09-19.) Gating the prose match above stops the contradiction —
  // both entries read `unknown` — and leaves the need said TWICE in the
  // customer's own words: *"I can't see from here whether A QR code opens the
  // gallery page.; or whether A QR code opens the gallery page."* One need, one
  // outcome is the whole point of this function, and an answer that resolved to
  // nothing has nothing to add to the request it is answering.
  //
  // SILENT IN THE PROSE, KEPT WHOLE IN THE RECORD, which is the same division
  // the two silences below make: `spokenForBy` says which request speaks for it,
  // so a reader can still see that the step answered and that its answer could
  // not be resolved. It is its OWN field and not `overruledBy` — those are two
  // different facts a developer acts on differently (*"a finding contradicted
  // your answer"* against *"your answer named nothing anyone could find"*), and
  // one field holding both is two values meaning different things.
  //
  // ⚠ `unknown` AND NOT MERELY `!== "found"`, and the wrong-item control is what
  // said so. An answer that names an item this layer LOOKED FOR AND DID NOT FIND
  // reads `absent` → `missing` → *"Still to do"*, which is a real finding and the
  // most actionable thing in the reply; silencing it would delete it. `absent` is
  // resolved — resolved to NOT THERE. Only `unknown` established nothing either
  // way, and only `unknown` has nothing to add to the request it answers.
  //
  // IT IS A DIFFERENT QUESTION FROM THE PROSE GATE ABOVE, deliberately. That one
  // asks *may this be lifted by a sentence* — no, unless the implementation was
  // FOUND. This one asks *does this add anything to its request* — no, only when
  // nothing was established. The two coincide today because `absent` never
  // reaches the prose branches, and writing each as its own property is what
  // keeps that an observation rather than a dependency.
  const spokenFor = new Set();
  for (const r of list) {
    if (!r || r.status !== "covered" || typeof r.answers !== "string" || !r.answers) continue;
    if (r.implementation !== "found") {
      if (r.implementation === "unknown" && requested.has(r.answers)) spokenFor.add(r);
      continue;
    }
    if (!RECONCILABLE.includes(r.state)) continue;
    // FIRST ANSWER WINS, and a second one for the same id is left alone rather
    // than overwriting: two entries claiming one hand-off is itself a finding,
    // and picking the later would make the outcome depend on list order.
    if (!answering.has(r.answers)) answering.set(r.answers, r);
  }
  if (!answering.size && !spokenFor.size) return list;
  // ── AN ANSWER THAT WAS REFUSED OVER A FINDING DOES NOT SPEAK EITHER ───────
  //
  // Refusing to reconcile is half the fix. The other half is that the answering
  // entry is still `configured`, still carries the same NEED in its own words,
  // and still reaches the prose — so the reproduction came back as *"waiting on
  // another part that didn't work: the nightly reminder goes out"* AND
  // *"Scheduled as you asked: the nightly reminder goes out"*, one need, two
  // opposite sentences. Incoherent in exactly the way this whole round is
  // about, and the worse of the two readings is the reassuring one.
  //
  // KEYED BY THE ECHOED ID, never by the need text. Matching the prose here
  // would be the thing the reconciliation itself is forbidden to do, arriving
  // one function later through the back door.
  //
  // ONLY OVER A PROBLEM STATE. A mismatch with no finding behind it (the step
  // is wrong, or the reference names something else) leaves both entries
  // speaking, which is exactly what they did before any of this existed.
  const overruled = new Map();
  for (const r of list) {
    if (!r || r.status !== "elsewhere" || typeof r.id !== "string") continue;
    if (!answering.has(r.id)) continue;
    if (r.state === "blocked" || r.state === "failed" || r.state === "missing") overruled.set(r.id, r.state);
  }
  return list.map((r) => {
    if (r && r.status === "covered" && typeof r.answers === "string" && overruled.has(r.answers)) {
      return { ...r, overruledBy: r.answers, overruledAs: overruled.get(r.answers) };
    }
    // ASKED AFTER THE OVERRULE, because a finding on the request is the stronger
    // thing to record about why this answer is silent. The two are disjoint
    // today — `overruled` is built only from requests that have a RESOLVED
    // answer, and one that resolved is never in `spokenFor` — and the order is
    // what keeps that an observation rather than a dependency.
    if (spokenFor.has(r)) return { ...r, spokenForBy: r.answers };
    if (!r || r.status !== "elsewhere" || typeof r.id !== "string" || !r.id) return r;
    const a = answering.get(r.id);
    if (!a) return r;
    // ── AN ECHOED ID CANNOT OVERRIDE CONTRADICTORY EVIDENCE ─────────────────
    //
    // (owner, 2026-09-16, reproduced.) A hand-off naming a job the database
    // REFUSED read `blocked`; an answering entry naming a DIFFERENT job that
    // applied, echoing the id, overwrote it — and the customer was told
    // "scheduled as you asked" about work that had failed. The id says which
    // request is being answered; it says nothing about whether the answer is
    // true, and these three walls are what keep those apart.
    //
    // 1. A KNOWN PROBLEM IS NEVER OVERWRITTEN. `blocked`, `failed` and
    //    `missing` each rest on evidence about the application — a dependency
    //    the database refused, a step that failed, a thing this layer looked
    //    for and did not find. Reconciliation may resolve an UNCERTAINTY; it
    //    may not resolve a finding.
    if (r.state === "blocked" || r.state === "failed" || r.state === "missing") return r;
    // 2. THE ANSWER MUST COME FROM THE STEP THE REQUEST WAS ADDRESSED TO. An
    //    `elsewhere` entry names its step; an echo from any other step is a
    //    different call answering a question it was never asked.
    if (a.from !== r.step) return r;
    // 3. AND IF THE REQUEST NAMED ITS OWN THING, THE ANSWER MUST BE THAT THING.
    //    `referenceOf` answers `null` when the hand-off named nothing, which is
    //    run 50's legitimate case and stays reconcilable — the customer named a
    //    behaviour and neither designer named an artifact for it. Where the
    //    hand-off DID name one, an answer about something else is not an answer.
    const want = referenceOf(r);
    if (want && !(a.kind === want.kind && String(a.implementedBy || "").trim().toLowerCase() === want.name)) return r;
    // CAPPED, never inherited whole — see the fourth condition above.
    const state = a.state === "delivered" ? "configured" : a.state;
    return {
      ...r, state,
      reconciledBy: a.id || a.answers,
      ...(a.implementedBy ? { reconciledItem: a.implementedBy } : {}),
      ...(a.kind ? { reconciledKind: a.kind } : {}),
    };
  });
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
  // ── A RECONCILED HAND-OFF IS SPOKEN FOR, AND MUST NOT BE SAID TWICE ──────
  //
  // After `reconcileHandoffs` both entries carry the same state, so listing
  // both would put one need in the sentence twice in the customer's own words
  // — which is the duplicate-reporting half of run 50's finding, surviving the
  // fix that was supposed to remove it. The RECORD keeps both; the prose says
  // it once, through the entry that names what really does the work.
  // …AND AN ANSWER OVERRULED BY A FINDING ON THE REQUEST IT ANSWERS is silent
  // too: the finding is the coherent outcome, and "scheduled as you asked"
  // beside "couldn't be created" about one sentence is the incoherence this is
  // for. Both entries stay in the RECORD with their own states.
  // …AND SO IS AN ANSWER THAT RESOLVED TO NOTHING while the request it answers
  // is right here saying the same need: `spokenForBy` names that request.
  const spoken = (r) => !(r && ((r.status === "elsewhere" && r.reconciledBy) || r.overruledBy || r.spokenForBy));
  const unsure = outcomes.filter(spoken).filter((r) => r.state === "unverified" || r.state === "configured");
  // …AND `unknown` IS NOT ONE OF THEM (owner, 2026-09-15): *"'I've set that up'
  // is inappropriate when implementation is unknown."* The clause below opens
  // with exactly that, so a need whose implementation nobody could find gets
  // its own sentence rather than a claim about work that may not exist.
  const unseen = outcomes.filter(spoken).filter((r) => r.state === "unknown");
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
  // ── A SCHEDULED THING HAS ITS OWN UNVERIFIED HALF, AND IT IS NAMEABLE ────
  //
  // (owner, 2026-09-16: the intended meaning is *"Scheduled nightly at 23:00
  // Europe/London. Automatic execution has not yet been verified."*) For every
  // other kind, "I can't confirm" is a general limit — nothing on this path
  // exercises behaviour. For a JOB it is one specific thing: the schedule is
  // written down and readable, and what nobody has watched is it firing on its
  // own. Saying that is more useful than the general sentence and is true of
  // every job this platform has ever registered.
  //
  // THE ZONE IS NOT QUOTED, because this function cannot see it: a job's
  // applied facts carry `everyMinutes` and `at` and no timezone. The reply's
  // own `jobs` list names the schedule; inventing it here is how a clause comes
  // to state a fact nothing checked.
  const jobKind = (r) => r.reconciledKind === "job" || (r.status === "covered" && r.kind === "job");
  const scheduled = unsure.filter(jobKind);
  const rest = unsure.filter((r) => !jobKind(r));
  if (rest.length) {
    parts.push("I've set that up, but I can't confirm from here that " + rest.slice(0, 2)
      .map((r) => r.need).join("; or that ") + " — have a look and tell me if it isn't right.");
  }
  if (scheduled.length) {
    parts.push("Scheduled as you asked: " + scheduled.slice(0, 2).map((r) => r.need).join("; ")
      + ". Automatic running hasn't been verified from here yet, so have a look after the first one is due.");
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
export function requirementRecord({ list = [], skipped = [], invalid = [], altered = [], ran = [], told = [], shown = [], failed = [], failedItems = [], made = [], reportable = [], existing = null, unbuilt = {}, unexpressed = [], missingPages = [], unknownKit = [], unseenPages = [] } = {}) {
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
    // ── THREE FINDINGS THAT REACHED THE REPLY AND NOT THE RECORD ──────────
    //
    // ⚠ THE FIRST TWO WERE PASSED IN AND DROPPED. The addon route has handed
    // `missingPages` and `unknownKit` to this function since each was written,
    // and neither was in the destructure — measured: `requirementRecord({…,
    // missingPages: ["/gallery"]}).missingPages` answered `undefined`. So the
    // reply named a page that did not survive and a kit component that is not
    // in the kit, and the STORED record — the thing anybody comes back to —
    // did not. This repository's own wiring trap, in the record built to
    // outlive the reply.
    //
    // The third is this round's: which of the site's pages the prompt window
    // could not carry, which is the one fact that explains a weak result on a
    // large site.
    missingPages: (Array.isArray(missingPages) ? missingPages : []).slice(0, MAX_REQUIREMENTS),
    unknownComponents: (Array.isArray(unknownKit) ? unknownKit : []).slice(0, MAX_REQUIREMENTS),
    unseenPages: (Array.isArray(unseenPages) ? unseenPages : []).slice(0, MAX_REQUIREMENTS),
  };
}
