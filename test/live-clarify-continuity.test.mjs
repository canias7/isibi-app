// CLARIFICATION CONTINUITY — THE OWNER'S SECOND REVIEW, THROUGH THE REAL ROUTES
// (2026-10-02).
//
// Owner: *"Finish clarification continuity: askRemainder currently drops every
// earlier answer whenever another step succeeds. Preserve the answers relevant
// to unfinished operations while excluding completed operations from execution;
// keep clarification context separate from executable instructions, with the
// model identifying its relevant scope rather than customer-keyword rules. Also
// replace the terminal clarify-repeat/question-ended behavior … Add focused
// regressions where a heading change succeeds while a photo change still needs
// the previously supplied Contact-page answer, where several unfinished
// operations need different earlier answers, and where an unclear answer
// requires a better follow-up. Verify actual resumed model inputs, preservation
// across refresh, and no repeated completed changes or charges."*
//
// EVERY HOP IS DRIVEN: the real routing route, the real edit route
// (synchronously and as a queued job) with the body the browser's own
// `siteEdit` composes, the real owner route for the question — and what each
// model was really sent is read off the wire (`seen.inputs`), so "the photo step
// still has the Contact answer" is asked of the request the photo step's model
// received, never of a helper.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer here is supplied — which
// answers a real picker names for each change, and whether a real model asks a
// better question when shown its earlier answer, are live measurements.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { QUESTION_KEY, contextBlock, MAX_ASKED, readAskRecord } from "../builder/clarify.mjs";
import { addon, writtenPage, promptFor, pagePrompt } from "./fixtures/addon-route.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
import { failureMsg } from "../builder/edit-failure.mjs";
import { addonFailure } from "../builder/site-addon.mjs";
import {
  T, HOME, VISIT, VISIT_MOVED, Q, page, SOURCE_KEY, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedPage, storedLook, NEW_DESC,
} from "./fixtures/live-ask.mjs";

