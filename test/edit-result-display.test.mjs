// A PUBLISHED EDIT THIS PAGE FAILS TO SHOW IS STILL A PUBLISHED EDIT (2026-09-24).
//
// The owner, injecting a throw into the credit refresh while a queued edit's
// stored success was applied: "The rejection escapes; no reply is shown; busy
// remains true; editInFlight still holds fretwork-1." And the rule, the
// add-on's: "A successful server result remains successful if local
// application or rendering fails. Finish the request and release only its own
// lock. Do not start another paid operation. Do not append an uncertainty
// warning after success has already been reported. A late completion must not
// clear a newer request's busy state or lock."
//
// REPRODUCED FIRST, through these same handlers on ce27b5bb, and wider than
// reported. The owner's case left the page stuck until a reload: the next
// message sent nothing at all. The same throw straight back reached the POST's
// catch, which told the customer it could not tell whether an edit the route
// had just published went through. A redraw failing AFTER "✅ Updated the
// look." was on the thread printed that not-knowing sentence under it and ran
// the page's finish a second time — lowering a newer message's busy flag when
// the redraw had started one. A queued success whose redraw failed escaped the
// watcher as an unhandled rejection. And the recorded display-error finding
// held for every other sentence too: a refusal, an unreadable answer and a
// sign-out each got the not-knowing sentence under them.
//
// Two changes, both the add-on's: `applyEditResult` keeps a known result (a
// throw before its sentence says `editShownMsg`, a throw after is left
// standing, and nothing escapes it), and `siteEdit` ends each POST once — the
// finish it hands on drops anything after the first, so no catch, hop or
// watch can say a second sentence or run the page's finish again.
//
// `siteSend` is cut out of public/chat.js and RUN with the real routing, edit,
// watch, resume, add-on and rewrite handlers, the readers, both composers and
// the real public/edit-poll.js. `fetch` is the one seam, and a request the
// script does not answer is HELD until the case answers it. The two failures
// are INJECTED where the owner put them: the credit refresh throws only when
// it is called from inside the result's application, and the redraw throws
// only once a reply is on the thread.
//
// EVERY CASE SENDS A SECOND MESSAGE THROUGH THE SAME PAGE, because what a
// failed display leaves behind is what the next message meets. Each asserts
// every request sent, what was said, the final busy and latch state, and that
// nothing escaped to the event loop.
//
// Every answer here is SUPPLIED. This proves what the browser says and holds,
// never how often a real route answers these shapes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const P = require("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const POLL = readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");

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
const SRC = [
  POLL,
  cut("async function apiFetch("),
  cutLine("const ROUTE_EDIT_LAYERS ="),
  cut("function routeQuestion("),
  cut("function routeActionable("),
  cut("function siteRoute("),
  cutLine("const siteNewDraft ="),
  cut("function siteDraft("),
  cut("function siteSend("),
  cut("function siteBuildStart("),
  cutLine("function siteBuildStop("),
  cutLine("const editInFlight ="), cutLine("const editIdem ="), cutLine("const editBlocked ="), cutLine("const editWatched ="),
  cut("function editAsk("),
  cut("function editAskDone("),
  cut("function siteEdit("),
  cut("function unreadEditMsg("),
  cut("function editShownMsg("),
  cut("function wholeRequestNote("),
  cut("function editAnswer("),
  cut("function applyEditResult("),
  cut("function escalatedEdit("),
  cut("function watchEditJob("),
  cut("function resumeEditJob("),
  cut("function resumeOpenSite("),
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function readRouteReply("),
  cut("function readAddonReply("),
  cut("function readEditReply("),
  cut("function applyAddonResult("),
  cut("function addonOutcomeMsg("),
  cut("function sitePathOf("),
  ...["problemNote", "photoNote", "listPhotoNote", "browserTimeZone", "jobZone", "onceWhen", "jobWords",
    "jobOnceNote", "addonReplyText", "renderTail", "alsoTail", "editOutcomes", "partialSaid", "pageOpVerb",
    "pageOpsSaid", "editReplyBody", "editReply"].map((n) => cut("function " + n + "(")),
  cut("function reactSend("),
  cut("function reactStageLabel("),
  cut("function buildCostWords("),
  cut("function buildErrOutcome("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

const settle = async () => { for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r)); };

// WHAT REACHED THE EVENT LOOP. A handler is installed for the whole file, so an
// escaped rejection is RECORDED and asserted rather than left to the runner.
const escapes = [];
process.on("unhandledRejection", (e) => { escapes.push(String((e && e.message) || e)); });

function kindOf(url, method) {
  const u = String(url);
  if (u === "/api/site/route") return "route";
  if (/^\/api\/site\/edit\//.test(u)) return method === "GET" ? "poll" : "cancel";
  if (/^\/api\/site\/[^/]+\/edit$/.test(u)) return "edit";
  if (/^\/api\/site\/[^/]+\/addon$/.test(u)) return "addon";
  if (/^\/api\/site\/react-(revise|build)$/.test(u)) return "rewrite";
  return "other";
}
// ONE LINE PER REQUEST, carrying what the request was FOR.
function line(r) {
  const b = r.body || {};
  if (r.kind === "route") return "route: " + b.message;
  if (r.kind === "edit") return "edit " + b.layer + ": " + b.instruction;
  if (r.kind === "addon") return "addon: " + b.instruction;
  if (r.kind === "rewrite") return "rewrite: " + (b.instruction || b.brief);
  if (r.kind === "poll") return "poll " + r.url.split("/").pop();
  return r.method + " " + r.url;
}
function respond(a) {
  if (a.reject) return Promise.reject(a.reject);
  const headers = { "content-type": a.type || "application/json", ...(a.headers || {}) };
  return Promise.resolve(new Response(a.body, { status: a.status, headers }));
}

/**
 * ONE PAGE, with the real handlers loaded and `fetch` answered from `answers`.
 *
 * `credit: { from, times }` makes the credit refresh throw — only when it is
 * called from inside `from` (`applyEditResult`, or `applyAddonResult`), because
 * the routing call refreshes the balance too and a throw there is a different
 * failure. `redraw: { times, then }` makes the redraw throw once a reply is the
 * newest thing on the thread — after it is recorded — running `then` first,
 * which is how a case starts a newer message from inside an old one's redraw.
 */
function page({ answers = {}, credit, redraw } = {}) {
  const reqs = [];
  const held = [];
  const clock = { started: 0, cleared: 0 };
  const s = JSON.parse(JSON.stringify(SITE));
  s.msgs = [];
  const script = {};
  for (const k of Object.keys(answers)) script[k] = answers[k].slice();
  const store = new Map();
  const escapedBefore = escapes.length;
  let credits = credit ? credit.times || 1 : 0;
  let redraws = redraw ? redraw.times || 1 : 0;
  const self = {};
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent, Intl, Response, Headers,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } },
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      const kind = kindOf(url, method);
      reqs.push({ kind, method, url: String(url), body: init && init.body ? JSON.parse(init.body) : undefined });
      const next = script[kind] && script[kind].length ? script[kind].shift() : null;
      if (!next) return new Promise((resolve, reject) => { held.push({ kind, resolve, reject }); });
      return respond(next);
    },
    setInterval: () => { clock.started++; return { clock: clock.started }; },
    clearInterval: () => { clock.cleared++; },
    setTimeout: (fn) => { setImmediate(fn); return {}; },
    clearTimeout: () => {},
    showAuthGate: () => {},
    scheduleCreditRefresh: () => {
      if (credits > 0 && new RegExp("\\bat " + credit.from + "\\b").test(new Error().stack)) {
        credits--;
        throw new Error("the credit refresh failed");
      }
    },
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: "origin-1",
    renderSites: () => {
      const last = s.msgs[s.msgs.length - 1];
      if (redraws > 0 && last && last.r === "a") {
        redraws--;
        if (redraw.then) redraw.then(self);
        throw new Error("the redraw failed");
      }
    },
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  return Object.assign(self, {
    ctx, s, script,
    lock() { return JSON.parse(vm.runInContext("JSON.stringify([...editInFlight.keys()])", ctx)); },
    async send(message) { ctx.siteSend(message); await settle(); },
    async answer(kind, a) {
      const at = held.findIndex((h) => h.kind === kind);
      assert.ok(at >= 0, "no " + kind + " request is waiting to be answered; waiting: " + JSON.stringify(held.map((h) => h.kind)));
      const [h] = held.splice(at, 1);
      respond(a).then(h.resolve, h.reject);
      await settle();
    },
    waiting() { return held.map((h) => h.kind); },
    lines() { return reqs.map(line); },
    said() { return s.msgs.filter((m) => m.r === "a").map((m) => m.t); },
    asked() { return s.msgs.filter((m) => m.r === "u").map((m) => m.t); },
    busy() { return ctx.siteBusy; },
    rail() { return !!ctx.siteBuild; },
    escaped() { return escapes.slice(escapedBefore); },
    unarmed() { return credits === 0 && redraws === 0; },
    clock,
  });
}

