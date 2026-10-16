// A DRAFT'S PREVIEW, RECOVERED (2026-10-16, Codex's review of `ea9a2b71`).
//
// Codex paused an older save inside its preview upload, finished a newer save,
// resumed the older upload (so OLD landed last) and made the repair answer
// `{ ok: false, error: "upload failed" }`: the draft selected NEW, the preview
// served OLD, `previewed` said `{ ok: true, superseded: true, repaired: false }`
// — so the owner was told the preview was uploaded — and the loop counted the
// failed repair as NEW being up and stopped after one try. Nothing came back
// to it later.
//
//   PR1  Codex's reproduction, deterministic, through the real `saveAsDraft`:
//        the save stands (`ok`), the preview is NOT ready (`previewed.ok`
//        false, `pending`, `recoverable`, the error said), the repair was
//        tried the bounded number of times (not once), and the durable mark
//        says pending — the owner is not told the preview went up
//   PR2  a lost answer on the repair: the script went up but its answer was
//        lost, so nothing is confirmed and the next round confirms it — ready
//        within the save; lost every time, it stays pending (uncertain)
//   PR3  interrupted after the stale upload: the save's look at the draft
//        fails after OLD landed — not ready, mark pending, recoverable
//   PR4  the Worker's tick on real draft saves, with nobody's browser open:
//        a normal save leaves the mark ready; a preview left on an older
//        version with the mark pending is put on the draft's selected version
//        from its staged script — no model call, no charge, nothing live; a
//        failed upload in recovery waits (doubling) and is tried again; a lost
//        answer is confirmed on the next try; a newer draft selected while the
//        tick is at work is the one it leaves up; a mark a save is still
//        working on is left alone; after `PREVIEW_TRIES` a mark says stuck;
//        the tick is wired into the scheduled handler
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveAsDraft, readDraft, DRAFT_KEY, PREVIEW_STATE_KEY, PREVIEW_TRIES, previewBackoff } from "../site-draft.mjs";
import { stageBuild, readBuild } from "../site-builds.mjs";
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

