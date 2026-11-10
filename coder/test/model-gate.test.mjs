// YOUR GROK KEY NEVER ENTERS CODER'S MACHINE (owner, 2026-11-07, "ok" to the
// plan: step 1, the Grok key out of the machine). The machine sends its AI
// calls to the Worker with its job's pass; the Worker adds the key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const G = await import("../src/coder-model-gate.mjs");
const KEY = Buffer.alloc(32, 9).toString("base64");
const XAI = "xai-REALKEY-0123456789abcdef";
const UID = "user-1234567890abcdef", ID = "shop-m1";

function fakeBucket(turn = 3) {
  const m = new Map([["coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, turn })]]);
  return { get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
}
const envOf = (over = {}) => ({ CODER_TOKEN_KEY: KEY, XAI_API_KEY: XAI, CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: fakeBucket(), ...over });

async function call(env, { pass, turn = 3, until, body = { model: "grok-4.7", input: [] }, method = "POST", madeAt = Date.now(), now = Date.now(), extra = {} } = {}) {
  const a = await G.modelAccess(env, UID, ID, turn, madeAt);
  const headers = { "content-type": "application/json", "x-coder-chat": a.chat, "x-coder-turn": String(a.turn), "x-coder-until": String(until ?? a.until), "x-coder-model": pass ?? a.pass, ...extra };
  const seen = [];
  const fetchFn = async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify({ output: [], usage: {} }), { status: 200, headers: { "content-type": "application/json" } }); };
  const r = await G.handleModel(new Request("https://coder.gofarther.dev" + G.MODEL_PATH, { method, headers, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) }), env, { fetchFn, now });
  return { r, seen, a };
}

test("CD137 the Worker takes a job's AI call only with its pass, for its chat's current turn, for Coder's own models, and adds the Grok key itself", async () => {
  const env = envOf();
  // The pass the machine is given: the Worker's address, the chat, the turn, an end, and no key.
  const a = await G.modelAccess(env, UID, ID, 3, 1_700_000_000_000);
  assert.equal(a.url, "https://coder.gofarther.dev/api/coder/model");
  assert.equal(a.chat, UID + "/" + ID);
  assert.equal(a.until, 1_700_000_000_000 + G.MODEL_PASS_MS);
  assert.equal(G.MODEL_PASS_MS, 3 * 60 * 60 * 1000);
  assert.equal(JSON.stringify(a).includes(XAI), false, "the key is never in what the machine gets");
  assert.equal(await G.modelAccess(envOf({ CODER_TOKEN_KEY: "short" }), UID, ID, 3), null, "no pass without the Worker's own key");
  // A good call goes on to xAI with the key, and only xAI's answer comes back.
  const ok = await call(env);
  assert.equal(ok.r.status, 200);
  assert.equal(ok.seen.length, 1);
  assert.equal(ok.seen[0].url, "https://api.x.ai/v1/responses");
  assert.equal(ok.seen[0].init.headers.authorization, "Bearer " + XAI);
  // (With the chat's prompt cache key added, 2026-11-10: CD379.)
  assert.deepEqual(JSON.parse(ok.seen[0].init.body), { model: "grok-4.7", input: [], prompt_cache_key: await G.cacheKeyFor(UID + "/" + ID) }, "the call itself, as sent");
  assert.equal((await ok.r.text()).includes(XAI), false);
  // Refused, and nothing reaches xAI.
  const refused = [
    ["no pass", await call(env, { pass: "x".repeat(43) }), 403],
    ["another turn's pass", await call(env, { turn: 2 }), 403],
    ["an ended pass", await call(env, { madeAt: Date.now() - G.MODEL_PASS_MS - 1000 }), 403],
    ["a changed end", await call(env, { until: Date.now() + 10 * G.MODEL_PASS_MS }), 403],
    ["another model", await call(env, { body: { model: "grok-9-ultra", input: [] } }), 403],
    ["not JSON", await call(env, { body: "{nope" }), 400],
    ["not a POST", await call(env, { method: "GET" }), 405],
    ["too large (said)", await call(env, { extra: { "content-length": String(G.MODEL_BODY_MAX + 1) } }), 413],
  ];
  for (const [what, x, status] of refused) { assert.equal(x.r.status, status, what); assert.equal(x.seen.length, 0, what + ": nothing sent to xAI"); }
  // The chat moved on (a new message): the old job's pass stops working.
  const moved = envOf({ CODER_BUCKET: fakeBucket(4) });
  const late = await call(moved);
  assert.equal(late.r.status, 403);
  assert.equal(late.seen.length, 0);
  // No key on the Worker: it says so, and sends nothing.
  const nokey = await call(envOf({ XAI_API_KEY: "" }));
  assert.equal(nokey.r.status, 503);
  // CODER_MODEL, when set to a model, is allowed too.
  assert.equal((await call(envOf({ CODER_MODEL: "grok-4.7-fast" }), { body: { model: "grok-4.7-fast", input: [] } })).r.status, 200);
});

test("CD138 the machine has no Grok key: its AI calls go to the Worker with the job's pass; the Worker routes them; the key is never given to a machine", async () => {
  const { coderSend } = await import("../container/coder-model.mjs");
  const { modelTarget } = await import("../container/server.mjs");
  const env = envOf();
  const a = await G.modelAccess(env, UID, ID, 3);
  const via = modelTarget(a);
  assert.deepEqual(via, { url: a.url, headers: { "x-coder-chat": a.chat, "x-coder-turn": "3", "x-coder-until": String(a.until), "x-coder-model": a.pass } });
  for (const bad of [null, {}, { ...a, url: "http://coder.gofarther.dev/api/coder/model" }, { ...a, url: "https://u:p@x.dev/" }, { ...a, chat: "../x" }, { ...a, turn: 0 }, { ...a, until: "soon" }, { ...a, pass: "short" }]) assert.equal(modelTarget(bad), null, JSON.stringify(bad));
  // With `via` and no key in its environment, the call goes to the Worker with the pass, and no key.
  const seen = [];
  const send = coderSend({}, { via, fetchFn: async (url, init) => { seen.push({ url, init }); return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "hello" }] }], usage: { input_tokens: 1, output_tokens: 1 } }); } });
  const out = await send({ model: "grok-4.7", messages: [{ role: "system", content: "s" }, { role: "user", content: "hi" }] });
  assert.equal(out.message.content, "hello");
  assert.equal(seen[0].url, a.url);
  assert.equal(seen[0].init.headers["x-coder-model"], a.pass);
  assert.equal("authorization" in seen[0].init.headers, false, "the machine sends no key");
  // Without `via` and without a key, it refuses (it never calls xAI with nothing).
  await assert.rejects(coderSend({})({ model: "grok-4.7", messages: [{ role: "user", content: "hi" }] }), /no AI key/);
  // Wiring: the real service uses the Worker; Coder's server routes the address; no machine is given the key.
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const via = modelVia && !send \? modelTarget\(body\.model\) : null;\n[\s\S]{0,900}?\n\s+runCoder\(\{\n\s+send: via \? coderSend\(env, \{ via \}\) : sendFn,/);
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /\} else if \(url\.pathname === MODEL_PATH\) \{[\s\S]{0,200}res = await handleModel\(request, env\);/);
  assert.doesNotMatch(worker, /XAI_API_KEY: env\.XAI_API_KEY/, "Cloudflare's backup machines are not given the key either");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /model: await modelAccess\(env, uid, id, meta\.turn \+ 1\)/);
  const F = await import("../src/coder-fly.mjs");
  assert.equal(JSON.stringify(F.machineConfig({ CODER_FLY_APP: "a", CODER_FLY_IMAGE: "i", XAI_API_KEY: XAI }, "v")).includes(XAI), false);
});
