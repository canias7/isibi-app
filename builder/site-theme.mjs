// What colour a generated site is.
//
// Every site the builder has ever published is the same one: shadcn's new-york
// defaults, `--primary: oklch(0.208 0.042 265.755)`, a near-black with a faint
// blue cast. A barber shop and a wine bar come out identical. Typography already
// varies per site (site-fonts.mjs); this is the other half.
//
// A THEME IS ELEVEN DECISIONS, NOT THIRTY-SEVEN. The template declares 37 tokens
// in `:root` and 36 of them are colours, but they are not 36 free choices — they
// are role PAIRS, every surface carrying a `-foreground` that has to be legible
// on it. So the palette here is a ground, an ink and an accent, and the other 32
// colour tokens are derived. Two things follow, and both are the point:
//
//   1. A derived foreground is legible BY CONSTRUCTION. It is whichever of the
//      theme's own ink and paper actually clears contrast on that surface,
//      measured, not whichever one looked right.
//   2. There is very little to get wrong. A palette written out by hand has 36
//      chances to produce unreadable text; this has four inputs and a function.
//
// THE OTHER TEN ARE NOT COLOURS, and a theme that only moved the palette was the
// gap this file had until they landed: radius · corner shape · type scale ·
// tracking · leading · font weight · density · border weight · icon stroke ·
// shadow. Plus a recommended FONT PAIR, the one axis that already existed —
// `site-fonts.mjs` is wired into `worker.js` and `build-server.mjs` — but was
// chosen independently of the theme, so a bone-paper private-bank palette could
// arrive set in a rounded, friendly geometric.
//
// Which of them are reachable at all was MEASURED against a compiled bundle, not
// assumed; see the note above `TYPE_SCALES`. Six are plain tokens the bundle
// reads at runtime, three need a class override because Tailwind inlines their
// value at build time, and every value in the tables below was read back out of
// a browser before it shipped.
//
// WHAT IS DELIBERATELY NOT THEMED. `destructive` / `success` / `warning` keep
// their conventional hues: red-means-bad is a convention you inherit, not one
// you design, and a brand-tinted "success" green is how a confirmation stops
// reading as one. `chart-1..5` are left alone because nothing importable uses
// them — verified, zero of the 141 chart lib modules and zero of the 1,045 ui
// components reference them; the 145 references are all in demo files the lint
// refuses. And the eight sidebar tokens derive from the main palette rather than
// being chosen, since most business sites never render one.
//
// Pure logic, no I/O, the same shape as site-fonts.mjs — so all of it is tested
// outside the Worker.

/* ------------------------------------------------------------------ colour */

/**
 * OKLCH -> sRGB, so contrast can be MEASURED rather than assumed.
 *
 * The template is Tailwind v4 and every colour in it is already `oklch(L C H)`,
 * which is perceptual: equal steps in L look like equal steps. That is what
 * makes derivation reasonable at all. But WCAG contrast is defined on sRGB
 * relative luminance, and L is NOT that — so a check written on L alone would
 * pass palettes that are genuinely hard to read. This converts properly.
 */
export function oklchToRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  // Gamma-encode, and clamp — an out-of-gamut OKLCH triple is a real
  // possibility at high chroma, and NaN here would silently poison the ratio.
  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  });
}

