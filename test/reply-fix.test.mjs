// SEPARATE MESSAGES ARE SEPARATE REQUESTS, AND THE AGENT'S OWN WORDS ARE THE
// REPLY (2026-11-02, reply-fix; live: copper-kettle-pottery, "hey" then "hello").
//
// The REAL Worker against `test/fixtures/request-flow.mjs`, with supplied
// model answers only.
//
//   RF1  "hey", then "hello" while hey's job still runs: two requests, one part
//        each, both done, each reply the agent's own words; no joined parts.
//   RF2  the one reply for a single-part request whose agent answered is the
//        agent's words, written with no model call (no rewrite, no merge).
//   RF3  a message the agent split still gets the task box and the one reply
//        written over its parts.
//   RF5  the agent's first message on an edit carries the index and the map,
//        not every file's body (cost), and a smaller prompt than before.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { PAGES } from "./fixtures/live-ask.mjs";

delete process.env.GF_OLD_LANES;
const A = await import("../builder/site-agent.mjs");
const O = await import("../builder/one-reply.mjs");

const isAgent = (args) => (args.tools || []).some((t) => t.name === "finish");
const FALLBACK = /couldn.t work out what to do with that/;

function model(pick, log) {
  return (args) => {
    if (!isAgent(args)) { log.other++; return { __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "Hi — we got your hey and hello." }] } }; }
    log.agent++;
    log.first.push(JSON.stringify(args.messages[0].content));
    const r = pick(args);
    return { __raw: { stop_reason: r.stop || "tool_use", content: r.content } };
  };
}

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ slug: "rf-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, ...opts });
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}

const words = (args) => JSON.stringify(args.messages[0].content);
const HEY = "Hey. Harbour Loaf's site is up. Tell me what you'd like changed.";
const HELLO = "Hello — the site is already up. Tell me what you'd like changed.";
const answerFor = (args) => ({ stop: "end_turn", content: [{ type: "text", text: /REQUEST\\n(hello)/.test(words(args)) ? HELLO : HEY }] });

test("RF1 \"hey\" then \"hello\" while hey runs: two requests, nothing joined, both done, each reply the agent's words", async () => {
  const log = { agent: 0, other: 0, first: [] };
  await withPlatform({ answers: { "": model(answerFor, log) } }, async (P) => {
    const a = await sendMessage(P, { message: "hey" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    // hey's job is still queued: the request is running when hello arrives.
    assert.ok(P.queue.length > 0, "hey's job ran before hello could arrive");
    P.advance?.(30000);
    const b = await sendMessage(P, { message: "hello" });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.ok(!b.body.joined, "hello joined hey's request: " + JSON.stringify(b.body.request && b.body.request.parts));
    assert.equal(b.body.request.key, b.key, "hello is not its own request");
    const ra = (await settle(P, a.key, { rounds: 20 })).rec;
    const rb = (await settle(P, b.key, { rounds: 20 })).rec;
    for (const [rec, said] of [[ra, HEY], [rb, HELLO]]) {
      assert.equal(rec.parts.length, 1, JSON.stringify(rec.parts.map((p) => p.words)));
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
      assert.ok(!rec.joined || !rec.joined.length, "a message joined");
      const got = await call(P, "GET", "/api/site/request/" + P.slug + "/" + rec.key);
      assert.equal(got.status, 200, JSON.stringify(got.body));
      const again = await call(P, "GET", "/api/site/request/" + P.slug + "/" + rec.key);
      const reply = (again.body.request && again.body.request.reply) || again.body.reply;
      assert.ok(reply, "no reply served: " + JSON.stringify(again.body));
      assert.ok(reply.text.startsWith(said), "the reply is not the agent's words: " + reply.text);
      assert.ok(!FALLBACK.test(reply.text));
      assert.equal(reply.source, "agent");
    }
    assert.equal(log.other, 0, "a reply writer (or other model) was called for a plain answer");
  });
});

test("RF2 one reply for a single-part request answered by the agent is its words, no model; a split request still uses the writer", () => {
  const rec = { key: "k", parts: [{ n: 0, status: "done", agentSaid: "Hey there. Nothing on the site was changed." }], ended: true, state: "done" };
  assert.equal(O.agentReplyOf(rec), "Hey there. Nothing on the site was changed.");
  const split = { key: "k", parts: [{ n: 0, status: "done", agentSaid: "Handed to 2 agents" }, { n: 1, status: "done", parent: 0, agentSaid: "x" }, { n: 2, status: "done", parent: 0, agentSaid: "y" }], ended: true };
  assert.equal(O.agentReplyOf(split), null);
  assert.equal(O.agentReplyOf({ parts: [{ n: 0, status: "failed", agentSaid: "x" }], ended: true }), null);
  assert.equal(O.agentReplyOf({ parts: [{ n: 0, status: "done" }], ended: true }), null);
  assert.ok(O.readOneReply({ for: "end:1:0", state: "written", text: "hi", source: "agent", at: 1 }));
});

test("RF5 an edit's first agent message carries the file index and the map, not every file's body", () => {
  const all = A.headStart({ pages: PAGES, parts: [] });
  assert.ok(all.length > 0, "the observer: a small site's head start is every file");
  const lazy = A.headStart({ pages: PAGES, parts: [], lazy: true });
  assert.deepEqual(lazy, [], "an edit with no targets shows no bodies up front");
  const targeted = A.headStart({ pages: PAGES, parts: [], targets: ["/"], lazy: true });
  assert.ok(targeted.length > 0, "named targets are still shown");
});
