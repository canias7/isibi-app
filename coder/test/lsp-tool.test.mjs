// CLAUDE CODE'S LSP TOOL IN CODER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; LSP stays and
// becomes Claude Code's computer (plugin) version, for Coder's two servers): its description, inputs and input check, its
// requests and result texts, gitignored results left out, its errors, its servers kept running by a keeper on the chat's
// machine (60-second requests, restarts after a crash, 50 open files), and its diagnostics after writes and edits.
// The language servers are stood in for (test/fixtures/fake-lsp): the real ones may not be installed where the tests run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile, chmod, rm, truncate } from "node:fs/promises";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const L = await import("../container/coder-lsp.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const T = await import("../container/coder-tools.mjs");
const I = await import("../container/coder-inputs.mjs");
const permsMod = await import("../container/coder-perms.mjs");
const FAKE = new URL("./fixtures/fake-lsp/", import.meta.url).pathname;
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** A project folder with files, and the stand-in servers' script and log in a folder of their own. */
async function project(files = {}) {
  const dir = await mkdtemp(join(tmpdir(), "coder-lsptool-"));
  const aside = await mkdtemp(join(tmpdir(), "coder-lspfake-"));
  for (const [p, t] of Object.entries(files)) { await mkdir(join(dir, p, ".."), { recursive: true }); await writeFile(join(dir, p), t); }
  const env = { ...process.env, PATH: FAKE + ":" + process.env.PATH, FAKE_LSP_LOG: join(aside, "log.jsonl"), FAKE_LSP_SCRIPT: join(aside, "script.json"), CODER_LSP_IDLE_MS: "8000" };
  return { dir, aside, env, script: (o) => writeFile(env.FAKE_LSP_SCRIPT, JSON.stringify(o)), log: () => (existsSync(env.FAKE_LSP_LOG) ? readFileSync(env.FAKE_LSP_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []) };
}
/** The tool script run as Coder's machine runs it: its exit code and what it printed. */
function tool(dir, name, args, env, extraEnv = {}) {
  const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, env: { ...env, ...extraEnv }, encoding: "utf8", timeout: 60_000 });
  return { code: r.status, out: String(r.stdout || "") };
}
/** process.env for the time of `f` (runLsp and syncAfterWrite look for the servers on its PATH). */
async function withEnv(env, f) {
  const was = { ...process.env };
  Object.assign(process.env, env);
  try { return await f(); } finally { for (const k of Object.keys(process.env)) if (!(k in was)) delete process.env[k]; Object.assign(process.env, was); }
}

test("LS1 Grok gets Claude Code's LSP tool: its own description word for word, its inputs (operation, filePath, line, character, query) with their descriptions, the same required ones and nothing else; Coder's old `action`, `path`, `column` and its diagnostics action are gone", () => {
  const t = A.CODER_TOOLS.find((x) => x.function.name === "lsp").function;
  // (With Claude Code's four blank lines, as its raw 2.1.325 program has them: before "Supported operations:", "All operations
  // require:", "The workspaceSymbol operation also takes:" and "Note:". 2026-11-14, round 3.)
  assert.equal(t.description, `Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols matching a query across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:
- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

The workspaceSymbol operation also takes:
- query: The symbol name or partial name to search for. Always provide it — most language servers return no results for an empty query.

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.`);
  assert.deepEqual(t.parameters, {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["goToDefinition", "findReferences", "hover", "documentSymbol", "workspaceSymbol", "goToImplementation", "prepareCallHierarchy", "incomingCalls", "outgoingCalls"], description: "The LSP operation to perform" },
      filePath: { type: "string", description: "The absolute or relative path to the file" },
      line: { type: "integer", description: "The line number (1-based, as shown in editors)" },
      character: { type: "integer", description: "The character offset (1-based, as shown in editors)" },
      query: { type: "string", description: "The symbol name or partial name to search for (workspaceSymbol only). Most language servers return no results for an empty query, so always provide it when using workspaceSymbol." },
    },
    required: ["operation", "filePath", "line", "character"],
    additionalProperties: false,
  });
  assert.equal(A.RUN_TOOLS.lsp.verb, "Looked up");
  assert.equal(A.RUN_TOOLS.lsp.label({ operation: "findReferences", filePath: "src/a.py", line: 3, character: 5 }), "findReferences src/a.py:3:5");
  assert.equal(A.RUN_TOOLS.lsp.label({ filePath: { x: 1 } }), " [object Object]", "any input is labelled without failing");
  // Its checks before any hook: the input (checkInput), then the file where the chat's files are (ctx.lspFile).
  assert.equal(I.inputCheckFor("lsp"), I.checkLsp);
  assert.deepEqual(I.checkLsp({ operation: "hover", filePath: "a.py", line: 1, character: 1 }), L.checkInput({ operation: "hover", filePath: "a.py", line: 1, character: 1 }), "with no file check given, the input's alone");
  // Its servers: Claude Code's official typescript-lsp and pyright-lsp plugins'.
  assert.deepEqual(L.LSP_SERVERS.typescript, { command: "typescript-language-server", args: ["--stdio"], extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact", ".mts": "typescript", ".cts": "typescript", ".mjs": "javascript", ".cjs": "javascript" } });
  assert.deepEqual(L.LSP_SERVERS.pyright, { command: "pyright-langserver", args: ["--stdio"], extensionToLanguage: { ".py": "python", ".pyi": "python" } });
  assert.equal(L.serverFor("A.PY").name, "pyright", "extensions match whatever their case");
  // The machine's copy holds the keeper (CD78 loads every import from the copied files).
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-lsp.mjs coder-lspd.mjs "));
});

test("LS2 a call is checked as Claude Code checks its input, before any hook, card or run, refused in its words (\"InputValidationError: LSP failed due to the following issue: …\"): missing, then unexpected, then wrongly typed, then the rest; with only values wrong (line 0, an unknown operation), zod's own raw list of issues, as Claude Code 2.1.325 gives it", async () => {
  const ok = { operation: "findReferences", filePath: "a.py", line: 1, character: 1 };
  assert.deepEqual(L.checkInput(ok), { args: ok });
  assert.deepEqual(L.checkInput({ ...ok, query: "add" }), { args: { ...ok, query: "add" } });
  assert.equal(L.checkInput({ ...ok, line: undefined }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe required parameter `line` is missing");
  assert.equal(L.checkInput({ operation: "definition", filePath: "a.py", column: 3, line: 2 }).error, "error: InputValidationError: LSP failed due to the following issues:\nThe required parameter `character` is missing\nAn unexpected parameter `column` was provided\nThe parameter `operation` is invalid: Invalid option: expected one of \"goToDefinition\"|\"findReferences\"|\"hover\"|\"documentSymbol\"|\"workspaceSymbol\"|\"goToImplementation\"|\"prepareCallHierarchy\"|\"incomingCalls\"|\"outgoingCalls\"");
  assert.equal(L.checkInput({ ...ok, filePath: 7, line: "3", character: 1.5, query: null }).error, "error: InputValidationError: LSP failed due to the following issues:\nThe parameter `filePath` type is expected as `string` but provided as `number`\nThe parameter `line` type is expected as `number` but provided as `string`\nThe parameter `character` type is expected as `int` but provided as `number`\nThe parameter `query` type is expected as `string` but provided as `null`");
  assert.equal(L.checkInput({ ...ok, character: [1] }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `character` type is expected as `number` but provided as `array`");
  // A wrong type beside a wrong value: the value's line after the types, as before.
  assert.equal(L.checkInput({ ...ok, line: "3", character: 0 }).error, "error: InputValidationError: LSP failed due to the following issues:\nThe parameter `line` type is expected as `number` but provided as `string`\nThe parameter `character` is invalid: Too small: expected number to be >0");
  // ONLY VALUES WRONG: zod's issues as they are, JSON with two spaces (zod 4's own message; reproduced with zod in
  // recheck-lsp/zodtest, 2026-11-14).
  const OPS = '[\n      "goToDefinition",\n      "findReferences",\n      "hover",\n      "documentSymbol",\n      "workspaceSymbol",\n      "goToImplementation",\n      "prepareCallHierarchy",\n      "incomingCalls",\n      "outgoingCalls"\n    ]';
  const opIssue = '  {\n    "code": "invalid_value",\n    "values": ' + OPS + ',\n    "path": [\n      "operation"\n    ],\n    "message": "Invalid option: expected one of \\"goToDefinition\\"|\\"findReferences\\"|\\"hover\\"|\\"documentSymbol\\"|\\"workspaceSymbol\\"|\\"goToImplementation\\"|\\"prepareCallHierarchy\\"|\\"incomingCalls\\"|\\"outgoingCalls\\""\n  }';
  const small = (k) => '  {\n    "origin": "number",\n    "code": "too_small",\n    "minimum": 0,\n    "inclusive": false,\n    "path": [\n      "' + k + '"\n    ],\n    "message": "Too small: expected number to be >0"\n  }';
  assert.equal(L.checkInput({ ...ok, line: 0 }).error, "error: InputValidationError: [\n" + small("line") + "\n]");
  assert.equal(L.checkInput({ ...ok, line: 0, character: -2 }).error, "error: InputValidationError: [\n" + small("line") + ",\n" + small("character") + "\n]");
  assert.equal(L.checkInput({ ...ok, operation: "definition" }).error, "error: InputValidationError: [\n" + opIssue + "\n]");
  assert.equal(L.checkInput({ filePath: "a.py", line: 1, character: 1 }).error, "error: InputValidationError: [\n" + opIssue + "\n]", "no operation at all: zod's enum issue, not a missing one");
  assert.equal(L.checkInput({ ...ok, operation: "x", line: 0 }).error, "error: InputValidationError: [\n" + opIssue + ",\n" + small("line") + "\n]");
  assert.equal(L.checkInput({ ...ok, line: 2 ** 60 }).error, 'error: InputValidationError: [\n  {\n    "code": "too_big",\n    "maximum": 9007199254740991,\n    "note": "Integers must be within the safe integer range.",\n    "origin": "int",\n    "inclusive": true,\n    "path": [\n      "line"\n    ],\n    "message": "Too big: expected int to be <=9007199254740991"\n  }\n]');
  assert.equal(L.checkInput({ ...ok, line: -(2 ** 60) }).error, 'error: InputValidationError: [\n  {\n    "code": "too_small",\n    "minimum": -9007199254740991,\n    "note": "Integers must be within the safe integer range.",\n    "origin": "int",\n    "inclusive": true,\n    "path": [\n      "line"\n    ],\n    "message": "Too small: expected int to be >=-9007199254740991"\n  },\n' + small("line") + "\n]");
  // (What JSON cannot carry, in zod's words all the same: NaN and Infinity are wrong types; not an object at all.)
  assert.equal(L.checkInput({ ...ok, line: NaN }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `line` type is expected as `number` but provided as `NaN`");
  assert.equal(L.checkInput([1]).error, "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `` type is expected as `object` but provided as `array`");
  // The formatter as Claude Code's: more than 20 other issues are counted, not listed.
  const many = Array.from({ length: 23 }, (_, i) => ({ code: "custom", path: ["x" + i], message: "m" + i }));
  const t = L.zodText([{ expected: "string", code: "invalid_type", path: ["filePath"], message: "Invalid input: expected string, received undefined" }, ...many]);
  assert.match(t, /^LSP failed due to the following issues:\nThe required parameter `filePath` is missing\nThe parameter `x0` is invalid: m0\n[\s\S]*\nThe parameter `x19` is invalid: m19\n\(3 more issues not listed\)$/);
  assert.equal(L.checkInput({ ...ok, path: "a.py", file_path: "a.py" }).error, "error: InputValidationError: LSP failed due to the following issues:\nAn unexpected parameter `path` was provided\nAn unexpected parameter `file_path` was provided");
  // In Coder's loop: refused before any PreToolUse hook, nothing run; the step shows it.
  const events = [], hooksRun = [], ran = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => [say("", [call("lsp", { operation: "hover", filePath: "a.py", column: 3 }, "l1")]), say("done")][Math.min(n++, 1)],
    exec: async (x) => { if (x.hook) { hooksRun.push(x); return { code: 0, output: "" }; } ran.push(x.command); return { code: 0, output: "" }; },
    emit: (e) => events.push(e), here: () => "/w/shop", root: "/w/shop", where: (p) => (p.startsWith("/") ? p : "/w/shop/" + p),
  }, { text: "go", messages: [], hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "pre.sh" }] }] } }, "settings").list });
  // (lsp is one of the tools Claude Code defers: called before tool_search loaded it, its error is followed by Claude Code's
  // note saying so, coder-toolsearch.mjs; tool-search.test.mjs.)
  const T = await import("../container/coder-toolsearch.mjs");
  assert.equal(r.messages.find((m) => m.tool_call_id === "l1").content, "error: InputValidationError: LSP failed due to the following issues:\nThe required parameter `line` is missing\nThe required parameter `character` is missing\nAn unexpected parameter `column` was provided" + T.notLoadedHint(A.CODER_TOOLS.find((t) => t.function.name === "lsp")));
  assert.equal(hooksRun.length, 0, "no hook ran");
  assert.ok(!ran.some((c) => c.includes("coder-tools.mjs")), "nothing ran");
  const step = events.find((e) => e.type === "bash" && e.id === "l1");
  assert.deepEqual([step.verb, step.command], ["Looked up", "hover a.py"]);
  assert.deepEqual([events.find((e) => e.type === "result" && e.id === "l1").code, events.find((e) => e.type === "result" && e.id === "l1").ran], [-1, false]);
});

