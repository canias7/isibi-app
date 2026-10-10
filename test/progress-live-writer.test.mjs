// THE REAL QUEUED PROGRESS WRITER, WHILE THE ADD-ON JOB IS STILL RUNNING
// (2026-10-10, after Codex's review of f2ae6556).
//
// The earlier proof replayed a finished job's milestones through the writer's
// functions, because in this harness a job runs to its end before a queued
// writer task is delivered. These cases hold the job at three points with
// controlled, offline timing, and deliver the writer's queued tasks to the
// REAL queue consumer (`writeProgressLine`: claim, job-row check, the call,
// the commit) at each:
//   1. the photo service's call, held: the pages are written, the photograph
//      is still to make;
//   2. the publish milestone's write to the record, held (the job, which does
//      not wait for its milestones, goes on to its compile, held too): the
//      photographs milestone is the only one waiting;
//   3. the compile, still held, after the publish milestone landed: a later
//      line, while the job still runs.
// Each request the writer sends is kept whole (the context and the facts),
// so a case reads what the model was TOLD on every line.
//
// Five outcomes for the one photograph:
//   - REFUSED (fal's empty balance, 403): not made; every later line is told
//     so; the part ends partial with the photograph not made; the reply
//     writer is given it; nothing charged for it;
//   - STORAGE FAILURE (made, never stored): the purchase is kept as pending
//     work, never said as made or as not made; the frame waits; held part;
//   - UNCERTAIN (the call's answer lost): the same — pending, never bought
//     again;
//   - SUCCESSFUL PLACEMENT (control): made and placed, charged once, no line
//     told anything is not done.
//   - A THROWN IMAGE STEP is not reachable through this route offline (every
//     fault inside the purchase is caught per photograph); its facts are
//     shown from their real producers in `test/progress-missing-photo.test.mjs`
//     (MPH 10–12) and its wiring by a source guard.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF: the writer answers each fact as
// given. What these prove is what the writer's MODEL INPUT holds on every
// line written while the job runs, and that the code accepts only lines that
// list each fact in its own state. They prove nothing about a real model's
// wording.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, tick, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";

blockNetwork();

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Fold Lane</h1><p>Bread from the lane, every morning.</p></section>");
const VISIT = pageSrc("/visit", "<section><h1>Come to the bakery</h1><p>Open from seven.</p></section>");
const BENCH = "three bakers shaping loaves at a long wooden bench at night";
const ADD = "Add a Meet the Bakers page introducing the three of us who bake through the night, with a photograph of us shaping loaves at the bench.";
const BAKERS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/bakers')({ component: Page })\n"
  + "function Page(){ return <main><h1>Meet the Bakers</h1><SafeImage src=\"@@IMG:" + BENCH + "@@\" alt=\"three bakers at the bench\" ratio=\"4/3\" /><p>The three of us bake through the night.</p></main> }\n";

/** A gate a case opens once. */
function gate() { let open; const p = new Promise((r) => { open = r; }); return { p, open }; }
/** Wait until `cond()` holds, polling the event loop (bounded at 30 s of wall time), or fail. */
async function until(cond, what) {
  const end = Date.now() + 30000;
  while (Date.now() < end) { if (cond()) return; await new Promise((r) => setTimeout(r, 2)); }
  assert.fail("never came: " + what);
}
const marksIn = (v) => { try { return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v)).marks.map((m) => m.stage); } catch { return []; } };

const OUTCOME = {
  refused: () => new Response(JSON.stringify({ detail: "User is locked. Reason: Exhausted balance." }), { status: 403, headers: { "content-type": "application/json" } }),
  lost: () => { throw new TypeError("connection reset"); },
  made: () => null,
};

/**
 * One add-on, held at the three points; at each, every queued writer task for
 * the job is delivered to the real consumer. Answers the platform (open), the
 * writer's requests grouped by hold, the job and the final request record.
 */
