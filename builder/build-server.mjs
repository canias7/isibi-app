// isibi SITE build-service (runs inside the container). Forks ../builder-game/build-server.mjs
// with kaplay swapped back out for the React template, and a `tsc --noEmit` gate in
// front of `vite build` — GENERATOR.md's definition of done is both, so a page that
// only happens to bundle is still a failure here.
//
// Contract:
//   POST /build   { "files": { "index.tsx": "<tsx source>", ... },   // relative to src/routes/
//                   "slug":  "<site slug>",                          // OPTIONAL, baked as VITE_SITE_SLUG
//                   "title": "<brand>",                              // OPTIONAL, the <title> tag + the mark
//                   "lang":  "<bcp-47>" }                            // OPTIONAL, the <html lang> attribute
//     → 200 { "ok": true,  "files": {…dist…}, "ms": N }
//     → 200 { "ok": false, "error": "<tsc output>",  "stage": "typecheck" }
//     → 200 { "ok": false, "error": "<vite stderr>", "stage": "build" }
//   GET  /health  → 200 "ok"
//
// Every build starts from the same shell. src/routes is reset to the pristine copy
// baked into the image (__root.tsx only) before the generated files land, so the
// previous build's pages — and the template's own reference page, which queries a
// schema this site does not have — can never leak into someone's site.
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolvePair, fontCss, fontImports } from "./site-fonts.mjs";
import { themeCss } from "./site-theme.mjs";
import { resolveTheme } from "./site-theme-registry.mjs";
import { tokensCss, stripThemeRadius, validForWrite } from "./site-tokens.mjs";
import { applyStyle, explicitRadiusCss } from "./site-style.mjs";
import { applyIdentity, initialsMark, normalizeLang } from "./site-identity.mjs";
import { exitReason } from "./exit-reason.mjs";

const APP = process.env.APP_DIR || "/app";
const ROUTES = path.join(APP, "src", "routes");
const ROUTES_BASE = path.join(APP, ".routes-base");
const INDEX_BASE = path.join(APP, ".index-base.html");
const STYLES_BASE = path.join(APP, ".styles-base.css");
const STYLES = path.join(APP, "src", "styles.css");
const DIST = path.join(APP, "dist");
// The server bundle the prerender loads. Kept OUT of `dist`, which is
// collected wholesale and published — shipping the SSR build to R2 would
// double every site's size with code no visitor runs.
const SSR_DIR = "dist-ssr";
const GEN = path.join(APP, "src", "routeTree.gen.ts");
const MAX_BODY = 4 * 1024 * 1024;
const STEP_TIMEOUT = 150_000;

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

