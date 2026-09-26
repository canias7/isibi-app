// A full writer may change targeted prose, not silently discard its neighbors.
// Reuse the edit path's parser. No persisted IDs, model verdict or extra call.
// Headings/ids locate a request's target; actual text identities establish
// preservation. Unknown targeting fails closed only when text would be lost.
import { tweakParser } from "./site-tweak.mjs";
import { routeOf } from "./site-addon.mjs";
import { navSlots } from "./site-nav.mjs";
import { KIT_HEADINGS } from "./kit-headings.mjs";

const space = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const name = (s) => space(s).normalize("NFKC").toLowerCase().replace(/[“”‘’"']/g, "");
const words = s => space(s.replace(/[^\p{L}\p{N}#-]+/gu, " "));
const contains = (s, part) => (" " + words(s) + " ").includes(" " + words(part) + " ");

export const PROSE_WITHHELD = "I couldn't confirm that this page change preserves text outside the requested target, so I didn't publish this change. Please identify the section by its unique heading or quote the exact text to change or remove.";

// ── A SECTION HEADED BY THE KIT (2026-09-26, owner) ─────────────────────────
// "Remove the ‘Today’s bake’ section from the home page." was refused with a
// correct answer: the section's heading is `<SectionHeader title="Today's
// bake" />`, which a visitor sees as an `<h2>`, and a section was named only
// by a LITERAL `<h1>`–`<h6>`. The owner reproduced it independently: refused
// with SectionHeader's `title`, accepted with the equivalent literal `<h2>`.
//
// So a section is also named by a kit component's heading — only where all of
// this is established, and anything short of it is UNCERTAIN, which names
// nothing and so authorizes nothing:
//   - WHICH COMPONENT is the page's own import, never the tag's spelling:
//     `@/components/ui/<module>` (the template's one path alias), by name,
//     under any alias (`SectionHeader as Heading`) or namespace (`UI.Hero`).
//     A default import, a type-only import, a local component that happens to
//     be called SectionHeader, and a name the page declares again are not it.
//   - WHICH PROP heads it comes from `kit-headings.mjs`, generated from each
//     component's own source: the prop it always shows whole in a visible
//     `<h1>`/`<h2>`. A `title` on any other component is not a heading.
//   - THE VALUE is a literal (`title="…"` or `title={"…"}`), given once, on an
//     element with no spread (which could carry the prop) and nothing hiding
//     it. A computed title's words are not known here.
//   - IT RENDERS WHENEVER ITS SECTION DOES (2026-09-26, owner: "A heading that
//     cannot be established as rendering must not authorize deletion of
//     visible siblings"). `{false && <SectionHeader title="Today's bake" />}`,
//     one inside `<div hidden>` and one inside an unknown `<Opaque>` all named
//     their section, and deleting the section took the visible paragraphs
//     beside them. So every step between the heading and its section must be
//     a fragment or a plain HTML element that shows its children
//     (`SHOWS_CHILDREN`) with nothing that could hide it (`mayHide`). A braced
//     expression — a condition, a `.map`, a prop value — or a component, a
//     member tag, `<details>`, `<template>` and the rest is not established.
//     The section's own attributes are not asked: they show or hide the
//     heading and its neighbours together.
//   - IT OPENS ITS SECTION: nothing that could show a heading comes before it
//     there — no `<h1>`–`<h6>` and no other component. A visitor names a
//     section by the heading it starts with; a second kit heading further down
//     (a widget's own title, a closing call to action) names that part, not
//     the section around it. (The literal reader keeps its own rule.)
//   - IT NAMES THE WHOLE SECTION AND NOTHING NARROWER: "the X section" and
//     "X". Its words are a prop, not prose this check reads, so "the X
//     heading" and "the text under X" cannot be tied to any line here; they
//     still count as a mention, so a name two headings share grants nothing.
const KIT_SPEC = /^@\/components\/ui\/([a-z0-9-]+)(?:\.tsx)?$/;
const DECLARES = /^(?:VariableDeclaration|Parameter|BindingElement|FunctionDeclaration|FunctionExpression|ClassDeclaration|ClassExpression|EnumDeclaration|ModuleDeclaration|ImportEqualsDeclaration|TypeAliasDeclaration|InterfaceDeclaration)$/;
/** The JSX tags on this page that are one of the kit's section headings: tag → the prop it shows. */
function kitHeadingTags(file, importsOf, k) {
  const tags = new Map();
  if (typeof importsOf !== "function") return tags;
  let imports;
  try { imports = importsOf(file); } catch { return tags; }
  if (!Array.isArray(imports)) return tags;
  const bound = new Map();
  for (const imp of imports) for (const b of Array.isArray(imp?.binds) ? imp.binds : []) {
    if (b && typeof b.local === "string") bound.set(b.local, (bound.get(b.local) || 0) + 1);
  }
  for (const imp of imports) {
    const m = KIT_SPEC.exec(String(imp?.spec ?? ""));
    const table = m && Object.hasOwn(KIT_HEADINGS, m[1]) ? KIT_HEADINGS[m[1]] : null;
    if (!table) continue;
    for (const b of Array.isArray(imp.binds) ? imp.binds : []) {
      if (!b || b.typeOnly || typeof b.local !== "string" || !b.local || bound.get(b.local) !== 1) continue;
      if (b.imported === "*") {
        for (const comp of Object.keys(table)) tags.set(b.local + "." + comp, table[comp].prop);
      } else if (typeof b.imported === "string" && Object.hasOwn(table, b.imported)) {
        // A default import binds "default", which no table key can be: the
        // table holds exported function names, and "default" is not a name.
        tags.set(b.local, table[b.imported].prop);
      }
    }
  }
  if (!tags.size) return tags;
  // A NAME THE PAGE DECLARES AGAIN may be something else where it is drawn.
  const declared = new Set();
  const walk = (n) => {
    if (DECLARES.test(k(n)) && n.name && k(n.name) === "Identifier") declared.add(n.name.text);
    n.forEachChild(walk);
  };
  walk(file);
  for (const tag of [...tags.keys()]) if (declared.has(tag.split(".")[0])) tags.delete(tag);
  return tags;
}
// A class that can take an element off the screen at any breakpoint or state
// (`hidden`, `sm:hidden`, `group-hover:invisible`, `sr-only`) — the kit
// table's own rule. `overflow-hidden` is not one.
const HIDING_CLASS = /(?:^|[\s"'`:])(?:hidden|invisible|sr-only)(?=$|[\s"'`])/;
// The HTML elements that show their children in the page's normal flow. A
// kit heading inside anything else is not established as rendering.
const SHOWS_CHILDREN = new Set(["div", "span", "header", "footer", "main", "nav", "aside", "hgroup", "figure", "figcaption", "blockquote", "address", "p", "ul", "ol", "li", "dl", "dt", "dd", "a", "strong", "em", "b", "i", "small", "label", "form", "fieldset"]);
/** Whether an element's attributes could keep it off the screen — or cannot be read, which is the same answer. */
function mayHide(attrs, k) {
  for (const a of attrs) {
    if (k(a) === "JsxSpreadAttribute") return true;
    const key = a.name?.getText?.();
    if (key === "hidden" || key === "aria-hidden" || key === "style" || key === "popover") return true;
    if (key !== "className" && key !== "class") continue;
    // A class is read only as a quoted string (`"…"` or `{"…"}`), as the title
    // is; anything else — computed, a template — cannot be.
    const init = a.initializer, e = init && k(init) === "JsxExpression" ? init.expression : init;
    if (!e || k(e) !== "StringLiteral" || HIDING_CLASS.test(e.text)) return true;
  }
  return false;
}
/**
 * The literal words a kit heading element shows for `prop`, or null when they
 * are not certain. Asked only once `mayHide` has cleared the element, which
 * also refuses a spread — the one attribute that could carry the prop unseen.
 */
function kitHeadingText(attrs, prop, k) {
  let value = null, seen = 0;
  for (const a of attrs) {
    const key = a.name?.getText?.();
    if (key !== prop) continue;
    seen++;
    const init = a.initializer;
    value = init && k(init) === "StringLiteral" ? init.text
      : init && k(init) === "JsxExpression" && init.expression && k(init.expression) === "StringLiteral" ? init.expression.text
      : null;
  }
  return seen === 1 && typeof value === "string" ? value : null;
}

/** Literal JSX prose, tied to its nearest section, and never read from comments. */
export function proseInventory(source, parse) {
  const { file, k, isJsx, tagOf, openOf, attrsOf, importsOf } = parse(source);
  if (file.parseDiagnostics?.length) throw new Error("unparsed");
  const kitTags = kitHeadingTags(file, importsOf, k);
  const blocks = [], atoms = [];
  // `names` is every name a block answers to; `literal` the ones read off its
  // own literal headings, id or label, `kit` the one a kit heading gives it.
  // `before` is where each thing that could show a heading ends, in order.
  const root = { names: [], literal: [], kit: [], before: [], atoms: [], section: false };
  blocks.push(root);
  const context = (node) => {
    const out = [];
    for (let p = node.parent, child = node; p; child = p, p = p.parent) {
      const kind = k(p);
      if (/^(FunctionDeclaration|FunctionExpression|ArrowFunction)$/.test(kind)) {
        out.push("function:" + (p.name?.getText?.() || p.parent?.name?.getText?.() || "anonymous"));
      }
      if (kind === "ConditionalExpression") out.push(p.condition.getText() + (child === p.whenTrue ? ":yes" : ":no"));
      if (kind === "BinaryExpression" && /^(?:&&|\|\||\?\?)$/.test(p.operatorToken.getText())) out.push(p.left.getText() + p.operatorToken.getText());
      if (isJsx(p)) for (const a of attrsOf(openOf(p))) {
        const key = a.name?.getText?.(), value = a.initializer?.getText?.() || "true";
        if (["hidden", "aria-hidden", "style"].includes(key) || (key === "className" && /\b(?:hidden|invisible|sr-only)\b/.test(value))) out.push(key + ":" + value);
      }
    }
    return out.join("|");
  };
  const named = (block, n) => { block.names.push(n); block.literal.push(n); };
  // A kit heading renders whenever its section does: nothing on it may hide
  // it, and every step up to the section is a fragment or a plain element that
  // shows its children with nothing hiding it. The first step that is anything
  // else — a braced expression, a component, `<details>` — ends the answer.
  // A heading outside every section never meets one, and names nothing.
  const rendersWith = (node, block) => {
    if (mayHide(attrsOf(openOf(node)), k)) return false;
    for (let p = node.parent; p; p = p.parent) {
      if (p === block.node) return true;
      if (k(p) === "JsxFragment") continue;
      if (k(p) !== "JsxElement" || !SHOWS_CHILDREN.has(tagOf(p)) || mayHide(attrsOf(openOf(p)), k)) return false;
    }
    return false;
  };
  const visit = (node, block, heading = false, role = "") => {
    if (isJsx(node)) {
      const tag = tagOf(node);
      if (tag === "section" || tag === "article") {
        block = { names: [], literal: [], kit: [], before: [], atoms: [], section: true, anchor: "", node };
        blocks.push(block);
        for (const a of attrsOf(openOf(node))) {
          const key = a.name?.getText?.(), value = a.initializer?.text;
          if (typeof value !== "string") continue;
          if (key === "id" || key === "aria-label") named(block, name(value));
          if (key === "id" || (key === "className" && !block.anchor)) block.anchor = key + ":" + value;
          if (key === "className" && value.split(/\s+/).includes("hero")) named(block, "hero");
        }
      }
      if (kitTags.has(tag)) {
        // Only a heading that OPENS its section names it: nothing that could
        // show a heading ends before this element starts. A wrapper around it
        // ends after it, so it never counts against it. And only one that
        // renders whenever the section does.
        const start = node.getStart();
        const text = rendersWith(node, block) ? kitHeadingText(attrsOf(openOf(node)), kitTags.get(tag), k) : null;
        const n = text === null ? "" : name(text);
        if (n && !block.before.some((end) => end <= start)) { block.names.push(n); block.kit.push(n); }
      }
      // A component is a capitalised tag or a member of one (`ui.Hero` too).
      if (/^h[1-6]$/.test(tag) || /^[A-Z]/.test(tag) || tag.includes(".")) block.before.push(node.end);
      heading = /^h[1-6]$/.test(tag);
      role = tag;
    }
    let text = null;
    if (k(node) === "JsxText") text = space(node.text);
    // Braced literal words are prose; arbitrary computations are not guessed.
    if (k(node) === "StringLiteral" && k(node.parent) === "JsxExpression") text = space(node.text);
    if (text) {
      const atom = { text, block, heading, role, context: context(node) };
      atoms.push(atom); block.atoms.push(atom);
      if (heading) named(block, name(text));
    }
    node.forEachChild((c) => visit(c, block, heading, role));
  };
  visit(file, root);
  const uniq = (list) => [...new Set(list.filter(Boolean))];
  for (const b of blocks) { b.names = uniq(b.names); b.literal = uniq(b.literal); b.kit = uniq(b.kit); }
  return { blocks, atoms };
}

// ── A PAGE THE REQUEST NAMES (2026-09-25, owner) ────────────────────────────
// "Remove the ‘…’ section from the home page." and "On the home page, change
// the text under ‘…’ to …" are ordinary sentences, and both were refused with
// a correct answer: the page qualifier was read as part of the target, which
// then matched nothing. A qualifier is now read as what it is — WHICH PAGE —
// and it must be the page this edit changes. It is never a target itself, and
// one that names another page, or a page this check cannot confirm, grants
// nothing, so a qualifier can only ever narrow what a sentence authorizes.
//
// ⚠ AND A PAGE THIS CHECK CANNOT READ MAY NOT DROP OUT OF THE SENTENCE UNREAD
// (2026-09-25, owner). "Remove the ‘Chords’ section on ‘/menu’." published on
// the home page: the quote was shielded, so no page was seen there, and the
// target then ended at "on" and the address went with the rest. "On the Lesson
// Prices page" and "on ‘Gear Board’" went the same way. So a PAGE OPERAND is
// whatever stands after a page preposition and names a page — a quote, an
// address, a web address or words ending in "page(s)" — and every one must be
// confirmed as the page being edited or the clause grants nothing. A quoted
// name that is not recognisably a page is ambiguous in that position and
// grants nothing too, unless the preposition is a form's own ("the text in
// ‘Hours’" names a section). Only a quote STANDING in the page position is
// read: quoted replacement copy ("…to ‘See the menu page.’") stays copy.
// NOT "to": it already ends the target operand, and a page after it is a
// destination or replacement wording ("…then go to the gear page"), never a
// target, so reading it as a qualifier could only refuse a valid request.
const QUAL_PREP = String.raw`on|in|from|off|of|for|at`;
// A page's own name never runs across another preposition, so one qualifier
// cannot swallow the next.
const QUAL_STOP = String.raw`(?:on|in|from|off|of|for|at|to|into|onto|with|as|by|under|over|above|below|before|after|beside|between|than|like)\b`;
const QUAL_DET = /^(the|this|that|my|our)\s+/;
const FORM_WORD = /(?:^|\s)(?:line|paragraph|sentence|text|words)\s+$/;
const HOME_PAGE = /^(?:home[ -]?page|front page|main page|landing page|index page)$/;
const routeKey = (r) => "/" + String(r).trim().toLowerCase().replace(/^\/+|\/+$/g, "");

// ── THE SITE'S OWN PAGE NAMES (2026-09-25, owner) ───────────────────────────
// "Remove the ‘Chords’ section on the menu." published on the home page of a
// site that has a /menu page: nothing here knew "the menu" was a page, so the
// target ended at "on" and the page went with the rest. A page is named by the
// words the site itself uses for it — the name the builder's page picker shows
// (its last address segment: /lesson-prices is "Lesson prices", / is "Home")
// and every label the site's own menu links to it with ("Gear Board" → /gear).
// Read off the site's pages, never guessed, so no phrase list grows here.
//
// A NAME TWO PAGES SHARE NAMES NEITHER, and the clause grants nothing.
// A MENU ITEM WITH AN ANCHOR names a section ("Hours" → /#hours), not a page.
// A COMPONENT FILE (-parts/) is not a page.
// Words that name no page on the site are not read as one: "at the top" and
// "on the left" say where, not which page.
// A mark between two letters is an apostrophe, part of the word it sits in.
const APOSTROPHE = /(?<=[\p{L}\p{N}])['’](?=[\p{L}\p{N}])/gu;
const pageWords = (s) => String(s ?? "").normalize("NFKC").toLowerCase()
  .replace(APOSTROPHE, "").match(/[\p{L}\p{N}]+/gu) || [];
/** A page name as words: case, apostrophes, hyphens and a leading "the" folded. */
export function pageKey(s) {
  const w = pageWords(s);
  if (w[0] === "the") w.shift();
  return w.join(" ");
}
/** Every name the site gives each of its pages: name → the routes it names. */
export function sitePageNames(pages) {
  const names = new Map();
  const add = (label, route) => {
    const k = pageKey(label);
    if (!k) return;
    if (!names.has(k)) names.set(k, new Set());
    names.get(k).add(routeKey(route));
  };
  const list = Array.isArray(pages) ? pages : [];
  for (const p of list) {
    const r = p && typeof p.path === "string" ? routeOf(p.path) : "";
    if (!r || /(^|\/)-/.test(r.slice(1))) continue;
    add(r === "/" ? "home" : r.split("/").pop(), r);
  }
  for (const slot of navSlots(list)) for (const item of slot.items) {
    const href = String(item.href || "");
    if (!href.startsWith("/") || href.startsWith("//") || /[#?]/.test(href)) continue;
    add(item.label, href);
  }
  return names;
}
/** The longest site page name the clause spells from `from`, with where it ends. */
function nameAt(clause, from, names) {
  const word = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  word.lastIndex = from;
  const said = [];
  let best = null, at = from, m;
  while (said.length < 8 && (m = word.exec(clause))) {
    // A name runs across spaces and joiners, never across punctuation.
    if (!/^[\s\-_&+\/]*$/.test(clause.slice(at, m.index))) break;
    said.push(m[0]);
    at = m.index + m[0].length;
    const routes = names.get(pageKey(said.join(" ")));
    if (routes) best = { end: at, routes };
  }
  return best;
}
const pageName = (n) => n.startsWith("/") || /pages?$/.test(n);

/** Whether a page named in a request is the page being edited. Cannot-tell is no. */
function samePage(named, page, det = "", names = null) {
  const n = space(named).toLowerCase().replace(/[.,;:!?]+$/, "");
  // "this page", "the page": they can only mean the page being edited. "That
  // page" points back at a page named somewhere else, so it cannot be confirmed.
  if (n === "page") return det !== "that";
  if (typeof page !== "string" || !page.trim()) return false;
  const have = routeKey(page);
  if (HOME_PAGE.test(n)) return have === "/";
  if (n.startsWith("/")) return have === routeKey(n);
  const m = /^(.+) page$/.exec(n);
  // A NAME THE SITE GIVES A PAGE is that page, and only that page: "the Lesson
  // Prices page" is /prices where the site's menu says so. A name two pages
  // share names neither.
  const routes = names && names.get(pageKey(m ? m[1] : n));
  if (routes) return routes.size === 1 && routes.has(have);
  // "the menu page" is the page whose address ends in /menu.
  const seg = m && /^[a-z0-9][a-z0-9-]*$/.test(m[1]) ? m[1] : "";
  return !!seg && have.split("/").pop() === seg;
}

/**
 * Every page a clause names in the qualifier position, with where it stands and
 * whether it is the page being edited. `token` is the quote shield's own word;
 * `names` is the site's own page names, or null when the site was not read.
 */
function pageQualifiers(clause, token, quotes, page, names = null) {
  const re = new RegExp(String.raw`(^|\s)(${QUAL_PREP})\s+(?:(the|this|that|my|our)\s+)?`
    + String.raw`(${token}(\d+)(?:\s+(pages?))?|https?:\/\/\S*|\/\S*|(?:(?!${QUAL_STOP})\S+\s+)*?\S*?pages?)(?=$|[\s,.;:!?])`, "g");
  const found = [];
  for (const m of clause.matchAll(re)) {
    const [whole, lead, prep, det = "", operand, quote, suffix] = m;
    const start = m.index + lead.length;
    // A web address is read so it cannot drop out; `samePage` never confirms
    // one, its host being one this check cannot see.
    let named = operand, words = det;
    if (quote !== undefined) {
      // A QUOTE IN THE PAGE POSITION: ‘/menu’, ‘the home page’, the ‘Menu’ page.
      named = name(quotes[Number(quote)]).replace(/[.,;:!?]+$/, "");
      const d = QUAL_DET.exec(named);
      if (d) { words = d[1]; named = named.slice(d[0].length); }
      if (suffix) named += " " + suffix;
      else if (!pageName(named)) {
        // A form's own preposition names a section: "the text in ‘Hours’".
        if ((prep === "in" || prep === "of") && FORM_WORD.test(clause.slice(0, start))) continue;
        // ‘Gear Board’ is a page where the site calls one that; any other
        // quote in this position cannot be told from one and grants nothing.
        if (!names || !names.has(pageKey(named))) named = null;
      }
    }
    found.push({ start, end: m.index + whole.length, same: named !== null && samePage(named, page, words, names) });
  }
  // A PAGE THE SITE NAMES, with no "page" after it: "on the menu", "from Gear
  // Board". The longest name the site has wins, and a form's own preposition
  // still names a section ("the text in Hours").
  if (names && names.size) {
    const have = typeof page === "string" && page.trim() ? routeKey(page) : null;
    const at = new RegExp(String.raw`(^|\s)(${QUAL_PREP})\s+`, "g");
    for (const m of clause.matchAll(at)) {
      const start = m.index + m[1].length;
      if (found.some((q) => start >= q.start && start < q.end)) continue;
      if ((m[2] === "in" || m[2] === "of") && FORM_WORD.test(clause.slice(0, start))) continue;
      const hit = nameAt(clause, m.index + m[0].length, names);
      if (hit) found.push({ start, end: hit.end, same: !!have && hit.routes.size === 1 && hit.routes.has(have) });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// This is a deliberately small, explicit request grammar, not a language model
// assurance. Quoted new wording/destinations cannot grant permission to a second
// section. Negations, vague targets and duplicate names do not grant a scope.
function permissions(message, before, pairs, page, names = null) {
  const allowed = new Set(), protectedBlocks = new Set();
  // Quoted copy is data, even when it contains punctuation or commands.
  //
  // AN APOSTROPHE IS NOT A QUOTE MARK (2026-09-25). Between two letters the
  // mark is part of a word — "We’re", "Fred's", "it’s" — and a phone types the
  // same ’ that closes a ‘quote’. Read as a quote it cut ‘We’re open late’ at
  // "We", left a stray mark, and the whole message granted nothing with the
  // correct answer in hand. So a single quote closes only on a mark no letter
  // follows — an unclosed ‘We’re open late still grants nothing, as any
  // unclosed quote does — and a stray mark is looked for with the apostrophes
  // out of the way.
  const quotes = [];
  let token = "quotedtoken";
  while (String(message).toLowerCase().includes(token)) token += "x";
  const shielded = String(message).replace(/"([^"\n]*)"|“([^”\n]*)”|‘((?:[^’\n]|’(?=[\p{L}\p{N}]))*)’(?![\p{L}\p{N}])|'((?:[^'\n]|'(?=[\p{L}\p{N}]))*)'(?![\p{L}\p{N}])/gu,
    (_, ...groups) => `${token}${quotes.push(groups.slice(0, 4).find(x => x !== undefined)) - 1}`);
  if (/["“”‘’]|(?:^|\s)'|'(?:\s|$)/.test(shielded.replace(APOSTROPHE, ""))) return allowed;
  const expand = s => s.replace(new RegExp(token + "(\\d+)", "g"), (_, i) => quotes[Number(i)]);
  const clauses = shielded.split(/[;!?]|\.(?:\s|$)|(?:,?\s+(?:and|but)\s+)(?=(?:please\s+)?(?:change|rewrite|reword|update|show|rename|replace|remove|delete|take|keep|leave|preserve|make|move|put|do\b|don't\b))/i);
  const resolve = object => {
    // Complete noun phrases only: a mention is not an authorization.
    const n = name(expand(object)).replace(/^the\s+/, "");
    const hits = [];
    for (const block of before.blocks.filter(b => b.section)) for (const label of block.names) {
      // "The text under X" is the paragraph under X, with the same exact scope:
      // one paragraph or no grant at all.
      const forms = [[label, "all"], [label + " section", "all"], [label + " heading", "heading"], [label + " title", "heading"],
        ...["line", "paragraph", "sentence", "text", "words"].flatMap(role => ["under", "in", "of"].map(prep => [role + " " + prep + " " + label, "line"]))];
      // A KIT HEADING names the whole section and nothing narrower: its words
      // are a prop, so "the X heading" or "the text under X" is a mention
      // ("none") that still makes a shared name ambiguous and grants nothing.
      const literal = block.literal.includes(label), kit = block.kit.includes(label);
      for (const [phrase, scope] of forms) if (n === phrase) {
        if (scope === "all" || literal) hits.push({ block, scope });
        if (scope !== "all" && kit) hits.push({ block, scope: "none" });
      }
    }
    const unique = hits.filter((h, i) => hits.findIndex(x => x.block === h.block && x.scope === h.scope) === i);
    return unique.length === 1 && unique[0].scope !== "none" ? unique[0] : null;
  };
  // The qualifiers taken out of the text they stand in. Used only once every
  // qualifier in the clause has been confirmed as the page being edited.
  const unqualified = (s) => {
    let out = "", at = 0;
    for (const q of pageQualifiers(s, token, quotes, page, names)) { out += s.slice(at, q.start) + " "; at = q.end; }
    return space(out + s.slice(at));
  };
  for (let clause of clauses) {
    clause = space(clause).toLowerCase().replace(/^please\s+/, "");
    // EVERY PAGE THE CLAUSE NAMES MUST BE THIS PAGE, or the clause grants
    // nothing. A leading "On the home page," then stops standing in front of
    // the verb, and the qualifiers are taken out of the operand below.
    const quals = pageQualifiers(clause, token, quotes, page, names);
    if (quals.some((q) => !q.same)) continue;
    if (quals.length && quals[0].start === 0) clause = clause.slice(quals[0].end).replace(/^\s*[,:]?\s*/, "");
    const action = /^(change|rewrite|reword|update|show|rename|replace|remove|delete|take|make)\s+(.+)$/.exec(clause);
    if (!action) continue;
    if (/\b(?:not|never|dont|don't|except|unless|without|keep|leave|preserve|keeping|leaving)\b/.test(clause)) {
      const group = /^(?:remove|delete|take) (?:all|every)(?: the)? sections? (?:off(?: the home page)? )?except (?:the )?(.+)$/.exec(clause);
      const except = group && resolve(group[1]);
      if (!except) continue;
      protectedBlocks.add(except.block);
      for (const b of before.blocks) if (b.section && b !== except.block) for (const atom of b.atoms) allowed.add(atom);
      continue;
    }
    // operation + exact target/list + optional reference/result. Reference and
    // result operands never supply targets; unknown target grammar fails closed.
    // THE PAGE QUALIFIER IS NOT PART OF THE TARGET: taken out of the operand
    // before the target is read, so "the X section from the home page" is the X
    // section and nothing after the qualifier can become a target.
    const operand = unqualified(action[2]);
    const object = operand.split(/\s+(?:to|as|into|with|so that|above|below|before|after|beside|like|compared to|relative to|at|on|off)\s+/)[0];
    const targets = object.split(/\s+and\s+/).map(resolve);
    const matched = targets.every(Boolean) ? targets : [];
    for (const { block, scope } of matched) {
      // Naming where a link/photo/form lives does not authorize its prose.
      if (/\b(?:links?|photos?|pictures?|images?|forms?|buttons?|components?)\b/.test(object)) continue;
      // Rewording is not permission to remove the whole section. A unique
      // surviving target needs actual replacement prose, not just its heading.
      const removing = /^(?:remove|delete)\b|^take\b.*\b(?:off|out)\b/.test(clause);
      if (!removing) {
        const peer = pairs.get(block);
        if (!peer || (block.atoms.some(a => !a.heading) && !peer.atoms.some(a => !a.heading))) continue;
      }
      // A request for a heading grants only the heading, not its paragraphs.
      const headingOnly = scope === "heading";
      const lineOnly = scope === "line";
      const candidates = block.atoms.filter(a => headingOnly ? a.heading : lineOnly ? a.role === "p" : true);
      if ((headingOnly || lineOnly) && candidates.length !== 1) continue;
      for (const a of candidates) allowed.add(a);
    }
    // A quoted sentence can target itself even outside a semantic section.
    const exactObject = name(expand(object)).replace(/^(?:the\s+)?(?:text|words|heading|title)\s+/, "").replace(/^the\s+/, "");
    for (const a of before.atoms) {
      if (a.text.length < 4 || exactObject !== name(a.text)) continue;
      if (before.atoms.filter(x => name(x.text) === name(a.text)).length !== 1) continue;
      const removing = /^(?:remove|delete)\b|^take\b.*\b(?:off|out)\b/.test(clause);
      const replacement = name(expand(unqualified(clause).match(/\s+to\s+(?:say\s+)?(.+)$/)?.[1] || ""));
      if (removing || (replacement && pairs.get(a.block)?.atoms.some(x => name(x.text).replace(/[.!?]+$/, "") === replacement.replace(/[.!?]+$/, "")))) allowed.add(a);
    }
  }
  // An explicit preservation clause wins over a surrounding rewrite/removal.
  // In particular, splitting "but keep ..." must not discard the constraint.
  for (let clause of clauses) {
    clause = name(expand(clause)).replace(/^please\s+/, "");
    if (!/^(?:keep|leave|preserve|do not|dont)\b/.test(clause)) continue;
    for (const a of before.atoms) {
      if (contains(clause, name(a.text)) || a.block.names.some(n => contains(clause, n))) allowed.delete(a);
    }
  }
  for (const block of protectedBlocks) for (const atom of block.atoms) allowed.delete(atom);
  return allowed;
}

const identity = a => JSON.stringify([a.text, a.context]);
const content = b => JSON.stringify(b.atoms.map(identity));
// Pair whole preserved blocks first, regardless of order. Then unique source
// anchors/names locate changed blocks; equality of those is NEVER preservation
// evidence: every literal in the paired block is still checked below. Finally
// an unchanged, unique body can pair a renamed heading. No positional guess.
function pairBlocks(before, after) {
  const pairs = new Map([[before.blocks[0], after.blocks[0]]]);
  const used = new Set([after.blocks[0]]);
  const bs = before.blocks.slice(1), as = after.blocks.slice(1);
  for (const b of bs) {
    const a = as.find(x => !used.has(x) && content(x) === content(b));
    if (a) { pairs.set(b, a); used.add(a); }
  }
  const unique = key => {
    for (const b of bs) {
      if (pairs.has(b)) continue;
      for (const value of key(b)) {
        if (!value || bs.filter(x => key(x).includes(value)).length !== 1) continue;
        const candidates = as.filter(x => key(x).includes(value));
        if (candidates.length === 1 && !used.has(candidates[0])) {
          pairs.set(b, candidates[0]); used.add(candidates[0]); break;
        }
      }
    }
  };
  unique(b => [b.anchor]);
  unique(b => b.names);
  unique(b => b.atoms.some(a => !a.heading) ? [JSON.stringify(b.atoms.filter(a => !a.heading).map(identity))] : []);
  return pairs;
}

/**
 * No missing parser/read is ever treated as an empty inventory. `page` is the
 * route this edit changes; `pages` is the site's pages, whose names a request
 * may use for a page ("on the menu").
 */
export async function preservePageProse({ before, after, message, parse, page, pages }) {
  if (before === after) return { ok: true };
  try {
    const reader = parse === undefined ? await tweakParser() : parse;
    if (typeof reader !== "function") return { ok: false, why: "no-parser" };
    const b = proseInventory(before, reader), a = proseInventory(after, reader);
    const pairs = pairBlocks(b, a);
    const lost = [];
    for (const block of b.blocks) {
      const remaining = (pairs.get(block)?.atoms || []).slice();
      for (const atom of block.atoms) {
        const i = remaining.findIndex(x => identity(x) === identity(atom));
        if (i >= 0) remaining.splice(i, 1); else lost.push(atom);
      }
    }
    if (!lost.length) return { ok: true };
    const allowed = permissions(message, b, pairs, page, Array.isArray(pages) ? sitePageNames(pages) : null);
    const blocked = lost.filter(x => !allowed.has(x));
    return blocked.length ? { ok: false, why: "unconfirmed-target", blocked: blocked.map(x => x.text).slice(0, 6) } : { ok: true };
  } catch {
    return { ok: false, why: "unparsed" };
  }
}
