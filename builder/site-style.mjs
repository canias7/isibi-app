// The rest of the look, changed — without re-rolling the whole theme.
//
// `site-tokens.mjs` next door solved exactly one half of this. A customer could
// change a COLOUR ("make the background yellow") and, later, the corner radius,
// because those two are values on a continuum and no theme in the registry is
// "the one you have, but yellow". Everything else a theme decides was frozen the
// moment the build finished.
//
// MEASURED, not assumed: a theme makes twelve other decisions that each emit
// real CSS on every build — button shape, input style, icon weight, shadow,
// text size, line spacing, letter spacing, font weight, page density, corner
// shape, border weight, heading colour. Those are most of what makes two sites
// look unlike each other; the palette is the part people notice first and the
// smallest part of the actual look. Ask for "square buttons" and one of two
// things happened: nothing, or the designer swapped the whole theme looking for
// one that happens to have them — which changes the colours and the fonts and
// the spacing too. They asked for one thing and got a different site.
//
// WHY THIS IS NOT MORE TOKENS, which was the obvious shape and is the wrong one.
// Six of the twelve emit CSS custom properties and could indeed be patched the
// way a colour is; three emit ordinary RULES (`.lucide { stroke-width }`,
// `.border-input { … }`, a border-radius on the button selector) and one emits
// both, so a token patch reaches two thirds of them and silently misses the
// rest. But every one of the twelve is read off the THEME OBJECT by an emitter
// that already exists:
//
//     cornerCss(theme) + typeCss(theme.scale) + trackingCss(theme.tracking) + …
//
// So the patch belongs one layer earlier. Merge the override into the theme and
// all twelve are GENERATED correctly rather than overridden afterwards — no
// source-order trick, no specificity question, and the three rule-emitting axes
// work identically to the nine that are properties.
//
// AND THEY ARE ENUMS, NOT VALUES, which is what makes this cheap. There is no
// "slightly rounder button": there is pill, sharp, or let the radius decide.
// Twelve axes with about three options each is 38 legal answers, all ours, all
// known before the build starts. `isColor` and `isLength` exist because a colour
// is arbitrary text on its way into a stylesheet; nothing here needs a parser,
// because nothing here is arbitrary.
//
// A plain module: it imports the theme engine's own option lists so the two
// cannot disagree, and nothing else, so all of it is tested outside the Worker
// and outside the container.

import {
  CORNERS, TYPE_SCALES, TRACKINGS, LEADINGS, WEIGHTS, DENSITIES, WIDTHS, BORDERS,
  ICON_STROKES, SHADOWS, BUTTONS, INPUTS, DISPLAYS,
  SURFACES, BACKDROPS, DECORS, AMBIENTS, SKINS,
  buttonsCss, inputsCss,
} from "./site-theme.mjs";

/**
 * WHAT MAY BE CHANGED, and nothing else.
 *
 * The options and their descriptions are DERIVED from the theme engine's own
 * constants rather than restated here. A restated list is a second thing that
 * can drift, and the direction it drifts in is describing an option to the model
 * that the engine will then refuse — reported to the customer as a change that
 * did not happen.
 *
 * `said` is the only hand-written half, because it is the one thing the engine
 * does not know: what a customer calls this. It must also be distinct from
 * every name `site-tokens.mjs` uses — the two compose SEPARATE sentences into
 * the same note block, so "borders" on both sides printed the same line twice
 * about two different things. Asserted by a derived test that reads both. A theme's own label for `density`
 * is "close — more on a screen, a working tool", which is right for somebody
 * choosing a theme and wrong for a sentence that has to say what just changed.
 *
 * THE FIVE "WORLD" AXES ARE HERE TOO (owner's call), and they were excluded
 * once on an argument that RENDERING disproved in four of five cases. The claim
 * was that they only work as a set. Driven and looked at:
 *
 *   - `backdrop` alone — fine. Crisper, if anything.
 *   - `decor` alone — fine, it is a texture on the paper.
 *   - `skin` alone — fine, it is the card's own shape.
 *   - `ambient` alone — motion over whatever is behind; nothing to couple to.
 *   - `surface: glass` alone — THE CARDS DISAPPEAR. Not "subtly wrong", which
 *     is what the exclusion claimed: `surfaceCss` sets `--card` to 0.5 alpha, so
 *     with no wash behind it a half-transparent card sits on a plain page and
 *     the card layer is gone. Same mechanism as the see-through-modals bug.
 *
 * So the dependency runs ONE WAY and only one axis has it. That is handled by
 * `applyStyle` supplying what glass needs rather than by refusing it — see
 * below.
 */
