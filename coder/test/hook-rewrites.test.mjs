// A HOOK'S REWRITES, CHECKED AS CLAUDE CODE CHECKS THEM (the owner, 2026-11-14: "Fix base on Claude Code docs, please"; Claude
// Code 2.1.325's program, where its hooks reference stops): a PostToolUse hook's updatedToolOutput against the tool's output
// shape, shown through the tool's own text (coder-zod.mjs, coder-hookcheck.mjs); a PreToolUse or PermissionRequest hook's
// updatedInput against the tool's schema and its own check, before the call runs; what the PostToolUse hooks get as the
// result (Claude Code's result objects, with no `output` or `code` beside them but a command's). The zod messages here are
// zod 4.6's own, as Claude Code's (its zod is 4.6) prints them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const Z = await import("../container/coder-zod.mjs");
const C = await import("../container/coder-hookcheck.mjs");
const H = await import("../container/coder-hooks.mjs");
const A = await import("../container/coder-agent.mjs");
const T = await import("../container/coder-tools.mjs");
const I = await import("../container/coder-inputs.mjs");
const TOOLS = join(import.meta.dirname, "../container/coder-tools.mjs");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const zj = (issues) => JSON.stringify(issues, null, 2);
const TAIL = "The tool input from the model was valid; the hook's rewrite of it was not.";
const post = (json) => ({ hook: { type: "command", command: "x" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PostToolUse", ...json } } } });

async function loop(steps, hooks, { tools = {}, hookRun = () => ({}), ask = async () => ({ choice: "yes" }), mode = "auto", execRun = null, rules = null, mcp = null, connectors = null, deps: more = {} } = {}) {
  const events = [], hookCalls = [], requests = [], ran = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push(input);
        const a = (await hookRun(input, x)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        requests.push(req);
        const f = tools[req.tool];
        if (!f) return { code: 0, output: "" };
        const out = await f(req.args, x);
        return typeof out === "string" ? { code: 0, output: out } : out;
      }
      ran.push(x.command);
      return execRun ? execRun(x) : { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-hr", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask, ...(mcp ? { mcp } : {}), ...more,
  }, { text: "go", mode, messages: [], hooks: H.hooksFrom({ hooks }, "settings").list, ...(rules ? { rules } : {}), ...(connectors ? { connectors } : {}) });
  const answer = (id) => (r.messages.find((m) => m.tool_call_id === id) || {}).content;
  return { r, events, hookCalls, requests, ran, answer };
}
const hookOut = (json) => ({ stdout: JSON.stringify(json) });

test("HR1 zod's issues and message as Claude Code's zod 4.6 gives them, and Claude Code's words for them (its w0): the missing, unexpected and wrongly typed parameters; zod's own list when only values are wrong", () => {
  const { z, opt } = Z;
  const s = z.object({ pattern: z.string(), output_mode: opt(z.enum(["content", "files_with_matches", "count"])), head_limit: opt(z.number()) }, "strict");
  assert.deepEqual(Z.zodIssues(s, { pattern: "x" }), []);
  const bad = Z.zodIssues(s, { pattern: "x", output_mode: "lines" });
  assert.equal(Z.zodMessage(bad), '[\n  {\n    "code": "invalid_value",\n    "values": [\n      "content",\n      "files_with_matches",\n      "count"\n    ],\n    "path": [\n      "output_mode"\n    ],\n    "message": "Invalid option: expected one of \\"content\\"|\\"files_with_matches\\"|\\"count\\""\n  }\n]');
  assert.equal(Z.failedText("Grep", bad), Z.zodMessage(bad), "only a value wrong: zod's own list");
  const mixed = Z.zodIssues(s, { output_mode: "lines", head_limit: "5", extra: 1 });
  assert.deepEqual(mixed.map((x) => x.code), ["invalid_type", "invalid_value", "invalid_type", "unrecognized_keys"]);
  assert.equal(Z.failedText("Grep", mixed), "Grep failed due to the following issues:\nThe required parameter `pattern` is missing\nAn unexpected parameter `extra` was provided\nThe parameter `head_limit` type is expected as `number` but provided as `string`\nThe parameter `output_mode` is invalid: Invalid option: expected one of \"content\"|\"files_with_matches\"|\"count\"");
  // Each kind, as zod 4.6 writes it (its key order, its words).
  assert.deepEqual(Z.zodIssues(z.object({ n: z.number({ int: true, gte: 0 }) }), { n: 1.5 }), [{ expected: "int", format: "safeint", code: "invalid_type", path: ["n"], message: "Invalid input: expected int, received number" }]);
  assert.deepEqual(Z.zodIssues(z.object({ n: z.number({ int: true, gte: 0 }) }), { n: -1 }), [{ origin: "number", code: "too_small", minimum: 0, inclusive: true, path: ["n"], message: "Too small: expected number to be >=0" }]);
  assert.deepEqual(Z.zodIssues(z.array(z.string(), { min: 2 }), [3]), [{ expected: "string", code: "invalid_type", path: [0], message: "Invalid input: expected string, received number" }, { origin: "array", code: "too_small", minimum: 2, inclusive: true, path: [], message: "Too small: expected array to have >=2 items" }]);
  assert.deepEqual(Z.zodIssues(z.object({ a: z.record(z.string()) }), { a: [] }), [{ expected: "record", code: "invalid_type", path: ["a"], message: "Invalid input: expected record, received array" }]);
  // (zod 4 runs a size check on whatever has a length, a wrong type too.)
  assert.deepEqual(Z.zodIssues(z.string({ min: 2 }), ["a"]), [{ expected: "string", code: "invalid_type", path: [], message: "Invalid input: expected string, received array" }, { origin: "array", code: "too_small", minimum: 2, inclusive: true, path: [], message: "Too small: expected array to have >=2 items" }]);
  assert.deepEqual(Z.zodIssues(z.array(z.string(), { max: 1 }), "xyz").map((x) => x.message), ["Invalid input: expected array, received string", "Too big: expected string to have <=1 characters"]);
  assert.deepEqual(Z.zodIssues(z.array(z.string(), { min: 2 }), { length: 1 }).map((x) => x.message), ["Invalid input: expected array, received object", "Too small: expected unknown to be >=2"]);
  const disc = z.disc("type", [z.object({ type: z.literal("text") }), z.object({ type: z.literal("image") })]);
  assert.deepEqual(Z.zodIssues(disc, "x"), [{ code: "invalid_type", expected: "object", path: [], message: "Invalid input: expected object, received string" }]);
  assert.deepEqual(Z.zodIssues(disc, { type: "pdf" }), [{ code: "invalid_union", errors: [], note: "No matching discriminator", discriminator: "type", options: ["text", "image"], path: ["type"], message: "Invalid discriminator value. Expected 'text' | 'image'" }]);
  assert.deepEqual(Z.zodIssues(z.union([z.object({ a: z.string() }), z.string()]), { a: 1 }), [{ code: "invalid_union", errors: [[{ expected: "string", code: "invalid_type", path: ["a"], message: "Invalid input: expected string, received number" }], [{ expected: "string", code: "invalid_type", path: [], message: "Invalid input: expected string, received object" }]], path: [], message: "Invalid input" }]);
  assert.equal(Z.failedText("X", [{ code: "invalid_union", errors: [], path: ["a"], message: "Invalid input" }, { expected: "string", code: "invalid_type", path: ["b"], message: "Invalid input: expected string, received undefined" }]), "X failed due to the following issues:\nThe required parameter `b` is missing\nThe parameter `a` matches none of the accepted forms");
  // At most 20 of the others, then how many more; a long message cut at 500 characters.
  const many = Array.from({ length: 22 }, (_, k) => ({ origin: "string", code: "too_small", minimum: 2, inclusive: true, path: ["s" + k], message: "Too small" }));
  const t = Z.failedText("X", [{ expected: "string", code: "invalid_type", path: ["q"], message: "Invalid input: expected string, received undefined" }, ...many]).split("\n");
  assert.deepEqual([t.length, t.at(-1)], [23, "(2 more issues not listed)"]);
  assert.match(Z.failedText("X", [{ expected: "string", code: "invalid_type", path: ["q"], message: "Invalid input: expected string, received undefined" }, { code: "custom", path: ["v"], message: "y".repeat(600) }]), /The parameter `v` is invalid: y{500}… \[\+100 chars\]$/);
  assert.equal(Z.pathText(["questions", 0, "options"]), "questions[0].options");
});

test("HR2 a PostToolUse hook's updatedToolOutput as Claude Code takes it: the last hook's value checked once all have run, against the tool's output shape (zod's message in its notice, the original kept); a match through the tool's own text; a connector's (MCP) passed on as it is, its updatedMCPToolOutput too; a note for the checker goes with its own hook's rewrite", () => {
  const bash = H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { stdout: "\n\nclean\n", stderr: "warn ", interrupted: true } })], { tool: "Bash" });
  assert.equal(bash.updatedOutput, "clean\nwarn\n<error>Command was aborted before completion</error>", "stdout, then stderr and Claude Code's line for an aborted command");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { stdout: "", stderr: "", interrupted: false } })], { tool: "Bash" }).updatedOutput, "(Bash completed with no output)", "no text: Claude Code's words");
  const wrong = H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { stdout: 1 } })], { tool: "Bash" });
  assert.equal(wrong.updatedOutput, undefined);
  assert.equal(wrong.notices[0], "PostToolUse hook returned updatedToolOutput that does not match Bash's output shape; using original output. " + zj([
    { expected: "string", code: "invalid_type", path: ["stdout"], message: "Invalid input: expected string, received number" },
    { expected: "string", code: "invalid_type", path: ["stderr"], message: "Invalid input: expected string, received undefined" },
    { expected: "boolean", code: "invalid_type", path: ["interrupted"], message: "Invalid input: expected boolean, received undefined" },
  ]));
  // Two hooks: the last one's value is the one checked; refused, the original output stays (not the first hook's).
  const two = H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { stdout: "first", stderr: "", interrupted: false } }), post({ updatedToolOutput: "second" })], { tool: "Bash" });
  assert.deepEqual([two.updatedOutput, two.notices.length], [undefined, 1]);
  // A checker's note: kept with its own rewrite when used; dropped (and said so) when its rewrite is refused; one with no
  // rewrite always kept.
  const noted = (rw, note) => post({ ...(rw !== undefined ? { updatedToolOutput: rw } : {}), ...(note ? { classifierContext: note } : {}) });
  assert.equal(H.hooksOutcome("PostToolUse", [noted({ stdout: "x", stderr: "", interrupted: false }, "mine")], { tool: "Bash" }).classifierContext, "mine");
  const dropped = H.hooksOutcome("PostToolUse", [noted("bad", "mine"), noted(undefined, "plain")], { tool: "Bash" });
  assert.equal(dropped.classifierContext, "plain");
  assert.match(dropped.notices[0], /^PostToolUse hook returned updatedToolOutput that does not match Bash's output shape; using original output\. A host-asserted classifier context attached by the same hook was discarded with the rejected rewrite\. \[/);
  // Tools Coder's hooks code shows by itself: LSP's and WebFetch's result; TaskStop's JSON.
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { operation: "hover", result: "def f()", filePath: "a.py" } })], { tool: "LSP" }).updatedOutput, "def f()");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { bytes: 1, code: 200, codeText: "OK", result: "[page]", durationMs: 1, url: "https://a.example/" } })], { tool: "WebFetch" }).updatedOutput, "[page]");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { message: "Successfully stopped task: job1 (x)", task_id: "job1", task_type: "local_bash" } })], { tool: "TaskStop" }).updatedOutput, '{"message":"Successfully stopped task: job1 (x)","task_id":"job1","task_type":"local_bash"}');
  // A connector's: no shape; its text, its text blocks, or its JSON; updatedMCPToolOutput after updatedToolOutput, and only
  // for a connector's tool.
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: [{ type: "text", text: "a" }, { type: "text", text: "b" }] })], { tool: "mcp__notes__find" }).updatedOutput, "a\nb");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: { rows: 2 } })], { tool: "mcp__notes__find" }).updatedOutput, '{"rows":2}');
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: "x", updatedMCPToolOutput: "mcp" })], { tool: "mcp__notes__find" }).updatedOutput, "mcp");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedMCPToolOutput: "mcp" })], { tool: "Grep" }).updatedOutput, undefined, "not a connector's: ignored");
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: "" })], { tool: "mcp__notes__find" }).updatedOutput, "(mcp__notes__find completed with no output)");
  // Coder's own tools (no Claude Code tool of their kind): as a connector's.
  assert.equal(H.hooksOutcome("PostToolUse", [post({ updatedToolOutput: "reviewed" })], { tool: "review" }).updatedOutput, "reviewed");
});

