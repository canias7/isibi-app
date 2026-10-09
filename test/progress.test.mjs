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
  claimWriter, holds, batchFor, commitLine, failBatch, releaseWriter, linesOf, confirmLines, jobVerdict,
  editPlanFacts, editPublishFacts, editCorrectFacts, editRepublishFacts, addonPickedFacts, addonDesignedFacts, addonSchemaFacts, addonPagesFacts, addonPublishFacts,
  PROGRESS_STATES, PROGRESS_TOOL, PROGRESS_SYSTEM, progressContext, progressRequest, readProgress, writeProgress,
  TASK_STATES, TASK_TOOL, TASK_SYSTEM, taskRequest, readTasks, writeTasks, tasksNeeded, unwrittenTasks, commitTasks, failTasks, addTasks, saidOf, PROGRESS_MAX_TASKS,
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
  for (const bad of [null, [], "x", { ...raw, v: 2 }, { ...raw, job: ["ab".repeat(16)] }, { ...raw, run: "" }, { ...raw, op: "deploy" }]) assert.equal(readProgressRecord(bad), null, JSON.stringify(bad).slice(0, 60));
  assert.equal(open({ run: "bad run!" }), null);
  assert.equal(open({ op: "deploy" }), null);
  // A FIRST BUILD HAS ITS OWN RECORD NOW (2026-10-09, parallel round 5).
  assert.equal(open({ op: "build" }).op, "build");
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
  // COMMITTED UNCONFIRMED (2026-10-06): no reader is handed it until a read
  // of the row made after the commit confirms it — and that read confirms
  // only the lines the record held before it, never a later one.
  assert.deepEqual(linesOf(done), [], "a reader was handed a line no read of the row has confirmed");
  const shown = confirmLines(done, 1);
  assert.deepEqual(linesOf(shown), [{ n: 0, ms: 20, text: "Chose a page." }], "a reader was handed more than the line and its time");
  assert.equal(confirmLines(shown, 1), null, "a line confirmed twice changed the record");
  const later = commitLine(claimWriter(shown, "w1", T0 + 30).rec, { owner: "w1", marks: [1], text: "Designed it.", now: T0 + 40 });
  assert.deepEqual(linesOf(confirmLines(later, 1) || later).map((l) => l.n), [0], "a confirmation covered a line committed after its read");
  assert.equal(confirmLines(later, 0), null);
  assert.equal(confirmLines(null, 1), null);
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
  // THE DATABASE'S CHANGE NAMES NOTHING TO COME (2026-10-07): it is applied at
  // the publish's seam, after the pages were written, or with no page at all —
  // so never "write the pages next"; at the seam the publish is still doing.
  const made = { tables: ["tasting_list"], altered: [{ table: "loaves", fields: ["note"] }], functions: [{ name: "cancel_booking" }], jobs: [{ name: "remind" }] };
  const schema = addonSchemaFacts(made);
  assert.deepEqual(states(schema), ["applied", "applied", "applied", "applied"]);
  assert.ok(schema.every((f) => !/pages/i.test(f.text)), "the database's change still speaks of pages to come");
  assert.deepEqual(states(addonSchemaFacts(made, { publishing: true })), ["applied", "applied", "applied", "applied", "doing"]);
  assert.match(addonSchemaFacts(made, { publishing: true })[4].text, /Publishing/);
  assert.deepEqual(addonSchemaFacts({}), []);
  assert.deepEqual(addonSchemaFacts({}, { publishing: true }), [], "a publish with no database change grew a schema milestone");
  // THE PAGES IN THEIR THREE KINDS, every address named, and the publish next.
  const written = addonPagesFacts({ added: ["src/routes/gallery.tsx"], changed: [{ path: "src/routes/index.tsx" }], linked: [{ path: "/about", to: ["/gallery"] }, { path: "/visit", to: ["/gallery"] }] });
  assert.deepEqual(states(written), ["prepared", "prepared", "prepared", "next"]);
  assert.match(written[0].text, /^New page written, not published yet: \/gallery\.$/);
  assert.match(written[1].text, /^Existing page changed for this addition, not published yet: \/\.$/);
  assert.match(written[2].text, /^A menu link to \/gallery added, and nothing else changed, not published yet, on the existing pages \/about and \/visit\.$/);
  assert.deepEqual(states(addonPublishFacts()), ["doing"]);
});

