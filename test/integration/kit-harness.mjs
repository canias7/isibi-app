// THE SHARED HALF OF THE KIT HARNESSES: build the catalogue, synthesise props
// for every component, render them, hand back the html.
//
// A MODULE BECAUSE THERE ARE TWO CALLERS AND THE SYNTHESISER IS THE HARD PART.
// `kit-render.mjs` reads the html for what a string can show — a throw, a NaN,
// "[object Object]" — and `kit-a11y.mjs` puts the SAME html through Chromium to
// ask what the accessibility tree makes of it. Two copies of 200 lines of
// prop-guessing would drift within a week, and each harness would then be
// reporting about a different set of props than the other.
//
// WHY SSR AND NOT A BROWSER for the render itself: production PRERENDERS every
// route through `src/entry-server.tsx` before publishing, so `renderToString`
// IS the path a real customer's site takes — a component that throws here fails
// a real build — and it is ~100x faster than driving 2,000 components through
// Chromium, which is what makes running all of them on every change affordable.
//
// $0: no model call, no container, no Neon project.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { extract, extractTypes } from "../../builder/gen-component-api.mjs";
import { extractSignatures, splitProps } from "../../builder/gen-chart-api.mjs";
import { COMPONENT_TYPES } from "../../builder/component-api.mjs";

const TEMPLATE = path.join(import.meta.dirname, "../../builder/lovable/template");
const UI = path.join(TEMPLATE, "src/components/ui");
const CHART_LIB = path.join(TEMPLATE, "src/components/charts/lib");
const OUT = path.join(TEMPLATE, ".kitrender");

export { TEMPLATE, UI, CHART_LIB, OUT };

/**
 * COMPONENTS THAT CANNOT BE RENDERED BY THIS HARNESS, with the reason each.
 *
 * A list, and deliberately a SHORT one that has to be justified: the failure
 * this file exists to prevent is a check that quietly stops covering things, and
 * an allow-list is the usual way that happens. Every entry here was driven by
 * hand with real props and rendered clean — none is a defect being waved past.
 */
const CANNOT_RENDER = {
  // `useRouter` / `<Link>` need a RouterProvider, and standing one up in SSR
  // means a route tree, which is `site-build.mjs`'s job rather than this one's.
  // Both ARE driven for real there, in a real browser, at both mounts.
  "site-chrome.SiteChrome": "needs a RouterProvider",
  "site-header.SiteHeader": "needs a RouterProvider",
  // A RECURSIVE PROP TYPE — `children?: Clade[]` on the thing being built — so
  // the synthesiser bottoms out at its depth cap and hands over a tree that is
  // not one. Real data renders it fine; there is no way to invent a tree from a
  // type without deciding how deep it should be, and any answer is arbitrary.
  "biolang.PhylogeneticTree": "prop type is recursive — no synthesised value is a real tree",
};
export { CANNOT_RENDER };

// ---- synthesising props ----------------------------------------------------
// The whole difficulty of this harness is FALSE ALARMS. A component handed
// "Sample" as a currency code throws, and reporting that as a defect is how an
// audit becomes something people ignore. Everything below is about handing each
// prop something its own type actually permits.

