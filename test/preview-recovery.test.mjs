// A DRAFT'S PREVIEW, RECOVERED (2026-10-16, Codex's reviews of `ea9a2b71` and
// `6d075aeb`).
//
// First review: a failed repair after an older upload landed was reported
// `{ ok: true }` and nothing came back to it. Second review — the case this
// file is now built around: an older save paused inside its upload, a newer
// save finished (upload and ready mark), the older upload landed and its
// process STOPPED FOR GOOD before running another line. The draft selected
// NEW, the preview served OLD, the one shared mark still said ready/up=NEW,
// and three ticks skipped it: zero repairs. One writer's success had erased
// another writer's obligation.
//
// Now every writer that may put a preview script up — a save or the tick —
// writes its OWN claim first (`preview-claims/<slug>/<at>-<rand>.json`),
// uploads nothing without one, and removes only its own, only once the
// selected version is confirmed up. A save is ready only when no other claim
// stands. The tick waits until every claim of a site can no longer land
// (`PREVIEW_LAND_MS`), then puts the selected version up under its own claim
// and clears what it read.
//
// The interruptions here are HARD STOPS: the writer's upload function lands
// its script and then never returns, so no catch, finally or cleanup of the
// save runs after the upload — the process is simply gone.
//
//   PR1  a failed repair: the save stands, the preview not ready (pending,
//        recoverable, the error said), the repair tried 3 times, its claim
//        left standing
//   PR2  a lost answer on the repair: confirmed by the next round (ready, no
//        claim left); lost every time, pending, its claim standing
//   PR3  the save's look at the draft fails after the stale upload: pending,
//        its claim standing
//   PR3b an older save that confirms while a newer save's claim stands is NOT
//        ready: another upload may still land over it
//   PR3c no claim, no upload: a save whose claim cannot be written saves its
//        draft and puts no script up at all
//   PR4  CODEX'S REPRODUCTION through the real Worker tick, with a hard stop:
//        the newer save is not reported ready while the older claim stands;
//        ticks while that claim could still land repair nothing (waiting);
//        the first tick after it can no longer land puts the selected version
//        up and clears every claim; a later tick does nothing; no model call,
//        no charge, nothing live
//   PR5  a save that stops for good between recording the draft and its
//        preview (and one that stops before the record): repaired by the tick
//   PR6  a newer draft saved while the tick is at work: the tick leaves the
//        newer version up; the newer save is not ready while the tick's claim
//        stands; nothing is left claimed
//   PR7  duplicate ticks at once: the selected version up, nothing left
//        claimed, the register ready
//   PR8  the bounded retry policy, explicit: a failing tick leaves its own
//        claim and waits (never before the claims can no longer land, and the
//        doubling backoff); `stuck` after PREVIEW_TRIES, then no more tries;
//        a newer save's claim unsticks it
//   PR9  storage permissions: a job may write its own site's claims and
//        register, no other site's; the flight bound is the dispatch call's
//   PR10 `draftFacts` says ready and pending apart from the save; the tick is
//        on the scheduled handler
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveAsDraft, readDraft, convergePreview, claimAt, DRAFT_KEY, PREVIEW_STATE_KEY, PREVIEW_TRIES, PREVIEW_LAND_MS, PREVIEW_FLIGHT_MS, PREVIEW_UPLOAD_WINDOW_MS, PREVIEW_CLAIMS_PREFIX, previewBackoff, claimPreview } from "../site-draft.mjs";
import { stageBuild, readBuild } from "../site-builds.mjs";
import { DISPATCH_CALL_MS } from "../builder/site-dispatch.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

blockNetwork();

const SLUG = "prv";
const V_LIVE = "01790500000000-aaaaaa";
const V_OLD = "01790600000000-bbbbbb";
const V_NEW = "01790600000500-cccccc";
const never = () => new Promise(() => {});
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { wait: () => p, open }; };
const until = async (f, n = 200) => { for (let i = 0; i < n && !(await f()); i++) await new Promise((r) => setTimeout(r, 2)); return !!(await f()); };

// ── THE SAVE ON ITS OWN, OVER A STORE ───────────────────────────────────────

