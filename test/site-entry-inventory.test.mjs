// AN EXISTING SITE IS NEVER A FIRST BUILD (2026-09-24).
//
// Reproduced first in a real browser with every request recorded: a site opened
// from its start-screen card (`siteAdopt`) carries its slug and no pages until
// `/api/site/routes` answers, and "no pages" was what `siteSend` read as a first
// build. The routing call went out with `firstBuild` set and `hasSite` false,
// and every answer it could give ended in `/api/site/react-build` with no slug:
// a new paid site under a new name, the request never reaching the site it was
// about. The owner then ran the clarify handler on an existing fretwork-1 record
// and named the second door: "Skip the questions" posted the build with no slug,
// and an answer was routed with `firstBuild` set. Reproducing that one more way
// found a third: on a site whose list WAS loaded, an answer the router took as a
// logo edit sent the ANSWER ("A guitar school") as the edit's instruction, and
// left the round behind.
//
// The correction, in the owner's words: "Await the in-flight inventory request
// before routing; allow a retry after failure. If usable inventory cannot be
// established, stop without starting paid work. Keep genuine new-project
// behavior working. … Protect typed replies, option clicks and skip; preserve
// the original request and attachments. Keep the wait bounded and tied to the
// original site."
//
// THE REAL HANDLERS RUN: `siteSend`, `siteAnswer`, the thread's click
// delegation and the keyboard listener are cut out of public/chat.js with the
// real `siteRoute`, `siteEdit`, `reactSend`, the shared page-list read, the
// busy flag and the rail. `fetch` is the one seam — it answers the page-list
// read and the routing call from a script and RECORDS every other request,
// answering it with a promise that never settles, so the record is the work the
// customer's message starts and nothing past it runs.
//
// AND A MESSAGE THE CHECK STOPPED KEEPS ITS FILES (2026-09-24). The owner ran
// the stop with a picture attached — "Use this picture as the logo." — and found
// it nowhere afterwards: `siteAttach` empty, the stored message words alone, and
// the message sent again was routed `attached: false` and posted the logo edit
// with no image. "Preserve the original request and attachments when this
// pre-routing check stops. Keep recovery tied to the original site; do not
// restore its files into another workspace or overwrite newly selected
// attachments. No automatic paid retry." So the composer is here too: every
// redraw draws it the way the page does — an empty box, Send or Stop, the strip
// — and wires it with the real `wireSiteComposer`; attachments are made by the
// real attach code out of a file; and the strip is painted by the real
// `paintAttachStrip`, so what it DRAWS is asserted as well as what it holds.
//
// Every routing answer here is SUPPLIED. This proves what the browser sends and
// shows, never what a real router answers.
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
// A statement that ends at the first `});` at column 0 — the keyboard listener.
function cutStatement(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n});\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHAT.slice(open, shut + 5);
}
// The thread's click delegation, which lives inside the workspace render.
function cutClick() {
  const head = "    thread.onclick = (e) => {";
  const open = CHAT.indexOf(head);
  assert.ok(open > 0, "the thread's click delegation is gone from chat.js");
  const shut = CHAT.indexOf("\n    };\n", open);
  assert.ok(shut > open, "the thread's click delegation has no end");
  const src = CHAT.slice(open, shut + 7);
  assert.match(src, /siteAnswer\('', true\)/, "the skip button no longer reaches siteAnswer");
  assert.match(src, /siteAnswer\(ans\.getAttribute\('data-ans'\)\)/, "an option no longer reaches siteAnswer");
  return src;
}

const SRC = [
  cut("async function apiFetch("),
  cutLine("const ROUTE_EDIT_LAYERS ="),
  cut("function routeQuestion("),
  cut("function routeActionable("),
  cut("function siteRoute("),
  cut("function siteSend("),
  cut("function siteAnswer("),
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
  cut("function sitePages("),
  cut("function lastBuildFiles("),
  cut("function pageFromPath("),
  cut("function reactRoutePages("),
  cutLine("function siteById("),
  cut("function siteActivePage("),
  cutLine("const siteRoutesAsked ="),
  cutLine("const SITE_ROUTES_WAIT_MS ="),
  cutLine("const siteRoutesPending ="),
  cut("function siteRoutesRead("),
  cut("function siteRoutesApply("),
  cut("function siteRoutesFetch("),
  cutLine("const SITE_NO_PAGES_MSG ="),
  cut("function siteWithPages("),
  cutStatement("document.addEventListener('keydown', (e) => {"),
  cutClick(),
  cut("function esc("),
  cutLine("const SITES_KEY ="),
  cut("function sitesSave("),
  cutLine("const NATIVE_IMAGE ="),
  cutLine("const TEXTISH ="),
  cutStatement("const readAs ="),
  cut("async function siteAttachOne("),
  cut("function siteAttachFiles("),
  cut("function paintAttachStrip("),
  cut("function siteHoldUnsent("),
  cut("function siteUnsentBack("),
  cut("function wireSiteComposer("),
].join("\n");

const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 40; i++) await tick(); };
const copy = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
const aborted = () => Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
const reply = (a) => new Response(a.body, { status: a.status, headers: { "content-type": a.type || "application/json" } });

/**
 * THE WORKSPACE, WITH THE REAL SEND PATH IN IT. `routes` answers successive
 * reads of a page list and `route` successive routing calls, each as
 * `{status, body}`, `{reject}`, `{defer: true}` (answered later by
 * `release(answer)`) or `{hang: true}` (never answers, but honours the abort).
 * Any other request is recorded and never answered.
 *
 * EVERY REDRAW DRAWS THE COMPOSER as `renderSiteWorkspace` does for the site on
 * screen — a NEW box, drawn empty; Send, or Stop while a message is in the air;
 * the + button; a new strip — and wires it with the real `wireSiteComposer`.
 * With no site on screen it is the start screen: a strip of its own, painted by
 * the same painter. The workspace is drawn once before anything is typed.
 */
