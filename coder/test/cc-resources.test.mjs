// CLAUDE CODE'S Artifact, ListMcpResourcesTool, ReadMcpResourceTool AND WaitForMcpServers IN CODER (2026-11-23):
// container/coder-resources.mjs, src/coder-artifacts.mjs, src/coder-mcp.mjs resourceCall. No paid calls: Grok is faked.
import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
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
  assert.equal(H.ccTool("read_mcp_resource_dir"), "ReadMcpResourceDirTool");
  assert.equal(H.ccTool("refresh_mcp_tools"), "RefreshMcpTools");
  for (const n of ["list_mcp_resources", "read_mcp_resource", "read_mcp_resource_dir", "refresh_mcp_tools"]) { assert.ok(TS.DEFERRED_TOOLS.includes(n)); assert.equal(TS.SEARCH_HINTS[n], R.RESOURCE_HINTS[n]); }
  assert.ok(!TS.DEFERRED_TOOLS.includes("artifact") && !TS.DEFERRED_TOOLS.includes("wait_for_mcp_servers"));
  const art = R.ARTIFACT_TOOL.function;
  assert.deepEqual(art.parameters.required, []);
  assert.match(art.description, /renders an HTML file as an Artifact: a web page on gofarther.dev that is private by default/);
  assert.match(art.description, /owner is asked before a page is published/);
  const of = (o) => R.resourceToolsFor(o).map((t) => t.function.name);
  assert.ok(A.CODER_TOOLS.some((t) => t.function.name === "artifact"), "Artifact is one of Coder's own tools");
  assert.ok(A.NOT_FROM_GITHUB.includes("artifact") && !A.GITHUB_TOOLS.some((t) => t.function.name === "artifact"));
  assert.deepEqual(of({}), [], "no connectors: no resource tools");
  assert.deepEqual(of({ hasConnectors: true }), ["list_mcp_resources", "read_mcp_resource", "read_mcp_resource_dir", "wait_for_mcp_servers"], "refresh_mcp_tools only with its switch");
  assert.deepEqual(of({ hasConnectors: true, refresh: true }), ["list_mcp_resources", "read_mcp_resource", "read_mcp_resource_dir", "refresh_mcp_tools", "wait_for_mcp_servers"]);
  assert.deepEqual(of({ hasConnectors: true, toolSearchOn: true, refresh: true }), ["list_mcp_resources", "read_mcp_resource", "read_mcp_resource_dir", "refresh_mcp_tools"], "WaitForMcpServers only with tool search off");
  // (The switch: Claude Code's CLAUDE_CODE_ENABLE_REFRESH_MCP_TOOLS=1, Coder's CODER_ENABLE_REFRESH_MCP_TOOLS=1.)
  const srv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /CLAUDE_CODE_ENABLE_REFRESH_MCP_TOOLS: "CODER_ENABLE_REFRESH_MCP_TOOLS"/);
  assert.match(srv, /refreshTools: !gloopy && varOn\(rawVars\.CODER_ENABLE_REFRESH_MCP_TOOLS\)/);
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
  const { events, told } = await run([say("", [call("artifact", { file_path: "out/report.md", title: "Report" }, "a1")]), say("", [call("artifact", { file_path: "out/report.md", title: "Report", url: "pabcdefghij" }, "a2")]), say("Done.")],
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
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "x", title: "t", id: "pzzzzzzzzzz" })).error, /no artifact has the url/);
});

test("CR7 MCP Apps UI resources are left out of the list (a ui:// URI or text/html;profile=mcp-app), other resources stay", () => {
  assert.equal(MCP.isUiResource({ uri: "ui://widget/x" }), true);
  assert.equal(MCP.isUiResource({ uri: "https://a", mimeType: "text/html;profile=mcp-app" }), true);
  assert.equal(MCP.isUiResource({ uri: "file:///a.md", mimeType: "text/markdown" }), false);
  assert.equal(MCP.isUiResource({ uri: "https://a", mimeType: "text/html" }), false);
});

