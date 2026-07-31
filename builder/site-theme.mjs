// What colour a generated site is.
//
// Every site the builder has ever published is the same one: shadcn's new-york
// defaults, `--primary: oklch(0.208 0.042 265.755)`, a near-black with a faint
// blue cast. A barber shop and a wine bar come out identical. Typography already
// varies per site (site-fonts.mjs); this is the other half.
//
// A THEME IS FOUR DECISIONS, NOT THIRTY-SEVEN. The template declares 37 tokens
// in `:root` and 36 of them are colours, but they are not 36 free choices — they
// are role PAIRS, every surface carrying a `-foreground` that has to be legible
// on it. So a theme here is a ground, an ink, an accent and a radius, and the
// other 32 tokens are derived. Two things follow, and both are the point:
//
//   1. A derived foreground is legible BY CONSTRUCTION. It is whichever of the
//      theme's own ink and paper actually clears contrast on that surface,
//      measured, not whichever one looked right.
//   2. There is very little to get wrong. A palette written out by hand has 36
//      chances to produce unreadable text; this has four inputs and a function.
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

const css = ([L, C, H]) => `oklch(${+L.toFixed(4)} ${+C.toFixed(4)} ${+H.toFixed(2)})`;
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

/**
 * A theme is these four values. Everything else in the palette is derived.
 *
 * `dark` is a separate ground/ink/accent rather than an inversion, because
 * inverting is what produces the glowing over-saturated dark modes: a chroma
 * that reads as rich on white reads as neon on black, so the accent's lightness
 * and chroma both have to move.
 */
export const THEMES = {
  ledger: {
    label: "Ledger — warm paper, oxblood, tight corners",
    radius: "0.25rem",
    light: { paper: [0.985, 0.006, 95], ink: [0.22, 0.014, 60], accent: [0.46, 0.14, 28] },
    dark: { paper: [0.19, 0.012, 60], ink: [0.96, 0.005, 95], accent: [0.63, 0.13, 30] },
  },
};

/** Every token for one mode, derived from that mode's three colours. */
export function paletteFor(theme, mode) {
  const { paper, ink, accent } = theme[mode];
  const fg = (surface) => foregroundFor(surface, ink, paper);
  // State colours are separated from the accent BEFORE anything derives from
  // them, so the foreground is picked for the colour that actually ships.
  const raw = SEMANTIC[mode];
  const sem = Object.fromEntries(Object.entries(raw)
    .map(([k, v]) => [k, separateFromAccent(v, accent, ink, paper)]));

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
 */
export function themeCss(name) {
  const theme = THEMES[name];
  if (!theme) return null;
  const block = (sel, mode) => {
    const p = paletteFor(theme, mode);
    const lines = Object.entries(p).map(([k, v]) => `  --${k}: ${css(v)};`);
    if (mode === "light") lines.unshift(`  --radius: ${theme.radius};`);
    return `${sel} {\n${lines.join("\n")}\n}`;
  };
  return `/* theme: ${name} — generated by builder/site-theme.mjs */\n` +
    block(":root", "light") + "\n\n" + block(".dark", "dark") + "\n";
}

/** What the model may choose from — an enum, so an invalid theme is impossible. */
export const THEME_NAMES = Object.keys(THEMES);
export function shortlistForPrompt() {
  return Object.entries(THEMES).map(([k, v]) => `${k} — ${v.label}`).join("\n");
}
