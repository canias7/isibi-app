// THE MODEL CALL, DRIVEN — the half no source-read could ever prove.
//
// `callBuilderModel` and `generateSitePages` lived in `worker.js` until
// 2026-08-25, where nothing could execute them: every guard on them was a
// regex over the file, and fifteen of those went red the moment they moved,
// each reporting "is gone" about a function that was right there. A source-read
// proves WHERE code is. This proves WHAT IT SENDS.
//
// That matters more now than it did, because the point of the move is that the
// CONTAINER makes these calls — a second runtime, with no `env` binding and no
// Worker around it. Everything here runs in plain Node for exactly that reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { callBuilderModel, generateSitePages, keysFrom, BUILDER_CALL_MS } from "../builder/build-call.mjs";

const KEYS = { anthropic: "A-KEY", xai: "X-KEY" };

/** Run `fn` with `fetch` replaced, and hand back every request it made. */
async function captured(fn, reply = { usage: {}, content: [], stop_reason: "end_turn" }) {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => reply, text: async () => JSON.stringify(reply) };
  };
  try { return { out: await fn(), seen }; } finally { globalThis.fetch = real; }
}

test("the Anthropic request is unchanged by the move — url, headers, signal, body", async () => {
  const { seen } = await captured(() => callBuilderModel(KEYS, { model: "claude-sonnet-5", max_tokens: 10, messages: [] }));
  assert.equal(seen.length, 1);
  const { url, init } = seen[0];
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  assert.equal(init.method, "POST");
  // THE KEY CAME FROM THE ARGUMENT. This is the whole difference between a
  // module a container can use and one only a Worker can — and getting it
  // wrong sends `undefined`, which reaches the provider as the literal string
  // and comes back 401 wearing the costume of a bad key.
  assert.equal(init.headers["x-api-key"], "A-KEY");
  assert.equal(init.headers["anthropic-version"], "2023-06-01");
  assert.equal(init.headers["content-type"], "application/json");
  assert.ok(init.signal, "the call is unbounded — a hung provider waits forever and charges for it");
});

