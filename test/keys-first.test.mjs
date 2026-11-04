// KEYS FIRST, THEN THE WORK (owner, 2026-11-03: "it should first pull up the box
// for the keys, and when it gets the keys, it starts working … what if the user
// doesn't put the key? It worked for no reason"). Market Lane's Stripe change
// built everything (47 credits) and only then showed the key box.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, KEYS_ADDED, KEYS_WAIVED } from "../builder/site-agent.mjs";

delete process.env.GF_OLD_LANES;
const use = (name, input, id) => ({ type: "tool_use", id, name, input });
const PAGES = [{ path: "index.tsx", source: "export default function H(){return <h1>Hi</h1>}" }];
function scripted(rounds, seen) {
  return async (req) => { seen.push(req); const c = rounds[Math.min(seen.length - 1, rounds.length - 1)]; return { stop_reason: "tool_use", content: c, usage: { input_tokens: 1, output_tokens: 1 } }; };
}
const asks = [use("request_key", { name: "STRIPE_SECRET_KEY", service: "Stripe" }, "k1"), use("request_key", { name: "STRIPE_WEBHOOK_SECRET", service: "Stripe" }, "k2")];
const later = [[use("write_file", { file: "index.tsx", source: "export default function H(){return <h1>Pay</h1>}" }, "w")], [use("build", {}, "b")], [use("finish", { summary: "Added card payments." }, "f")]];

test("KF1 a key not set yet: the turn ends with a question and the key box; nothing is written", async () => {
  const seen = [];
  const r = await runSiteAgent({ send: scripted([asks, ...later], seen), canAsk: () => true, listKeys: async () => [], siteUrl: async () => "https://market-lane.gofarther.app/", build: async () => ({ ok: true }) },
    { request: "use Stripe", pages: PAGES, parts: [], model: "claude-sonnet-4-5" });
  assert.equal(seen.length, 1, "it went on working after asking for the keys");
  assert.ok(r.ask, "no question was asked");
  assert.deepEqual(r.ask.options, [KEYS_ADDED, KEYS_WAIVED]);
  assert.match(r.ask.text, /STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET/);
  assert.match(r.ask.text, /https:\/\/market-lane\.gofarther\.app\./, "the site's real address is not in the question");
  assert.deepEqual(r.keysAsked.map((k) => k.name), ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
  assert.equal(r.changed.length, 0);
});

test("KF2 keys already set: no question, the work goes on", async () => {
  const seen = [];
  const r = await runSiteAgent({ send: scripted([asks, ...later], seen), canAsk: () => true, listKeys: async () => ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], build: async () => ({ ok: true }) },
    { request: "use Stripe", pages: PAGES, parts: [], model: "claude-sonnet-4-5" });
  assert.ok(!r.ask);
  assert.equal(r.ok, true, r.stopped);
});

test("KF3 after the owner answered (keys added, or build anyway), it is never asked again", async () => {
  for (const said of [KEYS_ADDED, KEYS_WAIVED]) {
    const seen = [];
    const r = await runSiteAgent({ send: scripted([asks, ...later], seen), canAsk: () => true, listKeys: async () => [], build: async () => ({ ok: true }) },
      { request: "use Stripe\n\nWHAT THE OWNER ALREADY ANSWERED\nYou asked: keys?\nThey answered: " + said, pages: PAGES, parts: [], model: "claude-sonnet-4-5" });
    assert.ok(!r.ask, "asked again after: " + said);
    assert.equal(r.ok, true, said + ": " + r.stopped);
  }
});

test("KF4 where the owner cannot be asked (a helper, or no question door), it carries on as before", async () => {
  const seen = [];
  const r = await runSiteAgent({ send: scripted([asks, ...later], seen), listKeys: async () => [], build: async () => ({ ok: true }) },
    { request: "use Stripe", pages: PAGES, parts: [], model: "claude-sonnet-4-5" });
  assert.ok(!r.ask);
  assert.equal(r.ok, true, r.stopped);
});
