/**
 * Generates `builder/kit-headings.mjs` — which of the kit's own components show
 * one of their props as a VISIBLE SECTION HEADING, read off each component's
 * own source with the TypeScript parser.
 *
 * WHY (2026-09-26, owner, reproduced independently): *"the correct removal is
 * refused with SectionHeader's title prop and accepted with the equivalent
 * literal h2."* The text guard (`page-prose.mjs`) names a section by the words
 * of its literal `<h1>`–`<h6>`, and a page built from the kit writes
 * `<SectionHeader title="Today's bake" />`, which a visitor sees as an `<h2>`
 * the guard never saw. Measured over the 324-page corpus: `SectionHeader`'s
 * `title` alone is 839 of the 932 uses of a component this table admits.
 *
 * WHAT COUNTS, AND EVERY LINE IS THE OWNER'S "do not treat every arbitrary
 * title prop as a heading". A component is admitted for one prop only when its
 * own source establishes all of this:
 *
 *   - it is a NAMED export, a function taking its props by destructuring —
 *     what a page imports by name and passes by name;
 *   - the prop, unchanged, is the whole text of an `<h1>` or `<h2>` — the
 *     levels this kit gives a page or a section. An `<h3>` heads a card inside
 *     a section (`DishCard`, `RoomCard`, `PractitionerCard` …), and naming a
 *     card must not authorize the section around it;
 *   - the heading is always there when the component renders with that prop:
 *     one `return`, reached from the function body itself; nothing between the
 *     heading and it but plain HTML elements, a fragment or brackets; and no
 *     condition but the prop's own truthiness (`{title && <h2>…}`), which a
 *     non-empty literal satisfies. A kit component in between decides for
 *     itself whether its children show, so it cannot be counted on;
 *   - nothing hides it: no `hidden`, `aria-hidden` or `style` on it or any
 *     element around it, and no `hidden`, `invisible` or `sr-only` class.
 *
 * Anything else is left out, and left out means UNCERTAIN, never "no heading":
 * the guard then grants nothing by that name, which is the direction a wrong
 * answer is safe in.
 *
 * IT IS DERIVED, AND A DERIVATION IS A COPY THAT DRIFTS — which is exactly why
 * this is generated and `test/kit-headings.test.mjs` re-runs it and compares.
 * `builder/component-api.mjs` and `builder/foundation-files.mjs` are the
 * precedent. Run `node builder/gen-kit-headings.mjs` after touching a kit
 * component's heading.
 *
 * THE PARSER IS A DEVELOPMENT DEPENDENCY and this module is never shipped: the
 * Worker and the job child import only the generated table.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const UI_DIR = path.join(import.meta.dirname, "lovable/template/src/components/ui");
const OUT = path.join(import.meta.dirname, "kit-headings.mjs");

const K = ts.SyntaxKind;
const SECTION_LEVEL = /^h[12]$/;
const HEADING = /^h[1-6]$/;
// A class that can take the element off the screen, at any breakpoint or state
// (`hidden`, `sm:hidden`, `group-hover:invisible`). `overflow-hidden` is not one.
const HIDING_CLASS = /(?:^|[\s"'`:])(?:hidden|invisible|sr-only)(?=$|[\s"'`])/;

const isFn = (n) => n.kind === K.ArrowFunction || n.kind === K.FunctionExpression || n.kind === K.FunctionDeclaration;

/** A condition that is true whenever `local` is: `local`, `(local)`, `local || x`. */
function impliedBy(e, local) {
  while (e.kind === K.ParenthesizedExpression) e = e.expression;
  if (e.kind === K.Identifier) return e.text === local;
  if (e.kind === K.BinaryExpression && e.operatorToken.kind === K.BarBarToken) return impliedBy(e.left, local) || impliedBy(e.right, local);
  return false;
}

/** What hides an element, if anything: an attribute, or a class. */
function hiding(open) {
  const out = [];
  for (const a of open.attributes.properties) {
    if (a.kind === K.JsxSpreadAttribute) { out.push("spread"); continue; }
    const key = a.name.getText();
    if (key === "hidden" || key === "aria-hidden" || key === "style") out.push(key);
    if ((key === "className" || key === "class") && a.initializer && HIDING_CLASS.test(a.initializer.getText())) out.push("class");
  }
  return out;
}

