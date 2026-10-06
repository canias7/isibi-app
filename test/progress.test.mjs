// PROGRESS MESSAGES, THE DECISIONS (2026-10-06): `builder/site-progress.mjs`
// driven with literal values — the record and its one writer's rules, the
// milestones' facts, the instructions and the check.
//
// ⚠ WHAT THE CHECK PROVES, AND WHAT IT DOES NOT. The owner: *"do not claim that
// matching says metadata proves the prose truthful … test contradictory prose
// with otherwise valid metadata, and document the remaining model limitation
// without adding keyword-based message filters."* PROSE 1 below is that test:
// an update listing every fact in its true state while its words call the page
// live is ACCEPTED here, because nothing in code reads the words. That is the
// limit, pinned so it cannot be quietly claimed away; what stands against it
// is the instructions (PROSE 2) and the final reply, which says what happened.
import test from "node:test";
import assert from "node:assert/strict";
import {
  progressOn, progressKey, readProgressRecord, openRecord, packRecord, appendMark, closeRecord, pendingMarks, writerNeeded, markAsked,
  claimWriter, holds, batchFor, commitLine, failBatch, releaseWriter, linesOf, jobVerdict,
  editPlanFacts, editPublishFacts, editCorrectFacts, editRepublishFacts, addonPickedFacts, addonDesignedFacts, addonSchemaFacts, addonPagesFacts, addonPublishFacts,
  PROGRESS_STATES, PROGRESS_TOOL, PROGRESS_SYSTEM, progressContext, progressRequest, readProgress, writeProgress,
  PROGRESS_LEASE_MS, PROGRESS_TRIES, PROGRESS_RETRY_MS, PROGRESS_ASK_GRACE_MS, PROGRESS_RETRY_SKEW_MS, PROGRESS_MAX_MARKS, PROGRESS_MAX_TOKENS,
} from "../builder/site-progress.mjs";

const JOB = "ab".repeat(16);
const T0 = 1_800_000_000_000;
const open = (over = {}) => openRecord({ job: JOB, uid: "u-1", slug: "fold-lane-bakery", op: "addon", run: "c_run00001", words: "add a gallery page", picker: "grok", pages: ["/", "/visit"], at: T0, ...over });
const fact = (state, text) => ({ state, text });
const add = (rec, stage, facts, at = T0 + 1000, key) => { const out = appendMark(rec, { stage, facts, at, key }); assert.ok(out.rec, "refused: " + out.refused); return out.rec; };
const answer = (input, stop = "tool_use") => ({ stop_reason: stop, content: [{ type: "tool_use", name: "write_progress", input }], usage: { input_tokens: 100, output_tokens: 20 } });
const states = (facts) => facts.map((f) => f.state);

test("SWITCH — `PROGRESS_REPLIES` = \"on\" and nothing else", () => {
  for (const v of ["on", " ON ", "On"]) assert.equal(progressOn({ PROGRESS_REPLIES: v }), true, JSON.stringify(v));
  for (const v of [undefined, "", "off", "true", "yes", true, 1, null, ["on"]]) assert.equal(progressOn({ PROGRESS_REPLIES: v }), false, JSON.stringify(v));
  assert.equal(progressOn(null), false);
});

test("RECORD 1 — the record lives beside the job's other objects under jobs/, round-trips whole, and one entry that does not read makes it unreadable, never shorter", () => {
  assert.equal(progressKey(JOB), "jobs/" + JOB + ".progress.json");
  const rec = add(add(open(), "picked", [fact("decided", "chose a page"), fact("next", "design it")]), "designed", [fact("designed", "a page /gallery")], T0 + 2000, 1);
  const back = readProgressRecord(JSON.parse(JSON.stringify(packRecord(rec))));
  assert.deepEqual(back, rec);
  const raw = JSON.parse(JSON.stringify(packRecord(rec)));
  raw.marks[1].facts[0].state = "published";
  assert.equal(readProgressRecord(raw), null, "a fact in a state that does not exist was read");
  const raw2 = JSON.parse(JSON.stringify(packRecord(rec)));
  raw2.marks.push({ n: 2, stage: "x", at: "soon", facts: [], state: "pending" });
  assert.equal(readProgressRecord(raw2), null, "a malformed milestone was dropped instead of refusing the record");
  for (const bad of [null, [], "x", { ...raw, v: 2 }, { ...raw, job: ["ab".repeat(16)] }, { ...raw, run: "" }, { ...raw, op: "build" }]) assert.equal(readProgressRecord(bad), null, JSON.stringify(bad).slice(0, 60));
  assert.equal(open({ run: "bad run!" }), null);
  assert.equal(open({ op: "build" }), null);
});

