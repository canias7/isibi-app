// Batch 233 — TABLE OF CONTENTS / ANCHOR INDEX. A stateless extractor: given HTML or Markdown, pull the
// headings into a flat list + nested tree, each with a slugified anchor id (deduped). Covers HTML + markdown
// parsing, slugs, dedup, level filtering, nesting, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 233");
const slug = "b233";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const toc = (body) => c.post(`/api/db/${slug}/toc`, body).then((r) => r.json);

// --- HTML parsing + slugs ---
let r = await toc({ html: "<h1>Getting Started</h1><p>x</p><h2>Install & Setup</h2><h2>Usage</h2>" });
t.eq(r.count, 3, "3 headings found");
t.eq(r.headings[0].id, "getting-started", "h1 slug");
t.eq(r.headings[1].id, "install-setup", "…'&' and spaces collapse to dashes");
t.eq(r.headings[1].level, 2, "…level captured");

// --- Nesting: h2s nest under the h1 ---
t.eq(r.tree.length, 1, "one top-level node (the h1)");
t.eq(r.tree[0].children.length, 2, "…with 2 h2 children");

// --- Markdown parsing ---
r = await toc({ markdown: "# Title\n\nsome text\n## Section A\n### Sub A1\n## Section B" });
t.eq(r.count, 4, "4 markdown headings");
t.eq(r.headings[2].text, "Sub A1", "…deep heading text");
t.eq(r.headings[2].level, 3, "…level 3");
// tree: Title > [A > [A1], B]
t.eq(r.tree[0].children.length, 2, "Title has 2 section children");
t.eq(r.tree[0].children[0].children[0].text, "Sub A1", "…and A nests A1");

// --- Duplicate headings get de-duplicated slugs ---
r = await toc({ markdown: "# Intro\n## Intro\n## Intro" });
t.eq(r.headings[0].id, "intro", "first 'Intro' → intro");
t.eq(r.headings[1].id, "intro-1", "second → intro-1");
t.eq(r.headings[2].id, "intro-2", "third → intro-2");

// --- Level filter ---
r = await toc({ markdown: "# H1\n## H2\n### H3\n#### H4", min: 2, max: 3 });
t.eq(r.count, 2, "min=2 max=3 keeps only H2 + H3");
t.ok(r.headings.every((x) => x.level >= 2 && x.level <= 3), "…all within the band");

// --- HTML strips inner tags from heading text ---
r = await toc({ html: "<h1>Hello <em>World</em></h1>" });
t.eq(r.headings[0].text, "Hello World", "inner tags stripped from text");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/toc`, {})).status, 400, "no html/markdown → 400");
r = await toc({ markdown: "no headings here\njust text" });
t.eq(r.count, 0, "text with no headings → empty");

t.done(); h.restore();
