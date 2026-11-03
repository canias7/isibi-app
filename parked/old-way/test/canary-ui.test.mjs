// PARKED (2026-11-03, park-old-way): the old-way half of test/canary-ui.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE CANARY'S UI MODE: its decisions, its stop conditions and its wiring.
//
// The driver itself was proven against the REAL gofarther.dev page code in a
// real Chromium, with every API answer supplied in the page (the 2026-09-26
// local runs: the happy path, a rehearsal, a refused session, a misrouted
// add-on and a job that never finished). CI has no browser for the unit suite,
// so here the same `runUi` is driven through a stand-in page that behaves like
// the workspace — which is what lets every stop condition be forced on demand.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  UI_SCENARIOS, SESSION_KEY, WELCOME_SEEN_KEY, readUiScenario, composerReady, newReplies, budgetRefusal,
  imageFacts, recordableRequest, recordsBody, blocksPost, chainVerdict, runUi, describeUi,
  wallRefusal, requestVerdict, storedReplyVerdict, moneyVerdict, unpublishedVerdict, routeCostsOf,
  conditionProbe, dependencyVerdict, finalReplyOf, failureVerdict, refundedVerdict, sameTab,
  requestKeyOf, requestWall, requestJobsOf,
} from "../../../scripts/canary-ui.mjs";
import { additionRequestVerdict, additionReplyVerdict } from "../../../scripts/canary-additions.mjs";
import { probeBody } from "../../../scripts/canary-rows.mjs";
import { readAllow, bookingBodyVerdict, EVIDENCE_BOUNDARY } from "../../../scripts/canary-rules.mjs";
import { MAX_LOGO_BYTES } from "../builder/site-logo.mjs";
import { handleOwnerWrite } from "../../../site-owner.mjs";
import { ownerTable } from "../../../test/fixtures/owner-table.mjs";

const ROOT = new URL("../../../", import.meta.url).pathname;
const FIXTURE = "test/fixtures/ui-logo.png";
const FIXTURE_SHA = "2cc633d73b2d5ab38d29d94cf15c9ce67980a2401ee005f99e89e0781a4c3df5";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const ORIGIN = "https://gofarther.dev";

test("Part B's scenario sends the checklist's three messages, and the file is the committed PNG", () => {
  const sc = UI_SCENARIOS["4a-part-b"];
  assert.equal(sc.site, "fold-lane-bakery");
  assert.deepEqual(sc.steps.map((s) => s.say), [
    "Use this picture as the logo.",
    "Show more of the top of the photo of the sourdough boule cooling.",
    "Move the starter page to /starter.",
  ]);
  assert.deepEqual(sc.steps.map((s) => s.attach || null), [FIXTURE, null, null], "only the logo message carries a file");
  assert.ok(Number.isFinite(sc.budget) && sc.budget > 0 && sc.budget <= 20, `budget ${sc.budget}`);
  assert.ok(Object.isFrozen(sc) && Object.isFrozen(sc.steps) && sc.steps.every(Object.isFrozen), "a scenario can be changed at run time");
  // The file: a real PNG, well under what the logo rung takes, and exactly the bytes on record.
  const bytes = fs.readFileSync(ROOT + FIXTURE);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "the fixture is not a PNG");
  assert.ok(bytes.length < MAX_LOGO_BYTES, `${bytes.length} bytes`);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), FIXTURE_SHA);
});

// ── THE PURE DECISIONS ──────────────────────────────────────────────────────

const IDLE = { busy: false, send: true, sendDisabled: false, stop: false, working: 0, textarea: true, disabled: false };

// ── THE DRIVER, THROUGH A STAND-IN WORKSPACE ────────────────────────────────
//
// It answers the two page functions by name, as the workspace would: the
// composer's state and the site card's id. A Send posts, the job's reply
// arrives a few polls later, and each call a real page would make is fed to
// the driver's own response listener, so what it records is what it records
// in the real run.

