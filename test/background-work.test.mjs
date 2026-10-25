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
import * as RQ from "../builder/request.mjs";
import { platform, sendMessage, settle, call, T, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
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
const FNS = ["esc", "progressListHTML", "siteSaidFor", "siteMsgText", "siteParState", "siteParTitle", "siteParTag", "siteParSnap",
  "siteRequestWorking", "siteRunningWork", "siteBusyHere", "siteComposerStops",
  "siteBgState", "siteBgKeep", "siteBgHolds", "siteReqCardHTML", "siteReqCardShows", "siteParView", "siteBgItems", "siteBgWhen", "siteBgLine", "siteBgHTML", "siteBgJobHTML", "siteBgPaint", "siteBgScrolled", "siteBgClick", "siteBgStopAll", "siteBgStopPart", "siteBgRetry", "siteBgShowMe"];
const CONSTS = ["const SITE_PAR_STATE =", "const SITE_PAR_LABEL =", "const SITE_REQ_PREP =", "const SITE_SAID_FOR =", "const SITE_BG_KEEP_MS =", "const siteBgUi =", "const SITE_BG_KEEP_KEY =", "const siteParOpen ="];
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
        { n: 0, words: "Add a Bookshop page", status: "started", jobs: [], said: said("Bookshop page"), progress: LINES(3) },
        { n: 1, words: "Saturday hours to 8–7", status: "blocked", needs: [0], jobs: [], said: said("Saturday hours") },
        { n: 2, words: "fill in a search description", status: "done", jobs: ["jc"], draft: { revision: 3 }, page: "/bookshop", said: said("Search description") },
      ] } },
      [KB]: { view: { key: KB, ended: endedB, stop: false, parts: [{ n: 0, words: "make the buttons rounder", status: endedB ? "failed" : "started", jobs: [], said: said("Rounder buttons") }] } },
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

// ── C ───────────────────────────────────────────────────────────────────────
test("C — the box keeps Send while a request's parts run; Stop only for this project's own send with nothing in the panel, or a standalone job", () => {
  const site = siteOf();
  assert.equal(load(site).ctx.siteComposerStops(site), false, "a running request drew Stop in the box");
  assert.equal(load(site, { busy: true }).ctx.siteComposerStops(site), false, "a second message's routing call drew Stop over the running parts");
  const idle = { id: "s1", msgs: [], requests: {}, jobCards: {} };
  assert.equal(load(idle, { busy: true }).ctx.siteComposerStops(idle), true, "a build in flight lost its Stop");
  assert.equal(load(idle).ctx.siteComposerStops(idle), false);
  const job = { id: "s1", msgs: [], requests: {}, jobCards: { x: { view: { job: "j1" } } } };
  const pj = load(job); pj.ctx.siteJobOutcome = () => "running";
  assert.equal(vm.runInContext("siteComposerStops", pj.ctx)(job), true, "a standalone job lost its Stop");
  // THE RAIL ASKS THE PREDICATE, and the Enter key sends through Send.
  const row = CHAT.slice(CHAT.indexOf("buildPickerHTML() + buildEffortHTML() +"), CHAT.indexOf("'<div class=\"st-stage\" id=\"stStage\""));
  assert.match(row, /\(siteComposerStops\(site\)\n/);
  assert.doesNotMatch(row.replace(/\/\/.*$/gm, ""), /siteRunningWork\(site\)/, "the rail still swaps Send for Stop on running work");
  assert.match(cut("function wireSiteComposer("), /e\.key === 'Enter' && !e\.shiftKey\) \{ e\.preventDefault\(\); sendBtn\.onclick\(\); \}/);
});

