// FINISHING QUESTIONS BACK ON A SITE THAT EXISTS — THE OWNER'S REVIEW, THROUGH
// THE REAL ROUTES (2026-10-02).
//
// Owner: *"Fix askRemainder so overlapping model scopes cannot put completed
// work back into the resumed request; verify actual resumed model inputs and
// that completed changes and charges never repeat. Extend clarification into
// the edit models and add-on designers that currently cannot ask … preserving
// completed and remaining operations. Remove the two-question dead end … with
// protection against repeating the same unanswered question. Make request
// replacement and question transitions reliable … Add focused regressions for
// overlapping scopes, a downstream designer asking after earlier work
// completed, a third necessary clarification, failed and raced replacement,
// and recovery after a failed question transition."*
//
// EVERY HOP IS DRIVEN: the real routing route, the real edit route
// (synchronously and as a queued job) with the body the browser's own
// `siteEdit` composes, the real add-on route — and what each model was really
// sent is read off the wire (`seen.inputs`, `seen.picks`, `seen.lanes`,
// `seen.routerAsked`), so "the completed change is not in the resumed request"
// is asked of the requests, never of a helper.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { QUESTION_KEY, readAskRecord, contextBlock } from "../builder/clarify.mjs";
import { MAX_MESSAGE } from "../builder/site-ask.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
import { addon, promptFor } from "./fixtures/addon-route.mjs";
import {
  T, USER, VISIT, VISIT_MOVED, OLD_DESC, NEW_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, browserPost, postRoute, SITE, storedLook, storedPage,
} from "./fixtures/live-ask.mjs";

const DESC_WORDS = "Change the site's search description to \"" + NEW_DESC + "\"";
const MOVE_WORDS = "put the order band above the other one";
const MESSAGE = DESC_WORDS + ". Then " + MOVE_WORDS + ".";
const Q2 = { text: "Which band is the order band — the one about holding a loaf?", options: ["Yes", "No"] };
/** Charges since a moment: debits (an inline edit, a routing call) and reserves (a queued edit). */
const marks = (seen) => ({ debits: seen.debits.length, reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").length });
const charged = (seen, at) => (seen.debits.length - at.debits) + (seen.rpc.filter((r) => r.fn === "edit_reserve").length - at.reserves);
const bandFirst = (src) => typeof src === "string" && src.indexOf("Order a collection") >= 0 && src.indexOf("Order a collection") < src.indexOf("Come to the bakery");

// ─────────────────────────────────────────────────────────────────────────────
// 1. OVERLAPPING SCOPES NEVER PUT COMPLETED WORK BACK INTO THE RESUMED REQUEST
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("OVERLAPPING SCOPES (" + mode + "): the step that asked was given words that include a change made beside it — the question keeps only its own part, and no model the answer reaches is shown the completed change, which is neither made nor charged again", async () => {
    const slug = freshSlug("overlap-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({
        // THE PICKER GAVE THE PAGE STEP WORDS THAT HOLD THE DESCRIPTION'S TOO.
        [T.pick]: [
          { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: DESC_WORDS + ". Then " + MOVE_WORDS }] },
          // …and on the answer, the page step alone, on the words it has left.
          { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE_WORDS }] },
        ],
        "lane:description": NEW_DESC,
        [T.tweak]: [{ source: "", question: Q2 }, { source: VISIT_MOVED }],
        route: { intent: "edit", layer: "look", answered: true },
      }, async (seen) => {
        // THE FIRST MESSAGE: the description runs and is charged; the page step asks.
        const m0 = marks(seen);
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, MESSAGE), mode);
        assert.equal(r.body.ok, true, "the part that could run did not: " + JSON.stringify(r.body).slice(0, 400));
        assert.equal(storedLook(store, slug).description, NEW_DESC);
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "the page whose step asked was changed");
        assert.equal(charged(seen, m0), 1, "the description was not charged once");
        const q = question(store, slug);
        assert.equal(q.id, r.body.clarify.id);
        assert.ok(!q.request.includes(NEW_DESC) && !/description/i.test(q.request),
          "the completed change is in the request the answer resumes: " + JSON.stringify(q.request));
        assert.ok(q.request.includes(MOVE_WORDS), "the asking step's own part was lost: " + JSON.stringify(q.request));
        assert.deepEqual(q.context, [], "a first question carries answers");
        // THE ANSWER, THROUGH THE ROUTING ROUTE: the router is shown what waits, without the completed change.
        const m1 = marks(seen);
        const d = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q.id } })).body;
        assert.equal(d.ask.answered, true, JSON.stringify(d));
        const routerTold = String(seen.routerAsked[0].messages[0].content);
        assert.match(routerTold, /THEIR LAST REQUEST IS WAITING ON AN ANSWER/);
        assert.ok(!routerTold.includes(NEW_DESC), "the router answering the question was shown the completed change");
        assert.ok(!d.instruction.includes(NEW_DESC), "the resumed request carries the completed change: " + d.instruction);
        assert.equal(charged(seen, m1), 1, "the answer's routing call was not charged as any other");
        // THE RESUMED REQUEST: only the page step runs; the description lane is never called again.
        const m2 = marks(seen);
        const post = browserPost(SITE(slug), { ...d, askRound: d.ask.round, putOff: d.ask.putOff, context: d.ask.context }, d.instruction);
        const r2 = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r2.body.ok, true, "the resumed request did not run: " + JSON.stringify(r2.body).slice(0, 400));
        assert.ok(!String(seen.picks[1]).includes(NEW_DESC), "the resumed picker was shown the completed change: " + seen.picks[1]);
        assert.ok(!seen.inputs[T.tweak][1].includes(NEW_DESC), "the resumed page writer was handed the completed change");
        assert.equal(String(seen.writers[1].instruction), MOVE_WORDS, "the resumed page writer's words are not its own part alone");
        assert.ok(seen.inputs[T.tweak][1].endsWith(contextBlock([{ q: Q2.text, a: "Yes" }])), "the page step was not shown the answer, in its own section");
        assert.equal(seen.lanes.filter((l) => l.field === "description").length, 1, "the completed change was made again on the answer");
        assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")), "the part that waited on the answer was not made");
        assert.equal(storedLook(store, slug).description, NEW_DESC);
        assert.equal(charged(seen, m2), 1, "the resumed request charged more than its own one step");
        assert.equal(question(store, slug).status, "answered");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

