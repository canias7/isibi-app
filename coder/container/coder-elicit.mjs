/**
 * A CONNECTOR'S QUESTION FOR THE OWNER: MCP ELICITATION, LIKE CLAUDE CODE'S CLOUD SESSIONS (X1 of the recheck of 2026-11-14;
 * the owner: "yes pls all of that").
 *
 * Claude Code's MCP docs: "MCP servers can request structured input from you mid-task using elicitation"; in a cloud session
 * "the request appears as a card": "Form mode: fill in the fields, then click Submit", "URL mode: click Open link, finish the
 * flow it opens, then click I'm done, continue on the card", "To refuse the request, click Decline. Claude continues once the
 * server responds." It declares `elicitation: {form: {}, url: {}}` to the http and sse servers a person configured, on the
 * protocol revisions before 2026-07-28 (2.1.287 and later): Coder's connectors are such servers, reached straight from
 * Coder's Worker, so it declares the same on each of its two kinds of connection (Streamable HTTP and the older SSE one).
 *
 * The parts here have no Node module in them: Coder's Worker (src/coder-mcp.mjs, src/coder-elicit.mjs) and Coder's machine
 * (coder-agent.mjs, server.mjs) both use them.
 */

/** What Coder declares in `initialize` on every connection (Claude Code's YNt() for a configured http/sse server). */
export const ELICIT_CAP = Object.freeze({ form: Object.freeze({}), url: Object.freeze({}) });
export const CLIENT_CAPS = Object.freeze({ elicitation: ELICIT_CAP });

/**
 * The modes a declared capability lets a server ask in (the MCP SDK's getSupportedElicitationModes, which Claude Code uses):
 * a bare `{}` is form mode only, "for backwards compatibility".
 */
export function elicitModes(cap) {
  if (!cap || typeof cap !== "object") return { form: false, url: false };
  const form = cap.form !== undefined, url = cap.url !== undefined;
  return { form: form || (!form && !url), url };
}

/** JSON-RPC's codes for an answer the client gives with an error. */
export const INVALID_PARAMS = -32602, METHOD_NOT_FOUND = -32601;
/** A JSON object of the server's (an elicitation's `requestedSchema`, a field), or not. */
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const strs = (v) => Array.isArray(v) && v.every(isStr);
const optional = (o, k, ok) => o[k] === undefined || ok(o[k]);
const pairs = (v) => Array.isArray(v) && v.every((x) => isObj(x) && isStr(x.const) && isStr(x.title));

/**
 * ONE FIELD OF A FORM, AS CLAUDE CODE'S MCP SDK TAKES ONE (its PrimitiveSchemaDefinition, 2025-11-25): a string (minLength,
 * maxLength, a format of email, uri, date or date-time), a number or an integer (minimum, maximum), a boolean, a single choice
 * (enum, with enumNames, or oneOf of const and title) or several choices (an array whose items are an enum or anyOf), each
 * with an optional title, description and default. Its kind, or "" when it is none of them.
 */
export function fieldKind(s) {
  if (!isObj(s) || !optional(s, "title", isStr) || !optional(s, "description", isStr)) return "";
  if (s.type === "boolean") return optional(s, "default", (v) => typeof v === "boolean") ? "boolean" : "";
  if (s.type === "number" || s.type === "integer") return optional(s, "minimum", isNum) && optional(s, "maximum", isNum) && optional(s, "default", isNum) ? s.type : "";
  if (s.type === "string") {
    if (!optional(s, "default", isStr)) return "";
    if (strs(s.enum) && optional(s, "enumNames", strs)) return "enum";
    if (pairs(s.oneOf)) return "enum";
    return optional(s, "minLength", isNum) && optional(s, "maxLength", isNum) && optional(s, "format", (f) => ["email", "uri", "date", "date-time"].includes(f)) ? "string" : "";
  }
  if (s.type === "array") {
    const it = s.items;
    const items = isObj(it) && ((it.type === "string" && strs(it.enum)) || pairs(it.anyOf));
    return items && optional(s, "minItems", isNum) && optional(s, "maxItems", isNum) && optional(s, "default", strs) ? "multi" : "";
  }
  return "";
}