// Allowlist writes under src/routes: a .tsx file, no traversal, and never the
// root layout or the generated route tree.
function safeRoute(rel) {
  const p = path.normalize(String(rel)).replace(/\\/g, "/").replace(/^(\.\.(\/|$))+/, "").replace(/^\/+/, "");
  if (!p || p.startsWith("/") || p.includes("..")) return null;
  const bare = p.replace(/^(?:src\/)?routes\//, "");
  if (!/^[a-z0-9_$][a-z0-9._$\/-]*\.tsx$/i.test(bare)) return null;
  if (/^__root\.tsx$/i.test(bare) || /routeTree\.gen/i.test(bare)) return null;
  return bare;
}

function resetRoutes() {
  try { fs.rmSync(ROUTES, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(ROUTES, { recursive: true });
  for (const name of fs.readdirSync(ROUTES_BASE)) {
    fs.copyFileSync(path.join(ROUTES_BASE, name), path.join(ROUTES, name));
  }
  try { fs.rmSync(GEN, { force: true }); } catch {}
  try { fs.rmSync(DIST, { recursive: true, force: true }); } catch {}
  // AND THE SERVER BUNDLE, for the same reason as `dist` and the route tree.
  // This container is long-lived and serves every build on the platform; a
  // stale `dist-ssr` left behind by a failed SSR build is one site's pages
  // waiting to be rendered into another site's snapshots. That exact class —
  // one build's files leaking into the next — has happened here before, and it
  // is cheaper to delete than to reason about.
  try { fs.rmSync(path.join(APP, SSR_DIR), { recursive: true, force: true }); } catch {}
}

// The published tab: the business's name, its language, and its own mark.
//
// ALWAYS FROM `INDEX_BASE`, never from the last build's output — this is the one
// file every route's prerendered head derives from, and rewriting it in place
// would compound one site's title, language and icon into the next one's.
//
// THE ICON IS WRITTEN TO `icon.svg` RATHER THAN OVER `favicon.svg`. The template
// ships a real `public/favicon.svg` and this container is long-lived, serving
// every build on the platform: overwriting it leaves no pristine copy, so the
// first site's mark becomes the fallback for every site afterwards that has no
// brand. Deleted before every build for the same reason `src/routes` is — a
// stale one is one site's mark on another's tab.
function writeIndexHtml(title, lang, brand) {
  const base = fs.readFileSync(INDEX_BASE, "utf8");
  const iconPath = path.join(APP, "public", "icon.svg");
  try { fs.rmSync(iconPath, { force: true }); } catch {}

  let icon = null;
  try {
    const svg = initialsMark(brand || title);
    if (svg) {
      fs.mkdirSync(path.dirname(iconPath), { recursive: true });
      fs.writeFileSync(iconPath, svg);
      icon = "/icon.svg";
    }
  } catch {
    // A site keeps the template's mark. Failing a build over a tab icon would
    // trade a working site for a decoration.
    icon = null;
  }

  fs.writeFileSync(path.join(APP, "index.html"), applyIdentity(base, { title, lang, icon }));
  return { lang: normalizeLang(lang), icon: !!icon };
}

// The site's typeface, written per build.
//
// It cannot be a static import in the template: the 24 shortlist packages would
// then be bundled into EVERY site, so a barber shop would ship 21 MB of fonts it
// never renders. So the two the site actually chose are written here, and Vite
// bundles exactly those.
//
// Written by the build service rather than by the model, deliberately. Model
// output is allow-listed to .tsx under src/routes (see `safeRoute`), and that
// boundary is the reason a generated page cannot reach the rest of the app. The
// model names two fonts; it never names a path.
//
// `fontFiles` carries any font that had to be FETCHED, already downloaded by the
// Worker and passed as base64. The Worker does the fetching because it certainly
// has network at request time, which is not something to assume of a container.
function writeFonts(fonts, fontFiles) {
  const pair = resolvePair(fonts || {});
  const written = {};
  const dir = path.join(APP, "public", "fonts");
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [id, b64] of Object.entries(fontFiles || {})) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || typeof b64 !== "string") continue;
    let bytes; try { bytes = Buffer.from(b64, "base64"); } catch { continue; }
    // woff2 or nothing. This is bytes from off the platform being written into a
    // customer's site; the magic number is the one cheap check that it is a font.
    if (bytes.length < 4 || bytes.length > 2_000_000 || bytes.subarray(0, 4).toString() !== "wOF2") continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + ".woff2"), bytes);
    written[id] = `/fonts/${id}.woff2`;
  }

  // The values go into styles.css's own @theme block, restored from a pristine
  // copy each build the way index.html is.
  //
  // The obvious approach — a separate fonts.css imported after styles.css —
  // silently produced NOTHING. Measured: the chosen family appeared nowhere in
  // the dist. Tailwind's @theme emits its own `:root` that lands last, so the
  // minifier proved the earlier declarations dead and removed them. The build
  // reported the right fonts and shipped the defaults, which is the exact shape
  // of failure this feature exists to end.
  //
  // Writing into @theme is not a workaround: that block is documented in the
  // template as "the generator adds this app's own fonts here", and being the
  // theme means there is no ordering to lose.
  // Restored from the pristine copy, and FAILS SOFT if there isn't one. An older
  // image, or a sandbox that did not make the copy, would otherwise throw here
  // and take the whole build with it — trading every site for a typeface, which
  // is backwards from every other decision in this file. Found by a probe that
  // forgot the copy: the build returned ENOENT instead of a site.
  let base = null;
  try { base = fs.readFileSync(STYLES_BASE, "utf8"); }
  catch { try { base = fs.readFileSync(STYLES, "utf8"); } catch { base = null; } }
  const decls = fontCss(pair, written);
  // Appended at the END of the block, not the start. Within one @theme the later
  // declaration wins, and the template declares its own --font-sans default
  // further down — so inserting at the top wrote the site's choice and then had
  // it overridden three lines later. The build reported the right fonts and the
  // bundle carried the defaults: measured, and invisible from the response.
  const applied = base != null && /@theme\s*\{[^}]*\}/.test(base);
  if (applied) {
    const themed = base.replace(/(@theme\s*\{[^}]*?)(\n?\})/, (_m, body, close) => body + "\n" + decls.vars + "\n" + close);
    fs.writeFileSync(STYLES, (decls.faces ? decls.faces + "\n" : "") + themed);
  }

  const imports = fontImports(pair).map((p) => `import "${p}";`).join("\n");
  fs.writeFileSync(
    path.join(APP, "src", "fonts.ts"),
    `// Generated per build by build-server.mjs. Do not edit.\n${imports}\n`,
  );
  const notes = pair.notes.slice();
  if (!applied) notes.push("The stylesheet could not be read, so the site kept the default typeface.");
  return { heading: pair.heading.id, body: pair.body.id, applied, fetched: Object.keys(written), notes };
}

