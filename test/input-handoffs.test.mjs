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
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as browserPage, settle, copy, fakeIndexedDB } from "./fixtures/browser-page.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS, REWRITE_MAX_CHARS } from "../builder/input-budget.mjs";
import { QUESTION_KEY, contextBlock } from "../builder/clarify.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import {
  T, USER, OTHER, TOKEN, HOME, VISIT, VISIT_MOVED, NEW_DESC, Q, page as pageSource, freshSlug, bucket, question, seedQuestion,
  withWire, envFor, routeCall, browserPost, postRoute, SITE, SOURCE_KEY, storedLook, storedPage, userText,
} from "./fixtures/live-ask.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

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

test("THE PAGE SENDS AN ANSWER PAST 500 WHOLE: what is typed under a question goes to the routing route as typed", async () => {
  const p = browserPage({ site: { id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [], ask: { id: "a".repeat(32), text: Q.text, options: Q.options, attached: false } } });
  p.ctx.siteSend(LONG_ANSWER);
  await settle();
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, ROUTE);
  assert.equal(p.calls[0].body.message, LONG_ANSWER, "the answer was cut on its way out");
  assert.equal(p.calls[0].body.ask.id, "a".repeat(32));
});

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

test("AN ANSWER WHOSE FILES WOULD TAKE THE REQUEST PAST ONE REQUEST'S FILES IS NOT SENT: no request at all, the answer and its files back in the box, the question still up, and the number said", async () => {
  const idb = fakeIndexedDB();
  const qid = "c".repeat(32);
  idb.data.set(qid, { at: Date.now(), imgs: [PNG_A, JPG_B] });
  const p = browserPage({
    site: { id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [],
      ask: { id: qid, text: LOGO_Q.text, options: LOGO_Q.options, attached: true }, draft: { t: "", imgs: [JPG_C, PNG_A] } },
    idb,
  });
  p.ctx.siteSend("Header — these two as well");
  await settle(200);
  assert.deepEqual(p.calls, [], "something was sent past the files one request carries");
  assert.equal(p.ask().id, qid, "the question came off");
  assert.deepEqual(copy(p.s.unsent), [{ t: "Header — these two as well", imgs: [JPG_C, PNG_A] }], "the answer and its files were not put back");
  assert.match(p.last().t, /already carries 2 files, and one request can carry 3, so this answer can add one more/);
  assert.deepEqual(idb.data.get(qid).imgs, [PNG_A, JPG_B], "the request's own files were touched");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EVERY PAGE THE SITE HAS, FROM THE SITE ITSELF
// ─────────────────────────────────────────────────────────────────────────────

const pathOf = (n) => (n === 1 ? "/" : "/p" + n);
const fileOf = (n) => (n === 1 ? "index.tsx" : "p" + n + ".tsx");
const P27_OLD = pageSource("/p27", "<section className=\"intro\"><h1>Page 27</h1><p>About page 27.</p></section><section className=\"hours\"><h2>Opening hours</h2><p>Every morning.</p></section>");
const P27_NEW = pageSource("/p27", "<section className=\"hours\"><h2>Opening hours</h2><p>Every morning.</p></section><section className=\"intro\"><h1>Page 27</h1><p>About page 27.</p></section>");
const P27_ASK = "On page 27, put the opening hours above the introduction.";
const thirtyPages = () => Array.from({ length: 30 }, (_, i) => i + 1).map((n) => ({ path: fileOf(n), source: n === 1 ? HOME : n === 27 ? P27_OLD : pageSource(pathOf(n), "<section><h1>Page " + n + "</h1></section>") }));

test("A RELOAD OF A SITE WITH EIGHT PAGES KEEPS ALL EIGHT: the save keeps every page's address (markup only for six), and the routing call made after the reload names every one", async () => {
  // THE SAVE, AS THE PAGE RUNS IT: `sitesSave` out of chat.js, over a storage that keeps what it is given.
  const open = CHAT.indexOf("\nfunction sitesSave(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, "sitesSave's landmarks are gone from chat.js");
  const stored = new Map();
  const pages = Array.from({ length: 8 }, (_, i) => ({ path: i === 0 ? "/" : "/p" + (i + 1), name: "Page " + (i + 1), html: "<main>page " + (i + 1) + "</main>" }));
  const ctx = vm.createContext({
    SITES_KEY: "zephyr_sites_v1",
    localStorage: { setItem: (k, v) => stored.set(k, String(v)), getItem: (k) => (stored.has(k) ? stored.get(k) : null) },
    sitesCache: [{ id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", pages, msgs: [] }],
    sbToast: () => {},
    // NO OTHER TAB HAS WRITTEN (2026-10-07): the save takes nothing in first.
    sitesStoredStale: false,
    // 2026-10-23 (r1-combine): the save now keeps at most twenty records
    // (`sitesKept`, preferring the open one, `siteOpenId`); both are carried
    // in, the function out of chat.js, so the save runs as the page runs it.
    siteOpenId: "o",
  });
  const keptAt = CHAT.indexOf("\nfunction sitesKept(");
  assert.ok(keptAt > 0, "sitesKept's landmark is gone from chat.js");
  vm.runInContext(CHAT.slice(keptAt, CHAT.indexOf("\n}\n", keptAt) + 3), ctx);
  vm.runInContext(CHAT.slice(open, shut + 3), ctx);
  ctx.sitesSave();
  const [saved] = JSON.parse(stored.get("zephyr_sites_v1"));
  assert.deepEqual(saved.pages.map((x) => x.path), pages.map((x) => x.path), "the saved record lost pages");
  assert.deepEqual(saved.pages.map((x) => x.name), pages.map((x) => x.name));
  assert.deepEqual(saved.pages.map((x) => x.html !== ""), [true, true, true, true, true, true, false, false], "markup was kept past six, or dropped inside them");
  // THE RELOAD: a page that starts from the saved record alone.
  const p = browserPage({ site: saved });
  p.ctx.siteSend("Change the heading on the seventh page");
  await settle();
  assert.equal(p.calls[0].url, ROUTE);
  assert.deepEqual(p.calls[0].body.site.pages, pages.map((x) => x.path), "the routing call after a reload does not name every page");
});

test("THE BROWSER'S ROUTES READ, A LONGER LIST GAINS WHAT IT LACKS: pages it holds keep their names and markup, the site's others are added after them", async () => {
  const site = { id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", msgs: [],
    pages: [{ path: "/", name: "Home", html: "<main>home</main>" }, { path: "/visit", name: "Visit", html: "" }] };
  const p = browserPage({ site });
  assert.equal(p.ctx.siteRoutesApply("o", ["/", "/visit", "/p3", "/p27"]), true);
  assert.deepEqual(p.s.pages.map((x) => x.path), ["/", "/visit", "/p3", "/p27"]);
  assert.equal(p.s.pages[0].html, "<main>home</main>", "a page's cached markup was dropped");
  assert.equal(p.s.pages[0].name, "Home");
  assert.equal(p.ctx.siteRoutesApply("o", ["/", "/visit"]), false, "a list with nothing missing was written");
});

test("ANOTHER OWNER'S SITE: the route never reads its pages, and the router is shown only what the browser sent", async () => {
  const slug = freshSlug("not-mine");
  const store = bucket(slug);
  store.poke(SOURCE_KEY(slug), JSON.stringify(thirtyPages()));
  const reads = readLog(store);
  const worker = await loadWorker();
  await withWire({ route: { intent: "ask", answer: "Hello." } }, async (seen) => {
    const d = (await routeCall(worker, envFor(store), { slug, message: "What pages do I have?" })).body;
    assert.ok(!reads.includes(SOURCE_KEY(slug)), "another owner's pages were read: " + reads.join(", "));
    assert.ok(!routerTold(seen).includes("/p27"), "the router was shown another owner's pages");
    assert.ok(!(d.decision && d.decision.reasons || []).includes("pages-filled"));
  }, { owner: OTHER, slug });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AT THE REAL BOUNDARY: REFUSED WHOLE, NOTHING LOST, NOTHING SPENT
// ─────────────────────────────────────────────────────────────────────────────

const AT_BOUND = PRE.repeat(Math.ceil(MAX_INPUT_CHARS / PRE.length)).slice(0, MAX_INPUT_CHARS - END_DESC.length) + END_DESC;
const PAST_BOUND = AT_BOUND + "!";

for (const mode of ["sync", "job"]) {
  test("THE EDIT AND ADD-ON ROUTES PAST THE BOUND (" + mode + "): a direct caller's instruction past one message, or files past one request's, is refused with the numbers before any model — never cut", async () => {
    const worker = await loadWorker();
    {
      const slug = freshSlug("edit-past-" + mode);
      const store = bucket(slug);
      await withWire({}, async (seen) => {
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, PAST_BOUND), mode);
        assert.equal(r.status, 422, JSON.stringify(r.body).slice(0, 300));
        assert.equal(r.body.error, "input-too-long");
        assert.equal(r.body.cost, 0);
        assert.match(r.body.msg, /16,001/);
        assert.deepEqual(seen.calls, [], "a model was asked about an instruction past the bound");
      }, { slug });
    }
    {
      const slug = freshSlug("files-past-" + mode);
      const store = bucket(slug);
      await withWire({}, async (seen) => {
        const post = browserPost(SITE(slug), { intent: "edit", layer: "logo" }, "Use this as our logo", [PNG_A]);
        post.body.images = [PNG_A, JPG_B, JPG_C, PNG_A];
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.status, 422, JSON.stringify(r.body).slice(0, 300));
        assert.equal(r.body.error, "too-many-files");
        assert.match(r.body.msg, /4 files/);
        assert.deepEqual([...store.store.keys()].filter((k) => k.startsWith("uploads/")), [], "a file was stored");
      }, { slug });
    }
    {
      const slug = freshSlug("addon-past-" + mode);
      const store = bucket(slug);
      await withWire({}, async (seen) => {
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE(slug), { intent: "addon" }, PAST_BOUND), mode);
        assert.equal(r.body.error, "input-too-long", JSON.stringify(r.body).slice(0, 300));
        assert.equal(r.body.chars, MAX_INPUT_CHARS + 1);
        assert.deepEqual(seen.calls, [], "a model was asked about an addition past the bound");
      }, { slug });
    }
  });
}

test("THE PAGE AT THE BOUND: a message past it is not sent and stays in the box with the numbers said; an answer past it leaves the question waiting", async () => {
  const base = { id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
  {
    const p = browserPage({ site: base });
    p.ctx.siteSend(PAST_BOUND);
    await settle();
    assert.deepEqual(p.calls, [], "a message past the bound was sent");
    assert.equal(p.s.draft.t, PAST_BOUND, "the words did not go back in the box");
    assert.match(p.last().t, /16,001 characters, more than one message can hold \(16,000/);
    assert.equal(p.busy(), false);
  }
  {
    const qid = "d".repeat(32);
    const p = browserPage({ site: { ...base, ask: { id: qid, text: Q.text, options: Q.options, attached: false } } });
    p.ctx.siteSend(PAST_BOUND);
    await settle();
    assert.deepEqual(p.calls, [], "an answer past the bound was sent");
    assert.equal(p.ask().id, qid, "the question came off");
    assert.equal(p.s.draft.t, PAST_BOUND);
    assert.match(p.last().t, /^That answer is 16,001 characters/);
  }
  {
    // AT THE BOUND IT GOES, WHOLE.
    const p = browserPage({ site: base });
    p.ctx.siteSend(AT_BOUND);
    await settle();
    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].body.message, AT_BOUND);
  }
});

test("A REQUEST THE FULL REWRITE WOULD READ ONLY PART OF IS NOT REWRITTEN: past the rewrite's own 4,000 it is held in the box with that reason, and no rewrite starts", async () => {
  assert.equal(EditPoll.REWRITE_MAX, REWRITE_MAX_CHARS);
  const site = { id: "o", slug: "harbour-loaf", react: true, name: "Harbour Loaf", url: "https://harbour-loaf.gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
  const p = browserPage({ site, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "build", cost: 2 } } : null) });
  p.ctx.siteSend(LONG_DESC);
  await settle();
  assert.equal(p.calls.length, 1, "a rewrite started on a request it would read only part of: " + JSON.stringify(p.calls.map((c) => c.url)));
  assert.equal(p.calls[0].body.message, LONG_DESC, "the routing call was not sent the whole request");
  assert.deepEqual(copy(p.s.unsent), [{ t: LONG_DESC, imgs: [] }], "the request was not held to send again");
  assert.match(p.last().t, /4,000 characters/);
});