function workspace({ sites, open = "origin-1", routes = [], route = [] }) {
  const calls = [];
  const events = [];
  // Every redraw of the workspace, with whether the site on screen still held a
  // question at that moment — what the thread drew its buttons from.
  const renders = [];
  const clock = { started: 0, cleared: 0 };
  const timers = [];
  const held = [];
  const listeners = {};
  const records = copy(sites);
  const queue = { routes: routes.slice(), route: route.slice() };
  // The page's elements, as the last redraw left them.
  const dom = {};
  // The strip as `paintAttachStrip` leaves it: its markup, and a × button per
  // attachment carrying the index it removes, which is what the painter wires.
  const newStrip = () => {
    const el = { html: "", buttons: [] };
    Object.defineProperty(el, "innerHTML", {
      get() { return el.html; },
      set(v) { el.html = v; el.buttons = [...v.matchAll(/data-att="(\d+)"/g)].map((m) => ({ dataset: { att: m[1] }, onclick: null })); },
    });
    el.querySelectorAll = (sel) => (sel === "[data-att]" ? el.buttons : []);
    return el;
  };
  const store = new Map();
  // Which rail the workspace shows: the chat, with the composer under it, or the
  // edit history, which draws no composer at all.
  let rail = "chat";
  const draw = () => {
    const shown = records.find((r) => r.id === ctx.siteOpenId) || null;
    renders.push({ open: ctx.siteOpenId, question: !!(shown && shown.clarify) });
    dom.strip = newStrip();
    if (!shown) {
      dom.stRevise = dom.stSend = dom.stStop = dom.stPlus = null;
      ctx.paintAttachStrip();
      return;
    }
    if (rail === "history") {
      dom.strip = dom.stRevise = dom.stSend = dom.stStop = dom.stPlus = null;
      ctx.wireSiteComposer(shown);
      return;
    }
    dom.stRevise = { value: "", focus() {} };
    dom.stSend = ctx.siteBusy ? null : { onclick: null };
    dom.stStop = ctx.siteBusy ? { onclick: null } : null;
    dom.stPlus = { onclick: null };
    ctx.wireSiteComposer(shown);
  };
  const answer = (a, signal) => {
    if (!a) return new Promise(() => {});
    if (a.reject) return Promise.reject(a.reject);
    if (a.defer || a.hang) {
      return new Promise((resolve, reject) => {
        if (a.defer) held.push((x) => (x.reject ? reject(x.reject) : resolve(reply(x))));
        if (signal) signal.addEventListener("abort", () => reject(aborted()));
      });
    }
    return Promise.resolve(reply(a));
  };
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent,
    document: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      getElementById: (id) => dom[id] || null,
      querySelectorAll: (sel) => (sel === "#stAttach" && dom.strip ? [dom.strip] : []),
    },
    // A file read as the browser reads it: the attach code's own reader asks for
    // a data URL, and answers on a later turn.
    FileReader: class { readAsDataURL(f) { this.result = f.dataUrl; queueMicrotask(() => this.onload()); } },
    localStorage: { setItem: (k, v) => store.set(k, v), getItem: (k) => (store.has(k) ? store.get(k) : null) },
    sbToast: (t) => events.push("toast: " + t),
    siteAttachOpen: () => {},
    siteStop: () => {},
    thread: { contains: () => true, onclick: null },
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      calls.push({ method, url, body: init && init.body ? JSON.parse(init.body) : undefined });
      if (method === "GET" && String(url).startsWith("/api/site/routes?")) return answer(queue.routes.shift(), init && init.signal);
      if (method === "POST" && url === "/api/site/route") return answer(queue.route.shift(), init && init.signal);
      return new Promise(() => {});
    },
    // The rail's clock, counted rather than scheduled; the page-list read's
    // bound, recorded so a case can reach it without waiting fifteen seconds.
    setInterval: () => { clock.started++; return { clock: clock.started }; },
    clearInterval: () => { clock.cleared++; },
    setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.cleared = true; },
    showAuthGate: () => events.push("sign-in gate"),
    scheduleCreditRefresh: () => {},
    fetchCredits: () => {},
    sitesLoad: () => records,
    sitesCache: records,
    siteAttach: [],
    buildPicker: "grok",
    siteBusy: false,
    siteBuild: null,
    siteTicker: null,
    siteOpenId: open,
    renderSites: () => draw(),
    editBlocked: new Set(), editInFlight: new Set(), editIdem: new Map(),
    EditPoll: { newIdemKey: () => "idem-1", outcomeMessage: (k) => "outcome:" + k },
    browserTimeZone: () => "Europe/London",
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  assert.equal(typeof listeners.keydown, "function", "the keyboard listener did not register");
  draw();
  const site = (id) => records.find((r) => r.id === id) || null;
  return {
    ctx, calls, events, renders, clock, timers, records,
    send: (t) => ctx.siteSend(t),
    // THE COMPOSER, driven as a person drives it. `attach` goes through the real
    // attach code; `type` writes the box on screen; `pressSend` presses the Send
    // button that is drawn, so it sends what the box holds.
    attach: async (files) => { ctx.siteAttachFiles(files); await settle(); },
    type: (t) => { assert.ok(dom.stRevise, "no box is drawn"); dom.stRevise.value = t; },
    pressSend: () => { assert.ok(dom.stSend && typeof dom.stSend.onclick === "function", "no Send button is drawn and wired"); dom.stSend.onclick(); },
    unattach: (i) => { const b = dom.strip.buttons[i]; assert.ok(b && typeof b.onclick === "function", "no remove button on attachment " + i); b.onclick(); },
    open: (id) => { ctx.siteOpenId = id; draw(); },
    redraw: () => draw(),
    showRail: (which) => { rail = which; draw(); },
    // What the composer on screen shows: the box, the strip's attachments, and
    // the pictures the strip DRAWS.
    box: () => (dom.stRevise ? dom.stRevise.value : null),
    strip: () => copy(ctx.siteAttach),
    drawn: () => (dom.strip ? [...dom.strip.html.matchAll(/<img src="([^"]*)"/g)].map((m) => m[1]) : []),
    sendDrawn: () => !!dom.stSend,
    held: (id = "origin-1") => copy(site(id).unsent) || null,
    stored: () => JSON.parse(store.get(vm.runInContext("SITES_KEY", ctx)) || "null"),
    click: (label) => ctx.thread.onclick({ target: { closest: (sel) => (sel === "[data-ans]" ? { getAttribute: () => label } : null) } }),
    clickSkip: () => ctx.thread.onclick({ target: { closest: (sel) => (sel === "[data-skip]" ? {} : null) } }),
    key: (key) => listeners.keydown({ key, target: { tagName: "BODY" }, preventDefault() {}, metaKey: false, ctrlKey: false, altKey: false }),
    release: (x) => { assert.ok(held.length, "nothing is waiting to be answered"); held.shift()(x); },
    bound: () => vm.runInContext("SITE_ROUTES_WAIT_MS", ctx),
    // The requests after the page-list read, as the tests below compare them.
    work: () => calls.filter((c) => !String(c.url).startsWith("/api/site/routes?")),
    reads: () => calls.filter((c) => String(c.url).startsWith("/api/site/routes?")).map((c) => c.url),
    thread: (id = "origin-1") => copy(site(id).msgs).map((m) => m.r + ": " + m.t),
    clarify: (id = "origin-1") => copy(site(id).clarify),
    pages: (id = "origin-1") => (site(id).pages || []).map((p) => p.path),
    busy: () => ctx.siteBusy,
    rail: () => (ctx.siteBuild ? ctx.reactStageLabel() : "(stopped)"),
  };
}

