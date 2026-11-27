// The sheet's web rows, 2026-11-23 ("make Coder match Claude Code"): WebSearch's domain lists and titles and its count per
// chat, WebFetch's User-Agent, its page that failed moments ago, its artifactRead, the web-fetch agent, a job from GitHub as
// claude -p, a connector's headersHelper, an MCP tool's content blocks, RefreshMcpTools' switch (cc-resources.test.mjs) and
// a WebSocket watch behind the gate. No real site or paid call: every request is a stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const W = await import("../container/coder-websearch.mjs");
const WF = await import("../container/coder-webfetch.mjs");
const A = await import("../container/coder-agent.mjs");
const T = await import("../container/coder-tools.mjs");
const AG = await import("../container/coder-agents.mjs");
const HH = await import("../container/coder-mcphelper.mjs");
const MCP = await import("../src/coder-mcp.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("WR1 WebSearch's allowed_domains and blocked_domains take any number of hosts in Coder's chats: Grok gets a list of 5 or fewer, and Coder's own code keeps or leaves out each link by its host (subdomains covered); Gloopy keeps Grok's 5", async () => {
  const six = ["a.com", "b.com", "c.com", "d.com", "e.com", "nodejs.org"];
  assert.ok(W.checkInput({ query: "node", allowed_domains: six }).args);
  assert.match(W.checkInput({ query: "node", allowed_domains: six }, { searchModes: false }).error, /at most 5 domains/);
  assert.deepEqual(W.searchRequest({ args: { query: "node", allowed_domains: six } }).webSearch, {}, "over 5: not sent to Grok");
  assert.deepEqual(W.searchRequest({ args: { query: "node", allowed_domains: ["nodejs.org"] } }).webSearch, { allowed_domains: ["nodejs.org"] });
  assert.equal(W.WEB_SEARCH_MODE_TOOL.function.parameters.properties.allowed_domains.description, "Only include search results from these domains");
  assert.match(W.WEB_SEARCH_TOOL.function.parameters.properties.allowed_domains.description, /at most 5/, "Gloopy's as it was");
  assert.equal(W.hostCovered("docs.nodejs.org", ["nodejs.org"]), true);
  assert.equal(W.hostCovered("www.nodejs.org", ["https://nodejs.org/"]), true);
  assert.equal(W.hostCovered("evilnodejs.org", ["nodejs.org"]), false);
  const answer = { output: [{ type: "web_search_call", id: "s1", action: { sources: [{ url: "https://nodejs.org/en" }, { url: "https://blog.x.com/n" }, { url: "https://docs.nodejs.org/api" }] } }, { type: "message", content: [{ text: "Node 26." }] }] };
  const kept = await W.runWebSearch(async () => answer, { args: { query: "node", allowed_domains: six } });
  assert.deepEqual(kept.facts.results[0].content.map((l) => l.url), ["https://nodejs.org/en", "https://docs.nodejs.org/api"]);
  const left = await W.runWebSearch(async () => answer, { args: { query: "node", blocked_domains: ["x.com", "q.com", "r.com", "s.com", "t.com", "u.com"] } });
  assert.deepEqual(left.facts.results[0].content.map((l) => l.url), ["https://nodejs.org/en", "https://docs.nodejs.org/api"]);
  assert.equal(left.facts.searchCount, 1, "the count per call kept");
});

test("WR2 WebSearch returns titles: a link Grok gave with no title gets its page's own <title> (Coder's tools script reads the start of each page), else keeps its address", async () => {
  assert.equal(W.titleOf("<html><head><title> Node.js &amp; you </title>"), "Node.js & you");
  assert.equal(W.titleOf("<p>none</p>"), "");
  const answer = { output: [{ type: "web_search_call", id: "s1", action: { sources: [{ url: "https://nodejs.org/en" }, { url: "https://b.org/", title: "Given" }, { url: "https://c.org/" }] } }] };
  let asked = null;
  const r = await W.runWebSearch(async () => answer, { args: { query: "node" }, titles: async (urls) => { asked = urls; return { "https://nodejs.org/en": "Node.js — Run JavaScript Everywhere" }; } });
  assert.deepEqual(asked, ["https://nodejs.org/en", "https://c.org/"], "only the links with no title");
  assert.deepEqual(r.facts.results[0].content, [{ title: "Node.js — Run JavaScript Everywhere", url: "https://nodejs.org/en" }, { title: "Given", url: "https://b.org/" }, { title: "https://c.org/", url: "https://c.org/" }]);
  assert.match(r.text, /"title":"Node.js — Run JavaScript Everywhere"/);
  // The tools script's reader: the start of an HTML page, its title; anything else nothing.
  const got = JSON.parse(await T.toolPageTitles({ urls: ["https://a.org/", "https://b.org/", "ftp://c.org/"] }, { get: (u, headers, onRes) => {
    assert.match(headers["user-agent"], /^Coder-User /);
    const { EventEmitter } = require_events();
    const res = new EventEmitter();
    res.statusCode = 200; res.headers = { "content-type": u.hostname === "a.org" ? "text/html" : "application/json" };
    setImmediate(() => { onRes(res); res.emit("data", Buffer.from("<title>A page</title>")); res.emit("end"); });
    const req = new EventEmitter(); req.destroy = () => {}; return req;
  } }));
  assert.deepEqual(got, { "https://a.org/": "A page" });
});
function require_events() { return { EventEmitter: class { constructor() { this.l = {}; } on(e, f) { (this.l[e] = this.l[e] || []).push(f); return this; } emit(e, ...a) { for (const f of this.l[e] || []) f(...a); } } }; }