// The site's own logo, baked into the bundle rather than injected into the head.
//
// WRITTEN ON EVERY BUILD, INCLUDING WHEN THERE IS NONE. This container is
// long-lived and serves every build on the platform, so a file left behind by
// the last site is that site's logo on this one's header — the same leak
// `resetRoutes` and the per-build icon already guard against. An empty string is
// a real answer here and has to be written as one.
//
// ONLY AN ABSOLUTE https URL OR A SITE-RELATIVE `/u/` PATH. The value ends up in
// a `src` inside generated TypeScript, so it is quoted with JSON.stringify AND
// bounded to shapes that cannot be a `javascript:` URL — the string comes from
// our own `_meta`, but "it came from us" is how the first person to reach that
// row through some other route gets an XSS on a customer's site.
function writeSiteLogo(logo) {
  const s = typeof logo === "string" ? logo.trim() : "";
  const ok = /^https:\/\/[^\s"'<>]+$/i.test(s) || /^\/u\/[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9._-]{1,120}$/i.test(s);
  const value = ok ? s : "";
  fs.writeFileSync(
    path.join(APP, "src", "site-brand.ts"),
    "// Generated per build by build-server.mjs. Do not edit.\n" +
      "export const SITE_LOGO = " + JSON.stringify(value) + ";\n",
  );
  return { logo: !!value, refused: !!s && !ok };
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: APP, env: { ...process.env, ...(env || {}) } });
    let err = "", out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ code: -1, signal: null, out, err: "timed out after " + Math.round(STEP_TIMEOUT / 1000) + "s" }); }, STEP_TIMEOUT);
    // THE SIGNAL, not just the code. A killed process closes with `code: null`
    // and the signal that killed it — and `null !== 0` reads as an ordinary
    // failure, so a SIGKILL was reported as a build that failed for no stated
    // reason. See `exitReason` for what that cost.
    child.on("close", (code, signal) => { clearTimeout(to); resolve({ code, signal, out, err }); });
    child.on("error", (e) => { clearTimeout(to); resolve({ code: -1, signal: null, out, err: String((e && e.message) || e) }); });
  });
}