test("LS2b the file's own checks run before any hook or card, as Claude Code's validateInput (\"File does not exist: …\", \"Path is not a file: …\", \"Cannot access file: …\"), on Coder's machine where the chat's files are: a refused call fires neither PreToolUse nor PostToolUseFailure, and the step shows it not run", async () => {
  // The checks themselves, as the tools script makes them (from the folder Grok's commands are in).
  const p = await project({ "src/a.py": "x = 1\n" });
  const run = (filePath, extra = {}) => tool(p.dir, "lsp_file", { filePath }, p.env, extra);
  assert.deepEqual(run("src/a.py"), { code: 0, out: "ok" });
  assert.deepEqual(run("src/nope.py"), { code: 1, out: "error: File does not exist: src/nope.py" });
  assert.deepEqual(run("src"), { code: 1, out: "error: Path is not a file: src" });
  assert.deepEqual(run(""), { code: 1, out: "error: Path is not a file: " }, "the folder the commands are in");
  assert.deepEqual(run("a.py", { CODER_CWD: join(p.dir, "src") }), { code: 0, out: "ok" }, "a short path from where the commands are");
  // (Claude Code's "Cannot access file" for anything but a missing file: here a path through a file.)
  assert.deepEqual(run("src/a.py/x"), { code: 1, out: "error: Cannot access file: src/a.py/x. ENOTDIR: not a directory, stat '" + join(p.dir, "src/a.py/x") + "'" });
  assert.equal(await L.fileProblem("x", join(p.dir, "src/a.py")), "");
  // In Coder's loop: refused before the hooks; the tools script's check ran, the lookup did not.
  const events = [], hooksRun = [], tools = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => [say("", [call("lsp", { operation: "hover", filePath: "src/nope.py", line: 1, character: 1 }, "l1")]), say("done")][Math.min(n++, 1)],
    exec: async (x) => {
      if (x.hook) { hooksRun.push(JSON.parse(x.payload).hook_event_name); return { code: 0, output: "" }; }
      const m = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!m) return { code: 0, output: "" };
      const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
      tools.push([req.tool, x.here]);
      return req.tool === "lsp_file" ? { code: 1, output: "error: File does not exist: " + req.args.filePath } : { code: 0, output: "?" };
    },
    emit: (e) => events.push(e), here: () => "/w/shop", root: "/w/shop", where: (q) => (q.startsWith("/") ? q : "/w/shop/" + q),
  }, { text: "go", messages: [], hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUseFailure: [{ matcher: "LSP", hooks: [{ type: "command", command: "fail.sh" }] }] } }, "settings").list });
  assert.equal(r.messages.find((m) => m.tool_call_id === "l1").content, "error: File does not exist: src/nope.py");
  assert.deepEqual(hooksRun, [], "neither PreToolUse nor PostToolUseFailure");
  assert.deepEqual(tools, [["lsp_file", true]], "the check ran where Grok's commands are; the lookup never did");
  assert.deepEqual([events.find((e) => e.type === "bash" && e.id === "l1").command, events.find((e) => e.type === "result" && e.id === "l1").ran], ["hover src/nope.py:1:1", false]);
  // A file that is one: the hooks, then the lookup.
  tools.length = 0; hooksRun.length = 0; n = 0;
  await A.runCoder({
    send: async () => [say("", [call("lsp", { operation: "hover", filePath: "src/a.py", line: 1, character: 1 }, "l2")]), say("done")][Math.min(n++, 1)],
    exec: async (x) => {
      if (x.hook) { hooksRun.push(JSON.parse(x.payload).hook_event_name); const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      const m = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!m) return { code: 0, output: "" };
      tools.push([JSON.parse(Buffer.from(m[1], "base64").toString("utf8")).tool, x.here]);
      return { code: 0, output: "ok" };
    },
    emit: () => {}, here: () => "/w/shop", root: "/w/shop", where: (q) => (q.startsWith("/") ? q : "/w/shop/" + q),
  }, { text: "go", messages: [], hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "pre.sh" }] }] } }, "settings").list });
  assert.deepEqual(tools, [["lsp_file", true], ["lsp", true]]);
  assert.deepEqual(hooksRun, ["PreToolUse"]);
});

test("LS3 each operation asks its server what Claude Code's asks: line and character from 1 for Grok, from 0 for the server; references with the declaration; workspaceSymbol its query (\"\" when none); incoming and outgoing calls the call hierarchy item first", () => {
  const f = "/w/shop/src/a b.ts", uri = "file:///w/shop/src/a%20b.ts", position = { line: 2, character: 4 };
  const q = (operation, extra = {}) => L.requestFor({ operation, line: 3, character: 5, ...extra }, f);
  assert.deepEqual(q("goToDefinition"), { method: "textDocument/definition", params: { textDocument: { uri }, position } });
  assert.deepEqual(q("findReferences"), { method: "textDocument/references", params: { textDocument: { uri }, position, context: { includeDeclaration: true } } });
  assert.deepEqual(q("hover"), { method: "textDocument/hover", params: { textDocument: { uri }, position } });
  assert.deepEqual(q("documentSymbol"), { method: "textDocument/documentSymbol", params: { textDocument: { uri } } });
  assert.deepEqual(q("workspaceSymbol", { query: "Cart" }), { method: "workspace/symbol", params: { query: "Cart" } });
  assert.deepEqual(q("workspaceSymbol"), { method: "workspace/symbol", params: { query: "" } });
  assert.deepEqual(q("goToImplementation"), { method: "textDocument/implementation", params: { textDocument: { uri }, position } });
  for (const op of ["prepareCallHierarchy", "incomingCalls", "outgoingCalls"]) assert.deepEqual(q(op), { method: "textDocument/prepareCallHierarchy", params: { textDocument: { uri }, position } });
});

