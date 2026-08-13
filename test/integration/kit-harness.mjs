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
import { extract } from "../../builder/gen-component-api.mjs";
import { COMPONENT_TYPES } from "../../builder/component-api.mjs";

const TEMPLATE = path.join(import.meta.dirname, "../../builder/lovable/template");
const UI = path.join(TEMPLATE, "src/components/ui");
const OUT = path.join(TEMPLATE, ".kitrender");

export { TEMPLATE, UI, OUT };

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
    // A callback's return is never "the empty state" — that is about the DATA.
    return "() => (" + value(ret, mode === "empty" ? "full" : mode, types, depth + 1) + ")";
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
    case "number": return mode === "zeros" ? "0" : "3";
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
  [/(href|url|src|link|website|permalink)/i, '"https://example.com/page"'],
  [/(phone|tel|mobile)/i, '"+447700900000"'],
  [/(^|[a-z])(colour|color)$/i, '"#333333"'],
  // Anything time-shaped gets a real instant: `new Date("Sample")` is Invalid
  // Date and reading it throws RangeError.
  [/(date|time|at$|^at|on$|when|deadline|expires|expiry|start|end|since|until|updated|created|published|due)/i,
   '"2026-03-04T10:00:00.000Z"'],
];
function byName(key, t) {
  if (t !== "string" && t !== "number") return null;
  for (const [re, v] of BY_NAME) if (re.test(key)) return t === "number" ? null : v;
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
function typesVisibleTo(mod) {
  const own = COMPONENT_TYPES[mod] || {};
  const src = fs.readFileSync(path.join(UI, mod + ".tsx"), "utf8");
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

function propsFor(comp, mod, mode) {
  const types = { ...typesVisibleTo(mod), ...comp.generics };
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
    out.push([key, byName(key, t) || value(t, mode, types)]);
  }
  return out;
}

// ---- catalogue -------------------------------------------------------------
const files = fs.readdirSync(UI).filter((f) => f.endsWith(".tsx")).sort();
const entries = [];
for (const f of files) {
  const mod = f.replace(/\.tsx$/, "");
  const raw = fs.readFileSync(path.join(UI, f), "utf8");
  for (const comp of extract(raw)) {
    entries.push({ mod, name: comp.name, props: comp.props, generics: genericsOf(raw, comp.name) });
  }
}

export { entries, files };

// ---- render ----------------------------------------------------------------
const require_ = createRequire(import.meta.url);

function renderAll(mode) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  counter = 0;

  const imports = [], cases = [];
  entries.forEach((e, i) => {
    imports.push(`import { ${e.name} as C${i} } from "@/components/ui/${e.mod}";`);
    let props = "";
    try { props = propsFor(e, e.mod, mode).map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(", "); } catch { /* none */ }
    cases.push(`  { k: ${JSON.stringify(e.mod + "." + e.name)}, C: C${i}, props: { ${props} } },`);
  });

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
