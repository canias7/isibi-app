// THE PAGE, ONE LOAD AT A TIME: the real handlers of public/chat.js, run in a VM.
//
// MOVED HERE UNCHANGED from test/live-clarify-browser.test.mjs (2026-10-03),
// so the model-written replies' tests (test/model-replies-routes.test.mjs) can
// drive the same page — the send handler, the routing call, the edit and
// add-on posts and the readers that say what happened — with the real Worker
// answering each request. What it cuts, and why, is unchanged: the send and
// route handlers, the question block, and both readers' whole selection (the
// lists the sweep's readers run, so a reply here is read by exactly what reads
// it on the page). The network is scripted per URL; IndexedDB, where a case
// needs it, is a small stand-in kept in memory that outlives one page load.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { ASK_FNS, ASK_LINES } from "./browser-ask.mjs";
import { BROWSER_FNS, EDIT_BROWSER_FNS } from "../../scripts/addon-sweep.mjs";

const realEditPoll = createRequire(import.meta.url)("../../public/edit-poll.js");
const CHAT = readFileSync(new URL("../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

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
// THE LABELS OF A REQUEST'S CARD (2026-10-03, the combined request flow).
const REQ_STATUS = cutStatement("\nconst SITE_REQ_STATUS = {", "\n};\n", "approval:");

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
  // ONE MESSAGE, SEVERAL PARTS, FINISHED ON THE SERVER (2026-10-03): the
  // message's key, following a request, its card, Stop and the rewrite go-ahead.
  "siteMessageKey", "siteUnsentBack", "siteRequestOf", "siteReqState", "siteReqSay", "siteRequestStart", "siteRequestFollow",
  "siteRequestStop", "siteRequestApprove", "siteRequestsCheck", "siteRequestHTML",
  // EACH REQUEST'S MESSAGES WITH THAT REQUEST (2026-10-05): its own, its
  // card where it falls in time, and a message put after the last of its own.
  "siteReqOwnMsg", "siteReqMsgAt", "siteReqCardAt", "siteReqCard", "siteReqPut",
  // A JOB THIS PAGE DID NOT APPLY ITSELF (2026-10-05): another browser's,
  // finished while the page watched (the site's preview, tables and pages
  // brought up to date), or history, whose page list alone is read again.
  "siteReqRefresh", "siteRoutesSync",
  // A REPLY STILL BEING WRITTEN (2026-10-04): the outcome applied at once, the
  // reply's place held on the thread and followed on its own.
  "replyTellsEnding", "editReplyHold", "editReplyFollow", "siteHeldRepliesCheck",
  // WHERE THE PREVIEW FRAME POINTS (2026-10-05): its address, its loader and its
  // sandbox, for the render's own frame step below.
  "sitePreviewSrc", "loadSiteFrame", "frameSandbox",
  // A SITE'S TABLE LIST, IN ORDER (2026-10-05): every addition's tables, and
  // each routing answer's read, kept by when its call went out.
  "siteTablesAdd", "siteTablesRead",
])];
// AND THE TWO OF THEM THAT ARE `async function`s.
const ASYNC_FNS = ["siteRequestShow", "siteRequestJobReply"];
const LINES = [...new Set([
  "const ROUTE_EDIT_LAYERS =", "const siteRoutesAsked =", "const SITE_ROUTES_WAIT_MS =", "const siteRoutesPending =",
  "const SITE_NO_PAGES_MSG =", "const siteNewDraft =", "function siteBuildStop(", ...ASK_LINES, "const siteAskChecked =",
  "const ST_PHASE_ORDER =",
  "const SITE_REQ_KEEP_MS =", "const SITE_REQ_MISSES =", "const siteReqFollowing =", "const siteReqChecked =",
  "const siteReqAsked =", "const siteReqSeen =", "const siteRoutesSyncs =",
  "const editReplyFollowing =", "const FRAME_SANDBOX =", "const siteTablesOrder =",
])];
// THE RENDER'S OWN FRAME STEP (2026-10-05, the owner's review: *"test the
// rendered iframe URL, not merely previewV increasing"*): where `renderSites`
// points the preview frame of a React site, carried out of chat.js landmark to
// landmark — the real lines, run against a stand-in element by a page opened
// with `frame: true`, which records the address each drawing gives it.
const FRAME_HEAD = "\n  const fr = document.getElementById('stFrame');\n  if (fr && isReact) {";
const FRAME_TAIL = "\n    loadSiteFrame(fr, sitePreviewSrc(site, active && active.path));\n  }";
const FRAME_STEP = (() => {
  const at = CHAT.indexOf(FRAME_HEAD);
  assert.ok(at > 0 && CHAT.indexOf(FRAME_HEAD, at + 1) < 0, "the render's frame step is gone from chat.js, or is not one");
  const end = CHAT.indexOf(FRAME_TAIL, at);
  assert.ok(end > at, "the render's frame step has no end in chat.js");
  return CHAT.slice(at, end + FRAME_TAIL.length);
})();

