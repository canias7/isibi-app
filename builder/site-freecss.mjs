/**
 * THE SITE'S WHOLE STYLESHEET, WRITTEN BY THE MODEL (2026-08-23, owner's call).
 *
 * Five fields became one. `seeds`, `fonts`, `style`, `tokens` and `tokensPage`
 * asked the model for a palette, a typeface pairing, 29 axes, 24 named colours
 * and a per-page scope; `css` asks for the stylesheet and nothing else.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ──────────────────────────────
 *
 * It does not validate the CSS. That is the whole point of the change, and it
 * is the opposite of `site-css.mjs` (which parses a backdrop's stops so a
 * contrast floor can be proved) and of `site-authored.mjs` (which holds each
 * axis to a property allow-list). Neither is in front of this door.
 *
 * WHAT IT DOES INSTEAD IS REPORT, and the distinction matters because every
 * failure this door can produce is SILENT. A stylesheet that names a font we
 * did not fetch renders in a system face; one that never defines `--background`
 * renders the whole kit on shadcn's defaults; a `url()` is refused by the
 * published-site CSP with nothing in the page to say so. None of those throws,
 * none fails a build, and all three look like the model simply having taste we
 * did not expect. So each one is measured and named on the response.
 *
 * ── THE FONT HALF IS MECHANICAL, NOT STYLISTIC ─────────────────────────────
 *
 * `font-family: "Playfair Display"` is not a style opinion the browser can
 * honour — it is a request for a FILE. With no file behind it the browser
 * silently falls back and the site ships the wrong typeface while reporting
 * success. So the families the model names are extracted here, and anything it
 * names that we cannot host is reported rather than left to fail quietly.
 *
 * AGAINST THE WHOLE FONTSOURCE CATALOGUE, ~2,096 FAMILIES, not the 24-family
 * shortlist a menu used to offer — see `fontsIn` for the measurement, and for
 * why matching only the 24 would print a warning about a typeface that works.
 */

import { resolveFont } from "./site-fonts.mjs";

/**
 * THE WHOLE STYLESHEET, so the bound is far larger than the axes' 40,000 —
 * that one supplemented a theme and this one replaces it. A palette is ~31
 * custom properties twice over (light and dark) before a single rule is
 * written, and a site with a per-page scope writes them a third time.
 *
 * Bounded at all because the string is buffered in the Worker, sent to the
 * container, written to disk and compiled: an unbounded one is a body we hold
 * in memory and a stylesheet we ship to every visitor.
 */
export const MAX_CSS = 60000;

/**
 * THE TWO TOKENS THE KIT CANNOT RENDER WITHOUT, and they are a floor rather
 * than a list. `styles.css` maps every shadcn variable through `@theme`, and
 * 2,112 kit components paint with them — so a stylesheet that defines none of
 * them is not "a minimal design", it is the template's own default look with
 * the model's rules on top. Measured on the free-CSS arm: 7 rules total, and
 * the palette was the only thing that landed, because `seeds` was still there
 * to supply it.
 *
 * Checked as a REPORT and never as a refusal: a site that genuinely wants the
 * default palette is entitled to it, and refusing here would make a legitimate
 * answer look like a broken one.
 */
const CORE_TOKENS = Object.freeze(["--background", "--foreground"]);

