// A CONNECTOR'S QUESTION FOR THE OWNER: MCP ELICITATION, LIKE CLAUDE CODE'S CLOUD SESSIONS (X1 of the recheck of 2026-11-14;
// the owner: "yes pls all of that"). Claude Code's side, from its docs of 2026-11-14 and its program (2.1.325): it declares
// `elicitation: {form: {}, url: {}}` to the http and sse servers a person configured; in a cloud session the question is a card
// ("Form mode: fill in the fields, then click Submit"; "URL mode: click Open link, finish the flow it opens, then click I'm
// done, continue"; "To refuse the request, click Decline"); its Elicitation and ElicitationResult hooks come before and
// after the card; a request it cannot serve is answered in its MCP client's words; a server that cancels its question gets
// no answer; with no one to ask, cancel. A stand-in MCP server asks here: no real connector, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const M = await import("../src/coder-mcp.mjs");
const W = await import("../src/coder-elicit.mjs");
const E = await import("../container/coder-elicit.mjs");
const A = await import("../container/coder-agent.mjs");
const ERA = await import("../src/coder-mcp-era.mjs");
const { seal } = await import("../src/coder-github.mjs");
const { modelPass } = await import("../src/coder-model-gate.mjs");

const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://jessica.gofarther.dev" };
function memBucket() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); }, delete: async (k) => { m.delete(k); } };
}
const enc = new TextEncoder();
const FORM = { message: "Which project should the issue go in?", requestedSchema: { type: "object", properties: { project: { type: "string", title: "Project key", minLength: 2 }, urgent: { type: "boolean", title: "Urgent" } }, required: ["project"] } };
const URLQ = { mode: "url", message: "Sign in to Linear to go on.", elicitationId: "el-42", url: "https://linear.example.com/oauth?state=abc" };

/**
 * A STAND-IN MCP SERVER at https://mcp.example.com/mcp (Streamable HTTP): `script({ msg, emit, reply })` runs a tool call,
 * sending what it likes on the call's event stream (`emit`) and waiting for Coder's answer to one of its own requests
 * (`reply(id)`); what it returns is the call's result. Everything Coder POSTs is in `seen`.
 */
function asker(script) {
  const seen = [], replies = new Map(), waiters = new Map();
  const reply = (id) => (replies.has(id) ? Promise.resolve(replies.get(id)) : new Promise((ok) => waiters.set(id, ok)));
  const fetchFn = async (url, init = {}) => {
    const msg = JSON.parse(init.body);
    seen.push({ url: String(url), msg, headers: init.headers || {} });
    if (!("method" in msg)) { replies.set(msg.id, msg); const w = waiters.get(msg.id); if (w) { waiters.delete(msg.id); w(msg); } return new Response(null, { status: 202 }); }
    if (!("id" in msg)) return new Response(null, { status: 202 });
    const json = (v) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json", "mcp-session-id": "s1" } });
    if (msg.method === "initialize") return json({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } } });
    if (msg.method === "tools/list") return json({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "make_issue", inputSchema: { type: "object", properties: {} } }] } });
    if (msg.method === "tools/call") {
      const body = new ReadableStream({ async start(c) {
        const emit = (o) => { try { c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify(o) + "\n\n")); } catch { /* closed */ } };
        const result = await script({ msg, emit, reply });
        if (result !== undefined) emit({ jsonrpc: "2.0", id: msg.id, result });
        try { c.close(); } catch { /* closed */ }
      } });
      return new Response(body, { headers: { "content-type": "text/event-stream", "mcp-session-id": "s1" } });
    }
    return json({ jsonrpc: "2.0", id: msg.id, result: {} });
  };
  return { fetchFn, seen, replies };
}
const textOf = (r) => ({ content: [{ type: "text", text: r }] });
/** The machine's side of a stream as a test holds it: questions recorded, answered by `answer(q)`. */
function machine(answer = async () => null) {
  const lines = [], withdrawn = [];
  let got;
  const ready = new Promise((ok) => { got = ok; });
  return { lines, withdrawn, ready, ask: { send: async (o) => { lines.push(o); if (o.t === "elicit") got(o); if (o.t === "withdraw") withdrawn.push(o.id); }, wait: async (eid, signal) => { const q = lines.find((x) => x.id === eid); const r = await Promise.race([answer(q), new Promise((ok) => signal.addEventListener("abort", () => ok(null), { once: true }))]); return signal.aborted ? null : r; } } };
}

test("EL1 the client capabilities: roots (with list changes) and elicitation form and url on both of Coder's kinds of connection (Streamable HTTP and the older SSE), as Claude Code declares to a configured http or sse server (round 5: its roots too)", async () => {
  const CAPS = { roots: { listChanged: true }, elicitation: { form: {}, url: {} } };
  assert.deepEqual(E.CLIENT_CAPS, CAPS);
  assert.deepEqual(Object.keys(E.CLIENT_CAPS), ["roots", "elicitation"], "in Claude Code's order (its _Us, then YNt's elicitation)");
  const s = asker(async () => textOf("ok"));
  await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/list", {}]], { fetchFn: s.fetchFn });
  assert.deepEqual(s.seen.find((x) => x.msg.method === "initialize").msg.params.capabilities, CAPS);
  // The older SSE transport: the same declaration.
  const posted = [];
  const sse = async (url, init = {}) => {
    if ((init.method || "GET") === "GET") {
      const body = new ReadableStream({ start(c) { c.enqueue(enc.encode("event: endpoint\ndata: /messages?sid=1\n\n")); sse.c = c; } });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    }
    const msg = JSON.parse(init.body);
    posted.push(msg);
    if ("id" in msg && "method" in msg) setTimeout(() => sse.c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: msg.method === "initialize" ? { protocolVersion: "2024-11-05", capabilities: {} } : { tools: [] } }) + "\n\n")), 5);
    return new Response(null, { status: 202 });
  };
  await M.sseSession("https://mcp.example.com/sse", "", [["tools/list", {}]], { fetchFn: sse });
  assert.deepEqual(posted.find((x) => x.method === "initialize").params.capabilities, CAPS);
  // The modes a declaration lets a server ask in (the MCP SDK's rule, which Claude Code uses): a bare {} is form only.
  assert.deepEqual(E.elicitModes({ form: {}, url: {} }), { form: true, url: true });
  assert.deepEqual(E.elicitModes({}), { form: true, url: false });
  assert.deepEqual(E.elicitModes({ url: {} }), { form: false, url: true });
  assert.deepEqual(E.elicitModes(undefined), { form: false, url: false });
});

test("EL2 a server's request is checked as Claude Code's MCP client checks one: a form's fields (strings with formats, numbers, booleans, choices), a URL; anything else, or a mode not declared, gets its words as a JSON-RPC error; an answer is checked too", () => {
  assert.equal(E.checkElicitRequest(FORM).mode, "form");
  assert.equal(E.checkElicitRequest(URLQ).mode, "url");
  const fields = { a: { type: "string", format: "email" }, b: { type: "integer", minimum: 1 }, c: { type: "number", maximum: 2.5, default: 1 }, d: { type: "boolean", default: false }, e: { type: "string", enum: ["x", "y"], enumNames: ["X", "Y"] }, f: { type: "string", oneOf: [{ const: "p", title: "P" }] }, g: { type: "array", items: { type: "string", enum: ["m", "n"] }, minItems: 1 }, h: { type: "array", items: { anyOf: [{ const: "q", title: "Q" }] } }, i: { type: "string", format: "date-time", default: "2026-11-14T09:00:00Z" } };
  assert.equal(E.checkElicitRequest({ message: "m", requestedSchema: { type: "object", properties: fields } }).mode, "form");
  const bad = (p) => E.checkElicitRequest(p).error;
  assert.deepEqual(bad({ requestedSchema: FORM.requestedSchema }), { code: -32602, message: "Invalid elicitation request: message must be a string" });
  assert.match(bad({ message: "m", requestedSchema: { type: "object", properties: { x: { type: "object" } } } }).message, /^Invalid elicitation request: requestedSchema\.properties\.x is not a string, number, integer, boolean or choice field$/);
  assert.match(bad({ message: "m", requestedSchema: { type: "object", properties: { x: { type: "string", format: "ipv4" } } } }).message, /^Invalid elicitation request: /);
  assert.match(bad({ message: "m", mode: "voice" }).message, /mode must be "form" or "url"/);
  assert.match(bad({ ...URLQ, elicitationId: undefined }).message, /elicitationId must be a string/);
  assert.match(bad({ ...URLQ, url: "not a url" }).message, /url must be a URL/);
  assert.equal(bad({ message: "m", requestedSchema: { type: "object" } }).code, -32602);
  // A mode the client did not declare (Claude Code's words).
  assert.deepEqual(E.checkElicitRequest(URLQ, {}).error, { code: -32602, message: "Client does not support URL-mode elicitation requests" });
  assert.deepEqual(E.checkElicitRequest(FORM, { url: {} }).error, { code: -32602, message: "Client does not support form-mode elicitation requests" });
  // An answer: accept with content of strings, numbers, booleans and lists of strings; decline; cancel.
  assert.deepEqual(E.elicitReply({ action: "accept", content: { a: "x", b: 2, c: true, d: ["m"] } }), { result: { action: "accept", content: { a: "x", b: 2, c: true, d: ["m"] } } });
  assert.deepEqual(E.elicitReply({ action: "decline" }), { result: { action: "decline" } });
  assert.deepEqual(E.elicitReply({ action: "maybe" }), { error: { code: -32602, message: "Invalid elicitation result: action must be accept, decline or cancel" } });
  assert.deepEqual(E.elicitReply({ action: "accept", content: { a: { deep: 1 } } }), { error: { code: -32602, message: "Invalid elicitation result: content.a must be a string, number, boolean or list of strings" } });
  // Claude Code's words when the call runs out of time with the question open (2.1.310).
  assert.equal(E.timedOutText("Linear", "make_issue", 1_800_000), "MCP server \"Linear\" tool \"make_issue\" timed out after 1800s. The server asked the owner a question, and no answer came before the time limit. Do not call this tool again in this turn. Tell the owner that the server's question got no answer, and wait for their reply.");
});

test("EL3 a question during a tool call (Streamable HTTP) goes to the job that can ask, the call's idle timer still while it waits; the answer goes back to the server, with the session; the call's own answer comes after", async () => {
  const s = asker(async ({ emit, reply }) => {
    // (The server's own id, 1, is the same number as one of Coder's: ids are each side's own.)
    emit({ jsonrpc: "2.0", id: 1, method: "elicitation/create", params: FORM });
    const r = await reply(1);
    return textOf("made in " + JSON.stringify(r.result));
  });
  const mc = machine(async () => { await new Promise((ok) => setTimeout(ok, 250)); return { result: { action: "accept", content: { project: "DOCS" } } }; });
  const talk = W.serverTalk({ ask: mc.ask, server: "Linear", tool: "make_issue" });
  // (An idle limit of 100 ms: the 250 ms the owner takes does not end the call.)
  const [r] = await M.mcpSession("https://mcp.example.com/mcp", "tok", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn, idleMs: 100, talk });
  assert.equal(r.content[0].text, 'made in {"action":"accept","content":{"project":"DOCS"}}');
  const q = mc.lines.find((x) => x.t === "elicit");
  assert.match(q.id, E.EID);
  assert.deepEqual({ ...q, id: "" }, { t: "elicit", id: "", server: "Linear", tool: "make_issue", mode: "form", message: FORM.message, requestedSchema: FORM.requestedSchema, order: ["project", "urgent"] });
  const ans = s.seen.find((x) => !("method" in x.msg));
  assert.deepEqual(ans.msg, { jsonrpc: "2.0", id: 1, result: { action: "accept", content: { project: "DOCS" } } });
  assert.equal(ans.headers["mcp-session-id"], "s1");
  assert.equal(ans.headers.authorization, "Bearer tok");
  // A URL question: its address and id go to the job.
  const u = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: "q1", method: "elicitation/create", params: URLQ }); return textOf("url: " + (await reply("q1")).result.action); });
  const mu = machine(async () => ({ result: { action: "accept" } }));
  const [ru] = await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: u.fetchFn, talk: W.serverTalk({ ask: mu.ask, server: "Linear", tool: "make_issue" }) });
  assert.equal(ru.content[0].text, "url: accept");
  const qu = mu.lines.find((x) => x.t === "elicit");
  assert.equal(qu.url, URLQ.url);
  assert.equal(qu.elicitationId, "el-42");
  assert.equal(qu.requestedSchema, undefined);
});

test("EL4 with no one to ask (Gloopy's calls, a list read for the page, a request during initialize): cancel; a malformed request or one in an undeclared mode: Claude Code's error; ping: {}; another request: Method not found", async () => {
  const s = asker(async ({ emit, reply }) => {
    emit({ jsonrpc: "2.0", id: 5, method: "elicitation/create", params: FORM });
    emit({ jsonrpc: "2.0", id: 6, method: "elicitation/create", params: { message: "m", requestedSchema: { type: "object", properties: { x: { type: "object" } } } } });
    emit({ jsonrpc: "2.0", id: 7, method: "ping" });
    emit({ jsonrpc: "2.0", id: 8, method: "sampling/createMessage", params: {} });
    emit({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: "x", progress: 1 } });
    const all = await Promise.all([5, 6, 7, 8].map(reply));
    return textOf(JSON.stringify(all.map((x) => x.result || x.error)));
  });
  const [r] = await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn });
  const [cancel, invalid, pong, none] = JSON.parse(r.content[0].text);
  assert.deepEqual(cancel, { action: "cancel" });
  assert.equal(invalid.code, -32602);
  assert.match(invalid.message, /^Invalid elicitation request: /);
  assert.deepEqual(pong, {});
  assert.deepEqual(none, { code: -32601, message: "Method not found" });
  // During initialize: cancel, even for a job that can ask (Claude Code: "Elicitation request received during initialization").
  const talk = W.serverTalk({ ask: machine(async () => ({ result: { action: "accept" } })).ask });
  const replies = [];
  await talk.message({ jsonrpc: "2.0", id: 1, method: "elicitation/create", params: FORM }, { during: "initialize", reply: async (m) => { replies.push(m); }, hold() {}, release() {} });
  assert.deepEqual(replies, [{ jsonrpc: "2.0", id: 1, result: { action: "cancel" } }]);
  // A question in a mode the client did not declare.
  const only = W.serverTalk({ ask: machine().ask, cap: {} });
  await only.message({ jsonrpc: "2.0", id: 2, method: "elicitation/create", params: URLQ }, { during: "tools/call", reply: async (m) => { replies.push(m); }, hold() {}, release() {} });
  assert.deepEqual(replies[1], { jsonrpc: "2.0", id: 2, error: { code: -32602, message: "Client does not support URL-mode elicitation requests" } });
});

test("EL5 a server that cancels its own question (its request timed out): the card is withdrawn and no answer is sent; one still open when the call ends is withdrawn and cancelled; out of time with it open: Claude Code's words, not tried again", async () => {
  const s = asker(async ({ emit }) => {
    emit({ jsonrpc: "2.0", id: 9, method: "elicitation/create", params: FORM });
    await new Promise((ok) => setTimeout(ok, 60));
    emit({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 9, reason: "Request timed out" } });
    await new Promise((ok) => setTimeout(ok, 60));
    return textOf("the owner did not answer in time");
  });
  const mc = machine(() => new Promise(() => {}));
  const [r] = await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn, talk: W.serverTalk({ ask: mc.ask }) });
  assert.equal(r.content[0].text, "the owner did not answer in time");
  assert.deepEqual(mc.withdrawn, [mc.lines.find((x) => x.t === "elicit").id]);
  assert.ok(!s.seen.some((x) => !("method" in x.msg) && x.msg.id === 9), "no answer to a withdrawn question");
  // The call ends with the question open: withdrawn, and the server told cancel.
  const s2 = asker(async ({ emit }) => { emit({ jsonrpc: "2.0", id: 3, method: "elicitation/create", params: FORM }); await new Promise((ok) => setTimeout(ok, 40)); return textOf("gave up"); });
  const m2 = machine(() => new Promise(() => {}));
  await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s2.fetchFn, talk: W.serverTalk({ ask: m2.ask }) });
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(m2.withdrawn.length, 1);
  assert.deepEqual(s2.seen.find((x) => !("method" in x.msg)).msg, { jsonrpc: "2.0", id: 3, result: { action: "cancel" } });
  // Out of time while the question waits: Claude Code's words for it (and not a passing failure an idempotent tool repeats).
  const s3 = asker(async ({ emit }) => { emit({ jsonrpc: "2.0", id: 4, method: "elicitation/create", params: FORM }); await new Promise((ok) => setTimeout(ok, 2000)); return textOf("late"); });
  await assert.rejects(M.mcpSession("https://mcp.example.com/mcp", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s3.fetchFn, totalMs: 150, talk: W.serverTalk({ ask: machine(() => new Promise(() => {})).ask, server: "Linear", tool: "make_issue" }) }),
    (e) => e.message === E.timedOutText("Linear", "make_issue", 150) && !e.transient);
});

test("EL6 the older SSE transport: the question comes on the server's stream, the answer is POSTed where its messages go; the call's limit is still while it waits", async () => {
  const posted = [];
  let c;
  const sse = async (url, init = {}) => {
    if ((init.method || "GET") === "GET") return new Response(new ReadableStream({ start(x) { c = x; x.enqueue(enc.encode("event: endpoint\ndata: /messages?sid=1\n\n")); } }), { headers: { "content-type": "text/event-stream" } });
    const msg = JSON.parse(init.body);
    posted.push({ url: String(url), msg });
    const send = (o) => setTimeout(() => c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify(o) + "\n\n")), 5);
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: {} } });
    if (msg.method === "tools/call") send({ jsonrpc: "2.0", id: 77, method: "elicitation/create", params: FORM });
    if (!("method" in msg) && msg.id === 77) send({ jsonrpc: "2.0", id: 2, result: textOf("sse got " + msg.result.action) });
    return new Response(null, { status: 202 });
  };
  const mc = machine(async () => { await new Promise((ok) => setTimeout(ok, 200)); return { result: { action: "decline" } }; });
  const [r] = await M.sseSession("https://mcp.example.com/sse", "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: sse, idleMs: 80, talk: W.serverTalk({ ask: mc.ask }) });
  assert.equal(r.content[0].text, "sse got decline");
  const ans = posted.find((x) => !("method" in x.msg));
  assert.equal(ans.url, "https://mcp.example.com/messages?sid=1");
  assert.deepEqual(ans.msg, { jsonrpc: "2.0", id: 77, result: { action: "decline" } });
});