test("WHEN NOTHING OF THE ASKING PART CAN BE TOLD APART FROM WHAT RAN — the same words given to both steps, or a step that ran on the whole message — the question is not kept and never shown: that part is said as left alone, nothing to resume, nothing done twice", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const SAME = "Change the site's search description to \"" + NEW_DESC + "\" and put the order band above the other one";
    for (const [name, pick] of [
      ["the same words", { fields: ["description", "shape"], scopes: [{ part: "description", words: SAME }, { part: "shape", page: "/visit", words: SAME }] }],
      ["no scopes at all", { fields: ["description", "shape"] }],
    ]) {
      const slug = freshSlug("mixed-" + name.replace(/\W+/g, "-"));
      const store = bucket(slug);
      await withWire({ [T.pick]: pick, "lane:description": NEW_DESC, [T.tweak]: { source: "", question: Q2 } }, async (seen) => {
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, SAME + "."), "sync");
        assert.equal(r.body.ok, true, name + ": " + JSON.stringify(r.body).slice(0, 300));
        assert.equal(storedLook(store, slug).description, NEW_DESC, name + ": what ran was not kept");
        assert.equal(r.body.clarify, undefined, name + ": a question nothing could resume was offered");
        assert.deepEqual(store.questionWrites, [], name + ": a question was kept with completed work in it");
        const part = (r.body.partial || []).find((p) => p && p.layer === "page");
        assert.equal(part && part.error, "clarify-mixed", name + ": " + JSON.stringify(r.body.partial));
        assert.equal(r.body.resume, undefined, name + ": the whole message came back to the box, completed work included");
        const said = editBrowserReply(r.body, true, {});
        assert.ok(said.ok, said.why);
        assert.equal(said.asked, null, name + ": a card was drawn for a question nothing can resume");
        assert.match(said.text, /left it alone rather than risk doing anything twice/, name + ": " + said.text);
      }, { slug });
    }
  } finally { compiler.uninstall(); }
});

