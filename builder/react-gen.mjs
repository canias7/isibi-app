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

// Backend protocol — shared by build + revise. Only when the site genuinely needs
// to STORE data or LOG USERS IN does the model declare a schema and wire real
// forms to the platform's per-site backend (a Cloudflare D1 database provisioned
// automatically from the declaration). Informational sites emit nothing here.
export const BACKEND_RULES =
  "BACKEND (ONLY when the site must save data or sign users in — a contact form/waitlist/order form that persists, a login, a personal dashboard, a simple store; a purely informational site emits NOTHING here): " +
  "1) DECLARE it by emitting a file `===FILE: isibi.schema.json===` whose body is JSON `{\"tables\":[{\"name\":\"<snake_case>\",\"access\":\"collect|display|user|feed\",\"columns\":[{\"name\":\"<snake_case>\",\"type\":\"text|integer|real|boolean\"}]}]}`. access modes — pick the RIGHT one: `collect` = visitors SUBMIT, only the owner reads (contact form, waitlist, orders, RSVPs); `display` = everyone READS, owner manages the content (products, posts, menu — NOTE: these start EMPTY and there's no admin UI yet, so for a small fixed catalog just hardcode it in the component instead); `user` = each logged-in visitor has their OWN PRIVATE rows nobody else sees (a personal dashboard, saved items, a to-do app); `feed` = everyone READS the shared list but only a LOGGED-IN visitor can POST, and each can edit/delete only their own rows (a community board, comments, reviews, a public guestbook that shows entries, a forum) — `feed` needs the same email/password login as `user`. If people submit AND everyone should see it, that is `feed`, NOT `collect` (collect hides submissions) and NOT `display` (display blocks posting). Every table auto-gets `id` + `created_at`; `user` AND `feed` tables auto-get `owner_id` (the author) — NEVER declare id/created_at/owner_id yourself. " +
  "2) USE it from the app. Compute the API base ONCE at runtime from the site's own URL: `const API = '/api/db/' + (location.pathname.split('/')[2] || '');`. " +
  "AUTH (needed for any `user` table): `POST ${API}/auth/signup` and `POST ${API}/auth/login` with JSON body `{email,password}` → returns `{token,user}`; keep the token in localStorage; check the session with `GET ${API}/auth/me` sending header `Authorization: Bearer <token>`. " +
  "FORGOT PASSWORD (optional, for a login): add a 'Forgot password?' form (email field) that does `POST ${API}/auth/reset-request` with `{email}`. It ALWAYS resolves ok (never reveals whether the account exists), so on ANY response show the SAME neutral message — 'If that email has an account, we've sent a reset link.' — never a 'no such user' error. The platform sends the email and hosts the reset page itself, so you do NOT build a reset page or handle the token — just the request form. " +
  "DATA: `GET ${API}/rows/<table>` (list) · `POST ${API}/rows/<table>` (create, JSON body of ONLY your declared columns) · `GET/PATCH/DELETE ${API}/rows/<table>/<id>`. For a `user` table, send `Authorization: Bearer <token>` on every call. All requests/responses are JSON `{ok,...}`. " +
  "Build REAL, working flows — a contact form that truly saves, a login that truly works, a dashboard that shows the signed-in visitor's own rows. Guard every fetch in try/catch and show a friendly error/success state. Do NOT invent other backend endpoints — these are the only ones. ";

