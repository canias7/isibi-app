/**
 * ONE OF A SITE'S OWN COMPONENTS, RENDERED WITH REAL REACT FROM ITS OWN `.tsx`.
 *
 * WHY A RENDER AND NOT A READING OF THE SOURCE. The question these callers ask
 * is *what does a visitor read* for a given set of props, and the answer is
 * decided by expressions inside the component — a ternary on a count, a
 * pluralisation, a branch on a loading flag. Asserting that by re-deriving the
 * arithmetic in the test would be a SECOND COPY of the component's own
 * decision, and the copy that drifts is the one nobody re-measures. Run 17 is
 * exactly this class: the page's arithmetic and the component's wording
 * disagreed, and nothing that read one file could see it.
 *
 * TYPESCRIPT AND REACT ARE ROOT DEV DEPENDENCIES and both are in the lockfile,
 * so `npm ci` gives CI the same two this runs on — the CI-step-that-does-not-
 * install-what-the-tests-import trap, checked rather than assumed. `esbuild` is
 * NOT at the root (it lives in the template), which is why the transpile is
 * `ts.transpileModule` and not esbuild.
 *
 * THE KIT PRIMITIVES ARE STUBBED TO THE ELEMENTS THEY RENDER, and they carry
 * NO WORDS of their own — so every sentence a caller reads back came out of the
 * component under test rather than out of a stub. A stub more capable than the
 * real thing hides bugs exactly like one that is less.
 */
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require_ = createRequire(import.meta.url);

const KIT = {
  react: React,
  "@/components/ui/input": { Input: (p) => React.createElement("input", p) },
  "@/components/ui/label": { Label: ({ children, ...p }) => React.createElement("label", p, children) },
};

/** `{html, text}` — the markup, and its words with every tag taken out. */
export function renderPart(src, props) {
  const js = ts.transpileModule(String(src == null ? "" : src), {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  const fn = new Function("require", "module", "exports", "React", js);
  fn((id) => (Object.hasOwn(KIT, id) ? KIT[id] : require_(id)), mod, mod.exports, React);
  const C = mod.exports.default;
  if (typeof C !== "function") throw new Error("the component has no default export");
  const html = renderToStaticMarkup(React.createElement(C, props));
  return { html, text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() };
}
