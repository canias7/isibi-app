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
import { platform, sendMessage, deliver, settle, T, call } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { page as pageSrc, OLD_DESC } from "./fixtures/live-ask.mjs";

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

test("TF1 THE REPRODUCTION, WITH THE WORKER'S OWN FUNCTIONS — A holds the turn and passes mayWriteConfig; inside its config read it pauses, its turn lapses, B takes the turn and writes a newer description and CSS; A resumes: its write is refused, ok false, and B's settings stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf1"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    assert.ok(A && A.gen > 0, "A could not take the turn, or carries no fence");
    const jobA = { id: "a", beside: { turn: A } };
    await siteTurn.mayWriteConfig(P.env, P.slug, jobA);
    let paused = false;
    P.afterGet((k) => k === CFG(P) && inside("patchSiteConfig"), async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      await bWritesSettings(P, siteTurn, took.jobB);
    });
    const w = await siteTurn.patchSiteConfig(P.env, P.slug, null, { look: { brand: "Harbour Loaf", theme: "broadsheet", description: "A's stale description." }, css: ".stale { color: red; }" }, siteTurn.jobFence(P.env, jobA));
    assert.ok(paused, "A's config read was never paused");
    assert.equal(w.ok, false, "A's write answered ok after its turn passed to B");
    assert.equal(w.fenced, true, JSON.stringify(w));
    assertBsSettings(P);
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen), "the config does not carry B's fence");
    // A's LATER WRITES ARE REFUSED TOO, with no further look at the turn.
    const again = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale2 {}" }, siteTurn.jobFence(P.env, jobA));
    assert.equal(again.ok, false);
    assertBsSettings(P);
  } finally { await finish(P, compiler, siteTurn, B); }
});

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

test("TF2 A REAL CONFIG JOB PAUSED INSIDE ITS CONFIG READ — the description job holds the turn and passes its check; inside the read its write begins with, its turn lapses and B takes it and writes a newer description and CSS: the job writes nothing, publishes nothing, ends failed and is refunded once; B's settings and B's turn stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  let B = null; let paused = false;
  const { P, compiler } = await descriptionJob(slugOf("tf2"), {
    arm: (P) => P.afterGet((k) => k === CFG(P) && inside("patchSiteConfig"), async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      await bWritesSettings(P, siteTurn, took.jobB);
    }),
  });
  try {
    const r = await runOne(P, DESC_ASK + ".");
    assert.ok(paused, "the description job's config read was never paused");
    assertBsSettings(P);
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 400)]));
    assert.ok(!job.published_at, "the stale job published");
    // NO VERSION LIVE: at most the held empty pointer a takeover writes.
    const ptr = P.readObj(POINTER(P));
    assert.ok(!ptr || JSON.parse(ptr).none === true, "the stale job moved the site's pointer: " + ptr);
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the stale job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
    const turn = JSON.parse(P.readObj(TURN(P)));
    assert.equal(turn.owner, "job:newer:o2", "the stale job took the turn back or gave B's away");
    assert.ok(turn.until > Date.now(), "the stale job gave back B's turn");
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TF3 PAUSED AFTER THE FINAL CHECK, BEFORE THE CONFIG WRITE — the description job's mayWriteConfig reads its turn as held; between that and its write landing, its turn lapses and B takes it and writes: the job's write is refused at the store, it publishes nothing and is refunded once; B's settings stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  let B = null; let paused = false;
  const { P, compiler } = await descriptionJob(slugOf("tf3"), {
    // THE LAST LOOK AT THE TURN (mayWriteConfig's read) arms the pause at the
    // write itself: B acts after A's check has answered yes.
    arm: (P) => P.afterGet((k) => k === TURN(P) && inside("mayWriteConfig"), async () => {
      P.beforePut((k) => k === CFG(P), async () => {
        paused = true;
        const took = await lapseAndTake(P, siteTurn); B = took.B;
        await bWritesSettings(P, siteTurn, took.jobB);
      });
    }),
  });
  try {
    const r = await runOne(P, DESC_ASK + ".");
    assert.ok(paused, "the pause after the final check was never reached");
    assertBsSettings(P);
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 400)]));
    assert.ok(!job.published_at, "the stale job published");
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the stale job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TF4 THE PUT-BACK, PAUSED AFTER ITS CHECK — the description job's compile fails; its put-back passes mayWriteConfig, and before it lands its turn lapses and B takes it and writes: the put-back is refused, B's settings stand, nothing is published and the job is refunded once", async () => {
  const { siteTurn } = await loadWorkerModule();
  let B = null; let paused = false; let compiles = 0;
  const holder = { P: null };
  const { P, compiler } = await descriptionJob(slugOf("tf4"), {
    compileBefore: async (body) => {
      if (!JSON.stringify(body).includes(DESC_TO)) return;
      compiles++;
      const P = holder.P;
      // ARMED AT THE COMPILE, so the next check is the put-back's own.
      P.afterGet((k) => k === TURN(P) && inside("mayWriteConfig"), async () => {
        P.beforePut((k) => k === CFG(P), async () => {
          paused = true;
          const took = await lapseAndTake(P, siteTurn); B = took.B;
          await bWritesSettings(P, siteTurn, took.jobB);
        });
      });
      throw new Error("the build service restarted");
    },
  });
  holder.P = P;
  try {
    const r = await runOne(P, DESC_ASK + ".");
    assert.equal(compiles, 1, "the description job's compile was not reached once");
    assert.ok(paused, "the put-back's pause was never reached");
    assertBsSettings(P);
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed");
    assert.ok(!job.published_at, "the failed job published");
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the failed job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
  } finally { await finish(P, compiler, siteTurn, B); }
});

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