test("HR3 each tool's own text for a hook's result object, as Coder prints it (Claude Code's tool by tool): Read's lines, Write's and Edit's words, Grep, Glob, WebSearch, Monitor, AskUserQuestion, ExitPlanMode and the task tools; a Read picture shown to Grok; what Coder never makes, refused with Claude Code's mapper words; a part of the result Coder gave, given back unchanged, is not checked again", () => {
  const rw = (tool, v, given = null) => C.outputRewrite(tool, { shownPath: (p) => p.replace("/work/shop/", ""), monitorText: A.monitorStarted }, given)(v);
  assert.deepEqual(rw("Read", { type: "text", file: { filePath: "/work/shop/a.js", content: "one\ntwo", numLines: 2, startLine: 4, totalLines: 9 } }), { text: "     4\tone\n     5\ttwo" });
  assert.deepEqual(rw("Read", { type: "text", file: { filePath: "/work/shop/a.js", content: "", numLines: 0, startLine: 1, totalLines: 0 } }), { text: "a.js exists, but it is empty." });
  assert.deepEqual(rw("Read", { type: "text", file: { filePath: "/work/shop/a.js", content: "", numLines: 0, startLine: 12, totalLines: 3 } }), { text: "a.js has 3 lines: offset 12 is past its end." });
  assert.deepEqual(rw("Read", { type: "image", file: { base64: "iVBORw0KGgo=", type: "image/png", originalSize: 8 } }), { text: "", pics: [{ type: "image/png", data: "iVBORw0KGgo=" }] });
  assert.equal(rw("Read", { type: "notebook", file: { filePath: "/work/shop/n.ipynb", cells: [] } }).notice, "PostToolUse hook returned updatedToolOutput that does not match Read's output shape; using original output. mapper returned undefined");
  assert.deepEqual(rw("Write", { type: "create", filePath: "/work/shop/n.txt", content: "x", structuredPatch: [], originalFile: null }), { text: "File created successfully at: n.txt" + T.WRITE_FRESH });
  assert.deepEqual(rw("Write", { type: "update", filePath: "/work/shop/n.txt", content: "x", structuredPatch: [], originalFile: "y", userModified: true }), { text: "The file n.txt has been updated successfully. The owner modified your proposed content before accepting it." });
  const edit = { filePath: "/work/shop/a.js", oldString: "a", newString: "b", originalFile: "a", structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-a", "+b"] }], userModified: false, replaceAll: false };
  assert.deepEqual(rw("Edit", edit), { text: "The file a.js has been updated successfully." + T.WRITE_FRESH });
  assert.deepEqual(rw("Edit", { ...edit, replaceAll: true }), { text: "The file a.js has been updated. All occurrences were successfully replaced." + T.WRITE_FRESH });
  assert.equal(rw("Edit", { ...edit, structuredPatch: [{ lines: ["-a"] }] }).notice.split("\n")[0], "PostToolUse hook returned updatedToolOutput that does not match Edit's output shape; using original output. [");
  assert.deepEqual(rw("Grep", { mode: "content", numFiles: 1, filenames: [], content: "a.js:2:TODO", numLines: 1 }), { text: "a.js:2:TODO" });
  assert.deepEqual(rw("Grep", { numFiles: 2, filenames: ["a.js", "b.js"] }), { text: "Found 2 files\na.js\nb.js" }, "no mode: files_with_matches, as Claude Code's");
  assert.deepEqual(rw("Glob", { durationMs: 1, numFiles: 0, filenames: [], truncated: false }), { text: "No files found" });
  assert.match(rw("WebSearch", { query: "q", results: ["No results."], durationSeconds: 1 }).text, /^Web search results for query: "q"\n\nNo results\./);
  assert.equal(rw("Monitor", { taskId: "job3", timeoutMs: 300000 }).text, A.monitorStarted("job3", 300000));
  assert.match(rw("Monitor", { taskId: "job3", timeoutMs: 0, persistent: true }).text, /^Monitor started \(task job3, persistent — runs until stop_job or chat end\)\. You will be notified on each event\./);
  const q = { question: "Which DB?", header: "DB", options: [{ label: "Postgres" }, { label: "SQLite" }], multiSelect: false };
  assert.deepEqual(rw("AskUserQuestion", { questions: [q], answers: { "Which DB?": "SQLite" } }), { text: 'Your questions have been answered: "Which DB?"="SQLite". You can now continue with these answers in mind.' });
  assert.match(rw("ExitPlanMode", { plan: "Do it.", isAgent: false, filePath: "/plans/p.md" }).text, /^The owner has approved your plan\. You can now start coding\.[\s\S]*Your plan has been saved to: \/plans\/p\.md[\s\S]*## Approved Plan:\nDo it\.$/);
  assert.equal(rw("ExitPlanMode", { plan: null, isAgent: false }).text, "The owner has approved exiting plan mode. You can now proceed.");
  assert.equal(rw("TaskCreate", { task: { id: "1", subject: "Add tests" } }).text, "Task #1 created successfully: Add tests");
  assert.equal(rw("TaskGet", { task: null }).text, "Task not found");
  assert.equal(rw("TaskList", { tasks: [{ id: "1", subject: "A", status: "pending", blockedBy: ["2"] }] }).text, "#1 [pending] A [blocked by #2]");
  assert.equal(rw("TaskUpdate", { success: true, taskId: "1", updatedFields: ["status"] }).text, "Updated task #1 status");
  // A command's own bashEditDiff (its hunks without Claude Code's line numbers) given back unchanged: not checked again.
  const given = { output: "out", code: 0, stdout: "out", stderr: "", interrupted: false, isImage: false, bashEditDiff: { changedFiles: ["/w/a"], files: [{ filePath: "/w/a", hunks: [{ lines: ["+x"] }] }], moreFiles: 0 } };
  assert.deepEqual(rw("Bash", { ...given, stdout: "[redacted]" }, given), { text: "[redacted]" });
  assert.ok(rw("Bash", { ...given, stdout: "[redacted]", bashEditDiff: { files: [{ hunks: [{}] }] } }, given).notice, "a changed one is checked");
});

test("HR4 in Coder's loop: a hook's new output becomes the tool's answer through the tool's own text (Grep's, with its fix's note after it), a picture shown instead of the old one; one of the wrong shape leaves the answer as it was and the chat says why; read, write and edit give their hooks Claude Code's result objects, every tool but a command without `output` or `code`, a monitor Monitor's own", async () => {
  const hooks = { PostToolUse: [{ matcher: "Grep|Read|Write|Edit|Bash|Monitor|mcp__notes__find", hooks: [{ type: "command", command: "post.sh" }] }] };
  const grepFacts = { mode: "files_with_matches", filenames: ["a.js", "secret.js"], numFiles: 2 };
  const t = await loop([say("", [call("grep", { pattern: "TODO", file_path: "." }, "g1"), call("read", { path: "a.js" }, "r1"), call("bash", { command: "ls" }, "b1"), call("monitor", { command: "tail -f log", description: "log", timeout_ms: 60000 }, "m1")]), say("done")], hooks, {
    tools: {
      grep: () => T.printedAnswer({ text: "Found 2 files\na.js\nsecret.js", facts: grepFacts }),
      read: (a) => T.printedAnswer({ text: "     1\tTODO", facts: a.facts === true ? { type: "text", file: { filePath: "/work/shop/a.js", content: "TODO", numLines: 1, startLine: 1, totalLines: 1 } } : null }),
    },
    execRun: (x) => (/tail -f/.test(x.command) ? { code: -1, background: true, pid: 7, log: "/srv/m.log", jobId: "job1", output: "" } : { code: 0, output: "a.js\n" }),
    hookRun: (input) => {
      if (input.tool_name === "Grep") return hookOut({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { ...input.tool_response, filenames: ["a.js"], numFiles: 1 } } });
      if (input.tool_name === "Read") return hookOut({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: "a plain string" } });
      return {};
    },
  });
  assert.equal(t.answer("g1"), "Found 1 file\na.js\n\nNote: Grep's parameter for where to search is named `path`. `file_path` was read as `path`.");
  assert.equal(t.answer("r1"), "     1\tTODO", "the wrong shape: the answer stays");
  const note = t.events.find((e) => e.type === "note" && /does not match Read's output shape/.test(e.text));
  assert.ok(note && note.hook === "PostToolUse");
  assert.equal(t.requests.find((q) => q.tool === "read").args.facts, true, "read is asked for its result object");
  const resp = (id) => t.hookCalls.find((h) => h.hook_event_name === "PostToolUse" && h.tool_use_id === id).tool_response;
  assert.deepEqual(resp("g1"), grepFacts);
  assert.deepEqual(resp("r1"), { type: "text", file: { filePath: "/work/shop/a.js", content: "TODO", numLines: 1, startLine: 1, totalLines: 1 } });
  assert.deepEqual([resp("b1").stdout, resp("b1").output, resp("b1").code], ["a.js", "a.js", 0], "a command's keeps Coder's output and exit code");
  assert.deepEqual(resp("m1"), { taskId: "job1", timeoutMs: 60000 });
  // stop_job's: Claude Code's TaskStop object, and a hook's new one shown as its JSON.
  const st = await loop([say("", [call("bash", { command: "npm run dev", run_in_background: true }, "b2")]), say("", [call("stop_job", { job: "job1" }, "s1")]), say("done")], { PostToolUse: [{ matcher: "TaskStop", hooks: [{ type: "command", command: "post.sh" }] }] }, {
    execRun: () => ({ code: -1, background: true, pid: 9, log: "/srv/bg.log", jobId: "job1", output: "" }),
    deps: { bg: { alive: async () => true, stop: async () => true } },
    hookRun: (input) => hookOut({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { ...input.tool_response, message: "stopped (said by a hook)" } } }),
  });
  const sp = st.hookCalls.find((h) => h.hook_event_name === "PostToolUse" && h.tool_use_id === "s1");
  assert.deepEqual(sp.tool_response, { message: "Successfully stopped task: job1 (npm run dev)", task_id: "job1", task_type: "local_bash", command: "npm run dev" });
  assert.equal(st.answer("s1"), JSON.stringify({ message: "stopped (said by a hook)", task_id: "job1", task_type: "local_bash", command: "npm run dev" }));
  // A connector's answer as text (an MCP tool's, as Claude Code passes it on), without Coder's line before it; a hook's string
  // in its place, Coder's line kept before it.
  const m = await loop([say("", [call("mcp__notes__find", { q: "x" }, "c1")]), say("done")], hooks, {
    connectors: [{ name: "mcp__notes__find", label: "Notes: find", description: "From the Notes connector (MCP). Find notes", parameters: { type: "object", properties: { q: { type: "string" } } }, readOnly: true, perm: "allow" }],
    mcp: async () => ({ text: "note 1", isError: false }),
    hookRun: (input) => (input.hook_event_name === "PostToolUse" ? hookOut({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: "[filtered]" } }) : {}),
  });
  assert.equal(m.hookCalls.find((h) => h.hook_event_name === "PostToolUse").tool_response, "note 1");
  assert.equal(m.answer("c1"), A.CONNECTOR_DATA + "[filtered]");
});

