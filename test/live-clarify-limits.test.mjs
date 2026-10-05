// NO LIMIT AND NO REPEAT IS PERMISSION TO ACT — THE OWNER'S THIRD REVIEW,
// THROUGH THE REAL ROUTES (2026-10-03).
//
// Owner: *"Fix the clarification limit behavior before deployment.
// clarifyTransport currently strips question fields at the limit and
// dropQuestion removes an unresolved question while retaining proposed edits.
// Never treat a question limit or repeated question as permission to act. If a
// model still needs clarification, preserve the pending request, relevant
// answers, unfinished operations, and attachments; suppress changes
// accompanying that unresolved question. Stop automatic retry loops while
// keeping a user-driven way to clarify or cancel, without requiring the
// original request to be retyped. Apply the same rule to the router and
// downstream edit/add-on calls. Add regressions for both the repeated-question
// threshold and total-answer limit, including responses containing a question
// plus proposed changes; assert no uncertain mutation, publication, or
// execution charge, and verify that a later clear answer resumes only
// unfinished work."*
//
// EVERY MODEL HERE ASKS AND PROPOSES AT ONCE: a question beside a change it
// would make (a photo's new focus, a moved band, a scheduled job, a routing
// layer). Each case reads what really happened — the stored pages, what every
// publish carried, the charges, the stored question, how many times each model
// was called and whether it was offered its question — never a reply count.
//
// THE TWO LIMITS: `MAX_SAME_ASK` (the repeated-question threshold: a question
// the customer has answered that many times) and `MAX_ASKED` (the total-answer
// limit: once a request carries that many answers, nothing is sent to a model
// again on our own). Before this round, at either the model was sent again
// with no question offered, or no call was offered one, and a question in its
// reply was taken out while the change beside it was kept. NEITHER BOUNDS WHAT
// IS KEPT (2026-10-03, the owner's fourth review): every answer stays in the
// request's history (`MAX_HISTORY`), so the cases past the limit here keep
// every answer before it — `live-clarify-history.test.mjs` drives the oldest
// one still needed.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied. Whether a real
// model asks a better question, or acts when it can, is a live measurement.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { QUESTION_KEY, contextBlock, MAX_ASKED, MAX_HISTORY, MAX_SAME_ASK, readAskRecord, againNote, appendAnswer } from "../builder/clarify.mjs";
import { addon, promptFor } from "./fixtures/addon-route.mjs";
import {
  T, HOME, VISIT, VISIT_MOVED, Q, page, SOURCE_KEY, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedPage, userText,
} from "./fixtures/live-ask.mjs";

