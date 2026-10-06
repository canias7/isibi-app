// A FINISHED CHANGE IS SHOWN AT ONCE; ITS REPLY FOLLOWS ON ITS OWN (2026-10-04).
//
// The owner, reviewing the background replies: *"apply the completed result
// and refresh the preview as soon as the authoritative job outcome arrives,
// while continuing to follow the model-written reply independently. Do not
// make the preview wait through reply retries, and do not display "Done" for a
// failed or refused operation simply because its explanation is pending.
// Verify reload and duplicate polls cannot apply results or append replies
// twice."*
//
// Before this, a queued edit whose reply was still being written was WAITED
// for: the preview, the page list, the undo offer and the send box all stayed
// as they were until the reply was written or failed — up to fifteen minutes
// of retries — and the live line said "Done — writing up what changed…" over
// a refusal too.
//
// Now the outcome is applied the moment it arrives, by the same reader, and an
// ending a written reply tells holds the reply's place on the thread with a
// line chosen from what the job really did (`replyOutcome`, the server's
// reading of the reply's own facts). The reply is followed on its own and
// settles that message where it stands, once.
//
// `siteSend` and everything a queued edit reaches are cut out of
// public/chat.js and RUN with the real public/edit-poll.js; `fetch` is the one
// seam, and a request the script does not answer is HELD until the case
// answers it — so each case says exactly when the job ends and when its reply
// is written. Every answer here is SUPPLIED: this proves what the page does
// with the server's answers, never what a real model writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { ASK_FNS, ASK_LINES } from "./fixtures/browser-ask.mjs";
import { REPLY_HORIZON_MS, REPLY_BG_DEADLINE_MS, REPLY_RETRY_GRACE_MS, replyOutcomeOf, editReplyFacts, addonReplyFacts, REPLY_OUTCOMES } from "../builder/site-reply.mjs";

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
  cutLine("const editReplyFollowing ="),
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
  // THE FOUR THIS CHANGE ADDED: which endings a written reply tells, the
  // finish that holds a reply's place, its follower, and the resume.
  cut("function replyTellsEnding("),
  cut("function editReplyHold("),
  cut("function editReplyFollow("),
  cut("function siteHeldRepliesCheck("),
  cut("function siteMsgText("),
  cut("function resumeEditJob("),
  cut("function resumeOpenSite("),
  cut("function siteAddon("),
  cut("function addonAnswer("),
  cut("function readRouteReply("),
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
    "pageOpsSaid", "editReplyBody", "editReply", "esc"].map((n) => cut("function " + n + "(")),
  cut("function reactSend("),
  cut("function reactStageLabel("),
  cut("function buildCostWords("),
  cut("function buildErrOutcome("),
  cutLine("const ST_PHASE_ORDER ="),
].join("\n");

const settle = async () => { for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r)); };
const escapes = [];
process.on("unhandledRejection", (e) => { escapes.push(String((e && e.message) || e)); });
const copy = (v) => JSON.parse(JSON.stringify(v));