function standIn(opt = {}) {
  const calls = [];
  const slug = opt.slug || "fold-lane-bakery";
  const st = {
    signedIn: opt.signedIn !== false, uid: opt.uid || UID, gate: !!opt.gate, card: opt.card !== false,
    workspace: false, busy: false, messages: [], attached: 0, strip: 0, value: "", pending: null, step: 0, typed: 0,
    // THE DOCUMENT: a reload starts a new one, without the run's mark.
    mark: "", origin: 1_000_000.5,
    // A MESSAGE THE SERVER TOOK ON AS A REQUEST (2026-10-03): its script, and
    // what the page has shown of each request.
    req: null, requests: {}, views: 0, stops: 0,
  };
  // THE REQUEST'S OWN VIEW AS THE SERVER WOULD ANSWER IT, from its script.
  const viewOf = (q) => ({
    key: q.key, ended: q.ended, stop: q.stopped, state: q.ended ? (q.stopped ? "stopped" : q.approval ? "waiting" : "done") : q.approval ? "waiting" : "running",
    parts: [{ n: 0, words: q.say, status: q.ended ? (q.stopped ? "cancelled" : "done") : q.approval ? "approval" : "queued", route: q.route, ids: [q.job], jobs: q.ended && !q.stopped ? [q.job] : [], charged: 0, ...(q.addition ? { addition: true } : {}) }],
  });
  const listeners = {};
  const state = () => ({
    signedIn: st.signedIn, uid: st.uid, gate: st.gate, workspace: st.workspace,
    busy: st.busy, send: st.workspace && !st.busy, sendDisabled: st.workspace && !st.busy ? false : null,
    stop: st.workspace && st.busy, textarea: st.workspace, disabled: st.workspace ? false : null,
    value: st.value, working: st.busy ? 1 : 0, attached: st.attached, strip: st.strip,
    messages: st.messages.concat(st.busy ? [{ who: "a", busy: true, text: "Working" }] : []),
    requests: st.requests,
  });
  const respond = (method, path, status, req, res, headers = {}) => {
    const r = {
      request: () => ({ url: () => ORIGIN + path, method: () => method, postData: () => (req ? JSON.stringify(req) : null) }),
      status: () => status, headers: () => headers, text: async () => JSON.stringify(res),
    };
    return Promise.all((listeners.response || []).map((h) => h(r)));
  };
  const page = {
    on: (ev, h) => { (listeners[ev] = listeners[ev] || []).push(h); },
    goto: async (url) => { calls.push(`goto ${url}`); st.url = url; return { headers: () => ({ "x-site-version": "01790468089054-8btpep" }) }; },
    evaluate: async (fn, arg) => {
      if (fn.name === "cardIdInPage") return st.card ? `srv_${slug}` : "";
      // THE TAB'S MARK, kept on the page's own window until a reload.
      if (fn.name === "markTabInPage") { st.mark = arg; return { mark: st.mark, origin: st.origin, path: "/projects" }; }
      if (fn.name === "tabMarkInPage") return { mark: st.mark, origin: st.origin, path: "/projects" };
      // THE SITE'S OWN PAGE (a row scenario reads what a visitor sees there).
      if (fn.name === "shownListInPage") { calls.push(`shown ${arg}`); return opt.shown ? opt.shown(st.url) : []; }
      // A REQUEST'S VIEW, READ THROUGH THE PAGE'S SESSION: it ends after its polls, or once stopped.
      if (fn.name === "requestViewInPage") {
        const q = st.req;
        calls.push(`view ${arg.key}`);
        st.views++;
        if (!q || q.key !== arg.key) return { status: 404, ok: false, request: null };
        if (!q.ended && (q.stopped || (!q.approval && --q.polls <= 0))) q.ended = true;
        return { status: 200, ok: true, request: viewOf(q) };
      }
      if (fn.name === "stopRequestInPage") {
        calls.push(`stop ${arg.key}`);
        st.stops++;
        if (st.req && st.req.key === arg.key) st.req.stopped = true;
        return { status: 200, ok: true, state: "stopped" };
      }
      if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
      // THE PAGE SHOWS A REQUEST THAT ENDED: its part's own reply (read
      // through the job poll, under its final mark), then closes it.
      if (st.req && st.req.ended && !st.req.shown) {
        const q = st.req;
        q.shown = true;
        if (!q.stopped) {
          await respond("GET", `/api/site/edit/${q.job}`, 200, null, q.reply, { "x-gf-edit": "final" });
          st.messages.push({ who: "a", busy: false, text: q.reply.msg || "Done." });
        } else st.messages.push({ who: "a", busy: false, text: "Stopped at your request." });
        st.requests[q.key] = { closed: true, ended: true };
      }
      if (st.pending && --st.pending.polls <= 0) {
        const p = st.pending; st.pending = null;
        if (!p.hang) {
          if (p.hop) {
            // THE ROUTE HANDED THE EDIT TO ANOTHER LAYER: the first job's
            // stored reply escalates, and the page files a second edit, as
            // `escalatedEdit` does, whose own job then answers.
            await respond("GET", `/api/site/edit/${p.job}`, 200, null, { ok: false, escalate: true, layer: "page", cost: 0 }, { "x-gf-edit": "final" });
            await respond("POST", `/api/site/${slug}/edit`, 202, { layer: "page" }, { ok: true, job: p.hop, status: "queued" });
            await respond("GET", `/api/site/edit/${p.hop}`, 200, null, p.reply, { "x-gf-edit": "final" });
          } else {
            // A FAILED JOB'S STORED REPLY comes back under its own status (the
            // data step's no-match is a 422), still marked final.
            await respond("GET", `/api/site/edit/${p.job}`, opt.finalStatus ? opt.finalStatus(p.n) : 200, null, p.reply, { "x-gf-edit": "final" });
          }
          // THE JOB'S OWN WRITE lands before its reply is on screen, as it does
          // live: the handler writes, then the stored reply is read.
          if (opt.onDone) opt.onDone(p.n);
          // WHAT THE APP DRAWS for that reply: a warning with the stored
          // sentence and the money for a refusal, the sentence for a success.
          st.messages.push({ who: "a", busy: false, text: opt.screen ? opt.screen(p.n, p.reply) : (p.reply.msg || "Done.") });
          st.busy = false;
          // A PAGE THAT RELOADS ITSELF once a reply is out: a new document.
          if (opt.reloadAfter === p.n) { st.mark = ""; st.origin += 1; }
        } else st.pending = p;
      }
      return state();
    },
    click: async (sel) => {
      calls.push("click " + sel);
      if (sel.includes(".st-card-name")) st.workspace = true;
      if (sel === "#stSend") {
        const said = st.value;
        st.messages.push({ who: "u", busy: false, text: said });
        const n = st.step++;
        const images = st.attached ? [{ name: "ui-logo.png", data: "data:image/png;base64," + fs.readFileSync(ROOT + FIXTURE).toString("base64") }] : undefined;
        st.value = ""; st.attached = 0; st.strip = 0; st.busy = true;
        const job = String(n + 1).padStart(32, "0");
        // TAKEN ON AS A REQUEST: the routing answer names it, the page posts no
        // edit, draws the card, and follows it.
        if (opt.request) {
          const q = { ...opt.request(n), say: said, job, polls: 3, ended: false, stopped: false, shown: false };
          st.req = q;
          await respond("POST", "/api/site/route", 200, { message: said, attached: !!images, ...(images ? { images } : {}) },
            { ok: true, intent: q.route === "addon" ? "addon" : "edit", layer: q.route === "addon" ? "" : q.route, cost: 2, request: viewOf(q) });
          opt.onSend && opt.onSend(n);
          st.messages.push({ who: "a", busy: false, card: true, text: said + " Queued" });
          st.requests[q.key] = { closed: false, ended: false };
          st.busy = false;
          return;
        }
        await respond("POST", "/api/site/route", 200, { message: said, attached: !!images },
          opt.routed ? opt.routed(n) : { ok: true, intent: "edit", layer: ["logo", "picture", "page"][n], cost: 2 });
        await respond("POST", `/api/site/${slug}/edit`, 202, opt.editBody ? opt.editBody(n, said) : { layer: "x", images }, { ok: true, job, status: "queued" });
        opt.onSend && opt.onSend(n);
        st.pending = { n, job, polls: 2, hang: opt.hangAt === n, hop: opt.hopAt === n ? "9".repeat(32) : "", reply: opt.reply ? opt.reply(n) : { ok: true, msg: `reply ${n + 1}` } };
      }
    },
    fill: async (sel, v) => {
      calls.push(`fill ${v}`);
      // A BOX THAT STOPS TAKING TYPING after a reply (a redraw that resets it).
      if (opt.eatsTypingAfter !== undefined && st.step > opt.eatsTypingAfter && !st.busy) return;
      st.value = v;
      // A PAGE THAT GOES BUSY AGAIN on its own once a reply is out (a resumed
      // watch, say): the next message must not be sent into it.
      if (v === "" && opt.busyAfter !== undefined && st.step === opt.busyAfter + 1 && !st.pending) st.busy = true;
    },
    waitForEvent: async (ev) => {
      calls.push("wait " + ev);
      return { setFiles: async () => { if (!opt.noLand) { st.attached = 1; st.strip = 1; } } };
    },
    screenshot: async () => {},
  };
  const inits = [], routes = [];
  const context = {
    route: async (pattern, handler) => { routes.push({ pattern, handler }); },
    addInitScript: async (fn, arg) => { inits.push({ fn, arg }); },
    newPage: async () => page,
    close: async () => { calls.push("close context"); },
  };
  // THE VISITOR'S TAB (the rules test's booking) is a context of its own: the
  // first context is the app's, and a scenario that books gets its visitor
  // stand-in for every context after that.
  let contexts = 0;
  const contextOptions = [];
  const browser = {
    newContext: async (o) => { contextOptions.push(o); return contexts++ > 0 && opt.visitor ? opt.visitor() : context; },
    close: async () => { calls.push("close"); },
  };
  return { st, calls, inits, routes, contextOptions, launch: async () => browser };
}

