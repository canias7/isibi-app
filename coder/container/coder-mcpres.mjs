/**
 * CLAUDE CODE'S MCP RESOURCE TOOLS (the owner, 2026-11-17: "yes build it like claude code"): its ListMcpResourcesTool and
 * ReadMcpResourceTool, in Coder's names list_mcp_resources and read_mcp_resource, as Claude Code 2.1.326 has them (its
 * program, read that day, and its real tools, tried in a Claude Code cloud session the same day):
 *   - offered only once one of the chat's connectors declares resources (its server's `resources` capability), both
 *     together, and then held back until tool_search loads them (its `shouldDefer`), with its search hints;
 *   - read-only, never asking (its checkPermissions allows them), run side by side with other read-only calls;
 *   - their descriptions, inputs, answers and refusals in its words (Coder's names for its tools where it names them).
 * Their calls go through Coder's server, which holds the connectors' sign-ins (src/coder-mcp.mjs resourceCall); this file
 * has what both sides need, so no Node module here (Coder's Worker loads it too).
 *
 * And its third one, ReadMcpResourceDirTool (`resources/directory/read`), as read_mcp_resource_dir (the owner, 2026-11-17: "yes
 * match all pls"): 2.1.326 offers it with the other two, and every call it takes, past its checks of the server, answers
 * "Directory listing is not enabled in this build." (its E5t is `return !1`; tried the same day).
 */
import { typeIssue, unknownKeysIssue, inputErrorText } from "./coder-zodtext.mjs";

export const LIST_TOOL = "list_mcp_resources", READ_TOOL = "read_mcp_resource", DIR_TOOL = "read_mcp_resource_dir";
/** Claude Code's names for them, for hooks and rules. */
export const CC_LIST = "ListMcpResourcesTool", CC_READ = "ReadMcpResourceTool", CC_DIR = "ReadMcpResourceDirTool";
export const RESOURCE_TOOLS = Object.freeze([LIST_TOOL, READ_TOOL, DIR_TOOL]);

/** Their descriptions, word for word (2.1.326's ALa and PLa: the ones a Claude Code cloud session gives its model). */
export const LIST_DESCRIPTION = "\nList available resources from configured MCP servers.\nEach returned resource will include all standard MCP resource fields plus a 'server' field \nindicating which server the resource belongs to.\n\nParameters:\n- server (optional): The name of a specific MCP server to get resources from. If not provided,\n  resources from all servers will be returned.\n";
export const READ_DESCRIPTION = "\nReads a specific resource from an MCP server, identified by server name and resource URI.\n\nParameters:\n- server (required): The name of the MCP server from which to read the resource\n- uri (required): The URI of the resource to read\n";
/** Their inputs, as its schemas give them (and nothing else: its strict objects). */
export const LIST_PROPERTIES = Object.freeze({ server: { type: "string", description: "Optional server name to filter resources by" } });
export const READ_PROPERTIES = Object.freeze({ server: { type: "string", description: "The MCP server name" }, uri: { type: "string", description: "The resource URI to read" } });
export const READ_REQUIRED = Object.freeze(["server", "uri"]);
export const LIST_TOOL_DEF = Object.freeze({ type: "function", function: { name: LIST_TOOL, description: LIST_DESCRIPTION, parameters: { type: "object", properties: LIST_PROPERTIES, additionalProperties: false } } });
export const READ_TOOL_DEF = Object.freeze({ type: "function", function: { name: READ_TOOL, description: READ_DESCRIPTION, parameters: { type: "object", properties: READ_PROPERTIES, required: [...READ_REQUIRED], additionalProperties: false } } });
/** The third one's (2.1.326's RLa, ${fkn} its "inode/directory"), its input and its search hint. */
export const DIRECTORY_MIME = "inode/directory";
export const DIR_DESCRIPTION = "\nList the direct children of a directory resource on an MCP server (`resources/directory/read`).\n\nParameters:\n- server (required): The name of the MCP server to read from\n- uri (required): The URI of the directory resource\n\nThe listing is not recursive. Each entry carries its own `uri`; subdirectories appear with mimeType \"" + DIRECTORY_MIME + "\" \u2014 call this tool again on a subdirectory's `uri` to descend.\n\nOnly usable against a server that has declared support for directory listing; other servers return an error.\n";
export const DIR_PROPERTIES = Object.freeze({ server: { type: "string", description: "The MCP server name" }, uri: { type: "string", description: "The directory resource URI to list" } });
export const DIR_TOOL_DEF = Object.freeze({ type: "function", function: { name: DIR_TOOL, description: DIR_DESCRIPTION, parameters: { type: "object", properties: DIR_PROPERTIES, required: [...READ_REQUIRED], additionalProperties: false } } });
/** Their search hints, Claude Code's own (its `searchHint`), for tool_search. */
export const LIST_HINT = "list resources from connected MCP servers", READ_HINT = "read a specific MCP resource by URI", DIR_HINT = "list the children of an MCP directory resource";

