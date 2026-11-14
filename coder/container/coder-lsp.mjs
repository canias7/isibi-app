// CODER'S LSP TOOL, AS CLAUDE CODE'S COMPUTER (PLUGIN) VERSION (the owner, 2026-11-14: "start fixing and filling in gaps on
// those tools"; LSP stays and becomes Claude Code's plugin version, for Coder's two servers). Claude Code's own texts, inputs,
// results and errors (its 2.1.323 program, where its docs say nothing), with the servers its official typescript-lsp and
// pyright-lsp plugins start:
//   .ts .tsx .js .jsx .mts .cts .mjs .cjs  typescript-language-server --stdio
//   .py .pyi                               pyright-langserver --stdio
// A server runs for the whole chat, as Claude Code keeps one per language for its session: Coder's tool script runs once
// per call, so a small keeper (coder-lspd.mjs) holds the servers on the chat's machine, as the same user and inside the same
// sandbox as the call that started it; the script talks to it over a socket in a folder only that user can open. It stops
// after a while with nothing to do, and Coder's end of a turn stops it with all the AI's other processes. Where it cannot
// run, each call starts its server, asks, and stops it.
import { spawn } from "node:child_process";
import { open, stat, lstat, mkdir, writeFile, unlink, access } from "node:fs/promises";
import { constants } from "node:fs";
import { createConnection, createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { extname, relative, resolve, basename, join, isAbsolute, delimiter } from "node:path";
import { kbSize } from "./coder-checks.mjs";

// ── WHAT GROK IS TOLD ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Claude Code 2.1.323's own description of its LSP tool, word for word (the owner, 2026-11-14). */
export const LSP_DESCRIPTION = `Interact with Language Server Protocol (LSP) servers to get code intelligence features.
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
Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.`;
export const LSP_OPERATIONS = Object.freeze(["goToDefinition", "findReferences", "hover", "documentSymbol", "workspaceSymbol", "goToImplementation", "prepareCallHierarchy", "incomingCalls", "outgoingCalls"]);
/**
 * Its inputs and their descriptions, word for word; required as Claude Code's are, and nothing else taken (its input is a
 * strict object). (Claude Code's `line` and `character` are positive integers, `exclusiveMinimum: 0` in its schema: that
 * bound is checked by checkInput here, in Claude Code's words, and left out of what Grok's API compiles.)
 */
export const LSP_PROPERTIES = Object.freeze({
  operation: { type: "string", enum: [...LSP_OPERATIONS], description: "The LSP operation to perform" },
  filePath: { type: "string", description: "The absolute or relative path to the file" },
  line: { type: "integer", description: "The line number (1-based, as shown in editors)" },
  character: { type: "integer", description: "The character offset (1-based, as shown in editors)" },
  query: { type: "string", description: "The symbol name or partial name to search for (workspaceSymbol only). Most language servers return no results for an empty query, so always provide it when using workspaceSymbol." },
});
export const LSP_REQUIRED = Object.freeze(["operation", "filePath", "line", "character"]);

// ── THE SERVERS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Claude Code's official typescript-lsp and pyright-lsp plugins' servers, as their marketplace entries give them. */
export const LSP_SERVERS = Object.freeze({
  typescript: { command: "typescript-language-server", args: ["--stdio"], extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact", ".mts": "typescript", ".cts": "typescript", ".mjs": "javascript", ".cjs": "javascript" } },
  pyright: { command: "pyright-langserver", args: ["--stdio"], extensionToLanguage: { ".py": "python", ".pyi": "python" } },
});
/** The server for a file, by its extension (lower case, as Claude Code matches them): `{ name, command, args, extensionToLanguage }`, or null. */
export function serverFor(path, servers = LSP_SERVERS) {
  const ext = extname(String(path || "")).toLowerCase();
  for (const [name, c] of Object.entries(servers)) if (Object.keys(c.extensionToLanguage).some((e) => e.toLowerCase() === ext)) return { name, ...c };
  return null;
}

// Claude Code's numbers (its 2.1.323 program and plugins reference): results up to 100,000 characters (maxResultSizeChars);
// a file over 10 MB is not opened; a request waits 60 seconds ("requestTimeout … Defaults to 60000"); a ContentModified
// answer is asked again three times, 0.5, 1 and 2 seconds apart; a server that crashes is started again at the next request,
// at most three times in a row ("maxRestarts", 3); at most 50 files open at once ("LRU with 50-doc cap"); diagnostics: at
// most 10 for a file and 30 in all, their text cut at 4,000 characters.
export const LSP_RESULT_MAX = 100_000, LSP_FILE_MAX = 10_000_000, LSP_REQUEST_MS = 60_000, LSP_MAX_RESTARTS = 3, LSP_OPEN_MAX = 50;
export const DIAG_PER_FILE = 10, DIAG_TOTAL = 30, DIAG_NOTE_CHARS = 4000, DIAG_DELIVERED_MAX = 500;
const CONTENT_MODIFIED = -32801, RETRIES = 3, RETRY_MS = 500;
// Claude Code's protocol limits: "accepts message headers up to 64 KiB and a message body up to 32 MiB".
const HEADER_MAX = 64 * 1024, BODY_MAX = 32 * 1024 * 1024;
/**
 * CODER'S OWN TIME LIMITS (no Claude Code number: its calls have none, Coder's tool commands do): a server gets 60 seconds
 * to start (told in Claude Code's words for its startupTimeout), and the tool waits 195 seconds in all for the keeper; after
 * a write or an edit, it waits at most 20 seconds for the server's report, taken once the server has been quiet 0.8 seconds.
 */
export const LSP_STARTUP_MS = 60_000, LSP_CALL_MS = 195_000, SYNC_WAIT_MS = 20_000, SETTLE_MS = 800;

// ── THE INPUT, CHECKED AS CLAUDE CODE CHECKS IT ─────────────────────────────────────────────────────────────────────────
const KNOWN_INPUTS = ["operation", "filePath", "line", "character", "query"];
/** A value's type in zod's words ("received string", "received array"). */
const zodType = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isNaN(v) ? "nan" : typeof v);
/**
 * THE LSP TOOL'S INPUT, AS CLAUDE CODE TAKES IT (coder-inputs.mjs; the owner, 2026-11-14: "start fixing and filling in gaps on
 * those tools"): a strict object, refused before any hook in Claude Code's words ("InputValidationError: LSP failed due to the
 * following issue:\nThe required parameter `line` is missing"), its issues in Claude Code's order: missing parameters, then
 * unexpected ones, then wrong types, then the rest ("The parameter `operation` is invalid: Invalid option: …").
 */
export function checkInput(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const missing = [], unexpected = [], types = [], other = [];
  if (!LSP_OPERATIONS.includes(a.operation)) other.push("The parameter `operation` is invalid: Invalid option: expected one of " + LSP_OPERATIONS.map((o) => '"' + o + '"').join("|"));
  if (a.filePath === undefined) missing.push("filePath"); else if (typeof a.filePath !== "string") types.push(["filePath", "string", zodType(a.filePath)]);
  for (const k of ["line", "character"]) {
    const v = a[k];
    if (v === undefined) missing.push(k);
    else if (typeof v !== "number" || Number.isNaN(v)) types.push([k, "number", zodType(v)]);
    else if (!Number.isInteger(v)) types.push([k, "int", "number"]);
    else if (!Number.isSafeInteger(v)) { other.push("The parameter `" + k + "` is invalid: " + (v > 0 ? "Too big: expected int to be <=" + Number.MAX_SAFE_INTEGER : "Too small: expected int to be >=" + Number.MIN_SAFE_INTEGER)); if (v < 0) other.push("The parameter `" + k + "` is invalid: Too small: expected number to be >0"); }
    else if (v <= 0) other.push("The parameter `" + k + "` is invalid: Too small: expected number to be >0");
  }
  if (a.query !== undefined && typeof a.query !== "string") types.push(["query", "string", zodType(a.query)]);
  for (const k of Object.keys(a)) if (!KNOWN_INPUTS.includes(k)) unexpected.push(k);
  const lines = [
    ...missing.map((k) => "The required parameter `" + k + "` is missing"),
    ...unexpected.map((k) => "An unexpected parameter `" + k + "` was provided"),
    ...types.map(([k, want, got]) => "The parameter `" + k + "` type is expected as `" + want + "` but provided as `" + got + "`"),
    ...other.slice(0, 20),
    ...(other.length > 20 ? ["(" + (other.length - 20) + " more issue" + (other.length - 20 === 1 ? "" : "s") + " not listed)"] : []),
  ];
  if (!lines.length) return { args: a };
  return { error: "error: InputValidationError: LSP failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n") };
}