test("CR8 the Worker's routes and the machine's caller carry these actions", async () => {
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

// ── MADE TO MATCH CLAUDE CODE'S INPUTS AND DESCRIPTIONS (2026-11-23, second pass) ──────────────────────────────────────

test("CR9 Artifact's inputs by Claude Code's names and limits: its actions, description ≤1000, icon ≤40, label ≤60, limit 1–200, scope mine/shared/all; list takes only limit and scope; capabilities and contract are not available in Coder", () => {
  const p = R.ARTIFACT_TOOL.function.parameters.properties;
  assert.deepEqual(p.action.enum, ["publish", "list", "read", "delete", "open"]);
  assert.equal(p.description.maxLength, 1000);
  assert.equal(p.icon.maxLength, 40);
  assert.equal(p.label.maxLength, 60);
  assert.deepEqual([p.limit.minimum, p.limit.maximum], [1, 200]);
  assert.deepEqual(p.scope.enum, ["mine", "shared", "all"]);
  for (const k of ["file_path", "url", "title", "force", "capabilities", "contract", "public"]) assert.ok(p[k], k);
  assert.ok(!("id" in p), "url, not id, names an existing artifact");
  const bad = R.artifactInputProblem;
  assert.equal(bad({ action: "list", limit: 10, scope: "all" }), "");
  assert.match(bad({ action: "list", title: "x" }), /only limit and scope may be passed \(not title\)/);
  assert.match(bad({ action: "list", limit: 201 }), /limit must be a whole number from 1 to 200/);
  assert.match(bad({ action: "list", scope: "everyone" }), /scope must be/);
  assert.match(bad({ action: "pin", url: "pabcdefghij" }), /pin, unpin and quickstart are not available in Coder/);
  assert.match(bad({ action: "read" }), /read takes url/);
  assert.match(bad({ action: "delete", url: "pabcdefghij", file_path: "a.html" }), /file_path is for action publish only/);
  assert.match(bad({}), /publish takes file_path/);
  assert.match(bad({ file_path: "a.html", icon: "x".repeat(41) }), /icon must be a string of at most 40/);
  assert.match(bad({ file_path: "a.html", label: "x".repeat(61) }), /label must be a string of at most 60/);
  assert.match(bad({ file_path: "a.html", description: "x".repeat(1001) }), /description must be a string of at most 1000/);
  assert.equal(bad({ file_path: "a.html", capabilities: {} }), "", "{} (none) is accepted");
  assert.equal(bad({ file_path: "a.html", capabilities: { db: {} } }), "", "db is one Coder provides (2026-11-23)");
  assert.match(bad({ file_path: "a.html", capabilities: { camera: {} } }), /camera is not one this account can use/);
  assert.match(bad({ file_path: "a.html", capabilities: { db: { x: 1 } } }), /db capability takes an empty config/);
  assert.equal(bad({ file_path: "a.html", contract: "latest" }), "");
  assert.equal(bad({ file_path: "a.html", contract: "1.0.0" }), "");
  assert.match(bad({ file_path: "a.html", contract: "2.0.0" }), /not a runtime version Coder has/);
  assert.match(bad({ file_path: "a.html", url: "https://elsewhere.example/x" }), /url is not one of Coder's artifacts/);
  assert.equal(R.artifactIdOf("https://gofarther.dev/api/coder/artifact/u1/pabcdefghij?k=x"), "pabcdefghij");
  assert.equal(R.artifactIdOf("pabcdefghij"), "pabcdefghij");
  assert.match(R.ARTIFACT_DESCRIPTION, /\*\*Calls\*\*: `action` picks one \(publish when omitted\)/);
  assert.match(R.ARTIFACT_DESCRIPTION, /`force: true` is a last-resort overwrite that discards the newer published version/);
});

test("CR10 the source file decoded as Claude Code decodes it: UTF-8, or UTF-16 LE by its byte-order mark; bad bytes and U+FFFD refused with the line and column (and '+N more'); the title is the page's own <title>; .markdown is not one of the types", () => {
  assert.equal(R.decodeSource(Buffer.from([0x61, 0x0a, 0x62, 0xff])).error, "file_path: the source file is not valid UTF-8 text (first invalid byte at line 2, column 2). It may be saved in another encoding or contain binary data. Rewrite it as UTF-8, then publish again. Nothing was published.");
  assert.equal(R.decodeSource(Buffer.from("ab\n\n  x�y��")).error, "file_path: the source file has the replacement character U+FFFD at line 3, column 4 (+2 more), usually left where an earlier edit or paste lost a character. Replace it with the intended text (in HTML, write an intended U+FFFD as &#xFFFD;), then publish again.");
  assert.equal(R.decodeSource(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<p>é</p>", "utf16le")])).text, "<p>é</p>");
  assert.equal(R.decodeSource(Buffer.from("é ✓ 😀")).text, "é ✓ 😀");
  const b64 = (t) => Buffer.from(t).toString("base64");
  assert.equal(R.artifactPageOf("r.html", b64("<title>Q3 Board</title><p>hi</p>"), "Other").title, "Q3 Board");
  assert.equal(R.artifactPageOf("r.html", b64("<p>hi</p>"), "Given").title, "Given");
  assert.equal(R.artifactPageOf("deploy-failures.html", b64("<p>hi</p>")).title, "deploy-failures");
  assert.match(R.artifactPageOf("a.markdown", b64("# x")).error, /only an \.html, \.htm or \.md file/);
});

test("CR11 the Worker's artifacts: list (newest first, limit, truncated, total, scope and rel), get, read with its versions and labels, icon kept on an update, a stale publish refused with the live page unless forced, delete; Gloopy's pages untouched", async () => {
  const b = memBucket(), meta = { kind: "coder" };
  await PG.keepPages(b, "u1", [{ id: "pgloopy0001", title: "Gloopy's", html: "<p>g</p>" }], 1);
  const a = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>a</p>", title: "A", icon: "chart", description: "One.", label: "first" }, { now: 1000, chat: "c1" });
  const z = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>z</p>", title: "Z" }, { now: 2000, chat: "c1" });
  assert.equal(a.updated, false);
  const two = await ART.artifactNow(KEY, b, "u1", meta, { op: "publish", html: "<p>a2</p>", title: "A", id: a.id, base: 1, label: "second" }, { now: 3000, chat: "c1" });
  assert.deepEqual([two.version, two.updated], [2, true]);
  const l = await ART.artifactNow(KEY, b, "u1", meta, { op: "list", limit: 1, scope: "mine" });
  assert.deepEqual(l.artifacts.map((x) => [x.url, x.title, x.version, x.icon, x.description]), [[a.id, "A", 2, "chart", "One."]], "newest first, icon and description kept");
  assert.equal(l.artifacts[0].updatedAt, new Date(3000).toISOString());
  assert.deepEqual([l.total, l.truncated, l.scope], [2, true, undefined]);
  const all = await ART.artifactNow(KEY, b, "u1", meta, { op: "list", scope: "all" });
  assert.deepEqual([all.scope, all.artifacts.map((x) => x.rel)], ["all", ["mine", "mine"]]);
  assert.deepEqual((await ART.artifactNow(KEY, b, "u1", meta, { op: "list", scope: "shared" })).artifacts, []);
  const r = await ART.artifactNow(KEY, b, "u1", meta, { op: "read", id: a.id });
  assert.equal(r.html, "<p>a2</p>");
  assert.deepEqual(r.versions.map((v) => [v.version, v.label]), [[1, "first"], [2, "second"]]);
  // (A stale base, and another chat's latest with no base: refused with the live page; force overwrites.)
  const old = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>old</p>", title: "A", id: a.id, base: 1 }, { chat: "c1" });
  assert.equal(old.stale, true);
  assert.match(old.error, /newer version \(2\) than the one this publish is built on \(1\)\. Nothing was published/);
  assert.equal(old.html, "<p>a2</p>");
  const other = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>c2</p>", title: "A", id: a.id }, { chat: "c2" });
  assert.match(other.error, /published from another chat, which this chat has not read/);
  const forced = await ART.artifactNow(KEY, b, "u1", meta, { html: "<p>c2</p>", title: "A", id: a.id, force: true }, { chat: "c2" });
  assert.equal(forced.version, 3);
  assert.equal((await ART.artifactNow(KEY, b, "u1", meta, { op: "get", id: a.id })).title, "A");
  const del = await ART.artifactNow(KEY, b, "u1", meta, { op: "delete", id: z.id });
  assert.match(del.text, /^Deleted the artifact “Z”/);
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { op: "read", id: z.id })).error, /no artifact has the url/);
  assert.equal(b.m.has("coder/u1/artifacts/pages/" + z.id + ".html"), false);
  assert.deepEqual((await PG.readPages(b, "u1")).map((p) => p.id), ["pgloopy0001"], "Gloopy's pages untouched");
  // (The page's own remove and share keep the artifacts' own fields.)
  const req = (body) => new Request("https://x/", { method: "POST", body: JSON.stringify(body) });
  await ART.artifactPages(req({ share: a.id, public: true }), KEY, b, "u1");
  assert.equal((await ART.artifactNow(KEY, b, "u1", meta, { op: "list" })).artifacts[0].icon, "chart");
  assert.match((await ART.artifactNow(KEY, b, "u1", meta, { html: "x".repeat(ART.ARTIFACT_MAX + 1), title: "Big" })).error, /an artifact is at most 16 MiB/);
  assert.equal((await ART.artifactNow(KEY, b, "u1", meta, { html: "x".repeat(PG.PAGE_MAX + 1), title: "Over Gloopy's" })).ok, true, "over 512 KB is fine for an artifact now");
});

test("CR12 the loop: list, read and open need no card (open shows the artifact's card), delete always asks (an allow rule too), a stale publish hands over the live version and the next publish goes through", async () => {
  const api = [], cards = [];
  let version = 2, gets = 0;
  const envApi = async (q) => {
    api.push(q);
    if (q.op === "list") return { ok: true, artifacts: [{ title: "A", url: "pabcdefghij", version }], total: 1 };
    if (q.op === "get") return { ok: true, id: q.id, title: "A", version: gets++ ? version : 1 };
    if (q.op === "read") return { ok: true, id: q.id, title: "A", version, html: "<p>live</p>", versions: [{ version: 1 }, { version: 2 }] };
    if (q.op === "delete") return { ok: true, text: "Deleted the artifact “A” (pabcdefghij)." };
    if (q.op === "publish" && q.base !== version) return { stale: true, version, html: "<p>live</p>", error: "error: newer version" };
    return { ok: true, text: "Updated", id: q.id, version: ++version };
  };
  const steps = [
    say("", [call("artifact", { action: "list", limit: 5 }, "l1"), call("artifact", { action: "open", url: "pabcdefghij" }, "o1")]),
    say("", [call("artifact", { file_path: "p.html", url: "pabcdefghij", label: "fix" }, "p1")]),
    say("", [call("artifact", { file_path: "p.html", url: "pabcdefghij" }, "p2")]),
    say("", [call("artifact", { action: "read", url: "pabcdefghij" }, "r1"), call("artifact", { action: "delete", url: "pabcdefghij" }, "d1")]),
    say("Done."),
  ];
  const { events, told } = await run(steps, { envApi, ask: (c) => { cards.push(c); return { choice: "yes" }; }, files: { "p.html": "<p>mine</p>" }, rules: { allow: ["Artifact"], ask: [], deny: [] } });
  assert.deepEqual(JSON.parse(told("l1")), { artifacts: [{ title: "A", url: "pabcdefghij", version: 2 }], truncated: false, total: 1 });
  assert.equal(api[0].limit, 5);
  assert.ok(events.some((e) => e.type === "page" && e.id === "pabcdefghij" && e.artifact === true), "open shows its card");
  assert.match(told("o1"), /^Showed the owner the artifact “A”/);
  assert.match(told("p1"), /^error: newer version\n<p>live<\/p>$/, "the live version handed over");
  assert.equal(api.find((q) => q.op === "publish").base, 1, "open counted as seeing version 1");
  assert.equal(api.filter((q) => q.op === "publish")[1].base, 2, "the refusal counted as reading version 2");
  assert.match(told("p2"), /^Updated/);
  assert.equal(api.filter((q) => q.op === "publish")[1].label, undefined);
  assert.match(told("r1"), /^Artifact “A” \(url pabcdefghij, version 3; writer: the owner\)\. Versions: \[\{"version":1\},\{"version":2\}\]\n<p>live<\/p>$/);
  assert.equal(cards.length, 1, "only the delete asked, despite the allow rule");
  assert.match(cards[0].what, /^Delete the artifact “A” \(pabcdefghij\) permanently/);
  assert.match(told("d1"), /^Deleted/);
});

/** A fake MCP server with resources in folders, a binary one, and a tool list that changes. */
function resourceServer() {
  let tools = [{ name: "a", inputSchema: { type: "object" } }, { name: "b", inputSchema: { type: "object" } }];
  const resources = [{ uri: "file:///docs/readme.md", name: "readme", mimeType: "text/markdown" }, { uri: "file:///docs/guides/one.md", name: "one" }, { uri: "file:///docs/guides/two.md", name: "two" }, { uri: "file:///other.txt", name: "other" }, { uri: "ui://widget", name: "w" }];
  const fetchFn = async (url, init = {}) => {
    const msg = JSON.parse(init.body);
    if (!("id" in msg)) return new Response(null, { status: 202 });
    const result = msg.method === "initialize" ? { protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {} }, serverInfo: { name: "fake", version: "1" } }
      : msg.method === "tools/list" ? { tools }
      : msg.method === "resources/list" ? { resources }
      : msg.method === "resources/read" ? { contents: [{ uri: msg.params.uri, mimeType: "image/png", blob: Buffer.from("PNGDATA").toString("base64") }] }
      : null;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }), { headers: { "content-type": "application/json", "mcp-session-id": "s1" } });
  };
  return { fetchFn, setTools: (t) => { tools = t; } };
}