// ── THEIR INPUT ──────────────────────────────────────────────────────────────
const obj = (a) => (a && typeof a === "object" && !Array.isArray(a) ? a : {});
/** list_mcp_resources' input, as its schema takes it: `server` a string when given, nothing else. Refused in its words. */
export function checkListInput(args) {
  const a = obj(args), issues = [];
  if (a.server !== undefined && typeof a.server !== "string") issues.push(typeIssue("string", a.server, ["server"]));
  const unknown = Object.keys(a).filter((k) => k !== "server");
  if (unknown.length) issues.push(unknownKeysIssue(unknown));
  return issues.length ? { error: inputErrorText(LIST_TOOL, issues) } : { args: a };
}
/** read_mcp_resource's input (and read_mcp_resource_dir's): `server` and `uri` strings, nothing else. Refused in its words. */
function checkServerUri(args, tool) {
  const a = obj(args), issues = [];
  if (typeof a.server !== "string") issues.push(typeIssue("string", a.server, ["server"]));
  if (typeof a.uri !== "string") issues.push(typeIssue("string", a.uri, ["uri"]));
  const unknown = Object.keys(a).filter((k) => k !== "server" && k !== "uri");
  if (unknown.length) issues.push(unknownKeysIssue(unknown));
  return issues.length ? { error: inputErrorText(tool, issues) } : { args: a };
}
export const checkReadInput = (args) => checkServerUri(args, READ_TOOL);
export const checkDirInput = (args) => checkServerUri(args, DIR_TOOL);