export const AXES = Object.freeze({
  corner:   { options: CORNERS,      said: "corner shape" },
  scale:    { options: TYPE_SCALES,  said: "text size" },
  tracking: { options: TRACKINGS,    said: "letter spacing" },
  leading:  { options: LEADINGS,     said: "line spacing" },
  weight:   { options: WEIGHTS,      said: "font weight" },
  density:  { options: DENSITIES,    said: "overall spacing" },
  width:    { options: WIDTHS,       said: "page width" },
  border:   { options: BORDERS,      said: "border weight" },
  icon:     { options: ICON_STROKES, said: "icon weight" },
  shadow:   { options: SHADOWS,      said: "shadows" },
  buttons:  { options: BUTTONS,      said: "button shape" },
  inputs:   { options: INPUTS,       said: "input style" },
  display:  { options: DISPLAYS,     said: "heading colour" },
  surface:  { options: SURFACES,     said: "panel style" },
  backdrop: { options: BACKDROPS,    said: "background wash" },
  decor:    { options: DECORS,       said: "page texture" },
  ambient:  { options: AMBIENTS,     said: "background motion" },
  skin:     { options: SKINS,        said: "card style" },
});

/**
 * WHAT FROSTED PANELS NEED BEHIND THEM.
 *
 * `aurora`'s own label in the engine is "drifting colour washes — the glass
 * canvas, for any surface", so this is the option that exists for exactly this.
 */
const GLASS_BACKDROP = "aurora";

/** Is there anything painted behind the page for a translucent panel to sit on? */
function hasBackdrop(t) {
  const b = t && t.backdrop;
  return typeof b === "string" && b !== "plain";
}

/** Every axis a caller may name. */
export const ASKABLE = Object.freeze(Object.keys(AXES));

/** The legal answers for one axis, in the order the engine declares them. */
export function optionsFor(axis) {
  const a = Object.hasOwn(AXES, axis) ? AXES[axis] : null;
  return a ? Object.freeze(Object.keys(a.options)) : Object.freeze([]);
}

/**
 * More than this ON A REVISE and it is a re-theme, which is a rebuild.
 *
 * Six of twelve when it was written, the same proportion `MAX_TOKENS` allows of
 * the palette — and the same reasoning. A customer moving half the look is not
 * asking for an adjustment to the theme they have, they are telling us the theme
 * is wrong, and the honest answer to that is a different theme rather than a
 * patch big enough to hide which one they are on. (There are eighteen axes now,
 * so the proportion has slipped to a third; the number stays because it is the
 * size of an ADJUSTMENT, which does not grow when the axis list does.)
 */
export const MAX_STYLE = 6;

/**
 * …AND IT DOES NOT APPLY TO A FIRST BUILD, because its premise does not.
 *
 * The paragraph above is about a customer PATCHING a design they already have.
 * On a first build there is no design to be moving half of — the designer is
 * stating what the look IS, and every axis it names is the first statement about
 * that axis rather than a departure from one. Capped at six there, the merge
 * keeps whichever six `AXES` happens to declare first (corner, scale, tracking,
 * leading, weight, density) and silently drops buttons, inputs, shadows, icon
 * weight and the whole world layer — an arbitrary cut nobody designed, reported
 * to the customer through `styleNote` as axes we refused.
 *
 * DERIVED FROM THE AXIS LIST, so it is a no-op by construction rather than a
 * generous number that goes stale the day a nineteenth axis lands. It is written
 * as a cap and not as "no cap" so the two paths read the same way at the call
 * site, and so a real bound can be put here later without moving anything else.
 */
