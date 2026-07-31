// Writes docs/components.md — every component, one per line.
//
// A ✓ means it is built and a generated site can import it today. No mark means
// it is on the list and does not exist yet.
//
// Generated so it cannot drift: the ticked half is read straight off the
// folder, so building something moves it across on its own and it can never
// appear in both halves.
//
// Run: node builder/gen-components-doc.mjs
import fs from "node:fs";
import path from "node:path";
import { PLANNED } from "./components-planned.mjs";
import { NEXT_THOUSAND } from "./components-next.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const UI_DIR = path.join(ROOT, "builder/lovable/template/src/components/ui");
const OUT = path.join(ROOT, "docs/components.md");

export function render() {
  const built = fs.readdirSync(UI_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
  const done = new Set(built);
  const todo = [...new Set(PLANNED)].filter((n) => !done.has(n)).sort();

  // The second thousand keeps its group headings — 1000 flat names is a wall,
  // and the grouping is the only thing that makes it decidable.
  const next = Object.entries(NEXT_THOUSAND)
    .map(([group, names]) => `### ${group}\n\n`
      + names.map((n) => (done.has(n) ? "✓ " : "") + n).join("\n"))
    .join("\n\n");
  const nextCount = Object.values(NEXT_THOUSAND).flat().length;

  return `# Components (${built.length} built, ${todo.length} to go)\n\n`
    + `A ✓ means it exists and a generated site can import it today.\n\n`
    + `## The first thousand\n\n`
    + built.map((n) => "✓ " + n).join("\n")
    + "\n\n"
    + todo.join("\n")
    + `\n\n## The next thousand (${nextCount} proposed, none built)\n\n`
    + next
    + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("gen-components-doc.mjs")) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render());
  console.log("wrote docs/components.md");
}
