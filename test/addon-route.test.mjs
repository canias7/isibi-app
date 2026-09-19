// FOUR DEFECTS, EACH REPRODUCED AND FIXED THROUGH THE REAL ROUTE (2026-09-14).
//
// Owner: *"Demonstrate these cases through the relevant route, including what
// the customer is told. Helper tests and source-text assertions alone missed
// these connections."*
//
// Every case here drives `POST /api/site/<slug>/addon` end to end and asserts
// on the reply the customer reads, because that is where all four defects lived
// and where none of them was visible from a module:
//
//   1. THE VALIDATION READ THE CLEANED ITEM. For three of the four tiers the
//      cleaner builds a fresh object out of the keys it knows, so a property
//      the tool never offered was gone one hop before the observer looked —
//      `clean.skipped: []`, `reached: []`, and the customer told nothing.
//   2. `delivered` MEANT A NAME MATCHED, against the PROPOSED design. A
//      function Postgres refused to create counted as evidence for the job
//      that names it.
//   3. AN EXTENSION REPLACED THE TABLE in the next designer's picture of the
//      site: three columns gone and `access` reading the default.
//   4. ONLY `elsewhere: page` WAS FORWARDED. Five of the six kinds that answer
//      requirements could hand one onward and reach nobody.
//
// WHAT THIS DELIBERATELY DOES NOT DO: reach a model, a container, a credit or
// the network. Every seam is stubbed in its real producer's shape — see
// `fixtures/addon-route.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { addon, promptFor, pagePrompt, storedAnswer, writtenPage, storedPage, addedTo, compiledPages, STORED_SCHEMA } from "./fixtures/addon-route.mjs";
// THE BOUND THE PARTS WALL RESTS ON, taken from the product rather than typed:
// a case that hardcoded "12001 characters is too big" would be a second copy of
// `MAX_PART_CHARS` and would pass silently the day the real one moved.
import { MAX_PART_CHARS, MAX_PRIOR_CHARS, validatePages } from "../builder/page-gen.mjs";
// `routeOf` IS THE PRODUCT'S OWN, so a case naming a page's route derives it
// the way every reader does rather than spelling it beside the file name.
import { routeOf, addonReply } from "../builder/site-addon.mjs";
// THE PLATFORM'S OWN PHOTOGRAPH CEILING and the add step's own cleaner, so a
// case about "more pictures than we will buy" derives the number from the spend
// path rather than restating it.
import { IMAGE_CAP } from "../builder/site-images.mjs";
import { THEME_IDS } from "../builder/site-theme-registry.mjs";
import { cleanAdd, appliedFacts } from "../builder/site-add.mjs";
// REAL GENERATED PAGES, so "a site too large to show whole" is real source
// rather than padding — the same corpus a dozen false-alarm checks measure
// against, and the one place these files are reached from.
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";
import { existingFacts } from "../builder/site-add.mjs";
import { SITE_KINDS, OPAQUE_KINDS } from "../builder/site-requirements.mjs";
// THE REAL EMITTERS AND THE PRODUCT'S OWN READERS, so a catalog fixture below
// is derived from what the engine really emits rather than typed by hand — a
// hand-typed permission is a second copy of the emitter and the two drift.
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { splitPrivileges, readParens } from "../site-schema-recover.mjs";
// THE CUSTOMER'S SCREEN, COMPOSED BY THE BROWSER ITSELF. `browserReply` loads
// `public/chat.js` and runs the real `addonAnswer` — selection and composition
// both — so a case about what somebody reads is not a second copy of the
// sentences written out here. The harness is its one other caller, which is why
// it lives there and is imported rather than re-created.
import { browserReply } from "../scripts/addon-sweep.mjs";
const browserText = (body) => {
  const b = browserReply(body, true);
  assert.ok(b.ok, "the browser's own composer could not run: " + b.why);
  return b.text;
};

/** An internal function and a job over it: the pageless pair, so the whole
 *  route runs without a container. */
const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE VALIDATION READS THE MODEL'S OWN DECLARATION
// ─────────────────────────────────────────────────────────────────────────────

test("a property the tool never offered is reported, though the cleaner removed it first", async () => {
  const answers = {
    function: { function: [{ ...FN, encryptAtRest: true, retries: 3 }] },
    job: { job: [JOB] },
  };
  const r = await addon("fw-declared", "remind people the day before", { kinds: ["function", "job"], answers });
  assert.equal(r.status, 200, "the route did not answer: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  // THE DEFECT: `cleanAdd` rebuilds a function out of the six keys it knows, so
  // both properties are gone from `clean.value` and `clean.skipped` is EMPTY —
  // there is nothing anywhere for the audit to see. Measured before the fix:
  // `reached: []` off the cleaned item, `["encryptAtRest","retries"]` off the
  // declared one, and this reply carried no `invalidProps` at all.
  assert.deepEqual(r.body.invalidProps, ["encryptAtRest", "retries"],
    "the properties the model asked for and did not get are not reported");
  // …AND THE CUSTOMER HEARS IT, as a count and never as a property name.
  assert.match(r.body.coverNote, /2 guarantees it doesn't offer/,
    "the customer is not told the guarantees are missing");
  assert.doesNotMatch(r.body.coverNote, /encryptAtRest|retries/, "a schema property name reached the customer");
});

test("a declaration inside the tool that survives whole is not reported", async () => {
  // THE CONTROL, and it is the half that keeps the check from crying wolf: the
  // same route, the same kinds, a function declaring only what the tool offers.
  const r = await addon("fw-clean", "remind people the day before", {
    kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } },
  });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.invalidProps, undefined, "a clean declaration was reported as a lost guarantee");
  assert.equal(r.body.changedProps, undefined, "a clean declaration was reported as changed");
});

test("a declared value the pipeline stored differently is recorded as changed", async () => {
  // NEITHER REACHED-FOR NOR REFUSED: the declaration landed and it landed as
  // something else. `everyMinutes: 5` is raised to the floor, silently, and the
  // reply would otherwise say the reminder runs every five minutes.
  const r = await addon("fw-changed", "remind them every five minutes", {
    kinds: ["function", "job"],
    answers: { function: { function: [FN] }, job: { job: [{ ...JOB, everyMinutes: 5, at: "" }] } },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.changedProps, ["everyMinutes"], "a clamped schedule is not reported");
  // AND THE REPLY SAYS WHAT IT REALLY IS, which is the point: the customer can
  // read the job's real interval off the same answer.
  assert.ok(r.body.jobs[0].everyMinutes > 5, "the floor did not apply — this case tests nothing");
  // DEVELOPER-FACING, never a customer sentence: a property name is not
  // something they can act on, and the count clause is about lost GUARANTEES.
  assert.doesNotMatch(r.body.coverNote || "", /everyMinutes/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EVIDENCE IS THE APPLIED RESULT, AND IT IS SPECIFIC TO THE CLAIM
// ─────────────────────────────────────────────────────────────────────────────

const claiming = (by) => ({
  function: { function: [FN] },
  job: { job: [JOB], requirements: [{ need: "customers get a reminder the day before", status: "covered", by }] },
});

test("a claim naming a configuration that really holds is recorded, and still does not claim the behaviour", async () => {
  // RE-ANCHORED 2026-09-14, and the property that moved is the subject of the
  // change. This asserted the claim was DELIVERED and the customer told
  // nothing. Owner: *"Matching configuration words must not mark an entire
  // business requirement delivered. 'The function is public' does not prove it
  // checks ownership."* The schedule is a configuration fact — read back off
  // what was applied — and the need is *"customers get a reminder the day
  // before"*, which nothing here has watched happen. So the fact is RECORDED
  // and the requirement stays unverified.
  const r = await addon("fw-ev-a", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder runs send_reminder at 09:00 every day"),
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["send_reminder"], "the function was not applied — this case tests nothing");
  assert.match(r.body.coverNote, /can't confirm from here that customers get a reminder the day before/,
    "a configuration word settled a business requirement");
  // AND THE CONFIGURATION IT DID CHECK IS NOT THROWN AWAY: a requirement whose
  // claim matched a real setting is a different kind of unverified from one
  // nothing could be said about, and the record keeps which.
  const rec = storedAnswer(r, "fw-ev-a");
  assert.equal(rec.coverage.counts.configured, 1, "the configuration fact that was checked is not recorded");
  assert.ok(rec.coverage.requirements.some((x) => typeof x.configuredBy === "string" && x.configuredBy.includes("daily_reminder")),
    "the record does not say WHICH configuration matched: " + JSON.stringify(rec.coverage.requirements));
});

test("the same claim is NOT delivered when the database refused the function it names", async () => {
  // THE DEFECT, AND IT IS THE OWNER'S OWN EXAMPLE OF IT: the names came off the
  // PROPOSED design, so `send_reminder` counted as created while Postgres was
  // answering a syntax error, and the job's claim read `delivered` on a change
  // that will never run.
  //
  // RE-ANCHORED 2026-09-14, and the property that moved is named rather than
  // the assertion appeased. This asserted the UNVERIFIED sentence, which was
  // right while the job was still registered against the dead function: nothing
  // had failed, and nothing could confirm the claim either. The dependency
  // block (below) makes the job's step really fail, so the requirement it owns
  // is `failed` rather than `unverified` and the customer is told it is still
  // to do. Both readings are honest about the same change; the second is the
  // stronger one, and asserting the weaker would now pass over a regression
  // that stopped blocking the job.
  const r = await addon("fw-ev-b", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder runs send_reminder at 09:00 every day"), fnFail: true,
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, [], "the function was applied — the refusal did not reach the route");
  assert.equal(r.body.functionErrors.length, 1);
  assert.match(r.body.coverNote, /Still to do: customers get a reminder the day before/,
    "a claim resting on a function the database refused was read as delivered");
  // NEVER BOTH. "I've set that up" about the very thing that is still to do is
  // the reply contradicting itself in one sentence.
  assert.doesNotMatch(r.body.coverNote, /I've set that up/);
});

test("a claim that names nothing checkable is unverified, however real the thing is", async () => {
  // EXISTENCE IS NOT DELIVERY. The job was registered and its schedule is real;
  // the claim says nothing about either, so there is nothing to check.
  const r = await addon("fw-ev-c", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder handles it"),
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["send_reminder"]);
  assert.match(r.body.coverNote, /can't confirm from here/, "a bare name match passed as delivered");
});

test("the stored coverage is written again once the apply has landed", async () => {
  // Owner: *"Update the stored coverage after application too."* The write
  // above the loop happens BEFORE a statement has reached Postgres, so every
  // verdict in it is decided against an empty applied result.
  const r = await addon("fw-record", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder runs send_reminder at 09:00 every day"),
  });
  const rec = storedAnswer(r, "fw-record");
  assert.ok(rec && rec.coverage, "no developer record was stored at all");
  // RE-ANCHORED with the completion correction: a configuration match is
  // recorded as CONFIGURED and never as delivered. What this case is really
  // about is unchanged — the record is re-written after the apply, so the
  // evidence it was decided from is the applied result and not an empty one.
  assert.equal(rec.coverage.counts.configured, 1, "the stored record was not re-decided against the applied result");
  assert.equal(rec.coverage.counts.delivered, 0, "a configuration fact was promoted to delivered");
  // AND THE EVIDENCE IT WAS DECIDED FROM IS KEPT BESIDE THE VERDICTS, so a
  // person reading the record can see WHY rather than re-deriving it.
  assert.ok(rec.coverage.applied.some((m) => m.name === "send_reminder"),
    "the record does not say what was really applied");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AN EXTENSION DOES NOT DESTROY THE NEXT DESIGNER'S PICTURE OF THE SITE
// ─────────────────────────────────────────────────────────────────────────────

test("a table extended by one column keeps its columns and its permissions for the next designer", async () => {
  // THE DEFECT, MEASURED THROUGH THIS ROUTE BEFORE THE FIX. The stored
  // `bookings` is `who, slot, phone` with `access: "user"`; adding a `notes`
  // column gave the function designer, one call later:
  //
  //   bookings (notes text) — access collect — being added by this same change
  //
  // Three columns gone, `collect` (anyone writes, nobody reads — the OPPOSITE
  // of what the site enforces) stamped by the normaliser on a table that
  // declared no access, and a table the site has had since it was built marked
  // as new. The merge is the APPLY'S OWN now, so the picture is the database
  // that is coming.
  const r = await addon("fw-extend", "add a notes field and count them", {
    kinds: ["table", "function"],
    answers: {
      table: { table: [{ table: { name: "bookings", columns: [{ name: "notes", type: "text" }] } }] },
      function: { function: [{ name: "count_bookings", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" }] },
    },
  });
  const fn = promptFor(r, "function");
  assert.ok(fn, "the function designer never ran — this case tests nothing");
  const row = (fn.text.match(/bookings \([^)]*\)[^\\]*/) || [""])[0];
  assert.ok(row, "the note does not describe the table at all: " + fn.text.slice(0, 400));
  for (const col of STORED_SCHEMA.tables[0].columns) {
    assert.ok(row.includes(col.name), "the extension lost the stored column `" + col.name + "`: " + row);
  }
  assert.ok(row.includes("notes"), "the new column is not in the picture: " + row);
  assert.match(row, /access user/, "the extension lost the stored permissions: " + row);
  assert.doesNotMatch(row, /access collect/, "the normaliser's default replaced the site's own rule: " + row);
  // …AND IT IS NOT MARKED AS NEW. `siteNote` prints "being added by this same
  // change" against every proposed name, which on an EXTENSION describes a
  // table the site has never had.
  assert.doesNotMatch(row, /being added by this same change/,
    "a table the site already had is described to the next designer as new: " + row);
});

test("a table the site does not have IS marked as being added by this change", async () => {
  // THE CONTROL: the marking is right for a real addition, and switching it off
  // altogether would satisfy the assertion above perfectly.
  const r = await addon("fw-newtable", "keep a waiting list too", {
    kinds: ["table", "function"],
    answers: {
      table: { table: [{ table: { name: "waitlist", columns: [{ name: "who", type: "text" }] } }] },
      function: { function: [{ name: "count_waiting", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" }] },
    },
  });
  const fn = promptFor(r, "function");
  assert.match(fn.text, /waitlist[^\\]*being added by this same change/,
    "a table this change really adds is not marked as new");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. EVERY OUTSTANDING REQUIREMENT REACHES ITS RECEIVING DESIGNER
// ─────────────────────────────────────────────────────────────────────────────

test("a requirement handed forward reaches the designer it was handed to", async () => {
  // THE DEFECT: `requirementBrief` was general and had ONE caller, for the page
  // call. The function step hands "it goes out every morning at nine" to the
  // job step, which runs a minute later in `ADD_KINDS` order and, before this,
  // was never told — while the customer was told the change was made.
  const r = await addon("fw-forward", "remind people the day before", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [FN], requirements: [{ need: "it goes out every morning at nine", status: "elsewhere", step: "job" }] },
      job: { job: [JOB] },
    },
  });
  const job = promptFor(r, "job");
  assert.ok(job, "the job designer never ran — this case tests nothing");
  assert.match(job.text, /What this addition still has to do/, "the hand-off block never reached the designer");
  assert.match(job.text, /it goes out every morning at nine/, "the requirement itself never reached the designer");
  // …AND THE SENTENCE NAMES WHAT THIS STEP IS. `requirementBrief` had one
  // caller, for the page, so its prose said "this page has to make possible" —
  // which read to a JOB designer as an instruction about a page it is not
  // writing. A sweep survivor: the block can reach every kind and still tell
  // five of the six the wrong thing about themselves.
  assert.doesNotMatch(job.text, /this page has to make possible/,
    "the job designer is told the requirement is about a page");
  assert.match(job.text, /the part you are designing has to make possible/,
    "the hand-off does not say what this step is");
  // …AND THE FUNCTION DESIGNER, WHICH RAN FIRST, WAS TOLD NOTHING — the brief is
  // composed from what has been collected SO FAR, which is exactly "the
  // receiving step is still ahead".
  assert.doesNotMatch(promptFor(r, "function").text, /What this addition still has to do/,
    "a step is handed requirements nobody had answered yet");
});

test("a requirement handed BACK to a step that already ran stays outstanding", async () => {
  // THE OTHER HALF, in the owner's words: *"Keep requests for an earlier or
  // omitted step outstanding."* The job step names the `function` step, which
  // ran first — so nobody can deliver it, and reading "that step ran" as
  // satisfied is the reading this replaces.
  const r = await addon("fw-backward", "remind people the day before", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [FN] },
      job: { job: [JOB], requirements: [{ need: "the reminder shows their booking time", status: "elsewhere", step: "function" }] },
    },
  });
  assert.equal(r.body.ok, true);
  // ── RE-ANCHORED 2026-09-15, AND THE EXPECTATION MOVED RATHER THAN BROKE ──
  //
  // This asserted "Still to do", which read an undelivered hand-off as work
  // that is not there. The hand-off is undelivered — that is true and is still
  // asserted below — but `send_reminder` WAS created, and whether it shows the
  // booking time is not something this layer looked at. "Still to do" asserts
  // it was not done; "I can't confirm" is what is actually known, and the
  // stronger claim is the one run 48 shipped as a falsehood.
  assert.doesNotMatch(r.body.coverNote, /Still to do/,
    "work nobody looked at was reported as work that is not there");
  // ── RE-ANCHORED AGAIN 2026-09-15, AND IT MOVED A SECOND TIME ─────────────
  //
  // It asserted the "I've set that up, but I can't confirm" clause. The
  // requirement names no thing to look for, so nobody established that
  // anything was set up — the function step made A function, and whether one
  // of them is what this asked for is precisely what cannot be told. The
  // owner's own instruction: *"'I've set that up' is inappropriate when
  // implementation is unknown."*
  assert.doesNotMatch(r.body.coverNote, /I've set that up/,
    "an implementation nobody could find was reported as work that was done");
  assert.match(r.body.coverNote, /can't see from here whether the reminder shows their booking time/,
    "the requirement stopped being mentioned to the customer at all");
  const bq = storedAnswer(r, "fw-backward").coverage.requirements
    .find((x) => x.need === "the reminder shows their booking time");
  assert.equal(bq.implementation, "unknown");
  assert.equal(bq.state, "unknown", "a populated kind with no name to match was read as work that exists");
  // WHAT THIS CASE IS REALLY FOR, kept exactly: the hand-off reached nobody and
  // the record says so, rather than a step that ran being read as satisfaction.
  assert.ok((r.body.requirements || []).some((x) => x.need === "the reminder shows their booking time"),
    "the outstanding requirement is not on the wire");
  const back = storedAnswer(r, "fw-backward").coverage;
  assert.equal(back.handoffs.undelivered, 1, "a hand-off nobody could deliver was read as satisfied");
  assert.ok(!back.toldSteps.includes("function"), "the function step was recorded as told about a later step's request");
});

test("…and NAMING the thing it wants makes the same hand-off an exact question", async () => {
  // THE `item` FIELD EARNING ITS PLACE. The case above cannot say more than
  // "cannot tell" because the requirement names no thing to look for. Name one
  // the change did not make and the answer is exact — this is the difference
  // between the kind-level reconcile and the item-level one, driven.
  const r = await addon("fw-backward-item", "remind people the day before", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [FN] },
      job: { job: [JOB], requirements: [{ need: "the reminder shows their booking time", status: "elsewhere", step: "function", item: "booking_time_for" }] },
    },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["send_reminder"], "the function step made nothing — this case tests nothing");
  assert.match(r.body.coverNote, /Still to do: the reminder shows their booking time/,
    "a named thing the change never made was not reported as outstanding");
  const rec = storedAnswer(r, "fw-backward-item").coverage;
  assert.equal(rec.counts.missing, 1);
  const q = rec.requirements.find((x) => x.need === "the reminder shows their booking time");
  assert.equal(q.implementation, "absent", "a named thing absent from a populated kind was not seen as absent");
});

test("a requirement handed to a step this change never runs stays outstanding", async () => {
  // `edit` is a real and correct answer — "they can change the wording later" —
  // and no add kind owns it, so nobody is ever told and it is still the
  // customer's to do.
  const r = await addon("fw-edit", "remind people the day before", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [FN], requirements: [{ need: "the wording suits their brand", status: "elsewhere", step: "edit" }] },
      job: { job: [JOB] },
    },
  });
  assert.match(r.body.coverNote, /Still to do: the wording suits their brand/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE FOUR FIXES OF 2026-09-14, EACH DEMONSTRATED THROUGH THIS ROUTE
//
// Owner: *"Demonstrate these through the addon route: malformed privacy input,
// explicit false, public versus internal functions, failed function → blocked
// job, and configuration present → behavior still unverified."*
// ─────────────────────────────────────────────────────────────────────────────

test("a privacy value nobody can read refuses the function instead of creating it public", async () => {
  // MEASURED BEFORE THE FIX: `internal: "yes"` is truthy and is not `true`, so
  // `internal: v.internal === true` wrote `false` and the function was created
  // with `GRANT EXECUTE … TO anonymous` — callable by every visitor. `cleanAdd`
  // answered `ok` with `skipped: []`: a permission inverted in silence, on the
  // one field whose whole job is privacy.
  const r = await addon("fw-priv-bad", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, internal: "yes" }] } },
  });
  assert.equal(r.status, 422, "the route built something: " + JSON.stringify(r.body));
  // THE CLEANER'S OWN REFUSAL SHAPE, not `declined`: the designer answered, and
  // what refused is the cleaner — so the reply names the kind and the reason,
  // which is what tells this apart from a model that said nothing.
  assert.equal(r.body.reason, "bad-internal");
  assert.equal(r.body.kind, "function");
  // NOTHING REACHED POSTGRES. The refusal is at the cleaner, above the apply,
  // so there is no CREATE to undo — which is the whole reason it is asked
  // first.
  assert.ok(!r.sql.some((q) => /CREATE OR REPLACE FUNCTION/i.test(q)),
    "a function with an unreadable privacy setting was created anyway");
  // AND THE CUSTOMER IS TOLD WHICH WAY IT WAS WRONG, so they can say it again.
  assert.match(r.body.msg, /whether that should be private to the site or callable from a page/);
});

test("definer: false is a real request, and is refused by name rather than inverted", async () => {
  // EXPLICIT FALSE IS A VALUE, NOT AN ABSENCE. It asks for INVOKER rights —
  // LESS privilege — and the engine supports it; this step cannot carry the key
  // (`normalizeSchema` applies `f.definer !== false`), so passing it through
  // would create the exact opposite of what was asked.
  const r = await addon("fw-definer", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, definer: false }] } },
  });
  assert.equal(r.status, 422, "a SECURITY DEFINER function was created for somebody who asked for the safer one");
  assert.equal(r.body.reason, "no-invoker");
  assert.ok(!r.sql.some((q) => /CREATE OR REPLACE FUNCTION/i.test(q)), "the function was created anyway");
  assert.match(r.body.msg, /reduced database permissions/);
  // AND IT IS NOT READ AS "NOT ASKED FOR": `definer: true` is the ordinary
  // answer and must still build, or the refusal is a ban on the whole tier.
  const ok = await addon("fw-definer-ok", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, definer: true }] } },
  });
  assert.equal(ok.body.ok, true, "an explicit definer: true was refused too: " + JSON.stringify(ok.body));
  assert.deepEqual(ok.body.functions, ["send_reminder"]);
});

test("public and internal functions carry opposite guarantees, and a claim on the wrong side is refused", async () => {
  // THE DEFECT THIS CLOSES was `holds: ["internal", "function"]` written as a
  // LITERAL on every applied function — so *"send_reminder is internal, so no
  // visitor can call it"* scored `delivered` against a function created PUBLIC,
  // which is the reader's own defect written into the reader.
  // THE CLAIM CARRIES A CONTRADICTING WORD *AND* A HOLDING ONE, and that pairing
  // is the whole case. A sweep survivor proved the shorter claim vacuous:
  // "send_reminder is internal" names nothing a PUBLIC function holds either, so
  // it came back unverified with `fails` gone as well as present — the assertion
  // passed for the wrong reason. MEASURED, both readings, same text:
  //
  //   "send_reminder is internal"                   with fails: null   without: null
  //   "send_reminder is internal and returns void"  with fails: null   without: {token:"void"}
  //
  // So `void` is what makes "`fails` is asked FIRST" observable: without it the
  // incidental word buys the claim a verdict its contradiction should have
  // denied outright.
  const claim = (need) => [{ need, status: "covered", by: "send_reminder is internal and returns void" }];
  const priv = await addon("fw-fn-internal", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [FN], requirements: claim("only the site can send reminders") } },
  });
  assert.deepEqual(priv.body.functions, ["send_reminder"]);
  // RE-ANCHORED: the visibility is a CONFIGURATION fact, so it is recorded and
  // the behavioural need — *"only the site can send reminders"* — stays
  // unverified. What this case is about is unchanged and is the LINE BELOW:
  // the same claim about a PUBLIC function is contradicted outright.
  assert.match(priv.body.coverNote, /can't confirm from here that only the site can send reminders/);
  assert.equal(storedAnswer(priv, "fw-fn-internal").coverage.counts.configured, 1,
    "the configuration that really holds was not recorded at all");

  // THE SAME CLAIM, THE SAME WORDS, A FUNCTION APPLIED THE OTHER WAY. `fails`
  // is asked FIRST, so `internal` naming a PUBLIC function denies the claim
  // outright rather than being outvoted by a word that happens to hold.
  //
  // `publishes` BECAUSE A PUBLIC FUNCTION IS NOT PAGELESS, and that is the
  // product being right rather than the fixture being awkward: a function
  // visitors may call exists to be called BY A PAGE, so the route writes one.
  // The short path cannot reach this case at all.
  const pub = await addon("fw-fn-public", "add a reminder sender", {
    kinds: ["function"], publishes: true,
    answers: { function: { function: [{ ...FN, internal: false }], requirements: claim("only the site can send reminders") } },
  });
  assert.deepEqual(pub.body.functions, ["send_reminder"], "the public function was not applied — this case tests nothing");
  assert.match(pub.body.coverNote, /can't confirm from here that only the site can send reminders/,
    "a claim of privacy about a function every visitor can call was read as delivered");
});

test("a job whose new function the database refused is not registered, and the dependency is named", async () => {
  // Owner: *"When a required new function fails, do not register its dependent
  // new jobs. Name the failed dependency and remove those jobs from the
  // scheduled-success list."*
  //
  // THE FIRST PASS TOOK IT OUT OF THE EVIDENCE ONLY — so the reply stopped
  // calling the requirement delivered and went on registering a timer against a
  // function that does not exist. Every firing would write "this job is no
  // longer part of the site", for ever, on a schedule the customer was told was
  // set up.
  const r = await addon("fw-blocked", "remind people the day before", {
    kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, fnFail: true,
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, [], "the function was applied — this case tests nothing");
  assert.deepEqual(r.body.jobs, [], "a job on a function the database refused is still on the scheduled list");
  // THE DEPENDENCY BY NAME, because "couldn't be set up" gives nobody anything
  // to do: the function is what failed and the function is what they can ask
  // for again.
  assert.equal((r.body.jobErrors || []).length, 1, "the blocked job is not reported at all");
  assert.equal(r.body.jobErrors[0].name, "daily_reminder");
  assert.match(r.body.jobErrors[0].error, /send_reminder/, "the failed dependency is not named");
  // AND NOTHING WAS REGISTERED. The reply is what the customer reads;
  // `site_functions` is what the two-minute runner reads, and the first pass at
  // this corrected only the reply.
  assert.deepEqual(r.registered, [], "a timer was registered against a function that does not exist");
});

test("a job whose own function was created is left alone by another function's failure", async () => {
  // THE CONTROL, and it is what makes the block a block rather than a ban: ONE
  // function is refused and the other is created, so a wholesale "a function
  // failed, so no jobs" passes every assertion in the case above and takes a
  // working schedule off the site here.
  const r = await addon("fw-blocked-other", "remind people the day before and sweep old holds", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [FN, { name: "sweep_holds", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [JOB, { name: "nightly_sweep", fn: "sweep_holds", everyMinutes: 1440, at: "03:00" }] },
    },
    fnFail: "send_reminder",
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["sweep_holds"], "the surviving function was not created — this case tests nothing");
  assert.deepEqual(r.body.functionErrors.map((e) => e.name), ["send_reminder"]);
  // ONE JOB SURVIVES, AND IT IS THE ONE WHOSE OWN FUNCTION EXISTS.
  assert.deepEqual(r.body.jobs.map((j) => j.name), ["nightly_sweep"]);
  assert.deepEqual((r.body.jobErrors || []).map((e) => e.name), ["daily_reminder"]);
  // …AND THE DATABASE AGREES WITH THE REPLY. The reply is what the customer
  // reads; `site_functions` is what the two-minute runner reads, and the first
  // pass at this fix corrected only the reply — so the blocked reminder would
  // have gone on firing against a function that does not exist, for ever,
  // writing "this job is no longer part of the site" every time.
  assert.deepEqual(r.registered.map((row) => row.name), ["nightly_sweep"],
    "a job on a refused function was still registered to run: " + JSON.stringify(r.registered.map((x) => x.name)));
});

test("a stored connection proves configuration and never behaviour", async () => {
  // Owner: *"A stored connection proves configuration exists; it does not prove
  // credentials work or the external service answers. Keep behavior unverified
  // unless the specific behavior was checked."*
  //
  // An api is not DDL — it is stored in `_meta.schema` — so "applied" here means
  // STORED, and nothing has called the service or checked the key.
  const API = { name: "weather", url: "https://api.test/v1/forecast", method: "GET", params: ["city"], cacheSeconds: 300 };
  // `publishes` FOR THE SAME REASON AS THE PUBLIC FUNCTION: a connection is
  // read BY A PAGE, so an addition that makes one is never pageless and the
  // route writes the page. The compile and the dispatch upload are stubbed;
  // nothing else about the path is.
  const behaviour = await addon("fw-api-behave", "show the forecast", {
    kinds: ["api"], publishes: true,
    // THE CLAIM SPELLS THE BEHAVIOUR OUT, and that is what makes the case
    // about the VOCABULARY rather than about a short sentence. A sweep survivor
    // proved the bare "the weather connection" vacuous: it names no behaviour
    // word, so a reader that had one in its list would answer the same. With
    // `live` and `forecast` in the claim, a configuration-only vocabulary is
    // the only thing keeping this unverified.
    answers: { api: { api: [API], requirements: [{ need: "visitors see the live forecast", status: "covered", by: "the weather connection returns the live forecast" }] } },
  });
  assert.equal(behaviour.body.ok, true);
  assert.deepEqual(behaviour.body.apis, ["weather"], "the connection was not stored — this case tests nothing");
  assert.match(behaviour.body.coverNote, /can't confirm from here that visitors see the live forecast/,
    "a stored connection was read as proof the service answers");

  // AND THE CONFIGURATION ITSELF IS CHECKABLE, which is what keeps this from
  // being "nothing about an api is ever evidence": a claim naming the host, the
  // verb or a parameter is about the thing that really was applied.
  const config = await addon("fw-api-config", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [API], requirements: [{ need: "the forecast is read from api.test", status: "covered", by: "weather calls api.test" }] } },
  });
  // RE-ANCHORED: the host IS checked and IS recorded — and it is configuration,
  // so it does not settle the need either. The difference this case exists for
  // survives in the record: the behavioural claim above matches nothing and
  // this one matches a real stored setting.
  assert.match(config.body.coverNote, /can't confirm from here/);
  assert.equal(storedAnswer(config, "fw-api-config").coverage.counts.configured, 1,
    "a claim naming the stored host was not recorded as checked configuration");
  assert.equal(storedAnswer(behaviour, "fw-api-behave").coverage.counts.configured, 0,
    "a claim naming only behaviour was recorded as checked configuration");
});

