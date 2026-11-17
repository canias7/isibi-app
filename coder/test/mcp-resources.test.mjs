// CLAUDE CODE'S MCP RESOURCE TOOLS AS CODER'S list_mcp_resources AND read_mcp_resource (the owner, 2026-11-17: "yes build it
// like claude code"; Claude Code 2.1.326's ListMcpResourcesTool and ReadMcpResourceTool, read in its program and tried in a
// Claude Code cloud session the same day): their words, inputs and answers (coder-mcpres.mjs); the Worker's calls through
// the chat's connectors (src/coder-mcp.mjs resourceCall, behind the job's pass); the machine's caller; Coder's loop (offered
// only when a connector declares resources, held back for tool_search, the steps, the saved binary content, the hooks'
// result objects, a deny rule); and the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = await import("../container/coder-mcpres.mjs");
const M = await import("../src/coder-mcp.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const { modelPass } = await import("../src/coder-model-gate.mjs");
const { ccSize } = await import("../container/coder-tools.mjs");
const { CONNECTOR_DATA } = A;
const HERE = (p) => new URL("../" + p, import.meta.url);

const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder2.gofarther.dev" };
function memBucket() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); }, delete: async (k) => { m.delete(k); } };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const PAGE1 = [{ uri: "file:///docs/a.txt", name: "a.txt", mimeType: "text/plain", description: "The first", size: 5 }, { uri: "ui://widget/card", name: "card", mimeType: "text/html" }];
const PAGE2 = [{ uri: "file:///docs/logo.png", name: "logo", mimeType: "image/png" }, { uri: "https://x.example/app", name: "app", mimeType: 'text/html; profile="mcp-app"' }];
/** A fake MCP server at https://<host>/mcp (needs `Bearer good`) that declares resources (unless `resources: false`): two pages of them, reads by URI. */
function fakeServer({ host = "docs.example.com", resources = true, reads = true } = {}) {
  const seen = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url), h = init.headers || {};
    const j = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "mcp-session-id": "s1" } });
    if (u !== "https://" + host + "/mcp") return new Response("not found", { status: 404 });
    if (h.authorization !== "Bearer good") return new Response("no", { status: 401 });
    const msg = JSON.parse(init.body);
    seen.push(msg);
    if (!("id" in msg)) return new Response(null, { status: 202 });
    const ok = (result) => j({ jsonrpc: "2.0", id: msg.id, result });
    const no = (code, message) => j({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
    if (msg.method === "initialize") return ok({ protocolVersion: "2025-06-18", capabilities: { tools: {}, ...(resources ? { resources: {} } : {}) }, serverInfo: { name: "fake", version: "1" } });
    if (msg.method === "tools/list") return ok({ tools: [{ name: "search", description: "Search", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }] });
    if (msg.method === "resources/list") return ok(msg.params && msg.params.cursor === "p2" ? { resources: PAGE2 } : { resources: PAGE1, nextCursor: "p2" });
    if (msg.method === "resources/read") {
      if (!reads) return no(-32601, "Method not found");
      const uri = msg.params.uri;
      if (uri === "file:///docs/a.txt") return ok({ contents: [{ uri, mimeType: "text/plain", text: "hello" }] });
      if (uri === "file:///docs/logo.png") return ok({ contents: [{ uri, mimeType: "image/png", blob: PNG.toString("base64") }] });
      if (uri === "ui://widget/card") return ok({ contents: [{ uri, mimeType: "text/html", text: "<p>card</p>" }] });
      if (uri === "bad://boom") return no(-32603, "boom");
      if (uri === "bad://params") return no(-32602, "Invalid params");
      return no(-32002, "Resource not found");
    }
    return no(-32601, "Method not found");
  };
  return { fetchFn, seen };
}
const anyServer = (...servers) => async (u, i) => { for (const s of servers) { const r = await s.fetchFn(u, i); if (r.status !== 404) return r; } return new Response("not found", { status: 404 }); };