// ── THEIR WORDS ──────────────────────────────────────────────────────────────
/** An empty list (its $8r, tried: the whole answer). */
export const NO_RESOURCES = "No resources found. MCP servers may still provide tools even if they have no resources.";
/** A server it does not have (its V2o and the list's own, tried): every server named, as its session lists them. */
export const serverNotFound = (server, names) => 'Server "' + server + '" not found. Available servers: ' + (Array.isArray(names) ? names : []).join(", ");
export const serverNotConnected = (name) => 'Server "' + name + '" is not connected';
export const serverHasNoResources = (name) => 'Server "' + name + '" does not support resources';
/** A server that declares resources but answers a read with "method not found" (-32601; tried: GitHub's). An answer, not an error. */
export const readsNotImplemented = (name) => 'Server "' + name + '" advertises resource support but does not implement resource reads.';
/** A resource the server does not have (-32002, or -32602), with Coder's name for the list tool. An answer, not an error. */
export const resourceNotFound = (uri, dirRead = false) => "Resource not found: " + uri + " \u2014 it may have been deleted or the URI is stale. Re-run " + LIST_TOOL + " to refresh." + (dirRead ? " If the URI is a directory resource, use " + DIR_TOOL + " instead." : "");
/** Whether a server declares directory listing (its serverDeclaresDirectoryRead: the skills extension's `directoryRead`). */
export const SKILLS_EXTENSION = "io.modelcontextprotocol/skills";
export function declaresDirectoryRead(caps) {
  const e = caps && typeof caps === "object" && caps.extensions && typeof caps.extensions === "object" ? caps.extensions[SKILLS_EXTENSION] : null;
  return e != null && typeof e === "object" && "directoryRead" in e && e.directoryRead === true;
}
/** The third tool's answer past its checks of the server (its `re`, an answer, not an error). */
export const DIR_OFF = "Directory listing is not enabled in this build.";
/** The JSON-RPC errors it reads as those two (its isMcpMethodNotFoundError and isMcpResourceNotFoundError). */
export const METHOD_NOT_FOUND = -32601, RESOURCE_NOT_FOUND_CODES = Object.freeze([-32002, -32602]);
/** A resource's binary content saved to a file (its Dqt, with its "[Resource from … at …] " lead); `size` already in its words. */
export const blobSavedText = (server, uri, path, mimeType, size) => "[Resource from " + server + " at " + uri + "] Binary content (" + (mimeType || "unknown type") + ", " + size + ") saved to " + path;
export const blobNotSaved = (why) => "Binary content could not be saved to disk: " + why;
/** Its limit for a saved file (afe's EVr, 100 MB), in its words. */
export const BLOB_SAVE_MAX = 104_857_600;
export const blobTooBig = (n) => "content is " + n + " bytes, over the " + BLOB_SAVE_MAX + " byte persist limit";
/** At most this many pages of a server's list (its Sc), following `nextCursor`. */
export const LIST_PAGES_MAX = 20;
/** An answer past this many characters is saved to a file, its start shown (its maxResultSizeChars). */
export const RESOURCE_INLINE_MAX = 100_000;

/** A server's name as Claude Code writes it to compare names (its On: what is not a letter, digit, _ or - made _). */
export function serverKey(name) {
  const t = String(name), k = t.replace(/[^a-zA-Z0-9_-]/g, "_");
  return t.startsWith("claude.ai ") ? k.replace(/_+/g, "_").replace(/^_|_$/g, "") : k;
}
/** The servers a name means (its C2e): those with that very name, else those whose names it writes the same. */
export function serversNamed(servers, name) {
  const list = Array.isArray(servers) ? servers : [];
  const exact = list.filter((s) => s && s.name === name);
  if (exact.length) return exact;
  const k = serverKey(name);
  return list.filter((s) => s && serverKey(s.name) === k);
}

/** What the model is told: the list as JSON, or its words for none (its mapToolResultToToolResultBlockParam). */
export const listText = (resources) => (Array.isArray(resources) && resources.length ? JSON.stringify(resources) : NO_RESOURCES);
/** A read: its error's words, or the contents as JSON. */
export const readText = (data) => (data && typeof data.error === "string" && data.error ? data.error : JSON.stringify(data));
/** A directory's listing (its mapToolResultToToolResultBlockParam): its error's words, or the entries by name and the JSON. */
export function dirText(data) {
  if (data && typeof data.error === "string" && data.error) return data.error;
  const list = data && Array.isArray(data.resources) ? data.resources : [];
  const head = list.length ? "Directory listing (" + list.length + " " + (list.length === 1 ? "entry" : "entries") + "):\n" + list.map((x) => String(x && x.name) + (x && x.mimeType === DIRECTORY_MIME ? "/" : "")).join("\n") : "Directory is empty.";
  return head + "\n\n" + JSON.stringify(data);
}

/**
 * A READ'S ANSWER AS THE SERVER GAVE IT, READ ON CODER'S MACHINE (the owner, 2026-11-17: "yes match all pls"; Claude Code saves up
 * to 100 MB, more than Coder's server can hold, so a read's answer comes through it as it came: src/coder-mcp.mjs resourceCall's
 * relay): the JSON-RPC answer with `head.id`, plain JSON or an event stream's `data:` lines, as src/coder-mcp.mjs readAnswer
 * reads one; on a 2026-07-28 session its result settled as decodeResult settles it (src/coder-mcp-era.mjs), in its words. →
 * { result } | { rpc: { code, message } } | { input: true } (a question for the owner: the read is made again without the
 * relay) | { error }.
 */
