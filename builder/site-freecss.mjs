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
 * ── THE LABEL GUARD: A BUTTON'S WORDS MAY NOT BE ITS OWN FILL ──────────────
 * (2026-08-27, after four live sightings of the same defect)
 *
 * THE DEFECT, MEASURED RATHER THAN REASONED. Tailwind v4 emits its utilities
 * inside `@layer utilities`; this module's stylesheet is appended UNLAYERED; and
 * an unlayered rule beats a layered one whatever its specificity. Every call to
 * action in this kit is `<a class="bg-primary text-primary-foreground">`, so one
 * ordinary model rule — `a, nav a { color: var(--muted-foreground) }`, which is
 * a perfectly reasonable "links are quiet" opinion — repaints the label and the
 * button reads as a solid block. Photographed on run 34, then again on runs 47
 * and 48: `color: rgb(28,27,25)` on `background: rgb(28,27,25)`, the site's own
 * primary colour on itself.
 *
 * THE FIX IS ONE PROPERTY OF THE CASCADE. Among rules that are equally
 * unlayered, SPECIFICITY decides — and a class (0,1,0) beats a bare element
 * (0,0,1) or a descendant pair (0,0,2). So re-emitting the kit's own label
 * utilities unlayered puts them above every blanket element rule a model can
 * write, and it does so WITHOUT depending on where they land in the file.
 * Measured in a real browser across all six shapes below.
 *
 * WRITTEN BEFORE THE MODEL'S SHEET, NOT AFTER, and the difference is what a
 * DELIBERATE rule can still do. Both placements fix the blanket-rule bug
 * identically (it loses on specificity either way), and only the earlier one
 * leaves a model that aims at `.text-primary-foreground` itself in charge of it
 * — which is a design decision rather than an accident, and is not this guard's
 * business. It also keeps the `css` field's own promise — YOUR RULES ARE
 * WRITTEN LAST — literally true.
 *
 * EVERY DECLARATION IS `var()`, SO THE MODEL KEEPS CONTROL THROUGH THE TOKEN.
 * A site whose stylesheet sets `--primary-foreground` gets that colour on its
 * buttons; what it cannot do any more is silently lose the label to a rule that
 * was never about buttons. The correct route stays open and the accident closes.
 *
 * SIX PAIRS AND NOT ONE MORE, and the boundary is measured off the kit rather
 * than chosen. These are the foregrounds that sit ON A FILLED SWATCH, where the
 * two colours are a pair and breaking one blanks the words. The other three —
 * `muted-foreground` (7,444 uses), `card-foreground`, `popover-foreground` —
 * are the colours of ordinary text on ordinary paper, which is exactly the
 * freedom a model should keep: `a { color: var(--muted-foreground) }` is a
 * legitimate thing to want everywhere it is NOT a button.
 *
 * WHAT IT DOES NOT COVER, STATED RATHER THAN DISCOVERED: a stylesheet whose
 * `--primary` and `--primary-foreground` are the same colour is still an
 * unreadable button, and no re-emission can fix a pair that is wrong in itself.
 * That is a palette fault rather than a cascade one, the render check's contrast
 * pass reports it, and it is not this guard's business.
 *
 * IT REACHES A SITE ON ITS NEXT PUBLISH AND NOT BEFORE. Nothing is rewritten in
 * place, so no site changes the day this ships — which is the same property
 * every publish-time fix here has, and the reason it is safe to deploy at all.
 */
export const ON_FILL_PAIRS = Object.freeze([
  "primary", "secondary", "accent", "destructive", "success", "warning",
]);

export const LABEL_GUARD = ON_FILL_PAIRS
  .map((n) => `.text-${n}-foreground{color:var(--${n}-foreground)}`)
  .join("\n");

