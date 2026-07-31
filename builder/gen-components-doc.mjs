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
import { NEXT_PLANNED, NEXT_SHAPES } from "./components-next.mjs";

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
  const shapeCount = Object.values(NEXT_SHAPES).reduce((s, e) => s + Object.keys(e).length, 0);
  const bulk = Object.entries(NEXT_PLANNED)
    .map(([group, names]) => `### ${group}\n\n`
      + names.map((n) => (done.has(n) ? "✓ " : "") + n).join("\n"))
    .join("\n\n");
  const bulkCount = Object.values(NEXT_PLANNED).flat().length;

  return `# Components (${built.length} built, ${todo.length} to go)\n\n`
    + `A ✓ means it exists and a generated site can import it today.\n\n`
    + `## Built and planned\n\n`
    + built.map((n) => "✓ " + n).join("\n")
    + "\n\n"
    + todo.join("\n")
    + `\n\n## Build these first — ${shapeCount} shapes with no near neighbour\n\n`
    + `Structurally new: nothing shipped renders anything like them. Each says\n`
    + `what it is and what it differs from.\n\n`
    + next
    + `\n\n## Then these — ${bulkCount} proposed, prop-distinct\n\n`
    + `Same test the shipped kit uses on its own 33 cards and 32 badges: different\n`
    + `PROPS, so the model hands one its data instead of writing the layout inline.\n`
    + `142 true prop-clones were dropped (ten countdowns are one countdown-ring).\n\n`
    + bulk
    + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("gen-components-doc.mjs")) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render());
  console.log("wrote docs/components.md");
}
