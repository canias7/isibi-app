// WHAT THE BROWSER DOES WHEN AN ADDITION'S OWN REQUEST GOES WRONG (2026-09-24).
//
// Reproduced first, through these same handlers on the deployed `chat.js`
// (sha256 98f883cf…): of 36 shapes, 25 posted `/api/site/react-revise` — the
// full rewrite of every page, a revise measured at 17 credits — and said
// nothing. A dropped or aborted add-on POST, a body that would not parse, a
// failing status with no sentence, a 401, a throw while showing a success (the
// rewrite started with "✅ Done" already on the thread), and every one of those
// again after an edit handed its ask to the add-on route. Two queued shapes
// hung instead: a stored reply that would not parse ended the watch in silence,
// and a throw while showing a stored success escaped as an unhandled rejection
// — in both the send box stayed busy for good.
//
// THE OWNER'S RULES (2026-09-24): "A transport failure, unreadable response,
// missing refusal sentence or client-side result-handler exception must never
// initiate another paid operation." Lost connection or an unusable response is
// an unknown outcome; an authoritative refusal is shown; an authentication
// failure asks for sign-in; a success followed by a display error keeps the
// known result and never describes the addition as failed. "An HTTP error alone
// does not establish that nothing changed or nothing was charged. Likewise,
// checking the preview cannot establish every backend addition's outcome."
//
// `siteSend` is cut out of public/chat.js and RUN, with the real `siteRoute`,
// `siteEdit`, `editAnswer`, `escalatedEdit`, `watchEditJob`, `siteAddon`, the
// add-on reader, `applyAddonResult`, both reply composers, `reactSend` and the
// real public/edit-poll.js — so the busy flag, the rail, its clock, the poll's
// two voices and the exactly-once latch are the page's own. `fetch` is the one
// seam: each request is recorded and answered from the case's script, and a
// request the script does not answer never settles — so a rewrite that STARTED
// is recorded as started, and nothing past it runs.
//
// KEPT AS THEY ARE, AND ASSERTED SO: a refusal carrying its own sentence, an
// escalate naming a layer (the hop to the edit route), a success, and the valid
// edit → add-on handoff. AND OUT OF SCOPE, ASSERTED AS IT IS: the add-on route's
// own escalate naming no layer still starts the rewrite. Which of those really
// need it is a separate, server-side step, so this file does not claim that
// every automatic rewrite is closed.
//
// AND A REPLY IS VALIDATED BEFORE IT IS TRUSTED (2026-09-24, the owner's second
// round, on 248e6aaa): a 503 carrying an escalate that names a layer posted a
// paid edit, `escalate: "false"` posted one too, and `ok: "false"` printed
// "✅ Done.". Every branch read its field by truthiness and none asked the
// status. `readAddonReply` is the one reading now — real booleans, a successful
// status for anything that acts, valid fields for the act — asked by the POST
// and by a job's final reply alike, and anything else is not knowing.
//
// Every answer here is SUPPLIED. This proves what the browser sends and says,
// never how often a real route answers these shapes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
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
  // THE REAL POLL MODULE, evaluated in the page's own realm: with no `module`
  // in scope it installs itself as the `EditPoll` global, as it does in a tab.
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
  "const editInFlight = new Set(); const editIdem = new Map(); const editBlocked = new Set(); const editWatched = new Set();",
  cut("function siteEdit("),
  cut("function unreadEditMsg("),
  cut("function wholeRequestNote("),
  cut("function editAnswer("),
  cut("function applyEditResult("),
  cut("function escalatedEdit("),
  cut("function watchEditJob("),
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function readAddonReply("),
  cut("function applyAddonResult("),
  cut("function addonOutcomeMsg("),
  cut("function sitePathOf("),
  // The success composers, whole, so a reply reads as a tab would print it.
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

// Which script answers a request, by what it is.
function kindOf(url, method) {
  const u = String(url);
  if (u === "/api/site/route") return "route";
  if (/^\/api\/site\/edit\//.test(u)) return method === "GET" ? "poll" : "cancel";
  if (/^\/api\/site\/[^/]+\/edit$/.test(u)) return "edit";
  if (/^\/api\/site\/[^/]+\/addon$/.test(u)) return "addon";
  if (/^\/api\/site\/react-(revise|build)$/.test(u)) return "rewrite";
  return "other";
}

/**
 * ONE MESSAGE THROUGH THE REAL SEND HANDLER. `answers` maps a request kind
 * (`route`, `edit`, `addon`, `poll`) to the responses it gets, in order —
 * `{reject}` or `{status, body, type, headers}`. `inject(ctx, site)` swaps a
 * page global after load, for the cases that make this page throw. Returns every
 * request after the routing call, the assistant messages, the busy flag, the
 * rail, its clock, and the site record afterwards.
 */
async function drive({ answers, inject, site = LIVE, message = ASK }) {
  const reqs = [];
  const events = [];
  const clock = { started: 0, cleared: 0 };
  const s = JSON.parse(JSON.stringify(site));
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
      if (!next) return new Promise(() => {});
      if (next.reject) return Promise.reject(next.reject);
      const headers = { "content-type": next.type || "application/json", ...(next.headers || {}) };
      return Promise.resolve(new Response(next.body, { status: next.status, headers }));
    },
    // The rail's clock, counted rather than scheduled.
    setInterval: () => { clock.started++; return { clock: clock.started }; },
    clearInterval: () => { clock.cleared++; },
    // The poll's backoff, taken at once: a delay here is waiting, not logic.
    setTimeout: (fn) => { setImmediate(fn); return {}; },
    clearTimeout: () => {},
    showAuthGate: () => events.push("sign-in gate"),
    scheduleCreditRefresh: () => events.push("credit refresh"),
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: "origin-1",
    renderSites: () => {},
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  if (inject) inject(ctx, s);
  ctx.siteSend(message);
  await settle();
  const msgs = JSON.parse(JSON.stringify(s.msgs));
  assert.deepEqual(msgs[0], { r: "u", t: message }, "the message itself is the first thing on the thread");
  assert.equal(reqs[0] && reqs[0].url, "/api/site/route", "the routing call went out first");
  return {
    after: reqs.slice(1),
    trail: reqs.slice(1).map((r) => r.method + " " + r.url),
    said: msgs.slice(1).map((m) => m.t),
    busy: ctx.siteBusy,
    railRunning: !!ctx.siteBuild,
    clock,
    ticker: ctx.siteTicker,
    events,
    pages: JSON.parse(JSON.stringify(s.pages)),
  };
}

const LIVE = { slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }] };
const ASK = "Add a QR code to the home page";
const json = (o) => JSON.stringify(o);
const ok = (o, status = 200) => ({ status, body: json(o) });
const FINAL = { "x-gf-edit": "final" };
const stored = (o, status = 200) => ({ status, body: json(o), headers: FINAL });
const CF_HTML = "<!DOCTYPE html><html><head><title>Worker threw exception | Cloudflare</title></head><body>Error 1101</body></html>";
const ROUTE_ADDON = ok({ ok: true, intent: "addon", cost: 2 });
const ROUTE_EDIT = ok({ ok: true, intent: "edit", layer: "look", cost: 2 });
// The edit route's own handoff, as `escalate("addon", { field, layer: "addon" })` writes it.
const HANDOFF = { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" };
const RECEIPT = ok({ ok: true, job: "job-a", status: "queued", poll: "/api/site/edit/job-a" }, 202);
const EDIT_RECEIPT = ok({ ok: true, job: "job-e", status: "queued", poll: "/api/site/edit/job-e" }, 202);
const SUCCESS = { ok: true, cost: 12, kinds: ["page"], added: ["gallery.tsx"], changed: ["index.tsx"] };
const DROPPED = { reject: new TypeError("Failed to fetch") };

const ADD = "/api/site/fretwork-1/addon";
const EDIT = "/api/site/fretwork-1/edit";
const REWRITE = "/api/site/react-revise";

// The four sentences, as the owner will read them (the wording is theirs to change).
const UNKNOWN = "⚠️ I didn’t get a usable answer about that addition, so I can’t tell whether it went through. Asking for it again could add it a second time.";
const UNSAID = "⚠️ That addition didn’t finish, and I wasn’t told why, so I can’t tell whether any part of it was added.";
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";
const SHOWN = "✅ That addition went through, but I couldn’t show the details of what it changed here.";
const DONE = "✅ Done — added /gallery, updated /.";

const throwing = (name) => (ctx) => { ctx[name] = () => { throw new TypeError("injected: " + name + " threw"); }; };
// A redraw that breaks only once there is a reply to draw: `siteSend` draws once
// before anything is sent, and that one must go through.
const redrawBreaksAfterReply = (ctx, s) => { ctx.renderSites = () => { if (s.msgs.some((m) => m.r === "a")) throw new TypeError("injected: the redraw threw"); }; };

// What every stop owes the customer: the requests it expected and not one more
// — no rewrite, no second add-on POST — one sentence, and the send box free.
function assertStopped(o, trail, sentence) {
  assert.deepEqual(o.trail, trail, "the requests after the routing call");
  assert.ok(!o.trail.some((t) => t.endsWith(REWRITE) || t.endsWith("/api/site/react-build")), "a rewrite was started");
  assert.equal(o.trail.filter((t) => t === "POST " + ADD).length, 1, "the add-on was posted exactly once");
  assert.deepEqual(o.said, [sentence], "the customer is told, in one sentence");
  assert.equal(o.busy, false, "the busy flag is cleared, so the next message can be sent");
  assert.equal(o.railRunning, false, "the rail is stopped");
  assert.equal(o.clock.started, 1, "the rail's clock started when the message was sent");
  assert.equal(o.clock.cleared, 1, "and was cleared when it stopped");
  assert.equal(o.ticker, null, "no clock left behind");
}

// ── THE ADD-ON'S OWN POST, ANSWERED STRAIGHT BACK ────────────────────────────
const DIRECT = [
  // Nothing came back that can be used: not knowing.
  ["the POST is dropped", DROPPED, UNKNOWN],
  ["the POST is aborted", { reject: Object.assign(new Error("The operation was aborted."), { name: "AbortError" }) }, UNKNOWN],
  ["a 200 carrying HTML", { status: 200, body: CF_HTML, type: "text/html" }, UNKNOWN],
  ["a 200 carrying truncated JSON", { status: 200, body: '{"ok":true,"kin' }, UNKNOWN],
  ["a 200 with an empty body", { status: 200, body: "" }, UNKNOWN],
  ["a 500 carrying Cloudflare's HTML (the Worker threw)", { status: 500, body: CF_HTML, type: "text/html" }, UNKNOWN],
  ["a 200 carrying a list", { status: 200, body: "[]" }, UNKNOWN],
  // A failing status over a body that does not say `ok: false` says less still.
  ["the owner check's 404, answered raw", ok({ error: "no such site" }, 404), UNKNOWN],
  ["the owner check's 503, answered raw", ok({ error: "couldn't check that site just now — try again in a moment" }, 503), UNKNOWN],
  // The route said it did not finish, and not why.
  ["a 503 from the queue, with no sentence", ok({ ok: false, error: "queue", kind: "enqueue" }, 503), UNSAID],
  ["a 429 with no sentence", ok({ ok: false, error: "rate limited" }, 429), UNSAID],
  ["a 501 with no sentence", ok({ ok: false, error: "storage not configured" }, 501), UNSAID],
  ["a 200 {ok:false} with no sentence", ok({ ok: false, error: "x" }), UNSAID],
  ["a refusal whose sentence is blank", ok({ ok: false, error: "x", msg: "   " }, 422), UNSAID],
  // `String({...})` is "[object Object]": a sentence that is not a string is none.
  ["a refusal whose sentence is not a string", ok({ ok: false, error: "x", msg: { text: "no" } }, 422), UNSAID],
];
for (const [what, answer, sentence] of DIRECT) {
  test("AN ADD-ON STOPS: " + what + " starts nothing more and says so", async () => {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [answer] } });
    assertStopped(o, ["POST " + ADD], sentence);
  });
}