const IMG = "data:image/png;base64,iVBORw0KGgo=";
const ASK = "Make the footer navy";
const LOGO_ASK = "Use this picture as the logo";
const QUESTION = "What kind of business is this?";
const Q = { r: "a", t: QUESTION, q: QUESTION, opts: ["A guitar school", "A music shop"] };
const PAGES = ["/", "/prices", "/gear"];
// A site opened from its card on a browser that did not build it: `siteAdopt`'s
// own record — an address, `react`, an empty thread, and no pages.
const ADOPTED = { id: "origin-1", slug: "fretwork-1", react: true, name: "fretwork-1", url: "https://fretwork-1.gofarther.app/", html: "", msgs: [] };
const LOADED = { ...ADOPTED, pages: PAGES.map((p) => ({ path: p, name: p, html: "" })) };
const OTHER = { id: "origin-2", slug: "ashgrove-1", react: true, name: "Ashgrove", url: "https://ashgrove-1.gofarther.app/", html: "", msgs: [], pages: [{ path: "/", name: "Home", html: "" }] };
const NEW_PROJECT = { id: "origin-1", name: "A guitar school", html: "", msgs: [] };
// The round the missing-page-list defect stored on an existing site.
const ROUND = { ...ADOPTED, msgs: [{ r: "u", t: ASK }, Q], clarify: { brief: ASK, qa: [], imgs: [] } };
const LOGO_ROUND = { ...LOADED, msgs: [{ r: "u", t: LOGO_ASK }, Q], clarify: { brief: LOGO_ASK, qa: [], imgs: [IMG] } };

const json = (o) => JSON.stringify(o);
const ok200 = (o) => ({ status: 200, body: json(o) });
const LIST = ok200({ ok: true, slug: "fretwork-1", routes: PAGES });
const EDIT = ok200({ ok: true, intent: "edit", layer: "look", cost: 2 });
const LOGO = ok200({ ok: true, intent: "edit", layer: "logo", cost: 2 });
const BUILD = ok200({ ok: true, intent: "build", cost: 2 });
const NO_PAGES = "⚠️ I couldn’t load your site’s pages just now, so nothing on your site changed. Send it again in a moment.";
const SIGNED_OUT = "⚠️ You’re signed out. Sign in and send that again.";
const SKIP_SAID = "Skip the questions — just build it";

// THE LIVE SITE'S ROUTING CALL, as it must go out once the list is in hand.
function assertRoutedLive(call, message, extra = {}) {
  assert.equal(call.method + " " + call.url, "POST /api/site/route");
  const b = call.body;
  assert.equal(b.message, message, "the routing call carries the wrong message");
  assert.equal(b.firstBuild, false, "routed as a first build");
  assert.equal(b.hasSite, true, "routed as a site the account does not have");
  assert.equal(b.slug, "fretwork-1", "routed for the wrong site");
  assert.deepEqual(b.site.pages, PAGES, "routed without the site's page list");
  assert.equal(b.answering, false, "routed as the answer to a question");
  assert.deepEqual(b.qa, [], "a first-build interview rode along");
  for (const [k, v] of Object.entries(extra)) assert.deepEqual(b[k], v, "the routing call's " + k);
}
// THE EDIT THE SUPPLIED ANSWER STARTS, on the site the message was about.
function assertEdit(call, instruction, layer = "look", images) {
  assert.equal(call.method + " " + call.url, "POST /api/site/fretwork-1/edit");
  assert.equal(call.body.layer, layer);
  assert.equal(call.body.instruction, instruction, "the edit carries the wrong instruction");
  assert.deepEqual(call.body.images, images, "the attachments did not travel with the request");
}
// WHAT A WAIT OWES THE SCREEN: busy, the rail running, and nothing said yet.
function assertWaiting(h) {
  assert.equal(h.busy(), true, "the busy flag is not set while the list is read");
  assert.equal(h.rail(), "Thinking…", "the rail is not running while the list is read");
  assert.equal(h.clock.started, 1, "the rail's clock was not started");
  assert.equal(h.clock.cleared, 0, "the rail's clock stopped during the wait");
}
// WHAT A STOP OWES THE CUSTOMER: no routing call and no work, the busy flag and
// the rail cleared, and one sentence that claims nothing about money.
function assertStopped(h, sentence, thread) {
  assert.deepEqual(h.work(), [], "a routing call or work request went out without a page list");
  assert.deepEqual(h.thread(), thread.concat(["a: " + sentence]), "the customer is not told, in one sentence");
  assert.equal(h.busy(), false, "the busy flag is left set, so the next message cannot be sent");
  assert.equal(h.rail(), "(stopped)", "the rail is left running");
  assert.equal(h.clock.started, 1, "the rail's clock was not started when the message was sent");
  assert.equal(h.clock.cleared, 1, "the rail's clock was not cleared when it stopped");
  assert.equal(h.ctx.siteTicker, null, "a clock is left behind");
  assert.doesNotMatch(sentence, /charg|free|cost|credit/i, "the sentence claims something about money");
}

