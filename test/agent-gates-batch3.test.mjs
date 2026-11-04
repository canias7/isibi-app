// Carry-over batch 3 (2026-11-04): database refusals told, the address only on
// the owner's words, expired first-build answers, no pasted scripts, the
// balance every round, QR pictures never copied by the model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, CREDIT_CHECK_EVERY } from "../builder/site-agent.mjs";
import { schemaRefusals, addressNamed, scriptProblem, expandQr, unknownQr, agentSaidTruth } from "../builder/agent-gates.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = "export default function Home() { return <main><h1>Market Lane</h1></main>; }\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: "export default function M() { return <main/>; }\n" }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {}, opts = {} } = {}) {
  const answers = [], sent = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async (w) => { sent.push(w); return { ok: true }; },
    siteUrl: async () => "https://market.gofarther.app",
    address: async () => ({ ok: true, from: "market" }),
    ...deps,
  }, { request, pages: PAGES, parts: [], model: "m", maxRounds: 10, ...opts });
  return { ag, answers, sent };
}

// ── M-68 ─────────────────────────────────────────────────────────────────────
test("what the database refused reaches the facts and the reply, never 'added'", () => {
  const made = { refusedRules: [{ table: "orders", feature: "owner-only", rule: "rls" }], functionErrors: [{ name: "place_order", error: "x" }] };
  assert.deepEqual(schemaRefusals(made), ["the owner-only rule on orders (rls)", "the database function place_order"]);
  assert.deepEqual(schemaRefusals({ tables: 2 }), [], "a clean apply refuses nothing (control)");
  assert.match(W, /const made = await writer\.calls\.applySiteSchema\(conn, merged\.spec\);\s*const refused = agentSchemaRefusals\(made\);/);
  assert.match(W, /return \{ ok: true, added: merged\.added, skipped: merged\.skipped, revision, refused \};/);
  assert.match(W, /schemaFacts\.push\("The database refused: " \+ sr\.refused\.join\("; "\) \+ "\."\);/);
  assert.match(agentSaidTruth("Added orders.", { failed: ["The database refused: the owner-only rule on orders (rls)."] }), /What did not work: The database refused/);
});

// ── M-24 ─────────────────────────────────────────────────────────────────────
test("the site's address moves or is let go only when the owner's words name it", async () => {
  const r = await drive([[use("rename_site", { to: "sunset-shoes" }), use("forget_old_address", { name: "old-shop" })]], { request: "give my site a nicer address" });
  assert.match(r.answers[0], /NOT DONE: the owner never named the address “sunset-shoes”/);
  assert.match(r.answers[1], /never named the address “old-shop”/);
  assert.equal(r.ag.address, null);
  const ok = await drive([[use("rename_site", { to: "sunset-shoes" })]], { request: "move my site to sunset-shoes.gofarther.app" });
  assert.match(ok.answers[0], /^Queued: the site moves to sunset-shoes/);
  const tapped = await drive([[use("rename_site", { to: "sunset-shoes" })]], { request: "nicer address\nYou asked: which one?\nThey answered: sunset-shoes" });
  assert.match(tapped.answers[0], /^Queued/);
  assert.equal(addressNamed("call it sunset-shoes-2", "sunset-shoes"), false, "a longer address is not this one");
});

// ── M-88 ─────────────────────────────────────────────────────────────────────
test("an answer to a first build's question starts the build only while that question is live", () => {
  const at = W.indexOf("if (rb.firstBuild === true && answerClaim(rb) !== undefined) {");
  assert.ok(at > 0, "the landmark exists");
  const block = W.slice(at, W.indexOf('return Response.json({ ok: true, intent: "build", cost: 0, agent: true });', at));
  assert.match(block, /if \(!claim \|\| !bSlug \|\| !env\.SITES_BUCKET\) return staleAnswer\("other"\);/);
  assert.match(block, /bq = await loadAsk\(env\.SITES_BUCKET, bSlug\)/);
  assert.match(block, /const live = askLive\(bq\.record, \{ id: claim\.id, uid: ru\.id, slug: bSlug \}\);\s*if \(!live\.ok\) return staleAnswer\(live\.why\);/);
  assert.equal((W.match(/return Response\.json\(\{ ok: true, intent: "build", cost: 0, agent: true \}\);/g) || []).length, 1, "no other door answers build on a claim");
});

