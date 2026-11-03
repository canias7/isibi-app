// THE PREVIEW'S READINESS FROM POSITIVE EVIDENCE, AND A PAGE THAT KEEPS
// FOLLOWING IT (2026-10-16, Codex's review of `44676fcd`).
//
// Codex reproduced two defects. (1) A save whose preview claim was refused
// uploaded nothing and said so (`previewed.ok: false`), yet `GET /draft` said
// `previewReady: true` because the claim list was empty. (2) The page stopped
// following after twenty reads fifteen seconds apart, and at the first failed
// read; the server turned ready at minute 16 and the page stayed "updating"
// with no timer.
//   DPS1 a refused claim: the save reports no preview; the draft's state says
//        pending (not ready); the owner's read starts a repair under its own
//        claim, after which the preview serves the selected version and the
//        state is ready — positive evidence recorded for that version
//   DPS2 unknown when the evidence cannot be read; pending while a claim
//        stands; failed when the tick has given up; the record only moves
//        forward
//   DPS3 the tick's repair records what it confirmed, before claims go
//   DPF1 late recovery: the page follows past minute 16, on a backoff that
//        never exceeds two minutes, and moves the frame once it is ready —
//        then stops
//   DPF2 temporary read failures do not end the following
//   DPF3 unknown readiness is followed
//   DPF4 successive revisions: each moves the frame and starts the backoff
//        over, without a reload
//   DPF5 cleanup: switching sites, closing the workspace, hiding the tab and
//        leaving the page each stop the timer; coming back reads again
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { DRAFT_KEY, PREVIEW_UP_KEY, PREVIEW_STATE_KEY, PREVIEW_CLAIMS_PREFIX, PREVIEW_LAND_MS, readPreviewUp, markPreviewUp, previewReadiness } from "../site-draft.mjs";

blockNetwork();
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));

// ── THE SERVER ───────────────────────────────────────────────────────────────
function site(name) {
  const compiler = installCompiler();
  let n = 0;
  const P = platform({
    slug: "dps-" + name + "-" + Math.random().toString(16).slice(2, 8), liveScripts: true,
    answers: { route: () => ({ intent: "edit", layer: "look" }), [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: "Change the site description" }] }, "lane:description": () => "Words " + (++n) + "." },
  });
  P.env.DRAFT_FIRST = "on";
  return { P, compiler };
}
const draftOf = (P) => JSON.parse(bare(P.readObj(DRAFT_KEY(P.slug))));
async function edit(P) {
  const r = await sendMessage(P, { message: "Change the site description." });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  const j = P.jobsOf(r.key).find((x) => x.op === "edit");
  return j && j.result ? JSON.parse(j.result.body) : null;
}
const draftRead = async (P) => (await call(P, "GET", "/api/site/" + P.slug + "/draft")).body;

// ── THE PAGE ─────────────────────────────────────────────────────────────────
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const close = CHAT.slice(open + 1).search(/\n\}[;]?\n/);
  assert.ok(close > 0, head + " has no end in chat.js");
  return CHAT.slice(open + 1, open + 1 + close + 3);
}
const line = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at + 1, CHAT.indexOf("\n", at + 1) + 1); };
const SLUG = "fold-lane-bakery";
const PREVIEW = "https://" + SLUG + "--draft-0123456789ab.gofarther.app/";
/**
 * The page's own draft functions in a VM, with a virtual clock and its timers,
 * a scripted `GET /draft`, and the document's visibility and listeners.
 */
