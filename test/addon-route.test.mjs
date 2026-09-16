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
import { addon, promptFor, storedAnswer, writtenPage, STORED_SCHEMA } from "./fixtures/addon-route.mjs";
import { existingFacts } from "../builder/site-add.mjs";
import { SITE_KINDS, OPAQUE_KINDS } from "../builder/site-requirements.mjs";
// THE REAL EMITTERS AND THE PRODUCT'S OWN READERS, so a catalog fixture below
// is derived from what the engine really emits rather than typed by hand — a
// hand-typed permission is a second copy of the emitter and the two drift.
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { splitPrivileges, readParens } from "../site-schema-recover.mjs";

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
  const r = await addon("fw-unseeable", "add a note under the booking total", {
    kinds: ["function", "component"], publishes: true,
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