test("MR1 (2026-11-17) Claude Code 2.1.326's words: the tools' descriptions, inputs and hints, word for word; its refusals of an input; its answers and errors", () => {
  assert.equal(R.LIST_TOOL, "list_mcp_resources");
  assert.equal(R.READ_TOOL, "read_mcp_resource");
  assert.equal(R.LIST_DESCRIPTION, "\nList available resources from configured MCP servers.\nEach returned resource will include all standard MCP resource fields plus a 'server' field \nindicating which server the resource belongs to.\n\nParameters:\n- server (optional): The name of a specific MCP server to get resources from. If not provided,\n  resources from all servers will be returned.\n");
  assert.equal(R.READ_DESCRIPTION, "\nReads a specific resource from an MCP server, identified by server name and resource URI.\n\nParameters:\n- server (required): The name of the MCP server from which to read the resource\n- uri (required): The URI of the resource to read\n");
  assert.deepEqual(R.LIST_TOOL_DEF.function.parameters, { type: "object", properties: { server: { type: "string", description: "Optional server name to filter resources by" } }, additionalProperties: false });
  assert.deepEqual(R.READ_TOOL_DEF.function.parameters, { type: "object", properties: { server: { type: "string", description: "The MCP server name" }, uri: { type: "string", description: "The resource URI to read" } }, required: ["server", "uri"], additionalProperties: false });
  assert.equal(R.LIST_HINT, "list resources from connected MCP servers");
  assert.equal(R.READ_HINT, "read a specific MCP resource by URI");
  // (Its inputs as its schemas take them: refused before any hook, in Claude Code's words.)
  assert.deepEqual(R.checkListInput({}), { args: {} });
  assert.deepEqual(R.checkListInput({ server: "Docs Hub" }), { args: { server: "Docs Hub" } });
  assert.match(R.checkListInput({ server: 3 }).error, /^error: InputValidationError: list_mcp_resources failed due to the following issue:\nThe parameter `server` type is expected as `string` but provided as `number`$/);
  assert.match(R.checkListInput({ name: "x" }).error, /list_mcp_resources failed[\s\S]*An unexpected parameter `name` was provided/);
  assert.match(R.checkReadInput({ server: "a" }).error, /read_mcp_resource failed[\s\S]*The required parameter `uri` is missing/);
  assert.deepEqual(R.checkReadInput({ server: "a", uri: "b" }), { args: { server: "a", uri: "b" } });
  // (Its answers: none, in its words; a list or a read as JSON; a read's error as its whole answer.)
  assert.equal(R.listText([]), "No resources found. MCP servers may still provide tools even if they have no resources.");
  assert.equal(R.listText([{ uri: "a://b", name: "b", server: "S" }]), '[{"uri":"a://b","name":"b","server":"S"}]');
  assert.equal(R.readText({ contents: [{ uri: "a://b", text: "hi" }] }), '{"contents":[{"uri":"a://b","text":"hi"}]}');
  assert.equal(R.readText({ contents: [], error: "x" }), "x");
  // (Its errors, as tried in a Claude Code session: a server it does not have, and GitHub's reads.)
  assert.equal(R.serverNotFound("nope", ["Docs Hub", "Linear"]), 'Server "nope" not found. Available servers: Docs Hub, Linear');
  assert.equal(R.serverNotConnected("Linear"), 'Server "Linear" is not connected');
  assert.equal(R.serverHasNoResources("Linear"), 'Server "Linear" does not support resources');
  assert.equal(R.readsNotImplemented("github"), 'Server "github" advertises resource support but does not implement resource reads.');
  assert.equal(R.resourceNotFound("file:///x"), "Resource not found: file:///x \u2014 it may have been deleted or the URI is stale. Re-run list_mcp_resources to refresh.");
  assert.equal(R.blobSavedText("Docs Hub", "file:///l.png", "/out/f.png", "image/png", "4 bytes"), "[Resource from Docs Hub at file:///l.png] Binary content (image/png, 4 bytes) saved to /out/f.png");
  assert.equal(R.blobSavedText("S", "u", "/p", undefined, "1KB"), "[Resource from S at u] Binary content (unknown type, 1KB) saved to /p");
  assert.equal(R.blobNotSaved(R.blobTooBig(104857601)), "Binary content could not be saved to disk: content is 104857601 bytes, over the 104857600 byte persist limit");
  assert.deepEqual([R.LIST_PAGES_MAX, R.RESOURCE_INLINE_MAX, R.METHOD_NOT_FOUND, [...R.RESOURCE_NOT_FOUND_CODES]], [20, 100000, -32601, [-32002, -32602]]);
});