test("RECORD 2 — a milestone's facts get ids from the record's own counter; a milestone written twice (its answer lost) is added once; a closed record and a fact that does not read are refused", () => {
  let rec = add(open(), "picked", [fact("decided", "a"), fact("next", "b")], T0 + 1, 0);
  rec = add(rec, "designed", [fact("designed", "c"), fact("next", "d")], T0 + 2, 1);
  assert.deepEqual(rec.marks.flatMap((m) => m.facts.map((f) => f.id)), ["f1", "f2", "f3", "f4"]);
  const again = appendMark(rec, { stage: "designed", facts: [fact("designed", "c")], at: T0 + 3, key: 1 });
  assert.deepEqual(again, { already: true, n: 1 });
  assert.deepEqual(appendMark(rec, { stage: "x", facts: [], at: T0 }), { refused: "no-facts" });
  assert.deepEqual(appendMark(rec, { stage: "x", facts: [fact("published", "live")], at: T0 }), { refused: "fact" });
  assert.deepEqual(appendMark(rec, { stage: "x", facts: [fact("decided", "  ")], at: T0 }), { refused: "fact" });
  const shut = closeRecord(rec, "ended", T0 + 9);
  assert.deepEqual(appendMark(shut, { stage: "late", facts: [fact("doing", "e")], at: T0 + 10 }), { refused: "closed" });
  // THE GUARD AGAINST A RECORDER CALLED IN A LOOP: refused past it, never cut.
  let full = open();
  for (let i = 0; i < PROGRESS_MAX_MARKS; i++) full = add(full, "m", [fact("decided", "x" + i)], T0 + i, i);
  assert.deepEqual(appendMark(full, { stage: "m", facts: [fact("decided", "one more")], at: T0, key: PROGRESS_MAX_MARKS }), { refused: "full" });
  assert.equal(full.marks.length, PROGRESS_MAX_MARKS, "a full record lost milestones");
});

test("BATCH — the next line covers every waiting milestone's settled facts, and only the LAST one's doing and next: an earlier 'publishing now' is no longer known to be true", () => {
  let rec = add(open(), "pages", [fact("prepared", "wrote /gallery"), fact("next", "publish")], T0 + 1, 0);
  rec = add(rec, "publish", [fact("doing", "publishing")], T0 + 2, 1);
  rec = add(rec, "correct", [fact("doing", "correcting a style")], T0 + 3, 2);
  const b = batchFor(rec);
  assert.deepEqual(b.marks, [0, 1, 2]);
  assert.deepEqual(b.facts.map((f) => f.text), ["wrote /gallery", "correcting a style"]);
  assert.deepEqual(states(b.facts), ["prepared", "doing"]);
});

test("ONE WRITER 1 — asked once: a milestone with nobody on it asks; an ask within the grace waits; a claim answers the ask, so a milestone after the writer lets go asks at once", () => {
  let rec = add(open(), "picked", [fact("decided", "a")], T0, 0);
  assert.equal(writerNeeded(rec, T0), "ask");
  rec = markAsked(rec, T0);
  assert.equal(writerNeeded(rec, T0 + 5000), "wait", "a second writer was asked while the first was on its way");
  assert.equal(writerNeeded(rec, T0 + PROGRESS_ASK_GRACE_MS + 1), "ask", "a lost ask was never asked again");
  const c = claimWriter(rec, "w1", T0 + 1000);
  assert.ok(c.claimed);
  assert.equal(c.rec.asked, 0, "the claim did not answer the ask");
  assert.equal(writerNeeded(c.rec, T0 + 1500), "wait", "a live lease did not keep a second writer out");
  let done = commitLine(c.rec, { owner: "w1", marks: batchFor(c.rec).marks, text: "line one", now: T0 + 2000 });
  done = add(done, "designed", [fact("designed", "b")], T0 + 3000, 1);
  assert.equal(writerNeeded(done, T0 + 3000), "ask", "a milestone after the writer let go waited out an ask already used");
  assert.equal(writerNeeded(closeRecord(done, "ended", T0 + 4000), T0 + 4000), "none");
  assert.equal(writerNeeded(open(), T0), "none", "a record with nothing waiting asked for a writer");
});

