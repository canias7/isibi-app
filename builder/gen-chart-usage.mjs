// Turns the 1,140 chart demos into one worked example per primitive, and writes
// builder/chart-usage.mjs.
//
// WHY THE DEMOS ARE WORTH MINING RATHER THAN LEAVING ALONE. They are the only
// artifact in this repo that shows these APIs being CALLED, and they compile, so
// every example here is known-good rather than something I wrote from the types.
// Left as files they are unreachable: the model has no filesystem, it can only
// import, and importing one is a defect the lint refuses — a demo publishes a
// stranger's invented figures to a real business's visitors. That is exactly the
// trap the 196 examples fell into, where "read one to learn the pattern" was
// impossible for a reader with no file access. Extracting the call site into the
// prompt is the same idea done the way that actually reaches the model.
//
// WHAT A SIGNATURE CANNOT SAY, and why this is not redundant with CHART_API.
// `Waterfall(steps: Step[], …)` names the prop and stops. `Step` is a name the
// model cannot resolve, and 27 of the 854 signatures end in one. The demo's own
// data literal resolves it completely — and shows the optional `total: true`
// flag that the type name never hinted at. Measured on myself: writing the
// proof page for this wiring I guessed three of five call shapes wrong, and the
// signatures fixed two of them.
//
// ARRAYS ARE TRUNCATED TO TWO ELEMENTS. A demo can hold 420 generated points;
// the model needs the SHAPE of a point, not the sample. Truncating is what keeps
// this affordable and, for this purpose, loses nothing.
//
// Run: node builder/gen-chart-usage.mjs
import fs from "node:fs";
import path from "node:path";

const CHARTS_DIR = path.join(import.meta.dirname, "lovable/template/src/components/charts");
const OUT = path.join(import.meta.dirname, "chart-usage.mjs");

const MAX_ARRAY_ITEMS = 2;
const MAX_EXAMPLE_CHARS = 420;

/** Everything from the opening bracket at `open` to its match. Null if unbalanced. */
function balanced(src, open, pair = "{}") {
  const [o, c] = pair;
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote && src[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === o) depth++;
    else if (ch === c) { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  return null;
}

/** The opening JSX tag for `<Name …>` or `<Name … />`, verbatim. */
export function openingTag(source, name) {
  const at = source.search(new RegExp(`<${name}(?=[\\s/>])`));
  if (at < 0) return null;
  let depth = 0, quote = null;
  for (let i = at; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (ch === quote && source[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    // `>` inside a prop expression (an arrow, a generic) is not the end of the tag.
    else if (ch === ">" && depth === 0) return source.slice(at, i + 1);
  }
  return null;
}

/**
 * Cut every array literal down to MAX_ARRAY_ITEMS.
 *
 * Done on the text rather than by parsing, because these are literals in files
 * that already compile — and a real parser here would be a dependency for a
 * build-time script that has no other need of one.
 */
export function truncateArrays(text) {
  let out = "", i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "[") { out += ch; i++; continue; }
    const arr = balanced(text, i, "[]");
    if (!arr) { out += ch; i++; continue; }
    const inner = arr.slice(1, -1);
    const items = [];
    let depth = 0, quote = null, start = 0;
    for (let j = 0; j < inner.length; j++) {
      const c = inner[j];
      if (quote) { if (c === quote && inner[j - 1] !== "\\") quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === "," && depth === 0) { items.push(inner.slice(start, j)); start = j + 1; }
    }
    items.push(inner.slice(start));
    const kept = items.map((s) => s.trim()).filter(Boolean);
    out += kept.length > MAX_ARRAY_ITEMS
      ? "[" + kept.slice(0, MAX_ARRAY_ITEMS).map(truncateArrays).join(", ") + `, /* …${kept.length} in all */ ]`
      : "[" + kept.map(truncateArrays).join(", ") + "]";
    i += arr.length;
  }
  return out;
}

/** Module-level `const x = …` declarations, by name. */
export function topLevelConsts(source) {
  const consts = new Map();
  for (const m of source.matchAll(/^const (\w+) = /gm)) {
    const from = m.index + m[0].length;
    const first = source[from];
    const body = "([{".includes(first)
      ? balanced(source, from, first === "(" ? "()" : first === "[" ? "[]" : "{}")
      : source.slice(from, source.indexOf("\n", from));
    if (body) consts.set(m[1], `const ${m[1]} = ${body.trim()}`);
  }
  return consts;
}

/** One example: the call, plus whatever module-level data it names. */
export function exampleFor(source, name) {
  const tag = openingTag(source, name);
  if (!tag) return null;
  const consts = topLevelConsts(source);
  const needed = [];
  for (const m of tag.matchAll(/\{([^}]*)\}/g)) {
    for (const id of m[1].matchAll(/\b([a-z_]\w*)\b/g)) {
      if (consts.has(id[1]) && !needed.includes(id[1])) needed.push(id[1]);
    }
  }
  const text = [...needed.map((n) => consts.get(n)), tag].join("\n");
  const tidy = truncateArrays(text).replace(/\n\s*\n/g, "\n").replace(/[ \t]+$/gm, "");
  // A call whose data cannot be shown compactly is worse than no example: it
  // spends the budget and still does not show the shape. The signature stands
  // alone in that case.
  return tidy.length > MAX_EXAMPLE_CHARS ? null : tidy;
}

