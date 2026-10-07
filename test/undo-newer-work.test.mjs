// A LATE UNDO OFFER, AND ANOTHER TAB'S SAVE, AGAINST WORK THIS PAGE CANNOT SEE (2026-10-07).
//
// Codex's review of the cleanup batch: *"make late undo eligibility respect
// newer server-side work from another tab or device. Address cross-tab thread
// overwrites if they lose the request or outcome evidence needed for those
// guarantees; do not invent a new conversation system or whole-request
// rollback feature."*
//
// The undo offer's contract is unchanged (the rows the latest data edit took
// away, replaced by a later removal, cleared by an addition). What changes:
//   - a late first read of this page's own request keeps the offer only when
//     the SERVER says nothing was asked of the site since — every edit,
//     addition, request part and rewrite filed after it, from any tab or
//     device, less its own (`newerWorkSince`, read by `?newer=1`); this
//     page's thread can see only its own messages, and cannot tell keeps
//     nothing;
//   - a save takes in what another tab of this browser saved since (the
//     browser's `storage` event): a request's record and its `own` mark, what
//     either tab showed of it, found jobs' cards, and the undo offer last set
//     or cleared by either — so a stale tab can neither erase the evidence a
//     late read needs nor write back an offer the other tab had replaced.
//     The thread itself is not merged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";

// ── THE SERVER ──────────────────────────────────────────────────────────────
const DESC = "Change the site description to say we bake overnight sourdough";
// THE SAME ANSWER FOR EVERY CALL (the platform hands a list out one call at a time).
const DESCRIBE = { route: () => ({ intent: "edit", layer: "look" }), [T.pick]: () => ({ fields: ["description"], scopes: [{ part: "description", words: DESC }] }), "lane:description": "Overnight sourdough from a Bristol side street." };
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;

test("NEWER 1 — THE SERVER SAYS WHETHER ANYTHING WAS ASKED OF THE SITE SINCE A REQUEST: not the work before it, not its own, yes once another request is filed after it, and cannot tell when the job table will not answer — a read that moves nothing", async () => {
  const compiler = installCompiler();
  const P = platform({ slug: "nw-" + Math.random().toString(16).slice(2, 8), answers: DESCRIBE });
  try {
    // EACH MESSAGE IS ACCEPTED AS A REQUEST; ITS KEY IS THE SERVER'S.
    const accepted = async (message) => { const r = await sendMessage(P, { message }); const key = r.body && r.body.request && r.body.request.key; assert.ok(key, "no request was accepted: " + JSON.stringify(r.body).slice(0, 300)); await settle(P, key); return { key }; };
    const before = await accepted(DESC);
    P.advance(5000);
    const mine = await accepted(DESC + ", please");
    assert.ok(P.jobsOf(before.key).length >= 1 && P.jobsOf(mine.key).length >= 1, "the requests filed no jobs — the observer is dead");
    const quiet = await call(P, "GET", REQ(P, mine.key) + "?newer=1");
    assert.equal(quiet.status, 200);
    assert.deepEqual(quiet.body, { ok: true, newer: false }, "the work before the request, or its own, was read as work since");
    // ANOTHER TAB OR DEVICE ASKS FOR SOMETHING AFTER IT.
    P.advance(5000);
    const later = await accepted(DESC + " today");
    const busy = await call(P, "GET", REQ(P, mine.key) + "?newer=1");
    assert.deepEqual(busy.body, { ok: true, newer: true }, "work filed after the request was not seen");
    // THE NEWEST REQUEST HAS NOTHING AFTER IT.
    assert.deepEqual((await call(P, "GET", REQ(P, later.key) + "?newer=1")).body, { ok: true, newer: false });
    // CANNOT TELL: a read as long as its limit that names only the request's own.
    const at = Date.now();
    const own = later.key;
    for (let n = 0; n < 50; n++) P.jobs.set("f".repeat(8) + String(n).padStart(24, "0"), { id: "f".repeat(8) + String(n).padStart(24, "0"), uid: [...P.jobs.values()][0].uid, slug: P.slug, op: "edit", idem_key: own + "-p9-" + n, state: "done", created_at: at + 1000 + n, updated_at: at + 1000 + n, seqs: new Set() });
    assert.deepEqual((await call(P, "GET", REQ(P, own) + "?newer=1")).body, { ok: true, newer: null }, "a full read of the request's own jobs was told as nothing since");
    // CANNOT TELL: the job table will not answer.
    P.failRead((u) => /created_at=gt\./.test(u));
    const down = await call(P, "GET", REQ(P, mine.key) + "?newer=1");
    assert.deepEqual(down.body, { ok: true, newer: null }, "a read that failed was told as an answer");
    // A READ ONLY: no request view, nothing moved.
    assert.equal(Object.hasOwn(busy.body, "request"), false);
  } finally { P.close(); compiler.uninstall(); }
});

