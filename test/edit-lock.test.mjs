// A SITE'S EDIT LATCH IS HELD FOR EXACTLY AS LONG AS ITS ASK (2026-09-24).
//
// The owner, reproducing it independently through the real handlers: "1. An
// edit hands off to another edit layer. 2. That layer succeeds and the customer
// hears "Updated the wording." 3. A second message reaches the router. 4. No
// second edit POST occurs, and busy stays true." And the rule: "Release the
// original request's duplicate-execution lock when its handoff chain genuinely
// finishes. Preserve protection while work is active, including queued jobs,
// and ensure an old completion cannot release a newer request's lock."
//
// REPRODUCED FIRST, through these same handlers on 4b849501. Every chain with a
// synchronous hop in it left the site latched after message 1, whatever the hop
// answered — a success, a refusal, a dropped POST, an unreadable body, a 401,
// its own queued success, a handoff to the add-on, a climb to the rewrite — and
// message 2 then paid for its routing call, posted no edit, said nothing and
// left the send box busy. The latch was a site name in a Set, released by a
// `clearFlight` that did nothing inside a hop and that the first POST never
// called once it had handed off. And the other way round, a queued edit
// released it at its RECEIPT, while the job it had just filed was still
// running — as did an edit that handed its ask to the add-on.
//
// The latch belongs to the ask now (`editAsk`/`editAskDone`): `siteEdit` takes
// it for a customer's message and wraps that message's `finish` and `fallback`,
// everything downstream is handed the wrapped pair, and the chain's end — its
// sentence, or its handoff to the full rewrite — is the one release.
//
// `siteSend` is cut out of public/chat.js and RUN with the real `siteRoute`,
// `siteEdit`, `editAsk`, `editAskDone`, `editAnswer`, `escalatedEdit`,
// `watchEditJob`, `resumeOpenSite`, `siteAddon`, `addonAnswer`, the readers,
// both reply composers, `reactSend` and the real public/edit-poll.js. `fetch`
// is the one seam: each request is recorded and answered from the case's
// script, and a request the script does not answer is HELD until the case
// answers it — which is how a case looks at the latch while work is active.
//
// EVERY CASE SENDS TWO MESSAGES THROUGH ONE PAGE, because the defect lives in
// what the first message leaves behind for the second, which separate fixtures
// cannot see. Each asserts every request sent, what was said, and the final
// busy and latch state.
//
// Every answer here is SUPPLIED. This proves what the browser sends and holds,
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
// THE LATCHES AS THE PAGE DECLARES THEM, and the two functions that own the
// edit latch — never a second copy of either.
const LATCHES = [
  cutLine("const editInFlight ="), cutLine("const editIdem ="), cutLine("const editBlocked ="), cutLine("const editWatched ="),
  cut("function editAsk("),
  cut("function editAskDone("),
];
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
  ...LATCHES,
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