/**
 * A SERVER'S `elicitation/create`, CHECKED AS CLAUDE CODE'S MCP CLIENT CHECKS IT before anyone is asked: its params are a form
 * (mode "form" or none, a message and a requestedSchema of type object whose properties are fields above) or a URL (mode
 * "url", a message, an elicitationId and a url), and its mode one the client declared. → `{ mode, params }`, or `{ error }`,
 * the JSON-RPC error the server gets in Claude Code's words ("Invalid elicitation request: …", "Client does not support
 * form-mode elicitation requests", "Client does not support URL-mode elicitation requests"; code -32602).
 */
export function checkElicitRequest(params, cap = ELICIT_CAP) {
  const bad = (why) => ({ error: { code: INVALID_PARAMS, message: "Invalid elicitation request: " + why } });
  if (!isObj(params)) return bad("params must be an object");
  if (!isStr(params.message)) return bad("message must be a string");
  let mode;
  if (params.mode === undefined || params.mode === "form") {
    const rs = params.requestedSchema;
    if (!isObj(rs) || rs.type !== "object" || !isObj(rs.properties)) return bad("requestedSchema must be an object schema with properties");
    if (!optional(rs, "required", strs)) return bad("requestedSchema.required must be a list of strings");
    for (const [k, v] of Object.entries(rs.properties)) if (!fieldKind(v)) return bad("requestedSchema.properties." + k + " is not a string, number, integer, boolean or choice field");
    mode = "form";
  } else if (params.mode === "url") {
    if (!isStr(params.elicitationId)) return bad("elicitationId must be a string");
    let ok = false;
    try { new URL(String(params.url)); ok = isStr(params.url); } catch { ok = false; }
    if (!ok) return bad("url must be a URL");
    mode = "url";
  } else return bad("mode must be \"form\" or \"url\"");
  const can = elicitModes(cap);
  if (mode === "form" && !can.form) return { error: { code: INVALID_PARAMS, message: "Client does not support form-mode elicitation requests" } };
  if (mode === "url" && !can.url) return { error: { code: INVALID_PARAMS, message: "Client does not support URL-mode elicitation requests" } };
  return { mode, params };
}

/**
 * AN ANSWER, CHECKED AS CLAUDE CODE'S CLIENT CHECKS ONE BEFORE THE SERVER GETS IT (its ElicitResult: an action of accept,
 * decline or cancel, and content whose values are strings, numbers, booleans or lists of strings): "" when it is one, else
 * what is wrong (the server then gets "Invalid elicitation result: …").
 */
export const ELICIT_ACTIONS = Object.freeze(["accept", "decline", "cancel"]);
export function elicitResultProblem(r) {
  if (!isObj(r)) return "the result must be an object";
  if (!ELICIT_ACTIONS.includes(r.action)) return "action must be accept, decline or cancel";
  if (r.content === undefined || r.content === null) return "";
  if (!isObj(r.content)) return "content must be an object";
  for (const [k, v] of Object.entries(r.content)) if (!(isStr(v) || isNum(v) || typeof v === "boolean" || strs(v))) return "content." + k + " must be a string, number, boolean or list of strings";
  return "";
}
/** The answer the server gets: { result } with only Claude Code's fields, or { error } in its words. */
export function elicitReply(r) {
  const why = elicitResultProblem(r);
  if (why) return { error: { code: INVALID_PARAMS, message: "Invalid elicitation result: " + why } };
  return { result: { action: r.action, ...(r.content !== undefined && r.content !== null ? { content: r.content } : {}) } };
}

/**
 * CLAUDE CODE'S WORDS FOR A TOOL CALL THAT RAN OUT OF TIME WHILE ITS SERVER'S QUESTION WAITED (2.1.310; errors.md: "MCP tool
 * call timed out with the server's question unanswered"), with Coder's word for the person.
 */
export const UNANSWERED = "The server asked the owner a question, and no answer came before the time limit. Do not call this tool again in this turn. Tell the owner that the server's question got no answer, and wait for their reply.";
export const timedOutText = (server, tool, ms) => "MCP server \"" + server + "\" tool \"" + tool + "\" timed out after " + Math.floor(ms / 1000) + "s. " + UNANSWERED;

/** Coder's Worker gives an elicitation an id of its own, for the machine's answer: "e" and lowercase letters and digits. */
export const EID = /^e[a-z0-9]{16,40}$/;
/** At most this much of a server's question goes to the chat (its message and form); a bigger one is cancelled. */
export const ELICIT_EVENT_MAX = 64_000;

