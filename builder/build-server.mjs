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
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { resolvePair, resolvePageFonts, fontCss, fontImports } from "./site-fonts.mjs";
import { themeCss, transitionOn } from "./site-theme.mjs";
import { normalizeSeeds } from "./site-seeds.mjs";
import { tokensCss, pageTokensCss, stripThemeRadius, validForWrite } from "./site-tokens.mjs";
import { applyStyle, explicitRadiusCss, parseStyle, MAX_STYLE_BUILD } from "./site-style.mjs";
import { dirFor, initialsMark, normalizeLang, normalizeMode, siteIconFrom } from "./site-identity.mjs";
import { langLabel, resolveLangs } from "./site-langs.mjs";
import { exitReason } from "./exit-reason.mjs";
import { runStep } from "./run-step.mjs";
import { startSiteServer } from "./site-ssr.mjs";
import { checkRender } from "./render-check.mjs";
import { routeOf, fileForRoute } from "./site-addon.mjs";

const APP = process.env.APP_DIR || "/app";
const ROUTES = path.join(APP, "src", "routes");
const ROUTES_BASE = path.join(APP, ".routes-base");
const STYLES_BASE = path.join(APP, ".styles-base.css");
const STYLES = path.join(APP, "src", "styles.css");
const DIST = path.join(APP, "dist");
// START EMITS TWO HALVES. `dist/client` is what a visitor downloads and is the
// only half published to R2; `dist/server/server.js` is the module uploaded as
// the site's Worker. Publishing `dist` wholesale would put every asset one
// directory too deep — the document references `/assets/…` — AND write the
// site's own server code into the PUBLIC bucket, which is exactly what keeping
// `dist-worker` out of `dist` has always been about.
const CLIENT_DIST = path.join(DIST, "client");
const SERVER_BUNDLE = path.join(DIST, "server", "server.js");
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
  // AND THE LEAVINGS OF THE THREE-BUILD PIPELINE, which Start replaced. Kept as
  // wipes rather than dropped with the code that made them: this container is
  // long-lived, so an instance carrying a `dist-ssr` or a `dist-worker` from
  // before the deploy would otherwise hold it until Cloudflare recycled it, and
  // one build's files leaking into the next is a class that has bitten here
  // before. They cost nothing and can go once no live instance predates Start.
  for (const stale of ["dist-ssr", "dist-worker", "vite.worker.config.mjs", path.join("src", "site-config.js")]) {
    try { fs.rmSync(path.join(APP, stale), { recursive: true, force: true }); } catch {}
  }
  // AND THE STYLESHEET, which was the one build output nothing reset.
  //
  // `writeTheme` and `writeTokens` both APPEND to whatever `src/styles.css`
  // currently holds, and the only thing that ever put it back was a side effect
  // of `writeFonts` — its `if (applied)` write, gated on TWO conditions that can
  // independently be false (a readable pristine base, and an `@theme` block to
  // match). When either failed, the fallback read `src/styles.css` itself, i.e.
  // THE PREVIOUS CUSTOMER'S SHEET, and appended to it.
  //
  // MEASURED over three builds with the base missing: 28031 → 32506 → 39145
  // bytes, `:root` blocks 16 → 23 → 32, and every earlier build's font marker
  // still present. So one customer's theme rules were being served inside the
  // next customer's site — the same one-build-leaks-into-the-next class as the
  // stale `dist-ssr` above, which is why it belongs here rather than there.
  //
  // SOFT, deliberately: an older image or a sandbox that never made the copy
  // must behave exactly as it does today rather than losing every build to a
  // missing dotfile. `writeFonts`' own restore then becomes belt-and-braces.
  try { fs.copyFileSync(STYLES_BASE, STYLES); } catch {}
}

