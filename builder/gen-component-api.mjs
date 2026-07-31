// Derives one usage line per component from the component files themselves and
// writes builder/component-api.mjs.
//
// GENERATED, NOT HAND-WRITTEN, and that is the point. 500 hand-maintained notes
// would be wrong within a week — the kit's own history is a list of features
// that were declared somewhere and acted on nowhere — and a note that disagrees
// with the file is worse than no note, because the model follows it and the page
// is refused. test/component-api.test.mjs re-runs this and fails on any
// difference, so the notes cannot drift from the props.
//
// Run: node builder/gen-component-api.mjs
import fs from "node:fs";
import path from "node:path";

const UI_DIR = path.join(import.meta.dirname, "lovable/template/src/components/ui");
const OUT = path.join(import.meta.dirname, "component-api.mjs");

/** Everything from `open` to its matching close, brace-aware. Returns null if unbalanced. */
function block(src, open, chars = "{}") {
  const [o, c] = chars;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) depth++;
    else if (src[i] === c) { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

/** Strip comments and collapse whitespace — a type is one line by the time we print it. */
function tidy(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ").trim();
}

/**
 * Shorten a type to something worth spending tokens on.
 *
 * The model needs the SHAPE, not the exact union. `"sm" | "md" | "lg"` is worth
 * keeping in full because the caller has to pick one of those strings; a
 * 200-character object literal is not, and becomes `object`.
 */
function shortType(t) {
  const s = tidy(t).replace(/;$/, "");
  if (s.length <= 46) return s;
  if (/^\{[\s\S]*\}\[\]$/.test(s)) return "object[]";
  if (/^\{/.test(s)) return "object";
  if (/=>/.test(s)) return "function";
  return s.slice(0, 43) + "…";
}

export function extract(source) {
  const out = [];
  // export function Name({ a, b = 1 }: { a: T; b?: U }) {
  // The optional `<T>` is not decoration — `DataList<T>` is the most-used
  // component in the kit and a regex without it silently skipped the one that
  // matters most, while reporting 429 successes.
  const re = /export function (\w+)\s*(?:<[^>()]*>)?\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const destructOpen = m.index + m[0].length - 1;
    const destruct = block(source, destructOpen);
    if (destruct == null) continue;
    const after = source.slice(destructOpen + destruct.length + 2);
    const typeAt = after.match(/^\s*:\s*\{/);
    if (!typeAt) continue;                        // props typed elsewhere — skipped on purpose
    const typeOpen = destructOpen + destruct.length + 2 + typeAt[0].length - 1;
    const types = block(source, typeOpen);
    if (types == null) continue;

    // Defaults come from the destructuring, types from the annotation.
    const defaults = new Map();
    for (const part of splitTop(tidy(destruct), ",")) {
      const eq = part.indexOf("=");
      if (eq > 0) defaults.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    const props = [];
    for (const part of splitTop(tidy(types), ";")) {
      const colon = part.indexOf(":");
      if (colon <= 0) continue;
      const nameRaw = part.slice(0, colon).trim();
      const key = nameRaw.replace(/\?$/, "");
      if (!/^[A-Za-z_]\w*$/.test(key)) continue;
      // `className` is on every one of the 500. Stated once in the rules instead
      // of 500 times in the notes.
      if (key === "className") continue;
      const optional = nameRaw.endsWith("?");
      const d = defaults.get(key);
      props.push(`${key}${optional ? "?" : ""}: ${shortType(part.slice(colon + 1))}${d ? ` = ${tidy(d)}` : ""}`);
    }
    if (props.length) out.push({ name: m[1], props });
  }
  return out;
}

/** Split on a separator that is not inside brackets or a string. */
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote && s[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    // `>` closes a generic — EXCEPT in `=>`, which is not a bracket at all.
    // Counting the arrow drove depth negative, so every `;` after the first
    // callback prop stopped splitting and the props after it vanished. Silent:
    // the line still looked like a valid signature, just a shorter one.
    if ("([{".includes(c) || (c === "<" && s[i + 1] !== "=")) depth++;
    else if (")]}".includes(c) || (c === ">" && s[i - 1] !== "=")) depth--;
    else if (c === sep && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function build() {
  const api = {};
  for (const file of fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".tsx")).sort()) {
    const found = extract(fs.readFileSync(path.join(UI_DIR, file), "utf8"));
    if (!found.length) continue;                   // shadcn primitives: standard HTML props, and the model knows them
    const slug = file.replace(/\.tsx$/, "");
    api[slug] = found.map((f) => `${f.name}(${f.props.join(", ")})`).join(" · ");
  }
  return api;
}

export function render(api) {
  const entries = Object.entries(api)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  return `// GENERATED by builder/gen-component-api.mjs — do not edit by hand.
//
// One usage line per component we wrote, derived from its own props. The model
// is handed the lines for the components a page actually imported, on the
// REPAIR pass only: all 500 at once is ~12,700 tokens and unaffordable, the ~20
// a page uses is ~480 and is exactly where a wrong prop name gets fixed.
//
// The 69 shadcn primitives are absent on purpose — they take standard HTML
// props and the model has seen thousands of real examples of them. Everything
// here is something we invented, which is the half it can only guess at.
//
// \`className\` is omitted from every line: all 500 take it, so it is stated once
// in PAGE_RULES instead of 500 times here.
export const COMPONENT_API = {
${entries}
};
`;
}

if (process.argv[1] && process.argv[1].endsWith("gen-component-api.mjs")) {
  const api = build();
  fs.writeFileSync(OUT, render(api));
  console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${Object.keys(api).length} components`);
}