/** WCAG relative luminance of an OKLCH triple. */
export function luminance([L, C, H]) {
  const [r, g, b] = oklchToRgb(L, C, H);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// A fourth element is ALPHA. Everything the palette derives stays opaque —
// the contrast maths above is defined on opaque colours — but the surface
// treatments below re-emit a handful of tokens translucently, and they need
// the same emitter or the two drift on formatting.
const css = ([L, C, H, A]) =>
  A == null ? `oklch(${+L.toFixed(4)} ${+C.toFixed(4)} ${+H.toFixed(2)})`
            : `oklch(${+L.toFixed(4)} ${+C.toFixed(4)} ${+H.toFixed(2)} / ${+A.toFixed(3)})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * The legible foreground for a surface: the theme's own ink or its own paper,
 * whichever measures better. Never a third colour, so a page stays two-tone.
 */
export function foregroundFor(surface, ink, paper) {
  return contrast(surface, ink) >= contrast(surface, paper) ? ink : paper;
}

/** Perceptual distance in OKLab — what OKLCH exists to make meaningful. */
export function distance(a, b) {
  const lab = ([L, C, H]) => {
    const h = (H * Math.PI) / 180;
    return [L, C * Math.cos(h), C * Math.sin(h)];
  };
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * How far apart a state colour and the brand accent have to be.
 *
 * MEASURED, not chosen: the first ledger render put "Request" in oxblood beside
 * "Cancel" in the stock destructive at a distance of 0.157, and the two solid
 * red fills read as one colour used twice rather than as brand-versus-danger.
 * 0.30 is the smallest step from there that separates them on sight.
 */
export const MIN_STATE_SEPARATION = 0.3;

/**
 * Inside this many degrees, hue is not telling them apart on its own.
 *
 * Measured against the case that prompted it: oxblood at 28 and the stock
 * destructive at 27.3 are 0.7 apart and read as one colour. Amber at 78 is 50
 * away from the same accent and reads as a different thing already, so the
 * threshold sits below that.
 */
export const SAME_LANE_DEGREES = 35;

/**
 * Push a state colour away from the accent without leaving its own hue lane.
 *
 * The hue is the ONE thing that cannot move — red-means-bad is inherited, and a
 * "destructive" shifted to orange to dodge a red brand has stopped saying
 * danger. So the separation is bought in LIGHTNESS, which is also the strongest
 * cue at a glance: an alert that is markedly brighter than the brand reads as an
 * alert even out of the corner of the eye.
 *
 * It only fires when the accent is in the same lane. A blue or green accent
 * leaves every state colour exactly where it was, which is why this is a
 * derivation and not a per-theme override to maintain.
 */
export function hueGap(a, b) {
  const d = Math.abs(a[2] - b[2]) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Move a state colour to a lightness that is legible on THIS theme's paper.
 *
 * The conventional values are tuned for a near-white ground, and they stop
 * working the moment the ground has a value: on bone at L 0.93 the standard red
 * measures 3.98:1 against both the theme's ink and its paper, because it sits
 * between them. That failed in seven of the eight light/dark combinations the
 * moment themes stopped using off-white — caught by the contrast check, and
 * invisible to any amount of looking, since a red chip with white text looks
 * completely fine right up until somebody has to read it.
 *
 * The HUE and CHROMA never move here. Only lightness, and by the smallest step
 * that clears the bar, so the colour still reads as the same red.
 */
export function fitState(state, ink, paper) {
  const [L0, C, H] = state;
  const ok = (c) => contrast(c, foregroundFor(c, ink, paper)) >= 4.6;
  if (ok(state)) return state;
  let best = null;
  for (let L = 0.2; L <= 0.92; L += 0.005) {
    const candidate = [L, C, H];
    if (!ok(candidate)) continue;
    const cost = Math.abs(L - L0);
    if (!best || cost < best.cost) best = { candidate, cost };
  }
  return best ? best.candidate : state;
}

/**
 * The loudest thing on a quiet page must not be the framework's default.
 *
 * FOUND BY RENDERING, not by measuring. Every one of the four new themes passed
 * the contrast check and then came out of the browser with a fire-engine "Cancel"
 * button and a bright emerald confirmation line sitting on bone or warm-stone
 * paper. The accent — the theme's whole identity — was the third loudest colour
 * on its own page, behind two constants nobody chose. That reads as a designer
 * having picked a palette and the framework having supplied the rest, which is
 * precisely the generated-page tell these themes exist to avoid.
 *
 * So chroma is scaled to the theme, while HUE IS NOT TOUCHED. Red still means
 * bad; it simply stops shouting on a set that whispers.
 *
 * The ceiling is the accent's own chroma × `STATE_CHROMA_RATIO`. An alert has to
 * out-signal an ordinary action or it stops being an alert, so it is allowed to
 * be louder than the brand — but proportionally, not absolutely.
 *
 * Two guards:
 *   - It only ever LOWERS. A theme with a loud accent does not license an alert
 *     louder than the conventional one; the constants are the maximum.
 *   - `MIN_STATE_CHROMA` is a floor, because below it a red is a brown and the
 *     meaning is gone. It binds on Atelier, whose accent is near-achromatic —
 *     and it should: on a monochrome page the alert is the only colour there is.
 */
// 1.35 was arrived at in the browser, not reasoned to. 1.6 was the first guess
// and it still produced a fire-engine "Cancel" on Bourse's dark indigo — enough
// headroom that the constant barely moved. At 1.35 the same button is a brick
// red: unmistakably the alert, and unmistakably not the loudest thing on the
// page.
export const STATE_CHROMA_RATIO = 1.35;
export const MIN_STATE_CHROMA = 0.09;

export function temperState(state, accent) {
  const [L, C, H] = state;
  const ceiling = Math.max(MIN_STATE_CHROMA, accent[1] * STATE_CHROMA_RATIO);
  return [L, Math.min(C, ceiling), H];
}

export function separateFromAccent(state, accent, ink, paper) {
  // HUE FIRST. OKLab distance alone conflates "different colour" with "different
  // lightness", so a green at the accent's lightness measured 0.290 and got
  // nudged — a pointless move, since hue had already done the work. Separation
  // is only needed inside the same lane; outside it, nothing to fix.
  if (hueGap(state, accent) >= SAME_LANE_DEGREES) return state;
  if (distance(state, accent) >= MIN_STATE_SEPARATION) return state;
  const [, C, H] = state;
  let best = null;
  // Both directions, because a dark brand wants a bright alert and a bright
  // brand wants a deep one — and only one of the two will still be legible.
  for (const L of Array.from({ length: 121 }, (_, i) => 0.3 + i * 0.005)) {
    const candidate = [L, C, H];
    if (distance(candidate, accent) < MIN_STATE_SEPARATION) continue;
    const fg = foregroundFor(candidate, ink, paper);
    if (contrast(candidate, fg) < 4.6) continue;
    const cost = Math.abs(L - state[0]);
    if (!best || cost < best.cost) best = { candidate, cost };
  }
  // No legible separation available — keep the conventional colour rather than
  // shipping an illegible one. The test reports it instead of it passing quietly.
  return best ? best.candidate : state;
}

/* ------------------------------------------------------------------- themes */

/**
 * Fixed across every theme, on purpose.
 *
 * These say something about STATE, and state is not brand. A tinted "success"
 * stops reading as success, and this platform already decided colour must never
 * be the only carrier of meaning — the 882 chart components are monochrome by
 * rule and assert it in a test.
 */
// The dark values are SOLVED, not picked. `destructive` at the light L of 0.577
// measured 4.24:1 against a near-white ink — under the bar, and invisible to
// anything but a measurement, since a red chip with white text looks fine right
// up until someone has to read it. Dropping L to 0.545 clears it at 4.65:1;
// `success` and `warning` already cleared and are left alone rather than moved
// for symmetry.
const SEMANTIC = {
  light: {
    destructive: [0.577, 0.245, 27.325],
    success: [0.596, 0.145, 156],
    warning: [0.75, 0.16, 78],
  },
  dark: {
    destructive: [0.545, 0.245, 27.325],
    success: [0.596, 0.145, 156],
    warning: [0.75, 0.16, 78],
  },
};

/* --------------------------------------------------- type, density and edge */

/*
 * WHAT IS ACTUALLY THEMEABLE HERE WAS MEASURED, NOT ASSUMED, and the answers
 * split three ways. `elliptical` shipped broken for exactly this reason — a
 * token can be set perfectly and read by nothing.
 *
 *   READ AT RUNTIME, so writing the token is enough:
 *     `--text-*` and their `--text-*--line-height` companions, `--tracking-*`,
 *     `--leading-*`, `--font-sans`, and `--spacing` — which is ONE token that
 *     every padding, gap, margin and width utility multiplies
 *     (`.gap-4{gap:calc(var(--spacing) * 4)}`), so the whole rhythm of a page is
 *     a single number.
 *
 *   INLINED AT BUILD TIME, so only a class override reaches them:
 *     border width (`.border{border-width:1px}` — flatly hardcoded, and
 *     `--default-border-width` appears nowhere in the bundle) and shadow
 *     geometry (`.shadow-md{--tw-shadow:0 4px 6px -1px …}`).
 *
 *   REGISTERED `inherits: false`, which is a third and nastier category:
 *     `--tw-shadow-color` IS a live `var()` inside every shadow utility, but
 *     `@property --tw-shadow-color{syntax:"*";inherits:false}` means a value set
 *     on `:root` styles the root and nothing else — the same trap `corner-shape`
 *     sets. So the tint is baked into the class overrides rather than inherited.
 */

/**
 * How heavy a lucide icon's line is.
 *
 * THE HIGHEST VISIBILITY PER LINE OF CSS IN THE WHOLE FILE. The kit imports
 * lucide in 297 places, so one rule reaches every icon on every page — and a
 * 1.25 icon beside a 2.5 icon is the difference between a jeweller and a
 * hardware shop, on identical markup.
 *
 * Lucide renders `stroke-width` as a PRESENTATION ATTRIBUTE, which a CSS rule
 * outranks — measured, because if it did not the only alternative was passing a
 * prop at all 297 call sites. So the theme wins without the components knowing.
 *
 * SCOPED TO `.lucide`, NOT TO `svg`. Every lucide icon carries that class, and
 * the 882 chart primitives draw their lines with `stroke-width` too — a bare
 * `svg` selector would quietly re-weight every axis, gridline and series on
 * every chart in the kit.
 */
export const ICON_STROKES = {
  fine: { width: "1.25", label: "drawn thin — jeweller, gallery, tailoring" },
  regular: { width: "2", label: "lucide's own weight" },
  heavy: { width: "2.5", label: "bold — trades, workshops, anything hard-wearing" },
};

export function iconCss(stroke) {
  const w = (ICON_STROKES[stroke] ?? ICON_STROKES.regular).width;
  return `.lucide { stroke-width: ${w}; }\n`;
}

/**
 * Letter spacing, per ROLE rather than globally.
 *
 * It is already per-role without any work here, because the kit uses different
 * utilities for different jobs — `tracking-tight` on headings (113 uses) and
 * `tracking-wide`/`wider` on caps and labels. So retuning the ramp moves display
 * type and small caps in OPPOSITE directions from one decision, which is exactly
 * the classic move: a headline set tight above letterspaced small caps.
 */
export const TRACKINGS = {
  neutral: { label: "the ordinary ramp", steps: [-0.05, -0.025, 0, 0.025, 0.05, 0.1] },
  editorial: { label: "display tight, caps wide — the magazine move", steps: [-0.06, -0.032, 0, 0.06, 0.1, 0.16] },
  open: { label: "nothing is tight; everything has air", steps: [-0.02, -0.008, 0.005, 0.04, 0.07, 0.12] },
};

const TRACKING_STEPS = ["tighter", "tight", "normal", "wide", "wider", "widest"];

export function trackingCss(tracking) {
  const { steps } = TRACKINGS[tracking] ?? TRACKINGS.neutral;
  return `:root {\n` + TRACKING_STEPS.map((s, i) => `  --tracking-${s}: ${steps[i]}em;`).join("\n") + `\n}\n`;
}

/**
 * Line height for BODY text — which is not what `typeCss` sets.
 *
 * They look like duplicates and are not. `typeCss` writes
 * `--text-4xl--line-height`, the DEFAULT leading that comes with a size; these
 * are `--leading-*`, what `leading-relaxed` and friends apply, and an explicit
 * one wins over the size's default. The kit uses those 63 times.
 *
 * 1.25 against 1.8 at the same size is two different documents.
 */
export const LEADINGS = {
  tight: { label: "set close — dense, a lot on a screen", steps: [1.15, 1.28, 1.4, 1.5] },
  standard: { label: "the ordinary leading", steps: [1.25, 1.375, 1.5, 1.625] },
  open: { label: "generous — long copy, room to read", steps: [1.35, 1.5, 1.65, 1.8] },
};

const LEADING_STEPS = ["tight", "snug", "normal", "relaxed"];

export function leadingCss(leading) {
  const { steps } = LEADINGS[leading] ?? LEADINGS.standard;
  return `:root {\n` + LEADING_STEPS.map((s, i) => `  --leading-${s}: ${steps[i]};`).join("\n") + `\n}\n`;
}

/**
 * The weight ramp — 925 uses in the kit, the most-consumed axis of the four.
 *
 * A "weight pair" is really the distance between body and emphasis: 300 against
 * 700 is dramatic and editorial, 500 against 500 is uniform and technical, and
 * they are different themes on the SAME family. Which is what makes this cheap —
 * no second font is downloaded.
 *
 * Every face in the shortlist is variable except Instrument Serif, so arbitrary
 * weights are real rather than snapped to the nearest cut. On that one face the
 * ramp collapses toward what it actually ships, which degrades quietly rather
 * than breaking.
 */
export const WEIGHTS = {
  contrast: { label: "thin body, heavy headings — editorial", steps: [200, 300, 400, 600, 800, 850, 900] },
  standard: { label: "the ordinary ramp", steps: [300, 400, 500, 600, 700, 800, 900] },
  uniform: { label: "one weight, near enough — technical, Swiss", steps: [400, 450, 500, 550, 600, 650, 700] },
};

const WEIGHT_STEPS = ["light", "normal", "medium", "semibold", "bold", "extrabold", "black"];

export function weightCss(weight) {
  const { steps } = WEIGHTS[weight] ?? WEIGHTS.standard;
  return `:root {\n` + WEIGHT_STEPS.map((s, i) => `  --font-weight-${s}: ${steps[i]};`).join("\n") + `\n}\n`;
}

/**
 * How much bigger each step of the type scale is than the last.
 *
 * ONLY ABOVE `base`. `xs`, `sm` and `base` stay where Tailwind has them, because
 * those are body-text sizes and shrinking them is an accessibility decision
 * dressed up as a style one. What a theme actually changes is how far the
 * DISPLAY sizes travel: at `compact` a 4xl heading is 2.01rem and at `grand` it
 * is 3.44rem, which is the difference between a dense price list and a gallery.
 */
export const TYPE_SCALES = {
  compact: { ratio: 1.15, label: "close steps — dense, editorial, a lot fits" },
  standard: { ratio: 1.2, label: "the ordinary scale" },
  grand: { ratio: 1.28, label: "far steps — headings carry, space to breathe" },
};

/** Line height as a function of the SIZE, not of the step. */
const leadingFor = (rem) => +Math.max(1.02, Math.min(1.45, 1.55 - 0.16 * rem)).toFixed(3);

const TYPE_STEPS = ["lg", "xl", "2xl", "3xl", "4xl", "5xl"];

export function typeCss(scale) {
  const { ratio } = TYPE_SCALES[scale] ?? TYPE_SCALES.standard;
  const lines = TYPE_STEPS.map((step, i) => {
    const rem = +Math.pow(ratio, i + 1).toFixed(4);
    return `  --text-${step}: ${rem}rem;\n  --text-${step}--line-height: ${leadingFor(rem)};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

/**
 * `--spacing`, the one number every gap, padding, margin and width multiplies.
 *
 * The range is deliberately narrow. Container widths are on their own scale
 * (`--container-*`) and do not move with this, so a page's columns stay put
 * while everything inside them loosens or tightens — past about ±20% that stops
 * reading as density and starts reading as a layout that has come apart.
 */
export const DENSITIES = {
  tight: { spacing: "0.22rem", label: "close — more on a screen, a working tool" },
  standard: { spacing: "0.25rem", label: "the ordinary rhythm" },
  airy: { spacing: "0.29rem", label: "open — fewer things, more room around them" },
};

export function densityCss(density) {
  const d = DENSITIES[density] ?? DENSITIES.standard;
  return `:root { --spacing: ${d.spacing}; }\n`;
}

/**
 * Border weight — a class override, because 1px is hardcoded into the utility.
 *
 * The NUMBERED utilities (`border-2` and friends) are deliberately left alone:
 * a page that asked for two pixels asked for two pixels, and rescaling it would
 * mean a theme silently overruling an explicit choice in the markup.
 */
/*
 * WHOLE PIXELS ONLY, and that was measured rather than assumed. The first draft
 * had `drawn` at 1.5px, which renders as 1px — Chrome floors the USED
 * border-width to a whole CSS pixel and does so at every device pixel ratio, so
 * 1px, 1.25px, 1.5px and 1.75px all come back as 1px. A theme declaring `drawn`
 * would have been `hairline` with extra steps: the same silent no-op the
 * elliptical corner shipped as, found the same way, by reading back what the
 * browser actually did with it.
 */
export const BORDERS = {
  hairline: { width: "1px", label: "1px — the ordinary rule" },
  drawn: { width: "2px", label: "2px — a line you can see was drawn" },
  bold: { width: "3px", label: "3px — the border is part of the design" },
};

// Every unnumbered border utility, with the property each one sets. Listed
// rather than globbed: `.border-2` must not be caught, and neither must
// `.border-transparent`, which is a COLOUR utility whose name starts the same.
const BORDER_SIDES = [
  ["", "border-width"], ["-t", "border-top-width"], ["-r", "border-right-width"],
  ["-b", "border-bottom-width"], ["-l", "border-left-width"],
  ["-x", "border-inline-width"], ["-y", "border-block-width"],
  ["-s", "border-inline-start-width"], ["-e", "border-inline-end-width"],
];

export function borderCss(weight) {
  const w = (BORDERS[weight] ?? BORDERS.hairline).width;
  return BORDER_SIDES.map(([sfx, prop]) => `.border${sfx} { ${prop}: ${w}; }`).join("\n") + "\n";
}

/**
 * Elevation.
 *
 * The COLOUR is `color-mix(… var(--foreground) …)`, so a shadow is the theme's
 * own ink at low opacity rather than neutral black — on warm stone a black
 * shadow reads as dirt. It also means one block covers both modes, since
 * `--foreground` is already whatever the mode made it.
 *
 * `flat` is not "no style". A print-derived design has no elevation at all, and
 * on Vellum or Atelier a drop shadow is the single thing that would make the
 * page look like a web template again.
 */
export const SHADOWS = {
  flat: { label: "none — the page is printed, not stacked" },
  crisp: { label: "short and close — the ordinary elevation" },
  soft: { label: "wide and faint — light from far away" },
  offset: { label: "hard offset blocks — the shadow is drawn, not cast" },
};

/*
 * THE BARE `.shadow` IS IN THIS LIST BECAUSE LEAVING IT OUT BROKE IT. The kit
 * uses `shadow` unsuffixed 22 times — Card is one of them — so a first version
 * covering only `xs…xl` left every card on the framework's default drop shadow
 * while `flat` reported success. Caught by reading the card's own `--tw-shadow`
 * back out of the browser and finding the value nobody had written.
 *
 * Keyed by SUFFIX, with "" meaning the bare utility, so the list is the thing
 * a test can compare against what the component kit actually uses.
 */
export const SHADOW_STEPS = ["xs", "sm", "", "md", "lg", "xl", "2xl"];

const SHADOW_GEOMETRY = {
  crisp: {
    xs: [[0, 1, 2, 0, 5]],
    sm: [[0, 1, 3, 0, 10], [0, 1, 2, -1, 10]],
    "": [[0, 1, 3, 0, 10], [0, 1, 2, -1, 10]],
    md: [[0, 4, 6, -1, 10], [0, 2, 4, -2, 10]],
    lg: [[0, 10, 15, -3, 10], [0, 4, 6, -4, 10]],
    xl: [[0, 20, 25, -5, 10], [0, 8, 10, -6, 10]],
    "2xl": [[0, 25, 50, -12, 14]],
  },
  soft: {
    xs: [[0, 2, 6, -2, 5]],
    sm: [[0, 4, 12, -4, 7]],
    "": [[0, 4, 12, -4, 7]],
    md: [[0, 8, 24, -6, 8]],
    lg: [[0, 16, 40, -10, 9]],
    xl: [[0, 28, 64, -16, 10]],
    "2xl": [[0, 40, 90, -24, 12]],
  },
};

const shadowSel = (step) => `.shadow${step ? "-" + step : ""}`;

/**
 * A SHADOW IS AN ABSENCE OF LIGHT, so it is dark in BOTH modes.
 *
 * The first version mixed against `var(--foreground)` and stopped there, which
 * is right in light mode and inverted in dark: `--foreground` is the near-white
 * ink there, so every card got a white halo at 7-10% and read as glowing rather
 * than raised. Measured — `oklch(0.96 0.004 230 / 0.07)` on Atrium's near-black
 * — and visible in the render once it was looked for. Neither the contrast
 * check nor the presence check could see it: the shadow was there, it was the
 * theme's own colour, and it was the wrong end of the theme.
 *
 * So dark mode anchors on the theme's own PAPER pushed nearly to black, keeping
 * its hue, and carries more alpha — a shadow on a dark surface has to be much
 * darker than it to register at all. Emitted as `.dark .shadow-*`, which outruns
 * the base rule on specificity rather than on source order.
 */
const DARK_SHADOW_ALPHA = 2.6;

// The offset ramp is WHOLE PIXELS, same discipline as the border axis: a hard
// block shadow at a fractional offset antialiases into exactly the soft edge
// the style exists to refuse.
const OFFSET_STEPS = { xs: 2, sm: 2, "": 3, md: 4, lg: 6, xl: 8, "2xl": 10 };

export function shadowCss(style, theme) {
  // OFFSET IS ITS OWN BRANCH, not a geometry row, for two reasons that are both
  // about colour: the block is SOLID `var(--foreground)` — the mix-and-cap path
  // tops out at 60% and a translucent block reads as a misrendered drop shadow —
  // and it is the one style that wants NO dark-mode variant. The ink is already
  // the theme's light-on-dark colour there, and pale blocks on dark paper is
  // what dark-mode brutalism looks like; anchoring it near-black like a cast
  // shadow would make it vanish into the page.
  if (style === "offset") {
    return SHADOW_STEPS.map((s) =>
      `${shadowSel(s)} { --tw-shadow: ${OFFSET_STEPS[s]}px ${OFFSET_STEPS[s]}px 0 0 var(--foreground); }`).join("\n") + "\n";
  }
  const geo = SHADOW_GEOMETRY[style];
  if (!geo) return SHADOW_STEPS.map((s) => `${shadowSel(s)} { --tw-shadow: 0 0 #0000; }`).join("\n") + "\n";

  const rules = (prefix, colour, scale) => SHADOW_STEPS.map((s) => {
    const layers = geo[s].map(([x, y, blur, spread, pct]) =>
      `${x} ${y}px ${blur}px ${spread}px ${colour(Math.min(60, +(pct * scale).toFixed(1)))}`);
    return `${prefix}${shadowSel(s)} { --tw-shadow: ${layers.join(", ")}; }`;
  }).join("\n");

  // Light mode stays a live `var()`, so it tracks whatever the palette makes the
  // ink. Dark mode cannot: there is no token holding "darker than the page".
  const light = rules("", (a) => `color-mix(in oklch, var(--foreground) ${a}%, transparent)`, 1);
  if (!theme?.dark?.paper) return light + "\n";
  const [, C, H] = theme.dark.paper;
  const anchor = [0.04, Math.min(C, 0.02), H];
  const dark = rules(".dark ", (a) => `color-mix(in oklch, ${css(anchor)} ${a}%, transparent)`, DARK_SHADOW_ALPHA);
  return light + "\n" + dark + "\n";
}

/* --------------------------------------------------------------- components */

/**
 * The two component axes — where a theme changes what a component IS, not what
 * colour it wears. They exist because `--radius` is ONE dial: turn it and the
 * cards, buttons and inputs all move together, so every theme built from tokens
 * alone is the same page wearing different paint (measured on the 73-swatch
 * sweep — the owner's exact complaint). The kit builds everything from shared
 * primitives, so restyling the primitives' class hooks reshapes every component
 * that uses them:
 *
 *   - `button.justify-center` + `a.justify-center.whitespace-nowrap` — every
 *     cva button AND the link-buttons pages hand-write. The selector pair is
 *     lifted from the glass surface layer, where it was proven on real pages.
 *   - `.border-input` — every field: input, textarea, native select, the
 *     SelectTrigger. The same hook the glass frosted treatment styles.
 *
 * `inherit`/`standard` mean "the radius axis decides", emit NOTHING, and are
 * what an absent field means — every theme written before these axes existed
 * keeps meaning what it meant.
 */
export const BUTTONS = {
  inherit: { label: "buttons follow the radius axis — the ordinary button" },
  pill: { label: "fully round ends, whatever the cards do" },
  sharp: { label: "square buttons, even where the cards are round" },
};

const BUTTON_SEL = "button.justify-center, a.justify-center.whitespace-nowrap";

export function buttonsCss(style) {
  if (style === "pill") return `${BUTTON_SEL} { border-radius: 9999px; }\n`;
  if (style === "sharp") return `${BUTTON_SEL} { border-radius: 0; }\n`;
  return "";
}

/**
 * DISPLAY — what colour the display type wears. The owner's note after the
 * richer-worlds pass: the themes still read alike because every heading on
 * every theme is set in the same ink. `accent` puts the theme's own colour
 * into the headings; `gradient` runs it across them. Both use a FITTED copy
 * of the accent — the raw accent is tuned to carry white button text, not to
 * BE text on paper, so `displayColor` walks its lightness toward the ink
 * until it clears 4.5:1 against the paper, the same move `fitState` makes
 * for the state colours.
 *
 * The hook is `.font-heading`, the class every display element already
 * carries for the font axis — excluded inside `.bg-primary`, where a heading
 * sits on the accent itself and colouring it accent-on-accent would erase it.
 */
export const DISPLAYS = {
  ink: { label: "headings in the ink — the ordinary page" },
  accent: { label: "headings carry the theme's colour" },
  gradient: { label: "the accent runs across the headings" },
};

export function displayColor(theme, mode) {
  const { paper, ink, accent } = theme[mode];
  let c = [...accent.slice(0, 3)];
  for (let i = 0; i < 40 && contrast(c, paper) < 4.5; i++) c = mix(c, ink, 0.08);
  return c;
}

export function displayCss(theme) {
  const style = theme.display ?? "ink";
  if (style !== "accent" && style !== "gradient") return "";
  const SEL = `.font-heading:not(.bg-primary *)`;
  const tok = (mode) => `--display: ${css(displayColor(theme, mode))};`;
  const tokens = `:root { ${tok("light")} }\n.dark { ${tok("dark")} }\n`;
  if (style === "accent") return tokens + `${SEL} { color: var(--display); }\n`;
  // The gradient's second stop is the fitted colour swung a little around the
  // wheel, fitted AGAIN — a rotation can leave the gamut or the contrast.
  const stop2 = (mode) => {
    const { paper, ink } = theme[mode];
    let c = [...displayColor(theme, mode)];
    c[2] = (c[2] + 40) % 360;
    for (let i = 0; i < 40 && contrast(c, paper) < 4.5; i++) c = mix(c, ink, 0.08);
    return c;
  };
  return tokens +
    `:root { --display-2: ${css(stop2("light"))}; }\n.dark { --display-2: ${css(stop2("dark"))}; }\n` +
    `${SEL} { background-image: linear-gradient(100deg, var(--display), var(--display-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }\n`;
}

/**
 * `underline` keeps the BOTTOM border and only the bottom — the print-form
 * ruled line. The three dropped sides go TRANSPARENT rather than 0-width, so
 * the box does not shrink and nothing reflows; the field's height, focus ring
 * and autofill behaviour are untouched. `filled` is the borderless muted well.
 */
export const INPUTS = {
  standard: { label: "the ordinary bordered field" },
  underline: { label: "a ruled line, not a box — the print form" },
  filled: { label: "a soft filled well with no border" },
};

export function inputsCss(style) {
  if (style === "underline") {
    return `.border-input { border-top-color: transparent; border-left-color: transparent; border-right-color: transparent; background-color: transparent; border-radius: 0; }\n`;
  }
  if (style === "filled") {
    return `.border-input { background-color: var(--muted); border-color: transparent; }\n`;
  }
  return "";
}

/* ----------------------------------------------------------------- surfaces */

/**
 * Whether surfaces are painted solid or as GLASS — frosted, translucent,
 * blurred — and this is the one axis that cannot be a token alone.
 *
 * Three things have to move together or none of them reads:
 *
 *   1. TRANSLUCENT TOKENS. `--background`, `--card`, `--popover` and the
 *      sidebar mirror are re-emitted with alpha AFTER the palette blocks, so
 *      source order wins the way every other override here does. The palette's
 *      own derivation stays opaque — the contrast guarantee is measured on
 *      opaque proxies, and the canvas below is deliberately pinned to the
 *      paper's lightness so the effective surface stays within a hair of the
 *      measured one.
 *   2. BACKDROP BLUR, a class override on `.bg-card`/`.bg-popover`/
 *      `.bg-sidebar` — the same reach-every-user trick as the icon stroke:
 *      Card alone puts `bg-card` on 19 files. `.bg-background` is deliberately
 *      NOT blurred: the page root carries it, and blurring a full-page element
 *      is a GPU tax that visibly washes the canvas. The sticky header already
 *      ships `bg-background/85 backdrop-blur`, so it goes glass for free the
 *      moment the token is translucent.
 *   3. A CANVAS for the blur to prove itself against. Glass over flat white is
 *      invisible — measured the obvious way: without this block the render is
 *      identical to solid. The body gets two or three large radial washes,
 *      DERIVED from the accent (its own hue and two neighbours), pinned near
 *      the paper's lightness so text contrast holds everywhere, and
 *      `background-attachment: fixed` so panels visibly slide over the light
 *      while scrolling.
 *
 * `solid` is the absence of all three, and an absent field means solid — every
 * theme written before this axis existed keeps meaning what it meant.
 */
export const SURFACES = {
  solid: { label: "opaque surfaces — the ordinary card" },
  glass: { label: "frosted translucent panels floating over a soft-lit canvas" },
};

// Measured in the browser, not reasoned to: 10px blur reads as smudge, 24px
// erases the canvas entirely; 16px keeps the washes legible THROUGH the panel,
// which is the whole effect. Saturate lifts what shows through so the glass
// reads lit rather than grey.
const GLASS_BLUR = "20px";
const GLASS_SATURATE = 1.65;
const GLASS_ALPHA = {
  light: { background: 0.42, card: 0.5, popover: 0.85 },
  // Dark glass is a LIGHT film over a dark canvas — the card token becomes the
  // ink at low alpha, not the paper at high, or it reads as solid with extra
  // steps. Popovers stay nearly opaque in both modes: a menu floats over
  // arbitrary content, and legibility there is worth more than the trick.
  dark: { background: 0.66, card: 0.12, popover: 0.88 },
};

export function surfaceCss(theme) {
  const style = theme.surface ?? "solid";
  if (style !== "glass") return "";
  const tokens = (mode) => {
    const { paper, ink } = theme[mode];
    const a = GLASS_ALPHA[mode];
    const film = mode === "light"
      // Light glass: the paper itself, lifted toward white, mostly clear.
      ? [Math.min(0.995, paper[0] + 0.02), paper[1] * 0.5, paper[2], a.card]
      // Dark glass: the ink as a thin bright film.
      : [ink[0], Math.min(ink[1], 0.02), ink[2], a.card];
    const popover = mode === "light"
      ? [Math.min(0.995, paper[0] + 0.02), paper[1] * 0.5, paper[2], a.popover]
      : [...mix(paper, ink, 0.08).slice(0, 3), a.popover];
    return [
      `  --background: ${css([...paper.slice(0, 3), a.background])};`,
      `  --card: ${css(film)};`,
      `  --popover: ${css(popover)};`,
      `  --sidebar: ${css(film)};`,
    ].join("\n");
  };
  // The EDGE is what makes a panel read as glass rather than as a grey card:
  // a catch-light border brighter than the fill, and a sheen falling from the
  // top corner. Scoped to the SURFACE utilities, so a card's own edge lights
  // up while the dividers inside it (border-border on other elements) keep
  // the ink-mix hairline and stay visible.
  const filter = `backdrop-filter: blur(${GLASS_BLUR}) saturate(${GLASS_SATURATE}); -webkit-backdrop-filter: blur(${GLASS_BLUR}) saturate(${GLASS_SATURATE});`;
  const SURF = ".bg-card, .bg-popover, .bg-sidebar";
  // THE GLASS COMPONENT TREATMENT — what stays here after the buttons/inputs
  // axes were generalised out (the pill rule moved to `buttonsCss`; glass now
  // DECLARES `buttons: "pill"` like any other theme). What remains is the part
  // only a glass surface wants:
  //   - `.bg-primary`: a top sheen and an accent glow, so the one filled
  //     element reads lit like the panels around it.
  //   - `.border-input`: the FROSTED field — translucent white fill, light
  //     edge, its own blur. Deliberately still here rather than an `inputs`
  //     option: it depends on the canvas behind it to read as glass at all.
  const [aL, aC, aH] = theme.light.accent;
  const [dL, dC, dH] = theme.dark.accent;
  const components =
    `.bg-primary { background-image: linear-gradient(180deg, oklch(1 0 0 / 0.28), oklch(1 0 0 / 0) 55%); box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.35), 0 8px 22px -10px oklch(${aL} ${aC} ${aH} / 0.55); }\n` +
    `.dark .bg-primary { box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.3), 0 8px 26px -10px oklch(${dL} ${dC} ${dH} / 0.6); }\n` +
    `.border-input { background-color: oklch(1 0 0 / 0.45); border-color: oklch(1 0 0 / 0.55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }\n` +
    `.dark .border-input { background-color: oklch(1 0 0 / 0.07); border-color: oklch(1 0 0 / 0.15); }\n` +
    `.bg-muted\\/30, .bg-muted\\/40, .bg-muted\\/50, .bg-muted\\/60 { background-color: transparent; }\n`;
  return `:root {\n${tokens("light")}\n}\n.dark {\n${tokens("dark")}\n}\n` +
    `${SURF} { ${filter} border-color: oklch(1 0 0 / 0.6); background-image: linear-gradient(165deg, oklch(1 0 0 / 0.5), oklch(1 0 0 / 0) 42%); }\n` +
    `.dark ${SURF.split(", ").join(", .dark ")} { border-color: oklch(1 0 0 / 0.16); background-image: linear-gradient(165deg, oklch(1 0 0 / 0.1), oklch(1 0 0 / 0) 45%); }\n` +
    components;
  // The CANVAS moved out of this function on 2026-08-01: it became the
  // `aurora` option of the backdrop axis, because a lit world behind the page
  // turned out to be what EVERY theme was missing, not a private feature of
  // glass. Glass now declares `backdrop: "aurora"` like any other theme.
}

/* -------------------------------------------------------------------- world */

/**
 * THE WORLD BEHIND THE PAGE — the two axes the 2026-08-01 redesign added,
 * after the owner put a Liquid Glass screenshot next to the 500-theme sweep
 * and said they all look the same. They did, and the diagnosis was exact:
 * tokens and axes control the panels, and personality lives BEHIND them —
 * backdrop, texture, light. Apple's look is 10% palette and 90% material.
 *
 * `backdrop` paints the body: fields and washes and pools of light, DERIVED
 * from the theme's own accent like everything else. `decor` lays texture into
 * the paper: grain, stripes, grid, halftone. Both are optional — absent means
 * plain/none, so every theme written before these axes keeps meaning what it
 * meant — and both are data, so retrofitting the library is two fields per
 * theme, not a rewrite.
 *
 * THE LEGIBILITY DEAL. A backdrop may be bold ONLY because the things that
 * carry text sit on measured surfaces above it: cards are opaque tokens, and
 * every band utility (`bg-muted/30` …) DISSOLVES to transparent when a
 * backdrop is present — the page is one continuous world, sections separated
 * by spacing rather than tone (the owner rejected the veiled slabs on sight). On top of that, light-
 * mode backdrop stops keep their lightness ≥ 0.70 and dark-mode stops ≤ 0.55 —
 * asserted, not hoped — so even text sitting directly on the page stays
 * readable over the loudest corner of any wash.
 */
export const BACKDROPS = {
  plain: { label: "nothing behind the page — the ordinary ground" },
  wash: { label: "one broad soft field of the accent's light" },
  aurora: { label: "drifting colour washes — the glass canvas, for any surface" },
  field: { label: "a committed colour field falling from the top edge" },
  horizon: { label: "a deep band across the top, sky over ground" },
  glow: { label: "pools of lamplight in a dim room — for dark-native themes" },
};

export const DECORS = {
  none: { label: "plain paper" },
  grain: { label: "paper tooth — a fine photographic grain" },
  stripes: { label: "awning stripes on the diagonal" },
  check: { label: "gingham — two directions of soft stripe" },
  grid: { label: "drafting grid — the graph-paper field" },
  dots: { label: "halftone dots, quiet and even" },
  scanlines: { label: "hairline scanlines — broadcast paper" },
  weave: { label: "a diagonal cross-hatch weave" },
  wood: { label: "planked wood — seams and long grain" },
  paper: { label: "laid paper — pulp mottle and fibre fleck" },
  linen: { label: "woven linen — threads and slubs" },
  canvas: { label: "coarse canvas — heavy weave, real tooth" },
  plaster: { label: "troweled plaster — soft mottle, no lines" },
  concrete: { label: "cast concrete — mottle, pits, shutter seams" },
  marble: { label: "veined stone — clouds and bent filaments" },
  leather: { label: "pebbled leather — creases and burnish" },
  felt: { label: "pressed wool felt — dense fibre depth" },
  brushed: { label: "brushed metal — level drag marks and sheen" },
  spots: { label: "scattered confetti points" },
  rays: { label: "faint rays from the top of the page" },
};

// Light stops stay HIGH and dark stops stay LOW — the numeric half of the
// legibility deal above, applied at the derivation so no option can forget it.
const bL = (mode, v) => (mode === "light" ? Math.max(v, 0.7) : Math.min(v, 0.55));

const BACKDROP_LAYERS = {
  wash: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    // ONE hue family, deliberately (owner's call, 2026-08-01): the rotated
    // blooms put a violet patch on every red theme and read as three colours
    // fighting. Tone-on-tone now — same hue, different depths.
    const a = mode === "light" ? [bL(mode, 0.8), 0.22, H, 1] : [bL(mode, 0.33), 0.15, H, 0.7];
    const b = mode === "light" ? [bL(mode, 0.85), 0.14, (H + 12) % 360, 0.8] : [bL(mode, 0.3), 0.12, (H + 12) % 360, 0.5];
    const c = mode === "light" ? [bL(mode, 0.87), 0.1, (H + 350) % 360, 0.6] : [bL(mode, 0.28), 0.1, (H + 350) % 360, 0.35];
    return [
      `radial-gradient(110rem circle at 50% -14%, ${css(a)}, transparent 72%)`,
      `radial-gradient(80rem circle at 92% 108%, ${css(b)}, transparent 70%)`,
      `radial-gradient(70rem circle at 4% 78%, ${css(c)}, transparent 68%)`,
    ];
  },
  /**
   * The AURORA — four saturated washes derived from the accent's hue and its
   * neighbours, covering the whole viewport so no region falls back to bare
   * paper. Born as the glass canvas; generalised here when the redesign made
   * a lit world every theme's right rather than glass's private feature.
   * Bolder than the first glass shipped: chroma and alpha up, lightness still
   * pinned so ink over a wash stays measured-legible.
   *
   * THE ONE POLY-HUE EXCEPTION: when the backdrops went tone-on-tone
   * (owner's call), aurora kept its neighbouring hues — a rainbow canvas is
   * the option's whole identity, and glass shipped wearing it.
   */
  aurora: (theme, mode) => {
    const H = theme[mode].accent[2];
    const hues = [(H + 300) % 360, H, (H + 35) % 360, (H + 250) % 360];
    const Ls = mode === "light" ? [0.8, 0.79, 0.83, 0.84] : [0.36, 0.32, 0.34, 0.31];
    const Cs = mode === "light" ? [0.22, 0.24, 0.2, 0.18] : [0.17, 0.18, 0.16, 0.15];
    // Dark auroras are GLOWS in a dark room, not floodlights — at light-mode
    // alphas the paper never reads as black and the page goes murky.
    const As = mode === "light" ? [1, 0.95, 0.9, 0.8] : [0.58, 0.5, 0.46, 0.38];
    const at = [["60rem", "8%", "4%"], ["66rem", "94%", "14%"], ["58rem", "78%", "72%"], ["62rem", "12%", "92%"]];
    return hues.map((h, i) =>
      `radial-gradient(${at[i][0]} circle at ${at[i][1]} ${at[i][2]}, ${css([bL(mode, Ls[i]), Cs[i], h, As[i]])}, transparent 65%)`);
  },
  field: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const top = mode === "light" ? [bL(mode, 0.73), 0.24, H, 1] : [bL(mode, 0.34), 0.18, H, 1];
    const mid = mode === "light" ? [bL(mode, 0.85), 0.13, (H + 12) % 360, 0.75] : [bL(mode, 0.27), 0.11, (H + 12) % 360, 0.55];
    const low = mode === "light" ? [bL(mode, 0.87), 0.1, (H + 352) % 360, 0.6] : [bL(mode, 0.24), 0.1, (H + 352) % 360, 0.45];
    return [
      `linear-gradient(180deg, ${css(top)}, transparent 58%)`,
      `radial-gradient(70rem circle at 88% 30%, ${css(mid)}, transparent 68%)`,
      `radial-gradient(90rem circle at 12% 102%, ${css(low)}, transparent 70%)`,
    ];
  },
  horizon: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const sky = mode === "light" ? [bL(mode, 0.72), 0.25, H, 1] : [bL(mode, 0.32), 0.19, H, 1];
    const haze = mode === "light" ? [bL(mode, 0.87), 0.1, H, 0.85] : [bL(mode, 0.24), 0.09, H, 0.6];
    const sun = mode === "light" ? [bL(mode, 0.88), 0.13, (H + 18) % 360, 0.9] : [bL(mode, 0.38), 0.12, (H + 18) % 360, 0.55];
    return [
      `radial-gradient(30rem circle at 72% 12%, ${css(sun)}, transparent 60%)`,
      `linear-gradient(180deg, ${css(sky)} 0%, ${css(sky)} 16%, ${css(haze)} 34%, transparent 54%)`,
    ];
  },
  glow: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const warm = (h, L, C, A) => [bL(mode, L), C, h, A];
    const pools = mode === "light"
      ? [warm(H, 0.8, 0.18, 1), warm((H + 14) % 360, 0.84, 0.14, 0.85), warm((H + 348) % 360, 0.83, 0.14, 0.7)]
      : [warm(H, 0.42, 0.16, 0.85), warm((H + 14) % 360, 0.36, 0.14, 0.65), warm((H + 348) % 360, 0.32, 0.13, 0.5)];
    const at = [["50rem", "22%", "6%"], ["44rem", "82%", "38%"], ["46rem", "38%", "96%"]];
    return pools.map((p, i) => `radial-gradient(${at[i][0]} circle at ${at[i][1]} ${at[i][2]}, ${css(p)}, transparent 65%)`);
  },
};