// ── WHAT A CALL ASKS THE SERVER (Claude Code's own requests) ────────────────────────────────────────────────────────────
/** The request for an operation: line and character counted from 1 by Grok, from 0 by the server. */
export function requestFor({ operation, line, character, query }, file) {
  const uri = pathToFileURL(file).href, position = { line: line - 1, character: character - 1 };
  switch (operation) {
    case "goToDefinition": return { method: "textDocument/definition", params: { textDocument: { uri }, position } };
    case "findReferences": return { method: "textDocument/references", params: { textDocument: { uri }, position, context: { includeDeclaration: true } } };
    case "hover": return { method: "textDocument/hover", params: { textDocument: { uri }, position } };
    case "documentSymbol": return { method: "textDocument/documentSymbol", params: { textDocument: { uri } } };
    case "workspaceSymbol": return { method: "workspace/symbol", params: { query: query ?? "" } };
    case "goToImplementation": return { method: "textDocument/implementation", params: { textDocument: { uri }, position } };
    default: return { method: "textDocument/prepareCallHierarchy", params: { textDocument: { uri }, position } };
  }
}

// ── WHAT A CALL ANSWERS (Claude Code's formatters, word for word) ───────────────────────────────────────────────────────
const KINDS = { 1: "File", 2: "Module", 3: "Namespace", 4: "Package", 5: "Class", 6: "Method", 7: "Property", 8: "Field", 9: "Constructor", 10: "Enum", 11: "Interface", 12: "Function", 13: "Variable", 14: "Constant", 15: "String", 16: "Number", 17: "Boolean", 18: "Array", 19: "Object", 20: "Key", 21: "Null", 22: "EnumMember", 23: "Struct", 24: "Event", 25: "Operator", 26: "TypeParameter" };
const kindName = (k) => KINDS[k] || "Unknown";
const plural = (n, w) => (n === 1 ? w : w + "s");
/** A file's name in an answer: from `root` when that is shorter and not two folders up, else in full (Claude Code's). */
export function formatUri(uri, root) {
  if (!uri) return "<unknown location>";
  let p = String(uri).startsWith("file://") ? String(uri).slice(7) : String(uri);
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  try { p = decodeURIComponent(p); } catch { /* left as it is */ }
  if (root) { const r = relative(root, p).replaceAll("\\", "/"); if (r.length < p.length && !r.startsWith("../../")) return r; }
  return p.replaceAll("\\", "/");
}
const isLink = (e) => !!e && typeof e === "object" && "targetUri" in e;
const fromLink = (e) => (isLink(e) ? { uri: e.targetUri, range: e.targetSelectionRange || e.targetRange } : e);
const loc = (e, root) => formatUri(e.uri, root) + ":" + (e.range.start.line + 1) + ":" + (e.range.start.character + 1);
function byFile(list, root) {
  const m = new Map();
  for (const s of list) { const k = formatUri("uri" in s ? s.uri : s.location.uri, root); if (m.has(k)) m.get(k).push(s); else m.set(k, [s]); }
  return m;
}
const NO_DEFINITION = "No definition found. This may occur if the cursor is not on a symbol, or if the definition is in an external library not indexed by the LSP server.";
function fmtDefinitions(r, root) {
  if (!r) return NO_DEFINITION;
  if (Array.isArray(r)) {
    const y = r.map(fromLink).filter((w) => w && w.uri);
    if (!y.length) return NO_DEFINITION;
    if (y.length === 1) return "Defined in " + loc(y[0], root);
    return "Found " + y.length + " definitions:\n" + y.map((w) => "  " + loc(w, root)).join("\n");
  }
  return "Defined in " + loc(fromLink(r), root);
}
const NO_REFERENCES = "No references found. This may occur if the symbol has no usages, or if the LSP server has not fully indexed the workspace.";
function fmtReferences(r, root) {
  if (!r || !r.length) return NO_REFERENCES;
  const s = r.filter((k) => k && k.uri);
  if (!s.length) return NO_REFERENCES;
  if (s.length === 1) return "Found 1 reference:\n  " + loc(s[0], root);
  const files = byFile(s, root), out = ["Found " + s.length + " references across " + files.size + " files:"];
  for (const [k, w] of files) { out.push("\n" + k + ":"); for (const v of w) out.push("  Line " + (v.range.start.line + 1) + ":" + (v.range.start.character + 1)); }
  return out.join("\n");
}
function hoverText(c) {
  if (Array.isArray(c)) return c.map((r) => (typeof r === "string" ? r : r.value)).join("\n");
  if (typeof c === "string") return c;
  return c.value;
}
function fmtHover(r) {
  if (!r) return "No hover information available. This may occur if the cursor is not on a symbol, or if the LSP server has not fully indexed the file.";
  const t = hoverText(r.contents);
  return r.range ? "Hover info at " + (r.range.start.line + 1) + ":" + (r.range.start.character + 1) + ":\n" + t : t;
}
function symbolLines(e, depth = 0) {
  let line = "  ".repeat(depth) + e.name + " (" + kindName(e.kind) + ")";
  if (e.detail) line += " " + e.detail;
  line += " - Line " + (e.range.start.line + 1);
  const out = [line];
  if (e.children && e.children.length) for (const c of e.children) out.push(...symbolLines(c, depth + 1));
  return out;
}
function fmtDocumentSymbols(r, root) {
  if (!r || !r.length) return "No symbols found in document. This may occur if the file is empty, not supported by the LSP server, or if the server has not fully indexed the file.";
  if (r[0] && "location" in r[0]) return fmtWorkspaceSymbols(r, root);
  const out = ["Document symbols:"];
  for (const y of r) out.push(...symbolLines(y));
  return out.join("\n");
}
const NO_WORKSPACE_SYMBOLS = "No symbols found in workspace. This may occur if the workspace is empty, or if the LSP server has not finished indexing the project.";
function fmtWorkspaceSymbols(r, root) {
  if (!r || !r.length) return NO_WORKSPACE_SYMBOLS;
  const s = r.filter((k) => k && k.location && k.location.uri);
  if (!s.length) return NO_WORKSPACE_SYMBOLS;
  const out = ["Found " + s.length + " " + plural(s.length, "symbol") + " in workspace:"];
  for (const [k, w] of byFile(s, root)) {
    out.push("\n" + k + ":");
    for (const v of w) out.push("  " + v.name + " (" + kindName(v.kind) + ") - Line " + (v.location.range.start.line + 1) + (v.containerName ? " in " + v.containerName : ""));
  }
  return out.join("\n");
}
function callItem(e, root) {
  if (!e.uri) return e.name + " (" + kindName(e.kind) + ") - <unknown location>";
  return e.name + " (" + kindName(e.kind) + ") - " + formatUri(e.uri, root) + ":" + (e.range.start.line + 1) + (e.detail ? " [" + e.detail + "]" : "");
}
export const NO_CALL_ITEM = "No call hierarchy item found at this position";
function fmtCallItems(r, root) {
  if (!r || !r.length) return NO_CALL_ITEM;
  if (r.length === 1) return "Call hierarchy item: " + callItem(r[0], root);
  return ["Found " + r.length + " call hierarchy items:", ...r.map((s) => "  " + callItem(s, root))].join("\n");
}
function fmtCalls(r, root, way) {
  const end = way === "incoming" ? "from" : "to";
  if (!r || !r.length) return way === "incoming" ? "No incoming calls found (nothing calls this function)" : "No outgoing calls found (this function calls nothing)";
  const out = ["Found " + r.length + " " + way + " " + plural(r.length, "call") + ":"], files = new Map();
  for (const h of r) { if (!h[end]) continue; const k = formatUri(h[end].uri, root); if (files.has(k)) files.get(k).push(h); else files.set(k, [h]); }
  for (const [k, list] of files) {
    out.push("\n" + k + ":");
    for (const c of list) {
      let row = "  " + c[end].name + " (" + kindName(c[end].kind) + ") - Line " + (c[end].range.start.line + 1);
      if (c.fromRanges && c.fromRanges.length) row += " [" + (way === "incoming" ? "calls at" : "called from") + ": " + c.fromRanges.map((m) => (m.start.line + 1) + ":" + (m.start.character + 1)).join(", ") + "]";
      out.push(row);
    }
  }
  return out.join("\n");
}
const distinctUris = (list) => new Set(list.map((r) => r.uri)).size;
const countSymbols = (list) => list.reduce((n, s) => n + (s.children && s.children.length ? countSymbols(s.children) : 0), list.length);
/** An operation's answer and its counts, as Claude Code's tool gives them (`formatted`, `resultCount`, `fileCount`). */
export function formatResult(operation, r, root) {
  switch (operation) {
    case "goToDefinition": case "goToImplementation": {
      const k = (Array.isArray(r) ? r : r ? [r] : []).map(fromLink).filter((w) => w && w.uri);
      return { formatted: fmtDefinitions(r, root), resultCount: k.length, fileCount: distinctUris(k) };
    }
    case "findReferences": { const y = (r || []).filter((k) => k && k.uri); return { formatted: fmtReferences(r, root), resultCount: y.length, fileCount: distinctUris(y) }; }
    case "hover": return { formatted: fmtHover(r), resultCount: r ? 1 : 0, fileCount: r ? 1 : 0 };
    case "documentSymbol": { const s = r || []; return { formatted: fmtDocumentSymbols(r, root), resultCount: s.length > 0 && s[0] && "range" in s[0] ? countSymbols(s) : s.length, fileCount: s.length > 0 ? 1 : 0 }; }
    case "workspaceSymbol": { const y = (r || []).filter((w) => w && w.location && w.location.uri); return { formatted: fmtWorkspaceSymbols(r, root), resultCount: y.length, fileCount: distinctUris(y.map((w) => w.location)) }; }
    case "prepareCallHierarchy": { const s = r || []; return { formatted: fmtCallItems(r, root), resultCount: s.length, fileCount: s.length ? new Set(s.map((h) => h.uri).filter(Boolean)).size : 0 }; }
    case "incomingCalls": { const s = r || []; return { formatted: fmtCalls(r, root, "incoming"), resultCount: s.length, fileCount: s.length ? new Set(s.map((h) => h.from?.uri).filter(Boolean)).size : 0 }; }
    case "outgoingCalls": { const s = r || []; return { formatted: fmtCalls(r, root, "outgoing"), resultCount: s.length, fileCount: s.length ? new Set(s.map((h) => h.to?.uri).filter(Boolean)).size : 0 }; }
    default: return { formatted: String(r), resultCount: 0, fileCount: 0 };
  }
}

