// Carry-over batch 5 (2026-11-04): read before overwrite, uploads by their bytes,
// clean words to the customer, today's date, server-set columns, QR repeats,
// one question once, empty and unreadable messages, entries the database refuses.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, todayLine, MAX_QRS } from "../builder/site-agent.mjs";
import { scrubSaid, agentSaidTruth, rowProblems } from "../builder/agent-gates.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = "export default function Home() { return <main><h1>Market Lane</h1></main>; }\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: "export default function A() {\n  return (\n    <main>\n      <h1>About</h1>\n      <p>Since 1982.</p>\n    </main>\n  );\n}\n" }, { path: "menu.tsx", source: "export default function M() { return <main/>; }\n" }];
const SPEC = { tables: [{ name: "classes", access: "display", columns: [{ name: "id" }, { name: "title", required: true }, { name: "level", enum: ["beginner", "advanced"] }, { name: "created_at" }] }] };
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {}, opts = {} } = {}) {
  const answers = [], firsts = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      if (round === 0) firsts.push(JSON.stringify(req.messages[0]));
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }), siteUrl: async () => "https://market.gofarther.app", canAsk: () => true,
    ...deps,
  }, { request, pages: PAGES, parts: [], spec: SPEC, model: "m", maxRounds: 12, lazyFiles: true, ...opts });
  return { ag, answers, firsts };
}

test("M-28 a file the site had is overwritten only after it was read; after reading, it is written", async () => {
  const r = await drive([[use("write_file", { file: "about.tsx", source: "export default function A() { return <main>x</main>; }\n" })], [use("read_files", { files: ["about.tsx"] })], [use("write_file", { file: "about.tsx", source: "export default function A() { return <main>x</main>; }\n" })]]);
  assert.match(r.answers[0], /NOT WRITTEN: read about\.tsx first/);
  assert.match(r.answers[2], /^Saved about\.tsx/);
  const kept = await drive([[use("write_file", { file: "about.tsx", source: PAGES[1].source.replace("Since 1982.", "Since 1983.") })]]);
  assert.match(kept.answers[0], /^Saved about\.tsx/, "a write keeping most of the file's lines was not blind (control)");
  const cat = await drive([[use("write_file", { file: "gallery.tsx", source: HOME })]], { request: "add a gallery\nThey answered: Yes, go ahead" });
  assert.match(cat.answers[0], /^Saved gallery\.tsx/, "a new file needs no read (control)");
});

test("M-29 a picture is checked by its stored type and size, not its name", () => {
  const fn = W.slice(W.indexOf("const checkUpload = async (raw) => {"), W.indexOf("const checkUpload = async (raw) => {") + 2000);
  assert.match(fn, /head = await env\.SITES_BUCKET\.head\(hit\.key\)/);
  assert.match(fn, /if \(!\/\^image\\\/\(png\|jpeg\|webp\|gif\|avif\)\$\/i\.test\(type\)\)/);
  assert.match(fn, /if \(Number\(head\.size\) > AGENT_LOGO_MAX_BYTES\)/);
});

test("M-30 M-79 M-81 M-85 the agent's words reach the customer without keys, provider names, emoji, version ids or file names", () => {
  const out = scrubSaid("✅ Updated index.tsx and -parts/site-footer; fal returned sk_live_abcdef123456. Restored 01790468089054-8btpep 🎉");
  assert.equal(out, "Updated the home page and the site footer section; the picture service returned [hidden]. Restored a saved version");
  assert.equal(agentSaidTruth("Changed the hours 🎉"), "Changed the hours");
  assert.equal(scrubSaid("Opening hours are 8 to 5."), "Opening hours are 8 to 5.", "plain words untouched (control)");
});

test("M-33 the agent is told today's date", async () => {
  assert.match(todayLine(Date.UTC(2026, 10, 4)), /TODAY: Wednesday,? 4 November 2026 \(UTC\)/);
  const r = await drive([[use("finish", { summary: "ok" })]], { deps: { now: () => Date.UTC(2026, 10, 4) } });
  assert.match(r.firsts[0], /TODAY: Wednesday,? 4 November 2026/);
});

test("M-36 M-5 entries: server-set columns, required fields and allowed values are refused before anything is queued", async () => {
  const r = await drive([[use("change_rows", { table: "classes", add: [{ title: "Yoga", created_at: "2020-01-01" }] })], [use("change_rows", { table: "classes", add: [{ level: "beginner" }] })], [use("change_rows", { table: "classes", add: [{ title: "Yoga", level: "expert" }] })], [use("change_rows", { table: "classes", add: [{ title: "Yoga", level: "beginner" }] })]]);
  assert.match(r.answers[0], /not columns of classes.*created_at/);
  assert.match(r.answers[1], /NOT QUEUED: the database would refuse these.*title is required/);
  assert.match(r.answers[2], /level must be one of beginner, advanced/);
  assert.match(r.answers[3], /^Queued for classes/);
  assert.equal(r.ag.rows.length, 1);
  assert.deepEqual(rowProblems(null, [{ x: 1 }]), [], "a table with no declared rules (control)");
});

test("M-40 the same QR address gives the same code; at most MAX_QRS in one change", async () => {
  const r = await drive([[use("make_qr", { page: "/menu" })], [use("make_qr", { page: "/menu" })]]);
  const first = (r.answers[0].match(/\/__gf_qr\/[a-z0-9]+-1\.svg/) || [])[0];
  assert.ok(first);
  assert.match(r.answers[1], new RegExp("already made: use " + first.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")));
  assert.equal(MAX_QRS, 12);
});

test("M-93 the same question is not asked twice", async () => {
  const r = await drive([[use("ask_owner", { question: "Which days?", options: ["Weekdays", "Every day"] })]], { request: "change the hours\n\nWHAT THE OWNER ALREADY ANSWERED\nYou asked: Which days?\nThey answered: Every day" });
  assert.match(r.answers[0], /you already asked this/);
  assert.equal(r.ag.ask, null);
});

test("M-9 M-11 an unreadable attachment stops before anything runs; an empty first message never reaches the model", () => {
  assert.match(W, /if \(inFiles\.skipped && inFiles\.skipped\.length\) \{[\s\S]{0,400}error: "attachment-unreadable", layer: "agent", cost: 0, unchanged: true/);
  assert.ok(W.indexOf('error: "attachment-unreadable"') < W.indexOf("let ag = settle(await runOnce(ask0, start));"), "before the agent runs");
  assert.match(W, /async function newProjectTurn\(env, \{ rb, auth \}\) \{\s*\/\/[^\n]*\n\s*if \(!String\(\(rb && rb\.message\) \|\| ""\)\.trim\(\)\) return \{ ok: false, error: "empty", cost: 0/);
});