const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID, email: "o@example.com" } };
const drive = (h, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: UI_SCENARIOS["4a-part-b"],
  spend: true, balanceNow: async () => 65, evid: "", launch: h.launch, log: () => {},
  openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, ...over,
});

// ── TEST 4b's D1: ONE ROW, THROUGH THE REAL APP, AND BACK ──────────────────

const D1 = UI_SCENARIOS["4b-d1-price"];
const D1_BACK = UI_SCENARIOS["4b-d1-restore"];
const D1_SAY = "In today's bake list, change the Sea Salt Focaccia's price to £4.60.";
const D1_REPLY = { ok: true, layer: "data", applied: [{ table: "loaves", id: 6, columns: ["price"] }], failed: 0, cost: 1, msg: "Updated one entry in loaves." };
const SITE = "https://fold-lane-bakery.gofarther.app";

// A supplied bakery: the owner route answers the price as a string (NUMERIC,
// as the database driver does), the visitor route as the site's JSON, and the
// order page draws one card per loaf, by name. Its PATCH is the REAL owner
// route (site-owner.mjs) over the same rows, so the recovery's condition is
// judged by the route's own UPDATE. Every read and write is logged into the
// stand-in's own call list, so its order against the Send is visible.
// `oldWorker` answers a conditional write as the route did before the form.
function bakery(calls, rows = UI_SCENARIOS["4b-d1-price"].row.record, { oldWorker = false } = {}) {
  const db = { rows: JSON.parse(JSON.stringify(rows)), patches: [], ownerReads: 0, onOwnerRead: null };
  db.t = ownerTable({ types: { name: "text", description: "text", price: "numeric", photo: "text", created_at: "text" }, rows: db.rows, inPlace: true });
  db.owner = async () => {
    calls.push("owner read");
    db.ownerReads++;
    const res = { status: 200, json: { rows: db.rows.map((r) => ({ ...r, price: String(r.price) })) } };
    if (db.onOwnerRead) db.onOwnerRead(db.ownerReads, db);
    return res;
  };
  db.pub = async () => { calls.push("visitor read"); return { status: 200, text: JSON.stringify(db.rows) }; };
  db.patch = async (id, body) => {
    calls.push(`patch ${id} ${JSON.stringify(body)}`);
    db.patches.push({ id, body });
    if (oldWorker) return { status: 400, json: { error: "nothing to update" } };
    const r = await handleOwnerWrite(db.t.deps, { slug: "fold-lane-bakery", table: "loaves", uid: "owner-1", method: "PATCH", rowId: String(id), body });
    return { status: r.status, json: r.body };
  };
  db.lines = () => [...db.rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `${r.name} £${Number(r.price).toFixed(2)} · ${r.description}`);
  db.focaccia = () => db.rows.find((r) => r.id === 6);
  return db;
}