// ── THE PAGE: A LATE FIRST READ OF ITS OWN REQUEST ──────────────────────────
const SLUG = "fold-lane-bakery";
const URL0 = "https://" + SLUG + ".gofarther.app/";
const KEY = (n) => "undonewer" + String(n).padStart(13, "0");
const JOB = (n) => "a0d0" + String(n).padStart(28, "0");
const T0 = Date.now() - 60 * 60 * 1000;
const siteFor = (extra = {}) => ({ id: "origin-1", slug: SLUG, react: true, name: "Fold Lane Bakery", url: URL0, pages: [{ path: "/" }], msgs: [], ...extra });
const part = (n, words, status, jobs = [], route = "data") => ({ n, words, status, ids: jobs.slice(), jobs: jobs.slice(), charged: 0, route });
const view = (key, at, parts, ended = false) => ({ key, state: ended ? "done" : "running", ended, stop: false, at, updatedAt: at, routedUnsaid: 0, parts });
const REMOVED = { ok: true, layer: "data", applied: [{ table: "loaves", id: 3, removed: true, was: { name: "Rye" } }], cost: 1, reply: "✅ The Rye loaf is off the list.", replySource: "model" };
const HEADING = { ok: true, layer: "text", changed: ["src/routes/index.tsx"], files: 1, cost: 1, reply: "✅ The heading now reads “Fed every morning”.", replySource: "model" };
const RYE = [{ table: "loaves", was: { name: "Rye" } }];
/** This browser's own request as a reload finds it: its message, its card, its last view. */
function ownRecord(site, key, words, extraMsgs = []) {
  site.msgs = [{ r: "u", t: words, req: key }, { r: "a", t: "", request: key }, ...extraMsgs];
  site.requests = { [key]: { at: T0, view: view(key, T0, [part(0, words, "started")]), shown: [], replied: false, replies: [], closed: false, approving: [], own: true } };
  return site;
}
/** The server, scripted: the request, its job's answer, and what `?newer=1` says (`newer`, or a status, or a held answer). */
function server() {
  const S = { views: new Map(), answers: new Map(), newer: false, newerStatus: 200, calls: [], holds: [] };
  S.answer = (url, method) => {
    S.calls.push({ url, method });
    if (url.startsWith("/api/site/routes?")) return { status: 200, body: { ok: true, slug: SLUG, routes: ["/"] } };
    if (url === "/api/site/requests/" + SLUG) return { status: 200, body: { ok: true, requests: [...S.views.values()].map(copy), jobs: [] } };
    if (url.startsWith("/api/site/request/" + SLUG + "/")) {
      if (url.endsWith("?newer=1")) {
        const out = { status: S.newerStatus, body: S.newerStatus === 200 ? { ok: true, newer: S.newer } : { ok: false } };
        const hold = S.holds.shift();
        return hold ? hold.then(() => out) : out;
      }
      const v = S.views.get(url.split("/").pop());
      return v ? { status: 200, body: { ok: true, request: copy(v) } } : { status: 404, body: { error: "not found" } };
    }
    if (url.startsWith("/api/site/edit/")) {
      const a = S.answers.get(url.split("/").pop());
      return a ? { status: 200, headers: { "x-gf-edit": "final" }, body: copy(a) } : { status: 202, body: { ok: true, status: "building" } };
    }
    return { status: 200, body: { ok: true } };
  };
  S.holdNext = () => { let open; S.holds.push(new Promise((ok) => { open = ok; })); return () => open(); };
  return S;
}
const idle = async () => { await drain(); await drain(); };
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
const newerReads = (S) => S.calls.filter((c) => c.url.endsWith("?newer=1")).length;
/** One reload of this browser: its own removal request found done; the server answering `newer` as set. */
async function lateRead(set) {
  const S = server();
  S.views.set(KEY(1), view(KEY(1), T0, [part(0, "Take the Rye loaf off", "done", [JOB(1)])], true));
  S.answers.set(JOB(1), REMOVED);
  set(S);
  const p = page({ site: ownRecord(siteFor(), KEY(1), "Take the Rye loaf off"), answer: S.answer, timers: true });
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  return { S, p };
}