test("a setting the engine supports and this step cannot carry is a different sentence from one the engine refuses", async () => {
  // Owner: *"Distinguish 'the engine does not support this' from 'the addon
  // cannot express or preserve this.' `language` is the second case."*
  //
  // `encryptAtRest` is dropped by the ENGINE, which has never heard of it.
  // `language` is dropped by the addon's own CLEANER while `normalizeSchema`
  // reads `f.language` and the DDL says `LANGUAGE plpgsql`. Telling a customer
  // the database "doesn't offer" the second one is false, and sends them to
  // argue with the wrong layer.
  const r = await addon("fw-unexpressed", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpgsql", encryptAtRest: true }] } },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.unexpressedProps, ["language"], "the setting the engine supports is not separated out");
  assert.deepEqual(r.body.invalidProps, ["encryptAtRest"], "a setting the addon lost is reported as one the database refuses");
  // TWO CLAUSES, TWO PARTIES — and the second one says to ask again, because
  // asking again is what can actually work.
  assert.match(r.body.coverNote, /a guarantee it doesn't offer/);
  assert.match(r.body.coverNote, /One setting the design asked for isn't something this kind of change can carry through/);
  // NEITHER NAMES THE PROPERTY. The count is what a customer can act on, and
  // naming `language` here would be the "expose hidden settings" the owner
  // ruled out in the same message.
  assert.doesNotMatch(r.body.coverNote, /language|encryptAtRest/);
  // …AND THE RECORD IS WHERE THE NAMES BELONG. `language` there says the addon
  // has no property for it, which is a thing to go and build; the same name
  // under `invalidProps` would say the database never heard of it, which is
  // false. A sweep survivor emptied this list and nothing noticed.
  const rec = storedAnswer(r, "fw-unexpressed");
  assert.deepEqual(rec.coverage.unexpressedProps, ["language"],
    "the developer record does not say which setting this step could not carry");
  assert.deepEqual(rec.coverage.invalidProps, ["encryptAtRest"]);
});

test("a setting only this step lost still reaches the customer, with nothing else wrong", async () => {
  // THE CASE THAT PROVES THE CLAUSE IS REACHABLE ON ITS OWN, and a sweep
  // survivor is why it exists: `requirementNote` returns "" early when there is
  // nothing to say, and the case above always had an `encryptAtRest` beside the
  // `language` — so a mutant dropping `lost` from that early return changed
  // nothing there and the whole clause could have gone silent for the one shape
  // it is really for: a design that asked for something the engine supports and
  // this step could not carry, with no other complaint anywhere in the reply.
  const r = await addon("fw-unexpressed-only", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpgsql" }] } },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["send_reminder"], "the function was not applied — this case tests nothing");
  assert.equal(r.body.invalidProps, undefined, "something else was wrong — this case no longer isolates the clause");
  assert.deepEqual(r.body.unexpressedProps, ["language"]);
  assert.match(r.body.coverNote, /One setting the design asked for isn't something this kind of change can carry through/,
    "the only thing wrong with this change was never said");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. THE DELIVERY GAPS OF 2026-09-14
//
// Owner: *"Report missing pages … Validate page and component declarations
// before cleaning discards information … Fix component targeting and name
// validation."*
// ─────────────────────────────────────────────────────────────────────────────

/** Two pages asked for, in the shape the page designer answers. */
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

test("a page that was asked for and did not survive is named in the result", async () => {
  // THE DEFECT: `foldAdds` has computed the requested file names since the day
  // it was written — its own comment says they are there "so the route can tell
  // a new page from a changed one" — and MEASURED, the route read `designed`,
  // `directive` and `components` off that fold and never once read `files`. So
  // a message asking for two pages whose writer returned one published the one,
  // reported it as `added`, and said nothing whatever about the other.
  const r = await addon("fw-missing", "add a gallery and a prices page", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [PAGE("/gallery", "Gallery"), PAGE("/prices", "Prices")] } },
    written: [writtenPage("/gallery")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.added, ["gallery.tsx"], "the page that DID survive is not reported as added");
  // THE PAGE THAT DID NOT, BY ROUTE — the one thing about it the customer can
  // act on, where a count would leave them to work out which.
  assert.deepEqual(r.body.missingPages, ["/prices"]);
  assert.match(r.body.coverNote, /One page I set out to add isn't there — \/prices/);
  // …AND THE PAGE STEP IS MARKED FAILED, so a requirement handed to it cannot
  // be covered by a page that is not on the site.
  assert.ok(storedAnswer(r, "fw-missing").coverage.failedSteps.includes("page"),
    "a page that never arrived left the page step reading as successful");
});

test("a page that survives is not reported missing, and the reply says nothing about it", async () => {
  // THE CONTROL. Without it "name the missing pages" is satisfied by naming
  // every page, which would put a false alarm in front of every customer who
  // asked for one page and got it.
  const r = await addon("fw-missing-none", "add a gallery page", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [PAGE("/gallery", "Gallery")] } },
    written: [writtenPage("/gallery")],
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.added, ["gallery.tsx"]);
  assert.equal(r.body.missingPages, undefined, "a page that is on the site was reported missing");
  assert.equal(r.body.coverNote, "", "the customer was told something about a change with nothing wrong with it");
});

test("a page declaring a property the tool never offered is reported, though the cleaner removed it first", async () => {
  // THE SCHEMA TIERS' OWN DEFECT, ONE LAYER OVER: `SPEC_OF_KIND` names four
  // tiers and `page` is not one, so the audit block never ran for it at all.
  // MEASURED before this: `cleanAdd("page", …)` keeps its eight known keys,
  // `skipped: []`, and nothing anywhere reported either property.
  const r = await addon("fw-page-props", "add a gallery page", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [{ ...PAGE("/gallery", "Gallery"), seoTitle: "Our gallery", cacheForever: true }] } },
    written: [writtenPage("/gallery")],
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.invalidProps, ["cacheForever", "seoTitle"],
    "a frontend declaration's unsupported properties are not reported");
  assert.match(r.body.coverNote, /2 guarantees it doesn't offer/);
  assert.doesNotMatch(r.body.coverNote, /seoTitle|cacheForever/, "a property name reached the customer");
});

test("a component declaration the cleaner cut is reported as changed", async () => {
  // THE `changed` HALF, on the frontend pipeline: `where` is capped at 200
  // characters and a longer one is CUT, not refused — the declaration landed
  // and it landed as something else, which is the one shape where a customer is
  // told the thing they asked for was done and it quietly does another.
  const r = await addon("fw-comp-props", "add a reviews band", {
    kinds: ["component"], publishes: true,
    answers: { component: { component: [{ page: "/", does: "a band of reviews", components: ["testimonial"], where: "x".repeat(400) }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.changedProps, ["where"], "a cut declaration is not reported");
});

test("a frontend declaration the cleaner emptied reaches the customer as a setting this step could not carry", async () => {
  // THE THIRD OF THE THREE FRONTEND READINGS, and the one the first sweep found
  // pooled nowhere: the route's `fa.unexpressed` loop was emptied and every
  // guard stayed green, because both route cases above drive `reached` and
  // `changed` and nothing drove this one.
  //
  // `tsx` is OFFERED to the page tool and a part with no name is binned by
  // `parts()`, so the declaration arrives truthy and is stored empty — which is
  // a different party from the two above: the tool had a use for it and THIS
  // STEP lost it. It gets the "isn't something this kind of change can carry
  // through" clause, never the "a guarantee it doesn't offer" one, and the
  // control below is that the unsupported clause does NOT also appear.
  const r = await addon("fw-page-cut", "add a tide page", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [{ ...PAGE("/tide", "Tide"), tsx: [{ does: "shows the tide" }] }] } },
    written: [writtenPage("/tide")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.unexpressedProps, ["tsx"], "a declaration this step emptied is not reported");
  assert.equal(r.body.invalidProps, undefined, "a setting this step lost was reported as one the engine refuses");
  assert.match(r.body.coverNote, /One setting the design asked for isn't something this kind of change can carry through/,
    "the customer hears nothing about the setting that was lost: " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /tsx/, "a property name reached the customer");
});

test("on a multi-page site a component with no destination is refused, not put on the home page", async () => {
  // Owner: *"On a multi-page site, a missing destination must not silently
  // become the home page."* MEASURED before this: `onPage` fell through to "/"
  // whenever the answer named no route, so a section the designer forgot to
  // place was built on the front page and the customer told it was added.
  //
  // THE SITE HAS THREE PAGES, which is what makes the fall-through a guess
  // rather than a reading: with one page there is exactly one place a component
  // can go and resolving to it is reading the site, which is why that shortcut
  // stays and this case stores three.
  const r = await addon("fw-nowhere", "add a reviews band", {
    kinds: ["component"], sitePages: ["/", "/gear", "/about"],
    answers: { component: { component: [{ does: "a band of reviews", components: ["testimonial"] }] } },
  });
  assert.equal(r.status, 422, "a component with no destination was built: " + JSON.stringify(r.body));
  assert.equal(r.body.reason, "no-page");
  assert.equal(r.body.kind, "component");
});

test("a kit name that is not in the kit is dropped and named, and a custom part beside it survives", async () => {
  // THE TOOL'S OWN PROMISE, kept: *"Naming a component that does not exist is
  // refused and costs nothing."* MEASURED before this, it was not — the name
  // passed the cleaner and was written into the directive as *"the kit
  // component: not-a-kit-part — its exact props are listed above"*, about a
  // component whose props are not listed above because there are none.
  const r = await addon("fw-kit", "add a tide chart and a reviews band", {
    kinds: ["component"], publishes: true,
    answers: { component: { component: [{
      page: "/", does: "a tide chart beside the reviews",
      components: ["not-a-kit-part", "testimonial"],
      tsx: [{ name: "TideChart", does: "draws the day's tides", props: "readings: Reading[]" }],
    }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.unknownComponents, ["not-a-kit-part"], "the name that is not in the kit is not reported");
  // THE VALID KIT NAME SURVIVES AND SO DOES THE CUSTOM PART — the escape hatch
  // the kit exists to have is not closed by the check on the kit.
  const sent = promptFor(r, "page") || r.prompts.find((p) => p.tool === "write_pages");
  assert.ok(sent && /testimonial/.test(sent.text), "the valid kit component was dropped with the invalid one");
  assert.ok(sent && /TideChart/.test(sent.text), "the custom part was dropped by the kit check");
  assert.ok(sent && !/not-a-kit-part/.test(sent.text),
    "the name that is not in the kit was still written into the page call");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DATABASE-DISCOVERY REPAIR (2026-09-15)
//
// Owner, after run 47: *"Stop treating an unavailable existing backend as an
// empty site. Distinguish 'this site has no database' from 'its database
// reference is incomplete' and 'reading its schema failed'. Resolve the existing
// backend or stop the dependent addon steps with a specific explanation. Do not
// design against tables: [] when the existing schema is unknown."*
//
// Every case below goes through `POST /api/site/<slug>/addon` with no paid model
// call: the designers are stubbed, the credit ledger is stubbed, and the whole
// point is which SPEC the route hands them and what the customer is told.
// ─────────────────────────────────────────────────────────────────────────────

test("an incomplete backend reference resolves to the real schema — the designer is handed bookings, not an empty site", async () => {
  // RUN 47's EXACT STATE: `site_backends.neon_db` blank, `site_project` present,
  // and the database holding `bookings`. The route used to read the blank column
  // as `{ tables: [] }` and hand THAT to the table designer, which is why it
  // built a second table and counted the empty one.
  const r = await addon("fw-incomplete", "add a function that counts the bookings", {
    backend: "incomplete",
    kinds: ["function"],
    answers: { function: { function: [{ name: "count_bookings", returns: "bigint", body: "SELECT COUNT(*) FROM bookings", internal: true }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE SITE NOTE THE DESIGNER REALLY RECEIVED — the one thing that decides
  // whether it reuses the site's table or invents one.
  const sent = promptFor(r, "function");
  assert.ok(sent && /bookings/.test(sent.text),
    "the designer was NOT told about the site's existing bookings table: " + String(sent && sent.text).slice(0, 400));
  // AND THE REFERENCE IS REPAIRED ON THE WAY PAST, which is what stops the next
  // addon meeting the same blank column.
  assert.equal(r.body.backend, "incomplete", "the reply does not say which state the backend was in");
  assert.equal(r.body.backendHealed, true, "the ownership row was not repaired");
  const patch = r.patched.find((p) => /site_backends/.test(p.url));
  assert.ok(patch, "no PATCH reached site_backends");
  // DERIVED THE WAY THE PRODUCT DERIVES IT, never retyped: `dbNameForSite` is
  // the platform's one namer and this is the whole of "verify the site's actual
  // database identity" at the unit level.
  const { dbNameForSite } = await import("../site-db.mjs");
  assert.equal(patch.body.neon_db, dbNameForSite("fw-incomplete"),
    "the heal wrote a name the platform would not derive: " + JSON.stringify(patch.body));
  // NEVER OVERWRITES A VALID SETTING — the filter is what enforces it, so the
  // filter itself is the assertion rather than the intent behind it.
  assert.ok(/neon_db\.is\.null/.test(patch.url) && /neon_db\.eq\./.test(patch.url),
    "the heal's PATCH is not fenced to a row whose neon_db is still unset: " + patch.url);
  // AND IT IS NOT REPORTED AS A PROVISION. Run 47's reply said the site "got its
  // database for it" about a database it had had for twelve minutes.
  assert.ok(!r.body.provisioned, "an existing database was reported as newly provisioned");
});

test("the CONTROL: a ready backend behaves exactly as before and is never patched", async () => {
  // Without this, a heal that fired on every site would pass the case above.
  const r = await addon("fw-ready", "add a function that counts the bookings", {
    kinds: ["function"],
    answers: { function: { function: [{ name: "count_bookings", returns: "bigint", body: "SELECT COUNT(*) FROM bookings", internal: true }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.backend, "ready");
  assert.equal(r.body.backendHealed, undefined, "a site whose reference was already recorded was patched anyway");
  assert.equal(r.patched.filter((p) => /site_backends/.test(p.url)).length, 0,
    "a ready site's ownership row was written to");
});

test("a backend that cannot be read STOPS the step and says which link failed — it never becomes an empty site", async () => {
  const r = await addon("fw-unreadable", "add a table that stores repair bookings", {
    backend: "unreadable", publishes: true,
    kinds: ["table"],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(r.status, 503, "an unreadable backend did not stop the step: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, false);
  assert.equal(r.body.cost, 0, "an unreadable backend charged the customer");
  assert.equal(r.body.ours, true, "our own failure was not marked as ours");
  assert.equal(r.body.backend, "lookup-failed", "the reason is not named, so three different failures read alike");
  assert.match(r.body.msg, /database/i);
  // THE PROOF THAT IT STOPPED RATHER THAN GUESSED: no table reached Postgres.
  assert.equal(r.sql.filter((q) => /CREATE TABLE/i.test(q)).length, 0,
    "a table was applied against a site whose schema could not be read");
});

test("a schema read that FAILS stops the step; one that finds nothing stored is honestly empty", async () => {
  // THE TWO USED TO BE ONE THROW. `metaFail` is Neon refusing the query, so the
  // schema is UNKNOWN; `metaMissing` is a database provisioned and never applied
  // to, where empty is the truth. Opposite answers, driven side by side.
  const failed = await addon("fw-metafail", "add a function that counts the bookings", {
    metaFail: true, kinds: ["function"],
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  assert.equal(failed.body.ok, false, "an unreadable schema was designed against: " + JSON.stringify(failed.body));
  assert.equal(failed.body.escalate, true);
  assert.equal(failed.body.reason, "no-meta");
  assert.equal(failed.body.cost, 0);

  const empty = await addon("fw-metamissing", "add a table that stores repair bookings", {
    metaMissing: true, publishes: true, kinds: ["table"],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(empty.body.ok, true, "a database with no _meta yet was refused instead of read as empty: " + JSON.stringify(empty.body));
  assert.ok(empty.sql.some((q) => /CREATE TABLE IF NOT EXISTS "repairs"/i.test(q)),
    "the table was not applied on a legitimately empty database");
});

test("a frontend-only site is still the one state where tables: [] is the truth", async () => {
  // THE REGRESSION THIS CHANGE COULD EASILY HAVE CAUSED. `{tables: []}` used to
  // come from `adb` being falsy, which was true for BOTH a frontend-only site
  // and an incomplete one; now it is keyed on the state. If that had been
  // tightened too far, the first backend addition on most of the platform would
  // refuse.
  const r = await addon("fw-none", "add a table that stores repair bookings", {
    backend: "none", publishes: true, kinds: ["table"],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  // THE PROVISION ATTEMPT *IS* THE PROOF, and it is the behaviour that
  // separates `none` from `incomplete`: a site with no database has one MADE
  // for it, where an incomplete one is resolved and never provisioned. The
  // fixture has no Neon to create in, so the attempt surfaces as the route's
  // own named 502 — which still shows the state was read as `none`, since any
  // other state never reaches `ensureSiteBackend` at all.
  assert.equal(r.body.error, "provision", "a frontend-only site did not try to make a database: " + JSON.stringify(r.body));
  assert.equal(r.body.stage, "create_project");
  assert.equal(r.body.cost, 0);
  assert.equal(r.body.ours, true);
});

test("a table this change reads and nothing can fill is NAMED to the customer, and a legitimate read-only table is not", async () => {
  // Owner: *"Replace the proposed blanket table refusal with a dependency check.
  // No client write grant does not mean no writer."* Run 47's shape: a table
  // declared read-nobody/write-nobody with a function counting it.
  const r = await addon("fw-nofill", "add a table of repairs and a function that counts them", {
    kinds: ["table", "function"], publishes: true,
    answers: {
      table: { table: [{ table: { name: "repairs", read: "none", write: "none", columns: [{ name: "who", type: "text" }] } }] },
      function: { function: [{ name: "count_repairs", returns: "bigint", body: "SELECT COUNT(*) FROM repairs", internal: true }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.noPopulation, ["repairs"], "the table nothing can fill was not reported");
  assert.match(r.body.coverNote, /Nothing can put rows into repairs/,
    "the customer was not told the table starts empty and stays empty: " + r.body.coverNote);
  // IT IS A REPORT, NOT A REFUSAL — the change still shipped.
  assert.ok(r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "repairs"/i.test(q)),
    "the dependency check refused the table instead of reporting it");
});

test("the CONTROL for the dependency check: a table a declared function writes is never reported", async () => {
  // THE OWNER'S OWN POINT, driven. Same read-nobody/write-nobody table, with a
  // function that INSERTs into it — a real population path, so silence.
  const r = await addon("fw-fnfill", "add a log table and something that writes it", {
    kinds: ["table", "function"], publishes: true,
    answers: {
      table: { table: [{ table: { name: "repairs", read: "none", write: "none", columns: [{ name: "who", type: "text" }] } }] },
      function: { function: [{ name: "log_repair", returns: "void", body: "INSERT INTO repairs (who) VALUES ('x'); SELECT COUNT(*) FROM repairs", internal: true }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.noPopulation, undefined,
    "a table a declared function populates was reported as unfillable: " + JSON.stringify(r.body.noPopulation));
  assert.ok(!/Nothing can put rows into/.test(r.body.coverNote || ""),
    "the customer was told a populated table cannot be filled: " + r.body.coverNote);
});

test("a derived name that will not ANSWER stops the step — it never reads as a site with no database", async () => {
  // A NAME THAT DERIVES IS NOT A DATABASE THAT EXISTS. `siteBackendDetail` asks
  // the derived connection one trivial question before handing it back, and a
  // refusal there is a fact about reachability — reporting it as an empty site
  // is the whole defect this replaces, arriving by a different door.
  const r = await addon("fw-probefail", "add a function that counts the bookings", {
    backend: "incomplete", probeFail: true, kinds: ["function"],
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  assert.equal(r.status, 503, "an unreachable database did not stop the step: " + JSON.stringify(r.body));
  assert.equal(r.body.backend, "derived-database-unreachable",
    "the reason is not named, so 'Supabase is down' and 'that database is not there' read alike");
  assert.equal(r.body.cost, 0);
  // AND NOTHING WAS WRITTEN ANYWHERE on the way out.
  assert.equal(r.patched.filter((p) => /site_backends/.test(p.url)).length, 0,
    "a reference was recorded for a database that does not answer");
});

test("a stored schema that will not parse stops the step rather than becoming an empty one", async () => {
  // THE WORST CASE TO GUESS AT: the site HAS a schema and we cannot read it.
  // An empty answer here is run 47's defect with a different cause.
  const r = await addon("fw-metajunk", "add a function that counts the bookings", {
    metaJunk: true, kinds: ["function"],
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  assert.equal(r.body.ok, false, "an unparseable schema was designed against: " + JSON.stringify(r.body));
  assert.equal(r.body.reason, "no-meta");
  assert.equal(r.body.cost, 0);
});

test("a second repair run claims nothing: an empty representation is 'already set', not a heal", async () => {
  // THIS IS WHAT REPEATABLE LOOKS LIKE FROM THE ROUTE. The filter matched no
  // row because the name is already recorded; reporting that as a repair would
  // make every run after the first claim work it did not do.
  const r = await addon("fw-healnoop", "add a function that counts the bookings", {
    backend: "incomplete", healNoop: true, kinds: ["function"],
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT COUNT(*) FROM bookings", internal: true }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.backend, "incomplete");
  assert.equal(r.body.backendHealed, undefined, "a PATCH that matched nothing was reported as a repair");
  // THE ATTEMPT STILL HAPPENED — this is about what is CLAIMED, not about
  // skipping the write, and without it the assertion above passes vacuously.
  assert.equal(r.patched.filter((p) => /site_backends/.test(p.url)).length, 1,
    "the heal was not attempted at all, so the claim assertion proves nothing");
});

test("the seed skip the engine computed reaches the customer, and a resolved reference is never a provision", async () => {
  // Owner: *"Surface relevant seed skips accurately."* The report has existed in
  // `seedSiteRows` since it was written and went into the migration record,
  // where only a developer with a token could read it. Run 47's customer was
  // never told why `repairs` arrived empty.
  const r = await addon("fw-seedskip", "add a repairs table with some starter rows", {
    backend: "incomplete", publishes: true, kinds: ["table"],
    answers: { table: { table: [{
      table: { name: "repairs", read: "none", write: "none", columns: [{ name: "who", type: "text" }] },
      seed: [{ who: "Sam" }, { who: "Priya" }],
    }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok(Array.isArray(r.body.seedSkips) && r.body.seedSkips.length,
    "the engine's skip report did not reach the reply: " + JSON.stringify(r.body.seedSkips));
  assert.match(r.body.seedSkips[0], /repairs/);
  assert.match(r.body.coverNote, /starter rows ready for repairs/,
    "the customer was not told why the table starts empty: " + r.body.coverNote);
  // AND THE RESOLVED REFERENCE IS NOT A PROVISION. Run 47's reply said the site
  // "got its database for it" about one it had had for twelve minutes.
  assert.ok(!r.body.provisioned, "a resolved reference was reported as a newly made database");
  assert.equal(r.body.backendHealed, true);
});

test("the CONTROL: a table that IS seeded says nothing about seeding", async () => {
  // "Do not imply seeding was required when it wasn't" — the same change, with
  // a display table whose rows really land.
  const r = await addon("fw-seedok", "add a menu with some starter rows", {
    publishes: true, kinds: ["table"],
    answers: { table: { table: [{
      table: { name: "menu", read: "public", write: "none", columns: [{ name: "item", type: "text" }] },
      seed: [{ item: "Flat white" }],
    }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.seedSkips, undefined, "a seeded table was reported as skipped");
  assert.ok(!/starter rows ready/.test(r.body.coverNote || ""),
    "the customer was told about a skip that did not happen: " + r.body.coverNote);
});

test("a provision records the database name on the ownership row — the defect's root, driven", async () => {
  // THE ONE LINE THAT FIXES RUN 47 AT ITS SOURCE, and the only way to reach it.
  //
  // `saveBackend` inside `ensureSiteBackendPure` is an INSERT with
  // `resolution=ignore-duplicates`: for a site whose first build was
  // frontend-only the row ALREADY EXISTS with `neon_db: ""`, so the claim is a
  // no-op and the column stays empty for ever. Five live sites are in that
  // state. The fixture answers that claim with an empty representation, which
  // is exactly the live shape, so this drives the real failure rather than a
  // convenient one.
  const r = await addon("fw-provision", "add a table that stores repair bookings", {
    backend: "none", provisions: true, publishes: true, kinds: ["table"],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(r.body.ok, true, "the provision path did not complete: " + JSON.stringify(r.body));
  // THE PROVISION REALLY RAN — without this the assertion below could pass on a
  // site that never needed one.
  assert.ok(r.neonCalls.some((u) => u === "/projects"), "no Neon project was created: " + JSON.stringify(r.neonCalls));
  assert.equal(r.body.provisioned, true, "a site that had no database was not reported as getting one");
  // AND THE NAME WAS RECORDED. The PATCH is the fix; without it the next addon
  // reads a blank column, calls the site empty, and designs a second table.
  const patch = r.patched.find((p) => /site_backends/.test(p.url));
  assert.ok(patch, "the provision did not record the database name — every later addon will read this site as empty");
  const { dbNameForSite } = await import("../site-db.mjs");
  assert.equal(patch.body.neon_db, dbNameForSite("fw-provision"),
    "the recorded name is not the database that was made: " + JSON.stringify(patch.body));
  // READ OFF THE CONNECTION, NOT RE-DERIVED. The two agree here by construction,
  // which is the point: the row can never name a database nothing connects to.
  assert.ok(/neon_db\.is\.null/.test(patch.url), "the record is written without the fence that stops it overwriting a set name");
});

// ── A SPEC THAT DISAGREES WITH THE DATABASE (2026-09-15) ─────────────────────
//
// Owner: *"Prove an existing database is empty. Missing `_meta` or a missing
// schema row does not prove there are no application tables. Inspect the
// catalog. If tables exist but their metadata is unavailable, recover safely
// or stop before designing against an empty schema."*
//
// Every case below hands the route a `catalog` — what Postgres really holds —
// and asks what the DESIGNERS were told, which is the only thing run 47 got
// wrong. Without the seam the fixture answers no rows, which is the honestly
// empty database the earlier cases are about.

/** The catalog rows for one `collect` table, derived from the real emitters. */
function catalogFor(name, cols) {
  const t = { name, access: "collect", columns: cols.map((c) => ({ name: c, type: "text" })) };
  const columns = [{ t: name, c: "id", ty: "integer" }, { t: name, c: "created_at", ty: "text" },
    ...cols.map((c) => ({ t: name, c, ty: "text" }))];
  const grants = [], policies = [];
  for (const stmt of grantsFor(t, cols)) {
    const m = /^GRANT\s+([\s\S]+?)\s+ON\s+"([^"]+)"\s+TO\s+(\w+)/i.exec(stmt);
    if (!m) continue;
    for (const { verb, cols: c } of splitPrivileges(m[1])) {
      if (c) for (const one of c) grants.push({ t: m[2], g: m[3], p: verb, lvl: "column", col: one });
      else grants.push({ t: m[2], g: m[3], p: verb, lvl: "table", col: "" });
    }
  }
  for (const stmt of policiesFor(t)) {
    const s = String(stmt);
    const m = /CREATE POLICY\s+\S+\s+ON\s+"([^"]+)"\s+FOR\s+(\w+)/i.exec(s);
    if (!m) continue;
    const u = /\bUSING\s*\(/i.exec(s), c = /\bWITH\s+CHECK\s*\(/i.exec(s);
    policies.push({ t: m[1], c: m[2].toUpperCase(), q: u ? readParens(s, u.index + u[0].length - 1) : "", w: c ? readParens(s, c.index + c[0].length - 1) : "" });
  }
  return { columns, grants, policies, triggers: [] };
}

test("run 47's own state through the route: a live table the spec forgot is recovered, and the designer is told about it", async () => {
  // THE SITE: `bookings` exists in Postgres. The stored spec does not declare
  // it — which is exactly what run 47's addon left behind on repairbench-1.
  const r = await addon("fw-recover", "add a function that counts booked repairs", {
    metaMissing: true, kinds: ["function"],
    catalog: catalogFor("bookings", ["customer_name", "bike", "drop_off_day"]),
    answers: { function: { function: [{ name: "count_booked", returns: "bigint", body: "SELECT count(*) FROM bookings", internal: true }] } },
  });
  assert.equal(r.body.ok, true, "a recoverable spec stopped the step: " + JSON.stringify(r.body));

  // THE DESIGNER SAW THE TABLE. This is the whole defect: run 47's table
  // designer was told the site had none, so it made a second one and counted
  // that.
  //
  // THE NEEDLE IS `siteNote`'S OWN SENTENCE, NOT THE BARE WORD — the first
  // draft of this case matched `/bookings/` anywhere in the prompts and passed
  // on the CONTROL, because the picker's own static prose uses "bookings" as an
  // example of an ask that needs storage. The recorded "prose contains the
  // thing it forbids", in a guard, caught by writing the control.
  const note = r.prompts.map((p) => JSON.stringify(p)).join("\n");
  assert.ok(/It stores:[^"]*bookings/.test(note), "the designer was still told the site has no tables");
  assert.ok(!/It has NO database yet/.test(note), "the designer was told the site has no database at all");

  // AND THE RECOVERY IS RECORDED RATHER THAN SILENT.
  assert.ok(r.sql.some((q) => /INSERT INTO _meta/i.test(q) && /bookings/.test(q))
    || JSON.stringify(r.body).includes("bookings"),
    "the recovered declaration never reached the stored spec");

  // THE CONTROL, AND IT IS THE HALF THAT MAKES THE ASSERTION ABOVE MEAN
  // ANYTHING: the same ask on the same empty `_meta` with NOTHING in the
  // catalog must NOT name `bookings` to the designer. Without it, a note that
  // happened to mention the word for some other reason would pass.
  const blind = await addon("fw-recover-control", "add a function that counts booked repairs", {
    metaMissing: true, kinds: ["function"],
    catalog: { columns: [], grants: [], policies: [], triggers: [] },
    answers: { function: { function: [{ name: "count_booked", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  assert.ok(!/It stores:[^"]*bookings/.test(blind.prompts.map((p) => JSON.stringify(p)).join("\n")),
    "the control named a table that is in neither the spec nor the catalog, so the case above proves nothing");
});

test("a live table that cannot be recovered safely STOPS the step, and says which", async () => {
  // A TABLE WHOSE ACCESS CANNOT BE DERIVED — a member SELECT grant with the
  // policies unreadable. Recovering it would mean guessing between `own` and
  // `members`, which is a live table's access; so it is not recovered, and a
  // spec still missing it must not be designed against.
  const cat = catalogFor("bookings", ["who"]);
  cat.policies = []; // the policies read as empty: `own` and `members` are indistinguishable
  cat.grants = [{ t: "bookings", g: "authenticated", p: "SELECT", lvl: "table", col: "" },
                { t: "bookings", g: "authenticated", p: "INSERT", lvl: "column", col: "who" }];
  const r = await addon("fw-stuck", "add a function that counts booked repairs", {
    metaMissing: true, kinds: ["function"], catalog: cat,
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  assert.equal(r.body.ok, false, "the step designed against a spec missing a live table: " + JSON.stringify(r.body));
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "no-meta");
  assert.equal(r.body.cost, 0, "a stop that could not design cost the customer something");
});

test("a genuinely empty database is still empty — the catalog is what says so", async () => {
  // THE CONTROL, and without it the two cases above would also pass on a route
  // that refused every site with no stored spec. A database provisioned and
  // never applied to has no `_meta` AND no tables, and the first backend
  // addition on such a site must work.
  const r = await addon("fw-reallyempty", "add a table that stores repair bookings", {
    metaMissing: true, publishes: true, kinds: ["table"],
    catalog: { columns: [], grants: [], policies: [], triggers: [] },
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(r.body.ok, true, "an honestly empty database was refused: " + JSON.stringify(r.body));
  assert.ok(r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "repairs"/i.test(q)));
});

test("internal tables are not a disagreement — every site has `_meta`", async () => {
  // `_meta` IS IN THE CATALOG OF EVERY SITE THERE IS. Counting it as a live
  // table the spec does not declare would stop every addon on the platform.
  const r = await addon("fw-internalonly", "add a function that counts booked repairs", {
    kinds: ["function"],
    catalog: { columns: [{ t: "_meta", c: "k", ty: "text" }, { t: "bookings", c: "who", ty: "text" }], grants: [], policies: [], triggers: [] },
    answers: { function: { function: [{ name: "f", returns: "bigint", body: "SELECT 1", internal: true }] } },
  });
  // `bookings` IS declared by the fixture's stored schema, so the only
  // undeclared name in that catalog is `_meta` — and the step must proceed.
  assert.equal(r.body.ok, true, "an internal table was treated as an undeclared one: " + JSON.stringify(r.body));
});

// ─────────────────────────────────────────────────────────────────────────────
// RUN 48: A HAND-OFF SENT BACKWARD IS NOT A MISSING IMPLEMENTATION (2026-09-15)
//
// Owner, after run 48: *"A requirement sent backward to an earlier step is an
// unresolved handoff; that alone does not establish that its implementation is
// missing."*
//
// THE LIVE SHAPE, and it is reproduced here exactly. The picker chose
// `["function","page"]`; `function` runs first in `ADD_KINDS` order, so the
// PAGE step's requirement handed back to `function` named a step that had
// already run and could not have heard it. That was true and was reported
// correctly — and it was then read as the implementation being absent, so the
// customer was told **"Still to do: A new function named
// count_existing_bookings"** about a function that had been created in that
// same change, was live, and answered `3` through the site's own public route
// within the minute of the reply.
//
// Four cases, and the first three are the owner's own list: the late hand-off
// when its function was applied, when it was absent, and when creation failed.
// The fourth is the control that keeps the third honest.
const COUNT_FN = { name: "count_existing_bookings", returns: "bigint", body: "SELECT COUNT(*) FROM bookings" };
const CHECK_PAGE = { path: "/booking-check", name: "Booking Check", purpose: "See the total number of bookings already stored.",
  sections: ["a section header", "a single figure"], components: ["section-header", "stats-band"] };
/** The page step's requirement, handed BACK to the function step. */
const LATE = { need: "A new function named count_existing_bookings that totals rows in the existing bookings table", status: "elsewhere", step: "function" };

test("run 48: a hand-off to a step that already ran, whose function WAS applied, is not 'still to do'", async () => {
  const r = await addon("fw-late-made", "add a page at /booking-check that shows the booking total", {
    kinds: ["function", "page"], publishes: true,
    answers: {
      function: { function: [COUNT_FN] },
      page: { page: [CHECK_PAGE], requirements: [LATE] },
    },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, asserted rather than assumed: the function really was
  // created and the page really shipped. Without both, this case would pass
  // with the fix reverted and prove nothing.
  assert.deepEqual(r.body.functions, ["count_existing_bookings"], "the function was not applied — this case tests nothing");
  assert.deepEqual(r.body.added, ["booking-check.tsx"], "the page was not published — this case tests nothing");
  // THE DEFECT, IN THE CUSTOMER'S OWN SENTENCE. This is the assertion run 48
  // would have failed.
  assert.doesNotMatch(r.body.coverNote, /Still to do/,
    "a hand-off nobody delivered was reported as work that is still to do");
  // THE NAME MAY APPEAR — the can't-confirm clause quotes the need, which
  // contains it, and that is correct. What it may not appear in is a sentence
  // saying the work is outstanding, which is the whole of run 48's defect.
  // RE-ANCHORED 2026-09-15 and it MOVED rather than broke, one clause over.
  // This entry names no `item`, so nothing established that the thing it asks
  // for exists — and the can't-confirm clause opens *"I've set that up"*,
  // which is a claim about work nobody found. The unknown clause says the
  // true thing and still names the need, which is what this line is for.
  assert.doesNotMatch(r.body.coverNote, /I've set that up/,
    "an implementation nobody could find was reported as work that was done");
  assert.match(r.body.coverNote, /can't see from here whether A new function named count_existing_bookings/,
    "the requirement stopped being mentioned to the customer at all");
  const cov = storedAnswer(r, "fw-late-made").coverage;
  // THE TWO ANSWERS, SEPARATE AND BOTH KEPT. The hand-off really did reach
  // nobody and the record says so; the work really is there and the state says
  // that. Collapsing them is the whole defect.
  assert.equal(cov.handoffs.undelivered, 1, "the undelivered hand-off stopped being reported at all");
  assert.equal(cov.counts.missing, 0, "a hand-off nobody delivered was counted as missing work");
  assert.equal(cov.counts.failed, 0, "a hand-off nobody delivered was counted as a failure");
  const late = cov.requirements.find((q) => q.need === LATE.need);
  assert.equal(late.handoff, "undelivered");
  // `unknown`, NOT `found`, and that is the asymmetry working. Run 48's entry
  // names no `item`, so all this layer knows is that the function step made
  // SOMETHING — which would satisfy any request for a function if it were read
  // as `found`. Either answer keeps the customer's sentence honest; only this
  // one is true.
  assert.equal(late.implementation, "unknown");
  assert.equal(late.state, "unknown", "an implementation nobody could find was folded back into `unverified`");
});

test("run 48 with the thing NAMED: the same hand-off resolves against the applied function exactly", async () => {
  // WHAT RUN 48 WILL REPORT once a designer fills in `item` — the reconcile
  // stops being about the kind and becomes one equality against an applied
  // name. The claim it can make is still only that the function was CREATED.
  const r = await addon("fw-late-named", "add a page at /booking-check that shows the booking total", {
    kinds: ["function", "page"], publishes: true,
    answers: {
      function: { function: [COUNT_FN] },
      page: { page: [CHECK_PAGE], requirements: [{ ...LATE, item: "count_existing_bookings" }] },
    },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.functions, ["count_existing_bookings"]);
  const q = storedAnswer(r, "fw-late-named").coverage.requirements.find((x) => x.need === LATE.need);
  assert.equal(q.implementation, "found", "the named function was not matched against the applied one");
  assert.equal(q.implementedBy, "count_existing_bookings", "the record does not say WHICH applied item answered it");
  assert.equal(q.handoff, "undelivered", "the hand-off ledger changed because the implementation was found");
  // AND STILL NOT DELIVERED. An applied function establishes that a function
  // was created and nothing about whether it totals the right rows.
  assert.equal(q.state, "unverified", "existence was promoted to a settled requirement");
  assert.doesNotMatch(r.body.coverNote, /Still to do/);
});

test("run 48's shape with NO function applied: the same hand-off is missing work, and is said", async () => {
  // THE OTHER SIDE, and it is what keeps the fix from being "never say still to
  // do". The page hands the same requirement back and this time the change
  // designed no function at all, so there is nothing of that kind anywhere.
  const r = await addon("fw-late-absent", "add a page at /booking-check that shows the booking total", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [CHECK_PAGE], requirements: [LATE] } },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.functions, undefined, "a function was applied — this case tests nothing");
  assert.match(r.body.coverNote, /Still to do:.*count_existing_bookings/,
    "work that was asked for and never built was not reported");
  const cov = storedAnswer(r, "fw-late-absent").coverage;
  assert.equal(cov.counts.missing, 1, "absent work was not counted as missing");
  const late = cov.requirements.find((q) => q.need === LATE.need);
  assert.equal(late.state, "missing");
  assert.equal(late.implementation, "absent");
  assert.equal(late.handoff, "undelivered", "the hand-off ledger stopped reading the same way");
  // AND THE RECORD DOES NOT NAME A THING IT DID NOT FIND. A sweep survivor:
  // the reader carries the name it SOUGHT out of a miss, which is useful inside
  // it and is a lie on the wire — `implementedBy: "count_existing_bookings"`
  // beside `implementation: "absent"` reads as the function existing.
  assert.equal(late.implementedBy, undefined,
    "an absent implementation was recorded as having been implemented by the thing it was looking for");
});

test("a page that did not survive is missing, and a coverage composed before the publish says so", async () => {
  // TWO SWEEP SURVIVORS, and they are the two halves of one rule: a page is
  // only evidence once it has really shipped.
  //
  // (a) A PAGE THAT WAS ASKED FOR AND DID NOT SURVIVE must not count as the
  //     implementation of a requirement naming it. `aShipped` is the requested
  //     routes LESS the missing ones; dropping that subtraction makes every
  //     planned page read as built, which is the "doing less than was asked
  //     while reporting success" failure this whole path exists to avoid.
  const WANT = { need: "A gallery page shows the work", status: "elsewhere", step: "page", item: "/gallery" };
  const GALLERY = { path: "/gallery", name: "Gallery", purpose: "Show the work.", sections: ["a grid"], components: ["card"] };
  const r = await addon("fw-page-lost", "add a gallery page and a booking check", {
    kinds: ["function", "page"], publishes: true,
    answers: {
      function: { function: [{ ...COUNT_FN, internal: true, body: "BEGIN RETURN 1; END;" }], requirements: [WANT] },
      page: { page: [CHECK_PAGE, GALLERY] },
    },
    // ONLY ONE OF THE TWO IS WRITTEN — `/gallery` never made it through.
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page survived — this case tests nothing");
  const cov = storedAnswer(r, "fw-page-lost").coverage;
  const want = cov.requirements.find((q) => q.need === WANT.need);
  assert.equal(want.implementation, "absent", "a page that did not survive was counted as the work being there");
  assert.equal(want.implementedBy, undefined);
  // THE STEP ALSO FAILED (a page that did not survive IS the page step
  // failing), so the requirement handed to it is BLOCKED rather than missing —
  // and the customer hears the dependency sentence. Both are honest and the
  // distinction is the owner's: this points them at the other part.
  assert.equal(want.state, "blocked", "a page nobody could build read as work simply not done");
  // …AND IT NAMES THE ROUTE, not the step. A SWEEP SURVIVOR: with the missing
  // pages off `aFailedItems` the requirement is still blocked — by the KIND —
  // so the state alone cannot tell the two readings apart, and what a customer
  // can act on is which page it was.
  assert.match(want.why, /\/gallery/, "the blocked page requirement does not name the page: " + want.why);
  assert.ok((cov.applied || []).every((m) => m.name !== "/gallery"),
    "a page that did not survive is in the applied result: " + JSON.stringify(cov.applied));
  assert.ok((cov.applied || []).some((m) => m.kind === "page" && m.name === "/booking-check"),
    "the page that DID survive is missing from the applied result — the control failed");
});

test("a coverage composed before anything published cannot answer `absent` for a page", async () => {
  // (b) THE OTHER HALF. `page` is reportable only once `aShipped` is set, which
  // is below the publish — before that, "no page was applied" and "no page has
  // been applied YET" are the same empty list, and reading the second as the
  // first prints "still to do" over work that had not been attempted.
  //
  // A NEW TABLE IS NEVER PAGELESS, so this reaches the compile and the routing
  // fixture has no container: the run refuses with the publish never reached,
  // which is exactly the state under test.
  const WANT = { need: "A page lists the waiting list", status: "elsewhere", step: "page", item: "/waiting" };
  const r = await addon("fw-page-early", "keep a waiting list and show it", {
    kinds: ["table", "page"],
    answers: {
      table: { table: [{ table: { name: "waitlist", columns: [{ name: "who", type: "text" }] } }], requirements: [WANT] },
      page: { page: [{ path: "/waiting", name: "Waiting", purpose: "Show it.", sections: ["a list"], components: ["card"] }] },
    },
  });
  assert.equal(r.body.error, "compile", JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-page-early").coverage;
  const want = cov.requirements.find((q) => q.need === WANT.need);
  assert.equal(want.implementation, "unknown", "a page step whose publish never ran answered about its own absence");
  // RE-ANCHORED 2026-09-15: `unknown` is its own state now rather than a quiet
  // `unverified`, and this case is exactly why — nothing was published, so
  // nothing was set up, and the clause that says so must not be the one that
  // opens *"I've set that up"*.
  assert.equal(want.state, "unknown");
  assert.equal(cov.counts.missing, 0, "work that was never attempted was reported as work that is not there");
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/,
    "a refused change reported its unattempted pages as still to do: " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote || "", /I've set that up/,
    "a change that published nothing claimed it had set the page up: " + r.body.coverNote);
});

test("run 48's shape when the database REFUSED the function: the dependency is blocked, not merely unchecked", async () => {
  // THE THIRD OF THE OWNER'S THREE. The function step ran and Postgres refused
  // it, so `function` is a failed step — and a requirement handed TO a failed
  // step is waiting on something that did not work, which is a different thing
  // to tell somebody from "we did not do it".
  const r = await addon("fw-late-failed", "add a page at /booking-check that shows the booking total", {
    kinds: ["function", "page"], publishes: true, fnFail: true,
    answers: {
      function: { function: [COUNT_FN] },
      page: { page: [CHECK_PAGE], requirements: [LATE] },
    },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok((r.body.functionErrors || []).length, "the database did not refuse the function — this case tests nothing");
  assert.equal((r.body.functions || []).length, 0, "a refused function was reported as applied");
  const cov = storedAnswer(r, "fw-late-failed").coverage;
  const late = cov.requirements.find((q) => q.need === LATE.need);
  assert.equal(late.state, "blocked", "a requirement whose dependency failed was not separated from one nobody built");
  assert.equal(cov.counts.blocked, 1);
  // AND THE CUSTOMER HEARS WHICH IT IS — the sentence points at the other part
  // of the same change rather than inviting them to ask for the same thing.
  assert.match(r.body.coverNote, /waiting on another part of the same change that didn't work/,
    "a blocked requirement was reported in the words of an unbuilt one");
  // …AND IT IS ONE SENTENCE OR THE OTHER, NEVER BOTH. A sweep survivor: adding
  // `blocked` back into the still-to-do list leaves the clause above intact, so
  // the case passed while the customer was told the same need twice, in two
  // voices that ask for opposite things ("say it again" and "go and look at the
  // other part"). The negative is what makes the distinction load-bearing.
  assert.doesNotMatch(r.body.coverNote, /Still to do/,
    "a blocked need was ALSO reported as work nobody built: " + r.body.coverNote);
});

test("a kind this layer cannot see is UNKNOWN, never missing and never 'set up' — even when it ran", async () => {
  // TWO SWEEP SURVIVORS, CLOSED TOGETHER, and they are the same rule from two
  // sides: **cannot-tell must never read as a value**, this repository's most
  // repeated one, met where the wrong direction tells a customer a shipped
  // section is still to do.
  //
  // `component` is deliberately off `APPLIED_KINDS`: an addition folded into an
  // existing page leaves no item in any applied list, so "nothing of that kind
  // was applied" is what a working component and an absent one BOTH look like.
  // The step really ran here, which is the discriminator — a kind that never ran
  // IS reportable (it made none, definitionally), and that neighbouring case is
  // the control four tests up.
  const NEEDS_SECTION = {
    need: "The page carries a note saying where the total comes from",
    status: "elsewhere", step: "component", item: "SourceNote",
  };
  // RE-ANCHORED 2026-09-17: the fixture placed the section on `/status`, a
  // route this site did not have, and the one-page shortcut swallowed the
  // name and built it on `/`. The case is about `component` being OPAQUE, not
  // about where it lands, so the site is given the page it names rather than
  // the destination being quietly changed — an appeasement that keeps a check
  // green while saying something other than what it meant.
  // …AND RE-ANCHORED AGAIN 2026-09-17, for the second half of the same trap.
  // With the stored pages in the shape a site really holds, this case's page
  // is `changed` rather than a duplicate ADD — so `keptProse` arms, and the
  // DEFAULT written page (a different site's words) loses everything the
  // stored one said. `addedTo` is what an addon really returns: the page as it
  // stands, plus the new thing.
  const r = await addon("fw-unseeable", "add a note under the booking total", {
    kinds: ["function", "component"], publishes: true, sitePages: ["/", "/status"],
    written: [addedTo("/status", "<p>Where the total comes from.</p>")],
    answers: {
      function: { function: [{ ...COUNT_FN, internal: true, body: "BEGIN RETURN 1; END;" }], requirements: [NEEDS_SECTION] },
      component: { component: [{ page: "/status", does: "a line saying where the total comes from", components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-unseeable").coverage;
  assert.ok(cov.ran.includes("component"), "the component step never ran — this case tests nothing");
  assert.ok(!cov.requirements.some((q) => q.state === "missing"),
    "a kind nothing here can speak for was reported as work that is not there");
  const need = cov.requirements.find((q) => q.need === NEEDS_SECTION.need);
  assert.equal(need.handoff, "delivered", "the component step was told and the ledger says otherwise");
  assert.equal(need.implementation, "unknown", "a kind with no applied list answered about its own absence");
  // ── THE OWNER'S "UNOBSERVABLE COMPONENT", IN ITS OWN WORDS (2026-09-15) ──
  //
  // `component` is an `OPAQUE_KIND`: a section folded into an existing page
  // leaves no item in any applied list AND no entry in any site inventory, so
  // NOTHING can establish either presence or absence. The state is `unknown`
  // and the sentence must not be the one that claims the work was done.
  assert.equal(need.state, "unknown", "an unobservable kind was read as work that exists");
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/,
    "a section this layer cannot see was reported as still to do: " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote || "", /I've set that up/,
    "a section nobody can see was reported as work that was done: " + r.body.coverNote);
  assert.match(r.body.coverNote || "", /can't see from here whether The page carries a note/,
    "the unobservable need is not said to the customer at all");
  const cnt = storedAnswer(r, "fw-unseeable").coverage.counts;
  assert.equal(cnt.unknown, 1, "the record has no number for what nobody could see");
  assert.equal(cnt.unverified, 0, "an unobservable need was counted as an established implementation");
});

test("a hand-off FORWARD, to a step that heard it and delivered, stays the control", async () => {
  // THE CONTROL FOR ALL THREE, and it is the shape that already worked: the
  // FUNCTION step hands to `page`, which runs after it, really receives the
  // brief and really ships the route. Nothing about this case may move.
  // THE `item` NAMES THE THING, which is the explicit reference the owner asked
  // for in place of a keyword heuristic — and asserting what it resolves to is
  // what closes TWO sweep survivors: `appliedFacts`' page arm, and the route
  // handing it the pages that really shipped. Without them the page is invisible
  // to the reconciliation and a live route reads as work that is not there.
  const FORWARD = { need: "A page at /booking-check shows the total", status: "elsewhere", step: "page", item: "/booking-check" };
  const r = await addon("fw-late-forward", "add a page at /booking-check that shows the booking total", {
    kinds: ["function", "page"], publishes: true,
    answers: {
      function: { function: [COUNT_FN], requirements: [FORWARD] },
      page: { page: [CHECK_PAGE] },
    },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-late-forward").coverage;
  assert.equal(cov.handoffs.delivered, 1, "a forward hand-off stopped being recorded as delivered");
  assert.equal(cov.handoffs.undelivered, 0);
  const fwd = cov.requirements.find((q) => q.need === FORWARD.need);
  assert.equal(fwd.handoff, "delivered");
  assert.equal(fwd.state, "unverified", "a delivered hand-off to a shipped page claimed more than it can");
  // THE PAGE IT NAMES WAS FOUND IN WHAT REALLY SHIPPED — by kind and by name,
  // not by a word in the sentence. `page` is reportable here (it ran and the
  // publish landed), so an entry that never arrived would read `missing` and the
  // customer would hear "Still to do" about a live route: run 48 exactly.
  assert.equal(fwd.implementation, "found", "the shipped page is invisible to the reconciliation");
  assert.equal(fwd.implementedBy, "/booking-check", "the applied page is not the one the requirement named");
  assert.ok((cov.applied || []).some((m) => m.kind === "page" && m.name === "/booking-check"),
    "a shipped page leaves no applied entry at all: " + JSON.stringify(cov.applied));
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/, "a page that shipped was reported as still to do");
  // AND THE BRIEF REALLY REACHED THE PAGE DESIGNER — the hop, not the intent.
  assert.match(String((promptFor(r, "page") || {}).text || ""), /A page at \/booking-check shows the total/,
    "the hand-off was recorded as delivered without reaching the designer");
});

test("what each designer was SHOWN about the database is recorded, per step, as its input", async () => {
  // ── EVIDENCE GAP A, CLOSED (owner, 2026-09-15) ──────────────────────────
  //
  // *"Recover the actual designer input if it was recorded. Otherwise mark
  // schema receipt unverified and prepare minimal instrumentation for the next
  // test."* **It was not recorded.** The addon stored ONE `site` value, written
  // after the whole kinds loop — so for run 48, whose `function` step ran
  // first, the stored facts had already been rebuilt over that step's own
  // answer. "Did the function designer see `bookings`?" had no stored answer
  // and the run's first demonstration rested on inference.
  //
  // `shownSteps` is the instrumentation: one entry per kind, in run order,
  // taken from the object really handed to that call.
  //
  // THE FUNCTION IS INTERNAL so the change is pageless and needs no container:
  // what is under test is the RECORD of the step's input, and a public function
  // would drag a compile in to prove nothing about it. Run 48's own function
  // was public; that difference is downstream of everything asserted here.
  const r = await addon("fw-shown", "count the bookings we already have", {
    kinds: ["function"],
    answers: { function: { function: [{ name: "count_existing_bookings", internal: true, returns: "bigint", body: "BEGIN RETURN (SELECT COUNT(*) FROM bookings); END;" }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-shown").coverage;
  assert.deepEqual(cov.shownSteps.map((s) => s.kind), ["function"], "the per-step input record is not on the stored coverage");
  const seen = cov.shownSteps[0];
  // THE DEMONSTRATION RUN 48 COULD NOT MAKE: the schema was in front of the
  // step, by name AND by column, as a stored fact rather than an inference.
  assert.deepEqual(seen.tables, ["bookings"]);
  assert.deepEqual(seen.columns.bookings, STORED_SCHEMA.tables[0].columns.map((c) => c.name + " " + c.type));
  assert.equal(seen.hasDatabase, true, "a site with a resolved database was recorded as having none");
  // …AND IT REALLY IS THE SAME PICTURE THE DESIGNER GOT. The digest and the
  // composed note are two readers of one object, and a digest that agreed with
  // nothing would be a second copy of the facts — this repository's own
  // most-repeated defect, in the instrument built to settle a question of fact.
  const text = String((promptFor(r, "function") || {}).text || "");
  assert.ok(text.includes("bookings"), "the designer's own note does not name the table the digest claims it saw");
});

test("the input digest is the step's INPUT, never its output", async () => {
  // THE WALL, and it is the one way this instrument can lie rather than go
  // quiet. `aSite` is a `let` the loop REBUILDS from each kind's own answer, so
  // a digest taken after the await would record what the step PRODUCED wearing
  // the name of what it was shown — and the question being settled is exactly
  // "was this in front of the step", which that answer inverts.
  //
  // Two kinds, and the table designed by the first is the discriminator: the
  // `table` step must not see `waitlist`, and the `function` step must.
  const r = await addon("fw-shown-order", "keep a waiting list and count it", {
    kinds: ["table", "function"],
    answers: {
      table: { table: [{ table: { name: "waitlist", columns: [{ name: "who", type: "text" }] } }] },
      function: { function: [{ name: "count_waiting", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" }] },
    },
  });
  // A NEW TABLE IS NEVER PAGELESS, so this one reaches the compile and the
  // routing fixture has no container. That is fine and is deliberate: the
  // record is written ABOVE the publish precisely so it survives a refusal,
  // which is the property the whole coverage record rests on. The refusal is
  // asserted to be THAT one, so a different failure cannot pass as this.
  assert.equal(r.body.error, "compile", JSON.stringify(r.body));
  assert.match(String(r.body.detail || ""), /container is not available in a routing test/);
  const shown = storedAnswer(r, "fw-shown-order").coverage.shownSteps;
  assert.deepEqual(shown.map((s) => s.kind), ["table", "function"], "the entries are not in run order");
  assert.deepEqual(shown[0].tables, ["bookings"], "the table step was recorded against its own answer");
  assert.deepEqual(shown[1].tables, ["bookings", "waitlist"],
    "the function step's record does not carry the table designed one call earlier");
  // THE CONTROL, so the case above is not satisfied by a digest that is always
  // the baseline: the second entry really moved, and it moved forwards.
  assert.ok(shown[1].tables.length > shown[0].tables.length, "nothing about the picture changed between the two steps");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE THREE REPORTING CASES (owner, 2026-09-15), each driven through the route
// ─────────────────────────────────────────────────────────────────────────────

test("a MIXED-SUCCESS function step blocks only the requirement whose own function failed", async () => {
  // ── ITEM 1 (owner): *"Scope failures to the referenced item and its actual
  // dependencies. One failed function must not block a requirement whose
  // different function applied successfully. Preserve real dependency
  // failures."*
  //
  // `aFailedKinds` is per-KIND, so ONE refused function marked the whole
  // function step failed and every requirement handed to it read `blocked` —
  // including one naming a function Postgres created without complaint. Both
  // halves are asserted here, because a fix that simply stopped blocking would
  // lose the real dependency failure, which is the other half of the ask.
  const OK_NEED = { need: "the page can count what is stored", status: "elsewhere", step: "function", item: "count_ok" };
  const BAD_NEED = { need: "the owner gets a nightly summary", status: "elsewhere", step: "function", item: "count_bad" };
  const r = await addon("fw-mixed-fn", "count what is stored and send me a summary", {
    kinds: ["function", "job"],
    fnFail: "count_bad",
    answers: {
      function: {
        function: [
          { name: "count_ok", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" },
          { name: "count_bad", internal: true, returns: "int", body: "BEGIN RETURN 2; END;" },
        ],
      },
      job: { job: [{ name: "nightly", fn: "count_ok", everyMinutes: 1440, at: "09:00" }], requirements: [OK_NEED, BAD_NEED] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION IS THE WHOLE POINT and is asserted rather than assumed:
  // one function of the two really was created and the other really was
  // refused. Without the mix this case tests nothing at all.
  assert.deepEqual(r.body.functions, ["count_ok"], "both functions applied — this case tests nothing");
  assert.deepEqual((r.body.functionErrors || []).map((e) => e.name), ["count_bad"],
    "the database did not refuse the other one — this case tests nothing");
  const cov = storedAnswer(r, "fw-mixed-fn").coverage;
  const ok = cov.requirements.find((q) => q.need === OK_NEED.need);
  const bad = cov.requirements.find((q) => q.need === BAD_NEED.need);
  // THE FIX: the requirement whose own function is there is not blocked by
  // somebody else's failure, and it claims no more than that the thing exists.
  assert.equal(ok.state, "unverified", "a requirement whose own function applied was blocked by a different one's failure");
  assert.equal(ok.implementation, "found");
  assert.equal(ok.implementedBy, "count_ok");
  assert.equal(ok.foundIn, "applied");
  // AND THE REAL DEPENDENCY FAILURE IS PRESERVED, naming the item rather than
  // the step — which is what a customer can act on.
  assert.equal(bad.state, "blocked", "a requirement whose own function the database refused stopped being blocked");
  assert.match(bad.why, /count_bad/, "the blocked requirement does not name the thing that failed");
  assert.equal(cov.counts.blocked, 1, "the blocked count swept in the requirement that was fine");
  // …AND THE CUSTOMER HEARS BOTH, in the two different sentences they need.
  assert.match(r.body.coverNote, /waiting on another part of the same change that didn't work[^.]*nightly summary/,
    "the failed dependency is not pointed at: " + r.body.coverNote);
  // …AND THE SENTENCE ITSELF NAMES THE ITEM. A SWEEP SURVIVOR: `requirementNote`
  // recomputes the outcomes from its own arguments, so dropping `failedItems`
  // THERE leaves the stored record right and the customer's sentence generic.
  // The two are composed separately and both have to be told.
  assert.match(r.body.coverNote, /count_bad/,
    "the customer's sentence does not name the thing that failed: " + r.body.coverNote);
  assert.match(r.body.coverNote, /can't confirm from here that the page can count what is stored/,
    "the requirement that was fine is not reported as built-and-unchecked: " + r.body.coverNote);
});

test("a function the site ALREADY HAS is not 'still to do' when this change reuses it", async () => {
  // ── ITEM 2 (owner): *"Distinguish 'not added by this change' from 'absent
  // from the site.' Reconcile against trustworthy existing-site evidence as
  // well as applied additions."*
  //
  // The site already declares `count_existing_bookings`; the change adds a page
  // that calls it and CORRECTLY creates no function. `appliedFacts` is
  // therefore silent about it — and reading that silence as absence is run 48's
  // defect wearing a different hat.
  const HAVE = {
    tables: STORED_SCHEMA.tables,
    functions: [{ name: "count_existing_bookings", returns: "bigint", internal: false }],
    apis: [], jobs: [],
  };
  const REUSE = { need: "the page shows the stored booking total", status: "elsewhere", step: "function", item: "count_existing_bookings" };
  const r = await addon("fw-reuse", "add a page showing the booking total", {
    kinds: ["page"], publishes: true, stored: HAVE,
    answers: { page: { page: [CHECK_PAGE], requirements: [REUSE] } },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.functions, undefined, "the change created a function — this case tests reuse, not creation");
  const cov = storedAnswer(r, "fw-reuse").coverage;
  const q = cov.requirements.find((x) => x.need === REUSE.need);
  assert.equal(q.implementation, "found", "a function the site already has was not found at all");
  assert.equal(q.foundIn, "existing", "the record does not distinguish reuse from this change having made it");
  assert.equal(q.implementedBy, "count_existing_bookings");
  assert.equal(q.state, "unverified", "a function the site already has was not read as there-and-unchecked");
  assert.equal(cov.counts.missing, 0, "reuse was counted as work that is not there");
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/,
    "a function the site already has was reported as still to do: " + r.body.coverNote);
  // THE CONTROL, and without it this proves nothing: the SAME change, the SAME
  // requirement, on a site that does NOT declare it — where "not added and not
  // there" is the true answer and must still be said.
  const c = await addon("fw-reuse-control", "add a page showing the booking total", {
    kinds: ["page"], publishes: true,
    answers: { page: { page: [CHECK_PAGE], requirements: [REUSE] } },
    written: [writtenPage("/booking-check")],
  });
  assert.equal(c.body.ok, true, JSON.stringify(c.body));
  const cq = storedAnswer(c, "fw-reuse-control").coverage.requirements.find((x) => x.need === REUSE.need);
  assert.equal(cq.implementation, "absent", "a function neither added nor on the site was not seen as absent");
  assert.equal(cq.state, "missing");
  assert.match(c.body.coverNote, /Still to do: the page shows the stored booking total/,
    "the control lost the real finding: " + c.body.coverNote);
});

test("on a site that already has things of a kind, a requirement naming none of them is UNKNOWN", async () => {
  // THE OTHER HALF OF ITEM 2, and the one that keeps it from over-claiming in
  // the opposite direction. A requirement with no `item` can only ever be
  // answered from emptiness — and that has to be emptiness of BOTH readers.
  // This change makes no function; the site has one; nothing here can say
  // whether THAT function is the one the requirement meant, so "still to do" is
  // a claim nobody is entitled to.
  //
  // THE SHAPE IS A JOB-ONLY CHANGE deliberately: `aReportable` answers TRUE for
  // a kind this change never RAN (it made none, definitionally), so `function`
  // and `qr` are both answerable here and the case is not resting on the route
  // going quiet for some other reason.
  const HAVE = {
    tables: STORED_SCHEMA.tables,
    functions: [{ name: "send_reminder", returns: "void", internal: true }],
    apis: [], jobs: [],
  };
  const VAGUE = { need: "something counts what is stored", status: "elsewhere", step: "function" };
  const CODE = { need: "the poster's code opens the booking page", status: "elsewhere", step: "qr", item: "wifi" };
  // …AND ONE HANDED TO A KIND NOTHING CAN EVER ENUMERATE. This change ran no
  // component step, so `aReportable` answers TRUE for it — "it made none,
  // definitionally" — which for every other kind is enough to say `absent`.
  // `OPAQUE_KINDS` is what stops it here, and it is the whole of what stops it:
  // a section folded into an existing page leaves no item in any list, so a
  // working one and an absent one look identical from here.
  const PART = { need: "the page shows opening hours", status: "elsewhere", step: "component", item: "hours-band" };
  const r = await addon("fw-stocked", "remind them the day before", {
    kinds: ["job"], stored: HAVE,
    look: { qr: [{ name: "wifi", points: "WIFI:S=Fretwork;;", label: "Wi-Fi" }] },
    answers: { job: { job: [JOB], requirements: [VAGUE, CODE, PART] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, asserted rather than assumed: the apply ran (which is what
  // makes the kinds answerable at all) and created no function whatever.
  assert.deepEqual(r.body.functions || [], [], "the change created a function — this case is about one it did NOT create");
  const cov = storedAnswer(r, "fw-stocked").coverage;
  const vague = cov.requirements.find((q) => q.need === VAGUE.need);
  // NOT `missing`: the site has a function and this change made none, and those
  // are two different silences. Only both being empty is evidence of absence.
  assert.equal(vague.implementation, "unknown",
    "a requirement naming no function was answered from this change's silence alone");
  assert.equal(vague.state, "unknown");
  assert.equal(vague.implementedBy, undefined, "an unnamed requirement was credited to some function or other");
  // ── AND THE SITE'S LOOK IS AN INVENTORY TOO ──────────────────────────────
  //
  // `qr` and `three` are the two kinds a site carries by NAME rather than in
  // its schema, so without the stored look this requirement has no reader at
  // all and reads `unknown` — which is honest and is not the answer, because
  // the code is right there on the site.
  const code = cov.requirements.find((q) => q.need === CODE.need);
  assert.equal(code.implementation, "found", "a QR code the site already carries was not found");
  assert.equal(code.foundIn, "existing");
  assert.equal(code.implementedBy, "wifi");
  assert.equal(code.state, "unverified", "an existing QR code was not read as there-and-unchecked");
  // AND THE UNOBSERVABLE KIND, whose only wall is `OPAQUE_KINDS` — this change
  // could report absence for any other kind it never ran.
  const part = cov.requirements.find((q) => q.need === PART.need);
  assert.equal(part.implementation, "unknown",
    "a kind nothing can enumerate was answered `absent` because this change made none of them");
  assert.equal(part.state, "unknown");
  assert.equal(cov.counts.missing, 0, "a site's own contents were counted as work that is not there");
  assert.equal(cov.counts.unknown, 2, "the two silences were not told apart: " + JSON.stringify(cov.counts));
  // THE CUSTOMER HEARS THE TWO DIFFERENT SENTENCES, and neither is "still to do".
  assert.match(r.body.coverNote, /can't see from here whether something counts what is stored/,
    "the unanswerable need is not said as unanswerable: " + r.body.coverNote);
  assert.match(r.body.coverNote, /I've set that up, but I can't confirm from here that the poster's code/,
    "the existing QR code is not said as there-and-unchecked: " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /Still to do/,
    "a site's own contents were reported as still to do: " + r.body.coverNote);
});

test("existing-site evidence is used only where it was really read", async () => {
  // THE THIRD READING OF ITEM 2, and the one that keeps it from over-claiming:
  // *"Where existing presence cannot be established, report unknown — not
  // missing."* The module never assumes an inventory it was not handed, and
  // `existingFacts` derives which kinds it can speak for from what it was
  // really given rather than from a list of its own.
  const spec = { tables: [{ name: "bookings" }], functions: [{ name: "count_it" }], apis: [], jobs: [] };
  const full = existingFacts({ spec, pages: ["/", "/menu"], look: { qr: [{ name: "wifi", points: "x", label: "Wi-Fi" }], three: "a globe" } });
  assert.deepEqual(full.kinds.slice().sort(), ["api", "function", "job", "page", "qr", "table", "three"],
    "the enumerable kinds are not the ones the caller supplied");
  assert.ok(full.items.some((m) => m.kind === "function" && m.name === "count_it"));
  assert.ok(full.items.some((m) => m.kind === "page" && m.name === "/menu"));
  assert.ok(full.items.some((m) => m.kind === "qr" && m.name === "wifi"));
  assert.ok(full.items.some((m) => m.kind === "three" && m.name === "three"),
    "a site's one scene has no entry, so a requirement handed to `three` can never resolve");
  // NOTHING HANDED OVER MEANS NOTHING CLAIMED — the conservative default, and
  // the answer an unchanged caller keeps.
  assert.deepEqual(existingFacts(), { items: [], kinds: [] });
  assert.deepEqual(existingFacts({ pages: [] }), { items: [], kinds: ["page"] },
    "an empty page list is a READ that found nothing, not a reader that stayed silent");
  // AND IT CANNOT CLAIM A KIND THE RECONCILIATION DOES NOT BELIEVE A SITE HOLDS:
  // `kinds` is intersected with `SITE_KINDS`, so the two cannot drift apart.
  for (const k of full.kinds) assert.ok(SITE_KINDS.includes(k), k + " is enumerated and is not a SITE_KIND");
  for (const k of OPAQUE_KINDS) assert.ok(!full.kinds.includes(k), k + " is unobservable and was enumerated anyway");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SAME EVIDENCE RULES FOR `covered` (owner, 2026-09-15)
//
// *"Do not let the model's covered label substitute for implementation
// evidence … reconcile both covered and elsewhere against the same item-level
// results and existing-site evidence. Keep handoff tracking separate."*
//
// Both cases the owner named are driven here through the real route, on the
// stored outcomes AND on the customer's own sentence. The three `elsewhere`
// cases above are the control set and are untouched.
// ─────────────────────────────────────────────────────────────────────────────

test("a COVERED claim in a mixed-success function step is judged on its OWN function", async () => {
  // ── THE FIRST COMPLAINT, IN THE OWNER'S OWN WORDS: *"covered + from:function
  // + an unrelated function failure still becomes failed, even when the
  // referenced function applied."*
  //
  // The kind-wide rule (`the owning step is in `failed`` → failed) had no scope
  // at all for `covered`: `from` is stamped with the step that ANSWERED the
  // claim, so one refused function condemned every claim the function step made
  // — including one naming a function Postgres created without complaint, and
  // the customer was told it was still to do.
  //
  // THREE CLAIMS, ONE STEP, THREE ANSWERS, and all three are needed: without
  // the second the fix could be "stop blocking", and without the third it could
  // be "stop reading the step's failure at all".
  // RE-ANCHORED 2026-09-15: a `covered` reference is `{kind, item}` now, and
  // the kind is DECLARED rather than taken from `from` or searched for by name
  // — see the two collision cases below. Both of these name their own step's
  // kind, which the tool asks for explicitly *including* in that case.
  const OK = { need: "the page can count what is stored", status: "covered", by: "count_ok returns the number", item: "count_ok", kind: "function" };
  const BAD = { need: "the owner gets a nightly summary", status: "covered", by: "count_bad totals the day", item: "count_bad", kind: "function" };
  const VAGUE = { need: "the numbers are right", status: "covered", by: "the counting is done in the database" };
  const r = await addon("fw-covered-mixed", "count what is stored and send me a summary", {
    kinds: ["function"],
    fnFail: "count_bad",
    answers: {
      function: {
        function: [
          { name: "count_ok", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" },
          { name: "count_bad", internal: true, returns: "int", body: "BEGIN RETURN 2; END;" },
        ],
        requirements: [OK, BAD, VAGUE],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITIONS, asserted rather than assumed — one function really
  // created, the other really refused, and all three claims stamped with the
  // step that answered them. Without the mix this case tests nothing.
  assert.deepEqual(r.body.functions, ["count_ok"], "both functions applied — this case tests nothing");
  assert.deepEqual((r.body.functionErrors || []).map((e) => e.name), ["count_bad"],
    "the database did not refuse the other one — this case tests nothing");
  const cov = storedAnswer(r, "fw-covered-mixed").coverage;
  const at = (need) => cov.requirements.find((q) => q.need === need);
  for (const q of [at(OK.need), at(BAD.need), at(VAGUE.need)]) {
    assert.equal(q.from, "function", "the claim is not stamped with the step that answered it");
    assert.equal(q.handoff, undefined, "a claim that asked nobody for anything was given a hand-off verdict");
  }
  // THE FIX: the claim whose own function is there is judged on that function.
  assert.equal(at(OK.need).state, "unverified",
    "a covered claim whose own function applied was condemned by a different one's failure");
  assert.equal(at(OK.need).implementation, "found");
  assert.equal(at(OK.need).implementedBy, "count_ok");
  assert.equal(at(OK.need).foundIn, "applied");
  // AND THE REAL DEPENDENCY FAILURE IS PRESERVED, naming the item — a `covered`
  // claim resting on a function the database refused is waiting on the same
  // broken part a hand-off would be, so it points at that part rather than
  // inviting the customer to ask for the same thing again.
  assert.equal(at(BAD.need).state, "blocked", "a covered claim whose own function was refused stopped being blocked");
  assert.match(at(BAD.need).why, /count_bad/, "the blocked claim does not name the thing that failed");
  // …AND THE KIND-WIDE RULE SURVIVES FOR A CLAIM THAT NAMES NOTHING. The step
  // failed and this claim gives nothing to judge on its own, so the step's
  // failure is the only evidence there is about it — and it is the claiming
  // step's own failure, which is `failed` rather than `blocked`.
  assert.equal(at(VAGUE.need).state, "failed",
    "a covered claim by a step that failed, resting on nothing, was let through");
  assert.match(at(VAGUE.need).why, /function step could not do its part/);
  assert.deepEqual(
    [cov.counts.blocked, cov.counts.failed, cov.counts.unverified],
    [1, 1, 1],
    "the three claims were not told apart: " + JSON.stringify(cov.counts));
  // ── AND THE CUSTOMER HEARS THREE DIFFERENT SENTENCES ─────────────────────
  const note = r.body.coverNote || "";
  assert.match(note, /Still to do: the numbers are right/,
    "the claim with nothing behind it is not reported outstanding: " + note);
  assert.doesNotMatch(note, /Still to do[^.]*nightly summary/,
    "a blocked dependency was said as work to ask for again: " + note);
  assert.doesNotMatch(note, /Still to do[^.]*count what is stored/,
    "the claim whose function applied was reported as still to do: " + note);
  assert.match(note, /waiting on another part of the same change that didn't work[^.]*nightly summary/,
    "the failed dependency is not pointed at: " + note);
  assert.match(note, /count_bad/, "the customer's sentence does not name the thing that failed: " + note);
  assert.match(note, /can't confirm from here that the page can count what is stored/,
    "the claim whose function applied is not said as built-and-unchecked: " + note);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE NAME COLLISION, BOTH DIRECTIONS (owner, 2026-09-15)
//
// *"covered references now lose their kind. implementationOf searches all kinds
// by name, and brokenAny similarly ignores kind."* Two failures, reproduced at
// the module before either was fixed and driven through the route here:
//
//   1. applied table `bookings`, no function `bookings` — a covered requirement
//      FOR THAT FUNCTION got `implementation: found` and *"I've set that up."*
//   2. applied table `bookings`, FAILED function `bookings` — a covered
//      requirement FOR THE TABLE got `blocked`.
//
// `bookings` is the ordinary name for both a table and the function that counts
// it, so this is the shape a real change meets rather than a contrived one.
// ─────────────────────────────────────────────────────────────────────────────

/** The table both cases apply, and the function name that collides with it. */
const CLASH = { name: "bookings", access: "user", columns: [{ name: "who", type: "text" }] };
/** A site with no schema of its own, so `bookings` is a real ADDITION rather
 *  than an extension of `STORED_SCHEMA`'s table of the same name — and so the
 *  only `bookings` anywhere is the one this change applies. */
const NO_SCHEMA = { tables: [], functions: [], apis: [], jobs: [] };

test("COLLISION 1: an applied TABLE does not answer a claim about a FUNCTION of the same name", async () => {
  // The claim names `bookings` and says it is a FUNCTION. The change applies a
  // TABLE called `bookings` and no function at all.
  const FN = {
    need: "the page can count what is stored", status: "covered",
    by: "the bookings function returns the number", item: "bookings", kind: "function",
  };
  // THE MIRROR, IN THE SAME RUN AND ON THE SAME NAME — without it this case
  // could pass with the lookup broken in the other direction, and the whole
  // point is that the KIND is what separates them.
  const TBL = {
    need: "bookings are stored", status: "covered",
    by: "the bookings table holds them", item: "bookings", kind: "table",
  };
  const r = await addon("fw-clash-kind", "store bookings and count them", {
    kinds: ["table"], publishes: true, stored: NO_SCHEMA,
    answers: { table: { table: [{ table: CLASH }], requirements: [FN, TBL] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: the table really applied and no function did. Without the
  // mix there is nothing for a name to collide with.
  assert.deepEqual(r.body.tables, ["bookings"], "the table did not apply — this case tests nothing");
  assert.deepEqual(r.body.functions || [], [], "a function applied — this case is about one that did NOT");
  const cov = storedAnswer(r, "fw-clash-kind").coverage;
  const at = (need) => cov.requirements.find((q) => q.need === need);
  // THE FIX: the table is not the function, however the names read.
  assert.notEqual(at(FN.need).implementation, "found",
    "an applied table answered a claim about a function of the same name");
  assert.equal(at(FN.need).implementedBy, undefined, "the claim was credited to a thing of another kind");
  assert.notEqual(at(FN.need).state, "unverified",
    "a claim about a function nothing made was read as there-and-unchecked");
  // AND THE MIRROR RESOLVES, which is what proves the reader is alive rather
  // than simply refusing everything.
  assert.equal(at(TBL.need).implementation, "found", "the claim about the table it really applied was not resolved");
  assert.equal(at(TBL.need).implementedBy, "bookings");
  assert.equal(at(TBL.need).foundIn, "applied");
  // ── AND THE CUSTOMER'S OWN SENTENCE, which is where the defect was visible ──
  const note = r.body.coverNote || "";
  assert.doesNotMatch(note, /I've set that up[^.]*can count what is stored/,
    "the customer was told a function nothing made was set up: " + note);
  assert.match(note, /can count what is stored/,
    "the claim nothing backs is not reported to the customer at all: " + note);
});

test("COLLISION 2: a FAILED function does not block a claim about a TABLE of the same name", async () => {
  // The database refuses a function called `bookings`; the table `bookings`
  // applies. A claim about the TABLE must not go down with the function.
  const TBL = {
    need: "bookings are stored", status: "covered",
    by: "the bookings table holds them", item: "bookings", kind: "table",
  };
  const FN = {
    need: "the page can count what is stored", status: "covered",
    by: "the bookings function returns the number", item: "bookings", kind: "function",
  };
  const r = await addon("fw-clash-fail", "store bookings and count them", {
    kinds: ["table", "function"], publishes: true, fnFail: "bookings", stored: NO_SCHEMA,
    answers: {
      table: { table: [{ table: CLASH }] },
      function: {
        function: [{ name: "bookings", internal: true, returns: "bigint", body: "BEGIN RETURN 1; END;" }],
        requirements: [TBL, FN],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITIONS, both asserted: the table applied and the function was
  // really refused BY NAME. Either missing and the collision cannot arise.
  assert.deepEqual(r.body.tables, ["bookings"], "the table did not apply — this case tests nothing");
  assert.deepEqual((r.body.functionErrors || []).map((e) => e.name), ["bookings"],
    "the database did not refuse the function — this case tests nothing");
  const cov = storedAnswer(r, "fw-clash-fail").coverage;
  const at = (need) => cov.requirements.find((q) => q.need === need);
  // THE FIX: the failed dependency is matched on `{kind, name}`, so the table's
  // claim is judged on the table.
  assert.notEqual(at(TBL.need).state, "blocked",
    "a claim about an applied table was blocked by a function of the same name");
  assert.equal(at(TBL.need).implementation, "found");
  assert.equal(at(TBL.need).implementedBy, "bookings");
  // AND THE REAL DEPENDENCY FAILURE SURVIVES, which is the half a fix that
  // simply stopped blocking would have thrown away.
  assert.equal(at(FN.need).state, "blocked", "the claim whose own function was refused stopped being blocked");
  assert.match(at(FN.need).why, /bookings/, "the blocked claim does not name the thing that failed");
  assert.equal(cov.counts.blocked, 1, "the blocked count swept in the claim that was fine: " + JSON.stringify(cov.counts));
  // ── THE CUSTOMER HEARS ONE AND NOT THE OTHER ─────────────────────────────
  const note = r.body.coverNote || "";
  assert.match(note, /waiting on another part of the same change that didn't work[^.]*can count what is stored/,
    "the failed dependency is not pointed at: " + note);
  assert.doesNotMatch(note, /waiting on another part[^.]*bookings are stored/,
    "the table's claim was reported as waiting on the function's failure: " + note);
});

test("an item the ENGINE dropped whole is a named dependency, not a whole kind failing", async () => {
  // A SWEEP SURVIVOR, and the one writer of `aFailedKinds` that had nothing on
  // the failed-ITEM list. A function the database refuses is reported by name
  // (`functionErrors`); a function the ENGINE will not build is dropped WHOLE —
  // no field to point at, no statement issued, nothing in `functionErrors` —
  // and the kind was failing wholesale off it. So a claim naming the dropped
  // thing and a claim naming the one that applied were the same verdict.
  //
  // `returns: "setof nowhere"` is the engine's own drop: a return type naming a
  // table nobody declared, measured rather than contrived.
  const GONE = { need: "the page can list what is stored", status: "covered", by: "list_things returns the rows", item: "list_things", kind: "function" };
  const KEPT = { need: "the page can count what is stored", status: "covered", by: "count_ok returns the number", item: "count_ok", kind: "function" };
  const r = await addon("fw-unbuilt", "list and count what is stored", {
    kinds: ["function"],
    answers: {
      function: {
        function: [
          { name: "count_ok", internal: true, returns: "int", body: "BEGIN RETURN 1; END;" },
          { name: "list_things", internal: true, returns: "setof nowhere", body: "BEGIN RETURN; END;" },
        ],
        requirements: [GONE, KEPT],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: one function really applied, the other really vanished —
  // and it vanished WITHOUT an error, which is what makes it a different
  // failure from a refusal and is why it needed its own reader.
  assert.deepEqual(r.body.functions, ["count_ok"], "both functions were built — this case tests nothing");
  assert.deepEqual((r.body.functionErrors || []).map((e) => e.name), [],
    "the engine's drop arrived as a database error — this case is about the silent one");
  const rec = storedAnswer(r, "fw-unbuilt");
  assert.deepEqual(rec.coverage.unbuilt, { function: ["list_things"] },
    "the engine did not drop it whole — this case tests nothing: " + JSON.stringify(rec.coverage.unbuilt));
  const at = (need) => rec.coverage.requirements.find((q) => q.need === need);
  assert.equal(at(GONE.need).state, "blocked", "a claim on a function the engine dropped was not tied to it");
  assert.match(at(GONE.need).why, /list_things/, "the blocked claim does not name the thing that was dropped");
  assert.equal(at(KEPT.need).state, "unverified",
    "a claim whose own function was built went down with the one that was dropped");
  assert.match(r.body.coverNote || "", /waiting on another part of the same change that didn't work[^.]*list what is stored/,
    "the dropped dependency is not pointed at: " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/,
    "a dropped dependency was said as work to ask for again: " + r.body.coverNote);
});

test("a COVERED claim about a section nobody can see is UNKNOWN, never 'I've set that up'", async () => {
  // ── THE SECOND COMPLAINT: *"covered + no implementation evidence still
  // produces 'I've set that up.'"* A `covered` entry skipped the implementation
  // reader entirely and fell through to `unverified`, whose sentence opens with
  // exactly that — so the model's own label was the only thing behind a claim
  // that work existed.
  //
  // `component` is the sharpest shape for it: an addition folded into an
  // existing page leaves no item in any applied list AND no entry in any site
  // inventory (`OPAQUE_KINDS`), so NOTHING here can establish presence or
  // absence. The honest answers are `unknown` and the can't-SEE sentence.
  const SECTION = {
    need: "visitors can see where the total comes from", status: "covered",
    by: "a card band under the booking total", item: "SourceNote", kind: "component",
  };
  // THE CONTROL, and the case is vacuous without it: the SAME step, the SAME
  // status, a claim naming something this change really applied. It must move —
  // otherwise "everything is unknown now" would pass, which is a stamp and not
  // a reader.
  //
  // RE-ANCHORED 2026-09-15, AND IT IS NOW THE FEATURE'S OWN DEMONSTRATION. The
  // claim declares `kind: "function"` while `from` is `component`, which is the
  // owner's *"Allow covered requirements to name a different implementation
  // kind explicitly; the authoring step alone cannot identify it."* The lookup
  // is neither the step nor a search by name across every kind — it is the
  // declared identity, and the two collision cases below are what that buys.
  const BACKED = {
    need: "the number on the page is the stored total", status: "covered",
    by: "count_existing_bookings reads the bookings table",
    item: "count_existing_bookings", kind: "function",
  };
  const r = await addon("fw-covered-unseen", "add a note under the booking total", {
    kinds: ["function", "component"], publishes: true,
    answers: {
      function: { function: [{ ...COUNT_FN, internal: true, body: "BEGIN RETURN 1; END;" }] },
      component: {
        component: [{ page: "/", does: "a line saying where the total comes from", components: ["card"] }],
        requirements: [SECTION, BACKED],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-covered-unseen").coverage;
  // THE PRECONDITIONS: the component step really ran (so this is not the route
  // going quiet for some other reason), the function really applied (so the
  // control has something to find), and both claims are stamped `component`.
  assert.ok(cov.ran.includes("component"), "the component step never ran — this case tests nothing");
  assert.deepEqual(r.body.functions, ["count_existing_bookings"], "the control's function did not apply");
  const at = (need) => cov.requirements.find((q) => q.need === need);
  assert.equal(at(SECTION.need).from, "component");
  assert.equal(at(BACKED.need).from, "component");
  // THE FIX: the label buys nothing. Nothing applied carries that name, no
  // inventory can list a section, so this layer cannot say either way.
  assert.equal(at(SECTION.need).implementation, "unknown",
    "an unobservable kind answered about its own absence");
  assert.equal(at(SECTION.need).state, "unknown", "a covered label was read as work that exists");
  assert.equal(at(SECTION.need).implementedBy, undefined,
    "a claim nothing could resolve was credited to something");
  // …AND IT IS NEVER `missing` EITHER. `OPAQUE_KINDS` is the whole of what
  // stops that: this change ran the component step, and for any other kind a
  // named item nothing applied would read as absent.
  assert.equal(cov.counts.missing, 0, "a section nothing can enumerate was reported as work that is not there");
  // THE CONTROL MOVED: same step, same status, an item this change applied.
  assert.equal(at(BACKED.need).implementation, "found", "an applied item named by a covered claim was not found");
  assert.equal(at(BACKED.need).implementedBy, "count_existing_bookings");
  assert.equal(at(BACKED.need).foundIn, "applied");
  // …AND HAND-OFF TRACKING STAYS SEPARATE (the owner's own last sentence).
  // Reconciling `covered` against the same results must not give it a hand-off
  // verdict: it asked nobody for anything, so `delivered`/`undelivered` would
  // be an answer to a question this requirement never posed.
  assert.equal(at(BACKED.need).handoff, undefined, "a claim that asked nobody for anything was given a hand-off verdict");
  assert.equal(at(SECTION.need).handoff, undefined, "a claim that asked nobody for anything was given a hand-off verdict");
  assert.deepEqual(cov.handoffs, { delivered: 0, undelivered: 0 },
    "two covered claims were counted in the hand-off ledger: " + JSON.stringify(cov.handoffs));
  assert.equal(at(BACKED.need).state, "unverified",
    "a covered claim resolved against a real applied item was not read as there-and-unchecked");
  assert.deepEqual([cov.counts.unknown, cov.counts.unverified], [1, 1],
    "the two silences were not told apart: " + JSON.stringify(cov.counts));
  // ── AND THE CUSTOMER'S OWN WORDS, which is where the complaint was made ──
  const note = r.body.coverNote || "";
  assert.match(note, /can't see from here whether visitors can see where the total comes from/,
    "the unresolvable claim is not said as unresolvable: " + note);
  assert.doesNotMatch(note, /I've set that up[^.]*where the total comes from/,
    "a covered label with nothing behind it still claims the work was set up: " + note);
  assert.doesNotMatch(note, /Still to do/,
    "a section this layer cannot see was reported as still to do: " + note);
  assert.match(note, /I've set that up, but I can't confirm from here that the number on the page/,
    "the control's claim is not said as there-and-unchecked: " + note);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE EVIDENCE LOOKUP'S OWN BYPASS (owner, 2026-09-16)
//
// *"The original two collisions are fixed. One bypass remains:
// claimEvidence(r.by, made) still searches every applied kind … Carry the
// explicit kind + name identity through the evidence lookup too. Evidence from
// another item must not turn an unknown implementation into configured,
// unverified, or delivered. Missing or ambiguous references must not regain
// certainty through an unrestricted prose match."*
//
// The identity reached `implementationOf` and stopped there. `claimEvidence`
// went on reading `by` against the WHOLE of `made`, so whenever the exact
// question had no answer a prose match about a different thing supplied one:
//
//   1. an implementation nobody could see, rescued to `unverified` by an
//      applied item of another kind that the sentence happens to name;
//   2. an implementation that WAS found, whose recorded `configuredBy` came off
//      a different item entirely.
//
// Both are driven below through `POST /api/site/<slug>/addon`, each with the
// positive control that makes the reader alive rather than merely refusing.
// ─────────────────────────────────────────────────────────────────────────────

test("BYPASS: an applied TABLE does not rescue a claim whose reference nobody can see", async () => {
  // THE OWNER'S OWN REPRODUCTION. An applied table `bookings`; a covered claim
  // whose reference is `{kind: "component", item: "bookings"}` — unseeable by
  // construction (`OPAQUE_KINDS`) — and a `by` that names `bookings`. The
  // implementation reads `unknown`, and the unscoped prose match then found the
  // TABLE, answered `named`, and the customer heard *"I've set that up."*
  const SECTION = {
    need: "the total is shown on the page", status: "covered",
    by: "bookings shows the total", item: "bookings", kind: "component",
  };
  // THE MATCHING-ITEM POSITIVE CONTROL, in the SAME reply and against the SAME
  // applied table and the SAME name — so the only thing that differs is the
  // reference's kind. Without it, "the haystack is always empty" would pass.
  const TBL = {
    need: "bookings are stored", status: "covered",
    // DELIBERATELY NAMING NO GUARANTEE — the applied table's own settings are
    // `user`/`own` and its one column is `who`, and a sentence brushing any of
    // those would answer `configured` and make this control about the wrong
    // half. What it has to prove is that the scoped haystack is NOT empty, and
    // `unverified` off the name alone proves exactly that.
    by: "bookings keeps every booking", item: "bookings", kind: "table",
  };
  const r = await addon("fw-ev-scope", "store bookings and show the total", {
    kinds: ["table", "component"], publishes: true, stored: NO_SCHEMA,
    answers: {
      table: { table: [{ table: CLASH }] },
      component: {
        component: [{ page: "/", does: "a line with the booking total", components: ["card"] }],
        requirements: [SECTION, TBL],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: the table really applied, under the name both claims use.
  // Without it there is nothing for a prose match to reach and this case is
  // asserting about an empty `made`.
  assert.deepEqual(r.body.tables, ["bookings"], "the table did not apply — this case tests nothing");
  const cov = storedAnswer(r, "fw-ev-scope").coverage;
  const at = (need) => cov.requirements.find((q) => q.need === need);
  // THE FIX: the claim is weighed against the thing it NAMED, which nothing
  // here can see — so the answer stays `unknown` however the sentence reads.
  assert.equal(at(SECTION.need).implementation, "unknown",
    "an unobservable reference answered about its own presence");
  assert.equal(at(SECTION.need).state, "unknown",
    "an applied table rescued a claim about a component of the same name");
  assert.equal(at(SECTION.need).implementedBy, undefined,
    "the claim was credited to a thing of another kind");
  assert.equal(at(SECTION.need).configuredBy, undefined,
    "another item's configuration was recorded against this claim");
  // THE CONTROL MOVED, on the same name and the same applied item: it is the
  // REFERENCE that decides, not the prose and not a blanket refusal.
  assert.equal(at(TBL.need).implementation, "found", "the claim naming the applied table was not resolved");
  assert.equal(at(TBL.need).implementedBy, "bookings");
  assert.equal(at(TBL.need).foundIn, "applied");
  assert.equal(at(TBL.need).state, "unverified");
  assert.deepEqual([cov.counts.unknown, cov.counts.unverified], [1, 1],
    "the two claims were not told apart: " + JSON.stringify(cov.counts));
  // ── AND THE CUSTOMER'S OWN SENTENCE, which is where the owner read it ────
  const note = r.body.coverNote || "";
  assert.doesNotMatch(note, /I've set that up[^.]*the total is shown on the page/,
    "the customer was told a component nothing can see was set up: " + note);
  assert.match(note, /can't see from here whether the total is shown on the page/,
    "the unresolvable claim is not said as unresolvable: " + note);
  assert.match(note, /I've set that up, but I can't confirm from here that bookings are stored/,
    "the control's claim is not said as there-and-unchecked: " + note);
});

test("BYPASS: a claim's recorded configuration comes off the item it REFERENCES, never another", async () => {
  // THE SECOND FACE OF THE SAME BYPASS, and the one that puts a wrong fact on
  // the record rather than a wrong state: the reference resolves perfectly, and
  // `configuredBy` is then read off whichever applied item the sentence happens
  // to mention. Here the prose names both the table and the function, and only
  // the FUNCTION carries a setting the words match (`internal`).
  const BOTH = "bookings is kept, and count_rows is internal";
  const TBL = { need: "bookings are stored", status: "covered", by: BOTH, item: "bookings", kind: "table" };
  // THE CONTROL: the SAME sentence, referencing the function instead. The
  // configuration is real and must still be recorded — the fix is about WHICH
  // item answers, not about recording less.
  const FN = { need: "no visitor can count them", status: "covered", by: BOTH, item: "count_rows", kind: "function" };
  const r = await addon("fw-ev-item", "store bookings and count them privately", {
    kinds: ["table", "function"], publishes: true, stored: NO_SCHEMA,
    answers: {
      table: { table: [{ table: CLASH }] },
      function: {
        function: [{ name: "count_rows", internal: true, returns: "bigint", body: "BEGIN RETURN 1; END;" }],
        requirements: [TBL, FN],
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITIONS: both really applied, or there is no "another item" for
  // the evidence to come from and the case proves nothing.
  assert.deepEqual(r.body.tables, ["bookings"], "the table did not apply — this case tests nothing");
  assert.deepEqual(r.body.functions, ["count_rows"], "the function did not apply — this case tests nothing");
  const cov = storedAnswer(r, "fw-ev-item").coverage;
  const at = (need) => cov.requirements.find((q) => q.need === need);
  // BOTH references resolve — this case is NOT about an unfound implementation.
  assert.equal(at(TBL.need).implementedBy, "bookings");
  assert.equal(at(FN.need).implementedBy, "count_rows");
  // THE FIX: the table's claim is weighed against the table alone, which
  // carries no setting these words name, so it is there-and-unchecked with
  // nothing borrowed from the function beside it.
  assert.equal(at(TBL.need).configuredBy, undefined,
    "the function's setting was recorded against the table's claim: " + JSON.stringify(at(TBL.need)));
  assert.equal(at(TBL.need).state, "unverified",
    "another item's configuration promoted a claim about the table");
  // THE CONTROL: the same sentence, referencing the function, still records the
  // setting that really holds of it.
  assert.equal(at(FN.need).configuredBy, "count_rows: internal",
    "the referenced item's own configuration stopped being recorded");
  assert.equal(at(FN.need).state, "configured");
  assert.equal(cov.counts.configured, 1,
    "the configured count swept in the claim that borrowed it: " + JSON.stringify(cov.counts));
  // AND THE CUSTOMER HEARS THE SAME SENTENCE FOR BOTH, deliberately: the
  // difference is on the record, where it is actionable, and `configured` and
  // `unverified` are one thing to say to a person.
  const note = r.body.coverNote || "";
  assert.match(note, /can't confirm from here that/, "neither claim reached the customer: " + note);
  for (const n of [TBL.need, FN.need]) assert.ok(note.includes(n), "the customer was not told about: " + n);
});

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONE 1: FRONTEND CONTEXT AND HAND-OFFS (owner, 2026-09-17)
//
// *"Give addon designers and the page writer the relevant current-site
// information … Distinguish existing custom components from new components to
// build … Pass newly planned frontend items to subsequent designers, as we
// already do for backend declarations."*
//
// And the instruction that shaped every case below: ***"Demonstrate those
// through the real addon route with mocked external dependencies, checking
// designer inputs, generated directives, stored results, and the response."***
// So each of these reads the REQUEST the designer really received
// (`promptFor`), the REQUEST the page writer really received (`pagePrompt`),
// the stored developer record, and the reply the customer is told — never a
// module's return value and never the source.
// ─────────────────────────────────────────────────────────────────────────────

/** A page addition, in the shape `cleanAdd("page")` accepts. */
const GALLERY = { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] };

test("a component placed on a page THIS change is adding lands on that page, and is not moved to the home page", async () => {
  // ── REPRODUCTION A, the owner's own (2026-09-17) ────────────────────────
  //
  // *"New /gallery + component targeting /gallery becomes a directive placing
  // it on the home page."* Measured at the cleaner before the fix, on the
  // one-page site every site on this platform starts as:
  //
  //     component { page: "/gallery" }  ->  ACCEPTED, page "/"
  //
  // The section was built on the FRONT page and the customer was told it had
  // been added. `page` runs before `component` in `ADD_KINDS` and nothing
  // crossed between them, so the second designer had never heard of the page
  // the first had just decided on.
  const r = await addon("fw-plan-comp", "add a gallery page with a grid of photographs, and a caption block on it", {
    kinds: ["page", "component"], publishes: true,
    written: [writtenPage("/"), writtenPage("/gallery")],
    answers: {
      page: { page: [GALLERY] },
      component: { component: [{ page: "/gallery", does: "a caption under the grid", components: ["card"], where: "below the grid" }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // 1. THE DESIGNER'S INPUT. The component designer is told the page exists
  //    and told it is not there YET — both halves, because a designer that
  //    reads it as live goes looking for source to copy.
  const seen = promptFor(r, "component");
  assert.ok(seen, "the component designer never ran");
  assert.match(seen.text, /ALSO adding/, "the component designer was not told about the planned page: " + seen.text.slice(0, 900));
  assert.match(seen.text, /\/gallery/, "the planned route never reached the component designer");
  assert.match(seen.text, /do not exist yet/, "the planned page was presented as one the site already has");

  // 2. THE GENERATED DIRECTIVE. The page call's brief is where the placement
  //    becomes an instruction, and it is the exact thing that said "/" before.
  const page = pagePrompt(r);
  assert.ok(page, "the page writer never ran");
  assert.ok(page.text.includes("On /gallery"), "the directive does not place the section on the planned page: "
    + page.text.slice(page.text.indexOf("The component you are adding"), page.text.indexOf("The component you are adding") + 400));

  // 3. THE STORED RESULT and 4. THE RESPONSE: the page really shipped, and
  //    nothing was refused for want of a destination.
  assert.ok((r.body.added || []).some((f) => String(f).includes("gallery")), "the gallery page was not added: " + JSON.stringify(r.body.added));
  assert.equal(r.body.notAdded, undefined, "something was left out: " + JSON.stringify(r.body.notAdded));
  assert.ok(!(storedAnswer(r, "fw-plan-comp").coverage.requirements || []).some((q) => q.state === "missing"));
});

test("a component placed on a route NOBODY is adding is refused by name, on a one-page site and a many-page one alike", async () => {
  // THE CONTROL FOR THE CASE ABOVE, and it is what makes the hand-off a
  // hand-off rather than a widening: a destination that is neither a page the
  // site has nor a page this change is adding is still `no-page`. Without it,
  // "the component landed on /gallery" is satisfied by a cleaner that accepts
  // any route at all.
  const r = await addon("fw-plan-nope", "add a gallery page, and a caption block on the prices page", {
    kinds: ["page", "component"],
    answers: {
      page: { page: [GALLERY] },
      component: { component: [{ page: "/prices", does: "a caption", components: ["card"] }] },
    },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.reason, "no-page", JSON.stringify(r.body));
  assert.match(r.body.msg, /which page/, "the customer was not told what was wrong: " + r.body.msg);
});

test("a QR code pointing at a page THIS change is adding is drawn, not refused as a page the site does not have", async () => {
  // ── REPRODUCTION B, the owner's own (2026-09-17) ────────────────────────
  //
  // *"New /gallery + QR pointing to /gallery fails with no-such-page."* One
  // message, one addition, the obvious thing to ask for — and the code was
  // refused about a page the same reply was building. The ONE publish is what
  // makes the destination real rather than hoped for: the page and the code go
  // out together or neither does.
  const r = await addon("fw-plan-qr", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true,
    written: [writtenPage("/"), writtenPage("/gallery")],
    answers: {
      page: { page: [GALLERY] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // 1. THE DESIGNER'S INPUT: the QR designer was told the route and the
  //    address, which is the pair its never-invent rule needs.
  const seen = promptFor(r, "qr");
  assert.ok(seen, "the QR designer never ran");
  assert.match(seen.text, /ALSO adding/, "the QR designer was not told about the planned page");
  assert.match(seen.text, /\/gallery/, "the planned route never reached the QR designer");

  // 2. THE RESPONSE: the code is on the site's look, resolved against the
  //    site's own address rather than left as a bare route.
  assert.ok((r.body.moved || []).includes("qr"), "the code was not stored on the look: " + JSON.stringify(r.body.moved));
  assert.equal(r.body.notAdded, undefined, "the code was refused: " + JSON.stringify(r.body.notAdded));

  // 3. THE GENERATED DIRECTIVE: the page call is told the binding exists, so
  //    a page can actually show the code.
  const page = pagePrompt(r);
  assert.match(page.text, /SITE_QRS/, "the page writer was not told the code exists: " + page.text.slice(0, 1200));
});

test("a QR code pointing at a route NOBODY is adding is still refused by name", async () => {
  // THE CONTROL for the case above — the same shape, one route different.
  const r = await addon("fw-plan-qr-nope", "add a gallery page and a QR code for the prices page", {
    kinds: ["page", "qr"],
    answers: {
      page: { page: [GALLERY] },
      qr: { qr: { name: "prices", points: "/prices", label: "Our prices" } },
    },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.reason, "no-such-page", JSON.stringify(r.body));
});

test("the page writer is shown this site's OWN components with their source, and is not told to write them again", async () => {
  // Owner: *"Give … the page writer … imported custom component
  // implementations"* and *"Distinguish existing custom components from new
  // components to build."*
  //
  // MEASURED BEFORE THE FIX: `look.tsx` is the cumulative DECLARATION list, so
  // a component written months ago and sitting in `source/<slug>/parts.json`
  // was listed under "## Components to build — the kit does not have these and
  // this site needs them, so you write them", with a one-line `does` and
  // nothing else. The writer had never seen `TideChart` and was asked to
  // produce it.
  const SOURCE = "export default function TideChart({ rows }: { rows: number[] }) { return <svg data-slot=\"tide\">{rows.length}</svg> }";
  const r = await addon("fw-parts-shown", "add a note under the tide chart", {
    kinds: ["component"], publishes: true,
    parts: [{ name: "tide-chart", source: SOURCE }],
    look: { tsx: [{ name: "tide-chart", does: "draws the tide", props: "rows" }, { name: "catch-log", does: "lists the day's catch", props: "entries" }] },
    answers: { component: { component: [{ page: "/", does: "a note under the chart", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const page = pagePrompt(r);
  assert.ok(page, "the page writer never ran");

  // THE COMPONENT THAT EXISTS: its real source, under a heading that says so.
  assert.match(page.text, /Components this site already has/, "the writer was not shown the site's own components: " + page.text.slice(0, 1500));
  assert.ok(page.text.includes(JSON.stringify(SOURCE).slice(1, -1)), "the component's real source did not reach the writer");
  // AND THE ONE NOBODY HAS WRITTEN: still under "to build", because it is not
  // in the store. Both halves, or the split is a filter rather than a
  // distinction.
  assert.match(page.text, /Components to build/, "the undeclared component lost its block");
  const build = page.text.slice(page.text.indexOf("Components to build"));
  assert.ok(build.includes("catch-log"), "a declared component with no file was not offered to be built");
  assert.ok(!build.includes("tide-chart"), "a component the site already has was offered to be written again: " + build.slice(0, 700));

  // AND THE DESIGNER IS TOLD THE SAME DISTINCTION, in names rather than bytes.
  const seen = promptFor(r, "component");
  assert.match(seen.text, /already written: tide-chart/, "the designer was not told which components really exist: " + seen.text.slice(0, 900));
  assert.match(seen.text, /nothing has written yet: catch-log/, "the designer was not told which are only declared");
});

test("a returned component may replace one the writer WAS shown, and may not replace one it was not", async () => {
  // Owner: *"Preserve unrelated components and prevent replacement of an
  // existing component whose source the writer was never shown."*
  //
  // `mergeParts` replaces by name and has no wall of its own, so a returned
  // `TideChart` overwrote the real file whatever the model had in front of it.
  // The ordinary case is that every stored component IS in the prompt; this is
  // the honest answer to `partsSent`'s bound, which withholds one too large to
  // carry.
  const BIG = "// " + "x".repeat(MAX_PART_CHARS + 10);
  const SMALL = "export default function Small(){ return <p>small</p> }";
  const r = await addon("fw-parts-wall", "change the chart's caption", {
    kinds: ["component"], publishes: true,
    parts: [{ name: "huge-thing", source: BIG }, { name: "small-thing", source: SMALL }],
    // BOTH ARE ALSO DECLARED ON THE LOOK, which is the ordinary state of a site
    // that has them — and it is what makes the "to build" filter observable: a
    // filter keyed on what was SHOWN would put `huge-thing` back under
    // "Components to build" and ask for exactly the rewrite the wall refuses.
    look: { tsx: [{ name: "huge-thing", does: "a huge thing", props: "none" }, { name: "small-thing", does: "a small thing", props: "none" }] },
    writtenParts: [
      { name: "huge-thing", source: "export default function Huge(){ return <p>rewritten from a description</p> }" },
      { name: "small-thing", source: "export default function Small(){ return <p>edited</p> }" },
    ],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE PRECONDITION, asserted rather than assumed: the writer really was
  // shown one and really was not shown the other. Without this the wall could
  // be refusing everything and every assertion below would still pass.
  const page = pagePrompt(r);
  assert.ok(page.text.includes("small</p>"), "the small component's source was not shown — this case tests nothing");
  assert.ok(!page.text.includes("x".repeat(200)), "the huge component's source WAS shown — this case tests nothing");
  assert.match(page.text, /too long to include here: huge-thing/, "a withheld component was not named to the writer");
  // AND NEITHER IS OFFERED TO BE BUILT, though both are declared on the look:
  // one because its source is right there, the other because it exists and
  // could not be carried. A filter keyed on what was shown would fail here.
  const build = page.text.indexOf("Components to build");
  assert.ok(build < 0 || !page.text.slice(build).includes("huge-thing"),
    "a component too long to show was offered to be written from its description: " + page.text.slice(build, build + 600));

  // THE WALL: the one it could not see is kept, the one it could see is taken.
  assert.deepEqual(r.body.keptParts, ["huge-thing"], "the wall did not hold: " + JSON.stringify(r.body.keptParts));
  const stored = JSON.parse(r.store.store.get("source/fw-parts-wall/parts.json"));
  const by = Object.fromEntries(stored.map((p) => [p.name, p.source]));
  assert.equal(by["huge-thing"], BIG, "a component the writer never saw was replaced from its own description");
  assert.match(by["small-thing"], /edited/, "a component the writer WAS shown could not be changed");

  // AND THE CUSTOMER IS TOLD, in the server's own sentence — composed here for
  // `coverNote`'s reason and printed verbatim by the browser, so this IS what
  // the person reads rather than a second composer's idea of it.
  assert.match(r.body.keptPartsNote || "", /^I left huge-thing exactly as it is/, "the customer was not told: " + r.body.keptPartsNote);
  assert.match(r.body.keptPartsNote, /Ask me to change it on its own/, "the sentence does not say what to do about it");
});

test("the page writer is shown the theme, the site's own stylesheet and the kit signatures its pages already use", async () => {
  // Owner: *"theme/CSS context"* and *"required kit signatures"*. The addon
  // rules tell every designer to keep the site's design system, and nothing in
  // its inputs said what that system IS; `plan.components` was the union of
  // what THIS change declares, so a writer editing a page built from
  // `<Accordion>` got that component's props only by luck.
  const SHEET = ".fretwork-rule { border-top: 1px solid var(--border) }";
  // A REAL STORED PAGE that imports a kit component, because "the signatures
  // its pages already use" is a claim about what the source IMPORTS and
  // nothing shorter can state it.
  //
  // `seat-map` AND `open-now` ARE BOTH COMPONENTS THAT REALLY CARRY A
  // SIGNATURE, which is the whole of what makes this case worth anything. The
  // first draft used `accordion` and `card`, and BOTH are among the 72 standard
  // shadcn primitives whose props the signature scan cannot read — so
  // `siteComponentApi` answers "" for each, the words appear in the cached
  // system block anyway, and every assertion passed with the fix reverted. A
  // vacuous assertion, caught by running the case against the pre-change
  // product rather than by reading it.
  const HOME = {
    path: "index.tsx",
    source: "import { createFileRoute } from '@tanstack/react-router'\n"
      + "import { SeatMap } from '@/components/ui/seat-map'\n"
      + "export const Route = createFileRoute('/')({ component: Home })\n"
      + "function Home(){ return <main><SeatMap seats={[]} onSelect={() => {}} /></main> }\n",
  };
  const r = await addon("fw-look", "add a note under the hero", {
    kinds: ["component"], publishes: true, storedPages: [HOME],
    // A DECLARATION AND NO STORED FILE — RE-ANCHORED 2026-09-17, and the old
    // expectation was the conflation this round removes. It read: the site has
    // no `parts.json`, `loadSiteParts` answers `null`, and the note keeps its
    // old sentence. But "there is no such object" is a read that SUCCEEDED and
    // found nothing, which is a fact about the site and not a cannot-tell — so
    // the honest answer is that `tide-chart` is declared and nothing has
    // written it, which is exactly what `look.tsx` means. The cannot-tell case
    // is a read that THROWS, and it has its own case below.
    look: { theme: "harbour-slate", tsx: [{ name: "tide-chart", does: "draws the tide", props: "rows" }] }, css: SHEET,
    answers: { component: { component: [{ page: "/", does: "a note saying when we are open", components: ["open-now"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const page = pagePrompt(r);
  assert.match(page.text, /theme is \*\*harbour-slate\*\*/, "the writer was not told the theme: " + page.text.slice(0, 1500));
  assert.ok(page.text.includes("fretwork-rule"), "the writer was not shown the site's own stylesheet");
  assert.match(page.text, /ALREADY APPLIED/, "the stylesheet was offered without saying it is already in force");

  // THE KIT SIGNATURES: `card` because THIS change named it, and `accordion`
  // because the page being edited already imports it. The second is the one
  // that was missing — asserted with the first beside it, so a plan that
  // carried neither could not pass either.
  const sig = page.text.slice(page.text.indexOf("THE COMPONENTS THIS SITE NEEDS"));
  assert.ok(sig, "the signature block is absent: " + page.text.slice(0, 600));
  assert.ok(sig.includes("SeatMap("), "the writer was not shown the props of a component the page it is editing imports: " + sig.slice(0, 900));
  assert.ok(sig.includes("OpenNow("), "the addition's own component lost its signature: " + sig.slice(0, 900));

  // AND THE DESIGNER, in names: the theme it must keep, and that a sheet exists.
  const seen = promptFor(r, "component");
  assert.match(seen.text, /theme is harbour-slate/, "the designer was not told the theme: " + seen.text.slice(0, 900));
  assert.match(seen.text, /stylesheet written for it/, "the designer was not told the site carries its own stylesheet");
  assert.match(seen.text, /components its design declares and nothing has written yet: tide-chart/,
    "a declaration with no file was reported as a component the site has: " + seen.text.slice(0, 900));
  assert.doesNotMatch(seen.text, /already written/,
    "a site with no stored component was said to have one");
});

// ─────────────────────────────────────────────────────────────────────────────
// TWO GAPS IN MILESTONE 1, EACH REPRODUCED THROUGH THIS ROUTE FIRST (2026-09-17)
//
// Owner, on the milestone: *"Component-source read failure bypasses the new
// guard … Distinguish a successfully read empty inventory from an unreadable
// one. Do not permit an unseen replacement because the inventory read failed.
// Use a consistent source snapshot and demonstrate failure followed by recovery
// through the route, asserting stored component bytes and the customer
// response."* And: *"Planned-page dependencies need a final check … One publish
// does not establish that both requested items exist."*
//
// Both were reproduced before either was touched, and a third came out of the
// first reproduction: with BOTH reads failing, `mergeParts(null, [one])`
// answers `[one]`, so every other component on the site was deleted.
// ─────────────────────────────────────────────────────────────────────────────

/** The real component's bytes, so "was this replaced" is an exact question. */
const REAL_TIDE = "export default function TideChart({ rows }: { rows: number[] }) { return <svg data-slot=\"tide\">{rows.length}</svg> }";
const REAL_LOG = "export default function CatchLog() { return <ul data-slot=\"log\" /> }";
const REWRITE = "export default function TideChart(){ return <p>rewritten from a one-line description</p> }";
const TWO_PARTS = [{ name: "tide-chart", source: REAL_TIDE }, { name: "catch-log", source: REAL_LOG }];
/** What `source/<slug>/parts.json` really holds after a run, by name. */
const storedParts = (r, slug) => {
  const raw = r.store.store.get("source/" + slug + "/parts.json");
  return Object.fromEntries(JSON.parse(raw || "[]").map((p) => [p.name, p.source]));
};
/** The stored look, as `patchSiteConfig` left it. */
const storedLook = (r, slug) => {
  const raw = r.store.store.get("config/" + slug + ".json");
  try { return JSON.parse(raw).look; } catch { return null; }
};
/**
 * ONE PAGE'S SOURCE AS THE SITE NOW HOLDS IT — `source/<slug>/pages.json`, the
 * key `saveSiteSource` writes and the next revise reads.
 *
 * A THIRD CLAIM, not a second: `changed` is what the route SAYS it published,
 * `compiledPages` is what it HANDED the builder, and this is what the site is
 * left with. A change that reached the compiler and not the store is a site
 * that serves the new page and offers the old one to the next edit.
 *
 * ABSENT ANSWERS `""` RATHER THAN THROWING, so a case asserting a string is
 * NOT in it cannot pass by the file being missing — the observer has to be
 * alive for the negative to mean anything.
 */
const storedSource = (r, slug, path) => {
  const raw = r.store.store.get("source/" + String(slug).toLowerCase() + "/pages.json");
  try {
    const hit = JSON.parse(raw || "[]").find((p) => p && p.path === path);
    return hit ? String(hit.source) : "";
  } catch { return ""; }
};

test("a component store that could not be read replaces nothing, and the next request recovers", async () => {
  // ── THE REPRODUCTION ─────────────────────────────────────────────────────
  //
  // The first read throws. Before the fix: `partsSent` got `null`, so `shown`
  // and `withheld` were both empty; the writer was shown no source AND handed
  // the stored DECLARATION under "Components to build"; the wall had nothing
  // to refuse; and the merge's own second read — minutes later, and it
  // succeeded — let the rewrite replace the real file with no `keptParts` and
  // no sentence.
  const fail = await addon("fw-unreadable", "change the tide chart's caption", {
    kinds: ["component"], publishes: true, partsFail: 1, parts: TWO_PARTS,
    look: { tsx: [{ name: "tide-chart", does: "draws the tide", props: "rows" }] },
    writtenParts: [{ name: "tide-chart", source: REWRITE }],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(fail.body.ok, true, JSON.stringify(fail.body));

  // THE BYTES, WHICH IS THE ASSERTION THAT MATTERS. The customer's own
  // component is on disk exactly as it was, and so is the one this request
  // never mentioned.
  const after = storedParts(fail, "fw-unreadable");
  assert.equal(after["tide-chart"], REAL_TIDE, "a component the writer was never shown was replaced");
  assert.equal(after["catch-log"], REAL_LOG, "a component nobody asked about was changed");

  // AND THE WRITER WAS NOT INVITED TO WRITE IT. This is the half a bytes check
  // cannot see: the wall could refuse the rewrite and the prompt could still be
  // telling the model that a component the site already has does not exist.
  const page = pagePrompt(fail);
  assert.ok(!page.text.includes("data-slot=\\\"tide\\\"") && !page.text.includes("rows.length"),
    "source we could not read was shown anyway");
  const build = page.text.indexOf("Components to build");
  assert.ok(build < 0 || !page.text.slice(build).includes("tide-chart"),
    "a component the site already has was offered to be written: " + page.text.slice(Math.max(0, build), build + 400));
  // LINE BREAKS COLLAPSED BEFORE MATCHING, because a prompt is hand-wrapped and
  // where a line breaks is spelling. The first draft of this assertion looked
  // for "could not be loaded for this request" and went red on correct output:
  // the wrap falls between "could not be" and "loaded". Assert the property,
  // not the spelling — including the invisible half of it. `page.text` is the
  // JSON BODY of the request, so a newline in the prompt is the two characters
  // `\` and `n` here and `\s` does not touch it.
  const flat = page.text.replace(/\\n/g, " ").replace(/\s+/g, " ");
  assert.match(flat, /could not be loaded for this request/, "the writer was not told the components exist and were not loaded");
  assert.match(flat, /You have not been shown any of them and you do not know their names/, "the writer was not told it is missing the names");
  assert.match(flat, /do NOT return anything in `parts` at all/, "the writer was not told to return no components");

  // AND THE CUSTOMER HEARS IT, IN ITS OWN WORDS. Not the too-long sentence —
  // that one tells them to ask for the component on its own, which is advice
  // about a bound and is wrong about a store that failed to read.
  assert.deepEqual(fail.body.unseenParts, ["tide-chart"], "the refused component is not named on the wire");
  assert.equal(fail.body.keptParts, undefined, "a store that could not be read was reported as a component too long to carry");
  assert.match(fail.body.keptPartsNote || "", /^I couldn't load the components your site already has/, fail.body.keptPartsNote);
  assert.match(fail.body.keptPartsNote, /Ask me for that bit again/, "the sentence does not say what to do about it");
  assert.doesNotMatch(fail.body.keptPartsNote, /too long/, "the wrong refusal's sentence was used");

  // AND THE DESIGNERS' NOTE DOES NOT CLAIM THE SITE HAS NONE. `siteNote` reads
  // `parts: null` as "not asked" and keeps the sentence it has always had; an
  // empty ARRAY there is a claim — "its design declares these and nothing has
  // written them" — which is false of a site whose store we could not read, and
  // is what a sweep survivor found. Cannot-tell must never read as a value, in
  // the one input a designer is told to copy an existing component from.
  const said = promptFor(fail, "component");
  assert.match(said.text, /parts written for it: tide-chart/, "the designer was told which components the site has: " + said.text.slice(0, 900));
  assert.doesNotMatch(said.text, /nothing has written yet/, "a store that could not be read was reported as a site with no components");
  assert.doesNotMatch(said.text, /already written/, "a store that could not be read was reported as a site with components");

  // ── AND THE RECOVERY, WHICH IS THE CONTROL ───────────────────────────────
  //
  // The same site, the same ask, the same returned rewrite — with the read
  // working. Without this the fix could be "never accept a component" and every
  // assertion above would still pass.
  const ok = await addon("fw-unreadable", "change the tide chart's caption", {
    kinds: ["component"], publishes: true, parts: TWO_PARTS,
    look: { tsx: [{ name: "tide-chart", does: "draws the tide", props: "rows" }] },
    writtenParts: [{ name: "tide-chart", source: REWRITE }],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  const back = storedParts(ok, "fw-unreadable");
  assert.equal(back["tide-chart"], REWRITE, "the rewrite was refused although the store read fine");
  assert.equal(back["catch-log"], REAL_LOG, "the component nobody mentioned did not survive the merge");
  assert.equal(ok.body.unseenParts, undefined, "a working read reported a refusal");
  assert.equal(ok.body.keptPartsNote, undefined, "a working read said something to the customer");
  assert.ok(pagePrompt(ok).text.includes("rows.length"), "the writer was not shown the component it was asked to change");
});

test("a component store that fails BOTH times keeps every component the request never mentioned", async () => {
  // THE THIRD FINDING, and it is the expensive one: `mergeParts(null, [one])`
  // answers `[one]`, so before the fix a second failed read plus any returned
  // component DELETED every other component on the site — none of them named
  // in the request, and nothing anywhere saying so.
  const r = await addon("fw-unreadable2", "change the tide chart's caption", {
    kinds: ["component"], publishes: true, partsFail: 9, parts: TWO_PARTS,
    look: { tsx: [{ name: "tide-chart", does: "draws the tide", props: "rows" }] },
    writtenParts: [{ name: "tide-chart", source: REWRITE }],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const after = storedParts(r, "fw-unreadable2");
  assert.deepEqual(Object.keys(after).sort(), ["catch-log", "tide-chart"], "a component the request never mentioned was deleted");
  assert.equal(after["tide-chart"], REAL_TIDE, "the unseen component was replaced");
  assert.equal(after["catch-log"], REAL_LOG, "the bystander component's bytes moved");
});

test("a new QR code that would open a page the writer did not return is not published, and is said", async () => {
  // Owner: *"With page + QR, plan /gallery but have the writer return only the
  // homepage. The route currently persists the QR targeting /gallery,
  // publishes, and reports the page missing afterward."* Reproduced exactly:
  // the code was stored pointing at `https://<site>/gallery`, `moved` claimed
  // `qr`, and the only thing the customer heard was that the page had not made
  // it. A QR is the one thing here somebody PRINTS.
  //
  // RE-ANCHORED 2026-09-17: with the stored pages in the shape a site really
  // holds, the home page here is `changed` rather than a duplicate ADD, so
  // `keptProse` arms and a returned page carrying another site's words is
  // refused before any of this is reached. `addedTo` is what an addon really
  // returns for a page that already exists.
  const r = await addon("fw-qr-gone", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", "<p>See our gallery.</p>")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, ASSERTED RATHER THAN ASSUMED: the page really did not
  // survive. Without it a run where the writer quietly returned both pages
  // would pass this case with the fix deleted.
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");

  // NOTHING IS STORED. The look is written before the compile — the container
  // bakes `/qr-gallery.svg` from it — so a code dropped here never becomes a
  // file, never becomes a binding, and never reaches a printer.
  const look = storedLook(r, "fw-qr-gone");
  assert.ok(!look || !(look.qr && look.qr.length), "a QR code opening a page that is not there was published: " + JSON.stringify(look && look.qr));
  assert.deepEqual(r.body.moved, [], "the reply claims it gave the site a QR code it did not");
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");
  // AND NO PAGE WAS WITHHELD, which is what makes this the NARROW case: the
  // home page does not render the code, so the only dependent thing is the
  // code itself and the rest of the change ships. Without this the case cannot
  // be told apart from the withholding one below.
  assert.equal(r.body.heldPages, undefined, "a page that does not show the code was withheld anyway");
  assert.deepEqual(r.body.changed, ["index.tsx"], "the independent half of the change did not ship: " + JSON.stringify(r.body.changed));

  // AND BOTH SENTENCES, beside each other: the page, and what went with it.
  assert.match(r.body.coverNote, /\/gallery didn't make it through/, r.body.coverNote);
  assert.match(r.body.coverNote, /I didn't add the QR code gallery/, r.body.coverNote);
  assert.match(r.body.coverNote, /a code that opens nothing is worse than no code at all/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /I've left/, "a page nobody withheld was reported as withheld");
});

test("a page whose only change was showing that code is withheld with it, and neither is published", async () => {
  // ⚠ THIS CASE IS THE OPPOSITE OF THE ONE IT REPLACES, AND THAT IS THE POINT.
  // It used to read "a QR code a shipped page really renders is kept and
  // warned about" and it ASSERTED THE DEFECT AS CORRECT (owner, 2026-09-17:
  // *"Remove the exception that publishes a newly added QR pointing to a
  // missing planned page merely because a generated page renders it… A warning
  // does not complete the dependency."*).
  //
  // The reasoning behind the old behaviour was sound and its conclusion was
  // not: dropping the code alone WOULD take `SITE_QRS.gallery` out from under
  // a page that renders it. The answer is not to ship the broken code — it is
  // to withhold the page too, so what goes out is the version already serving.
  // Nothing is deleted from a live page; the binding is never introduced.
  //
  // PROVED RED AGAINST THE PRE-CHANGE PRODUCT: before the fix this ran
  // `ok: true` with the code stored pointing at `https://<site>/gallery`.
  const shows = (p) => ({ ...p, source: p.source.replace("<h1>", "<img src={SITE_QRS.gallery.src} /><h1>") });
  const r = await addon("fw-qr-held", "add a gallery page and a QR code on the home page that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/", "/about"],
    // THE HOME PAGE SHOWS THE CODE AND `/about` DOES NOT, so the withholding
    // can be seen to be PER PAGE rather than a whole-change refusal — which is
    // the difference between "withhold the dependent changes together" and
    // "throw the customer's other work away".
    written: [shows(addedTo("/", "<p>Scan for the gallery.</p>")), addedTo("/about", "<p>Since 1998.</p>")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery", page: "/" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");

  // THE CODE IS NOT PUBLISHED. The look is written before the compile — the
  // container bakes `/qr-gallery.svg` from it — so nothing reaches a printer.
  const look = storedLook(r, "fw-qr-held");
  assert.ok(!look || !(look.qr && look.qr.length), "the broken destination was saved: " + JSON.stringify(look && look.qr));
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");
  assert.deepEqual(r.body.moved, [], "the reply claims it gave the site a QR code it did not");

  // …AND THE HOME PAGE IS NOT BROKEN, because what ships is the version that
  // was already serving. Read off what really went to the compiler, never off
  // a field: `SITE_QRS` must appear nowhere in it.
  assert.deepEqual(r.body.heldPages, ["index.tsx"], "the page that renders the dropped code was published anyway");
  assert.ok(!(r.body.changed || []).includes("index.tsx"), "the withheld page is still reported as changed");
  const out = compiledPages(r);
  const home = out.find((p) => p.path === "index.tsx");
  assert.ok(home, "the home page is not in the published site at all: " + JSON.stringify(out.map((p) => p.path)));
  assert.doesNotMatch(home.source, /SITE_QRS/, "the published home page carries a binding for a code that does not exist");
  assert.equal(home.source, storedPage("/").source, "the home page is not the version the site was already serving");

  // …AND THE INDEPENDENT HALF STILL SHIPS. Withholding is per page, not a
  // refusal of the whole change: `/about` never mentioned the code.
  assert.ok((r.body.changed || []).includes("about.tsx"), "an unrelated page was withheld too: " + JSON.stringify(r.body.changed));
  const about = out.find((p) => p.path === "about.tsx");
  assert.match(about.source, /Since 1998/, "the independent change did not reach the published site");

  // AND ALL THREE SENTENCES, because they are three facts: the page did not
  // make it, the code went with it, and a page they expected to change did not.
  assert.match(r.body.coverNote, /\/gallery didn't make it through/, r.body.coverNote);
  assert.match(r.body.coverNote, /I didn't add the QR code gallery/, r.body.coverNote);
  assert.match(r.body.coverNote, /I've left \/ as it was/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /don't print it until the page is there/,
    "the customer was told to please not print a code we had just made — the reported defect");
});

test("a page this change never touched is not withheld, however its source reads", async () => {
  // ⚠ `wrote` IS THE PAGES THIS CHANGE WROTE, and nothing else. A sweep mutant
  // widening it to the whole site survived every other case, because no fixture
  // had a STORED page mentioning a binding — and this platform really can leave
  // one: `qr forget` and the edit lanes can take a code off a site while a page
  // keeps the binding it was written with.
  //
  // Under the mutant that untouched page is withheld and NAMED, so the customer
  // is told "I've left /flyer as it was" about a page nobody proposed to change.
  const stale = { path: "flyer.tsx", source: storedPage("/flyer").source.replace("<h1>", "<img src={SITE_QRS.gallery.src} /><h1>") };
  const r = await addon("fw-qr-untouched", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, storedPages: [storedPage("/"), stale],
    written: [addedTo("/", "<p>See our gallery.</p>")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the code was published anyway");
  // THE PRECONDITION, ASSERTED: the stale page really does carry the binding,
  // so the only thing keeping it out of `withheld` is the scope.
  assert.match(stale.source, /SITE_QRS\s*\.\s*gallery/, "the fixture does not render the code, so the scope is untested");
  assert.equal(r.body.heldPages, undefined, "a page this change never touched was withheld: " + JSON.stringify(r.body.heldPages));
  assert.doesNotMatch(r.body.coverNote, /I've left/, "a page nobody proposed to change was reported as left as it was");
  // …AND IT IS STILL IN THE SITE, exactly as it was.
  const live = compiledPages(r).find((p) => p.path === "flyer.tsx");
  assert.equal(live && live.source, stale.source, "an untouched page's bytes moved");
});

test("a CUSTOM COMPONENT that shows the dead code is withheld with it, and never reaches the site", async () => {
  // ⚠ THE DEFECT THE OWNER REPORTED STILL REPRODUCING (2026-09-17). The first
  // cut of this withholding read `wrote` — the PAGES this change wrote — and a
  // component is not a page: a site's own components live at
  // `src/routes/-parts/<name>.tsx` and travel in their own list. So a change
  // whose QR binding sat in a COMPONENT dropped the code, published the
  // component, and the site compiled a build referencing `SITE_QRS.gallery`
  // for a code that does not exist.
  //
  // MEASURED through this route before the fix: `ok: true`, `heldPages
  // undefined`, and the stored `parts.json` carrying `SITE_QRS.gallery.src`
  // in `qr-banner`. That is a dead build published on purpose.
  const r = await addon("fw-qr-part", "add a gallery page and a QR banner component with a code that opens it", {
    kinds: ["page", "qr", "component"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", "<p>See the banner.</p>")],
    writtenParts: [{ name: "qr-banner", source: "export function QrBanner(){return <img src={SITE_QRS.gallery.src} alt=\"scan\" />}" }],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
      component: { component: [{ page: "/", does: "a QR banner", components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, ASSERTED RATHER THAN ASSUMED: the page really did not
  // survive, so the code really is dead. Without it a run where the writer
  // returned both pages passes this case with the fix deleted.
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");

  // THE COMPONENT IS NAMED AND IS NOT WRITTEN. Two readers, because they are
  // two claims: `heldParts` is what the route SAYS it withheld, and the store
  // is what the site really holds afterwards.
  assert.deepEqual(r.body.heldParts, ["qr-banner"], "the component carrying the dead binding was published: " + JSON.stringify(r.body.heldParts));
  const parts = r.store.store.get("source/fw-qr-part/parts.json");
  assert.equal(parts, undefined, "a component list was written for a change whose only component was withheld: " + parts);

  // …AND IT NEVER REACHED THE COMPILER EITHER. A route that kept the file on
  // its list and sent it anyway satisfies every assertion about the reply.
  const files = (r.compiles[0] && r.compiles[0].body && r.compiles[0].body.files) || {};
  for (const [path, src] of Object.entries(files)) {
    assert.doesNotMatch(String(src), /SITE_QRS/, "the compiled site carries a binding for a code that does not exist, in " + path);
  }
  assert.deepEqual(Object.keys(files).filter((k) => /-parts\//.test(k)), [], "the withheld component was handed to the compiler: " + JSON.stringify(Object.keys(files)));

  // …AND THE INDEPENDENT HALF STILL SHIPS: the home page never mentioned the
  // code, so withholding is per FILE here exactly as it is per page.
  assert.deepEqual(r.body.changed, ["index.tsx"], "the independent half of the change did not ship: " + JSON.stringify(r.body.changed));

  // AND THE SENTENCE IS THE ONE FOR A COMPONENT THIS CHANGE WAS ADDING —
  // "I've left it as it was" is false of something that never existed.
  assert.match(r.body.coverNote, /I haven't written the qr-banner section/, r.body.coverNote);
  assert.match(r.body.coverNote, /it was there to show that code/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /I've left the qr-banner section/, "a component that never existed was reported as left alone");
});

test("a component the SITE ALREADY HAS reverts rather than vanishing, and its importer still ships", async () => {
  // ⚠ A SWEEP SURVIVOR, AND IT IS THE ROUTE'S WIRING RATHER THAN THE MODULE'S.
  // `deadQrs` decides `added` from what it is HANDED, and the route is the only
  // thing that looks the name up in `aPartsRead.parts` — so a mutant marking
  // every returned component `added: true` lived past every module case, which
  // hands that flag in by hand.
  //
  // It costs two things at once: the customer is told the section was never
  // written, about one the site keeps serving; and the component joins the
  // "will not exist" set, so a page importing it is withheld for a file that is
  // right there.
  const had = { name: "qr-banner", source: "export function QrBanner(){return <div>Scan</div>}" };
  const posters = writtenPage("/posters");
  const uses = {
    ...posters,
    source: posters.source
      .replace("import { createFileRoute", "import { QrBanner } from '@/routes/-parts/qr-banner'\nimport { createFileRoute")
      .replace("<h1>", "<QrBanner /><h1>"),
  };
  const r = await addon("fw-qr-revert", "put the gallery code in the banner and add a posters page", {
    kinds: ["page", "qr", "component"], publishes: true, sitePages: ["/"], parts: [had],
    look: { tsx: [{ name: "qr-banner", does: "the banner", props: "none" }] },
    written: [uses],
    writtenParts: [{ name: "qr-banner", source: "export function QrBanner(){return <img src={SITE_QRS.gallery.src} alt=\"scan\" />}" }],
    answers: {
      page: { page: [
        { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] },
        { path: "/posters", name: "Posters", purpose: "print the code", sections: ["a banner"], components: ["card"] },
      ] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
      component: { component: [{ page: "/posters", does: "a QR banner", components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");
  assert.deepEqual(r.body.heldParts, ["qr-banner"], JSON.stringify(r.body.heldParts));

  // THE PAGE THAT IMPORTS IT SHIPS, because the component the site is serving
  // is still there — the half that is about the publication rather than the
  // wording, and the one a mutant marking everything `added` breaks.
  assert.equal(r.body.heldPages, undefined, "a page importing a component that merely reverts was withheld: " + JSON.stringify(r.body.heldPages));
  assert.ok((r.body.added || []).includes("posters.tsx"), "the importer did not ship: " + JSON.stringify(r.body.added));

  // AND THE SENTENCE IS THE ONE FOR A COMPONENT THAT ALREADY EXISTED.
  assert.match(r.body.coverNote, /The qr-banner section is unchanged for the same reason/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /haven't written the qr-banner/,
    "a component the site keeps serving was reported as one that was never written");

  // …AND ITS STORED BYTES ARE THE SITE'S OWN. Read off the store, because the
  // reply says what the route decided and this says what the site now holds.
  const stored = JSON.parse(r.store.store.get("source/fw-qr-revert/parts.json") || "null");
  assert.deepEqual(stored, [had], "the withheld rewrite reached parts.json: " + JSON.stringify(stored));
});

test("a page that only exists to import the withheld component goes with it", async () => {
  // THE CASCADE, WHICH IS WHY THE WITHHOLDING IS A FIXED POINT RATHER THAN ONE
  // PASS. Dropping the code withholds the component that renders it; an added
  // page that IMPORTS that component then compiles against a file that is not
  // there, so it has to go too — and here that leaves nothing at all, which is
  // the refusal.
  const posters = writtenPage("/posters");
  const uses = {
    ...posters,
    source: posters.source
      .replace("import { createFileRoute", "import { QrBanner } from '@/routes/-parts/qr-banner'\nimport { createFileRoute")
      .replace("<h1>", "<QrBanner /><h1>"),
  };
  const r = await addon("fw-qr-cascade", "add a gallery page, a posters page and a QR banner", {
    kinds: ["page", "qr", "component"], publishes: true, sitePages: ["/"],
    written: [uses],
    writtenParts: [{ name: "qr-banner", source: "export function QrBanner(){return <img src={SITE_QRS.gallery.src} alt=\"scan\" />}" }],
    answers: {
      page: { page: [
        { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] },
        { path: "/posters", name: "Posters", purpose: "print the code", sections: ["a banner"], components: ["card"] },
      ] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
      component: { component: [{ page: "/posters", does: "a QR banner", components: ["card"] }] },
    },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error, "qr-dependency", JSON.stringify(r.body));
  assert.equal(r.body.cost, 0, "a change that published nothing was charged for");
  // BOTH LISTS, because the cascade is the property: the component went for
  // showing the code, and the page went for IMPORTING the component. A fix
  // that stopped at the component leaves `/posters` importing a missing file.
  assert.deepEqual(r.body.heldParts, ["qr-banner"], JSON.stringify(r.body));
  assert.deepEqual(r.body.heldPages, ["posters.tsx"], "the page importing the withheld component shipped anyway: " + JSON.stringify(r.body.heldPages));
  assert.equal(r.compiles.length, 0, "a refused change reached the compiler");
});

test("a page this change invented to carry the code is not added at all, and says so in its own words", async () => {
  // THE OTHER SHAPE OF THE SAME WITHHOLDING, and it needs its own sentence:
  // "I've left it as it was" is FALSE of a page that has never existed, and a
  // customer reading it would go looking for something that was never there.
  const shows = (p) => ({ ...p, source: p.source.replace("<h1>", "<img src={SITE_QRS.gallery.src} /><h1>") });
  const r = await addon("fw-qr-new-page", "add a gallery page, a posters page and a QR code on it that opens the gallery", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    // The writer returns `/posters` (which shows the code) and the home page,
    // and never writes `/gallery`.
    written: [shows(writtenPage("/posters")), addedTo("/", '<Link to="/posters">Posters</Link>')],
    answers: {
      page: { page: [
        { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] },
        { path: "/posters", name: "Posters", purpose: "the printable code", sections: ["the code"], components: ["card"] },
      ] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery", page: "/posters" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");
  assert.deepEqual(r.body.heldPages, ["posters.tsx"], "the invented page carrying the code was published anyway");
  // IT IS NOT IN THE SITE AT ALL — an added page withheld is not a page.
  const out = compiledPages(r);
  assert.ok(!out.some((p) => p.path === "posters.tsx"), "a page whose only content was a dead code was published");
  assert.ok(!(r.body.added || []).includes("posters.tsx"), "the reply says it added a page it did not");
  // …AND IT IS REPORTED AS ONE THAT DID NOT MAKE IT, because it was asked for.
  assert.ok((r.body.missingPages || []).includes("/posters"),
    "a requested page that did not ship was not reported: " + JSON.stringify(r.body.missingPages));
  // THE OTHER SENTENCE, and not the reverting one.
  assert.match(r.body.coverNote, /I haven't added \/posters either/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /I've left \/posters as it was/,
    "a page that never existed was described as left as it was");
  // AND THE HOME PAGE, which never mentioned the code, still ships its change.
  assert.ok((r.body.changed || []).includes("index.tsx"), "an unrelated page was withheld: " + JSON.stringify(r.body.changed));
  // ⚠ …AND ITS LINK TO THE WITHHELD PAGE IS REPAIRED, not shipped dangling.
  // MEASURED before this was: the published home page carried
  // `<Link to="/posters">` for a route that no longer exists, which is
  // `TS2322` on the typecheck and a 404 for whoever clicks it — this
  // repository's own most expensive recorded class, reintroduced by its own
  // fix. `validatePages` owns that repair and is asked again over what
  // survives, so the link points home and the rewrite is REPORTED.
  const home = out.find((p) => p.path === "index.tsx");
  assert.doesNotMatch(home.source, /\/posters/, "a link to the withheld page shipped: " + home.source.slice(-160));
  assert.ok((r.body.problems || []).some((q) => /linked to and do not exist.*\/posters/.test(q)),
    "the rewritten link was not reported: " + JSON.stringify(r.body.problems));
});

test("a change that was ONLY the dead code's page publishes nothing and costs nothing", async () => {
  // THE THIRD OUTCOME: withholding can leave the change empty. Publishing then
  // would compile a site byte-identical to itself and charge for it, so it is
  // a refusal — cost 0, nothing stored, both sentences.
  const shows = (p) => ({ ...p, source: p.source.replace("<h1>", "<img src={SITE_QRS.gallery.src} /><h1>") });
  const r = await addon("fw-qr-empty", "add a gallery page and a QR code on the home page that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [shows(addedTo("/", "<p>Scan for the gallery.</p>"))],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery", page: "/" } },
    },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error, "qr-dependency", JSON.stringify(r.body));
  assert.equal(r.body.cost, 0, "a change that published nothing was charged for");
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");
  const look = storedLook(r, "fw-qr-empty");
  assert.ok(!look || !(look.qr && look.qr.length), "a refused change stored the broken code anyway");
  assert.match(r.body.msg, /I didn't add the QR code gallery/, r.body.msg);
  assert.match(r.body.msg, /I've left \/ as it was/, r.body.msg);
  // NOTHING WAS COMPILED. The refusal is before the bill and before the
  // container, so the site is exactly as it was in every respect.
  assert.equal(r.compiles.length, 0, "a refused change reached the compiler");
});

test("page + QR where both arrive publishes the code and says nothing — and an older code is never touched", async () => {
  // THE CONTROL the owner asked to keep. Same ask, same shapes, the writer
  // returning both pages: the code is stored, `moved` says so, and the
  // customer hears nothing at all.
  // RE-ANCHORED 2026-09-17: the home page is the site's own now, so what the
  // writer returns for it has to be that page PLUS the link — which is what an
  // addon really returns, and what `mergeAddonPages`' own reachability rule
  // requires of a changed page beside an added route.
  const ok = await addon("fw-qr-ok", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", '<Link to="/gallery">Gallery</Link>'), writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  // RE-ANCHORED 2026-09-17, and this expectation MOVED rather than broke: with
  // the stored pages in the shape a site really holds, the home page is the
  // site's own and `/gallery` is the one thing added. It used to read
  // `["index.tsx", "gallery.tsx"]`, which was the duplicate-ADD the prefixed
  // fixture produced — the site ending up with TWO home pages.
  assert.deepEqual(ok.body.added, ["gallery.tsx"], JSON.stringify(ok.body.added));
  assert.equal(ok.body.missingPages, undefined, "a page went missing, so this is not the control it claims to be");
  assert.deepEqual((storedLook(ok, "fw-qr-ok").qr || []).map((q) => q.name), ["gallery"], "the code was not published");
  assert.deepEqual(ok.body.moved, ["qr"], "the reply does not say the site gained a QR code");
  assert.equal(ok.body.droppedQrs, undefined, "a code whose page shipped was dropped");
  assert.equal(ok.body.heldPages, undefined, "a clean change withheld a page");
  assert.equal(ok.body.coverNote, "", "a clean change said something: " + ok.body.coverNote);

  // …AND A CODE THE SITE ALREADY HAD IS NOT THIS CHANGE'S TO REMOVE, whatever
  // it points at. The same missing page, and a stored code aimed straight at
  // it: untouched, unnamed, unmentioned.
  const prior = await addon("fw-qr-prior", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", "<p>Our gallery is coming.</p>")],
    look: { qr: [{ name: "gallery", points: "https://fw-qr-prior.gofarther.app/gallery", label: "Our gallery" }] },
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] } },
  });
  assert.equal(prior.body.ok, true, JSON.stringify(prior.body));
  assert.deepEqual(prior.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");
  assert.equal(prior.body.droppedQrs, undefined, "a code the site already had was dropped by a change that did not add it");
  assert.equal(prior.body.heldPages, undefined, "a change that added no code withheld a page");
  assert.deepEqual((storedLook(prior, "fw-qr-prior").qr || []).map((q) => q.name), ["gallery"], "the site's own code did not survive");
});

/**
 * EVERY COMPONENT THE CONTAINER PAYLOAD IMPORTS, AND WHETHER THE PAYLOAD HAS
 * IT — derived from the payload itself rather than compared against a list a
 * case typed out, because the property is "nothing here imports a file that is
 * not here" and a hardcoded expectation stops being that the moment a fixture
 * gains a file.
 *
 * IT READS BOTH PAYLOAD HALVES, which is the whole point: pages arrive in
 * `files` and components in `parts`, so a check that read only one of them
 * would report a component importing a missing component as clean — which is
 * exactly the defect this pair of cases is about.
 */
function danglingParts(r) {
  const body = (r && r.compiles && r.compiles[0] && r.compiles[0].body) || null;
  if (!body) return [];
  const have = new Set((Array.isArray(body.parts) ? body.parts : []).map((p) => p && p.name).filter(Boolean));
  const sources = [
    ...Object.entries(body.files || {}).map(([k, v]) => [k, String(v)]),
    ...(Array.isArray(body.parts) ? body.parts : []).map((p) => ["-parts/" + (p && p.name), String((p && p.source) || "")]),
  ];
  const out = [];
  for (const [where, src] of sources) {
    for (const hit of src.match(/-parts\/[\w-]+/g) || []) {
      const want = hit.slice("-parts/".length);
      if (!have.has(want)) out.push(where + " imports " + want);
    }
  }
  return out;
}

test("a component that imports the withheld component goes with it, however deep the chain", async () => {
  // ⚠ THE OWNER'S OWN CHAIN, REPRODUCED THROUGH THIS ROUTE BEFORE THE FIX
  // (2026-09-17): *"homepage → panel → qr-card → QR targeting missing
  // /gallery. The route withholds qr-card but retains panel and the homepage.
  // The actual compiler payload contains panel importing the missing qr-card
  // module."*
  //
  // MEASURED, exactly that: `heldParts ["qr-card"]`, `heldPages undefined`,
  // `changed ["index.tsx"]`, and the container payload's `parts` carrying
  // `panel` with `import { QrCard } from '@/routes/-parts/qr-card'` — a module
  // nothing would write. `vite` refuses that build, which is this repository's
  // own most expensive measured class.
  //
  // THE CAUSE WAS ONE MISSING TEST, not a missing idea. The PAGE loop has asked
  // "does this import a component that will not exist" since the cascade
  // shipped; the COMPONENT loop asked only "does this render a dead code", so
  // the chain broke at its first hop and everything past it read as unrelated.
  //
  // ⚠ AND THE INDEPENDENT `/prices` IS DELIBERATE SCAFFOLDING. The owner's ask
  // is to *"assert the actual compiler inputs"*, and the chain on its own
  // leaves nothing to publish — a 422 whose compiler inputs are the empty set,
  // which is a true assertion and a weak one. One unrelated page keeps the
  // compile alive so the payload can be read directly, and the chain under test
  // is untouched by it.
  const QR_CARD = { name: "qr-card", source: "export function QrCard(){return <img src={SITE_QRS.gallery.src} alt=\"scan\" />}" };
  const PANEL = { name: "panel", source: "import { QrCard } from '@/routes/-parts/qr-card'\nexport function Panel(){return <section><QrCard /></section>}" };
  const home = addedTo("/", '<Panel /><Link to="/prices">Prices</Link>');
  const uses = { ...home, source: home.source.replace("import { createFileRoute", "import { Panel } from '@/routes/-parts/panel'\nimport { createFileRoute") };
  const r = await addon("fw-nest", "add a gallery page, a prices page, a panel section with a QR card in it, and a code that opens the gallery", {
    kinds: ["page", "qr", "component"], publishes: true, sitePages: ["/"],
    written: [uses, writtenPage("/prices")],
    writtenParts: [QR_CARD, PANEL],
    answers: {
      page: { page: [
        { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] },
        { path: "/prices", name: "Prices", purpose: "what it costs", sections: ["a table"], components: ["card"] },
      ] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
      component: { component: [{ page: "/", does: "a panel with a QR card", components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITIONS, ASSERTED RATHER THAN ASSUMED: the page really did not
  // survive, so the code really is dead. Without these a run where the writer
  // returned `/gallery` passes this case with the fix deleted.
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page under test survived, so nothing here is about the fix");
  assert.deepEqual(r.body.droppedQrs, [{ name: "gallery", route: "/gallery" }], "the dropped code is not on the wire");

  // ── THE CHAIN SETTLES, ALL THREE HOPS ────────────────────────────────────
  // `qr-card` for showing the code, `panel` for importing `qr-card`, the home
  // page for importing `panel`. The second of those three is the fix.
  assert.deepEqual(r.body.heldParts, ["qr-card", "panel"],
    "the chain stopped short — a component importing the withheld one shipped: " + JSON.stringify(r.body.heldParts));
  assert.deepEqual(r.body.heldPages, ["index.tsx"],
    "the page at the end of the chain shipped: " + JSON.stringify(r.body.heldPages));

  // ── THE ACTUAL COMPILER INPUTS ───────────────────────────────────────────
  // What the route SAYS it withheld and what it HANDED the thing that builds
  // the site are two claims, and only the second one is the defect. A route
  // that named both components and sent them anyway satisfies every assertion
  // above.
  assert.equal(r.compiles.length, 1, "the independent page did not reach the compiler");
  const body = r.compiles[0].body;
  assert.deepEqual(danglingParts(r), [],
    "the compiler was handed a file importing a module the payload does not contain: " + JSON.stringify(danglingParts(r)));
  assert.deepEqual((body.parts || []).map((p) => p.name), [],
    "a withheld component was handed to the compiler: " + JSON.stringify((body.parts || []).map((p) => p.name)));
  // …AND THE HOME PAGE IN THAT PAYLOAD IS THE SITE'S OWN, not the rewrite. It
  // is still SENT — a compile carries the whole site — so "withheld" has to be
  // read off its bytes rather than off its absence.
  const sent = compiledPages(r).find((p) => p.path === "index.tsx");
  assert.ok(sent, "the home page was not sent at all: " + JSON.stringify(compiledPages(r).map((p) => p.path)));
  assert.doesNotMatch(sent.source, /Panel/, "the reverted home page still carries the withheld component: " + sent.source);

  // ── THE PRESERVED STORED FILES ───────────────────────────────────────────
  // Nothing was written, because this change's only two components were both
  // withheld — and a `parts.json` holding one of them is the store disagreeing
  // with the payload.
  assert.equal(r.store.store.get("source/fw-nest/parts.json"), undefined,
    "a component list was written for a change whose every component was withheld: " + r.store.store.get("source/fw-nest/parts.json"));
  // …AND THE INDEPENDENT HALF STILL SHIPS, so this is withholding a dependency
  // set rather than refusing the request.
  assert.deepEqual(r.body.added, ["prices.tsx"], "the independent half of the change did not ship: " + JSON.stringify(r.body.added));
  assert.deepEqual(r.body.changed, [], "the reverted page is reported as changed: " + JSON.stringify(r.body.changed));

  // ── THE CUSTOMER RESPONSE ────────────────────────────────────────────────
  // Both components by name, the page in its own sentence, and the code in
  // its own — three things they can act on separately.
  assert.match(r.body.coverNote, /I haven't written the qr-card, panel sections/, r.body.coverNote);
  assert.match(r.body.coverNote, /I didn't add the QR code gallery/, r.body.coverNote);
  assert.match(r.body.coverNote, /I've left \/ as it was/, r.body.coverNote);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PRESERVATION POLICY KNOWS TWO REASONS A CHANGED PAGE IS LEGITIMATE
// (2026-09-17)
//
// Owner: *"Add a gallery page and add a parking note to the homepage."* The
// component designer explicitly targets `/`, the writer returns the correct
// homepage addition, and `mergeAddonPages` REVERTS it because the home page
// contains no link to the newly added route. **The identical component-only
// request succeeds.**
//
// MEASURED through this route before the fix: `reverted ["index.tsx"]`,
// `changed []`, the note in NEITHER the container payload NOR the stored
// source, and the customer told *"I left / as it was — nothing there needed to
// change for this"* about the half of their own sentence that named that page.
//
// THE RULE HAD ONE REASON AND NEEDED TWO. Reachability is a guess about a page
// nobody mentioned — the nav link a new page needs — and it is right. `asked`
// is not a guess: it is the destination a cleaned designer answer NAMED. Both
// are kept and they are independent; what is forbidden is inferring permission
// from the customer's prose, or exempting a page nobody named.
// ─────────────────────────────────────────────────────────────────────────────

const PARK = "<p>There is free parking behind the shop.</p>";
const parkNote = () => addedTo("/", PARK);
/** The customer's own sentence, composed by the real producer from the real reply. */
const said = (r) => addonReply(r.body || {});

test("a component-only request changes the page it was asked about — the control", async () => {
  // THE CONTROL THE OWNER NAMED, and it is what makes the case below about the
  // ADDED PAGE rather than about components. Same site, same designer answer,
  // same returned home page — with no new route in the change, the revert rule
  // does not run at all and this has always worked.
  const r = await addon("fw-park-only", "add a parking note to the homepage", {
    kinds: ["component"], publishes: true, sitePages: ["/"],
    written: [parkNote()],
    answers: { component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.changed, ["index.tsx"], JSON.stringify(r.body.changed));
  assert.deepEqual(r.body.reverted, [], "the control reverted, so it is not a control: " + JSON.stringify(r.body.reverted));
  const home = compiledPages(r).find((p) => p.path === "index.tsx");
  assert.match(home.source, /free parking/, "the note never reached the compiler");
  assert.match(storedSource(r, "fw-park-only", "index.tsx"), /free parking/, "the note never reached the store");
  assert.doesNotMatch(said(r), /nothing there needed to change/, said(r));
});

test("a new page beside a requested homepage addition keeps both, with no link between them", async () => {
  // ⚠ THE OWNER'S REPRODUCTION. The only difference from the control above is
  // that a page is added in the same breath — and the home page carries no link
  // to it, because nobody asked for one. Before the fix that alone reverted the
  // half of the request that named `/`.
  const r = await addon("fw-park", "add a gallery page and add a parking note to the homepage", {
    kinds: ["page", "component"], publishes: true, sitePages: ["/"],
    written: [parkNote(), writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE PRECONDITION, ASSERTED RATHER THAN ASSUMED: a page really was added, so
  // the revert rule really did run. Without this the case passes with the fix
  // deleted, on a change that never reached the branch.
  assert.deepEqual(r.body.added, ["gallery.tsx"], "no page was added, so the revert rule never ran");
  // …AND THE HOME PAGE REALLY CARRIES NO LINK TO IT, which is the whole shape.
  // A returned home page that happened to link `/gallery` would satisfy the old
  // rule and prove nothing about the new one.
  const home = compiledPages(r).find((p) => p.path === "index.tsx");
  assert.doesNotMatch(home.source, /\/gallery/, "the home page links the new route, so reachability alone would have kept it");

  assert.deepEqual(r.body.reverted, [], "the requested homepage addition was reverted: " + JSON.stringify(r.body.reverted));
  assert.deepEqual(r.body.changed, ["index.tsx"], JSON.stringify(r.body.changed));

  // ── COMPILER INPUTS, STORED SOURCE, CUSTOMER WORDING ─────────────────────
  // Three claims and they are three: what was HANDED to the thing that builds
  // the site, what the site now HOLDS, and what the customer is TOLD.
  assert.match(home.source, /free parking/, "the compiler never saw the requested addition");
  assert.match(storedSource(r, "fw-park", "index.tsx"), /free parking/, "the store never saw the requested addition");
  assert.doesNotMatch(said(r), /nothing there needed to change/,
    "the reply says nothing needed changing about a page the request named: " + said(r));
  // ⚠ CORRECTED 2026-09-17, and this is the case that produced the wrong
  // sentence: *"added /gallery, linked it from /. Nothing links to /gallery
  // yet…"* — a link claim and a no-link warning four words apart. A changed page
  // does not establish that a link was added, and here it certainly was not.
  assert.match(said(r), /added \/gallery, updated \//, said(r));
  assert.doesNotMatch(said(r), /linked it from/, said(r));
  // …AND THE `unlinked` SENTENCE IS STILL THERE, because it is the one that
  // really knows about links and it is measured rather than inferred.
  assert.match(said(r), /Nothing links to \/gallery yet/, said(r));
});

test("a rewrite of a page nobody named is still reverted, and still said", async () => {
  // THE PROTECTION THE FIX MUST NOT REMOVE. Same site, same added page — and a
  // rewritten `/about` that no designer answer mentions. `asked` holds
  // `/gallery` and nothing else, so `/about` meets the reachability rule alone
  // and loses, exactly as before.
  //
  // MEASURED LIVE, first run of `edit smoke`: "add a gallery page" came back
  // having rewritten four of the site's four pages for 28 credits. That is the
  // defect this rule exists for, and widening the exemption to the home page —
  // which the window's `keep` list carries as a BUDGET decision — would have
  // reopened it for the one page every site has.
  const about = storedPage("/about");
  const rewrite = {
    ...about,
    path: "src/routes/about.tsx",
    source: about.source.replace("<h1>about</h1>", "<h1>A COMPLETELY NEW ABOUT PAGE</h1>"),
  };
  const r = await addon("fw-unrel", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/", "/about"],
    written: [writtenPage("/gallery"), addedTo("/", '<Link to="/gallery">Gallery</Link>'), rewrite],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.reverted, ["about.tsx"], "an unasked rewrite shipped: " + JSON.stringify(r.body.reverted));
  // …AND THE HOME PAGE, WHICH NOBODY NAMED EITHER, IS KEPT FOR THE OTHER
  // REASON — it carries the link. Both reasons in one reply is what says they
  // are independent rather than one wearing two names.
  assert.deepEqual(r.body.changed, ["index.tsx"], JSON.stringify(r.body.changed));

  const out = compiledPages(r).find((p) => p.path === "about.tsx");
  assert.match(out.source, /<h1>about<\/h1>/, "the compiler was handed the unasked rewrite");
  assert.doesNotMatch(out.source, /COMPLETELY NEW/, "the unasked rewrite reached the compiler: " + out.source.slice(0, 200));
  assert.doesNotMatch(storedSource(r, "fw-unrel", "about.tsx"), /COMPLETELY NEW/, "the unasked rewrite reached the store");
  // AND HERE THE SENTENCE IS TRUE, so it is asserted PRESENT — which is what
  // stops the fix from being "delete the sentence".
  assert.match(said(r), /I left \/about as it was/, said(r));
  assert.match(said(r), /nothing there needed to change/, said(r));
});

test("the same nested chain with its page present ships whole — the control", async () => {
  // THE CONTROL THE OWNER ASKED TO KEEP, and it is what makes the case above
  // about the MISSING PAGE rather than about nesting. Same site, same chain,
  // same three files, the writer returning `/gallery` this time: nothing is
  // dropped, nothing is withheld, both components reach the compiler and the
  // customer hears nothing at all.
  const QR_CARD = { name: "qr-card", source: "export function QrCard(){return <img src={SITE_QRS.gallery.src} alt=\"scan\" />}" };
  const PANEL = { name: "panel", source: "import { QrCard } from '@/routes/-parts/qr-card'\nexport function Panel(){return <section><QrCard /></section>}" };
  const home = addedTo("/", '<Panel /><Link to="/gallery">Gallery</Link>');
  const uses = { ...home, source: home.source.replace("import { createFileRoute", "import { Panel } from '@/routes/-parts/panel'\nimport { createFileRoute") };
  const ok = await addon("fw-nest-ok", "add a gallery page, a panel section with a QR card in it, and a code that opens the gallery", {
    kinds: ["page", "qr", "component"], publishes: true, sitePages: ["/"],
    written: [uses, writtenPage("/gallery")],
    writtenParts: [QR_CARD, PANEL],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
      component: { component: [{ page: "/", does: "a panel with a QR card", components: ["card"] }] },
    },
  });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  assert.equal(ok.body.missingPages, undefined, "a page went missing, so this is not the control it claims to be");
  assert.equal(ok.body.droppedQrs, undefined, "a code whose page shipped was dropped");
  assert.equal(ok.body.heldParts, undefined, "a clean change withheld a component: " + JSON.stringify(ok.body.heldParts));
  assert.equal(ok.body.heldPages, undefined, "a clean change withheld a page: " + JSON.stringify(ok.body.heldPages));

  // THE COMPILER INPUTS, read the same way as above — which is what proves that
  // reader is alive in both directions rather than answering `[]` for its own
  // reasons.
  const body = ok.compiles[0].body;
  assert.deepEqual((body.parts || []).map((p) => p.name), ["qr-card", "panel"],
    "the chain's own components did not reach the compiler: " + JSON.stringify((body.parts || []).map((p) => p.name)));
  assert.deepEqual(danglingParts(ok), [], "the clean control has a dangling import, so the reader is measuring something else");
  const sent = compiledPages(ok).find((p) => p.path === "index.tsx");
  assert.match(sent.source, /Panel/, "the home page's own change did not ship: " + sent.source);

  // THE STORED FILES AND THE SENTENCE.
  assert.deepEqual(JSON.parse(ok.store.store.get("source/fw-nest-ok/parts.json") || "null"), [QR_CARD, PANEL],
    "the components the site now holds are not the ones it was sent");
  assert.deepEqual(ok.body.moved, ["qr"], "the reply does not say the site gained a QR code");
  assert.equal(ok.body.coverNote, "", "a clean change said something: " + ok.body.coverNote);
});

// ─────────────────────────────────────────────────────────────────────────────
// A SITE TOO LARGE TO SHOW WHOLE (2026-09-17)
//
// The addon's page window is `MAX_PRIOR_CHARS`, and over it the block fell
// through to a branch written for a REVISE: page names and "write them again in
// full". On a path where a returned page REPLACES the stored one that is the
// opposite instruction, and the whole addon contract went with it.
//
// MEASURED OVER THE 100-SITE CORPUS BEFORE ANY OF THIS: zero sites exceed the
// window today (max 50,646 characters, 6 pages; the mean page is 7,744, so the
// window holds ~11.6 of them). A site reaches it by GROWING — every addon adds
// a page or a section — so this is the shape of the platform's own future
// rather than a state anything is in now.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real generated pages, several sites' worth, so "too large" is real source.
 *
 * ⚠ IN THE SHAPE A SITE STORES THEM — bare, no `src/routes/` — because that is
 * what `cleanPath` leaves and what `saveSiteSource` keeps. The prefixed
 * spelling this used to produce is what made the page window's `keep` list
 * match nothing on every real site while matching perfectly here.
 */
function corpusPages(sites) {
  const out = [];
  for (const s of sites) {
    for (const f of fs.readdirSync(path.join(CORPUS_DIR, s)).filter((x) => x.endsWith(".tsx"))) {
      out.push({
        path: (s + "-" + f.replace(/\.tsx$/, "")).toLowerCase() + ".tsx",
        source: fs.readFileSync(path.join(CORPUS_DIR, s, f), "utf8"),
      });
    }
  }
  return out;
}
const BIG = ["salon", "printer", "restaurant", "music-school"];
const shownPaths = (t) => [...t.matchAll(/--- ([a-z0-9.\-]+\.tsx) ---/g)].map((m) => m[1]);

test("a site too large for the window keeps the addon contract, shows what fits and names the rest", async () => {
  const stored = corpusPages(BIG);
  const chars = stored.reduce((n, p) => n + p.source.length, 0);
  assert.ok(chars > MAX_PRIOR_CHARS, "the fixture is not over the window — " + chars + " against " + MAX_PRIOR_CHARS);

  // ⚠ THE HOME PAGE IS REAL AND IS DELIBERATELY NOT FIRST. `keep` has to bind
  // to something the site really has, or every entry names a page it has not
  // got and the two selections agree by accident — and it has to name a page
  // the BUDGET would not have taken anyway, or naming it changes nothing.
  // MEASURED: with the home page at index 0 three mutants survived (the keep
  // order dropped, the home page unkept, the route's own reader recomputed with
  // a different keep list), because `stored[0]` fits first either way.
  stored[stored.length - 1] = { ...stored[stored.length - 1], path: "index.tsx" };
  const r = await addon("fw-big", "add a page listing our opening hours", {
    kinds: ["page"], publishes: true, storedPages: stored,
    written: [writtenPage("/hours")],
    answers: { page: { page: [{ path: "/hours", name: "Hours", purpose: "say when we are open", sections: ["a table"], components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const flat = pagePrompt(r).text.replace(/\\n/g, " ");

  // THE CONTRACT, WHICH DISAPPEARED ENTIRELY BEFORE THIS.
  assert.match(flat, /RETURN ONLY WHAT IS NEW OR CHANGED/, "the addon contract went with the source");
  assert.match(flat, /`remove` IS THE ONLY THING THAT DOES IT/, "the delete verb went with the source");
  assert.match(flat, /BYTE-IDENTICAL/, "the don't-rewrite rule went with the source");
  assert.doesNotMatch(flat, /write them again in full/,
    "the writer was told to rewrite a site it is only adding to — the reported defect");

  // WHAT FITS IS SHOWN, WHAT DOES NOT IS NAMED, AND THE TWO ARE THE WHOLE SITE.
  const shown = shownPaths(pagePrompt(r).text);
  assert.ok(shown.length > 0, "nothing at all was shown");
  assert.ok(shown.length < stored.length, "the fixture fitted whole, so this case is not about the window");
  const named = flat.match(/ARE UNCHANGED: (.*?)\. Do NOT/);
  assert.ok(named, "the pages that did not fit are not named: " + flat.slice(0, 400));
  const unseen = named[1].split(", ");
  assert.equal(shown.length + unseen.length, stored.length, "shown + named is not the whole site");
  assert.equal(shown.filter((p) => unseen.includes(p)).length, 0, "a page was both shown and named as unseen");
  // THE REASON, NOT THE VERB. "Do NOT" ends the line above the forbidding one,
  // so a mutant that softened "…for any of them" into "…for any of them if you
  // like" left the words "Do NOT return a file for any of them" intact across
  // the join and survived. What cannot survive is the clause that says WHY.
  assert.match(flat, /you have not been shown what you would be replacing/,
    "a page named and not shown was not forbidden — returning one replaces a file nobody saw");
  // AND THE PAGES GO OUT IN THE SITE'S OWN ORDER, whatever the budget did to
  // the selection: which pages are shown is a budget decision, the order they
  // are read in is the site's, and a model handed its pages in an order that
  // moves per request reads that order as meaning something.
  const inSite = stored.map((p) => p.path).filter((p) => shown.includes(p));
  assert.deepEqual(shown, inSite, "the shown pages are in the budget's order rather than the site's");
  // AND THE ASSERTION ABOVE IS NOT VACUOUS, which it would be if `keep` named
  // the page the site's order puts first: the home page is LAST here, so the
  // budget's order and the site's really are different lists.
  assert.notEqual(inSite[0], "index.tsx", "the fixture cannot tell the two orders apart");
  assert.ok(shown.includes("index.tsx"), "the home page was not kept: " + JSON.stringify(shown));

  // AND IT IS RECORDED. `ok: true` with an empty `problems` and an empty
  // `coverNote` is exactly what this answered before, so the one fact that
  // explains a weak result on a large site was nowhere at all.
  assert.deepEqual(r.body.unseenPages, unseen, "the reply does not carry what the window could not hold");
  const rec = storedAnswer(r, "fw-big");
  assert.deepEqual(rec.coverage.unseenPages, unseen, "the stored record does not carry it");
  // …AND NOT TO THE CUSTOMER, deliberately: they can do nothing with it, and the
  // things they CAN act on have their own sentences.
  assert.equal(r.body.coverNote, "", "the customer was told about the prompt window: " + r.body.coverNote);
});

test("the pages this change is about are the ones shown, whatever their stored order", async () => {
  // `keep` is the whole of this: without it the selection is stored order and
  // the page a section was designed to land on is exactly the one worth the
  // budget.
  //
  // ⚠ THE FIRST DRAFT OF THIS CASE WAS VACUOUS AND A SWEEP SAID SO. It targeted
  // the LAST page in stored order, on the reasoning that stored order would
  // drop it — and `priorPagesSent` SKIPS a page too big for what is left rather
  // than stopping, so the last page is small enough to fit in the remainder and
  // was shown either way. Eight mutants that cut `keep` out of the chain
  // survived it. A fixture too shallow to separate the two readings, in the
  // case written for the thing it could not see.
  //
  // SO THE CASE CARRIES ITS OWN CONTROL: the same site and the same change
  // aimed at the HOME page first, which establishes by measurement that the
  // target really is one the budget drops — and only then is it named.
  const stored = corpusPages(BIG);
  // THE HOME PAGE IS LAST, deliberately: at index 0 it is shown whatever `keep`
  // says, and the assertion below stops being about `keep` at all.
  stored[stored.length - 1] = { ...stored[stored.length - 1], path: "index.tsx" };

  const run = (slug, route) => addon(slug, "add a note about parking to " + route, {
    kinds: ["component"], publishes: true, storedPages: stored,
    // ⚠ APPENDED, NOT `replace`d ON A NEEDLE THE SOURCE MAY NOT HAVE. With the
    // stored paths in the site's own spelling these really MERGE, so a returned
    // page byte-identical to the stored one is `no-change` and the whole case
    // escalates — which is the merge being right about a fixture that changed
    // nothing. A corpus page need not contain `</main>` at all.
    written: [{ ...stored[0], source: stored[0].source + "\n// Parking is free.\n" }],
    answers: { component: { component: [{ page: route, does: "a parking note", components: ["card"] }] } },
  });

  // THE CONTROL: nothing names the target, so it is shown only if the budget
  // reached it on its own.
  // THE CONTROL NAMES THE FIRST STORED PAGE, which the budget takes anyway, so
  // `keep` adds nothing and the answer is the budget's own. Naming "/" here
  // would keep the HOME page and change the very selection being measured.
  const firstRoute = "/" + stored[0].path.replace(/\.tsx$/, "");
  const without = shownPaths(pagePrompt(await run("fw-keep-ctl", firstRoute)).text);
  const dropped = stored.map((p) => p.path).filter((p) => !without.includes(p));
  assert.ok(dropped.length, "the fixture fitted whole, so this case is not about the window");
  const target = "/" + dropped[0].replace(/\.tsx$/, "");

  // …AND NOW IT IS NAMED.
  const r = await run("fw-big-keep", target);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const shown = shownPaths(pagePrompt(r).text);
  assert.ok(shown.includes(dropped[0]),
    "the page the change is about was not shown, and the budget does not reach it on its own: " + JSON.stringify(shown));
  // AND THE HOME PAGE, which is the nav anchor almost every addon touches —
  // "usually ONE new page, plus the page a visitor would look on to find it".
  assert.ok(shown.includes("index.tsx"), "the home page was not shown: " + JSON.stringify(shown));
  assert.ok(shown.length < stored.length, "the site fitted whole once the target was named");

  // AND THE ROUTE'S OWN READER ASKS WITH THE PROMPT'S KEEP LIST, not a second
  // one. `aUnseenPages` is `priorPagesSent` called AGAIN in the route, so the
  // report and the prompt can disagree about which pages the writer saw —
  // and this case is the only one where they would, which is why the
  // assertion lives here rather than beside the other one. MEASURED on this
  // fixture: named, the target is shown and printer-products is withheld;
  // unnamed, exactly that pair swaps, so a reader that dropped `keep` would
  // report the page the writer was just shown as one it never saw. The case
  // above cannot see it — its keep list names the home page, which is small
  // and which the budget reaches on its own in stored order, so both
  // selections there are the same nine pages to the character.
  const named = pagePrompt(r).text.replace(/\\n/g, " ").match(/ARE UNCHANGED: (.*?)\. Do NOT/);
  assert.ok(named, "the pages that did not fit are not named");
  assert.ok(!named[1].split(", ").includes(dropped[0]),
    "the prompt names the target as unseen, so this assertion is not about the reader");
  assert.deepEqual(r.body.unseenPages, named[1].split(", "),
    "the reply names different pages from the prompt — the route asked the window with another keep list");
});

test("THE LIFECYCLE: one page identity from what a model writes to what the merge reports", async () => {
  // Owner, 2026-09-17: *"aKeepPages constructs src/routes/target.tsx, but
  // validatePages produces target.tsx and saveSiteSource preserves that path…
  // Match page identities consistently across stored source, selection,
  // generation and merging. Add a lifecycle case using validator-produced or
  // previously persisted pages, not only manually prefixed fixtures."*
  //
  // THE REPRODUCTION, AS THE OWNER GAVE IT: three valid ~40k pages, asking to
  // change `/target`. Before the fix it showed `index.tsx` and `middle.tsx`,
  // WITHHELD `target.tsx` — the one page the change was about — and then
  // accepted a returned replacement for it.
  //
  // ⚠ AND EVERY HOP IS THE REAL PRODUCER'S. The stored pages are not typed:
  // they are what `validatePages` answers for pages in the shape a MODEL
  // writes them, which is the one thing `saveSiteSource` ever stores. A
  // hand-spelled fixture is exactly what hid this for as long as it was hidden.
  const big = (route, n) => {
    const name = route === "/" ? "Index" : route.slice(1).replace(/[^a-z]/g, "");
    return {
      // AS A MODEL WRITES IT — with the prefix, which is why the prefix is not
      // wrong anywhere; it is wrong as a claim about what is STORED.
      path: "src/routes/" + (route === "/" ? "index" : route.slice(1)) + ".tsx",
      source: 'import { createFileRoute } from "@tanstack/react-router";\n'
        + 'export const Route = createFileRoute("' + route + '")({ component: ' + name + ' });\n'
        + "function " + name + "() {\n  return (\n    <main>\n"
        + ("      {/* " + "x".repeat(96) + " */}\n").repeat(380)
        + "    </main>\n  );\n}\n",
    };
  };
  const born = validatePages({ pages: [big("/", 380), big("/middle", 380), big("/target", 380)] }, { partial: true });
  assert.deepEqual(born.problems, [], "the lifecycle fixture does not survive the real validator");
  const stored = born.pages;

  // HOP 1 — THE VALIDATOR STRIPS THE PREFIX. This is the fact the defect
  // denied, asserted here rather than assumed anywhere else.
  assert.deepEqual(stored.map((p) => p.path), ["index.tsx", "middle.tsx", "target.tsx"],
    "the validator no longer answers the persisted spelling: " + JSON.stringify(stored.map((p) => p.path)));
  const chars = stored.reduce((n, p) => n + p.source.length, 0);
  assert.ok(chars > MAX_PRIOR_CHARS, "the fixture is not over the window — " + chars + " against " + MAX_PRIOR_CHARS);
  // …AND THE BUDGET REALLY DROPS ONE OF THE THREE, or the selection is not
  // being tested at all.
  assert.ok(stored[0].source.length + stored[1].source.length + stored[2].source.length > MAX_PRIOR_CHARS
    && stored[0].source.length + stored[2].source.length <= MAX_PRIOR_CHARS,
    "the window does not bind at exactly one page here, so the case measures nothing");

  const r = await addon("fw-life", "add a note about parking to /target", {
    kinds: ["component"], publishes: true, storedPages: stored,
    written: [{ ...stored[2], source: stored[2].source + "\n// Parking is free.\n" }],
    answers: { component: { component: [{ page: "/target", does: "a parking note", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // HOP 2 — THE SELECTION FINDS IT. The page the change is about is shown, and
  // the one dropped is the one it is not about.
  const shown = shownPaths(pagePrompt(r).text);
  assert.ok(shown.includes("target.tsx"),
    "the page the change is about was withheld — the reported defect: " + JSON.stringify(shown));
  assert.ok(shown.includes("index.tsx"), "the home page was not kept: " + JSON.stringify(shown));
  assert.deepEqual(r.body.unseenPages, ["middle.tsx"],
    "the window dropped something other than the page nobody named: " + JSON.stringify(r.body.unseenPages));

  // HOP 3 — GENERATION AND MERGE AGREE WITH BOTH. The returned page merges
  // onto the stored one rather than sitting beside it as a second file.
  assert.deepEqual(r.body.changed, ["target.tsx"], JSON.stringify(r.body.changed));
  assert.deepEqual(r.body.added, [], "the returned page was added beside the stored one instead of replacing it");
  const out = compiledPages(r);
  assert.deepEqual(out.map((p) => p.path).sort(), ["index.tsx", "middle.tsx", "target.tsx"],
    "the published site is not the three pages it started with: " + JSON.stringify(out.map((p) => p.path)));
  assert.match(out.find((p) => p.path === "target.tsx").source, /Parking is free/, "the change did not reach the site");
});

test("a page the window could not carry is not replaced by a returned rewrite of it", async () => {
  // Owner, 2026-09-17: *"Also enforce preservation of withheld existing pages
  // at the merge boundary. Prompt wording and keptProse do not establish that
  // an unseen rewrite preserves behavior."* Both halves are exact — the prompt
  // NAMES every withheld page and forbids returning one, which is wording, and
  // `keptProse` asks only whether the WORDS survived, which a rewrite that
  // drops a form, a link or a hook passes cleanly.
  //
  // THIS IS `partsSent`'s WALL ONE LAYER OVER: the pages we could not SHOW are
  // exactly the pages we cannot CHECK.
  const stored = corpusPages(BIG);
  stored[stored.length - 1] = { ...stored[stored.length - 1], path: "index.tsx" };

  // WHICH PAGE THE BUDGET REALLY DROPS IS MEASURED, NEVER ASSUMED — the same
  // control the keep-order case needs, for the same reason.
  const probe = await addon("fw-unseen-ctl", "add a note about parking to /", {
    kinds: ["component"], publishes: true, storedPages: stored,
    written: [{ ...stored[0], source: stored[0].source + "\n// Parking is free.\n" }],
    answers: { component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] } },
  });
  const unseen = probe.body.unseenPages || [];
  assert.ok(unseen.length, "the fixture fitted whole, so nothing here is about the window");
  const victim = stored.find((p) => p.path === unseen[0]);
  assert.ok(victim, "the withheld name is not one of the site's pages: " + unseen[0]);

  // …AND NOW THE WRITER RETURNS A REWRITE OF EXACTLY THAT PAGE, keeping its
  // words — so `keptProse` is satisfied and only the new wall can refuse it.
  const rewrite = { path: victim.path, source: victim.source + "\n// rewritten from a description\n" };
  const r = await addon("fw-unseen-page", "add a note about parking to /", {
    kinds: ["component"], publishes: true, storedPages: stored,
    written: [{ ...stored[0], source: stored[0].source + "\n// Parking is free.\n" }, rewrite],
    answers: { component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE STORED FILE IS WHAT SHIPS, read off the container payload rather than a
  // reply field: a route that kept the file on its list and sent it anyway
  // satisfies every assertion about `changed`.
  const out = compiledPages(r);
  const live = out.find((p) => p.path === victim.path);
  assert.ok(live, "the withheld page left the site altogether");
  assert.equal(live.source, victim.source, "a page nobody was shown was replaced by a rewrite of it");
  assert.ok(!(r.body.changed || []).includes(victim.path), "the reply says it changed a page it refused: " + JSON.stringify(r.body.changed));

  // …AND IT IS SAID. A withheld page dropped in silence is indistinguishable
  // from a page the model never touched.
  assert.deepEqual(r.body.keptPages, [victim.path], "the refusal is not on the wire: " + JSON.stringify(r.body.keptPages));
  assert.match(r.body.keptPartsNote, /I won't write over a page I haven't read/, r.body.keptPartsNote);
  assert.match(r.body.keptPartsNote, new RegExp(routeOf(victim.path)), r.body.keptPartsNote);
  // THE REASON, NOT ONLY THE RULE. "I won't write over a page I haven't read"
  // survives a sentence that has borrowed the COMPONENT wall's opening — and
  // that opening is different advice for a different problem: there you ask for
  // the one component on its own because it fits alone, here the SITE has
  // outgrown one request.
  assert.match(r.body.keptPartsNote, /big enough now that I can't hold every page at once/, r.body.keptPartsNote);
  assert.doesNotMatch(r.body.keptPartsNote, /too long for me to read in one go/,
    "the page sentence borrowed the component one's size-bound advice");

  // THE CONTROL: the page the writer WAS shown is changed exactly as asked, so
  // the refusal above is about the window and not about refusing everything.
  assert.ok((r.body.changed || []).includes(stored[0].path),
    "the shown page's own change was refused too: " + JSON.stringify(r.body.changed));
  assert.match(out.find((p) => p.path === stored[0].path).source, /Parking is free/,
    "the change the customer asked for did not reach the site");
});

test("a change that was ONLY a rewrite of a page nobody was shown refuses, and does not climb", async () => {
  // THE BRANCH THE CASE ABOVE CANNOT REACH: there the home page's own change
  // survives, so the merge is fine and this never fires. Here the writer returns
  // NOTHING BUT the withheld page — so once it is refused the merge answers
  // `nothing-returned`, and falling through would escalate to the ~25-credit
  // revise: rewriting a customer's whole site because WE refused the one file it
  // sent. This route's own "a considered refusal does not climb the ladder",
  // met from the refusing side.
  const stored = corpusPages(BIG);
  stored[stored.length - 1] = { ...stored[stored.length - 1], path: "index.tsx" };
  const probe = await addon("fw-only-ctl", "add a note about parking to /", {
    kinds: ["component"], publishes: true, storedPages: stored,
    written: [{ ...stored[0], source: stored[0].source + "\n// Parking is free.\n" }],
    answers: { component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] } },
  });
  const unseen = probe.body.unseenPages || [];
  assert.ok(unseen.length, "the fixture fitted whole, so nothing here is about the window");
  const victim = stored.find((p) => p.path === unseen[0]);

  const r = await addon("fw-only-unseen", "add a note about parking to /", {
    kinds: ["component"], publishes: true, storedPages: stored,
    written: [{ path: victim.path, source: victim.source + "\n// rewritten from a description\n" }],
    answers: { component: { component: [{ page: "/", does: "a parking note", components: ["card"] }] } },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error, "unseen-rewrite", JSON.stringify(r.body));
  assert.notEqual(r.body.escalate, true, "a refusal we made ourselves was sent up the ladder to the full revise");
  assert.equal(r.body.cost, 0, "a change that published nothing was charged for");
  assert.deepEqual(r.body.keptPages, [victim.path], "the refused page is not on the wire");
  assert.match(r.body.msg, /I won't write over a page I haven't read/, r.body.msg);
  assert.match(r.body.msg, /big enough now that I can't hold every page at once/, r.body.msg);
  assert.equal(r.compiles.length, 0, "a refused change reached the compiler");
});

test("an ordinary site is byte-identical — the window changes nothing until it binds", async () => {
  // THE CONTROL FOR THE WHOLE ROUND. Every site on the platform is under the
  // window today, so a change here that moved the ordinary prompt would be a
  // change to every addon that has ever run.
  const stored = corpusPages(["salon"]);
  assert.ok(stored.reduce((n, p) => n + p.source.length, 0) < MAX_PRIOR_CHARS, "the control fixture is over the window");
  const r = await addon("fw-small", "add a page listing our opening hours", {
    kinds: ["page"], publishes: true, storedPages: stored,
    written: [writtenPage("/hours")],
    answers: { page: { page: [{ path: "/hours", name: "Hours", purpose: "say when we are open", sections: ["a table"], components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const t = pagePrompt(r).text;
  assert.equal(shownPaths(t).length, stored.length, "a site that fits was not shown whole");
  assert.match(t.replace(/\\n/g, " "), /Below is the CURRENT source of every page/,
    "a site that fits was told it is too large to show");
  assert.doesNotMatch(t, /ARE UNCHANGED:/, "a site that fits named pages as unseen");
  assert.equal(r.body.unseenPages, undefined, "a site that fits reported a window that did not bind");
  assert.equal(storedAnswer(r, "fw-small").coverage.unseenPages.length, 0, "the record claims a window that did not bind");
});

test("a one-page site bigger than the whole window is shown that page and names nothing as unseen", async () => {
  // THE BELT. `MAX_PAGE_CHARS` (48,000) is under `MAX_PRIOR_CHARS` (90,000), so
  // no page `validatePages` admits can reach here — but a page stored before
  // those caps can, and an addon prompt with no source at all is the revise
  // fallback wearing this branch's words. The page it falls back to must not
  // then be named among the ones it cannot see.
  const stored = [{ path: "index.tsx", source: writtenPage("/").source + "\n// " + "x".repeat(MAX_PRIOR_CHARS + 5000) }];
  const r = await addon("fw-one-huge", "add a page listing our opening hours", {
    kinds: ["page"], publishes: true, storedPages: stored,
    written: [writtenPage("/hours")],
    answers: { page: { page: [{ path: "/hours", name: "Hours", purpose: "say when we are open", sections: ["a table"], components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const t = pagePrompt(r).text;
  assert.deepEqual(shownPaths(t), ["index.tsx"], "the only page the site has was not shown");
  assert.match(t.replace(/\\n/g, " "), /RETURN ONLY WHAT IS NEW OR CHANGED/, "the contract went with the window");
  assert.doesNotMatch(t, /ARE UNCHANGED:/, "the one page shown was also named as one that could not be shown");
  assert.equal(r.body.unseenPages, undefined, "the one page shown was reported as unseen");
});

// ─────────────────────────────────────────────────────────────────────────────
// A COMBINED PAGE + PHOTOGRAPH ASK (2026-09-17)
//
// "add a gallery page showing photos of our work" picks `page` AND `photo`.
// `photo` is the one DISPATCHED kind, so it is set aside with a sentence —
// *"ask for it on its own and I'll place it"* — and the page is built and
// published. Three things were wrong with that, all measured through this
// route before anything was touched:
//
//   1. The writer was told *"PHOTOGRAPHS: none on this site"* whatever the site
//      really had. On a site showing two, identically.
//   2. It asked for `<SafeImage>` with NO src — and the picture rung, the rung
//      being promised, fills a slot by rewriting a `src` attribute. Measured:
//      that shape reads as ZERO slots, and `src=""` as one. So the addon wrote
//      the one shape its own next step cannot fill.
//   3. `photos` counts `@@IMG:` tokens, which this step forbids, so the
//      customer was never told the new page has empty frames they can fill.
// ─────────────────────────────────────────────────────────────────────────────
const PHOTO_SITE = [{
  path: "index.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { SafeImage } from '@/components/ui/safe-image'\n"
    + "export const Route = createFileRoute('/')({ component: Home })\n"
    + "function Home(){ return <main><h1>Fretwork</h1>\n"
    + '  <SafeImage src="/u/fw-photo/a1b2c3d4.jpg" alt="the workshop bench" />\n'
    + '  <SafeImage src="/u/fw-photo/e5f6a7b8.jpg" alt="a guitar being refretted" />\n'
    + "</main> }\n",
}];
const galleryWith = (imgs) => ({
  path: "src/routes/gallery.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { SafeImage } from '@/components/ui/safe-image'\n"
    + "export const Route = createFileRoute('/gallery')({ component: P })\n"
    + "function P(){ return <main><h1>Gallery</h1>" + imgs + "</main> }\n",
});
const photoAsk = (slug, opts) => addon(slug, "add a gallery page showing photos of our work", {
  publishes: true,
  answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
    sections: ["a grid of photographs"], components: ["card"] }] } },
  ...opts,
});

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE + PHOTOGRAPH IN ONE REQUEST (2026-09-17)

   Owner: *"proceed to completing page + photo in one request. Placeholders and
   asking the customer to repeat the photo request do not complete that
   capability. Start with stubbed-provider verification."*

   MEASURED THROUGH THE ROUTE BEFORE ANY OF THIS EXISTED, on the ask below:
   `kinds: ["page"] / skipped: ["photo"]`, a gallery page whose every picture
   was `<SafeImage src="">`, nothing bought, and the customer told to ask for
   the photograph again.

   THE PROVIDER IS STUBBED IN ITS OWN TWO HOPS — `genSitePhoto` POSTs to fal
   and then FETCHES the url fal answers with — and every prompt it is paid for
   is recorded, because a case about buying photographs is about WHICH pictures
   were bought and the reply's count alone cannot say that.
   ═════════════════════════════════════════════════════════════════════════ */

/** The gallery page as a writer that OBEYED the directive really returns it. */
const galleryToken = (describe) => galleryWith(
  '<SafeImage src="@@IMG:' + describe + '@@" alt="the workshop bench" />');

/** The same ask, with a designed picture and a balance that can pay for it. */
const boughtAsk = (slug, shots, opts) => photoAsk(slug, {
  kinds: ["page", "photo"], credits: 400,
  written: [galleryToken(shots[0].describe)],
  answers: {
    page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
      sections: ["a grid of photographs"], components: ["card"] }] },
    photo: { photo: shots },
  },
  ...opts,
});

const BENCH = "the workshop bench under the window, warm afternoon light";

test("THE COMBINED REQUEST: one ask buys the photograph and puts it on the page it added", async () => {
  const r = await boughtAsk("fw-both", [{ page: "/gallery", describe: BENCH }]);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // 1. NOTHING IS HANDED OFF. This is the whole of what the owner asked for:
  //    the photograph rode the same request as the page.
  assert.deepEqual(r.body.kinds, ["page", "photo"], "the photograph was not designed in this change");
  assert.deepEqual(r.body.skipped, [], "the photograph was set aside — the hand-off is back");

  // 2. THE WRITER WAS GIVEN THE EXACT TOKEN, page by page — `imageDirective`'s
  //    list form, which is the build path's own reader rather than a second
  //    shape beside it. The words inside a token are the prompt an image model
  //    is PAID to draw, so this is asserted verbatim.
  const flat = pagePrompt(r).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  assert.match(flat, /this site gets 1 real photograph, and they are ALREADY CHOSEN/,
    "the writer was told there is nothing to buy on a change that buys one");
  assert.ok(flat.includes('/gallery — <SafeImage src="@@IMG:' + BENCH + '@@"'),
    "the writer was not given the exact token to write, on the page it belongs to");

  // 3. THE PROVIDER WAS PAID FOR THAT PICTURE AND NO OTHER — read off what the
  //    stub really received, not off a count on the reply.
  assert.equal(r.shots.length, 1, "the provider was paid " + r.shots.length + " times for one picture");
  assert.ok(r.shots[0].startsWith(BENCH), "a different picture was bought from the one designed");

  // 4. THE PUBLISHED PAGE CARRIES THE PHOTOGRAPH. Read off the CONTAINER
  //    PAYLOAD — what the route HANDED the thing that builds the site — because
  //    a reply field is a claim and this is the artifact.
  const g = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.ok(g, "no gallery page reached the compiler");
  assert.doesNotMatch(g.source, /@@IMG:/, "the token shipped as text — a broken image with its alt showing");
  assert.match(g.source, /src="\/u\/fw-both\/[0-9a-f]{32}\.jpg"/,
    "the published page has no real photograph in it: " + g.source);

  // 5. AND THE CUSTOMER IS TOLD, in `imageNote`'s own words. `photos` is the
  //    EMPTY-FRAME count and is zero, because the frame was filled — two
  //    numbers under one name is the wrong number wearing a right one's.
  assert.equal(r.body.pictures, 1, "the reply does not say a picture was made");
  assert.equal(r.body.photos, 0, "a frame this change FILLED was reported as an empty space");
  assert.match(String(r.body.pictureNote), /Made 1 photograph/, "the customer was not told the picture was made");
  assert.doesNotMatch(String(r.body.pictureNote), /placeholder/, "the customer was told the picture is a placeholder");

  // 6. AND IT IS BILLED. A photograph is $0.15 of real spend — `IMAGE_USD` —
  //    against the few tokens that placed it, so the picture is nearly all of
  //    this bill and a run that forgot to charge for it would be ~1.
  assert.ok(r.body.cost >= 18, "the photograph was not billed: cost " + r.body.cost);
});

test("a photograph beside a SECTION is designed here too, and lands on the page the section did", async () => {
  // `MAKES_PAGES` IS TWO KINDS AND BOTH HAVE TO BE DRIVEN. A component rewrites
  // a page, so it makes a place for a picture exactly as a new page does — and
  // with only the `page` half driven, narrowing the list to ["page"] passes
  // every other case here.
  const r = await addon("fw-photo-sec", "add a gallery strip to the home page with a photo of the workshop in it", {
    kinds: ["component", "photo"], credits: 400, publishes: true, sitePages: ["/"],
    written: [addedTo("/", '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" />')],
    answers: {
      component: { component: [{ page: "/", does: "show the work", components: ["card"] }] },
      photo: { photo: [{ page: "/", describe: BENCH }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.skipped, [], "a photograph beside a section was handed off");
  assert.equal(r.shots.length, 1, "a photograph beside a section was not bought");
  const home = compiledPages(r).find((p) => p.path.includes("index"));
  assert.match(home.source, /src="\/u\/fw-photo-sec\/[0-9a-f]{32}\.jpg"/,
    "the section's picture never reached the page: " + home.source);
});

test("a picture is bought for what will be PUBLISHED, never for what the writer returned", async () => {
  // ⚠ THE TWO LISTS PART COMPANY, AND ONLY ONE OF THEM IS THE SITE. The
  // picture was designed for `/gallery` and the writer put its token on
  // `/prices` instead — a page nobody asked about, carrying no link to the
  // added route, so `mergeAddonPages` REVERTS it. Buying from `aValid.pages`
  // spends $0.15 on a file no visitor will ever be served; buying from
  // `aMerge.pages` does not.
  //
  // THE DESTINATION IS `/gallery` AND NOT `/prices` ON PURPOSE: a photograph
  // answer naming a page puts that page on `aAskedPages`, and an asked page is
  // KEPT — which is right, and would make this case about a page that shipped.
  // MEASURED: written the other way round, `reverted` comes back `[]`.
  const r = await photoAsk("fw-photo-revert", {
    kinds: ["page", "photo"], credits: 400, sitePages: ["/", "/prices"],
    written: [
      // The added page, correct and with no picture on it.
      writtenPage("/gallery"),
      // The rewrite nobody asked for, carrying the only token in the answer.
      { ...storedPage("/prices"), source: storedPage("/prices").source.replace(
        "</main>", '<SafeImage src="@@IMG:' + BENCH + '@@" alt="x" /></main>') },
    ],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid"], components: ["card"] }] },
      photo: { photo: [{ page: "/gallery", describe: BENCH }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, MEASURED rather than assumed: the rewrite really was
  // reverted, so this case is about a withheld page and not about a page that
  // shipped.
  assert.ok((r.body.reverted || []).some((p) => String(p).includes("prices")),
    "the unasked rewrite was published after all — this case tests nothing: " + JSON.stringify(r.body.reverted));
  assert.deepEqual(r.shots, [], "a photograph was bought for a page nobody will be served");
  assert.equal(r.body.pictures, undefined);
  const prices = compiledPages(r).find((p) => p.path.includes("prices"));
  assert.doesNotMatch(prices.source, /@@IMG:|\/u\//, "the reverted page is not the stored one: " + prices.source);
});

test("a token in a component this change never touched is not bought", async () => {
  // A STORED COMPONENT'S SOURCE IS NOT THIS CHANGE'S TO SWEEP OR TO PAY FOR.
  // `aParts` is `null` when no component was written, and handing the STORED
  // list to the purchase instead would plan from a file nobody asked about —
  // money spent on a page this change is not writing, and a write-back over a
  // component it never saw. A token can really be there: a site published
  // before the sweep existed carries one.
  //
  // ⚠ TWO SHOTS AND ONE TOKEN, BECAUSE THE BUDGET IS WHAT DISCRIMINATES.
  // MEASURED: with one shot and one token in the page, `planImages` fills its
  // budget from the page and stops, so the stranger's token is never reached
  // and the stored list could be handed in with nothing to show for it. With
  // room left over, buying from the stored components buys it — the honest
  // half of the case is the picture that IS bought, and the wall is the one
  // that is not.
  const r = await boughtAsk("fw-photo-stored", [
    { page: "/gallery", describe: BENCH },
    { page: "/gallery", describe: "the lathe with its belt guard open" },
  ], {
    parts: [{ name: "old-strip", source: 'export default function S(){ return <SafeImage src="@@IMG:a stranger\'s picture@@" alt="x" /> }' }],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.shots.length, 1, "a stored component's token was paid for: " + JSON.stringify(r.shots));
  assert.ok(r.shots[0].startsWith(BENCH), "the wrong picture was bought");
  assert.ok(!r.shots.some((s) => s.includes("stranger")), "a stranger's picture was bought: " + JSON.stringify(r.shots));
});

test("more pictures than the platform will buy are refused at the cleaner, by the platform's own cap", async () => {
  // THE CEILING IS `IMAGE_CAP` AND IT IS THE SPEND PATH'S, not a number of the
  // add step's: `planImages` slices there too, so a wider cap here would clean
  // an entry nothing downstream will ever buy — and the customer would be told
  // it was added.
  const SITE_P = { name: "x", kind: "shopfront", pages: ["/"], tables: [], hasDatabase: false, qr: null, three: null, tsx: [] };
  const many = Array.from({ length: IMAGE_CAP + 1 }, (_, i) => ({ page: "/", describe: "picture number " + i }));
  const c = cleanAdd("photo", many, SITE_P);
  assert.equal(c.value.length, IMAGE_CAP, "the cleaner kept " + c.value.length + " pictures against a cap of " + IMAGE_CAP);
  assert.deepEqual(c.skipped, [{ why: "over-cap", name: "" }], "the ones left out were not named");
});

test("a photograph ALONE is still the picture rung's, and buys nothing here", async () => {
  // THE PROPERTY THAT MUST NOT REGRESS. That rung fills a slot that EXISTS,
  // prices one against the real balance and refuses honestly; this step is only
  // right when it is the one MAKING the slot. A change that designed a picture
  // for every `photo` ask would take that rung's work and its refusals with it.
  const r = await addon("fw-photo-alone", "put a photo of the workshop on the home page", {
    kinds: ["photo"], credits: 400,
  });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.escalate, true, JSON.stringify(r.body));
  assert.equal(r.body.reason, "layer", "a photograph on its own no longer hops sideways");
  assert.equal(r.body.layer, "picture", "a photograph on its own stopped naming the rung that places one");
  assert.equal(r.body.kind, "photo");
  assert.deepEqual(r.shots, [], "a photograph was bought on a request this step does not own");
  assert.equal(r.compiles.length, 0, "a hand-off compiled a site");
});

test("a photograph beside a kind that writes no page is still set aside", async () => {
  // `MAKES_PAGES` IS THE LINE AND THIS IS ITS OTHER SIDE. A table reaches the
  // page call too, and it is no reason to put a PHOTOGRAPH on a page — so the
  // hand-off survives for every kind that is not making the place for one.
  const r = await addon("fw-photo-table", "add a bookings table and a photo of the workshop", {
    kinds: ["table", "photo"], credits: 400, publishes: true,
    answers: { table: { table: [{ table: { name: "bookings", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.skipped, ["photo"], "a photograph beside a table was designed here");
  assert.deepEqual(r.shots, [], "a photograph was bought beside a table");
});

test("a provider that refuses costs nothing, sweeps the token, and says so", async () => {
  // THE ARM WHERE THE MONEY IS NOT SPENT. `makeSitePhoto` answers no url, so
  // `applyImages` sweeps the token to the empty src `SafeImage` draws its
  // placeholder from — the one outcome that must never be the literal
  // `@@IMG:…@@`, which is a broken image AND a leak of how the site was made.
  const r = await boughtAsk("fw-photo-down", [{ page: "/gallery", describe: BENCH }], { shotFail: true });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.shots.length, 1, "the provider was never tried, so this case is not about it refusing");
  const g = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.doesNotMatch(g.source, /@@IMG:/, "a refused picture left its token in the published page");
  assert.match(g.source, /src=""/, "the swept slot is not one the picture rung can fill");
  assert.equal(r.body.pictures, undefined, "a picture that never arrived was counted as made");
  assert.match(String(r.body.pictureNote), /Couldn't make the photographs/, "the customer was not told why the frame is empty");
  // AND NOT BILLED. `made`, never `planned` — the build path's own rule and the
  // picture rung's: the working balance moves on success and not on the attempt.
  assert.ok(r.body.cost <= 2, "a photograph that did not arrive was billed: cost " + r.body.cost);
  // …AND THE FRAME IT LEFT IS REPORTED, so the customer knows the space is
  // theirs. This is the half `photoNote` has always had and it must survive.
  assert.equal(r.body.photos, 1, "the empty frame a refused picture left was not counted");
});

test("a picture may land on a page this change is adding, and not on one nobody has", async () => {
  // THE SAME DESTINATION READER EVERY PLACING KIND USES. `going` is what the
  // site WILL have — its pages plus the ones this message is adding — so a
  // picture on the new /gallery resolves and one on a page nobody has is
  // refused BY NAME, never moved to the home page. A photograph is bought, so
  // the silent substitution the owner corrected on the component tier is worse
  // here: it spends money putting a picture where nobody asked for one.
  const bad = await photoAsk("fw-photo-where", {
    kinds: ["page", "photo"], credits: 400, written: [galleryToken(BENCH)],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid"], components: ["card"] }] },
      photo: { photo: [{ page: "/prices", describe: BENCH }] },
    },
  });
  assert.equal(bad.status, 422, JSON.stringify(bad.body));
  assert.equal(bad.body.reason, "no-page", "a picture aimed at a page nobody has was placed somewhere");
  assert.deepEqual(bad.shots, [], "a picture with no destination was paid for");
  assert.equal(bad.body.cost, 0, "a refused addition was billed");

  // THE CONTROL, one field apart: the page THIS CHANGE IS ADDING is a real
  // destination, which is what makes the refusal above about the route rather
  // than about pictures never being placeable.
  const ok = await boughtAsk("fw-photo-planned", [{ page: "/gallery", describe: BENCH }]);
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  assert.equal(ok.shots.length, 1, "a picture on a page this same change adds was not bought");
});

test("the sweep belt still fires on a change that buys nothing", async () => {
  // THE BELT THE PURCHASE MOVED, AND WHY IT COULD NOT SIMPLY GO. It used to run
  // unconditionally and was stripping the tokens the purchase is for — measured
  // through the route, `plan.shots` came back 0 on a run whose writer wrote the
  // token exactly as asked. It waits for the buying branch now, so what has to
  // be proved is that it still runs on the branch that does not: the directive
  // forbids a token and a model can write one regardless.
  const r = await photoAsk("fw-photo-belt", { kinds: ["page"], written: [galleryToken("a chair")] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.shots, [], "a change with no photograph kind bought one");
  const g = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.doesNotMatch(g.source, /@@IMG:/, "an unbought token shipped as text on a change that buys nothing");
  assert.match(g.source, /src=""/, "the belt swept the token to something the picture rung cannot fill");
});

test("a page added to a site that has photographs is not told the site has none", async () => {
  const r = await photoAsk("fw-photo", {
    kinds: ["page", "photo"], storedPages: PHOTO_SITE, written: [galleryWith("")],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // ── RE-ANCHORED 2026-09-17: THE SUBJECT IS THE INVENTORY, NOT THE HAND-OFF ─
  //
  // This asserted `skipped: ["photo"]` as the precondition, which was how a
  // page + photograph ask behaved until this change: set aside, hand-off, ask
  // again. That ask now DESIGNS the picture here, so the set-aside list is
  // empty — and the sentence under test is about what the SITE already shows,
  // which is stated on every run that buys nothing. The precondition is the
  // real one: no purchase was made, so the object form was sent.
  assert.deepEqual(r.body.skipped, [], "a photograph beside a page is set aside again — the hand-off is back");
  assert.equal(r.body.pictures, undefined, "this case bought a photograph, so it is no longer about the zero budget");
  const flat = pagePrompt(r).text.replace(/\\n/g, " ");
  assert.doesNotMatch(flat, /PHOTOGRAPHS: none on this site/,
    "the writer was told this site has no photographs, on a site showing two — the reported defect");
  assert.match(flat, /already shows 2 real photographs/, "the writer was not told what the site really has");
  assert.match(flat, /this change buys none/, "the zero budget stopped being stated as ours");
  // AND NAMING THEM IS ONLY HALF OF IT. A page writer edits what it is shown,
  // and the two photographs above are on a page this change hands it back in
  // full — so the count without the instruction tells it they are there and
  // nothing about leaving them alone. They cost real money and the owner
  // already paid it.
  assert.match(flat, /do not replace one, and do not remove it/,
    "the site's own photographs were named to the writer and not protected");
  // THE BUDGET IS UNCHANGED AND MUST BE: this step may never re-buy a set the
  // owner already has, which is what `budgetFor`'s zero exists for.
  assert.match(flat, /do not write any @@IMG:@@ token/i, "the addon started inviting a purchase");

  // AND THE CONTROL, so the assertion above is about the SITE and not about the
  // wording moving for everyone: the same ask on a site with no photographs
  // gets the other sentence, and still not the false one.
  const none = await photoAsk("fw-photo-none", { kinds: ["page", "photo"], written: [galleryWith("")] });
  const flatNone = pagePrompt(none).text.replace(/\\n/g, " ");
  assert.match(flatNone, /shows no real photographs yet/, "a site with none was not told so");
  assert.doesNotMatch(flatNone, /already shows/, "a site with none was told it has some");
});

test("a photograph inside an existing CUSTOM COMPONENT counts, and is not reported as a placeholder", async () => {
  // ⚠ THE REPORTED BASELINE DEFECT (owner, 2026-09-17): a photograph inside an
  // existing custom component produced *"This site shows no real photographs
  // yet; every picture on it is a placeholder."* — which is the opposite of
  // true, in the sentence that tells the writer what it may not touch.
  //
  // THE CAUSE IS THAT THE READER'S INVENTORY WAS PAGES ONLY. A site's own
  // components live at `src/routes/-parts/<name>.tsx` and travel in their own
  // list, and `imageSources(pages, parts)` is the one definition of the files
  // the image steps operate on — so reading `aSrc` alone asks about part of
  // the site and answers about all of it.
  //
  // MEASURED at the module before the fix: `shownPhotos(pages)` 0 against
  // `shownPhotos(imageSources(pages, parts))` 1, on the same site.
  const part = { name: "gallery-grid", source: 'export function GalleryGrid(){return <div><SafeImage src="/u/fw-pic/hero.jpg" alt="the workshop" /></div>}' };
  const r = await addon("fw-pic", "add a caption under the gallery", {
    kinds: ["component"], publishes: true, sitePages: ["/"],
    parts: [part], look: { tsx: [{ name: "gallery-grid", does: "the grid", props: "rows" }] },
    written: [addedTo("/", "<p>A caption.</p>")],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const flat = pagePrompt(r).text.replace(/\\n/g, " ");
  assert.doesNotMatch(flat, /shows no real photographs yet/,
    "a site whose component holds a photograph was told every picture on it is a placeholder — the reported defect");
  assert.match(flat, /already shows 1 real photograph/, "the photograph inside the component was not counted");
  assert.match(flat, /do not replace one, and do not remove it/,
    "the photograph was counted and not protected, which is the half a model reads past");

  // ⚠ AND AN UNREADABLE STORE MUST NOT REPORT THE SITE'S OWN FRAMES AS SPACES
  // THIS CHANGE MADE. That is the customer-facing end of the same symmetry: the
  // components come off both sides of the frame count or neither, and here
  // `readSiteParts` answers `parts: []` so both sides are already empty. A
  // first cut wrote a flag saying so and it was dead by construction — no
  // single mutant and no PAIR mutant could kill it, measured over seven shapes
  // — so the flag is gone and this drives the property instead.
  const held = await addon("fw-pic-blind-frames", "add a caption under the gallery", {
    kinds: ["component"], publishes: true, sitePages: ["/"], partsFail: true,
    parts: [{ name: "gallery-grid", source: 'export function G(){return <div><SafeImage src="" alt="a space" /></div>}' }],
    look: { tsx: [{ name: "gallery-grid", does: "the grid", props: "rows" }] },
    written: [addedTo("/", "<p>A caption.</p>")],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  assert.equal(held.body.photos, 0,
    "an unreadable component store reported the site's own frames as new spaces: " + held.body.photos);

  // AND AN INCOMPLETE INVENTORY IS NOT A CLAIM THAT EVERY IMAGE IS A
  // PLACEHOLDER (the owner's own sentence). A component store that could not
  // be read means nobody looked, so the honest answer is the third one: leave
  // every picture alone, and claim nothing in either direction.
  const blind = await addon("fw-pic-blind", "add a caption under the gallery", {
    kinds: ["component"], publishes: true, sitePages: ["/"], partsFail: true,
    parts: [part], look: { tsx: [{ name: "gallery-grid", does: "the grid", props: "rows" }] },
    written: [addedTo("/", "<p>A caption.</p>")],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });
  const flatBlind = pagePrompt(blind).text.replace(/\\n/g, " ");
  assert.doesNotMatch(flatBlind, /shows no real photographs yet/,
    "a store we could not read was reported as a site with no photographs — cannot-tell read as a value");
  assert.match(flatBlind, /Leave every picture already on this site exactly as it is/,
    "an unreadable component store did not get the third sentence: " + (flatBlind.match(/PHOTOGRAPHS:[^\n]{0,200}/) || [""])[0]);
});

test("an UNCHANGED component's own empty frame is not a frame this change added", async () => {
  // ⚠ THE SECOND REPORTED BASELINE DEFECT (owner, 2026-09-17): returning an
  // unchanged custom component containing one empty frame reported one newly
  // added frame. `newEmptySlots` keys per FILE, so a component the site
  // already has had no before at all and every frame in it read as new.
  //
  // MEASURED through this route before the fix: `photos: 1` on a change that
  // returned the component byte-identical.
  const EMPTY = '<SafeImage src="" alt="a space for a picture" />';
  const part = (body) => ({ name: "gallery-grid", source: "export function GalleryGrid(){return <div>" + body + "</div>}" });
  const ask = (slug, back) => addon(slug, "add a caption under the gallery", {
    kinds: ["component"], publishes: true, sitePages: ["/"],
    parts: [part(EMPTY)], look: { tsx: [{ name: "gallery-grid", does: "the grid", props: "rows" }] },
    written: [addedTo("/", "<p>A caption.</p>")], writtenParts: [part(back)],
    answers: { component: { component: [{ page: "/", does: "a caption", components: ["card"] }] } },
  });

  const same = await ask("fw-frame-same", EMPTY);
  assert.equal(same.body.ok, true, JSON.stringify(same.body));
  assert.equal(same.body.photos, 0, "a component returned byte-identical was reported as a newly added empty frame");

  // THE CONTROL, and it is what makes the assertion above about the BEFORE
  // rather than about components being ignored: the same component gaining a
  // second frame is one new frame, not two and not none.
  const grown = await ask("fw-frame-grown", EMPTY + EMPTY);
  assert.equal(grown.body.photos, 1, "a real new frame inside a component was not counted: " + grown.body.photos);
});

test("a photograph asked for and not bought still leaves a slot the picture rung can fill", async () => {
  // ── RE-ANCHORED 2026-09-17, AND THE PROPERTY GOT WIDER RATHER THAN NARROWER ─
  //
  // The clause was written for the HAND-OFF: a photograph set aside beside
  // another kind, where the next rung fills a slot by rewriting a `src` and an
  // element with none is invisible to it. A page + photograph ask is no longer
  // a hand-off — it buys — so the trigger is now the honest one: a picture was
  // ASKED FOR on this change and is not being bought.
  //
  // THIS CASE IS THAT STATE AND IT IS THE ONE THAT NEARLY SHIPPED WRONG.
  // `photoAsk` supplies no balance, so `imagesAffordable` cuts every shot and
  // the object form goes out. Keyed on `aSkipped` alone — which is empty here —
  // the page would have published with no slot at all while the customer was
  // told the pictures are placeholders. An older guard going red is what found
  // it.
  //
  // THE DESIGNER REALLY ANSWERS AND THE BALANCE REALLY REFUSES, which is the
  // only shape that separates "could not afford it" from "nobody described
  // one": a photograph is `SITE_PHOTO_USD` / `CREDIT_USD` ≈ 19 credits, and
  // one credit cannot buy it.
  const r = await photoAsk("fw-photo-slot", {
    kinds: ["page", "photo"], written: [galleryWith("")], credits: 1,
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
      sections: ["a grid of photographs"], components: ["card"] }] },
      photo: { photo: [{ page: "/gallery", describe: "a refret on the bench under the window" }] } },
  });
  assert.deepEqual(r.body.skipped, [], "this case is the hand-off after all, not the unaffordable picture");
  assert.deepEqual(r.shots, [], "a picture was PAID FOR on a balance that cannot afford one");
  assert.equal(r.body.pictures, undefined, "a picture was bought, so this is not the no-purchase state");
  const flat = pagePrompt(r).text.replace(/\\n/g, " ");
  assert.match(flat, /an EMPTY src, never a missing one/,
    "the writer was not asked for a fillable slot, so the picture rung has nowhere to put one");
  assert.match(flat, /the slot the picture step fills/, "the reason was dropped, which is the half a model reads past");
  // AND THE CUSTOMER IS TOLD WHY, in the composer's own words rather than in a
  // second copy of them here — silence would read as "no photograph was ever
  // asked for", which is the one thing they know is false.
  assert.match(String(r.body.pictureNote || ""), /Not enough credits/, "a picture nobody could afford was not explained");

  // THE CONTROL: an ask that names no photograph gets no slot instruction, so
  // the clause above is about the request rather than about every addon.
  const plain = await photoAsk("fw-photo-plain", { kinds: ["page"], written: [galleryWith("")] });
  assert.deepEqual(plain.body.skipped, [], "the control set a photograph aside after all");
  assert.equal(plain.body.pictureNote, undefined, "a change nobody asked a photograph of said something about pictures");
  assert.doesNotMatch(pagePrompt(plain).text.replace(/\\n/g, " "), /an EMPTY src, never a missing one/,
    "a change nobody asked a photograph of was told to leave picture slots");
});

test("the empty frames a new page really has are counted and said", async () => {
  const two = '<SafeImage src="" alt="a refret on the bench" /><SafeImage src="" alt="the finished guitar" />';
  const r = await photoAsk("fw-photo-count", { kinds: ["page", "photo"], written: [galleryWith(two)] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.photos, 2, "the two empty frames on the new page were not counted");

  // THE CONTROL THAT NAMES THE CAUSE: the same page written the way the OLD
  // directive asked for — `<SafeImage>` with no src — is zero, because that is
  // not a frame the picture rung can fill and promising it would be a space
  // nobody can use.
  const srcless = galleryWith(two.replace(/src="" /g, ""));
  const none = await photoAsk("fw-photo-srcless", { kinds: ["page", "photo"], written: [srcless] });
  assert.equal(none.body.photos, 0, "a src-less SafeImage was reported to the customer as a space for a photo");

  // AND AN UNTOUCHED PAGE'S OWN EMPTY FRAMES ARE NOT THIS CHANGE'S. The site
  // here already carries two filled ones; a site carrying empty ones must not
  // have them reported as spaces this change made.
  const already = [{ ...PHOTO_SITE[0], source: PHOTO_SITE[0].source.replace(/src="\/u\/[^"]*"/g, 'src=""') }];
  const kept = await photoAsk("fw-photo-kept", {
    kinds: ["page", "photo"], storedPages: already, written: [galleryWith("")],
  });
  assert.equal(kept.body.photos, 0, "the home page's existing empty frames were reported as new spaces");

  // AND A TOKEN THE MODEL WROTE ANYWAY IS STILL COUNTED — the half this path
  // has always had, which must survive the half it just gained. The directive
  // forbids `@@IMG:` and a model can write one regardless; `applyImages` then
  // sweeps it to `src=""`, so the frame is real and the customer has to hear
  // about it.
  //
  // RE-ANCHORED 2026-09-17: this assertion used to rest on TWO counters taken
  // before that sweep, disjoint because a token is a non-empty src there.
  // There is ONE now, taken AFTER it, and the property is why that is enough
  // rather than a loss — a swept token IS an empty frame, so the same reader
  // sees both shapes and nothing can be reported twice. The one thing it
  // stops counting is a token in an element with no `alt`, which is right:
  // the picture rung finds a slot BY its alt text, so promising that one is
  // the missing-`src` mistake wearing another hat. `lintPages` reports it.
  const tok = await photoAsk("fw-photo-token", {
    kinds: ["page", "photo"],
    written: [galleryWith('<SafeImage src="@@IMG:a refret on the bench@@" alt="a refret" />')],
  });
  assert.equal(tok.body.photos, 1, "a token written despite the ban was not counted as a space");
});

/* ═══════════════════════════════════════════════════════════════════════════
   BUYING A PHOTOGRAPH MAY NOT LOSE THE ONES ALREADY THERE (2026-09-17)

   Owner: *"Preserve existing photographs when buying new ones. The paid-photo
   directive currently says every other picture should have no src. Correct
   that instruction and prevent an addon from accepting removal or replacement
   of existing image references in pages and custom components."*

   REPRODUCED THROUGH THIS ROUTE BEFORE ANYTHING WAS TOUCHED, on the ask below.
   The paid directive's tail read *"Do NOT invent an extra token: any other
   picture stays a <SafeImage> with no src, which renders this theme's own
   placeholder — that is the intended look for the rest of the site."* — true
   of a first build and, on a site showing two bought photographs, an
   instruction to strip them. The writer did: the compiler payload and
   `source/<slug>/pages.json` each came back with ZERO `/u/` urls, the customer
   was told *"Made 1 photograph for the site."*, and the two stripped pictures
   were counted as `photos: 2` — empty frames this change had ADDED.
   ═════════════════════════════════════════════════════════════════════════ */

/** A site whose home page already shows two photographs it paid for. */
const photoHome = (slug) => ({
  path: "index.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { SafeImage } from '@/components/ui/safe-image'\n"
    + "export const Route = createFileRoute('/')({ component: Home })\n"
    + "function Home(){ return <main><h1>Fretwork</h1>\n"
    + '  <SafeImage src="/u/' + slug + '/a1b2c3d4.jpg" alt="the workshop bench" />\n'
    + '  <SafeImage src="/u/' + slug + '/e5f6a7b8.jpg" alt="a guitar being refretted" />\n'
    + "</main> }\n",
});
/** The same ask on such a site, with the home page returned however the case says. */
const keepAsk = (slug, home, opts) => photoAsk(slug, {
  kinds: ["page", "photo"], credits: 400, storedPages: [photoHome(slug)],
  written: [galleryToken(BENCH), home],
  answers: {
    page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
      sections: ["a grid of photographs"], components: ["card"] }] },
    photo: { photo: [{ page: "/gallery", describe: BENCH }] },
  },
  ...opts,
});
/** The home page with a link to the new route, so the merge keeps the change. */
const linkHome = (slug, body) => ({
  path: "index.tsx",
  source: photoHome(slug).source.replace("</main>",
    '  <p>Also see the <a href="/gallery">gallery</a>.</p>\n</main>').replace(
    '<SafeImage src="/u/' + slug + '/a1b2c3d4.jpg" alt="the workshop bench" />', body),
});

test("a change that buys a photograph may not take the ones already there off the site", async () => {
  // ── THE REPRODUCTION ─────────────────────────────────────────────────────
  //
  // The writer does exactly what the old tail asked for: the new token on the
  // new page, and every OTHER picture left with no src of its own.
  const r = await keepAsk("fw-strip",
    linkHome("fw-strip", '<SafeImage src="" alt="the workshop bench" />'));

  // 1. THE DIRECTIVE NO LONGER INVITES IT, and says what the site has instead.
  const flat = pagePrompt(r).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  assert.match(flat, /this site gets 1 real photograph/, "this case is not about a paid directive at all");
  assert.doesNotMatch(flat, /any other picture stays a <SafeImage> with no src/,
    "the paid directive still tells the writer every other picture has no src — the reported defect");
  assert.match(flat, /already shows 2 real photographs, and they stay exactly as they are/,
    "the paid directive does not say what the site already shows: " + (flat.match(/PHOTOGRAPHS:[^|]{0,600}/) || [""])[0]);
  assert.match(flat, /A picture this change ADDS beyond those is a <SafeImage> with an EMPTY src/,
    "the ban stopped being scoped to what this change adds, or went back to a missing src");

  // 2. AND THE WALL REFUSES THE ANSWER ANYWAY. A prompt is what should stop it;
  //    this is what stops it reaching the customer's site if it happens anyway.
  assert.equal(r.status, 422, JSON.stringify(r.body));
  // `ok` AND THE STATUS, because the browser reads the field and not the code:
  // a 422 carrying `ok: true` is rendered as a successful change.
  assert.equal(r.body.ok, false, "a refused change reported itself as done");
  assert.equal(r.body.error, "lost-photos");
  assert.equal(r.body.cost, 0, "a refused change was charged");
  assert.deepEqual(r.body.lostPhotos, ["/u/fw-strip/a1b2c3d4.jpg"], "the lost photograph was not named for the developer");

  // 3. NOTHING WAS PUBLISHED AND NOTHING WAS BOUGHT — the compiler payload is
  //    the artifact, and the provider's own record is what says no money moved.
  assert.deepEqual(compiledPages(r), [], "a refused change reached the compiler");
  assert.deepEqual(r.shots, [], "a refused change bought its replacement photograph anyway");

  // 4. AND THE SITE IS AS IT WAS, read off `source/<slug>/pages.json` — the file
  //    the NEXT edit works from. A change that refused at the reply and still
  //    wrote the store would lose the picture one request later.
  assert.match(storedSource(r, "fw-strip", "index.tsx"), /\/u\/fw-strip\/a1b2c3d4\.jpg/,
    "the stored home page lost the photograph on a request that was refused");

  // 5. AND THE CUSTOMER IS TOLD, in a sentence they can act on: what it would
  //    have cost them, that nothing happened, and what to ask for instead.
  assert.match(String(r.body.msg), /without taking one of the photographs already on your site off it/);
  assert.match(String(r.body.msg), /Nothing was published and nothing was charged/);
  assert.match(String(r.body.msg), /ask again/);
  assert.match(String(r.body.msg), /leave it exactly where it is/, "the singular reads as the plural");

  // AND THE COUNT IS A COUNT. The same ask with BOTH pictures stripped — a
  // sentence that says "one" whatever was lost tells the owner of a
  // photograph-led site that one picture is at stake when it is all of them.
  const two = await keepAsk("fw-strip-2", {
    path: "index.tsx",
    source: linkHome("fw-strip-2", '<SafeImage src="" alt="the workshop bench" />').source
      .replace('<SafeImage src="/u/fw-strip-2/e5f6a7b8.jpg" alt="a guitar being refretted" />',
        '<SafeImage src="" alt="a guitar being refretted" />'),
  });
  assert.equal(two.status, 422, JSON.stringify(two.body));
  assert.equal(two.body.lostPhotos.length, 2, "the second stripped photograph was not seen: " + JSON.stringify(two.body.lostPhotos));
  assert.match(String(two.body.msg), /taking 2 of the photographs already on your site off it/,
    "two lost photographs were reported as one: " + two.body.msg);
  assert.match(String(two.body.msg), /leave them exactly where they are/);
});

test("the same request that keeps them buys the photograph and publishes — the control", async () => {
  // THE CONTROL, and it is what makes the case above about the LOSS rather than
  // about the wall refusing every purchase on a photographed site: the same ask,
  // the same site, the same designed picture, the same page added — with the two
  // existing photographs left where they were.
  const r = await keepAsk("fw-keep",
    linkHome("fw-keep", '<SafeImage src="/u/fw-keep/a1b2c3d4.jpg" alt="the workshop bench" />'));
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.lostPhotos, undefined, "a change that kept every photograph was reported as losing one");

  // THE COMPILER PAYLOAD: both old pictures on the home page, the new one on the
  // page this change added.
  const home = compiledPages(r).find((p) => p.path.includes("index"));
  const gal = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.deepEqual((home.source.match(/\/u\/fw-keep\/[a-z0-9]+\.jpg/g) || []),
    ["/u/fw-keep/a1b2c3d4.jpg", "/u/fw-keep/e5f6a7b8.jpg"],
    "the home page did not reach the compiler with both of its photographs: " + home.source);
  assert.match(gal.source, /src="\/u\/fw-keep\/[0-9a-f]{32}\.jpg"/,
    "the bought photograph never reached the page it was designed for: " + gal.source);

  // THE STORED SOURCE — a third claim, and the one the next edit reads.
  assert.match(storedSource(r, "fw-keep", "index.tsx"), /a1b2c3d4\.jpg[\s\S]*e5f6a7b8\.jpg/,
    "the stored home page lost a photograph on a change that published");

  // AND THE CUSTOMER HEARS ABOUT THE PURCHASE AND NOTHING ELSE.
  assert.equal(r.shots.length, 1, "the picture was not bought, so this control proves nothing");
  assert.equal(r.body.pictures, 1);
  assert.match(String(r.body.pictureNote), /Made 1 photograph/);
  assert.doesNotMatch(String(r.body.pictureNote), /credits/, "a change that could afford its picture was told about credits");
});

test("a photograph MOVED between components is kept, not refused", async () => {
  // ⚠ THE PROPERTY THAT MAKES THIS WALL SITE-WIDE RATHER THAN PER FILE, and the
  // one a `keptProse`-shaped copy would get wrong. The writer takes a picture
  // out of one component and puts it in another it is adding: every photograph
  // the site shows is still shown, and the customer has lost nothing. A
  // per-file check sees `gallery-strip` losing one and refuses a legitimate
  // reorganisation.
  //
  // ⚠ IT IS COMPONENT-TO-COMPONENT, AND MEASURING WHY IS ITSELF A FINDING. The
  // obvious shape — a `<SafeImage>` moved off the home page into a new
  // component — is already refused one wall earlier, by `keptProse`: an `alt`
  // is WORDS, so the page that gave the picture up lost *"a guitar being
  // refretted"* and the change comes back `error: "rewrote"`. Driven, before
  // this case was rewritten. `keptProse` loops `aMerge.changed` PAGES and never
  // the parts, so a move between two components is the shape where the two
  // readings of this wall really differ.
  const strip = (body) => ({
    name: "gallery-strip",
    source: 'import { SafeImage } from "@/components/ui/safe-image"\n'
      + "export function GalleryStrip(){ return <div>" + body + "</div> }",
  });
  const HAD = '<SafeImage src="/u/fw-move/e5f6a7b8.jpg" alt="a guitar being refretted" />';
  const r = await addon("fw-move", "add a photo wall beside the gallery strip", {
    kinds: ["component", "photo"], credits: 400, publishes: true, sitePages: ["/"],
    parts: [strip('<SafeImage src="/u/fw-move/a1b2c3d4.jpg" alt="the bench" />' + HAD)],
    look: { tsx: [{ name: "gallery-strip", does: "the strip", props: "rows" }] },
    written: [addedTo("/", "<PhotoWall />")],
    writtenParts: [
      // The first component gives one up…
      strip('<SafeImage src="/u/fw-move/a1b2c3d4.jpg" alt="the bench" />'),
      // …and the one this change adds takes it, beside the picture being bought.
      {
        name: "photo-wall",
        source: 'import { SafeImage } from "@/components/ui/safe-image"\n'
          + "export function PhotoWall(){ return <div>" + HAD
          + '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the new one" /></div> }',
      },
    ],
    answers: {
      component: { component: [{ page: "/", does: "show the work", components: ["card"] }] },
      photo: { photo: [{ page: "/", describe: BENCH }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.lostPhotos, undefined, "a photograph moved between files was reported as lost");

  // MEASURED, so the case cannot pass by the move never happening: the first
  // component really gave it up and the second really has it.
  const after = storedParts(r, "fw-move");
  assert.doesNotMatch(after["gallery-strip"], /e5f6a7b8/,
    "the writer did not move the picture — this case tests nothing: " + after["gallery-strip"]);
  assert.match(String(after["photo-wall"]), /\/u\/fw-move\/e5f6a7b8\.jpg/,
    "the moved photograph is in neither file: " + String(after["photo-wall"]));
  assert.equal(r.shots.length, 1, "the picture beside the move was not bought");
});

test("a CUSTOM COMPONENT that loses a photograph is refused too", async () => {
  // ⚠ THE OTHER HALF OF THE OWNER'S SENTENCE — *"in pages and custom
  // components"*. Since the band split a section IS a component, so a site whose
  // photograph lives in `-parts/gallery-strip.tsx` is the ordinary case rather
  // than an exotic one, and a wall that read only the pages would let exactly
  // that site be stripped while reporting success.
  const part = (body) => ({
    name: "gallery-strip",
    source: 'import { SafeImage } from "@/components/ui/safe-image"\n'
      + "export function GalleryStrip(){ return <div>" + body + "</div> }",
  });
  const ask = (slug, back) => addon(slug, "add a photo of the workshop to the gallery strip", {
    kinds: ["component", "photo"], credits: 400, publishes: true, sitePages: ["/"],
    parts: [part('<SafeImage src="/u/' + slug + '/a1b2c3d4.jpg" alt="the bench" />')],
    look: { tsx: [{ name: "gallery-strip", does: "the strip", props: "rows" }] },
    written: [addedTo("/", "<GalleryStrip />")],
    writtenParts: [part(back)],
    answers: {
      component: { component: [{ page: "/", does: "show the work", components: ["card"] }] },
      photo: { photo: [{ page: "/", describe: BENCH }] },
    },
  });

  // The rewrite drops the site's own photograph and puts the new token in its place.
  const lost = await ask("fw-part-strip", '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" />');
  assert.equal(lost.status, 422, JSON.stringify(lost.body));
  assert.equal(lost.body.ok, false, "a refused change reported itself as done");
  assert.equal(lost.body.error, "lost-photos");
  assert.deepEqual(lost.body.lostPhotos, ["/u/fw-part-strip/a1b2c3d4.jpg"]);
  assert.deepEqual(lost.shots, [], "a refused change bought its replacement anyway");
  // THE BYTES, which is the assertion that matters: the component on disk is
  // exactly as it was.
  assert.match(storedParts(lost, "fw-part-strip")["gallery-strip"], /\/u\/fw-part-strip\/a1b2c3d4\.jpg/,
    "the stored component lost its photograph on a request that was refused");

  // THE CONTROL: the same component keeping what it had and gaining the new one.
  const kept = await ask("fw-part-keep",
    '<SafeImage src="/u/fw-part-keep/a1b2c3d4.jpg" alt="the bench" />'
    + '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the new one" />');
  assert.equal(kept.body.ok, true, JSON.stringify(kept.body));
  assert.equal(kept.shots.length, 1, "the control bought nothing, so it proves nothing");
  const after = storedParts(kept, "fw-part-keep")["gallery-strip"];
  assert.match(after, /\/u\/fw-part-keep\/a1b2c3d4\.jpg/, "the control lost the old photograph: " + after);
  assert.match(after, /\/u\/fw-part-keep\/[0-9a-f]{32}\.jpg/, "the control never got the new photograph: " + after);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE FULL REQUEST AND THE AFFORDABLE ONE ARE TWO LISTS (2026-09-17)

   Owner: *"Carry the full requested photo list separately from the affordable
   purchase list. A two-photo request with credits for one must explain that
   one was omitted because of the balance. Do not imply a placeholder exists
   unless one actually survived publication."*

   REPRODUCED: two pictures designed, a balance covering one, one bought — and
   the customer heard *"Made 1 photograph for the site."* with `photos: 0`
   beside it. Nothing said the second had been asked for, nothing said why it
   was not there, and nothing they could act on. A photograph is 18.75 credits
   (`IMAGE_USD / CREDIT_USD`), so 30 buys exactly one of two.
   ═════════════════════════════════════════════════════════════════════════ */

const LATHE = "the lathe with its belt guard open, shavings on the floor";
/** Two pictures asked for, with the balance the case chooses. */
const twoAsk = (slug, credits) => photoAsk(slug, {
  kinds: ["page", "photo"], credits,
  written: [galleryToken(BENCH)],
  answers: {
    page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
      sections: ["a grid of photographs"], components: ["card"] }] },
    photo: { photo: [{ page: "/gallery", describe: BENCH }, { page: "/gallery", describe: LATHE }] },
  },
});

test("two photographs asked for and credits for one: the omission is explained, with its reason", async () => {
  const r = await twoAsk("fw-half", 30);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE PRECONDITION, MEASURED: the balance really did cut the list, so this
  // case is about a shortfall and not about a designer that asked for one.
  assert.equal(r.shots.length, 1, "the balance did not cut the list — this case tests nothing");
  assert.ok(r.shots[0].startsWith(BENCH), "the wrong picture was bought");

  // AND THE WRITER WAS ONLY EVER SHOWN THE ONE IT COULD PAY FOR, which is the
  // build path's own rule and the reason there is no frame for the second.
  const flat = pagePrompt(r).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  assert.match(flat, /this site gets 1 real photograph/, "the writer was shown a token the purchase would refuse");
  assert.ok(!flat.includes(LATHE), "the unaffordable picture's prompt was handed to the page writer");

  // 1. THE CUSTOMER IS TOLD THERE WAS A SECOND, AND WHY IT IS NOT THERE.
  const note = String(r.body.pictureNote);
  assert.match(note, /Made 1 photograph for the site\./, "the picture that WAS made stopped being reported");
  assert.match(note, /weren't enough credits for the other one/,
    "the second picture was omitted in silence, or without its reason: " + note);
  assert.match(note, /top up and ask for it/, "the customer was told what happened and not what to do about it");

  // 2. AND IT DOES NOT CLAIM A PLACEHOLDER, because none survived: the second
  //    picture was cut off the list BEFORE the writer saw it, so there is no
  //    token, no frame and no space — which `photos` says independently.
  assert.doesNotMatch(note, /placeholder/,
    "the customer was told a placeholder is standing in for a picture that has no frame: " + note);
  assert.equal(r.body.photos, 0, "a frame that does not exist was counted");
  assert.equal(r.body.pictures, 1, "the reply's count moved off what was really made");
});

test("two photographs asked for and credits for both: no omission is invented — the control", async () => {
  // THE CONTROL, and it is what makes the clause above about the BALANCE rather
  // than about every two-picture request gaining a sentence.
  const r = await twoAsk("fw-both-ok", 400);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // ONE TOKEN IN THE ANSWER, TWO SHOTS OFFERED: the writer was given both and
  // wrote one, so one is bought — which is the honest half of this control.
  const flat = pagePrompt(r).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  assert.match(flat, /this site gets 2 real photographs/, "the balance cut a list it could afford");
  assert.ok(flat.includes(LATHE), "the second picture was withheld from the writer on a balance that covers it");
  const note = String(r.body.pictureNote);
  assert.doesNotMatch(note, /enough credits/, "a request the balance covered was told about credits: " + note);
});

test("nothing affordable at all: the placeholder is claimed only where one survived", async () => {
  // THE ZERO-BUDGET BRANCH, which is the one sentence a page with no token can
  // reach. With nothing affordable the writer is asked for `<SafeImage src="">`
  // — a real, fillable space — so the placeholder claim is TRUE when it writes
  // one and false when it does not, and only the run itself can say which.
  const broke = (slug, written) => photoAsk(slug, {
    kinds: ["page", "photo"], credits: 2, written,
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid of photographs"], components: ["card"] }] },
      photo: { photo: [{ page: "/gallery", describe: BENCH }] },
    },
  });

  // A writer that DID leave the space: the sentence may say so.
  const space = await broke("fw-broke-space", [galleryWith('<SafeImage src="" alt="a space for a picture" />')]);
  assert.equal(space.body.ok, true, JSON.stringify(space.body));
  assert.deepEqual(space.shots, [], "a balance of 2 credits bought a photograph");
  assert.equal(space.body.photos, 1, "the space the writer left was not counted — this case tests nothing");
  assert.match(String(space.body.pictureNote), /Not enough credits left over for photographs, so the pictures are placeholders/,
    "the credits sentence stopped being said where a placeholder really is standing in");

  // A writer that left NONE: the same cause, and the claim must not be made.
  const none = await broke("fw-broke-none", [galleryWith("")]);
  assert.equal(none.body.photos, 0, "the writer left a frame after all — this half tests nothing");
  const note = String(none.body.pictureNote);
  assert.match(note, /Not enough credits left over for photographs/, "the reason stopped being said");
  assert.doesNotMatch(note, /placeholder/,
    "a placeholder was promised on a page that has no frame at all: " + note);
  assert.match(note, /there's no picture there/, "the honest answer was not given: " + note);
});

/* ═══════════════════════════════════════════════════════════════════════════
   A REFUSAL CHANGES NOTHING — INCLUDING THE DESIGN SETTINGS (2026-09-17)

   Owner: *"patchSiteConfig runs before keptImages. A combined gallery + photo
   + QR request that fails with lost-photos leaves the QR persisted, although
   the gallery was never published."*

   REPRODUCED THROUGH THIS ROUTE BEFORE ANYTHING MOVED, on exactly that ask:
   422, `cost: 0`, nothing compiled, nothing bought, `source/<slug>/pages.json`
   untouched — and the stored look left holding

       qr: [{ name: "gallery", points: "https://<slug>.gofarther.app/gallery" }]

   for a route that would never exist. A QR is the one thing here somebody
   PRINTS, so a refusal was leaving behind precisely the artifact the
   `qr-dependency` refusal one block above exists to prevent.

   THE STORE MOVED BELOW THE WALL rather than the refusal gaining a restore,
   which was the other option and is the weaker one: a restore-on-refusal is a
   second repair path that can itself fail, and a failed restore leaves the
   site wrong with nothing left to try. The route's own comment already
   claimed the invariant this keeps — *"every refusal above leaves the site
   exactly as it was"* — while sitting one block too high to hold it.

   THE WHOLE CONFIG IS THE ASSERTION, not the one field. `look.qr` was what the
   report named, and pinning only that would pass again the day some other
   field is written above a wall; `deepEqual` over the entire stored object
   answers "did this refusal write ANYTHING" in one claim.
   ═════════════════════════════════════════════════════════════════════════ */

/** The exact object `addon()` seeds into `config/<slug>.json`, by construction. */
const seededConfig = (look, css) => ({
  look: { brand: "Fretwork", pages: [], ...(look || {}) },
  css: typeof css === "string" ? css : "",
});
/** The stored config WHOLE — the prior configuration, not one field of it. */
const storedConfig = (r, slug) => {
  try { return JSON.parse(r.store.store.get("config/" + slug + ".json")); } catch { return null; }
};
/** A component the request never mentions, so "parts are preserved" is real. */
const BYSTANDER = "export default function Hours(){ return <p data-slot=\"hours\">Mon-Fri</p> }";
/**
 * The prior look, carrying fields a partial write would disturb.
 *
 * ⚠ THE THEME IS A REAL REGISTRY ID AND HAS TO BE. The first draft invented
 * `kraft`, and `FIELD_KEEPS.theme` judges a stored theme against all 500 — so
 * `mergeLook` dropped it to `null` and the CONTROL below failed, reporting the
 * successful store as losing the site's theme. That is this file's own
 * recorded trap (*a fixture naming a thing the product does not have passes
 * until the product starts checking*), and the honest repair is a name the
 * registry holds with the reason written down, never a quiet swap.
 */
const PRIOR_LOOK = { theme: THEME_IDS[0], description: "A guitar workshop in Sheffield." };

/** gallery + photo + QR in one message, on a site with two photographs and a component. */
const orderAsk = (slug, home) => addon(slug,
  "add a gallery page with a photo of the bench, and a QR code that opens it", {
    kinds: ["page", "photo", "qr"], publishes: true, credits: 400,
    look: PRIOR_LOOK,
    parts: [{ name: "hours", source: BYSTANDER }],
    storedPages: [photoHome(slug)],
    written: [galleryToken(BENCH), home],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid of photographs"], components: ["card"] }] },
      photo: { photo: [{ page: "/gallery", describe: BENCH }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });

test("a refused addition leaves the whole prior configuration, its pages and its components exactly as they were", async () => {
  // The writer strips one of the two photographs the site already paid for.
  const r = await orderAsk("fw-order",
    linkHome("fw-order", '<SafeImage src="" alt="the workshop bench" />'));

  // 1. THE REFUSAL ITSELF, unchanged.
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.ok, false, "a refused change reported itself as done");
  assert.equal(r.body.error, "lost-photos");
  assert.equal(r.body.cost, 0, "a refused change was charged");

  // 2. NON-VACUITY, AND IT IS THE WHOLE POINT OF THE CASE. A QR really was
  //    designed in this request — so "the config carries no QR" below means
  //    "a designed QR was not persisted" rather than "nothing designed one".
  //    Without this the case passes against a route that never ran the kind.
  assert.ok(promptFor(r, "qr"), "no QR was designed, so this case cannot see the defect at all");

  // 3. THE ENTIRE PRIOR CONFIGURATION, byte for byte. Before the move this
  //    answered a 22-key merged look carrying the new `qr`; the seeded object
  //    has two fields plus the fixture's own pair.
  assert.deepEqual(storedConfig(r, "fw-order"), seededConfig(PRIOR_LOOK),
    "a refused change wrote the design settings: "
    + JSON.stringify(storedConfig(r, "fw-order")));
  // AND THE REPORTED FIELD BY NAME, because a `deepEqual` that drifts with the
  // fixture would stop saying anything about the QR in particular.
  assert.equal((storedConfig(r, "fw-order").look || {}).qr, undefined,
    "the QR for a page that was never published is on the site");

  // 4. THE PAGES — both photographs still shown, and no new route stored.
  assert.match(storedSource(r, "fw-order", "index.tsx"), /a1b2c3d4\.jpg/,
    "the stored home page lost the photograph on a request that was refused");
  assert.equal(storedSource(r, "fw-order", "gallery.tsx"), "",
    "a page the customer was told was refused is in the store");

  // 5. THE COMPONENTS — the bystander is exactly as it was, and nothing new.
  assert.deepEqual(storedParts(r, "fw-order"), { hours: BYSTANDER },
    "a refused change rewrote the site's components");

  // 6. NO PURCHASE AND NO COMPILE. `compiles.length` rather than the page list:
  //    an empty file list is also what a compile of nothing looks like, and the
  //    claim is that the container was never asked.
  assert.deepEqual(r.shots, [], "a refused change bought its photograph anyway");
  assert.equal(r.compiles.length, 0, "a refused change reached the compiler");
});

test("the same request, succeeding, does store the QR, the pages, the components and the photograph", async () => {
  // THE CONTROL — identical in every respect but the one line the writer
  // returns, so what separates the two is the answer and not the setup. It
  // passes on BOTH trees, which is what makes it a control rather than a
  // second copy of the case above.
  const r = await orderAsk("fw-order-ok", linkHome("fw-order-ok",
    '<SafeImage src="/u/fw-order-ok/a1b2c3d4.jpg" alt="the workshop bench" />'));
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // The QR reaches the store, which is what the refusal above must not do.
  const look = (storedConfig(r, "fw-order-ok") || {}).look || {};
  assert.equal(Array.isArray(look.qr) && look.qr.length, 1,
    "the control stored no QR, so the refusal proves nothing: " + JSON.stringify(look.qr));
  assert.match(String(look.qr[0].points), /^https:\/\/fw-order-ok\.gofarther\.app\/gallery$/);
  // AND THE PRIOR FIELDS SURVIVE THE MERGE — a store that replaced the look
  // wholesale would satisfy the line above and lose the site's own theme.
  assert.equal(look.theme, THEME_IDS[0], "the successful store dropped the prior theme");

  // The page, the component and the photograph all landed.
  assert.match(storedSource(r, "fw-order-ok", "gallery.tsx"), /\/u\/fw-order-ok\/[0-9a-f]{32}\.jpg/,
    "the control published no photograph, so the refusal's empty `shots` proves nothing");
  assert.deepEqual(storedParts(r, "fw-order-ok"), { hours: BYSTANDER },
    "the control disturbed a component nobody mentioned");
  assert.equal(r.shots.length, 1, "the control bought nothing");
  assert.equal(r.compiles.length, 1, "the control never compiled");
});

/* ═════════════════════════════════════════════════════════════════════════
   …AND THE OTHER TWO THINGS THAT BLOCK DOES (2026-09-17)

   THE SWEEP IS WHAT ASKED FOR THESE. Moving the store left three mutants
   alive — the write running for a change with nothing to store, a refused
   write read as a successful one, and the write forgetting it happened so a
   failed publish never puts the old look back — and every one is a branch of
   the block that moved. None had a seam to drive: the fixture's every `put`
   succeeded and its compiler always answered ok.

   ⚠ THE THIRD ONE IS THE CLAIM THIS CHANGE'S OWN COMMENT MAKES. *"The one
   failure after this point puts the old look back."* An invariant asserted in
   a comment and tested nowhere is exactly how the defect above shipped — the
   store's old comment claimed *"every refusal above leaves the site as it
   was"* while sitting above a refusal. Leaving it undrivable would repeat the
   mistake inside the fix for it, so the fixture gained two knobs rather than
   the survivors gaining a paragraph.
   ═════════════════════════════════════════════════════════════════════════ */

/** A page-only ask: it publishes and has no design to store. */
const plainPage = (slug, extra) => addon(slug, "add a gallery page", {
  kinds: ["page"], publishes: true, credits: 400, look: PRIOR_LOOK,
  storedPages: [storedPage("/")],
  written: [writtenPage("/gallery"), addedTo("/", '<p>Also see the <a href="/gallery">gallery</a>.</p>')],
  answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
    sections: ["a grid of photographs"], components: ["card"] }] } },
  ...extra,
});

test("a change with no design in it does not rewrite the design settings", async () => {
  const r = await plainPage("fw-nolook");
  // NON-VACUITY: it really published, so "the config is untouched" is about a
  // change that happened rather than one that was refused on the way.
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.added, ["gallery.tsx"], "no page was added, so nothing ran");

  // THE WHOLE STORED OBJECT, because the way this goes wrong is a write that
  // NORMALISES rather than one that sets a field: `withConfig(cur, undefined)`
  // answers a seven-key config where the site had two, so a change carrying no
  // design would silently give the site five settings it never had. Measured
  // — that is what the store's `if (aLookPatch)` is keeping out.
  assert.deepEqual(storedConfig(r, "fw-nolook"), seededConfig(PRIOR_LOOK),
    "a change with nothing to store rewrote the config: "
    + JSON.stringify(storedConfig(r, "fw-nolook")));
});

test("a refused design write is said out loud, and nothing is published", async () => {
  const r = await plainPage("fw-cfgfail", {
    // A QR is what gives this change something to store at all.
    kinds: ["page", "qr"], configFail: true,
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid of photographs"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } } },
  });
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.body.ok, false, "a refused write reported itself as done");
  assert.equal(r.body.error, "config");
  assert.equal(r.body.cost, 0, "a change that stored nothing was charged");
  assert.match(String(r.body.msg), /your site is untouched/,
    "the customer is not told the site is as it was: " + r.body.msg);

  // AND THE SITE REALLY IS UNTOUCHED — the claim the sentence makes.
  assert.deepEqual(storedConfig(r, "fw-cfgfail"), seededConfig(PRIOR_LOOK),
    "the refused write landed after all: " + JSON.stringify(storedConfig(r, "fw-cfgfail")));
  assert.equal(r.compiles.length, 0, "a change whose design could not be saved reached the compiler");
});

test("a failed publish puts the old look back", async () => {
  const r = await plainPage("fw-pubfail", {
    kinds: ["page", "qr"], compileFail: true,
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
        sections: ["a grid of photographs"], components: ["card"] }] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } } },
  });
  assert.equal(r.body.ok, false, JSON.stringify(r.body));
  assert.equal(r.body.error, "compile");

  // NON-VACUITY: the store really ran, so the revert has something to undo.
  // Without this the case passes against a route that never stored at all.
  assert.equal(r.compiles.length, 1, "nothing compiled, so no publish failed and nothing was reverted");

  const look = (storedConfig(r, "fw-pubfail") || {}).look || {};
  assert.equal(look.qr, undefined,
    "a QR for a site that never published is in the stored look: " + JSON.stringify(look.qr));
  // AND THE SITE'S OWN SETTINGS SURVIVE THE REVERT — a revert that wiped the
  // look would satisfy the line above and lose the theme with it.
  assert.equal(look.theme, THEME_IDS[0], "the revert dropped the site's own theme");
  assert.equal(look.description, PRIOR_LOOK.description, "the revert dropped the site's own description");
  // NOT byte-identical, and saying so beats asserting something false: the
  // revert writes the look as the route READ it, which `markOf` has already
  // normalised — so `favicon` and `wordmark` come back as forms the seeded
  // object did not carry. What must be true is that nothing this change
  // DESIGNED survived, and that nothing the site had was lost.
  assert.equal(look.three, undefined, "a scene this change designed survived a failed publish");
});

// ─────────────────────────────────────────────────────────────────────────────
// RUN 51: SEVEN EMPTY FRAMES SAID AS ONE, AND A PUBLISHED CODE READ AS UNSEEN
//
// Owner, 2026-09-19: *"Fix the mismatch between the gallery's seven empty
// frames and the reply's 'one photo space.' … Check why the reply says it
// cannot establish the QR implementation when this run created and published
// it. Keep configuration separate from verified behavior."*
//
// Both are driven here on the page run 51 really published, written back from
// the live bundle at `fold-lane-bakery.gofarther.app/assets/gallery-*.js` — a
// real producer's output rather than a shape invented to suit the reader.
// ─────────────────────────────────────────────────────────────────────────────

/** The gallery page run 51 shipped: one addressable slot and a six-entry list. */
const R51_GALLERY = {
  path: "gallery.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { SafeImage } from '@/components/ui/safe-image'\n"
    + "import { Gallery } from '@/components/ui/gallery'\n"
    + "export const Route = createFileRoute('/gallery')({ component: Page })\n"
    + "function Page(){ return (<main><h1>Our Gallery</h1>\n"
    + '  <SafeImage className="mt-10" src="" alt="Harbour Loaf interior in warm morning light" ratio="16/9" fallbackSeed="bakery-interior" />\n'
    + '  <Gallery className="mt-10" items={[\n'
    + '    { alt: "A crusty country loaf on the cooling rack", caption: "Country loaf", fallbackSeed: "loaf-country" },\n'
    + '    { alt: "Seeded sourdough on a wooden board", caption: "Seeded sourdough", fallbackSeed: "loaf-seeded" },\n'
    + '    { alt: "Flour-dusted bannetons after the morning prove", caption: "Bannetons", fallbackSeed: "bannetons" },\n'
    + '    { alt: "A dark rye loaf with a split crust", caption: "Dark rye", fallbackSeed: "loaf-rye" },\n'
    + '    { alt: "Batards stacked after the bake", caption: "Batards", fallbackSeed: "batards" },\n'
    + '    { alt: "The brick oven after the morning fire", caption: "The oven", fallbackSeed: "oven" },\n'
    + "  ]} />\n"
    + "<p>Photographs of the bakery.</p></main>) }\n",
};

test("a page's list frames are counted and said apart from the spaces an upload can fill", async () => {
  // THE REPRODUCTION. Run 51 published this page and told the customer *"There
  // is a space for a photo"* — one — over a page a real browser measured at
  // SEVEN empty picture boxes (`role="img"` ×7, `<img>` ×0). Six of them are
  // entries in the `Gallery` list, which `imageSlots` deliberately cannot see:
  // its contract is a `src` SPAN to replace and a LITERAL `alt` to match, and
  // an item in a data array has neither.
  const r = await addon("fw-frames", "add a gallery page showing photographs of our work", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [R51_GALLERY],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs of our work", sections: ["A gallery"], components: ["gallery"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // 1. THE TWO NUMBERS, and 1 + 6 = 7 is the whole of the fix.
  assert.equal(r.body.photos, 1, "the addressable slot was miscounted: " + JSON.stringify(r.body.photos));
  assert.equal(r.body.listPhotos, 6, "the list frames were not counted: " + JSON.stringify(r.body.listPhotos));
  // …AND THE COUNT IS EXACT HERE, which is the control for the runtime flag
  // below: run 51's page writes its six entries out as a LITERAL array, so
  // their number is written down and "at least" would be a hedge over a fact.
  assert.equal(r.body.listPhotosMore, undefined, "an exact count was offered as a floor: " + JSON.stringify(r.body.listPhotosMore));
  // 2. THE CUSTOMER HEARS BOTH, and each with the sentence that is TRUE of it.
  //    Composed by the browser's own `addonReplyText`, executed, never retyped.
  const said = browserText(r.body);
  assert.match(said, /is a space for a photo/, "the fillable space was not offered: " + said);
  assert.match(said, /6 picture spaces/, "the six were not said at all: " + said);
  // ⚠ AND IT IS NOT HEDGED. `at least 6` matches `/6 picture spaces/` too, so
  // without this a browser that says "at least" over every count passes — a
  // sweep survivor measured exactly that. The page's six are written out as a
  // literal array, so the number is known and hedging it is a false modesty
  // that would teach a customer to distrust every count we give them.
  assert.doesNotMatch(said, /at least/, "an exact count was hedged: " + said);
  // 3. …AND THE PROMISE IS NOT WIDENED. `photoNote` offers to FILL a space from
  //    an upload; nothing on this platform can fill a list entry, so summing
  //    the two would have corrected the count by making the offer false for six
  //    of the seven. The upload sentence must cover ONE.
  assert.doesNotMatch(said, /are 7 spaces for a photo/, "the two counts were summed into the fillable one: " + said);
  assert.match(said, /an upload won.t reach/, "the six were offered as uploadable: " + said);
});

test("a page with no list frames is byte-identical to what it was", async () => {
  // THE CONTROL. Without it "6 was reported" could be true for some reason
  // other than the gallery, and the new field could be firing on every change.
  const r = await addon("fw-frames-none", "add a prices page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/prices")],
    answers: { page: { page: [{ path: "/prices", name: "Prices", purpose: "What it costs", sections: ["A list"], components: [] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.listPhotos, 0, "a page with no list of pictures reported some");
  const said = browserText(r.body);
  assert.doesNotMatch(said, /picture spaces/, "a page with no list frames drew the sentence: " + said);
});

test("a list entry that really carries a picture is not an empty frame", async () => {
  // THE OTHER DIRECTION, and it has no case in the 100-site corpus at all —
  // measured, every one of the 321 list frames there is empty — so without this
  // the `empty` test is a branch nothing drives and could be deleted green.
  const filled = {
    path: "gallery.tsx",
    source: R51_GALLERY.source.replace(
      '{ alt: "The brick oven after the morning fire", caption: "The oven", fallbackSeed: "oven" }',
      '{ src: "/u/fw-frames-full/abc123.jpg", alt: "The brick oven after the morning fire", caption: "The oven" }'),
  };
  const r = await addon("fw-frames-full", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [filled],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: ["gallery"] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.listPhotos, 5, "a list entry with a real picture was counted as an empty frame");
  // ⚠ AND THE SAME ENTRY WITH A QUOTED KEY READS THE SAME (2026-09-19). Owner:
  // *"a filled entry with a quoted `"src"` key reads as empty."* `"src":` is
  // ordinary TypeScript and a model writes it, and until today it counted the
  // photograph as a space nothing could fill — the reply telling the customer
  // their own picture was missing from a page that draws it.
  const quoted = {
    path: "gallery.tsx",
    source: filled.source.replace('{ src: "/u/fw-frames-full/abc123.jpg"', '{ "src": "/u/fw-frames-quoted/abc123.jpg"'),
  };
  const q = await addon("fw-frames-quoted", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [quoted],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: ["gallery"] }] } },
  });
  assert.equal(q.body.ok, true, JSON.stringify(q.body));
  assert.equal(q.body.listPhotos, 5, "a quoted `src` key read as an empty frame: " + JSON.stringify(q.body.listPhotos));
});

test("a mapped gallery contributes no number, and the sentence carries none", async () => {
  // ⚠ Owner, 2026-09-19: *"An empty mapped array renders zero frames but
  // currently reports 'at least 1'… don't treat runtime expressions as a
  // positive lower bound. Use wording without a number when the visible count
  // cannot be established."* The page maps over an array it is handed, so its
  // source carries ONE entry and the page draws as many boxes as that array
  // has — including NONE, if `SHOTS` is empty. So the entry is MARKED and never
  // counted: the number is what is really written down.
  const mapPage = (items) => ({
    path: "gallery.tsx",
    source: "import { createFileRoute } from '@tanstack/react-router'\n"
      + "import { Gallery } from '@/components/ui/gallery'\n"
      + "export const Route = createFileRoute('/gallery')({ component: Page })\n"
      + "function Page(){ return (<main><h1>Our Gallery</h1>\n"
      + items
      + "<p>Photographs of the bakery.</p></main>) }\n",
  });
  const answers = { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: ["gallery"] }] } };
  const r = await addon("fw-frames-map", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [mapPage('<Gallery items={SHOTS.map((s) => ({ alt: "A loaf, still warm", caption: s.name }))} />\n')],
    answers,
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.listPhotos, 0, "a mapped entry was counted as a space somebody can see: " + JSON.stringify(r.body.listPhotos));
  assert.equal(r.body.listPhotosMore, true, "a runtime list was not said at all: " + JSON.stringify(r.body));
  // THE CUSTOMER'S OWN WORDS, composed by the browser's `addonReplyText` and
  // executed rather than retyped. No number anywhere in the clause.
  const said = browserText(r.body);
  assert.match(said, /draws its pictures from a list/, "the runtime list was not explained: " + said);
  assert.doesNotMatch(said, /at least/, "a number was claimed over a list nobody here can read: " + said);
  assert.doesNotMatch(said, /picture space/, "an unknowable count was offered as spaces: " + said);
  // BOTH AT ONCE, which is the shape that keeps the floor honest: two entries
  // are written down, so "at least 2" is a fact about the source and the mapped
  // one adds an unknown number on top of it rather than a guessed 1.
  const both = await addon("fw-frames-mixed", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [mapPage('<Gallery items={[{ alt: "A crusty country loaf" }, { alt: "Seeded sourdough on a board" }]} />\n'
      + '<Gallery items={SHOTS.map((s) => ({ alt: "A loaf, still warm", caption: s.name }))} />\n')],
    answers,
  });
  assert.equal(both.body.ok, true, JSON.stringify(both.body));
  assert.equal(both.body.listPhotos, 2, "the written entries were not counted: " + JSON.stringify(both.body.listPhotos));
  assert.equal(both.body.listPhotosMore, true, "the mapped list beside them was not said");
  assert.match(browserText(both.body), /at least 2 picture spaces/, "the written floor was lost: " + browserText(both.body));
});

test("a QR code this change made and published is not read as unseeable", async () => {
  // THE REPRODUCTION. Run 51's page step handed *"A QR code opens the gallery
  // page."* to the `qr` step; the `qr` step made one code, the container baked
  // `qr-gallery.svg`, the site published it and it re-encodes to that address.
  // The customer was told **"I can't see from here whether A QR code opens the
  // gallery page — nothing I can check says either way."**
  //
  // TWO CAUSES AND NEITHER ALONE IS ENOUGH, which is why one case drives both:
  // a code was in no applied list at all (`appliedFacts` spoke for the four
  // schema tiers and `page`), and `implementationOf` read the site's back
  // catalogue and this change's OWN output as one question.
  //
  // ⚠ RE-ANCHORED 2026-09-19, NOT APPEASED. The hand-off carried no `item` and
  // the reading it pinned was a COUNT of the step's output — which the owner's
  // own reproduction falsifies: a step that makes only a Wi-Fi code satisfies
  // the same arithmetic. The case now drives the association that really
  // resolves it, `{kind, name}`, and the counting shape is its own case below.
  const HANDOFF = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr", item: "gallery" };
  const r = await addon("fw-qr-seen", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }], requirements: [HANDOFF] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION, asserted rather than assumed: the code really was stored.
  assert.ok((r.body.moved || []).includes("qr"), "no code was made — this case tests nothing: " + JSON.stringify(r.body.moved));
  const q = storedAnswer(r, "fw-qr-seen").coverage.requirements.find((x) => x.need === HANDOFF.need);
  assert.equal(q.implementation, "found", "the code this change made was not read as an implementation: " + JSON.stringify(q));
  assert.equal(q.implementedBy, "gallery", "the record does not name the code it resolved: " + JSON.stringify(q));
  assert.equal(q.foundIn, "applied", "a code this change made was credited to the site: " + JSON.stringify(q));
  assert.equal(q.state, "unverified", "a published code still read as unseeable: " + JSON.stringify(q));
  assert.equal(q.handoff, "delivered", "the hand-off's own verdict changed");
  // ── CONFIGURATION, NEVER BEHAVIOUR — the owner's own instruction ──────────
  //
  // `unverified`, not `delivered` and not `configured`: nothing scanned the
  // drawing and nothing here ever will. The customer hears *"I've set that up,
  // but I can't confirm"* rather than *"I can't see from here whether"*, which
  // is the difference between a thing that exists and a thing nobody looked for.
  assert.notEqual(q.state, "delivered", "a code nothing scanned was called delivered");
  const note = r.body.coverNote || "";
  assert.doesNotMatch(note, /can't see from here whether A QR code/, "the can't-see sentence survived: " + note);
  assert.match(note, /I've set that up/, "the set-up sentence is missing: " + note);
  // AND THE APPLIED ITEM CARRIES ITS DESTINATION AS CONFIGURATION, with
  // `checked` empty — the rule the whole of `appliedFacts` rests on.
  const made = appliedFacts({ qrs: [{ name: "gallery", points: "https://fw.gofarther.app/gallery", label: "x" }] });
  assert.deepEqual(made.map((m) => m.kind), ["qr"]);
  assert.ok(made[0].holds.includes("gallery"), "the destination is not readable as configuration: " + JSON.stringify(made[0]));
  assert.deepEqual(made[0].checked, [], "a QR code claimed an exercised behaviour");
  assert.deepEqual(made[0].fails, [], "a QR code claimed a contradiction it cannot have");
  // THE PATH, NOT THE WHOLE URL: the host's own words are the site's slug
  // repeated on every code, so splitting the address would give every one of
  // them the business's name and a claim naming the business would match any
  // code at all. Measured against a real stored destination.
  assert.ok(!made[0].holds.includes("gofarther"), "the host's words are in the tokens: " + JSON.stringify(made[0].holds));
  assert.ok(!made[0].holds.includes("https"), "the scheme is in the tokens: " + JSON.stringify(made[0].holds));
  // A PAYLOAD THAT IS NOT A PAGE HAS NO PATH TO SPLIT, and contributes nothing.
  const wifi = appliedFacts({ qrs: [{ name: "wifi", points: "WIFI:S=Fretwork;;", label: "Wi-Fi" }] });
  assert.deepEqual(wifi[0].holds, [], "a non-page payload produced tokens: " + JSON.stringify(wifi[0].holds));
  // …AND A SCENE IS AN APPLIED RESULT TOO, with an empty vocabulary for
  // `page`'s reason: existence is the entire claim.
  assert.deepEqual(appliedFacts({ three: true }), [{ kind: "three", name: "three", holds: [], fails: [], checked: [] }]);
  assert.deepEqual(appliedFacts({ three: false }), [], "a scene nobody added was claimed as applied");
});

test("a scene this change added answers its hand-off, and one the site already had does not", async () => {
  // ⚠ THE `three` HALF, and a sweep survivor is why it is here: `qr` had three
  // route cases and `three` had none, so every line of its own wiring was a
  // wall nobody drove. A site carries at most one scene (`SINGLE_FIELDS`), so
  // the kind IS the name and "this change added one" is the stored field
  // arriving where there was none.
  //
  // ⚠ RE-ANCHORED 2026-09-19 with the QR case above and for the same reason:
  // the hand-off named nothing and the reading it pinned was a count. A scene
  // has ONE possible name (`SINGLE_FIELDS`, so the kind is the name), which
  // makes it the clearest case of all for the explicit association.
  const HANDOFF = { need: "There is something in 3D on the page.", status: "elsewhere", step: "three", item: "three" };
  const page = { path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] };
  const r = await addon("fw-three-made", "add a gallery page and a 3D scene on it", {
    kinds: ["page", "three"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      three: { three: { scene: "a slowly turning loaf", page: "/gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok((r.body.moved || []).includes("three"), "no scene was stored — this case tests nothing: " + JSON.stringify(r.body.moved));
  const q = storedAnswer(r, "fw-three-made").coverage.requirements.find((x) => x.need === HANDOFF.need);
  assert.equal(q.implementation, "found", "the scene this change made was not read as an implementation: " + JSON.stringify(q));
  assert.equal(q.foundIn, "applied", "a scene this change made was credited to the site: " + JSON.stringify(q));
  assert.equal(q.state, "unverified");

  // THE CONTROL: the site ALREADY has one and this change adds none. What it
  // had belongs to `existingFacts`; counting it here would let an old scene
  // answer for a new one nobody made.
  // …AND WHICH READER ANSWERED IS THE ASSERTION, not merely that it is not
  // `made`. A sweep survivor is why: with no `item` the hand-off cannot reach
  // either haystack (`three` never ran, so nothing heard it) and BOTH readings
  // answer `unknown` — so the negative was true whatever the diff did. A
  // `covered` claim NAMING the scene goes through the item branch, where the
  // two readings part: `existing` is the site's back catalogue and `applied`
  // is this change's own work, and calling an old scene ours is the defect.
  const NAMED = { need: "The 3D scene is on the page.", status: "covered", from: "page", kind: "three", item: "three" };
  const c = await addon("fw-three-had", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    look: { three: "a globe that was always there" },
    written: [writtenPage("/gallery")],
    answers: { page: { page: [page], requirements: [HANDOFF, NAMED] } },
  });
  assert.equal(c.body.ok, true, JSON.stringify(c.body));
  assert.equal((c.body.moved || []).includes("three"), false, "a scene was added — this control tests nothing");
  const cr = storedAnswer(c, "fw-three-had").coverage.requirements;
  const cq = cr.find((x) => x.need === HANDOFF.need);
  // ⚠ RE-ANCHORED: `notEqual("made")` was vacuous the moment that state went.
  // The hand-off names the scene, so it RESOLVES — to the site's own, which is
  // the distinction the control is about and is what `foundIn` records.
  assert.equal(cq.implementation, "found", "the site's own scene was not found at all: " + JSON.stringify(cq));
  assert.equal(cq.foundIn, "existing", "a scene the site already had was claimed as this change's: " + JSON.stringify(cq));
  const cn = cr.find((x) => x.need === NAMED.need);
  assert.equal(cn.implementation, "found", "the site's own scene was not found at all: " + JSON.stringify(cn));
  assert.equal(cn.foundIn, "existing", "a scene the site already had was recorded as this change's work: " + JSON.stringify(cn));
});

test("a code that opens no page does not answer a hand-off about one", async () => {
  // ⚠ THE REPRODUCTION (owner, 2026-09-19): *"A gallery handoff currently
  // becomes 'set up' when the step produces only a Wi-Fi code."* Driven through
  // the real route, this is the shape run 51 had with one word changed — the
  // page step asks for a code that opens the gallery, and the `qr` step designs
  // a Wi-Fi code instead. A count of the step's output satisfied it.
  const HANDOFF = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  const page = { path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] };
  const r = await addon("fw-qr-wifi", "add a gallery page and a QR code for the wifi", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: { qr: { name: "wifi", points: "WIFI:S=Fretwork;T=WPA;P=loaf;;", label: "Join our wifi" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: a code really was made, so the step's output is in hand
  // and the old arithmetic really would have been satisfied.
  assert.ok((r.body.moved || []).includes("qr"), "no code was made — this case tests nothing: " + JSON.stringify(r.body.moved));
  const q = storedAnswer(r, "fw-qr-wifi").coverage.requirements.find((x) => x.need === HANDOFF.need);
  assert.equal(q.implementation, "unknown", "a Wi-Fi code answered a hand-off about a gallery page: " + JSON.stringify(q));
  assert.equal(q.state, "unknown", "the requirement was settled by a code that opens nothing: " + JSON.stringify(q));
  // …AND THE HAND-OFF'S OWN VERDICT IS UNTOUCHED, which is the separation the
  // 2026-09-19 round before this one bought: the `qr` step really was told.
  assert.equal(q.handoff, "delivered", "the hand-off's own verdict moved with the implementation's");
  const note = r.body.coverNote || "";
  assert.doesNotMatch(note, /I've set that up/, "the set-up sentence survived a code that opens nothing: " + note);
  assert.match(note, /can't see from here whether A QR code/, "the uncertainty was not preserved: " + note);
  // ── THE CONTROL, AND IT IS ABOUT THE ASSOCIATION AND NOT ABOUT THE CODE ───
  //
  // The SAME un-named hand-off on a run whose `qr` step made exactly the right
  // code is ALSO `unknown`, because nothing ties that code to this need. That
  // is what makes this a case about counting rather than a case about Wi-Fi:
  // the fix is not "notice the code is wrong", it is "stop answering from a
  // number". The case above, whose hand-off names `gallery`, is the other half.
  const c = await addon("fw-qr-right", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(c.body.ok, true, JSON.stringify(c.body));
  assert.ok((c.body.moved || []).includes("qr"), "no code was made — this control tests nothing");
  const cq = storedAnswer(c, "fw-qr-right").coverage.requirements.find((x) => x.need === HANDOFF.need);
  assert.equal(cq.implementation, "unknown",
    "the right code settled an un-named hand-off, so the reading is still a count: " + JSON.stringify(cq));
});

test("a code the site already had is not claimed as this change's", async () => {
  // THE SAME WALL ON THE OTHER LOOK FIELD. `aMerged.qr` carries every code the
  // site holds, so without the diff a change that added NONE would answer a
  // hand-off out of the site's back catalogue.
  const HANDOFF = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  // The NAMED claim is what makes the diff observable — see the scene case
  // above for why the bare hand-off cannot be: with `qr` never run it reaches
  // neither haystack, so `unknown` is the honest answer under either reading.
  const NAMED = { need: "The Wi-Fi code is on the site.", status: "covered", from: "page", kind: "qr", item: "wifi" };
  const r = await addon("fw-qr-had", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    look: { qr: [{ name: "wifi", points: "WIFI:S=Fretwork;;", label: "Wi-Fi" }] },
    written: [writtenPage("/gallery")],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }], requirements: [HANDOFF, NAMED] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal((r.body.moved || []).includes("qr"), false, "a code was added — this control tests nothing");
  const rows = storedAnswer(r, "fw-qr-had").coverage.requirements;
  const q = rows.find((x) => x.need === HANDOFF.need);
  // ⚠ RE-ANCHORED: `notEqual("made")` was vacuous the moment that state went.
  // The property is that an un-named hand-off to a step that never ran is
  // `unknown` — nobody looked, which is the honest answer and the one the
  // owner's *"preserve uncertainty"* asks for.
  assert.equal(q.implementation, "unknown", "the site's own code answered a hand-off nobody acted on: " + JSON.stringify(q));
  const n = rows.find((x) => x.need === NAMED.need);
  assert.equal(n.implementation, "found", "the site's own code was not found at all: " + JSON.stringify(n));
  assert.equal(n.foundIn, "existing", "a code the site already had was recorded as this change's work: " + JSON.stringify(n));
});

test("a QR code the change did NOT make is still to do, not 'set up'", async () => {
  // THE CONTROL, and it asserts what it claims rather than only the negative:
  // the same hand-off, the same step named, and no `qr` answer at all. Nothing
  // was made, the site has no codes, and BOTH readers being empty is what makes
  // absence establishable — so the customer gets a finding they can act on.
  // Without this, "it reads `made`" could be true whatever happened.
  const HANDOFF = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  const r = await addon("fw-qr-unseen", "add a gallery page", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }], requirements: [HANDOFF] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal((r.body.moved || []).includes("qr"), false, "a code was made — this control tests nothing");
  const q = storedAnswer(r, "fw-qr-unseen").coverage.requirements.find((x) => x.need === HANDOFF.need);
  assert.equal(q.implementation, "absent", "a code nobody made read as something: " + JSON.stringify(q));
  assert.equal(q.state, "missing");
  assert.equal(q.handoff, "undelivered", "a step this change never ran was recorded as told");
  assert.match(r.body.coverNote, /Still to do: A QR code opens the gallery page/,
    "the customer was not told the code is outstanding: " + r.body.coverNote);
});

test("a NAMED code the qr step ran and did not make is still to do", async () => {
  // ⚠ THIS IS WHAT MAKES `APPLIED_KINDS` LOAD-BEARING, and it is here because a
  // red-check found the list doing nothing: the `made` branch reads
  // `appliedFacts`' own output and never `reportable`, so run 51's case passes
  // with `qr` off the list entirely. A wall nobody can drive is a wall nobody is
  // guarding, so this is the case that drives it.
  //
  // THE SHAPE IS THE ONE WHERE `seeable` DECIDES: the `qr` step RAN and made a
  // code, and the requirement NAMES a different one. Neither reader has it, so
  // the answer turns on whether this layer can see that kind at all —
  // `APPLIED_KINDS` with `qr` off it answers `unknown` ("nobody looked") about a
  // step that looked and came back with something else.
  const NAMED = { need: "A QR code opens the order page.", status: "elsewhere", step: "qr", item: "order", kind: "qr" };
  const r = await addon("fw-qr-named", "add a gallery page and QR codes", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }], requirements: [NAMED] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: the step really ran and really made a code — a DIFFERENT
  // one. Without it this case is about a step that did nothing.
  assert.ok((r.body.moved || []).includes("qr"), "the qr step made nothing — this case tests nothing");
  const q = storedAnswer(r, "fw-qr-named").coverage.requirements.find((x) => x.need === NAMED.need);
  assert.equal(q.implementation, "absent", "a named code nobody made was not seen as absent: " + JSON.stringify(q));
  assert.equal(q.state, "missing");
  assert.equal(q.handoff, "delivered", "the step really was told");
  assert.match(r.body.coverNote, /Still to do: A QR code opens the order page/, r.body.coverNote);
});

test("two un-named requirements resting on one step, and one thing made, stay unknown", async () => {
  // THE COUNT IS WHAT MAKES `made` SOUND, and this is the case that says so.
  // With two hand-offs on `qr` and one code, at least one of them has nothing
  // behind it and which one is not knowable from here — so BOTH stay `unknown`
  // rather than both being told *"I've set that up"*.
  const A = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  const B = { need: "A QR code opens the order page.", status: "elsewhere", step: "qr" };
  const r = await addon("fw-qr-two", "add a gallery page and QR codes", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }], requirements: [A, B] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok((r.body.moved || []).includes("qr"), "no code was made — this case tests nothing");
  const cov = storedAnswer(r, "fw-qr-two").coverage.requirements;
  for (const need of [A.need, B.need]) {
    const q = cov.find((x) => x.need === need);
    assert.equal(q.implementation, "unknown", "one code answered for two asks: " + JSON.stringify(q));
    assert.equal(q.state, "unknown");
  }
});

test("the QR step says which request its code answers, and the hand-off is associated", async () => {
  // ⚠ Owner, 2026-09-19: *"Finish the original QR handoff correction. Let the
  // QR step associate the requirement ID it received with the actual kind and
  // item it produced, using the existing reconciliation mechanism. Start with
  // QR only."*
  //
  // RUN 51'S OWN SHAPE. The page step handed *"A QR code opens the gallery
  // page."* to the `qr` step and named nothing, so nothing could tie the code
  // that came back to the ask — the round before this removed the count that
  // stood in for an association, correctly, and left the legitimate case
  // `unknown`. The step was already TOLD (its brief carries the id); what it
  // had no way to do was answer. It echoes the id now.
  const HANDOFF = { need: "A QR code opens the gallery page.", status: "elsewhere", step: "qr" };
  const page = { path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] };
  const ECHO = { need: "A QR code opens the gallery page.", status: "covered", by: "the gallery code points at /gallery", answers: "page#0", kind: "qr", item: "gallery" };
  const r = await addon("fw-qr-echo", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery" }, requirements: [ECHO] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok((r.body.moved || []).includes("qr"), "no code was made — this case tests nothing: " + JSON.stringify(r.body.moved));
  // ⚠ THE HOP THE FIX REALLY IS, AND IT IS THE ONLY ONE A ROUTE CASE CAN SEE.
  // MEASURED: everything below this line was already green against a product
  // whose qr tool had NO `requirements` property — `cleanRequirements`,
  // `referenceOf` and `reconcileHandoffs` are kind-agnostic and always were, so
  // a fixture handing the echo in proves the reconciliation and says nothing
  // about whether a model could have written one. From outside, "the step did
  // not echo" and "we never offered it anywhere to echo" are one absence: this
  // repository's own wiring trap, in the round that closes it. So the TOOL the
  // route really handed the qr designer is asserted here, with the brief that
  // gave it the id to echo.
  const qrCall = r.prompts.find((p) => p.kind === "qr");
  assert.ok(qrCall, "the qr designer was never called: " + JSON.stringify(r.prompts.map((p) => p.kind)));
  assert.ok(qrCall.props.includes("requirements"),
    "the qr step has nowhere to say which request its code answers: " + JSON.stringify(qrCall.props));
  assert.match(qrCall.text, /page#0/, "the qr step was never told the id it is asked to echo");
  const cov = storedAnswer(r, "fw-qr-echo").coverage.requirements;
  const q = cov.find((x) => x.status === "elsewhere");
  // THE ASSOCIATION IS EXPLICIT AND IT NAMES WHAT DID THE WORK — the echoed id,
  // the kind and the item, so the record says WHICH code answered which ask
  // rather than that a code exists.
  assert.equal(q.state, "configured", "the hand-off was not associated: " + JSON.stringify(q));
  assert.equal(q.reconciledItem, "gallery", "the record does not name the code that answered: " + JSON.stringify(q));
  assert.equal(q.reconciledKind, "qr", "the record does not say what kind of thing answered: " + JSON.stringify(q));
  assert.ok(/^qr#/.test(q.reconciledBy || ""), "the answering entry is not the qr step's: " + JSON.stringify(q));
  // …AND THE CAP HOLDS. A destination read back off what was stored is
  // configuration; nothing has scanned the drawing, so `delivered` is a claim
  // this platform cannot make about a QR code.
  assert.notEqual(q.state, "delivered", "an echo bought a delivered verdict: " + JSON.stringify(q));
  // ⚠ `checked` IS ASSERTED WHERE IT LIVES, NOT HERE — MEASURED: the stored
  // record carries no `made` list at all, so a loop over it was a negative
  // assertion with no observer, green whatever the code did. The census in
  // `addon-steps` drives `appliedFacts` over EVERY applied kind, `qr` now
  // included, and asserts each `checked` is `[]`. What this route can observe
  // is the consequence — a state that never reaches `delivered`, above, and
  // that no requirement in the whole reply does either.
  assert.equal(storedAnswer(r, "fw-qr-echo").coverage.made, undefined,
    "the record carries `made` now — assert its `checked` here rather than only at the module");
  for (const e of cov) assert.notEqual(e.state, "delivered", "a claim was delivered with nothing checked: " + JSON.stringify(e));
  // THE CUSTOMER HEARS IT ONCE, and as the CAN'T-CONFIRM sentence rather than
  // the CAN'T-SEE one. Those are two different clauses and the move between
  // them is the whole of what the association buys: "it is there and nothing
  // checked what it does" against "nothing here can tell either way".
  const note = r.body.coverNote || "";
  assert.match(note, /I've set that up, but I can't confirm from here that A QR code opens the gallery page/,
    "the associated hand-off did not reach the set-up sentence: " + note);
  assert.doesNotMatch(note, /can't see from here whether A QR code/, "the associated hand-off still reads as unseeable: " + note);
  assert.equal((note.match(/A QR code opens the gallery page/g) || []).length, 1,
    "one need was said twice, or not at all: " + note);

  // ── CONTROL 1: THE WRONG ITEM. The echo names a code the step did not make,
  // so its OWN implementation is not found and it may settle nothing. This is
  // the Wi-Fi shape with the echo added: an id alone must not associate.
  const wrong = await addon("fw-qr-echo-wrong", "add a gallery page and a QR code for the wifi", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: {
        qr: { name: "wifi", points: "WIFI:S=Fretwork;T=WPA;P=loaf;;", label: "Join our wifi" },
        requirements: [{ ...ECHO, by: "the gallery code", item: "gallery" }],
      },
    },
  });
  assert.equal(wrong.body.ok, true, JSON.stringify(wrong.body));
  assert.ok((wrong.body.moved || []).includes("qr"), "no code was made — this control tests nothing");
  const w = storedAnswer(wrong, "fw-qr-echo-wrong").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(w.state, "unknown", "an echo naming a code nobody made settled the hand-off: " + JSON.stringify(w));
  assert.equal(w.reconciledBy, undefined, "a reconciliation happened over an item that does not exist: " + JSON.stringify(w));

  // ── CONTROL 2: NO ITEM AT ALL. The echo answers the id and names nothing, so
  // there is no reference to check and the uncertainty is preserved — which is
  // the property the round before this one bought and must survive.
  const bare = await addon("fw-qr-echo-bare", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: {
        qr: { name: "gallery", points: "/gallery", label: "Our gallery" },
        requirements: [{ need: ECHO.need, status: "covered", by: "a code was made", answers: "page#0" }],
      },
    },
  });
  assert.equal(bare.body.ok, true, JSON.stringify(bare.body));
  assert.ok((bare.body.moved || []).includes("qr"), "no code was made — this control tests nothing");
  const b = storedAnswer(bare, "fw-qr-echo-bare").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(b.state, "unknown", "an echo naming nothing settled the hand-off from a count again: " + JSON.stringify(b));
  assert.equal(b.reconciledBy, undefined, "a nameless echo reconciled: " + JSON.stringify(b));

  // ── CONTROL 3: A DEPENDENCY THAT FAILED. The hand-off names a code the
  // change could not make, so it carries a FINDING — and an echoed id may
  // resolve an uncertainty and never overrule evidence about the application.
  const NAMED_FAIL = { need: "A QR code opens the order page.", status: "elsewhere", step: "qr", item: "order", kind: "qr" };
  const dep = await addon("fw-qr-echo-dep", "add a gallery page and QR codes", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [NAMED_FAIL] },
      qr: {
        qr: { name: "gallery", points: "/gallery", label: "Our gallery" },
        requirements: [{ need: NAMED_FAIL.need, status: "covered", by: "the gallery code", answers: "page#0", kind: "qr", item: "gallery" }],
      },
    },
  });
  assert.equal(dep.body.ok, true, JSON.stringify(dep.body));
  const d = storedAnswer(dep, "fw-qr-echo-dep").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(d.state, "missing", "an echo naming a DIFFERENT code covered up a code nobody made: " + JSON.stringify(d));
  assert.equal(d.reconciledBy, undefined, "a finding was overwritten by an echo: " + JSON.stringify(d));
  assert.match(dep.body.coverNote || "", /Still to do: A QR code opens the order page/, dep.body.coverNote);
});
