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
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
// FIRST OF THE BUILDER IMPORTS, DELIBERATELY. It takes the provider keys out of
// `process.env` at evaluation time, and ESM evaluates imports depth-first in
// SOURCE ORDER — so anything listed above it runs its own top-level code, and
// any `process.env` read in it, while the keys are still there. Nothing does
// that today; the ordering is one import away from mattering, and
// `test/build-keys.test.mjs` pins it rather than leaving it to luck.
//
// What it is FOR: this container executes model-written code (the render check
// runs the site's own server bundle in a child), and both spawn paths hand that
// child the whole environment. See the file for the measurement.
import { BUILD_KEYS } from "./build-keys.mjs";
import { callBuilderModel, keysFrom, BUILDER_CALL_MS } from "./build-call.mjs";
import { resolvePair, resolvePageFonts, resolveFont, fontCss, fontImports } from "./site-fonts.mjs";
import { themeCss, transitionOn } from "./site-theme.mjs";
import { normalizeSeeds } from "./site-seeds.mjs";
import { tokensCss, pageTokensCss } from "./site-tokens.mjs";
import { applyStyle, parseStyle, MAX_STYLE_BUILD } from "./site-style.mjs";
import { dirFor, initialsMark, normalizeLang, siteIconFrom } from "./site-identity.mjs";
import { langLabel, resolveLangs } from "./site-langs.mjs";
import { exitReason } from "./exit-reason.mjs";
import { runStep } from "./run-step.mjs";
import { startSiteServer } from "./site-ssr.mjs";
import { checkRender } from "./render-check.mjs";
import { routeOf, fileForRoute } from "./site-addon.mjs";
import { readCss } from "./site-freecss.mjs";

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
// AND A SEPARATE ONE FOR `/model`, BECAUSE THE TWO PAYLOADS ARE DIFFERENT THINGS.
//
// MEASURED, not chosen. A bare frontend page-generation request is 34,763
// characters — comfortably inside `MAX_BODY`, which is why this only shows up on
// the builds that carry an ATTACHMENT: `site-context.mjs` allows 13,981,096
// characters of base64 blocks plus 240,000 of text, so a worst case is 13.6MB
// against a 4MB cap.
//
// WHAT THAT WOULD HAVE COST IS A SILENCE RATHER THAN A FAILURE. `/model` would
// answer 413, the Worker's hop would read "no provider was reached", and
// `retryHere` would correctly make the call itself — so every build with a
// picture or a price list attached quietly goes back to running its ten-minute
// call on the side with a fifteen-minute cap, which is exactly the build most
// likely to need the time. It would have looked like the feature working.
//
// 16MB against a measured worst case of 13.61MB, and it is cheap: this instance
// type has 4 GiB and the string is freed the moment the call returns.
//
// THE GUARD DERIVES BOTH HALVES RATHER THAN RESTATING EITHER —
// `test/container-model.test.mjs` reads the block and text caps off
// `site-context.mjs` and BUILDS a real `pagesRequest` for the prompt half. Its
// first draft wrote 40,000 for that and the data prompt is 47,703, which is an
// understatement in the one direction that matters for a ceiling. So the day the
// attachment caps rise, or the prompt grows past the headroom, this goes red
// rather than every attachment build silently falling back again.
const MAX_MODEL_BODY = 16 * 1024 * 1024;

// THE EGRESS PROBE'S TARGETS AND ITS CEILING.
//
// `/v1/models` on each provider: a GET, no body, and refused without a
// credential — so it is the cheapest thing on either API that still exercises
// the whole path. What is being asked is never "is the API healthy", it is
// "did any HTTP response come back at all".
//
// BOTH PROVIDERS, because the answer may differ and the platform uses both:
// grok is `DEFAULT_PICKER` and does the building, Anthropic does the routing
// and the cheap edit lanes. Egress open to one and closed to the other is a
// real state and one that would be misread as "the container has no network".
const REACH_TARGETS = [
  { name: "xai", url: "https://api.x.ai/v1/models" },
  { name: "anthropic", url: "https://api.anthropic.com/v1/models" },
];
// TEN SECONDS, and it is a diagnosis rather than a bound on real work. A
// reachable host answers in well under a second; anything that has not answered
// by here is a black hole, and the probe's job is to say so quickly rather than
// to wait one out.
const REACH_TIMEOUT_MS = 10000;

// ── THE FIRE-AND-STORE GENERATION JOBS ───────────────────────────────────────
//
// One entry per `/model/start`, read back by `/model/result`. In memory rather
// than on disk deliberately: a container that was recycled has LOST the work
// however it was stored, so persisting it would only make an answer look
// recoverable when the process that was producing it is gone.
const MODEL_JOBS = new Map();
// A lane is one slug, so one live job is the normal state and two means a
// resume overlapped a start. More than that is something upstream retrying, and
// refusing is better than holding whole model answers — megabytes each — for a
// caller that has stopped listening.
const MAX_MODEL_JOBS = 8;
// LONGER THAN THE HOLD, ON PURPOSE. `MAX_BUSY_HOLD_MS` is thirty minutes, so a
// container is stopped before an answer can age out from under a caller that is
// still entitled to it; anything still here past this belongs to a build that
// gave up long ago.
const MODEL_JOB_TTL_MS = 45 * 60 * 1000;
/**
 * Drop what nobody is coming back for.
 *
 * KEYED ON `touchedAt`, NEVER ON `startedAt` — a generation legitimately runs
 * for ten minutes and a poll refreshes it, so a start-time TTL would delete a
 * job while it was still being produced.
 */
// HOW LONG TO SPEND HANDING THE ANSWER BACK. The body is megabytes and the far
// end is a Worker, so this is a real upload — but it runs inside `oneAtATime`,
// which means a report that hangs holds the busy counter open long after the
// generation finished and keeps a container alive doing nothing.
const REPORT_CALL_MS = 120_000;

