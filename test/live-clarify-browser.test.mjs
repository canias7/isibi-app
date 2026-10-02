// QUESTIONS BACK ON A SITE THAT EXISTS — THE PAGE'S HALF (2026-10-02).
//
// Owner: *"Use existing site context before asking, accept typed answers and
// useful optional choices, and preserve the original request, attachments,
// scope, deferred parts, and completed work across the answer and page refresh.
// Resume with the answer incorporated without repeating completed changes or
// charges; support cancellation and a changed request, and prevent stale answers
// from triggering work."*
//
// THE REAL HANDLERS, cut out of public/chat.js and run in a VM: the send
// handler, the routing call, the answer, the cancel, the reload check, the card,
// its keys and its clicks, and the edit and add-on posts they lead to. The
// network is scripted per URL; IndexedDB, where a case needs it, is a small
// stand-in kept in memory that outlives one page load, as the browser's does.
//
// Every server answer here is SUPPLIED, in the shapes `worker.js` answers
// (test/live-clarify-route.test.mjs drives those routes themselves). This
// proves what the page does with each answer, never what a model asks.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { ASK_FNS, ASK_LINES } from "./fixtures/browser-ask.mjs";
import { BROWSER_FNS, EDIT_BROWSER_FNS } from "../scripts/addon-sweep.mjs";

const realEditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// A top-level function runs from its declaration to the first `}` at column 0.
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHAT.slice(open, shut + 3);
}
function cutLine(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
}
// A STATEMENT, from its first line to its own closing line, chosen by what it holds.
function cutStatement(first, last, holding) {
  let from = 0;
  for (;;) {
    const open = CHAT.indexOf(first, from);
    assert.ok(open >= 0, "no `" + first.trim() + "` holding " + holding + " in chat.js");
    const shut = CHAT.indexOf(last, open);
    assert.ok(shut > open, "`" + first.trim() + "` has no end in chat.js");
    const body = CHAT.slice(open, shut + last.length);
    if (body.includes(holding)) return body;
    from = shut;
  }
}
// THE KEYS: the one listener that answers a live question by its number and cancels it on Esc.
const KEYS = cutStatement("\ndocument.addEventListener('keydown', (e) => {", "\n});\n", "siteAskCancel()");
// THE CLICKS: the thread's one delegated handler, assigned on every render.
const CLICKS = cutStatement("\n    thread.onclick = (e) => {", "\n    };\n", "data-ask-ans");

// THE FUNCTIONS: the send and route handlers, the question block, and both
// readers' whole selection (the lists the sweep's readers run, so a reply here
// is read by exactly what reads it on the page).
const FNS = [...new Set([
  "esc", "routeQuestion", "routeActionable", "siteRoute", "siteHoldUnsent",
  "siteRoutesRead", "siteRoutesApply", "siteWithPages", "pageFromPath", "siteDraft", "siteSend", "siteBuildStart",
  "siteEdit", "editAsk", "editAskDone", "siteAddon", "addonAnswer", "readRouteReply",
  ...ASK_FNS, "siteAskHTML", "siteLiveAskHTML", "siteAskCancel", "siteAskCheck",
  "readAddonReply", "readEditReply", "addonOutcomeMsg", "alsoTail",
  "reactSend", "reactStageLabel", "buildCostWords", "buildErrOutcome",
  ...BROWSER_FNS, ...EDIT_BROWSER_FNS,
])];
const LINES = [...new Set([
  "const ROUTE_EDIT_LAYERS =", "const siteRoutesAsked =", "const SITE_ROUTES_WAIT_MS =", "const siteRoutesPending =",
  "const SITE_NO_PAGES_MSG =", "const siteNewDraft =", "function siteBuildStop(", ...ASK_LINES, "const siteAskChecked =",
  "const ST_PHASE_ORDER =",
])];
const SRC = [
  cut("async function apiFetch("),
  ...FNS.map((n) => cut("function " + n + "(")),
  ...LINES.map(cutLine),
  KEYS,
  "function wireThread(thread) {" + CLICKS + "}",
].join("\n");

const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 60) => { for (let i = 0; i < n; i++) await tick(); };
const copy = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/**
 * INDEXEDDB AS A BROWSER KEEPS IT: one store per origin that outlives a page
 * load. Only what `askFilesDb`/`askFilesStore`/`askFilesFor`/`askFilesDrop`
 * use: open with an upgrade, one store, put/get/delete and a cursor.
 */
