// MCP 2026-07-28 ON CODER'S WORKER, AS CLAUDE CODE 2.1.325 SPEAKS IT TO A CONNECTOR (round 6; the owner, 2026-11-14: "do
// what claude code does").
//
// Claude Code's MCP docs ("MCP client runtimes"): on its v2 runtime it "asks HTTP, stdio, and claude.ai connector servers
// whether they support the newer revision and uses it with those that do. That includes the connectors of cloud and Remote
// Control sessions"; its changelog: "Changed cloud session and Remote Control MCP connectors to negotiate MCP protocol version
// 2026-07-28 by default". Its program (2.1.325: its MCP SDK 2.0 client, `_connectNegotiated` and the probe `cl`, and its own
// connect, which picks `{ mode: "auto", probe: { timeoutMs: min(5000, MCP_TIMEOUT / 3) } }` for an http server and the
// earlier handshake for an sse one):
//   - before anything else it POSTs `server/discover`, id "server-discover-probe-1", whose `_meta` carries the protocol
//     version, its clientInfo and its client capabilities; the request's headers MCP-Protocol-Version: 2026-07-28 and
//     Mcp-Method: server/discover (no session, no initialize);
//   - a valid DiscoverResult that lists 2026-07-28 makes the connection that revision's; a JSON-RPC error -32022 that lists
//     2026-07-28 is asked once more ("corrective"), one that lists only other new revisions ends the connection with the
//     server's error, a 401 (or a 403 insufficient_scope) is a sign-in; anything else (another error or status, a reply it
//     can't read, a reply to another id, a stream that ends, no answer within the probe's 5 seconds, a network failure)
//     is a server of the earlier revisions: the 2025-11-25 `initialize` handshake follows, as before.
// On a 2026-07-28 connection (its spec's Key Changes, and the same client): no session (no Mcp-Session-Id), no GET stream and
// no stream taken up again by the server's ids; every request carries the envelope in its `_meta` and the headers
// MCP-Protocol-Version, Mcp-Method and Mcp-Name (a tool's or prompt's name, a resource's uri; Base64 in its sentinel when not
// plain ASCII), and a tool call the Mcp-Param-* headers its tool's `x-mcp-header` properties name; every result has a
// `resultType` (one left out is taken as "complete", as Claude Code fills it in); the server's questions (elicitation,
// roots) come in an `input_required` result, answered by calling again with `inputResponses` and its `requestState`, up to
// 10 rounds; its requests on a stream are dropped. Tasks: Claude Code's cloud sessions run no MCP tasks (its docs: tasks are
// on in "terminal CLI sessions, Agent SDK sessions, and GitHub Actions runs"; its program: off by default when
// CLAUDE_CODE_REMOTE is set), so a task answer is its error "Unsupported result type 'task' for tools/call".
//
// No Node module here: the Worker loads this file.

/** The newer revision, the only one of its kind Claude Code 2.1.325 speaks (its `kn`). */
export const MODERN_VERSION = "2026-07-28";
/** Is a version one of the newer revisions (its `et`: "2026-07-28" and later)? */
export const isModern = (v) => typeof v === "string" && v >= MODERN_VERSION;
/** The probe's bound: min(5000, MCP_TIMEOUT / 3), MCP_TIMEOUT 30,000 by default. */
export const PROBE_TIMEOUT_MS = 5000;
/** The probe's id, "server-discover-probe-" and its count. */
export const PROBE_ID = "server-discover-probe-";
/** The envelope's keys in a request's `_meta`. */
export const META_VERSION = "io.modelcontextprotocol/protocolVersion", META_CLIENT = "io.modelcontextprotocol/clientInfo", META_CAPS = "io.modelcontextprotocol/clientCapabilities";
/** JSON-RPC codes of the newer revision (UnsupportedProtocolVersion, HeaderMismatch, MissingRequiredClientCapability). */
export const UNSUPPORTED_PROTOCOL = -32022, HEADER_MISMATCH = -32020, MISSING_CAPABILITY = -32021;
/** Its multi round-trip requests: at most 10 rounds (inputRequired.maxRounds), 250 ms before a retry that answers nothing. */
export const ROUNDS_MAX = 10, EMPTY_ROUND_MS = 250;
/** The kinds of input a server may ask for in an `input_required` result. */
export const INPUT_METHODS = Object.freeze(["elicitation/create", "sampling/createMessage", "roots/list"]);

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** A request's envelope (its outboundEnvelope): the version, who asks, what it can do. */
export const envelope = (version, client, caps) => ({ [META_VERSION]: version, [META_CLIENT]: client, [META_CAPS]: caps });
/** A request's params with the envelope in its `_meta`, the request's own keys after it (its _envelopeOutbound). */
export const withEnvelope = (params, version, client, caps) => { const p = isObj(params) ? params : {}; return { ...p, _meta: { ...envelope(version, client, caps), ...(isObj(p._meta) ? p._meta : {}) } }; };

