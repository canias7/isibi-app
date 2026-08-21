// The page generator's model-facing half — the rules it writes against, the
// tool it fills in, and the deterministic checks its output has to survive.
//
// Kept out of worker.js on purpose: this is plain, dependency-free JavaScript,
// so it can be imported and tested outside the Worker (see test/page-gen.test.mjs)
// the same way site-schema.mjs and site-data.mjs are.
//
// The contract itself is builder/GENERATOR.md, and the page it is derived from is
// builder/lovable/template/src/routes/index.tsx. Both are reproduced here because
// the Worker has no filesystem; a test asserts this copy has not drifted from the
// file, and GENERATOR.md's rule stands — when the two disagree, the file wins.


// Generated from the component files by builder/gen-component-api.mjs. Kept in
// step by test/component-api.test.mjs, which regenerates and compares.
import { COMPONENT_API, COMPONENT_TYPES, COMPONENT_TYPE_NAMES } from "./component-api.mjs";
// The chart half, generated from src/components/charts/lib by
// builder/gen-chart-api.mjs and kept in step by test/chart-api.test.mjs.
import { CHART_COMPONENTS, CHART_API } from "./chart-api.mjs";
// THE KIT'S NAMES MOVED TO A LEAF (2026-08-21) so `site-plan.mjs` can offer all
// of them to the designer. This file imports that file, so a literal living
// here made the full kit unreachable from the plan without a cycle.
//
// IMPORTED AND RE-EXPORTED IN TWO STATEMENTS, not `export … from`: a bare
// re-export forwards the name and creates no local binding, so every use of
// `UI_COMPONENTS` below would be a ReferenceError that `node --check` passes.
// Guarded by "nothing re-exports a name it also uses".
import { UI_COMPONENTS } from "./ui-components.mjs";
export { UI_COMPONENTS };
import { directiveFromPlan, KIT_PALETTE } from "./site-plan.mjs";
import { imageDirective } from "./site-images.mjs";
import { modelsFor } from "./build-models.mjs";
// The ONE reading of a page file's URL, shared with the addon lane, the
// container's prerender and the published route manifest. This file kept a
// private copy and it was wrong twice — see the note at `live` below.
import { routeOf } from "./site-addon.mjs";
// One worked call per primitive, mined out of the demos by
// builder/gen-chart-usage.mjs. This is what the 1,140 demo files are FOR: they
// are the only place in the repo these APIs are called, and they compile, so
// every example is known-good rather than something written from the types.
// Reachable only this way — the model has no filesystem, and importing a demo
// is the defect the lint refuses.
import { CHART_USAGE } from "./chart-usage.mjs";
import { normalizePayment } from "../site-payments.mjs";

/**
 * The house motion set. Spec and reasoning: builder/MOTION.md.
 *
 * Named here because a class the model is never told about is a class no
 * generated page will ever carry. This codebase has installed unreachable
 * capability three times — 27 blocks, 196 examples, 882 chart primitives — each
 * on disk, compiling, and used by nothing because no rule mentioned it. The
 * drift test runs BOTH ways: an effect in styles.css that is not listed here is
 * dead, and one listed here that is not in styles.css is a class the model will
 * write and the browser will ignore.
 */
export const MOTION = [
  ["motion-enter", "something appears that the visitor did not ask for — a banner, a notice"],
  ["motion-fade", "the same, but for anything centred with translate (it would fight the centring)"],
  ["motion-stagger", "on a <ul> whose items arrive together — a service list, a menu"],
  ["motion-inout", "needs data-shown=\"true|false\"; stays mounted so it can animate OUT too"],
  ["motion-collapse", "needs data-open=\"true|false\"; opens to height auto, nothing measured"],
  ["motion-swap", "one thing replaced another in the same place — skeleton to content"],
  ["motion-press", "on a button; the press itself, 90ms"],
  ["motion-lift", "on a clickable card; hover only, so never the only sign it is clickable"],
  ["motion-reveal", "a section arriving as a long page is scrolled"],
  ["motion-progress", "a reading-progress bar; put it on the filled element"],
  ["motion-stick", "a header that changes once it has stuck; the change goes on its CHILD"],
];
const MOTION_CATALOGUE = MOTION.map(([n, why]) => `${n} — ${why}`).join("\n");
const MOTION_COUNT = MOTION.length;

/** Domain -> its exports, one line each. What the compose prompt spends its chart budget on. */
export const CHART_CATALOGUE = Object.entries(CHART_COMPONENTS)
  .map(([domain, names]) => `${domain}: ${names.join(", ")}`).join("\n");
const CHART_DOMAIN_COUNT = Object.keys(CHART_COMPONENTS).length;
const CHART_NAME_COUNT = Object.values(CHART_COMPONENTS).reduce((n, v) => n + v.length, 0);
/**
 * WHAT EACH MODULE ACTUALLY EXPORTS, component names and type names alike.
 *
 * The lint knew only that `@/components/ui/faq` was a real FILE, never that the
 * thing being imported out of it was real. Measured live 2026-08-09: a build
 * wrote `import { FaqAccordion } from "@/components/ui/faq"`, the module exports
 * `Faq`, and it passed validate and lint, failed `tsc`, and cost the customer
 * the whole site — `TS2305`, one of the three commonest failures there are.
 *
 * Derived from `COMPONENT_API`, which already carries the names (a module with
 * several exports lists them all, separated by `·`), so this costs no new
 * generated file and cannot drift from it.
 *
 * `COMPONENT_TYPES` ALONE WAS NOT THE WHOLE TYPE STORY, and believing it was
 * refused correct code (2026-08-14). That map answers "what SHAPE is this", so
 * `extractTypes` walks braces and keeps only types with an object body — which
 * silently drops every string union. 30 kit modules export exactly one type and
 * it is a union: `date-enquiry.DateStatus`, `alarm-state.AlarmMode`,
 * `density-toggle.Density`. The template sets `verbatimModuleSyntax: false`, so
 * `import { DateEnquiry, DateStatus }` compiles perfectly and the lint told the
 * page the module does not export it — listing the exports without it.
 * `COMPONENT_TYPE_NAMES` is the names-only scan, unioned in here so the lint and
 * the prompt keep asking ONE question.
 */
export const UI_EXPORTS = (() => {
  const out = {};
  for (const [mod, sig] of Object.entries(COMPONENT_API)) {
    const names = new Set();
    for (const m of String(sig).matchAll(/([A-Z][A-Za-z0-9]*)\s*\(/g)) names.add(m[1]);
    for (const t of Object.keys(COMPONENT_TYPES[mod] || {})) names.add(t);
    for (const t of COMPONENT_TYPE_NAMES[mod] || []) names.add(t);
    if (names.size) out[mod] = names;
  }
  return out;
})();

/** `open-now` → `OpenNow`. The rule the prompt states, as the one expression. */
const pascalOf = (mod) => mod.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/**
 * The modules whose export name is NOT its file name in PascalCase.
 *
 * ONE EXPRESSION, TWO READERS. Rule 3 lists these AND states how many modules
 * follow the rule, and the count used to be prose: "2,026 of the 2,042", written
 * once and never re-measured while the kit grew past 2,100. So the list beside
 * it was derived and correct and the sentence introducing it was two kit
 * generations out of date — in the highest-leverage prompt on the platform,
 * where a stale claim is read by a model rather than by somebody who might
 * notice. Both halves come from here now, so neither can drift from the other or
 * from the kit.
 */
export const UI_EXPORT_EXCEPTIONS = Object.entries(UI_EXPORTS)
  .filter(([mod, names]) => !names.has(pascalOf(mod)));

/**
 * The kit components that draw their picture THROUGH `SafeImage` — so an empty
 * `src` is the designed placeholder rather than a broken-image icon.
 *
 * This is the allow-list for a `@@IMG:@@` photograph token, and it exists
 * because `SafeImage` alone was too narrow: the first live build put one in
 * `<Gallery>`, which is exactly right and was reported as a problem.
 *
 * DERIVED FROM THE KIT, not curated — `test/page-gen.test.mjs` re-reads every
 * ui component on disk and fails on any difference, both directions. A
 * hand-kept list here would go stale the first time a card started using the
 * guard, and the failure mode is the lint scolding the model for doing the
 * right thing.
 */
export const SAFE_IMAGE_COMPONENTS = [
  "AnnotationUpload", "ArticleCard", "BeforeAfter", "BeforeAfterUpload", "BrandUpload", "CartLine",
  "CaseStudyCard", "ConnectCard", "CourseCard", "CoverImage", "DishCard", "EventCard", "EvidenceList",
  "ExhibitionCard", "Figure", "FilePreviewPane", "Gallery", "Hero", "HeroSplit", "ImageStrip",
  "InvoiceHeader", "Letterhead", "MediaGrid", "PageThumbnails", "PractitionerCard", "ProductCard",
  "ProofOfCollection", "PropertyCard", "RecipeCard", "RoomCard", "SafeImage", "SellerCard",
  "ServiceCard", "SharePreview", "SignatureBlock", "SnagItem", "StarterGallery", "StoryLead",
  "TeamGrid", "ThumbnailPicker", "VehicleCard", "VideoHero",
];


// THE COMPONENTS THE MODEL IS SHOWN — the most-used slice of the 2,058.
//
// DERIVED FROM WHAT ASKS FOR THEM, not hand-picked and not "the first N". The 26
// layout families each declare the components their pages need (`store` names
// cart-line, place-order-bar, payment-picker…), and the rules themselves cite
// more by name. That union IS the most-used set, and it updates itself when a
// family is added — a hand-written 100 would drift from the families the day one
// changed, and nothing would say so.
//
// WHY NOT 100, WHICH IS WHAT WAS ASKED FOR: the families alone declare 157. A
// list of 100 would omit 57 components a family says its pages need, which
// breaks the layout wiring rather than trimming a prompt.
//
// WHAT THIS COSTS, stated plainly because it is the same failure this repo keeps
// having: the model can only import a name it has been given, so the components
// left off are ones no generated page will use. The saving is ~786 tokens a
// build — PAGE_RULES is cached, so only about a tenth of the full list's 8,150
// was ever being paid. That is the smallest of the prompt savings available and
// the only one that costs reach; it is here because the owner asked for it.
// `UI_COMPONENTS` stays whole — it is the LINT's allow-list and the drift guard
// against what is on disk, so a page importing any real component still passes.
// EVERY SHORTLISTED COMPONENT WITH ITS SIGNATURE.
//
// The model was given 282 NAMES and no props, and guessing them is the single
// largest cause of a refused page. Measured 2026-08-04, one CRM sample: a `badge`
// prop that does not exist, a `subtitle` that is called `description`, an `id` on
// a row type that has none, and `"error"` for a state whose values are
// success/warning/danger/neutral/quiet. Four errors, one root cause, whole site a
// placeholder.
//
// ~9,000 tokens, and they ride in the CACHED system block — measured at
// `cacheRead 27,716` on a real build, so this is a cache read at 0.1x, roughly
// $0.003 on a build that costs $0.22. The reason it was not affordable before was
// the assumption it would be fresh input on every build. It is not.
//
// Names alone stay in rule 3; this is the reference the model checks a call
// against, which is why it is a separate block rather than a longer rule.
/**
 * Which kit module exports this JSX tag, or null.
 *
 * Derived from `UI_EXPORTS`, which is itself derived from `COMPONENT_API` — so a
 * tag resolves exactly when the prompt claims that component exists. A name
 * exported by two modules resolves to NEITHER: guessing which one a page meant
 * is how a lint invents a complaint about a correct call.
 */
export function uiModuleFor(tag) {
  const hits = [];
  for (const [mod, names] of Object.entries(UI_EXPORTS)) if (names.has(tag)) hits.push(mod);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The PROP NAMES each documented component accepts, derived from its signature.
 *
 * The failure this exists for is the one the eval actually records: not a
 * component the model could not see, but a prop invented on one it could.
 * `render` on `Column`, `onClick` on a bulk action, `title` on an `Activity`,
 * `activityFeedPlaceholder` out of `activity-feed` — every recorded compile
 * failure was on a component whose signature was in the prompt.
 *
 * SPLIT ON DEPTH, never on a bare comma. A signature carries object props
 * (`action?: { label: string; href?: string }`), generics and function types,
 * all full of commas and colons that are NOT top-level props — and a regex
 * written for the flat case is a mistake this codebase has now made three
 * separate times (the chart lib's missing semicolons, `Column<T>`, `DataTable<T>`).
 *
 * Returns null for a component with no signature, so the lint can SKIP it rather
 * than guess: a false alarm teaches the model away from a component that is
 * perfectly real, which is worse than the miss.
 */
export function propsOf(component, tag) {
  const sig = COMPONENT_API[component];
  // A TRUNCATED SIGNATURE CANNOT ANSWER "IS THIS PROP REAL". `gen-component-api`
  // elides a long nested type with `…`, which leaves an unbalanced brace — the
  // splitter never returns to depth 0 and every prop after it disappears. That
  // is a list of props that LOOKS complete and is not, which turns a correct
  // call into a complaint. Skipping is the only safe answer, and it is the same
  // rule the import check uses for a module with no known exports.
  if (typeof sig === "string" && sig.includes("\u2026")) return null;
  if (!sig) return null;
  // THE SIGNATURE MUST BE FOR THIS TAG. A module can export several components —
  // `testimonial.tsx` has `Testimonial` and `TestimonialGrid` — and COMPONENT_API
  // documents ONE of them. Reading the wrong one reported `TestimonialGrid` as
  // taking `item`, which is the other component's prop, on a page that was right.
  if (tag && !new RegExp("^" + tag + "\\s*\\(").test(sig)) return null;
  const open = sig.indexOf("(");
  if (open < 0) return null;
  // The matching close paren, not the first one — a function-typed prop has its own.
  let depth = 0, close = -1;
  for (let i = open; i < sig.length; i++) {
    const c = sig[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return null;
  // THROUGH THE SHARED SPLITTER, not a second copy of it. This function had its
  // own inline loop, written before `splitTop` was extracted — so the `=>` fix
  // reached one and not the other, and every prop after a function-typed one was
  // invisible. `ContactForm(onSubmit: (v: {…}) => void, busy?, …)` came back as
  // just `onSubmit`, which turned four correct props into a lint complaint.
  // Measured: 121 of 328 known-good pages flagged. Two copies of one rule, in
  // the same change that extracted the helper to avoid exactly that.
  const parts = splitTop(sig.slice(open + 1, close), ",");
  const names = [];
  for (const raw of parts) {
    const m = raw.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:/);
    if (m) names.push(m[1]);
  }
  return names.length ? names : null;
}

/**
 * The element's OWN attributes — `[name, indexOfValue]` — never a nested one's.
 *
 * A prop can hold a whole element: `media={<SafeImage src={null} …/>}`. Reading
 * the attribute text flat pulled `src`, `alt` and `ratio` out of the INNER
 * component and reported them against the outer one, on pages that were right.
 * So names are taken at brace depth 0 only.
 */
function ownAttrs(attrs) {
  const out = [];
  let d = 0;
  for (let i = 0; i < attrs.length; i++) {
    const c = attrs[i];
    if ("{([".includes(c)) { d++; continue; }
    if ("})]".includes(c)) { d = Math.max(0, d - 1); continue; }
    if (d !== 0) continue;
    const m = /^([a-zA-Z][\w-]*)\s*=/.exec(attrs.slice(i));
    if (!m || (i > 0 && /[\w-]/.test(attrs[i - 1]))) continue;
    let v = i + m[0].length;
    while (v < attrs.length && /\s/.test(attrs[v])) v++;
    out.push([m[1], v]);
    i = v - 1;
  }
  return out;
}

/**
 * Blank every string literal, keeping the length.
 *
 * A page is full of prose, and prose contains angle brackets, colons and commas.
 * Without this the element scanner read `<CodeBlock code={\`<Table invoices={x}/>\`}>`
 * as an element called Table, and a `Faq` answer containing ", so:" as a field
 * called `so` — 24 complaints about pages that were right.
 *
 * LENGTH-PRESERVING, never removing, because every index computed here is used
 * against the real text. That is written down in this repo as the rule for
 * comment stripping and it holds identically for strings.
 *
 * A template's `${…}` is blanked WITH it. That can hide a real element inside an
 * interpolation, which is a miss rather than a false alarm — the safe direction
 * for a lint whose whole viability is not crying wolf.
 */
function blankStrings(code) {
  const out = code.split("");
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "\\") { j += 2; continue; }
        if (code[j] === quote) break;
        j++;
      }
      for (let k = i + 1; k < Math.min(j, code.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/**
 * Every `<Component …>` in a page, with its attribute text.
 *
 * Depth-aware because a prop can hold anything: an arrow function's `=>`, a
 * generic, a nested object. Yields `[full, tag, attrs]` so it drops into the
 * same shape the regex it replaced produced.
 */
function* jsxElements(real) {
  // SCANNED ON THE BLANKED VIEW, SLICED FROM THE REAL ONE — the indices are the
  // same by construction, which is the entire reason the blanker preserves
  // length. Attributes are yielded blanked too: the lint reads key NAMES, and a
  // key never lives inside a string.
  const code = blankStrings(real);
  const open = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;
  let m;
  while ((m = open.exec(code))) {
    let i = m.index + 1 + m[1].length, d = 0, end = -1;
    for (; i < code.length; i++) {
      const c = code[i];
      if ("{([".includes(c)) d++;
      else if ("})]".includes(c)) d = Math.max(0, d - 1);
      // `code[i - 1] !== "="` IS BELT-AND-BRACES TOO, and measured as such: a
      // mutation removing it survives, because every JSX expression lives inside
      // `{}`, so an arrow is never at depth 0 and `d === 0` already excludes it.
      // It only earns its keep once the depth is WRONG — an unmatched `}` in a
      // JSX comment clamps d to 0 mid-element, and then the arrow really would
      // end the element early. Kept for that, and because deleting it is one
      // simplification away from restoring the truncation bug described above.
      else if (c === ">" && d === 0 && code[i - 1] !== "=") { end = i; break; }
    }
    if (end < 0) continue;
    yield [code.slice(m.index, end + 1), m[1], code.slice(m.index + 1 + m[1].length, end).replace(/\/$/, "")];
    open.lastIndex = end;
  }
}

/**
 * Split a bracketed list on its TOP-LEVEL separator, ignoring nested ones.
 *
 * Shared by the prop reader and the shape reader because both are defeated by
 * the same thing: a signature and a type body are both full of commas, colons
 * and semicolons that belong to something nested. This codebase has written a
 * flat splitter three times and been wrong three times.
 */
function splitTop(src, sep) {
  const out = [];
  const str = String(src);
  let buf = "", d = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    // `=>` IS NOT A CLOSING BRACKET. `cell?: (row: T) => React.ReactNode` drove
    // the depth negative, so every field after a function-typed one was lost —
    // and a field the reader cannot see is a FALSE ALARM on correct code, which
    // is the one thing this lint must never produce. Found by reading the output
    // rather than by a test: `Column` came back missing `numeric` and `width`.
    if (c === ">" && str[i - 1] === "=") { buf += c; continue; }
    if ("([{<".includes(c)) d++;
    else if (")]}>".includes(c)) d = Math.max(0, d - 1);
    if (c === sep && d === 0) { out.push(buf); buf = ""; continue; }
    buf += c;
  }
  out.push(buf);
  return out;
}

/**
 * The bodies of the TOP-LEVEL object literals in a prop value.
 *
 * Depth-tracked, because an item can hold objects of its own and their keys are
 * not the item's keys — reading the innermost braces reported `capacities: {
 * Standing: 120 }` as an item with a field called `Standing`.
 */
function topObjects(value) {
  const out = [];
  let d = 0, start = -1;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "{") { if (d === 0) start = i; d++; }
    else if (c === "}") { d--; if (d === 0 && start >= 0) { out.push(value.slice(start + 1, i)); start = -1; } }
  }
  return out;
}

/**
 * The FIELD NAMES of the object a prop expects, when the signature names a type
 * the component also documents.
 *
 * THIS is the shape the eval actually records — not a wrong JSX attribute, but a
 * wrong key inside an object literal handed to one: `{ src, alt, fallbackSeed }`
 * against `Shot`, `{ key, header, render }` against `Column`, `{ who, what,
 * title }` against `Activity`. Measured on the real failing pages: 20 of one and
 * 7 of another in the recorded history.
 *
 * Returns null unless the type is documented on THAT component — two components
 * export a type called `Activity` with different shapes, so a name alone cannot
 * resolve it, which is the same reason `UI_SHORTLIST_API` prints only cited types.
 */
export function shapeOf(component, prop, tag) {
  const sig = COMPONENT_API[component];
  // A TRUNCATED SIGNATURE CANNOT ANSWER "IS THIS PROP REAL". `gen-component-api`
  // elides a long nested type with `…`, which leaves an unbalanced brace — the
  // splitter never returns to depth 0 and every prop after it disappears. That
  // is a list of props that LOOKS complete and is not, which turns a correct
  // call into a complaint. Skipping is the only safe answer, and it is the same
  // rule the import check uses for a module with no known exports.
  if (typeof sig === "string" && sig.includes("\u2026")) return null;
  const types = COMPONENT_TYPES[component];
  if (!sig || !types) return null;
  if (tag && !new RegExp("^" + tag + "\\s*\\(").test(sig)) return null;
  const open = sig.indexOf("(");
  if (open < 0) return null;
  for (const part of splitTop(sig.slice(open + 1, sig.lastIndexOf(")")), ",")) {
    const m = part.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:\s*([A-Za-z_$][\w$]*)(?:<[^>]*>)?(\[\])?/);
    if (!m || m[1] !== prop) continue;
    const body = types[m[2]];
    if (!body) return null;
    const fields = [];
    for (const f of splitTop(body.replace(/^\{|\}$/g, ""), ";")) {
      const fm = f.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:/);
      if (fm) fields.push(fm[1]);
    }
    return fields.length ? fields : null;
  }
  return null;
}

/**
 * Attributes every component takes regardless of its signature, so the lint
 * cannot flag them. `key`/`ref` are React's own; `className`/`children` the
 * prompt already promises every component in the kit accepts; the rest are
 * standard DOM passthrough.
 */
export const FREE_PROPS = new Set(["key", "ref", "className", "children", "style", "id", "title", "role", "tabIndex"]);

/**
 * A signature block for a NAMED LIST of components.
 *
 * Was `UI_SHORTLIST_API()`, which read one fixed list of 292 and printed it into
 * the cached prompt. There are two callers now and they want different lists:
 * the always-on core, which is cached, and THIS SITE's own manifest, which rides
 * fresh in the user turn. One generator, so the two blocks can never disagree
 * about how a signature is written.
 *
 * A NAME WITH NO SIGNATURE IS SKIPPED, WHICH IS ALSO THE VALIDATION. The designer
 * writes the manifest and a model can name something that does not exist; there
 * is nothing to check separately, because a component the kit does not have has
 * no line to print. The lint refuses an import of it anyway.
 */
