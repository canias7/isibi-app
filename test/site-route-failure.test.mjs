// WHAT THE BROWSER DOES WITH A ROUTING ANSWER IT CANNOT ACT ON (2026-09-24).
//
// Reproduced first as a characterisation (e0daf2e8): on a live site every
// failure shape — a dropped or aborted request, any non-2xx status, any body
// that is unreadable or names no action — posted `/api/site/react-revise`, the
// full rewrite of every page (a revise of the same site measured 17 credits),
// with no sentence. The owner then named three more: the router's own fallback
// after its model threw (`failed: true`, which started the paid add-on), an
// answer the route marked `ok: false` (which started work anyway), and an edit
// with no valid layer. The correction, in the owner's words: "On an existing
// site with pages, validate the routing result before dispatching any action."
//
// `siteSend` is cut out of public/chat.js and RUN, with the real `siteRoute`,
// `apiFetch`, `siteEdit`, `siteAddon`, `reactSend`, `siteBuildStart` and
// `siteBuildStop` beside it — so the busy flag, the rail and its clock are the
// real ones. `fetch` is the only seam: it answers the routing call with the
// scenario's response and RECORDS whatever POST the browser sends next,
// answering it with a promise that never settles — so the record is the action
// the customer's message starts, and nothing past it runs.
//
// AND A CLARIFY ROUND IS AN ACTION TOO. Its check asked only how many options
// there were, so a question with no words drew as "undefined", words that were
// an object as "[object Object]", and `[null, {}]` as two buttons answering
// "null" and "[object Object]" (owner, 2026-09-24: "Require a non-empty string
// question and usable non-empty string options. Keep the validation and
// rendering branch consistent."). One reader now answers the question as it
// will be drawn, and on a live site a question it refuses stops like any other
// answer that cannot be acted on.
//
// EVERY STOP ASSERTS FIVE THINGS: no request after the routing call, the busy
// flag cleared, the rail and its clock stopped, no clarify round stored, and the
// exact sentence on screen — which claims nothing about money, because the
// routing call is billed on its own and may already have been charged.
//
// OUT OF SCOPE, AND ASSERTED AS THEY ARE: an empty project keeps its documented
// default (every failure builds), the adopted site with no page list (a later
// task), and the add-on request's own failures (a later task).
//
// Every routing answer here is SUPPLIED. This proves what the browser does with
// a response, never what a real router answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

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
  cut("async function apiFetch("),
  cutLine("const ROUTE_EDIT_LAYERS ="),
  cut("function routeQuestion("),
  cut("function routeActionable("),
  cut("function siteRoute("),
  cut("function siteSend("),
  cut("function siteBuildStart("),
  cutLine("function siteBuildStop("),
  cut("function siteEdit("),
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function reactSend("),
  cut("function reactStageLabel("),
  cut("function buildCostWords("),
  cut("function buildErrOutcome("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * ONE MESSAGE THROUGH THE REAL SEND HANDLER. `route` is the routing call's
 * answer (`{reject}` or `{status, body, type}`); `follow`, when given, answers
 * the next POST the same way. Returns every request after the routing call, the
 * assistant messages pushed, the clarify round the site holds afterwards (`null`
 * for none), the busy flag, the rail's label, the rail clock's starts and
 * stops, and the screen-affecting calls in order.
 */
async function drive({ site, message, route, follow }) {
  const calls = [];
  const events = [];
  const clock = { started: 0, cleared: 0 };
  const s = JSON.parse(JSON.stringify(site));
  s.msgs = [];
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent,
    fetch: (url, init) => {
      const n = calls.length;
      calls.push({ url, body: init && init.body ? JSON.parse(init.body) : undefined });
      const answer = n === 0 ? route : n === 1 ? follow : null;
      if (!answer) return new Promise(() => {});
      if (answer.reject) return Promise.reject(answer.reject);
      return Promise.resolve(new Response(answer.body, { status: answer.status, headers: { "content-type": answer.type || "application/json" } }));
    },
    // The rail's clock, counted rather than scheduled: a real interval left
    // running by a case that keeps working would hold the test process open.
    setInterval: () => { clock.started++; return { clock: clock.started }; },
    clearInterval: () => { clock.cleared++; },
    showAuthGate: () => events.push("sign-in gate"),
    scheduleCreditRefresh: () => {},
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    siteAttach: [],
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false,
    siteBuild: null,
    siteTicker: null,
    siteOpenId: "origin-1",
    renderSites: () => {},
    editBlocked: new Set(), editInFlight: new Set(), editIdem: new Map(),
    EditPoll: { newIdemKey: () => "idem-1", outcomeMessage: (k) => "outcome:" + k },
    browserTimeZone: () => "Europe/London",
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  ctx.siteSend(message);
  for (let i = 0; i < 40; i++) await tick();
  const msgs = JSON.parse(JSON.stringify(s.msgs));
  assert.deepEqual(msgs[0], { r: "u", t: message }, "the message itself is the first thing on the thread");
  return {
    routed: calls[0],
    posts: calls.slice(1),
    // Pushed inside the context, so another realm's objects — copied out.
    said: msgs.slice(1),
    clarify: s.clarify == null ? null : JSON.parse(JSON.stringify(s.clarify)),
    busy: ctx.siteBusy,
    rail: ctx.siteBuild ? ctx.reactStageLabel() : "(stopped)",
    ticker: ctx.siteTicker,
    clock,
    events,
  };
}

const LIVE = { slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }] };
const EMPTY = { react: false, name: "", pages: [] };
// A site opened on a browser that did not build it, before its page list
// arrived: `fromRow` carries the slug and no pages.
const ADOPTED = { slug: "fretwork-1", react: true, name: "fretwork-1", url: "https://fretwork-1.gofarther.app/", pages: [] };
const ASK = "Make the footer navy";
const CF_HTML = "<!DOCTYPE html><html><head><title>Worker threw exception | Cloudflare</title></head><body>Error 1101</body></html>";
const json = (o) => JSON.stringify(o);
const ok200 = (o) => ({ status: 200, body: json(o) });
const REWRITE = { url: "/api/site/react-revise", body: { slug: "fretwork-1", instruction: ASK, images: [], picker: "grok" } };
const STOPPED = "⚠️ I couldn’t work out what to do with that just now, so nothing on your site changed. Send it again in a moment.";
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";