test("LS4 the answers are Claude Code's, word for word: \"Defined in …\", \"Found N references across M files:\", \"Hover info at …\", \"Document symbols:\", its \"No … found. This may occur …\" sentences; paths from the folder unless two folders up; its counts for the hooks", () => {
  const R = "/w/shop", at = (p, l, c) => ({ uri: "file://" + p, range: { start: { line: l, character: c }, end: { line: l, character: c + 1 } } });
  const a = "/w/shop/src/a.ts", b = "/w/shop/src/b.ts", c = "/w/shop/src/c.ts";
  const f = (op, r, root = R) => L.formatResult(op, r, root);
  assert.deepEqual(f("goToDefinition", [at(a, 4, 2)]), { formatted: "Defined in src/a.ts:5:3", resultCount: 1, fileCount: 1 });
  assert.deepEqual(f("goToDefinition", at(a, 4, 2)), { formatted: "Defined in src/a.ts:5:3", resultCount: 1, fileCount: 1 }, "one Location, not in a list");
  assert.deepEqual(f("goToDefinition", [at(a, 0, 0), { targetUri: "file://" + b, targetRange: { start: { line: 9, character: 0 } }, targetSelectionRange: { start: { line: 9, character: 4 } } }]), { formatted: "Found 2 definitions:\n  src/a.ts:1:1\n  src/b.ts:10:5", resultCount: 2, fileCount: 2 });
  assert.deepEqual(f("goToDefinition", null), { formatted: "No definition found. This may occur if the cursor is not on a symbol, or if the definition is in an external library not indexed by the LSP server.", resultCount: 0, fileCount: 0 });
  assert.equal(f("goToImplementation", [at(b, 1, 0)]).formatted, "Defined in src/b.ts:2:1");
  assert.equal(f("goToDefinition", [at("/other/x.ts", 0, 0)]).formatted, "Defined in /other/x.ts:1:1", "two folders up: in full");
  assert.equal(f("goToDefinition", [at("/w/shop/lib/y.ts", 0, 0)], "/w/shop/app").formatted, "Defined in ../lib/y.ts:1:1", "one folder up: from the folder");
  assert.equal(f("goToDefinition", [{ uri: "file:///w/shop/my%20file.ts", range: { start: { line: 0, character: 0 } } }]).formatted, "Defined in my file.ts:1:1");
  assert.deepEqual(f("findReferences", [at(a, 0, 16), at(a, 1, 18), at(b, 4, 0)]), { formatted: "Found 3 references across 2 files:\n\nsrc/a.ts:\n  Line 1:17\n  Line 2:19\n\nsrc/b.ts:\n  Line 5:1", resultCount: 3, fileCount: 2 });
  assert.equal(f("findReferences", [at(a, 0, 16)]).formatted, "Found 1 reference:\n  src/a.ts:1:17");
  assert.equal(f("findReferences", []).formatted, "No references found. This may occur if the symbol has no usages, or if the LSP server has not fully indexed the workspace.");
  // (A blank line after "Hover info at L:C:", and between a hover's parts, as Claude Code 2.1.325's raw program writes them: its
  // ts and Hl. 2026-11-14, round 3.)
  assert.deepEqual(f("hover", { contents: { kind: "markdown", value: "```ts\nfunction add(a: number): number\n```" }, range: { start: { line: 0, character: 16 } } }), { formatted: "Hover info at 1:17:\n\n```ts\nfunction add(a: number): number\n```", resultCount: 1, fileCount: 1 });
  assert.equal(f("hover", { contents: ["a", { language: "ts", value: "b" }] }).formatted, "a\n\nb");
  assert.equal(f("hover", { contents: { kind: "markdown", value: "**x**: number" }, range: { start: { line: 3, character: 2 } } }).formatted, "Hover info at 4:3:\n\n**x**: number");
  assert.equal(f("hover", { contents: ["a", { language: "ts", value: "let x: number" }], range: { start: { line: 0, character: 0 } } }).formatted, "Hover info at 1:1:\n\na\n\nlet x: number");
  assert.equal(f("hover", { contents: "plain" }).formatted, "plain");
  assert.deepEqual(f("hover", null), { formatted: "No hover information available. This may occur if the cursor is not on a symbol, or if the LSP server has not fully indexed the file.", resultCount: 0, fileCount: 0 });
  const tree = [{ name: "Cart", kind: 5, detail: "class", range: { start: { line: 0 } }, children: [{ name: "add", kind: 6, range: { start: { line: 1 } } }, { name: "total", kind: 6, detail: "(): number", range: { start: { line: 4 } } }] }, { name: "helper", kind: 12, range: { start: { line: 9 } } }, { name: "odd", kind: 99, range: { start: { line: 11 } } }];
  assert.deepEqual(f("documentSymbol", tree), { formatted: "Document symbols:\nCart (Class) class - Line 1\n  add (Method) - Line 2\n  total (Method) (): number - Line 5\nhelper (Function) - Line 10\nodd (Unknown) - Line 12", resultCount: 5, fileCount: 1 });
  assert.equal(f("documentSymbol", []).formatted, "No symbols found in document. This may occur if the file is empty, not supported by the LSP server, or if the server has not fully indexed the file.");
  const syms = [{ name: "add", kind: 12, location: at(a, 0, 16), containerName: "math" }, { name: "Add", kind: 5, location: at(b, 2, 0) }];
  assert.deepEqual(f("workspaceSymbol", syms), { formatted: "Found 2 symbols in workspace:\n\nsrc/a.ts:\n  add (Function) - Line 1 in math\n\nsrc/b.ts:\n  Add (Class) - Line 3", resultCount: 2, fileCount: 2 });
  assert.equal(f("documentSymbol", syms.slice(0, 1)).formatted, "Found 1 symbol in workspace:\n\nsrc/a.ts:\n  add (Function) - Line 1 in math", "a flat list: as workspace symbols");
  assert.equal(f("workspaceSymbol", []).formatted, "No symbols found in workspace. This may occur if the workspace is empty, or if the LSP server has not finished indexing the project.");
  const item = { name: "add", kind: 12, uri: "file://" + a, range: { start: { line: 0 } }, detail: "math.ts" };
  assert.deepEqual(f("prepareCallHierarchy", [item]), { formatted: "Call hierarchy item: add (Function) - src/a.ts:1 [math.ts]", resultCount: 1, fileCount: 1 });
  assert.equal(f("prepareCallHierarchy", [item, { ...item, name: "sub", detail: undefined }]).formatted, "Found 2 call hierarchy items:\n  add (Function) - src/a.ts:1 [math.ts]\n  sub (Function) - src/a.ts:1");
  assert.equal(f("prepareCallHierarchy", []).formatted, "No call hierarchy item found at this position");
  assert.deepEqual(f("incomingCalls", [{ from: { name: "main", kind: 12, uri: "file://" + b, range: { start: { line: 2 } } }, fromRanges: [{ start: { line: 3, character: 4 } }, { start: { line: 7, character: 10 } }] }]), { formatted: "Found 1 incoming call:\n\nsrc/b.ts:\n  main (Function) - Line 3 [calls at: 4:5, 8:11]", resultCount: 1, fileCount: 1 });
  assert.equal(f("incomingCalls", []).formatted, "No incoming calls found (nothing calls this function)");
  assert.deepEqual(f("outgoingCalls", [{ to: { name: "log", kind: 12, uri: "file://" + c, range: { start: { line: 0 } } }, fromRanges: [{ start: { line: 1, character: 2 } }] }, { to: { name: "warn", kind: 12, uri: "file://" + c, range: { start: { line: 5 } } } }]), { formatted: "Found 2 outgoing calls:\n\nsrc/c.ts:\n  log (Function) - Line 1 [called from: 2:3]\n  warn (Function) - Line 6", resultCount: 2, fileCount: 1 });
  assert.equal(f("outgoingCalls", null).formatted, "No outgoing calls found (this function calls nothing)");
});

test("LS5 results from files git ignores are left out, as Claude Code 2.1.47 leaves them out (\"e.g., node_modules/, venv/\"): definitions, references, implementations and workspace symbols", async () => {
  let git = true; try { execFileSync("git", ["--version"]); } catch { git = false; }
  if (!git) return;
  const p = await project({ ".gitignore": "node_modules/\n", "src/a.py": "x = 1\n", "node_modules/m/x.py": "x = 2\n" });
  execFileSync("git", ["init", "-q"], { cwd: p.dir });
  const at = (rel, l) => ({ uri: "file://" + join(p.dir, rel), range: { start: { line: l, character: 0 }, end: { line: l, character: 1 } } });
  const refs = [at("src/a.py", 0), at("node_modules/m/x.py", 0), at("src/a.py", 2)];
  assert.deepEqual(await L.withoutIgnored(refs, p.dir), [refs[0], refs[2]]);
  // Through the tool (the stand-in server answers with both), and for workspace symbols.
  await p.script({ "textDocument/references": refs, "workspace/symbol": [{ name: "x", kind: 13, location: refs[1] }, { name: "x", kind: 13, location: refs[0] }] });
  try {
    const r = tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env);
    assert.equal(r.code, 0);
    assert.ok(r.out.endsWith("Found 2 references across 1 files:\n\nsrc/a.py:\n  Line 1:1\n  Line 3:1"), r.out);
    const w = tool(p.dir, "lsp", { operation: "workspaceSymbol", filePath: "src/a.py", line: 1, character: 1, query: "x" }, p.env);
    assert.ok(w.out.endsWith("Found 1 symbol in workspace:\n\nsrc/a.py:\n  x (Variable) - Line 1"), w.out);
  } finally { await L.stopKeeper(p.dir); }
});

test("LS5b git is asked which results it ignores from the folder the commands are in, as Claude Code's tool asks from its current folder (its ue()): a lookup made in another of the chat's repositories leaves out that repository's ignored files (from the project's folder, git refused every path there)", async () => {
  let git = true; try { execFileSync("git", ["--version"]); } catch { git = false; }
  if (!git) return;
  const p = await project({ "src/main.py": "y = 0\n" });
  execFileSync("git", ["init", "-q"], { cwd: p.dir });
  const other = await mkdtemp(join(tmpdir(), "coder-lspother-"));
  for (const [f, t] of Object.entries({ ".gitignore": "vendor/\n", "src/a.py": "x = 1\n", "vendor/m/x.py": "x = 2\n" })) { await mkdir(join(other, f, ".."), { recursive: true }); await writeFile(join(other, f), t); }
  execFileSync("git", ["init", "-q"], { cwd: other });
  const at = (rel, l) => ({ uri: "file://" + join(other, rel), range: { start: { line: l, character: 0 }, end: { line: l, character: 1 } } });
  await p.script({ "textDocument/references": [at("src/a.py", 0), at("vendor/m/x.py", 0)] });
  try {
    const r = tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env, { CODER_EXTRA_ROOTS: other, CODER_CWD: other });
    assert.equal(r.code, 0, r.out);
    assert.ok(r.out.endsWith("Found 1 reference:\n  src/a.py:1:1"), r.out);
    // (And the function itself is given that folder.)
    const seen = [];
    const check = async (paths, cwd) => { seen.push(cwd); return { code: 1, stdout: "" }; };
    await withEnv(p.env, () => L.runLsp({ operation: "findReferences", filePath: join(other, "src/a.py"), line: 1, character: 1 }, { root: p.dir, base: other, inside: async (x) => ({ abs: x }), check }));
    assert.deepEqual(seen, [other]);
  } finally { await L.stopKeeper(p.dir); await rm(other, { recursive: true, force: true }); }
});