test("A RESUMED REQUEST'S ANSWERS REACH EVERY STEP, HOWEVER NARROWLY SCOPED — and stay with what is left: the router's answer is shown to the one scoped step, and when that step asks too, with nothing made beside it, the next question keeps the request with both answers beside it", async () => {
  const slug = freshSlug("answers-kept");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const Q1 = { text: "Which page's band — Home or Visit?", options: ["Home", "Visit"] };
  const SCOPE = { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE_WORDS }] };
  try {
    await withWire({
      route: [{ intent: "clarify", question: Q1 }, { intent: "edit", layer: "look", answered: true }, { intent: "edit", layer: "look", answered: true }],
      [T.pick]: [SCOPE, SCOPE],
      [T.tweak]: [{ source: "", question: Q2 }, { source: VISIT_MOVED }],
    }, async (seen) => {
      const a = (await routeCall(worker, envFor(store), { slug, message: MOVE_WORDS })).body;
      const b = (await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: a.question.id } })).body;
      assert.deepEqual(b.ask.context, [{ q: Q1.text, a: "Visit" }]);
      assert.equal(b.instruction, MOVE_WORDS, "the request grew with its answer");
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...b, askRound: b.ask.round, context: b.ask.context }, b.instruction), "sync");
      assert.match(r.body.clarify && r.body.clarify.id || "", /^[0-9a-f]{32}$/, JSON.stringify(r.body).slice(0, 300));
      // THE SCOPED STEP WAS GIVEN ITS OWN WORDS — AND SHOWN THE ANSWER, which is in no change's words.
      assert.equal(String(seen.writers[0].instruction), MOVE_WORDS, seen.writers[0].instruction);
      assert.ok(seen.inputs[T.tweak][0].endsWith(contextBlock([{ q: Q1.text, a: "Visit" }])), "the scoped step was resumed without the answer");
      const q2 = question(store, slug);
      assert.equal(q2.request, MOVE_WORDS, "what is left grew, or lost its words");
      assert.deepEqual(q2.context, [{ q: Q1.text, a: "Visit" }], "what is left lost the answer it already carried");
      const c = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q2.id } })).body;
      assert.deepEqual(c.ask.context, [{ q: Q1.text, a: "Visit" }, { q: Q2.text, a: "Yes" }]);
      const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...c, askRound: c.ask.round, context: c.ask.context }, c.instruction), "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 300));
      assert.ok(seen.inputs[T.tweak][1].endsWith(contextBlock([{ q: Q1.text, a: "Visit" }, { q: Q2.text, a: "Yes" }])), "the step was not shown both answers");
      assert.equal(String(seen.writers[1].instruction), MOVE_WORDS);
      assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")));
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("BESIDE A CHANGE THAT WAS MADE, AN ANSWER THE PICKER NAMED ONLY FOR THAT CHANGE GOES WITH IT: the description lane is shown the router's answer and makes the change; the page step, named none of it, is shown none; its question keeps only the page step, the made change's answer is kept handled, and no model the answer reaches sees it", async () => {
  const slug = freshSlug("answers-beside");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const Q1 = { text: "What should the new search description say?" };
  const DESC_ASK = "Change the site's search description";
  const message = DESC_ASK + ", then " + MOVE_WORDS + ".";
  try {
    await withWire({
      route: [{ intent: "clarify", question: Q1 }, { intent: "edit", layer: "look", answered: true }, { intent: "edit", layer: "look", answered: true }],
      [T.pick]: [
        // THE PICKER SAYS WHICH ANSWER EACH CHANGE NEEDS: the router's, for the description alone.
        { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_ASK, answers: [1] }, { part: "shape", page: "/visit", words: MOVE_WORDS, answers: [] }] },
        { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE_WORDS }] },
      ],
      "lane:description": NEW_DESC,
      [T.tweak]: [{ source: "", question: Q2 }, { source: VISIT_MOVED }],
    }, async (seen) => {
      const a = (await routeCall(worker, envFor(store), { slug, message })).body;
      const b = (await routeCall(worker, envFor(store), { slug, message: NEW_DESC, ask: { id: a.question.id } })).body;
      const m0 = marks(seen);
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...b, askRound: b.ask.round, context: b.ask.context }, b.instruction), "sync");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
      assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock([{ q: Q1.text, a: NEW_DESC }])), "the picker was not shown the answers it names");
      // THE LANE NEEDED THE ANSWER TO KNOW WHAT TO SET, and its scope held none of it.
      const lane = seen.lanes.filter((l) => l.field === "description");
      assert.equal(lane.length, 1);
      assert.equal(lane[0].asked, DESC_ASK + "\n\n" + contextBlock([{ q: Q1.text, a: NEW_DESC }]), "the description lane was not shown its answer after its own words");
      assert.ok(!seen.inputs[T.tweak][0].includes(NEW_DESC) && !seen.inputs[T.tweak][0].includes(Q1.text), "the page step was shown an answer the picker named for another change");
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      assert.equal(charged(seen, m0), 1);
      const q2 = question(store, slug);
      assert.equal(q2.request, MOVE_WORDS, "what is left carries the made change: " + JSON.stringify(q2.request));
      assert.deepEqual(q2.context, [{ q: Q1.text, a: NEW_DESC, handled: true }], "the made change's answer was not kept handled — or was kept for the step still to do");
      const m1 = marks(seen);
      const c = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q2.id } })).body;
      const routerTold = String(seen.routerAsked[seen.routerAsked.length - 1].messages[0].content);
      assert.ok(!routerTold.includes(NEW_DESC) && !routerTold.includes(Q1.text), "the router answering the question was shown the made change's answer");
      assert.ok(!c.instruction.includes(NEW_DESC), c.instruction);
      assert.deepEqual(c.ask.context, [{ q: Q1.text, a: NEW_DESC, handled: true }, { q: Q2.text, a: "Yes" }]);
      const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...c, askRound: c.ask.round, context: c.ask.context }, c.instruction), "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 300));
      assert.ok(!seen.inputs[T.pick].at(-1).includes(NEW_DESC), "the resumed picker was shown the made change's answer");
      assert.ok(seen.inputs[T.pick].at(-1).endsWith(contextBlock([{ q: Q2.text, a: "Yes" }])), "the resumed picker was not shown the answer still for it");
      assert.equal(seen.lanes.filter((l) => l.field === "description").length, 1, "the made change was made again");
      assert.ok(seen.inputs[T.tweak][1].endsWith(contextBlock([{ q: Q2.text, a: "Yes" }])) && !seen.inputs[T.tweak][1].includes(NEW_DESC), "the page step was not shown only the answer still for it");
      assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")));
      assert.equal(charged(seen, m1), 2, "the answer's routing call and the one step that was left, and nothing more");
    }, { slug });
  } finally { compiler.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE MODELS THAT COULD NOT ASK — after the path was picked, beside work done
// ─────────────────────────────────────────────────────────────────────────────

test("A LANE ASKS AFTER ANOTHER LANE ANSWERED, BESIDE A PAGE CHANGE THAT RUNS: the look step changes nothing, the page change is made and charged, and the answer resumes the look step whole — never the page change", async () => {
  const slug = freshSlug("lane-asks");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const BRAND_WORDS = "Rename us to Harbour Loaf & Co";
  const Q3 = { text: "Should the description mention that loaves can be collected?", options: ["Yes", "No"] };
  try {
    await withWire({
      [T.pick]: [
        { fields: ["brand", "description", "shape"], scopes: [{ part: "brand", words: BRAND_WORDS }, { part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: MOVE_WORDS }] },
        { fields: ["brand", "description"], scopes: [{ part: "brand", words: BRAND_WORDS }, { part: "description", words: DESC_WORDS }] },
      ],
      "lane:brand": "Harbour Loaf & Co",
      // THE DESCRIPTION LANE ASKS ON THE FIRST MESSAGE, AND ACTS ON THE ANSWER.
      "lane:description": (args, n) => (n === 0 ? { question: Q3 } : NEW_DESC),
      [T.tweak]: { source: VISIT_MOVED },
      route: { intent: "edit", layer: "look", answered: true },
    }, async (seen) => {
      const message = BRAND_WORDS + ", " + DESC_WORDS + ". Then " + MOVE_WORDS + ".";
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, message), "sync");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
      assert.ok(seen.lanes.every((l) => l.offered), "a lane was not offered the question");
      assert.equal(storedLook(store, slug).brand, "Harbour Loaf", "a lane that answered was applied although its step asked");
      assert.equal(storedLook(store, slug).description, OLD_DESC, "the lane that asked changed something");
      assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")), "the page change beside the question was not made");
      const q = question(store, slug);
      assert.equal(q.stage, "look");
      assert.ok(q.request.includes(BRAND_WORDS) && q.request.includes(DESC_WORDS), "the look step's own part was not kept whole: " + q.request);
      assert.ok(!q.request.includes(MOVE_WORDS), "the page change that ran is in what the answer resumes: " + q.request);
      const d = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q.id } })).body;
      const writersBefore = seen.writers.length;
      const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction), "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 400));
      assert.equal(seen.writers.length, writersBefore, "the page change that ran was made again on the answer");
      assert.equal(storedLook(store, slug).brand, "Harbour Loaf & Co");
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      const handed = seen.lanes.filter((l) => l.field === "description")[1].asked;
      assert.equal(handed, DESC_WORDS + "\n\n" + contextBlock([{ q: Q3.text, a: "Yes" }]), "the lane was not shown its words, then the answer: " + handed);
      assert.ok(!handed.includes(MOVE_WORDS), "the lane on the answer was shown the page change that ran");
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("THE FULL PAGE WRITER ASKS, after the quick writer could not make the change: nothing is written, published or charged for the edit, and the question is the page step's", async () => {
  const slug = freshSlug("writer-asks");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    await withWire({
      [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE_WORDS }] },
      [T.tweak]: { cannot: "This needs a new section written." },
      [T.pages]: { pages: [], question: Q2 },
    }, async (seen) => {
      const m0 = marks(seen);
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, MOVE_WORDS), "sync");
      assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 400));
      assert.equal(r.body.cost, 0);
      assert.equal(seen.pageWriters.length, 1, "the full page writer was not reached");
      assert.equal(seen.pageWriters[0].offered, true, "the full page writer was not offered the question");
      assert.equal(compiler.calls.length, 0, "something was compiled for a question");
      assert.equal(charged(seen, m0), 0, "a question was charged");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
      const q = question(store, slug);
      assert.equal(q.stage, "page");
      assert.equal(q.request, MOVE_WORDS);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A DOWNSTREAM DESIGNER ASKS AFTER AN EARLIER DESIGNER COMPLETED: nothing of the addition is applied or charged, the whole addition waits on the answer — and resumed, every designer is handed the answer and the addition is applied once", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
  const QJ = { text: "What time of day should the reminder go out?", options: ["9am", "6pm"] };
  const ASK = "remind people the day before";
  const slug = "fw-designer-asks-" + Math.random().toString(16).slice(2, 8);
  // THE FIRST MESSAGE: the function's designer designs, then the job's asks.
  const first = await addon(slug, ASK, { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { question: QJ } } });
  assert.equal(first.body.error, "clarify", JSON.stringify(first.body).slice(0, 300));
  assert.equal(first.body.cost, 0, "a question was charged");
  assert.ok(promptFor(first, "function"), "the earlier designer did not run");
  assert.ok(promptFor(first, "job"), "the designer that asked did not run");
  assert.ok(promptFor(first, "job").props.includes("question"), "the designer was not offered the question");
  assert.ok(!first.sql.some((q) => /\b(create|alter|insert|drop)\b/i.test(q)), "the earlier design was applied before the question: " + first.sql.filter((q) => /create|alter|insert/i.test(q)).join(" | "));
  assert.deepEqual(first.registered, [], "a job was registered for a question");
  const rec = readAskRecord(first.store.store.get(QUESTION_KEY(slug)));
  assert.ok(rec, "the designer's question was not kept");
  assert.equal(rec.stage, "addon");
  assert.equal(rec.request, ASK, "the addition's question does not resume the whole addition");
  assert.deepEqual(rec.context, []);
  assert.match(first.body.clarify.id, /^[0-9a-f]{32}$/);
  // THE ANSWER RESUMES THE WHOLE ADDITION, word for word, with the answer beside it (as the routing route hands it on).
  const told = [{ q: QJ.text, a: "9am" }];
  const again = await addon(slug, rec.request, { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, context: told });
  assert.equal(again.body.ok, true, JSON.stringify(again.body).slice(0, 300));
  const shownAs = JSON.stringify(contextBlock(told)).slice(1, -1);
  for (const kind of ["function", "job"]) {
    assert.ok(promptFor(again, kind).text.includes(shownAs), kind + "'s designer was not shown the answer");
  }
  assert.equal(again.sql.filter((q) => /create\s+(or\s+replace\s+)?function/i.test(q)).length >= 1, true, "the function was not created on the answer");
  assert.equal(again.registered.length, 1, "the job was not registered exactly once");
  assert.ok(again.body.cost > 0, "the addition was not charged when it was made");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A THIRD NECESSARY QUESTION, AND THE SAME QUESTION NEVER TWICE
