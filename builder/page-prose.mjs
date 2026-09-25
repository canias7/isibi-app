// A full writer may change targeted prose, not silently discard its neighbors.
// Reuse the edit path's parser. No persisted IDs, model verdict or extra call.
// Headings/ids locate a request's target; actual text identities establish
// preservation. Unknown targeting fails closed only when text would be lost.
import { tweakParser } from "./site-tweak.mjs";

const space = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const name = (s) => space(s).normalize("NFKC").toLowerCase().replace(/[“”‘’"']/g, "");
const contains = (s, part) => (" " + s.replace(/[^\p{L}\p{N}#-]+/gu, " ") + " ")
  .includes(" " + part.replace(/[^\p{L}\p{N}#-]+/gu, " ") + " ");

export const PROSE_WITHHELD = "I couldn't confirm that this page change preserves text outside the requested target, so I didn't publish this change. Please identify the section by its unique heading or quote the exact text to change or remove.";

/** Literal JSX prose, tied to its nearest section, and never read from comments. */
export function proseInventory(source, parse) {
  const { file, k, isJsx, tagOf, openOf, attrsOf } = parse(source);
  if (file.parseDiagnostics?.length) throw new Error("unparsed");
  const blocks = [], atoms = [];
  const root = { names: [], atoms: [], section: false };
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
  const visit = (node, block, heading = false, role = "") => {
    if (isJsx(node)) {
      const tag = tagOf(node);
      if (tag === "section" || tag === "article") {
        block = { names: [], atoms: [], section: true, anchor: "" };
        blocks.push(block);
        for (const a of attrsOf(openOf(node))) {
          const key = a.name?.getText?.(), value = a.initializer?.text;
          if (typeof value !== "string") continue;
          if (key === "id" || key === "aria-label") block.names.push(name(value));
          if (key === "id" || (key === "className" && !block.anchor)) block.anchor = key + ":" + value;
          if (key === "className" && value.split(/\s+/).includes("hero")) block.names.push("hero");
        }
      }
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
      if (heading) block.names.push(name(text));
    }
    node.forEachChild((c) => visit(c, block, heading, role));
  };
  visit(file, root);
  for (const b of blocks) b.names = [...new Set(b.names.filter(Boolean))];
  return { blocks, atoms };
}

// This is a deliberately small, explicit request grammar, not a language model
// assurance. Quoted new wording/destinations cannot grant permission to a second
// section. Negations, vague targets and duplicate names do not grant a scope.
function permissions(message, before, pairs) {
  const allowed = new Set();
  const clauses = String(message).split(/[;!?]|\.(?:\s|$)|(?:,?\s+(?:and|but)\s+)(?=(?:please\s+)?(?:change|rewrite|reword|update|show|rename|replace|remove|delete|take|keep|leave|make|move|put|do\b|don't\b))/i);
  for (let clause of clauses) {
    clause = name(clause).replace(/^please\s+/, "");
    if (!/^(change|rewrite|reword|update|show|rename|replace|remove|delete|take|make)\b/.test(clause)) continue;
    if (/\b(?:not|never|dont|don't|except|unless|without)\b/.test(clause)) {
      // The existing explicit group-deletion control, with a unique exception.
      const group = /^(?:remove|delete|take) (?:all|every)(?: the)? sections? (?:off(?: the home page)? )?except (?:the )?(.+)$/.exec(clause);
      if (!group) continue;
      const except = before.blocks.filter(b => b.section && b.names.includes(group[1]));
      if (except.length !== 1) continue;
      for (const b of before.blocks) if (b.section && b !== except[0]) for (const a of b.atoms) allowed.add(a);
      continue;
    }
    // Only the object before a replacement/result clause is a target.
    const object = clause.split(/\s+(?:to|as|into|with|so that)\s+/)[0];
    if (/\b(?:keep|leave|preserve|keeping|leaving)\b/.test(object)) continue;
    const matched = new Map();
    for (const b of before.blocks) {
      for (const n of b.names) if (contains(object, n)) {
        if (!matched.has(n)) matched.set(n, []);
        matched.get(n).push(b);
      }
    }
    for (const bs of matched.values()) {
      if (bs.length !== 1 || !bs[0].section) continue;
      // Naming where a link/photo/form lives does not authorize its prose.
      if (/\b(?:links?|photos?|pictures?|images?|forms?|buttons?|components?)\b/.test(object)) continue;
      const block = bs[0];
      // Rewording is not permission to remove the whole section. A unique
      // surviving target needs actual replacement prose, not just its heading.
      const removing = /^(?:remove|delete)\b|^take\b.*\b(?:off|out)\b/.test(clause);
      if (!removing) {
        const peer = pairs.get(block);
        if (!peer || (block.atoms.some(a => !a.heading) && !peer.atoms.some(a => !a.heading))) continue;
      }
      // A request for a heading grants only the heading, not its paragraphs.
      const headingOnly = /\b(?:heading|title)\b/.test(object);
      const lineOnly = /\b(?:line|paragraph|sentence)\b/.test(object);
      const candidates = bs[0].atoms.filter(a => headingOnly ? a.heading : lineOnly ? a.role === "p" : true);
      if ((headingOnly || lineOnly) && candidates.length !== 1) continue;
      for (const a of candidates) allowed.add(a);
    }
    // A quoted sentence can target itself even outside a semantic section.
    const exactObject = object.replace(/^\w+\s+/, "").replace(/^(?:the\s+)?(?:text|words|heading|title)\s+/, "").replace(/^the\s+/, "");
    for (const a of before.atoms) {
      if (a.text.length < 4 || exactObject !== name(a.text)) continue;
      if (before.atoms.filter(x => name(x.text) === name(a.text)).length !== 1) continue;
      const removing = /^(?:remove|delete)\b|^take\b.*\b(?:off|out)\b/.test(clause);
      const replacement = clause.match(/\s+to\s+(?:say\s+)?(.+)$/)?.[1];
      if (removing || (replacement && pairs.get(a.block)?.atoms.some(x => name(x.text).replace(/[.!?]+$/, "") === replacement.replace(/[.!?]+$/, "")))) allowed.add(a);
    }
  }
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

/** No missing parser/read is ever treated as an empty inventory. */
export async function preservePageProse({ before, after, message, parse }) {
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
    const allowed = permissions(message, b, pairs);
    const blocked = lost.filter(x => !allowed.has(x));
    return blocked.length ? { ok: false, why: "unconfirmed-target", blocked: blocked.map(x => x.text).slice(0, 6) } : { ok: true };
  } catch {
    return { ok: false, why: "unparsed" };
  }
}
