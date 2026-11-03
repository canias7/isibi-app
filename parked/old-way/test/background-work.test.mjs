// PARKED (2026-11-03, park-old-way): the old-way half of test/background-work.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// WORK IN THE BACKGROUND (2026-10-23, the owner's approved mock, option A).
//
// The customer keeps talking while the builder works. Each guard was red on
// the code before this branch:
//   C   the box keeps Send while a request's parts run (Stop only for this
//       project's own send in flight with nothing in the panel, or a
//       standalone job);
//   P   the pill counts the unfinished parts; the panel opens and closes; its
//       header counts; each row has its state, name and one line ("Next —
//       after <title>", "Saved as draft · <time>"); finished rows drop off;
//   J   a row opens its own view (bar, asked words, every line, reply with
//       Show me, or Try again), Back returns; Stop / Remove post the per-part
//       stop with that part; Stop all stops each request with work left;
//   S   the box follows the newest line until scrolled up, then "↓ new";
//   R   a reload keeps a single-part request's snapshot, which the panel reads;
//   SV  the server: a question sent while a request's job runs is answered by
//       the route and touches nothing; a change sent then runs as a new
//       request beside it; one part stopped is cancelled (its job through
//       `edit_cancel`) while the rest goes on.
// The page functions are cut out of public/chat.js and run in a VM; the
// server cases drive the real routes (`test/fixtures/request-flow.mjs`) with
// supplied model answers in the shape each tool tells the model to give.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import * as RQ from "../../../builder/request.mjs";
import { platform, sendMessage, settle, call, T, USER } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";

