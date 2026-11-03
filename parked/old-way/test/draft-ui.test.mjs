// PARKED (2026-11-03, park-old-way): the old-way half of test/draft-ui.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { writtenPage } from "../../../test/fixtures/addon-route.mjs";
import { requestView } from "../../../builder/request.mjs";
import { DRAFT_KEY, PREVIEW_CLAIMS_PREFIX } from "../../../site-draft.mjs";

blockNetwork();

const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const EditPoll = createRequire(import.meta.url)("../../../public/edit-poll.js");
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