test("WR3 WebFetch's User-Agent in Claude Code's style (Claude-User …): Coder-User (gofarther.dev; +https://gofarther.dev/), with the Accept header that prefers Markdown", () => {
  assert.equal(WF.WEBFETCH_USER_AGENT, "Coder-User (gofarther.dev; +https://gofarther.dev/)");
  assert.equal(WF.WEBFETCH_ACCEPT, "text/markdown, text/html, */*");
});

const fetchDeps = (outputs, calls) => ({
  send: async () => ({ message: { role: "assistant", content: "the answer" }, usage: { in: 1, out: 1 } }),
  exec: async (x) => { calls.push(x); const o = outputs.shift(); return o || { code: 0, output: "" }; },
});
const pageOut = (text) => T.printedAnswer({ text, facts: { kind: "page", bytes: Buffer.byteLength(text), code: 200, codeText: "OK", contentType: "text/html", cacheBytes: Buffer.byteLength(text), binary: false } });

test("WR4 a page that failed moments ago in the same chat is not fetched again (Claude Code 2.1.300's cloud sessions): Coder is told the earlier failure; after the minute, or in another chat, it is fetched", async () => {
  const calls = [];
  let clock = 1_000_000;
  const now = () => clock;
  const deps = fetchDeps([{ code: 1, output: "error: getaddrinfo ENOTFOUND nope.example" }, { code: 0, output: pageOut("<p>hi</p>") }], calls);
  const url = "https://nope.example/x";
  const a = await A.webFetchRun(deps, { args: { url, prompt: "what?" }, chat: "wr4", now });
  assert.equal(a.code, 1);
  const b = await A.webFetchRun(deps, { args: { url, prompt: "again" }, chat: "wr4", now });
  assert.equal(calls.length, 1, "not fetched again");
  assert.equal(b.out, WF.failedMomentsAgo(url, "error: getaddrinfo ENOTFOUND nope.example"));
  assert.match(b.out, /^error: https:\/\/nope\.example\/x failed moments ago, so it was not fetched again\. The earlier failure: getaddrinfo ENOTFOUND/);
  clock += WF.WEBFETCH_FAILED_MS + 1;
  const c = await A.webFetchRun(deps, { args: { url, prompt: "now?" }, chat: "wr4", now });
  assert.equal(calls.length, 2);
  assert.equal(c.code, 0);
});

test("WR5 WebFetch's result object has Claude Code's artifactRead for a read of one of the owner's artifacts (slug, ver when the job recorded one, seeded: false); none for any other page", async () => {
  assert.deepEqual(WF.artifactReadOf("https://gofarther.dev/api/coder/artifact/u1/pabcdefghij?k=t"), { slug: "pabcdefghij", seeded: false });
  assert.deepEqual(WF.artifactReadOf("https://test.gofarther.dev/api/coder/artifact/u1/pabcdefghij?k=t", { uid: "u1", version: 3 }), { slug: "pabcdefghij", ver: 3, seeded: false });
  assert.equal(WF.artifactReadOf("https://gofarther.dev/api/coder/artifact/u2/pabcdefghij", { uid: "u1" }), null, "someone else's");
  assert.equal(WF.artifactReadOf("https://example.com/api/coder/artifact/u1/pabcdefghij"), null);
  const calls = [];
  const r = await A.webFetchRun(fetchDeps([{ code: 0, output: pageOut("<p>art</p>") }], calls), { args: { url: "https://gofarther.dev/api/coder/artifact/u1/pzzzzzzzzzz?k=1", prompt: "?" }, chat: "wr5", artifactVersion: (id) => (id === "pzzzzzzzzzz" ? 4 : undefined) });
  assert.deepEqual(r.facts.artifactRead, { slug: "pzzzzzzzzzz", ver: 4, seeded: false });
  const o = await A.webFetchRun(fetchDeps([{ code: 0, output: pageOut("<p>x</p>") }], []), { args: { url: "https://example.org/a", prompt: "?" }, chat: "wr5" });
  assert.equal("artifactRead" in o.facts, false);
});

