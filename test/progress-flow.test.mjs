// PROGRESS MESSAGES THROUGH THE REAL WORKER (2026-10-06).
//
// Every case runs the real Worker on the stateful platform
// (`test/fixtures/request-flow.mjs`): the routing route, the queue consumer
// that runs each job and each progress task, the job poll, the request read and
// list, the two-minute cron and the job gateway — against an `edit_jobs` table
// with leases and cancels, a ledger, a bucket with etags and faults, and a
// queue a case delivers by hand. A case HOLDS a job mid-way (a designer that
// waits on the case) and delivers the progress task beside it, as the real
// queue runs a progress task while the job it narrates is still running.
//
// The owner's corrections, each a case below: one writer per job with
// recoverable persistence and queue delivery (DUP, LOST, WRITE, OPEN, MANY);
// recovery with no other milestone and no page (LOST, WRITE 3, MANY); the
// job's own row and the writer's lease checked before the call and before the
// commit, so a job that completed, failed or was stopped, or a newer run,
// never gets a line after it (RACE, ROW UNREAD, THREW); the recorder's writes
// held by the invocation's own waitUntil (LIFE); a misstated completion
// refused and asked again (CLAIM), and the remaining limit — contradictory
// words with true metadata — pinned (CLAIM 3); discovery from another device
// for both paths with the record's real retention (FIND, FIND 2, KEEP);
// execution, money and the final reply unchanged (SAME, OFF); the attempts,
// tokens and time logged per call (LOG).
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied: nothing here
// shows what a real model writes, how long it takes or what it costs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, pump, tick, call, settle, deliver, T, USER } from "./fixtures/request-flow.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { createHash } from "node:crypto";
import { gatewayKey, signJobToken, preScopeSlug } from "../builder/job-gateway.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { sweepJobObjects, JOB_RETENTION_MS } from "../builder/job-retention.mjs";
import * as NU from "../scripts/narration-usage.mjs";
import { progressKey, PROGRESS_LEASE_MS, PROGRESS_ASK_GRACE_MS, PROGRESS_RETRY_MS, PROGRESS_TRIES, PROGRESS_LINES_PER_TASK, TASK_STATES } from "../builder/site-progress.mjs";

/**
 * A PAGE-FILED ADD-ON: a job of its own, as the route files one with the request
 * flow off (2026-10-09, round 7: with the flow on, an addition posted straight to
 * the route is taken on as a one-part request instead — `addon-runtime-paths`).
 * Only this one post runs with it off; everything else in the case keeps the flow.
 */
async function pageFiledPost(P, path, body) {
  const was = P.env.REQUEST_FLOW;
  P.env.REQUEST_FLOW = "off";
  try { return await call(P, "POST", path, body); } finally { P.env.REQUEST_FLOW = was; }
}

const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
// A GATE THAT IS NEVER REACHED FAILS ITS CASE rather than hang the run: a held
// job's heartbeat keeps the process alive, so a case waiting on a gate its
// flow never reaches would wait for ever (met under the sweep). Each case is
// a second or two; the bound is far above that.
const GATE_MS = 20_000;
const gate = () => {
  let open, reach, timer;
  const g = { opened: new Promise((r) => { open = r; }) };
  g.reached = new Promise((r, no) => { reach = r; timer = setTimeout(() => no(new Error("the case's gate was never reached")), GATE_MS); timer.unref(); });
  g.reached.catch(() => {});
  g.open = open;
  g.reach = () => { clearTimeout(timer); reach(); };
  return g;
};
/** An add-on that runs straight through, held nowhere. */
const plainAddon = () => ({
  route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
  "add:page": { page: [PAGE("/gallery", "Gallery")] },
  [T.pages]: { pages: [writtenPage("/gallery")] },
});
/** An add-on whose page designer waits on `g`: the job holds there, its first milestone recorded. */
const heldAddon = (g) => ({
  route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
  "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
  [T.pages]: { pages: [writtenPage("/gallery")] },
});
const slugOf = (k) => "pg-" + k + "-" + Math.random().toString(16).slice(2, 8);
// A JOB'S OWN PROGRESS TASK. A request's narration (its parts' task lines,
// `syncRequestTasks`) asks for a writer of its own at acceptance, under an id
// that is no job's; the cases about a job's lines take the job's.
let platformNow = null;
const anyTask = (m) => !!(m && m.body && m.body.kind === "edit-progress");
const isTask = (m) => anyTask(m) && !!platformNow && platformNow.jobs.has(m.body.id);
const takeTask = (P) => { const i = P.queue.findIndex((m) => anyTask(m) && P.jobs.has(m.body.id)); assert.ok(i >= 0, "no progress task was queued"); return P.queue.splice(i, 1)[0]; };
const calls = (P) => P.modelLog.filter((m) => m.tool === "write_progress").length;
const settleMs = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  platformNow = P;
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); platformNow = null; }
}

/**
 * THE JOB STARTED AND HELD at its designer: the routing call made, the job's
 * message delivered without waiting, its first milestone recorded. `running`
 * is the delivery, for the case to wait on once it opens the gate.
 */
async function startHeld(P, g) {
  const r = await sendMessage(P, { message: ADD });
  const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
  assert.ok(i >= 0, "the routing call filed no job");
  const running = deliver(P, P.queue.splice(i, 1)[0]);
  await g.reached;
  // THE RECORDER'S WRITES ARE THE JOB'S BACKGROUND WORK: let them land.
  for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
  const job = [...P.jobs.values()].find((j) => j.op === "addon");
  assert.ok(job, "no add-on job");
  return { r, job, running };
}

test("RUN 1 — while the job runs, its first milestone becomes a line: the job poll and the request's view carry it, from the job's own facts, and nothing of the record's private state", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("run1"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { r, job, running } = await startHeld(P, g);
    const before = P.progressOf(job.id);
    assert.deepEqual(before.marks.map((m) => [m.stage, m.state]), [["picked", "pending"]]);
    assert.equal(before.words, ADD, "the record does not carry the words this job runs on");
    assert.equal(before.run, job.lease_owner, "the record is not this run's");
    await deliver(P, takeTask(P));
    assert.deepEqual(P.progressLog, [[{ id: "f1", state: "decided", text: "Worked out what to add: a new page. Nothing is built yet." }, { id: "f2", state: "next", text: "Design it next." }]], "the writer was not shown the job's own facts");
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1);
    assert.deepEqual(rec.marks.map((m) => m.state), ["said"]);
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(poll.status, 202);
    assert.deepEqual(poll.body.progress.map((l) => [l.n, l.text]), [[0, rec.lines[0].text]]);
    assert.equal(typeof poll.body.progress[0].ms, "number");
    assert.equal(JSON.stringify(poll.body).includes("facts"), false, "a reader was handed the facts");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts[0].progress.map((l) => [l.job, l.text]), [[job.id, rec.lines[0].text]]);
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.replySource, "model", "the final reply was not written");
    assert.deepEqual(fin.body.progress.map((l) => l.text), [rec.lines[0].text], "the finished answer lost its lines");
  });
});

