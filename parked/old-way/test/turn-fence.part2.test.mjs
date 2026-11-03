// PARKED (2026-11-03, park-old-way): the old-way half of test/turn-fence.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE PUBLISH TURN, ENFORCED AT THE WRITE (2026-10-15, after review). A look
// at the turn before a write cannot stop the write: the holder can pause
// between the look and the write while its turn lapses and another job takes
// it. Reproduced with the Worker's own functions and controlled storage: A
// passed `mayWriteConfig`, paused inside its config read, its turn lapsed, B
// took the turn and wrote newer settings, and A resumed and answered ok while
// writing over B's description and CSS. Now every turn carries a larger fence
// than the last (builder/publish-turn.mjs `nextGen`), a job running beside
// others writes the site's guarded keys only on the etag it read and only
// while no larger fence is stamped there (worker.js `fencedPut`,
// `patchConfigFenced`), and a new holder stamps the pointer, the head and the
// config first and puts the config level with the live site
// (`stampFences`, `ensureEditableState`). Driven through the real Worker —
// the queue, the job runner, the routes, the publish spine and the ledger —
// with the model's answers supplied and each pause placed exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T, call } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { page as pageSrc, OLD_DESC } from "../../../test/fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "tf-" + k + "-" + Math.random().toString(16).slice(2, 8);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };
const editJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "edit");
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
/**
 * NOTHING KEPT FROM A JOB THAT WROTE NOTHING: every reserve it made given back
 * by exactly one refund, and none given back that was never taken.
 */
function chargedNothing(P, jobId) {
  const rows = P.ledger.filter((e) => String(e.ref) === jobId || String(e.ref).startsWith(jobId + "#"));
  const reserves = rows.filter((e) => e.reason === "reserve").length;
  const refunds = rows.filter((e) => e.reason === "refund").length;
  const net = rows.reduce((n, e) => n + e.delta, 0);
  return { ok: net === 0 && refunds === (reserves ? 1 : 0), rows };
}
/** Called, synchronously, from inside the named function: the pause lands exactly there. */
const inside = (name) => new Error().stack.includes(name);

const TURN = (P) => "publish-turn/" + P.slug + ".json";
const CFG = (P) => "config/" + P.slug + ".json";
const POINTER = (P) => "current/" + P.slug + ".json";
const HEAD = (P) => "source/" + P.slug + "/head.json";
const SOURCE = (P) => "source/" + P.slug + "/pages.json";

const HOME_FROM = "Bread from the harbour, every morning.";
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + HOME_FROM + "</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const TIKTOK_LATER = "Change our TikTok link on the Visit page to @harbourloafbakery";
const DESC_ASK = "Change the site description to say we bake overnight sourdough";
const DESC_TO = "Overnight sourdough from a harbour side street.";
const NEWER = "The newer holder's description.";
const B_CSS = ".newer-holder { color: teal; }";
const NEW_BRAND = "Harbour Loaf & Co";
const ROUTE_VISIT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_LOOK = { intent: "edit", layer: "look", targets: [{ change: 0, writes: ["theme"] }] };
const PICK_DESC = { fields: ["description"], scopes: [{ part: "description", words: DESC_ASK }] };

/**
 * B, THE JOB THAT TAKES THE TURN WHILE A IS PAUSED: A's turn lapses (its
 * record kept, its time up), B takes the turn through the Worker's own
 * `tryTurn`, and writes through the Worker's own functions under its fence.
 */
async function lapseAndTake(P, siteTurn) {
  const held = JSON.parse(P.readObj(TURN(P)));
  assert.ok(held.owner && held.until > Date.now(), "A did not hold the turn when B came");
  P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
  const B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
  assert.ok(B, "B could not take the lapsed turn");
  assert.ok(B.gen > (held.gen || 0), "B's fence is not larger than A's: " + JSON.stringify([held.gen, B.gen]));
  return { B, jobB: { beside: { turn: B } } };
}
async function bWritesSettings(P, siteTurn, jobB) {
  const cur = JSON.parse(P.readObj(CFG(P)));
  const w = await siteTurn.patchSiteConfig(P.env, P.slug, null, { look: { ...cur.look, description: NEWER }, css: B_CSS }, siteTurn.jobFence(P.env, jobB));
  assert.equal(w.ok, true, "B's own write was refused: " + JSON.stringify(w));
}
function assertBsSettings(P) {
  const cfg = JSON.parse(P.readObj(CFG(P)));
  assert.equal(cfg.look.description, NEWER, "A wrote over B's description");
  assert.equal(cfg.css, B_CSS, "A wrote over B's CSS");
}
async function finish(P, compiler, siteTurn, B) {
  if (B) await siteTurn.giveTurn(P.env, P.slug, B);
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}
/** One message, its one job delivered and run to its end. */
async function runOne(P, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  return r;
}