test("HR5 a hook's new input checked as Claude Code checks it (its GJe): the schema, in its words (zod's own list when only a value is wrong); the keys the tool does not know dropped; the tool's own check (\"refused\"); a check that throws; Claude Code's names in the words (file_path); numbers and booleans written as text taken; a connector's tool takes any input", () => {
  const grepDef = A.CODER_TOOLS.find((t) => t.function.name === "grep").function.parameters;
  const chk = (input, event = "PreToolUse") => C.checkHookInput({ name: "grep", tool: "Grep", input, event, params: grepDef, check: I.inputCheckFor("grep") });
  assert.deepEqual(chk({ pattern: "TODO", path: "src", stray: 1, file_path: "x" }), { ok: true, args: { pattern: "TODO", path: "src" } }, "unknown keys dropped (file_path is not Grep's: no fix here)");
  assert.deepEqual(chk({ pattern: "TODO", head_limit: "5", multiline: "true" }).args, { pattern: "TODO", head_limit: 5, multiline: true });
  assert.equal(chk({ pattern: "TODO", output_mode: "lines" }).message, "PreToolUse hook for Grep returned updatedInput that failed schema validation: " + zj([{ code: "invalid_value", values: ["content", "files_with_matches", "count"], path: ["output_mode"], message: 'Invalid option: expected one of "content"|"files_with_matches"|"count"' }]) + "\n" + TAIL);
  assert.equal(chk({ path: "src" }, "PermissionRequest").message, "PermissionRequest hook for Grep returned updatedInput that failed schema validation: Grep failed due to the following issue:\nThe required parameter `pattern` is missing\n" + TAIL);
  assert.equal(chk({ pattern: "a\u0000b" }).message, "PreToolUse hook for Grep returned updatedInput that the tool refused: Grep pattern cannot contain null bytes (\\0). Remove the null byte and try again.\n" + TAIL);
  assert.equal(C.checkHookInput({ name: "grep", tool: "Grep", input: { pattern: "x" }, params: grepDef, check: () => { throw new Error("boom"); } }).message, "PreToolUse hook for Grep returned updatedInput that the tool could not check: boom\nThe tool input from the model was valid.");
  const readDef = A.CODER_TOOLS.find((t) => t.function.name === "read").function.parameters;
  assert.equal(C.checkHookInput({ name: "read", tool: "Read", input: { file_path: 5, path: "a.js" }, params: readDef }).message, "PreToolUse hook for Read returned updatedInput that failed schema validation: Read failed due to the following issue:\nThe parameter `file_path` type is expected as `string` but provided as `number`\n" + TAIL);
  assert.deepEqual(C.checkHookInput({ name: "read", tool: "Read", input: { file_path: "b.js", path: "a.js", offset: "3" }, params: readDef }), { ok: true, args: { path: "b.js", offset: 3 } });
  assert.deepEqual(C.checkHookInput({ name: "mcp__notes__find", tool: "mcp__notes__find", input: { anything: [1] }, params: null }), { ok: true, args: { anything: [1] } });
  assert.equal(C.sameInput({}, { a: 1 }), true);
  assert.equal(C.sameInput({ b: [1, { c: 2 }], a: 1 }, { a: 1, b: [1, { c: 2 }] }), true);
  assert.equal(C.sameInput({ a: 2 }, { a: 1 }), false);
});