test("EL7 the gate: a job that can ask gets its call as a stream (its pass checked as before); its answer comes back with the pass, is checked, kept for the call and sent; a job that cannot ask gets the plain answer, the question cancelled", async () => {
  const s = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: 1, method: "elicitation/create", params: FORM }); return textOf("got " + JSON.stringify((await reply(1)).result)); });
  const b = memBucket();
  await M.addConnector(env, b, "u1", { name: "Linear", url: "https://mcp.example.com/mcp", fetchFn: s.fetchFn });
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 4 }));
  const { map } = M.toolsFor(await M.readConnectors(b, "u1"));
  await M.keepJobTools(b, "u1", "chat-1", 4, map);
  const until = String(Date.now() + 60_000);
  const pass = await modelPass(env, "u1/chat-1", "4", until);
  const hdr = { "x-coder-chat": "u1/chat-1", "x-coder-turn": "4", "x-coder-until": until, "x-coder-model": pass };
  const e2 = { ...env, CODER_BUCKET: b };
  const req = (body, h = hdr) => new Request("https://jessica.gofarther.dev/api/coder/mcp", { method: "POST", headers: h, body: JSON.stringify(body) });
  // Not this job's pass: refused, stream or not.
  assert.equal((await M.handleMcp(req({ tool: "mcp__linear__make_issue", args: {}, ask: true }, { ...hdr, "x-coder-model": "x".repeat(43) }), e2, { fetchFn: s.fetchFn })).status, 403);
  assert.equal((await M.handleMcp(req({ answer: { id: "e" + "a".repeat(20), result: { action: "decline" } } }, { ...hdr, "x-coder-model": "x".repeat(43) }), e2, { fetchFn: s.fetchFn })).status, 403);
  const res = await M.handleMcp(req({ tool: "mcp__linear__make_issue", args: {}, ask: true }), e2, { fetchFn: s.fetchFn, pollMs: 20 });
  assert.equal(res.headers.get("content-type"), "application/x-ndjson");
  const lines = [];
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let k;
    while ((k = buf.indexOf("\n")) >= 0) {
      const o = JSON.parse(buf.slice(0, k)); buf = buf.slice(k + 1); lines.push(o);
      if (o.t === "elicit") {
        assert.equal((await M.handleMcp(req({ answer: { id: o.id, result: { action: "accept", content: { project: { no: 1 } } } } }), e2)).status, 200, "kept, as an error for the server");
        b.m.delete(W.elicitKey("u1", "chat-1", o.id));
        assert.equal((await M.handleMcp(req({ answer: { id: "../x", result: { action: "accept" } } }), e2)).status, 400);
        const ok = await M.handleMcp(req({ answer: { id: o.id, result: { action: "accept", content: { project: "DOCS" } } } }), e2);
        assert.deepEqual(await ok.json(), { ok: true });
      }
    }
  }
  assert.deepEqual(lines.map((x) => x.t), ["elicit", "result"]);
  assert.equal(lines[1].text, 'got {"action":"accept","content":{"project":"DOCS"}}');
  assert.equal(lines[0].server, "Linear");
  assert.ok(![...b.m.keys()].some((k) => k.includes("/elicit/")), "the answer was taken out of storage");
  // A job that cannot ask (no `ask`): the plain answer, the question cancelled.
  s.replies.clear();
  const plain = await M.handleMcp(req({ tool: "mcp__linear__make_issue", args: {} }), e2, { fetchFn: s.fetchFn });
  assert.deepEqual(await plain.json(), { text: 'got {"action":"cancel"}', isError: false, content: [{ type: "text", text: 'got {"action":"cancel"}' }] });
  // A machine's answer kept in the chat's storage, checked as Claude Code's client checks one.
  const b2 = memBucket();
  assert.deepEqual(await W.keepAnswer(b2, "u1", "c1", { id: "e" + "b".repeat(20), result: { action: "accept", content: { a: [1] } } }), { ok: true });
  assert.deepEqual(JSON.parse(b2.m.get(W.elicitKey("u1", "c1", "e" + "b".repeat(20)))), { error: { code: -32602, message: "Invalid elicitation result: content.a must be a string, number, boolean or list of strings" } });
  assert.deepEqual(await W.keepAnswer(b2, "u1", "c1", { id: "nope", result: { action: "accept" } }), { error: "that answer could not be read" });
});

test("EL8 the machine's caller: with a way to ask, the call is a stream (ask: true); a question goes to ask.elicit and its answer back with the job's pass; a withdrawn one to ask.withdraw; without one, the call is as before", async () => {
  const sent = [];
  const via = { url: "https://jessica.gofarther.dev/api/coder/model", headers: { "x-coder-chat": "u1/chat-1", "x-coder-model": "pass" } };
  const eid = "e" + "c".repeat(20), eid2 = "e" + "d".repeat(20);
  const fetchFn = async (u, init) => {
    const body = JSON.parse(init.body);
    sent.push({ u, body, headers: init.headers });
    if (body.answer) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    if (!body.ask) return new Response(JSON.stringify({ text: "plain", isError: false }), { status: 200 });
    const stream = new ReadableStream({ async start(c) {
      const line = (o) => c.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      line({ t: "wait" });
      line({ t: "elicit", id: eid, server: "Linear", tool: "make_issue", mode: "form", message: "Which?", requestedSchema: FORM.requestedSchema, order: ["project", "urgent"] });
      line({ t: "elicit", id: eid2, server: "Linear", tool: "make_issue", mode: "url", message: "Sign in", url: URLQ.url, elicitationId: "el-42" });
      line({ t: "withdraw", id: eid2 });
      await new Promise((ok) => setTimeout(ok, 30));
      line({ t: "result", text: "made LIN-9", isError: false });
      c.close();
    } });
    return new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  };
  const call = A.connectorCaller(via, fetchFn);
  const asked = [], gone = [];
  const ask = { elicit: async (q) => { asked.push(q.id); return q.id === eid ? { result: { action: "accept", content: { project: "DOCS" } } } : null; }, withdraw: (id) => gone.push(id), complete() {} };
  assert.deepEqual(await call("mcp__linear__make_issue", { title: "Bug" }, { ask }), { text: "made LIN-9", isError: false });
  await new Promise((ok) => setTimeout(ok, 20));
  assert.deepEqual(sent[0].body, { tool: "mcp__linear__make_issue", args: { title: "Bug" }, ask: true });
  assert.deepEqual(asked, [eid, eid2]);
  assert.deepEqual(gone, [eid2]);
  const answers = sent.filter((x) => x.body.answer).map((x) => x.body.answer);
  assert.deepEqual(answers, [{ id: eid, result: { action: "accept", content: { project: "DOCS" } } }], "no answer for a question with none");
  assert.equal(sent.find((x) => x.body.answer).headers["x-coder-model"], "pass");
  assert.equal(sent.find((x) => x.body.answer).u, "https://jessica.gofarther.dev/api/coder/mcp");
  // Without a way to ask: as before.
  sent.length = 0;
  assert.deepEqual(await call("mcp__linear__make_issue", { q: 1 }), { text: "plain", isError: false });
  assert.deepEqual(sent[0].body, { tool: "mcp__linear__make_issue", args: { q: 1 } });
});

// ── CODER'S LOOP ──
const tcall = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const LINEAR = A.connectorTools([{ name: "mcp__linear__make_issue", label: "Linear: make_issue", perm: "allow", description: "Make an issue", parameters: { type: "object", properties: {} } }]);
/** A turn whose model calls the connector once; `server(q, opts)` is the call (it asks with opts.ask); `ask` answers cards. */
async function turn({ server, ask = async () => null, hooks = null, deps = {}, opts = {} }) {
  const events = [], hookRuns = [], asked = [];
  let n = 0;
  const steps = [say("", [tcall("mcp__linear__make_issue", { title: "Bug" }, "k1")]), say("Done.")];
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookRuns.push(input);
        const h = (hooks || []).find((y) => String(x.command).includes(y.command));
        const out = h && h.reply ? h.reply(input) : { code: 0, stdout: "" };
        return { code: out.code, output: (out.stdout || "") + "\n" + mark[0] + "\n" + (out.stderr || "") };
      }
      return { code: 0, output: "" };
    },
    emit: (e) => events.push(e),
    ask: async (pid, o) => { asked.push({ pid, o }); return ask(pid, o); },
    mcp: async (name, args, o) => server(o),
    toolSearch: "false",
    chatId: "shop-el9", root: "/work/shop", here: () => "/work/shop",
    ...deps,
  }, { text: "make an issue", connectors: LINEAR, mode: "auto", hooks: hooks ? hooks.map(({ reply, ...h }) => ({ type: "command", timeout: 60, ...h })) : null, ...opts });
  return { r, events, hookRuns, asked };
}
const Q = (over = {}) => ({ t: "elicit", id: "e" + "f".repeat(20), server: "Linear", tool: "make_issue", mode: "form", message: FORM.message, requestedSchema: FORM.requestedSchema, order: ["project", "urgent"], ...over });

test("EL9 Coder's loop: the question is a card in the chat (which connector asks, its message and fields), the owner's Submit is the server's accept with the values, Decline its decline; the card waits without pausing the job; the turn goes on with the call's answer", async () => {
  let got;
  const t = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "made LIN-1", isError: false }; }, ask: async (pid, o) => ({ choice: "accept", content: { project: "DOCS", urgent: true } }) });
  assert.equal(t.r.status, "done");
  assert.deepEqual(got, { result: { action: "accept", content: { project: "DOCS", urgent: true } } });
  const card = t.events.find((e) => e.type === "elicit");
  assert.deepEqual({ ...card, pid: "", at: 0 }, { type: "elicit", pid: "", at: 0, connector: "Linear", tool: "Linear: make_issue", mode: "form", message: FORM.message, requestedSchema: FORM.requestedSchema, order: ["project", "urgent"] });
  assert.match(card.pid, /^p[0-9a-z]{2,24}$/);
  // It waits to the job's time limit (no pause: the question lives in the call) and ends if the server withdraws it.
  assert.ok(t.asked[0].o.until > Date.now() && !t.asked[0].o.park, "no pause after 5 minutes");
  assert.equal(typeof t.asked[0].o.gone, "function");
  // The page is told how it ended, never the values (they can be secret).
  assert.deepEqual({ ...t.events.find((e) => e.type === "permanswer"), at: 0 }, { type: "permanswer", pid: card.pid, choice: "accept", at: 0 });
  // Decline; a URL card's "I'm done, continue" is accept with no values.
  const d = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "decline" }) });
  assert.deepEqual(got, { result: { action: "decline" } });
  assert.equal(d.events.find((e) => e.type === "permanswer").choice, "decline");
  const u = await turn({ server: async (o) => { got = await o.ask.elicit(Q({ mode: "url", url: URLQ.url, elicitationId: "el-42", requestedSchema: undefined, order: undefined })); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept", content: { stray: "x" } }) });
  assert.deepEqual(got, { result: { action: "accept" } });
  assert.deepEqual(u.events.find((e) => e.type === "elicit").url, URLQ.url);
});

test("EL10 Stop on the card is cancel and stops the turn; the job's time running out is cancel; a question the server withdrew gets no answer; refusing instead of asking (denyInsteadOfPrompting) cancels with no card; Gloopy's calls have no card", async () => {
  let got;
  // Stop: cancel to the server, and the turn stops at once, with no wait for the call (Claude Code's Stop ends the turn).
  const s = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); await new Promise(() => {}); }, ask: async () => ({ choice: "stop" }) });
  assert.equal(s.r.status, "stopped");
  assert.deepEqual(got, { result: { action: "cancel" } });
  assert.equal(s.events.find((e) => e.type === "permanswer").choice, "stop");
  // (Round 5: the connector's call was running when Stop came: Claude Code's rejection with its "stopped while running" correction.)
  assert.equal(s.r.messages.find((m) => m.role === "tool").content, A.STOPPED_RUNNING);
  // No answer (the job's time limit): cancel.
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => null });
  assert.deepEqual(got, { result: { action: "cancel" } });
  // Withdrawn by the server while it waits: no answer at all.
  await turn({ server: async (o) => { const p = o.ask.elicit(Q()); setTimeout(() => o.ask.withdraw(Q().id), 10); got = await p; return { text: "x", isError: false }; }, ask: async (pid, o) => { for (;;) { if (o.gone()) return { choice: "gone" }; await new Promise((ok) => setTimeout(ok, 5)); } } });
  assert.equal(got, null);
  // Withdrawn just as the owner answered: still no answer, and the card says the server stopped waiting.
  const late = await turn({ server: async (o) => { const p = o.ask.elicit(Q()); setTimeout(() => o.ask.withdraw(Q().id), 5); got = await p; return { text: "x", isError: false }; }, ask: async () => { await new Promise((ok) => setTimeout(ok, 30)); return { choice: "accept", content: { project: "DOCS" } }; } });
  assert.equal(got, null);
  assert.equal(late.events.find((e) => e.type === "permanswer").choice, "gone");
  // Refuse instead of asking: no card, cancel.
  const dn = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, opts: { denyInstead: true } });
  assert.deepEqual(got, { result: { action: "cancel" } });
  assert.ok(!dn.events.some((e) => e.type === "elicit"));
  assert.equal(dn.asked.length, 0);
  // Gloopy (an agent with its own tools) gets no way to ask: its calls are as before (Gloopy stays as it is).
  const G = await import("../container/gloopy-agent.mjs");
  const calls = [];
  let gn = 0;
  await A.runCoder({ send: async () => [say("", [tcall("mcp__linear__make_issue", {}, "g1")]), say("ok")][Math.min(gn++, 1)], exec: async () => ({ code: 0, output: "" }), mcp: async (...a) => { calls.push(a); return { text: "", isError: false }; }, ask: async () => null },
    { text: "x", connectors: LINEAR, system: G.GLOOPY_SYSTEM, tools: G.GLOOPY_TOOLS, nudges: false, who: "Gloopy", github: false, hooks: [], checker: false, rules: null, sessionRules: null });
  assert.deepEqual(calls, [["mcp__linear__make_issue", {}]]);
});