// What every stop owes the customer: nothing sent, the busy flag and the rail
// cleared, no clarify round left waiting for an answer, and the one sentence.
function assertStopped(o, sentence) {
  assert.equal(o.routed.url, "/api/site/route", "the routing call went out first");
  assert.deepEqual(o.posts, [], "no edit, add-on or rewrite request followed the routing call");
  assert.deepEqual(o.said, [{ r: "a", t: sentence }], "the customer is told, in one sentence");
  assert.equal(o.clarify, null, "no clarify round is stored, so the next message is not read as an answer to it");
  assert.equal(o.busy, false, "the busy flag is cleared, so the next message can be sent");
  assert.equal(o.rail, "(stopped)", "the rail is stopped");
  assert.equal(o.clock.started, 1, "the rail's clock was started when the message was sent");
  assert.equal(o.clock.cleared, 1, "and cleared when it stopped");
  assert.equal(o.ticker, null, "no clock left behind");
  assert.doesNotMatch(sentence, /charg|free|cost|credit/i, "the sentence claims nothing about money: the routing call may already be billed");
}

// ── A LIVE SITE: A ROUTING ANSWER THAT CANNOT BE ACTED ON STOPS, SAID ────────
const STOPS = [
  // The request never answered.
  ["the request is dropped", { reject: new TypeError("Failed to fetch") }],
  ["the request is aborted", { reject: Object.assign(new Error("The operation was aborted."), { name: "AbortError" }) }],
  // A status that is not a success, whatever it carries.
  ["a 500 carrying Cloudflare's HTML", { status: 500, body: CF_HTML, type: "text/html" }],
  ["a 503 carrying JSON", { status: 503, body: json({ ok: false, error: "unavailable" }) }],
  ["a 429", { status: 429, body: json({ ok: false, error: "rate limited" }) }],
  ["a 413", { status: 413, body: json({ error: "payload too large" }) }],
  ["a 503 carrying a well-formed edit answer", { status: 503, body: json({ ok: true, intent: "edit", layer: "look", cost: 2 }) }],
  // A body that cannot be read, or reads as no answer at all.
  ["a 200 carrying HTML", { status: 200, body: CF_HTML, type: "text/html" }],
  ["a 200 carrying truncated JSON", { status: 200, body: '{"ok":true,"intent":"ed' }],
  ["a 200 with an empty body", { status: 200, body: "" }],
  ["a 200 carrying null", { status: 200, body: "null" }],
  ["a 200 carrying []", { status: 200, body: "[]" }],
  ["a 200 carrying {}", { status: 200, body: "{}" }],
  // A result that says it failed.
  ["a 200 carrying {ok:false}", ok200({ ok: false, error: "x" })],
  ["a 200 {ok:false, intent:build}", ok200({ ok: false, intent: "build" })],
  ["a 200 {ok:false, intent:edit, layer:look}", ok200({ ok: false, intent: "edit", layer: "look" })],
  ["a 200 edit answer with no ok at all", ok200({ intent: "edit", layer: "look", cost: 2 })],
  ["the router's fallback add-on (failed: true)", ok200({ ok: true, intent: "addon", cost: 0, failed: true })],
  ["the router's fallback build (failed: true)", ok200({ ok: true, intent: "build", cost: 0, failed: true })],
  // An action whose payload cannot be acted on as it stands.
  ["an intent nobody knows", ok200({ ok: true, intent: "banana", cost: 2 })],
  ["an edit with no layer", ok200({ ok: true, intent: "edit", cost: 2 })],
  ["an edit naming a layer the edit route does not have", ok200({ ok: true, intent: "edit", layer: "colour", cost: 2 })],
  // `String(["look"])` is "look": the edit POST would have been a look edit.
  ["an edit whose layer is not a string", ok200({ ok: true, intent: "edit", layer: ["look"], cost: 2 })],
  ["an edit whose page is not a string", ok200({ ok: true, intent: "edit", layer: "page", page: { path: "/gear" }, cost: 2 })],
  // Read as absent at the point of use, a move becomes a page edit of the sentence.
  ["an edit whose move target is not a string", ok200({ ok: true, intent: "edit", layer: "page", page: "/gear", rename: 7, cost: 2 })],
  ["an edit whose removal flag is not a boolean", ok200({ ok: true, intent: "edit", layer: "page", page: "/gear", remove: "yes", cost: 2 })],
  ["an edit whose tab flag is not a boolean", ok200({ ok: true, intent: "edit", layer: "logo", tab: "true", cost: 2 })],
  ["a question with no answer", ok200({ ok: true, intent: "ask", cost: 2 })],
  ["a question whose answer is not a string", ok200({ ok: true, intent: "ask", answer: { text: "Yes" }, cost: 2 })],
  ["a question whose answer is blank", ok200({ ok: true, intent: "ask", answer: "   ", cost: 2 })],
  ["a clarify round with one option", ok200({ ok: true, intent: "clarify", question: { text: "Which?", options: ["a"] }, cost: 2 })],
];
for (const [what, route] of STOPS) {
  test("A LIVE SITE STOPS: " + what + " sends nothing more and says so", async () => {
    assertStopped(await drive({ site: LIVE, message: ASK, route }), STOPPED);
  });
}

