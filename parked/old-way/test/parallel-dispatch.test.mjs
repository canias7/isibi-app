// PARKED (2026-11-03, park-old-way): the old-way half of test/parallel-dispatch.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE JOB BEFORE ITS PREPARATIONS (2026-10-09, diagnosing run 117).
//
// What run 117 showed, from its saved request views and the job rows (all
// read-only): at acceptance (23:07:35.2) part 0's job was filed and parts 1
// and 2 claimed for preparation. The three queue messages were then processed
// strictly one after another: part 1's preparation 23:07:40.2–23:08:08.2, part
// 2's 23:08:11.4–23:08:24.4, and only then the job, whose consumer fired it at
// 23:08:28.4 (its trace's deadline) — 50 s after it was filed — so its
// execution (23:08:32.7–23:08:57.8) began after every preparation had ended.
// The driver sent the preparations BEFORE it filed the job, so a queue that
// delivers one message at a time ran the job last. A consumer that fires a job
// into the site's container returns in seconds, so the job sent first runs
// beside every preparation delivered after it.
//
// This file drives the REAL scheduling path (`advanceRequest` through the
// routing route, the real queue consumer) on a queue that delivers in order,
// one message at a time, with a fired job running beside the next delivery —
// the platform's behaviour in run 117. ⚠ Supplied model answers only.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { EDIT_JOB_KIND } from "../../../builder/edit-job.mjs";
import { overlapVerdict } from "../../../scripts/canary-requests.mjs";

blockNetwork();

const slugOf = (k) => "dp-" + k + "-" + Math.random().toString(16).slice(2, 8);
const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT_TT }];
const PHOTO = "make a photo of a sourdough loaf for the home page";
const MESSAGE = "Change our TikTok link on the Visit page to @harbourloaf, and " + PHOTO + ".";
const ROUTE = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [PHOTO], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }] },
  { intent: "edit", layer: "picture", page: "/" },
];
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const later = (ms) => new Promise((ok) => setTimeout(ok, ms));
const isJob = (m) => m && m.body && m.body.kind === EDIT_JOB_KIND;

/**
 * THE QUEUE AS RUN 117 MET IT: in order, one delivery at a time; a job's
 * delivery is fired into the site's container and runs beside what follows
 * (its consumer returns once fired), everything else is waited for.
 */
async function serialQueue(P, { max = 80 } = {}) {
  const fired = [];
  for (let n = 0; n < max && P.queue.length; n++) {
    const m = P.queue.shift();
    if (isJob(m)) { fired.push(deliver(P, m)); await later(5); continue; }
    await deliver(P, m);
  }
  await Promise.all(fired);
}

async function press() {
  const compiler = installCompiler();
  // MODEL LATENCIES, SUPPLIED: the text step answers in 400 ms, the picture
  // step in 60 ms. Neither waits on the other.
  const P = platform({
    slug: slugOf("fifo"), pages: PAGES, images: true, progress: true,
    answers: {
      route: ROUTE,
      choose_pictures: async () => { await later(60); return PICTURE; },
      [T.text]: async (args) => { await later(400); return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }; },
    },
  });
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const order = P.queue.map((m) => m.body.kind);
    for (let i = 0; i < 6 && P.queue.length; i++) await serialQueue(P);
    const { rec } = await settle(P, r.key);
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    await P.settle();
    assert.deepEqual(P.unexpected, []);
    return { order, rec, view: v.body.request, key: r.key, P };
  } finally { P.close(); compiler.uninstall(); }
}

test("DISPATCH ORDER: at acceptance the job is queued before the preparations claimed beside it", async () => {
  const { order } = await press();
  const job = order.indexOf(EDIT_JOB_KIND), prep = order.indexOf("request-prep");
  assert.ok(job >= 0 && prep >= 0, JSON.stringify(order));
  assert.ok(job < prep, "a preparation was queued ahead of the job it is meant to run beside: " + JSON.stringify(order));
});

test("RUN 117'S QUEUE, OFFLINE: in order, one at a time, a fired job beside the next delivery — the prepared picture step runs while the text job executes, by the view's own intervals; both changes land, each job charged once", async () => {
  const { rec, view, key } = await press();
  assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  const v = overlapVerdict([{ sent: true, request: { key, final: view } }]);
  assert.equal(v.ok, true, v.why + " " + JSON.stringify(view.parts.map((p) => ({ n: p.n, prepRun: p.prepRun, runs: p.runs }))));
  assert.deepEqual(v.overlaps.map((o) => [o.prepPart, o.runPart]), [[1, 0]]);
});

// ── EARLIER ATTEMPTS KEPT (the second evidence gap) ──────────────────────────

import { planParts, newRequest, nextStep, noteJobId, notePrepared, takePrep, prepRunsOf, requestView, PREP_FRESH_MS, PREP_PAST_KEPT } from "../../../builder/request.mjs";

const HELD = ["make a photo of bread for the home page"];
const MSG = "Change our TikTok link on the Visit page, and " + HELD[0] + ".";
function onePrepared() {
  const routed = { intent: "edit", layer: "text", page: "/visit", alsoAsked: HELD.slice(), targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }] };
  const planned = planParts(MSG, routed);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  return newRequest({ key: "rqdsp0000000000001", uid: "u1", slug: "fold-lane", message: MSG, accepted: routed, parts: planned.parts });
}
