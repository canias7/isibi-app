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
import { checkFacts, readChecks } from "../builder/check-evidence.mjs";

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

test("INSTRUCTIONS ARE NOT CROSSED — the ordinary writer's instructions are unchanged by this batch", () => {
  assert.doesNotMatch(PROGRESS_SYSTEM, /checked|published:|recorded reason|explain/);
});