function kindOf(url, method) {
  const u = String(url);
  if (u === "/api/site/route") return "route";
  if (/^\/api\/site\/edit\//.test(u)) return method === "GET" ? "poll" : "cancel";
  if (/^\/api\/site\/[^/]+\/edit$/.test(u)) return "edit";
  if (/^\/api\/site\/[^/]+\/addon$/.test(u)) return "addon";
  if (/^\/api\/site\/react-(revise|build)$/.test(u)) return "rewrite";
  return "other";
}

// ONE LINE PER REQUEST, carrying what the request was FOR: the message a
// routing call routed, the layer and the ask an edit posted, the job a poll
// followed. Two edits of the same layer for two different messages read apart.
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
 * ONE PAGE, with the real handlers loaded and `fetch` answered from `answers`
 * (a request kind → the responses it gets, in order). A request the script
 * does not answer is held; `answer(kind, response)` answers the oldest one
 * waiting. `lock()` is the sites the edit latch holds, read off the page's own
 * map. `onRender` runs where the page would redraw the workspace.
 */
function page({ answers = {}, onRender } = {}) {
  const reqs = [];
  const held = [];
  const clock = { started: 0, cleared: 0 };
  const s = JSON.parse(JSON.stringify(SITE));
  s.msgs = [];
  const script = {};
  for (const k of Object.keys(answers)) script[k] = answers[k].slice();
  const store = new Map();
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
    scheduleCreditRefresh: () => {},
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: "origin-1",
    renderSites: () => { if (onRender) onRender(); },
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  return {
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
    clock,
  };
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

// THE EDIT ROUTE'S OWN SHAPES, as `escalate()`, `explain()` and the job's
// stored replies write them (worker.js). `HOP` is the data rung handing a
// change of wording to the text rung — the owner's reproduction.
const HOP = { ok: false, escalate: true, reason: "no-data", cost: 0, layer: "text" };
const HOP_PAGE = { ok: false, escalate: true, reason: "needs-place", cost: 0, layer: "page" };
const HANDOFF = { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" };
const WORDED = { ok: true, layer: "text", applied: 1, cost: 1 };
const LOOKED = { ok: true, layer: "look", lanes: ["css"], layers: ["look"], cost: 1 };
const ADDED = { ok: true, cost: 12, kinds: ["qr"], added: [], changed: ["index.tsx"] };
const EXPLAIN = { ok: false, error: "no-page", cost: 0, unchanged: true, msg: "Your site has no /blog page, so there was nothing to take off." };
const REVIEW = { ok: false, error: "needs-review", job: "job-r", msg: "Stopped mid-publish." };
const DROPPED = { reject: new TypeError("Failed to fetch") };
const HTML = { status: 200, body: "<!doctype html><title>oops</title>", type: "text/html" };

// WHAT IS SAID, as the page's own composers and sentences say it.
const WORDING = "✅ Updated the wording.";
const LOOK = "✅ Updated the look.";
const UNREAD = "⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Check the preview before asking for it again.";
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";
const REFUSED = "⚠️ " + EXPLAIN.msg + " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.";
const UNDER_REVIEW = "⚠️ " + P.outcomeMessage("needs_review");
const LOST_JOB = "⚠️ I lost track of that edit. Your site is unchanged unless it had already published.";
const ADDON_DONE = "✅ Done — updated /.";

/** Nothing left over: the latch free, the page idle, nothing waiting. */
function assertIdle(p, when) {
  assert.deepEqual(p.lock(), [], "the site is still latched " + when);
  assert.equal(p.busy(), false, "the send box is still busy " + when);
  assert.equal(p.rail(), false, "the step rows are still running " + when);
  assert.deepEqual(p.waiting(), [], "a request is still waiting " + when);
  assert.equal(p.clock.started, p.clock.cleared, "the rail's clock was started " + p.clock.started + " times and cleared " + p.clock.cleared + " " + when);
}
/** Work in flight: the ask holds the site and the page is busy. */
function assertHeld(p, when) {
  assert.deepEqual(p.lock(), ["fretwork-1"], "the site is not latched " + when);
  assert.equal(p.busy(), true, "the send box is not busy " + when);
}
function merge(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = [...(a[k] || []), ...(b[k] || [])];
  return out;
}

/**
 * MESSAGE 2 AFTER MESSAGE 1, THROUGH THE SAME PAGE. Message 2 is always a plain
 * look change answered with a success, so whatever message 1 left behind is
 * the only thing that can stop it: it must reach the router AND the edit route
 * with its own words, say its own sentence, and leave the page idle.
 */
async function thenMessage2(p, before) {
  await p.send(M2);
  assert.deepEqual(p.lines().slice(before.lines.length), ["route: " + M2, "edit look: " + M2],
    "message 2 did not reach the edit route after message 1 ended");
  assert.deepEqual(p.said().slice(before.said.length), [LOOK]);
  assertIdle(p, "after message 2");
}
const MESSAGE_2 = { route: [routeTo("look")], edit: [ok(LOOKED)] };

/** Message 1 answered straight through, then message 2. */
async function twoMessages({ first, lines, said }) {
  const p = page({ answers: merge(first, MESSAGE_2) });
  await p.send(M1);
  assert.deepEqual(p.lines(), lines, "message 1 sent the wrong requests");
  assert.deepEqual(p.said(), said, "message 1 said the wrong thing");
  assertIdle(p, "after message 1");
  await thenMessage2(p, { lines, said });
  return p;
}

// ── THE HOP'S EVERY END RELEASES THE SITE ──────────────────────────────────

test("THE OWNER'S REPRODUCTION: a hop that succeeds releases the site, and the next message posts its edit", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(WORDED)] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [WORDING],
  });
});