/**
 * A DESCRIPTION JOB (the look step, which holds the turn from its start)
 * whose config write is reached with `arm()` set from its lane's answer.
 */
async function descriptionJob(slug, { arm = null, compileBefore = null } = {}) {
  const compiler = installCompiler({ before: async (body) => { if (compileBefore) await compileBefore(body); } });
  let P = null;
  P = platform({
    slug, pages: PAGES2, beside: true,
    answers: {
      route: [ROUTE_LOOK],
      [T.pick]: PICK_DESC,
      "lane:description": async () => { if (arm) arm(P); return DESC_TO; },
    },
  });
  return { P, compiler };
}

/** A site that has published once (a pointer, its head marker, its state): the Visit line changed. */
async function publishedOnce(P) {
  const r = await runOne(P, TIKTOK + ".");
  const job = editJobs(P, r.key)[0];
  assert.equal(job.state, "done", "the first publish did not land: " + JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
  assert.ok(P.readObj(POINTER(P)), "no pointer after the first publish");
  return job;
}
function visitSite(slug, extraRoutes = [], answers = {}, opts = {}) {
  const compiler = installCompiler();
  let n = 0;
  const P = platform({
    slug, pages: PAGES2, beside: true, ...opts,
    answers: {
      route: [ROUTE_VISIT, ...extraRoutes],
      [T.text]: async (args) => ({ edits: [{ id: lineId(args, "visit.tsx", n++ === 0 ? TT_FROM : TT_TO), to: n === 1 ? TT_TO : TT_LATER }] }),
      ...answers,
    },
  });
  return { P, compiler };
}

// ── EVERY JOB CONFIG WRITE CARRIES ITS FENCE (source guard) ─────────────────
// The cases above drive the look step's write, its put-back and the spine; the
// logo's, the stylesheet repair's, the edit's own put-back and the addition's
// look and its revert are the same call, read here so none is left on an
// unfenced write. The observer is proven alive first: it must find them all.
import fs from "node:fs";
import { nextGen, turnRecord, readTurn } from "../../../builder/publish-turn.mjs";

/** Each call `name(` in `src` as its whole argument text, brackets balanced. */
function calls(src, name) {
  const out = [];
  for (let i = src.indexOf(name + "("); i >= 0; i = src.indexOf(name + "(", i + 1)) {
    let depth = 0; let j = i + name.length;
    for (; j < src.length; j++) { const c = src[j]; if (c === "(") depth++; else if (c === ")" && --depth === 0) break; }
    out.push(src.slice(i, j + 1));
  }
  return out;
}

// ── IDENTICAL CONTENT, CONTENT ETAGS (2026-10-15, Codex's two reproductions)
// R2 derives a single put's etag from the body's MD5, and a matching
// `etagMatches` overrides `uploadedBefore` (Miniflare's validator; the
// fixture follows it, test/r2-conditions.test.mjs). So a stamp that rewrote
// the same bytes kept the etag, and a stale write conditional on the etag —
// with or without an upload time beside it — landed over B's stamp. The
// guarantee now lives in the bytes: every guarded write ends with its
// holder's fence, so B's stamp of the same content is new bytes, a new etag.
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));

// ── KEYS THAT ARE NOT THERE YET, AND THE SITE'S SCRIPT (2026-10-15) ─────────
const LIVE = (P) => "sites/" + P.slug + "/site.live";

/** B, as a new holder that publishes an earlier version: takes the turn, stamps, moves the pointer there under its fence, and puts that version's script up. */
async function bPublishes(P, siteTurn, version) {
  const took = await lapseAndTake(P, siteTurn);
  const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: took.B.owner, fence: { gen: took.B.gen } });
  assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
  const cur = await P.env.SITES_BUCKET.head(POINTER(P));
  const put = await siteTurn.fencedPut(P.env, POINTER(P), JSON.stringify({ version, build: "", parent: "", job: "newer", activatedAt: new Date().toISOString() }), { contentType: "application/json", onlyIf: { etagMatches: cur.etag }, fence: { gen: took.B.gen } });
  assert.ok(put, "B could not move the pointer");
  const al = await siteTurn.alignLiveScript(P.env, P.slug);
  assert.equal(al.aligned, true, "B's script did not go up: " + JSON.stringify(al));
  return took.B;
}