const PIC = "choose_pictures";
const CONTACT = page("/contact", "<section className=\"find\"><h1>Find us</h1><SafeImage src=\"/u/shop/front.jpg\" alt=\"The shop front at dawn\" /></section>");
const HOME_BIG = HOME.replace("<h1>Harbour Loaf</h1>", "<h1 className=\"text-6xl\">Harbour Loaf</h1>");
const HEADING = "Make the home page heading bigger";
const PHOTO = "show more of the top of the photo";
const MESSAGE = HEADING + " and " + PHOTO + ".";
const QPAGE = { text: "Which photo do you mean — one on Home or the one on Contact?", options: ["Home", "Contact"] };
const QPIC = { text: "The shop-front photo shows a sign and a doorway — which should stay in view?", options: ["The sign", "The doorway"] };
const CONTACT_ANSWER = { q: QPAGE.text, a: "Contact" };
/** Charges since a moment: debits (an inline edit, a routing call) and reserves (a queued edit). */
const marks = (seen) => ({ debits: seen.debits.length, reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").length });
const charged = (seen, at) => (seen.debits.length - at.debits) + (seen.rpc.filter((r) => r.fn === "edit_reserve").length - at.reserves);
const withContact = (store, slug) => store.poke(SOURCE_KEY(slug), JSON.stringify([
  { path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT },
]));
const SITE3 = (slug) => ({ ...SITE(slug), pages: [{ path: "/" }, { path: "/visit" }, { path: "/contact" }] });
const focusOf = (src) => { const m = /focus="(\w+)"/.exec(String(src || "")); return m ? m[1] : null; };

// ─────────────────────────────────────────────────────────────────────────────
// 1. A HEADING CHANGE SUCCEEDS; THE PHOTO STILL HAS ITS CONTACT-PAGE ANSWER
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("A HEADING CHANGE SUCCEEDS WHILE THE PHOTO CHANGE STILL NEEDS THE CONTACT-PAGE ANSWER (" + mode + "): the photo step's question keeps the Contact answer — never dropped beside the change that ran — and resumed, the photo step is shown both answers while the heading is neither changed nor charged again", async () => {
    const slug = freshSlug("heading-photo-" + mode);
    const store = bucket(slug);
    withContact(store, slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({
        route: [
          { intent: "clarify", question: QPAGE },
          { intent: "edit", layer: "look", answered: true },
          { intent: "edit", layer: "look", answered: true },
        ],
        // THE PICKER NAMES WHICH ANSWER EACH CHANGE NEEDS: the Contact answer is the photo's alone.
        [T.pick]: [
          { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/", words: HEADING, answers: [] }, { part: "images", words: PHOTO, answers: [1] }] },
          { fields: ["images"], scopes: [{ part: "images", words: PHOTO, answers: [1, 2] }] },
        ],
        [T.tweak]: { source: HOME_BIG },
        [PIC]: (args, n) => (n === 0 ? { pictures: [], question: QPIC } : { pictures: [{ page: "contact.tsx", alt: "The shop front at dawn", focus: "top" }] }),
      }, async (seen) => {
        // THE ROUTER ASKS WHICH PHOTO; THE ANSWER RIDES BESIDE THE REQUEST.
        const a = (await routeCall(worker, envFor(store), { slug, message: MESSAGE })).body;
        const b = (await routeCall(worker, envFor(store), { slug, message: "Contact", ask: { id: a.question.id } })).body;
        assert.equal(b.instruction, MESSAGE, "the request grew with its answer");
        assert.deepEqual(b.ask.context, [CONTACT_ANSWER]);
        // THE FIRST RUN: the heading is made and charged; the photo step asks.
        const m0 = marks(seen);
        const post = browserPost(SITE3(slug), { ...b, askRound: b.ask.round, context: b.ask.context }, b.instruction);
        assert.deepEqual(post.body.context, [CONTACT_ANSWER], "the browser did not post the answer beside the request");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.body.ok, true, "the heading beside the question did not run: " + JSON.stringify(r.body).slice(0, 400));
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading change was not made");
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "the photo whose step asked was changed");
        assert.equal(charged(seen, m0), 1, "the heading was not charged once, or the question was charged");
        // WHAT EACH MODEL WAS REALLY SENT: the picker every answer; the heading none; the photo its Contact answer.
        assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock([CONTACT_ANSWER])), "the picker was not shown the answers it names");
        assert.ok(!seen.inputs[T.tweak][0].includes(CONTACT_ANSWER.q), "the heading step was shown the photo's answer");
        assert.ok(seen.inputs[PIC][0].endsWith(contextBlock([CONTACT_ANSWER])), "the photo step was not shown the Contact answer");
        // THE QUESTION KEEPS THE PHOTO'S PART AND THE PHOTO'S ANSWER — the heading's change is not in it.
        const q = question(store, slug);
        assert.equal(q.id, r.body.clarify.id);
        assert.equal(q.stage, "picture");
        assert.equal(q.request, PHOTO, "the heading that ran is in the request the answer resumes, or the photo's part was lost: " + q.request);
        assert.deepEqual(q.context, [CONTACT_ANSWER], "the Contact answer was dropped beside the change that ran (the old askRemainder)");
        // THE ANSWER: the router is shown the waiting photo request with the Contact answer under it.
        const m1 = marks(seen);
        const d = (await routeCall(worker, envFor(store), { slug, message: "The sign", ask: { id: q.id } })).body;
        const told = String(seen.routerAsked.at(-1).messages[0].content);
        assert.ok(told.includes("They asked: " + PHOTO), "the router was not shown the waiting photo request");
        assert.ok(told.includes(contextBlock([CONTACT_ANSWER])), "the router was not shown the Contact answer still waiting with it");
        assert.ok(!told.includes(HEADING), "the router was shown the heading that already ran");
        assert.equal(d.instruction, PHOTO);
        assert.deepEqual(d.ask.context, [CONTACT_ANSWER, { q: QPIC.text, a: "The sign" }]);
        // THE RESUMED REQUEST: only the photo runs, shown both answers; the heading writer is never called again.
        const post2 = browserPost(SITE3(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction);
        const r2 = await postRoute(worker, envFor(store), store, seen, slug, post2, mode);
        assert.equal(r2.body.ok, true, "the resumed photo change did not run: " + JSON.stringify(r2.body).slice(0, 400));
        assert.equal(seen.inputs[T.tweak].length, 1, "the heading that ran was written again on the answer");
        assert.ok(!seen.inputs[T.pick][1].includes(HEADING), "the resumed picker was shown the heading that ran");
        assert.ok(seen.inputs[PIC][1].endsWith(contextBlock([CONTACT_ANSWER, { q: QPIC.text, a: "The sign" }])), "the photo step was not shown both answers on the resumed request");
        assert.equal(focusOf(storedPage(store, slug, "contact.tsx")), "top", "the photo change was not made on the answer");
        assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading moved again");
        assert.equal(charged(seen, m1), 2, "the answer's routing call and the photo step — and the heading not charged again");
        assert.equal(question(store, slug).status, "answered");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEVERAL UNFINISHED OPERATIONS, EACH WITH ITS OWN EARLIER ANSWER
// ─────────────────────────────────────────────────────────────────────────────

test("SEVERAL UNFINISHED OPERATIONS NEED DIFFERENT EARLIER ANSWERS: each step's model is shown only its own; the change that ran takes its answer with it; the question keeps the move's answer and the photo's — and resumed, each step is shown its own again", async () => {
  const slug = freshSlug("several");
  const store = bucket(slug);
  withContact(store, slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const MOVE = "put the order band above the other one on the Visit page";
  const request = HEADING + ", " + MOVE + ", and " + PHOTO + ".";
  const BAND = { q: "Which band is the order band?", a: "The one about holding a loaf" };
  const WHICH_PHOTO = { q: "Which photo?", a: "The one on Contact" };
  const HOW_BIG = { q: "How much bigger?", a: "Twice the size" };
  const QMOVE = { text: "Above which band exactly — the bakery band?", options: ["Yes", "No"] };
  try {
    await withWire({
      [T.pick]: [
        // EACH CHANGE NAMES ITS OWN ANSWER: the heading 3, the move 1, the photo 2.
        { fields: ["shape", "images"], scopes: [
          { part: "shape", page: "/", words: HEADING, answers: [3] },
          { part: "shape", page: "/visit", words: MOVE, answers: [1] },
          { part: "images", words: PHOTO, answers: [2] },
        ] },
        // RESUMED: two answers still shown, numbered again — the move 1 and 3, the photo 2.
        { fields: ["shape", "images"], scopes: [
          { part: "shape", page: "/visit", words: MOVE, answers: [1, 3] },
          { part: "images", words: PHOTO, answers: [2] },
        ] },
      ],
      [T.tweak]: (args, n) => [{ source: HOME_BIG }, { source: "", question: QMOVE }, { source: VISIT_MOVED }][n],
      [PIC]: (args, n) => (n === 0 ? { pictures: [], question: QPIC } : { pictures: [{ page: "contact.tsx", alt: "The shop front at dawn", focus: "top" }] }),
      route: { intent: "edit", layer: "look", answered: true },
    }, async (seen) => {
      const m0 = marks(seen);
      const post = browserPost(SITE3(slug), { intent: "edit", layer: "look", askRound: 3, context: [BAND, WHICH_PHOTO, HOW_BIG] }, request);
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
      assert.equal(storedPage(store, slug, "index.tsx"), HOME_BIG, "the heading did not run");
      assert.equal(charged(seen, m0), 1, "only the heading ran, and only it is charged");
      // EACH STEP'S OWN ANSWER, AND NO OTHER.
      const [home, visit] = seen.inputs[T.tweak];
      assert.ok(home.endsWith(contextBlock([HOW_BIG])), "the heading step was not shown its own answer alone");
      assert.ok(visit.endsWith(contextBlock([BAND])), "the move was not shown its own answer alone");
      assert.ok(seen.inputs[PIC][0].endsWith(contextBlock([WHICH_PHOTO])), "the photo step was not shown its own answer alone");
      for (const [name, input, others] of [["heading", home, [BAND, WHICH_PHOTO]], ["move", visit, [HOW_BIG, WHICH_PHOTO]], ["photo", seen.inputs[PIC][0], [BAND, HOW_BIG]]]) {
        for (const o of others) assert.ok(!input.includes(o.a), "the " + name + " step was shown another change's answer: " + o.a);
      }
      // THE QUESTION: both unfinished parts and both of their answers; the heading's answer went with it.
      const q = question(store, slug);
      assert.ok(q.request.includes(MOVE) && q.request.includes(PHOTO), "an unfinished part was lost: " + q.request);
      assert.ok(!q.request.includes(HEADING), "the heading that ran is in what the answer resumes");
      assert.deepEqual(q.context, [BAND, WHICH_PHOTO, { ...HOW_BIG, handled: true }], "the unfinished parts' answers were not kept, or the finished one's was");
      // RESUMED (the move's question answered): each is shown its own again; the heading is not.
      const d = (await routeCall(worker, envFor(store), { slug, message: "Yes", ask: { id: q.id } })).body;
      const asked = { q: q.question.text, a: "Yes" };
      assert.deepEqual(d.ask.context, [BAND, WHICH_PHOTO, { ...HOW_BIG, handled: true }, asked]);
      const r2 = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE3(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction), "sync");
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body).slice(0, 400));
      assert.ok(seen.inputs[T.pick][1].endsWith(contextBlock([BAND, WHICH_PHOTO, asked])), "the resumed picker was not shown exactly the answers still for the request");
      assert.ok(!seen.inputs[T.pick][1].includes(HOW_BIG.a), "the resumed picker was shown the finished change's answer");
      assert.ok(seen.inputs[T.tweak][2].endsWith(contextBlock([BAND, asked])), "the resumed move was not shown its own two answers");
      assert.ok(seen.inputs[PIC][1].endsWith(contextBlock([WHICH_PHOTO])), "the resumed photo step was not shown its own answer");
      assert.equal(seen.inputs[T.tweak].length, 3, "the heading was written again");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT_MOVED);
      assert.equal(focusOf(storedPage(store, slug, "contact.tsx")), "top");
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("EACH LOOK LANE IS SHOWN ONLY THE ANSWERS ITS OWN CHANGE NEEDS — and an answer the picker named for no change is shown to every lane, never to none", async () => {
  const slug = freshSlug("lanes-told");
  const store = bucket(slug);
  const worker = await loadWorker();
  const NAME = "Rename us to Harbour Loaf & Co";
  const DESC = "Change the search description";
  const AMPERSAND = { q: "Should the new name keep the ampersand?", a: "Yes, keep the &" };
  const WORDING = { q: "What should the search description say?", a: NEW_DESC };
  const EVERYWHERE = { q: "Is this for the whole site?", a: "Yes, everywhere" };
  const compiler = installCompiler();
  try {
  await withWire({
    // THE PICKER'S READING: the first answer is the name's, the second the
    // description's, and the third it named for no change at all.
    [T.pick]: { fields: ["brand", "description"], scopes: [{ part: "brand", words: NAME, answers: [1] }, { part: "description", words: DESC, answers: [2] }] },
    "lane:brand": "Harbour Loaf & Co",
    "lane:description": NEW_DESC,
  }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 3, context: [AMPERSAND, WORDING, EVERYWHERE] }, NAME + " and " + DESC + ".");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
    assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock([AMPERSAND, WORDING, EVERYWHERE])), "the picker was not shown every answer to number");
    const lane = (f) => seen.lanes.find((l) => l.field === f).asked;
    assert.equal(lane("brand"), NAME + "\n\n" + contextBlock([AMPERSAND, EVERYWHERE]),
      "the name's lane was not shown exactly its own answer and the one named for no change: " + lane("brand"));
    assert.equal(lane("description"), DESC + "\n\n" + contextBlock([WORDING, EVERYWHERE]),
      "the description's lane was not shown exactly its own answer and the one named for no change: " + lane("description"));
    assert.equal(storedLook(store, slug).brand, "Harbour Loaf & Co");
    assert.equal(storedLook(store, slug).description, NEW_DESC);
  }, { slug });
  } finally { compiler.uninstall(); }
});

test("THE PAGE RUNG'S FULL WRITER IS SHOWN THE ANSWERS ITS STEP WAS GIVEN, and a question it asks keeps them beside the request", async () => {
  const slug = freshSlug("full-writer-told");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const WHICH = { q: "Which band — the order band or the bakery band?", a: "The order band" };
  const ASKS = { text: "Should the moved band keep its photo?", options: ["Yes", "No"] };
  try {
    await withWire({
      [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: "Move the band up", answers: [1] }] },
      [T.tweak]: { cannot: "This needs a new section written." },
      [T.pages]: { pages: [], question: ASKS },
    }, async (seen) => {
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [WHICH] }, "Move the band up");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.clarify && r.body.clarify.text, ASKS.text, JSON.stringify(r.body).slice(0, 400));
      assert.equal(seen.pageWriters.length, 1, "the full page writer was not reached");
      assert.ok(seen.pageWriters[0].text.includes(contextBlock([WHICH])), "the full page writer was not shown the answer its step was given");
      const q = question(store, slug);
      assert.equal(q.request, "Move the band up");
      assert.deepEqual(q.context, [WHICH], "the full writer's question dropped the answer already given");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("AN ADDITION IS SHOWN WHAT THEY ALREADY TOLD US — its page writer included — and a question it asks keeps every answer beside the request", async () => {
  const told = [{ q: "Should the gallery show every photograph, or only this season's?", a: "Every photograph" }];
  const shownAs = JSON.stringify(contextBlock(told)).slice(1, -1);
  const GALLERY = { path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] };
  // THE PAGE WRITER, which builds what the designers designed: shown the answers like every other call.
  const made = await addon("fw-told-page-" + Math.random().toString(16).slice(2, 8), "add a gallery page", {
    kinds: ["page"], publishes: true, answers: { page: { page: [GALLERY] } }, written: [writtenPage("/gallery")], context: told,
  });
  assert.equal(made.body.ok, true, JSON.stringify(made.body).slice(0, 300));
  assert.ok(promptFor(made, "page").text.includes(shownAs), "the page designer was not shown the answer");
  assert.ok(pagePrompt(made), "the page writer never ran");
  assert.ok(pagePrompt(made).text.includes(shownAs), "the add-on's page writer was not shown the answer");
  // A DESIGNER THAT ASKS SOMETHING NEW: the question keeps the answer already given.
  const slug = "fw-told-ask-" + Math.random().toString(16).slice(2, 8);
  const QG = { text: "How many photographs in a row?", options: ["Three", "Four"] };
  const asked = await addon(slug, "add a gallery page", { kinds: ["page"], answers: { page: { question: QG } }, context: told });
  assert.equal(asked.body.error, "clarify", JSON.stringify(asked.body).slice(0, 300));
  const rec = readAskRecord(asked.store.store.get(QUESTION_KEY(slug)));
  assert.ok(rec, "the designer's question was not kept");
  assert.equal(rec.request, "add a gallery page");
  assert.deepEqual(rec.context, told, "the addition's question dropped the answer already given");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AN UNCLEAR ANSWER GETS A BETTER FOLLOW-UP; AN ANSWER GIVEN IS REUSED
// ─────────────────────────────────────────────────────────────────────────────

test("AN UNCLEAR ANSWER GETS A MORE SPECIFIC FOLLOW-UP — from the router and from a step: shown the answer that did not settle it, the model asks what it left open; the request waits unchanged, both answers beside it, nothing retyped", async () => {
  const worker = await loadWorker();
  const SPECIFIC = { text: "The band that says “Order a collection so we hold a loaf” — on Home, or on Visit?", options: ["Home", "Visit"] };
  {
    const slug = freshSlug("unclear-route");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    await withWire({ route: [{ intent: "clarify", question: Q, answered: true }, { intent: "clarify", question: SPECIFIC, answered: true }] }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "the nice one", ask: { id: q.id } });
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.question.text, SPECIFIC.text, "the follow-up is not the more specific question");
      assert.equal(r.body.question.note, undefined, "a new, more specific question carries a note");
      assert.deepEqual(r.body.decision.reasons, ["clarify-reused"]);
      assert.ok(String(seen.routerAsked[1].messages[0].content).includes("they answered: “the nice one”"), "the router was not shown the unclear answer");
      const kept = question(store, slug);
      assert.equal(kept.request, q.request, "the request was not kept as it was");
      assert.deepEqual(kept.context, [{ q: Q.text, a: "the nice one" }]);
    });
    await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
      const kept = question(store, slug);
      const d = (await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: kept.id } })).body;
      assert.equal(d.instruction, q.request, "the request the follow-up resumes is not the original, word for word");
      assert.deepEqual(d.ask.context, [{ q: Q.text, a: "the nice one" }, { q: SPECIFIC.text, a: "Visit" }]);
    });
  }
  {
    const slug = freshSlug("unclear-step");
    const store = bucket(slug);
    await withWire({ [T.pick]: [{ fields: ["shape"], question: Q }, { fields: ["shape"], question: SPECIFIC }] }, async (seen) => {
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [{ q: Q.text, a: "the nice one" }] }, "Move the band");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.clarify.text, SPECIFIC.text, JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.clarify.note, undefined);
      assert.match(seen.inputs[T.pick][1], /YOU ASKED THEM THIS ALREADY/);
      assert.deepEqual(question(store, slug).context, [{ q: Q.text, a: "the nice one" }]);
    }, { slug });
  }
});

