// THE ANSWER HISTORY IS NEVER A WINDOW — THE OWNER'S FOURTH REVIEW, THROUGH THE
// REAL ROUTES (2026-10-03).
//
// Owner: *"Fix only the remaining answer-retention issue: appendAnswer must not
// discard an answer needed by unfinished work merely because 12 answers already
// exist. Separate the stored clarification history from any bounded model-input
// window; preserve relevant answers durably and retrieve them for the operations
// that need them. Do not infer irrelevance from age or assume a later answer to
// the same question replaces all earlier details. Add a regression with 13
// distinct answers where the oldest Contact-photo answer remains necessary, then
// verify refresh and resume preserve it without repeating completed work or
// asking the user to supply it again."*
//
// THE CASE: a heading change and a photo change in one message. The heading is
// made; the photo step still needs the very first answer the request was given
// — that the photo is the one on the Contact page — while thirteen distinct
// answers pile up. Before this round the thirteenth answer pushed the oldest
// out of the list (`appendAnswer`'s "else the oldest"), so the photo step,
// resumed, could no longer tell which photo was meant.
//
// EVERY HOP IS DRIVEN: the real routing route for each answer, the real owner
// route for a reload, the browser's own post, its job record across a reload
// and its hand-over, and the real edit route — synchronously and as a queued
// job. What each model was really sent is read off the wire.
//
// THE HISTORY AND WHAT A MODEL IS SHOWN ARE TWO THINGS: every answer is kept
// (`MAX_HISTORY`, `appendAnswer`); each step is shown the answers the picker
// named for its change, with the ones it named for none (`eCtxOf`). The second
// case drives that past the total-answer limit: the oldest answer goes to the
// step that needs it and to no other. The last cases are the history's own
// bound, refused rather than kept by forgetting, and the add-on route.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: which answers a real picker names for a change
// is a live measurement.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { QUESTION_KEY, CONTEXT_HEADING, contextBlock, againNote, readAskRecord, MAX_ASKED, MAX_HISTORY, MAX_ANSWER_CHARS } from "../builder/clarify.mjs";
import { addon, promptFor } from "./fixtures/addon-route.mjs";
import {
  T, HOME, VISIT, Q, page, SOURCE_KEY, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedPage, userText,
} from "./fixtures/live-ask.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const PIC = "choose_pictures";
const CONTACT = page("/contact", "<section className=\"find\"><h1>Find us</h1><SafeImage src=\"/u/shop/front.jpg\" alt=\"The shop front at dawn\" /></section>");
const HOME_BIG = HOME.replace("<h1>Harbour Loaf</h1>", "<h1 className=\"text-6xl\">Harbour Loaf</h1>");
const HEADING = "Make the home page heading bigger";
const PHOTO = "show more of the top of the photo";
const MESSAGE = HEADING + " and " + PHOTO + ".";
// THE OLDEST ANSWER, AND STILL NEEDED: which photo the request is about.
const CONTACT_ANSWER = { q: "Which photo do you mean — one on Home or the one on Contact?", a: "Contact" };
// TEN MORE, EACH ABOUT A DIFFERENT DETAIL — none asks the Contact question again.
const DETAILS = [
  ["How much more of the top should show — a little or a lot?", "A good deal more"],
  ["Should the shop sign stay readable?", "Yes, every letter"],
  ["Keep the doorway in the frame?", "Yes, the whole door"],
  ["Does the dawn light matter?", "Very much"],
  ["Should any of the street show?", "Only a sliver"],
  ["Anything to keep out of view?", "The bins on the left"],
  ["Should the photo keep its size?", "Same size"],
  ["Lighter, darker, or as it is?", "As it is"],
  ["Is the awning important?", "Keep the awning"],
  ["Should the crop stay centred?", "Centred"],
].map(([q, a]) => ({ q, a }));
// THE THREE ASKED ON THE WAY: the photo step's, then two of the router's.
const Q12 = { text: "Should the window display show too?", options: ["Yes", "No"] };
const Q13 = { text: "The top edge — up to the roofline, or just above the sign?", options: ["The roofline", "Just above the sign"] };
const Q14 = { text: "Is the chimney in or out?", options: ["In", "Out"] };
const A12 = { q: Q12.text, a: "Yes, the loaves in the window" };
const A13 = { q: Q13.text, a: "Up to the roofline" };
const A14 = { q: Q14.text, a: "In, keep the chimney" };
const FOCUS_TOP = { pictures: [{ page: "contact.tsx", alt: "The shop front at dawn", focus: "top" }] };
/** The Contact answer as a model is shown it, in its numbered section. */
const SHOWN_CONTACT = "Asked: “" + CONTACT_ANSWER.q + "”\n   They answered: “" + CONTACT_ANSWER.a + "”";
const marks = (seen) => ({ debits: seen.debits.length, reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").length });
const charged = (seen, at) => (seen.debits.length - at.debits) + (seen.rpc.filter((r) => r.fn === "edit_reserve").length - at.reserves);
const withContact = (store, slug) => store.poke(SOURCE_KEY(slug), JSON.stringify([
  { path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT },
]));
const SITE3 = (slug) => ({ ...SITE(slug), pages: [{ path: "/" }, { path: "/visit" }, { path: "/contact" }] });
const focusOf = (src) => { const m = /focus="(\w+)"/.exec(String(src || "")); return m ? m[1] : null; };

for (const mode of ["sync", "job"]) {
  test("THIRTEEN DISTINCT ANSWERS AND THE OLDEST STILL NEEDED (" + mode + "): the Contact-photo answer, given first, survives the thirteenth answer in the stored question and a reload; resumed, the photo step is handed it and makes the change — the heading is neither written nor charged again, and nobody asks which photo again", async () => {
    const slug = freshSlug("history-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const ELEVEN = [CONTACT_ANSWER, ...DETAILS];
    try {
      // ── THE MESSAGE: the heading is made; the photo step asks a twelfth question ──
      await withWire({
        [T.pick]: { fields: ["shape", "images"], scopes: [
          { part: "shape", page: "/", words: HEADING, answers: [] },
          { part: "images", words: PHOTO, answers: ELEVEN.map((_, i) => i + 1) },
        ] },
        [T.tweak]: { source: HOME_BIG },
        [PIC]: { pictures: [], question: Q12 },
      }, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: ELEVEN.length, context: ELEVEN }, MESSAGE);
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.body.ok, true, "the heading did not run: " + JSON.stringify(r.body).slice(0, 400));
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG);
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "the photo whose step asked was changed");
        assert.equal(charged(seen, m0), 1, "the heading was not charged once");
        // THE HEADING'S WRITER IS SHOWN NONE OF THE PHOTO'S ANSWERS: the picker
        // named every one for the photo, none for the heading.
        assert.ok(!seen.inputs[T.tweak][0].includes(CONTEXT_HEADING), "the heading's writer was handed answers the picker named for the photo");
        const q = question(store, slug);
        assert.equal(q.request, PHOTO);
        assert.deepEqual(q.context, ELEVEN, "the photo's eleven answers were not all kept with its question");
      }, { slug });

      // ── THE TWELFTH AND THIRTEENTH ANSWERS: the router asks twice more ──
      for (const [answer, next] of [[A12, Q13], [A13, Q14]]) {
        const waiting = question(store, slug);
        await withWire({ route: [{ intent: "clarify", question: next, answered: true }] }, async (seen) => {
          const r = await routeCall(worker, envFor(store), { slug, message: answer.a, ask: { id: waiting.id } });
          assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
          assert.equal(r.body.question.text, next.text);
          assert.ok(String(seen.routerAsked[0].messages[0].content).includes(SHOWN_CONTACT), "the router was not shown the Contact answer under the waiting request");
        });
      }

      // ── THIRTEEN DISTINCT ANSWERS, STORED, AND ACROSS A RELOAD ──
      const thirteen = [...ELEVEN, A12, A13];
      const stored = question(store, slug);
      assert.equal(new Set(thirteen.map((p) => p.q)).size, 13, "the case's thirteen answers are not distinct");
      assert.ok(thirteen.length > MAX_ASKED, "the case no longer passes the total-answer limit");
      assert.deepEqual(stored.context, thirteen, "the stored question let an answer go at thirteen — the oldest, the Contact photo, was pushed out");
      assert.equal(stored.request, PHOTO, "the question lost the unfinished photo change");
      await withWire({}, async (seen) => {
        const g = await questionCall(worker, envFor(store), slug, "GET");
        assert.equal(g.status, 200);
        assert.equal(g.body.question.text, Q14.text, "a reload lost the waiting question");
        assert.deepEqual(JSON.parse(store.raw(QUESTION_KEY(slug))).context, thirteen, "the record a reload reads does not hold every answer");
        assert.deepEqual(seen.calls, [], "a reload asked a model");
      });

      // ── THE CLEAR ANSWER: the photo alone resumes, handed the oldest answer ──
      const fourteen = [...thirteen, A14];
      const last = question(store, slug);
      const writesBefore = store.questionWrites.length;
      const offered = [];
      await withWire({
        route: { intent: "edit", layer: "look", answered: true },
        // THE PICKER NAMES WHAT THE PHOTO NEEDS: the first answer and the last two.
        [T.pick]: { fields: ["images"], scopes: [{ part: "images", words: PHOTO, answers: [1, 13, 14] }] },
        // THE PHOTO STEP ACTS ONLY WHEN IT KNOWS WHICH PHOTO; without the Contact
        // answer it would have to ask the customer again.
        [PIC]: (args) => {
          offered.push(userText(args).includes(SHOWN_CONTACT));
          return userText(args).includes(SHOWN_CONTACT) ? FOCUS_TOP : { pictures: [], question: { text: CONTACT_ANSWER.q, options: ["Home", "Contact"] } };
        },
      }, async (seen) => {
        const m1 = marks(seen);
        const d = (await routeCall(worker, envFor(store), { slug, message: A14.a, ask: { id: last.id } })).body;
        assert.equal(d.instruction, PHOTO, "the clear answer did not resume the unfinished photo change alone");
        assert.deepEqual(d.ask.context, fourteen, "the resumed request does not carry every answer");
        const post = browserPost(SITE3(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction);
        assert.deepEqual(post.body.context, fourteen, "the browser did not post every answer");
        // A RELOAD WHILE THE RESUMED EDIT RUNS: the browser's job record, and a hand-over from it.
        const mem = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
        EditPoll.rememberJob(slug, "job-history", mem, { ask: PHOTO, op: "edit", context: post.body.context, askRound: d.ask.round });
        const back = EditPoll.resumableRecord(slug, Date.now(), mem);
        assert.deepEqual(back.context, fourteen, "a reload during the edit lost an answer");
        const hop = EditPoll.handOver({ layer: "look", context: back.context, askRound: back.askRound }, { layer: "addon" }, { from: "look", reply: { reason: "addon" } });
        assert.deepEqual(hop.context, fourteen, "a hand-over after a reload lost an answer");
        // THE EDIT ITSELF.
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.ok, true, "the resumed photo change did not run" + why);
        assert.equal(r.body.clarify, undefined, "the customer was asked again" + why);
        assert.deepEqual(offered, [true], "the photo step was not handed the Contact answer it needs" + why);
        assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(fourteen)), "the picker was not shown every answer still needed");
        // THE PHOTO STEP IS SHOWN THE THREE THE PICKER NAMED FOR IT AND THE
        // ELEVEN IT NAMED FOR NO CHANGE — which could be anybody's, so never
        // withheld — the Contact answer first: no other change is left to
        // claim any.
        assert.ok(seen.inputs[PIC][0].endsWith(contextBlock(fourteen)), "the photo step was not shown every answer still needed, the oldest first");
        assert.equal(focusOf(storedPage(store, slug, "contact.tsx")), "top", "the photo change was not made");
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading moved again");
        assert.equal(seen.inputs[T.tweak], undefined, "the heading that ran was written again");
        assert.equal(charged(seen, m1), 2, "the answer's routing call and the photo step — and the heading not charged again");
        // THE ONLY WRITE TO THE QUESTION IS ITS CLOSE: none was kept after the clear answer.
        assert.deepEqual(store.questionWrites.slice(writesBefore).map((w) => JSON.parse(w).status), ["answered"], "a question was kept after the clear answer");
        assert.equal(question(store, slug).status, "answered");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

// THE OLDEST ANSWER IS STILL ONE OF THEIRS: a model that asks it again past
// the total-answer limit is never sent again (the owner's third review), and
// the question goes to the customer under a note naming the answer they gave —
// never put as a new question, as if that answer had aged out.
const ASK_CONTACT = { text: CONTACT_ANSWER.q, options: ["Home", "Contact"] };

test("PAST THE TOTAL-ANSWER LIMIT THE OLDEST ANSWER STILL COUNTS AT THE ROUTER: asked again with the thirteenth answer, the Contact question is held under a note naming the Contact answer, the router is not sent again, and every answer stays", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("history-route-oldest");
  const store = bucket(slug);
  const twelve = [CONTACT_ANSWER, ...DETAILS, A12];
  const q = seedQuestion(store, slug, { question: Q13, request: PHOTO, context: twelve, round: 13 });
  await withWire({ route: [{ intent: "clarify", question: ASK_CONTACT, answered: true }, { intent: "edit", layer: "look", answered: true }] }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: A13.a, ask: { id: q.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(seen.routerAsked.length, 1, "the router was sent again past the total-answer limit");
    assert.equal(r.body.intent, "clarify");
    assert.ok(r.body.decision.reasons.includes("clarify-again"), "the oldest answer was not found among theirs: " + JSON.stringify(r.body.decision));
    assert.equal(r.body.question.note, againNote([CONTACT_ANSWER]), "the question was put as new, as if the Contact answer had aged out");
    const kept = question(store, slug);
    assert.deepEqual(kept.context, [...twelve, A13], "an answer was let go");
    assert.equal(kept.note, againNote([CONTACT_ANSWER]));
    assert.equal(kept.request, PHOTO);
  });
});

