// A HAND-OVER CARRIES WHERE IT GOES, NEVER THE FIRST ANSWER'S OPERATIONS
// (2026-10-02, the whole-router audit's W1).
//
// `remove`, `rename` and `tab` are the router's verbs for the step it chose,
// and one verb means a different thing on each step: `remove` on `picture`
// takes a photograph off, on `nav` takes an item out of the menu, on `page`
// deletes the whole page. Every browser hop copied the first answer whole and
// replaced only its layer and page, so:
//
//   * a photograph's removal the picture step handed to the page step
//     (`needs-place`) was posted as `{layer: "page", remove: true}` — a request
//     to delete the page the photograph was on (audit §4, free check W1);
//   * an addition the add-on handed to the menu editor (`frame`) still carried
//     an earlier edit's `remove: true`, which opens the removal door — so a new
//     menu link would be read as a menu removal.
//
// REPRODUCED FIRST through these handlers on 5ce037a0: the second POST carried
// `remove: true` in both chains.
//
// THE FIX, BOTH HALVES: the browser builds every hand-over from the
// destination's own fields and the ask's context (`EditPoll.handOver`) and
// marks it `handedOff: true`; the edit route ignores the router's verbs on a
// request so marked (test/handover-route.test.mjs drives that half).
//
// `siteSend` is cut out of public/chat.js and RUN with the real `siteRoute`,
// `siteEdit`, `editAnswer`, `escalatedEdit`, `watchEditJob`, `siteAddon`,
// `addonAnswer`, the readers, both composers and the real public/edit-poll.js.
// `fetch` is the one seam: every request is recorded with its body and answered
// from the case's script. Every answer is SUPPLIED, in the shape its real
// producer writes (the route's `escalate()` and the add-on's `addonFailure`),
// so this proves what the browser posts, never how often a route answers so.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { addonFailure } from "../builder/site-addon.mjs";
import { ASK_FNS, ASK_LINES } from "./fixtures/browser-ask.mjs";

const require = createRequire(import.meta.url);
const P = require("../public/edit-poll.js");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const POLL = readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");

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
  // A SITE'S TABLE LIST, IN ORDER (2026-10-05): the clock every routing call
  // and addition is put in order by, and the two that keep the list by it.
  cutLine("const siteTablesOrder ="),
  cut("function siteTablesAdd("),
  cut("function siteTablesRead("),
  cut("function siteHoldUnsent("),
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
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function readRouteReply("),
  // A QUESTION ON A SITE THAT EXISTS (2026-10-02): the block the cut functions
  // now reach — its readers, the card's state and the files kept beside it.
  ...ASK_FNS.map((n) => cut("function " + n + "(")),
  ...ASK_LINES.map(cutLine),
  cut("function readAddonReply("),
  cut("function readEditReply("),
  cut("function applyAddonResult("),
  cut("function addonOutcomeMsg("),
  // WHETHER A FAILURE'S NOTE IS SHOWN (2026-10-06): only beside its outcome.
  cut("function failureOutcomeOf("),
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

/** One page with the real handlers, `fetch` answered from `answers` (kind → responses, in order). */
function page(answers) {
  const reqs = [];
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
      // A REQUEST NO CASE ANSWERED IS REFUSED OUT LOUD, never held: every case
      // here runs to its end, and a request it did not expect fails it below.
      if (!next) return Promise.resolve(new Response(JSON.stringify({ ok: false, error: "unscripted" }), { status: 500, headers: { "content-type": "application/json" } }));
      // A DROPPED CONNECTION (2026-10-02): the request never answered.
      if (next.reject) return Promise.reject(next.reject);
      return Promise.resolve(new Response(next.body, { status: next.status, headers: { "content-type": "application/json", ...(next.headers || {}) } }));
    },
    setInterval: () => ({}), clearInterval: () => {},
    setTimeout: (fn) => { setImmediate(fn); return {}; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: "origin-1",
    renderSites: () => {}, paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  return {
    async send(message) { ctx.siteSend(message); await settle(); },
    reqs,
    edits() { return reqs.filter((r) => r.kind === "edit").map((r) => r.body); },
    kinds() { return reqs.map((r) => r.kind); },
    said() { return s.msgs.filter((m) => m.r === "a").map((m) => m.t); },
    busy() { return ctx.siteBusy; },
  };
}

const SITE = { id: "origin-1", slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }] };
const json = (o) => JSON.stringify(o);
const ok = (o, status = 200) => ({ status, body: json(o) });
const stored = (o, status = 200) => ({ status, body: json(o), headers: { "x-gf-edit": "final" } });
const receipt = (job) => ok({ ok: true, job, status: "queued", poll: "/api/site/edit/" + job }, 202);
const route = (answer) => ok({ ok: true, cost: 2, ...answer });

