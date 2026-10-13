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
 *            with the text in the code says only that: not drawn on first
 *            load. It is NOT evidence that any visitor action draws it.
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
 * (passed in a prop, an array or a callback to a component, which decides
 * where and when to draw it), `direct` (written as an element's own text).
 * Whether it showed is the browser's answer; the placement only says where in
 * the code it sits, and neither says what a click, switch or submission does.
 *
 * WHICH COMPONENT A TEXT BELONGS TO (2026-10-13, Codex at `73772b23`) is read
 * from the code, never assumed: the component's own new instance on the page,
 * found by the module its tag is imported from, and only the texts inside it
 * (`componentEvidence`). Anything else added to the page is not the component.
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
 * WHAT EACH LOCAL NAME IN A FILE IS BOUND TO (2026-10-13, Codex's false
 * success): `Map(local → { spec, imported })` from the file's own imports,
 * read by the parser (`importsOf`). A JSX tag is tied to the module that
 * defines it, never to a guess from its spelling: `<Questions>` imported as
 * `Faq as Questions` from `@/components/ui/faq` IS the questions component,
 * and a `<Faq>` imported from somewhere else is not. Type-only imports render
 * nothing and bind nothing.
 */
function bindingsOf(P) {
  const out = new Map();
  if (!P || typeof P.importsOf !== "function") return out;
  let list = [];
  try { list = P.importsOf(P.file) || []; } catch { return out; }
  for (const im of list) {
    if (!im || typeof im.spec !== "string") continue;
    for (const b of Array.isArray(im.binds) ? im.binds : []) {
      if (b && typeof b.local === "string" && !b.typeOnly) out.set(b.local, { spec: im.spec, imported: String(b.imported || "") });
    }
  }
  return out;
}

/** The source a tag resolves to: `spec`, or `spec#Member` through a namespace; null when no import binds it. */
function sourceOf(tag, binds) {
  const s = String(tag || "");
  const [root, ...rest] = s.split(".");
  const b = binds.get(root);
  if (!b) return null;
  if (b.imported === "*") return rest.length ? b.spec + "#" + rest[0] : null;
  return b.spec;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * WHETHER A RESOLVED SOURCE IS THE NAMED COMPONENT: the module's own file name
 * (`@/components/ui/faq` → `faq`, `./booking-form.tsx` → `booking-form`), or
 * the member a namespace import names, spelling folded. A barrel
 * (`@/components/ui`) names no component, so nothing resolved through it is
 * claimed — it reads unread upstream, never present and never absent.
 */
export function sourceIs(from, name) {
  if (typeof from !== "string" || !from || !name) return false;
  const [spec, member] = from.split("#");
  const seg = spec.split("/").filter(Boolean).pop() || "";
  const file = seg.replace(/\.(tsx|ts|jsx|js|mjs)$/i, "");
  return norm(file) === norm(name) || (!!member && norm(member) === norm(name));
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
  const binds = bindingsOf(P);
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
  // THE COMPONENTS A TEXT SITS INSIDE (2026-10-13): every enclosing element
  // whose tag is a component, nearest first — so a text two components on one
  // page added can be told to the one that renders it.
  const insideOf = (stack) => {
    const got = [];
    for (let i = stack.length - 1; i >= 0; i--) {
      const n = stack[i];
      const open = n.kind === SK.JsxElement ? n.openingElement : n.kind === SK.JsxSelfClosingElement ? n : null;
      if (!open || !isComponentTag(open)) continue;
      const t = open.tagName;
      const name = String((t && typeof t.getText === "function" ? t.getText() : (t && t.escapedText)) || "");
      if (name && !got.includes(name)) got.push(name);
    }
    return got;
  };
  // THE COMPONENT INSTANCES A TEXT SITS INSIDE, BY SOURCE (2026-10-13): each
  // enclosing component element's resolved module (`from`, null when no
  // import binds it) and its own source text (`src`), so a reader can tell a
  // text inside an instance this change added from one inside an instance the
  // page already had.
  const withinOf = (stack) => {
    const got = [];
    for (let i = stack.length - 1; i >= 0; i--) {
      const n = stack[i];
      const open = n.kind === SK.JsxElement ? n.openingElement : n.kind === SK.JsxSelfClosingElement ? n : null;
      if (!open || !isComponentTag(open)) continue;
      const t = open.tagName;
      const name = String((t && typeof t.getText === "function" ? t.getText() : (t && t.escapedText)) || "");
      got.push({ tag: name, from: sourceOf(name, binds), src: source.slice(n.pos, n.end).trim() });
    }
    return got;
  };
  const stack = [];
  const walk = (n) => {
    stack.push(n);
    if (n.kind === SK.JsxText) {
      const t = String(n.text || "").replace(/\s+/g, " ").trim();
      if (t && /\p{L}/u.test(t)) out.push({ text: t, placement: placeOf(stack), inside: insideOf(stack), within: withinOf(stack) });
    } else if (n.kind === SK.StringLiteral || n.kind === SK.NoSubstitutionTemplateLiteral) {
      const t = String(n.text || "");
      if (readable(t) && !skipped(stack)) out.push({ text: t.replace(/\s+/g, " ").trim(), placement: placeOf(stack), inside: insideOf(stack), within: withinOf(stack) });
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
  const binds = bindingsOf(P);
  // EACH INSTANCE BY ITS SOURCE (2026-10-13): `from` is the module its tag is
  // imported from (null when nothing binds it), `src` the element's own text,
  // and `outer` whether no enclosing element comes from the same source — so
  // `<Accordion><AccordionItem>` is one accordion, not two.
  const open = [];
  const walk = (n) => {
    const el = n.kind === SK.JsxElement ? n.openingElement : n.kind === SK.JsxSelfClosingElement ? n : null;
    let pushed = false;
    if (el) {
      const t = el.tagName;
      const s = String((t && typeof t.getText === "function" ? t.getText() : (t && t.escapedText)) || "");
      if (/^[A-Z]/.test(s) || s.includes(".")) {
        const from = sourceOf(s, binds);
        const spec = from ? from.split("#")[0] : null;
        out.push({ tag: s, from, src: source.slice(n.pos, n.end).trim(), outer: !spec || !open.includes(from) });
        open.push(from); pushed = true;
      }
    }
    each(n, walk);
    if (pushed) open.pop();
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
  const at = (r) => { if (!byRoute.has(r)) byRoute.set(r, { read: true, added: [], tags: 0, tagNames: [], born: {} }); return byRoute.get(r); };
  const was = new Map();
  for (const f of Array.isArray(before) ? before : []) { const k = fileKey(f); if (k) was.set(k, f); }
  const textCache = new Map();
  const textsOf = (src) => { if (!textCache.has(src)) textCache.set(src, visibleTexts(src, parse)); return textCache.get(src); };
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
    // A FILE NEWLY REACHING A ROUTE IT DID NOT is all new there; a changed file
    // is compared with what it was.
    const reachOnly = same;
    const now = textsOf(f.source), nowTags = componentTags(f.source, parse);
    const then = old && !reachOnly ? textsOf(old.source) : [], thenTags = old && !reachOnly ? componentTags(old.source, parse) : [];
    for (const r of freshMaybe) at(r).read = false;
    if (!now || !then || !nowTags || !thenTags) { for (const r of fresh) at(r).read = false; continue; }
    // THE INSTANCES THIS CHANGE ADDED OR CHANGED, by their own source text, and
    // HOW MANY OF EACH SOURCE IT ADDED (outermost only): a text counts as an
    // instance's only when that instance is one of these, so text inside an
    // instance the page already had, untouched, is never this change's.
    const newSrc = new Set(less(nowTags, thenTags, (x) => (x.from || "?") + "\u0000" + x.src).map((x) => x.src));
    const born = {};
    for (const t of nowTags) if (t.outer && t.from) born[t.from] = (born[t.from] || 0) + 1;
    for (const t of thenTags) if (t.outer && t.from) born[t.from] = (born[t.from] || 0) - 1;
    const part = typeof f.name === "string" && f.name ? f.name.toLowerCase() : "";
    const fileAdded = less(now, then).map((t) => ({
      ...t,
      within: (Array.isArray(t.within) ? t.within : []).map((w) => ({ tag: w.tag, from: w.from, fresh: newSrc.has(w.src) })),
      ...(part ? { part } : {}),
    }));
    const newTags = less(nowTags, thenTags, (x) => x.tag);
    for (const r of fresh) {
      const e = at(r);
      e.added.push(...fileAdded);
      e.tags += newTags.length;
      for (const t of newTags) e.tagNames.push(t.tag);
      for (const [from, n] of Object.entries(born)) e.born[from] = (e.born[from] || 0) + n;
    }
  }
  // EVERY TEXT THE ROUTE'S FILES CARRY AFTER THE CHANGE (2026-10-13): a text
  // found on the published page proves this change's copy showed only when no
  // other copy on that route could be the one that showed. `null` when one of
  // the route's files could not be read — then a found text proves nothing.
  for (const [r, e] of byRoute) {
    let all = [];
    for (const f of Array.isArray(after) ? after : []) {
      if (!f || typeof f.source !== "string" || !routesOf(f).includes(r)) continue;
      const t = textsOf(f.source);
      if (!t) { all = null; break; }
      for (const x of t) all.push(foldText(x.text));
    }
    e.storedAll = all;
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
 * THE TEXT OF THE BUILD THAT IS PUBLISHED (2026-10-13): the repaired build's
 * own report when a repair round recompiled — its pages are the ones that go
 * out — and otherwise the first compile's. A repair that recompiled with no
 * report leaves nothing read, never the first compile's stale text.
 */
export function publishedTexts(built, repair) {
  if (repair && repair.built) return renderedTexts(repair.built.render);
  return renderedTexts(built && built.render);
}

/** Occurrences of a folded text inside a folded page, never overlapping. */
function occurrences(hay, k) {
  if (!k) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(k, i)) >= 0) { n++; i += k.length; }
  return n;
}

/**
 * HOW MUCH OF THESE ADDED TEXTS THE PAGE SHOWED AS IT FIRST LOADED.
 * `texts` are the added texts being judged, `storedAll` every folded text the
 * route's files carry (or null when one could not be read). A text counts as
 * SHOWN only when the page shows more copies of it than the route carries
 * apart from these — a heading elsewhere with the same words is not the
 * section's. A text the page does not show at all is HIDDEN on a complete
 * read. Anything in between is unread: never shown, never hidden.
 */
function shownOf(texts, page, storedAll) {
  const seen = page ? foldText(page.text) : "";
  const shown = [], hidden = [], unsure = [];
  for (const t of texts) {
    const k = foldText(t.text);
    const there = page && k ? occurrences(seen, k) : 0;
    if (page && k && there > 0) {
      const own = texts.filter((x) => foldText(x.text).includes(k)).length;
      const foreign = Array.isArray(storedAll) ? Math.max(0, storedAll.filter((x) => x.includes(k)).length - own) : null;
      if (foreign !== null && there > foreign) shown.push(t); else unsure.push(t);
    } else if (page && page.complete) hidden.push(t);
    else unsure.push(t);
  }
  return { shown, hidden, unsure };
}

/**
 * ONE ROUTE'S EVIDENCE, WHOLE (no component named): what was added there, and
 * how much of it the page showed as it first loaded.
 *   stored  "added" | "none" | "unread" ("none" only from a Map the parser
 *           made: a route no changed file reaches had nothing added)
 *   shown   "all" | "some" | "none" | "unread" (only beside stored "added")
 *   hidden  the added texts the first load did not show, each with placement
 *   texts   how many texts were added
 * A COMPONENT IS NEVER JUDGED THIS WAY (`componentEvidence`): something added
 * to its page is not, by that alone, the component.
 */
export function routeEvidence(route, added, rendered) {
  if (!(added instanceof Map)) return { stored: "unread" };
  const a = added.get(route);
  if (!a) return { stored: "none" };
  if (!a.read) return { stored: "unread" };
  if (!a.added.length) return a.tags > 0 ? { stored: "added", texts: 0, shown: "unread" } : { stored: "none" };
  return judged(a.added, rendered instanceof Map ? rendered.get(route) : null, a.storedAll);
}

function judged(texts, page, storedAll) {
  const { shown, hidden, unsure } = shownOf(texts, page, storedAll);
  const base = { stored: "added", texts: texts.length };
  if (unsure.length) return { ...base, shown: "unread", ...(hidden.length ? { hidden } : {}) };
  if (!hidden.length) return { ...base, shown: "all" };
  return { ...base, shown: shown.length ? "some" : "none", hidden };
}

/**
 * ONE COMPONENT ON ONE ROUTE (2026-10-13, Codex's false success at
 * `73772b23`): a booking form asked for on `/visit`, a writer that only
 * changed the heading, and the old reader called the form added and seen —
 * because with one component on a page, anything added there was taken to be
 * it. NOW EVERY COMPONENT MUST BE FOUND ITSELF, however many share the page:
 *   - its own new instances, by source (`sourceIs`: the module its tag is
 *     imported from, never the tag's spelling), at least one per design of it
 *     on that route — two designed cards need two new cards;
 *   - its texts are only those inside one of those new or changed instances,
 *     or in its own part file.
 * When the route was read and nothing at all was added there, it is absent
 * ("none"). When something was added but it cannot be tied to this component
 * — a heading, a text elsewhere, too few instances, an import nothing
 * resolves — it is UNREAD: never added, never missing.
 */
function componentOnRoute(name, route, designs, added, rendered) {
  if (!(added instanceof Map)) return { stored: "unread" };
  const a = added.get(route);
  if (!a) return { stored: "none" };
  if (!a.read) return { stored: "unread" };
  const born = Object.entries(a.born || {}).filter(([from]) => sourceIs(from, name)).reduce((n, [, v]) => n + v, 0);
  if (born < designs) return !a.added.length && !a.tags ? { stored: "none" } : { stored: "unread" };
  const mine = a.added.filter((t) => (Array.isArray(t.within) && t.within.some((w) => w.fresh && sourceIs(w.from, name))) || (!!t.part && norm(t.part) === norm(name)));
  if (!mine.length) return { stored: "added", texts: 0, shown: "unread" };
  return judged(mine, rendered instanceof Map ? rendered.get(route) : null, a.storedAll);
}

/**
 * THE EVIDENCE FOR EACH COMPONENT THIS CHANGE DESIGNED, keyed the way the
 * judgment names it (`component:<name>`, `judgeItems`): the kit component or
 * the one written for the site, lowercased. A component on several routes is
 * read on every route it names: stored "added" only when every route has it,
 * "none" only when none does, and the least that any route showed.
 */
export function componentEvidence({ answers = [], added = null, rendered = new Map() } = {}) {
  const routes = new Map(); // name -> Map(route -> designs)
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || a.kind !== "component") continue;
    for (const v of Array.isArray(a.value) ? a.value : [a.value]) {
      if (!v || typeof v !== "object" || typeof v.page !== "string" || !v.page) continue;
      const own = Array.isArray(v.tsx) && v.tsx[0] && v.tsx[0].name;
      const kit = Array.isArray(v.components) && v.components[0];
      const name = String(own || kit || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!name) continue;
      if (!routes.has(name)) routes.set(name, new Map());
      routes.get(name).set(v.page, (routes.get(name).get(v.page) || 0) + 1);
    }
  }
  const rank = { all: 3, some: 2, none: 1, unread: 0 };
  const out = {};
  for (const [name, per] of routes) {
    const list = [...per.keys()];
    const each = list.map((r) => ({ route: r, ...componentOnRoute(name, r, per.get(r), added, rendered) }));
    if (each.some((e) => e.stored === "unread")) { out[name] = { stored: "unread", routes: list }; continue; }
    if (each.every((e) => e.stored === "none")) { out[name] = { stored: "none", routes: list }; continue; }
    if (each.some((e) => e.stored === "none")) { out[name] = { stored: "unread", routes: list }; continue; }
    const worst = each.reduce((w, e) => (rank[e.shown] < rank[w] ? e.shown : w), "all");
    const hidden = each.flatMap((e) => (Array.isArray(e.hidden) ? e.hidden.map((h) => ({ text: h.text, placement: h.placement, route: e.route })) : []));
    out[name] = { stored: "added", shown: worst, routes: list, texts: each.reduce((n, e) => n + (e.texts || 0), 0), ...(hidden.length ? { hidden } : {}) };
  }
  return out;
}
