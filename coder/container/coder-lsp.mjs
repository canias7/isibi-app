// CODER'S LSP TOOL (owner, 2026-11-05: "add … lsp"). Like Claude Code's LSP:
// go to a definition, find references, see a symbol's type, or get a file's
// errors, from a real language server:
//   .js .jsx .ts .tsx .mjs .cjs  typescript-language-server (needs typescript)
//   .py                          pyright-langserver
// Each call starts the server, opens the file, asks once and stops it: slower
// than an editor's (a few seconds) but nothing is left running. It runs as
// `dev` in the project, through coder-tools.mjs, like every other tool.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { extname, relative } from "node:path";

export const LSP_MS = 45000;
const SERVERS = {
  ts: { cmd: "typescript-language-server", args: ["--stdio"], lang: (e) => ({ ".ts": "typescript", ".tsx": "typescriptreact", ".jsx": "javascriptreact" })[e] || "javascript" },
  py: { cmd: "pyright-langserver", args: ["--stdio"], lang: () => "python" },
};
export function serverFor(path) {
  const e = extname(path).toLowerCase();
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"].includes(e)) return { ...SERVERS.ts, ext: e };
  if (e === ".py") return { ...SERVERS.py, ext: e };
  return null;
}

/** One JSON-RPC conversation with a language server over stdio. */
function connect(proc) {
  let buf = Buffer.alloc(0), id = 0;
  const waiting = new Map();
  const notes = [];
  const listeners = [];
  proc.stdout.on("data", (b) => {
    buf = Buffer.concat([buf, b]);
    for (;;) {
      const h = buf.indexOf("\r\n\r\n");
      if (h < 0) return;
      const m = /Content-Length: (\d+)/i.exec(buf.slice(0, h).toString());
      if (!m) { buf = buf.slice(h + 4); continue; }
      const len = Number(m[1]);
      if (buf.length < h + 4 + len) return;
      let msg; try { msg = JSON.parse(buf.slice(h + 4, h + 4 + len).toString("utf8")); } catch { msg = null; }
      buf = buf.slice(h + 4 + len);
      if (!msg) continue;
      if (msg.id !== undefined && waiting.has(msg.id) && (msg.result !== undefined || msg.error)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.no(new Error(msg.error.message || "server error")) : w.ok(msg.result); }
      else if (msg.method && msg.id !== undefined) write({ jsonrpc: "2.0", id: msg.id, result: msg.method === "workspace/configuration" ? (msg.params?.items || []).map(() => ({})) : null });
      else if (msg.method) { notes.push(msg); listeners.forEach((f) => f(msg)); }
    }
  });
  const write = (o) => { const s = JSON.stringify(o); proc.stdin.write("Content-Length: " + Buffer.byteLength(s) + "\r\n\r\n" + s); };
  return {
    request: (method, params) => new Promise((ok, no) => { const n = ++id; waiting.set(n, { ok, no }); write({ jsonrpc: "2.0", id: n, method, params }); }),
    notify: (method, params) => write({ jsonrpc: "2.0", method, params }),
    onNote: (f) => listeners.push(f),
    notes,
  };
}

// A place in a file: from `root`, or by its full path when `root` is null (the commands are in another folder).
const fmtLoc = (root, l) => {
  const uri = l.uri || l.targetUri; const r = l.range || l.targetSelectionRange || l.targetRange;
  let p = uri; try { p = root ? relative(root, fileURLToPath(uri)) || p : fileURLToPath(uri); } catch { /* keep the uri */ }
  return p + ":" + (r.start.line + 1) + ":" + (r.start.character + 1);
};

/**
 * `{ action: definition|references|hover|diagnostics, path, line, column }` → text.
 * line and column count from 1, like the read tool's line numbers.
 */