test("NEWER 2 — A LATE FIRST READ OF THIS PAGE'S OWN REMOVAL keeps the undo offer only on the server's plain \"nothing since\": work since from any tab or device, cannot tell, or a read that fails keeps nothing; and a read whose answer would not change the offer asks nothing", async () => {
  const quiet = await lateRead((S) => { S.newer = false; });
  assert.equal(newerReads(quiet.S), 1, "the server was not asked");
  assert.deepEqual(copy(quiet.p.s.undoRows), RYE, "control: nothing since, and the offer was not kept");
  assert.equal(typeof quiet.p.s.undoAt, "number", "the kept offer carries no time, so a stale tab could write an older one back over it");
  // AN ADDED ROW CLEARS THE OFFER, AND THE CLEARING CARRIES ITS TIME TOO.
  const cleared = { ...quiet.p.s, undoRows: RYE, undoAt: 1 };
  quiet.p.ctx.siteUndoKeep(cleared, { ok: true, layer: "data", applied: [{ table: "loaves", values: { name: "Spelt" } }] });
  assert.equal(cleared.undoRows, null);
  assert.ok(cleared.undoAt > 1, "a cleared offer carries no time");
  for (const [what, set] of [["work since elsewhere", (S) => { S.newer = true; }], ["cannot tell", (S) => { S.newer = null; }], ["a read that fails", (S) => { S.newerStatus = 503; }]]) {
    const r = await lateRead(set);
    assert.equal(newerReads(r.S), 1, what + ": the server was not asked");
    assert.equal(r.p.s.undoRows == null, true, what + ": the late read kept an undo offer");
  }
  // A JOB WHOSE ANSWER LEAVES THE OFFER AS IT IS (a heading changed) asks nothing.
  const S = server();
  S.views.set(KEY(2), view(KEY(2), T0, [part(0, "Change the heading", "done", [JOB(2)], "text")], true));
  S.answers.set(JOB(2), HEADING);
  const p = page({ site: ownRecord(siteFor({ undoRows: RYE, undoAt: 1 }), KEY(2), "Change the heading"), answer: S.answer, timers: true });
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
  assert.equal(newerReads(S), 0, "a read that could not change the offer asked the server");
  assert.deepEqual(copy(p.s.undoRows), RYE);
});

test("NEWER 3 — A MESSAGE SENT WHILE THE SERVER IS ASKED: the late read keeps nothing, however the server answers", async () => {
  const S = server();
  S.views.set(KEY(3), view(KEY(3), T0, [part(0, "Take the Rye loaf off", "done", [JOB(3)])], true));
  S.answers.set(JOB(3), REMOVED);
  const open = S.holdNext();
  const p = page({ site: ownRecord(siteFor(), KEY(3), "Take the Rye loaf off"), answer: S.answer, timers: true });
  p.ctx.siteRequestsCheck(p.s);
  for (let i = 0; i < 20 && !newerReads(S); i++) await idle();
  assert.equal(newerReads(S), 1, "the server was not asked");
  // THE CUSTOMER ASKS FOR SOMETHING ELSE MEANWHILE.
  p.s.msgs.push({ r: "u", t: "Make the heading bigger" });
  open();
  await looks(p);
  assert.equal(p.s.undoRows == null, true, "a late read kept an offer over a message sent while it waited");
});

