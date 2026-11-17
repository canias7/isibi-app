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
 * Not copied: its third one, ReadMcpResourceDirTool (`resources/directory/read`). 2.1.326 offers it with the other two, but
 * every call it takes answers "Directory listing is not enabled in this build." (its E5t is `return !1`; tried the same day).
 */
import { typeIssue, unknownKeysIssue, inputErrorText } from "./coder-zodtext.mjs";

export const LIST_TOOL = "list_mcp_resources", READ_TOOL = "read_mcp_resource";
/** Claude Code's names for them, for hooks and rules. */
export const CC_LIST = "ListMcpResourcesTool", CC_READ = "ReadMcpResourceTool";
export const RESOURCE_TOOLS = Object.freeze([LIST_TOOL, READ_TOOL]);

/** Their descriptions, word for word (2.1.326's ALa and PLa: the ones a Claude Code cloud session gives its model). */
export const LIST_DESCRIPTION = "\nList available resources from configured MCP servers.\nEach returned resource will include all standard MCP resource fields plus a 'server' field \nindicating which server the resource belongs to.\n\nParameters:\n- server (optional): The name of a specific MCP server to get resources from. If not provided,\n  resources from all servers will be returned.\n";
export const READ_DESCRIPTION = "\nReads a specific resource from an MCP server, identified by server name and resource URI.\n\nParameters:\n- server (required): The name of the MCP server from which to read the resource\n- uri (required): The URI of the resource to read\n";
/** Their inputs, as its schemas give them (and nothing else: its strict objects). */
export const LIST_PROPERTIES = Object.freeze({ server: { type: "string", description: "Optional server name to filter resources by" } });
export const READ_PROPERTIES = Object.freeze({ server: { type: "string", description: "The MCP server name" }, uri: { type: "string", description: "The resource URI to read" } });
export const READ_REQUIRED = Object.freeze(["server", "uri"]);
export const LIST_TOOL_DEF = Object.freeze({ type: "function", function: { name: LIST_TOOL, description: LIST_DESCRIPTION, parameters: { type: "object", properties: LIST_PROPERTIES, additionalProperties: false } } });
export const READ_TOOL_DEF = Object.freeze({ type: "function", function: { name: READ_TOOL, description: READ_DESCRIPTION, parameters: { type: "object", properties: READ_PROPERTIES, required: [...READ_REQUIRED], additionalProperties: false } } });
/** Their search hints, Claude Code's own (its `searchHint`), for tool_search. */
export const LIST_HINT = "list resources from connected MCP servers", READ_HINT = "read a specific MCP resource by URI";

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
/** read_mcp_resource's input: `server` and `uri` strings, nothing else. Refused in its words. */
export function checkReadInput(args) {
  const a = obj(args), issues = [];
  if (typeof a.server !== "string") issues.push(typeIssue("string", a.server, ["server"]));
  if (typeof a.uri !== "string") issues.push(typeIssue("string", a.uri, ["uri"]));
  const unknown = Object.keys(a).filter((k) => k !== "server" && k !== "uri");
  if (unknown.length) issues.push(unknownKeysIssue(unknown));
  return issues.length ? { error: inputErrorText(READ_TOOL, issues) } : { args: a };
}

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
export const resourceNotFound = (uri) => "Resource not found: " + uri + " — it may have been deleted or the URI is stale. Re-run " + LIST_TOOL + " to refresh.";
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