export const componentApiFor = (names) => {
  const lines = [];
  const seen = new Set();
  for (const n of names || []) {
    if (typeof n !== "string" || seen.has(n)) continue;
    seen.add(n);
    const sig = COMPONENT_API[n];
    if (!sig) continue;
    // THE SHAPE A SIGNATURE STOPS AT. `ActivityFeed(items: Activity[], …)` names
    // a type the model cannot see, and it passed `{title, description}[]` where
    // `Activity` is `{who, what, at, avatar?}` — one error, and the only thing
    // between a booking sample and a pass.
    //
    // Taken from THAT COMPONENT'S OWN FILE: two components in this kit export a
    // type called `Activity` and they are different shapes, so a name alone
    // cannot resolve it. Only types the signature actually mentions are printed.
    const own = COMPONENT_TYPES[n] || {};
    const cited = Object.keys(own).filter((t) => new RegExp("\\b" + t + "\\b").test(sig));
    const shapes = cited.map((t) => t + " = " + own[t]).join("; ");
    lines.push("  " + n + " — " + sig + (shapes ? "   where " + shapes : ""));
  }
  return lines.join("\n");
};

/**
 * REWRITE AN IMPORT OF A MEMBER A KIT MODULE DOES NOT EXPORT.
 *
 * WHY THIS IS FREE AND WHY IT EXISTS. `lintPages` already reports this exactly:
 * "imports { Hero } from @/components/ui/hero-split, which does not export it.
 * That module exports: HeroSplit." It KNOWS the wrong name and the right one —
 * and then the page goes to `tsc`, fails TS2305, and because the page is usually
 * index.tsx (which salvage will not stub, since the home page must survive) the
 * whole site publishes as the data-model placeholder.
 *
 * Measured live 2026-08-19 on a real build: one such import cost a customer the
 * entire site. `TS2305 has no exported member` is already recorded here as one of
 * the top recurring generator failures.
 *
 * NOT THE REPAIR PASS. That one re-ran the MODEL — ~80% of what a build costs —
 * and was removed 2026-08-04. This is a string substitution over source that
 * already exists: no model call, no tokens, and it happens BEFORE the compile so
 * it costs not even a second container run.
 *
 * IT REFUSES TO GUESS, which is the whole safety argument. A module with no known
 * export list is skipped. A wrong name is corrected only when the answer is
 * unambiguous: the file name in PascalCase really is exported, or the module
 * exports exactly one thing. Anything else is left for `tsc` to refuse honestly —
 * a wrong rename compiles and renders the wrong component, which is far worse
 * than a failed build.
 *
 * The old name is rewritten everywhere in that file, not just in the import. It
 * cannot collide with anything: the name was imported and does not exist, so it
 * has no other binding in the module.
 */
export function repairImports(pages) {
  // NAMED `repaired`, NOT `out`. `test/declarable-enforced.test.mjs` cuts
  // `out.push({` and `norm.push({` out of a bundle that INCLUDES this file, to
  // prove the schema features it checks are really enforced — so an unrelated
  // `out.push({` here reads to that guard as a failed cut. Measured: it went red
  // the moment this function was added.
  const repaired = [];
  const fixed = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    let src = String(p && p.source || "");
    src.replace(/import\s*\{([^}]*)\}\s*from\s*"@\/components\/ui\/([a-z0-9-]+)"/g, (whole, inner, mod) => {
      const known = UI_EXPORTS[mod];
      if (!known) return whole;               // unknown module: tsc's problem, not ours
      for (const raw of inner.split(",")) {
        const part = raw.trim();
        if (!part) continue;
        // `X as Y` keeps X as the imported member; `type X` is still a member.
        const name = part.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name || known.has(name)) continue;
        if (!/^[A-Z]/.test(name)) continue;   // a lowercase helper is not this class
        const pascal = pascalOf(mod);
        const only = known.size === 1 ? [...known][0] : null;
        const right = known.has(pascal) ? pascal : only;
        // `right === name` CANNOT FIRE TODAY and is kept deliberately, said out
        // loud rather than deleted or pretended-to-be-tested. `right` is always
        // a member of `known` and `name` never is — the `known.has(name)`
        // continue above is what guarantees it, and that is one edit away from
        // changing. Measured over all 2,040 kit modules: 0 reachable. Without
        // it a self-rename would push a `fixed` entry claiming a repair that
        // did not happen, on the build response, for every import on the page.
        if (!right || right === name) continue;
        src = src.replace(new RegExp("\\b" + name + "\\b", "g"), right);
        fixed.push({ path: p.path, module: mod, from: name, to: right });
      }
      return whole;
    });
    repaired.push({ ...p, source: src });
  }
  return { pages: repaired, fixed };
}



// Imported, not restated. The generator has to predict exactly what the API will
// refuse, and when these rules were written out in both files they drifted — the
// lint claimed a read of a `feed` or `admin` table returns 403, which the API
// does not do. site-access.mjs is dependency-free, so this module stays
// importable without the Worker's node_modules.
export { MANAGED_COLUMNS } from "../site-access.mjs";
import { MANAGED_COLUMNS, canReadAccess, canWriteAccess, whyNotReadable, needsMember, hasPublicView, canMemberWrite, resolveAccess, accessNameFor, accessLabel, readNeedsMember, isImageColumn } from "../site-access.mjs";
// WHETHER A FORM MAY TAKE A FILE, asked of the function the ROUTE asks — never
// re-derived here. `handleVisitorUpload` gates on `acceptsVisitorUploads` and
// answers 403 `no_uploads` when it is false, and a second copy of that rule in
// this file would drift into a digest promising an upload the route refuses.
// site-uploads.mjs imports only site-access.mjs, so this stays dependency-free.
import { acceptsVisitorUploads } from "../site-uploads.mjs";

export const MAX_PAGES = 6;
export const MAX_PAGE_CHARS = 24000;

// A byte-for-byte copy of every file in builder/lovable/template/src/routes/
// that the generator is meant to imitate. Inlined rather than read from disk
// because worker.js bundles this module and a Worker has no filesystem; the
// escaping is generated, never hand-typed. test/page-gen.test.mjs fails if any
// of them diverges from the file it was copied from.
//
// FOUR PAGES, NOT ONE, and the reason is what the single page could not show.
// Measured against the rules that cite them: `usePublicRows` had 8 mentions and
// 0 demonstrations, `useMember` 10 and 0, the claim hooks 1 each and 0, and all
// 11 motion effects were named and none shown. A rule the model is told but
// never shown is a rule it satisfies by inventing a shape, and the invented
// shape is what burns the single repair pass.
//
// They ride in the SYSTEM block, which carries `cache_control: ephemeral`, so
// the extra length is a cache READ on every build after the first rather than
// fresh input. That is also why they are a constant set and not selected per
// build: varying the block by schema would break the cache on every build and
// cost far more than the pages it saved.
export const REFERENCE_PAGES = [
  {
    path: "index.tsx",
    blurb: "THE HOME PAGE — the trade's own layout: menu-style prices, the barbers, the work, find-us.",
    source: `// Reference page — THE HOME PAGE, laid out the way the TRADE lays one out.
//
// A generated site is not a generic landing page wearing a business's name. A
// barber shop has conventions, and following them is most of what reads as
// "somebody who knows this trade made this":
//
//   - The PRICE LIST IS A MENU — rows with the price on the right — never a
//     grid of product cards. \`PriceList\`'s own comment calls it the most common
//     shape on a site this platform builds.
//   - PEOPLE BOOK A BARBER, not a shop, so the team gets a section. The
//     pictures are the owner's to add later; \`TeamGrid\` guards them.
//   - The GALLERY is the work. It is the shop's portfolio, not decoration.
//   - HOURS, ADDRESS AND PHONE LIVE TOGETHER in one "Find us" section, because
//     they answer one question. Hours floating alone answer half of it.
//
// AND THE BUTTONS SIT WHERE THE DECISION HAPPENS. "Book" is in the header on
// every page, in the hero, on EVERY ROW of the price list, and once more at the
// bottom. The per-row button carries its service into the form —
// \`/book?service=Skin fade\` — so the form opens half-filled. "Call" is beside
// "Book" in the hero as a real tel: link, because for a barber shop the phone
// IS a booking channel.
//
// The rhythm is BANDS: full-bleed hero, then sections alternating between the
// page colour and \`bg-muted\`, each with its own inner container. A page where
// every section is \`mt-14\` inside one narrow column reads as a document.
//
// THE PAGES ARE WIRED TOGETHER — owner's call. One chrome navigates between
// them, the price rows carry their service into /book, the form hands back the
// claim link /manage opens, and the member pages sit behind the real session,
// so the site WORKS the day it is generated. What stays written into the page
// is the owner's own facts — hours, the team, the gallery captions — and that
// is a data decision, not a wiring one: those cost no query and cannot render
// empty on a fresh site.
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { Hero } from "@/components/ui/hero";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return. The phone is a nav link because for this trade it is a
// booking channel, not small print.
//
// IT IS ALSO IN \`contact\`, AND THAT IS NOT A DUPLICATE. The nav entry is the
// action — ring us now — and the footer entry is the record a visitor scrolls
// to the bottom to find, beside the address and the hours. Real businesses
// print their number in both places for exactly that reason.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Prices", href: "#prices" },
    { label: "The barbers", href: "#barbers" },
    { label: "Find us", href: "#find-us" },
    { label: "0114 270 0000", href: "tel:+441142700000" },
  ],
  action: { label: "Book a chair", href: "/book" },
  // The footer's small print. \`phone\` is written the way a person writes it and
  // the \`tel:\` link is derived, so there is no second value to get wrong; the
  // address carries real newlines, which the footer renders as lines.
  contact: {
    phone: "0114 270 0000",
    email: "hello@cutlerrow.co.uk",
    address: "14 Cutler Row\\nSheffield S1 2AY",
    hours: "Tue–Fri 9–6, Sat 8.30–5",
  },
  social: [
    { network: "instagram", href: "https://instagram.com/cutlerrow" },
    { network: "facebook", href: "https://facebook.com/cutlerrow" },
  ],
  // \`legal\` is the fourth footer slot and is deliberately NOT demonstrated here:
  // this site has no privacy page, and a reference page linking to one it has
  // not built teaches exactly the dangling link the router refuses. Use it only
  // for a page the site really has.
};

// The shop's own facts. Anything the owner will never edit from a form belongs
// in the page — it costs no query and cannot be empty on a fresh site.
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "18:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "18:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "20:00" },
  { day: 5, label: "Friday", open: "09:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "17:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

function Home() {
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Barbering on Cutler Row since 2014"
        subtitle="Six barbers, no appointment needed on weekdays. Walk in before eleven, or book a chair."
        primary={{ label: "Book a chair", href: "/book" }}
        secondary={{ label: "Call 0114 270 0000", href: "tel:+441142700000" }}
      />

      {/* Reassurance in the trade's own language, not a corporate stats band. */}
      <section className="mx-auto max-w-5xl px-6">
        <TrustStrip
          items={[
            { title: "Walk-ins welcome", description: "Before 11 on weekdays you won't wait long" },
            {
              title: "4.9 on Google",
              description: "Two hundred odd reviews, mostly about the fades",
            },
            { title: "Cash or card", description: "No booking fee, no deposit" },
          ]}
        />
      </section>

      <section id="prices" className="mt-4 border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <SectionHeader
            eyebrow="The price list"
            title="Cuts and shaves"
            description="Every cut finishes with a hot towel. Students £4 off, Tuesday to Thursday."
          />
          {/* A price list is ROWS — name, price on the right, a Book button on
              the row — because that is how the trade writes one. \`PriceList\`
              takes the whole list at once, so the query's states sit around it;
              when a page lays rows out itself, \`DataList\` carries all four
              states instead. */}
          {services.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
          {services.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the price list. Refresh and try again.
            </p>
          )}
          {services.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">Nothing listed yet.</p>
          )}
          {!!services.data?.length && (
            <PriceList
              className="mt-6"
              items={services.data.map((s) => ({
                name: s.name,
                description: s.description,
                price: s.price,
                meta: s.duration_minutes != null ? \`\${s.duration_minutes} min\` : null,
              }))}
              /* THE BUTTON IN THE RIGHT PLACE: the row you are reading is the
                 service you want, so its Book button carries the service into
                 the form. The search param is typed by /book's own
                 validateSearch, so a typo here fails the build. */
              action={{
                label: "Book",
                onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
              }}
            />
          )}
        </div>
      </section>

      <section id="barbers" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The barbers"
          title="Pick your chair"
          description="Six of us, two generations. Ask for whoever cut you last — it's on your booking."
        />
        {/* People book a person. Photos are the owner's to add after the build,
            so every one is guarded by the component. */}
        <TeamGrid
          className="mt-8"
          items={[
            { name: "Tommy Vasile", role: "Owner — fades and razor work" },
            { name: "Marcus Obeng", role: "Beards and hot towel shaves" },
            { name: "Ellis Ward", role: "Scissor cuts" },
            { name: "Deniz Aydın", role: "Kids and first cuts" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20 motion-reveal">
          <SectionHeader eyebrow="The work" title="Recent cuts" />
          <Gallery
            className="mt-8"
            columns={3}
            items={[
              { src: null, alt: "Skin fade, front window chair" },
              { src: null, alt: "Beard line-up" },
              { src: null, alt: "Scissor crop" },
              { src: null, alt: "Hot towel shave" },
              { src: null, alt: "The long window on a Saturday" },
              { src: null, alt: "Tommy's chair" },
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader eyebrow="Kind words" title="What the chairs say" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote:
                "Been coming since they opened. Never waited more than ten minutes, never had a bad cut.",
              name: "Dan Whitfield",
              role: "Every third Thursday",
            }}
          />
          <Testimonial
            item={{
              quote: "Took my lad for his first proper cut. Deniz had him laughing the whole time.",
              name: "Priya Nair",
              role: "Saturday regular",
            }}
          />
        </div>
      </section>

      {/* Hours, address and phone are ONE question — how do I get there and
          when — so they are one section, with the live answer on top. */}
      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On the row itself" />
            <OpenNow
              className="mt-6"
              hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                day: h.day,
                open: h.open!,
                close: h.close!,
              }))}
            />
            <OpeningHours days={HOURS} className="mt-4" />
          </div>
          <LocationCard
            className="self-start"
            name="Cutler Row Barbers"
            address="14 Cutler Row, Sheffield S1 2AY"
            note="Two minutes from the Cathedral tram stop. No parking on the row itself — use Campo Lane."
          />
        </div>
      </section>

      {/* The last thing before the footer is the thing you want them to do. */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <CtaBand
          title="A chair is usually free the same day"
          description="Book in thirty seconds. We'll call to confirm."
          action={{ label: "Book a chair", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "book.tsx",
    blurb: "THE FORM — validation, taken slots, the claim link back, and ?service= preselect.",
    source: `// Reference page — THE FORM. Everything a \`collect\` table needs: validation
// before a round trip, the four list states behind a Select, the slots somebody
// else has already taken, and a confirmation screen that does not promise the
// customer a link this page cannot obtain.
//
// A \`collect\` table is write-only: no policy lets anyone list it, so a booking
// page CANNOT read the bookings to work out what is free. \`usePublicRows\` reads
// a VIEW the schema published for exactly that — the taken times and nothing
// else. If the schema declares no view for a table, ship the ordinary form; a
// visitor is told about a clash on submit instead of before it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, usePublicRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/book")({
  component: Book,
  // WHAT THIS PAGE IS, so a share of it does not preview as the home page.
  // Without a \`head\` a route inherits the site's own title and description, so
  // every address on the site showed one headline and one blurb — the booking
  // page pasted into a message read as the front page. The root supplies
  // \`og:url\`, the share image and the card type; a page supplies only these.
  head: () => ({
    meta: [
      { title: "Book a chair — Sharp Fade Barbers" },
      { property: "og:title", content: "Book a chair — Sharp Fade Barbers" },
      { name: "description", content: "Pick a service and a time. Takes about a minute, and you get a link to change it." },
      { property: "og:description", content: "Pick a service and a time. Takes about a minute, and you get a link to change it." },
    ],
  }),
  // Every Book button on the site carries its service here — the price list's
  // per-row button navigates with \`search: { service: r.name }\` — so the form
  // opens half-filled. Narrowing here is also what TYPES that navigate call.
  // The return type marks the key OPTIONAL (\`service?:\`), not merely
  // possibly-undefined — without that, every <Link to="/book"> in the site is
  // forced to spell out a search object.
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
});

type Service = Row & { name: string; price: number | null };

// The row shape this form writes. It is a TYPE ARGUMENT ONLY — \`useCreateRow\`
// resolves to void, because a \`collect\` table grants no SELECT and asking
// PostgREST to return the inserted row is what made the insert 403.
type Appointment = Row;

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
  contact: {
    phone: "0114 270 0000",
    email: "hello@cutlerrow.co.uk",
    address: "14 Cutler Row\\nSheffield S1 2AY",
    hours: "Tue–Fri 9–6, Sat 8.30–5",
  },
  social: [
    { network: "instagram", href: "https://instagram.com/cutlerrow" },
    { network: "facebook", href: "https://facebook.com/cutlerrow" },
  ],
};

const SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

// Mirrors the declared columns. The API rejects anything undeclared anyway, but
// validating here means the visitor is told before a round trip.
const booking = z.object({
  service: z.string().min(1, "Pick a service"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_phone: z.string().min(6, "We need a number to confirm on"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  notes: z.string().max(500).optional(),
});

type Booking = z.infer<typeof booking>;

function Book() {
  // A service name that no longer exists simply leaves the Select on its
  // placeholder — a stale link half-fills instead of breaking.
  const { service: preselected } = Route.useSearch();
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const create = useCreateRow<Appointment>("appointments");
  // A plain "did it land" flag, not a token. The token could never have arrived
  // — see onSuccess below.
  const [booked, setBooked] = useState(false);

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: {
      service: preselected ?? "",
      customer_name: "",
      customer_phone: "",
      date: "",
      time: "",
      notes: "",
    },
  });

  // Watched, because which slots are gone depends on the day being asked about.
  const date = form.watch("date");
  // The argument is the TABLE, not the name of a view. A \`publicView\` is a
  // projection the schema declared ON that table, so \`appointments\` is what is
  // asked for and the server returns only the published columns.
  //
  // Those rows carry NEVER an \`id\` — a projection strips it — so they are keyed
  // on a published column. Filters are FLAT: a declared column name is the key,
  // with no \`filter\` wrapper around it.
  const taken = usePublicRows<{ time: string }>("appointments", date ? { date } : undefined);

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      // The callback parameter is NOT annotated: TanStack's signature is
      // contravariant in four arguments and refuses any hand-written type here.
      // NOTHING COMES BACK, and this page is why that had to be said out loud.
      // It read \`row.claim_token\` off the insert — which needs PostgREST to
      // RETURN the row, which needs SELECT, which a write-only \`collect\` table
      // deliberately does not grant. So the header that fetched the token is
      // what made the INSERT itself 403, and since this file is the reference
      // the generator is derived from, it taught that pattern to every site the
      // builder has produced. Confirmation is the end of the flow; a manage link
      // needs the schema to expose a function that creates AND returns.
      onSuccess: () => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
        setBooked(true);
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  // THE CONFIRMATION IS THE END OF THE FLOW, and that is a complete site rather
  // than a broken one. Offering a "manage your booking" link here would need a
  // token this page cannot obtain: reading it off the insert is what refused the
  // insert. A site that wants one declares a function that creates AND returns.
  if (booked) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            We'll call to confirm within the hour. Need to change it? Give us a ring.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Back to the shop</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a chair</h1>
        <p className="mt-2 text-muted-foreground">We'll call to confirm within the hour.</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.data?.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    {/* Taken slots are struck through and unpickable, so a visitor
                      sees 09:30 is gone BEFORE submitting rather than being
                      refused after filling the whole form in. */}
                    <AvailabilityGrid
                      slots={SLOTS}
                      taken={taken.data?.map((t) => t.time) ?? []}
                      value={field.value}
                      onSelect={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Anything else?</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              {/* Disabled while in flight, or a customer who sees nothing happen
                presses again and books three times. */}
              <Button type="submit" className="motion-press" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "manage.tsx",
    blurb: "COMING BACK — one row, opened by a claim token off the URL.",
    source: `// Reference page — COMING BACK. The person who filled the form in has no
// account and never will, so a claim token IS their identity: it arrives in the
// confirmation link, it opens exactly one row, and it does nothing else.
//
// Build this page whenever a site takes appointments, orders or reservations —
// anything a customer might need to check, MOVE or cancel. A plain contact form
// does not need one; nobody comes back to look at an enquiry.
//
// CHANGING BEATS CANCELLING, and for a while this page could only cancel. On a
// booking table with \`unique\` or \`noOverlap\`, cancel-and-rebook gives the slot
// up before the new one is secured — so the customer can lose the only
// appointment they had, to move it by an hour. Offer the change when the schema
// declares a function for it.
//
// The token is read off the URL. A wrong token and a row that is not there
// answer IDENTICALLY, which is deliberate: a distinct "bad link" would tell
// somebody guessing which bookings exist.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, useAmendClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/manage")({
  component: Manage,
  // WHAT THIS PAGE IS, so a share of it does not preview as the home page.
  // Without a \`head\` a route inherits the site's own title and description, so
  // every address on the site showed one headline and one blurb — the booking
  // page pasted into a message read as the front page. The root supplies
  // \`og:url\`, the share image and the card type; a page supplies only these.
  head: () => ({
    meta: [
      { title: "Your booking — Sharp Fade Barbers" },
      { property: "og:title", content: "Your booking — Sharp Fade Barbers" },
      { name: "description", content: "Check the time you booked, or cancel it, using the link from your confirmation." },
      { property: "og:description", content: "Check the time you booked, or cancel it, using the link from your confirmation." },
    ],
  }),
  // Search params arrive as unknown; narrowing here is what makes the token a
  // string for the rest of the page instead of \`unknown\`.
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
});

type Appointment = Row & {
  service: string;
  date: string;
  time: string;
  status: string | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
  contact: {
    phone: "0114 270 0000",
    email: "hello@cutlerrow.co.uk",
    address: "14 Cutler Row\\nSheffield S1 2AY",
    hours: "Tue–Fri 9–6, Sat 8.30–5",
  },
  social: [
    { network: "instagram", href: "https://instagram.com/cutlerrow" },
    { network: "facebook", href: "https://facebook.com/cutlerrow" },
  ],
};

function Manage() {
  const { t: claim } = Route.useSearch();
  // The schema declares these three functions; they are named here, not guessed.
  const booking = useClaimedRow<Appointment>("booking_by_claim", claim);
  const cancel = useCancelClaim("cancel_booking_by_claim");
  const amend = useAmendClaim("amend_booking_by_claim");
  const [moving, setMoving] = useState(false);

  const onCancel = () => {
    if (!claim) return;
    cancel.mutate(
      { claim },
      {
        // Idempotent on purpose — a cancel link gets clicked twice, and the second
        // click should read as "already cancelled", never as a broken link.
        onSuccess: () => toast.success("Cancelled. Sorry to miss you."),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onMove = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!claim) return;
    const form = new FormData(e.currentTarget);
    // The keys are the FUNCTION'S argument names, and the function decides which
    // columns those reach — so this page cannot touch a column the business did
    // not open, and the table's own constraints re-run inside the UPDATE.
    amend.mutate(
      { claim, values: { new_date: String(form.get("date") || ""), new_time: String(form.get("time") || "") } },
      {
        onSuccess: () => { setMoving(false); toast.success("Moved. See you then."); },
        // A slot taken between opening this page and submitting it comes back as
        // the same duplicate error the booking form gets, and says so.
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Your booking</h1>

        {!claim && (
          <p className="mt-4 text-muted-foreground">
            This page needs the link from your confirmation.{" "}
            <Link to="/book" className="underline">
              Book a chair
            </Link>{" "}
            instead.
          </p>
        )}

        {claim && booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

        {claim && booking.isError && (
          <p className="mt-4 text-sm text-destructive">
            Couldn't load your booking. Refresh and try again.
          </p>
        )}

        {/* A missing row and a wrong token land here together, and say the same
            thing — which is the whole point. */}
        {claim && !booking.isPending && !booking.isError && !booking.data && (
          <p className="mt-4 text-muted-foreground">
            We couldn't find that booking. It may have been cancelled already.
          </p>
        )}

        {booking.data && (
          <Card className="mt-6 motion-enter">
            <CardHeader>
              <CardTitle>{booking.data.service}</CardTitle>
              <CardDescription className="tabular-nums">
                {booking.data.date} at {booking.data.time}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {booking.data.status === "cancelled" ? "Cancelled" : "Confirmed"}
                </span>
                {booking.data.status !== "cancelled" && (
                  <div className="flex gap-2">
                    {/* CHANGE SITS BEFORE CANCEL, and reads as the ordinary
                        action, because moving an appointment is what somebody
                        opening this link usually wants. Cancel stays
                        destructive and second. */}
                    <Button variant="outline" onClick={() => setMoving((v) => !v)}>
                      {moving ? "Keep it" : "Change time"}
                    </Button>
                    <Button variant="destructive" onClick={onCancel} disabled={cancel.isPending}>
                      {cancel.isPending ? "Cancelling…" : "Cancel booking"}
                    </Button>
                  </div>
                )}
              </div>

              {moving && booking.data.status !== "cancelled" && (
                /* PRE-FILLED with what they already have, so moving by an hour
                   is one field and not a re-entry of the whole booking. */
                <form onSubmit={onMove} className="flex flex-wrap items-end gap-3 border-t pt-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <Input type="date" name="date" defaultValue={booking.data.date} required />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <Input type="time" name="time" defaultValue={booking.data.time} required />
                  </label>
                  <Button type="submit" disabled={amend.isPending}>
                    {amend.isPending ? "Moving…" : "Move booking"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteChrome>
  );
}
`,
  },
  {
    path: "account.tsx",
    blurb: "MEMBERS — sign in, then read a table scoped to whoever signed in.",
    source: `// Reference page — MEMBERS. A \`user\`, \`feed\` or \`admin\` table is scoped to the
// visitor who is signed in, so reading or writing one WITHOUT a session is a
// 401, and a page that shows an error instead of a sign-in form looks broken
// rather than locked. That is the whole reason this page exists.
//
// One form, two buttons. Sign-up and sign-in take the same shape, so splitting
// them into two pages doubles the code and halves the chance a visitor finds the
// one they need.
//
// ONE ERROR FOR THE WHOLE FORM, never per field. Saying which of the address and
// the password was wrong tells somebody whether that address has an account
// here.
//
// The chrome wraps the page ONCE, with the three states switching inside it. A
// component that returns early into a second copy of the layout is how a header
// ends up on two of a page's three states.
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogin,
  useSignup,
  useLogout,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/account")({
  // WHAT THIS PAGE IS, so a share of it does not preview as the home page.
  // Without a \`head\` a route inherits the site's own title and description, so
  // every address on the site showed one headline and one blurb — the booking
  // page pasted into a message read as the front page. The root supplies
  // \`og:url\`, the share image and the card type; a page supplies only these.
  head: () => ({
    meta: [
      { title: "Your account — Sharp Fade Barbers" },
      { property: "og:title", content: "Your account — Sharp Fade Barbers" },
      { name: "description", content: "Sign in to see your past visits and the times you have booked." },
      { property: "og:description", content: "Sign in to see your past visits and the times you have booked." },
    ],
  }),
  component: Account,
});

type Profile = Row & { nickname: string | null };

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
  contact: {
    phone: "0114 270 0000",
    email: "hello@cutlerrow.co.uk",
    address: "14 Cutler Row\\nSheffield S1 2AY",
    hours: "Tue–Fri 9–6, Sat 8.30–5",
  },
  social: [
    { network: "instagram", href: "https://instagram.com/cutlerrow" },
    { network: "facebook", href: "https://facebook.com/cutlerrow" },
  ],
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  // 8 is the server's own minimum. Saying so here saves a round trip.
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Account() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  // The callback's parameter is NOT annotated. TanStack's mutation callback is
  // contravariant in four arguments and refuses any hand-written type for it.
  const submit = (action: typeof login, values: Credentials) => {
    action.mutate(values, {
      onSuccess: (data) => {
        // A second factor answers with \`pending\` and NO token, so "it returned
        // 200" is not the same as "you are signed in".
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {/* Member-scoped reads live BEHIND the sign-in check, never beside it.
            Rendering this at all is the proof there is a session. */}
        {member.data && <SignedIn name={member.data.name} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or make an account to keep your details.
            </p>

            <Form {...form}>
              <form
                className="mt-8 grid gap-4"
                onSubmit={form.handleSubmit((v) => submit(login, v))}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3">
                  <Button type="submit" className="motion-press" disabled={login.isPending}>
                    {login.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={signup.isPending}
                    onClick={form.handleSubmit((v) => submit(signup, v))}
                  >
                    Create an account
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}

function SignedIn({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const profiles = useRows<Profile>("profiles");
  const create = useCreateRow("profiles");

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {name}</h1>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* \`profiles\` is a \`user\` table, so this read returns THIS member's
              rows and nobody else's — the scoping is the database's job, not a
              filter written here. */}
          <DataList
            query={profiles}
            className="grid gap-2"
            skeleton={1}
            empty={{ title: "Nothing saved yet" }}
            error="Couldn't load your details."
          >
            {(p) => (
              <p key={p.id} className="text-sm">
                {p.nickname}
              </p>
            )}
          </DataList>
          <Button
            className="mt-4"
            disabled={create.isPending}
            onClick={() => create.mutate({ nickname: name })}
          >
            Save my name
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
`,
  },
];

