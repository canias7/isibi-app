/**
 * THE MENUS A PAGE RENDERS, READ FROM ITS SYNTAX TREE (2026-10-08, Codex's
 * review of 7fc7056d).
 *
 * The reply says a menu link was kept only from this. `navSlots` finds every
 * `links` array of a menu's shape, which is right for the editor, that must
 * reach each one, and no evidence of what a visitor sees: an array in a
 * comment, an unused object, a component declared and never rendered, or an
 * element behind `false &&` all have the shape. The handwritten scanner this
 * replaces read "reachable by name" as "rendered", so a local `OldMenu` nobody
 * renders and a `false && <SiteChrome …/>` both counted.
 *
 * NOTHING HERE PARSES JAVASCRIPT. The page is read by the TypeScript parser
 * (`tweakParser()` in `site-tweak.mjs`, the parser the compile step and the
 * photo and layout rungs already use), INJECTED by the caller. With no parser
 * (a job run inline in the Worker), or a page with a syntax error, the answer
 * is `null`, which the caller tells as not known.
 *
 * WHAT IT ESTABLISHES, AND ONLY THIS. An element is CERTAINLY rendered when it
 * is reached from the route's component (`createFileRoute(…)({ component })`,
 * or the module's default export, when it is a function in this file) along
 * these paths, and no other:
 *   - the component's one return (an expression body, or a block with exactly
 *     one `return`, at its top level);
 *   - an element's JSX children, where the element is an HTML tag or a
 *     component imported from another file (that it renders its children is
 *     the one assumption, the kit's own shells all do);
 *   - a `const` in this file, declared once, whose value is JSX;
 *   - a component declared once in this file and rendered as a tag, into its
 *     own one return;
 *   - `true && X`, `true ? X : Y` and `false ? Y : X`, written as the words.
 * Comments and strings are not in the tree, so they are never elements.
 * An element is CERTAINLY NOT rendered when a declaration around it is never
 * referenced anywhere in the file and not exported (an unused function, a
 * component declared and never rendered, a const never read), or when it sits
 * behind a literal `false &&` or the untaken arm of a literal condition.
 * EVERY OTHER ELEMENT THAT COULD CARRY A MENU IS MAYBE: a condition that is not
 * a literal, a second `return`, a callback (`.map`), JSX passed in a prop, the
 * children of a component declared in this file, a component bound in any
 * other way. A maybe element whose `links` could be anything at all leaves the
 * page `unsure`; it is never a menu and never proof there is none.
 *
 * A CERTAIN ELEMENT'S `links` is followed through: an inline array of object
 * literals whose `label` and `href` are quoted strings; a `const` declared once
 * in the file and never mutated (no method call on it, no assignment into it,
 * never handed to a call); `NAME.links`; a spread `{...NAME}`; an object's own
 * spreads; `as`, `satisfies` and parentheses. Attributes and keys are read in
 * order and the last one written wins. Anything else (a parameter, an import,
 * a call, a name declared twice, a computed key, a non-literal item) is
 * `unsure`.
 *
 * `{ menus: [[{ label, href }]], unsure }`, or null.
 */
export function renderedMenus(source, parse) {
  if (typeof parse !== "function") return null;
  let P;
  try { P = parse(String(source)); } catch { return null; }
  const { file, SK, each } = P || {};
  if (!file || !SK || typeof each !== "function") return null;
  if (!Array.isArray(file.parseDiagnostics) || file.parseDiagnostics.length) return null;
  try { return readTree(file, SK, each); } catch { return null; }
}

const MAX_DEPTH = 24;

/**
 * THE RENDER ANALYSIS, SHARED (2026-10-08, the eighth Build batch): what a
 * file's entry component renders, CERTAIN / MAYBE / DEAD per opening element,
 * by exactly the rules above. `entry` is null for a route file (the route's
 * component, then the default export), or `{ name }` for a component another
 * file imports — "default" for its default export, else the exported binding.
 * The menus reader below and the pictures reader (`rendered-pictures.mjs`)
 * both read this; neither keeps a second copy of the rules.
 */