test("AN ADD-ON STOPS: a 401 asks for sign-in, beside the gate, and starts nothing more", async () => {
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok({ error: "sign in required" }, 401)] } });
  assertStopped(o, ["POST " + ADD], SIGNED_OUT);
  assert.ok(o.events.includes("sign-in gate"), "the sign-in gate is up");
  // AND THE STATUS DECIDES, NOT THE BODY: a 401 that cannot be read is the same.
  const html = await drive({ answers: { route: [ROUTE_ADDON], addon: [{ status: 401, body: "<html>401</html>", type: "text/html" }] } });
  assertStopped(html, ["POST " + ADD], SIGNED_OUT);
});

test("THE NOT-KNOWING SENTENCES CLAIM NOTHING THEY CANNOT KNOW", () => {
  // Nothing about the site or the money — an error alone establishes neither —
  // and nothing about the preview, which cannot show a table, a saved function
  // or a schedule.
  for (const s of [UNKNOWN, UNSAID]) {
    assert.doesNotMatch(s, /untouched|nothing (on your site )?changed|refund|charg|cost|free|preview/i, s);
  }
  // …and the success that could not be shown is never called a failure.
  assert.match(SHOWN, /^✅ That addition went through/);
  assert.doesNotMatch(SHOWN, /didn’t|failed|can’t tell whether/, SHOWN);
});

