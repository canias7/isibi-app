// CLAUDE CODE'S WEBFETCH IN CODER'S web_fetch (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"):
// Claude Code's tools reference ("WebFetch tool behavior") and its 2.1.323 program where the docs say nothing: its input
// check, its settings, its pre-approved documentation sites and rule matching, its URL checks and redirects, its page as
// Markdown (Turndown's, with Claude Code's own rules: the expected Markdown below is what Claude Code's own Turndown made of
// the same HTML), its fetch (local test servers only, never a real site), its texts, its page cache and its page reader.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";

const W = await import("../container/coder-webfetch.mjs");
const A = await import("../container/coder-agent.mjs");
const T = await import("../container/coder-tools.mjs");
const H = await import("../container/coder-hooks.mjs");
const P = await import("../container/coder-perms.mjs");
const C = await import("../container/coder-checker.mjs");
const I = await import("../container/coder-inputs.mjs");
const TOOLS_SCRIPT = new URL("../container/coder-tools.mjs", import.meta.url).pathname;

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** What Coder's tools script prints for a page (FACTS_MARK, then the page's text). */
const pageOut = (text, f = {}) => T.printedAnswer({ text, facts: { kind: "page", bytes: Buffer.byteLength(text), code: 200, codeText: "OK", contentType: "text/html; charset=utf-8", cacheBytes: Buffer.byteLength(text), binary: false, ...f } });
const isReader = (req) => Array.isArray(req.messages) && req.messages[0] && req.messages[0].content === A.PAGE_READER;
const NOT_QUOTES = "Provide a concise response based only on the content above. In your response:\n - Enforce a strict 125-character maximum for quotes from any source document. Open Source Software is ok as long as we respect the license.\n - Use quotation marks for exact language from articles; any language outside of the quotation should never be word-for-word the same.\n - You are not a lawyer and never comment on the legality of your own prompts and responses.\n - Never produce or reproduce exact song lyrics.";
const DOCS_RULES = "Provide a concise response based on the content above. Include relevant details, code examples, and documentation excerpts as needed.";

/** Coder's loop with a scripted Grok, a stand-in tools script and page reader, and hooks run as Coder runs them. */
async function loop(steps, { tools = {}, hooks = {}, hookRun = () => ({}), mode = "auto", reader = async () => ({ message: { role: "assistant", content: "read" }, usage: { in: 2, out: 1 } }), deps = {} } = {}) {
  const events = [], seen = [], reads = [], hookCalls = [], execs = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { if (isReader(req)) { reads.push(req); return reader(req); } seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, x });
        const a = (await hookRun(input, x)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        execs.push({ req, x });
        const f = tools[req.tool];
        if (!f) return { code: 0, output: "" };
        const out = await f(req.args, x);
        return typeof out === "string" ? { code: 0, output: out } : out;
      }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-wf-" + Math.random().toString(36).slice(2, 8), where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async () => ({ choice: "yes" }),
    ...deps,
  }, { text: "go", mode, messages: [], hooks: H.hooksFrom({ hooks }, "settings").list });
  return { r, events, seen, reads, hookCalls, execs };
}
const toolMsg = (t, id) => t.r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;

// ── Local test servers (no real site is ever fetched) ─────────────────────────
async function server(handler) {
  const seen = [];
  const s = http.createServer((req, res) => { seen.push({ url: req.url, headers: req.headers }); res.on("error", () => {}); req.socket.on("error", () => {}); handler(req, res); });
  await new Promise((ok) => s.listen(0, "127.0.0.1", ok));
  return { port: s.address().port, seen, server: s, close: () => new Promise((ok) => { s.closeAllConnections(); s.close(() => ok()); }) };
}
/** Every name reaches the test server (a stand-in for DNS). */
const toLoopback = (host, opts, cb) => { if (typeof opts === "function") { cb = opts; opts = {}; } if (opts && opts.all) cb(null, [{ address: "127.0.0.1", family: 4 }]); else cb(null, "127.0.0.1", 4); };
/** fetchPage's request, sent to the plain-http test server (fetchPage itself asks for https: Claude Code upgrades http). */
const viaLocal = (asked) => (url, o) => { asked.push(url); const u = new URL(url); u.protocol = "http:"; return W.requestOnce(u.toString(), { ...o, lookup: toLoopback }); };
/** Writes `total` bytes, as the reader takes them. */
function pump(res, total, chunk = Buffer.alloc(65536, 120)) {
  let sent = 0;
  const go = () => { while (sent < total) { sent += chunk.length; if (!res.write(chunk)) { res.once("drain", go); return; } } res.end(); };
  go();
}

test("WF1 the input, checked as Claude Code checks it before any hook: its schema's words, three stray fields left out, a number in a string taken, the URL trimmed, and the tool turned off", () => {
  assert.equal(I.inputCheckFor("web_fetch"), W.checkInput);
  const head = "error: InputValidationError: web_fetch failed due to the following ";
  assert.deepEqual(W.checkInput({}), { error: head + "issues:\nThe required parameter `url` is missing\nThe required parameter `prompt` is missing" });
  assert.deepEqual(W.checkInput({ url: 5, prompt: ["x"], extra: 1 }), { error: head + "issues:\nAn unexpected parameter `extra` was provided\nThe parameter `url` type is expected as `string` but provided as `number`\nThe parameter `prompt` type is expected as `string` but provided as `array`" });
  assert.deepEqual(W.checkInput({ url: "not a url", prompt: "p" }), { error: head + "issue:\nThe parameter `url` is invalid: Invalid URL" });
  assert.deepEqual(W.checkInput({ url: "https://a.example", prompt: "p", offset: -1 }), { error: head + "issue:\nThe parameter `offset` is invalid: Too small: expected number to be >=0" });
  assert.deepEqual(W.checkInput({ url: "https://a.example", prompt: "p", offset: 1.5 }), { error: head + "issue:\nThe parameter `offset` type is expected as `int` but provided as `number`" });
  assert.deepEqual(W.checkInput({ url: "https://a.example", prompt: "p", offset: "abc" }), { error: head + "issue:\nThe parameter `offset` type is expected as `number` but provided as `string`" });
  // (2.1.292: "WebFetch … ignore a few stray parameters instead of failing the call".)
  assert.deepEqual(W.checkInput({ url: "  https://a.example/x  ", prompt: "p", text_content_token_limit: 5, html_extraction_method: "x", web_fetch_pdf_extract_text: true }), { args: { url: "https://a.example/x", prompt: "p" } });
  assert.deepEqual(W.checkInput({ url: "https://a.example/x", prompt: "p", offset: " 120 " }), { args: { url: "https://a.example/x", prompt: "p", offset: 120 } });
  assert.deepEqual(W.checkInput({ url: "https://a.example/x", prompt: "p", offset: null }), { args: { url: "https://a.example/x", prompt: "p" } }, "Grok's null for a field it leaves out");
  assert.deepEqual(W.checkInput({ url: "https://a.example/x", prompt: "p", offset: 0 }), { args: { url: "https://a.example/x", prompt: "p", offset: 0 } });
  // (Turned off: Claude Code's words, with the name the owner set.)
  assert.deepEqual(W.checkInput({ url: "https://a.example/x", prompt: "p" }, { webFetchOff: "CLAUDE_CODE_DISABLE_WEB_FETCH" }), { error: "error: WebFetch is turned off by CLAUDE_CODE_DISABLE_WEB_FETCH." });
});