function d1Harness(opt = {}) {
  let db = null;
  const h = standIn({
    routed: () => ({ ok: true, intent: "edit", layer: "data", cost: 2 }),
    editBody: (n, said) => ({ layer: "data", instruction: said, idem: "k" }),
    reply: () => D1_REPLY,
    onDone: () => (opt.onDone ? opt.onDone(db) : (db.focaccia().price = 4.6)),
    shown: () => (opt.shown ? opt.shown(db) : db.lines()),
    hangAt: opt.hangAt,
  });
  db = bakery(h.calls, opt.rows, { oldWorker: !!opt.oldWorker });
  return { h, db };
}
// The probe (a conditional write no row can meet) and the recovery's write.
const PROBE = { id: 6, body: probeBody(UI_SCENARIOS["4b-d1-price"].row) };
const BACK = { id: 6, body: { $set: { price: "4.5" }, $if: { name: "Sea Salt Focaccia", price: "4.6" } } };
const driveD1 = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fold-lane-bakery", scenario: D1, spend: true, balanceNow: async () => 59,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, shownMs: 50,
  rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: SITE, ...over,
});

// ── THE WIRING ─────────────────────────────────────────────────────────────

const CANARY = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
const FLOW = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
const MOD = fs.readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");

// ── THE RULES TEST, THROUGH THE STAND-IN ────────────────────────────────────
//
// The app's half is the stand-in above, answering at the rules layer. The
// visitor's booking is a tab of its own (`bookingTab`): the page's form, and
// the request its "Book a table" makes, which the tab's wall either lets out or
// stops. A let-out request is answered by `lido`, a database that refuses a
// visitor's booking at the privilege check once it is closed and otherwise
// takes it as a row (and stamps the notification record, as the platform does
// before it sends). Every read and the one cleanup write go through `db.io`,
// the shape the canary hands the driver.