test("RACE 1 — THE JOB COMPLETES WHILE THE WRITER'S CALL IS IN FLIGHT: the record is closed before the job's outcome is written, and the line written after is never committed — no update after the final reply", async () => {
  const g = gate();
  const w = gate();
  await withPlatform({ slug: slugOf("race1"), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const { r, job, running } = await startHeld(P, g);
    const writer = deliver(P, takeTask(P));
    await w.reached;
    g.open();
    await running;
    const closed = P.progressOf(job.id);
    assert.deepEqual(closed.closed && closed.closed.why, "ended", "the job ended with its progress open");
    assert.ok(["done", "failed"].includes(P.jobs.get(job.id).state));
    w.open();
    await writer;
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 0, "a line was committed after the job ended");
    assert.ok(rec.marks.every((m) => m.state === "skipped"), JSON.stringify(rec.marks.map((m) => m.state)));
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.replySource, "model");
    assert.equal(fin.body.progress, undefined, "the finished answer carries a line nobody committed");
  });
});

test("RACE 2 — THE CUSTOMER STOPS THE JOB while the writer's call is in flight: the row's cancel is read before the commit, the record is closed as cancelled, and nothing is committed or added after", async () => {
  const g = gate();
  const w = gate();
  await withPlatform({ slug: slugOf("race2"), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const { job, running } = await startHeld(P, g);
    const writer = deliver(P, takeTask(P));
    await w.reached;
    const stop = await call(P, "DELETE", "/api/site/edit/" + job.id);
    assert.equal(stop.status, 200, JSON.stringify(stop.body));
    w.open();
    await writer;
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 0, "a line was committed after the customer stopped the job");
    assert.equal(rec.closed && rec.closed.why, "cancelled");
    g.open();
    await running;
    const after = P.progressOf(job.id);
    assert.equal(after.lines.length, 0);
    assert.equal(after.marks.length, rec.marks.length, "a milestone was added after the record closed");
  });
});

test("RACE 3 — A NEWER RUN: one holding the job before the writer starts gets no call at all; one taking it between the call and the commit gets no line", async () => {
  for (const when of ["before", "between"]) {
    const g = gate();
    const w = gate();
    await withPlatform({ slug: slugOf("race3" + when), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
      const { job, running } = await startHeld(P, g);
      if (when === "before") {
        P.jobs.get(job.id).lease_owner = "c_newer001";
        await deliver(P, takeTask(P));
        assert.equal(calls(P), 0, "a writer called the model for a run that no longer holds the job");
      } else {
        const writer = deliver(P, takeTask(P));
        await w.reached;
        P.jobs.get(job.id).lease_owner = "c_newer001";
        w.open();
        await writer;
      }
      const rec = P.progressOf(job.id);
      assert.equal(rec.lines.length, 0, when + ": a line was committed for a run that no longer holds the job");
      assert.equal(rec.closed && rec.closed.why, "superseded", when);
      P.jobs.get(job.id).lease_owner = rec.run;
      w.open();
      g.open();
      await running;
    });
  }
});

test("RACE 4 — A JOB WHOSE LEASE RAN OUT (its runner gone) is narrated no more; one that FAILED closes its record before the failure is written, and a writer in flight commits nothing", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("race4a"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { job, running } = await startHeld(P, g);
    P.jobs.get(job.id).lease_expires_at = P.now() - 1;
    await deliver(P, takeTask(P));
    assert.equal(calls(P), 0, "a stalled job was narrated");
    assert.equal(P.progressOf(job.id).closed.why, "stalled");
    P.jobs.get(job.id).lease_expires_at = P.now() + 90000;
    g.open();
    await running;
  });
  const g2 = gate();
  const w = gate();
  const failing = { ...heldAddon(g2) };
  delete failing[T.pages];
  await withPlatform({ slug: slugOf("race4b"), replies: true, progress: true, answers: failing, progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const { job, running } = await startHeld(P, g2);
    const writer = deliver(P, takeTask(P));
    await w.reached;
    g2.open();
    await running;
    assert.equal(P.jobs.get(job.id).state, "failed", "the page call with no answer did not fail the job");
    assert.equal(P.progressOf(job.id).closed.why, "ended");
    w.open();
    await writer;
    assert.equal(P.progressOf(job.id).lines.length, 0, "a line was committed after the job failed");
  });
});

test("THREW — A JOB WHOSE OWN CODE THROWS closes its record (`failed`) before its refund is written, so no line follows the failure. Every route returns its failures as an answer, so no free flow reaches this path: it is read from the source, landmark to landmark", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const head = 'console.error("edit queue: job failed", id';
  const at = src.indexOf(head);
  assert.ok(at > 0 && src.indexOf(head, at + 1) < 0, "the job's failure path is gone from worker.js, or is not one");
  // COMMENTS BLANKED FIRST: the prose around a line may name what it does.
  const body = src.slice(at, at + 1500).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const close = body.indexOf('progress.close("failed")');
  const refund = body.indexOf('editRpc(env, "edit_refund"');
  assert.ok(refund > 0, "the failure path's refund is gone (the landmark moved)");
  assert.ok(close > 0, "the failure path does not close the job's progress record");
  assert.ok(close < refund, "the record is closed after the refund, so a line could follow the failure");
});

test("DUP — THE SAME TASK DELIVERED TWICE: side by side, one writer claims and one model call is made; once more after, nothing waits and no call is made", async () => {
  const g = gate();
  const w = gate();
  await withPlatform({ slug: slugOf("dup"), replies: true, progress: true, answers: heldAddon(g), progressWith: async () => { w.reach(); await w.opened; } }, async (P) => {
    const { job, running } = await startHeld(P, g);
    const task = takeTask(P);
    const a = deliver(P, task);
    await w.reached;
    await deliver(P, task);
    assert.equal(calls(P), 1, "a second delivery made a second call while the first held the lease");
    w.open();
    await a;
    await deliver(P, task);
    assert.equal(calls(P), 1, "a delivery with nothing waiting called the model");
    assert.equal(P.progressOf(job.id).lines.length, 1, "one milestone became two lines");
    g.open();
    await running;
  });
});

test("LOST — A WRITER'S MESSAGE THE QUEUE NEVER TOOK: no task exists, no other milestone comes and no page is open; the cron asks again once the ask's grace has passed, and the line is written", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("lost"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    // THE RECORDER'S SEND, AND ONLY IT, FAILS: the routing call and the job's
    // own message are sent before it.
    const r = await sendMessage(P, { message: ADD });
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    P.env.__dropSends = 1;
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    await settleMs(30);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    assert.equal(P.queue.some(isTask), false, "the case did not lose the recorder's message");
    assert.equal(P.progressOf(job.id).marks[0].state, "pending");
    await tick(P);
    assert.equal(P.queue.some(isTask), false, "the cron asked again inside the grace");
    P.advance(PROGRESS_ASK_GRACE_MS + 1000);
    P.jobs.get(job.id).lease_expires_at = P.now() + 90000;
    await tick(P);
    await deliver(P, takeTask(P));
    assert.equal(P.progressOf(job.id).lines.length, 1, "the cron's ask wrote no line");
    g.open();
    await running;
    await settle(P, r.key);
  });
});