// ── A SUCCESS THIS PAGE THEN FAILS TO SHOW ───────────────────────────────────
test("A SUCCESS KEPT: the composer throws after a successful addition — the known result is said, nothing more is posted", async () => {
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok(SUCCESS)] }, inject: throwing("addonReplyText") });
  assertStopped(o, ["POST " + ADD], SHOWN);
  // What was recorded before the throw is kept: the new page reached the picker.
  assert.ok(o.pages.some((p) => p.path === "/gallery"), "the addition's new page was dropped from the picker");
});

test("A SUCCESS KEPT: the redraw throws after the success sentence is out — it stands alone, and nothing more is posted", async () => {
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok(SUCCESS)] }, inject: redrawBreaksAfterReply });
  // Measured before the fix: this one said "✅ Done" AND started the rewrite.
  assertStopped(o, ["POST " + ADD], DONE);
});

test("A REFUSAL KEPT: the redraw throws after the route's own sentence is out — nothing is said over it, and nothing is posted", async () => {
  // The POST's catch speaks only when nothing has been said. Without that, the
  // throw from this redraw reached it and a second sentence — "I didn't get a
  // usable answer" — contradicted the refusal already on the thread.
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok({ ok: false, error: "add", cost: 0, msg: "I can't add that." }, 422)] }, inject: redrawBreaksAfterReply });
  assertStopped(o, ["POST " + ADD], "⚠️ I can't add that.");
});