test("MR2 (2026-11-17) its server names, its MCP Apps UI resources left out of a list, and the extension a saved file gets, as Claude Code's", () => {
  // (A name is that very name first, then its name as Claude Code writes it: what is not a letter, digit, _ or - made _.)
  const servers = [{ name: "Docs Hub" }, { name: "Docs_Hub" }, { name: "claude.ai Google Drive" }];
  assert.deepEqual(R.serversNamed(servers, "Docs Hub"), [{ name: "Docs Hub" }]);
  assert.deepEqual(R.serversNamed(servers.slice(0, 1), "Docs_Hub"), [{ name: "Docs Hub" }]);
  assert.deepEqual(R.serversNamed(servers, "Docs.Hub"), [{ name: "Docs Hub" }, { name: "Docs_Hub" }]);
  assert.deepEqual(R.serversNamed(servers, "claude_ai_Google_Drive"), [{ name: "claude.ai Google Drive" }]);
  assert.deepEqual(R.serversNamed(servers, "docs hub"), [], "case counts");
  assert.equal(R.serverKey("claude.ai  Google  Drive!"), "claude_ai_Google_Drive");
  // (UI resources: a ui:// address, or text/html with profile=mcp-app, its parameters read as HTTP's.)
  for (const [r, ui] of [
    [{ uri: "ui://x" }, true], [{ uri: "UI://x" }, true], [{ uri: "file:///x", mimeType: "text/html;profile=mcp-app" }, true],
    [{ uri: "x", mimeType: 'Text/HTML ; charset=utf-8; Profile="MCP-App"' }, true], [{ uri: "x", mimeType: 'text/html; profile="mcp\\-app"' }, true],
    [{ uri: "x", mimeType: "text/html" }, false], [{ uri: "x", mimeType: "text/plain;profile=mcp-app" }, false], [{ uri: "x", mimeType: "text/html;profile=other" }, false],
    [{ uri: "x", mimeType: "text/html;profile=mcp-app" + " ".repeat(1024) }, false], [{ uri: "x" }, false],
  ]) assert.equal(R.isUiResource(r), ui, JSON.stringify(r));
  for (const [t, ext] of [["application/pdf", "pdf"], ["image/png", "png"], ["IMAGE/JPEG; q=1", "jpg"], ["image/x-icon", "ico"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"], ["application/manifest+json", "webmanifest"], ["font/woff2", "woff2"], ["application/x-thing", "bin"], [undefined, "bin"], ["", "bin"]]) assert.equal(R.extOf(t), ext, String(t));
});

test("MR3 (2026-11-17) the Worker: a connector that declares resources is marked so; a job's servers are kept with its tools; a list reads every page, leaves out the UI ones and names each one's server; only the chat's job with its pass", async () => {
  const b = memBucket(), docs = fakeServer(), plain = fakeServer({ host: "plain.example.com", resources: false });
  const fetchFn = anyServer(docs, plain);
  const a = await M.addConnector(env, b, "u1", { name: "Docs Hub", url: "https://docs.example.com/mcp", key: "good", fetchFn });
  await M.addConnector(env, b, "u1", { name: "Plain", url: "https://plain.example.com/mcp", key: "good", fetchFn });
  const [c1, c2] = await M.readConnectors(b, "u1");
  assert.deepEqual([c1.resourcesCap, c2.resourcesCap], [true, false]);
  assert.equal(M.declaresResources(c1), true);
  assert.equal(M.declaresResources({ resources: [{ uri: "a://b" }] }), true, "one read before: by its list");
  assert.equal(M.declaresResources({}), false);
  // The job: its tools and the chat's servers, kept for its turn; the names of those that declare resources for the machine.
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 4 }));
  const on = await M.jobConnectors(b, "u1", "chat-1", 4, { turn: 4 }, false);
  assert.deepEqual(on.connectorResources, ["Docs Hub"]);
  assert.deepEqual(JSON.parse(b.m.get(M.jobToolsKey("u1", "chat-1"))).servers, [c1.id, c2.id]);
  assert.deepEqual(await M.jobConnectors(b, "u1", "chat-x", 4, { turn: 4 }, true), {}, "never in a job from GitHub");
  // (A connector switched off in the chat is none of its servers; with none that declares resources, nothing is offered.)
  const off = await M.jobConnectors(b, "u1", "chat-2", 1, { turn: 1, connectorsOff: [c1.id] }, false);
  assert.equal(off.connectorResources, undefined);
  const until = String(Date.now() + 60_000);
  const pass = await modelPass(env, "u1/chat-1", "4", until);
  const e2 = { ...env, CODER_BUCKET: b };
  const ask = async (resources, p = pass) => { const r = await M.handleMcp(new Request("https://coder2.gofarther.dev/api/coder/mcp", { method: "POST", headers: { "x-coder-chat": "u1/chat-1", "x-coder-turn": "4", "x-coder-until": until, "x-coder-model": p }, body: JSON.stringify({ resources }) }), e2, { fetchFn }); return { status: r.status, body: await r.json() }; };
  assert.equal((await ask({ op: "list" }, "x".repeat(43))).status, 403);
  // (Its list read when it was added, for its @ mentions, is not this one's.)
  const before = docs.seen.length;
  const all = await ask({ op: "list" });
  assert.equal(all.status, 200);
  assert.deepEqual(all.body, { resources: [{ ...PAGE1[0], server: "Docs Hub" }, { ...PAGE2[0], server: "Docs Hub" }] });
  const lists = docs.seen.slice(before).filter((m) => m.method === "resources/list");
  assert.deepEqual(lists.map((m) => m.params), [{}, { cursor: "p2" }], "both pages, the second by its cursor");
  // (A server named: that name, or as Claude Code writes it; one with no resources has none; one no server has: its error.)
  assert.equal((await ask({ op: "list", server: "Docs_Hub" })).body.resources.length, 2);
  assert.deepEqual((await ask({ op: "list", server: "Plain" })).body, { resources: [] });
  assert.deepEqual((await ask({ op: "list", server: "nope" })).body, { error: 'Server "nope" not found. Available servers: Docs Hub, Plain' });
  assert.equal((await ask({ op: "list", server: "" })).body.resources.length, 2, "an empty name: every server");
  // A job given no servers (none of its chat's declares resources) is refused, as a tool it was not given.
  await M.keepJobTools(b, "u1", "chat-1", 4, {});
  assert.equal((await ask({ op: "list" })).status, 403);
  assert.ok(a.connector.id);
});