test("WF2 Claude Code's three settings under Coder's names (a repository's CLAUDE_CODE_ ones mapped to them): off, the cache's time and the deadline, plain digits only", () => {
  assert.deepEqual(W.webFetchSettings({}), { off: "", cacheTtlMs: 900000, deadlineMs: 300000 });
  assert.equal(W.webFetchSettings({ CODER_DISABLE_WEB_FETCH: "1" }).off, "CODER_DISABLE_WEB_FETCH");
  assert.equal(W.webFetchSettings({ CODER_DISABLE_WEB_FETCH: "true" }, () => "CLAUDE_CODE_DISABLE_WEB_FETCH").off, "CLAUDE_CODE_DISABLE_WEB_FETCH");
  assert.equal(W.webFetchSettings({ CODER_DISABLE_WEB_FETCH: "0" }).off, "");
  for (const [v, want] of [["60000", 60000], ["0", 900000], ["1.5", 900000], [" 60000", 900000], ["abc", 900000]]) assert.equal(W.webFetchSettings({ CODER_WEBFETCH_CACHE_TTL_MS: v }).cacheTtlMs, want, v);
  for (const [v, want] of [["0", 0], ["1000", 1000], ["99999999999", 2147483647], ["-1", 300000], ["5s", 300000]]) assert.equal(W.webFetchSettings({ CODER_WEBFETCH_DEADLINE_MS: v }).deadlineMs, want, v);
  // The machine: a repository's CLAUDE_CODE_ names mapped like the others (REPO_OWN_ENV), the chat's settings in each job's deps.
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /CLAUDE_CODE_DISABLE_WEB_FETCH: "CODER_DISABLE_WEB_FETCH", CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS: "CODER_WEBFETCH_CACHE_TTL_MS", CLAUDE_CODE_WEBFETCH_DEADLINE_MS: "CODER_WEBFETCH_DEADLINE_MS"/);
  assert.match(src, /\n\s+webFetch: webFetchSettings\(rawVars, \(n\) => \(fromRepo\(n\) \? REPO_OWN_FROM\[n\] : n\)\),\n/);
});

test("WF3 the tool as Grok sees it: Claude Code's short description and parameters (offset included), Coder's tool names; Gloopy and its helpers get the same tool", async () => {
  const wf = A.CODER_TOOLS.find((t) => t.function.name === "web_fetch").function;
  assert.equal(wf.description, "Fetches a URL, converts the page to markdown, and answers `prompt` against it using a separate model.\n\n- Fails on authenticated/private URLs — use an authenticated MCP tool or `gh` for those instead.\n- Fails on localhost and other hostnames without a dot; for a local server, use curl via bash.\n- HTTP is upgraded to HTTPS. Cross-host redirects are returned to you rather than followed; call again with the redirect URL.\n- Responses are cached for 15 minutes per URL.");
  assert.deepEqual(wf.parameters.properties, {
    url: { type: "string", format: "uri", description: "The URL to fetch content from" },
    prompt: { type: "string", description: "The prompt to run on the fetched content" },
    offset: { type: "integer", minimum: 0, description: "Character position in the page text to start reading from. Use it to read on through a page too long for one call, with the value the previous result gave." },
  });
  assert.deepEqual(wf.parameters.required, ["url", "prompt"]);
  assert.doesNotMatch(wf.description, /claude\.ai|artifact|WebFetch|Bash/, "no artifact sentence; Coder's tool names");
  // (The cache's own time in the description: Claude Code's "at least 1" minute.)
  assert.match(W.webFetchDescription(60000), /Responses are cached for 1 minute per URL\.$/);
  assert.match(W.webFetchDescription(30000), /Responses are cached for 1 minute per URL\.$/);
  assert.match(W.webFetchDescription(7_200_000), /Responses are cached for 120 minutes per URL\.$/);
  const list = [{ type: "function", function: { name: "read", description: "r" } }, { type: "function", function: wf }];
  assert.equal(A.webFetchTools(list, { cacheTtlMs: 900000 }), list, "the default: the same list");
  assert.deepEqual(A.webFetchTools(list, { off: "CODER_DISABLE_WEB_FETCH" }).map((t) => t.function.name), ["read"]);
  assert.match(A.webFetchTools(list, { cacheTtlMs: 120000 })[1].function.description, /cached for 2 minutes per URL\.$/);
  const G = await import("../container/gloopy-agent.mjs");
  assert.equal(G.GLOOPY_TOOLS.find((t) => t.function.name === "web_fetch").function, wf);
  assert.equal(G.HELPER_TOOLS.find((t) => t.function.name === "web_fetch").function, wf);
});

test("WF4 Claude Code's pre-approved documentation sites (its 96; all of github.com/anthropics) and its rules' domains: `*` within a part of the name, a leading `*.` at any depth, a trailing dot dropped, any case, an exact rule before a wildcard one", () => {
  assert.equal(W.DOC_SITES.length, 96);
  for (const u of ["https://docs.python.org/3/library/json.html", "https://github.com/anthropics/claude-code/issues/1", "https://github.com/anthropics", "https://github.com/anthropic-experimental/x", "https://github.com/anthropic-experimental/x/blob/main/README.md", "https://raw.githubusercontent.com/anthropics/x/refs/heads/main/README.md", "https://go.dev/doc/install", "https://huggingface.co/docs/x"]) assert.equal(W.docSite(u), true, u);
  for (const u of ["https://github.com/anthropic-experimental/x/issues/1", "https://github.com/anthropic-experimental/x/blob/dev/a.md", "https://raw.githubusercontent.com/anthropics/x/refs/heads/dev/a.md", "https://go.dev/blog", "https://go.dev/docs", "https://huggingface.co/models", "https://github.com/anthropics/..%2f..%2fsomeone", "https://example.com", "not a url"]) assert.equal(W.docSite(u), false, u);
  const m = W.domainRuleMatches;
  assert.equal(m("domain:example.com", "example.com"), true);
  assert.equal(m("domain:Example.COM.", "example.com"), true, "any case; a trailing dot dropped");
  assert.equal(m("domain:example.com", "example.com."), true);
  assert.equal(m("domain:example.com", "www.example.com"), false);
  assert.equal(m("domain:*.example.com", "a.b.example.com"), true, "a leading *. at any depth");
  assert.equal(m("domain:*.example.com", "example.com"), false, "but not the domain itself");
  assert.equal(m("domain:example.*", "example.com"), true);
  assert.equal(m("domain:example.*", "example.evil.com"), false, "elsewhere `*` stays within one part");
  assert.equal(m("domain:api-*.example.com", "api-v2.example.com"), true);
  assert.equal(m("domain:api-*.example.com", "api-v2.x.example.com"), false);
  assert.equal(m("domain:*", "any.host.at.all"), true);
  assert.equal(m(null, "x.example"), true, "a rule on the whole tool");
  const rules = [{ text: "WebFetch(domain:*.example.com)", spec: "domain:*.example.com" }, { text: "WebFetch(domain:api.example.com)", spec: "domain:api.example.com" }];
  assert.equal(W.pickDomainRule(rules, "api.example.com").text, "WebFetch(domain:api.example.com)", "the exact rule, though listed second");
  assert.equal(W.pickDomainRule(rules, "www.example.com").text, "WebFetch(domain:*.example.com)");
  assert.equal(W.pickDomainRule(rules, "example.org"), undefined);
  // Its rule check, in its words.
  assert.equal(P.ruleProblem("WebFetch(https://example.com)"), 'WebFetch permissions use domain format, not URLs. Use "domain:hostname" format. Examples: WebFetch(domain:example.com), WebFetch(domain:github.com)');
  assert.equal(P.ruleProblem("WebFetch(example.com)"), 'WebFetch permissions must use "domain:" prefix. Use "domain:hostname" format. Examples: WebFetch(domain:example.com), WebFetch(domain:*.google.com)');
  assert.equal(P.ruleProblem("WebFetch(domain:example.com)"), "");
  assert.equal(P.ruleProblem("WebFetch"), "");
  // The decision, in Claude Code's words; an exact rule before a wildcard one.
  const f = (url, rules, mode = "acceptEdits") => P.fetchDecision(url, { mode, rules });
  assert.deepEqual(f("https://evil.example.com/x", { deny: ["WebFetch(domain:*.example.com)"] }), { verdict: "deny", rule: "WebFetch(domain:*.example.com)", why: "WebFetch denied access to domain:evil.example.com.", suggest: null });
  assert.equal(f("https://x.example/a", { deny: ["WebFetch"] }).why, "Permission to use WebFetch has been denied.");
  assert.equal(f("https://api.example.com/a", { ask: ["WebFetch(domain:*.example.com)", "WebFetch(domain:api.example.com)"] }, "auto").rule, "WebFetch(domain:api.example.com)");
  assert.equal(f("https://api.example.com/a", { ask: ["WebFetch(domain:api.example.com)"] }, "auto").why, "Coder wants to fetch content from api.example.com");
  assert.deepEqual(f("https://example.com/a", {}), { verdict: "ask", why: "Coder wants to fetch content from example.com", suggest: ["WebFetch(domain:example.com)"], host: "example.com" });
  assert.equal(f("https://github.com/anthropics/claude-code/pulls", {}).verdict, "allow", "pre-approved");
  assert.equal(f("https://a.b.example.com/x", { allow: ["WebFetch(domain:*.example.com)"] }).verdict, "allow");
  assert.equal(f("https://example.com/x", { allow: ["WebFetch(domain:*.example.com)"] }).verdict, "ask");
  assert.equal(P.ifRuleMatches("WebFetch(domain:*.example.com)", "WebFetch", { url: "https://a.b.example.com/x" }), true, "a hook's `if` matches as a rule does");
  assert.equal(P.ifRuleMatches("WebFetch(domain:*.example.com)", "WebFetch", { url: "https://example.com/x" }), false);
});