// (ASKED THE SAME TWICE, the router was sent the request again with questions
// closed and acted on what it was told; the owner's third review, 2026-10-03,
// made that a hold: `live-clarify-limits.test.mjs` drives it now.)

test("AN ANSWER ALREADY GIVEN IS REUSED, NEVER ASKED AGAIN: a step that asks what was answered — even an answer that went with a finished change — is sent it back and acts; no question reaches the customer, and only the call whose answer was used is billed", async () => {
  const slug = freshSlug("reuse");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const WHERE = { q: "Which page is the band on?", a: "Visit", handled: true };
  try {
    await withWire({
      [T.pick]: [{ fields: ["shape"], question: { text: "Which page is the band on?" } }, { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: "Move the band" }] }],
      [T.tweak]: { source: VISIT_MOVED },
    }, async (seen) => {
      const m0 = marks(seen);
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [WHERE] }, "Move the band");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.ok, true, "the step did not act on the answer it was given back: " + JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.clarify, undefined, "a question already answered was put to the customer");
      assert.deepEqual(store.questionWrites, [], "a question was kept");
      assert.ok(!seen.inputs[T.pick][0].includes("Visit”"), "a handled answer was shown as context");
      assert.match(seen.inputs[T.pick][1], /Asked: “Which page is the band on\?” — they answered: “Visit”/, "the handled answer was not given back");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT_MOVED);
      assert.equal(charged(seen, m0), 1, "the change was not charged once");
    }, { slug });
  } finally { compiler.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ACROSS A REFRESH, AND ANSWERS NO READER KEEPS
// ─────────────────────────────────────────────────────────────────────────────

test("ACROSS A REFRESH NOTHING IS LOST: the waiting question's record holds the request, every answer and the note; the owner route gives back the note; the browser's job record and its hand-over carry the answers to the next post", async () => {
  const slug = freshSlug("refresh");
  const store = bucket(slug);
  const told = [{ q: "Which band?", a: "The order band" }];
  const note = "Your answer — “the big one” — didn’t settle this, so I need to ask once more.";
  seedQuestion(store, slug, { context: told, note, round: 2 });
  const worker = await loadWorker();
  await withWire({}, async () => {
    const g = await questionCall(worker, envFor(store), slug, "GET");
    assert.equal(g.status, 200);
    assert.equal(g.body.question.note, note, "a reload loses the note");
    assert.equal(g.body.question.text, Q.text);
    const rec = JSON.parse(store.raw(QUESTION_KEY(slug)));
    assert.deepEqual(rec.context, told, "the stored record does not hold the answers");
    assert.equal(rec.v, 2);
  });
  // THE BROWSER: a job record kept across a reload, and the post a resumed watch makes.
  const EditPoll = (await import("node:module")).createRequire(import.meta.url)("../public/edit-poll.js");
  const mem = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
  EditPoll.rememberJob(slug, "job-r", mem, { ask: "Move the band", op: "edit", context: told, askRound: 2 });
  const back = EditPoll.resumableRecord(slug, Date.now(), mem);
  assert.deepEqual(back.context, told, "a watch resumed after a reload forgot the answers");
  const hop = EditPoll.handOver({ layer: "look", context: back.context, askRound: back.askRound }, { layer: "addon" }, { from: "look", reply: { reason: "addon" } });
  assert.deepEqual(hop.context, told, "a hand-over after a reload dropped the answers");
  const post = browserPost(SITE(slug), { intent: "addon", ...hop }, "Move the band");
  assert.deepEqual(post.body.context, told, "the add-on post after a reload does not carry the answers");
});

// (AT THE CAP no question was offered and a question in a reply was never read,
// so the step acted on a guess; the owner's third review, 2026-10-03, keeps the
// question and the request instead: `live-clarify-limits.test.mjs` drives it now.)

test("ANSWERS THAT CANNOT BE READ ARE REFUSED, NEVER READ AS NONE: an edit or an addition resumed with an answers list no reader keeps runs no model, changes nothing and charges nothing — inline and queued", async () => {
  // ONE PAST `MAX_ASKED` is a list no reader keeps; the browser carries it as
  // it came (`contextWire`), so the route refuses it rather than running the
  // request as if nothing had been answered — or on a guess at the answers.
  const broken = Array.from({ length: MAX_ASKED + 1 }, (_, i) => ({ q: "Question " + i + "?", a: "Answer " + i }));
  const worker = await loadWorker();
  for (const mode of ["sync", "job"]) {
    for (const intent of ["edit", "addon"]) {
      const slug = freshSlug("unread-" + intent + "-" + mode);
      const store = bucket(slug);
      await withWire({}, async (seen) => {
        const m0 = marks(seen);
        const post = browserPost(SITE(slug), { intent, layer: "look", askRound: 2, context: broken }, "Move the band");
        assert.deepEqual(post.body.context, broken, "the browser dropped a list it could not read");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        const why = " (" + intent + ", " + mode + "): " + JSON.stringify(r.body).slice(0, 300);
        assert.equal(r.body.ok, false, "a request with answers it could not read ran" + why);
        if (intent === "edit") {
          assert.equal(r.body.error, "context-unread", why);
          assert.equal(r.body.msg, failureMsg("route/context-unread"), why);
        } else {
          assert.equal(r.body.reason, "context-unread", why);
          assert.equal(r.body.msg, addonFailure("context-unread").msg, why);
        }
        assert.equal(r.body.cost, 0, why);
        assert.deepEqual(seen.calls, [], "a model was asked on answers nobody could read" + why);
        assert.equal(charged(seen, m0), 0, "the refusal was charged" + why);
        // A QUEUED ONE GIVES BACK THE HOLD its job was enqueued with.
        if (mode === "job") assert.equal(r.refunded, true, "the queued job's hold was not given back" + why);
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "a page changed" + why);
        assert.deepEqual(store.questionWrites, [], "a question was kept" + why);
      }, { slug });
    }
  }
});

test("A STEP'S QUESTION KEPT ON A RESUMED REQUEST IS DRAWN BY THE REAL BROWSER AS THE LIVE CARD, the answers beside it never in its words", async () => {
  const slug = freshSlug("browser-card");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ [T.pick]: { fields: ["shape"], question: { text: "Above which heading exactly?" } } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 1, context: [{ q: Q.text, a: "Visit" }] }, "Move the band");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    const said = editBrowserReply(r.body, true, {});
    assert.equal(said.text, "Above which heading exactly?", "the card says more than the question: " + said.text);
    assert.equal(said.asked.id, question(store, slug).id);
  }, { slug });
});
