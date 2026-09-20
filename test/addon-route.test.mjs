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
import { renderKit } from "./fixtures/site-render.mjs";
import { addon, promptFor, pagePrompt, storedAnswer, writtenPage, storedPage, addedTo, compiledPages, STORED_SCHEMA } from "./fixtures/addon-route.mjs";
import { renderRouteSource } from "./fixtures/site-render.mjs";
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
import { cleanAdd, appliedFacts, addTool } from "../builder/site-add.mjs";
// The engine's own language list and its two readers — the tool's enum is
// derived from the first and the DDL from the second, so a case about what a
// designer may declare has to compare against the real thing rather than a
// list typed here, which would be the drift these assertions exist to catch.
import { FN_LANGUAGES, fnLanguage, functionSql } from "../site-rls.mjs";
// REAL GENERATED PAGES, so "a site too large to show whole" is real source
// rather than padding — the same corpus a dozen false-alarm checks measure
// against, and the one place these files are reached from.
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";
import { existingFacts } from "../builder/site-add.mjs";
import { SITE_KINDS, OPAQUE_KINDS, claimEvidence } from "../builder/site-requirements.mjs";
// THE REAL EMITTERS AND THE PRODUCT'S OWN READERS, so a catalog fixture below
// is derived from what the engine really emits rather than typed by hand — a
// hand-typed permission is a second copy of the emitter and the two drift.
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { splitPrivileges, readParens } from "../site-schema-recover.mjs";
// THE READER THE SERVING ROUTE USES, so "the stored declaration is read back
// whole" is asked of the product rather than of the object the case just wrote:
// `apiFor` runs a stored connection back through `normalizeApi`, which is where
// a field that survives storage and not the readback would be lost.
import { apiFor } from "../site-apis.mjs";
import { missingRequired, typeFromShape } from "../site-api-shape.mjs";
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

test("the language the engine supports is carried, and only the setting the engine never heard of is reported", async () => {
  // ⚠ THIS CASE IS RE-ANCHORED, NOT APPEASED, AND THE EXPECTATION MOVED
  // RATHER THAN BROKE (2026-09-19). It read `unexpressedProps: ["language"]`
  // and asserted the two-clause separation with `language` as the product
  // instance of "the engine supports it and this step cannot carry it". That
  // was TRUE and is the gap this round closes: `FUNCTION_ITEM` offers the
  // field, `cleanAdd` carries it, and `unexpressed` for it is now the wrong
  // answer. Keeping the old expectation would be asserting the defect as
  // correct, which this repository has done twice and has a name for.
  //
  // `encryptAtRest` is untouched and is still the OTHER case: the ENGINE has
  // never heard of it, so it is `invalidProps` and gets the guarantee clause.
  const r = await addon("fw-unexpressed", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpgsql", encryptAtRest: true }] } },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.invalidProps, ["encryptAtRest"], "a setting the engine never heard of is no longer reported");
  // THE CLOSURE, ASSERTED AS AN ABSENCE WITH ITS OBSERVER ALIVE. `language` is
  // gone from the lost list while `encryptAtRest` is still in the refused one,
  // so this cannot pass by the audit having gone quiet altogether.
  assert.deepEqual(r.body.unexpressedProps || [], [],
    "`language` is still reported as a setting this step cannot carry, after it was made carryable");
  assert.match(r.body.coverNote, /a guarantee it doesn't offer/);
  assert.doesNotMatch(r.body.coverNote, /isn't something this kind of change can carry through/,
    "the customer is still told a setting was lost that really reached the engine");
  // AND NEITHER CLAUSE NAMES A PROPERTY — the count is what a customer can act
  // on, and naming one here is the "expose hidden settings" the owner ruled out.
  assert.doesNotMatch(r.body.coverNote, /language|encryptAtRest/);
  const rec = storedAnswer(r, "fw-unexpressed");
  assert.deepEqual(rec.coverage.unexpressedProps || [], []);
  assert.deepEqual(rec.coverage.invalidProps, ["encryptAtRest"]);
});

test("a plpgsql function reaches the database as plpgsql, and an ordinary one is unchanged", async () => {
  // ⚠ THIS CASE REPLACES "a setting only this step lost still reaches the
  // customer, with nothing else wrong", whose whole subject was `language` as
  // the one product instance of the `unexpressed` bucket. MEASURED across all
  // four tiers after this change, no declared property anywhere is both read
  // by the engine and dropped by the cleaner — the bucket has no product
  // instance left, so a route case cannot demonstrate it and one that tried
  // would be asserting something that is no longer true of the product. The
  // clause's own reachability is kept where it CAN be driven, on
  // `requirementNote` in `requirement-coverage.test.mjs`.
  //
  // What the route case is spent on instead is the capability: the owner's
  // "a PL/pgSQL function that actually needs PL/pgSQL reaches the database
  // with that language".
  const body = "DECLARE n int; BEGIN SELECT count(*) INTO n FROM bookings; RETURN n; END";
  const r = await addon("fw-plpgsql", "add a nightly counter", {
    kinds: ["function"],
    answers: { function: { function: [{ ...FN, body, language: "plpgsql" }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.functions, ["send_reminder"], "the function was not applied — this case tests nothing");
  assert.equal(r.body.invalidProps, undefined, "something else was wrong — this case no longer isolates the language");
  // THE STATEMENT THAT REALLY WENT TO POSTGRES, which is the only place the
  // language is observable: every hop above it could be perfect and this one
  // wrong, which is the wiring defect this whole round is about.
  const create = r.sql.find((s) => /CREATE OR REPLACE FUNCTION "send_reminder"/.test(s));
  assert.ok(create, "no CREATE went out for the function at all");
  assert.match(create, /LANGUAGE plpgsql/, "the declared language did not reach the DDL");
  assert.match(create, /SECURITY DEFINER/, "the language change took the definer clause with it");
  assert.match(create, /SET search_path = public, pg_temp/, "the language change took the search_path pin with it");
  // AND THE ORDINARY CASE IS THE CONTROL, byte for byte what it always was.
  const plain = await addon("fw-sql-fn", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN }] } },
  });
  assert.equal(plain.body.ok, true);
  const plainCreate = plain.sql.find((s) => /CREATE OR REPLACE FUNCTION "send_reminder"/.test(s));
  assert.match(plainCreate, /LANGUAGE sql/, "a function that said nothing about its language stopped being SQL");
});

test("a language this platform does not run is refused by name, never converted into another one", async () => {
  // Owner: *"An unsupported language is refused or reported accurately, never
  // silently converted into something else."* The ENGINE converts — deliberately
  // and correctly, because a STORED spec re-applies through `normalizeSchema`
  // on every later change and one unreadable word must not fail the whole
  // apply. The ADDON is where a person asked for it in this message and can be
  // told, so the split is the `cleanShape`/`normalizeApi` precedent: tolerant
  // reader, refusing cleaner.
  const r = await addon("fw-badlang", "add a reminder sender in python", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpython3u" }] } },
  });
  // NOTHING WAS BUILT AND NOTHING WAS CONVERTED. The second half is what this
  // case is really about: before the field existed the word was dropped and a
  // `LANGUAGE sql` function went out with a body written for something else.
  assert.deepEqual(r.body.functions || [], [], "a function was created for a language we do not run");
  assert.ok(!r.sql.some((s) => /CREATE OR REPLACE FUNCTION "send_reminder"/.test(s)),
    "a CREATE went out for a refused function");
  // AND THE CUSTOMER IS TOLD WHAT HAPPENED AND WHAT WORKS INSTEAD.
  const said = JSON.stringify(r.body);
  assert.match(said, /database language this platform doesn't run/, "the refusal never reached the customer");
  assert.match(said, /plain SQL, or in PL\/pgSQL/, "the refusal does not say what would work");
  // THE CONTROL: the same site, the same shape, a language we DO run.
  const ok = await addon("fw-badlang-ok", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpgsql" }] } },
  });
  assert.deepEqual(ok.body.functions, ["send_reminder"], "the control did not build either — the refusal is not about the language");
});

test("one function refused for its language leaves an unrelated one applied and reported", async () => {
  // Owner: *"A failed function does not make an unrelated successful function
  // appear failed."* The refusal is PER ITEM — `cleanAdd` answers one item at a
  // time and a refused one is named in `skipped` — so the tier is not failed
  // wholesale, which is the shape the mixed-success work established for a
  // function the DATABASE refuses and which has to hold for one this step
  // refuses too.
  const good = { name: "count_bookings", internal: true, returns: "int", body: "SELECT count(*) FROM bookings" };
  const r = await addon("fw-mixed-lang", "add two functions", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "plpython3u" }, good] } },
  });
  assert.deepEqual(r.body.functions, ["count_bookings"], "the unrelated function did not survive its neighbour's refusal");
  const create = r.sql.find((s) => /CREATE OR REPLACE FUNCTION "count_bookings"/.test(s));
  assert.ok(create, "the good function never reached the database");
  assert.match(create, /LANGUAGE sql/);
  assert.ok(!r.sql.some((s) => /"send_reminder"/.test(s)), "the refused one reached the database anyway");
});

test("the language rides the stored declaration, and the next designer is told", async () => {
  // Owner: *"Metadata round-trips preserve the relevant language information"*
  // and *"The page/job designer receives the usable function information."*
  //
  // `_meta.functions` stores no BODY, so it is the only record anywhere of what
  // a live function IS. Without the language a readback describes a plpgsql
  // function as though it were SQL — and a function is re-declared BY NAME, so
  // the next designer that re-declares it writes a plpgsql body, says nothing,
  // and the engine creates it `LANGUAGE sql`: a syntax error at CREATE.
  const body = "DECLARE n int; BEGIN SELECT count(*) INTO n FROM bookings; RETURN n; END";
  const r = await addon("fw-lang-meta", "add a nightly counter", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, body, language: "plpgsql" }] } },
  });
  assert.equal(r.body.ok, true);
  const stored = r.meta();
  const fn = (stored.functions || []).find((f) => f.name === "send_reminder");
  assert.ok(fn, "the function is not in the stored schema at all");
  assert.equal(fn.language, "plpgsql", "the stored declaration does not say what language the live function is");
  // NO BODY IS STORED and that is unchanged — the language is descriptive
  // metadata beside the other four, not a second copy of the function.
  assert.equal(fn.body, undefined, "a body is being stored now, which this case did not intend");
  // …AND THE TOOL THE DESIGNER REALLY RECEIVED OFFERS THE FIELD, read one
  // level in. A case that hands the answer in bypasses the tool entirely, so
  // without this the whole demonstration could pass against a tool that never
  // offered a language at all — the wiring trap met inside the round that
  // closes one.
  const fnTool = r.prompts.find((p) => p.tool === "add_to_site" && p.kind === "function");
  assert.ok(fnTool, "the function designer was never called");
  assert.ok(fnTool.itemProps.includes("language"), "the tool does not offer a language for the designer to declare");
  assert.deepEqual(fnTool.itemSchema.properties.language.enum, ["sql", "plpgsql"],
    "the offered languages are not the engine's own list");
  // A SECOND CHANGE ON THE SAME SITE is where the readback is really read, so
  // the marker is asserted on a site whose STORED schema already carries one.
  const next = await addon("fw-lang-next", "add a job that runs it", {
    kinds: ["job"],
    stored: { tables: [{ name: "bookings", columns: [{ name: "who", type: "text" }], access: "collect" }],
      functions: [{ name: "send_reminder", args: [], returns: "void", internal: true, language: "plpgsql" }] },
    answers: { job: { job: [JOB] } },
  });
  const nextNote = next.prompts.map((p) => JSON.stringify(p)).join("\n");
  assert.match(nextNote, /written in plpgsql/, "the stored language never reached the next designer");
  assert.match(nextNote, /functions a scheduled job may run are/, "the job designer lost its own list");
  assert.deepEqual((next.body.jobs || []).map((j) => j && j.name), ["daily_reminder"],
    "a job on a plpgsql function was not registered");
  // AND AN ORDINARY FUNCTION IS NOT MARKED — the mark is non-default ONLY, so
  // a site with no plpgsql function reads the line it always read. Without
  // this the filter could mark everything and every existing site's note would
  // grow a clause about the language it already had.
  const plain = await addon("fw-lang-plain", "add a job that runs it", {
    kinds: ["job"],
    stored: { tables: [{ name: "bookings", columns: [{ name: "who", type: "text" }], access: "collect" }],
      functions: [{ name: "send_reminder", args: [], returns: "void", internal: true, language: "sql" }] },
    answers: { job: { job: [JOB] } },
  });
  const plainNote = plain.prompts.map((p) => JSON.stringify(p)).join("\n");
  assert.match(plainNote, /send_reminder/, "the function did not reach the note at all — this control tests nothing");
  assert.doesNotMatch(plainNote, /written in/, "an ordinary SQL function is being marked with its language");
});

test("a function this same change is adding carries its language into the next designer's note", async () => {
  // THE MARKER AND THE LANGUAGE MEET ON ONE NAME. `siteNote` appends
  // "(being added by this same change)" to a name this message is adding, and
  // the language marker is keyed by the RAW name — so without the strip the
  // two never line up and a function designed one call earlier reaches the job
  // designer with no language on it. A sweep survivor is why this case exists.
  const body = "DECLARE n int; BEGIN SELECT count(*) INTO n FROM bookings; RETURN n; END";
  const r = await addon("fw-lang-inflight", "add a counter and a job that runs it", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [{ ...FN, body, language: "plpgsql" }] },
      job: { job: [JOB] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const jobPrompt = r.prompts.find((p) => p.tool === "add_to_site" && p.kind === "job");
  assert.ok(jobPrompt, "the job designer was never called");
  const text = JSON.stringify(jobPrompt);
  assert.match(text, /being added by this same change/, "the function is not marked as in flight — this case tests nothing");
  assert.match(text, /written in plpgsql/,
    "a function designed one call earlier reached the job designer with no language on it");
});

test("the language a designer may declare is the engine's own list, and the wire gets a copy", async () => {
  // TWO PROPERTIES ONE CASE, because they fail the same way and neither has
  // another home. The enum must be the ENGINE's list — a tool offering a
  // language `functionSql` will not write is a promise the DDL breaks — and it
  // must be a COPY: `enum: FN_LANGUAGES` puts the platform's own frozen array
  // on the wire, where anything downstream that mutates a schema mutates the
  // constant every later call reads.
  const r = await addon("fw-lang-enum", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [FN] } },
  });
  const tool = r.prompts.find((p) => p.tool === "add_to_site" && p.kind === "function");
  const sent = tool.itemSchema.properties.language.enum;
  assert.deepEqual(sent, [...FN_LANGUAGES], "the offered languages are not the engine's own list");
  // ⚠ AND THE COPY IS ASKED OF THE TOOL, NEVER THROUGH THE ROUTE — a sweep
  // survivor is why. The fixture reads the tool back off `JSON.parse(init.body)`
  // (the request the route really sent), and a JSON round trip mints a fresh
  // array whatever the source — so `notEqual(sent, FN_LANGUAGES)` here is TRUE
  // by construction and cannot fail. MEASURED: with the `.slice()` removed the
  // route case stayed GREEN while `api-shape`'s own wire case went RED, because
  // `toXaiRequest` builds its body in memory and keeps the live reference.
  // A negative assertion must prove its observer is alive, and this one's
  // observer is the tool object itself.
  const fresh = addTool("function").input_schema.properties.function.items.properties.language.enum;
  assert.deepEqual(fresh, [...FN_LANGUAGES], "the tool does not offer the engine's own list");
  assert.notEqual(fresh, FN_LANGUAGES,
    "the platform's own frozen list IS the tool's enum — anything that mutates a schema mutates the constant every later call reads");
  // AND THE TWO SPELLINGS A MODEL REALLY WRITES, through the route: Postgres's
  // own language names are case-insensitive, so `PLpgSQL` is a plausible answer
  // and refusing it would be refusing a language we run.
  for (const said of ["PLpgSQL", "PLPGSQL"]) {
    const c = await addon("fw-lang-case", "add a reminder sender", {
      kinds: ["function"], answers: { function: { function: [{ ...FN, language: said }] } },
    });
    assert.deepEqual(c.body.functions, ["send_reminder"], said + " was refused, and it is a language we run");
    assert.match(c.sql.find((s) => /CREATE OR REPLACE FUNCTION "send_reminder"/.test(s)), /LANGUAGE plpgsql/,
      said + " did not reach the DDL as plpgsql");
  }
  // AND AN EMPTY STRING IS ABSENCE, NOT A LANGUAGE. A model that answers the
  // property with "" is saying nothing; reading it as a value refuses a
  // perfectly good function for a word nobody wrote.
  const empty = await addon("fw-lang-empty", "add a reminder sender", {
    kinds: ["function"], answers: { function: { function: [{ ...FN, language: "" }] } },
  });
  assert.deepEqual(empty.body.functions, ["send_reminder"], "an empty language was read as a language and refused");
  assert.match(empty.sql.find((s) => /CREATE OR REPLACE FUNCTION "send_reminder"/.test(s)), /LANGUAGE sql/);
});

test("a stored declaration's language is read whatever case it was written in", async () => {
  // `fnLanguage` IS THE ONE READER and it folds case, which matters most for a
  // STORED spec: `_meta.functions` is whatever was written into it, possibly
  // by a version of this platform that did not normalise, and a `PLpgSQL` read
  // as unknown falls to `sql` — the silent conversion this round exists to
  // stop, arriving through the readback instead of through the tool.
  assert.equal(fnLanguage("PLpgSQL"), "plpgsql");
  assert.equal(fnLanguage("  PLPGSQL  "), "plpgsql");
  assert.equal(fnLanguage("SQL"), "sql");
  assert.equal(fnLanguage("plpython3u"), "sql", "an unknown language does not fall to the default");
  assert.equal(fnLanguage(undefined), "sql");
  assert.equal(fnLanguage(null), "sql");
  // AND THE READER IS WHAT THE EMITTER USES, so a stored mixed-case language
  // reaches Postgres correctly rather than only normalising in the abstract.
  const sql = functionSql({ name: "f", args: [], returns: "int", body: "SELECT 1", language: "PLpgSQL", internal: true });
  assert.match(sql[0], /LANGUAGE plpgsql/, "the emitter did not fold the case the reader folds");
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
  // ── A PHOTOGRAPH IS NAMED BY THE ROUTE IT SITS ON, NEVER BY ITS FILE ──────
  //
  // A sweep survivor is why this is here: nothing anywhere asserted which
  // identity `existingFacts` gives a picture, so naming it `gallery.tsx`
  // changed no result — and a requirement names `/gallery`, because that is
  // what a designer can know. `routeOf` is the one reader both sides go
  // through, so the two lists cannot spell one page two ways.
  const shot = existingFacts({
    sources: [
      { path: "src/routes/gallery.tsx", source: '<main><SafeImage src="/u/fw/a1b2.jpg" alt="the bench" /></main>' },
      { path: "src/routes/prices.tsx", source: "<main><h1>Prices</h1></main>" },
    ],
    slug: "fw",
  });
  assert.ok(shot.kinds.includes("photo"), "the site's own photographs are not enumerable at all");
  assert.deepEqual(shot.items, [{ kind: "photo", name: "/gallery" }],
    "a photograph is not named by the route a requirement can name: " + JSON.stringify(shot.items));
  // …AND THE SLUG IS WHAT SCOPES IT. Another site's upload is a `src` too, and
  // a kit illustration is a `src` too; neither is a photograph this owner paid
  // for. With no slug the inventory is unreadable and `photo` MUST NOT SPEAK —
  // "nobody looked" rather than a silent "there are none".
  assert.deepEqual(existingFacts({ sources: [{ path: "src/routes/gallery.tsx", source: '<SafeImage src="/u/other/a1b2.jpg" />' }], slug: "fw" }).items, [],
    "another site's upload was counted as this one's photograph");
  assert.ok(!existingFacts({ sources: [{ path: "src/routes/gallery.tsx", source: '<SafeImage src="/u/fw/a1b2.jpg" />' }] }).kinds.includes("photo"),
    "with no slug the photographs are unreadable and the reader spoke anyway");
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
  const r = await boughtAsk("fw-both", [{ page: "/gallery", describe: BENCH, name: "bench" }]);
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
      photo: { photo: [{ page: "/", describe: BENCH, name: "bench" }] },
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
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
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
    { page: "/gallery", describe: BENCH, name: "bench" },
    { page: "/gallery", describe: "the lathe with its belt guard open", name: "lathe" },
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
  const many = Array.from({ length: IMAGE_CAP + 1 }, (_, i) => ({ page: "/", describe: "picture number " + i, name: "shot" + i }));
  const c = cleanAdd("photo", many, SITE_P);
  assert.equal(c.value.length, IMAGE_CAP, "the cleaner kept " + c.value.length + " pictures against a cap of " + IMAGE_CAP);
  // ⚠ RE-ANCHORED 2026-09-19: a picture carries its own name now, so the drop
  // says WHICH one — where this read `name: ""`, which is the sentence the
  // over-cap branch exists to give and could not fill in. Strictly stronger.
  assert.deepEqual(c.skipped, [{ why: "over-cap", name: "shot" + IMAGE_CAP }], "the one left out was not named");
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
  const r = await boughtAsk("fw-photo-down", [{ page: "/gallery", describe: BENCH, name: "bench" }], { shotFail: true });
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
      photo: { photo: [{ page: "/prices", describe: BENCH, name: "bench" }] },
    },
  });
  assert.equal(bad.status, 422, JSON.stringify(bad.body));
  assert.equal(bad.body.reason, "no-page", "a picture aimed at a page nobody has was placed somewhere");
  assert.deepEqual(bad.shots, [], "a picture with no destination was paid for");
  assert.equal(bad.body.cost, 0, "a refused addition was billed");

  // THE CONTROL, one field apart: the page THIS CHANGE IS ADDING is a real
  // destination, which is what makes the refusal above about the route rather
  // than about pictures never being placeable.
  const ok = await boughtAsk("fw-photo-planned", [{ page: "/gallery", describe: BENCH, name: "bench" }]);
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
  // RE-ANCHORED ONTO THE PROPERTY, NOT THE SPELLING (2026-09-19). This read
  // `/do not replace one, and do not remove it/` — the PLURAL sentence, on a
  // case whose count is exactly 1 — and went red when the clause learned to
  // agree with its own number. What it is about is that a counted photograph is
  // also PROTECTED, which is the half a model reads past, and that is true in
  // either number.
  assert.match(flat, /do not replace/, "the photograph was counted and not protected");
  assert.match(flat, /do not remove/, "the photograph was counted and not protected");
  // …AND THE SENTENCE AGREES WITH ITSELF, which is strictly stronger than what
  // the old anchor asked: one photograph described as *"they stay exactly as
  // they are"* is a directive arguing with its own count.
  assert.doesNotMatch(flat, /1 real photograph, and they stay/,
    "one photograph was described in the plural: " + (flat.match(/already shows[^.]*\./) || [""])[0]);

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
      photo: { photo: [{ page: "/gallery", describe: "a refret on the bench under the window", name: "refret" }] } },
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
    photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
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
  // ⚠ RE-ANCHORED 2026-09-19: the sentence gained a carve-out for a src copied
  // from the list, because the clause beside it now GRANTS reuse. The property
  // is the one this case has always asserted — the ban is scoped to what this
  // change ADDS and the shape is an EMPTY src, not a missing one.
  assert.match(flat, /A picture this change ADDS .*is a <SafeImage> with an EMPTY src/,
    "the ban stopped being scoped to what this change adds, or went back to a missing src");
  // …AND THE URLS ARE IN THE PROMPT NOW, which is what makes the reuse the
  // permission describes possible without inventing a path.
  assert.match(flat, /You MAY show one of them again somewhere new/, "the reuse permission is not in the paid form");

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