// ── RESULTS FROM IGNORED FILES, LEFT OUT (Claude Code 2.1.47: "Fixed LSP findReferences and other location-based operations
// returning results from gitignored files (e.g., node_modules/, venv/)"): asked of git, 50 paths at a time, 5 seconds each.
const uriPath = (u) => { let r = String(u).replace(/^file:\/\//, ""); if (/^\/[A-Za-z]:/.test(r)) r = r.slice(1); try { r = decodeURIComponent(r); } catch { /* as it is */ } return r; };
function gitCheckIgnore(paths, cwd) {
  return new Promise((done) => {
    let out = "", p;
    try { p = spawn("git", ["check-ignore", ...paths], { cwd, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }); } catch { return done({ code: -1, stdout: "" }); }
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* gone */ } }, 5000);
    p.stdout.on("data", (b) => { if (out.length < 4 << 20) out += b; });
    p.on("error", () => { clearTimeout(t); done({ code: -1, stdout: "" }); });
    p.on("close", (code) => { clearTimeout(t); done({ code, stdout: out }); });
  });
}
export async function withoutIgnored(locations, cwd, check = gitCheckIgnore) {
  if (!locations.length) return locations;
  const paths = new Map();
  for (const k of locations) if (k.uri && !paths.has(k.uri)) paths.set(k.uri, uriPath(k.uri));
  const all = [...new Set(paths.values())];
  if (!all.length) return locations;
  const ignored = new Set();
  for (let i = 0; i < all.length; i += 50) {
    const v = await check(all.slice(i, i + 50), cwd);
    if (v.code === 0 && v.stdout) for (const l of v.stdout.split("\n")) { const x = l.trim(); if (x) ignored.add(x); }
  }
  if (!ignored.size) return locations;
  return locations.filter((k) => { const p = paths.get(k.uri); return !p || !ignored.has(p); });
}
async function filterResult(operation, x, cwd, check) {
  if (!Array.isArray(x) || !["findReferences", "goToDefinition", "goToImplementation", "workspaceSymbol"].includes(operation)) return x;
  if (operation === "workspaceSymbol") {
    const kept = new Set((await withoutIgnored(x.filter((w) => w?.location?.uri).map((w) => w.location), cwd, check)).map((w) => w.uri));
    return x.filter((w) => !w?.location?.uri || kept.has(w.location.uri));
  }
  const kept = new Set((await withoutIgnored(x.map(fromLink), cwd, check)).map((w) => w.uri));
  return x.filter((j) => { const w = fromLink(j); return !w.uri || kept.has(w.uri); });
}

// ── DIAGNOSTICS: KEPT, AND SENT ONCE (Claude Code's registry) ───────────────────────────────────────────────────────────
const SEVERITY = { 1: "Error", 2: "Warning", 3: "Info", 4: "Hint" };
const severityRank = (s) => ({ Error: 1, Warning: 2, Info: 3, Hint: 4 })[s] || 4;
/** A server's report as Claude Code keeps it: the file's path, and each problem with its severity's name. */
export function reportFiles(p) {
  let uri = p.uri;
  try { uri = String(p.uri).startsWith("file://") ? fileURLToPath(p.uri) : p.uri; } catch { /* the uri as it came */ }
  const diagnostics = (Array.isArray(p.diagnostics) ? p.diagnostics : []).filter((s) => s && typeof s === "object" && s.range && s.range.start).map((s) => ({
    message: String(s.message ?? ""), severity: SEVERITY[s.severity] || "Error",
    range: { start: { line: s.range.start.line, character: s.range.start.character }, end: { line: (s.range.end || s.range.start).line, character: (s.range.end || s.range.start).character } },
    source: s.source, code: s.code !== undefined && s.code !== null ? String(s.code) : undefined,
  }));
  return [{ uri, diagnostics }];
}
const diagKey = (d) => JSON.stringify({ message: d.message, severity: d.severity, range: d.range, source: d.source || null, code: d.code || null });
/**
 * WHAT THE SERVERS REPORTED, SENT ONCE (Claude Code 2.1.323's diagnostics registry): reports wait until they are taken; a
 * take leaves out what was already sent for that file since its last edit, puts errors first, and sends at most 10 for a
 * file and 30 in all. An edit forgets what was sent for that file, and the reports waiting for it.
 */