/** The home page alone, which is what most briefs need. */
export const REFERENCE_PAGE = REFERENCE_PAGES[0].source;

/**
 * COMPONENTS THE RULES CITE IN THEIR OWN PROSE rather than in a reference page —
 * rule 18's worked `localBusinessJsonLd` call. It cannot be derived from the
 * pages, so it is named, and the always-on signature core folds it in.
 *
 * `UI_SHORTLIST` USED TO LIVE HERE and went with the per-site change on
 * 2026-08-20. It was the 292 names the model was told to reach for, derived from
 * the 100 families' own component lists plus the reference pages' imports — and
 * with the families gone from the designer's tool there is nothing left to
 * derive it from, and nothing read it. What replaced it is two lists in two
 * places: rule 3 now names ALL 2,112 modules (so the model is never wrong about
 * what exists) and `ALWAYS_API_CORE` carries the signatures every site gets,
 * with this site's own manifest arriving fresh in the user turn.
 *
 * THE FAILURE IT WAS BUILT AROUND IS STILL PREVENTED, by a wider rule rather
 * than a narrower one. Rule 3 said "the only names under that path you should
 * use" and then showed a worked example importing ten modules that were not in
 * it — so the generator, obeying both, wrote `import { Hero } from
 * "@/components/ui/hero-split"`: the EXPORT from the example, the MODULE from
 * the list. A list of everything cannot contradict an example.
 */
export const RULE_CITED_COMPONENTS = ["seo-jsonld"];

/**
 * THE SIGNATURES EVERY SITE GETS, cached — 32 components, ~1,112 tokens.
 *
 * TWO SETS FOR TWO DIFFERENT REASONS, and neither alone is right.
 *
 * The DERIVED half is every component the four reference pages import, plus
 * anything the rules cite by name. Self-maintaining, survives the deletion of the
 * family table, and principled: the prompt already SHOWS these in use, so the
 * model will copy them and needs their real props. Measured at 43.6% of every
 * reach in the 324-page corpus.
 *
 * The FROZEN half is the frequency head that no reference page demonstrates —
 * `faq` is on 216 of 324 pages and appears in no worked example at all. Used
 * everywhere, shown nowhere, which is the worst combination there is. Taken off
 * the front of `KIT_PALETTE` rather than listed again here, so the one frozen
 * measurement serves both the designer's palette and this core.
 *
 * WHERE IT STOPS, and why here: coverage is 43.6% derived-only and 66.9% at this
 * size, and then about 250 tokens per 3 points after it. The knee is at 20.
 */
export const ALWAYS_API_CORE = (() => {
  const core = new Set(RULE_CITED_COMPONENTS);
  for (const p of REFERENCE_PAGES) {
    for (const m of String(p.source).matchAll(/from "@\/components\/ui\/([a-z0-9-]+)"/g)) core.add(m[1]);
  }
  for (const n of KIT_PALETTE.slice(0, 20)) core.add(n);
  const real = new Set(UI_COMPONENTS);
  return [...core].filter((n) => real.has(n));
})();

/**
 * THE SIGNATURES THIS SITE GETS, fresh, in the user turn.
 *
 * The manifest MINUS whatever the cached core already carries: a component
 * printed twice is a component paid for twice, at 1x rather than the 0.1x a
 * cache read costs.
 *
 * IN THE USER MESSAGE, NEVER THE CACHED BLOCK — the same reasoning as the layout
 * directive and the photograph allowance one function below. A cache entry is
 * keyed on the bytes, so a block that varies per site would miss the ~27,000-token
 * prefix on every single build: measured at thirteen times the input cost.
 *
 * EMPTY STRING WHEN THERE IS NOTHING TO ADD, so a caller with no manifest sends
 * exactly the request it sent before this existed.
 */
export function siteComponentApi(components) {
  const core = new Set(ALWAYS_API_CORE);
  const extra = (Array.isArray(components) ? components : []).filter((n) => !core.has(n));
  const block = componentApiFor(extra);
  if (!block) return "";
  return "THE COMPONENTS THIS SITE NEEDS — their exact props, checked against the same rule as the\n" +
    "core above: a prop that does not exist is a compile error and costs the page.\n" + block;
}



