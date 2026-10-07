// WORK THAT FINISHES WHILE THE PAGE WATCHES, AND HISTORY THAT HAD FINISHED
// BEFORE IT LOOKED (2026-10-05).
//
// The owner, reviewing the placement fix: *"siteRequestJobReply treats every
// request with own:false as historical and passes blank origin/slug and a null
// site into the result reader. That also includes requests still running when
// this browser opens. I reproduced a request observed as started completing
// with added:["src/routes/gallery.tsx"] and tables:["bookings"]: its model
// reply appears and the job enters shown[], but the page picker stays at "/",
// the table list stays empty and previewV does not advance. The own:true
// control updates all three. Distinguish completed history already reflected
// in the loaded site from work that completes while this browser is watching.
// Refresh the current published preview and page/table metadata when needed
// without replaying old edits, recreating undo offers, restoring obsolete
// questions, or overwriting newer state with an older job's result."*
//
// The page's own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`), against a SCRIPTED server: each case says
// when a request's job finishes, what its stored answer says, what pages the
// site keeps, and which answers are held back. The stored answers have the
// shape the owner reproduced with. Every answer is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";

const SLUG = "fold-lane-bakery";
const KEY = (n) => "liverequest" + String(n).padStart(11, "0");
const JOB = (n) => "livejob" + String(n).padStart(25, "0");
// AN HOUR AGO BY THE REAL CLOCK (2026-10-07): the page keeps a request's
// record two days (`SITE_REQ_KEEP_MS`) by the real clock, and the fixed date
// this was expired the records under the cases — a request this browser sent
// read back as one it picked up from the server.
const T0 = Date.now() - 60 * 60 * 1000;
const siteFor = (paths = ["/"], extra = {}) => ({
  id: "origin-1", slug: SLUG, react: true, name: "Fold Lane Bakery", url: "https://" + SLUG + ".gofarther.app/",
  pages: paths.map((path) => ({ path })), msgs: [], ...extra,
});
const part = (n, words, status, jobs = [], route = "addon") => ({ n, words, status, ids: jobs.slice(), jobs: jobs.slice(), charged: 0, route });
const view = (key, at, parts, ended = false) => ({ key, state: ended ? "done" : "running", ended, stop: false, at, updatedAt: at, routedUnsaid: 0, parts });
// THE OWNER'S REPRODUCTION: an addition that made a page and a table.
const ADDED = {
  ok: true, kinds: ["page", "table"], added: ["src/routes/gallery.tsx"], tables: ["bookings"], cost: 9,
  reply: "✅ Your Gallery page is up, and bookings now have a table of their own.", replySource: "model",
};
// A PAGE TAKEN AWAY, and a row with it — the kind of change that offers an undo.
const REMOVED = {
  ok: true, layer: "page", removed: ["src/routes/visit.tsx"], applied: [{ table: "loaves", id: 3, removed: true, was: { name: "Rye" } }], cost: 0,
  reply: "✅ The Visit page is gone, and so is the Rye loaf.", replySource: "model",
};
const GALLERY_GONE = { ok: true, layer: "page", removed: ["src/routes/gallery.tsx"], cost: 0, reply: "✅ The Gallery page is gone.", replySource: "model" };
const CONTACT = { ok: true, kinds: ["page"], added: ["src/routes/contact.tsx"], cost: 6, reply: "✅ Your Contact page is up.", replySource: "model" };

/**
 * THE SERVER, SCRIPTED. `views` and `answers` are its requests and its jobs'
 * stored answers; `routes` the pages the site keeps. A held answer waits for
 * `release(name)`; a routes read answers with the pages as they were when it
 * was asked, as a read in flight would.
 */