function page(answers) {
  let now = 0;
  const timers = new Map();
  let id = 0;
  const listeners = { document: {}, window: {} };
  const ctx = {
    console, globalThis: { draftFirstOn: true }, siteDraftState: {}, siteDraftAt: {}, siteOpenId: "s1", reads: 0, renders: 0,
    document: { visibilityState: "visible", addEventListener: (t, fn) => { listeners.document[t] = fn; } },
    window: { addEventListener: (t, fn) => { listeners.window[t] = fn; } },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, at: now + ms, ms }); return id; },
    clearTimeout: (t) => { timers.delete(t); },
    paintDraftChip: () => {}, sitesSave: () => {},
    sites: { s1: { id: "s1", slug: SLUG, url: "/s/" + SLUG + "/", previewV: 0 }, s2: { id: "s2", slug: "other-site", url: "/s/other-site/", previewV: 0 } },
  };
  ctx.renderSites = () => { ctx.renders++; };
  ctx.siteById = (i) => ctx.sites[i] || null;
  ctx.apiFetch = async (url) => {
    ctx.reads++;
    const a = answers(now, url, ctx.reads);
    if (a === "throw") throw new Error("network");
    if (typeof a === "number") return { ok: false, status: a, json: async () => ({ ok: false }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, enabled: true, ...a }) };
  };
  vm.createContext(ctx);
  vm.runInContext([
    "const document_ = document;",
    cut("async function loadDraftState(site) {"), cut("function siteDraftPreviewState(d) {"), cut("function siteDraftFrameKey(d) {"),
    line("const SITE_DRAFT_FOLLOW_MIN_MS ="), line("const SITE_DRAFT_FOLLOW_MAX_MS ="), line("const siteDraftFollows ="),
    cut("function siteDraftWatched(site) {"), cut("function siteDraftUnfollow(slug) {"), cut("function siteDraftFollowAgain(site, { reset = false, failed = false } = {}) {"),
    cut("function siteDraftUnsettled(d) {"), cut("function siteDraftFollow(site, d, was) {"),
    cut("if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {"),
    cut("if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {"),
    "this.api = { loadDraftState, siteDraftFollows };",
  ].join("\n"), ctx);
  /** Run the next timer, moving the clock to it; false when none is set. */
  const next = async () => {
    const [k, t] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0] || [];
    if (!k) return false;
    timers.delete(k);
    now = t.at;
    t.fn();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    return t;
  };
  return { ctx, api: ctx.api, timers, next, listeners, clock: () => now, setNow: (t) => { now = t; } };
}
const pending = (rev = 4, extra = {}) => ({ unpublished: true, preview: PREVIEW, revision: rev, previewState: "pending", previewReady: false, state: "saved", ...extra });
const ready = (rev = 4) => pending(rev, { previewState: "ready", previewReady: true });

test("DPF1 LATE RECOVERY — the server turns ready at minute 16: the page is still following then, on a backoff that never exceeds two minutes, moves the frame once, and stops", async () => {
  const p = page((now) => (now < 16 * 60 * 1000 ? pending() : ready()));
  const s = p.ctx.sites.s1;
  await p.api.loadDraftState(s);
  const delays = [], at = [];
  let t;
  while ((t = await p.next())) { delays.push(t.ms); at.push(p.clock()); if (delays.length > 200) break; }
  assert.ok(p.clock() >= 16 * 60 * 1000, "the following ended before the server was ready, at " + p.clock() + " ms");
  // THE OLD PAGE STOPPED AFTER 20 READS 15 s APART (five minutes): this one is still reading after that, and at minute 16.
  assert.ok(at.some((x) => x > 5 * 60 * 1000 && x < 16 * 60 * 1000), "no read between the old cutoff and the recovery: " + at);
  assert.ok(delays.every((ms) => ms >= 5000 && ms <= 120000), "a wait outside 5 s – 2 min: " + delays);
  assert.deepEqual(delays.slice(0, 6), [5000, 10000, 20000, 40000, 80000, 120000], "not a backoff");
  assert.equal(p.ctx.siteDraftState[SLUG].previewState, "ready");
  assert.equal(p.timers.size, 0, "a timer was left after the preview was ready");
  assert.ok(s.previewV >= 2, "the frame did not move when the preview turned ready");
});

test("DPF2 TEMPORARY READ FAILURES — a 503, a thrown fetch and an unreadable body in a row do not end the following; it goes on to ready", async () => {
  const p = page((now, url, n) => (n === 1 ? pending() : n === 2 ? 503 : n === 3 ? "throw" : n === 4 ? 500 : n < 7 ? pending() : ready()));
  await p.api.loadDraftState(p.ctx.sites.s1);
  let t, guard = 0;
  while ((t = await p.next()) && guard++ < 50);
  assert.equal(p.ctx.reads, 7, "the following stopped at a failed read, or ran on: " + p.ctx.reads);
  assert.equal(p.ctx.siteDraftState[SLUG].previewState, "ready");
  assert.equal(p.timers.size, 0);
  // A FAILED FIRST READ, with draft-first known on, is followed too.
  const q = page((now, url, n) => (n === 1 ? 503 : ready()));
  await q.api.loadDraftState(q.ctx.sites.s1);
  assert.equal(q.timers.size, 1, "a failed first read was not tried again");
  await q.next();
  assert.equal(q.ctx.reads, 2);
  assert.equal(q.timers.size, 0);
  // WITHOUT DRAFT-FIRST, A FAILED READ IS NOT FOLLOWED (nothing to wait for).
  const r = page(() => 503);
  r.ctx.globalThis.draftFirstOn = false;
  await r.api.loadDraftState(r.ctx.sites.s1);
  assert.equal(r.timers.size, 0);
});