test("FACTS 2b — THE PAGES MILESTONE TELLS A PAGE WHOSE ONE CHANGE IS A MENU LINK FROM A PAGE THIS ADDITION CHANGED (2026-10-07, after run 105): no page in two kinds, links grouped by the page they point to, no address left out for a count, and nothing at all when no page changed", () => {
  // RUN 105'S SHAPE: one new page, eight existing pages given its menu link,
  // and the page the writer had returned changed (/classes) put back — so it
  // is among the linked pages, never among the changed.
  const eight = ["/", "/about", "/classes", "/order", "/visit", "/wholesale", "/menu", "/story"];
  const r105 = addonPagesFacts({ added: ["/faq"], changed: [], linked: eight.map((path) => ({ path, to: ["/faq"] })) });
  assert.deepEqual(states(r105), ["prepared", "prepared", "next"]);
  assert.doesNotMatch(r105[0].text, /classes/, "the new pages' fact names a page the merge put back");
  const token = (text, p) => new RegExp("(^|\\s)" + p.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "(,|\\.|\\s|$)").test(text);
  for (const p of eight) assert.ok(token(r105[1].text, p), "a linked page was left out: " + p + " — " + r105[1].text);
  assert.doesNotMatch(r105.map((f) => f.text).join(" "), /\b8\b|eight/, "a count stood in for the names");
  // A PAGE IN TWO KINDS IS TOLD ONCE, in the stronger: new over changed over linked.
  const twice = addonPagesFacts({ added: ["/faq"], changed: ["/faq", "/"], linked: [{ path: "/", to: ["/faq"] }, { path: "/faq", to: ["/faq"] }] });
  assert.deepEqual(states(twice), ["prepared", "prepared", "next"]);
  assert.doesNotMatch(twice[1].text, /faq/);
  // TWO NEW PAGES LINKED FROM DIFFERENT PAGES: one fact for each set of pages linked to.
  const two = addonPagesFacts({ added: ["/faq", "/shop"], linked: [{ path: "/", to: ["/faq", "/shop"] }, { path: "/about", to: ["/faq"] }] });
  assert.deepEqual(states(two), ["prepared", "prepared", "prepared", "next"]);
  assert.match(two[1].text, /\/faq and \/shop added, and nothing else changed, not published yet, on the existing page \/\./);
  assert.match(two[2].text, /A menu link to \/faq added, and nothing else changed, not published yet, on the existing page \/about\./);
  // NOTHING CHANGED: no milestone — never "wrote the pages" of none.
  assert.deepEqual(addonPagesFacts({}), []);
  assert.deepEqual(addonPagesFacts({ linked: [{ path: "/about", to: [] }] }), [], "a link to nothing was told");
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
  // CONVERSATIONAL AND FIRST-PERSON, each fact in its state's tense (the
  // owner's clarification): described, never given as a line to copy.
  assert.match(PROGRESS_SYSTEM, /Speak in the first person, naturally and conversationally/);
  assert.match(PROGRESS_SYSTEM, /next facts as what you will do, doing facts as what you are doing now, the rest as what you have done or could not do/);
});

const tasked = (over = {}) => open({ tasks: [{ n: 0, words: "Change the Gallery heading to Photographs from our ovens" }], ...over });
// A TASK'S LINE IN EVERY STATE (seven since the outcome round, 2026-10-06).
const linesAll = (n, base) => ({
  n, planned: "I'll " + base + ".", doing: "I'm " + base + " now.", waiting: "I need your answer before " + base + ".",
  unconfirmed: "I tried " + base + ", but I can't tell yet whether it went through.", done: "I've " + base + ".",
  partial: "I've done part of " + base + ".", notdone: "I couldn't " + base + ".",
});

