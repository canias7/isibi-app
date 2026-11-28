// A SUBAGENT'S OWN MCP SERVERS (Claude Code's `mcpServers` frontmatter field, sub-agents docs read 2026-11-28): "Each entry is
// either a server name referencing an already-configured server (e.g., "slack") or an inline definition with the server name
// as key and a full MCP server config as value." "Inline servers defined here are connected when the subagent starts, subject
// to the trust rule for the agent file's folder, and disconnected when the last agent using them finishes. String references
// share the parent session's connection." "Until then: Claude Code skips every inline server in that agent file."
//
// In Coder: a string names one of the owner's connectors (its tools are the chat's, shared); an inline server of type http
// (or streamable-http, or sse answered as an event stream) is reached from Coder's machine with MCP's streamable HTTP
// transport (initialize, tools/list, tools/call, then DELETE of its session); a stdio server (Claude Code: "started as a
// process") is started when the agent starts, inside the chat's admin sandbox the way Coder's bash runs commands
// (server.mjs's spawnStdio), spoken to in MCP's stdio transport (one JSON-RPC message per line on its stdin and stdout:
// initialize, tools/list, tools/call), and stopped when the agent ends. Its tools are named mcp__<server>__<tool>, as Claude Code names them, and ask the owner before
// each call unless the server marks the tool read-only, as the owner's connectors do.

export const INLINE_MCP_MAX = 5, INLINE_TOOLS_MAX = 100, INLINE_TIMEOUT_MS = 30_000;
const VERSION = "2025-06-18";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "x";

/** The frontmatter's entries split: { refs: [names], inline: [{ name, config }] }. */
export function splitMcpServers(list) {
  const refs = [], inline = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (typeof x === "string" && x.trim()) refs.push(x.trim());
    else if (x && typeof x === "object" && !Array.isArray(x)) { const name = Object.keys(x)[0]; if (name && x[name] && typeof x[name] === "object") inline.push({ name, config: x[name] }); }
  }
  return { refs, inline };
}