const PIC = "choose_pictures";
const CONTACT = page("/contact", "<section className=\"find\"><h1>Find us</h1><SafeImage src=\"/u/shop/front.jpg\" alt=\"The shop front at dawn\" /></section>");
const HOME_BIG = HOME.replace("<h1>Harbour Loaf</h1>", "<h1 className=\"text-6xl\">Harbour Loaf</h1>");
const HEADING = "Make the home page heading bigger";
const PHOTO = "show more of the top of the photo";
const MOVE = "put the order band above the other one on the Visit page";
const QPIC = { text: "The shop-front photo shows a sign and a doorway — which should stay in view?", options: ["The sign", "The doorway"] };
const CONTACT_ANSWER = { q: "Which photo do you mean — one on Home or the one on Contact?", a: "Contact" };
// THE PHOTO'S QUESTION, ANSWERED TWICE ALREADY: the second asking worded a
// little differently, as a model words it — the same question all the same.
const SIGN = { q: QPIC.text, a: "The sign, I think" };
const DOOR = { q: "the shop front photo shows a sign and a doorway: which should stay in view", a: "Both really" };
const FOCUS_TOP = { pictures: [{ page: "contact.tsx", alt: "The shop front at dawn", focus: "top" }] };
/** Charges since a moment: debits (an inline edit, a routing call) and reserves (a queued edit). */
const marks = (seen) => ({ debits: seen.debits.length, reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").length });
const charged = (seen, at) => (seen.debits.length - at.debits) + (seen.rpc.filter((r) => r.fn === "edit_reserve").length - at.reserves);
const withContact = (store, slug) => store.poke(SOURCE_KEY(slug), JSON.stringify([
  { path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT },
]));
const SITE3 = (slug) => ({ ...SITE(slug), pages: [{ path: "/" }, { path: "/visit" }, { path: "/contact" }] });
const focusOf = (src) => { const m = /focus="(\w+)"/.exec(String(src || "")); return m ? m[1] : null; };
/** Every source a publish carried, as text. */
const published = (compiler) => compiler.calls.filter((c) => c.url.includes("/build"))
  .map((c) => Object.values((c.body && c.body.files) || {}).map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n"));
/** Whether a model request offered the question field on its tool. */
const offers = (args) => !!(args && Array.isArray(args.tools) && args.tools[0] && args.tools[0].input_schema
  && Object.hasOwn(args.tools[0].input_schema.properties || {}, "question"));

test("THE TWO LIMITS ARE THE ONES THIS FILE DRIVES", () => {
  assert.equal(MAX_SAME_ASK, 2, "the repeated-question threshold moved: these cases no longer sit on it");
  assert.equal(MAX_ASKED, 12, "the total-answer limit moved: these cases no longer sit on it");
  assert.ok(MAX_HISTORY >= MAX_ASKED + 2, "the history no longer holds every answer these cases carry past the limit");
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE REPEATED-QUESTION THRESHOLD
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("THE REPEATED-QUESTION THRESHOLD AT AN EDIT STEP (" + mode + "): the photo step, answered twice, asks again beside a new focus — it is never sent again, the focus is neither made, published nor charged while the heading beside it is; the question keeps the photo's part, every answer and a note; the router asking it once more is held too; and the clear answer resumes the photo alone", async () => {
    const slug = freshSlug("limit-step-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const MESSAGE = HEADING + " and " + PHOTO + ".";
    try {
      // ── THE MESSAGE: the heading runs; the photo step asks a third time, proposing a focus ──
      const offered = [];
      await withWire({
        [T.pick]: { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/", words: HEADING, answers: [] }, { part: "images", words: PHOTO, answers: [1, 2, 3] }] },
        [T.tweak]: { source: HOME_BIG },
        [PIC]: (args) => { offered.push(offers(args)); return { ...FOCUS_TOP, question: QPIC }; },
      }, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: 3, context: [CONTACT_ANSWER, SIGN, DOOR] }, MESSAGE);
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.ok, true, "the heading beside the question did not run" + why);
        // NEVER SENT AGAIN ON OUR OWN, AND OFFERED ITS QUESTION.
        assert.deepEqual(offered, [true], "the photo step was sent again at the threshold, or not offered its question" + why);
        assert.ok(seen.inputs[PIC][0].endsWith(contextBlock([CONTACT_ANSWER, SIGN, DOOR])), "the photo step was not shown the answers that did not settle it");
        // NOTHING PROPOSED BESIDE THE QUESTION IS MADE, PUBLISHED OR CHARGED.
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "the focus proposed beside the unresolved question was made" + why);
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading did not run" + why);
        const pubs = published(compiler);
        assert.ok(pubs.length >= 1 && pubs.some((s) => s.includes("text-6xl")), "the heading was not published" + why);
        assert.ok(pubs.every((s) => focusOf(s) !== "top"), "the focus proposed beside the unresolved question was published" + why);
        assert.equal(charged(seen, m0), 1, "the heading was not charged once, or the photo step that asked was charged" + why);
        // THE QUESTION: the photo's part only, every answer, and a note naming the two that did not settle it.
        const q = question(store, slug);
        assert.ok(q, "the question at the threshold was not kept — the old ending, or the old guess" + why);
        assert.equal(r.body.clarify && r.body.clarify.id, q.id);
        assert.equal(q.stage, "picture");
        assert.equal(q.request, PHOTO, "the question does not resume the unfinished part alone: " + q.request);
        assert.deepEqual(q.context, [CONTACT_ANSWER, SIGN, DOOR], "an answer the unfinished photo still needs was dropped");
        assert.equal(q.note, againNote([SIGN, DOOR]));
        assert.match(q.note, /“The sign, I think”, then “Both really”/, "the note does not name the two answers that did not settle it");
        assert.match(q.note, /Answer once more, or cancel this request/, "the note does not offer both ways on");
        assert.doesNotMatch(q.note, /nothing (has )?changed|nothing was changed/i, "the note says nothing changed, beside a heading that did");
        assert.equal(r.body.clarify.note, q.note, "the card is not shown the note");
        assert.equal(q.round, 4);
      }, { slug });

      // ── THEIR ANSWER: the router asks the same question once more, proposing a layer — held, never sent again ──
      const q1 = question(store, slug);
      const third = { q: QPIC.text, a: "Keep the sign" };
      await withWire({ route: [{ intent: "clarify", question: QPIC, answered: true, layer: "look", page: "/contact" }, { intent: "edit", layer: "look", answered: true }] }, async (seen) => {
        const m1 = marks(seen);
        const d = await routeCall(worker, envFor(store), { slug, message: third.a, ask: { id: q1.id } });
        assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 300));
        assert.equal(seen.routerAsked.length, 1, "the router was sent the request again at the threshold");
        assert.match(String(seen.routerAsked[0].messages[0].content), /A QUESTION MAY BE ASKED/);
        assert.equal(d.body.intent, "clarify", "the router's question at the threshold was turned into work");
        assert.equal(d.body.instruction, undefined, "a request to run rode the held question");
        assert.deepEqual(d.body.decision.reasons, ["tables-none", "pages-filled", "edit-fields-ignored", "clarify-again"], "the layer proposed beside the question was not named and set aside");
        assert.equal(d.body.question.note, againNote([SIGN, DOOR, third]));
        assert.match(d.body.question.note, /“Both really”, then “Keep the sign”/);
        assert.deepEqual(seen.calls, [T.route], "a step ran on the router's held question");
        assert.equal(charged(seen, m1), 1, "only the routing call whose answer was used is billed");
        const q2 = question(store, slug);
        assert.equal(q2.request, PHOTO, "the held question lost the unfinished part");
        assert.deepEqual(q2.context, [CONTACT_ANSWER, SIGN, DOOR, third]);
        assert.equal(q2.note, d.body.question.note);
      }, { slug });

      // ── THE CLEAR ANSWER: the photo alone runs, shown every answer; the heading is neither written nor charged again ──
      const q2 = question(store, slug);
      const fourth = { q: QPIC.text, a: "The sign at the top must stay in view" };
      await withWire({
        route: { intent: "edit", layer: "look", answered: true },
        [T.pick]: { fields: ["images"], scopes: [{ part: "images", words: PHOTO, answers: [1, 2, 3, 4, 5] }] },
        [PIC]: FOCUS_TOP,
      }, async (seen) => {
        const m2 = marks(seen);
        const d = (await routeCall(worker, envFor(store), { slug, message: fourth.a, ask: { id: q2.id } })).body;
        assert.equal(d.instruction, PHOTO, "the clear answer did not resume the unfinished part alone, word for word");
        assert.deepEqual(d.ask.context, [CONTACT_ANSWER, SIGN, DOOR, third, fourth]);
        const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE3(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction), mode);
        assert.equal(r2.body.ok, true, "the resumed photo change did not run: " + JSON.stringify(r2.body).slice(0, 400));
        assert.ok(seen.inputs[PIC][0].endsWith(contextBlock([CONTACT_ANSWER, SIGN, DOOR, third, fourth])), "the photo step was not shown every answer on the clear answer");
        assert.ok(!seen.inputs[T.pick][0].includes(HEADING), "the resumed picker was shown the heading that ran");
        assert.equal(seen.inputs[T.tweak], undefined, "the heading that ran was written again");
        assert.equal(focusOf(storedPage(store, slug, "contact.tsx")), "top", "the photo change was not made on the clear answer");
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG);
        assert.equal(charged(seen, m2), 2, "the answer's routing call and the photo step — and the heading not charged again");
        assert.equal(question(store, slug).status, "answered");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

test("THE REPEATED-QUESTION THRESHOLD AT THE ROUTER: a question answered twice, asked again beside a proposed page change, is held under a note — never sent again with questions closed — keeping the request word for word, its answers, its put-off part and its files; Cancel closes it free; a clear answer resumes it without retyping", async () => {
  const worker = await loadWorker();
  const first = { q: Q.text, a: "the nice one" };
  const second = { q: Q.text, a: "the nicer one" };
  const seed = (store, slug) => seedQuestion(store, slug, { context: [first], note: againNote([first]), round: 2, held: ["add a gallery page"], attached: true });
  // THE ROUTER ASKS IT A THIRD TIME AND PROPOSES WORK; the second reply is
  // what a router told "questions are closed" answers — never asked for now.
  const ROUTE = [{ intent: "clarify", question: Q, answered: true, layer: "page", page: "/visit" }, { intent: "edit", layer: "page", page: "/visit", answered: true }];
  const slug = freshSlug("limit-route-again");
  const store = bucket(slug);
  const q = seed(store, slug);
  await withWire({ route: ROUTE }, async (seen) => {
    const m0 = marks(seen);
    const r = await routeCall(worker, envFor(store), { slug, message: second.a, ask: { id: q.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(seen.routerAsked.length, 1, "the router was sent the request again at the threshold");
    const told = String(seen.routerAsked[0].messages[0].content);
    assert.match(told, /A QUESTION MAY BE ASKED/, "the router was not offered its question");
    assert.doesNotMatch(told, /Questions are closed/);
    assert.equal(r.body.intent, "clarify", "the question at the threshold was turned into work");
    assert.equal(r.body.instruction, undefined);
    assert.equal(r.body.layer, undefined, "the layer proposed beside the question reached the browser");
    assert.deepEqual(r.body.decision.reasons, ["tables-none", "pages-filled", "edit-fields-ignored", "clarify-again"]);
    assert.equal(r.body.question.text, Q.text);
    assert.equal(r.body.question.note, againNote([first, second]));
    assert.match(r.body.question.note, /“the nice one”, then “the nicer one” — haven’t settled it\. Answer once more, or cancel this request/);
    assert.equal(charged(seen, m0), 1, "only the routing call whose answer was used is billed");
    // EVERYTHING THE REQUEST NEEDS, KEPT.
    const kept = question(store, slug);
    assert.notEqual(kept.id, q.id);
    assert.equal(kept.status, "pending");
    assert.equal(kept.request, q.request, "the request was not kept word for word");
    assert.deepEqual(kept.context, [first, second]);
    assert.deepEqual(kept.held, ["add a gallery page"], "the part put off earlier was lost");
    assert.equal(kept.attached, true, "the request's files were forgotten");
    assert.equal(kept.round, 3);
    // A RELOAD GIVES THE CARD BACK, note and all.
    const g = await questionCall(worker, envFor(store), slug, "GET");
    assert.equal(g.body.question.note, kept.note, "a reload loses the note");
    assert.equal(g.body.question.attached, true);
  });
  // A CLEAR ANSWER: the request resumes word for word, nothing retyped.
  const kept = question(store, slug);
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
    const d = (await routeCall(worker, envFor(store), { slug, message: "The one on Visit", ask: { id: kept.id } })).body;
    assert.equal(d.instruction, q.request, "the clear answer did not resume the request word for word");
    assert.deepEqual(d.ask.context, [first, second, { q: Q.text, a: "The one on Visit" }]);
    assert.deepEqual(d.ask.putOff, ["add a gallery page"]);
  });
  // CANCEL, THE OTHER WAY ON: free, once, naming what the request had put off.
  const slug2 = freshSlug("limit-route-cancel");
  const store2 = bucket(slug2);
  const q2 = seed(store2, slug2);
  await withWire({ route: ROUTE }, async () => {
    await routeCall(worker, envFor(store2), { slug: slug2, message: second.a, ask: { id: q2.id } });
  });
  const held = question(store2, slug2);
  await withWire({}, async (seen) => {
    const c = await questionCall(worker, envFor(store2), slug2, "POST", { id: held.id, cancel: true });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.cancelled, true);
    assert.deepEqual(c.body.putOff, ["add a gallery page"]);
    assert.deepEqual(seen.calls, [], "cancelling asked a model");
    assert.deepEqual(seen.debits, [], "cancelling was charged");
    assert.equal(question(store2, slug2).status, "cancelled");
  });
});

test("BELOW THE THRESHOLD AND THE LIMIT, THE ROUTER'S ONE RE-SEND STILL OFFERS ITS QUESTION: its answer goes in front of it, and questions are never closed for it — at one answer, and at eleven", async () => {
  const worker = await loadWorker();
  const SPECIFIC = { text: "The band that says “Order a collection so we hold a loaf” — on Home, or on Visit?", options: ["Home", "Visit"] };
  for (const earlier of [0, MAX_ASKED - 2]) {
    const slug = freshSlug("limit-route-below-" + earlier);
    const store = bucket(slug);
    const told = Array.from({ length: earlier }, (_, i) => ({ q: "Detail " + i + "?", a: "Answer " + i }));
    const q = seedQuestion(store, slug, { context: told, round: earlier + 1 });
    await withWire({ route: [{ intent: "clarify", question: Q, answered: true }, { intent: "clarify", question: SPECIFIC, answered: true }] }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "the nice one", ask: { id: q.id } });
      const why = " (" + (earlier + 1) + " answers): " + JSON.stringify(r.body).slice(0, 300);
      assert.equal(seen.routerAsked.length, 2, "below the threshold and the limit the router was not sent its answer back" + why);
      const again = String(seen.routerAsked[1].messages[0].content);
      assert.match(again, /YOU ASKED THEM THIS ALREADY/, "the re-send was not shown the answer" + why);
      assert.match(again, /A QUESTION MAY BE ASKED/, "the router's re-send was not offered its question" + why);
      assert.doesNotMatch(again, /Questions are closed/, "the router's re-send closed questions — permission to act on a guess" + why);
      assert.equal(r.body.question.text, SPECIFIC.text, "the more specific question was not kept" + why);
      assert.deepEqual(r.body.decision.reasons, ["tables-none", "pages-filled", "clarify-reused"]);
      assert.deepEqual(question(store, slug).context, [...told, { q: Q.text, a: "the nice one" }]);
    });
  }
});