test("TASKS 1 — the record holds each task's words and, once written, its line in every state; a request's own record holds its parts; one entry that does not read makes the record unreadable", () => {
  const rec = tasked();
  assert.deepEqual(rec.taskWords, [{ n: 0, words: "Change the Gallery heading to Photographs from our ovens" }]);
  assert.equal(rec.tasks, null);
  assert.equal(tasksNeeded(rec), true);
  assert.equal(tasksNeeded(open()), false, "a record with no task was owed lines");
  const req = openRecord({ job: "cd".repeat(16), uid: "u-1", slug: "fold-lane-bakery", op: "request", run: "rq4d775233b8c1dbf127a4", words: "add a page and change the heading", tasks: [{ n: 0, words: "add a page" }, { n: 1, words: "change the heading" }], at: T0 });
  assert.ok(req, "a request's own record did not open");
  assert.equal(req.op, "request");
  assert.deepEqual(req.taskWords.map((t) => t.n), [0, 1]);
  // ROUND-TRIP, WRITTEN.
  const done = { ...packRecord(rec), tasks: [linesAll(0, "updating the Gallery heading")] };
  const back = readProgressRecord(JSON.parse(JSON.stringify(done)));
  assert.deepEqual(saidOf(back, 0), (({ n, ...said }) => said)(linesAll(0, "updating the Gallery heading")), "a reader was not handed the task's line in every state");
  assert.deepEqual(Object.keys(saidOf(back, 0)), TASK_STATES);
  assert.equal(tasksNeeded(back), false);
  assert.equal(saidOf(back, 1), null);
  // ONE ENTRY THAT DOES NOT READ: the record does not read, never a shorter list.
  for (const bad of [
    { ...done, tasks: [{ ...linesAll(0, "x"), doing: "  " }] },
    { ...done, tasks: [linesAll(0, "x"), linesAll(1, "y")] },
    { ...done, tasks: [linesAll(1, "x")] },
    { ...done, taskWords: [{ n: 0, words: "" }] },
    { ...done, taskWords: [{ n: 0, words: "a" }, { n: 0, words: "b" }] },
    { ...done, taskWords: Array.from({ length: PROGRESS_MAX_TASKS + 1 }, (_, n) => ({ n, words: "w" })), tasks: null },
    { ...done, op: "deploy" },
  ]) assert.equal(readProgressRecord(JSON.parse(JSON.stringify(bad))), null, JSON.stringify(bad).slice(0, 120));
});

