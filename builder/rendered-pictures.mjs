/**
 * WHETHER A PUBLISHED PAGE SHOWS A PICTURE, FROM WHAT THE PAGES RENDER
 * (2026-10-08, the eighth Build batch: Codex's review of `ff1fd469`).
 *
 * Codex published a page that never imports or renders a separate component
 * holding a bought photograph; `pictureStages` searched every source file for
 * the address, called it published, and the reply writer was told it was on
 * the site. An address in a file is not a picture on a page: a component
 * nothing imports, one salvage cut off from its page, a comment and an unused
 * string all hold it and show nothing.
 *
 * NOTHING HERE PARSES JAVASCRIPT. The files are read by the injected
 * TypeScript parser (`tweakParser()`), through the same render analysis the
 * menus use (`analyseRender` in `rendered-menus.mjs`), so the rules for
 * CERTAIN, MAYBE and DEAD are written once. With no parser (a build run inline
 * in the Worker) every answer is "unknown", never a guess either way.
 *
 * `picturesShown(urls, { pages, parts, parse })` answers a Map, each address
 * to one of:
 *   yes      a published route certainly renders an element whose attribute
 *            is that address: written as a string, or a `const` declared once
 *            and never changed. Followed from the route's component into the
 *            components it certainly renders, across files, through imports
 *            of `-parts/<name>`.
 *   no       every file the routes can reach parsed, and in none of them is
 *            the address in a string, template or JSX text that anything
 *            renders: it is only in files no route imports, in comments, or
 *            in declarations nothing names, or in an arm nothing takes.
 *   unknown  anything else: no parser, a file that did not parse, the address
 *            reached only through a maybe (a condition, a `.map`, a prop, a
 *            second `return`, a computed value).
 * `pages` are `{ path, source }` route files (`index.tsx`), `parts` are
 * `{ name, source }` components (`src/routes/-parts/<name>.tsx`).
 */
import { analyseRender } from "./rendered-menus.mjs";

const MAX_STEPS = 400;