/** A JSON-RPC answer from a streamable HTTP response (JSON, or an event stream: the message with this id). */
async function answerOf(res, id) {
  const type = String(res.headers.get("content-type") || "");
  const text = await res.text();
  if (type.includes("text/event-stream")) {
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      try { const m = JSON.parse(data); if (m && m.id === id) return m; } catch { /* not this one */ }
    }
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

/** One server's session: { tools, call(tool, args), close() } | { error }. */
export async function connectInline(name, config, { fetchFn = fetch, spawnFn = null, timeoutMs = INLINE_TIMEOUT_MS } = {}) {
  const type = String(config.type || (config.command ? "stdio" : "http")).toLowerCase();
  if (type === "stdio" || config.command) return connectStdio(name, config, { spawnFn, timeoutMs });
  const url = String(config.url || "");
  if (!/^https:\/\//i.test(url)) return { error: "the server " + name + " has no https url" };
  const extra = config.headers && typeof config.headers === "object" ? Object.fromEntries(Object.entries(config.headers).filter(([k, v]) => /^[A-Za-z0-9-]{1,60}$/.test(k) && typeof v === "string")) : {};
  let session = "", n = 0;
  const rpc = async (method, params, notify = false) => {
    const id = notify ? undefined : ++n;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": VERSION, ...(session ? { "mcp-session-id": session } : {}), ...extra }, body: JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(notify ? {} : { id }) }) });
      const sid = res.headers.get("mcp-session-id"); if (sid) session = sid;
      if (notify) return null;
      if (!res.ok) throw new Error(method + " got HTTP " + res.status);
      const m = await answerOf(res, id);
      if (!m) throw new Error(method + " got no answer");
      if (m.error) throw new Error(String(m.error.message || "error"));
      return m.result;
    } finally { clearTimeout(t); }
  };
  try { return await sessionOf(name, rpc, async () => { if (!session) return; try { await fetchFn(url, { method: "DELETE", headers: { "mcp-session-id": session, ...extra } }); } catch { /* gone */ } }); }
  catch (e) { return { error: "the server " + name + " could not be reached: " + String((e && e.message) || e).slice(0, 200) }; }
}

/** initialize, tools/list (every page), and the tools as Coder's: { tools, call, close } (throws when the server fails). */
async function sessionOf(name, rpc, close) {
  await rpc("initialize", { protocolVersion: VERSION, capabilities: {}, clientInfo: { name: "gofarther-coder", version: "1" } });
  await rpc("notifications/initialized", null, true).catch(() => null);
  const tools = [];
  let cursor;
  for (let p = 0; p < 10 && tools.length < INLINE_TOOLS_MAX; p++) {
    const r = await rpc("tools/list", cursor ? { cursor } : {});
    for (const t of (r && Array.isArray(r.tools) ? r.tools : [])) if (t && typeof t.name === "string") tools.push(t);
    cursor = r && r.nextCursor; if (!cursor) break;
  }
  const server = slug(name);
  const defs = tools.slice(0, INLINE_TOOLS_MAX).map((t) => ({
    name: ("mcp__" + server + "__" + String(t.name).replace(/[^A-Za-z0-9_-]+/g, "_")).slice(0, 64), tool: t.name, server, label: name + ": " + t.name,
    description: String(t.description || t.name), readOnly: !!(t.annotations && t.annotations.readOnlyHint === true),
    parameters: t.inputSchema && typeof t.inputSchema === "object" && t.inputSchema.type === "object" ? t.inputSchema : { type: "object", properties: {} },
  })).filter((d) => /^mcp__[a-z0-9_-]{1,59}$/i.test(d.name));
  return {
    tools: defs,
    call: async (toolName, args) => {
      const d = defs.find((x) => x.name === toolName);
      if (!d) return { text: "error: no such tool", isError: true };
      try {
        const r = await rpc("tools/call", { name: d.tool, arguments: args || {} });
        const text = (r && Array.isArray(r.content) ? r.content : []).map((c) => (c && c.type === "text" ? c.text : c ? "[" + c.type + "]" : "")).join("\n");
        return { text: text || JSON.stringify((r && r.structuredContent) || {}), isError: !!(r && r.isError) };
      } catch (e) { return { text: "error: " + String((e && e.message) || e).slice(0, 300), isError: true }; }
    },
    close,
  };
}

const shWord = (w) => "'" + String(w).replace(/'/g, "'\\''") + "'";
/** The command line a stdio server's config starts: its command and args, each one quoted word. */
export const stdioLine = (config) => [String(config.command || ""), ...(Array.isArray(config.args) ? config.args : [])].filter((w, i) => i > 0 || w).map((w) => shWord(String(w))).join(" ");

/**
 * A STDIO SERVER (MCP's stdio transport): `spawnFn({ command, env })` starts it (the chat's sandbox; null when it can't),
 * newline-delimited JSON-RPC on its stdin and stdout; requests the server sends are answered "method not found"; its end
 * (close) ends its stdin and kills its process group.
 */
export async function connectStdio(name, config, { spawnFn = null, timeoutMs = INLINE_TIMEOUT_MS } = {}) {
  if (!config.command || typeof config.command !== "string") return { error: "the stdio server " + name + " has no command" };
  if (typeof spawnFn !== "function") return { error: "the stdio server " + name + " was not started: this chat's machine can't start it" };
  const env = config.env && typeof config.env === "object" ? Object.fromEntries(Object.entries(config.env).filter(([k, v]) => /^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(k) && typeof v === "string")) : {};
  let p = null;
  try { p = spawnFn({ command: stdioLine(config), env }); } catch { p = null; }
  if (!p || !p.stdin || !p.stdout) return { error: "the stdio server " + name + " was not started: Coder's admin sandbox is not running" };
  const waiting = new Map();
  let n = 0, buf = "", ended = false;
  const fail = (why) => { ended = true; for (const [, w] of waiting) w.reject(new Error(why)); waiting.clear(); };
  const send = (m) => { if (ended) throw new Error("the server has ended"); p.stdin.write(JSON.stringify(m) + "\n"); };
  p.stdout.setEncoding && p.stdout.setEncoding("utf8");
  p.stdout.on("data", (d) => {
    buf += String(d);
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (!m || typeof m !== "object") continue;
      if (m.method && m.id !== undefined) { try { send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } }); } catch { /* ended */ } continue; }
      const w = m.id !== undefined ? waiting.get(m.id) : null;
      if (w) { waiting.delete(m.id); w.resolve(m); }
    }
    if (buf.length > 4_000_000) buf = "";
  });
  p.on && p.on("exit", () => fail("the server exited"));
  p.on && p.on("error", (e) => fail(String((e && e.message) || e)));
  p.stdin.on && p.stdin.on("error", () => {});
  const rpc = async (method, params, notify = false) => {
    if (notify) { send({ jsonrpc: "2.0", method, ...(params ? { params } : {}) }); return null; }
    const id = ++n;
    const m = await new Promise((resolve, reject) => {
      const t = setTimeout(() => { waiting.delete(id); reject(new Error(method + " got no answer")); }, timeoutMs);
      waiting.set(id, { resolve: (x) => { clearTimeout(t); resolve(x); }, reject: (e) => { clearTimeout(t); reject(e); } });
      try { send({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }); } catch (e) { clearTimeout(t); waiting.delete(id); reject(e); }
    });
    if (m.error) throw new Error(String(m.error.message || "error"));
    return m.result;
  };
  const close = async () => {
    if (ended && p.exitCode !== null) return;
    try { p.stdin.end(); } catch { /* closed */ }
    const kill = (sig) => { try { if (p.pid) process.kill(-p.pid, sig); } catch { try { p.kill(sig); } catch { /* gone */ } } };
    kill("SIGTERM");
    setTimeout(() => { if (p.exitCode === null && p.signalCode === null) kill("SIGKILL"); }, 2000).unref?.();
    fail("closed");
  };
  try { return await sessionOf(name, rpc, close); }
  catch (e) { await close(); return { error: "the stdio server " + name + " could not be started: " + String((e && e.message) || e).slice(0, 200) }; }
}