/** One component: every heading that shows one of its props whole, and whether it counts. */
function headingProps(component, fn) {
  const found = [];
  const p0 = fn.parameters && fn.parameters[0];
  if (!p0 || p0.name.kind !== K.ObjectBindingPattern) return found;
  const props = new Map();
  for (const el of p0.name.elements) {
    if (el.dotDotDotToken || el.name.kind !== K.Identifier) continue;
    const prop = el.propertyName ? (el.propertyName.kind === K.Identifier || el.propertyName.kind === K.StringLiteral ? el.propertyName.text : null) : el.name.text;
    if (prop) props.set(el.name.text, prop);
  }
  let returns = 0;
  const countReturns = (n) => {
    if (n !== fn && isFn(n)) return;
    if (n.kind === K.ReturnStatement) returns++;
    ts.forEachChild(n, countReturns);
  };
  if (fn.body.kind === K.Block) countReturns(fn.body); else returns = 1;

  const visit = (n) => {
    if (n !== fn && isFn(n)) return;
    if (n.kind === K.JsxElement && HEADING.test(n.openingElement.tagName.getText())) {
      const kids = n.children.filter((c) => !(c.kind === K.JsxText && !c.text.trim()));
      const e = kids.length === 1 && kids[0].kind === K.JsxExpression ? kids[0].expression : null;
      if (e && e.kind === K.Identifier && props.has(e.text)) {
        const local = e.text, tag = n.openingElement.tagName.getText(), why = [];
        if (!SECTION_LEVEL.test(tag)) why.push("an " + tag + " heads a card inside a section, not the section");
        if (returns !== 1) why.push("the component can return without it (" + returns + " returns)");
        for (const h of hiding(n.openingElement)) why.push("hidden by " + h);
        for (let c = n, p = n.parent; p && p !== fn; c = p, p = p.parent) {
          if (p.kind === K.JsxElement) {
            const t = p.openingElement.tagName.getText();
            if (!/^[a-z]/.test(t)) why.push("inside <" + t + ">, which decides whether its children show");
            for (const h of hiding(p.openingElement)) why.push("hidden by " + h + " on <" + t + ">");
          } else if (p.kind === K.BinaryExpression) {
            if (!(p.operatorToken.kind === K.AmpersandAmpersandToken && p.right === c && impliedBy(p.left, local))) why.push("shown only when " + p.left.getText().replace(/\s+/g, " ").slice(0, 60));
          } else if (p.kind === K.ConditionalExpression) {
            if (!(p.whenTrue === c && impliedBy(p.condition, local))) why.push("shown only when " + p.condition.getText().replace(/\s+/g, " ").slice(0, 60));
          } else if (p.kind === K.ReturnStatement || p.kind === K.Block) {
            if ((p.kind === K.ReturnStatement ? p.parent : p) !== fn.body) why.push("returned from inside a block");
          } else if (p.kind !== K.JsxFragment && p.kind !== K.ParenthesizedExpression && p.kind !== K.JsxExpression) {
            why.push("reached through a " + K[p.kind]);
          }
        }
        found.push({ component, prop: props.get(local), tag, why: [...new Set(why)] });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return found;
}

/**
 * Every exported component in one kit file that shows a destructured prop as a
 * heading's whole text — `{component, prop, tag, why}`, admitted when `why` is
 * empty. A component admitted for two props is admitted for neither: which one
 * heads the section would be a guess.
 */
export function examine(source, file = "component.tsx") {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  for (const st of sf.statements) {
    const mods = st.modifiers || [];
    if (!mods.some((m) => m.kind === K.ExportKeyword) || mods.some((m) => m.kind === K.DefaultKeyword)) continue;
    if (st.kind === K.FunctionDeclaration && st.name && st.body) out.push(...headingProps(st.name.text, st));
    if (st.kind === K.VariableStatement) for (const d of st.declarationList.declarations) {
      const init = d.initializer;
      if (d.name.kind === K.Identifier && init && (init.kind === K.ArrowFunction || init.kind === K.FunctionExpression)) out.push(...headingProps(d.name.text, init));
    }
  }
  // Counted BEFORE any is marked: marking as it went, the second prop was
  // compared against a list the first had already left, and stayed admitted.
  const props = new Map();
  for (const r of out) if (!r.why.length) (props.get(r.component) ?? props.set(r.component, new Set()).get(r.component)).add(r.prop);
  for (const r of out) if (!r.why.length && props.get(r.component).size > 1) r.why.push("two of its props are headings");
  return out;
}

/** The table: kit module (its file name) → component → the prop it heads a section with. */
export function build(dir = UI_DIR) {
  const table = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort()) {
    const module = f.slice(0, -4);
    for (const r of examine(fs.readFileSync(path.join(dir, f), "utf8"), f)) {
      if (r.why.length) continue;
      (table[module] ??= {})[r.component] ??= { prop: r.prop, tag: r.tag };
    }
  }
  return table;
}

export function render(table) {
  const row = ([module, comps]) => "  " + JSON.stringify(module) + ": { "
    + Object.entries(comps).map(([c, h]) => JSON.stringify(c) + ": { prop: " + JSON.stringify(h.prop) + ", tag: " + JSON.stringify(h.tag) + " }").join(", ")
    + " },";
  return [
    "// GENERATED by builder/gen-kit-headings.mjs — do not edit by hand.",
    "//",
    "// The kit components whose own source shows one of their props as a visible",
    "// section heading: kit module → component → the prop, and the h1/h2 it renders.",
    "// The text guard (`page-prose.mjs`) names a section by that prop's literal",
    "// value when the page imports the component from `@/components/ui/<module>`.",
    "// A component that is not here is not a heading the guard can name.",
    "export const KIT_HEADINGS = Object.freeze({",
    ...Object.entries(table).map(row),
    "});",
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  fs.writeFileSync(OUT, render(build()));
  console.log("wrote " + path.relative(process.cwd(), OUT));
}