// ── HEADERS ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SENTINEL_START = "=?base64?", SENTINEL_END = "?=";
/** Whether a header value must go in Base64 (its fu): empty, the sentinel's own shape, spaces at an end, or not tab or 0x20-0x7E. */
function needsBase64(s) {
  if (s.length === 0) return true;
  if (s.startsWith(SENTINEL_START) && s.endsWith(SENTINEL_END)) return true;
  if (s !== s.trim()) return true;
  for (let i = 0; i < s.length; i++) { const c = s.codePointAt(i); if (c === 9 || (c >= 32 && c <= 126)) continue; return true; }
  return false;
}
const base64Utf8 = (s) => { let r = ""; for (const b of new TextEncoder().encode(s)) r += String.fromCodePoint(b); return btoa(r); };
/** A header value as the newer revision sends one (its Ma): as it is, or "=?base64?<its UTF-8 in Base64>?=". */
export const headerValue = (s) => (needsBase64(String(s)) ? SENTINEL_START + base64Utf8(String(s)) + SENTINEL_END : String(s));

/**
 * A REQUEST'S HEADERS ON A 2026-07-28 CONNECTION (its transport's _commonHeaders and _applyBodyDerivedHeaders): the
 * version, Mcp-Method, Mcp-Name (a resource's uri for resources/read, a task's id for tasks/*, else the request's name), the
 * sign-in, and `extra` (a tool call's Mcp-Param-*); never a session.
 */
export function modernHeaders(msg, version, token = "", extra = null) {
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": version, "mcp-method": String(msg.method) };
  const p = isObj(msg.params) ? msg.params : {};
  const name = msg.method === "resources/read" ? (typeof p.uri === "string" ? p.uri : undefined) : typeof p.name === "string" ? p.name : undefined;
  if (name !== undefined) h["mcp-name"] = headerValue(name);
  if (String(msg.method).startsWith("tasks/") && typeof p.taskId === "string") h["mcp-name"] = headerValue(p.taskId);
  if (token) h.authorization = "Bearer " + token;
  return { ...h, ...(extra || {}) };
}

const TOKEN_CHARS = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const HEADER_TYPES = new Set(["string", "integer", "boolean", "number"]);
const BELOW = ["items", "prefixItems", "contains", "additionalProperties", "unevaluatedProperties", "unevaluatedItems", "propertyNames", "patternProperties", "dependentSchemas", "oneOf", "anyOf", "allOf", "not", "if", "then", "else", "$defs", "definitions"];
const MAPS = new Set(["patternProperties", "dependentSchemas", "$defs", "definitions"]);
const pathText = (p) => (p.length === 0 ? "<root>" : p.join("."));
/**
 * A TOOL'S `x-mcp-header` PROPERTIES (its An): `{ valid: true, declarations: [{ path, headerName, type }] }`, or
 * `{ valid: false, reason }` in its words (an annotation not reached by `properties` alone, not a token, not on a primitive,
 * or the same name twice). On a 2026-07-28 connection a tool with an invalid one is left out of the list.
 */