// ── THE PAGE LIST'S FOUR STATES, ON A TYPED MESSAGE ──────────────────────────

test("loaded: a site whose page list is in hand is routed as the live site at once, with no read", async () => {
  const h = workspace({ sites: [LOADED], route: [EDIT] });
  h.send(ASK);
  await settle();
  assert.deepEqual(h.reads(), [], "a list already in hand was read again");
  const work = h.work();
  assert.equal(work.length, 2);
  assertRoutedLive(work[0], ASK);
  assertEdit(work[1], ASK);
  assert.deepEqual(h.thread(), ["u: " + ASK]);
  assert.equal(h.busy(), true, "the edit is still in the air");
});

test("not loaded: the message waits for the list, then goes to the live site with it — never a first build", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [LIST], route: [BUILD] });
  h.send(ASK);
  await settle();
  assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"], "the list was not read, or read twice");
  const work = h.work();
  assertRoutedLive(work[0], ASK);
  // An explicit `build` on a live site is the revise of THAT site — how a
  // customer says "scrap this" — and never a new site with no slug.
  assert.deepEqual(work.slice(1).map((c) => c.url), ["/api/site/react-revise"]);
  assert.equal(work[1].body.slug, "fretwork-1", "the revise is not of this site");
  assert.ok(!work.some((c) => c.url === "/api/site/react-build"), "a new site was built");
  assert.deepEqual(h.pages(), PAGES, "the list it read did not land on the record");
  assert.deepEqual(h.thread(), ["u: " + ASK]);
});

test("not loaded, with a file attached: the attachment travels with the message through the wait", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }], route: [LOGO] });
  h.ctx.siteAttach = [IMG];
  h.send(LOGO_ASK);
  await settle();
  // Taken off the composer when the message was sent, so it belongs to this
  // message whatever happens on screen while the list is read.
  assert.deepEqual(copy(h.ctx.siteAttach), [], "the attachment was left in the composer");
  assertWaiting(h);
  h.release(LIST);
  await settle();
  assertRoutedLive(h.work()[0], LOGO_ASK, { attached: true });
  assertEdit(h.work()[1], LOGO_ASK, "logo", [IMG]);
});

test("a list a message read is not read again by the picker's next render", async () => {
  // A one-page site keeps the picker's gate open (`pages.length <= 1`), so the
  // next render calls the picker's fetch — and the message's read was this
  // load's one ask.
  const h = workspace({ sites: [ADOPTED], routes: [ok200({ ok: true, slug: "fretwork-1", routes: ["/"] })], route: [EDIT] });
  h.send(ASK);
  await settle();
  assert.deepEqual(h.pages(), ["/"]);
  h.ctx.siteRoutesFetch(h.records[0]);
  h.ctx.siteRoutesFetch(h.records[0]);
  await settle();
  assert.equal(h.reads().length, 1, "the picker read the list again after the message had");
});

test("delayed: nothing is routed while the list is in the air, and a second press and the picker's own read join the one request", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }], route: [EDIT] });
  h.send(ASK);
  await settle();
  assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"]);
  assert.deepEqual(h.work(), [], "the routing call went out before the list arrived");
  assertWaiting(h);
  assert.deepEqual(h.thread(), ["u: " + ASK], "the message is not on screen while it waits");
  // A second press is refused while the first waits, and the picker's render
  // path asks nothing new: the read in the air is the one they both wait on.
  h.send("Make the header red");
  h.ctx.siteRoutesFetch(h.records[0]);
  await settle();
  assert.equal(h.calls.length, 1, "a second request went out during the wait: " + JSON.stringify(h.calls.map((c) => c.url)));
  assert.deepEqual(h.thread(), ["u: " + ASK], "the second press reached the thread");
  h.release(LIST);
  await settle();
  const work = h.work();
  assert.equal(work.length, 2, "the message was routed more than once: " + JSON.stringify(work.map((c) => c.url)));
  assertRoutedLive(work[0], ASK);
  assertEdit(work[1], ASK);
  assert.deepEqual(h.reads().length, 1);
});

test("delayed: a message sent while the picker's read is already out waits on that same read", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }], route: [EDIT] });
  h.ctx.siteRoutesFetch(h.records[0]);
  h.send(ASK);
  await settle();
  assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"], "the message started a second read");
  assert.deepEqual(h.work(), []);
  assertWaiting(h);
  h.release(LIST);
  await settle();
  assert.equal(h.reads().length, 1);
  assertRoutedLive(h.work()[0], ASK);
  assertEdit(h.work()[1], ASK);
});