const SITE = { id: "origin-1", slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }] };
const M1 = "Change the opening hours to 9 till 5";
const M2 = "Make the footer navy";
const M3 = "Put the phone number in the footer";
const json = (o) => JSON.stringify(o);
const ok = (o, status = 200) => ({ status, body: json(o) });
const stored = (o, status = 200) => ({ status, body: json(o), headers: { "x-gf-edit": "final" } });
const routeTo = (layer) => ok({ ok: true, intent: "edit", layer, cost: 2 });
const receipt = (job) => ok({ ok: true, job, status: "queued", poll: "/api/site/edit/" + job }, 202);

// THE EDIT ROUTE'S OWN SHAPES (worker.js), as test/edit-lock.test.mjs has them.
const HOP = { ok: false, escalate: true, reason: "no-data", cost: 0, layer: "text" };
const HANDOFF = { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" };
const WORDED = { ok: true, layer: "text", applied: 1, cost: 1 };
const LOOKED = { ok: true, layer: "look", lanes: ["css"], layers: ["look"], cost: 1 };
const ADDED = { ok: true, cost: 12, kinds: ["qr"], added: [], changed: ["index.tsx"] };
const EXPLAIN = { ok: false, error: "no-page", cost: 0, unchanged: true, msg: "Your site has no /blog page, so there was nothing to take off." };
const HTML = { status: 200, body: "<!doctype html><title>oops</title>", type: "text/html" };

// WHAT IS SAID. `SHOWN` is the new sentence, spelled out once so a change to it
// is a change somebody makes on purpose; the rest are the page's own.
const SHOWN = "✅ That change went through, but I couldn’t show the details of what it changed here.";
const ADDON_SHOWN = "✅ That addition went through, but I couldn’t show the details of what it changed here.";
const LOOK = "✅ Updated the look.";
const WORDING = "✅ Updated the wording.";
const UNREAD = "⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Check the preview before asking for it again.";
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";
const REFUSED = "⚠️ " + EXPLAIN.msg + " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.";

/** The page idle: the latch free, nothing busy or waiting, nothing escaped. */
function assertIdle(p, when) {
  assert.deepEqual(p.lock(), [], "the site is still latched " + when);
  assert.equal(p.busy(), false, "the send box is still busy " + when);
  assert.equal(p.rail(), false, "the step rows are still running " + when);
  assert.deepEqual(p.waiting(), [], "a request is still waiting " + when);
  assert.equal(p.clock.started, p.clock.cleared, "the rail's clock was started " + p.clock.started + " times and cleared " + p.clock.cleared + " " + when);
  assert.deepEqual(p.escaped(), [], "a rejection escaped to the event loop " + when);
}
function merge(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = [...(a[k] || []), ...(b[k] || [])];
  return out;
}
const MESSAGE_2 = { route: [routeTo("look")], edit: [ok(LOOKED)] };

/**
 * MESSAGE 2 AFTER MESSAGE 1, THROUGH THE SAME PAGE, the injections spent. It
 * must reach the router AND the edit route with its own words, say its own
 * sentence, and leave the page idle.
 */
async function thenMessage2(p) {
  assert.ok(p.unarmed(), "an injected failure was never reached, so the case proves nothing about it");
  const lines = p.lines().length, said = p.said().length;
  await p.send(M2);
  assert.deepEqual(p.lines().slice(lines), ["route: " + M2, "edit look: " + M2], "message 2 did not reach the edit route");
  assert.deepEqual(p.said().slice(said), [LOOK]);
  assertIdle(p, "after message 2");
}

/** Message 1 answered straight through, its result, then message 2. */
async function twoMessages({ first, credit, redraw, lines, said }) {
  const p = page({ answers: merge(first, MESSAGE_2), credit, redraw });
  await p.send(M1);
  assert.deepEqual(p.lines(), lines, "message 1 sent the wrong requests");
  assert.deepEqual(p.said(), said, "message 1 said the wrong thing");
  assertIdle(p, "after message 1");
  await thenMessage2(p);
  return p;
}

const IN_EDIT = { from: "applyEditResult" };

// ── A SUCCESS WHOSE APPLICATION THROWS BEFORE ITS SENTENCE ─────────────────

test("THE OWNER'S REPRODUCTION: a queued success whose credit refresh throws is said as a success, frees the page, and the next message posts its edit", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [receipt("job-o")], poll: [stored(LOOKED)] },
    credit: IN_EDIT,
    lines: ["route: " + M1, "edit look: " + M1, "poll job-o"],
    said: [SHOWN],
  });
});

