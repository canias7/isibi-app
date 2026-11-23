// CLAUDE CODE'S Artifact, ListMcpResourcesTool, ReadMcpResourceTool AND WaitForMcpServers IN CODER (2026-11-23):
// container/coder-resources.mjs, src/coder-artifacts.mjs, src/coder-mcp.mjs resourceCall. No paid calls: Grok is faked.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const R = await import("../container/coder-resources.mjs");
const H = await import("../container/coder-hooks.mjs");
const TS = await import("../container/coder-toolsearch.mjs");
const ART = await import("../src/coder-artifacts.mjs");
const PG = await import("../src/gloopy-pages.mjs");
const MCP = await import("../src/coder-mcp.mjs");

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/res-1";
const toolReq = (cmd) => { const m = /coder-tools\.mjs (\S+)/.exec(String(cmd || "")); if (!m || m[1].startsWith("@")) return null; try { return JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); } catch { return null; } };
const names = (req) => (req.tools || []).map((t) => t.function.name);
const memBucket = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; };
const KEY = { CODER_TOKEN_KEY: "k".repeat(40) };

/** One run of Coder's loop with Grok's steps faked. */
async function run(steps, { envApi, ask, rules = { allow: [], ask: [], deny: [] }, files = {}, toolSearch = "false", msg = {}, more = {} } = {}) {
  const events = [], seen = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const q = toolReq(x.command);
      if (q && q.tool === "send_file") return files[q.args.path] ? { code: 0, output: JSON.stringify({ path: q.args.path, name: q.args.path.split("/").pop(), size: files[q.args.path].length, data: Buffer.from(files[q.args.path]).toString("base64") }) } : { code: 1, output: "error: no such file: " + q.args.path };
      return { code: 0, output: "" };
    },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "res-1", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch,
    ...more, ...(envApi ? { envApi } : {}), ...(ask ? { ask: async (pid) => ask(events.find((e) => e.type === "permission" && e.pid === pid)) } : {}),
  }, { text: "go", mode: "acceptEdits", rules, ...msg });
  return { r, events, seen, told: (id) => String((r.messages.find((x) => x.role === "tool" && x.tool_call_id === id) || {}).content || "") };
}

test("CR1 the four tools: Claude Code's names for hooks and rules, Artifact upfront, the resource tools held back with search hints, never from GitHub or in Gloopy's chats", () => {
  assert.equal(H.ccTool("artifact"), "Artifact");
  assert.equal(H.ccTool("list_mcp_resources"), "ListMcpResourcesTool");
  assert.equal(H.ccTool("read_mcp_resource"), "ReadMcpResourceTool");
  assert.equal(H.ccTool("wait_for_mcp_servers"), "WaitForMcpServers");
  for (const n of ["list_mcp_resources", "read_mcp_resource"]) { assert.ok(TS.DEFERRED_TOOLS.includes(n)); assert.equal(TS.SEARCH_HINTS[n], R.RESOURCE_HINTS[n]); }
  assert.ok(!TS.DEFERRED_TOOLS.includes("artifact") && !TS.DEFERRED_TOOLS.includes("wait_for_mcp_servers"));
  const art = R.ARTIFACT_TOOL.function;
  assert.deepEqual(art.parameters.required, ["file_path", "title"]);
  assert.match(art.description, /private, interactive page/);
  assert.match(art.description, /owner is asked before it is published/);
  const of = (o) => R.resourceToolsFor(o).map((t) => t.function.name);
  assert.ok(A.CODER_TOOLS.some((t) => t.function.name === "artifact"), "Artifact is one of Coder's own tools");
  assert.ok(A.NOT_FROM_GITHUB.includes("artifact") && !A.GITHUB_TOOLS.some((t) => t.function.name === "artifact"));
  assert.deepEqual(of({}), [], "no connectors: no resource tools");
  assert.deepEqual(of({ hasConnectors: true }), ["list_mcp_resources", "read_mcp_resource", "wait_for_mcp_servers"]);
  assert.deepEqual(of({ hasConnectors: true, toolSearchOn: true }), ["list_mcp_resources", "read_mcp_resource"], "WaitForMcpServers only with tool search off");
  assert.deepEqual(of({ github: true, hasConnectors: true }), []);
  assert.deepEqual(of({ offered: true, hasConnectors: true }), [], "not Gloopy's");
});

