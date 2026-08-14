// Does the site LOOK like anything?
//
// THE GAP THIS FILLS, and it is the largest one left in the build path. The
// pipeline has four checks — validate, lint, typecheck, build — and every one of
// them is TEXTUAL. Not one of them ever draws a page and looks at it. So a
// generated site can be blank, unreadable, or throwing on load, and score a
// clean run on all 26 steps: compiled, bundled, published, reported as a success.
//
// That is not a hypothetical. Every visual failure this repo has ever recorded
// was found by a HUMAN looking at a screen, never by the pipeline:
//
//   all 70 charts rendered GREY and typechecked perfectly
//   every uploaded image 404'd on the only address anybody shares
//   a dark background left every line of body copy almost invisible
//   the favicon's CJK glyph overflowed its own box
//   a modal on every published site was see-through
//
// Eight-plus of those, and the pipeline had no opinion about any of them.
//
// THE SPLIT: this module JUDGES, the harness OBSERVES. `probe()` runs inside the
// page and returns numbers; everything that decides what a number MEANS lives
// here, in a plain module with no browser and no I/O, so all of it is tested
// with literal objects. Same shape as `publish-pages.mjs` taking its side
// effects injected — the part where a mistake is expensive is the part that has
// to be drivable without infrastructure.
//
// IT CAN ONLY EVER REPORT (owner's call, 2026-08-13). Nothing here fails a
// build, refuses a publish or sends a page to salvage. A first version with
// teeth would be the one thing this codebase keeps saying not to build: a check
// that cries wolf teaches everyone to ignore it, and worse, a false "your site
// is blank" that refused to publish would be catastrophic. Measure the false
// alarms on real sites first; give it teeth after, if the number earns it.

/** Both widths, and the phone one is not optional.
 *
 * The see-through-modal bug was found by somebody tapping a hamburger on a
 * phone, and nothing in this pipeline has ever rendered below 1280px. Most
 * visitors to a barber shop's website are on a phone, so the untested width is
 * the primary one. 375 is the narrowest mainstream device; anything that
 * survives it survives the rest. */
export const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
];

/** Visible characters below which a page is not a page.
 *
 * Deliberately LOW. A legitimately sparse page exists — a gallery, a landing
 * page with a headline and a button — and calling one of those blank is the
 * false alarm that would discredit the whole check. 40 characters is roughly
 * "one heading and nothing else": far under anything a real page carries, and
 * far over what an accidental empty render produces (which is zero). */
export const BLANK_TEXT_CHARS = 40;

/** Below this, text is not hard to read — it is invisible.
 *
 * WCAG's floor for body text is 4.5, and reporting at 4.5 would flag deliberate
 * design constantly: every muted caption, every placeholder, every disabled
 * control sits in the 3-4.5 band ON PURPOSE. 3.0 is the "large text" floor and
 * is where legibility genuinely stops, so anything under it is a bug rather than
 * a taste. The recorded failure it exists for measured far below this: a light
 * theme's dark grey on a dark background, which is ~1.2. */
export const MIN_CONTRAST = 3;

/** Sideways scroll under this is a rounding artefact, not a spill.
 *
 * Sub-pixel layout routinely produces a fraction of a pixel of scrollWidth over
 * clientWidth on a page that is perfectly fine. */
export const OVERFLOW_SLACK = 2;

/** Findings carried back on the response. Model-adjacent text rides in these, and
 *  a report nobody can read is the same as no report. */
export const MAX_FINDINGS = 24;
const MAX_PER_PAGE = 6;
const MAX_DETAIL = 160;

const clip = (s, n = MAX_DETAIL) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

/**
 * The things a visitor OPENS, and nothing else.
 *
 * WHY A LIST AND NOT "CLICK WHAT IS THERE". A generated page is arbitrary
 * markup; clicking arbitrary elements is unbounded, and a stray click submits a
 * form or navigates away — the check would be slow AND capable of doing
 * something. Every selector here is a trigger the KIT renders, whose only job is
 * to open an overlay, so the blast radius of a click is a panel appearing.
 *
 * WHICH OF THESE ACTUALLY FIRES WAS MEASURED, NOT ASSUMED, and only one pair
 * does. This template's overlays are RAW RADIX primitives — `const SheetTrigger =
 * SheetPrimitive.Trigger` — so nothing renders a `data-slot`, and the whole
 * check rides on the two `aria-haspopup` lines. Radix emits those itself, which
 * is why they work without the kit cooperating.
 *
 * The `data-slot` five are kept DELIBERATELY and said so here rather than left
 * looking load-bearing: newer shadcn stamps them, so a kit refresh is the likely
 * way this template grows them, and they cost one selector each. `test/
 * site-render.test.mjs` measures the kit and fails if that stops being the
 * story — a list where five of seven entries can never match is otherwise
 * protection that reads real and is not.
 */
