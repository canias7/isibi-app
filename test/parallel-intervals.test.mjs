// THE RECORDED INTERVALS A REQUEST'S VIEW SERVES (2026-10-09, after Codex's
// review of ac24aece: a status seen beside another — "prepared" beside
// "queued" — is no evidence that two things ran at once). Through the REAL
// Worker (`test/fixtures/request-flow.mjs`, PROGRESS_REPLIES on): a part's
// preparation keeps its step's own interval and model calls
// (`prepRun.step`), each run job its execution from its progress record's
// opening to its close (`runs`), and the canary's `overlapVerdict` judges
// those alone — passing the owner's P1 overlap, refusing the same message run
// one after the other, and refusing a preparation that only routed.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: nothing here shows what a real model answers or
// how long it takes.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { overlapVerdict } from "../scripts/canary-requests.mjs";
import { readPrepStep, prepRunOf } from "../builder/request.mjs";

blockNetwork();

const slugOf = (k) => "iv-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ progress: true, ...opts });
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}

const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT_TT }];
const MESSAGE = "Change our TikTok link on the Visit page to @harbourloaf, and make a photo of a sourdough loaf for the home page.";
const PHOTO = "make a photo of a sourdough loaf for the home page";
const ROUTE = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [PHOTO], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }] },
  { intent: "edit", layer: "picture", page: "/" },
];
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const viewOf = async (P, key) => {
  const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.request;
};
const asSteps = (key, final) => [{ sent: true, request: { key, final } }];

/**
 * THE MESSAGE, with part 0's job held inside its model call until the case
 * opens it. `together`: part 1's preparation is delivered while part 0's job
 * is held (the owner's P1); otherwise only once part 0's job has ended.
 */