const EditPoll = createRequire(import.meta.url)("../../../public/edit-poll.js");
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  return CHAT.slice(open, shut + 3);
}
function cutConst(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const line = CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
  if (!/\{\s*$/.test(line)) return line;
  return CHAT.slice(open, CHAT.indexOf("\n};\n", open) + 4);
}
const FNS = ["esc", "progressListHTML", "siteSaidFor", "siteMsgText", "siteParState", "siteParTitle", "siteRowTitle", "siteBoxItems", "siteParTag", "siteParSnap",
  "siteRequestWorking", "siteRunningWork", "siteBusyHere", "siteComposerStops",
  "siteBgState", "siteBgKeep", "siteBgHolds", "siteReqCardHTML", "siteReqCardShows", "siteReqQueued", "siteReqWorkingLine", "siteParView", "siteReqKeys", "siteBgItems", "siteBgWhen", "siteBgLine", "siteBgEnding", "siteBgEndings", "siteBgHTML", "siteBgJobHTML", "siteBgPaint", "siteBgScrolled", "siteBgClick", "siteBgStopAll", "siteBgStopPart", "siteBgRetry", "siteBgShowMe"];
const CONSTS = ["const SITE_BG_ENDING =", "const SITE_PAR_STATE =", "const SITE_PAR_LABEL =", "const SITE_REQ_PREP =", "const SITE_SAID_FOR =", "const SITE_BG_KEEP_MS =", "const siteBgUi =", "const SITE_BG_KEEP_KEY =", "const siteParOpen ="];
const SRC = [...FNS.map((n) => cut("function " + n + "(")), ...CONSTS.map(cutConst)].join("\n");

const said = (title, doing) => ({ planned: "p", doing: doing || "d", waiting: "w", unconfirmed: "u", done: "I've done " + title + ".", partial: "pa", notdone: "I couldn't do " + title + ".", title });
const KA = "a".repeat(20), KB = "b".repeat(20);
const LINES = (n) => Array.from({ length: n }, (_, i) => ({ text: "line " + (i + 1) }));
function siteOf({ endedB = false } = {}) {
  return {
    id: "s1", slug: "shop",
    pages: [{ path: "/", name: "Home" }, { path: "/bookshop", name: "Bookshop" }],
    msgs: [
      { r: "u", t: "three things" }, { r: "a", t: "", request: KA },
      { r: "a", t: "I wrote your search description.", req: KA, job: "jc" },
      { r: "u", t: "rounder" }, { r: "a", t: "", request: KB },
    ],
    requests: {
      [KA]: { view: { key: KA, ended: false, stop: false, parts: [
        { n: 0, parent: 0, words: "Add a Bookshop page", status: "started", jobs: [], said: said("Bookshop page"), progress: LINES(3) },
        { n: 1, parent: 0, words: "Saturday hours to 8–7", status: "blocked", needs: [0], jobs: [], said: said("Saturday hours") },
        { n: 2, parent: 0, words: "fill in a search description", status: "done", jobs: ["jc"], draft: { revision: 3 }, page: "/bookshop", said: said("Search description") },
      ] } },
      [KB]: { view: { key: KB, ended: endedB, stop: false, parts: [{ n: 0, parent: 0, words: "make the buttons rounder", status: endedB ? "failed" : "started", jobs: [], said: said("Rounder buttons") }] } },
    },
    jobCards: {},
  };
}
function load(site, { busy = false, store = null } = {}) {
  const posts = [], stops = [], sent = [], toasts = [];
  let draws = 0;
  const host = { innerHTML: "", onclick: null, querySelector: () => null };
  const ctx = vm.createContext({
    EditPoll, posts, stops, sent, toasts, console, setTimeout: () => 0, clearTimeout: () => {},
    siteOpenId: site.id, siteBusy: busy, siteBusyFor: busy ? site.id : null, siteView: "preview",
    document: { getElementById: (id) => (id === "stBg" ? host : null) },
    siteById: (id) => (id === site.id ? site : null),
    siteJobOutcome: () => "done",
    sitePages: (s) => s.pages || [],
    switchSitePage: (p) => { site.active = p; },
    sitesSave: () => {}, renderSites: () => { draws++; },
    siteRequestStop: (id, key) => stops.push(key),
    siteRequestFollow: () => {},
    siteReqState: (o, k, v) => { site.requests[k].view = v; return site.requests[k]; },
    siteSend: (t, leave) => sent.push([t, leave]),
    sbToast: (t) => toasts.push(t),
    siteAskHTML: (m) => '<div class="ask-buttons" data-ask="' + m.ask + '"></div>',
    siteRequestHTML: () => '<div class="st-req">CARD</div>',
    ...(store ? { sessionStorage: store } : {}),
    apiFetch: async (url, init) => { posts.push([url, init.method, JSON.parse(init.body)]); return { ok: true, json: async () => ({ ok: true, request: site.requests[KA].view }) }; },
  });
  vm.runInContext(SRC, ctx);
  const el = (attrs) => ({ getAttribute: (k) => (Object.hasOwn(attrs, k) ? attrs[k] : null) });
  const press = (attrs) => ctx.siteBgClick({ target: { closest: () => el(attrs) } }, site.id);
  return { ctx, posts, stops, sent, toasts, host, draws: () => draws, press, html: (now) => ctx.siteBgHTML(site, now) };
}
const text = (h) => h.replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ── S ───────────────────────────────────────────────────────────────────────
function fakeBox(key, lines) {
  const box = {
    attrs: { "data-bg-box": key }, scrollTop: 0, clientHeight: 200, lines,
    get scrollHeight() { return this.lines * 40; },
    getAttribute(k) { return this.attrs[k]; },
    querySelectorAll() { return { length: this.lines }; },
    parentNode: null,
  };
  const nb = { hidden: true };
  box.parentNode = { querySelector: () => nb };
  return { box, nb };
}

const DESC = "Change the site description to say we bake overnight sourdough";
const LOOK = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": "Overnight sourdough." };
test("SV — a question sent while a request's job runs is answered at once and touches nothing; a change sent then JOINS that request as a new part", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "bg-sv1-" + Math.random().toString(16).slice(2, 8),
    answers: { route: [{ intent: "edit", layer: "look" }, { intent: "ask", answer: "Libre Baskerville for headings and Source Sans for body text." }, { intent: "edit", layer: "look" }, { intent: "edit", layer: "look" }], ...LOOK },
  });
  try {
    const a = await sendMessage(P, { message: DESC + "." });
    assert.equal(a.status, 200);
    const recA = JSON.stringify(P.record(a.key));
    assert.ok(P.record(a.key) && !P.record(a.key).ended, "the first request is not running");
    const rpcBefore = P.rpcLog.length;
    // THE QUESTION.
    const q = await sendMessage(P, { message: "What fonts is the site using?" });
    assert.equal(q.status, 200);
    assert.equal(q.body.intent, "ask");
    assert.match(q.body.answer, /Libre Baskerville/);
    assert.equal(P.record(q.key), null, "a question made a request");
    assert.equal(JSON.stringify(P.record(a.key)), recA, "the question changed the running request");
    assert.deepEqual(P.rpcLog.slice(rpcBefore).map((r) => r.fn).filter((f) => /^edit_(cancel|create|claim|reserve)/.test(f)), [], "the question touched a job");
    // A CHANGE, while the first still runs: a new part of that request.
    const B = DESC + " and that we open at 7.";
    const b = await sendMessage(P, { message: B });
    assert.equal(b.status, 200);
    assert.equal(P.record(b.key), null, "a change sent while a request ran started a separate request");
    assert.equal(b.body.request.key, a.key, "the reply does not name the live request");
    const joined = P.record(a.key);
    assert.equal(joined.parts.length, 2);
    assert.equal(joined.parts[1].words, B);
    assert.equal(joined.parts[1].joined, b.key);
    assert.deepEqual(joined.joined.map((j) => [j.key, j.parts]), [[b.key, [1]]]);
    assert.equal(JSON.stringify(joined.parts[0]), JSON.stringify(JSON.parse(recA).parts[0]), "joining changed the part already running");
    // THE SAME MESSAGE AGAIN (a retry under its key) adds nothing.
    const b2 = await sendMessage(P, { message: B, key: b.key });
    assert.equal(b2.status, 200);
    assert.equal(b2.body.request.key, a.key);
    assert.equal(P.record(a.key).parts.length, 2, "a retry of the joined message joined twice");
    const sa = await settle(P, a.key);
    assert.equal(sa.rec.parts[0].status, "done");
    assert.equal(sa.rec.parts[1].status, "done");
  } finally { P.close(); compiler.uninstall(); }
});