test("a success straight back whose credit refresh throws is said as a success, never as not knowing", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(LOOKED)] },
    credit: IN_EDIT,
    lines: ["route: " + M1, "edit look: " + M1],
    said: [SHOWN],
  });
});

test("a hop's success whose credit refresh throws is said as a success, and the hop's ask releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(WORDED)] },
    credit: IN_EDIT,
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [SHOWN],
  });
});

test("a hop whose own answer is queued, and whose success then fails to apply, is said as a success", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), receipt("job-h")], poll: [stored(WORDED)] },
    credit: IN_EDIT,
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1, "poll job-h"],
    said: [SHOWN],
  });
});

test("a watch resumed after a refresh whose stored success fails to apply is said as a success and frees the page", async () => {
  const p = page({ answers: merge({ poll: [stored(LOOKED)] }, MESSAGE_2), credit: IN_EDIT });
  // A reload's view of a job this site filed: the ask rides the record.
  p.ctx.EditPoll.rememberJob("fretwork-1", "job-z", undefined, { ask: M1, op: "edit", layer: "look", page: "" });
  assert.equal(p.ctx.resumeOpenSite(p.s), true, "the resume did not start");
  await settle();
  assert.deepEqual(p.lines(), ["poll job-z"]);
  assert.deepEqual(p.said(), [SHOWN]);
  assertIdle(p, "after the resumed job's answer");
  await thenMessage2(p);
});

