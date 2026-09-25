// A full writer may change targeted prose, not silently discard its neighbors.
// Reuse the edit path's parser. No persisted IDs, model verdict or extra call.
// Headings/ids locate a request's target; actual text identities establish
// preservation. Unknown targeting fails closed only when text would be lost.
import { tweakParser } from "./site-tweak.mjs";

const space = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const name = (s) => space(s).normalize("NFKC").toLowerCase().replace(/[“”‘’"']/g, "");
const words = s => space(s.replace(/[^\p{L}\p{N}#-]+/gu, " "));
const contains = (s, part) => (" " + words(s) + " ").includes(" " + words(part) + " ");

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
  const allowed = new Set(), protectedBlocks = new Set();
  // Quoted copy is data, even when it contains punctuation or commands.
  const quotes = [];
  let token = "quotedtoken";
  while (String(message).toLowerCase().includes(token)) token += "x";
  const shielded = String(message).replace(/"([^"\n]*)"|“([^”\n]*)”|‘([^’\n]*)’|'([^'\n]*)'/g,
    (_, ...groups) => `${token}${quotes.push(groups.slice(0, 4).find(x => x !== undefined)) - 1}`);
  if (/["“”‘’]|(?:^|\s)'|'(?:\s|$)/.test(shielded)) return allowed;
  const expand = s => s.replace(new RegExp(token + "(\\d+)", "g"), (_, i) => quotes[Number(i)]);
  const clauses = shielded.split(/[;!?]|\.(?:\s|$)|(?:,?\s+(?:and|but)\s+)(?=(?:please\s+)?(?:change|rewrite|reword|update|show|rename|replace|remove|delete|take|keep|leave|preserve|make|move|put|do\b|don't\b))/i);
  const resolve = object => {
    // Complete noun phrases only: a mention is not an authorization.
    const n = name(expand(object)).replace(/^the\s+/, "");
    const hits = [];
    for (const block of before.blocks.filter(b => b.section)) for (const label of block.names) {
      const forms = [[label, "all"], [label + " section", "all"], [label + " heading", "heading"], [label + " title", "heading"],
        ...["line", "paragraph", "sentence"].flatMap(role => ["under", "in", "of"].map(prep => [role + " " + prep + " " + label, "line"]))];
      for (const [phrase, scope] of forms) if (n === phrase) hits.push({ block, scope });
    }
    const unique = hits.filter((h, i) => hits.findIndex(x => x.block === h.block && x.scope === h.scope) === i);
    return unique.length === 1 ? unique[0] : null;
  };
  for (let clause of clauses) {
    clause = space(clause).toLowerCase().replace(/^please\s+/, "");
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
    const object = action[2].split(/\s+(?:to|as|into|with|so that|above|below|before|after|beside|like|compared to|relative to|at|on|off)\s+/)[0];
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
      const replacement = name(expand(clause.match(/\s+to\s+(?:say\s+)?(.+)$/)?.[1] || ""));
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