function fakeIndexedDB() {
  const data = new Map();
  let created = false;
  const later = (fn) => Promise.resolve().then(fn);
  const db = {
    transaction(name) {
      assert.equal(name, "files", "a store other than the question files was opened");
      return {
        objectStore() {
          return {
            put(v, k) { data.set(k, JSON.parse(JSON.stringify(v))); return {}; },
            get(k) {
              const r = { onsuccess: null, onerror: null, result: undefined };
              later(() => { r.result = data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : undefined; if (r.onsuccess) r.onsuccess(); });
              return r;
            },
            delete(k) { data.delete(k); return {}; },
            openCursor() {
              const r = { onsuccess: null, result: null };
              const keys = [...data.keys()];
              let i = 0;
              const step = () => later(() => {
                if (i >= keys.length) { r.result = null; if (r.onsuccess) r.onsuccess(); return; }
                const k = keys[i++];
                r.result = { key: k, value: data.get(k), delete() { data.delete(k); }, continue() { step(); } };
                if (r.onsuccess) r.onsuccess();
              });
              step();
              return r;
            },
            createObjectStore() {},
          };
        },
      };
    },
    createObjectStore() { created = true; },
  };
  return {
    data,
    open() {
      const r = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: db };
      later(() => { if (!created && r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); });
      return r;
    },
  };
}

/**
 * ONE PAGE LOAD. `answer(url, method, body)` returns `{ status, body }`, a
 * `{ reject }`, or nothing for a request that never answers. `site` is the
 * record as `sitesSave` would have kept it. Returns the page's handles.
 */
function page({ site, answer = () => null, idb } = {}) {
  const calls = [];
  const keys = [];
  const s = copy(site);
  if (!Array.isArray(s.msgs)) s.msgs = [];
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent,
    document: { addEventListener: (type, fn) => { if (type === "keydown") keys.push(fn); } },
    indexedDB: idb,
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      const body = init && init.body ? JSON.parse(init.body) : undefined;
      calls.push({ url: String(url), method, body });
      const a = answer(String(url), method, body, calls.length - 1);
      if (!a) return new Promise(() => {});
      const respond = (x) => {
        if (x.reject) return Promise.reject(x.reject);
        return new Response(typeof x.body === "string" ? x.body : JSON.stringify(x.body), { status: x.status || 200, headers: { "content-type": "application/json" } });
      };
      // A LATE ANSWER: a promise the case resolves when it chooses.
      if (typeof a.then === "function") return a.then(respond);
      return Promise.resolve().then(() => respond(a));
    },
    setInterval: () => ({}), clearInterval: () => {}, setTimeout: () => ({}), clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    siteById: (id) => (id === s.id ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null,
    siteOpenId: s.id,
    renderSites: () => {},
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-1", outcomeMessage: (k) => "outcome:" + k, rememberJob: () => {}, forgetJob: () => {} },
    browserTimeZone: () => "Europe/London",
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  const thread = { onclick: null, contains: () => true };
  ctx.wireThread(thread);
  return {
    s, ctx, calls, thread,
    said: () => copy(s.msgs),
    last: () => copy(s.msgs[s.msgs.length - 1]),
    ask: () => (s.ask == null ? null : copy(s.ask)),
    busy: () => ctx.siteBusy,
    key: (k, tag = "body") => { let stopped = false; keys.forEach((fn) => fn({ key: k, target: { tagName: tag }, preventDefault: () => { stopped = true; } })); return stopped; },
    click: (attr, value) => thread.onclick({ target: { closest: (sel) => (sel === "[" + attr + "]" ? { getAttribute: () => value } : null) } }),
    files: (id) => ctx.askFilesFor(id).then(copy),
  };
}

const SLUG = "harbour-loaf";
const QID = "a".repeat(32);
const QID2 = "b".repeat(32);
const Q = { id: QID, text: "Which page should the band move on — Home or Visit?", options: ["Home", "Visit"] };
const REQ = "Move the order band up";
const RESUMED = REQ + "\n\nThey were asked: " + Q.text + "\nThey answered: Visit";
const IMG = "data:image/png;base64,iVBORw0KGgo=";
const LIVE = { id: "origin-1", slug: SLUG, react: true, name: "Harbour Loaf", url: "https://" + SLUG + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
const qMsg = (q) => ({ r: "a", t: q.text, q: q.text, opts: q.options, ask: q.id });
const asking = (q = Q, attached = false) => ({ ...LIVE, ask: { id: q.id, text: q.text, options: q.options, attached }, msgs: [{ r: "u", t: REQ }, qMsg(q)] });
const ROUTE = "/api/site/route";
const EDIT = "/api/site/" + SLUG + "/edit";
const ADDON = "/api/site/" + SLUG + "/addon";
const QUESTION = "/api/site/" + SLUG + "/question";
const STALE = "That question was already answered or set aside, so I didn't act on your reply. Tell me what you'd like and I'll take it from there.";
const posted = (p, url) => p.calls.filter((c) => c.url === url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE QUESTION GOES UP
// ─────────────────────────────────────────────────────────────────────────────

test("THE ROUTER'S QUESTION BECOMES THE LIVE CARD: its words last, its answers numbered, Cancel always there, nothing else sent", async () => {
  const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: Q, cost: 2 } } : null) });
  p.ctx.siteSend(REQ);
  await settle();
  assert.equal(p.calls.length, 1, "something was sent after a question: " + JSON.stringify(p.calls.map((c) => c.url)));
  assert.equal(p.calls[0].body.ask, undefined, "a first message claimed to answer something");
  assert.equal(p.calls[0].body.hasSite, true);
  assert.deepEqual(p.ask(), { id: QID, text: Q.text, options: Q.options, attached: false });
  assert.deepEqual(p.said(), [{ r: "u", t: REQ }, qMsg(Q)]);
  assert.equal(p.busy(), false, "the page stayed busy behind a question");
  const html = p.ctx.siteAskHTML(p.s.msgs[1], p.s);
  assert.match(html, /data-ask-ans="Home"[^]*<kbd>1<\/kbd>[^]*data-ask-ans="Visit"[^]*<kbd>2<\/kbd>/);
  assert.match(html, /data-ask-cancel="1"[^]*Cancel this request/);
  assert.doesNotMatch(html, /data-skip|data-ans="/, "a first build's buttons were drawn under a live site's question");
  // AN OLDER QUESTION KEEPS ITS WORDS AND LOSES ITS BUTTONS.
  assert.equal(p.ctx.siteAskHTML(qMsg({ ...Q, id: QID2 }), p.s), "", "a question that is not the live one was drawn with answers");
});