test("a photograph the site already has may be shown again, and an invented one never ships", async () => {
  // ⚠ Owner, 2026-09-19: *"Photo reuse needs no new permission decision merely
  // to improve guidance."* Both halves were REPRODUCED before anything moved.
  //
  // THE CAPABILITY WAS ALREADY THERE AND NOTHING SAID SO. A `/u/` url copied
  // onto a new page passes `keptImages` (reuse ADDS; that wall asks about
  // losses), comes through `applyImages` byte-identical and leaves the distinct
  // count where it was — and MEASURED, the directive carried **zero** `/u/`
  // urls in all three of its forms, while the sentence beside the count read
  // *"any picture this change adds stays a `<SafeImage>` with an empty src"*.
  // A model asked to show a picture it has only been COUNTED has exactly one
  // way to comply: invent a path.
  const KEPT = "/u/fw-reuse/a1b2c3d4.jpg";
  const reuse = await photoAsk("fw-reuse", {
    kinds: ["page"], storedPages: [photoHome("fw-reuse")],
    written: [
      galleryWith('<SafeImage src="' + KEPT + '" alt="the workshop bench again" />'),
      linkHome("fw-reuse", '<SafeImage src="' + KEPT + '" alt="the workshop bench" />'),
    ],
  });
  assert.equal(reuse.body.ok, true, JSON.stringify(reuse.body));
  // 1. THE WRITER WAS GIVEN THE URL AND THE PERMISSION, which is the fix: a
  //    count cannot be copied into a `src`.
  const flat = pagePrompt(reuse).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  assert.match(flat, /already shows 2 real photographs/, "the count is not stated: " + flat.slice(0, 200));
  assert.match(flat, /You MAY show one of them again somewhere new/, "the permission never reached the writer");
  assert.ok(flat.includes(KEPT), "the writer was counted a photograph it was never given the src of");
  // 2. AND IT REALLY SHIPS. The compiler payload is the artifact; the stored
  //    source is what the next edit works from; both carry the reused url.
  const shipped = compiledPages(reuse).find((f) => /gallery/.test(f.path));
  assert.ok(shipped, "the gallery page never reached the compiler: " + JSON.stringify(compiledPages(reuse).map((f) => f.path)));
  assert.ok(shipped.source.includes(KEPT), "the reused photograph was stripped on the way to the compiler");
  assert.match(storedSource(reuse, "fw-reuse", "gallery.tsx"), /\/u\/fw-reuse\/a1b2c3d4\.jpg/,
    "the reused photograph is not in the source the next edit reads");
  // 3. AND IT COST NOTHING AND ADDED NOTHING. A picture drawn twice is one
  //    picture: no purchase, and no "space for a photo" sentence about a frame
  //    that is full.
  assert.deepEqual(reuse.shots, [], "showing a photograph again bought a second copy of it");
  assert.equal(reuse.body.photos || 0, 0, "a filled frame was reported as an empty one: " + JSON.stringify(reuse.body.photos));

  // ── THE WALL: A src THIS SITE DOES NOT OWN NEVER SHIPS ───────────────────
  //
  // MEASURED before it existed: an invented `/u/<slug>/…` url passed
  // `keptImages` (`{ok: true, lost: []}`), came through `applyImages`
  // byte-identical and `photoUrls` read it as this site's — so it would have
  // published as a broken image on a real customer's page. It is SWEPT to an
  // empty src rather than refused, which is `applyImages`' own answer to an
  // unbought token: the page ships and the frame becomes a slot.
  const FAKE = "/u/fw-invent/deadbeefdeadbeef.jpg";
  const invent = await photoAsk("fw-invent", {
    kinds: ["page"], storedPages: [photoHome("fw-invent")],
    written: [
      galleryWith('<SafeImage src="' + FAKE + '" alt="a picture nobody bought" />'),
      linkHome("fw-invent", '<SafeImage src="/u/fw-invent/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(invent.body.ok, true, "the sweep refused the whole change instead of emptying one src");
  const bad = compiledPages(invent).find((f) => /gallery/.test(f.path));
  assert.ok(bad, "the gallery page never reached the compiler");
  assert.equal(bad.source.includes(FAKE), false, "an invented url reached the compiler: " + bad.source.slice(0, 300));
  assert.match(bad.source, /src=""/, "the invented src was deleted rather than emptied — the picture rung cannot fill a missing one");
  assert.equal(storedSource(invent, "fw-invent", "gallery.tsx").includes(FAKE), false,
    "an invented url is in the source the next edit reads");
  // …AND THE ONES THE SITE REALLY OWNS ARE UNTOUCHED, which is what makes this
  // a wall on invention rather than on `/u/` urls.
  assert.match(storedSource(invent, "fw-invent", "index.tsx"), /\/u\/fw-invent\/a1b2c3d4\.jpg/,
    "the sweep took a photograph the site really owns");
  // AND THE CUSTOMER HEARS ABOUT THE FRAME IT LEFT, through the sentence that
  // already exists — the swept src is an empty slot the picture rung can fill.
  assert.ok((invent.body.photos || 0) >= 1,
    "the emptied frame was not counted, so nobody is told about it: " + JSON.stringify(invent.body.photos));

  // ── AND A COMPONENT IS A GENERATED FILE TOO ──────────────────────────────
  //
  // ⚠ A SWEEP SURVIVOR. The route sweeps two lists and the case above drove
  // one, so cutting the parts half changed nothing anybody could see — and a
  // section is where a gallery lives on this platform, which makes it the
  // likelier place for an invented path than a page is.
  const PART_FAKE = "/u/fw-invent-part/cafebabecafebabe.jpg";
  const inPart = await photoAsk("fw-invent-part", {
    kinds: ["page"], storedPages: [photoHome("fw-invent-part")],
    written: [
      galleryWith('<GalleryStrip />'),
      linkHome("fw-invent-part", '<SafeImage src="/u/fw-invent-part/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
    writtenParts: [{ name: "gallery-strip", source: 'export default function GalleryStrip(){ return <SafeImage src="' + PART_FAKE + '" alt="nobody bought this" /> }' }],
  });
  assert.equal(inPart.body.ok, true, JSON.stringify(inPart.body));
  // READ OFF THE CONTAINER PAYLOAD'S OWN `parts`, not off a reply field: the
  // question is what was HANDED to the thing that builds the site.
  const sentParts = ((inPart.compiles || [])[0] || {}).body?.parts || [];
  const strip = sentParts.find((p) => /gallery-strip/.test(String(p && p.name)));
  assert.ok(strip, "the component never reached the compiler: " + JSON.stringify(sentParts.map((p) => p && p.name)));
  assert.equal(String(strip.source).includes(PART_FAKE), false,
    "an invented url inside a component reached the compiler: " + String(strip.source).slice(0, 200));
  assert.match(String(strip.source), /src=""/, "the component's invented src was deleted rather than emptied");
});

test("an upload the site owns survives the stray wall, whether or not a page has drawn it", async () => {
  // ⚠ Owner, 2026-09-19: *"'Not referenced in existing source' does not mean
  // 'not owned by this site.' … Establish asset existence from the site's
  // upload storage when validation is needed. An unreadable check must remain
  // unknown. Restrict any image correction to actual image references; never
  // blanket-replace matching strings in links or other content."*
  //
  // BOTH REPRODUCED THROUGH THIS ROUTE before anything was touched, on the
  // asks below:
  //
  //   a valid uploaded image, never placed →  <SafeImage src="" alt="…" />
  //   a valid uploaded PDF, linked         →  <a href="" download>…</a>
  //
  // The first is this platform deleting a customer's own photograph because
  // nothing had drawn it before; the second is a download button that downloads
  // nothing, produced by a photograph guard reaching into a link.

  // ── 1. A VALID UPLOAD THE OWNER HAS NOT PLACED YET ──────────────────────
  //
  // `uploads` is the state no page source can express: the owner uploaded it
  // and it is on nothing. `before` cannot vouch for it and the upload store
  // can, which is the whole correction.
  const UP = "/u/fw-owned/9f9f9f9f9f9f9f9f.jpg";
  const owned = await photoAsk("fw-owned", {
    kinds: ["page"], storedPages: [photoHome("fw-owned")],
    uploads: ["9f9f9f9f9f9f9f9f.jpg"],
    written: [
      galleryWith('<SafeImage src="' + UP + '" alt="the bench, uploaded last week" />'),
      linkHome("fw-owned", '<SafeImage src="/u/fw-owned/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(owned.body.ok, true, JSON.stringify(owned.body));
  const ownedPage = compiledPages(owned).find((f) => /gallery/.test(f.path));
  assert.ok(ownedPage, "the gallery page never reached the compiler");
  assert.ok(ownedPage.source.includes(UP),
    "the owner's own upload was emptied on the way to the compiler: " + ownedPage.source.slice(0, 300));
  assert.match(storedSource(owned, "fw-owned", "gallery.tsx"), /9f9f9f9f9f9f9f9f\.jpg/,
    "the owner's own upload is not in the source the next edit reads");
  // …AND IT IS NOT A SPACE. A frame holding a real picture must not be offered
  // to the customer as one an upload could fill.
  assert.equal(owned.body.photos || 0, 0,
    "a filled frame was reported as an empty one: " + JSON.stringify(owned.body.photos));

  // ── 2. A VALID UPLOADED PDF, LINKED AS A DOWNLOAD ───────────────────────
  const PDF = "/u/fw-doc/pricelist20260919.pdf";
  const doc = await photoAsk("fw-doc", {
    kinds: ["page"], storedPages: [photoHome("fw-doc")],
    uploads: ["pricelist20260919.pdf"],
    written: [
      galleryWith('<SafeImage src="/u/fw-doc/a1b2c3d4.jpg" alt="the workshop bench" />'
        + '<a href="' + PDF + '" download>Our price list (PDF)</a>'),
      linkHome("fw-doc", '<SafeImage src="/u/fw-doc/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(doc.body.ok, true, JSON.stringify(doc.body));
  const docPage = compiledPages(doc).find((f) => /gallery/.test(f.path));
  assert.ok(docPage.source.includes('href="' + PDF + '"'),
    "the download link was emptied: " + docPage.source.slice(0, 400));
  assert.match(storedSource(doc, "fw-doc", "gallery.tsx"), /pricelist20260919\.pdf/,
    "the download link is gone from the source the next edit reads");

  // …AND A DOCUMENT IS SAFE FOR THE SECOND REASON TOO, which is the stronger
  // one: an `href` is not an image reference, so it is never a CANDIDATE and
  // the store is never even asked about it. Same ask, nothing uploaded.
  const stray = await photoAsk("fw-nodoc", {
    kinds: ["page"], storedPages: [photoHome("fw-nodoc")],
    written: [
      galleryWith('<SafeImage src="/u/fw-nodoc/a1b2c3d4.jpg" alt="the workshop bench" />'
        + '<a href="/u/fw-nodoc/pricelist20260919.pdf" download>Our price list (PDF)</a>'),
      linkHome("fw-nodoc", '<SafeImage src="/u/fw-nodoc/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.ok(compiledPages(stray).find((f) => /gallery/.test(f.path)).source.includes("pricelist20260919.pdf"),
    "an href was emptied because nothing had uploaded it — the correction reached a link");

  // ── 3. THE CONTROL: A GENUINELY MISSING IMAGE IS STILL CORRECTED ────────
  //
  // Without this the two arms above pass with the wall deleted, which is the
  // whole of what makes them worth anything.
  const GONE = "/u/fw-missing/deadbeefdeadbeef.jpg";
  const missing = await photoAsk("fw-missing", {
    kinds: ["page"], storedPages: [photoHome("fw-missing")],
    written: [
      galleryWith('<SafeImage src="' + GONE + '" alt="a picture nobody uploaded" />'),
      linkHome("fw-missing", '<SafeImage src="/u/fw-missing/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(missing.body.ok, true, "the wall refused the whole change instead of emptying one src");
  const gonePage = compiledPages(missing).find((f) => /gallery/.test(f.path));
  assert.equal(gonePage.source.includes(GONE), false,
    "a url no upload backs reached the compiler: " + gonePage.source.slice(0, 300));
  assert.match(gonePage.source, /src=""/, "the missing src was deleted rather than emptied");
  assert.ok((missing.body.photos || 0) >= 1,
    "the emptied frame was not counted, so nobody is told about it: " + JSON.stringify(missing.body.photos));

  // …AND A URL THE SERVE ROUTE ITSELF REFUSES IS A REAL ABSENCE, not a
  // cannot-tell: no object in any bucket can make `/u/<slug>/a b.jpg` fetch,
  // because the shape is 404 before the bucket is consulted. Reading that as
  // unknown would ship a broken image on the strength of not having looked.
  const BAD = "/u/fw-shape/a b.jpg";
  const shape = await photoAsk("fw-shape", {
    kinds: ["page"], storedPages: [photoHome("fw-shape")],
    uploads: ["a b.jpg"],   // even WITH bytes behind it, the address cannot reach them
    written: [
      galleryWith('<SafeImage src="' + BAD + '" alt="a path the serve route 404s on" />'),
      linkHome("fw-shape", '<SafeImage src="/u/fw-shape/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(compiledPages(shape).find((f) => /gallery/.test(f.path)).source.includes(BAD), false,
    "a url the serve route cannot answer was shipped as a picture");

  // ── 4. AND AN UNREADABLE STORE IS UNKNOWN, NEVER ABSENT ─────────────────
  //
  // The SAME ask as the control, with the upload store throwing: nothing may
  // be swept, because "we could not look" and "it is not there" are the two
  // answers this round exists to keep apart.
  const blind = await photoAsk("fw-missing", {
    kinds: ["page"], storedPages: [photoHome("fw-missing")], uploadsFail: true,
    written: [
      galleryWith('<SafeImage src="' + GONE + '" alt="a picture nobody uploaded" />'),
      linkHome("fw-missing", '<SafeImage src="/u/fw-missing/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.equal(blind.body.ok, true, JSON.stringify(blind.body));
  assert.ok(compiledPages(blind).find((f) => /gallery/.test(f.path)).source.includes(GONE),
    "an unreadable check swept a src — cannot-tell was read as not-there");
  // …AND IT SAYS SO. A run that swept nothing because the store was unreadable
  // and a run with nothing to sweep are the same reply otherwise, so the mark is
  // the only signal that the wall stood down. A sweep survivor: nothing read it.
  // BY THE DETAIL'S KEY, NOT BY THE STATUS: `edit-trace.mjs` keeps a closed
  // vocabulary (`ok`/`fail`/`start`, everything else `?`), so the `stray` mark
  // and this one arrive wearing the same `?` and only the key tells them apart.
  const picMark = (r) => (r.traces || []).filter((t) => t && t.phase === "pics");
  const blindMark = picMark(blind).find((t) => t.detail && typeof t.detail.unknown === "number");
  assert.ok(blindMark, "an unreadable store left no trace: " + JSON.stringify(picMark(blind)));
  assert.equal(blindMark.detail.unknown, 1, "the unknown count is wrong: " + JSON.stringify(blindMark.detail));
  // THE CONTROL: the same ask with a readable store leaves no such mark, so the
  // assertion above is about the store and not about a mark the route always
  // writes — and it really swept, so the run is not simply quiet.
  assert.equal(picMark(missing).some((t) => t.detail && typeof t.detail.unknown === "number"), false,
    "a readable store still reported an unknown: " + JSON.stringify(picMark(missing)));
  assert.ok(picMark(missing).some((t) => t.detail && t.detail.files >= 1),
    "the control swept nothing, so its silence about unknowns says nothing: " + JSON.stringify(picMark(missing)));

  // ── 5. A BUCKET WITH NO `head` AT ALL IS CANNOT-TELL, NOT ABSENT ────────
  //
  // A Worker whose binding cannot answer the question has not answered it.
  // A sweep survivor, and a wall nobody could drive until the fixture could
  // take its own method away.
  const mute = await photoAsk("fw-missing", {
    kinds: ["page"], storedPages: [photoHome("fw-missing")], noHead: true,
    written: [
      galleryWith('<SafeImage src="' + GONE + '" alt="a picture nobody uploaded" />'),
      linkHome("fw-missing", '<SafeImage src="/u/fw-missing/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.ok(compiledPages(mute).find((f) => /gallery/.test(f.path)).source.includes(GONE),
    "a bucket that cannot be asked swept a src");
});

test("a valid url with a query string or a fragment is looked up the way the route serves it", async () => {
  // ⚠ Owner, 2026-09-19: *"Make URL lookup follow the serving route's parsing.
  // Valid image URLs with `?v=2` or `#preview` currently serve successfully but
  // get emptied by the addon. Resolve the storage key from the pathname while
  // preserving the original valid URL in source."*
  //
  // REPRODUCED THROUGH THIS ROUTE before anything was touched, on both shapes:
  // the compiler payload came back `<SafeImage src="" alt="the bench" />`, with
  // `uploadKeyFor` answering `null` — read as a url no object could back,
  // therefore swept — while the serve route's own read of the SAME url is
  // `["fw-q", "9f9f….jpg"]`, because it matches `url.pathname` and the URL
  // parser has already taken the query and the fragment off.
  const FILE = "/u/fw-q/9f9f9f9f9f9f9f9f.jpg";
  const at = (tail) => photoAsk("fw-q", {
    kinds: ["page"], storedPages: [photoHome("fw-q")],
    uploads: ["9f9f9f9f9f9f9f9f.jpg"],
    written: [
      galleryWith('<SafeImage src="' + FILE + tail + '" alt="the bench" />'),
      linkHome("fw-q", '<SafeImage src="/u/fw-q/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });

  for (const tail of ["?v=2", "#preview", "?v=2&w=800"]) {
    const r = await at(tail);
    assert.equal(r.body.ok, true, JSON.stringify(r.body));
    const page = compiledPages(r).find((f) => /gallery/.test(f.path));
    // THE ORIGINAL URL IS WHAT SHIPS, character for character. The lookup
    // answers a KEY; nothing here may rewrite the page to a normalised address
    // of its own — that would be a guard editing a customer's source to suit
    // itself, and a `?v=` is how a browser is told the picture changed.
    assert.ok(page.source.includes('src="' + FILE + tail + '"'),
      "a url that serves was emptied, or rewritten: " + (page.source.match(/<SafeImage[^>]*>/) || [""])[0]);
    assert.match(storedSource(r, "fw-q", "gallery.tsx"), new RegExp(tail.replace(/[?&#]/g, "\\$&")),
      "the next edit reads a source the query string has been taken out of");
    assert.equal(r.body.photos || 0, 0,
      "a filled frame was reported as an empty one: " + JSON.stringify(r.body.photos));
  }

  // ── THE TWO CONTROLS THE OWNER ASKED TO RETAIN ──────────────────────────
  //
  // Without these the loop above passes with the wall deleted, and the fix
  // would read as working while sweeping nothing at all.
  //
  // 1. A MISSING FILE IS STILL SWEPT — same shape, same query string, nothing
  //    uploaded behind it.
  const missing = await photoAsk("fw-q-missing", {
    kinds: ["page"], storedPages: [photoHome("fw-q-missing")],
    written: [
      galleryWith('<SafeImage src="/u/fw-q-missing/deadbeefdeadbeef.jpg?v=2" alt="nobody uploaded this" />'),
      linkHome("fw-q-missing", '<SafeImage src="/u/fw-q-missing/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  const gonePage = compiledPages(missing).find((f) => /gallery/.test(f.path));
  assert.equal(gonePage.source.includes("deadbeefdeadbeef.jpg?v=2"), false,
    "a query string made a url no upload backs survive the wall: " + gonePage.source.slice(0, 300));
  assert.match(gonePage.source, /src=""/, "the missing src was deleted rather than emptied");

  // 2. AN UNREADABLE STORE IS STILL UNKNOWN — the same ask, the store throwing.
  const blind = await photoAsk("fw-q-missing", {
    kinds: ["page"], storedPages: [photoHome("fw-q-missing")], uploadsFail: true,
    written: [
      galleryWith('<SafeImage src="/u/fw-q-missing/deadbeefdeadbeef.jpg?v=2" alt="nobody uploaded this" />'),
      linkHome("fw-q-missing", '<SafeImage src="/u/fw-q-missing/a1b2c3d4.jpg" alt="the workshop bench" />'),
    ],
  });
  assert.ok(compiledPages(blind).find((f) => /gallery/.test(f.path)).source.includes("deadbeefdeadbeef.jpg?v=2"),
    "an unreadable check swept a src — cannot-tell was read as not-there");
});

test("a mixed picture-and-download site offers the photograph and leaves the PDF a download", async () => {
  // ⚠ Owner, 2026-09-19: *"Separate the photo-reuse list from the preservation
  // inventory. Leave the existing loss protection intact, but stop describing
  // PDF downloads as photographs or offering them as image sources.
  // Demonstrate a mixed image/PDF site: the photograph is offered for reuse,
  // the PDF remains a download, and both existing references survive."*
  //
  // REPRODUCED THROUGH THIS ROUTE: the writer was told *"This site already
  // shows 2 real photographs… copy its src EXACTLY from this list —
  // /u/fw-mix/a1b2c3d4.jpg, /u/fw-mix/pricelist20260919.pdf"*. The count was
  // wrong and the second entry was an invitation to put a PDF in a
  // `<SafeImage>` — one reader answering two different questions.
  const PDF = "/u/fw-mix/pricelist20260919.pdf";
  const PIC = "/u/fw-mix/a1b2c3d4.jpg";
  const DOC = '  <a href="' + PDF + '" download>Our price list (PDF)</a>\n';
  const home = {
    path: "index.tsx",
    source: photoHome("fw-mix").source
      // ONE photograph and ONE download, so the two readers can disagree.
      .replace('  <SafeImage src="/u/fw-mix/e5f6a7b8.jpg" alt="a guitar being refretted" />\n', DOC),
  };
  const r = await photoAsk("fw-mix", {
    kinds: ["page"], storedPages: [home], uploads: ["a1b2c3d4.jpg", "pricelist20260919.pdf"],
    written: [
      // The writer takes the offer: it shows the site's own photograph again on
      // the new page, which is the capability the list exists for.
      galleryWith('<SafeImage src="' + PIC + '" alt="the workshop bench" />'),
      { path: "index.tsx", source: home.source.replace("</main>",
        '  <p>Also see the <a href="/gallery">gallery</a>.</p>\n</main>') },
    ],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // 1. THE PHOTOGRAPH IS OFFERED FOR REUSE AND THE PDF IS NOT.
  const flat = pagePrompt(r).text.replace(/\\n/g, " ").replace(/\\"/g, '"');
  const clause = (flat.match(/This site already shows[^]*?will be emptied\./) || [""])[0];
  assert.ok(clause, "the reuse clause is gone from the directive");
  assert.match(clause, /already shows 1 real photograph/,
    "the download was counted as a photograph: " + clause.slice(0, 160));
  assert.ok(clause.includes(PIC), "the site's own photograph was not offered for reuse: " + clause.slice(0, 300));
  assert.equal(clause.includes("pricelist20260919.pdf"), false,
    "a PDF download was offered as an image source: " + clause.slice(0, 300));

  // 2. BOTH EXISTING REFERENCES SURVIVE — the loss wall is unmoved, and it is
  //    deliberately the wider reader: it protects the download too.
  const out = compiledPages(r);
  const idx = out.find((f) => /index/.test(f.path));
  assert.ok(idx.source.includes('href="' + PDF + '"'),
    "the download link was emptied: " + idx.source.slice(0, 400));
  assert.ok(idx.source.includes('src="' + PIC + '"'), "the home page's photograph was lost");
  assert.match(storedSource(r, "fw-mix", "index.tsx"), /pricelist20260919\.pdf/,
    "the download is gone from the source the next edit reads");

  // 3. AND THE REUSED PHOTOGRAPH REALLY SHIPS ON THE NEW PAGE, so the offer is
  //    a capability and not a sentence. It is the site's own url, so the stray
  //    wall leaves it alone and nothing is bought for it.
  const gal = out.find((f) => /gallery/.test(f.path));
  assert.ok(gal.source.includes('src="' + PIC + '"'),
    "the photograph the writer was invited to reuse was emptied: " + gal.source.slice(0, 300));
  assert.equal(r.body.pictures || 0, 0, "reuse bought a photograph: " + JSON.stringify(r.body.pictures));
  assert.equal(r.body.photos || 0, 0, "a reused photograph was reported as an empty frame");
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
      photo: { photo: [{ page: "/", describe: BENCH, name: "bench" }] },
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
      photo: { photo: [{ page: "/", describe: BENCH, name: "bench" }] },
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
    photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }, { page: "/gallery", describe: LATHE, name: "lathe" }] },
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
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
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
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
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
  // ⚠ THE HOME PAGE REALLY SHOWS THAT PHOTOGRAPH (2026-09-19), and it has to.
  // The wall added with the reuse permission empties any `/u/<slug>/` src the
  // site does not own, so a url invented for a fixture is swept and the frame
  // reads empty — which is the wall being right about a made-up path and has
  // nothing to do with what this case tests. A picture the site really has is
  // the honest instance of *"a list entry that really carries a picture"*, and
  // it makes this a route-level proof that a reused url survives end to end.
  const owned = (slug) => ({
    ...storedPage("/"),
    source: '<SafeImage src="/u/' + slug + '/abc123.jpg" alt="The brick oven" />',
  });
  const r = await addon("fw-frames-full", "add a gallery page", {
    kinds: ["page"], publishes: true, storedPages: [owned("fw-frames-full")],
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
    kinds: ["page"], publishes: true, storedPages: [owned("fw-frames-quoted")],
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
  // …AND A SCENE IS AN APPLIED RESULT TOO.
  //
  // ⚠ RE-ANCHORED 2026-09-19, AND THE EXPECTATION MOVED RATHER THAN BROKE. It
  // pinned `holds: []` with the note "an empty vocabulary for `page`'s reason:
  // existence is the entire claim", and existence turned out to be TWO claims.
  // Owner: *"For 3D, distinguish: A scene declared. • The scene actually
  // included in the relevant page/artifact."* They come apart structurally —
  // `three` is a stored look field decided by the DESIGN step and the canvas is
  // written by the PAGE step, a different model call reading `sceneDirective` —
  // and `three` shipped in exactly that state once already, stored with no way
  // to reach the page rules at all.
  //
  // BOTH ARE ARTIFACT FACTS, so both are `holds` and `checked` stays empty:
  // nothing here starts a WebGL context, and a `<Canvas>` in the source is not
  // a scene a visitor can see.
  assert.deepEqual(appliedFacts({ three: true, threeOn: ["/gallery"] }),
    [{ kind: "three", name: "three", holds: ["declared", "onpage", "/gallery"], fails: [], checked: [] }]);
  // …AND DECLARED-WITH-NO-CANVAS IS A CONTRADICTION, not a silence. `fails` is
  // asked FIRST, so a claim saying the scene shows on the page reads as denied
  // rather than as configuration that holds.
  assert.deepEqual(appliedFacts({ three: true }),
    [{ kind: "three", name: "three", holds: ["declared"], fails: ["onpage"], checked: [] }]);
  assert.deepEqual(appliedFacts({ three: false, threeOn: ["/gallery"] }), [],
    "a scene nobody added was claimed as applied because a page happened to draw one");
  assert.deepEqual(appliedFacts({ three: false }), [], "a scene nobody added was claimed as applied");
  // AND THE CLAIM READER TELLS THE TWO APART, which is the whole point of the
  // split: the same sentence about the same applied scene answers differently
  // depending on whether a page really carries it.
  //
  // THE PROSE MUST NAME THE ITEM FIRST — `claimEvidence` locates an applied
  // item by NAME before it reads a token, and a scene's name is `three`
  // (`SINGLE_FIELDS`, so the kind is the name). So this is the reader's
  // narrower door and NOT the main one: an ordinary `by` clause about a scene
  // says "a slowly turning loaf on the gallery page", which names neither, and
  // what resolves that is the explicit `{kind, item}` reference. Stated rather
  // than implied, because a case that only drove the prose path would read as
  // proof of a door most claims never go through.
  const [onPage] = appliedFacts({ three: true, threeOn: ["/gallery"] });
  const [offPage] = appliedFacts({ three: true });
  assert.equal(claimEvidence("the three scene is onpage", [onPage]).kind, "config");
  assert.equal(claimEvidence("the three scene is onpage", [offPage]).kind, "contradicted");
  assert.equal(claimEvidence("a slowly turning loaf on the gallery page", [onPage]), null,
    "an ordinary clause naming neither the item nor a token bought evidence anyway");
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
  const wcov = storedAnswer(wrong, "fw-qr-echo-wrong").coverage.requirements;
  const w = wcov.find((x) => x.status === "elsewhere");
  assert.equal(w.state, "unknown", "an echo naming a code nobody made settled the hand-off: " + JSON.stringify(w));
  assert.equal(w.reconciledBy, undefined, "a reconciliation happened over an item that does not exist: " + JSON.stringify(w));
  // …AND THE ANSWER'S OWN FINDING SURVIVES. It named a code and this layer
  // looked and did not find one, which is `missing` — resolved, not unresolved
  // — so it keeps speaking and the customer gets the actionable line. The
  // silence below is for an answer that established NOTHING; eating a finding
  // with it would delete the most useful sentence in the reply.
  const wa = wcov.find((x) => x.status === "covered");
  assert.equal(wa.state, "missing", "the control does not reach the finding: " + JSON.stringify(wa));
  assert.equal(wa.spokenForBy, undefined, "a real finding was silenced: " + JSON.stringify(wa));
  assert.match(wrong.body.coverNote || "", /Still to do: A QR code opens the gallery page/, wrong.body.coverNote);

  // ── CONTROL 2: NO ITEM AT ALL, AND PROSE THAT NAMES THE CODE ─────────────
  //
  // ⚠ RE-ANCHORED 2026-09-19 ONTO THE OWNER'S OWN ECHO, and the re-anchor is
  // the finding. This control was written the round before with
  // `by: "a code was made"` — prose carrying no applied item's name, so
  // `claimEvidence` matched nothing and the case passed whatever the product
  // did. Owner: *"Reproduce an echo with answers: "page#0", no item, and by:
  // "the gallery code points at /gallery". It currently produces both "I've set
  // that up" and "I can't see whether" for the same need."* That sentence holds
  // the word `gallery`, which is the applied code's own name, and THAT is what
  // armed the defect. **A control whose fixture cannot trigger the defect is a
  // control that proves nothing**, and this one could not.
  //
  // REPRODUCED before the fix: the hand-off `unknown` and the answer
  // `configured` off the prose, so one need got *"I've set that up, but I can't
  // confirm…"* AND *"I can't see from here whether…"* in one reply.
  const bare = await addon("fw-qr-echo-bare", "add a gallery page and a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      qr: {
        qr: { name: "gallery", points: "/gallery", label: "Our gallery" },
        requirements: [{ need: ECHO.need, status: "covered", by: "the gallery code points at /gallery", answers: "page#0" }],
      },
    },
  });
  assert.equal(bare.body.ok, true, JSON.stringify(bare.body));
  assert.ok((bare.body.moved || []).includes("qr"), "no code was made — this control tests nothing");
  const bcov = storedAnswer(bare, "fw-qr-echo-bare").coverage.requirements;
  const b = bcov.find((x) => x.status === "elsewhere");
  assert.equal(b.state, "unknown", "an echo naming nothing settled the hand-off from a count again: " + JSON.stringify(b));
  assert.equal(b.reconciledBy, undefined, "a nameless echo reconciled: " + JSON.stringify(b));
  // AND THE ANSWER AGREES WITH THE REQUEST IT ANSWERS rather than contradicting
  // it: unresolved, not lifted by its own sentence, and spoken for by the
  // hand-off in the prose while keeping every field in the record.
  const ba = bcov.find((x) => x.status === "covered");
  assert.equal(ba.state, "unknown", "an unresolved answer regained certainty through prose: " + JSON.stringify(ba));
  assert.equal(ba.configuredBy, undefined, "a prose match lifted an answer that resolved to nothing: " + JSON.stringify(ba));
  assert.equal(ba.spokenForBy, "page#0", "the record does not say which request speaks for it: " + JSON.stringify(ba));
  assert.equal(ba.by, "the gallery code points at /gallery", "the answer's own words were rewritten: " + JSON.stringify(ba));
  // ⚠ AND THE COMPLETE CUSTOMER SENTENCE, because the defect is a contradiction
  // BETWEEN two clauses and no single assertion about one of them can see it.
  const bn = bare.body.coverNote || "";
  assert.equal(bn,
    "I can't see from here whether A QR code opens the gallery page. — nothing I can check says either way, "
    + "so have a look, and ask me for it again if it isn't there.", "the reply is not the one honest sentence: " + bn);
  assert.doesNotMatch(bn, /I've set that up/, "an unresolved answer still claims the work was set up: " + bn);
  assert.equal((bn.match(/A QR code opens the gallery page/g) || []).length, 1, "one need was said twice: " + bn);

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

/* ═══════════════════════════════════════════════════════════════════════════
   COVERAGE FOR `three` AND `photo` (task #188, 2026-09-19)

   Owner: *"QR gained requirements support; three and photo were recorded as
   still unable to raise or answer a requirement. Verify that this remains true
   before changing anything. Extend the existing requirement identity and
   reconciliation mechanism to these kinds. Do not build a new reporting
   system… For photographs, distinguish: An existing image reused. • A newly
   generated image. • A provider refusal or failure. • An image acquired but
   not placed. • An unavailable destination page. For 3D, distinguish: A scene
   declared. • The scene actually included in the relevant page/artifact. • A
   refused addition, including the existing one-scene-per-site restriction.
   Cover both positive cases and wrong-item controls… Keep checked empty."*

   VERIFIED FIRST, as instructed. Before any of this,
   `addTool("three").input_schema.properties` was `["three"]` and
   `addTool("photo")`'s was `["photo"]` — neither step had anywhere to raise a
   gap or echo an id it had been handed. Both briefs already reached them,
   because `requirementBrief` is composed for every kind in the route's loop.

   THE IDENTITIES ARE THE KINDS' OWN AND NOTHING IS INVENTED FOR THEM:
     · `three` — the name IS the kind, because `SINGLE_FIELDS` allows one scene
       per site, so a requirement handed to that step can be asking about
       exactly one thing.
     · `photo` — the name is the ROUTE it lands on. A photograph has no name
       anybody asks for: the designer answers `{page, describe}` and the url is
       minted by the provider AFTER it has spoken, so the placement is the only
       identity that exists before the picture does.
   ═════════════════════════════════════════════════════════════════════════ */

const PHOTO_PAGE = { path: "/gallery", name: "Gallery", purpose: "show our work",
  sections: ["a grid of photographs"], components: ["card"] };

test("a photograph this change put on a page answers its hand-off, and one for another page does not", async () => {
  // THE POSITIVE: the page step asks the photo step for a picture on the page
  // it is adding, and the photo step echoes the id with the placement.
  const HANDOFF = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const ECHO = { need: HANDOFF.need, status: "covered", by: "a photograph of the bench on /gallery",
    answers: "page#0", kind: "photo", item: "/gallery" };
  const r = await photoAsk("fw-photo-echo", {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryToken(BENCH)],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [HANDOFF] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [ECHO] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: a picture was really bought and really landed. Without
  // it this case is about a step that did nothing.
  assert.equal(r.shots.length, 1, "no photograph was bought — this case tests nothing: " + JSON.stringify(r.shots));
  assert.ok(r.shots[0].startsWith(BENCH), "a different picture was bought from the one designed: " + r.shots[0]);
  assert.equal(r.body.pictures, 1, "no picture reached the page: " + JSON.stringify(r.body));

  // ⚠ THE WIRING HOP, AND IT IS THE ONLY ONE A ROUTE CASE CAN SEE — the same
  // finding the qr round recorded, one kind over. `cleanRequirements`,
  // `referenceOf` and `reconcileHandoffs` are kind-agnostic and always were, so
  // a fixture handing the echo in proves the reconciliation and says NOTHING
  // about whether a model could have written one. From outside, "the step did
  // not echo" and "we never offered it anywhere to echo" are one absence.
  const photoCall = r.prompts.find((p) => p.kind === "photo");
  assert.ok(photoCall, "the photo designer was never called: " + JSON.stringify(r.prompts.map((p) => p.kind)));
  assert.ok(photoCall.props.includes("requirements"),
    "the photo step has nowhere to say which request its picture answers: " + JSON.stringify(photoCall.props));
  assert.match(photoCall.text, /page#0/, "the photo step was never told the id it is asked to echo");

  const cov = storedAnswer(r, "fw-photo-echo").coverage.requirements;
  const q = cov.find((x) => x.status === "elsewhere");
  assert.equal(q.state, "configured", "the hand-off was not associated: " + JSON.stringify(q));
  assert.equal(q.reconciledItem, "/gallery", "the record does not name the placement that answered: " + JSON.stringify(q));
  assert.equal(q.reconciledKind, "photo", "the record does not say what kind of thing answered: " + JSON.stringify(q));
  assert.ok(/^photo#/.test(q.reconciledBy || ""), "the answering entry is not the photo step's: " + JSON.stringify(q));
  // …AND THE ANSWER'S OWN CLAIM RESOLVES ON THE ROUTE'S WORDS, so a real `by`
  // clause about a picture reads as configuration that holds rather than
  // falling to the bare-name reading. A sweep survivor: nothing read what a
  // photograph's entry SAYS, only that one existed.
  const qa = cov.find((x) => x.status === "covered");
  assert.equal(qa.state, "configured", "a picture really on the page did not resolve: " + JSON.stringify(qa));
  assert.equal(qa.configuredBy, "/gallery: gallery",
    "the placement that was read back is not recorded: " + JSON.stringify(qa));
  // THE CAP HOLDS. A placement read back off what was published is
  // configuration; nothing here looks at the picture, so `delivered` is a claim
  // this platform cannot make about a photograph.
  for (const e of cov) assert.notEqual(e.state, "delivered", "a claim was delivered with nothing checked: " + JSON.stringify(e));
  assert.match(r.body.coverNote || "", /I've set that up, but I can't confirm from here that The gallery page shows a photograph/,
    r.body.coverNote);

  // ── THE WRONG-ITEM CONTROL: the picture really landed, on ANOTHER page. A
  // placement is an identity precisely so a claim about one page cannot be
  // answered by a picture on a different one — which is the same request this
  // change's own `touched` filter refuses to blur.
  const wrong = await photoAsk("fw-photo-elsewhere", {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryToken(BENCH)],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [{ ...HANDOFF, item: "/prices" }] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [{ ...ECHO, item: "/prices" }] },
    },
  });
  assert.equal(wrong.body.ok, true, JSON.stringify(wrong.body));
  assert.equal(wrong.body.pictures, 1, "no picture was bought — this control tests nothing: " + JSON.stringify(wrong.body));
  const wcov = storedAnswer(wrong, "fw-photo-elsewhere").coverage.requirements;
  const w = wcov.find((x) => x.status === "elsewhere");
  // `missing` RATHER THAN `unknown`, AND THAT IS THE STRONGER ANSWER: `photo`
  // is a `SITE_KINDS` kind, so this layer really did enumerate every placement
  // and `/prices` is not among them. It LOOKED and did not find, which is the
  // actionable line rather than a shrug.
  assert.equal(w.state, "missing", "a picture on another page settled the hand-off: " + JSON.stringify(w));
  assert.equal(w.reconciledBy, undefined, "a reconciliation happened over a placement that has no picture: " + JSON.stringify(w));
  // …AND THIS IS ALSO THE OWNER'S "ACQUIRED BUT NOT PLACED" SHAPE, which is
  // worth saying because the two collapse here by construction: `applyImages`
  // writes a bought url back into the file whose token it filled, so a picture
  // that was paid for and is on no page cannot arise — what CAN, and does
  // here, is a picture placed somewhere other than the page a requirement
  // named. The reply's own `pictureNote` carries the reason; the requirement
  // carries the placement.
  const wa = wcov.find((x) => x.status === "covered");
  assert.equal(wa.state, "missing", "the wrong placement is not reported as outstanding: " + JSON.stringify(wa));
});

test("a provider refusal leaves the photograph still to do, and says so in its own words", async () => {
  // ⚠ THE OWNER'S THIRD PHOTO DISTINCTION, and the one that most needs its own
  // sentence: the money was NOT spent, the page shipped, and the picture is a
  // placeholder. Run 51 is the live instance — 13 credits for a page and a QR
  // code, with the refused photograph correctly costing nothing.
  const HANDOFF = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const r = await photoAsk("fw-photo-refused", {
    kinds: ["page", "photo"], credits: 400, shotFail: true,
    written: [galleryToken(BENCH)],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [HANDOFF] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: the provider really was asked and really refused.
  assert.equal(r.shots.length, 1, "the provider was never asked — this case tests nothing: " + JSON.stringify(r.shots));
  assert.ok(!r.body.pictures, "a picture was bought from a refusing provider: " + JSON.stringify(r.body));
  const q = storedAnswer(r, "fw-photo-refused").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(q.implementation, "absent", "a picture nobody has was not seen as absent: " + JSON.stringify(q));
  assert.equal(q.state, "missing", "a refused photograph reads as set up: " + JSON.stringify(q));
  assert.equal(q.handoff, "delivered", "the step really was told");
  // TWO SENTENCES, EACH SAYING ITS OWN HALF. The requirement says the work is
  // outstanding; `pictureNote` says WHY, which is the one thing that can tell
  // four identical-looking placeholder outcomes apart.
  assert.match(r.body.coverNote || "", /Still to do: The gallery page shows a photograph/, r.body.coverNote);
  assert.match(r.body.pictureNote || "", /Couldn't make the photographs this time/, String(r.body.pictureNote));
});

test("an existing photograph shown again answers the same way, and is not claimed as bought", async () => {
  // THE OWNER'S FIRST DISTINCTION. Reuse is a real capability — measured on
  // 2026-09-19: a `/u/` url copied onto a new page passes `keptImages`,
  // survives `applyImages` byte-identical and costs nothing — and it must
  // answer a requirement exactly as a purchase does, while the RECORD keeps
  // the two apart.
  const HANDOFF = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const OWNED = "/u/fw-photo-reuse/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg";
  const r = await photoAsk("fw-photo-reuse", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    // THE SITE REALLY OWNS IT: the home page draws it today, so the wall that
    // empties an invented url (`strayPhotos`) has something to recognise.
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"" + OWNED + "\" alt=\"the bench\" /></main>" }],
    written: [galleryWith('<SafeImage src="' + OWNED + '" alt="the bench" />')],
    answers: { page: { page: [PHOTO_PAGE], requirements: [HANDOFF] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.shots, [], "a photograph was bought on a reuse — this case tests something else");
  // THE PRECONDITION, READ OFF THE PUBLICATION: the url really is on the page
  // this change wrote, which is what makes it a placement at all.
  const page = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.ok(page && page.source.includes(OWNED), "the reused photograph is not on the published page");
  const q = storedAnswer(r, "fw-photo-reuse").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(q.implementation, "found", "a photograph really on the page was not found: " + JSON.stringify(q));
  assert.equal(q.foundIn, "applied", "a picture this change placed was credited to the site's back catalogue: " + JSON.stringify(q));
  assert.equal(q.state, "unverified");
  // ── AND IT IS RECORDED AS A REUSE, NOT AS A PURCHASE ─────────────────────
  //
  // A sweep survivor: the route decides `bought` against `reused` by whether
  // the url was in the source this change started from, and no case anywhere
  // read which it wrote. They are not interchangeable — one is money this
  // change spent and the other is money the owner had already spent — and a
  // `by` clause naming the wrong one is a claim about a charge that did not
  // happen. The claim below resolves ONLY against `reused`, so a route that
  // marks every picture bought fails it.
  // ⚠ ITS OWN SLUG'S URL. `imageRefs` is scoped to the site's own `/u/<slug>/`
  // prefix, so reusing the first sub-case's url here would be ANOTHER site's
  // upload and the wall would empty it — the case would then be about
  // `strayPhotos` rather than about how a reuse is recorded.
  const MINE = "/u/fw-photo-reuse-mark/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg";
  const REUSED = { need: "The gallery shows one of the photographs we already paid for.",
    status: "covered", from: "page", kind: "photo", item: "/gallery", by: "the bench photograph reused on /gallery" };
  const marked = await photoAsk("fw-photo-reuse-mark", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"" + MINE + "\" alt=\"the bench\" /></main>" }],
    written: [galleryWith('<SafeImage src="' + MINE + '" alt="the bench" />')],
    answers: { page: { page: [PHOTO_PAGE], requirements: [REUSED] } },
  });
  assert.equal(marked.body.ok, true, JSON.stringify(marked.body));
  const m = storedAnswer(marked, "fw-photo-reuse-mark").coverage.requirements[0];
  assert.equal(m.configuredBy, "/gallery: reused",
    "a photograph the owner already had was recorded as bought: " + JSON.stringify(m));
});

test("a picture on a page this change never wrote is not claimed as its work", async () => {
  // A SWEEP SURVIVOR AND A REAL PROPERTY. `aPhotoMade` is filtered by what the
  // merge really added or changed, so a page the change never touched shows
  // whatever it always showed — and naming it as an applied placement would
  // let a picture the site has had for months answer a request made today.
  // That is `existingFacts`' job (`foundIn: "existing"`), and the distinction
  // between the two readers is the whole of what `foundIn` records.
  const OWNED = "/u/fw-photo-untouched/c0ffee00c0ffee00c0ffee00c0ffee00.jpg";
  const HANDOFF = { need: "The home page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/" };
  const r = await photoAsk("fw-photo-untouched", {
    kinds: ["page"], publishes: true, sitePages: ["/"],
    // THE HOME PAGE ALREADY DRAWS ONE and this change does not rewrite it —
    // only `/gallery` is returned, so `/` is in neither `added` nor `changed`.
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"" + OWNED + "\" alt=\"the bench\" /></main>" }],
    written: [writtenPage("/gallery")],
    answers: { page: { page: [PHOTO_PAGE], requirements: [HANDOFF] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.changed || [], [], "the home page was rewritten — this case tests nothing: " + JSON.stringify(r.body));
  const q = storedAnswer(r, "fw-photo-untouched").coverage.requirements.find((x) => x.status === "elsewhere");
  // IT RESOLVES — to the SITE'S own picture, which is the honest answer and is
  // what makes the reader-identity assertion below load-bearing rather than a
  // second copy of "it was not found".
  assert.equal(q.implementation, "found", "the site's own photograph was not found at all: " + JSON.stringify(q));
  assert.equal(q.foundIn, "existing",
    "a picture on a page this change never wrote was claimed as its work: " + JSON.stringify(q));
});

test("a photograph for a page that never shipped is not claimed, and the page is named", async () => {
  // THE OWNER'S FIFTH DISTINCTION: an unavailable destination. The writer
  // returns nothing for `/gallery`, so the page is missing — and a picture on a
  // page no visitor will see is not a placement.
  //
  // READ OFF THE PUBLICATION, WHICH IS WHY THIS CASE EXISTS. `aPhotoMade` is
  // filtered by what the merge really added or changed, so a page that did not
  // survive contributes nothing however well the photo step answered.
  const HANDOFF = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const OTHER = { path: "/prices", name: "Prices", purpose: "what it costs", sections: ["a list"], components: [] };
  const r = await photoAsk("fw-photo-nopage", {
    kinds: ["page", "photo"], credits: 400,
    // ONE OF THE TWO PAGES IS WRITTEN. A writer that returns NOTHING is a
    // different failure entirely (`nothing-returned`, which escalates and
    // publishes no change at all), so the shape this case is about needs a
    // change that really shipped with one page short.
    written: [writtenPage("/prices")],
    answers: {
      page: { page: [PHOTO_PAGE, OTHER], requirements: [HANDOFF] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.missingPages, ["/gallery"], "the page survived — this case tests nothing: " + JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-photo-nopage").coverage.requirements;
  const q = cov.find((x) => x.status === "elsewhere");
  assert.equal(q.implementation, "absent", "a picture on a page that never shipped was found: " + JSON.stringify(q));
  assert.equal(q.state, "missing");
  assert.match(r.body.coverNote || "", /Still to do: The gallery page shows a photograph/, r.body.coverNote);
});

test("a scene declared and a scene really on the page are two answers, and a claim reads the difference", async () => {
  // ⚠ THE OWNER'S FIRST TWO 3D DISTINCTIONS, and they come apart structurally:
  // `three` is a STORED LOOK FIELD decided by the design step and the canvas
  // is written by the PAGE step — a different model call reading
  // `sceneDirective`. `three` shipped in exactly that state once already,
  // stored with no way to reach the page rules at all.
  const SCENE = "import { Canvas } from '@react-three/fiber'\n<Canvas><mesh /></Canvas>";
  const HANDOFF = { need: "There is something in 3D on the gallery page.", status: "elsewhere", step: "three", item: "three" };
  const ECHO = { need: HANDOFF.need, status: "covered", by: "the three scene is onpage",
    answers: "page#0", kind: "three", item: "three" };
  const page = { path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] };
  const on = await addon("fw-three-onpage", "add a gallery page with a 3D scene on it", {
    kinds: ["page", "three"], publishes: true, sitePages: ["/"],
    written: [{ ...writtenPage("/gallery"), source: writtenPage("/gallery").source + "\n" + SCENE }],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      three: { three: { scene: "a slowly turning loaf", page: "/gallery" }, requirements: [ECHO] },
    },
  });
  assert.equal(on.body.ok, true, JSON.stringify(on.body));
  assert.ok((on.body.moved || []).includes("three"), "no scene was stored — this case tests nothing");
  // THE WIRING HOP, as above: the tool the route really handed the three
  // designer, and the brief that gave it the id to echo.
  const threeCall = on.prompts.find((p) => p.kind === "three");
  assert.ok(threeCall.props.includes("requirements"),
    "the three step has nowhere to say which request its scene answers: " + JSON.stringify(threeCall.props));
  assert.match(threeCall.text, /page#0/, "the three step was never told the id it is asked to echo");
  const onQ = storedAnswer(on, "fw-three-onpage").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(onQ.state, "configured", "the hand-off was not associated: " + JSON.stringify(onQ));
  assert.equal(onQ.reconciledKind, "three", "the record does not say what kind of thing answered: " + JSON.stringify(onQ));
  // …AND THE ANSWER'S OWN CLAIM IS CONFIGURATION THAT HOLDS, because a page
  // really carries the canvas.
  const onA = storedAnswer(on, "fw-three-onpage").coverage.requirements.find((x) => x.status === "covered");
  assert.equal(onA.state, "configured", "a scene really on the page did not resolve: " + JSON.stringify(onA));
  assert.equal(onA.configuredBy, "three: onpage",
    "the setting that was read back is not recorded, or is not the on-the-page one: " + JSON.stringify(onA));

  // ── THE CONTROL: the SAME request with a page that never draws the canvas.
  // The scene is stored, so the site is configured for one; no page shows it.
  // `fails` is asked first, so the claim saying it is onpage is CONTRADICTED
  // rather than quietly reading as configuration that holds.
  const off = await addon("fw-three-offpage", "add a gallery page with a 3D scene on it", {
    kinds: ["page", "three"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      three: { three: { scene: "a slowly turning loaf", page: "/gallery" }, requirements: [ECHO] },
    },
  });
  assert.equal(off.body.ok, true, JSON.stringify(off.body));
  assert.ok((off.body.moved || []).includes("three"), "no scene was stored — this control tests nothing");
  const offA = storedAnswer(off, "fw-three-offpage").coverage.requirements.find((x) => x.status === "covered");
  assert.equal(offA.contradictedBy, "three: onpage",
    "a scene on no page read as configuration that holds: " + JSON.stringify(offA));
  assert.equal(offA.configuredBy, undefined, "a contradicted claim bought a configuration verdict: " + JSON.stringify(offA));
  // THE CUSTOMER IS NOT TOLD IT IS DONE EITHER WAY — a contradiction denies the
  // guarantee and not the thing, so the state is the same and only the record
  // separates them. That is deliberate: nothing here is entitled to call a
  // claim wrong, which is this repository's never-move-towards-`failed` rule.
  assert.equal(offA.state, "unverified", "a contradicted claim moved towards failed: " + JSON.stringify(offA));

  // ── AND IT IS READ OFF THE PUBLICATION, NOT OFF THE WRITER'S ANSWER ──────
  //
  // A sweep survivor, and it is the same correction `newEmptySlots` and
  // `aPhotoMade` both took. The writer RETURNS a page carrying the canvas and
  // the publication does NOT — here because the preservation rule reverts a
  // changed page nobody asked for that carries no link to an added route — so
  // a reader that trusted the answer would say the scene is on a page whose
  // canvas no visitor will ever be served.
  //
  // ⚠ AND THE FIRST SHAPE OF THIS CASE WAS VACUOUS, which is worth recording
  // because it passed with the mutant applied. It handed the writer a raw
  // `{path, source}` of bare markup — no `createFileRoute` export — so
  // `validatePages` REFUSED it and the canvas never reached the merge at all.
  // The precondition it asserted (`nothing compiled carries a Canvas`) is
  // satisfied just as well by a page dropped at validation as by one reverted,
  // so it could not tell the two apart. **A negative precondition must name
  // the mechanism it is relying on**: the assertion that makes this case real
  // is `reverted`, not the absence of the canvas.
  const about = storedPage("/about");
  const held = await addon("fw-three-held", "add a gallery page with a 3D scene on it", {
    kinds: ["page", "three"], publishes: true, sitePages: ["/", "/about"],
    // THE CANVAS IS ONLY ON `/about` — a real page, through the real
    // validator — which the design never asked for and which carries no link
    // to `/gallery`, so the preservation rule puts back what the site was
    // already serving. The home page carries the link and is KEPT, which is
    // what stops this being a case about the merge refusing everything.
    written: [
      writtenPage("/gallery"),
      addedTo("/", '<Link to="/gallery">Gallery</Link>'),
      { ...about, path: "src/routes/about.tsx", source: about.source + "\n" + SCENE },
    ],
    answers: {
      page: { page: [page], requirements: [HANDOFF] },
      three: { three: { scene: "a slowly turning loaf", page: "/gallery" }, requirements: [ECHO] },
    },
  });
  assert.equal(held.body.ok, true, JSON.stringify(held.body));
  assert.ok((held.body.moved || []).includes("three"), "no scene was stored — this case tests nothing");
  // ⚠ THE PRECONDITION THAT MAKES THIS CASE REAL: the canvas page reached the
  // merge and the merge REVERTED it. Without this, "nothing compiled carries a
  // canvas" is true of a page that was never admitted, and the case is about
  // the validator rather than about which list the route reads.
  assert.deepEqual(held.body.reverted, ["about.tsx"],
    "the canvas page was not reverted, so the two lists do not differ here: " + JSON.stringify(held.body.reverted));
  assert.ok((held.body.changed || []).includes("index.tsx"),
    "the linking home page was reverted too — the merge refused everything: " + JSON.stringify(held.body.changed));
  const shipped = compiledPages(held);
  assert.ok(!shipped.some((p) => /Canvas/.test(p.source)),
    "the canvas was published after all — this case tests nothing: "
    + JSON.stringify(shipped.map((p) => p.path)));
  const heldA = storedAnswer(held, "fw-three-held").coverage.requirements.find((x) => x.status === "covered");
  assert.equal(heldA.contradictedBy, "three: onpage",
    "a canvas on a page nobody will be served read as the scene being on the site: " + JSON.stringify(heldA));
  assert.equal(heldA.configuredBy, undefined,
    "the writer's own answer bought a configuration verdict: " + JSON.stringify(heldA));
});

test("a photograph cannot be reported absent before the publish has said anything", async () => {
  // A SWEEP SURVIVOR, AND THE PROPERTY IS THE RECORDED CANNOT-TELL RULE.
  // `aReportable` gates `photo` on `aPhotoMade` having been computed, which
  // happens at the publish — so on a path that never gets there, "no picture
  // was placed" and "the answer does not exist yet" must not be one answer.
  // A refusal composes its coverage from the kinds loop, long before any of
  // that, and a reader that said `absent` there would print "Still to do"
  // over work that was never attempted.
  const HANDOFF = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const r = await photoAsk("fw-photo-early", {
    kinds: ["page", "photo"], credits: 400,
    // THE REFUSAL: the writer returns a page that lost the words the site
    // already said, so `keptProse` refuses the whole change at cost 0 — before
    // the merge, before the purchase and before anything is published.
    storedPages: [{ path: "index.tsx", source: "<main><h1>Fretwork</h1><p>Hand-built guitars since 1974.</p></main>" }],
    written: [{ path: "src/routes/index.tsx", source: "<main><h1>Fretwork</h1></main>" }],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [HANDOFF] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    },
  });
  assert.equal(r.body.ok, false, "the change was published — this case tests nothing: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0, "a refused change was charged: " + JSON.stringify(r.body));
  const q = storedAnswer(r, "fw-photo-early").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(q.implementation, "unknown",
    "a picture was reported absent before the publish could say anything: " + JSON.stringify(q));
  assert.equal(q.state, "unknown");
  assert.doesNotMatch(r.body.coverNote || "", /Still to do/,
    "work that was never attempted was reported as outstanding: " + r.body.coverNote);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE REQUEST AND THE PICTURE THAT ANSWERS IT (2026-09-19)

   Owner: *"Reproduced: generation fails, an old photograph is reused on
   /gallery, and the requirement for a newly generated photograph becomes
   configured. pictureNote says failure while coverNote says 'I've set that
   up.' Preserve explicit request-to-result association through generation and
   placement. Another photograph on the same route must not satisfy the failed
   request."*

   WHY THE EXISTING CASES ABOVE COULD NOT SEE IT: every one of them puts at
   most ONE picture in play per route, so "a picture is on that page" and "the
   picture this asked for is on that page" are the same reading. The two come
   apart the moment a route carries a photograph the request did not buy — a
   reuse, or a second request's — and that is the whole of the defect.

   THE CHAIN IS request → token → url → file → route. `imageDirective` writes
   the describe INTO the token, `buySitePhotos` reports which token got which
   url, and the publication says which file holds it. `shotKey` is the one
   normalisation both ends ask.
   ═════════════════════════════════════════════════════════════════════════ */

test("a reused photograph does not answer a request for a new one that was never made", async () => {
  // THE OWNER'S REPRODUCTION, and the shape is exact: the provider refuses,
  // the page writer falls back to a photograph the site already owns, and the
  // requirement names the ROUTE — which is the only identity a photograph has.
  const OWNED = "/u/fw-photo-lost/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg";
  const CLAIM = { need: "A new photograph of the bakery is on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item: "/gallery",
    by: "a new photograph of the bakery on the gallery page" };
  const r = await photoAsk("fw-photo-lost", {
    kinds: ["page", "photo"], credits: 400, shotFail: true, sitePages: ["/"],
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"" + OWNED + "\" alt=\"the bench\" /></main>" }],
    // THE WRITER OBEYED: it wrote the token for the picture that was asked for
    // AND showed one the site already owns beside it. So the provider really is
    // paid to try, the refusal sweeps that token back to `src=""`, and what the
    // page ends up carrying is the OLD photograph — which is the owner's shape
    // exactly, and the one where a per-route reading cannot tell the two apart.
    written: [galleryWith('<SafeImage src="' + OWNED + '" alt="the bench" />'
      + '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the new one" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [CLAIM] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE TWO PRECONDITIONS, because without either this case is about something
  // else: the provider really was asked and really refused, and the page really
  // does carry another photograph.
  assert.equal(r.shots.length, 1, "the provider was never asked — this case tests nothing: " + JSON.stringify(r.shots));
  assert.ok(!r.body.pictures, "a picture was bought from a refusing provider: " + JSON.stringify(r.body));
  const page = compiledPages(r).find((p) => p.path.includes("gallery"));
  assert.ok(page && page.source.includes(OWNED),
    "the reused photograph is not on the published page — the wall has nothing to beat");

  const q = storedAnswer(r, "fw-photo-lost").coverage.requirements[0];
  // ⚠ THIS IS THE ASSERTION THAT MAKES IT A WALL RATHER THAN AN ABSENCE. The
  // implementation reader FOUND a picture on /gallery and the requirement is
  // still refused — which is the owner's *"another photograph on the same
  // route must not satisfy the failed request"*, in the one shape where the
  // two readings disagree.
  assert.equal(q.implementation, "found",
    "the route carries no picture, so this case would pass without the fix: " + JSON.stringify(q));
  assert.equal(q.state, "blocked", "a refused photograph reads as set up: " + JSON.stringify(q));
  assert.equal(q.why, "the photograph it asked for on /gallery isn't there",
    "the clause names no reason a customer can check: " + JSON.stringify(q));
  // …AND THE TWO SENTENCES AGREE, which is the incoherence that was reported:
  // one reply said the photographs could not be made and, four words later,
  // that it had been set up.
  assert.doesNotMatch(r.body.coverNote || "", /I've set that up/, r.body.coverNote);
  assert.match(r.body.coverNote || "", /A new photograph of the bakery is on the gallery page/, r.body.coverNote);
  assert.match(r.body.pictureNote || "", /Couldn't make the photographs this time/, String(r.body.pictureNote));

  // ── AND A CLAIM THAT NAMES NOTHING IS COVERED BY THE KIND, not the item.
  // The two walls answer different requirements and only one of them can see
  // an un-named claim: with no `item` there is no reference, so `depBroke`
  // cannot fire and the step's own failure is the only evidence there is.
  const vague = await photoAsk("fw-photo-lost-vague", {
    kinds: ["page", "photo"], credits: 400, shotFail: true, sitePages: ["/"],
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"/u/fw-photo-lost-vague/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg\" alt=\"the bench\" /></main>" }],
    written: [galleryWith('<SafeImage src="/u/fw-photo-lost-vague/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg" alt="the bench" />'
      + '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the new one" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }],
        requirements: [{ need: "The bakery's own photographs are on the site.", status: "covered",
          from: "photo", by: "a new photograph of the bakery on the gallery page" }] },
    },
  });
  assert.equal(vague.body.ok, true, JSON.stringify(vague.body));
  const v = storedAnswer(vague, "fw-photo-lost-vague").coverage.requirements[0];
  assert.equal(v.item, undefined, "the claim names an item — this sub-case tests the other wall: " + JSON.stringify(v));
  assert.equal(v.state, "failed",
    "a claim naming nothing was rescued by a picture it never asked for: " + JSON.stringify(v));
  assert.match(vague.body.coverNote || "", /Still to do: The bakery's own photographs/, vague.body.coverNote);

  // ── THE CONTROL: the same claim, the same page, the same reuse — and the
  // request really answered. Without it "blocked" could be what this route
  // says about every photograph, and the case would prove nothing.
  const ok = await photoAsk("fw-photo-lost-ok", {
    kinds: ["page", "photo"], credits: 400, sitePages: ["/"],
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"/u/fw-photo-lost-ok/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg\" alt=\"the bench\" /></main>" }],
    written: [galleryWith('<SafeImage src="/u/fw-photo-lost-ok/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg" alt="the bench" />'
      + '<SafeImage src="@@IMG:' + BENCH + '@@" alt="the new one" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [CLAIM] },
    },
  });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  assert.equal(ok.body.pictures, 1, "no picture was bought — the control tests nothing: " + JSON.stringify(ok.body));
  const g = storedAnswer(ok, "fw-photo-lost-ok").coverage.requirements[0];
  assert.equal(g.state, "unverified", "a picture that really landed was refused: " + JSON.stringify(g));
  assert.match(ok.body.coverNote || "", /I've set that up/, ok.body.coverNote);
});

test("two photographs asked for on one page: both landing answers, one landing does not", async () => {
  // THE OWNER'S "multiple requested photographs sharing a page" AND "partial
  // success", which are one case and its control — and the pair is why the
  // association has to be per REQUEST. Per ROUTE the two are identical: one
  // page, one claim, a photograph on it either way.
  const OVEN = "the oven at dawn, flour on the bench";
  const CLAIM = { need: "Photographs of the bakery are on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item: "/gallery",
    by: "photographs of the bakery on the gallery page" };
  const both = (slug, opts) => photoAsk(slug, {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryWith('<SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" />'
      + '<SafeImage src="@@IMG:' + OVEN + '@@" alt="the oven" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }, { page: "/gallery", describe: OVEN, name: "oven" }],
        requirements: [CLAIM] },
    },
    ...opts,
  });

  // BOTH LAND — the control, and it runs first so a partial that reads
  // `blocked` cannot be the route saying that about every two-picture page.
  const all = await both("fw-photo-two");
  assert.equal(all.body.ok, true, JSON.stringify(all.body));
  assert.equal(all.shots.length, 2, "two pictures were not asked for: " + JSON.stringify(all.shots));
  assert.equal(all.body.pictures, 2, "two pictures did not reach the page: " + JSON.stringify(all.body));
  const a = storedAnswer(all, "fw-photo-two").coverage.requirements[0];
  assert.equal(a.state, "unverified", "two pictures that both landed were refused: " + JSON.stringify(a));

  // PARTIAL — the SECOND provider call refuses. `shotFail` takes a list of
  // prompt fragments precisely so this shape can exist: as a boolean it could
  // only refuse everything, and a run where one picture arrives and another
  // does not is the one that separates a per-request reading from a per-route
  // one.
  const part = await both("fw-photo-two-part", { shotFail: [OVEN] });
  assert.equal(part.body.ok, true, JSON.stringify(part.body));
  assert.equal(part.shots.length, 2, "the second picture was never asked for: " + JSON.stringify(part.shots));
  assert.equal(part.body.pictures, 1,
    "this is not a partial success — the case tests nothing: " + JSON.stringify(part.body));
  const p = compiledPages(part).find((x) => x.path.includes("gallery"));
  assert.ok(p && /\/u\/fw-photo-two-part\//.test(p.source),
    "the picture that DID land is not on the page, so the route carries none: " + (p && p.source));
  const b = storedAnswer(part, "fw-photo-two-part").coverage.requirements[0];
  assert.equal(b.implementation, "found",
    "the route carries no picture, so this case would pass without the fix: " + JSON.stringify(b));
  assert.equal(b.state, "blocked",
    "one picture answered for two, which is a count standing in for an association: " + JSON.stringify(b));
  // …AND THE REPLY STILL SAYS WHAT IT REALLY BOUGHT. The two clauses are about
  // different things and both are true: one photograph was made, and the
  // requirement that asked for the pair is not satisfied.
  assert.match(part.body.pictureNote || "", /Made 1 photograph/, String(part.body.pictureNote));
  assert.doesNotMatch(part.body.coverNote || "", /I've set that up/, part.body.coverNote);
});

test("TWO REQUIREMENTS ON ONE PAGE: the picture that landed keeps its answer, the one that did not is named", async () => {
  // ⚠ THE REVIEWER'S REPRODUCTION, and it is the case above it with the claims
  // SPLIT. There the pair shared one requirement and "incomplete" was right;
  // here the bench photograph and the oven photograph are two separate needs,
  // the bench is generated and reaches the compiled and stored page, and the
  // oven is refused — and BOTH read as blocked, with the customer told the
  // bench picture was not there.
  //
  // THE CAUSE WAS THAT A ROUTE IS THE IDENTITY OF *WHERE*. `aPhotoLost` held
  // routes, so `/gallery`'s failure was the only fact either claim could
  // resolve against and the successful one inherited it. The designer names
  // each picture now and the reconciliation carries that name from the request
  // through the purchase to the verdict.
  const OVEN = "the oven at dawn, flour on the bench";
  const NEED = (what, item) => ({ need: "A photograph of the " + what + " is on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item,
    by: "a photograph of the " + what + " on the gallery page" });
  // THE THIRD CLAIM IS THE COMBINED ONE and it rides in the same reply, because
  // the owner's two requirements are that the individual need survives AND the
  // combined need does not: asserting them in separate runs would leave the two
  // rules free to be the same rule.
  const BOTH = { need: "Photographs of the bakery are on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item: "/gallery",
    by: "photographs of the bakery on the gallery page" };
  const split = (slug, opts) => photoAsk(slug, {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryWith('<SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" />'
      + '<SafeImage src="@@IMG:' + OVEN + '@@" alt="the oven" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: {
        photo: [{ page: "/gallery", describe: BENCH, name: "bench" }, { page: "/gallery", describe: OVEN, name: "oven" }],
        requirements: [NEED("bench", "bench"), NEED("oven", "oven"), BOTH],
      },
    },
    ...opts,
  });

  const r = await split("fw-photo-split", { shotFail: [OVEN] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITIONS. Both pictures were really asked for, exactly one was
  // really bought, and the one that was is really on the published page — so
  // the route carries a photograph and the per-route reading cannot tell the
  // two claims apart. Without all three this case is about something else.
  assert.equal(r.shots.length, 2, "both pictures were not asked for: " + JSON.stringify(r.shots));
  assert.equal(r.body.pictures, 1, "this is not a partial success: " + JSON.stringify(r.body));
  const page = compiledPages(r).find((x) => x.path.includes("gallery"));
  assert.ok(page && /\/u\/fw-photo-split\//.test(page.source),
    "the picture that landed is not on the compiled page: " + (page && page.source));
  assert.match(storedSource(r, "fw-photo-split", "gallery.tsx"), /\/u\/fw-photo-split\//,
    "the picture that landed is not in the stored source either");

  const byNeed = Object.fromEntries(storedAnswer(r, "fw-photo-split").coverage.requirements.map((q) => [q.item, q]));
  // THE ONE THAT LANDED. `found` AND `unverified`: the reconciliation resolved
  // its own picture, and a url in a `src` is configuration — nothing here has
  // loaded the image, so it can never be better than "I can't confirm".
  assert.equal(byNeed.bench.implementation, "found",
    "the bench picture landed and was not found: " + JSON.stringify(byNeed.bench));
  // ⚠ RESOLVED AGAINST ITS OWN PICTURE, which is the whole correction and is
  // the pair of fields to read: `implementedBy` is the shot's own name and
  // `foundIn` says this change made it, rather than the route answering for
  // both. THE STATE IS `configured` AND NOT `unverified` because the claim
  // names `bench` and that applied picture really is on a route whose words the
  // claim also uses — a setting read back off what was published. Both reach
  // the customer as the same "I can't confirm" clause; what matters here is
  // that neither is a failure.
  assert.equal(byNeed.bench.implementedBy, "bench",
    "the bench claim resolved against something other than its own picture: " + JSON.stringify(byNeed.bench));
  assert.equal(byNeed.bench.foundIn, "applied", JSON.stringify(byNeed.bench));
  assert.equal(byNeed.bench.state, "configured",
    "the picture that was really made reads as failed — this is the reported defect: " + JSON.stringify(byNeed.bench));
  // THE ONE THAT DID NOT. `absent` is the reading that matters — this layer
  // LOOKED for the oven's own picture and did not find it — and the state is
  // `failed` rather than `blocked` because the photo step really did fail and
  // this claim's own picture is the thing that is missing. That is the
  // kind-wide rule being right, not the narrowing: the previous round's
  // `!depThere` excuses a step's other failures only for a claim whose OWN
  // thing is there. Either way the customer gets the actionable line.
  assert.equal(byNeed.oven.implementation, "absent",
    "the refused picture was not looked for: " + JSON.stringify(byNeed.oven));
  assert.equal(byNeed.oven.state, "failed",
    "the refused picture was not reported as outstanding: " + JSON.stringify(byNeed.oven));
  assert.notEqual(byNeed.oven.state, byNeed.bench.state,
    "both claims got one verdict, which is the reported defect: " + JSON.stringify(byNeed));
  // THE COMBINED NEED IS STILL INCOMPLETE, which is the owner's other half.
  assert.equal(byNeed["/gallery"].state, "blocked",
    "a need about both pictures was answered by the one that worked: " + JSON.stringify(byNeed["/gallery"]));

  // AND THE CUSTOMER HEARS ALL THREE, each in its own words, in one reply.
  const note = r.body.coverNote || "";
  assert.match(note, /Still to do: A photograph of the oven is on the gallery page/, note);
  assert.match(note, /I've set that up, but I can't confirm[\s\S]*A photograph of the bench/, note);
  assert.doesNotMatch(note, /I've set that up[\s\S]*A photograph of the oven/, note);
  assert.match(r.body.pictureNote || "", /Made 1 photograph/, String(r.body.pictureNote));

  // ── THE CONTROL: the same three claims, the same page, and BOTH pictures
  // bought. Without it "the bench is unverified" could be what this route says
  // about every photograph, and the split above would prove nothing.
  const ok = await split("fw-photo-split-ok");
  assert.equal(ok.body.pictures, 2, "the control bought fewer than two: " + JSON.stringify(ok.body));
  const all = Object.fromEntries(storedAnswer(ok, "fw-photo-split-ok").coverage.requirements.map((q) => [q.item, q]));
  // EACH ONE BY NAME rather than a loop over one expectation: the two
  // individual claims name their own picture and reach `configured`, and the
  // combined one does not name `/gallery` in its own prose, so nothing is read
  // back for it and `unverified` is the honest answer. A loop asserting one
  // value for all three would be asserting a coincidence.
  assert.equal(all.bench.state, "configured", JSON.stringify(all.bench));
  assert.equal(all.oven.state, "configured", JSON.stringify(all.oven));
  assert.equal(all.oven.implementedBy, "oven",
    "the oven claim resolved against the bench's picture: " + JSON.stringify(all.oven));
  assert.equal(all["/gallery"].state, "unverified", JSON.stringify(all["/gallery"]));
  assert.doesNotMatch(ok.body.coverNote || "", /Still to do/, ok.body.coverNote);

  // ── AND `checked` STAYS EMPTY, on every applied kind. A picture's url read
  // back off what was published is configuration; nothing on this path has
  // loaded an image or looked at what it shows.
  for (const m of storedAnswer(ok, "fw-photo-split-ok").coverage.made || [])
    assert.deepEqual(m.checked || [], [], "a behaviour was claimed as exercised: " + JSON.stringify(m));
});

test("a photograph bought for one page and written onto another is not on the page that asked", async () => {
  // THE PLACEMENT HALF, which is the second word in *"through generation and
  // placement"*: a picture can be paid for, stored and published and still not
  // be where the request put it. Generation alone cannot see that — the token
  // got its url — so a reader that stopped at the purchase would call this
  // answered.
  //
  // AND IT READS `missing` RATHER THAN `blocked`, which is the wall being
  // narrow on purpose: `/gallery` carries no photograph at all, so the
  // implementation reader LOOKED and did not find one, and *"Still to do"* is
  // the actionable line. The dependency clause is kept for the one shape where
  // something else on the page would otherwise answer.
  //
  // ⚠ SO THIS CASE IS A CONTROL AND PASSES ON BOTH TREES, said out loud rather
  // than left to be discovered: the pre-change product answers `missing` here
  // too, by the implementation reader alone. What it guards is that the new
  // wall did not WIDEN — a `failedItems` entry written for every lost request,
  // rather than only for the ones something else would answer, trades this
  // sentence for the vaguer one on the commonest failure there is.
  const CLAIM = { need: "A photograph of the bench is on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item: "/gallery",
    by: "a photograph of the bench on the gallery page" };
  const PRESS = { path: "/press", name: "Press", purpose: "what people say",
    sections: ["a list of quotes"], components: [] };
  const r = await photoAsk("fw-photo-misplaced", {
    kinds: ["page", "photo"], credits: 400,
    written: [
      galleryWith("<p>Our work, soon.</p>"),
      { path: "src/routes/press.tsx",
        source: "import { createFileRoute } from '@tanstack/react-router'\n"
          + "import { SafeImage } from '@/components/ui/safe-image'\n"
          + "export const Route = createFileRoute('/press')({ component: P })\n"
          + 'function P(){ return <main><h1>Press</h1><SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" /></main> }\n' },
    ],
    answers: {
      page: { page: [PHOTO_PAGE, PRESS] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [CLAIM] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION IS THE WHOLE POINT: the picture was really bought and
  // really published — on the wrong page. Without it this is a refusal case.
  assert.equal(r.body.pictures, 1, "no picture was bought — this case tests nothing: " + JSON.stringify(r.body));
  const pages = compiledPages(r);
  const press = pages.find((p) => p.path.includes("press"));
  const gal = pages.find((p) => p.path.includes("gallery"));
  assert.ok(press && /\/u\/fw-photo-misplaced\//.test(press.source), "the picture is on no page at all: " + (press && press.source));
  assert.ok(gal && !/\/u\/fw-photo-misplaced\//.test(gal.source), "the picture IS on the page that asked: " + (gal && gal.source));

  const q = storedAnswer(r, "fw-photo-misplaced").coverage.requirements[0];
  assert.equal(q.implementation, "absent",
    "a picture on another page was found for this one: " + JSON.stringify(q));
  assert.equal(q.state, "missing", "a misplaced photograph answered the request: " + JSON.stringify(q));
  assert.match(r.body.coverNote || "", /Still to do: A photograph of the bench is on the gallery page/, r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote || "", /I've set that up/, r.body.coverNote);

  // ── AND THE SHAPE WHERE THE PLACEMENT HALF IS THE ONLY THING STOPPING IT.
  //
  // ⚠ A SWEEP SURVIVOR, AND IT IS THE CASE ABOVE ONE CONDITION SHORT. With
  // `/gallery` carrying nothing, the implementation reader settles it whatever
  // the association says — so a route that asked only *"was a picture minted
  // for this request"* and never *"is it on the page that asked"* passes the
  // whole case above. The two part company exactly when the requested page has
  // ANOTHER photograph on it: then the reader finds one, and only the
  // placement test can say it is not the one that was asked for.
  const OWNED = "/u/fw-photo-misplaced-2/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.jpg";
  const both = await photoAsk("fw-photo-misplaced-2", {
    kinds: ["page", "photo"], credits: 400, sitePages: ["/"],
    storedPages: [{ path: "index.tsx", source: "<main><SafeImage src=\"" + OWNED + "\" alt=\"the bench\" /></main>" }],
    written: [
      galleryWith('<SafeImage src="' + OWNED + '" alt="the bench" />'),
      { path: "src/routes/press.tsx",
        source: "import { createFileRoute } from '@tanstack/react-router'\n"
          + "import { SafeImage } from '@/components/ui/safe-image'\n"
          + "export const Route = createFileRoute('/press')({ component: P })\n"
          + 'function P(){ return <main><h1>Press</h1><SafeImage src="@@IMG:' + BENCH + '@@" alt="the bench" /></main> }\n' },
    ],
    answers: {
      page: { page: [PHOTO_PAGE, PRESS] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [CLAIM] },
    },
  });
  assert.equal(both.body.ok, true, JSON.stringify(both.body));
  assert.equal(both.body.pictures, 1, "no picture was bought — this sub-case tests nothing: " + JSON.stringify(both.body));
  const bg = compiledPages(both).find((p) => p.path.includes("gallery"));
  assert.ok(bg && bg.source.includes(OWNED), "the reused photograph is not on /gallery: " + (bg && bg.source));
  const b = storedAnswer(both, "fw-photo-misplaced-2").coverage.requirements[0];
  assert.equal(b.implementation, "found",
    "/gallery carries no picture, so this sub-case is the one above again: " + JSON.stringify(b));
  assert.equal(b.state, "blocked",
    "a picture bought for this page and written onto another answered it: " + JSON.stringify(b));
  assert.doesNotMatch(both.body.coverNote || "", /I've set that up/, both.body.coverNote);
});

test("the request and its token are joined on the words, however the describe was spaced", async () => {
  // ⚠ THE JOIN IS A STRING AND THREE HOPS NORMALISE IT. `imageDirective`
  // collapses whitespace writing the token, `parseImageTokens` collapses and
  // trims reading it back, and `planImages` slices — so a comparison that
  // repeats any one of them by hand drifts, and the drift shows up as a
  // photograph that really landed being reported as still to do.
  //
  // `shotKey` IS THE ONE DEFINITION AND BOTH ENDS ASK IT. This case drives the
  // only shape where a hand-written join differs from it: a describe carrying
  // a newline and a double space, which the directive collapses and the
  // request does not.
  //
  // ⚠ ITS OBSERVER IS THE SWEEP, NOT A RED-CHECK, and that is worth saying:
  // the pre-change product has no association at all, so it answers
  // `unverified` here for its own reason and the case passes on both trees.
  // What it can see is a `shotKey` that stops normalising — which is the way
  // this join really breaks, one careless edit at a time.
  const SPACED = "the workshop bench\nunder  the window,\twarm afternoon light";
  const CLAIM = { need: "A photograph of the bench is on the gallery page.",
    status: "covered", from: "photo", kind: "photo", item: "/gallery",
    by: "a photograph of the bench on the gallery page" };
  const r = await photoAsk("fw-photo-spaced", {
    kinds: ["page", "photo"], credits: 400,
    // THE WRITER COPIES THE TOKEN AS THE DIRECTIVE WROTE IT — collapsed —
    // which is what a model reading that line really does.
    written: [galleryWith('<SafeImage src="@@IMG:' + SPACED.replace(/\s+/g, " ").trim() + '@@" alt="the bench" />')],
    answers: {
      page: { page: [PHOTO_PAGE] },
      photo: { photo: [{ page: "/gallery", describe: SPACED, name: "bench" }], requirements: [CLAIM] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.pictures, 1, "no picture was bought — this case tests nothing: " + JSON.stringify(r.body));
  const q = storedAnswer(r, "fw-photo-spaced").coverage.requirements[0];
  assert.equal(q.state, "unverified",
    "a photograph that really landed was lost to the join's own spacing: " + JSON.stringify(q));
  assert.match(r.body.coverNote || "", /I've set that up/, r.body.coverNote);
});

test("a scene the site already has is refused, and nothing is claimed for the refusal", async () => {
  // THE OWNER'S THIRD 3D DISTINCTION: *"A refused addition, including the
  // existing one-scene-per-site restriction."* `SINGLE_FIELDS` allows one, so
  // a second is refused with a sentence rather than a climb — and a
  // requirement resting on it must read as outstanding rather than as set up.
  const r = await addon("fw-three-already", "add a 3D scene to the front page", {
    kinds: ["three"], publishes: true, sitePages: ["/"],
    look: { three: "a globe that was always there" },
    answers: { three: { three: { scene: "a second scene", page: "/" } } },
  });
  // A SENTENCE, NEVER A CLIMB, AND IT COSTS NOTHING. The refusal is decided
  // from the STORED LOOK before any model call, so the customer is told and no
  // credit moves — the whole reason a refusal here can be a refusal rather
  // than an escalate to the ~25-credit revise.
  assert.equal(r.body.ok, false, "a second scene was accepted: " + JSON.stringify(r.body));
  assert.equal(r.body.error, "already");
  assert.equal(r.body.kind, "three", "the refusal does not name the kind that caused it: " + JSON.stringify(r.body));
  assert.equal(r.body.cost, 0, "a refused scene was charged for: " + JSON.stringify(r.body));
  assert.match(String(r.body.msg || ""), /already has a 3D scene/,
    "the one-per-site refusal was never said: " + JSON.stringify(r.body));
  // NO DESIGNER RAN. The picker did — it is the one call that decides what was
  // asked for, and the refusal is decided from its answer — but nothing was
  // designed, which is what `cost: 0` rests on.
  assert.deepEqual(r.prompts.filter((p) => p.tool !== "pick_adds").map((p) => p.kind), [],
    "a designer was paid on a refusal the stored look settles: " + JSON.stringify(r.prompts.map((p) => p.kind)));
  assert.equal(storedAnswer(r, "fw-three-already"), null,
    "a refused scene left a record behind: " + JSON.stringify(storedAnswer(r, "fw-three-already")));

  // ⚠ AND THE REFUSAL TAKES THE WHOLE REQUEST WITH IT, WHICH IS RECORDED
  // RATHER THAN FIXED HERE. Asking for a page AND a second scene refuses BOTH
  // — the page was perfectly possible and is not built, and the sentence the
  // customer gets says nothing about it. MEASURED, so the next session reads a
  // fact rather than an assumption; see the backlog. It is a question about
  // refusal GRANULARITY rather than a wiring failure, and folding a design
  // change into a coverage round is what this queue's own discipline forbids.
  const both = await addon("fw-three-already-page", "add a gallery page with a 3D scene on it", {
    kinds: ["page", "three"], publishes: true, sitePages: ["/"],
    look: { three: "a globe that was always there" },
    written: [writtenPage("/gallery")],
    answers: {
      page: { page: [{ path: "/gallery", name: "Gallery", purpose: "Photographs", sections: ["A gallery"], components: [] }] },
      three: { three: { scene: "a second scene", page: "/gallery" } },
    },
  });
  assert.equal(both.body.ok, false, "the combined request now survives — re-read this observation");
  assert.equal(both.body.error, "already");
  assert.deepEqual(both.compiles, [], "the page was built after all — the observation above has moved");
});

// ────────────────────────────────────────────────────────────────────────────
// AN OUTSIDE CONNECTION A PAGE CAN ACTUALLY RENDER (task #185, 2026-09-19).
//
// The whole local path, through `POST /api/site/<slug>/addon`: the TOOL the
// route really sent, the cleaning, `_meta.schema`, the readback through the
// product's own reader, the PAGE PROMPT, and the sentence the customer reads.
// The rendering half is `test/api-shape.test.mjs` — a page written against a
// declared shape draws the values and the same page against an invented one
// draws a blank — because a type annotation is not rendering proof.

const SHAPE = { current: { temp_c: "number", condition: { text: "string" } }, forecast: [{ day: "string", high: "number" }] };
const RICH_API = {
  name: "weather", url: "https://api.test/v1/forecast?c={{param.city}}&key={{W_KEY}}", method: "GET",
  params: [{ name: "city", type: "string", required: true, description: "the town or postcode to look up" },
    { name: "days", type: "number", description: "how many days ahead" }],
  returns: SHAPE,
  credential: { service: "WeatherAPI", url: "https://weatherapi.test/signup", note: "the free tier covers 1,000 calls a month" },
  cacheSeconds: 300,
};

test("a connection carries what it answers all the way to the page writer, and the owner is told where the key comes from", async () => {
  const r = await addon("fw-api-shape", "show the forecast on the home page", {
    kinds: ["api"], publishes: true, answers: { api: { api: [RICH_API] } },
  });
  assert.equal(r.body.ok, true, r.text || JSON.stringify(r.body));

  // 1. THE TOOL THE DESIGNER REALLY RECEIVED. Read off the request rather than
  // the source, and one level IN: a case that asserted the shape reached the
  // store would otherwise pass against a tool that never offered it, because
  // the fixture hands the answer in.
  const tool = promptFor(r, "api");
  for (const p of ["returns", "credential", "params"]) {
    assert.ok(tool.itemProps.includes(p), "the api tool does not offer " + p + ": " + JSON.stringify(tool.itemProps));
  }

  // 2. STORED. `_meta.schema` is where a connection lives — `r.meta()` is that
  // stored spec — and the engine's allow-list drops anything it does not copy
  // out explicitly.
  const stored = r.meta();
  const saved = (stored.apis || []).find((a) => a.name === "weather");
  assert.deepEqual(saved.returns, SHAPE, "the sketch did not survive to the store: " + JSON.stringify(saved));
  assert.deepEqual(saved.paramInfo, [
    { name: "city", type: "string", required: true, note: "the town or postcode to look up" },
    { name: "days", type: "number", note: "how many days ahead" },
  ], JSON.stringify(saved.paramInfo));
  assert.deepEqual(saved.credential, { service: "WeatherAPI", url: "https://weatherapi.test/signup", note: "the free tier covers 1,000 calls a month" });
  assert.deepEqual(saved.params, ["city", "days"], "the stored names are still a plain list every reader iterates");

  // 3. REREAD, through the reader the SERVING route uses — not by looking at
  // the object we just wrote. `apiFor` runs the stored declaration back through
  // `normalizeApi`, which is where a field that survives storage and not the
  // readback would be lost.
  const back = apiFor(stored, "weather");
  assert.deepEqual(back.returns, SHAPE);
  assert.equal(back.paramInfo[0].required, true);
  assert.deepEqual(missingRequired(back, {}), ["city"], "the reread declaration lost the required flag");

  // 4. THE PAGE PROMPT. The writer is handed the field names and the exact
  // annotation, so neither is a guess.
  const page = pagePrompt(r);
  assert.match(page.text, /it answers \{\\"current\\":\{\\"temp_c\\":\\"number\\"/, "the shape is not in the page prompt");
  assert.match(page.text, /days: number, optional/);
  assert.match(page.text, /useApi<\{ current: \{ temp_c: number; condition: \{ text: string \} \}; forecast: \{ day: string; high: number \}\[\] \}>/,
    "the writer has to invent the annotation");

  // ⚠ TWO COMPOSERS PRINT THE SAME FACTS AND THEY ARE TWO HOPS. The addon
  // directive describes the connection THIS CHANGE adds; the page catalogue
  // lists every connection the site has. They share `apiDetailLines`, so a bare
  // match on the line's words is satisfied by either — which is how a sweep
  // mutant that emptied one of them survived. The INDENT is the discriminator:
  // the directive bullets at two spaces and the catalogue at six.
  assert.ok(page.text.includes("\\n  - city: string, REQUIRED — the town or postcode to look up"),
    "the addon directive says nothing about what the connection it adds answers");
  assert.ok(page.text.includes("\\n      city: string, REQUIRED — the town or postcode to look up"),
    "the page catalogue says nothing about what the site's connections answer");
  assert.match(page.text, /HAS THREE STATES AND THE PAGE MUST DRAW ALL THREE/, "the catalogue does not tell the page to draw loading and error");
  assert.match(page.text, /It crosses the internet, so draw all three states/, "the addon directive does not, and it is the one about the new connection");

  // AND THE TOOL REALLY OFFERS THE TYPED PARAMETER, which is the other half of
  // "the fixture hands the answer in": a bare-string `items` here would make
  // every assertion above about a shape no designer could have written.
  assert.equal(tool.itemSchema.properties.params.items.type, "object", JSON.stringify(tool.itemSchema.properties.params.items));
  assert.ok(Object.keys(tool.itemSchema.properties.params.items.properties).includes("required"),
    "the tool's parameters went back to bare names");

  // 5. THE CUSTOMER'S OWN SENTENCE, composed by the browser's real formatter.
  // The destination was always there; the provenance is what was missing.
  const said = browserText(r.body);
  assert.match(said, /add W_KEY under Cloud → Secrets/, said);
  assert.match(said, /The key for weather comes from WeatherAPI at https:\/\/weatherapi\.test\/signup \(the free tier covers 1,000 calls a month\)/, said);
});

test("a connection needing no key is told so, and one that declares nothing is byte for byte what it was", async () => {
  // ⚠ "SUPPORT CONNECTIONS NEEDING NO KEY" IS DERIVED FROM THE DECLARATION,
  // AND THE SENTENCE IS ABOUT THE OWNER'S OWN WORK. This one carries NO
  // `{{SECRET}}` anywhere, so `secretsNeeded` is empty — and the credential
  // guidance declared beside it (`RICH_API`'s WeatherAPI sign-up page) cannot
  // turn that into a go-and-sign-up instruction.
  //
  // It used to read "needs no key, so it is answering already", which is a
  // claim about a service this platform has never called: the url may not
  // resolve, the path may be wrong, the response may be nothing like the
  // sketch. A declared connection is a stored declaration, and whether it
  // answers is closed by a real call and by nothing here.
  const free = await addon("fw-api-free", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [{ ...RICH_API, url: "https://api.test/v1/public?c={{param.city}}" }] } },
  });
  const freeSaid = browserText(free.body);
  assert.match(freeSaid, /weather needs no key, so there is nothing to paste for it\./, freeSaid);
  assert.doesNotMatch(freeSaid, /answering already/, "the reply claims a service nobody called is working: " + freeSaid);
  assert.doesNotMatch(freeSaid, /Cloud → Secrets/, "a keyless connection was told to paste a key: " + freeSaid);
  assert.doesNotMatch(freeSaid, /comes from WeatherAPI/, "a keyless connection was sent to sign up: " + freeSaid);

  // THE NEGATIVE CONTROL, and it is the compatibility claim: every connection
  // on the platform today declares none of the three.
  const plain = await addon("fw-api-plain", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [{ name: "weather", url: "https://api.test/v1?c={{param.city}}&key={{W_KEY}}", params: ["city"], cacheSeconds: 300 }] } },
  });
  const old = ((plain.meta() || {}).apis || []).find((a) => a.name === "weather");
  assert.deepEqual(Object.keys(old), ["name", "url", "method", "headers", "params", "body", "ttl"],
    "a connection declaring none of the three gained a key in the store: " + JSON.stringify(old));
  const oldPage = pagePrompt(plain);
  assert.match(oldPage.text, /weather\(city\) — the platform holds the key and does the call/, "the old per-connection line moved");
  assert.doesNotMatch(oldPage.text, /it answers/, "a connection that described nothing described something");
  assert.match(browserText(plain.body), /add W_KEY under Cloud → Secrets/, "the destination sentence moved");
  assert.doesNotMatch(browserText(plain.body), /comes from/, "a connection with no credential guidance invented some");
});

test("a request carrying a keyed and a keyless connection says the right thing about EACH", async () => {
  // ⚠ THE CASE THE FLAT SECRETS LIST COULD NOT GET RIGHT, and it needs two
  // connections in ONE request to exist at all. The note took every
  // `{{SECRET}}` the whole change needed, which answers "does this CHANGE need
  // a key" — so with a keyed connection in the request the loop ran over the
  // keyless one too and read its credential metadata as provenance, sending
  // the owner to sign up for a key nothing would ever use. With no keyed
  // connection the same list was empty and the whole reply claimed the service
  // was answering.
  //
  // The two services are named DIFFERENTLY on purpose: that is what makes
  // "the keyed one's provenance is printed and the keyless one's is not" an
  // assertion rather than a coincidence.
  const r = await addon("fw-api-mixed", "show the forecast and the tide times", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [
      RICH_API,
      { name: "tides", url: "https://tides.test/v1/today?port={{param.port}}",
        params: [{ name: "port", type: "string", required: true, description: "the harbour" }],
        returns: [{ time: "string", height: "number" }],
        credential: { service: "TideWatch", url: "https://tidewatch.test/signup", note: "free for 500 calls" } },
    ] } },
  });
  assert.equal(r.body.ok, true, r.text || JSON.stringify(r.body));
  assert.deepEqual((r.body.apis || []).slice().sort(), ["tides", "weather"], JSON.stringify(r.body.apis));
  assert.deepEqual(r.body.needsSecrets, ["W_KEY"], "the destination sentence is about the keyed one alone: " + JSON.stringify(r.body.needsSecrets));

  const said = browserText(r.body);
  assert.match(said, /The key for weather comes from WeatherAPI at https:\/\/weatherapi\.test\/signup/, said);
  assert.match(said, /tides needs no key, so there is nothing to paste for it\./, said);
  assert.doesNotMatch(said, /TideWatch/, "the keyless connection's own credential guidance reached the owner: " + said);
  assert.doesNotMatch(said, /The key for tides/, "the keyless connection was told it has a key: " + said);
  assert.doesNotMatch(said, /answering already/, said);

  // AND BOTH ARE REALLY STORED, so the sentence is about a connection the site
  // has rather than about an answer that was refused on the way in.
  const meta = r.meta() || {};
  const stored = meta.apis || [];
  assert.deepEqual(stored.map((a) => a.name).slice().sort(), ["tides", "weather"], JSON.stringify(stored.map((a) => a.name)));

  // ⚠ AND THE LIST RESPONSE IS THE OTHER HALF OF THIS CASE. `tides` answers a
  // BARE ARRAY, which is what most list endpoints send and which the tool
  // refused to let a model say until the root rule became one definition.
  // Followed to all three places a connection has to reach.
  const tool = promptFor(r, "api");
  assert.ok(tool.itemProps.includes("returns"), JSON.stringify(tool.itemProps));
  // ⚠ THE TOOL'S OWN TYPE, not merely that the property is offered. It was
  // `"object"` while the cleaner accepted a list, so a designer obeying the
  // schema could not say this — and a case reading only the key set passes
  // against that tool, because the fixture hands the answer in.
  assert.ok([].concat(tool.itemSchema.properties.returns.type).includes("array"),
    "the tool does not let a designer describe a list answer: " + JSON.stringify(tool.itemSchema.properties.returns.type));
  assert.deepEqual(stored.find((a) => a.name === "tides").returns, [{ time: "string", height: "number" }],
    "a top-level list sketch did not survive the store");
  assert.deepEqual(apiFor(meta, "tides").returns, [{ time: "string", height: "number" }],
    "the readback dropped it — the serving route and the store disagree about the shape");
  const page = pagePrompt(r);
  assert.match(page.text, /it answers \[\{\\"time\\":\\"string\\",\\"height\\":\\"number\\"\}\]/, "the list shape is not in the page prompt");
  // The prompt rides in a JSON body, so the quotes around the name are escaped
  // in it — which is why the weather assertion above stops short of them.
  assert.match(page.text, /useApi<\{ time: string; height: number \}\[\]>\(\\"tides\\", \{ port \}\)/,
    "the writer is left to invent the annotation for a list answer");
});

test("ACCEPTANCE: the page the addon route produced renders the service's answer through the real hook and the real route", async () => {
  // ⚠ THE JOIN, AND WHY IT IS ONE CASE. The tier had three claims, each proved
  // somewhere else and none of them proving the next: that the declared shape
  // reaches the writer (the prompt case), that a page written against it
  // renders (the standalone render, with `@/lib/rows` stubbed), and that the
  // public route serves the connection (the serving cases). A page can satisfy
  // all three and still draw nothing, because between the page and the service
  // sit two hops nothing had ever run together — the url `useApi` builds from
  // the parameters it is given, and what the platform's route does with them.
  //
  // So: the page goes through the REAL addon route, the source is read back
  // OUT OF THE STORE, and that exact string is rendered with the kit's own
  // `useApi` against `worker.js`'s own `/api/db/<slug>/api/<name>`. The only
  // stub left is the third-party service.
  const FORECAST = typeFromShape(SHAPE);
  const WRITTEN = [{
    path: "src/routes/index.tsx",
    // THE STORED PAGE'S OWN WORDS ARE KEPT, because `keptProse` is a real wall
    // on this path: an addition may only ADD, and a rewrite that loses the
    // page's prose is refused 422 before anything is stored.
    source: "import { createFileRoute } from '@tanstack/react-router'\n"
      + "import { useApi } from '@/lib/rows'\n"
      + "type Forecast = " + FORECAST + ";\n"
      + "export const Route = createFileRoute('/')({ component: Page })\n"
      + "function Page(){\n"
      + "  const q = useApi<Forecast>(\"weather\", { city: \"Leeds\" });\n"
      + "  if (q.isLoading) return <main><h1>index</h1><p>Words for index.</p><p data-slot=\"waiting\">Checking the forecast…</p></main>\n"
      + "  if (q.error) return <main><h1>index</h1><p>Words for index.</p><p data-slot=\"failed\">The forecast is not available right now.</p></main>\n"
      + "  return <main><h1>index</h1><p>Words for index.</p>"
      + "<p data-slot=\"now\">{q.data?.current?.temp_c}°C, {q.data?.current?.condition?.text}</p>"
      + "<ul>{(q.data?.forecast ?? []).map((d) => <li key={d.day}>{d.day}: {d.high}</li>)}</ul></main>\n"
      + "}\n",
  }];
  const r = await addon("fw-api-live", "show the forecast on the home page", {
    kinds: ["api"], publishes: true, sitePages: ["/"], written: WRITTEN,
    answers: { api: { api: [RICH_API] } },
  });
  assert.equal(r.body.ok, true, r.text || JSON.stringify(r.body));

  // ── 1. THE COMPILER PAYLOAD, which is what the site was really built from.
  const sent = compiledPages(r).find((p) => p.path === "index.tsx");
  assert.ok(sent, "the page never reached the builder: " + JSON.stringify(compiledPages(r).map((p) => p.path)));
  assert.match(sent.source, /useApi<Forecast>\("weather", \{ city: "Leeds" \}\)/, sent.source);
  assert.match(sent.source, new RegExp("type Forecast = " + FORECAST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    "the annotation the connection derived did not reach the compiler: " + sent.source);

  // ── 2. THE STORED SOURCE, which is a different claim: what the next edit
  // works from, and what this case renders. A change that reached the compiler
  // and not the store leaves the site serving one page and offering another.
  const src = storedSource(r, "fw-api-live", "index.tsx");
  assert.match(src, /useApi<Forecast>\("weather"/, "the page is not in the store: " + src);
  assert.match(src, /q\.data\?\.current\?\.temp_c/, src);

  // ── 3. KNOWN VALUES, through the real hook and the real route.
  const api = (r.meta().apis || []).find((a) => a.name === "weather");
  assert.ok(api, "the connection is not in the stored schema");
  const REAL = { current: { temp_c: 18.5, condition: { text: "Light rain" } }, forecast: [{ day: "Sat", high: 21 }] };
  const answers = (v, status = 200) => () => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

  const good = await renderRouteSource(src, { slug: "fw-live-ok", api, secrets: { W_KEY: "real-key" }, service: answers(REAL) });
  assert.match(good.html, /18\.5°C, Light rain/, "the declared field names did not reach the page: " + good.html);
  assert.match(good.html, /<li>Sat: 21<\/li>/, good.html);
  assert.match(good.html, /Words for index\./, "the page lost the words it was built on: " + good.html);
  // THE TWO HOPS A STUBBED HOOK SKIPS, and they are the point of this case.
  assert.deepEqual(good.routed, ["/api/db/fw-live-ok/api/weather?city=Leeds"],
    "the hook built a different url from the parameters the page gave it: " + JSON.stringify(good.routed));
  assert.equal(good.upstream.length, 1, JSON.stringify(good.upstream));
  assert.match(good.upstream[0], /c=Leeds/, good.upstream[0]);
  assert.match(good.upstream[0], /key=real-key/, "the platform did not substitute the key; the page must never see it");

  // ── 4. LOADING. Not a stub answering `{isLoading:true}` — a server render
  // runs no effects, so this IS the hook's own pending state.
  assert.match(good.loading, /Checking the forecast…/, good.loading);
  assert.doesNotMatch(good.loading, /18\.5/, "the first render already had the data, so it is not the loading state");

  // ── 5. MISSING CREDENTIALS. The vault holds nothing, `fill` refuses, and
  // the page draws its error branch instead of a plausible wrong answer.
  const nokey = await renderRouteSource(src, { slug: "fw-live-nokey", api, secrets: {}, service: answers(REAL) });
  assert.match(nokey.html, /not available right now/, nokey.html);
  assert.doesNotMatch(nokey.html, /18\.5/, nokey.html);
  assert.deepEqual(nokey.upstream, [], "a request went out with the key blank");
  assert.equal(nokey.errors.length, 1, "the page was handed no error to branch on");
  assert.doesNotMatch(String(nokey.errors[0].message || ""), /W_KEY/,
    "the site's own credential name reached the browser: " + nokey.errors[0].message);

  // ── 6. UPSTREAM FAILURE. The service answers and the answer is a failure,
  // which is a different thing from the platform refusing before the call.
  const down = await renderRouteSource(src, { slug: "fw-live-down", api, secrets: { W_KEY: "real-key" },
    service: answers({ error: "gateway" }, 502) });
  assert.match(down.html, /not available right now/, down.html);
  assert.doesNotMatch(down.html, /18\.5/, down.html);
  assert.equal(down.upstream.length, 1, "the service was never called, so this is not the upstream case");
  assert.equal(down.errors.length, 1, "a failing service rendered as success");
});

test("a sketch that cannot be read refuses the connection by name, and stores nothing", async () => {
  // A SAMPLE INSTEAD OF A SKETCH is the mistake this refusal is for: a real
  // value where a type name belongs. Refused rather than dropped, because the
  // alternative is a page written blind against a service nobody described —
  // which is the defect the field exists to close.
  const r = await addon("fw-api-bad", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [{ ...RICH_API, returns: { current: { temp_c: 18.5 } } }] } },
  });
  assert.equal(r.body.ok, false, "a connection with an unreadable sketch was published: " + JSON.stringify(r.body));
  assert.match(r.body.msg || "", /couldn't read the description of what that service sends back/, r.body.msg);
  // THE PROPERTY, not the shape of an empty key: the site's stored spec holds
  // no connection by that name. `apis` may legitimately be `[]` here — that is
  // the fixture's own starting spec — so asserting on the key rather than on
  // the connection would pass for a store that really did gain one.
  assert.equal(((r.meta() || {}).apis || []).find((a) => a && a.name === "weather"), undefined,
    "a refused connection reached the store: " + JSON.stringify((r.meta() || {}).apis));
  assert.equal(r.body.cost, 0, "a refusal charged for something");

  // ⚠ AND THE CREDENTIAL REFUSAL IS ITS OWN WALL, with its own sentence. An
  // http sign-up page is a link this platform would put in front of its own
  // customer, and the engine merely DROPS it — so without a refusal here the
  // connection ships and the owner is told nothing. Driven because the sweep
  // found the cleaner's line could be cut with every case still green: the
  // sketch refusal above covers a different branch.
  const bad = await addon("fw-api-badcred", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [{ ...RICH_API, credential: { service: "WeatherAPI", url: "http://weatherapi.test/signup" } }] } },
  });
  assert.equal(bad.body.ok, false, "a connection with an http sign-up link was published: " + JSON.stringify(bad.body));
  assert.match(bad.body.msg || "", /has to be an https address/, bad.body.msg);
  assert.equal(((bad.meta() || {}).apis || []).find((a) => a && a.name === "weather"), undefined,
    "the refused connection reached the store anyway");
  assert.equal(bad.body.cost, 0, "a refusal charged for something");

  // ⚠ A SENTENCE WHERE THE SKETCH GOES IS ITS OWN BRANCH, and it is the one a
  // model really writes: the tool's own description says NEVER write a
  // sentence here precisely because reaching for prose is the habit. It lands
  // on `shape-top` rather than `shape-leaf` — a leaf is a type NAME and may sit
  // anywhere but the root — and a sweep mutant took `shape-top` off the
  // malformed-sketch list with every case above still green, because a
  // fall-through to the default still REFUSES and only the advice changes. The
  // specific sentence says what to do about a sketch; the default says "say
  // what you want on the site and where", which is the wrong thing to tell
  // somebody whose only problem is how the answer was described.
  const prose = await addon("fw-api-prose", "show the forecast", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [{ ...RICH_API, returns: "a list of exchange rates" }] } },
  });
  assert.equal(prose.body.ok, false, "a connection whose sketch is a sentence was published: " + JSON.stringify(prose.body));
  assert.match(prose.body.msg || "", /couldn't read the description of what that service sends back/, prose.body.msg);
  assert.doesNotMatch(prose.body.msg || "", /say what you want on the site and where/,
    "the customer got the generic advice about a connection whose only problem is its sketch");
  assert.equal(((prose.meta() || {}).apis || []).find((a) => a && a.name === "weather"), undefined,
    "the refused connection reached the store anyway");
  assert.equal(prose.body.cost, 0, "a refusal charged for something");
});

// ─────────────────────────────────────────────────────────────────────────────
// A SUPPLIED VIDEO OR AUDIO URL, FROM THE CUSTOMER'S SENTENCE TO THE COMPONENT
//
// Owner, 2026-09-19: *"For supplied video/audio URLs, trace the whole route
// from the customer request to the selected component, its exact props, the
// page prompt, compiler payload and stored source. Ensure the actual kit
// component receives the intended URL and the relevant existing options, such
// as captions when supported."*
//
// WHAT WAS FOUND BEFORE WRITING ANY OF THIS, because the instruction was to
// determine what already works rather than build a second mechanism:
// `video-embed`, `video-player`, `video-hero`, `audio-player` and
// `audio-recorder` are ALL in `COMPONENT_MENU`, and `siteComponentApi` already
// hands the page writer their exact props — measured through the route:
//
//   video-embed  — VideoEmbed(url: string, title?: string = "Video", ratio?: string = "16/9")
//   video-player — VideoPlayer(src: string, poster?: string, captions?: { src, label, lang, default? }[], title?: string)
//   audio-player — AudioPlayer(src: string, title?: string)
//
// So no new field carries the url: it rides the customer's own sentence and the
// designer's `does`, both of which reach the page prompt. These cases prove
// that end to end rather than adding a mechanism beside it.
//
// ⚠ AND THE SCOPE OF WHAT A GREEN RUN HERE MEANS, stated rather than implied:
// the designer's answer and the writer's page are SUPPLIED. This is local
// pipeline evidence — the url a designer names really reaches the component's
// prop, survives to the compiler payload and to the store, and renders — and it
// is NOT evidence that a real model independently produces that answer.
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
/** A new page whose body is this case's own — `writtenPage`'s shape, its words. */
const pageWith = (route, body) => {
  const w = writtenPage(route);
  return { ...w, source: w.source.replace("</main>", body + "</main>") };
};

test("a supplied video url reaches the kit component's own prop, and renders", async () => {
  const ask = "Put a video of our workshop on the home page — it's at " + YT;
  const r = await addon("fw-video", ask, {
    publishes: true, sitePages: ["/"],
    kinds: ["component"],
    answers: { component: { component: [{
      page: "/", where: "after the opening band",
      does: "shows the workshop tour video from " + YT,
      components: ["video-embed"],
    }] } },
    written: [addedTo("/", '<VideoEmbed url="' + YT + '" title="The workshop tour" />')],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // 1. THE WRITER WAS GIVEN EVERYTHING IT NEEDS: the customer's own sentence
  //    (which is where the url really lives), the url itself, and the exact
  //    signature — so `url` is a prop it was told about rather than guessed.
  const pp = pagePrompt(r).text;
  assert.ok(pp.includes(YT), "the supplied url never reached the page writer");
  assert.ok(pp.includes("Put a video of our workshop"), "the customer's own words never reached the page writer");
  assert.ok(pp.includes("VideoEmbed(url: string"), "the component's signature never reached the page writer");

  // 2. THE COMPILER PAYLOAD — what the route HANDED the thing that builds the
  //    site, which is the artifact rather than a claim on the reply.
  const built = compiledPages(r).find((p) => p.path.includes("index"));
  assert.ok(built, "no home page reached the compiler");
  assert.ok(built.source.includes('url="' + YT + '"'),
    "the url did not reach the component's prop in the compiled page: " + built.source.slice(0, 300));

  // 3. AND THE STORE, a third claim: a change that reached the compiler and not
  //    the store leaves the next edit working from the old file.
  const kept = storedSource(r, "fw-video", "index.tsx");
  assert.ok(kept.includes('url="' + YT + '"'), "the stored source lost the url");

  // 4. THE COMPONENT REALLY TURNS THAT URL INTO A WORKING EMBED. The two halves
  //    are joined here rather than asserted apart: the url is read back OUT of
  //    what the route stored and handed to the REAL kit file, so "the pipeline
  //    kept it" and "the component can use it" are one chain.
  const url = (kept.match(/url="([^"]+)"/) || [])[1];
  assert.equal(url, YT);
  const html = renderKit("src/components/ui/video-embed.tsx", "VideoEmbed", { url, title: "The workshop tour" });
  assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/, "the stored url does not embed");
  assert.match(html, /data-slot="video-embed"/, "the working embed is uncountable");
  assert.match(html, /title="The workshop tour"/, "the title did not reach the iframe");
  assert.doesNotMatch(html, /src="https:\/\/(www\.)?youtube\.com/, "the tracking host reached the page");

  // 5. AND NOTHING WAS BOUGHT. A video is not a photograph: no provider call,
  //    no picture on the reply, and the bill is the page rung's own.
  assert.equal(r.shots.length, 0, "the image provider was paid for a video");
  assert.ok(!r.body.pictures, "a video was reported as a photograph made");
});

test("a NEW page plus a hosted film keeps its captions all the way down", async () => {
  // THE COMBINATION THE OWNER NAMED — "new page plus media component" — and
  // `captions` is the option most easily lost: it is the one prop here that is
  // an ARRAY OF OBJECTS, so a pipeline that stringifies or re-shapes anything
  // loses it silently and the site promises subtitles it does not serve.
  const SRC = "https://films.example.com/workshop-tour.mp4";
  const FILM = '<VideoPlayer src="' + SRC + '" poster="https://films.example.com/poster.jpg" '
    + 'captions={[{ src: "https://films.example.com/en.vtt", label: "English", lang: "en", default: true }]} '
    + 'title="The workshop film" />';
  const r = await addon("fw-film", "Add a page showing our workshop film, with English subtitles", {
    publishes: true, sitePages: ["/"],
    kinds: ["page", "component"],
    answers: {
      page: { page: [{ path: "/film", name: "The film", purpose: "shows the workshop film",
        sections: ["the film"], components: ["card"] }] },
      component: { component: [{ page: "/film", where: "the whole page",
        does: "plays the workshop film with English subtitles", components: ["video-player"] }] },
    },
    written: [pageWith("/film", FILM), addedTo("/", '<a href="/film">The film</a>')],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.kinds, ["page", "component"], "both kinds were not designed in one change");

  // THE SIGNATURE THE WRITER WAS SHOWN NAMES `captions` AND ITS SHAPE — without
  // that, a page writing them is inventing a prop.
  assert.ok(pagePrompt(r).text.includes("captions?: { src: string; label: string; lang: string; default?: boolean }[]"),
    "the caption shape never reached the page writer");

  const built = compiledPages(r).find((p) => p.path.includes("film"));
  assert.ok(built, "the film page never reached the compiler: " + JSON.stringify(compiledPages(r).map((p) => p.path)));
  assert.ok(built.source.includes('src="' + SRC + '"'), "the film url did not reach the component");
  assert.ok(built.source.includes('label: "English"'), "the caption track was lost on the way to the compiler");
  assert.ok(built.source.includes('lang: "en"'), "the caption language was lost");

  const kept = storedSource(r, "fw-film", "film.tsx");
  assert.ok(kept.includes('src="' + SRC + '"') && kept.includes('label: "English"'),
    "the store lost the film or its captions");

  // AND THE REAL COMPONENT DOES SOMETHING WITH THEM, which a prop reaching a
  // file does not by itself establish.
  const html = renderKit("src/components/ui/video-player.tsx", "VideoPlayer", {
    src: SRC, title: "The workshop film",
    captions: [{ src: "https://films.example.com/en.vtt", label: "English", lang: "en", default: true }],
  });
  assert.match(html, /<track/, "the captions reached the component and it rendered no track");
  assert.match(html, /label="English"/);
});

test("a supplied AUDIO url is external by construction, and an invented hosted one is emptied", async () => {
  // ⚠ THE PLATFORM CANNOT HOST AUDIO OR VIDEO, and that decides this case's
  // shape rather than being a footnote. `UPLOAD_EXTS` is png · jpg · webp · gif
  // · pdf · the zip family, so a `/u/<slug>/…mp3` is a url this platform can
  // never serve — which means a SUPPLIED sound file is always somebody else's
  // origin, and every `/u/`-scoped image wall is out of its way by definition.
  const MP3 = "https://audio.example.com/interview.mp3";
  const r = await addon("fw-audio", "Put the interview recording on the home page — " + MP3, {
    publishes: true, sitePages: ["/"],
    kinds: ["component"],
    answers: { component: { component: [{ page: "/", where: "below the opening band",
      does: "plays the interview from " + MP3, components: ["audio-player"] }] } },
    written: [addedTo("/", '<AudioPlayer src="' + MP3 + '" title="The interview" />')],
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok(pagePrompt(r).text.includes("AudioPlayer(src: string"), "the signature never reached the page writer");
  const built = compiledPages(r).find((p) => p.path.includes("index"));
  assert.ok(built.source.includes('src="' + MP3 + '"'), "an external audio url was altered on the way to the compiler");
  assert.ok(storedSource(r, "fw-audio", "index.tsx").includes('src="' + MP3 + '"'), "the store lost the audio url");

  // THE CONTROL, and it is the behaviour rather than an aside: a model that
  // INVENTS a hosted url writes one this platform cannot serve, and the stray
  // wall empties it — correctly, because no such object exists. An empty `src`
  // is a player with nothing in it; a live url to a 404 is the same thing with
  // a network request. Measured so the difference between the two shapes is on
  // the record rather than assumed.
  const bad = await addon("fw-audio2", "Put the interview recording on the home page", {
    publishes: true, sitePages: ["/"],
    kinds: ["component"],
    answers: { component: { component: [{ page: "/", where: "below the band",
      does: "plays the interview", components: ["audio-player"] }] } },
    written: [addedTo("/", '<AudioPlayer src="/u/fw-audio2/interview.mp3" title="The interview" />')],
  });
  assert.equal(bad.body.ok, true, JSON.stringify(bad.body));
  const builtBad = compiledPages(bad).find((p) => p.path.includes("index"));
  assert.ok(builtBad.source.includes('src=""'),
    "an invented hosted url shipped as a live reference to an object that cannot exist: " + builtBad.source.slice(0, 300));
  assert.ok(!builtBad.source.includes("interview.mp3"), "the invented url survived into the compiled page");
});

// ── A JOB THAT RUNS ONCE, THROUGH THE REAL ROUTE (2026-09-19) ───────────────
//
// Owner: *"Add native one-time scheduling as a separate, reviewable
// capability… A request to run once must never silently become a recurring
// job."* The scheduler's own arithmetic and the run/skip lifecycle are driven
// where they live; what these drive is the hop chain the route owns — the TOOL
// the designer really received, what the cleaner kept, what reached
// `site_functions`, and what the customer was told.
const ONCE_FN = { name: "send_note", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const ONCE_JOB = { name: "closing_note", fn: "send_note", everyMinutes: 60, at: "09:00", on: "2026-10-03" };

test("a one-time job is offered, kept, registered and reported", async () => {
  const r = await addon("fw-once", "email everyone on the 3rd of October that we're closed", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: { function: { function: [ONCE_FN] }, job: { job: [ONCE_JOB] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // HOP 1 — THE TOOL REALLY OFFERED IT. Read one level IN, off the request the
  // route sent, because a case that hands the answer in bypasses the tool
  // entirely: from outside, "the model did not say it" and "we never gave it
  // anywhere to say it" are the same absence. This repository has paid for
  // that distinction twice.
  const jobCall = r.prompts.find((p) => p.kind === "job");
  assert.ok(jobCall.itemProps.includes("on"),
    "the job designer has nowhere to say a job runs once: " + JSON.stringify(jobCall.itemProps));
  assert.match(jobCall.itemSchema.properties.on.description, /runs ONCE/,
    "the tool does not say what `on` is for");
  assert.match(jobCall.itemSchema.properties.on.description, /MUST also give `at`/,
    "the tool does not say a date needs a time");

  // HOP 2 — THE CLEANER KEPT IT, and forced the interval to the ceiling. The
  // model asked for 60 minutes while thinking about a date; the interval means
  // nothing for a one-time job and the forcing is the fail-safe if `on` is
  // ever lost.
  const kept = r.body.jobs.find((j) => j.name === "closing_note");
  assert.equal(kept.on, "2026-10-03", "the date did not survive cleaning: " + JSON.stringify(kept));
  assert.equal(kept.at, "09:00", "a one-time job asked at 60 minutes lost its time of day");
  assert.ok(kept.everyMinutes >= 44640,
    "the interval was left as asked, so a lost date would leave an hourly job: " + JSON.stringify(kept));

  // HOP 3 — IT REACHED THE REGISTRY, in the SPEC, which is where `dueJobs`
  // reads it. A registration that drops `on` turns the request into a monthly
  // job the moment it is saved, and nothing downstream could tell.
  const row = r.registered.find((x) => x.name === "closing_note");
  assert.ok(row, "the job was never registered: " + JSON.stringify(r.registered.map((x) => x.name)));
  assert.equal(row.spec.on, "2026-10-03", "the registry row lost the date: " + JSON.stringify(row.spec));
  assert.equal(row.spec.at, "09:00");
  assert.equal(row.spec.tz, "Europe/London", "the browser's zone did not reach the registry");
  assert.equal(row.spec.fn, "send_note");

  // HOP 4 — AND NOTHING WAS PUBLISHED. An internal function and a job change
  // no page, so this is the pageless path: no container, no compile.
  assert.equal(r.compiles.length, 0, "a job-only change wanted a container");
});

test("a one-time job is refused by name rather than quietly recurring", async () => {
  // ⚠ THE OWNER'S SENTENCE AS THREE REFUSALS, and they are three because they
  // need three different things done about them. Each is asserted on the
  // customer's own words, and each costs nothing: `cost: 0`, no registration.
  const ask = async (job, extra) => addon("fw-once-bad", "email everyone on the 3rd that we're closed", {
    kinds: ["function", "job"], tz: "Europe/London", ...extra,
    answers: { function: { function: [ONCE_FN] }, job: { job: [job] } },
  });

  const past = await ask({ ...ONCE_JOB, on: "2020-01-01" });
  assert.equal(past.body.ok, false, "a date already gone was accepted: " + JSON.stringify(past.body));
  assert.equal(past.body.reason, "past-date");
  assert.equal(past.body.cost, 0, "a refusal charged");
  assert.match(past.body.msg, /already gone/, past.body.msg);
  assert.deepEqual(past.registered.map((x) => x.name), [], "a refused change registered a job");

  const bad = await ask({ ...ONCE_JOB, on: "3 Oct" });
  assert.equal(bad.body.reason, "bad-date", JSON.stringify(bad.body));
  assert.match(bad.body.msg, /couldn't read the date/, bad.body.msg);

  // ⚠ AND A DATE THAT IS THE RIGHT SHAPE AND NOT A REAL DAY — a sweep
  // survivor, because "3 Oct" is refused by the SHAPE and so could not tell a
  // working calendar check from none at all. `2026-02-30` and `2026-13-45`
  // both match `ON_RE` exactly; only the arithmetic separates them from a day.
  // The leap year is the control on the other side: 2024 really has a 29th of
  // February and must be accepted.
  for (const junk of ["2026-02-30", "2026-13-45", "2026-00-10", "2026-04-31"]) {
    const r = await ask({ ...ONCE_JOB, on: junk });
    assert.equal(r.body.reason, "bad-date", "a date that is not a day was accepted: " + junk + " " + JSON.stringify(r.body));
  }
  const leap = await ask({ ...ONCE_JOB, on: "2028-02-29" });
  assert.equal(leap.body.ok, true, "a real leap day was refused — the check is too strict: " + JSON.stringify(leap.body));

  const noTime = await ask({ name: "closing_note", fn: "send_note", everyMinutes: 1440, on: "2026-10-03" });
  assert.equal(noTime.body.reason, "no-time", JSON.stringify(noTime.body));
  assert.match(noTime.body.msg, /needs a time of day/, noTime.body.msg);

  // …AND THE CONTROL THAT MAKES THE PAST-DATE WALL A WALL: the same date, with
  // no zone on the request. `aToday` is then unknown and the check stands down
  // rather than comparing a local date against UTC — which would refuse a
  // perfectly good "today" for everybody west of Greenwich for most of the
  // working day. Without this the case could not tell a working wall from one
  // that refuses everything.
  const noZone = await ask({ ...ONCE_JOB, on: "2020-01-01" }, { tz: null });
  assert.equal(noZone.body.ok, true, "the wall fired with no zone to judge against: " + JSON.stringify(noZone.body));
});

test("an ordinary recurring job is byte for byte what it was", async () => {
  // THE CONTROL FOR THE WHOLE FEATURE. Every site on the platform is this case,
  // and a change that quietly gave one of them a date would be the defect
  // inverted.
  const r = await addon("fw-still-daily", "remind people the day before", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: { function: { function: [FN] }, job: { job: [JOB] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const kept = r.body.jobs.find((j) => j.name === "daily_reminder");
  assert.equal(kept.on, undefined, "a recurring job gained a date");
  assert.equal(kept.everyMinutes, 1440, "a recurring job's interval moved");
  const row = r.registered.find((x) => x.name === "daily_reminder");
  assert.equal(row.spec.on, undefined, "a recurring job was registered as one-time");
  assert.deepEqual(Object.keys(row.spec).sort(), ["at", "fn", "tz"], "the recurring spec's shape moved: " + JSON.stringify(row.spec));
});

// ── A JOB THAT REUSES A FUNCTION THE SITE ALREADY HAS (2026-09-19) ──────────
//
// REPRODUCED LIVE ON RUN 52, and the feature worked while the report denied it.
// The ask registered `count_bookings_once` — a one-time job on the site's own
// `nightly_booking_count` — and the customer was told, on the same screen that
// had just said it was scheduled:
//
//   "…waiting on another part of the same change that didn't work: … — the
//    count_bookings_once it needs could not be created"
//
// THE CAUSE WAS TWO READERS OF ONE FACT. `applySiteSchema` persists a function
// with NO BODY, `normalizeSchema` drops a bodiless function, and the job goes
// behind it — so the audit called the job `unbuilt` and marked the whole `job`
// step failed. The apply then re-attached exactly such a job and registered it.
// `withJobDeps` and `storedJobFns` are the one rule both read now.
//
// IT IS NOT ABOUT `on`. A recurring job on a stored function took the same
// path, which is why both are driven here.
const STORED_FN = { name: "nightly_count", args: "", returns: "json", internal: true };
const SITE_HAS_FN = { tables: STORED_SCHEMA.tables, functions: [STORED_FN], apis: [], jobs: [] };
const ONCE_REUSE = { name: "count_once", fn: "nightly_count", everyMinutes: 1440, at: "09:00", on: "2026-10-03" };
const DAILY_REUSE = { name: "count_daily", fn: "nightly_count", everyMinutes: 1440, at: "07:00" };
/** The claim a designer really makes about a job it scheduled. */
const jobNeed = (item) => ({
  need: "the booking count runs on its own",
  status: "covered",
  by: item + " runs nightly_count on the schedule asked for",
  kind: "job",
  item,
});

for (const [shape, job] of [["one-time", ONCE_REUSE], ["recurring", DAILY_REUSE]]) {
  test("a " + shape + " job reusing a stored function is registered AND reported as scheduled", async () => {
    const r = await addon("fw-reuse-job-" + shape, "count the bookings on a schedule", {
      kinds: ["job"], tz: "Europe/London", stored: SITE_HAS_FN,
      answers: { job: { job: [job], requirements: [jobNeed(job.name)] } },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body));
    // THIS CASE IS ABOUT REUSE, so it must not have created the function — the
    // whole defect lives in the branch where `appliedFacts` is silent.
    assert.deepEqual(r.body.functions || [], [], "the change created a function: this is not the reuse path");

    // ── REGISTRATION. The job really reached `site_functions`, in the SPEC,
    // which is where `dueJobs` reads it.
    const row = r.registered.find((x) => x.name === job.name);
    assert.ok(row, "the reused-function job was never registered: " + JSON.stringify(r.registered.map((x) => x.name)));
    assert.equal(row.spec.fn, "nightly_count", "the registry row lost the function it reuses");
    assert.equal(row.spec.on, job.on, "the registry row disagrees with the shape asked for");

    // ── AND THE STEP IS NOT FAILED. `jobErrors` is the route's own report of a
    // job that could not be set up; a reuse job must produce none.
    assert.deepEqual(r.body.jobErrors || [], [], "a registered job was reported as an error");
    assert.deepEqual((r.body.unbuilt || {}).job || [], [],
      "a job the engine really built was reported as dropped whole: " + JSON.stringify(r.body.unbuilt));

    // ── STORED COVERAGE. The claim naming the job resolves against the job
    // this change applied, and the state is the honest ceiling: it exists and
    // nothing here has watched it fire.
    const cov = storedAnswer(r, "fw-reuse-job-" + shape).coverage;
    const q = cov.requirements.find((x) => x.need === "the booking count runs on its own");
    assert.equal(q.implementation, "found", "a registered job was not found by its own claim");
    assert.equal(q.foundIn, "applied", "the job this change made was not read as this change's work");
    assert.equal(q.implementedBy, job.name);
    assert.equal(q.state, "unverified", "a registered job was not read as there-and-unchecked: " + q.state);
    assert.equal(cov.counts.blocked, 0, "a registered job left a blocked requirement: " + JSON.stringify(cov.counts));
    assert.equal(cov.counts.failed, 0, "a registered job left a failed requirement");
    assert.equal(cov.counts.missing, 0, "a registered job was counted as work that is not there");

    // ── `checked` STAYS EMPTY, asserted by its OBSERVABLE consequence. The
    // stored record carries no `made` list, so a loop over one here would be a
    // negative assertion with no observer — this repository's own most
    // expensive shape. `delivered` is the state `checked` and only `checked`
    // buys, so a filled one shows up exactly here; the census that drives
    // `appliedFacts` over every applied kind lives in `addon-steps`.
    assert.equal(cov.counts.delivered, 0,
      "a job claimed a behaviour nothing on this path exercises: " + JSON.stringify(cov.counts));

    // ── AND THE CUSTOMER'S OWN SCREEN, composed by the browser's real
    // `addonAnswer`. The scheduling is stated; run 52's sentence is not.
    const said = browserText(r.body);
    assert.match(said, new RegExp("scheduled " + job.name), "the reply does not say the job was scheduled: " + said);
    assert.doesNotMatch(said, /could not be created/,
      "run 52's sentence came back about a job that was registered: " + said);
    assert.doesNotMatch(said, /waiting on another part of the same change/,
      "a registered job is still reported as a broken dependency: " + said);
    // AUTOMATIC EXECUTION IS STILL UNVERIFIED AND THE REPLY SAYS SO — the job
    // clause, which is more specific than the general can't-confirm one and is
    // true of every job this platform has ever registered. Losing it would
    // trade one over-claim for another, so it is asserted rather than assumed.
    assert.match(said, /Scheduled as you asked/, "the reply does not state the scheduling: " + said);
    assert.match(said, /Automatic running hasn't been verified from here yet/,
      "the reply claims the schedule has been seen to run: " + said);
  });
}

test("the genuine job failures are still reported when a stored function is in play", async () => {
  // ⚠ THE CONTROLS, and without them the fix above is indistinguishable from
  // clearing every job failure. Each is a DIFFERENT reason a job legitimately
  // does not happen, and each must survive on a site that also has a reusable
  // stored function — which is the exact context the fix widened.
  const ask = (slug, opts) => addon(slug, "count the bookings on a schedule", {
    kinds: ["job"], tz: "Europe/London", stored: SITE_HAS_FN, ...opts,
  });

  // (a) A NAME NOBODY DECLARED, and (b) A PUBLIC STORED FUNCTION. Both are
  // refused BY THE CLEANER, one hop earlier than the audit — `cleanAdd` admits
  // a job only against the site's internal functions — so they never reach the
  // context this fix widened at all. That is the stronger place for them to be
  // caught: a named refusal with a sentence, cost 0, nothing written. The
  // walls INSIDE the widened context are driven at the module, where the
  // cleaner cannot mask them (`site-schema-audit`).
  //
  // (b) IS THE ONE THAT MATTERS HERE. A job on a function a visitor could call
  // hands out every recipient's address to anyone who asks; the engine refuses
  // it deliberately, and a fix that widened the context by internal-ness would
  // show up as this case passing where it should not.
  for (const [what, slug, stored, job] of [
    ["a function nobody declared", "fw-reuse-ghost", SITE_HAS_FN, { ...ONCE_REUSE, name: "count_ghost", fn: "no_such_fn" }],
    ["a PUBLIC stored function", "fw-reuse-public", { ...SITE_HAS_FN, functions: [{ ...STORED_FN, internal: false }] }, ONCE_REUSE],
  ]) {
    const x = await ask(slug, { stored, answers: { job: { job: [job], requirements: [jobNeed(job.name)] } } });
    assert.equal(x.body.ok, false, "a job on " + what + " was accepted: " + JSON.stringify(x.body));
    assert.equal(x.body.reason, "no-job-fn", "a job on " + what + " was refused for the wrong reason: " + x.body.reason);
    assert.equal(x.body.cost, 0, "a refused job charged");
    assert.match(x.body.msg, /names a function this site doesn't have/, x.body.msg);
    assert.deepEqual(x.registered.map((n) => n.name), [], "a job on " + what + " was registered");
  }

  // (c) A NEW FUNCTION THE DATABASE REFUSED. The job depends on something this
  // change tried and failed to create; it is blocked by NAME, and the site's
  // reusable stored function must not rescue it.
  const c = await ask("fw-reuse-fnfail", {
    kinds: ["function", "job"], fnFail: true,
    answers: {
      function: { function: [{ name: "fresh_fn", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [{ ...ONCE_REUSE, name: "count_fresh", fn: "fresh_fn" }], requirements: [jobNeed("count_fresh")] },
    },
  });
  assert.equal((c.body.jobErrors || []).length, 1, "a job on a failed new function was not reported: " + JSON.stringify(c.body));
  assert.match(c.body.jobErrors[0].error, /fresh_fn/, "the failed dependency is not named");
  assert.deepEqual(c.registered.map((x) => x.name), [], "a job on a function that failed to create was registered");

  // (d) THE REGISTRATION ITSELF FAILING. The job is perfectly well formed and
  // the upsert does not land — the one failure the audit can never see, and
  // the one the reply must still carry.
  const d = await ask("fw-reuse-regfail", {
    jobsFail: true,
    answers: { job: { job: [ONCE_REUSE], requirements: [jobNeed("count_once")] } },
  });
  assert.equal((d.body.jobErrors || []).length, 1,
    "a job whose registration failed was reported as scheduled: " + JSON.stringify(d.body));
  assert.deepEqual(d.body.jobs || [], [], "a job that never registered was still claimed");
  const dq = storedAnswer(d, "fw-reuse-regfail").coverage.requirements[0];
  assert.notEqual(dq.state, "unverified", "a job whose registration failed still read as set up");
});

// ── FOUR COMPLETE REQUESTS, EACH THROUGH THE REAL ROUTE (2026-09-19) ────────
//
// Owner: *"a customer describes an addition, the builder understands the
// existing site, passes the right information between designers, creates the
// complete feature, preserves existing work, and accurately reports the
// result."* Every other case in this file isolates ONE hop; these four are
// whole customer sentences, and each is chosen because its value crosses a
// boundary no single-kind case can see:
//
//   1. an EXISTING table reaching a new function, and that function reaching
//      the page designer that runs after it
//   2. an EXISTING internal function reaching a new job — the re-attach hop,
//      which `normalizeSchema` would otherwise drop in silence
//   3. a connection's DECLARED RESPONSE SHAPE reaching the page writer, which
//      is the whole of what made that tier unwritable
//   4. a page, a component ON that page and a QR code pointing AT it, in one
//      message — three kinds whose destination is a route this same change is
//      adding, which was a silent substitution until 2026-09-17
//
// WHAT THEY PROVE AND WHAT THEY DO NOT. Every seam is its real producer's
// shape, so these prove the WIRING: a declared thing survives cleaning,
// reaches storage, reaches the later designers, produces an artifact and is
// reported honestly. They never prove a real model would answer this way —
// that is what the live runs are for, and they are the owner's press.

test("COMPLETE REQUEST 1 — an existing table reaches a new function, and the function reaches the page", async () => {
  // *"Add a page at /how-busy showing how many bookings we have, and a
  // function the page calls to count them."*
  //
  // THE TWO CROSSINGS ARE THE SUBJECT. The function designer must be told the
  // site already has `bookings` AND what its columns are — run 47's whole
  // defect was a designer told the site had no tables, which invented a second
  // one and counted that, and the page read 0 for ever. Then the PAGE
  // designer, one call later, must be told the function exists, or it writes a
  // page calling a name it cannot know.
  const r = await addon("fw-cr1", "add a page at /how-busy showing how many bookings we have, and a function the page calls to count them", {
    kinds: ["function", "page"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", '<Link to="/how-busy">How busy</Link>'), writtenPage("/how-busy")],
    answers: {
      function: { function: [{ name: "count_bookings", returns: "bigint", body: "SELECT COUNT(*) FROM bookings" }] },
      page: { page: [{ path: "/how-busy", name: "How busy", purpose: "show the number of bookings", sections: ["the count"], components: ["card"] }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // CROSSING 1 — the function designer was shown the existing table WITH its
  // columns. A name alone is not enough: a body naming a column the table has
  // not got is a function that fails at CREATE, which is the measured reason
  // that hop carries columns at all.
  const fn = promptFor(r, "function");
  assert.ok(fn, "the function designer was never called");
  assert.match(fn.text, /bookings/, "the function designer was not told the site has `bookings`");
  for (const c of STORED_SCHEMA.tables[0].columns) {
    assert.ok(fn.text.includes(c.name), "the function designer was not shown the column " + c.name);
  }

  // CROSSING 2 — the PAGE designer, running after it, was told the function
  // this same message designed one call earlier.
  const pg = promptFor(r, "page");
  assert.ok(pg, "the page designer was never called");
  assert.match(pg.text, /count_bookings/, "the page designer was not told about the function designed one call earlier");

  // THE FEATURE REALLY EXISTS — the statement reached Postgres, the page
  // reached the compiler, and the site is left holding it.
  assert.ok(r.sql.some((s) => /CREATE OR REPLACE FUNCTION/i.test(s) && /count_bookings/.test(s)),
    "no CREATE for the function reached the database: " + JSON.stringify(r.sql));
  assert.ok(compiledPages(r).some((p) => /how-busy/.test(p.path)), "the page never reached the compiler");
  assert.match(storedSource(r, "fw-cr1", "how-busy.tsx"), /createFileRoute/, "the site does not hold the new page");

  // AND THE EXISTING TABLE IS UNTOUCHED — three columns and `access: "user"`,
  // which is precisely what a replaced table loses.
  //
  // ⚠ THE NAME IS READ FROM EITHER SHAPE, because the stored list legally holds
  // both and the engine's own `norm.push` flattens to bare names. Asserting
  // `c.name` alone answered `[undefined, undefined, undefined]` on the first
  // run of this case — and chasing that is what found the column-union defect
  // in `applySiteSchema` (see `test/schema-column-union.test.mjs`): this same
  // request used to store SIX columns for this three-column table.
  const kept = (r.meta().tables || []).find((t) => t.name === "bookings");
  assert.ok(kept, "the site's own table is gone from the stored spec");
  const cols = kept.columns.map((c) => String(typeof c === "string" ? c : ((c && c.name) || "")));
  assert.deepEqual(cols, ["who", "slot", "phone"], "the existing table lost or doubled columns: " + JSON.stringify(kept.columns));
  assert.equal(kept.access, "user", "the existing table's access was replaced by the default");
});

test("COMPLETE REQUEST 2 — an existing internal function reaches a new job, and survives the normaliser", async () => {
  // *"Every night at 11 run the hold sweep."* The site already HAS
  // `sweep_holds`; this message designs only a job.
  //
  // ⚠ THIS IS THE RE-ATTACH HOP AND WITHOUT IT THE DROP IS SILENT.
  // `normalizeSchema` keeps a job only when its function is declared in the
  // SAME spec — right for a build, where the spec is the whole backend, and
  // wrong here, where the spec is only what this message designed. A stored
  // function has no body to re-send (re-sending one would `CREATE OR REPLACE`
  // the live function with nothing), so the job is re-attached against the
  // stored INTERNAL names instead, and only when the stored one really is
  // internal.
  const r = await addon("fw-cr2", "every night at 11 run the hold sweep", {
    kinds: ["job"], tz: "Europe/London",
    stored: { ...STORED_SCHEMA, functions: [{ name: "sweep_holds", args: "", returns: "json", internal: true }] },
    answers: { job: { job: [{ name: "nightly_sweep", fn: "sweep_holds", everyMinutes: 1440, at: "23:00" }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE CROSSING — the job designer was told which functions it MAY run. Only
  // an INTERNAL function qualifies, which is the engine's own rule and is why
  // that list is `jobFns` rather than `functions`.
  const jb = promptFor(r, "job");
  assert.ok(jb, "the job designer was never called");
  assert.match(jb.text, /sweep_holds/, "the job designer was not told it may run the site's own internal function");

  // IT SURVIVED — the row the cron really selects carries the stored
  // function's name, the clock time and the browser's own zone.
  const row = r.registered.find((x) => x.name === "nightly_sweep");
  assert.ok(row, "the job was dropped by the normaliser: " + JSON.stringify(r.registered));
  assert.equal(row.spec.fn, "sweep_holds", "the job lost the function it runs");
  assert.equal(row.spec.at, "23:00", "the job lost its clock time");
  assert.equal(row.spec.tz, "Europe/London", "the job lost the owner's zone");
  assert.equal(row.spec.on, undefined, "a nightly job was registered as one-time");

  // PAGELESS — a job changes no page, so nothing was compiled. `getContainer`
  // throws by default in this fixture, so reaching one is an error rather than
  // a silent extra, and that is what makes this assertion worth making.
  assert.deepEqual(r.compiles, [], "a job-only change compiled something");
  assert.equal(r.body.jobErrors, undefined, "the job was reported as failing: " + JSON.stringify(r.body.jobErrors));
});

test("COMPLETE REQUEST 3 — a connection's declared response shape reaches the page writer", async () => {
  // *"Show the live tide times on the home page, from tides.example."*
  //
  // THIS IS THE TIER THAT COULD NOT BE WRITTEN AT ALL. `useApi<T = unknown>`
  // means a page either declares its own `T` — a guess about a third party's
  // JSON, from a model that has never seen a response — or leaves it unstated;
  // and an INVENTED type typechecks clean while the page renders "". So the
  // declared shape reaching the writer IS the feature, and it crosses from the
  // `api` designer to the page call.
  // ⚠ `api` ALONE, AND THAT IS THE PRODUCT BEING RIGHT. A connection exists to
  // be READ by a page, so the route is never pageless for one — it writes a
  // page whether or not the customer asked for a new route. Adding a `page`
  // kind here aimed at `/` is a request to ADD a page the site already has,
  // which `cleanAdd` correctly refuses `no-path`; the first draft of this case
  // did exactly that and reported the tier broken.
  // ⚠ AND THE WRITER RETURNS THE HOME PAGE **PLUS** THE TIDE TABLE, not a
  // rewrite of it. `keptProse` refuses a change that loses a word the page
  // already said, which is the wall that makes "an addition only ADDS" real —
  // and the fixture's default `write_pages` answer is a different home page
  // entirely, so a case that takes it is refused `rewrote` before anything
  // about connections is reached. That refusal is the product being correct;
  // taking the default here would have reported it as this tier failing.
  const r = await addon("fw-cr3", "show the live tide times on the home page, from tides.example", {
    kinds: ["api"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", "<TideTable/>")],
    answers: {
      api: { api: [{
        name: "tides", url: "https://tides.example/v1/today?port={{PORT}}&key={{TIDES_KEY}}", method: "GET",
        params: [{ name: "port", type: "string", required: true, description: "the harbour code" }],
        returns: { times: [{ time: "string", height: "number" }] },
        credential: { name: "TIDES_KEY", service: "Tides Example", signup: "https://tides.example/signup" },
      }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE CROSSING — the page WRITER (not the designer) is handed the shape, as
  // something it can declare rather than a sketch it has to interpret, plus
  // which parameter it must supply.
  const pw = pagePrompt(r);
  assert.ok(pw, "the page writer was never called");
  assert.match(pw.text, /tides/, "the page writer was not told the connection exists");
  assert.match(pw.text, /height/, "the page writer was not told the answer's own field names");
  assert.match(pw.text, /port/, "the page writer was not told which parameter the connection needs");

  // IT IS STORED WHOLE, so the next change reads it back rather than
  // re-deriving it from nothing.
  const api = (r.meta().apis || []).find((a) => a.name === "tides");
  assert.ok(api, "the connection was not stored: " + JSON.stringify(r.meta().apis));
  assert.ok(api.returns, "the stored connection lost its declared response shape");

  // AND THE OWNER IS TOLD WHICH SECRET IT NEEDS. Where to GET one is the
  // provenance half; where to PUT it was already wired.
  assert.match(JSON.stringify(r.body), /TIDES_KEY/, "the owner is not told which secret the connection needs");
});

test("COMPLETE REQUEST 4 — a page, a component on it, and a QR code pointing at it, in one message", async () => {
  // *"Add a /tour page with the workshop video on it, and a QR code that opens
  // it."*
  //
  // THREE KINDS WHOSE DESTINATION IS A ROUTE THIS SAME CHANGE IS ADDING. Until
  // 2026-09-17 a component aimed at a page being added in the same message was
  // silently built on the FRONT page and reported as done, and a QR aimed at
  // one was refused `no-such-page`. `site.planned` is what makes both legal;
  // the QR withholding is what keeps it honest, because a printed code
  // pointing at a page that did not survive is dropped whole. THIS IS THE
  // POSITIVE HALF — the page ships, so the code ships with it.
  const r = await addon("fw-cr4", "add a /tour page with the workshop video on it, and a QR code that opens it", {
    kinds: ["page", "component", "qr"], publishes: true, sitePages: ["/"],
    written: [addedTo("/", '<Link to="/tour">The tour</Link>'), writtenPage("/tour")],
    answers: {
      page: { page: [{ path: "/tour", name: "The tour", purpose: "show the workshop video", sections: ["the video"], components: ["video-embed"] }] },
      component: { component: [{ page: "/tour", does: "play the workshop video", components: ["video-embed"] }] },
      qr: { qr: { name: "tour", points: "/tour", label: "Watch the workshop tour" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));

  // THE CROSSING, IN BOTH LATER DESIGNERS — each was told `/tour` is coming
  // AND that there is no source to read for it, which is the half that stops a
  // designer asked to copy a like section going looking for a file.
  for (const kind of ["component", "qr"]) {
    const p = promptFor(r, kind);
    assert.ok(p, "the " + kind + " designer was never called");
    assert.match(p.text, /This same change is ALSO adding/,
      "the " + kind + " designer was not told about the page being added in the same message");
    assert.match(p.text, /\/tour/, "the " + kind + " designer was not told which page is coming");
  }

  // THE PAGE SHIPPED, so nothing was withheld and the code is kept.
  assert.deepEqual(r.body.added, ["tour.tsx"], JSON.stringify(r.body.added));
  assert.ok(compiledPages(r).some((p) => /tour/.test(p.path)), "the new page never reached the compiler");
  assert.equal(r.body.heldPages, undefined, "a page was withheld on a request where everything arrived");
  assert.equal(r.body.droppedQrs, undefined, "a code whose page shipped was dropped");

  // THE CODE IS STORED AGAINST THE SITE, opening the route this change added.
  const codes = storedLook(r, "fw-cr4").qr || [];
  const tour = codes.find((c) => c && c.name === "tour");
  assert.ok(tour, "the QR code was not stored: " + JSON.stringify(codes));
  assert.match(tour.points, /\/tour$/, "the stored code does not open the page this change added: " + tour.points);
});

/* ═══════════════════════════════════════════════════════════════════════════
   A COMPONENT IS WHERE A PAGE PUTS IT (2026-09-20)

   Owner: *"replacing aMerge.parts with the actual parts list is insufficient.
   Independently driven through the route, that change still reports the
   component's photograph missing. imageSources gives it
   src/routes/-parts/photo-wall.tsx, which the reporting code interprets as
   /-parts/photo-wall rather than the /gallery route using it. Fix the
   file-to-page association as well as the missing component input."*

   REPRODUCED BEFORE EITHER HALF: `mergeAddonPages` answers no `parts` key at
   all, so the post-publish readers saw the page half of the site and nothing
   else; and with that handed in, `routeOf` on a component's path answers a
   pseudo-route no visitor can open. Both are measured in the module guard.

   `routedSources` IS THE ONE ANSWER TO BOTH, and the cases below are what stop
   "somewhere on the site" standing in for "on the page that was asked about".
   ═════════════════════════════════════════════════════════════════════════ */

/** The gallery page as a writer returns it when the picture lives in a band. */
const galleryUsing = (part) => ({
  path: "src/routes/gallery.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { Band } from '@/routes/-parts/" + part + "'\n"
    + "export const Route = createFileRoute('/gallery')({ component: P })\n"
    + "function P(){ return <main><h1>Gallery</h1><Band /></main> }\n",
});
/** A component holding a picture token, optionally importing a sibling. */
const bandWith = (name, body, imports) => ({
  name,
  source: "import { SafeImage } from '@/components/ui/safe-image'\n"
    + (imports ? "import { Inner } from './" + imports + "'\n" : "")
    + "export function Band(){ return <section>" + body
    + (imports ? "<Inner />" : "") + "</section> }\n",
});
const TOKEN = (d) => '<SafeImage src="@@IMG:' + d + '@@" alt="the workshop bench" />';

test("a photograph in a COMPONENT is on the page that renders it — direct, nested, and the two controls", async () => {
  const NEED = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const ECHO = { need: NEED.need, status: "covered", by: "a photograph of the bench on /gallery",
    answers: "page#0", kind: "photo", item: "/gallery" };
  const shot = [{ page: "/gallery", describe: BENCH, name: "bench" }];
  const run = (slug, written, writtenParts, need = NEED, echo = ECHO) => photoAsk(slug, {
    kinds: ["page", "photo"], credits: 400, written, writtenParts,
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [need] },
      photo: { photo: shot, requirements: [echo] },
    },
  });

  // ── (1) DIRECT: the page imports the band, the band holds the picture ────
  const direct = await run("fw-part-direct", [galleryUsing("photo-wall")],
    [bandWith("photo-wall", TOKEN(BENCH))]);
  assert.equal(direct.body.ok, true, JSON.stringify(direct.body));
  // THE PRECONDITIONS, or this case is about a step that did nothing: the
  // picture was really paid for, and it really reached the COMPONENT's file.
  assert.equal(direct.shots.length, 1, "no photograph was bought: " + JSON.stringify(direct.shots));
  assert.equal(direct.body.pictures, 1, "no picture reached the site: " + JSON.stringify(direct.body));
  const wall = storedParts(direct, "fw-part-direct")["photo-wall"] || "";
  assert.match(wall, /src="\/u\/fw-part-direct\/[0-9a-f]{32}\.[a-z]+"/,
    "the bought url is not in the published component: " + wall);
  assert.ok(!/@@IMG:/.test(wall), "the token shipped unswept: " + wall);
  // …AND THE REPORTING FOLLOWED IT THERE. This is the defect: before the fix
  // the same run answered `missing` and told the customer it was still to do.
  const dcov = storedAnswer(direct, "fw-part-direct").coverage.requirements;
  const dh = dcov.find((x) => x.status === "elsewhere");
  assert.equal(dh.state, "configured", "a picture in a component did not answer its request: " + JSON.stringify(dh));
  assert.equal(dh.reconciledItem, "/gallery", "the placement recorded is not the page that renders it: " + JSON.stringify(dh));
  assert.ok(!/Still to do/.test(direct.body.coverNote || ""),
    "the customer was told a published, billed photograph is outstanding: " + direct.body.coverNote);
  for (const e of dcov) assert.notEqual(e.state, "delivered", "a claim was delivered with nothing checked: " + JSON.stringify(e));

  // ── (1b) THE SAME PICTURE, NAMED AS THE REQUEST RATHER THAN THE ROUTE ────
  //
  // ⚠ A SWEEP SURVIVOR IS WHY THIS EXISTS, and the two identities go through
  // two different readers. `item: "/gallery"` above resolves against the ROUTE
  // list, which the purchase reader fills; `item: "bench"` resolves against
  // the per-SHOT list, which only the request-to-photograph reader fills — so
  // with that one taking a component's file path back, everything above still
  // passed and *"this particular picture landed on the page it was asked
  // for"* was unguarded. That is the claim the owner's "retain
  // request-to-photograph identity" is about.
  const named = await run("fw-part-named", [galleryUsing("photo-wall")],
    [bandWith("photo-wall", TOKEN(BENCH))],
    { ...NEED, item: "bench" }, { ...ECHO, item: "bench" });
  assert.equal(named.body.pictures, 1, "the picture was not bought: " + JSON.stringify(named.body));
  const nmh = storedAnswer(named, "fw-part-named").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(nmh.state, "configured", "the shot's own name did not answer its request: " + JSON.stringify(nmh));
  assert.equal(nmh.reconciledItem, "bench", "the request was settled by something other than its own picture: " + JSON.stringify(nmh));

  // ── (2) NESTED: page → band → inner band, and the picture is in the inner
  // one. A reader that walked a single level reports this lost.
  const nested = await run("fw-part-nested", [galleryUsing("photo-wall")],
    [bandWith("photo-wall", "", "photo-frame"), bandWith("photo-frame", TOKEN(BENCH))]);
  assert.equal(nested.body.ok, true, JSON.stringify(nested.body));
  assert.equal(nested.body.pictures, 1, "no picture reached the site: " + JSON.stringify(nested.body));
  const inner = storedParts(nested, "fw-part-nested")["photo-frame"] || "";
  assert.match(inner, /src="\/u\/fw-part-nested\//, "the url is not in the nested component: " + inner);
  const nh = storedAnswer(nested, "fw-part-nested").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(nh.state, "configured", "a picture one component deeper was not associated: " + JSON.stringify(nh));

  // ── (3) CONTROL — AN UNUSED COMPONENT IS ON NO PAGE. Same picture, same
  // request; the band ships but the page never imports it, so a visitor sees
  // nothing. "Somewhere in the site" must not settle a claim about /gallery.
  const unused = await run("fw-part-unused", [galleryWith("<p>no pictures here</p>")],
    [bandWith("photo-wall", TOKEN(BENCH))]);
  assert.equal(unused.body.ok, true, JSON.stringify(unused.body));
  assert.equal(unused.body.pictures, 1,
    "the picture was not bought, so this control proves nothing: " + JSON.stringify(unused.body));
  assert.match(storedParts(unused, "fw-part-unused")["photo-wall"] || "", /src="\/u\/fw-part-unused\//,
    "the control needs the url really in the orphan component");
  const uh = storedAnswer(unused, "fw-part-unused").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.notEqual(uh.state, "configured",
    "a picture in a component nothing imports settled a claim about a page: " + JSON.stringify(uh));

  // ── (4) CONTROL — THE WRONG PAGE. The band is rendered, by /about. A claim
  // about /gallery may not be answered by a picture on another route.
  const elsewhere = await photoAsk("fw-part-wrong", {
    kinds: ["page", "photo"], credits: 400,
    sitePages: ["/", "/about"],
    written: [galleryWith("<p>no pictures here</p>"), { path: "src/routes/about.tsx",
      source: "import { createFileRoute } from '@tanstack/react-router'\n"
        + "import { Band } from '@/routes/-parts/photo-wall'\n"
        + "export const Route = createFileRoute('/about')({ component: P })\n"
        + "function P(){ return <main><h1>About</h1><Band /></main> }\n" }],
    writtenParts: [bandWith("photo-wall", TOKEN(BENCH))],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [NEED] },
      photo: { photo: shot, requirements: [ECHO] },
    },
  });
  assert.equal(elsewhere.body.pictures, 1,
    "the picture was not bought, so this control proves nothing: " + JSON.stringify(elsewhere.body));
  const eh = storedAnswer(elsewhere, "fw-part-wrong").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.notEqual(eh.state, "configured",
    "a picture rendered only by /about settled a claim about /gallery: " + JSON.stringify(eh));
});

test("a scene inside a component is on the page that renders it, so a true claim is not contradicted", async () => {
  // THE SAME ASSOCIATION ONE FIELD OVER. `aThreeOn` mapped a component's path
  // through `routeOf` too, so a `<Canvas>` in a band published and
  // `appliedFacts` emitted `three` with `fails: ["onpage"]` — a TRUE claim
  // recorded as contradicted, which is the worst-shaped answer available.
  const CANVAS = "import { Canvas } from '@react-three/fiber'\n";
  const scene = { name: "scene-band", source: CANVAS + "export function Band(){ return <Canvas><mesh /></Canvas> }\n" };
  const r = await addon("fw-three-part", "put a 3d scene in a band on the gallery page", {
    publishes: true, kinds: ["three"],
    written: [galleryUsing("scene-band")],
    writtenParts: [scene],
    answers: { three: { three: { scene: "a slowly turning cube" },
      // THE CLAIM CARRIES THE ITEM'S NAME AND THE ENGINE'S OWN TOKEN, and both
      // halves are load-bearing. `claimEvidence` reads no token at all until
      // the item's own NAME is in the text — which is why the photo cases
      // above work (a photograph's name IS its route, and their `by` names it)
      // and why the first draft of this one resolved against nothing whatever
      // the code did. `appliedFacts` then puts
      // `onpage` in a scene's `holds` when a page really draws the canvas and
      // in its `fails` when nothing does — so the SAME word flips sides with
      // the association, and `claimEvidence` asks `fails` FIRST. A claim worded
      // "on the gallery page" in prose matches neither list and would pass with
      // the fix deleted; measured, and that is what the first draft of this
      // case did.
      //
      // TWO CLAIMS, BECAUSE THE TWO HALVES OF THE DEFECT SHOW UP DIFFERENTLY.
      // The first carries `onpage`, which flips sides when the parts list is
      // missing — `holds` with the association, `fails` without it, and
      // `claimEvidence` asks `fails` FIRST, so a TRUE claim is recorded as
      // CONTRADICTED. The second carries the ROUTE and nothing else, which is
      // what catches the file-path half: with a component's path used as its
      // route, `holds` carries `/-parts/scene-band` and a claim about
      // `/gallery` resolves against nothing. Each half red-checked on its own.
      requirements: [
        { need: "The gallery page shows the 3D scene.", status: "covered", kind: "three", item: "three", by: "the three scene is declared and onpage" },
        { need: "The scene is on the gallery page.", status: "covered", kind: "three", item: "three", by: "three is drawn on /gallery" },
      ] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const cov = storedAnswer(r, "fw-three-part").coverage.requirements;
  const c = cov[0];
  assert.notEqual(c.state, "failed", "a scene really on the page was contradicted: " + JSON.stringify(c));
  assert.equal(c.contradictedBy, undefined,
    "a canvas in a component read as a scene that is not on any page: " + JSON.stringify(c));
  assert.equal(c.state, "configured", "a canvas in a component did not read as the scene being on the page: " + JSON.stringify(c));
  // MEASURED BOTH WAYS at the module: with the association the same claim
  // answers `{token:"declared", kind:"config"}` and without it
  // `{token:"onpage", kind:"contradicted"}` — so this pair of assertions is the
  // defect and its fix, not a restatement of one answer.
  assert.ok(String(c.configuredBy || ""), "nothing was read back for a scene really on the page: " + JSON.stringify(c));
  // …AND THE SECOND CLAIM, WHICH ONLY THE ROUTE CAN ANSWER.
  const c2 = cov[1];
  assert.equal(c2.state, "configured",
    "the route the scene is really drawn on was not among its applied facts: " + JSON.stringify(c2));
  assert.match(String(c2.configuredBy || ""), /\/gallery/,
    "a component's own file path stood in for the page that renders it: " + JSON.stringify(c2));
  for (const e of cov) assert.notEqual(e.state, "delivered", "a claim was delivered with nothing checked: " + JSON.stringify(e));
});

/* ═══════════════════════════════════════════════════════════════════════════
   AN IMPORT IS NOT A PLACEMENT (2026-09-20)

   Owner: *"importsPart matches commented-out imports, and routedSources treats
   an unused import as placement. Both reproduce through the addon route: the
   photograph exists in the component file, the gallery never renders it, yet
   coverage becomes configured. Exclude comments and quoted examples from import
   evidence. An unused import must not establish placement. Where placement
   cannot be established, preserve uncertainty."*

   REPRODUCED THROUGH THIS ROUTE ON ALL FOUR SHAPES BEFORE ANYTHING MOVED —
   each one answered `state: configured`, `implementation: found`,
   `reconciledItem: "/gallery"` and *"I've set that up"*, byte for byte what
   the RENDERED control answered.
   ═════════════════════════════════════════════════════════════════════════ */

/** The gallery page with a head of its own and a body that may or may not draw the band. */
const galleryHead = (head, draws) => ({
  path: "src/routes/gallery.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n" + head + "\n"
    + "export const Route = createFileRoute('/gallery')({ component: P })\n"
    + "function P(){ return <main><h1>Gallery</h1>" + (draws || "") + "</main> }\n",
});

test("a commented-out, quoted or unused import does not put a component's photograph on the page", async () => {
  const NEED = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const ECHO = { need: NEED.need, status: "covered", by: "a photograph of the bench on /gallery",
    answers: "page#0", kind: "photo", item: "/gallery" };
  const LIVE = "import { Band } from '@/routes/-parts/photo-wall'";
  const run = (slug, head, draws) => photoAsk(slug, {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryHead(head, draws)],
    writtenParts: [bandWith("photo-wall", TOKEN(BENCH))],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [NEED] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [ECHO] },
    },
  });
  const held = (r, slug) => storedAnswer(r, slug).coverage.requirements.find((x) => x.status === "elsewhere");

  // ── THE CONTROL FIRST, so every arm below is measured against a run that
  // differs from it in ONE way. It must go on answering exactly as it did.
  const ok = await run("fw-use-live", LIVE, "<Band />");
  assert.equal(ok.body.pictures, 1, "the control bought no picture, so it proves nothing: " + JSON.stringify(ok.body));
  assert.equal(held(ok, "fw-use-live").state, "configured",
    "a rendered component stopped answering its request: " + JSON.stringify(held(ok, "fw-use-live")));

  // ── THE FOUR SHAPES. Each publishes the picture into the component's file —
  // asserted, or the case is about a step that bought nothing — and each must
  // fail to answer a claim about the page that does not draw it.
  for (const [what, head, draws] of [
    ["a line-commented import", "// " + LIVE, ""],
    ["a block-commented import", "/* " + LIVE + " */", ""],
    ["a quoted example", "const hint = \"" + LIVE.replace(/'/g, "\\'") + "\"", "{hint}"],
    ["an import nothing renders", LIVE, ""],
  ]) {
    const slug = "fw-use-" + what.replace(/[^a-z]+/gi, "").toLowerCase().slice(0, 12);
    const r = await run(slug, head, draws);
    assert.equal(r.body.ok, true, what + ": " + JSON.stringify(r.body));
    assert.equal(r.body.pictures, 1, what + " bought no picture, so the case proves nothing: " + JSON.stringify(r.body));
    assert.match(storedParts(r, slug)["photo-wall"] || "", new RegExp('src="/u/' + slug + '/'),
      what + ": the url is not in the component, so there is nothing to mis-place");
    const h = held(r, slug);
    assert.notEqual(h.state, "configured", what + " established a placement: " + JSON.stringify(h));
    assert.notEqual(h.implementation, "found", what + " answered the request: " + JSON.stringify(h));
    assert.doesNotMatch(r.body.coverNote || "", /I've set that up/,
      what + " told the customer the picture is on the page: " + r.body.coverNote);
    // …AND THE BROWSER'S OWN SCREEN SAYS THE SAME, composed by `addonAnswer`
    // rather than by this file: the reply is what a person reads.
    assert.doesNotMatch(browserText(r.body), /I've set that up/,
      what + ": the customer's screen claimed the picture is placed");
  }
});

test("a placement nobody could establish is uncertainty, not an absence", async () => {
  // Owner: *"Where placement cannot be established, preserve uncertainty."*
  // The page imports the band and hands the BINDING to something else — which
  // really can reach the page by a route no reader of the source can follow.
  // Neither `configured` (a claim) nor `missing` ("Still to do", a claim the
  // other way): `unknown` is the one honest answer, and its own sentence
  // invites the look rather than the re-ask.
  const NEED = { need: "The gallery page shows a photograph of the workshop.", status: "elsewhere", step: "photo", item: "/gallery" };
  const ECHO = { need: NEED.need, status: "covered", by: "a photograph of the bench on /gallery",
    answers: "page#0", kind: "photo", item: "/gallery" };
  const r = await photoAsk("fw-use-maybe", {
    kinds: ["page", "photo"], credits: 400,
    written: [galleryHead("import { Band } from '@/routes/-parts/photo-wall'\nconst bands = [Band]",
      "{bands.map((B, i) => <B key={i} />)}")],
    writtenParts: [bandWith("photo-wall", TOKEN(BENCH))],
    answers: {
      page: { page: [PHOTO_PAGE], requirements: [NEED] },
      photo: { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }], requirements: [ECHO] },
    },
  });
  assert.equal(r.body.pictures, 1, "no picture was bought: " + JSON.stringify(r.body));
  const h = storedAnswer(r, "fw-use-maybe").coverage.requirements.find((x) => x.status === "elsewhere");
  assert.equal(h.state, "unknown", "an unfollowable use was answered rather than left open: " + JSON.stringify(h));
  const said = browserText(r.body);
  assert.doesNotMatch(said, /I've set that up/, "the customer was told a placement nobody established: " + said);
  assert.doesNotMatch(said, /Still to do/, "the customer was told a published picture is missing: " + said);
  assert.match(said, /can't see from here whether/, "the uncertainty had no sentence: " + said);
});

test("a scene whose placement could not be established is not contradicted", async () => {
  // THE SAME THIRD ANSWER ONE FIELD OVER, and here the old reading was the
  // worst-shaped one available: `appliedFacts` has two words for a scene, so a
  // canvas in a component the page merely holds a reference to was recorded as
  // `fails: ["onpage"]` — a CONTRADICTION over evidence that establishes
  // nothing. The CONTROL is the rendered case above, which stays `configured`.
  const CANVAS = "import { Canvas } from '@react-three/fiber'\n";
  const r = await addon("fw-three-maybe", "put a 3d scene in a band on the gallery page", {
    publishes: true, kinds: ["three"],
    written: [galleryHead("import { Band } from '@/routes/-parts/scene-band'\nconst bands = [Band]",
      "{bands.map((B, i) => <B key={i} />)}")],
    writtenParts: [{ name: "scene-band", source: CANVAS + "export function Band(){ return <Canvas><mesh /></Canvas> }\n" }],
    answers: { three: { three: { scene: "a slowly turning cube" }, requirements: [
      { need: "The gallery page shows the 3D scene.", status: "covered", kind: "three", item: "three", by: "the three scene is declared and onpage" },
    ] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const c = storedAnswer(r, "fw-three-maybe").coverage.requirements[0];
  assert.equal(c.contradictedBy, undefined,
    "a scene nobody could place was recorded as contradicted: " + JSON.stringify(c));
  assert.notEqual(c.state, "failed", "an unestablished placement was read as a failure: " + JSON.stringify(c));
});

/* ═══════════════════════════════════════════════════════════════════════════
   A PARTIAL OUTCOME IS SAID (2026-09-20)

   Owner: *"a component answer containing a valid welcome-card and a tide-chart
   with empty does returns droppedFields naming tide-chart, but the actual
   browser reply is only 'Done — updated /.' Carry this partial outcome into a
   plain customer sentence and preserve the dropped-item diagnostic in the
   stored outcome."*

   REPRODUCED ON EXACTLY THAT ANSWER: `droppedFields:
   [{what:"component",name:"tide-chart"}]`, `coverNote: ""`, the stored record
   carrying no such field at all, and the browser's own composer drawing
   **"✅ Done — updated /."**
   ═════════════════════════════════════════════════════════════════════════ */

test("a component answer whose second part was dropped says so, and the record keeps its name", async () => {
  const two = (second) => ({ component: { component: [{
    page: "/", does: "a welcome card and a tide chart",
    tsx: [
      { name: "welcome-card", does: "greets the visitor", props: "name: string" },
      second,
    ],
  }] } });
  const r = await addon("fw-part-drop", "add a welcome card and a tide chart", {
    kinds: ["component"], publishes: true,
    answers: two({ name: "tide-chart", does: "", props: "rows: number[]" }),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // THE PRECONDITION: the step really did build one of the two and lose the
  // other, or this case is about a run where nothing was dropped.
  assert.deepEqual(r.body.droppedFields, [{ what: "component", name: "tide-chart" }],
    "the drop is not on the reply, so there is nothing to carry: " + JSON.stringify(r.body.droppedFields));
  assert.deepEqual(r.body.changed, ["index.tsx"], "the change did not land: " + JSON.stringify(r.body));

  // 1. THE CUSTOMER'S OWN SCREEN, composed by the browser and not by this file.
  const said = browserText(r.body);
  assert.match(said, /Part of that didn't get built/, "the partial outcome is not on the screen: " + said);
  assert.match(said, /1 section/, "the screen does not say how much was lost: " + said);
  assert.doesNotMatch(said, /tide-chart/,
    "a file name the DESIGNER coined reached the customer: " + said);
  // …AND IT IS STILL A SUCCESS, because it is: one of the two was built, the
  // page changed and the run was charged. A partial outcome is not a failure.
  assert.match(said, /✅ Done/, "a partial outcome was reported as a failed change: " + said);

  // 2. THE STORED OUTCOME KEEPS THE NAME, which is what a developer comes back
  // to and is exactly what the customer's sentence deliberately omits.
  const rec = storedAnswer(r, "fw-part-drop").coverage;
  assert.deepEqual(rec.droppedFields, [{ what: "component", name: "tide-chart" }],
    "the diagnostic did not survive into the record: " + JSON.stringify(rec.droppedFields));

  // 3. THE CONTROL — the same ask with both parts whole. No clause, no record
  // entry, and the reply byte for byte what it has always been.
  const ok = await addon("fw-part-whole", "add a welcome card and a tide chart", {
    kinds: ["component"], publishes: true,
    answers: two({ name: "tide-chart", does: "draws the day's tides", props: "rows: number[]" }),
  });
  assert.equal(ok.body.droppedFields, undefined, "nothing was dropped and something was reported");
  assert.doesNotMatch(browserText(ok.body), /didn't get built/,
    "a complete change told the customer part of it was lost: " + browserText(ok.body));
  assert.deepEqual(storedAnswer(ok, "fw-part-whole").coverage.droppedFields, [],
    "a complete change left a drop on the record");
});

/* ═══════════════════════════════════════════════════════════════════════════
   A NAMED DESTINATION THAT CANNOT RESOLVE IS REFUSED (2026-09-20)

   Owner: *"For QR/three placement, reject explicitly named destinations that
   cannot resolve instead of substituting the homepage. Keep omitted optional
   placement separate from an invalid explicit route."*

   REPRODUCED ON A THREE-PAGE SITE: `component` and `photo` refused `no-page`
   and `qr` and `three` stored `page: ""`, which `at()` renders as *"the home
   page (index.tsx)"* — so a printed code and a 3D scene were built on the front
   page and reported as done. The owner's own correction of exactly this for
   `component` sits four lines above the two branches that still did it.
   ═════════════════════════════════════════════════════════════════════════ */

test("a QR code and a scene named for a page the site has not got are refused, not moved to the home page", async () => {
  const SITE3 = ["/", "/about", "/prices"];
  for (const [kind, answer] of [
    ["qr", { qr: { name: "gallery", points: "/about", label: "Our gallery", page: "/nowhere" } }],
    ["three", { three: { scene: "a slowly turning loaf", page: "/nowhere" } }],
  ]) {
    const r = await addon("fw-place-" + kind, "put it on the nowhere page", {
      kinds: [kind], sitePages: SITE3, answers: { [kind]: answer },
    });
    // ⚠ THE REASON, NOT THE COLOUR — and this case was VACUOUS until it said
    // so. Against the pre-change product both of these already answered
    // `ok: false`, because the fixture's default page loses the stored words
    // and `keptProse` refuses `rewrote` further down; "the customer was told
    // about a page" then matched *"the home page"* inside THAT sentence. A
    // negative outcome is only evidence when the case names its mechanism.
    assert.equal(r.status, 422, kind + " was accepted for a page the site has not got: " + JSON.stringify(r.body));
    assert.equal(r.body.reason, "no-page", kind + " refused for the wrong reason: " + JSON.stringify(r.body));
    assert.equal(r.body.cost, 0, kind + " charged for a refusal: " + JSON.stringify(r.body));
    assert.match(String(r.body.msg || ""), /which page/, "the customer was not told which half was wrong: " + r.body.msg);
    // AND IT IS REFUSED AT THE CLEANER, one hop before anything is composed:
    // the page writer is never asked, so no directive naming the home page can
    // exist to be acted on.
    assert.equal(pagePrompt(r), undefined, "the page writer was asked about a destination that cannot resolve");
    // NOTHING IS STORED. A refusal that left the code or the scene in the look
    // would be the substitution arriving one write later.
    const look = storedLook(r, "fw-place-" + kind) || {};
    assert.ok(!(look.qr || []).length, "a refused code was stored: " + JSON.stringify(look.qr));
    assert.equal(look.three, undefined, "a refused scene was stored: " + JSON.stringify(look.three));
  }

  // ── CONTROL 1 — AN OMITTED OPTIONAL PLACEMENT IS A REAL ANSWER and stays
  // one. This is the half that must NOT move: "wherever it fits" is what the
  // page call is for, and refusing it would take a working capability away.
  //
  // ⚠ `written` IS NOT DECORATION ON A PUBLISHING CASE. The fixture's default
  // `write_pages` answer is the home page rewritten in ITS words, so against a
  // real stored page it loses "Words for index." and `keptProse` refuses the
  // whole change `rewrote` — a case that never reaches the thing it is about.
  const open = await addon("fw-place-open", "add a QR code for the about page", {
    kinds: ["qr"], sitePages: SITE3, publishes: true,
    written: [addedTo("/", "<p>Scan for our gallery.</p>")],
    answers: { qr: { qr: { name: "gallery", points: "/about", label: "Our gallery" } } },
  });
  assert.equal(open.body.ok, true, "an unplaced code was refused: " + JSON.stringify(open.body));
  const code = (storedLook(open, "fw-place-open").qr || []).find((c) => c && c.name === "gallery");
  assert.ok(code, "the code was not stored: " + JSON.stringify(storedLook(open, "fw-place-open").qr));

  // ── CONTROL 2 — A PAGE THE SITE REALLY HAS still resolves, so this is about
  // the route being unresolvable and not about placement being refused at all.
  //
  // ⚠ ASSERTED ON THE DIRECTIVE, NOT ON THE STORED LOOK, because `page` is
  // never stored: the addon's own writer rebuilds a code as `{name, points,
  // label}` (`site-add.mjs`'s `designed.qr`), and that is right — a placement
  // is an instruction to the page writer, and once the page is written the
  // binding is IN the page. So the observable is the directive, which is also
  // exactly where the defect showed: `at("")` renders "the home page".
  const named = await addon("fw-place-named", "add a QR code on the prices page", {
    kinds: ["qr"], sitePages: SITE3, publishes: true,
    written: [addedTo("/prices", "<p>Scan for our gallery.</p>")],
    answers: { qr: { qr: { name: "gallery", points: "/about", label: "Our gallery", page: "/prices" } } },
  });
  assert.equal(named.body.ok, true, "a code named for a real page was refused: " + JSON.stringify(named.body));
  const placed = (storedLook(named, "fw-place-named").qr || []).find((c) => c && c.name === "gallery");
  assert.ok(placed, "a code named for a real page was not stored: " + JSON.stringify(storedLook(named, "fw-place-named").qr));
  const toldNamed = String((pagePrompt(named) || {}).text || "");
  assert.match(toldNamed, /SITE_QRS\.gallery[^\n]*on \/prices \(prices\.tsx\)/,
    "a named page the site HAS stopped reaching the page writer: " + toldNamed.slice(0, 600));
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE SAME DESTINATION, SPELLED TWO WAYS, GETS ONE ANSWER (2026-09-20)

   Owner: *"For QR destinations, validate same-origin full URLs consistently
   with relative routes, including planned pages. Preserve valid external URLs
   and non-page payloads."*
   ═════════════════════════════════════════════════════════════════════════ */

test("a full URL at this site's own origin is checked exactly as a bare route is", async () => {
  const SITE3 = ["/", "/about", "/prices"];
  // ⚠ THE SLUG IS A PARAMETER, and a sweep is how that was found. This was
  // `(p) => "https://fw-url.gofarther.app" + p` with the loop below running
  // three DIFFERENT slugs, so two of the three arms were pointing at another
  // site's origin — `ours` false, the whole same-origin branch skipped, and
  // both "controls" silently testing the external-URL case a third control
  // already covers. A same-origin case whose origin is not the site's proves
  // nothing about same-origin.
  const mine = (slug, p) => "https://" + slug + ".gofarther.app" + p;
  // ⚠ THE REFUSAL: the spelling the tool offers FIRST was never checked.
  const dead = await addon("fw-url", "add a QR code for the gallery", {
    kinds: ["qr"], sitePages: SITE3,
    answers: { qr: { qr: { name: "gallery", points: mine("fw-url", "/nope"), label: "Our gallery" } } },
  });
  // ⚠ THE REASON, NOT THE COLOUR. Against the pre-change product this already
  // answered `ok: false` — the fixture's default page loses the stored words
  // and `keptProse` refuses `rewrote` further down — so asserting the refusal
  // alone proved nothing whatever about the destination.
  assert.equal(dead.status, 422, "a printed code pointing at a 404 on our own site was published: " + JSON.stringify(dead.body));
  assert.equal(dead.body.reason, "no-such-page", "refused for the wrong reason: " + JSON.stringify(dead.body));
  assert.equal(dead.body.cost, 0, "a refusal was charged: " + JSON.stringify(dead.body));
  assert.match(String(dead.body.msg || ""), /a page this site doesn't have/, "the customer was not told: " + dead.body.msg);
  // AND IT IS REFUSED AT THE CLEANER: no page is composed, so no drawing and
  // no bake can follow.
  assert.equal(pagePrompt(dead), undefined, "the page writer was asked about a code that opens a 404");
  assert.ok(!((storedLook(dead, "fw-url") || {}).qr || []).length, "the dead code was stored anyway");

  // ── CONTROL — THE SAME ADDRESS THAT DOES RESOLVE, and a page THIS CHANGE is
  // adding counts in both spellings, which is what `going` buys.
  // …AND THE SPELLING IS NORMALISED THE WAY THE RELATIVE BRANCH NORMALISES IT,
  // so a capital or a trailing slash is the same destination rather than one
  // the site has not got.
  for (const [slug, points, extra] of [
    ["fw-url-ok", mine("fw-url-ok", "/about"), { written: [addedTo("/", "<p>Scan for our gallery.</p>")] }],
    ["fw-url-caps", mine("fw-url-caps", "/About/"), { written: [addedTo("/", "<p>Scan for our gallery.</p>")] }],
    ["fw-url-planned", mine("fw-url-planned", "/gallery"), { kinds: ["page", "qr"], written: [writtenPage("/gallery")] }],
  ]) {
    const r = await addon(slug, "add a QR code", {
      kinds: ["qr"], sitePages: SITE3, publishes: true,
      answers: {
        page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a grid"], components: ["card"] }] },
        qr: { qr: { name: "gallery", points, label: "Our gallery" } },
      },
      ...extra,
    });
    assert.equal(r.body.ok, true, points + " was refused: " + JSON.stringify(r.body));
    const c = (storedLook(r, slug).qr || []).find((x) => x && x.name === "gallery");
    assert.equal(c.points, points, "a valid same-origin URL was rewritten: " + JSON.stringify(c));
  }

  // ── CONTROL — WHAT IS NOT OURS IS NOT OURS TO VALIDATE. An external site's
  // URL and the non-page payloads all ship exactly as written.
  for (const [n, points] of [["ext", "https://elsewhere.example/nope"], ["ring", "tel:+441142700000"],
                             ["wifi", "WIFI:S=Shop;T=WPA;P=secret;;"], ["mail", "mailto:hi@fw.test"]]) {
    const r = await addon("fw-url-" + n, "add a QR code", {
      kinds: ["qr"], sitePages: SITE3, publishes: true,
      written: [addedTo("/", "<p>Scan me.</p>")],
      answers: { qr: { qr: { name: n, points, label: "Scan me" } } },
    });
    assert.equal(r.body.ok, true, points + " was refused: " + JSON.stringify(r.body));
    const c = (storedLook(r, "fw-url-" + n).qr || []).find((x) => x && x.name === n);
    assert.equal(c.points, points, "a payload that is none of our business was altered: " + JSON.stringify(c));
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   NOTHING REQUESTED IS DISCARDED IN SILENCE (2026-09-20)

   Owner: *"For silent drops, ensure the identified columns, component
   declarations and requirement overflow are either preserved through supported
   normalization or explicitly reported. Do not silently invent replacements or
   discard requested work."*
   ═════════════════════════════════════════════════════════════════════════ */

test("a bare-string column is kept, and what is genuinely unreadable is named", async () => {
  // PRESERVED THROUGH THE ENGINE'S OWN NORMALISATION: `normalizeSchema` gives a
  // column with a name and no type `text` — driven, not read — so the customer
  // gets the column they asked for rather than a report about losing it.
  const r = await addon("fw-cols", "add a table for enquiries", {
    kinds: ["table"], publishes: true, backend: "ready",
    answers: { table: { table: [{ table: { name: "leads", columns: ["who", { name: "email" }, "note", 42] } }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const ddl = (r.sql || []).join("\n");
  for (const col of ["who", "email", "note"]) {
    assert.match(ddl, new RegExp('"' + col + '"'), "a requested column never reached the database: " + col);
  }
  // …AND THE ONE THAT COULD NOT BE READ IS NAMED, developer-facing.
  const dropped = r.body.droppedFields || [];
  assert.ok(dropped.some((d) => d && d.what === "column"),
    "a column that could not be read was discarded in silence: " + JSON.stringify(r.body.droppedFields));
});

test("a component declaration this step cannot use is named rather than binned", async () => {
  const r = await addon("fw-decl", "add a section to the home page", {
    kinds: ["component"], publishes: true,
    answers: { component: { component: [{ page: "/", does: "a tide panel",
      components: ["Hero Section", "not_in_kit", "card"],
      tsx: [{ name: "tide-chart", does: "", props: "none" }] }] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // A KIT NAME THAT IS NOT EVEN A NAME reached none of the three lists before
  // this: `names()` bins anything failing `NAME` before the kit check can see
  // it, so `Hero Section` was as silent as a typo that IS a name.
  const unknown = r.body.unknownComponents || [];
  assert.ok(unknown.includes("hero section"), "a malformed component name was binned in silence: " + JSON.stringify(unknown));
  assert.ok(unknown.includes("not_in_kit"), "the pre-existing unknown-kit report stopped working: " + JSON.stringify(unknown));
  // AND A HAND-WRITTEN COMPONENT MISSING WHAT A PAGE WRITER BUILDS IT FROM.
  // NOT repaired: `does` and `props` are the component, so inventing either is
  // inventing the component.
  const dropped = r.body.droppedFields || [];
  assert.ok(dropped.some((d) => d && d.what === "component" && d.name === "tide-chart"),
    "a binned hand-written component was not named: " + JSON.stringify(dropped));
});