// ─────────────────────────────────────────────────────────────────────────────

test("A THIRD NECESSARY QUESTION IS ANSWERABLE: the router asks twice and a step a third time; each is kept with its id, and the last answer resumes the original request, word for word, with all three answers beside it", async () => {
  const slug = freshSlug("third");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const R = "Change the site's search description";
  const Q1 = { text: "The search description, or the line in the footer?", options: ["Search", "Footer"] };
  const QB = { text: "What should it say?" };
  const QC = { text: "Should it mention collecting from the counter?", options: ["Yes", "No"] };
  try {
    await withWire({
      route: [
        { intent: "clarify", question: Q1 },
        { intent: "clarify", question: QB, answered: true },
        { intent: "edit", layer: "look", answered: true },
        { intent: "edit", layer: "look", answered: true },
      ],
      [T.pick]: [{ fields: ["description"], question: QC }, { fields: ["description"] }],
      "lane:description": NEW_DESC,
    }, async (seen) => {
      const a = (await routeCall(worker, envFor(store), { slug, message: R })).body;
      const b = (await routeCall(worker, envFor(store), { slug, message: "Search", ask: { id: a.question.id } })).body;
      assert.match(b.question.id, /^[0-9a-f]{32}$/, "the second question was not kept");
      const c = (await routeCall(worker, envFor(store), { slug, message: "Overnight sourdough", ask: { id: b.question.id } })).body;
      const two = [{ q: Q1.text, a: "Search" }, { q: QB.text, a: "Overnight sourdough" }];
      assert.deepEqual(c.ask.context, two);
      assert.equal(c.instruction, R, "the request grew with its answers");
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...c, askRound: c.ask.round, context: c.ask.context }, c.instruction), "sync");
      assert.match(r.body.clarify && r.body.clarify.id || "", /^[0-9a-f]{32}$/, "the third question has nothing waiting on it: " + JSON.stringify(r.body.clarify));
      assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(two)), "the picker that asked third was not shown both answers");
      const q3 = question(store, slug);
      assert.equal(q3.round, 3);
      assert.deepEqual(q3.context, two);
      assert.equal(q3.request, R);
      const d = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q3.id } })).body;
      const three = [...two, { q: QC.text, a: "Yes" }];
      assert.deepEqual(d.ask.context, three, "the resumed request lost an answer");
      assert.equal(d.instruction, R, "the original request is not what the answers resume, word for word");
      const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction), "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 300));
      assert.equal(storedLook(store, slug).description, NEW_DESC);
      assert.equal(seen.lanes[0].asked, R + "\n\n" + contextBlock(three), "the lane was not shown all three answers after the request");
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A QUESTION ALREADY ANSWERED IS NEVER AN ENDING (the owner's second review): the router that asks again what it asked is sent its answer back once; still asking, its question is kept with a note naming the answer that did not settle it — the request waits, nothing discarded, one call billed", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("repeat-route");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    const again = { intent: "clarify", question: { text: Q.text.toUpperCase().replace("—", "-"), options: Q.options }, answered: true };
    await withWire({ route: [again, again] }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "the bigger one", ask: { id: q.id } });
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.intent, "clarify");
      assert.equal(r.body.error, undefined, "a repeated question ended the request");
      assert.equal(seen.routerAsked.length, 2, "the router was not sent its answer back before the question was kept");
      assert.match(String(seen.routerAsked[1].messages[0].content), /YOU ASKED THEM THIS ALREADY, and they answered:\nAsked: “Which page should the band move on — Home or Visit\?” — they answered: “the bigger one”/);
      assert.deepEqual(r.body.decision.reasons, ["pages-filled", "clarify-reused", "clarify-again"], JSON.stringify(r.body.decision));
      assert.match(r.body.question.note, /Your answer — “the bigger one” — didn’t settle this/, "the question asked again carries no note");
      assert.equal(r.body.usage.in, 10, "both routing calls were billed, not the one whose answer was used");
      assert.equal(seen.debits.length, 1, "the routing call was not charged once, as any");
      const kept = question(store, slug);
      assert.equal(kept.id, r.body.question.id, "the question asked again was not kept as the live one");
      assert.equal(kept.status, "pending");
      assert.equal(kept.request, q.request, "the request was discarded or changed");
      assert.deepEqual(kept.context, [{ q: Q.text, a: "the bigger one" }], "the answer that did not settle it was lost");
      assert.equal(kept.note, r.body.question.note);
      assert.equal(kept.round, 2);
    });
  }
  {
    const slug = freshSlug("repeat-step");
    const store = bucket(slug);
    // THE STEP'S TRANSPORT SENDS THE PICKER ITS ANSWER BACK; IT ASKS THE SAME AGAIN; KEPT WITH THE NOTE.
    await withWire({ [T.pick]: [{ fields: ["shape"], question: Q }, { fields: ["shape"], question: Q }] }, async (seen) => {
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [{ q: Q.text, a: "the big one" }] }, "Move the band");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
      assert.equal(seen.inputs[T.pick].length, 2, "the picker was not sent its answer back");
      assert.ok(seen.inputs[T.pick][1].endsWith("Never ask it again. If their answer settles it, act on it now. If it does not, ask them a MORE SPECIFIC question that names exactly what their answer left open."));
      assert.match(r.body.clarify.id, /^[0-9a-f]{32}$/, "a question asked again was not kept");
      assert.match(r.body.clarify.note, /Your answer — “the big one” — didn’t settle this/);
      const kept = question(store, slug);
      assert.equal(kept.request, "Move the band");
      assert.deepEqual(kept.context, [{ q: Q.text, a: "the big one" }]);
      assert.equal(kept.note, r.body.clarify.note);
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
      // THE BROWSER'S OWN READER AND DRAWER: the note above the question, the card on its id.
      const said = editBrowserReply(r.body, true, {});
      assert.equal(said.text, kept.note + "\n" + Q.text, "the browser did not draw the note above the question: " + said.text);
      assert.equal(said.asked && said.asked.id, kept.id, "the question asked again was drawn without its card");
    }, { slug });
  }
});

