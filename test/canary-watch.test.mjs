// The two decisions run 14 got wrong, DRIVEN.
//
// ── WHY THESE ARE DRIVEN AND NOT READ ──────────────────────────────────────
//
// `test/edit-canary.test.mjs` reads `scripts/edit-canary.mjs` as SOURCE,
// because that file has top-level await and spends money — importing it to
// reach a function would run the harness. That is the right shape for asserting
// where a block sits, and it is the wrong shape for asserting what a decision
// ANSWERS: a source read cannot tell a wired reader from an unwired one, and
// this repo has shipped twelve features dead behind exactly that gap.
//
// So the two decisions live in `scripts/canary-watch.mjs` and this file runs
// them with literal inputs and a fake clock. Both defects reviewed out of run
// 14 would have been caught here and by nothing else in the suite:
//
//   * a blank instruction silently becoming a paid request for something else;
//   * a completed failure (HTTP 503 under `x-gf-edit: final`) read as a
//     transient poll failure and polled past until the watch ran out.
import test from "node:test";
import assert from "node:assert/strict";
import { EditPoll, readInstruction, instructionRefusal, watchEdit, watchReport, readRoutes, routesRefusal, MAX_ROUTER_PAGES } from "../scripts/canary-watch.mjs";
import { publishedVersion, afterReadTarget, sameVersion, awaitVersion, afterReadVerdict, verdictSentence } from "../scripts/canary-watch.mjs";
import { readFileSync } from "node:fs";

const CANARY_RAW = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");

// A poll response in the shape `edit-canary.mjs`'s `call` really returns.
const res = (status, json, headers = {}) => ({ status, json, headers, text: JSON.stringify(json || null) });
const FINAL = { [EditPoll.FINAL_HEADER]: EditPoll.FINAL_VALUE };

// A fake clock: the watch must never really sleep, or a 260-poll timeout case
// takes thirteen minutes.
const noSleep = () => Promise.resolve();
const feed = (list) => {
  let n = 0;
  return () => Promise.resolve(list[Math.min(n++, list.length - 1)]);
};

// ── 1. A BLANK INSTRUCTION IS A REFUSAL, NOT A DEFAULT ─────────────────────

test("a missing, blank or unreadable instruction refuses rather than substituting one", () => {
  // Every one of these was a run that could be pressed before today, and the
  // first is exactly what run 14 was dispatched with.
  assert.equal(readInstruction(undefined).ok, false, "an absent env var must refuse");
  assert.equal(readInstruction("").ok, false, "an empty string must refuse");
  assert.equal(readInstruction("   \t\n ").ok, false, "whitespace must refuse — it looks filled in every form that shows it");

  // FAIL CLOSED ON A NON-STRING rather than coercing. `String(["a"])` is "a",
  // which this repo has shipped as a real bug three times; here it would be a
  // paid request assembled out of an array.
  assert.equal(readInstruction(["a"]).ok, false, "a non-string must refuse, never stringify");
  assert.equal(readInstruction(42).ok, false);
  assert.equal(readInstruction({}).ok, false);

  // The two operator mistakes are NAMED apart, because they are different
  // mistakes and the sentence for each is different.
  assert.equal(readInstruction("").why, "missing");
  assert.equal(readInstruction("  ").why, "blank");
  assert.equal(readInstruction(7).why, "not-a-string");

  // And a real ask survives, trimmed.
  const ok = readInstruction("  count down the places left  ");
  assert.equal(ok.ok, true);
  assert.equal(ok.instruction, "count down the places left", "the ask is trimmed, not rejected for its whitespace");
});