test("TASKS 2 — the writer's rules: the tasks' lines come first, on tries of their own, and on the lease alone — a closed record still takes them, since they say no state; given up after their tries, they never cost the milestones a line", () => {
  let rec = tasked();
  assert.equal(writerNeeded(rec, T0), "ask", "a record owed task lines asked for no writer");
  // CLOSED, AND STILL OWED THEM.
  const closed = closeRecord(rec, "ended", T0 + 10);
  assert.equal(tasksNeeded(closed), true);
  assert.equal(writerNeeded(closed, T0 + 20), "ask", "a closed record owed task lines asked for no writer");
  const c = claimWriter(closed, "w1", T0 + 20);
  assert.ok(c && c.claimed, "a writer could not claim a closed record for its task lines");
  assert.equal(c.rec.taskTries, 1);
  assert.equal(c.rec.tries, 0, "the task lines' try was counted against the milestones");
  const committed = commitTasks(c.rec, { owner: "w1", tasks: [linesAll(0, "updating the heading")], now: T0 + 30 });
  assert.ok(committed, "the lines were not committed on the lease alone");
  assert.equal(committed.writer, null);
  assert.equal(committed.taskTries, 0);
  assert.equal(writerNeeded(committed, T0 + 40), "none");
  // REFUSED: no lease, another's lease, a task left out.
  assert.equal(commitTasks(c.rec, { owner: "w2", tasks: [linesAll(0, "x")], now: T0 + 30 }), null);
  assert.equal(commitTasks(c.rec, { owner: "w1", tasks: [linesAll(0, "x")], now: T0 + 30 + 10 * 60 * 1000 }), null, "a lease that ran out committed");
  assert.equal(commitTasks(c.rec, { owner: "w1", tasks: [], now: T0 + 30 }), null, "lines that cover no task were committed");
  // A FAILED CALL: tried again later, then given up with why — and the milestones keep their own tries.
  rec = add(tasked(), "picked", [fact("decided", "chose a page")], T0, 0);
  const c1 = claimWriter(rec, "w1", T0);
  assert.deepEqual([c1.rec.taskTries, c1.rec.tries], [1, 0]);
  assert.equal(failTasks(c1.rec, { owner: "w9", why: "send", now: T0 + 1 }), null, "a writer without the lease let the lines go");
  const f1 = failTasks(c1.rec, { owner: "w1", why: "send", now: T0 + 1 });
  assert.equal(f1.retry, true);
  assert.equal(writerNeeded(f1.rec, T0 + 2), "wait", "a retry not yet due was asked for");
  const c2 = claimWriter(f1.rec, "w2", T0 + 1 + PROGRESS_RETRY_MS);
  assert.equal(c2.rec.taskTries, 2);
  const f2 = failTasks(c2.rec, { owner: "w2", why: "uncovered", now: T0 + 2 + PROGRESS_RETRY_MS });
  assert.equal(f2.retry, false);
  assert.equal(f2.rec.tasksWhy, "uncovered");
  assert.equal(tasksNeeded(f2.rec), false);
  const c3 = claimWriter(f2.rec, "w3", T0 + 3 + PROGRESS_RETRY_MS);
  assert.ok(c3 && c3.claimed, "the milestone could not be claimed once the task lines were given up");
  assert.deepEqual([c3.rec.tries, c3.rec.taskTries], [1, 0], "the milestone's try was not its own");
  // A WRITER THAT DIED ON THE TASK LINES spends their tries, and the next claim gives them up with no call.
  let d = tasked();
  for (let k = 0; k < PROGRESS_TRIES; k++) d = { ...claimWriter(d, "dead" + k, T0 + k * (PROGRESS_LEASE_MS + 1)).rec };
  const g = claimWriter(d, "w9", T0 + PROGRESS_TRIES * (PROGRESS_LEASE_MS + 1));
  assert.ok(g && g.gaveUp, "every try spent did not give the task lines up");
  assert.equal(g.rec.tasksWhy, "tries");
});