test("a hop that is refused releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(EXPLAIN, 422)] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [REFUSED],
  });
});

test("a hop whose POST drops releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), DROPPED] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [UNREAD],
  });
});

test("a hop whose answer cannot be read releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), HTML] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [UNREAD],
  });
});

test("a hop answered with a 401 releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok({ error: "sign in required" }, 401)] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [SIGNED_OUT],
  });
});

test("a hop whose answer is an escalate at a 503 is still refused by the reader, posts nothing more, and releases the site", async () => {
  // THE VALIDATED CHECKS ARE UNTOUCHED: an escalate at a failing status is not
  // trusted with a paid request — no third POST — and the chain ends in the
  // not-knowing sentence, which is now also where the latch comes off.
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(HOP_PAGE, 503)] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1],
    said: [UNREAD],
  });
});

test("a first POST that drops, with no hop, releases the site — the control that always held", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [DROPPED] },
    lines: ["route: " + M1, "edit look: " + M1],
    said: [UNREAD],
  });
});

test("a hop that stops under review releases the site, and the next message meets the review block — not the latch", async () => {
  const p = page({ answers: merge({ route: [routeTo("data")], edit: [ok(HOP), ok(REVIEW, 409)] }, MESSAGE_2) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit data: " + M1, "edit text: " + M1];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.said(), [UNDER_REVIEW]);
  assertIdle(p, "after message 1");
  await p.send(M2);
  // Refused before any POST by the site's review block, in its own words; the
  // latch is free, so it is the block — the server's own rule — that says no.
  assert.deepEqual(p.lines().slice(lines.length), ["route: " + M2], "an edit was posted to a site under review");
  assert.deepEqual(p.said(), [UNDER_REVIEW, UNDER_REVIEW]);
  // Message 2's own edit answer was never asked for.
  assert.equal(p.script.edit.length, 1, "message 2 posted an edit");
  p.script.edit.length = 0;
  assertIdle(p, "after message 2");
});

// ── A QUEUED JOB HOLDS THE SITE UNTIL ITS ANSWER LANDS ─────────────────────

test("a queued edit holds the site while its job runs, and releases it when the job's answer lands", async () => {
  const p = page({ answers: merge({ route: [routeTo("look")], edit: [receipt("job-o")] }, MESSAGE_2) });
  await p.send(M1);
  // ACTIVE WORK: the receipt is in, the job is running, the poll is out. This
  // is where the old release sat — the latch came off at the receipt.
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "poll job-o"]);
  assert.deepEqual(p.waiting(), ["poll"]);
  assertHeld(p, "while the queued job runs");
  await p.answer("poll", stored(LOOKED));
  assert.deepEqual(p.said(), [LOOK]);
  assertIdle(p, "after the job's answer landed");
  await thenMessage2(p, { lines: ["route: " + M1, "edit look: " + M1, "poll job-o"], said: [LOOK] });
});