test("WRITE 1 — A MILESTONE'S WRITE THAT FAILS is made again and recorded once; one that LANDS AND WHOSE ANSWER IS LOST is recorded once, not twice, and a writer is still asked", async () => {
  for (const fault of ["fail", "lose"]) {
    const g = gate();
    await withPlatform({ slug: slugOf("write1" + fault), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
      const r = await sendMessage(P, { message: ADD });
      const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
      const picked = (k, body) => k.endsWith(".progress.json") && String(body).includes('"stage":"picked"');
      if (fault === "fail") P.failPut(picked); else P.losePut(picked);
      const running = deliver(P, P.queue.splice(i, 1)[0]);
      await g.reached;
      for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
      const job = [...P.jobs.values()].find((j) => j.op === "addon");
      const rec = P.progressOf(job.id);
      assert.deepEqual(rec.marks.map((m) => m.stage), ["picked"], fault + ": the milestone was recorded " + rec.marks.length + " times");
      await deliver(P, takeTask(P));
      assert.equal(P.progressOf(job.id).lines.length, 1, fault + ": no writer was asked for the milestone");
      g.open();
      await running;
      await settle(P, r.key);
    });
  }
});

test("WRITE 2 — A LINE'S COMMIT THAT LANDS AND WHOSE ANSWER IS LOST: one line, not two, and no second call", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("write2"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { job, running } = await startHeld(P, g);
    P.losePut((k, body) => k === progressKey(job.id) && JSON.parse(String(body)).lines.length === 1);
    await deliver(P, takeTask(P));
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1, "a commit whose answer was lost was made twice");
    assert.equal(calls(P), 1, "the writer called the model again for a line already committed");
    assert.equal(P.queue.some(isTask), false, "a writer was asked for a milestone already said");
    g.open();
    await running;
  });
});

test("WRITE 3 — THE WRITER DIES AFTER ITS CLAIM LANDS: its lease holds the record until it runs out; then the cron asks, a new writer claims, and the line is written — with no other milestone and no page", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("write3"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { job, running } = await startHeld(P, g);
    P.hangPut((k, body) => k === progressKey(job.id) && !!JSON.parse(String(body)).writer);
    const died = await deliver(P, takeTask(P));
    assert.equal(died, "hung", "the writer did not die after its claim");
    P.recover();
    assert.ok(P.progressOf(job.id).writer, "the dead writer's lease is not on the record");
    await tick(P);
    assert.equal(P.queue.some(isTask), false, "a writer was asked while the dead writer's lease still held");
    P.advance(PROGRESS_LEASE_MS + 1000);
    P.jobs.get(job.id).lease_expires_at = P.now() + 90000;
    await tick(P);
    await deliver(P, takeTask(P));
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1, "the recovered writer wrote no line");
    assert.equal(calls(P), 1, "the dead writer's call was counted, or a second was made");
    g.open();
    await running;
  });
});

test("OPEN — THE RECORD'S OPENING THAT FAILS: the recorder opens it again before the first milestone, so the job keeps its lines", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("open"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    // THE STORE DOWN FOR THE OPENING'S ONE READ: the opening is not written.
    // THE JOB'S OWN RECORD — a job's id — never the request's narration
    // (2026-10-06), whose opening at the acceptance is read first and would
    // take the fault in its place, leaving the job's opening untested (found
    // by the sweep: the mutant that forgets a failed opening survived).
    P.failGet((k) => { const m = /^jobs\/([0-9a-f]{32})\.progress\.json$/.exec(k); return !!m && P.jobs.has(m[1]); });
    const { job, running } = await startHeld(P, g);
    const rec = P.progressOf(job.id);
    assert.ok(rec, "the record never opened after its first opening failed");
    assert.deepEqual(rec.marks.map((m) => m.stage), ["picked"], "the first milestone was lost with the opening");
    await deliver(P, takeTask(P));
    assert.equal(P.progressOf(job.id).lines.length, 1);
    g.open();
    await running;
  });
});

test("ROW UNREAD — THE JOB'S ROW THAT CANNOT BE READ is never taken for an ended job: no call is made, the record stays open, the try is made again after its wait, and the line is written", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("unread"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { job, running } = await startHeld(P, g);
    // THE WRITER'S OWN READ OF THE ROW, AND ONLY IT, ANSWERS 503 ONCE.
    P.failRead((url) => url.includes("select=id,uid,state,lease_owner"));
    await deliver(P, takeTask(P));
    const rec = P.progressOf(job.id);
    assert.equal(rec.closed, null, "a row that could not be read closed the record: " + JSON.stringify(rec.closed));
    assert.equal(rec.marks[0].state, "pending", "the milestone was given up on a row that could not be read");
    assert.equal(calls(P), 0, "a call was made without the job's row");
    P.advance(PROGRESS_RETRY_MS + 1000);
    P.jobs.get(job.id).lease_expires_at = P.now() + 90000;
    await deliver(P, takeTask(P));
    assert.equal(P.progressOf(job.id).lines.length, 1, "the try made again wrote no line");
    g.open();
    await running;
  });
});

test("MANY — A WRITER THAT HAS WRITTEN ITS EIGHT LINES asks for the next task itself: a milestone recorded during its last call gets its line with no cron, no page and no other milestone", async () => {
  const g = gate();
  let more = null;
  const progressWith = async ({ n }) => { if (n <= PROGRESS_LINES_PER_TASK && more) await more(n); };
  await withPlatform({ slug: slugOf("many"), replies: true, progress: true, answers: heldAddon(g), progressWith }, async (P) => {
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const gk = await gatewayKey("platform-secret");
    const { job, running } = await startHeld(P, g);
    const tok = await signJobToken({ id: job.id, slug: P.slug, uid: USER.id, exp: Math.floor(Date.now() / 1000) + 600 }, gk);
    // DURING EACH CALL THE JOB RECORDS ONE MORE MILESTONE, through its own door.
    more = async (n) => {
      const res = await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", run: P.progressOf(job.id).run, stage: "extra", facts: [{ state: "doing", text: "Step " + n + " is happening now." }], seq: 100 + n }, "Bearer " + tok);
      assert.equal(res.status, 200, "the case could not record its milestone");
    };
    await deliver(P, takeTask(P));
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, PROGRESS_LINES_PER_TASK, "the writer did not write its eight lines in one task");
    assert.deepEqual(rec.marks.filter((m) => m.state === "pending").map((m) => m.stage), ["extra"], "the last call's milestone is not the one left waiting");
    assert.ok(P.queue.some(isTask), "the writer left a milestone waiting and asked for no one");
    more = null;
    await deliver(P, takeTask(P));
    assert.equal(P.progressOf(job.id).lines.length, PROGRESS_LINES_PER_TASK + 1, "the milestone left waiting got no line");
    g.open();
    await running;
  });
});