test("CR13 the Worker's ReadMcpResourceDirTool (direct children, subfolders as inode/directory), a read's binary content handed back to be saved, and RefreshMcpTools (refreshed with added and removed, not_connected while signing in)", async () => {
  const b = memBucket(), s = resourceServer();
  await MCP.addConnector(KEY, b, "u1", { name: "Files", url: "https://mcp.example.com/mcp", fetchFn: s.fetchFn });
  const dir = await MCP.resourceCall(KEY, b, "u1", {}, { op: "dir", server: "Files", uri: "file:///docs" }, { fetchFn: s.fetchFn });
  assert.deepEqual(dir.resources, [{ uri: "file:///docs/readme.md", name: "readme", mimeType: "text/markdown" }, { uri: "file:///docs/guides/", name: "guides", mimeType: "inode/directory" }]);
  assert.deepEqual((await MCP.resourceCall(KEY, b, "u1", {}, { op: "dir", server: "Files", uri: "file:///docs/guides/" }, { fetchFn: s.fetchFn })).resources.map((x) => x.name), ["one", "two"]);
  const read = await MCP.resourceCall(KEY, b, "u1", {}, { op: "read", server: "Files", uri: "file:///p.png" }, { fetchFn: s.fetchFn });
  assert.deepEqual(read.contents, [{ uri: "file:///p.png", mimeType: "image/png", blobBytes: 7, blob: Buffer.from("PNGDATA").toString("base64") }]);
  s.setTools([{ name: "a", inputSchema: { type: "object" } }, { name: "c", inputSchema: { type: "object" } }]);
  const now = Date.now() + 5000;
  const ref = await MCP.resourceCall(KEY, b, "u1", {}, { op: "refresh" }, { fetchFn: s.fetchFn, now });
  assert.deepEqual(ref.servers, [{ server: "Files", status: "refreshed", toolCount: 2, added: ["c"], removed: ["b"] }]);
  assert.match((await MCP.resourceCall(KEY, b, "u1", {}, { op: "refresh", server: "Nope" }, { fetchFn: s.fetchFn })).error, /Server "Nope" not found\. Available servers: Files/);
  const list = await MCP.readConnectors(b, "u1");
  list[0].status = "auth";
  await b.put(MCP.listKey("u1"), JSON.stringify(list));
  assert.deepEqual((await MCP.resourceCall(KEY, b, "u1", {}, { op: "refresh" }, { fetchFn: s.fetchFn })).servers.map((x) => x.status), ["not_connected"]);
});