test("LS5c a file in one of the owner's additional working folders is looked up as one in the project (Claude Code's LSP reads there without asking, as its Read does: \"Files in additional directories follow the same permission rules as the original working directory\"; Coder's refused it as outside the project), never in their .git", async () => {
  const p = await project({ "src/main.py": "y = 0\n" });
  const extra = await mkdtemp(join(tmpdir(), "coder-lspwork-"));
  await mkdir(join(extra, ".git"), { recursive: true });
  await writeFile(join(extra, "lib.py"), "x = 1\n"); await writeFile(join(extra, ".git", "x.py"), "x\n");
  await p.script({ "textDocument/references": [{ uri: "file://" + join(extra, "lib.py"), range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }] });
  try {
    const args = { operation: "findReferences", filePath: join(extra, "lib.py"), line: 1, character: 1 };
    const r = tool(p.dir, "lsp", args, p.env, { CODER_WORK_DIRS: extra });
    assert.equal(r.code, 0, r.out);
    // (Named as Claude Code's formatter names it: from the folder, one folder up included.)
    assert.ok(r.out.endsWith("Found 1 reference:\n  ../" + extra.split("/").pop() + "/lib.py:1:1"), r.out);
    assert.deepEqual(tool(p.dir, "lsp", args, p.env), { code: 1, out: "error: that path is outside the project" }, "only the owner's own working folders");
    assert.deepEqual(tool(p.dir, "lsp", { ...args, filePath: join(extra, ".git", "x.py") }, p.env, { CODER_WORK_DIRS: extra }), { code: 1, out: "error: the .git folder is off limits" });
  } finally { await L.stopKeeper(p.dir); await rm(extra, { recursive: true, force: true }); }
});

test("LS6 what the servers report is sent once, as Claude Code's registry sends it: duplicates left out, errors first, at most 10 a file and 30 in all, every severity; an edit forgets what was sent for its file; the note is Claude Code's, cut at 4,000 characters", () => {
  const d = (line, severity, message, extra = {}) => ({ message, severity, range: { start: { line, character: 0 }, end: { line, character: 1 } }, ...extra });
  const reg = new L.DiagnosticsRegistry();
  reg.register({ serverName: "pyright", files: [{ uri: "/w/a.py", diagnostics: [d(5, "Hint", "h"), d(1, "Error", "e1", { source: "Pyright" }), d(2, "Warning", "w"), d(1, "Error", "e1", { source: "Pyright" }), d(3, "Info", "i")] }] });
  const t = reg.takePending();
  assert.deepEqual(t, [{ serverName: "pyright", files: [{ uri: "/w/a.py", diagnostics: [d(1, "Error", "e1", { source: "Pyright" }), d(2, "Warning", "w"), d(3, "Info", "i"), d(5, "Hint", "h")] }] }]);
  assert.deepEqual(reg.takePending(), [], "nothing new");
  reg.register({ serverName: "pyright", files: [{ uri: "/w/a.py", diagnostics: [d(1, "Error", "e1", { source: "Pyright" }), d(8, "Error", "e8")] }] });
  assert.deepEqual(reg.takePending()[0].files[0].diagnostics, [d(8, "Error", "e8")], "only what was not sent");
  reg.clearDeliveredForFile("/w/a.py");
  reg.register({ serverName: "pyright", files: [{ uri: "/w/a.py", diagnostics: [d(1, "Error", "e1", { source: "Pyright" })] }] });
  assert.equal(reg.takePending()[0].files[0].diagnostics.length, 1, "after an edit, sent again");
  // An edit drops the reports still waiting for its file, others stay.
  reg.register({ serverName: "pyright", files: [{ uri: "/w/b.py", diagnostics: [d(0, "Error", "b")] }, { uri: "/w/c.py", diagnostics: [d(0, "Error", "c")] }] });
  reg.clearPendingForFile("/w/b.py");
  assert.deepEqual(reg.takePending()[0].files.map((x) => x.uri), ["/w/c.py"]);
  // Caps: 10 a file, 30 in all; two servers named together.
  const many = (n, tag) => Array.from({ length: n }, (_, i) => d(i, "Error", tag + i));
  reg.register({ serverName: "pyright", files: [{ uri: "/w/x.py", diagnostics: many(12, "x") }] });
  reg.register({ serverName: "typescript", files: [{ uri: "/w/y.ts", diagnostics: many(9, "y") }, { uri: "/w/z.ts", diagnostics: many(10, "z") }, { uri: "/w/q.ts", diagnostics: many(10, "q") }] });
  const big = reg.takePending()[0];
  assert.equal(big.serverName, "pyright, typescript");
  assert.deepEqual(big.files.map((x) => [x.uri, x.diagnostics.length]), [["/w/x.py", 10], ["/w/y.ts", 9], ["/w/z.ts", 10], ["/w/q.ts", 1]]);
  // The note, Claude Code's word for word.
  assert.equal(L.diagnosticsNote([{ uri: "/w/src/a.py", diagnostics: [d(1, "Error", "e1", { code: "reportX", source: "Pyright" }), d(2, "Warning", "w"), d(3, "Info", "i"), d(4, "Hint", "h"), d(5, "Odd", "o")] }, { uri: "/w/b.ts", diagnostics: [d(0, "Error", "b", { code: "2322" })] }]),
    "<new-diagnostics>The following new diagnostic issues were detected:\n\na.py:\n  ✘ [Line 2:1] e1 [reportX] (Pyright)\n  ⚠ [Line 3:1] w\n  ℹ [Line 4:1] i\n  ★ [Line 5:1] h\n  ● [Line 6:1] o\n\nb.ts:\n  ✘ [Line 1:1] b [2322]</new-diagnostics>");
  const long = L.diagnosticsNote([{ uri: "/w/a.py", diagnostics: [d(0, "Error", "m".repeat(5000))] }]);
  const body = long.slice("<new-diagnostics>The following new diagnostic issues were detected:\n\n".length, -"</new-diagnostics>".length);
  assert.equal(body.length, 4000);
  assert.ok(body.endsWith("m…[truncated]"));
  // A report as Claude Code keeps it: the file's path, the severity's name, the code as text.
  assert.deepEqual(L.reportFiles({ uri: "file:///w/a%20b.py", diagnostics: [{ range: { start: { line: 1, character: 2 }, end: { line: 1, character: 3 } }, message: "m", code: 7 }] }), [{ uri: "/w/a b.py", diagnostics: [{ message: "m", severity: "Error", range: { start: { line: 1, character: 2 }, end: { line: 1, character: 3 } }, source: undefined, code: "7" }] }]);
});

test("LS7 a language server as Claude Code runs it: its initialize (Coder named as the client), files opened with their language (.mts as TypeScript, .pyi as Python), changed whole and saved, at most 50 open; its questions answered; empty and out-of-date reports dropped; shutdown then exit", async () => {
  const p = await project({ "m.mts": "export const a = 1;\n", "t.pyi": "x: int\n", "a.py": "BAD\n" });
  const mgr = new L.LspManager(p.dir, { env: p.env });
  await p.script({ askClient: true });
  try {
    const r = await L.lookupIn(mgr, { file: join(p.dir, "t.pyi"), operation: "hover", line: 1, character: 1 });
    assert.deepEqual(r, { result: null });
    await L.lookupIn(mgr, { file: join(p.dir, "m.mts"), operation: "hover", line: 1, character: 1 });
    await mgr.changeFile(join(p.dir, "t.pyi"), "y: str\n");
    await mgr.saveFile(join(p.dir, "t.pyi"));
    await sleep(300);
    const log = p.log();
    const init = log.find((m) => m.method === "initialize").params;
    // (CLAUDE_PROJECT_DIR in its environment, the chat's project: "Claude Code also sets this variable in the environment of …
    // plugin LSP servers".)
    assert.deepEqual(log.filter((m) => m.start).map((m) => m.projectDir), [p.dir, p.dir]);
    assert.deepEqual(init.clientInfo, { name: "Coder" });
    assert.equal(init.processId, process.pid);
    assert.deepEqual(init.workspaceFolders, [{ uri: "file://" + p.dir, name: p.dir.split("/").pop() }]);
    assert.equal(init.rootUri, "file://" + p.dir);
    assert.deepEqual(init.capabilities, {
      workspace: { configuration: false, workspaceFolders: false, didChangeWatchedFiles: { dynamicRegistration: false } },
      textDocument: {
        synchronization: { dynamicRegistration: false, willSave: false, willSaveWaitUntil: false, didSave: true },
        publishDiagnostics: { relatedInformation: true, tagSupport: { valueSet: [1, 2] }, versionSupport: false, codeDescriptionSupport: true, dataSupport: false },
        hover: { dynamicRegistration: false, contentFormat: ["markdown", "plaintext"] },
        definition: { dynamicRegistration: false, linkSupport: true },
        references: { dynamicRegistration: false },
        documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
        callHierarchy: { dynamicRegistration: false },
      },
      general: { positionEncodings: ["utf-16"] },
    });
    assert.deepEqual(log.filter((m) => m.method === "textDocument/didOpen").map((m) => m.params.textDocument.languageId), ["python", "typescript"]);
    const change = log.find((m) => m.method === "textDocument/didChange").params;
    assert.deepEqual([change.textDocument.version, change.contentChanges], [2, [{ text: "y: str\n" }]]);
    assert.ok(log.some((m) => m.method === "textDocument/didSave"));
    // Its questions: the configuration (none: null for each), anything else Claude Code does not handle.
    const answers = log.filter((m) => m.method === undefined && (m.id === 900 || m.id === 901));
    assert.deepEqual(answers.find((m) => m.id === 900).result, [null, null]);
    assert.deepEqual(answers.find((m) => m.id === 901).error, { code: -32601, message: "Unhandled method window/workDoneProgress/create" });
    // At most 50 open: the oldest closed.
    for (let i = 0; i < 50; i++) await mgr.openFile(join(p.dir, "f" + i + ".py"), "x = " + i + "\n");
    await sleep(200);
    const closed = p.log().filter((m) => m.method === "textDocument/didClose").map((m) => m.params.textDocument.uri.split("/").pop());
    assert.deepEqual(closed.sort(), ["m.mts", "t.pyi"], "past 50 open, the oldest closed, whatever their server");
    // Reports: an empty one and one for an older version are not kept.
    mgr.registry.takePending();
    const uri = "file://" + join(p.dir, "f1.py");
    mgr.versions.set(uri, 5);
    mgr.published_("pyright", { uri, version: 4, diagnostics: [{ range: { start: { line: 0, character: 0 } }, message: "old", severity: 1 }] });
    mgr.published_("pyright", { uri, diagnostics: [] });
    assert.deepEqual(mgr.registry.takePending(), []);
    mgr.published_("pyright", { uri, version: 5, diagnostics: [{ range: { start: { line: 0, character: 0 } }, message: "now", severity: 2 }] });
    assert.equal(mgr.registry.takePending()[0].files[0].diagnostics[0].message, "now");
  } finally { await mgr.shutdown(3000); }
  // (Each is then ended, as Claude Code's stop ends one still there after `exit`: the stand-in reads what is left first.)
  await sleep(400);
  const end = p.log().map((m) => m.method).filter(Boolean);
  assert.deepEqual([end.filter((x) => x === "shutdown").length, end.filter((x) => x === "exit").length], [2, 2], "each server: shutdown, then exit");
  assert.ok(end.lastIndexOf("exit") > end.indexOf("shutdown"));
});