function collectDist(dir = DIST, base = "") {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + "/" + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) Object.assign(out, collectDist(full, rel));
    else {
      const buf = fs.readFileSync(full);
      if (/\.(html|css|js|mjs|svg|json|map|txt|xml|webmanifest)$/i.test(name)) out[rel] = { t: buf.toString("utf8") };
      else out[rel] = { b: buf.toString("base64") };
    }
  }
  return out;
}

// ── A REAL DOCUMENT PER ROUTE ───────────────────────────────────────────────
//
// Without this a published page is an empty `<div id="root">` and a bundle. A
// search engine runs JavaScript so it gets there eventually; A LINK PREVIEW DOES
// NOT — WhatsApp, iMessage and Slack fetch the HTML once and read the head — so
// every page shared anywhere showed the home page's card. This renders the first
// frame of each route to HTML at build time, which is what both actually want.
//
// NEVER FAILS THE BUILD. A route it cannot render simply gets no file, and the
// Worker's fallback then serves the app shell at that address — precisely the
// behaviour before this existed. A snapshot is worth having and is never worth
// losing a working site for.
//
// The routes are read off the files that are really there rather than a list,
// following TanStack's own mapping: `index.tsx` → `/`, `book.tsx` → `/book`,
// `menu/index.tsx` → `/menu`. `__root` is the layout, not a page, and anything
// with a `$` is a dynamic segment whose values are not known here.
function routePaths() {
  const out = [];
  const walk = (dir, base) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full, base + name + "/"); continue; }
      if (!name.endsWith(".tsx") || name.startsWith("__") || name.includes("$")) continue;
      const stem = name.slice(0, -4);
      const p = stem === "index" ? base : base + stem;
      out.push("/" + p.replace(/\/$/, ""));
    }
  };
  try { walk(ROUTES, ""); } catch { return []; }
  return [...new Set(out)];
}