test("the refusal names the spend it is preventing, and every arm has a sentence", () => {
  for (const why of ["missing", "blank", "not-a-string"]) {
    const s = instructionRefusal(why);
    assert.match(s, /REFUSING TO SPEND/, `${why} must say what it is refusing`);
    assert.match(s, /CANARY_INSTRUCTION/, `${why} must name the field the operator can fix`);
    assert.ok(s.length > 60, `${why} must explain, not just decline`);
  }
  // The three sentences are three sentences — a single shared one would make
  // "nobody filled it in" and "it is not text" the same operator problem.
  const said = new Set(["missing", "blank", "not-a-string"].map(instructionRefusal));
  assert.equal(said.size, 3, "each refusal must be distinguishable from outside");
});

/**
 * Whole-line `//` comments blanked, length preserved.
 *
 * ⚠ NOT OPTIONAL, AND THIS FILE PROVED IT ON ITSELF. The census below forbids
 * a fallback on the instruction, and the first cut of `canary-watch.mjs`
 * EXPLAINED that defect in a comment that spelled it — so the guard reported
 * the paragraph arguing for the rule as a breach of it. Tenth-plus recorded
 * instance in this repo, several of them inside the guard written for the trap.
 *
 * Whole-line only, and that is deliberate rather than lazy: a scan that also
 * blanked trailing comments would have to track strings, and `chat.js`'s own
 * blanker records what a half-right one costs (a `//` inside a URL opening a
 * false block that ran 71,729 characters).
 */