test("THE REPEATED-QUESTION THRESHOLD AT THE ADD-ON: the job's designer, answered twice, asks again beside a schedule, after the function's designer finished — nothing of the addition is applied, registered or charged and the designer is never sent again; the clear answer applies the whole addition once", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
  const QJ = { text: "What time of day should the reminder go out?", options: ["9am", "6pm"] };
  const ASK = "remind people the day before";
  const twice = [{ q: QJ.text, a: "in the morning" }, { q: "what time of day should the reminder go out", a: "early on" }];
  const slug = "fw-limit-addon-" + Math.random().toString(16).slice(2, 8);
  const first = await addon(slug, ASK, { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { question: QJ, job: [JOB] } }, context: twice });
  const why = JSON.stringify(first.body).slice(0, 300);
  assert.equal(first.body.error, "clarify", "the question beside the schedule was not asked: " + why);
  assert.equal(first.body.cost, 0, "the question was charged");
  assert.equal(first.prompts.filter((p) => p.kind === "job").length, 1, "the job's designer was sent again at the threshold");
  assert.ok(promptFor(first, "job").props.includes("question"), "the designer was not offered its question");
  assert.ok(!first.sql.some((s) => /\b(create|alter|insert|drop)\b/i.test(s)), "a design was applied beside the unresolved question: " + first.sql.filter((s) => /create|alter|insert/i.test(s)).join(" | "));
  assert.deepEqual(first.registered, [], "the schedule proposed beside the question was registered");
  const rec = readAskRecord(first.store.store.get(QUESTION_KEY(slug)));
  assert.ok(rec, "the designer's question at the threshold was not kept");
  assert.equal(rec.stage, "addon");
  assert.equal(rec.request, ASK, "the whole addition does not wait on the answer");
  assert.deepEqual(rec.context, twice);
  assert.equal(rec.note, againNote(twice));
  assert.equal(first.body.clarify.note, rec.note, "the card is not shown the note");
  // THE CLEAR ANSWER, as the routing route hands it on: the whole addition, applied once.
  const told = appendAnswer(rec.context, { q: QJ.text, a: "9am" });
  const again = await addon(slug, rec.request, { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, context: told });
  assert.equal(again.body.ok, true, JSON.stringify(again.body).slice(0, 300));
  assert.ok(promptFor(again, "job").text.includes(JSON.stringify(contextBlock(told)).slice(1, -1)), "the designer was not shown every answer");
  assert.ok(again.sql.some((s) => /create\s+(or\s+replace\s+)?function/i.test(s)), "the function was not created on the clear answer");
  assert.equal(again.registered.length, 1, "the job was not registered exactly once");
  assert.ok(again.body.cost > 0, "the addition was not charged when it was made");
});

