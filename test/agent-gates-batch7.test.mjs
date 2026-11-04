// Carry-over batch 7 (2026-11-04): several pictures and one logo, a logo
// nobody shows, the draft's tables shown to the agent, put-backs that fail are
// told, before-and-after values, and the instruction-only rules.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, agentSystem } from "../builder/site-agent.mjs";
import { agentSaidTruth } from "../builder/agent-gates.mjs";
import { valueFacts } from "../builder/agent-outcome.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HEADER = "export default function H() {\n  return <header><a href=\"/\">Market Lane</a></header>;\n}\n";
const PAGES = [{ path: "index.tsx", source: "import H from \"@/components/site-header\";\nexport default function Home() { return <main><H /><h1>Market Lane</h1></main>; }\n" }];
const PARTS = [{ name: "site-header", source: HEADER }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });
const PNG = { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } };

async function drive(calls, { request = "change it", attached = [] } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }), canAsk: () => true, saveSettings: () => true,
    checkUpload: async (n) => ({ ok: true, name: n, url: "/u/market/" + n }),
  }, { request, pages: PAGES, parts: PARTS, css: "", model: "m", maxRounds: 12, attached });
  return { ag, answers };
}

test("M-51 two pictures sent as 'my logo': the agent asks which, once", async () => {
  const attached = [{ id: "a1", name: "one.png", kind: "image", ...PNG }, { id: "a2", name: "two.png", kind: "image", ...PNG }];
  const r = await drive([[use("set_logo", { upload: "one.png" })]], { request: "here's my logo", attached });
  assert.match(r.answers[0], /the owner sent 2 pictures: ask with ask_owner which one is the logo/);
  const one = await drive([[use("set_logo", { upload: "one.png" })]], { request: "here's my logo", attached: attached.slice(0, 1) });
  assert.match(one.answers[0], /^Queued/, "one picture is the logo (control)");
});

test("M-53 a logo stored while the header never shows it holds the finish once; then the reply says so", async () => {
  const r = await drive([[use("set_logo", { upload: "logo.png" })], [use("finish", { summary: "Logo set." })], [use("finish", { summary: "Logo set." })]], { request: "use logo.png as my logo" });
  assert.equal(r.answers.filter((a) => /no file shows it/.test(a)).length, 1);
  assert.equal(r.ag.logoUnshown, true);
  assert.match(agentSaidTruth("Logo set.", { logoUnshown: true }), /header doesn't show it yet/);
  const shows = HEADER.replace('<a href="/">Market Lane</a>', '{SITE_LOGO ? <img src={SITE_LOGO} alt="Market Lane" /> : <a href="/">Market Lane</a>}');
  const ok = await drive([[use("set_logo", { upload: "logo.png" })], [use("read_files", { files: ["-parts/site-header"] })], [use("write_file", { file: "-parts/site-header", source: 'import { SITE_LOGO } from "@/site-brand";\n' + shows })], [use("build", {})], [use("finish", { summary: "Logo set." })]], { request: "use logo.png as my logo" });
  assert.equal(ok.ag.logoUnshown, false);
  assert.ok(!ok.answers.some((a) => /no file shows it/.test(a)));
});

test("M-34 the agent is shown the tables the draft will make", () => {
  assert.match(W, /if \(spec && draftFirst\(env\)\) \{\s*try \{ const view = await draftView\(env, slug\); if \(view\) spec = specOverlay\(spec, view\.ops\); \}\s*catch \{ spec = null; unreadable = true; \}/);
});

test("M-37 a put-back that fails is logged and told, never swallowed", () => {
  assert.match(W, /catch \(e\) \{ putBackFailed = true; console\.error\("agent settings put-back failed:"/);
  assert.match(W, /catch \(e\) \{ putBackFailed = true; console\.error\("agent css put-back failed:"/);
  assert.ok(W.indexOf("let putBackFailed = false;") < W.indexOf("const fail = async (status, body) => {"), "declared before the reply helper reads it");
  assert.match(W, /\.\.\.\(body && body\.needKeys \? \{\} : await askedKeys\(\)\), \.\.\.putBackNote\(body\) \} \};/);
});

test("M-80 a changed entry is told with its before and after values", () => {
  const done = [{ table: "products", kind: "update", pk: "id", old: { id: 4, name: "Rye", price: 40, updated_at: "a" }, row: { id: 4, name: "Rye", price: 42, updated_at: "b" } }];
  assert.deepEqual(valueFacts(done), ["In products (Rye): price 40 → 42."]);
  assert.match(agentSaidTruth("Updated the price.", { values: valueFacts(done) }), /In products \(Rye\): price 40 → 42\./);
  assert.equal(agentSaidTruth("Rye is now 42.", { values: valueFacts(done) }), "Rye is now 42.", "already said (control)");
});

test("the instruction-only rules are in the agent's rules (M-57 M-58 M-59 M-63 M-75 M-77 M-82 M-84)", () => {
  const sys = agentSystem(null, "");
  for (const re of [/NEW THINGS LOOK LIKE THE SITE/, /never put it on the home page by default/, /"keep the space" or "leave a gap" empties its frame/, /you never watched or listened to a video/, /offer at most one next step, and never one you already offered/]) assert.match(sys, re);
});