// The published tab: the business's name, its language, and its own mark.
//
// IT USED TO PATCH `index.html` WITH A REGEX, and there is no `index.html` any
// more — Start emits none, because the document is `__root.tsx` rendered per
// request. So the three values are written as an ordinary generated module and
// the root route renders them as props. That is a straight simplification: no
// pattern to get wrong, no pristine base to read from, and the compiler sees
// them.
//
// THE ICON IS WRITTEN TO `icon.svg` RATHER THAN OVER `favicon.svg`. The template
// ships a real `public/favicon.svg` and this container is long-lived, serving
// every build on the platform: overwriting it leaves no pristine copy, so the
// first site's mark becomes the fallback for every site afterwards that has no
// brand. Deleted before every build for the same reason `src/routes` is — a
// stale one is one site's mark on another's tab.
//
// THE TITLE IS A DEFAULT, NOT THE ANSWER. It is the root's `head()`, so a route
// declaring its own overrides it — which is what the per-page title rule already
// asks the generator to do. Before this, `setTitle` at PUBLISH time stamped the
// brand onto every non-home page after the fact; a default the routes can beat
// is the same outcome with the ordering the right way round.
function writeSiteBrand({ title, lang, langs, logo, icon: sent, slug, mode, seeds, transition }) {
  const iconPath = path.join(APP, "public", "icon.svg");
  try { fs.rmSync(iconPath, { force: true }); } catch {}

  // THE OWNER'S OWN TAB ICON WINS OVER THE DRAWN ONE, and it is a SEPARATE
  // piece of artwork from the header logo rather than a smaller copy of it: a
  // wordmark is legible at a few hundred pixels and a smear at 16, so a site
  // that used its logo for both would have a worse tab than one showing its
  // initials. Same shape check as the logo below, because it ends up in a `src`
  // inside generated TypeScript the same way.
  const own = siteIconFrom(sent);
  const iconOk = !!(own && own.href);

  let icon = iconOk ? own.href : null;
  // THE TYPE IS DECLARED PER ICON AND NOT HARDCODED. The drawn mark is an SVG
  // and `__root.tsx` said `type="image/svg+xml"` unconditionally — with an
  // owner's PNG behind it that is a lie about the bytes, and a browser is
  // entitled to refuse an icon whose declared type does not match. Read off the
  // extension, which is ours: `uploadName` builds it from the sniffed kind.
  let iconType = iconOk ? own.type : "";
  if (!icon) {
    try {
      // THE SITE'S OWN PALETTE, or the mark is a colour nobody chose. Passing
      // nothing here is not a smaller version of this feature — it is the whole
      // of it dead, with `markGround` correct and unreached.
      const svg = initialsMark(title, seeds);
      if (svg) {
        fs.mkdirSync(path.dirname(iconPath), { recursive: true });
        fs.writeFileSync(iconPath, svg);
        icon = "/icon.svg";
        iconType = "image/svg+xml";
      }
    } catch {
      // A site keeps the template's mark. Failing a build over a tab icon would
      // trade a working site for a decoration.
      icon = null;
    }
  }

  // ONLY AN ABSOLUTE https URL OR A SITE-RELATIVE `/u/` PATH for the logo. The
  // value ends up in a `src` inside generated TypeScript, so it is quoted with
  // JSON.stringify AND bounded to shapes that cannot be a `javascript:` URL —
  // the string comes from our own `_meta`, but "it came from us" is how the
  // first person to reach that row through some other route gets an XSS on a
  // customer's site.
  const raw = typeof logo === "string" ? logo.trim() : "";
  const logoOk = /^https:\/\/[^\s"'<>]+$/i.test(raw)
    || /^\/u\/[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9._-]{1,120}$/i.test(raw);
  const logoValue = logoOk ? raw : "";
  // `normalizeLang` REFUSES rather than defaulting, so an unusable value leaves
  // the site on the template's English instead of guessing at one.
  const langValue = normalizeLang(lang) || "en";
  // DERIVED FROM THE LANGUAGE, NEVER ASKED FOR. Whether a script runs right to
  // left is a fact about the script, not a preference — a business writing its
  // brief in Arabic is not going to be asked which way its own page should read,
  // and a stored `dir` is a second value that can disagree with the tag beside
  // it. So `lang` stays the one thing anybody sets and this follows it.
  const dirValue = dirFor(langValue);
  // RESOLVED HERE RATHER THAN TRUSTED, for the reason every other value in this
  // function is: it arrives over the wire and lands in generated TypeScript. A
  // refused language is simply not in the list, so a bad one costs that language
  // and never the site.
  const resolvedLangs = resolveLangs(langValue, langs && langs.extra, { routes: (langs && langs.routes) || [] }).langs;
  // EMPTY UNLESS THE SITE REALLY IS MULTILINGUAL, and when it is, it carries
  // ALL of them INCLUDING the primary. Both halves matter: empty is what makes
  // every site published before this render byte-identically, and the primary
  // being in the list is what lets the switcher offer the way BACK — a visitor
  // on the Spanish booking page has to be able to reach the English one.
  //
  // THE LABEL IS BAKED HERE RATHER THAN COMPUTED IN THE PAGE. `Intl.DisplayNames`
  // is the obvious way to render "Español", and it is ICU — which this repo has
  // already been bitten by, where two ICU VERSIONS disagreed about one locale and
  // the server render and the browser hydration produced different text. Resolved
  // once, in one process, and shipped as a string: there is no second opinion to
  // diverge. An unusable answer falls back to the prefix in capitals, which is
  // plain and never wrong.
  const langsValue = resolvedLangs.length < 2 ? [] : resolvedLangs.map((l) => ({
    lang: l.tag,
    dir: dirFor(l.tag),
    prefix: l.prefix,
    label: langLabel(l.tag, l.prefix),
  }));
  const titleValue = typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : "App";
  // THE SLUG IS THE ONE VALUE HERE THAT IS NOT DECORATION. `siteSlug()` reads it
  // off the head on a custom domain, where there is no `/s/<slug>/` path to learn
  // it from — get it wrong and every read and every form on the site addresses a
  // DIFFERENT site's API. Shape-checked rather than trusted: it reaches a URL.
  const slugValue = /^[a-z0-9][a-z0-9-]{0,80}$/i.test(String(slug || "")) ? String(slug).toLowerCase() : "";
  // LIGHT UNLESS THE SITE SAID DARK, and an unrecognised value reads as light
  // rather than as an error — every site built before this sends nothing, and a
  // build must not change its look because a field arrived empty. In
  // `site-identity.mjs` beside `normalizeLang` for the reason that one is there:
  // this function writes files, so nothing here can be driven by a unit test,
  // and every shape the value can arrive in has to be answerable without one.
  const modeValue = normalizeMode(mode);
  // WHETHER THE ROUTER STARTS A VIEW TRANSITION AT ALL — the half of the page
  // transition that cannot live in the stylesheet. `transitionOn` is the ONE
  // question, shared with `pageCss`, because the two disagreeing is silent both
  // ways: a flag with no CSS hands the site the browser's own cross-fade, and
  // CSS with no flag is a rule nothing ever triggers. FALSE unless the site
  // asked, so every site published before this navigates exactly as it does now.
  const transitionValue = transitionOn(transition);

  // WRITTEN ON EVERY BUILD, INCLUDING WHEN A VALUE IS ABSENT. This container is
  // long-lived and serves every build on the platform, so a file left behind by
  // the last site is that site's logo, language and mark on this one — the same
  // leak `resetRoutes` and the per-build icon already guard against. An empty
  // string is a real answer here and has to be written as one.
  // WHICH BUILD THIS IS, and it is the only value here that nothing renders.
  //
  // A dispatch-namespace script does not start serving the instant its upload
  // is accepted — MEASURED on two live runs: the publish route returned, the
  // site was read 0.2s later, and it answered with the PREVIOUS build's
  // document; a read 1.4s after another publish was fresh. So "the route
  // returned 200" and "the site is serving this" are different facts, and
  // there was nothing on the wire that could tell them apart.
  //
  // A CONTENT HASH WOULD BE NICER AND CANNOT WORK: this file is written BEFORE
  // vite runs, so there is no output to hash yet. Time plus randomness is
  // enough for the one question asked of it — is what I am reading the thing I
  // just uploaded — which needs only difference, never order.
  const buildValue = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(
    path.join(APP, "src", "site-brand.ts"),
    "// Generated per build by build-server.mjs. Do not edit.\n" +
      "export const SITE_SLUG = " + JSON.stringify(slugValue) + ";\n" +
      "export const SITE_LOGO = " + JSON.stringify(logoValue) + ";\n" +
      "export const SITE_LANG = " + JSON.stringify(langValue) + ";\n" +
      // ANNOTATED for the reason `SITE_MODE` below is: an unannotated const has
      // the LITERAL type of whichever value was written, so a comparison against
      // the other member is `TS2367` and the template stops compiling.
      'export const SITE_DIR: "ltr" | "rtl" = ' + JSON.stringify(dirValue) + ";\n" +
      // THE EXTRA LANGUAGES, each with the direction ITS OWN tag implies rather
      // than the site's — an English site with an Arabic second language needs
      // `/ar` to read right to left while `/` reads left to right, and that is
      // only expressible because the kit is on logical utilities.
      'export const SITE_LANGS: ReadonlyArray<{ lang: string; dir: "ltr" | "rtl"; prefix: string; label: string }> = ' +
        JSON.stringify(langsValue) + ";\n" +
      // DARK MODE IS ONE CLASS, and this is the whole feature.
      //
      // `styles.css` declares `@custom-variant dark (&:is(.dark *))` and
      // `themeCss` already emits the theme's OWN designed dark palette as a
      // `.dark` block — all 31 colour properties, solved rather than picked —
      // into every site's stylesheet. Nothing anywhere ever applied it, so
      // every one of the 500 themes shipped its dark half as dead CSS and a
      // customer asking for a dark site got the token-patch approximation: a
      // dark ground under buttons and highlights chosen for white paper.
      //
      // The class also flips every `dark:` utility in the kit, which is why
      // this beats emitting the dark values as `:root` — that would move the
      // custom properties and leave those components on their light branch.
      // ANNOTATED so this file and the template placeholder agree — an
      // unannotated const has the LITERAL type of whichever value was written,
      // and `SITE_MODE === "dark"` then fails to compile on a light site.
      'export const SITE_MODE: "light" | "dark" = ' + JSON.stringify(modeValue) + ";\n" +
      // THE ROUTER'S HALF OF THE PAGE TRANSITION. `defaultViewTransition` in
      // `router.tsx` reads this; `pageCss` writes what it looks like. Both come
      // from `transitionOn`, once. ANNOTATED for the `SITE_MODE` reason — an
      // unannotated const has the literal type of whichever value was written,
      // so the generated file and the template placeholder would disagree the
      // moment anything compares them.
      "export const SITE_PAGE_TRANSITION: boolean = " + JSON.stringify(transitionValue) + ";\n" +
      "export const SITE_ICON = " + JSON.stringify(icon || "/favicon.svg") + ";\n" +
      "export const SITE_ICON_TYPE = " + JSON.stringify(iconType || "image/svg+xml") + ";\n" +
      "export const SITE_NAME = " + JSON.stringify(titleValue) + ";\n" +
      "export const SITE_BUILD = " + JSON.stringify(buildValue) + ";\n",
  );
  // `ownIcon` SEPARATES THE TWO OUTCOMES the single `icon` boolean could not:
  // a site drawing its initials and a site serving the owner's own artwork
  // both answered true, so a favicon that was stored and then refused by the
  // shape check reported as a working icon.
  return { lang: langValue, dir: dirValue, langs: langsValue, mode: modeValue, transition: transitionValue, icon: !!icon, ownIcon: iconOk, logo: !!logoValue, slug: !!slugValue,
    refused: (!!raw && !logoOk) || !!(own && own.refused), build: buildValue };
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
function writeFonts(fonts, fontFiles, pageFonts) {
  const pair = resolvePair(fonts || {});
  // A PAGE MAY HAVE ITS OWN TYPEFACE. Resolved here beside the site's, so the
  // @font-face rules are emitted once for every family any scope references and
  // the npm imports below cover all of them — a page font that is bundled by
  // nothing renders the fallback while the build reports success, which is the
  // failure this whole file is written around.
  const { pages: pageScopes } = resolvePageFonts(pageFonts || {});
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

  // The values go into styles.css's own @theme block. That file is restored from
  // a pristine copy each build the way index.html is — in `resetRoutes`, not
  // here; see the note on `base` below for why that moved.
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
  //
  // THIS IS NO LONGER WHAT RESETS THE SHEET, and believing it was is what let one
  // customer's theme rules survive into the next customer's site. `resetRoutes`
  // now restores `src/styles.css` unconditionally, the way it already wipes the
  // dist and the route tree, so by the time this runs the file is pristine and
  // both branches below are belt-and-braces rather than the only reset there is.
  // The second arm — reading `STYLES` when the base is unreadable — is kept
  // because it is correct in a fresh sandbox, and it is no longer the previous
  // build's sheet in the image, because the Dockerfile is now asserted to bake
  // the base (test/dockerfile.test.mjs).
  let base = null;
  try { base = fs.readFileSync(STYLES_BASE, "utf8"); }
  catch { try { base = fs.readFileSync(STYLES, "utf8"); } catch { base = null; } }
  const decls = fontCss(pair, written, pageScopes);
  // Appended at the END of the block, not the start. Within one @theme the later
  // declaration wins, and the template declares its own --font-sans default
  // further down — so inserting at the top wrote the site's choice and then had
  // it overridden three lines later. The build reported the right fonts and the
  // bundle carried the defaults: measured, and invisible from the response.
  const applied = base != null && /@theme\s*\{[^}]*\}/.test(base);
  if (applied) {
    const themed = base.replace(/(@theme\s*\{[^}]*?)(\n?\})/, (_m, body, close) => body + "\n" + decls.vars + "\n" + close);
    // THE PAGE SCOPES GO AFTER, OUTSIDE `@theme` — that block may not contain a
    // scoped rule, and they do not need to be inside it: `body[data-page="/x"]`
    // is (0,1,1) against `:root`'s (0,1,0), so it wins on SPECIFICITY rather
    // than on source order. That is what makes it safe here where a second
    // `:root` was not: the minifier proved that one dead and shipped the
    // default font while reporting the chosen one.
    fs.writeFileSync(STYLES, (decls.faces ? decls.faces + "\n" : "") + themed +
      (decls.scoped ? "\n" + decls.scoped + "\n" : ""));
  }

  const imports = fontImports(pair, pageScopes).map((p) => `import "${p}";`).join("\n");
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
// A THIN WRAPPER OVER `runStep`, which is where the spawn discipline lives now.
//
// It moved because the two things that were wrong with it are invisible from
// outside this container and untestable inside it: on a timeout the old version
// signalled ONLY its direct child — every step is `npx <tool>`, so `vite`/`tsc`
// carried on — and it resolved beside the kill rather than after the child's
// `close`, so `oneAtATime` released while an orphan was still emitting into
// `dist/client/assets/` that the next build's `resetRoutes()` was about to wipe.
// `build-server.mjs` listens on a port at import time and cannot be imported by
// a test; `run-step.mjs` can, and is.
//
// The wrapper stays so every call site and every timing guard is unchanged: the
// only thing that moved is what happens when a step will not stop.
const run = (cmd, args, env, opts) =>
  runStep(cmd, args, { cwd: APP, env: { ...process.env, ...(env || {}) }, timeout: STEP_TIMEOUT, ...(opts || {}) });


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

// ── WHICH ADDRESSES THIS SITE HAS ───────────────────────────────────────────
//
// The render check's work list: every route the browser harness opens and every
// route the contrast and overflow passes judge. Read off the files that are
// really there rather than a list, so a page the model wrote is checked without
// anything having to be told about it.
//
// IT USED TO FEED THE PRERENDER — the build-time step that wrote each route to
// its own HTML file, because a published page was an empty `<div id="root">` and
// a link preview does not run JavaScript. Under Start the document is rendered
// per REQUEST by the site's own Worker, so there is no snapshot to produce and
// no skipped-route fallback to reason about: a route either exists in the router
// or it does not.
//
// THE FILE-TO-URL MAPPING IS `routeOf`, IMPORTED — not a copy.
//
// It used to be a copy, and the copy read a dot as a literal character where
// TanStack's flat-route convention reads it as a separator: `about.team.tsx` is
// `/about/team`, `safeRoute` admits dots in a stem, and the form is the dominant
// one in TanStack's own documentation and so in training data. That cost the
// snapshot of every page written that way.
//
// FIXING ONLY THIS COPY WOULD HAVE BEEN WORSE THAN THE BUG. The published route
// manifest comes from `siteRoutes` → `routeOf`, so a container answering
// `/about/team` against a manifest still saying `/about.team` makes the
// platform's fallback 404 a page that previously loaded. Two readings of one
// mapping is the repo's recorded "path-shape mismatch" family; the fix is one
// function, not two agreeing functions.
//
// WHAT STAYS HERE is only what is genuinely this side's business: walking the
// directory, and skipping a `$` file. `routeOf` passes a `$` through on purpose
// — `siteRoutes` needs to see it to mark the site dynamic — so this filter is
// load-bearing rather than belt-and-braces. `__root` and any pathless `_layout`
// need no filter here: `routeOf` answers "" for both, which is the same answer
// every other caller wants.
function routePaths() {
  const out = [];
  const walk = (dir, base) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full, base + name + "/"); continue; }
      if (!name.endsWith(".tsx") || name.includes("$")) continue;
      const r = routeOf(base + name);
      if (r) out.push(r);
    }
  };
  try { walk(ROUTES, ""); } catch { return []; }
  return [...new Set(out)];
}