export class DiagnosticsRegistry {
  constructor() { this.pending = new Map(); this.delivered = new Map(); }
  register({ serverName, files }) { this.pending.set(randomUUID(), { serverName, files, sent: false }); }
  sentFor(uri) { if (!this.delivered.has(uri)) return undefined; const v = this.delivered.get(uri); this.delivered.delete(uri); this.delivered.set(uri, v); return v; }
  dedupe(list) {
    const byUri = new Map();
    for (const f of list) {
      let h = byUri.get(f.uri);
      if (!h) { h = { file: { uri: f.uri, diagnostics: [] }, seen: new Set(), before: this.sentFor(f.uri) || new Set() }; byUri.set(f.uri, h); }
      for (const d of f.diagnostics) { const k = diagKey(d); if (h.seen.has(k) || h.before.has(k)) continue; h.seen.add(k); h.file.diagnostics.push(d); }
    }
    return [...byUri.values()].map((h) => h.file).filter((f) => f.diagnostics.length);
  }
  takePending() {
    const all = [], servers = new Set(), taken = [];
    for (const x of this.pending.values()) if (!x.sent) { all.push(...x.files); servers.add(x.serverName); taken.push(x); }
    if (!all.length) return [];
    let files = this.dedupe(all);
    for (const x of taken) x.sent = true;
    for (const [k, x] of this.pending) if (x.sent) this.pending.delete(k);
    let n = 0;
    for (const f of files) {
      f.diagnostics.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      if (f.diagnostics.length > DIAG_PER_FILE) f.diagnostics = f.diagnostics.slice(0, DIAG_PER_FILE);
      const room = DIAG_TOTAL - n;
      if (f.diagnostics.length > room) f.diagnostics = f.diagnostics.slice(0, Math.max(0, room));
      n += f.diagnostics.length;
    }
    files = files.filter((f) => f.diagnostics.length);
    for (const f of files) {
      if (!this.delivered.has(f.uri)) { this.delivered.set(f.uri, new Set()); while (this.delivered.size > DIAG_DELIVERED_MAX) this.delivered.delete(this.delivered.keys().next().value); }
      const sent = this.delivered.get(f.uri);
      for (const d of f.diagnostics) sent.add(diagKey(d));
    }
    if (!files.length) return [];
    return [{ serverName: [...servers].join(", "), files }];
  }
  clearDeliveredForFile(uri) { this.delivered.delete(uri); }
  clearPendingForFile(uri) {
    for (const [k, x] of this.pending) {
      const keep = x.files.filter((f) => f.uri !== uri);
      if (keep.length === x.files.length) continue;
      if (!keep.length) this.pending.delete(k); else x.files = keep;
    }
  }
}
const ICONS = { Error: "✘", Warning: "⚠", Info: "ℹ", Hint: "★" };
/**
 * THE NOTE GROK GETS, CLAUDE CODE'S WORD FOR WORD: "<new-diagnostics>The following new diagnostic issues were detected:", a
 * blank line, then each file by the last part of its path, a problem a line ("  ✘ [Line 3:7] … [code] (source)"), files a
 * blank line apart, cut at 4,000 characters with "…[truncated]".
 */
export function diagnosticsNote(files) {
  let body = files.map((f) => (String(f.uri).split("/").pop() || f.uri) + ":\n" + f.diagnostics.map((k) => "  " + (typeof k.severity === "string" && Object.hasOwn(ICONS, k.severity) ? ICONS[k.severity] : "●") + " [Line " + (k.range.start.line + 1) + ":" + (k.range.start.character + 1) + "] " + k.message + (k.code ? " [" + k.code + "]" : "") + (k.source ? " (" + k.source + ")" : "")).join("\n")).join("\n\n");
  if (body.length > DIAG_NOTE_CHARS) body = body.slice(0, DIAG_NOTE_CHARS - 12) + "…[truncated]";
  return "<new-diagnostics>The following new diagnostic issues were detected:\n\n" + body + "</new-diagnostics>";
}
/** Where a tool's answer carries the diagnostics note for after the round (taken off by Coder's loop, never shown as is). */
export const LSP_NOTE_MARK = "\u0000coder-diagnostics\u0000";
/** An answer and its note: `{ text, note }`. */
export function noteAnswer(raw) {
  const s = String(raw ?? ""), k = s.indexOf(LSP_NOTE_MARK);
  return k < 0 ? { text: s, note: "" } : { text: s.slice(0, k), note: s.slice(k + LSP_NOTE_MARK.length) };
}

// ── ONE LANGUAGE SERVER (Claude Code's client and server instance) ──────────────────────────────────────────────────────
const withTimeout = (p, ms, why) => {
  let t;
  return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(why)), ms); })]).finally(() => clearTimeout(t));
};
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const HEADER_LINE = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)[ \t]*:[ \t]*([^\r\n]*)$/;
/** A message's header block, as Claude Code checks it: its length, or the protocol violation. */
function headerLength(text) {
  let len;
  for (const l of text.split("\r\n")) {
    const m = HEADER_LINE.exec(l), name = m && m[1].toLowerCase();
    if (!m || (name !== "content-length" && name !== "content-type")) return new Error("LSP server sent non-protocol output in the header block — its stdout is desynchronized from the base protocol (logs/banners on stdout instead of stderr?)");
    if (name === "content-length") len = m[2].trim();
  }
  if (len === undefined) return new Error("LSP server sent a header block without a Content-Length — its stdout is desynchronized from the base protocol (non-protocol output on stdout?)");
  if (!/^\d+$/.test(len)) return new Error("LSP server sent a Content-Length that is not a number — its stdout is desynchronized from the base protocol");
  const n = Number(len);
  if (n > BODY_MAX) return new Error("LSP server declared a message larger than the size limit — refusing to buffer it");
  return n;
}
/** Node's word for a program that is not there, as Claude Code's runtime says it ("Executable not found in $PATH: …"). */
const spawnError = (e, command) => (e && e.code === "ENOENT" ? new Error('Executable not found in $PATH: "' + command + '"') : e instanceof Error ? e : new Error(String(e)));
/** Is a program on PATH (Claude Code checks a server's binary the same way before it recommends a plugin)? */
export async function onPath(command, path = process.env.PATH) {
  if (command.includes("/")) return access(command, constants.X_OK).then(() => true, () => false);
  for (const d of String(path || "").split(delimiter).filter(Boolean)) {
    try { await access(join(d, command), constants.X_OK); const s = await stat(join(d, command)); if (s.isFile()) return true; } catch { /* not here */ }
  }
  return false;
}

/**
 * A LANGUAGE SERVER'S PROCESS AND ITS CONVERSATION (Claude Code 2.1.323's): stdio only, logs from its stderr dropped; a stdout
 * that breaks the protocol, or a message over the limits, disconnects it, counted as a crash; requests it sends us are
 * answered (configuration, capability registrations ignored, anything else "Unhandled method").
 */