test("a queued edit whose stored answer hops holds the site through the hop", async () => {
  const p = page({ answers: merge({ route: [routeTo("data")], edit: [receipt("job-o")], poll: [stored(HOP)] }, { route: [routeTo("look")] }) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit data: " + M1, "poll job-o", "edit text: " + M1];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["edit"]);
  assertHeld(p, "while the stored answer's hop is posted");
  await p.answer("edit", ok(WORDED));
  assert.deepEqual(p.said(), [WORDING]);
  assertIdle(p, "after the hop answered");
  p.script.edit = [ok(LOOKED)];
  await thenMessage2(p, { lines, said: [WORDING] });
});

test("a hop whose own answer is queued holds the site until the job's answer lands", async () => {
  const p = page({ answers: merge({ route: [routeTo("data")], edit: [ok(HOP), receipt("job-h")] }, MESSAGE_2) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit data: " + M1, "edit text: " + M1, "poll job-h"];
  assert.deepEqual(p.lines(), lines);
  assertHeld(p, "while the hop's job runs");
  await p.answer("poll", stored(WORDED));
  assert.deepEqual(p.said(), [WORDING]);
  assertIdle(p, "after the hop's job answered");
  await thenMessage2(p, { lines, said: [WORDING] });
});

test("a queued edit whose stored answer is a refusal releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [receipt("job-o")], poll: [stored(EXPLAIN, 422)] },
    lines: ["route: " + M1, "edit data: " + M1, "poll job-o"],
    said: [REFUSED],
  });
});

test("a queued edit whose job is lost releases the site", async () => {
  await twoMessages({
    first: { route: [routeTo("look")], edit: [receipt("job-o")], poll: [ok({ error: "not found" }, 404)] },
    lines: ["route: " + M1, "edit look: " + M1, "poll job-o"],
    said: [LOST_JOB],
  });
});

// ── THE HANDOFFS ───────────────────────────────────────────────────────────

test("an edit handed to the add-on holds the site through the add-on, and releases it at the add-on's end", async () => {
  const p = page({ answers: merge({ route: [routeTo("look")], edit: [ok(HANDOFF)] }, MESSAGE_2) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit look: " + M1, "addon: " + M1];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["addon"]);
  // THE OLD RELEASE SAT HERE TOO: the edit let go of the site as it handed
  // the ask to the add-on, so the whole addition ran unlatched.
  assertHeld(p, "while the add-on the edit handed its ask to runs");
  await p.answer("addon", ok(ADDED));
  assert.deepEqual(p.said(), [ADDON_DONE]);
  assertIdle(p, "after the add-on answered");
  await thenMessage2(p, { lines, said: [ADDON_DONE] });
});

test("an add-on the edit handed off, queued, holds the site until its job's answer lands", async () => {
  const p = page({ answers: merge({ route: [routeTo("look")], edit: [ok(HANDOFF)], addon: [receipt("job-a")] }, MESSAGE_2) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit look: " + M1, "addon: " + M1, "poll job-a"];
  assert.deepEqual(p.lines(), lines);
  assertHeld(p, "while the add-on's job runs");
  await p.answer("poll", stored(ADDED));
  assert.deepEqual(p.said(), [ADDON_DONE]);
  assertIdle(p, "after the add-on's job answered");
  await thenMessage2(p, { lines, said: [ADDON_DONE] });
});

test("a hop handed to the add-on releases the site when the add-on ends", async () => {
  await twoMessages({
    first: { route: [routeTo("data")], edit: [ok(HOP), ok(HANDOFF)], addon: [ok(ADDED)] },
    lines: ["route: " + M1, "edit data: " + M1, "edit text: " + M1, "addon: " + M1],
    said: [ADDON_DONE],
  });
});

test("a hop that climbs releases the site at the handoff to the rewrite, and the page stays busy until the rewrite ends", async () => {
  // ONE HOP, THEN UP: the hop's own escalate names a layer and still goes to
  // the rewrite — the bound is untouched.
  const p = page({ answers: merge({ route: [routeTo("data")], edit: [ok(HOP), ok(HOP_PAGE)] }, MESSAGE_2) });
  await p.send(M1);
  const lines = ["route: " + M1, "edit data: " + M1, "edit text: " + M1, "rewrite: " + M1];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["rewrite"]);
  // THE EDIT CHAIN HAS ENDED AND THE WORK HAS NOT. The latch is the edit's and
  // came off at the handoff — a rewrite that succeeds ends through
  // `siteFinishBuild` and never calls the finish it was handed — and the page's
  // busy flag is what holds while the rewrite runs.
  assert.deepEqual(p.lock(), [], "the edit latch is still held by an ask that has left the edit route");
  assert.equal(p.busy(), true, "the send box is free while the rewrite runs");
  await p.send(M3);
  assert.deepEqual(p.lines(), lines, "a message sent while the rewrite ran reached the server");
  await p.answer("rewrite", ok({ need: "credits", msg: "Not enough credits." }, 402));
  assert.deepEqual(p.said(), ["⚡ Not enough credits."]);
  assertIdle(p, "after the rewrite answered");
  await thenMessage2(p, { lines, said: ["⚡ Not enough credits."] });
});

// ── A DUPLICATE IS STILL REFUSED WHILE THE WORK RUNS ───────────────────────

test("CONTROL: a second press while the first edit is unanswered sends nothing and does not release the first ask's latch", async () => {
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")] } });
  await p.send(M1);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1]);
  assertHeld(p, "while the first POST is unanswered");
  await p.send(M2);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1], "the second press reached the server");
  assert.deepEqual(p.asked(), [M1], "the second press was taken as a message");
  assertHeld(p, "after the second press");
  await p.answer("edit", ok(LOOKED));
  assert.deepEqual(p.said(), [LOOK]);
  assertIdle(p, "after the first POST answered");
  p.script.edit = [ok(LOOKED)];
  await p.send(M3);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "route: " + M3, "edit look: " + M3]);
  assert.deepEqual(p.said(), [LOOK, LOOK]);
  assertIdle(p, "after the third message");
});

