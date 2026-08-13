// Derives the chart layer's names and signatures from src/components/charts/lib
// and writes builder/chart-api.mjs.
//
// WHY THE lib FOLDER AND NOT THE 1,140 FILES NEXT TO IT. `charts/chart-*.tsx`
// are demos: each is `export default function Component()` wrapping one
// primitive in a Card around hardcoded numbers — "Bookings 268 / 300 · January
// - June 2024". The reusable thing is what they import, `charts/lib/<domain>`,
// which is prop-driven and takes the site's own data. So the generator is told
// about the 875 primitives and the demos are refused by the lint; see the rule
// in page-gen.mjs for why that refusal has to exist rather than being left to
// tsc.
//
// TWO SCANS, NOT ONE, and the difference is load-bearing. Names come from a
// plain export scan, because everything exported is importable and a name the
// model is not given is a name it cannot use. Signatures come from the extractor
// below, which only reads props typed inline — so an export whose props live in
// a named type has a name here and no signature, and that is correct rather than
// a gap to paper over.
//
// GENERATED, NOT HAND-WRITTEN, for the reason gen-component-api.mjs states: 875
// hand-maintained entries would be wrong within a week, and an entry that
// disagrees with the file is worse than none because the model follows it.
// test/chart-api.test.mjs re-runs this and fails on any difference.
//
// Run: node builder/gen-chart-api.mjs
import fs from "node:fs";
import path from "node:path";

const LIB_DIR = path.join(import.meta.dirname, "lovable/template/src/components/charts/lib");
const OUT = path.join(import.meta.dirname, "chart-api.mjs");

/**
 * Every value export of a module, in source order.
 *
 * `export type` is deliberately not collected: a type is not something a page
 * renders, and listing one among the components invites an import of it as a
 * value, which is a compile error the model would have been talked into.
 */
export function exportedNames(source) {
  const names = [];
  for (const m of source.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

// ------------------------------------------------------------- signatures
//
// THE CHART LIB IS WRITTEN WITHOUT SEMICOLONS. The component kit's extractor
// collapses whitespace and then splits the prop block on `;`, which is right
// there and catastrophically wrong here: with no semicolons the entire block is
// ONE part, `indexOf(":")` finds the first colon, and every component came out
// as its first prop typed `object` —
//
//   ServiceMix(services: object)
//
// where the truth is `services: { name: string; bookings: number; minutes:
// number; price: number; materialCost?: number }[]`. That shipped, described to
// the model as "the real signatures, taken from the components themselves". A
// note that disagrees with the file is worse than no note, because the model
// follows it and the page is refused — which is the reason these are generated
// rather than written, and it defeated itself by borrowing the wrong splitter.

/** Everything between `open` and its matching close, brace-aware, quote-aware. */
function balanced(src, open, pair = "{}") {
  const [o, c] = pair;
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote && src[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === o) depth++;
    else if (ch === c) { depth--; if (!depth) return src.slice(open + 1, i); }
  }
  return null;
}

/** Comments out, NEWLINES KEPT — a newline is the separator in these files. */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "\n");

