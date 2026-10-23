// A REUSED REQUEST KEY IS ANSWERED FROM THE KEPT ANSWER (audit A13-1, the
// owner's choice (1), 2026-10-23). Every case runs the real Worker's routing
// route against `test/fixtures/request-flow.mjs`, with a KV stand-in for
// `SITE_API_CACHE`. What is checked is what happened: the routing calls the
// model stub saw, the ledger rows, and the bodies served.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: the router's answer is the case's.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, T, newKey, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
const MSG = "What would a gallery page show?";
const slugOf = (k) => "ra-" + k + "-" + Math.random().toString(16).slice(2, 8);

function kvStub({ failGet = false } = {}) {
  const map = new Map();
  const puts = [];
  return {
    map, puts,
    async get(id, opts) {
      if (failGet) throw new Error("kv unavailable");
      const v = map.get(id);
      if (v === undefined) return null;
      return opts && opts.type === "json" ? JSON.parse(v) : v;
    },
    async put(id, v, opts) { puts.push({ id, opts }); map.set(id, v); },
  };
}

async function withPlatform(opts, kv, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  P.env.SITE_API_CACHE = kv;
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const routeCalls = (P) => P.modelLog.filter((m) => m.tool === T.route).length;
const routeRows = (P) => P.ledger.filter((e) => e.reason === "route").map((e) => e.delta);

test("A13-1 — the same key and the same message: one routing call, one debit, the same body served again", async () => {
  const kv = kvStub();
  await withPlatform({ slug: slugOf("same"), answers: { route: () => ({ intent: "clarify", question: Q }) } }, kv, async (P) => {
    const key = newKey();
    const first = await sendMessage(P, { message: MSG, key });
    assert.equal(first.status, 200);
    assert.equal(first.body.intent, "clarify");
    assert.equal(routeCalls(P), 1);
    const spentAfterFirst = P.spent();
    const again = await sendMessage(P, { message: MSG, key });
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, first.body, "the repeat was not the kept answer");
    assert.equal(routeCalls(P), 1, "the router was asked again");
    assert.deepEqual(routeRows(P), [-1]);
    assert.equal(P.spent(), spentAfterFirst, "the repeat moved money");
    assert.equal(kv.puts.length, 1);
    assert.equal(kv.puts[0].opts.expirationTtl, 86400, "the kept answer has no expiry");
  });
});

test("A13-1 — the same key with a different message is never answered from the kept answer, and asks no model", async () => {
  const kv = kvStub();
  await withPlatform({ slug: slugOf("diff"), answers: { route: () => ({ intent: "clarify", question: Q }) } }, kv, async (P) => {
    const key = newKey();
    const first = await sendMessage(P, { message: MSG, key });
    assert.equal(first.body.intent, "clarify");
    const other = await sendMessage(P, { message: "How do bookings work on my site?", key });
    assert.notDeepEqual(other.body, first.body, "another message was answered with the first one's answer");
    assert.equal(other.status, 409);
    assert.equal(other.body.error, "key-reused");
    assert.equal(other.body.cost, 0);
    assert.equal(routeCalls(P), 1, "a reused key bought a free routing call");
    assert.deepEqual(routeRows(P), [-1]);
  });
});

test("A13-1 — a kept answer that cannot be read is no answer: the route runs and charges as it always has", async () => {
  const kv = kvStub({ failGet: true });
  await withPlatform({ slug: slugOf("unread"), answers: { route: () => ({ intent: "clarify", question: Q }) } }, kv, async (P) => {
    const key = newKey();
    const first = await sendMessage(P, { message: MSG, key });
    assert.equal(first.status, 200);
    assert.equal(first.body.intent, "clarify");
    assert.equal(routeCalls(P), 1, "an unreadable store stopped the normal call");
    assert.deepEqual(routeRows(P), [-1]);
  });
  const bad = kvStub();
  await withPlatform({ slug: slugOf("garbled"), answers: { route: () => ({ intent: "clarify", question: Q }) } }, bad, async (P) => {
    const key = newKey();
    bad.map.set("route-answer:" + P.slug + ":" + key, JSON.stringify({ v: 1, uid: USER.id, digest: "0", at: P.now(), status: 200, body: 7 }));
    const first = await sendMessage(P, { message: MSG, key });
    assert.equal(first.body.intent, "clarify");
    assert.equal(routeCalls(P), 1, "a garbled kept answer was served or stopped the call");
  });
});