test("ONE WRITER 2 — the claim: another writer's live lease refuses it; the writer's own landed claim is its own still; a retry not yet due is refused (two seconds of clock skew allowed)", () => {
  const rec = add(open(), "picked", [fact("decided", "a")], T0, 0);
  const a = claimWriter(rec, "w1", T0);
  assert.equal(claimWriter(a.rec, "w2", T0 + 1000), null);
  assert.equal(holds(a.rec, "w1", T0 + PROGRESS_LEASE_MS - 1), true);
  assert.equal(holds(a.rec, "w1", T0 + PROGRESS_LEASE_MS + 1), false);
  const mine = claimWriter(a.rec, "w1", T0 + 2000);
  assert.ok(mine && mine.claimed, "a claim whose answer was lost was refused to its own writer");
  assert.equal(mine.rec.tries, 1, "re-entering a landed claim counted a second try");
  const expired = claimWriter(a.rec, "w2", T0 + PROGRESS_LEASE_MS + 1);
  assert.ok(expired && expired.claimed, "an expired lease kept the record from a new writer");
  const f = failBatch(a.rec, { owner: "w1", marks: [0], why: "send", now: T0 + 5000 });
  assert.equal(f.retry, true);
  assert.equal(claimWriter(f.rec, "w2", T0 + 5000 + PROGRESS_RETRY_MS - PROGRESS_RETRY_SKEW_MS - 1000), null, "a retry was taken early");
  assert.ok(claimWriter(f.rec, "w2", T0 + 5000 + PROGRESS_RETRY_MS - PROGRESS_RETRY_SKEW_MS + 1), "a retry within the clocks' skew was refused");
});

test("ONE WRITER 3 — tries are counted when claimed: a writer that never commits (its lease ran out) spends one, and once every try is spent what waits is given up with no call", () => {
  let rec = add(open(), "picked", [fact("decided", "a")], T0, 0);
  let t = T0;
  for (let i = 0; i < PROGRESS_TRIES; i++) {
    const c = claimWriter(rec, "w" + i, t);
    assert.ok(c && c.claimed, "try " + (i + 1) + " was not claimed");
    rec = c.rec;
    t += PROGRESS_LEASE_MS + 1;
  }
  const last = claimWriter(rec, "wz", t);
  assert.ok(last && last.gaveUp, "a record whose every try was spent was claimed for another call");
  assert.deepEqual(last.rec.marks.map((m) => [m.state, m.why]), [["failed", "tries"]]);
  assert.equal(last.rec.tries, 0, "the next milestone does not start afresh");
});

test("ONE WRITER 4 — the commit: only the writer that still holds a live lease on an open record commits; the line says its milestones, lets go and starts tries afresh; a milestone recorded after the batch stays waiting", () => {
  let rec = add(open(), "picked", [fact("decided", "a")], T0, 0);
  const c = claimWriter(rec, "w1", T0);
  const batch = batchFor(c.rec);
  rec = add(c.rec, "designed", [fact("designed", "b")], T0 + 10, 1);
  assert.equal(commitLine(rec, { owner: "w2", marks: batch.marks, text: "x", now: T0 + 20 }), null, "another writer committed");
  assert.equal(commitLine(rec, { owner: "w1", marks: batch.marks, text: "x", now: T0 + PROGRESS_LEASE_MS + 1 }), null, "a writer whose lease ran out committed");
  assert.equal(commitLine(closeRecord(rec, "ended", T0 + 15), { owner: "w1", marks: batch.marks, text: "x", now: T0 + 20 }), null, "a line was committed after the job ended");
  assert.equal(commitLine(rec, { owner: "w1", marks: batch.marks, text: "   ", now: T0 + 20 }), null);
  const done = commitLine(rec, { owner: "w1", marks: batch.marks, text: " Chose a page. ", now: T0 + 20 });
  assert.deepEqual(done.lines, [{ n: 0, at: T0 + 20, text: "Chose a page.", marks: [0] }]);
  assert.deepEqual(done.marks.map((m) => m.state), ["said", "pending"]);
  assert.equal(done.writer, null);
  assert.equal(done.tries, 0);
  assert.deepEqual(linesOf(done), [{ n: 0, ms: 20, text: "Chose a page." }], "a reader was handed more than the line and its time");
});