test("CR14 the loop's resource dir, refresh and binary read: Claude Code's result shapes; the binary content saved into the chat's uploads folder (blobSavedTo)", async () => {
  const saved = [];
  const envApi = async (q) => {
    if (q.op === "dir") return { ok: true, server: "Files", resources: [{ uri: "file:///docs/guides/", name: "guides", mimeType: "inode/directory" }] };
    if (q.op === "read") return { ok: true, server: "Files", contents: [{ uri: "file:///p.png", mimeType: "image/png", blobBytes: 7, blob: "UE5HREFUQQ==" }] };
    if (q.op === "refresh") return { ok: true, servers: [{ server: "Files", status: "refreshed", toolCount: 2, added: ["c"], removed: ["b"] }] };
    return { error: "error: ?" };
  };
  const more = { mcp: async () => ({ ok: true, body: "" }), exec: async (x) => { const q = toolReq(x.command) || (x.payload ? JSON.parse(x.payload) : null); if (q && q.tool === "save_upload") { saved.push(q.args); return { code: 0, output: ".coder-files/" + q.args.name + "\n" }; } return { code: 0, output: "" }; } };
  const { told, seen } = await run([say("", [call("read_mcp_resource_dir", { server: "Files", uri: "file:///docs" }, "d1"), call("read_mcp_resource", { server: "Files", uri: "file:///p.png" }, "r1"), call("refresh_mcp_tools", {}, "f1")]), say("done")], { envApi, msg: { refreshTools: true }, more });
  assert.ok(names(seen[0]).includes("read_mcp_resource_dir") && names(seen[0]).includes("refresh_mcp_tools"));
  assert.match(told("d1"), /"mimeType": "inode\/directory"/);
  assert.deepEqual(saved, [{ name: "mcp-Files-p.png", data: "UE5HREFUQQ==" }]);
  assert.match(told("r1"), /"blobSavedTo": "\.coder-files\/mcp-Files-p\.png"/);
  assert.match(told("r1"), /Binary content \(image\/png, 7 bytes\) saved to \.coder-files\/mcp-Files-p\.png/);
  assert.match(told("f1"), /"status": "refreshed"[\s\S]*"added": \[\n\s*"c"\n\s*\]/);
  assert.equal(H.ccTool("refresh_mcp_tools"), "RefreshMcpTools");
});