/** Split on a separator that is not inside brackets, quotes, or an arrow. */
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote && s[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if ("([{<".includes(c)) depth++;
    // `=>` is not a closing bracket. Without this `(row: T) => X` drives the
    // depth negative and every field after a function-typed prop disappears.
    else if (">)]}".includes(c)) { if (!(c === ">" && s[i - 1] === "=")) depth = Math.max(0, depth - 1); }
    else if (c === sep && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const STR = ["Sample", "Second entry", "Third entry"];
/** Props that describe the DRAWING rather than the data. */
const DIMENSION = /^(height|width|size|radius|thickness|gap|padding|stroke|cellSize|barWidth)$/i;
/** The prop name currently being built, so a scalar can be judged by it. */
let lastKey = "";
let counter = 0;

function value(type, mode, types, depth = 0) {
  const t = String(type).trim().replace(/\s+/g, " ");
  if (depth > 4) return '"Sample"';

  const union = splitTop(t, "|");
  if (union.length > 1) {
    const live = union.filter((u) => u !== "null" && u !== "undefined");
    return value(live[0] || "string", mode, types, depth + 1);
  }

  // A function RETURNS something. `() => {}` returns undefined, and a component
  // that renders what its `format` callback gave it then shows "undefined" —
  // reporting a component that is correct, because no real caller can return
  // undefined from `(n: number) => string`.
  if (/^\(.*\)\s*=>/.test(t) || (/=>/.test(t) && splitTop(t, ";").length === 1 && /^\(/.test(t))) {
    const ret = t.slice(t.indexOf("=>") + 2).trim();
    if (!ret || ret === "void" || ret === "unknown") return "() => {}";
    // A KEY FUNCTION MUST ANSWER DIFFERENTLY FOR DIFFERENT ROWS. A stub
    // returning one constant made `rowKey: (r, i) => RowId` hand the same key to
    // every row, and React reported duplicate keys on components whose keys are
    // fine with real data. Only for a scalar return — an object or an element
    // has no sensible "next one", and a caller relying on identity there is
    // relying on something a stub cannot provide either way.
    const inner = value(ret, mode === "empty" ? "full" : mode, types, depth + 1);
    if (/^"/.test(inner) || /^-?\d/.test(inner)) {
      const n = "n" + counter++;
      const varying = /^"/.test(inner)
        ? inner.slice(0, -1) + ' " + ' + n + "++"     // "Sample 5 " + n0++
        : inner + " + " + n + "++";                    // 3 + n0++
      return `(() => { let ${n} = 0; return () => (${varying}); })()`;
    }
    // A callback's return is never "the empty state" — that is about the DATA.
    return "() => (" + inner + ")";
  }

  // A TUPLE IS NOT A LIST. `supports: [number, number]` and `a: [string, string]`
  // have a fixed arity the component relies on — `b.map` on a string is what the
  // harness reported for three of these — and they are NOT emptied by the empty
  // passes, because a two-element tuple that arrives empty is a caller error
  // rather than the state a fresh site is in.
  if (/^\[.*\]$/.test(t) && !t.startsWith("[]")) {
    const parts = splitTop(t.slice(1, -1), ",");
    if (parts.length > 1 || (parts.length === 1 && !/\[\]$/.test(t.slice(1, -1))))
      return "[" + parts.map((p) => value(p, mode === "empty" ? "full" : mode, types, depth + 1)).join(", ") + "]";
  }

  if (t.endsWith("[]")) {
    const inner = t.slice(0, -2).replace(/^\((.*)\)$/, "$1");
    // A LIST BOTTOMS OUT AS AN EMPTY LIST, not as the depth cap's fallback
    // string. The recursion that gets this deep is always a tree — `reports?:
    // OrgNode[]` on an org chart, `children?: Node[]` on a nav — and a leaf with
    // no children is what real data looks like. Falling through to the cap
    // handed `OrgChart` a list of the STRING "Sample", it iterated one and read
    // `.name` off a character, and the harness reported a component that is
    // correct. Costs a little coverage four levels down; a false alarm costs
    // more than that.
    if (mode === "empty" || mode === "blank" || depth >= 3) return "[]";
    return "[" + [0, 1, 2].map(() => value(inner, mode, types, depth + 1)).join(", ") + "]";
  }
  if (/^(Array|ReadonlyArray)</.test(t)) {
    const inner = t.slice(t.indexOf("<") + 1, t.lastIndexOf(">"));
    if (mode === "empty" || mode === "blank" || depth >= 3) return "[]";
    return "[" + [0, 1].map(() => value(inner, mode, types, depth + 1)).join(", ") + "]";
  }

  if (t.startsWith("{") && t.endsWith("}")) {
    const out = [];
    for (const f of splitTop(t.slice(1, -1), ";")) {
      const colon = f.indexOf(":");
      if (colon <= 0) continue;
      const raw = f.slice(0, colon).trim();
      const key = raw.replace(/\?$/, "");
      if (!/^[A-Za-z_]\w*$/.test(key)) continue;
      if (raw.endsWith("?") && mode === "empty") continue;
      const ft = f.slice(colon + 1).trim();
      lastKey = key;
      out.push(JSON.stringify(key) + ": " + (byName(key, ft) || value(ft, mode, types, depth + 1)));
    }
    return "{ " + out.join(", ") + " }";
  }

  if (/^["'].*["']$/.test(t)) return '"' + t.slice(1, -1) + '"';
  // A NUMERIC literal union — `columns?: 1 | 2 | 3 | 4` arrives here one member
  // at a time, and falling through to the default handed the component the
  // STRING "Sample", which made `Math.min(columns, 4)` NaN and accused a
  // component that is correct.
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;

  switch (t) {
    case "string": { const n = counter++; return JSON.stringify(STR[n % STR.length] + " " + n); }
    // `zeros` IS ABOUT A LIMIT NOBODY SET, not about a chart being nought pixels
    // tall. A `height`/`width`/`size` of 0 makes every scale in an SVG
    // degenerate, so the pass reported 355 charts writing NaN — all of them
    // answering a question nobody asks. Named like `BY_NAME` above, and for the
    // same reason: a prop whose own name says what it is should get a value its
    // component can survive.
    // A VARYING NUMBER, because a constant one makes every row's id identical.
    // Every numeric field was 3, so `key={o.value}` on a list of three objects
    // produced three children with the same key — React reported 60 components
    // for a duplicate-key bug that is entirely the harness's. Strings already
    // varied by the same counter; numbers did not.
    case "number": return mode === "zeros" && !DIMENSION.test(lastKey) ? "0" : String(3 + (counter++ % 9));
    case "boolean": return "true";
    // A FIXED instant, never `Date.now()`: a moving clock makes a failure
    // unreproducible, and this has to be re-runnable to be worth anything.
    case "Date": return 'new Date("2026-03-04T10:00:00Z")';
    case "null": return "null";
    case "undefined": return "undefined";
    case "unknown": case "any": return '"Sample"';
    case "React.ReactNode": case "ReactNode": case "React.ReactElement":
      // An ELEMENT, not a string — that is what the type permits, and it is the
      // shape that catches `String(label)` rendering "[object Object]".
      //
      // WITH A KEY, because a `ReactNode[]` prop is a list the CALLER keys —
      // `CommentThread({ replies })` renders them straight into a div, so
      // keyless elements from here make React blame the component for the
      // harness's own array. React ignores a key on a lone child, so this costs
      // nothing anywhere else.
      return `React.createElement("span", { key: ${counter++} }, "Content")`;
    case "object": return "{}";
    case "RegExp": return "/sample/g";
    case "HTMLElement": case "Element": return "null";
    default: break;
  }
  if (types && types[t]) return value(types[t], mode, types, depth + 1);
  // A GENERIC ARGUMENT LIST DEFEATED THE LOOKUP, which is this repo's most
  // repeated regex trap arriving in the synthesiser. `COMPONENT_TYPES` records
  // `Column` with the parameter erased, so `columns: Column<T>[]` found nothing
  // and every column became the string "Sample" — `c.key` was `undefined`, and
  // React reported eight components for a missing `key` that is right there in
  // their source. `Partial<X>` is unwrapped for the same reason: a partial of a
  // shape is that shape with everything optional, which is a shape we have.
  const bare = /^Partial<(.+)>$/.exec(t)?.[1] ?? t.replace(/<.*>$/, "");
  if (types && bare !== t && types[bare]) return value(types[bare], mode, types, depth + 1);
  if (/^Record</.test(t)) return "{}";
  // A PROPS BAG IS AN OBJECT, and the string fallback below is spread into JSX.
  // `dragProps?: React.HTMLAttributes<HTMLButtonElement>` became `{..."Sample"}`,
  // which is `{0:"S", 1:"a", …}` — React reported six "Invalid attribute name"
  // warnings against a component that is perfectly correct.
  if (/^React\./.test(t) || /(Props|Attributes)$/.test(t)) return "{}";
  return '"Sample"';
}

// Realistic values BY PROP NAME. Without these the harness reports the kit as
// broken when it handed a currency formatter the word "Sample".
const BY_NAME = [
  [/^(locale|lang|language)$/i, '"en-GB"'],
  [/^(currency|currencyCode)$/i, '"GBP"'],
  [/(^|[a-z])(timezone|timeZone|tz)$/i, '"Europe/London"'],
  [/^(country|countryCode)$/i, '"GB"'],
  [/(email|mailto)/i, '"someone@example.com"'],
  // VARYING, like the strings above. A constant made every item's href
  // identical, so a list keyed on one reported duplicates that real data does
  // not have.
  [/(href|url|src|link|website|permalink)/i, () => `"https://example.com/page-${counter++}"`],
  [/(phone|tel|mobile)/i, '"+447700900000"'],
  [/(^|[a-z])(colour|color)$/i, '"#333333"'],
  // Anything time-shaped gets a real instant: `new Date("Sample")` is Invalid
  // Date and reading it throws RangeError.
  // ANCHORED, because the loose form matched `on$` — and therefore `question`,
  // `description`, `location`, `reason`, `caption`, `action`, `position`. 240 of
  // the 447 prop names it matched were not dates at all, so each got the same
  // fixed ISO string: nonsense in the slot, and IDENTICAL nonsense, which made
  // React report duplicate keys on 40 components whose keys are perfectly
  // unique with real text.
  [/(date|time|deadline|expir|since|until|updated|created|published)/i, '"2026-03-04T10:00:00.000Z"'],
  [/^(at|on|due|when|start|end|from|to)$/i, '"2026-03-04T10:00:00.000Z"'],
  [/(At|On|Date|Time)$/, '"2026-03-04T10:00:00.000Z"'],
];
function byName(key, t) {
  if (t !== "string" && t !== "number") return null;
  for (const [re, v] of BY_NAME) if (re.test(key)) return t === "number" ? null : (typeof v === "function" ? v() : v);
  return null;
}

/**
 * The shapes a module can name — its own, plus the ones it IMPORTS.
 *
 * `COMPONENT_TYPES` is per-file, so `cart-summary`'s `lines: SummaryLine[]`
 * resolved to nothing: `SummaryLine` is declared in `order-summary` and
 * imported. Every such prop became the string "Sample", so `l.label` was
 * undefined, so `key={l.label}` was undefined — and React reported six
 * components for a missing `key` that is written correctly in all of them.
 *
 * FOLLOWED THROUGH THE IMPORT, not merged globally: two modules declare an
 * `Activity` with different fields, and a flat merge would hand one of them the
 * other's shape — a silent wrong answer in place of a visible missing one.
 */
/**
 * `type X = { … }` in a file written WITHOUT semicolons, using the chart lib's
 * own splitter so a newline counts as a field separator. Emitted in the
 * `a: T; b: U` shape the synthesiser's object branch reads.
 */
function chartTypes(src) {
  const out = {};
  for (const m of src.matchAll(/(?:export )?type ([A-Z][A-Za-z0-9]*)\s*=\s*\{/g)) {
    let i = m.index + m[0].length - 1, d = 0, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === "{") d++;
      else if (src[i] === "}") { d--; if (!d) { end = i; break; } }
    }
    if (end < 0) continue;
    const body = src.slice(m.index + m[0].length, end).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "\n");
    const fields = splitProps(body).map((p) => p.replace(/\s+/g, " ").trim());
    if (fields.length) out[m[1]] = "{ " + fields.join("; ") + " }" + (src.slice(end + 1, end + 3) === "[]" ? "[]" : "");
  }
  return out;
}

function typesVisibleTo(e) {
  // THE ENTRY'S OWN FILE, not a hardcoded directory. This read `UI/<mod>.tsx`
  // unconditionally, so every one of the 854 chart primitives threw ENOENT here
  // — and the caller swallowed it, sent no props at all, and reported 805
  // components as crashing. A wall of false findings out of one wrong path.
  const src = fs.readFileSync(e.file, "utf8");
  // LOCAL TYPES TOO for a file with no recorded entry — a chart module
  // declares `type PlanNode = {…}` unexported, and without it the prop is a
  // string and the component reports a throw that is the harness's fault.
  // THE COMPONENT EXTRACTOR SPLITS ON `;` AND THE CHART LIB HAS NONE, which is
  // the same trap that required `gen-chart-api` to have its own reader in the
  // first place. `export type WaterIons = { calcium: number\n magnesium: number }`
  // came back as one field, so `source` was the string "Sample" and the chart
  // rendered `SO₄:Cl NaN` — a harness fault reported as a defect.
  //
  // `COMPONENT_TYPES` is scoped to ui entries rather than looked up by bare
  // module name: the two tiers are separate directories and nothing stops a
  // `charts/lib/x.tsx` sharing a name with a `ui/x.tsx`, at which point the
  // chart would silently be handed the other one's shapes.
  const own = e.spec.startsWith("@/components/ui/")
    ? (COMPONENT_TYPES[e.mod] || extractTypes(src, { exported: false }))
    : chartTypes(src);
  const out = {};
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"@\/components\/ui\/([\w-]+)"/g)) {
    const from = COMPONENT_TYPES[m[2]];
    if (!from) continue;
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (from[name]) out[name] = from[name];
    }
  }
  return { ...out, ...own }; // a local declaration wins over an imported one
}