for (const [what, answer] of [
  ["the read is dropped", { reject: new TypeError("Failed to fetch") }],
  ["the read is aborted", { reject: aborted() }],
  ["a 500 carrying Cloudflare's HTML", { status: 500, body: "<!DOCTYPE html><title>Worker threw exception</title>", type: "text/html" }],
  ["a 503 carrying JSON", { status: 503, body: json({ ok: false, error: "unavailable" }) }],
  ["a 404", { status: 404, body: json({ ok: false, error: "not found" }) }],
  ["a 200 that is not JSON", { status: 200, body: "<html>oops</html>", type: "text/html" }],
  ["a 200 carrying ok:false", ok200({ ok: false, routes: PAGES })],
  ["a 200 whose routes are not a list", ok200({ ok: true, routes: "/" })],
]) {
  test("failed — " + what + ": nothing is routed, and the customer is told", async () => {
    const h = workspace({ sites: [ADOPTED], routes: [answer], route: [BUILD] });
    h.send(ASK);
    await settle();
    assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"]);
    assertStopped(h, NO_PAGES, ["u: " + ASK]);
    assert.deepEqual(h.pages(), [], "a list was written from a read that failed");
    assert.equal(h.clarify(), null);
  });
}

test("failed, then sent again: the next message asks for the list again, and is routed once it arrives", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ reject: new TypeError("Failed to fetch") }, LIST], route: [EDIT] });
  h.send(ASK);
  await settle();
  assertStopped(h, NO_PAGES, ["u: " + ASK]);
  h.send(ASK);
  await settle();
  assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1", "/api/site/routes?slug=fretwork-1"], "the failed read was not asked again");
  const work = h.work();
  assert.equal(work.length, 2);
  assertRoutedLive(work[0], ASK);
  assertEdit(work[1], ASK);
});

test("the wait is bounded: a read that never answers is aborted at the bound, and the message stops", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ hang: true }], route: [EDIT] });
  h.send(ASK);
  await settle();
  const bound = h.bound();
  assert.ok(Number.isFinite(bound) && bound > 0 && bound <= 30000, "the bound is not a bound: " + bound);
  const timer = h.timers.find((t) => t.ms === bound);
  assert.ok(timer, "the read was started with no bound");
  assert.equal(timer.cleared, false);
  assertWaiting(h);
  timer.fn();
  await settle();
  assertStopped(h, NO_PAGES, ["u: " + ASK]);
});

test("signed out: a 401 on the read says so, beside the sign-in gate, and sends nothing else", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ status: 401, body: json({ error: "unauthorized" }) }], route: [EDIT] });
  h.send(ASK);
  await settle();
  assertStopped(h, SIGNED_OUT, ["u: " + ASK]);
  assert.ok(h.events.includes("sign-in gate"), "the sign-in gate was not shown");
});

for (const [what, answer] of [
  ["answers no pages", ok200({ ok: true, slug: "fretwork-1", routes: [], why: "nothing stored — this site has not published a build yet" })],
  ["answers nothing that is a page", ok200({ ok: true, slug: "fretwork-1", routes: [["/menu"], 7, null, "menu"] })],
]) {
  test("empty — the read " + what + ": the site is stopped, never built", async () => {
    // The route answers `routes: []` both for a site that never published and
    // for a store read that failed, so empty cannot license a first build.
    const h = workspace({ sites: [ADOPTED], routes: [answer], route: [BUILD] });
    h.send(ASK);
    await settle();
    assertStopped(h, NO_PAGES, ["u: " + ASK]);
    assert.deepEqual(h.pages(), []);
  });
}

// ── A ROUND ON AN EXISTING SITE: THE ORIGINAL REQUEST, NEVER A NEW BUILD ─────

const ROUND_THREAD = ["u: " + ASK, "a: " + QUESTION];
for (const [door, act, said] of [
  ["skip (the owner's reproduction)", (h) => h.clickSkip(), SKIP_SAID],
  ["an option, clicked", (h) => h.click("A guitar school"), "A guitar school"],
  ["a typed reply", (h) => h.send("It's my guitar school"), "It's my guitar school"],
  ["the key for option 1", (h) => h.key("1"), "A guitar school"],
  ["Escape", (h) => h.key("Escape"), SKIP_SAID],
]) {
  test("an existing site's round, " + door + ": the ORIGINAL request goes to the live site once its list is in", async () => {
    const h = workspace({ sites: [ROUND], routes: [LIST], route: [EDIT] });
    act(h);
    await settle();
    assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"]);
    const work = h.work();
    assert.equal(work.length, 2, "wrong requests: " + JSON.stringify(work.map((c) => c.url)));
    assertRoutedLive(work[0], ASK, { brief: ASK, attached: false });
    assertEdit(work[1], ASK);
    assert.ok(!h.calls.some((c) => c.url === "/api/site/react-build"), "a new site was built");
    // The answer stays in the thread, and the round is over — on the screen as
    // well: the last redraw, taken while the work is still in the air, draws
    // the question with no buttons under it.
    assert.deepEqual(h.thread(), ROUND_THREAD.concat(["u: " + said]));
    assert.equal(h.clarify(), null, "the round was left behind, so the next message would answer it");
    assert.deepEqual(h.renders.at(-1), { open: "origin-1", question: false }, "the question's buttons are still drawn after the round ended");
  });
}

for (const [door, act] of [
  ["skip", (h) => h.clickSkip()],
  ["an option", (h) => h.click("A guitar school")],
  ["a typed reply", (h) => h.send("It's my guitar school")],
]) {
  test("an existing site's round, " + door + ": the original attachments travel with the original request", async () => {
    // The list is in hand here, so nothing is read — and the answer used to be
    // what went: "A guitar school" as the logo edit's instruction.
    const h = workspace({ sites: [LOGO_ROUND], route: [LOGO] });
    act(h);
    await settle();
    assert.deepEqual(h.reads(), []);
    const work = h.work();
    assert.equal(work.length, 2, "wrong requests: " + JSON.stringify(work.map((c) => c.url)));
    assertRoutedLive(work[0], LOGO_ASK, { brief: LOGO_ASK, attached: true });
    assertEdit(work[1], LOGO_ASK, "logo", [IMG]);
    assert.equal(h.clarify(), null);
  });
}