test("WF5 the URL as Claude Code takes it: at most 2,000 characters, no user name or password, a dot in the host; http upgraded to https; a redirect followed only on the same host", () => {
  assert.equal(W.urlProblem("https://example.com/x"), "");
  assert.equal(W.urlProblem("http://localhost:8080/"), "WebFetch cannot fetch localhost or other hostnames without a dot. To reach a local server, use bash with curl instead.");
  assert.equal(W.urlProblem("https://intranet/x"), W.DOTLESS_HOST);
  assert.equal(W.urlProblem("https://user:pw@example.com/"), "Invalid URL");
  assert.equal(W.urlProblem("https://example.com/" + "a".repeat(1981)), "Invalid URL", "2,001 characters");
  assert.equal(W.urlProblem("https://example.com/" + "a".repeat(1980)), "", "2,000");
  assert.equal(W.urlProblem("file:///etc/passwd"), "Invalid URL");
  assert.equal(W.urlProblem("nonsense"), "Invalid URL");
  assert.equal(W.upgradeUrl("http://example.com:8080/a?b=1#c"), "https://example.com:8080/a?b=1#c");
  assert.equal(W.upgradeUrl("https://example.com/a"), "https://example.com/a");
  const same = W.sameHostRedirect;
  assert.equal(same("https://example.com/a", "https://example.com/b"), true);
  assert.equal(same("https://example.com/a", "https://www.example.com/b"), true, "a leading www. left aside");
  assert.equal(same("https://www.example.com/a", "https://example.com/b"), true);
  assert.equal(same("https://example.com/a", "https://cdn.example.com/b"), false);
  assert.equal(same("https://example.com/a", "http://example.com/b"), false, "the same protocol");
  assert.equal(same("https://example.com:8443/a", "https://example.com/b"), false, "the same port");
  assert.equal(same("https://example.com/a", "https://u:p@example.com/b"), false);
  assert.equal(same("https://github.com/anthropics/x", "https://github.com/someone/y"), false, "not off a pre-approved path");
  assert.equal(same("https://docs.python.org/3/", "https://docs.python.org/2/"), true);
});

test("WF6 HTML as Markdown, as Claude Code's Turndown makes it (each expected text is Claude Code's own output for the same HTML): headings, links, lists, code, tables, quotes, entities; style, script, noscript and iframe removed", () => {
  const cases = [
    ['<html><head><title>My Page</title><style>p{color:red}</style><script>var x=1</script></head><body><h1>Title</h1><h2>Sub</h2><h3>Three</h3><p>Some <a href="https://a.b/c(1)" title="T">link</a> and <code>x`y</code>.</p></body></html>', 'My Page\n\nTitle\n=====\n\nSub\n---\n\n### Three\n\nSome [link](https://a.b/c\\(1\\) "T") and ``x`y``.'],
    ['<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul><ol start="3"><li>a</li><li>b</li></ol>', "*   one\n*   two\n    *   nested\n\n3.  a\n4.  b"],
    ['<pre><code class="language-js">const a = 1;\n\nfunction f() {\n  return a;\n}\n</code></pre><p>Use <code>npm i lib@4</code>.</p>', "    const a = 1;\n    \n    function f() {\n      return a;\n    }\n    \n\nUse `npm i lib@4`."],
    ["<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>a|b</td><td></td></tr><tr><td>x<br>y</td><td><code>z</code></td></tr></tbody></table>", "| Name | Value |\n\n| a\\|b |  |\n| x<br>y | `z` |"],
    ["<table><tr><td>no</td><td>header</td></tr></table><table><tr><th colspan=2>merged</th></tr><tr><td>1</td><td>2</td></tr></table>", "no\n\nheader\n\nmerged\n\n1\n\n2"],
    ["<p>* star - dash _u_ [b] 1. num</p><p>1. not a list</p><p># not heading</p>", "\\* star - dash \\_u\\_ \\[b\\] 1. num\n\n1\\. not a list\n\n\\# not heading"],
    ['<blockquote><p>q1</p><p>q2</p></blockquote><hr><img src="i.png" alt="pic" title="T"><noscript><p>ns</p></noscript><iframe src=x>if</iframe>', '> q1\n> \n> q2\n\n* * *\n\n![pic](i.png "T")'],
    ["<p>&copy; &nbsp;x &#169; &#x41; &unknown; &amp;amp;</p>", "© \u00a0x © A &unknown; &amp;"],
    ["<p><b>bold<i>both</b>it</i></p><div><p>a<div>b</div></div><ul><li>x<li>y</ul>", "**bold_both_**_it_\n\na\n\nb\n\n*   x\n*   y"],
    [Array.from({ length: 14 }, (_, k) => "<ul><li>d" + k).join("") + "</li></ul>".repeat(14), "*   d0\n    *   d1\n        *   d2\n            *   d3\n                *   d4\n                    *   d5\n                        *   d6\n                            *   d7\n                                *   d8\n                                    *   d9\n                                        *   d10\n                                            *   d11\n                                                \n                                                d12\n                                                \n                                                d13"],
  ];
  for (const [html, md] of cases) assert.equal(W.htmlToMarkdown(html), md, html.slice(0, 60));
  assert.equal(W.htmlToMarkdown(""), "");
  // Claude Code cuts the HTML at 1,048,576 characters and says so after the Markdown.
  const big = "<p>" + "a".repeat(W.WEBFETCH_HTML_MAX) + "</p>";
  const md = W.htmlToMarkdown(big);
  assert.equal(md, "a".repeat(W.WEBFETCH_HTML_MAX - 3) + "\n\n[Content truncated due to length...]");
  assert.equal(W.CONTENT_TRUNCATED, "\n\n[Content truncated due to length...]");
});

