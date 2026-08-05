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
  // A UNION OF STRING LITERALS IS NEVER TRUNCATED. Those values are the whole
  // contract — a caller has to write one of them EXACTLY — and a trimmed union
  // is worse than no note at all: it reads as authoritative while hiding the
  // member you needed. Measured live 2026-08-04, `StatusBadge` came out as
  // `"success" | "warning" | "danger" | "neutral…` and the generator wrote
  // `"error"`, which is a reasonable guess at what the ellipsis was covering and
  // is not one of the values. TS2322, page refused, whole site a placeholder.
  //
  // They are cheap to keep whole: the longest in the kit is a few dozen
  // characters, against ~9,000 tokens for the entire shortlist, and it rides in
  // the cached block.
  if (/^(?:"[^"]*"\s*\|\s*)+"[^"]*"$/.test(s)) return s;
  if (s.length <= 46) return s;
  // AN INLINE OBJECT LITERAL IS THE SAME CONTRACT AS A STRING UNION, and it was
  // being collapsed for the same reason the union used to be truncated: it
  // looked long. `object` reads as "any object", so the model invents property
  // names — measured live 2026-08-05, `BulkActions(actions: object[])` was
  // called with `{label, onClick}` where the prop is
  // `{label, onSelect, destructive?}`. TS2353, page refused, whole site a
  // placeholder. It was under the limit for `FilterBar` and over it here, so
  // whether the model could get the call right came down to how many characters
  // the shape happened to spell.
  //
  // Worse than a truncated union, because there is nowhere else to look:
  // `COMPONENT_TYPES` only resolves `export type` names, so an inline shape lost
  // here is unrecoverable. 35 props in the shortlist read `object`.
  //
  // The names survive even when the shape does not fit — `{ label; onSelect;
  // destructive? }` is a call the model can write, where `object` is a guess.
  if (/^\{[\s\S]*\}(\[\])?$/.test(s)) return s.length <= 200 ? s : keysOnly(s);
  // A function's PARAMETERS are a contract too — `(next: string) => void` and
  // `(id: number, done: boolean) => void` are not interchangeable, and
  // `function` says neither.
  if (/=>/.test(s)) return s.length <= 120 ? s : "function";
  return s.slice(0, 43) + "…";
}

/**
 * A shape too long to print, reduced to the property NAMES.
 *
 * Between `object` and the full type there is a third answer, and it is most of
 * the value: a caller who knows the keys writes a call that compiles, and a
 * wrong type is a clearer error than a wrong property name. Optionality is kept
 * because it changes whether the key may be omitted.
 */
function keysOnly(s) {
  const arr = /\}\[\]$/.test(s);
  const body = s.replace(/^\{/, "").replace(/\}(\[\])?$/, "");
  const keys = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (i === body.length || (c === ";" && depth === 0)) {
      const part = body.slice(start, i).trim();
      const colon = part.indexOf(":");
      if (colon > 0) keys.push(part.slice(0, colon).trim());
      start = i + 1;
    }
  }
  return keys.length ? `{ ${keys.join("; ")} }${arr ? "[]" : ""}` : (arr ? "object[]" : "object");
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

/**
 * The named types those signatures stop at.
 *
 * A SIGNATURE THAT SAYS `Activity[]` TELLS THE MODEL NOTHING. Measured live
 * 2026-08-04: `ActivityFeed(items: Activity[], …)` was in the prompt, the model
 * passed `{title, description}[]`, and `Activity` is
 * `{who, what, at, avatar?}` — completely different fields, and no way to know.
 * One error, and it was the ONLY thing between the booking sample and a pass.
 *
 * Read with BALANCED BRACES, not up to the first `;`: these are object literals
 * whose fields are semicolon-separated, so a lazy match returns
 * `Activity = { who: string` and looks like it worked.
 */
export function buildTypes() {
  const out = {};
  for (const file of fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".tsx")).sort()) {
    const slug = file.replace(/\.tsx$/, "");
    const src = fs.readFileSync(path.join(UI_DIR, file), "utf8");
    for (const m of src.matchAll(/export type ([A-Z][A-Za-z0-9]*) = /g)) {
      const name = m[1];
      let i = m.index + m[0].length, depth = 0, end = -1;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
        else if (c === ";" && depth === 0) { end = i; break; }
        else if (c === "\n" && depth === 0 && src[i + 1] === "\n") { end = i; break; }
      }
      if (end < 0) continue;
      const body = tidy(src.slice(m.index + m[0].length, end));
      // A union of other names or a bare alias says nothing the signature did
      // not; only a shape is worth the tokens.
      if (!body.startsWith("{") || body.length > 400) continue;
      // KEYED PER COMPONENT, and that is not tidiness. A flat map collapsed the
      // TWO different `Activity` types in this kit — activity-feed's
      // `{who, what, at, avatar?}` and facility-status's
      // `{name, state, detail?…}` — and last-one-wins meant the prompt would
      // have carried the wrong shape for one of them. A wrong type is worse than
      // no type: it looks authoritative, which is exactly what the truncated
      // enum did earlier today.
      (out[slug] || (out[slug] = {}))[name] = body;
    }
  }
  return out;
}

export function render(api, types = buildTypes()) {
  const typeEntries = Object.entries(types)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
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

// The shapes those signatures stop at — see buildTypes().
export const COMPONENT_TYPES = {
${typeEntries}
};
`;
}

if (process.argv[1] && process.argv[1].endsWith("gen-component-api.mjs")) {
  const api = build();
  fs.writeFileSync(OUT, render(api));
  console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${Object.keys(api).length} components`);
}