test("EL11 a call whose question is open is not moved to the background until the card closes (Claude Code defers the move); then it is", async () => {
  const seen = [];
  let n = 0;
  const steps = [say("", [tcall("mcp__linear__make_issue", {}, "k1")]), say("waiting"), say("all done")];
  let release;
  const r = await A.runCoder({
    send: async (q) => { seen.push(q); return steps[Math.min(n++, 2)]; }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, connectorBgMs: 30, toolSearch: "false",
    ask: async () => { await new Promise((ok) => setTimeout(ok, 120)); return { choice: "accept", content: { project: "DOCS" } }; },
    mcp: async (name, args, o) => { await o.ask.elicit(Q()); await new Promise((ok) => { release = ok; setTimeout(ok, 150); }); return { text: "late answer", isError: false }; },
  }, { text: "x", connectors: LINEAR, mode: "auto" });
  assert.equal(r.status, "done");
  // The card was open past the 30 ms threshold: the call stayed in the foreground until it closed, then went to the background.
  assert.match(seen[1].messages.filter((m) => m.role === "tool").at(-1).content, /moved to the background as connector-1/);
  assert.match(JSON.stringify(seen[2].messages), /connector-1 \(Linear: make_issue\) finished:[^"]*late answer/);
  assert.equal(typeof release, "function");
  // The helper itself.
  let open = 1, closeIt;
  const q = { open: () => open, closed: () => new Promise((ok) => { closeIt = () => { open = 0; ok(); }; }), stopped: () => new Promise(() => {}) };
  const slow = new Promise((ok) => setTimeout(() => ok("x"), 500));
  const t0 = Date.now();
  const p = E.untilBackground(slow, 20, q);
  setTimeout(() => closeIt(), 80);
  assert.equal(await p, null);
  assert.ok(Date.now() - t0 >= 75, "moved only once the card closed");
  assert.deepEqual(await E.untilBackground(Promise.resolve(7), 1000, null), { x: 7 });
});

test("EL12 the Elicitation and ElicitationResult hooks, with Claude Code's inputs and outputs: a hook can answer for the owner (no card, no ElicitationResult hooks), decline (exit 2, decision block, action decline: a decline overrides), or leave it to the card; ElicitationResult can change or block the answer; elicitation_response goes to Notification hooks", async () => {
  let got;
  // An Elicitation hook that answers the form: no card.
  const a = await turn({
    server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; },
    hooks: [{ event: "Elicitation", matcher: "linear", command: "answer-docs", reply: (i) => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { project: "DOCS" } }, reason: "dropped", systemMessage: "dropped" }) }) },
      { event: "ElicitationResult", matcher: "linear", command: "result-hook", reply: () => ({ code: 0, stdout: "" }) }],
    ask: async () => { throw new Error("no card"); },
  });
  assert.deepEqual(got, { result: { action: "accept", content: { project: "DOCS" } } });
  assert.ok(!a.events.some((e) => e.type === "elicit"));
  const input = a.hookRuns.find((x) => x.hook_event_name === "Elicitation");
  assert.deepEqual({ name: input.mcp_server_name, message: input.message, mode: input.mode, schema: input.requested_schema, session: input.session_id, cwd: input.cwd }, { name: "linear", message: FORM.message, mode: "form", schema: FORM.requestedSchema, session: "shop-el9", cwd: "/work/shop" });
  assert.ok(!("url" in input) && !("elicitation_id" in input));
  assert.ok(!a.hookRuns.some((x) => x.hook_event_name === "ElicitationResult"), "no ElicitationResult hooks after a hook answered");
  // Declines: exit 2; a top-level decision block; action decline overriding another hook's accept. A hook's answer on another exit code is ignored.
  for (const reply of [() => ({ code: 2, stderr: "no" }), () => ({ code: 0, stdout: JSON.stringify({ decision: "block", hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { project: "X" } } }) })]) {
    await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, hooks: [{ event: "Elicitation", command: "h1", reply }], ask: async () => { throw new Error("no card"); } });
    assert.deepEqual(got, { result: { action: "decline" } });
  }
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => { throw new Error("no card"); },
    hooks: [{ event: "Elicitation", command: "h-accept", reply: () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { project: "A" } } }) }) },
      { event: "Elicitation", command: "h-decline", reply: () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "Elicitation", action: "decline" } }) }) }] });
  assert.deepEqual(got, { result: { action: "decline" } });
  const left = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept", content: { project: "MINE" } }),
    hooks: [{ event: "Elicitation", command: "h-exit1", reply: () => ({ code: 1, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { project: "HOOK" } } }) }) }] });
  assert.deepEqual(got, { result: { action: "accept", content: { project: "MINE" } } }, "a hook's answer on exit 1 is ignored: the card asks");
  assert.ok(left.events.some((e) => e.type === "elicit"));
  // A hook for another connector does not match.
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "decline" }), hooks: [{ event: "Elicitation", matcher: "notion", command: "h-other", reply: () => ({ code: 2 }) }] });
  assert.deepEqual(got, { result: { action: "decline" } });
  // ElicitationResult: sees the owner's answer; changes its values (the whole content replaced); blocks it (decline, no values); cancel keeps them.
  const r1 = await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept", content: { project: "alice" } }),
    hooks: [{ event: "ElicitationResult", matcher: "linear", command: "r-change", reply: (i) => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "ElicitationResult", action: "accept", content: { project: i.content.project + "@example.com" } } }) }) },
      { event: "Notification", matcher: "elicitation_response", command: "n-resp" }] });
  assert.deepEqual(got, { result: { action: "accept", content: { project: "alice@example.com" } } });
  const ri = r1.hookRuns.find((x) => x.hook_event_name === "ElicitationResult");
  assert.deepEqual({ name: ri.mcp_server_name, mode: ri.mode, action: ri.action, content: ri.content }, { name: "linear", mode: "form", action: "accept", content: { project: "alice" } });
  await new Promise((ok) => setTimeout(ok, 20));
  const note = r1.hookRuns.find((x) => x.hook_event_name === "Notification");
  assert.deepEqual({ message: note.message, type: note.notification_type }, { message: "Elicitation response for server \"linear\": accept", type: "elicitation_response" });
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept", content: { project: "alice" } }), hooks: [{ event: "ElicitationResult", command: "r-block", reply: () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "ElicitationResult", action: "decline" } }) }) }] });
  assert.deepEqual(got, { result: { action: "decline" } });
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept", content: { project: "alice" } }), hooks: [{ event: "ElicitationResult", command: "r-cancel", reply: () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "ElicitationResult", action: "cancel" } }) }) }] });
  assert.deepEqual(got, { result: { action: "cancel", content: { project: "alice" } } });
  // A hook's content that is not one an answer can carry: Claude Code's "Invalid elicitation result" for the server.
  await turn({ server: async (o) => { got = await o.ask.elicit(Q()); return { text: "x", isError: false }; }, ask: async () => { throw new Error("no card"); }, hooks: [{ event: "Elicitation", command: "h-bad", reply: () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { project: { deep: 1 } } } }) }) }] });
  assert.equal(got.error.code, -32602);
  // The URL card's hooks get its address and id.
  const ur = await turn({ server: async (o) => { got = await o.ask.elicit(Q({ mode: "url", url: URLQ.url, elicitationId: "el-42", requestedSchema: undefined })); return { text: "x", isError: false }; }, ask: async () => ({ choice: "accept" }), hooks: [{ event: "Elicitation", command: "u1" }, { event: "ElicitationResult", command: "u2" }] });
  const ui = ur.hookRuns.find((x) => x.hook_event_name === "Elicitation"), uo = ur.hookRuns.find((x) => x.hook_event_name === "ElicitationResult");
  assert.deepEqual([ui.mode, ui.url, ui.elicitation_id, "requested_schema" in ui], ["url", URLQ.url, "el-42", false]);
  assert.deepEqual([uo.mode, uo.elicitation_id, uo.action], ["url", "el-42", "accept"]);
  // The events take only command and http hooks (Claude Code: command, http and mcp_tool).
  const H = await import("../container/coder-hooks.mjs");
  assert.ok(H.HOOK_EVENTS.includes("Elicitation") && H.HOOK_EVENTS.includes("ElicitationResult"));
  assert.deepEqual(H.hooksFrom({ hooks: { Elicitation: [{ hooks: [{ type: "prompt", prompt: "x" }] }] } }).problems, ["Elicitation doesn't take prompt hooks"]);
});

test("EL13 Coder's machine: the call's questions are cards of this turn (two can wait at once, each answered on its own; /state names both); Submit's values are checked and go back with the job's pass; a question the server withdrew closes; the turn goes on", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  // A stand-in for Coder's Worker: the model (xAI's answer shape) and the connector call as a stream.
  const MODEL = "https://coder.example.dev/api/coder/model", MCP = "https://coder.example.dev/api/coder/mcp";
  const ids = { form: "e" + "1".repeat(20), url: "e" + "2".repeat(20), gone: "e" + "3".repeat(20) };
  const answers = [], toolMsgs = [];
  let both;
  const allIn = new Promise((ok) => { both = ok; });
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u);
    if (url === MODEL) {
      const body = JSON.parse(init.body);
      const tool = (body.input || []).filter((x) => x && x.type === "function_call_output");
      if (!tool.length) return Response.json({ output: [{ type: "function_call", call_id: "k1", name: "mcp__linear__make_issue", arguments: "{}" }], usage: {} });
      toolMsgs.push(tool.map((x) => x.output).join("\n"));
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "Made it." }] }], usage: {} });
    }
    if (url === MCP) {
      const body = JSON.parse(init.body);
      if (body.answer) { answers.push(body.answer); if (answers.length === 2) both(); return Response.json({ ok: true }); }
      const stream = new ReadableStream({ async start(c) {
        const line = (o) => c.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        line({ t: "elicit", id: ids.form, server: "Linear", tool: "make_issue", mode: "form", message: "Which project?", requestedSchema: FORM.requestedSchema, order: ["project", "urgent"] });
        line({ t: "elicit", id: ids.url, server: "Linear", tool: "make_issue", mode: "url", message: "Sign in", url: URLQ.url, elicitationId: "el-42" });
        line({ t: "elicit", id: ids.gone, server: "Linear", tool: "make_issue", mode: "form", message: "Never mind", requestedSchema: FORM.requestedSchema });
        await new Promise((ok) => setTimeout(ok, 300));
        line({ t: "withdraw", id: ids.gone });
        await allIn;
        line({ t: "result", text: "made LIN-7", isError: false });
        c.close();
      } });
      return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
    }
    return real(u, init);
  };
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, modelVia: true }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => real(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, data: await r.json() }));
  const state = () => real(base + "/state?project=shop-el13&since=0").then((r) => r.json());
  const waitFor = async (f) => { for (let i = 0; i < 400; i++) { const st = await state(); const v = f(st); if (v) return v; await new Promise((ok) => setTimeout(ok, 25)); } return null; };
  try {
    const model = { url: MODEL, chat: "user-1/shop-el13", turn: 1, until: String(Date.now() + 600_000), pass: "p".repeat(43) };
    const connectors = [{ name: "mcp__linear__make_issue", label: "Linear: make_issue", perm: "allow", description: "Make an issue", parameters: { type: "object", properties: {} } }];
    assert.equal((await post("/turn", { project: "shop-el13", text: "make an issue", messages: [], mode: "auto", rules: { allow: [] }, model, connectors })).status, 200);
    const st = await waitFor((s) => s.events.filter((e) => e.type === "elicit").length === 3 && Array.isArray(s.askingAll) && s.askingAll.length === 3 && s);
    assert.ok(st, "three cards wait at once, and /state names them all");
    const [form, url, gone] = st.events.filter((e) => e.type === "elicit");
    assert.equal(form.connector, "Linear");
    assert.equal(url.url, URLQ.url);
    // The one the server withdrew closes, and no answer goes for it.
    assert.ok(await waitFor((s) => s.events.some((e) => e.type === "permanswer" && e.pid === gone.pid && e.choice === "gone")));
    // Bad values are refused; the URL card's "I'm done, continue" and the form's Submit, in either order.
    assert.equal((await post("/answer", { project: "shop-el13", pid: form.pid, choice: "accept", content: { project: { deep: 1 } } })).status, 400);
    assert.equal((await post("/answer", { project: "shop-el13", pid: form.pid, choice: "maybe" })).status, 400);
    assert.deepEqual((await post("/answer", { project: "shop-el13", pid: url.pid, choice: "accept" })).data, { ok: true });
    assert.deepEqual((await post("/answer", { project: "shop-el13", pid: form.pid, choice: "accept", content: { project: "DOCS", urgent: true } })).data, { ok: true });
    const done = await waitFor((s) => s.result && s);
    assert.equal(done.result.status, "done");
    assert.deepEqual(answers.sort((a, b) => a.id.localeCompare(b.id)), [{ id: ids.form, result: { action: "accept", content: { project: "DOCS", urgent: true } } }, { id: ids.url, result: { action: "accept" } }]);
    assert.match(toolMsgs.join(""), /made LIN-7/);
    const ends = done.events.filter((e) => e.type === "permanswer").map((e) => [e.pid, e.choice]);
    assert.deepEqual(ends.sort(), [[form.pid, "accept"], [gone.pid, "gone"], [url.pid, "accept"]].sort());
    assert.ok(!JSON.stringify(done.events.filter((e) => e.type === "permanswer")).includes("DOCS"), "the values are not kept in the chat");
    // Once the turn is over, no card waits on (the job's end closes a question still open: t.over).
    assert.equal((await post("/answer", { project: "shop-el13", pid: form.pid, choice: "decline" })).data.ok, false);
  } finally { globalThis.fetch = real; await post("/stop", { project: "shop-el13" }).catch(() => {}); await new Promise((ok) => srv.close(ok)); }
});

test("EL14 Coder's Worker: the card's answer route passes the form's values to the machine; an environment card's check accepts one of several waiting cards; a question is pushed as Claude Code's cloud says it (\"needs your input\", \"Answer the MCP server's question to continue\") with the connector's name", async () => {
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /\.\.\.\(body\.content && typeof body\.content === "object" && !Array\.isArray\(body\.content\) \? \{ content: body\.content \} : \{\}\), \.\.\.\(typeof body\.plan === "string" \? \{ plan: body\.plan\.slice\(0, 200_000\) \} : \{\}\), \.\.\.\(\[60_000, 300_000, 600_000\]\.includes\(Number\(body\.afk\)\) \? \{ afk: Number\(body\.afk\) \} : \{\}\) \}\)\.then\(\(r\) => r\.json\(\)\)/);
  assert.match(routes, /if \(st\.asking !== pid && !\(Array\.isArray\(st\.askingAll\) && st\.askingAll\.includes\(pid\)\) && !\(st\.result && st\.result\.parked && st\.result\.parked\.pid === pid\)\)/);
  const { pushesFor } = await import("../src/coder-push.mjs");
  assert.deepEqual(pushesFor([{ type: "elicit", pid: "p1abcdef", connector: "Linear", mode: "form", message: "Which project?" }], { title: "shop" }), [{ kind: "actions", title: "Coder needs your input · shop", body: "Answer the MCP server's question to continue (Linear)" }]);
  // The machine's image has the new module; the Worker loads it without any Node module (WF21 walks it too).
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /COPY package\.json [^\n]* coder-elicit\.mjs /);
  for (const f of ["../container/coder-elicit.mjs", "../src/coder-elicit.mjs"]) assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /from\s+["']node:/);
});

test("EL15 the page: the card names the connector that asks, shows its message and its fields (each kind as Claude Code supports it, only the server's defaults filled in, the browser's autofill off), Submit and Decline; a URL card Open link and I'm done, continue (an address only if http or https); how it ended, never the values", () => {
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const from = ui.indexOf("  const EL_FORMATS = "), to = ui.indexOf("  async function answerPerm(pid, choice) {");
  assert.ok(from > 0 && to > from);
  const make = (S) => new Function("S", "esc", "ICON", "CSS", ui.slice(from, to) + "\nreturn { elicitHTML, elFieldValue, elicitForm };")(S, esc, { globe: '<svg width="26" height="26"></svg>', term: "<svg></svg>" }, { escape: (s) => s });
  const schema = { type: "object", properties: { project: { type: "string", title: "Project key", description: "Like DOCS", minLength: 2, maxLength: 10 }, mail: { type: "string", format: "email", title: "Email" }, when: { type: "string", format: "date" }, n: { type: "integer", minimum: 1, maximum: 5, default: 2 }, ok: { type: "boolean", title: "Urgent", default: true }, team: { type: "string", oneOf: [{ const: "web", title: "Web team" }, { const: "api", title: "API team" }] }, tags: { type: "array", items: { type: "string", enum: ["bug", "ui"] }, minItems: 1 } }, required: ["project", "tags"] };
  const ev = { type: "elicit", pid: "p1abcdef", connector: "Linear", tool: "Linear: make_issue", mode: "form", message: "Which project?\nPick one.", requestedSchema: schema, order: Object.keys(schema.properties) };
  const S = { running: true, events: [{ type: "user", text: "go" }, ev] };
  const { elicitHTML, elFieldValue } = make(S);
  const html = elicitHTML(ev, 1);
  assert.match(html, /<b>MCP server “Linear” requests your input<\/b>/);
  assert.match(html, /While using Linear: make_issue/);
  assert.match(html, /<p class="cd-el-msg">Which project\?\nPick one\.<\/p>/);
  assert.match(html, /data-elicit-pid="p1abcdef"/);
  assert.match(html, /<label class="cd-el-l" for="cdEl1_0">Project key<span class="cd-el-req" title="Required">\*<\/span><\/label><small class="cd-el-desc">Like DOCS<\/small><input id="cdEl1_0" class="cd-el-in" type="text" maxlength="10" value="" data-el-name="project" autocomplete="off"/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="date"/);
  assert.match(html, /type="number" step="1" min="1" max="5" value="2"/);
  assert.match(html, /<input type="radio" name="cdEl1_4" value="true" data-el-name="ok" checked><span>Yes<\/span>/);
  assert.match(html, /<option value="web">Web team<\/option><option value="api">API team<\/option>/);
  assert.match(html, /<input type="checkbox" value="bug" data-el-name="tags"><span>bug<\/span>/);
  assert.match(html, /<button type="button" class="cd-secret-no" data-el-decline>Decline<\/button><button type="button" class="cd-secret-save" data-el-accept>Submit<\/button>/);
  assert.match(html, /<div class="cd-ask-wait">Needs your input<\/div>/);
  assert.doesNotMatch(html, /type="password"/);
  // A URL card: Open link (a new tab, nothing of Coder's page passed to it) and I'm done, continue; the host in bold.
  const u = { ...ev, mode: "url", url: "https://linear.example.com/oauth?state=abc", requestedSchema: undefined, order: undefined };
  const uh = make({ running: true, events: [{}, u] }).elicitHTML(u, 1);
  assert.match(uh, /<b>MCP server “Linear” wants to open a URL<\/b>/);
  assert.match(uh, /<div class="cd-el-url">https:\/\/<b>linear\.example\.com<\/b>\/oauth\?state=abc<\/div>/);
  assert.match(uh, /<a class="cd-el-open" href="https:\/\/linear\.example\.com\/oauth\?state=abc" target="_blank" rel="noopener noreferrer" data-el-open>Open link<\/a><button type="button" class="cd-secret-save" data-el-accept>I’m done, continue<\/button>/);
  const bad = { ...u, url: "javascript:alert(1)" };
  const bh = make({ running: true, events: [{}, bad] }).elicitHTML(bad, 1);
  assert.match(bh, /This isn’t a valid http or https link, so it won’t open from here\./);
  assert.doesNotMatch(bh, /Open link|data-el-accept|href=/);
  // How it ended (never the values), and no longer live once its job is over.
  const ended = (choice, e = ev) => make({ running: false, events: [{}, e, { type: "permanswer", pid: e.pid, choice }] }).elicitHTML(e, 1);
  assert.match(ended("accept"), /<div class="cd-perm-done"><span class="cd-perm-ok">✓ Submitted<\/span><\/div>/);
  assert.match(ended("accept", u), /✓ Done, continued/);
  assert.match(ended("decline"), /✕ Declined/);
  assert.match(ended("gone"), /Closed<\/span> · the MCP server stopped waiting for an answer/);
  assert.match(ended("stop"), /Stopped/);
  assert.doesNotMatch(ended("accept"), /cd-el-form|data-elicit-pid/);
  assert.doesNotMatch(make({ running: true, events: [{}, ev, { type: "done", text: "x" }] }).elicitHTML(ev, 1), /is-live/);
  // Claude Code's form checks, in its words.
  const field = (kind, value) => ({ querySelector: (sel) => (sel === ".cd-el-in" ? { value } : sel === 'input[type="radio"]:checked' ? (value === undefined ? null : { value }) : null), querySelectorAll: () => (Array.isArray(value) ? value.map((v) => ({ value: v })) : []) });
  assert.deepEqual(elFieldValue(field("s", ""), schema.properties.project), { set: false });
  assert.deepEqual(elFieldValue(field("s", "D"), schema.properties.project), { set: true, error: "Must be at least 2 characters" });
  assert.deepEqual(elFieldValue(field("s", "DOCS"), schema.properties.project), { set: true, value: "DOCS" });
  assert.deepEqual(elFieldValue(field("s", "x".repeat(11)), schema.properties.project), { set: true, error: "Must be at most 10 characters" });
  assert.equal(elFieldValue(field("s", "nope"), schema.properties.mail).error, "Must be a valid email address, e.g. user@example.com");
  assert.equal(elFieldValue(field("s", "nope"), { type: "string", format: "uri" }).error, "Must be a valid URI, e.g. https://example.com");
  assert.deepEqual(elFieldValue(field("s", "2026-11-14"), schema.properties.when), { set: true, value: "2026-11-14" });
  assert.equal(elFieldValue(field("n", "9"), schema.properties.n).error, "Must be an integer between 1 and 5");
  assert.equal(elFieldValue(field("n", "2.5"), schema.properties.n).error, "Must be an integer between 1 and 5");
  assert.equal(elFieldValue(field("n", "x"), { type: "number", minimum: 1 }).error, "Must be a number >= 1.0");
  assert.deepEqual(elFieldValue(field("n", "3"), schema.properties.n), { set: true, value: 3 });
  assert.deepEqual(elFieldValue(field("b", "false"), schema.properties.ok), { set: true, value: false });
  assert.deepEqual(elFieldValue(field("b", undefined), schema.properties.ok), { set: false });
  assert.deepEqual(elFieldValue(field("m", ["bug", "ui"]), { type: "array", items: { type: "string", enum: ["bug", "ui"] }, maxItems: 1 }), { set: true, value: ["bug", "ui"], error: "Select at most 1 item" });
  assert.deepEqual(elFieldValue(field("m", ["bug"]), schema.properties.tags), { set: true, value: ["bug"] });
  // A date-time from the browser's local box goes as an ISO date-time with this computer's offset.
  assert.match(elFieldValue(field("s", "2026-11-14T09:30"), { type: "string", format: "date-time" }).value, /^2026-11-14T09:30:00[+-]\d\d:\d\d$/);
  // Its answer goes to the waiting step: the card's own fields, "accept" with them, or "decline".
  assert.match(ui, /const a = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid: card\.dataset\.elicitPid, choice, \.\.\.\(content \? \{ content \} : \{\}\) \}\) \}\);/);
  assert.match(ui, /if \(e\.type === 'elicit'\) out\.push\(elicitHTML\(e, i\)\);/);
});