/**
 * The site's Worker script — Start's own server build, read off disk.
 *
 * IT USED TO BE A SECOND VITE PASS. `packageWorker` staged an entry and a
 * generated `site-config.js` into the template, copied in a second config, and
 * ran `vite build --ssr` again, purely to get a bundle with its dependencies
 * INLINED — the Workers runtime has no loader, so an externalised script cannot
 * run. `src/server.ts` is Start's server entry now and `vite.config.ts` carries
 * the `noExternal` + `workerd` settings, so that bundle falls out of the build
 * that was already happening.
 *
 * WHAT WENT WITH IT: the shell splicing, and therefore the `[object Object]`
 * failure — `String()` turned a dist entry into fifteen literal characters and
 * every page of the site served them as its whole document, past a typecheck, a
 * bundle, a size check, and an assertion that matched the entry file's own copy
 * of the string it was looking for.
 *
 * BEST-EFFORT, like every step around it: no bundle means no script and the
 * caller publishes static files exactly as it does today.
 */
function readSiteWorker() {
  try {
    const code = fs.readFileSync(SERVER_BUNDLE, "utf8");
    // A NUMBER WRONG BY AN ORDER OF MAGNITUDE is harder to satisfy by accident
    // than a pattern, which is what caught the externalised bundle the first
    // time: 17,647 bytes importing React from a bare specifier — not a bundled
    // app, and undeployable. The assertion written to catch it looked for
    // RELATIVE imports, and a bare `from "react"` walks straight past that.
    if (code.length < 300_000) {
      return { ok: false, why: "the server bundle is " + code.length + " bytes — its dependencies were externalised and it cannot run in a Worker" };
    }
    return { ok: true, why: "", code, bytes: Buffer.byteLength(code) };
  } catch (e) {
    return { ok: false, why: "could not read the server bundle: " + String((e && e.message) || e) };
  }
}