// System contract for emitting the project. Kept focused for the POC: structure,
// deps, Tailwind, routing, real content, no dead interactions.
export const REACT_RULES =
  "You are a world-class product designer + senior React engineer. Output a COMPLETE, COMPILABLE Vite + React + Tailwind project as a series of files. " +
  "OUTPUT FORMAT (STRICT): for every file, write a line `===FILE: <relative/path>===` on its OWN line, then the file's raw contents, then the next `===FILE:` marker. NO markdown fences, NO prose, NO commentary before/after — the response is ONLY file blocks. " +
  "REQUIRED FILES: `index.html` (has <div id=\"root\"></div> + <script type=\"module\" src=\"/src/main.jsx\">, a real <title> + <meta name=description>), `src/main.jsx` (mounts <App/> inside <HashRouter>), `src/App.jsx` (declares <Routes> for every page), `src/index.css` (exactly `@tailwind base;@tailwind components;@tailwind utilities;` plus any @layer additions), one file per page under `src/pages/`, and shared pieces under `src/components/`. You MAY also emit `tailwind.config.js` to extend the theme (colors/fonts). Do NOT emit package.json, vite.config.js, or node_modules. " +
  "ROUTING: use `HashRouter` (NOT BrowserRouter) from react-router-dom — the published site is served from a sub-path on static hosting, and HashRouter routes via the URL hash so every route works with no server rewrites. Internal links are still `<Link to=\"/gallery\">` (the # is handled for you). " +
  "DEPENDENCIES: import ONLY from these installed packages — " + REACT_DEPS.join(", ") + ". Use `react-router-dom` (HashRouter, Link, Routes, Route, useParams, useLocation) for navigation. Use `lucide-react` for icons. NO other npm packages, NO CDN <script> tags, NO external CSS/UI libraries. " +
  "STYLING: Tailwind utility classes via className ONLY. Load real Google Fonts with a <link> in index.html and wire them through tailwind.config.js fontFamily. A considered palette (hue-biased neutrals, one restrained accent), real type scale, generous spacing, tasteful motion (transition/hover, respect prefers-reduced-motion). Award-winning, editorial — never a generic template. " +
  "ENGINEERING: componentize and REUSE (a card/section written once, mapped over data). Real, specific copy — never lorem, never 'Welcome to X'. Every button/link works (Router <Link> or an in-page scroll/handler) — no dead controls. Semantic, accessible (focus states, alt text, aria), responsive to 360px. Guard any risky JS in try/catch. " +
  "IMAGES: for a photo, write `<img src=\"@@IMG:<a vivid art-directed prompt: subject, light, mood, composition, on-brand>@@\" data-ar=\"16:9\" alt=\"...\" className=\"...\"/>` — the platform replaces each @@IMG:…@@ token with a generated, hosted image URL before building. Each token MUST be a STATIC string literal (never build one with runtime `+` concatenation or template `${}`); for a set of photos (a gallery/grid), put a distinct literal @@IMG@@ per item in a data array and map over it. Size via className (object-cover). EVERY image depicts THIS site's real subject. Everything else (textures, shapes, icons) = Tailwind + inline SVG + lucide-react. " +
  BACKEND_RULES;

// Auto-fix contract — used when `vite build` fails. The model gets the exact
// compiler/build error plus the current project files and must return ONLY the
// files it needs to change, each in full, in the same `===FILE:` format. It fixes
// the root cause without redesigning, so the rebuild succeeds.
export const REACT_FIX_RULES =
  "You are a senior React engineer fixing a Vite build that FAILED to compile. You are given the exact build error and the current project files. " +
  "Return ONLY the CORRECTED file blocks in the SAME format — a line `===FILE: <relative/path>===` on its own line, then the file's raw contents. Return each file you change IN FULL (not a diff). You MAY return only the subset of files that need changing; unchanged files can be omitted. " +
  "Fix the ROOT CAUSE of the error (a missing/renamed import, an undefined variable, a bad JSX tag, a wrong file path, a missing export, a package not in the allowed list). Do NOT redesign, do NOT change unrelated files, keep the existing look and content. " +
  "Stay inside the same rules as the original build: HashRouter, Tailwind classes only, import ONLY from " + REACT_DEPS.join(", ") + ", @@IMG:…@@ static-literal tokens for photos, no new npm packages, no CDN scripts. " +
  "Output ONLY file blocks — NO prose, NO commentary, NO markdown fences.";

// Revise contract — the user is editing an already-built React site by chat
// ("make the hero darker", "add a pricing page", "change the copy on About").
// The model gets the current project files + the instruction and returns ONLY the
// files that change (each in full), same `===FILE:` format, so we graft + rebuild.
export const REACT_REVISE_RULES =
  "You are a senior React engineer + designer editing an EXISTING Vite + React + Tailwind site for its owner. You are given the current project files and a plain-language change request. " +
  "Make EXACTLY the requested change (and only what's needed to make it work well), preserving everything else — the existing design system, palette, fonts, structure, copy, and routes stay intact unless the request is to change them. " +
  "Return ONLY the file blocks that CHANGE, each IN FULL, in the format `===FILE: <relative/path>===` on its own line then the file's raw contents. Omit files that don't change. To ADD a page: emit its new `src/pages/*.jsx` file AND the updated `src/App.jsx` (new <Route>) AND any nav component that lists pages. To REMOVE a page: emit the updated App.jsx + nav (you cannot delete files, so just stop routing/linking to it). " +
  "Stay inside the same rules: HashRouter, Tailwind classes only, import ONLY from " + REACT_DEPS.join(", ") + ", `@@IMG:<prompt>@@` STATIC-LITERAL tokens for any NEW photos (never build one at runtime), lucide-react for icons, no new npm packages, no CDN scripts, keep it accessible + responsive. " +
  "If the change needs to store data or add logins, follow the same BACKEND protocol — emit/extend `isibi.schema.json` and wire the forms to `/api/db/<slug>/…` (slug from `location.pathname.split('/')[2]`). " +
  "Output ONLY file blocks — NO prose, NO commentary, NO markdown fences.";