export const PAGE_RULES = `You write the pages of a small business website, as TypeScript React route files.

The site's database ALREADY EXISTS. A schema was designed from the same brief and its tables
are live Postgres. You are given exactly what was created. You cannot invent a table, a column
or an access level — anything not in the schema below does not exist.

## Hard rules

1. NO FETCH CODE. Read with \`useRows\`, write with \`useCreateRow\`, both from "@/lib/rows".
   A page that calls fetch, axios or XMLHttpRequest is wrong.
   AND NO CommonJS: every page is an ES module. \`require()\` and \`module.exports\`
   typecheck and bundle, then throw "require is not defined" in the browser and take
   the whole section down with them. Top-level \`import\` only.

2. RESPECT THE ACCESS LEVEL. The API enforces it — this is not a matter of taste.
   - \`display\` — you may LIST and READ it. A write returns 403.
   - \`collect\` — you may SUBMIT a form to it. A read returns 403. These rows are other
     visitors' submissions; never list them, never count them, never show "3 people booked".
   - \`user\` — PRIVATE PER MEMBER. Signed in, they read and write only their OWN rows;
     signed out, both return 401. Build the signed-in view AND a sign-in prompt.
   - \`feed\` — SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in
     member writes rows that become theirs. Signed out, both return 401.
   - \`admin\` — SHARED, READ-ONLY FROM THE SITE. Anyone signed in reads every row, and
     NOBODY writes one from a published page — not a form, not \`useCreateRow\`, not an
     edit, whatever role the member holds. The table is granted SELECT and nothing else,
     so a write is 403 for everyone; the business maintains those rows from its Go Farther
     dashboard. Build the reading UI and no write UI at all.

3. THE KIT FOR EVERY CONTROL, imported from "@/components/ui/<name>". Never hand-roll a
   button, input, select, checkbox or dialog. These are every name under that path,
   and nothing else exists there:
   ${UI_COMPONENTS.join(", ")}.

   THE EXPORT NAME IS THE FILE NAME IN PascalCase, EXACTLY — no embellishment.
   \`@/components/ui/faq\` exports \`Faq\`, not \`FaqAccordion\`; \`open-now\` exports
   \`OpenNow\`. That holds for ${(Object.keys(UI_EXPORTS).length - UI_EXPORT_EXCEPTIONS.length).toLocaleString("en-GB")} of the ${Object.keys(UI_EXPORTS).length.toLocaleString("en-GB")} modules, and guessing a longer,
   more descriptive name is a compile error that costs the whole site — measured
   live, it is one of the three commonest failures there are. The exceptions,
   which are the only modules where the name is not deducible:
   ${UI_EXPORT_EXCEPTIONS.map(([m, n]) => m + " → " + [...n].join(", ")).join("; ")}.

   THEIR EXACT PROPS — check every call against this rather than guessing. A prop
   that does not exist, or a state value outside the union shown, is a compile error
   and the whole site falls back to its data model. Where a type is a NAME
   (\`Row[]\`, \`Activity[]\`), hand it the rows a hook gave you and do not invent
   fields on it.
   **Props are stated in two places and they are the whole set you can rely on: the
   handful below, which every site gets, and a block LATER IN THIS MESSAGE listing the
   ones chosen for THIS site. Everything else in the list above is real and you may
   render it — but you would be calling it blind, so keep such a call to \`children\`
   and \`className\`, which every component in the kit accepts.**
${componentApiFor(ALWAYS_API_CORE)}

   There is no "toast" or "use-toast" component — toasts come from \`import { toast } from "sonner"\`.
   The kit does not stop here: ${CHART_NAME_COUNT} chart components live under
   "@/components/charts/lib/<domain>" and are listed in full below. They are part of the
   same kit, reached by a different path — so "nothing else exists" above is about that
   path, not about what you may render.

4. FORMS ARE react-hook-form + zod, through shadcn's \`Form\`/\`FormField\`/\`FormControl\`.
   Those components speak to react-hook-form and to nothing else.

5. THE ZOD SCHEMA MIRRORS THE DECLARED COLUMNS. The API drops anything undeclared, so a field
   the schema does not have vanishes without an error.

6. NEVER WRITE A MANAGED COLUMN. These are set by the engine and dropped from any write:
   ${MANAGED_COLUMNS.join(", ")}.

7. EVERY PICTURE IS \`<SafeImage>\`, NEVER A BARE \`<img>\`.
   \`SafeImage(src?, alt?, ratio? = "4/3", fallback?, fallbackSeed?)\` draws the picture when
   there is one and this theme's own designed placeholder when there is not, so there is
   nothing to guard and nothing to remember. A bare \`<img src="">\` paints a broken icon.
   - A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING. \`photo\`, \`image_url\`, \`avatar\`,
     \`logo\`, \`cover\`, \`hero_image\` and the like are ordinary text columns holding a path
     like "/u/<slug>/<hash>.jpg". On a \`display\` table the OWNER fills these in after the
     build, so on a new site they are empty — pass one straight through and let the
     component decide: \`<SafeImage src={row.photo} alt={row.name} ratio="4/3" className="..." />\`.
   - A DECORATIVE picture takes \`alt=""\`, HTML's own way of saying so; the placeholder
     then paints a plain panel rather than a captioned tile. Two of them side by side take
     different \`fallbackSeed\` values so they do not come out identical.
   - A REAL PHOTOGRAPH is a \`@@IMG:describe the picture@@\` token in the \`src\`, and how
     many this site may have is stated with the brief below. Write one ONLY in a
     \`SafeImage\` \`src\` and NEVER invent a path under /u/ yourself: a token that cannot be
     bought becomes an empty src, which is the placeholder, while a made-up path is a 404
     on every page that shows it.
   - A DOCUMENT TO DOWNLOAD FOLLOWS THE SAME RULE FROM THE OTHER END — a menu as a PDF,
     a price list, a brochure, a council's minutes. Use \`<DownloadCard name="Budget
     2026-27.pdf" size={140_000} />\` and **leave \`href\` OFF**: the owner uploads the file
     after the build, so there is no address to write yet, and the card says "Not available
     yet" until there is one. NEVER point it at a route (\`href="/report"\` navigates to a
     page, it does not download) and never invent a path under /u/. Write these where the
     brief names a real document; do not invent a library of them.

8. A FORM MAY LET THE VISITOR ATTACH ONE, but ONLY where the table above says
   \`FILE UPLOAD: YES\`. That line names the column to put the URL in. Where it says NO
   there is no attach control at all — the upload endpoint answers 403 for that table,
   so a file picker on it is a control that visibly fails. Do not work it out from the
   column names; the line is the answer.
   Upload first, then submit the URL as an ordinary text field:

   \`\`\`tsx
   const upload = useUploadFile("bookings");           // from "@/lib/rows"
   // <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ... />
   const { url } = await upload.mutateAsync(file);
   form.setValue("photo", url);                        // then create the row as normal
   \`\`\`

   The row write is still plain JSON — there is no multipart and no "file field".
   Disable submit while \`upload.isPending\`, and surface \`error.message\` like any other
   write: the API says "that image is too big" or "that doesn't look like a PNG, JPEG,
   WebP or GIF", which is worth showing. **PNG, JPEG, WebP and GIF only — SVG is refused**
   — and the file is capped at 2 MB, so say so next to the control rather than letting
   someone pick a 12 MB photo and be told no afterwards.

9. A BOOKING PAGE SHOWS WHICH SLOTS ARE TAKEN with \`usePublicRows\`. A \`collect\` table
   cannot be read — that is the whole point of it — but if the schema declares a
   \`publicView\` on it, that projection CAN be read by anyone, and it is how a form greys
   out a time somebody already booked. \`usePublicRows("bookings")\` returns only the
   columns the schema chose to publish, never a name or an email.
   **The schema above says, per table, whether this works — do not infer it.** When it says
   NO, build the ordinary form and ship it: the visitor picks a time and the server refuses
   a taken one with a clear message. Greying slots out early is a nicety, and a page that
   fails because it could not have one is far worse than a page without one.
   **These rows have NO \`id\`** — a projection publishes only the columns listed above, and
   \`id\` is refused outright. Type them as \`PublicRow & { … }\`, never \`Row & { … }\`, and key
   the list on a published column or the index.

10. GIVE THE VISITOR THEIR SUBMISSION BACK. A \`collect\` table is write-only — no policy
    lets anybody list it — so the person who booked cannot see their appointment again
    unless the SCHEMA declares a way. When it does, the way is a database function:
    \`useClaimedRow("get_booking", token)\` reads one row by its claim token,
    \`useCancelClaim("cancel_booking")\` cancels it, and \`useAmendClaim("amend_booking")\`
    CHANGES it — \`amend.mutate({ claim, values: { date, time } })\`, where the keys are the
    function's own argument names. All three take the FUNCTION NAME the schema declared, not a table.
    **If the schema declares an amend function, build the change as well as the cancel.**
    Cancelling and rebooking is not the same thing: on a table with \`unique\` or \`noOverlap\`
    it gives the slot up before the new one is secured, and it makes the customer type
    everything in again. Pre-fill the form with the row they already have.
    **Only build the manage page if the schema actually declares those functions** —
    check the digest. If it does not, the confirmation screen is the end of the flow, and
    that is a complete site rather than a broken one.
    **\`useCreateRow\` RESOLVES TO NOTHING — never read the created row off it.** A
    \`collect\` table has no SELECT policy and no SELECT grant, which is the entire point
    of write-only, so asking PostgREST to return the inserted row makes the INSERT itself
    fail with 403. It is typed \`void\`, so \`data.claim_token\` is a compile error rather
    than a form that refuses every customer. To hand somebody a manage link, the SCHEMA
    has to expose a function that creates the row AND returns its token — call that with
    \`useRpcAction\`. If it declares no such function, the confirmation screen is the end
    of the flow and the site is complete. **Never annotate a mutation callback's parameter.**
    Write \`onSuccess: (data) => …\`, not \`onSuccess: (data: Booking) => …\`. TanStack's
    callback takes four arguments and its types are contravariant, so ANY hand-written
    annotation is refused even when it looks right — that was three separate build
    failures. Let it infer.
    Build this whenever the schema declares the functions AND the form is an appointment,
    an order or a reservation — anything somebody would want to check or call off. Not for
    a plain contact form, which nobody comes back to.

11. ANYTHING THE SCHEMA DECLARES AS A FUNCTION, you can call: \`useRpc("fn", args)\` to read
    and \`useRpcAction("fn")\` to act. This is how a site does what a filter cannot — a
    total across tables, the slots left on a day, one row out of a write-only table. Only
    call functions the digest actually lists.

12. A CHART COMES FROM "@/components/charts/lib/<domain>", never from a file named
    \`chart-something\`. The \`charts/chart-*.tsx\` files are DEMOS — each one wraps a
    primitive in a Card around invented numbers ("Bookings 268 / 300 · January - June
    2024"). One imported into a page compiles, bundles and publishes a stranger's made-up
    figures to this site's visitors. Import the primitive and pass it the site's own rows.
    The ${CHART_DOMAIN_COUNT} domain modules and everything they export are listed below.

13. A ROUTE PARAM IS A STRING AND \`row.id\` IS A NUMBER. Everything out of
    \`Route.useParams()\` or \`Route.useSearch()\` is typed \`string\`, so putting an id into a
    link or comparing one needs \`String(...)\` — and a comparison without it is not only a
    type error, it is a lookup that would find nothing:
      <Link to="/records/$id" params={{ id: String(row.id) }}>
      navigate({ to: "/record", search: { id: String(row.id) } })
      const record = rows.find((r) => String(r.id) === id)
    Going the OTHER way needs nothing: every hook that takes an id accepts \`string | number\`,
    so \`useRow(TABLE, id)\` with the string straight off the URL is correct. Do not wrap it
    in \`Number()\`.

14. A CATEGORY IS NOT ALPHABETICAL. \`order\` sorts by the VALUE in the column, so ordering
    a menu by its category column gives Dessert, Pizza, Starters — pudding at the top, which
    is not a menu anybody has ever printed. Measured on a real published site.
    Sort in the PAGE against the order the trade uses, and read in an order that is
    meaningful on its own so the list is right even before you group it:
      const SECTIONS = ["Starters", "Pizza", "Dessert"];
      const items = useRows<Item>("menu_items", { order: "price", dir: "asc" });
      const grouped = SECTIONS
        .map((name) => ({ name, rows: (items.data ?? []).filter((r) => r.category === name) }))
        .filter((g) => g.rows.length);
    Anything NOT in your list must still appear — put the leftovers in a final group rather
    than dropping them, or a row the owner adds later is invisible with nothing to explain it.
    The same applies to any column whose values are names rather than quantities: a status, a
    stage, a size, a day of the week. \`order\` by one only when alphabetical IS the answer.

15. EVERY PAGE HAS EXACTLY ONE \`<h1>\`, AND IT NAMES THAT PAGE. Not the site — the page.
    A gallery page's is "Our work", a booking page's is "Book a chair".
    Two things break without it, and neither is visible from the page itself.
    A screen reader announces the page by its \`<h1>\` and lands on an \`<h2>\` with no
    parent, which is a malformed document. And the platform derives the \`<title>\` and
    the share card from it at publish time, so a page with none is pasted into WhatsApp
    wearing the HOME page's name — measured on a real site, where \`/work\` was
    \`SectionHeader + Gallery + CtaBand\` and every section heading is an \`<h2>\`.
    \`<SectionHeader>\` heads a SECTION and is an \`<h2>\` on purpose. The page's own
    heading is \`<PageHeader>\`, \`<CollectionHeader>\`, a \`<Hero>\`, or a plain \`<h1>\`.

16. A TABLE MARKED \`PAID: YES\` IS BOUGHT, NOT SUBMITTED. The digest says so per table.
    \`useCreateRow\` on one returns 403 — a paid table has no public insert at all, which is
    exactly what stops a price being forged — so use \`useCheckout\` and let the server price it.
    THE BASKET IS \`useCart\`, NOT \`useState\`: it is kept across pages and across a reload, so
    a shop can add on one page and check out on another, and it empties itself when the
    customer comes back from Stripe. \`useState\` loses it the moment they navigate.
      const cart = useCart("orders")            // the PAID table's own basket
      const checkout = useCheckout("orders")
      const { data: products = [] } = useRows<Product>("products")
      ...
      <Button onClick={() => cart.add(p.id)}>Add</Button>
      <span>{cart.count} in your basket</span>
      <BusyButton
        busy={checkout.isPending}
        onClick={() => checkout.mutate({ items: cart.lines, fields: { customer_name: name, email } })}
      >Pay <Money amount={total} currency="GBP" /></BusyButton>
    \`cart.lines\` is already the \`{ id, qty }\` shape \`useCheckout\` wants. Also
    \`cart.qtyOf(id)\`, \`cart.setQty(id, n)\` (0 removes), \`cart.remove(id)\`, \`cart.clear()\`,
    and \`cart.ready\` — false until the stored basket has been read, so gate an "your basket
    is empty" message on it rather than flashing it at somebody whose basket is full.
    Send \`{ id, qty }\` and NOTHING else per line — no price, no total, no currency. The
    server reads the prices out of the catalogue table itself, so a total computed in the
    page is for DISPLAY only and is never sent. \`fields\` carries the customer's own
    details and only declared columns survive; never put \`payment_status\` or
    \`amount_total\` on a form, they are the platform's.
    \`mutate\` REDIRECTS to Stripe, so nothing after it runs — no toast, no navigate. The
    customer returns to \`/?paid=<id>\` or \`/?cancelled=<id>\`; read it with
    \`Route.useSearch()\` to say thank you. That id is NOT proof of payment, so never show
    an order's contents from it — the shop's own Stripe tells the platform when it is paid.
    Show the error \`checkout.error\` carries rather than a generic one: it is written for
    the customer, and says so when the shop has not finished setting payments up.

17. NO EXPLANATORY COMMENTS IN THE PAGES YOU WRITE. The examples above are commented
    because they are teaching you; the files you return are a customer's website and
    nobody reads its source. Output costs five times what input costs, and comments are
    27% of the example set — so a comment is the single most expensive thing here, and
    it is bought for a reader who does not exist. Write the code. The one exception is a
    line that stops the next person breaking something non-obvious ("cancelled bookings
    still hold the slot"); if it only restates what the line under it does, leave it out.

18. THE HOME PAGE CARRIES THE BUSINESS'S STRUCTURED DATA when the brief states real
    contact facts — it is what puts the shop's hours, address and phone straight into a
    search result instead of just a blue link. Once, on the home page only, EXACTLY this
    shape — \`address\` is an OBJECT and \`openingHours\` is an ARRAY OF STRINGS:

    \`\`\`tsx
    import { SeoJsonLd, localBusinessJsonLd } from "@/components/ui/seo-jsonld";

    <SeoJsonLd data={localBusinessJsonLd({
      name: "Sharp Fade Barbers",
      telephone: "0113 496 0000",
      address: { street: "42 High Street", city: "Leeds", postcode: "LS1 4AB", country: "GB" },
      openingHours: ["Tu-Sa 09:00-18:00"],
    })} />
    \`\`\`

    Every field except \`name\` is optional, and \`url\`, \`image\` and \`priceRange\` are
    accepted too. ONLY facts the brief actually states: a made-up address or phone number
    in structured data is what gets a site's rich results switched off entirely, so a
    field the brief does not supply is a field you leave out, and a brief that states none
    of them means no \`SeoJsonLd\` at all.

19. EVERY PAGE EXCEPT THE HOME PAGE SAYS WHAT IT IS, in a \`head\` beside its
    \`component\`. Without one it inherits the site's own title and description, so the
    booking page pasted into WhatsApp previews as the home page — same headline, same
    sentence — and a search result for "book a table" shows the site's front page blurb.
    The home page is the ONE that leaves this out: its description was written for exactly
    this purpose and beats anything a page could say about itself.

    \`\`\`tsx
    export const Route = createFileRoute("/book")({
      head: () => ({
        meta: [
          { title: "Book a table — Forno & Co" },
          { property: "og:title", content: "Book a table — Forno & Co" },
          { name: "description", content: "Reserve a table in the dining room or the courtyard, seven days a week." },
          { property: "og:description", content: "Reserve a table in the dining room or the courtyard, seven days a week." },
        ],
      }),
      component: P,
    });
    \`\`\`

    The title is what this page is, then the business — that order, because a phone
    truncates the end. The description is ONE plain sentence about THIS page and not about
    the business; write it for somebody deciding whether to tap, and never repeat the site
    description. \`og:url\`, the share image and the card type are already handled for you
    — do not write those.

20. THE FOOTER TAKES THE BUSINESS'S CONTACT DETAILS, and a visitor scrolls to the bottom
    expecting them. \`SiteChrome\` has three footer slots beyond the name and tagline —
    \`contact\`, \`social\` and \`legal\` — and they belong in the same \`CHROME\` object as
    \`links\` and \`action\`, because they are the same on every page.

    \`\`\`tsx
    const CHROME = {
      name: "Forno & Co",
      tagline: "Wood-fired pizza on Vicar Lane.",
      links: [{ label: "Menu", href: "/menu" }, { label: "Find us", href: "#find-us" }],
      action: { label: "Book a table", href: "/book" },
      contact: {
        phone: "0113 200 0000",
        email: "hello@fornoandco.co.uk",
        address: "42 Vicar Lane\\nLeeds LS1 6BA",
        hours: "Tue–Sun 12–10",
      },
      social: [{ network: "instagram", href: "https://instagram.com/fornoandco" }],
    };
    \`\`\`

    ONLY FACTS THE BRIEF ACTUALLY STATES. A phone number you invented is worse than no
    phone number: somebody rings it. Leave out any field the brief does not answer, and
    leave \`contact\` off entirely when it answers none of them.

    Write \`phone\` the way a person writes it — the \`tel:\` link is derived, so there is no
    second value to keep in step. Put real newlines in \`address\`; they render as lines.
    \`hours\` is ONE line ("Tue–Sun 12–10") — a full timetable is rows in a table, not this.
    \`social\` takes \`{ network, href }\` where network is "instagram", "facebook", "x",
    "youtube", "linkedin", "tiktok", "email" or "phone".

    \`legal\` is \`{ label, href }\` for small print — Privacy, Terms — and points ONLY at a
    page you have actually written. Linking to a privacy page that does not exist gives a
    visitor a not-found page from the bottom of every page on the site, so leave it out
    unless the page is in your own list.

21. SIDES ARE LOGICAL, NEVER LEFT AND RIGHT. Write \`ms-\`/\`me-\`, \`ps-\`/\`pe-\`,
    \`start-\`/\`end-\`, \`text-start\`/\`text-end\`, \`border-s\`/\`border-e\` and
    \`rounded-s\`/\`rounded-e\` in place of \`ml-\`/\`mr-\`, \`pl-\`/\`pr-\`, \`left-\`/\`right-\`,
    \`text-left\`/\`text-right\`, \`border-l\`/\`border-r\` and \`rounded-l\`/\`rounded-r\`.

    THEY ARE THE SAME THING IN ENGLISH — \`ms-4\` and \`ml-4\` put the content in exactly the
    same place — so this costs nothing on the sites you will usually write. On a site whose
    language reads right to left the physical ones do not mirror, and a page written with
    them comes out with its text on one side and every margin, price and border on the
    other: not a limitation anybody can see in the code, and obvious to the person the site
    is for.

    THE ONE EXCEPTION IS CENTRING. \`left-1/2\` with \`-translate-x-1/2\` already centres in
    both directions, because a transform does not mirror — leave that pair exactly as it
    is. Arrows and chevrons need nothing either; the site's own stylesheet mirrors them.

## Reading rows

\`useRows<T>(table, params)\` → a TanStack Query result whose \`.data\` is the rows.
- \`params\`: \`{ limit, offset, order, dir, q, <column>: value }\`. \`limit\` is capped at 100.
- \`order\` must be a DECLARED column or "id" — any other value silently falls back to id.
  \`created_at\` is NOT orderable unless the table declared it.
- a \`<column>: value\` pair is an equality filter, and only on declared columns.
- \`q\` is full-text search and only does something on a table that declared fts.
- rows come back with every column including \`id\` and \`created_at\`, so you can display those
  even though you cannot sort or filter on them.
- type it: \`type Service = Row & { name: string; price: number | null }\`. Every column the
  database did not mark required can be null — say so in the type and guard before rendering.

## Every list handles four states

Omit one and the page looks fine in a screenshot and broken in use:
- \`isPending\` → \`<Skeleton />\` placeholders, not a spinner and not nothing
- \`isError\` → one sentence a visitor can act on
- \`data?.length === 0\` → \`<Empty />\` from \`@/components/ui/empty\`, not a bare paragraph and
  never an empty grid. Give it a heading and a sentence saying what would put something there.
- loaded → the rows

## Every form must

- disable its submit button while \`mutation.isPending\`, and say so on the button — a
  \`<Spinner />\` inside it reads better than swapping the label, and keeps the width steady
- \`toast.success(...)\` and \`form.reset()\` on success
- \`toast.error(e.message)\` on failure — THE API'S OWN MESSAGE. It distinguishes the caller's
  fault from a server fault and returns a \`code\` for duplicate / overlap / bad_ref / required /
  full / invalid. "That time is already taken" is useful; "something went wrong" is not.

## Routing

File-based, TanStack Router. Each page is one file under src/routes/ exporting
\`export const Route = createFileRoute("<url>")({ component: X })\`.
  index.tsx → "/"      about.tsx → "/about"      menu/index.tsx → "/menu"
\`index.tsx\` is required. Link between pages with \`<Link to="/menu">\` from "@tanstack/react-router".
Never write routeTree.gen.ts, __root.tsx, src/pages/ or app/layout.tsx.

NEVER address a page as \`#/menu\`. The app uses browser history, so a \`#/\` link sets the URL
fragment and navigates nowhere — the page looks right and the link is dead. Use the plain path:
\`<Link to="/menu">\` in the body, and \`href: "/menu"\` in a \`SiteChrome\`/\`SiteHeader\` \`links\`
array (those go through \`SiteLink\`, so they route correctly whichever address the site is served
on). Same for navigating in code: \`const navigate = useNavigate()\` then \`navigate({ to: "/menu" })\`,
never \`location.hash = ...\`. An in-page anchor to a section on the SAME page — \`href="#prices"\`
with \`id="prices"\` — is a different thing and is fine.

## Styling

Tailwind v4 with semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
border-border, bg-primary, text-destructive. NEVER a literal colour — not bg-slate-900, not text-red-600, not
bg-[#1a1a1a], not a hex in a style prop. The site's colours come from its theme and from the owner's own
changes, both applied at build time, so a colour written into a page is one they can never change: ask for a
yellow background afterwards and every token moves except the one you hardcoded. It breaks dark mode too. Also available:
lucide-react icons, date-fns, recharts. Import nothing that is not already a dependency.

## Motion

${MOTION_COUNT} effects, as plain classes. There is NO animation library installed and none is
needed — add one and the build fails. Never write your own duration: use these, or the
scale \`duration-(--dur-1|2|3|4)\` (90 / 180 / 320 / 500ms) with \`ease-emphasis\` or
\`ease-standard\`. A raw \`duration-300\` is refused.

Every one of these stops for a visitor who asked for less movement, while the content
stays — so use them freely; they cannot trap anything invisible.

${MOTION_CATALOGUE}

WHEN TO REACH FOR THEM, since most pages need only three:
- Anything you render conditionally that the visitor did not just click — a banner, a
  confirmation, a "we are closed today" notice — gets \`motion-enter\`. Appearing instantly
  reads as a page glitch rather than as the site telling them something.
- A list you map over — services, a menu, opening hours — gets \`motion-stagger\` on the
  \`<ul>\`, not on the items.
- A long page's sections get \`motion-reveal\`. A short one does not: above the fold it
  delays the first thing they came to read.
- Something the visitor clicked open, or an inline editor, gets NOTHING. They are already
  looking at that spot and waiting; a fade there is felt as slowness, not polish.

## Charts — the other half of the kit

${CHART_NAME_COUNT} components across ${CHART_DOMAIN_COUNT} modules under "@/components/charts/lib/". Use them
exactly as you use the ${UI_COMPONENTS.length} above: import, pass props, done. Every one is
prop-driven — hand it \`useRows(...)\` data, never a copied array — and monochrome by rule,
so fill, weight, hatching and a written label carry the reading, never colour alone.

\`import { Bullet } from "@/components/charts/lib/bullet"\`

Most are for a specific trade, and the module name says which: a barber shop's page reaches
for \`salon\`, a cafe's for \`restaurant\`, a gym's for \`gym\`. Pick the domain that matches the
brief before reaching for a generic bar chart — \`salon.RebookRate\` says something a bar
chart cannot.

Six names are exported by two modules each, so take the one under the domain you read it
under. A module not listed here does not exist.

${CHART_CATALOGUE}

## Visitor accounts

A site can have members — its own customers, nothing to do with Go Farther accounts.
Everything comes from \`@/lib/rows\`; there is no other auth API and no \`fetch\`:

- \`useMember()\` → \`{ data: member | null, isPending }\`. **Render neither view until it
  settles**, or the page flashes a sign-in form at somebody already signed in. A member is
  \`{ id, email, name, role, verified }\` and \`id\` is a UUID string, never a number.
- \`useSignup()\` → \`{ email, password, name }\`. \`useLogin()\` → \`{ email, password }\`.
  On success the session is stored and every read re-runs on its own. Passwords need 8+
  characters. Surface the error's \`message\` on failure — the server distinguishes a wrong
  password from an address that already has an account, and inventing your own text loses that.
- \`useLogout()\` → a mutation, no arguments.
- \`useRequestReset()\` → \`{ email }\`. Always succeeds; say "check your inbox" whether or
  not the address has an account, because saying which confirms who is a member. The link
  itself is handled by the platform.

Gate admin UI on \`member.role\`, which is \`"user"\` unless the owner granted something. An
\`admin\` table refuses a write from any other role with a 403, so a button that is always
visible is a button that sometimes fails.

Build sign-in and sign-up ONLY when the schema actually has a \`user\`, \`feed\` or \`admin\`
table. A site of \`display\` and \`collect\` tables needs no accounts, and adding them is
friction nobody asked for — for somebody returning to a form they filled in, the claim link
(rule 10) is the right tool and needs no account at all.

## What is not possible yet

- Editing and deleting work ONLY on a member's OWN rows, in a \`user\` or \`feed\` table, with
  \`useUpdateRow\`/\`useDeleteRow\` and a signed-in member. A \`collect\` or \`display\` row has no
  owner and can never be changed from a page. Someone else's row answers 404, so treat "not found"
  as "not yours" and say so gently. AN EDIT IS WRITTEN LIKE THIS — the id, then the columns:
      const update = useUpdateRow<Deal>("deals");
      update.mutate({ id: deal.id, stage: "won" }, { onSuccess: () => toast.success("Saved") });
  Nesting them under \`values\` works too, if that reads better to you. A DELETE takes the id on
  its own: \`remove.mutate(deal.id)\`.
- No owner/admin dashboard IN THE SITE — a \`collect\` table cannot be read back from a page.
  Its owner reads those submissions inside Go Farther, which is not something you build.
If the brief asks for one of these, build everything else and say plainly in \`notes\` what was
left out and why. Never generate UI that cannot work.

## Definition of done

\`tsc --noEmit\` must be clean and \`vite build\` must succeed. Write real TypeScript: no \`any\`,
no unresolved imports, no props a component does not take.

Keep it to the few pages the brief actually needs — usually one, at most ${MAX_PAGES}. Write warm,
specific copy for the business in the brief; never lorem ipsum, never a placeholder image URL.

## The pages to imitate

Four real, compiling pages of ONE site, written against services(display) + appointments(collect,
with a publicView and a claim token) + profiles(user). They are the shape to copy — every rule
above is visible in them. Take the pages the brief needs and leave the rest; a site with no member
table needs no account page, and a plain contact form needs no manage page.

${REFERENCE_PAGES.map((p) => `### ${p.path} — ${p.blurb}\n\n${p.source}`).join("\n\n")}`;

export const SITE_PAGES_TOOL = {
  name: "write_pages",
  description: "Write the route files for the site.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        // THERE WAS A `minItems: 1` HERE AND IT MADE A DELETION INEXPRESSIBLE.
        // It was added for a measured reason — 2026-08-05, a build called this
        // tool correctly, handed it `[]`, and charged 23 credits for a
        // placeholder — and it is the wrong LAYER for that reason, because this
        // one tool serves a build, a revise, an addon and a one-page edit, and
        // only the first two are always wrong to answer with no pages.
        //
        // MEASURED 2026-08-11, and it explains two failed attempts at fixing this
        // with words: "remove the gallery page" came back rewriting all four of
        // the site's pages and never setting `remove`. That was read as the model
        // ignoring the prompt. It was not — the schema OBLIGED it to return at
        // least one page, a pure deletion has none, and the only expressible
        // answer was the site rewritten. The same shape as `usePublicRows`, where
        // the honest call was a type error and the only one that compiled was a
        // lie.
        //
        // The requirement moved to `validatePages`, which is handed `partial` and
        // therefore KNOWS which of the four it is looking at. There is still no
        // `maxItems`, for the reason below: the cap belongs there too.
        //
        // A schema ceiling would make a model that wanted seven pages produce an
        // INVALID call, and an invalid call is the empty-array failure this all
        // exists to stop. Refusing too much is the same bug as accepting nothing.
        description: "One entry per route file, and one of them MUST be index.tsx. Leave this an EMPTY list only when " +
          "the change is purely a deletion and no page needed its links edited — otherwise every build, revise and " +
          "edit needs at least one.",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: 'Path under src/routes/, e.g. "index.tsx" or "menu.tsx". A directory form ("menu/index.tsx") is accepted and routes at "/menu"; prefer the flat form.',
            },
            source: { type: "string", description: "The complete .tsx source for that route file." },
          },
          required: ["path", "source"],
        },
      },
      remove: {
        type: "array",
        items: { type: "string" },
        description:
          "THE ONLY WAY TO DELETE A PAGE. Use it whenever the change asks for one to go away — \"remove the gallery " +
          "page\", \"we don't need the about page any more\". Leaving a page out of `pages` does NOT delete it here: " +
          "an unreturned page is KEPT, so a deletion answered that way silently does nothing. " +
          "The route files to delete, exactly as they are named above — for example \"src/routes/gallery.tsx\".\n" +
          "IF YOU REMOVE A PAGE YOU MUST ALSO RETURN EVERY PAGE THAT LINKS TO IT, with the link taken out. A link " +
          "pointing at a route that no longer exists does not compile, so the whole change would be refused and " +
          "their site left as it was. Never remove the home page.\n" +
          "Leave this out entirely for anything that is not a deletion.",
      },
      notes: {
        type: "string",
        description:
          "What you built, for the person who asked \u2014 two or three sentences, plain, no markdown. Say what the pages are and " +
          "anything they should know: something the brief asked for that you left out and why, a decision you made for them, a " +
          "detail you had to invent. This is shown to them as the reply in the chat, so write it to them and not about them, and " +
          "do not repeat their own brief back at them.",
      },
    },
    required: ["pages"],
  },
};

/**
 * What each READ level means to a page, in the words the generator acts on.
 *
 * Composed with the write half rather than looked up by name, because the five
 * names are now presets over a 4x4 grid and a table may legitimately sit in a
 * cell with no name at all — "anyone reads, members write their own" is the
 * commonest one, and describing it as its nearest preset would be a lie in
 * whichever direction the preset differs.
 */
export const READ_NOTE = {
  none: "NOBODY READS IT from a page — not a visitor, not a member, not the author. Never list these rows; a read returns 403.",
  own: "PRIVATE PER MEMBER. Signed in, a member reads only their OWN rows; signed out, a read returns 401. Build the signed-in view AND a sign-in prompt.",
  members: "ANY SIGNED-IN MEMBER READS EVERY ROW. Signed out, a read returns 401 — offer a sign-in rather than an empty list.",
  public: "ANYONE READS IT, signed in or not. List it, show it, search it, and never gate it behind a sign-in.",
};

export const WRITE_NOTE = {
  none: "NOBODY WRITES TO IT from a published page — no form, no useCreateRow, no edit, whatever role they hold. The business maintains these rows from its Go Farther dashboard. Build the reading UI and no write UI at all.",
  anyone: "ANY VISITOR WRITES TO IT, with no account — a booking, an order, an enquiry. They may submit and may never reach a row again: update and delete both return 403.",
  own: "A SIGNED-IN MEMBER WRITES ROWS THAT BECOME THEIRS, and edits or deletes only their own. Signed out, a write returns 401.",
  members: "ANY SIGNED-IN MEMBER WRITES, and may edit or delete ANY row, not only their own.",
};

/** The two halves as one sentence, for a table however it was declared. */
export function accessNote(t) {
  const { read, write } = resolveAccess(t);
  return "reads — " + (READ_NOTE[read] || READ_NOTE.none) + " writes — " + (WRITE_NOTE[write] || WRITE_NOTE.none);
}

// `ACCESS_NOTE` — the five-preset map — WAS DELETED HERE, and its absence is
// asserted rather than left to memory.
//
// It had no production reader. `schemaDigest` describes access through
// `accessNote(t)`, composed from `READ_NOTE` and `WRITE_NOTE` above, and
// `grep -rn "ACCESS_NOTE\b"` outside its own definition found only
// `test/page-gen.test.mjs` — whose guard, titled "the rules and ACCESS_NOTE
// agree about every access level", asserted that three phrases appeared in both
// `PAGE_RULES` and this map. Its own comment said why it existed: "Two
// descriptions of the same rule in one prompt is how they drifted apart the
// first time." It was reading a constant nothing sends, so that is exactly what
// it could no longer catch — edit `READ_NOTE.own` or `WRITE_NOTE.members`, the
// strings the model really receives, and the suite stayed green.
//
// THE DRIFT WAS NOT HYPOTHETICAL, and it is what proved the guard vacuous.
// `WRITE_NOTE.none`, which the digest SENDS, said "its Go Farther dashboard";
// rule 2's `admin` bullet and this map both said "its isibi dashboard" — a
// product that has not existed since the rebrand — so the highest-leverage
// prompt on the platform told a business owner to maintain their rows somewhere
// they cannot go, in three places, while a test claimed the two halves agreed.
// Two of the three were in text a build actually sends.
//
// Only two of its five entries were even reachable as CLAIMS: measured,
// "SHARED, MEMBER-AUTHORED" and "SHARED, READ-ONLY FROM THE SITE" appear nowhere
// in what `accessNote` composes, so the guard's own phrase list described the
// dead constant rather than the live one.
//
// Deleting it is what makes the replacement guard honest: with one description
// of access in this file, "the two descriptions agree" becomes "rule 2 agrees
// with what the digest emits", which the test now reads by driving
// `schemaDigest` itself. Restoring a second unread map brings the vacuity
// straight back, so its absence is a test.