/**
 * THE INLINE SERVERS OF ONE SUBAGENT, connected when it starts (`trusted`: the agent file's folder is trusted; a plugin's are
 * ignored before this). -> { tools, notes, call(name, args) | null, close() }.
 */
export async function connectAgentServers(list, { trusted = false, fetchFn = fetch, spawnFn = null, connected = [] } = {}) {
  const { refs, inline } = splitMcpServers(list);
  const notes = [], sessions = [];
  const known = new Set((Array.isArray(connected) ? connected : []).map((s) => String(s).toLowerCase()));
  for (const r of refs) if (!known.has(r.toLowerCase()) && !known.has(slug(r))) notes.push("The agent's mcpServers names " + r + ", which is not one of your connected connectors.");
  if (inline.length && !trusted) notes.push("The inline MCP servers in this agent's file were skipped: turn on \"Trust this repository's settings\" first.");
  else for (const { name, config } of inline.slice(0, INLINE_MCP_MAX)) {
    const s = await connectInline(name, config, { fetchFn, spawnFn });
    if (s.error) notes.push(s.error); else sessions.push(s);
  }
  const tools = sessions.flatMap((s) => s.tools);
  const owner = new Map(); for (const s of sessions) for (const t of s.tools) owner.set(t.name, s);
  return {
    tools, notes,
    call: tools.length ? (name, args) => owner.get(name).call(name, args) : null,
    has: (name) => owner.has(name),
    close: async () => { for (const s of sessions) await s.close(); },
  };
}