class LspClient {
  constructor(name, onCrash) { this.name = name; this.onCrash = onCrash; this.conn = null; this.notes = new Map(); this.requests = new Map(); }
  get initialized() { const c = this.conn; return !!(c && c.proc && c.initialized && !c.failed); }
  /** Its process started: each start has a connection of its own, so a stop that ends late never touches a later one. */
  async start(command, args, { env, cwd }) {
    const conn = { proc: null, waiting: new Map(), id: 0, initialized: false, failed: null, stopping: false };
    this.conn = conn;
    let p;
    try { p = spawn(command, args, { stdio: ["pipe", "pipe", "ignore"], env, cwd, windowsHide: true }); } catch (e) { conn.failed = spawnError(e, command); throw conn.failed; }
    conn.proc = p;
    try { await new Promise((ok, no) => { p.once("spawn", ok); p.once("error", (e) => no(spawnError(e, command))); }); } catch (e) { conn.failed = e; conn.proc = null; throw e; }
    p.on("error", (e) => { if (!conn.stopping && !conn.failed) conn.failed = spawnError(e, command); });
    p.on("exit", (code, signal) => {
      if (conn.stopping || !conn.proc) return;
      const e = new Error("LSP server " + this.name + " crashed with " + (code === null ? "killed by signal " + signal : "exit code " + code));
      conn.failed = e; conn.initialized = false; conn.proc = null;
      this.reject(conn, e);
      if (this.conn === conn) this.onCrash(e);
    });
    p.stdin.on("error", () => { /* its end is the exit's to tell */ });
    this.reader(conn, p);
  }
  reader(conn, p) {
    let head = Buffer.alloc(0), want = -1, body = [], got = 0;
    const violation = (e) => {
      if (conn.proc !== p) return;
      conn.failed = e; conn.initialized = false; conn.proc = null;
      try { p.kill("SIGKILL"); } catch { /* gone */ }
      this.reject(conn, e);
      if (this.conn === conn) this.onCrash(e);
    };
    p.stdout.on("data", (chunk) => {
      let b = chunk;
      while (b && b.length && conn.proc === p) {
        if (want < 0) {
          const all = head.length ? Buffer.concat([head, b]) : b, at = all.indexOf("\r\n\r\n");
          if (at < 0) { head = all; if (head.length > HEADER_MAX) return violation(new Error("LSP server exceeded the header size limit without a message header — it is likely printing logs or other non-protocol output to stdout instead of stderr")); return; }
          const n = headerLength(all.subarray(0, at).toString("latin1"));
          if (n instanceof Error) return violation(n);
          head = Buffer.alloc(0); want = n; body = []; got = 0; b = all.subarray(at + 4);
          if (want === 0) { this.deliver(conn, Buffer.alloc(0)); want = -1; }
          continue;
        }
        const need = want - got;
        if (b.length < need) { body.push(b); got += b.length; return; }
        body.push(b.subarray(0, need));
        const msg = Buffer.concat(body, want);
        b = b.subarray(need); want = -1; body = []; got = 0;
        this.deliver(conn, msg);
      }
    });
  }
  deliver(conn, buf) {
    let m;
    try { m = JSON.parse(buf.toString("utf8")); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.method === undefined && m.id !== undefined) {
      const w = conn.waiting.get(m.id);
      if (!w) return;
      conn.waiting.delete(m.id);
      if (m.error) { const e = new Error(String(m.error.message || "request failed")); e.code = m.error.code; w.no(e); } else w.ok(m.result);
      return;
    }
    if (typeof m.method !== "string") return;
    if (m.id !== undefined) {
      const h = this.requests.get(m.method);
      Promise.resolve().then(() => (h ? h(m.params) : Promise.reject(Object.assign(new Error("Unhandled method " + m.method), { code: -32601 }))))
        .then((result) => this.send(conn, { jsonrpc: "2.0", id: m.id, result: result === undefined ? null : result }), (e) => this.send(conn, { jsonrpc: "2.0", id: m.id, error: { code: Number.isInteger(e && e.code) ? e.code : -32603, message: String((e && e.message) || e) } }));
      return;
    }
    if (this.conn !== conn) return;
    const h = this.notes.get(m.method);
    if (h) { try { h(m.params); } catch { /* a handler's own trouble */ } }
  }
  send(conn, o) { if (!conn.proc) return; const s = JSON.stringify(o); try { conn.proc.stdin.write("Content-Length: " + Buffer.byteLength(s) + "\r\n\r\n" + s); } catch { /* closed */ } }
  reject(conn, e) { for (const [, w] of conn.waiting) w.no(e); conn.waiting.clear(); }
  ask(conn, method, params) {
    if (!conn || !conn.proc) throw (conn && conn.failed) || new Error("LSP client not started");
    if (conn.failed) throw conn.failed;
    return new Promise((ok, no) => { const id = ++conn.id; conn.waiting.set(id, { ok, no }); this.send(conn, { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }); });
  }
  request(method, params) {
    const conn = this.conn;
    if (conn && conn.proc && !conn.failed && !conn.initialized && method !== "initialize") throw new Error("LSP server not initialized");
    return this.ask(conn, method, params);
  }
  notify(method, params) {
    const conn = this.conn;
    if (!conn || !conn.proc) throw (conn && conn.failed) || new Error("LSP client not started");
    if (conn.failed) throw conn.failed;
    this.send(conn, { jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }
  async initialize(params) { const conn = this.conn; const r = await this.ask(conn, "initialize", params); this.send(conn, { jsonrpc: "2.0", method: "initialized", params: {} }); conn.initialized = true; return r; }
  onNotification(method, f) { this.notes.set(method, f); }
  onRequest(method, f) { this.requests.set(method, f); }
  /** shutdown (with no params, Claude Code 2.1.31), then exit even when shutdown fails (2.1.269), then its process ended. */
  async stop(ms = 5000) {
    const conn = this.conn;
    if (!conn) return;
    conn.stopping = true;
    const p = conn.proc;
    if (p && p.exitCode === null && p.signalCode === null) {
      const bye = (async () => { try { await this.ask(conn, "shutdown"); } catch { /* exit all the same */ } this.send(conn, { jsonrpc: "2.0", method: "exit" }); })();
      try { await withTimeout(bye, Math.min(ms || 5000, 5000), "LSP server '" + this.name + "' timed out during shutdown"); } catch { /* ended below */ }
      // (A moment for it to leave on its own after `exit`, then ended.)
      if (p.exitCode === null && p.signalCode === null) await withTimeout(new Promise((ok) => p.once("exit", ok)), 1000, "").catch(() => {});
      if (p.exitCode === null && p.signalCode === null) { try { p.kill(); } catch { /* gone */ } }
    }
    conn.proc = null; conn.initialized = false;
    this.reject(conn, new Error("LSP server " + this.name + " stopped"));
  }
}

/**
 * ONE LANGUAGE SERVER AS CLAUDE CODE RUNS IT (its 2.1.323 server instance): started on first use; Claude Code's initialize
 * (its capabilities: UTF-16 positions, call hierarchy, document symbols in a tree), with Coder's own name for the client;
 * each request waits LSP_REQUEST_MS and is asked again on ContentModified; after a crash it is started again at the next
 * request, unless it crashed more than LSP_MAX_RESTARTS times in a row.
 */
export class LspServer {
  constructor(name, config, { root, requestMs = LSP_REQUEST_MS, startupMs = LSP_STARTUP_MS, maxRestarts = LSP_MAX_RESTARTS, env = process.env } = {}) {
    this.name = name; this.config = config; this.root = root; this.requestMs = requestMs; this.startupMs = startupMs; this.maxRestarts = maxRestarts; this.env = env;
    this.state = "stopped"; this.lastError = null; this.crashes = 0; this.gaveUp = false; this.starting = null;
    this.client = new LspClient(name, (e) => { this.state = "error"; this.lastError = e; this.crashes++; });
  }
  async start() {
    while (this.starting) await this.starting.catch(() => {});
    if (this.state === "running" || this.state === "starting") return;
    const p = this.startNow();
    this.starting = p.finally(() => { this.starting = null; });
    this.starting.catch(() => {});
    return p;
  }
  async startNow() {
    if (this.state === "error" && this.crashes > this.maxRestarts) {
      if (!this.gaveUp) { this.gaveUp = true; this.lastError = new Error("LSP server '" + this.name + "' exceeded max crash recovery attempts (" + this.maxRestarts + ")" + (this.lastError ? "; last crash: " + this.lastError.message : "")); }
      throw this.lastError;
    }
    try {
      this.state = "starting";
      await this.client.start(this.config.command, this.config.args || [], { env: { ...this.env, ...(this.config.env || {}) }, cwd: this.root });
      this.client.onRequest("workspace/configuration", (p) => (Array.isArray(p && p.items) ? p.items : []).map((i) => pick(this.config.settings, i && i.section)));
      this.client.onRequest("client/registerCapability", () => null);
      this.client.onRequest("client/unregisterCapability", () => null);
      const rootUri = pathToFileURL(this.root).href;
      const init = this.client.initialize({
        processId: process.pid,
        clientInfo: { name: "Coder" },
        initializationOptions: this.config.initializationOptions ?? {},
        workspaceFolders: [{ uri: rootUri, name: basename(this.root) }],
        rootPath: this.root, rootUri,
        capabilities: {
          workspace: { configuration: this.config.settings != null, workspaceFolders: false, didChangeWatchedFiles: { dynamicRegistration: false } },
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
        },
      });
      init.catch(() => {});
      if (this.startupMs) await withTimeout(init, this.startupMs, "LSP server '" + this.name + "' timed out after " + this.startupMs + "ms during initialization"); else await init;
      if (this.state !== "starting") throw this.lastError || new Error("LSP server crashed during startup");
      this.state = "running"; this.crashes = 0; this.gaveUp = false;
      if (this.config.settings != null) { try { this.client.notify("workspace/didChangeConfiguration", { settings: this.config.settings }); } catch { /* told at its next start */ } }
    } catch (e) {
      this.client.stop().catch(() => {});
      this.state = "error"; this.lastError = e;
      throw e;
    }
  }
  healthy() { return this.state === "running" && this.client.initialized; }
  async request(method, params) {
    if (!this.healthy()) throw new Error("Cannot send request to LSP server '" + this.name + "': server is " + this.state + (this.lastError ? ", last error: " + this.lastError.message : ""));
    const why = "no response after " + this.requestMs + "ms";
    let last;
    for (let at = 0; at <= RETRIES; at++) {
      try { return await withTimeout(this.client.request(method, params), this.requestMs, why); } catch (e) {
        last = e;
        if (e && e.code === CONTENT_MODIFIED && at < RETRIES) { await sleep(RETRY_MS * 2 ** at); continue; }
        break;
      }
    }
    throw Object.assign(new Error("LSP request '" + method + "' failed for server '" + this.name + "': " + ((last && last.message) || "unknown error")), { code: last && last.code });
  }
  notify(method, params) {
    if (!this.healthy()) throw new Error("Cannot send notification to LSP server '" + this.name + "': server is " + this.state);
    this.client.notify(method, params);
  }
  onNotification(method, f) { this.client.onNotification(method, f); }
  async stop(ms) {
    if (this.state === "stopped" || this.state === "stopping") return;
    this.state = "stopping";
    try { await this.client.stop(ms); } finally { if (this.state === "stopping") this.state = "stopped"; }
  }
}
/** A part of a server's settings by its dotted section (Claude Code's), or null. */
function pick(settings, section) {
  if (settings == null) return null;
  if (section === undefined || section === "") return settings;
  let r = settings;
  for (const s of String(section).split(".")) { if (r === null || typeof r !== "object" || !Object.prototype.hasOwnProperty.call(r, s)) return null; r = r[s]; }
  return r ?? null;
}

/**
 * THE SERVERS OF ONE PROJECT (Claude Code 2.1.323's server manager): one per language, by extension (the first registered
 * wins); files opened in it as Claude Code opens them (didOpen, didChange with the whole text, didSave), at most
 * LSP_OPEN_MAX at once (the oldest closed); every report a server publishes kept in `registry` unless it is empty or for an
 * older version of the file.
 */
export class LspManager {
  constructor(root, { servers = LSP_SERVERS, registry = new DiagnosticsRegistry(), requestMs, startupMs, maxRestarts, env } = {}) {
    this.root = root; this.registry = registry;
    this.servers = new Map(); this.byExt = new Map(); this.open = new Map(); this.versions = new Map(); this.published = new Map(); this.waiters = new Set();
    for (const [name, config] of Object.entries(servers)) {
      const s = new LspServer(name, config, { root, requestMs, startupMs, maxRestarts, env });
      this.servers.set(name, s);
      for (const e of Object.keys(config.extensionToLanguage)) { const k = e.toLowerCase(); if (!this.byExt.has(k)) this.byExt.set(k, []); this.byExt.get(k).push(name); }
      s.onNotification("textDocument/publishDiagnostics", (p) => this.published_(name, p));
    }
  }
  published_(name, p) {
    if (!p || typeof p !== "object" || !("uri" in p) || !("diagnostics" in p)) return;
    if (p.version !== undefined) { const v = this.versions.get(p.uri); if (v !== undefined && p.version < v) return; }
    const files = reportFiles(p);
    const path = files[0].uri;
    this.published.set(path, (this.published.get(path) || 0) + 1);
    for (const w of this.waiters) w(path);
    if (!files[0].diagnostics.length) return;
    if (this.servers.get(name)?.config?.diagnostics === false) return;
    this.registry.register({ serverName: name, files });
  }
  /** How many reports a server has published for a file so far (empty ones too). */
  publishCount(path) { return this.published.get(path) || 0; }
  /** Wait until a file has a report after `before`, then until its server is quiet SETTLE_MS, or `deadline`. */
  async settled(path, before, deadline, settleMs = SETTLE_MS) {
    let last = this.publishCount(path), changedAt = Date.now();
    const seen = () => this.publishCount(path) > before;
    await new Promise((done) => {
      let t = null;
      const finish = () => { if (t) clearTimeout(t); this.waiters.delete(w); done(); };
      const tick = () => {
        const now = Date.now();
        if (now >= deadline) return finish();
        if (seen() && now - changedAt >= settleMs) return finish();
        t = setTimeout(tick, Math.max(10, Math.min(seen() ? settleMs - (now - changedAt) : deadline - now, deadline - now)));
      };
      const w = (p) => { if (p !== path) return; const n = this.publishCount(path); if (n !== last) { last = n; changedAt = Date.now(); } if (t) clearTimeout(t); tick(); };
      this.waiters.add(w);
      tick();
    });
  }
  serverForFile(path) { const names = this.byExt.get(extname(path).toLowerCase()); return names && names.length ? this.servers.get(names[0]) : undefined; }
  async ensureStarted(path) {
    const s = this.serverForFile(path);
    if (!s) return undefined;
    // (One being started, by a write a moment ago, is waited for: Claude Code 2.1.0, "Fixed race condition where LSP tool
    // could return "no server available" during startup". A new process has none of the old one's files open.)
    if (s.state !== "running") { const was = s.client.conn; await s.start(); if (s.client.conn !== was) for (const [u, n] of this.open) if (n === s.name) this.open.delete(u); }
    return s;
  }
  touch(uri, name) { this.open.delete(uri); this.open.set(uri, name); }
  evict() {
    for (const [uri, name] of this.open) {
      if (this.open.size <= LSP_OPEN_MAX) return;
      this.open.delete(uri);
      const s = this.servers.get(name);
      if (s && s.state === "running") { try { s.notify("textDocument/didClose", { textDocument: { uri } }); } catch { /* closed with it */ } }
    }
  }
  nextVersion(uri) { const v = (this.versions.get(uri) || 0) + 1; this.versions.set(uri, v); return v; }
  async sendRequest(path, method, params) {
    const s = await this.ensureStarted(path);
    if (!s) return undefined;
    const uri = pathToFileURL(resolve(path)).href;
    if (this.open.get(uri) === s.name) this.touch(uri, s.name);
    return s.request(method, params);
  }
  async openFile(path, text) {
    const s = await this.ensureStarted(path);
    if (!s) return;
    const uri = pathToFileURL(resolve(path)).href;
    // (Opened meanwhile, by a call that waited for the same start: this text is the newer one, so it is sent as a change.)
    if (this.open.get(uri) === s.name) { this.touch(uri, s.name); s.notify("textDocument/didChange", { textDocument: { uri, version: this.nextVersion(uri) }, contentChanges: [{ text }] }); return; }
    s.notify("textDocument/didOpen", { textDocument: { uri, languageId: s.config.extensionToLanguage[extname(path).toLowerCase()] || "plaintext", version: this.nextVersion(uri), text } });
    this.touch(uri, s.name);
    this.evict();
  }
  async changeFile(path, text) {
    const s = this.serverForFile(path);
    const uri = pathToFileURL(resolve(path)).href;
    if (!s || s.state !== "running" || this.open.get(uri) !== s.name) return this.openFile(path, text);
    this.touch(uri, s.name);
    s.notify("textDocument/didChange", { textDocument: { uri, version: this.nextVersion(uri) }, contentChanges: [{ text }] });
  }
  async saveFile(path) {
    const s = this.serverForFile(path);
    const uri = pathToFileURL(resolve(path)).href;
    if (!s || s.state !== "running" || this.open.get(uri) !== s.name) return;
    s.notify("textDocument/didSave", { textDocument: { uri } });
  }
  isFileOpen(path) { const n = this.open.get(pathToFileURL(resolve(path)).href); return n !== undefined && this.servers.get(n)?.state === "running"; }
  async shutdown(ms) { await Promise.allSettled([...this.servers.values()].filter((s) => s.state === "running" || s.state === "error" || s.state === "starting").map((s) => s.stop(ms))); this.open.clear(); }
}

/**
 * ONE LOOKUP, AS CLAUDE CODE'S TOOL DOES IT: the file opened in its server first (one over 10 MB is not), the request, and
 * for incomingCalls and outgoingCalls the call hierarchy item at the position first. Answers `{ result }`, `{ tooLarge }`,
 * `{ noServer }` or `{ noItem }`; a failure is thrown.
 */
export async function lookupIn(mgr, { file, operation, line, character, query }) {
  const { method, params } = requestFor({ operation, line, character, query }, file);
  if (!mgr.isFileOpen(file)) {
    const fh = await open(file, "r");
    let text;
    try { const st = await fh.stat(); if (st.size > LSP_FILE_MAX) return { tooLarge: Math.ceil(st.size / 1e6) }; text = await fh.readFile({ encoding: "utf8" }); } finally { await fh.close(); }
    await mgr.openFile(file, text);
  }
  let x = await mgr.sendRequest(file, method, params);
  if (x === undefined) return { noServer: true };
  if (operation === "incomingCalls" || operation === "outgoingCalls") {
    if (!x || !x.length) return { noItem: true };
    x = await mgr.sendRequest(file, operation === "incomingCalls" ? "callHierarchy/incomingCalls" : "callHierarchy/outgoingCalls", { item: x[0] });
  }
  return { result: x === undefined ? null : x };
}
const messageOf = (e) => String((e && e.message) || e);

// ── THE KEEPER: THE SERVERS KEPT RUNNING FOR THE CHAT ───────────────────────────────────────────────────────────────────
/** How long the keeper waits with nothing to do before it stops (Coder's; under node's test runner, 3 seconds). */
export const IDLE_MS = 10 * 60 * 1000;
const idleMs = () => { const v = Number(process.env.CODER_LSP_IDLE_MS); return Number.isFinite(v) && v > 0 ? v : process.env.NODE_TEST_CONTEXT ? 3000 : IDLE_MS; };
/**
 * The keeper's socket for a project: in `$HOME/.coder-lsp`, a folder only this user may open (made so, and checked: a
 * plain folder of this user's, nothing for group or others), named for the project. Null where there is no such folder.
 */
export async function socketFor(root, home = process.env.HOME) {
  if (typeof home !== "string" || !isAbsolute(home)) return null;
  const dir = join(home, ".coder-lsp");
  try { await mkdir(dir, { mode: 0o700 }); } catch (e) { if (!e || e.code !== "EEXIST") return null; }
  let st;
  try { st = await lstat(dir); } catch { return null; }
  if (!st.isDirectory() || (typeof process.getuid === "function" && st.uid !== process.getuid()) || (st.mode & 0o077) !== 0) return null;
  const sock = join(dir, createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16) + ".sock");
  return Buffer.byteLength(sock) <= 100 ? sock : null;
}
/** One request to the keeper and its answer (a line of JSON each way), or the connection's error. */
export function askKeeper(sock, req, ms) {
  return new Promise((ok, no) => {
    let buf = "", done = false;
    const c = createConnection(sock);
    const end = (f, v) => { if (done) return; done = true; clearTimeout(t); try { c.destroy(); } catch { /* closed */ } f(v); };
    const t = setTimeout(() => end(no, Object.assign(new Error("no response after " + ms + "ms"), { code: "ETIMEDOUT" })), ms);
    c.setEncoding("utf8");
    c.on("connect", () => c.write(JSON.stringify(req) + "\n"));
    c.on("data", (d) => {
      buf += d;
      if (buf.length > 256 << 20) return end(no, new Error("the answer is too big"));
      const k = buf.indexOf("\n");
      if (k >= 0) { try { end(ok, JSON.parse(buf.slice(0, k))); } catch (e) { end(no, e); } }
    });
    c.on("error", (e) => end(no, e));
    c.on("close", () => end(no, Object.assign(new Error("the keeper closed the connection"), { code: "ECONNRESET" })));
  });
}
const KEEPER = fileURLToPath(new URL("./coder-lspd.mjs", import.meta.url));
/**
 * THE KEEPER'S ANSWER, STARTING IT WHEN NONE RUNS: started as a program of its own (node coder-lspd.mjs), apart from the call
 * (its own session, nothing of the call's output held open), so the call ends and the servers stay. Null when the keeper
 * cannot be used here (no private folder, or it did not come up): the caller then does the work itself.
 */
export async function keeperCall(root, req, ms) {
  const sock = await socketFor(root);
  if (!sock) return null;
  // (A keeper that is closing answers so, and is taken as none: a new one is started.)
  try { const r = await askKeeper(sock, req, ms); if (!(r && r.closing === true)) return r; } catch (e) { if (!e || !["ENOENT", "ECONNREFUSED"].includes(e.code)) throw e; }
  try {
    const p = spawn(process.execPath, ["--no-warnings", KEEPER, resolve(root), sock], { cwd: root, detached: true, stdio: "ignore", env: process.env });
    p.on("error", () => {});
    p.unref();
  } catch { return null; }
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    await sleep(40);
    try { const up = await askKeeper(sock, { op: "ping" }, 1000); if (up && up.closing === true) continue; return await askKeeper(sock, req, ms); } catch (e) { if (!e || !["ENOENT", "ECONNREFUSED"].includes(e.code)) throw e; }
  }
  return null;
}
/** The keeper of a project, stopped (its servers shut down first): for the tests. */
export async function stopKeeper(root) { const sock = await socketFor(root); if (!sock) return false; try { await askKeeper(sock, { op: "stop" }, 10_000); return true; } catch { return false; } }