test("WR6 the web-fetch agent (Claude Code's built-in): offered by the agent tool with web_fetch only; its fetch gives the page's own text, up to about 48,000 characters, with the note when it goes on", async () => {
  assert.deepEqual(AG.AGENT_TYPES["web-fetch"].tools, ["web_fetch"]);
  assert.match(AG.AGENT_TOOL.function.description, /- web-fetch: Reads a web page for Coder: .* \(Tools: web_fetch\)/);
  assert.equal(WF.WEB_FETCH_AGENT_CHARS, 48_000);
  const long = "x".repeat(60_000);
  const plain = T.printedAnswer({ text: long, facts: { kind: "page", bytes: long.length, code: 200, codeText: "OK", contentType: "text/plain", cacheBytes: long.length, binary: false } });
  const sent = [];
  const deps = { send: async (q) => { sent.push(q); return { message: { role: "assistant", content: "read" } }; }, exec: async () => ({ code: 0, output: plain }) };
  const r = await A.webFetchRun(deps, { args: { url: "https://example.org/long", prompt: "all of it" }, chat: "wr6", rawChars: WF.WEB_FETCH_AGENT_CHARS });
  assert.equal(sent.length, 0, "no page reader: the agent reads it");
  assert.ok(r.out.startsWith("x".repeat(48_000)));
  assert.match(r.out.slice(48_000), /60,?000|offset/);
});

test("WR7 a job from GitHub is Claude Code's claude -p: with the checker off (Manual mode) a fetch that needs approval is denied in Claude Code's words; a pre-approved documentation site is fetched", async () => {
  const fetched = [];
  const run = async (url) => {
    let n = 0;
    const steps = [say("", [call("web_fetch", { url, prompt: "?" }, "f1")]), say("done")];
    const r = await A.runCoder({
      send: async (req) => (Array.isArray(req.messages) && req.messages[0] && req.messages[0].content === A.PAGE_READER ? { message: { role: "assistant", content: "read" } } : steps[Math.min(n++, steps.length - 1)]),
      exec: async (x) => { if (/coder-tools\.mjs/.test(String(x.command))) { fetched.push(url); return { code: 0, output: pageOut("<p>doc</p>") }; } return { code: 0, output: "" }; },
      emit: () => {}, here: () => "/work/gh", root: "/work/gh", chatId: "gh-" + Math.random(), where: (p) => p,
    }, { text: "go", github: true, checker: false, mode: "auto", messages: [] });
    return (r.messages.find((m) => m.role === "tool" && m.tool_call_id === "f1") || {}).content;
  };
  assert.equal(await run("https://example.org/page"), "Coder requested permissions to use WebFetch, but you haven't granted it yet.");
  assert.deepEqual(fetched, []);
  await run("https://code.claude.com/docs/en/overview");
  assert.deepEqual(fetched, ["https://code.claude.com/docs/en/overview"]);
});