async function prerender() {
  const done = [], skipped = [];
  let render;
  try {
    const ssr = await run("npx", ["vite", "build", "--ssr", "src/entry-server.tsx", "--outDir", SSR_DIR, "--logLevel", "error"], {});
    if (ssr.code !== 0) return { done, skipped: ["*: ssr build failed"] };
    // Cache-busted, because the container is long-lived and serves every build
    // on the platform — a plain import would hand build two the module build one
    // compiled, and every site after the first would be snapshotted as the first.
    const mod = await import(pathToFileURL(path.join(APP, SSR_DIR, "entry-server.js")).href + "?v=" + Date.now());
    render = mod && mod.render;
  } catch (e) { return { done, skipped: ["*: " + String((e && e.message) || e).slice(0, 200)] }; }
  if (typeof render !== "function") return { done, skipped: ["*: entry-server exports no render"] };

  let shell;
  try { shell = fs.readFileSync(path.join(DIST, "index.html"), "utf8"); } catch { return { done, skipped: ["*: no index.html"] }; }
  const slot = shell.indexOf('<div id="root">');
  if (slot < 0) return { done, skipped: ["*: no root element in the shell"] };
  const open = shell.slice(0, slot + '<div id="root">'.length);
  const close = shell.slice(shell.indexOf("</div>", slot));

  for (const p of routePaths()) {
    try {
      const body = await render(p);
      // A THROW DURING A SERVER RENDER DOES NOT REACH US. React catches it,
      // switches that subtree to client rendering and returns markup — 5.6 KB of
      // it, containing no words — with no exception anywhere. Every route
      // "succeeded" and every snapshot was empty, measured on the first run. So
      // the marker React leaves behind is checked, and so is the presence of
      // actual text: a snapshot with no words in it is not one worth publishing.
      if (/Switched to client rendering/.test(body)) { skipped.push(p + ": render errored (client fallback)"); continue; }
      if (!/>[^<>]*[A-Za-z]{3,}/.test(body)) { skipped.push(p + ": rendered no text"); continue; }
      const file = p === "/" ? "index.html" : p.replace(/^\//, "") + ".html";
      const full = path.join(DIST, file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, open + body + close);
      done.push(p);
    } catch (e) { skipped.push(p + ": " + String((e && e.message) || e).slice(0, 120)); }
  }
  return { done, skipped };
}

// One build at a time. Not an optimisation — a correctness requirement.
//
// `getContainer(env.SITE_BUILD_CONTAINER)` is called with no id, so EVERY build
// on the platform lands in this one container, and a build wipes a shared
// src/routes (and dist, and the generated route tree) before writing its own
// pages. Two arriving together destroy each other: observed 2026-07-29 with two
// The theme's own CSS, appended to whatever writeFonts left behind.
//
// AFTER writeFonts, NEVER BEFORE, and the ordering is the whole correctness
// argument. `writeFonts` restores styles.css from the pristine base and writes
// it out; running first would mean the theme is written and then overwritten by
// a stylesheet restored from a copy that never had it. Appending is also why
// this cannot use the @theme block fonts uses: themeCss emits real `:root` and
// `.dark` RULES, not @theme variables, and the template declares its own token
// values at :root further up — so the theme has to land after them to win.
//
// FAILS SOFT, like the font write. A site whose data layer is live and whose
// pages compiled should not be lost over decoration: an unknown name, an
// unreadable stylesheet or a throwing engine all leave the template's own look
// in place and say so in the notes.
function writeTheme(name, { dropRadius = false, style = null } = {}) {
  if (!name) return { applied: false, theme: null, notes: [] };
  const theme = resolveTheme(name);
  if (!theme) return { applied: false, theme: null, notes: [`No theme called "${String(name).slice(0, 40)}" — the site kept the default look.`] };
  let css;
  // THE SITE'S OWN LOOK DECISIONS, merged into the theme BEFORE it is rendered
  // rather than patched over it afterwards. Every axis emitter already reads its
  // value off this object, so a merged theme generates the right CSS for all
  // twelve — including the three that emit ordinary RULES rather than custom
  // properties, which no later-wins patch could reach coherently. See
  // builder/site-style.mjs for why that decided the shape.
  try { css = themeCss(applyStyle(theme, style)); }
  catch { return { applied: false, theme: null, notes: ["The theme could not be rendered, so the site kept the default look."] }; }
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, theme: null, notes: ["The stylesheet could not be read, so the site kept the default look."] }; }
  // 280 OF THE 500 THEMES hard-set `border-radius` on buttons and inputs as real
  // rules rather than through `--radius`, so on a majority of sites a corner
  // override moved the cards and left every button square — a feature reported
  // as broken. When the customer has actually asked for a radius, the theme's
  // own corner rules give way to it; with no override nothing changes at all.
  //
  // AND THEN THE CUSTOMER'S OWN CORNER OPINIONS GO BACK, which is the one place
  // the two patches interact. `stripThemeRadius` is a regex and cannot tell a
  // theme's hard-set button radius from the one `buttons: "pill"` just asked
  // for, so "rounder corners AND pill buttons" got the first and silently lost
  // the second. The rule that resolves it is the one already in force here: an
  // EXPLICIT corner opinion beats an implicit one. Empty unless those axes were
  // named, so nothing changes for a patch that did not mention them.
  const shaped = dropRadius ? stripThemeRadius(css) + explicitRadiusCss(style) : css;
  fs.writeFileSync(STYLES, base + "\n" + shaped + "\n");
  return { applied: true, theme: name, notes: [] };
}

