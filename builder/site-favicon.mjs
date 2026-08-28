// The tab icon the DESIGNER draws — an SVG the model writes, judged here.
//
// THE STEP THIS ADDS (owner's call, 2026-08-28: "in the design step, lets add a
// svg step, for the favicon"). Until now the mark was DERIVED — the initials on
// a colour hashed from the business name (`initialsMark`), matching nothing on
// the site since the palette left the tool on 2026-08-24. The designer has just
// picked the theme when this field is answered, so it is the one step that can
// draw a mark IN the site's own world.
//
// WHY THIS FILE IS THE SECURITY BOUNDARY, in one sentence: the mark is written
// to `public/icon.svg` and served from the SITE'S OWN ORIGIN as a document, and
// an SVG document can carry `<script>` — the exact stored-XSS shape
// `site-uploads.mjs` refuses owner uploads over. Model output is not attacker
// input in the ordinary sense, but the model writes from a BRIEF, and a brief
// is customer prose — so the answer is treated the way every other model-written
// value that reaches a customer's origin is treated: an ALLOW-LIST, refuse
// rather than repair, and no escaping question left to get wrong.
//
// WE OWN THE DOCUMENT ELEMENT, THE MODEL OWNS THE SHAPES — `site-css.mjs`'s
// split ("we own the selector, the model owns the declarations") one format
// over. `cleanFavicon` validates every tag and attribute against the lists
// below, then re-emits the ROOT itself: `xmlns` is always the SVG namespace
// (a model that omits it has written a file that silently renders as nothing),
// `width`/`height` are always present (some unfurlers and OS shortcut
// generators want them), and the viewBox is the model's own, validated as four
// numbers. The inner bytes pass through VERBATIM once validated — re-serialising
// each tag is a second writer that can normalise its way into a bug.
//
// REFUSED IS NOT BROKEN: every refusal falls back to `initialsMark`, which is
// what every site got before this field existed. The failure direction is "the
// site keeps a plain mark", never "the site has no mark" and never "the answer
// is repaired into something nobody drew".
//
// A LEAF ON PURPOSE — no imports. It is read by `site-edit.mjs` (the merge's
// gate), by `worker.js` (the tool field) and by `build-server.mjs` (the second
// validation at the write), and a leaf can be reached from all three without a
// cycle. The container copy rides the Dockerfile's COPY line like its siblings.

/**
 * The size bound. A favicon is a MARK — the biggest honest one (a gradient, a
 * few paths, a letterform) is well under a thousand characters, and the cap is
 * generous so a verbose-but-honest answer is not binned. What it bounds is the
 * pathological case, and it is stated in the field's own text because a cap
 * enforced here and stated nowhere the model reads is a wall it walks into
 * (the run-52 lesson, one field over).
 */
export const MAX_FAVICON = 4000;

/**
 * Every element a flat mark needs and nothing that can reach outward.
 *
 * WHAT IS DELIBERATELY ABSENT, because each absence is the point: `script`
 * (the whole reason this file exists), `style` (a stylesheet is a second
 * language to validate — presentation attributes say everything a mark needs),
 * `use`/`image` (both take `href`, and an href is a fetch or a `javascript:`),
 * `foreignObject` (arbitrary HTML inside the SVG), `animate`/`set` (SMIL — a
 * favicon does not animate), `filter`/`mask` (url() plumbing a mark does not
 * need). An element outside this list refuses the WHOLE answer — a mark with
 * its filter quietly dropped is a mark nobody drew.
 */
export const FAVICON_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "defs", "linearGradient", "radialGradient", "stop", "text",
  "tspan", "title", "desc", "clipPath",
]);

/**
 * The attributes those elements may carry. Presentation attributes, geometry,
 * gradients, text metrics — and NO `href` of any kind, no `style`, no `on*`
 * (not that an allow-list needs to name what it excludes; the list IS the
 * exclusion). `class`, `role` and the two aria attributes are admitted because
 * models write them out of habit and each is inert in a favicon — refusing them
 * would bin honest marks over decoration.
 */
export const FAVICON_ATTRS = new Set([
  "viewBox", "preserveAspectRatio", "fill", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
  "stroke-dashoffset", "stroke-opacity", "fill-opacity", "opacity",
  "fill-rule", "clip-rule", "d", "cx", "cy", "r", "rx", "ry", "x", "y",
  "x1", "y1", "x2", "y2", "dx", "dy", "width", "height", "points",
  "transform", "offset", "stop-color", "stop-opacity", "gradientUnits",
  "gradientTransform", "spreadMethod", "id", "clip-path", "font-family",
  "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor",
  "dominant-baseline", "paint-order", "class", "role", "aria-label",
  "aria-hidden",
]);