// THE MATERIAL ASSEMBLER (2026-08-01, the realism pass generalised). The
// owner's bar is a photograph — a real surface per theme, not "AI slop
// backgrounds". What made wood read as wood was never wood-specific:
// layered turbulence with each layer TINTED to a palette colour (a
// constant-colour matrix keeps only the noise's alpha), SHAPED by a
// transfer table (smooth = mottle and figure, discrete = lines, cells and
// flecks), and where the surface needs it, BENT by a displacement field so
// nothing runs digital-straight. Every material below is this one pipeline
// with different numbers, and every colour still derives from paper/ink,
// so a material always sits in its theme's own family.
const matLayer = ({ type = "fractalNoise", freq, octaves = 3, seed, tint, kind = "table", table, warp }, i) => {
  const [r, g, b] = oklchToRgb(...tint).map((v) => +v.toFixed(3));
  const wire = warp ? [" result='n'", " in='n'", " result='t'", " in='t' result='p'"] : ["", "", "", ""];
  const bend = warp
    ? `<feTurbulence type='fractalNoise' baseFrequency='${warp.freq}' numOctaves='2' seed='${warp.seed}' result='d'/><feDisplacementMap in='p' in2='d' scale='${warp.scale}' xChannelSelector='R' yChannelSelector='G'/>`
    : "";
  return `<filter id='m${i}'><feTurbulence type='${type}' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}'${wire[0]}/><feColorMatrix${wire[1]} type='matrix' values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 1 0 0 0 0'${wire[2]}/><feComponentTransfer${wire[3]}><feFuncA type='${kind}' tableValues='${table}'/></feComponentTransfer>${bend}</filter>`;
};
const matSvg = (size, layers) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${layers.map(matLayer).join("")}${layers.map((_, i) => `<rect width='${size}' height='${size}' filter='url(%23m${i})'/>`).join("")}</svg>")`;
// Darker-than-paper in both modes: light mode mixes toward ink, dark mode
// drops paper's own lightness — its ink is LIGHT, so mixing toward it can
// only lighten. The wood-seam lesson, shared by every material shadow.
const deepen = (paper, ink, mode, t) => mode === "light"
  ? mix(paper, ink, t).slice(0, 3)
  : [Math.max(paper[0] * (1 - t * 0.8), 0.04), Math.min(paper[1] * 1.3, 0.05), paper[2]];