test("TF5 THE EDITABLE-STATE REPAIR, PAUSED AFTER ITS CHECK — the site's head marker is missing, so a page change's publish repairs the editable copy under its turn; at the repair's first write its turn lapses and B takes it and repairs as the new holder: the stale repair writes nothing over B's, the stale job publishes nothing and is refunded once", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("tf5"), [ROUTE_VISIT]);
  let B = null; let paused = false; let afterB = null;
  try {
    await publishedOnce(P);
    P.objects.delete(HEAD(P));
    P.beforePut((k) => k === SOURCE(P) && inside("repairEditable"), async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's own repair failed: " + JSON.stringify(st));
      afterB = { source: (await P.env.SITES_BUCKET.head(SOURCE(P))).etag, head: (await P.env.SITES_BUCKET.head(HEAD(P))).etag };
    });
    const pointerBefore = P.readObj(POINTER(P));
    const r = await runOne(P, TIKTOK_LATER + ".");
    assert.ok(paused, "the repair's write was never paused");
    assert.equal((await P.env.SITES_BUCKET.head(SOURCE(P))).etag, afterB.source, "the stale repair wrote the source over B's");
    assert.equal((await P.env.SITES_BUCKET.head(HEAD(P))).etag, afterB.head, "the stale repair wrote the head over B's");
    assert.equal(P.metaOf(SOURCE(P)).fence, String(B.gen));
    assert.equal(JSON.parse(P.readObj(POINTER(P))).version, JSON.parse(pointerBefore).version, "the stale job published");
    assert.equal(P.page("visit.tsx").includes(TT_LATER), false, "the stale job's change reached the site");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the stale job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TF6 THE ACTIVATION, PAUSED AFTER THE FINAL CHECK — a page change passes its turn check at the commit point; at the pointer write its turn lapses and B takes it (stamping the pointer as the new holder, publishing nothing yet): the stale activation is refused, the live version stays, and the stale job is refunded once", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("tf6"), [ROUTE_VISIT]);
  let B = null; let paused = false;
  try {
    await publishedOnce(P);
    const live = JSON.parse(P.readObj(POINTER(P))).version;
    P.beforePut((k) => k === POINTER(P) && inside("activateBuild"), async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
    });
    const r = await runOne(P, TIKTOK_LATER + ".");
    assert.ok(paused, "the activation's pointer write was never paused");
    assert.equal(JSON.parse(P.readObj(POINTER(P))).version, live, "the stale job moved the pointer after its turn passed to B");
    assert.equal(P.metaOf(POINTER(P)).fence, String(B.gen));
    assert.equal(P.page("visit.tsx").includes(TT_LATER), false, "the stale job's change reached the editable copy");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    assert.ok(!job.published_at, "the stale job was marked published");
    // REFUSED AFTER THE PUBLISH GATE, so the ledger parks it for review (the
    // refund protocol's rule for any failure past the gate); settled as never
    // live, it is refunded exactly once.
    if (P.jobs.get(job.id).needs_review) {
      assert.equal(reserveOf(P, job.id).length, 1);
      assert.equal(P.ledger.filter((e) => e.ref === job.id && e.reason === "refund").length, 0, "refunded before its review");
      P.reconcile(job.id, false);
    }
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the stale job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TF7 A LATER CONFIG JOB NEVER PUBLISHES A FAILED HOLDER'S ABANDONED SETTINGS — the site published; a description job writes its config, its compile fails and its put-back does not land; a later brand change (a config job, holding the turn from its start) publishes the brand with the live description, never the abandoned one; each job charged once, the failed one refunded once", async () => {
  let failNext = false; let descCompiles = 0;
  const holder = { P: null };
  const compiler = installCompiler({
    before: async (body) => {
      if (!JSON.stringify(body).includes(DESC_TO) || failNext) return;
      descCompiles++;
      // THE PUT-BACK WILL NOT LAND: the next config write fails.
      const P = holder.P;
      P.failPut((k) => k === CFG(P));
      throw new Error("the build service restarted");
    },
  });
  let n = 0;
  const P = platform({
    slug: slugOf("tf7"), pages: PAGES2, beside: true,
    answers: {
      route: [ROUTE_VISIT, ROUTE_LOOK, ROUTE_LOOK],
      [T.text]: async (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      [T.pick]: async () => (n++ === 0 ? PICK_DESC : { fields: ["brand"], scopes: [{ part: "brand", words: "Rename us to " + NEW_BRAND }] }),
      "lane:description": DESC_TO,
      "lane:brand": NEW_BRAND,
    },
  });
  holder.P = P;
  try {
    await publishedOnce(P);
    const live = JSON.parse(P.readObj(POINTER(P))).version;
    const failedReq = await runOne(P, DESC_ASK + ".");
    const failed = editJobs(P, failedReq.key)[0];
    assert.equal(descCompiles, 1, "the description job's compile was not reached");
    assert.equal(failed.state, "failed");
    { const c = chargedNothing(P, failed.id); assert.ok(c.ok, "the failed holder kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
    // THE PRECONDITION: the failed holder's settings are abandoned in the config.
    assert.equal(P.look().description, DESC_TO, "the case did not leave the failed holder's settings behind");
    assert.equal(JSON.parse(P.readObj(POINTER(P))).version, live, "the failed holder published");
    const later = await runOne(P, "Rename us to " + NEW_BRAND + ".");
    const job = editJobs(P, later.key)[0];
    assert.equal(job.state, "done", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    assert.equal(reserveOf(P, job.id).length, 1, "the later config job was not charged exactly once");
    const now = JSON.parse(P.readObj(POINTER(P))).version;
    assert.notEqual(now, live, "the later config job did not publish");
    const published = JSON.parse(P.readObj("sites/" + P.slug + "/" + now + "/state/config.json") || P.readObj([...P.objects.keys()].find((k) => k.includes(now) && k.endsWith("state/config.json"))));
    assert.equal(published.look.brand, NEW_BRAND, "the brand change was not published");
    assert.equal(published.look.description, OLD_DESC, "the later config job published the failed holder's abandoned description");
    assert.equal(P.look().description, OLD_DESC, "the editable config still carries the abandoned description");
    assert.equal(P.look().brand, NEW_BRAND);
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the first publish's change was lost");
    assert.ok(chargedNothing(P, failed.id).ok, "the failed holder's refund changed");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

// ── EVERY JOB CONFIG WRITE CARRIES ITS FENCE (source guard) ─────────────────
// The cases above drive the look step's write, its put-back and the spine; the
// logo's, the stylesheet repair's, the edit's own put-back and the addition's
// look and its revert are the same call, read here so none is left on an
// unfenced write. The observer is proven alive first: it must find them all.
import fs from "node:fs";
import { nextGen, turnRecord, readTurn } from "../builder/publish-turn.mjs";

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

test("TF8 EVERY CONFIG WRITE A JOB MAKES ON ITS SITE CARRIES THE JOB'S FENCE — the look, the logo, the stylesheet repair, the edit's put-back, the addition's look and its revert, and the spine's translation cache", () => {
  const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const jobWrites = calls(W, "patchSiteConfig").filter((c) => /^patchSiteConfig\(env, ownerSlug,/.test(c));
  assert.ok(jobWrites.length >= 7, "the scan found too few job config writes to be looking at them: " + jobWrites.length);
  for (const c of jobWrites) assert.match(c, /, jobFence\(env, (eJob|aJob)\)\)$/, "a job config write without its fence: " + c.slice(0, 160));
  const spine = W.slice(W.indexOf("async function recompileAndPublish("), W.indexOf("\nasync function ", W.indexOf("async function recompileAndPublish(") + 10));
  assert.match(spine, /patchSiteConfig\(env, slug, db, \{ langStrings: nextStrings \}, jobFence\(env, job\)\)/, "the spine's translation cache is written unfenced");
  // EVERY mayWriteConfig IS FOLLOWED BY A FENCED WRITE: the look is never the only guard.
  const looks = [...W.matchAll(/await mayWriteConfig\(env, ownerSlug, eJob\);\n\s*const (?:w|back) = await (patchSiteConfig\([\s\S]*?\);)/g)];
  assert.ok(looks.length >= 4, "the scan found too few checked writes: " + looks.length);
  for (const m of looks) assert.match(m[1], /jobFence\(env, eJob\)\);$/, "a checked write without its fence: " + m[1].slice(0, 160));
});

test("TF9 EACH TURN TAKEN CARRIES A LARGER FENCE THAN THE ONE BEFORE IT — above the stored turn's, never below the clock, kept through a renewal's record and read back", () => {
  const t0 = 1_800_000_000_000;
  assert.equal(nextGen(null, t0), t0, "a first turn's fence is the clock");
  const stored = { turn: readTurn(JSON.stringify(turnRecord("job:a:o1", t0, "a", t0 + 500))) };
  assert.equal(stored.turn.gen, t0 + 500, "the fence is not read back");
  assert.equal(nextGen(stored, t0), t0 + 501, "a turn taken under a clock behind the stored fence is not above it");
  assert.equal(nextGen(stored, t0 + 9000), t0 + 9000, "a later clock is not used");
  assert.equal(readTurn(JSON.stringify({ v: 1, owner: "o", job: "", at: 1, until: 2 })).gen, 0, "a record from before the fence reads as no fence");
  assert.equal(turnRecord("o", t0, "j", NaN).gen, 0, "a fence that is not a number is kept as one");
});

test("TF10 THE FENCE OUTLIVES A RENEWAL AND A GIVE-BACK, AND A WRITE OUTSIDE ANY TURN KEEPS THE STAMP — a stale holder still meets the newer fence after the owner's own settings write", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf10"), pages: PAGES2, beside: true });
  try {
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    assert.equal(await siteTurn.renewTurn(P.env, P.slug, A), true);
    assert.equal(JSON.parse(P.readObj(TURN(P))).gen, A.gen, "a renewal dropped the turn's fence");
    const jobA = { beside: { turn: A } };
    P.writeObj(TURN(P), JSON.stringify({ ...JSON.parse(P.readObj(TURN(P))), until: 0 }));
    const B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
    await bWritesSettings(P, siteTurn, { beside: { turn: B } });
    await siteTurn.giveTurn(P.env, P.slug, B);
    assert.equal(JSON.parse(P.readObj(TURN(P))).gen, B.gen, "a give-back dropped the turn's fence");
    // THE OWNER'S OWN WRITE, outside any turn (a share card, say): the stamp stays.
    const own = await siteTurn.patchSiteConfig(P.env, P.slug, null, { share: { title: "Harbour Loaf" } });
    assert.equal(own.ok, true);
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen), "a write outside the turn cleared the fence");
    const stale = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale {}" }, siteTurn.jobFence(P.env, jobA));
    assert.equal(stale.ok, false, "the stale holder wrote after the owner's own write cleared the stamp");
    assert.equal(JSON.parse(P.readObj(CFG(P))).css, B_CSS);
    // A LATER TURN IS STILL ABOVE B's, given back or not.
    const C = await siteTurn.tryTurn(P.env, P.slug, "job:c:o3", "c");
    assert.ok(C.gen > B.gen, "a later turn's fence is not above the one given back");
    await siteTurn.giveTurn(P.env, P.slug, C);
  } finally { await finish(P, compiler, siteTurn, null); }
});

// ── IDENTICAL CONTENT, CONTENT ETAGS (2026-10-15, Codex's two reproductions)
// R2 derives a single put's etag from the body's MD5, and a matching
// `etagMatches` overrides `uploadedBefore` (Miniflare's validator; the
// fixture follows it, test/r2-conditions.test.mjs). So a stamp that rewrote
// the same bytes kept the etag, and a stale write conditional on the etag —
// with or without an upload time beside it — landed over B's stamp. The
// guarantee now lives in the bytes: every guarded write ends with its
// holder's fence, so B's stamp of the same content is new bytes, a new etag.
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
test("TF11 A STALE HOLDER PAUSED BEFORE ITS CONDITIONAL PUT, OVER A STAMP OF THE SAME CONTENT — A reads the config and pauses immediately before its put; its turn lapses; B takes the turn and its takeover stamps the unchanged config (B's upload newer, the content the same); A resumes: refused on the etag, the CSS unchanged, and B's higher fence kept", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf11"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const before = JSON.parse(P.readObj(CFG(P)));
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    const jobA = { id: "a", beside: { turn: A } };
    let paused = false; let stamped = null;
    P.beforePut((k) => k === CFG(P) && inside("patchConfigFenced"), async () => {
      paused = true;
      const read = await P.env.SITES_BUCKET.head(CFG(P));
      const held = JSON.parse(P.readObj(TURN(P)));
      P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
      B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
      const now = await P.env.SITES_BUCKET.head(CFG(P));
      stamped = { read, now, text: P.readObj(CFG(P)) };
    });
    const w = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale { color: red; }" }, siteTurn.jobFence(P.env, jobA));
    assert.ok(paused && stamped, "A's put was never paused");
    // THE CASE IS CODEX'S: B's stamp changed no content and uploaded later.
    assert.deepEqual(JSON.parse(stamped.text), before, "B's takeover changed the config's content — this case is about a stamp of the same content");
    assert.ok(stamped.now.uploaded.getTime() > stamped.read.uploaded.getTime(), "B's stamp was not a later upload");
    assert.notEqual(stamped.now.etag, stamped.read.etag, "B's stamp of the same content kept the etag A read: a stale write keyed on it lands on R2");
    assert.equal(w.ok, false, "A wrote over B's stamp: " + JSON.stringify(w));
    assert.equal(w.fenced, true, "A's refusal is not the fence's: " + JSON.stringify(w));
    assert.equal(P.readObj(CFG(P)), stamped.text, "A's stale CSS landed, or B's stamp was replaced");
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen), "A replaced B's higher fence with its own lower one");
  } finally { if (B) await siteTurn.giveTurn(P.env, P.slug, B); await P.settle(); P.close(); compiler.uninstall(); }
});