const RULES = UI_SCENARIOS["4b-rules-close"];
const LIDO = "https://lido-axes-b.gofarther.app";
const DENIED_BOOKING = { code: "42501", details: null, hint: null, message: "permission denied for table bookings" };
const rulesReply = (fields = ["retired"], over = {}) => ({
  ok: true, layer: "rules", applied: [{ table: "bookings", fields }], refused: [], cost: 1,
  msg: fields.includes("write") ? "**bookings** — changed who can add to it." : "**bookings** — changed whether it's open.", ...over,
});
const LIDO_SURFACE = () => {
  const r = RULES.rules.record;
  return {
    at: "t",
    routes: Object.fromEntries(r.routes.map((p) => [p, { status: 200, build: r.build, version: "", bytes: 100, masked: 1, sha256: "p" + p, styles: [r.stylesheet.path] }])),
    styles: { [r.stylesheet.path]: { status: 200, bytes: r.stylesheet.bytes, sha256: r.stylesheet.sha256 } },
  };
};

function lido(calls, opt = {}) {
  const db = {
    access: "collect", closed: false, notify: true, notifiedAt: null,
    rows: (opt.rows || [{ id: 5, name: "Real Person", phone: "07123 456789", party_size: 4, booking_date: "2026-10-01", booking_time: "12:00:00" }]).map((r) => ({ ...r })),
    nextId: opt.nextId || 6, names: opt.names || [], deletes: [], newestReads: 0, onNewest: null,
  };
  const rows = () => [...db.rows].sort((a, b) => b.id - a.id).slice(0, 50).map((r) => ({ ...r }));
  db.io = {
    tables: async () => {
      calls.push("tables");
      return { status: 200, json: { tables: [{ name: "bookings", access: db.access, rows: db.rows.length, columns: ["name", "phone", "party_size", "booking_date", "booking_time"] }, { name: "menu_items", access: "display", rows: 6, columns: ["name", "price"] }] } };
    },
    newest: async () => { calls.push("newest"); db.newestReads++; if (db.onNewest) db.onNewest(db.newestReads, db); return { status: 200, json: { rows: rows() } }; },
    secrets: async () => { calls.push("secrets"); return { status: 200, json: { ok: true, secrets: db.names.map((name) => ({ name, prefix: "re_9Zx", last4: "Q7w2", created_at: "t" })) } }; },
    stamp: async () => { calls.push("stamp"); return { status: 200, rows: [{ notify: db.notify, notified_at: db.notifiedAt }] }; },
    menu: async () => { calls.push("menu"); return { status: 200, text: "[{\"id\":1,\"name\":\"Toastie\"}]" }; },
    bookingsRead: async () => { calls.push("bookings read"); return { status: 403, text: JSON.stringify(DENIED_BOOKING) }; },
    surface: async () => { calls.push("surface"); return LIDO_SURFACE(); },
    del: async (id) => {
      calls.push(`delete ${id}`);
      db.deletes.push(id);
      const i = db.rows.findIndex((r) => r.id === id);
      if (i < 0) return { status: 404, json: { error: "no such row" } };
      db.rows.splice(i, 1);
      return { status: 200, json: { ok: true, id, soft: false } };
    },
  };
  // A VISITOR'S BOOKING: refused at the privilege check once closed; otherwise a row, and the stamp.
  db.book = (body) => {
    if (db.closed) return { status: 403, body: DENIED_BOOKING };
    db.rows.push({ id: db.nextId++, ...body, booking_time: body.booking_time + ":00" });
    if (db.notify && !db.notifiedAt) db.notifiedAt = "2026-09-27T12:00:00Z";
    return { status: 201, body: "" };
  };
  return db;
}