test("WF7 the fetch, against a local server: Claude Code's Accept header and Coder's own User-Agent; https asked for; the same host's redirects followed; another host's given back; a status other than 2xx given back with its Retry-After", { timeout: 20000 }, async () => {
  const s = await server((req, res) => {
    if (req.url === "/page") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end("<h1>Hi</h1><p>there</p>"); }
    if (req.url === "/r1") { res.writeHead(302, { location: "/r2" }); return res.end(); }
    if (req.url === "/r2") { res.writeHead(301, { location: "https://www.docs.example:" + s.port + "/page" }); return res.end(); }
    if (req.url === "/down") { res.writeHead(302, { location: "http://docs.example:" + s.port + "/page" }); return res.end(); }
    if (req.url === "/away") { res.writeHead(308, { location: "https://other.example/x?y=1" }); return res.end(); }
    if (req.url === "/busy") { res.writeHead(429, { "retry-after": "120", "content-type": "text/plain" }); return res.end("slow down"); }
    if (req.url === "/when") { res.writeHead(503, { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }); return res.end(); }
    if (req.url === "/gone") { res.writeHead(404); return res.end("no"); }
    if (req.url === "/noloc") { res.writeHead(302); return res.end(); }
    if (req.url === "/zip") { res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" }); return res.end(zlib.gzipSync("packed text")); }
    if (req.url === "/json") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"a":1}'); }
    res.writeHead(500); res.end();
  });
  try {
    const base = "http://docs.example:" + s.port;
    const asked = [];
    const got = await W.fetchPage({ url: base + "/page" }, { request: viaLocal(asked) });
    assert.equal(asked[0], "https://docs.example:" + s.port + "/page", "http upgraded to https");
    assert.deepEqual(got, { text: "Hi\n==\n\nthere", facts: { kind: "page", bytes: 23, code: 200, codeText: "OK", contentType: "text/html; charset=utf-8", cacheBytes: 12, binary: false } });
    assert.equal(s.seen[0].headers.accept, "text/markdown, text/html, */*");
    assert.equal(s.seen[0].headers["user-agent"], "Coder (gofarther.dev)");
    assert.equal(s.seen[0].headers["accept-encoding"], "gzip, deflate, br");
    // Redirects on the same host (a leading www. aside) followed; the page is the last one's.
    asked.length = 0;
    const via = await W.fetchPage({ url: base + "/r1" }, { request: viaLocal(asked) });
    assert.equal(via.text, "Hi\n==\n\nthere");
    assert.deepEqual(asked, ["https://docs.example:" + s.port + "/r1", "https://docs.example:" + s.port + "/r2", "https://www.docs.example:" + s.port + "/page"]);
    // Another host: given back, not followed.
    asked.length = 0;
    assert.deepEqual(await W.fetchPage({ url: base + "/away" }, { request: viaLocal(asked) }), { text: "", facts: { kind: "redirect", originalUrl: "https://docs.example:" + s.port + "/away", redirectUrl: "https://other.example/x?y=1", statusCode: 308 } });
    assert.equal(asked.length, 1);
    // (From https to http on the same host: not the same protocol, so given back too.)
    assert.equal((await W.fetchPage({ url: base + "/down" }, { request: viaLocal([]) })).facts.redirectUrl, "http://docs.example:" + s.port + "/page");
    // A status other than 2xx: given back with a Retry-After in seconds; the body is not read.
    assert.deepEqual((await W.fetchPage({ url: base + "/busy" }, { request: viaLocal([]) })).facts, { kind: "http_error", statusCode: 429, retryAfter: "120" });
    assert.deepEqual((await W.fetchPage({ url: base + "/when" }, { request: viaLocal([]) })).facts, { kind: "http_error", statusCode: 503 });
    assert.deepEqual((await W.fetchPage({ url: base + "/gone" }, { request: viaLocal([]) })).facts, { kind: "http_error", statusCode: 404 });
    assert.deepEqual((await W.fetchPage({ url: base + "/noloc" }, { request: viaLocal([]) })).facts, { kind: "http_error", statusCode: 302 });
    // A compressed page, unpacked; text other than HTML as it came.
    assert.equal((await W.fetchPage({ url: base + "/zip" }, { request: viaLocal([]) })).text, "packed text");
    assert.equal((await W.fetchPage({ url: base + "/json" }, { request: viaLocal([]) })).text, '{"a":1}');
    // Coder's tools script runs the same fetch (a test's stand-in for the network).
    assert.equal((await T.toolWebFetch({ url: base + "/page" }, viaLocal([]))).text, "Hi\n==\n\nthere");
  } finally { await s.close(); }
});