// ── TWO TABS OF ONE BROWSER ─────────────────────────────────────────────────
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at, CHAT.indexOf("\n}\n", at) + 3); };
const cutLine = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at, CHAT.indexOf("\n", at + 1) + 1); };
const SAVE_SRC = [cutLine("const SITES_KEY ="), cutLine("let sitesCache ="), cutLine("const SITE_REQ_KEEP_MS ="), cutLine("let sitesStoredStale ="), cutLine("try { window.addEventListener('storage'"), cut("function sitesLoad("), cut("function sitesMerge("), cut("function sitesSave(")].join("\n");
/**
 * ONE BROWSER: its storage, shared by every tab opened in it, and each write
 * told to the other tabs as the browser tells them (`storage`, never to the
 * tab that wrote).
 */
function browser() {
  const store = new Map();
  const tabs = [];
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem(k, v) { store.set(k, String(v)); for (const t of tabs) if (t.writing !== true) t.listeners.forEach((fn) => fn({ key: k })); },
    removeItem: (k) => { store.delete(k); },
  };
  return {
    store,
    open() {
      const tab = { listeners: [], writing: false };
      const ctx = vm.createContext({ JSON, Date, Map, Set, Array, Object, Number, String, Math, sbToast: () => {} });
      ctx.localStorage = { getItem: localStorage.getItem, removeItem: localStorage.removeItem, setItem: (k, v) => { tab.writing = true; try { localStorage.setItem(k, v); } finally { tab.writing = false; } } };
      ctx.window = { addEventListener: (type, fn) => { if (type === "storage") tab.listeners.push(fn); } };
      vm.runInContext(SAVE_SRC, ctx);
      tabs.push(tab);
      tab.sites = () => vm.runInContext("sitesLoad()", ctx);
      tab.save = () => vm.runInContext("sitesSave()", ctx);
      return tab;
    },
  };
}
const NOW = Date.now();
const rec = (over = {}) => ({ at: NOW - 1000, view: view(KEY(9), NOW - 1000, [part(0, "Take the Rye loaf off", "done", [JOB(9)])], true), shown: [], replied: false, replies: [], closed: false, approving: [], own: false, ...over });

test("TABS 1 — A TAB THAT HAD NOT SEEN ANOTHER'S REQUEST NO LONGER ERASES IT: the record survives the stale tab's save, the own mark from either tab stands, what each showed and either's close are kept together, the view read last wins, found jobs keep their cards — and the thread stays each tab's own", () => {
  const b = browser();
  b.store.set("zephyr_sites_v1", JSON.stringify([siteFor({ msgs: [{ r: "u", t: "hello" }] })]));
  const A = b.open();
  const B = b.open();
  A.sites(); B.sites();
  const stored = () => JSON.parse(b.store.get("zephyr_sites_v1"))[0];
  // TAB A SENDS A REQUEST AND SAVES IT.
  A.sites()[0].requests = { [KEY(9)]: rec({ own: true, shown: [JOB(9)] }) };
  A.sites()[0].msgs.push({ r: "u", t: "Take the Rye loaf off", req: KEY(9) });
  A.save();
  // TAB B, OPENED BEFORE, SAVES ITS OWN COPY — which has never seen the request.
  B.sites()[0].requests = { [KEY(8)]: rec({ view: view(KEY(8), NOW - 500, []) }) };
  B.save();
  assert.ok(stored().requests[KEY(9)], "the stale tab's save erased the other tab's request");
  assert.equal(stored().requests[KEY(9)].own, true, "the request's own mark was lost — a late read could no longer keep its offer");
  assert.ok(stored().requests[KEY(8)], "the stale tab's own record was lost");
  assert.deepEqual(stored().msgs.map((m) => m.t), ["hello"], "the threads were merged");
  // THE OWN MARK FROM EITHER: B holds the request as picked up from the server; A writes; B saves.
  B.sites()[0].requests[KEY(9)].own = false;
  A.sites()[0].requests[KEY(9)].replied = true;
  A.save();
  B.save();
  assert.equal(stored().requests[KEY(9)].own, true, "the own mark was lost where both tabs held the request");
  // EITHER'S CLOSE, AND WHAT EACH SHOWED: A closes and saves; B, which showed another job, saves.
  A.sites()[0].requests[KEY(9)].closed = true;
  A.save();
  B.sites()[0].requests[KEY(9)].shown = [JOB(8)];
  B.save();
  assert.equal(stored().requests[KEY(9)].closed, true, "the other tab's close was lost");
  assert.deepEqual([...stored().requests[KEY(9)].shown].sort(), [JOB(8), JOB(9)].sort(), "what each tab showed was not kept together");
  // THE VIEW READ LAST: A reads a later one and saves; B, holding an older one, saves.
  const newer = view(KEY(9), NOW - 1000, [part(0, "Take the Rye loaf off", "done", [JOB(9)])], true);
  newer.updatedAt = NOW - 10;
  A.sites()[0].requests[KEY(9)].view = newer;
  A.save();
  B.sites()[0].requests[KEY(9)].view = view(KEY(9), NOW - 1000, [part(0, "Take the Rye loaf off", "started")]);
  B.save();
  assert.equal(stored().requests[KEY(9)].view.updatedAt, NOW - 10, "an older view was written over the one read last");
  // A JOB A FOUND keeps its card through B's save.
  A.sites()[0].jobCards = { [JOB(6)]: { at: NOW - 100, closed: false, view: { job: JOB(6), op: "edit", state: "done", ended: true } } };
  A.save();
  B.save();
  assert.ok(stored().jobCards && stored().jobCards[JOB(6)], "a found job's card was erased by the other tab's save");
});

