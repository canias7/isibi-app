// AUTHORED CSS VALUES — the model writes the gradient, we write the rule.
//
// THE MOVE THIS IS, AND WHY IT IS SAFE. The style axes were 23 enums: the model
// picked `backdrop: "aurora"` and that word was a lookup key into gradient code
// we had written by hand. Six backdrops, twenty textures, four shadows — a
// vocabulary, and a ceiling. This lets it author the value instead, which is the
// same move as deleting the 500-theme registry so the designer writes three hex
// colours: OURS is the derivation, THEIRS is the input.
//
// ── THE ONE RULE EVERYTHING HERE FOLLOWS ────────────────────────────────────
//
// A VALUE IS ACCEPTED ONLY IF WE CAN PARSE IT. Not "any CSS" — any CSS whose
// colour stops this module can read. That is `site-tokens.mjs`'s own lesson,
// one level up, in its words: "the notation exists BECAUSE it has a parser, so
// 'accepted but unreadable' is not a thing to remember, it is unrepresentable."
//
// It is not a purity argument, it is the legibility guarantee. `worldWorstGround`
// builds the darkest surface a backdrop can produce and walks the muted ink
// toward the full ink until it clears 4.5:1 against THAT. With a hand-written
// table it read the stops out of the table. With an authored gradient it has to
// read them out of the gradient — so a gradient whose stops we cannot parse is
// one whose text contrast we cannot guarantee, and it is refused rather than
// published. A wash that renders beautifully and drops the body copy to 3:1 is
// exactly the failure this platform has already shipped once.
//
// ── AND THE MODEL WRITES A VALUE, NEVER A RULE ──────────────────────────────
//
// The declarations are ours: `worldCss` owns `body { background-image: … }` and
// always did. So there is no selector to escape from and no `}` that could ever
// be meaningful — which is why the character rules below can simply REFUSE the
// characters an escape needs rather than trying to escape them. Same discipline
// as `routeSelectorOk` refusing a page path that cannot go in a selector, and as
// `isColor` refusing arbitrary text on its way into a stylesheet: there is no
// correct escape for "arbitrary text in a CSS value", so the shapes that would
// need one are not accepted.
//
// A plain module — no theme, no filesystem, no network — so every rule here is
// driven directly in test/site-css.test.mjs.

import { isColor, luminance, rgbOf } from "./site-tokens.mjs";

/** Longest single layer we will take. A gradient with sixty stops is not a
 *  design decision, it is a runaway generation, and it lands in a stylesheet
 *  every visitor downloads. */
export const MAX_LAYER = 600;

/** How many layers one axis may stack. `worldCss` composites decor over
 *  backdrop already, so this is per axis rather than per page. Four is more
 *  than any hand-written backdrop in the registry ever used. */
export const MAX_LAYERS = 4;

/**
 * CHARACTERS A CSS VALUE NEVER NEEDS, AND WHICH AN ESCAPE WOULD.
 *
 *   ; }  end a declaration and a rule — the whole injection
 *   {  @  open one — an at-rule can carry anything, including an import
 *   <  >  only meaningful if this ever reaches markup
 *   \  CSS's own escape, which can spell any of the above without using it
 *   " '  a value here needs no string; `url("…")` is the only thing that would
 *
 * `/` IS ALLOWED, deliberately and narrowly: it is the alpha separator in
 * `oklch(0.5 0.1 20 / 40%)`, which is the notation this platform's own
 * stylesheet is written in. `/*` is refused separately below, because a comment
 * can hide the rest of a value from a reader while the browser still sees it.
 */