test("WF8 never more than 10 redirects (Claude Code: \"Too many redirects (exceeded 10)\"), never more than 10 MB (a page past 2 MB no longer hangs), never waiting past the deadline, and never left waiting on a broken answer", { timeout: 30000 }, async () => {
  let hops = 0;
  const s = await server((req, res) => {
    const m = /^\/loop\/(\d+)$/.exec(req.url);
    if (m) { hops++; res.writeHead(302, { location: "/loop/" + (Number(m[1]) + 1) }); return res.end(); }
    if (req.url === "/three-mb") { res.writeHead(200, { "content-type": "text/plain" }); return pump(res, 3 * 1024 * 1024); }
    if (req.url === "/eleven-mb") { res.writeHead(200, { "content-type": "text/plain" }); return pump(res, 11 * 1024 * 1024); }
    if (req.url === "/bomb") { res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" }); return res.end(zlib.gzipSync(Buffer.alloc(12 * 1024 * 1024))); }
    if (req.url === "/cut") { res.writeHead(200, { "content-type": "text/plain", "content-length": "1000" }); res.write("only part"); return setTimeout(() => req.socket.destroy(), 50); }
    if (req.url === "/hang") return; // (never answers)
    if (req.url === "/then-hang") { res.writeHead(301, { location: "/hang" }); return res.end(); }
    res.writeHead(200, { "content-type": "text/plain" }); res.end("ok");
  });
  try {
    const base = "http://docs.example:" + s.port;
    await assert.rejects(W.fetchPage({ url: base + "/loop/0" }, { request: viaLocal([]) }), (e) => e.message === "Too many redirects (exceeded 10)");
    assert.equal(hops, 11, "the first request and its 10 redirects; the 11th redirect is refused");
    // A 3 MB page comes whole (Coder's old fetch hung past 2 MB).
    const three = await W.fetchPage({ url: base + "/three-mb" }, { request: viaLocal([]) });
    assert.equal(three.text.length, 3 * 1024 * 1024);
    assert.equal(three.facts.bytes, 3 * 1024 * 1024);
    // Past 10,485,760 bytes, Claude Code's (axios's) words; unpacked bytes count.
    await assert.rejects(W.fetchPage({ url: base + "/eleven-mb" }, { request: viaLocal([]) }), (e) => e.message === "maxContentLength size of 10485760 exceeded");
    await assert.rejects(W.fetchPage({ url: base + "/bomb" }, { request: viaLocal([]) }), (e) => e.message === "maxContentLength size of 10485760 exceeded");
    await assert.rejects(W.requestOnce(base.replace("docs.example", "127.0.0.1") + "/cut"), /aborted/);
    // The deadline covers the whole download, redirects included (Claude Code: "Fetch did not complete within the 300s deadline").
    const t0 = Date.now();
    await assert.rejects(W.fetchPage({ url: base + "/then-hang", deadline_ms: 300 }, { request: viaLocal([]) }), (e) => e.message === "Fetch did not complete within the 0.3s deadline");
    assert.ok(Date.now() - t0 < 5000);
    assert.equal(W.DEADLINE_HIT(300000), "Fetch did not complete within the 300s deadline");
    // Each request: 60 seconds with nothing from the server (axios's words).
    assert.equal(W.WEBFETCH_REQUEST_MS, 60000);
    assert.equal(W.REQUEST_TIMEOUT(60000), "timeout of 60000ms exceeded");
    assert.match(readFileSync(new URL("../container/coder-webfetch.mjs", import.meta.url), "utf8"), /req\.setTimeout\(WEBFETCH_REQUEST_MS, \(\) => fail\(requestError\(REQUEST_TIMEOUT\(WEBFETCH_REQUEST_MS\), "ECONNABORTED"\)\)\);/);
    // A host that does not resolve: Claude Code's words for its cloud sessions.
    await assert.rejects(W.fetchPage({ url: "https://nowhere.example/x" }, { request: async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND nowhere.example"), { code: "ENOTFOUND" }); } }), (e) => e.message === W.NOT_RESOLVED("getaddrinfo ENOTFOUND nowhere.example", "nowhere.example") && /has to be allowed in the session's network settings/.test(e.message));
  } finally { await s.close(); }
});

test("WF9 never a private address (Coder's own refusal, kept), nor a host without a dot; a host the chat's network list blocks, in Claude Code's words (its egress proxy's)", { timeout: 20000 }, async () => {
  const none = async () => { throw new Error("must not fetch"); };
  await assert.rejects(T.toolWebFetch({ url: "https://10.1.2.3/x" }, none), (e) => e.message === "that address is on a private network");
  await assert.rejects(T.toolWebFetch({ url: "http://169.254.169.254/latest/meta-data" }, none), (e) => e.message === "that address is on a private network");
  // (Claude Code reads an IPv6 address as a host without a dot.)
  await assert.rejects(T.toolWebFetch({ url: "http://[::1]:8080/x" }, none), (e) => e.message === W.DOTLESS_HOST);
  await assert.rejects(T.toolWebFetch({ url: "http://localhost:3000/" }, none), (e) => e.message === W.DOTLESS_HOST);
  // A name whose address is private, refused as it connects (Coder's lookup).
  const s = await server((req, res) => { res.writeHead(200); res.end("secret"); });
  try {
    const priv = (h, o, cb) => cb(Object.assign(new Error("that address is on a private network"), { code: "EPRIVATE" }));
    await assert.rejects(W.requestOnce("http://inside.example:" + s.port + "/", { lookup: priv }), (e) => e.message === "that address is on a private network");
  } finally { await s.close(); }
  // Coder's network gate answers a CONNECT for a host off the list with 403 and its reason.
  const gate = http.createServer();
  const reasons = { "blocked.example:443": ["403 Forbidden", "x-deny-reason: host_not_allowed"], "private.example:443": ["403 Forbidden", "x-deny-reason: private_dest_ip"], "down.example:443": ["502 Bad Gateway", "x-other: 1"] };
  const connects = [];
  gate.on("connect", (req, sock) => { connects.push(req.url); const [st, h] = reasons[req.url] || ["403 Forbidden", "x-deny-reason: host_not_allowed"]; sock.end("HTTP/1.1 " + st + "\r\n" + h + "\r\ncontent-length: 0\r\n\r\n"); });
  await new Promise((ok) => gate.listen(0, "127.0.0.1", ok));
  const proxy = "http://127.0.0.1:" + gate.address().port;
  try {
    await assert.rejects(W.requestOnce("https://blocked.example/x", { proxy }), (e) => e.message === '{"error_type":"EGRESS_BLOCKED","domain":"blocked.example","message":"Access to blocked.example is blocked by the network egress proxy."}');
    await assert.rejects(W.requestOnce("https://private.example/x", { proxy }), (e) => e.message === "that address is on a private network");
    await assert.rejects(W.requestOnce("https://down.example/x", { proxy }), (e) => e.message === "the proxy refused down.example");
    assert.deepEqual(connects, ["blocked.example:443", "private.example:443", "down.example:443"]);
    // Coder's tools script, as the agent runs it, with the chat's network list on: the same words, as a failed call.
    const b64 = Buffer.from(JSON.stringify({ tool: "web_fetch", args: { url: "http://blocked.example/x", deadline_ms: 20000 } })).toString("base64");
    const out = await new Promise((ok) => execFile(process.execPath, ["--no-warnings", TOOLS_SCRIPT, b64], { env: { ...process.env, CODER_NET_LIMITED: "1", HTTPS_PROXY: proxy }, encoding: "utf8" }, (err, stdout) => ok({ code: err ? err.code : 0, stdout })));
    assert.deepEqual(out, { code: 1, stdout: 'error: {"error_type":"EGRESS_BLOCKED","domain":"blocked.example","message":"Access to blocked.example is blocked by the network egress proxy."}' });
  } finally { gate.closeAllConnections(); await new Promise((ok) => gate.close(ok)); }
  // A 403 from the gate itself for a plain request: the same words.
  await assert.rejects(W.fetchPage({ url: "https://blocked2.example/x" }, { request: async () => ({ status: 403, statusText: "Forbidden", headers: { "x-deny-reason": "host_not_allowed" }, body: null }) }), (e) => JSON.parse(e.message).domain === "blocked2.example");
});

test("WF10 a binary page, also saved to the scratch folder with Claude Code's note (\"[Binary content (…) also saved to …]\"); its kinds and sizes as Claude Code names them", { timeout: 20000 }, async () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2039, 7)]);
  const s = await server((req, res) => { res.writeHead(200, { "content-type": "application/pdf" }); res.end(pdf); });
  const scratch = await mkdtemp(join(tmpdir(), "wf-scratch-"));
  try {
    const got = await W.fetchPage({ url: "http://files.example:" + s.port + "/a.pdf" }, { request: viaLocal([]), scratch, now: () => 1234 });
    assert.equal(got.facts.binary, true);
    assert.ok(got.facts.persistedPath.startsWith(scratch + "/webfetch-1234-"));
    assert.match(got.facts.persistedPath.slice(scratch.length), /^\/webfetch-1234-[a-z0-9]+\.pdf$/);
    assert.equal(got.facts.persistedSize, 2048);
    assert.deepEqual(await readFile(got.facts.persistedPath), pdf);
    assert.deepEqual(await readdir(scratch), [got.facts.persistedPath.slice(scratch.length + 1)]);
  } finally { await s.close(); await rm(scratch, { recursive: true, force: true }); }
  assert.equal(W.binaryNote("application/pdf", 2048, "/tmp/coder-scratch/webfetch-1-abc.pdf"), "\n\n[Binary content (application/pdf, 2KB) also saved to /tmp/coder-scratch/webfetch-1-abc.pdf]");
  assert.equal(W.binaryNote("", 10, "/x.bin"), "\n\n[Binary content (unknown content type, 10 bytes) also saved to /x.bin]");
  for (const [t, b] of [["text/html", false], ["application/json", false], ["application/ld+json", false], ["application/xml", false], ["image/svg+xml", false], ["application/javascript", false], ["application/x-www-form-urlencoded", false], ["application/pdf", true], ["image/png", true], ["application/octet-stream", true], ["", false]]) assert.equal(W.binaryType(t), b, t);
  assert.deepEqual([W.sizeShown(512), W.sizeShown(1536), W.sizeShown(60000), W.sizeShown(2 * 1024 * 1024), W.sizeShown(5 * 1024 ** 3)], ["512 bytes", "1.5KB", "58.6KB", "2MB", "5GB"]);
});

