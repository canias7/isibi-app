// GLOOPY'S TOOLS HELD BACK UNTIL NEEDED (the owner, 2026-11-15: "yes fix it too", after Coder's "make sure the cost is right
// ABOUT the tools, only calling them when necessary"): pay, vault, schedule, webhook, monitor, stop_job and request_secret
// leave Gloopy's requests (about 3,600 tokens on every call); a note names them, and tool_search loads one when Gloopy needs
// it, from then on for the rest of the chat, as Coder's deferred tools. Its connectors keep their own connector_search.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder } from "../container/coder-agent.mjs";
import { GLOOPY_SYSTEM, GLOOPY_TOOLS, GLOOPY_HELD_BACK, BROWSER_TOOL_NAMES } from "../container/gloopy-agent.mjs";
import { TOOL_SEARCH, DEFERRED_NOW, LOADED_NOW, SEARCH_HINTS, heldBackRefusal } from "../container/coder-toolsearch.mjs";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(i++, steps.length - 1)]; } }; };
// Gloopy's turn as its machine starts it (server.mjs, gloopyOpts), with the list it now gives.
const GLOOPY = { system: GLOOPY_SYSTEM, tools: GLOOPY_TOOLS, holdBack: GLOOPY_HELD_BACK, nudges: false, who: "Gloopy", github: false, hooks: [], checker: false, rules: null, sessionRules: null };
const names = (req) => req.tools.map((t) => t.function.name);
const ALL = GLOOPY_TOOLS.map((t) => t.function.name);
const KEPT = ALL.filter((n) => !GLOOPY_HELD_BACK.includes(n));
const def = (n) => GLOOPY_TOOLS.find((t) => t.function.name === n);
const notes = (req) => req.messages.filter((m) => typeof m.content === "string" && m.content.includes(DEFERRED_NOW));
async function turn(steps, extra = {}) {
  const g = scripted(steps);
  const events = [], cmds = [];
  const out = await runCoder({ send: g.send, exec: async (x) => { cmds.push(x.command); return { code: 0, output: "" }; }, emit: (e) => events.push(e) }, { text: "go", ...GLOOPY, ...extra });
  const reply = (id) => (out.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { out, seen: g.seen, events, cmds, reply };
}

test("GH1 (2026-11-15) Gloopy's first request leaves out the 7 held-back tools, adds tool_search after the rest, and a note names the 7; about 3,600 tokens lighter", async () => {
  assert.deepEqual([...GLOOPY_HELD_BACK], ["pay", "vault", "schedule", "webhook", "monitor", "stop_job", "request_secret"]);
  const t = await turn([say("Hi.")]);
  assert.deepEqual(names(t.seen[0]), [...KEPT, TOOL_SEARCH], "Gloopy's other tools in their order, then tool_search");
  const n = notes(t.seen[0]);
  assert.equal(n.length, 1, "one note");
  const listed = n[0].content.slice(n[0].content.indexOf(DEFERRED_NOW) + DEFERRED_NOW.length).replace(/\)$/, "").trim().split("\n");
  assert.deepEqual(listed, [...GLOOPY_HELD_BACK].sort(), "the 7, by name, sorted as Claude Code lists them");
  const tokens = (list) => JSON.stringify(list).length / 4;
  const saved = tokens(GLOOPY_TOOLS) - tokens(t.seen[0].tools);
  assert.ok(saved > 3000, "lighter by about 3,600 tokens a call (" + Math.round(saved) + ")");
});

test("GH2 tool_search loads one: Claude Code's answer, the chat's record, and from the next request on its definition after tool_search", async () => {
  const t = await turn([say("", [call(TOOL_SEARCH, { query: "select:schedule" }, "s1")]), say("Loaded.")]);
  assert.equal(t.reply("s1"), LOADED_NOW + "\nschedule");
  assert.deepEqual(t.out.messages.find((m) => m.role === "tool" && m.tool_call_id === "s1").toolsLoaded, ["schedule"]);
  assert.deepEqual(names(t.seen[1]), [...KEPT, TOOL_SEARCH, "schedule"]);
  assert.deepEqual(t.seen[1].tools.at(-1), def("schedule"), "Gloopy's own definition, as it was");
  assert.equal(notes(t.seen[1]).length, 1, "the note is not said again");
});