test("THE REPEATED-QUESTION THRESHOLD AT THE ADD-ON PICKER: asked again beside the kinds it would add, it is called once, nothing is designed or charged, and the question is kept with its note", async () => {
  const slug = freshSlug("limit-adds");
  const store = bucket(slug);
  const worker = await loadWorker();
  const QA = { text: "Should the new page list every loaf, or only today's bake?", options: ["Every loaf", "Today's bake"] };
  const twice = [{ q: QA.text, a: "the loaves" }, { q: QA.text, a: "all of them I suppose" }];
  const offered = [];
  await withWire({ [T.adds]: (args) => { offered.push(offers(args)); return { kinds: ["page"], question: QA }; } }, async (seen) => {
    const m0 = marks(seen);
    const post = browserPost(SITE(slug), { intent: "addon", askRound: 2, context: twice }, "Add a page for our breads");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.cost, 0);
    assert.deepEqual(offered, [true], "the picker was sent again at the threshold, or not offered its question");
    assert.deepEqual(seen.calls, [T.adds], "something was designed beside the picker's question");
    assert.equal(charged(seen, m0), 0);
    const q = question(store, slug);
    assert.equal(q.request, "Add a page for our breads");
    assert.deepEqual(q.context, twice);
    assert.equal(q.note, againNote(twice));
  }, { slug });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE TOTAL-ANSWER LIMIT
// ─────────────────────────────────────────────────────────────────────────────

test("THE TOTAL-ANSWER LIMIT AT THE ROUTER: the twelfth answer is still met with a question — offered and kept beside a proposed layer; the thirteenth joins every answer before it, none let go, and a question it already has an answer to is held, never sent again; a clear answer resumes the request word for word with every answer kept", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("limit-route-total");
  const store = bucket(slug);
  // ELEVEN ANSWERS SO FAR; the second about a part already made.
  const eleven = Array.from({ length: MAX_ASKED - 1 }, (_, i) => ({ q: "Detail " + i + "?", a: "Answer " + i, ...(i === 1 ? { handled: true } : {}) }));
  const q = seedQuestion(store, slug, { context: eleven, round: 12, held: ["add a gallery page"], attached: true });
  const QN = { text: "Should the band keep its photo?", options: ["Yes", "No"] };
  const twelfth = { q: Q.text, a: "Visit" };
  await withWire({ route: [{ intent: "clarify", question: QN, answered: true, layer: "look" }, { intent: "edit", layer: "look", answered: true }] }, async (seen) => {
    const m0 = marks(seen);
    const r = await routeCall(worker, envFor(store), { slug, message: twelfth.a, ask: { id: q.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    const told = String(seen.routerAsked[0].messages[0].content);
    assert.match(told, /A QUESTION MAY BE ASKED/, "a request at its twelfth answer was not offered a question");
    assert.doesNotMatch(told, /Questions are closed/, "the total-answer limit closed questions — permission to act on a guess");
    assert.equal(seen.routerAsked.length, 1);
    assert.equal(r.body.intent, "clarify", "the question at the limit was turned into work");
    assert.deepEqual(r.body.decision.reasons, ["tables-none", "pages-filled", "edit-fields-ignored"]);
    assert.equal(r.body.question.note, undefined, "a new question carries a note");
    assert.equal(charged(seen, m0), 1);
    const kept = question(store, slug);
    assert.deepEqual(kept.context, [...eleven, twelfth], "the twelfth answer was not kept beside the request");
    assert.equal(kept.request, q.request);
    assert.deepEqual(kept.held, ["add a gallery page"]);
    assert.equal(kept.attached, true);
  });
  // THE THIRTEENTH: it joins all twelve — the handled one too, kept below the
  // history's bound; "Detail 4?" is answered already, so it is held.
  const k1 = question(store, slug);
  const thirteenth = { q: QN.text, a: "No photo" };
  const thirteen = [...eleven, twelfth, thirteenth];
  await withWire({ route: [{ intent: "clarify", question: { text: "Detail 4?" }, answered: true, layer: "look" }, { intent: "edit", layer: "look", answered: true }] }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: thirteenth.a, ask: { id: k1.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(seen.routerAsked.length, 1, "the router was sent again past the total-answer limit");
    assert.equal(r.body.intent, "clarify");
    assert.deepEqual(r.body.decision.reasons, ["tables-none", "pages-filled", "edit-fields-ignored", "clarify-again"]);
    assert.equal(r.body.question.note, againNote([{ q: "Detail 4?", a: "Answer 4" }]));
    const kept = question(store, slug);
    assert.equal(kept.context.length, MAX_ASKED + 1, "an answer was let go because twelve already existed");
    assert.deepEqual(kept.context, thirteen, "the thirteenth answer did not join every answer before it");
    assert.equal(kept.request, q.request);
    assert.deepEqual(kept.held, ["add a gallery page"]);
    assert.equal(kept.attached, true);
  });
  // A CLEAR ANSWER: word for word, and the earlier answer to the question
  // answered again stays beside it — the later one never replaces its details.
  const k2 = question(store, slug);
  const clear = { q: "Detail 4?", a: "Answer 4, as I said" };
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
    const d = (await routeCall(worker, envFor(store), { slug, message: clear.a, ask: { id: k2.id } })).body;
    assert.equal(d.instruction, q.request, "the clear answer did not resume the request word for word");
    assert.deepEqual(d.ask.context, [...thirteen, clear], "an answer was let go — the earlier answer to the question answered again, or another");
    assert.deepEqual(d.ask.putOff, ["add a gallery page"]);
  });
});

for (const mode of ["sync", "job"]) {
  test("THE TOTAL-ANSWER LIMIT AT AN EDIT STEP (" + mode + "): carrying twelve answers, the move's writer is still offered its question and asks one it has an answer to, beside the moved page — never sent again; the move is neither made, published nor charged while the heading is; the thirteenth answer joins all twelve, the finished heading's kept handled and never shown, and resumes the move alone", async () => {
    const slug = freshSlug("limit-total-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const MESSAGE = HEADING + " and " + MOVE + ".";
    const HOW_BIG = { q: "How much bigger?", a: "Twice the size" };
    const moves = Array.from({ length: MAX_ASKED - 1 }, (_, i) => ({ q: "Detail " + i + "?", a: "Answer " + i }));
    const twelve = [...moves, HOW_BIG];
    const isMove = (args) => userText(args).includes(MOVE);
    try {
      const offered = [];
      await withWire({
        [T.pick]: { fields: ["shape"], scopes: [
          { part: "shape", page: "/", words: HEADING, answers: [12] },
          { part: "shape", page: "/visit", words: MOVE, answers: moves.map((_, i) => i + 1) },
        ] },
        [T.tweak]: (args) => {
          if (!isMove(args)) return { source: HOME_BIG };
          offered.push(offers(args));
          return { source: VISIT_MOVED, question: { text: "Detail 3?" } };
        },
      }, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: MAX_ASKED, context: twelve }, MESSAGE);
        assert.deepEqual(post.body.context, twelve, "the browser did not post all twelve answers");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.ok, true, "the heading beside the question did not run" + why);
        assert.deepEqual(offered, [true], "the move's writer was not offered its question at the limit, or was sent again" + why);
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "the move proposed beside the unresolved question was made" + why);
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading did not run" + why);
        const pubs = published(compiler);
        assert.ok(pubs.some((s) => s.includes("text-6xl")), "the heading was not published" + why);
        assert.ok(pubs.every((s) => !s.includes(VISIT_MOVED.slice(VISIT_MOVED.indexOf("<main>")))), "the move proposed beside the unresolved question was published" + why);
        assert.equal(charged(seen, m0), 1, "the heading was not charged once, or the move that asked was charged" + why);
        const q = question(store, slug);
        assert.ok(q, "a question at the total-answer limit was not kept" + why);
        assert.equal(q.request, MOVE, "the question does not resume the unfinished move alone: " + q.request);
        assert.deepEqual(q.context, [...moves, { ...HOW_BIG, handled: true }], "the move's answers were not kept, or the heading's went with them unmarked");
        assert.equal(q.note, againNote([{ q: "Detail 3?", a: "Answer 3" }]));
      }, { slug });
      // THE THIRTEENTH ANSWER, AND ONLY THE MOVE.
      const q1 = question(store, slug);
      const thirteenth = { q: "Detail 3?", a: "The third band, I mean" };
      await withWire({
        route: { intent: "edit", layer: "look", answered: true },
        [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: MOVE, answers: Array.from({ length: MAX_ASKED }, (_, i) => i + 1) }] },
        [T.tweak]: (args) => (isMove(args) ? { source: VISIT_MOVED } : { source: HOME_BIG }),
      }, async (seen) => {
        const m1 = marks(seen);
        const d = (await routeCall(worker, envFor(store), { slug, message: thirteenth.a, ask: { id: q1.id } })).body;
        assert.equal(d.instruction, MOVE, "the clear answer did not resume the unfinished move alone");
        assert.deepEqual(d.ask.context, [...moves, { ...HOW_BIG, handled: true }, thirteenth], "the thirteenth answer cost an earlier one its place");
        const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction), mode);
        assert.equal(r2.body.ok, true, "the resumed move did not run: " + JSON.stringify(r2.body).slice(0, 400));
        assert.equal(seen.inputs[T.tweak].length, 1, "the heading that ran was written again");
        assert.ok(seen.inputs[T.tweak][0].endsWith(contextBlock([...moves, thirteenth])), "the move was not shown every answer it keeps");
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT_MOVED, "the move was not made on the clear answer");
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG);
        assert.equal(charged(seen, m1), 2, "the answer's routing call and the move — and the heading not charged again");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