// ── A SUCCESS WHOSE REDRAW THROWS AFTER ITS SENTENCE IS RECORDED ───────────

test("a success straight back whose redraw throws after its sentence says nothing more", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(LOOKED)] },
    redraw: {},
    lines: ["route: " + M1, "edit look: " + M1],
    said: [LOOK],
  });
});

test("a queued success whose redraw throws after its sentence says nothing more, and nothing escapes the watch", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [receipt("job-o")], poll: [stored(LOOKED)] },
    redraw: {},
    lines: ["route: " + M1, "edit look: " + M1, "poll job-o"],
    said: [LOOK],
  });
});

test("a hop's success whose redraw throws after its sentence says nothing more", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(WORDED)] },
    redraw: {},
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [WORDING],
  });
});

test("a watch resumed after a refresh whose success's redraw throws after its sentence says nothing more", async () => {
  // THE CHAIN WHERE `applyEditResult`'s OWN `told` IS THE ONLY WALL. On a
  // customer's message the POST's ending would drop a second sentence as well
  // — two walls, deliberately — but a resumed watch hands the reader the
  // page's own finish, and nothing but the result's own record of having
  // spoken keeps its catch from speaking again.
  const p = page({ answers: merge({ poll: [stored(LOOKED)] }, MESSAGE_2), redraw: {} });
  p.ctx.EditPoll.rememberJob("fretwork-1", "job-z", undefined, { ask: M1, op: "edit", layer: "look", page: "" });
  assert.equal(p.ctx.resumeOpenSite(p.s), true, "the resume did not start");
  await settle();
  assert.deepEqual(p.lines(), ["poll job-z"]);
  assert.deepEqual(p.said(), [LOOK]);
  assertIdle(p, "after the resumed job's answer");
  await thenMessage2(p);
});

// ── BOTH: THE KNOWN-RESULT SENTENCE'S OWN REDRAW THROWS TOO ────────────────

test("a success straight back that fails to apply AND whose known-result redraw throws says one sentence", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(LOOKED)] },
    credit: IN_EDIT, redraw: {},
    lines: ["route: " + M1, "edit look: " + M1],
    said: [SHOWN],
  });
});

test("a queued success that fails to apply AND whose known-result redraw throws says one sentence, and nothing escapes", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [receipt("job-o")], poll: [stored(LOOKED)] },
    credit: IN_EDIT, redraw: {},
    lines: ["route: " + M1, "edit look: " + M1, "poll job-o"],
    said: [SHOWN],
  });
});

