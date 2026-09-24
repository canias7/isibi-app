// WHAT THE BROWSER DOES WHEN THE ROUTING CALL FAILS — a CHARACTERISATION of
// today's behaviour (2026-09-24), no product change.
//
// Owner: "routing failures that fall through to a full-site rewrite. Reproduce
// through the real browser routing handler, with action recorders and no paid
// network calls." So `siteRoute` is cut out of public/chat.js and RUN, with the
// real `apiFetch`, `siteEdit`, `siteAddon`, `reactSend` and `addonAnswer` beside
// it. `fetch` is the only seam: it answers the routing call with the scenario's
// response and RECORDS whatever POST the browser sends next, answering it with
// a promise that never settles — so the record is the action the customer's
// message starts, and nothing past it runs.
//
// THE OPEN-DEFECT CASES ASSERT TODAY'S REWRITE. On a live site every failure
// shape — a dropped or aborted request, any non-2xx status, any body that is
// unreadable or names no action the browser knows — posts
// `/api/site/react-revise`: the full rewrite of every page (a revise of the same
// site measured 17 credits), with no sentence. A correction flips each of those
// cases deliberately; one left asserting the rewrite has not been fixed.
//
// THE CONTROLS ARE THE ANSWERS THAT MUST KEEP THEIR ACTION: a valid edit, a
// valid addon, an explicit build on a live site (the only way to say "scrap
// this"), the route's own zero-balance answer (`intent: "build"`, so the
// revise's own 402 gate speaks), an explicit build on an empty project, a
// question with an answer, and a clarify round.
//
// Every model answer here is SUPPLIED. This proves what the browser does with a
// routing response, never what a real router answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

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
  cut("function siteRoute("),
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
 * ONE MESSAGE THROUGH THE REAL HANDLER. `route` is the routing call's answer
 * (`{reject}` or `{status, body, type}`); `follow`, when given, answers the next
 * POST the same way. Returns every request after the routing call, what
 * `finish` printed, the assistant messages pushed, the rail's label and the
 * screen-affecting calls in order.
 */