test("TASKS 5 — A PART ADDED LATER (a request's part carved after its acceptance): added in the customer's words and owed its own lines; the lines already written are kept and never asked for again; one added while a call ran still waits after its commit; adding begins the tries again, even after a give-up", () => {
  const MSG = "add a gallery page and put a link to it in the menu";
  const LINK = "put a link to it in the menu";
  const req = openRecord({ job: "cd".repeat(16), uid: "u-1", slug: "fold-lane-bakery", op: "request", run: "rq4d775233b8c1dbf127a4", words: MSG, tasks: [{ n: 0, words: MSG }], at: T0 });
  const c = claimWriter(req, "w1", T0);
  const written = commitTasks(c.rec, { owner: "w1", tasks: [linesAll(0, "adding your gallery page")], now: T0 + 1 });
  assert.equal(tasksNeeded(written), false);
  // THE PART CARVED: the parts as the request now holds them, the first already there.
  const a = addTasks(written, [{ n: 0, words: MSG }, { n: 1, words: LINK }]);
  assert.equal(a.added, 1);
  assert.deepEqual(unwrittenTasks(a.rec), [{ n: 1, words: LINK }], "the writer would be asked for lines already written");
  assert.equal(tasksNeeded(a.rec), true);
  assert.equal(writerNeeded(a.rec, T0 + 2), "ask", "a part added later asked for no writer");
  assert.deepEqual(saidOf(a.rec, 0), saidOf(written, 0), "the lines already written were lost");
  assert.deepEqual(addTasks(a.rec, [{ n: 0, words: MSG }, { n: 1, words: LINK }]), { already: true }, "the same parts were added twice");
  // THE RECORD READS WITH LINES FOR SOME OF ITS TASKS, the rest still owed.
  const back = readProgressRecord(JSON.parse(JSON.stringify(packRecord(a.rec))));
  assert.deepEqual(back.tasks.map((t) => t.n), [0]);
  assert.equal(tasksNeeded(back), true);
  // ITS LINES COMMITTED BESIDE THE FIRST'S.
  const c2 = claimWriter(a.rec, "w2", T0 + 3);
  assert.ok(c2 && c2.claimed);
  const both = commitTasks(c2.rec, { owner: "w2", tasks: [linesAll(1, "linking it in your menu")], now: T0 + 4 });
  assert.deepEqual(both.tasks.map((t) => t.n), [0, 1]);
  assert.deepEqual(saidOf(both, 0), saidOf(written, 0));
  assert.equal(saidOf(both, 1).doing, "I'm linking it in your menu now.");
  assert.equal(tasksNeeded(both), false);
  // REFUSED: lines only for a task already written, or for a task the record does not hold.
  assert.equal(commitTasks(c2.rec, { owner: "w2", tasks: [linesAll(0, "rewriting it")], now: T0 + 4 }), null, "lines already written were written again");
  assert.equal(commitTasks(c2.rec, { owner: "w2", tasks: [linesAll(7, "x")], now: T0 + 4 }), null, "lines for no task were committed");
  // ADDED WHILE A CALL RAN: the commit keeps it owed, and a writer is asked for it.
  const c3 = claimWriter(a.rec, "w3", T0 + 5);
  const mid = addTasks(c3.rec, [{ n: 2, words: "change the heading" }]).rec;
  const after = commitTasks(mid, { owner: "w3", tasks: [linesAll(1, "linking it")], now: T0 + 6 });
  assert.deepEqual(unwrittenTasks(after).map((t) => t.n), [2]);
  assert.equal(writerNeeded(after, T0 + 7), "ask", "a part added during the call was left waiting");
  // GIVEN UP, THEN A PART ADDED: every owed task is tried again, on fresh tries.
  let g = a.rec;
  for (let k = 0; k < PROGRESS_TRIES; k++) {
    const t0 = T0 + 10 + k * (PROGRESS_RETRY_MS + 10);
    const ck = claimWriter(g, "g" + k, t0);
    g = failTasks(ck.rec, { owner: "g" + k, why: "send", now: t0 + 1 }).rec;
  }
  assert.equal(g.tasksWhy, "send");
  assert.equal(tasksNeeded(g), false);
  const again = addTasks(g, [{ n: 2, words: "change the heading" }]).rec;
  assert.deepEqual([again.tasksWhy, again.taskTries], [null, 0]);
  assert.deepEqual(unwrittenTasks(again).map((t) => t.n), [1, 2]);
  // REFUSED: a part with no words, or more than the record holds.
  assert.equal(addTasks(a.rec, [{ n: 3, words: "  " }]), null);
  assert.equal(addTasks(a.rec, Array.from({ length: PROGRESS_MAX_TASKS + 1 }, (_, n) => ({ n, words: "w" + n }))), null);
});

test("TASKS 3 — the check reads the answer's shape: every task, by its id, with a line in every state and no id in any line; the first entry for an id is the one read; no length is checked", () => {
  const tasks = [{ n: 0, words: "add a page" }, { n: 2, words: "change the heading" }];
  const say = (input, stop = "tool_use") => ({ stop_reason: stop, content: [{ type: "tool_use", name: "write_tasks", input }] });
  const long = "I'm " + "carefully ".repeat(120) + "changing it now.";
  const good = say({ tasks: [{ id: "t0", ...linesAll(0, "adding the page") }, { id: "t2", ...linesAll(2, "changing the heading"), doing: long }, { id: "t2", ...linesAll(2, "other") }] });
  const r = readTasks(good, tasks);
  assert.equal(r.ok, true);
  assert.deepEqual(r.tasks.map((t) => t.n), [0, 2]);
  assert.equal(r.tasks[1].doing, long, "a long line was cut, or a later entry for the same id was read");
  assert.deepEqual(readTasks(say({ tasks: [{ id: "t0", ...linesAll(0, "x") }] }), tasks).missing, ["t2"]);
  assert.equal(readTasks(say({ tasks: [{ id: "t0", ...linesAll(0, "x") }, { id: "t2", ...linesAll(2, "y"), done: "" }] }), tasks).why, "uncovered", "a task with a state left empty was taken");
  assert.equal(readTasks(say({ tasks: [{ id: "t0", ...linesAll(0, "x"), planned: "I'll do [t0]." }, { id: "t2", ...linesAll(2, "y") }] }), tasks).why, "ids");
  assert.equal(readTasks(say({ tasks: "x" }), tasks).why, "unreadable");
  assert.equal(readTasks({ stop_reason: "max_tokens", content: [] }, tasks).why, "cut");
  assert.equal(readTasks(say({ tasks: [] }), []).ok, false, "an answer for no task read as written");
});