function blankLineComments(src) {
  return src.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

test("THE HARNESS HAS NO INSTRUCTION DEFAULT AT ALL, and the gate is above the routing call", () => {
  const SRC = blankLineComments(CANARY_RAW);
  // THE OBSERVER IS PROVED ALIVE BEFORE ANY ABSENCE IS BELIEVED. A blanker
  // that erased the whole file would make the census below vacuously true.
  assert.ok(SRC.includes("CANARY_INSTRUCTION"), "the blanker must leave the code it is about to scan");

  // THE CENSUS IS THE PROPERTY: nothing anywhere supplies a fallback ask.
  const fallback = SRC.match(/CANARY_INSTRUCTION\s*(\|\||\?\?)/g) || [];
  assert.equal(fallback.length, 0, "a default on the instruction is the run-14 defect restored");

  // AND THE ORDER IS THE OTHER HALF. Routing is billed on its own — run 14
  // moved the balance by 2 for it and published nothing — so a gate below the
  // routing call is a gate that has already spent. Landmark to landmark, with
  // BOTH ends asserted, because `indexOf` answering -1 makes every comparison
  // below it vacuous.
  const gate = SRC.indexOf("readInstruction(process.env.CANARY_INSTRUCTION)");
  const route = SRC.indexOf('"/api/site/route"');
  // ⚠ THE EDIT POST IS SEARCHED FROM THE PAID HEADING, NOT FROM THE TOP. The
  // free half posts to the same route with an empty instruction — that is the
  // zero-cost async-shape confirmation — so a bare `indexOf` finds THAT one,
  // sits above the gate, and fails a correct file. `PAID CANARY EDIT` is the
  // section's own heading and survives the blanker because it is a string the
  // script prints, not a comment.
  const paid = SRC.indexOf("PAID CANARY EDIT");
  assert.ok(paid > 0, "the paid section's heading must exist — the observer is alive");
  const post = SRC.indexOf("${encodeURIComponent(CANARY)}/edit`", paid);
  assert.ok(gate > 0, "the instruction gate must exist");
  assert.ok(route > 0, "the routing call must exist — the observer is alive");
  assert.ok(post > paid, "the paid edit POST must sit inside the paid half — the observer is alive");
  assert.ok(gate < route, "the instruction is demanded ABOVE the routing call, which is itself billed");
  assert.ok(gate < post, "and above the edit POST");
});

test("the exact submitted instruction is written into the evidence", () => {
  // Run 14's bundle recorded the routing answer, the terminal body and the
  // customer's screen — and nowhere the one input that decides all three, so
  // a run that asked for X and one that asked for Y were the same artifact.
  assert.match(CANARY_RAW, /request\.json/, "the request must be recorded as its own artifact");
  const at = CANARY_RAW.indexOf("request.json");
  const win = CANARY_RAW.slice(at, at + 400);
  assert.match(win, /instruction:\s*INSTRUCTION/, "the recorded instruction must be the one that was sent");
});

// ── 2. THE WATCH USES THE BROWSER'S OWN READER ─────────────────────────────

test("a completed failure — HTTP 503 under the final header — is the ANSWER, not a retry", async () => {
  // THIS IS RUN 14'S DEFECT. `edit_finalize` stores the reply a failed edit
  // produced, and the poll route hands it back with its OWN status: 503 for a
  // model outage. The old loop tested `status === 200`, so it read a finished
  // edit as a failed read and polled past it for the rest of its watch.
  const w = await watchEdit(feed([
    res(200, { status: "claimed" }),
    res(200, { status: "routing" }),
    res(503, { ok: false, error: "model", msg: "The model that writes pages did not answer.", cost: 0 }, FINAL),
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "reply", "a stored reply arrived and the watch must end on it");
  assert.equal(w.polls, 3, "it must end on the third poll, not run out the loop");
  assert.equal(w.q.status, 503, "the stored reply's OWN status is preserved");

  const rep = watchReport(w);
  assert.equal(rep.compose, true, "there IS a body, so the customer's composer runs on it");
  assert.equal(rep.pass, false, "a completed failure answered — and is not a pass");
  assert.match(rep.headline, /503/, "the headline carries the status rather than hiding it");
});

test("a transient poll failure is not an edit failure — the same 503 WITHOUT the header retries", async () => {
  // The discriminator is the header and only the header. By number alone these
  // two responses are identical, which is the whole reason `x-gf-edit` exists
  // and the whole reason the harness had to stop reading the number.
  const w = await watchEdit(feed([
    res(503, { error: "could not read that job" }),          // the POLL failed
    res(429, { error: "slow down" }),                        // and again
    res(0, null),                                            // a dropped connection
    res(200, { ok: true, layer: "page", cost: 20 }, FINAL),  // then the edit answered
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "reply");
  assert.equal(w.polls, 4, "the three transient failures were retried, not mistaken for the answer");
  assert.equal(w.retries, 3, "and they are COUNTED — a watch spent retrying must be distinguishable from one spent waiting");
  assert.equal(watchReport(w).pass, true, "the successful control still passes");
});

test("a terminal job with no stored reply ends the watch and is NOT composed over", async () => {
  // `lost` and `cancelled` store no reply at all — the route describes the job
  // instead. There is nothing for the customer's composer to read, and the
  // browser prints a fixed sentence, so the harness prints the same one rather
  // than inventing a second copy of it.
  const w = await watchEdit(feed([
    res(200, { status: "running" }),
    res(200, { status: "lost" }),
  ]), { sleep: noSleep, waitMs: 0, tries: 20 });

  assert.equal(w.kind, "ended");
  assert.equal(w.outcome, "lost");
  const rep = watchReport(w);
  assert.equal(rep.compose, false, "no stored reply means nothing to compose FROM");
  assert.equal(rep.message, EditPoll.outcomeMessage("lost"), "the sentence is the browser's own, by identity");
  assert.equal(rep.pass, false);
});

test("a genuine watch timeout reports OUTCOME UNKNOWN and never runs the composer", async () => {
  // ⚠ THE SENTENCE RUN 14 PRINTED WAS "the job did not finish inside the
  // watch", which is a claim about the JOB made from a fact about the HARNESS.
  // The job runs in a queue consumer that has never heard of this process; a
  // watch that stopped looking establishes nothing about whether it finished.
  const w = await watchEdit(feed([res(200, { status: "running", phase: "verify" })]),
    { sleep: noSleep, waitMs: 0, tries: 6 });

  assert.equal(w.kind, "timeout");
  assert.equal(w.polls, 6, "it really ran its whole watch");

  const rep = watchReport(w);
  assert.equal(rep.compose, false, "THE NULL BODY NEVER REACHES THE COMPOSER — that is what recorded a phantom ~25-credit rewrite");
  assert.match(rep.headline, /unknown/i, "the honest word is unknown");
  assert.doesNotMatch(rep.headline, /did not finish/i, "and it must not claim the job did not finish");
  assert.equal(rep.pass, false);
});

test("a 404 stops the watch and says nothing about whether the id exists", async () => {
  const w = await watchEdit(feed([res(404, { error: "not found" })]), { sleep: noSleep, waitMs: 0, tries: 20 });
  assert.equal(w.kind, "gone");
  assert.equal(w.polls, 1, "a 404 is not worth retrying");
  const rep = watchReport(w);
  assert.equal(rep.compose, false);
  // The same answer a job belonging to somebody else gets, deliberately — so
  // the sentence must not let a caller tell those apart.
  assert.doesNotMatch(rep.headline, /does not exist|never existed/i);
});

test("the header is read case-insensitively, so a capital cannot read as absence", async () => {
  const w = await watchEdit(feed([res(422, { ok: false, error: "compile" }, { "X-GF-Edit": "final" })]),
    { sleep: noSleep, waitMs: 0, tries: 5 });
  assert.equal(w.kind, "reply", "a capitalised header is the same header");
});

test("the harness asks EditPoll rather than re-deriving the rule", () => {
  // TWO COPIES OF ONE THING DRIFT SILENTLY. The browser and the harness must
  // never disagree about what a given response meant, so the census is that
  // the old hand-rolled test is gone and the shared reader is called.
  assert.match(CANARY_RAW, /watchEdit\(/, "the harness must use the shared watch");
  const bare = CANARY_RAW.match(/q\.status === 200/g) || [];
  assert.equal(bare.length, 0, "`q.status === 200` is the run-14 defect verbatim");

  // And the reader really is the browser's file, not a copy of it.
  assert.equal(typeof EditPoll.readPoll, "function");
  assert.equal(EditPoll.FINAL_HEADER, "x-gf-edit");
  assert.deepEqual(EditPoll.readPoll(503, "final", null), { act: "reply" });
  assert.deepEqual(EditPoll.readPoll(503, undefined, null), { act: "retry" });
});

test("the response headers survive the harness's own call helper", () => {
  // THE WIRING HOP, and it is the one that makes everything above reachable:
  // `call` dropped `res.headers`, so the final marker could not arrive however
  // correctly it was read. From outside, "the server did not send it" and "we
  // did not keep it" are the same absence.
  const at = CANARY_RAW.indexOf("function call(");
  assert.ok(at > 0, "the call helper must exist — the observer is alive");
  const end = CANARY_RAW.indexOf("let failed = 0", at);
  assert.ok(end > at, "and its window must close on the next sibling");
  assert.match(CANARY_RAW.slice(at, end), /headers:\s*res\.headers/, "the call helper must keep the response headers");
});

// ── 3. THE ROUTER IS TOLD THE SITE'S PAGES (run 23, 2026-09-23) ───────────
//
// The canary sent `pages: []`, so the router named a page from the sentence
// alone — `/book`, which fretwork-1 does not have — and `readEdit`'s check
// against the real list never ran. The browser fills the list from
// `GET /api/site/routes`, and this is the harness reading it the same way.

// The `/api/site/routes` answer's own shape (worker.js: `{ok, slug, routes}`),
// with fretwork-1's three real routes, home first.
const ROUTES = { ok: true, slug: "fretwork-1", routes: ["/", "/prices", "/gear"] };

test("the page list is the site's own routes, read the browser's way", () => {
  assert.deepEqual(readRoutes(200, ROUTES), { ok: true, pages: ["/", "/prices", "/gear"] });
  // THE BROWSER'S FILTER: strings that start with `/`, and nothing coerced.
  // `String(["/x"])` is "/x", the recorded coercion — an array must be dropped,
  // not stringified into a page the router is told exists.
  const junk = readRoutes(200, { ok: true, routes: ["/", 5, null, "prices", ["/x"], { p: "/y" }, "/gear"] });
  assert.deepEqual(junk, { ok: true, pages: ["/", "/gear"] });
});

test("a page list that cannot be read refuses; it never becomes an empty list", () => {
  // CANNOT-TELL IS A REFUSAL. An empty list is the blind router run 23 paid
  // for, so every one of these must answer `ok: false` with its own reason.
  const cases = [
    [0, ROUTES, /status 0/],
    [401, { ok: false, error: "unauthorized" }, /status 401/],
    [404, { ok: false, error: "not found" }, /status 404/],
    [503, ROUTES, /status 503/],
    [200, null, /not ok/],
    [200, { ok: false }, /not ok/],
    [200, { ok: "true", routes: ["/"] }, /not ok/],
    [200, { ok: true }, /no routes list/],
    [200, { ok: true, routes: "/" }, /no routes list/],
    [200, { ok: true, routes: [] }, /no usable routes/],
    [200, { ok: true, routes: ["gear", 7, ["/"]] }, /no usable routes/],
  ];
  for (const [status, body, why] of cases) {
    const r = readRoutes(status, body);
    assert.equal(r.ok, false, `status ${status} ${JSON.stringify(body)} was read as a page list`);
    assert.equal(r.pages, undefined, "a refusal must not carry a list anybody could send");
    assert.match(r.why, why);
  }
});

test("the list is capped where the browser caps it", () => {
  const many = Array.from({ length: MAX_ROUTER_PAGES + 6 }, (_, i) => (i ? "/p" + i : "/"));
  const r = readRoutes(200, { ok: true, routes: many });
  assert.equal(r.ok, true);
  assert.equal(r.pages.length, MAX_ROUTER_PAGES);
  assert.equal(r.pages[0], "/", "home must survive the cap");
  // THE BROWSER'S NUMBER, not a second one typed here: `siteRoute`'s digest
  // slices `sitePages(site)` at this bound, and two copies of one number drift.
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const m = chat.match(/pages:\s*sitePages\(site\)\.map\(\(p\) => p\.path\)\.slice\(0,\s*(\d+)\)/);
  assert.ok(m, "the browser's routing digest is no longer where this guard reads its cap from");
  assert.equal(Number(m[1]), MAX_ROUTER_PAGES, "the harness caps the page list differently from the browser");
});

test("the refusal names the site and the reason", () => {
  const s = routesRefusal("fretwork-1", "status 503");
  assert.match(s, /^REFUSING TO SPEND/);
  assert.match(s, /fretwork-1/);
  assert.match(s, /status 503/);
});

// ── 4. THE AFTER-READ WAITS FOR THIS JOB'S OWN VERSION (run 32, 2026-09-25) ──
//
// Run 32 published a section move on fretwork-1 and read the site back 7.9 s
// after the job recorded its publish — the PREVIOUS build answered, and the
// comparison said nothing had moved. These are run 32's own identifiers: the
// version it started from, the version its job published, and the job's id.
const V_BEFORE = "01790155568567-c1td33";
const V_MINE = "01790360265159-n7mtnq";
const V_LATER = "01790361000000-later1";   // minted after V_MINE: another publish
const V_OLDER = "01790040384165-wl5it5";   // minted before V_BEFORE: an old build
const JOB32 = "bb3e792f1eb4142103be22c9ebe6748c";
const list = (versions, status = 200) => ({ status, json: { ok: true, versions } });
const row = (id, job, parent) => ({ id, job, parent, label: "x", layout: "build" });

test("the version this job published is found by the job's own id, never by being newest", () => {
  // AN UNRELATED NEWER VERSION IS NOT A MATCH: the newest row is another job's.
  const l = list([row(V_LATER, "another-job", V_MINE), row(V_MINE, JOB32, V_BEFORE), row(V_BEFORE, "an-older-job", V_OLDER)]);
  assert.deepEqual(publishedVersion(l, JOB32), { ok: true, id: V_MINE, parent: V_BEFORE, rows: 1 });
  // A job that published twice (a correction round) ends on its newest build.
  const twice = list([row(V_LATER, JOB32, V_MINE), row(V_MINE, JOB32, V_BEFORE)]);
  assert.equal(publishedVersion(twice, JOB32).id, V_LATER);
  assert.equal(publishedVersion(twice, JOB32).rows, 2);
  // The order the list arrives in does not decide it — the mint time does.
  const reversed = list([row(V_MINE, JOB32, V_BEFORE), row(V_LATER, JOB32, V_MINE)]);
  assert.equal(publishedVersion(reversed, JOB32).id, V_LATER);
});

test("a version list that cannot be read, or does not name this job, is not a target", () => {
  const l = [row(V_MINE, JOB32, V_BEFORE)];
  assert.deepEqual(publishedVersion(list(l, 503), JOB32), { ok: false, why: "list-unreadable", status: 503 },
    "a list inside a failing answer is not a list");
  assert.equal(publishedVersion({ status: 200, json: { ok: true } }, JOB32).why, "list-unreadable");
  assert.equal(publishedVersion({ status: 200, json: { versions: "x" } }, JOB32).why, "list-unreadable");
  assert.equal(publishedVersion(null, JOB32).why, "list-unreadable");
  assert.equal(publishedVersion(list([row(V_LATER, "another-job", V_MINE)]), JOB32).why, "not-listed");
  // THE JOB ID IS COMPARED STRICTLY, and a row whose id is not a version is
  // never a target.
  assert.equal(publishedVersion(list([{ id: V_MINE, job: 7, parent: V_BEFORE }]), "7").why, "not-listed");
  assert.equal(publishedVersion(list([row("not-a-version", JOB32, V_BEFORE)]), JOB32).why, "not-listed");
  // AND NO JOB FINDS NOTHING — a missing id must never match a row with none.
  assert.equal(publishedVersion(list([row(V_MINE, "", V_BEFORE)]), "").why, "no-job");
  assert.equal(publishedVersion(list([row(V_MINE, null, V_BEFORE)]), undefined).why, "no-job");
});

test("an edit that did not publish is compared against the version the before-read saw", () => {
  assert.deepEqual(afterReadTarget({ published: false, before: V_BEFORE, list: null, job: JOB32 }),
    { ok: true, id: V_BEFORE, parent: "", why: "unpublished" });
  assert.equal(afterReadTarget({ published: false, before: "", list: null, job: JOB32 }).why, "before-unknown");
  assert.equal(afterReadTarget({ published: true, before: V_BEFORE, list: list([row(V_MINE, JOB32, V_BEFORE)]), job: JOB32 }).id, V_MINE);
});

test("the before-read is one version only when every page agreed on it", () => {
  assert.equal(sameVersion([V_BEFORE, V_BEFORE, V_BEFORE]), V_BEFORE);
  assert.equal(sameVersion([V_BEFORE, V_MINE, V_BEFORE]), "", "a before-read that straddled a publish is not one version");
  assert.equal(sameVersion(["", ""]), "");
  assert.equal(sameVersion(["garbage", "garbage"]), "");
  assert.equal(sameVersion([]), "");
  assert.equal(sameVersion(undefined), "");
});

// A read sequence and a clock that records every nap instead of taking it.
function reader(versions, extra = {}) {
  let n = 0;
  const read = () => { const v = versions[Math.min(n, versions.length - 1)]; n++; return Promise.resolve({ version: v, ...extra }); };
  return { read, count: () => n };
}
function clock() {
  const naps = [];
  return { naps, sleep: (ms) => { naps.push(ms); return Promise.resolve(); } };
}

test("RUN 32'S SHAPE: the old build answers first, and the wait reads on until this job's version does", async () => {
  const r = reader([V_BEFORE, V_BEFORE, V_MINE], { html: "<main>the new page</main>" });
  const c = clock();
  const w = await awaitVersion({ read: r.read, expect: V_MINE, polls: 40, gapMs: 3000, sleep: c.sleep });
  assert.equal(w.kind, "match");
  assert.equal(w.reads, 3, "run 32 read once and stopped; the wait must read past the old build");
  assert.deepEqual(c.naps, [3000, 3000], "a nap between reads, none after the match");
  assert.equal(w.last.html, "<main>the new page</main>", "the page that matched is the page kept");
  // An OLDER build than this job's (the before-read's, or older still) is
  // waited through, never taken.
  const o = await awaitVersion({ read: reader([V_OLDER, V_MINE]).read, expect: V_MINE, sleep: clock().sleep });
  assert.equal(o.kind, "match");
  assert.equal(o.reads, 2);
});

test("a later publish stops the wait at once and is NOT a match", async () => {
  const r = reader([V_BEFORE, V_LATER, V_MINE]);
  const w = await awaitVersion({ read: r.read, expect: V_MINE, polls: 40, sleep: clock().sleep });
  assert.equal(w.kind, "superseded");
  assert.equal(w.seen, V_LATER);
  assert.equal(r.count(), 2, "waiting on after a later version has landed cannot bring this job's back");
});

test("a wait that runs out is a timeout, bounded, and never a match", async () => {
  const c = clock();
  const r = reader([V_BEFORE]);
  const w = await awaitVersion({ read: r.read, expect: V_MINE, polls: 40, gapMs: 3000, sleep: c.sleep });
  assert.equal(w.kind, "timeout");
  assert.equal(w.reads, 40);
  assert.equal(r.count(), 40, "the bound is the number of reads, and it is respected");
  assert.equal(c.naps.length, 39, "no nap after the last read");
  assert.equal(w.seen, V_BEFORE);
  // UNREADABLE AND GARBAGE ARE WAITED THROUGH TOO, and still time out.
  assert.equal((await awaitVersion({ read: reader([""]).read, expect: V_MINE, polls: 3, sleep: clock().sleep })).kind, "timeout");
  assert.equal((await awaitVersion({ read: reader(["x9"]).read, expect: V_MINE, polls: 3, sleep: clock().sleep })).kind, "timeout");
  // A read that answers nothing at all is an unreadable read, not a crash.
  assert.equal((await awaitVersion({ read: () => Promise.resolve(null), expect: V_MINE, polls: 2, sleep: clock().sleep })).kind, "timeout");
  // NO TARGET, NO READS.
  const none = reader([V_MINE]);
  const n = await awaitVersion({ read: none.read, expect: "", sleep: clock().sleep });
  assert.equal(n.kind, "no-target");
  assert.equal(none.count(), 0);
});

const pagesAt = (v) => ({ "/": { version: v }, "/gear": { version: v }, "/prices": { version: v } });
const MINE_TARGET = { ok: true, id: V_MINE, parent: V_BEFORE, rows: 1 };
const MATCHED = { kind: "match", reads: 3, seen: V_MINE };

test("the comparison is VERIFIED only when both reads are tied to this job", () => {
  const v = afterReadVerdict({ published: true, before: V_BEFORE, target: MINE_TARGET, wait: MATCHED, after: pagesAt(V_MINE) });
  assert.equal(v.verified, true);
  assert.equal(v.why, "verified");
  assert.match(verdictSentence(v), /^VERIFIED/);
  assert.match(verdictSentence(v), new RegExp(V_MINE));
  // An edit that did not publish: every page still at the before-read's version.
  const un = afterReadVerdict({ published: false, before: V_BEFORE, target: { ok: true, id: V_BEFORE, parent: "" },
    wait: { kind: "match", reads: 1, seen: V_BEFORE }, after: pagesAt(V_BEFORE) });
  assert.equal(un.verified, true);
  assert.match(verdictSentence(un), /did not publish/);
});

test("RUN 32'S AFTER-READ, AS IT WAS TAKEN, IS UNVERIFIED", () => {
  // The pages it read were the previous build. The old harness compared them
  // anyway and reported no change; the verdict must refuse to.
  const v = afterReadVerdict({ published: true, before: V_BEFORE, target: MINE_TARGET, wait: MATCHED, after: pagesAt(V_BEFORE) });
  assert.equal(v.verified, false);
  assert.equal(v.why, "page-version");
  assert.equal(v.off.length, 3);
  assert.match(verdictSentence(v), /^UNVERIFIED/);
  assert.match(verdictSentence(v), new RegExp(`/ was read at ${V_BEFORE}`));
  // ONE page from the old build is the same defect on one route.
  const one = afterReadVerdict({ published: true, before: V_BEFORE, target: MINE_TARGET, wait: MATCHED,
    after: { "/": { version: V_MINE }, "/gear": { version: V_BEFORE }, "/prices": { version: V_MINE } } });
  assert.equal(one.verified, false);
  assert.deepEqual(one.off, [{ route: "/gear", version: V_BEFORE }]);
});

test("every way a comparison cannot be tied to this job is UNVERIFIED, with its own reason", () => {
  const ok = { published: true, before: V_BEFORE, target: MINE_TARGET, wait: MATCHED, after: pagesAt(V_MINE) };
  const cases = [
    [{ before: "" }, "before-unknown"],
    [{ before: "garbage" }, "before-unknown"],
    [{ target: { ok: false, why: "list-unreadable", status: 503 } }, "list-unreadable"],
    [{ target: { ok: false, why: "not-listed" } }, "not-listed"],
    [{ target: null }, "no-target"],
    // THE JOB STARTED FROM ANOTHER BUILD: a publish sits between the two reads.
    [{ target: { ...MINE_TARGET, parent: V_OLDER } }, "parent-mismatch"],
    [{ target: { ...MINE_TARGET, parent: "" } }, "parent-mismatch"],
    [{ wait: { kind: "timeout", reads: 40, seen: V_BEFORE } }, "timeout"],
    [{ wait: { kind: "superseded", reads: 2, seen: V_LATER } }, "superseded"],
    [{ wait: null }, "no-wait"],
    [{ after: {} }, "no-pages"],
    [{ after: { "/": { version: "" } } }, "page-version"],
  ];
  for (const [change, why] of cases) {
    const v = afterReadVerdict({ ...ok, ...change });
    assert.equal(v.verified, false, `${JSON.stringify(change)} was verified`);
    assert.equal(v.why, why, JSON.stringify(change));
    const said = verdictSentence(v);
    assert.match(said, /^UNVERIFIED — /, `${why} must say UNVERIFIED`);
    assert.doesNotMatch(said, /unrecognised outcome/, `${why} has no sentence of its own`);
  }
  assert.equal(verdictSentence(afterReadVerdict({ ...ok, target: { ok: false, why: "list-unreadable", status: 503 } })).includes("503"), true,
    "the list's status is named");
  assert.match(verdictSentence(afterReadVerdict({ ...ok, wait: { kind: "superseded", seen: V_LATER } })), new RegExp(V_LATER));
  // An edit that did not publish is never held to a parent it does not have.
  const un = afterReadVerdict({ published: false, before: V_BEFORE, target: { ok: true, id: V_BEFORE, parent: "" },
    wait: { kind: "superseded", reads: 1, seen: V_LATER }, after: pagesAt(V_LATER) });
  assert.equal(un.why, "superseded", "a site that moved under an unpublished edit is not this job's outcome");
  assert.match(verdictSentence({ why: "something-new" }), /^UNVERIFIED — unrecognised outcome/);
  assert.match(verdictSentence(null), /^UNVERIFIED/);
});