function server() {
  const S = { views: new Map(), answers: new Map(), routes: ["/"], calls: [], question: null, onRoute: null };
  const holds = [];
  S.hold = (name, match) => { let open; const p = new Promise((ok) => { open = ok; }); holds.push({ name, match, p, open, used: false }); };
  S.release = (name) => { for (const h of holds) if (h.name === name) h.open(); };
  const reply = (url, method, body) => {
    if (url === "/api/site/requests/" + SLUG) return { status: 200, body: { ok: true, requests: [...S.views.values()].sort((a, b) => a.at - b.at).map(copy) } };
    if (url.startsWith("/api/site/request/" + SLUG + "/")) {
      const v = S.views.get(url.split("/").pop());
      return v ? { status: 200, body: { ok: true, request: copy(v) } } : { status: 404, body: { error: "not found" } };
    }
    if (url.startsWith("/api/site/edit/")) {
      const a = S.answers.get(url.split("/").pop());
      return a ? { status: 200, headers: { "x-gf-edit": "final" }, body: copy(a) } : { status: 200, body: { ok: true, status: "building" } };
    }
    if (url === "/api/site/" + SLUG + "/question") return { status: 200, body: { ok: true, question: S.question ? copy(S.question) : null } };
    if (url === "/api/site/route" && S.onRoute) return S.onRoute(body);
    return { status: 200, body: { ok: true } };
  };
  S.answer = (url, method, body) => {
    S.calls.push({ url, method, body });
    // A ROUTES READ answers with the pages as they are when it is asked.
    const now = url.startsWith("/api/site/routes?") ? { status: 200, body: { ok: true, slug: SLUG, routes: S.routes.slice() } } : null;
    const h = holds.find((x) => !x.used && x.match(url, method));
    if (h) { h.used = true; return h.p.then(() => now || reply(url, method, body)); }
    return Promise.resolve(now || reply(url, method, body));
  };
  return S;
}
/** One page load: a fresh browser's record of the site, or `site` as a reload finds it. */
function openPage(S, site, tag = "pagekey") {
  const p = page({ site: site || siteFor(), answer: S.answer, timers: true });
  let n = 0;
  p.ctx.EditPoll.newIdemKey = () => tag + String(++n).padStart(20 - tag.length, "0");
  return p;
}
/** Opened as the real page is: its held replies followed, its question and its requests read. */
function opened(p) {
  p.ctx.siteHeldRepliesCheck(p.s);
  p.ctx.siteAskCheck(p.s);
  p.ctx.siteRequestsCheck(p.s);
  return p;
}
const idle = async () => { await drain(); await drain(); };
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
// READ OUT OF THE PAGE'S OWN REALM (its arrays are not this file's), by value.
const paths = (p) => copy((p.s.pages || []).map((x) => x.path));
const said = (p, key) => copy(p.s.msgs.filter((m) => m.r === "a" && m.req === key && m.job).map((m) => m.job));
const routesReads = (S) => S.calls.filter((c) => c.url.startsWith("/api/site/routes?")).length;
/** What a page's own sentences put in place: the outcome's marks this browser keeps. */
const kept = (p) => ({ previewV: p.s.previewV, pages: paths(p), tables: copy(p.s.tables || []), undo: copy(p.s.undoRows || null), ask: p.ask(), unsent: (p.s.unsent || []).length });
/** A request another browser is running, its addition not finished yet. */
function running(S, key, at, words = "Add a gallery page with bookings", n = 1, route = "addon") {
  S.views.set(key, view(key, at, [part(0, words, "started", [], route)]));
  return { finish: (answer, routes) => {
    S.answers.set(JOB(n), answer);
    S.views.set(key, view(key, at, [part(0, words, "done", [JOB(n)], route)], true));
    if (routes) S.routes = routes;
  } };
}

