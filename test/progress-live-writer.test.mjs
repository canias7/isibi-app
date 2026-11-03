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
async function heldRun(kind, { storeFails = false, latePages = false } = {}) {
  // THE PAGES MILESTONE'S WRITE, HELD UNTIL AFTER THE FIRST LINE (`latePages`, PLW 5).
  const pagesGate = gate();
  let pagesHeld = false;
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
    if (latePages && !pagesHeld && /\.progress\.json$/.test(k) && marksIn(v).includes("pages")) { pagesHeld = true; await pagesGate.p; }
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
  // THE PAGES MILESTONE HAS LANDED BEFORE THE FIRST LINE (2026-10-15). The job
  // does not wait for its milestones (`mark` only queues the record's write),
  // so the photo call can begin before the "pages" milestone is in the record.
  // These cases read the line at the photo call as the one that tells the
  // pages, so they wait for it, as they wait for the publish milestone below;
  // before this, a full suite under load once delivered the first line early
  // and the pages fact rode with the photograph's (seen 2026-10-15 on
  // `bb1c1f31`, reproduced exactly by PLW 5, which holds that write on purpose).
  if (!latePages) await until(() => (P.progressOf(job().id) || { marks: [] }).marks.some((m) => m.stage === "pages"), "the pages milestone landing");
  lines.atPhoto = await deliverWriter();
  if (latePages) pagesGate.open();
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

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