// ── ROUND 5 (the owner, 2026-11-14: "Yes pls"): the rest of Claude Code 2.1.325's side of a connector's questions ──────────
const tick = (ms = 5) => new Promise((ok) => setTimeout(ok, ms));
async function until(f, ms = 3000) { const end = Date.now() + ms; while (!f()) { if (Date.now() > end) throw new Error("timed out waiting"); await tick(); } }
const MCP_URL = "https://mcp.example.com/mcp";
const jsonRes = (id, result) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { headers: { "content-type": "application/json", "mcp-session-id": "s1" } });
/** A DiscoverResult of a server that speaks both revisions (round 6). */
const MODERN_OK = { resultType: "complete", supportedVersions: ["2026-07-28", "2025-11-25"], capabilities: { tools: {}, prompts: {}, resources: {} }, instructions: "Use with care.", _meta: { "io.modelcontextprotocol/serverInfo": { name: "dual", version: "2" } }, ttlMs: 0, cacheScope: "private" };
/**
 * A STAND-IN SERVER THAT SPEAKS BOTH REVISIONS (round 6) at MCP_URL: server/discover answered with `discover` (a result, `{ error
 * }`, a Response, or a function of the request giving one); `initialize` as a 2025-11-25 server; a request carrying the
 * 2026-07-28 envelope answered by `modern({ msg, headers, n })` (a result or a Response; `n` its method's count), any other by
 * `legacy({ msg, headers })`. Everything POSTed is in `seen`, each GET in `gets` (405).
 */
function dual({ discover = MODERN_OK, modern = null, legacy = null } = {}) {
  const seen = [], gets = [];
  const fetchFn = async (url, init = {}) => {
    if ((init.method || "GET") === "GET") { gets.push({ headers: init.headers || {} }); return new Response(null, { status: 405 }); }
    const msg = JSON.parse(init.body), headers = init.headers || {};
    seen.push({ msg, headers, signal: init.signal });
    if (msg.method === "server/discover") {
      const d = typeof discover === "function" ? await discover(msg, init) : discover;
      if (d instanceof Response) return d;
      return new Response(JSON.stringify(d && d.error ? { jsonrpc: "2.0", id: msg.id, error: d.error } : { jsonrpc: "2.0", id: msg.id, result: d }), { headers: { "content-type": "application/json" } });
    }
    if (!("id" in msg)) return new Response(null, { status: 202 });
    if (msg.method === "initialize") return jsonRes(msg.id, { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "x", version: "1" } });
    const isModern = !!(msg.params && msg.params._meta && msg.params._meta["io.modelcontextprotocol/protocolVersion"] === "2026-07-28");
    const n = seen.filter((x) => x.msg.method === msg.method).length;
    const run = isModern ? modern : legacy;
    if (run) { const r = await run({ msg, headers, n }); if (r instanceof Response) return r; return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: r }), { headers: { "content-type": "application/json", "mcp-session-id": "zz" } }); }
    return jsonRes(msg.id, msg.method === "tools/list" ? { tools: [] } : textOf("plain " + msg.method));
  };
  return { fetchFn, seen, gets };
}
/**
 * A STAND-IN SERVER WITH ITS OWN STREAM: Streamable HTTP at MCP_URL; a GET opens the server's own event stream (`gets`: each
 * GET's headers and signal; `statuses[k]` the k-th GET's status, 200 by default; `streams`: those open, each with push(msg,
 * id?) and close()); `script({ msg, push, close, reply, gets, streams })` runs a tool call (or `listScript` a tools/list),
 * sending on the latest stream and waiting for Coder's answers (`reply(id)`). Everything Coder POSTs is in `seen`.
 */
function lister(script, opts = {}) {
  const { statuses = [], initStatus = 202, listScript = null } = opts;
  // (A version of undefined is a server that answers none.)
  const version = "version" in opts ? opts.version : "2025-11-25";
  const seen = [], gets = [], streams = [], replies = new Map(), waiters = new Map();
  const reply = (id) => (replies.has(id) ? Promise.resolve(replies.get(id)) : new Promise((ok) => waiters.set(id, ok)));
  const push = (o, id = "") => streams.at(-1).push(o, id);
  const close = () => streams.at(-1).close();
  const ctx = { push, close, reply, gets, streams };
  const fetchFn = async (url, init = {}) => {
    if ((init.method || "GET") === "GET") {
      gets.push({ headers: init.headers || {}, signal: init.signal });
      const st = statuses[gets.length - 1] ?? 200;
      if (st !== 200) return new Response(null, { status: st });
      if (opts.emptyGets) return new Response("", { headers: { "content-type": "text/event-stream" } });
      let ctl;
      const body = new ReadableStream({ start(c) { ctl = c; } });
      const one = { push: (o, id) => ctl.enqueue(enc.encode((id ? "id: " + id + "\n" : "") + "data: " + JSON.stringify(o) + "\n\n")), close: () => { try { ctl.close(); } catch { /* closed */ } } };
      if (init.signal) init.signal.addEventListener("abort", () => one.close(), { once: true });
      streams.push(one);
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    }
    const msg = JSON.parse(init.body);
    seen.push({ msg, headers: init.headers || {} });
    if (!("method" in msg)) { replies.set(msg.id, msg); const w = waiters.get(msg.id); if (w) { waiters.delete(msg.id); w(msg); } return new Response(null, { status: 202 }); }
    if (!("id" in msg)) return new Response(null, { status: msg.method === "notifications/initialized" ? initStatus : 202 });
    if (msg.method === "initialize") return jsonRes(msg.id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "x", version: "1" } });
    const run = msg.method === "tools/call" ? script : msg.method === "tools/list" && listScript ? listScript : null;
    if (!run) return jsonRes(msg.id, { tools: [] });
    const body = new ReadableStream({ async start(c) {
      const result = await run({ msg, ...ctx });
      try { c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\n\n")); c.close(); } catch { /* closed */ }
    } });
    return new Response(body, { headers: { "content-type": "text/event-stream", "mcp-session-id": "s1" } });
  };
  return { fetchFn, seen, gets, streams };
}

test("EL16 the protocol version, as Claude Code 2.1.325 negotiates it on its earlier handshake: initialize asks for 2025-11-25 (no version header on it), a server may answer any version it takes (2025-11-25 back to 2024-10-07) and that one goes in every later request's header; one it doesn't take ends the connection in its words, not tried again; the older SSE transport the same; the sign-in lookups name the same version", async () => {
  assert.equal(M.MCP_VERSION, "2025-11-25");
  assert.deepEqual([...M.MCP_VERSIONS], ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"]);
  for (const v of ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"]) {
    const s = lister(null, { version: v, statuses: [405] });
    const [r] = await M.mcpSession(MCP_URL, "tok", [["tools/list", {}]], { fetchFn: s.fetchFn });
    assert.deepEqual(r, { tools: [] }, v + " works");
    const init = s.seen.find((x) => x.msg.method === "initialize");
    assert.equal(init.msg.params.protocolVersion, "2025-11-25");
    assert.equal(init.headers["mcp-protocol-version"], undefined, "none on initialize itself");
    assert.equal(s.seen.find((x) => x.msg.method === "notifications/initialized").headers["mcp-protocol-version"], v);
    assert.equal(s.seen.find((x) => x.msg.method === "tools/list").headers["mcp-protocol-version"], v, "the version the server answered");
    assert.equal(s.gets[0].headers["mcp-protocol-version"], v);
  }
  // A version it doesn't take (the newer revision included: initialize takes only the earlier ones; a server of the newer one
  // says so to server/discover, EL22): Claude Code's words, no retry, no SSE. (Round 6: its probe comes first.)
  for (const v of ["2026-07-28", "2024-01-01", undefined]) {
    const s = lister(null, { version: v });
    await assert.rejects(M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: s.fetchFn, wait: async () => {} }), { message: "Server's protocol version is not supported: " + v });
    assert.deepEqual(s.seen.map((x) => x.msg.method), ["server/discover", "initialize"], "nothing after it, not tried again");
    assert.equal(s.gets.length, 0);
  }
  // The older SSE transport: the same version asked for, the one answered in later messages' header.
  const sseServer = (answer) => {
    const posted = [];
    const fetchFn = async (url, init = {}) => {
      if ((init.method || "GET") === "GET") { const body = new ReadableStream({ start(c) { c.enqueue(enc.encode("event: endpoint\ndata: /messages?sid=1\n\n")); fetchFn.c = c; } }); return new Response(body, { headers: { "content-type": "text/event-stream" } }); }
      const msg = JSON.parse(init.body);
      posted.push({ msg, headers: init.headers || {} });
      if ("id" in msg && "method" in msg) setTimeout(() => fetchFn.c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: msg.method === "initialize" ? { protocolVersion: answer, capabilities: {} } : { tools: [] } }) + "\n\n")), 5);
      return new Response(null, { status: 202 });
    };
    return { fetchFn, posted };
  };
  const old = sseServer("2024-11-05");
  await M.sseSession("https://mcp.example.com/sse", "", [["tools/list", {}]], { fetchFn: old.fetchFn });
  assert.equal(old.posted.find((x) => x.msg.method === "initialize").msg.params.protocolVersion, "2025-11-25");
  assert.equal(old.posted.find((x) => x.msg.method === "initialize").headers["mcp-protocol-version"], undefined);
  assert.equal(old.posted.find((x) => x.msg.method === "tools/list").headers["mcp-protocol-version"], "2024-11-05");
  await assert.rejects(M.sseSession("https://mcp.example.com/sse", "", [["tools/list", {}]], { fetchFn: sseServer("1999-01-01").fetchFn }), { message: "Server's protocol version is not supported: 1999-01-01" });
  // The sign-in lookups (Claude Code's MCP-Protocol-Version on them: 2025-11-25).
  const asked = [];
  await M.discover(MCP_URL, "", { fetchFn: async (u, i) => { asked.push(i.headers["mcp-protocol-version"]); return new Response("{}", { status: 404 }); } }).catch(() => {});
  assert.ok(asked.length > 0 && asked.every((v) => v === "2025-11-25"));
});

test("EL17 roots, as Claude Code 2.1.325 declares and answers them: a server's roots/list gets the chat's working folders (the project's, the other repositories', the owner's additional ones), each a file:// URL as pathToFileURL writes it, once each; none known (a list read for the page, Gloopy's calls) is an empty list; the machine sends its folders with each call and the gate passes them on, checked", async () => {
  const { pathToFileURL } = await import("node:url");
  for (const p of ["/work/shop", "/home/coder/my repo", "/w/a#b?c%d", "/w/tab\there", "/w/ünï €", "/w/back\\slash", "/w/q\"<>`{}|^[]", "/w/semi;colon=1&x+y@z"]) assert.equal(E.fileUrl(p), pathToFileURL(p).href, p);
  assert.deepEqual(E.rootsResult(["/work/shop", "/work/lib", "/work/shop", "rel/x", "/a\0b", 5, "/" + "x".repeat(5000)]), { roots: [{ uri: "file:///work/shop" }, { uri: "file:///work/lib" }] });
  assert.deepEqual(E.rootsResult(undefined), { roots: [] });
  // On the call's own stream: answered with the session's folders, as Claude Code's handler answers it.
  const s = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: "r1", method: "roots/list" }); return textOf(JSON.stringify((await reply("r1")).result)); });
  const [r] = await M.mcpSession(MCP_URL, "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn, talk: W.serverTalk({ roots: ["/work/shop", "/work/my lib"] }) });
  assert.equal(r.content[0].text, JSON.stringify({ roots: [{ uri: "file:///work/shop" }, { uri: "file:///work/my%20lib" }] }));
  assert.equal(s.seen.find((x) => x.msg.id === "r1" && !("method" in x.msg)).headers["mcp-session-id"], "s1");
  // None known: an empty list (Claude Code always has one; a list read for the page has no chat).
  const s2 = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: 2, method: "roots/list", params: {} }); return textOf(JSON.stringify((await reply(2)).result)); });
  const [r2] = await M.mcpSession(MCP_URL, "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s2.fetchFn });
  assert.equal(r2.content[0].text, '{"roots":[]}');
  // The machine's caller sends the chat's folders with each call (and none with an answer).
  const sent = [];
  const call = A.connectorCaller({ url: "https://jessica.gofarther.dev/api/coder/model", headers: {} }, async (u, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ text: "x", isError: false }), { status: 200 }); }, { roots: ["/work/shop", "/work/lib"] });
  await call("mcp__linear__make_issue", { a: 1 });
  assert.deepEqual(sent[0], { tool: "mcp__linear__make_issue", args: { a: 1 }, roots: ["/work/shop", "/work/lib"] });
  // The gate passes them on (checked: full paths only), to a call that can ask and to one that cannot.
  const s3 = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: 3, method: "roots/list" }); return textOf(JSON.stringify((await reply(3)).result)); });
  const b = memBucket();
  await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: s3.fetchFn });
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 4 }));
  await M.keepJobTools(b, "u1", "chat-1", 4, M.toolsFor(await M.readConnectors(b, "u1")).map);
  const until0 = String(Date.now() + 60_000);
  const hdr = { "x-coder-chat": "u1/chat-1", "x-coder-turn": "4", "x-coder-until": until0, "x-coder-model": await modelPass(env, "u1/chat-1", "4", until0) };
  const res = await M.handleMcp(new Request("https://jessica.gofarther.dev/api/coder/mcp", { method: "POST", headers: hdr, body: JSON.stringify({ tool: "mcp__linear__make_issue", args: {}, roots: ["/work/shop", "relative", "/work/other"] }) }), { ...env, CODER_BUCKET: b }, { fetchFn: s3.fetchFn });
  assert.equal((await res.json()).text, JSON.stringify({ roots: [{ uri: "file:///work/shop" }, { uri: "file:///work/other" }] }));
  // Coder's machine gives its caller the chat's working folders; Gloopy's calls go as before.
  assert.match(readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /const mcpCall = connectors\.length \? connectorCaller\(via, fetch, gloopy \? \{\} : \{ roots: workRoots \}\) : null;/);
});