test("CLAIM 1 — A RUNNING STEP CALLED FINISHED: the first answer misstates a fact's state and is asked for once more, told which; the right second answer is the line", async () => {
  const g = gate();
  const asked = [];
  await withPlatform({
    slug: slugOf("claim1"), replies: true, progress: true, answers: heldAddon(g),
    progressWith: async ({ n, facts, text }) => {
      asked.push(text);
      if (n === 0) return { answer: { text: "It's all built and live.", says: facts.map((f) => ({ id: f.id, as: "decided" })) } };
      return undefined;
    },
  }, async (P) => {
    const { job, running } = await startHeld(P, g);
    await deliver(P, takeTask(P));
    assert.equal(asked.length, 2);
    assert.match(asked[1], /DESCRIBED f2 as decided, but its state is next/);
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1);
    assert.doesNotMatch(rec.lines[0].text, /live/, "the misstated answer was used");
    g.open();
    await running;
  });
});

test("CLAIM 2 — AN UPDATE THAT KEEPS MISSTATING: no line; tried again after its wait; then its milestone is given up with the reason — and the job, its money and its final reply go on as before", async () => {
  const g = gate();
  await withPlatform({
    slug: slugOf("claim2"), replies: true, progress: true, answers: heldAddon(g),
    progressWith: async ({ facts }) => ({ answer: { text: "Finished.", says: facts.map((f) => ({ id: f.id, as: "prepared" })) } }),
  }, async (P) => {
    const { r, job, running } = await startHeld(P, g);
    await deliver(P, takeTask(P));
    assert.equal(calls(P), 2);
    let rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 0);
    assert.equal(rec.retryAt > P.now(), true, "a failed attempt was not given a wait");
    const retry = takeTask(P);
    assert.equal(retry.delaySeconds, Math.ceil(PROGRESS_RETRY_MS / 1000));
    P.advance(PROGRESS_RETRY_MS + 1000);
    P.jobs.get(job.id).lease_expires_at = P.now() + 90000;
    await deliver(P, retry);
    assert.equal(calls(P), 2 * PROGRESS_TRIES, "the tries were not bounded");
    rec = P.progressOf(job.id);
    assert.deepEqual(rec.marks.map((m) => [m.state, m.why]), [["failed", "misstated"]]);
    assert.equal(P.queue.some(isTask), false, "a given-up milestone asked for another writer");
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.replySource, "model", "the final reply did not come");
  });
});

test("CLAIM 3 — THE LIMIT, THROUGH THE ROUTE: an update whose words say the page is live while its metadata states every fact truly IS committed — no keyword filter reads the words; the final reply, written from what happened, is unchanged", async () => {
  const g = gate();
  await withPlatform({
    slug: slugOf("claim3"), replies: true, progress: true, answers: heldAddon(g),
    progressWith: async ({ facts }) => ({ answer: { text: "Your gallery page is live!", says: facts.map((f) => ({ id: f.id, as: f.state })) } }),
  }, async (P) => {
    const { r, job, running } = await startHeld(P, g);
    await deliver(P, takeTask(P));
    assert.deepEqual(P.progressOf(job.id).lines.map((l) => l.text), ["Your gallery page is live!"], "the limit is no longer the limit — record what reads the words now");
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.replySource, "model");
    assert.equal(P.factsOf(fin.body.reply) !== null, true, "the final reply is not the reply writer's own");
  });
});

test("SAME — EXECUTION, PUBLISHING, MONEY AND THE FINAL REPLY ARE THE SAME with progress on (a line written mid-job) and off", async () => {
  const runOnce = async (progress) => {
    const g = gate();
    let out = null;
    await withPlatform({ slug: "pg-same-site", replies: true, progress, answers: heldAddon(g) }, async (P) => {
      const r = await sendMessage(P, { message: ADD, key: "rqsameprogress000000" });
      const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
      const running = deliver(P, P.queue.splice(i, 1)[0]);
      await g.reached;
      for (let n = 0; n < 50 && progress && !P.queue.some(isTask); n++) await settleMs(5);
      if (progress) await deliver(P, takeTask(P));
      g.open();
      await running;
      await settle(P, r.key);
      const job = [...P.jobs.values()].find((j) => j.op === "addon");
      const fin = await call(P, "GET", "/api/site/edit/" + job.id);
      // THE PROGRESS FEATURE'S OWN FIELDS — its lines and the job's outcome
      // for its card (2026-10-06) — are absent with it off; the rest is the same.
      const { progress: lines, outcome: _outcome, ...answer } = fin.body;
      out = {
        lines: lines || null,
        answer: JSON.stringify(answer).split(job.id).join("JOB"),
        work: JSON.stringify({ pages: P.pages(), state: job.state, billing: job.billing, cost: job.cost, ledger: P.ledger.map((e) => [String(e.ref).split(job.id).join("JOB"), e.reason, e.delta]), balance: P.credits.balance }),
      };
    });
    return out;
  };
  const off = await runOnce(false);
  const on = await runOnce(true);
  assert.equal(off.lines, null);
  assert.equal(on.lines.length, 1, "the case wrote no line with progress on");
  assert.equal(on.work, off.work, "progress changed the work, the site or the money");
  assert.equal(on.answer, off.answer, "progress changed the final answer or its reply");
});

test("OFF — with the switch off nothing is recorded, no task is ever sent, and no answer carries `progress` or `jobs`", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("off"), replies: true, progress: false, answers: heldAddon(g) }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    await settleMs(30);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(Object.hasOwn(poll.body, "progress"), false);
    // NOR THE JOB'S OWN OUTCOME (2026-10-06): a field of the progress feature, absent with it off.
    assert.equal(Object.hasOwn(poll.body, "outcome"), false, "a running job's poll carried its outcome with progress off");
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(Object.hasOwn(fin.body, "outcome"), false, "a finished job's answer carried its outcome with progress off");
    await tick(P);
    assert.equal(P.progressOf(job.id), null, "a record was written with progress off");
    assert.equal(P.sent.some(anyTask), false, "a progress task was sent with progress off");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(Object.hasOwn(list.body, "jobs"), false);
    assert.equal(JSON.stringify(list.body).includes('"said"'), false, "a task's lines were served with progress off");
    assert.equal(Object.hasOwn(list.body.requests[0].parts[0], "progress"), false);
  });
});