async function press({ together }) {
  let open = null;
  const gate = new Promise((ok) => { open = ok; });
  return withPlatform({
    slug: slugOf(together ? "both" : "seq"), pages: PAGES, images: true,
    answers: {
      route: ROUTE,
      choose_pictures: PICTURE,
      [T.text]: async (args) => {
        await Promise.race([gate, new Promise((ok) => setTimeout(ok, 4000))]);
        await new Promise((ok) => setTimeout(ok, 30));
        return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // (With progress on, the request's own progress task is queued too; it is
    // left to the queue, as the real one runs it beside.)
    const prepMsgs = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobMsgs = P.queue.filter((m) => m.body.kind !== "request-prep" && m.body.kind !== "edit-progress");
    assert.equal(prepMsgs.length, 1);
    assert.equal(jobMsgs.length, 1, JSON.stringify(P.queue.map((m) => m.body.kind)));
    for (const m of [...prepMsgs, ...jobMsgs]) P.queue.splice(P.queue.indexOf(m), 1);
    const running = deliver(P, jobMsgs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    if (together) {
      await new Promise((ok) => setTimeout(ok, 20));
      await deliver(P, prepMsgs[0]);
      open();
      await running;
    } else {
      open();
      await running;
      await new Promise((ok) => setTimeout(ok, 20));
      await deliver(P, prepMsgs[0]);
    }
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
    return { r, view: await viewOf(P, r.key), rec };
  });
}

test("THE VIEW CARRIES THE INTERVALS: part 1's preparation with its step's own interval and model calls, each run job's execution from opening to close; and the verdict passes the P1 overlap on them alone", async () => {
  const { r, view } = await press({ together: true });
  const p0 = view.parts[0], p1 = view.parts[1];
  assert.ok(p1.prepRun && p1.prepRun.step, "the view carries no preparation step: " + JSON.stringify(p1.prepRun));
  const st = p1.prepRun.step;
  assert.ok(Number.isFinite(st.from) && Number.isFinite(st.to) && st.to >= st.from, JSON.stringify(st));
  assert.ok(st.from >= p1.prepRun.from && st.to <= p1.prepRun.to, "the step is not inside its preparation: " + JSON.stringify(p1.prepRun));
  assert.equal(st.calls, 1, "the step's model calls are not counted");
  assert.equal(p1.prepRun.outcome, "ready");
  assert.equal(p0.runs.length, 1);
  assert.ok(Number.isFinite(p0.runs[0].from) && Number.isFinite(p0.runs[0].to) && p0.runs[0].to > p0.runs[0].from, JSON.stringify(p0.runs));
  assert.ok(p1.runs.length >= 1, "the picture part's own job has no interval");
  // NO FACT OF A PREPARATION'S INSIDES IS SERVED (the record's owner and state stay on the server).
  assert.equal(JSON.stringify(view).includes("\"owner\""), false);
  const v = overlapVerdict(asSteps(r.key, view));
  assert.equal(v.ok, true, v.why);
  assert.deepEqual(v.overlaps.map((o) => [o.prepPart, o.runPart]), [[1, 0]]);
});

test("SEQUENTIAL, THE SAME MESSAGE: part 1's preparation delivered only after part 0's job ended — the view's intervals show it, and the verdict refuses", async () => {
  const { r, view } = await press({ together: false });
  const p0 = view.parts[0], p1 = view.parts[1];
  assert.ok(p1.prepRun && p1.prepRun.step, JSON.stringify(p1.prepRun));
  assert.ok(p1.prepRun.step.from >= p0.runs[0].to, "the control did not run one after the other: " + JSON.stringify({ step: p1.prepRun.step, run: p0.runs[0] }));
  const v = overlapVerdict(asSteps(r.key, view));
  assert.equal(v.ok, false);
  assert.match(v.why, /did not overlap another part's job/);
});

test("PROGRESS OFF: no interval is served, and the verdict says the evidence is missing — never a pass", async () => {
  const compiler = installCompiler();
  const P = platform({ progress: false, slug: slugOf("off"), pages: PAGES, images: true, answers: { route: ROUTE, choose_pictures: PICTURE, [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }) } });
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    await settle(P, r.key);
    const view = await viewOf(P, r.key);
    assert.ok(view.parts.every((p) => !p.runs), "runs were served with progress off");
    const v = overlapVerdict(asSteps(r.key, view));
    assert.equal(v.ok, false);
    assert.match(v.why, /missing evidence/);
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});

// ── ROUTING ONLY: P3's shared page, its routing prepared INSIDE the first job ──

const HOME_LINE_FROM = "Bread from the harbour, every morning.";
const HOME_LINE_TO = "Open from 8 every morning.";
const OPEN_LINE = "Change the opening line on the home page to say we open at 8";
const HEADING = "make the home page heading say Harbour Loaf Bakery";

test("ROUTING ONLY, BESIDE AN EXECUTING JOB: the second change to the same page has only its routing prepared, and that while the first change's job is inside its model call — the view shows the routing beside the job and no step, and the verdict refuses it as routing only", async () => {
  let open = null, inCall = null;
  const gate = new Promise((ok) => { open = ok; });
  const entered = new Promise((ok) => { inCall = ok; });
  await withPlatform({
    slug: slugOf("route"), pages: PAGES,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/", alsoAsked: [HEADING], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: ["page:/"] }] },
        { intent: "edit", layer: "text", page: "/" },
      ],
      [T.text]: async (args) => {
        if (String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + HEADING)) return { edits: [{ id: lineId(args, "index.tsx", "Harbour Loaf"), to: "Harbour Loaf Bakery" }] };
        inCall();
        await Promise.race([gate, new Promise((ok) => setTimeout(ok, 4000))]);
        return { edits: [{ id: lineId(args, "index.tsx", HOME_LINE_FROM), to: HOME_LINE_TO }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: OPEN_LINE + ", and " + HEADING + "." });
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const job = P.queue.filter((m) => m.body.kind !== "request-prep" && m.body.kind !== "edit-progress");
    assert.equal(prep.length, 1);
    assert.equal(job.length, 1);
    for (const m of [...prep, ...job]) P.queue.splice(P.queue.indexOf(m), 1);
    const running = deliver(P, job[0]);
    await entered;
    await new Promise((ok) => setTimeout(ok, 10));
    await deliver(P, prep[0]);
    await new Promise((ok) => setTimeout(ok, 10));
    open();
    await running;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"]);
    const view = await viewOf(P, r.key);
    const p1 = view.parts[1];
    assert.equal(p1.prepRun && p1.prepRun.outcome, "routed", JSON.stringify(p1.prepRun));
    assert.equal(p1.prepRun.step, null, "a routing-only preparation was served with a step");
    const run0 = view.parts[0].runs[0];
    assert.ok(p1.prepRun.from < run0.to && run0.from < p1.prepRun.to, "the control's routing did not run inside the first job: " + JSON.stringify({ prep: p1.prepRun, run0 }));
    const v = overlapVerdict(asSteps(r.key, view));
    assert.equal(v.ok, false);
    assert.equal(v.routingOnly.length, 1);
    assert.match(v.why, /only a routing ran beside another part's job/);
  });
});

test("readPrepStep and prepRunOf keep only a well-formed step: finite ends in order and a whole, non-negative count of model calls — anything else is no step, never a guessed one", () => {
  assert.deepEqual(readPrepStep({ from: 10, to: 20, calls: 2 }), { from: 10, to: 20, calls: 2 });
  assert.deepEqual(readPrepStep({ from: 10, to: 10, calls: 0 }), { from: 10, to: 10, calls: 0 });
  for (const bad of [null, "x", { from: 20, to: 10, calls: 1 }, { from: "10", to: 20, calls: 1 }, { from: 10, to: Infinity, calls: 1 }, { from: 10, to: 20, calls: 1.5 }, { from: 10, to: 20, calls: -1 }, { from: 10, to: 20 }, { from: NaN, to: 20, calls: 1 }]) {
    assert.equal(readPrepStep(bad), null, "accepted: " + JSON.stringify(bad));
  }
  assert.equal(prepRunOf({ prep: null }), null);
  assert.equal(prepRunOf({ prep: { seq: 1 } }), null, "an attempt never taken was given a run");
  assert.deepEqual(prepRunOf({ prep: { seq: 2, at: 4, startedAt: 5, endedAt: 9, outcome: "routed", step: { from: 7, to: 6, calls: 1 } } }), { seq: 2, sent: 4, from: 5, to: 9, outcome: "routed", step: null });
  assert.deepEqual(prepRunOf({ prep: { seq: 2, startedAt: 5, outcome: 3 } }), { seq: 2, sent: null, from: 5, to: null, outcome: null, step: null });
});

test("PROGRESS SWITCHED OFF AFTER THE RECORDS EXIST: the view serves no run interval (the records are the progress feature's, read only while it is on)", async () => {
  let open = null;
  const gate = new Promise((ok) => { open = ok; });
  await withPlatform({
    slug: slugOf("switch"), pages: PAGES, images: true,
    answers: { route: ROUTE, choose_pictures: PICTURE, [T.text]: async (args) => { await Promise.race([gate, new Promise((ok) => setTimeout(ok, 50))]); return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }; } },
  }, async (P) => {
    open();
    const r = await sendMessage(P, { message: MESSAGE });
    await settle(P, r.key);
    const on = await viewOf(P, r.key);
    assert.ok(on.parts[0].runs && on.parts[0].runs.length === 1, "the case shows nothing: no run was served while progress was on");
    delete P.env.PROGRESS_REPLIES;
    const off = await viewOf(P, r.key);
    assert.ok(off.parts.every((p) => !p.runs), "runs were served with progress off: " + JSON.stringify(off.parts.map((p) => p.runs)));
    P.env.PROGRESS_REPLIES = "on";
  });
});