function kindOf(url, method) {
  const u = String(url);
  if (u === "/api/site/route") return "route";
  if (/^\/api\/site\/edit\//.test(u)) return method === "GET" ? "poll" : "cancel";
  if (/^\/api\/site\/[^/]+\/edit$/.test(u)) return "edit";
  if (/^\/api\/site\/[^/]+\/addon$/.test(u)) return "addon";
  if (/^\/api\/site\/react-(revise|build)$/.test(u)) return "rewrite";
  return "other";
}
function respond(a) {
  if (a.reject) return Promise.reject(a.reject);
  return Promise.resolve(new Response(a.body, { status: a.status, headers: { "content-type": "application/json", ...(a.headers || {}) } }));
}

const SITE = { id: "origin-1", slug: "fretwork-1", react: true, name: "Fretwork", url: "https://fretwork-1.gofarther.app/", pages: [{ path: "/" }, { path: "/prices" }, { path: "/gear" }], msgs: [] };

/**
 * ONE PAGE LOAD. `site` is the record as `sitesSave` kept it, `store` the
 * browser's own storage (carried from one load to the next for a reload), and
 * `clock` a time the case moves. Returns its handles.
 */
function page({ answers = {}, site = SITE, store = new Map(), clock = null } = {}) {
  const reqs = [];
  const held = [];
  const s = copy(site);
  if (!Array.isArray(s.msgs)) s.msgs = [];
  const script = {};
  for (const k of Object.keys(answers)) script[k] = answers[k].slice();
  const escapedBefore = escapes.length;
  let renders = 0;
  const Clock = clock ? class extends Date { static now() { return clock.now; } } : Date;
  const ctx = vm.createContext({
    window: {}, Auth: { accessToken: async () => "token" },
    AbortController, encodeURIComponent, Intl, Response, Headers, Date: Clock,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } },
    fetch: (url, init) => {
      const method = (init && init.method) || "GET";
      const kind = kindOf(url, method);
      reqs.push({ kind, method, url: String(url), body: init && init.body ? JSON.parse(init.body) : undefined });
      const next = script[kind] && script[kind].length ? script[kind].shift() : null;
      if (!next) return new Promise((resolve, reject) => { held.push({ kind, url: String(url), resolve, reject }); });
      return respond(next);
    },
    setInterval: () => ({}), clearInterval: () => {},
    setTimeout: (fn) => { setImmediate(fn); return {}; }, clearTimeout: () => {},
    showAuthGate: () => {}, scheduleCreditRefresh: () => {}, fetchCredits: () => {},
    siteById: (id) => (id === s.id ? s : null),
    sitesSave: () => {},
    sitePages: (x) => (Array.isArray(x.pages) ? x.pages : []),
    siteActivePage: () => null,
    paintAttachStrip: () => {},
    buildPicker: "grok",
    siteBusy: false, siteBuild: null, siteTicker: null, siteOpenId: s.id,
    renderSites: () => { renders++; },
    paintReactLive: () => {},
    siteAbort: null, siteErr: null,
  });
  vm.runInContext(SRC, ctx);
  return {
    ctx, s, store,
    async send(message) { ctx.siteSend(message); await settle(); },
    async answer(kind, a) {
      const at = held.findIndex((h) => h.kind === kind);
      assert.ok(at >= 0, "no " + kind + " request is waiting; waiting: " + JSON.stringify(held.map((h) => h.kind)));
      const [h] = held.splice(at, 1);
      respond(a).then(h.resolve, h.reject);
      await settle();
    },
    /** Answer the held poll of one job — a follow and a watch can both be waiting. */
    async answerJob(job, a) {
      const at = held.findIndex((h) => h.kind === "poll" && h.url === "/api/site/edit/" + job);
      assert.ok(at >= 0, "no poll of " + job + " is waiting; waiting: " + JSON.stringify(held.map((h) => h.url)));
      const [h] = held.splice(at, 1);
      respond(a).then(h.resolve, h.reject);
      await settle();
    },
    waiting() { return held.map((h) => h.kind); },
    waitingFor() { return held.map((h) => h.url.split("/").pop()); },
    polls() { return reqs.filter((r) => r.kind === "poll").length; },
    posts() { return reqs.filter((r) => r.method === "POST").map((r) => r.kind); },
    msgs() { return copy(s.msgs).filter((m) => m.r === "a"); },
    said() { return s.msgs.filter((m) => m.r === "a").map((m) => m.t); },
    busy() { return ctx.siteBusy; },
    rail() { return !!ctx.siteBuild; },
    lock() { return JSON.parse(vm.runInContext("JSON.stringify([...editInFlight.keys()])", ctx)); },
    following() { return JSON.parse(vm.runInContext("JSON.stringify([...editReplyFollowing])", ctx)); },
    blocked() { return JSON.parse(vm.runInContext("JSON.stringify([...editBlocked])", ctx)); },
    escaped() { return escapes.slice(escapedBefore); },
    renders: () => renders,
  };
}

