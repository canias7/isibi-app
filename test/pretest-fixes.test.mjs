// PRETEST FIXES (2026-10-30), before a paid live test:
//   PTF1  a first build's agent is asked whether the credits cover it; a
//         shortfall stops it before any round, publishes nothing, gives the
//         build's debits back and answers 402; helpers inherit the check.
//   PTF2  the agent's compile-only build and look translate nothing, charge
//         nothing and write no config; the real save still translates.
//   PTF3  a new site's agent is not told to write a stylesheet it cannot
//         write, and the refusal says why (no "could not be read").
//   PTF4  a part's scope admits a new page at its own route and the site's
//         chrome (components the home page or several pages import), and
//         still refuses an unrelated page.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { driveBuild, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";
import { runSiteAgent, writableKey, makeWorkspace, projectOverview, NEW_SITE_CSS, toolsFor } from "../builder/site-agent.mjs";
import { scopeGuard } from "../builder/agent-guard.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

delete process.env.GF_OLD_LANES;

const use = (name, input, id) => ({ type: "tool_use", id: id || "t" + randomBytes(3).toString("hex"), name, input });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: "tool_use" });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

test("PTF1 a first build whose credits fall short: the agent stops before its first round, nothing is published, the debits go back, 402", async () => {
  const agent = [];
  let designed = false;
  let creditReads = 0;
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF },
    ledger: { get_credits: () => { if (designed) { creditReads++; return creditReads > 1 ? 0 : 500; } return 500; } },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (b.tool_choice && b.tool_choice.name === "design_schema") { designed = true; return null; }
      if (!(Array.isArray(b.tools) && b.tools.some((t) => t.name === "finish"))) return null;
      agent.push(b);
      return json({ stop_reason: "tool_use", content: [use("finish", { summary: "done" })], usage: { input_tokens: 10, output_tokens: 10 } });
    },
  });
  assert.ok(creditReads >= 2, "the agent asked the balance: " + JSON.stringify(r.reply).slice(0, 300));
  assert.equal(agent.length, 0, "no agent round after the shortfall");
  assert.equal(r.status, 402, JSON.stringify(r.reply).slice(0, 400));
  assert.equal(r.reply.need, "credits");
  assert.ok(![...r.store.keys()].some((k) => /^source\/[^/]+\/pages\.json$/.test(k)), "no pages stored");
  assert.ok(![...r.store.keys()].some((k) => /^current\//.test(k)), "nothing published");
  const debits = r.seen.rpc.filter((x) => x.fn === "credit_debit").length;
  const reversals = r.seen.rpc.filter((x) => x.fn === "credit_reverse").length;
  assert.ok(debits === 0 || reversals >= 1, "every debit is given back: " + JSON.stringify(r.seen.rpc.map((x) => x.fn)));
});

