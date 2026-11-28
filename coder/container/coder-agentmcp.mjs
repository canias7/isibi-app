// A SUBAGENT'S OWN MCP SERVERS (Claude Code's `mcpServers` frontmatter field, sub-agents docs read 2026-11-28): "Each entry is
// either a server name referencing an already-configured server (e.g., "slack") or an inline definition with the server name
// as key and a full MCP server config as value." "Inline servers defined here are connected when the subagent starts, subject
// to the trust rule for the agent file's folder, and disconnected when the last agent using them finishes. String references
// share the parent session's connection." "Until then: Claude Code skips every inline server in that agent file."
//
// In Coder: a string names one of the owner's connectors (its tools are the chat's, shared); an inline server of type http
// (or streamable-http, or sse answered as an event stream) is reached from Coder's machine with MCP's streamable HTTP
// transport (initialize, tools/list, tools/call, then DELETE of its session); a stdio server is not run (Coder runs no local
// MCP servers) and is said so. Its tools are named mcp__<server>__<tool>, as Claude Code names them, and ask the owner before
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
export async function connectInline(name, config, { fetchFn = fetch, timeoutMs = INLINE_TIMEOUT_MS } = {}) {
  const type = String(config.type || (config.command ? "stdio" : "http")).toLowerCase();
  if (type === "stdio" || config.command) return { error: "the stdio server " + name + " was not started: Coder runs no local MCP servers (give it a url with type http)" };
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
  try {
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
      close: async () => { if (!session) return; try { await fetchFn(url, { method: "DELETE", headers: { "mcp-session-id": session, ...extra } }); } catch { /* gone */ } },
    };
  } catch (e) { return { error: "the server " + name + " could not be reached: " + String((e && e.message) || e).slice(0, 200) }; }
}

/**
 * THE INLINE SERVERS OF ONE SUBAGENT, connected when it starts (`trusted`: the agent file's folder is trusted; a plugin's are
 * ignored before this). -> { tools, notes, call(name, args) | null, close() }.
 */
export async function connectAgentServers(list, { trusted = false, fetchFn = fetch, connected = [] } = {}) {
  const { refs, inline } = splitMcpServers(list);
  const notes = [], sessions = [];
  const known = new Set((Array.isArray(connected) ? connected : []).map((s) => String(s).toLowerCase()));
  for (const r of refs) if (!known.has(r.toLowerCase()) && !known.has(slug(r))) notes.push("The agent's mcpServers names " + r + ", which is not one of your connected connectors.");
  if (inline.length && !trusted) notes.push("The inline MCP servers in this agent's file were skipped: turn on \"Trust this repository's settings\" first.");
  else for (const { name, config } of inline.slice(0, INLINE_MCP_MAX)) {
    const s = await connectInline(name, config, { fetchFn });
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