// ── P ───────────────────────────────────────────────────────────────────────
test("P — the pill counts the unfinished parts; open, the panel's header counts and each row has its state, name and one line", () => {
  const site = siteOf();
  const p = load(site);
  const pill = p.html(1000);
  assert.match(pill, /class="st-bg-pill" data-bg="open"/);
  assert.equal(text(pill), "3 tasks in progress ▾");
  p.press({ "data-bg": "open" });
  const panel = p.html(1000);
  assert.match(text(panel), /^4 tasks · 2 in progress Stop all ▴/);
  const rows = [...panel.matchAll(/class="st-bg-row st-par-(\w+)" data-bg-row="([^"]+)"[^]*?st-bg-name">([^<]*)<\/span><span class="st-bg-sub">([^<]*)</g)].map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(rows, [
    ["run", KA + "|0", "Bookshop page", "line 3"],
    ["wait", KA + "|1", "Saturday hours", "Next — after Bookshop page"],
    ["done", KA + "|2", "Search description", "Saved as draft · just now"],
    ["run", KB + "|0", "Rounder buttons", "d"],
  ]);
  // ▴ CLOSES IT.
  p.press({ "data-bg": "close" });
  assert.match(p.html(1000), /st-bg-pill/);
  // NOTHING RUNNING OR JUST FINISHED: nothing drawn.
  assert.equal(load({ id: "s1", msgs: [] }).html(), "");
});

