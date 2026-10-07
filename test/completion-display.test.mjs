// COMPLETION SHOWN AS THE SERVER HAS IT (2026-10-07).
//
// The owner, in the Edit/Add-on cleanup batch: *"batch the related
// completion-display issues: inspect late first reads of completed jobs that
// lose the existing undo offer, unnecessary repeated preview reloads when
// several parts finish, and stale page/table lists across two tabs or a fresh
// session; make the UI reconcile against the authoritative server result,
// preserve the existing undo contract without inventing a whole-request
// rollback feature, and never mark work complete merely because the browser
// stopped watching."* The three limits kept since 2026-10-05 (owner-notes):
// "your own job found done by a late first read is reconciled without its undo
// offer; a page opening many finished requests moves its preview once per job;
// two tabs of one browser keep their own table lists."
//
// THE PAGE: its own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`), opened with `frame: true` where the
// preview matters, so every drawing runs the render's own frame step and the
// addresses the frame is given are what these cases count. THE SERVER is
// scripted, every answer supplied; nothing here is a model's.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

const SLUG = "fold-lane-bakery";
const URL0 = "https://" + SLUG + ".gofarther.app/";
const KEY = (n) => "disprequest" + String(n).padStart(11, "0");
// 32 HEX, as a job id is (`siteJobDiscovered` draws nothing else).
const JOB = (n) => "d15b" + String(n).padStart(28, "0");
// AN HOUR AGO BY THE REAL CLOCK: the page keeps a request's record two days.
const T0 = Date.now() - 60 * 60 * 1000;
const siteFor = (paths = ["/"], extra = {}) => ({
  id: "origin-1", slug: SLUG, react: true, name: "Fold Lane Bakery", url: URL0,
  pages: paths.map((path) => ({ path })), msgs: [], ...extra,
});
const part = (n, words, status, jobs = [], route = "addon") => ({ n, words, status, ids: jobs.slice(), jobs: jobs.slice(), charged: 0, route });
const view = (key, at, parts, ended = false) => ({ key, state: ended ? "done" : "running", ended, stop: false, at, updatedAt: at, routedUnsaid: 0, parts });
const ADDED = { ok: true, kinds: ["page", "table"], added: ["src/routes/gallery.tsx"], tables: ["bookings"], cost: 9, reply: "✅ Your Gallery page is up, with bookings.", replySource: "model" };
const ORDERS = { ok: true, kinds: ["table"], tables: ["orders"], cost: 3, reply: "✅ Orders now have a table.", replySource: "model" };
const HEADING = { ok: true, layer: "text", changed: ["src/routes/index.tsx"], files: 1, cost: 1, reply: "✅ The heading now reads “Fed every morning”.", replySource: "model" };
const REMOVED = { ok: true, layer: "data", applied: [{ table: "loaves", id: 3, removed: true, was: { name: "Rye" } }], cost: 1, reply: "✅ The Rye loaf is off the list.", replySource: "model" };
const ADDED_ROW = { ok: true, layer: "data", applied: [{ table: "loaves", values: { name: "Spelt" } }], cost: 1, reply: "✅ Spelt is on the list.", replySource: "model" };
const RYE = [{ table: "loaves", was: { name: "Rye" } }];