// ── THE SHELL GUARD (2026-08-27, run 51) ────────────────────────────────────
//
// Run 51's sheet wrote `[data-slot=site-chrome]{display:grid;
// grid-template-columns:13.5rem 1fr}` — the whole site shell, whose children
// are header, page and footer STACKED, turned into a two-column grid. Grid
// auto-placement then dealt those three into columns like cards: the brand
// clipped inside a 216px column, the footer crushed into the same gutter, a
// dead white column down every page. Measured live on northgroup-15.
//
// The intent was even right — an edge-to-edge desk — and the correct lever
// (`sidebar-layout`, which the same sheet ALSO gridded, correctly) was one
// component over. But re-laying-out the shell has NO correct case: its
// stacking is what makes a site a site. So, like the label guard above, the
// accident is closed in the CASCADE rather than asked about in prose — the
// prompt rule beside it ("dress the shell, never re-arrange it") teaches the
// principle; this is what makes ignoring it inert.
//
// THE DOUBLED ATTRIBUTE SELECTOR IS THE WHOLE MECHANISM. `[x][x]` is legal
// CSS and counts the attribute twice, so this rule scores (0,2,0) where any
// plausible model rule on the shell scores (0,1,0)-(0,1,1) — and among
// equally UNLAYERED rules specificity decides, wherever each lands in the
// file. Written BEFORE the model's sheet like the label guard, keeping "YOUR
// RULES ARE WRITTEN LAST" literally true. The stated limit, same as the
// label guard's: a sheet that doubles the selector itself out-ranks us — a
// deliberate act, not the accident this closes.
//
// ONLY the stacking is pinned. Colours, borders, min-height, padding on the
// shell stay the model's; `sidebar-layout`, `side-nav` and every other
// component stay entirely free — the desk frame is theirs to shape.
export const SHELL_GUARD =
  "[data-slot=site-chrome][data-slot=site-chrome]{display:flex;flex-direction:column}";

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

// ── DID THE SHEET POINT AT ANYTHING THAT EXISTS? (2026-08-31, run 96) ────────
//
// Run 96 asked for the header button in a deep forest green. The lane answered
// `header button{background-color:#1b4332}` — right colour, right scope, one
// rule, nothing else touched — published, reported `ok: true` and billed a
// credit. The site did not change by a single pixel, because the kit renders
// that control as an `<a>`: there is not one `<button>` element on the page.
//
// NOTHING COULD HAVE CAUGHT IT. The CSS is valid, so it compiles; the site
// publishes; a rule matching nothing is byte-for-byte as healthy as a rule that
// worked. The `look` lane never sees the page — it is shown the stored
// stylesheet and the customer's sentence and nothing else — so it was guessing
// at markup, and "button" is what the customer called it.
//
// ── WHY THIS JUDGES SO LITTLE, DELIBERATELY ─────────────────────────────────
//
// The bar here is ZERO false alarms, and there is no corpus to measure one
// against: `test/fixtures/corpus` is 100 sites of TSX pages and not one
// stylesheet. So instead of a heuristic checked against examples, this reports
// only selectors whose zero-match verdict is SOUND BY CONSTRUCTION — a plain
// structural selector that matches no element cannot affect any element, and no
// example is needed to know that.
//
// Everything else is skipped in silence, and each exclusion is a real way a
// live selector matches nothing in a static DOM:
//
//   · `:` — every pseudo-class and pseudo-element. `button:hover` matches
//     nothing until somebody hovers; `p::before` matches no ELEMENT at all.
//     This one exclusion covers the whole family, which is why it is a bare
//     character test rather than a list of names that would go stale.
//   · `.dark` / `.light` — the theme hooks. `.dark .card` matches nothing while
//     the page is in light mode, and it is perfectly correct CSS.
//   · `[data-state`, `[aria-`, `[open]`, `[hidden]` — runtime state. A dialog's
//     rules match nothing until it opens. `[data-slot=…]` is NOT here and must
//     not be: it is the kit's structural hook, present in the DOM from the
//     first paint, and excluding it would blind this to most of the kit.
//   · `&` — nesting. A nested selector has no meaning standing on its own.
//
// A selector this skips is not judged safe; it is judged UNJUDGEABLE, and the
// difference matters — see `deadNote`, which counts what was looked at.

