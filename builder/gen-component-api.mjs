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
  // A union that MIXES literals with a shape is the same contract as either
  // half and was being cut at the join. `source-label` resolved to
  // `"owner" | "member" | "imported" | "ai" | { label: string; meaning?: string }`
  // and printed as `"owner" | "member" | "imported" | "ai" | { …` — so the
  // alternative that is NOT one of the four words, the one a caller reaches for
  // precisely when none of them fits, was the part hidden. Bounded like the
  // object rule rather than kept without limit, since only one member has to be
  // a literal to land here.
  if (/"[^"]*"\s*\|/.test(s) && s.length <= 200) return s;
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

/**
 * The literal keys of a module-private `const X = { … }`, as a union.
 *
 * DELIBERATELY ONLY THE UNANNOTATED FORM. `const X = {…}` is what makes
 * TypeScript infer literal keys; `const X: Record<string, T> = {…}` has
 * `keyof` of `string`, so listing its keys would tell the model that the
 * twenty it happens to hold are the only ones allowed when in fact any string
 * is. `care-icons` is that case — narrowing it would be a worse lie than the
 * unresolved name, and this regex declines it by construction.
 */
function constKeyUnion(source, name) {
  const m = new RegExp("\\bconst\\s+" + name + "\\s*=\\s*\\{").exec(source);
  if (!m) return null;
  const body = block(source, m.index + m[0].length - 1);
  if (body == null) return null;
  const keys = [];
  for (const part of splitTop(tidy(body), ",")) {
    const colon = part.indexOf(":");
    if (colon <= 0) continue;
    let k = part.slice(0, colon).trim();
    if (/^["'].*["']$/.test(k)) k = k.slice(1, -1);
    if (!/^[A-Za-z0-9_-]+$/.test(k)) continue;
    keys.push('"' + k + '"');
  }
  return keys.length ? keys.join(" | ") : null;
}

/**
 * A `type X = "a" | "b"` alias, but ONLY when every member is a string literal.
 *
 * The body is put through the keyof resolution FIRST, because the alias is
 * routinely a name for one: `tag-scope` declares
 * `export type TagScopeValue = keyof typeof SCOPES`, which is two hops from
 * anything the model can read and was the last of the nine still opaque after
 * the direct case was fixed.
 */
function aliasUnion(source, name) {
  const m = new RegExp("\\btype\\s+" + name + "\\s*=\\s*([^;\\n]+)").exec(source);
  if (!m) return null;
  const body = resolveKeyof(tidy(m[1]), source);
  return /^(?:"[^"]*"\s*\|\s*)+"[^"]*"$/.test(body) ? body : null;
}

/** `keyof typeof X` -> the literal keys of X, wherever it appears in a type. */
function resolveKeyof(text, source) {
  return text.replace(/keyof typeof (\w+)/g, (whole, name) =>
    constKeyUnion(source, name) || whole);
}

/**
 * Resolve the names that exist only INSIDE the component file.
 *
 * THIS IS THE THIRD TIME THIS FILE HAS LEARNED THE SAME LESSON, and the two
 * comments in `shortType` are the first two: a union of string literals is
 * never truncated, an inline object shape is never collapsed, because those
 * values ARE the contract and a caller has to write one of them exactly.
 * `keyof typeof MODELS` is the same failure wearing a name — worse, in fact,
 * because it does not merely hide the values, it names a symbol the model has
 * no way to look up. `MODELS` is a module-private const; the page generator is
 * handed the signature and nothing else.
 *
 * Measured 2026-08-12: nine components shipped one, and the guesses a model
 * makes from the prop name are exactly the ones TypeScript refuses —
 * `AttributionNote model="last_click"` against `"last-click"` is TS2820, and
 * `LawfulBasisNote basis="legitimate-interest"` against `"legitimate"` is
 * TS2322. Neither is a runtime bug: the page fails to COMPILE, so it is stubbed
 * and the customer is billed for the build that produced it.
 *
 * A string-literal ALIAS goes the same way. `extractTypes` drops one on the
 * stated grounds that "a union of other names or a bare alias says nothing the
 * signature did not" — true of a union of NAMES and false of a union of
 * LITERALS, which says all of it. `tag-scope` was the instance.
 *
 * Resolved here rather than in `shortType` because only this function holds the
 * source, and it runs BEFORE it so the union lands under the never-truncate
 * rule that already exists.
 */
function resolveLocalNames(type, source) {
  const out = resolveKeyof(tidy(type), source);
  // Safe to sweep every capitalised name: `aliasUnion` answers null for
  // anything that is not a local string-literal union, so `React`, `Date` and
  // every exported shape in COMPONENT_TYPES pass through untouched.
  return out.replace(/\b([A-Z][A-Za-z0-9]*)\b/g, (whole, name) =>
    aliasUnion(source, name) || whole);
}

export function extract(source) {
  const out = [];
  // export function Name({ a, b = 1 }: { a: T; b?: U }) {
  // The optional `<T>` is not decoration — `DataList<T>` is the most-used
  // component in the kit and a regex without it silently skipped the one that
  // matters most, while reporting 429 successes.
  // THE GENERIC MAY BE NESTED, and `[^>()]*` stops at the FIRST `>` — so
  // `<T extends Record<string, unknown>>` ended at the inner one and the match
  // failed. `data-table` was therefore absent from COMPONENT_API entirely, the
  // model was given no signature, and it guessed `data=` where the prop is
  // `rows=`: with `T` unable to infer it fell back to the constraint, and every
  // `cell: (row: Deal) => …` became a contravariance error. **Eight of the CRM
  // sample's nine errors, from one missing entry.**
  //
  // Precisely the failure the previous line of this comment records for the bare
  // `<T>` case — "silently skipped the one that matters most, while reporting
  // 429 successes" — arriving one nesting level deeper. One level of nesting is
  // all the kit has and all this allows; a component that needs two would be
  // caught by the coverage guard in test/page-gen.test.mjs rather than skipped.
  const re = /export function (\w+)\s*(?:<(?:[^<>()]|<[^<>()]*>)*>)?\s*\(\s*\{/g;
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
      props.push(`${key}${optional ? "?" : ""}: ${shortType(resolveLocalNames(part.slice(colon + 1), source))}${d ? ` = ${tidy(d)}` : ""}`);
    }
    // RECORDED EVEN WITH NO PROPS. A component whose only prop is `className`
    // ends up here with an empty list — `className` is dropped on purpose,
    // stated once in the rules instead of 2,000 times — and skipping it removed
    // the component from `COMPONENT_API` ALTOGETHER. Two consequences, both
    // silent: `UI_EXPORTS` never learned its export name, so the import lint
    // skips it; and the prompt's naming rule ("the export is the file name in
    // PascalCase, exactly") is then the only thing the model has, and it is
    // WRONG for `high-contrast` (`HighContrastToggle`) and `reduce-motion`
    // (`ReduceMotionToggle`). TS2305, page refused, site the placeholder.
    //
    // A name with no props is still worth its four tokens: it says the
    // component exists, what it is called, and that it takes nothing.
    out.push({ name: m[1], props });
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
    const found = extractTypes(fs.readFileSync(path.join(UI_DIR, file), "utf8"));
    // KEYED PER COMPONENT, and that is not tidiness. A flat map collapsed the
    // TWO different `Activity` types in this kit — activity-feed's
    // `{who, what, at, avatar?}` and facility-status's
    // `{name, state, detail?…}` — and last-one-wins meant the prompt would
    // have carried the wrong shape for one of them. A wrong type is worse than
    // no type: it looks authoritative, which is exactly what the truncated
    // enum did earlier today.
    if (Object.keys(found).length) out[slug] = found;
  }
  return out;
}

/**
 * The exported shapes in ONE source, split out so it can be driven with a string.
 *
 * `extract` has taken a source since it was written and `buildTypes` read the
 * disk itself, which meant its regex could only be tested against files that
 * happen to exist. A mutation proved that: swapping the generic pattern for one
 * that breaks on a default like `<T = Row>` passed the entire suite, because no
 * component in the kit has one. A guard that can only see today's files is not
 * guarding the rule, it is restating the kit.
 */
export function extractTypes(src) {
  const out = {};
  // A GENERIC TYPE PARAMETER DEFEATED THIS TOO — the third time in one session
  // that a regex written for the non-generic case silently skipped the thing
  // that mattered. `export type Column<T> = ` never matched, so `Column` had no
  // shape, so `DataTable(columns: Column<T>[], …)` stopped at a name the model
  // could not see, and it wrote `render:` where the prop is `cell:`. Measured
  // live 2026-08-05, immediately after the same class was fixed one layer up
  // in the component regex.
  //
  // `[^<>]` with one nested level, not `[^=]`: a default like `<T = Row>`
  // contains an `=` and would end the match in the wrong place.
  for (const m of src.matchAll(/export type ([A-Z][A-Za-z0-9]*)(?:<(?:[^<>]|<[^<>]*>)*>)?\s*=\s*/g)) {
    const name = m[1];
    let i = m.index + m[0].length, depth = 0, end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          // THE TRAILING `[]` IS PART OF THE TYPE. Stopping at the closing brace
          // turned `export type QuoteFiles = { name: string; size: number }[]`
          // into the OBJECT, so the model was told a list was a single item and
          // wrote `files: { name, size }` where the prop wants an array — a type
          // error, page refused, whole site the placeholder.
          while (end < src.length && /\s/.test(src[end])) end++;
          while (src.startsWith("[]", end)) { end += 2; while (end < src.length && /\s/.test(src[end])) end++; }
          break;
        }
      }
      else if (c === ";" && depth === 0) { end = i; break; }
      else if (c === "\n" && depth === 0 && src[i + 1] === "\n") { end = i; break; }
    }
    if (end < 0) continue;
    const body = tidy(src.slice(m.index + m[0].length, end));
    // A union of other names or a bare alias says nothing the signature did
    // not; only a shape is worth the tokens.
    //
    // AN ALIAS TO A LIST OF ANOTHER SHAPE IS THE EXCEPTION, because it says the
    // one thing the signature cannot: how MANY. `WorkingHours(week: WeekHours)`
    // with `WeekHours = DaySpans[]` left the model reading a name whose body was
    // recorded nowhere, so it had to guess whether a week is one day's spans or
    // seven — and this component's whole contract is that index 0 is Sunday.
    // Same class as `Column<T>` stopping at a name, which cost eight compile
    // errors in one sample.
    const listAlias = /^[A-Z][A-Za-z0-9]*\[\]$/.test(body);
    if ((!body.startsWith("{") && !listAlias) || body.length > 400) continue;
    out[name] = body;
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