function bookingTab(calls, opt = {}) {
  const listeners = {};
  let wall = null;
  const form = { name: "", phone: "", date: "", times: [], hydrated: !opt.neverHydrates };
  let said = { toasts: [], success: false, form: true };
  const out = [];
  const fire = (ev, x) => Promise.all((listeners[ev] || []).map((f) => f(x)));
  // A request as the page made it. A string body is sent as that exact text
  // (malformed JSON included); headers are the lower-case names a browser
  // reports, `content-type` alone unless the case says otherwise.
  const req = (method, url, body, errorText = "net::ERR_BLOCKED_BY_CLIENT", headers = { "content-type": "application/json" }) => ({
    method: () => method, url: () => url,
    postData: () => (body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body)),
    allHeaders: async () => { if (opt.headersUnreadable) throw new Error("the request is gone"); return { ...headers }; },
    failure: () => ({ errorText }),
  });
  const send = async (method, url, body, headers) => {
    let decided = "";
    await wall({ request: () => req(method, url, body, undefined, headers), fallback: async () => { decided = "out"; }, abort: async () => { decided = "stopped"; } });
    calls.push(`${method} ${new URL(url).pathname} ${decided}`);
    if (decided !== "out") { await fire("requestfailed", req(method, url, body)); return null; }
    out.push({ method, path: new URL(url).pathname, body });
    const a = opt.answer ? opt.answer(body) : { status: 403, body: DENIED_BOOKING };
    if (a.drop) { await fire("requestfailed", req(method, url, body, "net::ERR_CONNECTION_RESET")); return { dropped: true }; }
    await fire("response", { request: () => req(method, url, body), status: () => a.status, text: async () => (typeof a.body === "string" ? a.body : JSON.stringify(a.body)) });
    return a;
  };
  const page = {
    on: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); },
    goto: async (url) => { calls.push(`visit ${url}`); },
    evaluate: async (fn) => {
      if (fn.name === "bookingFormInPage") return { hydrated: form.hydrated, name: form.name, phone: form.phone, date: form.date, times: form.times, party: true, submit: "Book a table" };
      if (fn.name === "bookingOutcomeInPage") return said;
      throw new Error("unexpected page function " + fn.name);
    },
    fill: async (sel, v) => {
      if (sel === 'input[name="name"]') form.name = opt.mangleName ? v + "!" : v;
      else if (sel === "#phone") form.phone = v;
      else if (sel === 'input[name="booking_date"]') form.date = v;
      else throw new Error("unexpected field " + sel);
    },
    click: async (sel) => {
      calls.push(`press ${sel}`);
      if (sel.startsWith('form button[type="button"]')) form.times = ["17:00"];
      if (sel !== 'form button[type="submit"]') return;
      // What the form holds, and what the page's own code then sends: the two
      // can differ (`sendAs`), which is the case the gate exists for.
      const held = { name: form.name, phone: form.phone, party_size: 2, booking_date: form.date, booking_time: form.times[0] };
      const body = opt.sendAs ? opt.sendAs(held) : held;
      const to = LIDO + "/api/db/lido-axes-b/data/bookings" + (opt.query || "");
      if (opt.otherWrite) await send("POST", LIDO + "/api/telemetry", { e: 1 });
      const a = await send("POST", to, body, opt.headers);
      if (opt.twice) await send("POST", to, opt.retryAs ? opt.retryAs(held) : body, opt.headers);
      said = a && a.status >= 200 && a.status < 300 ? { toasts: ["Table held — see you by the water."], success: true, form: false }
        : a && a.status ? { toasts: ["That isn't available."], success: false, form: true }
          : { toasts: ["We couldn't reach the booking system."], success: false, form: true };
    },
  };
  const ctx = { route: async (p, f) => { wall = f; }, newPage: async () => page, close: async () => { calls.push("close visitor"); } };
  return { ctx, out, form };
}

