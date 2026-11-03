// PARKED (2026-11-03, park-old-way): the old-way half of test/draft-preview-follow.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { DRAFT_KEY, PREVIEW_UP_KEY, PREVIEW_STATE_KEY, PREVIEW_CLAIMS_PREFIX, PREVIEW_LAND_MS, readPreviewUp, markPreviewUp, previewReadiness } from "../../../site-draft.mjs";

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

test("DPS1 A REFUSED CLAIM — the save says no preview went up; the draft's state is pending, never ready; the owner's read repairs it under its own claim, and then the selected version serves and the state is ready", async () => {
  const { P, compiler } = site("dps1");
  try {
    const a = await edit(P);
    assert.equal(a.draft.previewUploaded, true, "the first save's preview did not go up: " + JSON.stringify(a.draft));
    const first = await draftRead(P);
    assert.deepEqual([first.previewState, first.previewReady], ["ready", true], JSON.stringify(first).slice(0, 300));
    const served0 = P.previewScript();
    // THE NEXT SAVE'S CLAIM IS REFUSED: nothing is uploaded for it.
    P.failPut((k) => k.startsWith(PREVIEW_CLAIMS_PREFIX(P.slug)));
    const b = await edit(P);
    assert.deepEqual([b.draft.previewUploaded, b.draft.previewPending], [false, true], "the save did not report its preview as not up: " + JSON.stringify(b.draft));
    assert.equal(P.previewScript(), served0, "something was uploaded without a claim");
    const v2 = draftOf(P).version;
    assert.notEqual(v2, served0);
    assert.equal((await readPreviewUp({ get: (k) => P.run(() => P.bucket.get(k)) }, P.slug)).version, served0);
    // THE OWNER'S READ: pending — and it starts the repair, after its answer.
    const s1 = await draftRead(P);
    assert.deepEqual([s1.previewState, s1.previewReady], ["pending", false], "an empty claim list was read as a ready preview");
    // THE REPAIR RAN (the read's background work is awaited by the call).
    assert.equal(P.previewScript(), v2, "the repair did not put the selected version up");
    const s2 = await draftRead(P);
    assert.deepEqual([s2.previewState, s2.previewReady], ["ready", true]);
    assert.equal((await readPreviewUp({ get: (k) => P.run(() => P.bucket.get(k)) }, P.slug)).version, v2, "readiness without its positive evidence");
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

test("DPS2 THE STATES — unknown when the evidence cannot be read; pending while a claim stands; failed when the tick has given up; and the record of what serves only moves forward", async () => {
  const V1 = "01790000000001-aaaaaa", V2 = "01790000000002-bbbbbb";
  const draft = { version: V2, preview: "0123456789ab" };
  assert.equal(previewReadiness(draft, { up: { version: V2 }, claims: [] }), "ready");
  assert.equal(previewReadiness(draft, { up: { version: V1 }, claims: [] }), "pending", "an older confirmation read as ready");
  assert.equal(previewReadiness(draft, { up: null, claims: [] }), "pending", "no confirmation at all read as ready");
  assert.equal(previewReadiness(draft, { up: { version: V2 }, claims: [{ key: "k", at: 1 }] }), "pending", "a standing claim read as ready");
  assert.equal(previewReadiness(draft, { up: new Error("r2"), claims: [] }), "unknown");
  assert.equal(previewReadiness(draft, { up: { version: V2 }, claims: new Error("r2") }), "unknown");
  assert.equal(previewReadiness(draft, { up: { version: V1 }, claims: [], register: { state: "stuck" } }), "failed");
  assert.equal(previewReadiness({ version: V2, preview: "" }, { up: null, claims: [] }), null, "a draft with no preview has a preview state");
  // FORWARD ONLY: an older confirmation arriving late never replaces a newer one.
  const m = new Map(); let e = 0;
  const deps = { get: async (k) => (m.has(k) ? { etag: m.get(k).etag, text: async () => m.get(k).body } : null), put: async (k, body, _c, c) => { const cur = m.get(k); if (c && c.etagDoesNotMatch === "*" && cur) return null; if (c && c.etagMatches && (!cur || cur.etag !== c.etagMatches)) return null; m.set(k, { body, etag: "e" + (++e) }); return {}; } };
  assert.equal(await markPreviewUp(deps, "s", V2), true);
  assert.equal(await markPreviewUp(deps, "s", V1), true);
  assert.equal((await readPreviewUp(deps, "s")).version, V2, "an older confirmation overwrote a newer one");
  assert.equal(await markPreviewUp(deps, "s", "not-a-version"), false);
  // THROUGH THE ROUTE: unknown, then failed.
  const { P, compiler } = site("dps2");
  try {
    await edit(P);
    P.failGet((k) => k === PREVIEW_UP_KEY(P.slug));
    const u = await draftRead(P);
    assert.deepEqual([u.previewState, u.previewReady], ["unknown", null], "unreadable evidence was read as an answer");
    // A SAVE WHOSE PREVIEW THE TICK GAVE UP ON.
    await P.run(() => P.bucket.put(PREVIEW_UP_KEY(P.slug), JSON.stringify({ v: 1, version: "01700000000000-aaaaaa", at: 1 })));
    await P.run(() => P.bucket.put(PREVIEW_STATE_KEY(P.slug), JSON.stringify({ v: 1, state: "stuck", tries: 12, at: Date.now() })));
    const f = await draftRead(P);
    assert.deepEqual([f.previewState, f.previewReady], ["failed", false]);
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

test("DPS3 THE TICK RECORDS WHAT IT CONFIRMED — a save stopped with its claim standing; once the claim can no longer land, the tick puts the selected version up, records it, and only then drops the claims", async () => {
  const { P, compiler } = site("dps3");
  const { runPreviewRecovery } = await loadWorkerModule();
  try {
    await edit(P);
    // A STANDING CLAIM AND A STALE RECORD: what a save stopped mid-upload leaves.
    const v = draftOf(P).version;
    await P.run(() => P.bucket.put(PREVIEW_UP_KEY(P.slug), JSON.stringify({ v: 1, version: "01700000000000-aaaaaa", at: 1 })));
    const key = PREVIEW_CLAIMS_PREFIX(P.slug) + String(Date.now() - PREVIEW_LAND_MS - 60000).padStart(13, "0") + "-abcdef.json";
    await P.run(() => P.bucket.put(key, JSON.stringify({ v: 1 })));
    assert.equal((await draftRead(P)).previewState, "pending");
    // THE RECORD WRITE FAILS ONCE: the claims stay, nothing is called ready.
    for (let i = 0; i < 4; i++) P.failPut((k) => k === PREVIEW_UP_KEY(P.slug));
    const r1 = await P.run(() => runPreviewRecovery(P.env, { now: Date.now() }));
    assert.equal(r1.ready, 0, "readiness without its record");
    assert.ok(P.readObj(key) !== null, "the claims went before the confirmation was recorded");
    // NEXT ROUND: recorded, then the claims go.
    // ITS OWN CLAIM STAYS (nothing confirmed); past the window in which it could still land:
    P.advance(PREVIEW_LAND_MS + 60 * 1000);
    const r2 = await P.run(() => runPreviewRecovery(P.env, { now: Date.now() }));
    assert.equal(r2.ready, 1, JSON.stringify(r2));
    assert.equal((await readPreviewUp({ get: (k) => P.run(() => P.bucket.get(k)) }, P.slug)).version, v);
    assert.equal(P.readObj(key), null);
    assert.equal((await draftRead(P)).previewState, "ready");
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
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