test("LS8 a server's failures, in Claude Code's words: a request answered in no time (\"no response after …ms\"), ContentModified asked again, a crash (\"crashed with exit code 3\") and a new start at the next request, at most three crashes in a row, a stdout that breaks the protocol, a program that is not there", async () => {
  const p = await project({ "a.py": "x = 1\n" });
  const file = join(p.dir, "a.py");
  // No answer in time.
  await p.script({ hangOn: "textDocument/hover" });
  let mgr = new L.LspManager(p.dir, { env: p.env, requestMs: 300 });
  try { await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: "LSP request 'textDocument/hover' failed for server 'pyright': no response after 300ms" }); } finally { await mgr.shutdown(2000); }
  // ContentModified: asked again (0.5 and 1 seconds apart), then answered.
  await p.script({ contentModified: { method: "textDocument/hover", times: 2 }, "textDocument/hover": { contents: "ok" } });
  mgr = new L.LspManager(p.dir, { env: p.env });
  try { assert.deepEqual(await L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { result: { contents: "ok" } }); } finally { await mgr.shutdown(2000); }
  // A crash: this request fails, the next starts it again.
  await p.script({ crashOn: "textDocument/definition", "textDocument/hover": { contents: "back" } });
  mgr = new L.LspManager(p.dir, { env: p.env });
  try {
    await assert.rejects(L.lookupIn(mgr, { file, operation: "goToDefinition", line: 1, character: 1 }), { message: "LSP request 'textDocument/definition' failed for server 'pyright': LSP server pyright crashed with exit code 3" });
    const starts = p.log().filter((m) => m.start).length;
    assert.deepEqual(await L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { result: { contents: "back" } });
    assert.equal(p.log().filter((m) => m.start).length, starts + 1, "started again");
  } finally { await mgr.shutdown(2000); }
  // A server that dies at every start: after three crashes in a row, no more tries.
  await p.script({ crashAlways: true });
  mgr = new L.LspManager(p.dir, { env: p.env });
  try {
    const got = [];
    for (let i = 0; i < 5; i++) got.push(await L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }).then(() => "ok", (e) => e.message));
    assert.match(got[0], /LSP server pyright crashed with exit code 3|LSP server crashed during startup/);
    assert.equal(got[4], "LSP server 'pyright' exceeded max crash recovery attempts (3); last crash: LSP server pyright crashed with exit code 3");
  } finally { await mgr.shutdown(2000); }
  // Non-protocol output on stdout: disconnected, in Claude Code's words.
  await p.script({ garbage: true });
  mgr = new L.LspManager(p.dir, { env: p.env });
  try { await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: "LSP server sent non-protocol output in the header block — its stdout is desynchronized from the base protocol (logs/banners on stdout instead of stderr?)" }); } finally { await mgr.shutdown(2000); }
  // A program that is not there: Claude Code's runtime's words.
  mgr = new L.LspManager(p.dir, { env: p.env, servers: { pyright: { command: "no-such-server-xyz", args: [], extensionToLanguage: { ".py": "python" } } } });
  try {
    await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: 'Executable not found in $PATH: "no-such-server-xyz"' });
    // Claude Code 2.1.323's warning for it, for the owner, once for the server.
    assert.deepEqual(mgr.takeNotices(), [{ name: "pyright", code: "ENOENT", reason: 'Executable not found in $PATH: "no-such-server-xyz"' }]);
    await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }));
    assert.deepEqual(mgr.takeNotices(), [], "once");
  } finally { await mgr.shutdown(2000); }
});

test("LS8b more of a server's ends, as Claude Code's: a clean exit (code 0) is no crash (it is not started again, and a request is refused, \"server is running\"); one killed under the chat's memory cap says so (\"— killed at the tool memory limit (CODER_TOOL_MEMORY_LIMIT)\", or \"likely\" when the cgroup can't be read); one still starting is not waited for; and the warning when one can't start, in Claude Code's words", async () => {
  const p = await project({ "a.py": "x = 1\n", "b.py": "y = 2\n" });
  const file = join(p.dir, "a.py");
  // A clean exit: no crash, no new start.
  await p.script({ cleanExitOn: "textDocument/definition", "textDocument/hover": { contents: "x" } });
  let mgr = new L.LspManager(p.dir, { env: p.env, requestMs: 500 });
  try {
    assert.deepEqual(await L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { result: { contents: "x" } });
    await assert.rejects(L.lookupIn(mgr, { file, operation: "goToDefinition", line: 1, character: 1 }), { message: "LSP request 'textDocument/definition' failed for server 'pyright': no response after 500ms" });
    await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: "Cannot send request to LSP server 'pyright': server is running" });
    assert.equal(p.log().filter((m) => m.start).length, 1, "not started again");
    assert.equal(mgr.servers.get("pyright").crashes, 0);
  } finally { await mgr.shutdown(2000); }
  // Killed (SIGKILL) under the memory cap: the cgroup's OOM count went up since it started.
  const cg = await mkdtemp(join(tmpdir(), "coder-lspcg-"));
  await writeFile(join(cg, "memory.events"), "low 0\nhigh 0\nmax 3\noom 1\noom_kill 1\n");
  await p.script({ killOn: "textDocument/definition" });
  mgr = new L.LspManager(p.dir, { env: p.env, memCg: cg });
  try {
    await mgr.openFile(file, "x = 1\n");
    await writeFile(join(cg, "memory.events"), "low 0\nhigh 0\nmax 4\noom 2\noom_kill 2\n");
    await assert.rejects(L.lookupIn(mgr, { file, operation: "goToDefinition", line: 1, character: 1 }), { message: "LSP request 'textDocument/definition' failed for server 'pyright': LSP server pyright crashed with killed by signal SIGKILL — killed at the tool memory limit (CODER_TOOL_MEMORY_LIMIT)" });
    assert.equal(mgr.servers.get("pyright").lastError.oomKilledInToolCgroup, true);
  } finally { await mgr.shutdown(2000); }
  // ... and when the cgroup's count can't be read: "likely"; with no cap: the signal alone.
  for (const [memCg, tail] of [[join(cg, "gone"), " — likely killed at the tool memory limit (CODER_TOOL_MEMORY_LIMIT)"], ["", ""]]) {
    mgr = new L.LspManager(p.dir, { env: p.env, memCg });
    try { await assert.rejects(L.lookupIn(mgr, { file, operation: "goToDefinition", line: 1, character: 1 }), { message: "LSP request 'textDocument/definition' failed for server 'pyright': LSP server pyright crashed with killed by signal SIGKILL" + tail }); } finally { await mgr.shutdown(2000); }
  }
  assert.deepEqual(L.crashWhy(137, null, { memCg: cg, oomBefore: 2, read: () => "oom_kill 2\n" }), { why: "exit code 137", oom: false }, "the count did not go up: nothing said");
  assert.deepEqual(L.crashWhy(3, null, { memCg: cg, oomBefore: 0, read: () => "oom_kill 9\n" }), { why: "exit code 3", oom: false }, "not a kill");
  assert.equal(L.oomKills(cg, () => "oom_kill_disable 0\nunder_oom 0\noom_kill 5\n"), 5, "cgroup v1's memory.oom_control");
  // A server still starting is not waited for (Claude Code's ensureServerStarted): a call meanwhile is refused.
  await p.script({ slowInit: 800, "textDocument/hover": { contents: "late" } });
  mgr = new L.LspManager(p.dir, { env: p.env });
  try {
    const first = mgr.openFile(join(p.dir, "b.py"), "y = 2\n");
    await sleep(100);
    await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: "Failed to sync file open " + file + ": Cannot send notification to LSP server 'pyright': server is starting" });
    await first;
    assert.deepEqual(await L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { result: { contents: "late" } }, "once it runs");
  } finally { await mgr.shutdown(2000); }
  // The warning, Claude Code 2.1.323's words without its plugin sentence (Coder's servers come with its machine).
  assert.equal(L.noticeText({ name: "pyright", code: "ENOENT", reason: "x" }), "Language server \"pyright\" couldn't start: its program \"pyright-langserver\" wasn't found. Check that it's installed and on your PATH.");
  assert.equal(L.noticeText({ name: "typescript", code: "EACCES", reason: "x" }), "Language server \"typescript\" couldn't start: its program \"typescript-language-server\" can't be run. Check that the file is executable and that you have permission to run it.");
  assert.equal(L.noticeText({ name: "pyright", code: "", reason: "LSP server pyright crashed with exit code 3" }), "Language server \"pyright\" couldn't start: LSP server pyright crashed with exit code 3");
  assert.equal(L.noticeText({ name: "evil\nname", code: "ENOENT" }), "", "only Coder's own servers");
  assert.equal(L.startFailureNotice("go", "/opt/go/bin/gopls", { code: "ENOENT" }), "Language server \"go\" couldn't start: its program \"gopls\" wasn't found. Check that it's installed at the path the plugin gives.");
});