test("FIND — ANOTHER DEVICE FINDS A STANDALONE JOB: the requests list carries this owner's page-filed add-on with its words and lines, never a request's job, and never with progress off", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("find"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    // THE PAGE-DRIVEN PATH: the add-on route filed directly, with the page's own key.
    const filed = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page please", picker: "sonnet", idem: "f".repeat(32) });
    assert.ok([200, 202].includes(filed.status), JSON.stringify(filed.body));
    const id = filed.body.job;
    const running = deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    await deliver(P, takeTask(P));
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(list.status, 200);
    assert.equal(list.body.jobs.length, 1, JSON.stringify(list.body.jobs));
    const v = list.body.jobs[0];
    assert.equal(v.job, id);
    assert.equal(v.op, "addon");
    assert.equal(v.words, "add a gallery page please");
    assert.equal(v.ended, false);
    assert.equal(v.progress.length, 1);
    assert.equal(Object.hasOwn(v, "run") || JSON.stringify(v).includes(P.progressOf(id).run), false, "the listing handed out the run's lease name");
    g.open();
    await running;
    const after = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.equal(after.body.jobs[0].ended, true, "a job that ended within the day is not listed as ended");
    assert.equal(after.body.jobs[0].progress.length, 1, "an ended job's lines were not listed with it");
    // ANOTHER OWNER'S JOB ON THE SAME SITE, WITH A RECORD OF ITS OWN: never listed.
    const theirs = "e".repeat(32);
    P.jobs.set(theirs, { ...P.jobs.get(id), id: theirs, uid: "u-someone-else", idem_key: "e".repeat(32) });
    P.objects.set(progressKey(theirs), { ...P.objects.get(progressKey(id)), body: P.objects.get(progressKey(id)).body.split(id).join(theirs).split(USER.id).join("u-someone-else") });
    // AND THIS OWNER'S JOB ONCE IT ENDED MORE THAN A DAY AGO: not listed.
    const listed = (await call(P, "GET", "/api/site/requests/" + P.slug)).body.jobs.map((j) => j.job);
    assert.deepEqual(listed, [id], "another owner's job was listed: " + JSON.stringify(listed));
    P.jobs.get(id).updated_at = P.now() - 25 * 3600 * 1000;
    assert.deepEqual((await call(P, "GET", "/api/site/requests/" + P.slug)).body.jobs, [], "a job that ended more than a day ago is still listed");
  });
  const g3 = gate();
  await withPlatform({ slug: slugOf("find2"), replies: true, progress: true, answers: heldAddon(g3) }, async (P) => {
    const { r, running } = await startHeld(P, g3);
    await deliver(P, takeTask(P));
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.jobs, [], "a request's job was listed as a standalone job");
    assert.equal(list.body.requests[0].parts[0].progress.length, 1, "the request's card lost its part's lines");
    g3.open();
    await running;
    await settle(P, r.key);
  });
});

test("FIND 2 — A BUSY DAY: the list holds the twenty most recent standalone jobs, oldest first, so the job running now is never hidden behind older ones", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("busy"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const filed = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page please", picker: "sonnet", idem: "f".repeat(32) });
    assert.ok([200, 202].includes(filed.status), JSON.stringify(filed.body));
    const id = filed.body.job;
    const running = deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    // TWENTY-ONE EARLIER STANDALONE JOBS OF THE SAME DAY, each ended, each with its record.
    const row = P.jobs.get(id);
    const earlier = [];
    for (let k = 0; k < 21; k++) {
      const jid = k.toString(16).padStart(2, "0").repeat(16);
      earlier.push(jid);
      P.jobs.set(jid, { ...row, id: jid, idem_key: jid, state: "done", created_at: row.created_at - (21 - k) * 60_000, updated_at: row.created_at - (21 - k) * 60_000 + 30_000 });
      P.objects.set(progressKey(jid), { ...P.objects.get(progressKey(id)), body: P.objects.get(progressKey(id)).body.split(id).join(jid) });
    }
    const listed = (await call(P, "GET", "/api/site/requests/" + P.slug)).body.jobs.map((j) => j.job);
    assert.equal(listed.length, 20, "the list does not hold twenty: " + listed.length);
    assert.equal(listed[listed.length - 1], id, "the job running now is not in the list, or not last");
    assert.deepEqual(listed, [...earlier.slice(2), id], "the list is not the twenty most recent, oldest first");
    g.open();
    await running;
  });
});

test("LIFE — THE RECORDER'S WRITES ARE HELD BY THE INVOCATION: each one (the opening, every milestone, the close) is handed to the job's own waitUntil, so none is a promise left floating", async () => {
  const worker = await loadWorker();
  const held = (progress) => withPlatform({ slug: slugOf("life" + progress), replies: true, progress, answers: plainAddon() }, async (P) => {
    await sendMessage(P, { message: ADD });
    const m = P.queue.splice(P.queue.findIndex((x) => x.body && x.body.kind === "site-edit"), 1)[0];
    let n = 0;
    await P.run(async () => {
      const ctx = { pending: [], waitUntil(p) { n++; ctx.pending.push(p); }, passThroughOnException() {} };
      await worker.queue({ messages: [{ body: m.body, ack() {}, retry() {} }] }, P.env, ctx);
      await Promise.allSettled(ctx.pending);
    });
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const rec = progress ? P.progressOf(job.id) : null;
    return { n, state: job.state, marks: rec ? rec.marks.length : 0, closed: rec ? rec.closed && rec.closed.why : null };
  });
  const off = await held(false);
  const on = await held(true);
  assert.equal(on.state, off.state, "the job ended differently with progress on");
  assert.equal(on.closed, "ended", "the job's end did not close its record");
  assert.ok(on.marks >= 3, "the add-on recorded too few milestones to tell: " + on.marks);
  assert.equal(on.n - off.n, on.marks + 2, "the recorder's writes were not each handed to the invocation: " + JSON.stringify({ on, off }));
});

test("KEEP — THE RECORD'S REAL RETENTION: it lives at jobs/<id>.progress.json, and the existing two-minute rotation takes it out once it is seven days past its last write, never before", async () => {
  const id = "c".repeat(32);
  const key = progressKey(id);
  assert.equal(key, "jobs/" + id + ".progress.json");
  const base = 1_800_000_000_000;
  const removed = [];
  // ONE FULL ROTATION: sixteen ticks two minutes apart, each listing its own
  // nibble of `jobs/` (`retentionPrefixes`), the record written `age` before.
  const rotation = async (age) => {
    for (let t = 0; t < 16; t++) {
      const now = base + t * 120_000;
      await sweepJobObjects({ list: async (prefix) => (key.startsWith(prefix) ? [{ key, uploaded: new Date(now - age) }] : []), remove: async (keys) => { removed.push(...keys); } }, { now, tickMs: 120_000 });
    }
  };
  await rotation(JOB_RETENTION_MS - 60_000);
  assert.deepEqual(removed, [], "a record younger than seven days was taken out");
  await rotation(JOB_RETENTION_MS + 60_000);
  assert.deepEqual(removed, [key], "a record seven days past its last write was not taken out in one full rotation");
});