test("A QUESTION WITH NO ANSWERS OFFERED STILL HAS ITS WAY OUT, and the composer is its answer", async () => {
  const bare = { id: QID, text: "What should the new heading say?", options: [] };
  const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: bare, cost: 2 } } : null) });
  p.ctx.siteSend("Change the heading");
  await settle();
  const html = p.ctx.siteAskHTML(p.s.msgs[1], p.s);
  assert.doesNotMatch(html, /data-ask-ans/);
  assert.match(html, /data-ask-cancel/, "a question with no buttons offered no way to cancel it");
});

test("THE MESSAGE'S FILES ARE KEPT WITH ITS QUESTION, so the answer can carry them", async () => {
  const p = page({ site: { ...LIVE, draft: { t: "", imgs: [IMG] } }, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: Q, cost: 2 } } : null) });
  p.ctx.siteSend("Use this picture");
  await settle();
  assert.equal(p.calls[0].body.attached, true);
  assert.equal(p.ask().attached, true);
  assert.deepEqual(await p.files(QID), [IMG], "the files that came with the request were not kept beside its question");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE ANSWER — typed, pressed, by its key
// ─────────────────────────────────────────────────────────────────────────────

const RESUME_ANSWER = { ok: true, intent: "edit", layer: "look", instruction: RESUMED, ask: { answered: true, round: 1, putOff: ["add a gallery page"] }, cost: 2 };

test("A TYPED ANSWER RESUMES THE WAITING REQUEST: the route is told which question it answers, the card comes off, and the step is posted the request with the answer, its count and what it put off", async () => {
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: RESUME_ANSWER } : null) });
  p.ctx.siteSend("Visit");
  await settle();
  const r = p.calls[0];
  assert.equal(r.url, ROUTE);
  assert.equal(r.body.message, "Visit");
  assert.deepEqual(r.body.ask, { id: QID, chosen: false });
  assert.equal(r.body.firstBuild, false);
  const [e] = posted(p, EDIT);
  assert.ok(e, "the answered request was not posted to its step");
  assert.equal(e.body.instruction, RESUMED, "the step was posted the typed answer, not the request it answers");
  assert.equal(e.body.askRound, 1);
  assert.equal(e.body.putOff, "add a gallery page");
  assert.equal(e.body.layer, "look");
  assert.equal(p.ask(), null, "the answered question's card stayed up");
  assert.deepEqual(p.said().slice(-1), [{ r: "u", t: "Visit" }]);
});

test("A PRESSED ANSWER, BY CLICK OR BY ITS NUMBER, IS SENT AS ONE — and leaves the composer's files where they are", async () => {
  for (const how of ["click", "key"]) {
    const p = page({ site: { ...asking(), draft: { t: "", imgs: [IMG] } }, answer: (url) => (url === ROUTE ? { body: RESUME_ANSWER } : null) });
    if (how === "click") p.click("data-ask-ans", "Visit");
    else assert.equal(p.key("2"), true, "the number key did nothing");
    await settle();
    const r = p.calls[0];
    assert.equal(r.body.message, "Visit", how);
    assert.deepEqual(r.body.ask, { id: QID, chosen: true }, how + ": a pressed answer was not sent as one");
    assert.equal(r.body.attached, false, how + ": the composer's files rode a pressed answer");
    assert.deepEqual(copy(p.s.draft.imgs), [IMG], how + ": a pressed answer took the composer's files");
  }
});

test("THE KEYS ANSWER ONLY WHILE THE CARD IS ON THE THREAD, and never while typing", async () => {
  {
    const p = page({ site: asking() });
    assert.equal(p.key("1", "textarea"), false);
    assert.equal(p.key("1", "input"), false);
    await settle();
    assert.deepEqual(p.calls, [], "a digit typed in the composer answered the question");
  }
  {
    const p = page({ site: { ...asking(), msgs: [{ r: "u", t: REQ }] } });
    assert.equal(p.key("1"), false);
    assert.equal(p.key("Escape"), false);
    await settle();
    assert.deepEqual(p.calls, [], "a key answered a question whose card is not on the thread");
  }
  {
    const p = page({ site: asking() });
    assert.equal(p.key("3"), false, "a number past the answers offered did something");
    await settle();
    assert.deepEqual(p.calls, []);
  }
});