/** Split a selector list on commas that are not inside `(`, `[` or a string. */
function splitSelectors(list) {
  const out = [];
  let buf = "", depth = 0, quote = "";
  for (const ch of String(list)) {
    if (quote) { buf += ch; if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    // THE COMMA INSIDE `:is(a, b)` IS NOT A SELECTOR BOUNDARY, and a flat
    // `split(",")` is this repo's own recorded "flat scans where depth matters"
    // trap — written wrong five-plus times before this one.
    if (ch === "," && depth <= 0) { out.push(buf.trim()); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** The state hooks a static DOM cannot answer for. See the block above. */
const STATE_HOOKS = Object.freeze(["[data-state", "[aria-", "[open]", "[hidden]"]);

/** Is this selector one whose zero-match verdict would be sound? */
export function judgeableSelector(sel) {
  const s = String(sel || "").trim();
  if (!s || s.length > 200) return false;
  if (s.includes(":") || s.includes("&") || s.includes("@")) return false;
  // WORD-BOUNDED, so `.darkroom-panel` on a photographer's site is judged and
  // only the theme hook itself is skipped. A bare `includes(".dark")` would
  // silently stop judging any class that merely starts that way.
  if (/(^|[^\w-])\.(dark|light)([^\w-]|$)/.test(s)) return false;
  if (STATE_HOOKS.some((h) => s.toLowerCase().includes(h))) return false;
  // A selector has to actually select something. `*` is legal and always
  // matches, so it is judgeable but pointless; anything with no name, class,
  // id, attribute or `*` in it is not a selector we understand.
  return /[A-Za-z0-9_\-*]/.test(s);
}

/**
 * Every selector in a model-written stylesheet whose liveness we can judge.
 *
 * DESCENDS INTO `@media`/`@supports`/`@container`/`@layer` and REFUSES to
 * descend into `@keyframes`, whose "selectors" are `from`, `to` and `40%` —
 * testing those against a DOM is meaningless, and reporting them dead would be
 * a false alarm on every animation anybody writes. `@font-face`, `@property`
 * and friends are skipped the same way: their blocks contain declarations, not
 * rules.
 */
export function plainSelectors(css) {
  if (typeof css !== "string" || !css.trim()) return [];
  const src = blankComments(css);
  const out = [];
  const seen = new Set();
  // A prelude is everything since the last `{`, `}` or `;` at this level.
  let buf = "", quote = "";
  const stack = [];              // one entry per open block: true = descend
  let descend = true;            // are we inside blocks we still read rules from?
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) { buf += ch; if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      const isAt = prelude.startsWith("@");
      // AN AT-RULE EITHER CONTAINS RULES OR IT DOES NOT, and only the first
      // kind is worth walking into. Listed by what they CONTAIN rather than by
      // name-matching every at-rule that exists, so an at-rule nobody here has
      // heard of is skipped rather than read as a selector.
      const nests = /^@(media|supports|container|layer|scope|document)\b/i.test(prelude);
      const into = isAt ? (nests && descend) : descend;
      if (!isAt && descend) {
        for (const one of splitSelectors(prelude)) {
          if (judgeableSelector(one) && !seen.has(one)) { seen.add(one); out.push(one); }
        }
      }
      stack.push(descend);
      // Inside a plain style rule sit declarations, not rules — so stop reading
      // preludes until it closes. Nested CSS would put rules there, and those
      // carry `&`, which `judgeableSelector` already refuses.
      descend = isAt ? into : false;
      continue;
    }
    if (ch === "}") { buf = ""; descend = stack.length ? stack.pop() : true; continue; }
    if (ch === ";" && !stack.length) { buf = ""; continue; }
    buf += ch;
  }
  return out;
}

/**
 * The customer's sentence for rules that point at nothing.
 *
 * `looked` IS REQUIRED AND IS THE WHOLE HONESTY OF THIS. If the render check
 * opened no page — the server did not start, every route 404'd, the browser
 * would not launch — then every selector matches nothing and a naive reader
 * calls the entire stylesheet dead. That is this repo's "a negative assertion
 * must prove its observer is alive" trap, and it is the one failure mode that
 * would turn this from a safety net into an outage. No pages looked at means
 * no verdict, and the empty string says so.
 */
export function deadNote(dead, looked) {
  if (!Array.isArray(dead) || !dead.length) return "";
  if (!Number.isFinite(looked) || looked < 1) return "";
  const list = dead.slice(0, 3).map((s) => "`" + s + "`").join(", ");
  const more = dead.length > 3 ? ` (and ${dead.length - 3} more)` : "";
  return dead.length === 1
    ? `One rule in the new stylesheet points at something this site does not have — ${list} matches nothing on the page, so it changes nothing.`
    : `${dead.length} rules in the new stylesheet point at something this site does not have — ${list}${more} match nothing on the page, so they change nothing.`;
}