/** THE SERVER, SCRIPTED: its requests, its jobs' stored answers, the jobs it lists, the pages the site keeps. */
function server() {
  const S = { views: new Map(), answers: new Map(), listed: [], routes: ["/"], calls: [], status: new Map(), hang: new Set(), newer: false };
  S.answer = (url, method) => {
    S.calls.push({ url, method });
    if (url.startsWith("/api/site/routes?")) return { status: 200, body: { ok: true, slug: SLUG, routes: S.routes.slice() } };
    if (url === "/api/site/requests/" + SLUG) return { status: 200, body: { ok: true, requests: [...S.views.values()].sort((a, b) => a.at - b.at).map(copy), jobs: S.listed.map(copy) } };
    if (url.startsWith("/api/site/request/" + SLUG + "/")) {
      // WHETHER ANYTHING WAS ASKED OF THE SITE SINCE A REQUEST (2026-10-07): nothing, unless a case says.
      if (url.endsWith("?newer=1")) return { status: 200, body: { ok: true, newer: S.newer } };
      if (S.requestsDown) return { status: 503, body: { ok: false } };
      // A READ THAT NEVER ANSWERS (the page's fetch then waits for ever).
      if (S.hang.has(url.split("/").pop())) return null;
      const v = S.views.get(url.split("/").pop());
      return v ? { status: 200, body: { ok: true, request: copy(v) } } : { status: 404, body: { error: "not found" } };
    }
    if (url.startsWith("/api/site/edit/")) {
      const id = url.split("/").pop();
      if (S.status.has(id)) return { status: S.status.get(id), body: { ok: false, error: "could not read the job" } };
      const a = S.answers.get(id);
      return a ? { status: 200, headers: { "x-gf-edit": "final" }, body: copy(a) } : { status: 200, body: { ok: true, status: "building" } };
    }
    return { status: 200, body: { ok: true } };
  };
  return S;
}
const open = (S, site, frame = false) => page({ site, answer: S.answer, timers: true, frame });
const idle = async () => { await drain(); await drain(); };
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
const reads = (S, prefix) => S.calls.filter((c) => c.url.startsWith(prefix)).length;
const said = (p, key) => copy(p.s.msgs.filter((m) => m.r === "a" && m.req === key && m.job).map((m) => m.job));
const addresses = (p) => [...new Set(p.frames().filter(Boolean))];
const paths = (p) => copy((p.s.pages || []).map((x) => x.path));
/** A request of this browser's own, as the record a reload finds: its message, its card, its view as last read. */
function ownRecord(site, key, words, at, extraMsgs = []) {
  site.msgs = [{ r: "u", t: words, req: key }, { r: "a", t: "", request: key }, ...extraMsgs];
  site.requests = { [key]: { at, view: view(key, at, [part(0, words, "started", [], "data")]), shown: [], replied: false, replies: [], closed: false, approving: [], own: true } };
  return site;
}

test("DISP 1 — ONE READING FINDS SEVERAL PARTS DONE: each reply said once, and the preview frame loads one new address, not one per part; parts that finish at different times still move it each time", async () => {
  const S = server();
  S.views.set(KEY(1), view(KEY(1), T0, [
    part(0, "Change the home heading", "done", [JOB(1)], "text"),
    part(1, "Add a gallery with bookings", "done", [JOB(2)]),
    part(2, "Keep orders", "done", [JOB(3)]),
  ], true));
  S.answers.set(JOB(1), HEADING); S.answers.set(JOB(2), ADDED); S.answers.set(JOB(3), ORDERS);
  S.routes = ["/", "/gallery"];
  const p = open(S, siteFor(["/"]), true);
  p.ctx.renderSites();
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  assert.deepEqual(said(p, KEY(1)), [JOB(1), JOB(2), JOB(3)]);
  assert.deepEqual(addresses(p), [URL0 + "?v=0", URL0 + "?v=1"], "the frame loaded an address per finished part: " + addresses(p).join(" "));
  assert.equal(p.s.previewV, 1);
  assert.deepEqual(copy(p.s.tables), ["bookings", "orders"]);
  // CONTROL: work that finishes at different times moves the preview each time —
  // and a later reading that finds two parts done at once moves it once.
  const S2 = server();
  S2.views.set(KEY(2), view(KEY(2), T0, [part(0, "Change the home heading", "done", [JOB(1)], "text"), part(1, "Keep orders", "started"), part(2, "Add a gallery with bookings", "started")]));
  S2.answers.set(JOB(1), HEADING);
  const q = open(S2, siteFor(["/"]), true);
  q.ctx.renderSites();
  q.ctx.siteRequestsCheck(q.s);
  await idle();
  await looks(q);
  assert.equal(q.s.previewV, 1);
  S2.answers.set(JOB(3), ORDERS);
  S2.answers.set(JOB(4), ADDED);
  S2.views.set(KEY(2), view(KEY(2), T0, [part(0, "Change the home heading", "done", [JOB(1)], "text"), part(1, "Keep orders", "done", [JOB(3)]), part(2, "Add a gallery with bookings", "done", [JOB(4)])], true));
  await looks(q, 4);
  assert.deepEqual(said(q, KEY(2)), [JOB(1), JOB(3), JOB(4)]);
  assert.equal(q.s.previewV, 2, "the parts that finished later did not move the preview, or moved it once each");
  assert.deepEqual(addresses(q), [URL0 + "?v=0", URL0 + "?v=1", URL0 + "?v=2"]);
});

