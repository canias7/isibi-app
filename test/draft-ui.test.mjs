// THE FRONTEND BATCH'S CONNECTIONS, ON CI (2026-10-16).
//
// `test/draft-ui-browser.test.mjs` runs the page against the real Worker in
// Chromium, where one is installed; unit CI has none. These cases run the
// same pieces there: the client's own functions cut from public/chat.js and
// run in a VM, and the server fields they read, from the real Worker.
//   DUI1 the frame's address: the draft's preview host while draft-first is on
//        and the draft is ahead of live, the live address otherwise — never a
//        guessed or foreign host
//   DUI2 what moves the frame: a newer draft, its preview turning ready, or a
//        publication that leaves nothing unpublished
//   DUI3 the request card's labels: the part a held part waits for, a part
//        not run for a part that broke, a lost rewrite being recovered, a
//        part saved as a draft (and its preview still updating); the
//        server's own line still names each part
//   DUI4 the request view carries `needs` and `draft` from the record (the
//        real request driver: one part waiting on another, both saved as a
//        draft under draft-first)
//   DUI5 `GET /draft` says the preview is ready only when no writer's claim
//        stands, and cannot-tell when the claims cannot be read
//   DUI6 a cancelled media upload is said as cancelled, nothing kept
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { requestView } from "../builder/request.mjs";
import { DRAFT_KEY, PREVIEW_CLAIMS_PREFIX } from "../site-draft.mjs";

blockNetwork();

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
/** A top-level declaration, from its first line to the first `}` (or `};`) at column 0. */
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const close = CHAT.slice(open + 1).search(/\n\}[;]?\n/);
  assert.ok(close > 0, head + " has no end in chat.js");
  return CHAT.slice(open + 1, open + 1 + close + 3);
}
function cutLine(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open + 1, CHAT.indexOf("\n", open + 1) + 1);
}
/** The client's frame and card functions, in a VM with the state they read. */
function client() {
  const ctx = { EditPoll, globalThis: {}, console, siteDraftState: {}, siteOpenId: null, renders: 0, saves: 0, loads: [], timers: [], document: { visibilityState: "visible" } };
  ctx.clearTimeout = () => {};
  ctx.renderSites = () => { ctx.renders++; };
  ctx.sitesSave = () => { ctx.saves++; };
  ctx.loadDraftState = (s) => { ctx.loads.push(s.slug); };
  ctx.setTimeout = (fn, ms) => { ctx.timers.push({ fn, ms }); return ctx.timers.length; };
  vm.createContext(ctx);
  const src = [
    cut("function esc(s) {"),
    cut("function sitePreviewSrc(site, path) {"),
    cutLine("const SITE_DRAFT_HOST ="),
    cut("function siteDraftFrame(site) {"),
    cut("function siteDraftPreviewState(d) {"), cut("function siteDraftFrameKey(d) {"),
    cutLine("const SITE_DRAFT_FOLLOW_MIN_MS ="), cutLine("const SITE_DRAFT_FOLLOW_MAX_MS ="), cutLine("const siteDraftFollows ="),
    cut("function siteDraftWatched(site) {"), cut("function siteDraftUnfollow(slug) {"), cut("function siteDraftFollowAgain(site, { reset = false, failed = false } = {}) {"),
    cut("function siteDraftUnsettled(d) {"),
    cut("function siteDraftFollow(site, d, was) {"),
    cut("const SITE_REQ_STATUS = {"), cut("const SITE_REQ_HELD = {"), cut("const SITE_REQ_HELD_ADDED = {"),
    cut("const SITE_REQ_PREP = {"), cut("const SITE_REQ_LEFT = {"), cut("const SITE_SAID_FOR = {"),
    cut("function siteSaidFor(said, which) {"),
    "function progressListHTML() { return ''; }",
    cut("function siteRequestHTML(m, site) {"),
    cut("const siteMediaRefused ="),
    "this.api = { sitePreviewSrc, siteDraftFrame, siteDraftFrameKey, siteDraftFollow, siteRequestHTML, siteMediaRefused, siteDraftFollows };",
  ].join("\n");
  vm.runInContext(src, ctx);
  return ctx;
}
const SLUG = "fold-lane-bakery";
const PREVIEW = "https://" + SLUG + "--draft-0123456789ab.gofarther.app/";
const site = (over = {}) => ({ id: "s1", slug: SLUG, url: "/s/" + SLUG + "/", previewV: 3, ...over });
const ahead = (over = {}) => ({ enabled: true, unpublished: true, preview: PREVIEW, revision: 4, previewReady: true, ...over });

