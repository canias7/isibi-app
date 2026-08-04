// isibi SITE build-service (runs inside the container). Forks ../builder-game/build-server.mjs
// with kaplay swapped back out for the React template, and a `tsc --noEmit` gate in
// front of `vite build` — GENERATOR.md's definition of done is both, so a page that
// only happens to bundle is still a failure here.
//
// Contract:
//   POST /build   { "files": { "index.tsx": "<tsx source>", ... },   // relative to src/routes/
//                   "slug":  "<site slug>",                          // OPTIONAL, baked as VITE_SITE_SLUG
//                   "title": "<brand>" }                             // OPTIONAL, the <title> tag
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
import path from "node:path";
import { resolvePair, fontCss, fontImports } from "./site-fonts.mjs";
import { themeCss } from "./site-theme.mjs";
import { resolveTheme } from "./site-theme-registry.mjs";
import { exitReason } from "./exit-reason.mjs";

const APP = process.env.APP_DIR || "/app";
const ROUTES = path.join(APP, "src", "routes");
const ROUTES_BASE = path.join(APP, ".routes-base");
const INDEX_BASE = path.join(APP, ".index-base.html");
const STYLES_BASE = path.join(APP, ".styles-base.css");
const STYLES = path.join(APP, "src", "styles.css");
const DIST = path.join(APP, "dist");
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
}

// The published tab should carry the business's name, not the template's "App".
function writeIndexHtml(title) {
  let html = fs.readFileSync(INDEX_BASE, "utf8");
  const t = String(title || "").trim().slice(0, 70);
  if (t) {
    const esc = t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + esc + "</title>");
  }
  fs.writeFileSync(path.join(APP, "index.html"), html);
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
function writeTheme(name) {
  if (!name) return { applied: false, theme: null, notes: [] };
  const theme = resolveTheme(name);
  if (!theme) return { applied: false, theme: null, notes: [`No theme called "${String(name).slice(0, 40)}" — the site kept the default look.`] };
  let css;
  try { css = themeCss(theme); }
  catch { return { applied: false, theme: null, notes: ["The theme could not be rendered, so the site kept the default look."] }; }
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, theme: null, notes: ["The stylesheet could not be read, so the site kept the default look."] }; }
  fs.writeFileSync(STYLES, base + "\n" + css + "\n");
  return { applied: true, theme: name, notes: [] };
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

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
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
      writeIndexHtml(payload.title);
      const fontsUsed = writeFonts(payload.fonts, payload.fontFiles);
      const themeUsed = writeTheme(payload.theme);
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
      const timed = async (key, cmd, args) => {
        const t = Date.now();
        const r = await run(cmd, args, buildEnv);
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

      const dist = collectDist();
      if (!dist["index.html"]) return send(res, 200, { ok: false, stage: "build", error: "build produced no index.html", ms: Date.now() - t0, ...times });
      return send(res, 200, { ok: true, files: dist, ms: Date.now() - t0, ...times, fonts: fontsUsed, theme: themeUsed });
    } catch (e) {
      return send(res, 200, { ok: false, stage: "build", error: String((e && e.message) || e).slice(0, 2000), ms: Date.now() - t0, ...times });
    }
    });
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi site build-service on :" + PORT));
