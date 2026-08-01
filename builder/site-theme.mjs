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

export function shadowCss(style, theme) {
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

/**
 * The AURORA the glass refracts — four saturated washes derived from the
 * accent's hue and its neighbours, covering the whole viewport so no region
 * falls back to bare paper (bare paper under glass is what reads as a white
 * page with grey boxes — the first render's failure, seen and corrected).
 * Lightness stays near the paper's so the measured contrast still holds.
 */
function canvasCss(theme) {
  const stop = (c, size, x, y) => `radial-gradient(${size} circle at ${x} ${y}, ${css(c)}, transparent 65%)`;
  const layer = (mode) => {
    const { accent } = theme[mode];
    const H = accent[2];
    const hues = [(H + 300) % 360, H, (H + 35) % 360, (H + 250) % 360];
    const Ls = mode === "light" ? [0.86, 0.85, 0.87, 0.88] : [0.34, 0.3, 0.32, 0.3];
    const Cs = mode === "light" ? [0.14, 0.16, 0.13, 0.12] : [0.14, 0.15, 0.13, 0.12];
    // Dark auroras are GLOWS in a dark room, not floodlights — at light-mode
    // alphas the paper never reads as black and the whole page goes murky
    // grey-violet (measured on the first enriched-page render).
    const As = mode === "light" ? [0.8, 0.75, 0.7, 0.6] : [0.42, 0.38, 0.34, 0.28];
    const at = [["50rem", "8%", "4%"], ["56rem", "94%", "14%"], ["48rem", "78%", "72%"], ["52rem", "12%", "92%"]];
    return hues.map((h, i) => stop([Ls[i], Cs[i], h, As[i]], ...at[i])).join(", ");
  };
  return `body { background-image: ${layer("light")}; background-attachment: fixed; }\n` +
    `.dark body { background-image: ${layer("dark")}; }\n`;
}

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
  // THE COMPONENT LAYER — where the theme changes what components ARE, not
  // just what colours they wear. The kit builds everything from shared
  // primitives, so restyling the primitives' own class hooks reshapes every
  // component that uses them, at three selectors instead of a thousand files:
  //   - `button.justify-center` (+ link-buttons): every cva button. Glass makes
  //     them PILLS, and the primary fill gets a top sheen and an accent glow.
  //   - `.border-input`: every field — input, textarea, native select. Frosted:
  //     translucent white fill, light edge, its own blur.
  //   - the surface trio above: every card, popover and menu.
  const [aL, aC, aH] = theme.light.accent;
  const [dL, dC, dH] = theme.dark.accent;
  const pills = "button.justify-center, a.justify-center.whitespace-nowrap";
  const components =
    `${pills} { border-radius: 9999px; }\n` +
    `.bg-primary { background-image: linear-gradient(180deg, oklch(1 0 0 / 0.28), oklch(1 0 0 / 0) 55%); box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.35), 0 8px 22px -10px oklch(${aL} ${aC} ${aH} / 0.55); }\n` +
    `.dark .bg-primary { box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.3), 0 8px 26px -10px oklch(${dL} ${dC} ${dH} / 0.6); }\n` +
    `.border-input { background-color: oklch(1 0 0 / 0.45); border-color: oklch(1 0 0 / 0.55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }\n` +
    `.dark .border-input { background-color: oklch(1 0 0 / 0.07); border-color: oklch(1 0 0 / 0.15); }\n` +
    `.bg-muted\\/30, .bg-muted\\/40, .bg-muted\\/50, .bg-muted\\/60 { background-color: oklch(1 0 0 / 0.3); }\n` +
    `.dark .bg-muted\\/30, .dark .bg-muted\\/40, .dark .bg-muted\\/50, .dark .bg-muted\\/60 { background-color: oklch(1 0 0 / 0.045); }\n`;
  return `:root {\n${tokens("light")}\n}\n.dark {\n${tokens("dark")}\n}\n` +
    `${SURF} { ${filter} border-color: oklch(1 0 0 / 0.6); background-image: linear-gradient(165deg, oklch(1 0 0 / 0.5), oklch(1 0 0 / 0) 42%); }\n` +
    `.dark ${SURF.split(", ").join(", .dark ")} { border-color: oklch(1 0 0 / 0.16); background-image: linear-gradient(165deg, oklch(1 0 0 / 0.1), oklch(1 0 0 / 0) 45%); }\n` +
    components +
    canvasCss(theme);
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
    surface: "glass",
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
  //     shadow: "crisp",              // flat | crisp | soft
  //     icon: "regular",              // fine | regular | heavy
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
    shadowCss(theme.shadow, theme) +
    // LAST, deliberately: glass re-declares tokens the palette blocks above
    // already set, and source order is the only thing making its values win.
    surfaceCss(theme);
}

/** What the model may choose from — an enum, so an invalid theme is impossible. */
export const THEME_NAMES = Object.keys(THEMES);
export function shortlistForPrompt() {
  return Object.entries(THEMES).map(([k, v]) => `${k} — ${v.label}`).join("\n");
}