// ── ON CODER'S MACHINE ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE OWNER'S ANSWER ON THE CARD, as the server's answer (Claude Code's cloud card): Submit is accept with the fields' values,
 * "I'm done, continue" accept, Decline decline; Stop, the job's time running out and no answer at all are cancel (Claude
 * Code answers a dialog that closed unanswered with cancel). `null` for a card the server itself withdrew: it gets no answer.
 */
export function cardAnswer(a, mode) {
  if (!a) return { action: "cancel" };
  if (a.choice === "gone") return null;
  if (a.choice === "accept") return mode === "form" && isObj(a.content) ? { action: "accept", content: a.content } : { action: "accept" };
  if (a.choice === "decline") return { action: "decline" };
  return { action: "cancel" };
}
/** The card's ending as the page shows it (its `permanswer` choice): never the values, which can be secret. */
export function cardEnding(a) {
  if (!a) return "none";
  return ["accept", "decline", "stop", "gone"].includes(a.choice) ? a.choice : "none";
}

/**
 * WHAT THE OWNER TYPED, CHECKED BEFORE IT GOES ON (the machine's /answer): an object of at most 100 fields whose values are a
 * string (at most 32,768 characters), a number, a boolean or a list of at most 100 strings; null when it is not one.
 */
export function contentFrom(c) {
  if (!isObj(c)) return null;
  const out = {};
  const keys = Object.keys(c);
  if (keys.length > 100) return null;
  for (const k of keys) {
    const v = c[k];
    if (k.length > 200) return null;
    if (isStr(v)) { if (v.length > 32_768) return null; out[k] = v; }
    else if (isNum(v) || typeof v === "boolean") out[k] = v;
    else if (strs(v) && v.length <= 100 && v.every((x) => x.length <= 32_768)) out[k] = v.slice();
    else return null;
  }
  return out;
}

/**
 * WHAT ELICITATION HOOKS SAID TOGETHER (Claude Code's: its runner reads each hook's answer, then "When several hooks match the
 * same request, a decline from one of them overrides an accept or cancel from another"). `runs`: `[{ code, result }]`, a
 * hook's exit code (0 for an HTTP hook's 2xx answer) and Coder's reading of its output (coder-hooks.mjs hookResult). A
 * hook that blocks (exit 2, or onFailure "block" when it fails) or prints a top-level "decision": "block", or answers
 * "decline", declines; a hook's hookSpecificOutput with an `action` counts only when it exited 0 ("Claude Code applies your
 * hookSpecificOutput when your hook exits 0, and ignores it on any other exit code"). → `{ blocked, response }`.
 */
export function elicitHookVerdict(event, runs) {
  let blocked = false, response = null;
  for (const { code, result } of Array.isArray(runs) ? runs : []) {
    if (!result) continue;
    if (result.kind === "block") { blocked = true; continue; }
    if (result.kind !== "ok" || code !== 0) continue;
    const j = result.json;
    if (!isObj(j)) continue;
    if (j.decision === "block") { blocked = true; continue; }
    const sp = j.hookSpecificOutput;
    if (!isObj(sp) || sp.hookEventName !== event || sp.action === undefined) continue;
    // (Its output's schema: an action of accept, decline or cancel, content an object; anything else is no answer.)
    if (!ELICIT_ACTIONS.includes(sp.action) || (sp.content !== undefined && !isObj(sp.content))) continue;
    response = { action: sp.action, ...(sp.content !== undefined ? { content: sp.content } : {}) };
    if (sp.action === "decline") blocked = true;
  }
  return { blocked, response };
}
/** An Elicitation hook's answer for the server (decline when one blocked), or null to leave the request to the card. */
export function elicitHookAnswer(v) {
  if (v.blocked) return { action: "decline" };
  return v.response ? { action: v.response.action, ...(v.response.content !== undefined ? { content: v.response.content } : {}) } : null;
}
/**
 * The answer after ElicitationResult hooks (Claude Code: a block is decline, "without the user's values"; an `action` replaces
 * the owner's, and its `content` theirs, else theirs stays: "cancel, along with the values the user submitted").
 */