const M1 = "Make the footer navy";
const M2 = "Change the opening hours to 9 till 5";
const json = (o) => JSON.stringify(o);
const ok = (o, status = 200) => ({ status, body: json(o) });
const stored = (o, status = 200) => ({ status, body: json(o), headers: { "x-gf-edit": "final" } });
const routeTo = (layer) => ok({ ok: true, intent: "edit", layer, cost: 2 });
const routeAdd = () => ok({ ok: true, intent: "addon", cost: 2 });
const receipt = (job) => ok({ ok: true, job, status: "queued", poll: "/api/site/edit/" + job }, 202);
const pending = (b, outcome) => stored({ ...b, replyState: "pending", ...(outcome ? { replyOutcome: outcome } : {}) });
const written = (b, text) => stored({ ...b, reply: text, replySource: "model" });
const failed = (b) => stored({ ...b, replyState: "failed" });
const QID = "0123456789abcdef0123456789abcdef";

// THE EDIT ROUTE'S OWN SHAPES (worker.js), as test/edit-result-display.test.mjs has them.
const LOOKED = { ok: true, layer: "look", lanes: ["css"], layers: ["look"], cost: 1 };
const WORDED = { ok: true, layer: "text", applied: 1, cost: 1 };
const PARTLY = { ...LOOKED, partial: [{ layer: "text", msg: "I couldn’t find that sentence on the page.", words: ["the opening hours"] }] };
const EXPLAIN = { ok: false, error: "no-page", cost: 0, unchanged: true, msg: "Your site has no /blog page, so there was nothing to take off." };
const ASKED = { ok: false, error: "clarify", cost: 0, clarify: { id: QID, text: "Which footer — the main one or the shop’s?", options: ["Main", "Shop"] } };
const LOOK_ASKED = { ...LOOKED, clarify: { id: QID, text: "And which footer should get the phone number?", options: ["Main", "Shop"] } };
const SATISFIED = { ok: true, layer: "nav", satisfied: true, cost: 0, msg: "“Classes” is already in every menu." };
const REVIEW = { ok: false, error: "needs-review", cost: 0 };
const UNREADABLE = { ok: "true", layer: "look" };
// THE ADD-ON ROUTE'S.
const ADDED = { ok: true, cost: 12, kinds: ["qr"], added: [], changed: ["index.tsx"], qrs: [{ label: "Menu", on: ["/"] }] };
const ADD_REFUSED = { ok: false, cost: 0, msg: "I couldn’t design that part from what you asked." };

const LOOK = "✅ Updated the look.";
const REFUSED = "⚠️ " + EXPLAIN.msg + " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.";
const R1 = "I made the footer navy — every page shows it now.";
const R2 = "The opening hours now read 9 till 5.";

/** The page idle: the latch free, nothing busy or running, nothing escaped. */
function assertFreed(p, when) {
  assert.deepEqual(p.lock(), [], "the site is still latched " + when);
  assert.equal(p.busy(), false, "the send box is still busy " + when);
  assert.equal(p.rail(), false, "the step rows are still running " + when);
  assert.deepEqual(p.escaped(), [], "a rejection escaped to the event loop " + when);
}

// ── THE OWNER'S CASE: THE PREVIEW DOES NOT WAIT FOR THE REPLY ──────────────

