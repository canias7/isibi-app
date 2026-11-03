// THREE FIXES (owner, 2026-11-03: "fix this: a first build can finish with no
// pages; it can stay silent when it needs keys; a queued message can get stuck").
//
//   TF1  a first build whose agent only talks and finishes never ends "ok"
//        with no pages: `finish` is refused, the agent is told to write them.
//   TF2  the same agent that writes, builds and finishes is let through.
//   TF3  a reply for a part that still needs keys names the keys, after the
//        agent's own words; with no words, the keys line alone.
//   TF4  a request that already ended lets the message waiting behind it go
//        when it is advanced (the "hello ?" that waited).
//
// ⚠ SUPPLIED-MODEL PROOF ONLY.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, NO_PAGES_YET } from "../builder/site-agent.mjs";
import { agentReplyOf } from "../builder/one-reply.mjs";
import { platform, sendMessage, call } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

delete process.env.GF_OLD_LANES;

const use = (name, input, id) => ({ type: "tool_use", id, name, input });
const HOME = "export default function Home(){return <main><h1>Nimbus</h1></main>}\n";

function scripted(rounds, seen) {
  return async (req) => {
    seen.push(req);
    const c = rounds[Math.min(seen.length - 1, rounds.length - 1)];
    return { stop_reason: c.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn", content: c, usage: { input_tokens: 100, output_tokens: 50 } };
  };
}
const toolResults = (seen) => seen.flatMap((r) => r.messages.filter((m) => m.role === "user").flatMap((m) => (Array.isArray(m.content) ? m.content : [])))
  .map((b) => (b && (b.content || b.text)) || "").map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");

test("TF1 a first build that never writes a page cannot finish ok", async () => {
  const seen = [];
  const rounds = [
    [use("finish", { summary: "Done." }, "f1")],
    [{ type: "text", text: "All set!" }],
    [use("finish", { summary: "Done." }, "f2")],
  ];
  const r = await runSiteAgent({ send: scripted(rounds, seen), build: async () => ({ ok: true }) },
    { request: "make a site for Nimbus", pages: [], parts: [], model: "claude-sonnet-4-5", foundationFirst: true, maxRounds: 4 });
  assert.equal(r.ok, false, "a first build with no pages ended ok");
  assert.ok(toolResults(seen).includes(NO_PAGES_YET), "the agent was not told it has no pages");
});

test("TF2 a first build that writes the home page, builds and finishes is ok", async () => {
  const seen = [];
  const rounds = [
    [use("write_file", { file: "index.tsx", source: HOME }, "w1")],
    [use("build", {}, "b1")],
    [use("finish", { summary: "Built the home page." }, "f1")],
    [use("finish", { summary: "Built the home page." }, "f2")],
  ];
  const r = await runSiteAgent({ send: scripted(rounds, seen), build: async () => ({ ok: true }) },
    { request: "make a site for Nimbus", pages: [], parts: [], model: "claude-sonnet-4-5", foundationFirst: true, maxRounds: 6 });
  assert.equal(r.ok, true, "stopped: " + r.stopped + " " + toolResults(seen).slice(-400));
  assert.ok(!toolResults(seen).includes(NO_PAGES_YET));
});

test("TF3 keys still needed are named in the reply, never silent", () => {
  const part = (extra) => ({ parts: [{ n: 0, status: "done", ...extra }] });
  assert.equal(agentReplyOf(part({ agentSaid: "Added Stripe checkout." })), "Added Stripe checkout.");
  const one = agentReplyOf(part({ agentSaid: "Added Stripe checkout.", needKeys: [{ name: "STRIPE_SECRET_KEY", service: "Stripe" }] }));
  assert.match(one, /^Added Stripe checkout\.\n\nTo finish this, add your key `STRIPE_SECRET_KEY` \(Stripe\)/);
  const two = agentReplyOf(part({ needKeys: [{ name: "STRIPE_SECRET_KEY" }, { name: "STRIPE_WEBHOOK_SECRET" }] }));
  assert.match(two, /`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`/);
  assert.equal(agentReplyOf(part({ needKeys: [{ name: "not a key" }] })), null, "a bad name is not a key");
});

test("TF4 an already-ended request lets the queued message behind it start", async () => {
  const compiler = installCompiler();
  const P = platform({ slug: "tf-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, answers: { "": () => ({ __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "Hi." }] } }) } });
  try {
    const a = await sendMessage(P, { message: "add a gallery" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    P.advance(10000);
    const b = await sendMessage(P, { message: "hello ?" });
    assert.equal(P.record(b.key).queued, true, "hello was not queued");
    // THE FIRST ENDED SOMEWHERE ELSE, without the hand-off that starts the next.
    const recA = P.record(a.key);
    P.writeObj("requests/" + P.slug + "/" + a.key + ".json", JSON.stringify({ ...recA, ended: true, endedAt: Date.now() }));
    assert.equal(P.jobsOf(b.key).length, 0);
    await call(P, "GET", "/api/site/request/" + P.slug + "/" + a.key);
    assert.equal(P.record(b.key).queued, false, "hello stayed queued behind an ended request");
    assert.equal(P.jobsOf(b.key).length, 1, "hello's job was not filed");
  } finally { P.close(); compiler.uninstall(); }
});