test("TF12 THE SAME CONTENT WRITTEN BY B ITSELF — A reads the config and pauses before its put; B takes the turn and writes the very content A read through its own fenced write; A resumes: refused, B's write and fence stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf12"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    const jobA = { id: "a", beside: { turn: A } };
    // THE STORED CONFIG IN THE WRITER'S OWN FORM FIRST, so B's write of the
    // same content is, without a fence in the bytes, the same bytes.
    const cssNow = ".same { color: blue; }";
    const w0 = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: cssNow }, null);
    assert.equal(w0.ok, true, JSON.stringify(w0));
    let paused = false; let afterB = null;
    P.beforePut((k) => k === CFG(P) && inside("patchConfigFenced") && !paused, async () => {
      paused = true;
      const held = JSON.parse(P.readObj(TURN(P)));
      P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
      B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
      const wb = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: cssNow }, { gen: B.gen });
      assert.equal(wb.ok, true, "B's own write failed: " + JSON.stringify(wb));
      afterB = P.readObj(CFG(P));
    });
    const w = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale {}" }, siteTurn.jobFence(P.env, jobA));
    assert.ok(paused, "A's put was never paused");
    assert.equal(w.ok, false, "A wrote over B's write of the same content: " + JSON.stringify(w));
    assert.equal(P.readObj(CFG(P)), afterB, "A's stale write replaced B's");
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen));
  } finally { if (B) await siteTurn.giveTurn(P.env, P.slug, B); await P.settle(); P.close(); compiler.uninstall(); }
});

// ── KEYS THAT ARE NOT THERE YET, AND THE SITE'S SCRIPT (2026-10-15) ─────────
const LIVE = (P) => "sites/" + P.slug + "/site.live";

test("TA1 A SITE WITH NO CONFIG OBJECT — A reads no config and pauses before its create; its turn lapses; B takes the turn, and its takeover creates the config as it reads now, stamped: A's create is refused, B's config and fence stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("ta1"), pages: PAGES2, beside: true });
  let B = null;
  try {
    P.objects.delete(CFG(P));
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    const jobA = { id: "a", beside: { turn: A } };
    let paused = false;
    P.beforePut((k) => k === CFG(P) && inside("patchConfigFenced"), async () => {
      paused = true;
      assert.equal(P.readObj(CFG(P)), null, "the config was there before A's create — not this case");
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
      assert.ok(P.readObj(CFG(P)), "B's takeover left the site with no config object to stamp");
    });
    // THROUGH THE PLATFORM'S STAND-INS, as a job runs: B's takeover looks the
    // site's database up for its legacy config.
    const w = await P.run(() => siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale { color: red; }" }, siteTurn.jobFence(P.env, jobA)));
    assert.ok(paused, "A's create was never paused");
    assert.equal(w.ok, false, "A created the config over B's: " + JSON.stringify(w));
    assert.doesNotMatch(P.readObj(CFG(P)), /stale/, "A's stale CSS landed: " + P.readObj(CFG(P)) + " " + JSON.stringify(w));
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen));
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TA2 A SITE WITH NO POINTER — a page change on a site that has never published takes the turn and pauses at its first activation; its turn lapses and B takes it: B's takeover holds the empty pointer under its fence, the stale first activation is refused, and no version goes live", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ta2"));
  let B = null; let paused = false;
  try {
    P.beforePut((k) => k === POINTER(P) && inside("activateBuild"), async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
    });
    const r = await runOne(P, TIKTOK + ".");
    assert.ok(paused, "the first activation was never paused");
    const ptr = P.readObj(POINTER(P));
    assert.ok(ptr, "B's takeover held no pointer");
    assert.equal(JSON.parse(ptr).none, true, "a version went live after the turn passed to B: " + ptr);
    assert.equal(P.metaOf(POINTER(P)).fence, String(B.gen));
    assert.equal(P.page("visit.tsx").includes(TT_TO), false, "the stale job's change reached the editable copy");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    assert.ok(!job.published_at, "the stale job was marked published");
    if (P.jobs.get(job.id).needs_review) P.reconcile(job.id, false);
    { const c = chargedNothing(P, job.id); assert.ok(c.ok, "the stale job kept a charge or was refunded twice: " + JSON.stringify(c.rows)); }
  } finally { await finish(P, compiler, siteTurn, B); }
});

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