/**
 * PUT THE ANSWER SOMEWHERE THAT OUTLIVES THIS INSTANCE.
 *
 * `MODEL_JOBS` is a `Map` in this process's memory holding whole model answers.
 * Cloudflare does not promise the instance survives, and when it does not the
 * generation is unrecoverable: the Worker is told `unknown` and the only way
 * back is to buy another one. That is what stage 2 kept losing builds to, and
 * this is the half that makes the loss impossible rather than merely rare.
 *
 * NO REPORT IS NOT AN ERROR. Every caller before 2026-08-26 sent none, and such
 * a job behaves exactly as it always did — answered from the Map alone.
 *
 * BEST-EFFORT, AND THAT IS NOT A HEDGE. The Map is written FIRST and still
 * answers `/model/result`, so a failed report costs the DURABILITY and never the
 * answer. Throwing would be worse than useless: this runs on a promise nobody
 * awaits, so an escaping rejection is an unhandled one — which in a Node request
 * handler kills the process and takes every other build on this container with
 * it, the exact reason the caller catches everything itself.
 */
async function sendModelReport(report, body) {
  if (!report || typeof report.url !== "string" || !report.url) return false;
  if (typeof report.token !== "string" || !report.token) return false;
  try {
    const r = await fetch(report.url, {
      method: "POST",
      // THE TOKEN IN A HEADER, NOT THE URL. A URL reaches logs, proxies and
      // error messages; this one is the only credential the receiving route has.
      headers: { "content-type": "application/json", "x-gen-report": report.token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REPORT_CALL_MS),
    });
    if (!r.ok) { console.error("model report: the worker answered", r.status); return false; }
    return true;
  } catch (e) {
    console.error("model report: could not deliver the answer —", String((e && e.name) || "Error"), String((e && e.message) || e));
    return false;
  }
}