test("WF11 what Coder is told, Claude Code's own texts: a redirect to another host (its target relayed up to 1,000 characters), a status other than 2xx, reading on, a result over 50,000 characters", () => {
  assert.equal(W.redirectText({ originalUrl: "https://a.example/x", redirectUrl: "https://b.example/y?q=1", statusCode: 301 }, { prompt: "the price" }), "REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.\n\n    Original URL: https://a.example/x\n    Redirect URL (from the server's Location header — server-supplied, not verified): https://b.example/y?q=1\n    Status: 301 Moved Permanently\n\n    To complete your request, I need to fetch content from the redirected URL. Please use web_fetch again with these parameters:\n    - url: \"https://b.example/y?q=1\"\n    - prompt: \"the price\"");
  assert.match(W.redirectText({ originalUrl: "https://a.example/x", redirectUrl: "https://b.example/y", statusCode: 302 }, { prompt: "p", offset: 500 }), /\n {4}Status: 302 Found\n[\s\S]*\n {4}- prompt: "p"\n {4}- offset: 500$/);
  const long = W.redirectText({ originalUrl: "https://a.example/x", redirectUrl: "https://b.example/" + "a".repeat(1200), statusCode: 307 }, { prompt: "p" });
  assert.match(long, /: https:\/\/b\.example\/a{982} \[…218 more characters withheld: too long to relay\]\n/);
  assert.match(long, /The redirect target could not be relayed in full or is not a fetchable address, so it cannot be fetched from here; report the redirect instead\.$/);
  assert.match(W.redirectText({ originalUrl: "https://a.example/x", redirectUrl: "ftp://b.example/y", statusCode: 301 }, {}), /\n {4}Redirect URL: \(withheld — the server sent a redirect target that is not a valid http\(s\) URL\)\n/);
  assert.equal(W.httpErrorText({ statusCode: 429, retryAfter: "120" }), "The server returned HTTP 429 Too Many Requests.\nRetry-After: 120\n\nThe response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of web_fetch.");
  assert.equal(W.httpErrorText({ statusCode: 404 }), "The server returned HTTP 404 Not Found.\n\nThe response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of web_fetch.");
  assert.equal(W.statusText(599), "Unknown Status");
  assert.equal(W.pastEndText(300000, 250000), "Nothing left to read from offset 300000: this page's text is 250000 characters long.");
  assert.equal(W.leadText(100000, 250000), "The content below is one part of a longer page: it starts 100000 characters into the page's 250000.\n");
  assert.equal(W.readOnNote(0, 100000, 250000), "\n\n[WebFetch note: this page's text is 250000 characters long and the answer above covers only characters 0 to 100000; the final 150000 were not read — to read on, call web_fetch again with the same url and offset: 100000.]");
  const persisted = W.persistedText("x".repeat(60000), "/out/a.txt");
  assert.equal(persisted, "<persisted-output>\nOutput too large (58.6KB). Full output saved to: /out/a.txt\n\nPreview (first 2KB):\n" + "x".repeat(2000) + "\n...\n</persisted-output>");
  // (The preview ends at the last line break past its first 1,000 characters.)
  assert.match(W.persistedText("a".repeat(1500) + "\n" + "b".repeat(60000), "/f"), /\nPreview \(first 2KB\):\na{1500}\n\.\.\.\n<\/persisted-output>$/);
  // A pair of surrogates is never split.
  assert.equal(W.firstChars("ab😀", 3), "ab");
  assert.equal(W.fromOffset("ab😀c", 3), "c");
  assert.equal(W.fromOffset("abc", 5), "");
});

test("WF12 the page reader's message: Claude Code's own prompt (the page between --- lines, Coder's prompt, then its rules: for a documentation site its own, else its rules on quotes), the page's first 100,000 characters; Coder's line against a page's instructions kept beside it", async () => {
  assert.equal(W.readerMessage("PAGE", "the install command"), "\nWeb page content:\n---\nPAGE\n---\n\nthe install command\n\n" + NOT_QUOTES + "\n");
  assert.equal(W.readerMessage("PAGE", "p", true), "\nWeb page content:\n---\nPAGE\n---\n\np\n\n" + DOCS_RULES + "\n");
  assert.equal(W.readerMessage("x".repeat(100_001), "p"), "\nWeb page content:\n---\n" + "x".repeat(100_000) + "\n\n[Content truncated due to length...]\n---\n\np\n\n" + NOT_QUOTES + "\n");
  const sent = [];
  const deps = { send: async (req) => { sent.push(req); return { message: { role: "assistant", content: "answer" }, usage: { in: 9, out: 2 } }; } };
  assert.deepEqual(await A.readPage(deps, { model: "grok-4.7", prompt: "p", content: "PAGE", lead: "LEAD\n" }), { ok: true, text: "answer", usage: { in: 9, out: 2 } });
  assert.deepEqual(sent[0], { model: "grok-4.7", effort: "low", webSearch: false, tools: [], messages: [{ role: "system", content: A.PAGE_READER }, { role: "user", content: "LEAD\n" + W.readerMessage("PAGE", "p") }] });
  // Claude Code: an answer with no text is a failed call; so is a reader that fails.
  assert.deepEqual(await A.readPage({ send: async () => ({ message: { content: "  \n" } }) }, { prompt: "p", content: "x" }), { ok: false, error: "error: The model that reads the content gave no answer. Trying again may work.", usage: undefined });
  assert.deepEqual(await A.readPage({ send: async () => { throw new Error("model down"); } }, { prompt: "p", content: "x" }), { ok: false, error: "error: model down" });
});

test("WF13 one call: the page cache (per chat and URL, its own time, the page fetched once and read on every call), the result object for the hooks, and pages too long for one read (offset)", async () => {
  const PAGE = "abcdefghij".repeat(25_000); // 250,000 characters
  let execs = 0;
  const reads = [];
  let t = 1_000_000;
  const deps = {
    exec: async (x) => { execs++; deps.lastExec = x; return { code: 0, output: pageOut(PAGE, { contentType: "text/plain", bytes: 250000, cacheBytes: 250000 }) }; },
    send: async (req) => { reads.push(req.messages[1].content); return { message: { role: "assistant", content: "ANSWER" }, usage: { in: 1, out: 1 } }; },
  };
  const run = (args, chat = "chat:a", settings = { cacheTtlMs: 60000, deadlineMs: 300000 }) => A.webFetchRun(deps, { model: "m", args: { url: "https://long.example/doc", prompt: "p", ...args }, chat, settings, now: () => t });
  let r = await run({});
  assert.equal(execs, 1);
  assert.deepEqual(JSON.parse(Buffer.from(deps.lastExec.command.split(" ").pop(), "base64").toString()), { tool: "web_fetch", args: { url: "https://long.example/doc", deadline_ms: 300000 } });
  assert.deepEqual([deps.lastExec.timeoutS, deps.lastExec.tool, deps.lastExec.here], [330, true, true], "the tools script's time covers the deadline");
  assert.equal(reads[0], "\nWeb page content:\n---\n" + PAGE.slice(0, 100000) + "\n\n[Content truncated due to length...]\n---\n\np\n\n" + NOT_QUOTES + "\n");
  assert.equal(r.out, "ANSWER" + W.readOnNote(0, 100000, 250000));
  assert.deepEqual(r.facts, { bytes: 250000, code: 200, codeText: "OK", result: r.out, durationMs: 0, url: "https://long.example/doc" });
  assert.deepEqual(r.usage, { in: 1, out: 1 });
  // Read on, from the cache: Claude Code's opening for one part of a longer page, and its note while the page goes on.
  r = await run({ offset: 100000 });
  assert.equal(execs, 1, "fetched once");
  assert.ok(reads[1].startsWith(W.leadText(100000, 250000) + "\nWeb page content:\n---\n" + PAGE.slice(100000, 200000) + "\n\n[Content truncated"));
  assert.equal(r.out, "ANSWER" + W.readOnNote(100000, 200000, 250000));
  r = await run({ offset: 200000 });
  assert.equal(r.out, "ANSWER", "the rest read: no note");
  assert.ok(reads[2].includes("\n---\n" + PAGE.slice(200000) + "\n---\n"));
  r = await run({ offset: 250000 });
  assert.equal(r.out, "Nothing left to read from offset 250000: this page's text is 250000 characters long.");
  assert.equal(reads.length, 3, "no reader past the end");
  // The cache's time (CODER_WEBFETCH_CACHE_TTL_MS): within it, the same page; after it, fetched again. Each chat its own.
  t += 59_999;
  await run({});
  assert.equal(execs, 1);
  t += 60_000;
  await run({});
  assert.equal(execs, 2);
  await run({}, "chat:b");
  assert.equal(execs, 3);
  assert.equal(reads.length, 6, "the reader runs on every call");
  // The deadline setting reaches the tools script; with none, the job's own time.
  await A.webFetchRun(deps, { args: { url: "https://other.example/a", prompt: "p" }, chat: "chat:c", settings: { cacheTtlMs: 60000, deadlineMs: 5000 }, now: () => t });
  assert.equal(JSON.parse(Buffer.from(deps.lastExec.command.split(" ").pop(), "base64").toString()).args.deadline_ms, 5000);
  assert.equal(deps.lastExec.timeoutS, 35);
});

