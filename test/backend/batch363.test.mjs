// Batch 363 — MARKDOWN → SANITIZED HTML. Stateless safe-subset renderer: input is HTML-escaped first, only a
// known tag set is emitted. Covers headings, bold/italic, inline + fenced code, links (scheme allow-list),
// ul/ol lists, blockquotes, hr, paragraphs, and XSS safety.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 363");
const slug = "b363";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const md = (text) => c.post(`/api/db/${slug}/markdown`, { text }).then((r) => r.json);

// --- Headings ---
t.eq((await md("# Title")).html, "<h1>Title</h1>", "# → h1");
t.eq((await md("### Sub")).html, "<h3>Sub</h3>", "### → h3");

// --- Bold / italic ---
t.eq((await md("**bold**")).html, "<p><strong>bold</strong></p>", "bold");
t.eq((await md("_it_")).html, "<p><em>it</em></p>", "italic");

// --- Inline code (contents not further formatted, and escaped) ---
t.eq((await md("`a<b>`")).html, "<p><code>a&lt;b&gt;</code></p>", "inline code is escaped, not parsed");

// --- Fenced code ---
t.eq((await md("```\nline1\nline2\n```")).html, "<pre><code>line1\nline2</code></pre>", "fenced code block");

// --- Links (allow-list) ---
t.ok((await md("[x](https://a.com)")).html.includes('<a href="https://a.com"'), "http link rendered");
t.eq((await md("[x](javascript:alert)")).html, "<p>x</p>", "javascript: link is stripped to plain text");

// --- Lists ---
t.eq((await md("- a\n- b")).html, "<ul>\n<li>a</li>\n<li>b</li>\n</ul>", "unordered list");
t.eq((await md("1. a\n2. b")).html, "<ol>\n<li>a</li>\n<li>b</li>\n</ol>", "ordered list");

// --- Blockquote + hr ---
t.eq((await md("> quote")).html, "<blockquote>quote</blockquote>", "blockquote");
t.eq((await md("---")).html, "<hr>", "horizontal rule");

// --- XSS safety ---
let x = (await md("<script>alert(1)</script>")).html;
t.ok(!/<script>/.test(x), "raw <script> is escaped");
t.ok(x.includes("&lt;script&gt;"), "…rendered as text");
t.ok(!(await md("<img src=x onerror=alert(1)>")).html.includes("<img"), "raw <img> is escaped");

// --- Paragraphs ---
t.eq((await md("one\ntwo")).html, "<p>one two</p>", "consecutive lines join a paragraph");
t.eq((await md("one\n\ntwo")).html, "<p>one</p>\n<p>two</p>", "a blank line splits paragraphs");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/markdown`, {})).status, 400, "no text → 400");

t.done(); h.restore();