/**
 * A component's own generic parameters, resolved to their CONSTRAINTS.
 *
 * `RecentlyViewed<T extends { id: string }>({ items }: { items: T[] })` is the
 * shape every row-taking component in the kit has, and `T` resolves to nothing
 * — so `items` became a list of strings, `i.id` was undefined, and `key={i.id}`
 * was undefined. The constraint is exactly the information needed and it is
 * written right there in the signature.
 */
function genericsOf(src, name) {
  const m = new RegExp("export function " + name + "\\s*<((?:[^<>]|<[^<>]*>)*)>").exec(src);
  if (!m) return {};
  const out = {};
  for (const part of splitTop(m[1], ",")) {
    const ext = /^([A-Za-z_]\w*)\s+extends\s+([\s\S]+)$/.exec(part.trim());
    if (ext) out[ext[1]] = ext[2].replace(/\s*=\s*[^=]*$/, "").trim();
  }
  return out;
}

function propsFor(comp, mode) {
  const types = { ...typesVisibleTo(comp), ...comp.generics };
  const out = [];
  for (const p of comp.props) {
    const eq = p.indexOf(" = ");
    const decl = eq > 0 ? p.slice(0, eq) : p;
    const colon = decl.indexOf(":");
    if (colon <= 0) continue;
    const raw = decl.slice(0, colon).trim();
    const key = raw.replace(/\?$/, "");
    // The empty pass sends only what the signature says is REQUIRED — the
    // narrowest legitimate call, and the one a page makes on a fresh site.
    if (raw.endsWith("?") && mode === "empty") continue;
    const t = decl.slice(colon + 1).trim();
    lastKey = key;
    out.push([key, byName(key, t) || value(t, mode, types)]);
  }
  return out;
}

