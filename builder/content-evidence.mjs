/**
 * WHAT A CHANGE PUT ON A PAGE, AND WHAT THE PUBLISHED PAGE SHOWED OF IT
 * (2026-10-13, after run 144).
 *
 * A section the Add-on adds is a `component`, and a component has no identity
 * anything enumerates (`OPAQUE_KINDS`), so every requirement it carried read
 * `unknown` and the customer was told "I can't see from here whether…" about a
 * section that was stored and served. Runs 135, 137, 141 and 144 all said it.
 * Run 144's questions section is the plain case: both sentences are in the
 * stored page, the page as served carries the question, and the answer sits in
 * an accordion item served closed — only opening it shows it.
 *
 * THREE DIFFERENT FACTS, KEPT APART, because each licenses a different sentence:
 *
 *   stored   the text this change added to the page's stored code — read from
 *            the syntax tree, before against after, never from the request's
 *            words. Present in code is not the same as shown.
 *   shown    whether that text was on the published page as it first loads,
 *            read from the render check's own browser (`body.innerText`, which
 *            leaves out what is closed, hidden or not yet drawn). Absent there
 *            with the text in the code means it waits behind something a
 *            visitor does, or behind a state the page is not in.
 *   behavior whether opening, switching or submitting shows it. NOTHING HERE
 *            EXERCISES ANY OF THAT, so it is always unverified: stored content
 *            is never proof that an interaction works.
 *
 * NOTHING HERE PARSES JAVASCRIPT ON ITS OWN. The files are read by the injected
 * TypeScript parser (`tweakParser()`), as the menu and picture readers are. No
 * parser, or a file that does not parse, is `unread` — never a guess.
 *
 * A PLACEMENT IS A HINT, NOT A VERDICT. `conditional` (an arm of a condition, a
 * `&&`, a branch that returns: one of the page's alternative views), `handed`
 * (passed in a prop, an array or a callback to a component that decides when
 * to show it), `direct` (written as an element's own text). Whether it showed
 * is the browser's answer; the placement only says where in the code it sits.
 */

const TECH = new Set([
  "classname", "class", "style", "id", "key", "href", "src", "srcset", "type", "name", "value", "variant", "size",
  "network", "role", "htmlfor", "autocomplete", "as", "to", "method", "target", "rel", "icon", "slot", "align",
  "side", "orientation", "inputmode", "pattern", "lang", "dir", "loading", "decoding", "fetchpriority", "tone",
  "layout", "shape", "theme", "mode", "kind", "format", "currency", "locale", "path", "route", "table", "column",
  "field", "control", "resolver", "defaultvalue", "placeholderclassname", "data-slot", "data-state", "aria-hidden",
  "accept", "capture", "action", "enctype", "form", "list", "min", "max", "step", "colspan", "rowspan", "width", "height",
]);