test("a queued edit whose reply is still being written: the outcome is applied at once (preview, latch, send box), its place is held by “Done — writing up what changed…”, and the written reply then replaces that line where it stands — once, with nothing re-applied", async () => {
  const p = page({ answers: { route: [routeTo("look")], edit: [receipt("job-1")], poll: [pending(LOOKED, "done")] } });
  await p.send(M1);
  // APPLIED AT ONCE: the preview moved, the page is free, nothing is held up.
  assert.equal(p.s.previewV, 1, "the preview waited for the reply");
  assertFreed(p, "while the reply is written");
  assert.deepEqual(p.msgs(), [{ r: "a", t: "Done — writing up what changed…", held: { job: "job-1", at: p.s.msgs[1].held.at, else: LOOK, asked: "" } }]);
  // THE REPLY IS FOLLOWED ON ITS OWN: one poll waiting, and the job's own record is gone.
  assert.deepEqual(p.waiting(), ["poll"]);
  assert.equal(P.resumableRecord("fretwork-1", Date.now(), { getItem: (k) => p.store.get(k) || null }), null, "the job is still kept to resume, so a reload would apply it again");
  // STILL BEING WRITTEN (a retry): nothing moves, nothing is added.
  await p.answer("poll", pending(LOOKED, "done"));
  assert.equal(p.s.previewV, 1);
  assert.equal(p.msgs().length, 1);
  assert.equal(p.said()[0], "Done — writing up what changed…");
  // WRITTEN: the line becomes the reply, where it stands, and the follow ends.
  await p.answer("poll", written(LOOKED, R1));
  assert.deepEqual(p.msgs(), [{ r: "a", t: R1 }]);
  assert.equal(p.s.previewV, 1, "the outcome was applied a second time");
  assert.deepEqual(p.waiting(), [], "the page still follows a reply it has shown");
  assert.deepEqual(p.following(), []);
  assert.deepEqual(p.posts(), ["route", "edit"], "something was posted beside the reply's follow");
  assertFreed(p, "after the reply");
});

test("the next message goes out while the first reply is still being written, and the first reply then lands in its own place above the second", async () => {
  const p = page({
    answers: { route: [routeTo("look"), routeTo("text")], edit: [receipt("job-1"), receipt("job-2")], poll: [pending(LOOKED, "done")] },
  });
  await p.send(M1);
  assertFreed(p, "while the first reply is written");
  await p.send(M2);
  // THE SECOND MESSAGE WENT OUT, and its job is watched beside the first's follow.
  assert.deepEqual(p.posts(), ["route", "edit", "route", "edit"]);
  assert.deepEqual(p.waitingFor().sort(), ["job-1", "job-2"]);
  // The first reply is still being written; the second job ends with its reply written.
  await p.answerJob("job-1", pending(LOOKED, "done"));
  await p.answerJob("job-2", written(WORDED, R2));
  assert.equal(p.s.previewV, 2, "each outcome moves the preview once");
  assert.deepEqual(p.said(), ["Done — writing up what changed…", R2]);
  // Then the first reply is written, and lands in the first message's place.
  await p.answerJob("job-1", written(LOOKED, R1));
  assert.deepEqual(p.said(), [R1, R2], "the replies are not each in their own message's place");
  assert.equal(p.s.previewV, 2);
  assertFreed(p, "after both");
});

// ── NEVER “DONE” OVER AN ENDING THAT DID NOT FINISH ────────────────────────

test("a refused edit whose explanation is still being written never says Done: its line says it did not go through, and the page's own refusal is said if the reply fails", async () => {
  const p = page({ answers: { route: [routeTo("page")], edit: [receipt("job-r")], poll: [pending(EXPLAIN, "not-done")] } });
  await p.send("Take the blog page off");
  assert.deepEqual(p.said(), ["That didn’t go through — writing up why…"]);
  assert.ok(!p.said().some((t) => /Done/.test(t)), "a refusal said Done");
  assert.equal(p.s.previewV, undefined, "a refusal moved the preview");
  assertFreed(p, "while the explanation is written");
  await p.answer("poll", failed(EXPLAIN));
  assert.deepEqual(p.msgs(), [{ r: "a", t: REFUSED }]);
  assert.deepEqual(p.waiting(), []);
});

