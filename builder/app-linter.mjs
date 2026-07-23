// Generated-app linter — the static half of "full generated-app testing" (ChatGPT meta-layer #4). Given the raw
// generator output (or a parsed {path: body} file map), it statically verifies the structural + wiring properties
// a generated Vite+React+Tailwind app must hold, WITHOUT a browser or a Claude call:
//   • required files present, forbidden files absent
//   • index.html has the mount point, module script, title + description
//   • index.css keeps the Tailwind directives
//   • HashRouter (never BrowserRouter) — so the app survives a refresh on static hosting
//   • every import resolves to the dependency allow-list or a local emitted file
//   • every ${API}/<segment> call points to a REAL capability (cross-checked against the registry)
//   • no fake buttons / dead links / unwired forms / unwired uploads (warnings)
//
// Errors block; warnings advise. The route check is the high-value one the registry unlocks: a generated app
// that calls an endpoint that doesn't exist is caught before it ever ships.
import { parseGeneratedFiles, REACT_DEPS } from "./react-gen.mjs";
import { getCapability } from "./capability-registry.mjs";

const ALLOWED_IMPORTS = new Set([...REACT_DEPS, "react-dom/client", "react/jsx-runtime"]);
const FORBIDDEN_FILES = [/^package\.json$/, /^package-lock\.json$/, /^vite\.config\./, /(^|\/)node_modules\//];

function stripComments(js) {
  // Rough: drop /* */ and // comments so we don't scan commented-out code. Not a full parser; good enough for lint.
  return js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Resolve a relative import against the emitted file set (.jsx/.js/index resolution).
function resolves(fromPath, spec, files) {
  const base = fromPath.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...base];
  for (const p of parts) { if (p === "." || p === "") continue; if (p === "..") stack.pop(); else stack.push(p); }
  const target = stack.join("/");
  const cands = [target, target + ".jsx", target + ".js", target + ".tsx", target + ".ts", target + "/index.jsx", target + "/index.js"];
  return cands.some((c) => files[c] != null) || /\.(css|svg|png|jpg|json)$/.test(target);
}

export function lintGeneratedApp(input, opts = {}) {
  const files = typeof input === "string" ? parseGeneratedFiles(input) : (input || {});
  const paths = Object.keys(files);
  const errors = [], warnings = [];
  const err = (rule, msg) => errors.push({ rule, msg });
  const warn = (rule, msg) => warnings.push({ rule, msg });

  if (!paths.length) { err("empty", "no files were produced"); return { ok: false, errors, warnings, fileCount: 0 }; }

  // R1 — required files.
  const has = (re) => paths.some((p) => re.test(p));
  if (!files["index.html"]) err("required-file", "index.html is missing");
  if (!files["src/main.jsx"]) err("required-file", "src/main.jsx is missing");
  if (!files["src/App.jsx"]) err("required-file", "src/App.jsx is missing");
  if (!files["src/index.css"]) err("required-file", "src/index.css is missing");
  if (!has(/^src\/pages\/.+\.jsx$/)) err("required-file", "no page under src/pages/");

  // R2 — forbidden files.
  for (const p of paths) for (const re of FORBIDDEN_FILES) if (re.test(p)) err("forbidden-file", `must not emit ${p}`);

  // R3 — index.html essentials.
  const html = files["index.html"] || "";
  if (html) {
    if (!/id=["']root["']/.test(html)) err("index-html", "index.html has no <div id=\"root\">");
    if (!/<script[^>]+type=["']module["'][^>]+src=["'][^"']*main\.jsx["']/.test(html)) err("index-html", "index.html does not load /src/main.jsx as a module");
    if (!/<title>[^<]*\S[^<]*<\/title>/.test(html)) warn("index-html", "index.html has no non-empty <title>");
    if (!/<meta[^>]+name=["']description["']/.test(html)) warn("index-html", "index.html has no <meta name=\"description\">");
    if (/<script[^>]+src=["']https?:/i.test(html) || /<link[^>]+href=["']https?:/i.test(html)) err("external", "index.html loads an external script/stylesheet (not allowed)");
  }

  // R4 — index.css keeps the Tailwind layers.
  const css = files["src/index.css"] || "";
  if (css && !(/@tailwind\s+base/.test(css) && /@tailwind\s+components/.test(css) && /@tailwind\s+utilities/.test(css))) {
    err("index-css", "src/index.css is missing the @tailwind base/components/utilities directives");
  }

  // R5 — HashRouter, never BrowserRouter (so refresh works on static hosting).
  const allJs = paths.filter((p) => /\.jsx?$/.test(p)).map((p) => stripComments(files[p])).join("\n");
  if (/\bBrowserRouter\b/.test(allJs)) err("router", "uses BrowserRouter — must use HashRouter (breaks on refresh under a sub-path)");
  const main = files["src/main.jsx"] || "";
  if (main && !/\bHashRouter\b/.test(stripComments(main) + stripComments(files["src/App.jsx"] || ""))) warn("router", "HashRouter not found in main.jsx/App.jsx");

  // R6 — imports resolve to the allow-list or a local file.
  for (const p of paths.filter((x) => /\.jsx?$/.test(x))) {
    const src = stripComments(files[p]);
    for (const m of src.matchAll(/\bimport\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g)) {
      const spec = m[1];
      if (spec.startsWith(".")) { if (!resolves(p, spec, files)) err("import", `${p}: relative import "${spec}" does not resolve to an emitted file`); }
      else { const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]; if (!ALLOWED_IMPORTS.has(spec) && !ALLOWED_IMPORTS.has(pkg)) err("import", `${p}: imports "${spec}" which is not in the dependency allow-list`); }
    }
    if (/https?:\/\/[^"']*\.(js|css)\b/.test(src) || /<script[^>]+src=["']https?:/.test(src)) err("external", `${p}: loads an external script/stylesheet (not allowed)`);
  }

  // R7 — every ${API}/<segment> call points to a real capability.
  const knownSeg = opts.isKnownSegment || ((seg) => !!getCapability(seg));
  const badRoutes = new Set(), seenRoutes = new Set();
  for (const p of paths.filter((x) => /\.jsx?$/.test(x))) {
    const src = stripComments(files[p]);
    // `${API}/<seg>` (template), `API + '/<seg>'` (concat), and a literal `/api/db/<slug>/<seg>`.
    for (const m of src.matchAll(/\$\{API\}\/([a-z0-9-]+)/g)) { seenRoutes.add(m[1]); if (!knownSeg(m[1])) badRoutes.add(m[1]); }
    for (const m of src.matchAll(/\bAPI\s*\+\s*["'`]\/([a-z0-9-]+)/g)) { seenRoutes.add(m[1]); if (!knownSeg(m[1])) badRoutes.add(m[1]); }
    for (const m of src.matchAll(/["'`]\/api\/db\/[^/"'`]+\/([a-z0-9-]+)/g)) { seenRoutes.add(m[1]); if (!knownSeg(m[1])) badRoutes.add(m[1]); }
  }
  for (const seg of badRoutes) err("api-route", `calls ${"${API}"}/${seg} but no such capability exists`);

  // R8 — fake buttons / dead links (warnings).
  for (const p of paths.filter((x) => /\.jsx$/.test(x))) {
    const src = files[p];
    if (/onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(src)) warn("fake-button", `${p}: an onClick handler that does nothing`);
    if (/<a\b(?![^>]*onClick)[^>]*href=["']#["']/.test(src)) warn("dead-link", `${p}: <a href="#"> with no onClick (dead link)`);
    if (/href=["']javascript:/.test(src)) warn("dead-link", `${p}: javascript: href`);
  }

  // R9 — forms + uploads are wired (warnings).
  if (/<form\b/.test(allJs)) {
    if (!/onSubmit=/.test(allJs)) warn("form", "a <form> exists but no onSubmit handler is defined");
    if (!/method:\s*["'](POST|PUT|PATCH)["']|fetch\([^)]*\{[^}]*method/i.test(allJs) && !/fetch\(/.test(allJs)) warn("form", "forms present but no write (POST/PUT/PATCH) fetch found");
  }
  if (/type=["']file["']/.test(allJs) && !/\$\{API\}\/(save|upload)/.test(allJs)) warn("upload", "a file input exists but nothing posts to /save or /upload");

  return { ok: errors.length === 0, errors, warnings, fileCount: paths.length, routesSeen: [...seenRoutes] };
}