export const MAX_STYLE_BUILD = ASKABLE.length;

/**
 * THE TWO AXES THAT SET A CORNER RADIUS, which matters for exactly one reason.
 *
 * `stripThemeRadius` drops a theme's own hard-set `border-radius` rules when the
 * customer has asked for a specific one, because 280 of the 500 themes set those
 * as real rules the `--radius` token cannot reach. Those rules and the ones
 * `buttonsCss`/`inputsCss` emit are indistinguishable to a regex, so a customer
 * asking for "rounder corners AND pill buttons" got the first and silently lost
 * the second.
 *
 * The rule that resolves it is the one already in force: an EXPLICIT corner
 * opinion beats an implicit one. The theme's own opinion gives way to the
 * radius the customer named; the customer's own `buttons: "pill"` does not.
 * `explicitRadiusCss` re-emits exactly the axes they set, after the strip.
 *
 * Held in code because deriving it would mean evaluating twelve emitters with
 * three different signatures inside a module that has no theme to evaluate them
 * against. The truth is derived in `test/site-style.test.mjs`, which runs every
 * axis over every option and asserts this list is the whole of it.
 */
export const RADIUS_AXES = Object.freeze(["buttons", "inputs"]);

/**
 * A model's answer, reduced to the axes it is allowed to set.
 *
 * DROPS rather than validates, the `parseTokens` discipline: an unknown axis and
 * an unknown option are both simply not there afterwards, so nothing downstream
 * has to decide what a half-valid patch means. `dropped` exists so a caller can
 * say what it ignored rather than silently doing less than it was asked.
 */
export function parseStyle(input, { max = MAX_STYLE } = {}) {
  const out = {}, dropped = [];
  const src = input && typeof input === "object" && !Array.isArray(input) ? input
    : Array.isArray(input) ? Object.fromEntries(input
        .filter((e) => e && typeof e === "object")
        .map((e) => [String(e.axis || e.name || ""), e.option || e.value])) : {};
  for (const [rawName, rawVal] of Object.entries(src)) {
    const name = String(rawName || "").trim().toLowerCase();
    // `Object.hasOwn`, NOT a plain lookup. `AXES["constructor"]` is a function —
    // truthy, so it walks straight past a `|| null` and hands back something
    // that is not an axis. The exact bug that shipped once in the Stripe plan
    // lookup and again in `resolveTheme`.
    if (!Object.hasOwn(AXES, name)) { dropped.push(rawName); continue; }
    // A STRING, not anything stringifiable. `String(["pill"])` is `"pill"`, so a
    // one-element array would pass a shape test and set a real axis from a value
    // nobody wrote — the `normalizeRole` lesson, and the same one that let
    // `access: ["display"]` through on a table deciding who reads customer data.
    if (typeof rawVal !== "string") { dropped.push(rawName); continue; }
    const val = rawVal.trim().toLowerCase();
    if (!Object.hasOwn(AXES[name].options, val)) { dropped.push(rawName); continue; }
    if (Object.keys(out).length >= max) { dropped.push(rawName); continue; }
    out[name] = val;
  }
  return { style: out, dropped };
}