// THE REAL PRODUCERS' SHAPES. `NEEDS_PLACE` is the picture rung's hand-over
// (worker.js `escalate("needs-place", { layer, page })`); `TO_ADDON` the look
// door's `picker/addon`; `FRAME_HOP` the add-on's `addonFailure("layer",
// { layer: "nav", kind: "frame" })`; `TO_TEXT` the data rung's `no-data`.
const NEEDS_PLACE = { ok: false, escalate: true, reason: "needs-place", cost: 0, layer: "page", page: "/gear" };
const TO_ADDON = { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" };
const FRAME_HOP = { ok: false, escalate: true, reason: "layer", cost: 0, layer: "nav", kind: "frame" };
const TO_TEXT = { ok: false, escalate: true, reason: "no-data", cost: 0, layer: "text" };
const PAGE_DONE = { ok: true, layer: "page", page: "/gear", cost: 3, pageOps: [{ page: "/gear" }] };
const NAV_DONE = { ok: true, layer: "nav", cost: 2, changed: ["index.tsx", "prices.tsx", "gear.tsx"], links: 4, dropped: 0 };
const TEXT_REFUSED = { ok: false, error: "no-match", cost: 0, unchanged: true, msg: "I couldn't find those words on your site." };

/** The verbs a hand-over must never carry, read off one posted body. */
function assertNoVerbs(body, label) {
  assert.equal(body.remove, false, label + ": the hand-over carried the first answer's removal");
  assert.equal(body.rename, "", label + ": the hand-over carried the first answer's move");
  assert.equal(body.tab, false, label + ": the hand-over carried the first answer's favicon slot");
  assert.equal(body.handedOff, true, label + ": the hand-over was not marked as one");
}

// ── THE HELPER ITSELF: what it keeps, what it drops, and nothing coerced ────

test("handOver keeps where it goes and the ask's context, and drops every verb of the first answer", () => {
  const first = { ok: true, intent: "edit", layer: "picture", page: "/about", remove: true, rename: "/x", tab: true,
    alsoAsked: "and add a map", cost: 2, decision: { source: "model" }, answer: "", fromAddon: false };
  assert.deepEqual(P.handOver(first, { layer: "page", page: "/gear" }),
    { layer: "page", page: "/gear", alsoAsked: "and add a map", cost: 2 });
  // NO PAGE ON THE ESCALATE: the ask's own page, a scope the destination checks.
  assert.deepEqual(P.handOver(first, { layer: "text", page: "" }),
    { layer: "text", page: "/about", alsoAsked: "and add a map", cost: 2 });
  assert.deepEqual(P.handOver({ layer: "data", cost: 1 }, { layer: "text" }), { layer: "text", cost: 1 });
  // THE ADD-ON'S BOUND, set by the hop or inherited from an earlier one.
  assert.deepEqual(P.handOver({ layer: "nav" }, { layer: "nav", fromAddon: true }), { layer: "nav", fromAddon: true });
  assert.deepEqual(P.handOver({ fromAddon: true }, { layer: "nav" }), { layer: "nav", fromAddon: true });
});

test("handOver coerces nothing: a field of the wrong type is left out", () => {
  const out = P.handOver({ page: ["/gear"], cost: "2", fromAddon: "true", remove: "true" }, { layer: ["page"], page: 7, fromAddon: 1 });
  assert.deepEqual(out, { layer: "" });
  // THE PARTS PUT OFF ARE THE ONE EXCEPTION, AND IT IS NOT A COERCION
  // (2026-10-02): a list of parts is their own shape now (one part goes in the
  // wire's one-part shape, a string), and a value that does not read is passed
  // on AS IT CAME — dropping it would read it as none, and the step reached
  // would run the parts promised for later; passed on, its route refuses it.
  assert.deepEqual(P.handOver({ alsoAsked: ["x"] }, { layer: "text" }), { layer: "text", alsoAsked: "x" });
  assert.deepEqual(P.handOver({ alsoAsked: ["x", "y"] }, { layer: "text" }), { layer: "text", alsoAsked: ["x", "y"] });
  assert.deepEqual(P.handOver({ alsoAsked: ["x", 5] }, { layer: "text" }), { layer: "text", alsoAsked: ["x", 5] });
  assert.deepEqual(P.handOver({ alsoAsked: 5 }, { layer: "text" }), { layer: "text", alsoAsked: 5 });
  // AND WHY IT MOVED: short strings only, never coerced.
  assert.deepEqual(P.handOver({}, { layer: "text" }, { from: ["look"], reply: { reason: 7, field: { f: 1 } } }), { layer: "text" });
  assert.deepEqual(P.handOver({}, { layer: "text" }, { from: "x".repeat(65), reply: { reason: "addon" } }), { layer: "text", handOver: { reason: "addon" } });
  assert.deepEqual(P.handOver(null, null), { layer: "" });
  assert.deepEqual(P.handOver([], []), { layer: "" });
  assert.deepEqual(P.handOver({ cost: Infinity }, { layer: "text" }), { layer: "text" });
});

// ── THE TWO CHAINS THE AUDIT FOUND, THROUGH THE REAL SEND HANDLER ────────────

for (const queued of [false, true]) {
  const how = queued ? "queued" : "direct";
  test("W1 — a photograph's removal the picture step hands to the page step posts NO removal (" + how + ")", async () => {
    const M = "Take the photo off the gear page.";
    const first = queued ? [receipt("job-p")] : [ok(NEEDS_PLACE)];
    const p = page({
      route: [route({ intent: "edit", layer: "picture", remove: true })],
      edit: [...first, ok(PAGE_DONE)],
      ...(queued ? { poll: [stored(NEEDS_PLACE)] } : {}),
    });
    await p.send(M);
    const edits = p.edits();
    assert.equal(edits.length, 2, how + ": the hand-over was not posted: " + JSON.stringify(p.kinds()));
    // THE ROUTER'S OWN STEP STILL CARRIES THE ROUTER'S VERB.
    assert.equal(edits[0].layer, "picture");
    assert.equal(edits[0].remove, true, how + ": the router's own step lost its removal");
    assert.equal(edits[0].handedOff, undefined, how + ": the router's own step was marked as a hand-over");
    // THE HAND-OVER: the page step, the escalate's page, the customer's words —
    // and no verb. Before the fix this was `remove: true`: delete /gear.
    assert.equal(edits[1].layer, "page");
    assert.equal(edits[1].page, "/gear");
    assert.equal(edits[1].instruction, M);
    assertNoVerbs(edits[1], how);
    assert.deepEqual(p.said(), ["✅ Updated /gear."], how + ": the customer's sentence");
    assert.equal(p.busy(), false, how + ": the page was left busy");
  });

  test("W1 — an addition the add-on hands to the menu editor carries no earlier edit's removal (" + how + ")", async () => {
    const M = "Take Gallery out of the menu and put a Lessons link in it.";
    const first = queued ? [receipt("job-n")] : [ok(TO_ADDON)];
    const p = page({
      route: [route({ intent: "edit", layer: "nav", remove: true })],
      edit: [...first, ok(NAV_DONE)],
      addon: [ok(FRAME_HOP)],
      ...(queued ? { poll: [stored(TO_ADDON)] } : {}),
    });
    await p.send(M);
    assert.deepEqual(p.kinds().filter((k) => k !== "poll"), ["route", "edit", "addon", "edit"], how + ": the chain changed");
    const edits = p.edits();
    assert.equal(edits[0].remove, true, how + ": the router's own step lost its removal");
    assert.equal(edits[1].layer, "nav");
    assert.equal(edits[1].addition, true, how + ": the add-on's hand-over was not posted as an addition");
    // Before the fix this carried `remove: true` beside `addition: true`, and
    // on the menu layer the route opens its removal door for that flag.
    assertNoVerbs(edits[1], how);
    assert.equal(p.busy(), false, how + ": the page was left busy");
  });
}

// ── WHAT A HAND-OVER MUST STILL CARRY ────────────────────────────────────────

test("a hand-over still carries what the router held back, so the route takes it out again", async () => {
  const M = "Change Rock School to Rock Club on the prices page and add a map to the gear page.";
  const held = "add a map to the gear page";
  const p = page({ route: [route({ intent: "edit", layer: "data", alsoAsked: held })], edit: [ok(TO_TEXT), ok(TEXT_REFUSED)] });
  await p.send(M);
  const edits = p.edits();
  assert.equal(edits.length, 2);
  assert.equal(edits[0].alsoAsked, held);
  assert.equal(edits[1].layer, "text");
  assert.equal(edits[1].alsoAsked, held, "the hand-over dropped the held-back part, so the text step would run it now");
  assertNoVerbs(edits[1], "data → text");
  // AND WHAT READING THE MESSAGE COST, which the refusal's sentence states.
  assert.equal(p.said().length, 1);
  assert.match(p.said()[0], /Reading your message cost 2 credits\./, "the routing call's cost was lost in the hand-over");
});

test("CONTROL: a removal the router routed straight to the page step is still posted as one", async () => {
  const p = page({ route: [route({ intent: "edit", layer: "page", page: "/gear", remove: true })], edit: [ok({ ok: true, layer: "page", page: "/gear", removed: ["gear.tsx"], cost: 0, pageOps: [{ page: "/gear", removed: ["gear.tsx"] }] })] });
  await p.send("We don't need the gear page any more.");
  const edits = p.edits();
  assert.equal(edits.length, 1);
  assert.equal(edits[0].layer, "page");
  assert.equal(edits[0].remove, true, "the router's own page removal was dropped");
  assert.equal(edits[0].handedOff, undefined, "a first step was marked as a hand-over");
});

// ── BATCH 2: ONE HAND-OVER CONTRACT, AND EVERY ENDING NAMES WHAT WAS PUT OFF ──
//
// (2026-10-02, the whole-router audit's W7, W8 and W24, the browser's half.)
// Wherever the request moves the browser posts the same three things: the
// parts put off (`alsoAsked` — what the step it leaves said it put off, or what
// was posted to it), and why and where (`handOver`: the step it left, the
// escalate's reason and field, the page). The routes check every field; the
// browser carries them and never decides. And the customer hears about the
// parts put off however the turn ends: from the reply's own `deferred` when the
// reply can be read, from what was posted when it cannot.
const posts = (p, kind) => p.reqs.filter((r) => r.kind === kind).map((r) => r.body);
const LATER = "add a booking form";
const LEFT = (words) => "\nI left “" + words + "” for later, so it wasn’t tried. Send that on its own when you’re ready.";

for (const queued of [false, true]) {
  const how = queued ? "queued" : "direct";
  test("W24 — the look step's hand-over reaches the add-on step with its reason, part, page and the part put off (" + how + ")", async () => {
    const M = "Add a QR code for our menu on the Visit page, and " + LATER + ".";
    const escalate = { ...TO_ADDON, page: "/visit", deferred: LATER };
    const p = page({
      route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
      edit: [queued ? receipt("job-q") : ok(escalate)],
      ...(queued ? { poll: [stored(escalate)] } : {}),
      addon: [ok({ ok: true, kinds: ["qr"], cost: 3, deferred: LATER })],
    });
    await p.send(M);
    const adds = posts(p, "addon");
    assert.equal(adds.length, 1, how + ": the add-on was not posted: " + JSON.stringify(p.kinds()));
    assert.equal(adds[0].instruction, M, how);
    assert.equal(adds[0].alsoAsked, LATER, how + ": the part put off did not ride the hand-over");
    assert.deepEqual(adds[0].handOver, { from: "look", reason: "addon", field: "qr", page: "/visit" },
      how + ": the add-on step was not told why it was handed the request");
    assert.equal(p.said().length, 1, how);
    assert.ok(p.said()[0].endsWith("\nI only did one thing this time. Say “" + LATER + "” and I’ll do that next."), how + ": " + p.said()[0]);
    assert.equal(p.busy(), false, how);
  });
}

test("W8/W24 — a climb hands the rewrite the parts put off and why; a refusal there still names them", async () => {
  const M = "Make the whole site a shop instead, and " + LATER + ".";
  const climb = { ok: false, escalate: true, reason: "build", field: "kind", cost: 0, deferred: LATER };
  const p = page({
    route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
    edit: [ok(climb)],
    rewrite: [ok({ ok: false, need: "credits", msg: "You don’t have enough credits for that.", deferred: LATER }, 402)],
  });
  await p.send(M);
  const rw = posts(p, "rewrite");
  assert.equal(rw.length, 1, "the rewrite was not started: " + JSON.stringify(p.kinds()));
  assert.equal(rw[0].instruction, M);
  assert.equal(rw[0].alsoAsked, LATER, "the rewrite was not told what to take out — it would rewrite every page with it in");
  assert.deepEqual(rw[0].handOver, { from: "look", reason: "build", field: "kind" }, "the rewrite was not told why it was handed this");
  assert.deepEqual(p.said(), ["⚡ You don’t have enough credits for that." + LEFT(LATER)]);
});

test("W8 — the add-on step's own climb hands the rewrite the same contract", async () => {
  const M = "Add a members area, and " + LATER + ".";
  // THE REAL PRODUCER'S CLIMB: a verified reconstruction (`addonFailure`), with
  // the `deferred` every ending of the route now carries.
  const p = page({
    route: [route({ intent: "addon", alsoAsked: LATER })],
    addon: [ok({ ...addonFailure("no-source", { reconstruct: true }), deferred: LATER })],
    rewrite: [ok({ ok: false, error: "x", msg: "That didn’t come together.", deferred: LATER }, 422)],
  });
  await p.send(M);
  assert.equal(posts(p, "addon")[0].alsoAsked, LATER);
  const rw = posts(p, "rewrite");
  assert.equal(rw.length, 1, JSON.stringify(p.kinds()));
  assert.equal(rw[0].alsoAsked, LATER);
  assert.deepEqual(rw[0].handOver, { from: "addon", reason: "no-source" });
  assert.deepEqual(p.said(), ["⚠️ That didn’t come together." + LEFT(LATER)]);
});

test("W7 — a dropped connection to the rewrite still names the part put off, from what was posted", async () => {
  const M = "Make the whole site a shop instead, and " + LATER + ".";
  const p = page({
    route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
    edit: [ok({ ok: false, escalate: true, reason: "build", field: "kind", cost: 0, deferred: LATER })],
    rewrite: [{ reject: new TypeError("Failed to fetch") }],
  });
  await p.send(M);
  assert.equal(posts(p, "rewrite").length, 1);
  assert.deepEqual(p.said(), ["⚠️ Lost the connection while building — check your internet and try again in a moment." + LEFT(LATER)]);
});

test("W7 — an edit refusal names the part put off, beside what it cost", async () => {
  const M = "Change Rock School to Rock Club, and " + LATER + ".";
  const p = page({ route: [route({ intent: "edit", layer: "text", alsoAsked: LATER })], edit: [ok({ ...TEXT_REFUSED, deferred: LATER }, 422)] });
  await p.send(M);
  assert.deepEqual(p.said(), ["⚠️ I couldn't find those words on your site. Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits." + LEFT(LATER)]);
  assert.deepEqual(p.kinds(), ["route", "edit"], "a refusal started more work");
});

test("W7 — an edit answer that cannot be read names the part put off from what was posted, and starts nothing", async () => {
  const M = "Change Rock School to Rock Club, and " + LATER + ".";
  const p = page({ route: [route({ intent: "edit", layer: "text", alsoAsked: LATER })], edit: [{ status: 200, body: "<html>oops</html>" }] });
  await p.send(M);
  assert.deepEqual(p.said(), ["⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Asking for it again could make the change twice." + LEFT(LATER)]);
  assert.deepEqual(p.kinds(), ["route", "edit"]);
});

test("W7 — several parts put off are each named: on a success, then each in turn; on a refusal, all of them", async () => {
  const QR = "add a QR code for our menu";
  const M = "Make the headings green, " + QR + ", and " + LATER + ".";
  const done = page({ route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
    edit: [ok({ ok: true, layer: "look", cost: 1, deferred: [LATER, QR] })] });
  await done.send(M);
  assert.equal(done.said().length, 1);
  assert.ok(done.said()[0].endsWith("\nI only did part of it this time. Say “" + LATER + "”, then “" + QR + "”, and I’ll do those next."), done.said()[0]);
  const refused = page({ route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
    edit: [ok({ ok: false, error: "no-match", cost: 0, unchanged: true, msg: "I couldn't find that on your site.", deferred: [LATER, QR] }, 422)] });
  await refused.send(M);
  assert.ok(refused.said()[0].endsWith("\nI left “" + LATER + "” and “" + QR + "” for later, so they weren’t tried. Send each on its own when you’re ready."), refused.said()[0]);
});

test("W7 — a reply whose parts put off cannot be read is not trusted: no hand-over is posted, and the part posted is named", async () => {
  const M = "Add a QR code for our menu, and " + LATER + ".";
  const p = page({ route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })], edit: [ok({ ...TO_ADDON, deferred: 7 })] });
  await p.send(M);
  assert.deepEqual(p.kinds(), ["route", "edit"], "a reply that could not be read handed the request on: " + JSON.stringify(p.kinds()));
  assert.deepEqual(p.said(), ["⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Asking for it again could make the change twice." + LEFT(LATER)]);
});