test("WF14 the page cache: 50 MB of pages at most, the least recently used left out first, each page for its own time", () => {
  const c = new W.PageCache(100);
  c.set("a", "A", 40, 1000, 0);
  c.set("b", "B", 40, 1000, 0);
  assert.equal(c.get("a", 10), "A", "touched: now the most recent");
  c.set("c", "C", 40, 1000, 10);
  assert.deepEqual([c.get("a", 20), c.get("b", 20), c.get("c", 20)], ["A", null, "C"]);
  assert.equal(c.bytes, 80);
  c.set("big", "X", 101, 1000, 20);
  assert.equal(c.get("big", 20), null, "a page bigger than the cache is not kept");
  assert.equal(c.get("a", 1000), null, "past its time");
  assert.equal(c.get("c", 1009), "C");
  assert.equal(W.pageCache.max, 52_428_800);
});

test("WF15 a pre-approved documentation site's Markdown page under 100,000 characters comes as it is (no reader); a longer one, or HTML, is read with Claude Code's rules for documentation", async () => {
  const sent = [];
  let page = "# JSON\n\nUse json.loads.";
  const deps = {
    exec: async () => ({ code: 0, output: pageOut(page, { contentType: "text/markdown; charset=utf-8" }) }),
    send: async (req) => { sent.push(req.messages[1].content); return { message: { content: "read" } }; },
  };
  const run = (url, args = {}) => A.webFetchRun(deps, { args: { url, prompt: "p", ...args }, chat: "chat:docs-" + Math.random(), settings: {} });
  assert.equal((await run("https://docs.python.org/3/library/json.md")).out, "# JSON\n\nUse json.loads.");
  assert.equal(sent.length, 0);
  assert.equal((await run("https://docs.python.org/3/library/json.md", { offset: 8 })).out, "Use json.loads.");
  assert.equal((await run("https://example.com/json.md")).out, "read", "another site's Markdown is read");
  assert.ok(sent[0].endsWith(NOT_QUOTES + "\n"));
  page = "x".repeat(100_000);
  assert.equal((await run("https://docs.python.org/3/big.md")).out, "read");
  assert.ok(sent[1].endsWith("\n\n" + DOCS_RULES + "\n"));
});

test("WF16 in Coder's loop: the reader's answer alone; the PostToolUse hooks get Claude Code's result object; the reader's use counted; a binary page's note", async () => {
  const facts = { contentType: "application/pdf", binary: true, persistedPath: "/tmp/coder-scratch/webfetch-1-abc.pdf", persistedSize: 2048, bytes: 2048 };
  const t = await loop([say("", [call("web_fetch", { url: "https://lib.example/docs", prompt: "the install command" }, "w1"), call("web_fetch", { url: "https://lib.example/manual.pdf", prompt: "the title" }, "w2")]), say("done")], {
    tools: { web_fetch: (a) => (a.url.endsWith(".pdf") ? pageOut("%PDF-1.4 binary", facts) : pageOut("Install: npm i lib@4")) },
    reader: async (req) => ({ message: { role: "assistant", content: req.messages[1].content.includes("%PDF") ? "A manual" : "npm i lib@4" }, usage: { in: 7, out: 3 } }),
    hooks: { PostToolUse: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "post.sh" }] }] },
  });
  assert.equal(t.r.status, "done");
  assert.equal(toolMsg(t, "w1"), "npm i lib@4");
  assert.equal(toolMsg(t, "w2"), "A manual\n\n[Binary content (application/pdf, 2KB) also saved to /tmp/coder-scratch/webfetch-1-abc.pdf]");
  const post = t.hookCalls.find((x) => x.input.hook_event_name === "PostToolUse" && x.input.tool_use_id === "w1").input;
  assert.equal(post.tool_name, "WebFetch");
  assert.deepEqual(post.tool_input, { url: "https://lib.example/docs", prompt: "the install command" });
  const { durationMs, ...rest } = post.tool_response;
  assert.ok(Number.isInteger(durationMs) && durationMs >= 0);
  // (Claude Code's result object alone: no `output` beside it. 2026-11-14.)
  assert.deepEqual(rest, { code: 200, bytes: 20, codeText: "OK", result: "npm i lib@4", url: "https://lib.example/docs" });
  assert.equal(t.r.usage.filter((u) => u.in === 7).length, 2, "the reader's use counted with the job's");
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "w1").output, "npm i lib@4");
  // The tools script was asked for the page with the deadline; the reader never saw the hooks' or Coder's words.
  assert.deepEqual(t.execs[0].req, { tool: "web_fetch", args: { url: "https://lib.example/docs", deadline_ms: 300000 } });
});

test("WF17 in Coder's loop: a redirect to another host and a status other than 2xx in Claude Code's words (no reader); a failed fetch and a reader with no answer are failed calls", async () => {
  const redirect = T.printedAnswer({ text: "", facts: { kind: "redirect", originalUrl: "https://a.example/x", redirectUrl: "https://b.example/y", statusCode: 301 } });
  const t = await loop([say("", [call("web_fetch", { url: "https://a.example/x", prompt: "p" }, "r1"), call("web_fetch", { url: "https://c.example/x", prompt: "p" }, "r2"), call("web_fetch", { url: "https://d.example/x", prompt: "p" }, "r3"), call("web_fetch", { url: "https://e.example/x", prompt: "p" }, "r4")]), say("done")], {
    tools: { web_fetch: (a) => (a.url.startsWith("https://a.") ? redirect : a.url.startsWith("https://c.") ? T.printedAnswer({ text: "", facts: { kind: "http_error", statusCode: 503, retryAfter: "30" } }) : a.url.startsWith("https://d.") ? { code: 1, output: "error: Too many redirects (exceeded 10)" } : pageOut("text")) },
    reader: async () => ({ message: { role: "assistant", content: "" } }),
    hooks: { PostToolUse: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "post.sh" }] }], PostToolUseFailure: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "fail.sh" }] }] },
  });
  assert.equal(toolMsg(t, "r1"), W.redirectText({ originalUrl: "https://a.example/x", redirectUrl: "https://b.example/y", statusCode: 301 }, { prompt: "p" }));
  assert.equal(toolMsg(t, "r2"), "The server returned HTTP 503 Service Unavailable.\nRetry-After: 30\n\nThe response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of web_fetch.");
  assert.equal(toolMsg(t, "r3"), "error: Too many redirects (exceeded 10)");
  assert.equal(toolMsg(t, "r4"), "error: The model that reads the content gave no answer. Trying again may work.");
  assert.equal(t.reads.length, 1, "only the page was read");
  const hook = (id) => t.hookCalls.find((x) => x.input.tool_use_id === id).input;
  assert.deepEqual([hook("r1").hook_event_name, hook("r1").tool_response.code, hook("r1").tool_response.codeText], ["PostToolUse", 301, "Moved Permanently"]);
  assert.deepEqual([hook("r2").hook_event_name, hook("r2").tool_response.code, hook("r2").tool_response.bytes], ["PostToolUse", 503, 0]);
  assert.deepEqual([hook("r3").hook_event_name, hook("r3").error], ["PostToolUseFailure", "error: Too many redirects (exceeded 10)"]);
  assert.equal(hook("r4").hook_event_name, "PostToolUseFailure");
});

