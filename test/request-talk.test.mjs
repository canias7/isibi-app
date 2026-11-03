// A MESSAGE ON AN EXISTING SITE TALKS WHILE THE AGENT WORKS (2026-11-02,
// request-talk; the owner: progress lines never showed for a message on an
// existing site — live on copper-kettle-pottery, an answered question's job
// ran 7+ minutes with the chat silent).
//
// The server half, through the REAL Worker (`test/fixtures/request-flow.mjs`):
// the agent's job is a request part's run job; its progress facts land on the
// job's own progress record (keyed by the edit job's id), its writer commits
// the lines, and the request view names the running job (`live`) so the page
// can follow `/api/site/build/<job>/stream`, which serves those same lines.
// When the job ends, `live` goes. The browser half is
// `test/request-talk-browser.test.mjs`.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: the agent's script and the writer's lines are
// the case's.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, call, TOKEN } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

delete process.env.GF_OLD_LANES;

const use = (name, input) => ({ type: "tool_use", id: "t" + Math.random().toString(16).slice(2, 8), name, input });
const isAgent = (args) => (args.tools || []).some((t) => t.name === "finish");
const settleMs = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const gate = () => { let open, reach; const g = { opened: new Promise((r) => { open = r; }), reached: new Promise((r) => { reach = r; }) }; g.open = open; g.reach = reach; return g; };

/** Three rounds that each read a file (three progress facts), then held, then finish. */
function agent(g) {
  const reads = [["index.tsx"], ["visit.tsx"], ["index.tsx", "visit.tsx"]];
  return async (args) => {
    if (!isAgent(args)) return { __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] } };
    const round = (args.messages || []).filter((m) => m.role === "assistant").length;
    if (round < reads.length) return { __raw: { stop_reason: "tool_use", content: [use("read_files", { files: reads[round] })] } };
    g.reach();
    await g.opened;
    return { __raw: { stop_reason: "tool_use", content: [use("finish", { summary: "Nothing needed changing." })] } };
  };
}

/** The first server-sent message of the job's live talk. */
async function firstTalk(P, job) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/build/" + job + "/stream", { headers: { Authorization: TOKEN } }), P.env, ctx);
    assert.equal(res.status, 200, "the job's talk stream refused: " + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (let i = 0; i < 50; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const m = /data: (.*)\n\n/.exec(buf);
      if (m) { try { await reader.cancel(); } catch { /* gone */ } return JSON.parse(m[1]); }
    }
    return null;
  });
}

test("RT1 an agent part's job talks on its own record, the request view names it live, and its stream serves the lines; live goes when it ends", async () => {
  const g = gate();
  const compiler = installCompiler();
  const P = platform({ slug: "rt-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, progress: true, talk: true,
    answers: { "": agent(g) },
    progressWith: ({ facts }) => ({ answer: { text: facts.map((f) => f.text).join(" "), says: facts.map((f) => ({ id: f.id, as: f.state })) } }) });
  const alive = setInterval(() => {}, 1000);
  try {
    const r = await sendMessage(P, { message: "Have a look over the visit page" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    assert.ok(i >= 0, "no job was filed");
    const running = deliver(P, P.queue.splice(i, 1)[0]);
    await g.reached;
    const job = [...P.jobs.values()].find((j) => j.op === "edit");
    assert.ok(job, "no edit job");
    // THE AGENT'S FACTS ON THE EDIT JOB'S OWN RECORD.
    for (let n = 0; n < 400 && !(P.progressOf(job.id) && P.progressOf(job.id).marks.filter((m) => m.stage === "agent").length >= 3); n++) await settleMs();
    const rec = P.progressOf(job.id);
    assert.ok(rec, "the agent's job has no progress record");
    const agentFacts = rec.marks.filter((m) => m.stage === "agent").flatMap((m) => m.facts.map((f) => f.text));
    assert.deepEqual(agentFacts, ["Read the home page.", "Read the /visit page.", "Read the home page and the /visit page."]);
    // ITS WRITER, AS THE QUEUE RUNS IT BESIDE THE JOB.
    for (let round = 0; round < 6; round++) {
      const t = P.queue.findIndex((m) => m.body && m.body.kind === "edit-progress" && m.body.id === job.id);
      if (t < 0) { await settleMs(20); continue; }
      await deliver(P, P.queue.splice(t, 1)[0]);
    }
    const lines = (P.progressOf(job.id).lines || []).map((l) => l.text);
    assert.ok(lines.some((t) => /Read the \/visit page\./.test(t)), "no committed line carries the agent's facts: " + JSON.stringify(lines));
    // THE REQUEST VIEW NAMES THE RUNNING JOB, WITH ITS LINES.
    const view = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const part = view.body.request.parts[0];
    assert.equal(part.live, job.id, "the view does not name the running job: " + JSON.stringify(part));
    assert.deepEqual(part.progress.map((l) => l.text), lines);
    // THE JOB'S LIVE TALK, BY THE EDIT JOB'S ID, SERVES THE SAME LINES.
    const talk = await firstTalk(P, job.id);
    assert.ok(talk && Array.isArray(talk.lines), "the stream sent nothing");
    assert.deepEqual(talk.lines.map((l) => l.text), lines);
    g.open();
    await running;
    await settle(P, r.key, { rounds: 20 });
    const after = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    assert.equal(Object.hasOwn(after.body.request.parts[0], "live"), false, "an ended part still names a live job");
  } finally { clearInterval(alive); P.close(); compiler.uninstall(); }
});