test("MR4 (2026-11-17) the Worker's reads: text and binary content as the server gave them; Claude Code's answers for 'method not found' and 'resource not found'; its errors for a server it does not have, one not connected, one with no resources; the server's own error", async () => {
  const b = memBucket(), docs = fakeServer(), plain = fakeServer({ host: "plain.example.com", resources: false }), gh = fakeServer({ host: "gh.example.com", reads: false });
  const fetchFn = anyServer(docs, plain, gh);
  for (const [name, host] of [["Docs Hub", "docs"], ["Plain", "plain"], ["github", "gh"]]) await M.addConnector(env, b, "u1", { name, url: "https://" + host + ".example.com/mcp", key: "good", fetchFn });
  // (One waiting for its sign-in: one of the chat's servers, not connected.)
  const list = await M.readConnectors(b, "u1");
  list.push({ id: "cwait", name: "Waiting", url: "https://wait.example.com/mcp", status: "auth", resourcesCap: true, tools: [] });
  await M.writeConnectors(b, "u1", list);
  await M.keepJobTools(b, "u1", "chat-1", 4, {}, { servers: list.map((c) => c.id) });
  const read = (server, uri) => M.resourceCall(env, b, "u1", "chat-1", 4, { op: "read", server, uri }, { fetchFn });
  assert.deepEqual(await read("Docs Hub", "file:///docs/a.txt"), { contents: [{ uri: "file:///docs/a.txt", mimeType: "text/plain", text: "hello" }], server: "Docs Hub" });
  assert.deepEqual(await read("Docs_Hub", "file:///docs/logo.png"), { contents: [{ uri: "file:///docs/logo.png", mimeType: "image/png", blob: PNG.toString("base64") }], server: "Docs Hub" });
  assert.deepEqual(await read("Docs Hub", "ui://widget/card"), { contents: [{ uri: "ui://widget/card", mimeType: "text/html", text: "<p>card</p>" }], server: "Docs Hub" }, "a UI resource is read by its URI");
  assert.deepEqual(await read("Docs Hub", "file:///gone"), { contents: [], error: "Resource not found: file:///gone \u2014 it may have been deleted or the URI is stale. Re-run list_mcp_resources to refresh." });
  assert.deepEqual(await read("Docs Hub", "bad://params"), { contents: [], error: "Resource not found: bad://params \u2014 it may have been deleted or the URI is stale. Re-run list_mcp_resources to refresh." }, "-32602 too");
  assert.deepEqual(await read("github", "repo://x"), { contents: [], error: 'Server "github" advertises resource support but does not implement resource reads.' });
  assert.deepEqual(await read("Docs Hub", "bad://boom"), { error: "the MCP server said: boom" });
  assert.deepEqual(await read("nope", "a://b"), { error: 'Server "nope" not found. Available servers: Docs Hub, Plain, github, Waiting' });
  assert.deepEqual(await read("Waiting", "a://b"), { error: 'Server "Waiting" is not connected' });
  assert.deepEqual(await read("Plain", "a://b"), { error: 'Server "Plain" does not support resources' });
  // (Another turn's job: refused.)
  assert.deepEqual(await M.resourceCall(env, b, "u1", "chat-1", 5, { op: "list" }, { fetchFn }), { refused: true });
  assert.deepEqual(M.RESOURCE_LIST_WAITS, [250, 500, 1000]);
});

