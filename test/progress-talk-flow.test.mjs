// THE BUILDER TALKS WHILE IT WORKS — THROUGH THE REAL WORKER (2026-10-13).
//
// The real Worker on the stateful platform (`test/fixtures/request-flow.mjs`):
// the routing route, the queue consumer running each job and each progress
// task, the job poll, the request read, the job gateway, against an
// `edit_jobs` table with leases, a ledger and a bucket with etags. A case
// HOLDS a job mid-way and delivers the progress task beside it, as the real
// queue runs a writer while the job it narrates is still running.
//
// WHAT IT PROVES — STATE, NOT PROSE: with `PROGRESS_TALK` on, which milestones
// a job records and in which state (the opening plan, the checks, the
// publish), that milestones landing together are one writer call, that the
// writer is the conversational one and asks for nothing else, that a line's
// explanation reaches every reader and survives the job's end, that the final
// reply is handed the checks that really ran and no others, that narration
// failing changes nothing about the job, its money or its reply, and that with
// the switch off every one of these is as it was. ⚠ SUPPLIED-MODEL PROOF ONLY:
// every model answer is supplied, so nothing here shows what a real model
// writes, how long it takes, or what it costs.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, tick, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { PROGRESS_SETTLE_S, TALK_SYSTEM, PROGRESS_SYSTEM } from "../builder/site-progress.mjs";

const ADD = "add a gallery page";
const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const slugOf = (k) => "pt-" + k + "-" + Math.random().toString(16).slice(2, 8);
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
const settleMs = (ms = 5) => new Promise((r) => setTimeout(r, ms));
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  const alive = setInterval(() => {}, 1000);
  try { return await fn(P); } finally { clearInterval(alive); P.close(); compiler.uninstall(); }
}
const isJobTask = (id) => (m) => !!(m && m.body && m.body.kind === "edit-progress" && m.body.id === id);
async function jobTask(P, id) {
  for (let n = 0; n < 200 && !P.queue.some(isJobTask(id)); n++) await settleMs();
  const i = P.queue.findIndex(isJobTask(id));
  assert.ok(i >= 0, "the job's milestone asked for no writer");
  return P.queue.splice(i, 1)[0];
}
const writerCalls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const heldAddon = (g) => ({
  route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
  "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
  [T.pages]: { pages: [writtenPage("/gallery")] },
});
/** The add-on job, started and held at its designer. */
async function startAddon(P, g) {
  const r = await sendMessage(P, { message: ADD });
  const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
  assert.ok(i >= 0, "the routing call filed no job");
  const running = deliver(P, P.queue.splice(i, 1)[0]);
  await g.reached;
  const job = [...P.jobs.values()].find((j) => j.op === "addon");
  return { r, job, running };
}
/** Every message still queued, delivered until none is left (the final reply's own task among them). */
async function drain(P) {
  for (let round = 0; round < 12 && P.queue.length; round++) {
    while (P.queue.length) await deliver(P, P.queue.shift());
    await tick(P);
  }
}
const stagesOf = (rec) => rec.marks.map((m) => m.stage);
const factsOf = (rec, stage) => rec.marks.filter((m) => m.stage === stage).flatMap((m) => m.facts);

test("ADD-ON TALKS — its opening plan and its first decision land together and are said in ONE conversational call, asked a few seconds later; the line's explanation reaches the poll and the request view", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("a1"), replies: true, progress: true, talk: true, answers: heldAddon(g),
    progressWith: () => ({ answer: null }),
  }, async (P) => {
    const { r, job, running } = await startAddon(P, g);
    // THE RECORDER'S WRITES LAND IN THE BACKGROUND: the plan, then the decision.
    for (let n = 0; n < 400 && !(P.progressOf(job.id) && P.progressOf(job.id).marks.length >= 2); n++) await settleMs();
    const rec = P.progressOf(job.id);
    assert.equal(rec.talk, true, "the job's record was not opened conversational");
    assert.deepEqual(stagesOf(rec), ["start", "picked"], "the opening plan is not the first milestone");
    assert.deepEqual(factsOf(rec, "start").map((f) => f.state), ["decided", "next"]);
    // THE ASK WAITS A FEW SECONDS, so the plan and the decision are one update.
    const ask = P.sent.find(isJobTask(job.id));
    assert.equal(ask.delaySeconds, PROGRESS_SETTLE_S, "the writer was asked at once, not after the coalescing wait");
    // ONE TASK WAS ASKED FOR BOTH: the second milestone found the ask already made.
    assert.equal(P.sent.filter(isJobTask(job.id)).length, 1, "each milestone asked for its own writer");
    await deliver(P, await jobTask(P, job.id));
    const calls = writerCalls(P, "write_update");
    assert.equal(calls.length, 1, "two close milestones cost " + calls.length + " calls");
    assert.equal(writerCalls(P, "write_progress").length, 0, "the ordinary writer was asked on a conversational record");
    assert.equal(P.progressLog.length, 1);
    const said = P.progressLog[0];
    assert.ok(said.some((f) => /Read the request as an addition/.test(f.text)), "the plan was not in the update");
    assert.ok(said.some((f) => /Worked out what to add: a new page/.test(f.text)), "the decision was not in the update");
    assert.deepEqual(said.filter((f) => f.state === "next").map((f) => f.text), ["Design it next."], "an overtaken 'next' was said");
    assert.match(calls[0].text, /YOU HAVE NOT WRITTEN AN UPDATE YET\./);
    const line = P.progressOf(job.id).lines[0];
    assert.ok(line, "no line was committed");
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(poll.body.progress.length, 1);
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.deepEqual(view.body.request.parts[0].progress.map((l) => [l.job, l.text]), [[job.id, line.text]]);
    g.open();
    await running;
  });
});