test("PICKING MORE FILES THAN ONE MESSAGE CARRIES NAMES THE ONES LEFT OUT: the strip takes what fits, and the rest are said by name, never dropped without a word", async () => {
  const cutFn = (head) => {
    const open = CHAT.indexOf("\nfunction " + head + "(");
    const shut = CHAT.indexOf("\n}\n", open);
    assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
    return CHAT.slice(open, shut + 3);
  };
  const line = CHAT.slice(CHAT.indexOf("\nconst SITE_MAX_FILES ="), CHAT.indexOf("\n", CHAT.indexOf("\nconst SITE_MAX_FILES =") + 1) + 1);
  for (const [had, picked, want] of [
    [0, ["a.png", "b.png", "c.png", "d.png", "e.png"], "One message can carry 3 files, so 2 weren’t attached: d.png, e.png."],
    [2, ["c.png", "d.png"], "One message can carry 3 files, so d.png wasn’t attached."],
    [3, ["d.png"], "One message can carry 3 files, so d.png wasn’t attached."],
  ]) {
    const toasts = [];
    const draft = { t: "", imgs: Array.from({ length: had }, (_, i) => ({ name: "kept" + i + ".png", data: PNG_A })) };
    const ctx = vm.createContext({ siteAttachFor: "o", siteDraft: () => draft, siteAttachOne: async (f) => ({ name: f.name, data: PNG_A }), sbToast: (t) => toasts.push(t), paintAttachStrip: () => {} });
    vm.runInContext(line + cutFn("siteAttachFiles"), ctx);
    ctx.siteAttachFiles(picked.map((name) => ({ name })));
    await settle();
    assert.deepEqual(toasts, [want], "the files left out were not named: " + JSON.stringify(toasts));
    assert.equal(draft.imgs.length, 3, "the strip did not take what fits");
  }
});