export function xMcpHeaders(schema) {
  const decls = [], names = new Map();
  const walk = (n, path, reachable) => {
    if (n === null || typeof n !== "object") return undefined;
    if ("x-mcp-header" in n) {
      if (!reachable || path.length === 0) return pathText(path) + ": x-mcp-header is only permitted on properties statically reachable via a chain of 'properties' keys (not under items, additionalProperties, oneOf/anyOf/allOf/not, if/then/else, or $ref)";
      const name = n["x-mcp-header"];
      if (typeof name !== "string" || name.length === 0) return pathText(path) + ": x-mcp-header MUST be a non-empty string";
      if (!TOKEN_CHARS.test(name)) return pathText(path) + ": x-mcp-header '" + name + "' is not a valid RFC 9110 token (no spaces, control characters or HTTP delimiters)";
      const type = typeof n.type === "string" ? n.type : undefined;
      if (type === undefined || !HEADER_TYPES.has(type)) return pathText(path) + ": x-mcp-header is only permitted on primitive-typed properties (string, integer, boolean); got " + (type ?? "<none>");
      const low = name.toLowerCase(), was = names.get(low);
      if (was !== undefined) return "x-mcp-header '" + name + "' is not case-insensitively unique (also declared as '" + was + "')";
      names.set(low, name);
      decls.push({ path, headerName: name, type });
    }
    if (n.properties !== null && typeof n.properties === "object") for (const [k, v] of Object.entries(n.properties)) { const e = walk(v, [...path, k], reachable); if (e !== undefined) return e; }
    for (const kw of BELOW) {
      const v = n[kw];
      if (v === undefined) continue;
      const list = Array.isArray(v) ? v : v !== null && typeof v === "object" && MAPS.has(kw) ? Object.values(v) : [v];
      for (const x of list) { const e = walk(x, [...path, "<" + kw + ">"], false); if (e !== undefined) return e; }
    }
    return undefined;
  };
  const why = walk(schema, [], true);
  return why === undefined ? { valid: true, declarations: decls } : { valid: false, reason: why };
}
/** A value as a header's text (its pu): a string, true or false, a finite number (a safe one when whole); else none. */
function paramText(v) {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") { if (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v))) return undefined; return String(v); }
  return undefined;
}
/** A tool call's Mcp-Param-<name> headers from its arguments (its rc): one for each declaration whose value is there. */
export function paramHeaders(decls, args) {
  const out = {};
  for (const d of Array.isArray(decls) ? decls : []) {
    if (!d || !Array.isArray(d.path) || typeof d.headerName !== "string") continue;
    let v = args;
    for (const k of d.path) { if (v === null || typeof v !== "object") { v = undefined; break; } v = v[k]; }
    if (v === undefined || v === null) continue;
    const t = paramText(v);
    if (t !== undefined) out["Mcp-Param-" + d.headerName] = headerValue(t);
  }
  return out;
}

// ── THE PROBE ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const CAP_PARTS = ["experimental", "logging", "completions", "prompts", "resources", "tools", "extensions"];
/** A server/discover result as its schema takes one (supportedVersions, capabilities, instructions, _meta), or null. */
export function discoverResult(r) {
  if (!isObj(r) || !Array.isArray(r.supportedVersions) || !r.supportedVersions.every((v) => typeof v === "string") || !isObj(r.capabilities)) return null;
  if (r.instructions !== undefined && typeof r.instructions !== "string") return null;
  if (r._meta !== undefined && !isObj(r._meta)) return null;
  for (const k of CAP_PARTS) if (r.capabilities[k] !== undefined && !isObj(r.capabilities[k])) return null;
  for (const k of ["prompts", "resources", "tools"]) { const c = r.capabilities[k]; if (c && c.listChanged !== undefined && typeof c.listChanged !== "boolean") return null; }
  return { supportedVersions: r.supportedVersions.slice(), capabilities: r.capabilities, ...(typeof r.instructions === "string" ? { instructions: r.instructions } : {}), ...(isObj(r._meta) ? { _meta: r._meta } : {}) };
}
/** Its error for a server that names only other new revisions (UnsupportedProtocolVersionError, the server's message). */
const unsupported = (message, supported, requested) => Object.assign(new Error("the MCP server said: " + String(message || "Unsupported protocol version: " + requested).slice(0, 300)), { rpcCode: UNSUPPORTED_PROTOCOL, supported });
/** A JSON-RPC error's verdict (its al): -32022 naming 2026-07-28 is asked again, naming only others ends; else the earlier revision. */
function errorVerdict(err, requested) {
  if (!isObj(err) || err.code !== UNSUPPORTED_PROTOCOL) return { kind: "legacy" };
  const d = isObj(err.data) ? err.data : null;
  const supported = d && Array.isArray(d.supported) && d.supported.length > 0 && d.supported.every((v) => typeof v === "string") ? d.supported : null;
  if (!supported) return { kind: "legacy" };
  const newer = supported.filter(isModern);
  const asked = d && typeof d.requested === "string" ? d.requested : requested;
  if (newer.includes(MODERN_VERSION)) return { kind: "corrective", version: MODERN_VERSION, error: unsupported(err.message, supported, asked) };
  if (newer.length) return { kind: "error", error: unsupported(err.message, supported, asked) };
  return { kind: "legacy" };
}
/** The verdict on what the probe got (its Kh, Gh, al and Jh, with its connect's own fallback for a failure or a timeout). */
export function probeVerdict(got, requested = MODERN_VERSION) {
  switch (got.kind) {
    case "result": { const d = discoverResult(got.result); if (!d) return { kind: "legacy", why: "result" }; return d.supportedVersions.includes(MODERN_VERSION) ? { kind: "modern", version: MODERN_VERSION, discover: d } : { kind: "legacy", why: "versions" }; }
    case "rpc-error": return { ...errorVerdict(got.error, requested), why: "rpc-error" };
    case "http-error": { let j = null; try { j = JSON.parse(String(got.body || "")); } catch { j = null; } return isObj(j) && isObj(j.error) && typeof j.error.code === "number" ? { ...errorVerdict(j.error, requested), why: "http-error" } : { kind: "legacy", why: "http-error" }; }
    default: return { kind: "legacy", why: got.kind };
  }
}