// ── THE SCRIPT FOLLOWS THE POINTER, WHOEVER UPLOADS (2026-10-15, Codex's
// second review). A script upload cannot be conditional, so every uploader
// of a pointer's version writes a pending note, uploads, then reads the
// pointer and asks the live script, putting the pointer's own script up
// while they disagree; the note goes only when every upload answered and the
// script was seen on the pointer, and the cron's sweep takes up the rest.
// A NOTE'S WINDOW HAS PASSED (2026-10-15, after Codex's fourth review):
// another invocation may retire it only after the upload's 10-minute abort
// and 2 minutes more since its owner last renewed it.
const PAST_WINDOW = 13 * 60 * 1000;
const NOTES = (P) => [...P.objects.keys()].filter((k) => k.startsWith("scriptpending/" + P.slug + "/"));
const setPointer = (P, version) => { const p = JSON.parse(bare(P.readObj(POINTER(P)))); P.writeObj(POINTER(P), JSON.stringify({ ...p, version, parent: "" })); };
const stagedScript = (P, version) => {
  for (const [k] of P.objects) {
    if (!k.startsWith("builds/" + P.slug + "/" + version + "/")) continue;
    const t = P.readObj(k);
    if (typeof t === "string" && t.includes("// site-version: " + version)) return t;
  }
  return null;
};
async function twoVersions(name) {
  const { siteTurn } = await loadWorkerModule();
  const made = visitSite(slugOf(name), [ROUTE_VISIT], {}, { liveScripts: true });
  const { P } = made;
  await publishedOnce(P);
  const v0 = JSON.parse(bare(P.readObj(POINTER(P)))).version;
  await runOne(P, TIKTOK_LATER + ".");
  const v1 = JSON.parse(bare(P.readObj(POINTER(P)))).version;
  assert.notEqual(v1, v0, "the second publish did not land");
  assert.equal(P.liveScript(), v1);
  assert.ok(stagedScript(P, v0) && stagedScript(P, v1), "a version's script is not staged");
  return { ...made, siteTurn, v0, v1 };
}

// ── DRAFT-FIRST PUBLISHING (owner, 2026-10-15): "only an explicit click on
// the Publish button may make changes live." With `DRAFT_FIRST=on` every
// task saves its result as the site's draft — the record, the editable copy,
// a preview under the draft script's own name — and nothing live moves; the
// owner's Publish releases exactly the version they approved.
const DRAFT = (P) => "site-drafts/" + P.slug + ".json";
const draftOf = (P) => { const t = P.readObj(DRAFT(P)); return t ? JSON.parse(bare(t)) : null; };
const liveVersion = (P) => JSON.parse(bare(P.readObj(POINTER(P)))).version;
async function draftSite(name) {
  const { siteTurn } = await loadWorkerModule();
  // EACH CHANGE FROM WHAT THE LAST ONE LEFT: the TikTok line moves back and forth.
  let k = 0;
  const seq = [[TT_FROM, TT_TO], [TT_TO, TT_LATER], [TT_LATER, TT_TO], [TT_TO, TT_LATER]];
  const text = async (args) => { const [from, to] = seq[Math.min(k++, seq.length - 1)]; return { edits: [{ id: lineId(args, "visit.tsx", from), to }] }; };
  const made = visitSite(slugOf(name), [ROUTE_VISIT, ROUTE_VISIT, ROUTE_VISIT], { [T.text]: text }, { liveScripts: true });
  await publishedOnce(made.P);
  made.P.env.DRAFT_FIRST = "on";
  return { ...made, siteTurn, v0: liveVersion(made.P), side0: bare(made.P.readObj("sitemeta/" + made.P.slug + ".json")) };
}

