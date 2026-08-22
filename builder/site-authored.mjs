// THE MODEL WRITES ITS OWN CSS, ON EVERY AXIS (owner's call, 2026-08-22).
//
// "i thought for all of them it was gonna be authored dude, and no names, i
// just want the model to write its own css cmon, lets make it no name."
//
// The 23 style axes were 23 enums — `icon: fine|regular|heavy`, `hover:
// none|tint|lift|edge` — and two of them (`backdrop`, `decor`) had gained an
// authored escape hatch the day before. This is that hatch on all of them, and
// the names go: an axis is no longer a row to pick, it is a thing to write.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE AXES ARE TWO SHAPES, AND FORCING THEM INTO ONE WOULD BE A LIE
//
// Fourteen of them ARE a declaration block. `hover: lift` is
// `transform: translateY(-2px); box-shadow: …` inside `@media (hover: hover)`
// on a selector set — the option name is the only thing standing between the
// model and writing those declarations itself.
//
// Nine of them are NOT. `scale` is a type-scale RATIO from which eight tokens
// are derived; `tracking` is six per-size steps; `motion` is a duration and an
// easing. There is no single declaration to write — the emitter reads numbers
// and generates a ramp. So for those, authoring means writing THE NUMBERS THE
// EMITTER READS, which is exactly what the option table holds. The model stops
// picking a row and writes the row.
//
// Both are "author it rather than choose it". Pretending a type scale is a
// declaration block would give the model a shape it cannot fill and produce a
// refusal on every build.
//
// ─────────────────────────────────────────────────────────────────────────────
// WE OWN THE SELECTOR. THE MODEL OWNS THE DECLARATIONS. THAT IS THE WHOLE
// SECURITY ARGUMENT, AND IT IS THE SAME ONE `site-css.mjs` ALREADY MAKES.
//
// That module's header says it: `worldCss` owns `body { background-image: … }`,
// so there is no selector to escape from and the character rules can simply
// REFUSE what an escape would need. The generalisation is exact — every emitter
// here already owns its selector and its guard (`@media (hover: hover)`,
// `@supports (animation-timeline: view())`, `:focus-visible`), and what differs
// between its options is only the declarations inside.
//
// So a model writing rules is never on the table. It writes declarations, we
// PARSE them into property/value pairs, and we RE-EMIT them ourselves — which
// means the serialisation that reaches a customer's stylesheet is never the
// model's bytes. A value carrying `;` or `}` is refused at parse time rather
// than escaped, because there is no correct escape for arbitrary text in a CSS
// value and a half-working one reads as protection that is not there.
//
// ─────────────────────────────────────────────────────────────────────────────
// AND THE PROPERTIES ARE AN ALLOW-LIST PER AXIS, WHICH IS NOT A LIST OF LOOKS
//
// The owner's objection was to picking from `fine | regular | heavy`. It was not
// to being unable to write `display: none` on a card. Those are different
// things and only the first one is a limitation on the design.
//
// What the allow-list buys, stated as failures rather than as caution:
//
//   `display: none` on the card selector blanks every list on the site.
//   `position: fixed` on `section` pins the whole page under the header.
//   `content: "…"` on a hover state is not a hover style, it is page copy
//     arriving through a field nobody reviews.
//
// None of those is an injection — the parser handles injection — and all three
// publish a broken site with a green build. An axis that owns `border-radius`
// can write ANY radius; it just cannot stop being about corners.
import { isColor, luminance, rgbOf } from "./site-tokens.mjs";
import { readAuthored } from "./site-css.mjs";

/** Longest single declaration block we will take. A hover state is a handful of
 *  declarations; four hundred characters of them is a runaway generation
 *  landing in a stylesheet every visitor downloads. */
export const MAX_BLOCK = 400;

/** How many declarations one axis may carry. Every emitter's own widest option
 *  is three; eight is generous and still bounded. */
export const MAX_DECLS = 8;