async function drive({ site, message, route, follow }) {
  const calls = [];
  const events = [];
  const s = JSON.parse(JSON.stringify(site));
  s.msgs = [{ r: "u", t: message }];
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
    showAuthGate: () => events.push("sign-in gate"),
    scheduleCreditRefresh: () => {},
    fetchCredits: () => {},
    siteById: (id) => (id === "origin-1" ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    buildPicker: "grok",
    siteBusy: true,
    siteBuildStop: () => { ctx.siteBuild = null; },
    siteOpenId: "origin-1",
    renderSites: () => {},
    editBlocked: new Set(), editInFlight: new Set(), editIdem: new Map(),
    EditPoll: { newIdemKey: () => "idem-1", outcomeMessage: (k) => "outcome:" + k },
    browserTimeZone: () => "Europe/London",
    // `siteSend` starts the rail in `thinking` before it routes.
    siteBuild: { react: true, rphase: "thinking" },
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  const finished = [];
  const isBuild = !s.pages.length;
  ctx.siteRoute(s, message, "origin-1", isBuild, [], (t) => finished.push(t));
  for (let i = 0; i < 40; i++) await tick();
  return {
    routed: calls[0],
    posts: calls.slice(1),
    finished,
    // Pushed inside the context, so another realm's objects — copied out.
    said: JSON.parse(JSON.stringify(s.msgs.slice(1))),
    rail: ctx.siteBuild ? ctx.reactStageLabel() : "(stopped)",
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
const REWRITE = { url: "/api/site/react-revise", body: { slug: "fretwork-1", instruction: ASK, images: [], picker: "grok" } };

// ── OPEN DEFECT: a failed routing call on a live site starts the rewrite ─────
const FAILURES = [
  ["the request is dropped", { reject: new TypeError("Failed to fetch") }],
  ["the request is aborted", { reject: Object.assign(new Error("The operation was aborted."), { name: "AbortError" }) }],
  ["a 500 carrying Cloudflare's HTML", { status: 500, body: CF_HTML, type: "text/html" }],
  ["a 503 carrying JSON", { status: 503, body: json({ ok: false, error: "unavailable" }) }],
  ["a 429", { status: 429, body: json({ ok: false, error: "rate limited" }) }],
  ["a 413", { status: 413, body: json({ ok: false, error: "too large" }) }],
  ["a 503 carrying a well-formed edit answer", { status: 503, body: json({ ok: true, intent: "edit", layer: "look", cost: 2 }) }],
  ["a 200 carrying HTML", { status: 200, body: CF_HTML, type: "text/html" }],
  ["a 200 carrying truncated JSON", { status: 200, body: '{"ok":true,"intent":"ed' }],
  ["a 200 with an empty body", { status: 200, body: "" }],
  ["a 200 carrying null", { status: 200, body: "null" }],
  ["a 200 carrying []", { status: 200, body: "[]" }],
  ["a 200 carrying {}", { status: 200, body: "{}" }],
  ["a 200 carrying {ok:false}", { status: 200, body: json({ ok: false, error: "x" }) }],
  ["a 200 naming an intent nobody knows", { status: 200, body: json({ ok: true, intent: "banana", cost: 2 }) }],
  ["a 200 asking a question with no answer", { status: 200, body: json({ ok: true, intent: "ask", cost: 2 }) }],
  ["a 200 clarifying with one option", { status: 200, body: json({ ok: true, intent: "clarify", question: { text: "Which?", options: ["a"] }, cost: 2 }) }],
];
for (const [what, route] of FAILURES) {
  test("OPEN DEFECT: " + what + " on a live site starts the full rewrite, with no sentence", async () => {
    const o = await drive({ site: LIVE, message: ASK, route });
    assert.equal(o.routed.url, "/api/site/route", "the routing call went out first");
    assert.deepEqual(o.posts, [REWRITE], "the next POST is the rewrite of every page");
    assert.deepEqual(o.finished, [], "nothing was said");
    assert.deepEqual(o.said, [], "no assistant message");
    assert.equal(o.rail, "Planning your site…", "the rail reads as a build that has started");
  });
}

test("OPEN DEFECT: a 401 shows the sign-in gate AND starts the rewrite behind it", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: { status: 401, body: json({ ok: false, error: "unauthorized" }) } });
  assert.deepEqual(o.events, ["sign-in gate"]);
  assert.deepEqual(o.posts, [REWRITE]);
  assert.deepEqual(o.finished, []);
});

test("OPEN DEFECT: when that rewrite is refused too, the screen talks about a build nobody asked for", async () => {
  const unauthorized = { status: 401, body: json({ ok: false, error: "unauthorized" }) };
  const o = await drive({ site: LIVE, message: ASK, route: unauthorized, follow: unauthorized });
  assert.deepEqual(o.events, ["sign-in gate", "sign-in gate"]);
  assert.deepEqual(o.posts, [REWRITE]);
  assert.deepEqual(o.finished, ["⚠️ That didn’t come together. Try again in a moment."]);
});

// ── WHAT A MALFORMED ANSWER REACHES WITHOUT THE REWRITE ──────────────────────
test("an edit answer with no layer posts the edit route with an empty layer", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: { status: 200, body: json({ ok: true, intent: "edit", cost: 2 }) } });
  assert.equal(o.posts.length, 1);
  assert.equal(o.posts[0].url, "/api/site/fretwork-1/edit");
  assert.equal(o.posts[0].body.layer, "");
  assert.equal(o.posts[0].body.instruction, ASK);
});

test("a router that fell back (failed: true) is acted on as a decision: the paid addon", async () => {
  // `routeMessage` answers the fallback intent when the routing model threw, and
  // nothing in chat.js reads `failed` — so an outage and a decision look alike.
  const o = await drive({ site: LIVE, message: ASK, route: { status: 200, body: json({ ok: true, intent: "addon", cost: 0, failed: true }) } });
  assert.deepEqual(o.posts, [{ url: "/api/site/fretwork-1/addon", body: { instruction: ASK, picker: "grok", idem: "idem-1", tz: "Europe/London" } }]);
});