// One texture layer each, colours derived, sizes whole px. Repeating
// gradients tile themselves; only the dot fields need an explicit tile size.
const DECOR_LAYERS = {
  grain: () => ({
    image: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.09'/></feComponentTransfer></filter><rect width='140' height='140' filter='url(%23n)'/></svg>")`,
  }),
  stripes: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const c = css(mode === "light" ? [0.6, 0.13, H, 0.11] : [0.7, 0.13, H, 0.09]);
    return { image: `repeating-linear-gradient(45deg, ${c} 0 12px, transparent 12px 34px)` };
  },
  check: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const c = css(mode === "light" ? [0.6, 0.13, H, 0.085] : [0.7, 0.12, H, 0.08]);
    return { image: `repeating-linear-gradient(0deg, ${c} 0 14px, transparent 14px 42px), repeating-linear-gradient(90deg, ${c} 0 14px, transparent 14px 42px)` };
  },
  grid: (theme, mode) => {
    const { paper, ink } = theme[mode];
    const line = css([...mix(paper, ink, 0.14).slice(0, 3), 0.7]);
    return { image: `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px 26px)` };
  },
  dots: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const c = css(mode === "light" ? [0.55, 0.14, H, 0.2] : [0.72, 0.13, H, 0.17]);
    return { image: `radial-gradient(circle at 9px 9px, ${c} 1.5px, transparent 1.5px)`, size: "22px 22px" };
  },
  scanlines: (theme, mode) => {
    const { paper, ink } = theme[mode];
    const line = css([...mix(paper, ink, 0.5).slice(0, 3), mode === "light" ? 0.08 : 0.1]);
    return { image: `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 4px)` };
  },
  weave: (theme, mode) => {
    const { paper, ink } = theme[mode];
    const c = css([...mix(paper, ink, 0.2).slice(0, 3), 0.22]);
    return { image: `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, ${c} 0 1px, transparent 1px 9px)` };
  },
  wood: (theme, mode) => {
    // The realism pass (owner's call 2026-08-01, a walnut-bark photo as the
    // bar): one grey noise layer read as digital fog. Now the grain is TINTED
    // — feColorMatrix rewrites the noise to a constant palette brown and
    // keeps only its alpha — and comes at two scales like a real board: a
    // broad low-frequency FIGURE (smooth ramp, soft cathedral patches) under
    // fine STREAKS run through a non-monotonic discrete table, which is what
    // turns fog into distinct grain lines. A second turbulence displaces the
    // streaks a few px so no line runs ruler-straight — but the SEAMS stay
    // straight, because boards are milled and it is the grain that wanders.
    // Planks: a four-board tint cycle (boards cut from different trees), and
    // a 1px light bevel beside each seam — light catching the next edge.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    // Darker-than-paper needs different derivations per mode: light mode
    // mixes toward ink, but dark-mode ink is LIGHT, so the shadow tone drops
    // paper's own lightness instead of mixing away from it.
    const shadow = [Math.max(paper[0] * 0.45, 0.04), Math.min(paper[1] * 1.4, 0.05), paper[2]];
    const streaks = light ? mix(paper, ink, 0.75).slice(0, 3) : shadow;
    const figure = light ? mix(paper, ink, 0.5).slice(0, 3) : mix(paper, ink, 0.45).slice(0, 3);
    // Alphas are sized to SURVIVE the opened root: the page composites this
    // under paper at 0.35/0.42, so a whisper here arrives as nothing there
    // (measured on the first render — grain at 0.16 read as fog again).
    // PATCHES is the third scale: broad same-family warmth drift, the job
    // the wash was doing but patchy the way boards age, not a smooth bloom.
    const patches = light ? mix(paper, ink, 0.35).slice(0, 3) : mix(paper, ink, 0.3).slice(0, 3);
    const patTable = light ? "0 0 0.05 0.13" : "0 0 0.06 0.14";
    const figTable = light ? "0 0 0.06 0.15" : "0 0 0.07 0.17";
    const strTable = light ? "0 0.15 0.03 0 0.19 0.05 0 0.12 0 0.22" : "0 0.16 0.04 0 0.2 0.07 0 0.13 0 0.24";
    const grain = matSvg(480, [
      { freq: "0.006 0.0035", octaves: 2, seed: 3, tint: patches, table: patTable },
      { freq: "0.028 0.006", seed: 4, tint: figure, table: figTable },
      { freq: "0.15 0.01", octaves: 4, seed: 11, tint: streaks, kind: "discrete", table: strTable, warp: { freq: "0.006 0.02", seed: 7, scale: 14 } },
    ]);
    const seam = light ? css([...mix(paper, ink, 0.38).slice(0, 3), 0.45]) : css([...shadow, 0.6]);
    const bevel = light ? css([...paper.slice(0, 3), 0.6]) : css([...mix(paper, ink, 0.3).slice(0, 3), 0.35]);
    const seams = `repeating-linear-gradient(90deg, ${seam} 0 2px, ${bevel} 2px 3px, transparent 3px 148px)`;
    const tone = mix(paper, ink, light ? 0.16 : 0.12).slice(0, 3);
    const [a1, a2, a3, a4] = light ? [0.16, 0.34, 0.05, 0.24] : [0.12, 0.26, 0.04, 0.19];
    const boards = `repeating-linear-gradient(90deg, ${css([...tone, a1])} 0 148px, ${css([...tone, a2])} 148px 296px, ${css([...tone, a3])} 296px 444px, ${css([...tone, a4])} 444px 592px)`;
    return { image: `${seams}, ${grain}, ${boards}` };
  },
  // Material alphas below are CALIBRATED, not guessed: the first draft used
  // wood's whisper numbers and every tile came back blank — wood only reads
  // because its seam/board gradients carry structure the noise rides on. A
  // noise-only material needs roughly double the peak alpha to survive the
  // opened root (scratchpad mat-cal harness, 2026-08-01).
  paper: (theme, mode) => {
    // Laid paper: soft pulp mottle under a fine fleck of pressed fibre — the
    // ground for print-world themes, felt more than seen.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    const mat = matSvg(420, [
      { freq: "0.008 0.01", seed: 5, tint: mix(paper, ink, 0.38).slice(0, 3), table: light ? "0 0.02 0.09 0.16" : "0 0.02 0.1 0.17" },
      { freq: "0.55 0.55", seed: 9, tint: mix(paper, ink, 0.7).slice(0, 3), kind: "discrete", table: light ? "0 0.12 0 0.16" : "0 0.13 0 0.17" },
    ]);
    // Laid ribbing — the fine chain-line texture that says handmade sheet
    // rather than copier stock. The signature; the mottle alone was blank.
    const rib = css([...mix(paper, ink, 0.4).slice(0, 3), light ? 0.07 : 0.08]);
    return { image: `repeating-linear-gradient(0deg, ${rib} 0 1px, transparent 1px 4px), ${mat}` };
  },
  linen: (theme, mode) => {
    // Flax cloth: broad tone drift, a thread field in each direction, and
    // displaced SLUBS — the occasional thicker thread is what says woven
    // rather than printed.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    const thread = mix(paper, ink, light ? 0.6 : 0.5).slice(0, 3);
    return { image: matSvg(440, [
      { freq: "0.008 0.006", octaves: 2, seed: 3, tint: mix(paper, ink, 0.38).slice(0, 3), table: light ? "0 0.02 0.1 0.17" : "0 0.02 0.11 0.18" },
      { freq: "0.45 0.02", octaves: 2, seed: 6, tint: thread, kind: "discrete", table: light ? "0 0.12 0 0.17" : "0 0.13 0 0.18" },
      { freq: "0.02 0.45", octaves: 2, seed: 8, tint: thread, kind: "discrete", table: light ? "0 0.12 0 0.17" : "0 0.13 0 0.18" },
      { freq: "0.09 0.005", seed: 12, tint: mix(paper, ink, light ? 0.62 : 0.52).slice(0, 3), kind: "discrete", table: "0 0 0 0 0 0 0.12 0 0.16 0.2", warp: { freq: "0.01 0.02", seed: 4, scale: 10 } },
    ]) };
  },
  canvas: (theme, mode) => {
    // Linen's coarse cousin: heavier threads, stronger slub, more tooth.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    const thread = mix(paper, ink, light ? 0.56 : 0.5).slice(0, 3);
    return { image: matSvg(440, [
      { freq: "0.009 0.007", octaves: 2, seed: 5, tint: mix(paper, ink, 0.4).slice(0, 3), table: light ? "0 0.03 0.12 0.2" : "0 0.03 0.13 0.21" },
      { freq: "0.22 0.015", octaves: 2, seed: 7, tint: thread, kind: "discrete", table: light ? "0 0.12 0 0.16" : "0 0.13 0 0.17" },
      { freq: "0.015 0.22", octaves: 2, seed: 9, tint: thread, kind: "discrete", table: light ? "0 0.12 0 0.16" : "0 0.13 0 0.17" },
      { freq: "0.07 0.006", seed: 13, tint: mix(paper, ink, light ? 0.66 : 0.56).slice(0, 3), kind: "discrete", table: "0 0 0 0 0 0 0.14 0 0.18 0.22", warp: { freq: "0.012 0.02", seed: 6, scale: 12 } },
    ]) };
  },
  plaster: (theme, mode) => {
    // Troweled plaster: two scales of soft mottle and a whisper of sand —
    // no lines anywhere, which is exactly what a trowel leaves.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    return { image: matSvg(690, [
      { freq: "0.006 0.007", seed: 4, tint: mix(paper, ink, 0.42).slice(0, 3), table: light ? "0 0.06 0.18 0.3" : "0 0.06 0.19 0.31" },
      { freq: "0.03 0.035", seed: 7, tint: mix(paper, ink, 0.45).slice(0, 3), table: "0 0 0.12 0.2" },
      { freq: "0.4 0.4", octaves: 2, seed: 11, tint: mix(paper, ink, 0.55).slice(0, 3), kind: "discrete", table: "0 0.09 0 0.12" },
    ]) };
  },
  concrete: (theme, mode) => {
    // Cast concrete: plaster's mottle plus dark PITS and the shutter-board
    // seams the pour was formed against — straight like the wood seams, and
    // for the same reason: the formwork is milled, the surface is not.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    const pit = deepen(paper, ink, mode, 0.55);
    const mat = matSvg(690, [
      { freq: "0.006 0.007", seed: 6, tint: mix(paper, ink, 0.42).slice(0, 3), table: light ? "0 0.06 0.18 0.3" : "0 0.06 0.19 0.31" },
      { freq: "0.035 0.04", seed: 9, tint: mix(paper, ink, 0.42).slice(0, 3), table: "0 0 0.12 0.2" },
      { freq: "0.3 0.3", octaves: 2, seed: 13, tint: pit, kind: "discrete", table: "0 0 0 0 0 0 0 0.16 0.2 0.24" },
    ]);
    const seam = css([...mix(paper, ink, 0.3).slice(0, 3), light ? 0.5 : 0.55]);
    return { image: `repeating-linear-gradient(90deg, ${seam} 0 2px, transparent 2px 260px), ${mat}` };
  },
  marble: (theme, mode) => {
    // Veined stone: soft clouds under a connected vein web. The veins live
    // at the ZERO-CROSSINGS of ridged turbulence — |noise| runs to zero
    // along connected creases, so firing the LOW bins draws a branching
    // crack network, where firing the tails of fractal noise drew
    // disconnected worms (measured on the calibration sheet). A gentle
    // warp then bends the web. In dark mode the veins run LIGHT, the way
    // dark marble actually figures. The tile is LARGE (840) because broad
    // veining shows its repeat seam — a vein cut off mid-stroke reads as an
    // artifact where fine texture hides its own tiling.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    return { image: matSvg(840, [
      { freq: "0.009 0.011", seed: 5, tint: mix(paper, ink, 0.36).slice(0, 3), table: light ? "0 0.02 0.1 0.17" : "0 0.02 0.11 0.18" },
      { type: "turbulence", freq: "0.014 0.03", seed: 9, tint: mix(paper, ink, light ? 0.55 : 0.6).slice(0, 3), kind: "discrete", table: "0.26 0.18 0 0 0 0 0 0 0 0", warp: { freq: "0.008 0.012", seed: 6, scale: 30 } },
    ]) };
  },
  leather: (theme, mode) => {
    // Pebbled hide: ridged turbulence (not fractal fog) posterised into
    // cells reads as grain creases; broad patches carry the burnish.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    const crease = deepen(paper, ink, mode, 0.5);
    return { image: matSvg(440, [
      { freq: "0.006 0.006", octaves: 2, seed: 3, tint: mix(paper, ink, 0.4).slice(0, 3), table: light ? "0 0.03 0.11 0.19" : "0 0.03 0.12 0.2" },
      { type: "turbulence", freq: "0.085 0.085", octaves: 4, seed: 8, tint: crease, kind: "discrete", table: light ? "0 0.28 0 0.07 0.22 0 0.14 0 0.3 0" : "0 0.3 0 0.08 0.23 0 0.15 0 0.32 0" },
    ]) };
  },
  felt: (theme, mode) => {
    // Pressed wool: dense fine fibre over soft tone — no structure at all,
    // just depth, which is what makes it felt and not paper.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    return { image: matSvg(400, [
      { freq: "0.008 0.008", octaves: 2, seed: 5, tint: mix(paper, ink, 0.38).slice(0, 3), table: light ? "0 0.02 0.09 0.16" : "0 0.02 0.1 0.17" },
      { freq: "0.6 0.6", seed: 7, tint: mix(paper, ink, 0.6).slice(0, 3), kind: "discrete", table: light ? "0 0.13 0.06 0.18" : "0 0.14 0.06 0.19" },
      { freq: "0.3 0.3", octaves: 2, seed: 11, tint: mix(paper, ink, 0.42).slice(0, 3), table: "0 0 0.07 0.11" },
    ]) };
  },
  brushed: (theme, mode) => {
    // Brushed metal: extreme horizontal anisotropy — hairline drag marks
    // under two broad sheen bands. The one material whose grain runs level.
    const { paper, ink } = theme[mode];
    const light = mode === "light";
    return { image: matSvg(460, [
      { freq: "0.003 0.06", octaves: 2, seed: 9, tint: mix(paper, ink, 0.32).slice(0, 3), table: light ? "0 0.02 0.09 0.16" : "0 0.02 0.1 0.18" },
      // Dark drag marks are HALVED: light hairlines on a dark ground at 2px
      // spacing read as CRT scanlines, not metal (calibration sheet).
      { freq: "0.003 0.55", octaves: 2, seed: 6, tint: mix(paper, ink, light ? 0.6 : 0.42).slice(0, 3), kind: "discrete", table: light ? "0 0.13 0.06 0.19" : "0 0.07 0.03 0.1" },
    ]) };
  },
  spots: (theme, mode) => {
    // A TILE, not five absolute dots — percentage positions with no size put
    // five specks on the whole page (measured: invisible). The confetti
    // repeats on a 260px cell, offsets chosen so the tiling reads scattered.
    const [, , H] = theme[mode].accent;
    const dot = (h, x, y, r, A) => {
      const c = css(mode === "light" ? [0.62, 0.15, h, A] : [0.7, 0.14, h, A * 0.9]);
      return `radial-gradient(circle at ${x} ${y}, ${c} ${r}, transparent ${r})`;
    };
    return {
      image: [
        dot(H, "31px 47px", "6px", 0.6), dot((H + 120) % 360, "203px 23px", "5px", 0.55),
        dot((H + 60) % 360, "239px 161px", "6px", 0.5), dot((H + 200) % 360, "57px 213px", "5px", 0.55),
        dot((H + 300) % 360, "143px 99px", "4px", 0.45),
      ].join(", "),
      size: "260px 260px",
    };
  },
  rays: (theme, mode) => {
    const [, , H] = theme[mode].accent;
    const c = css(mode === "light" ? [0.7, 0.12, H, 0.09] : [0.6, 0.12, H, 0.1]);
    return { image: `conic-gradient(from 172deg at 50% -8%, ${c} 0 9deg, transparent 9deg 24deg, ${c} 24deg 33deg, transparent 33deg 48deg, ${c} 48deg 57deg, transparent 57deg 72deg, ${c} 72deg 81deg, transparent 81deg 96deg, ${c} 96deg 105deg, transparent 105deg 360deg)` };
  },
};

