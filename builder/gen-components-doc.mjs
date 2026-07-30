// Writes docs/components.md — the human-readable list of the component kit.
//
// GENERATED. A hand-written list of 500 would be wrong within a week, and a
// list that disagrees with the kit is worse than none: somebody reaches for a
// component that no longer takes those props. Everything here comes from the
// files themselves — the grouping from UI_COMPONENTS' own section comments, the
// summary from each component's doc comment, the props from its signature.
//
// Run: node builder/gen-components-doc.mjs
import fs from "node:fs";
import path from "node:path";
import { extract } from "./gen-component-api.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const UI_DIR = path.join(ROOT, "builder/lovable/template/src/components/ui");
const PAGE_GEN = path.join(ROOT, "builder/page-gen.mjs");
const OUT = path.join(ROOT, "docs/components.md");

/**
 * The curated grouping, read off UI_COMPONENTS rather than restated.
 *
 * That list is already organised by what a thing is FOR — "Booking and
 * scheduling", "The trades" — and re-deriving categories here would produce a
 * second, worse taxonomy that drifts from the one the model is shown.
 */
function sections() {
  const src = fs.readFileSync(PAGE_GEN, "utf8");
  const body = src.match(/export const UI_COMPONENTS = \[([\s\S]*?)\n\];/)[1];
  const out = [];
  let heading = "shadcn/ui", label = null, run = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const big = line.match(/^\/\/\s*──+\s*(.+?)\s*──+/);
    if (big) { heading = big[1]; label = null; run = []; continue; }
    if (line.startsWith("//")) { run.push(line.replace(/^\/\/\s?/, "").trim()); continue; }
    const names = [...line.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
    if (!names.length) { run = []; continue; }
    // The label is the FIRST SENTENCE of the LAST paragraph of the comment run
    // above the names — "Data and state. `data-list` is the important one: …"
    // is labelled "Data and state".
    //
    // Two things this gets right that simpler rules did not. Taking the last
    // LINE produced sentence fragments as headings ("because most generated
    // sites are a form"). Requiring a one-line run lost every label that
    // follows a paragraph of reasoning, which is most of them.
    const paras = run.join("\n").split(/\n\s*\n/);
    const first = (paras[paras.length - 1] || "").split(/\.(?:\s|$)/)[0].trim();
    // Openers that are provenance, not a category. Without this the kit gains a
    // section called "Added 2026-07-30".
    const NOT_A_LABEL = /^(Added|Written|From|The rest|Deliberately|Note|Both|Same|Every|All)\b|^\d/;
    if (first && first.length <= 42 && !NOT_A_LABEL.test(first) && !/[`(]/.test(first)) label = first;
    run = [];
    let sec = out.find((s) => s.heading === heading && s.label === label);
    if (!sec) out.push((sec = { heading, label, names: [] }));
    sec.names.push(...names);
  }
  return out;
}

/**
 * The first paragraph of the doc comment — the sentence that says what it is for.
 *
 * Both comment shapes, and that is not cosmetic: 164 of the 500 are written as
 * a single `/** … *​/` line and only 280 as the multi-line form, so handling one
 * shape left 220 components silently undescribed while the file still looked
 * complete.
 */
function summary(source) {
  const m = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return null;
  const lines = m[1].split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trimEnd());
  const para = [];
  for (const l of lines) { if (!l.trim() && para.length) break; if (l.trim()) para.push(l.trim()); }
  const text = para.join(" ").trim();
  // A `/** "(42 reviews)" */` on a single prop is not a description of the
  // component — the doc comment we want sits above the export.
  return text && text.length > 12 ? text : null;
}

function build() {
  const secs = sections();
  const seen = new Set();
  let total = 0, described = 0;
  const parts = [];
  let currentHeading = null;

  for (const sec of secs) {
    if (sec.heading !== currentHeading) {
      currentHeading = sec.heading;
      parts.push(`\n## ${currentHeading}\n`);
    }
    if (sec.label) parts.push(`\n### ${sec.label}\n`);
    parts.push("| component | what it is for | props |");
    parts.push("|---|---|---|");
    for (const name of sec.names) {
      if (seen.has(name)) continue;
      seen.add(name);
      total++;
      const file = path.join(UI_DIR, name + ".tsx");
      let sum = null, props = "";
      if (fs.existsSync(file)) {
        const src = fs.readFileSync(file, "utf8");
        sum = summary(src);
        const found = extract(src);
        props = found.map((f) => f.props.join(", ")).filter(Boolean).join(" · ");
      }
      if (sum) described++;
      const cell = (s) => (s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      parts.push(`| \`${name}\` | ${cell(sum) || "—"} | ${props ? "`" + cell(props) + "`" : "—"} |`);
    }
    parts.push("");
  }
  return { md: parts.join("\n"), total, described };
}

export function render() {
  const { md, total, described } = build();
  const head = `# The component kit

**${total} components**, in \`builder/lovable/template/src/components/ui/\`. Every one is
available to a generated site; the page generator is given this list of names in
\`PAGE_RULES\`, and the exact props of whatever a page imported on a repair.

The 61 shadcn/ui primitives are listed first and have no description here —
they are documented at ui.shadcn.com and take standard HTML props. The
${total - 61} after them were written for this platform, and are described
below. \`className\` is omitted from every props column: all ${total} take it.

**This file is generated** by \`builder/gen-components-doc.mjs\` from the
components themselves — their doc comments and their signatures. Do not edit it
by hand; run the script. \`test/components-doc.test.mjs\` regenerates and fails
on any difference, so it cannot drift from the kit.
`;
  return head + md.replace(/\n{3,}/g, "\n\n") + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("gen-components-doc.mjs")) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const text = render();
  fs.writeFileSync(OUT, text);
  const { total, described } = build();
  console.log(`wrote docs/components.md — ${total} components, ${described} described`);
}