function norm(s) { return String(s || "").trim().toLowerCase().replace(/["']/g, "").replace(/\s+/g, " "); }

/**
 * Blank comments before scanning, LENGTH-PRESERVING so offsets stay valid.
 *
 * Not tidiness: a commented-out `font-family` would otherwise be fetched, and
 * this repo has been bitten five times by prose containing the thing a scan is
 * looking for. CSS has only block comments, so there is no line-comment case to
 * get wrong.
 */
function blankComments(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
}

/**
 * Every family the stylesheet names, split from its fallback stack.
 *
 * THE FIRST NAME IN A STACK IS THE ONE THAT NEEDS A FILE — the rest are the
 * fallbacks by definition, and fetching `Arial` would be absurd. Generic
 * keywords are skipped for the same reason: `sans-serif` is not a file.
 */
const GENERIC = new Set(["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "inherit", "initial", "unset", "revert"]);

/**
 * THE FACES ALREADY ON THE READER'S MACHINE, and this list exists to stop a
 * FALSE ALARM rather than to enable anything.
 *
 * `font-family: Georgia, serif` is a complete, working, deliberate answer — the
 * face ships with every desktop operating system, so there is nothing to fetch
 * and nothing degrades. Without this the report would tell the customer their
 * typeface "is not one we can host" and had fallen back, about a stylesheet
 * doing exactly what it says. A check that cries wolf on correct output is worse
 * than the miss it prevents, which is the bar every lint in this repo had to
 * clear before it could exist.
 *
 * MEASURED RATHER THAN GUESSED at the other end too: 19 of these 20 come back
 * `unknown` from `resolveFont`, so without this list they would every one have
 * been reported. `Baskerville` is the exception and is deliberately NOT here —
 * it resolves to Fontsource's own `baskervville`, which is a real family and a
 * better answer than a fallback.
 */
const SYSTEM = new Set([
  "georgia", "helvetica", "helvetica neue", "arial", "arial black", "times", "times new roman",
  "courier", "courier new", "verdana", "tahoma", "trebuchet ms", "palatino", "palatino linotype",
  "garamond", "book antiqua", "century gothic", "lucida grande", "lucida sans", "segoe ui",
  "roboto", "menlo", "monaco", "consolas", "cambria", "candara", "calibri", "charter",
  "iowan old style", "avenir", "avenir next", "futura", "optima", "didot", "impact",
  "-apple-system", "blinkmacsystemfont", "apple color emoji", "segoe ui emoji",
  "sf pro", "sf mono", "new york", "noto color emoji", "emoji",
]);

export function fontsIn(css) {
  const src = blankComments(css);
  const named = [];
  const seen = new Set();

  // ── A FONT STACK IS OFTEN IN A CUSTOM PROPERTY, AND THAT IS THE COMMON CASE
  //
  // The first draft skipped `font-family: var(--font-sans)` on the reasoning
  // that the variable's own declaration would be scanned as a `font-family`.
  // It is not — `--font-sans: "Lora", serif` is a custom property, not a
  // font-family declaration — so the family was named, never matched and never
  // fetched. And this is not an edge case: it is exactly how the template's own
  // styles.css is written, so it is the shape a model copying it produces.
  //
  // THE RULE IS RESOLUTION, NOT A NAMING CONVENTION. A property is a font stack
  // because a `font-family` REFERENCES it — never because it happens to be
  // called `--font-something`, which would miss `--type-display` and would
  // wrongly claim `--font-size`. Collected first, resolved second.
  const stackVars = new Set();
  for (const m of src.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    for (const v of String(m[1]).matchAll(/var\(\s*(--[\w-]+)/g)) stackVars.add(v[1]);
  }
  const stacks = [];
  for (const name of stackVars) {
    // One hop only. A chain (`--a: var(--b)`) is legal and vanishingly rare,
    // and following it needs cycle detection for a case no stylesheet here has
    // ever produced — so it resolves to nothing and is reported as unmatched
    // rather than silently fetched wrong.
    const d = new RegExp(name.replace(/-/g, "\\-") + "\\s*:\\s*([^;}]+)").exec(src);
    if (d) stacks.push(d[1]);
  }

  for (const m of src.matchAll(/font-family\s*:\s*([^;}]+)/gi)) stacks.push(m[1]);

  for (const stack of stacks) {
    // A stack that is ONLY a var() reference names no file itself — its target
    // was resolved above.
    if (/^\s*var\(/.test(String(stack))) continue;
    const raw = String(stack).split(",")[0].trim().replace(/^["']|["']$/g, "");
    const head = norm(raw);
    if (!head || GENERIC.has(head) || SYSTEM.has(head) || seen.has(head)) continue;
    seen.add(head);
    // THE ORIGINAL SPELLING TRAVELS, not the normalised key. The report goes to
    // a CUSTOMER, and "helvetica neue" reads as a bug where "Helvetica Neue"
    // reads as their own words handed back.
    named.push(raw);
  }
  // ── RESOLVED AGAINST THE WHOLE FONTSOURCE CATALOGUE, NOT THE 24-FAMILY
  //    SHORTLIST, and the first draft of this got it wrong in the expensive
  //    direction.
  //
  // The shortlist is what a MENU offered, and there is no menu here — the model
  // writes a family name and `resolveFont` already answers for all ~2,096
  // Fontsource families: the 24 installed ones come back `installed` (an npm
  // import bundles them) and everything else comes back `fetch` (a woff2 is
  // downloaded). Matching only the 24 would have reported `Cormorant Garamond`
  // as unhostable while `fetchSiteFonts` fetches it happily — a warning printed
  // to a customer about a typeface that works.
  //
  // A SYSTEM FACE STILL COMES BACK UNKNOWN, measured across 20 of them
  // (Georgia, Helvetica, Segoe UI, Menlo, Futura…): 19 resolve to nothing and
  // `Baskerville` matches Fontsource's own `baskervville`, which is the family
  // somebody writing that word wants. So the fuzzy matcher does not invent a
  // download for a face the browser already has.
  const use = [];
  const missing = [];
  for (const n of named) {
    const f = resolveFont(n);
    if (f && f.ok) { if (!use.some((x) => x.id === f.id)) use.push(f); }
    else missing.push(n);
  }
  return { fonts: use, ids: use.map((f) => f.id), missing };
}

/**
 * Read a stylesheet the model wrote and say what it is.
 *
 * NEVER THROWS AND NEVER REFUSES A BUILD. Every answer is a report: `usable`
 * says whether there are bytes to write at all, and everything else is
 * something the customer or an operator would want to know and which the page
 * itself cannot say.
 *
 * A NON-STRING IS REFUSED RATHER THAN COERCED. `String(["a{}"])` is `"a{}"` —
 * a perfectly good stylesheet built out of a shape mistake — and this repo has
 * shipped that coercion as a real bug three times.
 */
export function readCss(css) {
  if (typeof css !== "string") {
    // ── A REFUSED SHEET IS SAID OUT LOUD; AN ABSENT ONE IS NOT ────────────────
    //
    // The two are not the same answer and collapsing them loses the half that
    // matters. Absent (`none`) is the ordinary path: the tool tells the model to
    // OMIT `css` to leave the look alone, so every text fix, colour change and
    // picture swap takes it, and a note there would put a sentence about the
    // design on every edit that is not about the design.
    //
    // A NON-STRING IS AN ANSWER WE THREW AWAY, and without a note it is the
    // exact silent failure this module exists to end: the customer asked for a
    // look change, the stored sheet is kept, the reply says the look moved and
    // nothing moved. Reported in the customer's own terms, because "css was not
    // a string" is our problem described in our words.
    return {
      usable: false, reason: css == null ? "none" : "not-a-string", bytes: 0, fonts: [],
      notes: css == null ? [] : ["The design came back in a shape we could not read, so the site kept the look it had."],
    };
  }
  const trimmed = css.trim();
  if (!trimmed) return { usable: false, reason: "empty", bytes: 0, fonts: [], notes: [] };

  const notes = [];
  let use = trimmed;
  let truncated = false;
  if (use.length > MAX_CSS) {
    // CUT AT A RULE BOUNDARY, never mid-declaration: a stylesheet chopped
    // inside a block is a syntax error from that point on, and Lightning CSS
    // drops everything after it — so a 1-character overrun would cost the
    // whole tail rather than the last rule.
    const at = use.lastIndexOf("}", MAX_CSS);
    use = at > 0 ? use.slice(0, at + 1) : use.slice(0, MAX_CSS);
    truncated = true;
    notes.push(`The stylesheet was longer than ${MAX_CSS.toLocaleString()} characters, so the end of it was not used.`);
  }

  const scanned = blankComments(use);
  const { fonts, ids, missing } = fontsIn(use);
  if (missing.length) {
    notes.push(`These typefaces are not ones we can host, so they fall back to a system font: ${missing.slice(0, 6).join(", ")}.`);
  }

  // THE KIT'S OWN TOKENS. A stylesheet defining neither is a site rendering on
  // the template's default palette whatever else it says — reported, because
  // from outside that is indistinguishable from a deliberate choice.
  const defines = CORE_TOKENS.filter((t) => new RegExp(t.replace(/-/g, "\\-") + "\\s*:").test(scanned));
  if (!defines.length) {
    notes.push("The stylesheet sets none of the kit's own colour variables, so the site renders on the default palette.");
  }

  // `url()` IS REPORTED, NOT REFUSED. The published-site CSP has no font or
  // image host beyond our own origin, so a remote one is refused by the browser
  // with nothing in the page to say why — which is exactly the silent failure
  // this module exists to make loud. A `data:` URI is left alone: it needs no
  // network and is the one form that actually works.
  const remote = [...scanned.matchAll(/url\(\s*['"]?(https?:)?\/\//gi)].length;
  if (remote) {
    notes.push(`${remote} remote url() ${remote === 1 ? "reference is" : "references are"} in the stylesheet; the site's own security policy refuses those, so they will not load.`);
  }

  return {
    usable: true,
    reason: null,
    bytes: use.length,
    css: use,
    // THE RESOLVED FACES, for the caller to fetch and bundle; the ids alone are
    // what the response and the container payload carry. Two shapes because the
    // fetch needs the `url`/`pkg`/`source` and nothing downstream of it does.
    fonts,
    fontIds: ids,
    missingFonts: missing,
    definesCore: defines.length === CORE_TOKENS.length,
    truncated,
    notes,
  };
}

/**
 * The sentence the CUSTOMER is shown, or "" when there is nothing worth saying.
 *
 * Composed here rather than in the client for the reason every other note in
 * this repo is: the client is a plain script that cannot import this module, so
 * a second copy there drifts toward claiming a typeface that was never fetched.
 */
export function cssNote(report) {
  if (!report || !report.notes || !report.notes.length) return "";
  return report.notes.join(" ");
}
