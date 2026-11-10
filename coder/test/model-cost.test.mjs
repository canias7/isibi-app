// THE OWNER, 2026-11-10: "I want to do something kind of cache [for] the model. Also, can you do the effort level on
// low and make sure it's actually on low". Grok's prompt cache (one key per chat, added by the Worker) and Low as
// Coder's effort, with what each call really used kept on the chat's record to check both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const M = await import("../container/coder-model.mjs");
const G = await import("../src/coder-model-gate.mjs");
const R = await import("../src/coder-routes.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

function fakeBucket(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const UID = "user-1234567890abcdef";
const ENV = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev" };
const deps = { authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => null };
const settingsOf = async (bucket, init) => {
  const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/settings", { ...(init || {}), headers: { "content-type": "application/json" } }), { ...ENV, CODER_BUCKET: bucket }, {}, deps);
  return (await r.json()).pick;
};
const KEY_OF = "coder/" + UID + "/settings.json";
const answer = (extra = {}) => ({ output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }], usage: { input_tokens: 41000, output_tokens: 220, cost_in_usd_ticks: 300000000, input_tokens_details: { cached_tokens: 38912 }, output_tokens_details: { reasoning_tokens: 96 } }, reasoning: { effort: "low" }, ...extra });

test("CD378 Coder's effort is Low unless the owner picks another (owner, 2026-11-10: \"can you do the effort level on low and make sure it's actually on low\"): Low is the default; a High saved before the change counts as not chosen; Low is what goes to xAI; and each call's record says the effort sent, the effort xAI says it used, and its reasoning tokens", async () => {
  // 1. The default, on the server and on the page.
  assert.equal(M.CODER_MODELS[0].effort, "low");
  assert.deepEqual(M.pickModel(undefined, undefined), { model: "grok-4.7", effort: "low" });
  assert.deepEqual(M.pickModel("grok-4.7", "medium"), { model: "grok-4.7", effort: "medium" }, "another level can still be picked");
  const page = read("public/coder.js");
  assert.match(page, /let MODELS = \[\{ id: 'grok-4\.7', name: 'Grok 4\.7', efforts: \['low', 'medium', 'high', 'xhigh'\], effort: 'low' \}\];/);
  assert.match(page, /function savePick\(\) \{ call\('\/settings', \{ method: 'POST', body: JSON\.stringify\(\{ \.\.\.S\.pick, pickV: 2 \}\) \}\); \}/);
  // 2. What an account had saved. A "high" from before (the old default, saved with any pick) counts as not chosen.
  assert.deepEqual(await settingsOf(fakeBucket({ [KEY_OF]: JSON.stringify({ model: "grok-4.7", effort: "high", mode: "auto" }) })), { model: "grok-4.7", effort: "low", mode: "auto" });
  assert.deepEqual(await settingsOf(fakeBucket({ [KEY_OF]: JSON.stringify({ model: "grok-4.7", effort: "xhigh" }) })), { model: "grok-4.7", effort: "xhigh", mode: "auto" }, "another level picked before stays");
  assert.deepEqual(await settingsOf(fakeBucket()), { model: "grok-4.7", effort: "low", mode: "auto" }, "nothing saved: Low");
  // High picked on the page from now on (pickV 2) is the owner's choice and stays; one an old page saves does not count.
  const b = fakeBucket();
  await settingsOf(b, { method: "POST", body: JSON.stringify({ model: "grok-4.7", effort: "high" }) });
  assert.equal((await settingsOf(b)).effort, "low", "an old page's High is still the old default");
  await settingsOf(b, { method: "POST", body: JSON.stringify({ model: "grok-4.7", effort: "high", pickV: 2 }) });
  assert.equal((await settingsOf(b)).effort, "high", "picked now: kept");
  assert.equal(JSON.parse(b.m.get(KEY_OF)).pickV, 2);
  await settingsOf(b, { method: "POST", body: JSON.stringify({ mode: "acceptEdits" }) });
  assert.equal((await settingsOf(b)).effort, "high", "saving the mode keeps a pick made now");
  assert.equal(R.savedEffort({ effort: "high" }), undefined);
  assert.equal(R.savedEffort({ effort: "high", pickV: 2 }), "high");
  assert.equal(R.savedEffort(null), undefined);
  // A message takes the account's effort the same way (the page sends its pick; a message without one gets the saved one).
  assert.match(read("src/coder-routes.mjs"), /const pick = pickModel\(body\.model \|\| saved\.model, body\.effort \|\| savedEffort\(saved\)\);/);
  // 3. What goes to xAI: reasoning.effort "low" (xAI's own default, with none, would be High).
  const sent = [];
  const send = M.coderSend({ XAI_API_KEY: "k" }, { fetchFn: async (u, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify(answer())); } });
  const r = await send({ model: "grok-4.7", ...M.pickModel(undefined, undefined), messages: [{ role: "user", content: "hi" }], tools: [] });
  assert.deepEqual(sent[0].reasoning, { effort: "low" });
  // 4. And what the call really used, from xAI's answer.
  assert.deepEqual(r.usage, { in: 41000, out: 220, searches: 0, cost_ticks: 300000000, cached: 38912, reasoning: 96, effort: "low", effortSaid: "low" });
  // When xAI refuses an effort, the call goes on without one (the safety net), and the record says none was sent.
  let n = 0;
  const net = M.coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => (n++ === 0 ? new Response("unknown field: reasoning.effort", { status: 400 }) : new Response(JSON.stringify(answer({ reasoning: null })))) });
  const r2 = await net({ model: "grok-4.7", effort: "low", messages: [], tools: [] });
  assert.equal(r2.usage.effort, "", "not sent: the record says so");
  assert.equal("effortSaid" in r2.usage, false);
  // 5. The auto mode checker asks at Low too, and its calls are marked as its own.
  const C = await import("../container/coder-checker.mjs");
  const asked = [];
  const v = await C.checkAction({ send: async (req) => { asked.push(req); return { message: { role: "assistant", content: '{"decision":"allow","rule":"","reason":"fine"}' }, usage: { in: 900, out: 12, cached: 0, reasoning: 8, effort: "low" } }; } }, { model: "grok-4.7", action: "Bash: npm test", convo: [{ role: "user", content: "run the tests" }] });
  assert.equal(asked[0].effort, "low");
  assert.equal(v.decision, "allow");
  assert.equal(v.usage.kind, "check");
});