test("ONE WRITER 5 — a failed attempt is tried again later, then its own milestones are given up with the reason; the lease let go without writing is let go; a close sets every waiting milestone aside", () => {
  let rec = add(open(), "picked", [fact("decided", "a")], T0, 0);
  let c = claimWriter(rec, "w1", T0);
  rec = add(c.rec, "designed", [fact("designed", "late")], T0 + 5, 1);
  const f1 = failBatch(rec, { owner: "w1", marks: [0], why: "misstated", now: T0 + 10 });
  assert.equal(f1.retry, true);
  assert.equal(f1.rec.retryAt, T0 + 10 + PROGRESS_RETRY_MS);
  assert.equal(f1.rec.asked, T0 + 10 + PROGRESS_RETRY_MS, "the retry's own message is not its ask");
  c = claimWriter(f1.rec, "w2", T0 + 10 + PROGRESS_RETRY_MS);
  const f2 = failBatch(c.rec, { owner: "w2", marks: [0], why: "misstated", now: T0 + 20 + PROGRESS_RETRY_MS });
  assert.equal(f2.retry, false);
  assert.deepEqual(f2.rec.marks.map((m) => [m.state, m.why || ""]), [["failed", "misstated"], ["pending", ""]], "a milestone the attempt never covered was given up with it");
  assert.equal(failBatch(f2.rec, { owner: "w2", marks: [0], why: "x", now: T0 }), null, "a writer without the lease failed the batch");
  const r = releaseWriter(claimWriter(f2.rec, "w3", T0 + 30 + PROGRESS_RETRY_MS).rec, "w3");
  assert.equal(r.writer, null);
  const shut = closeRecord(add(open(), "a", [fact("decided", "a")], T0, 0), "cancelled", T0 + 1);
  assert.deepEqual(shut.marks.map((m) => [m.state, m.why]), [["skipped", "cancelled"]]);
  assert.deepEqual(shut.closed, { at: T0 + 1, why: "cancelled" });
  assert.equal(closeRecord(shut, "ended", T0 + 2), null, "a closed record was closed again");
});

test("THE JOB'S ROW — a line may be written only while the job runs, under the run that recorded it, its lease live; a row that cannot be read is never read as one that can", () => {
  const rec = open();
  const live = { uid: "u-1", state: "building", lease_owner: "c_run00001", lease_expires_at: new Date(T0 + 60000).toISOString(), cancel_requested_at: null, needs_review: false };
  assert.deepEqual(jobVerdict(live, rec, T0), { ok: true });
  assert.deepEqual(jobVerdict({ ...live, lease_expires_at: T0 + 60000 }, rec, T0), { ok: true }, "a number for the lease's end was not read");
  const why = (row) => jobVerdict(row, rec, T0).why;
  assert.equal(why(undefined), "unread");
  assert.equal(why(null), "gone");
  assert.equal(why({ ...live, uid: "u-2" }), "gone");
  for (const s of ["done", "failed", "cancelled", "lost"]) assert.equal(why({ ...live, state: s }), "ended", s);
  assert.equal(why({ ...live, state: ["building"] }), "ended", "a non-string state was coerced");
  assert.equal(why({ ...live, cancel_requested_at: new Date(T0).toISOString() }), "cancelled");
  assert.equal(why({ ...live, needs_review: true }), "review");
  assert.equal(why({ ...live, lease_owner: "c_newer001" }), "superseded");
  assert.equal(why({ ...live, lease_expires_at: new Date(T0 - 1).toISOString() }), "stalled");
  assert.equal(why({ ...live, lease_expires_at: "soon" }), "stalled");
});