test("W5/W24 — the router's own conversion reaches the add-on step with its reason and page, and the part it put off", async () => {
  const M = "Put our cake order form on the Events page, and " + LATER + ".";
  const p = page({
    route: [route({ intent: "addon", alsoAsked: LATER, handOver: { from: "route", reason: "page-unknown", page: "/events" } })],
    addon: [ok({ ok: true, kinds: ["page"], added: ["events.tsx"], cost: 4, deferred: LATER })],
  });
  await p.send(M);
  const adds = posts(p, "addon");
  assert.equal(adds.length, 1, JSON.stringify(p.kinds()));
  assert.equal(adds[0].alsoAsked, LATER);
  assert.deepEqual(adds[0].handOver, { from: "route", reason: "page-unknown", page: "/events" }, "the router's hand-over did not reach the add-on step");
});

test("W7 — a list of parts survives a refresh: stored as a list, read back as one, and posted by a resumed hop as one", () => {
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();
  P.rememberJob("fretwork-1", "job-r", store, { ask: "x", op: "edit", layer: "look", also: [LATER, "add a map"] });
  const rec = P.resumableRecord("fretwork-1", Date.now(), store);
  assert.deepEqual(rec.also, [LATER, "add a map"]);
  // THE RESUMED WATCH'S HOP: `resumeEditJob` builds `d` with `alsoAsked: rec.also`.
  const ho = P.handOver({ layer: rec.layer, alsoAsked: rec.also }, { layer: "page", page: "/gear" }, { from: rec.layer, reply: { reason: "needs-place", field: "", deferred: [] } });
  assert.deepEqual(ho.alsoAsked, [LATER, "add a map"], "a resumed hop dropped the parts put off");
  assert.deepEqual(ho.handOver, { from: "look", reason: "needs-place", page: "/gear" });
});