test("WR8 a connector's headersHelper (Coder's CODER_MCP_HEADERS_HELPER, Claude Code's rules): at most 500 printable ASCII characters with no run of four spaces; one JSON object of string values, exit 0 within 10 seconds; output reused for 60 seconds; routing and identity names dropped; a failed helper stops the call", async () => {
  assert.equal(HH.helperCommandProblem("/opt/bin/mint-token.sh"), "");
  assert.match(HH.helperCommandProblem("x".repeat(501)), /longer than 500/);
  assert.equal(HH.helperCommandProblem("x".repeat(500)), "");
  assert.match(HH.helperCommandProblem("echo    hi"), /four or more spaces/);
  assert.equal(HH.helperCommandProblem("echo   hi"), "");
  assert.match(HH.helperCommandProblem("echo hé"), /printable ASCII/);
  assert.deepEqual(HH.helperHeaders('{"Authorization":"Bearer t","Host":"evil","X-Forwarded-For":"1","Cookie":"c","X-Team":"a"}'), { headers: { authorization: "Bearer t", "x-team": "a" } });
  assert.match(HH.helperHeaders('{"a":1}').error, /not a string/);
  assert.match(HH.helperHeaders("[]").error, /JSON object/);
  assert.match(HH.helperHeaders("nope").error, /JSON object/);
  const runs = [];
  let clock = 0, code = 0;
  const h = HH.headersHelperFor("/opt/bin/mint-token.sh", async (x) => { runs.push(x); return { code, output: '{"Authorization":"Bearer ' + runs.length + '"}\n' }; }, { now: () => clock });
  assert.deepEqual(await h.run(), { headers: { authorization: "Bearer 1" } });
  assert.deepEqual([runs[0].timeoutS, runs[0].command], [10, "( /opt/bin/mint-token.sh ) 2>/dev/null"]);
  clock = 59_000;
  assert.deepEqual(await h.run(), { headers: { authorization: "Bearer 1" } }, "reused");
  clock = 61_000;
  assert.deepEqual(await h.run(), { headers: { authorization: "Bearer 2" } });
  clock = 200_000; code = 3;
  const sent = [];
  const mcp = HH.withHeadersHelper(async (tool, args, opts) => { sent.push(opts); return { text: "ok" }; }, h);
  const failed = await mcp("mcp__x__y", {}, null);
  assert.deepEqual([failed.isError, sent.length], [true, 0]);
  assert.match(failed.text, /^error: the connector call was not made: headersHelper exited with code 3/);
  code = 0;
  await mcp("mcp__x__y", {}, { ask: null });
  assert.deepEqual(sent[0].headers, { authorization: "Bearer 4" });
  // The machine sends them with the call; the Worker takes only well-formed, non-routing names.
  let body = null;
  const caller = A.connectorCaller({ url: "https://gofarther.dev/api/coder/model", headers: {} }, async (u, o) => { body = JSON.parse(o.body); return { ok: true, headers: { get: () => "application/json" }, json: async () => ({ text: "hi" }) }; });
  await caller("mcp__x__y", {}, { headers: { authorization: "Bearer z" } });
  assert.deepEqual(body.headers, { authorization: "Bearer z" });
  assert.deepEqual(MCP.helperHeadersIn({ Authorization: "Bearer z", Host: "h", "mcp-session-id": "s", "bad name": "x", "X-Ok": "1\n2" }), { authorization: "Bearer z" });
  assert.equal(MCP.helperHeadersIn({ Host: "h" }), null);
  // The setting reaches the loop from the environment's variables; the Dockerfile ships the module.
  const srv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /mcpHeadersHelper: !gloopy && typeof rawVars\.CODER_MCP_HEADERS_HELPER === "string"/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /coder-mcphelper\.mjs/);
});

test("WR9 an MCP tool's result for the PostToolUse hooks is the server's list of content blocks (text scrubbed), or its text when it gave none", () => {
  const r = MCP.resultText({ content: [{ type: "text", text: "a" }, { type: "resource_link", uri: "file:///x" }] });
  assert.deepEqual(r.content, [{ type: "text", text: "a" }, { type: "resource_link", uri: "file:///x" }]);
  assert.equal(r.text, "a\n[a link: file:///x]");
  assert.deepEqual(A.mcpBlocks(r, (s) => s.replace("a", "[gone]")), [{ type: "text", text: "[gone]" }, { type: "resource_link", uri: "file:///x" }]);
  assert.equal(A.mcpBlocks({ text: "x" }), null);
  assert.equal(MCP.resultText({ structuredContent: { a: 1 } }).content, undefined);
  assert.deepEqual(Object.keys(r), ["text", "isError"], "kept out of sight");
  assert.deepEqual(MCP.withBlocks(r).content.length, 2, "spelled out for the machine");
});

test("WR10 a WebSocket watch behind the gate asks the gate, never looks the host up itself (ws-monitor-1127.test.mjs)", () => {
  assert.equal(typeof T.proxyResolvesHosts, "undefined");
  assert.equal(typeof T.couldNotResolve, "undefined");
});

test("WR11 WebFetch and the network list: like Claude Code's sandbox allowedDomains, the list doesn't decide whether a fetch asks (only WebFetch rules and the pre-approved documentation sites do), and the gate never takes the documentation sites for commands", async () => {
  const P = await import("../container/coder-perms.mjs");
  assert.equal(P.fetchDecision("https://example.org/", { mode: "acceptEdits", rules: {} }).verdict, "ask");
  assert.equal(P.fetchDecision("https://example.org/", { mode: "acceptEdits", rules: { allow: ["WebFetch(domain:example.org)"] } }).verdict, "allow");
  const proxy = readFileSync(new URL("../container/coder-proxy.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(proxy, /docSite|webfetch-sites/);
});