test("SV — a joined change that refers to what a running part creates waits for it (needs), and the view names it; a request that ended first leaves the change a request of its own", async () => {
  const MENU = "Put the gallery page in the menu";
  const compiler = installCompiler();
  const P = platform({
    slug: "bg-sv4-" + Math.random().toString(16).slice(2, 8),
    answers: { route: [
      { intent: "edit", layer: "look", targets: [{ change: 0, writes: ["new-page:/gallery"] }] },
      { intent: "edit", layer: "nav", targets: [{ change: 0, writes: ["menu"], reads: ["page:/gallery"] }] },
      { intent: "edit", layer: "look" },
      { intent: "edit", layer: "look" },
    ], ...LOOK },
  });
  try {
    const a = await sendMessage(P, { message: DESC + "." });
    const b = await sendMessage(P, { message: MENU + "." });
    assert.equal(b.body.request.key, a.key);
    const rec = P.record(a.key);
    assert.deepEqual(rec.parts[1].needs, [0], "the joined part does not wait for the part that creates its page");
    assert.equal(rec.parts[1].status, "blocked");
    assert.deepEqual(rec.parts[0].needs, [], "the running part started waiting on the new one");
    const view = b.body.request.parts[1];
    assert.equal(view.status, "blocked");
    assert.deepEqual(view.needs, [0], "the view does not say what the joined part waits for");
    // ENDED FIRST: the next change is its own request.
    const ended = await settle(P, a.key);
    assert.ok(ended.rec.ended, "the request did not end");
    const c = await sendMessage(P, { message: DESC + " and say we deliver." });
    assert.ok(P.record(c.key), "a change after the request ended joined an ended request");
    assert.equal(c.body.request.key, c.key);
  } finally { P.close(); compiler.uninstall(); }
});

test("SV — POST /stop with a part: a part not yet running is cancelled as stopped and the rest goes on; a running part's job is cancelled through its own door", async () => {
  const ADD = "add a gallery page";
  const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
  const compiler = installCompiler();
  const P = platform({ slug: "bg-sv2-" + Math.random().toString(16).slice(2, 8), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }], ...LOOK } });
  try {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const base = "/api/site/request/" + P.slug + "/" + r.key + "/stop";
    assert.equal((await call(P, "POST", base, {})).status, 400);
    assert.equal((await call(P, "POST", base, { part: 7 })).status, 404);
    const before = P.record(r.key);
    assert.ok(!["done", "cancelled"].includes(before.parts[1].status), "part 1 already ended: " + before.parts[1].status);
    const s1 = await call(P, "POST", base, { part: 1 });
    assert.equal(s1.status, 200, JSON.stringify(s1.body));
    assert.equal(s1.body.request.parts[1].status, "cancelled");
    assert.equal(s1.body.request.parts[1].why, "stopped");
    assert.equal(s1.body.request.stop, false, "one part's stop stopped the whole request");
    const done = await settle(P, r.key);
    assert.equal(done.rec.parts[0].status, "done", "the other part did not go on");
    assert.equal(done.rec.parts[1].status, "cancelled");
    assert.equal((await call(P, "POST", base, { part: 1 })).status, 409, "a part already ended was stopped again");
  } finally { P.close(); compiler.uninstall(); }
  const compiler2 = installCompiler();
  const P2 = platform({ slug: "bg-sv3-" + Math.random().toString(16).slice(2, 8), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }], ...LOOK } });
  try {
    const r = await sendMessage(P2, { message: DESC + ", and " + ADD + "." });
    const job = RQ.partJobId(P2.record(r.key), 0);
    assert.ok(job, "part 0 has no live job to stop");
    const s = await call(P2, "POST", "/api/site/request/" + P2.slug + "/" + r.key + "/stop", { part: 0 });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.deepEqual(P2.rpcLog.filter((x) => x.fn === "edit_cancel").map((x) => [x.args.p_id, x.args.p_uid]), [[job, USER.id]]);
    const done = await settle(P2, r.key);
    assert.equal(done.rec.parts[0].status, "cancelled");
    assert.equal(done.rec.parts[0].why, "stopped");
    assert.equal(done.rec.parts[1].status, "waiting", "the rest of the request did not go on after one part stopped");
  } finally { P2.close(); compiler2.uninstall(); }
});