async function heldRun(kind, { storeFails = false } = {}) {
  const g = { fal: gate(), pub: gate(), compile: gate() };
  const held = { fal: false, pub: false, compile: false };
  const texts = [];
  const compiler = installCompiler({ before: async () => { if (held.compile) return; held.compile = true; await g.compile.p; } });
  const P = platform({
    slug: "plw-" + kind + "-" + Math.random().toString(16).slice(2, 8),
    pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }],
    images: true, replies: true, progress: true, balance: 400,
    imageWith: async () => { held.fal = true; await g.fal.p; const o = OUTCOME[kind](); return o; },
    progressWith: async ({ text }) => { texts.push(text); return null; },
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["page", "photo"] },
      "add:page": { page: [{ path: "/bakers", name: "Meet the Bakers", purpose: "introduce the bakers", sections: ["a photograph"], components: ["card"] }] },
      "add:photo": { photo: [{ page: "/bakers", describe: BENCH, name: "bench" }] },
      [T.pages]: { pages: [{ path: "src/routes/bakers.tsx", source: BAKERS }] },
    },
  });
  // THE PUBLISH MILESTONE'S WRITE, HELD ONCE (the recorder retries it on its etag).
  const put0 = P.bucket.put.bind(P.bucket);
  P.bucket.put = async (k, v, ...rest) => {
    if (!held.pub && /\.progress\.json$/.test(k) && marksIn(v).includes("publish")) { held.pub = true; await g.pub.p; }
    return put0(k, v, ...rest);
  };
  if (storeFails) for (let i = 0; i < 3; i++) P.failPut((k) => k.startsWith("uploads/" + P.slug + "/"));
  const r = await sendMessage(P, { message: ADD });
  const running = settle(P, r.key);
  const job = () => P.jobsOf(r.key).find((j) => j.op === "addon");
  const deliverWriter = async () => {
    const id = job().id;
    const before = texts.length;
    for (let round = 0; round < 6; round++) {
      const tasks = P.queue.filter((m) => m.body && m.body.kind === "edit-progress" && m.body.id === id);
      if (!tasks.length) break;
      for (const t of tasks) P.queue.splice(P.queue.indexOf(t), 1);
      for (const t of tasks) await deliver(P, t);
    }
    return texts.slice(before);
  };
  const lines = {};
  await until(() => held.fal && job(), "the photo service's call");
  lines.atPhoto = await deliverWriter();
  const live = () => { const j = P.jobs.get(job().id); return !["done", "failed", "cancelled"].includes(j.state) && !j.published_at; };
  const runningAtPhoto = live();
  g.fal.open();
  await until(() => held.pub && held.compile, "the publish milestone's write and the compile");
  lines.atPhotos = await deliverWriter();
  g.pub.open();
  await until(() => (P.progressOf(job().id) || { marks: [] }).marks.some((m) => m.stage === "publish"), "the publish milestone landing");
  lines.atPublish = await deliverWriter();
  const runningAtPublish = live();
  g.compile.open();
  const { rec } = await running;
  return { P, compiler, r, job: job(), lines, rec, texts, runningAtPhoto, runningAtPublish };
}
const facts = (t) => [...t.matchAll(/^\[(f\d+)\] \(([a-z]+)\) (.*)$/gm)].map((m) => ({ id: m[1], state: m[2], text: m[3] }));
const ctxOf = (t) => t.split("WHAT HAS HAPPENED SINCE")[0];
const reserves = (P, id) => P.ledger.filter((e) => e.ref.startsWith(id + "#") && e.reason === "reserve");
const close = async (x) => { try { await x.P.settle(); assert.deepEqual(x.P.unexpected, [], "requests the stand-ins were not set up for"); } finally { x.compiler.uninstall(); } };