/**
 * A REQUEST TO THE KEEPER: "lookup" (one call of the tool), "sync" (a file just written or edited: what was sent for it is
 * forgotten, its new text sent to its server, and, when `deliver`, the server's report waited for), "take" (what the servers
 * reported since), "ping", "stop". Every lookup and every sync that delivers takes what waits, as Claude Code takes it after
 * each step.
 */
export async function keeperAnswer(mgr, req) {
  const op = req && req.op;
  if (op === "ping") return { ok: true, pid: process.pid, root: mgr.root };
  if (op === "take") return { ok: true, pending: mgr.registry.takePending() };
  if (op === "stop") return { ok: true };
  if (op === "lookup") {
    let r;
    try { r = await lookupIn(mgr, req); } catch (e) { r = { error: messageOf(e) }; }
    return { ok: true, ...r, pending: mgr.registry.takePending() };
  }
  if (op === "sync") {
    const file = resolve(String(req.file || "")), text = String(req.text ?? "");
    if (!serverFor(file)) return { ok: true, pending: [] };
    mgr.registry.clearDeliveredForFile(file);
    mgr.registry.clearPendingForFile(file);
    const before = mgr.publishCount(file);
    const work = (async () => { await mgr.changeFile(file, text); await mgr.saveFile(file); })();
    work.catch(() => {});
    if (req.deliver !== true) return { ok: true, pending: [] };
    const deadline = Date.now() + Math.max(0, Math.min(Number(req.waitMs) || 0, SYNC_WAIT_MS));
    try { await withTimeout(work, Math.max(1, deadline - Date.now()), "waited"); } catch (e) { if (messageOf(e) !== "waited") return { ok: false, error: messageOf(e), pending: [] }; }
    await mgr.settled(file, before, deadline);
    return { ok: true, pending: mgr.registry.takePending() };
  }
  return { ok: false, error: "unknown request" };
}