test("LIVE 1 — another browser open while a request runs: when its addition finishes, the preview moves to what is published now, the page list is read again from the server, and the table joins the list — once, however often the page looks; no undo, question or words in the box", async () => {
  const S = server();
  const r = running(S, KEY(1), T0);
  const b = opened(openPage(S, siteFor(["/"])));
  await idle();
  await looks(b);
  assert.deepEqual(kept(b), { previewV: undefined, pages: ["/"], tables: [], undo: null, ask: null, unsent: 0 });
  assert.equal(b.s.requests[KEY(1)].own, false);
  // THE ADDITION FINISHES WHILE THIS PAGE WATCHES.
  r.finish(ADDED, ["/", "/gallery"]);
  await looks(b);
  assert.deepEqual(said(b, KEY(1)), [JOB(1)], "the reply is not under the request");
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/", "/gallery"], tables: ["bookings"], undo: null, ask: null, unsent: 0 });
  assert.equal(b.s.pages[1].name, "Gallery");
  // AND ONCE: looking again — the request, the held replies, a reading of the same view — changes nothing.
  const reads = routesReads(S);
  b.ctx.siteRequestFollow(b.s.id, KEY(1));
  b.ctx.siteHeldRepliesCheck(b.s);
  await b.ctx.siteRequestShow(b.s.id, KEY(1), copy(S.views.get(KEY(1))), null, null, null);
  await looks(b);
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/", "/gallery"], tables: ["bookings"], undo: null, ask: null, unsent: 0 }, "a second look applied it again");
  assert.deepEqual(said(b, KEY(1)), [JOB(1)], "a second look said it again");
  assert.equal(routesReads(S), reads, "a second look read the pages again");
});

test("LIVE 1 control — the same addition sent from this page: its own outcome applied as ever, all three", async () => {
  const S = server();
  S.views.set(KEY(2), view(KEY(2), T0, [part(0, "Add a gallery page with bookings", "started")]));
  const a = openPage(S, siteFor(["/"]));
  a.ctx.siteRequestStart(a.s.id, { intent: "edit", request: copy(S.views.get(KEY(2))) }, [], "");
  await idle();
  assert.equal(a.s.requests[KEY(2)].own, true);
  S.answers.set(JOB(1), ADDED);
  S.views.set(KEY(2), view(KEY(2), T0, [part(0, "Add a gallery page with bookings", "done", [JOB(1)])], true));
  await looks(a);
  assert.deepEqual([a.s.previewV, paths(a), copy(a.s.tables)], [1, ["/", "/gallery"], ["bookings"]]);
  assert.equal(routesReads(S), 0, "this page's own outcome was read from the server instead of applied");
});

test("LIVE 2 — a page taken away while this page watches another browser's request: it leaves the page list as the server now keeps it, the preview moves, and no undo is offered for that browser's row", async () => {
  const S = server();
  S.routes = ["/", "/visit"];
  const r = running(S, KEY(3), T0, "Take the Visit page down and the Rye loaf off", 1, "page");
  const b = opened(openPage(S, siteFor(["/", "/visit"], { undoRows: null })));
  await idle();
  await looks(b);
  r.finish(REMOVED, ["/"]);
  await looks(b);
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/"], tables: [], undo: null, ask: null, unsent: 0 });
  assert.deepEqual(said(b, KEY(3)), [JOB(1)]);
});