test("TS1 THE SCRIPT GUARD — a page change's activation moves the pointer and pauses before its script goes up; B takes the turn and publishes the earlier version with its own script: the stale job uploads nothing, the live script is B's, and it matches the pointer", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ts1"), [ROUTE_VISIT], {}, { liveScripts: true });
  let B = null; let paused = false; let mark = 0;
  try {
    await publishedOnce(P);
    const v0 = JSON.parse(P.readObj(POINTER(P))).version;
    // BETWEEN THE POINTER AND THE SCRIPT: the sidecar write (the live marker
    // now comes after the script, 2026-10-15).
    P.beforePut((k) => k === "sitemeta/" + P.slug + ".json" && inside("activateBuild"), async () => {
      paused = true;
      B = await bPublishes(P, siteTurn, v0);
      mark = P.uploads().length;
    });
    const r = await runOne(P, TIKTOK_LATER + ".");
    assert.ok(paused, "the activation was never paused between its pointer and its script");
    const after = P.uploads().slice(mark);
    assert.deepEqual(after.map((u) => u.version), [], "the stale job uploaded a script after the turn passed to B: " + JSON.stringify(after));
    assert.equal(P.liveScript(), v0, "the live script is not B's");
    assert.equal(JSON.parse(P.readObj(POINTER(P))).version, v0, "the pointer is not B's");
    const job = editJobs(P, r.key)[0];
    assert.notEqual(job.state, "done", "the stale job was reported done");
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TS2 THE SCRIPT FOLLOWS THE POINTER AFTER THE UPLOAD — a page change's script upload is held in flight; B takes the turn and publishes the earlier version; the stale upload lands: the stale job puts the pointer's own script back, and the live script matches the pointer", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ts2"), [ROUTE_VISIT], {}, { liveScripts: true });
  let B = null; let paused = false;
  try {
    await publishedOnce(P);
    const v0 = JSON.parse(P.readObj(POINTER(P))).version;
    P.beforeUpload(async (text) => {
      paused = true;
      assert.doesNotMatch(text, new RegExp("site-version: " + v0 + "\\b"), "the held upload is not the new version's");
      B = await bPublishes(P, siteTurn, v0);
    });
    await runOne(P, TIKTOK_LATER + ".");
    assert.ok(paused, "the stale upload was never held");
    assert.equal(JSON.parse(P.readObj(POINTER(P))).version, v0, "the pointer is not B's");
    assert.equal(P.liveScript(), v0, "the stale upload left the live script on another version than the pointer's: " + JSON.stringify(P.uploads()));
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TS3 THE NEW HOLDER PUTS THE SCRIPT RIGHT — the pointer names one version and the live script serves another (a stale upload whose holder died before putting it right): the next job to take the turn uploads the pointer's own script", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ts3"), [ROUTE_VISIT], {}, { liveScripts: true });
  let C = null;
  try {
    await publishedOnce(P);
    const v0 = JSON.parse(P.readObj(POINTER(P))).version;
    await runOne(P, TIKTOK_LATER + ".");
    const v1 = JSON.parse(P.readObj(POINTER(P))).version;
    assert.notEqual(v1, v0, "the second publish did not land");
    assert.equal(P.liveScript(), v1);
    // THE STATE A DEAD STALE UPLOADER LEAVES: the pointer back on v0, the live script v1.
    const p = JSON.parse(P.readObj(POINTER(P)));
    P.writeObj(POINTER(P), JSON.stringify({ ...p, version: v0, parent: "" }));
    C = await siteTurn.tryTurn(P.env, P.slug, "job:c:o3", "c");
    const st = await P.run(() => siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: C.owner, fence: { gen: C.gen } }));
    assert.equal(st.ok, true, JSON.stringify(st));
    assert.equal(P.liveScript(), v0, "the new holder left the live script on another version than the pointer's");
  } finally { await finish(P, compiler, siteTurn, C); }
});

test("TS4 THE SIDECAR IS GUARDED — a page change's activation moves the pointer and pauses before its sidecar write; B takes the turn and publishes, writing its own sidecar: the stale job writes no sidecar over B's, uploads no script, and the live script stays B's", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ts4"), [ROUTE_VISIT], {}, { liveScripts: true });
  let B = null; let paused = false; let mark = 0;
  const SIDE = (P) => "sitemeta/" + P.slug + ".json";
  const B_HEAD = JSON.stringify({ title: "B's published head" });
  try {
    await publishedOnce(P);
    const v0 = JSON.parse(P.readObj(POINTER(P))).version;
    P.beforePut((k) => k === SIDE(P) && inside("activateBuild"), async () => {
      paused = true;
      B = await bPublishes(P, siteTurn, v0);
      const cur = await P.env.SITES_BUCKET.head(SIDE(P));
      const put = await siteTurn.fencedPut(P.env, SIDE(P), B_HEAD, { contentType: "application/json", onlyIf: cur ? { etagMatches: cur.etag } : null, fence: { gen: B.gen } });
      assert.ok(put, "B could not write its sidecar");
      mark = P.uploads().length;
    });
    await runOne(P, TIKTOK_LATER + ".");
    assert.ok(paused, "the activation was never paused before its sidecar");
    assert.equal(bare(P.readObj(SIDE(P))), B_HEAD, "the stale job wrote its sidecar over B's");
    assert.deepEqual(P.uploads().slice(mark).map((u) => u.version), [], "the stale job uploaded a script after the turn passed to B");
    assert.equal(P.liveScript(), v0);
  } finally { await finish(P, compiler, siteTurn, B); }
});

// ── THE SCRIPT FOLLOWS THE POINTER, WHOEVER UPLOADS (2026-10-15, Codex's
// second review). A script upload cannot be conditional, so every uploader
// of a pointer's version writes a pending note, uploads, then reads the
// pointer and asks the live script, putting the pointer's own script up
// while they disagree; the note goes only when every upload answered and the
// script was seen on the pointer, and the cron's sweep takes up the rest.
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

test("TS5 CODEX'S INTERLEAVE — B's alignment reads the pointer (v0) and is held before its upload; the pointer moves to C (v1) and C's alignment completes; B's upload lands: B follows the pointer, and the live script is the pointer's (C's), not B's", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("ts5");
  try {
    setPointer(P, v0);
    let paused = false; let c = null;
    P.beforeUpload(async (text) => {
      paused = true;
      assert.match(text, new RegExp("site-version: " + v0 + "\\b"), "the held upload is not B's version");
      setPointer(P, v1);
      c = await siteTurn.alignLiveScript(P.env, P.slug);
    });
    const b = await P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    assert.ok(paused, "B's upload was never held");
    assert.equal(c && c.aligned, true, "C's alignment did not complete: " + JSON.stringify(c));
    assert.equal(JSON.parse(bare(P.readObj(POINTER(P)))).version, v1);
    assert.equal(P.liveScript(), v1, "B's stale upload left the live script off the pointer: " + JSON.stringify(P.uploads().map((u) => u.version)));
    assert.equal(b.aligned, true, "B did not settle on the pointer: " + JSON.stringify(b));
    assert.equal(b.version, v1, "B settled on another version than the pointer's");
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TS6 A PUBLICATION'S UPLOAD HELD, THE POINTER MOVED BY ANOTHER — putSiteWorker for v0 (the pointer's when it began) is held before its upload; another publication moves the pointer to v1 and uploads v1; v0's upload lands: it follows the pointer to v1, and its pending note is gone", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("ts6");
  try {
    setPointer(P, v0);
    P.beforeUpload(async () => {
      setPointer(P, v1);
      const other = await siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v1), build: "" }, { version: v1 });
      assert.equal(other.ok, true, JSON.stringify(other));
    });
    const r = await P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v0), build: "" }, { version: v0 }));
    assert.equal(r.ok, true);
    assert.equal(P.liveScript(), v1, "the held upload left v0 live under a v1 pointer: " + JSON.stringify(P.uploads().map((u) => u.version)));
    assert.equal(r.follow.settled, true, JSON.stringify(r.follow));
    assert.deepEqual(NOTES(P), [], "a settled publication left its pending note");
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TS7 A LOST RESPONSE — v0's upload lands and its answer is lost, and the pointer is then put back on v1 (an activation undoing itself): the note stays, the sweep leaves a fresh note alone and, once it is stale, puts v1's script back and takes the note away", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("ts7");
  try {
    setPointer(P, v0);
    P.afterUpload(async () => { throw new Error("connection reset"); });
    const r = await P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v0), build: "" }, { version: v0 }));
    assert.equal(r.ok, false, "a lost answer read as an upload that answered");
    assert.equal(P.liveScript(), v0, "the lost upload did not land — not this case");
    assert.equal(NOTES(P).length, 1, "an upload whose landing is not known left no note");
    setPointer(P, v1);
    const early = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.equal(early.sites, 0, "the sweep acted on a note younger than its age");
    assert.equal(P.liveScript(), v0);
    P.advance(6 * 60 * 1000);
    const swept = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(swept, { sites: 1, settled: 1 }, JSON.stringify(swept));
    assert.equal(P.liveScript(), v1, "the sweep did not put the pointer's script back");
    assert.deepEqual(NOTES(P), [], "the sweep left the note it settled");
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TS8 AN UPLOADER THAT DIES after its stale upload lands — v0's publication uploads while the pointer has moved to v1 and never runs again: no customer request follows, and the cron tick's sweep puts v1's script back", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("ts8");
  try {
    setPointer(P, v0);
    P.beforeUpload(async () => { setPointer(P, v1); });
    let landed = false;
    P.afterUpload(() => { landed = true; return new Promise(() => {}); });
    P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v0), build: "" }, { version: v0 }));
    for (let i = 0; i < 200 && !landed; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.ok(landed, "the stale upload never landed");
    assert.equal(P.liveScript(), v0);
    assert.equal(NOTES(P).length, 1, "the dead uploader left no note");
    P.advance(6 * 60 * 1000);
    // THE CRON ITSELF, not the sweep called by hand: the scheduled handler's tick.
    const { default: worker } = await import("../worker.js");
    const waits = [];
    await P.run(() => worker.scheduled({ cron: "*/2 * * * *", scheduledTime: P.now() }, P.env, { waitUntil: (p) => waits.push(p) }));
    await P.run(() => Promise.allSettled(waits));
    assert.equal(P.liveScript(), v1, "the cron tick did not put the pointer's script back: " + JSON.stringify(P.uploads().map((u) => u.version)));
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle({ ms: 50, rounds: 1 }); compiler.uninstall(); }
});