// ── THE EDIT ROUTE HANDS ITS ASK TO THE ADD-ON ROUTE ─────────────────────────
const HANDOFFS = [
  ["its add-on POST is dropped", DROPPED, UNKNOWN],
  ["its add-on answers 503 with no sentence", ok({ ok: false, error: "queue", kind: "enqueue" }, 503), UNSAID],
  ["its add-on answer cannot be read", { status: 200, body: "<html>oops</html>", type: "text/html" }, UNKNOWN],
  ["its add-on answers 401", ok({ error: "sign in required" }, 401), SIGNED_OUT],
];
for (const [what, answer, sentence] of HANDOFFS) {
  test("A HANDOFF STOPS: an edit handed to the add-on, and " + what + " — nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [ok(HANDOFF)], addon: [answer] } });
    assertStopped(o, ["POST " + EDIT, "POST " + ADD], sentence);
    assert.equal(o.after[1].body.instruction, ASK, "the add-on was not asked in the customer's own words");
  });
}

test("A HANDOFF KEEPS A SUCCESS: the composer throws after the handed-off addition went through", async () => {
  const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [ok(HANDOFF)], addon: [ok(SUCCESS)] }, inject: throwing("addonReplyText") });
  assertStopped(o, ["POST " + EDIT, "POST " + ADD], SHOWN);
});

