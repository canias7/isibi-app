// A FREE IDENTIFIER IN A BROWSER FILE IS A RUNTIME ERROR NOTHING HERE COULD SEE
// (2026-09-12, found by hand during the game builder's deletion).
//
// `public/chat.js` cannot be imported by a test — it is a browser script, not a
// module — so every guard over it reads its TEXT. A name used inside a function
// but declared nowhere resolves when that LINE RUNS, not at load, so:
//
//   • `node --check public/chat.js` passes,
//   • every source-reading guard finds its landmarks,
//   • a mutation sweep kills every mutant,
//   • and the first customer whose browser reaches the line gets a
//     ReferenceError with the feature simply not happening.
//
// THIS HAS NOW COST FIVE INCIDENTS. Run 22's `TOKEN` (a function lifted to
// module scope kept reading a local of `main`), `eMark`, `MARKS`, `logoOk` —
// which reached MAIN, because `&&` short-circuits so no test ever evaluated it —
// and, this session, `gamesLoad`: the Game Studio was deleted and the asset sync
// went on CALLING it, which would have thrown on every sync for every signed-in
// customer. Four of those five were found by a live failure or by a hand grep.
//
// SO THE FILE IS PARSED, NOT READ. TypeScript's own parser gives the AST, this
// walks it with real lexical scopes — parameters, destructuring, catch
// bindings, for-of, function and class declarations, hoisting — and reports any
// identifier that resolves to nothing in the file and is not a browser or
// JavaScript global. Property access (`a.b`), object keys, labels and member
// expressions are not identifiers for this purpose and never reach the check.
//
// THE BAR IS ZERO FALSE ALARMS, measured over the real files rather than
// asserted (this repository's own rule: "a check that flags correct code is
// worse than no check", and any new lint must reach zero over the real corpus
// before it ships). The globals list is the only hand-maintained part, and it
// is deliberately GENEROUS — a missing global is a false alarm, which is the
// expensive direction; a name that is genuinely undefined will never be in it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");