/**
 * A demo that FABRICATES its data teaches the wrong lesson.
 *
 * Several lib modules export a generator beside the component — `sampleBoxes`,
 * `sampleCandles`, `sample`, `rng` — so a demo can show a chart full without a
 * literal. Those are real exports, so an example using one compiles, and that is
 * the danger: the model would copy `sampleBoxes(["Mon","Tue"], 9)` into a real
 * page and publish random numbers to a business's visitors. Exactly the failure
 * the demo-import lint exists to stop, arriving through the example instead.
 *
 * And it shows nothing anyway — the whole point of an example here is the SHAPE
 * of the data, which a generator call hides behind a function name.
 */
export function fabricates(example) {
  return /\b(?:sample|rng|mock|fake|random|synth)[A-Za-z]*\s*\(/.test(example);
}

/**
 * Which demo speaks for a primitive.
 *
 * A clean example is required, not merely preferred — a fabricating one is
 * dropped even when it is the only candidate, leaving the signature to stand
 * alone. A worked example is a bonus; a misleading one is a defect.
 *
 * Among the clean ones a `-default` demo is the one written to show the plain
 * case, so it wins; failing that the shortest, which carries least that is
 * beside the point.
 */
function pick(candidates) {
  const clean = candidates.filter((c) => !fabricates(c.example));
  if (!clean.length) return null;
  const preferred = clean.filter((c) => /-default\.tsx$/.test(c.file));
  const pool = preferred.length ? preferred : clean;
  return pool.sort((a, b) => a.example.length - b.example.length)[0];
}

export function build() {
  const found = new Map();                       // "domain.Name" -> [{file, example}]
  for (const file of fs.readdirSync(CHARTS_DIR).filter((f) => f.endsWith(".tsx")).sort()) {
    const source = fs.readFileSync(path.join(CHARTS_DIR, file), "utf8");
    for (const imp of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/lib\/([a-z0-9-]+)"/g)) {
      for (const raw of imp[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (!/^[A-Z]\w*$/.test(name)) continue;  // helpers like `rng` and `sample` are not components
        const example = exampleFor(source, name);
        if (!example) continue;
        const key = imp[2] + "." + name;
        if (!found.has(key)) found.set(key, []);
        found.get(key).push({ file, example });
      }
    }
  }
  const usage = {};
  for (const [key, candidates] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
    const chosen = pick(candidates);
    if (chosen) usage[key] = chosen.example;
  }
  return usage;
}

export function render(usage) {
  const entries = Object.entries(usage)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  return `// GENERATED by builder/gen-chart-usage.mjs — do not edit by hand.
//
// One worked call per chart primitive, lifted out of the demo that already
// exercises it. Keyed "<domain>.<Name>", handed over on the REPAIR pass beside
// the signature and scoped to what the page imported.
//
// These are known-good by construction: every one is code that compiles today
// in src/components/charts. That is the whole reason to mine the demos rather
// than write examples from the types — an example I wrote from a signature
// would carry exactly the misreadings the example exists to prevent.
//
// Arrays are cut to two elements. The model needs the shape of a row, not the
// 420 points a demo happens to generate.
export const CHART_USAGE = {
${entries}
};
`;
}

if (process.argv[1] && process.argv[1].endsWith("gen-chart-usage.mjs")) {
  const usage = build();
  fs.writeFileSync(OUT, render(usage));
  console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${Object.keys(usage).length} worked examples`);
}