test("EL18 a question's own words for its card (its server's _meta[\"anthropic/permissionDisplay\"], which Claude Code passes its cloud page as the elicitation's title, display_name and description): the Worker passes them on, the machine's card carries them, the page shows the title as the card's heading and the description under it; without them, the connector's line as before", async () => {
  const PD = { title: "Choose where the issue goes", displayName: "Linear issue", description: "The issue is made in the project you pick.", extra: 1 };
  assert.deepEqual(E.permissionDisplay({ "anthropic/permissionDisplay": PD }), { title: PD.title, displayName: PD.displayName, description: PD.description });
  assert.deepEqual(E.permissionDisplay({ "anthropic/permissionDisplay": { title: 5, description: "d" } }), { description: "d" }, "only text, as Claude Code's AI() takes it");
  for (const m of [undefined, null, {}, { "anthropic/permissionDisplay": "x" }, { "anthropic/permissionDisplay": { title: 1 } }]) assert.equal(E.permissionDisplay(m), null);
  // The Worker: the question's line carries them.
  const s = asker(async ({ emit, reply }) => { emit({ jsonrpc: "2.0", id: 1, method: "elicitation/create", params: { ...FORM, _meta: { "anthropic/permissionDisplay": PD } } }); return textOf(JSON.stringify((await reply(1)).result)); });
  const mc = machine(async () => ({ result: { action: "decline" } }));
  await M.mcpSession(MCP_URL, "", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn, talk: W.serverTalk({ ask: mc.ask, server: "Linear", tool: "make_issue" }) });
  assert.deepEqual(mc.lines.find((x) => x.t === "elicit").display, { title: PD.title, displayName: PD.displayName, description: PD.description });
  // The machine: its card carries them (a title of spaces is none).
  const t = await turn({ server: async (o) => { await o.ask.elicit(Q({ display: { title: PD.title, displayName: PD.displayName, description: PD.description } })); return { text: "x", isError: false }; }, ask: async () => ({ choice: "decline" }) });
  const card = t.events.find((e) => e.type === "elicit");
  assert.deepEqual([card.title, card.displayName, card.description, card.connector], [PD.title, PD.displayName, PD.description, "Linear"]);
  const t2 = await turn({ server: async (o) => { await o.ask.elicit(Q({ display: { title: "   " } })); return { text: "x", isError: false }; }, ask: async () => ({ choice: "decline" }) });
  assert.equal(t2.events.find((e) => e.type === "elicit").title, undefined);
  // The page: its title as the heading, its description under it, the connector still named in "While using".
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const from = ui.indexOf("  const EL_FORMATS = "), to = ui.indexOf("  async function answerPerm(pid, choice) {");
  const make = (S) => new Function("S", "esc", "ICON", "CSS", ui.slice(from, to) + "\nreturn { elicitHTML };")(S, esc, { globe: '<svg width="26" height="26"></svg>', term: "<svg></svg>" }, { escape: (x) => x });
  const ev = { type: "elicit", pid: "p1abcdef", connector: "Linear", tool: "Linear: make_issue", mode: "form", message: "Which project?", requestedSchema: FORM.requestedSchema, order: ["project", "urgent"], title: "Choose <where> the issue goes", description: PD.description };
  const html = make({ running: true, events: [{}, ev] }).elicitHTML(ev, 1);
  assert.match(html, /<b>Choose &lt;where&gt; the issue goes<\/b><\/div><p class="cd-el-sub">The issue is made in the project you pick\.<\/p><p class="cd-el-from">While using Linear: make_issue<\/p>/);
  assert.doesNotMatch(html, /requests your input/);
  const u = { ...ev, mode: "url", url: "https://linear.example.com/oauth", requestedSchema: undefined, order: undefined, description: undefined };
  assert.match(make({ running: true, events: [{}, u] }).elicitHTML(u, 1), /<b>Choose &lt;where&gt; the issue goes<\/b><\/div><p class="cd-el-from">/);
  const plain = { ...ev, title: undefined, description: undefined };
  assert.match(make({ running: true, events: [{}, plain] }).elicitHTML(plain, 1), /<b>MCP server “Linear” requests your input<\/b><\/div><p class="cd-el-from">/);
  assert.match(readFileSync(new URL("../public/coder.css", import.meta.url), "utf8"), /\.cd-el-sub \{/);
});

test("EL19 the server's own stream, as Claude Code 2.1.325's transport opens it: a GET (event stream only, with the session, the version and the sign-in) once the server accepts the initialized notice with 202; a question there during a tool call goes to the card and holds the call's idle timer, its answer POSTed back with the session; ping and roots/list answered; one while no tool call runs is cancelled; 405 is none; a stream that ends is opened again (Last-Event-ID, after its retry or 1 s then 1.5 s), given up after 2 failed tries; it closes with the session", async () => {
  // A question on it, ping and roots/list.
  const s = lister(async ({ push, reply, streams }) => {
    await until(() => streams.length === 1);
    push({ jsonrpc: "2.0", id: "g1", method: "elicitation/create", params: FORM });
    const a = await reply("g1");
    push({ jsonrpc: "2.0", id: "g2", method: "ping" });
    push({ jsonrpc: "2.0", id: "g3", method: "roots/list" });
    return textOf(JSON.stringify([a.result, (await reply("g2")).result, (await reply("g3")).result]));
  });
  const mc = machine(async () => { await tick(250); return { result: { action: "accept", content: { project: "DOCS" } } }; });
  // (An idle limit of 100 ms: the 250 ms the owner takes on the stream's question does not end the call.)
  const [r] = await M.mcpSession(MCP_URL, "tok", [["tools/call", { name: "make_issue", arguments: {} }]], { fetchFn: s.fetchFn, idleMs: 100, talk: W.serverTalk({ ask: mc.ask, server: "Linear", tool: "make_issue", roots: ["/work/shop"] }) });
  assert.equal(r.content[0].text, JSON.stringify([{ action: "accept", content: { project: "DOCS" } }, {}, { roots: [{ uri: "file:///work/shop" }] }]));
  assert.equal(s.gets.length, 1);
  assert.deepEqual(s.gets[0].headers, { accept: "text/event-stream", "mcp-protocol-version": "2025-11-25", authorization: "Bearer tok", "mcp-session-id": "s1" });
  assert.equal(mc.lines.find((x) => x.t === "elicit").message, FORM.message);
  const ans = s.seen.find((x) => x.msg.id === "g1" && !("method" in x.msg));
  assert.deepEqual([ans.headers["mcp-session-id"], ans.headers["mcp-protocol-version"]], ["s1", "2025-11-25"]);
  await until(() => s.gets[0].signal.aborted);
  // While no tool call runs (a list read): cancelled, as one with no one to ask.
  const l = lister(null, { listScript: async ({ push, reply, streams }) => { await until(() => streams.length === 1); push({ jsonrpc: "2.0", id: "q", method: "elicitation/create", params: FORM }); return { tools: [{ name: "t", inputSchema: { type: "object" }, description: JSON.stringify((await reply("q")).result) }] }; } });
  const [list] = await M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: l.fetchFn, talk: W.serverTalk({ ask: machine().ask }) });
  assert.equal(list.tools[0].description, '{"action":"cancel"}');
  // 405: a server with none, asked once; the notice answered 200 rather than 202: never opened.
  const no = lister(async () => textOf("fine"), { statuses: [405] });
  assert.equal((await M.mcpSession(MCP_URL, "", [["tools/call", { name: "x", arguments: {} }]], { fetchFn: no.fetchFn, wait: async () => {} }))[0].content[0].text, "fine");
  assert.equal(no.gets.length, 1);
  const plain = lister(async () => textOf("fine"), { initStatus: 200 });
  await M.mcpSession(MCP_URL, "", [["tools/call", { name: "x", arguments: {} }]], { fetchFn: plain.fetchFn });
  assert.equal(plain.gets.length, 0);
  // Opened again when it ends: with Last-Event-ID once it gave ids; after 2 failed tries, given up.
  const waited = [];
  const again = lister(async ({ push, close, streams, gets }) => {
    await until(() => streams.length === 1);
    push({ jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: "hi" } }, "ev1");
    close();
    await until(() => streams.length === 2);
    close();
    await until(() => gets.length === 4);
    await tick(60);
    return textOf("ok");
  }, { statuses: [200, 200, 500, 503] });
  await M.mcpSession(MCP_URL, "", [["tools/call", { name: "x", arguments: {} }]], { fetchFn: again.fetchFn, wait: async (ms) => { waited.push(ms); } });
  assert.equal(again.gets.length, 4, "the first, one taken up again, then 2 failed tries");
  assert.equal(again.gets[0].headers["last-event-id"], undefined);
  assert.equal(again.gets[1].headers["last-event-id"], "ev1");
  assert.deepEqual(waited, [1000, 1000, 1500], "1 s after each end, then 1.5 s");
  assert.deepEqual([M.streamDelay(0), M.streamDelay(1), M.streamDelay(2), M.streamDelay(20), M.streamDelay(1, 250)], [1000, 1500, 2250, 30000, 250]);
  // (Coder's own bound: a server that accepts the GET and closes it at once is asked again at most 100 times in a session,
  // each GET being one of the Worker's counted subrequests.)
  assert.equal(M.STREAM_REOPENS_MAX, 100);
  const shut = lister(async ({ gets }) => { await until(() => gets.length >= 101); await tick(60); return textOf("ok"); }, { emptyGets: true });
  await M.mcpSession(MCP_URL, "", [["tools/call", { name: "x", arguments: {} }]], { fetchFn: shut.fetchFn, wait: async () => {} });
  assert.equal(shut.gets.length, 101);
});

test("EL20 a request's stream that ends before its answer, after giving event ids, is taken up again where it stopped (MCP 2025-11-25's resumption, as Claude Code's transport does it): a GET with Last-Event-ID, after the server's retry; the answer on it is the call's; one with no ids that ends gives no answer, as before", async () => {
  const run = async ({ ids = true, answerId = null, retry = null, never = false } = {}) => {
    const gets = [], waited = [];
    let callId;
    const fetchFn = async (url, init = {}) => {
      if ((init.method || "GET") === "GET") {
        const h = init.headers || {};
        gets.push(h);
        if (!h["last-event-id"]) return new Response(null, { status: 405 });
        if (never) return new Response("id: 7\ndata: \n\n", { headers: { "content-type": "text/event-stream" } });
        return new Response("id: 8\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: answerId ?? callId, result: textOf("taken up again after " + h["last-event-id"]) }) + "\n\n", { headers: { "content-type": "text/event-stream" } });
      }
      const msg = JSON.parse(init.body);
      if (!("id" in msg)) return new Response(null, { status: 202 });
      if (msg.method === "initialize") return jsonRes(msg.id, { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "x", version: "1" } });
      callId = msg.id;
      // (Its priming event, as an MCP SDK server with an event store writes one on 2025-11-25, then the stream closes.)
      return new Response((ids ? "id: 7\n" : "") + (retry !== null ? "retry: " + retry + "\n" : "") + "data: \n\n", { headers: { "content-type": "text/event-stream", "mcp-session-id": "s1" } });
    };
    const out = await M.mcpSession(MCP_URL, "tok", [["tools/call", { name: "x", arguments: {} }]], { fetchFn, wait: async (ms) => { waited.push(ms); } }).then((x) => x[0], (e) => e);
    return { out, gets, waited };
  };
  const a = await run({ retry: 30 });
  assert.equal(a.out.content[0].text, "taken up again after 7");
  const g = a.gets.find((h) => h["last-event-id"]);
  assert.deepEqual(g, { accept: "text/event-stream", "mcp-protocol-version": "2025-11-25", authorization: "Bearer tok", "mcp-session-id": "s1", "last-event-id": "7" });
  assert.ok(a.waited.includes(30), "after the server's retry");
  // On the stream taken up again, an answer is the call's (Claude Code's replayMessageId).
  assert.equal((await run({ answerId: 999 })).out.content[0].text, "taken up again after 7");
  // No ids: nothing to take up again.
  const n = await run({ ids: false });
  assert.equal(n.out.message, "the MCP server gave no answer");
  assert.equal(n.gets.filter((h) => h["last-event-id"]).length, 0);
  // Never an answer, however often taken up again: given up after Coder's bound (the Worker's subrequests are counted).
  const z = await run({ never: true });
  assert.equal(z.out.message, "the MCP server gave no answer");
  assert.equal(z.gets.filter((h) => h["last-event-id"]).length, M.STREAM_REOPENS_MAX);
});

test("EL21 (round 6) MCP tasks, as Claude Code 2.1.325's cloud sessions run them: none, on either revision (its docs: tasks are on in terminal CLI sessions, Agent SDK sessions and GitHub Actions runs; its program: off by default with CLAUDE_CODE_REMOTE). On a 2025-11-25 session a tool that supports tasks is called plainly (no `task` asked for) and an answer with a task is the call's answer, not followed; on a 2026-07-28 session the capabilities carry no tasks extension and a task answer ends the call in its words, not followed", async () => {
  assert.equal(M.followTask, undefined, "no task follower");
  // 2025-11-25: a tool with execution.taskSupport, called plainly.
  const old = dual({ discover: { tools: [] }, legacy: ({ msg }) => (msg.method === "tools/list" ? { tools: [{ name: "export", inputSchema: { type: "object" }, execution: { taskSupport: "required" } }] } : msg.method === "tools/call" ? { task: { taskId: "t1", status: "working" } } : {}) });
  const b = memBucket();
  const added = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: old.fetchFn });
  assert.equal(added.connector.tools[0].tasks, undefined, "nothing kept about tasks");
  const r = await M.callTool(env, b, "u1", added.connector.id, "export", { a: 1 }, { fetchFn: old.fetchFn });
  const call = old.seen.find((x) => x.msg.method === "tools/call");
  assert.deepEqual(Object.keys(call.msg.params).sort(), ["_meta", "arguments", "name"]);
  assert.deepEqual(r, { text: "(no output)", isError: false }, "the answer as it is: no content");
  assert.equal(old.seen.some((x) => /^tasks\//.test(x.msg.method)), false, "not followed");
  // 2026-07-28: no tasks extension in the envelope; a task answer is Claude Code's error.
  const now = dual({ modern: ({ msg }) => (msg.method === "tools/list" ? { resultType: "complete", ttlMs: 0, cacheScope: "private", tools: [{ name: "export", inputSchema: { type: "object" }, execution: { taskSupport: "required" } }] } : { resultType: "task", taskId: "t1", status: "working", createdAt: "2026-11-14T00:00:00Z", lastUpdatedAt: "2026-11-14T00:00:00Z", ttlMs: null }) });
  const b2 = memBucket();
  const a2 = await M.addConnector(env, b2, "u1", { name: "Linear", url: MCP_URL, fetchFn: now.fetchFn });
  const r2 = await M.callTool(env, b2, "u1", a2.connector.id, "export", {}, { fetchFn: now.fetchFn });
  assert.deepEqual(r2, { text: "error: Unsupported result type 'task' for tools/call", isError: true });
  const c2 = now.seen.find((x) => x.msg.method === "tools/call");
  assert.deepEqual(c2.msg.params._meta["io.modelcontextprotocol/clientCapabilities"], { roots: { listChanged: true }, elicitation: { form: {}, url: {} } });
  assert.equal(c2.msg.params.task, undefined);
  assert.equal(now.seen.some((x) => /^tasks\//.test(x.msg.method)), false, "not followed");
});

// ── MCP 2026-07-28, AS CLAUDE CODE 2.1.325 SPEAKS IT (round 6; the owner: "do what claude code does") ──────────────────

test("EL22 (round 6) Claude Code's probe for MCP 2026-07-28: before anything else a server/discover (id server-discover-probe-1, its _meta the version, Coder's clientInfo and capabilities; headers MCP-Protocol-Version: 2026-07-28 and Mcp-Method, the sign-in, no session); a valid DiscoverResult listing 2026-07-28 makes the session that revision's (no initialize, no GET); anything else is a server of the earlier revisions and initialize follows: another reply or error, a 4xx or 5xx, a reply to another id or one it can't read, a stream that ends, a failure at once; 202, a reply with nothing for it, or no answer, after its 5 s bound; -32022 naming 2026-07-28 is asked once more, naming only another new revision ends it; a 401 (or 403 insufficient_scope) is a sign-in", async () => {
  assert.deepEqual([ERA.MODERN_VERSION, ERA.PROBE_TIMEOUT_MS, ERA.PROBE_ID], ["2026-07-28", 5000, "server-discover-probe-"]);
  // What it sends.
  const s = dual();
  const out = await M.mcpSession(MCP_URL, "tok", [["tools/list", {}]], { fetchFn: s.fetchFn });
  assert.equal(out.era, "modern");
  assert.deepEqual(out.init, { supportedVersions: ["2026-07-28", "2025-11-25"], capabilities: MODERN_OK.capabilities, instructions: "Use with care.", _meta: MODERN_OK._meta });
  assert.deepEqual(s.seen[0].msg, { jsonrpc: "2.0", id: "server-discover-probe-1", method: "server/discover", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "Go Farther", version: "1.0.0" }, "io.modelcontextprotocol/clientCapabilities": { roots: { listChanged: true }, elicitation: { form: {}, url: {} } } } } });
  assert.deepEqual(s.seen[0].headers, { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "mcp-method": "server/discover", authorization: "Bearer tok" });
  assert.deepEqual(s.seen.map((x) => x.msg.method), ["server/discover", "tools/list"], "no initialize, no initialized notice");
  assert.equal(s.gets.length, 0, "no GET stream");
  // How it decides.
  const legacyRun = ["server/discover", "initialize", "notifications/initialized", "tools/list"];
  const sse = (o) => new Response("event: message\ndata: " + JSON.stringify(o) + "\n\n", { headers: { "content-type": "text/event-stream" } });
  const asJson = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const cases = [
    ["a DiscoverResult with no resultType", { supportedVersions: ["2026-07-28"], capabilities: {} }, "modern"],
    ["one on an event stream", (m) => sse({ jsonrpc: "2.0", id: m.id, result: MODERN_OK }), "modern"],
    ["one listing only earlier revisions", { supportedVersions: ["2025-11-25"], capabilities: {} }, "legacy"],
    ["one with no capabilities", { supportedVersions: ["2026-07-28"] }, "legacy"],
    ["capabilities of the wrong shape", { supportedVersions: ["2026-07-28"], capabilities: { tools: { listChanged: "yes" } } }, "legacy"],
    ["another result", { tools: [] }, "legacy"],
    ["Method not found", { error: { code: -32601, message: "Method not found" } }, "legacy"],
    ["-32022 naming only earlier revisions", { error: { code: -32022, message: "Unsupported protocol version", data: { supported: ["2025-11-25"] } } }, "legacy"],
    ["-32022 without its list", { error: { code: -32022, message: "Unsupported protocol version" } }, "legacy"],
    ["a 400 in words", new Response("Bad Request: Server not initialized", { status: 400 }), "legacy"],
    ["a 400 with a JSON-RPC error", asJson({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Bad Request: No valid session ID provided" } }, 400), "legacy"],
    ["a 404", new Response("no", { status: 404 }), "legacy"],
    ["a 405", new Response("no", { status: 405 }), "legacy"],
    ["a 500", new Response("down", { status: 500 }), "legacy"],
    ["a plain 403", new Response("no", { status: 403 }), "legacy-403"],
    ["202 and no answer (after the probe's bound, as Claude Code's probe waits it out)", new Response(null, { status: 202 }), "legacy", true],
    ["a JSON reply with nothing for the probe (after its bound)", asJson({ jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: "hi" } }), "legacy", true],
    ["JSON it can't read", new Response("{not json", { headers: { "content-type": "application/json" } }), "legacy"],
    ["a reply to another id", asJson({ jsonrpc: "2.0", id: 7, result: MODERN_OK }), "legacy"],
    ["a stream that ends with no answer", new Response(": nothing\n\n", { headers: { "content-type": "text/event-stream" } }), "legacy"],
    ["a stream it can't read", new Response("data: {oops\n\n", { headers: { "content-type": "text/event-stream" } }), "legacy"],
    ["another kind of answer", new Response("<html></html>", { headers: { "content-type": "text/html" } }), "legacy"],
    ["a failure", () => { throw new TypeError("fetch failed"); }, "legacy"],
  ];
  for (const [why, d, era, waits = false] of cases) {
    const x = dual({ discover: d });
    const t1 = Date.now();
    if (era === "legacy-403") {
      const f = async (u, i) => (JSON.parse(i.body).method === "server/discover" ? x.fetchFn(u, i) : new Response("no", { status: 403 }));
      await assert.rejects(M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: async (u, i) => { const r = await f(u, i); if (JSON.parse(i.body).method !== "server/discover") x.seen.push({ msg: JSON.parse(i.body) }); return r; } }), (e) => e instanceof M.NeedsSignIn, why);
      assert.deepEqual(x.seen.map((y) => y.msg.method), ["server/discover", "initialize"], why + ": the earlier handshake's 403 is the sign-in");
      continue;
    }
    const r = await M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: x.fetchFn, probeMs: 120 });
    assert.equal(r.era, era, why);
    assert.deepEqual(x.seen.map((y) => y.msg.method), era === "modern" ? ["server/discover", "tools/list"] : legacyRun, why);
    if (waits) assert.ok(Date.now() - t1 >= 110, why + ": waited");
    else assert.ok(Date.now() - t1 < 110, why + ": at once");
  }
  // No answer within its bound (5 s; here 30 ms): the earlier revisions, the probe's request ended.
  const slow = dual({ discover: (m, init) => new Promise((ok) => init.signal.addEventListener("abort", () => ok(new Response(null, { status: 499 })), { once: true })) });
  const t0 = Date.now();
  assert.equal((await M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: slow.fetchFn, probeMs: 30 })).era, "legacy");
  assert.ok(Date.now() - t0 < 2000 && slow.seen[0].signal.aborted);
  // -32022 naming 2026-07-28: asked once more (server-discover-probe-2); twice is its error. Naming only another new one: its error.
  let k = 0;
  const again = dual({ discover: () => (++k === 1 ? { error: { code: -32022, message: "try again", data: { supported: ["2026-07-28"], requested: "2026-07-28" } } } : MODERN_OK) });
  assert.equal((await M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: again.fetchFn })).era, "modern");
  assert.deepEqual(again.seen.filter((y) => y.msg.method === "server/discover").map((y) => y.msg.id), ["server-discover-probe-1", "server-discover-probe-2"]);
  const twice = dual({ discover: { error: { code: -32022, message: "still no", data: { supported: ["2026-07-28"] } } } });
  await assert.rejects(M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: twice.fetchFn }), { message: "the MCP server said: still no" });
  assert.deepEqual(twice.seen.map((y) => y.msg.method), ["server/discover", "server/discover"], "no initialize after it");
  const newer = dual({ discover: { error: { code: -32022, message: "Unsupported protocol version", data: { supported: ["2027-03-01"] } } } });
  await assert.rejects(M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: newer.fetchFn }), (e) => e.message === "the MCP server said: Unsupported protocol version" && e.rpcCode === -32022);
  assert.deepEqual(ERA.probeVerdict({ kind: "rpc-error", error: { code: -32022, message: "", data: { supported: ["2027-03-01"] } } }).error.message, "the MCP server said: Unsupported protocol version: 2026-07-28");
  // A sign-in: 401, or 403 insufficient_scope; the header kept for its sign-in.
  const www = 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"';
  for (const [status, h, scope] of [[401, www, false], [403, 'Bearer error="insufficient_scope", scope="write"', true]]) {
    const x = dual({ discover: new Response("no", { status, headers: { "www-authenticate": h } }) });
    await assert.rejects(M.mcpSession(MCP_URL, "", [["tools/list", {}]], { fetchFn: x.fetchFn }), (e) => e instanceof M.NeedsSignIn && e.header === h && e.scope === scope);
    assert.deepEqual(x.seen.map((y) => y.msg.method), ["server/discover"]);
  }
  // The older SSE transport is never asked (Claude Code: an sse server keeps the earlier handshake).
  const posted = [];
  const sseOnly = async (url, init = {}) => {
    if ((init.method || "GET") === "GET") { const body = new ReadableStream({ start(c) { c.enqueue(enc.encode("event: endpoint\ndata: /messages?sid=1\n\n")); sseOnly.c = c; } }); return new Response(body, { headers: { "content-type": "text/event-stream" } }); }
    const msg = JSON.parse(init.body);
    posted.push(msg.method);
    if ("id" in msg && "method" in msg) setTimeout(() => sseOnly.c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: msg.method === "initialize" ? { protocolVersion: "2025-11-25", capabilities: {} } : { tools: [] } }) + "\n\n")), 5);
    return new Response(null, { status: 202 });
  };
  await M.mcpSession("https://mcp.example.com/sse", "", [["tools/list", {}]], { fetchFn: sseOnly });
  assert.deepEqual(posted, ["initialize", "notifications/initialized", "tools/list"]);
  // The Worker loads it without Node's modules (WF21 walks it); the page's sign-in lookups keep 2025-11-25.
  assert.doesNotMatch(readFileSync(new URL("../src/coder-mcp-era.mjs", import.meta.url), "utf8"), /from\s+["']node:/);
});