const ROOT = new URL("../", import.meta.url).pathname;
/** Every browser script the app serves. Derived: any .js under public/ that a page loads. */
const INDEX = fs.readFileSync(ROOT + "public/index.html", "utf8");
const SCRIPTS = [...INDEX.matchAll(/<script[^>]*\bsrc="([^"]+\.js)"/g)]
  .map((m) => m[1].replace(/^\.?\//, "").split("?")[0])
  .filter((p) => !/^https?:/.test(p));

/**
 * Names the platform supplies. Generous on purpose — see the header. Grouped so
 * a future addition lands somewhere that says what it is.
 */
const GLOBALS = new Set([
  // JavaScript itself
  "globalThis", "undefined", "NaN", "Infinity", "Object", "Array", "String", "Number", "Boolean",
  "Symbol", "BigInt", "Math", "JSON", "Date", "RegExp", "Error", "TypeError", "RangeError",
  "SyntaxError", "ReferenceError", "EvalError", "URIError", "AggregateError", "Function",
  "Promise", "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "Proxy", "Reflect", "Intl",
  "ArrayBuffer", "SharedArrayBuffer", "DataView", "Int8Array", "Uint8Array", "Uint8ClampedArray",
  "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array", "Float64Array",
  "BigInt64Array", "BigUint64Array", "parseInt", "parseFloat", "isNaN", "isFinite",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI", "escape", "unescape",
  "eval", "arguments", "this",
  // The DOM and the window
  "window", "document", "navigator", "location", "history", "screen", "localStorage",
  "sessionStorage", "console", "alert", "confirm", "prompt", "getComputedStyle", "matchMedia",
  "scrollTo", "scrollBy", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback",
  "cancelIdleCallback", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "queueMicrotask", "structuredClone", "crypto", "performance", "devicePixelRatio",
  "innerWidth", "innerHeight", "open", "close", "focus", "blur", "print", "postMessage",
  "addEventListener", "removeEventListener", "dispatchEvent", "getSelection", "visualViewport",
  // Constructors and interfaces a page touches
  "Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLCanvasElement",
  "HTMLImageElement", "Node", "NodeList", "Text", "DocumentFragment", "ShadowRoot", "CustomEvent",
  "Event", "MouseEvent", "KeyboardEvent", "PointerEvent", "TouchEvent", "InputEvent", "DragEvent",
  "MessageEvent", "CloseEvent", "ErrorEvent", "PromiseRejectionEvent", "StorageEvent",
  "MutationObserver", "IntersectionObserver", "ResizeObserver", "PerformanceObserver",
  "AbortController", "AbortSignal", "FormData", "URLSearchParams", "URL", "Headers", "Request",
  "Response", "fetch", "Blob", "File", "FileReader", "FileList", "Image", "Audio", "Option",
  "DOMParser", "XMLSerializer", "XMLHttpRequest", "WebSocket", "EventSource", "Worker",
  "TextEncoder", "TextDecoder", "ReadableStream", "WritableStream", "TransformStream",
  "CSS", "CanvasRenderingContext2D", "Range", "Selection", "Clipboard", "ClipboardItem",
  "MediaRecorder", "MediaStream", "AudioContext", "webkitAudioContext", "SpeechSynthesisUtterance",
  "speechSynthesis", "IDBDatabase", "indexedDB", "caches", "atob", "btoa", "reportError",
  "DataTransfer", "DecompressionStream", "CompressionStream", "self", "top", "parent", "frames",
  "name", "status", "origin", "isSecureContext", "customElements", "Notification", "BroadcastChannel",
]);

/**
 * Every identifier in `src` that resolves to no binding in the file.
 * A real lexical walk: each scope holds the names declared in it, a name is
 * looked up outward, and only a genuine identifier REFERENCE is checked.
 *
 * `outer` is what the PAGE supplies — the top-level names of every other classic
 * script it loads, plus the names it deliberately treats as optional. Classic
 * scripts share one global scope, so a per-file check would report `auth.js`'s
 * `SUPABASE_URL` as missing from `chat.js`, which is a false alarm about code
 * that has always worked.
 */
export function freeIdentifiers(src, fileName = "x.js", outer = new Set()) {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const found = [];
  const scopes = [new Set(outer)];
  const declare = (name) => { if (name) scopes[scopes.length - 1].add(name); };
  const known = (name) => GLOBALS.has(name) || scopes.some((s) => s.has(name));

  /** Every name a binding pattern introduces: `{a, b: {c}, ...rest}`, `[x, , y]`. */
  const bindNames = (node) => {
    if (!node) return;
    if (ts.isIdentifier(node)) return declare(node.text);
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const el of node.elements) if (!ts.isOmittedExpression(el)) bindNames(el.name);
      return;
    }
    if (ts.isBindingElement(node) || ts.isParameter(node)) return bindNames(node.name);
  };

  /** Hoist the declarations a scope's body makes, so a call above its own
   *  `function` statement is not reported (JavaScript hoists; a text read does not). */
  const hoist = (stmts) => {
    for (const st of stmts || []) {
      if (ts.isFunctionDeclaration(st) && st.name) declare(st.name.text);
      else if (ts.isClassDeclaration(st) && st.name) declare(st.name.text);
      else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bindNames(d.name);
      // `var` inside a block belongs to the function; walking blocks here keeps
      // it simple and can only ever ADD a name, which is the safe direction.
      else if (ts.isBlock(st) || ts.isIfStatement(st) || ts.isTryStatement(st) || ts.isForStatement(st) ||
               ts.isForOfStatement(st) || ts.isForInStatement(st) || ts.isWhileStatement(st) || ts.isLabeledStatement(st)) {
        st.forEachChild((c) => { if (ts.isBlock(c)) hoist(c.statements); else if (ts.isVariableStatement(c)) hoist([c]); });
      }
    }
  };

  const pushScope = () => scopes.push(new Set());
  const popScope = () => scopes.pop();

  const walk = (node) => {
    if (!node) return;
    // A scope-making node: declare what it binds, then walk its children inside.
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      if (node.name && ts.isIdentifier(node.name) && ts.isFunctionDeclaration(node)) declare(node.name.text);
      pushScope();
      // A named function EXPRESSION can call itself by name.
      if (node.name && ts.isIdentifier(node.name)) declare(node.name.text);
      for (const p of node.parameters || []) { bindNames(p); if (p.initializer) walk(p.initializer); }
      if (node.body) {
        if (ts.isBlock(node.body)) { hoist(node.body.statements); node.body.statements.forEach(walk); }
        else walk(node.body);
      }
      popScope();
      return;
    }
    if (ts.isBlock(node) || ts.isCaseBlock(node)) {
      pushScope(); hoist(node.statements || node.clauses); (node.statements || node.clauses).forEach(walk); popScope();
      return;
    }
    if (ts.isCatchClause(node)) {
      pushScope(); bindNames(node.variableDeclaration && node.variableDeclaration.name);
      hoist(node.block.statements); node.block.statements.forEach(walk); popScope();
      return;
    }
    if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      pushScope();
      const init = node.initializer;
      if (init && ts.isVariableDeclarationList(init)) for (const d of init.declarations) { bindNames(d.name); if (d.initializer) walk(d.initializer); }
      else if (init) walk(init);
      if (node.expression) walk(node.expression);
      if (node.condition) walk(node.condition);
      if (node.incrementor) walk(node.incrementor);
      walk(node.statement);
      popScope();
      return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      if (node.name) declare(node.name.text);
      pushScope(); if (node.name) declare(node.name.text); node.forEachChild(walk); popScope();
      return;
    }
    if (ts.isVariableDeclaration(node)) { bindNames(node.name); if (node.initializer) walk(node.initializer); return; }
    // NOT identifier references: the property half of `a.b`, an object key, a
    // label, a `case` on a literal. Reporting any of these is a false alarm.
    if (ts.isPropertyAccessExpression(node)) { walk(node.expression); return; }
    if (ts.isPropertyAssignment(node)) { if (!ts.isIdentifier(node.name)) walk(node.name); walk(node.initializer); return; }
    if (ts.isMethodSignature(node) || ts.isPropertySignature(node)) return;
    if (ts.isShorthandPropertyAssignment(node)) {
      // `{ foo }` IS a read of `foo`.
      if (!known(node.name.text)) found.push({ name: node.name.text, pos: node.name.getStart(sf) });
      return;
    }
    if (ts.isLabeledStatement(node)) { walk(node.statement); return; }
    if (ts.isBreakOrContinueStatement(node)) return;
    if (ts.isQualifiedName(node)) { walk(node.left); return; }
    if (ts.isIdentifier(node)) {
      const p = node.parent;
      // A binding position, not a reference (already declared above).
      if (p && (ts.isBindingElement(p) || ts.isParameter(p) || ts.isVariableDeclaration(p)) && p.name === node) return;
      if (p && (ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === node) return;
      if (!known(node.text)) found.push({ name: node.text, pos: node.getStart(sf) });
      return;
    }
    node.forEachChild(walk);
  };

  hoist(sf.statements);
  sf.statements.forEach(walk);
  // One entry per name, with its first line — a name used fifty times is one finding.
  const byName = new Map();
  for (const f of found) {
    if (byName.has(f.name)) continue;
    byName.set(f.name, { name: f.name, line: sf.getLineAndCharacterOfPosition(f.pos).line + 1 });
  }
  return [...byName.values()].sort((a, b) => a.line - b.line);
}