test("LIVE 3 — history (finished before this page first looked): shown once and reconciled with what is published now — the preview moved on, its tables kept, its page changes read again from the server — and never replayed: no undo offer, question or words in the box; once", async () => {
  const S = server();
  S.views.set(KEY(4), view(KEY(4), T0, [part(0, "Add a gallery page with bookings", "done", [JOB(1)])], true));
  S.answers.set(JOB(1), ADDED);
  S.views.set(KEY(5), view(KEY(5), T0 + 60000, [part(0, "Take the Visit page down and the Rye loaf off", "done", [JOB(2)], "page")], true));
  S.answers.set(JOB(2), REMOVED);
  // THE PAGES AS THE SERVER KEEPS THEM NOW: the Visit page gone, and a Contact
  // page a later change made — a list no replay of the two jobs could give.
  S.routes = ["/", "/gallery", "/contact"];
  const site = siteFor(["/", "/gallery", "/visit"]);
  site.pages[1].name = "Our Gallery";
  const b = opened(openPage(S, site));
  await idle();
  await looks(b);
  assert.deepEqual(said(b, KEY(4)), [JOB(1)]);
  assert.deepEqual(said(b, KEY(5)), [JOB(2)]);
  // RECONCILED, NOT REPLAYED (2026-10-05, the owner's review): the page cannot
  // tell whether its preview was loaded before or after these jobs published,
  // so the preview is moved on; their tables are kept; no undo for the row.
  // ONCE FOR BOTH SINCE 2026-10-07: this was a move per job (the limit kept
  // since 2026-10-05), and everything the page's first look finds finished now
  // moves the preview once (`sitePreviewHold`).
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/", "/gallery", "/contact"], tables: ["bookings"], undo: null, ask: null, unsent: 0 });
  assert.equal(b.s.pages[1].name, "Our Gallery", "a page kept lost its own name");
  // AND ONCE: looking again reads nothing more and changes nothing.
  const reads = routesReads(S);
  assert.ok(reads >= 1);
  await looks(b);
  b.ctx.siteHeldRepliesCheck(b.s);
  await looks(b);
  assert.equal(routesReads(S), reads, "a second look read the pages again");
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/", "/gallery", "/contact"], tables: ["bookings"], undo: null, ask: null, unsent: 0 }, "a second look reconciled again");
  // THE SAME FOR THIS BROWSER'S OWN REQUEST, FINISHED WHILE IT WAS CLOSED: shown, not replayed —
  // AND, SINCE 2026-10-07, ITS UNDO OFFER KEPT: the rows its edit took away are
  // the ones the next message may put back, as the reader would have kept them
  // (the limit "your own job found done by a late first read is reconciled
  // without its undo offer", resolved). The other browser's history above still
  // offers none.
  const own = siteFor(["/", "/gallery", "/visit"]);
  own.msgs = [{ r: "u", t: "Take the Visit page down and the Rye loaf off", req: KEY(5) }, { r: "a", t: "", request: KEY(5) }];
  own.requests = { [KEY(5)]: { at: T0 + 60000, view: view(KEY(5), T0 + 60000, [part(0, "Take the Visit page down and the Rye loaf off", "started", [], "page")]), shown: [], replied: false, replies: [], closed: false, approving: [], own: true } };
  const c = opened(openPage(S, own, "pagec"));
  await idle();
  await looks(c);
  assert.deepEqual(said(c, KEY(5)), [JOB(2)]);
  assert.deepEqual(kept(c), { previewV: 1, pages: ["/", "/gallery", "/contact"], tables: ["bookings"], undo: [{ table: "loaves", was: { name: "Rye" } }], ask: null, unsent: 0 }, "this browser's own history was replayed, not reconciled, or lost its undo offer");
  // AND A HISTORY JOB THAT CHANGED NO PAGE reads no page list; it moves the preview on, once.
  const S2 = server();
  S2.views.set(KEY(21), view(KEY(21), T0, [part(0, "Change the home page heading", "done", [JOB(1)], "text")], true));
  S2.answers.set(JOB(1), { ok: true, layer: "text", changed: ["src/routes/index.tsx"], files: 1, cost: 1, reply: "✅ The heading now reads “Fed every morning”.", replySource: "model" });
  const d = opened(openPage(S2, siteFor(["/", "/visit"]), "paged"));
  await idle();
  await looks(d);
  assert.deepEqual(said(d, KEY(21)), [JOB(1)]);
  assert.deepEqual([routesReads(S2), d.s.previewV, paths(d)], [0, 1, ["/", "/visit"]]);
});