test("EL23 (round 6) a 2026-07-28 session, as Claude Code's client speaks it: every request carries the envelope (the version, Coder's clientInfo and capabilities, its own _meta after it) and the headers MCP-Protocol-Version, Mcp-Method and Mcp-Name (a tool's or prompt's name, a resource's uri, Base64 in its sentinel when not plain ASCII), never a session; a result's left-out type is complete; a request of the server's on a stream is dropped; a 400's JSON-RPC error is the request's answer; another result type, or one it can't read, ends the call in its words; the DiscoverResult's instructions are the server's", async () => {
  let streamed = 0;
  const s = dual({ modern: async ({ msg }) => {
    if (msg.method === "tools/list") return { tools: [{ name: "make", inputSchema: { type: "object", properties: { title: { type: "string" } } } }, { name: "Grüße", inputSchema: { type: "object" } }, { name: "odd", inputSchema: { type: "object" } }, { name: "bad", inputSchema: { type: "object" } }, { name: "notobj", inputSchema: { type: "object" } }, { name: "streamy", inputSchema: { type: "object" } }] };
    if (msg.method === "tools/call" && msg.params.name === "odd") return { resultType: "weird", content: [] };
    if (msg.method === "tools/call" && msg.params.name === "bad") return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32021, message: "Missing required client capabilities: sampling" } }), { status: 400, headers: { "content-type": "application/json" } });
    if (msg.method === "tools/call" && msg.params.name === "notobj") return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: "text" }), { headers: { "content-type": "application/json" } });
    if (msg.method === "tools/call" && msg.params.name === "streamy") {
      streamed++;
      return new Response("data: " + JSON.stringify({ jsonrpc: "2.0", id: 99, method: "elicitation/create", params: FORM }) + "\n\ndata: " + JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: msg.params._meta.progressToken, progress: 1 } }) + "\n\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { resultType: "complete", content: [{ type: "text", text: "streamed" }] } }) + "\n\n", { headers: { "content-type": "text/event-stream" } });
    }
    return { content: [{ type: "text", text: "made " + msg.params.name }] };
  } });
  const b = memBucket();
  const added = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: s.fetchFn });
  assert.equal(added.connector.instructions, "Use with care.", "the DiscoverResult's instructions");
  const list = s.seen.find((x) => x.msg.method === "tools/list");
  const ENV = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "Go Farther", version: "1.0.0" }, "io.modelcontextprotocol/clientCapabilities": { roots: { listChanged: true }, elicitation: { form: {}, url: {} } } };
  assert.deepEqual(list.msg.params, { _meta: ENV });
  assert.deepEqual(list.headers, { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/list" });
  const call = async (tool, args = {}) => M.callTool(env, b, "u1", added.connector.id, tool, args, { fetchFn: s.fetchFn });
  assert.deepEqual(await call("make", { title: "Bug" }), { text: "made make", isError: false }, "no resultType: complete");
  const sent = s.seen.filter((x) => x.msg.method === "tools/call").at(-1);
  assert.deepEqual(sent.msg.params, { name: "make", arguments: { title: "Bug" }, _meta: { ...ENV, progressToken: "gf-0" } });
  assert.equal(sent.headers["mcp-name"], "make");
  assert.equal(sent.headers["mcp-session-id"], undefined, "no session, though the server gave one");
  await call("Grüße");
  assert.equal(s.seen.filter((x) => x.msg.method === "tools/call").at(-1).headers["mcp-name"], "=?base64?R3LDvMOfZQ==?=");
  assert.deepEqual(await call("odd"), { text: "error: Unsupported result type 'weird' for tools/call", isError: true });
  assert.deepEqual(await call("bad"), { text: "error: the MCP server said: Missing required client capabilities: sampling", isError: true });
  assert.deepEqual(await call("notobj"), { text: "error: MCP server \"Linear\" returned a malformed result that failed schema validation: Invalid result for tools/call: not an object", isError: true });
  // A request of the server's on the call's stream: dropped (nothing POSTed back), its notices read.
  const before = s.seen.length;
  const mc = machine(async () => ({ result: { action: "accept", content: { project: "X" } } }));
  const r = await M.callTool(env, b, "u1", added.connector.id, "streamy", {}, { fetchFn: s.fetchFn, ask: mc.ask });
  assert.deepEqual([r, streamed], [{ text: "streamed", isError: false }, 1]);
  assert.deepEqual(s.seen.slice(before).map((x) => x.msg.method), ["tools/call"], "no answer POSTed (and no probe: the connection Coder keeps, EL27)");
  assert.equal(mc.lines.length, 0, "no card");
  // A prompt's and a resource's Mcp-Name; tasks/* would carry the task's id.
  const p = dual({ modern: ({ msg }) => (msg.method === "prompts/get" ? { messages: [{ role: "user", content: { type: "text", text: "go" } }] } : { contents: [] }) });
  await M.mcpSession(MCP_URL, "", [["prompts/get", { name: "triage", arguments: {} }], ["resources/read", { uri: "linear://issue/LIN-1" }]], { fetchFn: p.fetchFn });
  assert.deepEqual(p.seen.slice(1).map((x) => [x.headers["mcp-method"], x.headers["mcp-name"]]), [["prompts/get", "triage"], ["resources/read", "linear://issue/LIN-1"]]);
  assert.equal(ERA.modernHeaders({ method: "tasks/get", params: { taskId: "t 1" } }, "2026-07-28")["mcp-name"], "t 1");
  // Its result decoder, in its words.
  assert.deepEqual(ERA.decodeResult("tools/call", { resultType: "complete", content: [] }), { result: { content: [] } });
  assert.deepEqual(ERA.decodeResult("tools/call", { resultType: 3 }), { error: "Invalid result for tools/call: non-string resultType", malformed: true });
  assert.deepEqual(ERA.decodeResult("tools/call", { resultType: "input_required" }), { error: "Invalid result for tools/call: input_required carries neither inputRequests nor requestState (every input_required result must include at least one of the two)", malformed: true });
  assert.deepEqual(ERA.decodeResult("tools/call", { resultType: "input_required", requestState: "s" }), { input: { inputRequests: {}, requestState: "s" } });
});

test("EL24 (round 6) a 2026-07-28 server's questions come in its result (input_required), as Claude Code's client answers them: each on its card (permissionDisplay too; a URL one with no elicitationId), roots/list with the chat's folders, all of one round at once; then the call made again with a new id, the same name and arguments, `inputResponses` and the server's `requestState`, up to 10 rounds, 250 ms apart when it asked nothing; no one to ask is cancel; a sampling request, an entry it doesn't know or a bad question ends the call in its words; out of time with a card open: its words, the card withdrawn", async () => {
  const PD = { title: "Which project?", displayName: "Linear issue", description: "Pick one." };
  const URLASK = { mode: "url", message: "Sign in to Linear.", url: "https://linear.example.com/oauth?state=1" };
  const run = async (rounds, { ask = null, totalMs = 0, roots = ["/work/shop", "/work/notes"] } = {}) => {
    const naps = [];
    const s = dual({ modern: ({ msg, n }) => rounds[Math.min(n - 1, rounds.length - 1)](msg) });
    const talk = W.serverTalk({ ask, server: "Linear", tool: "make_issue", roots });
    let out, error;
    try { [out] = await M.mcpSession(MCP_URL, "", [["tools/call", { name: "make_issue", arguments: { title: "Bug" } }]], { fetchFn: s.fetchFn, talk, wait: async (ms) => { naps.push(ms); }, ...(totalMs ? { totalMs } : {}) }); } catch (e) { error = e; }
    return { out, error, naps, calls: s.seen.filter((x) => x.msg.method === "tools/call").map((x) => x.msg) };
  };
  const need = (inputRequests, requestState) => () => ({ resultType: "input_required", inputRequests, ...(requestState ? { requestState } : {}) });
  const done = (msg) => textOf("made with " + JSON.stringify(msg.params.inputResponses || null) + " " + (msg.params.requestState || "-"));
  // A form question and roots/list in one round: the card, the folders, then the call made again.
  const mc = machine(async () => ({ result: { action: "accept", content: { project: "WEB" } } }));
  let x = await run([need({ q: { method: "elicitation/create", params: { ...FORM, _meta: { "anthropic/permissionDisplay": PD } } }, r: { method: "roots/list" } }, "st-1"), done], { ask: mc.ask });
  assert.deepEqual(x.out, textOf('made with {"q":{"action":"accept","content":{"project":"WEB"}},"r":{"roots":[{"uri":"file:///work/shop"},{"uri":"file:///work/notes"}]}} st-1'));
  assert.deepEqual(x.calls.map((m) => m.id), [1, 2], "a new id");
  assert.deepEqual([x.calls[1].params.name, x.calls[1].params.arguments, x.calls[1].params._meta.progressToken], ["make_issue", { title: "Bug" }, "gf-1"]);
  const card = mc.lines.find((l) => l.t === "elicit");
  assert.deepEqual({ ...card, id: "" }, { t: "elicit", id: "", server: "Linear", tool: "make_issue", mode: "form", message: FORM.message, requestedSchema: FORM.requestedSchema, order: ["project", "urgent"], display: PD });
  // A URL question of this revision: no elicitationId, Open link and "I'm done, continue" as before.
  const mu = machine(async () => ({ result: { action: "accept" } }));
  x = await run([need({ u: { method: "elicitation/create", params: URLASK } }, "st-u"), done], { ask: mu.ask });
  assert.deepEqual(x.out, textOf('made with {"u":{"action":"accept"}} st-u'));
  assert.deepEqual(mu.lines.find((l) => l.t === "elicit").url, URLASK.url);
  assert.equal("elicitationId" in mu.lines.find((l) => l.t === "elicit"), false);
  // Only a requestState: made again after 250 ms, with no inputResponses; more rounds after it.
  x = await run([need({}, "wait-1"), need({ r: { method: "roots/list" } }, "wait-2"), done]);
  assert.deepEqual(x.naps, [250]);
  assert.deepEqual([x.calls[1].params.inputResponses, x.calls[1].params.requestState, x.calls[2].params.requestState], [undefined, "wait-1", "wait-2"]);
  // No one to ask (Gloopy's calls, a hook's): cancel.
  x = await run([need({ q: { method: "elicitation/create", params: FORM } }), done]);
  assert.deepEqual(x.out, textOf('made with {"q":{"action":"cancel"}} -'));
  // What it doesn't serve, in Claude Code's words; nothing made again.
  x = await run([need({ s: { method: "sampling/createMessage", params: { messages: [], maxTokens: 9 } } }), done]);
  assert.equal(x.error.message, "MCP server \"Linear\" asked for input this client could not serve (sampling/createMessage), so the call was not made again");
  assert.equal(x.calls.length, 1);
  for (const odd of [{ method: "ping" }, "nope", { params: {} }]) {
    x = await run([need({ o: odd }), done]);
    assert.equal(x.error.message, "MCP server \"Linear\" returned a malformed result that failed schema validation: its answer asked for input of a kind this client does not serve, so the call was not made again");
  }
  x = await run([need({ q: { method: "elicitation/create", params: { message: "x", requestedSchema: { type: "object", properties: { a: { type: "object" } } } } } }), done], { ask: mc.ask });
  assert.match(x.error.message, /^Invalid elicitation request: requestedSchema\.properties\.a is not/);
  // At most 10 rounds.
  x = await run([need({}, "again")]);
  assert.equal(x.error.message, "Multi-round-trip request 'tools/call' still required input after 10 rounds (inputRequired.maxRounds)");
  assert.equal(x.calls.length, 11);
  // Out of time while the card waits: Claude Code's words; the card withdrawn; not made again.
  const never = machine(() => new Promise(() => {}));
  x = await run([need({ q: { method: "elicitation/create", params: FORM } }, "s"), done], { ask: never.ask, totalMs: 400 });
  assert.equal(x.error.message, E.timedOutText("Linear", "make_issue", 400));
  assert.equal(never.withdrawn.length, 1);
  assert.equal(x.calls.length, 1);
  // (CI, 2026-11-20) The timer, not the wall clock, says the time ran out: with Date.now() behind the timers (a timer can
  // fire before Date.now() reaches its deadline), still the time-out's words, not "the question was withdrawn".
  const realNow = Date.now, t0 = realNow();
  Date.now = () => t0 + Math.floor((realNow() - t0) / 2);
  try {
    const never2 = machine(() => new Promise(() => {}));
    x = await run([need({ q: { method: "elicitation/create", params: FORM } }, "s"), done], { ask: never2.ask, totalMs: 400 });
    assert.equal(x.error.message, E.timedOutText("Linear", "make_issue", 400));
    assert.equal(never2.withdrawn.length, 1);
  } finally { Date.now = realNow; }
});