/**
 * The body paint for a theme's backdrop + decor, plus the band veils.
 *
 * ONE body rule per mode, never two: decor and backdrop are layers of the same
 * `background-image` stack (decor first, so texture reads over the washes),
 * with per-layer attachment — decor scrolls with the page, backdrops stay
 * fixed so panels slide over the light, the move the glass canvas proved.
 *
 * The veils are emitted for any non-plain backdrop on a SOLID surface; glass
 * already carries its own. Without them a `bg-muted/30` band is 70% window
 * onto the loudest part of the wash, with band text sitting straight on it.
 */
// A GROUND decor paints the whole page — a material, not a whisper of
// texture — so it triggers everything a backdrop triggers: the root opens
// WIDE, the bands dissolve, and muted text is refit. Measured before this
// existed (2026-08-01): decor-only wood sat behind the 0.85 "barely open"
// veil and the realism pass was invisible — the veil that is right for a
// paper-grain whisper crushes a texture that is meant to BE the background.
// Exported for the tests and for the assignment tooling.
export const GROUND_DECORS = new Set([
  "wood", "paper", "linen", "canvas", "plaster", "concrete", "marble", "leather", "felt", "brushed",
]);

export function worldCss(theme) {
  const backdrop = theme.backdrop ?? "plain";
  const decor = theme.decor ?? "none";
  if (backdrop === "plain" && decor === "none") return "";
  const rule = (mode) => {
    const layers = [], sizes = [], attach = [];
    const d = decor !== "none" && DECOR_LAYERS[decor] ? DECOR_LAYERS[decor](theme, mode) : null;
    if (d) { layers.push(d.image); sizes.push(d.size ?? "auto"); attach.push("scroll"); }
    const bs = backdrop !== "plain" && BACKDROP_LAYERS[backdrop] ? BACKDROP_LAYERS[backdrop](theme, mode) : [];
    for (const b of bs) { layers.push(b); sizes.push("auto"); attach.push("fixed"); }
    if (!layers.length) return "";
    const sel = mode === "light" ? "body" : ".dark body";
    return `${sel} { background-image: ${layers.join(", ")}; background-size: ${sizes.join(", ")}; background-attachment: ${attach.join(", ")}; }\n`;
  };
  const grounded = backdrop !== "plain" || GROUND_DECORS.has(decor);
  return openRootCss(theme, grounded) + rule("light") + rule("dark") +
    (grounded ? worldMutedCss(theme) + bandClearCss(theme) : "");
}

