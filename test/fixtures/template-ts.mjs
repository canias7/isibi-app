// LOAD A SITE-TEMPLATE TYPESCRIPT MODULE FOR REAL (2026-10-27): the file and
// every local TypeScript module it imports, transpiled beside the originals (so
// the copied `./effects/*.mjs` modules resolve), imported, then removed. A
// module already being emitted is not emitted again, so an import cycle loads
// instead of recursing for ever.
import fs from "node:fs";
import ts from "typescript";

let loads = 0;
export async function loadTemplate(rel) {
  const dir = new URL("../../builder/lovable/template/src/", import.meta.url);
  const made = [];
  const emitted = new Set();
  const tag = ++loads + "_" + process.pid;
  const emit = (r) => {
    const out = new URL(r.replace(/\.ts$/, `.__t${tag}.mjs`), dir);
    if (emitted.has(r)) return out;
    emitted.add(r);
    const src = fs.readFileSync(new URL(r, dir), "utf8");
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    js = js.replace(/from "(\.\.?\/[^"]+?)"/g, (m, spec) => {
      if (spec.endsWith(".mjs")) return m;
      const tsRel = new URL(spec + ".ts", new URL(r, dir)).href.slice(dir.href.length);
      if (fs.existsSync(new URL(tsRel, dir))) { emit(tsRel); return `from "${spec}.__t${tag}.mjs"`; }
      return `from "${spec}.mjs"`;
    });
    fs.writeFileSync(out, js);
    made.push(out.href);
    return out;
  };
  const top = emit(rel);
  try { return await import(top.href); } finally { for (const f of made) fs.rmSync(new URL(f), { force: true }); }
}