test("TS9 CONTROLS — an ordinary publication leaves no note and uploads once; a legacy upload (no version: a restore that drops the pointer) writes no note and never replaces itself with the pointer's script", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("ts9");
  try {
    assert.deepEqual(NOTES(P), [], "an ordinary publication left a note");
    const n = P.uploads().length;
    const r = await P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v0), build: "" }));
    assert.equal(r.ok, true);
    assert.equal(r.follow, undefined, "a legacy upload followed the pointer");
    assert.deepEqual(P.uploads().slice(n).map((u) => u.version), [v0], "a legacy upload was replaced by the pointer's script");
    assert.deepEqual(NOTES(P), []);
    // AND A PUBLICATION ON THE POINTER UPLOADS EXACTLY ONCE.
    const m = P.uploads().length;
    const r2 = await P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v1), build: "" }, { version: v1 }));
    assert.equal(r2.follow.uploads, 0, JSON.stringify(r2.follow));
    assert.deepEqual(P.uploads().slice(m).map((u) => u.version), [v1]);
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle(); compiler.uninstall(); }
});

// ── EVERY GUARDED KEY, STAMPED (2026-10-15, the audit after Codex's second
// review): a stale holder that read a key before the turn passed and writes
// it after is refused on that key's etag, even when the new holder never
// writes that key itself — the editable copy (source, parts, kit), the
// sidecar and the head among them.
test("TF13 EVERY GUARDED KEY — for each of the source, parts, kit, sidecar, head and config: A reads it for a fenced write and pauses before its put; its turn lapses; B takes the turn and its takeover writes nothing to that key but its stamp; A resumes: refused, B's stamp and fence stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const keys = (P) => ["source/" + P.slug + "/pages.json", "source/" + P.slug + "/parts.json", "source/" + P.slug + "/kit.json", "sitemeta/" + P.slug + ".json", "source/" + P.slug + "/head.json", CFG(P)];
  const n = keys({ slug: "x" }).length;
  for (let i = 0; i < n; i++) {
    const P = platform({ slug: slugOf("tf13-" + i), pages: PAGES2, beside: true });
    let B = null;
    try {
      const key = keys(P)[i];
      if (!P.readObj(key)) P.writeObj(key, key.endsWith("head.json") ? JSON.stringify({ version: "01790000000000-aaaaaa", at: "" }) : key.startsWith("sitemeta/") ? JSON.stringify({ title: "before" }) : JSON.stringify([]));
      const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
      let paused = false; let stamped = null;
      P.beforePut((k) => k === key && inside("fencedPut"), async () => {
        paused = true;
        const held = JSON.parse(P.readObj(TURN(P)));
        P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
        B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
        const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
        assert.equal(st.ok, true, key + ": B's takeover failed: " + JSON.stringify(st));
        stamped = P.readObj(key);
      });
      let refused = null;
      try { await P.run(() => siteTurn.fencedPut(P.env, key, JSON.stringify({ stale: true }), { fence: { gen: A.gen } })); }
      catch (e) { refused = e; }
      assert.ok(paused, key + ": A's put was never paused");
      assert.ok(refused && refused.code === "TURN_FENCED", key + ": A's stale write was not refused by the fence: " + String(refused && refused.message));
      assert.equal(P.readObj(key), stamped, key + ": A's stale write landed over B's stamp");
      assert.doesNotMatch(String(P.readObj(key)), /stale/);
      assert.equal(P.metaOf(key).fence, String(B.gen), key + ": B's fence was replaced");
    } finally { if (B) await siteTurn.giveTurn(P.env, P.slug, B); await P.settle(); P.close(); }
  }
  compiler.uninstall();
});

test("TS10 EVERY UPLOAD OF A POINTER'S VERSION FOLLOWS THE POINTER — each putSiteWorker call that publishes a version the pointer names (restore, edit publication, build, lost-upload recovery) passes that version; the two without one are the legacy restore paths; the raw upload is called only by putSiteWorker and followPointer", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const calls = [...src.matchAll(/putSiteWorker\(env, [^\n]*/g)].map((m) => m[0]).filter((c) => !c.includes("{ version = \"\" } = {}) {"));
  assert.ok(calls.length >= 6, "the observer found too few calls: " + calls.length);
  const withVersion = calls.filter((c) => /\{ version(: [^}]+)? \}\)/.test(c));
  // FIVE SINCE THE OWNER'S PUBLISH (draft-first, `publishDraft`).
  assert.equal(withVersion.length, 5, "pointer publications without their version:\n" + calls.join("\n"));
  for (const c of calls.filter((x) => !withVersion.includes(x))) {
    assert.ok(/rb\.worker, build: rb\.build/.test(c) || /\{ ok: true, code, build \}/.test(c), "an upload outside the legacy paths follows no pointer: " + c);
  }
  // OUTSIDE putSiteWorker/followPointer, ONLY A DRAFT'S PREVIEW, which goes
  // up under its own script name and never reaches a live address.
  const raw = [...src.matchAll(/uploadScriptOnce\([^\n]*/g)].map((m) => m[0]);
  const live = raw.filter((c) => !/^uploadScriptOnce\(env, slug, worker, \{ preview = false \}/.test(c) && !/\{ preview: true \}\)/.test(c));
  assert.equal(live.length, 4, "a raw upload to a live script outside putSiteWorker/followPointer: " + JSON.stringify(live));
  const body = src.slice(src.indexOf("async function putSiteWorker(env, slug, worker"), src.indexOf("async function alignLiveScript(env, slug)"));
  assert.ok(body.length > 200, "putSiteWorker/followPointer not found");
  assert.equal([...body.matchAll(/uploadScriptOnce\(/g)].length, 4, "the raw upload's calls are not all inside putSiteWorker/followPointer");
});

test("TF14 THE SAME BYTES THROUGH A FENCED WRITE — A reads the parts for a fenced write and pauses; its turn lapses; B takes the turn and writes exactly the bytes A read through its own fenced write (no stamp first); A resumes: refused on the etag, B's write and fence stand", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf14"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const key = "source/" + P.slug + "/parts.json";
    const body = JSON.stringify([{ name: "Band", source: "export function Band(){ return null }" }]);
    P.writeObj(key, body);
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    let paused = false; let afterB = null;
    P.beforePut((k) => k === key && inside("fencedPut") && !paused, async () => {
      paused = true;
      const held = JSON.parse(P.readObj(TURN(P)));
      P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
      B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
      await siteTurn.fencedPut(P.env, key, body, { fence: { gen: B.gen } });
      afterB = P.readObj(key);
    });
    let refused = null;
    try { await P.run(() => siteTurn.fencedPut(P.env, key, JSON.stringify([]), { fence: { gen: A.gen } })); } catch (e) { refused = e; }
    assert.ok(paused, "A's put was never paused");
    assert.ok(refused && refused.code === "TURN_FENCED", "A's stale write over B's identical bytes was not refused: " + String(refused && refused.message));
    assert.equal(P.readObj(key), afterB);
    assert.equal(P.metaOf(key).fence, String(B.gen));
  } finally { if (B) await siteTurn.giveTurn(P.env, P.slug, B); await P.settle(); P.close(); compiler.uninstall(); }
});

test("TS11 A FAILED ACTIVATION UNDOES ITS OWN FENCED WRITES — a page change beside others moves the pointer, writes its sidecar, and its script upload is refused: the pointer, the sidecar and the live script are put back as they were (its own writes recognised by etag, whatever fence their bytes carry)", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { P, compiler } = visitSite(slugOf("ts11"), [ROUTE_VISIT], {}, { liveScripts: true });
  try {
    await publishedOnce(P);
    const SIDE = "sitemeta/" + P.slug + ".json";
    const v0 = JSON.parse(bare(P.readObj(POINTER(P)))).version;
    const side0 = JSON.parse(bare(P.readObj(SIDE)));
    P.beforeUpload(async () => { throw new Error("upload refused"); });
    await runOne(P, TIKTOK_LATER + ".");
    assert.equal(JSON.parse(bare(P.readObj(POINTER(P)))).version, v0, "the pointer was left on the version whose script never landed");
    assert.deepEqual(JSON.parse(bare(P.readObj(SIDE))), side0, "the failed activation's sidecar was not put back");
    assert.equal(P.liveScript(), v0);
  } finally { await finish(P, compiler, siteTurn, null); }
});