function store() {
  const m = new Map();
  let n = 0;
  const deps = {
    m, failGet: null,
    get: async (k) => { if (deps.failGet && deps.failGet(k)) throw new Error("r2 get failed"); return m.has(k) ? { etag: m.get(k).etag, text: async () => m.get(k).body } : null; },
    put: async (k, body, _ct, cond = {}) => {
      const cur = m.get(k);
      if (cond && cond.etagMatches && (!cur || cur.etag !== cond.etagMatches)) return null;
      if (cond && cond.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n);
      m.set(k, { body: String(body), etag });
      return { etag };
    },
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
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { wait: () => p, open }; };
/** Codex's interleaving: the older save paused inside its upload, the newer save whole, then the older upload lands. */
async function overlap(deps, sl, { beforeResume = null } = {}) {
  const g = gate();
  let reached = false;
  const older = saveAsDraft(deps, {
    slug: SLUG, version: V_OLD, base: V_LIVE, repreview: sl.repreview, commit: async () => {},
    preview: async () => { reached = true; await g.wait(); return sl.previewOf(V_OLD)(); },
  });
  for (let i = 0; i < 50 && !reached; i++) await new Promise((r) => setTimeout(r, 1));
  assert.equal(reached, true, "the older save never reached its upload — this case tests nothing");
  const newer = await saveAsDraft(deps, { slug: SLUG, version: V_NEW, base: V_LIVE, preview: sl.previewOf(V_NEW), repreview: sl.repreview, commit: async () => {} });
  assert.deepEqual([newer.ok, newer.previewed.ok], [true, true], JSON.stringify(newer));
  if (beforeResume) beforeResume();
  g.open();
  return { older: await older, newer };
}
const markOf = (deps) => JSON.parse(deps.m.get(PREVIEW_STATE_KEY(SLUG)).body);

test("PR1 CODEX'S REPRODUCTION — a failed repair after the older upload landed: the save stands, the preview is NOT ready (pending, recoverable, the error said), the repair was tried the bounded number of times, and the durable mark says pending", async () => {
  const deps = await site();
  const sl = slot(deps, ["fail", "fail", "fail"]);
  const { older } = await overlap(deps, sl);
  assert.equal(older.ok, true, "the save itself (its record taken first) did not stand: " + JSON.stringify(older));
  const { draft } = await readDraft(deps, SLUG);
  assert.equal(draft.version, V_NEW);
  assert.equal(sl.version, V_OLD, "the case did not leave the older script up — it tests nothing");
  assert.equal(older.previewed.ok, false, "a preview serving the older version was reported ready: " + JSON.stringify(older.previewed));
  assert.deepEqual([older.previewed.pending, older.previewed.recoverable, older.previewed.repaired, older.previewed.version], [true, true, false, V_NEW]);
  assert.match(older.previewed.error, /upload failed/);
  assert.equal(sl.tries, 3, "the repair was not retried within its bound (tried " + sl.tries + ")");
  const mark = markOf(deps);
  assert.equal(mark.state, "pending", "the durable mark does not leave the tick a job: " + JSON.stringify(mark));
  // CONTROL: the newer save's own result was ready, and its mark was overwritten by the older save's pending one only after.
  assert.equal(deps.m.get("current/" + SLUG + ".json").body, JSON.stringify({ version: V_LIVE }), "the live pointer moved");
});

test("PR2 A LOST ANSWER ON THE REPAIR — the script went up but nothing is confirmed, so the next round confirms it (ready within the save); lost every time, the preview stays pending, never reported ready", async () => {
  {
    const deps = await site();
    const sl = slot(deps, ["lost", "ok"]);
    const { older } = await overlap(deps, sl);
    assert.equal(sl.tries, 2, "a lost answer was taken as confirmed: no second round");
    assert.deepEqual([older.previewed.ok, older.previewed.pending, sl.version], [true, false, V_NEW], JSON.stringify(older.previewed));
    assert.equal(markOf(deps).state, "ready");
  }
  {
    const deps = await site();
    const sl = slot(deps, ["lost", "lost", "lost"]);
    const { older } = await overlap(deps, sl);
    assert.equal(sl.version, V_NEW, "the case did not leave the newer script up");
    assert.deepEqual([older.previewed.ok, older.previewed.pending], [false, true], "an unconfirmed upload was reported ready: " + JSON.stringify(older.previewed));
    assert.equal(markOf(deps).state, "pending");
  }
});

test("PR3 INTERRUPTED AFTER THE STALE UPLOAD — the save's look at the draft fails once the older script landed: not ready, the mark pending, recoverable", async () => {
  const deps = await site();
  const sl = slot(deps);
  const { older } = await overlap(deps, sl, { beforeResume: () => { deps.failGet = (k) => k === DRAFT_KEY(SLUG) && sl.uploads.length >= 2; } });
  deps.failGet = null;
  assert.equal(sl.version, V_OLD, "the older script did not land last");
  assert.deepEqual([older.previewed.ok, older.previewed.pending, older.previewed.recoverable], [false, true, true], JSON.stringify(older.previewed));
  assert.match(older.previewed.error, /could not be read/);
  assert.equal(markOf(deps).state, "pending");
});

test("PR3b A NEWER SAVE'S MARK IS NEVER OVERWRITTEN BY AN OLDER SAVE'S READY — the older save confirms its version and, just before it writes ready, a newer save records itself, marks pending and stops before its upload: the mark stays pending", async () => {
  const deps = await site();
  const sl = slot(deps);
  let newer = null;
  const realPut = deps.put;
  deps.put = async (k, body, ct, cond) => {
    if (k === PREVIEW_STATE_KEY(SLUG) && /"state":"ready"/.test(String(body)) && !newer) {
      // THE NEWER SAVE: its record and its pending mark, then it stops (its upload never ends).
      newer = saveAsDraft(deps, { slug: SLUG, version: V_NEW, base: V_LIVE, preview: () => new Promise(() => {}), repreview: sl.repreview, commit: async () => {} });
      for (let i = 0; i < 50 && JSON.parse(deps.m.get(PREVIEW_STATE_KEY(SLUG)).body).want !== V_NEW; i++) await new Promise((r) => setTimeout(r, 1));
    }
    return realPut(k, body, ct, cond);
  };
  const older = await saveAsDraft(deps, { slug: SLUG, version: V_OLD, base: V_LIVE, preview: sl.previewOf(V_OLD), repreview: sl.repreview, commit: async () => {} });
  assert.ok(newer, "the newer save never started — this case tests nothing");
  assert.equal((await readDraft(deps, SLUG)).draft.version, V_NEW);
  assert.equal(older.ok, true);
  assert.deepEqual([markOf(deps).state, markOf(deps).want], ["pending", V_NEW], "an older save's ready overwrote a newer save's pending mark: " + JSON.stringify(markOf(deps)));
});

test("PR4 THE WORKER'S TICK ON REAL DRAFT SAVES, BROWSER CLOSED — the selected version put up from its staged script; failed, lost and interrupted uploads retried with backoff; a newer draft during recovery wins; no model call, no charge, nothing live; fresh marks left alone; stuck after the bound; wired into the scheduled handler", async () => {
  const compiler = installCompiler();
  const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
  const FROM = ["Follow us on TikTok at @oldloaf", "Come to the bakery", "Open every day", "Fresh bread daily", "Come and see us"];
  const TO = ["Follow us on TikTok at @harbourloaf", "Come and see us", "Open six days", "Fresh bread at dawn", "Come and say hello"];
  const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + FROM[1] + "</h1><p>" + FROM[0] + "</p><p>" + FROM[2] + "</p><p>" + FROM[3] + "</p></section>");
  const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const said = (args) => String(args.messages[0].content);
  const lineId = (args, line) => Number(String(said(args).split("\n").find((l) => l.includes("[visit.tsx] " + line)) || "-1.").split(".")[0]);
  let n = 0, modelCalls = 0;
  const P = platform({
    slug: "prv-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], liveScripts: true, balance: 400,
    answers: {
      route: () => { modelCalls++; return { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] }; },
      [T.text]: (args) => { modelCalls++; const i = Math.min(n++, 4); return { edits: [{ id: lineId(args, FROM[i]), to: TO[i] }] }; },
    },
  });
  const { runPreviewRecovery, draftFirstApi } = await loadWorkerModule();
  const later = () => Date.now() + 10 * 60 * 1000;
  const mark = () => JSON.parse(bare(P.readObj(PREVIEW_STATE_KEY(P.slug))));
  const setMark = async (m) => P.bucket.put(PREVIEW_STATE_KEY(P.slug), JSON.stringify({ v: 1, tries: 0, next: 0, at: Date.now() - 5 * 60 * 1000, ...m }));
  const draft = () => JSON.parse(bare(P.readObj(DRAFT_KEY(P.slug))));
  const setDraftVersion = async (v) => { const d = draft(); await P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify({ ...d, version: v })); };
  try {
    const r0 = await sendMessage(P, { message: "Change our TikTok link to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    P.env.DRAFT_FIRST = "on";
    for (const message of ["Change the Visit heading.", "Say we are open six days.", "Say fresh bread at dawn."]) {
      const r = await sendMessage(P, { message });
      const { rec } = await settle(P, r.key, { rounds: 20 });
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    }
    const [v1, v2, v3] = draft().revs.map((r) => r.version);
    assert.ok(v1 && v2 && v3, JSON.stringify(draft().revs));
    // A NORMAL SAVE LEAVES THE MARK READY on its own version.
    assert.deepEqual([mark().state, mark().up, P.previewScript()], ["ready", v3, v3], JSON.stringify(mark()));
    const live0 = P.liveScript(), pointer0 = P.readObj("current/" + P.slug + ".json"), ledger0 = P.ledger.length, calls0 = modelCalls;

    // A SAVE THAT STOPPED AFTER A STALE UPLOAD: the preview on v1, the mark pending.
    await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, v1));
    assert.equal(P.previewScript(), v1);
    // A MARK A SAVE IS STILL WORKING ON (younger than a minute) is left alone.
    await setMark({ state: "pending", want: v1, at: Date.now() });
    const young = await P.run(() => runPreviewRecovery(P.env, { now: Date.now() }));
    assert.deepEqual([young.ready, P.previewScript()], [0, v1], "the tick raced a save still at work: " + JSON.stringify(young));
    await setMark({ state: "pending", want: v1 });

    // A FAILED UPLOAD IN RECOVERY: it waits (backoff) and is tried again.
    // EVERY TRY OF THE ROUND refused (the tick itself tries up to three times).
    for (let i = 0; i < 3; i++) P.beforeUpload(async () => { throw new Error("upload refused"); });
    const t1 = await P.run(() => runPreviewRecovery(P.env, { now: later() }));
    assert.deepEqual([t1.ready, t1.waiting, mark().state, mark().tries], [0, 1, "pending", 1], JSON.stringify({ t1, mark: mark() }));
    assert.ok(mark().next > later() - 60 * 1000, "no backoff was set");
    assert.equal(P.previewScript(), v1);
    // PAST "FRESH" (a minute) BUT INSIDE THE BACKOFF (two minutes): not tried.
    const notYet = await P.run(() => runPreviewRecovery(P.env, { now: later() + 90 * 1000 }));
    assert.equal(notYet.ready, 0, "the tick did not wait out its backoff");
    assert.equal(P.previewScript(), v1, "the tick uploaded inside its backoff");
    // A LOST ANSWER: the upload lands, its answer is lost — not confirmed.
    for (let i = 0; i < 3; i++) P.afterUpload(async () => { throw new Error("answer lost"); });
    const t2 = await P.run(() => runPreviewRecovery(P.env, { now: later() + previewBackoff(1) + 1000 }));
    assert.equal(P.previewScript(), v3, "the lost-answer upload did not land — the case tests nothing");
    assert.equal(mark().state, "pending", "an upload whose answer was lost was taken as confirmed: " + JSON.stringify({ t2, mark: mark() }));
    // …the next try confirms it.
    const t3 = await P.run(() => runPreviewRecovery(P.env, { now: later() + previewBackoff(1) + previewBackoff(2) + 2000 }));
    assert.deepEqual([t3.ready, mark().state, mark().up, P.previewScript()], [1, "ready", v3, v3], JSON.stringify({ t3, mark: mark() }));

    // A NEWER DRAFT SELECTED WHILE THE TICK IS AT WORK: the draft says v2, the
    // tick puts v2 up, and while that upload is in flight v3 is selected.
    await setDraftVersion(v2);
    await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, v1));
    await setMark({ state: "pending", want: v2 });
    // …and the save that selected v3 marked the preview pending, as a save does.
    P.beforeUpload(async (text) => { if (/site-version: (\S+)/.exec(text)[1] === v2) { await setDraftVersion(v3); await setMark({ state: "pending", want: v3 }); } });
    const t4 = await P.run(() => runPreviewRecovery(P.env, { now: later() }));
    assert.deepEqual([t4.ready, P.previewScript()], [1, v3], "the tick left an older draft's preview up: " + JSON.stringify({ t4, mark: mark(), up: P.previewScript() }));
    // THE SAVE'S NEWER MARK IS NOT OVERWRITTEN by the tick's answer; the next tick confirms it.
    assert.deepEqual([mark().state, mark().want], ["pending", v3], "the tick wrote its answer over a newer save's mark: " + JSON.stringify(mark()));
    const t4b = await P.run(() => runPreviewRecovery(P.env, { now: later() }));
    assert.deepEqual([t4b.ready, mark().state, mark().up], [1, "ready", v3], JSON.stringify({ t4b, mark: mark() }));

    // NOTHING REGENERATED, CHARGED OR MADE LIVE by any of it.
    assert.equal(modelCalls, calls0, "recovery asked a model");
    assert.equal(P.ledger.length, ledger0, "recovery touched the ledger");
    assert.deepEqual([P.liveScript(), P.readObj("current/" + P.slug + ".json")], [live0, pointer0], "recovery touched the live site");

    // STUCK AFTER THE BOUND: every upload refused.
    await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, v1));
    await setMark({ state: "pending", want: v3, tries: PREVIEW_TRIES - 1 });
    for (let i = 0; i < 3; i++) P.beforeUpload(async () => { throw new Error("upload refused"); });
    const t5 = await P.run(() => runPreviewRecovery(P.env, { now: later() }));
    assert.deepEqual([t5.stuck, mark().state], [1, "stuck"], JSON.stringify({ t5, mark: mark() }));
    const t6 = await P.run(() => runPreviewRecovery(P.env, { now: later() + 24 * 3600 * 1000 }));
    assert.equal(t6.ready + t6.waiting + t6.stuck, 0, "a stuck mark was tried again");

    // A REAL SAVE WHOSE PREVIEW CANNOT GO UP: the save stands, its result
    // says the preview is not uploaded and pending, and the tick finishes it.
    for (let i = 0; i < 6; i++) P.beforeUpload(async () => { throw new Error("upload refused"); });
    const r9 = await sendMessage(P, { message: "Change the Visit heading again." });
    const s9 = await settle(P, r9.key, { rounds: 20 });
    assert.equal(s9.rec.parts[0].status, "done", "a save whose preview failed was not kept: " + JSON.stringify(s9.rec.parts.map((p) => [p.status, p.why])));
    // WHAT THE OWNER IS TOLD, from the save's own answer (`draftFacts`): not
    // uploaded and pending — the saved draft is said apart from its preview.
    const failed = draftFirstApi.draftFacts(P.slug, "01790600000000-bbbbbb", { draft: true, revision: 4, record: { preview: "abcdefabcdef" }, previewed: { ok: false, pending: true, recoverable: true, superseded: true, version: "x", repaired: false } });
    assert.deepEqual([failed.published, failed.revision, failed.previewUploaded, failed.previewPending], [false, 4, false, true], JSON.stringify(failed));
    const fine = draftFirstApi.draftFacts(P.slug, "01790600000000-bbbbbb", { draft: true, revision: 4, record: { preview: "abcdefabcdef" }, previewed: { ok: true, pending: false } });
    assert.deepEqual([fine.previewUploaded, fine.previewPending], [true, false]);
    const v9 = draft().version;
    assert.equal(mark().state, "pending");
    assert.notEqual(P.previewScript(), v9);
    const t9 = await P.run(() => runPreviewRecovery(P.env, { now: later() + 24 * 3600 * 1000 }));
    assert.deepEqual([t9.ready, P.previewScript(), mark().state], [1, v9, "ready"], JSON.stringify({ t9, mark: mark() }));
    assert.deepEqual([P.liveScript(), P.readObj("current/" + P.slug + ".json")], [live0, pointer0], "the save or its recovery touched the live site");
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
  // WIRED INTO THE SCHEDULED HANDLER, landmark to landmark.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("ctx.waitUntil(runMediaSweep(env)");
  const b = w.indexOf("ctx.waitUntil(runPublishRecovery(env)", a);
  assert.ok(a > 0 && b > a, "the scheduled handler moved — rescope this");
  assert.match(w.slice(a, b), /ctx\.waitUntil\(runPreviewRecovery\(env\)/, "the preview recovery is not on the tick");
});

test("PR5 STORAGE PERMISSIONS — a container job saving its own site's draft may write that site's preview mark, and no other site's", async () => {
  const { allowedJobKey } = await import("../builder/job-gateway.mjs");
  const id = "a".repeat(32);
  assert.equal(allowedJobKey("prv", id, PREVIEW_STATE_KEY("prv")), true, "a job may not mark its own site's preview");
  assert.equal(allowedJobKey("prv", id, PREVIEW_STATE_KEY("other")), false, "a job may mark another site's preview");
});