test("an existing site's round whose list cannot be read is kept, untouched, for the next press", async () => {
  const h = workspace({ sites: [ROUND], routes: [{ reject: new TypeError("Failed to fetch") }, LIST], route: [EDIT] });
  h.click("A guitar school");
  await settle();
  assertStopped(h, NO_PAGES, ROUND_THREAD.concat(["u: A guitar school"]));
  assert.deepEqual(h.clarify(), { brief: ASK, qa: [], imgs: [] }, "the round was changed by a press that sent nothing");
  // The next press tries again, and it is still the original request that goes.
  h.clickSkip();
  await settle();
  assert.equal(h.reads().length, 2);
  assertRoutedLive(h.work()[0], ASK, { brief: ASK });
  assertEdit(h.work()[1], ASK);
  assert.equal(h.clarify(), null);
});

// ── TIED TO THE SITE IT WAS SENT FROM, AND SENT ONCE ─────────────────────────

test("switching workspace during the wait cannot send the message to the site now on screen", async () => {
  const h = workspace({ sites: [ADOPTED, OTHER], routes: [{ defer: true }], route: [EDIT] });
  h.send(ASK);
  await settle();
  h.ctx.siteOpenId = "origin-2";
  // A press on the other site while the first waits is refused, not queued.
  h.send("Make the header red");
  await settle();
  assert.equal(h.calls.length, 1, "the other site's message went out during the wait");
  h.release(LIST);
  await settle();
  const work = h.work();
  assert.equal(work.length, 2);
  assertRoutedLive(work[0], ASK);
  assertEdit(work[1], ASK);
  assert.deepEqual(h.thread("origin-1"), ["u: " + ASK], "the message left the site it was sent from");
  assert.deepEqual(h.thread("origin-2"), [], "the other site's thread was written to");
  assert.equal(h.ctx.siteOpenId, "origin-2", "the workspace was switched back");
});

test("switching workspace during an existing site's round sends the original request to that site", async () => {
  const h = workspace({ sites: [ROUND, OTHER], routes: [{ defer: true }], route: [EDIT] });
  h.clickSkip();
  await settle();
  h.ctx.siteOpenId = "origin-2";
  h.release(LIST);
  await settle();
  assertRoutedLive(h.work()[0], ASK, { brief: ASK });
  assertEdit(h.work()[1], ASK);
  assert.equal(h.clarify("origin-1"), null);
  assert.deepEqual(h.thread("origin-2"), []);
});

test("a site removed during the wait is sent nothing, and the workspace is freed", async () => {
  const h = workspace({ sites: [ADOPTED, OTHER], routes: [{ defer: true }], route: [EDIT] });
  h.send(ASK);
  await settle();
  h.records.splice(0, 1);
  h.ctx.siteOpenId = "origin-2";
  h.release(LIST);
  await settle();
  assert.deepEqual(h.work(), [], "a message went out for a site that is gone");
  assert.equal(h.busy(), false);
  assert.equal(h.rail(), "(stopped)");
  assert.deepEqual(h.thread("origin-2"), []);
});

test("a site whose address changed during the wait is stopped rather than routed under the other address", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }], route: [EDIT] });
  h.send(ASK);
  await settle();
  h.records[0].slug = "fretwork-2";
  h.release(LIST);
  await settle();
  assertStopped(h, NO_PAGES, ["u: " + ASK]);
});

test("pressing again and again during the wait sends the message once", async () => {
  const h = workspace({ sites: [ROUND], routes: [{ defer: true }], route: [EDIT] });
  h.clickSkip();
  h.clickSkip();
  h.click("A guitar school");
  h.key("Escape");
  h.send("It's my guitar school");
  await settle();
  assert.equal(h.calls.length, 1, "more than one request during the wait");
  assert.deepEqual(h.thread(), ROUND_THREAD.concat(["u: " + SKIP_SAID]), "a refused press reached the thread");
  h.release(LIST);
  await settle();
  assert.equal(h.work().length, 2, "the request went out more than once: " + JSON.stringify(h.work().map((c) => c.url)));
});

// ── A MESSAGE THE CHECK STOPPED KEEPS ITS WORDS AND ITS FILES ────────────────

// Pictures as the real attach code makes them out of a file.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PNG2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const LOGO_FILE = { name: "logo.png", type: "image/png", size: 68, dataUrl: PNG };
const PHOTO_FILE = { name: "shopfront.png", type: "image/png", size: 68, dataUrl: PNG2 };
const LOGO_ATT = { name: "logo.png", data: PNG };
const PHOTO_ATT = { name: "shopfront.png", data: PNG2 };
// The owner's words, with their full stop.
const OWNER_ASK = "Use this picture as the logo.";
const INSTEAD = "Use this one as the logo instead.";
const FAIL = { reject: new TypeError("Failed to fetch") };

// Attach the logo through the real attach code, type the owner's words in the
// box, and press the Send button that is drawn.
async function sendWithLogo(h) {
  await h.attach([LOGO_FILE]);
  assert.deepEqual(h.strip(), [LOGO_ATT], "the attach code did not make the attachment");
  assert.deepEqual(h.drawn(), [PNG], "the strip does not draw the picture");
  h.type(OWNER_ASK);
  h.pressSend();
  await settle();
}
// The stopped message back in its site's composer, whole.
function assertBack(h, words, files, pictures) {
  assert.equal(h.box(), words, "the words did not come back to the box");
  assert.deepEqual(h.strip(), files, "the files did not come back to the strip");
  assert.deepEqual(h.drawn(), pictures, "the strip does not draw what it holds");
  assert.equal(h.held(), null, "the message is still held after it came back");
  assert.ok(h.sendDrawn(), "the Send button is not drawn");
}