// ── AN OLD REQUEST'S REDRAW FAILING ENDS NOTHING OF A NEWER ONE ────────────
//
// The newer request is started from INSIDE the old one's redraw, through the
// page's own `siteSend` — the one moment a newer request can exist while the
// old one's failure is still unwinding. It sets the page's busy flag and takes
// the site's latch the way any message does.

/** Message 2, started in message 1's redraw, still holds the page and the site. */
async function newerHolds(p, lines, said) {
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["edit"]);
  assert.deepEqual(p.said(), said, "message 1 said more than its own sentence");
  assert.deepEqual(p.lock(), ["fretwork-1"], "message 1's end released the site message 2 holds");
  assert.equal(p.busy(), true, "message 1's end cleared message 2's busy flag");
  assert.equal(p.rail(), true, "message 1's end stopped message 2's step rows");
  assert.deepEqual(p.escaped(), []);
  // A THIRD PRESS WHILE MESSAGE 2 RUNS SENDS NOTHING — not even a routing call,
  // because the busy flag is message 2's and nothing of message 1 lowered it.
  await p.send(M3);
  assert.deepEqual(p.lines(), lines, "a third press reached the server while message 2 ran");
  assert.deepEqual(p.asked(), [M1, M2], "the third press was taken as a message");
  await p.answer("edit", ok(LOOKED));
  assert.deepEqual(p.said(), [...said, LOOK]);
  assertIdle(p, "after message 2 answered");
}

test("a success straight back whose redraw starts a newer message and then throws leaves the newer message's busy flag and latch alone", async () => {
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [ok(LOOKED)] }, redraw: { then: (q) => q.ctx.siteSend(M2) } });
  await p.send(M1);
  await newerHolds(p, ["route: " + M1, "edit look: " + M1, "route: " + M2, "edit look: " + M2], [LOOK]);
});

test("a queued success whose redraw starts a newer message and then throws leaves the newer message alone, and nothing escapes", async () => {
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [receipt("job-o")], poll: [stored(LOOKED)] }, redraw: { then: (q) => q.ctx.siteSend(M2) } });
  await p.send(M1);
  await newerHolds(p, ["route: " + M1, "edit look: " + M1, "poll job-o", "route: " + M2, "edit look: " + M2], [LOOK]);
});

test("a refusal whose redraw starts a newer message and then throws leaves the newer message alone", async () => {
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [ok(EXPLAIN, 422)] }, redraw: { then: (q) => q.ctx.siteSend(M2) } });
  await p.send(M1);
  await newerHolds(p, ["route: " + M1, "edit look: " + M1, "route: " + M2, "edit look: " + M2], [REFUSED]);
});

// ── EVERY OTHER SENTENCE, ONCE: THE RECORDED DISPLAY-ERROR FINDING ─────────

test("a refusal whose redraw throws is not followed by the not-knowing sentence", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(EXPLAIN, 422)] },
    redraw: {},
    lines: ["route: " + M1, "edit look: " + M1],
    said: [REFUSED],
  });
});

test("an unreadable answer whose redraw throws says the not-knowing sentence once", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [HTML] },
    redraw: {},
    lines: ["route: " + M1, "edit look: " + M1],
    said: [UNREAD],
  });
});

test("a sign-out whose redraw throws is not followed by the not-knowing sentence", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok({ error: "sign in required" }, 401)] },
    redraw: {},
    lines: ["route: " + M1, "edit look: " + M1],
    said: [SIGNED_OUT],
  });
});

test("a watch resumed after a refresh whose hop is refused, and whose redraw throws, says one sentence", async () => {
  // THE ONE CHAIN WITH NO ASK AROUND IT: a resumed watch takes no latch, so the
  // hop it makes is handed the page's own finish, and only the POST's own
  // ending — not the ask's — stands between that hop's catch and a second
  // sentence. Which is why the ending is per POST.
  const p = page({ answers: merge({ poll: [stored(HOP)], edit: [ok(EXPLAIN, 422)] }, MESSAGE_2), redraw: {} });
  p.ctx.EditPoll.rememberJob("fretwork-1", "job-z", undefined, { ask: M1, op: "edit", layer: "data", page: "" });
  assert.equal(p.ctx.resumeOpenSite(p.s), true, "the resume did not start");
  await settle();
  assert.deepEqual(p.lines(), ["poll job-z", "edit text: " + M1]);
  // No routing call was made in this page, so the refusal names no routing cost.
  assert.deepEqual(p.said(), ["⚠️ " + EXPLAIN.msg + " Nothing on your site changed, and this edit cost you nothing."]);
  assertIdle(p, "after the resumed hop was refused");
  await thenMessage2(p);
});

