// A TWEAK THAT DOES NOT PARSE FALLS BACK TO THE REWRITE (2026-10-22, audit A03-5).
//
// The owner's choice: check each tweak right away and, when it is broken, run
// the full page rewrite for the same request, once. Before this, the publish
// was deferred to one spine compile after every step, so `if (twPub.ok)` always
// held: a tweak whose page would not build shipped to the spine, failed there
// ("That didn't compile"), and the rewrite the code promised never ran.
//
// Driven through the real `POST /api/site/<slug>/edit` with every model answer
// supplied and the compiler stubbed (`installCompiler`). What is established:
// the route's handling of a broken tweak, a sound tweak, and a broken rewrite
// behind a broken tweak, and the money on each. The check is the template's
// TypeScript parser (`tweakParser`), present in the container and in this
// suite; a Worker isolate without it is covered at the module (`tweakSyntax`).

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL, readTweak, tweakSyntax, tweakParser } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

const USER = { id: "u-twfb-1", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";

const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
// THE TWEAK'S ANSWERS. A visual change (a className), so `sameProse` passes it:
// otherwise the case would test the `reworded` fall-through instead.
const TWEAK_OK = HOME.replace("<h1>", '<h1 className="text-5xl">');
// THE SAME CHANGE WITH A TAG LEFT OPEN — what `vite build` refuses.
const TWEAK_BROKEN = TWEAK_OK.replace("<section>", "<section><div>");
// THE REWRITE'S ANSWER: the same request, made soundly by the full writer.
const REWRITE_OK = HOME.replace("<h1>", '<h1 className="text-6xl">');
// A REWRITE THAT PARSES BUT DOES NOT BUILD: the compiler stub refuses it,
// as `vite build` refuses a name the module does not define. (One that does not
// parse is already refused by the rewrite's own prose check, before any compile.)
const REWRITE_BROKEN = REWRITE_OK.replace("<h1 className", "<h1 data-x={missingName} className");
const ASK = "make the heading bigger";

function bucket(slug) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/** One message through the real route. A tool with no answer is refused (503). */
async function drive({ answers, compileOk = true }) {
  const slug = "twfb-" + Math.random().toString(16).slice(2, 10);
  const b = bucket(slug);
  const seen = { tools: [], debits: [], backs: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) { seen.backs.push(args); return new Response(null, { status: 204 }); }
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.tools.push(tool);
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage: { input_tokens: 1000, output_tokens: 500 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler(compileOk ? {} : { ok: false, error: "src/routes/index.tsx: Unexpected closing tag" });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: ASK, picker: "sonnet" }),
    }), env, ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const sent = c.calls.map((k) => {
      const files = (k.body && k.body.files) || {};
      const key = Object.keys(files).find((p) => /(^|\/)index\.tsx$/.test(p));
      return key === undefined ? undefined : files[key];
    });
    const stored = JSON.parse(b.store.get(SRC_KEY(slug))).find((p) => p.path === "index.tsx").source;
    return { status: res.status, body, tools: seen.tools, debits: seen.debits, backs: seen.backs, compiles: c.calls.length, sent, stored };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const writers = (r) => r.tools.filter((t) => t === TWEAK_TOOL.name || t === SITE_PAGES_TOOL.name);

test("the fixtures discriminate: the broken tweak does not parse, the sound one does", async () => {
  const parse = await tweakParser();
  assert.equal(typeof parse, "function", "no parser in this suite, so the route cases below prove nothing");
  assert.deepEqual(tweakSyntax(TWEAK_OK, parse), { checked: true, ok: true, errors: [] });
  const bad = tweakSyntax(TWEAK_BROKEN, parse);
  assert.equal(bad.checked, true);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 1, "a broken tag gave no diagnostic");
  assert.equal(tweakSyntax(REWRITE_OK, parse).ok, true);
});

test("readTweak refuses a file that does not parse as `syntax`, and passes a sound one", async () => {
  const parse = await tweakParser();
  const reply = (source) => ({ content: [{ type: "tool_use", input: { source } }] });
  const broken = readTweak(reply(TWEAK_BROKEN), { source: HOME, parse });
  assert.equal(broken.ok, false);
  assert.equal(broken.reason, "syntax");
  assert.ok(Array.isArray(broken.problems) && broken.problems.length >= 1);
  assert.deepEqual(readTweak(reply(TWEAK_OK), { source: HOME, parse }), { ok: true, source: TWEAK_OK });
});