test("CR2 a Markdown file becomes a plain page (headings, lists, code, tables, links, escaped HTML); only .html and .md files are published", () => {
  const h = R.markdownPage("# Plan\n\nSome **bold** and `code` <script>x</script>\n\n- one\n- two\n\n```\na < b\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[docs](https://example.com)", "Plan");
  assert.match(h, /<title>Plan<\/title>/);
  assert.match(h, /<h1>Plan<\/h1>/);
  assert.match(h, /<strong>bold<\/strong> and <code>code<\/code> &lt;script&gt;/);
  assert.match(h, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(h, /<pre><code>a &lt; b<\/code><\/pre>/);
  assert.match(h, /<th>a<\/th><th>b<\/th>.*<td>1<\/td><td>2<\/td>/s);
  assert.match(h, /<a href="https:\/\/example.com" target="_blank" rel="noopener">docs<\/a>/);
  assert.ok(!/<script>/.test(h));
  assert.equal(R.artifactPageOf("r.html", Buffer.from("<p>hi</p>").toString("base64")).html, "<p>hi</p>");
  assert.match(R.artifactPageOf("a.txt", "eA==").error, /only an \.html/);
});

test("CR3 Artifact asks the owner first, then publishes through Coder's server; the chat gets a page card; a second publish of the same artifact in the job goes without a card", async () => {
  const api = [], cards = [];
  const envApi = async (b) => { api.push(b); return { ok: true, text: "Published the artifact “Report” (id pabcdefghij, version " + api.length + ").", id: "pabcdefghij", version: api.length, public: false }; };
  const { events, told } = await run([say("", [call("artifact", { file_path: "out/report.md", title: "Report" }, "a1")]), say("", [call("artifact", { file_path: "out/report.md", title: "Report", id: "pabcdefghij" }, "a2")]), say("Done.")],
    { envApi, ask: (card) => { cards.push(card); return { choice: "yes" }; }, files: { "out/report.md": "# Report\n\nAll good." } });
  assert.equal(cards.length, 1, "asked once");
  assert.equal(cards[0].tool, "artifact");
  assert.match(cards[0].what, /^Publish the artifact “Report” \(out\/report\.md\) as a private page$/);
  assert.equal(api.length, 2);
  assert.equal(api[0].action, "artifact");
  assert.match(api[0].html, /<h1>Report<\/h1>/);
  assert.equal(api[1].id, "pabcdefghij");
  assert.ok(!("public" in api[0]));
  const pages = events.filter((e) => e.type === "page");
  assert.deepEqual(pages.map((p) => [p.id, p.version, p.artifact]), [["pabcdefghij", 1, true], ["pabcdefghij", 2, true]]);
  assert.match(told("a1"), /^Published the artifact/);
});

test("CR4 Artifact: a deny rule takes it out; No stops the turn; an allow rule skips the card for a private page but never for a public link; a missing file is said", async () => {
  const api = [];
  const envApi = async (b) => { api.push(b); return { ok: true, text: "ok", id: "pabcdefghij", version: 1, ...(b.public ? { public: true, link: "https://gofarther.dev/api/coder/artifact/u/pabcdefghij?k=x" } : {}) }; };
  const files = { "p.html": "<h1>x</h1>" };
  const denied = await run([say("ok")], { envApi, files, rules: { allow: [], ask: [], deny: ["Artifact"] } });
  assert.ok(!names(denied.seen[0]).includes("artifact"), "a deny rule on Artifact: not offered, as Claude Code leaves out a denied tool");
  const no = await run([say("", [call("artifact", { file_path: "p.html", title: "P" }, "n1")]), say("ok")], { envApi, ask: () => ({ choice: "no" }), files });
  assert.match(no.told("n1"), /^The owner doesn't want to proceed with this tool use/);
  assert.equal(api.length, 0, "nothing published");
  const cards = [];
  const allowed = await run([say("", [call("artifact", { file_path: "p.html", title: "P" }, "y1")]), say("", [call("artifact", { file_path: "p.html", title: "P", public: true }, "y2")]), say("ok")],
    { envApi, ask: (c) => { cards.push(c); return { choice: "yes" }; }, files, rules: { allow: ["Artifact"], ask: [], deny: [] } });
  assert.equal(cards.length, 1, "only the public one is asked");
  assert.match(cards[0].what, /with a public link anyone can open$/);
  assert.equal(api.length, 2);
  assert.equal(api[1].public, true);
  assert.ok(allowed.events.some((e) => e.type === "page" && e.public === true && /^https:\/\//.test(e.link)));
  const missing = await run([say("", [call("artifact", { file_path: "gone.html", title: "P" }, "m1")]), say("ok")], { envApi, ask: () => ({ choice: "yes" }), files });
  assert.match(missing.told("m1"), /^error: no such file/);
});

test("CR5 the resource tools are offered where the chat can use connectors (held back under tool search), list and read through Coder's server; WaitForMcpServers only with tool search off, and waits until ready", async () => {
  const msg = {}, more = { mcp: async () => ({ ok: true, body: "" }) };
  const on = await run([say("done")], { toolSearch: "true", msg, more });
  assert.ok(!names(on.seen[0]).includes("list_mcp_resources"), "held back");
  assert.ok(!names(on.seen[0]).includes("wait_for_mcp_servers"), "tool search handles the wait");
  assert.ok(names(on.seen[0]).includes("artifact"));
  const none = await run([say("done")], {});
  assert.ok(!names(none.seen[0]).includes("list_mcp_resources"), "no connectors here: not offered");
  let waits = 0;
  const api = [];
  const envApi = async (b) => {
    api.push(b);
    if (b.action === "mcp_resources" && b.op === "list") return { ok: true, resources: [{ uri: "docs://a", name: "A", server: "Linear" }] };
    if (b.action === "mcp_resources" && b.op === "read") return { ok: true, server: "Linear", contents: [{ uri: "docs://a", mimeType: "text/plain", text: "hello" }] };
    if (b.action === "mcp_wait") return ++waits < 2 ? { ok: true, ready: false, servers: [{ name: "Linear", status: "needs-auth" }] } : { ok: true, ready: true, servers: [{ name: "Linear", status: "connected" }] };
    return { error: "error: ?" };
  };
  const off = await run([say("", [call("list_mcp_resources", {}, "l1"), call("read_mcp_resource", { server: "Linear", uri: "docs://a" }, "r1"), call("wait_for_mcp_servers", { servers: ["Linear"], timeout_seconds: 10 }, "w1")]), say("done")], { envApi, msg, more });
  assert.ok(names(off.seen[0]).includes("wait_for_mcp_servers") && names(off.seen[0]).includes("list_mcp_resources"));
  assert.match(off.told("l1"), /"uri": "docs:\/\/a"/);
  assert.match(off.told("r1"), /^\(This came from the connector[\s\S]*"text": "hello"/);
  assert.match(off.told("w1"), /^All connected:\nLinear: connected/);
  assert.equal(waits, 2);
});

test("CR6 the Worker side: an artifact is kept in its own folder (Gloopy's pages untouched), versioned, opened from a signed address, and its public link works only while public", async () => {
  const b = memBucket();
  const meta = { kind: "coder" };
  const one = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>1</p>", title: "Board" });
  assert.equal(one.ok, true);
  assert.match(one.id, PG.PAGE_ID);
  assert.ok([...b.m.keys()].every((k) => k.startsWith("coder/u1/artifacts/")), "its own folder");
  assert.deepEqual(await PG.readPages(b, "u1"), [], "Gloopy's list untouched");
  const two = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>2</p>", title: "Board", id: one.id, public: true });
  assert.equal(two.version, 2);
  assert.match(two.link, /^https:\/\/gofarther\.dev\/api\/coder\/artifact\/u1\//);
  const url = new URL(two.link);
  assert.equal((await PG.servePublicArtifact(KEY, b, "u1", one.id, url)).status, 200);
  assert.equal(await (await PG.servePublicArtifact(KEY, b, "u1", one.id, url)).text(), "<p>2</p>");
  assert.equal((await PG.servePublicArtifact(KEY, b, "u1", one.id, new URL(two.link.replace(/k=.{4}/, "k=AAAA")))).status, 404, "a wrong key");
  const req = (body) => new Request("https://x/", { method: "POST", body: JSON.stringify(body) });
  const off = await (await ART.artifactPages(req({ share: one.id, public: false }), KEY, b, "u1")).json();
  assert.equal(off.public, false);
  assert.equal((await PG.servePublicArtifact(KEY, b, "u1", one.id, url)).status, 404, "the link stops once private");
  const open = await (await ART.artifactPages(req({ open: one.id }), KEY, b, "u1")).json();
  assert.match(open.url, /^\/api\/coder\/artifact-page\/u1\//);
  const shown = await PG.servePageFile(KEY, b, "u1", one.id, new URL("https://x" + open.url), Date.now(), "artifacts");
  assert.equal(shown.status, 200);
  assert.equal((await PG.servePageFile(KEY, b, "u1", one.id, new URL("https://x" + open.url))).status, 404, "a Gloopy page address does not open it");
  assert.match((await ART.artifactNow(KEY, b, "u1", { jobFromGithub: true }, { html: "x", title: "t" })).error, /not from GitHub/);
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "x", title: "t", id: "pzzzzzzzzzz" })).error, /no artifact has the id/);
});

test("CR7 MCP Apps UI resources are left out of the list (a ui:// URI or text/html;profile=mcp-app), other resources stay", () => {
  assert.equal(MCP.isUiResource({ uri: "ui://widget/x" }), true);
  assert.equal(MCP.isUiResource({ uri: "https://a", mimeType: "text/html;profile=mcp-app" }), true);
  assert.equal(MCP.isUiResource({ uri: "file:///a.md", mimeType: "text/markdown" }), false);
  assert.equal(MCP.isUiResource({ uri: "https://a", mimeType: "text/html" }), false);
});

test("CR8 the Worker's routes and the machine's caller carry these actions", async () => {
  const { readFileSync } = await import("node:fs");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /parts\[0\] === "artifact-page"/);
  assert.match(routes, /parts\[0\] === "artifact" && parts\.length === 3/);
  assert.match(routes, /action === "pages"\) return artifactPages/);
  const envapi = readFileSync(new URL("../src/coder-envapi.mjs", import.meta.url), "utf8");
  for (const a of ["artifact", "mcp_resources", "mcp_wait"]) assert.match(envapi, new RegExp('body\\.action === "' + a + '"'));
  const { envCaller } = await import("../container/coder-envtools.mjs");
  const call1 = envCaller({ url: "https://x/api/coder/model", headers: {} }, async () => new Response(JSON.stringify({ ok: true, resources: [{ uri: "a" }] })));
  assert.deepEqual(await call1({ action: "mcp_resources", op: "list" }), { ok: true, resources: [{ uri: "a" }] });
});