test("NO REQUEST IS TOO LONG TO BE ASKED ABOUT: the answers ride beside it, so a long request's question is kept — fresh, and resumed — and its request is never cut or grown", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("room-fresh");
    const store = bucket(slug);
    const long = ("Move the order band above the bakery band on the Visit page, please. ").repeat(40).slice(0, MAX_MESSAGE - 5).trim();
    await withWire({ route: { intent: "clarify", question: Q } }, async () => {
      const r = await routeCall(worker, envFor(store), { slug, message: long });
      assert.equal(r.body.error, undefined, JSON.stringify(r.body).slice(0, 300));
      assert.match(r.body.question.id, /^[0-9a-f]{32}$/, "a long request's question was not kept");
      assert.equal(question(store, slug).request, long, "the request was cut");
    });
  }
  {
    const slug = freshSlug("room-resumed");
    const store = bucket(slug);
    const q = seedQuestion(store, slug, { request: "x".repeat(MAX_MESSAGE - 140) });
    await withWire({ route: { intent: "clarify", question: { text: "Above which heading, exactly?" }, answered: true } }, async () => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
      assert.equal(r.body.error, undefined, JSON.stringify(r.body).slice(0, 300));
      const next = question(store, slug);
      assert.equal(next.id, r.body.question.id);
      assert.equal(next.request, q.request, "the long request grew, or was cut");
      assert.deepEqual(next.context, [{ q: Q.text, a: "Visit" }]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. A REPLACEMENT THAT CANNOT CLOSE THE OLD QUESTION DOES NOT GO ON
// ─────────────────────────────────────────────────────────────────────────────

test("A NEW MESSAGE BESIDE A WAITING QUESTION: when closing it fails, or another writer wins, nothing is routed or charged — the store failure holds the message, the lost race says so", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("replace-fail");
    const store = bucket(slug, { failQuestion: true });
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look" } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Make the footer blue" });
      assert.equal(r.body.failed, true, "a replacement went on although the old question could not be closed: " + JSON.stringify(r.body));
      assert.equal(r.body.failure.kind, "store");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.calls, [], "the router was asked although the waiting question could not be closed");
      assert.deepEqual(seen.debits, []);
      assert.equal(question(store, slug).status, "pending", "the waiting question changed");
      assert.equal(question(store, slug).id, q.id);
    });
  }
  {
    const slug = freshSlug("replace-race");
    let other = null;
    const store = bucket(slug, {
      // ANOTHER TAB'S ANSWER WINS BETWEEN THIS MESSAGE'S READ AND ITS CLOSE.
      beforeQuestionPut: (b, v, opts) => {
        if (!opts.onlyIf || other) return;
        other = JSON.stringify({ ...JSON.parse(b.raw(QUESTION_KEY(slug))), status: "answered" });
        b.poke(QUESTION_KEY(slug), other);
      },
    });
    seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look" } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Make the footer blue" });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.equal(r.body.error, "question-busy");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.calls, [], "a replacement that lost its race was routed");
      assert.deepEqual(seen.debits, []);
      assert.equal(store.raw(QUESTION_KEY(slug)), other, "the winner's write was overwritten");
    });
  }
});