const FORBIDDEN = /[;{}@<>\\"']/;

/**
 * WHAT MAY BE CALLED. An allow-list, never a deny-list — the same reasoning as
 * `modelsFor`: this arrives in a model's answer and reaches a stylesheet, so an
 * unknown name is not a function to pass through, it is a value to refuse.
 *
 * `url()` IS ABSENT AND THAT IS THE POINT. It is a fetch: a remote host the CSP
 * would refuse (so the layer silently does not paint), or a `data:` URI, which
 * is a way to put arbitrary bytes on a customer's site through a field that is
 * supposed to describe a colour ramp. Pictures have their own path, with its own
 * sniffing and its own caps.
 */
export const IMAGE_FUNCS = new Set([
  "linear-gradient", "radial-gradient", "conic-gradient",
  "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient",
  // Colour notations, so a stop can be written in any of them — and every one
  // of these is a notation `site-tokens.mjs` can PARSE, which is what keeps the
  // extremes derivable. Adding one here without a parser there is exactly the
  // "accepted but unreadable" state that file's comment forbids.
  //
  // `color-mix` IS DELIBERATELY ABSENT, and it was in this list until the tests
  // measured what it does. `isColor("color-mix(…)")` is FALSE — that file has no
  // parser for it — so the mix itself is unreadable and only its ENDPOINTS get
  // read. The tempting argument is that a mix must sit between its endpoints, so
  // the endpoint range is a safe superset.
  //
  // MEASURED OVER 40,000 RANDOM PAIRS, INTERPOLATED IN OKLCH THE WAY THE BROWSER
  // DOES: 9.08% of mixes land OUTSIDE their endpoints' luminance range, the
  // worst by 0.212 — two stops at luminance 0.519 and 0.527 mixing to 0.739.
  // Chroma interpolates linearly and WCAG luminance is not linear in it, so the
  // "it must be between them" intuition is simply wrong.
  //
  // That makes the endpoint range an UNDER-estimate, not a superset — the
  // direction that silently drops the contrast floor, which is the one failure
  // this whole module exists to prevent. Refused until `site-tokens.mjs` gains a
  // parser for it, which is where it belongs: ONE reading of "what colour is
  // this", never a second one here.
  //
  // The cost, stated: a stop cannot be written as a percentage of another
  // colour. `oklch()` directly is the way to write a tint, and it parses.
  "rgb", "rgba", "hsl", "hsla", "oklch", "oklab", "lab", "lch",
  // Arithmetic and token reads. `var()` is resolved against the theme BEFORE
  // parsing (see `resolveVars`) — an unresolvable token is refused, or the
  // stop's colour would be unknown and the contrast floor unprovable.
  "calc", "var",
]);

/** Bare words a gradient legitimately contains. Anything else that looks like a
 *  keyword is refused, because a misspelling silently changes what paints. */
const IMAGE_WORDS = new Set([
  "to", "at", "from", "in", "transparent", "none",
  "top", "bottom", "left", "right", "center",
  "circle", "ellipse",
  "closest-side", "closest-corner", "farthest-side", "farthest-corner",
  "srgb", "srgb-linear", "oklch", "oklab", "lab", "lch", "hsl", "hwb",
  "longer", "shorter", "increasing", "decreasing", "hue",
]);

/**
 * Units a gradient's numbers legitimately carry — angles for the direction,
 * lengths and percentages for the stops.
 *
 * AN ALLOW-LIST HERE TOO, because a dimension is stripped before the word scan
 * and anything stripped is a thing the scan can no longer refuse. `90dge` keeps
 * its unit, reads as a word, and is caught; `90deg` is a real angle and passes.
 */
const UNITS = new Set([
  "deg", "rad", "grad", "turn",
  "px", "em", "rem", "ch", "ex", "vw", "vh", "vmin", "vmax",
  "cm", "mm", "q", "in", "pt", "pc", "%",
]);

/** Parens must balance, or the value we emit runs into whatever follows it. */
function balanced(s) {
  let d = 0;
  for (const c of s) {
    if (c === "(") d++;
    else if (c === ")") { d--; if (d < 0) return false; }
  }
  return d === 0;
}

/**
 * Resolve `var(--token)` against the palette this theme will actually emit.
 *
 * WHY RESOLVE RATHER THAN REFUSE. A backdrop tinted with the site's own accent
 * is the single most useful thing an authored one can do, and it is what a model
 * reaches for first. Refusing `var()` outright would make every authored wash a
 * set of literal colours with no relationship to the brand.
 *
 * WHY RESOLVE RATHER THAN PASS THROUGH. The stops have to be READABLE for the
 * contrast floor to mean anything, and `var(--accent)` is not a colour until
 * something substitutes it. An unresolvable token is refused for the same
 * reason a garbled hex is: not because it is dangerous, but because a stop we
 * cannot read is a floor we cannot prove.
 */
export function resolveVars(value, vars) {
  const seen = new Set();
  let s = String(value);
  // Bounded rather than recursive: a token defined in terms of another is fine,
  // a cycle is not, and there is no legitimate depth beyond a couple of hops.
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;
    s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (m, name) => {
      const v = vars && Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : null;
      if (v == null) return m;
      // A token that resolves to something naming itself would spin.
      if (seen.has(name)) return m;
      seen.add(name);
      hit = true;
      return String(v);
    });
    if (!hit) break;
  }
  return s;
}