// ── DRAFT-FIRST PUBLISHING (owner, 2026-10-15): "only an explicit click on
// the Publish button may make changes live." With `DRAFT_FIRST=on` every
// task saves its result as the site's draft — the record, the editable copy,
// a preview under the draft script's own name — and nothing live moves; the
// owner's Publish releases exactly the version they approved.
const DRAFT = (P) => "drafts/" + P.slug + ".json";
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

test("DF1 AN EDIT SAVES A DRAFT AND PUBLISHES NOTHING — the change is in the draft, the editable copy and the preview; the pointer, the live script, the sidecar and the live marker are as they were; the job is charged as delivered and says it is not published", async () => {
  const { P, compiler, siteTurn, v0, side0 } = await draftSite("df1");
  try {
    const live0 = P.liveScript();
    const r = await runOne(P, TIKTOK_LATER + ".");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "done", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    const d = draftOf(P);
    assert.ok(d && d.version && d.version !== v0, "no draft was saved: " + JSON.stringify(d));
    assert.equal(liveVersion(P), v0, "an edit moved the pointer under draft-first");
    assert.equal(P.liveScript(), live0, "an edit uploaded the live script under draft-first");
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0, "an edit wrote the live sidecar under draft-first");
    assert.equal(P.previewScript(), d.version, "the draft's preview script was not uploaded under its own name");
    assert.equal(P.page("visit.tsx").includes(TT_LATER), true, "the editable copy does not hold the draft's change");
    const body = JSON.parse(job.result.body);
    assert.deepEqual([body.checks && body.checks.published, body.checks && body.checks.draft, body.checks && body.checks.version], [false, true, d.version], "the job's answer does not say the change is saved as a draft and not published: " + JSON.stringify(body.checks));
  } finally { await finish(P, compiler, siteTurn, null); }
});

test("DF2 PUBLISH RELEASES EXACTLY THE APPROVED VERSION — the owner approves draft D1; a later edit saves D2 before the click; Publish D1 makes D1 live (pointer and script), D2 stays the draft, unpublished; a version never saved as a draft is refused", async () => {
  const { P, compiler, siteTurn, v0 } = await draftSite("df2");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    // THE OWNER LOOKS AT D1 — then another change lands before they click.
    await runOne(P, TIKTOK + ".");
    const d2 = draftOf(P).version;
    assert.notEqual(d2, d1, "the later edit did not save a later draft");
    assert.equal(liveVersion(P), v0);
    const bogus = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: "01790000000000-zzzzzz" });
    assert.equal(bogus.status, 409, "a version never saved as a draft was published: " + JSON.stringify(bogus.body));
    assert.equal(liveVersion(P), v0);
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: d1 });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(liveVersion(P), d1, "Publish did not make the approved version live");
    assert.equal(P.liveScript(), d1, "the live script is not the approved version's");
    assert.equal(draftOf(P).version, d2, "the later draft was lost or published by the click");
    // A STAGED VERSION THAT WAS NEVER SAVED AS A DRAFT (the one published
    // before draft-first) is not publishable through this door.
    const old = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: v0 });
    assert.equal(old.status, 409, "a staged version never saved as a draft was published: " + JSON.stringify(old.body));
    assert.equal(liveVersion(P), d1);
    assert.equal(pub.body.state.state, "saved", "the later draft is not shown as saved and unpublished: " + JSON.stringify(pub.body.state));
    assert.equal(P.page("visit.tsx").includes(TT_TO) && !P.page("visit.tsx").includes(TT_LATER), true, "Publish rewrote the editable copy, losing the later draft");
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.status, st.body.state, st.body.live, st.body.draft], [200, "saved", d1, d2]);
  } finally { await finish(P, compiler, siteTurn, null); }
});

test("DF3 A TASK RUNNING AT THE CLICK IS NOT IN THE PUBLICATION — an edit is held before it saves; the owner publishes the current draft meanwhile; the held edit then completes: the live site is the approved version, the held edit's result is the new draft", async () => {
  const { P, compiler, siteTurn, v0 } = await draftSite("df3");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    let pub = null;
    let during = null;
    P.beforePut((k) => k === DRAFT(P) && inside("saveDraftRecord"), async () => {
      during = await call(P, "GET", "/api/site/" + P.slug + "/draft");
      pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: d1 });
    });
    await runOne(P, TIKTOK + ".");
    assert.ok(pub, "the second edit's draft save was never held");
    assert.equal(during.body.state, "processing", "a running task was not shown as still processing: " + JSON.stringify(during.body));
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(liveVersion(P), d1, "the publication is not the approved version");
    assert.equal(P.liveScript(), d1);
    const d2 = draftOf(P).version;
    assert.notEqual(d2, d1, "the running edit's result did not become a later draft");
    assert.notEqual(liveVersion(P), d2, "the running edit slipped into the publication");
  } finally { await finish(P, compiler, siteTurn, null); }
});

test("DF4 NO AUTOMATIC PATH PUBLISHES — under draft-first a lost-upload recovery uploads nothing, the takeover repair keeps the draft's editable copy (never the live version's), and the script sweep only ever restores the published version", async () => {
  const { P, compiler, siteTurn, v0 } = await draftSite("df4");
  let C = null;
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    const n = P.uploads().filter((u) => !String(u.name).startsWith("draft-")).length;
    // THE TAKEOVER REPAIR: the draft's copy is what the editable copy must match.
    C = await siteTurn.tryTurn(P.env, P.slug, "job:c:o3", "c");
    const st = await P.run(() => siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: C.owner, fence: { gen: C.gen } }));
    assert.equal(st.ok, true, JSON.stringify(st));
    assert.equal(P.page("visit.tsx").includes(TT_LATER), true, "the repair put the editable copy back to the live version, erasing the draft");
    await siteTurn.giveTurn(P.env, P.slug, C); C = null;
    // THE SWEEP: notes or none, it can only follow the pointer — the published version.
    P.advance(6 * 60 * 1000);
    await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.equal(liveVersion(P), v0);
    assert.equal(P.liveScript(), v0, "an automatic path made the draft live");
    assert.equal(P.uploads().filter((u) => !String(u.name).startsWith("draft-")).length, n, "an automatic path uploaded a live script");
    assert.notEqual(liveVersion(P), d1);
  } finally { await finish(P, compiler, siteTurn, C); }
});

test("DF5 THE DRAFT'S PREVIEW — its address serves the draft script with the preview header, a wrong token is 404, and a live address never forwards the preview header to a live script", async () => {
  const { P, compiler, siteTurn } = await draftSite("df5");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d = draftOf(P);
    assert.match(d.preview, /^[0-9a-f]{12}$/);
    const { default: worker } = await import("../worker.js");
    const get = (host, path, headers = {}) => P.run(() => worker.fetch(new Request("https://" + host + path, { headers }), P.env, { waitUntil() {}, passThroughOnException() {} }));
    const ok = await get(P.slug + "--draft-" + d.preview + ".gofarther.app", "/visit");
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("x-robots-tag"), "noindex");
    const last = P.dispatched().at(-1);
    assert.deepEqual([last.name, last.preview], ["draft-" + P.slug, "1"], "the preview did not reach the draft script with its header");
    const bad = await get(P.slug + "--draft-000000000000.gofarther.app", "/visit");
    assert.equal(bad.status, 404, "a wrong preview token was served");
    await get(P.slug + ".gofarther.app", "/visit", { "x-site-preview": "1" });
    const liveHit = P.dispatched().filter((x) => x.name === "site-" + P.slug).at(-1);
    assert.ok(liveHit, "the live address dispatched nothing — the observer is dead");
    assert.equal(liveHit.preview, null, "a visitor's preview header reached the live script");
  } finally { await finish(P, compiler, siteTurn, null); }
});