/** The one namespace the root may declare, and the only value it may have. */
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The XML entities a mark may use. Anything else — a named HTML entity, a
 * DOCTYPE-defined one — is refused: entities are how an XML parser is talked
 * into bytes the scan never saw, and a mark needs none beyond these.
 */
const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d{1,6}|#[xX][0-9a-fA-F]{1,5});/g;

/** Four numbers. Re-emitted from this capture, so its charset is the guarantee. */
const VIEWBOX = /^\s*(-?\d*\.?\d+(?:\s+-?\d*\.?\d+){3})\s*$/;

/**
 * An attribute value AS THE XML PARSER WILL READ IT — entities decoded — for
 * the danger checks only; the emitted bytes stay the model's own. Without this
 * the checks read the raw text and `fill="&#117;rl(http://e)"` walks past the
 * external-url() rule to decode into exactly the thing it forbids. Only the
 * entities `ENTITY` admits can appear here, so this decode has no unknowns.
 */
function decoded(v) {
  return v.replace(ENTITY, (e) => {
    const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[e];
    if (named) return named;
    const n = e[2] === "x" || e[2] === "X" ? parseInt(e.slice(3, -1), 16) : parseInt(e.slice(2, -1), 10);
    try { return String.fromCodePoint(n); } catch { return "�"; }
  });
}

const refuse = (why) => ({ svg: null, why });

/**
 * The end of the tag opened at `from`, respecting quoted attribute values — a
 * `>` inside `d="…"` is data, not the tag closing. `-1` for a tag that never
 * closes or contains a stray `<`.
 */
function tagEnd(s, from) {
  let q = "";
  for (let i = from + 1; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === ">") return i;
    if (ch === "<") return -1;
  }
  return -1;
}

/**
 * One attribute at a time, anchored — anything the pattern cannot read (a bare
 * attribute, an unquoted value) refuses the tag rather than being skipped past.
 * Skipping is how a scanner walks by the one attribute it exists to catch.
 */