test("TASKS 4 — the call: each task with its id and the customer's words, beside the site and their message; a wrong first answer is asked once more, told which; then nothing is written", async () => {
  const rec = tasked({ pages: ["/", "/gallery"] });
  const req = taskRequest({ tasks: rec.taskWords, context: progressContext(rec), model: "grok-4.6", fix: { missing: ["t0"], ids: true } });
  const body = req.messages[0].content;
  assert.match(body, /THEIR SITE: fold-lane-bakery/);
  assert.match(body, /\[t0\] Change the Gallery heading to Photographs from our ovens/);
  assert.match(body, /LEFT OUT, OR LEFT A STATE EMPTY FOR, t0/);
  assert.match(body, /PUT A TASK'S ID IN A LINE/);
  assert.equal(req.tool_choice.name, TASK_TOOL.name);
  assert.equal(req.system[0].text, TASK_SYSTEM);
  const say = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "write_tasks", input }], usage: { input_tokens: 80, output_tokens: 40 } });
  const wrong = say({ tasks: [] });
  const right = say({ tasks: [{ id: "t0", ...linesAll(0, "updating the Gallery heading") }] });
  const sent = [];
  const a = await writeTasks({ send: async (r) => { sent.push(r); return sent.length === 1 ? wrong : right; } }, { tasks: rec.taskWords, model: "m" });
  assert.deepEqual([a.ok, a.attempts, a.tasks[0].doing], [true, 2, "I'm updating the Gallery heading now."]);
  assert.match(sent[1].messages[0].content, /LEFT OUT, OR LEFT A STATE EMPTY FOR, t0/);
  const b = await writeTasks({ send: async () => wrong }, { tasks: rec.taskWords, model: "m" });
  assert.deepEqual([b.ok, b.why, b.attempts], [false, "uncovered", 2]);
  assert.deepEqual((await writeTasks({ send: async () => { throw new Error("down"); } }, { tasks: rec.taskWords, model: "m" })).why, "send");
  assert.deepEqual((await writeTasks({ send: () => new Promise(() => {}) }, { tasks: rec.taskWords, model: "m", deadlineMs: 30 })).why, "deadline");
  assert.deepEqual((await writeTasks({ send: async () => right }, { tasks: [], model: "m" })).why, "no-tasks");
});

test("PROSE 3 — the task lines' instructions, concise: every state defined (seven since the outcome round), the unconfirmed one never said as happening now or done, first person and conversational, their words never handed back as an instruction, never published or live; no line to copy and no length", () => {
  for (const k of TASK_STATES) assert.match(TASK_SYSTEM, new RegExp("\\n" + k + ": "), "the state " + k + " is not defined for the model");
  assert.deepEqual(TASK_STATES, ["planned", "doing", "waiting", "unconfirmed", "done", "partial", "notdone"]);
  assert.match(TASK_SYSTEM, /\nunconfirmed: [^\n]*without saying it is happening now or that it is done/, "the unconfirmed state may be said as happening now");
  assert.match(TASK_SYSTEM, /Speak in the first person, naturally and conversationally/);
  assert.match(TASK_SYSTEM, /never hand their words back as an instruction/);
  assert.match(TASK_SYSTEM, /Never say a change is published or live/);
  assert.doesNotMatch(TASK_SYSTEM, /for example|e\.g\.|such as "|like this:|"I'll|"I'm|Okay, I/i, "the instructions carry a line to copy");
  assert.doesNotMatch(TASK_SYSTEM, /\b\d+\s*(characters|chars|words)\b/i, "the instructions set a character or word limit");
  assert.ok(TASK_SYSTEM.length < 1200, "the instructions are no longer concise: " + TASK_SYSTEM.length + " characters");
  assert.deepEqual(TASK_TOOL.input_schema.properties.tasks.items.required, ["id", ...TASK_STATES]);
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