// The site's OWN colours, written AFTER the theme.
//
// A separate function and a separate write, because it has to land after
// `writeTheme` whether or not a theme applied — that is the entire mechanism:
// these are the same custom properties the theme declares, and later wins. A
// site with no theme still gets its patch, over the template's own `:root`.
//
// FAILS SOFT like everything else here, and one step softer: a site whose data
// layer is live, whose pages compiled and whose theme applied must not be lost
// because one colour could not be written. `tokensCss` returns "" for an empty
// or unusable patch, so a build that never asked for one writes nothing at all
// and its stylesheet is byte-identical to the build before this existed.
function writeTokens(tokens) {
  let css;
  try { css = tokensCss(tokens); }
  catch { return { applied: false, notes: ["Those colours could not be applied, so the site kept the theme's own."] }; }
  if (!css) return { applied: false, notes: [] };
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, notes: ["Those colours could not be applied, so the site kept the theme's own."] }; }
  fs.writeFileSync(STYLES, base + "\n" + css);
  return { applied: true, notes: [] };
}

// real builds a second apart — one returned a build failure with no files, the
// other returned a bundle containing neither site's content, and a third run had
// one customer's pages published to another customer's slug.
//
// Serialised rather than given a directory each. A per-build working copy would
// allow real parallelism, but it multiplies disk and memory per concurrent build
// in a container sized for one, and this is the fix that cannot itself be
// subtly wrong. Cloudflare scales container INSTANCES; this only has to make one
// instance honest.
let _chain = Promise.resolve();
function oneAtATime(fn) {
  // The chain is normalised: the result value is dropped so a finished build's
  // whole dist is not retained by the queue, and a rejection is swallowed so it
  // cannot surface as an unhandled one. Not exercised by the handler below,
  // which catches everything itself — kept because those are properties of the
  // primitive rather than of its current only caller.
  const done = _chain.then(fn, fn);
  _chain = done.then(() => {}, () => {});
  return done;
}