test("DISP 2 — A PAGE OPENING ON MANY FINISHED REQUESTS: every reply said once, every table kept, the page list read again — and one preview move for them all, once however often it looks", async () => {
  const S = server();
  S.views.set(KEY(3), view(KEY(3), T0, [part(0, "Add a gallery with bookings", "done", [JOB(1)])], true));
  S.views.set(KEY(4), view(KEY(4), T0 + 1000, [part(0, "Keep orders", "done", [JOB(2)])], true));
  S.views.set(KEY(5), view(KEY(5), T0 + 2000, [part(0, "Change the home heading", "done", [JOB(3)], "text")], true));
  S.answers.set(JOB(1), ADDED); S.answers.set(JOB(2), ORDERS); S.answers.set(JOB(3), HEADING);
  S.routes = ["/", "/gallery"];
  const p = open(S, siteFor(["/"]), true);
  p.ctx.renderSites();
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  assert.deepEqual([said(p, KEY(3)), said(p, KEY(4)), said(p, KEY(5))], [[JOB(1)], [JOB(2)], [JOB(3)]]);
  assert.deepEqual(addresses(p), [URL0 + "?v=0", URL0 + "?v=1"], "the frame loaded an address per finished request: " + addresses(p).join(" "));
  assert.deepEqual(copy(p.s.tables), ["bookings", "orders"]);
  assert.deepEqual(paths(p), ["/", "/gallery"]);
  await looks(p, 4);
  assert.equal(p.s.previewV, 1, "a later look moved the preview again");
  // DUPLICATE DELIVERY: the same look again (a second check) says and moves nothing.
  p.ctx.siteRequestsCheck(p.s, true);
  await looks(p, 4);
  assert.deepEqual([said(p, KEY(3)), said(p, KEY(4)), said(p, KEY(5))], [[JOB(1)], [JOB(2)], [JOB(3)]]);
  assert.equal(p.s.previewV, 1);
  // JOBS THE PAGE-DRIVEN PATH FILED, found finished by a look with no request
  // to read: held until each has had its first reading, then one move.
  const S2 = server();
  S2.answers.set(JOB(6), HEADING); S2.answers.set(JOB(7), ADDED);
  S2.listed = [JOB(6), JOB(7)].map((job, i) => ({ job, op: i ? "addon" : "edit", state: "done", ended: true, outcome: "done", words: "found " + i, at: T0 + 5000 + i }));
  S2.routes = ["/", "/gallery"];
  const f = open(S2, siteFor(["/"]), true);
  f.ctx.renderSites();
  f.ctx.siteRequestsCheck(f.s);
  await idle();
  await looks(f);
  assert.equal(f.s.msgs.filter((m) => m.r === "a" && !m.jobCard && Array.isArray(m.jobs)).length, 2, "the found jobs were not said");
  assert.deepEqual(addresses(f), [URL0 + "?v=0", URL0 + "?v=1"], "found jobs moved the preview once each: " + addresses(f).join(" "));
  // A READ THAT NEVER ANSWERS CANNOT KEEP A PUBLISHED CHANGE OFF THE FRAME: the hold lets go after its window.
  const S3 = server();
  S3.views.set(KEY(17), view(KEY(17), T0, [part(0, "Keep orders", "done", [JOB(8)])], true));
  S3.views.set(KEY(18), view(KEY(18), T0 + 1000, [part(0, "Add a gallery", "started")]));
  S3.answers.set(JOB(8), ORDERS);
  S3.hang.add(KEY(18));
  const h = open(S3, siteFor(["/"]), true);
  h.ctx.renderSites();
  h.ctx.siteRequestsCheck(h.s);
  await idle();
  await idle();
  assert.deepEqual(said(h, KEY(17)), [JOB(8)]);
  assert.equal(h.s.previewV, undefined, "the move was made while the look still held the preview — this case tests nothing");
  h.flush();
  await idle();
  assert.equal(h.s.previewV, 1, "a read that never answered kept the published change off the frame");
});

