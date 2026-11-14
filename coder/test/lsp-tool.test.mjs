// CLAUDE CODE'S LSP TOOL IN CODER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; LSP stays and
// becomes Claude Code's computer (plugin) version, for Coder's two servers): its description, inputs and input check, its
// requests and result texts, gitignored results left out, its errors, its servers kept running by a keeper on the chat's
// machine (60-second requests, restarts after a crash, 50 open files), and its diagnostics after writes and edits.
// The language servers are stood in for (test/fixtures/fake-lsp): the real ones may not be installed where the tests run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile, chmod, rm, truncate } from "node:fs/promises";
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const L = await import("../container/coder-lsp.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const T = await import("../container/coder-tools.mjs");
const I = await import("../container/coder-inputs.mjs");
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
  assert.equal(I.inputCheckFor("lsp"), L.checkInput);
  // Its servers: Claude Code's official typescript-lsp and pyright-lsp plugins'.
  assert.deepEqual(L.LSP_SERVERS.typescript, { command: "typescript-language-server", args: ["--stdio"], extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact", ".mts": "typescript", ".cts": "typescript", ".mjs": "javascript", ".cjs": "javascript" } });
  assert.deepEqual(L.LSP_SERVERS.pyright, { command: "pyright-langserver", args: ["--stdio"], extensionToLanguage: { ".py": "python", ".pyi": "python" } });
  assert.equal(L.serverFor("A.PY").name, "pyright", "extensions match whatever their case");
  // The machine's copy holds the keeper (CD78 loads every import from the copied files).
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-lsp.mjs coder-lspd.mjs "));
});

test("LS2 a call is checked as Claude Code checks its input, before any hook, card or run, refused in its words (\"InputValidationError: LSP failed due to the following issue: …\"): missing, then unexpected, then wrongly typed, then the rest", async () => {
  const ok = { operation: "findReferences", filePath: "a.py", line: 1, character: 1 };
  assert.deepEqual(L.checkInput(ok), { args: ok });
  assert.deepEqual(L.checkInput({ ...ok, query: "add" }), { args: { ...ok, query: "add" } });
  assert.equal(L.checkInput({ ...ok, line: undefined }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe required parameter `line` is missing");
  assert.equal(L.checkInput({ operation: "definition", filePath: "a.py", column: 3, line: 2 }).error, "error: InputValidationError: LSP failed due to the following issues:\nThe required parameter `character` is missing\nAn unexpected parameter `column` was provided\nThe parameter `operation` is invalid: Invalid option: expected one of \"goToDefinition\"|\"findReferences\"|\"hover\"|\"documentSymbol\"|\"workspaceSymbol\"|\"goToImplementation\"|\"prepareCallHierarchy\"|\"incomingCalls\"|\"outgoingCalls\"");
  assert.equal(L.checkInput({ ...ok, filePath: 7, line: "3", character: 1.5, query: null }).error, "error: InputValidationError: LSP failed due to the following issues:\nThe parameter `filePath` type is expected as `string` but provided as `number`\nThe parameter `line` type is expected as `number` but provided as `string`\nThe parameter `character` type is expected as `int` but provided as `number`\nThe parameter `query` type is expected as `string` but provided as `null`");
  assert.equal(L.checkInput({ ...ok, line: 0 }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `line` is invalid: Too small: expected number to be >0");
  assert.equal(L.checkInput({ ...ok, character: [1] }).error, "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `character` type is expected as `number` but provided as `array`");
  assert.equal(L.checkInput({ ...ok, path: "a.py", file_path: "a.py" }).error, "error: InputValidationError: LSP failed due to the following issues:\nAn unexpected parameter `path` was provided\nAn unexpected parameter `file_path` was provided");
  // In Coder's loop: refused before any PreToolUse hook, nothing run; the step shows it.
  const events = [], hooksRun = [], ran = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => [say("", [call("lsp", { operation: "hover", filePath: "a.py", column: 3 }, "l1")]), say("done")][Math.min(n++, 1)],
    exec: async (x) => { if (x.hook) { hooksRun.push(x); return { code: 0, output: "" }; } ran.push(x.command); return { code: 0, output: "" }; },
    emit: (e) => events.push(e), here: () => "/w/shop", root: "/w/shop", where: (p) => (p.startsWith("/") ? p : "/w/shop/" + p),
  }, { text: "go", messages: [], hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "LSP", hooks: [{ type: "command", command: "pre.sh" }] }] } }, "settings").list });
  assert.equal(r.messages.find((m) => m.tool_call_id === "l1").content, "error: InputValidationError: LSP failed due to the following issues:\nThe required parameter `line` is missing\nThe required parameter `character` is missing\nAn unexpected parameter `column` was provided");
  assert.equal(hooksRun.length, 0, "no hook ran");
  assert.ok(!ran.some((c) => c.includes("coder-tools.mjs")), "nothing ran");
  const step = events.find((e) => e.type === "bash" && e.id === "l1");
  assert.deepEqual([step.verb, step.command], ["Looked up", "hover a.py"]);
  assert.deepEqual([events.find((e) => e.type === "result" && e.id === "l1").code, events.find((e) => e.type === "result" && e.id === "l1").ran], [-1, false]);
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
  assert.deepEqual(f("hover", { contents: { kind: "markdown", value: "```ts\nfunction add(a: number): number\n```" }, range: { start: { line: 0, character: 16 } } }), { formatted: "Hover info at 1:17:\n```ts\nfunction add(a: number): number\n```", resultCount: 1, fileCount: 1 });
  assert.equal(f("hover", { contents: ["a", { language: "ts", value: "b" }] }).formatted, "a\nb");
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
  try { await assert.rejects(L.lookupIn(mgr, { file, operation: "hover", line: 1, character: 1 }), { message: 'Executable not found in $PATH: "no-such-server-xyz"' }); } finally { await mgr.shutdown(2000); }
});