/**
 * Read one background layer.
 *
 * Returns `{ ok: true, value, colors }` — the value as it will be emitted, and
 * every colour it reaches, so the caller can build the worst ground it can
 * produce. `colors` is what makes an authored backdrop as safe as a table one.
 *
 * Returns `{ ok: false, why }` otherwise. The reason is for the CUSTOMER —
 * `styleNote` says what was refused and why — so it names the thing they can
 * act on rather than the rule it broke.
 */
export function readLayer(raw, { vars = null } = {}) {
  const input = String(raw == null ? "" : raw).trim();
  if (!input) return { ok: false, why: "was empty" };
  if (input.length > MAX_LAYER) return { ok: false, why: "is longer than a gradient needs to be" };
  if (/\/\*|\*\//.test(input)) return { ok: false, why: "contains a comment" };
  if (FORBIDDEN.test(input)) return { ok: false, why: "contains a character a colour value never needs" };
  if (!balanced(input)) return { ok: false, why: "has unbalanced brackets" };

  const value = resolveVars(input, vars);
  // THE ONE FAILURE THAT DEPENDS ON THE THEME, and the only one flagged as such.
  //
  // Every other refusal above and below is decidable from the text alone — a
  // `url()`, a semicolon, an unbalanced bracket are wrong wherever they are read.
  // This one is not: it means "the palette handed to me does not define that
  // token", and the palette only EXISTS in the container (`normalizeSeeds` runs
  // there, so the Worker holds three hex seeds and no derived tokens).
  //
  // `needsVars` is what lets a caller with no palette tell "the model wrote
  // something wrong" from "I cannot judge this here". Without it the Worker's
  // note would tell a customer their backdrop was refused while the container
  // accepted it and it painted — the two-readings-disagree failure, on the half
  // the customer reads.
  if (/var\(/.test(value)) return { ok: false, needsVars: true, why: "names a colour the theme does not define" };

  // FUNCTIONS FIRST. A name immediately followed by `(` is a call, and an
  // unknown one is refused before anything else is read — so a value can never
  // reach the stylesheet through a function we have not considered.
  for (const m of value.matchAll(/([a-zA-Z][\w-]*)\s*\(/g)) {
    if (!IMAGE_FUNCS.has(m[1].toLowerCase())) return { ok: false, why: `uses ${m[1]}(), which is not allowed here` };
  }

  // Then the bare words, which is where a misspelling hides: `to bottm` is valid
  // CSS syntax and paints nothing at all.
  //
  // THE TWO THINGS THAT ARE NOT WORDS AND LOOK LIKE THEM, both of which this
  // check falsely refused on its first run against perfectly ordinary gradients:
  //
  //   #fce7c8   a hex colour whose DIGITS are letters. The `#` is not part of a
  //             word match, so `fce7c8` read as a keyword and `linear-gradient(
  //             #fce7c8, #ffffff)` — about as plain as a gradient gets — was
  //             refused.
  //   90deg     a dimension. The unit trails a number and reads as a word, so
  //             every angled or sized gradient was refused.
  //
  // Both are stripped BEFORE the scan rather than added to the keyword list,
  // because listing them would also accept a bare `deg` sitting where a colour
  // should be. What is left after the strip is genuinely a word.
  const words = value
    .replace(/[a-zA-Z][\w-]*\s*\(/g, " ")            // function names, checked above
    .replace(/#[0-9a-fA-F]{3,8}\b/g, " ")            // hex colours
    .replace(/[\d.]+\s*([a-zA-Z]+|%)/g, (m, u) => (UNITS.has(String(u).toLowerCase()) ? " " : m))
    .match(/[a-zA-Z][\w-]*/g) || [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (IMAGE_WORDS.has(lw) || IMAGE_FUNCS.has(lw)) continue;
    return { ok: false, why: `uses "${w}", which is not a value a gradient takes` };
  }

  // THE STOPS. At least one readable colour, or there is nothing to check the
  // contrast floor against — and a layer of pure `transparent` paints nothing,
  // which reads to the customer as the backdrop having been ignored.
  const colors = readColors(value);
  if (!colors.length) return { ok: false, why: "has no colour we could read" };

  return { ok: true, value, colors };
}

/**
 * Every colour a value reaches, as luminances.
 *
 * DRIVEN THROUGH `site-tokens.mjs`'s OWN PARSER rather than a second one here.
 * Two readings of "what colour is this" is how the platform ends up with a
 * contrast floor computed against a colour that is not the one on screen — and
 * that file has already recorded exactly that bug, where `isColor` accepted six
 * notations `luminance` could not read.
 */
export function readColors(value) {
  const out = [];
  const push = (tok) => {
    if (!tok || !isColor(tok)) return;
    const l = luminance(tok);
    // THE CHANNELS TRAVEL WITH THE LUMINANCE, because the caller needs both and
    // for different things: luminance PICKS the worst stop, and the channels are
    // what gets composited under the opened root to build the ground the muted
    // ink and the divider are then fitted against. Reading the colour twice — a
    // luminance here and an RGB somewhere downstream — is the disagreement
    // `rgbOf` was extracted to make impossible.
    const rgb = rgbOf(tok);
    if (typeof l === "number" && Number.isFinite(l) && rgb) out.push({ token: tok, luminance: l, rgb });
  };
  // Hex first — it cannot contain a bracket, so it needs no depth handling.
  for (const m of String(value).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) push(m[0]);
  // Then function-shaped colours, taken with their whole argument list. A flat
  // split on `,` would cut `color-mix(in oklch, a, b)` into three fragments —
  // the depth-aware read this repo has written wrong four times.
  for (const m of String(value).matchAll(/\b(rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/g)) {
    const start = m.index;
    let d = 0, end = -1;
    for (let i = start; i < value.length; i++) {
      if (value[i] === "(") d++;
      else if (value[i] === ")") { d--; if (d === 0) { end = i + 1; break; } }
    }
    if (end > start) push(value.slice(start, end));
  }
  return out;
}

/**
 * Read a whole authored axis value: a list of layers per mode.
 *
 * `{ light: [...], dark: [...] }`, AND BOTH ARE REQUIRED.
 *
 * The obvious rule — an absent dark mirrors the light, as `normalizeSeeds` does
 * for an absent dark palette — is wrong here, and measurably so. That one
 * DERIVES a dark palette by flipping lightness; there is no equivalent for a
 * gradient, so mirroring can only COPY. Measured: a light wash copied onto a
 * dark page leaves the quiet ink at 2.57:1 against 4.96:1 in light, so the
 * legibility gate refuses it every time — and refuses it with a contrast
 * message, when the real fault is that we duplicated a wash nobody wrote for
 * that mode.
 *
 * So a one-mode answer is refused HERE, where the reason can say what it is.
 * The model is authoring the world behind the page and the page has two modes;
 * half an answer is half an answer.
 *
 * REFUSES WHOLESALE, NEVER PARTIALLY. Half an authored backdrop is a wash
 * missing the layer that made it work, published as though it were what was
 * asked for — and the caller's fallback (the ordinary ground) is a coherent
 * design where half a gradient is not.
 */
export function readAuthored(spec, { vars = null } = {}) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { ok: false, why: "was not a light/dark pair" };
  const out = {}, colors = { light: [], dark: [] };
  for (const mode of ["light", "dark"]) {
    const raw = spec[mode];
    const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    if (!list.length) return { ok: false, why: `named no layers for the ${mode} mode — both are needed` };
    if (list.length > MAX_LAYERS) return { ok: false, why: `stacks ${list.length} layers, more than ${MAX_LAYERS}` };
    const done = [];
    for (const one of list) {
      const r = readLayer(one, { vars: vars && vars[mode] });
      if (!r.ok) return { ok: false, why: r.why, ...(r.needsVars ? { needsVars: true } : {}) };
      done.push(r.value);
      colors[mode].push(...r.colors);
    }
    out[mode] = done;
  }
  return { ok: true, layers: out, colors };
}

/**
 * The darkest and lightest a mode's layers reach, as luminances.
 *
 * THIS IS THE WHOLE REASON THE PARSER EXISTS. `worldWorstGround` needs the worst
 * surface a backdrop can produce so the muted ink can be walked until it clears
 * 4.5:1 against it. With the hand-written table it read the stops out of the
 * table; with an authored gradient it reads them out of the gradient, and the
 * guarantee is identical rather than merely similar.
 *
 * Null when nothing was readable, so a caller cannot mistake "no colours" for
 * "the extremes are 0 and 1" — the direction that silently drops the floor.
 */
export function extremes(colors) {
  const ls = (colors || []).map((c) => c.luminance).filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!ls.length) return null;
  return { min: Math.min(...ls), max: Math.max(...ls) };
}