test("A MESSAGE THE ROUTER READS AS A NEW REQUEST, NOT AN ANSWER: when closing the waiting question fails or loses, nothing is dispatched or charged", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("supersede-fail");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    store.failQuestion = true;
    await withWire({ route: { intent: "edit", layer: "look", answered: false } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Actually, make the footer blue", ask: { id: q.id } });
      assert.equal(r.body.failed, true, JSON.stringify(r.body));
      assert.equal(r.body.failure.kind, "store");
      assert.equal(r.body.cost, 0, "a routing call whose answer could not be settled was charged");
      assert.equal(r.body.intent === "edit" && r.body.layer, false, "the new request was dispatched");
      assert.deepEqual(seen.debits, []);
    });
    store.failQuestion = false;
    assert.equal(question(store, slug).status, "pending");
  }
  {
    const slug = freshSlug("supersede-race");
    let moved = false;
    const store = bucket(slug, {
      beforeQuestionPut: (b, v, opts) => {
        if (!opts.onlyIf || moved) return;
        moved = true;
        b.poke(QUESTION_KEY(slug), JSON.stringify({ ...JSON.parse(b.raw(QUESTION_KEY(slug))), status: "cancelled" }));
      },
    });
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look", answered: false } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Actually, make the footer blue", ask: { id: q.id } });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.equal(r.body.error, "question-busy");
      assert.deepEqual(seen.debits, [], "a request that lost its race was charged");
      assert.equal(question(store, slug).status, "cancelled", "the winner's close was overwritten");
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECOVERY AFTER A FAILED QUESTION TRANSITION
// ─────────────────────────────────────────────────────────────────────────────