export function picturesShown(urls, { pages = [], parts = [], parse = null } = {}) {
  const list = (Array.isArray(urls) ? urls : []).filter((u) => typeof u === "string" && u);
  const out = new Map(list.map((u) => [u, "unknown"]));
  if (!list.length || typeof parse !== "function") return out;

  const files = new Map(); // id -> { source, kind }
  for (const p of Array.isArray(pages) ? pages : []) if (p && typeof p.path === "string" && typeof p.source === "string") files.set("route:" + p.path, { source: p.source, kind: "route" });
  for (const p of Array.isArray(parts) ? parts : []) if (p && typeof p.name === "string" && typeof p.source === "string") files.set("part:" + p.name, { source: p.source, kind: "part" });

  const trees = new Map(); // id -> parsed { file, SK, each } | null
  const tree = (id) => {
    if (trees.has(id)) return trees.get(id);
    let t = null;
    try {
      const P = parse(files.get(id).source);
      if (P && P.file && P.SK && typeof P.each === "function" && Array.isArray(P.file.parseDiagnostics) && !P.file.parseDiagnostics.length) t = P;
    } catch { t = null; }
    trees.set(id, t);
    return t;
  };

  // A `-parts/<name>` import, from a route or from another part.
  const partOf = (spec, fromKind) => {
    const s = String(spec || "");
    let m = s.match(/(?:^@\/routes\/|^\.\/|^\.\.\/routes\/)-parts\/([a-z][a-z0-9-]*)(?:\.tsx?)?$/);
    if (!m && fromKind === "part") m = s.match(/^\.\/([a-z][a-z0-9-]*)(?:\.tsx?)?$/);
    if (!m) return null;
    const id = "part:" + m[1];
    return files.has(id) ? id : null;
  };

  const shown = new Set(); // addresses proven shown
  const reached = new Map(); // file id -> "certain" | "maybe" (its best reach)
  let doubt = false; // a reached file that could not be read
  const done = new Set();
  const queue = [];
  for (const id of files.keys()) if (id.startsWith("route:")) queue.push({ id, entry: null, mode: "certain" });

  let steps = 0;
  while (queue.length) {
    if (++steps > MAX_STEPS) { doubt = true; break; }
    const { id, entry, mode } = queue.shift();
    const key = id + "|" + (entry ? entry.name : "") + "|" + mode;
    if (done.has(key)) continue;
    done.add(key);
    const prev = reached.get(id);
    if (prev !== "certain") reached.set(id, mode);
    const t = tree(id);
    if (!t) { doubt = true; continue; }
    let A;
    try { A = analyseRender(t.file, t.SK, t.each, entry); } catch { doubt = true; continue; }
    const { SK } = t;
    // What each imported name is: the part file and the binding it names.
    const imports = new Map(); // local name -> { id, name }
    for (const st of t.file.statements) {
      if (st.kind !== SK.ImportDeclaration || !st.importClause || !st.moduleSpecifier) continue;
      const target = partOf(st.moduleSpecifier.text, files.get(id).kind);
      if (!target) continue;
      const c = st.importClause;
      if (c.name) imports.set(c.name.text, { id: target, name: "default" });
      const nb = c.namedBindings;
      if (nb && nb.elements) for (const el of nb.elements) imports.set(el.name.text, { id: target, name: (el.propertyName || el.name).text });
    }
    for (const open of A.opens) {
      const st = A.stateOf(open);
      if (st === "dead" || A.viaBody.has(open)) continue;
      const m = mode === "certain" && st === "certain" ? "certain" : "maybe";
      // AN IMPORTED COMPONENT IS FOLLOWED INTO ITS OWN FILE.
      const tag = open.tagName;
      if (tag && tag.kind === SK.Identifier && imports.has(tag.text)) {
        const to = imports.get(tag.text);
        queue.push({ id: to.id, entry: { name: to.name }, mode: m });
      }
      if (m !== "certain") continue;
      for (const a of open.attributes.properties) {
        if (a.kind !== SK.JsxAttribute) continue;
        const v = attrString(a, A, SK);
        if (v !== null) for (const u of list) if (v === u || v.includes(u)) shown.add(u);
      }
    }
  }

  for (const u of list) {
    if (shown.has(u)) { out.set(u, "yes"); continue; }
    if (doubt) continue;
    // NO LIVE OCCURRENCE in any file a route can reach.
    let live = false;
    for (const id of reached.keys()) {
      const t = tree(id);
      if (!t) { live = true; break; }
      let A;
      try { A = analyseRender(t.file, t.SK, t.each, null); } catch { live = true; break; }
      for (const n of A.literals) {
        const text = typeof n.text === "string" ? n.text : "";
        if (text.includes(u) && !A.deadNode(n)) { live = true; break; }
      }
      if (live) break;
    }
    if (!live) out.set(u, "no");
  }
  return out;
}

/** An attribute's value as a string, when it certainly is one; else null. */
function attrString(a, A, SK) {
  const init = a.initializer;
  if (!init) return null;
  if (init.kind === SK.StringLiteral) return init.text;
  if (init.kind !== SK.JsxExpression || !init.expression) return null;
  const e = A.strip(init.expression);
  if (!e) return null;
  if (e.kind === SK.StringLiteral || e.kind === SK.NoSubstitutionTemplateLiteral) return e.text;
  if (e.kind === SK.Identifier) {
    const d = A.single(e.text);
    if (d && d.kind === "const" && d.node.name.kind === SK.Identifier && d.node.initializer && !A.mutated(e.text)) {
      const v = A.strip(d.node.initializer);
      if (v && (v.kind === SK.StringLiteral || v.kind === SK.NoSubstitutionTemplateLiteral)) return v.text;
    }
  }
  return null;
}