test("PTF1b helpers inherit the credit check: a shortfall stops a helper before its first call", async () => {
  const sends = [];
  let calls = 0;
  const main = [
    answer(use("write_file", { file: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" })),
    answer(use("helpers", { tasks: [{ file: "about.tsx", brief: "Our story" }] })),
    answer(use("finish", { summary: "done" })),
  ];
  let i = 0;
  const r = await runSiteAgent({
    send: async (req) => { const helper = /handed you ONE page/.test(req.messages[0].content[0].text); sends.push(helper ? "helper" : "main"); return helper ? answer(use("finish", { summary: "x" })) : main[Math.min(i++, main.length - 1)]; },
    build: async () => ({ ok: true }),
    affords: async () => { calls++; return calls === 1; },
  }, { request: "a bakery", pages: [], parts: [], helpers: true, model: "grok-4.7" });
  assert.ok(calls >= 2, "the helper asked too: " + calls);
  assert.ok(!sends.includes("helper"), "the helper made no model call: " + sends.join(","));
  assert.ok(r, "the run answered");
});

// ── PTF2: the agent's compile-only build on a site with a second language ──
const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n" +
  "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
const HOME = page("/", "<h1>Harbour Loaf</h1><p>Open 7am to 4pm.</p>");
const HOME_NEW = page("/", "<h1>Harbour Loaf</h1><p>Open 8am to 5pm.</p>");
const USER = { id: "u-ptf-1", email: "owner@example.com" };

test("PTF2 a compile-only build translates nothing, charges nothing and writes no config; the save still translates", async () => {
  const slug = "ptf-" + randomBytes(4).toString("hex");
  const cfgKey = CONFIG_KEY(slug);
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [cfgKey, JSON.stringify({ look: { brand: "Harbour Loaf", lang: "en", langs: ["fr"] }, css: ":root{}" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  let cfgWrites = 0;
  const b = {
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { if (k === cfgKey) cfgWrites++; store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  const rounds = [
    [use("write_file", { file: "index.tsx", source: HOME_NEW })],
    [use("build", {})],
    [use("finish", { summary: "Hours now 8am to 5pm." })],
  ];
  const at = { other: 0, debits: 0 };
  const snap = [];
  let n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/rpc/use_credits")) { at.debits++; return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(500);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("/v1/messages") || u.includes("api.x.ai")) {
      const tools = Array.isArray(args.tools) ? args.tools.map((t) => t.name) : [];
      if (tools.includes("finish")) {
        snap.push({ other: at.other, debits: at.debits, cfg: cfgWrites });
        return json({ stop_reason: "tool_use", content: rounds[Math.min(n++, rounds.length - 1)], usage: { input_tokens: 100, output_tokens: 50 } });
      }
      at.other++;
      return new Response("no stub", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", instruction: "Change the hours to 8am to 5pm.", picker: "sonnet", idem: "idem" + randomBytes(6).toString("hex") }) }), env, ctx);
    await Promise.allSettled(ctx.pending);
    assert.equal(snap.length, 3, "three agent rounds: " + res.status);
    assert.equal(c.calls.length >= 2, true, "the build's compile and the save's: " + c.calls.length);
    // round 3 is asked after the compile-only build
    assert.deepEqual(snap[2], { other: 0, debits: 0, cfg: 0 }, "the compile-only build made no translation call, no charge, no config write");
    assert.ok(at.other >= 1, "the real save asked for the translation");
    assert.ok(JSON.stringify(c.calls[0].body || {}).includes("8am to 5pm"), "the compile-only build compiled the change");
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
});

test("PTF3 a new site: no stylesheet to write, said plainly; an existing site's unreadable stylesheet keeps its own reason", () => {
  assert.doesNotMatch(projectOverview([]), /The stylesheet is "styles\.css"/);
  assert.match(projectOverview([]), /no stylesheet to write/);
  const fresh = makeWorkspace([], [], null);
  const w = writableKey("styles.css", fresh);
  assert.equal(w.ok, false);
  assert.equal(w.why, NEW_SITE_CSS);
  assert.doesNotMatch(w.why, /could not be read/);
  const old = makeWorkspace([{ path: "index.tsx", source: "x" }], [], null);
  assert.match(writableKey("styles.css", old).why, /could not be read/);
  assert.equal(writableKey("styles.css", makeWorkspace([], [], ":root{}")).ok, true);
  const helpers = toolsFor({ helpers: () => [] }).find((t) => t.name === "helpers");
  assert.doesNotMatch(helpers.description, /the stylesheet, shared components/);
});

test("PTF4 a part's scope: a new page at its route and the site's chrome are allowed; an unrelated page is still refused", () => {
  const imp = (n) => "import X from './-parts/" + n + "'\n";
  const pages = [
    { path: "index.tsx", source: imp("site-header") + imp("site-footer") + page("/", "<h1>Home</h1>") },
    { path: "menu.tsx", source: imp("menu-card") + page("/menu", "<h1>Menu</h1>") },
    { path: "about.tsx", source: imp("site-header") + imp("about-story") + page("/about", "<h1>About</h1>") },
  ];
  const parts = [
    { name: "site-header", source: "import Nav from './nav-links'\nexport default function H(){return <header/>}" },
    { name: "nav-links", source: "export default function N(){return <nav/>}" },
    { name: "site-footer", source: "export default function F(){return <footer/>}" },
    { name: "menu-card", source: "export default function C(){return <div/>}" },
    { name: "about-story", source: "export default function S(){return <div/>}" },
  ];
  const g = scopeGuard({ pages, parts, routes: ["/menu", "/gallery"] });
  assert.equal(g("menu.tsx"), "");
  assert.equal(g("-parts/menu-card"), "");
  assert.equal(g("gallery.tsx"), "", "a new page at a scoped route");
  assert.equal(g("-parts/site-header"), "", "the header (the home page's import)");
  assert.equal(g("-parts/nav-links"), "", "followed through the header");
  assert.equal(g("-parts/site-footer"), "", "the footer");
  assert.notEqual(g("about.tsx"), "", "an unrelated page is refused");
  assert.notEqual(g("index.tsx"), "", "the home page is refused");
  assert.notEqual(g("contact.tsx"), "", "a new page at another route is refused");
  assert.notEqual(g("-parts/about-story"), "", "another page's own component is refused");
  assert.notEqual(g("styles.css"), "");
});