/** The chat's keeper, started as Coder's machine starts it (coder-lspd.mjs with the project), with the test's PATH and HOME. */
async function keeper(p, extra = {}) {
  const k = spawn(process.execPath, ["--no-warnings", L.KEEPER_SCRIPT, p.dir], { cwd: p.dir, env: { ...p.env, ...extra }, detached: true, stdio: "ignore" });
  const sock = await L.socketFor(p.dir, extra.HOME || p.env.HOME);
  for (let i = 0; i < 100; i++) { try { await L.askKeeper(sock, { op: "ping" }, 500); break; } catch { await sleep(50); } }
  return { proc: k, alive: () => k.exitCode === null && k.signalCode === null, stop: () => L.stopKeeper(p.dir) };
}

test("LS9 the tool on Coder's machine: Claude Code's answers and errors, its result object for the hooks behind FACTS_MARK, one server kept for the chat by its keeper, results over 100,000 characters saved with their start shown; Coder's own rule kept (inside the project, never .git)", async () => {
  const p = await project({ "src/a.py": "x = 1\nprint(x)\n", "Gemfile.rb": "puts 1\n", "src/sub/keep.py": "y = 2\n" });
  const at = (l, c) => ({ uri: "$URI", range: { start: { line: l, character: c }, end: { line: l, character: c + 1 } } });
  await p.script({ "textDocument/references": [at(0, 0), at(1, 6)], "textDocument/definition": [at(0, 0)] });
  const k = await keeper(p);
  try {
    const r = tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env);
    assert.equal(r.code, 0);
    const fa = A.factsAnswer(r.out);
    assert.equal(fa.text, "Found 2 references across 1 files:\n\nsrc/a.py:\n  Line 1:1\n  Line 2:7");
    assert.deepEqual(fa.facts, { operation: "findReferences", result: fa.text, filePath: "src/a.py", resultCount: 2, fileCount: 1 });
    // From a folder below: paths from there; one server for the chat, its keeper's.
    const r2 = tool(p.dir, "lsp", { operation: "goToDefinition", filePath: "a.py", line: 2, character: 7 }, p.env, { CODER_CWD: join(p.dir, "src") });
    assert.equal(A.factsAnswer(r2.out).text, "Defined in a.py:1:1");
    assert.equal(p.log().filter((m) => m.start).length, 1, "the keeper's server answered both");
    // Claude Code's errors: Coder's own rule (inside the project, never .git) and a wrong input fail the call; the rest are
    // answers. (The file's own checks ran before, with the hooks: lsp_file, LS2b.)
    const e = (args, extra) => tool(p.dir, "lsp", { operation: "hover", line: 1, character: 1, ...args }, p.env, extra);
    assert.deepEqual(e({ filePath: "/etc/hostname" }), { code: 1, out: "error: that path is outside the project" });
    assert.deepEqual(e({ filePath: ".git/config" }), { code: 1, out: "error: the .git folder is off limits" });
    assert.match(e({ filePath: "src/a.py", line: 0 }).out, /^error: InputValidationError: \[\n {2}\{\n {4}"origin": "number",/);
    const rb = e({ filePath: "Gemfile.rb" });
    assert.equal(rb.code, 0);
    assert.deepEqual(A.factsAnswer(rb.out), { text: "No LSP server available for file type: .rb", facts: { operation: "hover", result: "No LSP server available for file type: .rb", filePath: "Gemfile.rb" } });
    assert.equal(A.factsAnswer(e({ filePath: "gone.py" }).out).text, "Error performing hover: ENOENT: no such file or directory, open '" + join(p.dir, "gone.py") + "'", "gone since its check: Claude Code's catch-all answer");
    await writeFile(join(p.dir, "big.py"), "");
    await truncate(join(p.dir, "big.py"), 10_500_001);
    assert.equal(A.factsAnswer(e({ filePath: "big.py" }).out).text, "File too large for LSP analysis (11MB exceeds 10MB limit)");
    // Over 100,000 characters: saved whole, its start shown, as Claude Code persists a long result.
    await p.script({ "textDocument/references": Array.from({ length: 9000 }, (_, i) => ({ uri: "file://" + join(p.dir, "src", "f" + i + ".py"), range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } } })) });
    const long = A.factsAnswer(tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env).out);
    assert.ok(long.facts.result.length > 100_000, "the hooks get it whole");
    const m = /^<persisted-output>\nOutput too large \((\d+(?:\.\d)?KB)\)\. Full output saved to: (\/tmp\/coder-scratch\/lsp-[0-9a-f]{9}\.txt)\n\nPreview \(first 2KB\):\nFound 9000 references across 9000 files:\n[\s\S]*\n\.\.\.\n<\/persisted-output>$/.exec(long.text);
    assert.ok(m, long.text.slice(0, 300));
    assert.equal(readFileSync(m[2], "utf8"), long.facts.result);
    await rm(m[2], { force: true });
  } finally { await k.stop(); }
});

test("LS10 what the servers report after a write or an edit is taken once per step, after whatever tool ran, as Claude Code gathers its diagnostics attachment, with no wait; one that comes after the turn's last step goes to Coder with the owner's next message; what was sent is remembered for the whole chat; the chat shows Claude Code's row for each note; an agent with no shell only sends the text", async () => {
  const p = await project({ "s.py": "ok = 1\n", "o.py": "BAD old\n" });
  // (Each report comes 0.8 seconds after the text, so the step right after a write never has it yet; and at each change the
  // server reports every open file again, as a whole-project checker does.)
  await p.script({ "textDocument/hover": { contents: "x" }, slowReport: 800, reportAll: true });
  const k = await keeper(p);
  let starts = 0;
  const lsp = { start: async () => { starts++; return true; }, alive: () => k.alive() };
  const exec = async (x) => {
    if (/^sleep /.test(String(x.command))) { await sleep(Number(String(x.command).split(" ")[1]) * 1000); return { code: 0, output: "" }; }
    if (!/coder-tools\.mjs (\S+)$/.test(String(x.command))) return { code: 0, output: "ok\n" };
    const r = spawnSync("bash", ["-c", x.command], { cwd: p.dir, env: p.env, encoding: "utf8", timeout: 60_000 });
    return { code: r.status, output: String(r.stdout || "") };
  };
  const run = async (rounds, extra = {}, opts = {}) => {
    let n = 0;
    const events = [];
    const r = await A.runCoder({ send: async () => rounds[Math.min(n++, rounds.length - 1)], exec, emit: (e) => events.push(e), here: () => p.dir, root: p.dir, where: (q) => (q.startsWith("/") ? q : p.dir + "/" + q), lsp, ...extra }, { text: "go", messages: [], ...opts });
    return { r, events, notes: r.messages.filter((m) => m.role === "user" && /new-diagnostics/.test(String(m.content))).map((m) => m.content) };
  };
  try {
    // An edit, then a step that takes a second: the step right after the edit has nothing yet; the next one takes the report,
    // the edited file's and the one a lookup opened, in Claude Code's note inside the round's note, and the chat's row.
    let t = await run([say("", [call("lsp", { operation: "hover", filePath: "o.py", line: 1, character: 1 }, "l1")]), say("", [call("edit", { path: "s.py", old_string: "ok = 1", new_string: "ok = 1\nBAD new\nHINT x" }, "e1")]), say("", [call("bash", { command: "sleep 1.2", description: "Wait" }, "b1")]), say("done")]);
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "l1").content, "x");
    const at = t.r.messages.findIndex((m) => m.tool_call_id === "e1");
    assert.equal(t.r.messages[at].content, "The file s.py has been updated successfully.");
    assert.ok(!/new-diagnostics/.test(String((t.r.messages[at + 1] || {}).content)), "no wait after the edit: nothing yet at the step right after it");
    const after = t.r.messages.findIndex((m) => m.tool_call_id === "b1");
    assert.equal(t.r.messages[after + 1].content, "(Note from Coder's app, not the owner, about your last commands:\n<new-diagnostics>The following new diagnostic issues were detected:\n\no.py:\n  ✘ [Line 1:1] bad thing: BAD old [fake-bad] (Fake)\n\ns.py:\n  ✘ [Line 2:1] bad thing: BAD new [fake-bad] (Fake)\n  ★ [Line 3:3] a hint [7]</new-diagnostics>)");
    const rows = t.events.filter((e) => e.type === "diagnostics").map(({ at, ...e }) => e);
    assert.deepEqual(rows, [{ type: "diagnostics", files: [{ path: "o.py", problems: [{ severity: "error", line: 1, column: 1, message: "bad thing: BAD old", code: "fake-bad", source: "Fake" }] }, { path: "s.py", problems: [{ severity: "error", line: 2, column: 1, message: "bad thing: BAD new", code: "fake-bad", source: "Fake" }, { severity: "hint", line: 3, column: 3, message: "a hint", code: "7", source: "" }] }] }]);
    assert.ok(t.events.findIndex((e) => e.type === "diagnostics") > t.events.findIndex((e) => e.type === "result" && e.id === "b1"), "after the step it came with");
    assert.equal(t.events.find((e) => e.type === "result" && e.id === "e1").problems, undefined, "not under the edit's own step");
    assert.equal(starts, 2, "the keeper asked for before the lookup and the edit");
    // A REPORT AFTER THE TURN'S LAST STEP: kept by the keeper, and given with the owner's next message. WHAT WAS SENT IS
    // REMEMBERED FOR THE WHOLE CHAT: o.py, reported again but not edited, is not new; the edited s.py's problems are sent again
    // (an edit forgets what was sent for its file), as in Claude Code.
    t = await run([say("", [call("edit", { path: "s.py", old_string: "HINT x", new_string: "z = 3\nWARN" }, "e2")]), say("done")]);
    assert.deepEqual(t.notes, [], "nothing in this turn: the report came after its last step");
    await sleep(1200);
    t = await run([say("done")]);
    assert.deepEqual(t.notes, ["(Note from Coder's app, not the owner:\n<new-diagnostics>The following new diagnostic issues were detected:\n\ns.py:\n  ✘ [Line 2:1] bad thing: BAD new [fake-bad] (Fake)\n  ⚠ [Line 4:1] a warning (Fake)</new-diagnostics>)"]);
    assert.equal(t.events.filter((e) => e.type === "diagnostics").length, 1);
    // A lookup changes nothing: nothing new.
    t = await run([say("", [call("lsp", { operation: "hover", filePath: "s.py", line: 1, character: 1 }, "l2")]), say("", [call("bash", { command: "sleep 0.3", description: "Wait" }, "b2")]), say("done")]);
    assert.deepEqual(t.notes, [], "nothing new");
    // An agent with no shell (a Gloopy helper): the text goes to the server, no note and no take.
    const helper = A.CODER_TOOLS.filter((x) => ["read", "write", "edit"].includes(x.function.name));
    t = await run([say("", [call("write", { path: "s.py", content: "BAD helper\n" }, "w1")]), say("done")], {}, { tools: helper });
    await sleep(1200);
    assert.deepEqual(t.notes, []);
    assert.ok(p.log().filter((m) => m.method === "textDocument/didChange").some((m) => m.params.contentChanges[0].text === "BAD helper\n"), "its server has the new text");
    // With no keeper for the chat (deps.lsp absent): nothing is taken, and nothing waits.
    t = await run([say("", [call("bash", { command: "sleep 0.1", description: "Wait" }, "b3")]), say("done")], { lsp: undefined });
    assert.deepEqual(t.notes, []);
  } finally { await k.stop(); }
});