// ── M-23 ─────────────────────────────────────────────────────────────────────
test("pasted HTML and outside scripts are refused; structured data and what was already there are not", async () => {
  const r = await drive([
    [use("write_file", { file: "index.tsx", source: HOME.replace("<h1>", '<div dangerouslySetInnerHTML={{ __html: widget }} /><h1>') })],
    [use("write_file", { file: "index.tsx", source: HOME.replace("<h1>", '<script src="https://evil.example/x.js"></script><h1>') })],
    [use("write_file", { file: "index.tsx", source: HOME.replace("<h1>", '<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@type": "Bakery" }) }} /><h1>') })],
  ]);
  assert.match(r.answers[0], /NOT WRITTEN: the page would carry raw HTML/);
  assert.match(r.answers[1], /a script loaded from another site/);
  assert.match(r.answers[2], /^Saved index\.tsx/);
  const had = '<div dangerouslySetInnerHTML={{ __html: x }} />';
  assert.equal(scriptProblem(had, had + "<p>more</p>"), "", "what the page already had is not this change's");
  assert.equal(scriptProblem("", "head: () => ({ scripts: [{ src: \"https://cdn.x/y.js\" }] })"), "a script loaded from another site");
});

// ── M-6 ──────────────────────────────────────────────────────────────────────
test("the balance is asked before every round", async () => {
  assert.equal(CREDIT_CHECK_EVERY, 1);
  let asked = 0;
  const r = await drive([[use("read_files", { files: ["index.tsx"] })], [use("read_files", { files: ["menu.tsx"] })], [use("finish", { summary: "Read." })]], { deps: { affords: async () => { asked++; return asked < 3; } } });
  assert.equal(asked, 3);
  assert.equal(r.ag.stopped, "no-credits");
  assert.equal(r.ag.rounds, 2, "the third round never ran");
});

// ── M-39 ─────────────────────────────────────────────────────────────────────
test("make_qr gives a short address; code puts the picture into the build and the save; an invented one holds the finish", async () => {
  const r = await drive([[use("make_qr", { page: "/menu" })]]);
  const token = (r.answers[0].match(/\/__gf_qr\/[a-z0-9]+-1\.svg/) || [])[0];
  assert.ok(token, r.answers[0]);
  assert.doesNotMatch(r.answers[0], /base64/, "the model is never handed the picture to copy");
  // The run's own token: written as given, expanded on the way out.
  let tk = "";
  const out = await runSiteAgent({
    send: async (req) => {
      const n = req.messages.length;
      if (n === 1) return { content: [use("make_qr", { page: "/menu" })], stop_reason: "tool_use", usage: {} };
      const last = req.messages[n - 1].content.find((b) => b.type === "tool_result");
      if (!tk) tk = (String(last.content).match(/\/__gf_qr\/[a-z0-9]+-1\.svg/) || [""])[0];
      if (n === 3) return { content: [use("write_file", { file: "index.tsx", source: HOME.replace("</main>", '<img src="' + tk + '" alt="menu" /></main>') })], stop_reason: "tool_use", usage: {} };
      if (n === 5) return { content: [use("write_file", { file: "menu.tsx", source: '<img src="/__gf_qr/zzzz-9.svg" />' })], stop_reason: "tool_use", usage: {} };
      if (n === 7) return { content: [use("build", {})], stop_reason: "tool_use", usage: {} };
      if (n === 9) return { content: [use("finish", { summary: "QR added." })], stop_reason: "tool_use", usage: {} };
      if (n === 11) return { content: [use("write_file", { file: "menu.tsx", source: "export default function M() { return <main/>; }\n" })], stop_reason: "tool_use", usage: {} };
      if (n === 13) return { content: [use("build", {})], stop_reason: "tool_use", usage: {} };
      return { content: [use("finish", { summary: "QR added." })], stop_reason: "tool_use", usage: {} };
    },
    build: async () => ({ ok: true }), siteUrl: async () => "https://market.gofarther.app",
  }, { request: "add a QR to the menu", pages: PAGES, parts: [], model: "m", maxRounds: 12 });
  assert.ok(out.ok, out.stopped);
  const home = out.pages.find((p) => p.path === "index.tsx").source;
  assert.match(home, /src="data:image\/svg\+xml;base64,/, "the saved page carries the real picture");
  assert.doesNotMatch(home, /__gf_qr/);
  assert.deepEqual(unknownQr(new Map([["a", '<img src="/__gf_qr/x-2.svg" />']]), new Map()), ["/__gf_qr/x-2.svg"]);
  assert.deepEqual(expandQr([{ path: "a", source: "/__gf_qr/x-1.svg" }], new Map([["/__gf_qr/x-1.svg", "data:1"]])), [{ path: "a", source: "data:1" }]);
});