test("a hop's refusal whose redraw throws is not followed by the not-knowing sentence", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(EXPLAIN, 422)] },
    redraw: {},
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [REFUSED],
  });
});

// ── CONTROLS, AND ACTIVE WORK STILL PROTECTED ──────────────────────────────

test("CONTROL: a success whose showing works says its own sentence, straight back and queued", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(LOOKED)] },
    lines: ["route: " + M1, "edit look: " + M1],
    said: [LOOK],
  });
  await twoMessages({
    first: { route: [routeTo("look")], edit: [receipt("job-o")], poll: [stored(LOOKED)] },
    lines: ["route: " + M1, "edit look: " + M1, "poll job-o"],
    said: [LOOK],
  });
});

test("CONTROL: an edit handed to the add-on whose success fails to apply keeps the add-on's own known-result sentence", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [ok(HANDOFF)], addon: [ok(ADDED)] },
    credit: { from: "applyAddonResult" },
    lines: ["route: " + M1, "edit look: " + M1, "addon: " + M1],
    said: [ADDON_SHOWN],
  });
});

for (const queued of [false, true]) {
  test(`an add-on success ${queued ? "queued" : "straight back"} whose application and fallback redraw both throw stays successful and permits the next message`, async () => {
    await twoMessages({
      first: {
        route: [routeTo("look")], edit: [ok(HANDOFF)],
        addon: [queued ? receipt("job-addon") : ok(ADDED)],
        ...(queued ? { poll: [stored(ADDED)] } : {}),
      },
      credit: { from: "applyAddonResult" }, redraw: {},
      lines: ["route: " + M1, "edit look: " + M1, "addon: " + M1, ...(queued ? ["poll job-addon"] : [])],
      said: [ADDON_SHOWN],
    });
  });
}

test("a queued add-on fallback redraw that starts a newer message and throws leaves the newer request alone", async () => {
  const p = page({
    answers: {
      route: [routeTo("look"), routeTo("look")], edit: [ok(HANDOFF)],
      addon: [receipt("job-addon")], poll: [stored(ADDED)],
    },
    credit: { from: "applyAddonResult" },
    redraw: { then: (q) => q.ctx.siteSend(M2) },
  });
  await p.send(M1);
  await newerHolds(p, ["route: " + M1, "edit look: " + M1, "addon: " + M1, "poll job-addon", "route: " + M2, "edit look: " + M2], [ADDON_SHOWN]);
});

test("a second press while the queued job runs sends nothing, and the job's success that then fails to apply frees the page", async () => {
  const p = page({ answers: merge({ route: [routeTo("look")], edit: [receipt("job-o")] }, MESSAGE_2), credit: IN_EDIT });
  await p.send(M1);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "poll job-o"]);
  assert.deepEqual(p.lock(), ["fretwork-1"], "the site is not latched while the job runs");
  assert.equal(p.busy(), true);
  await p.send(M3);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "poll job-o"], "a second press reached the server while the job ran");
  assert.deepEqual(p.asked(), [M1], "the second press was taken as a message");
  await p.answer("poll", stored(LOOKED));
  assert.deepEqual(p.said(), [SHOWN]);
  assertIdle(p, "after the job's answer");
  await thenMessage2(p);
});

test("the known-result sentence is a success and says nothing uncertain", () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut("function editShownMsg(") + cut("function addonOutcomeMsg("), ctx);
  assert.equal(ctx.editShownMsg(), SHOWN);
  assert.ok(SHOWN.startsWith("✅"), "the known result is not drawn as a success");
  for (const unsure of ["couldn’t read", "can’t tell", "whether", "didn’t", "try again"]) {
    assert.ok(!SHOWN.includes(unsure), "the known-result sentence says something uncertain: " + JSON.stringify(unsure));
  }
  // THE ADD-ON'S OWN, one noun over — two sentences for one fact would drift.
  assert.equal(ctx.addonOutcomeMsg("shown"), ADDON_SHOWN);
  assert.equal(SHOWN.replace("change", "addition"), ADDON_SHOWN);
});