test("DPF3 UNKNOWN READINESS IS FOLLOWED — the server could not read its evidence; the page keeps asking, and a server from before `previewState` (only `previewReady: null`) is read as unknown too", async () => {
  const p = page((now, url, n) => (n < 4 ? pending(4, { previewState: "unknown", previewReady: null }) : n < 6 ? { unpublished: true, preview: PREVIEW, revision: 4, previewReady: null, state: "saved" } : ready()));
  await p.api.loadDraftState(p.ctx.sites.s1);
  let guard = 0;
  while ((await p.next()) && guard++ < 50);
  assert.equal(p.ctx.reads, 6);
  assert.equal(p.timers.size, 0);
  // FAILED (the tick gave up) is followed as well, at the backoff's pace: a new save can unstick it.
  const f = page((now, url, n) => (n < 3 ? pending(4, { previewState: "failed" }) : ready()));
  await f.api.loadDraftState(f.ctx.sites.s1);
  while (await f.next());
  assert.equal(f.ctx.reads, 3);
});

test("DPF4 SUCCESSIVE REVISIONS WITHOUT A RELOAD — revision 4 pending, then 5 pending, then 5 ready: each change moves the frame and starts the backoff over", async () => {
  const p = page((now, url, n) => (n <= 4 ? pending(4) : n <= 6 ? pending(5) : ready(5)));
  const s = p.ctx.sites.s1;
  await p.api.loadDraftState(s);
  const seen = [];
  let t;
  while ((t = await p.next())) seen.push([t.ms, p.ctx.siteDraftState[SLUG].revision, p.ctx.siteDraftState[SLUG].previewState]);
  assert.deepEqual(seen.map((x) => x[0]), [5000, 10000, 20000, 40000, 5000, 10000], "the backoff did not start over for the new revision");
  assert.equal(s.previewV, 3, "the frame did not move once for each change (first draft, revision 5, ready)");
  assert.equal(p.timers.size, 0);
});

test("DPF5 CLEANUP — switching sites, closing the workspace, hiding the tab and leaving the page each stop the following; coming back reads again", async () => {
  // SWITCHING SITES: the timer that fires finds the site no longer watched.
  const a = page(() => pending());
  await a.api.loadDraftState(a.ctx.sites.s1);
  assert.equal(a.timers.size, 1);
  a.ctx.siteOpenId = "s2";
  await a.next();
  assert.equal(a.ctx.reads, 1, "a site no longer open was read again");
  assert.equal(a.timers.size, 0);
  assert.equal(Object.keys(a.api.siteDraftFollows).length, 0);
  // …AND OPENING THE OTHER SITE LETS GO AT ONCE.
  const b = page((now, url) => (url.includes("other-site") ? ready() : pending()));
  await b.api.loadDraftState(b.ctx.sites.s1);
  b.ctx.siteOpenId = "s2";
  await b.api.loadDraftState(b.ctx.sites.s2);
  assert.equal(b.timers.size, 0, "the first site's timer outlived the switch");
  // CLOSING THE WORKSPACE.
  const c = page(() => pending());
  await c.api.loadDraftState(c.ctx.sites.s1);
  c.ctx.siteOpenId = null;
  await c.next();
  assert.equal(c.ctx.reads, 1);
  assert.equal(c.timers.size, 0);
  // HIDING THE TAB clears the timer at once; showing it reads again.
  const d = page((now, url, n) => (n < 3 ? pending() : ready()));
  await d.api.loadDraftState(d.ctx.sites.s1);
  d.ctx.document.visibilityState = "hidden";
  d.listeners.document.visibilitychange();
  assert.equal(d.timers.size, 0, "a hidden tab kept its timer");
  d.ctx.document.visibilityState = "visible";
  d.listeners.document.visibilitychange();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(d.ctx.reads, 2, "coming back did not read the draft again");
  while (await d.next());
  assert.equal(d.ctx.siteDraftState[SLUG].previewState, "ready");
  // LEAVING THE PAGE.
  const e = page(() => pending());
  await e.api.loadDraftState(e.ctx.sites.s1);
  e.listeners.window.pagehide();
  assert.equal(e.timers.size, 0, "leaving the page kept a timer");
  // NOTHING TO WAIT FOR (published): no timer at all.
  const f = page(() => ({ unpublished: false, preview: PREVIEW, revision: 4, state: "published", previewState: "ready" }));
  await f.api.loadDraftState(f.ctx.sites.s1);
  assert.equal(f.timers.size, 0);
});

test("DPF6 NO COUNT ENDS IT — two hours pending while watched: still followed, every wait at most two minutes", async () => {
  const p = page(() => pending());
  await p.api.loadDraftState(p.ctx.sites.s1);
  let t;
  while (p.clock() < 2 * 3600 * 1000 && (t = await p.next())) assert.ok(t.ms <= 120000);
  assert.ok(p.clock() >= 2 * 3600 * 1000, "the following stopped at " + p.clock());
  assert.equal(p.timers.size, 1, "no timer while the preview is still pending");
});
