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

test("EL1 the client capabilities: elicitation form and url on both of Coder's kinds of connection (Streamable HTTP and the older SSE), as Claude Code declares to a configured http or sse server", async () => {
  assert.deepEqual(E.CLIENT_CAPS, { elicitation: { form: {}, url: {} } });
  const s = asker(async () => textOf("ok"));
  await M.mcpSession("https://mcp.example.com/mcp", "", [["tools/list", {}]], { fetchFn: s.fetchFn });
  assert.deepEqual(s.seen.find((x) => x.msg.method === "initialize").msg.params.capabilities, { elicitation: { form: {}, url: {} } });
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
  assert.deepEqual(posted.find((x) => x.method === "initialize").params.capabilities, { elicitation: { form: {}, url: {} } });
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
  assert.deepEqual(await plain.json(), { text: 'got {"action":"cancel"}', isError: false });
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
  assert.equal(s.r.messages.find((m) => m.role === "tool").content, "stopped by the owner");
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
  assert.match(routes, /\.\.\.\(body\.content && typeof body\.content === "object" && !Array\.isArray\(body\.content\) \? \{ content: body\.content \} : \{\}\), \.\.\.\(typeof body\.plan === "string" \? \{ plan: body\.plan\.slice\(0, 200_000\) \} : \{\}\) \}\)\.then\(\(r\) => r\.json\(\)\)/);
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