/**
 * This build's patch, on top of everything earlier builds set.
 *
 * ACCUMULATED, for the reason `mergeTokens` is: a revise names only what it is
 * changing, so square buttons asked for today and airy spacing asked for
 * tomorrow have to both survive. A replacing merge hands back the theme's own
 * buttons on the second revise, which reads as the first instruction being
 * forgotten.
 *
 * THE CAP BOUNDS THE PATCH AND NEVER THE ACCUMULATION, and getting that wrong
 * was far worse than the bug it was found next to. It used to cap the MERGED
 * TOTAL, which was indistinguishable from capping the patch for as long as
 * nothing could author more than six — and the day a first build could author
 * eighteen, measured: a site built with all eighteen and then asked for round
 * buttons came back with SIX, losing density, width, border, icon, shadow,
 * inputs, display, surface, backdrop, decor, ambient and skin. The whole visual
 * identity stripped to the template's defaults on the customer's first edit,
 * silently, and reported as a success.
 *
 * `MAX_STYLE`'s own paragraph says what it is for: "a customer MOVING half the
 * look is telling us the theme is wrong". That is a fact about one instruction.
 * The stored look is not being moved — it is what the site already is — so the
 * prior is parsed whole and only `next` is bounded. Growth is bounded anyway:
 * there are only eighteen axes, so the merge can never exceed `ASKABLE.length`.
 *
 * `max` REACHES `parseStyle(next)` and not only a check here, because
 * `parseStyle` applies its own — so a build passing `MAX_STYLE_BUILD` while the
 * inner call still capped at six would have the patch cut before the merge ever
 * saw it, and the widening would read as done and do nothing.
 */
export function mergeStyle(prior, next, { max = MAX_STYLE } = {}) {
  const a = parseStyle(prior, { max: MAX_STYLE_BUILD }).style;
  const b = parseStyle(next, { max }).style;
  return { ...a, ...b };
}

/**
 * The theme this site actually gets.
 *
 * The whole mechanism, and it is one line, because the emitters were already
 * reading these fields off the theme object. Validated on the way in rather than
 * trusted: this object goes to `themeCss`, and an axis holding something that is
 * not one of its options reaches an emitter whose `?? DEFAULT` fallback then
 * quietly ignores it — a change reported as applied that moved nothing.
 *
 * Returns the theme UNTOUCHED when there is no valid patch, so a site that never
 * asked for one gets a byte-identical stylesheet to the build before this
 * existed. A missing theme stays missing — `writeTheme` fails soft on that and
 * inventing an object here would turn a fail-soft into a broken look.
 *
 * AND IT GIVES GLASS SOMETHING TO SIT ON, which is the only coupling among the
 * seventeen and was MEASURED rather than reasoned. `surfaceCss` sets `--card` to
 * 0.5 alpha; with a plain ground behind it a half-transparent card on a plain
 * page is not a card at all — rendered, the panels simply vanish. So a customer
 * who asks for frosted panels and nothing else gets a wash for them to be
 * frosted against.
 *
 * DERIVED AT THE POINT OF USE, NEVER STORED — exactly where `withContrast` sits
 * and for the same reason: what is kept is only ever what the customer actually
 * asked for, and the supporting decision follows whatever the theme is at build
 * time. It also means this cannot spend a slot of their `MAX_STYLE`.
 *
 * SILENTLY, like `withContrast`. This is not a second change made on their
 * behalf — it is the change they asked for, working. "Frosted panels" with
 * nothing to frost against is not a cheaper version of the request, it is the
 * request failing.
 *
 * IT VALIDATES WITHOUT RE-CAPPING, and this is the THIRD place the cap lived and
 * the only one the unit suite could not see. `parseStyle` is here to drop an
 * axis or an option the engine does not know; the CALLER decided how many may
 * survive, and this runs in the container, downstream of that decision. Left at
 * the revise cap it kept whichever six `AXES` declares first — measured against
 * a real compiled stylesheet: an eighteen-axis build came back with the icon
 * weight at the theme's own value and no world layer at all, so the Worker would
 * have stored eighteen, sent eighteen, and had twelve thrown away here. The
 * wiring layer, which is what the container harness exists to catch.
 */