/**
 * CHARACTERS A DECLARATION VALUE NEVER NEEDS, AND WHICH AN ESCAPE WOULD.
 *
 * Deliberately IDENTICAL to `site-css.mjs`'s list minus the semicolon, which
 * here is the separator BETWEEN declarations and is consumed by the split
 * before any value is read. Everything else is refused for the reasons that
 * file already states: `{` `}` open and close a rule, `@` opens an at-rule that
 * can carry an import, `\` is CSS's own escape and can spell any of the others,
 * `<` `>` matter if this ever reaches markup, and a value here needs no string.
 */
const FORBIDDEN_VALUE = /[{}@<>\\"']/;

/**
 * WHAT A VALUE MAY CALL, by kind. An allow-list, never a deny-list — the
 * `modelsFor` rule: this arrives in a model's answer and reaches a stylesheet,
 * so an unknown name is not a function to pass through, it is a value to refuse.
 *
 * `url()` IS ABSENT FROM EVERY ONE OF THEM, for the reason `site-css.mjs` gives:
 * it is a fetch the CSP refuses, or a `data:` URI putting arbitrary bytes on a
 * customer's site through a field meant to describe a style.
 */
const COLOR_FUNCS = ["rgb", "rgba", "hsl", "hsla", "oklch", "oklab", "lab", "lch", "calc", "var"];
const TRANSFORM_FUNCS = [
  "translate", "translatex", "translatey", "translate3d", "translatez",
  "scale", "scalex", "scaley", "scale3d",
  "rotate", "rotatex", "rotatey", "rotatez", "rotate3d",
  "skew", "skewx", "skewy", "matrix", "matrix3d", "perspective",
  "calc", "var",
];
const FILTER_FUNCS = [
  "blur", "brightness", "contrast", "grayscale", "hue-rotate",
  "invert", "opacity", "saturate", "sepia", "drop-shadow",
  "calc", "var",
];
const EASE_FUNCS = ["cubic-bezier", "steps", "linear", "var"];

/** Units a length legitimately carries. An allow-list for the reason
 *  `site-css.mjs` states: a dimension is stripped before the word scan, so
 *  anything stripped is a thing the scan can no longer refuse. */
const LENGTH_UNITS = new Set([
  "px", "rem", "em", "ch", "ex", "vw", "vh", "vmin", "vmax", "svh", "lvh", "dvh",
  "cm", "mm", "q", "in", "pt", "pc", "%",
]);
const ANGLE_UNITS = new Set(["deg", "rad", "grad", "turn"]);
const TIME_UNITS = new Set(["s", "ms"]);

/** Parens must balance, or what we emit runs into whatever follows it. */
function balanced(s) {
  let d = 0;
  for (const c of s) {
    if (c === "(") d++;
    else if (c === ")") { d--; if (d < 0) return false; }
  }
  return d === 0;
}

/**
 * Every function a value calls must be in the given allow-list.
 *
 * FUNCTIONS FIRST, before any word scan, exactly as `readLayer` does it: a name
 * immediately followed by `(` is a call, and an unknown one is refused before
 * anything else is read — so a value can never reach the stylesheet through a
 * function nobody considered.
 */
function callsOk(value, allowed) {
  const set = new Set(allowed);
  for (const m of value.matchAll(/([a-zA-Z][\w-]*)\s*\(/g)) {
    if (!set.has(m[1].toLowerCase())) return `uses ${m[1]}(), which is not allowed here`;
  }
  return "";
}

/**
 * The bare words left after functions, hex colours and dimensions are stripped.
 *
 * THIS IS WHERE A MISSPELLING HIDES, which is the reason it exists at all:
 * `translateY(-2px) rotat(3deg)` is caught by `callsOk`, but `solidd` in an
 * outline is valid CSS syntax that paints nothing, and `ease-ou` silently makes
 * a transition linear. Both look like working code in a diff.
 */
function wordsOk(value, allowed, units) {
  const set = new Set(allowed.map((w) => w.toLowerCase()));
  const words = value
    .replace(/[a-zA-Z][\w-]*\s*\(/g, " ")
    .replace(/#[0-9a-fA-F]{3,8}\b/g, " ")
    .replace(/-?[\d.]+\s*([a-zA-Z]+|%)/g, (m, u) => (units.has(String(u).toLowerCase()) ? " " : m))
    .match(/[a-zA-Z][\w-]*/g) || [];
  for (const w of words) {
    if (!set.has(w.toLowerCase())) return `uses "${w}", which is not a value this takes`;
  }
  return "";
}

const ALL_UNITS = new Set([...LENGTH_UNITS, ...ANGLE_UNITS, ...TIME_UNITS]);

/**
 * THE VALUE KINDS. One validator each, so a property is described by WHAT IT
 * TAKES rather than by a bespoke rule — which is what keeps the table below
 * readable and keeps a new property from arriving with its own private parser.
 *
 * Each returns "" for ok, or the sentence the CUSTOMER is shown. The reason is
 * theirs to act on, so it names the thing they wrote rather than the rule it
 * broke — `styleNote`'s standing contract.
 */
const KINDS = {
  length: (v) => callsOk(v, ["calc", "var", "min", "max", "clamp"])
    || wordsOk(v, ["auto", "none", "min", "max", "clamp", "calc", "var"], LENGTH_UNITS),
  // A radius may carry `/` for the elliptical form, which is the one place a
  // slash is meaningful outside a colour's alpha.
  radius: (v) => callsOk(v, ["calc", "var", "min", "max", "clamp"])
    || wordsOk(v, ["min", "max", "clamp", "calc", "var"], LENGTH_UNITS),
  number: (v) => (/^-?\d*\.?\d+$/.test(v.trim()) ? "" : "is not a plain number"),
  color: (v) => (isColor(v) ? "" : (callsOk(v, COLOR_FUNCS) || (/var\(/.test(v) ? "" : "is not a colour we can read"))),
  time: (v) => callsOk(v, ["calc", "var"]) || wordsOk(v, ["calc", "var"], TIME_UNITS),
  ease: (v) => callsOk(v, EASE_FUNCS)
    || wordsOk(v, ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end",
                   "start", "end", "jump-start", "jump-end", "jump-none", "jump-both", "var"], ALL_UNITS),
  transform: (v) => callsOk(v, TRANSFORM_FUNCS) || wordsOk(v, ["none", "var"], ALL_UNITS),
  filter: (v) => callsOk(v, FILTER_FUNCS) || wordsOk(v, ["none", "var"], ALL_UNITS),
  // A shadow is lengths and a colour, plus `inset`. Colours inside it are read
  // by `colorsIn` below, so the contrast floor still sees them.
  shadow: (v) => callsOk(v, [...COLOR_FUNCS, "min", "max", "clamp"])
    || wordsOk(v, ["inset", "none", "min", "max", "clamp", "calc", "var"], LENGTH_UNITS),
  // A background-image goes through the module that already owns that question,
  // rather than a second reading of it here. `readLayer`'s word list is
  // gradient-specific and its stop reading is what the contrast floor rests on.
  image: null,
};

/**
 * WHAT EACH AXIS OWNS.
 *
 * `sel` is the selector this axis's emitter already writes to and the model
 * never sees — stated here so the tool can TELL the model what its declarations
 * will land on, which is the difference between writing a hover state and
 * guessing at one.
 *
 * `props` is the allow-list, derived from what the named options actually
 * emitted. Every one of them is a property the axis was already writing; none
 * is a new capability, and none of the old looks became unexpressible.
 */
export const AXIS_DECLS = Object.freeze({
  corner:  { sel: "every element", props: { "border-radius": "radius", "corner-shape": ["round", "squircle", "bevel", "scoop", "notch", "bevel"] } },
  shadow:  { sel: "cards, buttons and menus", props: { "box-shadow": "shadow" } },
  buttons: { sel: "every button", props: { "border-radius": "radius", "box-shadow": "shadow", "border-width": "length" } },
  inputs:  { sel: "every input and textarea", props: { "border-radius": "radius", "border-width": "length", "background-color": "color", "box-shadow": "shadow" } },
  display: { sel: "h1 through h4", props: { color: "color", "background-image": "image", "-webkit-text-fill-color": "color", "background-clip": ["text", "border-box", "padding-box"] } },
  surface: { sel: "cards and menus", props: { "background-color": "color", "backdrop-filter": "filter", "border-color": "color", "box-shadow": "shadow" } },
  skin:    { sel: "every card", props: { "border-radius": "radius", "border-width": "length", "border-color": "color", "box-shadow": "shadow", transform: "transform" } },
  ambient: { sel: "the drifting layer behind the page", props: { "animation-duration": "time", "animation-timing-function": "ease", opacity: "number", filter: "filter" } },
  // THE INTERACTIVE FOUR. Each is wrapped in the guard its emitter already
  // writes — `@media (hover: hover)` so a tap does not leave a phone stuck in a
  // hover state, `:focus-visible` so a mouse click leaves no ring behind.
  hover:   { sel: "buttons and cards, on pointer devices only", props: { transform: "transform", "box-shadow": "shadow", "background-color": "color", "border-color": "color", opacity: "number", filter: "filter" } },
  focus:   { sel: "anything the keyboard lands on", props: { "outline-width": "length", "outline-color": "color", "outline-offset": "length", "outline-style": ["solid", "dashed", "dotted", "double"], "box-shadow": "shadow" } },
  reveal:  { sel: "each section, as it scrolls into view — write where it STARTS", props: { opacity: "number", transform: "transform", filter: "filter" } },
  transition: { sel: "the outgoing page, between one route and the next", props: { opacity: "number", transform: "transform", filter: "filter" } },
  // The two that were already authorable, unchanged in shape: a background-image
  // value rather than a declaration block, validated by `site-css.mjs`.
  backdrop: { sel: "the page's own ground", image: true },
  decor:    { sel: "the texture over that ground", image: true },
});

/**
 * WHAT EACH RAMP AXIS READS.
 *
 * These nine emit a generated ramp rather than a declaration block, so authoring
 * one means writing the numbers the emitter consumes — the same fields its
 * option table already holds. `min`/`max` bound each number, and the bounds are
 * the whole safety story here: there is no injection surface in a float, and
 * what a nonsense one does is make a site unreadable rather than unsafe.
 *
 * BOUNDED RATHER THAN TRUSTED, and each bound is a rendering failure:
 *   scale 2.4     an h1 taller than a phone screen
 *   leading 0.4   lines overlapping each other
 *   weight 950    past what any variable face carries, so it silently snaps
 *   motion 4000   a four-second hover, which reads as the site being broken
 */
// THE UNIT IS PER FIELD AND IT IS NOT COSMETIC. Each emitter interpolates the
// value STRAIGHT INTO a declaration, so the unit decides what paints: `--spacing`
// is a rem step, `border-width` is px, and `stroke-width` is unitless user
// units. A shared "length" unit gets one of the three wrong every time — with a
// rem default, `border: { width: 2 }` emits a 32-pixel border on every element
// on the site, which compiles, publishes, and looks like a bug in the kit.
export const AXIS_RAMPS = Object.freeze({
  scale:    { fields: { ratio: { kind: "num", min: 1.0, max: 1.6 } }, said: "the step between one text size and the next" },
  width:    { fields: { ratio: { kind: "num", min: 0.6, max: 1.6 } }, said: "how wide the page runs, against the default" },
  tracking: { fields: { steps: { kind: "list", len: 6, min: -0.1, max: 0.4 } }, said: "in em, tightest first" },
  leading:  { fields: { steps: { kind: "list", len: 4, min: 0.9, max: 2.4 } }, said: "unitless, tightest first" },
  weight:   { fields: { steps: { kind: "list", len: 7, min: 100, max: 900 } }, said: "the seven weights, lightest first" },
  density:  { fields: { spacing: { kind: "num", min: 0.1, max: 0.6, unit: "rem" } }, said: "the step everything is measured in, in rem" },
  border:   { fields: { width: { kind: "num", min: 0, max: 6, unit: "px" } }, said: "in px" },
  icon:     { fields: { width: { kind: "num", min: 0.5, max: 4, unit: "" } }, said: "the stroke width, unitless" },
  motion:   { fields: { ms: { kind: "num", min: 0, max: 1200 }, ease: { kind: "ease" } }, said: "how quickly anything answers a pointer" },
});

/** Every axis that can be authored — which is now all of them. */
export const AUTHORED_ALL = Object.freeze([...Object.keys(AXIS_DECLS), ...Object.keys(AXIS_RAMPS)]);

/**
 * Split a declaration block on top-level semicolons.
 *
 * DEPTH-AWARE, because a value is full of parens that can contain anything:
 * `box-shadow: 0 2px 4px rgb(0 0 0 / 20%)` has no semicolon inside them today
 * and `steps(4, jump-end)` has a comma, and this repo has written the flat
 * version of a splitter FIVE times where a depth-aware one was needed.
 */
function splitDecls(block) {
  const out = [];
  let cur = "", d = 0;
  for (const c of String(block)) {
    if (c === "(") d++;
    else if (c === ")") d = Math.max(0, d - 1);
    if (c === ";" && d === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Every colour a value reaches, through `site-tokens.mjs`'s OWN parser.
 *
 *  ONE READING of "what colour is this", never a second one here — the rule
 *  `readColors` already states, and the reason `rgbOf` was extracted. Two
 *  readings is how a contrast floor comes to be computed against a colour that
 *  is not the one on screen. */
function colorsIn(value) {
  const out = [];
  const toks = String(value).match(/#[0-9a-fA-F]{3,8}\b|[a-zA-Z]+\([^()]*(?:\([^()]*\)[^()]*)*\)|\b[a-zA-Z]+\b/g) || [];
  for (const tok of toks) {
    if (!isColor(tok)) continue;
    const l = luminance(tok);
    const rgb = rgbOf(tok);
    if (typeof l === "number" && Number.isFinite(l) && rgb) out.push({ token: tok, luminance: l, rgb });
  }
  return out;
}

/**
 * Read a model-written declaration block for one axis.
 *
 * Returns `{ ok: true, decls, css, colors }` — the pairs, the block AS WE WILL
 * EMIT IT, and every colour it reaches so the caller can still prove the
 * contrast floor. Returns `{ ok: false, why }` otherwise, and `needsVars` when
 * the only thing wrong is that no palette was supplied — the distinction
 * `site-css.mjs` records at length, and the reason the Worker's note does not
 * tell a customer their look was refused while the container accepts it.
 */
export function readDecls(block, { axis, vars = null } = {}) {
  const spec = AXIS_DECLS[String(axis)];
  if (!spec) return { ok: false, why: "is not an axis that takes CSS" };
  if (spec.image) {
    // THE TWO BACKGROUND-IMAGE AXES KEEP THEIR OWN SHAPE AND THEIR OWN READER,
    // and it is `readAuthored` rather than `readLayer` — the difference is not
    // cosmetic. These take a `{light, dark}` PAIR of layer lists, and that
    // module's own header records why: a wash written for a light page and
    // copied onto a dark one leaves the quiet ink at 2.57:1, so a one-mode
    // answer is refused where the reason can say what it is. `readLayer` reads
    // ONE layer and would have coerced the whole pair with `String()` — the
    // coercion bug, one function along, in the delegation.
    //
    // It returns `{layers: {light, dark}}` rather than declarations, because
    // `worldCss` composites the two modes into two different rules. Passed
    // through unchanged, so `parseStyle` and the container see exactly the
    // shape they have handled since the authored backdrop shipped.
    return readAuthored(block, { vars });
  }

  // A STRING, NOT ANYTHING STRINGIFIABLE. `String(["transform: none"])` is
  // `"transform: none"` — a one-element array would pass every check below and
  // set a real axis from a value nobody wrote. The `normalizeRole` lesson, the
  // same one that let `access: ["display"]` through on a table deciding who
  // reads customer data, and it was live in this function until its own test
  // drove it.
  if (typeof block !== "string") return { ok: false, why: "was not a line of CSS" };
  const input = block.trim();
  if (!input) return { ok: false, why: "was empty" };
  if (input.length > MAX_BLOCK) return { ok: false, why: "is longer than a style block needs to be" };
  if (/\/\*|\*\//.test(input)) return { ok: false, why: "contains a comment" };

  const parts = splitDecls(input);
  if (!parts.length) return { ok: false, why: "has no declaration in it" };
  if (parts.length > MAX_DECLS) return { ok: false, why: `has ${parts.length} declarations, more than an axis needs` };

  const decls = [], colors = [];
  const seen = new Set();
  for (const part of parts) {
    const at = part.indexOf(":");
    if (at < 1) return { ok: false, why: `"${part.slice(0, 40)}" is not a property and a value` };
    const prop = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (!Object.hasOwn(spec.props, prop)) {
      return { ok: false, why: `cannot set ${prop} — this one writes ${Object.keys(spec.props).join(", ")}` };
    }
    // A property set twice is a model contradicting itself, and only the last
    // one would paint — so the customer is told rather than silently given the
    // second answer to a question they asked once.
    if (seen.has(prop)) return { ok: false, why: `sets ${prop} twice` };
    seen.add(prop);

    if (!value) return { ok: false, why: `${prop} was given no value` };
    if (FORBIDDEN_VALUE.test(value)) return { ok: false, why: `${prop} contains a character a style value never needs` };
    if (!balanced(value)) return { ok: false, why: `${prop} has unbalanced brackets` };
    if (/!\s*important/i.test(value)) return { ok: false, why: `${prop} uses !important, which the theme decides` };

    // THE ONE FAILURE THAT DEPENDS ON THE THEME, flagged as such for the reason
    // `readLayer` states: the palette only EXISTS in the container, so a value
    // naming `var(--primary)` is a thing the Worker cannot judge rather than a
    // thing the model got wrong.
    const kind = spec.props[prop];
    if (Array.isArray(kind)) {
      if (!kind.includes(value.toLowerCase())) return { ok: false, why: `${prop}: ${value} is not one of ${kind.join(", ")}` };
    } else {
      const check = KINDS[kind];
      if (!check) return { ok: false, why: `${prop} has no reader` };
      // Resolved BEFORE the kind check for the same reason `readLayer` resolves
      // before reading stops: a token is not a value until something substitutes
      // it, and an unresolved one cannot be checked against anything.
      const resolved = vars ? resolveWith(value, vars) : value;
      if (!vars && /var\(/.test(resolved)) {
        decls.push({ prop, value: resolved });
        continue;
      }
      if (/var\(/.test(resolved)) return { ok: false, needsVars: true, why: `${prop} names a colour the theme does not define` };
      const why = check(resolved);
      if (why) return { ok: false, why: `${prop} ${why}` };
      colors.push(...colorsIn(resolved));
      decls.push({ prop, value: resolved });
      continue;
    }
    decls.push({ prop, value });
  }

  // A block that only ever named tokens we could not resolve is deferred whole,
  // so the container gets the chance to judge it — never refused here, or the
  // customer is told their look failed while it is painting on their site.
  const unresolved = decls.some((d) => /var\(/.test(d.value));
  if (unresolved && !vars) return { ok: false, needsVars: true, why: "names colours the theme has not derived yet" };

  return { ok: true, decls, css: declsCss(decls), colors };
}

/**
 * Substitute `var(--token)` against a palette. The same bounded, cycle-safe pass
 * `site-css.mjs` uses, kept here rather than imported because that one is
 * private to it — and duplicated deliberately rather than exported, since the
 * two answer the same question for two different value shapes and coupling them
 * would make one file's fix the other's regression.
 */
function resolveWith(value, vars) {
  const seen = new Set();
  let s = String(value);
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;
    s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (m, name) => {
      const v = vars && Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : null;
      if (v == null || seen.has(name)) return m;
      seen.add(name); hit = true;
      return String(v);
    });
    if (!hit) break;
  }
  return s;
}

/**
 * THE BLOCK AS WE EMIT IT — never the model's own bytes.
 *
 * That is the property, not a formatting preference: the pairs came out of a
 * parser that refused every character an escape would need, so re-serialising
 * from them means the text reaching a customer's stylesheet was assembled here.
 * Passing the input through, however carefully checked, leaves the model's
 * bytes in the file and makes every future refusal a claim about a scanner
 * rather than about what is written.
 */
export function declsCss(decls) {
  return (decls || []).map((d) => `${d.prop}: ${d.value};`).join(" ");
}

/**
 * Read a model-written ramp for one axis.
 *
 * Returns `{ ok: true, value }` where `value` is exactly the shape the emitter
 * reads today — so an authored ramp and a named one are indistinguishable
 * downstream, and no emitter needs to learn a second shape.
 */
export function readRamp(input, { axis } = {}) {
  const spec = AXIS_RAMPS[String(axis)];
  if (!spec) return { ok: false, why: "is not an axis that takes numbers" };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, why: "was not an object of the values this takes" };
  }
  const out = {};
  for (const [field, f] of Object.entries(spec.fields)) {
    if (!Object.hasOwn(input, field)) return { ok: false, why: `is missing ${field}` };
    const raw = input[field];
    if (f.kind === "num") {
      // AN ARRAY IS NOT COERCED. `Number(["1.4"])` is 1.4 — the coercion this
      // repo has shipped as a real bug three times, most recently on the field
      // deciding who may read a business's customer data. A numeric STRING is
      // read, because that is what the option table itself holds for `icon` and
      // `border`, and the result is bounded either way.
      const n = typeof raw === "number" ? raw
        : (typeof raw === "string" ? Number(String(raw).trim().replace(/(rem|px|em)$/i, "")) : NaN);
      if (!Number.isFinite(n)) return { ok: false, why: `${field} is not a number` };
      if (n < f.min || n > f.max) return { ok: false, why: `${field} must be between ${f.min} and ${f.max}` };
      // THE UNIT IS THE FIELD'S, never the input's, so `2` and `"2px"` and
      // `"2rem"` all land as the one thing the emitter can use. Trusting the
      // input's unit is how `border: { width: "2rem" }` becomes a 32-pixel
      // border on every element and still compiles.
      out[field] = f.unit === undefined ? n : `${n}${f.unit}`;
    } else if (f.kind === "list") {
      if (!Array.isArray(raw) || raw.length !== f.len) return { ok: false, why: `${field} must be ${f.len} numbers` };
      const nums = raw.map((v) => (typeof v === "number" ? v : NaN));
      if (nums.some((n) => !Number.isFinite(n))) return { ok: false, why: `${field} must be numbers` };
      if (nums.some((n) => n < f.min || n > f.max)) return { ok: false, why: `every ${field} value must be between ${f.min} and ${f.max}` };
      // ASCENDING, because every one of these ramps is read by INDEX — the
      // smallest text size takes steps[0]. Out of order it still renders, and
      // what it renders is a heading lighter than its own body copy.
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] < nums[i - 1]) return { ok: false, why: `${field} must run from smallest to largest` };
      }
      out[field] = nums;
    } else if (f.kind === "ease") {
      const v = String(raw == null ? "" : raw).trim();
      if (!v) return { ok: false, why: `${field} was empty` };
      if (FORBIDDEN_VALUE.test(v) || /;/.test(v)) return { ok: false, why: `${field} contains a character an easing never needs` };
      if (!balanced(v)) return { ok: false, why: `${field} has unbalanced brackets` };
      const why = KINDS.ease(v);
      if (why) return { ok: false, why: `${field} ${why}` };
      out[field] = v;
    }
  }
  return { ok: true, value: out };
}

/**
 * WHAT THE TOOL SAYS ABOUT ONE AXIS, now that there is no enum to list.
 *
 * THE OPTION LABELS WERE CARRYING REAL DESIGN MEANING and they go with the
 * names — `icon: fine` read "drawn thin — jeweller, gallery, tailoring", which
 * is a whole brief in six words. What replaces it cannot be a shorter list; it
 * has to say what the axis IS, what the declarations will LAND ON, and which
 * properties this one owns. Without the selector the model is writing a hover
 * state blind and guessing whether it applies to the button or the card it
 * sits in.
 *
 * DERIVED FROM THE TABLES ABOVE, so an axis that gains a property is described
 * accurately with nothing edited here. A hand-written description that drifts
 * from the allow-list is the "described then refused" failure `site-tokens.mjs`
 * already records: a permission the model is told about and the engine refuses.
 */
export function authoredFieldHint(axis, said) {
  const name = String(axis);
  const ramp = AXIS_RAMPS[name];
  if (ramp) {
    const fields = Object.entries(ramp.fields).map(([f, spec]) => {
      if (spec.kind === "list") return `${f}: ${spec.len} numbers, ${spec.min} to ${spec.max}, smallest first`;
      if (spec.kind === "ease") return `${f}: a timing function`;
      const unit = spec.unit ? ` (${spec.unit === "" ? "unitless" : "in " + spec.unit})` : "";
      return `${f}: ${spec.min} to ${spec.max}${unit}`;
    });
    return `${said} — ${ramp.said}. Send {${fields.join(", ")}}.`;
  }
  const decl = AXIS_DECLS[name];
  if (!decl) return said || "";
  if (decl.image) return said || "";
  return `${said} — lands on ${decl.sel}. Write the declarations, no braces and no selector: `
    + `"${Object.keys(decl.props).slice(0, 2).map((p) => p + ": …").join("; ")}". `
    + `This one writes ${Object.keys(decl.props).join(", ")} and nothing else.`;
}

/**
 * The JSON Schema for one axis's field.
 *
 * NO ENUM ANYWHERE, which is the change. A ramp is an object of numbers and a
 * declaration axis is a string; the two image axes keep the `{light, dark}`
 * pair they already had, because a wash written for a light page and copied
 * onto a dark one leaves the quiet ink at 2.57:1.
 *
 * `additionalProperties` is deliberately NOT set anywhere here: this tool has
 * never used it, and `design_schema` is the one whose rejection 400s every
 * build on the platform — an untested JSON Schema construct there is not worth
 * the tidiness. `readRamp` refuses an unknown field at the door instead.
 */
export function authoredFieldSchema(axis, said) {
  const name = String(axis);
  const description = authoredFieldHint(name, said);
  const ramp = AXIS_RAMPS[name];
  if (ramp) {
    const props = {};
    for (const [f, spec] of Object.entries(ramp.fields)) {
      props[f] = spec.kind === "list"
        ? { type: "array", items: { type: "number" } }
        : spec.kind === "ease" ? { type: "string" } : { type: "number" };
    }
    return { type: "object", description, properties: props, required: Object.keys(ramp.fields) };
  }
  return { type: "string", description };
}

/**
 * ONE DOOR for both shapes, so a caller never has to know which kind an axis is.
 *
 * `parseStyle` asks this and nothing else — which is what keeps the cap, the
 * merge and the refusal reporting identical across all 23, and stops the two
 * shapes becoming two code paths that drift.
 */
export function readAuthoredAxis(axis, raw, { vars = null } = {}) {
  const name = String(axis);
  if (Object.hasOwn(AXIS_RAMPS, name)) return readRamp(raw, { axis: name });
  if (Object.hasOwn(AXIS_DECLS, name)) return readDecls(raw, { axis: name, vars });
  return { ok: false, why: "is not a style axis" };
}