/** Split a props block on whichever separator the file uses: `;` or a newline. */
export function splitProps(body) {
  const out = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (c === quote && body[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if ("([{".includes(c) || (c === "<" && body[i + 1] !== "=")) depth++;
    else if (")]}".includes(c) || (c === ">" && body[i - 1] !== "=")) depth--;
    else if ((c === ";" || c === "\n") && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  // A field looks like `name:` or `name?:`. Anything else is a fragment of a
  // type that wrapped across lines, and joining it back on would be guesswork.
  return out.map((s) => s.trim()).filter((s) => /^[A-Za-z_]\w*\??\s*:/.test(s));
}

/** Shorten a type to something worth its tokens, keeping the shape. */
function shortType(t, full = false) {
  // A newline INSIDE the type is a field separator too, so it becomes `; ` —
  // collapsing it to a space produced `{ name: string bookedHours: number }[]`,
  // which is not TypeScript anyone would write and reads as a typo.
  const s = t.replace(/[ \t]*\n[ \t]*/g, "; ").replace(/\s+/g, " ")
    .replace(/;\s*([;}])/g, "$1").replace(/\{\s*;/g, "{").trim().replace(/;$/, "");
  // `full` is for a CALLER THAT HAS TO CONSTRUCT THE VALUE rather than read it —
  // `test/integration/kit-harness.mjs` synthesises props from these types, and a
  // truncated one loses the trailing `[]` as well as the fields, so an array prop
  // is built as an object and every component reports `x.map is not a function`.
  // The default is unchanged, so the generated prompt is byte-identical.
  if (full || s.length <= 90) return s;            // the row shape is the point
  if (/^\{[\s\S]*\}\[\]$/.test(s)) return s.slice(0, 87) + "…]";
  if (/=>/.test(s)) return "function";
  return s.slice(0, 87) + "…";
}

/** One signature per exported component with inline prop types. */
export function extractSignatures(rawSource, { full = false } = {}) {
  // A LENGTH-PRESERVING blank of every comment, used for every scan. `balanced`
  // counts brackets, and a doc comment containing one throws the depth off — the
  // scan then runs past the end of one component into the next and reports a
  // merged signature naming props from both. Blanking rather than removing keeps
  // every index valid against the real text, so the slices below are unaffected.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  const re = /export function (\w+)\s*(?:<[^>()]*>)?\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const dOpen = m.index + m[0].length - 1;
    const destruct = balanced(source, dOpen);
    if (destruct == null) continue;
    const after = source.slice(dOpen + destruct.length + 2);
    const ann = after.match(/^\s*:\s*\{/);
    if (!ann) continue;                            // props typed elsewhere — skipped on purpose
    const tOpen = dOpen + destruct.length + 2 + ann[0].length - 1;
    const types = balanced(source, tOpen);
    if (types == null) continue;

    const defaults = new Map();
    for (const part of splitProps(decomment(destruct).replace(/,/g, "\n"))) {
      const eq = part.indexOf("=");
      if (eq > 0) defaults.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    const props = [];
    for (const part of splitProps(decomment(types))) {
      const colon = part.indexOf(":");
      const raw = part.slice(0, colon).trim();
      const key = raw.replace(/\?$/, "");
      // `className` is on every one. Stated once in the rules, not 882 times.
      if (key === "className") continue;
      const d = defaults.get(key);
      props.push(`${key}${raw.endsWith("?") ? "?" : ""}: ${shortType(part.slice(colon + 1), full)}` +
        (d ? ` = ${d.replace(/\s+/g, " ")}` : ""));
    }
    if (props.length) out.push({ name: m[1], props });
  }
  return out;
}

export function build() {
  const components = {};
  const api = {};
  for (const file of fs.readdirSync(LIB_DIR).filter((f) => f.endsWith(".tsx")).sort()) {
    const source = fs.readFileSync(path.join(LIB_DIR, file), "utf8");
    const domain = file.replace(/\.tsx$/, "");
    // COMPONENTS ONLY. `exportedNames` returns every export, and several modules
    // ship a data FABRICATOR beside the chart — `sampleBoxes`, `rng`, `density`,
    // `seed`. Those are real exports, so importing one compiles and bundles, and
    // the model reading a catalogue of "chart components" has no way to tell them
    // apart: it would publish a chart of random numbers to a real business's
    // visitors. Exactly what the demo-import lint exists to stop, arriving
    // through the catalogue instead.
    //
    // A React component is PascalCase by convention and every real one here
    // follows it, so the initial capital is the whole filter — and it is derived
    // rather than a deny-list, which would need a new entry every time somebody
    // adds a helper.
    const names = exportedNames(source).filter((n) => /^[A-Z]/.test(n));
    if (!names.length) continue;
    components[domain] = names;
    const sigs = extractSignatures(source);
    if (sigs.length) api[domain] = sigs.map((f) => `${f.name}(${f.props.join(", ")})`).join(" · ");
  }
  return { components, api };
}

export function render({ components, api }) {
  const dump = (o) => Object.entries(o)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  const total = Object.values(components).reduce((n, v) => n + v.length, 0);
  return `// GENERATED by builder/gen-chart-api.mjs — do not edit by hand.
//
// ${total} chart primitives across ${Object.keys(components).length} domain modules, each
// imported from "@/components/charts/lib/<domain>".
//
// CHART_COMPONENTS is domain -> every name that module exports, and it is what
// the compose prompt spends its tokens on: a name the model is never given is a
// component nothing can reach, which this repo has proved twice — the 27 blocks
// and the 196 examples were both installed, both compiled, and both were
// deleted having never been importable by anything, because no rule ever said
// they were there.
//
// GROUPED BY DOMAIN RATHER THAN FLAT, and not only for readability: six names
// are exported by two different modules each (IncidentTimeline, LapseCurve,
// MortalityTable, PowerCurve, ReserveRunoff, RouteDensity), so a flat list would
// name a component the model cannot then locate.
//
// CHART_API is the signature half, handed over on the REPAIR pass only and
// scoped to what the page actually imported — the same split the component kit
// uses, and for the same measured reason: all of them at once is unaffordable,
// and the twenty a page uses is exactly where a wrong prop name gets fixed.
export const CHART_COMPONENTS = {
${dump(components)}
};

export const CHART_API = {
${dump(api)}
};
`;
}

if (process.argv[1] && process.argv[1].endsWith("gen-chart-api.mjs")) {
  const built = build();
  fs.writeFileSync(OUT, render(built));
  const total = Object.values(built.components).reduce((n, v) => n + v.length, 0);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${total} primitives across ` +
    `${Object.keys(built.components).length} domains, ${Object.keys(built.api).length} with signatures`);
}