test("CONTROL: a second press while a queued job is watched sends nothing", async () => {
  // THE PAGE'S BUSY FLAG, which refused this before the latch was held through
  // the watch and refuses it now — the same requests either way. That the
  // latch is held here as well is the two cases around this one.
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [receipt("job-o"), ok(LOOKED)] } });
  await p.send(M1);
  assert.equal(p.busy(), true, "the send box is free while the job runs");
  await p.send(M2);
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "poll job-o"], "the second press reached the server");
  assert.deepEqual(p.asked(), [M1], "the second press was taken as a message");
  assert.equal(p.busy(), true, "the second press freed the send box");
  await p.answer("poll", stored(LOOKED));
  assertIdle(p, "after the job answered");
  await p.send(M3);
  assert.deepEqual(p.lines().slice(3), ["route: " + M3, "edit look: " + M3]);
  assertIdle(p, "after the third message");
});

test("the latch alone refuses a second ask on the site while a queued job runs, and releases nothing of the first", async () => {
  // THE SECOND WALL, driven on its own: the page's busy flag is what refuses a
  // second press, so this calls the real `siteEdit` directly — as a second ask
  // arriving while the first is watched would.
  const p = page({ answers: { route: [routeTo("look"), routeTo("look")], edit: [receipt("job-o"), ok(LOOKED)] } });
  await p.send(M1);
  assertHeld(p, "while the job runs");
  const ended = [];
  p.ctx.siteEdit(p.s, { layer: "look", cost: 2 }, M2, "origin-1", (t) => ended.push("finish: " + t), () => ended.push("fallback"), [], false);
  await settle();
  assert.deepEqual(p.lines(), ["route: " + M1, "edit look: " + M1, "poll job-o"], "the second ask posted while the first held the site");
  assert.deepEqual(ended, [], "the refused ask ended a message: " + JSON.stringify(ended));
  assertHeld(p, "after the second ask was refused");
  await p.answer("poll", stored(LOOKED));
  assert.deepEqual(p.said(), [LOOK]);
  assertIdle(p, "after the first ask's job answered");
  await p.send(M3);
  assert.deepEqual(p.lines().slice(3), ["route: " + M3, "edit look: " + M3]);
  assertIdle(p, "after the third message");
});

// ── AN OLD ASK'S LATE COMPLETION RELEASES NOTHING OF A NEWER ONE ───────────

test("the latch's own contract: only the ask holding a site releases it", () => {
  const ctx = vm.createContext({});
  vm.runInContext(LATCHES.join("\n"), ctx);
  const held = () => JSON.parse(vm.runInContext("JSON.stringify([...editInFlight.keys()])", ctx));
  const a = ctx.editAsk("fretwork-1");
  assert.ok(a && typeof a === "object", "no ask was handed out for a free site");
  assert.equal(ctx.editAsk("fretwork-1"), null, "a second ask took a site already held");
  assert.ok(ctx.editAsk("ashgrove-1"), "a different site was refused");
  ctx.editAskDone("fretwork-1", a);
  assert.deepEqual(held(), ["ashgrove-1"], "the holder's release did not free its site");
  const b = ctx.editAsk("fretwork-1");
  assert.ok(b && b !== a, "a newer ask was not handed a token of its own");
  ctx.editAskDone("fretwork-1", a);
  assert.deepEqual(held().sort(), ["ashgrove-1", "fretwork-1"], "an old ask's release freed a newer ask's site");
  ctx.editAskDone("fretwork-1", {});
  assert.deepEqual(held().sort(), ["ashgrove-1", "fretwork-1"], "a stranger's release freed a held site");
  ctx.editAskDone("fretwork-1", b);
  assert.deepEqual(held(), ["ashgrove-1"], "the newer ask's own release did not free its site");
});