// ── ADJACENT, NOT THE ROUTING CALL: the addon's own failure also rewrites ────
for (const [what, follow] of [
  ["its POST is dropped", { reject: new TypeError("Failed to fetch") }],
  ["its reply is unreadable", { status: 200, body: "<html>oops</html>" }],
]) {
  test("ADJACENT OPEN DEFECT: a valid addon answer whose addon " + what + " starts the rewrite too", async () => {
    const ask = "Add a gallery page";
    const o = await drive({ site: LIVE, message: ask, route: { status: 200, body: json({ ok: true, intent: "addon", cost: 2 }) }, follow });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/fretwork-1/addon", "/api/site/react-revise"]);
    assert.equal(o.posts[1].body.instruction, ask);
    assert.deepEqual(o.finished, []);
  });
}

// ── CONTROLS: the answers that must keep their action ────────────────────────
test("CONTROL: a valid edit posts the edit route with its layer", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: { status: 200, body: json({ ok: true, intent: "edit", layer: "look", cost: 2 }) } });
  assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/fretwork-1/edit"]);
  assert.equal(o.posts[0].body.layer, "look");
  assert.equal(o.rail, "Thinking…", "no build started");
});

test("CONTROL: a valid addon posts the addon route", async () => {
  const o = await drive({ site: LIVE, message: "Add a gallery page", route: { status: 200, body: json({ ok: true, intent: "addon", cost: 2 }) } });
  assert.deepEqual(o.posts, [{ url: "/api/site/fretwork-1/addon", body: { instruction: "Add a gallery page", picker: "grok", idem: "idem-1", tz: "Europe/London" } }]);
});

test("CONTROL: an explicit build on a live site is the revise", async () => {
  const ask = "Scrap this and make me a bakery site";
  const o = await drive({ site: LIVE, message: ask, route: { status: 200, body: json({ ok: true, intent: "build", cost: 2 }) } });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-revise", body: { slug: "fretwork-1", instruction: ask, images: [], picker: "grok" } }]);
});

test("CONTROL: the route's zero-balance answer is a build, so the revise's own 402 gate speaks", async () => {
  const o = await drive({ site: LIVE, message: ASK, route: { status: 200, body: json({ ok: true, intent: "build", cost: 0 }) } });
  assert.deepEqual(o.posts, [REWRITE]);
});

test("CONTROL: an explicit build on an empty project is the first build, in its own chat", async () => {
  const o = await drive({ site: EMPTY, message: "A bakery in Leeds", route: { status: 200, body: json({ ok: true, intent: "build", cost: 2 }) } });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-build", body: { brief: "A bakery in Leeds", images: [], picker: "grok", qa: [], chat: "origin-1" } }]);
});

test("CONTROL: a question with an answer is said, and buys nothing", async () => {
  const o = await drive({ site: LIVE, message: "Can you read a URL?", route: { status: 200, body: json({ ok: true, intent: "ask", answer: "Yes — paste it.", cost: 1 }) } });
  assert.deepEqual(o.posts, []);
  assert.deepEqual(o.said, [{ r: "a", t: "Yes — paste it." }]);
  assert.equal(o.rail, "(stopped)");
});

test("CONTROL: a clarify round on an empty project asks, and buys nothing", async () => {
  const o = await drive({ site: EMPTY, message: "A bakery", route: { status: 200, body: json({ ok: true, intent: "clarify", question: { text: "What should visitors do?", options: ["Order", "Visit"] }, cost: 1 }) } });
  assert.deepEqual(o.posts, []);
  assert.equal(o.said.length, 1);
  assert.deepEqual(o.said[0].opts, ["Order", "Visit"]);
});

// ── FOR COMPARISON: a first build's failure is a build, the documented default
test("a failed routing call on an empty project starts the first build (the documented default)", async () => {
  for (const route of [{ reject: new TypeError("Failed to fetch") }, { status: 500, body: CF_HTML, type: "text/html" }]) {
    const o = await drive({ site: EMPTY, message: "A bakery in Leeds", route });
    assert.deepEqual(o.posts.map((p) => p.url), ["/api/site/react-build"]);
  }
});

// ── RECORDED FOR A LATER TASK: the adopted site with no page list ────────────
test("RECORDED: a failed routing call on an adopted site with no page list starts a NEW site build", async () => {
  const o = await drive({ site: ADOPTED, message: ASK, route: { reject: new TypeError("Failed to fetch") } });
  assert.deepEqual(o.posts, [{ url: "/api/site/react-build", body: { brief: ASK, images: [], picker: "grok", qa: [], chat: "origin-1" } }]);
});