function rulesHarness(opt = {}) {
  let db = null;
  const tabs = [];
  const h = standIn({
    routed: () => ({ ok: true, intent: "edit", layer: "rules", cost: 2 }),
    editBody: (n, said) => ({ layer: "rules", instruction: said, idem: "k" }),
    reply: () => opt.reply || rulesReply(),
    onDone: () => (opt.onDone ? opt.onDone(db) : (db.closed = true)),
    hangAt: opt.hangAt,
    visitor: () => {
      const t = bookingTab(h.calls, { answer: (body) => (opt.answer ? opt.answer(body, db) : db.book(body)), ...(opt.tab || {}) });
      tabs.push(t);
      return t.ctx;
    },
  });
  db = lido(h.calls, opt);
  return { h, db, tabs };
}
const driveRules = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "lido-axes-b", scenario: RULES, spend: true, balanceNow: async () => 56,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0,
  bookMs: 80, answerMs: 60, bookSettleMs: 30, rules: db.io, allow: readAllow(""), runId: "36300000001", siteOrigin: LIDO, ...over,
});
const BOOKINGS = "/api/db/lido-axes-b/data/bookings";

// ── TEST 5: A PAGE TAKEN OFF THROUGH THE REAL APP ────────────────────────────
//
// Two messages on the bakery: the gallery out of the menu (a page another page
// still names is refused), then the gallery page off the site. Each message
// may leave the app only as its own kind of edit, so a misrouted one costs its
// routing call and changes nothing. Putting the page back is the restore mode,
// pressed on its own — not part of this scenario.

const T5 = UI_SCENARIOS["5-page-remove"];
const T5_MENU = "Take Gallery out of the menu.";
const T5_REMOVE = "Remove the gallery page.";

// ── THE SECOND MESSAGE WAITS FOR THE FIRST TO HAVE DONE ITS WORK ─────────────
//
// Run 47 sent "Remove the gallery page." after a menu edit that had answered
// `look/no-change`: it paid its routing call and was refused `kept`, as
// designed, and the harness printed "UI MODE PASSED". A dependent message is
// now sent only once the message it depends on stored a success at its layer.

const RUN47_MENU = { ok: false, error: "no-change", cost: 0, unchanged: true, msg: "I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like." };
const stepWith = (n, reply, extra = {}) => ({
  n, sent: true, completed: true,
  network: reply === undefined ? [] : [{ method: "GET", path: "/api/site/edit/j", status: 200, final: true, res: reply }],
  ...extra,
});

// ── TEST 9: A FOLLOW-UP AFTER A FAILURE, IN THE SAME TAB ────────────────────
//
// fretwork-1's lessons, as the stand-in's database; the first message's job
// answers the data step's own no-match (a 422, refunded), and the second's
// changes one price. The run keeps what the second message changed, so its
// PATCH must never be called at all.