test("“Done” is never shown for an answer whose `ok` is not true, whatever word came with it, and an answer with no word claims nothing", () => {
  assert.equal(P.pendingReplyLine({ ok: true, replyOutcome: "done" }), "Done — writing up what changed…");
  assert.equal(P.pendingReplyLine({ ok: true, replyOutcome: "partly" }), "Partly done — writing up what changed and what didn’t…");
  assert.equal(P.pendingReplyLine({ ok: false, replyOutcome: "not-done" }), "That didn’t go through — writing up why…");
  assert.equal(P.pendingReplyLine({ ok: false, replyOutcome: "asked" }), "A question first — writing it up…");
  assert.equal(P.pendingReplyLine({ ok: true, replyOutcome: "nothing" }), "Nothing changed — writing up why…");
  // A WORD THAT CONTRADICTS THE ANSWER, OR NONE, OR ONE NOT KNOWN: the line that claims nothing.
  for (const b of [{ ok: false, replyOutcome: "done" }, { ok: false, replyOutcome: "partly" }, { ok: "true", replyOutcome: "done" }, { ok: true }, { ok: true, replyOutcome: "finished" }, { ok: true, replyOutcome: ["done"] }, null, undefined, "done"]) {
    assert.equal(P.pendingReplyLine(b), "Writing up what happened…", JSON.stringify(b));
  }
  // AND NO LINE BUT "done"'s AND "partly"'s SAYS DONE.
  for (const [k, line] of Object.entries(P.PENDING_LINES)) assert.equal(/\bDone\b|\bdone\b/i.test(line), k === "done" || k === "partly", k);
  assert.doesNotMatch(P.PENDING_LINE, /done/i);
});

test("the server's word comes from the reply's own facts: done, partly, not done, a question, nothing — one per kind of ending, and none for a body it does not tell", () => {
  const of = (facts) => replyOutcomeOf(facts);
  assert.equal(of(editReplyFacts(LOOKED)), "done");
  assert.equal(of(editReplyFacts(PARTLY)), "partly");
  assert.equal(of(editReplyFacts(EXPLAIN)), "not-done");
  assert.equal(of(editReplyFacts({ ...ASKED, cost: 0 })), "", "a question and nothing else is told by its card, never by a written reply");
  assert.equal(of(editReplyFacts(LOOK_ASKED)), "partly");
  assert.equal(of(editReplyFacts(SATISFIED)), "nothing");
  assert.equal(of(editReplyFacts({ ok: false, escalate: true, reason: "no-data" })), "");
  assert.equal(of(addonReplyFacts(ADDED)), "done");
  assert.equal(of(addonReplyFacts(ADD_REFUSED)), "not-done");
  assert.equal(of(null), "");
  assert.equal(of({ facts: "changed" }), "");
  // A question beside a refusal is not done; a question alone is asked.
  assert.equal(of({ facts: [{ kind: "not-done" }, { kind: "question" }] }), "not-done");
  assert.equal(of({ facts: [{ kind: "question" }, { kind: "money" }] }), "asked");
  assert.deepEqual([...REPLY_OUTCOMES].sort(), Object.keys(P.PENDING_LINES).sort(), "the server and the page name different outcomes");
});

// ── EVERY ENDING SETTLES WHERE IT WOULD HAVE BEEN, HAD THE REPLY BEEN THERE ──

/**
 * THE PARITY GUARD. For each ending, four pages: the reply already written on
 * the first answer (A), held then written (B), the reply failed on the first
 * answer (C), held then failed (D). B must end exactly where A does and D where
 * C does — so holding a place can never change what a customer is finally told,
 * and an ending whose reader never tells a written reply (under review, an
 * answer it cannot read) is said at once, with no follow.
 */