test("HR6 in Coder's loop: a PreToolUse hook's new input refused before the call runs (the step blocked, Coder told Claude Code's words), one with keys the tool does not know run without them, a command's own check applied to it; a PermissionRequest hook's refused as its no, and one equal to the input shown changes nothing; \"defer\" brings no new input", async () => {
  const pre = (u, extra = {}) => hookOut({ hookSpecificOutput: { hookEventName: "PreToolUse", ...extra, updatedInput: u } });
  let t = await loop([say("", [call("grep", { pattern: "TODO" }, "g1"), call("grep", { pattern: "x" }, "g2"), call("bash", { command: "ls" }, "b1")]), say("done")], { PreToolUse: [{ matcher: "Grep|Bash", hooks: [{ type: "command", command: "pre.sh" }] }] }, {
    tools: { grep: (a) => "searched " + JSON.stringify(a) },
    hookRun: (input) => input.tool_name === "Bash" ? pre({ command: "sleep 30" }) : input.tool_input.pattern === "TODO" ? pre({ pattern: "TODO", output_mode: "lines" }) : pre({ pattern: "y", sneaky: true }),
  });
  assert.match(t.answer("g1"), /^PreToolUse hook for Grep returned updatedInput that failed schema validation: \[\n/);
  assert.ok(t.answer("g1").endsWith("\n" + TAIL));
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "g1").hookBlocked, true);
  assert.equal(t.answer("g2"), 'searched {"pattern":"y"}', "the unknown key dropped, the call run with the rest");
  assert.equal(t.answer("b1"), "PreToolUse hook for Bash returned updatedInput that the tool refused: " + A.sleepBlockFor("sleep 30") + "\n" + TAIL);
  assert.deepEqual(t.ran.filter((c) => /sleep|ls/.test(c)), [], "neither command ran");
  // "defer": its updatedInput ignored, as Claude Code ignores it.
  t = await loop([say("", [call("grep", { pattern: "TODO" }, "g3")]), say("done")], { PreToolUse: [{ matcher: "Grep", hooks: [{ type: "command", command: "pre.sh" }] }] }, {
    tools: { grep: (a) => "searched " + a.pattern }, hookRun: () => pre({ pattern: "other" }, { permissionDecision: "defer" }),
  });
  assert.equal(t.answer("g3"), "searched TODO");
  // A PermissionRequest hook's: refused as its no (Coder goes on with its words); the same as shown: no rerun with it.
  const permHooks = { PermissionRequest: [{ matcher: "Write", hooks: [{ type: "command", command: "perm.sh" }] }] };
  const allow = (u) => hookOut({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: u } } });
  t = await loop([say("", [call("write", { path: "a.txt", content: "x" }, "w1")]), say("done")], permHooks, {
    mode: "plan", tools: { write: () => "written" }, hookRun: (input) => (input.hook_event_name === "PermissionRequest" ? allow({ file_path: "a.txt", content: 7 }) : {}),
  });
  assert.equal(t.answer("w1"), "PermissionRequest hook for Write returned updatedInput that failed schema validation: Write failed due to the following issue:\nThe parameter `content` type is expected as `string` but provided as `number`\n" + TAIL);
  assert.equal(t.requests.filter((q) => q.tool === "write").length, 0, "not written");
  t = await loop([say("", [call("write", { path: "a.txt", content: "x" }, "w2")]), say("done")], permHooks, {
    mode: "plan", tools: { write: (a) => "written " + a.content }, hookRun: (input) => (input.hook_event_name === "PermissionRequest" ? allow(input.tool_input) : {}),
  });
  assert.equal(t.requests.filter((q) => q.tool === "write").length, 1);
  assert.match(t.answer("w2"), /^written x/);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "A PermissionRequest hook allowed this."), "the same input: no change");
});