// ---- catalogue -------------------------------------------------------------
/**
 * Every exported component in a directory, with the specifier that imports it.
 *
 * TWO EXTRACTORS, because the two tiers are written differently and one reader
 * gets the other wrong. `gen-chart-api`'s is newline-aware for a reason already
 * recorded in CLAUDE.md: the chart lib has no semicolons, so the component
 * extractor's splitter collapses a whole prop block into one field typed
 * `object`. Borrowing the wrong one produced exactly that, across all 141
 * domains, the last time somebody tried.
 */
function catalogue(dir, spec, read) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort() : [];
  const entries = [];
  for (const f of files) {
    const mod = f.replace(/\.tsx$/, "");
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    for (const comp of read(raw)) {
      entries.push({
        mod, name: comp.name, props: comp.props,
        file: path.join(dir, f),
        spec: `${spec}/${mod}`,
        generics: genericsOf(raw, comp.name),
        // A SIGNATURE THE EXTRACTOR CUT SHORT cannot be synthesised from: the
        // `…]` means fields are missing, so the `full` pass would hand the
        // component an object without a field it requires and report a throw
        // that is the harness's fault. It still goes through the empty passes,
        // where every array is `[]` and the missing fields are inside the array.
        truncated: comp.props.some((p) => p.includes("…")),
      });
    }
  }
  return { entries, files };
}