/**
 * The built server, for the render check to drive — IN A PROCESS OF ITS OWN.
 *
 * IT USED TO BE AN `import()` INTO THIS PROCESS, and the Dockerfile deleted the
 * prerender's sandbox on the premise that "nothing in this image executes
 * model-written code any more" while the next paragraph of the same comment
 * block said the render check still does. Both cannot be true, and the second
 * one was: `dist/server/server.js` IS the model's `src/routes/*.tsx`, and it was
 * being called per request inside the long-lived, shared, root-owned build
 * service, in the loop that answers `/health` and drives `oneAtATime`.
 *
 * THREE THINGS FELL OUT OF THAT, and the child fixes all three:
 *
 *   • NO TIMEOUT COULD EXIST. `STEP_TIMEOUT` only ever applied to subprocesses
 *     via `run()`, and `checkRender`'s own budget is a timer in the same event
 *     loop a synchronous `while (true)` in a component blocks. A wedge took the
 *     whole platform's build queue with it until Cloudflare recycled the
 *     instance.
 *   • THE FILESYSTEM WAS SHARED. `resetRoutes` restores `src/routes` and nothing
 *     else, so a write into `node_modules`, `src/components` or a pristine base
 *     would be in every later customer's build.
 *   • THE MODULE REGISTRY GREW FOREVER. `?b=<now>` stopped build two being
 *     handed build one's server — correctly — and Node keys the ESM registry on
 *     the whole URL with no unload, so every build's multi-megabyte bundle was
 *     retained for the life of the container. A fresh process has an empty
 *     registry, so the buster is not needed and its absence is the fix.
 *
 * See `site-ssr.mjs` for the boundary and `render-server-child.mjs` for what the
 * child is allowed to do (read the bundle, answer requests, write nothing).
 *
 * NEVER THROWS. A handle comes back either way: a dead one carries `fetch: null`
 * and a `down()` that says why, which is what lets the render check report "the
 * check could not run" instead of blaming every page of a perfectly good site
 * for 404ing.
 */