test("GATEWAY — FROM THE CONTAINER: the job's recorder writes through /progress under its own token — the id, site and owner are the token's, never the body's; a pre-scoped build, a bad op and a body too large are refused", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("gw"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const gk = await gatewayKey("platform-secret");
    const exp = Math.floor(Date.now() / 1000) + 600;
    const r = await sendMessage(P, { message: ADD });
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const tok = await signJobToken({ id: job.id, slug: P.slug, uid: USER.id, exp }, gk);
    // THE CONTAINER'S WAY OF RECORDING, AS `makeContainerEnv` BUILDS IT.
    const viaGateway = [];
    const jobEnv = makeContainerEnv({
      gateway: { url: "https://gofarther.dev/api/job/" + job.id, token: tok },
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        viaGateway.push(body.op);
        const res = await call(P, "POST", new URL(url).pathname, body, init.headers.authorization);
        return new Response(JSON.stringify(res.body || {}), { status: res.status });
      },
    });
    assert.equal(typeof jobEnv.JOB_PROGRESS, "function");
    P.env.JOB_PROGRESS = jobEnv.JOB_PROGRESS;
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    assert.deepEqual(viaGateway, ["begin", "mark"], "the recorder did not write through the gateway");
    assert.equal(P.progressOf(job.id).marks.length, 1);
    // A BODY NAMING ANOTHER JOB: the token's job is written, never the body's.
    const other = "d".repeat(32);
    const forged = await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", run: P.progressOf(job.id).run, stage: "forged", facts: [{ state: "decided", text: "x" }], seq: 99, id: other, uid: "someone-else" }, "Bearer " + tok);
    assert.equal(forged.status, 200);
    assert.equal(P.progressOf(other), null, "a body's job id was written");
    assert.equal(P.progressOf(job.id).marks.length, 2);
    // REFUSED: a bad op, a body too large, a pre-scoped build, no token.
    assert.equal((await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "erase" }, "Bearer " + tok)).status, 400);
    assert.equal((await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", junk: "x".repeat((1 << 20) + 10) }, "Bearer " + tok)).status, 413);
    assert.equal((await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark" }, "Bearer nope")).status, 401);
    const preTok = await signJobToken({ id: job.id, slug: preScopeSlug(job.id), uid: USER.id, exp, pre: true }, gk);
    assert.equal((await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", run: P.progressOf(job.id).run, stage: "pre", facts: [{ state: "decided", text: "x" }], seq: 98 }, "Bearer " + preTok)).status, 403, "a pre-scoped build wrote progress");
    assert.equal(P.progressOf(job.id).marks.length, 2, "a pre-scoped build's milestone was recorded");
    // A RUN THAT DID NOT OPEN THE RECORD: its milestone is refused, and its close closes nothing.
    const stale = await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "mark", run: "c_stale0001", stage: "stale", facts: [{ state: "decided", text: "x" }], seq: 97 }, "Bearer " + tok);
    assert.equal(stale.status, 409, "a milestone from a run that did not open the record was taken");
    assert.equal(P.progressOf(job.id).marks.length, 2, "a stale run's milestone was recorded");
    await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "close", run: "c_stale0001", why: "ended" }, "Bearer " + tok);
    assert.equal(P.progressOf(job.id).closed, null, "a run that did not open the record closed it");
    g.open();
    await running;
    assert.deepEqual(viaGateway.slice(0, 2), ["begin", "mark"]);
    assert.equal(viaGateway[viaGateway.length - 1], "close", "the job's end did not close its record through the gateway");
    assert.equal(P.progressOf(job.id).closed.why, "ended");
    delete P.env.JOB_PROGRESS;
    await settle(P, r.key);
  });
});

test("LOG — EACH WRITER CALL IS MEASURED IN THE LOG: the outcome, the model, the milestones and facts, the attempts, the tokens in and out — fresh and cached — and the milliseconds, as ONE string the usage step reads back whole; not charged, so the ledger never shows it", async () => {
  const g = gate();
  const lines = [];
  const realLog = console.log;
  // EACH CALL'S ARGUMENTS KEPT APART (2026-10-07): the line is one string, so
  // its shape never rests on how a log joins a call's arguments.
  const calls = [];
  console.log = (...a) => { calls.push(a); lines.push(a.join(" ")); };
  // THE ANSWERS' CACHED INPUT: what a provider reports beside the fresh, which
  // the line used to leave out (so every cost read from it was a floor).
  const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 700, cache_creation_input_tokens: 3 };
  try {
    await withPlatform({ slug: slugOf("log"), replies: true, progress: true, answers: heldAddon(g), progressWith: () => ({ usage }), tasksWith: () => ({ usage }) }, async (P) => {
      const { job, running } = await startHeld(P, g);
      const ledgerBefore = P.ledger.length;
      await deliver(P, takeTask(P));
      assert.equal(P.ledger.length, ledgerBefore, "a progress line moved money");
      g.open();
      await running;
      const line = lines.find((l) => l.startsWith("progress: " + job.id + " written"));
      assert.ok(line, "no measurement line: " + lines.filter((l) => l.startsWith("progress:")).join(" | "));
      assert.equal(calls.find((a) => a.join(" ") === line).length, 1, "the measurement line was printed as several arguments");
      const read = NU.parseCall(line);
      assert.ok(read, "the usage step cannot read the writer's own line: " + line);
      assert.deepEqual({ kind: read.kind, id: read.id, ok: read.ok, milestones: read.milestones, facts: read.facts, attempts: read.attempts, in: read.in, out: read.out, cacheRead: read.cacheRead, cacheWrite: read.cacheWrite },
        { kind: "line", id: job.id, ok: true, milestones: 1, facts: 2, attempts: 1, in: 10, out: 5, cacheRead: 700, cacheWrite: 3 });
      assert.ok(Number.isInteger(read.ms) && read.ms >= 0);
      // AND THE TASK LINES' CALL, measured the same way and read the same way.
      const t = requestTask(P);
      await deliver(P, t);
      const tline = lines.find((l) => l.startsWith("progress: tasks " + t.body.id + " written"));
      assert.ok(tline, "no measurement line for the task lines: " + lines.filter((l) => l.startsWith("progress:")).join(" | "));
      assert.equal(calls.find((a) => a.join(" ") === tline).length, 1, "the task lines' measurement was printed as several arguments");
      const tread = NU.parseCall(tline);
      assert.ok(tread, "the usage step cannot read the task writer's own line: " + tline);
      assert.deepEqual({ kind: tread.kind, id: tread.id, ok: tread.ok, tasks: tread.tasks, in: tread.in, out: tread.out, cacheRead: tread.cacheRead, cacheWrite: tread.cacheWrite },
        { kind: "tasks", id: t.body.id, ok: true, tasks: 1, in: 10, out: 5, cacheRead: 700, cacheWrite: 3 });
      // PRICED WHOLE BY THE STEP: the cached input in, no call a floor.
      const u = NU.usageOf([{ timestamp: 1, $metadata: { message: line } }, { timestamp: 2, $metadata: { message: tline } }], new Set([job.id, t.body.id]));
      assert.equal(u.totals.floorCalls, 0);
      assert.equal(u.totals.cacheRead, 1400);
    });
  } finally { console.log = realLog; }
});

