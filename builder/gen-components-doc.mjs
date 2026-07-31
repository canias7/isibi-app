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
import { NEXT_SHAPES } from "./components-next.mjs";

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

  // Each proposed shape prints WITH the reason nothing shipped covers it —
  // a bare name cannot be argued with, and this list exists because a
  // thousand bare names hid nine hundred duplicates.
  const next = Object.entries(NEXT_SHAPES)
    .map(([group, entries]) => `### ${group}\n\n`
      + Object.entries(entries)
        .map(([n, why]) => `- ${done.has(n) ? "✓ " : ""}**${n}** — ${why}`)
        .join("\n"))
    .join("\n\n");
  const nextCount = Object.values(NEXT_SHAPES).reduce((s, e) => s + Object.keys(e).length, 0);

  return `# Components (${built.length} built, ${todo.length} to go)\n\n`
    + `A ✓ means it exists and a generated site can import it today.\n\n`
    + `## Built and planned\n\n`
    + built.map((n) => "✓ " + n).join("\n")
    + "\n\n"
    + todo.join("\n")
    + `\n\n## Shapes the kit still lacks (${nextCount} proposed, none built)\n\n`
    + `A 1000-name draft was culled to these by asking of each one: would it take\n`
    + `the same props and render the same structure as something already built?\n`
    + `If yes it is that component with different words in it, and it is not here.\n\n`
    + next
    + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("gen-components-doc.mjs")) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render());
  console.log("wrote docs/components.md");
}