test("W24 — a sideways hop between edit steps posts the hand-over too: the step it left, the reason, the page", async () => {
  const M = "Take the photo off the gear page.";
  const p = page({ route: [route({ intent: "edit", layer: "picture", remove: true })], edit: [ok(NEEDS_PLACE), ok(PAGE_DONE)] });
  await p.send(M);
  const edits = p.edits();
  assert.equal(edits.length, 2, JSON.stringify(p.kinds()));
  assert.equal(edits[0].handOver, undefined, "the router's own step carried a hand-over");
  assert.deepEqual(edits[1].handOver, { from: "picture", reason: "needs-place", page: "/gear" }, "the page step was not told why it was handed this");
});

test("W8 — what a step put off as the router's net rides the climb with the router's own part, both taken out by the rewrite", async () => {
  // THE LOOK STEP PUT A QR CODE OFF beside the router's part, then climbed: its
  // reply names both, and the rewrite must be told both — what was posted to the
  // step is the router's part alone.
  const QR = "add a QR code for our menu";
  const M = "Make the whole site a shop instead, " + QR + ", and " + LATER + ".";
  const p = page({
    route: [route({ intent: "edit", layer: "look", alsoAsked: LATER })],
    edit: [ok({ ok: false, escalate: true, reason: "build", field: "kind", cost: 0, deferred: [LATER, QR] })],
    rewrite: [ok({ ok: false, error: "x", msg: "That didn’t come together.", deferred: [LATER, QR] }, 422)],
  });
  await p.send(M);
  const rw = posts(p, "rewrite");
  assert.equal(rw.length, 1, JSON.stringify(p.kinds()));
  assert.deepEqual(rw[0].alsoAsked, [LATER, QR], "the rewrite was told only what was posted to the step, not what the step put off");
});

test("W24 — an escalate whose reason or field is not text is not trusted: nothing is handed on", async () => {
  for (const bad of [{ reason: 7 }, { field: ["qr"] }]) {
    const p = page({ route: [route({ intent: "edit", layer: "look" })], edit: [ok({ ...TO_ADDON, ...bad })] });
    await p.send("Add a QR code for our menu.");
    assert.deepEqual(p.kinds(), ["route", "edit"], JSON.stringify(bad) + ": a malformed escalate was handed on");
    assert.equal(p.said().length, 1);
    assert.match(p.said()[0], /^⚠️ I couldn’t read the answer to that change/, JSON.stringify(bad));
  }
});