export function relayedAnswer(text, head) {
  const h = head && typeof head === "object" ? head : {}, t = String(text || ""), msgs = [];
  if (/text\/event-stream/i.test(String(h.type || ""))) {
    for (const block of t.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (data) { try { msgs.push(JSON.parse(data)); } catch { /* not JSON */ } }
    }
  } else if (t.trim()) {
    try { const j = JSON.parse(t); if (Array.isArray(j)) msgs.push(...j); else msgs.push(j); } catch { return { error: "the MCP server's answer could not be read" }; }
  }
  const m = msgs.find((x) => x && typeof x === "object" && x.id === h.id && typeof x.method !== "string");
  if (!m) return { error: "the MCP server gave no answer" };
  if (m.error) return { rpc: { code: m.error.code, message: String(m.error.message || "error") } };
  if (!h.modern) return { result: m.result };
  const r = m.result, why = (w) => ({ error: malformedResult(h.server, "Invalid result for resources/read: " + w) });
  if (!r || typeof r !== "object" || Array.isArray(r)) return why("not an object");
  const kind = r.resultType === undefined ? "complete" : r.resultType;
  if (typeof kind !== "string") return why("non-string resultType");
  if (kind === "input_required") return { input: true };
  if (kind !== "complete") return { error: "Unsupported result type '" + kind + "' for resources/read" };
  const { resultType: _t, ...rest } = r;
  return { result: rest };
}
/** The type of a read's answer from Coder's server (src/coder-mcp.mjs handleMcp): its first line, then the relayed answer. */
export const RELAY_TYPE = "application/x-coder-relay";
/** The most of a relayed answer Coder's machine takes (Claude Code's 100 MB, in base64 and JSON, and a margin): past it, too large. */
export const RELAY_MAX = 200_000_000;
/** Claude Code's words for a result it couldn't read (src/coder-mcp-era.mjs malformedResult, the same words). */
export const malformedResult = (server, why) => "MCP server \"" + server + "\" returned a malformed result that failed schema validation: " + why;
/**
 * A READ'S ERROR AS CLAUDE CODE ANSWERS IT: "method not found" and "resource not found" its words, as an answer (the second with
 * its pointer to the directory tool for a server that declares directory listing); any other, the server's, a failure.
 */
export function readErrorAnswer(code, message, server, uri, dirRead = false) {
  if (code === METHOD_NOT_FOUND) return { contents: [], error: readsNotImplemented(server) };
  if (RESOURCE_NOT_FOUND_CODES.includes(code)) return { contents: [], error: resourceNotFound(uri, dirRead) };
  return { error: "the MCP server said: " + String(message || "error").slice(0, 300) };
}
/** A read's contents as the server gave them: each part's address and type, and its text or its binary content (base64). */
export function contentsOf(contents, uri) {
  return (Array.isArray(contents) ? contents : []).filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => ({
    uri: typeof x.uri === "string" ? x.uri : String(uri ?? ""),
    ...(typeof x.mimeType === "string" ? { mimeType: x.mimeType } : {}),
    ...("text" in x ? { text: typeof x.text === "string" ? x.text : String(x.text ?? "") } : typeof x.blob === "string" ? { blob: x.blob } : {}) }));
}