test("LS9 the tool on Coder's machine: Claude Code's answers and errors, its result object for the hooks behind FACTS_MARK, one server kept for the chat by the keeper, results over 100,000 characters saved with their start shown; Coder's own rule kept (inside the project, never .git)", async () => {
  const p = await project({ "src/a.py": "x = 1\nprint(x)\n", "Gemfile.rb": "puts 1\n", "src/sub/keep.py": "y = 2\n" });
  const at = (l, c) => ({ uri: "$URI", range: { start: { line: l, character: c }, end: { line: l, character: c + 1 } } });
  await p.script({ "textDocument/references": [at(0, 0), at(1, 6)], "textDocument/definition": [at(0, 0)] });
  try {
    const r = tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env);
    assert.equal(r.code, 0);
    const fa = A.factsAnswer(r.out);
    assert.equal(fa.text, "Found 2 references across 1 files:\n\nsrc/a.py:\n  Line 1:1\n  Line 2:7");
    assert.deepEqual(fa.facts, { operation: "findReferences", result: fa.text, filePath: "src/a.py", resultCount: 2, fileCount: 1 });
    // From a folder below: paths from there; one server for the chat.
    const r2 = tool(p.dir, "lsp", { operation: "goToDefinition", filePath: "a.py", line: 2, character: 7 }, p.env, { CODER_CWD: join(p.dir, "src") });
    assert.equal(A.factsAnswer(r2.out).text, "Defined in a.py:1:1");
    assert.equal(p.log().filter((m) => m.start).length, 1, "the keeper's server answered both");
    assert.ok(existsSync(join(process.env.HOME, ".coder-lsp")), "the keeper's folder");
    // Claude Code's errors: the file's checks fail the call; the rest are answers.
    const e = (args, extra) => tool(p.dir, "lsp", { operation: "hover", line: 1, character: 1, ...args }, p.env, extra);
    assert.deepEqual(e({ filePath: "src/nope.py" }), { code: 1, out: "error: File does not exist: src/nope.py" });
    assert.deepEqual(e({ filePath: "src" }), { code: 1, out: "error: Path is not a file: src" });
    assert.deepEqual(e({ filePath: "" }), { code: 1, out: "error: Path is not a file: " });
    assert.deepEqual(e({ filePath: "/etc/hostname" }), { code: 1, out: "error: that path is outside the project" });
    assert.deepEqual(e({ filePath: ".git/config" }), { code: 1, out: "error: the .git folder is off limits" });
    assert.deepEqual(e({ filePath: "src/a.py", line: 0 }), { code: 1, out: "error: InputValidationError: LSP failed due to the following issue:\nThe parameter `line` is invalid: Too small: expected number to be >0" });
    const rb = e({ filePath: "Gemfile.rb" });
    assert.equal(rb.code, 0);
    assert.deepEqual(A.factsAnswer(rb.out), { text: "No LSP server available for file type: .rb", facts: { operation: "hover", result: "No LSP server available for file type: .rb", filePath: "Gemfile.rb" } });
    await writeFile(join(p.dir, "big.py"), "");
    await truncate(join(p.dir, "big.py"), 10_500_001);
    assert.equal(A.factsAnswer(e({ filePath: "big.py" }).out).text, "File too large for LSP analysis (11MB exceeds 10MB limit)");
    assert.equal(A.factsAnswer(e({ filePath: "src/sub/keep.py" }, { PATH: "/usr/bin:/bin" }).out).text, 'Error performing hover: Executable not found in $PATH: "pyright-langserver"', "no server program: Claude Code's error, no keeper");
    // Over 100,000 characters: saved whole, its start shown, as Claude Code persists a long result.
    await p.script({ "textDocument/references": Array.from({ length: 9000 }, (_, i) => ({ uri: "file://" + join(p.dir, "src", "f" + i + ".py"), range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } } })) });
    const long = A.factsAnswer(tool(p.dir, "lsp", { operation: "findReferences", filePath: "src/a.py", line: 1, character: 1 }, p.env).out);
    assert.ok(long.facts.result.length > 100_000, "the hooks get it whole");
    const m = /^<persisted-output>\nOutput too large \((\d+(?:\.\d)?KB)\)\. Full output saved to: (\/tmp\/coder-scratch\/lsp-[0-9a-f]{9}\.txt)\n\nPreview \(first 2KB\):\nFound 9000 references across 9000 files:\n[\s\S]*\n\.\.\.\n<\/persisted-output>$/.exec(long.text);
    assert.ok(m, long.text.slice(0, 300));
    assert.equal(readFileSync(m[2], "utf8"), long.facts.result);
    await rm(m[2], { force: true });
  } finally { await L.stopKeeper(p.dir); }
});

