// Carry-over batch 2 (2026-11-04): seven more of the old protections, rebuilt
// around the site agent. Driven through the real agent loop with a scripted
// model where the agent is involved; the readers are tested on their own.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent } from "../builder/site-agent.mjs";
import { questionOnly, sideQuestion, duplicateAdds, DUP_YES, fitRows, pageExists, agentSaidTruth } from "../builder/agent-gates.mjs";

const HOME = "export default function Home() { return <main><h1>Market Lane</h1><img src=\"/u/market/a1.jpg\" alt=\"shop\" /></main>; }\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: "export default function M() { return <main/>; }\n" }];
const SPEC = { tables: [{ name: "products", access: "display", columns: [{ name: "id" }, { name: "name" }, { name: "price" }] }] };
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {}, pages = PAGES } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }),
    siteUrl: async () => "https://market.gofarther.app",
    ...deps,
  }, { request, pages, parts: [], spec: SPEC, model: "m", maxRounds: 10 });
  return { ag, answers };
}

// ── M-89 ─────────────────────────────────────────────────────────────────────
test("a message that only asks a question cannot change the site, by any tool or a command", async () => {
  const r = await drive([[use("write_file", { file: "index.tsx", source: HOME.replace("Market", "Big") }), use("change_rows", { table: "products", add: [{ name: "Mug" }] })], [use("finish", { summary: "The heading says Market Lane." })]], { request: "What does the heading on my home page say?" });
  assert.equal(r.answers.filter((a) => /^NOT DONE: the owner's message is only a question/.test(a)).length, 2);
  assert.deepEqual(r.ag.changed, []);
  assert.deepEqual(r.ag.rows, []);
  assert.ok(r.ag.ok);
});

test("question or request: only a pure question counts (readers, with controls)", () => {
  for (const q of ["What does my booking form do?", "How many products do I have?", "Is my site on a phone layout? Does it load fast?"]) assert.equal(questionOnly(q), true, q);
  for (const w of ["Can you make the heading blue?", "Make it blue?", "What about a gallery? Add one.", "Please change the price", "hi", "Add a page"]) assert.equal(questionOnly(w), false, w);
});

test("a request that asks for work is still done (control)", async () => {
  const r = await drive([[use("write_file", { file: "index.tsx", source: HOME.replace("Market Lane", "Market Lane Bakery") })], [use("build", {})], [use("finish", { summary: "Renamed." })]], { request: "Can you call it Market Lane Bakery?" });
  assert.deepEqual(r.ag.changed, ["index.tsx"]);
});

// ── M-87 ─────────────────────────────────────────────────────────────────────
test("a typed question beside a waiting question is not its answer; a tapped or matching answer is", () => {
  const options = ["Stripe", "PayPal"];
  assert.equal(sideQuestion("How long does checkout take to set up?", { options }), true);
  assert.equal(sideQuestion("PayPal", { options }), false);
  assert.equal(sideQuestion("Stripe?", { options }), false, "an option typed with a question mark is still the answer");
  assert.equal(sideQuestion("What is Stripe?", { chosen: true, options }), false, "a tap is always the answer");
  assert.equal(sideQuestion("we use square", { options }), false, "a typed answer is an answer");
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const rSide = !!\(rWaiting && rLive && agentSideQuestion\(rb\.message, \{ chosen: rWaiting\.chosen, options: rWaiting\.question && rWaiting\.question\.options \}\)\);/);
  assert.match(w, /let routed = rSide \? \{ \.\.\.agentRouted\(\{\}\), side: true \} : agentRouted\(\{ waiting: rWaiting \}\);/);
  assert.match(w, /\} else if \(rWaiting && !resumed && \(routed\.intent === "ask" \|\| routed\.side === true\)\) \{\s*\/\/[^\n]*\n[^\n]*\n\s*rAsk = \{ answered: false, waiting: true \};/);
});

// ── M-22 ─────────────────────────────────────────────────────────────────────
test("an entry already in the table, or twice in one change, is not queued; the owner's 'Add it again' lets it through", async () => {
  const readTable = async () => [{ id: 1, name: "Sourdough", price: 6 }];
  const r = await drive([[use("change_rows", { table: "products", add: [{ name: "sourdough ", price: 6 }] })], [use("change_rows", { table: "products", add: [{ name: "Rye", price: 5 }, { name: "Rye", price: 5 }] })]], { deps: { readTable } });
  assert.match(r.answers[0], /NOT QUEUED: “sourdough ” is already in the table/);
  assert.match(r.answers[1], /“Rye” is twice in this change/);
  assert.deepEqual(r.ag.rows, []);
  const ok = await drive([[use("change_rows", { table: "products", add: [{ name: "Sourdough", price: 6 }] })]], { deps: { readTable }, request: "add it\nThey answered: " + DUP_YES });
  assert.equal(ok.ag.rows.length, 1);
  const fine = await drive([[use("change_rows", { table: "products", add: [{ name: "Sourdough", price: 7 }] })]], { deps: { readTable } });
  assert.equal(fine.ag.rows.length, 1, "a different price is a different entry (control)");
  assert.deepEqual(duplicateAdds([{ id: 1, name: "x" }], [{ id: 2, name: "x" }]), [{ i: 0, why: "already in the table" }], "the key is not compared");
});

// ── M-20 ─────────────────────────────────────────────────────────────────────
test("a long table read gives whole rows and says how many were left out, never cut JSON", async () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ id: i, name: "Product " + i, price: i, note: "x".repeat(60) }));
  const r = await drive([[use("read_table", { table: "products" })]], { deps: { readTable: async () => rows } });
  const text = r.answers[0];
  const json = text.split("\n[")[0];
  assert.ok(Array.isArray(JSON.parse(json)), "the rows shown are whole JSON");
  assert.match(text, /\[\d+ of the 300 rows read are shown/);
  assert.equal(fitRows([{ a: 1 }], 100), '[{"a":1}]', "a list that fits is shown as it is (control)");
});

