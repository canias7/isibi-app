// RENDER every component in the kit, three ways, and read what came out.
//
// WHY THIS EXISTS. `kit-typecheck.mjs` next door proves the kit COMPILES, and
// this repo has proven more times than it has fingers that compiling is not
// working: 158 chart components typechecked perfectly and crashed on an empty
// array; 70 charts typechecked and rendered grey; `message-scroller`
// typechecked, bundled, and hard-crashed the page. Every one of those was found
// by a person looking at a render, months later, and only after a customer's
// site had it.
//
// WHY SSR AND NOT A BROWSER. Production PRERENDERS every route through
// `src/entry-server.tsx` before publishing, so `renderToString` IS the path a
// real customer's site takes — a component that throws here fails a real build.
// It is also ~100x faster than driving 2,000 components through Chromium, which
// is what makes running all of them on every change affordable.
//
// THE THREE PASSES, and each is a state a real site is really in:
//   full  — realistic props. The ordinary page.
//   empty — every array `[]`, every optional omitted. The FIRST render of every
//           list, and the permanent state of a site whose owner has added
//           nothing yet. This is the pass that would have caught the 158.
//   zeros — every number 0. A limit nobody set, a threshold on a plan with no
//           cap, a max of 0. `Math.min(100, NaN)` is NaN, so the guards that
//           look like they clamp a division do not.
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

let failed = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m, d) => { failed++; console.log("  FAIL " + m + (d ? "\n" + d : "")); };

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
    if (mode === "empty" || depth >= 3) return "[]";
    return "[" + [0, 1, 2].map(() => value(inner, mode, types, depth + 1)).join(", ") + "]";
  }
  if (/^(Array|ReadonlyArray)</.test(t)) {
    const inner = t.slice(t.indexOf("<") + 1, t.lastIndexOf(">"));
    if (mode === "empty" || depth >= 3) return "[]";
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
      return 'React.createElement("span", null, "Content")';
    case "object": return "{}";
    case "RegExp": return "/sample/g";
    case "HTMLElement": case "Element": return "null";
    default: break;
  }
  if (types && types[t]) return value(types[t], mode, types, depth + 1);
  if (/^Record</.test(t)) return "{}";
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

function propsFor(comp, mod, mode) {
  const types = COMPONENT_TYPES[mod] || {};
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
  for (const comp of extract(fs.readFileSync(path.join(UI, f), "utf8"))) {
    entries.push({ mod, name: comp.name, props: comp.props });
  }
}
console.log(`kit render — ${entries.length} components across ${files.length} modules`);

// THE CHECK MUST BE ABLE TO FAIL. A broken extractor yields an empty catalogue
// and every assertion below passes over nothing, reporting a clean kit — which
// is the most reassuring possible way to say that nothing was checked.
if (entries.length > files.length * 0.8) ok(`the catalogue covers ${entries.length} of ${files.length} modules`);
else bad(`the catalogue collapsed to ${entries.length} components — the extractor is broken, not the kit`);

// ---- render ----------------------------------------------------------------
const require_ = createRequire(import.meta.url);
const MODES = ["full", "empty", "zeros"];
const renderedClean = new Map(Object.keys(CANNOT_RENDER).map((k) => [k, new Set()]));

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
    console.error = () => {}; console.warn = () => {};
    try { out.push({ k: c.k, html: renderToString(React.createElement(c.C, c.props)) }); }
    catch (e: any) { out.push({ k: c.k, error: String(e && e.message ? e.message : e) }); }
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

try {
  for (const mode of MODES) {
    const results = renderAll(mode);

    const threw = results.filter((r) => r.error && !CANNOT_RENDER[r.k]);
    if (threw.length === 0) ok(`${mode}: nothing threw (${results.length} components)`);
    else bad(`${mode}: ${threw.length} threw`,
      threw.slice(0, 12).map((r) => `    ${r.k} -> ${r.error}`).join("\n"));

    // An allow-listed component that has started WORKING should leave the list,
    // or the list grows into the thing it was written not to be. Judged over
    // ALL THREE passes rather than each: `empty` sends only the required props,
    // so a component the harness cannot drive with a full set legitimately
    // renders clean there, and reporting that per-mode cries wolf on an entry
    // that is doing its job. Rendering fine in every mode is the honest test.
    for (const k of Object.keys(CANNOT_RENDER)) {
      if (results.some((r) => r.k === k && !r.error)) renderedClean.get(k).add(mode);
    }

    const html = results.filter((r) => r.html).map((r) => r);

    if (mode === "zeros") {
      // `Math.min` and `Math.max` pass NaN straight through, so a site that
      // divides by a limit nobody set writes `width: NaN%` and the browser
      // drops the declaration: the bar renders empty rather than broken.
      const nan = html.filter((r) => /NaN|-?Infinity/.test(r.html));
      if (nan.length === 0) ok("zeros: no NaN or Infinity reaches the page");
      else bad(`zeros: ${nan.length} render NaN or Infinity`, nan.slice(0, 10).map((r) => "    " + r.k).join("\n"));
    }

    if (mode === "full") {
      // `String(node)` on a prop typed `React.ReactNode` is "[object Object]",
      // and these are accessible names — the only name an icon button has.
      //
      // A GREEN RUN HERE IS NOT "THE KIT HAS NONE", and it took three escapes to
      // learn that. The props above are not SELF-CONSISTENT — an edge's `from`
      // names no node's `id` — so `String(at.get(e.from)?.label)` falls to its
      // `?? e.from` branch and the bug never renders; and `compare-table`'s made
      // the page show FEWER rows rather than a wrong string, so there was
      // nothing bad in the output to find at all. The source scan in
      // test/page-gen.test.mjs is the one that reads every site whether it
      // renders or not. Two checks, two blind spots, neither is the other's.
      const obj = html.filter((r) => r.html.includes("[object Object]"));
      if (obj.length === 0) ok("full: nothing stringifies a ReactNode into the page");
      else bad(`full: ${obj.length} render [object Object]`, obj.slice(0, 10).map((r) => "    " + r.k).join("\n"));

      const blank = html.filter((r) => r.html.length === 0);
      console.log(`  note ${blank.length} render nothing with props — conditional by design (a banner that is not showing)`);
    }
  }
  const stale = [...renderedClean].filter(([, m]) => m.size === MODES.length).map(([k]) => k);
  if (stale.length) bad("allow-listed and renders fine in every pass — remove from CANNOT_RENDER", "    " + stale.join(", "));
  else ok(`the ${renderedClean.size} allow-listed components still cannot be driven here`);
} finally {
  fs.rmSync(OUT, { recursive: true, force: true });
}

console.log(`\n${failed ? failed + " failed" : "all passed"}`);
process.exit(failed ? 1 : 0);
