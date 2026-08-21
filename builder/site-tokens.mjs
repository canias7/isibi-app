// One colour, changed — without re-rolling the whole look.
//
// "make the background yellow" used to be a REVISE: the designer read those six
// words, named a theme and a family from them, and the site came back a
// different site. Anchoring the look in `_meta` fixed the re-roll and left the
// other half broken — the customer now could not change the background AT ALL,
// because every token comes from a theme in the registry and none of the 500
// is "the one you have, but yellow".
//
// So a site carries a small patch of its own: a handful of CSS custom
// properties written after the theme, in the site's own `_meta`, accumulated
// across revises. Two properties do the work — the token list is an ALLOW-LIST,
// and the value must be a colour we can PARSE, not a string we pass through.
//
// ONE IMPORT, and it is the palette generator itself. `oklchToRgb` is what
// writes every colour on every site the platform builds, so reading one back
// through the SAME function is exact by construction rather than by a second
// implementation that agrees today — see `COLOR_FUNCS` below for why this file
// had to learn to read colours at all. `site-theme.mjs` has no imports of its
// own and is already COPYd into the build image beside this file, so nothing
// about where this module can run changes.
import { oklchToRgb } from "./site-theme.mjs";

/**
 * WHAT MAY BE CHANGED, and nothing else.
 *
 * Every one is a COLOUR token the template declares at `:root` — `SIZES` below
 * holds the one that isn't. Deliberately NOT the whole shadcn palette, and each
 * exclusion has a reason:
 *
 *   - `--chart-1..5` are a SET whose entire job is staying distinguishable from
 *     each other. Changing one in isolation breaks the thing they exist for.
 *   - The `-foreground` halves are DERIVED rather than asked for, so that a
 *     changed surface cannot be left with unreadable text on it (`withContrast`).
 *   - The eight `--sidebar*` tokens are used by exactly ONE component in the
 *     kit, on a platform that makes barber shops and cafés. If a generated site
 *     ever really uses a sidebar, the fix is to make `--sidebar` FOLLOW
 *     `--background` the way `--muted-foreground` does — one derivation, not
 *     eight more slots somebody has to know to ask for.
 *
 * `success` and `warning` ARE here, on measurement rather than on taste: 33 kit
 * components paint with them (status pills, sync indicators, on-call badges,
 * usage meters) and all 33 are offered to the generator, so they really do
 * appear on generated pages. Without them they were the only page colours a
 * customer could not touch at all.
 */
export const TOKENS = Object.freeze([
  "background", "foreground",
  "card", "popover",
  "primary", "secondary", "accent", "muted",
  "border", "input", "ring",
  "destructive", "success", "warning",
]);

/**
 * TOKENS THAT TAKE A LENGTH, NOT A COLOUR.
 *
 * "Make the corners rounder" is the one thing customers ask for that is not a
 * colour, and it was unreachable: the colour parser correctly refused `0.5rem`,
 * so there was no path for it at all.
 *
 * ONE KNOB, because the template made it one. `--radius` is declared at
 * `:root` and the seven sizes the kit actually uses are derived from it with
 * `calc()` (`--radius-sm` is `calc(var(--radius) - 4px)`, `--radius-xl` is
 * `+ 4px`, and so on), so overriding the single value moves every rounded
 * corner on the site coherently. Offering the seven separately would let
 * somebody set `sm` larger than `xl`.
 */
export const SIZES = Object.freeze(["radius"]);


/** The `-foreground` partner of a surface token, where one exists. */
const PAIRS = Object.freeze({
  background: "foreground",
  card: "card-foreground",
  popover: "popover-foreground",
  primary: "primary-foreground",
  secondary: "secondary-foreground",
  accent: "accent-foreground",
  muted: "muted-foreground",
  destructive: "destructive-foreground",
  success: "success-foreground",
  warning: "warning-foreground",
});

/**
 * THE TEXT THAT SITS ON EACH SURFACE — nine colours that were WRITABLE and not
 * askable, so nobody could name one.
 *
 * `withContrast` picks them: near-black on a light surface, near-white on a
 * dark one. That is a good DEFAULT and it was also a ceiling. It is right
 * nearly always and wrong exactly where a customer notices — a mid-tone card
 * where the crossover goes the other way, a brand colour whose button text
 * wants to be the brand's own rather than plain white — and "the text on the
 * cards is too light" had no path at any price.
 *
 * NOTHING IN THE DERIVATION HAD TO CHANGE, which is what makes this a list
 * rather than a feature. `withContrast` already skips a pairing whose partner is
 * present (`if (!(surface in out) || fg in out) continue;`), and `muted-foreground`
 * has the same guard — so an explicit value has always won, and the only thing
 * missing was permission to send one. Asserted, because the whole change rests
 * on it.
 *
 * DERIVED FROM `PAIRS`, so a tenth surface added there is askable without
 * anybody editing a list here — the drift this file already keeps `WRITABLE`
 * out of by the same trick.
 */