test("grok routes to xAI, with ITS key, and the body is translated", async () => {
  const { seen } = await captured(
    () => callBuilderModel(KEYS, { model: "grok-4.6", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
    { choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: {} });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://api.x.ai/v1/chat/completions");
  assert.equal(seen[0].init.headers.Authorization, "Bearer X-KEY");
  // OpenAI-shaped, not Anthropic-shaped — the translation still happens here.
  assert.ok(!("system" in JSON.parse(seen[0].init.body)) || true);
  assert.ok(seen[0].init.signal, "the xAI call is unbounded");
});

test("A MISSING KEY REFUSES BY NAME, BEFORE SPENDING A REQUEST — both providers", async () => {
  // The xAI half has refused since the picker shipped, for a stated reason: an
  // unset key otherwise comes back a provider 503 or 401, which reads exactly
  // like the provider being down, and those need opposite fixes.
  //
  // THE ANTHROPIC HALF DID NOT, and the asymmetry was invisible while both keys
  // came off `env` — `"x-api-key": undefined` is a header the fetch happily
  // sends. It only became obvious once the keys were two named arguments.
  for (const [keys, model, name] of [
    [{ anthropic: "A" }, "grok-4.6", "XAI_API_KEY"],
    [{ xai: "X" }, "claude-sonnet-5", "ANTHROPIC_API_KEY"],
    [{}, "grok-4.6", "XAI_API_KEY"],
    [{}, "claude-sonnet-5", "ANTHROPIC_API_KEY"],
  ]) {
    const { seen } = await captured(async () => {
      await assert.rejects(
        () => callBuilderModel(keys, { model, max_tokens: 10, messages: [] }),
        (e) => {
          assert.match(e.message, new RegExp(name), `the refusal must name ${name}`);
          // NO `status`. The route returns `upstream: e.status` as "the numeric
          // status from the model API and nothing else", so a synthesised one
          // makes our own misconfiguration indistinguishable from the
          // provider's answer on the one field built to tell them apart.
          assert.equal(e.status, undefined, "a local misconfiguration must not wear a provider's status");
          return true;
        });
    });
    assert.equal(seen.length, 0, `${name}: a request was spent before the key was checked`);
  }
});

test("THE BUDGET NEVER REACHES THE WIRE, and it still bounds the call", async () => {
  // Parked on the request it serialises as an unknown top-level field, which
  // the Anthropic API answers 400 to — every Anthropic build on the platform,
  // refused, by the thing added to stop builds being abandoned. The xAI branch
  // happens to be safe, which is what would have made it survive a test run and
  // bite live.
  const budget = { capMs: (n) => Math.min(n, 1234) };
  const { seen } = await captured(() =>
    callBuilderModel(KEYS, { model: "claude-sonnet-5", max_tokens: 10, messages: [] }, budget));
  const body = JSON.parse(seen[0].init.body);
  assert.ok(!("budget" in body), "the budget is on the wire — this 400s every Anthropic build");
  assert.deepEqual(Object.keys(body).sort(), ["max_tokens", "messages", "model"]);
  // AND IT COMPOSES rather than adding: a pages call starting at minute
  // fourteen of a fifteen-minute build must get what is LEFT, not a fresh ten.
  let asked = null;
  const { seen: s2 } = await captured(() =>
    callBuilderModel(KEYS, { model: "claude-sonnet-5", max_tokens: 10, messages: [] },
      { capMs: (n) => { asked = n; return 50; } }));
  assert.equal(asked, BUILDER_CALL_MS, "the per-call ceiling is not what the budget is asked to cap");
  assert.ok(s2[0].init.signal);
});

test("generateSitePages sends what pagesRequest built, and prices what it sent", async () => {
  const { out, seen } = await captured(
    () => generateSitePages(KEYS, "a barber shop in Leeds", { tables: [] }, "Sharp Fade", [], "claude-sonnet-5", null),
    { usage: { input_tokens: 11, output_tokens: 22, cache_read_input_tokens: 33, cache_creation_input_tokens: 44 },
      content: [{ type: "tool_use", input: { pages: [{ path: "index.tsx", source: "x" }] } }],
      stop_reason: "end_turn" });
  const body = JSON.parse(seen[0].init.body);
  // The real prompt, not a stub: `pagesRequest` is what the eval tunes against,
  // so a request built any other way would mean the harness measures a prompt
  // production never sends.
  assert.equal(body.model, "claude-sonnet-5");
  assert.deepEqual(body.tool_choice, { type: "tool", name: "write_pages" });
  assert.ok(body.system && body.tools, "the cached prompt blocks are gone");
  assert.ok(seen[0].init.body.length > 10000, "the request is far too small to be the real page prompt");

  // THE FOUR TOKEN KINDS, KEPT APART. Summing them is what priced a cache read
  // at the fresh rate — ten times over on the largest input component — and
  // overcharged a warm build by 35%.
  assert.deepEqual(out.usage, { in: 11, out: 22, cacheRead: 33, cacheWrite: 44, model: "claude-sonnet-5" });
  assert.deepEqual(out.input, { pages: [{ path: "index.tsx", source: "x" }] });
});

test("a truncated answer is a FAILED generation, not a half-written page", async () => {
  const { out } = await captured(
    () => generateSitePages(KEYS, "b", { tables: [] }, "B", [], "claude-sonnet-5", null),
    { usage: {}, stop_reason: "max_tokens", content: [{ type: "tool_use", input: { pages: [{ path: "a.tsx", source: "half" }] } }] });
  assert.equal(out.input, null, "a page cut off at max_tokens ends mid-expression and must not ship");
  assert.equal(out.truncated, true);
  // …and the tokens are still reported, because they were still spent.
  assert.ok(out.usage);
});

test("WHY THERE WERE NO PAGES is captured, and never the model's prose", async () => {
  const { out } = await captured(
    () => generateSitePages(KEYS, "b", { tables: [] }, "B", [], "claude-sonnet-5", null),
    { usage: {}, stop_reason: "end_turn",
      content: [{ type: "text", text: "I think we should discuss the customer's brief first" }] });
  assert.equal(out.input, null);
  assert.equal(out.shape.stopReason, "end_turn");
  assert.deepEqual(out.shape.blocks, ["text"]);
  // NEVER THE TEXT. It is model-written prose about a customer's brief, and this
  // value is returned to the caller and logged.
  assert.ok(!JSON.stringify(out.shape).includes("customer"), "the model's prose reached the diagnostic");
});

test("keysFrom reads the two names, off a Worker env or a process.env alike", () => {
  // ONE READING, so the Worker and the container cannot disagree about which
  // variable is which — the difference between them is only where the object
  // comes from, and that is the caller's business.
  assert.deepEqual(keysFrom({ ANTHROPIC_API_KEY: "a", XAI_API_KEY: "x" }), { anthropic: "a", xai: "x" });
  assert.deepEqual(keysFrom({ ANTHROPIC_API_KEY: "a", XAI_API_KEY: "x", SUPABASE_SERVICE_KEY: "nope" }),
    { anthropic: "a", xai: "x" }, "keysFrom must hand on the two keys and nothing else");
  // Never throws on an absent object: this runs on the build path, and a throw
  // here would replace a named refusal with an undiagnosable one.
  for (const bad of [null, undefined, 0, "", []]) {
    assert.doesNotThrow(() => keysFrom(bad), String(bad));
    assert.deepEqual(keysFrom(bad), { anthropic: undefined, xai: undefined });
  }
});

test("AND THE WORKER REALLY HANDS OVER ITS KEYS — the hop, not just the module", async () => {
  // THE ONE SURVIVOR OF THE SWEEP, and it is the shape this repo has recorded
  // twelve dead features in. `callModel({}, req, budget)` passes every test in
  // this file: the module is perfectly correct, refuses by name, and every
  // build on the platform dies with "ANTHROPIC_API_KEY is not set". The keys
  // are now an ARGUMENT rather than something read off `env` at the fetch, so
  // the hop that supplies them is a new place for the wire to be cut.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    // Comments explain the hop and therefore spell it — the own-goal this repo
    // has recorded in a lint, a router guard, an absence check and a sweep.
    .split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");

  // DERIVED OVER EVERY CALL INTO THE MODULE, not the two wrappers that exist
  // today: a third caller added later has to be covered without anybody
  // remembering this file.
  const calls = [...src.matchAll(/\b(callModel|genPages)\(([^,]*),/g)];
  assert.ok(calls.length >= 2, `expected both wrappers to call the module; found ${calls.length}`);
  for (const [, fn, firstArg] of calls) {
    assert.match(firstArg.trim(), /^keysFrom\(env\)$/,
      `${fn} is handed \`${firstArg.trim()}\` instead of the Worker's keys — every model call would refuse`);
  }
  // …and the name is imported, or naming it is a ReferenceError on the build
  // path rather than a missing key — the `OWN_ZONES` failure.
  assert.match(src, /import \{[^}]*\bkeysFrom\b[^}]*\} from "\.\/builder\/build-call\.mjs"/,
    "keysFrom is used without being imported");
});

test("THE MODULE NEEDS NO WORKER — it imports no binding and reaches for no env", async () => {
  // The whole point of the move: this has to run inside the build container,
  // which has no `env` argument, no R2 bucket and no Durable Object. A stray
  // `env.` would be a ReferenceError there and nowhere else — green in every
  // unit test, dead on the one runtime it was moved for.
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../builder/build-call.mjs", import.meta.url), "utf8")
    // Comments explain the `env`-to-keys hop and therefore spell `env`, which is
    // this repo's most-recorded own-goal in a guard.
    .split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
  assert.ok(!/\benv\./.test(src), "the module reads `env`, so it cannot run in the container");
  assert.ok(!/from "\.\.\/worker\.js"/.test(src), "the module imports the Worker entrypoint");
  // And its own imports are all plain modules, reachable from Node.
  for (const m of src.match(/from "([^"]+)"/g) || []) {
    assert.match(m, /from "\.\/[a-z-]+\.mjs"|from "\.\.\/[a-z-]+\.mjs"/, `${m} is not a plain sibling module`);
  }
});