test("DISP 3 — THIS PAGE'S OWN REQUEST FOUND DONE BY A LATE FIRST READ keeps the undo offer its edit leaves; another browser's does not, nor one with something asked since; an added row clears an older offer, as the reader does; read twice, nothing changes", async () => {
  // THE PAGE RELOADED WHILE ITS OWN REQUEST RAN; the job finished meanwhile.
  const S = server();
  S.views.set(KEY(6), view(KEY(6), T0, [part(0, "Take the Rye loaf off", "done", [JOB(1)], "data")], true));
  S.answers.set(JOB(1), REMOVED);
  const p = open(S, ownRecord(siteFor(["/"]), KEY(6), "Take the Rye loaf off", T0));
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  assert.deepEqual(said(p, KEY(6)), [JOB(1)]);
  assert.deepEqual(copy(p.s.undoRows), RYE, "this page's own removal, read late, lost its undo offer");
  await looks(p, 3);
  p.ctx.siteRequestsCheck(p.s, true);
  await looks(p, 3);
  assert.deepEqual(copy(p.s.undoRows), RYE);
  assert.deepEqual(said(p, KEY(6)), [JOB(1)], "a second look said the job again");
  // CONTROL: ANOTHER BROWSER'S REQUEST (picked up from the server) offers none.
  const theirs = open(S, siteFor(["/"]));
  theirs.ctx.siteRequestsCheck(theirs.s);
  await idle();
  await looks(theirs);
  assert.deepEqual(said(theirs, KEY(6)), [JOB(1)]);
  assert.equal(theirs.s.undoRows == null, true, "another browser's removal was offered for undo");
  // …EVEN WHEN THIS PAGE ANSWERED THAT REQUEST'S QUESTION: the answer is one of
  // the request's own messages here, but the request was sent elsewhere.
  const answeredHere = open(S, siteFor(["/"], { msgs: [{ r: "u", t: "The rye one", req: KEY(6) }] }));
  answeredHere.ctx.siteRequestsCheck(answeredHere.s);
  await idle();
  await looks(answeredHere);
  assert.deepEqual(said(answeredHere, KEY(6)), [JOB(1)]);
  assert.equal(answeredHere.s.requests[KEY(6)].own, false);
  assert.equal(answeredHere.s.undoRows == null, true, "another browser's removal was offered for undo because this page answered its question");
  // CONTROL: SOMETHING ASKED SINCE — its own result decides the offer, so the late read leaves it alone.
  const since = ownRecord(siteFor(["/"], { undoRows: [{ table: "loaves", was: { name: "Spelt" } }] }), KEY(6), "Take the Rye loaf off", T0, [{ r: "u", t: "Make the heading bigger" }]);
  const q = open(S, since);
  q.ctx.siteRequestsCheck(q.s);
  await idle();
  await looks(q);
  assert.deepEqual(said(q, KEY(6)), [JOB(1)]);
  assert.deepEqual(copy(q.s.undoRows), [{ table: "loaves", was: { name: "Spelt" } }], "a late read overwrote the offer of something asked since");
  // AN ANSWER TO THE REQUEST'S OWN QUESTION is one of its own, not something asked since.
  const answered = open(S, ownRecord(siteFor(["/"]), KEY(6), "Take the Rye loaf off", T0, [{ r: "u", t: "The rye one", req: KEY(6) }]));
  answered.ctx.siteRequestsCheck(answered.s);
  await idle();
  await looks(answered);
  assert.deepEqual(copy(answered.s.undoRows), RYE, "an answer to the request's own question was read as something asked since");
  // A REQUEST THE THREAD CANNOT PLACE (its messages no longer kept): cannot tell is not "nothing since".
  const lost = ownRecord(siteFor(["/"]), KEY(6), "Take the Rye loaf off", T0);
  lost.msgs = [];
  const l = open(S, lost);
  l.ctx.siteRequestsCheck(l.s);
  await idle();
  await looks(l);
  assert.equal(l.s.undoRows == null, true, "a request the thread could not place set an undo offer");
  // A JOB THAT FAILED keeps nothing: its rows are not known to be gone.
  const S3 = server();
  S3.views.set(KEY(19), view(KEY(19), T0, [part(0, "Take the Rye loaf off", "failed", [JOB(9)], "data")], true));
  S3.answers.set(JOB(9), { ...REMOVED, ok: false, error: "rpc", msg: "That change could not be saved." });
  const x = open(S3, ownRecord(siteFor(["/"]), KEY(19), "Take the Rye loaf off", T0));
  x.ctx.siteRequestsCheck(x.s);
  await idle();
  await looks(x);
  assert.equal(x.s.undoRows == null, true, "a failed job left an undo offer");
  // THE READER'S CONTRACT: an added row clears an older offer.
  const S2 = server();
  S2.views.set(KEY(7), view(KEY(7), T0, [part(0, "Put Spelt on the list", "done", [JOB(2)], "data")], true));
  S2.answers.set(JOB(2), ADDED_ROW);
  const r = open(S2, ownRecord(siteFor(["/"], { undoRows: RYE }), KEY(7), "Put Spelt on the list", T0));
  r.ctx.siteRequestsCheck(r.s);
  await idle();
  await looks(r);
  assert.equal(r.s.undoRows, null, "an added row left an offer to put back a row");
});