test("DF6 EVERY ACTIVATION A TASK REACHES CARRIES THE DRAFT GATE — of the activation call sites, only the owner's Publish (publishDraft) and the owner's version restore (restoreVersion) activate without `asDraft`; the edit/add-on publication and the build pass it", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const sites = [...src.matchAll(/await activateBuild\(/g)].map((m) => {
    const fn = src.lastIndexOf("\nasync function ", m.index);
    const name = /\nasync function ([A-Za-z0-9_]+)/.exec(src.slice(fn, fn + 80))[1];
    const call = src.slice(m.index, src.indexOf("\n  });", m.index) > 0 ? src.indexOf("});", m.index) : m.index + 400);
    return { name, gated: /asDraft: toDraft \? saveAsDraft : null,/.test(call) };
  });
  assert.equal(sites.length, 4, "the activation call sites moved — rescope this: " + JSON.stringify(sites));
  const ungated = sites.filter((x) => !x.gated).map((x) => x.name).sort();
  assert.deepEqual(ungated, ["publishDraft", "restoreVersion"], "an activation a task reaches is not behind the draft gate: " + JSON.stringify(sites));
  for (const x of sites.filter((y) => y.gated)) assert.ok(["recompileAndPublish", "buildAndPublishPages"].includes(x.name), x.name);
});

// ── ABSENT KEYS HELD IN THE STORE, AND UNDO WITHOUT DELETE (2026-10-15, ─────
// after Codex's third review). Codex reproduced it with `kit.json` and the
// draft record: the key starts absent; A pauses inside its fenced write
// immediately before the conditional PUT; A's turn lapses; B takes it and its
// takeover completes; A resumes and its create-if-absent lands, with A's
// older fence. Driven here through the Worker's own functions.
import { saveDraftRecord, readDraft } from "../site-draft.mjs";
import { isHeldObject } from "../site-builds.mjs";
const KIT = (P) => "source/" + P.slug + "/kit.json";

// HELD BY ITS METADATA, as a fenced write reads it (a `head` carries no body).
async function heldBy(P, key, gen) {
  const o = await P.env.SITES_BUCKET.head(key);
  return !!o && isHeldObject(o) && String(o.customMetadata && o.customMetadata.fence) === String(gen);
}

test("TA3 AN ABSENT KIT, A STALE CREATE — A's fenced write of `kit.json` pauses immediately before its create; its turn lapses; B takes it and completes its takeover: A's create is refused by the store, and the kit is held absent under B's fence", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("ta3"), pages: PAGES2, beside: true });
  let B = null;
  try {
    P.objects.delete(KIT(P));
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    let paused = false;
    P.beforePut((k) => k === KIT(P) && inside("fencedPut") && !paused, async () => {
      paused = true;
      assert.equal(P.readObj(KIT(P)), null, "the kit was there before A's create — not this case");
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await P.run(() => siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } }));
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
    });
    let err = null;
    try { await siteTurn.fencedPut(P.env, KIT(P), JSON.stringify([{ path: "src/stale.ts", source: "STALE" }]), { fence: { gen: A.gen } }); }
    catch (e) { err = e; }
    assert.ok(paused, "A's create was never paused");
    assert.equal(err && err.code, "TURN_FENCED", "A's create landed after the turn passed to B: " + P.readObj(KIT(P)));
    assert.doesNotMatch(String(P.readObj(KIT(P))), /STALE/, "A's stale kit landed");
    assert.ok(await heldBy(P, KIT(P), B.gen), "the kit is not held absent under B's fence: " + JSON.stringify([P.readObj(KIT(P)), P.metaOf(KIT(P))]));
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TA4 AN ABSENT DRAFT RECORD, A STALE FIRST SAVE — A saves its draft through its fenced deps and pauses immediately before the create; its turn lapses; B takes it and completes its takeover: A's save is refused (create, then the read-again write), no draft names A's version, and the record is held under B's fence", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("ta4"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const DRAFT_K = "drafts/" + P.slug + ".json";
    assert.equal(P.readObj(DRAFT_K), null);
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    let paused = false;
    P.beforePut((k) => k === DRAFT_K && !paused, async () => {
      paused = true;
      const took = await lapseAndTake(P, siteTurn); B = took.B;
      const st = await P.run(() => siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } }));
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
    });
    const depsA = siteTurn.fencedBuildDeps(P.env, P.slug, { gen: A.gen });
    let err = null;
    try { await saveDraftRecord(depsA, P.slug, { version: "01790000000999-staled" }); } catch (e) { err = e; }
    assert.ok(paused, "A's save was never paused");
    assert.equal(err && err.code, "TURN_FENCED", "A's draft save was not refused: " + P.readObj(DRAFT_K));
    const { draft } = await readDraft({ get: (k) => P.env.SITES_BUCKET.get(k) }, P.slug);
    assert.equal(draft, null, "a draft names A's stale version: " + JSON.stringify(draft));
    assert.ok(await heldBy(P, DRAFT_K, B.gen), "the draft record is not held under B's fence");
    // AND THE HOLDER CAN WRITE IT: the held record is no obstacle to B.
    const ok = await saveDraftRecord(siteTurn.fencedBuildDeps(P.env, P.slug, { gen: B.gen }), P.slug, { version: "01790000001000-bnewer" });
    assert.equal(ok.ok, true, "B could not save its own first draft over the held record: " + JSON.stringify(ok));
    assert.equal((await readDraft({ get: (k) => P.env.SITES_BUCKET.get(k) }, P.slug)).draft.version, "01790000001000-bnewer");
  } finally { await finish(P, compiler, siteTurn, B); }
});

test("TA5 EVERY ABSENT GUARDED KEY IS HELD AT TAKEOVER — the head marker, sidecar, source, parts, kit and draft record absent: B's stamp holds each under its fence; the live marker alone stays absent (a held marker would read as live to every site script)", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("ta5"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const keys = ["source/" + P.slug + "/head.json", "sitemeta/" + P.slug + ".json", "source/" + P.slug + "/pages.json", "source/" + P.slug + "/parts.json", KIT(P), "drafts/" + P.slug + ".json"];
    for (const k of [...keys, LIVE(P)]) P.objects.delete(k);
    B = await siteTurn.tryTurn(P.env, P.slug, "job:b:o2", "b");
    await P.run(() => siteTurn.stampFences(P.env, P.slug, { gen: B.gen }));
    for (const k of keys) assert.ok(await heldBy(P, k, B.gen), k + " was left absent by the takeover: " + JSON.stringify([P.readObj(k), P.metaOf(k)]));
    assert.equal(P.readObj(LIVE(P)), null, "the takeover created the live marker — a held marker reads as live");
    // A SECOND HOLDER RESTAMPS THEM AND THEY STAY HELD (absence, not content).
    await siteTurn.giveTurn(P.env, P.slug, B);
    const C = await siteTurn.tryTurn(P.env, P.slug, "job:c:o3", "c"); B = C;
    await P.run(() => siteTurn.stampFences(P.env, P.slug, { gen: C.gen }));
    for (const k of keys) assert.ok(await heldBy(P, k, C.gen), k + " lost its held form on a restamp");
  } finally { await finish(P, compiler, siteTurn, B); }
});

// ── RECOVERY UPLOADS ARE THEMSELVES RECOVERABLE (2026-10-15, after Codex's ──
// third review). An alignment, the takeover repair and the sweep each upload
// the pointer's script; none of those uploads had a note, so a repair that
// stopped after an upload left nothing to find. Codex: B and C staged, C
// live, the pointer at B; alignment begins and uploads B; the pointer moves
// back to C before B's upload takes effect; the repair stopped; final state
// pointer C, live script B, no notes, and the sweep ten minutes later found
// nothing. An accepted upload takes effect later (`deferLanding`): the probe
// still shows C while B is the last upload accepted.
const SIX_MIN = 6 * 60 * 1000;