/**
 * SMALL TEXT OVER THE WORLD — the owner's catch after the first world sheets
 * (2026-08-01): secondary text sits directly on the page in heroes and
 * footnotes, and the page is no longer paper — it is paper at 35% over a
 * wash whose stops may sit at the L 0.70 floor. `muted-foreground` was
 * derived against the PAPER, so over the deepest corner of a rich backdrop
 * it dropped to ~3:1.
 *
 * The fix is the same move the palette always makes, aimed at the right
 * ground: build the WORST surface a backdrop is allowed to produce — the
 * floor-deep, chroma-maxed stop composited under the opened root, in real
 * sRGB the way the browser will actually blend it — and walk the muted ink
 * toward the full ink until it clears 4.5:1 against THAT. Emitted after the
 * palette blocks, so it wins on source order like every world token.
 * Exported for the tests, which rebuild the blend from public primitives
 * and measure rather than trust.
 */
const lumRgb = ([r, g, b]) => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrastOnRgb = (fgOklch, bgRgb) => {
  const a = lumRgb(oklchToRgb(...fgOklch.slice(0, 3))), b = lumRgb(bgRgb);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};
export function worldWorstGround(theme, mode) {
  const { paper, ink, accent } = theme[mode];
  const rootA = theme.surface === "glass" ? GLASS_ALPHA[mode].background
    : mode === "light" ? 0.35 : 0.42;
  // No backdrop means this fit is running for a GROUND DECOR, whose deepest
  // broad tint is boards of the paper pushed toward ink — there is no
  // accent-chroma stop to compose against, and pretending one would overfit
  // the muted ink against light that never shines.
  const stop = (theme.backdrop ?? "plain") === "plain" ? mix(paper, ink, 0.15).slice(0, 3)
    : mode === "light" ? [0.7, 0.25, accent[2]] : [0.55, 0.19, accent[2]];
  const p = oklchToRgb(...paper.slice(0, 3)), s = oklchToRgb(...stop);
  return p.map((c, i) => c * rootA + s[i] * (1 - rootA));
}
export function worldMutedColor(theme, mode) {
  const { paper, ink } = theme[mode];
  const ground = worldWorstGround(theme, mode);
  let fg = mix(paper, ink, mode === "light" ? 0.62 : 0.66).slice(0, 3);
  for (let i = 0; i < 40 && contrastOnRgb(fg, ground) < 4.5; i++) fg = mix(fg, ink, 0.08);
  return fg;
}
function worldMutedCss(theme) {
  return `:root { --muted-foreground: ${css(worldMutedColor(theme, "light"))}; }\n` +
    `.dark { --muted-foreground: ${css(worldMutedColor(theme, "dark"))}; }\n`;
}