const ENDINGS = [
  { name: "a success", body: LOOKED, outcome: "done", told: true },
  { name: "a wording success", body: WORDED, outcome: "done", told: true },
  { name: "a success beside a part not done", body: PARTLY, outcome: "partly", told: true },
  { name: "a refusal", body: EXPLAIN, outcome: "not-done", told: true },
  { name: "a question and nothing else", body: ASKED, outcome: "asked", told: true },
  { name: "a success beside a question", body: LOOK_ASKED, outcome: "partly", told: true },
  { name: "an addition already there", body: SATISFIED, outcome: "nothing", told: true },
  { name: "an edit under review", body: REVIEW, outcome: "not-done", told: false },
  { name: "an answer the page cannot read", body: UNREADABLE, outcome: "done", told: false },
  { name: "an addition", body: ADDED, outcome: "done", told: true, addon: true },
  { name: "a refused addition", body: ADD_REFUSED, outcome: "not-done", told: true, addon: true },
];
async function endWith(e, first, then) {
  const answers = e.addon
    ? { route: [routeAdd()], addon: [receipt("job-e")], poll: [first] }
    : { route: [routeTo("look")], edit: [receipt("job-e")], poll: [first] };
  const p = page({ answers });
  await p.send(M1);
  const during = p.msgs();
  if (then) {
    assert.deepEqual(p.waiting(), ["poll"], e.name + ": the reply is not followed");
    await p.answer("poll", then);
  }
  return { p, during, last: p.msgs().pop() };
}
for (const e of ENDINGS) {
  test("parity — " + e.name + ": held then written ends where the written reply on the first answer does, and held then failed where the failed one does" + (e.told ? "" : ", said at once with no follow"), async () => {
    const R = "The written reply for " + e.name + ".";
    const A = await endWith(e, written(e.body, R));
    const C = await endWith(e, failed(e.body));
    if (!e.told) {
      // SAID AT ONCE: no place held, no follow, and the same words as ever.
      const B = await endWith(e, pending(e.body, e.outcome));
      assert.deepEqual(B.p.waiting(), [], e.name + " held its place for a reply its reader never tells");
      assert.equal(B.last.held, undefined);
      assert.deepEqual(B.last, C.last);
      assert.deepEqual(A.last, C.last, e.name + "'s reader started telling a written reply: the guard's list is out of date");
      return;
    }
    const B = await endWith(e, pending(e.body, e.outcome), written(e.body, R));
    const D = await endWith(e, pending(e.body, e.outcome), failed(e.body));
    // WHILE HELD: the line for what the job did, the card already drawn when it asked.
    const heldMsg = B.during[B.during.length - 1];
    assert.equal(heldMsg.t, P.pendingReplyLine({ ...e.body, replyOutcome: e.outcome }));
    assert.equal(heldMsg.held.job, "job-e");
    assert.equal(heldMsg.ask, A.last.ask, "the question's card waited for the reply");
    if (e.body.ok !== true) assert.ok(!B.during.some((m) => /Done/.test(m.t)), e.name + " said Done while its explanation was written");
    assert.deepEqual(B.last, A.last, e.name + ": the written reply settled somewhere else than it would have been");
    assert.deepEqual(D.last, C.last, e.name + ": a failed reply settled somewhere else than the page's own sentence");
    // AND THE OUTCOME WAS APPLIED ONCE, the same as on the direct path.
    assert.equal(B.p.s.previewV, A.p.s.previewV);
    assert.equal(D.p.s.previewV, C.p.s.previewV);
  });
}

test("an edit under review is said at once, with no place held, and the site is held from further edits", async () => {
  const p = page({ answers: { route: [routeTo("look")], edit: [receipt("job-v")], poll: [pending(REVIEW, "not-done")] } });
  await p.send(M1);
  assert.equal(p.msgs().length, 1);
  assert.equal(p.msgs()[0].held, undefined);
  assert.doesNotMatch(p.said()[0], /writing up/);
  assert.deepEqual(p.blocked(), ["fretwork-1"]);
  assert.deepEqual(p.waiting(), []);
});

// ── DUPLICATE POLLS, RENDERS AND RELOADS ───────────────────────────────────

test("duplicate looks never follow one reply twice, never re-apply the outcome, and never add a message: renders, the resume and a second follow all find the one follower", async () => {
  const p = page({ answers: { route: [routeTo("look")], edit: [receipt("job-1")], poll: [pending(LOOKED, "done")] } });
  await p.send(M1);
  const polls = p.polls();
  // EVERY RENDER RESUMES: the held reply's follow, and the job's own watch.
  for (let i = 0; i < 3; i++) {
    p.ctx.siteHeldRepliesCheck(p.s);
    assert.equal(p.ctx.resumeOpenSite(p.s), false, "the finished job was watched again");
    p.ctx.editReplyFollow(p.s.id, "job-1");
  }
  await settle();
  assert.deepEqual(p.waiting(), ["poll"], "a second follower is looking");
  assert.equal(p.polls(), polls);
  assert.deepEqual(p.following(), ["origin-1|job-1"]);
  await p.answer("poll", written(LOOKED, R1));
  assert.deepEqual(p.msgs(), [{ r: "a", t: R1 }]);
  assert.equal(p.s.previewV, 1);
  // AFTER IT: nothing held, so nothing is followed, however often it is asked.
  p.ctx.siteHeldRepliesCheck(p.s);
  p.ctx.editReplyFollow(p.s.id, "job-1");
  await settle();
  assert.deepEqual(p.waiting(), []);
  assert.deepEqual(p.msgs(), [{ r: "a", t: R1 }]);
});