test("LS10 what the servers report after a write or an edit goes to Grok after the round, Claude Code's note inside the round's note; the next call takes what came in later; reports for files a lookup opened come too; an agent with no shell only sends the text", async () => {
  const p = await project({ "s.py": "ok = 1\n", "o.py": "BAD old\n" });
  await p.script({ "textDocument/hover": { contents: "x" } });
  const exec = async (x) => {
    const m = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
    if (!m) return { code: 0, output: "ok\n" };
    const r = spawnSync("bash", ["-c", x.command], { cwd: p.dir, env: p.env, encoding: "utf8", timeout: 60_000 });
    return { code: r.status, output: String(r.stdout || "") };
  };
  const run = async (calls, extra = {}) => {
    let n = 0;
    const events = [];
    const r = await A.runCoder({ send: async () => [say("", calls), say("done")][Math.min(n++, 1)], exec, emit: (e) => events.push(e), here: () => p.dir, root: p.dir, where: (q) => (q.startsWith("/") ? q : p.dir + "/" + q), ...extra }, { text: "go", messages: [] });
    return { r, events };
  };
  try {
    // A lookup opens o.py; its report comes in after; the write's report and o.py's go together after the round.
    let t = await run([call("lsp", { operation: "hover", filePath: "o.py", line: 1, character: 1 }, "l1")]);
    assert.equal(t.r.messages.find((m) => m.tool_call_id === "l1").content, "x");
    await sleep(400);
    t = await run([call("edit", { path: "s.py", old_string: "ok = 1", new_string: "ok = 1\nBAD new\nHINT x" }, "e1")]);
    const at = t.r.messages.findIndex((m) => m.tool_call_id === "e1");
    assert.equal(t.r.messages[at].content, "The file s.py has been updated successfully.");
    assert.equal(t.r.messages[at + 1].content, "(Note from Coder's app, not the owner, about your last commands:\n<new-diagnostics>The following new diagnostic issues were detected:\n\no.py:\n  ✘ [Line 1:1] bad thing: BAD old [fake-bad] (Fake)\n\ns.py:\n  ✘ [Line 2:1] bad thing: BAD new [fake-bad] (Fake)\n  ★ [Line 3:3] a hint [7]</new-diagnostics>)");
    assert.deepEqual(t.events.find((e) => e.type === "result" && e.id === "e1").problems, [{ severity: "error", line: 2, column: 1, message: "bad thing: BAD new", code: "fake-bad" }, { severity: "hint", line: 3, column: 3, message: "a hint", code: "7" }]);
    // The same problems are sent again after the next edit of the file (Claude Code forgets what it sent for an edited file).
    t = await run([call("edit", { path: "s.py", old_string: "HINT x", new_string: "z = 3" }, "e2")]);
    assert.match(t.r.messages.find((m) => m.role === "user" && /new-diagnostics/.test(m.content)).content, /s\.py:\n {2}✘ \[Line 2:1\] bad thing: BAD new \[fake-bad\] \(Fake\)<\/new-diagnostics>\)$/);
    // An agent with no shell (a Gloopy helper): the text goes to the server, no note; the write's answer is the write's alone.
    const helper = A.CODER_TOOLS.filter((x) => ["read", "write", "edit"].includes(x.function.name));
    let n = 0;
    const events = [];
    const r = await A.runCoder({ send: async () => [say("", [call("write", { path: "s.py", content: "BAD helper\n" }, "w1")]), say("done")][Math.min(n++, 1)], exec, emit: (e) => events.push(e), here: () => p.dir, root: p.dir, where: (q) => (q.startsWith("/") ? q : p.dir + "/" + q) }, { text: "go", messages: [], tools: helper });
    assert.ok(!r.messages.some((m) => m.role === "user" && /new-diagnostics/.test(String(m.content))), "no note for an agent without a shell");
    assert.equal(events.find((e) => e.type === "result" && e.id === "w1").problems, undefined);
    await sleep(400);
    assert.ok(p.log().filter((m) => m.method === "textDocument/didChange").some((m) => m.params.contentChanges[0].text === "BAD helper\n"), "its server has the new text");
  } finally { await L.stopKeeper(p.dir); }
});