export const OVERLAY_TRIGGERS = [
  // These two do all the work today. Proven live: a real Sheet opened by a real
  // click, measured at 35% opaque — the recorded bug, caught.
  '[aria-haspopup="dialog"]',
  '[aria-haspopup="menu"]',
  // Inert against this template, on purpose. See above.
  '[data-slot="sheet-trigger"]',
  '[data-slot="dialog-trigger"]',
  '[data-slot="drawer-trigger"]',
  '[data-slot="dropdown-menu-trigger"]',
  '[data-slot="popover-trigger"]',
];

/** How many to open per page. A header menu plus a filter dropdown is the
 *  ordinary case; past three is the same component repeated, and every open
 *  costs real time on a clock the customer is watching. */
export const MAX_OPENS = 3;

/** A floating panel below this is see-through.
 *
 * 0.9 rather than 1, because a hairline of translucency is a design choice and
 * only a genuinely transparent panel lets the page's own headings read straight
 * through it — which is what was measured on a real published site: the page
 * background token re-emitted at 0.35 alpha under a backdrop theme, on a
 * component shadcn ships as `bg-background`. */
export const MIN_PANEL_ALPHA = 0.9;

/**
 * Measure ONE open overlay. Runs in the page, like `probe`, and closes over
 * nothing for the same reason.
 *
 * THE RULE IS INVERTED FROM THE CONTRAST ONE, deliberately. There a translucent
 * chain is SKIPPED, because guessing what is behind it produces false alarms on
 * a glass theme working as intended. Here translucency IS the fault — a modal
 * exists to cover the page — so the panel's own alpha is the measurement, and a
 * `backdrop-filter` is the exemption, because that is exactly what makes a
 * deliberately glass panel readable.
 */
export function probeOverlay() {
  const panel = document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [data-state="open"][data-slot$="-content"]');
  if (!panel) return { opened: false };
  const s = getComputedStyle(panel);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  let alpha = 1;
  if (ctx) {
    ctx.clearRect(0, 0, 1, 1);
    try { ctx.fillStyle = s.backgroundColor; } catch { return { opened: true, alpha: 1 }; }
    ctx.fillRect(0, 0, 1, 1);
    alpha = ctx.getImageData(0, 0, 1, 1).data[3] / 255;
  }
  const blur = s.backdropFilter || s.webkitBackdropFilter || "none";
  const r = panel.getBoundingClientRect();
  return {
    opened: true,
    alpha: Math.round(alpha * 100) / 100,
    blurred: blur !== "none" && blur !== "",
    width: Math.round(r.width), height: Math.round(r.height),
    label: String(panel.getAttribute("aria-label") || (panel.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)),
  };
}

/**
 * What an opened panel says about itself.
 *
 * A trigger that opens NOTHING is deliberately not a finding. It is far more
 * often a control the check could not drive — a hover-only menu, something that
 * needs focus first — than a broken button, and reporting it would put a false
 * alarm on ordinary pages, which is the one thing this check may not do.
 */
export function readOverlay(o) {
  const x = o && typeof o === "object" ? o : {};
  if (!x.opened) return null;
  if (x.alpha != null && x.alpha < MIN_PANEL_ALPHA && !x.blurred) {
    return { kind: "seethrough", detail: `an opened panel${x.label ? ` ("${x.label}")` : ""} is ${Math.round(x.alpha * 100)}% opaque — the page reads through it` };
  }
  return null;
}

/**
 * What to measure, run INSIDE the page.
 *
 * Self-contained by necessity: Playwright serialises this and evaluates it in
 * the document, so it can close over nothing in this module. It returns numbers
 * and strings only — every judgement about them is made by `readPage` below,
 * where it can be tested without a browser.
 *
 * COLOURS ARE READ THROUGH A CANVAS, NOT PARSED. This template's palette is
 * oklch, and what `getComputedStyle` hands back for one varies by engine and
 * version — `oklch(...)`, `oklab(...)`, `color(srgb ...)`. A parser for that is
 * a parser to keep up to date forever, and a wrong parse is a false alarm on
 * correct code. Painting the colour into a 1x1 canvas and reading the pixel
 * makes the BROWSER do the conversion, which is the one implementation
 * guaranteed to agree with what the visitor actually sees.
 */