test("GH3 a keyword search finds a held-back tool by its search hint (\"reminder\" → schedule)", async () => {
  for (const n of GLOOPY_HELD_BACK) assert.ok(SEARCH_HINTS[n], n + " has a search hint");
  const t = await turn([say("", [call(TOOL_SEARCH, { query: "reminder" }, "s1")]), say("ok")]);
  assert.match(t.reply("s1"), new RegExp("^" + LOADED_NOW.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n(.+\\n)*schedule"));
  assert.ok(names(t.seen[1]).includes("schedule"));
});

test("GH4 a held-back tool called before it was loaded, with input its definition refuses: Claude Code's InputValidationError and its note to load it first; nothing runs", async () => {
  const t = await turn([say("", [call("schedule", { action: 5 }, "a1")]), say("ok")]);
  const r = t.reply("a1");
  assert.match(r, /^error: InputValidationError: /);
  assert.match(r, /The parameter `action` type is expected as `string` but provided as `number`/);
  assert.match(r, /This tool's schema was not sent to the API — it was not in the discovered-tool set derived from message history\./);
  assert.match(r, /Load the tool first: call tool_search with query "select:schedule", then retry this call\./);
  assert.ok(!names(t.seen[1]).includes("schedule"), "still not loaded");
  const missing = await turn([say("", [call("request_secret", { host: "api.example.com" }, "a2")]), say("ok")]);
  assert.match(missing.reply("a2"), /The required parameter `reason` is missing/);
  const wrong = await turn([say("", [call("webhook", { action: "explode" }, "a3")]), say("ok")]);
  assert.match(wrong.reply("a3"), /Invalid option: expected one of \\"add\\"\|\\"list\\"\|\\"remove\\"/);
});

test("GH5 a held-back tool called before it was loaded, with input that fits: it runs, as Claude Code runs it (its own answer, no refusal)", async () => {
  const t = await turn([say("", [call("stop_job", { job: "b9" }, "k1")]), say("ok")]);
  const r = t.reply("k1");
  assert.ok(typeof r === "string" && r.length > 0);
  assert.doesNotMatch(r, /InputValidationError|schema was not sent/);
});

test("GH6 the next message: a loaded tool stays in the request without loading it again, and the note is not said again", async () => {
  const first = await turn([say("", [call(TOOL_SEARCH, { query: "select:vault,pay" }, "s1")]), say("ok")]);
  assert.equal(first.reply("s1"), LOADED_NOW + "\nvault\npay");
  const g = scripted([say("again")]);
  await runCoder({ send: g.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "and now?", messages: first.out.messages });
  assert.deepEqual(names(g.seen[0]), [...KEPT, TOOL_SEARCH, "vault", "pay"], "loaded in the order asked");
  assert.equal(notes(g.seen[0]).length, 1, "the first note only");
  const r = await turn([say("", [call("vault", { what: "contact", name: "Ana" }, "v1")]), say("ok")], { messages: first.out.messages });
  assert.doesNotMatch(r.reply("v1") || "", /schema was not sent/, "a loaded tool's call is not checked as one held back");
});

test("GH7 Gloopy's one long chat switches at its next message (a chat that ran before keeps no tool upfront), and a summary keeps what was loaded", async () => {
  const g = scripted([say("Hi again.")]);
  await runCoder({ send: g.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "next", messages: [{ role: "user", content: "hello" }, { role: "assistant", content: "Hi!" }] });
  assert.deepEqual(names(g.seen[0]), [...KEPT, TOOL_SEARCH]);
  assert.equal(notes(g.seen[0]).length, 1);
  const s = scripted([say("ok")]);
  await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "next", messages: [{ role: "user", content: "(Summary of the chat so far: …)", toolsLoaded: ["webhook"] }] });
  assert.deepEqual(names(s.seen[0]), [...KEPT, TOOL_SEARCH, "webhook"]);
});

test("GH8 without the list (a helper, or as before): every tool sent, no tool_search, no note; a tool_search call is no tool of Gloopy's", async () => {
  const t = await turn([say("", [call(TOOL_SEARCH, { query: "select:pay" }, "s1")]), say("ok")], { holdBack: null });
  assert.deepEqual(names(t.seen[0]), ALL);
  assert.equal(notes(t.seen[0]).length, 0);
  assert.match(t.reply("s1"), /^error: no such tool: tool_search/);
});

test("GH9 a tool Gloopy is not offered is not held back nor named (no browser on the machine: no pay)", async () => {
  const t = await turn([say("Hi.")], { tools: GLOOPY_TOOLS.filter((x) => !BROWSER_TOOL_NAMES.includes(x.function.name)) });
  assert.ok(!names(t.seen[0]).includes("pay"));
  assert.doesNotMatch(notes(t.seen[0])[0].content, /\npay\b/);
  assert.match(notes(t.seen[0])[0].content, /\nschedule\b/);
});

test("GH10 the machine gives the list with Gloopy's own jobs only, not with its helpers'", () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.equal((server.match(/holdBack: GLOOPY_HELD_BACK/g) || []).length, 1);
  assert.match(server, /tools: hasBrowser \? GLOOPY_TOOLS : GLOOPY_TOOLS\.filter\(\(x\) => !BROWSER_TOOL_NAMES\.includes\(x\.function\.name\)\), holdBack: GLOOPY_HELD_BACK,/);
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  const helperLine = agent.split("\n").find((l) => l.includes("who: \"Gloopy's helper “\""));
  assert.ok(helperLine && !helperLine.includes("holdBack"), "a helper's job has no held-back tools");
});

test("GH11 heldBackRefusal: the top level of a definition, in Claude Code's words", () => {
  assert.equal(heldBackRefusal(def("schedule"), { action: "list" }), "");
  assert.equal(heldBackRefusal(def("pay"), {}), "", "nothing required");
  assert.match(heldBackRefusal(def("schedule"), {}), /^error: InputValidationError: schedule failed due to the following issue:\nThe required parameter `action` is missing\n\nThis tool's schema was not sent to the API/);
  assert.match(heldBackRefusal(def("schedule"), "list"), /type is expected as `object` but provided as `string`/);
  assert.match(heldBackRefusal(def("schedule"), { action: "list", days: "mon" }), /The parameter `days` type is expected as `array` but provided as `string`/);
  assert.match(heldBackRefusal(def("schedule"), { action: "list", in_minutes: "5" }), /The parameter `in_minutes` type is expected as `number` but provided as `string`/);
  assert.match(heldBackRefusal(def("pay"), { result: "maybe" }), /Invalid option: expected one of \\"paid\\"\|\\"not paid\\"/);
  assert.equal(heldBackRefusal(def("schedule"), { action: "list", whatever: 1 }), "", "an input it doesn't list is left to the tool");
});