test("HR7 read, write and edit build Claude Code's result objects when Coder's loop asks (`facts`): Read's text object (the lines without numbers), Write's (create or update, the diff's hunks, the text it had), Edit's (old and new strings, replace_all); none when not asked", () => {
  const d = mkdtempSync(join(tmpdir(), "hr7-"));
  try {
    writeFileSync(join(d, "a.txt"), "one\ntwo\nthree\n");
    const run = (tool, args) => execFileSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool, args })).toString("base64")], { cwd: d, env: { ...process.env, CODER_ROOT: d, CODER_CWD: d }, encoding: "utf8" });
    const r = A.factsAnswer(run("read", { path: "a.txt", offset: 2, limit: 1, facts: true }));
    assert.deepEqual(r.facts, { type: "text", file: { filePath: join(d, "a.txt"), content: "two", numLines: 1, startLine: 2, totalLines: 3 } });
    assert.match(r.text, /^     2\ttwo/);
    assert.equal(A.factsAnswer(run("read", { path: "a.txt" })).facts, null, "not asked: none");
    const w = A.factsAnswer(run("write", { path: "a.txt", content: "one\nTWO\nthree\n", facts: true }));
    assert.deepEqual(w.facts, { type: "update", filePath: join(d, "a.txt"), content: "one\nTWO\nthree\n", structuredPatch: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [" one", "-two", "+TWO", " three"] }], originalFile: "one\ntwo\nthree\n" });
    assert.equal(w.text.startsWith("The file a.txt has been updated successfully."), true);
    assert.doesNotMatch(w.text, /`facts` was ignored/);
    const n = A.factsAnswer(run("write", { path: "b.txt", content: "new\n", facts: true }));
    assert.deepEqual(n.facts, { type: "create", filePath: join(d, "b.txt"), content: "new\n", structuredPatch: [], originalFile: null });
    run("read", { path: "a.txt" });
    const e = A.factsAnswer(run("edit", { path: "a.txt", old_string: "TWO", new_string: "2", facts: true }));
    assert.deepEqual(e.facts, { filePath: join(d, "a.txt"), oldString: "TWO", newString: "2", originalFile: "one\nTWO\nthree\n", structuredPatch: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [" one", "-TWO", "+2", " three"] }], userModified: false, replaceAll: false });
    assert.deepEqual(T.hunksOf(["@@ -2 +2,2 @@", "-a", "+b", "+c", "\\ No newline at end of file"]), [{ oldStart: 2, oldLines: 1, newStart: 2, newLines: 2, lines: ["-a", "+b", "+c", "\\ No newline at end of file"] }]);
    // Each one's object passes its own output shape.
    for (const [tool, f] of [["Read", r.facts], ["Write", w.facts], ["Write", n.facts], ["Edit", e.facts]]) assert.deepEqual(Z.zodIssues(Z.OUTPUT_SHAPES[tool], f), [], tool);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("HR8 the machine's copy holds the new modules, and the Worker's part loads none of Node's", () => {
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  for (const f of ["coder-zod.mjs", "coder-hookcheck.mjs"]) assert.ok(copy.includes(" " + f + " "), f);
  assert.doesNotMatch(readFileSync(new URL("../container/coder-zod.mjs", import.meta.url), "utf8"), /from "node:|^import /m);
});