test("THE TOTAL-ANSWER LIMIT AT THE ADD-ON: carrying twelve answers, the job's designer is offered its question and asks a new one beside a schedule — nothing is applied, registered or charged, and the question keeps all twelve", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
  const QJ = { text: "Should it go out on Sundays too?", options: ["Yes", "No"] };
  const twelve = Array.from({ length: MAX_ASKED }, (_, i) => ({ q: "Reminder detail " + i + "?", a: "Answer " + i }));
  const slug = "fw-limit-addon-total-" + Math.random().toString(16).slice(2, 8);
  const r = await addon(slug, "remind people the day before", { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { question: QJ, job: [JOB] } }, context: twelve });
  assert.equal(r.body.error, "clarify", "a question at the total-answer limit was not asked: " + JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.cost, 0);
  assert.ok(promptFor(r, "job").props.includes("question"), "the designer was not offered its question at the limit");
  assert.equal(r.prompts.filter((p) => p.kind === "job").length, 1, "the designer was sent again");
  assert.ok(!r.sql.some((s) => /\b(create|alter|insert|drop)\b/i.test(s)), "a design was applied beside the unresolved question");
  assert.deepEqual(r.registered, []);
  const rec = readAskRecord(r.store.store.get(QUESTION_KEY(slug)));
  assert.ok(rec, "the question at the limit was not kept");
  assert.deepEqual(rec.context, twelve, "an answer was dropped from the question at the limit");
  assert.equal(Object.hasOwn(rec, "note"), false);
});