test("AN ANSWER MET WITH THE NEXT QUESTION, WHOSE WRITE FAILS: the answered question is still waiting, so the same answer sent again goes through — and only then is the first question used up", async () => {
  const slug = freshSlug("transition");
  // ONLY STORING THE NEXT QUESTION FAILS: a write that would close the
  // answered one goes through, so two writes (close, then store) would leave
  // nothing waiting — the transition must be the one write that fails whole.
  let seededId = "";
  let failNext = true;
  const store = bucket(slug, {
    beforeQuestionPut: (b, v) => {
      const r = JSON.parse(v);
      if (failNext && r.status === "pending" && r.id !== seededId) throw new Error("r2 down");
    },
  });
  const q = seedQuestion(store, slug, { held: ["add a gallery page"] });
  seededId = q.id;
  const seeded = store.raw(QUESTION_KEY(slug));
  const worker = await loadWorker();
  const NEXT = { text: "Above which heading, exactly?" };
  await withWire({ route: { intent: "clarify", question: NEXT, answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    failNext = false;
    assert.equal(r.body.failed, true, JSON.stringify(r.body));
    assert.equal(r.body.failure.kind, "store");
    assert.equal(r.body.cost, 0);
    assert.deepEqual(seen.debits, [], "a transition that could not be kept was charged");
    assert.equal(store.raw(QUESTION_KEY(slug)), seeded, "the answered question was changed by a transition that did not happen");
  });
  await withWire({ route: { intent: "clarify", question: NEXT, answered: true } }, async () => {
    const again = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(again.status, 200, "the answer sent again was refused: " + JSON.stringify(again.body));
    assert.match(again.body.question.id, /^[0-9a-f]{32}$/);
    const next = question(store, slug);
    assert.equal(next.id, again.body.question.id);
    assert.equal(next.request, q.request, "the request grew at the next question");
    assert.deepEqual(next.held, ["add a gallery page"]);
    assert.deepEqual(next.context, [{ q: Q.text, a: "Visit" }]);
  });
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const stale = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(stale.status, 409, "the first question could still be answered after it was replaced");
    assert.deepEqual(seen.calls, [], "a stale answer reached the router");
  });
});