test("A LIVE SITE STOPS: an edit or add-on answer for a site with pages and no address falls to nothing, not to the rewrite", async () => {
  // Their branches below the check need the address; without the check an
  // answer that failed them fell through to `go()`, the rewrite.
  const noAddress = { ...LIVE, slug: "" };
  for (const route of [ok200({ ok: true, intent: "edit", layer: "look", cost: 2 }), ok200({ ok: true, intent: "addon", cost: 2 })]) {
    assertStopped(await drive({ site: noAddress, message: ASK, route }), STOPPED);
  }
});

test("A LIVE SITE STOPS: a 401 shows the sign-in gate and says to sign in, and nothing else is sent", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: { status: 401, body: json({ ok: false, error: "unauthorized" }) } });
  assert.deepEqual(o.events, ["sign-in gate"], "the gate once, from the routing call; no second 401 from a rewrite behind it");
  assertStopped(o, SIGNED_OUT);
});

// ── A LIVE SITE: A QUESTION THE SCREEN CANNOT DRAW STOPS THE SAME WAY ────────
// The route's own reader (`readQuestion` in builder/site-ask.mjs) only ever
// sends words to ask and two to four answers, each a string with something in
// it. The first three below are the owner's reproductions, in order; the rest
// are the same three failures — missing, blank, not a string — for the words,
// the list and the answers in it.
const clarify = (question) => ok200({ ok: true, intent: "clarify", question, cost: 1 });
const TWO = ["Order", "Visit"];
const BAD_QUESTIONS = [
  ["no words (it drew as \"undefined\")", clarify({ options: TWO })],
  ["words that are an object (they drew as \"[object Object]\")", clarify({ text: { en: "Which one?" }, options: TWO })],
  ["answers null and {} (they drew as buttons answering \"null\" and \"[object Object]\")", clarify({ text: "Choose one", options: [null, {}] })],
  ["no question at all", ok200({ ok: true, intent: "clarify", cost: 1 })],
  ["a question that is only a string", clarify("Which one?")],
  ["empty words", clarify({ text: "", options: TWO })],
  ["blank words", clarify({ text: "   ", options: TWO })],
  ["words that are a number", clarify({ text: 7, options: TWO })],
  ["words that are null", clarify({ text: null, options: TWO })],
  ["no answers", clarify({ text: "Choose one" })],
  ["answers that are one string, not a list", clarify({ text: "Choose one", options: "Order, Visit" })],
  ["an empty list of answers", clarify({ text: "Choose one", options: [] })],
  ["an empty answer", clarify({ text: "Choose one", options: ["Order", ""] })],
  ["a blank answer", clarify({ text: "Choose one", options: ["Order", "  "] })],
  ["an answer that is a number", clarify({ text: "Choose one", options: ["Order", 3] })],
  // `String(["Visit", "Call"])` is "Visit,Call": one button offering two answers.
  ["an answer that is a list", clarify({ text: "Choose one", options: ["Order", ["Visit", "Call"]] })],
  // Past the four the screen draws, and still nothing the route sends: dropped
  // there, it would be a malformed field read as absent.
  ["an unusable fifth answer", clarify({ text: "Choose one", options: ["Order", "Visit", "Call", "Email", null] })],
];
for (const [what, route] of BAD_QUESTIONS) {
  test("A LIVE SITE STOPS: a clarify round with " + what + " draws nothing, stores no round and sends nothing", async () => {
    assertStopped(await drive({ site: LIVE, message: ASK, route }), STOPPED);
  });
}

