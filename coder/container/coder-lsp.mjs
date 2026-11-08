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