test("TJ1 CODEX'S ALIGNMENT, A DELAYED UPLOAD — C live, the pointer at B; the alignment uploads B, which is accepted but not yet serving, and the pointer moves back to C: the alignment does not settle on the probe alone — it sends C after B's answer — and once B takes effect the live script is still C", async () => {
  const { P, compiler, siteTurn, v0: B, v1: C } = await twoVersions("tj1");
  try {
    setPointer(P, B);
    const slow = P.deferLanding();
    P.afterUpload(async () => { setPointer(P, C); });
    const a = await P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    slow.release();
    assert.equal(P.liveScript(), C, "B's delayed upload left the live script off the pointer: " + JSON.stringify(P.uploads().map((u) => u.version)));
    assert.equal(a.aligned, true, JSON.stringify(a));
    assert.deepEqual(NOTES(P), [], "a settled alignment left its note");
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TJ2 AN ALIGNMENT WHOSE ANSWER IS LOST — the alignment's upload lands and its answer is lost; the pointer then moves: the alignment leaves a note, the sweep leaves it while it is young and settles it once stale, putting the pointer's script up", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj2");
  try {
    setPointer(P, v0);
    P.afterUpload(async () => { throw new Error("connection reset"); });
    const a = await P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    // SEEN ON THE POINTER NOW, BUT AN UPLOAD WHOSE ANSWER WAS LOST MAY STILL
    // TAKE EFFECT LATER: its note is kept for the sweep.
    assert.equal(a.answered, false, "a lost answer read as answered: " + JSON.stringify(a));
    assert.equal(NOTES(P).length, 1, "the alignment's upload left no note");
    setPointer(P, v1);
    assert.deepEqual(await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() })), { sites: 0, settled: 0 });
    P.advance(SIX_MIN);
    const s = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s, { sites: 1, settled: 1 }, JSON.stringify(s));
    assert.equal(P.liveScript(), v1);
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TJ3 AN ALIGNMENT THAT DIES AFTER ITS UPLOAD — the alignment uploads v0 while the pointer moves to v1 and never runs again: its note was written before the upload, and the cron tick's sweep puts v1's script back with no customer request", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj3");
  try {
    setPointer(P, v0);
    P.beforeUpload(async () => { setPointer(P, v1); });
    let landed = false;
    P.afterUpload(() => { landed = true; return new Promise(() => {}); });
    P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    for (let i = 0; i < 200 && !landed; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.ok(landed, "the alignment's upload never landed");
    assert.equal(P.liveScript(), v0, "not this case: the stale upload is not live");
    assert.equal(NOTES(P).length, 1, "the dead alignment left no note");
    P.advance(SIX_MIN);
    const s = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s, { sites: 1, settled: 1 }, JSON.stringify(s));
    assert.equal(P.liveScript(), v1, "the sweep did not put the pointer's script back");
    assert.deepEqual(NOTES(P), []);
  } finally { compiler.uninstall(); }
});

test("TJ4 THE TAKEOVER REPAIR, ANSWER LOST AND DELAYED — a new holder finds the live script off the pointer; its repair upload lands late with its answer lost: the repair leaves a note, and the sweep settles it once stale; the live script ends on the pointer", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj4");
  let B = null;
  try {
    setPointer(P, v0);
    const slow = P.deferLanding();
    P.afterUpload(async () => { throw new Error("connection reset"); });
    B = await siteTurn.tryTurn(P.env, P.slug, "job:b:o2", "b");
    const st = await P.run(() => siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } }));
    assert.equal(st.ok, true, JSON.stringify(st));
    assert.equal(NOTES(P).length, 1, "the takeover repair's upload left no note");
    // THE POINTER MOVES ON, AND THE REPAIR'S UPLOAD TAKES EFFECT AFTER IT.
    setPointer(P, v1);
    slow.release();
    assert.equal(P.liveScript(), v0, "not this case: the late upload is not live");
    P.advance(SIX_MIN);
    const s = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s, { sites: 1, settled: 1 }, JSON.stringify(s));
    assert.equal(P.liveScript(), v1);
    assert.deepEqual(NOTES(P), []);
  } finally { if (B) await siteTurn.giveTurn(P.env, P.slug, B); await P.settle(); compiler.uninstall(); }
});

test("TJ5 THE SWEEP'S OWN UPLOAD, ANSWER LOST — a stale note for a site off its pointer; the sweep's upload loses its answer: the notes stay (nothing settled), and the next tick settles them", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj5");
  try {
    setPointer(P, v0);
    P.afterUpload(async () => { throw new Error("connection reset"); });
    await P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    assert.equal(NOTES(P).length, 1);
    setPointer(P, v1);
    P.advance(SIX_MIN);
    P.afterUpload(async () => { throw new Error("connection reset"); });
    const s1 = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s1, { sites: 1, settled: 0 }, "a sweep whose own answer was lost settled: " + JSON.stringify(s1));
    assert.equal(NOTES(P).length, 1, "the sweep took notes away without settling");
    P.advance(3 * 60 * 1000);
    const s2 = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s2, { sites: 1, settled: 1 }, JSON.stringify(s2));
    assert.equal(P.liveScript(), v1);
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TJ6 THE SWEEP'S OWN UPLOAD, ACCEPTED AND NOT YET SERVING — the sweep puts the pointer's script up but it is not serving at once: the sweep does not settle on its own upload's answer (the notes stay); once serving, the next tick settles", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj6");
  try {
    setPointer(P, v0);
    P.afterUpload(async () => { throw new Error("connection reset"); });
    await P.run(() => siteTurn.alignLiveScript(P.env, P.slug));
    setPointer(P, v1);
    P.advance(SIX_MIN);
    const slow = P.deferLanding();
    const s1 = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s1, { sites: 1, settled: 0 }, JSON.stringify(s1));
    assert.equal(NOTES(P).length, 1);
    slow.release();
    P.advance(3 * 60 * 1000);
    const s2 = await P.run(() => siteTurn.runScriptPendingSweep(P.env, { now: P.now() }));
    assert.deepEqual(s2, { sites: 1, settled: 1 }, JSON.stringify(s2));
    assert.equal(P.liveScript(), v1);
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TJ7 A PUBLICATION'S DELAYED UPLOAD AFTER AN EARLIER RECONCILIATION — v0's publication is accepted but not yet serving and its answer comes back; the pointer has moved to v1 meanwhile and the probe already shows v1: the follow still sends v1 after v0's answer, so v0 taking effect later cannot win", async () => {
  const { P, compiler, siteTurn, v0, v1 } = await twoVersions("tj7");
  try {
    setPointer(P, v0);
    const slow = P.deferLanding();
    P.afterUpload(async () => { setPointer(P, v1); });
    const r = await P.run(() => siteTurn.putSiteWorker(P.env, P.slug, { ok: true, code: stagedScript(P, v0), build: "" }, { version: v0 }));
    slow.release();
    assert.equal(P.liveScript(), v1, "the delayed upload won over the pointer: " + JSON.stringify(P.uploads().map((u) => u.version)));
    assert.equal(r.follow.settled, true, JSON.stringify(r.follow));
    assert.deepEqual(NOTES(P), []);
  } finally { await P.settle(); compiler.uninstall(); }
});

test("TA6 A HELD KEY IS ABSENT TO ITS HOLDER'S OWN \"ONLY IF ABSENT\" — after B's stamp holds the kit, B's fenced create-if-absent writes it, and so does an unfenced one; a stale holder's is still refused", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("ta6"), pages: PAGES2, beside: true });
  let B = null;
  try {
    P.objects.delete(KIT(P));
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    await siteTurn.giveTurn(P.env, P.slug, A);
    B = await siteTurn.tryTurn(P.env, P.slug, "job:b:o2", "b");
    await P.run(() => siteTurn.stampFences(P.env, P.slug, { gen: B.gen }));
    assert.ok(await heldBy(P, KIT(P), B.gen));
    let stale = null;
    try { stale = await siteTurn.fencedPut(P.env, KIT(P), "[]", { onlyIf: { etagDoesNotMatch: "*" }, fence: { gen: A.gen } }); } catch (e) { stale = e; }
    assert.ok(stale && stale.code === "TURN_FENCED", "a stale holder's create-if-absent over the held kit was not refused: " + JSON.stringify(stale));
    const put = await siteTurn.fencedPut(P.env, KIT(P), JSON.stringify([{ path: "src/a.ts", source: "B" }]), { onlyIf: { etagDoesNotMatch: "*" }, fence: { gen: B.gen } });
    assert.ok(put, "the holder's create-if-absent over its own held key was refused");
    assert.match(P.readObj(KIT(P)), /"B"/);
    assert.equal(P.metaOf(KIT(P)).held, undefined, "real content kept the held marker");
    // UNFENCED, THE SAME RULE (a job not running beside others).
    P.writeObj("drafts/" + P.slug + ".json", '{"held":"absent"}');
    P.objects.get("drafts/" + P.slug + ".json").customMetadata = { held: "absent" };
    const base = siteTurn.fencedBuildDeps(P.env, P.slug, null);
    const made = await base.put("drafts/" + P.slug + ".json", "{}", "application/json", { etagDoesNotMatch: "*" });
    assert.ok(made, "an unfenced create-if-absent over a held key was refused");
  } finally { await finish(P, compiler, siteTurn, B); }
});