test("FACTS 1 — an edit's: the plan is decided and next; at the publish each step is prepared (or applied in the database) or not done, a superseded failure is not told, and the publish is only ever doing", () => {
  const steps = [{ layer: "look", page: "/gallery", fields: ["heading"] }, { layer: "data", fields: [] }, { layer: "look", fields: ["css"], withheld: { why: "x" } }];
  const plan = editPlanFacts(steps);
  assert.deepEqual(states(plan), ["decided", "next"]);
  assert.match(plan[0].text, /heading on \/gallery/);
  assert.doesNotMatch(plan[0].text, /css/, "a withheld step was planned");
  assert.deepEqual(editPlanFacts([{ withheld: {} }]), []);
  const pub = editPublishFacts([
    { step: steps[0], failed: false }, { step: steps[1], failed: false },
    { step: { layer: "look", fields: ["menu"] }, failed: true }, { step: { layer: "look", fields: ["photo"] }, failed: true, superseded: true },
  ]);
  assert.deepEqual(states(pub), ["prepared", "applied", "notdone", "doing"]);
  assert.doesNotMatch(pub.map((f) => f.text).join(" "), /photo/, "a superseded failure was told as not done");
  assert.deepEqual(states(editCorrectFacts()), ["doing"]);
  assert.deepEqual(states(editRepublishFacts()), ["doing"]);
});

test("FACTS 2 — an add-on's: picked is decided, each design designed and not built, the database's change applied, the pages prepared and not published, the publish doing", () => {
  assert.deepEqual(states(addonPickedFacts(["table", "page"])), ["decided", "next"]);
  assert.deepEqual(addonPickedFacts([]), []);
  const d = addonDesignedFacts("table", { name: "tasting_list", columns: [{ name: "name" }, { name: "email" }] }, ["page"]);
  assert.deepEqual(states(d), ["designed", "next"]);
  assert.match(d[0].text, /not built yet/);
  assert.match(d[0].text, /tasting_list/);
  assert.match(d[0].text, /“name” and “email”/);
  assert.match(d[1].text, /a new page/);
  const pages = addonDesignedFacts("page", [{ path: "/gallery", name: "Gallery" }, { path: "/menu", name: "Menu" }], []);
  assert.match(pages[0].text, /\/gallery/);
  assert.match(pages[0].text, /\/menu/, "a list kind's second item was not designed in the facts");
  assert.match(pages[1].text, /Build the additions next/);
  const schema = addonSchemaFacts({ tables: ["tasting_list"], altered: [{ table: "loaves", fields: ["note"] }], functions: [{ name: "cancel_booking" }], jobs: [{ name: "remind" }] });
  assert.deepEqual(states(schema), ["applied", "applied", "applied", "applied", "next"]);
  assert.deepEqual(addonSchemaFacts({}), []);
  const written = addonPagesFacts([{ path: "src/routes/gallery.tsx" }, "src/routes/index.tsx"]);
  assert.deepEqual(states(written), ["prepared", "next"]);
  assert.match(written[0].text, /\/gallery and \/, not published yet/);
  assert.deepEqual(states(addonPublishFacts()), ["doing"]);
});

test("FACTS 3 — no fact in any milestone is published, live or finished: the state does not exist, and no fact's words claim it", () => {
  assert.equal(PROGRESS_STATES.includes("published"), false);
  assert.equal(PROGRESS_STATES.includes("done"), false);
  const every = [
    ...editPlanFacts([{ layer: "look", page: "/", fields: ["heading"] }]), ...editPublishFacts([{ step: { layer: "look", fields: ["css"] }, failed: false }]),
    ...editCorrectFacts(), ...editRepublishFacts(), ...addonPickedFacts(["page"]), ...addonDesignedFacts("page", { path: "/x" }, []),
    ...addonSchemaFacts({ tables: ["t"] }), ...addonPagesFacts(["/x"]), ...addonPublishFacts(),
  ];
  for (const f of every) {
    assert.ok(PROGRESS_STATES.includes(f.state), f.state);
    assert.doesNotMatch(f.text, /\b(is live|went live|now live|published\b(?! yet)|finished|complete)/i, "a fact claims an outcome only the final reply may: " + f.text);
  }
});

