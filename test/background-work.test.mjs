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

// ── C ───────────────────────────────────────────────────────────────────────
test("C — the box always has Stop while work runs (owner, 2026-11-04): a running request, a standalone job, a send in flight", () => {
  const site = siteOf();
  assert.equal(load(site).ctx.siteComposerStops(site), true, "a running request had Send and no Stop (Market Lane)");
  assert.equal(load(site, { busy: true }).ctx.siteComposerStops(site), true);
  const idle = { id: "s1", msgs: [], requests: {}, jobCards: {} };
  assert.equal(load(idle, { busy: true }).ctx.siteComposerStops(idle), true, "a build in flight lost its Stop");
  assert.equal(load(idle).ctx.siteComposerStops(idle), false, "Stop with nothing running");
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
  // A SEPARATE MESSAGE (KB, one part) IS NEVER A ROW (owner, 2026-11-02, reply-fix).
  assert.equal(text(pill), "2 tasks in progress ▾");
  p.press({ "data-bg": "open" });
  const panel = p.html(1000);
  assert.match(text(panel), /^3 tasks · 1 in progress Stop all ▴/);
  const rows = [...panel.matchAll(/class="st-bg-row st-par-(\w+)" data-bg-row="([^"]+)"[^]*?st-bg-name">([^<]*)<\/span><span class="st-bg-sub">([^<]*)</g)].map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(rows, [
    ["run", KA + "|0", "Add a Bookshop page", "line 3"],
    ["wait", KA + "|1", "Saturday hours to 8–7", "Next — after Bookshop page"],
    ["done", KA + "|2", "fill in a search description", "Saved as draft · just now"],
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
  assert.doesNotMatch(text(p.html(t0)), /rounder/i, "a separate one-part message made a row");
  assert.match(text(p.html(t0 + 120_000)), /Saved as draft · 2 min ago/);
  const later = p.html(t0 + 5 * 60_000 + 1);
  assert.doesNotMatch(later, /search description/, "a finished row never dropped off");
  assert.match(later, /Bookshop page/);
  const snapOnly = { id: "s2", msgs: [{ r: "a", t: "", request: KA, rq: { ended: true, parts: [{ n: 0, parent: 0, words: "x", status: "done", jobs: [] }] } }] };
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
  // A PART THAT DID NOT WORK, in a split: its line and Try again.
  site.requests[KA].view.parts[1].status = "failed";
  p.press({ "data-bg": "back" });
  p.press({ "data-bg-row": KA + "|1" });
  const bad = p.html();
  assert.match(text(bad), /I couldn't do Saturday hours\./);
  assert.match(bad, /data-bg="retry"/);
  p.press({ "data-bg": "retry", "data-bg-id": KA + "|1" });
  assert.deepEqual(p.sent, [["Saturday hours to 8–7", true]], "Try again did not send the part's own words again");
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
  const site = { id: "s1", msgs: [{ r: "u", t: "x" }, { r: "a", t: "", request: KA }], requests: { [KA]: { view: { key: KA, ended: false, parts: [{ n: 0, parent: 0, words: "make it blue", status: "started", jobs: [], progress: [{ text: "Picking the blue" }], said: said("Blue") }] } } } };
  const p = load(site);
  p.ctx.siteParSnap(site, KA);
  assert.ok(site.msgs[1].rq, "a single-part request kept no snapshot for a reload");
  const reloaded = { id: "s1", msgs: JSON.parse(JSON.stringify(site.msgs)) };
  const q = load(reloaded);
  // ONE TASK IS JUST THE CHAT (owner, 2026-11-02): no task box for a single part.
  assert.equal(text(q.html()), "", "a single task is drawn as a task box");
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

test("SV — appendParts: numbers after the parts there, keeps their needs and carving, idempotent, refuses an ended or stopped request", () => {
  const rec = { key: KA, message: "one", ended: false, stop: false, joined: [], parts: [
    { n: 0, parent: 0, words: "one", at: -1, needs: [], held: ["x"], putOff: [], status: "started", jobs: [], targets: { writes: [], reads: ["page:/menu-page"] } },
    { n: 1, parent: 0, words: "x", at: 0, parent: 0, needs: [], held: [], putOff: [], status: "blocked", jobs: [], targets: null },
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

// A QUESTION IS NOT WORK IN PROGRESS (2026-10-26, live test 11): the pill read
// "3 tasks in progress" for twenty minutes while two of the three waited on the
// customer's answers. Questions are counted on their own.
test("P — parts waiting on the customer are counted as 'need you', apart from the work in progress", () => {
  const site = siteOf();
  const parts = site.requests[KA].view.parts;
  parts.push({ n: 3, parent: 0, words: "which beginner lesson", status: "waiting", jobs: [], question: { text: "Which one?" }, said: said("Lesson price") });
  parts.push({ n: 4, parent: 0, words: "which blocks", status: "waiting", jobs: [], question: { text: "Which blocks?" }, said: said("Reviews") });
  const p = load(site);
  assert.equal(text(p.html(1000)), "2 need you · 2 in progress ▾");
  p.press({ "data-bg": "open" });
  assert.match(text(p.html(1000)), /^5 tasks · 2 need you · 1 in progress Stop all ▴/);
  // ONLY QUESTIONS LEFT: the pill says so, never "in progress".
  const only = { id: "s1", slug: "shop", pages: [], msgs: [{ r: "u", t: "x" }, { r: "a", t: "", request: KA }], jobCards: {},
    requests: { [KA]: { view: { key: KA, ended: false, stop: false, parts: [{ n: 0, parent: 0, words: "w", status: "waiting", jobs: [], question: { text: "Q?" }, said: said("One") }] } } } };
  assert.equal(text(load(only).html(1000)), "", "one task, even waiting on you, is just the chat (owner, 2026-11-02)");
});

// THE PILL COUNTS EACH PART BY ITS REAL ENDING (2026-11-01, one reply): it
// read "3 tasks finished" over a part paused for credits.
test("Q — once nothing runs, the pill counts each part by its real ending", () => {
  const mk = (statuses) => ({ id: "s1", slug: "shop", pages: [], msgs: [{ r: "u", t: "x" }, { r: "a", t: "", request: KA }], jobCards: {},
    requests: { [KA]: { view: { key: KA, ended: false, stop: false, parts: statuses.map((s, n) => ({ n, parent: 0, words: "w" + n, status: s, jobs: [], said: said("T" + n) })) } } } });
  assert.equal(text(load(mk(["done", "done", "credits"])).html(1000)), "3 tasks · 2 finished, 1 paused for credits ▾");
  assert.equal(text(load(mk(["done", "cancelled", "failed"])).html(1000)), "3 tasks · 1 finished, 1 stopped, 1 failed ▾");
  assert.equal(text(load(mk(["done", "done"])).html(1000)), "2 tasks finished ▾");
});

test("ONE2 — plain chat never makes a box: two one-part messages (hey, hello) and a question show nothing; a 3-part split shows 3 rows (owner, 2026-11-02)", () => {
  const one = (k, w, st) => ({ view: { key: k, ended: false, stop: false, parts: [{ n: 0, words: w, status: st, jobs: [] }] } });
  const chat = { id: "s1", slug: "shop", pages: [], msgs: [{ r: "u", t: "hey" }, { r: "a", t: "", request: KA }, { r: "u", t: "hello" }, { r: "a", t: "", request: KB }], jobCards: {},
    requests: { [KA]: one(KA, "hey", "done"), [KB]: one(KB, "hello", "started") } };
  assert.equal(text(load(chat).html(1000)), "", "hey + hello drew a task box");
  chat.requests[KB] = one(KB, "what pages do I have?", "started");
  assert.equal(text(load(chat).html(1000)), "", "a question drew a task box");
  const split = { id: "s1", slug: "shop", pages: [], msgs: [{ r: "u", t: "three things" }, { r: "a", t: "", request: KA }], jobCards: {},
    requests: { [KA]: { view: { key: KA, ended: false, stop: false, parts: [
      { n: 0, words: "three things", status: "done", jobs: [] },
      ...["Add a Bookshop page", "Saturday hours to 8–7", "rounder buttons"].map((w, i) => ({ n: i + 1, parent: 0, words: w, status: "started", jobs: [] })),
    ] } } } };
  const p = load(split);
  assert.equal(text(p.html(1000)), "3 tasks in progress ▾");
  p.press({ "data-bg": "open" });
  const names = [...p.html(1000).matchAll(/st-bg-name">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(names, ["Add a Bookshop page", "Saturday hours to 8–7", "rounder buttons"]);
});

test("ONE — the task box appears only with two or more tasks (owner, 2026-11-02)", () => {
  const mk = (statuses) => ({ id: "s1", slug: "shop", pages: [], msgs: [{ r: "u", t: "x" }, { r: "a", t: "", request: KA }], jobCards: {},
    requests: { [KA]: { view: { key: KA, ended: false, stop: false, parts: statuses.map((s, n) => ({ n, parent: 0, words: "w" + n, status: s, jobs: [], said: said("T" + n) })) } } } });
  assert.equal(text(load(mk(["started"])).html(1000)), "", "one running task drew a task box");
  assert.match(text(load(mk(["started", "started"])).html(1000)), /2 tasks in progress/);
});