export function applyStyle(theme, style, { max = MAX_STYLE_BUILD } = {}) {
  if (!theme || typeof theme !== "object") return theme;
  const s = parseStyle(style, { max }).style;
  if (!Object.keys(s).length) return theme;
  const out = { ...theme, ...s };
  if (out.surface === "glass" && !hasBackdrop(out)) out.backdrop = GLASS_BACKDROP;
  return out;
}

/**
 * The corner rules the customer asked for BY NAME, to be re-emitted after a
 * strip. See `RADIUS_AXES` for why this exists at all.
 *
 * Empty for a patch that named neither axis, and empty for the no-op options
 * (`inherit`, `standard`) — those mean "let the radius decide", which is exactly
 * what the strip leaves behind.
 */
export function explicitRadiusCss(style, { max = MAX_STYLE_BUILD } = {}) {
  // THE SAME RE-CAP, and here it bites harder than anywhere else: `AXES`
  // declares `buttons` eleventh and `inputs` twelfth, so at the revise cap an
  // eighteen-axis patch has both cut before this ever looks for them — measured,
  // it returned the empty string. That is the corner collision this function
  // exists to fix, silently failing on exactly the widest patches.
  const s = parseStyle(style, { max }).style;
  return (s.buttons ? buttonsCss(s.buttons) : "") + (s.inputs ? inputsCss(s.inputs) : "");
}

/**
 * What a customer calls this axis.
 *
 * Exported because `public/chat.js` cannot import this module and the look
 * lane's reply is assembled there from a list of names. Sending the raw keys
 * instead would print "Updated the look — display", which means heading colour
 * and reads as a screen.
 */
export function saidFor(axis) {
  return Object.hasOwn(AXES, axis) ? AXES[axis].said : String(axis || "");
}

/**
 * What was changed, and what was asked for and refused, in one sentence.
 *
 * Composed HERE and not in the client, for the reason `tokenNote` and
 * `contextSentence` are: `public/chat.js` cannot import this module, so a second
 * copy there is a second thing that can disagree — and the direction it drifts
 * in is claiming a change that did not happen.
 *
 * A REFUSED AXIS IS NAMED. Somebody who asks for something we cannot do, and is
 * told nothing, reads the unchanged page as the builder being broken rather than
 * as a request that did not land.
 *
 * IT VALIDATES WITHOUT RE-CAPPING, and the difference started mattering the day
 * a first build could author all eighteen. `parseStyle` is here to drop an axis
 * or an option the engine does not know — the CALLER has already decided how
 * many may survive — so re-applying the revise cap here made the sentence report
 * six of eighteen and call it what changed. A reporter that quietly counts fewer
 * than were applied is the "change reported as applied" failure pointed the
 * other way round.
 */
export function styleNote(applied, dropped) {
  const set = Object.keys(parseStyle(applied, { max: MAX_STYLE_BUILD }).style);
  const bad = (Array.isArray(dropped) ? dropped : [])
    .map((d) => String(d || "").trim().toLowerCase())
    .filter(Boolean);
  const parts = [];
  const say = (k) => (Object.hasOwn(AXES, k) ? AXES[k].said : k);
  if (set.length) {
    const names = set.map(say);
    parts.push("Changed the " + (names.length === 1 ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names.at(-1)) + ".");
  }
  if (bad.length) {
    parts.push("Couldn’t change the " + bad.slice(0, 3).map(say).join(", ") +
      " — that isn’t one of the options for it.");
  }
  return parts.join(" ");
}

/**
 * What to tell the model an axis's options are.
 *
 * Derived from the engine's own labels, so an option added to a theme axis
 * cannot end up undescribed in the one place the model reads. The label is what
 * makes the choice accurate — `pill` on its own is a guess, "fully round ends,
 * whatever the cards do" is an instruction.
 */
export function axisHint(axis) {
  if (!Object.hasOwn(AXES, axis)) return "";
  return Object.entries(AXES[axis].options)
    .map(([k, v]) => k + " (" + String((v && v.label) || k) + ")")
    .join("; ");
}