const ui = catalogue(UI, "@/components/ui", extract);
// FULL types, not the prompt's shortened ones: a truncated `{ … }[]` loses its
// trailing `[]`, so the synthesiser builds an object where the component wants
// an array and 66 of them report `x.map is not a function`.
const charts = catalogue(CHART_LIB, "@/components/charts/lib", (raw) => extractSignatures(raw, { full: true }));
const entries = ui.entries, files = ui.files;

export { entries, files, catalogue };
/** The 882 prop-driven primitives under `charts/lib`, which are what a generated
 *  page imports — not the 1,140 `chart-*.tsx` demos, which take no props and
 *  fabricate their own figures. */
export const chartEntries = charts.entries;
export const chartFiles = charts.files;

// ---- render ----------------------------------------------------------------
const require_ = createRequire(import.meta.url);

/** Components whose props could not be synthesised on the last build. A harness
 *  fault, never a finding — the runner reports it as its own failure. */
export const synthFailures = [];

/**
 * Each component with the specifier that imports it and its props as SOURCE.
 *
 * Shared so that `kit-render.mjs` (server-renders the html) and
 * `kit-effects.mjs` (mounts it in a browser) are talking about the same call.
 * Two copies of the synthesis would mean one harness finding a defect the other
 * cannot reproduce, and no way to tell which of them was wrong.
 */