for (const mode of ["sync", "job"]) {
  test("PAST THE TOTAL-ANSWER LIMIT THE OLDEST ANSWER STILL COUNTS AT A STEP (" + mode + "): carrying thirteen answers, a photo step that asks the Contact question again beside a proposed change is called once, changes and charges nothing, and its question is kept under a note naming the Contact answer, with every answer", async () => {
    const slug = freshSlug("history-step-oldest-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const thirteen = [CONTACT_ANSWER, ...DETAILS, A12, A13];
    try {
      const calls = [];
      await withWire({
        [T.pick]: { fields: ["images"], scopes: [{ part: "images", words: PHOTO, answers: thirteen.map((_, i) => i + 1) }] },
        [PIC]: (args) => { calls.push(userText(args)); return { ...FOCUS_TOP, question: ASK_CONTACT }; },
      }, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: thirteen.length, context: thirteen }, PHOTO);
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.error, "clarify", "the step's question was not asked" + why);
        assert.equal(calls.length, 1, "the photo step was sent again past the total-answer limit" + why);
        assert.ok(calls[0].includes(SHOWN_CONTACT), "the photo step was not shown the Contact answer" + why);
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "the change proposed beside the question was made" + why);
        assert.equal(charged(seen, m0), 0, "a step that asked was charged" + why);
        const kept = question(store, slug);
        assert.ok(kept, "the step's question was not kept" + why);
        assert.equal(kept.request, PHOTO);
        assert.deepEqual(kept.context, thirteen, "the question kept fewer than every answer" + why);
        assert.equal(kept.note, againNote([CONTACT_ANSWER]), "the question was kept as new, as if the Contact answer had aged out" + why);
        assert.equal(r.body.clarify.note, kept.note, "the card is not shown the note" + why);
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

for (const mode of ["sync", "job"]) {
  test("THE PICKER'S OWN QUESTION PAST THE TOTAL-ANSWER LIMIT KEEPS EVERY ANSWER (" + mode + "): carrying thirteen, a picker that asks before anything runs is shown all thirteen, nothing runs or is charged, and its question keeps the whole request with all thirteen, the oldest first", async () => {
    const slug = freshSlug("history-picker-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const thirteen = [CONTACT_ANSWER, ...DETAILS, A12, A13];
    const QP = { text: "Should the heading change on every page, or only on Home?", options: ["Every page", "Only Home"] };
    try {
      await withWire({ [T.pick]: { fields: ["shape"], question: QP } }, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: thirteen.length, context: thirteen }, MESSAGE);
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.error, "clarify", "the picker's question was not asked" + why);
        assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(thirteen)), "the picker was not shown every answer" + why);
        assert.equal(compiler.calls.length, 0, "something was compiled for a question" + why);
        assert.equal(storedPage(store, slug, "index.tsx"), HOME, "a page changed" + why);
        assert.equal(charged(seen, m0), 0, "the picker's question was charged" + why);
        const kept = question(store, slug);
        assert.equal(kept.request, MESSAGE, "the question does not keep the whole request" + why);
        assert.deepEqual(kept.context, thirteen, "the picker's question kept fewer than every answer" + why);
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

// THE TWO ANSWERS ABOUT THE HEADING, among the thirteen of the second case.
const HEADING_SIZE = { q: "How much bigger should the heading be?", a: "Twice the size" };
const HEADING_BOLD = { q: "Bold as well?", a: "Yes, bold" };

for (const mode of ["sync", "job"]) {
  test("RETRIEVED FOR THE CHANGE THAT NEEDS IT, PAST THE TOTAL-ANSWER LIMIT (" + mode + "): a request carrying thirteen answers hands the oldest — the Contact photo — to the photo step that needs it and not to the heading's writer, each shown exactly the answers the picker named for it; both changes are made and nobody is asked again", async () => {
    const slug = freshSlug("history-retrieve-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const thirteen = [CONTACT_ANSWER, HEADING_SIZE, HEADING_BOLD, ...DETAILS];
    const PHOTO_ANSWERS = [CONTACT_ANSWER, ...DETAILS];
    try {
      await withWire({
        [T.pick]: { fields: ["shape", "images"], scopes: [
          { part: "shape", page: "/", words: HEADING, answers: [2, 3] },
          { part: "images", words: PHOTO, answers: [1, ...DETAILS.map((_, i) => i + 4)] },
        ] },
        [T.tweak]: { source: HOME_BIG },
        [PIC]: (args) => (userText(args).includes(SHOWN_CONTACT) ? FOCUS_TOP : { pictures: [], question: { text: CONTACT_ANSWER.q, options: ["Home", "Contact"] } }),
      }, async (seen) => {
        const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: thirteen.length, context: thirteen }, MESSAGE);
        assert.deepEqual(post.body.context, thirteen, "the browser did not post all thirteen answers");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 400);
        assert.equal(r.body.ok, true, "a request carrying thirteen answers did not run" + why);
        assert.equal(r.body.clarify, undefined, "the customer was asked again" + why);
        assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(thirteen)), "the picker was not shown the whole history" + why);
        assert.ok(seen.inputs[T.tweak][0].endsWith(contextBlock([HEADING_SIZE, HEADING_BOLD])), "the heading's writer was not shown exactly its own two answers" + why);
        assert.ok(!seen.inputs[T.tweak][0].includes(SHOWN_CONTACT), "the heading's writer was handed the photo's oldest answer" + why);
        assert.ok(seen.inputs[PIC][0].endsWith(contextBlock(PHOTO_ANSWERS)), "the photo step was not shown exactly its own answers, the oldest first" + why);
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading was not made" + why);
        assert.equal(focusOf(storedPage(store, slug, "contact.tsx")), "top", "the photo change was not made" + why);
        assert.equal(question(store, slug), null, "a question was kept" + why);
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

test("A HISTORY ALREADY HOLDING AS MANY ANSWERS AS IT KEEPS, EVERY ONE STILL NEEDED, TAKES NO MORE: the answer is refused at no cost, the question still waiting with every answer — none they gave is forgotten to make room; with one answer handled, that one alone makes room", async () => {
  const worker = await loadWorker();
  const needed = Array.from({ length: MAX_HISTORY }, (_, i) => ({ q: "Detail " + i + "?", a: "Answer " + i }));
  // EVERY ANSWER STILL NEEDED.
  const slug = freshSlug("history-full");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { context: needed, round: MAX_HISTORY + 1, held: ["add a gallery page"] });
  const before = store.raw(QUESTION_KEY(slug));
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(r.status, 422, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.error, "answers-full", "a full history took another answer, or was refused as something else");
    assert.equal(r.body.cost, 0);
    assert.match(r.body.msg, /still waiting/, "the refusal does not say the request is kept");
    assert.match(r.body.msg, /Cancel/, "the refusal does not say how to go on");
    assert.deepEqual(seen.debits, [], "the refused answer was charged");
    assert.equal(store.raw(QUESTION_KEY(slug)), before, "the waiting question was changed — an answer let go, or the question closed");
    assert.equal(question(store, slug).status, "pending");
  });
  // AN ANSWER TOO LONG TO KEEP IS STILL SAID TO BE THAT, full history or not.
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "y".repeat(MAX_ANSWER_CHARS + 1), ask: { id: q.id } });
    assert.equal(r.status, 422);
    assert.equal(r.body.error, "answer-too-long");
    assert.equal(store.raw(QUESTION_KEY(slug)), before);
  });
  // ONE ANSWER HANDLED: it alone makes room, and the request resumes word for word.
  const slug2 = freshSlug("history-room");
  const store2 = bucket(slug2);
  const withHandled = needed.map((p, i) => (i === 20 ? { ...p, handled: true } : p));
  const q2 = seedQuestion(store2, slug2, { context: withHandled, round: MAX_HISTORY + 1 });
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
    const r = await routeCall(worker, envFor(store2), { slug: slug2, message: "Visit", ask: { id: q2.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.instruction, q2.request);
    assert.deepEqual(r.body.ask.context, [...withHandled.filter((_, i) => i !== 20), { q: Q.text, a: "Visit" }], "room was not made by the handled answer alone");
    assert.equal(question(store2, slug2).status, "answered");
  });
});