test("the owner's reproduction: the list fails with a picture attached, the words and the picture come back to the site's composer, and sending again puts THAT picture on the logo edit", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [FAIL, LIST], route: [LOGO] });
  await sendWithLogo(h);
  // The stop, as before: nothing routed, one sentence, the workspace free.
  assert.deepEqual(h.reads(), ["/api/site/routes?slug=fretwork-1"]);
  assertStopped(h, NO_PAGES, ["u: " + OWNER_ASK]);
  // AND THE MESSAGE IS BACK WHERE IT WAS WRITTEN — the same object the attach
  // code made, drawn in the strip — and nothing has been sent again by itself.
  assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
  assert.equal(h.calls.length, 1, "something was sent without a press");
  // SENT AGAIN WITH THE SAME BUTTON: what the box and the strip hold.
  h.pressSend();
  await settle();
  assert.equal(h.reads().length, 2, "the list was not asked for again");
  const work = h.work();
  assert.equal(work.length, 2, "wrong requests: " + JSON.stringify(work.map((c) => c.url)));
  assertRoutedLive(work[0], OWNER_ASK, { attached: true });
  assertEdit(work[1], OWNER_ASK, "logo", [LOGO_ATT]);
  assert.deepEqual(h.strip(), [], "the picture was left in the composer after it was sent");
  assert.deepEqual(h.thread(), ["u: " + OWNER_ASK, "a: " + NO_PAGES, "u: " + OWNER_ASK]);
});

for (const [why, answer, sentence, reach] of [
  ["the list is empty", ok200({ ok: true, slug: "fretwork-1", routes: [] }), NO_PAGES],
  ["the read is refused as signed out", { status: 401, body: json({ error: "unauthorized" }) }, SIGNED_OUT],
  ["the read runs out its bound", { hang: true }, NO_PAGES, (h) => h.timers.find((t) => t.ms === h.bound()).fn()],
]) {
  test("every stop before routing keeps the message — " + why, async () => {
    const h = workspace({ sites: [ADOPTED], routes: [answer], route: [LOGO] });
    await sendWithLogo(h);
    if (reach) { reach(h); await settle(); }
    assertStopped(h, sentence, ["u: " + OWNER_ASK]);
    assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
  });
}

for (const [where, elsewhere] of [["another site", "origin-2"], ["the start screen", null]]) {
  test("switched to " + where + " while the list is read: nothing comes back into its composer, and the message comes back when its own site is opened", async () => {
    const h = workspace({ sites: [ADOPTED, OTHER], routes: [{ defer: true }, LIST], route: [LOGO] });
    await sendWithLogo(h);
    assertWaiting(h);
    h.open(elsewhere);
    h.release(FAIL);
    await settle();
    assert.deepEqual(h.work(), []);
    assert.deepEqual(h.thread(), ["u: " + OWNER_ASK, "a: " + NO_PAGES], "the stop was not said on the site it was sent from");
    assert.deepEqual(h.thread("origin-2"), [], "the other site's thread was written to");
    assert.equal(h.busy(), false);
    // NOTHING COMES BACK HERE — not on this screen's next redraw either.
    h.redraw();
    assert.deepEqual(h.strip(), [], "the stopped message's picture came back into " + where);
    assert.deepEqual(h.drawn(), [], "the stopped message's picture is drawn on " + where);
    assert.ok(!h.box(), "the stopped message's words came back into " + where);
    assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }], "the message is not held on its own site");
    assert.equal(h.held("origin-2"), null, "the message was held on the other site");
    // Its own site opened again: it comes back there, and goes from there.
    h.open("origin-1");
    assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
    h.pressSend();
    await settle();
    const work = h.work();
    assertRoutedLive(work[0], OWNER_ASK, { attached: true });
    assertEdit(work[1], OWNER_ASK, "logo", [LOGO_ATT]);
  });
}

test("a picture chosen while the list is read is left exactly as it is, and the stopped message waits until the strip is clear, then comes back whole", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }, LIST], route: [LOGO] });
  await sendWithLogo(h);
  await h.attach([PHOTO_FILE]);
  assert.deepEqual(h.strip(), [PHOTO_ATT]);
  h.release(FAIL);
  await settle();
  assertStopped(h, NO_PAGES, ["u: " + OWNER_ASK]);
  // The new choice as it was: not replaced, not joined, not moved.
  assert.deepEqual(h.strip(), [PHOTO_ATT], "the picture chosen during the wait was changed");
  assert.deepEqual(h.drawn(), [PNG2]);
  // The stopped message did not come back beside it: the logo rung uses the
  // FIRST attachment, so its words would go out with the wrong picture.
  assert.equal(h.box(), "", "the stopped message's words came back beside another picture");
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }], "the stopped message was not kept");
  h.redraw();
  assert.deepEqual(h.strip(), [PHOTO_ATT], "a redraw changed the picture chosen during the wait");
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }]);
  // The new picture taken off with its own ×; the next redraw hands the stopped
  // message back, and it goes as it was written.
  h.unattach(0);
  assert.deepEqual(h.strip(), []);
  h.redraw();
  assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
  h.pressSend();
  await settle();
  const work = h.work();
  assertRoutedLive(work[0], OWNER_ASK, { attached: true });
  assertEdit(work[1], OWNER_ASK, "logo", [LOGO_ATT]);
});

test("a message sent while another waits to come back goes with its own files and no others", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }, LIST], route: [EDIT] });
  await sendWithLogo(h);
  await h.attach([PHOTO_FILE]);
  h.release(FAIL);
  await settle();
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }]);
  // The picture chosen during the wait is taken off, so the strip is clear —
  // and before anything redraws, a message with no file is typed and sent.
  // `siteSend` redraws BEFORE it takes the strip: had the held message been
  // handed back on that redraw, its picture would have left with these words.
  h.unattach(0);
  h.type(ASK);
  h.pressSend();
  await settle();
  const work = h.work();
  assert.equal(work.length, 2, "wrong requests: " + JSON.stringify(work.map((c) => c.url)));
  assertRoutedLive(work[0], ASK, { attached: false });
  assertEdit(work[1], ASK);
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }], "the stopped message was handed back while another was being sent");
  assert.deepEqual(h.strip(), [], "the stopped message's picture was put back while another message was in the air");
});