test("A CHANGED REQUEST: the card comes off and the new request runs on its own words, with nothing from the old one", async () => {
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "addon", ask: { answered: false }, cost: 2 } } : null) });
  p.ctx.siteSend("Actually, add a gallery page");
  await settle();
  const [a] = posted(p, ADDON);
  assert.ok(a, "the new request was not posted");
  assert.equal(a.body.instruction, "Actually, add a gallery page");
  assert.equal(a.body.askRound, undefined, "the new request took the old one's question count");
  assert.equal(a.body.putOff, undefined, "the new request took the old one's put-off parts");
  assert.equal(p.ask(), null);
});

test("THE ROUTER ASKS AGAIN AFTER THE ANSWER: the old card comes off, the new one goes up, and the request's files go with it", async () => {
  const Q2 = { id: QID2, text: "Above which heading exactly?", options: [] };
  const p = page({ site: asking(Q, true), answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: Q2, ask: { answered: true, round: 1 }, cost: 2 } } : null) });
  p.ctx.askFilesStore(QID, [IMG]);
  p.ctx.siteSend("Visit");
  await settle();
  assert.equal(p.calls.length, 1, "work was sent while the request still waits on a question");
  assert.deepEqual(p.ask(), { id: QID2, text: Q2.text, options: [], attached: true }, "the second question did not replace the first: " + JSON.stringify(p.last()));
  assert.deepEqual(p.last(), qMsg(Q2));
  assert.deepEqual(await p.files(QID2), [IMG], "the request's files did not move to its new question");
  assert.deepEqual(await p.files(QID), [], "the answered question's files were kept");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FILES ACROSS A RELOAD
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_Q = { id: QID, text: "Should this picture go in the header or the browser tab?", options: ["Header", "Browser tab"] };
const LOGO_RESUMED = "Use this picture\n\nThey were asked: " + LOGO_Q.text + "\nThey answered: Browser tab";

test("AFTER A RELOAD IN THE SAME BROWSER, THE ANSWER STILL CARRIES THE REQUEST'S FILES to the step that uses them", async () => {
  const idb = fakeIndexedDB();
  const first = page({ site: { ...LIVE, draft: { t: "", imgs: [IMG] } }, idb, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: LOGO_Q, cost: 2 } } : null) });
  first.ctx.siteSend("Use this picture");
  await settle();
  assert.ok(idb.data.has(QID), "the files were not kept in this browser's store");
  // THE RELOAD: the record as it was saved, and a page that has never held the files in memory.
  const saved = copy(first.s);
  delete saved.draft;
  const second = page({ site: saved, idb, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "logo", tab: true, instruction: LOGO_RESUMED, ask: { answered: true, round: 1 }, cost: 2 } } : null) });
  second.click("data-ask-ans", "Browser tab");
  await settle();
  assert.equal(second.calls[0].body.attached, true, "the route was not told the request carried files");
  const [e] = posted(second, EDIT);
  assert.ok(e, "the answered request was not posted");
  assert.deepEqual(e.body.images, [IMG], "the request's picture did not reach the step after a reload");
  assert.equal(e.body.tab, true);
  assert.equal(e.body.instruction, LOGO_RESUMED);
  assert.equal(idb.data.has(QID), false, "an answered question's files were left in the store");
});

test("A QUESTION'S FILES LIVE A DAY IN THIS BROWSER'S STORE: an older entry goes when the next is kept", async () => {
  const idb = fakeIndexedDB();
  idb.data.set("c".repeat(32), { at: Date.now() - 24 * 60 * 60 * 1000 - 1000, imgs: [IMG] });
  idb.data.set("d".repeat(32), { at: Date.now() - 60 * 1000, imgs: [IMG] });
  const p = page({ site: { ...LIVE, draft: { t: "", imgs: [IMG] } }, idb, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: Q, cost: 2 } } : null) });
  p.ctx.siteSend("Use this picture");
  await settle();
  assert.deepEqual([...idb.data.keys()].sort(), ["d".repeat(32), QID].sort(), "a day-old question's files were kept, or a fresh one's were dropped");
});