export function probe() {
  const out = { text: 0, images: 0, broken: [], overflow: 0, wide: [], contrast: [], scanned: 0 };
  const de = document.documentElement;

  out.text = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ").trim().length;

  // A broken image is `complete` AND zero-width. An image still loading is
  // `complete === false` and is correctly skipped — which also means a lazy
  // image below the fold is not accused of being broken for not having started.
  for (const img of Array.from(document.images)) {
    out.images++;
    if (img.complete && img.naturalWidth === 0) out.broken.push(String(img.currentSrc || img.src || "(no src)").slice(0, 200));
  }

  out.overflow = Math.max(0, de.scrollWidth - de.clientWidth);
  if (out.overflow > 0) {
    // Name the widest thing sticking out, or the finding is a number nobody can
    // act on. Bounded scan: a page is a few thousand elements and this runs on
    // every route at every width.
    const w = de.clientWidth;
    let worst = null;
    for (const el of Array.from(document.body ? document.body.querySelectorAll("*") : []).slice(0, 4000)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.round(r.right - w);
      if (over > 1 && (!worst || over > worst.over)) {
        worst = { over, tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) };
      }
    }
    if (worst) out.wide.push(worst);
  }

  // ── contrast ──────────────────────────────────────────────────────────────
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (css) => {
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    try { ctx.fillStyle = css; } catch { return null; }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // The nearest ancestor that is actually OPAQUE. A translucent chain is SKIPPED
  // rather than composited: a glass theme makes every surface translucent on
  // purpose, and guessing what is behind it is exactly the guess that produces a
  // false alarm on a design that is working as intended.
  const solidBehind = (el) => {
    for (let n = el; n && n !== document.documentElement.parentNode; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.95) return c;
      if (c && c.a > 0.05) return null; // translucent layer in the way — do not guess
    }
    const html = rgba(getComputedStyle(document.documentElement).backgroundColor);
    return html && html.a >= 0.95 ? html : { r: 255, g: 255, b: 255, a: 1 };
  };

  const seen = new Set();
  const all = Array.from(document.body ? document.body.querySelectorAll("*") : []).slice(0, 1500);
  for (const el of all) {
    if (out.contrast.length >= 8) break;
    // Only elements holding their OWN words. A wrapper inherits its child's text
    // and would be measured against the same colours over and over.
    let own = "";
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\s+/g, " ").trim();
    if (own.length < 8) continue;

    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    if (Number(s.opacity) < 0.4) continue;               // faded on purpose
    const size = parseFloat(s.fontSize) || 0;
    if (size < 10) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;           // sr-only is clipped to ~1px
    out.scanned++;

    const fg = rgba(s.color);
    if (!fg || fg.a < 0.5) continue;                     // deliberately faint
    const bg = solidBehind(el);
    if (!bg) continue;
    const cr = ratio(fg, bg);
    if (cr >= 3) continue;
    const key = s.color + "|" + own.slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    out.contrast.push({ ratio: Math.round(cr * 100) / 100, text: own.slice(0, 60), size: Math.round(size) });
  }
  return out;
}

/**
 * One page at one width, turned into findings.
 *
 * `obs` is whatever `probe()` returned, plus what the harness knows and the page
 * cannot: whether navigation succeeded and whether anything was thrown or logged
 * as an error.
 */
export function readPage(obs) {
  const o = obs && typeof obs === "object" ? obs : {};
  const route = String(o.route || "/");
  const viewport = String(o.viewport || "?");
  const at = (kind, detail) => ({ route, viewport, kind, detail: clip(detail) });
  const found = [];

  // A page that never loaded is the only finding worth making about it —
  // everything below would be measuring an error page.
  if (o.error) return [at("threw", o.error)];

  // A THROWN EXCEPTION AND A LOGGED ERROR ARE DIFFERENT THINGS and are kept
  // apart. An uncaught throw took the page down; a console error is very often
  // React telling us about a missing key, which is worth knowing and is not a
  // broken site. Collapsing them would bury the one that matters.
  for (const e of (Array.isArray(o.pageErrors) ? o.pageErrors : []).slice(0, 2)) found.push(at("threw", e));
  for (const e of (Array.isArray(o.consoleErrors) ? o.consoleErrors : []).slice(0, 2)) found.push(at("logged", e));

  const text = Number(o.text) || 0;
  const images = Number(o.images) || 0;
  // Blank is text AND pictures, because an image-led page is a real thing. A
  // gallery with six photographs and a two-word heading is not broken.
  if (text < BLANK_TEXT_CHARS && images === 0) {
    found.push(at("blank", text ? `only ${text} characters of text and no images` : "nothing rendered"));
  }

  for (const src of (Array.isArray(o.broken) ? o.broken : []).slice(0, 3)) found.push(at("image", `did not load: ${src}`));

  const overflow = Number(o.overflow) || 0;
  if (overflow > OVERFLOW_SLACK) {
    const w = (Array.isArray(o.wide) ? o.wide : [])[0];
    found.push(at("overflow", w
      ? `${overflow}px of sideways scroll — widest is <${w.tag}>${w.text ? ` "${w.text}"` : ""}`
      : `${overflow}px of sideways scroll`));
  }

  for (const c of (Array.isArray(o.contrast) ? o.contrast : []).slice(0, 3)) {
    found.push(at("contrast", `"${c.text}" is ${c.ratio}:1 against what is behind it`));
  }

  // WHAT ONLY A CLICK CAN SEE. Everything above is true of the page as it
  // loads; a modal is invisible until somebody opens it, which is why the
  // see-through one shipped on every site and was found by a person tapping a
  // hamburger. Deduped by detail, because the same header menu appears on every
  // page of a site and reporting it six times reads as six problems.
  const said = new Set();
  for (const ov of (Array.isArray(o.overlays) ? o.overlays : [])) {
    const f = readOverlay(ov);
    if (!f || said.has(f.detail)) continue;
    said.add(f.detail);
    found.push(at(f.kind, f.detail));
  }
  return found.slice(0, MAX_PER_PAGE);
}