test("A HANDOFF STOPS: a queued edit's stored answer hands over, and the add-on POST is dropped", async () => {
  const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [EDIT_RECEIPT], poll: [stored(HANDOFF)], addon: [DROPPED] } });
  assertStopped(o, ["POST " + EDIT, "GET /api/site/edit/job-e", "POST " + ADD], UNKNOWN);
});

test("A HANDOFF STOPS: a queued edit hands over, the add-on is queued too, and its stored reply has no sentence", async () => {
  const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [EDIT_RECEIPT], poll: [stored(HANDOFF), stored({ ok: false, error: "x" }, 503)], addon: [RECEIPT] } });
  assertStopped(o, ["POST " + EDIT, "GET /api/site/edit/job-e", "POST " + ADD, "GET /api/site/edit/job-a"], UNSAID);
});

// ── A QUEUED ADDITION'S STORED REPLY ─────────────────────────────────────────
const QUEUED = [
  ["a stored 503 with no sentence", stored({ ok: false, error: "x" }, 503), UNSAID],
  ["a stored 200 {ok:false} with no sentence", stored({ ok: false }), UNSAID],
  // Measured before the fix: the watch took this, ended in silence, and the
  // send box stayed busy for good.
  ["a stored reply that cannot be read", { status: 200, body: "{oops", headers: FINAL }, UNKNOWN],
];
for (const [what, answer, sentence] of QUEUED) {
  test("A QUEUED ADD-ON STOPS: " + what + " — nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [answer] } });
    assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], sentence);
  });
}

test("A QUEUED SUCCESS KEPT: the composer throws on a stored success — said, where it escaped and left the box busy", async () => {
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [stored(SUCCESS)] }, inject: throwing("addonReplyText") });
  assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], SHOWN);
});

test("A QUEUED SUCCESS KEPT: the redraw throws after a stored success is said — it stands alone", async () => {
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [stored(SUCCESS)] }, inject: redrawBreaksAfterReply });
  assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], DONE);
});

// THE WATCHER IS SHARED, so the latch's fix reaches the edit's own jobs too: a
// stored edit reply that cannot be read is said in the edit's own sentence,
// where the watch ended in silence and left the box busy for good.
test("THE SHARED WATCHER: a queued EDIT whose stored reply cannot be read says so, and starts nothing", async () => {
  const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [EDIT_RECEIPT], poll: [{ status: 200, body: "{oops", headers: FINAL }] } });
  assert.deepEqual(o.trail, ["POST " + EDIT, "GET /api/site/edit/job-e"]);
  assert.deepEqual(o.said, ["⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Check the preview before asking for it again."]);
  assert.equal(o.busy, false);
  assert.equal(o.railRunning, false);
  assert.equal(o.clock.cleared, 1);
});