test("PAST THE TOTAL-ANSWER LIMIT AT THE ADD-ON: thirteen answers ride to the designers, the oldest — the time of day — first among them, and the addition is made once on them", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
  const TIME = { q: "What time of day should the reminder go out?", a: "9am" };
  const thirteen = [TIME, ...Array.from({ length: 12 }, (_, i) => ({ q: "Reminder detail " + i + "?", a: "Answer " + i }))];
  const slug = "fw-history-addon-" + Math.random().toString(16).slice(2, 8);
  const r = await addon(slug, "remind people the day before", { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, context: thirteen });
  assert.equal(r.body.ok, true, "an addition carrying thirteen answers did not run: " + JSON.stringify(r.body).slice(0, 300));
  assert.ok(promptFor(r, "job").text.includes(JSON.stringify(contextBlock(thirteen)).slice(1, -1)), "the job's designer was not shown every answer, the oldest first");
  assert.ok(r.sql.some((s) => /create\s+(or\s+replace\s+)?function/i.test(s)), "the function was not created");
  assert.equal(r.registered.length, 1, "the job was not registered exactly once");
  // AND A DESIGNER THAT ASKS keeps every answer with its question: nothing applied or registered.
  const QJ = { text: "Should it go out on Sundays too?", options: ["Yes", "No"] };
  const slug2 = "fw-history-addon-ask-" + Math.random().toString(16).slice(2, 8);
  const a = await addon(slug2, "remind people the day before", { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { question: QJ, job: [JOB] } }, context: thirteen });
  assert.equal(a.body.error, "clarify", "the designer's question was not asked: " + JSON.stringify(a.body).slice(0, 300));
  assert.ok(!a.sql.some((s) => /\b(create|alter|insert|drop)\b/i.test(s)), "a design was applied beside the unresolved question");
  assert.deepEqual(a.registered, []);
  const rec = readAskRecord(a.store.store.get(QUESTION_KEY(slug2)));
  assert.ok(rec, "the designer's question was not kept");
  assert.deepEqual(rec.context, thirteen, "the designer's question kept fewer than every answer");
});