function startSiteServerForCheck() {
  return startSiteServer(SERVER_BUNDLE, { cwd: APP });
}

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
// TAKES AN AUTHORED PALETTE, NOT A NAME (2026-08-20). `resolveTheme` looked a
// name up in a 500-row registry; the designer writes three colours per site now
// and `normalizeSeeds` turns them into the same theme object the engine has
// always taken. Everything below this line is unchanged, which is the point —
// the seam was already exactly here, because every one of those 500 declared
// only `paper`/`ink`/`accent` and let `paletteFor` derive the other 28 tokens.
//
// THE REFUSAL IS NAMED. `normalizeSeeds` returns a reason precisely because four
// different failures — nothing sent, an unreadable colour, swapped modes, an
// illegible palette — need four different responses, and a note saying only
// "the site kept the default look" is one nobody can act on.
function writeTheme(seeds, { dropRadius = false, style = null } = {}) {
  if (!seeds) return { applied: false, theme: null, notes: [] };
  const { theme, why } = normalizeSeeds(seeds);
  if (!theme) return { applied: false, theme: null, notes: [`The colours could not be used (${String(why).slice(0, 80)}) — the site kept the default look.`] };
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
  // THE STRIP IS NOW INERT, AND THIS COMMENT USED TO CLAIM OTHERWISE.
  //
  // It read: "280 OF THE 500 THEMES hard-set `border-radius` on buttons and
  // inputs as real rules rather than through `--radius`, so on a majority of
  // sites a corner override moved the cards and left every button square." That
  // was true of the REGISTRY, which went on 2026-08-20. Measured since: a
  // seeds-only theme emits ZERO border-radius rules, so with no style patch
  // there is nothing to strip — and `RADIUS_AXES` is exactly `["buttons",
  // "inputs"]`, which is exactly what `explicitRadiusCss` re-emits, so with one
  // the strip removes precisely what is put straight back. A wash either way.
  //
  // KEPT RATHER THAN DELETED IN THAT CHANGE, deliberately: it is provably
  // harmless, and folding an unrelated removal into the palette work would make
  // both harder to review and to revert. The comment is corrected because a
  // false one is what gets believed — this is a decision to revisit, not an
  // oversight, and `site-build` prints the 33-vs-33 measurement that shows it.
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
  // The palette's own NAME, not an id — there is no registry to look one up in.
  return { applied: true, theme: theme.label, notes: [] };
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

// ONE PAGE'S OWN COLOURS, written AFTER the site's.
//
// The same later-wins mechanism `writeTokens` runs on, one scope down: these are
// the same custom properties, under `body[data-page="/book"]`, which `__root.tsx`
// stamps. Appended last so ordering agrees with specificity rather than fighting
// it — though `body[…]` is (0,1,1) against `:root`'s (0,1,0), so it would win
// either way, which is deliberate: an append order is one refactor from changing.
//
// FAILS SOFT like both writes above it, and for the same reason: a site whose
// pages compiled must not be lost because one page's colour could not be
// written. `pageTokensCss` returns "" for an empty or unusable map, so a build
// that never asked for one writes nothing and its stylesheet is byte-identical.
function writePageTokens(pageTokens) {
  let css;
  try { css = pageTokensCss(pageTokens); }
  catch { return { applied: false, notes: ["Those page colours could not be applied, so every page kept the site's."] }; }
  if (!css) return { applied: false, notes: [] };
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, notes: ["Those page colours could not be applied, so every page kept the site's."] }; }
  fs.writeFileSync(STYLES, base + "\n" + css);
  return { applied: true, notes: [] };
}