/** The tables, exactly as they exist, in the least ambiguous form we can put them. */
export function schemaDigest(spec) {
  // A RETIRED TABLE IS NOT OFFERED, and this is half of what makes retiring
  // work: `grantsFor` withdraws its public access, and this stops the generator
  // writing a page against it. Told about it, the model would build a list that
  // renders empty and a form that 401s — worse than the feature simply being
  // gone, because it looks broken rather than removed.
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : [])
    .filter((t) => t && t.name && !t.retired);
  if (!tables.length) return "(the schema declares no tables)";
  // DECLARED FUNCTIONS, STATED. `useRpc`, `useRpcAction`, `useClaimedRow` and
  // `useCancelClaim` all take a function NAME, and the model has no way to
  // discover one — it can only be told. Not saying is how the whole tier stayed
  // dead: exactly the `publicView` failure, where a rule was conditioned on a
  // fact the digest never supplied.
  //
  // Printed with the exact signature, because a name alone does not say what to
  // pass. An ABSENT section reads as "this site declared none", which is the
  // honest answer and the common one.
  // INTERNAL FUNCTIONS ARE NOT CALLABLE AND MUST NOT BE ADVERTISED. An
  // `internal: true` function is REVOKEd from PUBLIC and never granted to the
  // Data API roles — that is the whole point of the flag (a confirmation
  // builder returns somebody's address and message). Listing it here told the
  // model it could call it, and `lintPages` accepted the call, so the page
  // compiled, published, and answered 403 to every visitor: exactly the class
  // the lint exists to catch, arriving through the catalogue instead.
  const fns = (spec && Array.isArray(spec.functions) ? spec.functions : []).filter((f) => f && f.name && !f.internal);
  const fnLines = fns.length
    ? "\n\nFUNCTIONS this schema declares — call these by NAME with useRpc / useRpcAction / useClaimedRow / useCancelClaim / useAmendClaim, and NO others:\n" +
      fns.map((f) => {
        const args = (Array.isArray(f.args) ? f.args : []).map((a2) => a2.name + ": " + a2.type).join(", ");
        return "  " + f.name + "(" + args + ") -> " + (f.returns || "void");
      }).join("\n")
    : "";
  // THIRD-PARTY READS, which the model was never told about at all. `useApi` is
  // the one hook in `@/lib/rows` no rule and no digest ever mentioned, so a site
  // could declare an api, the platform would serve it, and no generated page
  // could ever call it — the whole tier reachable by nothing, which is this
  // repo's signature failure and the reason `apis` is stated here beside the
  // functions rather than left for the model to discover.
  const apis = (spec && Array.isArray(spec.apis) ? spec.apis : []).filter((a) => a && a.name);
  const apiLines = apis.length
    ? "\n\nOUTSIDE DATA this site can read — call these by NAME with useApi(name, { params }), and NO others:\n" +
      apis.map((a) => {
        const ps = (Array.isArray(a.params) ? a.params : []).join(", ");
        return "  " + a.name + "(" + ps + ")" +
          " — the platform holds the key and does the call; the page only gets the answer back as JSON.";
      }).join("\n")
    : "";
  const tableLines = tables.map((t) => {
    // THE STAMPED NAME IS NOT BOUND HERE AT ALL, and that is the fix rather than
    // a tidy-up. `const access = String(t.access || "collect")` sat in this scope
    // and every gate that reached for it got the pair bug — six instances across
    // the file before the last two went. A variable holding the preset a table
    // never declared, in the one scope that describes tables to the model, is a
    // trap that has been fallen into once per reader. `rw` is the pair and
    // `presetName` is the resolved shorthand; there is nothing else to reach for.
    const rw = resolveAccess(t);
    const presetName = accessNameFor(rw);
    // Columns arrive in two shapes and BOTH must work. normalizeSchema produces
    // rich objects ({name, type, notnull, ref}); the schema persisted in a
    // site's own `_meta` stores plain NAMES. Filtering on `c.name` silently
    // dropped every string, so a spec read back from _meta described each table
    // as having no columns at all — and the generator dutifully wrote pages that
    // said so. Live for one deploy on 2026-07-28.
    const cols = (t.columns || [])
      .map((c) => (typeof c === "string" ? { name: c } : c))
      .filter((c) => c && c.name);
    const described = cols.map((c) => {
      const bits = [String(c.type || "text").toLowerCase()];
      if (c.notnull) bits.push("required");
      if (c.ref) bits.push("names a row in " + c.ref);
      return c.name + " (" + bits.join(", ") + ")";
    });
    const lines = [
      // STATED AS THE PAIR. It read `access "user"` and the note for that name,
      // which cannot describe a table sitting in one of the eleven cells no
      // preset covers — and naming the nearest preset instead is wrong in
      // whichever direction they differ. The preset name is still printed when
      // there IS one, because it is what the schema says and what a revise will
      // read back.
      "TABLE " + t.name + " — read \"" + rw.read + "\", write \"" + rw.write + "\"" +
        (presetName ? " (\"" + presetName + "\")" : "") + ": " + accessNote(t),
      "  columns: " + (described.length ? described.join(" · ") : "(none)"),
    ];
    if (rw.read === "public") {
      lines.push("  order / filter by: " + cols.map((c) => c.name).concat("id").join(", "));
      lines.push("  full-text search: " + (t.fts ? "yes — pass { q } to useRows" : "no — do not pass q"));
    }
    // Whether `usePublicRows` works on this table, stated rather than left to be
    // guessed. Rule 9 says not to call it on a table with no public view — a
    // rule the model could not follow, because nothing here told it which tables
    // have one. Measured live 2026-07-29: it correctly worked out that
    // `bookings` had none, could not build the taken-slots hint, and the whole
    // site came out as the placeholder over one optional enhancement.
    //
    // Printed for EVERY table, not only the ones that have it. "No public view"
    // is the fact that stops a 404, and an absent line reads as an omission
    // rather than an answer.
    // `user` normally means private-to-me. `teamScope` changes that to
    // "ours", and a page that says "your notes" on a shared team table is
    // describing something the API does not do.
    //
    // THE RESOLVED PAIR, NOT THE STAMPED NAME — the pair bug, in the last two
    // readers in this file. `normalizeSchema` stamps `access: "collect"` on any
    // table that did not name a preset, and the design tool tells the model to
    // leave `access` out when it declares a pair. So a team table spelled
    // `{read:"own", write:"own"}` arrived here wearing "collect", this line was
    // NEVER printed, and the generator wrote "your notes" on a table the whole
    // team shares. The line below had it too: a pair-declared display table was
    // stamped "collect" and got a `usePublicRows` line its preset-declared twin
    // does not, so one fact was stated inconsistently depending on how the
    // designer happened to spell the same access.
    if (t.teamScope && presetName === "user") {
      lines.push("  SHARED WITH THE TEAM: everyone in this member's team reads and edits the same rows. Say \"our\"/\"the team's\", not \"your\".");
    }
    if (presetName !== "display") {
      // `hasPublicView` decides, not a shape test written here — the data path
      // answers 404 on exactly this question, and a second copy of the rule
      // drifts into a digest that promises a read the API refuses.
      lines.push(hasPublicView(t)
        ? "  usePublicRows: YES — anyone may read " + t.publicView.columns.join(", ") + " from this table"
        : "  usePublicRows: NO — this table has no public view; calling it is a 404, so build the page without it");
    }
    // THE ORDER THE OWNER ASKED FOR, and this is the one field in the tier that
    // the DATABASE cannot keep. Reads go straight to the Data API, which orders
    // by whatever the page's `useRows` asks for — so `defaultSort` can only ever
    // be a fact the generator is told, never a guarantee. Stated here because
    // told to nobody it was worth exactly nothing, which is what it was.
    //
    // Related to the alphabetical-menu failure and NOT a replacement for it:
    // that rule is about ordering a category column by meaning rather than by
    // value, and it stays. This is the table saying which column to sort ON.
    if (t.defaultSort) {
      const desc = String(t.defaultSort).trim().startsWith("-");
      lines.push("  DEFAULT ORDER: " + String(t.defaultSort).replace(/^[-+]/, "") +
        (desc ? " descending" : " ascending") +
        " — pass this to useRows unless the page has a reason of its own");
    }
    // Stated for every table a public page can SUBMIT to, YES or NO, never
    // omitted — an absent line reads as an omission rather than an answer, the
    // exact failure that made a whole site come out as the placeholder when
    // `publicView` was declarable, enforced, and never mentioned here.
    //
    // GATED ON THE RESOLVED PAIR, not the raw preset string (2026-08-14 audit,
    // confirmed by executing this function). `normalizeSchema` stamps
    // access:"collect" on every pair-declared table, so `access === "collect"`
    // printed "PAID: NO — submit it with useCreateRow" for a {read:"public",
    // write:"none"} menu, DIRECTLY UNDER the pair note saying nobody writes to
    // it — a prompt that both forbids and prescribes the form. And a payable
    // table gets its do-NOT-useCreateRow warning whatever access it wears:
    // the payment is the fact that decides, not the preset name.
    const pay = normalizePayment(t);
    if (pay) {
      lines.push("  PAID: YES — the visitor pays by card. Do NOT call useCreateRow on this table; it has no public insert and would 403. "
        + "Use useCheckout(\"" + t.name + "\") with the rows they chose from " + pay.from + ", priced in " + pay.currency.toUpperCase() + ". "
        + "The page sends only { id, qty } per line — never a price, total or currency — plus the customer's own declared fields.");
    } else if (canWriteAccess(t)) {
      lines.push("  PAID: NO — this is an ordinary form. Submit it with useCreateRow; there is no payment on this table.");
    }
    // WHETHER THE FORM MAY TAKE A FILE — the third instance of a rule conditioned
    // on a fact this digest never stated, after `publicView` twice.
    //
    // Rule 8 says a form may accept an attachment "only when its table declares an
    // image column", and whether it does is decided by `acceptsVisitorUploads` →
    // `isImageColumn`, a NAMING regex the model has never been shown. So the model
    // was asked to evaluate a condition it could not see. Measured: a `bookings`
    // table with `name · email · attachment · notes` — `attachment` being the
    // natural name for "a photo of the job" — prints those four columns, states
    // nothing about uploads, and `handleVisitorUpload` answers 403
    // `{code:"no_uploads"}` to every visitor who picks a file.
    //
    // STATED YES *AND* NO, for the reason `usePublicRows` is: the page has to
    // DECIDE whether to draw an attach control, and an absent line reads as an
    // omission rather than an answer.
    //
    // GATED LIKE `PAID`, on the table being writable from a page at all: a table
    // nothing may write to can never take a visitor's file, and a form on it is
    // already refused by the access rule above. `acceptsVisitorUploads` is asked
    // FIRST and independently, so if its own write test ever widens, the YES line
    // still prints — the gate can only ever suppress a NO.
    const takesFiles = acceptsVisitorUploads(t);
    if (takesFiles) {
      // The COLUMN, not just the permission. Rule 8's worked example ends
      // `form.setValue("photo", url)` and the model has to know which column that
      // is; naming it is the difference between a control that works and one that
      // uploads a file and drops the URL. Same `isImageColumn` the permission was
      // decided by, so the two cannot disagree.
      const shot = cols.map((c) => c.name).find(isImageColumn);
      lines.push("  FILE UPLOAD: YES — a visitor may attach one picture. Upload it with useUploadFile(\"" + t.name + "\")" +
        (shot ? " and submit the returned URL as the `" + shot + "` field" : "") +
        ". PNG, JPEG, WebP or GIF only, 2 MB max.");
    } else if (canWriteAccess(t) || canMemberWrite(t)) {
      lines.push("  FILE UPLOAD: NO — this table declares no picture column, so useUploadFile on it is a 403. " +
        "Build the form without an attach control.");
    }
    // STATED ONLY WHEN IT IS ON, unlike `usePublicRows` directly above. That one
    // prints YES *and* NO because a page has to DECIDE something and an absent
    // line would read as an omission rather than an answer. Nothing on a page
    // changes because a table emits webhooks — the platform fires them on the
    // data path, after the write — so the line exists to stop the model
    // hand-rolling a notification that already exists, and a "WEBHOOKS: NO" on
    // every table of every site would be ~30 tokens of cached prompt saying
    // nothing anybody acts on.
    const fires = t.webhooks === true ? ["created", "updated", "deleted"]
      : (Array.isArray(t.webhooks) ? t.webhooks : []);
    if (fires.length) {
      lines.push("  SENDS ELSEWHERE: this table already posts to the owner's own system on " + fires.join(", ")
        + ". The platform does it after the write — do not build any notification, polling or forwarding for it.");
    }
    return lines.join("\n");
  }).join("\n\n");
  // THE AGGREGATE, WHICH NO PER-TABLE LINE CAN STATE.
  //
  // Every table above is described accurately and the fact that MATTERS is a
  // property of the set: whether a signed-out visitor can read anything at all.
  // Measured live 2026-08-10 on a real marketplace — `events` private per member,
  // `bookings` write-only, `reviews` members-only — so not one visitor could see
  // a single listing. The generator had no home page it could honestly write and
  // returned NOTHING, and the failure surfaced two steps downstream at
  // `stage: validate` with a message that named none of this.
  //
  // A STATEMENT OF FACT, NOT A RULE, which is what makes it safe to add. It
  // cannot false-alarm: an internal tool legitimately has no public tables, and
  // the sentence is correct for that site too — build the sign-in first. The
  // alternative, refusing the schema, would be wrong for every such site, and
  // this codebase already records that a check wrong a third of the time is
  // worse than no check.
  const readable = tables.filter((t) => resolveAccess(t).read === "public" || hasPublicView(t));
  const shut = tables.length && !readable.length
    ? "\nNOTHING ON THIS SITE IS READABLE BY A SIGNED-OUT VISITOR. Every table above needs a signed-in " +
      "member, so there is NO public list to build and no browse page to write. Do not write one: it would " +
      "401 for everybody who is not signed in. Build a home page that says what the site is and offers a " +
      "sign-in, and put every list behind it.\n"
    : "";
  return tableLines + shut + fnLines + apiLines;
}

/**
 * The user turn: what to build, and what already exists to build it against.
 * The brand is the name the schema designer settled on, and it is already in the
 * published page's <title> — passing it here keeps the heading from disagreeing
 * with the browser tab.
 */
/**
 * What the generator is told a revise is FOR.
 *
 * A revise sends {slug, instruction}, so before this the generator's entire
 * knowledge of the site was one line like "add a gallery" — and since it rewrites
 * every page each time, a working barber shop came back as a page listing a
 * gallery and nothing else. The merged schema fixed the tables; this fixes the
 * intent.
 *
 * The ORIGINAL brief is the anchor and is never rewritten by an instruction: an
 * accumulating log would grow without bound and would keep contradicting itself
 * ("remove the gallery" stays true forever). What the site has BECOME is carried
 * by the merged schema, which is the authoritative half anyway.
 */
export function briefForPages({ brief, priorBrief } = {}) {
  const now = String(brief || "").trim();
  const before = String(priorBrief || "").trim();
  if (!before || before === now) return now;
  if (!now) return before;
  return "The site already exists. It was originally built from this brief:\n\n" + before +
    "\n\nWHAT TO CHANGE NOW\n" + now +
    "\n\nKeep everything the original brief asked for unless this change says otherwise.";
}

/**
 * brief + the family's layout directive, which is what the model is ACTUALLY
 * given. Extracted from worker.js 2026-08-04.
 *
 * It lived inline in `buildAndPublishPages`, so the eval — which is supposed to
 * measure the generator — composed its own user turn and sent the bare brief.
 * ~287 tokens of layout instruction that every production build carries and no
 * sample ever did, which made the compile rate a number for a prompt the
 * platform does not send. Exactly what `pagesRequest` was extracted to prevent,
 * one layer up: the harness must not be able to tune a different prompt.
 *
 * GUARDED against a null directive: `layoutDirective` answers null for an
 * unknown family or structure, and interpolating that appends the literal word
 * "null" to the brief and loses the layout, silently.
 *
 * THE PHOTOGRAPH ALLOWANCE RIDES HERE FOR THE SAME REASON THE LAYOUT DOES. It
 * varies per build — it is derived from the family's page set and then cut down
 * to what the balance can carry — and PAGE_RULES sits under `cache_control:
 * ephemeral` at ~27,000 tokens, so a number that changes per build in the system
 * block would miss that cache every single time. Measured on the family
 * exemplar, which faced the same choice: $0.0082 a build becomes $0.1019.
 *
 * `images` is OMITTED, not defaulted, when the caller does not pass one — the
 * eval and every other caller that has no budget to state then sends exactly the
 * request it sent before this existed.
 */
export function briefWithLayout({ brief, plan, images } = {}) {
  // THE AUTHORED PLAN IS THE ONLY SOURCE NOW. It briefly fell back to
  // `layoutDirective(family)` for sites built before 2026-08-20; the family
  // table went the same day, so there is nothing to fall back TO.
  //
  // WHAT THAT COSTS, AND WHY IT IS ACCEPTABLE: a site with a stored family and
  // no plan revises with no layout directive. On a revise that is a much smaller
  // loss than it sounds — `priorPagesBlock` sends the site's OWN page source and
  // `EDIT_RULE` tells the model to return every page byte-identical except where
  // the change was asked for, so the real layout is the pages themselves. A
  // FIRST build always has a plan, because the plan fields are required.
  //
  // `family` AND `structure` USED TO BE TAKEN HERE AND ARE GONE. They were kept
  // for a while as unread parameters "so every caller keeps compiling", which is
  // how a dead argument reads as a live one. `structure` outlived that as a plan
  // field until 2026-08-20 and is now gone from the platform entirely; nothing
  // ever read `family` again.
  const directive = directiveFromPlan(plan);
  const parts = [String(brief ?? "")];
  if (directive) parts.push(directive);
  // THIS SITE'S OWN COMPONENT SIGNATURES, for the reason the layout directive
  // and the photograph allowance are here: it varies per site, and the ~45,000
  // token system block is cached on its exact bytes. A component list that
  // changed per build would miss that prefix every single build — measured on
  // the family exemplar, thirteen times the input cost.
  //
  // FROM THE PLAN, so the manifest the designer wrote is what decides. Empty
  // string when there is nothing to add (no plan, or a manifest wholly inside
  // the cached core), so a caller with neither sends exactly the request it sent
  // before this existed.
  const api = siteComponentApi(plan && plan.components);
  if (api) parts.push(api);
  if (images != null) parts.push(imageDirective(images));
  return parts.join("\n\n");
}

/* THE PER-TRADE EXEMPLAR IS GONE (owner's call, 2026-08-20).
 *
 * `familyExemplar(family)` returned one of 100 complete, compiling home pages —
 * the reference app for that trade — as a worked example in the user turn. It
 * was the single most valuable thing in the prompt for a while: a model copies a
 * working page far more reliably than it follows a paragraph.
 *
 * It went with the families, deliberately and not as collateral. Keyed on the
 * trade NAME, it had no key left the moment the designer stopped naming trades;
 * and the obvious rescue — re-key eight of them on `structure` — is the thing
 * being eliminated wearing a different costume. Worse, it inverts what made the
 * exemplar safe: matched by trade, a salon brief got the salon page and copying
 * its CONTENT was correct. Matched by skeleton, a dentist gets shown a
 * restaurant, and the one thing a model reliably does with a worked example is
 * copy it.
 *
 * WHAT REPLACES IT is the layout directive `site-plan.mjs` composes — what
 * leads, what the body runs through, the failure this kind of site has, the page
 * set, the verb — written for THIS site rather than looked up for a trade.
 *
 * The four REFERENCE_PAGES above are NOT this and stay: they teach how to CALL
 * the API, are identical on every build, and ride in the cached block.
 */


/**
 * `attachCount` is what the user ATTACHED, and it defaults to none so every
 * existing caller produces a byte-identical prompt.
 *
 * THIS NOTE IS TWO CLAUSES, AND IT SHRANK TWICE TO GET THERE. The first draft
 * assigned a purpose per file type ("a logo is a palette, a PDF is content to
 * reproduce") — wrong, because the same PDF is the customer's own price list or
 * a competitor's brochure and only the brief distinguishes them. The second
 * explained at length how to work that out instead, which is teaching the model
 * something it already knows: an attachment in a conversation is an ordinary
 * thing, and the person attaching it says what it is for. Owner's call, and it
 * is the same de-prescribing lesson the rules learned generally.
 *
 * What is left is only what the model cannot get from the message itself: that
 * the files are part of the request rather than decoration, and which of the two
 * "references" in this prompt wins when they disagree. There is deliberately NO
 * instruction about seeding — `write_pages` takes route files and nothing else,
 * so an earlier "put it in the seed rows" line asked for something this step is
 * structurally incapable of doing. Seeds come from the designer.
 */
/**
 * The site as it stands, handed back to the generator so a revise is an EDIT.
 *
 * WITHOUT THIS A REVISE REWRITES EVERY PAGE FROM NOTHING. The model saw the
 * brief and the schema and never the pages, and the container wipes
 * `src/routes` before each build — so "change the phone number in the header"
 * regenerated all the copy on every page. It stayed on topic, because the
 * original brief anchors it, and the words were different every time.
 *
 * PUT LAST AND FRAMED AS THE THING TO EDIT, not as another reference: the trade
 * exemplar above is a shape to copy and this is the actual site, so read in the
 * other order the model treats its own site as one more example.
 *
 * Bounded, because a large site is a large prompt and this is fresh input on
 * every revise. Over the cap the pages are named but not shown, which degrades
 * to today's behaviour for the site that would have been most expensive.
 */