// ── A REPLY THAT CANNOT BE TRUSTED WITH WHAT IT CLAIMS ───────────────────────
//
// The owner, on 248e6aaa (2026-09-24): "Validate the response before treating
// it as authority for success, a queued receipt or another paid action. Require
// real booleans, a successful HTTP status for actionable responses, and valid
// fields for the action. Invalid or contradictory replies must stop with
// uncertainty. Apply the same rules to direct and queued final replies."
//
// THE THREE REPRODUCTIONS, measured on 248e6aaa straight back AND as a queued
// job's stored reply: the escalate at a 503 posted a paid edit, `escalate:
// "false"` posted one too, and `ok: "false"` printed "✅ Done.".
const THE_THREE = [
  ["a 503 carrying an escalate that names a layer", { ok: false, escalate: true, layer: "picture" }, 503],
  ["an escalate spelled as the string \"false\"", { ok: false, escalate: "false", layer: "picture" }, 200],
  ["ok spelled as the string \"false\"", { ok: "false" }, 200],
];
// …AND THE REST OF THE SAME CLASS, each measured acting or printing done on
// 248e6aaa: a paid edit, the rewrite, or "✅ Done." over nothing.
const MALFORMED = [
  ["an escalate spelled as a number", { ok: false, escalate: 1, layer: "picture" }, 200],
  ["an escalate beside ok: true", { ok: true, escalate: true, layer: "picture" }, 200],
  ["an escalate with no ok at all", { escalate: true, layer: "picture" }, 200],
  ["an escalate naming a layer the edit route does not have", { ok: false, escalate: true, layer: "colour" }, 200],
  ["an escalate naming its layer as a list", { ok: false, escalate: true, layer: ["picture"] }, 200],
  ["an escalate naming the add-on route itself", { ok: false, escalate: true, layer: "addon" }, 200],
  ["an escalate naming an empty layer", { ok: false, escalate: true, layer: "" }, 200],
  ["an escalate whose layer is null — never written, so not no layer", { ok: false, escalate: true, layer: null }, 200],
  ["an escalate whose page is not a string", { ok: false, escalate: true, layer: "picture", page: {} }, 200],
  ["an escalate naming no layer, at a 503", { ok: false, escalate: true, reason: "no-source", cost: 0 }, 503],
  ["an escalate naming no layer, with ok spelled as a string", { ok: "false", escalate: true, reason: "no-source" }, 200],
  ["an escalate spelled as the string \"true\" on a success", { ...SUCCESS, escalate: "true" }, 200],
  ["ok spelled as the string \"true\"", { ...SUCCESS, ok: "true" }, 200],
  ["ok spelled as a number", { ...SUCCESS, ok: 1 }, 200],
  // With no sentence this one was already a stop after the round before; with
  // one, 248e6aaa printed the success's own words under a warning sign.
  ["a success at a failing status, carrying a sentence", { ...SUCCESS, msg: "Added the gallery." }, 422],
];
for (const [what, body, status] of [...THE_THREE, ...MALFORMED]) {
  test("AN UNTRUSTED REPLY STOPS: " + what + " (" + status + ") — straight back, nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok(body, status)] } });
    assertStopped(o, ["POST " + ADD], UNKNOWN);
  });
  test("AN UNTRUSTED REPLY STOPS: " + what + " (" + status + ") — as a queued job's stored reply, nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [stored(body, status)] } });
    assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], UNKNOWN);
  });
}
// THE SAME READER WHICHEVER WAY THE ADD-ON WAS REACHED: an edit that handed its
// ask over, and the add-on answering one of the three.
for (const [what, body, status] of THE_THREE) {
  test("AN UNTRUSTED REPLY STOPS: an edit handed to the add-on, and " + what + " (" + status + ") — nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [ok(HANDOFF)], addon: [ok(body, status)] } });
    assertStopped(o, ["POST " + EDIT, "POST " + ADD], UNKNOWN);
  });
}

