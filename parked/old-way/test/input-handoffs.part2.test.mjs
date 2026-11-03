// PARKED (2026-11-03, park-old-way): the old-way half of test/input-handoffs.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE CUSTOMER'S WORDS, QUESTIONS, FILES AND PAGES THROUGH EVERY REAL HANDOFF
// (2026-10-03, the owner's first information-limits batch).
//
// Owner: *"Add focused regression tests that exercise the real handoffs:
// requests longer than 2,000 characters with essential instructions at the
// end, clarification answers longer than 500 characters, meaningful text at
// the end of long questions/options, original plus newly attached files,
// reloads of sites with more than six pages, targets beyond the 24th page,
// queued resumes, and rejection at the actual technical boundary with all
// pending work preserved. Verify what each receiving model or executor
// actually gets, not just what the browser stores."*
//
// EVERY HOP IS THE REAL ONE: the routing route, the edit and add-on routes —
// synchronously and as a queued job — with the body the browser's own
// `siteEdit`/`siteAddon` composes, and, where the case is about what the
// customer does, the page itself (test/fixtures/browser-page.mjs: the handlers
// of public/chat.js in a VM) sending its own requests to the real Worker. What
// a case checks is what each model was really sent (`seen.inputs`,
// `seen.routerAsked`, `seen.picks`, `seen.lanes`, `seen.writers`), what the
// store kept, what the logo step stored, and what was charged.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied: whether a real
// model acts on the last line of a long message, or asks a good question, is
// the real-model audit's to measure, not this file's.
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as browserPage, settle, copy, fakeIndexedDB } from "../../../test/fixtures/browser-page.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS, REWRITE_MAX_CHARS } from "../../../builder/input-budget.mjs";
import { QUESTION_KEY, contextBlock } from "../../../builder/clarify.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import {
  T, USER, OTHER, TOKEN, HOME, VISIT, VISIT_MOVED, NEW_DESC, Q, page as pageSource, freshSlug, bucket, question, seedQuestion,
  withWire, envFor, routeCall, browserPost, postRoute, SITE, SOURCE_KEY, storedLook, storedPage, userText,
} from "../../../test/fixtures/live-ask.mjs";

const EditPoll = createRequire(import.meta.url)("../../../public/edit-poll.js");
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ─────────────────────────────────────────────────────────────────────────────
// THE WORDS: past the old 2,000 (and the rewrite's 4,000), the part that
// matters LAST — so a copy cut anywhere loses exactly the instruction.
// ─────────────────────────────────────────────────────────────────────────────
const PRE = "Some background before the change, so you know the shop and why we are asking. ";
const END_DESC = "And the one thing that matters: change the site's search description to \"" + NEW_DESC + "\".";
const END_MOVE = "And the one thing that matters: on the Visit page, put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\".";
const LONG_DESC = PRE.repeat(70) + END_DESC;
const LONG_MOVE = PRE.repeat(70) + END_MOVE;
const LONG_ANSWER = "Let me say where it is, because a few bands on the site look alike. ".repeat(40) + "So: the Visit page, the band about holding a loaf.";
const LAST_OPTION = "The order band — the one that says we keep a loaf back for you, " + "which sits under the opening hours on the Visit page, ".repeat(20) + "ABOVE the bakery band";
const LONG_Q = {
  text: "Before I move anything, I want to be sure which band you mean. ".repeat(40) + "Which band should go first on the Visit page?",
  options: ["Home", "Visit", "Neither", "Both", "Something else", LAST_OPTION],
};
// FILES IN THE COMPOSER'S OWN SHAPE: real PNG and JPEG leading bytes, so the
// logo step's sniff reads them as the images they are.
const PNG_A = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const JPG_B = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const JPG_C = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAg==";