test("EL25 (round 6) a tool's x-mcp-header properties, as Claude Code's client takes them on a 2026-07-28 session: valid ones give each call its Mcp-Param-<name> headers (strings as they are, numbers and booleans as text, Base64 in its sentinel when not plain ASCII, none for a value not given); a tool with an invalid one is left out of that session's list (kept on an earlier one); a call refused for its headers (HeaderMismatch) is made once more after the list is read again", async () => {
  const H = (schema) => ERA.xMcpHeaders(schema);
  const P = (props) => ({ type: "object", properties: props });
  assert.deepEqual(H(P({ region: { type: "string", "x-mcp-header": "Region" }, q: { type: "string" }, deep: P({ id: { type: "integer", "x-mcp-header": "Item-Id" } }) })), { valid: true, declarations: [{ path: ["region"], headerName: "Region", type: "string" }, { path: ["deep", "id"], headerName: "Item-Id", type: "integer" }] });
  assert.deepEqual(H(P({ a: { type: "string" } })), { valid: true, declarations: [] });
  assert.deepEqual(H(P({ list: { type: "array", items: { type: "string", "x-mcp-header": "X" } } })), { valid: false, reason: "list.<items>: x-mcp-header is only permitted on properties statically reachable via a chain of 'properties' keys (not under items, additionalProperties, oneOf/anyOf/allOf/not, if/then/else, or $ref)" });
  assert.deepEqual(H(P({ a: { type: "string", "x-mcp-header": "Bad Name" } })).reason, "a: x-mcp-header 'Bad Name' is not a valid RFC 9110 token (no spaces, control characters or HTTP delimiters)");
  assert.deepEqual(H(P({ a: { type: "object", "x-mcp-header": "A" } })).reason, "a: x-mcp-header is only permitted on primitive-typed properties (string, integer, boolean); got object");
  assert.deepEqual(H(P({ a: { type: "string", "x-mcp-header": "" } })).reason, "a: x-mcp-header MUST be a non-empty string");
  assert.deepEqual(H(P({ a: { type: "string", "x-mcp-header": "Tag" }, b: { type: "string", "x-mcp-header": "tag" } })).reason, "x-mcp-header 'tag' is not case-insensitively unique (also declared as 'Tag')");
  // The spec's encoding examples, and the rest.
  const d = (name, path = [name.toLowerCase()]) => ({ path, headerName: name, type: "string" });
  assert.deepEqual(ERA.paramHeaders([d("Region"), d("Greeting"), d("Text"), d("Line"), d("Val"), d("N"), d("B"), d("Big"), d("Gone"), d("Null"), d("Id", ["deep", "id"])], { region: "us-west1", greeting: "Hello, 世界", text: " padded ", line: "line1\nline2", val: "=?base64?literal?=", n: 42, b: true, big: 2 ** 60, null: null, deep: { id: -7 } }), {
    "Mcp-Param-Region": "us-west1", "Mcp-Param-Greeting": "=?base64?SGVsbG8sIOS4lueVjA==?=", "Mcp-Param-Text": "=?base64?IHBhZGRlZCA=?=", "Mcp-Param-Line": "=?base64?bGluZTEKbGluZTI=?=", "Mcp-Param-Val": "=?base64?PT9iYXNlNjQ/bGl0ZXJhbD89?=", "Mcp-Param-N": "42", "Mcp-Param-B": "true", "Mcp-Param-Id": "-7" });
  assert.equal(ERA.headerValue(""), "=?base64??=");
  // Through the Worker: kept at the list, sent with each call on a 2026-07-28 session; an invalid tool left out there.
  const TOOLS = [{ name: "sql", inputSchema: P({ region: { type: "string", "x-mcp-header": "Region" }, query: { type: "string" } }) }, { name: "bad", inputSchema: P({ a: { type: "object", "x-mcp-header": "A" } }) }];
  let mismatch = 1;
  const s = dual({ discover: { ...MODERN_OK, capabilities: { tools: {} } }, modern: ({ msg, headers }) => {
    if (msg.method === "tools/list") return { tools: TOOLS };
    if (msg.params.arguments.region && headers["Mcp-Param-Region"] !== msg.params.arguments.region) return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32020, message: "Header mismatch: Mcp-Param-Region" } }), { status: 400, headers: { "content-type": "application/json" } });
    if (mismatch-- > 0) return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32020, message: "Header mismatch: Mcp-Param-Region" } }), { status: 400, headers: { "content-type": "application/json" } });
    return textOf("ran in " + headers["Mcp-Param-Region"]);
  }, legacy: ({ msg }) => (msg.method === "tools/list" ? { tools: TOOLS } : textOf("legacy")) });
  const b = memBucket();
  const a = await M.addConnector(env, b, "u1", { name: "Spanner", url: MCP_URL, fetchFn: s.fetchFn });
  assert.deepEqual(a.connector.tools.map((t) => t.name), ["sql"], "the invalid one left out");
  assert.deepEqual(a.connector.tools[0].headers, [{ path: ["region"], headerName: "Region", type: "string" }]);
  // (Refused once for its headers: its list read again, then made once more.)
  const r = await M.callTool(env, b, "u1", a.connector.id, "sql", { region: "us-west1", query: "SELECT 1" }, { fetchFn: s.fetchFn });
  assert.deepEqual(r, { text: "ran in us-west1", isError: false });
  assert.deepEqual(s.seen.filter((x) => x.msg.method !== "server/discover").map((x) => x.msg.method), ["tools/list", "tools/call", "tools/list", "tools/call"]);
  // On an earlier-revision session: the invalid tool kept, no Mcp-Param headers.
  const old = dual({ discover: { tools: [] }, legacy: ({ msg }) => (msg.method === "tools/list" ? { tools: TOOLS } : textOf("legacy")) });
  const b2 = memBucket();
  const a2 = await M.addConnector(env, b2, "u1", { name: "Spanner", url: MCP_URL, fetchFn: old.fetchFn });
  assert.deepEqual(a2.connector.tools.map((t) => t.name), ["sql", "bad"]);
  await M.callTool(env, b2, "u1", a2.connector.id, "sql", { region: "eu" }, { fetchFn: old.fetchFn });
  assert.equal(old.seen.find((x) => x.msg.method === "tools/call").headers["Mcp-Param-Region"], undefined);
});

test("EL26 (round 6) a display name on the cards, as Claude Code sends its cloud page one: a connector tool's permission card carries Claude Code's display_name for it (the tool's own name, its \"_\" as spaces, each word capital) and a question's card its permissionDisplay displayName; the page shows each as a small label at the heading's end", async () => {
  assert.deepEqual([E.toolDisplayName("Linear", "create_issue"), E.toolDisplayName("x", "getUser"), E.toolDisplayName("Notion", "search.pages"), E.toolDisplayName("a", "b__c_d")], ["Create Issue", "GetUser", "Search Pages", "C D"]);
  // The Worker gives the machine each tool's own name; the machine keeps it; its card carries the display name.
  const { tools } = M.toolsFor([{ id: "c1", name: "Linear", status: "ok", tools: [{ name: "create_issue", inputSchema: { type: "object" } }] }]);
  assert.equal(tools[0].tool, "create_issue");
  const kept = A.connectorTools(tools);
  assert.equal(kept[0].tool, "create_issue");
  const events = [];
  let n = 0;
  const steps = [say("", [tcall("mcp__linear__create_issue", {}, "k1")]), say("Done.")];
  await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), ask: async () => ({ choice: "yes" }), mcp: async () => ({ text: "ok", isError: false }), toolSearch: "false", chatId: "shop-el26", root: "/work/shop", here: () => "/work/shop" },
    { text: "make an issue", connectors: kept.map((t) => ({ ...t, perm: "ask" })), mode: "acceptEdits" });
  const card = events.find((e) => e.type === "permission");
  assert.deepEqual([card.tool, card.what, card.displayName], ["connector", "Use Linear: create_issue", "Create Issue"]);
  // The page: the label on both cards (escaped); none without one.
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const grab = (name) => { const i = ui.indexOf("  function " + name + "("); const j = ui.indexOf("\n  }\n", i); return ui.slice(i, j + 4); };
  const S = { running: true, events: [], permSent: {}, project: null };
  const { permHTML } = new Function("S", "esc", "prose", "ICON", "PERM_TITLE", "blockLeft", "ruleShown", "const GLOOPY = true; /* the full card; Coder's approval line: askcard.test.mjs */" + grab("permOptions") + grab("permDone") + grab("permHTML") + "return { permHTML };")(S, esc, (x) => x, { plan: "P", term: "T" }, { connector: "Connector" }, () => "", (r) => r);
  const pc = { type: "permission", pid: "p1", tool: "connector", what: "Use Linear: create_issue", displayName: "Create <Issue>" };
  assert.match(permHTML(pc), /<b>Connector<\/b><span class="cd-perm-dn" title="Create &lt;Issue&gt;">Create &lt;Issue&gt;<\/span><\/div>/);
  assert.doesNotMatch(permHTML({ ...pc, displayName: undefined }), /cd-perm-dn/);
  assert.doesNotMatch(permHTML({ ...pc, tool: "plan", plan: "x", displayName: "X" }), /cd-perm-dn/);
  const from = ui.indexOf("  const EL_FORMATS = "), to = ui.indexOf("  async function answerPerm(pid, choice) {");
  const { elicitHTML } = new Function("S", "esc", "ICON", "CSS", ui.slice(from, to) + "\nreturn { elicitHTML };")({ running: true, events: [] }, esc, { globe: '<svg width="26" height="26"></svg>', term: "<svg></svg>" }, { escape: (v) => v });
  const ev = { type: "elicit", pid: "p2", connector: "Linear", tool: "Linear: make_issue", mode: "form", message: "Which?", requestedSchema: FORM.requestedSchema, title: "Which project?", displayName: "Linear issue", description: "Pick one." };
  assert.match(elicitHTML(ev, 0), /<b>Which project\?<\/b><span class="cd-perm-dn" title="Linear issue">Linear issue<\/span><\/div><p class="cd-el-sub">Pick one\.<\/p>/);
  assert.doesNotMatch(elicitHTML({ ...ev, displayName: "  " }, 0), /cd-perm-dn/);
  assert.match(readFileSync(new URL("../public/coder.css", import.meta.url), "utf8"), /\.cd-perm-dn \{[^}]*margin-left: auto;/);
});

// ── ONE PROBE A CONNECTION (round 6 follow-up: the coordinator, for the owner's "do what claude code does") ─────────────

/**
 * A STAND-IN SERVER WHOSE PROTOCOL CAN CHANGE (`state.mode`: "modern" speaks only 2026-07-28, "legacy" only 2025-11-25):
 * `seen` the methods POSTed, `take()` them and start again; `state.paged` gives tools/list a second page, `state.caps` the
 * capabilities, `state.auth` the only token it takes (else 401), `state.hook({ msg, modern })` answers first when it gives a
 * Response. Its sign-in server's token endpoint gives the token "fresh".
 */