/** THE KEEPER ITSELF (coder-lspd.mjs runs it): one project's servers, on its socket, until it has been idle IDLE_MS. */
export async function serveKeeper(root, sock, { idle = idleMs(), exit = (c) => process.exit(c) } = {}) {
  const mgr = new LspManager(root);
  let busy = 0, timer = null, closing = false;
  const server = createServer((c) => {
    let buf = "";
    c.setEncoding("utf8");
    c.on("error", () => {});
    c.on("data", async (d) => {
      buf += d;
      const k = buf.indexOf("\n");
      if (k < 0) { if (buf.length > 64 << 20) c.destroy(); return; }
      const line = buf.slice(0, k);
      buf = "";
      c.removeAllListeners("data");
      if (closing) { try { c.end(JSON.stringify({ ok: false, closing: true }) + "\n"); } catch { /* the caller left */ } return; }
      busy++; if (timer) { clearTimeout(timer); timer = null; }
      let ans;
      try { const req = JSON.parse(line); ans = await keeperAnswer(mgr, req); if (req && req.op === "stop") setImmediate(() => close(0)); } catch (e) { ans = { ok: false, error: messageOf(e) }; }
      busy--; arm();
      try { c.end(JSON.stringify(ans) + "\n"); } catch { /* the caller left */ }
    });
  });
  // CLOSING: its socket goes first (a call from now on starts a new keeper, whose socket this one never touches), the answers
  // under way are given, then its servers are shut down (shutdown, then exit) and it ends.
  const close = async (code) => {
    if (closing) return; closing = true;
    if (timer) { clearTimeout(timer); timer = null; }
    try { server.close(); } catch { /* closed */ }
    await unlink(sock).catch(() => {});
    for (let i = 0; busy > 0 && i < 400; i++) await sleep(25);
    await mgr.shutdown(5000).catch(() => {});
    await sleep(50);
    exit(code);
  };
  const arm = () => { if (timer) clearTimeout(timer); if (busy || closing) return; timer = setTimeout(() => close(0), idle); };
  const listen = () => new Promise((ok, no) => { server.once("error", no); server.listen(sock, () => { server.removeListener("error", no); ok(); }); });
  try { await listen(); } catch (e) {
    if (!e || e.code !== "EADDRINUSE") throw e;
    // Another keeper may already serve this project: if it answers, this one is not needed; if not, its socket is stale.
    try { await askKeeper(sock, { op: "ping" }, 1000); return exit(0); } catch { /* stale */ }
    await unlink(sock).catch(() => {});
    await listen();
  }
  arm();
  return { server, mgr, close };
}