test("LIVE 4 — a routing answer lost on the way back, though the server took the message; the page reloaded: the request is picked up, and its addition finishing afterwards updates the preview, pages and tables, its reply with its card", async () => {
  const S = server();
  S.onRoute = (body) => {
    S.views.set(body.idem, view(body.idem, T0, [part(0, body.message, "started")]));
    return { reject: new Error("connection reset") };
  };
  const a = openPage(S, siteFor(["/"]));
  a.ctx.siteSend("Add a gallery page with bookings");
  await idle();
  const taken = [...S.views.keys()][0];
  assert.ok(taken, "the server did not take the message");
  assert.equal(a.s.requests, undefined, "the page learned of a request it was never told about");
  // RELOADED: the site as `sitesSave` keeps it (nothing held in memory).
  const site = copy(a.s);
  delete site.unsent;
  const b = opened(openPage(S, site, "pageb"));
  await idle();
  await looks(b);
  assert.ok(b.s.msgs.some((m) => m.request === taken), "the reloaded page has no card for the request");
  assert.equal(b.s.requests[taken].own, false);
  // THE ADDITION FINISHES NOW.
  S.answers.set(JOB(1), ADDED);
  S.views.set(taken, view(taken, T0, [part(0, "Add a gallery page with bookings", "done", [JOB(1)])], true));
  S.routes = ["/", "/gallery"];
  await looks(b);
  assert.deepEqual(said(b, taken), [JOB(1)]);
  assert.deepEqual(kept(b), { previewV: 1, pages: ["/", "/gallery"], tables: ["bookings"], undo: null, ask: null, unsent: 0 });
  // ITS REPLY UNDER ITS CARD, the card after the message and the page's sentence about it.
  const at = (f) => b.s.msgs.findIndex(f);
  assert.ok(at((m) => m.r === "u") < at((m) => m.request === taken) && at((m) => m.request === taken) < at((m) => m.job === JOB(1)));
});

test("LIVE 5 — an older job read late cannot undo a newer change: a page added by one request and taken away by a later one stays away, whichever the page reads first", async () => {
  const S = server();
  const add = running(S, KEY(6), T0, "Add a gallery page with bookings", 1);
  const drop = running(S, KEY(7), T0 + 60000, "Take the Gallery page down", 2, "page");
  // THE ADDITION'S ANSWER IS HELD BACK: the page reads the later removal first.
  S.hold("older", (url) => url === "/api/site/edit/" + JOB(1));
  const b = opened(openPage(S, siteFor(["/"])));
  await idle();
  await looks(b);
  add.finish(ADDED);
  drop.finish(GALLERY_GONE, ["/"]);
  await looks(b);
  assert.deepEqual(said(b, KEY(7)), [JOB(2)]);
  assert.deepEqual(paths(b), ["/"]);
  S.release("older");
  await looks(b, 4);
  assert.deepEqual(said(b, KEY(6)), [JOB(1)]);
  assert.deepEqual(paths(b), ["/"], "the older addition, read late, put back a page the newer change took away");
  assert.deepEqual([b.s.previewV, copy(b.s.tables)], [2, ["bookings"]]);
});

test("LIVE 6 — a read of the pages begun before a newer change is never applied over it: the latest read wins, and a list changed while a read was out is read again", async () => {
  const S = server();
  // TWO REQUESTS FROM ANOTHER BROWSER: the first read of the pages is held, and the second change lands first.
  const add = running(S, KEY(8), T0, "Add a gallery page with bookings", 1);
  const drop = running(S, KEY(9), T0 + 60000, "Take the Gallery page down", 2, "page");
  S.hold("first read", (url) => url.startsWith("/api/site/routes?"));
  const b = opened(openPage(S, siteFor(["/"])));
  await idle();
  await looks(b);
  add.finish(ADDED, ["/", "/gallery"]);
  await looks(b);
  // THE FIRST READ IS OUT, AND HOLDS THE GALLERY; THEN THE REMOVAL, READ AT ONCE.
  drop.finish(GALLERY_GONE, ["/"]);
  await looks(b);
  assert.deepEqual(paths(b), ["/"]);
  S.release("first read");
  await looks(b);
  assert.deepEqual(paths(b), ["/"], "a read begun before the removal put the page back");
  // AND A LIST THIS PAGE CHANGED WHILE A READ WAS OUT: read again, never overwritten.
  const S2 = server();
  const other = running(S2, KEY(10), T0, "Add a gallery page with bookings", 1);
  S2.views.set(KEY(11), view(KEY(11), T0 + 60000, [part(0, "Add a contact page", "started")]));
  S2.hold("stale", (url) => url.startsWith("/api/site/routes?"));
  const c = opened(openPage(S2, siteFor(["/"])));
  await idle();
  await looks(c);
  // THIS PAGE'S OWN REQUEST (sent from here) and another browser's both finish; the other's read is held.
  c.ctx.siteRequestStart(c.s.id, { intent: "edit", request: copy(S2.views.get(KEY(11))) }, [], "");
  await idle();
  other.finish(ADDED, ["/", "/gallery"]);
  await looks(c);
  S2.answers.set(JOB(2), CONTACT);
  S2.views.set(KEY(11), view(KEY(11), T0 + 60000, [part(0, "Add a contact page", "done", [JOB(2)])], true));
  S2.routes = ["/", "/gallery", "/contact"];
  await looks(c);
  assert.ok(paths(c).includes("/contact"), "this page's own addition was not applied");
  S2.release("stale");
  await looks(c, 4);
  assert.deepEqual(paths(c), ["/", "/contact", "/gallery"], "a stale read overwrote this page's newer list, or was not read again");
});