test("DUI1 THE FRAME'S ADDRESS — the draft's preview host while draft-first is on and the draft is ahead; the live address otherwise, and for any reading that is not the platform's draft host", () => {
  const c = client();
  const { sitePreviewSrc } = c.api;
  assert.equal(sitePreviewSrc(site(), "/visit"), "/s/" + SLUG + "/visit?v=3", "no reading: the live address");
  c.siteDraftState[SLUG] = ahead();
  assert.equal(sitePreviewSrc(site(), "/visit"), PREVIEW + "visit?v=3");
  assert.equal(sitePreviewSrc(site(), "/"), PREVIEW + "?v=3");
  assert.equal(sitePreviewSrc(site(), null), PREVIEW + "?v=3", "a page not chosen yet is the home page, never `null`");
  for (const [why, d] of [
    ["draft-first off", ahead({ enabled: false })],
    ["nothing unpublished", ahead({ unpublished: false })],
    ["no preview", ahead({ preview: null })],
    ["a foreign host", ahead({ preview: "https://evil.example/" })],
    ["not the draft host", ahead({ preview: "https://" + SLUG + ".gofarther.app/" })],
    ["a short token", ahead({ preview: "https://" + SLUG + "--draft-0123.gofarther.app/" })],
    ["no trailing slash", ahead({ preview: PREVIEW.slice(0, -1) })],
    ["a coerced value", ahead({ preview: [PREVIEW] })],
    ["unpublished not true", ahead({ unpublished: "yes" })],
  ]) {
    c.siteDraftState[SLUG] = d;
    assert.equal(sitePreviewSrc(site(), "/visit"), "/s/" + SLUG + "/visit?v=3", why + " showed something other than the live address");
  }
});

test("DUI2 WHAT MOVES THE FRAME — a newer draft, its preview turning ready, and a publication leaving nothing unpublished each move it once; the same reading moves nothing; a preview still updating is read again while watched, and a ready one is let go", () => {
  const c = client();
  const { siteDraftFrameKey, siteDraftFollow } = c.api;
  const s = site();
  c.siteOpenId = "s1";
  const step = (d, was) => { const v = s.previewV; siteDraftFollow(s, d, was); return s.previewV - v; };
  assert.equal(siteDraftFrameKey(undefined), "live");
  assert.equal(step(ahead(), siteDraftFrameKey(undefined)), 1, "the first draft did not move the frame");
  assert.equal(c.renders, 1);
  assert.equal(step(ahead(), siteDraftFrameKey(ahead())), 0, "the same reading moved the frame");
  assert.equal(step(ahead({ revision: 5 }), siteDraftFrameKey(ahead())), 1, "a newer draft did not move it");
  assert.equal(step(ahead({ revision: 5, previewReady: true }), siteDraftFrameKey(ahead({ revision: 5, previewReady: false }))), 1, "the preview turning ready did not move it");
  assert.equal(step({ enabled: true, unpublished: false, preview: PREVIEW }, siteDraftFrameKey(ahead({ revision: 5 }))), 1, "a publication did not move it back");
  // STILL UPDATING, WATCHED: read again on the backoff (the whole following is DPF1–DPF6 in
  // `test/draft-preview-follow.test.mjs`); READY: nothing more is scheduled.
  c.timers.length = 0;
  step(ahead({ previewReady: false }), siteDraftFrameKey(ahead({ previewReady: false })));
  assert.deepEqual(c.timers.map((t) => t.ms), [5000], "an updating preview was not read again");
  c.timers[0].fn();
  assert.deepEqual(c.loads, [SLUG]);
  step(ahead({ previewReady: true }), siteDraftFrameKey(ahead({ previewReady: false })));
  assert.equal(Object.keys(c.api.siteDraftFollows).length, 0, "a ready preview is still followed");
});