// ── A RULE ON ONE OF THEIR INPUTS ─────────────────────────────────────────────
/** Their inputs a deny or ask rule may name (Claude Code: "any scalar parameter the tool accepts"; none is their primary field). */
export const RULE_PARAMS = Object.freeze({ ListMcpResourcesTool: ["server"], ReadMcpResourceTool: ["server", "uri"], ReadMcpResourceDirTool: ["server", "uri"] });
const glob = (pattern, text) => new RegExp("^" + String(pattern).split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$").test(text);
/**
 * WHETHER A RULE'S `server:` VALUE NAMES A CALL'S SERVER (Claude Code 2.1.326's Gc for its MCP resource tools): as given, or as
 * Claude Code writes server names (serverKey), with and without the `_` around them; `*` any text; a "claude.ai " name by its
 * written form.
 */
export function serverRuleMatches(expected, actual) {
  const P = String(expected), A = String(actual);
  if (glob(P, A.trim())) return true;
  const v = P.replace(/[^a-zA-Z0-9_*-]/g, "_"), L = v.replace(/_+/g, "_").replace(/_$/, "").replace(/_?\*/g, "*");
  const forms = [A.trim(), A].map(serverKey).flatMap((N) => [N, N.replace(/_+$/, "").replace(/^_+/, "")]);
  return forms.some((N) => (P.startsWith("claude.ai ") ? glob(L, N) : glob(v, N) || (P.includes("*") && !v.startsWith("_") && (N + "_").startsWith("claude_ai_") && glob(L, N))));
}

/** The file extension it saves a resource's binary content with, by its type (its V9e, word for word). */
export function extOf(mimeType) {
  if (!mimeType) return "bin";
  switch (String(mimeType).split(";")[0].trim().toLowerCase()) {
    case "application/pdf": return "pdf";
    case "application/json": return "json";
    case "text/csv": return "csv";
    case "text/plain": return "txt";
    case "text/html": return "html";
    case "text/markdown": return "md";
    case "application/zip": return "zip";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "docx";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return "xlsx";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": return "pptx";
    case "application/msword": return "doc";
    case "application/vnd.ms-excel": return "xls";
    case "audio/mpeg": return "mp3";
    case "audio/wav": return "wav";
    case "audio/ogg": return "ogg";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    case "image/x-icon": case "image/vnd.microsoft.icon": return "ico";
    case "text/css": return "css";
    case "text/javascript": case "application/javascript": return "js";
    case "application/xml": case "text/xml": return "xml";
    case "application/manifest+json": return "webmanifest";
    case "font/woff2": case "application/font-woff2": return "woff2";
    case "font/woff": case "application/font-woff": return "woff";
    case "font/ttf": return "ttf";
    case "font/otf": return "otf";
    case "application/wasm": return "wasm";
    default: return "bin";
  }
}

// ── MCP APPS UI RESOURCES, LEFT OUT OF THE LIST ───────────────────────────────
// (Its docs: "MCP Apps UI resources are entries with a ui:// URI or the text/html;profile=mcp-app media type: pages for a host
// application to render rather than content for Claude to read. They don't appear in … the resource list tool's results …
// Reading a UI resource by its URI still works." Its Yhn, word for word.)
const TOKEN = "[!#$%&'*+.^_`|~0-9A-Za-z-]+";
const TYPE_RE = new RegExp("^[ \\t]*(" + TOKEN + ")/(" + TOKEN + ")");
const PARAM_SRC = "[ \\t\\r\\n]*;[ \\t\\r\\n]*(?:(" + TOKEN + ")=(?:(" + TOKEN + ")|\"((?:[^\"\\\\]|\\\\.)*)\")(?=[ \\t\\r\\n]*(?:;|$)))?";
export function isUiResource(r) {
  const uri = typeof (r && r.uri) === "string" ? r.uri : "", mime = r && r.mimeType;
  if (uri.slice(0, 5).toLowerCase() === "ui://") return true;
  if (typeof mime !== "string" || mime.length > 1024) return false;
  const t = TYPE_RE.exec(mime);
  if (!t || t[1].toLowerCase() !== "text" || t[2].toLowerCase() !== "html") return false;
  const re = new RegExp(PARAM_SRC, "y");
  re.lastIndex = t[0].length;
  for (let m = re.exec(mime); m !== null; m = re.exec(mime)) {
    const [, k, plain, quoted] = m, v = plain ?? (quoted === undefined ? undefined : quoted.replace(/\\(.)/g, "$1"));
    if (typeof k === "string" && k.toLowerCase() === "profile" && typeof v === "string" && v.toLowerCase() === "mcp-app") return true;
  }
  return false;
}