// ── THE BROWSER'S LAYER LIST IS THE ROUTER'S ─────────────────────────────────
test("the browser's edit layers are exactly the router's EDIT_LAYERS, both ways", () => {
  const list = vm.runInNewContext(cutLine("const ROUTE_EDIT_LAYERS =") + "; ROUTE_EDIT_LAYERS");
  assert.ok(Array.isArray(list) && list.length > 0, "the browser's list was read");
  assert.equal(new Set(list).size, list.length, "no layer listed twice");
  for (const l of EDIT_LAYERS) assert.ok(list.includes(l), "the router answers `" + l + "` and the browser would refuse it");
  for (const l of list) assert.ok(EDIT_LAYERS.includes(l), "the browser admits `" + l + "`, which the router never answers");
});

// ── CONTROLS: the answers that keep their action ─────────────────────────────
for (const layer of EDIT_LAYERS) {
  test("CONTROL: a valid " + layer + " edit posts the edit route with its layer, and keeps working", async () => {
    const o = await drive({ site: LIVE, message: ASK, route: ok200({ ok: true, intent: "edit", layer, cost: 2 }) });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/fretwork-1/edit"]);
    assert.equal(o.posts[0].body.layer, layer);
    assert.equal(o.posts[0].body.instruction, ASK);
    assert.deepEqual(o.said, [], "nothing said yet: the edit is running");
    assert.equal(o.busy, true, "still busy while the edit runs");
    assert.equal(o.rail, "Thinking…", "no build started");
  });
}