// ── THE TOOL ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A RESULT OVER 100,000 CHARACTERS (Claude Code's maxResultSizeChars for LSP): saved whole in Coder's scratch folder, and
 * Grok told where, with its start, in Claude Code's words ("<persisted-output>\nOutput too large (…). Full output saved to:
 * …\n\nPreview (first 2KB):\n…\n...\n</persisted-output>").
 */
export async function persisted(text, dir) {
  await mkdir(dir, { recursive: true });
  const file = join(dir, "lsp-" + randomUUID().replace(/-/g, "").slice(0, 9) + ".txt");
  await writeFile(file, text, { flag: "wx", mode: 0o644 });
  const lastBreak = text.slice(0, 2000).lastIndexOf("\n");
  return "<persisted-output>\nOutput too large (" + kbSize(text.length) + "). Full output saved to: " + file + "\n\nPreview (first 2KB):\n" + text.slice(0, lastBreak > 1000 ? lastBreak : 2000) + "\n...\n</persisted-output>";
}

/**
 * THE LSP TOOL (coder-tools.mjs runs it, as the AI's user in the project): `{ text, facts, note }`: the answer for Grok,
 * Claude Code's result object for the hooks ({ operation, result, filePath, resultCount, fileCount }), and the diagnostics
 * note for after the round (what the servers reported and was not yet sent). `inside` keeps the file inside the project
 * (Coder's own rule, kept: no file outside it, none in .git); `root` is the project's folder (the servers' workspace),
 * `base` the folder Grok's commands are in (paths in answers are named from there), `scratch` where a long answer is kept.
 * A check that refuses throws (Grok gets "error: …"); every other answer is a result, as in Claude Code.
 */
export async function runLsp(args, { root, base = root, inside = async (p) => ({ abs: resolve(base, p) }), scratch = "/tmp/coder-scratch", callMs = LSP_CALL_MS, check } = {}) {
  const v = checkInput(args);
  if (v.error) throw new Error(v.error.replace(/^error: /, ""));
  const a = v.args;
  // (An empty path is the folder the commands are in, as Claude Code resolves it: not a file.)
  const { abs } = a.filePath === "" ? { abs: base } : await inside(a.filePath);
  let st;
  try { st = await stat(abs); } catch (e) { if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) throw new Error("File does not exist: " + a.filePath); throw new Error("Cannot access file: " + a.filePath + ". " + messageOf(e)); }
  if (!st.isFile()) throw new Error("Path is not a file: " + a.filePath);
  const answer = (result, counts = {}, note = "") => ({ text: result, facts: { operation: a.operation, result, filePath: a.filePath, ...counts }, note });
  if (st.size > LSP_FILE_MAX) return answer("File too large for LSP analysis (" + Math.ceil(st.size / 1e6) + "MB exceeds 10MB limit)");
  const s = serverFor(abs);
  if (!s) return answer("No LSP server available for file type: " + extname(abs));
  // (A server whose program is not installed: Claude Code's error for it, and no keeper started for nothing.)
  if (!(await onPath(s.command))) return answer("Error performing " + a.operation + ": " + 'Executable not found in $PATH: "' + s.command + '"');
  const req = { op: "lookup", file: abs, operation: a.operation, line: a.line, character: a.character, ...(a.query !== undefined ? { query: a.query } : {}) };
  let got;
  try { got = await keeperCall(root, req, callMs); } catch (e) { got = { ok: true, error: messageOf(e), pending: [] }; }
  if (!got) {
    // NO KEEPER HERE: the server for this one call, started, asked and stopped.
    const mgr = new LspManager(root);
    try { got = { ok: true, ...(await lookupIn(mgr, req).catch((e) => ({ error: messageOf(e) }))) }; got.pending = mgr.registry.takePending(); } finally { await mgr.shutdown(5000).catch(() => {}); }
  }
  const files = (Array.isArray(got.pending) ? got.pending : []).flatMap((p) => (p && Array.isArray(p.files) ? p.files : []));
  const note = files.length ? diagnosticsNote(files) : "";
  if (got.error !== undefined) return answer("Error performing " + a.operation + ": " + got.error, {}, note);
  if (got.tooLarge) return answer("File too large for LSP analysis (" + got.tooLarge + "MB exceeds 10MB limit)", {}, note);
  if (got.noServer) return answer("No LSP server available for file type: " + extname(abs), {}, note);
  if (got.noItem) return answer(NO_CALL_ITEM, { resultCount: 0, fileCount: 0 }, note);
  try {
    const x = await filterResult(a.operation, got.result, root, check);
    const { formatted, resultCount, fileCount } = formatResult(a.operation, x, base);
    return { text: formatted.length > LSP_RESULT_MAX ? await persisted(formatted, scratch) : formatted, facts: { operation: a.operation, result: formatted, filePath: a.filePath, resultCount, fileCount }, note };
  } catch (e) { return answer("Error performing " + a.operation + ": " + messageOf(e), {}, note); }
}

/**
 * AFTER A WRITE OR AN EDIT (Claude Code: "each time Claude edits or writes a file the server handles, Claude gets the errors
 * and warnings the server reports"): the file's new text goes to its server (its server started for it the first time), and
 * when `deliver`, what the servers report is taken once the report for this file is in (at most SYNC_WAIT_MS): `{ note,
 * problems, problemsAll }`, the note for Grok after the round and this file's problems for the chat; null when nothing
 * came. (Claude Code sends the text and goes on; it tells Claude at its next step what came meanwhile. Coder has no step of
 * its own between Grok's calls, so the write waits for the report instead.) An agent with no shell (`deliver` false) only
 * sends the text, as Claude Code tells only an agent that has Bash.
 */
export async function syncAfterWrite({ abs, text, deliver = true }, { root, waitMs = SYNC_WAIT_MS } = {}) {
  const s = serverFor(abs);
  if (!s || typeof text !== "string" || text.length > LSP_FILE_MAX || !(await onPath(s.command))) return null;
  const req = { op: "sync", file: abs, text, deliver: deliver === true, waitMs };
  let got;
  // (A keeper that did not answer in time: nothing this time, and no second server for it, so the write stays in its time.)
  try { got = await keeperCall(root, req, waitMs + 10_000); } catch { return null; }
  if (got === null && deliver === true) {
    // NO KEEPER HERE: a server for this one write, its report taken, then stopped.
    const mgr = new LspManager(root);
    try { got = await keeperAnswer(mgr, req); } catch { got = null; } finally { await mgr.shutdown(5000).catch(() => {}); }
  }
  if (!got || !got.ok || deliver !== true) return null;
  const files = (Array.isArray(got.pending) ? got.pending : []).flatMap((p) => (p && Array.isArray(p.files) ? p.files : []));
  if (!files.length) return null;
  const mine = files.find((f) => f.uri === abs);
  const problems = (mine ? mine.diagnostics : []).map((d) => ({ severity: String(d.severity).toLowerCase(), line: d.range.start.line + 1, column: d.range.start.character + 1, message: d.message, code: d.code || "", source: d.source || "" }));
  return { note: diagnosticsNote(files), problems, problemsAll: problems.length };
}