test("A BROWSER WITHOUT THE FILES DOES NOT ANSWER WITHOUT THEM: nothing is sent, the answer is held, and the file is asked for — then sent with it", async () => {
  const p = page({ site: asking(LOGO_Q, true), idb: undefined, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "logo", tab: true, instruction: LOGO_RESUMED, ask: { answered: true, round: 1 }, cost: 2 } } : null) });
  p.click("data-ask-ans", "Browser tab");
  await settle();
  assert.deepEqual(p.calls, [], "an answer was sent without the file its question is about");
  assert.match(p.last().t, /^⚠️ That question is about the file you sent with your request, and this browser no longer has it/);
  assert.deepEqual(copy(p.s.unsent), [{ t: "Browser tab", imgs: [] }], "the answer was not kept to send again");
  assert.equal(p.ask().id, QID, "the question was dropped");
  assert.equal(p.busy(), false);
  // ATTACHED AGAIN, WITH THE ANSWER TYPED: it goes, and the picture with it.
  p.s.draft = { t: "", imgs: [IMG] };
  p.ctx.siteSend("Browser tab");
  await settle();
  assert.equal(p.calls[0].body.attached, true);
  assert.deepEqual(posted(p, EDIT)[0].body.images, [IMG]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AN ANSWER THE ROUTE WILL NOT ACT ON
// ─────────────────────────────────────────────────────────────────────────────

test("A STALE ANSWER STARTS NOTHING: the card comes off and the route's own sentence is said", async () => {
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { status: 409, body: { ok: false, error: "stale-question", why: "closed", cost: 0, msg: STALE } } : null) });
  p.ctx.siteSend("Visit");
  await settle();
  assert.equal(p.calls.length, 1, "work was sent on a stale answer");
  assert.equal(p.ask(), null, "a question the server has closed kept its card");
  assert.deepEqual(p.last(), { r: "a", t: "⚠️ " + STALE });
  assert.equal(p.busy(), false);
});

test("AN ANSWER TOO LONG FOR ITS REQUEST STARTS NOTHING, and the question stays for a shorter one", async () => {
  const msg = "I couldn't add that answer to your last request — together they're longer than I can take in one go. Send the whole request again with the detail in it.";
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { status: 422, body: { ok: false, error: "answer-too-long", cost: 0, msg } } : null) });
  p.ctx.siteSend("y".repeat(300));
  await settle();
  assert.equal(p.calls.length, 1);
  assert.equal(p.ask().id, QID, "a question still open lost its card");
  assert.deepEqual(p.last(), { r: "a", t: "⚠️ " + msg });
});

test("A ROUTE THAT FAILS ON AN ANSWER IS A FAILURE, SAID: the answer is held to send again and the question stays", async () => {
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "addon", cost: 0, failed: true, failure: { kind: "store" } } } : null) });
  p.ctx.siteSend("Visit");
  await settle();
  assert.equal(p.calls.length, 1, "a failed routing call on an answer started work");
  assert.match(p.last().t, /^⚠️ I couldn’t work out what to do with that just now/);
  assert.deepEqual(copy(p.s.unsent), [{ t: "Visit", imgs: [] }]);
  assert.equal(p.ask().id, QID, "a technical failure took the question away");
});

