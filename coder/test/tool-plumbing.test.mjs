// THE SHARED PLUMBING FOR CLAUDE CODE'S GREP, GLOB, LSP, WEBFETCH AND WEBSEARCH (the owner, 2026-11-14: "start fixing and
// filling in gaps on those tools"): each tool's input check runs before any hook (coder-inputs.mjs), its fix is told with
// the answer as Claude Code's "Note: …", and a tool's result object reaches its PostToolUse hooks (FACTS_MARK).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const H = await import("../container/coder-hooks.mjs");
const T = await import("../container/coder-tools.mjs");
const A = await import("../container/coder-agent.mjs");
const I = await import("../container/coder-inputs.mjs");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

async function loop(steps, hooks, { tools = {}, hookRun = () => ({}), mode = "auto" } = {}) {
  const events = [], seen = [], hookCalls = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, x });
        const a = (await hookRun(input, x)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        const f = tools[req.tool];
        if (!f) return { code: 0, output: "" };
        const out = await f(req.args, x);
        return typeof out === "string" ? { code: 0, output: out } : out;
      }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-tp", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode, messages: [], hooks: H.hooksFrom({ hooks }, "settings").list });
  return { r, events, seen, hookCalls };
}

test("TP1 a tool's result object travels behind FACTS_MARK: printed first as one line of JSON, taken off before Grok sees the answer", () => {
  assert.equal(T.printedAnswer("plain"), "plain");
  assert.equal(T.printedAnswer({ text: "Found 1 file\na.js" }), "Found 1 file\na.js");
  const printed = T.printedAnswer({ text: "Found 1 file\na.js", facts: { mode: "files_with_matches", numFiles: 1, filenames: ["a.js"] } });
  assert.equal(printed, T.FACTS_MARK + '{"mode":"files_with_matches","numFiles":1,"filenames":["a.js"]}\nFound 1 file\na.js');
  assert.deepEqual(A.factsAnswer(printed), { text: "Found 1 file\na.js", facts: { mode: "files_with_matches", numFiles: 1, filenames: ["a.js"] } });
  assert.deepEqual(A.factsAnswer("no mark"), { text: "no mark", facts: null });
  assert.deepEqual(A.factsAnswer(T.FACTS_MARK + "not json\ntext"), { text: "text", facts: null }, "a broken line is dropped, the text kept");
  assert.deepEqual(A.factsAnswer(T.FACTS_MARK + "[1,2]\ntext"), { text: "text", facts: null }, "only an object");
  // The machine's copy holds the new modules (CD78 checks every import).
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  for (const f of ["coder-inputs.mjs", "coder-search.mjs", "coder-webfetch.mjs", "coder-websearch.mjs"]) assert.ok(copy.includes(" " + f + " "), f);
  // (Not Claude Code's environment tools since 2026-11-14: theirs are checked after the PreToolUse hooks, test/env-tools.test.mjs.)
  assert.deepEqual(Object.keys(I.INPUT_CHECKS).sort(), ["ask_user", "glob", "grep", "lsp", "web_fetch", "web_search"]);
  assert.equal(I.inputCheckFor("read"), null);
  assert.equal(I.inputCheckFor("toString"), null);
});

test("TP2 an input check runs before any hook: a refusal fires no PreToolUse hook and runs nothing; a fix is used, its note told after the answer", async () => {
  const keep = I.INPUT_CHECKS.grep;
  const searched = [];
  try {
    I.INPUT_CHECKS.grep = (a) => (a.pattern.includes("\u0000") ? { error: "Grep pattern cannot contain null bytes (\\0). Remove the null byte and try again." } : a.file_path ? { args: { pattern: a.pattern, path: a.file_path }, note: "Note: Grep's parameter for where to search is named `path`. `file_path` was read as `path`." } : { args: a });
    const hooks = { PreToolUse: [{ matcher: "Grep", hooks: [{ type: "command", command: "pre.sh" }] }] };
    let t = await loop([say("", [call("grep", { pattern: "a\u0000b" }, "g1")]), say("done")], hooks, { tools: { grep: (a) => { searched.push(a); return "x"; } } });
    assert.equal(t.hookCalls.length, 0, "no PreToolUse hook");
    assert.equal(searched.length, 0, "nothing ran");
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "g1").content, "Grep pattern cannot contain null bytes (\\0). Remove the null byte and try again.");
    const res = t.events.find((e) => e.type === "result" && e.id === "g1");
    assert.deepEqual([res.code, res.ran], [-1, false]);
    assert.equal(t.events.find((e) => e.type === "bash" && e.id === "g1").verb, "Searched");
    t = await loop([say("", [call("grep", { pattern: "TODO", file_path: "src" }, "g2")]), say("done")], hooks, { tools: { grep: (a) => { searched.push(a); return "Found 1 file\nsrc/a.js"; } } });
    assert.equal(searched.at(-1).path, "src");
    assert.equal(t.hookCalls[0].input.tool_input.path, "src", "the hook sees the fixed input");
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "g2").content, "Found 1 file\nsrc/a.js\n\nNote: Grep's parameter for where to search is named `path`. `file_path` was read as `path`.");
  } finally { I.INPUT_CHECKS.grep = keep; }
});

test("TP3 a tool's result object reaches its PostToolUse hooks with the call's output; Grok gets the text alone", async () => {
  const facts = { mode: "files_with_matches", numFiles: 2, filenames: ["a.js", "b.js"] };
  const t = await loop([say("", [call("grep", { pattern: "TODO" }, "g1")]), say("done")], { PostToolUse: [{ matcher: "Grep", hooks: [{ type: "command", command: "post.sh" }] }] }, {
    tools: { grep: () => T.printedAnswer({ text: "Found 2 files\na.js\nb.js", facts }) },
  });
  const post = t.hookCalls.find((x) => x.input.hook_event_name === "PostToolUse").input;
  assert.deepEqual(post.tool_response, { output: "Found 2 files\na.js\nb.js", code: 0, ...facts });
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "g1").content, "Found 2 files\na.js\nb.js");
  assert.ok(!JSON.stringify(t.events).includes("coder-facts"), "never in the chat");
});