export function analyseRender(file, SK, each, entry = null) {
  const FUNCS = new Set([SK.FunctionDeclaration, SK.FunctionExpression, SK.ArrowFunction, SK.MethodDeclaration, SK.GetAccessor, SK.SetAccessor, SK.Constructor]);
  const JSX = new Set([SK.JsxElement, SK.JsxSelfClosingElement, SK.JsxFragment]);
  const decls = new Map(); // name -> [{ kind, node }]
  const refs = new Map(); // name -> [Identifier]
  const opens = []; // every opening element, in source order
  const literals = []; // every string-bearing node (literals, template pieces, JSX text)
  const routeCalls = [];
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const declare = (name, kind, node) => {
    if (!name) return;
    if (name.kind === SK.Identifier) add(decls, name.text, { kind, node });
    else if (name.kind === SK.ObjectBindingPattern || name.kind === SK.ArrayBindingPattern) {
      for (const el of name.elements) if (el.name) declare(el.name, kind === "const" || kind === "letvar" ? "pattern" : kind, el);
    }
  };

  const visit = (n) => {
    const p = n.parent;
    switch (n.kind) {
      case SK.VariableDeclaration: {
        const list = p && p.kind === SK.VariableDeclarationList ? p : null;
        const isConst = !!list && (list.flags & 2) !== 0; // NodeFlags.Const
        declare(n.name, isConst ? "const" : "letvar", n);
        break;
      }
      case SK.FunctionDeclaration: if (n.name) declare(n.name, "function", n); break;
      case SK.ClassDeclaration: if (n.name) declare(n.name, "class", n); break;
      case SK.Parameter: declare(n.name, "param", n); break;
      case SK.ImportClause: if (n.name) declare(n.name, "import", n); break;
      case SK.ImportSpecifier: declare(n.name, "import", n); break;
      case SK.NamespaceImport: declare(n.name, "import", n); break;
      case SK.ImportEqualsDeclaration: declare(n.name, "import", n); break;
      case SK.EnumDeclaration: declare(n.name, "class", n); break;
      case SK.CatchClause: if (n.variableDeclaration) declare(n.variableDeclaration.name, "param", n); break;
      case SK.JsxSelfClosingElement:
      case SK.JsxOpeningElement:
        opens.push(n);
        break;
      case SK.StringLiteral: case SK.NoSubstitutionTemplateLiteral: case SK.TemplateHead:
      case SK.TemplateMiddle: case SK.TemplateTail: case SK.JsxText:
        literals.push(n);
        break;
      case SK.CallExpression:
        if (n.expression.kind === SK.CallExpression && n.expression.expression.kind === SK.Identifier &&
          /^create(Lazy)?FileRoute$/.test(n.expression.expression.text)) routeCalls.push(n);
        break;
      case SK.Identifier:
        if (isReference(n, SK)) add(refs, n.text, n);
        break;
    }
    each(n, visit);
  };
  each(file, visit);

  const single = (name) => {
    const d = decls.get(name);
    return d && d.length === 1 ? d[0] : null;
  };
  const strip = (e) => {
    while (e && (e.kind === SK.ParenthesizedExpression || e.kind === SK.AsExpression || e.kind === SK.SatisfiesExpression ||
      e.kind === SK.NonNullExpression || e.kind === SK.TypeAssertionExpression)) e = e.expression;
    return e;
  };
  const literalBool = (e) => {
    e = strip(e);
    return e && e.kind === SK.TrueKeyword ? true : e && e.kind === SK.FalseKeyword ? false : null;
  };
  // A COMPONENT DECLARED ONCE IN THIS FILE: a function declaration, or a
  // const whose value is a function.
  const localFunction = (name) => {
    const d = single(name);
    if (!d) return null;
    if (d.kind === "function") return d.node;
    if (d.kind === "const" && d.node.name.kind === SK.Identifier) {
      const v = strip(d.node.initializer);
      if (v && (v.kind === SK.ArrowFunction || v.kind === SK.FunctionExpression)) return v;
    }
    return null;
  };
  const isImported = (name) => {
    const d = single(name);
    return !!d && d.kind === "import";
  };
  // MUTATED: a method called on it or on a member, an assignment, `++`/`--` or
  // `delete` into it, or the binding (or a member) handed to a call.
  const mutated = (name) => (refs.get(name) || []).some((r) => {
    let n = r;
    while (n.parent && (n.parent.kind === SK.PropertyAccessExpression || n.parent.kind === SK.ElementAccessExpression) && n.parent.expression === n) n = n.parent;
    const p = n.parent;
    if (!p) return false;
    if (p.kind === SK.BinaryExpression && p.left === n && p.operatorToken.kind >= SK.FirstAssignment && p.operatorToken.kind <= SK.LastAssignment) return true;
    if ((p.kind === SK.PrefixUnaryExpression || p.kind === SK.PostfixUnaryExpression) && (p.operator === SK.PlusPlusToken || p.operator === SK.MinusMinusToken)) return true;
    if (p.kind === SK.DeleteExpression) return true;
    if (p.kind === SK.CallExpression && p.expression === n && n !== r) return true;
    if ((p.kind === SK.CallExpression || p.kind === SK.NewExpression) && p.arguments && p.arguments.includes(n)) return true;
    return false;
  });

  // ── WHAT RENDERS ─────────────────────────────────────────────────────────
  const state = new Map(); // element (opening) -> "certain" | "maybe"
  const seen = new Map(); // function -> mode reached
  // A TAG THAT IS A COMPONENT OF THIS FILE is read through its body, where its
  // own props are parameters; the tag's attributes are not a menu themselves.
  const viaBody = new Set();
  const mark = (open, mode) => { if (state.get(open) !== "certain" && state.get(open) !== "dead") state.set(open, mode); };
  const returnsOf = (fn) => {
    const out = [];
    const walk = (n) => {
      if (n !== fn && FUNCS.has(n.kind)) return;
      if (n.kind === SK.ClassDeclaration || n.kind === SK.ClassExpression) return;
      if (n.kind === SK.ReturnStatement) out.push(n);
      each(n, walk);
    };
    each(fn.body, walk);
    return out;
  };
  const renderFn = (fn, mode, depth) => {
    const was = seen.get(fn);
    if (was === "certain" || was === mode || depth > MAX_DEPTH) { if (depth > MAX_DEPTH) maybeWithin(fn.body, depth); return; }
    seen.set(fn, mode);
    const body = fn.body;
    if (!body) return;
    if (body.kind !== SK.Block) return renderExpr(body, mode, depth + 1);
    const rets = returnsOf(fn);
    const one = rets.length === 1 && body.statements.includes(rets[0]);
    for (const r of rets) if (r.expression) renderExpr(r.expression, one ? mode : "maybe", depth + 1);
  };
  // EVERY ELEMENT INSIDE AN EXPRESSION THIS DOES NOT FOLLOW is maybe.
  const maybeWithin = (e, depth) => {
    if (!e) return;
    const walk = (n) => {
      if (JSX.has(n.kind)) return renderExpr(n, "maybe", depth + 1);
      each(n, walk);
    };
    walk(e);
  };
  // AN ARM A LITERAL CONDITION NEVER TAKES: nothing in it renders.
  const deadWithin = (e) => {
    if (!e) return;
    const walk = (n) => {
      if ((n.kind === SK.JsxSelfClosingElement || n.kind === SK.JsxOpeningElement) && !state.has(n)) state.set(n, "dead");
      each(n, walk);
    };
    walk(e);
  };
  const renderExpr = (e0, mode, depth) => {
    const e = strip(e0);
    if (!e) return;
    if (depth > MAX_DEPTH) return maybeWithin(e, depth);
    switch (e.kind) {
      case SK.JsxElement: return element(e.openingElement, e.children, mode, depth);
      case SK.JsxSelfClosingElement: return element(e, [], mode, depth);
      case SK.JsxFragment: return children(e.children, mode, depth);
      case SK.ConditionalExpression: {
        const b = literalBool(e.condition);
        if (b === true) { deadWithin(e.whenFalse); return renderExpr(e.whenTrue, mode, depth + 1); }
        if (b === false) { deadWithin(e.whenTrue); return renderExpr(e.whenFalse, mode, depth + 1); }
        maybeWithin(e.condition, depth);
        renderExpr(e.whenTrue, "maybe", depth + 1);
        return renderExpr(e.whenFalse, "maybe", depth + 1);
      }
      case SK.BinaryExpression: {
        if (e.operatorToken.kind === SK.AmpersandAmpersandToken) {
          const b = literalBool(e.left);
          if (b === false) return deadWithin(e.right);
          if (b === true) return renderExpr(e.right, mode, depth + 1);
        }
        return maybeWithin(e, depth);
      }
      case SK.Identifier: {
        const d = single(e.text);
        if (d && d.kind === "const" && d.node.name.kind === SK.Identifier && d.node.initializer) return renderExpr(d.node.initializer, mode, depth + 1);
        return;
      }
      case SK.NullKeyword: case SK.TrueKeyword: case SK.FalseKeyword:
      case SK.StringLiteral: case SK.NumericLiteral: case SK.NoSubstitutionTemplateLiteral:
        return;
      default:
        return maybeWithin(e, depth);
    }
  };
  const element = (open, kids, mode, depth) => {
    mark(open, mode);
    // JSX handed in a prop may or may not be rendered by the component.
    for (const a of open.attributes.properties) {
      if (a.kind === SK.JsxSpreadAttribute) maybeWithin(a.expression, depth);
      else if (a.initializer && a.initializer.kind === SK.JsxExpression) maybeWithin(a.initializer.expression, depth);
      else if (a.initializer && JSX.has(a.initializer.kind)) maybeWithin(a.initializer, depth);
    }
    const tag = open.tagName;
    let kidsMode = "maybe";
    if (tag.kind === SK.Identifier && /^[a-z]/.test(tag.text) && !single(tag.text)) kidsMode = mode;
    else {
      let root = tag;
      while (root.kind === SK.PropertyAccessExpression) root = root.expression;
      if (root.kind === SK.Identifier) {
        const fn = tag === root ? localFunction(root.text) : null;
        if (fn) { viaBody.add(open); renderFn(fn, mode, depth + 1); }
        else if (isImported(root.text)) kidsMode = mode;
      }
    }
    children(kids, kidsMode, depth);
  };
  const children = (kids, mode, depth) => {
    for (const k of kids || []) {
      if (k.kind === SK.JsxText) continue;
      if (k.kind === SK.JsxExpression) { if (k.expression) renderExpr(k.expression, mode, depth + 1); continue; }
      renderExpr(k, mode, depth + 1);
    }
  };

  // THE ROUTE'S COMPONENT, THEN THE DEFAULT EXPORT.
  const entry_ = (v) => {
    const e = strip(v);
    if (!e) return;
    if (e.kind === SK.ArrowFunction || e.kind === SK.FunctionExpression) return renderFn(e, "certain", 0);
    if (e.kind === SK.Identifier) { const fn = localFunction(e.text); if (fn) return renderFn(fn, "certain", 0); }
    // Anything else: what it renders is not read here, so its elements stay maybe.
  };
  const wanted = entry && typeof entry.name === "string" ? entry.name : null;
  if (!wanted) {
    for (const c of routeCalls) {
      const o = strip(c.arguments[0]);
      if (!o || o.kind !== SK.ObjectLiteralExpression) continue;
      for (const pr of o.properties) {
        if (pr.kind === SK.PropertyAssignment && nameOf(pr.name) === "component") entry_(pr.initializer);
        else if (pr.kind === SK.ShorthandPropertyAssignment && pr.name.text === "component") entry_(pr.name);
      }
    }
  }
  for (const st of file.statements) {
    if (wanted && wanted !== "default") {
      // A NAMED EXPORT: `export function NAME`, or `export const NAME = …`.
      if (st.kind === SK.FunctionDeclaration && st.name && st.name.text === wanted && hasModifier(st, SK.ExportKeyword, SK)) renderFn(st, "certain", 0);
      else if (st.kind === SK.VariableStatement && hasModifier(st, SK.ExportKeyword, SK)) {
        for (const d of st.declarationList.declarations) if (d.name.kind === SK.Identifier && d.name.text === wanted) entry_(d.name);
      }
      continue;
    }
    if (st.kind === SK.ExportAssignment && !st.isExportEquals) entry_(st.expression);
    else if (st.kind === SK.FunctionDeclaration && hasModifier(st, SK.ExportKeyword, SK) && hasModifier(st, SK.DefaultKeyword, SK)) renderFn(st, "certain", 0);
  }

  // CERTAINLY NOT RENDERED: inside a declaration nothing in the file names.
  const unreferenced = (open) => {
    for (let a = open.parent; a && a.kind !== SK.SourceFile; a = a.parent) {
      let name = null, stmt = a;
      if ((a.kind === SK.FunctionDeclaration || a.kind === SK.ClassDeclaration) && a.name) name = a.name.text;
      else if (a.kind === SK.VariableDeclaration && a.name.kind === SK.Identifier) { name = a.name.text; stmt = a.parent && a.parent.parent; }
      if (!name) continue;
      const exported = stmt && hasModifier(stmt, SK.ExportKeyword, SK);
      if (!exported && !(refs.get(name) || []).length) return true;
    }
    return false;
  };

  // A NODE NOTHING RENDERS: an element the analysis found dead, or anything
  // inside a declaration nothing in the file names.
  const deadNode = (n) => {
    for (let a = n; a && a.kind !== SK.SourceFile; a = a.parent) {
      if ((a.kind === SK.JsxSelfClosingElement || a.kind === SK.JsxOpeningElement) && state.get(a) === "dead") return true;
      if (a.kind === SK.JsxElement && a.openingElement && state.get(a.openingElement) === "dead") return true;
    }
    return unreferenced(n);
  };
  const stateOf = (open) => state.get(open) || (unreferenced(open) ? "dead" : "maybe");
  return { opens, literals, state, viaBody, stateOf, deadNode, unreferenced, single, strip, decls, refs, mutated, isImported };
}