test("A SETTLEMENT THE PAGE CANNOT READ IS NOT ACTED ON: held to send again, said, and the question stays", async () => {
  for (const ask of [{ answered: "true" }, "answered", [true], { answered: 1 }, null]) {
    const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", instruction: RESUMED, ask, cost: 2 } } : null) });
    p.ctx.siteSend("Visit");
    await settle();
    assert.equal(p.calls.length, 1, JSON.stringify(ask) + ": work was sent on a settlement nobody can read");
    assert.match(p.last().t, /^⚠️ I couldn’t work out what to do with that just now/, JSON.stringify(ask));
    assert.deepEqual(copy(p.s.unsent), [{ t: "Visit", imgs: [] }], JSON.stringify(ask));
    assert.equal(p.ask().id, QID, JSON.stringify(ask) + ": the question was taken away");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CANCEL
// ─────────────────────────────────────────────────────────────────────────────

test("CANCEL CLOSES THE QUESTION ON THE SERVER, takes the card off, and names what the request had put off — by its button, by Esc, or after another tab closed it", async () => {
  for (const how of ["button", "esc"]) {
    const p = page({ site: asking(), answer: (url, method) => (url === QUESTION && method === "POST" ? { body: { ok: true, cancelled: true, putOff: ["add a gallery page"] } } : null) });
    if (how === "button") p.click("data-ask-cancel", "1");
    else assert.equal(p.key("Escape"), true);
    await settle();
    assert.deepEqual(p.calls.map((c) => [c.url, c.method, c.body]), [[QUESTION, "POST", { id: QID, cancel: true }]], how);
    assert.equal(p.ask(), null, how);
    const said = p.said();
    assert.deepEqual(said[said.length - 2], { r: "u", t: "Cancel this request" }, how);
    assert.match(said[said.length - 1].t, /^Cancelled — nothing more will be done for that request\./, how);
    assert.match(said[said.length - 1].t, /add a gallery page/, how + ": what the request had put off was not named");
  }
  const p = page({ site: asking(), answer: (url) => (url === QUESTION ? { body: { ok: true, cancelled: false, why: "closed" } } : null) });
  p.ctx.siteAskCancel();
  await settle();
  assert.equal(p.ask(), null, "a question closed elsewhere kept its card");
  assert.deepEqual(p.last(), { r: "a", t: "Cancelled — nothing more will be done for that request." });
});

test("A CANCEL THAT DOES NOT GO THROUGH SAYS SO, and the question stays open", async () => {
  for (const a of [{ status: 503, body: { ok: false } }, { reject: new TypeError("Failed to fetch") }, { status: 200, body: "<html>" }]) {
    const p = page({ site: asking(), answer: (url) => (url === QUESTION ? a : null) });
    p.ctx.siteAskCancel();
    await settle();
    assert.equal(p.ask().id, QID);
    assert.equal(p.last().t, "⚠️ I couldn’t cancel that just now, so the question is still open. Try again in a moment.");
    assert.equal(p.busy(), false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. THE RELOAD CHECK
// ─────────────────────────────────────────────────────────────────────────────

test("A RELOAD ASKS THE SERVER WHICH QUESTION IS LIVE: a card answered elsewhere comes off, a missing one comes back once, a replaced one is replaced", async () => {
  // (a) Answered or cancelled elsewhere.
  {
    const p = page({ site: asking(), answer: (url, method) => (url === QUESTION && method === "GET" ? { body: { ok: true, question: null } } : null) });
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.equal(p.ask(), null, "a question the server no longer holds kept its card");
    assert.equal(p.s.msgs.length, 2, "taking the card off said something");
  }
  // (b) Asked in another tab, or this browser lost its record.
  {
    const live = { id: QID, text: Q.text, options: Q.options, attached: true };
    const p = page({ site: { ...LIVE, msgs: [{ r: "u", t: REQ }] }, answer: (url, method) => (url === QUESTION && method === "GET" ? { body: { ok: true, question: live } } : null) });
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.deepEqual(p.ask(), { id: QID, text: Q.text, options: Q.options, attached: true });
    assert.deepEqual(p.last(), qMsg(Q));
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.equal(p.calls.length, 1, "the check ran twice in one page load");
    assert.equal(p.s.msgs.filter((m) => m.ask === QID).length, 1, "the question was put on the thread twice");
  }
  // (b2) The question's words are on the thread already and only the card was lost.
  {
    const live = { id: QID, text: Q.text, options: Q.options, attached: false };
    const p = page({ site: { ...LIVE, msgs: [{ r: "u", t: REQ }, qMsg(Q)] }, answer: (url, method) => (url === QUESTION && method === "GET" ? { body: { ok: true, question: live } } : null) });
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.equal(p.ask().id, QID);
    assert.equal(p.s.msgs.length, 2, "the question was put on the thread a second time");
  }
  // (c) Replaced by a newer question.
  {
    const Q2 = { id: QID2, text: "Above which heading exactly?", options: [] };
    const p = page({ site: asking(), answer: (url, method) => (url === QUESTION && method === "GET" ? { body: { ok: true, question: Q2 } } : null) });
    p.ctx.askFilesStore(QID, [IMG]);
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.equal(p.ask().id, QID2);
    assert.deepEqual(p.last(), qMsg(Q2));
    assert.deepEqual(await p.files(QID), [], "the replaced question's files were kept");
  }
});

test("A RELOAD CHECK THAT CANNOT BE READ, OR LANDS WHILE THE PAGE IS BUSY, CHANGES NOTHING", async () => {
  for (const a of [{ status: 500, body: { ok: false } }, { body: { ok: true, question: { id: "nope", text: "x" } } }, { body: { ok: true } }, { reject: new TypeError("Failed to fetch") }]) {
    const p = page({ site: asking(), answer: (url) => (url === QUESTION ? a : null) });
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.equal(p.ask().id, QID, JSON.stringify(a));
    assert.equal(p.s.msgs.length, 2);
  }
  {
    const p = page({ site: asking() });
    p.ctx.siteBusy = true;
    p.ctx.siteAskCheck(p.s);
    await settle();
    assert.deepEqual(p.calls, [], "a busy page asked the server about its question");
  }
  // THE ANSWER LANDS AFTER THE PAGE STARTED SOMETHING, or after its card
  // changed: the card is then the route's to settle, not the check's.
  for (const meanwhile of ["busy", "card"]) {
    let release;
    const late = new Promise((r) => { release = r; });
    const p = page({ site: asking(), answer: (url) => (url === QUESTION ? late : null) });
    p.ctx.siteAskCheck(p.s);
    await settle(5);
    if (meanwhile === "busy") p.ctx.siteBusy = true;
    else p.s.ask = { id: QID2, text: "Above which heading exactly?", options: [], attached: false };
    release({ body: { ok: true, question: null } });
    await settle();
    assert.ok(p.ask(), meanwhile + ": a late check took the card off");
    assert.equal(p.ask().id, meanwhile === "busy" ? QID : QID2, meanwhile);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. A STEP'S QUESTION IN ITS REPLY
// ─────────────────────────────────────────────────────────────────────────────

const STEP_Q = { id: QID2, text: "Which band is the order band — the one on Visit?", options: ["Yes", "No"] };

test("A STEP THAT ASKS: its question becomes the live card, kept with the message's files, and nothing reads as a failure", async () => {
  const p = page({
    site: { ...LIVE, draft: { t: "", imgs: [IMG] } },
    answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } }
      : url === EDIT ? { body: { ok: false, error: "clarify", layer: "look", cost: 0, unchanged: true, msg: STEP_Q.text, clarify: STEP_Q } } : null),
  });
  p.ctx.siteSend("Move the order band up");
  await settle();
  assert.deepEqual(p.last(), qMsg(STEP_Q), "the step's question is not the card: " + JSON.stringify(p.last()));
  assert.deepEqual(p.ask(), { id: QID2, text: STEP_Q.text, options: STEP_Q.options, attached: true });
  assert.deepEqual(await p.files(QID2), [IMG]);
  assert.equal(p.busy(), false);
});

test("A MIXED REPLY: what ran is said first, the question last with its card; a question with no id is never drawn as one, nor as words to answer", async () => {
  {
    const reply = { ok: true, cost: 1, lanes: ["description"], changed: ["description"], msg: "Updated the site's description.",
      partial: [{ layer: "page", ok: false, error: "clarify", msg: STEP_Q.text }], clarify: STEP_Q };
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } } : url === EDIT ? { body: reply } : null) });
    p.ctx.siteSend("Change the description, then move the band");
    await settle();
    const m = p.last();
    assert.match(m.t, /^✅/, "what ran is not said first: " + m.t);
    assert.ok(m.t.endsWith(STEP_Q.text), "the question is not last: " + m.t);
    assert.doesNotMatch(m.t, /didn’t go through/, "the step that asked was reported as a failure");
    assert.equal(m.ask, QID2);
    assert.equal(p.ask().id, QID2);
  }
  {
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } }
      : url === EDIT ? { body: { ok: false, error: "clarify", layer: "look", cost: 0, unchanged: true, msg: STEP_Q.text, clarify: { text: STEP_Q.text, options: [] } } } : null) });
    p.ctx.siteSend("Move the order band up");
    await settle();
    // THERE IS NO BUDGET, AND NO QUESTION WITHOUT AN ID (2026-10-02): a reply
    // carrying one is a reply this page cannot read, said as such — the
    // question nobody's answer could resume is never on the thread.
    assert.equal(p.ask(), null, "an id-less question became the live card");
    assert.ok(!p.said().some((m) => m.t === STEP_Q.text), "a question nobody can answer was drawn as words");
    assert.match(p.last().t, /^⚠️ /, "an unreadable reply was not said as one: " + p.last().t);
  }
});

