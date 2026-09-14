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
  assert.equal(priv.body.coverNote, "", "a true claim about an internal function was not read as delivered: " + priv.body.coverNote);

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
  assert.equal(config.body.coverNote, "", "a claim about the stored configuration was not read as delivered: " + config.body.coverNote);
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