/** A JSON-RPC response (its CNe or RNe): `{ id, result }` or `{ id, error }`, or null. */
function response(x) {
  if (!isObj(x) || x.jsonrpc !== "2.0" || "method" in x) return null;
  if ("result" in x) return (typeof x.id === "string" || Number.isSafeInteger(x.id)) && isObj(x.result) ? x : null;
  if ("error" in x) return isObj(x.error) && Number.isSafeInteger(x.error.code) && typeof x.error.message === "string" ? x : null;
  return null;
}
/** What one probe got (its rm): result, rpc-error, http-error, auth-required, id-mismatch, malformed, stream-end, timeout or network-error. */
async function probeOnce(url, token, id, version, { fetchFn, timeoutMs, client, caps }) {
  const msg = { jsonrpc: "2.0", id, method: "server/discover", params: { _meta: envelope(version, client, caps) } };
  const ctl = new AbortController();
  let timer = null;
  const late = new Promise((ok) => { timer = setTimeout(() => ok({ kind: "timeout" }), timeoutMs); });
  // (A reply to any other id, or to none, is its McpProbeIdMismatchError: "treating the server as pre-2026-07-28".)
  const answered = (x) => { const r = response(x); if (!r) return null; if (r.id === id) return "error" in r ? { kind: "rpc-error", error: r.error } : { kind: "result", result: r.result }; return { kind: "id-mismatch" }; };
  const run = (async () => {
    let res;
    try { res = await fetchFn(url, { method: "POST", headers: modernHeaders(msg, version, token), body: JSON.stringify(msg), signal: ctl.signal }); }
    catch (error) { return { kind: "network-error", error }; }
    const www = String(res.headers.get("www-authenticate") || "");
    if (res.status === 401 || (res.status === 403 && /error="?insufficient_scope/i.test(www))) { try { if (res.body) await res.body.cancel(); } catch { /* read */ } return { kind: "auth-required", header: www }; }
    if (!res.ok) return { kind: "http-error", status: res.status, body: await res.text().catch(() => "") };
    // (Accepted with no answer, or a reply with nothing for the probe: none comes, so it is the probe's timeout.)
    if (res.status === 202) { try { if (res.body) await res.body.cancel(); } catch { /* read */ } return { kind: "timeout" }; }
    const type = String(res.headers.get("content-type") || "");
    if (/application\/json/i.test(type)) {
      let j;
      try { j = JSON.parse(await res.text()); } catch { return { kind: "malformed" }; }
      for (const x of Array.isArray(j) ? j : [j]) { const a = answered(x); if (a) return a; }
      return { kind: "timeout" };
    }
    if (/text\/event-stream/i.test(type) && res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      const take = (block) => {
        let event = "", data = [];
        for (const l of block.split(/\r?\n/)) { const k = l.indexOf(":"); const name = k < 0 ? l : l.slice(0, k), v = k < 0 ? "" : l.slice(k + 1).replace(/^ /, ""); if (name === "data") data.push(v); else if (name === "event") event = v; }
        if (!data.length || (event && event !== "message")) return null;
        let j;
        try { j = JSON.parse(data.join("\n")); } catch { return { kind: "malformed" }; }
        return answered(j);
      };
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let cut;
          while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) { const a = take(buf.slice(0, cut)); buf = buf.slice(cut).replace(/^\r?\n\r?\n/, ""); if (a) { reader.cancel().catch(() => {}); return a; } }
        }
      } catch { return { kind: "stream-end" }; }
      const a = buf.trim() ? take(buf) : null;
      return a || { kind: "stream-end" };
    }
    // (Another kind of answer: its transport's "Unexpected content type", a failed probe.)
    try { if (res.body) await res.body.cancel(); } catch { /* read */ }
    return { kind: "network-error", error: new Error("Unexpected content type: " + type) };
  })();
  try { return await Promise.race([run, late]); } finally { clearTimeout(timer); ctl.abort(); }
}