test("DUI3 THE CARD'S LABELS FROM THE SERVER'S FIELDS — the part a held part waits for, a part not run for a part that broke, a lost rewrite being recovered, a part saved as a draft (its preview updating said too); each part still named by its own words", () => {
  const c = client();
  const parts = [
    { n: 0, words: "Change the description", status: "blocked", needs: [1] },
    { n: 1, words: "add a gallery page", status: "done", draft: { revision: 3, preview: "ready" } },
    { n: 2, words: "add a menu link", status: "not-run", why: "needs:3", needs: [3, 4] },
    { n: 3, words: "rewrite the site", status: "unverified", why: "rewrite-recovering" },
    { n: 4, words: "the price", status: "partial", draft: { revision: 4, preview: "pending" } },
    { n: 5, words: "the photo", status: "done" },
    { n: 6, words: "the button", status: "blocked" },
    { n: 7, words: "the hours", status: "done", draft: { revision: "3" } },
    { n: 8, words: "the footer", status: "blocked", needs: [1], prep: "preparing" },
  ];
  const html = c.api.siteRequestHTML({ request: "rq1" }, { requests: { rq1: { view: { parts, ended: false } } } });
  const labels = [...html.matchAll(/<span class="st-req-status">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, [
    "Waiting for part 2", "Saved as a draft", "Not run — part 4 and 5 did not finish", "Recovering an interrupted rewrite",
    "Partly done · saved as a draft · preview updating", "Done", "Waiting for another part", "Done", "Working on it alongside",
  ]);
  const words = [...html.matchAll(/<span class="st-req-words">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(words, parts.map((p) => p.words), "a label replaced a part's own words");
});

test("DUI4 THE REQUEST VIEW CARRIES `needs` AND `draft` FROM THE RECORD — one part waiting on another, then both saved as a draft under draft-first (the real request driver)", async () => {
  const compiler = installCompiler();
  const NEEDS = "Change the site description to mention our gallery page";
  const ADD = "add a gallery page";
  let descs = 0;
  const P = platform({
    slug: "dui4-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [{ intent: "edit", layer: "look" }, { intent: "edit", layer: "look", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }] }, { intent: "addon" }, { intent: "edit", layer: "look" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: NEEDS }] }, "lane:description": () => (descs++ ? "Sourdough, and a gallery of our loaves." : "Sourdough from the harbour."),
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "photos", sections: ["a band"], components: ["section-header"] }] }, [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  });
  try {
    const r0 = await sendMessage(P, { message: NEEDS + "." });
    await settle(P, r0.key, { rounds: 20 });
    // THE CONTROL: published, not saved as a draft — no part says draft.
    const v0 = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r0.key);
    assert.deepEqual(v0.body.request.parts.map((p) => [p.status, p.draft || null]), [["done", null]]);
    P.env.DRAFT_FIRST = "on";
    const r = await sendMessage(P, { message: NEEDS + ", and " + ADD + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = r.body.request.parts;
    assert.deepEqual([first[0].status, first[0].needs], ["blocked", [1]], "the waiting part does not say what it waits for: " + JSON.stringify(first[0]));
    assert.equal(first[1].needs, undefined, "a part that waits for nothing named a part");
    await settle(P, r.key, { rounds: 20 });
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(v.status, 200);
    const draft = JSON.parse(P.readObj(DRAFT_KEY(P.slug)).replace(/\n[ \t]+$/, ""));
    assert.deepEqual(v.body.request.parts.map((p) => p.status), ["done", "done"]);
    for (const p of v.body.request.parts) {
      assert.ok(p.draft && Number.isInteger(p.draft.revision) && p.draft.revision > 0 && p.draft.revision <= draft.rev, "a part saved as a draft does not say so: " + JSON.stringify(p));
      assert.ok(["ready", "pending", "unknown"].includes(p.draft.preview));
      assert.equal(p.needs, undefined, "a finished part still names what it waited for");
    }
  } finally {
    await P.settle();
    P.close(); compiler.uninstall();
  }
  // AND OFFLINE, THE VIEW'S RULES: `needs` only while held or not run; `draft` only once done or partly done.
  const rec = { key: "k", state: "running", parts: [
    { n: 0, words: "a", status: "blocked", needs: [1], jobs: [] },
    { n: 1, words: "b", status: "done", needs: [], jobs: [], outcome: { kind: "done", draft: { revision: 2, version: "v", preview: "pending" } } },
    { n: 2, words: "c", status: "started", needs: [1], jobs: [], outcome: { kind: "done", draft: { revision: 3, version: "v", preview: "ready" } } },
    { n: 3, words: "d", status: "not-run", why: "needs:1", needs: [1], jobs: [] },
    { n: 4, words: "e", status: "done", needs: [], jobs: [], outcome: { kind: "done", draft: { revision: 0 } } },
    { n: 5, words: "f", status: "done", needs: [], jobs: [], outcome: { kind: "done", draft: { revision: 5, preview: "maybe" } } },
  ] };
  const view = requestView(rec);
  assert.deepEqual(view.parts.map((p) => p.needs || null), [[1], null, null, [1], null, null]);
  assert.deepEqual(view.parts.map((p) => p.draft || null), [null, { revision: 2, preview: "pending" }, null, null, null, { revision: 5, preview: "unknown" }]);
});

test("DUI5 `GET /draft` SAYS THE PREVIEW IS READY ONLY WHEN NO WRITER'S CLAIM STANDS — false while one stands, null when the claims cannot be read", async () => {
  const compiler = installCompiler();
  const P = platform({ slug: "dui5-" + Math.random().toString(16).slice(2, 8), answers: { route: [{ intent: "edit", layer: "look" }], [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: "Change the site description" }] }, "lane:description": "New words." } });
  try {
    P.env.DRAFT_FIRST = "on";
    const r = await sendMessage(P, { message: "Change the site description." });
    await settle(P, r.key, { rounds: 20 });
    const read = async () => (await call(P, "GET", "/api/site/" + P.slug + "/draft")).body;
    const d0 = await read();
    assert.ok(typeof d0.preview === "string" && d0.preview.includes("--draft-"), JSON.stringify(d0).slice(0, 300));
    assert.equal(d0.previewReady, true, "a settled save's preview is not read as ready");
    // A CLAIM STANDS: an upload that may still land.
    const key = PREVIEW_CLAIMS_PREFIX(P.slug) + String(Date.now()).padStart(13, "0") + "-abcdef.json";
    await P.run(() => P.bucket.put(key, JSON.stringify({ v: 1, at: Date.now() })));
    assert.equal((await read()).previewReady, false, "a standing claim was read as ready");
    await P.run(() => P.bucket.delete(key));
    assert.equal((await read()).previewReady, true);
    // THE CLAIMS CANNOT BE READ: cannot-tell, never ready.
    const list = P.bucket.list;
    P.bucket.list = async (o) => { if (o && String(o.prefix || "").startsWith("preview-claims/")) throw new Error("r2 list failed"); return list.call(P.bucket, o); };
    try { assert.equal((await read()).previewReady, null, "unreadable claims were read as an answer"); }
    finally { P.bucket.list = list; }
  } finally {
    await P.settle();
    P.close(); compiler.uninstall();
  }
});

test("DUI6 A CANCELLED UPLOAD IS SAID AS CANCELLED, NOTHING KEPT; any other end keeps its own sentence", () => {
  const c = client();
  assert.equal(c.api.siteMediaRefused({ ok: false, code: "cancelled", error: "upload cancelled" }), "Upload cancelled — nothing was kept.");
  assert.equal(c.api.siteMediaRefused({ ok: false, code: "too_big", error: "that video is over 250 MB" }), "that video is over 250 MB");
  assert.equal(c.api.siteMediaRefused({ ok: false }), "That upload didn’t finish — try again.");
});