test("P — a finished row stays a while, then drops off; a request first read already ended from its snapshot is not shown", () => {
  const site = siteOf({ endedB: true });
  const p = load(site);
  p.press({ "data-bg": "open" });
  const t0 = Date.now() + 10;
  assert.match(text(p.html(t0)), /Rounder buttons I couldn't do Rounder buttons\./, "a part that did not work is not listed with its line");
  assert.match(text(p.html(t0 + 120_000)), /Saved as draft · 2 min ago/);
  const later = p.html(t0 + 5 * 60_000 + 1);
  assert.doesNotMatch(later, /Search description|Rounder buttons/, "a finished row never dropped off");
  assert.match(later, /Bookshop page/);
  const snapOnly = { id: "s2", msgs: [{ r: "a", t: "", request: KA, rq: { ended: true, parts: [{ n: 0, words: "x", status: "done", jobs: [] }] } }] };
  assert.equal(load(snapOnly).html(), "");
});

// ── J ───────────────────────────────────────────────────────────────────────
test("J — a row opens its own view: the bar with Back, its name and Stop, what was asked, every line; Back returns to the list", () => {
  const site = siteOf();
  site.requests[KA].view.parts[0].progress = LINES(20);
  const p = load(site);
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": KA + "|0" });
  const v = p.html();
  assert.match(v, /st-bg-jobview/);
  assert.match(text(v), /^‹ Back · Bookshop page Stop You asked: “Add a Bookshop page”/);
  assert.equal((v.match(/<li/g) || []).length, 20, "not every line is in the part's view");
  assert.match(v, /class="st-bg-new" data-bg="new" hidden/);
  p.press({ "data-bg": "back" });
  assert.match(p.html(), /st-bg-row/);
  assert.doesNotMatch(p.html(), /st-bg-jobview/);
});

test("J — a waiting part offers Remove and names what it starts after; a done part its reply and Show me; one that did not work its line and Try again", () => {
  const site = siteOf({ endedB: true });
  const p = load(site);
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": KA + "|1" });
  assert.match(text(p.html()), /Saturday hours Remove You asked: “Saturday hours to 8–7” Starts when Bookshop page is done/);
  p.press({ "data-bg": "back" });
  p.press({ "data-bg-row": KA + "|2" });
  const done = p.html();
  assert.match(done, /I wrote your search description\./, "the part's own reply is not in its view");
  assert.match(done, /data-bg="show" data-bg-page="\/bookshop">Show me</);
  assert.doesNotMatch(done, /data-bg="stop"/);
  // SHOW ME: the preview, on that page.
  p.press({ "data-bg": "show", "data-bg-page": "/bookshop" });
  assert.equal(site.active, "/bookshop");
  p.press({ "data-bg": "back" });
  p.press({ "data-bg-row": KB + "|0" });
  const bad = p.html();
  assert.match(text(bad), /I couldn't do Rounder buttons\./);
  assert.match(bad, /data-bg="retry"/);
  p.press({ "data-bg": "retry", "data-bg-id": KB + "|0" });
  assert.deepEqual(p.sent, [["make the buttons rounder", true]], "Try again did not send the part's own words again");
});

test("J — Stop and Remove post the per-part stop with that part; Stop all stops each request with work left, through its own stop", async () => {
  const site = siteOf();
  const p = load(site);
  p.press({ "data-bg": "open" });
  p.press({ "data-bg": "stop", "data-bg-id": KA + "|0" });
  p.press({ "data-bg": "stop", "data-bg-id": KA + "|1" });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(p.posts, [
    ["/api/site/request/shop/" + KA + "/stop", "POST", { part: 0 }],
    ["/api/site/request/shop/" + KA + "/stop", "POST", { part: 1 }],
  ]);
  assert.deepEqual(p.stops, [], "a part's Stop stopped its whole request");
  p.press({ "data-bg": "stopall" });
  assert.deepEqual(p.stops, [KA, KB]);
});

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
test("S — a working part's box follows its newest line until scrolled up; then a new line shows ↓ new, and ↓ new follows again", () => {
  const site = siteOf();
  const p = load(site);
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": KA + "|0" });
  const { box, nb } = fakeBox(KA + "|0", 12);
  p.host.querySelector = (sel) => (sel === ".st-bg-scroll" ? box : sel === ".st-bg-new" ? nb : null);
  p.ctx.siteBgPaint(site);
  assert.equal(box.scrollTop, box.scrollHeight, "a working part did not follow its newest line");
  assert.equal(nb.hidden, true);
  // SCROLLED UP.
  box.scrollTop = 0;
  p.ctx.siteBgScrolled(site.id, box);
  box.lines = 13;
  p.ctx.siteBgPaint(site);
  assert.equal(box.scrollTop, 0, "the box jumped down although the customer scrolled up");
  assert.equal(nb.hidden, false, "no ↓ new for a line that arrived below");
  // ↓ NEW.
  p.press({ "data-bg": "new" });
  assert.equal(box.scrollTop, box.scrollHeight);
  assert.equal(nb.hidden, true);
  // BACK AT THE BOTTOM BY SCROLLING: following again.
  box.scrollTop = 0; p.ctx.siteBgScrolled(site.id, box);
  box.scrollTop = box.scrollHeight - box.clientHeight; p.ctx.siteBgScrolled(site.id, box);
  box.lines = 14; p.ctx.siteBgPaint(site);
  assert.equal(box.scrollTop, box.scrollHeight);
  // THE LIST KEEPS ITS PLACE AND NEVER SHOWS ↓ new.
  p.press({ "data-bg": "back" });
  const l = fakeBox("list", 4);
  p.host.querySelector = (sel) => (sel === ".st-bg-scroll" ? l.box : sel === ".st-bg-new" ? l.nb : null);
  l.box.scrollTop = 30; p.ctx.siteBgScrolled(site.id, l.box);
  l.box.scrollTop = 0; p.ctx.siteBgPaint(site);
  assert.equal(l.box.scrollTop, 30);
});

test("S — the panel's box scrolls inside a bounded panel, its bar outside the box (styles.css)", () => {
  const CSS = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const rule = (sel) => { const m = CSS.match(new RegExp("\\n" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); assert.ok(m, sel + " has no rule"); return m[1]; };
  assert.match(rule(".st-bg-pane"), /max-height: 45vh/);
  assert.match(rule(".st-bg-pane"), /flex-direction: column/);
  assert.match(rule(".st-bg-scroll"), /overflow-y: auto/);
  assert.match(rule(".st-bg-top"), /flex: none/);
  assert.match(rule(".st-bg-new"), /position: absolute/);
});

// ── R ───────────────────────────────────────────────────────────────────────
test("R — a reload keeps a single-part request's snapshot on its message, and the panel reads it", () => {
  const site = { id: "s1", msgs: [{ r: "u", t: "x" }, { r: "a", t: "", request: KA }], requests: { [KA]: { view: { key: KA, ended: false, parts: [{ n: 0, words: "make it blue", status: "started", jobs: [], progress: [{ text: "Picking the blue" }], said: said("Blue") }] } } } };
  const p = load(site);
  p.ctx.siteParSnap(site, KA);
  assert.ok(site.msgs[1].rq, "a single-part request kept no snapshot for a reload");
  const reloaded = { id: "s1", msgs: JSON.parse(JSON.stringify(site.msgs)) };
  const q = load(reloaded);
  q.press({ "data-bg": "open" });
  assert.match(text(q.html()), /1 task · 1 in progress .* Blue Picking the blue/);
});

// ── D: no duplicate display ─────────────────────────────────────────────────
test("D — while the panel lists a request's parts its card is not drawn on the thread: only the model's opening line and the soft box; once it ends, only its summary", () => {
  const site = siteOf();
  site.requests[KA].view.opening = "I'll work on these three side by side.";
  site.msgs.push({ r: "a", t: "All three are saved as a draft.", req: KA, for: "end" });
  const p = load(site);
  const card = (k) => p.ctx.siteReqCardHTML(site.msgs.find((m) => m.request === k), site);
  // WHAT IS SHOWN: the card's part list sits inside a hidden holder (kept for
  // the UI canary's reader), never drawn.
  const shown = (h) => h.replace(/<div class="st-bg-held" hidden>[\s\S]*$/, "") + (h.match(/<div class="st-par-box">[\s\S]*$/) || [""])[0];
  let a = card(KA);
  assert.match(a, /<div class="st-bg-held" hidden><div class="st-par" data-par=/, "the parallel card is drawn beside the panel");
  assert.doesNotMatch(shown(a), /st-par-row|st-par-head|class="st-par"/, "the parallel card is drawn beside the panel");
  assert.match(a, /st-par-opening">I&#39;ll work on these three side by side\.</);
  assert.equal(card(KB), '<div class="st-bg-held" hidden><div class="st-req">CARD</div></div>', "a single-part request's card is drawn beside the panel");
  assert.equal(p.ctx.siteReqCardShows(site.msgs.find((m) => m.request === KB), site), false, "an empty card message is drawn");
  assert.equal(p.ctx.siteReqCardShows(site.msgs.find((m) => m.request === KA), site), true);
  // ENDED AND OFF THE PANEL (a reload long after): the summary stays, no card.
  site.requests[KA].view.ended = true;
  for (const q of site.requests[KA].view.parts) q.status = "done";
  site.requests[KA].doneAt = { 0: 0, 1: 0, 2: 0 };
  assert.equal(p.ctx.siteBgItems(site, 10 * 60 * 1000).filter((x) => x.key === KA).length, 0);
  a = card(KA);
  assert.doesNotMatch(shown(a), /st-par-row|class="st-par"/, "the card came back once the request left the panel");
  assert.match(a, /st-par-box">.*All three are saved as a draft\./s, "the summary is gone from the thread");
  const reloaded = { id: "s1", msgs: JSON.parse(JSON.stringify(site.msgs)) };
  reloaded.msgs.find((m) => m.request === KA).rq = { ended: true, opening: "I'll work on these three side by side.", parts: site.requests[KA].view.parts };
  const r = load(reloaded);
  const ra = r.ctx.siteReqCardHTML(reloaded.msgs.find((m) => m.request === KA), reloaded);
  assert.doesNotMatch(shown(ra), /class="st-par"/, "a reload drew the card");
  assert.match(ra, /All three are saved as a draft\./, "a reload lost the summary");
  // THE THREAD DRAWS A CARD MESSAGE THAT SHOWS NOTHING HIDDEN, and the holder is never displayed.
  assert.match(CHAT, /'<div class="st-msg a"' \+ \(m\.request && !m\.t && !m\.jobCard && !siteReqCardShows\(m, site\) \? ' hidden' : ''\)/);
  assert.match(readFileSync(new URL("../public/styles.css", import.meta.url), "utf8"), /\.st-msg\[hidden\], \.st-bg-held\[hidden\] \{ display: none !important; \}/);
});

// ── K: the panel kept across a reload ───────────────────────────────────────
test("K — the panel's open state and the job shown are kept for a reload, per project, in session storage; storage that throws keeps the old behaviour", () => {
  const mem = new Map();
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const site = siteOf();
  const p = load(site, { store });
  p.press({ "data-bg": "open" });
  p.press({ "data-bg-row": KA + "|0" });
  assert.deepEqual(JSON.parse(mem.get("gf.bgPanel.s1")), { open: true, job: KA + "|0" });
  const q = load(site, { store });
  assert.match(text(q.html()), /‹ Back · Bookshop page/, "a reload lost the job view");
  q.press({ "data-bg": "close" });
  assert.deepEqual(JSON.parse(mem.get("gf.bgPanel.s1")), { open: false, job: "" });
  assert.match(load(site, { store }).html(), /st-bg-pill/, "a reload reopened a closed panel");
  const other = { ...siteOf(), id: "s2" };
  assert.match(load(other, { store }).html(), /st-bg-pill/, "another project took this one's panel");
  const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const b = load(site, { store: bad });
  assert.match(b.html(), /st-bg-pill/);
  b.press({ "data-bg": "open" });
  assert.match(b.html(), /st-bg-pane/, "storage that throws broke the panel");
});

// ── SV: the server ──────────────────────────────────────────────────────────
test("SV — stopPart names one part; nextStep cancels it when it has no live job, and leaves the others", () => {
  const rec = { key: KA, ended: false, stop: false, parts: [{ n: 0, status: "started", jobs: [{ id: "j0", kind: "run" }] }, { n: 1, status: "ready", jobs: [] }, { n: 2, status: "done", jobs: [] }] };
  assert.equal(RQ.stopPart(rec, 2), null, "a finished part was stopped");
  assert.equal(RQ.stopPart(rec, 9), null);
  assert.equal(RQ.stopPart({ ...rec, stop: true }, 1), null);
  const s1 = RQ.stopPart(rec, 1);
  assert.deepEqual(s1.stopParts, [1]);
  assert.equal(RQ.stopPart(s1, 1), s1, "stopping twice added it twice");
  assert.equal(RQ.partJobId(rec, 0), "j0");
  assert.equal(RQ.partJobId(rec, 1), "");
});

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

test("SV — appendParts: numbers after the parts there, keeps their needs and carving, idempotent, refuses an ended or stopped request", () => {
  const rec = { key: KA, message: "one", ended: false, stop: false, joined: [], parts: [
    { n: 0, words: "one", at: -1, needs: [], held: ["x"], putOff: [], status: "started", jobs: [], targets: { writes: [], reads: ["page:/menu-page"] } },
    { n: 1, words: "x", at: 0, parent: 0, needs: [], held: [], putOff: [], status: "blocked", jobs: [], targets: null },
  ] };
  const r = RQ.appendParts(rec, { key: KB, message: "make /menu-page", routed: { intent: "edit", layer: "look", targets: [{ change: 0, writes: ["new-page:/menu-page"] }] } });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.parts, [2]);
  assert.deepEqual(r.rec.parts[0].needs, [], "an old part was made to wait on a joined one");
  assert.deepEqual(r.rec.parts[0].held, ["x"]);
  assert.equal(r.rec.parts[1].parent, 0);
  assert.equal(r.rec.parts[2].n, 2);
  assert.equal(r.rec.message, "one\n\nmake /menu-page");
  assert.equal(rec.parts.length, 2, "the record read was changed in place");
  assert.ok(RQ.appendParts(r.rec, { key: KB, message: "make /menu-page", routed: { intent: "edit", layer: "look" } }).duplicate);
  assert.equal(RQ.appendParts({ ...rec, ended: true }, { key: KB, message: "y", routed: { intent: "edit" } }).why, "ended");
  assert.equal(RQ.appendParts({ ...rec, stop: true }, { key: KB, message: "y", routed: { intent: "edit" } }).why, "ended");
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
    // A part's routing never asks after the charge (owner, 2026-10-25): part 1 goes on to its step.
    assert.notEqual(done.rec.parts[1].status, "cancelled", "the rest of the request did not go on after one part stopped");
    assert.ok(P2.jobsOf(r.key).some((j) => j.op === "addon"), "part 1 never reached its step");
    assert.equal(P2.question(), null);
  } finally { P2.close(); compiler2.uninstall(); }
});