function switchable(state) {
  const seen = [];
  const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...h } });
  const fetchFn = async (url, init = {}) => {
    if (String(url).startsWith("https://auth.example.com/token")) return json({ access_token: "fresh", refresh_token: "r2", expires_in: 3600 });
    if ((init.method || "GET") === "GET") return new Response(null, { status: 405 });
    const msg = JSON.parse(init.body), h = init.headers || {};
    seen.push(msg.method);
    if (state.auth && h.authorization !== "Bearer " + state.auth) return new Response("no", { status: 401, headers: { "www-authenticate": "Bearer" } });
    const modern = !!(msg.params && msg.params._meta && msg.params._meta["io.modelcontextprotocol/protocolVersion"]);
    if (state.hook) { const r = await state.hook({ msg, modern }); if (r) return r; }
    if (msg.method === "server/discover") return state.mode === "legacy" ? new Response("Bad Request: Server not initialized", { status: 400 }) : json({ jsonrpc: "2.0", id: msg.id, result: { supportedVersions: ["2026-07-28"], capabilities: state.caps || { tools: {} } } });
    if (!("id" in msg)) return new Response(null, { status: 202 });
    if (msg.method === "initialize") return state.mode === "modern" ? json({ jsonrpc: "2.0", id: msg.id, error: { code: -32022, message: "Unsupported protocol version", data: { supported: ["2026-07-28"] } } }, 400) : json({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-11-25", capabilities: state.caps || { tools: {} } } }, 200, { "mcp-session-id": "s1" });
    if (state.mode === "modern" && !modern) return new Response("Bad Request", { status: 400 });
    if (state.mode === "legacy" && modern) return new Response("Bad Request: Server not initialized", { status: 400 });
    const R = (result) => json({ jsonrpc: "2.0", id: msg.id, result });
    if (msg.method === "tools/list") { const two = msg.params && msg.params.cursor === "p2"; return R({ tools: [{ name: two ? "t2" : "t", inputSchema: { type: "object" } }], ...(state.paged && !two ? { nextCursor: "p2" } : {}) }); }
    if (msg.method === "prompts/list") return R({ prompts: [{ name: "triage", arguments: [] }] });
    if (msg.method === "resources/list") return R({ resources: [] });
    if (msg.method === "prompts/get") return R({ messages: [{ role: "user", content: { type: "text", text: "triage now" } }] });
    return R({ content: [{ type: "text", text: "ok " + state.mode }] });
  };
  return { fetchFn, seen, take: () => seen.splice(0) };
}
const verdict = async (b) => (await M.readConnectors(b, "u1"))[0].era;

test("EL27 (round 6 follow-up) one probe a connection, as Claude Code probes when it connects and keeps what it found for that connection: Coder's connect is the reading of a connector's tools (a new connector, a sign-in, the hourly re-read): its first page probes, and its verdict (2026-07-28, the earlier revisions, or the older SSE transport) is kept with the connector; its other pages, the prompts' and resources' lists, and each later call (a tool call, an mcp_tool hook's, a prompt, a resource) use it with no probe; a re-read probes again; a connector read before this probes at its first call and keeps what it found", async () => {
  // 2026-07-28: probed once, at the read; its calls go straight to the server.
  const st = { mode: "modern", paged: true, caps: { tools: {}, prompts: {}, resources: {} } }, s = switchable(st), b = memBucket();
  const a = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: s.fetchFn });
  assert.deepEqual(s.take(), ["server/discover", "tools/list", "tools/list", "prompts/list", "resources/list"], "one probe: the other page and the lists on what it found");
  assert.deepEqual([a.connector.era, await verdict(b), a.connector.tools.map((t) => t.name)], ["modern", "modern", ["t", "t2"]]);
  assert.equal(M.connectorOut((await M.readConnectors(b, "u1"))[0]).era, undefined, "not shown on the page");
  for (let k = 0; k < 2; k++) assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "ok modern", isError: false });
  assert.deepEqual(s.take(), ["tools/call", "tools/call"], "no probe");
  // A prompt and an mcp_tool hook's call: on the same connection.
  assert.match((await M.expandConnectorRefs(env, b, "u1", "/linear:triage", { fetchFn: s.fetchFn })).text, /triage now$/);
  const { map } = M.toolsFor(await M.readConnectors(b, "u1"));
  await M.keepJobTools(b, "u1", "chat-27", 3, map);
  assert.deepEqual(await M.hookCall(env, b, "u1", "chat-27", 3, { turn: 3 }, { server: "Linear", tool: "t", args: {}, timeoutMs: 5000 }, { fetchFn: s.fetchFn }), { ok: true, body: "ok modern" });
  assert.deepEqual(s.take(), ["prompts/get", "tools/call"]);
  // The hourly re-read (here forced) is a new connection: probed again, its verdict kept.
  assert.equal(await M.refreshTools(env, b, "u1", { fetchFn: s.fetchFn, force: true }), true);
  assert.deepEqual(s.take()[0], "server/discover");
  // The earlier revisions: probed once at the read; each call has its handshake (the Worker's connection is per call) and no probe.
  const ol = switchable({ mode: "legacy" }), b2 = memBucket();
  const a2 = await M.addConnector(env, b2, "u1", { name: "Linear", url: MCP_URL, fetchFn: ol.fetchFn });
  assert.deepEqual([ol.take(), a2.connector.era], [["server/discover", "initialize", "notifications/initialized", "tools/list"], "legacy"]);
  await M.callTool(env, b2, "u1", a2.connector.id, "t", {}, { fetchFn: ol.fetchFn });
  await M.callTool(env, b2, "u1", a2.connector.id, "t", {}, { fetchFn: ol.fetchFn });
  assert.deepEqual(ol.take(), ["initialize", "notifications/initialized", "tools/call", "initialize", "notifications/initialized", "tools/call"]);
  // A connector read before this keeps no verdict: its first call probes and keeps what it found; the next doesn't.
  const list = await M.readConnectors(b, "u1");
  delete list[0].era;
  await M.writeConnectors(b, "u1", list);
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  assert.deepEqual([s.take(), await verdict(b)], [["server/discover", "tools/call", "tools/call"], "modern"]);
  // The older SSE transport, found at the read (a server that refuses Streamable HTTP with 405): its calls go over it at once.
  const posted = [];
  let sseUp = true;
  const sseServer = async (url, init = {}) => {
    const u = String(url);
    if ((init.method || "GET") === "GET") { if (!sseUp) return new Response("down", { status: 503 }); const body = new ReadableStream({ start(c) { c.enqueue(enc.encode("event: endpoint\ndata: /messages?sid=1\n\n")); sseServer.c = c; } }); return new Response(body, { headers: { "content-type": "text/event-stream" } }); }
    const msg = JSON.parse(init.body);
    posted.push((u.includes("/messages") ? "sse " : "") + msg.method);
    if (!u.includes("/messages")) return new Response(null, { status: 405 });
    if ("id" in msg && "method" in msg) setTimeout(() => sseServer.c.enqueue(enc.encode("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: msg.method === "initialize" ? { protocolVersion: "2025-11-25", capabilities: { tools: {} } } : msg.method === "tools/list" ? { tools: [{ name: "t", inputSchema: { type: "object" } }] } : textOf("over sse") }) + "\n\n")), 5);
    return new Response(null, { status: 202 });
  };
  const b3 = memBucket();
  const a3 = await M.addConnector(env, b3, "u1", { name: "Old", url: MCP_URL, fetchFn: sseServer });
  assert.equal(a3.connector.era, "sse");
  posted.length = 0;
  assert.deepEqual(await M.callTool(env, b3, "u1", a3.connector.id, "t", {}, { fetchFn: sseServer }), { text: "over sse", isError: false });
  assert.deepEqual(posted, ["sse initialize", "sse notifications/initialized", "sse tools/call"], "no probe, no Streamable HTTP first");
  // Its connection failing: dropped, so the next call connects again from the start.
  sseUp = false;
  assert.equal((await M.callTool(env, b3, "u1", a3.connector.id, "t", {}, { fetchFn: sseServer })).isError, true);
  assert.equal(await verdict(b3), undefined);
});

test("EL29 (round 6 follow-up) the hourly re-read keeps the protocol only of the connectors it read again: another's, changed by a call meanwhile (here dropped), is not put back from the list it started with", async () => {
  const A = "https://a.example.com/mcp", B = "https://b.example.com/mcp", b = memBucket();
  const sa = { mode: "modern" }, sb = { mode: "modern" }, ka = switchable(sa), kb = switchable(sb);
  const fetchFn = (url, init) => (String(url).startsWith(A) ? ka.fetchFn : kb.fetchFn)(url, init);
  const a = await M.addConnector(env, b, "u1", { name: "Alpha", url: A, fetchFn });
  const c2 = await M.addConnector(env, b, "u1", { name: "Beta", url: B, fetchFn });
  const era = async (id) => (await M.readConnectors(b, "u1")).find((x) => x.id === id).era;
  assert.deepEqual([await era(a.connector.id), await era(c2.connector.id)], ["modern", "modern"]);
  // Alpha's list is over an hour old; while it is read again, a call on Beta drops Beta's verdict.
  const list = await M.readConnectors(b, "u1");
  list.find((x) => x.id === a.connector.id).toolsAt = 0;
  await M.writeConnectors(b, "u1", list);
  sa.hook = async ({ msg }) => {
    if (msg.method !== "server/discover") return null;
    const now = await M.readConnectors(b, "u1");
    delete now.find((x) => x.id === c2.connector.id).era;
    await M.writeConnectors(b, "u1", now);
    return null;
  };
  ka.take(); kb.take();
  assert.equal(await M.refreshTools(env, b, "u1", { fetchFn }), true);
  assert.deepEqual([ka.take()[0], kb.take()], ["server/discover", []], "only Alpha read again");
  assert.deepEqual([await era(a.connector.id), await era(c2.connector.id)], ["modern", undefined]);
});

test("EL28 (round 6 follow-up) when the kept verdict goes, as Claude Code drops a verdict it holds or connects again (its era classes: -32022 or -32021; -32600, or -32601 to initialize or tools/list; HTTP 400, or 404 or 405 to initialize or tools/list): an earlier-revision dial whose handshake fails is made again at once with the probe (its verdict replaced, or kept when the failure isn't one of those); on a 2026-07-28 verdict a call answered with one of them fails and the next call probes, an ordinary error keeps it; on an earlier one -32022 or -32021 drops it; a session that expired, an answer it can't read, or a sign-in refreshed (a new connection) probe again", async () => {
  // An earlier-revision verdict, the server now only 2026-07-28 (initialize refused with -32022): the same call probes at once and goes on.
  const st = { mode: "legacy" }, s = switchable(st), b = memBucket();
  const a = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: s.fetchFn });
  s.take();
  st.mode = "modern";
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "ok modern", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["initialize", "server/discover", "tools/call"], "modern"]);
  // A 2026-07-28 verdict, the server now only the earlier revisions (a call answered with a plain 400): the call fails; the next probes.
  // (One whose 400 says "Server not initialized" is a session that expired, sent again at once: EL30.)
  st.mode = "legacy";
  st.hook = ({ msg, modern }) => (modern && msg.method === "tools/call" ? new Response("Bad Request", { status: 400 }) : null);
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "error: the MCP server answered 400", isError: true });
  assert.equal(await verdict(b), undefined, "dropped");
  st.hook = null;
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "ok legacy", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["tools/call", "server/discover", "initialize", "notifications/initialized", "tools/call"], "legacy"]);
  // A handshake that fails otherwise (an initialize result it can't take): made again with the probe, the verdict kept.
  let bad = 1;
  st.hook = ({ msg }) => (msg.method === "initialize" && bad-- > 0 ? new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "1999-01-01", capabilities: {} } }), { headers: { "content-type": "application/json" } }) : null);
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "ok legacy", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["initialize", "server/discover", "initialize", "notifications/initialized", "tools/call"], "legacy"]);
  // On an earlier-revision verdict: -32022 to a call drops it; a session that expired (404 with it) too; an ordinary error doesn't.
  const answer = (code, status = 200) => ({ msg }) => (msg.method === "tools/call" ? new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code, message: "said " + code } }), { status, headers: { "content-type": "application/json" } }) : null);
  st.hook = answer(-32602);
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  assert.equal(await verdict(b), "legacy", "an ordinary error keeps it");
  st.hook = answer(-32022);
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "error: the MCP server said: said -32022", isError: true });
  assert.equal(await verdict(b), undefined);
  st.hook = null;
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  st.hook = ({ msg }) => (msg.method === "tools/call" ? new Response("Session not found", { status: 404 }) : null);
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  assert.equal(await verdict(b), undefined, "a session that expired");
  // On a 2026-07-28 verdict: -32600 or -32021 drops it, -32602 doesn't; an answer it can't read drops it.
  st.mode = "modern"; st.hook = null;
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  for (const [hook, kept] of [[answer(-32602), "modern"], [answer(-32600), undefined], [answer(-32021, 400), undefined], [({ msg }) => (msg.method === "tools/call" ? new Response("{oops", { headers: { "content-type": "application/json" } }) : null), undefined]]) {
    st.hook = null;
    await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
    assert.equal(await verdict(b), "modern");
    st.hook = hook;
    await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
    assert.equal(await verdict(b), kept);
  }
  // A sign-in refreshed after a 401 is a new connection: the call made again probes, as Claude Code's reconnect.
  st.hook = null;
  await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  const list = await M.readConnectors(b, "u1");
  list[0].auth = "oauth";
  list[0].box = await seal(env, { oauth: { access: "old", refresh: "r1", expires: Date.now() + 3_600_000, client: { id: "c1", secret: "" }, endpoint: "https://auth.example.com/token", resource: MCP_URL } });
  await M.writeConnectors(b, "u1", list);
  st.auth = "fresh";
  s.take();
  assert.deepEqual(await M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn }), { text: "ok modern", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["tools/call", "server/discover", "tools/call"], "modern"]);
  // The words that say when: Claude Code's classes.
  assert.deepEqual([ERA.eraClass({ rpcCode: -32022 }), ERA.eraClass({ rpcCode: -32021 }), ERA.eraClass({ rpcCode: -32600 }), ERA.eraClass({ rpcCode: -32601 }, "tools/call"), ERA.eraClass({ rpcCode: -32601 }, "tools/list"), ERA.eraClass({ status: 400 }), ERA.eraClass({ status: 404 }, "tools/call"), ERA.eraClass({ status: 405 }, "initialize"), ERA.eraClass({ rpcCode: -32602 })], ["rpc_era", "rpc_era", "rpc_session", "", "rpc_session", "http_4xx", "", "http_4xx", ""]);
});

test("EL30 (round 6, follow-up 2) a session the server no longer knows, as Claude Code's tool call reads it (a 404 to a request with its session; a 400 saying \"Server not initialized\", \"No valid session ID\" or \"Mcp-Session-Id header is required\"): the call did not run, so it is sent once more at once on a new connection (probed, its handshake made), once; refused so again, Claude Code's words; a 404 with no session or an error the server answered is not that; an mcp_tool hook's call is not sent again, as Claude Code's is not, and its next call connects anew", async () => {
  const st = { mode: "legacy" }, s = switchable(st), b = memBucket();
  const a = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn: s.fetchFn });
  const call = () => M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn: s.fetchFn });
  s.take();
  // Once forgotten (a 404 to the call with its session): sent again on a new connection, and answered.
  let left = 1;
  st.hook = ({ msg }) => (msg.method === "tools/call" && left-- > 0 ? new Response("Session not found", { status: 404 }) : null);
  assert.deepEqual(await call(), { text: "ok legacy", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["initialize", "notifications/initialized", "tools/call", "server/discover", "initialize", "notifications/initialized", "tools/call"], "legacy"]);
  // A 400 in the TypeScript SDK's words for it: the same.
  left = 1;
  st.hook = ({ msg }) => (msg.method === "tools/call" && left-- > 0 ? new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: No valid session ID provided" }, id: null }), { status: 400, headers: { "content-type": "application/json" } }) : null);
  assert.deepEqual(await call(), { text: "ok legacy", isError: false });
  assert.equal(s.take().filter((m) => m === "tools/call").length, 2);
  // Refused again: once more only, then Claude Code's words; the verdict goes with the connection.
  st.hook = ({ msg }) => (msg.method === "tools/call" ? new Response("Session not found", { status: 404 }) : null);
  assert.deepEqual(await call(), { text: "error: MCP server \"Linear\" session expired", isError: true });
  assert.deepEqual([s.take().filter((m) => m === "tools/call").length, await verdict(b)], [2, undefined]);
  // An error the server answered, even in those words, is not one: not sent again.
  st.hook = ({ msg }) => (msg.method === "tools/call" ? new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32001, message: "No valid session ID" } }), { headers: { "content-type": "application/json" } }) : null);
  assert.deepEqual(await call(), { text: "error: the MCP server said: No valid session ID", isError: true });
  assert.equal(s.take().filter((m) => m === "tools/call").length, 1);
  // A 2026-07-28 verdict, the server now only the earlier revisions ("Server not initialized" to the call): sent again on a
  // new connection, which probes and finds them.
  st.hook = null; st.mode = "modern";
  await M.refreshTools(env, b, "u1", { fetchFn: s.fetchFn, force: true });
  assert.equal(await verdict(b), "modern");
  st.mode = "legacy";
  s.take();
  assert.deepEqual(await call(), { text: "ok legacy", isError: false });
  assert.deepEqual([s.take(), await verdict(b)], [["tools/call", "server/discover", "initialize", "notifications/initialized", "tools/call"], "legacy"]);
  // With no session (2026-07-28), a 404 is not one: not sent again, the verdict kept.
  st.mode = "modern";
  await M.refreshTools(env, b, "u1", { fetchFn: s.fetchFn, force: true });
  st.hook = ({ msg }) => (msg.method === "tools/call" ? new Response("Not Found", { status: 404 }) : null);
  s.take();
  assert.deepEqual(await call(), { text: "error: the MCP server answered 404", isError: true });
  assert.deepEqual([s.take(), await verdict(b)], [["tools/call"], "modern"]);
  // An mcp_tool hook's call: not sent again; its next call connects anew (probed).
  st.mode = "legacy"; st.hook = null;
  await M.refreshTools(env, b, "u1", { fetchFn: s.fetchFn, force: true });
  const { map } = M.toolsFor(await M.readConnectors(b, "u1"));
  await M.keepJobTools(b, "u1", "chat-30", 3, map);
  const hook = () => M.hookCall(env, b, "u1", "chat-30", 3, { turn: 3 }, { server: "Linear", tool: "t", args: {}, timeoutMs: 5000 }, { fetchFn: s.fetchFn });
  left = 1;
  st.hook = ({ msg }) => (msg.method === "tools/call" && left-- > 0 ? new Response("Session not found", { status: 404 }) : null);
  s.take();
  assert.deepEqual(await hook(), { ok: false, body: "", error: "the MCP server answered 404" });
  assert.deepEqual([s.take(), await verdict(b)], [["initialize", "notifications/initialized", "tools/call"], undefined]);
  assert.deepEqual(await hook(), { ok: true, body: "ok legacy" });
  assert.deepEqual(s.take()[0], "server/discover");
  // The rule itself.
  assert.deepEqual([ERA.sessionExpired({ status: 404 }, { session: true }), ERA.sessionExpired({ status: 404 }), ERA.sessionExpired({ status: 400, body: "Mcp-Session-Id header is required" }), ERA.sessionExpired({ status: 400, body: "Bad Request" }), ERA.sessionExpired({ rpcCode: -32001, status: 400, body: "No valid session ID" })], [true, false, true, false, false]);
});

test("EL31 (round 6, follow-up 2) network errors in a row, as Claude Code counts them on a connection and closes it at three (\"max consecutive terminal errors\"): kept with the connector, one on a request of its connection adds one (refused, reset, timed out on the network, a stream cut, the Worker's \"Network connection lost\"); whatever the server answers starts again, Coder's own time limit leaves it; at three the verdict goes and the next call probes; a re-read of the tools starts again; not on the page", async () => {
  const st = { mode: "modern" }, s = switchable(st), b = memBucket();
  let slow = false;
  // (A server that never answers, for Coder's own time limit: its fetch ends only when Coder gives up.)
  const fetchFn = (url, init = {}) => (slow && init.body && JSON.parse(init.body).method === "tools/call" ? new Promise((_, no) => init.signal.addEventListener("abort", () => no(new DOMException("The operation was aborted.", "AbortError")), { once: true })) : s.fetchFn(url, init));
  const a = await M.addConnector(env, b, "u1", { name: "Linear", url: MCP_URL, fetchFn });
  const call = () => M.callTool(env, b, "u1", a.connector.id, "t", {}, { fetchFn });
  const count = async () => (await M.readConnectors(b, "u1"))[0].netErrors;
  const refused = () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:443"), { code: "ECONNREFUSED" }) }); };
  const onCall = (f) => ({ msg }) => (msg.method === "tools/call" ? f() : null);
  s.take();
  st.hook = onCall(refused);
  assert.deepEqual(await call(), { text: "error: the MCP server could not be reached", isError: true });
  assert.deepEqual([await count(), await verdict(b)], [1, "modern"]);
  await call();
  assert.equal(await count(), 2);
  // Answered: from nothing.
  st.hook = null;
  assert.deepEqual(await call(), { text: "ok modern", isError: false });
  assert.equal(await count(), undefined);
  // Three in a row (refused, a stream cut, the Worker's words): the verdict goes; the next call probes.
  st.hook = onCall(refused);
  await call();
  st.hook = onCall(() => new Response(new ReadableStream({ start(c) { c.error(new TypeError("terminated")); } }), { headers: { "content-type": "text/event-stream" } }));
  await call();
  assert.deepEqual([await count(), await verdict(b)], [2, "modern"]);
  st.hook = onCall(() => { throw new TypeError("Network connection lost."); });
  await call();
  assert.deepEqual([await count(), await verdict(b)], [undefined, undefined]);
  st.hook = null;
  s.take();
  assert.deepEqual(await call(), { text: "ok modern", isError: false });
  assert.deepEqual([s.take(), await verdict(b), await count()], [["server/discover", "tools/call"], "modern", undefined]);
  // An HTTP status is the server answering, and so is a failure that is not a network error (a name not found): from nothing.
  for (const answered of [() => new Response("busy", { status: 503 }), () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) }); }]) {
    st.hook = onCall(refused);
    await call();
    assert.equal(await count(), 1);
    st.hook = onCall(answered);
    assert.equal((await call()).isError, true);
    assert.equal(await count(), undefined);
  }
  // Coder's own time limit leaves it as it is (an mcp_tool hook's call, its time one second); a hook's network error counts.
  st.hook = onCall(refused);
  await call();
  const { map } = M.toolsFor(await M.readConnectors(b, "u1"));
  await M.keepJobTools(b, "u1", "chat-31", 3, map);
  st.hook = null; slow = true;
  assert.deepEqual(await M.hookCall(env, b, "u1", "chat-31", 3, { turn: 3 }, { server: "Linear", tool: "t", args: {}, timeoutMs: 1000 }, { fetchFn }), { ok: false, body: "", aborted: true });
  assert.equal(await count(), 1);
  slow = false; st.hook = onCall(refused);
  assert.equal((await M.hookCall(env, b, "u1", "chat-31", 3, { turn: 3 }, { server: "Linear", tool: "t", args: {}, timeoutMs: 5000 }, { fetchFn })).ok, false);
  assert.equal(await count(), 2);
  // A re-read of the tools is a new connection: from nothing. Not shown on the page.
  st.hook = null;
  await M.refreshTools(env, b, "u1", { fetchFn, force: true });
  assert.equal(await count(), undefined);
  st.hook = onCall(refused);
  await call();
  assert.equal(M.connectorOut((await M.readConnectors(b, "u1"))[0]).netErrors, undefined);
  // On an earlier-revision verdict, one on the call after its handshake counts too.
  const ol = { mode: "legacy" }, s2 = switchable(ol), b2 = memBucket();
  const a2 = await M.addConnector(env, b2, "u1", { name: "Linear", url: MCP_URL, fetchFn: s2.fetchFn });
  ol.hook = onCall(refused);
  await M.callTool(env, b2, "u1", a2.connector.id, "t", {}, { fetchFn: s2.fetchFn });
  assert.deepEqual([(await M.readConnectors(b2, "u1"))[0].netErrors, (await M.readConnectors(b2, "u1"))[0].era], [1, "legacy"]);
  // The rule itself.
  assert.deepEqual([ERA.netError(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })), ERA.netError(Object.assign(new Error("x"), { code: "ConnectionRefused" })), ERA.netError(new Error("Body Timeout Error")), ERA.netError(new Error("SSE stream disconnected")), ERA.netError(Object.assign(new Error("ECONNRESET"), { status: 502 })), ERA.netError(new Error("Error POSTing to endpoint (HTTP 500): ECONNRESET")), ERA.netError(new Error("the MCP server said: no"))], [true, true, true, true, false, false, false]);
});