test("LIVE 7 — a question this browser's own request asked while it was closed: made live once on reopening, under its card; once answered or cleared here, a reading taken before it does not bring it back", async () => {
  const Q = { id: "c".repeat(32), text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
  const S = server();
  S.views.set(KEY(12), view(KEY(12), T0, [{ ...part(0, "Add a gallery page", "waiting", [JOB(1)]), question: { id: Q.id, text: Q.text, options: Q.options } }]));
  S.answers.set(JOB(1), { ok: false, error: "clarify", clarify: { id: Q.id, text: Q.text, options: Q.options }, reply: "I need one detail before I add the gallery.", replySource: "model" });
  // THE OPEN-TIME CHECK OF THE SITE'S QUESTION HAS NOT ANSWERED: the request's own reading makes it live.
  S.hold("check", (url) => url === "/api/site/" + SLUG + "/question");
  const site = siteFor(["/"]);
  site.msgs = [{ r: "u", t: "Add a gallery page", req: KEY(12) }, { r: "a", t: "", request: KEY(12) }];
  site.requests = { [KEY(12)]: { at: T0, view: view(KEY(12), T0, [part(0, "Add a gallery page", "started")]), shown: [], replied: false, replies: [], closed: false, approving: [], own: true } };
  const b = opened(openPage(S, site));
  await idle();
  await looks(b);
  assert.equal(b.s.msgs.filter((m) => m.ask === Q.id).length, 1, "the question is not drawn once");
  assert.equal(b.s.msgs.find((m) => m.ask === Q.id).req, KEY(12));
  assert.equal(b.ask() && b.ask().id, Q.id, "the waiting question was not made live");
  // CLEARED HERE (answered, or cancelled); a reading from before arrives after.
  b.ctx.siteAskClear(b.s.id);
  await b.ctx.siteRequestShow(b.s.id, KEY(12), copy(S.views.get(KEY(12))), null, null, null);
  assert.equal(b.ask(), null, "a reading from before brought the question back");
  assert.equal(b.s.msgs.filter((m) => m.ask === Q.id).length, 1);
  assert.equal(b.s.previewV, undefined, "the question's job changed the preview");
});

test("LIVE 8 — a part of another browser's request that did not go through, or asked a question, finishing while this page watches: said, and nothing refreshed — no preview move, no table, no read of the pages", async () => {
  const S = server();
  const refused = running(S, KEY(13), T0, "Add a gallery page with bookings", 1);
  const asks = running(S, KEY(14), T0 + 60000, "Change the description", 2, "look");
  const b = opened(openPage(S, siteFor(["/"])));
  await idle();
  await looks(b);
  refused.finish({ ok: false, error: "no-pages", unchanged: true, cost: 0, msg: "Nothing was added.", reply: "⚠️ I couldn't add that page, so nothing changed.", replySource: "model", added: ["src/routes/gallery.tsx"], tables: ["bookings"] });
  asks.finish({ ok: false, error: "clarify", clarify: { id: "d".repeat(32), text: "Which words should lead?", options: ["Overnight", "Slow"] }, reply: "One thing first.", replySource: "model" });
  await looks(b);
  assert.deepEqual(said(b, KEY(13)), [JOB(1)]);
  assert.deepEqual(said(b, KEY(14)), [JOB(2)]);
  assert.deepEqual([b.s.previewV, paths(b), copy(b.s.tables || [])], [undefined, ["/"], []]);
  assert.equal(routesReads(S), 0);
});

test("LIVE 1b — a request sent from this page whose part the server finished before the page's first look at it: still this page's own, applied", async () => {
  const S = server();
  const started = view(KEY(15), T0, [part(0, "Add a gallery page with bookings", "started")]);
  // FINISHED ALREADY when the page first asks.
  S.answers.set(JOB(1), ADDED);
  S.views.set(KEY(15), view(KEY(15), T0, [part(0, "Add a gallery page with bookings", "done", [JOB(1)])], true));
  const a = openPage(S, siteFor(["/"]));
  a.ctx.siteRequestStart(a.s.id, { intent: "edit", request: copy(started) }, [], "");
  await looks(a);
  assert.deepEqual([a.s.previewV, paths(a), copy(a.s.tables)], [1, ["/", "/gallery"], ["bookings"]]);
});

test("LIVE 7b — a question this page's own request asks while the page watches: made live by its reply, and once answered or cleared here, a reading taken before does not bring it back", async () => {
  const Q = { id: "e".repeat(32), text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
  const S = server();
  const words = "Add a gallery page";
  S.views.set(KEY(16), view(KEY(16), T0, [part(0, words, "started")]));
  const a = openPage(S, siteFor(["/"]));
  a.ctx.siteRequestStart(a.s.id, { intent: "edit", request: copy(S.views.get(KEY(16))) }, [], "");
  await idle();
  S.answers.set(JOB(1), { ok: false, error: "clarify", clarify: { id: Q.id, text: Q.text, options: Q.options }, reply: "One detail first.", replySource: "model" });
  S.views.set(KEY(16), view(KEY(16), T0, [{ ...part(0, words, "waiting", [JOB(1)]), question: { id: Q.id, text: Q.text, options: Q.options } }]));
  await looks(a);
  assert.equal(a.ask() && a.ask().id, Q.id);
  assert.equal(a.s.msgs.filter((m) => m.ask === Q.id).length, 1);
  const stale = copy(S.views.get(KEY(16)));
  a.ctx.siteAskClear(a.s.id);
  await a.ctx.siteRequestShow(a.s.id, KEY(16), stale, null, null, null);
  assert.equal(a.ask(), null, "a reading from before brought the question back");
});

test("LIVE 9 — reading the pages: a fresh read never takes the answer of one already on its way, and the newest read stays the one others share until it answers", async () => {
  const S = server();
  S.hold("old", (url) => url.startsWith("/api/site/routes?"));
  const b = openPage(S, siteFor(["/"]));
  const reads = () => routesReads(S);
  const old = b.ctx.siteRoutesRead(SLUG);
  assert.equal(reads(), 1);
  // A FRESH READ goes out on its own, and is the one shared from now on.
  S.routes = ["/", "/gallery"];
  S.hold("fresh", (url) => url.startsWith("/api/site/routes?"));
  const fresh = b.ctx.siteRoutesRead(SLUG, true);
  assert.equal(reads(), 2);
  S.release("old");
  assert.deepEqual(copy((await old).paths), ["/"]);
  // THE OLD READ HAS ANSWERED; the fresh one is still the shared one.
  const shared = b.ctx.siteRoutesRead(SLUG);
  assert.equal(reads(), 2, "the old read's answer took the fresh one off the shared reads");
  S.release("fresh");
  assert.deepEqual(copy((await shared).paths), ["/", "/gallery"]);
  assert.deepEqual(copy((await fresh).paths), ["/", "/gallery"]);
});

test("LIVE 10 — another browser's change that adds no page, finishing while this page watches (a text edit, an addition of only a table, one whose reply is still being written): the preview is drawn again at what is published now, and a reply settling later applies nothing again", async () => {
  const TEXT = { ok: true, layer: "text", changed: ["src/routes/index.tsx"], files: 1, cost: 1, reply: "✅ The home page heading now reads “Fed every morning”.", replySource: "model" };
  const TABLE = { ok: true, kinds: ["table"], tables: ["orders"], cost: 3, reply: "✅ Orders now have a table of their own.", replySource: "model" };
  const VISIT = { ok: true, layer: "text", changed: ["src/routes/visit.tsx"], files: 1, cost: 1 };
  const S = server();
  const text = running(S, KEY(17), T0, "Change the home page heading", 1, "text");
  const table = running(S, KEY(18), T0 + 60000, "Keep track of orders", 2);
  const held = running(S, KEY(19), T0 + 120000, "Change the Visit page heading", 3, "text");
  const b = opened(openPage(S, siteFor(["/"])));
  // WHAT EACH DRAWING OF THE WORKSPACE READS: the frame's address is built from `previewV` then.
  const drawn = [];
  b.ctx.renderSites = () => drawn.push(b.s.previewV);
  await idle();
  await looks(b);
  text.finish(TEXT);
  await looks(b);
  assert.deepEqual(said(b, KEY(17)), [JOB(1)]);
  assert.equal(b.s.previewV, 1);
  assert.equal(drawn[drawn.length - 1], 1, "the preview was last drawn before it moved: the frame still shows what was published before");
  table.finish(TABLE);
  await looks(b);
  assert.deepEqual([b.s.previewV, copy(b.s.tables), drawn[drawn.length - 1]], [2, ["orders"], 2]);
  // ITS REPLY STILL BEING WRITTEN: the outcome applied at once, the reply's place held.
  held.finish({ ...VISIT, replyState: "pending" });
  await looks(b);
  const heldMsg = () => b.s.msgs.find((m) => m.req === KEY(19) && m.job === JOB(3));
  assert.ok(heldMsg() && b.ctx.EditPoll.heldOf(heldMsg()), "the reply's place is not held under its job");
  assert.deepEqual([b.s.previewV, drawn[drawn.length - 1]], [3, 3]);
  // THE REPLY IS WRITTEN: it settles in its place, and nothing is applied again.
  S.answers.set(JOB(3), { ...VISIT, reply: "✅ The Visit page's heading now reads “Our shop”.", replySource: "model" });
  await looks(b, 4);
  assert.equal(b.ctx.EditPoll.heldOf(heldMsg()), null, "the held reply did not settle");
  assert.match(heldMsg().t, /Our shop/);
  assert.deepEqual(said(b, KEY(19)), [JOB(3)]);
  assert.deepEqual([b.s.previewV, paths(b), copy(b.s.tables), drawn[drawn.length - 1]], [3, ["/"], ["orders"], 3]);
  assert.equal(routesReads(S), 0, "a change that added or took away no page read the pages");
  // THE SAME TEXT EDIT SENT FROM THIS PAGE is drawn at the new preview as ever.
  const S2 = server();
  S2.views.set(KEY(20), view(KEY(20), T0, [part(0, "Change the home page heading", "started", [], "text")]));
  const a = openPage(S2, siteFor(["/"]));
  const own = [];
  a.ctx.renderSites = () => own.push(a.s.previewV);
  a.ctx.siteRequestStart(a.s.id, { intent: "edit", request: copy(S2.views.get(KEY(20))) }, [], "");
  await idle();
  S2.answers.set(JOB(1), TEXT);
  S2.views.set(KEY(20), view(KEY(20), T0, [part(0, "Change the home page heading", "done", [JOB(1)], "text")], true));
  await looks(a);
  assert.deepEqual([a.s.previewV, own[own.length - 1]], [1, 1]);
});