function readTree(file, SK, each) {
  const A = analyseRender(file, SK, each, null);
  const { state, viaBody, single, decls, mutated, unreferenced } = A;
  const strip = A.strip;
  const bearing = A.opens.filter((n) => n.attributes.properties.some((a) => a.kind === SK.JsxSpreadAttribute || (a.kind === SK.JsxAttribute && nameOf(a.name) === "links")));

  // ── WHAT EACH ELEMENT'S `links` IS ───────────────────────────────────────
  // PRESENCE IS NOT A VALUE (2026-10-08, Codex's review of c288078d). ABSENT is
  // a key the object or element does not write, which leaves the earlier one
  // standing; NONE is a key written as null or undefined, which overwrites it.
  // Run together, `{...{ links: null }}` after a menu read as "no key" and the
  // menu survived it.
  const UNSURE = { kind: "unsure" }, NONE = { kind: "none" }, OTHER = { kind: "other" }, ABSENT = { kind: "absent" };
  const value = (e0, depth) => {
    const e = strip(e0);
    if (!e || depth > MAX_DEPTH) return UNSURE;
    switch (e.kind) {
      case SK.ArrayLiteralExpression: {
        const items = [];
        for (const el of e.elements) {
          const it = strip(el);
          if (!it || it.kind !== SK.ObjectLiteralExpression) return UNSURE;
          const item = { label: "", href: "" };
          for (const pr of it.properties) {
            if (pr.kind === SK.SpreadAssignment || pr.kind === SK.ShorthandPropertyAssignment) return UNSURE;
            if (pr.kind !== SK.PropertyAssignment) continue;
            const k = nameOf(pr.name);
            if (k === null) return UNSURE;
            if (k !== "label" && k !== "href") continue;
            const v = strip(pr.initializer);
            if (!v || v.kind !== SK.StringLiteral) return UNSURE;
            item[k] = v.text;
          }
          items.push(item);
        }
        return { kind: "array", items };
      }
      case SK.ObjectLiteralExpression: return { kind: "object", node: e };
      case SK.NullKeyword: return NONE;
      case SK.StringLiteral: case SK.NumericLiteral: case SK.NoSubstitutionTemplateLiteral: case SK.TrueKeyword: case SK.FalseKeyword:
        return OTHER;
      case SK.Identifier: {
        const ds = decls.get(e.text);
        if (!ds && e.text === "undefined") return NONE;
        const d = single(e.text);
        if (!d) return UNSURE;
        if (d.kind === "const" && d.node.name.kind === SK.Identifier && d.node.initializer && !mutated(e.text)) return value(d.node.initializer, depth + 1);
        if (d.kind === "function" || d.kind === "class") return OTHER;
        return UNSURE;
      }
      case SK.PropertyAccessExpression: {
        const o = value(e.expression, depth + 1);
        if (o.kind !== "object") return o.kind === "unsure" ? UNSURE : UNSURE;
        const r = prop(o, e.name.text, depth + 1);
        return r.kind === "absent" ? NONE : r;
      }
      default: return UNSURE;
    }
  };
  // THE KEY'S LAST WRITE, IN SOURCE ORDER: a spread that writes it (even as
  // null) overwrites, one that does not leaves it, one that cannot be read
  // makes it unsure.
  const prop = (o, key, depth) => {
    let st = ABSENT;
    for (const pr of o.node.properties) {
      if (pr.kind === SK.SpreadAssignment) {
        const v = value(pr.expression, depth + 1);
        if (v.kind === "object") { const r = prop(v, key, depth + 1); if (r.kind !== "absent") st = r; }
        else if (v.kind === "unsure") st = UNSURE;
        continue;
      }
      const k = pr.name ? nameOf(pr.name) : null;
      if (k === null) { st = UNSURE; continue; }
      if (k !== key) continue;
      if (pr.kind === SK.PropertyAssignment) st = value(pr.initializer, depth + 1);
      else if (pr.kind === SK.ShorthandPropertyAssignment) st = value(pr.name, depth + 1);
      else st = UNSURE;
    }
    return st;
  };
  const asLinks = (v) => (v.kind === "array" || v.kind === "unsure" || v.kind === "none" ? v : OTHER);
  const linksOf = (open) => {
    let st = ABSENT;
    for (const a of open.attributes.properties) {
      if (a.kind === SK.JsxAttribute && nameOf(a.name) === "links") {
        const init = a.initializer;
        if (!init || init.kind === SK.StringLiteral) st = OTHER;
        else if (init.kind === SK.JsxExpression) st = init.expression ? asLinks(value(init.expression, 0)) : OTHER;
        else st = UNSURE;
      } else if (a.kind === SK.JsxSpreadAttribute) {
        const v = value(a.expression, 0);
        const r = v.kind === "object" ? prop(v, "links", 0) : v.kind === "unsure" ? UNSURE : ABSENT;
        if (r.kind !== "absent") st = asLinks(r);
      }
    }
    return st.kind === "absent" ? NONE : st;
  };

  const menus = [];
  let unsure = false;
  for (const open of bearing) {
    const st = state.get(open) || (unreferenced(open) ? "dead" : "maybe");
    if (st === "dead" || viaBody.has(open)) continue;
    const l = linksOf(open);
    if (st === "maybe") { if (l.kind !== "none") unsure = true; continue; }
    if (l.kind === "unsure") unsure = true;
    else if (l.kind === "array" && l.items.some((it) => it.label)) menus.push(l.items);
  }
  return { menus, unsure };
}