test("an old ask's redraw failing after a newer ask took the site ends nothing of the newer one", async () => {
  // ⚠ RE-ANCHORED 2026-09-24, when the second finish this case recorded was
  // closed. A throw after message 1's sentence was out — here the redraw —
  // reached the POST's catch, which said the not-knowing sentence through the
  // same finish a second time: `[LOOK, UNREAD]`, the page's busy flag lowered
  // under message 2, and the latch the only wall left, so a third press paid
  // its routing call before the latch refused its edit. The latch held then
  // and holds now; what changed is that message 1 ends once
  // (`applyEditResult` keeps its own redraw failure, and each POST's finish
  // ends it once), so message 2 keeps the page's busy flag as well.
  //
  // Message 2 is started from INSIDE message 1's redraw, through the page's own
  // `siteSend`, so it sets the busy flag and takes the site the way any message
  // does — the one moment a newer ask can exist while the old one unwinds.
  let armed = true;
  const p = page({
    answers: { route: [routeTo("look"), routeTo("look")], edit: [ok(LOOKED)] },
    onRender: () => {
      const last = p.said().slice(-1)[0];
      if (!armed || last !== LOOK) return;
      armed = false;
      p.ctx.siteSend(M2);
      throw new Error("the redraw failed");
    },
  });
  await p.send(M1);
  const lines = ["route: " + M1, "edit look: " + M1, "route: " + M2, "edit look: " + M2];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["edit"]);
  assert.deepEqual(p.said(), [LOOK], "message 1 said more than its own sentence");
  assert.deepEqual(p.lock(), ["fretwork-1"], "message 1's end released the site message 2 holds");
  assert.equal(p.busy(), true, "message 1's end cleared message 2's busy flag");
  // A THIRD PRESS SENDS NOTHING AT ALL now — the busy flag is message 2's and
  // stays up — where it used to pay its routing call and meet the latch.
  await p.send(M3);
  assert.deepEqual(p.lines(), lines, "a third press reached the server while message 2 held the site");
  assert.deepEqual(p.asked(), [M1, M2], "the third press was taken as a message");
  assert.deepEqual(p.lock(), ["fretwork-1"]);
  await p.answer("edit", ok(LOOKED));
  assert.deepEqual(p.said(), [LOOK, LOOK]);
  assertIdle(p, "after message 2 answered");
});

// ── A RESUMED WATCH TAKES NO LATCH, AND LEAVES NONE ────────────────────────

test("CONTROL: a watch resumed after a refresh hops without taking the latch, and leaves the site free", async () => {
  const p = page({ answers: { poll: [stored(HOP)], route: [routeTo("look")] } });
  // A reload's view of a job this site filed: the ask rides the record.
  p.ctx.EditPoll.rememberJob("fretwork-1", "job-z", undefined, { ask: M1, op: "edit", layer: "data", page: "" });
  assert.equal(p.ctx.resumeOpenSite(p.s), true, "the resume did not start");
  await settle();
  const lines = ["poll job-z", "edit text: " + M1];
  assert.deepEqual(p.lines(), lines);
  assert.deepEqual(p.waiting(), ["edit"]);
  // THE RESUMED CHAIN NEVER TOOK THE LATCH — the page's busy flag is its wall,
  // as before — so a hop in it has none to leave behind.
  assert.deepEqual(p.lock(), [], "a resumed watch's hop latched the site");
  assert.equal(p.busy(), true);
  await p.answer("edit", ok(WORDED));
  assert.deepEqual(p.said(), [WORDING]);
  assertIdle(p, "after the resumed hop answered");
  p.script.edit = [ok(LOOKED)];
  await thenMessage2(p, { lines, said: [WORDING] });
});