// WHICH TEMPLATE IS BAKED INTO THIS IMAGE.
//
// The template — `@/lib/rows.ts` above all — is baked into the container image,
// and Cloudflare's image rollout is ASYNCHRONOUS: `wrangler` returns after
// "Modified application" and the next request can still reach the previous
// image for a minute or more. So a build can be served by code that is one
// change behind, and its published bundle is that older code.
//
// This has now cost two full diagnoses. The smoke test guarded against it with a
// marker string, but a marker only proves the image is at least as new as the
// change that introduced it — after the NEXT change it passes while testing
// stale code, which is exactly what happened on 2026-08-04 to a booking-form fix.
//
// A digest cannot go stale that way: it changes with every edit to the file, so
// the caller can compare it against its own checkout and know, exactly, whether
// this run tested the code under test.
const TEMPLATE_ID = (() => {
  try {
    const f = path.join(APP, "src", "lib", "rows.ts");
    return createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
  } catch { return "unknown"; }
})();

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); res.end("ok " + TEMPLATE_ID); return; }
  if (req.method !== "POST" || req.url !== "/build") { res.writeHead(404); res.end("nf"); return; }
  let body = "", tooBig = false;
  req.on("data", (c) => { body += c; if (body.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return send(res, 413, { ok: false, error: "source too large" });
    let payload; try { payload = JSON.parse(body); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
    const files = payload && payload.files;
    if (!files || typeof files !== "object") return send(res, 400, { ok: false, error: "no files" });
    const t0 = Date.now();
    // DECLARED OUTSIDE THE TRY, so the catch-all can report it. Scoped inside, the
    // one exit taken when something UNEXPECTED happened was the one exit with no
    // breakdown — which is exactly backwards, since that is the run somebody is
    // investigating. Caught by the guard that requires every timed exit to carry
    // it, not by reading.
    const times = { routesMs: 0, tscMs: 0, viteMs: 0 };
    return oneAtATime(async () => {
    try {
      resetRoutes();
      const identityUsed = writeIndexHtml(payload.title, payload.lang, payload.title);
      const logoUsed = writeSiteLogo(payload.logo);
      const fontsUsed = writeFonts(payload.fonts, payload.fontFiles);
      // ONE reading of the patch, shared: whether a radius was asked for decides
      // both that the theme's own corner rules give way and what is written.
      const wantsRadius = validForWrite(payload.tokens).radius !== undefined;
      const themeUsed = writeTheme(payload.theme, { dropRadius: wantsRadius, style: payload.style });
      // AFTER the theme, never before — later wins, and that IS the override.
      const tokensUsed = writeTokens(payload.tokens);
      let wrote = 0;
      for (const [rel, content] of Object.entries(files)) {
        const safe = safeRoute(rel);
        if (!safe || typeof content !== "string") continue;
        const full = path.join(ROUTES, safe);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
        wrote++;
      }
      if (!wrote) return send(res, 400, { ok: false, error: "no valid route files written" });

      // `tsr generate` first: main.tsx imports src/routeTree.gen.ts, so without it
      // the typecheck fails on the template rather than on the generated pages.
      const buildEnv = { NODE_ENV: "production" };
      const slug = String((payload.slug || "")).replace(/[^a-z0-9-]/gi, "").slice(0, 80);
      if (slug) buildEnv.VITE_SITE_SLUG = slug;

      // THE THREE SUB-STEPS, TIMED APART. The container reported one `ms` for all
      // of them, and they answer different questions: `tsc` grows with the whole
      // kit (4.97s → 8.02s when the charts and blocks landed) whether or not a
      // page imports any of it, while `vite` only pays for what is actually
      // reachable. One number cannot tell a kit that is getting expensive from a
      // site that is getting big. Reported on the FAILURE paths too — a build
      // that died in typecheck still spent that time.
      const timed = async (key, cmd, args, fn) => {
        const t = Date.now();
        // `fn` for a step that is not a subprocess — the prerender runs in this
        // process, and giving it its own timing shape would put the same clock
        // in two places.
        const r = fn ? await fn() : await run(cmd, args, buildEnv);
        times[key] = Date.now() - t;
        return r;
      };

      const gen = await timed("routesMs", "npx", ["tsr", "generate"]);
      if (gen.code !== 0 || !fs.existsSync(GEN)) {
        return send(res, 200, { ok: false, stage: "routes", error: exitReason("tsr generate", gen).slice(0, 4000), ms: Date.now() - t0, ...times });
      }

      const tsc = await timed("tscMs", "npx", ["tsc", "--noEmit"]);
      if (tsc.code !== 0) {
        // tsc reports on stdout; keep the first errors, which are the causes —
        // the tail is usually the same mistake echoed through the tree.
        return send(res, 200, { ok: false, stage: "typecheck", error: exitReason("tsc", tsc, { stdoutFirst: true }).slice(0, 6000), ms: Date.now() - t0, ...times });
      }

      const build = await timed("viteMs", "npx", ["vite", "build", "--logLevel", "warn"]);
      if (build.code !== 0) {
        return send(res, 200, { ok: false, stage: "build", error: exitReason("vite build", build).slice(0, 4000), ms: Date.now() - t0, ...times });
      }

      // Real HTML per route, so a page is a document and not an empty div.
      // Best-effort by construction: `prerender` never throws and a route it
      // cannot render simply gets no file, which the Worker's fallback already
      // serves as the app shell — exactly today's behaviour. A snapshot is worth
      // having and is never worth failing a build for.
      const pre = await timed("preMs", null, null, () => prerender());

      const dist = collectDist();
      if (!dist["index.html"]) return send(res, 200, { ok: false, stage: "build", error: "build produced no index.html", ms: Date.now() - t0, ...times });
      return send(res, 200, { ok: true, files: dist, ms: Date.now() - t0, ...times, templateId: TEMPLATE_ID, fonts: fontsUsed, theme: themeUsed, tokens: tokensUsed, identity: identityUsed, brand: logoUsed, prerendered: pre.done, prerenderSkipped: pre.skipped });
    } catch (e) {
      return send(res, 200, { ok: false, stage: "build", error: String((e && e.message) || e).slice(0, 2000), ms: Date.now() - t0, ...times });
    }
    });
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi site build-service on :" + PORT));