function store() {
  const m = new Map();
  let n = 0;
  const deps = {
    m, failGet: null, refusePut: null,
    get: async (k) => { if (deps.failGet && deps.failGet(k)) throw new Error("r2 get failed"); return m.has(k) ? { etag: m.get(k).etag, text: async () => m.get(k).body } : null; },
    put: async (k, body, _ct, cond = {}) => {
      if (deps.refusePut && deps.refusePut(k)) throw new Error("r2 put failed");
      const cur = m.get(k);
      if (cond && cond.etagMatches && (!cur || cur.etag !== cond.etagMatches)) return null;
      if (cond && cond.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n);
      m.set(k, { body: String(body), etag });
      return { etag };
    },
    list: async (prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })),
    remove: async (k) => { m.delete(k); },
  };
  return deps;
}
async function stage(deps, version) {
  const r = await stageBuild(deps, {
    slug: SLUG, version, files: { "index.html": { t: "<p>" + version + "</p>" } },
    worker: { code: "// site-version: " + version + "\nexport default {}", build: "b-" + version.slice(-6) },
    state: { sidecar: JSON.stringify({ description: version }) }, manifest: { parent: V_LIVE },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
}
async function site() {
  const deps = store();
  for (const v of [V_LIVE, V_OLD, V_NEW]) await stage(deps, v);
  await deps.put("current/" + SLUG + ".json", JSON.stringify({ version: V_LIVE }), "application/json");
  return deps;
}
/** The preview slot: what is up, as uploads leave it; `repairs` scripts each repair attempt. */
function slot(deps, repairs = []) {
  const s = { version: null, uploads: [], tries: 0 };
  s.previewOf = (v) => async () => { s.version = v; s.uploads.push(v); return { ok: true }; };
  s.repreview = async (v) => {
    const how = repairs[s.tries++] || "ok";
    if (how === "fail") return { ok: false, error: "upload failed" };
    const b = await readBuild(deps, SLUG, v);
    s.version = /site-version: (\S+)/.exec(b.worker)[1]; s.uploads.push(s.version);
    if (how === "lost") throw new Error("the upload's answer was lost");
    return { ok: true };
  };
  return s;
}
const claimsOf = (deps) => [...deps.m.keys()].filter((k) => k.startsWith(PREVIEW_CLAIMS_PREFIX(SLUG)));
/** The older save paused inside its upload, the newer save whole, then the older upload lands. */
async function overlap(deps, sl, { beforeResume = null } = {}) {
  const g = gate();
  let reached = false;
  const older = saveAsDraft(deps, {
    slug: SLUG, version: V_OLD, base: V_LIVE, repreview: sl.repreview, commit: async () => {},
    preview: async () => { reached = true; await g.wait(); return sl.previewOf(V_OLD)(); },
  });
  assert.equal(await until(() => reached), true, "the older save never reached its upload — this case tests nothing");
  const newer = await saveAsDraft(deps, { slug: SLUG, version: V_NEW, base: V_LIVE, preview: sl.previewOf(V_NEW), repreview: sl.repreview, commit: async () => {} });
  assert.equal(newer.ok, true, JSON.stringify(newer));
  assert.equal(newer.previewed.ok, false, "the newer save was reported ready while the older save's claim stood: " + JSON.stringify(newer.previewed));
  if (beforeResume) beforeResume();
  g.open();
  return { older: await older, newer };
}

test("PR1 A FAILED REPAIR — the save stands, the preview is NOT ready (pending, recoverable, the error said), the repair tried 3 times, its claim left standing", async () => {
  const deps = await site();
  const sl = slot(deps, ["fail", "fail", "fail"]);
  const { older } = await overlap(deps, sl);
  assert.equal(older.ok, true, JSON.stringify(older));
  assert.equal((await readDraft(deps, SLUG)).draft.version, V_NEW);
  assert.equal(sl.version, V_OLD, "the case did not leave the older script up — it tests nothing");
  assert.equal(older.previewed.ok, false, "a preview serving the older version was reported ready: " + JSON.stringify(older.previewed));
  assert.deepEqual([older.previewed.pending, older.previewed.recoverable, older.previewed.repaired, older.previewed.version], [true, true, false, V_NEW]);
  assert.match(older.previewed.error, /upload failed/);
  assert.equal(sl.tries, 3, "the repair was not retried within its bound (tried " + sl.tries + ")");
  assert.equal(claimsOf(deps).length, 1, "the unconfirmed save's claim is not the one left standing: " + JSON.stringify(claimsOf(deps)));
  assert.equal(deps.m.get("current/" + SLUG + ".json").body, JSON.stringify({ version: V_LIVE }), "the live pointer moved");
});

test("PR2 A LOST ANSWER ON THE REPAIR — confirmed by the next round (ready, no claim left); lost every time, pending with its claim standing", async () => {
  {
    const deps = await site();
    const sl = slot(deps, ["lost", "ok"]);
    const { older } = await overlap(deps, sl);
    assert.equal(sl.tries, 2, "a lost answer was taken as confirmed: no second round");
    assert.deepEqual([older.previewed.ok, older.previewed.pending, sl.version], [true, false, V_NEW], JSON.stringify(older.previewed));
    assert.deepEqual(claimsOf(deps), []);
  }
  {
    const deps = await site();
    const sl = slot(deps, ["lost", "lost", "lost"]);
    const { older } = await overlap(deps, sl);
    assert.equal(sl.version, V_NEW);
    assert.deepEqual([older.previewed.ok, older.previewed.pending], [false, true], "an unconfirmed upload was reported ready: " + JSON.stringify(older.previewed));
    assert.equal(claimsOf(deps).length, 1);
  }
});

test("PR3 THE SAVE'S LOOK AT THE DRAFT FAILS AFTER THE STALE UPLOAD — pending, recoverable, its claim standing", async () => {
  const deps = await site();
  const sl = slot(deps);
  const { older } = await overlap(deps, sl, { beforeResume: () => { deps.failGet = (k) => k === DRAFT_KEY(SLUG) && sl.uploads.length >= 2; } });
  deps.failGet = null;
  assert.equal(sl.version, V_OLD);
  assert.deepEqual([older.previewed.ok, older.previewed.pending, older.previewed.recoverable], [false, true, true], JSON.stringify(older.previewed));
  assert.match(older.previewed.error, /could not be read/);
  assert.equal(claimsOf(deps).length, 1);
});

test("PR3b AN OLDER SAVE THAT CONFIRMS WHILE A NEWER SAVE'S CLAIM STANDS IS NOT READY — another upload may still land over it; the newer claim stays", async () => {
  const deps = await site();
  const sl = slot(deps);
  // THE NEWER SAVE starts while the older one is inside its upload: its claim
  // and its record, then it stops for good before its own upload.
  let started = false;
  const older = await saveAsDraft(deps, {
    slug: SLUG, version: V_OLD, base: V_LIVE, repreview: sl.repreview, commit: async () => {},
    preview: async () => {
      started = true;
      saveAsDraft(deps, { slug: SLUG, version: V_NEW, base: V_LIVE, preview: never, repreview: sl.repreview, commit: async () => {} });
      await until(() => /cccccc/.test(deps.m.get(DRAFT_KEY(SLUG)).body));
      return sl.previewOf(V_OLD)();
    },
  });
  assert.equal(started, true, "the newer save never started — this case tests nothing");
  assert.equal(older.ok, true);
  assert.equal(sl.version, V_NEW, "the older save did not put the selected version up");
  assert.equal(older.previewed.ok, false, "a save was reported ready while another writer's claim stood: " + JSON.stringify(older.previewed));
  assert.match(older.previewed.error, /may still land/);
  assert.equal(claimsOf(deps).length, 1, "the newer save's claim was not the one left: " + JSON.stringify(claimsOf(deps)));
});

test("PR3c NO CLAIM, NO UPLOAD — a save whose claim cannot be written saves its draft and puts no script up, said as not recoverable", async () => {
  const deps = await site();
  deps.refusePut = (k) => k.startsWith("preview-claims/");
  let uploaded = false;
  const r = await saveAsDraft(deps, { slug: SLUG, version: V_OLD, base: V_LIVE, preview: async () => { uploaded = true; return { ok: true }; }, repreview: async () => { uploaded = true; return { ok: true }; }, commit: async () => {} });
  assert.equal(r.ok, true, "the draft itself was not saved: " + JSON.stringify(r));
  assert.equal((await readDraft(deps, SLUG)).draft.version, V_OLD);
  assert.equal(uploaded, false, "an upload was made with no claim to track it");
  assert.deepEqual([r.previewed.ok, r.previewed.pending, r.previewed.recoverable], [false, true, false], JSON.stringify(r.previewed));
});

test("PR3d NO UPLOAD PAST THE CLAIM'S WINDOW, AND AN UNREADABLE CLAIM LIST IS NOT 'NONE' — a writer past its window starts no upload (so its claim can be settled as unable to land); a save that cannot read the other claims is not called ready", async () => {
  const deps = await site();
  await deps.put(DRAFT_KEY(SLUG), JSON.stringify({ v: 2, version: V_NEW, build: "", base: "", job: null, at: "x", history: [], preview: "aaaaaaaaaaaa", rev: 1, revs: [{ n: 1, version: V_NEW, at: "x", job: null }], applied: 0, refs: {} }), "application/json");
  let uploads = 0;
  const late = await convergePreview(deps, SLUG, { mine: V_NEW, upload: async () => { uploads++; return { ok: true }; }, repreview: async () => { uploads++; return { ok: true }; }, deadline: 1000, now: () => 2000 });
  assert.equal(uploads, 0, "an upload was started past the claim's window");
  assert.equal(late.ready, false);
  assert.match(late.error, /window/);
  // THE OTHER CLAIMS CANNOT BE READ: not ready.
  const d2 = await site();
  const sl = slot(d2);
  d2.list = async () => { throw new Error("r2 list failed"); };
  const r = await saveAsDraft(d2, { slug: SLUG, version: V_OLD, base: V_LIVE, preview: sl.previewOf(V_OLD), repreview: sl.repreview, commit: async () => {} });
  assert.equal(sl.version, V_OLD);
  assert.deepEqual([r.ok, r.previewed.ok, r.previewed.pending], [true, false, true], "a save that could not read the other claims was called ready: " + JSON.stringify(r.previewed));
  assert.match(r.previewed.error, /could not be read/);
});

// ── THROUGH THE REAL WORKER TICK ────────────────────────────────────────────

/** A published bakery with four real draft revisions under draft-first: staged versions v1–v4. */
async function bakery() {
  const compiler = installCompiler();
  const FROM = ["Follow us on TikTok at @oldloaf", "Come to the bakery", "Open every day", "Fresh bread daily", "Order online"];
  const TO = ["Follow us on TikTok at @harbourloaf", "Come and see us", "Open six days", "Fresh bread at dawn", "Order by phone"];
  const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + FROM[1] + "</h1>" + FROM.filter((_, i) => i !== 1).map((f) => "<p>" + f + "</p>").join("") + "</section>");
  const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const said = (args) => String(args.messages[0].content);
  const lineId = (args, line) => Number(String(said(args).split("\n").find((l) => l.includes("[visit.tsx] " + line)) || "-1.").split(".")[0]);
  let n = 0;
  const calls = { model: 0 };
  const P = platform({
    slug: "prv-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], liveScripts: true, balance: 400,
    answers: {
      route: () => { calls.model++; return { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] }; },
      [T.text]: (args) => { calls.model++; const i = Math.min(n++, 4); return { edits: [{ id: lineId(args, FROM[i]), to: TO[i] }] }; },
    },
  });
  const r0 = await sendMessage(P, { message: "Change our TikTok link." });
  await settle(P, r0.key, { rounds: 20 });
  P.env.DRAFT_FIRST = "on";
  for (const message of ["Change the heading.", "Say six days.", "Say at dawn.", "Say by phone."]) {
    const r = await sendMessage(P, { message });
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  }
  const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
  const draft = () => JSON.parse(bare(P.readObj(DRAFT_KEY(P.slug))));
  const versions = draft().revs.map((r) => r.version);
  assert.equal(versions.length, 4, JSON.stringify(draft().revs));
  const api = await loadWorkerModule();
  // THE SAVE, CALLED AS THE WORKER CALLS IT, OVER THE PLATFORM'S OWN STORE.
  const deps = {
    get: (k) => P.bucket.get(k),
    put: (k, b, ct, c) => P.bucket.put(k, b, { httpMetadata: { contentType: ct }, ...(c ? { onlyIf: c } : {}) }),
    list: async (prefix) => (await P.bucket.list({ prefix })).objects.map((o) => ({ key: o.key })),
    remove: (k) => P.bucket.delete(k),
  };
  const up = (v) => P.run(() => api.draftFirstApi.previewVersion(P.env, P.slug, v));
  const claims = async () => (await P.bucket.list({ prefix: PREVIEW_CLAIMS_PREFIX(P.slug) })).objects.map((o) => o.key);
  const reg = () => { const t = P.readObj(PREVIEW_STATE_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
  const setDraft = async (v) => { const d = draft(); await P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify({ ...d, version: v })); };
  const tick = (now) => P.run(() => api.runPreviewRecovery(P.env, { now }));
  const before = { live: P.liveScript(), pointer: P.readObj("current/" + P.slug + ".json"), ledger: P.ledger.length, model: calls.model };
  const untouched = () => {
    assert.equal(calls.model, before.model, "recovery asked a model");
    assert.equal(P.ledger.length, before.ledger, "recovery touched the ledger");
    assert.deepEqual([P.liveScript(), P.readObj("current/" + P.slug + ".json")], [before.live, before.pointer], "recovery touched the live site");
  };
  const save = (version, preview) => saveAsDraft(deps, { slug: P.slug, version, base: "", preview, repreview: (v) => up(v), commit: async () => {} });
  return { P, compiler, api, deps, versions, draft, up, claims, reg, setDraft, tick, untouched, save, done: async () => { await P.settle(); P.close(); compiler.uninstall(); } };
}

test("PR4 CODEX'S REPRODUCTION, A HARD STOP, THROUGH THE REAL TICK — the newer save is not called ready while the older claim stands; ticks while it could still land wait; the first tick after puts the selected version up and clears every claim; nothing rebuilt, charged or made live", async () => {
  const B = await bakery();
  try {
    assert.deepEqual(await B.claims(), [], "the real saves left a claim behind");
    const [v1, v2, v3] = B.versions;
    await B.setDraft(v1);
    await B.up(v1);
    // OLD: its claim, its record, then paused inside its upload.
    const g = gate();
    let reached = false;
    B.save(v2, async () => { reached = true; await g.wait(); await B.up(v2); return never(); });
    assert.equal(await until(() => reached), true, "the older save never reached its upload");
    // NEW, whole: its upload succeeds.
    const neu = await B.save(v3, () => B.up(v3));
    assert.equal(neu.ok, true);
    assert.equal(B.P.previewScript(), v3);
    assert.equal(neu.previewed.ok, false, "the newer save was reported ready while the older save's claim stood: " + JSON.stringify(neu.previewed));
    // OLD's upload lands — and its process is gone: no further line of it runs.
    const t0 = Date.now();
    g.open();
    assert.equal(await until(() => B.P.previewScript() === v2), true, "the older upload never landed");
    assert.equal(B.draft().version, v3);
    assert.equal((await B.claims()).length, 1, "the older save's claim is not the evidence left: " + JSON.stringify(await B.claims()));
    // TICKS WHILE THE OLDER UPLOAD COULD STILL LAND: they wait, and say so.
    for (const dt of [60e3, 5 * 60e3, PREVIEW_LAND_MS - 60e3]) {
      const r = await B.tick(t0 + dt);
      assert.deepEqual([r.waiting, r.ready, B.P.previewScript()], [1, 0, v2], "a tick acted ahead of an upload that could still land: " + JSON.stringify(r));
    }
    // THE FIRST TICK AFTER IT CAN NO LONGER LAND: the selected version up, every claim cleared.
    const r = await B.tick(t0 + PREVIEW_LAND_MS + 60e3);
    assert.deepEqual([r.ready, B.P.previewScript()], [1, v3], "the tick did not restore the selected draft: " + JSON.stringify(r));
    assert.deepEqual(await B.claims(), [], "claims were left after a confirmed repair");
    assert.deepEqual([B.reg().state, B.reg().up], ["ready", v3]);
    // A LATER TICK HAS NOTHING TO DO.
    const quiet = await B.tick(t0 + 2 * PREVIEW_LAND_MS);
    assert.deepEqual([quiet.looked, B.P.previewScript()], [0, v3]);
    B.untouched();
  } finally { await B.done(); }
});

test("PR5 A SAVE THAT STOPS FOR GOOD BETWEEN RECORDING THE DRAFT AND ITS PREVIEW — and one that stops before its record — is repaired by the tick", async () => {
  const B = await bakery();
  try {
    const [v1, v2] = B.versions;
    await B.setDraft(v1);
    await B.up(v1);
    // AFTER THE RECORD, BEFORE THE PREVIEW: the editable copy never finishes.
    const t0 = Date.now();
    saveAsDraft(B.deps, { slug: B.P.slug, version: v2, base: "", afterActivate: never, preview: () => B.up(v2), repreview: (v) => B.up(v), commit: async () => {} });
    assert.equal(await until(() => B.draft().version === v2), true, "the save never recorded the draft");
    assert.equal(B.P.previewScript(), v1);
    assert.equal((await B.claims()).length, 1, "the save left no evidence before its record");
    const r = await B.tick(t0 + PREVIEW_LAND_MS + 60e3);
    assert.deepEqual([r.ready, B.P.previewScript()], [1, v2], JSON.stringify(r));
    assert.deepEqual(await B.claims(), []);
    // BEFORE THE RECORD: a claim with nothing new to show is settled harmlessly.
    await claimPreview(B.deps, B.P.slug, t0);
    const r2 = await B.tick(t0 + PREVIEW_LAND_MS + 60e3);
    assert.deepEqual([r2.ready, B.P.previewScript(), (await B.claims()).length], [1, v2, 0], JSON.stringify(r2));
    B.untouched();
  } finally { await B.done(); }
});

test("PR6 A NEWER DRAFT SAVED WHILE THE TICK IS AT WORK — the tick leaves the newer version up; the newer save is not ready while the tick's claim stands; nothing is left claimed", async () => {
  const B = await bakery();
  try {
    const [, v2, v3, v4] = B.versions;
    await B.setDraft(v3);
    await B.up(v2);
    const t0 = Date.now();
    await claimPreview(B.deps, B.P.slug, t0);
    let newer = null;
    // WHILE THE TICK'S UPLOAD OF v3 IS IN FLIGHT, A SAVE OF v4 RUNS WHOLE.
    const tickAt = t0 + PREVIEW_LAND_MS + 60e3;
    let ownSeen = false;
    B.P.beforeUpload(async (text) => {
      if (/site-version: (\S+)/.exec(text)[1] !== v3) return;
      // THE TICK'S OWN CLAIM STANDS WHILE ITS UPLOAD IS IN FLIGHT.
      ownSeen = (await B.claims()).some((k) => claimAt(k) === tickAt);
      newer = await B.save(v4, () => B.up(v4));
    });
    const r = await B.tick(tickAt);
    assert.equal(ownSeen, true, "the tick uploaded with no claim of its own");
    assert.ok(newer, "the newer save never ran — this case tests nothing");
    assert.equal(newer.previewed.ok, false, "the newer save was reported ready while the tick's claim stood: " + JSON.stringify(newer.previewed));
    assert.deepEqual([r.ready, B.draft().version, B.P.previewScript()], [1, v4, v4], "the tick left an older draft's preview up: " + JSON.stringify(r));
    assert.deepEqual(await B.claims(), [], "a claim was left");
    B.untouched();
  } finally { await B.done(); }
});

test("PR7 DUPLICATE TICKS AT ONCE — the selected version up, nothing left claimed, the register ready", async () => {
  const B = await bakery();
  try {
    const [v1, , v3] = B.versions;
    await B.setDraft(v3);
    await B.up(v1);
    const t0 = Date.now();
    await claimPreview(B.deps, B.P.slug, t0);
    const at = t0 + PREVIEW_LAND_MS + 60e3;
    const rs = await Promise.all([B.tick(at), B.tick(at), B.tick(at)]);
    assert.ok(rs.some((r) => r.ready === 1), JSON.stringify(rs));
    assert.equal(B.P.previewScript(), v3);
    // A claim a concurrent tick made is fresh to the others; the next tick after it settles them.
    await B.tick(at + PREVIEW_LAND_MS + 60e3);
    assert.deepEqual(await B.claims(), [], "claims were left by duplicate ticks");
    assert.deepEqual([B.reg().state, B.P.previewScript()], ["ready", v3]);
    B.untouched();
  } finally { await B.done(); }
});

test("PR8 THE BOUNDED RETRY POLICY — a failing tick leaves its own claim and waits for the claims to stop landing and for its doubling backoff; stuck after PREVIEW_TRIES, then no more tries; a newer save's claim unsticks it", async () => {
  const B = await bakery();
  try {
    const [v1, , v3] = B.versions;
    await B.setDraft(v3);
    await B.up(v1);
    const t0 = Date.now();
    await claimPreview(B.deps, B.P.slug, t0);
    const step = PREVIEW_LAND_MS + previewBackoff(PREVIEW_TRIES) + 1000;
    let at = t0 + PREVIEW_LAND_MS + 60e3;
    for (let i = 1; i <= PREVIEW_TRIES; i++) {
      for (let k = 0; k < 3; k++) B.P.beforeUpload(async () => { throw new Error("upload refused"); });
      const r = await B.tick(at);
      assert.equal(r.ready, 0, "a refused upload was taken as a repair");
      assert.equal(B.reg().tries, i, "try " + i + " was not counted: " + JSON.stringify(B.reg()));
      if (i < PREVIEW_TRIES) {
        assert.equal(B.reg().state, "pending");
        assert.equal(B.reg().next, at + previewBackoff(i), "the backoff is not the stated doubling");
        // TOO SOON: inside its own claim's landing time — nothing tried.
        const soon = await B.tick(at + 60e3);
        assert.equal(soon.waiting, 1, "a tick tried again before the claims could stop landing");
        // A BACKOFF LONGER THAN THE LANDING TIME is waited out too.
        if (previewBackoff(i) > PREVIEW_LAND_MS + 120e3) {
          const before = B.P.previewScript();
          const early = await B.tick(at + PREVIEW_LAND_MS + 60e3);
          assert.deepEqual([early.waiting, early.ready, B.reg().tries, B.P.previewScript()], [1, 0, i, before], "a tick did not wait out its backoff: " + JSON.stringify(early));
        }
      }
      at += step;
    }
    assert.equal(B.reg().state, "stuck", JSON.stringify(B.reg()));
    const stuck = await B.tick(at);
    assert.deepEqual([stuck.stuck, B.P.previewScript()], [1, v1], "a stuck preview was tried again");
    // A NEWER SAVE'S CLAIM UNSTICKS IT.
    await claimPreview(B.deps, B.P.slug, at);
    const back = await B.tick(at + PREVIEW_LAND_MS + 60e3);
    assert.deepEqual([back.ready, B.P.previewScript(), B.reg().state], [1, v3, "ready"], JSON.stringify(back));
    assert.deepEqual(await B.claims(), []);
    B.untouched();
  } finally { await B.done(); }
});

test("PR9 STORAGE PERMISSIONS AND THE FLIGHT BOUND — a job may write its own site's claims and register, no other site's; the flight bound is the dispatch call's own limit", () => {
  const id = "a".repeat(32);
  assert.equal(allowedJobKey("prv", id, PREVIEW_CLAIMS_PREFIX("prv") + "0179060000000-abcdef012345.json"), true, "a job may not claim its own site's preview");
  assert.equal(allowedJobKey("prv", id, PREVIEW_CLAIMS_PREFIX("other") + "0179060000000-abcdef012345.json"), false, "a job may claim another site's preview");
  assert.equal(allowedJobKey("prv", id, PREVIEW_STATE_KEY("prv")), true);
  assert.equal(allowedJobKey("prv", id, PREVIEW_STATE_KEY("other")), false);
  assert.equal(PREVIEW_FLIGHT_MS, DISPATCH_CALL_MS, "the preview's flight bound is not the dispatch call's limit");
  assert.ok(PREVIEW_LAND_MS > PREVIEW_UPLOAD_WINDOW_MS + PREVIEW_FLIGHT_MS, "a claim is called unable to land before its last upload could have finished");
});

test("PR10 WHAT THE OWNER IS TOLD, AND THE SCHEDULE — `draftFacts` says ready and pending apart from the save; the tick is on the scheduled handler", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  const failed = draftFirstApi.draftFacts("prv", V_OLD, { draft: true, revision: 4, record: { preview: "abcdefabcdef" }, previewed: { ok: false, pending: true, recoverable: true } });
  assert.deepEqual([failed.published, failed.revision, failed.previewUploaded, failed.previewPending], [false, 4, false, true], JSON.stringify(failed));
  const fine = draftFirstApi.draftFacts("prv", V_OLD, { draft: true, revision: 4, record: { preview: "abcdefabcdef" }, previewed: { ok: true, pending: false } });
  assert.deepEqual([fine.previewUploaded, fine.previewPending], [true, false]);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("ctx.waitUntil(runMediaSweep(env)");
  const b = w.indexOf("ctx.waitUntil(runPublishRecovery(env)", a);
  assert.ok(a > 0 && b > a, "the scheduled handler moved — rescope this");
  assert.match(w.slice(a, b), /ctx\.waitUntil\(runPreviewRecovery\(env\)/, "the preview recovery is not on the tick");
});