// A RECEIPT IS TAKEN ONLY WHEN IT IS ONE. Each of these was watched, polled
// under a job id nobody filed, or printed "✅ Done." on 248e6aaa.
const BAD_RECEIPTS = [
  ["ok spelled as the string \"true\"", { ok: "true", job: "job-a", status: "queued" }, 202],
  ["a job id that is a number", { ok: true, job: 7, status: "queued" }, 202],
  ["an empty job id", { ok: true, job: "", status: "queued" }, 202],
  ["a receipt at a 503", { ok: true, job: "job-a", status: "queued" }, 503],
  ["a receipt that also carries a result", { ok: true, job: "job-a", status: "queued", result: { ok: true } }, 200],
];
for (const [what, body, status] of BAD_RECEIPTS) {
  test("A RECEIPT THAT IS NOT ONE STOPS: " + what + " (" + status + ") — nothing is watched and nothing more is posted", async () => {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok(body, status)], poll: [stored(SUCCESS)] } });
    assertStopped(o, ["POST " + ADD], UNKNOWN);
  });
}
test("A RECEIPT THAT IS NOT ONE STOPS: a job's own stored reply shaped as a receipt is not watched a second time", async () => {
  // A job's final reply is the route's outcome; it is never "your job is
  // queued". Read as a success it printed "✅ Done." over a job it named.
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [stored({ ok: true, job: "job-z", status: "queued", poll: "/api/site/edit/job-z" }, 202), stored(SUCCESS)] } });
  assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], UNKNOWN);
});

// ── KEPT AS THEY ARE ─────────────────────────────────────────────────────────
test("CONTROL: a receipt the route really writes is watched — the 202, and the 200 for an ask already filed", async () => {
  const duplicate = ok({ ok: true, job: "job-a", status: "queued", duplicate: true, poll: "/api/site/edit/job-a" }, 200);
  for (const receipt of [RECEIPT, duplicate]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [receipt], poll: [stored(SUCCESS)] } });
    assert.deepEqual(o.trail, ["POST " + ADD, "GET /api/site/edit/job-a"]);
    assert.deepEqual(o.said, [DONE]);
    assert.equal(o.busy, false);
    assert.equal(o.railRunning, false);
  }
});

test("CONTROL: the sweep's recovered reply carries a job and is still a success, said in its own words", async () => {
  // `edit_sweep_lost` and the reconciler store `{ok:true, recovered:true, job,
  // cost, build}` — a job id on a FINAL reply, and not a receipt.
  const recovered = { ok: true, recovered: true, job: "job-a", cost: 12, build: "b1" };
  const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [RECEIPT], poll: [stored(recovered)] } });
  assertStopped(o, ["POST " + ADD, "GET /api/site/edit/job-a"], "✅ Your change was published — but the details of what it did were lost along the way. Reload the preview to see it.");
});

test("CONTROL: escalate: false is a real boolean — a refusal is shown and a success applied, and neither hops", async () => {
  for (const [body, status, said] of [
    [{ ok: false, escalate: false, error: "add", msg: "I can't add that." }, 422, "⚠️ I can't add that."],
    [{ ok: false, escalate: false, layer: "picture", error: "add", msg: "I can't add that." }, 200, "⚠️ I can't add that."],
    [{ ok: false, escalate: false, error: "x" }, 503, UNSAID],
  ]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok(body, status)] } });
    assertStopped(o, ["POST " + ADD], said);
  }
  const won = await drive({ answers: { route: [ROUTE_ADDON], addon: [ok({ ...SUCCESS, escalate: false })] } });
  assertStopped(won, ["POST " + ADD], DONE);
});

test("CONTROL: a hop naming a page carries that page to the edit route, straight back and queued", async () => {
  const hop = { ok: false, escalate: true, reason: "layer", layer: "picture", kind: "photo", cost: 0, page: "/prices" };
  for (const [answers, before] of [
    [{ addon: [ok(hop)] }, ["POST " + ADD]],
    [{ addon: [RECEIPT], poll: [stored(hop)] }, ["POST " + ADD, "GET /api/site/edit/job-a"]],
  ]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], ...answers } });
    assert.deepEqual(o.trail, [...before, "POST " + EDIT]);
    const edit = o.after[o.after.length - 1].body;
    assert.equal(edit.layer, "picture");
    assert.equal(edit.page, "/prices");
    assert.equal(edit.instruction, ASK);
  }
});