test("CHECK 1 — an update that lists every fact in its own state is used; a fact left out is uncovered; a running step called prepared is misstated; one fact in two states is misstated; a fact's id in the words is refused", () => {
  const facts = [{ id: "f1", state: "prepared", text: "wrote /gallery" }, { id: "f2", state: "doing", text: "publishing" }];
  const says = (pairs) => pairs.map(([id, as]) => ({ id, as }));
  assert.deepEqual(readProgress(answer({ text: "The Gallery page is written; publishing it now.", says: says([["f1", "prepared"], ["f2", "doing"]]) }), facts).ok, true);
  const missed = readProgress(answer({ text: "The Gallery page is written.", says: says([["f1", "prepared"]]) }), facts);
  assert.deepEqual([missed.ok, missed.why, missed.missing], [false, "uncovered", ["f2"]]);
  const early = readProgress(answer({ text: "Published!", says: says([["f1", "prepared"], ["f2", "prepared"]]) }), facts);
  assert.deepEqual([early.ok, early.why, early.wrong], [false, "misstated", [{ id: "f2", as: "prepared", state: "doing" }]]);
  const both = readProgress(answer({ text: "x", says: says([["f1", "prepared"], ["f2", "doing"], ["f2", "prepared"]]) }), facts);
  assert.deepEqual([both.ok, both.why, both.wrong.map((w) => w.as)], [false, "misstated", ["two states"]]);
  const ids = readProgress(answer({ text: "Done with [f1].", says: says([["f1", "prepared"], ["f2", "doing"]]) }), facts);
  assert.deepEqual([ids.ok, ids.why], [false, "ids"]);
  assert.equal(readProgress({ content: [] }, facts).why, "unreadable");
  assert.equal(readProgress(answer({ text: "", says: [] }), facts).why, "unreadable");
  assert.equal(readProgress({ stop_reason: "max_tokens", content: [] }, facts).why, "cut");
});

test("CHECK 2 — NO ARBITRARY SHORT LIMIT: a long, useful update is used whole; the only bound is the call's own output budget, and an answer cut there is not used (never shortened)", () => {
  const facts = [{ id: "f1", state: "designed", text: "a table" }];
  const long = "The sign-up list is designed. ".repeat(80).trim();
  assert.ok(long.length > 2000);
  const r = readProgress(answer({ text: long, says: [{ id: "f1", as: "designed" }] }), facts);
  assert.equal(r.ok, true, "a long update was refused for its length");
  assert.equal(r.text, long, "a long update was shortened");
  assert.equal(progressRequest({ facts, model: "m" }).max_tokens, PROGRESS_MAX_TOKENS);
});

test("PROSE 1 — THE REMAINING LIMIT, PINNED: an update whose metadata lists every fact in its true state but whose words call the page live is ACCEPTED — nothing in code reads the words, and no keyword filter is added", () => {
  const facts = [{ id: "f1", state: "prepared", text: "wrote /gallery, not published yet" }, { id: "f2", state: "doing", text: "publishing now" }];
  const contradicting = answer({ text: "Your Gallery page is live and everything is finished!", says: [{ id: "f1", as: "prepared" }, { id: "f2", as: "doing" }] });
  const r = readProgress(contradicting, facts);
  assert.equal(r.ok, true, "the check now reads the words — say so in the plan's limits and the module's header, or this is a keyword filter the owner ruled out");
  assert.equal(r.text, "Your Gallery page is live and everything is finished!");
});