function sweepModelJobs(now = Date.now()) {
  for (const [id, job] of MODEL_JOBS) {
    if (now - (job.touchedAt || job.startedAt || 0) > MODEL_JOB_TTL_MS) MODEL_JOBS.delete(id);
  }
}
// RAISED TO THIRTY MINUTES (2026-08-22, owner's call), with every other bound
// on the build path. Each step here is a subprocess — tsc, vite, the prerender
// — and the kill is what stops one wedging the container for the platform, so
// the mechanism stays and only the number moves. Measured worst: vite 37s.
const STEP_TIMEOUT = 1_800_000;
// THE CEILING ON `/hold`, which occupies a build lane and does nothing else.
// Fifteen minutes: comfortably past `SiteBuildContainer`'s five-minute idle
// timeout — which is the whole thing `/hold` exists to see past — and short
// enough that a probe somebody forgets about frees its lane within one build's
// worth of time rather than lingering.
const MAX_HOLD_MS = 900_000;

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
function writeSiteBrand({ title, lang, langs, logo, icon: sent, slug, seeds, transition }) {
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
      // THE SITE'S OWN PALETTE WHEN THERE IS ONE, AND SINCE 2026-08-24 THERE IS
      // NOT. `seeds` came off `design_schema` on 2026-08-23 and stopped being
      // sent from the Worker on 2026-08-24, when the owner's call made the look
      // the stylesheet alone — so on a real build this is `undefined`,
      // `markGround` answers null, and the mark falls back to the hue hashed
      // from the business NAME. That is the pre-2026-08-20 form and it is the
      // weaker of the two: swept over all 360 hues it bottoms out at 3.55:1
      // against the OKLCH one's 6.95:1, so it is legible everywhere and it no
      // longer matches the site.
      //
      // THE ARGUMENT STAYS AND IS STILL DRIVEN, by `site-build`'s own fixtures,
      // which post a palette straight to this container. So the path is tested
      // and only the Worker→container hop is quiet: the day anything sends a
      // palette again the mark picks it up with nothing here to rewire.
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
      // ANNOTATED for the reason `SITE_PAGE_TRANSITION` below is: an unannotated const has
      // the LITERAL type of whichever value was written, so a comparison against
      // the other member is `TS2367` and the template stops compiling.
      'export const SITE_DIR: "ltr" | "rtl" = ' + JSON.stringify(dirValue) + ";\n" +
      // THE EXTRA LANGUAGES, each with the direction ITS OWN tag implies rather
      // than the site's — an English site with an Arabic second language needs
      // `/ar` to read right to left while `/` reads left to right, and that is
      // only expressible because the kit is on logical utilities.
      'export const SITE_LANGS: ReadonlyArray<{ lang: string; dir: "ltr" | "rtl"; prefix: string; label: string }> = ' +
        JSON.stringify(langsValue) + ";\n" +
      // `SITE_MODE` IS GONE — LIGHT OR DARK IS A COLOUR, SO IT IS `css`
      // (owner's call, 2026-08-23). It baked a `dark` class onto `<html>`, and
      // a site that wants to be dark now writes dark values on `:root`.
      //
      // THE REASONING THAT KEPT IT WAS MEASURABLY FALSE. The comment here said
      // the class "flips every `dark:` utility in the kit, which is why this
      // beats emitting the dark values as `:root`" — measured before deleting:
      // ZERO of the 2,112 kit components carry a `dark:` utility. Nothing in
      // the kit branches on the class, so the whole of dark mode was token
      // values, and token values are the one thing `css` is for.
      //
      // `.dark` ITSELF STAYS AND IS NOT DEAD: `theme-toggle` toggles it on
      // `documentElement`, so a page that renders one still lets a VISITOR
      // switch. What went is the BAKED default, which is now just where the
      // designer chose to put its colours.
      // THE ROUTER'S HALF OF THE PAGE TRANSITION. `defaultViewTransition` in
      // `router.tsx` reads this; `pageCss` writes what it looks like. Both come
      // from `transitionOn`, once. ANNOTATED for the `SITE_DIR` reason — an
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
  return { lang: langValue, dir: dirValue, langs: langsValue, transition: transitionValue, icon: !!icon, ownIcon: iconOk, logo: !!logoValue, slug: !!slugValue,
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
function writeFonts(fonts, fontFiles, pageFonts, cssFonts) {
  const pair = resolvePair(fonts || {});
  // ── THE FAMILIES THE SITE'S OWN STYLESHEET NAMES ────────────────────────────
  //
  // Since 2026-08-23 there is no `fonts` field on the design tool: the model
  // writes `font-family` in its own CSS and the Worker reads the families back
  // out with `fontsIn`, so THIS is where nearly every site's typeface now
  // arrives. Ids on the wire, resolved here — the Worker already fetched the
  // woff2 for each into `fontFiles`, and what is still needed is the
  // `@font-face` block that points at the file and the npm import that bundles
  // an installed one.
  //
  // A FAMILY WE COULD NOT RESOLVE IS DROPPED RATHER THAN GUESSED AT: the Worker
  // reports it to the customer as a fallback, and inventing a package name here
  // is a build that fails on an import of something that does not exist.
  const cssFaces = (Array.isArray(cssFonts) ? cssFonts : [])
    .map((id) => resolveFont(id)).filter((f) => f && f.ok);
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
  const decls = fontCss(pair, written, pageScopes, cssFaces);
  // ── AN INSTALLED FAMILY IS @import-ED FROM THE STYLESHEET ────────────────────
  //
  // THE NPM IMPORT IN `fonts.ts` EMITS THE FILES AND NOT ONE RULE. Measured on a
  // real build: `import "@fontsource-variable/lora"` puts all seven
  // `lora-*.woff2` into `dist/client/assets/` and leaves **zero** `@font-face`
  // anywhere in `dist/client` OR `dist/server` — so the browser has the files
  // and nothing telling it to use them, falls through the stack, and renders the
  // system face while the build reports the family it asked for. That is the
  // exact failure shape this whole tier is written around, and it was true of
  // the template's own `geist` default too: EVERY published site.
  //
  // `@import "<pkg>";` FROM `styles.css` IS THE MECHANISM THAT WORKS, and it is
  // the one the template already relies on — `@import "tw-animate-css"` is an
  // npm CSS package resolved by the same Tailwind resolver. Measured on the same
  // build shape: 7 `@font-face` rules, `font-family:Lora Variable`,
  // `font-weight:400 700` (the real variable range), every subset, and each
  // `url()` rewritten to the hashed asset. Nothing else here changes.
  //
  // WHY NOT SEND EVERY FAMILY DOWN THE FETCH PATH INSTEAD, which demonstrably
  // works: the API hands back ONE STATIC WEIGHT for the latin subset, so
  // `font-weight:100 900` on it is a lie and every heading is synthetically
  // bolded. The installed 24 exist precisely to ship the real variable file.
  //
  // FIRST IN THE FILE, because `@import` after any rule is ignored per spec —
  // which puts these above `decls.faces` (the fetched families' own @font-face)
  // as well as above the base's `@import "tailwindcss"`.
  const pkgs = fontImports(pair, pageScopes, cssFaces);
  const cssImports = pkgs.map((p) => `@import "${p}";`).join("\n");
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
    fs.writeFileSync(STYLES, (cssImports ? cssImports + "\n" : "") +
      (decls.faces ? decls.faces + "\n" : "") + themed +
      (decls.scoped ? "\n" + decls.scoped + "\n" : ""));
  }

  // THE `fonts.ts` IMPORT STAYS, and it is belt-and-braces rather than the
  // mechanism: `routes/__root.tsx` imports this file, so it has to exist, and
  // the checked-in copy is what lets the template build standalone with a
  // typeface. Both importers resolve to ONE module, so the assets are emitted
  // once whichever of them is present.
  const imports = pkgs.map((p) => `import "${p}";`).join("\n");
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
function writeTheme(seeds, { style = null } = {}) {
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
  // ONE `applyStyle`, and its answer is read TWICE — the stylesheet, and what it
  // refused. Calling it again for the second would be a second opinion about a
  // question this function asks once.
  let composed;
  try { composed = applyStyle(theme, style); css = themeCss(composed); }
  catch { return { applied: false, theme: null, notes: ["The theme could not be rendered, so the site kept the default look."] }; }
  // THE CONTRAST GATE'S REFUSAL IS THE ONE NOBODY COULD BE TOLD ABOUT. It runs
  // here and nowhere else — the Worker's `styleNote` is composed from a parse
  // with no palette, so it never reaches this decision — and without carrying it
  // a hand-written wash that leaves the quiet text illegible is dropped in
  // silence: the site keeps the backdrop it had and the customer's own colours
  // are simply not there. Named, with the number, because "your wash was
  // refused" is not something anybody can act on.
  const refusedNotes = (composed && composed.styleRefused || []).map((r) =>
    `The ${r.axis} you wrote ${r.why} — the site kept the one it had.`);
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, theme: null, notes: refusedNotes.concat("The stylesheet could not be read, so the site kept the default look.") }; }
  // THE CORNER STRIP IS GONE (2026-08-22) AND NOTHING REPLACES IT, deliberately.
  //
  // It read `dropRadius ? stripThemeRadius(css) + explicitRadiusCss(style) :
  // css` — drop every `border-radius` the theme emitted whenever the customer
  // named a radius token, then put two of them back. Its whole case was a
  // measurement of the 500-theme registry, deleted 2026-08-20; a seeds-only
  // theme emits ZERO such rules, so the only ones here are what the AXES wrote.
  //
  // AND IT HAD BECOME A LIVE BUG once every axis became authorable: the
  // re-emit covered `buttons` and `inputs`, so an authored `corner` beside a
  // radius token was stripped and never restored — measured.
  //
  // The cascade decides it now, which is the mechanism the `display` axis
  // already rests on: these rules are UNLAYERED and Tailwind's `--radius`
  // derivations are utilities in `@layer utilities`, so an axis wins where it
  // applies and the token moves everything else.
  fs.writeFileSync(STYLES, base + "\n" + css + "\n");
  // The palette's own NAME, not an id — there is no registry to look one up in.
  return { applied: true, theme: theme.label, notes: refusedNotes };
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

/**
 * THE SITE'S WHOLE STYLESHEET, WRITTEN BY THE MODEL (2026-08-23, owner's call).
 *
 * Five design fields became one. `seeds`, `fonts`, `style`, `tokens` and
 * `tokensPage` asked for a palette, a typeface pairing, 29 axes, 24 named
 * colours and a per-page scope; `css` asks for the stylesheet and nothing else.
 *
 * NO VALIDATOR, AND THAT IS THE POINT RATHER THAN AN OVERSIGHT. Every other
 * look writer above goes through a parser — `writeTheme` runs the 29 axis
 * emitters, each owning its selector and a property allow-list; `writeTokens`
 * takes colours `isColor` accepts. This takes a string and appends it.
 *
 * WHAT IT COSTS, STATED RATHER THAN DISCOVERED: `display:none` blanks whatever
 * it lands on, `position:fixed` pins the page, `content:` puts page copy
 * through a field nobody reviews, `!important` takes the decision away from
 * everything else. All four are recorded in CLAUDE.md as REAL failures rather
 * than hypotheticals, and all four can now reach a published page.
 *
 * LAST, AFTER EVERY OTHER WRITER, which is the later-wins mechanism the token
 * override already rests on — and it is what makes this compatible with every
 * site published before today. Those store `seeds`/`style`/`tokens` and are
 * republished through the same container on every cheap edit, so their writers
 * still run and their look still applies; a site with free CSS simply has the
 * last word. Deleting the earlier writers would have re-styled the whole
 * platform on somebody's next typo fix.
 *
 * FAILS SOFT like the three above it: a site whose pages compiled and whose
 * data layer is live must not be lost because a stylesheet could not be
 * written. `readCss` never throws and returns `usable: false` for anything it
 * cannot use, so a build that sent none writes nothing at all and its
 * stylesheet is byte-identical to the build before this existed.
 */
function writeCss(css) {
  const report = readCss(css);
  if (!report.usable) return { applied: false, reason: report.reason, notes: [] };
  let base;
  try { base = fs.readFileSync(STYLES, "utf8"); }
  catch { return { applied: false, reason: "unreadable", notes: ["The stylesheet could not be written, so the site kept the default look."] }; }
  fs.writeFileSync(STYLES, base + "\n" + report.css + "\n");
  return {
    applied: true,
    bytes: report.bytes,
    // THE IDS, not the resolved face objects — this rides back on the response
    // and a url/pkg per family is noise nobody reads.
    fonts: report.fontIds,
    missingFonts: report.missingFonts,
    definesCore: report.definesCore,
    truncated: report.truncated,
    notes: report.notes,
  };
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
// WHAT THIS CONTAINER OWES, so a Durable Object that is about to stop it can ask
// first. See `builder/container-hold.mjs` for the failure this exists to
// prevent: once a Worker stops AWAITING a build, the library's inflight counter
// drops to zero, the idle clock starts, and the alarm stops the container
// mid-build — five minutes into work that takes seven to twelve.
//
// COUNTED AT THE DOOR, NOT INSIDE THE CHAIN. A build waiting its turn is work
// this container owes just as surely as the one compiling, and a container
// stopped while a job is queued loses it exactly the same way. `_busy > 0`
// therefore means "running OR queued".
//
// `_busySince` is the start of the current CONTINUOUS busy period rather than of
// the current job, because what the cap upstream needs to know is how long this
// container has been unable to go idle — a lane working steadily through three
// queued builds is a different thing from one job that hung, and only the
// continuous figure tells them apart.
let _busy = 0;
let _busySince = 0;
function oneAtATime(fn) {
  if (_busy === 0) _busySince = Date.now();
  _busy++;
  // BOTH SETTLEMENTS RELEASE. Registered on `done` rather than wrapped around
  // `fn`, so a job that throws frees the counter exactly as one that returns
  // does — a rejection leaking a permanent +1 would make this container claim to
  // be busy for the rest of its life and never be reclaimed.
  const release = () => { _busy = Math.max(0, _busy - 1); if (_busy === 0) _busySince = 0; };
  // The chain is normalised: the result value is dropped so a finished build's
  // whole dist is not retained by the queue, and a rejection is swallowed so it
  // cannot surface as an unhandled one. Not exercised by the handler below,
  // which catches everything itself — kept because those are properties of the
  // primitive rather than of its current only caller.
  const done = _chain.then(fn, fn);
  _chain = done.then(() => {}, () => {});
  done.then(release, release);
  return done;
}

/** What `/busy` answers. Exported shape, so the Worker's hold rule can read it. */
function busyState() {
  return { busy: _busy > 0, jobs: _busy, sinceMs: _busy > 0 ? Date.now() - _busySince : 0 };
}

// ── THE PLATFORM'S OWN KILL, SURVIVED ────────────────────────────────────────
//
// Cloudflare stops an instance by sending SIGTERM to the main process, waiting
// UP TO FIFTEEN MINUTES for it to exit, and only then sending SIGKILL — their
// own documented sequence. Node's DEFAULT disposition for SIGTERM is to exit
// IMMEDIATELY, and this file installed no handler: so every platform stop (an
// image rollout replacing instances, a host drain, an operator action) killed a
// five-to-ten-minute generation ON THE SPOT, declining a grace window longer
// than any generation ever measured. Run 41 lost two generations at identical
// ~7-8 minute instance ages, minutes after an image deploy, and the busy
// counter was never consulted — a platform stop never asks; the grace window
// is the only voice this process gets, and the default handler was refusing it.
//
// BUSY REFUSES TO DIE. With work in flight the process stays up: the model
// fetch keeps running (a signal does not touch it), `sendModelReport` still
// POSTs the answer to the Worker, and the resume collects it from R2 even
// though this instance is then culled. So the kill stops costing the paid call.
//
// BOUNDED INSIDE THE GRACE. The exit is forced at TERM_DRAIN_MS — under the
// platform's fifteen minutes — so a wedged job cannot turn the grace into a
// hang that ends in SIGKILL anyway, at a moment nobody chose.
//
// IDLE DIES AT ONCE. An idle instance being stopped is the ordinary lifecycle,
// and holding it open is a container billing for nothing.
const TERM_DRAIN_MS = 13 * 60 * 1000;
let _stopping = false;
process.on("SIGTERM", () => {
  if (_stopping) return;
  _stopping = true;
  const at = Date.now();
  console.log("build-server: SIGTERM, busy=" + _busy + (_busy > 0 ? " — refusing to exit until the work lands" : " — idle, exiting"));
  const leave = () => { console.log("build-server: exiting after SIGTERM, busy=" + _busy + " waited=" + Math.round((Date.now() - at) / 1000) + "s"); process.exit(0); };
  if (_busy === 0) return leave();
  // The interval itself keeps the event loop alive even if nothing else does,
  // which is what makes "refuse to die" more than a wish.
  const tick = setInterval(() => { if (_busy === 0 || Date.now() - at > TERM_DRAIN_MS) { clearInterval(tick); leave(); } }, 1000);
});

// A CRASH MUST NAME ITSELF BEFORE IT COSTS A GENERATION. Node kills the process
// on either of these by default, silently from outside — which is exactly what
// a lost instance looks like. Logged with the stack (observability now retains
// it), and while work is IN FLIGHT the process stays up: a possibly-wounded
// container that lands a paid answer beats a clean corpse that loses it, and
// `MAX_BUSY_HOLD_MS` upstream still bounds a container that goes truly wrong.
// Idle, an uncaught exception exits honestly — nothing is owed.
process.on("uncaughtException", (e) => {
  console.error("build-server: UNCAUGHT EXCEPTION, busy=" + _busy, (e && e.stack) || String(e));
  if (_busy === 0) process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error("build-server: UNHANDLED REJECTION, busy=" + _busy, (e && e.stack) || String(e));
});

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

  // CAN THIS CONTAINER REACH A MODEL PROVIDER AT ALL — the one question the
  // whole move of generation onto this side rests on, and it has cost two real
  // builds without ever being answered.
  //
  // IT IS FREE, WHICH IS THE ENTIRE POINT. The request carries NO CREDENTIAL, so
  // a provider that receives it answers 401 before it reads a token — nothing is
  // generated and nothing is billed. And **any HTTP status at all is the proof**:
  // a 401 means DNS resolved, TCP connected, TLS negotiated and HTTP completed,
  // which is every layer a real call needs. Blocked egress cannot produce a
  // status — it produces ENOTFOUND, ECONNREFUSED or a timeout instead.
  //
  // SO `reached` IS "did a status come back", never "was it 2xx". Reading it as
  // ok/not-ok would report a working network as a failure, which is the exact
  // inversion this probe exists to avoid.
  //
  // NOT INSIDE `oneAtATime`, deliberately: it is a question about the network
  // rather than about the working directory, it touches no files, and queued
  // behind a running build it would answer ten minutes late — which reads as a
  // timeout, i.e. as the failure it is meant to distinguish.
  if (req.method === "GET" && req.url === "/reach") {
    const probe = async (name, url) => {
      const at = Date.now();
      try {
        const r = await fetch(url, {
          method: "GET",
          // NO Authorization header. A key here would make this a real request
          // against a real account, and the whole value of the probe is that it
          // cannot spend anything.
          headers: { "user-agent": "gofarther-reach-probe" },
          signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
        });
        return { name, reached: true, status: r.status, ms: Date.now() - at };
      } catch (e) {
        // `cause.code` is where undici puts ENOTFOUND/ECONNREFUSED; `name` is
        // where an abort puts TimeoutError. Both are reported because they mean
        // different things: a refused connection is a policy, a timeout is a
        // black hole, and an operator needs to know which.
        return {
          name, reached: false,
          code: String((e && e.cause && e.cause.code) || (e && e.code) || (e && e.name) || "Error"),
          message: String((e && e.message) || e).slice(0, 200),
          ms: Date.now() - at,
        };
      }
    };
    Promise.all(REACH_TARGETS.map((t) => probe(t.name, t.url)))
      .then((results) => send(res, 200, { ok: true, results }))
      .catch((e) => send(res, 200, { ok: false, error: String((e && e.message) || e).slice(0, 200) }));
    return;
  }
  // IS THERE WORK IN FLIGHT? Asked by `SiteBuildContainer.onActivityExpired`
  // before it stops this container — see `builder/container-hold.mjs`. It has to
  // be trivially cheap and it has to answer while a build is running, which is
  // why it reads two numbers and touches nothing: a build spends nearly all its
  // time awaiting a subprocess, so the event loop is free and this answers in
  // milliseconds. A build that CANNOT answer it is one spinning the CPU, and
  // that is the container the caller should stop.
  if (req.method === "GET" && req.url === "/busy") { return send(res, 200, busyState()); }
  // OCCUPY THE QUEUE FOR N MILLISECONDS, AND NOTHING ELSE.
  //
  // The instrument for the one thing no unit test can reach: whether Cloudflare
  // really keeps this container alive past its idle timeout when nobody is
  // connected. Proving that with a real build costs credits and cannot be run
  // repeatedly; this costs a lane and a timer.
  //
  // IT GOES THROUGH `oneAtATime` DELIBERATELY — the point is to look exactly
  // like a build to the busy counter, and a hold that bypassed the queue would
  // prove the counter rather than the mechanism.
  //
  // THE RISK, STATED: this occupies one of five lanes, so a caller that could
  // reach it freely could starve the platform's builds. Containers are not
  // publicly addressable — the only way in is the Worker route, which is
  // owner-gated — and the ceiling here is the second guard rather than the
  // first, because a bound that lives only in the caller is one the next caller
  // forgets.
  if (req.method === "POST" && req.url && req.url.startsWith("/hold")) {
    const want = Number(new URL(req.url, "http://c").searchParams.get("ms"));
    const ms = Number.isFinite(want) && want > 0 ? Math.min(want, MAX_HOLD_MS) : 1000;
    oneAtATime(() => new Promise((r) => setTimeout(r, ms)));
    // ANSWERS AT ONCE rather than when the hold ends. The caller is proving that
    // an ABANDONED request leaves the container working, so it must be able to
    // walk away immediately — and a handler that only replied at the end would
    // make "the hold is running" indistinguishable from "the request is stuck".
    return send(res, 200, { held: true, ms });
  }
  // CAN THIS CONTAINER REACH THE MODEL PROVIDERS AT ALL?
  //
  // The second thing no unit test can answer, and the one that decides whether
  // generation can move in here. The image makes ZERO outbound provider calls
  // today — measured, `fetch(` appears in `builder/*.mjs` exactly once and it is
  // a loopback — so container egress to `api.anthropic.com` is documented as
  // open and has never been observed.
  //
  // A 401 IS THE PROOF, AND THAT IS WHAT MAKES THIS FREE. Sending no key at all
  // means the provider answers "authentication required" — which can only happen
  // if DNS resolved, TLS completed, the request was routed and a real server
  // replied. Nothing is spent, no key is needed, and no key is present to leak.
  // A DNS failure, a refused connection or a timeout is the opposite proof, and
  // each names itself rather than arriving as one word.
  //
  // BOTH PROVIDERS, because they are different hosts on different networks and
  // `DEFAULT_PICKER` is grok — a run that proved only Anthropic would say
  // nothing about the provider every build actually uses.
  // AN ASYNC ISLAND, because this handler is not async and must not become one.
  // Making it async would put every other route — the build, the busy read, the
  // hold — behind a promise boundary they do not have today, which is a change
  // to the request path of every build for the sake of a probe.
  if (req.method === "GET" && req.url === "/egress") {
    (async () => {
      const hosts = [
        ["anthropic", "https://api.anthropic.com/v1/messages"],
        ["xai", "https://api.x.ai/v1/chat/completions"],
      ];
      const out = {};
      for (const [name, target] of hosts) {
        const at = Date.now();
        try {
          // POST with an empty body: these endpoints answer 401 before they parse
          // anything, so an unauthenticated probe never reaches a billable path.
          const r = await fetch(target, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
            signal: AbortSignal.timeout(15000),
          });
          // The STATUS is the whole answer. The body is the provider's own error
          // prose and is not read — it can only add noise to a log.
          out[name] = { reached: true, status: r.status, ms: Date.now() - at };
        } catch (e) {
          // NAMED, never a bare false. `TimeoutError` (blocked, silently),
          // `ENOTFOUND` (no DNS) and `ECONNREFUSED` (no route) want completely
          // different answers, and "egress failed" tells the reader none of them.
          out[name] = { reached: false, kind: String(e && e.name), why: String((e && e.cause && e.cause.code) || (e && e.message) || e).slice(0, 120), ms: Date.now() - at };
        }
      }
      send(res, 200, out);
    })().catch((e) => {
      // A PROBE MUST NOT TAKE THE SERVER DOWN. An uncaught throw in a Node
      // request handler kills the process, mid-build, for every customer queued
      // behind it — and Cloudflare reports the restart as "the container is not
      // running", which reads as flaky infrastructure rather than as this.
      try { send(res, 500, { error: String((e && e.name) || e) }); } catch { /* already answered */ }
    });
    return;
  }
  // MAKE ONE MODEL CALL, AND HOLD IT OPEN FOR AS LONG AS IT TAKES.
  //
  // ── WHY THIS IS HERE AND NOT IN THE WORKER ─────────────────────────────────
  //
  // A queue consumer is guaranteed FIFTEEN MINUTES and that is a hard cap. Run
  // 38 spent 595,405ms in page generation alone and was refused by our own
  // budget before Cloudflare's. A container has "no fixed maximum runtime"
  // (Cloudflare's words) — it is bounded by an IDLE timeout, not a duration —
  // so the step that takes ten minutes belongs on this side of the wall.
  //
  // THE WORKER STILL BUILDS THE REQUEST. `pagesRequest` drags in fifteen modules
  // and ~1MB of prompt machinery, three of them at the repo root and outside
  // this image's build context, so the prompt tier cannot cross without a second
  // copy of it — and a second copy of a ~36,000-token prompt is two things that
  // drift. What crosses is the finished request; what happens here is the WAIT.
  //
  // ── IT GOES THROUGH `oneAtATime`, AND THE BUSY COUNTER IS WHY ──────────────
  //
  // Not for the serialisation — a model call touches no file, so it has nothing
  // to conflict over. For `_busy`. The whole point of moving generation here is
  // that the Worker can walk away, and the moment it does the library's inflight
  // counter reaches zero, the `sleepAfter` clock starts, and `onActivityExpired`
  // asks `/busy` whether to stop this container. A generation the counter cannot
  // see is a container stopped mid-call at five minutes, silently, reading as a
  // crash rather than as a timer doing its job. `oneAtATime` is what makes it
  // visible, and the serialisation it also buys is harmless: one container per
  // build, and a model call and a vite build competing for one CPU is not
  // something to want anyway.
  //
  // KNOWN BOUND, STATED: `MAX_BUSY_HOLD_MS` is thirty minutes, so a call still
  // running past that is stopped even while it reports busy. That is far above
  // any generation ever measured (the worst is ~10 minutes) and it is the number
  // to re-measure if this is ever asked to run an hour.
  // ── FIRE AND STORE: the call the Worker does NOT wait for ──────────────────
  //
  // `/model` below holds the socket for the whole generation, which is what the
  // Worker's own fifteen-minute consumer cap cannot afford: measured, design is
  // ~170s and generation is 334k-620k ms, so on a slow draw the pair alone is
  // past the ceiling and runs 38 and 39 both died at it having published
  // nothing. Moving the CALL here was only half — the WAIT was still on the
  // capped side.
  //
  // `/model/start` answers in milliseconds with an id and does the work in the
  // background; `/model/result` says whether it is finished. So no single
  // consumer invocation is ever long, and the cap stops binding.
  //
  // THE BUSY COUNTER IS WHAT MAKES THIS SAFE, and it is why the work goes
  // through `oneAtATime` even though nothing awaits it. That helper counts AT
  // THE DOOR and releases on SETTLEMENT — not on anybody awaiting — so a job
  // nobody is holding still reports through `/busy`, and `onActivityExpired`
  // keeps this container alive instead of stopping it five minutes in. Without
  // it, the first thing that happens after the Worker walks away is the idle
  // clock starting on work that takes ten minutes.
  //
  // THE FN CATCHES EVERYTHING ITSELF, which is not tidiness: `oneAtATime`
  // returns a promise this route deliberately does not await, so a rejection
  // escaping would be an unhandled one — and an unhandled rejection in a Node
  // request handler kills the process, taking every other build on this
  // container with it.
  if (req.method === "POST" && req.url === "/model/start") {
    let sBody = "", sTooBig = false;
    req.on("data", (c) => { sBody += c; if (sBody.length > MAX_MODEL_BODY) { sTooBig = true; req.destroy(); } });
    req.on("end", () => {
      if (sTooBig) return send(res, 413, { ok: false, error: "request too large" });
      let payload; try { payload = JSON.parse(sBody); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
      const mReq = payload && payload.req;
      if (!mReq || typeof mReq !== "object") return send(res, 400, { ok: false, error: "no req" });
      // The ceiling is ours, not the caller's — the same rule `/model` states.
      // A caller may ask for LESS (the composed build budget) and never more.
      const want = Number(payload.callMs);
      const callMs = Number.isFinite(want) && want > 0 ? Math.min(want, BUILDER_CALL_MS) : BUILDER_CALL_MS;
      const budget = { capMs: () => callMs };

      sweepModelJobs();
      // REFUSED RATHER THAN QUEUED PAST THE CAP. The store is bounded because a
      // leak here is a container holding whole model answers — megabytes each —
      // for the rest of its life. One lane is one slug, so more than a couple of
      // live jobs means something upstream is retrying rather than resuming.
      if (MODEL_JOBS.size >= MAX_MODEL_JOBS) {
        return send(res, 429, { ok: false, error: "too many generation jobs on this container" });
      }
      // WHERE TO SEND THE ANSWER SO IT OUTLIVES THIS INSTANCE. Optional: with no
      // report the job behaves exactly as it always has, answered only from the
      // Map below — which is what every caller did before 2026-08-26.
      const report = payload && payload.report && typeof payload.report === "object" ? payload.report : null;
      const id = randomUUID();
      MODEL_JOBS.set(id, { state: "pending", startedAt: Date.now(), touchedAt: Date.now() });
      // NOT AWAITED. The response goes back now; the counter holds until this
      // settles. `_busy` is incremented synchronously inside `oneAtATime`, so it
      // is already up by the time `send` runs — there is no window in which this
      // container looks idle with a generation in flight.
      oneAtATime(async () => {
        const at = Date.now();
        try {
          const answer = await callBuilderModel(keysFrom(BUILD_KEYS), mReq, budget);
          MODEL_JOBS.set(id, { state: "done", answer, ms: Date.now() - at, touchedAt: Date.now() });
          await sendModelReport(report, { state: "done", answer });
        } catch (e) {
          // THE SHAPE IS PRESERVED, exactly as `/model` preserves it: the Worker
          // parses `detail` for the provider's error type and reports `upstream`
          // as the numeric status and nothing else, and `retryHere` reads
          // `status` to decide whether money was spent. A container-side failure
          // flattened to a message is a real 429 wearing a container fault.
          MODEL_JOBS.set(id, {
            state: "failed",
            fail: {
              status: (e && e.status) || null,
              detail: e && typeof e.detail === "string" ? e.detail : "",
              message: String((e && e.message) || e).slice(0, 300),
              kind: String((e && e.name) || "Error"),
            },
            ms: Date.now() - at,
            touchedAt: Date.now(),
          });
          // A FAILURE IS AN ANSWER AND MUST BE PERSISTED TOO. Reported only on
          // success, a container that failed and was then recycled looks exactly
          // like one that lost the work — so the resume would buy another
          // generation to be told the same thing, which is the money the bound
          // on re-fires exists to protect.
          await sendModelReport(report, {
            state: "failed",
            status: (e && e.status) || null,
            detail: e && typeof e.detail === "string" ? e.detail : "",
            message: String((e && e.message) || e).slice(0, 300),
            kind: String((e && e.name) || "Error"),
          });
        }
      });
      return send(res, 200, { ok: true, id });
    });
    return;
  }

  // IS IT FINISHED — the other half, and the poll is ALSO the keep-alive.
  //
  // Every request through the container proxy renews the library's activity
  // timeout, so the Worker coming back every so often is what stops a five
  // minute idle window opening between checkpoints. That is a property of the
  // proxy rather than of this route, and it is written down because the obvious
  // "poll less often to be polite" is the change that would break it.
  //
  // A DONE JOB IS NOT DELETED ON READ. A queue delivers at least once, so a
  // duplicated resume message must find the same answer rather than "unknown
  // job" — which would read as the container having been recycled and lose a
  // generation that really did finish. The sweep is what bounds the store.
  if (req.method === "GET" && req.url.startsWith("/model/result")) {
    sweepModelJobs();
    const id = new URL(req.url, "http://build").searchParams.get("id") || "";
    const job = MODEL_JOBS.get(id);
    // UNKNOWN IS ITS OWN ANSWER AND MUST NOT READ AS PENDING. A container that
    // was recycled mid-generation has lost the work, and a caller told "pending"
    // there polls until its own deadline for an answer that is never coming.
    if (!job) return send(res, 200, { ok: true, state: "unknown" });
    job.touchedAt = Date.now();
    if (job.state === "pending") return send(res, 200, { ok: true, state: "pending", waitingMs: Date.now() - job.startedAt });
    if (job.state === "done") return send(res, 200, { ok: true, state: "done", answer: job.answer, ms: job.ms });
    return send(res, 200, { ok: true, state: "failed", ...job.fail, ms: job.ms });
  }

  if (req.method === "POST" && req.url === "/model") {
    let mBody = "", mTooBig = false;
    req.on("data", (c) => { mBody += c; if (mBody.length > MAX_MODEL_BODY) { mTooBig = true; req.destroy(); } });
    req.on("end", () => {
      if (mTooBig) return send(res, 413, { ok: false, error: "request too large" });
      let payload; try { payload = JSON.parse(mBody); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
      const mReq = payload && payload.req;
      if (!mReq || typeof mReq !== "object") return send(res, 400, { ok: false, error: "no req" });
      // THE CEILING IS OURS, NOT THE CALLER'S. A caller may ask for LESS —
      // that is the composed build budget, and honouring it is what stops a
      // generation started at minute eleven getting a fresh ten — but it may
      // not ask for more. A bound that lives only in the caller is one the next
      // caller forgets, which is the argument `/hold` two routes up already
      // makes about its own lane.
      const want = Number(payload.callMs);
      const callMs = Number.isFinite(want) && want > 0 ? Math.min(want, BUILDER_CALL_MS) : BUILDER_CALL_MS;
      // `callBuilderModel` reads exactly one thing off a budget, so this is the
      // whole of that interface. A live budget object cannot cross a wire —
      // `capMs` is a function over a clock — so the Worker sends the NUMBER it
      // would have produced and the composition stays on the side that owns it.
      const budget = { capMs: () => callMs };
      return oneAtATime(async () => {
        const at = Date.now();
        try {
          const answer = await callBuilderModel(keysFrom(BUILD_KEYS), mReq, budget);
          send(res, 200, { ok: true, answer, ms: Date.now() - at });
        } catch (e) {
          // THE SHAPE IS PRESERVED, not flattened to a message. `upstreamKind`
          // in the Worker parses `detail` for the provider's error type and the
          // one actionable billing sentence, and the route reports `upstream`
          // as "the numeric status from the model API and nothing else" — so a
          // call that arrived here as a real 429 must not come back looking
          // like a container fault. `status` absent is itself the signal that
          // no provider answered (a timeout, or a key we never set).
          send(res, 200, {
            ok: false,
            status: (e && e.status) || null,
            detail: e && typeof e.detail === "string" ? e.detail : "",
            message: String((e && e.message) || e).slice(0, 300),
            kind: String((e && e.name) || "Error"),
            ms: Date.now() - at,
          });
        }
      });
    });
    return;
  }
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
      const brandUsed = writeSiteBrand({ title: payload.title, lang: payload.lang, langs: payload.langs, logo: payload.logo, icon: payload.icon, slug: payload.slug, seeds: payload.seeds, transition: styleUsed.transition });
      const fontsUsed = writeFonts(payload.fonts, payload.fontFiles, payload.pageFonts, payload.cssFonts);
      // THE WHOLE PATCH, NOT `styleUsed`, and the difference is a feature.
      // `styleUsed` is the ENUM map — `parseStyle(...).style` — which is exactly
      // right for `transition` above and drops an AUTHORED backdrop on the floor,
      // because an authored value lives in `.authored` and never in `.style`.
      // `applyStyle` re-parses this WITH the site's own palette, which is the one
      // place a `var(--accent)` in a hand-written gradient can be resolved.
      const themeUsed = writeTheme(payload.seeds, { style: payload.style });
      // AFTER the theme, never before — later wins, and that IS the override.
      const tokensUsed = writeTokens(payload.tokens);
      // AND AFTER THOSE, one page's own. Same mechanism, one scope down.
      const pageTokensUsed = writePageTokens(payload.pageTokens);
      // AND LAST, THE STYLESHEET THE MODEL WROTE. See writeCss for why it is
      // last and why the four writers above it stay: every site published
      // before 2026-08-23 stores seeds/style/tokens and is republished through
      // this same container on every cheap edit, so removing them would restyle
      // the whole platform on somebody's next typo fix.
      const cssUsed = writeCss(payload.css);
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
      return send(res, 200, { ok: true, files: dist, ms: Date.now() - t0, ...times, templateId: TEMPLATE_ID, fonts: fontsUsed, theme: themeUsed, tokens: tokensUsed, pageTokens: pageTokensUsed, brand: brandUsed, render, worker, ...(cssUsed.applied ? { css: cssUsed } : {}), ...(ssr.unprivileged ? {} : { ssrUnprivileged: false }) });
    } catch (e) {
      return send(res, 200, { ok: false, stage: "build", error: String((e && e.message) || e).slice(0, 2000), ms: Date.now() - t0, ...times });
    }
    });
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi site build-service on :" + PORT));