// ── ABSENT KEYS HELD IN THE STORE, AND UNDO WITHOUT DELETE (2026-10-15, ─────
// after Codex's third review). Codex reproduced it with `kit.json` and the
// draft record: the key starts absent; A pauses inside its fenced write
// immediately before the conditional PUT; A's turn lapses; B takes it and its
// takeover completes; A resumes and its create-if-absent lands, with A's
// older fence. Driven here through the Worker's own functions.
import { saveDraftRecord, readDraft } from "../../../site-draft.mjs";
import { isHeldObject } from "../../../site-builds.mjs";
const KIT = (P) => "source/" + P.slug + "/kit.json";

// HELD BY ITS METADATA, as a fenced write reads it (a `head` carries no body).
async function heldBy(P, key, gen) {
  const o = await P.env.SITES_BUCKET.head(key);
  return !!o && isHeldObject(o) && String(o.customMetadata && o.customMetadata.fence) === String(gen);
}

// ── RECOVERY UPLOADS ARE THEMSELVES RECOVERABLE (2026-10-15, after Codex's ──
// third review). An alignment, the takeover repair and the sweep each upload
// the pointer's script; none of those uploads had a note, so a repair that
// stopped after an upload left nothing to find. Codex: B and C staged, C
// live, the pointer at B; alignment begins and uploads B; the pointer moves
// back to C before B's upload takes effect; the repair stopped; final state
// pointer C, live script B, no notes, and the sweep ten minutes later found
// nothing. An accepted upload takes effect later (`deferLanding`): the probe
// still shows C while B is the last upload accepted.
// PAST A NOTE'S WINDOW (the upload's 10-minute abort plus 2 minutes), set
// before its first use below.
const SIX_MIN = 13 * 60 * 1000;

// ── EACH RECOVERY OWNS ITS OWN NOTE (2026-10-15, after Codex's fourth review).
// Codex, through the Worker's own functions: B and C staged, C live; an old
// note eligible for the sweep; the pointer at B. Sweep A pauses immediately
// before its upload of B; the pointer moves back to C; sweep B runs, sees C
// serving, settles, and retired the note — the one covering A's upload. A's
// upload of B landed, A died: pointer C, live script B, no notes, and the
// sweep ten minutes later found nothing.
const oldNote = (P, version) => { const k = "scriptpending/" + P.slug + "/old-" + Math.random().toString(16).slice(2, 8) + ".json"; P.writeObj(k, JSON.stringify({ slug: P.slug, version, at: 0 })); return k; };
const dieAfterLanding = (P) => { const s = { landed: false }; P.afterUpload(() => { s.landed = true; return new Promise(() => {}); }); return s; };
const waitFor = async (pred) => { for (let i = 0; i < 400 && !pred(); i++) await new Promise((ok) => setTimeout(ok, 5)); };

for (const [name, start] of [
  ["an alignment", (P, siteTurn) => siteTurn.alignLiveScript(P.env, P.slug)],
  ["a publication", (P, siteTurn, v) => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v), build: "" }, { version: v })],
  ["the takeover repair", async (P, siteTurn) => { const T = await siteTurn.tryTurn(P.env, P.slug, "job:t:o9", "t"); return siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: T.owner, fence: { gen: T.gen } }); }],
]) {
  test("TR2 " + name.toUpperCase() + " IN FLIGHT BESIDE A SWEEP THAT SETTLES — its upload of the old version is held; the pointer moves back and a sweep settles on the expired note; its upload lands and it dies: its own note survives the sweep, and a later sweep puts the pointer's script back", async () => {
    const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tr2-" + name.length);
    try {
      const stale = oldNote(P, v0);
      P.advance(PAST_WINDOW);
      setPointer(P, v0);
      let mid = null;
      P.beforeUpload(async () => { setPointer(P, v1); mid = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() })); });
      const death = dieAfterLanding(P);
      P.run(() => start(P, siteTurn, v0));
      await waitFor(() => death.landed);
      assert.ok(death.landed, name + "'s upload never landed");
      assert.deepEqual(mid, { sites: 1, settled: 1 }, JSON.stringify(mid));
      assert.equal(P.readObj(stale), null);
      assert.equal(P.liveScript(), v0, "not this case");
      assert.equal(NOTES(P).length, 1, name + "'s own note was retired by the sweep");
      P.advance(PAST_WINDOW);
      assert.deepEqual(await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() })), { sites: 1, settled: 1 });
      assert.equal(P.liveScript(), v1);
      assert.deepEqual(NOTES(P), []);
    } finally { compiler.uninstall(); }
  });
}
