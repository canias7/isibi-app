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
import { addon, promptFor, storedAnswer, STORED_SCHEMA } from "./fixtures/addon-route.mjs";

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

test("a claim naming a guarantee that really holds is delivered, and says nothing", async () => {
  const r = await addon("fw-ev-a", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder runs send_reminder at 09:00 every day"),
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["send_reminder"], "the function was not applied — this case tests nothing");
  assert.equal(r.body.coverNote, "", "a delivered requirement was read back to the customer: " + r.body.coverNote);
});

test("the same claim is unverified when the database refused the function it names", async () => {
  // THE DEFECT, AND IT IS THE OWNER'S OWN EXAMPLE OF IT: the names came off the
  // PROPOSED design, so `send_reminder` counted as created while Postgres was
  // answering a syntax error, and the job's claim read `delivered` on a change
  // that will never run.
  const r = await addon("fw-ev-b", "remind people the day before", {
    kinds: ["function", "job"], answers: claiming("daily_reminder runs send_reminder at 09:00 every day"), fnFail: true,
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, [], "the function was applied — the refusal did not reach the route");
  assert.equal(r.body.functionErrors.length, 1);
  assert.match(r.body.coverNote, /can't confirm from here that customers get a reminder the day before/,
    "a claim resting on a function the database refused was read as delivered");
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
  assert.equal(rec.coverage.counts.delivered, 1, "the stored record still says the claim is unverified");
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
  assert.match(r.body.coverNote, /Still to do: the reminder shows their booking time/,
    "a hand-off nobody could deliver was read as satisfied");
  assert.ok((r.body.requirements || []).some((x) => x.need === "the reminder shows their booking time"),
    "the outstanding requirement is not on the wire");
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