test("EDIT — AN EDIT'S MILESTONES: its plan becomes a line while its step runs; at its publish each step is recorded as made and not published, and the publish as happening now — never as published", async () => {
  const g = gate();
  const DESC = "Change the site description to say we bake overnight sourdough";
  const answers = {
    route: [{ intent: "edit", layer: "look" }],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
    "lane:description": async () => { g.reach(); await g.opened; return "Overnight sourdough from a Bristol side street."; },
  };
  await withPlatform({ slug: slugOf("edit"), replies: true, progress: true, answers }, async (P) => {
    const r = await sendMessage(P, { message: DESC });
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    for (let n = 0; n < 50 && !P.queue.some(isTask); n++) await settleMs(5);
    const job = [...P.jobs.values()].find((j) => j.op === "edit");
    assert.deepEqual(P.progressOf(job.id).marks.map((m) => [m.stage, m.facts.map((f) => f.state)]), [["plan", ["decided", "next"]]]);
    assert.match(P.progressOf(job.id).marks[0].facts[0].text, /description/);
    await deliver(P, takeTask(P));
    assert.equal(P.progressOf(job.id).lines.length, 1, "the plan did not become a line while the step ran");
    g.open();
    await running;
    const rec = P.progressOf(job.id);
    const pub = rec.marks.find((m) => m.stage === "publish");
    assert.ok(pub, "the edit's publish was not recorded: " + JSON.stringify(rec.marks.map((m) => m.stage)));
    assert.deepEqual(pub.facts.map((f) => f.state), ["prepared", "doing"]);
    assert.match(pub.facts[0].text, /^Made, not published yet: description/);
    assert.equal(rec.closed.why, "ended");
    await settle(P, r.key);
  });
});

test("ADD-ON — AN ADD-ON'S MILESTONES, IN ORDER: what it chose (decided), each design (designed, not built), its pages (prepared, not published) and its publish (happening now) — never published", async () => {
  await withPlatform({ slug: slugOf("addon"), replies: true, progress: true, answers: plainAddon() }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    await deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const rec = P.progressOf(job.id);
    assert.deepEqual(rec.marks.map((m) => [m.stage, m.facts.map((f) => f.state)]), [
      ["picked", ["decided", "next"]],
      ["designed", ["designed", "next"]],
      ["pages", ["prepared", "next"]],
      ["publish", ["doing"]],
    ], "the add-on's milestones are not each recorded, in order, in their states");
    assert.match(rec.marks[1].facts[0].text, /^Designed, not built yet: a new page \(“Gallery”, \/gallery\)/);
    assert.equal(rec.closed.why, "ended");
    await settle(P, r.key);
  });
});

// ── EACH TASK NAMED BY THE MODEL'S OWN LINE (2026-10-06) ──────────────────────

/** The supplied task-lines writer's answer for a task: its line in every state the product names, each marked with its state. */
const LINES = (w) => Object.fromEntries(TASK_STATES.map((k) => ["" + k, "(" + k + ") " + w]));
/** The request's narration task: the progress task whose id is no job's. */
const requestTask = (P) => { const i = P.queue.findIndex((m) => anyTask(m) && !P.jobs.has(m.body.id)); assert.ok(i >= 0, "the request's narration asked for no writer"); return P.queue.splice(i, 1)[0]; };

test("NAMES 1 — A REQUEST'S PART IS NAMED BY THE MODEL'S OWN LINE: its acceptance opens the request's narration and asks for a writer; the writer writes the part's line in every state; the request's view and the requests list carry them; the part's job writes none of its own", async () => {
  await withPlatform({ slug: slugOf("names1"), replies: true, progress: true, answers: plainAddon() }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    let view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(Object.hasOwn(view.body.request.parts[0], "said"), false, "a part carried lines before any were written");
    await deliver(P, requestTask(P));
    assert.deepEqual(P.tasksLog, [[{ id: "t0", words: ADD }]], "the writer was not shown the part's own words");
    view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts[0].said, LINES(ADD));
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.requests[0].parts[0].said, LINES(ADD));
    await settle(P, r.key);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    assert.deepEqual(P.progressOf(job.id).taskWords, [], "a request's part was named on its job's record as well");
    assert.equal(P.tasksLog.length, 1, "the task lines were written more than once");
  });
});

test("NAMES 2 — A PAGE-FILED JOB'S ONE TASK: its record opens with the customer's words and asks for a writer at once, which writes the task's lines before the milestone's line; the requests list and the job's poll carry them", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("names2"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const filed = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page please", picker: "sonnet", idem: "f".repeat(32) });
    const id = filed.body.job;
    const running = deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    await g.reached;
    for (let n = 0; n < 50 && !P.progressOf(id)?.marks?.length; n++) await settleMs(5);
    assert.deepEqual(P.progressOf(id).taskWords, [{ n: 0, words: "add a gallery page please" }]);
    await deliver(P, takeTask(P));
    const rec = P.progressOf(id);
    assert.deepEqual(rec.tasks, [{ n: 0, ...LINES("add a gallery page please") }]);
    assert.equal(rec.lines.length, 1, "the milestone's line was not written after the task's lines");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.jobs[0].said, LINES("add a gallery page please"));
    const poll = await call(P, "GET", "/api/site/edit/" + id);
    assert.deepEqual(poll.body.said, LINES("add a gallery page please"));
    g.open();
    await running;
    const final = await call(P, "GET", "/api/site/edit/" + id);
    assert.deepEqual(final.body.said, LINES("add a gallery page please"), "the finished job's answer lost its task's lines");
  });
});

test("NAMES 3 — THE CALL FOR THE LINES FAILS: the part keeps its words; it is tried again after its wait, then given up with why — and a milestone of a job still gets its line", async () => {
  await withPlatform({ slug: slugOf("names3"), replies: true, progress: true, answers: plainAddon(), tasksWith: async () => ({ status: 503 }) }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    const t = requestTask(P);
    await deliver(P, t);
    const id = t.body.id;
    assert.equal(P.progressOf(id).taskTries, 1);
    assert.equal(P.progressOf(id).tasks, null);
    P.advance(PROGRESS_RETRY_MS + 1000);
    await deliver(P, requestTask(P));
    const rec = P.progressOf(id);
    assert.equal(rec.tasks, null);
    assert.equal(rec.tasksWhy, "send", "the lines were not given up after their tries");
    assert.equal(P.queue.some((m) => anyTask(m) && m.body.id === id), false, "a writer was asked again after the lines were given up");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(Object.hasOwn(view.body.request.parts[0], "said"), false);
    assert.equal(view.body.request.parts[0].words, ADD, "the part lost its own words");
    await settle(P, r.key);
  });
});