test("with no parser (a Worker isolate) the check is skipped, never read as a pass or a fail", () => {
  assert.deepEqual(tweakSyntax(TWEAK_BROKEN, null), { checked: false });
  assert.deepEqual(tweakSyntax(TWEAK_BROKEN, () => ({ file: {} })), { checked: false }, "a parser with no syntax reader");
  assert.deepEqual(tweakSyntax(TWEAK_BROKEN, () => { throw new Error("x"); }), { checked: false }, "a parser that throws");
  const reply = { content: [{ type: "tool_use", input: { source: TWEAK_BROKEN } }] };
  // Today's behaviour exactly: the tweak goes on and the spine's compile is the wall.
  assert.deepEqual(readTweak(reply, { source: HOME, parse: null }), { ok: true, source: TWEAK_BROKEN });
});

test("a tweak whose page does not parse runs the rewrite, once, and the edit ships the rewrite's page", async () => {
  const r = await drive({ answers: { [TWEAK_TOOL.name]: { source: TWEAK_BROKEN }, [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source: REWRITE_OK }], parts: [] } } });
  assert.equal(r.status, 200, "the edit failed: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.deepEqual(writers(r), [TWEAK_TOOL.name, SITE_PAGES_TOOL.name], "not one tweak then one rewrite: " + JSON.stringify(r.tools));
  assert.equal(r.body.tweak, undefined, "the reply claims the tweak made the change");
  assert.equal(r.body.tweakFallback, "syntax", "the fallback is not recorded on the reply");
  assert.equal(r.compiles, 1, "compiles");
  assert.equal(r.sent[0], REWRITE_OK, "the compiler was not handed the rewrite's page");
  assert.equal(r.stored, REWRITE_OK, "the store does not hold the rewrite's page");
  // BILLED AS A REWRITE, with the tweak's own tokens on the same one bill.
  assert.ok(r.body.tweakUsage, "the tweak's usage was dropped from the bill");
  assert.equal(r.debits.length, 1, "billed more than once: " + JSON.stringify(r.debits));
  assert.equal(r.debits[0], r.body.cost);
  assert.equal(r.backs.length, 0, "something was refunded on a success");
});

test("a tweak that parses never runs the rewrite: no extra model call, no extra charge", async () => {
  const r = await drive({ answers: { [TWEAK_TOOL.name]: { source: TWEAK_OK } } });
  assert.equal(r.status, 200, "the edit failed: " + JSON.stringify(r.body));
  assert.equal(r.body.tweak, true, "not the tweak path");
  assert.deepEqual(writers(r), [TWEAK_TOOL.name], "the rewrite ran: " + JSON.stringify(r.tools));
  assert.equal(r.body.tweakFallback, undefined);
  assert.equal(r.stored, TWEAK_OK);
  assert.equal(r.compiles, 1);
  assert.equal(r.debits.length, 1);
  assert.equal(r.debits[0], r.body.cost);
});

test("a rewrite that also fails ends as today's compile failure, refunded the same way", async () => {
  const pagesBroken = { pages: [{ path: "src/routes/index.tsx", source: REWRITE_BROKEN }], parts: [] };
  // TODAY'S FAILURE: the tweak declines, the rewrite's page fails the compile.
  const control = await drive({ compileOk: false, answers: { [TWEAK_TOOL.name]: { cannot: "too large" }, [SITE_PAGES_TOOL.name]: pagesBroken } });
  const r = await drive({ compileOk: false, answers: { [TWEAK_TOOL.name]: { source: TWEAK_BROKEN }, [SITE_PAGES_TOOL.name]: pagesBroken } });
  // AFTER THEM, THE SEAM'S COMPILE REPAIR (2026-10-23) asks the tweak tool once more; its broken answer is refused before any compile.
  assert.deepEqual(writers(r).slice(0, 2), [TWEAK_TOOL.name, SITE_PAGES_TOOL.name], "not one tweak then one rewrite (never a loop): " + JSON.stringify(r.tools));
  assert.ok(writers(r).slice(2).every((t) => t === TWEAK_TOOL.name) && writers(r).length <= 4, "the repair is bounded: " + JSON.stringify(r.tools));
  assert.equal(r.status, control.status, "a different status from today's failure: " + JSON.stringify(r.body));
  assert.ok(r.status >= 400, "a broken rewrite was reported as a success");
  assert.equal(r.body.ok, false);
  assert.equal(r.body.error, control.body.error);
  assert.equal(r.compiles, 1, "the broken tweak reached the compiler");
  assert.equal(r.sent[0], REWRITE_BROKEN);
  assert.equal(r.stored, HOME, "the store moved on a failed edit");
  // SETTLED THE SAME WAY AS TODAY'S FAILURE: the same charges and refunds.
  const taken = (x) => x.debits.reduce((a, n) => a + n, 0);
  assert.equal(r.backs.length, control.backs.length, "refunds differ from today's failure");
  assert.equal(r.debits.length, control.debits.length);
  // The reply states what the synchronous path kept, exactly as the control does
  // (a job's reserves are the consumer's to refund, unchanged by this fix).
  assert.equal(r.body.cost, taken(r), "the reply's cost is not what was taken");
  assert.equal(control.body.cost, taken(control));
});