test("MR5 (2026-11-17) the machine: its caller sends the job's pass to the Worker's /api/coder/mcp, never a sign-in; the tools are wired for Coder's own chats only", async () => {
  const sent = [];
  const call = A.connectorResourceCaller({ url: "https://coder2.gofarther.dev/api/coder/model", headers: { "x-coder-chat": "u1/chat-1", "x-coder-model": "pass" } }, async (u, init) => { sent.push([u, init]); return new Response(JSON.stringify({ resources: [] }), { status: 200 }); });
  assert.deepEqual(await call({ op: "list" }), { resources: [] });
  assert.equal(sent[0][0], "https://coder2.gofarther.dev/api/coder/mcp");
  assert.equal(sent[0][1].headers["x-coder-model"], "pass");
  assert.deepEqual(JSON.parse(sent[0][1].body), { resources: { op: "list" } });
  const refused = A.connectorResourceCaller({ url: "https://x/api/coder/model", headers: {} }, async () => new Response(JSON.stringify({ error: "not one of this job's connector tools" }), { status: 403 }));
  assert.deepEqual(await refused({ op: "list" }), { error: "not one of this job's connector tools" });
  const down = A.connectorResourceCaller({ url: "https://x/api/coder/model", headers: {} }, async () => { throw new Error("offline"); });
  assert.deepEqual(await down({ op: "list" }), { error: "Coder's server could not be reached" });
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /const resourceServers = via && !gloopy && Array\.isArray\(body\.connectorResources\)/);
  assert.match(server, /resourceServers\.length \? \{ mcpResources: connectorResourceCaller\(via\), resourceServers \}/);
  assert.match(server, /saveBytes: \(buf, name\) => \{[\s\S]{0,700}O_EXCL \| constants\.O_NOFOLLOW/);
});