test("a held message is settled once: a settle after it, a malformed mark and a message with none are left as they are", () => {
  const m = P.holdReply("✅ Updated the look.", "job-1", "Done — writing up what changed…", 1000);
  assert.deepEqual(m, { t: "Done — writing up what changed…", held: { job: "job-1", at: 1000, else: "✅ Updated the look.", asked: "" } });
  assert.equal(P.settleHeld(m, R1), true);
  assert.deepEqual(m, { t: R1 });
  assert.equal(P.settleHeld(m, "a second reply"), false);
  assert.deepEqual(m, { t: R1 });
  // THE PAGE'S OWN SENTENCE when there is no reply; THE QUESTION'S WORDS stay under a reply.
  const q = P.holdReply({ t: "✅ Updated the look.\nWhich footer?", q: "Which footer?", opts: ["Main"], ask: QID, asked: "Which footer?" }, "job-2", "Partly done — …", 5);
  assert.deepEqual(q, { t: "Partly done — …", q: "Which footer?", opts: ["Main"], ask: QID, held: { job: "job-2", at: 5, else: "✅ Updated the look.\nWhich footer?", asked: "Which footer?" } });
  const q2 = copy(q);
  P.settleHeld(q, "I made the footer navy.  ");
  assert.equal(q.t, "I made the footer navy.\nWhich footer?");
  P.settleHeld(q2, null);
  assert.equal(q2.t, "✅ Updated the look.\nWhich footer?");
  // A MARK THAT DOES NOT READ IS NO MARK.
  for (const held of [null, "job-1", [], { job: "", else: "x" }, { job: 7, else: "x" }, { job: "j", else: 3 }, { job: "j".repeat(101), else: "x" }]) {
    const x = { t: "kept", held };
    assert.equal(P.heldOf(x), null, JSON.stringify(held));
    assert.equal(P.settleHeld(x, "reply"), false);
    assert.equal(x.t, "kept");
  }
});

test("a reload while the reply is still being written: the new page applies nothing again, follows the held reply from the message, and settles it once", async () => {
  const a = page({ answers: { route: [routeTo("look")], edit: [receipt("job-1")], poll: [pending(LOOKED, "done")] } });
  await a.send(M1);
  assert.equal(a.s.previewV, 1);
  // THE TAB IS RELOADED: the site as `sitesSave` kept it, the browser's storage as it was.
  const b = page({ site: copy(a.s), store: a.store });
  assert.equal(b.ctx.resumeOpenSite(b.s), false, "the reload watched the finished job again");
  b.ctx.siteHeldRepliesCheck(b.s);
  await settle();
  assert.deepEqual(b.waiting(), ["poll"]);
  await b.answer("poll", written(LOOKED, R1));
  assert.deepEqual(b.msgs(), [{ r: "a", t: R1 }]);
  assert.equal(b.s.previewV, 1, "the reload applied the outcome again");
  assert.equal(b.busy(), false);
  // AND A RELOAD AFTER IT: nothing to follow.
  const c = page({ site: copy(b.s), store: b.store });
  c.ctx.siteHeldRepliesCheck(c.s);
  assert.equal(c.ctx.resumeOpenSite(c.s), false);
  await settle();
  assert.deepEqual(c.waiting(), []);
  assert.deepEqual(c.msgs(), [{ r: "a", t: R1 }]);
});