test("DISP 4 — A WATCH THAT GAVE UP DOES NOT MARK ITS JOB SHOWN: the page says it lost track, and a later look still finds the job and says how it really ended; a watch that applied its reply is shown once and never found again", async () => {
  const S = server();
  S.status.set(JOB(8), 503);
  const p = open(S, siteFor(["/"]));
  p.ctx.EditPoll.shouldGiveUp = () => true;
  const d = { intent: "edit", layer: "text" };
  p.ctx.watchEditJob(p.s, d, JOB(8), p.s.id, (t) => p.ctx.siteReqSay(p.s.id, t), null, "Change the home heading", [], undefined, false);
  await idle();
  await looks(p);
  const last = p.last();
  assert.match(String(last.t), /lost track/, "the watch did not give up — this case tests nothing: " + JSON.stringify(last));
  assert.equal(last.jobs, undefined, "a watch that gave up named its job as shown");
  // THE JOB HAD FINISHED; the reload's look finds it among the site's jobs.
  S.status.delete(JOB(8));
  S.answers.set(JOB(8), HEADING);
  S.listed = [{ job: JOB(8), op: "edit", state: "done", ended: true, outcome: "done", words: "Change the home heading", at: T0 }];
  const again = open(S, copy(p.s));
  again.ctx.siteRequestsCheck(again.s);
  await idle();
  await looks(again);
  const reply = again.s.msgs.filter((m) => m.r === "a" && Array.isArray(m.jobs) && m.jobs.includes(JOB(8)) && !m.jobCard);
  assert.equal(reply.length, 1, "the job a watch gave up on was never said: " + JSON.stringify(copy(again.s.msgs)));
  assert.match(String(reply[0].t), /Fed every morning/);
  assert.equal(again.s.msgs.filter((m) => m.jobCard === JOB(8)).length, 1);
  // CONTROL: A WATCH THAT APPLIED ITS REPLY names the job, and a later look finds nothing more to say.
  const S2 = server();
  S2.answers.set(JOB(9), HEADING);
  const w = open(S2, siteFor(["/"]));
  w.ctx.watchEditJob(w.s, d, JOB(9), w.s.id, (t) => w.ctx.siteReqSay(w.s.id, t), null, "Change the home heading", [], undefined, false);
  await idle();
  await looks(w);
  S2.listed = [{ job: JOB(9), op: "edit", state: "done", ended: true, outcome: "done", words: "Change the home heading", at: T0 }];
  const w2 = open(S2, copy(w.s));
  w2.ctx.siteRequestsCheck(w2.s);
  await idle();
  await looks(w2);
  assert.equal(w2.s.msgs.filter((m) => m.jobCard === JOB(9)).length, 0, "a job this page showed was drawn again");
});