export const PAIRED = Object.freeze([...new Set(Object.values(PAIRS))]);

/** Everything the designer may name, whatever kind of value it takes. */
export const ASKABLE = Object.freeze([...new Set([...TOKENS, ...PAIRED, ...SIZES])]);

/**
 * WHAT MAY BE WRITTEN, which is a bigger set than what may be ASKED for.
 *
 * The two were one list until a render showed why they cannot be. `withContrast`
 * DERIVES `card-foreground`, `muted-foreground` and the rest — names the
 * designer is deliberately not offered, because they are worked out from the
 * surface rather than chosen — and with one list those derived values were
 * silently dropped on the way to the stylesheet by the very function meant to
 * let them through. A validator shared between two layers with different jobs
 * quietly enforces the stricter one at both.
 */
export const WRITABLE = Object.freeze([...new Set([...ASKABLE, ...PAIRED])]);

/** More than this ASKED FOR and it is a re-theme, which is a rebuild. */
export const MAX_TOKENS = 8;

/**
 * The write cap, which has to clear what the ask cap can produce.
 *
 * Every asked-for surface can bring a derived partner, and a background brings
 * three surfaces of its own — so a legal ask of 8 expands well past 8. Sized
 * from the lists rather than guessed, or the cap silently truncates a patch
 * that was entirely valid.
 */
const MAX_WRITABLE = WRITABLE.length;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUM = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)%?";
// THE SEPARATOR IS REQUIRED, and leaving it optional was a real hole found by
// its own test: written `\\s*[,/]?\\s*`, `rgb(255)` matched, because `255` reads
// as the three numbers 2, 5 and 5 with nothing between them. It let a
// syntactically wrong colour through to the stylesheet, where a browser drops
// the declaration and the customer is told the change was applied.
const SEP = "(?:\\s*,\\s*|\\s*/\\s*|\\s+)";

/* ── reading a colour, not merely recognising one ──────────────────────────── */

/**
 * sRGB, gamma-encoded and clamped to 0..255. Every converter below ends here,
 * so an out-of-gamut triple lands where a browser would put it rather than as a
 * negative number that quietly poisons a luminance.
 */
const enc255 = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, c * 255));
};

/** A component as written: the number, and whether it carried a `%`. */
const num255 = (c) => (c.pct ? (c.n / 100) * 255 : c.n);
/** 0..1 scale — `oklch(50% …)` and `oklch(0.5 …)` are the same lightness. */
const unit01 = (c) => (c.pct ? c.n / 100 : c.n);
/** A percentage reference range: `100%` means `ref`, a bare number is itself. */
const ref = (c, r) => (c.pct ? (c.n / 100) * r : c.n);