test("PLW 1 — REFUSED (an empty balance), WITH THE WRITER RUNNING DURING THE JOB: the line at the photo call says the photograph is still to make; the line at the photographs milestone is handed it NOT MADE; the later line, still during the job, is told it is NOT DONE; the part ends partial with the photograph not made, the page kept, the reply writer given it, and nothing charged for it", async () => {
  const x = await heldRun("refused");
  try {
    const { P, lines, job } = x;
    assert.equal(x.runningAtPhoto, true, "the job was not running at the photo call");
    assert.equal(x.runningAtPublish, true, "the later line was not written while the job ran (unfinished, unpublished)");
    // 1. AT THE PHOTO CALL.
    assert.equal(lines.atPhoto.length, 1, "no line was written at the photo call: " + lines.atPhoto.length);
    const f1 = facts(lines.atPhoto[0]);
    const toMake = f1.find((f) => f.text.includes(BENCH));
    assert.ok(toMake && toMake.state === "next" && /not on the page yet/.test(toMake.text), JSON.stringify(f1));
    assert.ok(!f1.some((f) => f.text.includes(BENCH) && f.state !== "next"), JSON.stringify(f1));
    // 2. AT THE PHOTOGRAPHS MILESTONE: handed as not made, and nothing else waiting.
    assert.equal(lines.atPhotos.length, 1, "no line at the photographs milestone");
    const f2 = facts(lines.atPhotos[0]);
    assert.deepEqual(f2.map((f) => f.state), ["notdone"], JSON.stringify(f2));
    assert.match(f2[0].text, /“three bakers shaping loaves at a long wooden bench at night” could not be made/);
    // 3. THE LATER LINE, DURING THE JOB: told it is not done, in its context.
    assert.equal(lines.atPublish.length, 1, "no later line during the job");
    const f3 = facts(lines.atPublish[0]);
    assert.ok(f3.every((f) => !f.text.includes(BENCH)), "the later batch repeated the photograph's fact: " + JSON.stringify(f3));
    assert.match(ctxOf(lines.atPublish[0]), /NOT DONE IN THIS WORK, AS IT STANDS[^]*“three bakers shaping loaves at a long wooden bench at night” could not be made/);
    assert.match(ctxOf(lines.atPublish[0]), /WHAT YOUR EARLIER UPDATES SAID, IN ORDER:/);
    // THE COMMITTED LINES ARE THE WRITER'S OWN (the record's).
    const pr = P.progressOf(job.id);
    assert.equal(pr.lines.length, 3, JSON.stringify(pr.lines));
    // THE OUTCOME: page kept, frame empty, part partial on code evidence.
    const bakers = P.page("bakers.tsx") || "";
    assert.match(bakers, /Meet the Bakers/);
    assert.match(bakers, /<SafeImage src=""/);
    assert.equal(x.rec.parts[0].status, "partial", JSON.stringify(x.rec.parts));
    assert.deepEqual(x.rec.parts[0].notDone, [{ what: BENCH, why: "photo-not-made" }]);
    // THE REPLY WRITER (a later model request) IS GIVEN IT.
    const given = P.replyLog.find((fs) => fs.some((f) => f.text.includes(BENCH)));
    assert.ok(given, "the reply writer was never told the photograph was not made: " + JSON.stringify(P.replyLog));
    assert.ok(given.some((f) => /couldn't be made/.test(f.text) && f.text.includes(BENCH)), JSON.stringify(given));
    // CHARGES: the addition's own reserve, nothing for the photograph (#5), one provider call.
    assert.deepEqual(reserves(P, job.id).filter((e) => e.ref.endsWith("#5")), []);
    assert.ok(reserves(P, job.id).length >= 1);
    assert.equal(P.imageLog.length, 1);
  } finally { await close(x); }
});

test("PLW 2 — STORAGE FAILURE (made, never stored): the photograph is kept as pending work — never said made, never said not made, never placed — on every line written during the job; the frame waits marked, the part is held on it, and the photograph is bought once", async () => {
  const x = await heldRun("made", { storeFails: true });
  try {
    const { P, lines, job } = x;
    const all = [...lines.atPhoto, ...lines.atPhotos, ...lines.atPublish].flatMap(facts).filter((f) => f.text.includes(BENCH));
    assert.ok(all.length >= 1, "no line spoke of the photograph");
    for (const f of all) assert.equal(f.state, "next", "the stored-failure photograph was stated as " + f.state + ": " + f.text);
    assert.ok(all.some((f) => /still being confirmed/.test(f.text)), JSON.stringify(all));
    for (const t of [...lines.atPhotos, ...lines.atPublish]) assert.doesNotMatch(ctxOf(t), /NOT DONE IN THIS WORK/, "a made photograph was listed as not done");
    assert.equal(x.rec.parts[0].status, "uncertain", JSON.stringify(x.rec.parts));
    assert.equal(x.rec.parts[0].why, "photos-pending");
    assert.match(P.page("bakers.tsx") || "", /pending-photo:/);
    assert.equal(P.imageLog.length, 1, "bought again");
    assert.ok(!(P.answerOf(job).notAdded || []).some((n) => n.why === "photo-not-made"), "a made photograph was told as not made");
  } finally { await close(x); }
});

test("PLW 3 — UNCERTAIN (the call's answer lost): pending on every line during the job, never made and never not made; never bought again; not charged", async () => {
  const x = await heldRun("lost");
  try {
    const { P, lines, job } = x;
    const all = [...lines.atPhoto, ...lines.atPhotos, ...lines.atPublish].flatMap(facts).filter((f) => f.text.includes(BENCH));
    for (const f of all) assert.equal(f.state, "next", f.text);
    for (const t of [...lines.atPhotos, ...lines.atPublish]) assert.doesNotMatch(ctxOf(t), /NOT DONE IN THIS WORK/);
    assert.equal(x.rec.parts[0].status, "uncertain", JSON.stringify(x.rec.parts));
    assert.equal(P.imageLog.length, 1);
    await tick(P);
    assert.equal(P.imageLog.length, 1, "a purchase nobody can tell was bought again");
    assert.deepEqual(reserves(P, job.id).filter((e) => e.ref.endsWith("#5")), []);
  } finally { await close(x); }
});

test("PLW 4 — CONTROL, SUCCESSFUL PLACEMENT: the photographs line is handed it made and placed (not published); no line is told anything is not done; the part is done; the photograph is charged once", async () => {
  const x = await heldRun("made");
  try {
    const { P, lines, job } = x;
    const f2 = facts(lines.atPhotos[0] || "");
    assert.deepEqual(f2.map((f) => f.state), ["prepared"], JSON.stringify(f2));
    assert.match(f2[0].text, /was made and put on the page\. Not published yet\./);
    for (const t of [...lines.atPhotos, ...lines.atPublish]) assert.doesNotMatch(ctxOf(t), /NOT DONE IN THIS WORK/);
    assert.equal(x.rec.parts[0].status, "done", JSON.stringify(x.rec.parts));
    assert.match(P.page("bakers.tsx") || "", /src="\/u\/[^"]+\.jpg"/);
    assert.equal(reserves(P, job.id).filter((e) => e.ref.endsWith("#5")).length, 1, "not charged once");
    assert.equal(P.imageLog.length, 1);
  } finally { await close(x); }
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