// ── CODER'S LOOP ─────────────────────────────────────────────────────────────
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const LISTED = [{ uri: "file:///docs/a.txt", name: "a.txt", mimeType: "text/plain", server: "Docs Hub" }];
/** One job with a scripted Grok and a stub for Coder's server (`answer(req)`); `servers`: the chat's that declare resources. */
async function job(steps, { answer = () => ({ resources: LISTED }), servers = ["Docs Hub"], extra = {}, deps = {}, hooks = null, hookRun = () => ({}) } = {}) {
  const events = [], seen = [], asked = [], saved = [], hookCalls = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-mr",
    ...(servers ? { mcpResources: async (req) => { asked.push(req); return answer(req); }, resourceServers: servers } : {}),
    saveBytes: (buf, name) => { saved.push({ buf, name }); return "/data/out/" + name; },
    saveText: (t) => { saved.push({ text: t }); return "/data/out/big.txt"; },
    ...deps,
  }, { text: "What docs are there?", mode: "auto", messages: [], ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const msg = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id);
  return { r, events, seen, asked, saved, hookCalls, told: (id) => (msg(id) || {}).content };
}
const names = (req) => (req.tools || []).map((t) => t.function.name);
const announced = (req) => req.messages.filter((m) => m.toolsAnnounced).flatMap((m) => m.toolsAnnounced.added);

test("MR6 (2026-11-17) Coder's loop: offered only when one of the chat's connectors declares resources, held back for tool_search with Claude Code's hints, upfront after Coder's own tools without it; never in a job from GitHub; a deny rule takes one out", async () => {
  let t = await job([say("Nothing to do.")]);
  assert.ok(!names(t.seen[0]).includes("list_mcp_resources"), "deferred");
  assert.ok(announced(t.seen[0]).includes("list_mcp_resources") && announced(t.seen[0]).includes("read_mcp_resource"));
  t = await job([say("Nothing to do.")], { deps: { toolSearch: "false" } });
  const ns = names(t.seen[0]);
  assert.deepEqual(ns.filter((x) => x.includes("mcp_resource")), ["list_mcp_resources", "read_mcp_resource"]);
  assert.ok(ns.indexOf("list_mcp_resources") > ns.indexOf("bash"), "after Coder's own");
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "read_mcp_resource").function.description, R.READ_DESCRIPTION);
  t = await job([say("Nothing to do.")], { servers: null, deps: { toolSearch: "false" } });
  assert.ok(!names(t.seen[0]).some((x) => x.includes("mcp_resource")), "no connector declares resources");
  t = await job([say("Nothing to do.")], { extra: { github: true }, deps: { toolSearch: "false" } });
  assert.ok(!names(t.seen[0]).some((x) => x.includes("mcp_resource")), "a job from GitHub");
  t = await job([say("Nothing to do.")], { extra: { rules: { allow: [], ask: [], deny: ["ReadMcpResourceTool"] } }, deps: { toolSearch: "false" } });
  assert.deepEqual(names(t.seen[0]).filter((x) => x.includes("mcp_resource")), ["list_mcp_resources"]);
  // (tool_search finds them by Claude Code's hints.)
  const { SEARCH_HINTS, DEFERRED_TOOLS } = await import("../container/coder-toolsearch.mjs");
  assert.ok(DEFERRED_TOOLS.includes("list_mcp_resources") && DEFERRED_TOOLS.includes("read_mcp_resource"));
  assert.deepEqual([SEARCH_HINTS.list_mcp_resources, SEARCH_HINTS.read_mcp_resource], [R.LIST_HINT, R.READ_HINT]);
  // (Their names in hooks and rules are Claude Code's.)
  assert.deepEqual([H.ccTool("list_mcp_resources"), H.ccTool("read_mcp_resource")], ["ListMcpResourcesTool", "ReadMcpResourceTool"]);
});