const T9 = UI_SCENARIOS["9-follow-up"];
const T9_FAIL = "We've stopped running the Weekend workshop, please take it off the price list.";
const T9_SAY = "Please change the Hour one-to-one's price to £45.";
const T9_SITE = "https://fretwork-1.gofarther.app";
const NO_MATCH_MSG = "I couldn't match that to anything the site stores — say which list it's in and I'll have another go.";
// THE POLL ROUTE'S ANSWER for a refunded job: the handler's stored reply, its
// cost taken from the job's row (0 once refunded) and the refund named.
const T9_NO_MATCH = { ok: false, error: "no-match", cost: 0, refunded: 1, usage: { in: 900, out: 13 }, msg: NO_MATCH_MSG };
const T9_DONE = { ok: true, layer: "data", applied: [{ table: "lessons", id: 4, columns: ["price"] }], failed: 0, cost: 1, msg: "Updated one entry in lessons." };
// What the app draws for each: `editAnswer`'s warning and money, or the success sentence.
const t9Screen = (n, reply) => (reply.ok === false ? "" + reply.msg + " This edit cost you nothing. Reading your message cost 2 credits." : reply.msg);

function lessons(calls, rows = T9.row.record) {
  const db = { rows: JSON.parse(JSON.stringify(rows)), patches: [] };
  // The owner route answers a NUMERIC price as text; the visitor route as the Data API serves it.
  db.owner = async () => { calls.push("owner read"); return { status: 200, json: { rows: db.rows.map((r) => ({ ...r, price: String(r.price) })) } }; };
  db.pub = async () => { calls.push("visitor read"); return { status: 200, text: JSON.stringify(db.rows) }; };
  db.patch = async (id, body) => { calls.push(`patch ${id}`); db.patches.push({ id, body }); return { status: 409, json: { code: "conflict" } }; };
  // Each page draws one line per lesson; the home page's carries its button.
  db.lines = (url) => db.rows.map((r) => `${r.name} ${r.duration} ${r.description} £${r.price}${String(url || "").endsWith("/prices") ? "" : " Select"}`);
  db.hour = () => db.rows.find((r) => r.id === 4);
  return db;
}

function t9Harness(opt = {}) {
  let db = null;
  const h = standIn({
    slug: "fretwork-1",
    routed: () => ({ ok: true, intent: "edit", layer: "data", cost: 2 }),
    editBody: (n, said) => ({ layer: "data", instruction: said, idem: "k" + n }),
    reply: (n) => (opt.reply ? opt.reply(n) : n === 0 ? T9_NO_MATCH : T9_DONE),
    finalStatus: (n) => ((opt.reply ? opt.reply(n) : n === 0 ? T9_NO_MATCH : T9_DONE).ok === false ? 422 : 200),
    screen: opt.screen || t9Screen,
    onDone: (n) => (opt.onDone ? opt.onDone(n, db) : n === 1 && (db.hour().price = 45)),
    shown: (url) => (opt.shown ? opt.shown(url, db) : db.lines(url)),
    hangAt: opt.hangAt,
    reloadAfter: opt.reloadAfter,
  });
  db = lessons(h.calls, opt.rows);
  return { h, db };
}
const driveT9 = (h, db, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: "fretwork-1", scenario: T9, spend: true, balanceNow: async () => 10,
  evid: "", launch: h.launch, log: () => {}, openMs: 50, attachMs: 50, startMs: 50, stepMs: 60, pollMs: 1, settleMs: 0, shownMs: 50,
  rows: { owner: db.owner, pub: db.pub, patch: db.patch }, siteOrigin: T9_SITE, ...over,
});

// ── REQUEST MODE (2026-10-03, the owner's review: *"Adapt the UI canary for
// request mode on this branch before rollout, rather than leaving that
// implementation until after deployment."*) — a message the server takes on
// as a request: the page posts no edit, draws the request's card and follows
// it; the canary follows it too, walls its parts with the request's own Stop,
// and reads its jobs off the request's own view.

const KEY_N = (n) => "rqcanary" + "0".repeat(11) + n;
const LOGO_ONLY = { site: "fold-lane-bakery", budget: 20, layers: ["logo"], steps: [{ say: "Use this picture as the logo.", attach: FIXTURE }] };
