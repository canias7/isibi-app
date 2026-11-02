// EVERY MESSAGE ABOUT A SITE REACHES THE SITE AGENT (2026-11-02,
// agent-takes-all; the owner: "the agent is supposed to know if its just text
// or build something right" — "do it").
//
// Live on northline-climbing (deploy 2301): "I want to send emails to my
// customers" and "Text my customers a reminder the day before their class"
// were read by the router as conversation (`intent: "ask"`) and answered in
// words by the talk-only reply (`converse`); no job was made and nothing was
// done. These cases run the REAL Worker (the routing route, the request, the
// queue, the edit route) against `test/fixtures/request-flow.mjs`.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: the router's and the agent's answers are the
// case's. Nothing here says what a real model would answer.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T, TOKEN } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

delete process.env.GF_OLD_LANES;

const use = (name, input) => ({ type: "tool_use", id: "t" + Math.random().toString(16).slice(2, 8), name, input });
const isAgent = (args) => (args.tools || []).some((t) => t.name === "finish");

/** The "" answer: the agent's script when the call is the agent's, else a talk-only reply (noted). */
function model(script, log) {
  return (args) => {
    if (isAgent(args)) {
      const round = (args.messages || []).filter((m) => m.role === "assistant").length;
      log.agent++;
      return { __raw: { stop_reason: script[Math.min(round, script.length - 1)].stop || "tool_use", content: script[Math.min(round, script.length - 1)].content } };
    }
    log.converse++;
    return { __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "TALK-ONLY REPLY" }] } };
  };
}

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ slug: "at-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, ...opts });
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}

const ASK = (answer) => [{ intent: "ask", answer }];

for (const [name, message, gist] of [
  ["AT1", "I want to send emails to my customers", "They want to email customers; explain the options."],
  ["AT2", "Text my customers a reminder the day before their class", "Texting may not be possible on this site."],
]) {
  test(name + " a live message the router read as conversation makes an agent job, and the talk-only reply is never called: " + message, async () => {
    const log = { agent: 0, converse: 0 };
    await withPlatform({
      answers: { route: ASK(gist), "": model([{ content: [use("finish", { summary: "Which service do you use for this?" })] }], log) },
    }, async (P) => {
      const r = await sendMessage(P, { message });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.notEqual(r.body.intent, "ask", "still answered as conversation: " + JSON.stringify(r.body));
      assert.ok(r.body.request && r.body.request.parts.length === 1, "no request of one part: " + JSON.stringify(r.body));
      const { rec } = await settle(P, r.key, { rounds: 20 });
      assert.equal(log.converse, 0, "the talk-only reply was called");
      assert.ok(log.agent >= 1, "the agent never ran");
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
      assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 1, "routed once");
    });
  });
}

// THE ROUTER'S OWN QUESTION GOES TO THE AGENT TOO (owner, 2026-11-02). Live on
// copper-kettle-pottery the router answered a payments-and-emails request with
// its own question ("Which should take Stripe…?"), and the agent never saw it.
test("AT5 a live message the router would ask about (clarify) makes an agent job instead: no router question is kept", async () => {
  const log = { agent: 0, converse: 0 };
  await withPlatform({
    answers: { route: [{ intent: "clarify", question: { text: "Which should take Stripe before they are confirmed?", options: ["Class bookings", "Shop orders"] } }],
      "": model([{ content: [use("finish", { summary: "Which payment service do you use?" })] }], log) },
  }, async (P) => {
    const r = await sendMessage(P, { message: "When someone books a class, take payment by card and email them a confirmation" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.notEqual(r.body.intent, "clarify", "the router still asked: " + JSON.stringify(r.body));
    assert.ok(!r.body.question, "a router question was kept: " + JSON.stringify(r.body));
    assert.ok(r.body.request && r.body.request.parts.length === 1, "no request of one part: " + JSON.stringify(r.body));
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.equal(log.converse, 0, "the talk-only reply was called");
    assert.ok(log.agent >= 1, "the agent never ran");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
  });
});

test("AT3 a pure question reaches the agent, its plain-words answer is the reply, and no file changes", async () => {
  const log = { agent: 0, converse: 0 };
  const ANSWER = "Your site has three pages: Home, Visit and Order.";
  await withPlatform({
    answers: { route: ASK("They ask which pages they have."), "": model([{ stop: "end_turn", content: [{ type: "text", text: ANSWER }] }], log) },
  }, async (P) => {
    const before = { home: P.page("index.tsx"), visit: P.page("visit.tsx") };
    const r = await sendMessage(P, { message: "What pages does my site have?" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.equal(log.converse, 0, "the talk-only reply was called");
    assert.equal(log.agent, 1, "one agent round");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
    // THE AGENT'S WORDS ARE THE PART'S REPLY: the edit job's own answer, which the page shows.
    const jobs = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(jobs.length, 1, "one edit job: " + JSON.stringify(jobs.map((j) => [j.op, j.state])));
    const body = JSON.parse(jobs[0].result.body);
    const said = body.msg;
    assert.ok(typeof said === "string" && said.startsWith(ANSWER), "the reply is not the agent's words: " + JSON.stringify(body).slice(0, 800));
    assert.ok(body.ok === true && !body.files && !body.draft, "a save was made for a question: " + JSON.stringify(body).slice(0, 800));
    assert.equal(P.page("index.tsx"), before.home);
    assert.equal(P.page("visit.tsx"), before.visit);
  });
});

test("AT4 control: a message with no site yet keeps today's behaviour (conversation is answered in words)", async () => {
  const log = { agent: 0, converse: 0 };
  await withPlatform({ answers: { route: ASK("They ask what we can build."), "": model([{ content: [use("finish", { summary: "x" })] }], log) } }, async (P) => {
    const worker = await loadWorker();
    const res = await P.run(async () => {
      const ctx = makeCtx();
      const out = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
        method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify({ message: "What kinds of sites can you make?", picker: "sonnet", brief: "", qa: [], hasSite: false }),
      }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      return { status: out.status, body: await out.json() };
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.intent, "ask", JSON.stringify(res.body));
    assert.equal(log.agent, 0, "the agent ran for a message with no site");
    assert.equal(log.converse, 1, "the conversation reply was not written");
  });
});