// One build at a time. Not an optimisation — a correctness requirement.
//
// `getContainer(env.SITE_BUILD_CONTAINER)` is called with no id, so EVERY build
// on the platform lands in this one container, and a build wipes a shared
// src/routes (and dist, and the generated route tree) before writing its own
// pages. Two arriving together destroy each other: observed 2026-07-29 with two
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
      // ONE writer for all four, because they land in ONE generated module and
      // two writers of one file is one of them silently losing.
      // ONE READING OF THE STYLE PATCH, and this is the whole reason it is
      // parsed here rather than inside each writer. The page transition has two
      // halves in two files — `pageCss` says what it looks like, `site-brand.ts`
      // says whether the router starts one at all — and if they read the patch
      // separately they can disagree about whether the axis was named. Parsed
      // once, passed to both, and `parseStyle` is idempotent so `applyStyle`
      // re-reading it downstream cannot change the answer.
      const styleUsed = parseStyle(payload.style, { max: MAX_STYLE_BUILD }).style;
      const brandUsed = writeSiteBrand({ title: payload.title, lang: payload.lang, langs: payload.langs, logo: payload.logo, icon: payload.icon, slug: payload.slug, mode: payload.mode, seeds: payload.seeds, transition: styleUsed.transition });
      const fontsUsed = writeFonts(payload.fonts, payload.fontFiles, payload.pageFonts);
      // ONE reading of the patch, shared: whether a radius was asked for decides
      // both that the theme's own corner rules give way and what is written.
      const wantsRadius = validForWrite(payload.tokens).radius !== undefined;
      const themeUsed = writeTheme(payload.seeds, { dropRadius: wantsRadius, style: styleUsed });
      // AFTER the theme, never before — later wins, and that IS the override.
      const tokensUsed = writeTokens(payload.tokens);
      // AND AFTER THOSE, one page's own. Same mechanism, one scope down.
      const pageTokensUsed = writePageTokens(payload.pageTokens);
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

      // NO PRERENDER STEP. Under Start the document is rendered per REQUEST by
      // the server bundle this build just produced, so there is no build-time
      // snapshot left to be missing — which is the failure that made the Worker
      // tier necessary in the first place (2026-08-16: the child was killed 4.4s
      // in, wrote nothing to either stream, and the site published blank to
      // anything that does not run JavaScript, with nothing reporting a failure).
      //
      // THE ONLY STEP THAT EVER LOOKS AT THE SITE. Everything above is textual —
      // is it a file, does it name real things, does it compile, does it bundle —
      // and none of that can see a page that renders blank, throws on load, or
      // paints text nobody can read. Every visual failure this platform has
      // recorded got through all four and was found by a person looking.
      //
      // IT NOW DRIVES THE REAL SERVER rather than a snapshot, which is strictly
      // better: the bytes it inspects are the bytes a visitor receives, from the
      // same code that will serve them.
      //
      // Best-effort by construction: `startSiteServerForCheck` returns a dead
      // handle rather than throwing, and `checkRender` has a try around
      // everything and reports rather than throwing, so a bundle that will not
      // load costs a report and never a build. Reporting only — nothing here
      // refuses a publish.
      //
      // STOPPED IN A `finally`, and that is not tidiness: the child is a
      // process, in a container that serves every build on the platform, and one
      // left running per build is the module-registry leak this replaced wearing
      // a different costume. `stop()` is idempotent and kills the group.
      //
      // `ssr.down` GOES WITH `ssr.fetch`, so the check can tell "the site's
      // server never started" from "every page of this site is broken". Passing
      // the fetch alone is what made a bundle that would not load read as eight
      // pages that threw — the one false alarm this check's charter rates worse
      // than any miss.
      const ssr = await startSiteServerForCheck();
      let render;
      try {
        render = await timed("renderMs", null, null, () => checkRender(CLIENT_DIST, routePaths(), ssr.fetch, ssr.down));
      } finally { ssr.stop(); }

      // ONLY THE CLIENT HALF IS PUBLISHED. Start emits `dist/client/**` (what a
      // visitor downloads) and `dist/server/server.js` (the script that renders).
      // `collectDist(DIST)` would publish BOTH — so every asset would land at
      // `sites/<slug>/client/assets/…` and 404, since the document references
      // `/assets/…`, AND the site's own server code would be written into the
      // PUBLIC bucket. That second one is exactly what keeping `dist-worker` out
      // of `dist` has always been about.
      const dist = collectDist(CLIENT_DIST);
      // THE GATE MOVED FROM `index.html` TO THE BUNDLE, because Start emits no
      // top-level document at all — a clean build's `dist/` is `client/` and
      // `server/` and nothing else, measured. What still has to exist is
      // something for the browser to run.
      if (!Object.keys(dist).some((k) => /^assets\/.+\.js$/i.test(k))) {
        return send(res, 200, { ok: false, stage: "build", error: "build produced no client bundle", ms: Date.now() - t0, ...times });
      }

      // OFF UNLESS ASKED FOR, and that is the whole reason it is safe to land
      // before anything can serve it. Packaging is a second vite pass — real
      // seconds on every build — and until a dispatch namespace exists the
      // script it produces has nowhere to go, so running it by default would
      // be pure cost on every customer's build for an artefact nobody reads.
      //
      // Requested per build rather than by an env var, because the decision is
      // per site once this is live (an owner on the static path and an owner on
      // the rendered path can coexist) and a container-wide switch cannot
      // express that.
      // `payload`, NOT `body` — `body` is the raw request string, so `body.worker`
      // is undefined for every request and the step would never have run. A
      // silent no-op behind a flag reads exactly like a feature that is switched
      // off, which is the shape this repo keeps paying for.
      // THE SCRIPT IS THE BUILD'S OWN OUTPUT. It used to be a SECOND vite pass
      // with its own config, staging an entry and a generated `site-config.js`
      // into the template first; `src/server.ts` is Start's server entry now, so
      // `dist/server/server.js` already IS the uploadable module — one build
      // instead of three, and the `[object Object]` class of bug goes with the
      // splicing that produced it.
      //
      // Still behind the flag, and for the reason it always was: the decision is
      // per site (an owner on the static path and an owner on the rendered path
      // can coexist), which a container-wide switch cannot express. It costs
      // nothing now beyond reading a file.
      // REFUSED WITHOUT A SLUG rather than packaged with an empty one, which is
      // `packageWorker`'s own rule and had to be restored here when it went: the
      // slug is baked into `site-brand.ts` and the entry builds its R2 keys from
      // it, so a script without one answers 404 to every stylesheet, every
      // bundle and its own meta — a page that renders and then looks broken,
      // which is worse than the static path it would have replaced. Verified by
      // EXECUTING a bundle built with an empty slug: every asset 404'd and the
      // share tags were silently absent.
      let worker = payload.worker && !brandUsed.slug
        ? { ok: false, why: "no slug — a worker cannot find its own assets or its meta without one" }
        : null;
      if (payload.worker && brandUsed.slug) worker = readSiteWorker();
      // THE STAMP RIDES ON THE SCRIPT, so the caller that uploads it is the
      // caller that can confirm it. Put anywhere else it would have to be
      // matched up again by hand, and the whole point is that the uploader
      // already holds both halves: the code it sent and the id that code
      // answers with. Only on a script that exists — a failed packaging has
      // nothing to confirm.
      if (worker && worker.ok && brandUsed.build) worker.build = brandUsed.build;

      // `prerendered`/`prerenderSkipped` ARE GONE, not emptied. The step does not
      // exist under Start, and reporting an empty list for it would read to every
      // caller as "the prerender ran and produced nothing" — the one state that
      // used to mean every page of the site published blank. An absent field
      // says the step is absent.
      //
      // `ssrUnprivileged` IS `prerenderUnprivileged` BACK, with the reporting
      // rule `sandboxed` uses: carried ONLY when it is false, so an ordinary
      // response is byte-identical and the field's PRESENCE is the alarm.
      // DERIVED from whether the drop really happened — never a constant —
      // because "we thought this was sandboxed" is a worse position than knowing
      // it is not, and the one thing a check like this must not do is report a
      // confinement that is not there.
      return send(res, 200, { ok: true, files: dist, ms: Date.now() - t0, ...times, templateId: TEMPLATE_ID, fonts: fontsUsed, theme: themeUsed, tokens: tokensUsed, pageTokens: pageTokensUsed, brand: brandUsed, render, worker, ...(ssr.unprivileged ? {} : { ssrUnprivileged: false }) });
    } catch (e) {
      return send(res, 200, { ok: false, stage: "build", error: String((e && e.message) || e).slice(0, 2000), ms: Date.now() - t0, ...times });
    }
    });
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi site build-service on :" + PORT));