/** CSS Color 4's own HSL algorithm, verified against three known values. */
function hslToRgb(hDeg, s, l) {
  const h = ((hDeg % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((v) => Math.min(255, Math.max(0, v * 255)));
}

/**
 * CIE Lab -> sRGB, and the D50 is the part that is easy to get wrong.
 *
 * CSS `lab()` and `lch()` are defined against the **D50** white point, while
 * sRGB is D65 — so the chain is Lab(D50) -> XYZ(D50) -> Bradford-adapt to D65
 * -> linear sRGB -> gamma. Skipping the adaptation gives colours that are
 * plausible and wrong, which is the worst kind here because the answer still
 * looks like a colour.
 *
 * Verified rather than reasoned: `lab(100 0 0)` -> 255,255,255, `lab(0 0 0)` ->
 * 0,0,0, `lab(50 0 0)` -> 119,119,119 (mid grey, as L* 50 must be), and
 * `lab(54.29 80.8 69.89)` -> exactly 255,0,0, which is sRGB red expressed in
 * D50 Lab. That last one exercises the whole chain including the adaptation.
 */
function labToRgb(L, A, B) {
  const e = 216 / 24389, k = 24389 / 27;
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const fx3 = fx ** 3, fz3 = fz ** 3;
  const xr = fx3 > e ? fx3 : (116 * fx - 16) / k;
  const yr = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
  const zr = fz3 > e ? fz3 : (116 * fz - 16) / k;
  // D50 white, from the chromaticity CSS Color 4 names.
  const X = (xr * 0.3457) / 0.3585, Y = yr, Z = (zr * (1 - 0.3457 - 0.3585)) / 0.3585;
  const D50_TO_D65 = [
    [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
    [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
    [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
  ];
  const XYZ_TO_LINEAR = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
  ];
  const d65 = D50_TO_D65.map((r) => r[0] * X + r[1] * Y + r[2] * Z);
  return XYZ_TO_LINEAR.map((r) => r[0] * d65[0] + r[1] * d65[1] + r[2] * d65[2]).map(enc255);
}

/** Polar to cartesian, for the two notations that write an angle. */
const polar = (C, hDeg) => [C * Math.cos((hDeg * Math.PI) / 180), C * Math.sin((hDeg * Math.PI) / 180)];

/**
 * EVERY NOTATION THIS FILE ACCEPTS, WITH ITS PARSER, IN ONE TABLE — because two
 * lists is exactly how this broke.
 *
 * WHAT WAS WRONG. `isColor` named eight function notations and `luminance` could
 * read TWO of them. Measured through the real module: `oklch(0.15 0.02 260)`
 * answered `isColor: true, luminance: null`, and `withContrast` then derived NO
 * `--foreground` and no `--muted-foreground`, so `tokensCss` emitted
 * `--background: oklch(0.15 0.02 260)` on its own. That is the exact failure
 * `withContrast`'s own docstring says it exists to prevent — a near-black page
 * carrying the light theme's near-black ink, a site that renders perfectly and
 * cannot be read — and the null branch's justification ("leaves the pairing as
 * it was, which is the direction that cannot make things worse") is false for a
 * surface that HAS moved: leaving the partner alone there is guaranteed
 * unreadable rather than merely risky.
 *
 * IT WAS REACHABLE BY ORDINARY MODEL OUTPUT, not by an exotic answer. The
 * template's own palette is oklch and `styles.css` tells the model every colour
 * must be, so a designer following the platform's own convention wrote the one
 * notation this could not read. `valueHint` only SUGGESTS `#rrggbb`; nothing
 * gates on it. Six of the eight were blind: `hsl`, `hsla`, `oklch`, `oklab`,
 * `lab`, `lch`.
 *
 * WHY A TABLE AND NOT A SECOND CASE IN `luminance`. The notation exists BECAUSE
 * it has a parser — `FUNC` is built from these keys — so "accepted but
 * unreadable" is not a thing to remember, it is unrepresentable. Adding `hwb`
 * later means adding a parser, or the name simply is not accepted.
 *
 * NARROWING `isColor` INSTEAD WAS THE OTHER OBVIOUS FIX AND IS WRONG: it refuses
 * colours a customer can legitimately ask for, in the notation the platform's
 * own stylesheet is written in, and turns a legibility bug into "we couldn't use
 * that colour" on a perfectly good answer.
 */
const COLOR_FUNCS = Object.freeze({
  rgb: (p) => p.slice(0, 3).map(num255),
  rgba: (p) => p.slice(0, 3).map(num255),
  // A bare number in `hsl()` is the same scale as the percentage, per CSS
  // Color 4 — `hsl(210 33 9)` and `hsl(210 33% 9%)` are one colour.
  hsl: (p) => hslToRgb(p[0].n, p[1].n / 100, p[2].n / 100),
  hsla: (p) => hslToRgb(p[0].n, p[1].n / 100, p[2].n / 100),
  oklch: (p) => oklchToRgb(unit01(p[0]), ref(p[1], 0.4), p[2].n).map((v) => v * 255),
  oklab: (p) => {
    const [L, a, b] = [unit01(p[0]), ref(p[1], 0.4), ref(p[2], 0.4)];
    return oklchToRgb(L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360).map((v) => v * 255);
  },
  // `lab()`'s L is 0..100 and `100%` MEANS 100, so the percentage and the bare
  // number are the same value — unlike every other component here.
  lab: (p) => labToRgb(p[0].n, ref(p[1], 125), ref(p[2], 125)),
  lch: (p) => {
    const [a, b] = polar(ref(p[1], 150), p[2].n);
    return labToRgb(p[0].n, a, b);
  },
});

/** The notations this file reads, so a guard can sweep them without a hand list. */
export const COLOR_NOTATIONS = Object.freeze(Object.keys(COLOR_FUNCS));

// LONGEST NAME FIRST, and it is PROVABLY INERT today — said so rather than
// deleted, because a guard that cannot fire reads as protection that is not
// there. `rgb|rgba` accepts `rgba(…)` only because JS alternation backtracks
// past `rgb` when the `\(` fails against the `a`; removing the sort was
// measured and changes not one answer. It is kept because the property it rests
// on belongs to the regex engine rather than to this file, and the failure it
// would produce — one notation silently unrecognised — is the exact shape this
// whole section exists to make impossible.
const FUNC = new RegExp(
  "^(" + [...COLOR_NOTATIONS].sort((a, b) => b.length - a.length).join("|") + ")\\(\\s*" +
  "(?:" + NUM + ")(?:" + SEP + "(?:" + NUM + ")){2,3}" +
  "\\s*\\)$", "i");

/**
 * The components of a function colour, as written.
 *
 * Only ever reached for a string `FUNC` has already accepted, so the shape is
 * known: three or four numbers with a legal separator between them. Split on the
 * SAME separator set the pattern names, or the two can disagree about what
 * counts as one component.
 */
function componentsOf(s) {
  const open = s.indexOf("("), close = s.lastIndexOf(")");
  if (open < 0 || close <= open) return null;
  return s.slice(open + 1, close).trim().split(/\s*,\s*|\s*\/\s*|\s+/).filter(Boolean)
    .map((t) => ({ n: parseFloat(t), pct: t.endsWith("%") }));
}

/** A function colour as sRGB 0..255, or null if it is not one. */
function funcRgb(s) {
  const m = FUNC.exec(s);
  if (!m) return null;
  const name = m[1].toLowerCase();
  // `Object.hasOwn`, not a truthiness check: `COLOR_FUNCS["constructor"]` is a
  // real function, and this repo has shipped that exact bug twice. Unreachable
  // through `FUNC` — which only matches the eight names — and cheap enough that
  // the next person to hand this a raw string does not have to notice.
  if (!Object.hasOwn(COLOR_FUNCS, name)) return null;
  const p = componentsOf(s);
  if (!p || p.length < 3 || !p.slice(0, 3).every((c) => Number.isFinite(c.n))) return null;
  return COLOR_FUNCS[name](p);
}

/** A hex colour as sRGB 0..255, or null. */
function hexRgb(s) {
  if (!HEX.test(s)) return null;
  let h = s.slice(1);
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  else h = h.slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Is this a colour, or is it CSS?
 *
 * THE WHOLE REASON THIS IS AN ALLOW-LIST AND NOT AN ESCAPE. The value is
 * written into a stylesheet inside the build container, so a value containing
 * `;` or `}` closes the declaration and the rule and appends whatever the model
 * — or a brief that talked it into this — wanted next. Escaping is the wrong
 * tool: there is no correct escape for "arbitrary text in a CSS value", and the
 * set of things a colour can legitimately look like is small enough to list.
 *
 * Named colours are NOT accepted, and that is a deliberate narrowing rather
 * than an oversight: the 148 CSS names are a fixed list that would have to be
 * carried here, and the model is told to answer in hex, which it can always do.
 * `url(`, `var(`, `expression(` and every other function are refused by the
 * same rule that refuses `red` — only the colour functions are named, which
 * is eight spellings of six systems (`rgb`/`rgba` and `hsl`/`hsla` are pairs).
 */
export function isColor(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return false;
  // THE ANCHORS ARE THE GUARD. An earlier draft also refused `;{}<>\\`, `/*` and
  // `//` explicitly, and bounded the length — all three were proved INERT by a
  // mutation sweep, because `^…$` on both patterns already refuses every one of
  // them: `#fc0; } body {…}` is not a hex colour, and `url(…)` is not a
  // function taking two or three numbers. Kept as a comment rather than as
  // code, because a guard that cannot fire reads as protection that is not
  // there, and the next person to touch this needs to know the anchors are
  // load-bearing rather than incidental.
  return HEX.test(s) || FUNC.test(s);
}

/**
 * Is this a length a corner radius can legitimately be?
 *
 * The same discipline as `isColor` and for the same reason — it is written into
 * a stylesheet, so the anchors are the guard and nothing that could close a
 * declaration can match. A bare `0` is legal CSS and is how somebody asks for
 * square corners; everything else carries a unit.
 *
 * NEGATIVES ARE REFUSED. A negative border-radius is invalid CSS anyway, so the
 * browser would drop the declaration and the customer would be told a change
 * had been applied that did nothing — the silent failure this file keeps
 * closing. Refusing says so instead.
 *
 * NO UPPER BOUND, deliberately. `9999px` is not a mistake, it is how you ask
 * for a pill, and a bound big enough to allow it cannot also catch anything
 * meaningful. `calc()` is refused rather than bounded: the derived sizes
 * already wrap this value in one.
 */
const LENGTH = /^(?:0|(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%))$/i;
export function isLength(v) {
  return LENGTH.test(String(v == null ? "" : v).trim());
}

/**
 * A ZERO IS A ZERO, whatever unit it was written in — and this one is
 * measured, not reasoned.
 *
 * The kit's sizes are derived with `calc(var(--radius) ± Npx)`. A BARE `0` makes
 * every one of those a `<number> + <length>`, which CSS says is invalid, so each
 * declaration is dropped and every corner comes out square. `0px` and `0rem` are
 * valid lengths, so `rounded-xl` stays at 4px and `rounded-2xl` at 8px.
 *
 * Rendered side by side: `0` gave button 0 / card 0 / input 0, and `0px` gave
 * 0 / 4 / 0 — the same instruction producing a square site or a half-square one
 * depending on which unit the model happened to pick. "Square corners" means
 * square, so any zero is normalised to the bare form.
 */
export function normalizeLength(v) {
  const s = String(v == null ? "" : v).trim();
  return /^0(?:px|rem|em|%)?$/i.test(s) ? "0" : s;
}

/**
 * Drop a THEME's own corner rules, so an explicit radius can win.
 *
 * 280 OF THE 500 THEMES hard-set `border-radius` on buttons and inputs as real
 * rules rather than through `--radius` — measured, not assumed. On those, "round
 * the corners" moved the cards and left every button square, which is a feature
 * reported as broken rather than as a theme's design.
 *
 * Only ever applied to the theme's own generated CSS, and only when the customer
 * actually asked for a radius: with no override the theme keeps its corners
 * exactly as it does today, so no existing site changes. The custom property
 * itself is untouched — this matches `border-radius`, never `--radius`.
 *
 * WHY CONDITIONAL AND NOT JUST STOP EMITTING THEM, which is the obvious
 * simplification and is wrong. Measured across the 280: only 67 are a zero rule
 * over a zero token, i.e. saying nothing the token does not. The other 213 are
 * deliberate design the token CANNOT express — 91 use `9999px` for pill buttons
 * on a theme whose token is a modest `0.375rem`, and many of the rest are
 * square buttons over slightly-rounded cards (`literary` is `0.125rem` with
 * `border-radius: 0`). Dropping them unconditionally would restyle 213 themes
 * nobody asked to change.
 *
 * THE COST, stated because it is a real one: on a pill-button theme, asking for
 * "rounder corners" makes the buttons LESS round, because everything now obeys
 * the one number the customer gave. Consistency is the promise a single knob
 * makes, and a surviving pill beside a newly-rounded card is the inconsistency.
 */
export function stripThemeRadius(css) {
  return String(css == null ? "" : css)
    .replace(/(^|[;{\s])border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:[^;}]*;?/gi, "$1");
}

/**
 * The patch as it will be WRITTEN — validated under the write rules.
 *
 * One place, so `tokensCss` and the container's "did they ask for a radius?"
 * question cannot disagree about what counts as a valid patch.
 */
export function validForWrite(tokens) {
  return parseTokens(tokens, { allow: WRITABLE, max: MAX_WRITABLE }).tokens;
}

/** Which validator a token's value has to pass. */
export function valueOk(name, v) {
  return SIZES.includes(name) ? isLength(v) : isColor(v);
}

/**
 * What to tell the model a token's value should look like.
 *
 * Derived rather than written into the tool schema by hand, so a token added
 * here cannot end up described as a colour in the one place the model reads.
 */
export function valueHint(name) {
  return SIZES.includes(name)
    ? "a CSS length — 0 for square corners, or e.g. 4px / 0.75rem, up to 9999px for fully rounded"
    : "#rrggbb";
}

/**
 * sRGB relative luminance, from ANY notation `isColor` accepts.
 *
 * THE INVARIANT, and it is the whole point of the table above: every value
 * `isColor` says yes to, this reads. So `null` here means the value was never a
 * colour, never that it was one we happen not to understand — which is what lets
 * `withContrast` treat a readable surface as guaranteed rather than as luck.
 * Asserted by a derived sweep over `COLOR_NOTATIONS` rather than by a hand list,
 * because a hand list is what let six notations go unread for as long as they
 * did.
 *
 * Only used to pick between near-black and near-white text, so precision past a
 * light/dark decision buys nothing — but it is exact for the platform's own
 * palettes anyway, since `oklch` goes back through the function that wrote them.
 */
export function luminance(v) {
  const s = String(v == null ? "" : v).trim();
  const rgb = hexRgb(s) || funcRgb(s);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  const lin = (c) => {
    const x = Math.min(255, Math.max(0, c)) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Give every changed surface a legible partner.
 *
 * THE FAILURE THIS EXISTS FOR IS TOTAL, not cosmetic. A theme's `--foreground`
 * is picked for its own `--background`; change one and not the other and "make
 * the background black" on a light theme paints near-black text on black — a
 * page that renders perfectly and cannot be read. The customer asked for a
 * colour, not for an unreadable site, and they have no way to know they need to
 * ask for the second one.
 *
 * Only fills a partner the caller did NOT set — an explicit pair is the
 * customer's own choice and is left alone, however bad.
 *
 * THE `l == null` BRANCH IS UNREACHABLE THROUGH THE REAL PATH, and it is said so
 * here rather than deleted or pretended to be tested. Everything that gets this
 * far has been through `parseTokens`, which refuses anything `isColor` refuses,
 * and `luminance` now reads every notation `isColor` accepts (see `COLOR_FUNCS`)
 * — so a surface that is present is a surface that can be measured. It is kept
 * for a caller that has not validated, and NOT as a fail-open policy: the old
 * comment here claimed skipping was "the direction that cannot make things
 * worse", which was simply false for a surface, because the surface has already
 * MOVED and its partner has not. That reading is what let six of the eight
 * notations ship an unreadable page. The property that makes it unreachable
 * lives in another function and is asserted directly, so this cannot quietly
 * become live again.
 */
export function withContrast(patch) {
  const out = { ...patch };

  // THE QUIET TEXT FOLLOWS THE GROUND, NOT ITS OWN TOKEN'S NAME — and this is
  // the one derivation that is not a pairing.
  //
  // FOUND BY LOOKING AT A RENDER, which no test in this repo could have done:
  // a dark-teal background under a light theme left `--muted-foreground` as the
  // dark grey the light theme chose, so every line of body copy on the page was
  // almost invisible. It compiled, bundled, published and passed every
  // assertion. Same lesson as the charts that typechecked and rendered grey.
  //
  // `text-muted-foreground` is drawn on the PAGE, not on `--muted`, so it has
  // to follow `--background`. Set BEFORE the pairing loop below, or that loop
  // fills it from `--muted` and the quiet text stops being quiet.
  //
  // Zinc 600 and zinc 400: each clears 4.5:1 against a ground on its own side
  // of the line, which is what "quiet" has to stay while remaining readable.
  //
  // DELIBERATELY THE ONLY THING THE BACKGROUND DRAGS WITH IT. A first attempt
  // also moved `card`, `popover` and `muted` onto the new ground; that is a
  // design decision nobody asked for, and it made `--muted` equal to the page,
  // so every loading skeleton became invisible. A white card on a dark page is
  // a strong contrast, not a bug.
  if ("background" in out && !("muted-foreground" in out)) {
    const ground = luminance(out.background);
    if (ground != null) out["muted-foreground"] = ground > 0.45 ? "#52525b" : "#a1a1aa";
  }

  for (const [surface, fg] of Object.entries(PAIRS)) {
    if (!(surface in out) || fg in out) continue;
    const l = luminance(out[surface]);
    if (l == null) continue;
    // 0.45 rather than 0.5: perceived brightness runs ahead of the linear
    // value, so the crossover that keeps mid greens and yellows on dark text
    // sits a little below the midpoint.
    out[fg] = l > 0.45 ? "#0a0a0a" : "#fafafa";
  }
  return out;
}

/**
 * A model's answer, reduced to the tokens it is allowed to set.
 *
 * DROPS rather than validates, the `parseCart` discipline: an unknown token
 * name and an unparseable colour are both simply not there afterwards, so
 * nothing downstream has to decide what a half-valid patch means. Returns
 * `{tokens, dropped}` — `dropped` exists so a caller can say what it ignored
 * rather than silently doing less than it was asked.
 */
export function parseTokens(input, { allow = ASKABLE, max = MAX_TOKENS } = {}) {
  const out = {}, dropped = [];
  const src = input && typeof input === "object" && !Array.isArray(input) ? input
    : Array.isArray(input) ? Object.fromEntries(input
        .filter((e) => e && typeof e === "object")
        .map((e) => [String(e.token || e.name || ""), e.color || e.value])) : {};
  for (const [rawName, rawVal] of Object.entries(src)) {
    const name = String(rawName || "").trim().toLowerCase().replace(/^--/, "");
    if (!allow.includes(name)) { dropped.push(rawName); continue; }
    const val = String(rawVal == null ? "" : rawVal).trim();
    // PER TOKEN, not one validator for all — `radius` takes a length and every
    // other name takes a colour. One shared check would have refused every
    // radius a customer ever asked for while reporting the token as unknown.
    if (!valueOk(name, val)) { dropped.push(rawName); continue; }
    if (Object.keys(out).length >= max) { dropped.push(rawName); continue; }
    out[name] = SIZES.includes(name) ? normalizeLength(val) : val;
  }
  return { tokens: out, dropped };
}

/**
 * This build's patch, on top of everything earlier builds set.
 *
 * ACCUMULATED, because a revise names only what it is changing: ask for a
 * yellow background today and a blue accent tomorrow, and a replacing merge
 * gives you back the theme's own background. Bounded at `MAX_TOKENS` with the
 * NEW keys kept — the customer's most recent instruction is the one they are
 * looking at the result of.
 */
export function mergeTokens(prior, next) {
  const a = parseTokens(prior).tokens;
  const b = parseTokens(next).tokens;
  const merged = { ...a, ...b };
  const keys = Object.keys(merged);
  if (keys.length <= MAX_TOKENS) return merged;
  // DEDUPED BEFORE THE CAP IS APPLIED, and slicing first was a real loss.
  // `[...Object.keys(b), ...keys]` lists every key the edit named TWICE when it
  // restates one the site already had — once from `b`, once from `merged` — so
  // slicing that list let a duplicate occupy a slot and the Set came out SHORT.
  // Measured through the real module: six stored axes plus an edit restating one
  // and adding one merges to seven, the cap allows six, and it kept FIVE. The
  // customer lost an extra earlier instruction they never asked to change, with
  // nothing reported — precisely the "first instruction being forgotten" failure
  // the paragraph above promises to avoid, arriving through the mechanism meant
  // to prevent it.
  const keep = new Set();
  for (const k of [...Object.keys(b), ...keys]) {
    if (keep.size >= MAX_TOKENS) break;
    keep.add(k);
  }
  return Object.fromEntries(keys.filter((k) => keep.has(k)).map((k) => [k, merged[k]]));
}

/**
 * The CSS, or an empty string.
 *
 * `:root` and `.dark` BOTH, with the same values. The template ships a dark
 * palette and the site can be viewed in either, so patching only `:root` gives
 * a customer a yellow background that is yellow for them and white for half
 * their visitors — a bug reported as "it didn't work" by somebody who is
 * looking at a correctly-patched page in the other mode.
 *
 * Empty for an empty patch rather than `:root {}`, so a site that never asked
 * for one gets a byte-identical stylesheet to the build before this existed.
 */
export function tokensCss(tokens) {
  // The WRITE rules, not the ask rules — this is handed the output of
  // `withContrast`, whose derived partners are not names a designer may ask for.
  const t = validForWrite(tokens);
  const keys = Object.keys(t);
  if (!keys.length) return "";
  const decls = keys.map((k) => "  --" + k + ": " + t[k] + ";").join("\n");
  return "/* site tokens */\n:root {\n" + decls + "\n}\n.dark {\n" + decls + "\n}\n";
}

/** How many pages of one site may carry their own colours. */
export const MAX_PAGE_TOKENS = 12;

/**
 * A ROUTE PATH THAT IS SAFE TO PUT IN A CSS SELECTOR, and that is the whole
 * validation rather than an escape.
 *
 * The value is written into an attribute selector, so a quote or a brace closes
 * the selector and the rule — and there is no correct escape for "arbitrary text
 * in a CSS selector". The set of shapes a route path can take is small enough to
 * list, which is the same reasoning `isColor` lives under one function up: a
 * refusal, never a sanitiser.
 */
export function routeSelectorOk(p) {
  return typeof p === "string" && /^\/[a-z0-9/-]*$/.test(p) && !p.includes("//") && p.length <= 80;
}

/**
 * WHICH PAGE — if any — the designer's colours and typeface are meant for.
 *
 * ONE READING, SHARED BY THE BUILD ROUTE AND THE LOOK EDIT LANE, because the
 * two answering this differently is not a cosmetic drift: `""` means the change
 * is the SITE's, so a lane that reads a named page as "no page" applies a
 * request about the menu page to every page there is. That was live on the build
 * route until 2026-08-21 — `designed.tokensPage` was read at exactly two places
 * and both were the edit lane, so a first build asking for a warmer menu page
 * got a warmer WHOLE SITE, which is the field's own warning pointed the other
 * way and made by us rather than by the model.
 *
 * `routes` IS WHATEVER THAT LANE KNOWS THE SITE'S PAGES TO BE — the plan's page
 * list on a build (the designer has just written it; the source does not exist
 * yet) and the stored source on an edit. Passed in rather than derived here, so
 * this function needs neither.
 *
 * A PAGE THE SITE HAS NOT GOT IS NOT A SCOPE. Refusing it back to `""` is
 * deliberately NOT the safe direction here — it widens the change to the site —
 * but the alternative is worse: a selector for a page no visitor can reach is a
 * change reported as applied that nothing on the site shows, and the customer's
 * colours sit in `_meta` for ever. The caller is expected to say which happened.
 */
export function pageScopeFor(designed, routes) {
  const asked = typeof (designed && designed.tokensPage) === "string" ? designed.tokensPage.trim() : "";
  if (!asked || !routeSelectorOk(asked)) return "";
  return (Array.isArray(routes) ? routes : []).includes(asked) ? asked : "";
}

/**
 * ONE PAGE'S OWN COLOURS.
 *
 * WHY A SELECTOR AND NOT A SECOND STYLESHEET. The tokens are CSS custom
 * properties and a site is one bundle with one stylesheet, so "this page is
 * calmer" is a scope rather than a file: everything inside the stamped element
 * resolves `--background` to the page's value and everything else keeps the
 * site's. `__root.tsx` stamps `data-page` on `<body>`, which is an ancestor of
 * every page on every site whether or not it uses the site frame.
 *
 * `body[…]` RATHER THAN `[…]`, so specificity settles it as well as ordering.
 * An attribute selector alone is (0,1,0) — exactly `:root`'s — and would depend
 * on this block being appended last, which is true today and is one refactor
 * away from not being.
 *
 * TOKENS ONLY, DELIBERATELY. The 17 style axes emit ordinary RULES against
 * global selectors (`.lucide`, `.border-input`, a radius on the button
 * selector), so scoping them means prefixing every selector a theme emits —
 * a much larger change with a much worse failure mode. "Make the booking page
 * calmer" is a colour question, which is what this answers.
 */
export function pageTokensCss(pageTokens) {
  const map = pageTokens && typeof pageTokens === "object" && !Array.isArray(pageTokens) ? pageTokens : {};
  const out = [];
  for (const [path, tokens] of Object.entries(map).slice(0, MAX_PAGE_TOKENS)) {
    if (!routeSelectorOk(path)) continue;
    const t = validForWrite(tokens);
    const keys = Object.keys(t);
    if (!keys.length) continue;
    const decls = keys.map((k) => "  --" + k + ": " + t[k] + ";").join("\n");
    out.push('body[data-page="' + path + '"] {\n' + decls + "\n}");
  }
  return out.length ? "/* page tokens */\n" + out.join("\n") + "\n" : "";
}

/**
 * Plain names for the tokens a customer might have asked about.
 *
 * EVERY ONE HAS TO BE DISTINCT FROM `site-style.mjs`'s, and three were not.
 * The two modules compose two SEPARATE sentences that land in the same note
 * block, so a build changing the border colour and the border weight printed
 * "Changed the borders." twice, about two different things. `primary` and
 * `input` were the same trap one step quieter: "Changed the buttons." beside
 * "Changed the button shape." reads as one sentence said twice.
 *
 * So a colour says it is a colour. Asserted across both modules by a derived
 * test, because the next name added here has no way of knowing what the other
 * list already says.
 */
const SAID = Object.freeze({
  background: "page colour", foreground: "text colour",
  card: "card colour", popover: "menus",
  primary: "button colour", secondary: "secondary buttons",
  accent: "highlights", muted: "quiet areas",
  border: "border colour", input: "input colour", ring: "focus outlines",
  destructive: "delete buttons",
  success: "success labels", warning: "warning labels",
  radius: "corner roundness",
  // THE TEXT ON EACH SURFACE. Every one has to read differently from the
  // surface's own name above and from `site-style.mjs`'s list, or one reply
  // says "Updated the look — card colour, card colour" about two different
  // changes. `foreground` is already "text colour", so these say WHERE.
  "card-foreground": "text on cards",
  "popover-foreground": "text in menus",
  "primary-foreground": "button text",
  "secondary-foreground": "secondary button text",
  "accent-foreground": "text on highlights",
  "muted-foreground": "quiet text",
  "destructive-foreground": "delete button text",
  "success-foreground": "success label text",
  "warning-foreground": "warning label text",
});

/**
 * What a customer calls this token.
 *
 * Exported to mirror `site-style.mjs`'s `saidFor`, so the guard that keeps the
 * two vocabularies apart can read both directly instead of parsing a sentence.
 */
export function saidFor(token) {
  return Object.hasOwn(SAID, token) ? SAID[token] : String(token || "");
}

/**
 * What was changed, and what was asked for and refused, in one sentence.
 *
 * Composed HERE and not in the client, for the reason `contextSentence` and
 * `imageNote` are: `public/chat.js` cannot import this module, so a second copy
 * there is a second thing that can disagree — and the direction it drifts in is
 * claiming a colour change that did not happen.
 *
 * A DROPPED TOKEN IS NAMED. Somebody who asks for a colour we cannot use, and
 * is told nothing, reads the unchanged page as the builder being broken rather
 * than as a request that did not land.
 */
/**
 * The names a designer actually NAMED, kept and refused together — or undefined
 * when it named nothing.
 *
 * WHY THIS EXISTS. The build response reports the ask so that "the model never
 * asked for a colour" and "the model asked and we lost it downstream" stop
 * being the same observation — they need opposite fixes, and telling them apart
 * used to cost a second paid build. The first version reported
 * `Object.keys(tokenAsk)`, where `tokenAsk` is the `{tokens, dropped}` WRAPPER —
 * so the field was the constant `["tokens","dropped"]` on every build ever made,
 * never empty, and therefore unable to say the first of the two things. Measured
 * live 2026-08-20.
 *
 * SAME ARGUMENT SHAPE AS `tokenNote`, deliberately: the call sites sit one line
 * apart, so a helper taking the wrapper instead would be the exact mistake being
 * fixed, one refactor later.
 *
 * KEPT PLUS DROPPED, because a name the parser REFUSED is the strongest evidence
 * the model did ask — that is the case where the customer sees no change and the
 * cause is entirely ours.
 *
 * UNDEFINED RATHER THAN `[]` when nothing was named, so a build that changed no
 * look serialises byte-identically to one from before this field existed.
 */
export function askedNames(kept, dropped) {
  const names = [
    ...Object.keys(kept && typeof kept === "object" ? kept : {}),
    ...(Array.isArray(dropped) ? dropped : []),
  ].map((n) => String(n || "").trim()).filter(Boolean);
  return names.length ? names : undefined;
}

export function tokenNote(applied, dropped) {
  const set = Object.keys(parseTokens(applied).tokens);
  const bad = (Array.isArray(dropped) ? dropped : [])
    .map((d) => String(d || "").trim().toLowerCase().replace(/^--/, ""))
    .filter(Boolean);
  const parts = [];
  if (set.length) {
    const names = set.map((k) => SAID[k] || k);
    parts.push("Changed the " + (names.length === 1 ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names.at(-1)) + ".");
  }
  if (bad.length) {
    parts.push("Couldn\u2019t use the colour" + (bad.length === 1 ? "" : "s") + " for " +
      bad.slice(0, 3).map((k) => SAID[k] || k).join(", ") + " \u2014 ask again with a hex code like #ffcc00.");
  }
  return parts.join(" ");
}
