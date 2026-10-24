// THE COMPILE REPAIR ON EVERY PATH THAT WRITES CODE (2026-10-23, owner).
//
// The add-on had a model repair round for a page that did not compile; every
// other path either had none (the edit rungs, the frame, logo, nav, revises,
// "Back online") or had one behind a switch that was off (first builds). Now
// the shared publish seam (`recompileAndPublish`, and `publishBeside` through
// it) gives every caller `seamCompileRepair` unless it brings its own hook,
// and `publishPages` runs its own round by default. Up to two rounds, each fed
// the latest compiler error and asked of the job's clock; charged only when
// it fixed the build; then today's behaviour.
//
// Driven through the real `POST /api/site/<slug>/edit` with every model
// answer supplied in the shape the writer is told to give (`write_tweak`'s
// `source`), and the compiler stubbed (`installCompiler`, `failFirst`).
// Supplied answers only — no model is called.

import test from "node:test";
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { compileRepairRounds, writtenPaths, MAX_ROUNDS } from "../builder/compile-repair.mjs";
import { editReplyFacts, addonReplyFacts, buildReplyFacts } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";

const USER = { id: "u-crall-1", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
// THE REWRITE'S PAGE: it parses, and the bundler refuses it (an undefined name).
const BROKEN = HOME.replace("<h1>", '<h1 data-x={missingName} className="text-6xl">');
const BROKEN2 = HOME.replace("<h1>", '<h1 data-y={otherName} className="text-6xl">');
const FIXED = HOME.replace("<h1>", '<h1 className="text-6xl">');
const ERR = "src/routes/index.tsx(3,40): error: missingName is not defined";
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

/** One page-rung message. `answers[tool]` is one answer or a list taken in turn. */
async function drive({ answers, compiler }) {
  const slug = "crall-" + Math.random().toString(16).slice(2, 10);
  const b = bucket(slug);
  const seen = { tools: [], debits: [], backs: [], prompts: [] };
  const queue = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.slice() : v]));
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
      seen.prompts.push(JSON.stringify(args.messages || ""));
      const q = queue[tool];
      const a = Array.isArray(q) ? (q.length > 1 ? q.shift() : q[0]) : q;
      if (a === undefined) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === "write_tweak" ? tweakInput(a, args) : a }], usage: { input_tokens: 1000, output_tokens: 500 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler(compiler);
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
    return { status: res.status, body, tools: seen.tools, prompts: seen.prompts, debits: seen.debits, backs: seen.backs, compiles: c.calls.length, sent, stored };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const PAGES = (source) => ({ pages: [{ path: "src/routes/index.tsx", source }], parts: [] });
const repairAsks = (r) => r.prompts.filter((p) => p.includes("WHY THE PAGE DID NOT COMPILE"));
const taken = (r) => r.debits.reduce((a, n) => a + n, 0);

test("EDIT PAGE RUNG: a page that did not compile is repaired once, recompiled, published, and charged", async () => {
  const r = await drive({
    answers: { [TWEAK_TOOL.name]: [{ cannot: "too large" }, { source: FIXED }], [SITE_PAGES_TOOL.name]: PAGES(BROKEN) },
    compiler: { failFirst: 1, error: ERR },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.compiles, 2, "the failed compile and the repaired one");
  assert.equal(r.sent[0], BROKEN);
  assert.equal(r.sent[1], FIXED, "the second compile did not carry the correction");
  assert.equal(r.stored, FIXED, "the store does not hold the repaired page");
  const asks = repairAsks(r);
  assert.equal(asks.length, 1, "one repair request");
  assert.ok(asks[0].includes("missingName"), "the compiler's message did not reach the writer");
  assert.deepEqual(r.body.compileRepaired.pages, ["index.tsx"]); assert.equal(r.body.compileRepaired.rounds, 1); assert.ok(r.body.compileRepaired.charged > 0);
  // CHARGED, because it fixed the build: more than the same edit with no repair.
  const plain = await drive({ answers: { [TWEAK_TOOL.name]: { cannot: "too large" }, [SITE_PAGES_TOOL.name]: PAGES(FIXED) }, compiler: {} });
  assert.equal(plain.body.ok, true);
  assert.ok(taken(r) > taken(plain), "the repair was not charged: " + taken(r) + " vs " + taken(plain));
  assert.equal(r.body.cost, taken(r), "the reply's cost is not what was taken");
});

test("EDIT: a second round is fed the SECOND compile's error and fixes it", async () => {
  const r = await drive({
    answers: { [TWEAK_TOOL.name]: [{ cannot: "too large" }, { source: BROKEN2 }, { source: FIXED }], [SITE_PAGES_TOOL.name]: PAGES(BROKEN) },
    compiler: { failFirst: 2, error: ERR },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.compiles, 3);
  assert.deepEqual(r.sent, [BROKEN, BROKEN2, FIXED]);
  const asks = repairAsks(r);
  assert.equal(asks.length, 2);
  assert.ok(asks[1].includes("otherName") || asks[1].includes("data-y"), "round two was not handed round one's page");
  assert.deepEqual(r.body.compileRepaired.pages, ["index.tsx"]); assert.equal(r.body.compileRepaired.rounds, 2);
});

test("EDIT: still failing after two rounds ends as today's refusal, and the rounds are not charged", async () => {
  const control = await drive({ answers: { [TWEAK_TOOL.name]: { cannot: "too large" }, [SITE_PAGES_TOOL.name]: PAGES(BROKEN) }, compiler: { ok: false, error: ERR } });
  const r = await drive({
    answers: { [TWEAK_TOOL.name]: [{ cannot: "too large" }, { source: BROKEN2 }, { source: BROKEN2.replace("otherName", "thirdName") }], [SITE_PAGES_TOOL.name]: PAGES(BROKEN) },
    compiler: { ok: false, error: ERR },
  });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.error, control.body.error);
  assert.equal(r.status, control.status);
  assert.equal(r.compiles, 1 + MAX_ROUNDS, "bounded at two recompiles");
  assert.equal(control.compiles, 1, "a refused repair compiles nothing more");
  assert.equal(r.stored, HOME);
  assert.equal(taken(r), taken(control), "a repair that did not fix the build was charged");
  assert.equal(r.body.compileRepaired, undefined);
});

test("EDIT: a killed container is ours — no repair round", async () => {
  const r = await drive({
    answers: { [TWEAK_TOOL.name]: [{ cannot: "too large" }, { source: FIXED }], [SITE_PAGES_TOOL.name]: PAGES(BROKEN) },
    compiler: { ok: false, error: "vite build was killed by SIGKILL" },
  });
  assert.equal(r.body.ok, false);
  assert.equal(repairAsks(r).length, 0, "the code was never judged, so it was not repaired");
});

// ── THE SEAM, AS A MODULE ────────────────────────────────────────────────────

test("compileRepairRounds: asks the clock before every round, and stops at two", async () => {
  const pages = [{ path: "a.tsx", source: "x" }];
  const ans = (s, req) => ({ content: [{ type: "tool_use", name: "write_tweak", input: tweakInput({ source: s }, req) }], usage: { input_tokens: 1, output_tokens: 1 } });
  let asked = 0, compiled = 0, sent = 0;
  const reqs = [];
  const r = await compileRepairRounds({ error: "a.tsx broke", pages, send: async (req) => { sent++; reqs.push(JSON.stringify(req.messages)); return ans("y" + sent, req); }, compile: async () => { compiled++; return { ok: false, error: "a.tsx still broke " + compiled }; }, room: () => { asked++; return true; } });
  assert.equal(r.rounds, 2); assert.equal(compiled, 2); assert.equal(asked, 2); assert.equal(r.built, null); assert.equal(r.usage.length, 2);
  assert.ok(reqs[1].includes("a.tsx still broke 1") && !reqs[0].includes("still broke"), "round two was not fed the latest compiler error");
  assert.ok(reqs[1].includes("y1"), "round two did not work on round one's page");
  let n = 0;
  const t = await compileRepairRounds({ error: "a.tsx broke", pages, send: async (req) => ans("z", req), compile: async () => ({ ok: false, error: "again" }), room: () => ++n < 2 });
  assert.equal(t.rounds, 1, "the second round ran with no time left");
  assert.equal(t.stopped, "time");
  assert.deepEqual(writtenPaths([{ path: "a.tsx", source: "1" }, { path: "b.tsx", source: "2" }], [{ path: "a.tsx", source: "1" }, { path: "b.tsx", source: "3" }, { path: "c.tsx", source: "" }]), ["b.tsx", "c.tsx"]);
});

// ── EVERY PUBLISH ENTRY POINT HAS THE REPAIR (the owner's guard) ────────────

test("GUARD: every publish entry point reaches a compile repair", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // The seam: the default hook is applied when a caller brings none.
  const seamAt = w.indexOf("async function recompileAndPublish(env, {");
  const seamEnd = w.indexOf("\nasync function ", seamAt + 10);
  assert.ok(seamAt > 0 && seamEnd > seamAt, "landmarks");
  const seam = w.slice(seamAt, seamEnd);
  assert.match(seam, /const compileHook = typeof onCompileFail === "function" \? onCompileFail\s*: seamCompileRepair\(env,/);
  // NEVER SILENT (2026-10-24): a failure the hook is not offered says why.
  assert.match(seam, /typeof compileHook !== "function" \? "no-hook"/);
  assert.match(seam, /tm\("compile-repair", "skip", \{ why: skipWhy \}\)/);
  // EVERY FILE: the parts ride with the pages and come back to `siteParts`.
  assert.match(seam, /pages: hasParts \? withParts\(pages, siteParts\) : pages/);
  assert.match(seam, /fix = await compileHook\(\{/);
  // publishBeside hands everything back to the seam.
  assert.match(w, /return await recompileAndPublish\(env, \{ \.\.\.opts, pages: r\.files, parts \}\)/);
  assert.match(w, /const publishSpine = \(\.\.\.a\) => recompileAndPublish\(\.\.\.a\);/);
  // Every call site: none turns the hook off.
  const calls = [...w.matchAll(/(?:recompileAndPublish|publishSpine|publishBeside)\(env,[^;]*?\}\)/gs)].map((m) => m[0]);
  assert.ok(calls.length >= 8, "too few publish call sites found: " + calls.length);
  for (const c of calls) assert.ok(!/onCompileFail:\s*(?:null|false|undefined)/.test(c), "a call site turns the repair off: " + c.slice(0, 120));
  // The edit path names the pages it wrote and bills the repair on its own bill.
  assert.match(w, /pendingPublish\.touched = writtenPaths\(eSrcAt0, eSrc\); pendingPublish\.chargeRepair = \(usage\) => eCharge\(\.\.\.usage\);/);
  // The add-on's own hook: two rounds through the same module.
  assert.match(w, /aCompileRepair = await compileRepairRounds\(\{/);
  // Builds: the only other compile entry point, `publishPages`, gets its repair dep unconditionally on by default.
  assert.match(w, /compileRepair: buildRepairOn\(env\) \?/);
  assert.match(w, /compileRepairRoom: \(\) =>/);
  // And no other caller compiles code outside these two entry points.
  const direct = [...w.matchAll(/new Request\("http:\/\/build\/build"/g)].length;
  assert.ok(direct <= 2, "a new direct compile call appeared: " + direct);
});

// ── THE REPLY SAYS IT AS A FACT ─────────────────────────────────────────────

test("REPLY FACTS: a repaired compile is said only as a fact, on edits, add-ons and builds", () => {
  const e = editReplyFacts({ ok: true, layer: "page", page: "/", compileRepaired: { pages: ["index.tsx"], rounds: 1 } });
  assert.ok(e.facts.some((f) => /did not compile; it was corrected automatically/.test(f.text)), JSON.stringify(e.facts));
  const none = editReplyFacts({ ok: true, layer: "page", page: "/" });
  assert.ok(!none.facts.some((f) => /corrected automatically/.test(f.text)));
  const a = addonReplyFacts({ ok: true, added: ["/gallery"], compileRepaired: { pages: ["gallery.tsx"], rounds: 2 } });
  assert.ok(a.facts.some((f) => /on a second try/.test(f.text)), JSON.stringify(a.facts));
  const bf = buildFacts({ compileRepaired: { fixed: ["menu.tsx"], rounds: 1, tried: 1, refused: [] } });
  assert.deepEqual(bf.compileRepaired, { pages: ["menu.tsx"], rounds: 1 });
  assert.equal(buildFacts({ compileRepaired: { tried: 1, refused: [], failedStage: "build" } }), null, "an unfixed round is not a fact");
  assert.ok(buildReplyFacts(bf).facts.some((f) => /“menu” did not compile; it was corrected automatically/.test(f.text)));
});