test("CONTROL: an edit's well-typed page, removal, move and tab reach the edit POST as they came", async () => {
  const cases = [
    [{ layer: "page", page: "/gear", remove: true }, { page: "/gear", remove: true, rename: "", tab: false }],
    [{ layer: "page", page: "/gear", rename: "/kit" }, { page: "/gear", remove: false, rename: "/kit", tab: false }],
    [{ layer: "logo", tab: true }, { page: "", remove: false, rename: "", tab: true }],
    [{ layer: "look", page: "/prices", remove: false }, { page: "/prices", remove: false, rename: "", tab: false }],
  ];
  for (const [fields, want] of cases) {
    const o = await drive({ site: LIVE, message: ASK, route: ok200({ ok: true, intent: "edit", cost: 2, ...fields }) });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/fretwork-1/edit"], json(fields));
    const b = o.posts[0].body;
    assert.deepEqual({ page: b.page, remove: b.remove, rename: b.rename, tab: b.tab }, want, json(fields));
  }
});

test("CONTROL: a valid addon posts the addon route", async () => {
  const o = await drive({ site: LIVE, message: "Add a gallery page", route: ok200({ ok: true, intent: "addon", cost: 2 }) });
  assert.deepEqual(o.posts, [{ url: "/api/site/fretwork-1/addon", body: { instruction: "Add a gallery page", picker: "grok", idem: "idem-1", tz: "Europe/London" } }]);
  assert.equal(o.busy, true);
});

test("CONTROL: an explicit build on a live site is the revise", async () => {
  const ask = "Scrap this and make me a bakery site";
  const o = await drive({ site: LIVE, message: ask, route: ok200({ ok: true, intent: "build", cost: 2 }) });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-revise", body: { slug: "fretwork-1", instruction: ask, images: [], picker: "grok" } }]);
  assert.equal(o.rail, "Planning your site…", "the revise has started");
});

test("CONTROL: the route's zero-balance answer is a build, so the revise's own 402 gate speaks", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: ok200({ ok: true, intent: "build", cost: 0 }) });
  assert.deepEqual(o.posts, [REWRITE]);
});

test("CONTROL: a question with an answer is said, and buys nothing", async () => {
  const o = await drive({ site: LIVE, message: "Can you read a URL?", route: ok200({ ok: true, intent: "ask", answer: "Yes — paste it.", cost: 1 }) });
  assert.deepEqual(o.posts, []);
  assert.deepEqual(o.said, [{ r: "a", t: "Yes — paste it." }]);
  assert.equal(o.busy, false);
  assert.equal(o.rail, "(stopped)");
});

test("CONTROL: a clarify round on a live site is drawn as it came, stores its round, and buys nothing", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: clarify({ text: "Which footer?", options: ["Main", "Shop"] }) });
  assert.deepEqual(o.posts, [], "a question sends nothing after the routing call");
  assert.deepEqual(o.said, [{ r: "a", t: "Which footer?", q: "Which footer?", opts: ["Main", "Shop"] }],
    "the question is drawn in its own words, with its two answers to press");
  assert.deepEqual(o.clarify, { brief: ASK, qa: [], imgs: [] }, "the round is stored, so the answer is put back together with the brief");
  assert.equal(o.busy, false);
  assert.equal(o.rail, "(stopped)");
  assert.equal(o.clock.started, 1);
  assert.equal(o.clock.cleared, 1);
  assert.equal(o.ticker, null);
});