test("LS11 in Coder's loop: the hooks get Claude Code's input (no file_path) and its result object; the step names the file as the project does; a Read ask rule asks in Claude Code's words (\"Coder requested permissions to read from …\"); a long answer reaches Grok whole (not cut at 12,000 characters), the chat's copy is cut; a lookup may take the job's time left (Claude Code's calls have no limit of their own), as a lookup", async () => {
  const hookCalls = [], execs = [];
  const facts = { operation: "findReferences", result: "R".repeat(50_000), filePath: "src/a.py", resultCount: 1, fileCount: 1 };
  const exec = async (x) => {
    if (x.hook === true) { const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
    const m = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
    if (m) { const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); execs.push({ ...x, req }); return req.tool === "lsp" ? { code: 0, output: T.printedAnswer({ text: facts.result, facts }) } : { code: 0, output: "ok" }; }
    return { code: 0, output: "ok\n" };
  };
  let n = 0;
  const events = [], cards = [], seen = [];
  const r = await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return [say("", [call("lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 5 }, "l1")]), say("done")][Math.min(n++, 1)]; },
    exec, emit: (e) => events.push(e), here: () => "/w/shop", root: "/w/shop", where: (p) => (p.startsWith("/") ? p : "/w/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "go", messages: [], rules: { allow: [], ask: ["Read(src/**)"], deny: [] }, hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "post.sh" }] }] } }, "settings").list });
  const pre = hookCalls.find((h) => h.hook_event_name === "PreToolUse");
  assert.equal(pre.tool_name, "LSP");
  assert.deepEqual(pre.tool_input, { operation: "findReferences", filePath: "src/a.py", line: 1, character: 5 });
  const post = hookCalls.find((h) => h.hook_event_name === "PostToolUse");
  assert.deepEqual(post.tool_response, facts);
  assert.equal(cards.length, 1);
  // (In Claude Code's words, its read check's, as Grep's and Glob's cards: round 3, 2026-11-14.)
  assert.equal(cards[0].why, "Coder requested permissions to read from /w/shop/src/a.py, but you haven't granted it yet.");
  assert.equal(events.find((e) => e.type === "bash" && e.id === "l1").command, "findReferences src/a.py:1:5");
  // (What Grok was sent: the saved chat keeps less, as for every long answer.)
  const answer = seen[1].messages.find((m) => m.tool_call_id === "l1").content;
  assert.ok(answer.startsWith("R".repeat(50_000)), "whole");
  assert.ok(events.find((e) => e.type === "result" && e.id === "l1").output.length < 13_000, "the chat keeps its usual share");
  const look = execs.find((x) => x.req.tool === "lsp");
  assert.deepEqual([look.kind, look.here], ["lsp", true]);
  assert.ok(look.timeoutS > 2600 && look.timeoutS <= A.CODER_MAX_MS / 1000, "the job's time left: " + look.timeoutS);
  assert.equal(A.LSP_EXEC_MIN_S, 60);
  assert.deepEqual(execs.map((x) => x.req.tool), ["lsp_file", "lsp"], "its file checked first, then the lookup; no take without a keeper");
  // The hooks' input for read, write and edit keeps Claude Code's file_path beside Coder's path; lsp's has none to add.
  assert.deepEqual(H.hookToolInput("lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }), { operation: "hover", filePath: "a.py", line: 1, character: 1 });
  assert.deepEqual(H.toolInputFromHook("lsp", { operation: "hover", filePath: "b.py", line: 2, character: 1 }), { operation: "hover", filePath: "b.py", line: 2, character: 1 });
  assert.equal(H.hookToolInput("read", { path: "a.py" }).file_path, "a.py");
});

test("LS12 the keeper: in a folder only its user may open, named for the project; a call never starts one (where none runs, each lookup starts its server and stops it, and a write tells none); it has no idle stop of its own, as Claude Code keeps a session's servers; it stops when asked, its socket going first; a stale socket is taken over", async () => {
  const home = await mkdtemp(join(tmpdir(), "coder-lsphome-"));
  const p = await project({ "a.py": "x = 1\n" });
  const sock = await L.socketFor(p.dir, home);
  assert.match(sock, new RegExp("^" + home + "/\\.coder-lsp/[0-9a-f]{16}\\.sock$"));
  assert.equal(await L.socketFor(p.dir, home), sock, "the same for the same project");
  assert.notEqual(await L.socketFor(p.dir + "x", home), sock);
  assert.equal(statSync(join(home, ".coder-lsp")).mode & 0o777, 0o700);
  assert.equal(await L.socketFor(p.dir, "relative/home"), null);
  // Not private: no keeper can run; each lookup starts its server and stops it.
  await chmod(join(home, ".coder-lsp"), 0o755);
  assert.equal(await L.socketFor(p.dir, home), null);
  await p.script({ "textDocument/hover": { contents: "per call" } });
  const once = (extra = {}) => tool(p.dir, "lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }, { ...p.env, HOME: home, ...extra });
  assert.equal(A.factsAnswer(once().out).text, "per call");
  assert.equal(A.factsAnswer(once().out).text, "per call");
  assert.equal(p.log().filter((m) => m.start).length, 2, "a server per call");
  await sleep(300);
  assert.equal(p.log().filter((m) => m.method === "exit").length, 2, "each stopped");
  // (A server program that is not there, with no keeper: Claude Code's error for it.)
  assert.equal(A.factsAnswer(once({ PATH: "/usr/bin:/bin" }).out).text, 'Error performing hover: Executable not found in $PATH: "pyright-langserver"');
  await chmod(join(home, ".coder-lsp"), 0o700);
  // A private folder but no keeper: the call starts none (Coder's machine starts it), and a write's sync goes nowhere.
  assert.equal(A.factsAnswer(once().out).text, "per call");
  assert.ok(!existsSync(sock), "no keeper started by a call");
  assert.equal(await L.syncAfterWrite({ abs: join(p.dir, "a.py"), text: "BAD\n" }, { root: p.dir }), false);
  assert.equal(await L.takeNews(p.dir), null, "nothing to take from");
  // A keeper (CODER_LSP_IDLE_MS unset): still there after a while with nothing to do.
  const k = await keeper(p, { HOME: home });
  await sleep(1500);
  assert.ok(k.alive(), "no idle stop");
  const ping = await L.askKeeper(sock, { op: "ping" }, 2000);
  assert.deepEqual([ping.ok, ping.root, ping.pid], [true, p.dir, k.proc.pid]);
  await L.askKeeper(sock, { op: "stop" }, 5000);
  for (let i = 0; i < 50 && k.alive(); i++) await sleep(50);
  assert.ok(!k.alive() && !existsSync(sock), "stopped when asked");
  // The tests' own knob: an idle stop after CODER_LSP_IDLE_MS.
  const k2 = await keeper(p, { HOME: home, CODER_LSP_IDLE_MS: "700" });
  await sleep(1600);
  assert.ok(!k2.alive() && !existsSync(sock), "gone after idling, with the knob");
  // A stale socket (nothing listening on it): taken over by a new keeper.
  await writeFile(sock, "");
  const { serveKeeper } = L;
  let exited = null;
  const k3 = await serveKeeper(p.dir, sock, { idle: 0, exit: (c) => { exited = c; } });
  try { assert.equal((await L.askKeeper(sock, { op: "ping" }, 2000)).pid, process.pid); } finally { await k3.close(0); }
  assert.equal(exited, 0);
  assert.ok(!existsSync(sock));
  // Closing while an answer is under way: its socket goes at once, the answer is still given, then its servers stop and it
  // ends. (A lookup whose server is slow to start.)
  await p.script({ slowInit: 1200, "textDocument/hover": { contents: "slow" } });
  await withEnv(p.env, async () => {
    let ended = null;
    const k4 = await L.serveKeeper(p.dir, sock, { idle: 0, exit: (c) => { ended = c; } });
    const under = L.askKeeper(sock, { op: "lookup", file: join(p.dir, "a.py"), operation: "hover", line: 1, character: 1 }, 10_000);
    await sleep(300);
    const closing = k4.close(0);
    await sleep(50);
    assert.ok(!existsSync(sock), "its socket gone at once");
    assert.equal(ended, null, "not ended while an answer is under way");
    assert.deepEqual(await under, { ok: true, result: { contents: "slow" } });
    await closing;
    assert.equal(ended, 0);
  });
  // A sync is answered at once, the work going on in the keeper (Claude Code's Write sends the text and goes on).
  await p.script({ slowInit: 1500 });
  await withEnv(p.env, async () => {
    const k5 = await L.serveKeeper(p.dir, sock, { idle: 0, exit: () => {} });
    try {
      const t0 = Date.now();
      assert.deepEqual(await L.askKeeper(sock, { op: "sync", file: join(p.dir, "a.py"), text: "BAD 5\n" }, 5000), { ok: true });
      assert.ok(Date.now() - t0 < 1000, "not waiting for the server's start or report");
      assert.deepEqual(await L.askKeeper(sock, { op: "take" }, 5000), { ok: true, pending: [], notices: [] }, "nothing yet");
      await sleep(2200);
      const taken = await L.askKeeper(sock, { op: "take" }, 5000);
      assert.equal(taken.pending[0].files[0].diagnostics[0].message, "bad thing: BAD 5");
    } finally { await k5.close(0); }
  });
});

test("LS13 Coder's machine starts the chat's keeper as the AI's user, as a background command is started, and keeps it at each turn's end as it keeps those: none of the chat's background commands (not listed, keeps no machine awake); a second call finds it running", async () => {
  const S = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-lspw-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-lspg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-lspm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-lspb-")) };
  const project = "lsp-keeper-1";
  const dir = join(roots.root, project);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "a.py"), "x = 1\n");
  const aside = await mkdtemp(join(tmpdir(), "coder-lspfake-"));
  // The AI's home, with the stand-in servers on the AI's PATH (its ~/.local/bin), and their log and script through the owner's
  // variables, as on Coder's machine.
  const home = await mkdtemp(join(tmpdir(), "coder-lsphome-"));
  await mkdir(join(home, ".local", "bin"), { recursive: true });
  for (const name of ["pyright-langserver", "typescript-language-server"]) { await writeFile(join(home, ".local", "bin", name), "#!/bin/sh\nexec node " + JSON.stringify(join(FAKE, "fake-lsp.mjs")) + " \"$@\"\n"); await chmod(join(home, ".local", "bin", name), 0o755); }
  const vars = { FAKE_LSP_LOG: join(aside, "log.jsonl"), FAKE_LSP_SCRIPT: join(aside, "script.json") };
  await writeFile(vars.FAKE_LSP_SCRIPT, JSON.stringify({ "textDocument/hover": { contents: "kept" } }));
  const steps = [say("", [call("lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }, "l1")]), say("", [call("lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }, "l2")]), say("Done.", [])];
  let n = 0;
  const app = S.createApp({ ...roots, home, send: async () => steps[Math.min(n++, steps.length - 1)] });
  const http = await import("node:http");
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "go", messages: [], setup: { vars } }) });
    let st;
    for (let i = 0; i < 300; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await sleep(100); }
    const res = (id) => (st.events.find((e) => e.type === "result" && e.id === id) || {}).output || "";
    assert.equal(res("l1"), "kept");
    assert.equal(res("l2"), "kept");
    assert.ok(S.keeperAlive(project), "running after the turn's end");
    const k = S.LSP_KEEPERS.get(project);
    assert.ok(Number.isInteger(k.pid) && k.pid > 0);
    const log = readFileSync(vars.FAKE_LSP_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.equal(log.filter((m) => m.start).length, 1, "one server, the keeper's, for both lookups");
    assert.equal(log.find((m) => m.start).projectDir, dir, "CLAUDE_PROJECT_DIR, the chat's project");
    assert.deepEqual(st.result.background, [], "none of the chat's background commands");
    assert.equal(S.busyState(new Map()).busy, false, "it keeps no machine awake");
  } finally {
    srv.close();
    await withEnv({ HOME: home }, () => L.stopKeeper(dir)).catch(() => {});
    for (let i = 0; i < 100 && S.keeperAlive(project); i++) await sleep(50);
  }
  assert.ok(!S.keeperAlive(project), "one that ended is forgotten");
  // QUIETLY, for real as root, with a user id of the test's own as the AI's: a keeper's process group is kept (paused, then
  // continued) where the AI's other processes end, as a running background command's is. (Not the machine's dev: other runs on
  // this machine may have processes as dev.)
  if (!(process.getuid && process.getuid() === 0)) return;
  const AI = 47123;
  const asAI = (code) => spawn(process.execPath, ["-e", code], { uid: AI, gid: AI, detached: true, stdio: "ignore", cwd: "/" });
  const lone = asAI("setInterval(() => {}, 1000)"), keeperLike = asAI("require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); setInterval(() => {}, 1000)"), stray = asAI("setInterval(() => {}, 1000)");
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const group = (pgid) => readdirSync("/proc").filter((x) => /^\d+$/.test(x)).filter((x) => { try { return readFileSync("/proc/" + x + "/stat", "utf8").replace(/^\d+ \(.*\) /, "").split(" ")[2] === String(pgid); } catch { return false; } }).map(Number);
  await sleep(600);
  const servers = group(keeperLike.pid).filter((x) => x !== keeperLike.pid);
  assert.equal(servers.length, 1, "the keeper-like process started one of its own, in its group");
  S.LSP_KEEPERS.set("lsp-keeper-2", { pid: keeperLike.pid, box: false });
  try {
    const go = await S.quietly({ uid: AI, gid: AI });
    assert.equal(typeof go, "function");
    go();
    await sleep(300);
    assert.ok(alive(keeperLike.pid) && alive(servers[0]), "the keeper and what it started go on");
    assert.ok(!alive(stray.pid) && !alive(lone.pid), "the AI's other processes ended");
  } finally {
    for (const c of [lone, keeperLike, stray]) { try { process.kill(-c.pid, "SIGKILL"); } catch { /* gone */ } }
    S.LSP_KEEPERS.delete("lsp-keeper-2");
  }
});

test("LS14 LSP(param:value) deny and ask rules, as Claude Code's \"Match by input parameter\" (Grep's and Glob's way): operation, line, character and query; never filePath, its primary content field, which is kept, never matches, and is warned of in Claude Code's words", () => {
  const P = permsMod;
  assert.deepEqual(P.parseRule("LSP(operation:hover)"), { tool: "LSP", spec: "operation:hover", param: { name: "operation", value: "hover" } });
  assert.deepEqual(P.parseRule("LSP(line : 3)").param, { name: "line", value: "3" }, "whitespace around the colon ignored");
  assert.equal(P.parseRule("LSP(filePath:src/a.ts)"), null);
  assert.equal(P.ruleKept("LSP(filePath:src/a.ts)"), true);
  assert.equal(P.ruleSaved("LSP(operation:*)"), true);
  assert.deepEqual(P.ruleWarning("deny", "LSP(filePath:src/a.ts)"), { warning: 'Permission deny rule "LSP(filePath:src/a.ts)" targets filePath as a raw string and will not match — use LSP(…) for LSP\'s own matcher.', notice: "Deny rule LSP(filePath:src/a.ts) never matches · use LSP(…)" });
  assert.equal(P.ruleWarning("allow", "LSP(filePath:src/a.ts)"), null, "only deny and ask rules are warned of");
  const input = (o) => ({ operation: "hover", filePath: "a.py", line: 1, character: 1, ...o });
  const dec = (rules, o) => P.fileToolDecision("lsp", "/w/a.py", { rules: { allow: [], ask: [], deny: [], ...rules }, root: "/w", input: input(o) });
  assert.deepEqual(dec({ deny: ["LSP(operation:hover)"] }), { verdict: "deny", rule: "LSP(operation:hover)", why: "Permission to use LSP with operation:hover has been denied." });
  assert.equal(dec({ deny: ["LSP(operation:hover)"] }, { operation: "findReferences" }).verdict, "");
  assert.equal(dec({ deny: ["LSP(operation:*Calls)"] }, { operation: "incomingCalls" }).verdict, "deny", "* matches any text");
  assert.equal(dec({ deny: ["LSP(query:*)"] }).verdict, "", "a parameter left out is never matched");
  assert.equal(dec({ deny: ["LSP(query:*)"] }, { query: "Cart" }).verdict, "deny");
  assert.equal(dec({ deny: ["LSP(filePath:a.py)"] }).verdict, "", "never filePath");
  assert.deepEqual(dec({ ask: ["LSP(line:1)"] }), { verdict: "ask", rule: "LSP(line:1)", why: "Coder requested permissions to use LSP, but you haven't granted it yet." });
  assert.equal(dec({ ask: ["LSP(line:1)"] }, { line: 2 }).verdict, "");
  assert.equal(dec({ ask: ["LSP(line:1)"], deny: ["Read(./a.py)"] }).verdict, "deny", "a deny rule on its file first");
  assert.equal(dec({ allow: ["LSP(operation:hover)"], deny: ["LSP(operation:hover)"] }).verdict, "deny", "an allow rule approves nothing here");
});

test("LS15 the chat shows Claude Code's row for every note: \"Found N new diagnostic issues in M files\", all its files counted, the issues a tap away with Claude Code's marks; the owner's values are hidden in it when saved", async () => {
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const body = ui.slice(ui.indexOf("  function diagnosticsHTML(e, i) {"), ui.indexOf("\n  }\n", ui.indexOf("  function diagnosticsHTML(e, i) {")) + 4);
  const S = { open: {} };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const make = new Function("S", "esc", body + "\nreturn diagnosticsHTML;");
  const draw = make(S, esc);
  const e = { type: "diagnostics", files: [{ path: "src/a.ts", problems: [{ severity: "error", line: 2, column: 5, message: "Type 'string' is not <assignable>", code: "2322", source: "typescript" }, { severity: "warning", line: 3, column: 1, message: "unused", code: "", source: "" }] }, { path: "b.py", problems: [{ severity: "hint", line: 1, column: 1, message: "h", code: "", source: "Pyright" }] }] };
  assert.match(draw(e, 7), /^<div class="cd-probs"><button type="button" class="cd-probs-row" data-problems="diag:7">Found 3 new diagnostic issues in 2 files<span>Show<\/span><\/button><\/div>$/);
  assert.match(draw({ files: [{ path: "x.py", problems: [{ severity: "error", line: 1, column: 1, message: "m" }] }] }, 1), />Found 1 new diagnostic issue in 1 file</);
  assert.equal(draw({ files: [] }, 1), "");
  S.open["diag:7"] = true;
  const open = draw(e, 7);
  assert.ok(open.includes("<pre class=\"cd-probs-list\">src/a.ts:\n  ✘ [Line 2:5] Type 'string' is not &lt;assignable&gt; [2322] (typescript)\n  ⚠ [Line 3:1] unused\n\nb.py:\n  ★ [Line 1:1] h (Pyright)</pre>"), open);
  assert.match(ui, /else if \(e\.type === 'diagnostics'\) out\.push\(diagnosticsHTML\(e, i\)\);/);
  // Saved with the owner's values hidden, its paths too.
  const { hideIn } = await import("../src/coder-routes.mjs");
  const [h] = hideIn([{ type: "diagnostics", files: [{ path: "sk-secret-1/a.py", problems: [{ severity: "error", line: 1, column: 1, message: "BAD sk-secret-1", code: "sk-secret-1", source: "sk-secret-1" }] }] }], ["sk-secret-1"]);
  assert.deepEqual(h.files, [{ path: "[hidden]/a.py", problems: [{ severity: "error", line: 1, column: 1, message: "BAD [hidden]", code: "[hidden]", source: "[hidden]" }] }]);
});