const MAX_PRIOR_CHARS = 90000;
export function priorPagesBlock(pages, mode = "revise", target = "") {
  const list = (Array.isArray(pages) ? pages : [])
    .filter((p) => p && typeof p.path === "string" && typeof p.source === "string" && p.source.trim());
  if (!list.length) return "";
  const total = list.reduce((n, p) => n + p.source.length, 0);

  // ONE PAGE, AND ONLY THAT PAGE'S SOURCE GOES IN THE PROMPT. This is the
  // cheapest generation there is: the prior-source block rides in the USER
  // message and is not cached, so showing one file instead of five is a real
  // saving on input as well as on output. The other pages are named so a link
  // can point at one, and shown to nobody.
  //
  // A target nobody can find degrades to the ordinary revise rather than
  // silently editing the wrong file — the caller checks this too, and two
  // places refusing is better than one place guessing.
  if (mode === "page") {
    const one = list.find((p) => p.path === target);
    if (one && one.source.length <= MAX_PRIOR_CHARS) {
      const others = list.filter((p) => p.path !== one.path).map((p) => p.path);
      return "\n\nTHE PAGE YOU ARE CHANGING\n" +
        "Below is the current source of " + one.path + ", exactly as it is published right now.\n\n" +
        "RETURN THIS ONE FILE AND NOTHING ELSE. Change only what the instruction asks for; everything else in it " +
        "stays BYTE-IDENTICAL — the same headings, the same sentences, the same sections in the same order, the " +
        "same components. Do not reword, retitle, tidy or improve anything you were not asked about. The customer " +
        "wrote this page; a change they did not ask for reads to them as their site being replaced.\n\n" +
        "Do not return any other page, and do not create one. If what they are asking for needs a page that does " +
        "not exist, return this file unchanged and it will be handled elsewhere.\n" +
        (others.length ? "The site's other pages, which you may link to and must not return: " + others.join(", ") + "\n" : "") +
        "\n--- " + one.path + " ---\n" + one.source;
    }
    // No such page, or one too large to show: fall through to the full revise
    // below, which is what the caller would have done anyway.
  }
  // ADDING SOMETHING IS NOT REWRITING EVERYTHING, and the difference is the
  // whole reason the addon lane exists. A revise re-emits every page — output is
  // ~87% of what a build costs, so "add a gallery" pays to re-type five pages
  // that did not change. Here the model returns the NEW page and the pages it
  // had to touch to make it reachable, and the caller merges that over the rest.
  //
  // The nav is why "and nothing else" is not quite the rule: each generated page
  // declares its own CHROME with its own links, so a page nobody links to is a
  // page nobody can reach. Usually that is the home page, and usually the answer
  // is two files instead of six.
  if (mode === "addon" && total <= MAX_PRIOR_CHARS) {
    return "\n\nTHE SITE AS IT STANDS — YOU ARE ADDING TO IT\n" +
      "Below is the CURRENT source of every page, exactly as it is published right now.\n\n" +
      "RETURN ONLY WHAT IS NEW OR CHANGED. A page you do not return is kept exactly as it is, so returning one " +
      "unchanged bills the customer for retyping their own site. Usually that is ONE new page, plus the page a " +
      "visitor would look on to find it — each page carries its own nav links, so a new page nobody links to is " +
      "a page nobody can reach.\n" +
      // MEASURED, NOT FEARED. First live run: "add a gallery page" came back
      // having rewritten all four of the site's existing pages, for 28 credits —
      // a whole build's price for an addition. The rule above was already there
      // and did not bind, so it is now stated as a NUMBER with the consequence
      // attached, and the merge reverts an unjustified rewrite regardless.
      "TWO FILES IS THE NORMAL ANSWER AND FOUR IS ALWAYS WRONG. Do not return a page just because you read it. If " +
      "a page does not gain or lose a link, and the change does not name it, leave it out — a rewrite of a page " +
      "nobody asked about will be thrown away and the customer will still have paid for the words.\n\n" +
      "IF THE THING THEY ASKED FOR BELONGS ON A PAGE THAT ALREADY EXISTS, return that page edited and add no new " +
      "file at all. A testimonials section on the home page is an edit to the home page, not a new route.\n\n" +
      // WITHOUT THIS SENTENCE THE DELETE VERB IS UNREACHABLE. The full-revise
      // block one branch below says "to delete a page, simply do not return it",
      // which is exactly true there and does NOTHING here — an unreturned page
      // is KEPT. So a model working from that habit answers "remove the gallery"
      // by returning nothing, the merge reports no change, and the request
      // escalates to the ~25-credit revise this lane exists to avoid.
      "ARE THEY ASKING FOR A PAGE TO GO AWAY? THEN `remove` IS THE ONLY THING THAT DOES IT. Put its file path in " +
      "`remove` — \"src/routes/gallery.tsx\". NOT returning it does NOTHING here: a page you do not return is " +
      "KEPT, which is the opposite of what it means on an ordinary rewrite, and answering a deletion by returning " +
      "the other pages leaves the page exactly where it was. Measured: that is what happens when this is missed. " +
      "Also return any page that LINKS to the one being removed, with the link taken out, or the site will not " +
      "compile and nothing will change at all.\n\n" +
      "Anything you DO return must be the whole file, and everything in it that this change does not touch stays " +
      "BYTE-IDENTICAL — the same headings, the same sentences, the same sections in the same order. The customer " +
      "wrote this site; a change they did not ask for reads to them as their site being replaced.\n\n" +
      list.map((p) => "--- " + p.path + " ---\n" + p.source).join("\n\n");
  }
  if (total > MAX_PRIOR_CHARS) {
    return "\n\nTHE SITE AS IT STANDS\nIt has these pages: " + list.map((p) => p.path).join(", ") +
      ". They are too large to show here, so write them again in full \u2014 keep the same pages, the same " +
      "sections and the same wording wherever the instruction does not ask for a change.";
  }
  return "\n\nTHE SITE AS IT STANDS \u2014 THIS IS WHAT YOU ARE EDITING\n" +
    "Below is the CURRENT source of every page, exactly as it is published right now.\n\n" +
    "Return every page again, but as an EDIT of this: change only what the instruction asks for, and leave " +
    "everything else BYTE-IDENTICAL \u2014 the same headings, the same sentences, the same sections in the same " +
    "order, the same components. Do not reword, retitle, tidy or improve anything you were not asked about. " +
    "The customer wrote this site; a change they did not ask for reads to them as their site being replaced.\n\n" +
    "To DELETE a page, simply do not return it. To ADD one, return it alongside the others.\n\n" +
    list.map((p) => "--- " + p.path + " ---\n" + p.source).join("\n\n");
}

export function pagesPrompt(brief, spec, brand, attachCount = 0, priorPages = null, mode = "revise", target = "") {
  const name = String(brand || "").trim();
  const n = Math.max(0, Math.floor(Number(attachCount) || 0));
  return "Build the pages for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (name ? "\n\nTHE SITE IS CALLED\n" + name + " \u2014 use it as the heading; it is already the page title." : "") +
    "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec) +
    // ONE CLAUSE NOW, and dropping the second one was forced rather than chosen.
    // It read "where they and the trade example below disagree, the attachment
    // wins" \u2014 arbitrating between two references, which was the whole reason
    // it earned its place in the first sweep that tested it. The trade exemplars
    // are gone, so that sentence pointed at a section of the prompt that no
    // longer exists: worse than no rule, because the model has to work out what
    // it refers to.
    //
    // Deliberately NOT re-pointed at the PLAN. The plan is a DECISION \u2014 which
    // pages, which components, how many pictures \u2014 and the image budget is
    // derived from it before the model is called, so "the attachment wins" there
    // invites ignoring a page list the build has already been costed against.
    // This note has shrunk twice; guidance creeps back one sentence at a time.
    (n
      ? "\n\nWHAT THE USER ATTACHED\n" + n + " file" + (n === 1 ? "" : "s") + ", above this text, part of what they are asking for."
      : "") +
    // LAST, so the model reads the brief and the schema first and the
    // site-to-edit second. Empty on a first build, so nothing about that path
    // changes.
    priorPagesBlock(priorPages, mode, target);
}

// A route path the container will accept: under src/routes, .tsx, no traversal,
// and not one of the files the template or the router owns. Checked on the name
// as written, BEFORE any extension is normalised — otherwise "routeTree.gen.ts"
// slips through as "routeTree.gen.tsx".
const RESERVED = /(^|\/)(__root|routeTree\.gen|readme)\b/i;
const SAFE_PATH = /^[a-z0-9_$][a-z0-9._$-]*(\/[a-z0-9._$-]+)*\.tsx$/i;