test("LS11 in Coder's loop: the hooks get Claude Code's input (no file_path) and its result object; the step names the file as the project does; a Read ask rule asks \"for reading\"; a long answer reaches Grok whole (not cut at 12,000 characters), the chat's copy is cut; the call may take LSP_EXEC_S, as a lookup", async () => {
  const hookCalls = [], execs = [];
  const facts = { operation: "findReferences", result: "R".repeat(50_000), filePath: "src/a.py", resultCount: 1, fileCount: 1 };
  const exec = async (x) => {
    if (x.hook === true) { const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
    if (/coder-tools\.mjs/.test(String(x.command))) { execs.push(x); return { code: 0, output: T.printedAnswer({ text: facts.result + L.LSP_NOTE_MARK + "<new-diagnostics>The following new diagnostic issues were detected:\n\na.py:\n  ✘ [Line 1:1] e</new-diagnostics>", facts }) }; }
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
  assert.equal(cards[0].why, "Your rule Read(src/**) asks first for reading /w/shop/src/a.py.");
  assert.equal(events.find((e) => e.type === "bash" && e.id === "l1").command, "findReferences src/a.py:1:5");
  // (What Grok was sent: the saved chat keeps less, as for every long answer.)
  const answer = seen[1].messages.find((m) => m.tool_call_id === "l1").content;
  assert.ok(answer.startsWith("R".repeat(50_000)), "whole");
  assert.ok(!answer.includes("new-diagnostics"), "the note is not in the answer");
  assert.equal(seen[1].messages.find((m) => m.role === "user" && /new-diagnostics/.test(m.content)).content, "(Note from Coder's app, not the owner, about your last commands:\n<new-diagnostics>The following new diagnostic issues were detected:\n\na.py:\n  ✘ [Line 1:1] e</new-diagnostics>)");
  assert.ok(events.find((e) => e.type === "result" && e.id === "l1").output.length < 13_000, "the chat keeps its usual share");
  assert.deepEqual([execs[0].timeoutS, execs[0].kind], [A.LSP_EXEC_S, "lsp"]);
  assert.equal(A.LSP_EXEC_S, 200);
  // The hooks' input for read, write and edit keeps Claude Code's file_path beside Coder's path; lsp's has none to add.
  assert.deepEqual(H.hookToolInput("lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }), { operation: "hover", filePath: "a.py", line: 1, character: 1 });
  assert.deepEqual(H.toolInputFromHook("lsp", { operation: "hover", filePath: "b.py", line: 2, character: 1 }), { operation: "hover", filePath: "b.py", line: 2, character: 1 });
  assert.equal(H.hookToolInput("read", { path: "a.py" }).file_path, "a.py");
});

test("LS12 the keeper: in a folder only its user may open, named for the project; none where that folder is not private (each call then starts its server and stops it); it stops after idling, or when asked, and a stale socket is taken over", async () => {
  const home = await mkdtemp(join(tmpdir(), "coder-lsphome-"));
  const p = await project({ "a.py": "x = 1\n" });
  const sock = await L.socketFor(p.dir, home);
  assert.match(sock, new RegExp("^" + home + "/\\.coder-lsp/[0-9a-f]{16}\\.sock$"));
  assert.equal(await L.socketFor(p.dir, home), sock, "the same for the same project");
  assert.notEqual(await L.socketFor(p.dir + "x", home), sock);
  assert.equal(statSync(join(home, ".coder-lsp")).mode & 0o777, 0o700);
  assert.equal(await L.socketFor(p.dir, "relative/home"), null);
  // Not private: no keeper; the call still answers, its server started and stopped for it.
  await chmod(join(home, ".coder-lsp"), 0o755);
  assert.equal(await L.socketFor(p.dir, home), null);
  await p.script({ "textDocument/hover": { contents: "per call" } });
  const once = () => tool(p.dir, "lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }, { ...p.env, HOME: home });
  assert.equal(A.factsAnswer(once().out).text, "per call");
  assert.equal(A.factsAnswer(once().out).text, "per call");
  assert.equal(p.log().filter((m) => m.start).length, 2, "a server per call");
  assert.equal(p.log().filter((m) => m.method === "exit").length, 2, "each stopped");
  await chmod(join(home, ".coder-lsp"), 0o700);
  // A keeper: started by the first call, stops after idling (CODER_LSP_IDLE_MS), its socket gone.
  assert.equal(A.factsAnswer(tool(p.dir, "lsp", { operation: "hover", filePath: "a.py", line: 1, character: 1 }, { ...p.env, HOME: home, CODER_LSP_IDLE_MS: "1500" }).out).text, "per call");
  const ping = await L.askKeeper(sock, { op: "ping" }, 2000);
  assert.deepEqual([ping.ok, ping.root], [true, p.dir]);
  await sleep(3500);
  assert.ok(!existsSync(sock), "gone after idling");
  assert.equal(p.log().filter((m) => m.method === "exit").length, 3, "its server stopped with it");
  // A stale socket (nothing listening on it): taken over by a new keeper.
  await writeFile(sock, "");
  const { serveKeeper } = L;
  let exited = null;
  const k = await serveKeeper(p.dir, sock, { idle: 60_000, exit: (c) => { exited = c; } });
  try { assert.equal((await L.askKeeper(sock, { op: "ping" }, 2000)).pid, process.pid); } finally { await k.close(0); }
  assert.equal(exited, 0);
  assert.ok(!existsSync(sock));
  // Closing while an answer is under way: its socket goes at once (a call from then on starts a new keeper), the answer is
  // still given, then its servers stop and it ends.
  await p.script({ noReport: true });
  await withEnv(p.env, async () => {
    let ended = null;
    const k2 = await L.serveKeeper(p.dir, sock, { idle: 60_000, exit: (c) => { ended = c; } });
    const under = L.askKeeper(sock, { op: "sync", file: join(p.dir, "a.py"), text: "x = 2\n", deliver: true, waitMs: 1500 }, 10_000);
    await sleep(400);
    const closing = k2.close(0);
    await sleep(50);
    assert.ok(!existsSync(sock), "its socket gone at once");
    assert.equal(ended, null, "not ended while an answer is under way");
    assert.deepEqual(await under, { ok: true, pending: [] });
    await closing;
    assert.equal(ended, 0);
  });
});