test("CONTROL: a successful addition is said and applied, straight back and queued", async () => {
  for (const answers of [{ addon: [ok(SUCCESS)] }, { addon: [RECEIPT], poll: [stored(SUCCESS)] }]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], ...answers } });
    assert.deepEqual(o.said, [DONE]);
    assert.ok(o.pages.some((p) => p.path === "/gallery"), "the new page did not reach the picker");
    assert.ok(!o.trail.some((t) => t.endsWith(REWRITE)));
    assert.equal(o.busy, false);
    assert.equal(o.railRunning, false);
  }
});

test("CONTROL: a refusal carrying its own sentence shows that sentence, straight back and queued", async () => {
  const refusal = { ok: false, error: "add", cost: 0, msg: "I can't add that." };
  for (const answers of [{ addon: [ok(refusal, 422)] }, { addon: [RECEIPT], poll: [stored(refusal, 422)] }]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], ...answers } });
    assert.deepEqual(o.said, ["⚠️ I can't add that."]);
    assert.ok(!o.trail.some((t) => t.endsWith(REWRITE)));
    assert.equal(o.busy, false);
  }
});

test("CONTROL: an escalate naming a layer still hops to the edit route once, with the same ask, straight back and queued", async () => {
  const hop = { ok: false, escalate: true, reason: "layer", layer: "picture", kind: "photo", cost: 0 };
  for (const [answers, before] of [
    [{ addon: [ok(hop)] }, ["POST " + ADD]],
    [{ addon: [RECEIPT], poll: [stored(hop)] }, ["POST " + ADD, "GET /api/site/edit/job-a"]],
  ]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], ...answers } });
    assert.deepEqual(o.trail, [...before, "POST " + EDIT], "the hop is one edit POST after the add-on");
    const edit = o.after[o.after.length - 1].body;
    assert.equal(edit.layer, "picture");
    assert.equal(edit.instruction, ASK);
    assert.equal(o.busy, true, "the hop is still working");
  }
});

test("CONTROL: the valid edit → add-on handoff still posts the add-on once, in the customer's own words", async () => {
  const o = await drive({ answers: { route: [ROUTE_EDIT], edit: [ok(HANDOFF)], addon: [ok(SUCCESS)] } });
  assert.deepEqual(o.trail, ["POST " + EDIT, "POST " + ADD]);
  assert.equal(o.after[1].body.instruction, ASK);
  assert.deepEqual(o.said, [DONE]);
  assert.equal(o.busy, false);
});

// ── OUT OF SCOPE, ASSERTED AS IT IS ──────────────────────────────────────────
// The add-on route's own escalates carry no layer, and each still starts the
// rewrite: the server's explicit climb, not something this page failed to read.
// Classifying them is the separate server-side step — until then this is the
// one way from an addition to the rewrite, and this case is its record.
test("NOT CHANGED HERE: the add-on route's own escalate naming no layer still starts the rewrite, straight back and queued", async () => {
  const climb = { ok: false, escalate: true, reason: "no-source", cost: 0 };
  for (const [answers, before] of [
    [{ addon: [ok(climb)] }, ["POST " + ADD]],
    [{ addon: [RECEIPT], poll: [stored(climb)] }, ["POST " + ADD, "GET /api/site/edit/job-a"]],
  ]) {
    const o = await drive({ answers: { route: [ROUTE_ADDON], ...answers } });
    assert.deepEqual(o.trail, [...before, "POST " + REWRITE]);
    assert.equal(o.after[o.after.length - 1].body.instruction, ASK);
    assert.deepEqual(o.said, []);
  }
});