test("PROSE 2 — the instructions, concise, are what stand against that limit: published, live and finished are forbidden in words, each state is defined, and no worked example is given to copy", () => {
  assert.match(PROGRESS_SYSTEM, /Never say or suggest that anything is published or live, or that their request is finished/);
  for (const s of PROGRESS_STATES) assert.match(PROGRESS_SYSTEM, new RegExp("\\n" + s + ": "), "the state " + s + " is not defined for the model");
  assert.doesNotMatch(PROGRESS_SYSTEM, /for example|e\.g\.|such as "|like this:/i, "the instructions carry a worked example");
  assert.ok(PROGRESS_SYSTEM.length < 2000, "the instructions are no longer concise: " + PROGRESS_SYSTEM.length + " characters");
  assert.doesNotMatch(PROGRESS_SYSTEM, /\b\d+\s*(characters|chars|words)\b/i, "the instructions set a character or word limit");
  assert.deepEqual(PROGRESS_TOOL.input_schema.properties.says.items.properties.as.enum, [...PROGRESS_STATES]);
});

test("CALL 1 — the model is shown the site, its words and every earlier update, and each new fact with its id and state; asked again, it is told exactly what it left out or misstated", () => {
  let rec = add(open({ words: "Add a tasting evenings page" }), "picked", [fact("decided", "chose a page")], T0, 0);
  rec = commitLine(claimWriter(rec, "w", T0).rec, { owner: "w", marks: [0], text: "I'm adding a page.", now: T0 + 1 });
  const ctx = progressContext(rec);
  assert.match(ctx, /THEIR SITE: fold-lane-bakery/);
  assert.match(ctx, /ITS PAGES: \/, \/visit/);
  assert.match(ctx, /WHAT THEY ASKED FOR:\nAdd a tasting evenings page/);
  assert.match(ctx, /WHAT YOUR EARLIER UPDATES SAID, IN ORDER:\n- I'm adding a page\./);
  const facts = [{ id: "f2", state: "designed", text: "a page /tasting" }, { id: "f3", state: "next", text: "build it" }];
  const req = progressRequest({ facts, context: ctx, model: "grok-4.6", fix: { missing: ["f3"], wrong: [{ id: "f2", as: "prepared", state: "designed" }] } });
  const body = req.messages[0].content;
  assert.match(body, /\[f2\] \(designed\) a page \/tasting\n\[f3\] \(next\) build it/);
  assert.match(body, /LEFT OUT f3/);
  assert.match(body, /DESCRIBED f2 as prepared, but its state is designed/);
  assert.equal(req.tool_choice.name, "write_progress");
  assert.equal(req.model, "grok-4.6");
});

test("CALL 2 — at most two calls: a misstated first answer is asked once more and the right second one used; two wrong answers write nothing; a send that throws, or one past the deadline, writes nothing", async () => {
  const facts = [{ id: "f1", state: "doing", text: "publishing" }];
  const wrong = answer({ text: "It's published.", says: [{ id: "f1", as: "prepared" }] });
  const right = answer({ text: "Publishing it now.", says: [{ id: "f1", as: "doing" }] });
  const sent = [];
  const a = await writeProgress({ send: async (r) => { sent.push(r); return sent.length === 1 ? wrong : right; } }, { facts, model: "m" });
  assert.deepEqual([a.ok, a.text, a.attempts], [true, "Publishing it now.", 2]);
  assert.match(sent[1].messages[0].content, /DESCRIBED f1 as prepared, but its state is doing/);
  const b = await writeProgress({ send: async () => wrong }, { facts, model: "m" });
  assert.deepEqual([b.ok, b.why, b.attempts], [false, "misstated", 2]);
  const c = await writeProgress({ send: async () => { throw new Error("down"); } }, { facts, model: "m" });
  assert.deepEqual([c.ok, c.why], [false, "send"]);
  const d = await writeProgress({ send: () => new Promise(() => {}) }, { facts, model: "m", deadlineMs: 30 });
  assert.deepEqual([d.ok, d.why], [false, "deadline"]);
  const e = await writeProgress({ send: async () => ({ stop_reason: "max_tokens", content: [] }) }, { facts, model: "m" });
  assert.deepEqual([e.ok, e.why, e.attempts], [false, "cut", 1], "an answer cut at the output budget was asked for again or used");
  assert.deepEqual((await writeProgress({ send: async () => right }, { facts: [], model: "m" })).why, "no-facts");
  assert.deepEqual(a.usage.map((u) => [u.in, u.out]), [[100, 20], [100, 20]], "the log cannot read what each attempt used");
});