/** One text as it is compared: case, quotes, dashes, spacing and entities folded. */
export function foldText(s) {
  return String(s == null ? "" : s)
    .normalize("NFKC")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

// A STRING A VISITOR COULD READ: letters, and either spaces, a capital first
// letter, or closing punctuation. A class list, a path, a key or an id has
// none of the shapes a sentence or a label has.
function readable(s) {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t || !/\p{L}/u.test(t)) return false;
  if (/\s/.test(t)) return !/^[a-z0-9:_\/.\-\[\]%#&=?]+( [a-z0-9:_\/.\-\[\]%#&=?]+)*$/.test(t) || /[.?!,]$/.test(t);
  if (/^(https?:|mailto:|tel:|\/|#|@)/i.test(t)) return false;
  return /^\p{Lu}/u.test(t) || /[.?!]$/.test(t);
}

/**
 * The texts a visitor could read in one file, each with where it sits, or
 * `null` when it cannot be read (no parser, or the file does not parse).
 * `[{ text, placement: ["conditional" | "handed"] | ["direct"] }]`, in source
 * order, repeats kept.
 */
export function visibleTexts(source, parse) {
  if (typeof parse !== "function" || typeof source !== "string") return null;
  let P;
  try { P = parse(source); } catch { return null; }
  const { file, SK, each } = P || {};
  if (!file || !SK || typeof each !== "function") return null;
  if (!Array.isArray(file.parseDiagnostics) || file.parseDiagnostics.length) return null;
  const out = [];
  const attrName = (a) => {
    const n = a && a.name;
    return String((n && (n.escapedText || n.text || (typeof n.getText === "function" ? n.getText() : ""))) || "").toLowerCase();
  };
  const propName = (p) => {
    const n = p && p.name;
    if (!n) return "";
    return String(n.escapedText || n.text || "").toLowerCase();
  };
  const isComponentTag = (open) => {
    const t = open && open.tagName;
    const s = String((t && typeof t.getText === "function" ? t.getText() : (t && t.escapedText)) || "");
    return /^[A-Z]/.test(s) || s.includes(".");
  };
  // WHERE A TEXT SITS, from all of its ancestors: `conditional` (an arm of a
  // condition, a `&&`, or one of several returns — one of the page's
  // alternative views), `handed` (passed in a prop, an array or a callback to
  // something that decides when to show it). Both can hold at once; neither is
  // `direct`. Sorted, so the answer does not depend on the walk.
  const placeOf = (stack) => {
    const got = new Set();
    for (let i = stack.length - 1; i > 0; i--) {
      const n = stack[i], up = stack[i - 1];
      if (up.kind === SK.ConditionalExpression && (up.whenTrue === n || up.whenFalse === n)) got.add("conditional");
      if (up.kind === SK.BinaryExpression && up.right === n) {
        const op = up.operatorToken && up.operatorToken.kind;
        if (op === SK.AmpersandAmpersandToken || op === SK.BarBarToken || op === SK.QuestionQuestionToken) got.add("conditional");
      }
      if (up.kind === SK.IfStatement && (up.thenStatement === n || up.elseStatement === n)) got.add("conditional");
      if (up.kind === SK.JsxAttribute) {
        const open = stack[i - 3];
        if (open && (open.kind === SK.JsxOpeningElement || open.kind === SK.JsxSelfClosingElement) && isComponentTag(open)) got.add("handed");
      }
      if (up.kind === SK.CallExpression && up.expression !== n) got.add("handed");
      // A RETURN BESIDE ANOTHER RETURN (`if (sent) return …; return …`) IS ONE
      // VIEW OF SEVERAL: the last return is the other view, so it is too.
      if (up.kind === SK.ReturnStatement) {
        const block = stack[i - 2];
        if (block && block.kind === SK.Block && Array.isArray(block.statements)) {
          const rets = block.statements.filter((s) => s.kind === SK.ReturnStatement);
          const ifRet = block.statements.some((s) => s.kind === SK.IfStatement && hasReturn(s));
          if (rets.length > 1 || (ifRet && rets.length >= 1)) got.add("conditional");
        }
      }
    }
    return got.size ? [...got].sort() : ["direct"];
  };
  const hasReturn = (node) => {
    let found = false;
    const walk = (n) => {
      if (found) return;
      if (n.kind === SK.ReturnStatement) { found = true; return; }
      if (n.kind === SK.FunctionDeclaration || n.kind === SK.ArrowFunction || n.kind === SK.FunctionExpression) return;
      each(n, walk);
    };
    walk(node);
    return found;
  };
  const skipped = (stack) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const n = stack[i];
      if (n.kind === SK.ImportDeclaration || n.kind === SK.ExportDeclaration) return true;
      if (n.kind === SK.JsxAttribute && TECH.has(attrName(n))) return true;
      if (n.kind === SK.PropertyAssignment && TECH.has(propName(n)) && stack[i + 1] === n.initializer) return true;
      if (n.kind === SK.PropertyAssignment && stack[i + 1] === n.name) return true;
      if (n.kind === SK.CallExpression && i + 1 < stack.length && n.arguments && n.arguments.includes(stack[i + 1])) {
        const callee = n.expression && (n.expression.escapedText || (n.expression.name && n.expression.name.escapedText) || "");
        if (/^(createFileRoute|useCreateRow|useRows|useRow|useUpdateRow|useDeleteRow|import|require|z|string|email|min|max|regex|useState)$/.test(String(callee))) return true;
      }
      if (n.kind === SK.ElementAccessExpression || n.kind === SK.LiteralType || n.kind === SK.TypeReference) return true;
    }
    return false;
  };
  const stack = [];
  const walk = (n) => {
    stack.push(n);
    if (n.kind === SK.JsxText) {
      const t = String(n.text || "").replace(/\s+/g, " ").trim();
      if (t && /\p{L}/u.test(t)) out.push({ text: t, placement: placeOf(stack) });
    } else if (n.kind === SK.StringLiteral || n.kind === SK.NoSubstitutionTemplateLiteral) {
      const t = String(n.text || "");
      if (readable(t) && !skipped(stack)) out.push({ text: t.replace(/\s+/g, " ").trim(), placement: placeOf(stack) });
    }
    each(n, walk);
    stack.pop();
  };
  try { walk(file); } catch { return null; }
  return out;
}

/** `after` less `before`, as multisets of folded text, keeping `after`'s entries. */
function less(after, before, key = (x) => foldText(x.text)) {
  const left = new Map();
  for (const b of before) left.set(key(b), (left.get(key(b)) || 0) + 1);
  const out = [];
  for (const a of after) {
    const k = key(a);
    const n = left.get(k) || 0;
    if (n > 0) left.set(k, n - 1);
    else out.push(a);
  }
  return out;
}

/**
 * The components a file renders by name (capitalised or dotted JSX tags), as
 * a multiset, or null when it cannot be read: a component can carry its own
 * copy (a kit block with words of its own), so a new one with no new text is
 * still something added, whose content nothing here read.
 */
export function componentTags(source, parse) {
  if (typeof parse !== "function" || typeof source !== "string") return null;
  let P;
  try { P = parse(source); } catch { return null; }
  const { file, SK, each } = P || {};
  if (!file || !SK || typeof each !== "function" || !Array.isArray(file.parseDiagnostics) || file.parseDiagnostics.length) return null;
  const out = [];
  const walk = (n) => {
    if (n.kind === SK.JsxOpeningElement || n.kind === SK.JsxSelfClosingElement) {
      const t = n.tagName;
      const s = String((t && typeof t.getText === "function" ? t.getText() : (t && t.escapedText)) || "");
      if (/^[A-Z]/.test(s) || s.includes(".")) out.push({ tag: s });
    }
    each(n, walk);
  };
  try { walk(file); } catch { return null; }
  return out;
}

const fileKey = (f) => (f && typeof f.path === "string" && f.path ? "page:" + f.path : f && typeof f.name === "string" && f.name ? "part:" + f.name : "");
const routesOf = (f) => (Array.isArray(f && f.routes) ? f.routes : []).filter((r) => typeof r === "string" && r);
const maybeOf = (f) => (Array.isArray(f && f.maybeRoutes) ? f.maybeRoutes : []).filter((r) => typeof r === "string" && r);

/**
 * WHAT THIS CHANGE ADDED, PER ROUTE, read from the stored files before and
 * after. `before` and `after` are routed file lists (`routedSources`): each
 * `{ path | name, source, routes, maybeRoutes? }`. Answers a Map of route to
 * `{ read, added: [{ text, placement }], tags }` for every route a changed
 * file reaches, or `null` with no parser (nothing can be told at all):
 *   read: true    every file this change added or changed that reaches the
 *                 route parsed on both sides, and reaches it certainly;
 *   read: false   one of them did not parse, or reaches the route only maybe;
 *   tags          components added there by name, beside the texts.
 * A FILE THAT DID NOT CHANGE BUT NOW REACHES A ROUTE IT DID NOT (an existing
 * part a page newly renders) brings all of its text to that route.
 * A route no changed file reaches is absent from the Map: nothing was added
 * there, which the caller may say only because the parser was there to read.
 */
export function addedByRoute({ before = [], after = [], parse = null } = {}) {
  if (typeof parse !== "function") return null;
  const byRoute = new Map();
  const at = (r) => { if (!byRoute.has(r)) byRoute.set(r, { read: true, added: [], tags: 0 }); return byRoute.get(r); };
  const was = new Map();
  for (const f of Array.isArray(before) ? before : []) { const k = fileKey(f); if (k) was.set(k, f); }
  for (const f of Array.isArray(after) ? after : []) {
    const k = fileKey(f);
    if (!k || typeof f.source !== "string") continue;
    const old = was.get(k);
    const same = !!old && old.source === f.source;
    const routes = routesOf(f);
    const maybe = maybeOf(f).filter((r) => !routes.includes(r));
    // AN UNCHANGED FILE MATTERS ONLY WHERE IT NOW REACHES A ROUTE IT DID NOT.
    const fresh = same ? routes.filter((r) => !routesOf(old).includes(r)) : routes;
    const freshMaybe = same ? maybe.filter((r) => !routesOf(old).includes(r) && !maybeOf(old).includes(r)) : maybe;
    if (!fresh.length && !freshMaybe.length) continue;
    const now = visibleTexts(f.source, parse), nowTags = componentTags(f.source, parse);
    const then = old && !same ? visibleTexts(old.source, parse) : [], thenTags = old && !same ? componentTags(old.source, parse) : [];
    for (const r of freshMaybe) at(r).read = false;
    for (const r of fresh) {
      const e = at(r);
      if (!now || !then || !nowTags || !thenTags) { e.read = false; continue; }
      e.added.push(...less(now, then));
      e.tags += less(nowTags, thenTags, (x) => x.tag).length;
    }
  }
  return byRoute;
}

export const MAX_RENDERED_TEXT = 12000;

/**
 * The render check's text per route, read strictly: `Map(route → { complete,
 * text })` for every entry that reads, from `report.texts`
 * (`[{ route, text, complete }]`). A route the check never reached is not in it.
 */
export function renderedTexts(report) {
  const out = new Map();
  const list = report && typeof report === "object" && Array.isArray(report.texts) ? report.texts : [];
  for (const t of list) {
    if (!t || typeof t !== "object" || typeof t.route !== "string" || !t.route || typeof t.text !== "string") continue;
    out.set(t.route, { complete: t.complete === true, text: t.text });
  }
  return out;
}

/**
 * ONE ROUTE'S EVIDENCE: what was added there, and how much of it the page
 * showed as it first loaded.
 *   stored  "added" | "none" | "unread" ("none" only from a Map the parser
 *           made: a route no changed file reaches had nothing added)
 *   shown   "all" | "some" | "none" | "unread" (only beside stored "added")
 *   hidden  the added texts the first load did not show, each with placement
 *   texts   how many texts were added
 * A text found on the page counts as shown whatever the read's completeness;
 * one NOT found counts as not shown only on a complete read.
 */
export function routeEvidence(route, added, rendered) {
  if (!(added instanceof Map)) return { stored: "unread" };
  const a = added.get(route);
  if (!a) return { stored: "none" };
  if (!a.read) return { stored: "unread" };
  // A NEW COMPONENT WITH NO NEW TEXT OF ITS OWN: added, and what it shows is
  // in the component, which nothing here read.
  if (!a.added.length) return a.tags > 0 ? { stored: "added", texts: 0, shown: "unread" } : { stored: "none" };
  const page = rendered instanceof Map ? rendered.get(route) : null;
  const seen = page ? foldText(page.text) : "";
  const shown = [], hidden = [], unsure = [];
  for (const t of a.added) {
    const k = foldText(t.text);
    if (page && k && seen.includes(k)) shown.push(t);
    else if (page && page.complete) hidden.push(t);
    else unsure.push(t);
  }
  const base = { stored: "added", texts: a.added.length };
  if (unsure.length) return { ...base, shown: "unread", ...(hidden.length ? { hidden } : {}) };
  if (!hidden.length) return { ...base, shown: "all" };
  return { ...base, shown: shown.length ? "some" : "none", hidden };
}

/**
 * THE EVIDENCE FOR EACH COMPONENT THIS CHANGE DESIGNED, keyed the way the
 * judgment names it (`component:<name>`, `judgeItems`): the kit component or
 * the one written for the site, lowercased. A component on several routes, or
 * two designs under one name, is read on every route it names: stored "added"
 * only when every route has an addition, "none" only when none does, and the
 * least that any route showed.
 */
export function componentEvidence({ answers = [], added = null, rendered = new Map() } = {}) {
  const routes = new Map(); // name -> Set(route)
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || a.kind !== "component") continue;
    for (const v of Array.isArray(a.value) ? a.value : [a.value]) {
      if (!v || typeof v !== "object" || typeof v.page !== "string" || !v.page) continue;
      const own = Array.isArray(v.tsx) && v.tsx[0] && v.tsx[0].name;
      const kit = Array.isArray(v.components) && v.components[0];
      const name = String(own || kit || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!name) continue;
      if (!routes.has(name)) routes.set(name, new Set());
      routes.get(name).add(v.page);
    }
  }
  const rank = { all: 3, some: 2, none: 1, unread: 0 };
  const out = {};
  for (const [name, set] of routes) {
    const each = [...set].map((r) => ({ route: r, ...routeEvidence(r, added, rendered) }));
    if (each.some((e) => e.stored === "unread")) { out[name] = { stored: "unread", routes: [...set] }; continue; }
    if (each.every((e) => e.stored === "none")) { out[name] = { stored: "none", routes: [...set] }; continue; }
    if (each.some((e) => e.stored === "none")) { out[name] = { stored: "unread", routes: [...set] }; continue; }
    const worst = each.reduce((w, e) => (rank[e.shown] < rank[w] ? e.shown : w), "all");
    const hidden = each.flatMap((e) => (Array.isArray(e.hidden) ? e.hidden.map((h) => ({ ...h, route: e.route })) : []));
    out[name] = { stored: "added", shown: worst, routes: [...set], texts: each.reduce((n, e) => n + (e.texts || 0), 0), ...(hidden.length ? { hidden } : {}) };
  }
  return out;
}
