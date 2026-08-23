// THE BUILD QUEUE, GUARDED AT BOTH ENDS.
//
// Why it exists at all is in wrangler.jsonc: a build runs inside an HTTP request
// and survives a dropped connection only through `ctx.waitUntil`, which
// Cloudflare documents as 30 seconds. A build takes 6-12 minutes. Every build
// this platform has run has had its connection reset mid-flight; the ones that
// published did so because the reset landed somewhere Cloudflare did not see.
//
// Every check here holds something whose absence is silent. A producer writing
// to a queue nobody consumes drops builds with no error. A binding with no
// handler does the same. A queue name that drifts between the two halves is the
// same failure wearing a typo. None of those fails a deploy, and none of them
// shows up anywhere except as customers not getting sites.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const RAW = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
// Whole-line comments only. Blanking from any `//` eats a line holding a URL,
// and this file is full of prose — the rule site-locale.mjs's guard already
// lives under, and the one a whole-file blanker on worker.js breaks (measured:
// it eats 46% of that file).
const CONFIG = JSON.parse(RAW.replace(/^\s*\/\/.*$/gm, ""));
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const DEPLOY = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

test("the producer and the consumer name the SAME queue", () => {
  const q = CONFIG.queues;
  assert.ok(q, "the queues block is gone — builds would fall back to the 30-second waitUntil window");
  const produced = (q.producers || []).map((p) => p.queue);
  const consumed = (q.consumers || []).map((c) => c.queue);
  assert.ok(produced.length, "no producer: nothing can enqueue a build");
  assert.ok(consumed.length, "no consumer: enqueued builds pile up and expire, silently");
  // THE FAILURE THIS CATCHES IS A TYPO. Cloudflare does not refuse a producer
  // pointed at a queue with no consumer — the messages are simply never
  // delivered, and every build vanishes with no error anywhere.
  for (const name of produced) {
    assert.ok(consumed.includes(name),
      `nothing consumes "${name}" — every build written to it is lost with no error`);
  }
});

test("the binding has a handler, and the handler has a binding", () => {
  const bindings = (CONFIG.queues.producers || []).map((p) => p.binding);
  assert.ok(bindings.length, "the producer binding is gone");
  // Either half alone passes while the wire is cut — the shape this repo has
  // recorded twelve features dying in. Asserted apart.
  assert.match(WORKER, /^\s*async queue\(/m,
    "wrangler declares a queue consumer and worker.js exports no queue() handler — " +
    "messages are delivered to nothing and expire");
  for (const b of bindings) {
    assert.match(RAW, new RegExp(`"binding":\\s*"${b}"`),
      `the producer binding ${b} is declared nowhere`);
  }
});

test("one build per invocation — the 15 minutes is per invocation, not per build", () => {
  const c = (CONFIG.queues.consumers || [])[0];
  assert.ok(c, "no consumer to check");
  // A batch of two puts the second build's whole run inside whatever the first
  // one left over. That is the ceiling this feature exists to escape, restored
  // one layer down and much harder to see.
  assert.equal(c.max_batch_size, 1,
    "max_batch_size must be 1 — batched builds share one invocation's 15 minutes");
  // Retries are the difference between a build that fails and a build that is
  // lost. Zero retries would make a queued build no more durable than today's.
  assert.ok(Number(c.max_retries) >= 1,
    "max_retries must allow at least one more attempt, or a queued build is as fragile as an HTTP one");
});

test("the queue is CREATED by the deploy, before anything binds to it", () => {
  // A binding naming a resource the account does not hold fails the WHOLE
  // deploy — three merges shipped nothing that way on 2026-08-07, and a Worker
  // route did it again on a zone with no Cloudflare for SaaS. So the create step
  // must exist AND must run before the deploy that reads the binding.
  const create = DEPLOY.indexOf("queues create");
  assert.ok(create > 0, "the deploy no longer creates the queue — a fresh account's deploy would fail");
  const deployStep = DEPLOY.indexOf("wrangler-action");
  assert.ok(deployStep > 0, "could not find the deploy step — this check would be vacuous");
  assert.ok(create < deployStep,
    "the queue is created AFTER the deploy that binds to it, so the first deploy fails");
  // Every queue the config names must be the one the deploy creates, or the
  // create succeeds against a name nothing uses and the binding still fails.
  for (const p of CONFIG.queues.producers || []) {
    assert.ok(DEPLOY.includes(`queues create ${p.queue}`),
      `the deploy does not create "${p.queue}"`);
  }
});

test("an unreadable message is acknowledged, never retried forever", () => {
  // Retrying something the handler cannot read is an infinite loop against a
  // queue that bills per operation. There is nothing to lose by acking: no build
  // can be inside a message this handler does not understand.
  const h = WORKER.slice(WORKER.search(/^\s*async queue\(/m));
  const end = h.indexOf("\n  },");
  const body = end > 0 ? h.slice(0, end) : h;
  assert.ok(body.length > 60, "could not isolate the queue handler — this check would be vacuous");
  assert.match(body, /\.ack\(\)/, "an unhandled message must be acked rather than left to retry");
});