const ATTR = /\s+([A-Za-z][A-Za-z0-9:_.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

/**
 * A model-written SVG, validated whole or refused whole.
 *
 * `{ svg }` is the mark to write — the model's inner bytes under OUR root —
 * and `{ svg: null, why }` names the first rule broken, for the trace. The
 * ONE repair permitted is stripping a leading `<?xml …?>` prolog: models emit
 * one on half their SVG documents, it means nothing served as image/svg+xml,
 * and there is exactly one thing the stripping could have meant — the
 * lowercase class of repair, like the lone page renamed to "/".
 */
export function cleanFavicon(input) {
  // The tab icon is OUR size — a square, whatever the drawing's own aspect —
  // because a favicon slot is square everywhere it appears.
  return cleanMark(input, { max: MAX_FAVICON, size: () => [64, 64] });
}

/**
 * The shared scan — the favicon and the wordmark are one security question
 * (an SVG document on the site's own origin) with two sizing answers, so the
 * validator is one function and the marks differ only in `max` and in how the
 * emitted `width`/`height` are chosen.
 */
function cleanMark(input, { max, size }) {
  if (typeof input !== "string") return refuse("not text");
  let s = input.trim().replace(/^<\?xml[^>]*\?>\s*/i, "");
  if (!s) return refuse("empty");
  if (s.length > max) return refuse("over " + max + " characters");
  // Entities first, over the whole document: strip the allowed ones, and any
  // `&` left is one the scan below cannot be trusted to understand.
  if (s.replace(ENTITY, "").includes("&")) return refuse("an entity that is not XML's own");
  if (s[0] !== "<") return refuse("does not start with a tag");

  const stack = [];
  let root = null;        // { viewBox, extras: [[name, value], …] }
  let innerStart = -1;
  let innerEnd = -1;
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      if (s.slice(i).trim()) return refuse("content outside the mark");
      break;
    }
    if (stack.length === 0 && s.slice(i, lt).trim()) return refuse("content outside the mark");
    const next = s[lt + 1];
    // `<!` is a DOCTYPE, an ENTITY, a comment or CDATA — each a way of saying
    // bytes the scan never reads — and `<?` is a processing instruction (the
    // one honest one, the XML prolog, was stripped above).
    if (next === "!" || next === "?") return refuse("a declaration, comment or processing instruction");
    const end = tagEnd(s, lt);
    if (end === -1) return refuse("a tag that never closes");
    const tag = s.slice(lt, end + 1);
    const m = /^<(\/?)([A-Za-z][A-Za-z0-9]*)/.exec(tag);
    if (!m) return refuse("a malformed tag");
    const closing = m[1] === "/";
    const name = m[2];
    if (!FAVICON_TAGS.has(name)) return refuse("<" + name + "> is not a favicon shape");

    if (closing) {
      if (!/^<\/[A-Za-z][A-Za-z0-9]*\s*>$/.test(tag)) return refuse("a malformed closing tag");
      if (!stack.length || stack[stack.length - 1] !== name) return refuse("tags that do not pair up");
      stack.pop();
      if (stack.length === 0) {
        innerEnd = lt;
        if (s.slice(end + 1).trim()) return refuse("content after the mark ends");
        i = s.length;
        break;
      }
      i = end + 1;
      continue;
    }

    const selfClosed = /\/\s*>$/.test(tag);
    const isRoot = stack.length === 0;
    if (isRoot && root) return refuse("two documents in one answer");
    if (isRoot && name !== "svg") return refuse("the document element is <" + name + ">, not <svg>");
    if (!isRoot && name === "svg") return refuse("a nested <svg>");

    // The attribute region: past `<name`, short of the closing `>` (and the
    // self-closing `/`, which the quote-aware tagEnd guarantees sits outside
    // any value).
    let attrRegion = tag.slice(1 + name.length, tag.length - 1);
    if (selfClosed) attrRegion = attrRegion.replace(/\/\s*$/, "");
    const attrs = [];
    let pos = 0;
    while (pos < attrRegion.length) {
      if (!attrRegion.slice(pos).trim()) break;
      ATTR.lastIndex = pos;
      const a = ATTR.exec(attrRegion);
      if (!a) return refuse('an attribute that is not name="value"');
      const an = a[1];
      const av = a[2] !== undefined ? a[2] : a[3];
      if (an === "xmlns") {
        // The one namespaced thing a mark may say, only on the root, only the
        // SVG namespace. `xmlns:xlink` and friends fail the allow-list below.
        if (!isRoot || av !== SVG_NS) return refuse("a namespace that is not SVG's");
      } else if (!FAVICON_ATTRS.has(an)) {
        return refuse("the attribute " + an);
      }
      // No value may open a tag, name a script scheme, or reach outside the
      // document — `url(#…)` is a gradient or clip reference and is the only
      // url() form a mark needs. Checked on the DECODED value, the one the XML
      // parser will hand to the renderer, or an entity spells the forbidden
      // thing one byte at a time.
      const dv = decoded(av);
      if (dv.includes("<")) return refuse("a tag inside an attribute value");
      if (/javascript:/i.test(dv)) return refuse("a script scheme");
      if (/url\(\s*(?!#)/i.test(dv)) return refuse("an external url()");
      attrs.push([an, av]);
      pos = ATTR.lastIndex;
    }

    if (isRoot) {
      if (selfClosed) return refuse("an empty mark");
      const vb = attrs.find(([n]) => n === "viewBox");
      const vm = vb && VIEWBOX.exec(vb[1]);
      if (!vm) return refuse(vb ? "a viewBox that is not four numbers" : "no viewBox");
      root = {
        viewBox: vm[1].replace(/\s+/g, " "),
        // The root's own presentation attributes survive — `fill` on the root
        // is inheritable and dropping it would silently repaint the shapes —
        // while the three WE own (and the namespace) are re-emitted ours.
        extras: attrs.filter(([n]) => !["xmlns", "viewBox", "width", "height"].includes(n)),
      };
      innerStart = end + 1;
      stack.push("svg");
      i = end + 1;
      continue;
    }

    if (!selfClosed) stack.push(name);
    i = end + 1;
  }

  if (!root) return refuse("no <svg> document");
  if (stack.length) return refuse("tags left open");
  if (innerEnd < 0) return refuse("the mark never closes");

  const inner = s.slice(innerStart, innerEnd);
  if (!inner.trim()) return refuse("an empty mark");
  const extras = root.extras
    .map(([n, v]) => " " + n + '="' + v.replace(/"/g, "&quot;") + '"')
    .join("");
  const [w, h] = size(root.viewBox);
  return {
    svg:
      '<svg xmlns="' + SVG_NS + '" width="' + w + '" height="' + h + '" viewBox="' + root.viewBox + '"' +
      extras + ">" + inner + "</svg>",
    why: null,
  };
}

/**
 * The header logo the DESIGNER answers — the word `text`, or a drawn SVG.
 *
 * THE OWNER'S CALL (2026-08-28): "for the logo, either do the text or an svg
 * logo, any of those 2 is fine, so have that option there." `text` is a full
 * answer, not a shrug — most small businesses' logo IS their name set in type,
 * and that is exactly what the header renders for it. The same rule as
 * `site-authored.mjs`: a string that IS the named option is the name, and a
 * document starts with a tag, so the two cannot be confused.
 *
 * THE SIZE COMES FROM THE DRAWING, unlike the favicon's forced square: the
 * header constrains the logo by HEIGHT (`h-7 w-auto`), so the intrinsic
 * width/height — read off the validated viewBox — are what make a wide
 * wordmark lay out at its own aspect instead of letterboxed into a square.
 */
export const MAX_WORDMARK = 8000;

function wordmarkSize(viewBox) {
  const n = viewBox.split(/\s+/).map(Number);
  const clamp = (v) => Math.max(1, Math.round(Math.abs(v) || 1));
  return [clamp(n[2]), clamp(n[3])];
}

export function readWordmark(v) {
  if (typeof v !== "string") return { kind: null, why: "not text" };
  const s = v.trim();
  if (!s) return { kind: null, why: "empty" };
  if (/^text$/i.test(s)) return { kind: "text" };
  const r = cleanMark(s, { max: MAX_WORDMARK, size: wordmarkSize });
  return r.svg ? { kind: "svg", svg: r.svg } : { kind: null, why: r.why };
}

/**
 * The tool field. Sits AFTER `theme` and before `shape` — a tool's property
 * order is its generation order, so the mark is drawn with the site's world
 * already decided and before the bands are arranged, which it does not need.
 * Required on a first build (a revise keeps the stored one — the field is on
 * `EDIT_FIELDS`, so absent means unchanged).
 *
 * THE RULES ARE STATED WHERE THE MODEL READS THEM, because a validator it is
 * never told about is a wall it walks into — the run-52 lesson. And the
 * fallback is stated too, so a refused answer is understood as "the site keeps
 * a plain initials mark" rather than as a build that broke.
 */
/**
 * The wordmark field. Directly after `theme` and before `favicon` — the big
 * identity is drawn first, in the world just decided, and the tab glyph after
 * it (a favicon is often the wordmark compressed to one letter). Required on a
 * build for the reason `favicon` is: "the name in type" is a real design
 * choice, and compelling the field is what makes it one rather than a default
 * nobody made. A revise keeps the stored answer by omission.
 */
export const WORDMARK_FIELD = {
  type: "string",
  description:
    "The site's LOGO in the header: answer the word `text`, or draw one. `text` means the business name " +
    "set in the header's own type — the right answer for most small businesses, and a full answer, not a " +
    "shrug. To draw one instead, send one complete SVG document: a WORDMARK or simple lockup that reads at " +
    "28 pixels tall — the header shows it at that height, width to match — wide viewBox (e.g. " +
    '<svg viewBox="0 0 240 64">), letterforms drawn as paths (<text> renders in system fonts only, never ' +
    "the site's own faces). IT SITS ON THE SITE'S OWN HEADER — draw in colours that read against the theme " +
    "you just picked, on its light and its dark ground alike; a plate behind the letters is the safe shape, " +
    "bare dark ink on a transparent ground disappears on a dark site. Same rules as the favicon: plain " +
    "shapes and presentation attributes only, no " +
    "style attribute, no href of any kind, nothing external, under " + MAX_WORDMARK + " characters — a " +
    "document that breaks any rule is refused WHOLE and the header shows the name as text. The owner's own " +
    "uploaded logo always wins over a drawn one. On a revise, leave it out to keep what the site has.",
};

export const FAVICON_FIELD = {
  type: "string",
  description:
    "The site's TAB ICON, drawn by you as one complete SVG document. A FLAT MARK, not a picture: one " +
    "simple shape or letterform in the theme's mood, two or three colours at most, bold enough to read " +
    "at 16 pixels in a browser tab — no fine detail, no thin strokes, no scene. Draw square: " +
    '<svg viewBox="0 0 64 64"> with plain shapes only — path, rect, circle, ellipse, line, polygon, g, ' +
    "defs, linearGradient, radialGradient, stop, text, tspan — and presentation attributes only (fill, " +
    "stroke, d, transform, …): no style attribute, no href of any kind, nothing external, under " +
    MAX_FAVICON + " characters. A document that breaks any of these rules is refused WHOLE and the site " +
    "falls back to a plain initials mark, so keep it simple. A letterform is safest drawn as a path; " +
    "<text> renders in system fonts only. On a revise, leave it out to keep the mark the site has.",
};