test("EXPLANATION — a supplied explanation is committed with its line, carried by the poll, the request view and the finished answer, and kept after the job's end", async () => {
  const g = gate();
  const EXPLAIN = "I'm adding a whole new page rather than changing one you have.";
  await withPlatform({ slug: slugOf("a2"), replies: true, progress: true, talk: true, answers: heldAddon(g),
    progressWith: ({ facts, tool }) => (tool === "write_update" ? { answer: { text: "I'm on it.", explain: EXPLAIN, says: facts.map((f) => ({ id: f.id, as: f.state })) } } : null),
  }, async (P) => {
    const { r, job, running } = await startAddon(P, g);
    await deliver(P, await jobTask(P, job.id));
    assert.equal(P.progressOf(job.id).lines[0].explain, EXPLAIN);
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(poll.body.progress[0].explain, EXPLAIN, "the poll dropped the explanation");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(view.body.request.parts[0].progress[0].explain, EXPLAIN, "the request view dropped the explanation");
    g.open();
    await running;
    await settle(P, r.key);
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.progress[0].explain, EXPLAIN, "the finished answer lost the explanation");
  });
});

test("CHECKS AND PUBLISH — the job records the checks its publish ran and the publish itself, in order, after its plan; nothing says published before the publish; the final reply is handed exactly those as its checks", async () => {
  await withPlatform({ slug: slugOf("a3"), replies: true, progress: true, talk: true, answers: {
    route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
    "add:page": { page: [PAGE("/gallery", "Gallery")] },
    [T.pages]: { pages: [writtenPage("/gallery")] },
  } }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    await drain(P);
    await settle(P, r.key);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    assert.equal(P.jobs.get(job.id).state, "done", "the job did not finish");
    const rec = P.progressOf(job.id);
    const stages = stagesOf(rec);
    assert.equal(stages[0], "start");
    for (const s of ["picked", "publish", "checked", "published"]) assert.ok(stages.includes(s), "missing " + s + ": " + stages.join(","));
    assert.ok(stages.indexOf("publish") < stages.indexOf("checked") && stages.indexOf("checked") < stages.indexOf("published"), "out of order: " + stages.join(","));
    const firstPublished = rec.marks.findIndex((m) => m.facts.some((f) => f.state === "published"));
    assert.equal(rec.marks[firstPublished].stage, "published", "a fact before the publish said published");
    const checks = factsOf(rec, "checked");
    assert.ok(checks.some((f) => f.state === "checked" && /built without errors/.test(f.text)));
    assert.ok(checks.some((f) => /automated check/.test(f.text)), "the browser check was not said as automated");
    assert.ok(rec.closed, "the record was not closed at the job's end");
    // THE FINAL REPLY'S CHECKS: the record's checked and published facts, as k facts, and no others.
    const reply = P.replyLog.find((facts) => facts.some((f) => f.id.startsWith("k")));
    assert.ok(reply, "the final reply was not handed the checks: " + JSON.stringify(P.replyLog.map((f) => f.map((x) => x.id))));
    const ks = reply.filter((f) => f.id.startsWith("k")).map((f) => f.text);
    const want = rec.marks.flatMap((m) => m.facts).filter((f) => f.state === "checked" || f.state === "published").map((f) => f.text);
    assert.deepEqual(ks, [...new Set(want)]);
    const sys = P.modelLog.filter((m) => m.tool === "write_reply").map((m) => m.system);
    assert.ok(sys.length > 0, "no final reply was written");
    assert.ok(sys.every((s) => typeof s === "string" && /THEY HAVE BEEN FOLLOWING YOUR UPDATES/.test(s)), "the final reply was not told it follows a conversation");
  });
});