/** A property or attribute name as text, or null when it is computed. */
export function nameOf(n) {
  if (!n) return null;
  if (typeof n.text === "string" && n.kind !== undefined && !n.expression) return n.text;
  if (n.namespace && n.name) return n.namespace.text + ":" + n.name.text;
  return null;
}

export function hasModifier(node, kind) {
  return !!(node && node.modifiers && node.modifiers.some((m) => m.kind === kind));
}

/** Whether an identifier names a value here, rather than declaring one or naming a property. */
function isReference(n, SK) {
  const p = n.parent;
  if (!p) return false;
  switch (p.kind) {
    case SK.VariableDeclaration: case SK.FunctionDeclaration: case SK.FunctionExpression:
    case SK.ClassDeclaration: case SK.ClassExpression: case SK.Parameter: case SK.EnumDeclaration:
    case SK.InterfaceDeclaration: case SK.TypeAliasDeclaration: case SK.TypeParameter: case SK.EnumMember:
    case SK.ImportClause: case SK.NamespaceImport: case SK.ImportEqualsDeclaration:
    case SK.MethodDeclaration: case SK.PropertyDeclaration: case SK.PropertySignature: case SK.MethodSignature:
    case SK.GetAccessor: case SK.SetAccessor: case SK.LabeledStatement: case SK.BreakStatement: case SK.ContinueStatement:
      return p.name !== n && p.label !== n;
    case SK.ImportSpecifier: return false;
    case SK.BindingElement: return p.name !== n && p.propertyName !== n;
    case SK.PropertyAccessExpression: return p.name !== n;
    case SK.PropertyAssignment: return p.name !== n;
    case SK.JsxAttribute: return p.name !== n;
    default: return true;
  }
}