/** The names a classic script puts into the shared global scope: its top-level
 *  declarations, plus anything it assigns to `window.` or to a bare name. */
export function pageNames(src, fileName = "x.js") {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const out = new Set();
  const bind = (n) => {
    if (!n) return;
    if (ts.isIdentifier(n)) return void out.add(n.text);
    if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n))
      for (const el of n.elements) if (!ts.isOmittedExpression(el)) bind(el.name);
  };
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) out.add(st.name.text);
    else if (ts.isClassDeclaration(st) && st.name) out.add(st.name.text);
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bind(d.name);
  }
  // `window.Foo = …` and `root.Foo = api` (a UMD footer) — the deliberate way a
  // script hands a name to the others. Found anywhere, not only at top level.
  for (const m of src.matchAll(/\b(?:window|globalThis|root|self)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) out.add(m[1]);
  return out;
}

/** Every name used as the operand of `typeof` — the ONE identifier position the
 *  language guarantees cannot throw, and therefore the idiom this app uses on
 *  purpose for a global that may or may not be on the page
 *  (`if (typeof sbSave === 'function') sbSave();`). A name guarded that way once
 *  is a deliberately-optional global, not a mistake. */
export function typeofNames(src) {
  return new Set([...src.matchAll(/\btypeof\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

// A SLOPPY-MODE IMPLICIT GLOBAL NEEDS NO SECOND READER. `galFilter = f` with no
// declaration anywhere DOES create a global — but only once that line has run,
// so a read before it still throws, and the walker above already reports the
// assignment as a free identifier because that is exactly what it is. A separate
// pass for it was written, measured, and deleted: it reported `TABLE` and
// `_bitBuffer` out of the vendored QR library, which are assignments to names
// declared in an enclosing FUNCTION scope — false alarms from a reader too
// shallow to see the scope the real walker sees. One walker, not two.

/* ─────────────────────────── the walker, driven ─────────────────────────── */

test("the walker finds a free identifier and is not fooled by the shapes that look like one", () => {
  // THE FIVE REAL INSTANCES, as their own shapes.
  assert.deepEqual(freeIdentifiers("function f(){ return gamesLoad(); }").map((x) => x.name), ["gamesLoad"],
    "the game deletion's own defect is not found");
  assert.deepEqual(freeIdentifiers("function f(a){ return !!a && !logoOk; }").map((x) => x.name), ["logoOk"],
    "a free name behind a short-circuit is not found — the one that reached main");
  assert.deepEqual(freeIdentifiers("function w(){ return fetch(u, {headers:{a:TOKEN}}); }\nfunction main(){ const TOKEN = 1; return TOKEN; }").map((x) => x.name),
    ["u", "TOKEN"], "a name that is a LOCAL of another function reads as declared");

  // AND THE SHAPES A NAIVE READER FLAGS. Every one of these is correct code.
  const fine = [
    "const a = {b: 1}; a.b = 2; a['c'] = 3;",                                  // property access and keys
    "function f({x, y: {z}, ...rest}, [p, , q] = []) { return x+z+rest+p+q; }", // destructuring, defaults, holes
    "try { go(); } catch (e) { console.log(e); } function go(){}",              // catch binding, hoisting
    "for (const k of xs) use(k); const xs = []; function use(){}",              // for-of binding, hoisted const
    "const o = {m(){ return 1; }, get g(){ return 2; }};",                      // methods and accessors
    "outer: for (;;) { break outer; }",                                          // a label is not a name
    "class A { constructor(){ this.x = new A(); } } new A();",                   // a class knows itself
    "const f = function me(n){ return n ? me(n-1) : 0; }; f(2);",                // named function expression
    "const {a = 1, b: c = a} = {}; void c;",                                     // defaults that read siblings
    "async function g(){ for await (const r of s()) void r; } function s(){}",   // for-await
    "let v; ({v} = {v: 1}); void v;",                                            // assignment destructuring
    "const t = `${x}`; var x = 1;",                                              // template + var hoisting
  ];
  for (const src of fine) assert.deepEqual(freeIdentifiers(src), [], "false alarm on: " + src);
});

/* ──────────────────── the real browser scripts, measured ──────────────────── */

/** The page as the browser sees it: every script it loads, and the one global
 *  scope they share. Derived from index.html, never a list kept here. */
function page() {
  const files = SCRIPTS.map((rel) => ({ rel, src: fs.readFileSync(ROOT + "public/" + rel, "utf8") }));
  const shared = new Set();
  const optional = new Set();
  for (const f of files) {
    for (const n of pageNames(f.src, f.rel)) shared.add(n);
    for (const n of typeofNames(f.src)) optional.add(n);
  }
  return { files, outer: new Set([...shared, ...optional]) };
}

test("no served browser script reads a name the page never defines", () => {
  // THE OBSERVERS, ALIVE FIRST: index.html really lists scripts, they exist, and
  // the shared scope really has something in it. Any of those empty would make
  // this pass over anything.
  assert.ok(SCRIPTS.length >= 2, "index.html lists no local scripts — every check below is vacuous: " + SCRIPTS.join(", "));
  const { files, outer } = page();
  assert.ok(outer.size >= 50, "the page's shared scope came out nearly empty (" + outer.size + ") — the reader is broken, not the code");
  const report = [];
  for (const { rel, src } of files) {
    assert.ok(src.length > 1000, rel + " is suspiciously small — the observer may be dead");
    for (const f of freeIdentifiers(src, rel, outer)) report.push(`${rel}:${f.line}  ${f.name}`);
  }
  assert.deepEqual(report, [], "a served script reads a name nothing on the page defines — it throws when that line runs:\n  " + report.join("\n  "));
});

test("the reader really reaches the app's own cross-file globals", () => {
  // THE ONE WAY THIS CHECK GOES QUIETLY WRONG is by forgiving too much: a
  // `pageNames` that over-collected, or a `typeofNames` that matched everything,
  // would answer "no free identifiers" over any file at all. So the two readers
  // are driven rather than trusted.
  assert.ok(pageNames("const A = 1; function b(){} window.C = 2; var {d, e} = x;").has("A"));
  for (const n of ["A", "b", "C", "d", "e"]) assert.ok(pageNames("const A = 1; function b(){} window.C = 2; var {d, e} = x;").has(n), n);
  assert.ok(!pageNames("function f(){ const inner = 1; return inner; }").has("inner"), "a function's local is not a page global");
  assert.ok(!pageNames("if (a === b) {}").has("b"), "a comparison is not an assignment");
  assert.deepEqual([...typeofNames("if (typeof sbSave === 'function') sbSave();")], ["sbSave"]);
  assert.deepEqual([...typeofNames("typeof x")], ["x"]);
  assert.deepEqual([...typeofNames("const t = typeof 1;")], [], "a typeof on a literal names nothing");
  // And the real page: the names the app hands between its scripts are found.
  const { outer } = page();
  for (const n of ["Auth", "EditPoll", "SiteList", "SiteZip", "qrcode", "SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
    assert.ok(outer.has(n), n + " is not in the page's shared scope — the reader missed a script or a form of assignment");
  }
  // The optional-global idiom is really in use, so exempting it is not free
  // permission for anything: these are the names a `typeof` guard protects.
  for (const n of ["sbSave", "sbMediaClear", "module"]) {
    assert.ok(outer.has(n), n + " is expected to be reached through a typeof guard and is not");
  }
});