test("a reload BEFORE the job ended: the resumed watch applies the outcome once when it arrives, and holds the reply's place there", async () => {
  const a = page({ answers: { route: [routeTo("look")], edit: [receipt("job-1")] } });
  await a.send(M1);
  assert.deepEqual(a.waiting(), ["poll"], "the job is not being watched");
  // RELOADED while the job runs.
  const b = page({ site: copy(a.s), store: a.store, answers: { poll: [pending(LOOKED, "done")] } });
  assert.equal(b.ctx.resumeOpenSite(b.s), true);
  await settle();
  assert.equal(b.s.previewV, 1);
  assert.equal(b.said()[0], "Done — writing up what changed…");
  b.ctx.siteHeldRepliesCheck(b.s);
  await b.answer("poll", written(LOOKED, R1));
  assert.deepEqual(b.msgs(), [{ r: "a", t: R1 }]);
  assert.equal(b.s.previewV, 1);
});

// ── A REPLY THAT NEVER COMES ───────────────────────────────────────────────

test("a reply that never comes: the page keeps looking until the server's last try is past, then says its own sentence for the outcome — and a job gone says it at once", async () => {
  // THE WINDOW IS PAST THE SERVER'S: its horizon, a try's own deadline and the sweep's grace.
  assert.ok(P.REPLY_WATCH_MS >= REPLY_HORIZON_MS + REPLY_BG_DEADLINE_MS + REPLY_RETRY_GRACE_MS, "the page stops looking before the server's last try");
  const clock = { now: Date.UTC(2026, 9, 4, 12) };
  const p = page({ clock, answers: { route: [routeTo("look")], edit: [receipt("job-1")], poll: [pending(LOOKED, "done")] } });
  await p.send(M1);
  assert.equal(p.s.msgs[1].held.at, clock.now);
  clock.now += P.REPLY_WATCH_MS - 1000;
  await p.answer("poll", pending(LOOKED, "done"));
  assert.equal(p.said()[0], "Done — writing up what changed…", "the page gave up inside the window");
  clock.now += 2000;
  await p.answer("poll", pending(LOOKED, "done"));
  assert.deepEqual(p.msgs(), [{ r: "a", t: LOOK }]);
  assert.deepEqual(p.waiting(), []);
  // GONE: the job can no longer be read, and the page's own sentence is said.
  const g = page({ answers: { route: [routeTo("look")], edit: [receipt("job-g")], poll: [pending(LOOKED, "done")] } });
  await g.send(M1);
  await g.answer("poll", { status: 404, body: json({ error: "not found" }) });
  assert.deepEqual(g.msgs(), [{ r: "a", t: LOOK }]);
  assert.deepEqual(g.waiting(), []);
});

test("a poll that fails while the reply is written is looked at again, and is not taken as the reply failing", async () => {
  const p = page({ answers: { route: [routeTo("look")], edit: [receipt("job-1")], poll: [pending(LOOKED, "done")] } });
  await p.send(M1);
  await p.answer("poll", { status: 503, body: json({ ok: false, error: "could not read the job" }) });
  await p.answer("poll", { reject: new Error("connection reset") });
  assert.equal(p.said()[0], "Done — writing up what changed…");
  await p.answer("poll", written(LOOKED, R1));
  assert.deepEqual(p.msgs(), [{ r: "a", t: R1 }]);
});

// ── THE THREAD DRAWS THE HELD LINE AS A LINE BEING WRITTEN ────────────────

test("the thread draws a held message as the live steps' waiting line, with a question's words under it, and a settled one as words", () => {
  const p = page();
  const link = (x) => p.ctx.esc(x);
  const heldMsg = { r: "a", ...P.holdReply({ t: "x\nWhich footer?", q: "Which footer?", opts: ["Main"], ask: QID, asked: "Which footer?" }, "job-1", "A question first — writing it up…", 1) };
  assert.equal(p.ctx.siteMsgText(heldMsg, link), '<div class="st-think"><i></i>A question first — writing it up…</div><div>Which footer?</div>');
  assert.equal(p.ctx.siteMsgText({ r: "a", t: "Done <b>" }, link), "Done &lt;b&gt;");
  // THE RENDER ASKS IT, for every assistant message.
  assert.match(CHAT, /'<div class="st-msg a">' \+ \(m\.note \? [^\n]*\) \+ siteMsgText\(m, linkify\) \+/);
});