const SRC = [
  cut("async function apiFetch("),
  ...FNS.map((n) => cut("function " + n + "(")),
  ...ASYNC_FNS.map((n) => cut("async function " + n + "(")),
  ...LINES.map(cutLine),
  KEYS,
  REQ_STATUS,
  "function wireThread(thread, site) {" + CLICKS + "}",
  "function siteDrawFrame(site, active, isReact) {" + FRAME_STEP + "\n}",
].join("\n");

export const tick = () => new Promise((r) => setTimeout(r, 0));
export const settle = async (n = 60) => { for (let i = 0; i < n; i++) await tick(); };
export const copy = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/**
 * INDEXEDDB AS A BROWSER KEEPS IT: one store per origin that outlives a page
 * load. Only what `askFilesDb`/`askFilesStore`/`askFilesFor`/`askFilesDrop`
 * use: open with an upgrade, one store, put/get/delete and a cursor.
 */
export function fakeIndexedDB() {
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
export function page({ site, answer = () => null, idb, timers = false, frame = false } = {}) {
  const calls = [];
  const keys = [];
  // WITH `frame`: each drawing runs the render's frame step on a fresh element,
  // as the render's own markup makes one, and keeps the address it was given.
  const frames = [];
  let drawn = null;
  // THE PAGE'S OWN TIMERS, WHEN A CASE DRIVES THEM (2026-10-03): a request's
  // poll waits on `setTimeout`; with `timers`, each wait is held until the case
  // runs it (`flush`), so a poll happens exactly when the case says.
  const held = [];
  const s = copy(site);
  if (!Array.isArray(s.msgs)) s.msgs = [];
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent,
    document: {
      addEventListener: (type, fn) => { if (type === "keydown") keys.push(fn); },
      ...(frame ? { getElementById: (id) => (id === "stFrame" ? drawn : null) } : {}),
    },
    ...(frame ? { location: { origin: "https://gofarther.dev", href: "https://gofarther.dev/" } } : {}),
    indexedDB: idb,
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      const body = init && init.body ? JSON.parse(init.body) : undefined;
      calls.push({ url: String(url), method, body });
      const a = answer(String(url), method, body, calls.length - 1);
      if (!a) return new Promise(() => {});
      const respond = (x) => {
        if (x.reject) return Promise.reject(x.reject);
        // AND ANY HEADER THE ANSWER CARRIES (a job poll's final-reply mark).
        return new Response(typeof x.body === "string" ? x.body : JSON.stringify(x.body), { status: x.status || 200, headers: { "content-type": "application/json", ...(x.headers || {}) } });
      };
      // A LATE ANSWER: a promise the case resolves when it chooses.
      if (typeof a.then === "function") return a.then(respond);
      return Promise.resolve().then(() => respond(a));
    },
    setInterval: () => ({}), clearInterval: () => {},
    setTimeout: (fn) => { if (timers && typeof fn === "function") held.push(fn); return {}; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    siteById: (id) => (id === s.id ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null,
    siteOpenId: s.id,
    renderSites: () => {
      if (!frame) return;
      drawn = { src: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); } };
      ctx.siteDrawFrame(s, ctx.siteActivePage(s), !!(s.react && s.url));
      frames.push(drawn.src);
    },
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-1", outcomeMessage: (k) => "outcome:" + k, rememberJob: () => {}, forgetJob: () => {} },
    browserTimeZone: () => "Europe/London",
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  const thread = { onclick: null, contains: () => true };
  ctx.wireThread(thread, s);
  return {
    s, ctx, calls, thread,
    /** Each drawing's frame address, in order (a page opened with `frame`). */
    frames: () => frames.slice(),
    /** Run every wait the page is holding (its polls), once. */
    flush: () => { const now = held.splice(0); now.forEach((fn) => fn()); return now.length; },
    said: () => copy(s.msgs),
    last: () => copy(s.msgs[s.msgs.length - 1]),
    ask: () => (s.ask == null ? null : copy(s.ask)),
    busy: () => ctx.siteBusy,
    key: (k, tag = "body") => { let stopped = false; keys.forEach((fn) => fn({ key: k, target: { tagName: tag }, preventDefault: () => { stopped = true; } })); return stopped; },
    click: (attr, value) => thread.onclick({ target: { closest: (sel) => (sel === "[" + attr + "]" ? { getAttribute: () => value } : null) } }),
    files: (id) => ctx.askFilesFor(id).then(copy),
  };
}
