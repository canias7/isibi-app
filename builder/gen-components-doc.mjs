// Writes docs/components.md — every component in the kit, one per line.
//
// Generated so it cannot drift: the list is read straight off the folder.
// Run: node builder/gen-components-doc.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const UI_DIR = path.join(ROOT, "builder/lovable/template/src/components/ui");
const OUT = path.join(ROOT, "docs/components.md");

export function render() {
  const names = fs.readdirSync(UI_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
  return `# Components (${names.length})\n\n${names.map((n) => "✓ " + n).join("\n")}\n`;
}

if (process.argv[1] && process.argv[1].endsWith("gen-components-doc.mjs")) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render());
  console.log(`wrote docs/components.md`);
}