const ROUTE = "/api/site/route";
const bandFirst = (src) => typeof src === "string" && src.indexOf("Order a collection") >= 0 && src.indexOf("Order a collection") < src.indexOf("Come to the bakery");
/** Charges since a moment: debits (a routing call, an inline edit) and reserves (a queued edit). */
const marks = (seen) => ({ debits: seen.debits.length, reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").length });
const charged = (seen, at) => (seen.debits.length - at.debits) + (seen.rpc.filter((r) => r.fn === "edit_reserve").length - at.reserves);
/** The router's own request, as text. */
const routerTold = (seen, i = 0) => userText(seen.routerAsked[i]);
/** Every key the Worker read from the store, in order — wraps `get` in place. */
function readLog(store) {
  const keys = [];
  const real = store.get.bind(store);
  store.get = async (k) => { keys.push(k); return real(k); };
  return keys;
}

/** THE PAGE'S REQUESTS, ANSWERED BY THE REAL WORKER — every answer kept in `log`. */
function toWorker(worker, env, log) {
  return (url, method, body) => worker.fetch(new Request("https://gofarther.dev" + url, {
    method, headers: { "content-type": "application/json", Authorization: TOKEN }, body: body === undefined ? undefined : JSON.stringify(body),
  }), env, makeCtx()).then(async (res) => {
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    log.push({ url, method, status: res.status, body: parsed });
    return { status: res.status, body: text };
  });
}
function livePage(slug, worker, env, log, over = {}, idb = undefined) {
  const p = browserPage({ site: { id: "origin-" + slug, slug, react: true, name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [], ...over }, idb, answer: toWorker(worker, env, log) });
  p.ctx.buildPicker = "sonnet";
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE WHOLE REQUEST, ITS LAST WORDS INCLUDED, REACHES EVERY MODEL THAT ACTS
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("A REQUEST PAST 2,000 CHARACTERS WITH THE INSTRUCTION LAST (" + mode + "): the router, the lane picker and the lane are each sent all of it, and the change named only at its end is made", async () => {
    assert.ok(LONG_DESC.length > REWRITE_MAX_CHARS && LONG_DESC.length < MAX_INPUT_CHARS, "the message is not past the old cuts and inside the policy: " + LONG_DESC.length);
    const slug = freshSlug("long-desc-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({ route: { intent: "edit", layer: "look" }, [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC }, async (seen) => {
        const d = (await routeCall(worker, envFor(store), { slug, message: LONG_DESC })).body;
        assert.equal(d.intent, "edit", JSON.stringify(d).slice(0, 300));
        assert.ok(routerTold(seen).includes(LONG_DESC), "the router was not sent the whole message");
        const post = browserPost(SITE(slug), d, LONG_DESC);
        assert.equal(post.body.instruction, LONG_DESC, "the browser's edit body is not the whole message");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
        assert.ok(String(seen.picks[0]).includes(LONG_DESC), "the lane picker was not sent the whole message");
        const lane = seen.lanes.find((l) => l.field === "description");
        assert.ok(lane && String(lane.asked).includes(LONG_DESC), "the lane was not sent the whole message: " + String(lane && lane.asked).slice(-200));
        assert.equal(storedLook(store, slug).description, NEW_DESC, "the change named at the end was not made");
      }, { slug });
    } finally { compiler.uninstall(); }
  });

  test("THE PAGE STEP IS HANDED THE WHOLE INSTRUCTION (" + mode + "): the router's page answer, the browser's body and the page writer all carry it to its last words, and the move it ends with is made", async () => {
    const slug = freshSlug("long-move-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({ route: { intent: "edit", layer: "page", page: "/visit" }, [T.tweak]: { source: VISIT_MOVED } }, async (seen) => {
        const d = (await routeCall(worker, envFor(store), { slug, message: LONG_MOVE })).body;
        assert.equal(d.layer, "page", JSON.stringify(d).slice(0, 300));
        assert.ok(routerTold(seen).includes(LONG_MOVE));
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), d, LONG_MOVE), mode);
        assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
        assert.equal(String(seen.writers[0].instruction), LONG_MOVE, "the page writer's instruction is not the whole message");
        assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")), "the move named at the end was not made");
      }, { slug });
    } finally { compiler.uninstall(); }
  });

  test("THE TEXT STEP AND THE QUESTION IT ASKS (" + mode + "): its model is sent the whole message, and the question kept for it carries the request whole, last words included — nothing written, nothing charged", async () => {
    const slug = freshSlug("long-text-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    await withWire({ [T.text]: { edits: [], question: Q } }, async (seen) => {
      const at = marks(seen);
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "text" }, LONG_DESC), mode);
      assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
      assert.ok(seen.texts[0].includes(LONG_DESC), "the text step's model was not sent the whole message");
      assert.equal(question(store, slug).request, LONG_DESC, "the request kept with the question is not the whole message");
      assert.equal(charged(seen, at), 0, "a question was charged");
    }, { slug });
  });

  test("AN ADDITION PAST 2,000 CHARACTERS (" + mode + "): the add-on picker and the designer it picks are each sent all of it, and the designer's question keeps the request whole", async () => {
    const slug = freshSlug("long-addon-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const QA = { text: "Should the new page list every loaf, or only today's bake?", options: ["Every loaf", "Today's bake"] };
    const LONG_ADD = PRE.repeat(70) + "And the one thing that matters: add a page listing our breads.";
    await withWire({ [T.adds]: { kinds: ["page"] }, "add:page": { question: QA } }, async (seen) => {
      const at = marks(seen);
      const post = browserPost(SITE(slug), { intent: "addon" }, LONG_ADD);
      assert.equal(post.body.instruction, LONG_ADD, "the browser's add-on body is not the whole message");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
      assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
      assert.ok(seen.inputs[T.adds][0].includes(LONG_ADD), "the add-on picker was not sent the whole message");
      const designer = seen.designers.find((x) => x.kind === "page");
      assert.ok(designer && designer.text.includes(JSON.stringify(LONG_ADD).slice(1, -1)), "the page designer was not sent the whole message");
      assert.equal(question(store, slug).request, LONG_ADD, "the addition's question does not keep the whole request");
      assert.equal(charged(seen, at), 0, "a question was charged");
    }, { slug });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AN ANSWER PAST 500 CHARACTERS IS KEPT AND HANDED ON WHOLE
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("AN ANSWER PAST 500 CHARACTERS (" + mode + "): the router is shown it whole, it rides beside the request whole, and the picker and the step that resumes it are each shown it to its last words", async () => {
    assert.ok(LONG_ANSWER.length > 2000, "the answer is not past the old cuts");
    const slug = freshSlug("long-answer-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    const q = seedQuestion(store, slug, { request: "put the order band above the other one" });
    const told = [{ q: Q.text, a: LONG_ANSWER }];
    try {
      await withWire({
        route: { intent: "edit", layer: "look", answered: true },
        [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/visit", words: "put the order band above the other one" }] },
        [T.tweak]: { source: VISIT_MOVED },
      }, async (seen) => {
        const d = (await routeCall(worker, envFor(store), { slug, message: LONG_ANSWER, ask: { id: q.id } })).body;
        assert.equal(d.ask && d.ask.answered, true, JSON.stringify(d).slice(0, 300));
        assert.ok(routerTold(seen).includes(LONG_ANSWER), "the router was not shown the whole answer");
        assert.deepEqual(d.ask.context, told, "the answer riding beside the request is not the whole answer");
        const post = browserPost(SITE(slug), { ...d, askRound: d.ask.round, context: d.ask.context }, d.instruction);
        assert.deepEqual(post.body.context, told, "the browser's body does not carry the whole answer");
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
        assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(told)), "the picker was not shown the whole answer");
        assert.ok(seen.inputs[T.tweak][0].endsWith(contextBlock(told)), "the page writer was not shown the whole answer");
        assert.ok(bandFirst(storedPage(store, slug, "visit.tsx")));
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

for (const mode of ["sync", "job"]) {
  test("A STEP'S LONG QUESTION (" + mode + "): the picker's question and its answers come back and are kept whole, the last answer's last words included", async () => {
    const slug = freshSlug("step-question-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    await withWire({ [T.pick]: { fields: ["shape"], question: LONG_Q } }, async (seen) => {
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Move the order band up"), mode);
      assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.clarify.text, LONG_Q.text, "the question in the reply was cut");
      assert.deepEqual(r.body.clarify.options, LONG_Q.options, "the answers in the reply were cut or dropped");
      const kept = question(store, slug);
      assert.equal(kept.question.text, LONG_Q.text);
      assert.deepEqual(kept.question.options, LONG_Q.options);
    }, { slug });
  });
}

for (const mode of ["sync", "job"]) {
  test("A STEP'S QUESTION TOO LONG TO SHOW (" + mode + "): nothing is guessed or kept — said as ours, the request whole back to the box, nothing written or charged", async () => {
    const slug = freshSlug("unusable-step-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const tooLong = { text: "Which band? ".repeat(1500), options: ["Home", "Visit"] };
    await withWire({ [T.pick]: { fields: ["shape"], question: tooLong } }, async (seen) => {
      const at = marks(seen);
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, LONG_MOVE), mode);
      assert.equal(r.status, 503, JSON.stringify(r.body).slice(0, 300));
      assert.equal(r.body.error, "ask-unusable");
      assert.equal(r.body.ours, true);
      assert.equal(r.body.clarify, undefined, "an unusable question was offered to be answered");
      assert.equal(r.body.resume, LONG_MOVE, "the request did not come back whole");
      assert.deepEqual(store.questionWrites, [], "an unusable question was kept");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT);
      assert.equal(charged(seen, at), 0);
    }, { slug });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE REQUEST'S FILES AND THE ANSWER'S, NONE CHOSEN OVER ANOTHER
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_Q = { text: "Should this go in the header or the browser tab?", options: ["Header", "Browser tab"] };

// ─────────────────────────────────────────────────────────────────────────────
// 5. EVERY PAGE THE SITE HAS, FROM THE SITE ITSELF
// ─────────────────────────────────────────────────────────────────────────────

const pathOf = (n) => (n === 1 ? "/" : "/p" + n);
const fileOf = (n) => (n === 1 ? "index.tsx" : "p" + n + ".tsx");
const P27_OLD = pageSource("/p27", "<section className=\"intro\"><h1>Page 27</h1><p>About page 27.</p></section><section className=\"hours\"><h2>Opening hours</h2><p>Every morning.</p></section>");
const P27_NEW = pageSource("/p27", "<section className=\"hours\"><h2>Opening hours</h2><p>Every morning.</p></section><section className=\"intro\"><h1>Page 27</h1><p>About page 27.</p></section>");
const P27_ASK = "On page 27, put the opening hours above the introduction.";
const thirtyPages = () => Array.from({ length: 30 }, (_, i) => i + 1).map((n) => ({ path: fileOf(n), source: n === 1 ? HOME : n === 27 ? P27_OLD : pageSource(pathOf(n), "<section><h1>Page " + n + "</h1></section>") }));

// ─────────────────────────────────────────────────────────────────────────────
// 7. AT THE REAL BOUNDARY: REFUSED WHOLE, NOTHING LOST, NOTHING SPENT
// ─────────────────────────────────────────────────────────────────────────────

const AT_BOUND = PRE.repeat(Math.ceil(MAX_INPUT_CHARS / PRE.length)).slice(0, MAX_INPUT_CHARS - END_DESC.length) + END_DESC;
const PAST_BOUND = AT_BOUND + "!";