test("A STEP'S QUESTION THAT COULD NOT BE KEPT PUTS WHAT IT LEFT TO DO BACK IN THE MESSAGE BOX, with the message's files — beside what ran, or alone", async () => {
  const REST = "put the order band above the other one";
  const unkept = "I needed to ask you something about that part — " + STEP_Q.text + " — but couldn't keep track of the question just now, so I left it alone. What was left of your request is back in your message box: add the detail and send it, and I'll make it.";
  {
    const reply = { ok: true, cost: 1, lanes: ["description"], changed: ["description"], msg: "Updated the site's description.",
      partial: [{ layer: "page", ok: false, error: "clarify-unkept", msg: unkept }], resume: REST };
    const p = page({ site: { ...LIVE, draft: { t: "", imgs: [IMG] } }, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } } : url === EDIT ? { body: reply } : null) });
    p.ctx.siteSend("Change the description, then " + REST);
    await settle();
    assert.match(p.last().t, /^✅/, "what ran was not said: " + p.last().t);
    assert.deepEqual(copy(p.s.unsent), [{ t: REST, imgs: [IMG] }], "what the question left to do was not put back with its files");
    assert.equal(p.ask(), null, "a question that was not kept became a card");
  }
  {
    const reply = { ok: false, error: "clarify-unkept", ours: true, cost: 0, unchanged: true, msg: unkept, resume: "Move the order band up" };
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } } : url === EDIT ? { status: 503, body: reply } : null) });
    p.ctx.siteSend("Move the order band up");
    await settle();
    assert.ok(p.last().t.startsWith("⚠️ " + unkept), "the route's sentence was not said: " + p.last().t);
    assert.deepEqual(copy(p.s.unsent), [{ t: "Move the order band up", imgs: [] }]);
  }
  {
    // A `resume` THAT IS NOT A MESSAGE'S WORDS makes the reply unreadable, never a composer full of junk —
    // and never a refusal read as if it were whole.
    for (const resume of [["Move the band"], "   ", "x".repeat(2001), 7]) {
      const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "edit", layer: "look", cost: 2 } }
        : url === EDIT ? { body: { ok: false, error: "clarify-unkept", msg: "THE ROUTE'S OWN SENTENCE", resume } } : null) });
      p.ctx.siteSend("Move the order band up");
      await settle();
      assert.equal(p.s.unsent, undefined, "a malformed resume reached the message box: " + JSON.stringify(resume).slice(0, 40));
      assert.ok(!p.said().some((m) => String(m.t).includes("THE ROUTE'S OWN SENTENCE")), "a reply with a malformed resume was read as a refusal: " + JSON.stringify(resume).slice(0, 40));
      assert.match(p.last().t, /^⚠️ /);
    }
  }
});