test("CD379 Grok's prompt cache: every AI call of a chat carries the chat's own key, prompt_cache_key, added by the Worker (xAI: \"For the Responses API, use the prompt_cache_key field\"; without it requests \"can land on a cold server\"), never the machine's; and each message's calls are summed on the chat's record (cached tokens, reasoning tokens, efforts), the checker's apart", async () => {
  // The key: one per chat, the same every time, a hash that shows neither the account nor the chat.
  const k1 = await G.cacheKeyFor(UID + "/shop-m1"), k2 = await G.cacheKeyFor(UID + "/shop-m2");
  assert.match(k1, /^coder-[0-9a-f]{32}$/);
  assert.equal(await G.cacheKeyFor(UID + "/shop-m1"), k1);
  assert.notEqual(k1, k2);
  assert.equal(k1.includes("1234567890abcdef") || k1.includes("shop"), false);
  // The Worker puts it on the call it passes to xAI, in place of one the machine sent.
  const KEY = Buffer.alloc(32, 9).toString("base64");
  const bucket = fakeBucket({ ["coder/" + UID + "/shop-m1/meta.json"]: JSON.stringify({ id: "shop-m1", turn: 3 }) });
  const env = { CODER_TOKEN_KEY: KEY, XAI_API_KEY: "xai-x", CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  const a = await G.modelAccess(env, UID, "shop-m1", 3);
  const seen = [];
  const r = await G.handleModel(new Request("https://coder.gofarther.dev" + G.MODEL_PATH, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": a.chat, "x-coder-turn": "3", "x-coder-until": String(a.until), "x-coder-model": a.pass }, body: JSON.stringify({ model: "grok-4.7", input: [{ role: "user", content: "hi" }], reasoning: { effort: "low" }, prompt_cache_key: "someone-elses" }) }), env, { fetchFn: async (url, init) => { seen.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); } });
  assert.equal(r.status, 200);
  assert.equal(seen[0].prompt_cache_key, k1);
  assert.deepEqual(seen[0].reasoning, { effort: "low" }, "the rest of the call as the machine sent it");
  assert.deepEqual(seen[0].input, [{ role: "user", content: "hi" }]);
  // Not an object: refused, nothing reaches xAI.
  const bad = await G.handleModel(new Request("https://coder.gofarther.dev" + G.MODEL_PATH, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": a.chat, "x-coder-turn": "3", "x-coder-until": String(a.until), "x-coder-model": a.pass }, body: "[1,2]" }), env, { fetchFn: async () => { throw new Error("must not be called"); } });
  assert.equal(bad.status, 400);
  // A message's calls, summed: Coder's own, and the checker's apart.
  const sum = R.usageSummary([
    { in: 41000, out: 220, cached: 0, reasoning: 96, cost_ticks: 300000000, effort: "low", effortSaid: "low" },
    { in: 43500, out: 180, cached: 40960, reasoning: 64, cost_ticks: 120000000, effort: "low", effortSaid: "low" },
    { in: 900, out: 12, cached: 0, reasoning: 8, cost_ticks: 2000000, effort: "low", kind: "check" },
    null, "x",
  ], 7);
  assert.deepEqual(sum, { turn: 7, calls: 2, in: 84500, cached: 40960, out: 400, reasoning: 160, costTicks: 420000000, efforts: ["low"], said: ["low"], checker: { calls: 1, in: 900, cached: 0, out: 12, reasoning: 8, costTicks: 2000000, efforts: ["low"], said: [] } });
  assert.deepEqual(R.usageSummary([{ in: 10, out: 1 }], 1).efforts, ["default"], "a call sent with no effort says so");
  assert.deepEqual(R.usageSummary(undefined, 2), { turn: 2, calls: 0, in: 0, cached: 0, out: 0, reasoning: 0, costTicks: 0, efforts: [], said: [] });
  // Kept on the chat's record when the message ends.
  assert.match(read("src/coder-routes.mjs"), /usage: usageSummary\(s\.result\.usage, meta\.turn\)/);
});