export function afterResultHooks(v, owner) {
  if (v.blocked) return { action: "decline" };
  if (!v.response) return owner;
  const content = v.response.content !== undefined ? v.response.content : owner.content;
  return { action: v.response.action, ...(content !== undefined ? { content } : {}) };
}
/** Claude Code's Notification hooks around a question (its `elicitation_response` and `elicitation_complete` types). */
export const responseNotice = (server, action) => ({ message: "Elicitation response for server \"" + server + "\": " + action, notification_type: "elicitation_response" });
export const completeNotice = (server, id) => ({ message: "MCP server \"" + server + "\" confirmed elicitation " + id + " complete", notification_type: "elicitation_complete" });
/** The connector's name in its tools' names (mcp__<server>__<tool>), as Claude Code's hooks see a server's. */
export const serverOf = (toolName) => (/^mcp__([a-z0-9_-]+?)__/.exec(String(toolName || "")) || [])[1] || "";

/**
 * A CALL STILL RUNNING AFTER `ms` GOES TO THE BACKGROUND, BUT NOT WHILE ITS SERVER'S QUESTION IS OPEN (Claude Code: "A call
 * waiting on an open elicitation dialog isn't backgrounded while the dialog is open; the server is blocked on your input,
 * not slow, so Claude Code defers the move until the dialog closes"). `q`: the call's questions ({ open(), closed() }), or
 * null. → `{ x }` when the call ended, `{ stop: true }` when the owner pressed Stop on its card, null to move it.
 */
export async function untilBackground(running, ms, q = null) {
  const done = running.then((x) => ({ x }));
  const stopped = q && typeof q.stopped === "function" ? q.stopped().then(() => ({ stop: true })) : new Promise(() => {});
  let timer;
  const late = new Promise((ok) => { timer = setTimeout(() => ok(null), ms); });
  try {
    for (;;) {
      const r = await Promise.race([done, stopped, late]);
      if (r) return r;
      if (!q || q.open() === 0) return null;
      // (The question is open: the move waits until it closes, the call ends, or Stop.)
      const after = await Promise.race([done, stopped, q.closed().then(() => null)]);
      if (after) return after;
    }
  } finally { clearTimeout(timer); }
}

/**
 * A CONNECTOR CALL'S STREAM, ITS QUESTIONS ASKED (the machine's connectorCaller): each `elicit` line goes to
 * `ask.elicit(line)`, whose answer ({ result } or { error }; null for none) `post` sends back to Coder's Worker with the job's
 * pass (tried up to 3 times); `withdraw` and `complete` lines go to the ask too. The call's own answer, or null.
 */
export async function askedCall(res, ask, post, { wait = (ms) => new Promise((ok) => setTimeout(ok, ms)) } = {}) {
  const send = async (a) => { for (let k = 0; k < 3; k++) { try { if (await post(a)) return; } catch { /* again */ } await wait(1000 * (k + 1)); } };
  return readCallStream(res, (o) => {
    if (o.t === "elicit" && EID.test(String(o.id || ""))) Promise.resolve().then(() => ask.elicit(o)).then((a) => (a ? send({ id: o.id, ...a }) : null)).catch(() => {});
    else if (o.t === "withdraw" && typeof o.id === "string") ask.withdraw(o.id);
    else if (o.t === "complete" && typeof ask.complete === "function") ask.complete(o);
  });
}

/**
 * THE WORKER'S STREAM OF A CONNECTOR CALL (one JSON object a line): its `elicit`, `withdraw` and `complete` lines go to
 * `on(line)` as they come, and the call's own answer (`result`) is given back; null when the stream ended without one.
 */
export async function readCallStream(res, on) {
  if (!res.body || typeof res.body.getReader !== "function") return null;
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  const take = (line) => {
    if (!line.trim()) return null;
    let o;
    try { o = JSON.parse(line); } catch { return null; }
    if (!isObj(o)) return null;
    if (o.t === "result") return o;
    try { on(o); } catch { /* the call goes on */ }
    return null;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let k;
    while ((k = buf.indexOf("\n")) >= 0) {
      const r = take(buf.slice(0, k));
      buf = buf.slice(k + 1);
      if (r) { reader.cancel().catch(() => {}); return r; }
    }
    if (buf.length > 64_000_000) break;
  }
  return take(buf + dec.decode());
}
