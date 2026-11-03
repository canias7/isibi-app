// A SHORT JOB'S PROGRESS NEVER DISAPPEARS, AND NEVER ARRIVES AS STALE "WORKING"
// WORDS (2026-10-15, after run 38649153034's price change: its job ran
// 22:49:12–22:49:29, its line's call answered at 22:49:32, and the line was
// dropped — the part showed no progress line at all).
//
// A job that ends before its line is written is told in ONE line written
// after its end (`late`), from what it settled that is still true afterwards
// — applied, not done, checked, published — never what it was doing, what
// came next, or an in-between state ("nothing is built yet", "not published
// yet"). It is committed only when the job's row reads done and its final
// reply is not written; a job that failed, or whose reply is already out, gets
// none. The job never waits for a line.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, call, deliver, settle, pump, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { gatewayKey, signJobToken } from "../builder/job-gateway.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { lateBatch, lateNeeded, commitLate, failLate, claimWriter, closeRecord, appendMark, openRecord, linesOf } from "../builder/site-progress.mjs";

const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "price", type: "numeric" }], read: "public", write: "none" }] };
const loavesDb = () => rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
const slugOf = (k) => "pl-" + k + "-" + Math.random().toString(16).slice(2, 8);
const RYE = "make the Dark Rye £5.50";
const ANSWERS = { route: [{ intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] }], write_row_changes: { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] } };
const isTask = (m) => !!(m && m.body && m.body.kind === "edit-progress");
const FINAL = ["applied", "notdone", "checked", "published"];

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}

/** The data job run to its end with NO progress task delivered meanwhile: the shape of a job shorter than its writer. */
async function runShort(P) {
  const r = await sendMessage(P, { message: RYE });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const held = [];
  for (let n = 0; n < 40; n++) {
    const i = P.queue.findIndex((m) => !isTask(m));
    if (i < 0) break;
    const m = P.queue.splice(i, 1)[0];
    await deliver(P, m);
    for (let k = P.queue.length - 1; k >= 0; k--) if (isTask(P.queue[k])) held.push(P.queue.splice(k, 1)[0]);
  }
  const job = [...P.jobs.values()].find((j) => j.op === "edit");
  assert.ok(job, "no edit job");
  return { r, job, held };
}

test("LATE 2 controls — no late line for a job whose final reply is already written, and none twice; a delivery after the reply calls no model", async () => {
  await withPlatform({ slug: slugOf("rep"), db: loavesDb(), progress: true, replies: true, answers: ANSWERS }, async (P) => {
    const { r, job, held } = await runShort(P);
    await settle(P, r.key);
    await pump(P);
    const rp = P.readObj("edit-replies/" + job.id + ".json");
    assert.ok(rp && JSON.parse(rp).state === "written", "the reply was not written first: " + rp);
    const writes = P.modelLog.filter((m) => m.tool === "write_progress").length;
    for (const m of held) await deliver(P, m);
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.filter((x) => x.late).length, 0, "a line appeared after the final reply");
    assert.equal(P.modelLog.filter((m) => m.tool === "write_progress").length, writes, "the writer called the model after the reply was written");
  });
});

test("LATE 3 — pure rules: only final facts, only for a job that ended as it should, at most once; doing/next/decided/designed/prepared never", () => {
  let rec = openRecord({ job: "a".repeat(32), uid: "u1", slug: "pl-pure", op: "edit", run: "run_1", at: 1000, words: "w" });
  assert.ok(rec, "the record did not open");
  rec = appendMark(rec, { stage: "decided", at: 1100, facts: [{ state: "decided", text: "Read the request. Nothing is built yet." }] }).rec;
  rec = appendMark(rec, { stage: "applied", at: 1200, facts: [{ state: "applied", text: "Changed in the site's database: price." }, { state: "doing", text: "Publishing now." }, { state: "next", text: "Then the check." }] }).rec;
  rec = appendMark(rec, { stage: "made", at: 1300, facts: [{ state: "prepared", text: "Made, not published yet: a page." }, { state: "designed", text: "Designed, not built yet: a page." }] }).rec;
  const failed = closeRecord(rec, "failed", 2000);
  assert.equal(lateNeeded(failed), false, "a job that failed was given a late line");
  const cancelled = closeRecord(rec, "cancelled", 2000);
  assert.equal(lateNeeded(cancelled), false);
  const ended = closeRecord(rec, "ended", 2000);
  const b = lateBatch(ended);
  assert.deepEqual(b.facts.map((f) => f.state), ["applied"]);
  assert.deepEqual(b.marks, [1]);
  const c = claimWriter(ended, "w1", 3000);
  assert.ok(c && c.claimed);
  const said = commitLate(c.rec, { owner: "w1", marks: b.marks, text: "I changed the price in the database.", now: 3100 });
  assert.ok(said);
  assert.deepEqual(linesOf(said).map((l) => [l.text, l.late]), [["I changed the price in the database.", true]]);
  assert.equal(lateNeeded(said), false, "a second late line could be owed");
  assert.equal(claimWriter(said, "w2", 3200), null, "a writer could claim the record again");
});

test("LATE 5 — a late summary is never shown as live progress: the browser's reader keeps it marked late, and the list never draws it as the live line, even on a card still running (the canary's live check reads `li.live`)", async () => {
  const { createRequire } = await import("node:module");
  const { readFileSync } = await import("node:fs");
  const vm = await import("node:vm");
  const EP = createRequire(import.meta.url)("../public/edit-poll.js");
  const lines = EP.progressLines({ progress: [{ n: 0, ms: 10, text: "I'm reading the request." }, { n: 1, ms: 900, text: "I changed the price.", late: true }] });
  assert.deepEqual(lines.map((l) => [l.text, l.late === true]), [["I'm reading the request.", false], ["I changed the price.", true]]);
  const js = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (h) => { const o = js.indexOf("\n" + h); assert.ok(o > 0, h); return js.slice(o, js.indexOf("\n}\n", o) + 3); };
  const ctx = vm.createContext({});
  vm.runInContext(cut("function esc(") + cut("function progressListHTML("), ctx);
  const html = vm.runInContext("progressListHTML", ctx)(lines, true);
  assert.ok(!/<li class="live">I changed the price/.test(html), "a late summary was drawn as the live line: " + html);
  assert.match(html, /<li class="late">I changed the price\./);
  // control: an ordinary last line on a running card is still live
  const live = vm.runInContext("progressListHTML", ctx)(lines.slice(0, 1), true);
  assert.match(live, /<li class="live">I&#39;m reading the request\.|<li class="live">I'm reading the request\./);
});