test("two messages stopped on one site each come back with their own words and files, the latest first", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }, FAIL, LIST], route: [LOGO] });
  await sendWithLogo(h);
  await h.attach([PHOTO_FILE]);
  h.release(FAIL);
  await settle();
  // The first is held, the strip not being clear; the new picture goes with
  // words of its own, and stops too.
  h.type(INSTEAD);
  h.pressSend();
  await settle();
  assert.deepEqual(h.thread(), ["u: " + OWNER_ASK, "a: " + NO_PAGES, "u: " + INSTEAD, "a: " + NO_PAGES]);
  assert.deepEqual(h.work(), []);
  // The latest comes back first — it is the one the sentence on screen is about.
  assert.equal(h.box(), INSTEAD);
  assert.deepEqual(h.strip(), [PHOTO_ATT]);
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }]);
  // Its picture taken off, the next redraw brings back the first, whole.
  h.unattach(0);
  h.redraw();
  assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
  h.pressSend();
  await settle();
  const work = h.work();
  assertRoutedLive(work[0], OWNER_ASK, { attached: true });
  assertEdit(work[1], OWNER_ASK, "logo", [LOGO_ATT]);
});

test("with the history rail open no composer is drawn, so the stopped message waits and comes back when the chat is drawn", async () => {
  const h = workspace({ sites: [ADOPTED], routes: [{ defer: true }, LIST], route: [LOGO] });
  await sendWithLogo(h);
  h.showRail("history");
  h.release(FAIL);
  await settle();
  assert.deepEqual(h.thread(), ["u: " + OWNER_ASK, "a: " + NO_PAGES]);
  assert.equal(h.box(), null, "a box is drawn on the history rail");
  assert.deepEqual(h.strip(), [], "the picture was put in a strip nobody can see");
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }], "the message was used up with no composer to take it");
  h.showRail("chat");
  assertBack(h, OWNER_ASK, [LOGO_ATT], [PNG]);
});

test("a stopped message is kept in memory and never written to storage", async () => {
  // Stopped with another site on screen, so it is still held when the stop is
  // saved.
  const h = workspace({ sites: [ADOPTED, OTHER], routes: [{ defer: true }], route: [LOGO] });
  await sendWithLogo(h);
  h.open("origin-2");
  h.release(FAIL);
  await settle();
  assert.deepEqual(h.held(), [{ t: OWNER_ASK, imgs: [LOGO_ATT] }]);
  const saved = h.stored();
  assert.ok(Array.isArray(saved), "nothing was saved");
  const rec = saved.find((r) => r.id === "origin-1");
  assert.deepEqual(rec.msgs.map((m) => m.r + ": " + m.t), ["u: " + OWNER_ASK, "a: " + NO_PAGES], "the stop was not saved");
  assert.ok(!("unsent" in rec), "the held message was written to storage");
  assert.ok(!JSON.stringify(saved).includes(PNG), "a held picture reached storage");
});

// ── A GENUINE NEW PROJECT KEEPS EVERYTHING IT HAD ────────────────────────────

test("a new project's message is still a first build, with no page-list read", async () => {
  const h = workspace({ sites: [NEW_PROJECT], route: [BUILD] });
  h.send("A guitar school in Leeds");
  await settle();
  assert.deepEqual(h.reads(), [], "a project with no address asked for its pages");
  const [routed, build] = h.work();
  assert.equal(routed.body.firstBuild, true);
  assert.equal(routed.body.hasSite, false);
  assert.equal(routed.body.slug, "");
  assert.deepEqual(build, { method: "POST", url: "/api/site/react-build", body: { brief: "A guitar school in Leeds", images: [], picker: "grok", qa: [], chat: "origin-1" } });
});

test("a new project whose routing call fails still starts its first build (its documented default)", async () => {
  const h = workspace({ sites: [NEW_PROJECT], route: [{ reject: new TypeError("Failed to fetch") }] });
  h.send("A guitar school in Leeds");
  await settle();
  assert.deepEqual(h.work().map((c) => c.url), ["/api/site/route", "/api/site/react-build"]);
});

const NEW_ROUND = { ...NEW_PROJECT, msgs: [{ r: "u", t: "A school in Leeds" }, Q], clarify: { brief: "A school in Leeds", qa: [], imgs: [IMG] } };
test("a new project's round is still an interview: an answer is routed as one, with the brief and its files", async () => {
  for (const [door, act, said] of [
    ["an option", (h) => h.click("A guitar school"), "A guitar school"],
    ["a typed reply", (h) => h.send("Guitar and bass"), "Guitar and bass"],
    ["the key for option 1", (h) => h.key("1"), "A guitar school"],
  ]) {
    const h = workspace({ sites: [NEW_ROUND], route: [BUILD] });
    act(h);
    await settle();
    assert.deepEqual(h.reads(), [], door);
    const [routed, build] = h.work();
    assert.equal(routed.body.message, said, door);
    assert.equal(routed.body.firstBuild, true, door);
    assert.equal(routed.body.answering, true, door);
    assert.equal(routed.body.brief, "A school in Leeds", door);
    assert.deepEqual(routed.body.qa, [{ q: QUESTION, a: said }], door);
    assert.equal(build.url, "/api/site/react-build", door);
    assert.deepEqual(build.body.images, [IMG], door + ": the round's files did not reach the build");
    assert.deepEqual(build.body.qa, [{ q: QUESTION, a: said }], door);
  }
});

test("a new project's round, skipped, still goes straight to the build with no routing call", async () => {
  for (const act of [(h) => h.clickSkip(), (h) => h.key("Escape")]) {
    const h = workspace({ sites: [NEW_ROUND], route: [BUILD] });
    act(h);
    await settle();
    assert.deepEqual(h.calls, [{ method: "POST", url: "/api/site/react-build", body: { brief: "A school in Leeds", images: [IMG], picker: "grok", qa: [], chat: "origin-1" } }]);
    assert.equal(h.clarify(), null);
  }
});