// ── M-38 ─────────────────────────────────────────────────────────────────────
test("a QR code for a page the site lacks is refused; one for a real page is made", async () => {
  const r = await drive([[use("make_qr", { page: "/gallery" })], [use("make_qr", { page: "/menu" })]]);
  assert.match(r.answers[0], /no page at \/gallery/);
  assert.match(r.answers[1], /\/__gf_qr\/[a-z0-9]+-1\.svg/, "a short address (batch 3, M-39)");
  assert.equal(pageExists(new Map([["products/$id.tsx", ""]]), "/products/9"), true);
});

// ── M-41 ─────────────────────────────────────────────────────────────────────
test("a picture address that holds no file holds the finish twice; then the run hands it back to be emptied, and the reply says so", async () => {
  const bad = HOME.replace("</main>", '<img src="/u/market/made-up.jpg" alt="x" /></main>');
  const strays = async (w) => (w.pages.some((p) => p.source.includes("made-up.jpg")) ? ["/u/market/made-up.jpg"] : []);
  const r = await drive([[use("write_file", { file: "index.tsx", source: bad })], [use("build", {})], [use("finish", { summary: "Added a photo." })], [use("finish", { summary: "Added a photo." })], [use("finish", { summary: "Added a photo." })]], { deps: { strays } });
  assert.equal(r.answers.filter((a) => /HOLD NO FILE/.test(a)).length, 2);
  assert.deepEqual(r.ag.strays, ["/u/market/made-up.jpg"]);
  assert.match(agentSaidTruth("Added a photo.", { strays: r.ag.strays }), /1 picture was left empty/);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /if \(Array\.isArray\(ag\.strays\) && ag\.strays\.length\) \{\s*const dp = agentDropStrays\(ag\.pages, ag\.strays\)/);
  assert.ok(w.indexOf("agentDropStrays(ag.pages") < w.indexOf("out = await save(ag);"), "emptied before the save");
});

// ── M-70 ─────────────────────────────────────────────────────────────────────
test("a draft save says to press Publish, once; the agent is told it cannot publish", async () => {
  assert.match(agentSaidTruth("Changed the price.", { draft: true }), /press Publish to put them on your live site/);
  assert.doesNotMatch(agentSaidTruth("Changed the price. Press Publish when ready.", { draft: true }), /in your draft/);
  assert.equal(agentSaidTruth("Changed the price.", { draft: false }), "Changed the price.");
  const { agentSystem } = await import("../builder/site-agent.mjs");
  assert.match(agentSystem(null, ""), /tell them to press the Publish button; you cannot publish/);
});