export function casesFor(list, mode) {
  synthFailures.length = 0;
  counter = 0;
  return list.map((e) => {
    // NOT SWALLOWED. This was `catch { /* none */ }`, which sends a component
    // no props at all — so every required one is undefined and it throws, and
    // the report blames the component for a fault in the synthesiser. That is
    // precisely how one wrong path turned into 805 false findings.
    let props = "";
    try { props = propsFor(e, mode).map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(", "); }
    catch (err) { synthFailures.push(`${e.mod}.${e.name}: ${err.message}`); }
    return { k: e.mod + "." + e.name, name: e.name, spec: e.spec, props };
  });
}

function renderAll(mode, list = entries) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const built = casesFor(list, mode);
  const imports = built.map((c, i) => `import { ${c.name} as C${i} } from "${c.spec}";`);
  const cases = built.map((c, i) => `  { k: ${JSON.stringify(c.k)}, C: C${i}, props: { ${c.props} } },`);

  fs.writeFileSync(path.join(OUT, "entry.tsx"), `import React from "react";
import { renderToString } from "react-dom/server";
${imports.join("\n")}
const CASES: any[] = [
${cases.join("\n")}
];
export function run() {
  const out: any[] = [];
  const realErr = console.error, realWarn = console.warn;
  for (const c of CASES) {
    // CAPTURED, NOT DISCARDED. React itself reports invalid DOM nesting and a
    // list with no keys through console.error, and silencing it threw away the
    // one class of finding the renderer hands over for free.
    const said: string[] = [];
    const grab = (...a: any[]) => { said.push(a.map((x) => String(x)).join(" ")); };
    console.error = grab; console.warn = grab;
    try { out.push({ k: c.k, html: renderToString(React.createElement(c.C, c.props)), said }); }
    catch (e: any) { out.push({ k: c.k, error: String(e && e.message ? e.message : e), said }); }
    finally { console.error = realErr; console.warn = realWarn; }
  }
  return out;
}
`);

  const esbuild = require_(path.join(TEMPLATE, "node_modules/esbuild/lib/main.js"));
  const r = esbuild.buildSync({
    entryPoints: [path.join(OUT, "entry.tsx")],
    bundle: true,
    // CJS, not ESM: several Radix deps ship CommonJS that calls require("react")
    // at runtime, which an ESM bundle answers with a throwing shim.
    format: "cjs",
    platform: "node",
    outfile: path.join(OUT, "bundle.cjs"),
    jsx: "automatic",
    alias: { "@": path.join(TEMPLATE, "src") },
    nodePaths: [path.join(TEMPLATE, "node_modules")],
    external: ["react", "react-dom", "react-dom/server"],
    logLevel: "error",
    absWorkingDir: TEMPLATE,
  });
  if (r.errors?.length) throw new Error(r.errors.map((e) => e.text).join("\n"));
  // A fresh require each pass: the bundle is rewritten between modes.
  delete require_.cache?.[path.join(OUT, "bundle.cjs")];
  return require_(path.join(OUT, "bundle.cjs")).run();
}

/** Each pass is a state a real site is really in — see kit-render.mjs. */
export const MODES = ["full", "empty", "zeros", "blank"];
export { renderAll };
