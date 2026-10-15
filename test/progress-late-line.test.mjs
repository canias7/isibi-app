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

test("LATE 1 — a job that ended before its line was written gets ONE late line, from its applied facts only: committed, confirmed, marked late, and served by the job poll", async () => {
  await withPlatform({ slug: slugOf("ok"), db: loavesDb(), progress: true, answers: ANSWERS }, async (P) => {
    const { job, held } = await runShort(P);
    assert.equal(P.jobs.get(job.id).state, "done");
    const closed = P.progressOf(job.id);
    assert.ok(closed && closed.closed && closed.closed.why === "ended", JSON.stringify(closed && closed.closed));
    assert.equal(closed.lines.length, 0, "the case did not reproduce a job shorter than its writer");
    assert.ok(lateNeeded(closed), "a closed record with applied facts owes no late line");
    for (const m of held) await deliver(P, m);
    for (let n = 0; n < 10 && P.queue.some(isTask); n++) { const m = P.queue.splice(P.queue.findIndex(isTask), 1)[0]; await deliver(P, m); }
    const rec = P.progressOf(job.id);
    assert.equal(rec.lines.length, 1, "the progress the job made disappeared");
    const l = rec.lines[0];
    assert.equal(l.late, true);
    assert.equal(l.confirmed, true);
    const facts = rec.marks.filter((m) => l.marks.includes(m.n)).flatMap((m) => m.facts);
    // what the writer was shown: final facts only (the stand-in writes them back)
    for (const f of facts.filter((x) => l.text.includes(x.text))) assert.ok(FINAL.includes(f.state), "a " + f.state + " fact was said after the job ended: " + f.text);
    assert.ok(!/not published yet|nothing is built yet|now\b/i.test(l.text), "stale working words after the end: " + l.text);
    assert.equal(rec.lateWhy, "said");
    const poll = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(poll.status, 200);
    assert.deepEqual((poll.body.progress || []).map((x) => [x.text, x.late]), [[l.text, true]]);
  });
});

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

test("LATE 4 — the job's own close asks for the late line when no ask is outstanding: through the gateway, the close queues a writer and the line is written; and a late line given up for good is owed no more", async () => {
  await withPlatform({ slug: slugOf("cl"), db: loavesDb(), progress: true, answers: ANSWERS }, async (P) => {
    const { job } = await runShort(P);
    const was = P.progressOf(job.id);
    assert.ok(was && was.closed && lateNeeded(was), "the case did not reproduce a closed record owing its late line");
    // THE SAME RECORD JUST BEFORE ITS CLOSE, with no writer asked for: every
    // earlier ask has been answered or has lapsed, so only the close can ask.
    const open = { ...was, closed: null, asked: 0, retryAt: undefined, writer: null, marks: was.marks.map((m) => (m.state === "skipped" ? { ...m, state: "pending", why: undefined } : m)) };
    P.writeObj("jobs/" + job.id + ".progress.json", JSON.stringify(open));
    P.queue.splice(0, P.queue.length);
    P.env.SITE_SECRETS_KEY = "platform-secret";
    const tok = await signJobToken({ id: job.id, slug: P.slug, uid: USER.id, exp: Math.floor(Date.now() / 1000) + 600 }, await gatewayKey("platform-secret"));
    const res = await call(P, "POST", "/api/job/" + job.id + "/progress", { op: "close", run: was.run, why: "ended" }, "Bearer " + tok);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(P.progressOf(job.id).closed, "the close did not close the record");
    assert.ok(P.queue.some(isTask), "the close asked for no writer: the late line it owes would never be written");
    for (let n = 0; n < 10 && P.queue.some(isTask); n++) { const m = P.queue.splice(P.queue.findIndex(isTask), 1)[0]; await deliver(P, m); }
    assert.equal(P.progressOf(job.id).lines.filter((l) => l.late).length, 1, "the close's ask did not write the late line");
  });
  let rec = openRecord({ job: "b".repeat(32), uid: "u1", slug: "pl-pure", op: "edit", run: "run_1", at: 1000, words: "w" });
  rec = appendMark(rec, { stage: "applied", at: 1200, facts: [{ state: "applied", text: "Changed in the site's database: price." }] }).rec;
  const ended = closeRecord(rec, "ended", 2000);
  assert.ok(lateNeeded(ended));
  const c = claimWriter(ended, "w1", 3000);
  const gone = failLate(c.rec, { owner: "w1", why: "replied", now: 3100, final: true });
  assert.ok(gone && gone.retry === false);
  assert.equal(lateNeeded(gone.rec), false, "a late line given up for good was still owed — a writer would be asked again and again");
  assert.equal(claimWriter(gone.rec, "w2", 3200), null);
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