test("MR7 (2026-11-17) a list: its step in Claude Code's words; the answer as JSON after Coder's line for a connector's answer; none in its words; a server it does not have, a failed call", async () => {
  let t = await job([say("", [call("list_mcp_resources", {})]), say("Done.")]);
  assert.deepEqual(t.asked, [{ op: "list" }]);
  const step = t.events.find((e) => e.type === "bash" && e.id === "c1");
  assert.deepEqual([step.tool, step.verb, step.command], ["list_mcp_resources", "List", "all MCP resources"]);
  assert.equal(t.told("c1"), CONNECTOR_DATA + JSON.stringify(LISTED));
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "c1").code, 0);
  t = await job([say("", [call("list_mcp_resources", { server: "Docs Hub" })]), say("Done.")], { answer: () => ({ resources: [] }) });
  assert.deepEqual(t.asked, [{ op: "list", server: "Docs Hub" }]);
  assert.equal(t.events.find((e) => e.type === "bash" && e.id === "c1").command, 'MCP resources from server "Docs Hub"');
  assert.equal(t.told("c1"), "No resources found. MCP servers may still provide tools even if they have no resources.");
  t = await job([say("", [call("list_mcp_resources", { server: "nope" })]), say("Done.")], { answer: () => ({ error: 'Server "nope" not found. Available servers: Docs Hub' }) });
  assert.equal(t.told("c1"), 'error: Server "nope" not found. Available servers: Docs Hub');
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "c1").code, 1);
  // (An answer Coder's server did not give whole: a failed call, never a broken step.)
  t = await job([say("", [call("list_mcp_resources", {})]), say("Done.")], { answer: () => ({}) });
  assert.equal(t.told("c1"), "error: Coder's server did not answer");
  t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "a://b" })]), say("Done.")], { answer: () => ({ resources: [] }) });
  assert.equal(t.told("c1"), "error: Coder's server did not answer");
  // (Its input refused before any call: Claude Code's words.)
  t = await job([say("", [call("list_mcp_resources", { server: 1 })]), say("Done.")]);
  assert.equal(t.asked.length, 0);
  assert.match(t.told("c1"), /^error: InputValidationError: list_mcp_resources failed/);
});

test("MR8 (2026-11-17) a read: text as it came; binary content saved to a file in the chat's output folder with Claude Code's name, words and size; one it could not save, its words; Claude Code's answers for a resource not found; a long answer saved to a file", async () => {
  const contents = [{ uri: "file:///docs/a.txt", mimeType: "text/plain", text: "hello" }, { uri: "file:///docs/logo.png", mimeType: "image/png", blob: PNG.toString("base64") }, { uri: "x://other" }];
  let t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "file:///docs/a.txt" })]), say("Done.")], { answer: () => ({ contents, server: "Docs Hub" }) });
  assert.deepEqual(t.asked, [{ op: "read", server: "Docs Hub", uri: "file:///docs/a.txt" }]);
  const step = t.events.find((e) => e.type === "bash" && e.id === "c1");
  assert.deepEqual([step.tool, step.verb, step.command], ["read_mcp_resource", "Read", 'resource "file:///docs/a.txt" from server "Docs Hub"']);
  assert.equal(t.saved.length, 1);
  assert.match(t.saved[0].name, /^mcp-resource-\d{13}-1-[a-z0-9]{1,6}\.png$/);
  assert.deepEqual([...t.saved[0].buf], [...PNG]);
  const path = "/data/out/" + t.saved[0].name;
  assert.equal(t.told("c1"), CONNECTOR_DATA + JSON.stringify({ contents: [
    { uri: "file:///docs/a.txt", mimeType: "text/plain", text: "hello" },
    { uri: "file:///docs/logo.png", mimeType: "image/png", blobSavedTo: path, text: "[Resource from Docs Hub at file:///docs/logo.png] Binary content (image/png, " + ccSize(4) + ") saved to " + path },
    { uri: "x://other" },
  ] }));
  // (Not saved: its words, with why.)
  t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "file:///docs/logo.png" })]), say("Done.")], { answer: () => ({ contents: [contents[1]], server: "Docs Hub" }), deps: { saveBytes: () => { throw new Error("EEXIST: file already exists"); } } });
  assert.equal(t.told("c1"), CONNECTOR_DATA + JSON.stringify({ contents: [{ uri: "file:///docs/logo.png", mimeType: "image/png", text: "Binary content could not be saved to disk: EEXIST: file already exists" }] }));
  // (A resource the server does not have: Claude Code's answer, its whole text, not a failure.)
  const gone = R.resourceNotFound("file:///gone");
  t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "file:///gone" })]), say("Done.")], { answer: () => ({ contents: [], error: gone }) });
  assert.equal(t.told("c1"), gone);
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "c1").code, 0);
  // (A server not connected: Claude Code's error, a failed call.)
  t = await job([say("", [call("read_mcp_resource", { server: "Waiting", uri: "a://b" })]), say("Done.")], { answer: () => ({ error: 'Server "Waiting" is not connected' }) });
  assert.equal(t.told("c1"), 'error: Server "Waiting" is not connected');
  // (Past 100,000 characters: saved, its start shown, as Claude Code's.)
  t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "file:///big" })]), say("Done.")], { answer: () => ({ contents: [{ uri: "file:///big", text: "x".repeat(100_100) }], server: "Docs Hub" }) });
  assert.match(t.told("c1"), /^\(This came from the connector[^\n]*\n<persisted-output>\nOutput too large \([^)]*\)\. Full output saved to: \/data\/out\/big\.txt\n\nPreview \(first 2KB\):\n\{"contents"/);
});