export async function runLsp({ action, path, abs, line, column }, root = process.cwd(), shownFrom = root) {
  const s = serverFor(path);
  if (!s) throw new Error("no language server for " + (extname(path) || "that file") + " (LSP covers JavaScript/TypeScript and Python)");
  if (!["definition", "references", "hover", "diagnostics"].includes(action)) throw new Error("action is one of: definition, references, hover, diagnostics");
  const text = await readFile(abs, "utf8");
  const proc = spawn(s.cmd, s.args, { cwd: root, stdio: ["pipe", "pipe", "ignore"] });
  const gone = new Promise((_, no) => proc.on("error", (e) => no(new Error(e.code === "ENOENT" ? s.cmd + " is not installed on this machine" : e.message))));
  const timer = new Promise((_, no) => setTimeout(() => no(new Error("the language server took too long")), LSP_MS));
  const c = connect(proc);
  try {
    return await Promise.race([gone, timer, (async () => {
      const rootUri = pathToFileURL(root).href;
      await c.request("initialize", { processId: process.pid, rootUri, workspaceFolders: [{ uri: rootUri, name: "project" }], capabilities: { textDocument: { publishDiagnostics: {}, hover: { contentFormat: ["plaintext", "markdown"] }, definition: {}, references: {} } } });
      c.notify("initialized", {});
      const uri = pathToFileURL(abs).href;
      const diags = new Promise((ok) => {
        const pick = (m) => (m.method === "textDocument/publishDiagnostics" && m.params.uri === uri ? m.params.diagnostics : null);
        for (const m of c.notes) { const d = pick(m); if (d) return ok(d); }
        c.onNote((m) => { const d = pick(m); if (d) ok(d); });
      });
      c.notify("textDocument/didOpen", { textDocument: { uri, languageId: s.lang(s.ext), version: 1, text } });
      const pos = { line: Math.max(0, (Number(line) || 1) - 1), character: Math.max(0, (Number(column) || 1) - 1) };
      if (action === "diagnostics") {
        const d = await Promise.race([diags, new Promise((ok) => setTimeout(() => ok(null), 20000))]);
        if (!d) return "the language server sent no report for " + path + " in time";
        if (!d.length) return "no errors or warnings in " + path;
        return d.slice(0, 100).map((x) => path + ":" + (x.range.start.line + 1) + ":" + (x.range.start.character + 1) + " " + (["", "error", "warning", "info", "hint"][x.severity] || "note") + ": " + String(x.message).split("\n")[0]).join("\n");
      }
      if (action === "hover") {
        const h = await c.request("textDocument/hover", { textDocument: { uri }, position: pos });
        const v = h && h.contents; const t = Array.isArray(v) ? v.map((x) => x.value || x).join("\n") : (v && (v.value || v)) || "";
        return String(t).trim() || "nothing known about that spot";
      }
      const r = await c.request(action === "definition" ? "textDocument/definition" : "textDocument/references", { textDocument: { uri }, position: pos, ...(action === "references" ? { context: { includeDeclaration: true } } : {}) });
      const list = Array.isArray(r) ? r : r ? [r] : [];
      return list.length ? list.slice(0, 100).map((l) => fmtLoc(shownFrom, l)).join("\n") : "nothing found at " + path + ":" + (pos.line + 1) + ":" + (pos.character + 1) + " (point line and column at a name)";
    })()]);
  } finally { try { proc.kill("SIGKILL"); } catch { /* gone */ } }
}

/**
 * NEW PROBLEMS AFTER A WRITE (the owner, 2026-11-09: "can we do those small optional extras that you said? Yeah, I want
 * it"; Claude Code's code-intelligence plugins: "each time Claude edits or writes a file the server handles, Claude gets
 * the errors and warnings the server reports", and its conversation shows "Found N new diagnostic issues in M files"):
 * one language server for the write, the file as it was (`before`; null for a new file) and then as it is now (`after`);
 * the errors and warnings that are new (matched by kind, message and code, not by line, as lines move). Each report is
 * taken once the server goes quiet (SETTLE_MS without another), as a server may report in steps. Null when no server takes
 * the file, it is not installed, or it takes longer than CHECK_MS in all: then nothing is said, as in Claude Code without
 * a plugin.
 */