test("NAMES 4 — A JOB THAT ENDED BEFORE ITS TASK'S LINES WERE WRITTEN still gets them, its writer's message lost: the cron's sweep of ended jobs asks once the grace has passed, and the lines land on the closed record for its card to show finished", async () => {
  await withPlatform({ slug: slugOf("names4"), replies: true, progress: true, answers: plainAddon() }, async (P) => {
    const filed = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page please", picker: "sonnet", idem: "e".repeat(32) });
    const id = filed.body.job;
    await deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    // THE WRITER'S MESSAGES, LOST.
    for (let i = P.queue.length - 1; i >= 0; i--) if (anyTask(P.queue[i])) P.queue.splice(i, 1);
    const ended = P.progressOf(id);
    assert.ok(ended.closed, "the job's end did not close its record");
    assert.equal(ended.tasks, null);
    P.advance(PROGRESS_ASK_GRACE_MS + 1000);
    await tick(P);
    await deliver(P, takeTask(P));
    assert.deepEqual(P.progressOf(id).tasks, [{ n: 0, ...LINES("add a gallery page please") }], "the ended job's task lines were not written");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    assert.deepEqual(list.body.jobs[0].said, LINES("add a gallery page please"));
    assert.equal(list.body.jobs[0].ended, true);
  });
});

// A MENU AND TWO PAGES, for a link the add-on step sets aside as a part of its own (request-flow's M1).
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>") },
];
const narrationOf = (P, key) => P.progressOf(createHash("sha256").update("request-tasks:" + P.slug + "/" + key).digest("hex").slice(0, 32));

test("NAMES 5 — A PART CARVED MID-REQUEST (the menu link the add-on step sets aside) is named by the model's own line too: the driver adds its words to the request's narration and asks for a writer, which writes it alone — the first part's lines are kept, never written again", async () => {
  const LINK = "put a link to it in the menu";
  const MSG = "Add a gallery page and " + LINK + ".";
  await withPlatform({
    slug: slugOf("names5"), pages: NAV_PAGES, replies: true, progress: true,
    answers: {
      route: [{ intent: "addon" }, { intent: "edit", layer: "nav" }],
      [T.adds]: { kinds: ["page", "frame"], scopes: [{ kind: "page", words: "Add a gallery page" }, { kind: "frame", words: LINK }] },
      "add:page": { page: [{ ...PAGE("/gallery", "Gallery"), link: { in: "page", page: "/", where: "a button in the hero band" } }] },
      [T.pages]: { pages: [writtenPage("/gallery")] },
      write_nav: { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    // THE ACCEPTANCE'S ASK, delivered at once: the first part's lines are written before any part is carved.
    await deliver(P, requestTask(P));
    assert.deepEqual(P.tasksLog, [[{ id: "t0", words: MSG }]]);
    // THE QUEUE ALONE, NO CRON: the driver that carves the part names it.
    for (let i = 0; i < 4 && !(P.record(r.key) || {}).ended; i++) await pump(P);
    await pump(P);
    const rec = P.record(r.key);
    assert.equal(rec.ended, true, "the request did not end on the queue alone");
    assert.deepEqual(rec.parts.map((p) => [p.words, p.status]), [[MSG, "done"], [LINK, "done"]], "the link was not carved as a part of its own");
    const nar = narrationOf(P, r.key);
    assert.deepEqual(nar.taskWords, [{ n: 0, words: MSG }, { n: 1, words: LINK }], "the carved part was not added to the request's narration");
    assert.deepEqual(P.tasksLog, [[{ id: "t0", words: MSG }], [{ id: "t1", words: LINK }]], "the writer was not asked for the carved part alone");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts.map((p) => p.said), [LINES(MSG), LINES(LINK)]);
  });
});

test("NAMES 6 — THE OPENING ASKS AT ONCE: a page-filed job's record, opened with its one task, asks for a writer before any milestone, so its card can be named while the job's first step is still running; an opening with no task asks for nothing", async () => {
  await withPlatform({ slug: slugOf("names6"), replies: true, progress: true, answers: plainAddon() }, async (P) => {
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const gk = await gatewayKey("platform-secret");
    const exp = Math.floor(Date.now() / 1000) + 600;
    const filed = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page please", picker: "sonnet", idem: "d".repeat(32) });
    const id = filed.body.job;
    // THE JOB'S OWN MESSAGE IS NOT DELIVERED: only its opening is written.
    P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1);
    const tok = await signJobToken({ id, slug: P.slug, uid: USER.id, exp }, gk);
    const opened = await call(P, "POST", "/api/job/" + id + "/progress", { op: "begin", run: "c_run00042", kind: "addon", words: "add a gallery page please", picker: "sonnet", pages: ["/"], task: true }, "Bearer " + tok);
    assert.equal(opened.status, 200);
    assert.deepEqual(P.progressOf(id).marks, []);
    assert.equal(P.queue.filter((m) => anyTask(m) && m.body.id === id).length, 1, "the opening asked for no writer");
    await deliver(P, takeTask(P));
    assert.deepEqual(P.progressOf(id).tasks, [{ n: 0, ...LINES("add a gallery page please") }]);
    // WITH NO TASK, nothing waits and no writer is asked.
    const other = await pageFiledPost(P, "/api/site/" + P.slug + "/addon", { instruction: "add a menu page", picker: "sonnet", idem: "c".repeat(32) });
    P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1);
    const tok2 = await signJobToken({ id: other.body.job, slug: P.slug, uid: USER.id, exp }, gk);
    await call(P, "POST", "/api/job/" + other.body.job + "/progress", { op: "begin", run: "c_run00043", kind: "addon", words: "add a menu page" }, "Bearer " + tok2);
    assert.deepEqual(P.progressOf(other.body.job).taskWords, []);
    assert.equal(P.queue.some((m) => anyTask(m) && m.body.id === other.body.job), false, "an opening with nothing waiting asked for a writer");
  });
});

test("NAMES 7 — A REQUEST WHOSE NARRATION NEVER OPENED (the acceptance's background write lost): the cron's sweep opens it from the request while the work still runs, asks for a writer, and the part gets its lines — with no page open", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("names7"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    // LOST: the narration's record and its writer's message.
    const lost = requestTask(P);
    P.objects.delete(progressKey(lost.body.id));
    assert.equal(narrationOf(P, r.key), null);
    const running = deliver(P, P.queue.splice(P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"), 1)[0]);
    await g.reached;
    await tick(P);
    assert.deepEqual(narrationOf(P, r.key).taskWords, [{ n: 0, words: ADD }], "the sweep did not open the narration");
    await deliver(P, requestTask(P));
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts[0].said, LINES(ADD));
    g.open();
    await running;
    await settle(P, r.key);
  });
});

test("NAMES 8 — A REQUEST THAT ENDED BEFORE ITS PARTS' LINES WERE WRITTEN, the writer's message lost: the cron asks again once the ask's grace has passed, within the reply's horizon, and the finished card is named by its done line", async () => {
  await withPlatform({ slug: slugOf("names8"), replies: true, progress: true, answers: plainAddon() }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    requestTask(P);
    const { rec } = await settle(P, r.key);
    assert.equal(rec.ended, true);
    assert.equal(narrationOf(P, r.key).tasks, null);
    assert.equal(P.queue.some((m) => anyTask(m) && !P.jobs.has(m.body.id)), false, "the narration was asked for again inside its grace");
    P.advance(PROGRESS_ASK_GRACE_MS + 1000);
    await tick(P);
    await deliver(P, requestTask(P));
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts[0].said, LINES(ADD));
    assert.equal(view.body.request.parts[0].status, "done");
  });
});