test("CONTROL: four answers, or more, draw the first four", async () => {
  const four = ["Main", "Shop", "Blog", "Help"];
  for (const options of [four, [...four, "Other"]]) {
    const o = await drive({ site: LIVE, message: ASK, route: clarify({ text: "Which footer?", options }) });
    assert.deepEqual(o.posts, []);
    assert.deepEqual(o.said, [{ r: "a", t: "Which footer?", q: "Which footer?", opts: four }], json(options));
    assert.deepEqual(o.clarify, { brief: ASK, qa: [], imgs: [] });
  }
});

test("CONTROL: an explicit build on an empty project is the first build, in its own chat", async () => {
  const o = await drive({ site: EMPTY, message: "A bakery in Leeds", route: ok200({ ok: true, intent: "build", cost: 2 }) });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-build", body: { brief: "A bakery in Leeds", images: [], picker: "grok", qa: [], chat: "origin-1" } }]);
});

test("CONTROL: a clarify round on an empty project asks, stores its round, and buys nothing", async () => {
  const o = await drive({ site: EMPTY, message: "A bakery", route: clarify({ text: "What should visitors do?", options: TWO }) });
  assert.deepEqual(o.posts, []);
  assert.deepEqual(o.said, [{ r: "a", t: "What should visitors do?", q: "What should visitors do?", opts: TWO }]);
  assert.deepEqual(o.clarify, { brief: "A bakery", qa: [], imgs: [] });
  assert.equal(o.busy, false);
  assert.equal(o.rail, "(stopped)");
});

// ── UNCHANGED: an empty project's failure is still a build ───────────────────
test("an empty project keeps its documented default: a failed or unreadable routing answer starts the first build", async () => {
  for (const route of [
    { reject: new TypeError("Failed to fetch") },
    { status: 500, body: CF_HTML, type: "text/html" },
    ok200({ ok: false, error: "x" }),
    ok200({ ok: true, intent: "build", cost: 0, failed: true }),
  ]) {
    const o = await drive({ site: EMPTY, message: "A bakery in Leeds", route });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/react-build"], json(route.body || "rejected"));
    assert.deepEqual(o.said, [], "no stop sentence on a first build");
  }
});

// The one change an empty project sees: the reader is shared, so a question it
// refuses is not drawn there either. With nothing to draw, the answer is one
// more the empty project cannot use, and that default is the first build.
test("an empty project draws no question the reader refuses: like every other unusable answer there, it starts the first build", async () => {
  for (const [what, route] of BAD_QUESTIONS.slice(0, 3)) {
    const o = await drive({ site: EMPTY, message: "A bakery in Leeds", route });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/react-build"], what);
    assert.deepEqual(o.said, [], what + ": nothing drawn");
    assert.equal(o.clarify, null, what + ": no round stored");
  }
});

// ── RECORDED FOR A LATER TASK: the adopted site with no page list ────────────
test("RECORDED: a failed routing call on an adopted site with no page list starts a NEW site build", async () => {
  const o = await drive({ site: ADOPTED, message: ASK, route: { reject: new TypeError("Failed to fetch") } });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-build", body: { brief: ASK, images: [], picker: "grok", qa: [], chat: "origin-1" } }]);
});

// ── ADJACENT, NOT THE ROUTING CALL: the add-on's own failure still rewrites ──
for (const [what, follow] of [
  ["its POST is dropped", { reject: new TypeError("Failed to fetch") }],
  ["its reply is unreadable", { status: 200, body: "<html>oops</html>" }],
]) {
  test("ADJACENT OPEN DEFECT (a later task): a valid addon answer whose addon " + what + " starts the rewrite", async () => {
    const ask = "Add a gallery page";
    const o = await drive({ site: LIVE, message: ask, route: ok200({ ok: true, intent: "addon", cost: 2 }), follow });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/fretwork-1/addon", "/api/site/react-revise"]);
    assert.equal(o.posts[1].body.instruction, ask);
    assert.deepEqual(o.said, []);
  });
}