export const CHECK_MS = 20000, SETTLE_MS = 800, PROBLEMS_SHOWN = 20;
export async function newProblems({ path, abs, before = null, after }, root = process.cwd()) {
  const s = serverFor(path);
  if (!s || typeof after !== "string") return null;
  let proc;
  try { proc = spawn(s.cmd, s.args, { cwd: root, stdio: ["pipe", "pipe", "ignore"] }); } catch { return null; }
  const gone = new Promise((ok) => proc.on("error", () => ok(null)));
  const timer = new Promise((ok) => setTimeout(() => ok(null), CHECK_MS));
  const c = connect(proc);
  const uri = pathToFileURL(abs).href;
  // Each report for this file, in order; settled(n): the last of those after the n-th, once SETTLE_MS pass with no other.
  const reports = [];
  const take = (m) => { if (m.method === "textDocument/publishDiagnostics" && m.params && m.params.uri === uri) reports.push(Array.isArray(m.params.diagnostics) ? m.params.diagnostics : []); };
  for (const m of c.notes) take(m);
  c.onNote(take);
  const settled = (from) => new Promise((ok) => {
    let seen = -1;
    const tick = () => {
      if (reports.length > from && reports.length === seen) return ok(reports[reports.length - 1]);
      seen = reports.length;
      setTimeout(tick, reports.length > from ? SETTLE_MS : 100);
    };
    tick();
  });
  try {
    return await Promise.race([gone, timer, (async () => {
      const rootUri = pathToFileURL(root).href;
      await c.request("initialize", { processId: process.pid, rootUri, workspaceFolders: [{ uri: rootUri, name: "project" }], capabilities: { textDocument: { publishDiagnostics: {} } } });
      c.notify("initialized", {});
      let was = [];
      if (typeof before === "string") {
        c.notify("textDocument/didOpen", { textDocument: { uri, languageId: s.lang(s.ext), version: 1, text: before } });
        was = await settled(0);
        const from = reports.length;
        c.notify("textDocument/didChange", { textDocument: { uri, version: 2 }, contentChanges: [{ text: after }] });
        return pickNew(was, await settled(from));
      }
      c.notify("textDocument/didOpen", { textDocument: { uri, languageId: s.lang(s.ext), version: 1, text: after } });
      return pickNew([], await settled(0));
    })()]);
  } catch { return null; } finally { try { proc.kill("SIGKILL"); } catch { /* gone */ } }
}
/** The errors and warnings in `now` that `was` did not have (each counted, so a second same error is new). */
function pickNew(was, now) {
  const key = (d) => (d.severity || 1) + "\u0000" + String(d.message || "") + "\u0000" + String(d.code ?? "");
  const left = new Map();
  for (const d of was) left.set(key(d), (left.get(key(d)) || 0) + 1);
  const out = [];
  for (const d of now) {
    if (d.severity && d.severity > 2) continue; // errors and warnings only
    const k = key(d), n = left.get(k) || 0;
    if (n) { left.set(k, n - 1); continue; }
    out.push({ severity: d.severity === 2 ? "warning" : "error", line: (d.range?.start?.line ?? 0) + 1, column: (d.range?.start?.character ?? 0) + 1, message: String(d.message || "").split("\n")[0].slice(0, 300), code: d.code === undefined || d.code === null ? "" : String(d.code).slice(0, 60), source: String(d.source || "").slice(0, 40) });
  }
  return out;
}
/**
 * The note for Grok, as Claude Code's diagnostics note reads ("<new-diagnostics>The following new diagnostic issues were
 * detected: … ✘ [Line 3:5] … [code] (source)"), at most PROBLEMS_SHOWN of them; "" when there are none.
 */
export function problemsNote(path, list) {
  if (!Array.isArray(list) || !list.length) return "";
  const row = (p) => "  " + (p.severity === "warning" ? "⚠" : "✘") + " [Line " + p.line + ":" + p.column + "] " + p.message + (p.code ? " [" + p.code + "]" : "") + (p.source ? " (" + p.source + ")" : "");
  return "<new-diagnostics>The following new diagnostic issues were detected:\n\n" + path + ":\n" + list.slice(0, PROBLEMS_SHOWN).map(row).join("\n") + (list.length > PROBLEMS_SHOWN ? "\n  … and " + (list.length - PROBLEMS_SHOWN) + " more" : "") + "\n</new-diagnostics>";
}

/** The lsp tool's input, as Claude Code takes it (coder-inputs.mjs; the owner, 2026-11-14: "start fixing and filling in gaps on those tools"). (A start: the work fills it in.) */
export function checkInput(args) { return { args }; }
