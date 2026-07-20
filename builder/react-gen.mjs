// Phase 2 — React project generation contract + parser.
//
// Sonnet emits a whole Vite/React/Tailwind PROJECT as a series of file blocks,
// each introduced by a line `===FILE: <relative/path>===`. This delimiter format
// avoids JSON-escaping code (quotes, backslashes, newlines) which is fragile for
// large multi-file output. The parser turns that text into { "<path>": "<src>" }
// ready to POST to the build-service.
//
// The build-service only allows writes to index.html / vite,tailwind,postcss
// configs / src/**, and the image deps are pre-baked, so the model MUST stay
// inside that shape and use ONLY the pinned packages.

export function parseGeneratedFiles(text) {
  const files = {};
  const s = String(text || "");
  // Split on the FILE markers (kept as capture groups → [pre, path, body, path, body, ...]).
  const parts = s.split(/^===FILE:\s*(.+?)\s*===[ \t]*$/gm);
  for (let i = 1; i < parts.length; i += 2) {
    const rawPath = (parts[i] || "").trim();
    let body = parts[i + 1] || "";
    // Trim one leading newline and trailing whitespace; strip an accidental
    // ```lang fence the model may wrap a block in.
    body = body.replace(/^\r?\n/, "").replace(/\s+$/, "");
    body = body.replace(/^```[a-zA-Z]*\r?\n/, "").replace(/\r?\n```$/, "");
    if (rawPath) files[rawPath] = body;
  }
  return files;
}

// The allowed dependency set (must match builder/package.json). The generator is
// told these are the ONLY importable packages.
export const REACT_DEPS = [
  "react", "react-dom", "react-router-dom", "lucide-react", "clsx", "tailwind-merge",
];

// System contract for emitting the project. Kept focused for the POC: structure,
// deps, Tailwind, routing, real content, no dead interactions. (Backend
// integrations — forms/auth/collections — get folded in during a later pass.)
export const REACT_RULES =
  "You are a world-class product designer + senior React engineer. Output a COMPLETE, COMPILABLE Vite + React + Tailwind project as a series of files. " +
  "OUTPUT FORMAT (STRICT): for every file, write a line `===FILE: <relative/path>===` on its OWN line, then the file's raw contents, then the next `===FILE:` marker. NO markdown fences, NO prose, NO commentary before/after — the response is ONLY file blocks. " +
  "REQUIRED FILES: `index.html` (has <div id=\"root\"></div> + <script type=\"module\" src=\"/src/main.jsx\">, a real <title> + <meta name=description>), `src/main.jsx` (mounts <App/> inside <HashRouter>), `src/App.jsx` (declares <Routes> for every page), `src/index.css` (exactly `@tailwind base;@tailwind components;@tailwind utilities;` plus any @layer additions), one file per page under `src/pages/`, and shared pieces under `src/components/`. You MAY also emit `tailwind.config.js` to extend the theme (colors/fonts). Do NOT emit package.json, vite.config.js, or node_modules. " +
  "ROUTING: use `HashRouter` (NOT BrowserRouter) from react-router-dom — the published site is served from a sub-path on static hosting, and HashRouter routes via the URL hash so every route works with no server rewrites. Internal links are still `<Link to=\"/gallery\">` (the # is handled for you). " +
  "DEPENDENCIES: import ONLY from these installed packages — " + REACT_DEPS.join(", ") + ". Use `react-router-dom` (HashRouter, Link, Routes, Route, useParams, useLocation) for navigation. Use `lucide-react` for icons. NO other npm packages, NO CDN <script> tags, NO external CSS/UI libraries. " +
  "STYLING: Tailwind utility classes via className ONLY. Load real Google Fonts with a <link> in index.html and wire them through tailwind.config.js fontFamily. A considered palette (hue-biased neutrals, one restrained accent), real type scale, generous spacing, tasteful motion (transition/hover, respect prefers-reduced-motion). Award-winning, editorial — never a generic template. " +
  "ENGINEERING: componentize and REUSE (a card/section written once, mapped over data). Real, specific copy — never lorem, never 'Welcome to X'. Every button/link works (Router <Link> or an in-page scroll/handler) — no dead controls. Semantic, accessible (focus states, alt text, aria), responsive to 360px. Guard any risky JS in try/catch. " +
  "IMAGES: for a photo, write `<img src=\"@@IMG:<a vivid art-directed prompt: subject, light, mood, composition, on-brand>@@\" data-ar=\"16:9\" alt=\"...\" className=\"...\"/>` — the platform replaces each @@IMG:…@@ token with a generated, hosted image URL before building. Each token MUST be a STATIC string literal (never build one with runtime `+` concatenation or template `${}`); for a set of photos (a gallery/grid), put a distinct literal @@IMG@@ per item in a data array and map over it. Size via className (object-cover). EVERY image depicts THIS site's real subject. Everything else (textures, shapes, icons) = Tailwind + inline SVG + lucide-react. ";