test("TABS 1b — WHAT IS NOT TAKEN IN: a record past its keep, and a site the saving tab does not hold", () => {
  const b = browser();
  b.store.set("zephyr_sites_v1", JSON.stringify([siteFor()]));
  const A = b.open();
  const B = b.open();
  A.sites(); B.sites();
  A.sites()[0].requests = { [KEY(7)]: rec({ at: NOW - 3 * 24 * 60 * 60 * 1000 }), [KEY(5)]: rec() };
  A.sites().push(siteFor({ id: "origin-gone" }));
  A.save();
  B.save();
  const after = JSON.parse(b.store.get("zephyr_sites_v1"));
  assert.deepEqual(after.map((x) => x.id), ["origin-1"], "a site the saving tab does not hold was brought back");
  assert.ok(after[0].requests[KEY(5)], "control: a record within its keep was not taken in");
  assert.equal(Object.hasOwn(after[0].requests, KEY(7)), false, "a record past its keep was taken in");
});

test("TABS 2 — A STALE TAB NEVER WRITES BACK AN UNDO OFFER THE OTHER TAB REPLACED OR CLEARED, AND A TAB WITH THE NEWER ONE KEEPS IT; the offer last set by either is kept by both", () => {
  const b = browser();
  b.store.set("zephyr_sites_v1", JSON.stringify([siteFor()]));
  const A = b.open();
  const B = b.open();
  A.sites(); B.sites();
  const stored = () => JSON.parse(b.store.get("zephyr_sites_v1"))[0];
  // BOTH HOLD THE OFFER OF AN EARLIER REMOVAL.
  for (const t of [A, B]) Object.assign(t.sites()[0], { undoRows: RYE, undoAt: NOW - 5000 });
  // TAB A ADDS A ROW, WHICH CLEARS IT, AND SAVES; TAB B, STILL HOLDING THE OLD OFFER, SAVES.
  Object.assign(A.sites()[0], { undoRows: null, undoAt: NOW - 1000 });
  A.save();
  B.save();
  assert.equal(stored().undoRows, null, "the stale tab wrote back an undo offer the other had cleared");
  assert.equal(B.sites()[0].undoRows, null, "the stale tab still holds the cleared offer");
  // TAB A HOLDS A NEWER OFFER WHEN TAB B SAVES AN OLDER ONE: A's save keeps its own.
  const SPELT = [{ table: "loaves", was: { name: "Spelt" } }];
  Object.assign(A.sites()[0], { undoRows: SPELT, undoAt: NOW + 10 });
  Object.assign(B.sites()[0], { undoRows: RYE, undoAt: NOW + 5 });
  B.save();
  A.save();
  assert.deepEqual(stored().undoRows, SPELT, "an older offer another tab saved was taken over this tab's newer one");
  assert.deepEqual(A.sites()[0].undoRows, SPELT);
  // AND THE OTHER TAB TAKES THE NEWER ONE ON ITS NEXT SAVE.
  B.save();
  assert.deepEqual(B.sites()[0].undoRows, SPELT);
  assert.deepEqual(stored().undoRows, SPELT);
});