test("WF18 in Coder's loop: offset given as text is taken; a bad input is refused before any hook; a result over 50,000 characters is saved to a file and given as Claude Code gives one", async () => {
  const saved = [];
  const LONG = "y".repeat(60_000);
  const t = await loop([say("", [call("web_fetch", { url: "https://a.example/x", prompt: "p", offset: "5" }, "o1"), call("web_fetch", { url: "nope", prompt: "p" }, "bad"), call("web_fetch", { url: "https://b.example/x", prompt: "p" }, "big")]), say("done")], {
    tools: { web_fetch: () => pageOut("0123456789") },
    reader: async (req) => ({ message: { role: "assistant", content: req.messages[1].content.includes("0123456789") ? LONG : "part" } }),
    hooks: { PreToolUse: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "pre.sh" }] }] },
    deps: { saveText: (text) => { saved.push(text); return "/work/.coder-out/abc.txt"; } },
  });
  assert.ok(t.reads[0].messages[1].content.startsWith(W.leadText(5, 10) + "\nWeb page content:\n---\n56789\n---\n"));
  assert.equal(toolMsg(t, "o1"), "part");
  assert.equal(toolMsg(t, "bad"), "error: InputValidationError: web_fetch failed due to the following issue:\nThe parameter `url` is invalid: Invalid URL");
  assert.deepEqual(t.hookCalls.map((x) => x.input.tool_use_id), ["o1", "big"], "no hook for the refused call");
  assert.equal(t.execs.length, 2);
  assert.deepEqual(saved, [LONG]);
  assert.equal(toolMsg(t, "big"), W.persistedText(LONG, "/work/.coder-out/abc.txt"));
});

test("WF19 its settings in Coder's loop: turned off, it is not offered and a call is refused before any hook in Claude Code's words; the cache's own time in its description", async () => {
  let t = await loop([say("", [call("web_fetch", { url: "https://a.example/x", prompt: "p" }, "w1")]), say("done")], {
    tools: { web_fetch: () => pageOut("x") },
    hooks: { PreToolUse: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "pre.sh" }] }] },
    deps: { webFetch: W.webFetchSettings({ CODER_DISABLE_WEB_FETCH: "1" }, () => "CLAUDE_CODE_DISABLE_WEB_FETCH") },
  });
  assert.equal(t.seen[0].tools.some((x) => x.function && x.function.name === "web_fetch"), false);
  assert.equal(toolMsg(t, "w1"), "error: WebFetch is turned off by CLAUDE_CODE_DISABLE_WEB_FETCH.");
  assert.deepEqual([t.hookCalls.length, t.execs.length], [0, 0]);
  t = await loop([say("done")], { deps: { webFetch: W.webFetchSettings({ CODER_WEBFETCH_CACHE_TTL_MS: "60000" }) } });
  assert.match(t.seen[0].tools.find((x) => x.function && x.function.name === "web_fetch").function.description, /Responses are cached for 1 minute per URL\.$/);
  // Gloopy's helpers (an agent with its own tools): the same.
  const G = await import("../container/gloopy-agent.mjs");
  const seen = [];
  await A.runCoder({ send: async (req) => { seen.push(req); return say("done"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, webFetch: W.webFetchSettings({ CODER_DISABLE_WEB_FETCH: "1" }) }, { text: "go", tools: G.HELPER_TOOLS, messages: [] });
  assert.deepEqual(seen[0].tools.map((x) => x.function.name).filter((n) => n === "web_fetch" || n === "read"), ["read"]);
});

test("WF20 asking first, as Claude Code's WebFetch asks: its words on the card, its rule offered, no note on the card; with no one to answer, its words; the auto mode checker sees \"<url>: <prompt>\"", async () => {
  let t = await loop([say("", [call("web_fetch", { url: "https://example.com/a", prompt: "p" }, "q1")]), say("done")], { mode: "acceptEdits", tools: { web_fetch: () => pageOut("x") } });
  const card = t.events.find((e) => e.type === "permission" && e.tool === "web_fetch");
  assert.deepEqual([card.url, card.why, card.rules], ["https://example.com/a", "Coder wants to fetch content from example.com", ["WebFetch(domain:example.com)"]]);
  assert.equal(toolMsg(t, "q1"), "read");
  t = await loop([say("", [call("web_fetch", { url: "https://example.com/a", prompt: "p" }, "q2")]), say("done")], { mode: "acceptEdits", tools: { web_fetch: () => pageOut("x") }, deps: { ask: undefined } });
  assert.equal(toolMsg(t, "q2"), "not run: Coder requested permissions to use WebFetch, but you haven't granted it yet.");
  assert.equal(t.execs.length, 0);
  // (Claude Code: "WebFetch and browser prompts don't offer the field".)
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /\(e\.tool === 'web_fetch' \? '' : '<input type="text" class="cd-perm-note"/);
  assert.equal(C.actionShown("web_fetch", { url: "https://a.example/x", prompt: "the price" }), "web_fetch: https://a.example/x: the price");
  assert.equal(C.actionShown("web_fetch", { url: "https://a.example/x" }), "web_fetch: https://a.example/x");
});

test("WF21 Coder's Worker loads the permission rules, and with them WebFetch's sites and domain rules: no Node module anywhere it loads (it runs without Node's); the machine copies the new module", () => {
  const root = new URL("../", import.meta.url);
  const seen = new Set(), nodeMods = [];
  const walk = (url) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const src = readFileSync(url, "utf8");
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g)) {
      const spec = m[1] || m[2];
      if (spec.startsWith("node:")) nodeMods.push(url.pathname.slice(root.pathname.length) + " → " + spec);
      else if (spec.startsWith(".")) walk(new URL(spec, url));
    }
  };
  walk(new URL("worker.js", root));
  assert.ok(seen.has(new URL("container/coder-perms.mjs", root).href) && seen.has(new URL("container/coder-webfetch-sites.mjs", root).href));
  assert.equal(seen.has(new URL("container/coder-webfetch.mjs", root).href), false, "the fetch itself stays on the machine");
  assert.deepEqual(nodeMods, []);
  assert.doesNotMatch(readFileSync(new URL("wrangler.jsonc", root), "utf8"), /nodejs_compat/);
  const copy = readFileSync(new URL("container/Dockerfile", root), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-webfetch-sites.mjs "));
  // The tool's own module gives the same functions.
  assert.equal(W.docSite, P.docSite);
  assert.deepEqual(Object.keys(W).filter((k) => ["DOC_SITES", "docSitePath", "docSite", "domainRuleMatches", "pickDomainRule", "webFetchRuleProblem"].includes(k)).sort(), ["DOC_SITES", "docSite", "docSitePath", "domainRuleMatches", "pickDomainRule", "webFetchRuleProblem"]);
});