test("A REPLACEMENT THAT LOST A RACE STARTS NOTHING AND COMES BACK TO THE BOX; A QUESTION THE ROUTER WOULD HAVE ASKED AGAIN ENDS THE REQUEST, SAID, WITH ITS CARD OFF", async () => {
  {
    const msg = "Your last question was being answered somewhere else at the same moment, so I didn't act on this message. Send it again and I'll take it from there.";
    const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { status: 409, body: { ok: false, error: "question-busy", cost: 0, msg } } : null) });
    p.ctx.siteSend("Actually, make the footer blue");
    await settle();
    assert.equal(p.calls.length, 1, "work was sent after the replacement lost its race");
    assert.deepEqual(p.last(), { r: "a", t: "⚠️ " + msg });
    assert.deepEqual(copy(p.s.unsent), [{ t: "Actually, make the footer blue", imgs: [] }], "the message was not held to send again");
    assert.equal(p.ask(), null, "the card of a question closed elsewhere stayed up");
  }
  {
    const msg = "Your answer didn't settle what I asked, and I won't ask you the same thing twice — so I've stopped there and nothing more was changed. Send the change again with that detail spelled out, and I'll make it.";
    const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { status: 422, body: { ok: false, error: "question-ended", why: "repeat", cost: 0, msg } } : null) });
    p.ctx.siteSend("the big one");
    await settle();
    assert.equal(p.calls.length, 1);
    assert.deepEqual(p.last(), { r: "a", t: "⚠️ " + msg });
    assert.equal(p.ask(), null, "a request that ended kept its card");
    assert.equal(p.s.unsent, undefined, "an answer to a request that ended came back to the box as if to send again");
  }
  {
    const msg = "That request has grown too long for me to ask about it and still take your answer, so I've stopped there and nothing more was changed. Send it again a little shorter, with the details in it.";
    const long = "Move the band ".repeat(10).trim();
    const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { status: 422, body: { ok: false, error: "question-ended", why: "room", cost: 0, msg, resume: long } } : null) });
    p.ctx.siteSend(long);
    await settle();
    assert.deepEqual(copy(p.s.unsent), [{ t: long, imgs: [] }], "a request too long to ask about was not put back to shorten");
  }
});

test("AN ANSWERED QUESTION'S EARLIER QUESTIONS RIDE TO THE STEP, so it never asks one again", async () => {
  const asked = [Q.text];
  const p = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: { ...RESUME_ANSWER, ask: { ...RESUME_ANSWER.ask, asked } } } : null) });
  p.ctx.siteSend("Visit");
  await settle();
  const [e] = posted(p, EDIT);
  assert.deepEqual(e.body.asked, asked, "the step was not told what the request has asked");
  // A LIST THAT CANNOT BE READ IS NOT ACTED ON: held to send again, the question kept.
  const bad = page({ site: asking(), answer: (url) => (url === ROUTE ? { body: { ...RESUME_ANSWER, ask: { ...RESUME_ANSWER.ask, asked: [3] } } } : null) });
  bad.ctx.siteSend("Visit");
  await settle();
  assert.equal(posted(bad, EDIT).length, 0, "work was sent on an answer whose question list nobody can read");
  assert.equal(bad.ask().id, QID);
});

test("THE ADD-ON STEP'S QUESTION becomes the live card too", async () => {
  const AQ = { id: QID2, text: "Should the new page list every loaf, or only today's bake?", options: ["Every loaf", "Today's bake"] };
  const p = page({ site: LIVE, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "addon", cost: 2 } }
    : url === ADDON ? { body: { ok: false, error: "clarify", layer: "addon", cost: 0, unchanged: true, msg: AQ.text, clarify: AQ } } : null) });
  p.ctx.siteSend("Add a page for our breads");
  await settle();
  assert.deepEqual(p.last(), qMsg(AQ), JSON.stringify(p.last()));
  assert.equal(p.ask().id, QID2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. THE FIRST BUILD IS UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

test("A FIRST BUILD'S QUESTION IS STILL THE INTERVIEW: no live card, no claim, its own buttons and Skip", async () => {
  const EMPTY = { id: "origin-1", react: false, name: "", pages: [], msgs: [] };
  const first = { text: "What kind of business is it?", options: ["Bakery", "Café"] };
  const p = page({ site: EMPTY, answer: (url) => (url === ROUTE ? { body: { ok: true, intent: "clarify", question: first, cost: 1 } } : null) });
  p.ctx.siteSend("A website for my shop");
  await settle();
  assert.equal(p.calls[0].body.firstBuild, true);
  assert.equal(p.calls[0].body.ask, undefined);
  assert.equal(p.ask(), null, "a first build's question became a live site's card");
  assert.ok(p.s.clarify, "the first build's round was not kept");
  assert.deepEqual(p.last(), { r: "a", t: first.text, q: first.text, opts: first.options });
  const html = p.ctx.siteAskHTML(p.s.msgs[1], p.s);
  assert.match(html, /data-ans="Bakery"[^]*data-skip="1"/);
  assert.doesNotMatch(html, /data-ask-/);
});