/**
 * Every page at every width, as one report.
 *
 * `ok: false` is NOT a failure of the site — nothing here can fail anything. It
 * says the check itself could not run (no browser, the server would not start),
 * which has to be distinguishable from "we looked and the site was fine", or a
 * broken harness reads for ever as a clean bill of health. That is the mistake
 * this repo has already made three times with silent skips.
 *
 * `partial` IS THE SAME DISTINCTION ONE STEP IN. The loop stops at a time
 * budget, and a run that stopped early produced findings from the pages it
 * reached and a report otherwise byte-identical to a full clean pass — so
 * "nothing wrong" was said about pages nobody opened. Not `ok: false`: what did
 * run really did run and its findings are real. Omitted rather than `false` when
 * the run was complete, so an untruncated report is byte-identical to what it
 * was before this existed.
 */
export function renderReport(observations, { ok = true, error = "", cut = false } = {}) {
  const list = Array.isArray(observations) ? observations : [];
  const findings = [];
  for (const o of list) for (const f of readPage(o)) findings.push(f);

  const routes = new Set(list.map((o) => String((o && o.route) || "/")));
  const report = {
    ok: !!ok && !error,
    checked: list.length,
    pages: routes.size,
    findings: findings.slice(0, MAX_FINDINGS),
  };
  if (findings.length > MAX_FINDINGS) report.more = findings.length - MAX_FINDINGS;
  if (cut) report.partial = true;
  if (error) report.error = clip(error, 200);
  return report;
}

/** How bad is what we found — the one word a caller can branch on without
 *  re-deriving the rule. `threw` and `blank` mean a visitor sees nothing; the
 *  rest mean a visitor sees something imperfect. */
export const SERIOUS = new Set(["threw", "blank"]);
export const isSerious = (findings) => (Array.isArray(findings) ? findings : []).some((f) => f && SERIOUS.has(f.kind));

const WORD = {
  threw: "threw an error",
  logged: "logged an error",
  blank: "rendered nothing",
  image: "has an image that did not load",
  overflow: "scrolls sideways",
  contrast: "has text that is nearly invisible",
  seethrough: "has a see-through menu or dialog",
};

/**
 * The sentence the customer reads.
 *
 * COMPOSED HERE, not in the client, for the reason every other note in this
 * codebase is: `public/chat.js` is a plain script that cannot import a module,
 * and a second copy there drifts toward describing a site that is perfectly
 * fine. Its own field, never appended to the model's summary — that renders as
 * one paragraph, so a caveat glued on the end is buried mid-sentence.
 *
 * Empty string when there is nothing to say, so a clean build's message is
 * byte-identical to what it was before this existed.
 */
export function renderNote(report) {
  const r = report && typeof report === "object" ? report : null;
  if (!r) return "";
  if (r.ok === false) return "";           // the check could not run; not the customer's problem
  const f = Array.isArray(r.findings) ? r.findings : [];
  if (!f.length) return "";

  // Grouped by WHAT, not by page: three pages with the same low-contrast caption
  // is one thing to fix, and listing it three times reads as three problems.
  const by = new Map();
  for (const x of f) {
    if (!x || !WORD[x.kind]) continue;
    const g = by.get(x.kind) || new Set();
    g.add(x.route);
    by.set(x.kind, g);
  }
  if (!by.size) return "";
  const bits = [...by].map(([kind, routes]) => {
    const n = routes.size;
    const where = n === 1 ? [...routes][0] : `${n} pages`;
    return `${where} ${WORD[kind]}`;
  });
  const list = bits.length === 1 ? bits[0] : bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1];
  return `I had a look at the finished pages: ${list}.`;
}