test("DISP 5 — THE TAB COMES BACK INTO VIEW: what another tab finished is found and said once, its tables kept, and with nothing in flight the page list is the server's — a page taken away elsewhere leaves; at most once in the window; nothing while hidden", async () => {
  const S = server();
  S.routes = ["/", "/visit"];
  const p = open(S, siteFor(["/", "/visit"]));
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  // ANOTHER TAB: an addition finished and the Visit page was taken away.
  S.views.set(KEY(10), view(KEY(10), T0, [part(0, "Keep orders", "done", [JOB(1)])], true));
  S.answers.set(JOB(1), ORDERS);
  S.routes = ["/"];
  p.ctx.document.visibilityState = "hidden";
  const before = reads(S, "/api/site/requests/");
  p.ctx.siteLookAgain();
  await looks(p);
  assert.equal(reads(S, "/api/site/requests/"), before, "a hidden tab looked again");
  p.ctx.document.visibilityState = "visible";
  p.ctx.siteLookAgain();
  await looks(p);
  assert.deepEqual(said(p, KEY(10)), [JOB(1)]);
  assert.deepEqual(copy(p.s.tables), ["orders"]);
  assert.deepEqual(paths(p), ["/"], "a page taken away in another tab stayed in this one");
  const after = reads(S, "/api/site/requests/");
  p.ctx.siteLookAgain();
  await looks(p);
  assert.equal(reads(S, "/api/site/requests/"), after, "the tab looked again inside the window");
  assert.deepEqual(said(p, KEY(10)), [JOB(1)]);
  // AND THE PAGE ASKS IT WHEN THE TAB COMES BACK: the one listener, at the top level of the page's script.
  assert.match(CHAT, /\ndocument\.addEventListener\('visibilitychange', siteLookAgain\);\n/, "nothing calls the look again when the tab comes back into view");
  // CONTROL: WITH A REQUEST STILL RUNNING, the page list only gains — nothing is taken away under it.
  const S2 = server();
  S2.views.set(KEY(11), view(KEY(11), T0, [part(0, "Add a gallery", "started")]));
  S2.routes = ["/"];
  const q = open(S2, siteFor(["/", "/visit"]));
  q.ctx.siteRequestsCheck(q.s);
  await idle();
  q.ctx.siteLookAgain();
  await looks(q);
  assert.deepEqual(paths(q), ["/", "/visit"], "the list was cut while a request was still running");
});