/**
 * CLAUDE CODE'S PROBE (its `cl`, in "auto" mode for an http server): `{ kind: "modern", version, discover }`, or
 * `{ kind: "legacy", why }` for a server of the earlier revisions. A sign-in is `onAuth(header)`'s to throw; a server that
 * names only other new revisions, or answers -32022 twice, ends the connection with its error.
 */
export async function discoverProbe(url, token, { fetchFn = fetch, timeoutMs = PROBE_TIMEOUT_MS, client, caps, onAuth } = {}) {
  let version = MODERN_VERSION, corrected = false;
  for (let n = 1; ; n++) {
    const got = await probeOnce(url, token, PROBE_ID + n, version, { fetchFn, timeoutMs, client, caps });
    if (got.kind === "auth-required") throw onAuth(got.header);
    const v = probeVerdict(got, version);
    if (v.kind === "corrective") { if (corrected) throw v.error; corrected = true; version = v.version; continue; }
    if (v.kind === "error") throw v.error;
    return v;
  }
}

// ── RESULTS ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A RESULT ON A 2026-07-28 CONNECTION (its decodeResult, after its own fill-in of a missing resultType as "complete"):
 * `{ result }` without its resultType, `{ input: { inputRequests, requestState? } }` for input_required, or `{ error,
 * malformed? }` in its words (a task, another type, or one it can't read).
 */
export function decodeResult(method, r) {
  if (!isObj(r)) return { error: "Invalid result for " + method + ": not an object", malformed: true };
  const t = r.resultType === undefined ? "complete" : r.resultType;
  if (typeof t !== "string") return { error: "Invalid result for " + method + ": non-string resultType", malformed: true };
  if (t === "input_required") {
    const reqs = isObj(r.inputRequests) ? r.inputRequests : {}, state = r.requestState;
    if (Object.keys(reqs).length === 0 && typeof state !== "string") return { error: "Invalid result for " + method + ": input_required carries neither inputRequests nor requestState (every input_required result must include at least one of the two)", malformed: true };
    return { input: { inputRequests: reqs, ...(typeof state === "string" ? { requestState: state } : {}) } };
  }
  if (t !== "complete") return { error: "Unsupported result type '" + t + "' for " + method };
  const { resultType, ...rest } = r;
  return { result: rest };
}
/** Its words for a result it couldn't read, by the connector's name (its McpResponseSchemaError). */
export const malformedResult = (server, why) => "MCP server \"" + server + "\" returned a malformed result that failed schema validation: " + why;
/** Its words for input it does not serve: an entry that is not a request it knows (a malformed result), and sampling. */
export const NOT_SERVED = "its answer asked for input of a kind this client does not serve, so the call was not made again";
export const noHandler = (server, method) => "MCP server \"" + server + "\" asked for input this client could not serve" + (INPUT_METHODS.includes(method) ? " (" + method + ")" : "") + ", so the call was not made again";
/** Its words when a request still asks for input after ROUNDS_MAX rounds. */
export const roundsExceeded = (method) => "Multi-round-trip request '" + method + "' still required input after " + ROUNDS_MAX + " rounds (inputRequired.maxRounds)";
/** The params of the call made again (its Au): the first call's, with the answers and the server's requestState. */
export function retryParams(params, responses, requestState) {
  const has = responses && Object.keys(responses).length > 0;
  return { ...(isObj(params) ? params : {}), ...(has ? { inputResponses: responses } : {}), ...(requestState !== undefined ? { requestState } : {}) };
}