/**
 * THE ROOT MUST OPEN, OR THE WORLD IS PAINTED BEHIND A WALL. Every generated
 * page's root div carries `bg-background`, and on a solid theme that token is
 * opaque — so the first prototype rendered its backdrops invisible: the body
 * was lit and the page sat in front of it like drywall. Measured on the
 * before/after sheet, afters ≈ befores. Glass never hit this because its
 * surface re-emits `--background` translucent; this does the same for any
 * theme with a world, which is why glass (whose surface owns that token)
 * skips it here.
 *
 * A BACKDROP opens the root wide (the wash is the point); decor alone opens
 * it barely (texture wants to be felt through the paper, not to dim it).
 */
function openRootCss(theme, hasBackdrop) {
  if (theme.surface === "glass") return "";
  const A = hasBackdrop ? { light: 0.35, dark: 0.42 } : { light: 0.85, dark: 0.88 };
  const t = (mode) => css([...theme[mode].paper.slice(0, 3), A[mode]]);
  return `:root { --background: ${t("light")}; }\n.dark { --background: ${t("dark")}; }\n`;
}

/**
 * BANDS DISSOLVE UNDER A WORLD. The first pass VEILED them — a translucent
 * white/black sheet under `bg-muted/N` so band text had a surface — and the
 * owner read the result exactly right: the page divided into four visible
 * slabs (2026-08-01, the phone screenshot). The veil was only ever there for
 * text contrast, and `worldMutedCss` now guarantees that against the RAW
 * worst ground — so the bands can simply go transparent and the page becomes
 * one continuous world. Sections separate by spacing and type, not by tone.
 * Skipped for glass, whose surface block clears its own band utilities.
 */
function bandClearCss(theme) {
  if (theme.surface === "glass") return "";
  const BANDS = ".bg-muted\\/30, .bg-muted\\/40, .bg-muted\\/50, .bg-muted\\/60";
  return `${BANDS} { background-color: transparent }\n`;
}

/* ------------------------------------------- motion · edges · skins (2026-08-01) */

/**
 * The second wave of the redesign, ordered by the owner after the worlds
 * landed: AMBIENT (the light moves) and SKIN (what a card is shaped like).
 * Both are optional axes that default to exactly today's rendering, derive
 * from the theme's own palette where they use colour at all, and retrofit
 * through worlds.mjs.
 *
 * AN EDGE AXIS IS DELIBERATELY ABSENT. It was built, rendered and REJECTED
 * by the owner on sight (2026-08-01): wave, angle and torn band edges — SVG
 * masks on the band utilities — all read as decoration fighting the page
 * ("looks ugly", "the separate lines thing"). Recorded rather than silently
 * dropped, because "we forgot it" and "we tried it and the owner killed it"
 * look identical in a list of axis names a year later. Same discipline as
 * the notch/scoop note above CORNERS.
 */
export const AMBIENTS = {
  still: { label: "nothing moves — the ordinary page" },
  drift: { label: "the light drifts, slow as weather" },
  lively: { label: "the light plays — quicker, three blobs, a little scale" },
};

/**
 * An ANIMATED OVERLAY, not an animated backdrop: `body::after`, fixed, z-index
 * -1 — which paints above the body's own background (the world) and below
 * every descendant, so the moving light slides between the backdrop and the
 * page. Transform-only animation (GPU-cheap, never filter or position), and
 * `prefers-reduced-motion` stops it dead — the blobs stay, the motion goes.
 */
export function ambientCss(theme) {
  const style = theme.ambient ?? "still";
  if (style !== "drift" && style !== "lively") return "";
  const n = style === "drift" ? 2 : 3;
  const dur = style === "drift" ? "38s" : "16s";
  const layer = (mode) => {
    const H = theme[mode].accent[2];
    // Same hue family as the world it drifts over — the H+60/H+300 rotations
    // were the violet patches the owner flagged on every warm theme.
    const hues = [H, (H + 18) % 360, (H + 342) % 360].slice(0, n);
    const L = mode === "light" ? 0.84 : 0.36;
    const C = mode === "light" ? 0.16 : 0.14;
    const A = (mode === "light" ? [0.55, 0.4, 0.35] : [0.42, 0.32, 0.26]).slice(0, n);
    const at = [["40rem", "24%", "28%"], ["34rem", "78%", "18%"], ["36rem", "60%", "82%"]];
    return hues.map((h, i) =>
      `radial-gradient(${at[i][0]} circle at ${at[i][1]} ${at[i][2]}, ${css([bL(mode, L), C, h, A[i]])}, transparent 65%)`).join(", ");
  };
  const move = style === "drift"
    ? `from { transform: translate3d(-3%, -2%, 0) rotate(-2deg); } to { transform: translate3d(3%, 2%, 0) rotate(2deg); }`
    : `from { transform: translate3d(-4%, -3%, 0) rotate(-3deg) scale(1); } to { transform: translate3d(4%, 3%, 0) rotate(4deg) scale(1.07); }`;
  return `body::after { content: ""; position: fixed; inset: -22%; z-index: -1; pointer-events: none; background-image: ${layer("light")}; animation: isibi-ambient ${dur} ease-in-out infinite alternate; }\n` +
    `.dark body::after { background-image: ${layer("dark")}; }\n` +
    `@keyframes isibi-ambient { ${move} }\n` +
    `@media (prefers-reduced-motion: reduce) { body::after { animation: none; } }\n`;
}

export const SKINS = {
  flat: { label: "cards as the kit draws them" },
  frame: { label: "a museum mat — a second rule floated round the card" },
  ticket: { label: "punched side notches — the card is a stub" },
  tilt: { label: "cards sit a hair off square, alternating" },
};

/**
 * `.bg-card` is the hook (Card and nothing else — popovers and the sidebar
 * carry their own tokens). `ticket` needs `mask-composite: intersect`: mask
 * layers union by default, and the union of two mostly-black layers is
 * everything — the notches only survive where BOTH layers agree.
 */
export function skinCss(style) {
  if (style === "frame") {
    return `.bg-card { outline: 1px solid var(--border); outline-offset: 5px; }\n`;
  }
  if (style === "ticket") {
    const m = `radial-gradient(0.7rem circle at 0 55%, transparent 98%, black), radial-gradient(0.7rem circle at 100% 55%, transparent 98%, black)`;
    return `.bg-card { -webkit-mask-image: ${m}; mask-image: ${m}; -webkit-mask-composite: source-in; mask-composite: intersect; }\n`;
  }
  if (style === "tilt") {
    return `.bg-card { transform: rotate(-0.5deg); }\n.bg-card:nth-child(even) { transform: rotate(0.55deg); }\n`;
  }
  return "";
}

/* ------------------------------------------------------------------ corners */

/**
 * The corner treatments a theme may ask for.
 *
 * `round` is the only one Tailwind's own classes express. The other two need a
 * little CSS on top, and both were rendered on real buttons, inputs and cards
 * before being offered here.
 *
 * NOTCH AND SCOOP ARE DELIBERATELY ABSENT, and this is the useful half. Both
 * exist, both are supported, and both were rendered — and applied across a
 * component kit they are unusable: the notch cuts through an input's border, a
 * card's edge comes apart at the corner, and an avatar's initials get clipped.
 * They are shapes for one deliberate element, not for every element on a page.
 * Recorded rather than silently omitted, because "we forgot" and "we tried it
 * and it broke" look identical in a list of names a year later.
 */
export const CORNERS = {
  round: { label: "arcs — the ordinary corner" },
  squircle: { label: "a continuous curve — the corner reads as moulded rather than cut out" },
  bevel: { label: "a cut corner rather than an arc — technical, ticketed" },
};

/**
 * The corner CSS for a theme.
 *
 * ONLY `--radius` IS WRITABLE, and that constraint is the whole design of this
 * function. The template declares its radius scale inside `@theme inline`, and
 * `inline` means Tailwind substitutes the value into the utility instead of
 * emitting a variable reference — the compiled bundle contains
 * `.rounded-md{border-radius:calc(var(--radius) - 2px)}` and the string
 * `var(--radius-md)` appears in it NOWHERE. So `--radius-sm/md/lg/xl` can be set
 * to anything at all and no element will read them.
 *
 * THAT KILLED THE `elliptical` TREATMENT, which used to live here. It wrote the
 * four derived steps as `Xpx / Ypx` slash pairs, because the base feeds a
 * `calc()` and a slash pair cannot be subtracted from — so writing the steps
 * directly was the only way to express a lozenge corner. It was implemented,
 * wired into `themeCss`, and covered by three tests, and it was a silent no-op
 * in every browser: measured against a real build, `bourse + elliptical` and
 * `bourse + round` at the same radius both computed to 10px on a button and 16px
 * on a card. The tests asserted the CSS TEXT contained the slash pairs, which
 * was true and meant nothing. Removed rather than patched — the alternative is
 * overriding seven utility classes plus their eight directional variants while
 * leaving `rounded-full` alone, which is fighting the framework for a shape
 * nothing had asked for.
 *
 * `squircle` replaces it and works the way `bevel` does: `corner-shape` is a
 * real box property, so it needs no token the bundle refuses to read.
 *
 * BOTH SHAPES NEED A DESCENDANT SELECTOR, not just the root. `corner-shape` is a
 * box property and box properties do not inherit — set on one element it styles
 * that element and nothing inside it, which renders identically to a plain
 * rounded corner and reads as the browser not supporting it.
 */
export function cornerCss(theme) {
  const style = theme.corner ?? "round";
  const r = theme.radius;
  if (style === "squircle" || style === "bevel") {
    return `:root { --radius: ${r}; }\n` +
      `body, body * { corner-shape: ${style}; }\n`;
  }
  return `:root { --radius: ${r}; }\n`;
}

/**
 * A theme is these values. Everything else in the palette is derived.
 *
 * `dark` is a separate ground/ink/accent rather than an inversion, because
 * inverting is what produces the glowing over-saturated dark modes: a chroma
 * that reads as rich on white reads as neon on black, so the accent's lightness
 * and chroma both have to move.
 */