test("MR9 (2026-11-17) its hooks: a PostToolUse hook gets Claude Code's name and result object (the list, or { contents, error? }); its rewrite is checked against Claude Code's output shape", async () => {
  const hooks = { PostToolUse: [{ matcher: "ListMcpResourcesTool|ReadMcpResourceTool", hooks: [{ type: "command", command: "after.sh" }] }] };
  let t = await job([say("", [call("list_mcp_resources", {})]), say("Done.")], { hooks });
  const post = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(post.tool_name, "ListMcpResourcesTool");
  assert.deepEqual(post.tool_input, {});
  assert.deepEqual(post.tool_response, LISTED);
  t = await job([say("", [call("read_mcp_resource", { server: "Docs Hub", uri: "file:///docs/a.txt" })]), say("Done.")], { hooks, answer: () => ({ contents: [{ uri: "file:///docs/a.txt", text: "hello" }], server: "Docs Hub" }), hookRun: (input) => (input.hook_event_name === "PostToolUse" ? { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { contents: [{ uri: "file:///docs/a.txt", text: "HELLO" }] } } }) } : {}) });
  const post2 = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(post2.tool_name, "ReadMcpResourceTool");
  assert.deepEqual(post2.tool_response, { contents: [{ uri: "file:///docs/a.txt", text: "hello" }] });
  assert.equal(t.told("c1"), CONNECTOR_DATA + '{"contents":[{"uri":"file:///docs/a.txt","text":"HELLO"}]}');
});

test("MR10 (2026-11-17) the page: each step with the connector's icon and its own words in a group; the docs say what the tools do", () => {
  const js = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(js, /list_mcp_resources: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4', read_mcp_resource: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4'/);
  assert.match(js, /list_mcp_resources: \['listed MCP resources', '', '', 'listing'\], read_mcp_resource: \['read', 'MCP resource', 'MCP resources', 'resource read'\]/);
  const docs = readFileSync(HERE("public/docs.html"), "utf8");
  assert.match(docs, /list_mcp_resources/);
  assert.match(docs, /read_mcp_resource/);
  assert.match(docs, /<a class="dc-sub" href="#conn-resources">Resource tools<\/a>/);
  assert.match(docs, /<h3 id="conn-resources">Resource tools<\/h3>/);
});
