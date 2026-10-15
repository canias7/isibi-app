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
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
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

// ── IDENTICAL BYTES, CONTENT ETAGS (2026-10-15, Codex's reproduction) ───────
// R2 derives a single put's etag from the body's MD5, so the new holder's
// stamp — the same bytes, a new fence in the metadata — keeps the etag. A
// stale holder's write conditional on the etag alone then lands.
test("TF11 A STALE HOLDER PAUSED BEFORE ITS CONDITIONAL PUT, OVER AN IDENTICAL-BYTES STAMP — A reads the config and pauses immediately before its put; its turn lapses; B takes the turn and its takeover stamps the unchanged config; A resumes: refused, the CSS unchanged, and B's higher fence kept", async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const P = platform({ slug: slugOf("tf11"), pages: PAGES2, beside: true });
  let B = null;
  try {
    const before = P.readObj(CFG(P));
    const A = await siteTurn.tryTurn(P.env, P.slug, "job:a:o1", "a");
    const jobA = { id: "a", beside: { turn: A } };
    let paused = false;
    P.beforePut((k) => k === CFG(P) && (inside("patchSiteConfig") || inside("patchConfigFenced")), async () => {
      paused = true;
      const held = JSON.parse(P.readObj(TURN(P)));
      P.writeObj(TURN(P), JSON.stringify({ ...held, until: 0 }));
      B = await siteTurn.tryTurn(P.env, P.slug, "job:newer:o2", "newer");
      const etagBefore = (await P.env.SITES_BUCKET.head(CFG(P))).etag;
      const st = await siteTurn.ensureEditableState(P.env, P.slug, { turnOwner: B.owner, fence: { gen: B.gen } });
      assert.equal(st.ok, true, "B's takeover failed: " + JSON.stringify(st));
      assert.equal(P.readObj(CFG(P)), before, "B's takeover changed the config's bytes — this case is about a stamp of identical bytes");
      assert.equal((await P.env.SITES_BUCKET.head(CFG(P))).etag, etagBefore, "the store gave identical bytes a new etag: not R2's content etag");
      assert.equal(P.metaOf(CFG(P)).fence, String(B.gen));
    });
    const w = await siteTurn.patchSiteConfig(P.env, P.slug, null, { css: ".stale { color: red; }" }, siteTurn.jobFence(P.env, jobA));
    assert.ok(paused, "A's put was never paused");
    assert.equal(w.ok, false, "A wrote over B's stamp: " + JSON.stringify(w));
    assert.equal(P.readObj(CFG(P)), before, "A's stale CSS landed");
    assert.equal(P.metaOf(CFG(P)).fence, String(B.gen), "A replaced B's higher fence with its own lower one");
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
    P.beforePut((k) => k === LIVE(P) && inside("activateBuild"), async () => {
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
    assert.equal(P.readObj(SIDE(P)), B_HEAD, "the stale job wrote its sidecar over B's");
    assert.deepEqual(P.uploads().slice(mark).map((u) => u.version), [], "the stale job uploaded a script after the turn passed to B");
    assert.equal(P.liveScript(), v0);
  } finally { await finish(P, compiler, siteTurn, B); }
});