test("OFF IS AS BEFORE — the same add-on with the switch off: no plan, no check or publish milestone, the ordinary writer asked at once, and a final reply with no checks", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("off"), replies: true, progress: true, answers: heldAddon(g) }, async (P) => {
    const { r, job, running } = await startAddon(P, g);
    for (let n = 0; n < 200 && !P.queue.some(isJobTask(job.id)); n++) await settleMs();
    const rec = P.progressOf(job.id);
    assert.equal(Object.hasOwn(rec, "talk"), false);
    assert.deepEqual(stagesOf(rec), ["picked"]);
    assert.ok(P.modelLog.filter((m) => m.tool === "write_reply").every((m) => !/THEY HAVE BEEN FOLLOWING/.test(m.system)));
    assert.equal(P.sent.find(isJobTask(job.id)).delaySeconds, 0, "the ordinary writer waited");
    await deliver(P, await jobTask(P, job.id));
    assert.equal(writerCalls(P, "write_update").length, 0);
    assert.equal(writerCalls(P, "write_progress").length, 1);
    g.open();
    await running;
    await drain(P);
    await settle(P, r.key);
    const after = P.progressOf(job.id);
    assert.ok(!stagesOf(after).some((s) => s === "start" || s === "checked" || s === "published"), stagesOf(after).join(","));
    assert.ok(P.replyLog.every((facts) => !facts.some((f) => f.id.startsWith("k"))), "a final reply was handed checks with the switch off");
  });
});

test("NARRATION FAILING CHANGES NOTHING — every conversational call refused by the provider: the job still finishes, publishes, charges and replies exactly as it would, and no line is ever shown", async () => {
  await withPlatform({ slug: slugOf("fail"), replies: true, progress: true, talk: true,
    progressWith: () => ({ status: 500 }),
    answers: { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
  }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    await drain(P);
    await settle(P, r.key);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    assert.equal(P.jobs.get(job.id).state, "done", "narration failing changed the job's outcome");
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(fin.body.ok, true);
    assert.equal(fin.body.replySource, "model", "narration failing cost the final reply");
    assert.equal(fin.body.progress, undefined, "a line was shown though none was written");
    assert.equal(P.progressOf(job.id).lines.length, 0);
  });
});

test("EDIT TALKS — an edit's opening plan names the kind of change the route sent, before its own plan of steps; its checks and publish follow; its writer is the conversational one", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("e1"), replies: true, progress: true, talk: true, answers: {
    route: [{ intent: "edit", layer: "look" }],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
    "lane:description": async () => { g.reach(); await g.opened; return NEW_DESC; },
  } }, async (P) => {
    const r = await sendMessage(P, { message: DESC });
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    assert.ok(i >= 0, "no edit job");
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    const job = [...P.jobs.values()].find((j) => j.op === "edit");
    for (let n = 0; n < 200 && !P.queue.some(isJobTask(job.id)); n++) await settleMs();
    const rec = P.progressOf(job.id);
    assert.equal(rec.talk, true);
    assert.equal(stagesOf(rec)[0], "start");
    assert.match(factsOf(rec, "start")[0].text, /change to what the site already has: how the site looks or is laid out/);
    await deliver(P, await jobTask(P, job.id));
    assert.equal(writerCalls(P, "write_update").length, 1);
    assert.equal(writerCalls(P, "write_update")[0].system, TALK_SYSTEM, "the conversational writer was not given its instructions");
    g.open();
    await running;
    await drain(P);
    await settle(P, r.key);
    const after = stagesOf(P.progressOf(job.id));
    for (const s of ["start", "plan", "publish", "checked", "published"]) assert.ok(after.includes(s), "missing " + s + ": " + after.join(","));
    assert.ok(after.indexOf("start") < after.indexOf("plan"), "the plan of steps came before the opening plan");
  });
});