test("DISP 6 — A FRESH SESSION WITH NOTHING IN FLIGHT takes the server's page list whole, its kept pages keeping their names; with work in flight it only gains, as before", async () => {
  const S = server();
  S.routes = ["/", "/gallery"];
  const site = siteFor(["/", "/gallery", "/visit"]);
  site.pages[1].name = "Our Gallery";
  const p = open(S, site);
  p.ctx.siteRoutesFetch(p.s);
  await idle();
  assert.deepEqual(paths(p), ["/", "/gallery"], "a page the site no longer has stayed in a fresh session's list");
  assert.equal(p.s.pages[1].name, "Our Gallery");
  // CONTROL: A REQUEST STILL RUNNING — the list only gains.
  const S2 = server();
  S2.routes = ["/", "/gallery", "/contact"];
  const busy = siteFor(["/", "/gallery", "/visit"]);
  busy.requests = { [KEY(12)]: { at: T0, view: view(KEY(12), T0, [part(0, "Add a contact page", "started")]), shown: [], replied: false, replies: [], closed: false, approving: [], own: true } };
  const q = open(S2, busy);
  q.ctx.siteRoutesFetch(q.s);
  await idle();
  assert.deepEqual(paths(q), ["/", "/gallery", "/visit", "/contact"]);
  // …A QUEUED JOB THIS PAGE REMEMBERS WATCHING, and A FOUND JOB STILL RUNNING: the same.
  const watched = open(S2, siteFor(["/", "/gallery", "/visit"]));
  watched.ctx.EditPoll.resumableRecord = () => ({ job: JOB(20) });
  watched.ctx.siteRoutesFetch(watched.s);
  await idle();
  assert.deepEqual(paths(watched), ["/", "/gallery", "/visit", "/contact"], "the list was cut while a watched job ran");
  const carded = siteFor(["/", "/gallery", "/visit"]);
  carded.jobCards = { [JOB(21)]: { at: Date.now(), closed: false, view: { job: JOB(21), op: "edit", state: "running", ended: false, outcome: null, words: "Change the home heading", progress: [], said: null } } };
  const c = open(S2, carded);
  c.ctx.siteRoutesFetch(c.s);
  await idle();
  assert.deepEqual(paths(c), ["/", "/gallery", "/visit", "/contact"], "the list was cut while a found job ran");
});

test("DISP 7 — NEVER COMPLETE BECAUSE THE PAGE STOPPED WATCHING: a found job the page stopped following stays open and is followed again by the next look; a request it lost sight of is not closed, and the next look says its end", async () => {
  const S = server();
  S.listed = [{ job: JOB(13), op: "edit", state: "running", ended: false, words: "Change the home heading", at: T0 }];
  const p = open(S, siteFor(["/"]));
  p.ctx.EditPoll.POLL_GIVE_UP_MS = -1;
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  const card = p.s.jobCards && p.s.jobCards[JOB(13)];
  assert.ok(card, "the found job was not drawn");
  assert.deepEqual([card.closed, card.view.ended], [false, false], "a job the page stopped following was marked ended");
  S.answers.set(JOB(13), HEADING);
  S.listed = [{ ...S.listed[0], state: "done", ended: true, outcome: "done" }];
  p.ctx.EditPoll.POLL_GIVE_UP_MS = 60 * 60 * 1000;
  p.ctx.siteRequestsCheck(p.s, true);
  await idle();
  await looks(p);
  assert.equal(p.s.jobCards[JOB(13)].closed, true);
  assert.equal(p.s.msgs.filter((m) => m.r === "a" && !m.jobCard && Array.isArray(m.jobs) && m.jobs.includes(JOB(13))).length, 1);
  // A REQUEST THE PAGE LOST SIGHT OF (its reads failing): said so, never closed; the next look follows it to its end.
  const S2 = server();
  S2.views.set(KEY(14), view(KEY(14), T0, [part(0, "Keep orders", "started")]));
  const q = open(S2, siteFor(["/"]));
  q.ctx.siteRequestsCheck(q.s);
  await idle();
  S2.requestsDown = true;
  // PAST `SITE_REQ_MISSES` (30) failed reads in a row.
  for (let i = 0; i < 34; i++) { q.flush(); await idle(); }
  const st = q.s.requests[KEY(14)];
  assert.ok(q.s.msgs.some((m) => /lost sight/.test(String(m.t || ""))), "the page did not say it lost sight — this case tests nothing");
  assert.equal(st.closed, false, "a request the page lost sight of was closed");
  // THE NEXT LOOK (a reload, the tab back in view) follows it to its end and says it.
  S2.requestsDown = false;
  S2.answers.set(JOB(15), ORDERS);
  S2.views.set(KEY(14), view(KEY(14), T0, [part(0, "Keep orders", "done", [JOB(15)])], true));
  q.ctx.siteRequestsCheck(q.s, true);
  await idle();
  await looks(q);
  assert.deepEqual(said(q, KEY(14)), [JOB(15)]);
  assert.equal(q.s.requests[KEY(14)].closed, true);
});
