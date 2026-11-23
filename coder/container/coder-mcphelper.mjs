/**
 * A CONNECTOR'S headersHelper (2026-11-23; Claude Code's headersHelper, "Write the headersHelper command": "at most 500
 * characters of printable ASCII, with no run of four or more spaces"; "print one JSON object of header names and string
 * values on stdout, then exit 0 within 10 seconds"; "if the command exits non-zero, runs past 10 seconds, or prints anything
 * other than a JSON object of string values, the fetch … the command was run for doesn't happen"; "Claude Code reuses one
 * run's output for up to 60 seconds"; routing and client-identity names such as Host, Cookie and X-Forwarded-* dropped,
 * authentication names such as Authorization kept).
 *
 * Coder has no plugin marketplaces, so the command is a Coder setting for its connector requests: the environment's
 * CODER_MCP_HEADERS_HELPER. Coder runs it on its machine as the AI's user (in the chat's project folder) before a connector
 * tool call, and the headers it prints go with that call to the connector's server (src/coder-mcp.mjs callTool).
 */
export const HELPER_MAX_CHARS = 500, HELPER_TIMEOUT_S = 10, HELPER_REUSE_MS = 60_000;
/** The names dropped from its output (request routing and client identity), as Claude Code drops them. */
const DROPPED = /^(?:host|cookie|set-cookie|connection|content-length|content-type|transfer-encoding|te|trailer|upgrade|keep-alive|proxy-.*|x-forwarded-.*|forwarded|x-real-ip|via|origin|referer|user-agent|accept|mcp-session-id|mcp-protocol-version|last-event-id)$/i;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;

/** What is wrong with the command, or "". */
export function helperCommandProblem(cmd) {
  const s = String(cmd ?? "");
  if (!s.trim()) return "headersHelper is empty";
  if (s.length > HELPER_MAX_CHARS) return "headersHelper is longer than " + HELPER_MAX_CHARS + " characters";
  if (!/^[\x20-\x7E]*$/.test(s)) return "headersHelper must be printable ASCII";
  if (/ {4,}/.test(s)) return "headersHelper has a run of four or more spaces";
  return "";
}
/** Its output as headers `{ headers }` (the dropped names left out), or `{ error }`. */
export function helperHeaders(out) {
  let o;
  try { o = JSON.parse(String(out ?? "").trim()); } catch { return { error: "headersHelper did not print a JSON object" }; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { error: "headersHelper did not print a JSON object" };
  const headers = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== "string") return { error: "headersHelper printed a header whose value is not a string: " + k.slice(0, 100) };
    if (!TOKEN.test(k)) return { error: "headersHelper printed a header name that is not valid: " + k.slice(0, 100) };
    if (/[\r\n\0]/.test(v)) return { error: "headersHelper printed a header value with a line break: " + k };
    if (DROPPED.test(k)) continue;
    headers[k.toLowerCase()] = v;
  }
  return { headers };
}
/**
 * The helper for a chat: `run()` gives `{ headers }` or `{ error }`, a run's output reused for 60 seconds. `exec` is Coder's
 * machine's (a command, its time limit; `{ code, output }`); only its stdout is read.
 */
export function headersHelperFor(command, exec, { now = () => Date.now(), reuseMs = HELPER_REUSE_MS } = {}) {
  const cmd = String(command ?? "");
  if (!cmd.trim()) return null;
  let kept = null;
  return {
    async run() {
      const bad = helperCommandProblem(cmd);
      if (bad) return { error: bad };
      if (kept && now() - kept.at < reuseMs) return { headers: { ...kept.headers } };
      let r;
      try { r = await exec({ command: "( " + cmd + " ) 2>/dev/null", timeoutS: HELPER_TIMEOUT_S, tool: true }); }
      catch (e) { return { error: "headersHelper could not be run: " + String((e && e.message) || e).slice(0, 200) }; }
      const code = r && Number.isInteger(r.code) ? r.code : -1;
      if (r && r.timedOut === true) return { error: "headersHelper ran past " + HELPER_TIMEOUT_S + " seconds" };
      if (code !== 0) return { error: code === 124 || code === -1 ? "headersHelper ran past " + HELPER_TIMEOUT_S + " seconds or could not be run (exit " + code + ")" : "headersHelper exited with code " + code };
      const h = helperHeaders(r.output);
      if (h.error) return h;
      kept = { at: now(), headers: h.headers };
      return { headers: { ...h.headers } };
    },
  };
}
/** A connector call wrapped with the helper: its headers go with the call; a failed helper means the call doesn't happen. */
export function withHeadersHelper(mcp, helper) {
  if (typeof mcp !== "function" || !helper) return mcp;
  return async (tool, args, opts = null) => {
    const h = await helper.run();
    if (h.error) return { text: "error: the connector call was not made: " + h.error + " (the environment's CODER_MCP_HEADERS_HELPER)", isError: true };
    return mcp(tool, args, { ...(opts || {}), headers: h.headers });
  };
}