test("PARALLEL — an edit and an add-on in one request: each job's updates stay on its own part, each writer is told the other part as it stands, and the request itself writes no line of its own", async () => {
  const g1 = gate(), g2 = gate();
  await withPlatform({ slug: slugOf("par"), replies: true, progress: true, talk: true, answers: {
    route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
    "lane:description": async () => { g1.reach(); await g1.opened; return NEW_DESC; },
    [T.adds]: { kinds: ["page"] },
    "add:page": async () => { g2.reach(); await g2.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
    [T.pages]: { pages: [writtenPage("/gallery")] },
  } }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const parts = () => P.record(r.key).parts;
    assert.equal(parts().length, 2);
    const i0 = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    const run0 = deliver(P, P.queue.splice(i0, 1)[0]);
    await g1.reached;
    const job0 = [...P.jobs.values()].find((j) => j.op === "edit");
    await deliver(P, await jobTask(P, job0.id));
    const ctx0 = writerCalls(P, "write_update").at(-1).text;
    assert.match(ctx0, /THE OTHER PARTS OF THE SAME REQUEST/);
    assert.ok(!P.progressLog.at(-1).some((f) => /addition/.test(f.text)), "the edit's update was handed the add-on's facts");
    g1.open();
    await run0;
    const isAddonJob = (m) => !!(m && m.body && m.body.kind === "site-edit" && P.jobs.has(m.body.id) && P.jobs.get(m.body.id).op === "addon");
    let run1 = null;
    for (let round = 0; round < 8 && !run1; round++) {
      while (P.queue.length && !run1) {
        const i = P.queue.findIndex(isAddonJob);
        if (i >= 0) { run1 = deliver(P, P.queue.splice(i, 1)[0]); break; }
        await deliver(P, P.queue.shift());
      }
      if (!run1) await tick(P);
    }
    assert.ok(run1, "part 1 was never filed");
    await g2.reached;
    const job1 = [...P.jobs.values()].find((j) => j.op === "addon");
    await deliver(P, await jobTask(P, job1.id));
    assert.ok(P.progressLog.at(-1).some((f) => /addition/.test(f.text)), "the add-on's update lacks its own plan");
    g2.open();
    await run1;
    await drain(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"]);
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const [p0, p1] = view.body.request.parts;
    assert.ok((p0.progress || []).every((l) => l.job === job0.id), "a line of another job was shown on the edit's part");
    assert.ok((p1.progress || []).every((l) => l.job === job1.id), "a line of another job was shown on the add-on's part");
    assert.ok(writerCalls(P, "write_update").every((c) => !/write_tasks/.test(c.tool)));
  });
});

test("INSTRUCTIONS ARE NOT CROSSED — the ordinary writer's instructions are unchanged by this batch", () => {
  assert.doesNotMatch(PROGRESS_SYSTEM, /checked|published:|recorded reason|explain/);
});

test("CLARIFICATION — a job that stops to ask: its record closes with the job, nothing is said after it, and the question reaches the customer as the job's own answer", async () => {
  await withPlatform({ slug: slugOf("ask"), replies: true, progress: true, talk: true, answers: {
    route: [{ intent: "addon" }],
    [T.adds]: { question: { text: "Should the gallery show every loaf, or only today's bake?", options: ["Every loaf", "Today's bake"] } },
  } }, async (P) => {
    const r = await sendMessage(P, { message: ADD });
    await drain(P);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    assert.ok(job, "no add-on job");
    const rec = P.progressOf(job.id);
    assert.ok(rec && rec.closed, "the record is open after the job stopped to ask");
    assert.ok(!rec.marks.some((m) => m.facts.some((f) => f.state === "checked" || f.state === "published")), "a job that only asked recorded a check or a publish");
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const part = view.body.request.parts[0];
    assert.ok(part.question || part.status === "waiting" || part.status === "approval", "the part does not wait on the question: " + JSON.stringify(part).slice(0, 300));
    const linesAfter = rec.lines.filter((l) => l.confirmed === true && l.at > rec.closed.at);
    assert.deepEqual(linesAfter, [], "a line was confirmed after the job ended");
  });
});

test("LATE AND TWICE — a writer task delivered after its job ended writes nothing and calls no model; the same task delivered twice side by side makes one call", async () => {
  const g = gate();
  await withPlatform({ slug: slugOf("late"), replies: true, progress: true, talk: true, answers: heldAddon(g) }, async (P) => {
    const { r, job, running } = await startAddon(P, g);
    for (let n = 0; n < 400 && !(P.progressOf(job.id) && P.progressOf(job.id).marks.length >= 2); n++) await settleMs();
    const task = await jobTask(P, job.id);
    await Promise.all([deliver(P, task), deliver(P, { ...task, body: { ...task.body } })]);
    assert.equal(writerCalls(P, "write_update").length, 1, "two deliveries of one task made two calls");
    g.open();
    await running;
    await settle(P, r.key);
    const before = writerCalls(P, "write_update").length;
    await deliver(P, { ...task, body: { ...task.body } });
    assert.equal(writerCalls(P, "write_update").length, before, "a writer called the model for a job that had ended");
    const rec = P.progressOf(job.id);
    assert.ok(rec.closed);
    assert.ok(rec.lines.every((l) => l.at <= rec.closed.at), "a line was committed after the job ended");
  });
});