function cleanPath(raw) {
  let p = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  p = p.replace(/^(?:src\/)?routes\//, "");
  if (!p || p.includes("..") || RESERVED.test(p)) return null;
  if (!/\.[a-z]+$/i.test(p)) p += ".tsx";
  if (p.endsWith(".ts")) p = p.slice(0, -3) + ".tsx";
  return SAFE_PATH.test(p) ? p : null;
}

/**
 * Structural check on the tool's output: real paths, real source, an index.
 * Returns the files worth trying to compile plus everything wrong with them.
 */
export function validatePages(input, { partial = false, knownRoutes = null } = {}) {
  const problems = [];
  const pages = [];
  const seen = new Set();
  const raw = (input && Array.isArray(input.pages)) ? input.pages : [];
  if (raw.length > MAX_PAGES) problems.push("More than " + MAX_PAGES + " pages were written; only the first " + MAX_PAGES + " were kept.");
  for (const p of raw.slice(0, MAX_PAGES)) {
    const source = p && typeof p.source === "string" ? p.source : "";
    // AN EMPTY PAGE IS A PROBLEM, NOT A SILENT SKIP. Dropped quietly, a call that
    // named five routes and gave every one an empty `source` came out the far end
    // as zero pages and zero problems — indistinguishable from a tool call with
    // no `pages` list at all, and reported as "the generator called the tool with
    // no pages in it", which is false and sends whoever reads it the wrong way.
    // Measured 2026-08-10 on a real build that could not be diagnosed afterwards
    // because all four of those failures print the same sentence.
    if (!source.trim()) {
      problems.push('"' + String((p && p.path) || "?").slice(0, 60) + '" was written with no code in it.');
      continue;
    }
    const path = cleanPath(p.path);
    if (!path) { problems.push('"' + String(p && p.path).slice(0, 60) + '" is not a route file name — use something like index.tsx or menu.tsx.'); continue; }
    if (seen.has(path)) { problems.push(path + " was written twice; only the first was kept."); continue; }
    if (source.length > MAX_PAGE_CHARS) { problems.push(path + " is over " + MAX_PAGE_CHARS + " characters — split it or cut it down."); continue; }
    if (!/createFileRoute\s*\(/.test(source)) { problems.push(path + " does not export a Route — every page needs createFileRoute(...)."); continue; }
    seen.add(path);
    pages.push({ path, source });
  }
  // A PARTIAL SET HAS NO HOME PAGE AND SHOULD NOT, which is not the same as a
  // site having none. The addon lane returns only what it wrote — usually one
  // new page and the nav entry that reaches it — and the site's real index is
  // kept untouched by `mergeAddonPages`. Reporting it missing there would put a
  // false problem on every single addon.
  if (!partial && pages.length && !seen.has("index.tsx")) problems.push("There is no index.tsx, so the site has no home page.");

  // ── A LINK TO A PAGE THAT DOES NOT EXIST IS A DEAD BUILD ──────────────────
  //
  // TanStack generates a UNION of the routes that exist, so `<Link to="/account">`
  // where no account.tsx was kept is `TS2322`, the compile fails, and the whole
  // site publishes as the placeholder. Measured live 2026-08-04: the model wrote
  // SEVEN pages, the cap kept six, `/account` was the one dropped — and the two
  // pages linking to it took the build down with them. A cap that silently drops
  // a page while leaving links to it is a guaranteed failure, not a risk.
  //
  // Deliberately broader than the cap, because the cap is only one way to get
  // here: a model that writes three pages and links to a fourth it never wrote
  // fails identically, and that needs no truncation at all.
  //
  // Rewritten to "/" rather than refused. Home always exists (asserted above),
  // so the site builds and one link goes somewhere sensible instead of nowhere —
  // which beats losing every page over a single href. The rewrite is reported,
  // so it is visible rather than silent.
  // THE MAPPING IS `routeOf`, IMPORTED. This was a fifth private copy of it,
  // and the class of bug it produced has now been found here TWICE: first
  // `menu/index.tsx` derived as `/menu/index`, so every correct
  // `<Link to="/menu">` was rewritten to "/" as dangling and a false problem was
  // reported on a site that published; then `about.team.tsx` derived as
  // `/about.team`, where TanStack's flat-route convention routes it at
  // `/about/team`. `cleanPath`'s SAFE_PATH allows both forms, so both are
  // reachable output rather than hypotheticals — each reproduced by execution.
  //
  // The dot case got WORSE when the container and the published manifest were
  // corrected to the real mapping (2026-08-14): before that every reader agreed
  // on the wrong answer, and afterwards a `<Link to="/about/team">` that
  // `tsr generate` really accepts was the one this rewrote away. Two readings of
  // one mapping is the repo's "path-shape mismatch" family, and the answer is
  // never a second correct copy.
  const live = new Set(pages.map((p) => routeOf(p.path)).filter(Boolean));
  // THE SITE'S OTHER PAGES, on a partial set. The rewrite judges a link against
  // `live`, and on the edit and addon lanes `pages` is only what the model
  // RETURNED — so every unchanged page of the site read as nonexistent.
  // Reproduced by the 2026-08-13 audit with this real module: a one-page edit
  // returning manage.tsx with its correct `<Link to="/book">` published with
  // that link pointed at "/", and problems[] told the customer their live
  // booking page did not exist. The caller passes what it knows is live;
  // PAGE_RULES teaches `<Link to="/menu">` in page bodies, so returned pages
  // routinely carry exactly these links.
  for (const r of (Array.isArray(knownRoutes) ? knownRoutes : [])) {
    if (typeof r === "string" && r.startsWith("/")) live.add(r);
  }
  // A PARTIAL SET WITH NO `knownRoutes` CANNOT JUDGE A LINK AT ALL, so it does
  // not try: rewriting on a guess is what broke working pages, and a genuinely
  // dangling link still cannot ship — the lanes compile changed pages TOGETHER
  // with the stored site, and TanStack's generated route union makes a link to
  // a route that exists nowhere a TS2322 the typecheck refuses.
  const canJudge = !partial || Array.isArray(knownRoutes);
  const dangling = new Set();
  if (canJudge) {
    for (const p of pages) {
      p.source = p.source.replace(/(\bto\s*[=:]\s*)(["'])(\/[A-Za-z0-9/_-]*)\2/g, (m, lead, quote, target) => {
        if (live.has(target)) return m;
        dangling.add(target);
        return lead + quote + "/" + quote;
      });
    }
  }
  if (dangling.size) {
    problems.push("These pages were linked to and do not exist, so the links were pointed at the home page instead: " +
      [...dangling].slice(0, 6).join(", ") + ".");
  }

  // ── AND THE SAME LINK WRITTEN AS A PLAIN ANCHOR ────────────────────────────
  //
  // The rewrite above covers `to=`/`to:` only — the TYPED forms, where a route
  // that does not exist is a `TS2322` and the build dies. A plain
  // `<a href="/quote">` compiles, bundles and publishes, and lands the visitor
  // on the router's not-found page when they click it. Nobody gets a signal:
  // not the owner, not the platform.
  //
  // It is not a rare idiom. **500 route hrefs across the 324 family exemplars**,
  // which are what the model copies — measured, along with the fact that
  // **zero of those 500 are dangling**, so the house style never produces one
  // and a check here has no false alarms on the corpus the generator learns
  // from. That measurement is the whole reason this can exist.
  //
  // REPORTED, NEVER REWRITTEN, and the asymmetry with `to=` above is deliberate.
  // That rewrite exists because the alternative is losing the whole site to a
  // failed compile; there is no build to save here, the page publishes either
  // way. And an `href` may legitimately hold a non-route path — `/u/` uploads,
  // `/api/` calls, `/sitemap.xml` — where a wrong exemption in a REWRITE breaks
  // a working link, while a wrong exemption in a REPORT costs one noisy
  // sentence. The corpus offers no evidence about those cases at all (0 of 500
  // use them), which is exactly where a false alarm would come from.
  // A PARAMETERISED ROUTE IS MATCHED AS A PATTERN, NOT COMPARED AS A STRING.
  //
  // `live` holds what `routeOf` derives, and for `deals.$id.tsx` that is the
  // route ID `/deals/$id` — the literal the router registers. The `to=` rewrite
  // above is right to compare it literally: TanStack types `to` against the route
  // union, so a typed link says `to="/deals/$id"` with a `params` prop and a
  // concrete `to="/deals/123"` is a TS2322 the rewrite exists to save the build
  // from. A plain `<a href="/deals/123">` is the opposite case — the router
  // resolves it perfectly — and it matched no entry in `live`, so it was reported
  // to the CUSTOMER as a link landing on "not found". Driven against this module:
  // pages `index.tsx` (with that anchor) and `deals.$id.tsx` came back with
  // `These links go to pages that do not exist … /deals/123.`
  //
  // A false alarm on correct code, which this file rates strictly worse than the
  // miss — and this widening can only ever REMOVE a report, never add one, so its
  // false-alarm rate cannot go up. What it gives up: `/deals/999` where no row 999
  // exists is no longer reported, which is right — the router does resolve it, and
  // whether the ROW exists is a runtime question no lint can answer.
  //
  // `$name` takes exactly one segment; a bare `$` is TanStack's splat and takes
  // the rest. Both are compiled from the route ID rather than pattern-matched as
  // text, so a literal segment still has to be equal.
  const dynamic = [...live].filter((r) => r.includes("$")).map((r) => r.split("/"));
  const resolvedByRoute = (target) => {
    const got = target.split("/");
    return dynamic.some((pat) => {
      for (let i = 0; i < pat.length; i++) {
        if (pat[i] === "$") return got.length > i;            // splat: one or more left
        if (i >= got.length) return false;
        if (pat[i].startsWith("$")) { if (!got[i]) return false; continue; }
        if (pat[i] !== got[i]) return false;
      }
      return got.length === pat.length;
    });
  };
  const deadHrefs = new Set();
  if (canJudge) {
    for (const p of pages) {
      for (const m of p.source.matchAll(/\bhref\s*=\s*(["'])(\/[^"'\s]*)\1/g)) {
        // The fragment and the query are not part of the route; a bare `#top`
        // never reaches here because the path must start with `/`.
        const target = m[2].split("#")[0].split("?")[0].replace(/\/(?=$)/, "") || "/";
        if (/^\/(u|api|s)\//.test(target)) continue;      // uploads, the data API, the internal mount
        if (/\.[a-z0-9]{1,8}$/i.test(target)) continue;   // sitemap.xml, robots.txt, a download
        if (live.has(target)) continue;
        if (resolvedByRoute(target)) continue;
        deadHrefs.add(target);
      }
    }
  }
  if (deadHrefs.size) {
    problems.push("These links go to pages that do not exist, so a visitor clicking them lands on \"not found\": " +
      [...deadHrefs].slice(0, 6).join(", ") + ".");
  }

  const notes = (input && typeof input.notes === "string") ? input.notes.trim().slice(0, 600) : "";
  return { pages, notes, problems };
}

// Reads the generated source for the mistakes that compile cleanly and then fail
// at runtime — a page that 403s against its own API looks perfect until it is
// loaded. Deliberately high-precision: every rule here is checked against the
// schema, so a hit is always a real defect, never a style opinion.
/**
 * The colours a page must not name, as three patterns.
 *
 * Kept up here and EXPORTED so the tests drive the real ones rather than
 * retyping them — a second copy of a pattern is two things that can disagree
 * about what counts as a colour.
 */
export const TAILWIND_PALETTE =
  "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
export const COLOUR_UTILITIES =
  "bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|accent|caret|divide|placeholder|shadow";
export const TAILWIND_COLOUR =
  new RegExp("\\b(?:" + COLOUR_UTILITIES + ")-(?:" + TAILWIND_PALETTE + ")-[0-9]{2,3}\\b", "g");
/** The bracket's CONTENTS decide — `text-[0.7rem]` is a size and is in the corpus. */
export const ARBITRARY_COLOUR =
  new RegExp("\\b(?:" + COLOUR_UTILITIES + ")-\\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch|lab|lch|color)\\([^\\]]*\\))\\]", "g");
/** Six or eight digits only: `#add` is a real in-page anchor in the corpus. */
export const HEX_COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g;

export function lintPages(pages, spec) {
  const problems = [];
  const tables = new Map();
  // Declared function names, for the RPC check below.
  // Callable functions only — an `internal` one is revoked from the Data API
  // roles, so a page calling it 403s. Kept apart from `internalFns` below so
  // the two failures can be told apart in the message.
  const allFns = (spec && Array.isArray(spec.functions) ? spec.functions : []).filter((f) => f && f.name);
  const fns = new Set(allFns.filter((f) => !f.internal).map((f) => String(f.name).toLowerCase()));
  const internalFns = new Set(allFns.filter((f) => f.internal).map((f) => String(f.name).toLowerCase()));
  const declaredApis = new Set((spec && Array.isArray(spec.apis) ? spec.apis : [])
    .map((a) => String((a && a.name) || "").toLowerCase()).filter(Boolean));
  // A RETIRED TABLE IS NOT IN `tables`, AND THAT IS THE SAME FILTER `schemaDigest`
  // APPLIES 670 LINES ABOVE.
  //
  // What was broken: this map took EVERY declared table, retired or not, so a
  // page submitting to a closed one resolved `t`, passed `canWriteAccess(t)`
  // (the stored spec keeps the write side it was built with), and the write
  // branch reported NOTHING. Measured against the real modules — spec
  // `[{name:"enquiries", access:"collect", retired:true, columns:[{name:"name"}]}]`
  // with a page calling `useCreateRow("enquiries")`: `grantsFor` emits ONLY
  // `REVOKE ALL … FROM anonymous` and `… FROM authenticated`, `publicViewSql`
  // DROPs the projection, `schemaDigest` says "(the schema declares no tables)",
  // and `lintPages` returned `[]`. That is the exact class this lint's own header
  // says it exists for — "the class of page that typechecks, bundles and then
  // 403s" — arriving through the one table state the digest already hides.
  //
  // HOW IT IS REACHED, since a fresh generation cannot name a table it was never
  // offered: retire a table (the `rules` lane's only removal verb), then make any
  // later page-generating change. The revise contract hands the model its own
  // prior pages and tells it to return them byte-identical except where the
  // change was asked for — so the existing form comes back unchanged, is linted
  // silently, and republishes. The owner believes the form works; the enquiries
  // stop arriving.
  //
  // FILTERED RATHER THAN GATED PER LOOP. Six loops resolve a table name and each
  // would have needed its own `if (t.retired)` — six places to forget, which is
  // precisely the shape of this bug (the digest got it right and this did not).
  // Dropping it from the map makes every `else if` branch below unreachable for a
  // retired table by construction, so there is no double-reporting and no
  // misleading access sentence; the ONE thing that has to be right is the
  // sentence for a name that is not in the map, and that lives in `noTable`.
  const closedTables = new Map();
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (!t || !t.name) continue;
    const key = String(t.name).toLowerCase();
    if (t.retired) closedTables.set(key, t); else tables.set(key, t);
  }
  /**
   * Why a table name a Data-API hook reached for cannot be used.
   *
   * ONE reading, because six loops ask it. "does not declare" and "has been
   * closed" send whoever reads the reply in opposite directions — the first says
   * look for a typo, the second says the feature was removed and the UI has to
   * go with it — and only one of them is ever true.
   */
  const noTable = (name) => closedTables.has(String(name).toLowerCase())
    ? 'which the schema has CLOSED (retired) — its grants are revoked and its public view dropped, ' +
      "so every read and write on it returns 403. Take this out of the page."
    : "which the schema does not declare.";
  const ui = new Set(UI_COMPONENTS);
  const say = (path, msg) => problems.push(path + ": " + msg);
  const memberTables = [...tables.values()].filter((t) => needsMember(t));

  for (const { path, source } of pages) {
    // Strip COMMENTS before pattern-matching, so a rule quoted in a doc comment is
    // not reported as the code doing it. String literals are deliberately NOT
    // stripped — this comment claimed they were, which is the kind of note that
    // outlives the code it describes. Hand-lexing template literals to blank them
    // gets nested backticks wrong and an over-blanking scanner HIDES real code,
    // which is the direction that costs a bug rather than a false alarm. The
    // price of leaving them: page copy containing the literal text "fetch (" is
    // reported as fetch code. A lint problem does not block publishing, so a rare
    // false alarm is the cheaper side of that trade.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    if (/\b(?:fetch|XMLHttpRequest)\s*\(/.test(code) || /\baxios\b/.test(code)) {
      say(path, "calls fetch directly. Read with useRows and write with useCreateRow from @/lib/rows — no fetch code in a page.");
    }
    // RULE 19, ENFORCED RATHER THAN ONLY STATED. A non-home route with no `head`
    // inherits the site's own title and description, so every page of the site
    // shares one link preview and one search result — measured live 2026-08-20,
    // where `/book` and the home page came back with byte-identical titles AND
    // og:descriptions on a site that published perfectly.
    //
    // A LINT AND NOT A SIXTH PARAGRAPH. Rule 19 is emphatic, carries a worked
    // example, and three of the four reference pages in the same prompt
    // demonstrate it — and the model skipped it anyway. This file already
    // records what happens when a prompt is reworded against a symptom five
    // times; the answer there was to check the mechanism instead.
    //
    // ANCHORED AFTER `createFileRoute(` AND DELIBERATELY LOOSE. Route options
    // follow that call, so a `head:` anywhere after it counts — which means a
    // page whose COMPONENT happens to contain the word (a column config, say)
    // passes when it should not. That is the safe direction on purpose: this
    // repo rates a false alarm worse than a miss, and the miss here costs one
    // page's share card while a false alarm teaches the model away from a rule
    // it is following correctly.
    const decl = code.indexOf("createFileRoute(");
    if (decl >= 0 && routeOf(path) !== "/" && !/\bhead\s*:/.test(code.slice(decl))) {
      say(path, "has no `head` on its route, so it inherits the site's own title and description — " +
        "pasted into WhatsApp it previews as the home page, same headline and same sentence. " +
        "Add `head: () => ({ meta: [...] })` beside `component`, with a title and a description about THIS page. " +
        "The home page is the one that leaves this out.");
    }
    // A PAGE MAY NOT NAME A COLOUR, and the reason is a feature rather than a
    // preference. The site's colours come from its theme and from the per-site
    // token patch, both of which the CONTAINER applies at build time — so a page
    // that writes `bg-amber-400` is unreachable by either. "Make the background
    // yellow" then moves the token, reports success, and the page does not
    // change: the edit lane's `look` layer silently doing nothing, which is the
    // exact failure it was built to end.
    //
    // Three shapes, and the corpus decides how tight each can be. Measured over
    // all 329 pages the model learns from — the 4 reference pages and 324 family
    // exemplars — there are ZERO literal colours of any kind, so none of these
    // can false-alarm on a page written the way we teach.
    for (const m of code.matchAll(TAILWIND_COLOUR)) {
      say(path, "writes the literal colour class \"" + m[0] + "\". Use the theme tokens — bg-background, text-foreground, " +
        "bg-primary, bg-muted and so on — or the site's own colours can never change it.");
      break;
    }
    // An arbitrary value that is a COLOUR. `text-[0.7rem]` and `text-[11px]` are
    // real and appear in the corpus, so the bracket's CONTENTS have to be the
    // test rather than the bracket itself.
    let arb = false;
    for (const m of code.matchAll(ARBITRARY_COLOUR)) {
      say(path, "writes the fixed colour \"" + m[0] + "\". Use the theme tokens instead — a colour written into the page " +
        "cannot be changed afterwards.");
      arb = true;
      break;
    }
    // THE HEX SCAN RUNS ON CODE WITH THE ARBITRARY VALUES BLANKED, because
    // `bg-[#ff0000]` matches both rules and one mistake reported twice reads as
    // two mistakes. Blanked rather than removed, so offsets stay valid — the
    // idiom this file already follows for comments.
    const noArb = arb ? code.replace(ARBITRARY_COLOUR, (m) => " ".repeat(m.length)) : code;
    // A raw hex colour. SIX OR EIGHT DIGITS ONLY: the three-digit form collides
    // with in-page anchors, and the corpus really does contain `href="#add"` —
    // flagging that would teach the model away from an anchor that is perfectly
    // correct, which costs more than the miss.
    for (const m of noArb.matchAll(HEX_COLOUR)) {
      say(path, "writes the raw colour \"" + m[0] + "\". Use the theme tokens — a hex colour in a page ignores the site's " +
        "theme and cannot be changed later.");
      break;
    }
    // COMMONJS IN AN ESM BUNDLE. Measured live 2026-08-08: a generated page
    // reached for `require()` out of training-data habit, and it passed every
    // check the pipeline has — the lint said nothing, `tsc` accepted it (Node's
    // types declare `require`), vite bundled it, and the site published. Then the
    // browser threw `ReferenceError: require is not defined` and the whole
    // component tree under it went to the error boundary, live, on a customer's
    // site. `build smoke` went red on "no console errors" and that was the only
    // thing in the repo that noticed.
    //
    // Exactly the class the `fetch` rule above exists for — compiles, bundles,
    // fails in front of a visitor — so it belongs next to it. With the repair
    // pass gone (2026-08-04) nothing downstream absorbs it.
    if (/\brequire\s*\(/.test(code) || /\bmodule\.exports\b/.test(code) || /\bexports\.[A-Za-z_$]/.test(code)) {
      say(path, "uses CommonJS (require/module.exports). These pages are ES modules bundled by vite: " +
        "`require` is not defined in the browser, so the page compiles, publishes, and then throws at " +
        "runtime — the whole section renders as an error. Use a top-level `import` instead.");
    }
    // THE @tanstack/react-form RULE WENT WITH THE PACKAGE (2026-08-17).
    //
    // It existed because the package was INSTALLED: an import of it typechecked
    // clean — measured, `tsc --noEmit` exit 0 — so a page mixing it with
    // shadcn's `Form` compiled, lint-warned, and PUBLISHED, since `problems` is
    // reported and nothing branches on it. What shipped was a form that
    // silently did not validate.
    //
    // Uninstalled, the same import is a module that does not resolve, which
    // `tsc` refuses like any other — for free, with no rule and no tokens. The
    // `@/examples/*` rule was retired on exactly this reasoning when its folder
    // was deleted; `test/page-gen.test.mjs` asserts the PREMISE (the package is
    // absent) rather than the rule, because reinstalling it without restoring
    // this check brings the silent failure straight back.
    // A ROUTE ADDRESSED AS A FRAGMENT — the same class again, and this one was
    // live for a day on every site built after the router moved.
    //
    // `#/book` was CORRECT while the app ran on `createHashHistory()`: the
    // fragment was where the route lived, and a hash anchor was real client-side
    // navigation. On 2026-08-09 the router moved to browser history so pages
    // could have real addresses, and every one of those links silently became a
    // no-op — it sets `location.hash`, matches no route, and renders nothing.
    // The customer clicks "Book" in the header and stays where they are.
    //
    // Nothing else can see it. `tsc` is happy (it is a string), vite bundles it,
    // the lint's other rules do not care, and the site publishes. It is visible
    // only by clicking, which is why it needs a rule rather than a fixed
    // template — the chrome and all 318 exemplars were corrected, and the model
    // still has the old shape in its training data.
    //
    // `#section` IS LEFT ALONE, deliberately: a fragment naming an id on the
    // same page is an ordinary in-page anchor and still works. Only `#/` — a
    // fragment that was standing in for a path — is ever wrong.
    if (/["'`]#\//.test(code)) {
      say(path, "addresses a page as `#/...`. The app uses browser history, so a `#/` link sets the " +
        "fragment and navigates nowhere — the page looks fine and the link does nothing. Use the " +
        "ordinary path (`/book`), or `<Link to=\"/book\">` inside the page body. An in-page anchor " +
        "like `#prices` is fine and is not this.");
    }
    // The same navigation written imperatively. `location.hash = "#/book"` is
    // one assignment away from the rule above and fails identically, so a rule
    // that only reads hrefs teaches the model to reach for this instead.
    if (/location\s*\.\s*hash\s*=/.test(code)) {
      say(path, "navigates by assigning location.hash. That moved the router under hash history and " +
        "does nothing now. Use `const navigate = useNavigate()` from @tanstack/react-router and " +
        "`navigate({ to: \"/book\" })`.");
    }
    // EDITING IS CHECKED PER TABLE, like every other hook here. It used to be a
    // BOOLEAN over the whole file — `/useUpdateRow|useDeleteRow/.test(code)` —
    // which never captured WHICH table was being edited. So `useUpdateRow` on a
    // `display` menu, a `collect` booking or an `admin` table passed the lint,
    // compiled, published and answered 403, as long as the page called
    // useMember() and the schema declared any member table at all. Every
    // neighbouring rule was per-table; these two alone were not.
    const editsRows = /\buseUpdateRow\b|\buseDeleteRow\b/.test(code);
    const editTargets = [...code.matchAll(/\buse(?:Update|Delete)Row\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)];
    for (const m of editTargets) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) { say(path, 'edits table "' + m[1] + '", ' + noTable(m[1])); continue; }
      if (!canMemberWrite(t)) {
        say(path, 'edits "' + m[1] + '", which is access "' + accessLabel(t) + '" — PATCH and DELETE on it return 403. Only `user` and `feed` rows have an owner who may change them.');
      } else if (!/\buseMember\b/.test(code)) {
        say(path, 'edits "' + m[1] + '" without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.');
      }
    }
    // PAYING IS CHECKED PER TABLE, for the same reason editing is.
    //
    // This is the class of failure this lint exists for: it typechecks, it
    // bundles, and it 403s at a real customer. A payable table has NO public
    // INSERT — that missing grant is the whole reason a price cannot be forged
    // — so useCreateRow on one is refused by Postgres at the moment somebody
    // tries to buy something.
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && normalizePayment(t)) {
        say(path, 'submits "' + m[1] + '" with useCreateRow, but that table is PAID — it has no public insert and the write returns 403. Use useCheckout("' + m[1] + '") instead, sending { id, qty } for each item.');
      }
    }
    // And the other way round: checkout on a table that takes no payment. The
    // route answers 404 for it, so the button would simply never work.
    //
    // CHECKOUT RESOLVES A RETIRED TABLE TOO, and that is measured rather than
    // tidy. Every other hook here goes to `/api/db/<slug>/data/…`, the Neon Data
    // API, whose grants `retired` revokes — so those really do 403. `useCheckout`
    // posts to `/api/db/<slug>/checkout`, and `handleCheckout` prices the cart and
    // INSERTs the order with `sqlQuery(conn, …)` on the site's own owner
    // connection, which bypasses grants entirely. So checkout on a retired table
    // still works, and reporting it as closed would be a false alarm on correct
    // code — which this file rates strictly worse than the miss.
    for (const m of code.matchAll(/\buseCheckout\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase()) || closedTables.get(m[1].toLowerCase());
      if (!t) { say(path, 'takes payment for table "' + m[1] + '", which the schema does not declare.'); continue; }
      if (!normalizePayment(t)) {
        say(path, 'calls useCheckout("' + m[1] + '"), but that table declares no payment — checkout answers 404 for it. Submit it with useCreateRow.');
      }
    }
    // The table name is not always a literal. Keep the blunt checks for the calls
    // the loop above could not resolve, or a computed table name would skip the
    // rule entirely — but do not repeat what it already said.
    if (editsRows && !editTargets.length) {
      if (!/\buseMember\b/.test(code)) {
        say(path, "calls useUpdateRow/useDeleteRow without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.");
      }
      if (!memberTables.length) {
        say(path, "calls useUpdateRow/useDeleteRow, but this schema has no member table. `collect` and `display` rows have no owner and can never be edited from a page.");
      }
    }

    // A ROW ID IS A NUMBER AND A ROUTE PARAM IS A STRING, and the two failures
    // this catches are not the same size. Handing `row.id` to a link is a type
    // error and nothing worse. COMPARING them is a lookup that finds nothing —
    // `4 === "4"` is false — so if it ever stopped being a type error it would
    // become a manage page that says "not found" for every real row. Measured
    // live 2026-08-05: both, in one CRM sample, two of its four errors.
    //
    // Scoped to identifiers this file actually binds from a param hook, rather
    // than to every `.id ===` — `d.id === selectedId` against a numeric state is
    // correct code, and a rule that flagged it would be one the model learns to
    // ignore.
    const params = new Set();
    for (const m of code.matchAll(/(?:const|let)\s*(\{[^}]*\}|\w+)\s*=\s*[\w.]*use(?:Params|Search)\s*\(/g)) {
      const bind = m[1].trim();
      if (bind.startsWith("{")) {
        for (const part of bind.slice(1, -1).split(",")) {
          // `{ service: preselected }` binds the RIGHT name; `{ id = "" }` the left.
          const name = part.includes(":") ? part.split(":").pop() : part;
          const clean = name.split("=")[0].trim();
          if (/^\w+$/.test(clean)) params.add(clean);
        }
      } else if (/^\w+$/.test(bind)) params.add(bind + ".");
    }
    const isParam = (expr) => params.has(expr) || [...params].some((p) => p.endsWith(".") && expr.startsWith(p));
    if (params.size) {
      for (const m of code.matchAll(/([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*(===|!==)\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)/g)) {
        const [, left, , right] = m;
        const rowId = (e) => /\.id$/.test(e) && !isParam(e);
        if ((rowId(left) && isParam(right)) || (rowId(right) && isParam(left))) {
          say(path, "compares " + left + " " + m[2] + " " + right + ", and a route param is a string while a row id is a number — they can never be equal. Write String(" + (rowId(left) ? left : right) + ") on the id side.");
        }
      }
    }
    // The other direction: an id going INTO a route. `String(...)` calls are
    // blanked first rather than matched around, so whitespace inside the call
    // cannot evade the check.
    for (const m of code.matchAll(/\b(?:params|search)\s*[:=]\s*\{\{?([^{}]*)\}\}?/g)) {
      const body = m[1].replace(/String\s*\([^()]*\)/g, '""');
      const bare = body.match(/\b[A-Za-z_$][\w$]*\.id\b/);
      if (bare) say(path, "puts " + bare[0] + " into a route without String(). Params and search params are typed string; wrap it as String(" + bare[0] + ").");
    }

    for (const m of code.matchAll(/from\s+"@\/components\/ui\/([a-z0-9-]+)"/gi)) {
      if (!ui.has(m[1].toLowerCase())) say(path, 'imports "@/components/ui/' + m[1] + '", which does not exist. Available: ' + UI_COMPONENTS.join(", ") + ".");
    }

    // THE NAME, not just the module. `import { FaqAccordion } from ".../faq"`
    // names a real file and a member that was never there — the module check
    // above passes it, `tsc` refuses it, and the site publishes as the
    // placeholder. Measured live, and one of the three commonest failures.
    //
    // A module we have no export list for is SKIPPED rather than guessed at: a
    // false alarm here would teach the model away from a component that is
    // perfectly real, which is worse than the miss.
    for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'`]@\/components\/ui\/([a-z0-9-]+)["'`]/g)) {
      const known = UI_EXPORTS[m[2].toLowerCase()];
      if (!known) continue;
      for (const raw of m[1].split(",")) {
        // A TYPE IS JUDGED LIKE ANYTHING ELSE, and the fix was to the LIST rather
        // than to this loop.
        //
        // Skipping type specifiers was tried first and is strictly worse: with an
        // honest export list, `import { DateEnquiry, type Invented }` is a real
        // `TS2305` that skipping lets through — and measured, the skip changed no
        // answer at all, because dropping the `type ` strip made the name fail the
        // capital-initial test one line down. Inert protection reading as real.
        //
        // What was actually broken is that `UI_EXPORTS` did not know the kit's
        // string unions: `COMPONENT_TYPES` keeps only types with an object body,
        // so 30 modules whose one exported type is a union looked as though they
        // exported nothing of the sort. MEASURED over the 324 family exemplars —
        // the corpus the model learns the kit from — that was the WHOLE of the
        // full lint's output: 4 correct pages told off, e.g.
        // `import { RepairStatus, type RepairStage }` against a file whose line 33
        // is `export type RepairStage`. `COMPONENT_TYPE_NAMES` closed it, and a
        // derived test now holds the list at zero gaps.
        //
        // `type X` and `X as Y` both name the thing that has to exist.
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name || !/^[A-Za-z_$]/.test(name)) continue;
        // ONLY A CAPITAL-INITIAL NAME, because that is the only class this list
        // actually covers — and believing otherwise made the check refuse real
        // code (2026-08-14).
        //
        // `UI_EXPORTS` is derived from `COMPONENT_API`, whose extractor matches
        // `export function Name({ … })` — a destructured props object, i.e. a
        // COMPONENT — and then harvests names with `/[A-Z][A-Za-z0-9]*\(/`. So a
        // lowercase helper exported beside a component is invisible to it twice
        // over. Measured across the kit: **108 modules export 130+ of them** —
        // `useUndoRedo`, `formatBytes`, `luhn`, `parseCsv`, `localBusinessJsonLd`
        // — and an import of ANY of them was reported as a member the module
        // does not have. Every one of those false alarms teaches the model away
        // from a helper that is perfectly real, which is the failure this
        // check's own comment says is worse than the miss.
        //
        // The FaqAccordion protection is untouched: an invented component name
        // is capital-initial by React's own rule, so it still gets caught. What
        // is given up is a mistyped lowercase helper, which `tsc` refuses
        // anyway — the same trade the skip-an-unknown-module rule above makes.
        if (!/^[A-Z]/.test(name)) continue;
        if (!known.has(name)) {
          say(path, 'imports { ' + name + ' } from "@/components/ui/' + m[2] + '", which does not export it. ' +
            "That module exports: " + [...known].join(", ") + ".");
        }
      }
    }

    // A PROP THE COMPONENT DOES NOT TAKE — the failure the eval actually records.
    //
    // Every recorded compile failure was on a component whose signature WAS in
    // the prompt: `render` on a `Column`, `onClick` on a bulk action, `title` on
    // an `Activity`, `fallbackSeed` on a `Shot`. The model can see the component
    // and invents a prop anyway, `tsc` refuses the file, and since the salvage
    // landed that costs the page rather than the site. Caught here it costs
    // nothing — the site publishes and the problem is reported.
    //
    // SKIPPED for any component with no documented signature, the same rule as
    // the import check above: a false alarm teaches the model away from a
    // component that is perfectly real, which is worse than the miss.
    //
    // SKIPPED for an element carrying a spread, because `{...props}` can supply
    // anything and there is no way to know what.
    // THE ELEMENT'S ATTRIBUTES, SCANNED RATHER THAN MATCHED. Written
    // `<([A-Z]\w*)\s([^>]*?)>` this stopped at the first `>` — which inside
    // `cell: (r) => r.x` is the arrow, so every element with a function-typed
    // prop was truncated and skipped. The `=>` trap for the third time in one
    // change, and the reason `splitTop` carries the same guard.
    for (const im of jsxElements(code)) {
      const mod = uiModuleFor(im[1]);
      if (!mod) continue;
      const allowed = propsOf(mod, im[1]);
      if (!allowed) continue;
      const attrs = im[2];
      if (attrs.includes("{...")) continue;
      const ok = new Set([...allowed, ...FREE_PROPS]);
      for (const [prop] of ownAttrs(attrs)) {
        // `aria-*`/`data-*` are DOM passthrough and never in a signature.
        if (/^(aria|data)-/.test(prop) || ok.has(prop)) continue;
        say(path, "<" + im[1] + "> is given `" + prop + "`, which it does not take. " +
          "It takes: " + allowed.join(", ") + ".");
      }
      // AND THE KEYS INSIDE A PROP'S OBJECTS, which is the shape that actually
      // fails. Measured on the real pages: the invented name is almost never a
      // JSX attribute, it is a key in the array handed to one — `fallbackSeed`
      // in a `Shot`, `render` in a `Column`, `title` in an `Activity`.
      for (const [name, at] of ownAttrs(attrs)) {
        const fields = shapeOf(mod, name, im[1]);
        // `attrs[at] !== "{"` IS BELT-AND-BRACES, AND SAYING SO IS THE POINT.
        // A mutation removing it survived the whole suite, and unlike the other
        // survivors this one really is inert: with a string value the scan below
        // runs on to the NEXT prop's brace, and it stops at the first `}` that
        // returns the depth to zero — which is that same brace's own close. So
        // the slice always carries one unmatched `{` and `topObjects` yields
        // nothing from it. Kept because that is an EMERGENT property of the
        // scan, not a local one: it holds by accident of where the loop breaks,
        // and a later edit to that loop would turn a string-valued prop into a
        // reader of the next prop's object. This makes the precondition local.
        if (!fields || attrs[at] !== "{") continue;
        // The value as written, from the `{` to its match — bounded to the
        // attribute so a later prop's braces cannot be read as this one's.
        const from = at;
        let d = 0, end = -1;
        for (let i = from; i < attrs.length; i++) {
          if (attrs[i] === "{") d++;
          else if (attrs[i] === "}") { d--; if (!d) { end = i; break; } }
        }
        if (end < 0) continue;
        const value = attrs.slice(from + 1, end);
        // Inline literals only. A variable, a `.map()` or a spread can hold
        // anything, and guessing is how a lint invents a complaint.
        if (value.includes("...")) continue;
        // THE OUTERMOST OBJECTS, not the innermost. `/\{([^{}]*)\}/` matches the
        // deepest braces, so `{ name: "x", capacities: { Standing: 120 } }` was
        // read as an item with one key called `Standing` — a page that was
        // perfectly correct, reported as wrong.
        for (const body of topObjects(value)) {
          for (const kv of splitTop(body, ",")) {
            const km = kv.trim().match(/^([a-zA-Z_$][\w$]*)\s*:/);
            if (!km || fields.includes(km[1])) continue;
            say(path, "<" + im[1] + "> `" + name + "` is given `" + km[1] +
              "`, which is not part of that shape. It takes: " + fields.join(", ") + ".");
          }
        }
      }
    }

    // MOTION THAT INVENTS ITS OWN TIMING. Deliberately narrow: a raw duration or
    // easing is always a real defect now, because the kit was tokenised and there
    // is exactly one scale. It is also the failure that never announces itself —
    // a page where the banner, the panel and the toast each picked a different
    // number looks correct in every screenshot and simply feels unconsidered.
    for (const m of code.matchAll(/\bduration-(\d+)\b/g)) {
      say(path, "uses duration-" + m[1] + ". The kit has one timing scale — use " +
        "duration-(--dur-1) 90ms, (--dur-2) 180ms, (--dur-3) 320ms or (--dur-4) 500ms.");
    }
    for (const m of code.matchAll(/(?<=["'\s])ease-(?:linear|in-out|in|out)(?=[\s"'`])/g)) {
      say(path, "uses " + m[0] + ". Use ease-emphasis for anything arriving, ease-standard " +
        "for a state change.");
    }
    // An animation runtime. None is installed, so this would fail the build
    // anyway — but a named refusal explains WHY rather than leaving the model to
    // read a module-not-found and try a different package.
    for (const m of code.matchAll(/from\s+["'](framer-motion|motion|motion\/react|gsap|@react-spring\/[a-z]+|animejs)["']/g)) {
      say(path, 'imports "' + m[1] + '". There is no animation library and none is needed — ' +
        "every effect the kit needs is a CSS class. See the motion list in the rules.");
    }

    // THE CHART DEMOS, refused by name. This is the rule the deleted `@/examples/*`
    // one used to be, and it is justified here on exactly the reasoning that
    // retired it there: that rule went when the folder went, because a missing
    // module is caught by tsc like any other. These 1,140 files are NOT missing.
    // Each is `export default function Component()` wrapping a primitive in a
    // Card around invented figures, so an import of one COMPILES, bundles, and
    // publishes "Bookings 268 / 300 · January - June 2024" to a real business's
    // customers. Nothing else in the pipeline can tell that from a real chart.
    // The path class allows `/`, so this catches a nested path as well as a flat
    // one — and THAT is what makes the `(?!lib\/)` real. Written as `[a-z0-9-]+`
    // the lookahead was decoration: the class cannot cross a slash, so
    // `charts/lib/bullet` never matched it in the first place and removing the
    // lookahead changed nothing. Proved by mutation, which is the only way that
    // kind of no-op guard ever gets found.
    for (const m of code.matchAll(/from\s+"@\/components\/charts\/(?!lib\/)([a-z0-9/-]+)"/gi)) {
      say(path, 'imports "@/components/charts/' + m[1] + '", which is a DEMO — a fixed ' +
        "layout around invented numbers, not a component. Import the primitive it uses from " +
        '"@/components/charts/lib/<domain>" and pass it this site\'s rows.');
    }

    // A chart import is checked down to the NAMED EXPORT, which the ui check
    // above deliberately is not: a ui module's exports are shadcn's and widely
    // known, while these are ours, six names live in two domains each, and the
    // model is picking from 141 modules it is shown once. Getting the module
    // right and the name wrong is the likely miss, and it costs the single
    // repair pass if only tsc catches it.
    for (const m of code.matchAll(/import\s*(\{[^}]*\})\s*from\s+"@\/components\/charts\/lib\/([a-z0-9-]+)"/gi)) {
      const names = CHART_COMPONENTS[m[2].toLowerCase()];
      if (!names) {
        say(path, 'imports "@/components/charts/lib/' + m[2] + '", which is not a chart domain. ' +
          "The domains are: " + Object.keys(CHART_COMPONENTS).join(", ") + ".");
        continue;
      }
      for (const raw of m[1].replace(/[{}]/g, "").split(",")) {
        // `Foo as Bar` imports Foo; the local alias is the page's business.
        const want = raw.trim().split(/\s+as\s+/i)[0].trim();
        if (!want || want === "type") continue;
        if (!names.includes(want)) {
          const elsewhere = Object.entries(CHART_COMPONENTS)
            .filter(([, ns]) => ns.includes(want)).map(([d]) => d);
          say(path, '"' + want + '" is not exported by @/components/charts/lib/' + m[2] + ". " +
            (elsewhere.length
              ? "It is in " + elsewhere.join(" and ") + " — import it from there."
              : "That module exports: " + names.join(", ") + "."));
        }
      }
    }

    // `useApi` FOR A NAME THE SCHEMA NEVER DECLARED. Same class as the useRpc
    // check: the call compiles, the page publishes, and the route answers 404 to
    // every visitor. The hook was invisible to the model until the digest started
    // naming the declared apis, so this is the other half of making it usable —
    // being told what exists, and being told when a name is not one of them.
    for (const m of code.matchAll(/\buseApi\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      if (declaredApis.has(m[1].toLowerCase())) continue;
      say(path, 'calls useApi("' + m[1] + '"), which the schema does not declare. ' +
        (declaredApis.size ? "Declared: " + [...declaredApis].join(", ") + "." : "This schema declares no outside data sources at all."));
    }

    // A PHOTOGRAPH TOKEN SOMEWHERE AN UNBOUGHT PICTURE WOULD BREAK.
    //
    // The token is bought if there is budget for it and cleared to the empty
    // string if there is not — and an empty string is a designed placeholder
    // inside `SafeImage` and a BROKEN-IMAGE ICON in a bare `<img>`. So the tag
    // it sits in decides what an unbought picture looks like, which is why the
    // rule is about the tag rather than about the token.
    //
    // IT WAS `SafeImage` ALONE AND THAT WAS TOO NARROW — measured on the first
    // live build, which put a token in `<Gallery>` and was told off for it. 42
    // of the kit's components render their picture THROUGH SafeImage, so a
    // token in any of them is exactly as safe as one in SafeImage itself, and
    // those are the components the model naturally reaches for on a page that
    // wants a photograph. Refusing them teaches the model to hand-roll an
    // `<img>` instead, which is the one thing that really does break.
    //
    // Checked by the nearest `<` BEFORE the token: the token is always inside an
    // attribute, so in well-formed JSX that is its own opening tag. A token in a
    // bare string constant is caught by the same test, which is intended — it is
    // not in a src at all, and there is no telling where it ends up.
    for (const m of code.matchAll(/@@IMG:[\s\S]*?@@/g)) {
      const open = code.lastIndexOf("<", m.index);
      const tag = open < 0 ? "" : (code.slice(open + 1, open + 24).match(/^[A-Za-z][\w.]*/) || [""])[0];
      if (!SAFE_IMAGE_COMPONENTS.includes(tag)) {
        // AND SAY WHAT WAS ACTUALLY THERE, because ONE message covers two
        // failures that need opposite fixes and nothing could tell them apart.
        //
        // Measured live 2026-08-16 on a photography studio: `index.tsx: writes a
        // @@IMG:@@ token outside any tag` — and the source is gone with the
        // site, so which of these it was is now unanswerable:
        //
        //   (a) the token is loose in the page, or in prose. The picture really
        //       is lost, and the fix is a worked example in the rules.
        //   (b) `const HERO = "@@IMG:...@@"` used later as `<SafeImage src={HERO}>`.
        //       `applyImages` substitutes by a plain text replace over the whole
        //       file, so that picture WORKS — and this rule refused it. A false
        //       alarm teaches the model away from a correct pattern, which this
        //       codebase rates strictly worse than the miss.
        //
        // The preceding text separates them at a glance and costs nothing. It is
        // the page's own source going back to its own owner, clipped and
        // whitespace-collapsed so a multi-line hero does not fill the reply.
        const before = code.slice(Math.max(0, m.index - 60), m.index).replace(/\s+/g, " ").trim();
        say(path, "writes a @@IMG:@@ photograph token " + (tag ? "inside <" + tag + ">" : "outside any tag") +
          (before ? ' (saw: "…' + before + '")' : "") +
          '. A token belongs in the image prop of a component that draws through SafeImage — `<SafeImage src="@@IMG:...@@" alt="..." />` ' +
          "is the plain one, and Gallery, Hero, TeamGrid, ProductCard and the rest are fine too — because a " +
          "picture that could not be bought becomes an empty src, which those draw as a placeholder and " +
          "a bare <img> draws as a broken image.");
      }
    }

    // There was a rule here refusing `@/examples/*`, shadcn's own documentation
    // demos. It existed for one reason, stated in its own comment: every file in
    // that folder COMPILED, so nothing else in the pipeline could tell a real
    // page from one shipping "Our flagship product combines cutting-edge
    // technology with sleek design" to a barber shop's customers. The folder was
    // deleted 2026-07-31, which makes that import a missing module — caught by
    // `tsc` like any other, and no longer silent. The rule's whole justification
    // went with the files, so it went too rather than standing guard over a path
    // that no longer resolves.

    // Read and write are asked separately because the API answers them
    // separately, and the levels do not line up: `feed` READS and WRITES for a
    // signed-in member, while `admin` reads for one and writes for nobody. This
    // comment said "`feed` and `admin` serve reads and refuse writes", which was
    // wrong about feed and is exactly the kind of note that outlives the code it
    // describes.
    // A member-scoped table without useMember() renders a permanent 401 to a
    // signed-out visitor and looks like a broken page rather than a locked one.
    for (const m of code.matchAll(/\buseRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && readNeedsMember(t) && !/\buseMember\b/.test(code)) {
        say(path, 'reads "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401, so the page must offer a sign-in rather than an error.');
      }
      if (!t) say(path, 'reads table "' + m[1] + '", ' + noTable(m[1]));
      // A member table is handled by the rule above: it is readable, just not
      // anonymously. Saying both would report one page twice and pay for a
      // repair pass to fix a problem that was already described.
      else if (!canReadAccess(t) && !readNeedsMember(t)) {
        say(path, 'lists "' + m[1] + '", which is access "' + accessLabel(t) + '" — reading it returns 403: ' + whyNotReadable(t) + '.');
      }
    }
    // `usePublicRows` is the one read that does NOT follow from a table's access
    // level — it works only where the schema declared a `publicView`, and on
    // every other table it is a 404 the visitor sees as a broken page. The same
    // class as the checks around it: a mismatch between what the page asks for
    // and what the schema actually permits, caught without running anything.
    for (const m of code.matchAll(/\busePublicRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'reads table "' + m[1] + '", ' + noTable(m[1]));
      else if (!hasPublicView(t)) {
        say(path, 'calls usePublicRows("' + m[1] + '"), but that table declares no publicView — the request is a 404. Build the page without the taken-slots hint; the server still refuses a taken slot on submit.');
      }
    }
    // AN UNDECLARED TABLE IS REPORTED HERE TOO. This loop had no `!t` branch
    // while `useRows` and `usePublicRows` directly above both have one, so
    // `useRow("ghost", id)` against a table the schema never declared was the one
    // table-name typo the lint stayed silent about — and it is the same
    // compiles-then-404s class as its two siblings: `tsc` sees a string, vite
    // bundles it, the site publishes, and the page 404s in front of a visitor.
    for (const m of code.matchAll(/\buseRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'reads one row of table "' + m[1] + '", ' + noTable(m[1]));
      else if (readNeedsMember(t) && !/\buseMember\b/.test(code)) {
        say(path, 'reads one row of "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401.');
      } else if (!canReadAccess(t) && !readNeedsMember(t)) {
        say(path, 'reads one row of "' + m[1] + '", which is access "' + accessLabel(t) + '" — reading it returns 403: ' + whyNotReadable(t) + '.');
      }
    }
    // A FUNCTION THE SCHEMA NEVER DECLARED IS A 404, and until 2026-08-04 no
    // schema could declare one at all — so `useRpc`, `useRpcAction`,
    // `useClaimedRow` and `useCancelClaim` were four hooks nothing could reach.
    // Now that they can be declared, calling an undeclared one is the same class
    // as naming a table that does not exist, and is caught the same way.
    for (const m of code.matchAll(/\buse(?:Rpc|RpcAction|ClaimedRow|CancelClaim)\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      if (internalFns.has(m[1].toLowerCase())) {
        say(path, 'calls "' + m[1] + '", which the schema declares as internal — it is revoked from the ' +
          "Data API roles, so the call compiles and then answers 403 to every visitor. Platform-only; do not call it from a page.");
      } else if (!fns.has(m[1].toLowerCase())) {
        say(path, 'calls the database function "' + m[1] + '", which this schema does not declare — the request is a 404. ' +
          (fns.size ? "Declared: " + [...fns].join(", ") + "." : "This schema declares no functions at all."));
      }
    }
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'writes to table "' + m[1] + '", ' + noTable(m[1]));
      // A member table accepts writes from someone signed in — that is the whole
      // point of the level — so the question is whether the page has a member,
      // not whether the table is writable.
      //
      // `canMemberWrite`, NOT `needsMember`: the latter is true for `admin`, and
      // admin grants SELECT and nothing else, so this branch swallowed the one
      // case it most needed to report. An admin form passed the lint and then
      // refused its own administrator.
      else if (canMemberWrite(t)) {
        if (!/\buseMember\b/.test(code)) {
          say(path, 'writes to "' + m[1] + '" (access "' + accessLabel(t) + '") without useMember(). Signed out that returns 401, so the form must be behind a sign-in.');
        }
      } else if (!canWriteAccess(t)) {
        // THE WHOLE TABLE, not `t.access` — one token, and it decided both
        // directions (2026-08-14 audit, both confirmed by execution).
        // `normalizeSchema` stamps access:"collect" on every pair-declared
        // table, so passing the string made this gate blind exactly where the
        // digest misleads: useCreateRow against {read:"public", write:"none"}
        // returned ZERO problems — a form that 403s for every visitor on a
        // published site, the precise class this lint documents itself as
        // existing for — while {access:"display", write:"anyone"} was falsely
        // flagged, with the flag's own message printing the correctly-resolved
        // label. Every neighbouring check already passes the table; this one
        // was the CRIT-D fix stopping one expression short.
        say(path, 'submits to "' + m[1] + '", which is access "' + accessLabel(t) + '" — writing to it returns 403. Only a table whose write side is open to anyone accepts a form from a published site.');
      }
    }
    // AN ATTACH CONTROL ON A TABLE THAT TAKES NO FILE — the same
    // compiles-then-403s class as its neighbours, and it had NO rule at all.
    //
    // `useUploadFile` appeared exactly once in this whole file before now, inside
    // rule 8's own worked example, so a call to it was checked by nothing:
    // `handleVisitorUpload` gates on `acceptsVisitorUploads` and answers 403
    // `{code:"no_uploads"}`, while `tsc` sees a string, vite bundles it and the
    // site publishes. Measured: `bookings` with an `attachment` column returned
    // `[]` from this lint and 403 at runtime.
    //
    // THE FALSE-ALARM RATE IS THE ONLY THING THAT LETS THIS EXIST, and it is
    // measured rather than argued: **0 calls across the 324 pinned exemplars and
    // 0 across the 8 pinned generator pages**, so nothing written the way we
    // teach — or the way the model actually wrote — is touched by it. It also
    // asks `acceptsVisitorUploads`, the SAME function the route gates on, so a
    // hit is the route's own refusal predicted rather than a rule of our own.
    //
    // SKIPPED for a table the schema does not declare: `useCreateRow` and the
    // read hooks already report an unknown name, and saying it twice reports one
    // mistake as two. A computed table name is skipped by the literal-only
    // pattern, like every other hook here.
    for (const m of code.matchAll(/\buseUploadFile\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase()) || closedTables.get(m[1].toLowerCase());
      if (!t || acceptsVisitorUploads(t)) continue;
      say(path, 'calls useUploadFile("' + m[1] + '"), but that table takes no file — the upload returns 403. ' +
        "A form may attach a picture only where the table declares a picture column (the digest says FILE UPLOAD: YES). " +
        "Build the form without an attach control.");
    }
  }
  return [...new Set(problems)];
}

/** The repair turn: here is what you wrote, here is what is wrong, write it again. */
/**
 * The exact props of the components a page imported.
 *
 * The rules name 500 components and describe NONE of them, because a usage line
 * each is ~12,600 tokens on every build. So the model picks by name and guesses
 * the props — and the guess is wrong often enough to matter: `<ReviewStars
 * rating={4.5} />` is the obvious spelling and the prop is `value`, which is
 * TS2322, the one repair pass spent, and a site published as the placeholder.
 *
 * Handing them over on the REPAIR pass costs nothing on a build that worked and
 * ~500 tokens on one that did not — and a repair is exactly where a wrong prop
 * name has to be corrected. The imports are read off the code the model just
 * wrote, so it only ever gets the twenty or so it actually reached for.
 */
export function importedComponentApi(pages) {
  const want = new Set();
  const wantCharts = new Set();
  for (const p of pages || []) {
    const src = String(p.source || "");
    for (const m of src.matchAll(/from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/gi)) {
      want.add(m[1].toLowerCase());
    }
    // The chart domains a page reached for get their signatures too. A repair is
    // where a wrong prop name is fixed, and these are components we invented —
    // the half the model can only guess at — so leaving them out would hand back
    // the exact page that failed with nothing new to go on.
    for (const m of src.matchAll(/from\s+["']@\/components\/charts\/lib\/([a-z0-9-]+)["']/gi)) {
      wantCharts.add(m[1].toLowerCase());
    }
  }
  const lines = [...want].sort()
    .filter((n) => COMPONENT_API[n])          // shadcn primitives are absent on purpose
    .map((n) => `${n} — ${COMPONENT_API[n]}`)
    .concat([...wantCharts].sort()
      .filter((n) => CHART_API[n])
      .map((n) => `charts/lib/${n} — ${CHART_API[n]}`));
  return lines.length ? lines.join("\n") : null;
}

/**
 * Worked calls for the chart primitives a page actually named, from the demos.
 *
 * Separate from the signatures because they answer different questions and one
 * cannot stand in for the other. A signature gives the whole surface and stops
 * at a type NAME — `Waterfall(steps: Step[], …)` never says what a `Step` is,
 * and 27 of the 854 end that way. The example resolves it, and shows the
 * optional `total: true` flag no type name hinted at.
 *
 * Scoped to what the page IMPORTED, and to the names it actually used, or this
 * costs on every repair what the compose/repair split exists to avoid.
 */
export function importedChartUsage(pages) {
  const out = [];
  for (const p of pages || []) {
    const src = String(p.source || "");
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/components\/charts\/lib\/([a-z0-9-]+)["']/gi)) {
      for (const raw of m[1].replace(/[{}]/g, "").split(",")) {
        const name = raw.trim().split(/\s+as\s+/i)[0].trim();
        const key = m[2].toLowerCase() + "." + name;
        if (CHART_USAGE[key] && !out.some((o) => o.startsWith(key + "\n"))) {
          out.push(key + "\n" + CHART_USAGE[key]);
        }
      }
    }
  }
  return out.length ? out.join("\n\n") : null;
}

/**
 * UNREACHABLE FROM PRODUCTION SINCE 2026-08-04. Nothing calls this: the repair
 * pass was removed from `publish-pages.mjs` and `pagesRequest` no longer has a
 * `fix` branch, so a build makes exactly one model call.
 *
 * Said out loud because this codebase's most expensive recurring bug is code
 * that LOOKS reachable and is not — `roundRobin`, `sla`, `maskFields`,
 * `teamScope` at five separate layers. The difference here is that it is
 * written down, and a test asserts no production caller exists rather than
 * trusting this comment.
 *
 * Kept rather than deleted because it is one decision away from mattering
 * again: if the eval's first-try rate turns out to be poor, the repair comes
 * back and this is what it needs. `importedComponentApi` and
 * `importedChartUsage` are here on the same terms, along with the generated
 * `COMPONENT_API`, `CHART_API` and `CHART_USAGE` they read. The owner's
 * standing rule is that unused code goes; this is a deliberate hold on that,
 * not an oversight, and it is theirs to call.
 */
export function repairPrompt(brief, spec, pages, problems, brand) {
  const files = pages.map((p) => "=== src/routes/" + p.path + " ===\n" + p.source).join("\n\n");
  const api = importedComponentApi(pages);
  const usage = importedChartUsage(pages);
  return "The pages you wrote did not work. Fix them and return the COMPLETE set of route files again — " +
    "every file, not a patch.\n\nWHAT IS WRONG\n" +
    problems.map((p) => "- " + p).join("\n") +
    (api
      ? "\n\nTHE EXACT PROPS OF WHAT YOU IMPORTED\n" +
        "These are the real signatures, taken from the components themselves. Where what you\n" +
        "wrote disagrees with one of these, the signature is right. Every one also takes\n" +
        "className. A `?` means optional; `= x` is the default.\n" + api
      : "") +
    // The examples come AFTER the signatures on purpose: the signature is the
    // whole surface and the example is one working point on it. Read the other
    // way round, a call showing four of nine props reads as the four that exist.
    (usage
      ? "\n\nWORKING CALLS FOR THE CHARTS YOU IMPORTED\n" +
        "Real code that compiles today, so where a signature only gave you a type NAME this\n" +
        "shows its shape. Arrays are cut short — copy the shape, not the numbers, and pass\n" +
        "this site's own rows.\n" + usage
      : "") +
    "\n\nWHAT YOU WROTE\n" + files.slice(0, 60000) +
    "\n\n" + pagesPrompt(brief, spec, brand);
}

// ------------------------------------------------------- the request itself

/**
 * Page generation is a much bigger call than the schema design — whole .tsx
 * files rather than a handful of column names.
 *
 * Sized above what the pages themselves need: Sonnet 5 runs adaptive thinking
 * when `thinking` is omitted, and max_tokens caps thinking AND the response
 * together, so a budget tight around the files would spend part of itself
 * reasoning and truncate the last one.
 *
 * 30,000, RAISED FROM 24,000 ON 2026-08-04 (owner's call), alongside taking the
 * request's timeout off. Both caps had the same shape of failure and it is the
 * expensive one: hitting either means the tokens were generated and billed and
 * the caller gets nothing — a truncated tool_use block is treated as a failed
 * generation here, correctly, because its last file ends mid-expression.
 *
 * It costs nothing to raise. max_tokens is a CEILING, not a reservation: a
 * three-page site that finishes in 5,000 is billed for 5,000 either way. The
 * only thing a low ceiling buys is a cheaper failure, and a failure is the
 * thing we are trying not to have.
 */
export const SITE_PAGES_MAX_TOKENS = 30000;

/**
 * The exact body the Worker POSTs to the model.
 *
 * Extracted so the eval harness issues the SAME request the Worker does. It was
 * built inline in worker.js, which cannot be imported — so any harness had to
 * restate the model, the budget, the tool and the prompt, and would then be
 * tuning against something subtly different from what production runs. A test
 * asserts worker.js calls this rather than rebuilding the body.
 *
 * THE SYSTEM BLOCK IS CACHED, and that is the whole reason it is an array here
 * rather than the plain string it used to be. `PAGE_RULES` is byte-identical on
 * every generation on the platform — it does not vary with the brief, the
 * schema or the brand, all of which live in the user message. So it was being
 * paid for in full, every build, forever.
 *
 * Measured when this landed: input goes 7,523 -> 1,148 tokens per build in the
 * steady state, an 85% cut. The first call in a cache window pays a 1.25x write
 * premium (9,294), so it breaks even on the second build. That break-even used
 * to be reached inside a single build, because the repair pass re-sent this
 * exact block; with the repair gone it takes a second BUILD in the cache window.
 *
 * THOSE ARE THE ORIGINAL FIGURES AND THE BLOCK HAS GROWN FIVEFOLD SINCE — this
 * said "`PAGE_RULES` is ~7,000 tokens" as a present-tense fact while the string
 * was ~33,000. The conclusion is unchanged and stronger (a bigger cached block
 * saves more), but the write premium a reader would compute off the old number
 * is out by 5x, and this file's own doctrine is that a stale claim in a comment
 * is what gets believed next time somebody edits the line. Kept as history
 * rather than re-measured into a number that goes stale the same way: the ONE
 * place a live token count belongs is a test that measures it, and the ratios
 * above are what the decision actually rested on.
 *
 * The consequence to know about: a cache entry is keyed on the bytes, so ANY
 * edit to PAGE_RULES — including adding a component name — invalidates it and
 * the next call pays the write premium again. That is once per deploy that
 * touches the rules, against a saving on every build in between.
 */
export function pagesRequest({ brief, spec, brand, attachments, model, priorPages, mode = "revise", target = "" } = {}) {
  // THE ATTACHED FILES \u2014 images and PDFs \u2014 and where they sit is load-bearing
  // twice over.
  //
  // They go in the USER MESSAGE, which is after both cached blocks — so a build
  // with an attachment still reads `PAGE_RULES` and the tool schema out of the
  // cache. Putting them anywhere in `system` or `tools` would change the cached
  // bytes and make every attachment a cache miss on ~27,000 tokens, which costs
  // far more than the pictures do.
  //
  // And they come BEFORE the text within that message, which is the order the
  // API is documented to work best in and the order the prompt then refers to
  // ("above this text").
  //
  // Blocks are validated by the caller. When there are none the content stays a
  // plain STRING rather than a one-element array — the shape every existing
  // caller and test already sees, so adding this feature changes no request that
  // does not use it.
  const blocks = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const text = pagesPrompt(brief, spec, brand, blocks.length, priorPages, mode, target);
  return {
    // The composer's Builder picker chooses this; `modelsFor()` with no
    // argument is the default pair, which is what the eval harness and every
    // caller that does not offer a choice get. Never a bare string here — a
    // fourth copy of a model id is a fourth place for it to go stale.
    model: model || modelsFor().pages,
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [SITE_PAGES_TOOL],
    tool_choice: { type: "tool", name: "write_pages" },
    system: [{ type: "text", text: PAGE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text }] : text }],
  };
}