test("A STEP'S QUESTION WHOSE WRITE FAILS: a blip is ridden out and the question kept; a store that stays down puts the part that asked back in the box, without the change that ran", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    {
      const slug = freshSlug("step-blip");
      const store = bucket(slug, { failQuestionPuts: 1 });
      await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Move the band"), "sync");
        assert.match(r.body.clarify && r.body.clarify.id || "", /^[0-9a-f]{32}$/, "one failed write lost the question: " + JSON.stringify(r.body).slice(0, 300));
        assert.equal(question(store, slug).id, r.body.clarify.id);
      }, { slug });
    }
    {
      const slug = freshSlug("step-down");
      const store = bucket(slug, { failQuestion: true });
      await withWire({
        [T.pick]: { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: MOVE_WORDS }] },
        "lane:description": NEW_DESC,
        [T.tweak]: { source: "", question: Q2 },
      }, async (seen) => {
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, MESSAGE), "sync");
        assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
        assert.equal(storedLook(store, slug).description, NEW_DESC, "the change beside the question was lost");
        assert.equal(r.body.clarify, undefined, "a question that was not kept was offered");
        const part = (r.body.partial || []).find((p) => p && p.layer === "page");
        assert.equal(part && part.error, "clarify-unkept");
        assert.equal(r.body.resume, MOVE_WORDS, "what the question left to do did not come back: " + JSON.stringify(r.body.resume));
        assert.ok(!r.body.resume.includes(NEW_DESC), "the change that ran came back to be sent again");
        assert.ok(part.msg.includes(Q2.text), "the detail it needed was not named");
      }, { slug });
    }
  } finally { compiler.uninstall(); }
});

test("THE WAITING QUESTION THAT CANNOT BE READ IS NOT PASSED BY: a new message beside it is not routed — it could not be closed, so it could still be answered afterwards", async () => {
  const slug = freshSlug("read-fail");
  const store = bucket(slug, { failQuestionRead: true });
  seedQuestion(store, slug);
  const worker = await loadWorker();
  await withWire({ route: { intent: "edit", layer: "look" } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Make the footer blue" });
    assert.equal(r.body.failed, true, "a new message went on past a question nobody could read: " + JSON.stringify(r.body));
    assert.equal(r.body.failure.kind, "store");
    assert.equal(r.body.cost, 0);
    assert.deepEqual(seen.calls, [], "the router was asked");
    assert.deepEqual(seen.debits, []);
  });
});

test("THE NEXT QUESTION'S WRITE LOSING TO ANOTHER WRITER: the answer is refused as stale, no question is shown that was never kept, and the winner's write stands", async () => {
  const slug = freshSlug("replace-race");
  let seededId = "";
  let moved = null;
  const store = bucket(slug, {
    beforeQuestionPut: (b, v, opts) => {
      const r = JSON.parse(v);
      if (moved || !opts.onlyIf || r.id === seededId) return;
      // ANOTHER TAB CANCELS THE QUESTION BETWEEN THIS ANSWER'S READ AND ITS WRITE.
      moved = JSON.stringify({ ...JSON.parse(b.raw(QUESTION_KEY(slug))), status: "cancelled" });
      b.poke(QUESTION_KEY(slug), moved);
    },
  });
  const q = seedQuestion(store, slug);
  seededId = q.id;
  const worker = await loadWorker();
  await withWire({ route: { intent: "clarify", question: { text: "Above which heading, exactly?" }, answered: true } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.error, "stale-question");
    assert.equal(r.body.question, undefined, "a question that was never kept was shown");
    assert.ok(moved, "the race never ran");
    assert.equal(store.raw(QUESTION_KEY(slug)), moved, "the winner's write was overwritten");
  });
});

test("A STEP'S QUESTION ON A LONG REQUEST IS KEPT: nothing is refused for want of room, and the request is kept whole", async () => {
  const slug = freshSlug("step-room");
  const store = bucket(slug);
  const worker = await loadWorker();
  const long = ("Move the order band above the bakery band on the Visit page, please. ").repeat(40).slice(0, MAX_MESSAGE - 60).trim();
  await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
    const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, long), "sync");
    assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
    assert.match(r.body.clarify.id, /^[0-9a-f]{32}$/, "a long request's question was not kept");
    assert.equal(question(store, slug).request, long);
    assert.equal(r.body.resume, undefined, "a kept question also sent the request back to the box");
    assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
  }, { slug });
});

test("THE REMOVAL PICKER ASKS — it cannot tell which entry they mean: the look step takes nothing off and changes nothing, and the question is the look step's", async () => {
  const slug = freshSlug("take-off-asks");
  const store = bucket(slug);
  const look = { ...storedLook(store, slug), langs: ["fr", "es"] };
  store.poke(CONFIG_KEY(slug), JSON.stringify({ look, css: "" }));
  const worker = await loadWorker();
  const QL = { text: "Which language should I stop offering — French or Spanish?", options: ["French", "Spanish", "Both"] };
  await withWire({
    [T.pick]: { fields: ["langs"], removes: ["langs"] },
    [T.takeOff]: { targets: [], question: QL },
  }, async (seen) => {
    const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Stop offering the other language"), "sync");
    assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.cost, 0);
    assert.ok(seen.calls.includes(T.takeOff), "the removal picker was not asked");
    assert.deepEqual(storedLook(store, slug).langs, ["fr", "es"], "something was taken off on a question");
    const q = question(store, slug);
    assert.equal(q.stage, "look");
    assert.equal(q.question.text, QL.text);
    assert.equal(q.request, "Stop offering the other language");
  }, { slug });
});