export const THEMES = {
  /**
   * GLASS — the first of the owner's new set (2026-08-01).
   *
   * Frosted translucent panels over a soft-lit canvas: `surface: "glass"` is
   * the load-bearing line (translucent tokens + backdrop blur + the derived
   * canvas — see `surfaceCss`), and every other axis leans the same way:
   * squircle corners at a full 1rem so the panels read moulded, soft wide
   * shadows because glass floats, airy density, open tracking, and a cool
   * azure accent whose hue also seeds the canvas washes.
   */
  glass: {
    label: "Glass — frosted panels floating over soft colour; airy, luminous, modern",
    radius: "1rem", corner: "squircle",
    scale: "standard", tracking: "open", leading: "standard", weight: "standard",
    density: "airy", border: "hairline", shadow: "soft", icon: "regular",
    surface: "glass", buttons: "pill", backdrop: "aurora",
    fonts: { heading: "outfit", body: "inter" },
    light: { paper: [0.985, 0.004, 285], ink: [0.21, 0.03, 285], accent: [0.5, 0.15, 285] },
    dark: { paper: [0.16, 0.03, 288], ink: [0.95, 0.012, 285], accent: [0.73, 0.14, 285] },
  },

  /**
   * EDITORIAL — the second of the owner's set (2026-08-01).
   *
   * Print, not product: a page from a magazine that happens to be a website.
   * Every axis is the print decision — Playfair over a calm humanist sans,
   * GRAND scale so display type carries, the editorial tracking ramp (display
   * tight, caps letterspaced — the magazine move the ramp is named for),
   * CONTRAST weights (light body, heavy heads), square corners, hairline
   * rules, and FLAT elevation, because print has no drop shadows and one
   * shadow would make it a web template again. Ivory paper, warm ink, and an
   * oxblood accent that sits in red's lane — which is exactly what
   * separateFromAccent exists for, and this theme is what exercises it.
   */
  editorial: {
    label: "Editorial — a printed page that happens to be a website; ivory, serif display, hairline rules",
    radius: "0rem", corner: "round",
    scale: "grand", tracking: "editorial", leading: "open", weight: "contrast",
    density: "airy", border: "hairline", shadow: "flat", icon: "fine",
    buttons: "sharp", inputs: "underline",
    fonts: { heading: "playfair-display", body: "source-sans-3" },
    light: { paper: [0.965, 0.012, 85], ink: [0.19, 0.012, 60], accent: [0.36, 0.11, 28] },
    dark: { paper: [0.165, 0.01, 60], ink: [0.94, 0.012, 85], accent: [0.52, 0.11, 26] },
  },

  // The six that were here before the reset — ledger, atrium, bourse, vellum,
  // coppice, atelier — were removed on the owner's call, with the new set
  // being specified one at a time. They are in git history at 8b6786b if any
  // is wanted back.
  //
  // The ENGINE below and above is untouched, and that is the point of the split:
  // `paletteFor`, `fitState`, `temperState`, `separateFromAccent`, `cornerCss`,
  // `typeCss`, `densityCss`, `borderCss` and `shadowCss` describe how a theme is
  // DERIVED, not which themes exist. Their tests run against a fixture declared
  // in the test file rather than against whatever happens to be shipped, so an
  // empty set leaves the machinery fully covered.
  //
  // What an entry looks like:
  //
  //   name: {
  //     label: "Name — the one-line description the model sees",
  //     radius: "0.25rem",            // any length; `--radius` is the one token
  //     corner: "round",              // round | squircle | bevel
  //     scale: "standard",            // compact | standard | grand
  //     tracking: "neutral",          // neutral | editorial | open
  //     leading: "standard",          // tight | standard | open
  //     weight: "standard",           // contrast | standard | uniform
  //     density: "standard",          // tight | standard | airy
  //     border: "hairline",           // hairline | drawn | bold  (whole px only)
  //     shadow: "crisp",              // flat | crisp | soft | offset
  //     icon: "regular",              // fine | regular | heavy
  //     buttons: "inherit",           // inherit | pill | sharp   (absent = inherit)
  //     inputs: "standard",           // standard | underline | filled  (absent = standard)
  //     display: "ink",               // ink | accent | gradient  (absent = ink)
  //     backdrop: "plain",            // plain | wash | aurora | field | horizon | glow  (absent = plain)
  //     decor: "none",                // none | grain | stripes | check | grid | dots
  //                                   //   | scanlines | weave | wood | spots | rays  (absent = none)
  //     ambient: "still",             // still | drift | lively  (absent = still)
  //     skin: "flat",                 // flat | frame | ticket | tilt  (absent = flat)
  //     fonts: { heading: "<id>", body: "<id>" },   // ids from site-fonts.mjs
  //     light: { paper: [L, C, H], ink: [L, C, H], accent: [L, C, H] },
  //     dark:  { paper: [L, C, H], ink: [L, C, H], accent: [L, C, H] },
  //   }
  //
  // `dark` is a separate ground/ink/accent rather than an inversion, because
  // inverting is what produces the glowing over-saturated dark modes: a chroma
  // that reads as rich on white reads as neon on black, so the accent's lightness
  // and chroma both have to move. And a dark accent stays DEEP with light text
  // rather than being lightened past the paper — lightening measures fine and
  // turns a plum into a candy pink.
};

/** Every token for one mode, derived from that mode's three colours. */
export function paletteFor(theme, mode) {
  const { paper, ink, accent } = theme[mode];
  const fg = (surface) => foregroundFor(surface, ink, paper);
  // State colours are separated from the accent BEFORE anything derives from
  // them, so the foreground is picked for the colour that actually ships.
  const raw = SEMANTIC[mode];
  // TEMPER, THEN FIT, THEN SEPARATE — and the order matters at both joints, for
  // two different reasons.
  //
  // Temper before fit is about FIDELITY, not legibility: chroma changes
  // luminance, so fitting first computes its lightness move against a chroma that
  // the temper then removes. `fitState` promises the SMALLEST step that clears
  // the bar, and the promise is void if the colour it measured is not the colour
  // that ships. Measured across this set the two orders diverge on 9 of 36
  // values; the wrong one overshoots — atelier/light lands at L 0.610 and 5.01:1
  // when L 0.590 already cleared — so the red drifts further from the
  // conventional red than it had to, for nothing.
  //
  // Fit before separate is about legibility: separating picks a lightness, and
  // doing it first lets the fit immediately overwrite that choice.
  const sem = Object.fromEntries(Object.entries(raw)
    .map(([k, v]) => [k, separateFromAccent(fitState(temperState(v, accent), ink, paper), accent, ink, paper)]));

  // Surfaces step AWAY from the paper toward the ink, by small amounts. A card
  // that is a different hue from the page is the thing that reads as "themed"
  // in the bad sense; a card that is the same paper, slightly lifted, reads as
  // paper.
  const card = mix(paper, ink, mode === "light" ? 0.012 : 0.05);
  const muted = mix(paper, ink, mode === "light" ? 0.055 : 0.11);
  const border = mix(paper, ink, mode === "light" ? 0.14 : 0.2);
  const input = mix(paper, ink, mode === "light" ? 0.17 : 0.26);
  // Muted TEXT is the one that gets misjudged: too close to the ink and the
  // hierarchy vanishes, too close to the paper and it fails contrast. 62% of the
  // way is asserted against 4.5:1 in the tests rather than eyeballed.
  const mutedFg = mix(paper, ink, mode === "light" ? 0.62 : 0.66);
  const secondary = muted;
  const accentSurface = mix(paper, accent, mode === "light" ? 0.1 : 0.16);

  return {
    background: paper, foreground: fg(paper),
    card, "card-foreground": fg(card),
    popover: card, "popover-foreground": fg(card),
    primary: accent, "primary-foreground": fg(accent),
    secondary, "secondary-foreground": fg(secondary),
    muted, "muted-foreground": mutedFg,
    accent: accentSurface, "accent-foreground": fg(accentSurface),
    destructive: sem.destructive, "destructive-foreground": fg(sem.destructive),
    success: sem.success, "success-foreground": fg(sem.success),
    warning: sem.warning, "warning-foreground": fg(sem.warning),
    border, input, ring: accent,
    // The sidebar is its own mini-palette in the template and most business
    // sites never render one, so it follows the page rather than being designed.
    sidebar: card, "sidebar-foreground": fg(card),
    "sidebar-primary": accent, "sidebar-primary-foreground": fg(accent),
    "sidebar-accent": accentSurface, "sidebar-accent-foreground": fg(accentSurface),
    "sidebar-border": border, "sidebar-ring": accent,
  };
}

/**
 * The CSS a build appends.
 *
 * `:root` and `.dark` BOTH, which is the one way this differs mechanically from
 * the font injection: fonts go into `@theme`, which emits `:root` only, while
 * the template defines every colour twice — `--primary` at line 101 and again at
 * 140. A theme that wrote one block would leave the other half of every site on
 * the stock palette.
 *
 * Appended AFTER the base, so source order decides it and no `!important` or
 * specificity trick is needed — the same reasoning the accessibility overrides
 * at the end of styles.css already rely on.
 *
 * Takes a shipped NAME or a theme OBJECT. The object form is what makes this
 * function testable with no themes declared at all — the alternative was tests
 * that could only run against whatever happened to be in `THEMES`, which is how
 * emptying that list broke four of them at once. A build resolving a theme from
 * somewhere other than the shortlist gets the same door.
 */
export function themeCss(nameOrTheme) {
  const named = typeof nameOrTheme === "string";
  const theme = named ? THEMES[nameOrTheme] : nameOrTheme;
  // Both halves are required: a theme missing `dark` would emit a `.dark` block
  // of `undefined`s, which the browser drops silently and which reads on screen
  // as dark mode simply not having been themed.
  if (!theme?.light || !theme?.dark) return null;
  const name = named ? nameOrTheme : (theme.label || "custom").split("—")[0].trim();
  const block = (sel, mode) => {
    const p = paletteFor(theme, mode);
    const lines = Object.entries(p).map(([k, v]) => `  --${k}: ${css(v)};`);
    return `${sel} {\n${lines.join("\n")}\n}`;
  };
  // The non-colour blocks are separate from the palette blocks because they are
  // not colours and several of them are not single declarations either — the
  // shaped corners add a selector, and border and shadow are class overrides.
  //
  // ORDER MATTERS ONCE, at the end: the class overrides must come after the
  // token blocks, because `shadowCss` mixes against `var(--foreground)` and the
  // border overrides are ordinary rules competing on source order with the
  // utilities they replace.
  return `/* theme: ${name} — generated by builder/site-theme.mjs */\n` +
    block(":root", "light") + "\n\n" + block(".dark", "dark") + "\n\n" +
    cornerCss(theme) + "\n" +
    typeCss(theme.scale) + "\n" +
    trackingCss(theme.tracking) + "\n" +
    leadingCss(theme.leading) + "\n" +
    weightCss(theme.weight) + "\n" +
    densityCss(theme.density) + "\n" +
    borderCss(theme.border) + "\n" +
    iconCss(theme.icon) + "\n" +
    buttonsCss(theme.buttons) +
    inputsCss(theme.inputs) +
    displayCss(theme) +
    shadowCss(theme.shadow, theme) +
    // LAST, deliberately: glass re-declares tokens the palette blocks above
    // already set, and source order is the only thing making its values win.
    // The world paint follows even that — it owns the body and the veils, and
    // nothing after it may re-decide what the page sits on.
    surfaceCss(theme) +
    worldCss(theme) +
    skinCss(theme.skin) +
    ambientCss(theme);
}

/** What the model may choose from — an enum, so an invalid theme is impossible. */
export const THEME_NAMES = Object.keys(THEMES);
export function shortlistForPrompt() {
  return Object.entries(THEMES).map(([k, v]) => `${k} — ${v.label}`).join("\n");
}
